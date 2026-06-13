(function initProjectMapOpeningSplash(global) {
  'use strict';

  // Version-ceremony opening splash — the app's title card.
  //
  // A warm-ink veil rises over the shell; the brand mark and wordmark surface
  // through a rust glow, then a small "v<version> · by <author>" line, and the
  // veil lifts to reveal the app. It plays exactly once per app version:
  //   - first launch after an update (stored version != bundled latest) → play;
  //   - a truly fresh install → play, and the guided tour greets right after
  //     (guided_tour_ui defers its first-run greeting until our done event);
  //   - reduced motion → never plays, but the version is still stamped;
  //   - a click or Escape skips it instantly.
  // The bundled What's New version is the single source of truth, so this
  // ceremony and the release band always agree on what "a new version" means.

  const TOTAL_MS = 3400;
  const LEAVE_MS = 420;

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

  function seenVersionKey() {
    const api = constants();
    return api && api.STORAGE_KEYS && api.STORAGE_KEYS.splashSeenVersion
      ? api.STORAGE_KEYS.splashSeenVersion
      : 'dendry-mod-studio-splash-seen-version';
  }

  function doneEventName() {
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

  function prefersReducedMotion() {
    return !!(global.matchMedia &&
      global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Pure decision (Node-testable): play only when there IS a version and the
  // stored stamp differs — a fresh install (empty stamp) counts as new.
  function shouldPlay(storedVersion, version, reducedMotion) {
    if (!version || reducedMotion) {
      return false;
    }
    return String(storedVersion || '') !== String(version);
  }

  function currentVersion() {
    const data = global && global.ProjectMapWhatsNewData;
    return data && typeof data.latest === 'function' ? (data.latest() || '') : '';
  }

  function readSeenVersion() {
    const storage = safeStorage();
    if (!storage || typeof storage.getItem !== 'function') {
      return '';
    }
    try {
      return storage.getItem(seenVersionKey()) || '';
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
      storage.setItem(seenVersionKey(), version);
    } catch (_err) {
      // best effort only
    }
  }

  const state = {
    el: null,
    active: false,
    finishTimer: 0,
    removeTimer: 0,
    keyHandler: null
  };

  function buildMarkup(document, version) {
    const el = document.createElement('div');
    el.className = 'opening-splash';
    el.setAttribute('aria-hidden', 'true');
    const glow = '<span class="opening-splash-glow opening-splash-glow-1"></span>' +
      '<span class="opening-splash-glow opening-splash-glow-2"></span>' +
      '<span class="opening-splash-glow opening-splash-glow-3"></span>';
    // Reuse the topbar's actual brand mark (the branch SVG) so the splash and
    // the shell share one identity; degrade to wordmark-only if it is absent.
    const brand = document.querySelector('.brand-mark svg');
    const mark = brand
      ? '<span class="opening-splash-mark">' + brand.outerHTML + '</span>'
      : '';
    const word = '<span class="opening-splash-word">Dendry <span>Mod Studio</span></span>';
    // Version + author in one quiet line; the author string is the same
    // topbar.author the shell header shows.
    const meta = '<span class="opening-splash-meta">v' + String(version) +
      ' · ' + t('topbar.author', 'by Awen') + '</span>';
    el.innerHTML = glow + mark + word + meta;
    return el;
  }

  function finish() {
    if (!state.active || !state.el) {
      return;
    }
    state.active = false;
    if (state.finishTimer) {
      global.clearTimeout(state.finishTimer);
      state.finishTimer = 0;
    }
    if (state.keyHandler) {
      global.document.removeEventListener('keydown', state.keyHandler);
      state.keyHandler = null;
    }
    state.el.classList.add('is-leaving');
    state.removeTimer = global.setTimeout(function () {
      if (state.el && state.el.parentNode) {
        state.el.parentNode.removeChild(state.el);
      }
      state.el = null;
      try {
        global.document.dispatchEvent(new global.Event(doneEventName()));
      } catch (_err) {
        // best effort only
      }
    }, LEAVE_MS);
  }

  function play(version) {
    if (!global || !global.document || !global.document.body || state.active) {
      return false;
    }
    state.el = buildMarkup(global.document, version);
    state.active = true;
    global.document.body.appendChild(state.el);
    state.el.addEventListener('click', finish);
    state.keyHandler = function (event) {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        finish();
      }
    };
    global.document.addEventListener('keydown', state.keyHandler);
    state.finishTimer = global.setTimeout(finish, TOTAL_MS);
    return true;
  }

  // Boot: decide, stamp, play. Stamping happens up front so a skipped or
  // interrupted ceremony still counts as seen — it never nags twice.
  function maybePlayOnBoot() {
    const version = currentVersion();
    if (!shouldPlay(readSeenVersion(), version, prefersReducedMotion())) {
      stampSeenVersion(version);
      return false;
    }
    stampSeenVersion(version);
    return play(version);
  }

  const api = {
    isActive: () => state.active,
    play,
    _model: {shouldPlay}
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapOpeningSplash = api;
  }
  if (!global || !global.document) {
    return;
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', maybePlayOnBoot);
  } else {
    maybePlayOnBoot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
