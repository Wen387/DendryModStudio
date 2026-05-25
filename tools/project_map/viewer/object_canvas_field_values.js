(function initProjectMapObjectCanvasFieldValues(global) {
  'use strict';

  function collectCanvasFieldEntries(host, options) {
    if (!host || typeof host.querySelectorAll !== 'function') {
      return [];
    }
    const opts = options || {};
    const active = opts.activeElement ||
      (global.document && global.document.activeElement) ||
      null;
    const byKey = new Map();
    host.querySelectorAll('[data-object-canvas-field]').forEach((input, order) => {
      const key = input && input.dataset && input.dataset.objectCanvasField || '';
      if (!key || input.disabled || !isCollectableField(input)) {
        return;
      }
      if (!byKey.has(key)) {
        byKey.set(key, []);
      }
      byKey.get(key).push({
        input,
        order,
        active: input === active,
        visible: undefined,
        structureOutput: Boolean(input.dataset && input.dataset.previewObjectStructureOutput)
      });
    });
    const entries = [];
    byKey.forEach((rows) => {
      // Fast path: keys with a single mapped input (the typical case for
      // virtually all 101+ fields on a large event) skip the layout-forcing
      // visibility check entirely. fieldIsVisibleForCollection calls
      // getComputedStyle/getClientRects which each flush layout on the full
      // host DOM (multi-MB on large events) — that used to dominate
      // collectValues at 100-300ms.
      if (rows.length === 1) {
        entries.push(rows[0].input);
        return;
      }
      const resolveVisible = (row) => {
        if (row.visible === undefined) {
          row.visible = fieldIsVisibleForCollection(row.input, opts);
        }
        return row.visible;
      };
      const activeRow = rows.find((row) => row.active && resolveVisible(row));
      if (activeRow) {
        entries.push(activeRow.input);
        return;
      }
      const visibleRows = rows.filter(resolveVisible);
      if (visibleRows.length) {
        entries.push(visibleRows[0].input);
        return;
      }
      const structureOutput = rows.find((row) => row.structureOutput && String(row.input.value || '').trim());
      entries.push((structureOutput || rows[0]).input);
    });
    return entries;
  }

  function isCollectableField(input) {
    if (!input || !input.matches) {
      return false;
    }
    return input.matches('input, textarea, select');
  }

  function fieldIsVisibleForCollection(input, options) {
    if (!input || String(input.type || '').toLowerCase() === 'hidden') {
      return false;
    }
    if (typeof input.closest === 'function' && input.closest('[hidden], .hidden, [aria-hidden="true"]')) {
      return false;
    }
    const opts = options || {};
    const getComputedStyle = opts.getComputedStyle || global.getComputedStyle;
    if (getComputedStyle) {
      const style = getComputedStyle(input);
      if (style && (style.display === 'none' || style.visibility === 'hidden')) {
        return false;
      }
    }
    if (typeof input.getClientRects === 'function' && input.getClientRects().length > 0) {
      return true;
    }
    return Boolean(input.offsetWidth || input.offsetHeight);
  }

  const api = {
    collectCanvasFieldEntries,
    fieldIsVisibleForCollection,
    isCollectableField
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.ProjectMapObjectCanvasFieldValues = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
