(function initProjectMapHomeSectionRegistry(global) {
  'use strict';

  // Home section registry — the decoupling seam between the Home shell
  // (home_ui.js) and the feature controllers. Each entry describes one section
  // and knows how to mount/unmount its own content into a host panel; the shell
  // only routes sub-nav and asks the registry to populate the active panel.
  //
  // Milestone A: every section mounts a small "launcher" card whose button
  // simply triggers the existing surface (the matching More-menu control). Later
  // milestones swap a section's mount() for a real inline embed without the
  // shell or the other sections noticing — the contract stays the same.

  const document = global && global.document;

  // key      — matches data-home-section / data-home-panel in index.html
  // icon      — ProjectMapIcons name for the launcher glyph
  // leadKey   — i18n key for the one-line description
  // ctaKey    — i18n key for the launch button (omitted for note-only sections)
  // targetId  — id of the existing control the launcher delegates to
  // desktopOnly — section depends on the desktop bridge (gated like its menu peer)
  // note      — render an informational card with no launch button
  const SECTIONS = [
    {
      key: 'overview',
      icon: 'map'
    },
    {
      key: 'publish',
      icon: 'save',
      leadKey: 'home.publish.lead',
      ctaKey: 'home.publish.cta',
      targetId: 'studio-open-publish',
      desktopOnly: true
    },
    {
      key: 'announcements',
      icon: 'info',
      leadKey: 'home.announcements.lead',
      ctaKey: 'home.announcements.cta',
      targetId: 'studio-open-announcements',
      desktopOnly: true
    },
    {
      key: 'templates',
      icon: 'book',
      leadKey: 'home.templates.lead',
      ctaKey: 'home.templates.cta',
      targetId: 'studio-open-template-hub',
      desktopOnly: true
    },
    {
      key: 'whatsnew',
      icon: 'spark'
    }
  ];

  function launchTarget(id) {
    if (!id || !document) {
      return;
    }
    const target = document.getElementById(id);
    if (target && typeof target.click === 'function') {
      target.click();
    }
  }

  function buildLauncher(cfg) {
    const card = document.createElement('div');
    card.className = 'home-launch' + (cfg.note ? ' is-note' : '');

    const glyph = document.createElement('span');
    glyph.className = 'home-launch-icon';
    glyph.setAttribute('data-ui-icon', cfg.icon || 'spark');
    glyph.setAttribute('aria-hidden', 'true');
    card.appendChild(glyph);

    const lead = document.createElement('p');
    lead.className = 'home-launch-lead';
    lead.setAttribute('data-i18n', cfg.leadKey);
    card.appendChild(lead);

    if (!cfg.note && cfg.ctaKey) {
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'home-launch-cta';
      cta.setAttribute('data-i18n', cfg.ctaKey);
      cta.addEventListener('click', () => launchTarget(cfg.targetId));
      card.appendChild(cta);
    }

    return card;
  }

  function mountSection(cfg, container) {
    if (!container || !document || container.querySelector('.home-launch')) {
      return;
    }
    container.appendChild(buildLauncher(cfg));
  }

  function unmountSection(container) {
    if (!container) {
      return;
    }
    const card = container.querySelector('.home-launch');
    if (card) {
      card.remove();
    }
  }

  // ---- Resolvers for the overview two-face controller ----

  function constants() {
    return global && global.ProjectMapStudioSharedConstants
      ? global.ProjectMapStudioSharedConstants
      : null;
  }

  function eventName(key, fallback) {
    const api = constants();
    return api && api.EVENT_NAMES && api.EVENT_NAMES[key]
      ? api.EVENT_NAMES[key]
      : fallback;
  }

  function shellNav() {
    return global && global.ProjectMapShellNavigation;
  }

  function welcomeSurface() {
    return global && global.ProjectMapWelcomeSurface;
  }

  function whatsNewData() {
    return global && global.ProjectMapWhatsNewData;
  }

  function updateNotice() {
    return global && global.ProjectMapUpdateNotice;
  }

  function publishUi() {
    return global && global.ProjectMapPublishUi;
  }

  function homeUi() {
    return global && global.ProjectMapHomeUi;
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function safeStorage() {
    try {
      return global && global.localStorage ? global.localStorage : null;
    } catch (_err) {
      return null;
    }
  }

  function lastSeenVersionKey() {
    const api = constants();
    return api && api.STORAGE_KEYS && api.STORAGE_KEYS.lastSeenVersion
      ? api.STORAGE_KEYS.lastSeenVersion
      : 'dendry-mod-studio-last-seen-version';
  }

  function readLastSeenVersion() {
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

  function writeLastSeenVersion(version) {
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

  function whatsNewLatest() {
    const data = whatsNewData();
    return data && typeof data.latest === 'function' ? (data.latest() || '') : '';
  }

  // A fresh install (no stored version) is not an "update" — seed the current
  // version silently so the release band stays quiet until a real version bump,
  // matching the "release welcome after an update" intent. The band only fires
  // for an existing user whose stored version is older than the bundled latest.
  function seedLastSeenIfFresh() {
    const latest = whatsNewLatest();
    if (latest && !readLastSeenVersion()) {
      writeLastSeenVersion(latest);
    }
  }

  function whatsNewUnseen() {
    const latest = whatsNewLatest();
    if (!latest) {
      return false;
    }
    const seen = readLastSeenVersion();
    return !!seen && seen !== latest;
  }

  function markWhatsNewSeen() {
    writeLastSeenVersion(whatsNewLatest());
    renderReleaseBand();
  }

  function openWhatsNew() {
    markWhatsNewSeen();
    const homeUi = global && global.ProjectMapHomeUi;
    if (homeUi && typeof homeUi.setSection === 'function') {
      homeUi.setSection('whatsnew', {persist: true});
    }
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

  // ---- Overview section: two faces ----
  // No project loaded -> onboarding face = the welcome surface docked inline.
  // Project loaded     -> dashboard face = a "welcome back" header + publish /
  //                       announcement launcher cards + a small link back to the
  //                       getting-started guide.
  // The single #studio-welcome node is reparented in/out via dock()/undock();
  // the catalog-only modal borrows it (openDialog auto-undocks), so we re-render
  // (and re-dock if appropriate) whenever the surface is dismissed or the loaded
  // project changes.

  const overview = {panel: null, bound: false};

  function overviewHasProject() {
    const nav = shellNav();
    if (!nav || typeof nav.getState !== 'function') {
      return false;
    }
    const snap = nav.getState() || {};
    return !!(snap.projectModel || snap.projectIndex);
  }

  function mountOverview(container) {
    if (!container || !document) {
      return;
    }
    overview.panel = container;
    // Both faces carry their own heading, so the generic section <h2> the shell
    // builds is redundant here.
    const heading = container.querySelector('h2');
    if (heading) {
      heading.classList.add('hidden');
    }
    // The release band host is appended first so it sits ABOVE the two faces.
    if (!container.querySelector('.home-release-band')) {
      const band = document.createElement('div');
      band.className = 'home-release-band';
      container.appendChild(band);
    }
    if (!container.querySelector('.home-overview')) {
      const host = document.createElement('div');
      host.className = 'home-overview';
      container.appendChild(host);
    }
    seedLastSeenIfFresh();
    bindOverviewEvents();
    renderReleaseBand();
    renderOverview();
  }

  function unmountOverview(container) {
    const welcome = welcomeSurface();
    if (welcome && typeof welcome.isDocked === 'function' && welcome.isDocked() &&
        typeof welcome.undock === 'function') {
      welcome.undock();
    }
    const host = container && container.querySelector('.home-overview');
    if (host) {
      host.innerHTML = '';
    }
    const band = container && container.querySelector('.home-release-band');
    if (band) {
      band.innerHTML = '';
    }
  }

  function bindOverviewEvents() {
    if (overview.bound || !document) {
      return;
    }
    overview.bound = true;
    document.addEventListener('ProjectMap:shell-index-updated', () => renderOverview());
    document.addEventListener(
      eventName('welcomeDismissed', 'ProjectMap:welcome-dismissed'),
      () => renderOverview()
    );
  }

  function renderOverview() {
    const host = overview.panel && overview.panel.querySelector('.home-overview');
    if (!host) {
      return;
    }
    if (overviewHasProject()) {
      renderDashboardFace(host);
    } else {
      renderOnboardingFace(host);
    }
  }

  // The release band lives in its own host ABOVE .home-overview, so it is
  // orthogonal to the two faces: switching faces only rewrites .home-overview
  // and never disturbs the band. It only needs re-rendering at mount and when
  // the user marks the release seen.
  function renderReleaseBand() {
    const band = overview.panel && overview.panel.querySelector('.home-release-band');
    if (!band) {
      return;
    }
    const latest = whatsNewLatest();
    if (!latest) {
      band.innerHTML = '';
      band.classList.remove('is-active', 'is-seen');
      return;
    }
    if (whatsNewUnseen()) {
      band.classList.add('is-active');
      band.classList.remove('is-seen');
      band.innerHTML = [
        '<span class="home-release-icon" data-ui-icon="spark" aria-hidden="true"></span>',
        '<div class="home-release-text">',
        '<p class="home-release-title">',
        '<span data-i18n="home.whatsnew.band.title">New in this version</span> ',
        '<span class="home-release-version">v' + escapeHtml(latest) + '</span>',
        '</p>',
        '<p class="home-release-body" data-i18n="home.whatsnew.band.body"></p>',
        '</div>',
        '<div class="home-release-actions">',
        '<button type="button" class="home-release-cta" data-whatsnew-open="true" data-i18n="home.whatsnew.band.cta"></button>',
        '<button type="button" class="home-release-dismiss" data-whatsnew-dismiss="true" data-i18n="home.whatsnew.band.dismiss"></button>',
        '</div>'
      ].join('');
    } else {
      band.classList.remove('is-active');
      band.classList.add('is-seen');
      band.innerHTML = [
        '<button type="button" class="home-release-link" data-whatsnew-open="true">',
        '<span class="home-release-link-icon" data-ui-icon="spark" aria-hidden="true"></span>',
        '<span data-i18n="home.whatsnew.link"></span>',
        '</button>'
      ].join('');
    }
    wireReleaseBand(band);
    localizeAndDecorate(band);
  }

  function wireReleaseBand(band) {
    band.querySelectorAll('[data-whatsnew-open]').forEach((el) => {
      el.addEventListener('click', () => openWhatsNew());
    });
    band.querySelectorAll('[data-whatsnew-dismiss]').forEach((el) => {
      el.addEventListener('click', () => markWhatsNewSeen());
    });
  }

  function renderOnboardingFace(host) {
    host.classList.remove('is-dashboard');
    host.classList.add('is-onboarding');
    // Drop any dashboard markup, but keep the welcome node if it is already here.
    Array.from(host.children).forEach((child) => {
      if (child.id !== 'studio-welcome') {
        child.remove();
      }
    });
    const welcome = welcomeSurface();
    if (welcome && typeof welcome.dock === 'function') {
      welcome.dock(host);
    }
  }

  function renderDashboardFace(host) {
    const welcome = welcomeSurface();
    if (welcome && typeof welcome.isDocked === 'function' && welcome.isDocked() &&
        typeof welcome.undock === 'function') {
      welcome.undock();
    }
    host.classList.remove('is-onboarding');
    host.classList.add('is-dashboard');
    host.innerHTML = buildDashboardMarkup();
    wireDashboardFace(host);
    localizeAndDecorate(host);
  }

  function dashboardCardsMarkup() {
    const desktop = !!(global.dendryDesktop && global.dendryDesktop.isDesktop);
    if (!desktop) {
      return '<p class="home-dash-hint" data-i18n="home.dash.browserHint">' +
        'Publishing and announcements are available in the desktop app.</p>';
    }
    return [
      // Publish card carries a live ahead/behind status line and links INTO the
      // embedded 發布 section (not a modal — the section is a full embed now).
      // renderPublishStatus() fills [data-publish-status] asynchronously.
      '<article class="home-launch home-dash-card" data-dash-hue="publish">',
      '<span class="home-launch-icon" data-ui-icon="save" aria-hidden="true"></span>',
      '<p class="home-launch-lead" data-i18n="home.publish.lead"></p>',
      '<p class="home-dash-status hidden" data-publish-status></p>',
      '<button type="button" class="home-launch-cta" data-home-section-link="publish" data-i18n="home.publish.cta"></button>',
      '</article>',
      // Announcements card mirrors the publish card: navigates INTO the embedded
      // 公告 section (F convergence). The More-menu / banner board modal still
      // coexists (user kept it in D).
      '<article class="home-launch home-dash-card" data-dash-hue="announcements">',
      '<span class="home-launch-icon" data-ui-icon="info" aria-hidden="true"></span>',
      '<p class="home-launch-lead" data-i18n="home.announcements.lead"></p>',
      '<button type="button" class="home-launch-cta" data-home-section-link="announcements" data-i18n="home.announcements.cta"></button>',
      '</article>'
    ].join('');
  }

  function buildDashboardMarkup() {
    // The Home hero already greets the author and names the open project, so the
    // dashboard face skips its own "welcome back" header and leads straight with
    // the publish / announcement cards (no double greeting, no repeated name).
    return [
      '<div class="home-dash-cards">' + dashboardCardsMarkup() + '</div>',
      // Secondary "learning" entries, grouped as a footer row so both read as a
      // pair and stay easy to spot. The first re-opens the getting-started guide
      // (welcome surface); the second clicks the shared Tutorial Library opener
      // via launchTarget(), giving the dashboard the entry it was missing.
      '<div class="home-dash-footer">',
      '<button type="button" class="home-dash-link-btn" data-home-onboarding-link="true">',
      '<span class="home-dash-link-icon" data-ui-icon="map" aria-hidden="true"></span>',
      '<span data-i18n="home.dash.openOnboarding">View the getting-started guide</span>',
      '</button>',
      '<button type="button" class="home-dash-link-btn" data-launch-target="studio-open-tutorial-library">',
      '<span class="home-dash-link-icon" data-ui-icon="book" aria-hidden="true"></span>',
      '<span data-i18n="home.dash.openTutorialLibrary">Open Tutorial Library</span>',
      '</button>',
      '</div>'
    ].join('');
  }

  function wireDashboardFace(host) {
    host.querySelectorAll('[data-launch-target]').forEach((button) => {
      button.addEventListener('click', () => launchTarget(button.getAttribute('data-launch-target')));
    });
    host.querySelectorAll('[data-home-section-link]').forEach((button) => {
      button.addEventListener('click', () => {
        const ui = homeUi();
        if (ui && typeof ui.setSection === 'function') {
          ui.setSection(button.getAttribute('data-home-section-link'), {persist: true});
        }
      });
    });
    const link = host.querySelector('[data-home-onboarding-link]');
    if (link) {
      link.addEventListener('click', () => {
        const welcome = welcomeSurface();
        if (welcome && typeof welcome.open === 'function') {
          welcome.open();
        }
      });
    }
    renderPublishStatus(host);
  }

  // ---- Dashboard publish status line (live ahead/behind) ----
  // The publish card shows a one-line GitHub sync summary so the user can read
  // ↑N↓N at a glance without opening the publish flow. getStatusSnapshot() hits
  // the desktop bridge (async), so we paint a "checking" placeholder, then fill
  // on resolve — re-querying the slot and bailing if the dashboard was
  // re-rendered or the snapshot is unavailable (e.g. browser, no bridge).
  function renderPublishStatus(host) {
    const slot = host && host.querySelector('[data-publish-status]');
    if (!slot) {
      return;
    }
    const publish = publishUi();
    if (!publish || typeof publish.getStatusSnapshot !== 'function') {
      slot.classList.add('hidden');
      return;
    }
    slot.classList.remove('hidden');
    slot.textContent = t('publish.sync.checking', 'Checking GitHub…');
    Promise.resolve(publish.getStatusSnapshot())
      .then((snap) => applyPublishStatus(host, snap))
      .catch(() => applyPublishStatus(host, null));
  }

  function applyPublishStatus(host, snap) {
    const slot = host && host.querySelector('[data-publish-status]');
    if (!slot) {
      return;
    }
    if (!snap || !snap.available) {
      slot.classList.add('hidden');
      slot.innerHTML = '';
      return;
    }
    slot.classList.remove('hidden');
    slot.innerHTML = publishStatusMarkup(snap);
    localizeAndDecorate(slot);
  }

  function statusTextMarkup(key) {
    return '<span class="home-publish-status-text" data-i18n="' + key + '"></span>';
  }

  function publishStatusMarkup(snap) {
    if (!snap.hasProject) {
      return statusTextMarkup('home.publish.statusNoProject');
    }
    if (!snap.connected) {
      return statusTextMarkup('home.publish.statusConnect');
    }
    if (!snap.ok) {
      return statusTextMarkup('home.publish.statusOffline');
    }
    if (snap.state === 'first_publish') {
      return statusTextMarkup('home.publish.statusFirstPublish');
    }
    const ahead = Number(snap.ahead) || 0;
    const behind = Number(snap.behind) || 0;
    if (ahead > 0 || behind > 0) {
      const badges = [];
      if (ahead > 0) {
        badges.push('<span class="home-publish-badge home-publish-badge-ahead">↑' +
          ahead + ' <span data-i18n="publish.sync.ahead"></span></span>');
      }
      if (behind > 0) {
        badges.push('<span class="home-publish-badge home-publish-badge-behind">↓' +
          behind + ' <span data-i18n="publish.sync.behind"></span></span>');
      }
      if (snap.dirty) {
        badges.push('<span class="home-publish-badge home-publish-badge-dirty" data-i18n="home.publish.statusDirty"></span>');
      }
      return badges.join('');
    }
    if (snap.dirty) {
      return statusTextMarkup('home.publish.statusDirty');
    }
    return statusTextMarkup('home.publish.statusInSync');
  }

  // ---- What's New section ----
  // The dedicated "新功能" tab. Always available (no desktop gating, no version
  // gating) so the user can revisit the current release's highlights any time.
  // Content comes from the bundled whats_new_data.js (latest release) and is
  // rendered as note-style cards (icon + title + body, no button), mirroring the
  // welcome surface's action-card shape.

  function mountWhatsNew(container) {
    if (!container || !document) {
      return;
    }
    // The section renders its own version-stamped header, so the generic <h2>
    // the shell builds is redundant.
    const heading = container.querySelector('h2');
    if (heading) {
      heading.classList.add('hidden');
    }
    if (!container.querySelector('.home-whatsnew')) {
      const host = document.createElement('div');
      host.className = 'home-whatsnew';
      container.appendChild(host);
    }
    renderWhatsNew(container.querySelector('.home-whatsnew'));
  }

  function unmountWhatsNew(container) {
    const host = container && container.querySelector('.home-whatsnew');
    if (host) {
      host.innerHTML = '';
    }
  }

  function renderWhatsNew(host) {
    if (!host) {
      return;
    }
    const data = whatsNewData();
    const release = data && typeof data.latestRelease === 'function'
      ? data.latestRelease()
      : null;
    const items = release && Array.isArray(release.items) ? release.items : [];
    const versionLabel = release && release.version ? 'v' + release.version : '';
    const parts = [
      '<header class="home-whatsnew-header">',
      '<h2 class="home-whatsnew-title" data-i18n="home.whatsnew.title">What\'s new</h2>',
      versionLabel
        ? '<span class="home-whatsnew-version">' + escapeHtml(versionLabel) + '</span>'
        : '',
      '</header>',
      '<p class="home-whatsnew-lead" data-i18n="home.whatsnew.lead"></p>'
    ];
    if (items.length) {
      parts.push(
        '<ul class="home-whatsnew-list">' +
        items.map(whatsNewItemMarkup).join('') +
        '</ul>'
      );
    } else {
      parts.push(
        '<p class="home-whatsnew-empty" data-i18n="home.whatsnew.empty">You\'re all caught up.</p>'
      );
    }
    host.innerHTML = parts.join('');
    localizeAndDecorate(host);
  }

  function whatsNewItemMarkup(item) {
    const icon = item && item.icon ? item.icon : 'spark';
    const titleKey = item && item.titleKey ? item.titleKey : '';
    const bodyKey = item && item.bodyKey ? item.bodyKey : '';
    return [
      '<li class="home-whatsnew-item">',
      '<span class="home-whatsnew-icon" data-ui-icon="' + escapeHtml(icon) + '" aria-hidden="true"></span>',
      '<div class="home-whatsnew-text">',
      '<h3 class="home-whatsnew-item-title" data-i18n="' + escapeHtml(titleKey) + '"></h3>',
      '<p class="home-whatsnew-item-body" data-i18n="' + escapeHtml(bodyKey) + '"></p>',
      '</div>',
      '</li>'
    ].join('');
  }

  // ---- Announcements section: embed the notice board ----
  // Reparents the shared #announcement-board node into the panel via
  // ProjectMapUpdateNotice.mountBoard (dock/undock, like the welcome surface).
  // Re-docks when the user returns to this section or after a modal session
  // (the More-menu / banner board buttons still open the modal, which undocks).

  const announce = {container: null, bound: false};

  function mountAnnouncements(cfg, container) {
    const notice = updateNotice();
    if (!notice || typeof notice.mountBoard !== 'function') {
      // Fall back to the launcher card if the embed API is unavailable.
      mountSection(cfg, container);
      return;
    }
    // The board carries its own header, so the generic section <h2> is redundant.
    const heading = container && container.querySelector('h2');
    if (heading) {
      heading.classList.add('hidden');
    }
    announce.container = container;
    notice.mountBoard(container);
    bindAnnouncementsRedock();
  }

  function unmountAnnouncements(container) {
    const notice = updateNotice();
    if (notice && typeof notice.isBoardDocked === 'function' && notice.isBoardDocked() &&
        typeof notice.unmountBoard === 'function') {
      notice.unmountBoard();
    }
    const heading = container && container.querySelector('h2');
    if (heading) {
      heading.classList.remove('hidden');
    }
  }

  function bindAnnouncementsRedock() {
    if (announce.bound || !document) {
      return;
    }
    announce.bound = true;
    const redock = () => {
      const notice = updateNotice();
      if (notice && typeof notice.mountBoard === 'function' && announce.container) {
        notice.mountBoard(announce.container);
      }
    };
    document.addEventListener(
      eventName('homeSectionChanged', 'ProjectMap:home-section-changed'),
      (event) => {
        if (event && event.detail && event.detail.section === 'announcements') {
          redock();
        }
      }
    );
    document.addEventListener(eventName('boardClosed', 'ProjectMap:board-closed'), redock);
  }

  // ---- Templates section: embed the catalog ----
  // Renders the catalog into a SEPARATE scoped host via
  // ProjectMapWelcomeSurface.mountCatalog — NOT by reparenting the shared
  // #studio-welcome node (the Overview onboarding face already claims it), so
  // the two never fight over the same DOM. The generic section <h2> stays as the
  // header; the catalog cards render below it.

  const templates = {container: null, bound: false};

  function mountTemplates(cfg, container) {
    const welcome = welcomeSurface();
    if (!welcome || typeof welcome.mountCatalog !== 'function') {
      mountSection(cfg, container);
      return;
    }
    // The catalog carries its own "Template Hub" header, so the generic section
    // <h2> is redundant.
    const heading = container && container.querySelector('h2');
    if (heading) {
      heading.classList.add('hidden');
    }
    templates.container = container;
    welcome.mountCatalog(container);
    bindTemplatesRedock();
  }

  function unmountTemplates(container) {
    const welcome = welcomeSurface();
    if (welcome && typeof welcome.isCatalogDocked === 'function' && welcome.isCatalogDocked() &&
        typeof welcome.unmountCatalog === 'function') {
      welcome.unmountCatalog();
    }
    const heading = container && container.querySelector('h2');
    if (heading) {
      heading.classList.remove('hidden');
    }
  }

  function bindTemplatesRedock() {
    if (templates.bound || !document) {
      return;
    }
    templates.bound = true;
    const redock = () => {
      const welcome = welcomeSurface();
      if (welcome && typeof welcome.mountCatalog === 'function' && templates.container) {
        welcome.mountCatalog(templates.container);
      }
    };
    // After a welcome/catalog-only modal session borrows the catalog node, snap
    // it back into the 模板 section.
    document.addEventListener(
      eventName('welcomeDismissed', 'ProjectMap:welcome-dismissed'),
      redock
    );
    document.addEventListener(
      eventName('homeSectionChanged', 'ProjectMap:home-section-changed'),
      (event) => {
        if (event && event.detail && event.detail.section === 'templates') {
          redock();
        }
      }
    );
  }

  // ---- Publish section: embed the publish flow ----
  // Reparents the shared .publish-overlay node into the panel via
  // ProjectMapPublishUi.mount (dock/undock, like the announcement board). The
  // More-menu publish button still opens the modal (open() undocks first); after
  // that modal session a `publishClosed` event snaps the node back into place.
  // Desktop-only (the publish flow needs the desktop bridge); falls back to the
  // launcher card if the embed API is unavailable.

  const publishEmbed = {container: null, bound: false};

  function mountPublish(cfg, container) {
    const publish = publishUi();
    const available = publish && typeof publish.isAvailable === 'function'
      ? publish.isAvailable()
      : false;
    if (!publish || typeof publish.mount !== 'function' || !available) {
      mountSection(cfg, container);
      return;
    }
    // The publish dialog carries its own header, so the generic section <h2> is
    // redundant.
    const heading = container && container.querySelector('h2');
    if (heading) {
      heading.classList.add('hidden');
    }
    publishEmbed.container = container;
    publish.mount(container);
    bindPublishRedock();
  }

  function unmountPublish(container) {
    const publish = publishUi();
    if (publish && typeof publish.isDocked === 'function' && publish.isDocked() &&
        typeof publish.unmount === 'function') {
      publish.unmount();
    }
    const heading = container && container.querySelector('h2');
    if (heading) {
      heading.classList.remove('hidden');
    }
  }

  function bindPublishRedock() {
    if (publishEmbed.bound || !document) {
      return;
    }
    publishEmbed.bound = true;
    const redock = () => {
      const publish = publishUi();
      if (publish && typeof publish.mount === 'function' && publishEmbed.container) {
        publish.mount(publishEmbed.container);
      }
    };
    document.addEventListener(
      eventName('homeSectionChanged', 'ProjectMap:home-section-changed'),
      (event) => {
        if (event && event.detail && event.detail.section === 'publish') {
          redock();
        }
      }
    );
    document.addEventListener(eventName('publishClosed', 'ProjectMap:publish-closed'), redock);
  }

  function mountSectionFor(cfg, container) {
    if (cfg.key === 'overview') {
      return mountOverview(container);
    }
    if (cfg.key === 'whatsnew') {
      return mountWhatsNew(container);
    }
    if (cfg.key === 'publish') {
      return mountPublish(cfg, container);
    }
    if (cfg.key === 'announcements') {
      return mountAnnouncements(cfg, container);
    }
    if (cfg.key === 'templates') {
      return mountTemplates(cfg, container);
    }
    return mountSection(cfg, container);
  }

  function unmountSectionFor(cfg, container) {
    if (cfg.key === 'overview') {
      return unmountOverview(container);
    }
    if (cfg.key === 'whatsnew') {
      return unmountWhatsNew(container);
    }
    if (cfg.key === 'publish') {
      return unmountPublish(container);
    }
    if (cfg.key === 'announcements') {
      return unmountAnnouncements(container);
    }
    if (cfg.key === 'templates') {
      return unmountTemplates(container);
    }
    return unmountSection(container);
  }

  const sections = SECTIONS.map((cfg) => ({
    key: cfg.key,
    labelKey: 'home.section.' + cfg.key,
    icon: cfg.icon,
    desktopOnly: !!cfg.desktopOnly,
    mount: (container) => mountSectionFor(cfg, container),
    unmount: (container) => unmountSectionFor(cfg, container)
  }));

  const byKey = {};
  sections.forEach((section) => {
    byKey[section.key] = section;
  });

  const api = {
    sections: () => sections.slice(),
    get: (key) => byKey[key] || null
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapHomeSectionRegistry = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
