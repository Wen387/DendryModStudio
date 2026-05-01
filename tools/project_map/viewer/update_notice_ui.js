(function initProjectMapUpdateNotice(global) {
  'use strict';

  const DISMISSED_KEY = 'dendry-mod-studio-update-notice-dismissed';

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function canCheckUpdates(env) {
    const value = env || global || {};
    return Boolean(value.dendryDesktop && typeof value.dendryDesktop.checkUpdateNotice === 'function');
  }

  function noticeKey(notice) {
    return String(notice && (notice.noticeId || notice.latestVersion || notice.title) || '');
  }

  function currentLocale() {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.getLocale === 'function' ? i18n.getLocale() : 'en';
  }

  function localizedNoticeField(notice, field, fallback) {
    const localized = notice && notice[field + 'Localized'];
    const locale = currentLocale();
    if (localized && typeof localized === 'object') {
      if (typeof localized[locale] === 'string' && localized[locale]) {
        return localized[locale];
      }
      const baseLocale = String(locale).split('-')[0];
      if (typeof localized[baseLocale] === 'string' && localized[baseLocale]) {
        return localized[baseLocale];
      }
      if (typeof localized.en === 'string' && localized.en) {
        return localized.en;
      }
    }
    return notice && notice[field] ? notice[field] : fallback;
  }

  function localizedFailureMessage(message) {
    const text = String(message || '').trim();
    const httpMatch = text.match(/HTTP\s+([0-9]+)/i);
    if (httpMatch) {
      return t('updateNotice.failedHttp', 'Update notice request returned HTTP {status}').replace('{status}', httpMatch[1]);
    }
    return text || t('updateNotice.failedBody', 'The update notice manifest could not be reached.');
  }

  function createController(options) {
    const opts = options || {};
    const storage = opts.storage || safeStorage();
    return {
      canCheckUpdates,
      noticeKey,
      isDismissed,
      dismiss
    };

    function isDismissed(notice) {
      const key = noticeKey(notice);
      if (!key || !storage || typeof storage.getItem !== 'function') {
        return false;
      }
      try {
        return storage.getItem(DISMISSED_KEY) === key;
      } catch (_err) {
        return false;
      }
    }

    function dismiss(notice) {
      const key = noticeKey(notice);
      if (!key || !storage || typeof storage.setItem !== 'function') {
        return false;
      }
      try {
        storage.setItem(DISMISSED_KEY, key);
        return true;
      } catch (_err) {
        return false;
      }
    }
  }

  function safeStorage() {
    try {
      return global && global.localStorage ? global.localStorage : null;
    } catch (_err) {
      return null;
    }
  }

  const state = {
    controller: createController({storage: safeStorage()}),
    elements: null,
    currentNotice: null
  };

  const api = {
    createController,
    canCheckUpdates,
    noticeKey,
    checkNow: () => checkForNotice(true)
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapUpdateNotice = api;
  }
  if (!global || !global.document) {
    return;
  }

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
      banner: document.getElementById('update-notice-banner'),
      checkButton: document.getElementById('studio-check-updates'),
      kicker: document.getElementById('update-notice-kicker'),
      title: document.getElementById('update-notice-title'),
      body: document.getElementById('update-notice-body'),
      download: document.getElementById('update-notice-download'),
      releaseNotes: document.getElementById('update-notice-release-notes'),
      later: document.getElementById('update-notice-later'),
      dismiss: document.getElementById('update-notice-dismiss')
    };
    if (!state.elements.banner) {
      return;
    }
    if (!canCheckUpdates(global)) {
      return;
    }
    if (state.elements.checkButton) {
      state.elements.checkButton.classList.remove('hidden');
      state.elements.checkButton.addEventListener('click', () => checkForNotice(true));
    }
    if (state.elements.later) {
      state.elements.later.addEventListener('click', hideBanner);
    }
    if (state.elements.dismiss) {
      state.elements.dismiss.addEventListener('click', () => {
        if (state.currentNotice) {
          state.controller.dismiss(state.currentNotice);
        }
        hideBanner();
      });
    }
    if (state.elements.download) {
      state.elements.download.addEventListener('click', () => openNoticeUrl(state.currentNotice && state.currentNotice.downloadUrl));
    }
    if (state.elements.releaseNotes) {
      state.elements.releaseNotes.addEventListener('click', () => openNoticeUrl(state.currentNotice && state.currentNotice.releaseNotesUrl));
    }
    document.addEventListener('project-map:locale-changed', () => {
      if (state.currentNotice && state.elements && !state.elements.banner.classList.contains('hidden')) {
        renderCurrentNotice();
      }
    });
    checkForNotice(false);
  }

  function checkForNotice(manual) {
    if (!canCheckUpdates(global)) {
      return Promise.resolve(null);
    }
    if (state.elements && state.elements.checkButton) {
      state.elements.checkButton.disabled = true;
      state.elements.checkButton.textContent = t('updateNotice.checking', 'Checking...');
    }
    return global.dendryDesktop.checkUpdateNotice({timeoutMs: manual ? 6000 : 3500}).then((notice) => {
      if (!notice || !notice.configured) {
        if (manual) {
          showNotice({
            ok: true,
            severity: 'info',
            title: t('updateNotice.notConfiguredTitle', 'Update notices are not configured'),
            body: t('updateNotice.notConfiguredBody', 'This build has no update manifest URL configured.'),
            noticeId: 'not-configured',
            shouldNotify: true
          }, true);
        }
        return notice;
      }
      if (!notice.ok) {
        if (manual) {
          showNotice({
            ok: false,
            severity: 'warning',
            title: t('updateNotice.failedTitle', 'Could not check for updates'),
            body: localizedFailureMessage(notice.message),
            noticeId: 'check-failed-' + Date.now(),
            shouldNotify: true
          }, true);
        }
        return notice;
      }
      if (!notice.shouldNotify) {
        if (manual) {
          showNotice({
            ok: true,
            severity: 'info',
            title: t('updateNotice.currentTitle', 'No update notice right now'),
            body: t('updateNotice.currentBody', 'This build did not receive an update or announcement notice.'),
            noticeId: 'current-' + (notice.currentVersion || ''),
            shouldNotify: true
          }, true);
        }
        return notice;
      }
      if (!manual && state.controller.isDismissed(notice)) {
        return notice;
      }
      showNotice(notice, manual);
      return notice;
    }).catch((err) => {
      if (manual) {
        showNotice({
          ok: false,
          severity: 'warning',
          title: t('updateNotice.failedTitle', 'Could not check for updates'),
          body: localizedFailureMessage(err && err.message),
          noticeId: 'check-failed-' + Date.now(),
          shouldNotify: true
        }, true);
      }
      return null;
    }).finally(() => {
      if (state.elements && state.elements.checkButton) {
        state.elements.checkButton.disabled = false;
        state.elements.checkButton.textContent = t('topbar.checkUpdates', 'Check for Updates');
      }
    });
  }

  function showNotice(notice) {
    if (!state.elements || !state.elements.banner) {
      return;
    }
    state.currentNotice = notice;
    renderCurrentNotice();
  }

  function renderCurrentNotice() {
    const notice = state.currentNotice || {};
    state.elements.banner.classList.remove('hidden', 'is-info', 'is-warning', 'is-critical');
    state.elements.banner.classList.add('is-' + (notice.severity || 'info'));
    state.elements.kicker.textContent = notice.updateAvailable
      ? t('updateNotice.updateAvailable', 'Update available')
      : t('updateNotice.kicker', 'Update notice');
    state.elements.title.textContent = localizedNoticeField(notice, 'title', t('updateNotice.titleFallback', 'Dendry Mod Studio notice'));
    state.elements.body.textContent = localizedNoticeField(notice, 'body', '');
    setActionVisibility(state.elements.download, notice.downloadUrl);
    setActionVisibility(state.elements.releaseNotes, notice.releaseNotesUrl);
  }

  function setActionVisibility(element, url) {
    if (!element) {
      return;
    }
    element.classList.toggle('hidden', !url);
  }

  function hideBanner() {
    if (state.elements && state.elements.banner) {
      state.elements.banner.classList.add('hidden');
    }
  }

  function openNoticeUrl(url) {
    const target = String(url || '').trim();
    if (!target) {
      return;
    }
    const desktop = global.dendryDesktop;
    if (desktop && typeof desktop.openExternalUrl === 'function') {
      desktop.openExternalUrl({url: target});
      return;
    }
    if (typeof global.open === 'function') {
      global.open(target, '_blank', 'noopener');
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
