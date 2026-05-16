(function initProjectMapI18n(global) {
  'use strict';

  const STORAGE_KEY = 'dendry-mod-studio-locale';
  const LOCALE_MODE_KEY = 'dendry-mod-studio-locale-mode';
  const LOCALE_MODE = {
    AUTO: 'auto',
    MANUAL: 'manual'
  };
  const DEFAULT_LOCALE = 'en';
  const DICTIONARIES = global.ProjectMapI18nDictionaries || {};

  const savedLocale = readStoredLocale();
  let localeMode = readStoredLocaleMode();
  let locale = normalizeLocale(
    localeMode === LOCALE_MODE.MANUAL && savedLocale
      ? savedLocale
      : detectNavigatorLocale() || DEFAULT_LOCALE
  );

  applyAutoLocale();

  function applyAutoLocale() {
    if (localeMode !== LOCALE_MODE.AUTO) {
      return;
    }

    const fallback = detectNavigatorLocale() || DEFAULT_LOCALE;
    const desktop = desktopCapabilities();

    if (!(desktop && desktop.has('getLocale', global))) {
      applyLocale(fallback, false);
      return;
    }

    let detected;
    try {
      detected = desktop.getLocale(global);
    } catch (_err) {
      applyLocale(fallback, false);
      return;
    }

    if (typeof detected === 'string') {
      applyLocale(detected || fallback, false);
      return;
    }
    if (detected && typeof detected.then === 'function') {
      detected
        .then((value) => applyLocale(value || fallback, false))
        .catch(() => {
          applyLocale(fallback, false);
        });
      return;
    }
    applyLocale(fallback, false);
  }

  function desktopCapabilities() {
    if (global && global.ProjectMapDesktopCapabilities) {
      return global.ProjectMapDesktopCapabilities;
    }
    if (typeof require === 'function') {
      try {
        return require('./desktop_capabilities.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function detectNavigatorLocale() {
    try {
      const candidates = [];
      if (global && global.navigator) {
        if (Array.isArray(global.navigator.languages)) {
          candidates.push.apply(candidates, global.navigator.languages);
        }
        candidates.push(global.navigator.language || '');
      }

      for (let i = 0; i < candidates.length; i += 1) {
        const candidate = String(candidates[i] || '').trim();
        if (candidate) {
          return candidate;
        }
      }
    } catch (_err) {
      return '';
    }
    return '';
  }

  function normalizeLocale(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'en' || raw.startsWith('en-')) {
      return 'en';
    }
    if (raw.startsWith('zh')) {
      return 'zh-Hant';
    }
    return raw ? 'en' : DEFAULT_LOCALE;
  }

  function readStoredValue(key) {
    try {
      return global.localStorage && global.localStorage.getItem(key);
    } catch (_err) {
      return '';
    }
  }

  function readStoredLocale() {
    return readStoredValue(STORAGE_KEY);
  }

  function readStoredLocaleMode() {
    const value = readStoredValue(LOCALE_MODE_KEY);
    if (value === LOCALE_MODE.MANUAL || value === LOCALE_MODE.AUTO) {
      return value;
    }
    return LOCALE_MODE.AUTO;
  }

  function storeLocaleMode(mode) {
    if (mode !== LOCALE_MODE.MANUAL && mode !== LOCALE_MODE.AUTO) {
      return;
    }
    try {
      if (global.localStorage) {
        global.localStorage.setItem(LOCALE_MODE_KEY, mode);
      }
    } catch (_err) {
      // localStorage can be unavailable in restricted browser contexts.
    }
  }

  function clearStoredLocale() {
    try {
      if (global.localStorage) {
        global.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_err) {
      // localStorage can be unavailable in restricted browser contexts.
    }
  }

  function storeLocale(value) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, value);
      }
    } catch (err) {
      // localStorage can be unavailable in restricted browser contexts.
    }
  }

  function t(key, fallback) {
    const dict = DICTIONARIES[locale] || {};
    return dict[key] || fallback || key;
  }

  function setLocale(value) {
    if (value === LOCALE_MODE.AUTO) {
      localeMode = LOCALE_MODE.AUTO;
      storeLocaleMode(localeMode);
      clearStoredLocale();
      applyAutoLocale();
      syncLocaleSelect();
      return;
    }
    localeMode = LOCALE_MODE.MANUAL;
    applyLocale(value, true);
  }

  function applyLocale(value, persistLocale) {
    const next = normalizeLocale(value);
    if (next === locale) {
      if (persistLocale) {
        storeLocale(locale);
        storeLocaleMode(LOCALE_MODE.MANUAL);
        localeMode = LOCALE_MODE.MANUAL;
      }
      syncDocumentLanguage(locale);
      applyTranslations(global.document);
      syncLocaleSelect(locale);
      return;
    }
    locale = next;
    if (persistLocale) {
      storeLocale(locale);
      storeLocaleMode(LOCALE_MODE.MANUAL);
      localeMode = LOCALE_MODE.MANUAL;
    }
    syncDocumentLanguage(locale);
    syncLocaleSelect();
    applyTranslations(global.document);
    if (global.document) {
      global.document.dispatchEvent(new CustomEvent('project-map:locale-changed', {
        detail: {locale},
        bubbles: true
      }));
    }
  }

  function syncDocumentLanguage(nextLocale) {
    if (!global.document || !global.document.documentElement) {
      return;
    }
    global.document.documentElement.lang = nextLocale === 'zh-Hant' ? 'zh-Hant' : 'en';
  }

  function syncLocaleSelect(nextLocale) {
    if (!global.document) {
      return;
    }
    const select = global.document.getElementById('locale-select');
    if (!select) {
      return;
    }
    const targetLocale = localeMode === LOCALE_MODE.AUTO ? LOCALE_MODE.AUTO : (nextLocale || locale);
    if (select.value !== targetLocale) {
      select.value = targetLocale;
    }
  }

  function getLocale() {
    return locale;
  }

  function applyTranslations(root) {
    const scope = root || global.document;
    if (!scope || typeof scope.querySelectorAll !== 'function') {
      return;
    }
    scope.querySelectorAll('[data-i18n]').forEach((element) => {
      if (!element.dataset.i18nDefault) {
        element.dataset.i18nDefault = element.textContent;
      }
      element.textContent = t(element.dataset.i18n, element.dataset.i18nDefault);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      if (!element.dataset.i18nPlaceholderDefault) {
        element.dataset.i18nPlaceholderDefault = element.getAttribute('placeholder') || '';
      }
      element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder, element.dataset.i18nPlaceholderDefault));
    });
    scope.querySelectorAll('[data-i18n-value]').forEach((element) => {
      if (!element.dataset.i18nValueDefault) {
        element.dataset.i18nValueDefault = element.value || '';
        element.dataset.i18nValueLast = element.value || '';
      }
      const translated = t(element.dataset.i18nValue, element.dataset.i18nValueDefault);
      const currentValue = element.value || '';
      if (currentValue === element.dataset.i18nValueLast || currentValue === element.dataset.i18nValueDefault) {
        element.value = translated;
        element.dataset.i18nValueLast = translated;
      }
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((element) => {
      if (!element.dataset.i18nTitleDefault) {
        element.dataset.i18nTitleDefault = element.getAttribute('title') || '';
      }
      element.setAttribute('title', t(element.dataset.i18nTitle, element.dataset.i18nTitleDefault));
    });
    scope.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
      if (!element.dataset.i18nAriaLabelDefault) {
        element.dataset.i18nAriaLabelDefault = element.getAttribute('aria-label') || '';
      }
      element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel, element.dataset.i18nAriaLabelDefault));
    });
  }

  function onReady(callback) {
    if (!global.document) {
      return;
    }
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  onReady(() => {
    const select = global.document.getElementById('locale-select');
    if (select) {
      syncLocaleSelect(locale);
      select.addEventListener('change', () => setLocale(select.value));
    }
    syncDocumentLanguage(locale);
    applyTranslations(global.document);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node && node.nodeType === 1) {
            applyTranslations(node);
          }
        });
      });
    });
    observer.observe(global.document.body, {childList: true, subtree: true});
  });

  global.ProjectMapI18n = {
    t,
    setLocale,
    getLocale,
    applyTranslations
  };
})(typeof window !== 'undefined' ? window : globalThis);
