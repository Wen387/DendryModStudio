(function initProjectMapHomeUi(global) {
  'use strict';

  // Home pane shell — one scrolling page of stacked sections. The top sub-nav
  // is a table of contents: clicking a pill smooth-scrolls the content column
  // to that section's band, and a scrollspy highlights whichever section sits
  // under the reader during a hand scroll. Section CONTENT (publish /
  // announcements / templates / what's-new adapters) is mounted by the
  // registry; this shell never reaches into those modules. The pane is hidden
  // until something calls ProjectMapShellNavigation.setMode('home').

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

  function sectionChangedEventName() {
    const api = contracts();
    return api && api.EVENT_NAMES && api.EVENT_NAMES.homeSectionChanged
      ? api.EVENT_NAMES.homeSectionChanged
      : 'ProjectMap:home-section-changed';
  }

  const DEFAULT_SECTION = 'overview';
  // Spy line: a section counts as "current" while its top edge sits above this
  // many pixels from the top of the scroller.
  const SPY_OFFSET = 90;

  const state = {
    pane: null,
    content: null,
    buttons: [],
    panels: [],
    current: '',
    mounted: new Set(),
    heroSub: null,
    // Spy suppression deadline while a click-driven smooth scroll settles —
    // without it the spy would flicker through every section passed en route.
    scrollLockUntil: 0,
    spyScheduled: false
  };

  const api = {
    setSection,
    getSection: () => state.current,
    sections: () => state.buttons.map((button) => button.getAttribute('data-home-section'))
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapHomeUi = api;
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

  // Build the sub-nav and the stacked section column from the registry — the
  // single source of truth for which sections exist, their labels, icons, and
  // desktop gating. index.html ships only the empty #home-pane host.
  // Desktop-only sections simply do not exist in a browser build of the page:
  // the page is one scroll, so a hidden stub would only leave a dead anchor.
  function buildPane(document) {
    const registry = homeRegistry();
    const sections = registry && typeof registry.sections === 'function'
      ? registry.sections()
      : [];
    if (!sections.length || state.pane.querySelector('.home-nav')) {
      return;
    }
    const desktop = !!(global.dendryDesktop && global.dendryDesktop.isDesktop);
    const icons = global.ProjectMapIcons;
    const nav = document.createElement('nav');
    nav.className = 'home-nav';
    nav.setAttribute('aria-label', 'Home sections');
    nav.setAttribute('data-i18n-aria-label', 'home.navAria');
    const content = document.createElement('div');
    content.className = 'home-content';
    sections.forEach((section) => {
      if (section.desktopOnly && !desktop) {
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'home-nav-item';
      button.id = 'home-tab-' + section.key;
      button.setAttribute('data-home-section', section.key);
      if (icons && typeof icons.prependTo === 'function' && section.icon) {
        icons.prependTo(button, section.icon);
      }
      const label = document.createElement('span');
      label.setAttribute('data-i18n', section.labelKey);
      button.appendChild(label);
      nav.appendChild(button);

      const panel = document.createElement('section');
      panel.className = 'home-panel';
      panel.id = 'home-panel-' + section.key;
      panel.setAttribute('data-home-panel', section.key);
      panel.setAttribute('aria-labelledby', 'home-band-' + section.key);
      // Section band — the uniform kicker that names and colour-codes each
      // block of the page; it doubles as the scroll anchor target, so every
      // section keeps a clear boundary even when its embed brings its own
      // larger header below.
      const band = document.createElement('div');
      band.className = 'home-section-band';
      const bandIcon = document.createElement('span');
      bandIcon.className = 'home-section-band-icon';
      bandIcon.setAttribute('aria-hidden', 'true');
      bandIcon.setAttribute('data-ui-icon', section.icon || 'spark');
      const bandLabel = document.createElement('span');
      bandLabel.className = 'home-section-band-label';
      bandLabel.id = 'home-band-' + section.key;
      bandLabel.setAttribute('data-i18n', section.labelKey);
      band.appendChild(bandIcon);
      band.appendChild(bandLabel);
      panel.appendChild(band);
      content.appendChild(panel);
    });
    // Lightweight greeting band above the sub-nav — a warm "front porch" shown
    // across every section. Icon is decorated and text localized by start()'s
    // decorateIcons()/localize() pass, same as the rest of the pane. Copy is
    // author-owned (home.hero.*); the subtitle hides itself when left empty.
    const hero = document.createElement('header');
    hero.className = 'home-hero';
    const heroGlyph = document.createElement('span');
    heroGlyph.className = 'home-hero-glyph';
    heroGlyph.setAttribute('aria-hidden', 'true');
    heroGlyph.setAttribute('data-ui-icon', 'spark');
    const heroText = document.createElement('div');
    heroText.className = 'home-hero-text';
    const heroGreeting = document.createElement('p');
    heroGreeting.className = 'home-hero-greeting';
    heroGreeting.setAttribute('data-i18n', 'home.hero.greeting');
    const heroSub = document.createElement('p');
    heroSub.className = 'home-hero-sub';
    heroSub.setAttribute('data-i18n', 'home.hero.sub');
    heroText.appendChild(heroGreeting);
    heroText.appendChild(heroSub);
    hero.appendChild(heroGlyph);
    hero.appendChild(heroText);
    state.heroSub = heroSub;

    state.pane.appendChild(hero);
    state.pane.appendChild(nav);
    state.pane.appendChild(content);
  }

  function start(document) {
    state.pane = document.getElementById('home-pane');
    if (!state.pane) {
      return;
    }
    buildPane(document);
    state.content = state.pane.querySelector('.home-content');
    state.buttons = Array.from(state.pane.querySelectorAll('[data-home-section]'));
    state.panels = Array.from(state.pane.querySelectorAll('[data-home-panel]'));
    state.buttons.forEach((button) => {
      button.addEventListener('click', () => {
        setSection(button.getAttribute('data-home-section'));
      });
    });
    // Mount every section up front: the page is one scroll, so a late mount
    // would grow the column mid-read and make anchors drift under the reader.
    // Content volume is dashboard-scale (cards and lists), and the Home pane's
    // DOM persists across mode switches, so this is a one-time cost.
    state.panels.forEach((panel) => {
      ensureMounted(panel.getAttribute('data-home-panel'));
    });
    localize();
    decorateIcons();
    setActive(DEFAULT_SECTION, {silent: true});
    if (state.content) {
      state.content.addEventListener('scroll', onScroll, {passive: true});
    }
    bindHeroSubtitle(document);
  }

  function shellNav() {
    return global && global.ProjectMapShellNavigation
      ? global.ProjectMapShellNavigation
      : null;
  }

  // The loaded project's display label (empty string when nothing is open).
  // Prefer the project's own name over the index file label: on desktop the
  // file label is an absolute path, which is the wrong thing to greet with.
  function currentProjectLabel() {
    const nav = shellNav();
    const snap = nav && typeof nav.getState === 'function' ? (nav.getState() || {}) : {};
    const project = snap.projectModel && snap.projectModel.project;
    const name = project && project.name ? String(project.name).trim() : '';
    if (name) {
      return name;
    }
    const label = (snap && snap.lastIndexLabel) || '';
    return label ? String(label).split(/[\\/]/).pop() : '';
  }

  // Hero subtitle reflects context: the open project's name when one is loaded,
  // otherwise the localized invite line. When showing the project name we drop
  // the data-i18n binding so a later re-translate (locale switch, or the i18n
  // MutationObserver) can't overwrite it; when empty we restore the binding and
  // let the standard translate pass fill it.
  function refreshHeroSubtitle() {
    const sub = state.heroSub;
    if (!sub) {
      return;
    }
    const label = currentProjectLabel();
    if (label) {
      if (sub.hasAttribute('data-i18n')) {
        sub.removeAttribute('data-i18n');
      }
      sub.textContent = label;
      return;
    }
    sub.setAttribute('data-i18n', 'home.hero.sub');
    const i18n = global.ProjectMapI18n;
    if (i18n && typeof i18n.applyTranslations === 'function' && sub.parentNode) {
      i18n.applyTranslations(sub.parentNode);
    }
  }

  // Fill the subtitle now, then keep it in sync: the shell re-emits
  // shell-index-updated whenever the loaded ProjectIndex changes (open / switch /
  // close); locale-changed re-evaluates the empty-state fallback in the new
  // language. start() runs once, so these listeners bind once.
  function bindHeroSubtitle(document) {
    refreshHeroSubtitle();
    if (!document || typeof document.addEventListener !== 'function') {
      return;
    }
    document.addEventListener('ProjectMap:shell-index-updated', refreshHeroSubtitle);
    document.addEventListener('project-map:locale-changed', refreshHeroSubtitle);
  }

  // A section is addressable if its nav pill was built at all — desktop-only
  // sections never exist in a browser, so they fall back to the default here.
  function sectionAvailable(key) {
    return state.buttons.some(
      (candidate) => candidate.getAttribute('data-home-section') === key
    );
  }

  function homeRegistry() {
    return global && global.ProjectMapHomeSectionRegistry
      ? global.ProjectMapHomeSectionRegistry
      : null;
  }

  // Populate a section panel once, then localize + icon-decorate the freshly
  // mounted content. The shell never reaches into a section's internals — it
  // just asks the registry to mount.
  function ensureMounted(key) {
    if (!key || state.mounted.has(key)) {
      return;
    }
    const registry = homeRegistry();
    const panel = state.pane
      ? state.pane.querySelector('[data-home-panel="' + key + '"]')
      : null;
    if (!registry || !panel || typeof registry.get !== 'function') {
      return;
    }
    const section = registry.get(key);
    if (!section || typeof section.mount !== 'function') {
      return;
    }
    section.mount(panel);
    state.mounted.add(key);
    const i18n = global.ProjectMapI18n;
    if (i18n && typeof i18n.applyTranslations === 'function') {
      i18n.applyTranslations(panel);
    }
    const icons = global.ProjectMapIcons;
    if (icons && typeof icons.decorate === 'function') {
      icons.decorate(panel);
    }
  }

  function prefersReducedMotion() {
    return !!(global.matchMedia &&
      global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function panelFor(key) {
    return state.panels.find(
      (panel) => panel.getAttribute('data-home-panel') === key
    ) || null;
  }

  // Public API + nav clicks: scroll the content column to the section's band.
  // The active pill flips immediately (not via the spy) so the click feels
  // instant; the spy stays suppressed until the smooth scroll settles.
  function setSection(key, _opts) {
    const target = sectionAvailable(key) ? key : DEFAULT_SECTION;
    ensureMounted(target);
    const panel = panelFor(target);
    const content = state.content;
    if (!panel || !content) {
      return target;
    }
    setActive(target);
    const top = panel.getBoundingClientRect().top -
      content.getBoundingClientRect().top + content.scrollTop - 6;
    const smooth = !prefersReducedMotion();
    state.scrollLockUntil = Date.now() + (smooth ? 900 : 150);
    try {
      content.scrollTo({top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto'});
    } catch (_err) {
      content.scrollTop = Math.max(0, top);
    }
    return target;
  }

  // Scrollspy: the current section is the last one whose top edge has passed
  // the spy line; once the column is scrolled to its end, the final section
  // wins outright (a short last section could otherwise never become current).
  function onScroll() {
    if (state.spyScheduled) {
      return;
    }
    state.spyScheduled = true;
    const run = () => {
      state.spyScheduled = false;
      runSpy();
    };
    if (typeof global.requestAnimationFrame === 'function') {
      global.requestAnimationFrame(run);
    } else {
      run();
    }
  }

  function runSpy() {
    if (Date.now() < state.scrollLockUntil) {
      return;
    }
    const content = state.content;
    if (!content || !state.panels.length) {
      return;
    }
    const contentTop = content.getBoundingClientRect().top;
    let current = state.panels[0].getAttribute('data-home-panel');
    state.panels.forEach((panel) => {
      if (panel.getBoundingClientRect().top - contentTop <= SPY_OFFSET) {
        current = panel.getAttribute('data-home-panel');
      }
    });
    if (content.scrollTop + content.clientHeight >= content.scrollHeight - 4) {
      current = state.panels[state.panels.length - 1].getAttribute('data-home-panel');
    }
    if (current !== state.current) {
      setActive(current);
    }
  }

  // Flip the active pill and announce the change — the registry re-docks
  // borrowed embed nodes (board/catalog/publish) when their section comes
  // around, whether by click or by scroll.
  function setActive(key, opts) {
    const options = opts || {};
    state.current = key;
    state.buttons.forEach((button) => {
      const active = button.getAttribute('data-home-section') === key;
      button.classList.toggle('is-active', active);
      if (active) {
        button.setAttribute('aria-current', 'true');
      } else {
        button.removeAttribute('aria-current');
      }
    });
    if (!options.silent) {
      dispatchSectionChanged(key);
    }
  }

  function dispatchSectionChanged(key) {
    if (!global.document || typeof global.document.dispatchEvent !== 'function') {
      return;
    }
    try {
      const name = sectionChangedEventName();
      let event;
      if (typeof global.CustomEvent === 'function') {
        event = new global.CustomEvent(name, {detail: {section: key}});
      } else {
        event = global.document.createEvent('CustomEvent');
        event.initCustomEvent(name, false, false, {section: key});
      }
      global.document.dispatchEvent(event);
    } catch (_err) {
      // best effort only
    }
  }

  function localize() {
    const i18n = global.ProjectMapI18n;
    if (i18n && typeof i18n.applyTranslations === 'function' && state.pane) {
      i18n.applyTranslations(state.pane);
    }
  }

  function decorateIcons() {
    const icons = global.ProjectMapIcons;
    if (icons && typeof icons.decorate === 'function' && state.pane) {
      icons.decorate(state.pane);
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
