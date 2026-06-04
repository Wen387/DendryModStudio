(function (global) {
  'use strict';

  // Shared, canonical text helpers for the viewer. Browser scripts duplicate
  // these locally; this module is the single source of truth they can adopt.
  // escapeHtml/escapeAttr use a nullish guard (not `|| ''`) so that meaningful
  // falsy values (0, false) render as "0"/"false" instead of being silently
  // dropped to an empty string.

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  const api = {ensureArray, escapeHtml, escapeAttr};

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapDomText = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
