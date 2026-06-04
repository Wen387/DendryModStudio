(function initProjectMapNavigationHistory(global) {
  'use strict';

  // Browser-style back history. Generic and DOM-free: callers push "location"
  // descriptors (any object carrying a stable `id` string for the page) and
  // pop them in reverse order. The module never reasons about Explore/Create
  // internals; it only stacks and de-duplicates consecutive same-id entries.
  const DEFAULT_LIMIT = 25;

  function create(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const limit = Number.isFinite(opts.limit) && opts.limit > 0 ? Math.floor(opts.limit) : DEFAULT_LIMIT;
    const stack = [];

    function idOf(location) {
      if (!location || typeof location !== 'object') {
        return '';
      }
      return location.id != null ? String(location.id) : '';
    }

    // Push the page the user is leaving. Recording the same page twice in a
    // row is a no-op so a re-render or re-click never stacks duplicates.
    function record(location) {
      if (!location || typeof location !== 'object') {
        return false;
      }
      const top = stack.length ? stack[stack.length - 1] : null;
      if (top && idOf(top) === idOf(location)) {
        return false;
      }
      stack.push(location);
      if (stack.length > limit) {
        stack.splice(0, stack.length - limit);
      }
      return true;
    }

    function back() {
      return stack.length ? stack.pop() : null;
    }

    function peek() {
      return stack.length ? stack[stack.length - 1] : null;
    }

    function canGoBack() {
      return stack.length > 0;
    }

    function size() {
      return stack.length;
    }

    function clear() {
      stack.length = 0;
    }

    return {record, back, peek, canGoBack, size, clear};
  }

  const api = {create, DEFAULT_LIMIT};

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapNavigationHistory = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
