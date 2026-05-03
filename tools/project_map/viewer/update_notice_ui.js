(function initProjectMapUpdateNotice(global) {
  'use strict';

  const DISMISSED_KEY = 'dendry-mod-studio-update-notice-dismissed';
  const MAX_BOARD_NOTICES = 40;
  const BOARD_CATEGORIES = ['updates', 'announcements', 'testing'];

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

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
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
      dismissedKeys,
      isDismissed,
      dismiss,
      dismissAll,
      unreadCount
    };

    function dismissedKeys() {
      if (!storage || typeof storage.getItem !== 'function') {
        return new Set();
      }
      try {
        const raw = String(storage.getItem(DISMISSED_KEY) || '').trim();
        if (!raw) {
          return new Set();
        }
        if (raw.startsWith('[')) {
          return new Set(JSON.parse(raw).map(String).filter(Boolean));
        }
        return new Set([raw]);
      } catch (_err) {
        return new Set();
      }
    }

    function storeDismissedKeys(keys) {
      if (!storage || typeof storage.setItem !== 'function') {
        return false;
      }
      try {
        storage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(keys).slice(-200)));
        return true;
      } catch (_err) {
        return false;
      }
    }

    function isDismissed(notice) {
      const key = noticeKey(notice);
      if (!key) {
        return false;
      }
      return dismissedKeys().has(key);
    }

    function dismiss(notice) {
      const key = noticeKey(notice);
      if (!key) {
        return false;
      }
      const keys = dismissedKeys();
      keys.add(key);
      return storeDismissedKeys(keys);
    }

    function dismissAll(notices) {
      const keys = dismissedKeys();
      ensureArray(notices).forEach((notice) => {
        const key = noticeKey(notice);
        if (key) {
          keys.add(key);
        }
      });
      return storeDismissedKeys(keys);
    }

    function unreadCount(notices) {
      return ensureArray(notices).filter((notice) => notice && notice.shouldNotify && !isDismissed(notice)).length;
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
    currentNotice: null,
    lastResult: null,
    boardOpen: false,
    activeCategory: 'updates',
    categoryTouched: false
  };

  const api = {
    createController,
    canCheckUpdates,
    noticeKey,
    checkNow: () => checkForNotice(true),
    openBoard: () => openBoard()
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
      openBoard: document.getElementById('studio-open-announcements'),
      boardBadge: document.getElementById('announcement-board-badge'),
      kicker: document.getElementById('update-notice-kicker'),
      title: document.getElementById('update-notice-title'),
      body: document.getElementById('update-notice-body'),
      download: document.getElementById('update-notice-download'),
      releaseNotes: document.getElementById('update-notice-release-notes'),
      bannerBoard: document.getElementById('update-notice-open-board'),
      later: document.getElementById('update-notice-later'),
      dismiss: document.getElementById('update-notice-dismiss'),
      board: document.getElementById('announcement-board'),
      boardClose: document.getElementById('announcement-board-close'),
      boardTitle: document.getElementById('announcement-board-title'),
      boardSummary: document.getElementById('announcement-board-summary'),
      boardTabs: document.getElementById('announcement-board-tabs'),
      boardList: document.getElementById('announcement-board-list'),
      boardRefresh: document.getElementById('announcement-board-refresh'),
      boardMarkRead: document.getElementById('announcement-board-mark-read')
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
    if (state.elements.openBoard) {
      state.elements.openBoard.classList.remove('hidden');
      state.elements.openBoard.addEventListener('click', () => openBoard());
    }
    if (state.elements.bannerBoard) {
      state.elements.bannerBoard.addEventListener('click', () => openBoard());
    }
    if (state.elements.boardClose) {
      state.elements.boardClose.addEventListener('click', closeBoard);
    }
    if (state.elements.board) {
      state.elements.board.addEventListener('click', (event) => {
        if (event.target === state.elements.board) {
          closeBoard();
        }
      });
    }
    if (state.elements.boardRefresh) {
      state.elements.boardRefresh.addEventListener('click', () => checkForNotice(true, {openBoard: true}));
    }
    if (state.elements.boardTabs) {
      state.elements.boardTabs.addEventListener('click', handleBoardTabClick);
    }
    if (state.elements.boardMarkRead) {
      state.elements.boardMarkRead.addEventListener('click', () => {
        state.controller.dismissAll(noticesForBoard());
        hideBanner();
        renderBoard();
      });
    }
    if (state.elements.boardList) {
      state.elements.boardList.addEventListener('click', handleBoardListClick);
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
        renderBoard();
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
      renderBoard();
    });
    checkForNotice(false);
  }

  function checkForNotice(manual, options) {
    const opts = options || {};
    if (!canCheckUpdates(global)) {
      return Promise.resolve(null);
    }
    if (state.elements && state.elements.checkButton) {
      state.elements.checkButton.disabled = true;
      state.elements.checkButton.textContent = t('updateNotice.checking', 'Checking...');
    }
    if (state.elements && state.elements.boardRefresh) {
      state.elements.boardRefresh.disabled = true;
    }
    return global.dendryDesktop.checkUpdateNotice({timeoutMs: manual ? 6000 : 3500}).then((notice) => {
      state.lastResult = notice || null;
      renderBoard();
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
        if (opts.openBoard) {
          openBoard();
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
        if (opts.openBoard) {
          openBoard();
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
        if (opts.openBoard) {
          openBoard();
        }
        return notice;
      }
      const bannerNotice = firstUnreadNotice(notice);
      if (!manual && !bannerNotice) {
        return notice;
      }
      showNotice(bannerNotice || notice, manual);
      if (opts.openBoard) {
        openBoard();
      }
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
        state.elements.checkButton.textContent = t('topbar.checkUpdates', 'Check Notices');
      }
      if (state.elements && state.elements.boardRefresh) {
        state.elements.boardRefresh.disabled = false;
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

  function firstUnreadNotice(result) {
    return noticesFromResult(result)
      .filter((notice) => notice && notice.shouldNotify)
      .find((notice) => !state.controller.isDismissed(notice)) || null;
  }

  function noticesFromResult(result) {
    if (!result) {
      return [];
    }
    if (Array.isArray(result.notices)) {
      return result.notices.slice(0, MAX_BOARD_NOTICES);
    }
    return result.noticeId || result.title ? [result] : [];
  }

  function noticesForBoard() {
    return noticesFromResult(state.lastResult);
  }

  function openBoard() {
    if (!state.elements || !state.elements.board) {
      return;
    }
    state.boardOpen = true;
    state.elements.board.classList.remove('hidden');
    renderBoard();
    if (!state.lastResult) {
      checkForNotice(true, {openBoard: true});
    }
  }

  function closeBoard() {
    state.boardOpen = false;
    if (state.elements && state.elements.board) {
      state.elements.board.classList.add('hidden');
    }
  }

  function renderBoard() {
    if (!state.elements) {
      return;
    }
    const notices = noticesForBoard();
    ensureActiveCategory(notices);
    const unread = state.controller.unreadCount(notices);
    renderBoardTabs(notices);
    if (state.elements.boardBadge) {
      state.elements.boardBadge.textContent = unread ? String(unread) : '';
      state.elements.boardBadge.classList.toggle('hidden', unread === 0);
    }
    if (state.elements.boardSummary) {
      const summary = notices.length
        ? t('announcementBoard.summary', '{unread} unread / {total} total')
          .replace('{unread}', String(unread))
          .replace('{total}', String(notices.length))
        : t('announcementBoard.emptySummary', 'No notices loaded yet.');
      state.elements.boardSummary.textContent = summary;
    }
    if (state.elements.boardMarkRead) {
      state.elements.boardMarkRead.disabled = unread === 0;
    }
    if (!state.elements.boardList) {
      return;
    }
    if (!state.lastResult) {
      state.elements.boardList.innerHTML = '<div class="announcement-board-empty">' +
        escapeHtml(t('announcementBoard.notLoaded', 'Open the preview or check notices to load the current feed.')) +
        '</div>';
      return;
    }
    if (!state.lastResult.configured) {
      state.elements.boardList.innerHTML = '<div class="announcement-board-empty">' +
        escapeHtml(t('updateNotice.notConfiguredBody', 'This build has no update manifest URL configured.')) +
        '</div>';
      return;
    }
    if (!state.lastResult.ok) {
      state.elements.boardList.innerHTML = '<div class="announcement-board-empty warning">' +
        escapeHtml(localizedFailureMessage(state.lastResult.message)) +
        '</div>';
      return;
    }
    if (!notices.length) {
      state.elements.boardList.innerHTML = '<div class="announcement-board-empty">' +
        escapeHtml(t('announcementBoard.empty', 'No notices in the current feed.')) +
        '</div>';
      return;
    }
    const filtered = notices.filter((notice) => categoryForNotice(notice) === state.activeCategory);
    if (!filtered.length) {
      state.elements.boardList.innerHTML = '<div class="announcement-board-empty">' +
        escapeHtml(t('announcementBoard.emptyCategory', 'No notices in {category}.')
          .replace('{category}', categoryLabel(state.activeCategory))) +
        '</div>';
      return;
    }
    state.elements.boardList.innerHTML = filtered.map(renderBoardNotice).join('');
  }

  function handleBoardTabClick(event) {
    const button = event.target.closest && event.target.closest('[data-announcement-category]');
    if (!button) {
      return;
    }
    const category = button.getAttribute('data-announcement-category');
    if (BOARD_CATEGORIES.indexOf(category) === -1) {
      return;
    }
    state.activeCategory = category;
    state.categoryTouched = true;
    renderBoard();
  }

  function ensureActiveCategory(notices) {
    if (BOARD_CATEGORIES.indexOf(state.activeCategory) === -1) {
      state.activeCategory = 'updates';
    }
    if (state.categoryTouched || !notices.length) {
      return;
    }
    if (notices.some((notice) => categoryForNotice(notice) === state.activeCategory)) {
      return;
    }
    const available = BOARD_CATEGORIES.find((category) => notices.some((notice) => categoryForNotice(notice) === category));
    state.activeCategory = available || 'updates';
  }

  function renderBoardTabs(notices) {
    if (!state.elements.boardTabs) {
      return;
    }
    const counts = BOARD_CATEGORIES.reduce((accumulator, category) => {
      accumulator[category] = notices.filter((notice) => categoryForNotice(notice) === category).length;
      return accumulator;
    }, {});
    BOARD_CATEGORIES.forEach((category) => {
      const button = state.elements.boardTabs.querySelector('[data-announcement-category="' + category + '"]');
      if (!button) {
        return;
      }
      const active = category === state.activeCategory;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      const count = button.querySelector('[data-announcement-category-count]');
      if (count) {
        count.textContent = String(counts[category] || 0);
      }
    });
  }

  function categoryForNotice(notice) {
    const kind = String(notice && notice.kind || 'announcement');
    if (kind === 'update' || kind === 'release' || (notice && notice.updateAvailable)) {
      return 'updates';
    }
    if (kind === 'playtest' || kind === 'contact') {
      return 'testing';
    }
    return 'announcements';
  }

  function categoryLabel(category) {
    if (category === 'updates') {
      return t('announcementBoard.category.updates', 'Updates & History');
    }
    if (category === 'testing') {
      return t('announcementBoard.category.testing', 'Testing & Contact');
    }
    return t('announcementBoard.category.announcements', 'Announcements');
  }

  function renderBoardNotice(notice) {
    const read = state.controller.isDismissed(notice);
    const key = noticeKey(notice);
    const actions = boardNoticeActions(notice, key);
    return [
      '<article class="announcement-card ' + (read ? 'is-read' : 'is-unread') + ' is-' + escapeHtml(notice.severity || 'info') + '">',
      '<div class="announcement-card-main">',
      '<div class="announcement-card-meta">',
      '<span>' + escapeHtml(kindLabel(notice)) + '</span>',
      notice.publishedAt ? '<time>' + escapeHtml(notice.publishedAt) + '</time>' : '',
      read ? '<span>' + escapeHtml(t('announcementBoard.read', 'Read')) + '</span>' : '<strong>' + escapeHtml(t('announcementBoard.unread', 'Unread')) + '</strong>',
      '</div>',
      '<h3>' + escapeHtml(localizedNoticeField(notice, 'title', t('updateNotice.titleFallback', 'Dendry Mod Studio notice'))) + '</h3>',
      '<p>' + escapeHtml(localizedNoticeField(notice, 'body', '')) + '</p>',
      '</div>',
      '<div class="announcement-card-actions">',
      actions,
      read ? '' : '<button type="button" data-announcement-read="' + escapeAttr(key) + '">' + escapeHtml(t('announcementBoard.markRead', 'Mark read')) + '</button>',
      '</div>',
      '</article>'
    ].join('');
  }

  function boardNoticeActions(notice, key) {
    const actions = [];
    if (notice.downloadUrl) {
      actions.push('<button class="primary-action" type="button" data-announcement-url="' + escapeAttr(notice.downloadUrl) + '">' + escapeHtml(t('updateNotice.download', 'Download update')) + '</button>');
    }
    if (notice.releaseNotesUrl) {
      actions.push('<button type="button" data-announcement-url="' + escapeAttr(notice.releaseNotesUrl) + '">' + escapeHtml(t('updateNotice.releaseNotes', 'Release notes')) + '</button>');
    }
    if (notice.actionUrl) {
      actions.push('<button type="button" data-announcement-url="' + escapeAttr(notice.actionUrl) + '">' + escapeHtml(localizedNoticeField(notice, 'actionLabel', t('announcementBoard.openLink', 'Open link'))) + '</button>');
    }
    if (!actions.length && key) {
      actions.push('<span class="announcement-card-no-action">' + escapeHtml(t('announcementBoard.noAction', 'No action needed')) + '</span>');
    }
    return actions.join('');
  }

  function handleBoardListClick(event) {
    const readButton = event.target.closest && event.target.closest('[data-announcement-read]');
    if (readButton) {
      const key = readButton.getAttribute('data-announcement-read');
      const notice = noticesForBoard().find((item) => noticeKey(item) === key);
      if (notice) {
        state.controller.dismiss(notice);
        if (state.currentNotice && noticeKey(state.currentNotice) === key) {
          hideBanner();
        }
        renderBoard();
      }
      return;
    }
    const linkButton = event.target.closest && event.target.closest('[data-announcement-url]');
    if (linkButton) {
      openNoticeUrl(linkButton.getAttribute('data-announcement-url'));
    }
  }

  function renderCurrentNotice() {
    const notice = state.currentNotice || {};
    state.elements.banner.classList.remove('hidden', 'is-info', 'is-warning', 'is-critical');
    state.elements.banner.classList.add('is-' + (notice.severity || 'info'));
    state.elements.kicker.textContent = notice.updateAvailable
      ? t('updateNotice.updateAvailable', 'Update available')
      : kindLabel(notice);
    state.elements.title.textContent = localizedNoticeField(notice, 'title', t('updateNotice.titleFallback', 'Dendry Mod Studio notice'));
    state.elements.body.textContent = localizedNoticeField(notice, 'body', '');
    setActionVisibility(state.elements.download, notice.downloadUrl);
    setActionVisibility(state.elements.releaseNotes, notice.releaseNotesUrl);
  }

  function kindLabel(notice) {
    const kind = String(notice && notice.kind || 'announcement');
    if (kind === 'update' || notice && notice.updateAvailable) {
      return t('updateNotice.updateAvailable', 'Update available');
    }
    if (kind === 'release') {
      return t('announcementBoard.kind.release', 'Release');
    }
    if (kind === 'playtest') {
      return t('announcementBoard.kind.playtest', 'Playtest');
    }
    if (kind === 'contact') {
      return t('announcementBoard.kind.contact', 'Contact');
    }
    if (kind === 'tip') {
      return t('announcementBoard.kind.tip', 'Tip');
    }
    return t('announcementBoard.kind.announcement', 'Announcement');
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

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})(typeof window !== 'undefined' ? window : globalThis);
