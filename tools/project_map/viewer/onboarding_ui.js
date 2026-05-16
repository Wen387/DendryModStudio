(function initProjectMapOnboarding(global) {
  'use strict';

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

  function storageKey() {
    const api = contracts();
    return api && api.STORAGE_KEYS && api.STORAGE_KEYS.onboardingSeen
      ? api.STORAGE_KEYS.onboardingSeen
      : 'dendry-mod-studio-onboarding-seen';
  }

  function openEventName() {
    const api = contracts();
    return api && api.EVENT_NAMES && api.EVENT_NAMES.openOnboarding
      ? api.EVENT_NAMES.openOnboarding
      : 'ProjectMap:open-onboarding';
  }

  function desktopCapabilities() {
    if (global && global.ProjectMapDesktopCapabilities) {
      return global.ProjectMapDesktopCapabilities;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('./desktop_capabilities.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function createController(options) {
    const opts = options || {};
    const storage = opts.storage || safeStorage();
    const key = opts.storageKey || storageKey();
    return {
      shouldAutoOpen,
      markSeen,
      clearSeen
    };

    function shouldAutoOpen() {
      if (!storage || typeof storage.getItem !== 'function') {
        return true;
      }
      try {
        return storage.getItem(key) !== '1';
      } catch (_err) {
        return true;
      }
    }

    function markSeen() {
      if (!storage || typeof storage.setItem !== 'function') {
        return false;
      }
      try {
        storage.setItem(key, '1');
        return true;
      } catch (_err) {
        return false;
      }
    }

    function clearSeen() {
      if (!storage || typeof storage.removeItem !== 'function') {
        return false;
      }
      try {
        storage.removeItem(key);
        return true;
      } catch (_err) {
        return false;
      }
    }
  }

  function primaryActionKind(env) {
    const desktop = desktopCapabilities();
    return desktop && desktop.isDesktop(env || global) ? 'desktop' : 'browser';
  }

  function canLoadBundledDemo(env) {
    const desktop = desktopCapabilities();
    return Boolean(desktop && desktop.canOpenStarterDemo(env || global));
  }

  function safeStorage() {
    try {
      return global && global.localStorage ? global.localStorage : null;
    } catch (_err) {
      return null;
    }
  }

  const state = {
    controller: null,
    elements: null
  };

  const api = {
    createController,
    primaryActionKind,
    canLoadBundledDemo,
    open: () => openDialog(true),
    close: () => closeDialog(true)
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapOnboarding = api;
  }
  if (!global || !global.document) {
    return;
  }

  state.controller = createController({storage: safeStorage()});

  onReady(() => start(global.document));

  function onReady(callback) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function start(document) {
    state.elements = {
      dialog: document.getElementById('studio-onboarding'),
      openButton: document.getElementById('studio-open-onboarding'),
      primary: document.getElementById('onboarding-primary'),
      demo: document.getElementById('onboarding-load-demo'),
      indexInput: document.getElementById('index-file'),
      desktopOpen: document.getElementById('desktop-open-project'),
      desktopIncludeExcerpts: document.getElementById('desktop-include-excerpts'),
      topbarMore: document.getElementById('topbar-more')
    };
    if (!state.elements.dialog) {
      return;
    }
    wireEvents(document);
    updatePrimaryAction();
    if (state.controller.shouldAutoOpen()) {
      openDialog(false);
    }
  }

  function wireEvents(document) {
    if (state.elements.openButton) {
      state.elements.openButton.addEventListener('click', () => openDialog(true));
    }
    if (state.elements.primary) {
      state.elements.primary.addEventListener('click', handlePrimaryAction);
    }
    if (state.elements.demo) {
      state.elements.demo.addEventListener('click', handleDemoAction);
    }
    state.elements.dialog.addEventListener('click', (event) => {
      if (event.target === state.elements.dialog || event.target.closest('[data-onboarding-close]')) {
        closeDialog(true);
      }
    });
    document.addEventListener(openEventName(), () => openDialog(true));
    document.addEventListener('project-map:locale-changed', updatePrimaryAction);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !state.elements.dialog.classList.contains('hidden')) {
        closeDialog(true);
      }
    });
  }

  function updatePrimaryAction() {
    if (!state.elements || !state.elements.primary) {
      return;
    }
    const i18n = global.ProjectMapI18n;
    const translate = i18n && typeof i18n.t === 'function'
      ? i18n.t
      : (_key, fallback) => fallback;
    if (primaryActionKind(global) === 'desktop') {
      state.elements.primary.textContent = translate('onboarding.primary.desktop', 'Open Project Folder');
    } else {
      state.elements.primary.textContent = translate('onboarding.primary.browser', 'Load ProjectIndex JSON');
    }
    updateDemoAction();
  }

  function updateDemoAction() {
    if (!state.elements || !state.elements.demo) {
      return;
    }
    state.elements.demo.classList.toggle('hidden', !canLoadBundledDemo(global));
  }

  function openDialog(fromMenu) {
    if (!state.elements || !state.elements.dialog) {
      return false;
    }
    updatePrimaryAction();
    state.elements.dialog.classList.remove('hidden');
    if (fromMenu && state.elements.topbarMore) {
      state.elements.topbarMore.open = false;
    }
    if (state.elements.primary) {
      state.elements.primary.focus();
    }
    return true;
  }

  function closeDialog(markSeen) {
    if (!state.elements || !state.elements.dialog) {
      return false;
    }
    state.elements.dialog.classList.add('hidden');
    if (markSeen) {
      state.controller.markSeen();
    }
    return true;
  }

  function handlePrimaryAction() {
    closeDialog(true);
    if (primaryActionKind(global) === 'desktop' && state.elements.desktopOpen) {
      state.elements.desktopOpen.click();
      return;
    }
    if (state.elements.indexInput) {
      state.elements.indexInput.click();
    }
  }

  function handleDemoAction() {
    if (!canLoadBundledDemo(global)) {
      return;
    }
    const includeExcerpts = Boolean(state.elements.desktopIncludeExcerpts && state.elements.desktopIncludeExcerpts.checked);
    const desktop = desktopCapabilities();
    if (!desktop) {
      return;
    }
    closeDialog(true);
    state.elements.demo.disabled = true;
    desktop.openStarterDemo({includeExcerpts}, global).catch((err) => {
      if (global.console && typeof global.console.warn === 'function') {
        global.console.warn('Could not open bundled demo template:', err && err.message ? err.message : err);
      }
    }).finally(() => {
      state.elements.demo.disabled = false;
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
