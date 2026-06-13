(function initProjectMapWhatsNewPanel(global) {
  'use strict';

  // What's New reading panel — the full release introduction.
  //
  // The Home page keeps only a slim digest (version + feature titles); this
  // overlay is where a release actually gets introduced, magazine-style: one
  // block per feature with an optional screenshot above its title and body.
  // It opens in two ways:
  //   - manually, from the release band / digest "see the full introduction";
  //   - automatically, exactly once, on the first boot after an update —
  //     deferred until the opening splash has lifted so the two ceremonies
  //     play in sequence rather than on top of each other.
  // A truly fresh install never auto-opens (the welcome surface owns that
  // moment); the release band's silent seeding gives fresh installs an empty
  // "unseen" state, which the pure decision below treats as "not an update".
  //
  // Opening stamps the shared last-seen-version key (the same one the release
  // band reads), then announces itself via the whats-new-seen event so the
  // band re-renders into its quiet re-entry link.
  //
  // Load order: this script must come AFTER opening_splash.js in index.html —
  // both boot on DOMContentLoaded, and the auto-open check can only see an
  // active splash if the splash's boot handler ran first.

  function constants() {
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

  function lastSeenVersionKey() {
    const api = constants();
    return api && api.STORAGE_KEYS && api.STORAGE_KEYS.lastSeenVersion
      ? api.STORAGE_KEYS.lastSeenVersion
      : 'dendry-mod-studio-last-seen-version';
  }

  function seenEventName() {
    const api = constants();
    return api && api.EVENT_NAMES && api.EVENT_NAMES.whatsNewSeen
      ? api.EVENT_NAMES.whatsNewSeen
      : 'ProjectMap:whats-new-seen';
  }

  function splashDoneEventName() {
    const api = constants();
    return api && api.EVENT_NAMES && api.EVENT_NAMES.openingSplashDone
      ? api.EVENT_NAMES.openingSplashDone
      : 'ProjectMap:opening-splash-done';
  }

  function safeStorage() {
    try {
      return global && global.localStorage ? global.localStorage : null;
    } catch (_err) {
      return null;
    }
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function localizeAndDecorate(scope) {
    const i18n = global && global.ProjectMapI18n;
    if (i18n && typeof i18n.applyTranslations === 'function') {
      i18n.applyTranslations(scope);
    }
    const icons = global && global.ProjectMapIcons;
    if (icons && typeof icons.decorate === 'function') {
      icons.decorate(scope);
    }
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Pure decision (Node-testable): auto-open is an UPDATE ceremony only. An
  // empty stored stamp means a fresh install (the release band seeds it
  // silently), and the same version means already seen — neither auto-opens.
  function shouldAutoOpen(storedSeen, latest) {
    if (!latest || !storedSeen) {
      return false;
    }
    return String(storedSeen) !== String(latest);
  }

  function whatsNewData() {
    return global && global.ProjectMapWhatsNewData;
  }

  function currentVersion() {
    const data = whatsNewData();
    return data && typeof data.latest === 'function' ? (data.latest() || '') : '';
  }

  function readSeenVersion() {
    const storage = safeStorage();
    if (!storage || typeof storage.getItem !== 'function') {
      return '';
    }
    try {
      return storage.getItem(lastSeenVersionKey()) || '';
    } catch (_err) {
      return '';
    }
  }

  function stampSeenVersion(version) {
    const storage = safeStorage();
    if (!storage || typeof storage.setItem !== 'function' || !version) {
      return;
    }
    try {
      storage.setItem(lastSeenVersionKey(), version);
    } catch (_err) {
      // best effort only
    }
  }

  function announceSeen() {
    try {
      global.document.dispatchEvent(new global.Event(seenEventName()));
    } catch (_err) {
      // best effort only
    }
  }

  const state = {
    el: null,
    open: false,
    keyHandler: null,
    returnFocus: null
  };

  function itemMarkup(item) {
    const icon = item && item.icon ? item.icon : 'spark';
    const titleKey = item && item.titleKey ? item.titleKey : '';
    const bodyKey = item && item.bodyKey ? item.bodyKey : '';
    // The screenshot is optional per item: text-only blocks render without the
    // figure, so the panel works before any image has been authored.
    const figure = item && item.image
      ? '<figure class="whats-new-panel-figure">' +
        '<img src="' + escapeHtml(item.image) + '" alt="' +
        escapeHtml(item.imageAltKey ? t(item.imageAltKey, '') : '') + '" loading="lazy">' +
        '</figure>'
      : '';
    return [
      '<section class="whats-new-panel-item">',
      figure,
      '<div class="whats-new-panel-item-head">',
      '<span class="whats-new-panel-item-icon" data-ui-icon="' + escapeHtml(icon) + '" aria-hidden="true"></span>',
      '<h3 class="whats-new-panel-item-title" data-i18n="' + escapeHtml(titleKey) + '"></h3>',
      '</div>',
      '<p class="whats-new-panel-item-body" data-i18n="' + escapeHtml(bodyKey) + '"></p>',
      '</section>'
    ].join('');
  }

  function buildMarkup(document, release) {
    const el = document.createElement('div');
    el.className = 'whats-new-panel';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', t('home.whatsnew.panel.title', "What's new in this version"));
    const version = release && release.version ? 'v' + release.version : '';
    const items = release && Array.isArray(release.items) ? release.items : [];
    el.innerHTML = [
      '<div class="whats-new-panel-scrim" data-whats-new-panel-close="true"></div>',
      '<article class="whats-new-panel-card">',
      '<header class="whats-new-panel-header">',
      '<div class="whats-new-panel-heading">',
      '<h2 class="whats-new-panel-title" data-i18n="home.whatsnew.panel.title"></h2>',
      version ? '<span class="whats-new-panel-version">' + escapeHtml(version) + '</span>' : '',
      '</div>',
      '<button type="button" class="whats-new-panel-close" data-whats-new-panel-close="true" ' +
      'aria-label="' + escapeHtml(t('home.whatsnew.panel.close', 'Close')) + '">',
      '<span data-ui-icon="close" aria-hidden="true"></span>',
      '</button>',
      '</header>',
      '<div class="whats-new-panel-body">',
      items.map(itemMarkup).join(''),
      '</div>',
      '<footer class="whats-new-panel-footer">',
      '<button type="button" class="primary-action whats-new-panel-done" data-whats-new-panel-close="true" data-i18n="home.whatsnew.panel.done"></button>',
      '</footer>',
      '</article>'
    ].join('');
    return el;
  }

  function close() {
    if (!state.open || !state.el) {
      return;
    }
    state.open = false;
    if (state.keyHandler) {
      global.document.removeEventListener('keydown', state.keyHandler);
      state.keyHandler = null;
    }
    if (state.el.parentNode) {
      state.el.parentNode.removeChild(state.el);
    }
    state.el = null;
    if (state.returnFocus && typeof state.returnFocus.focus === 'function') {
      try {
        state.returnFocus.focus();
      } catch (_err) {
        // best effort only
      }
    }
    state.returnFocus = null;
  }

  function open() {
    if (!global || !global.document || !global.document.body || state.open) {
      return false;
    }
    const data = whatsNewData();
    const release = data && typeof data.latestRelease === 'function' ? data.latestRelease() : null;
    if (!release) {
      return false;
    }
    state.returnFocus = global.document.activeElement;
    state.el = buildMarkup(global.document, release);
    state.open = true;
    global.document.body.appendChild(state.el);
    localizeAndDecorate(state.el);
    state.el.querySelectorAll('[data-whats-new-panel-close]').forEach(function (el) {
      el.addEventListener('click', close);
    });
    state.keyHandler = function (event) {
      if (event.key === 'Escape') {
        close();
      }
    };
    global.document.addEventListener('keydown', state.keyHandler);
    const closeButton = state.el.querySelector('.whats-new-panel-close');
    if (closeButton && typeof closeButton.focus === 'function') {
      closeButton.focus();
    }
    // Opening IS seeing: stamp and announce so the release band flips to its
    // quiet link even if the user closes without scrolling.
    stampSeenVersion(currentVersion());
    announceSeen();
    return true;
  }

  // Boot: the once-per-update auto-open. The decision reads the stored stamp
  // BEFORE open() restamps it; the splash (if it is playing) finishes first so
  // the title card and the reading panel arrive in sequence.
  function maybeAutoOpenOnBoot() {
    if (!shouldAutoOpen(readSeenVersion(), currentVersion())) {
      return;
    }
    const splash = global && global.ProjectMapOpeningSplash;
    if (splash && typeof splash.isActive === 'function' && splash.isActive()) {
      global.document.addEventListener(splashDoneEventName(), function onLift() {
        global.document.removeEventListener(splashDoneEventName(), onLift);
        open();
      });
      return;
    }
    open();
  }

  const api = {
    open,
    close,
    isOpen: () => state.open,
    _model: {shouldAutoOpen}
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapWhatsNewPanel = api;
  }
  if (!global || !global.document) {
    return;
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', maybeAutoOpenOnBoot);
  } else {
    maybeAutoOpenOnBoot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
