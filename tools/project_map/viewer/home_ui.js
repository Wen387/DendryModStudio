(function initProjectMapHomeUi(global) {
  'use strict';

  // Home pane shell (P0 scaffold). Owns ONLY the #home-pane host and its
  // internal section sub-navigation: clicking a sub-nav button swaps the
  // visible section panel. Section CONTENT (publish/announcements/templates/
  // what's-new adapters) is mounted by later phases — this shell never reaches
  // into those modules. The pane is hidden until something calls
  // ProjectMapShellNavigation.setMode('home'); nothing wires that yet, so this
  // module is inert (no visible behavior change) on its own.

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

  function sectionStorageKey() {
    const api = contracts();
    return api && api.STORAGE_KEYS && api.STORAGE_KEYS.homeSection
      ? api.STORAGE_KEYS.homeSection
      : 'dendry-mod-studio-home-section';
  }

  function sectionChangedEventName() {
    const api = contracts();
    return api && api.EVENT_NAMES && api.EVENT_NAMES.homeSectionChanged
      ? api.EVENT_NAMES.homeSectionChanged
      : 'ProjectMap:home-section-changed';
  }

  function safeStorage() {
    try {
      return global && global.localStorage ? global.localStorage : null;
    } catch (_err) {
      return null;
    }
  }

  const DEFAULT_SECTION = 'overview';

  const state = {
    pane: null,
    buttons: [],
    panels: [],
    current: '',
    mounted: new Set(),
    heroSub: null
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

  // Build the sub-nav and section panel shells from the registry — the single
  // source of truth for which sections exist, their labels, icons, and desktop
  // gating. index.html ships only the empty #home-pane host. Desktop-only
  // sections are gated here directly: their buttons are created after app.js has
  // already snapshotted the static .desktop-only-control set, so they cannot ride
  // that shared desktop reveal.
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
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Home sections');
    nav.setAttribute('data-i18n-aria-label', 'home.navAria');
    const content = document.createElement('div');
    content.className = 'home-content';
    sections.forEach((section, index) => {
      const first = index === 0;
      const gated = section.desktopOnly && !desktop;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'home-nav-item' + (first ? ' is-active' : '') + (gated ? ' hidden' : '');
      button.id = 'home-tab-' + section.key;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', first ? 'true' : 'false');
      // Roving tabindex (WAI-ARIA tabs): only the active tab is in the tab order;
      // the rest are reached with arrow keys.
      button.setAttribute('tabindex', first ? '0' : '-1');
      button.setAttribute('aria-controls', 'home-panel-' + section.key);
      button.setAttribute('data-home-section', section.key);
      if (icons && typeof icons.prependTo === 'function' && section.icon) {
        icons.prependTo(button, section.icon);
      }
      const label = document.createElement('span');
      label.setAttribute('data-i18n', section.labelKey);
      button.appendChild(label);
      nav.appendChild(button);

      const panel = document.createElement('section');
      panel.className = 'home-panel' + (first ? '' : ' hidden');
      panel.id = 'home-panel-' + section.key;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', 'home-tab-' + section.key);
      panel.setAttribute('tabindex', '0');
      panel.setAttribute('data-home-panel', section.key);
      if (!first) {
        panel.hidden = true;
      }
      const heading = document.createElement('h2');
      heading.setAttribute('data-i18n', section.labelKey);
      panel.appendChild(heading);
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

  // Visible (non-gated) tabs in DOM order — the set arrow keys cycle through.
  function visibleTabs() {
    return state.buttons.filter((button) => !button.classList.contains('hidden'));
  }

  // WAI-ARIA tabs keyboard support (automatic activation): Left/Right cycle,
  // Home/End jump to the ends; focus follows selection so the panel updates.
  function onTabKeydown(event) {
    const key = event.key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') {
      return;
    }
    const tabs = visibleTabs();
    if (!tabs.length) {
      return;
    }
    let index = tabs.indexOf(event.currentTarget);
    if (index === -1) {
      index = 0;
    }
    if (key === 'ArrowRight') {
      index = (index + 1) % tabs.length;
    } else if (key === 'ArrowLeft') {
      index = (index - 1 + tabs.length) % tabs.length;
    } else if (key === 'Home') {
      index = 0;
    } else {
      index = tabs.length - 1;
    }
    event.preventDefault();
    const next = tabs[index];
    next.focus();
    setSection(next.getAttribute('data-home-section'), {persist: true});
  }

  function start(document) {
    state.pane = document.getElementById('home-pane');
    if (!state.pane) {
      return;
    }
    buildPane(document);
    state.buttons = Array.from(state.pane.querySelectorAll('[data-home-section]'));
    state.panels = Array.from(state.pane.querySelectorAll('[data-home-panel]'));
    state.buttons.forEach((button) => {
      button.addEventListener('click', () => {
        setSection(button.getAttribute('data-home-section'), {persist: true});
      });
      button.addEventListener('keydown', onTabKeydown);
    });
    localize();
    decorateIcons();
    setSection(restoreSection(), {persist: false, silent: true});
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

  // A section is selectable only if its nav button exists AND is not hidden.
  // Desktop-only sections (publish/templates/announcements) carry the shared
  // `.desktop-only-control hidden` gate, so in a browser they fall back here.
  function sectionAvailable(key) {
    const button = state.buttons.find(
      (candidate) => candidate.getAttribute('data-home-section') === key
    );
    return !!button && !button.classList.contains('hidden');
  }

  function homeRegistry() {
    return global && global.ProjectMapHomeSectionRegistry
      ? global.ProjectMapHomeSectionRegistry
      : null;
  }

  // Lazily populate a section panel the first time it becomes active, then
  // localize + icon-decorate the freshly mounted content. The shell never
  // reaches into a section's internals — it just asks the registry to mount.
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

  function restoreSection() {
    const storage = safeStorage();
    let stored = '';
    if (storage && typeof storage.getItem === 'function') {
      try {
        stored = storage.getItem(sectionStorageKey()) || '';
      } catch (_err) {
        stored = '';
      }
    }
    return sectionAvailable(stored) ? stored : DEFAULT_SECTION;
  }

  function setSection(key, opts) {
    const options = opts || {};
    const target = sectionAvailable(key) ? key : DEFAULT_SECTION;
    state.current = target;
    ensureMounted(target);
    state.buttons.forEach((button) => {
      const active = button.getAttribute('data-home-section') === target;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.setAttribute('tabindex', active ? '0' : '-1');
    });
    state.panels.forEach((panel) => {
      const active = panel.getAttribute('data-home-panel') === target;
      panel.classList.toggle('hidden', !active);
      panel.hidden = !active;
    });
    if (options.persist) {
      persistSection(target);
    }
    if (!options.silent) {
      dispatchSectionChanged(target);
    }
    return target;
  }

  function persistSection(key) {
    const storage = safeStorage();
    if (!storage || typeof storage.setItem !== 'function') {
      return;
    }
    try {
      storage.setItem(sectionStorageKey(), key);
    } catch (_err) {
      // best effort only
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
