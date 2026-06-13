(function initProjectMapHomeRecentProjects(global) {
  'use strict';

  // Recently opened desktop projects, with one-click reopen from Home.
  //
  // Recording: the preload dispatches ProjectMap:desktop-index-loaded with the
  // scanned folder's `root` and `projectName` after EVERY successful load
  // (picker, demo, catalog, rescan, or our own reopen) — that single event is
  // the whole bookkeeping seam. Browser-mode loads have no folder root and are
  // deliberately not recorded: without a desktop bridge a path could never be
  // reopened, so a card would only be a dead end.
  //
  // Reopening: dendryDesktop.scanProject({root}) drives the exact pipeline the
  // folder picker uses (progress events, index apply, shell update), so this
  // module never touches the load path itself.

  const LIMIT = 5;

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

  function storageKey() {
    const api = constants();
    return api && api.STORAGE_KEYS && api.STORAGE_KEYS.recentProjects
      ? api.STORAGE_KEYS.recentProjects
      : 'dendry-mod-studio-recent-projects';
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

  // ---- Pure list model (Node-testable; no DOM, no storage) ----

  // Insert-or-refresh an entry, newest first, deduped by root, capped.
  function upsert(list, entry, limit) {
    const max = limit || LIMIT;
    const root = entry && entry.root ? String(entry.root) : '';
    if (!root) {
      return Array.isArray(list) ? list.slice(0, max) : [];
    }
    const cleaned = (Array.isArray(list) ? list : []).filter(function (item) {
      return item && item.root && item.root !== root;
    });
    cleaned.unshift({
      root,
      name: entry.name ? String(entry.name) : root.split(/[\\/]/).pop(),
      openedAt: Number(entry.openedAt) || 0
    });
    return cleaned.slice(0, max);
  }

  function removeFromList(list, root) {
    return (Array.isArray(list) ? list : []).filter(function (item) {
      return item && item.root && item.root !== String(root);
    });
  }

  // ---- Persistence ----

  function readList() {
    const storage = safeStorage();
    if (!storage || typeof storage.getItem !== 'function') {
      return [];
    }
    try {
      const parsed = JSON.parse(storage.getItem(storageKey()) || '[]');
      return Array.isArray(parsed)
        ? parsed.filter(function (item) { return item && item.root; })
        : [];
    } catch (_err) {
      return [];
    }
  }

  function writeList(list) {
    const storage = safeStorage();
    if (!storage || typeof storage.setItem !== 'function') {
      return;
    }
    try {
      storage.setItem(storageKey(), JSON.stringify(list));
    } catch (_err) {
      // best effort only
    }
  }

  // ---- Controller ----

  const state = {
    hosts: [],
    currentRoot: '',
    busy: false,
    failedRoot: ''
  };

  function desktopBridge() {
    return global && global.dendryDesktop && global.dendryDesktop.isDesktop
      ? global.dendryDesktop
      : null;
  }

  function record(detail) {
    const root = detail && detail.root ? String(detail.root) : '';
    if (!root) {
      return;
    }
    state.currentRoot = root;
    state.failedRoot = '';
    writeList(upsert(readList(), {
      root,
      name: detail.projectName || '',
      openedAt: Date.now()
    }));
    renderHosts();
  }

  function remove(root) {
    writeList(removeFromList(readList(), root));
    if (state.failedRoot === root) {
      state.failedRoot = '';
    }
    renderHosts();
  }

  // Drive the shared desktop progress overlay by re-emitting the exact event
  // the preload dispatches during a scan, so app.js's existing listener shows,
  // animates, and clears it with no new wiring. The folder picker pre-shows the
  // overlay synchronously before its scan (app.js openDesktopProject); a reopen
  // calls scanProject directly, so without this the overlay only reacts to late
  // backend events and the rebuild looks frozen with no "why is this slow" cue.
  function signalScanProgress(detail) {
    if (!global || typeof global.dispatchEvent !== 'function' || typeof global.CustomEvent !== 'function') {
      return;
    }
    try {
      global.dispatchEvent(new global.CustomEvent('ProjectMap:desktop-scan-progress', {detail}));
    } catch (_err) {
      // best effort only — a missing overlay must never block the reopen.
    }
  }

  // Reopen rides the standard pipeline; success re-records via the loaded
  // event. Failure (folder moved/renamed, scan error) marks the card with an
  // inline hint and leaves the entry so the user can remove it deliberately.
  function reopen(root) {
    const bridge = desktopBridge();
    if (!bridge || typeof bridge.scanProject !== 'function' || state.busy) {
      return;
    }
    state.busy = true;
    state.failedRoot = '';
    renderHosts();
    // Pre-show the overlay from t=0 so the from-scratch rebuild is visible the
    // same way the folder picker makes it visible.
    signalScanProgress({
      stage: 'starting',
      percent: 1,
      label: t('desktop.buildingProjectIndex', 'Building project index...')
    });
    // On failure no index-loaded event fires, so the overlay would hang at the
    // starting frame; emit a terminal error frame instead (app.js fades it).
    const markFailed = function () {
      state.failedRoot = root;
      signalScanProgress({
        stage: 'failed',
        percent: 100,
        label: t('home.recent.openFailed', 'Could not open this folder — it may have moved or been renamed.'),
        error: true
      });
    };
    Promise.resolve(bridge.scanProject({root}))
      .then(function (result) {
        if (!result || result.ok !== true) {
          markFailed();
        }
      })
      .catch(markFailed)
      .then(function () {
        state.busy = false;
        renderHosts();
      });
  }

  // ---- Rendering ----

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Render the block into a host element. Desktop-only and list-aware: in a
  // browser, or with nothing to show beyond the open project, the host stays
  // empty (CSS hides empty hosts). The currently open project is excluded —
  // its card would only reopen what is already on screen.
  function render(host) {
    if (!host) {
      return;
    }
    if (state.hosts.indexOf(host) === -1) {
      state.hosts.push(host);
    }
    if (!desktopBridge()) {
      host.innerHTML = '';
      return;
    }
    const entries = readList().filter(function (item) {
      return item.root !== state.currentRoot;
    });
    if (!entries.length) {
      host.innerHTML = '';
      return;
    }
    const cards = entries.map(function (item) {
      const failed = state.failedRoot === item.root;
      return [
        '<div class="home-recent-card' + (failed ? ' is-failed' : '') + '" data-recent-root="' + escapeHtml(item.root) + '">',
        '<button type="button" class="home-recent-open" data-recent-open="' + escapeHtml(item.root) + '"' +
          (state.busy ? ' disabled' : '') + '>',
        '<span class="home-recent-name">' + escapeHtml(item.name || item.root) + '</span>',
        '<span class="home-recent-path">' + escapeHtml(item.root) + '</span>',
        failed
          ? '<span class="home-recent-error" data-i18n="home.recent.openFailed">Could not open this folder — it may have moved or been renamed.</span>'
          : '',
        '</button>',
        '<button type="button" class="home-recent-remove" data-recent-remove="' + escapeHtml(item.root) + '"' +
          ' aria-label="' + escapeHtml(t('home.recent.remove', 'Remove from list')) + '"' +
          ' title="' + escapeHtml(t('home.recent.remove', 'Remove from list')) + '">✕</button>',
        '</div>'
      ].join('');
    });
    host.innerHTML = [
      '<p class="home-recent-title" data-i18n="home.recent.title">Recent projects</p>',
      '<div class="home-recent-list">' + cards.join('') + '</div>'
    ].join('');
    wire(host);
    const i18n = global && global.ProjectMapI18n;
    if (i18n && typeof i18n.applyTranslations === 'function') {
      i18n.applyTranslations(host);
    }
  }

  function wire(host) {
    host.querySelectorAll('[data-recent-open]').forEach(function (button) {
      button.addEventListener('click', function () {
        reopen(button.getAttribute('data-recent-open'));
      });
    });
    host.querySelectorAll('[data-recent-remove]').forEach(function (button) {
      button.addEventListener('click', function () {
        remove(button.getAttribute('data-recent-remove'));
      });
    });
  }

  function renderHosts() {
    state.hosts = state.hosts.filter(function (host) {
      return host && host.isConnected !== false;
    });
    state.hosts.forEach(function (host) {
      render(host);
    });
  }

  const api = {
    render,
    record,
    remove,
    list: readList,
    _model: {upsert, removeFromList, LIMIT}
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapHomeRecentProjects = api;
  }
  if (!global || !global.document || typeof global.addEventListener !== 'function') {
    return;
  }

  // The single bookkeeping seam: every successful desktop load lands here.
  global.addEventListener('ProjectMap:desktop-index-loaded', function (event) {
    record((event && event.detail) || {});
  });
})(typeof window !== 'undefined' ? window : globalThis);
