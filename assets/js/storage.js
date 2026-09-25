(function () {
  'use strict';

  const cfg = window.APP_CONFIG;
  const rules = window.BusinessRules;

  function normalizeStoredRun(item) {
    if (!item || typeof item !== 'object') return null;
    return {
      ...item,
      holidays: rules.normalizeHolidays(item.holidays || []),
      updatedAt: item.updatedAt || null
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(cfg.STORAGE_KEY);
      if (!raw) return { history: [] };
      const parsed = JSON.parse(raw);
      return {
        history: Array.isArray(parsed.history) ? parsed.history.map(normalizeStoredRun).filter(Boolean) : []
      };
    } catch (error) {
      return { history: [] };
    }
  }

  function saveState(state) {
    localStorage.setItem(cfg.STORAGE_KEY, JSON.stringify({ history: state.history || [] }));
  }

  function saveRun(run) {
    const state = loadState();
    const existing = state.history.find((item) => item.id === run.id);
    const serialized = {
      id: run.id,
      period: run.period,
      processedAt: run.processedAt || existing?.processedAt || new Date().toISOString(),
      updatedAt: run.updatedAt || null,
      summary: run.summary,
      holidays: rules.normalizeHolidays(run.holidays || []),
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
      holidays: rules.normalizeHolidays(item.holidays || []),
      employees: rules.hydrateEmployees(item.employees)
    };
  }

  function deleteRun(id) {
    const state = loadState();
    const before = state.history.length;
    state.history = state.history.filter((run) => run.id !== id);
    saveState(state);
    return state.history.length < before;
  }

  function clearHistory() {
    saveState({ history: [] });
  }

  window.AppStorage = Object.freeze({
    loadState,
    saveRun,
    listHistory,
    getRun,
    deleteRun,
    clearHistory
  });
})();
