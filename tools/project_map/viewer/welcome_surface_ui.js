(function initProjectMapWelcomeSurface(global) {
  'use strict';

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

  function desktopCapabilities() {
    if (global && global.ProjectMapDesktopCapabilities) {
      return global.ProjectMapDesktopCapabilities;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('./desktop_capabilities.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function storageKey() {
    const api = contracts();
    return api && api.STORAGE_KEYS && api.STORAGE_KEYS.onboardingSeen
      ? api.STORAGE_KEYS.onboardingSeen
      : 'dendry-mod-studio-onboarding-seen';
  }

  function openEventName() {
    const api = contracts();
    return api && api.EVENT_NAMES && api.EVENT_NAMES.openOnboarding
      ? api.EVENT_NAMES.openOnboarding
      : 'ProjectMap:open-onboarding';
  }

  function safeStorage() {
    try {
      return global && global.localStorage ? global.localStorage : null;
    } catch (_err) {
      return null;
    }
  }

  function createController(options) {
    const opts = options || {};
    const storage = opts.storage || safeStorage();
    const key = opts.storageKey || storageKey();
    return {
      shouldAutoOpen,
      markSeen,
      clearSeen
    };

    function shouldAutoOpen() {
      if (!storage || typeof storage.getItem !== 'function') {
        return true;
      }
      try {
        return storage.getItem(key) !== '1';
      } catch (_err) {
        return true;
      }
    }

    function markSeen() {
      if (!storage || typeof storage.setItem !== 'function') {
        return false;
      }
      try {
        storage.setItem(key, '1');
        return true;
      } catch (_err) {
        return false;
      }
    }

    function clearSeen() {
      if (!storage || typeof storage.removeItem !== 'function') {
        return false;
      }
      try {
        storage.removeItem(key);
        return true;
      } catch (_err) {
        return false;
      }
    }
  }

  function primaryActionKind(env) {
    const desktop = desktopCapabilities();
    return desktop && desktop.isDesktop(env || global) ? 'desktop' : 'browser';
  }

  function canLoadBundledDemo(env) {
    const desktop = desktopCapabilities();
    return Boolean(desktop && desktop.canOpenStarterDemo(env || global));
  }

  const state = {
    controller: null,
    elements: null
  };

  var CATALOG_ICON_GRADIENTS = [
    'linear-gradient(135deg, #c27040, #a05530)',
    'linear-gradient(135deg, #4e7a9e, #3a5e80)',
    'linear-gradient(135deg, #6b8e4e, #4a7a38)',
    'linear-gradient(135deg, #8e6bb0, #6a4e8e)',
    'linear-gradient(135deg, #c0785a, #9e5c40)'
  ];

  const WELCOME_MARKUP = [
    '<section id="studio-welcome" class="welcome-surface hidden" role="dialog" aria-modal="true" aria-labelledby="welcome-title">',
    '  <div class="welcome-dialog">',
    '    <button class="welcome-close" type="button" data-welcome-close="true" data-onboarding-close="true" aria-label="Close" data-i18n-aria-label="welcome.close">',
    '      <span data-ui-icon="close"></span>',
    '    </button>',
    '    <header class="welcome-catalog-standalone-header">',
    '      <div>',
    '        <p class="welcome-eyebrow"><span data-ui-icon="download"></span><span data-i18n="welcome.catalog.standaloneEyebrow">Template Hub</span></p>',
    '        <h2 data-i18n="welcome.catalog.standaloneTitle">Browse and manage game templates</h2>',
    '        <p data-i18n="welcome.catalog.standaloneSubtitle">Download full-scale Dendry projects to study, mod, or use as a starting point.</p>',
    '      </div>',
    '    </header>',
    '    <header class="welcome-hero">',
    '      <div>',
    '        <p class="welcome-eyebrow"><span data-ui-icon="spark"></span><span data-i18n="welcome.eyebrow">Welcome Hub</span></p>',
    '        <h1 id="welcome-title" data-i18n="welcome.title">Start your first mod edit here</h1>',
    '        <p data-i18n="welcome.subtitle">Follow the route from "find content -> draft a proposal -> review changes". Source files stay untouched until you confirm apply.</p>',
    '      </div>',
    '      <aside class="welcome-compass" aria-label="Recommended path" data-i18n-aria-label="welcome.compassAria">',
    '        <strong data-i18n="welcome.compassTitle">Recommended first step</strong>',
    '        <span data-i18n="welcome.compassBody">If a demo is available, start there. It gives you a writable sandbox so you do not have to touch real project files.</span>',
    '      </aside>',
    '    </header>',
    '    <div class="welcome-actions" aria-label="Start options" data-i18n-aria-label="welcome.actionsAria">',
    '      <article id="welcome-demo-card" class="welcome-action-card is-recommended desktop-only-control hidden">',
    '        <div class="welcome-action-top">',
    '          <span class="welcome-action-icon" data-ui-icon="play"></span>',
    '          <h2 data-i18n="welcome.action.demo.title">Start with Demo</h2>',
    '        </div>',
    '        <p data-i18n="welcome.action.demo.body">Use a writable sandbox to practice the full loop before touching real project files.</p>',
    '        <button id="onboarding-load-demo" class="primary-action" type="button">',
    '          <span data-ui-icon="play"></span>',
    '          <span data-i18n="welcome.action.demo.cta">Start with Demo</span>',
    '        </button>',
    '      </article>',
    '      <article class="welcome-action-card">',
    '        <div class="welcome-action-top">',
    '          <span class="welcome-action-icon" data-ui-icon="folder"></span>',
    '          <h2 data-i18n="welcome.action.open.title">Open Project</h2>',
    '        </div>',
    '        <p data-i18n="welcome.action.open.body">Desktop users can open a project folder directly. Browser users can load a ProjectIndex JSON produced elsewhere.</p>',
    '        <button id="welcome-primary" class="primary-action" type="button" data-onboarding-primary="true">',
    '          <span data-ui-icon="folder"></span>',
    '          <span id="welcome-primary-label">Load ProjectIndex</span>',
    '        </button>',
    '      </article>',
    '      <article class="welcome-action-card">',
    '        <div class="welcome-action-top">',
    '          <span class="welcome-action-icon" data-ui-icon="map"></span>',
    '          <h2 data-i18n="welcome.action.browse.title">Browse Workspace</h2>',
    '        </div>',
    '        <p data-i18n="welcome.action.browse.body">Not sure what to do yet? That is fine. The workspace still works before a ProjectIndex is loaded.</p>',
    '        <button id="welcome-browse-workspace" type="button">',
    '          <span data-ui-icon="map"></span>',
    '          <span data-i18n="welcome.action.browse.cta">Enter Workspace</span>',
    '        </button>',
    '      </article>',
    '    </div>',
    '    <section id="welcome-catalog" class="welcome-catalog desktop-only-control hidden" aria-label="Template Hub" data-i18n-aria-label="welcome.catalog.aria">',
    '      <header class="welcome-catalog-header">',
    '        <h2><span class="welcome-catalog-header-icon" data-ui-icon="download"></span><span data-i18n="welcome.catalog.title">Template Hub</span></h2>',
    '        <span data-i18n="welcome.catalog.subtitle">Full-scale game projects. Downloads are optional.</span>',
    '      </header>',
    '      <div id="welcome-catalog-list" class="welcome-catalog-list"></div>',
    '      <div class="welcome-catalog-live sr-only" aria-live="polite" aria-atomic="true"></div>',
    '    </section>',
    '    <section class="welcome-path" aria-label="First proposal flow" data-i18n-aria-label="welcome.stepsLabel">',
    '      <header class="welcome-path-header">',
    '        <h2 data-i18n="welcome.path.title">First proposal flow</h2>',
    '        <span data-i18n="welcome.path.body">Find content, draft a proposal, review changes.</span>',
    '      </header>',
    '      <div class="welcome-steps">',
    '        <article class="welcome-step">',
    '          <div class="welcome-step-mark"><span data-ui-icon="folder"></span><span>01</span></div>',
    '          <h3 data-i18n="welcome.step.open.title">Open</h3>',
    '          <p data-i18n="welcome.step.open.body">Load a project or demo sandbox</p>',
    '        </article>',
    '        <article class="welcome-step">',
    '          <div class="welcome-step-mark"><span data-ui-icon="search"></span><span>02</span></div>',
    '          <h3 data-i18n="welcome.step.find.title">Search</h3>',
    '          <p data-i18n="welcome.step.find.body">Use Explore to find a target, or browse from the Design map</p>',
    '        </article>',
    '        <article class="welcome-step">',
    '          <div class="welcome-step-mark"><span data-ui-icon="edit"></span><span>03</span></div>',
    '          <h3 data-i18n="welcome.step.edit.title">Draft</h3>',
    '          <p data-i18n="welcome.step.edit.body">Create a draft proposal without editing source files directly</p>',
    '        </article>',
    '        <article class="welcome-step">',
    '          <div class="welcome-step-mark"><span data-ui-icon="save"></span><span>04</span></div>',
    '          <h3 data-i18n="welcome.step.save.title">Save</h3>',
    '          <p data-i18n="welcome.step.save.body">Store the draft in My Changes</p>',
    '        </article>',
    '        <article class="welcome-step">',
    '          <div class="welcome-step-mark"><span data-ui-icon="check"></span><span>05</span></div>',
    '          <h3 data-i18n="welcome.step.review.title">Review</h3>',
    '          <p data-i18n="welcome.step.review.body">Check the install plan before applying</p>',
    '        </article>',
    '      </div>',
    '    </section>',
    '    <div class="welcome-support-row">',
    '      <span data-i18n="welcome.reopenLabel">You can reopen this page from the More menu at any time.</span>',
    '      <button id="onboarding-open-tutorial-library" type="button">',
    '        <span data-ui-icon="book"></span>',
    '        <span data-i18n="welcome.openTutorialLibrary">Open Tutorial Library</span>',
    '      </button>',
    '    </div>',
    '  </div>',
    '</section>'
  ].join('');

  const api = {
    createController,
    primaryActionKind,
    canLoadBundledDemo,
    open: () => openDialog(true),
    close: () => closeDialog(true),
    markSeen: () => state.controller ? state.controller.markSeen() : false,
    clearSeen: () => state.controller ? state.controller.clearSeen() : false
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapWelcomeSurface = api;
  }
  if (!global || !global.document) {
    return;
  }

  state.controller = createController({storage: safeStorage()});

  onReady(() => start(global.document));

  function onReady(callback) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function start(document) {
    ensureWelcomeMarkup(document);
    state.elements = {
      dialog: document.getElementById('studio-welcome'),
      openButton: document.getElementById('studio-open-onboarding'),
      templateHubButton: document.getElementById('studio-open-template-hub'),
      primary: document.getElementById('welcome-primary'),
      primaryLabel: document.getElementById('welcome-primary-label'),
      demoCard: document.getElementById('welcome-demo-card'),
      demo: document.getElementById('onboarding-load-demo'),
      browse: document.getElementById('welcome-browse-workspace'),
      tutorial: document.getElementById('onboarding-open-tutorial-library'),
      indexInput: document.getElementById('index-file'),
      desktopOpen: document.getElementById('desktop-open-project'),
      desktopIncludeExcerpts: document.getElementById('desktop-include-excerpts'),
      topbarMore: document.getElementById('topbar-more'),
      catalogSection: document.getElementById('welcome-catalog'),
      catalogList: document.getElementById('welcome-catalog-list')
    };
    if (!state.elements.dialog) {
      return;
    }
    wireEvents(document);
    localizeDialog();
    updateActionState();
    decorateIcons();
    if (state.controller.shouldAutoOpen()) {
      openDialog(false);
    }
  }

  function ensureWelcomeMarkup(document) {
    if (document.getElementById('studio-welcome')) {
      return true;
    }
    const mount = document.getElementById('studio-welcome-root');
    if (!mount) {
      return false;
    }
    mount.innerHTML = WELCOME_MARKUP;
    return true;
  }

  function wireEvents(document) {
    if (state.elements.openButton) {
      state.elements.openButton.addEventListener('click', () => openDialog(true));
    }
    if (state.elements.templateHubButton) {
      state.elements.templateHubButton.addEventListener('click', () => {
        document.dispatchEvent(new Event('ProjectMap:show-catalog'));
      });
    }
    if (state.elements.primary) {
      state.elements.primary.addEventListener('click', handlePrimaryAction);
    }
    if (state.elements.demo) {
      state.elements.demo.addEventListener('click', handleDemoAction);
    }
    if (state.elements.browse) {
      state.elements.browse.addEventListener('click', () => closeDialog(true));
    }
    if (state.elements.tutorial) {
      state.elements.tutorial.addEventListener('click', handleTutorialAction);
    }
    state.elements.dialog.addEventListener('click', (event) => {
      if (event.target === state.elements.dialog || event.target.closest('[data-welcome-close]')) {
        closeDialog(true);
      }
    });
    document.addEventListener(openEventName(), () => openDialog(true));
    document.addEventListener('ProjectMap:show-catalog', () => {
      openDialog(true, {catalogOnly: true});
    });
    global.addEventListener('ProjectMap:desktop-scan-progress', (event) => {
      if (!state._catalogBusy || !state._catalogActiveButton) { return; }
      var detail = event.detail || {};
      var stage = String(detail.stage || '');
      if (stage === 'catalog-download' || stage === 'catalog-assets' || stage === 'catalog-index' || stage === 'catalog-load' || stage === 'complete') {
        var label = String(detail.label || '');
        if (label) {
          var span = state._catalogActiveButton.querySelector('span:last-child');
          if (span) { span.textContent = label; }
        }
      }
    });
    document.addEventListener('project-map:tutorial-library-closed', () => {
      if (!state._reopenAfterTutorial) { return; }
      state._reopenAfterTutorial = false;
      // Only restore the Welcome Hub if the user has not already moved on to a
      // loaded project in the meantime.
      if (!state._userInitiatedLoad) {
        openDialog(false);
      }
    });
    document.addEventListener('project-map:locale-changed', () => {
      updateActionState();
      decorateIcons();
    });
    document.addEventListener('project-map:index-loaded', () => {
      if (state.controller) {
        state.controller.markSeen();
      }
      // Only auto-close for an index load the user actually initiated. A
      // background project scan finishing must not dismiss a Welcome Hub the
      // user is still reading — otherwise Quick Start vanishes before the user
      // can click its primary action (the first_time_user race).
      if (state._userInitiatedLoad || state._catalogBusy) {
        closeDialog(false);
      }
      state._userInitiatedLoad = false;
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !state.elements.dialog.classList.contains('hidden')) {
        closeDialog(true);
      }
    });
  }

  function updateActionState() {
    if (!state.elements) {
      return;
    }
    const desktopMode = primaryActionKind(global) === 'desktop';
    const demoAvailable = canLoadBundledDemo(global);
    if (state.elements.primaryLabel) {
      state.elements.primaryLabel.textContent = desktopMode
        ? t('welcome.action.openProject.cta', 'Open Project Folder')
        : t('welcome.action.loadIndex.cta', 'Load ProjectIndex');
    }
    if (state.elements.demoCard) {
      state.elements.demoCard.hidden = !demoAvailable;
      state.elements.demoCard.classList.toggle('hidden', !demoAvailable);
    }
    if (state.elements.demo) {
      state.elements.demo.disabled = !demoAvailable;
      state.elements.demo.setAttribute('aria-disabled', demoAvailable ? 'false' : 'true');
    }
    if (state.elements.primary) {
      state.elements.primary.classList.toggle('primary-action', !demoAvailable);
    }
    populateCatalog();
  }

  function decorateIcons() {
    const icons = global.ProjectMapIcons;
    if (icons && typeof icons.decorate === 'function') {
      icons.decorate(state.elements.dialog);
    }
    if (icons && typeof icons.decorateChrome === 'function') {
      icons.decorateChrome(global.document);
    }
  }

  function localizeDialog() {
    const i18n = global.ProjectMapI18n;
    if (i18n && typeof i18n.applyTranslations === 'function' && state.elements && state.elements.dialog) {
      i18n.applyTranslations(state.elements.dialog);
    }
  }

  function openDialog(fromMenu, opts) {
    if (!state.elements || !state.elements.dialog) {
      return false;
    }
    var catalogOnly = opts && opts.catalogOnly;
    updateActionState();
    decorateIcons();
    state.elements.dialog.classList.toggle('is-catalog-only', !!catalogOnly);
    state.elements.dialog.classList.remove('hidden');
    if (fromMenu && state.elements.topbarMore) {
      state.elements.topbarMore.open = false;
    }
    if (catalogOnly && state.elements.catalogSection && !state.elements.catalogSection.hidden) {
      state.elements.dialog.scrollTop = 0;
    }
    const focusTarget = visiblePrimaryAction();
    if (!catalogOnly && focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
    }
    return true;
  }

  function closeDialog(markSeen) {
    if (!state.elements || !state.elements.dialog) {
      return false;
    }
    state.elements.dialog.classList.add('hidden');
    state.elements.dialog.classList.remove('is-catalog-only');
    if (markSeen && state.controller) {
      state.controller.markSeen();
    }
    return true;
  }

  function visiblePrimaryAction() {
    if (state.elements.demo && !state.elements.demo.disabled && !elementIsHidden(state.elements.demo)) {
      return state.elements.demo;
    }
    return state.elements.primary || state.elements.browse;
  }

  function elementIsHidden(element) {
    return !element || element.hidden || element.classList.contains('hidden') ||
      Boolean(element.closest('[hidden], .hidden'));
  }

  function handlePrimaryAction() {
    state._userInitiatedLoad = true;
    closeDialog(true);
    if (primaryActionKind(global) === 'desktop' && state.elements.desktopOpen) {
      state.elements.desktopOpen.click();
      return;
    }
    if (state.elements.indexInput) {
      state.elements.indexInput.click();
    }
  }

  function handleDemoAction() {
    if (!canLoadBundledDemo(global) || !state.elements.demo) {
      return;
    }
    const includeExcerpts = Boolean(state.elements.desktopIncludeExcerpts && state.elements.desktopIncludeExcerpts.checked);
    const desktop = desktopCapabilities();
    if (!desktop) {
      return;
    }
    state._userInitiatedLoad = true;
    closeDialog(true);
    state.elements.demo.disabled = true;
    desktop.openStarterDemo({includeExcerpts}, global).catch((err) => {
      if (global.console && typeof global.console.warn === 'function') {
        global.console.warn('Could not open bundled demo template:', err && err.message ? err.message : err);
      }
    }).finally(() => {
      state.elements.demo.disabled = false;
      updateActionState();
    });
  }

  function handleTutorialAction() {
    // Remember to bring the Welcome Hub back when the user closes the Tutorial
    // Library, otherwise opening the tutorial strands a first-time user in an
    // empty Studio with no Quick Start to return to.
    state._reopenAfterTutorial = true;
    closeDialog(true);
    if (global.ProjectMapTutorialLibrary && typeof global.ProjectMapTutorialLibrary.open === 'function') {
      global.ProjectMapTutorialLibrary.open(true);
      return;
    }
    const openButton = global.document.getElementById('studio-open-tutorial-library');
    if (openButton && typeof openButton.click === 'function') {
      openButton.click();
    }
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function populateCatalog() {
    const caps = global.ProjectMapDesktopCapabilities;
    if (!caps || !caps.canListCatalogTemplates || !caps.canListCatalogTemplates(global)) {
      if (state.elements.catalogSection) {
        state.elements.catalogSection.classList.add('hidden');
        state.elements.catalogSection.hidden = true;
      }
      return;
    }
    if (state.elements.catalogSection) {
      state.elements.catalogSection.classList.remove('hidden');
      state.elements.catalogSection.hidden = false;
    }
    if (state.elements.catalogList && !state.elements.catalogList.querySelector('.welcome-catalog-card')) {
      state.elements.catalogList.innerHTML =
        '<div class="welcome-catalog-skeleton"></div>' +
        '<div class="welcome-catalog-skeleton"></div>' +
        '<div class="welcome-catalog-skeleton"></div>';
    }
    state._catalogLoadId = (state._catalogLoadId || 0) + 1;
    var loadId = state._catalogLoadId;
    caps.listCatalogTemplates({}, global).then(function (result) {
      if (loadId !== state._catalogLoadId) { return; }
      if (!result || !result.ok || !result.templates || result.templates.length === 0) {
        if (state.elements.catalogSection) {
          state.elements.catalogSection.classList.add('hidden');
          state.elements.catalogSection.hidden = true;
        }
        if (state.elements.catalogList) { state.elements.catalogList.innerHTML = ''; }
        return;
      }
      if (state.elements.catalogSection) {
        state.elements.catalogSection.classList.remove('hidden');
        state.elements.catalogSection.hidden = false;
      }
      if (state.elements.catalogList) {
        state.elements.catalogList.innerHTML = result.templates.map(renderCatalogCard).join('');
        state.elements.catalogList.querySelectorAll('[data-catalog-action]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var action = btn.getAttribute('data-catalog-action');
            if (action === 'remove') {
              handleCatalogRemove(btn.getAttribute('data-template-id'), btn);
            } else {
              handleCatalogAction(btn.getAttribute('data-template-id'), btn);
            }
          });
        });
      }
      decorateIcons();
      localizeDialog();
      fetchTemplateInfoCards(result.templates);
    }).catch(function () {
      if (loadId !== state._catalogLoadId) { return; }
      if (state.elements.catalogSection) {
        state.elements.catalogSection.classList.add('hidden');
        state.elements.catalogSection.hidden = true;
      }
      if (state.elements.catalogList) { state.elements.catalogList.innerHTML = ''; }
    });
  }

  function fetchTemplateInfoCards(templates) {
    var caps = desktopCapabilities();
    if (!caps || typeof caps.catalogTemplateInfo !== 'function') { return; }
    var installed = templates.filter(function (t) {
      return t.status === 'ready' || t.status === 'update-available';
    });
    installed.forEach(function (tmpl) {
      caps.catalogTemplateInfo({templateId: tmpl.id}, global).then(function (info) {
        if (!info || !info.ok) { return; }
        var el = state.elements.catalogList &&
          state.elements.catalogList.querySelector('[data-catalog-info="' + tmpl.id + '"]');
        if (!el) { return; }
        var parts = [];
        if (info.indexStats) {
          var s = info.indexStats;
          if (s.scenes) { parts.push(s.scenes + ' ' + t('welcome.catalog.scenes', 'scenes')); }
          if (s.variables) { parts.push(s.variables + ' ' + t('welcome.catalog.variables', 'variables')); }
          if (s.events) { parts.push(s.events + ' ' + t('welcome.catalog.events', 'events')); }
        }
        if (info.fileCount) {
          parts.push(info.fileCount + ' ' + t('welcome.catalog.files', 'files'));
        }
        var editsHtml = '';
        if (info.edits && info.edits.hasEdits) {
          editsHtml = '<span class="welcome-catalog-edits-badge">' +
            '<span data-ui-icon="edit"></span> ' +
            escapeHtml(info.edits.summary || t('welcome.catalog.locallyModified', 'locally modified')) +
            '</span>';
        }
        var assetsHtml = '';
        if (info.assets && info.assets.available) {
          if (info.assets.installed) {
            assetsHtml = '<span class="welcome-catalog-assets-badge welcome-catalog-assets-badge--ready">' +
              '<span data-ui-icon="image"></span> ' +
              escapeHtml(t('welcome.catalog.assetsInstalled', 'Art assets installed')) +
              '</span>';
          } else {
            var sizeHint = info.assets.estimatedSizeMB ? ' (' + info.assets.estimatedSizeMB + ' MB)' : '';
            assetsHtml = '<span class="welcome-catalog-assets-badge welcome-catalog-assets-badge--pending">' +
              '<span data-ui-icon="download"></span> ' +
              escapeHtml(t('welcome.catalog.assetsPending', 'Art assets not downloaded') + sizeHint) +
              '</span>';
          }
        }
        el.innerHTML = (parts.length ? '<span>' + escapeHtml(parts.join(' · ')) + '</span>' : '') + assetsHtml + editsHtml;
        decorateIcons();
      }).catch(function () {
        var el = state.elements.catalogList &&
          state.elements.catalogList.querySelector('[data-catalog-info="' + tmpl.id + '"]');
        if (el) { el.innerHTML = ''; }
      });
    });
  }

  function renderCatalogCard(template, index) {
    var status = template.status || 'not-installed';
    var sizeLabel = template.estimatedSizeMB
      ? ' (' + template.estimatedSizeMB + ' MB)'
      : '';
    var delay = (index || 0) * 60;
    var initial = (template.title || '?').charAt(0).toUpperCase();
    var gradient = CATALOG_ICON_GRADIENTS[(index || 0) % CATALOG_ICON_GRADIENTS.length];
    var statusBadge = '';
    if (status === 'update-available') {
      statusBadge = '<span class="welcome-catalog-status welcome-catalog-status--update">' +
        t('welcome.catalog.updateAvailable', 'Update available') + '</span>';
    } else if (status === 'ready') {
      statusBadge = '<span class="welcome-catalog-status welcome-catalog-status--ready">' +
        t('welcome.catalog.installed', 'Installed') + '</span>';
    }
    var buttonLabel, buttonClass, iconName;
    if (status === 'update-available') {
      buttonLabel = t('welcome.catalog.update', 'Update');
      buttonClass = '';
      iconName = 'download';
    } else if (status === 'ready') {
      buttonLabel = t('welcome.catalog.open', 'Open');
      buttonClass = 'primary-action';
      iconName = 'play';
    } else {
      buttonLabel = t('welcome.catalog.download', 'Download') + sizeLabel;
      buttonClass = '';
      iconName = 'download';
    }
    var isInstalled = (status === 'ready' || status === 'update-available');
    var removeButton = isInstalled
      ? '    <button class="welcome-catalog-remove" type="button" data-catalog-action="remove" data-template-id="' + template.id + '">' +
        '<span data-ui-icon="trash"></span>' +
        '<span>' + t('welcome.catalog.remove', 'Remove') + '</span>' +
        '</button>'
      : '';
    var infoRow = isInstalled
      ? '    <div class="welcome-catalog-info" data-catalog-info="' + template.id + '">' +
        '<span class="welcome-catalog-info-loading" data-i18n="welcome.catalog.loadingInfo">Loading info…</span></div>'
      : '';
    return [
      '<article class="welcome-catalog-card" data-catalog-id="' + template.id + '" style="animation-delay:' + delay + 'ms">',
      '  <div class="welcome-catalog-icon" style="background:' + gradient + '">',
      '    <span>' + escapeHtml(initial) + '</span>',
      '  </div>',
      '  <div class="welcome-catalog-card-body">',
      '    <div class="welcome-catalog-title-row">',
      '      <h3>' + escapeHtml(template.title) + '</h3>',
      statusBadge,
      '    </div>',
      '    <p>' + escapeHtml(template.description) + '</p>',
      '    <span class="welcome-catalog-meta">' + escapeHtml(template.author) + '</span>',
      infoRow,
      '  </div>',
      '  <div class="welcome-catalog-card-actions">',
      '    <button class="' + buttonClass + '" type="button" data-catalog-action="open" data-template-id="' + template.id + '"' +
           (status === 'update-available' ? ' data-catalog-update="true"' : '') + '>',
      '      <span data-ui-icon="' + iconName + '"></span>',
      '      <span>' + buttonLabel + '</span>',
      '    </button>',
      removeButton,
      '  </div>',
      '</article>'
    ].join('');
  }

  function handleCatalogAction(templateId, button, acknowledgeEdits) {
    if (!templateId) { return; }
    if (state._catalogBusy) { return; }
    var caps = global.ProjectMapDesktopCapabilities;
    if (!caps || !caps.canOpenCatalogTemplate || !caps.canOpenCatalogTemplate(global)) { return; }
    var includeExcerpts = Boolean(state.elements.desktopIncludeExcerpts && state.elements.desktopIncludeExcerpts.checked);
    var forceUpdate = button && button.hasAttribute('data-catalog-update');
    state._catalogBusy = true;
    state._catalogActiveButton = button || null;
    state._userInitiatedLoad = true;
    // Close dialog immediately so topbar progress bar is visible.
    closeDialog(true);
    caps.openCatalogTemplate({
      templateId: templateId,
      includeExcerpts: includeExcerpts,
      forceUpdate: forceUpdate,
      acknowledgeEdits: acknowledgeEdits || false
    }, global).then(function (result) {
      if (result && result.hasLocalEdits) {
        openDialog(false);
        showLocalEditsWarning(templateId, result, 'update', button);
        return;
      }
      if (result && result.template && result.template.id) {
        state._currentTemplateId = result.template.id;
      }
    }).catch(function (err) {
      var msg = err && err.message ? err.message : String(err);
      if (global.console && typeof global.console.warn === 'function') {
        global.console.warn('Could not open catalog template:', msg);
      }
      // Re-open dialog to show the error on the card.
      openDialog(false);
      if (state.elements.catalogList) {
        var card = state.elements.catalogList.querySelector('[data-catalog-id="' + templateId + '"]');
        if (card) {
          var existing = card.querySelector('.welcome-catalog-error');
          if (existing) { existing.remove(); }
          var errorEl = document.createElement('p');
          errorEl.className = 'welcome-catalog-error';
          errorEl.textContent = msg;
          card.querySelector('.welcome-catalog-card-body').appendChild(errorEl);
        }
      }
    }).finally(function () {
      state._catalogBusy = false;
      state._catalogActiveButton = null;
      updateActionState();
    });
  }

  function handleCatalogRemove(templateId, button, acknowledgeEdits) {
    if (!templateId) { return; }
    if (state._catalogBusy) { return; }
    var caps = global.ProjectMapDesktopCapabilities;
    if (!caps || typeof caps.removeCatalogTemplate !== 'function') { return; }
    if (state._currentTemplateId === templateId) {
      showCardFeedback(templateId, 'warning',
        t('welcome.catalog.cannotRemoveLoaded', 'Cannot remove the currently loaded template.'));
      return;
    }
    if (button) {
      button.disabled = true;
    }
    caps.removeCatalogTemplate({
      templateId: templateId,
      acknowledgeEdits: acknowledgeEdits || false
    }, global).then(function (result) {
      if (result && result.hasLocalEdits) {
        showLocalEditsWarning(templateId, result, 'remove', button);
        return;
      }
      populateCatalog();
    }).catch(function (err) {
      var msg = err && err.message ? err.message : String(err);
      if (global.console && typeof global.console.warn === 'function') {
        global.console.warn('Could not remove catalog template:', msg);
      }
      showCardFeedback(templateId, 'error', msg);
    }).finally(function () {
      if (button) {
        button.disabled = false;
      }
    });
  }

  function trapFocus(container) {
    function handler(e) {
      if (e.key !== 'Tab') { return; }
      var focusable = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) { return; }
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    container.addEventListener('keydown', handler);
    return function release() { container.removeEventListener('keydown', handler); };
  }

  function announceCatalogStatus(message) {
    var section = state.elements.catalogList && state.elements.catalogList.closest('.welcome-catalog');
    if (!section) { return; }
    var live = section.querySelector('.welcome-catalog-live');
    if (live) { live.textContent = message; }
  }

  function showLocalEditsWarning(templateId, result, action, originalButton) {
    if (!state.elements.catalogList) { return; }
    var card = state.elements.catalogList.querySelector('[data-catalog-id="' + templateId + '"]');
    if (!card) { return; }
    var body = card.querySelector('.welcome-catalog-card-body');
    if (!body) { return; }
    var existing = card.querySelector('.welcome-catalog-warning');
    if (existing) { existing.remove(); }
    var summary = result.edits ? result.edits.summary : '';
    var notice = action === 'update'
      ? t('welcome.catalog.backupNotice', 'Your changes will be backed up before updating.')
      : t('welcome.catalog.backupNoticeRemove', 'Your changes will be backed up before removing.');
    var confirmLabel = action === 'update'
      ? t('welcome.catalog.confirmUpdate', 'Confirm Update')
      : t('welcome.catalog.confirmRemove', 'Confirm Remove');
    var warning = document.createElement('div');
    warning.className = 'welcome-catalog-warning';
    warning.setAttribute('role', 'alertdialog');
    warning.setAttribute('aria-modal', 'true');
    warning.innerHTML =
      '<p>' + escapeHtml(t('welcome.catalog.localEditsWarning', 'Local modifications detected')) +
      ' (' + escapeHtml(summary) + '). ' + escapeHtml(notice) + '</p>' +
      '<button type="button">' + escapeHtml(confirmLabel) + '</button>';
    body.appendChild(warning);
    var releaseTrap = trapFocus(warning);
    var confirmBtn = warning.querySelector('button');
    confirmBtn.focus();
    announceCatalogStatus(t('welcome.catalog.localEditsWarning', 'Local modifications detected'));
    confirmBtn.addEventListener('click', function () {
      releaseTrap();
      warning.remove();
      if (action === 'update') {
        handleCatalogAction(templateId, originalButton, true);
      } else {
        handleCatalogRemove(templateId, originalButton, true);
      }
    });
  }

  function showCardFeedback(templateId, type, message) {
    if (!state.elements.catalogList) { return; }
    var card = state.elements.catalogList.querySelector('[data-catalog-id="' + templateId + '"]');
    if (!card) { return; }
    var body = card.querySelector('.welcome-catalog-card-body');
    if (!body) { return; }
    var className = type === 'warning' ? 'welcome-catalog-warning' : 'welcome-catalog-error';
    var existing = card.querySelector('.' + className);
    if (existing) { existing.remove(); }
    var el = document.createElement('div');
    el.className = className;
    el.innerHTML = '<p>' + escapeHtml(message) + '</p>';
    body.appendChild(el);
    announceCatalogStatus(message);
  }

  function escapeHtml(text) {
    return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})(typeof window !== 'undefined' ? window : globalThis);
