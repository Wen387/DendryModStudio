(function initProjectMapDesktopCapabilities(global) {
  'use strict';

  function raw(env) {
    const candidates = [];
    if (env) {
      candidates.push(env);
      if (env.window) {
        candidates.push(env.window);
      }
      if (env.globalThis) {
        candidates.push(env.globalThis);
      }
    } else {
      if (global) {
        candidates.push(global);
      }
      if (typeof window !== 'undefined') {
        candidates.push(window);
      }
      if (typeof globalThis !== 'undefined') {
        candidates.push(globalThis);
      }
    }

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (candidate && candidate.dendryDesktop) {
        return candidate.dendryDesktop;
      }
    }
    return null;
  }

  function has(method, env) {
    const desktop = raw(env);
    return Boolean(desktop && typeof desktop[method] === 'function');
  }

  function isDesktop(env) {
    return Boolean(raw(env));
  }

  function canOpenStarterDemo(env) {
    return has('openStarterDemo', env);
  }

  function canCheckUpdateNotice(env) {
    return has('checkUpdateNotice', env);
  }

  function canOpenExternalUrl(env) {
    return has('openExternalUrl', env);
  }

  function canCreateRuntimeLens(env) {
    return has('createRuntimeLens', env);
  }

  function canListCatalogTemplates(env) {
    return has('listCatalogTemplates', env);
  }

  function canOpenCatalogTemplate(env) {
    return has('openCatalogTemplate', env);
  }

  function getLocale(env) {
    const desktop = raw(env);
    if (!desktop || typeof desktop.getLocale !== 'function') {
      return '';
    }
    try {
      return desktop.getLocale();
    } catch (_err) {
      return '';
    }
  }

  function getState(env) {
    const desktop = raw(env);
    if (!desktop || typeof desktop.getState !== 'function') {
      return null;
    }
    try {
      return desktop.getState();
    } catch (_err) {
      return null;
    }
  }

  function openStarterDemo(options, env) {
    const desktop = raw(env);
    if (!desktop || typeof desktop.openStarterDemo !== 'function') {
      return resolve(null);
    }
    try {
      return resolve(desktop.openStarterDemo(options || {}));
    } catch (err) {
      return reject(err);
    }
  }

  function checkUpdateNotice(options, env) {
    const desktop = raw(env);
    if (!desktop || typeof desktop.checkUpdateNotice !== 'function') {
      return resolve(null);
    }
    try {
      return resolve(desktop.checkUpdateNotice(options || {}));
    } catch (err) {
      return reject(err);
    }
  }

  function openExternalUrl(options, env) {
    const desktop = raw(env);
    if (!desktop || typeof desktop.openExternalUrl !== 'function') {
      return false;
    }
    try {
      return desktop.openExternalUrl(options || {});
    } catch (_err) {
      return false;
    }
  }

  function resolve(value) {
    return typeof Promise !== 'undefined' ? Promise.resolve(value) : value;
  }

  function reject(err) {
    return typeof Promise !== 'undefined' ? Promise.reject(err) : null;
  }

  function listCatalogTemplates(options, env) {
    var desktop = raw(env);
    if (!desktop || typeof desktop.listCatalogTemplates !== 'function') {
      return resolve(null);
    }
    try {
      return resolve(desktop.listCatalogTemplates(options || {}));
    } catch (err) {
      return reject(err);
    }
  }

  function openCatalogTemplate(options, env) {
    var desktop = raw(env);
    if (!desktop || typeof desktop.openCatalogTemplate !== 'function') {
      return resolve(null);
    }
    try {
      return resolve(desktop.openCatalogTemplate(options || {}));
    } catch (err) {
      return reject(err);
    }
  }

  function removeCatalogTemplate(options, env) {
    var desktop = raw(env);
    if (!desktop || typeof desktop.removeCatalogTemplate !== 'function') {
      return resolve(null);
    }
    try {
      return resolve(desktop.removeCatalogTemplate(options || {}));
    } catch (err) {
      return reject(err);
    }
  }

  const api = {
    raw,
    isDesktop,
    has,
    canOpenStarterDemo,
    canCheckUpdateNotice,
    canOpenExternalUrl,
    canCreateRuntimeLens,
    canListCatalogTemplates,
    canOpenCatalogTemplate,
    getLocale,
    getState,
    openStarterDemo,
    checkUpdateNotice,
    openExternalUrl,
    listCatalogTemplates,
    openCatalogTemplate,
    removeCatalogTemplate
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapDesktopCapabilities = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
