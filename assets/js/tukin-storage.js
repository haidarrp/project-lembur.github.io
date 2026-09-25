(function () {
  'use strict';

  const DB_NAME = 'pusdatin-pkp-generator';
  const DB_VERSION = 1;
  const STORE_NAME = 'tukinRuns';
  const HISTORY_LIMIT = 24;

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('Browser tidak mendukung IndexedDB.'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Gagal membuka penyimpanan riwayat.'));
    });
  }

  function txRequest(mode, action) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      let request;
      try {
        request = action(store);
      } catch (error) {
        db.close();
        reject(error);
        return;
      }
      tx.oncomplete = () => {
        db.close();
        resolve(request && 'result' in request ? request.result : undefined);
      };
      tx.onerror = () => {
        const error = tx.error || request?.error || new Error('Operasi penyimpanan gagal.');
        db.close();
        reject(error);
      };
      tx.onabort = () => {
        const error = tx.error || new Error('Operasi penyimpanan dibatalkan.');
        db.close();
        reject(error);
      };
    }));
  }

  function latestTimestamp(run) {
    return new Date(run.updatedAt || run.processedAt || 0).getTime() || 0;
  }

  async function listRuns() {
    const all = await txRequest('readonly', (store) => store.getAll());
    return (Array.isArray(all) ? all : [])
      .sort((a, b) => latestTimestamp(b) - latestTimestamp(a))
      .map((run) => ({
        id: run.id,
        period: run.period,
        settings: run.settings,
        processedAt: run.processedAt,
        updatedAt: run.updatedAt || null,
        generatedName: run.generatedName || '',
        summary: run.summary || {}
      }));
  }

  async function getRun(id) {
    if (!id) return null;
    return (await txRequest('readonly', (store) => store.get(id))) || null;
  }

  async function saveRun(run) {
    if (!run || !run.id) throw new Error('Data riwayat tidak valid.');
    await txRequest('readwrite', (store) => store.put(run));
    await trimHistory();
    return run;
  }

  async function deleteRun(id) {
    if (!id) return false;
    await txRequest('readwrite', (store) => store.delete(id));
    return true;
  }

  async function trimHistory() {
    const all = await txRequest('readonly', (store) => store.getAll());
    const sorted = (Array.isArray(all) ? all : []).sort((a, b) => latestTimestamp(b) - latestTimestamp(a));
    const excess = sorted.slice(HISTORY_LIMIT);
    if (!excess.length) return;
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      excess.forEach((run) => store.delete(run.id));
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { const error = tx.error || new Error('Gagal merapikan riwayat.'); db.close(); reject(error); };
    });
  }

  window.TukinStorage = Object.freeze({ listRuns, getRun, saveRun, deleteRun });
})();
