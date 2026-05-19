(function initProjectMapOnboardingCompat(global) {
  'use strict';

  function welcomeApi() {
    if (global && global.ProjectMapWelcomeSurface) {
      return global.ProjectMapWelcomeSurface;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('./welcome_surface_ui.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function call(name, fallback) {
    const api = welcomeApi();
    return api && typeof api[name] === 'function' ? api[name] : fallback;
  }

  const compat = {
    createController: function createController(options) {
      return call('createController', () => ({
        shouldAutoOpen: () => true,
        markSeen: () => false,
        clearSeen: () => false
      }))(options);
    },
    primaryActionKind: function primaryActionKind(env) {
      return call('primaryActionKind', () => 'browser')(env);
    },
    canLoadBundledDemo: function canLoadBundledDemo(env) {
      return call('canLoadBundledDemo', () => false)(env);
    },
    open: function open() {
      return call('open', () => false)();
    },
    close: function close() {
      return call('close', () => false)();
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = compat;
  }
  if (global) {
    global.ProjectMapOnboarding = compat;
  }
})(typeof window !== 'undefined' ? window : globalThis);
