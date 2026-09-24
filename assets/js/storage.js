(function () {
  'use strict';

  const cfg = window.APP_CONFIG;
  const rules = window.BusinessRules;

  function loadState() {
    try {
      const raw = localStorage.getItem(cfg.STORAGE_KEY);
      if (!raw) return { history: [], session: null };
      const parsed = JSON.parse(raw);
      return {
        history: Array.isArray(parsed.history) ? parsed.history : [],
        session: parsed.session || null
      };
    } catch (error) {
      return { history: [], session: null };
    }
  }

  function saveState(state) {
    localStorage.setItem(cfg.STORAGE_KEY, JSON.stringify(state));
  }

  function setSession(session) {
    const state = loadState();
    state.session = session;
    saveState(state);
    return session;
  }

  function getSession() {
    return loadState().session;
  }

  function clearSession() {
    const state = loadState();
    state.session = null;
    saveState(state);
  }

  function saveRun(run) {
    const state = loadState();
    const serialized = {
      id: run.id,
      period: run.period,
      processedAt: run.processedAt,
      summary: run.summary,
      employees: rules.serializeEmployees(run.employees)
    };
    state.history = [serialized, ...state.history.filter((item) => item.id !== run.id)].slice(0, cfg.HISTORY_LIMIT);
    saveState(state);
    return serialized;
  }

  function listHistory() {
    return loadState().history;
  }

  function getRun(id) {
    const item = loadState().history.find((run) => run.id === id);
    if (!item) return null;
    return {
      ...item,
      employees: rules.hydrateEmployees(item.employees)
    };
  }

  function clearHistory() {
    const state = loadState();
    state.history = [];
    saveState(state);
  }

  window.AppStorage = Object.freeze({
    loadState,
    setSession,
    getSession,
    clearSession,
    saveRun,
    listHistory,
    getRun,
    clearHistory
  });
})();
