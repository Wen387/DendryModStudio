(function initProjectMapThemeUi(global) {
  'use strict';

  // Theme controller for the light/dark palette. The actual palette lives in
  // viewer/styles/base.css (`:root` light defaults + `:root[data-theme="dark"]`
  // overrides). A tiny inline bootstrap in index.html sets the initial
  // data-theme before first paint to avoid a flash; this module owns the
  // runtime side: the topbar control, persistence, live "auto" tracking, and a
  // change event other surfaces can listen to. Dependency-free and DOM-guarded.

  const FALLBACK_VALUES = ['auto', 'light', 'dark'];
  const FALLBACK_DEFAULT = 'auto';
  const FALLBACK_STORAGE_KEY = 'dendry-mod-studio-theme';
  const FALLBACK_THEME_CHANGED = 'ProjectMap:theme-changed';

  function contracts() {
    if (global && global.ProjectMapStudioSharedConstants) {
      return global.ProjectMapStudioSharedConstants;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('../authoring/studio_shared_constants.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function themeValues() {
    const api = contracts();
    return api && Array.isArray(api.THEME_VALUES) && api.THEME_VALUES.length
      ? api.THEME_VALUES
      : FALLBACK_VALUES;
  }

  function defaultTheme() {
    const api = contracts();
    return api && api.DEFAULT_THEME ? api.DEFAULT_THEME : FALLBACK_DEFAULT;
  }

  function storageKey() {
    const api = contracts();
    return api && api.STORAGE_KEYS && api.STORAGE_KEYS.theme
      ? api.STORAGE_KEYS.theme
      : FALLBACK_STORAGE_KEY;
  }

  function themeChangedEvent() {
    const api = contracts();
    return api && api.EVENT_NAMES && api.EVENT_NAMES.themeChanged
      ? api.EVENT_NAMES.themeChanged
      : FALLBACK_THEME_CHANGED;
  }

  function isValidTheme(value) {
    return themeValues().indexOf(value) !== -1;
  }

  function safeStorage() {
    try {
      return global && global.localStorage ? global.localStorage : null;
    } catch (_err) {
      return null;
    }
  }

  function readStoredTheme() {
    const storage = safeStorage();
    if (!storage || typeof storage.getItem !== 'function') {
      return defaultTheme();
    }
    try {
      const stored = storage.getItem(storageKey());
      return isValidTheme(stored) ? stored : defaultTheme();
    } catch (_err) {
      return defaultTheme();
    }
  }

  function writeStoredTheme(value) {
    const storage = safeStorage();
    if (!storage || typeof storage.setItem !== 'function') {
      return;
    }
    try {
      storage.setItem(storageKey(), value);
    } catch (_err) {
      /* ignore persistence failures (private mode, quota) */
    }
  }

  function prefersDark() {
    return Boolean(global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  // Map a preference ('auto'|'light'|'dark') to a concrete palette name.
  function resolveTheme(pref) {
    const preference = isValidTheme(pref) ? pref : defaultTheme();
    if (preference === 'auto') {
      return prefersDark() ? 'dark' : 'light';
    }
    return preference;
  }

  function applyResolved(resolved) {
    if (!global || !global.document || !global.document.documentElement) {
      return;
    }
    global.document.documentElement.dataset.theme = resolved;
  }

  function selectControl() {
    if (!global || !global.document || typeof global.document.getElementById !== 'function') {
      return null;
    }
    return global.document.getElementById('theme-select');
  }

  function syncControl(pref) {
    const control = selectControl();
    if (control && control.value !== pref) {
      control.value = pref;
    }
  }

  function dispatchChanged(pref, resolved) {
    if (!global || !global.document || typeof global.CustomEvent !== 'function') {
      return;
    }
    try {
      global.document.dispatchEvent(new global.CustomEvent(themeChangedEvent(), {
        detail: { theme: pref, resolved: resolved }
      }));
    } catch (_err) {
      /* ignore environments without CustomEvent */
    }
  }

  let currentPref = defaultTheme();

  function getTheme() {
    return currentPref;
  }

  function getResolvedTheme() {
    return resolveTheme(currentPref);
  }

  // Apply a preference and (by default) persist + notify. `silent` skips the
  // event/persistence — used during initial mount where the bootstrap already
  // painted the right palette.
  function setTheme(pref, options) {
    const opts = options || {};
    const preference = isValidTheme(pref) ? pref : defaultTheme();
    currentPref = preference;
    const resolved = resolveTheme(preference);
    applyResolved(resolved);
    syncControl(preference);
    if (!opts.silent) {
      writeStoredTheme(preference);
      dispatchChanged(preference, resolved);
    }
    return resolved;
  }

  function bindMediaQuery() {
    if (!global.matchMedia) {
      return;
    }
    const mq = global.matchMedia('(prefers-color-scheme: dark)');
    const handler = function onSystemThemeChange() {
      // Only re-resolve live when the user is following the system.
      if (currentPref === 'auto') {
        const resolved = resolveTheme('auto');
        applyResolved(resolved);
        dispatchChanged('auto', resolved);
      }
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(handler);
    }
  }

  function bindControl() {
    const control = selectControl();
    if (!control || control.dataset.themeBound === 'true') {
      return;
    }
    control.dataset.themeBound = 'true';
    control.addEventListener('change', function onThemeSelect() {
      setTheme(control.value);
    });
  }

  function mount() {
    currentPref = readStoredTheme();
    // The bootstrap already set data-theme; re-apply silently to stay in sync
    // and to populate the control without firing a spurious change event.
    setTheme(currentPref, { silent: true });
    bindControl();
    bindMediaQuery();
  }

  function onReady(callback) {
    if (!global || !global.document) {
      return;
    }
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  const api = {
    getTheme,
    getResolvedTheme,
    setTheme,
    resolveTheme
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapThemeUi = api;
  }
  onReady(mount);
})(typeof window !== 'undefined' ? window : globalThis);
