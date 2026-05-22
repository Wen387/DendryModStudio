(function initProjectMapCardBoardPerf(global) {
  'use strict';

  const BUFFER_LIMIT = 50;
  const STORAGE_KEY = 'dmsCardBoardPerf';
  const BUFFER_KEY = '__DMS_CARD_BOARD_PERF__';

  function enabled() {
    if (!global) {
      return false;
    }
    if (global.__DMS_CARD_BOARD_PERF_ENABLED__ === true) {
      return true;
    }
    try {
      return Boolean(global.localStorage && global.localStorage.getItem(STORAGE_KEY) === '1');
    } catch (_err) {
      return false;
    }
  }

  function now() {
    const perf = global && global.performance;
    return perf && typeof perf.now === 'function' ? perf.now() : Date.now();
  }

  function start(name, detail) {
    if (!enabled()) {
      return null;
    }
    return {
      name: String(name || 'cardBoard.measure'),
      detail: detail && typeof detail === 'object' ? Object.assign({}, detail) : {},
      start: now()
    };
  }

  function end(token, detail) {
    if (!token) {
      return null;
    }
    const durationMs = Math.max(0, now() - Number(token.start || 0));
    return record(token.name, durationMs, Object.assign({}, token.detail || {}, detail || {}));
  }

  function measure(name, fn, detail) {
    const token = start(name, detail);
    try {
      const result = fn();
      end(token);
      return result;
    } catch (err) {
      end(token, {error: err && err.message ? err.message : String(err || 'error')});
      throw err;
    }
  }

  function record(name, durationMs, detail) {
    if (!enabled()) {
      return null;
    }
    const row = {
      name: String(name || 'cardBoard.measure'),
      durationMs: Number(durationMs || 0),
      detail: detail && typeof detail === 'object' ? Object.assign({}, detail) : {},
      timestamp: new Date().toISOString()
    };
    const rows = Array.isArray(global[BUFFER_KEY]) ? global[BUFFER_KEY] : [];
    rows.push(row);
    while (rows.length > BUFFER_LIMIT) {
      rows.shift();
    }
    global[BUFFER_KEY] = rows;
    return row;
  }

  const api = {enabled, start, end, measure, record};

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapCardBoardPerf = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
