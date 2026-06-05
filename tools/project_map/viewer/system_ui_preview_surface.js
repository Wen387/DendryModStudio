(function initProjectMapSystemUiPreviewSurface(global) {
  'use strict';

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const ensureArray = domTextUtils.ensureArray;
  const escapeHtml = domTextUtils.escapeHtml;
  const escapeAttr = domTextUtils.escapeAttr;

  function render(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const screen = buildScreen(model, opts);
    return [
      '<section class="object-canvas-stage system-ui-preview-surface system-screen-workspace" data-object-canvas-stage="true" data-system-ui-preview-surface="true" data-system-screen-workspace="true" data-object-canvas-workspace="system_ui" data-system-ui-recipe="' + escapeAttr(screen.template) + '" aria-label="' + escapeAttr(t('systemUi.surfaceAria', 'System UI Live Preview')) + '">',
      renderToolbar(model, screen),
      '<div class="system-ui-layout">',
      renderPreview(screen),
      renderInspector(model, screen, opts),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderToolbar(model, screen) {
    const collapsed = Boolean(screen && screen.boardChromeCollapsed);
    return [
      '<header class="object-canvas-stage-toolbar system-ui-preview-toolbar' + (collapsed ? ' is-collapsed' : '') + '" data-board-stage-toolbar="true" data-board-toolbar-collapsed="' + (collapsed ? 'true' : 'false') + '">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('authoring.surface.systemUiPreview', 'System Screen Workspace')) + '</div>',
      '<h3>' + escapeHtml(t('systemUi.playerFlowTitle', 'Player-facing UI')) + '</h3>',
      '<p>' + escapeHtml(t('systemUi.unifiedIntent', 'Choose the game screen, then click the visible text, tab, button, card, or status line you want to edit.')) + '</p>',
      renderPlayerFlowToolbar(screen),
      renderLibraryQuickEntry(screen),
      '</div>',
      '<div class="system-ui-fixtures" data-system-ui-fixtures="true">',
      ensureArray(screen.fixtures).map((fixture) => renderFixtureButton(fixture.key, screen.fixture, t(fixture.labelKey, fixture.fallback))).join(''),
      '</div>',
      '</header>'
    ].join('');
  }

  function renderPlayerFlowToolbar(screen) {
    const flow = screen && screen.playerFlow || {};
    const screens = ensureArray(flow.screens);
    if (!screens.length) {
      return '';
    }
    return [
      '<div class="system-ui-player-flow-toolbar" data-system-player-flow-toolbar="true">',
      screens.map((item) => '<button type="button" class="' + (item.id === flow.activeScreen ? 'is-active' : '') + '" data-system-player-flow-control="true" data-system-player-flow-screen="' + escapeAttr(item.id || '') + '" aria-pressed="' + (item.id === flow.activeScreen ? 'true' : 'false') + '">' + escapeHtml(t(item.labelKey, item.fallback || item.id)) + '</button>').join(''),
      '</div>'
    ].join('');
  }

  function renderRecipeIntents(screen) {
    return [
      '<div class="system-ui-recipe-intents" data-system-ui-recipe-intents="true">',
      screenRecipes().map((recipe) => '<button type="button" class="' + (recipe.key === screen.template ? 'is-active' : '') + '" data-system-ui-template="' + escapeAttr(recipe.key) + '" aria-pressed="' + (recipe.key === screen.template ? 'true' : 'false') + '">' + escapeHtml(t(recipe.labelKey, recipe.fallback)) + '</button>').join(''),
      '</div>'
    ].join('');
  }

  function renderLibraryQuickEntry(screen) {
    const library = screen && screen.libraryContent || {};
    const section = firstLibrarySection(library);
    if (!library.exists || !section) {
      return '';
    }
    return [
      '<div class="system-ui-library-quick-entry" data-system-ui-library-entry="toolbar">',
      '<button type="button" data-object-canvas-action="open_library_content" data-system-ui-library-scene-id="' + escapeAttr(section.route && section.route.sceneId || library.sceneId || 'library') + '" data-system-ui-library-section-id="' + escapeAttr(section.route && section.route.sectionId || section.id || '') + '">',
      escapeHtml(t('systemUi.libraryQuickEntry', 'Edit Library page content')),
      '</button>',
      '</div>'
    ].join('');
  }

  function firstLibrarySection(library) {
    return ensureArray(library && library.sections).find((section) => section && section.sourceBacked) ||
      ensureArray(library && library.sections)[0] ||
      null;
  }

  function renderFixtureButton(fixture, current, label) {
    return '<button type="button" class="' + (fixture === current ? 'is-active' : '') + '" data-system-ui-fixture="' + escapeAttr(fixture) + '" aria-pressed="' + (fixture === current ? 'true' : 'false') + '">' + escapeHtml(label) + '</button>';
  }

  function renderPreview(screen) {
    const api = previewApi();
    return api && typeof api.render === 'function' ? api.render(screen) : '';
  }

  function renderInspector(model, screen, options) {
    const editor = regionEditorApi();
    return editor && typeof editor.render === 'function'
      ? editor.render(model, screen, options || {})
      : '';
  }

  function buildScreen(model, options) {
    const api = screenModelApi();
    const screen = api && typeof api.buildScreen === 'function'
      ? api.buildScreen(model, options || {})
      : {template: 'entry', fixture: 'default', recipe: {}, families: [], regions: [], diagnostics: []};
    return Object.assign({}, screen, {
      boardChromeCollapsed: Boolean(options && options.boardChromeCollapsed)
    });
  }

  function screenModelApi() {
    if (global && global.ProjectMapSystemUiScreenModel) {
      return global.ProjectMapSystemUiScreenModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./system_ui_screen_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function previewApi() {
    if (global && global.ProjectMapSystemUiScreenPreview) {
      return global.ProjectMapSystemUiScreenPreview;
    }
    if (typeof require === 'function') {
      try {
        return require('./system_ui_screen_preview.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function regionEditorApi() {
    if (global && global.ProjectMapSystemUiRegionEditor) {
      return global.ProjectMapSystemUiRegionEditor;
    }
    if (typeof require === 'function') {
      try {
        return require('./system_ui_region_editor.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function screenRecipes() {
    return [
      {key: 'entry', labelKey: 'create.entrySidebar', fallback: 'Entry & Sidebar'},
      {key: 'project', labelKey: 'create.gameInfo', fallback: 'Game Info'},
      {key: 'play_surface', labelKey: 'create.playSurface', fallback: 'Playable Surface'},
      {key: 'workspace_layout', labelKey: 'create.workspaceLayout', fallback: 'Workspace Layout'},
      {key: 'sidebar_status', labelKey: 'create.sidebarStatus', fallback: 'Sidebar / Status'}
    ];
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  const api = {render};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSystemUiPreviewSurface = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
