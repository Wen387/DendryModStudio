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

  const WELCOME_MARKUP = [
    '<section id="studio-welcome" class="welcome-surface hidden" role="dialog" aria-modal="true" aria-labelledby="welcome-title">',
    '  <div class="welcome-dialog">',
    '    <button class="welcome-close" type="button" data-welcome-close="true" data-onboarding-close="true" aria-label="Close" data-i18n-aria-label="welcome.close">',
    '      <span data-ui-icon="close"></span>',
    '    </button>',
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
    '    <section id="welcome-catalog" class="welcome-catalog desktop-only-control hidden" aria-label="Featured templates" data-i18n-aria-label="welcome.catalog.aria">',
    '      <header class="welcome-catalog-header">',
    '        <h2 data-i18n="welcome.catalog.title">Featured Templates</h2>',
    '        <span data-i18n="welcome.catalog.subtitle">Full-scale game projects. Downloads are optional.</span>',
    '      </header>',
    '      <div id="welcome-catalog-list" class="welcome-catalog-list"></div>',
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
    document.addEventListener('project-map:locale-changed', () => {
      updateActionState();
      decorateIcons();
    });
    document.addEventListener('project-map:index-loaded', () => {
      if (state.controller) {
        state.controller.markSeen();
      }
      closeDialog(false);
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

  function openDialog(fromMenu) {
    if (!state.elements || !state.elements.dialog) {
      return false;
    }
    updateActionState();
    decorateIcons();
    state.elements.dialog.classList.remove('hidden');
    if (fromMenu && state.elements.topbarMore) {
      state.elements.topbarMore.open = false;
    }
    const focusTarget = visiblePrimaryAction();
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
    }
    return true;
  }

  function closeDialog(markSeen) {
    if (!state.elements || !state.elements.dialog) {
      return false;
    }
    state.elements.dialog.classList.add('hidden');
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
    caps.listCatalogTemplates({}, global).then(function (result) {
      if (!result || !result.ok || !result.templates || result.templates.length === 0) {
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
      if (state.elements.catalogList) {
        state.elements.catalogList.innerHTML = result.templates.map(renderCatalogCard).join('');
        state.elements.catalogList.querySelectorAll('[data-catalog-action]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            handleCatalogAction(btn.getAttribute('data-template-id'), btn);
          });
        });
      }
      decorateIcons();
      localizeDialog();
    }).catch(function () {
      if (state.elements.catalogSection) {
        state.elements.catalogSection.classList.add('hidden');
        state.elements.catalogSection.hidden = true;
      }
    });
  }

  function renderCatalogCard(template) {
    var status = template.status || 'not-installed';
    var sizeLabel = template.estimatedSizeMB
      ? ' (' + template.estimatedSizeMB + ' MB)'
      : '';
    var buttonLabel, buttonClass, iconName, updateBadge;
    if (status === 'update-available') {
      buttonLabel = t('welcome.catalog.update', 'Update');
      buttonClass = '';
      iconName = 'download';
      updateBadge = '<span class="welcome-catalog-update-badge" data-i18n="welcome.catalog.updateAvailable">' +
        t('welcome.catalog.updateAvailable', 'Update available') + '</span>';
    } else if (status === 'ready') {
      buttonLabel = t('welcome.catalog.open', 'Open');
      buttonClass = 'primary-action';
      iconName = 'play';
      updateBadge = '';
    } else {
      buttonLabel = t('welcome.catalog.download', 'Download') + sizeLabel;
      buttonClass = '';
      iconName = 'download';
      updateBadge = '';
    }
    return [
      '<article class="welcome-catalog-card" data-catalog-id="' + template.id + '">',
      '  <div class="welcome-catalog-card-body">',
      '    <h3>' + escapeHtml(template.title) + updateBadge + '</h3>',
      '    <p>' + escapeHtml(template.description) + '</p>',
      '    <span class="welcome-catalog-meta">' + escapeHtml(template.author) + '</span>',
      '  </div>',
      '  <div class="welcome-catalog-card-actions">',
      '    <button class="' + buttonClass + '" type="button" data-catalog-action="open" data-template-id="' + template.id + '"' +
           (status === 'update-available' ? ' data-catalog-update="true"' : '') + '>',
      '      <span data-ui-icon="' + iconName + '"></span>',
      '      <span>' + buttonLabel + '</span>',
      '    </button>',
      '  </div>',
      '</article>'
    ].join('');
  }

  function handleCatalogAction(templateId, button) {
    if (!templateId) { return; }
    var caps = global.ProjectMapDesktopCapabilities;
    if (!caps || !caps.canOpenCatalogTemplate || !caps.canOpenCatalogTemplate(global)) { return; }
    var includeExcerpts = Boolean(state.elements.desktopIncludeExcerpts && state.elements.desktopIncludeExcerpts.checked);
    var forceUpdate = button && button.hasAttribute('data-catalog-update');
    if (button) {
      button.disabled = true;
      button.querySelector('span:last-child').textContent = t('welcome.catalog.downloading', 'Downloading...');
    }
    closeDialog(true);
    caps.openCatalogTemplate({templateId: templateId, includeExcerpts: includeExcerpts, forceUpdate: forceUpdate}, global).catch(function (err) {
      if (global.console && typeof global.console.warn === 'function') {
        global.console.warn('Could not open catalog template:', err && err.message ? err.message : err);
      }
    }).finally(function () {
      if (button) {
        button.disabled = false;
      }
      updateActionState();
    });
  }

  function escapeHtml(text) {
    return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})(typeof window !== 'undefined' ? window : globalThis);
