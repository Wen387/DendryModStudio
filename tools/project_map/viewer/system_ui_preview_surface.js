(function initProjectMapSystemUiPreviewSurface(global) {
  'use strict';

  function render(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const screen = buildScreen(model, opts);
    return [
      '<section class="object-canvas-stage system-ui-preview-surface system-screen-workspace" data-object-canvas-stage="true" data-system-ui-preview-surface="true" data-system-screen-workspace="true" data-object-canvas-workspace="system_ui" data-system-ui-recipe="' + escapeAttr(screen.template) + '" aria-label="' + escapeAttr(t('systemUi.surfaceAria', 'System UI Live Preview')) + '">',
      renderToolbar(model, screen),
      '<div class="system-ui-layout">',
      renderPreview(screen),
      renderInspector(model, screen),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderToolbar(model, screen) {
    return [
      '<header class="object-canvas-stage-toolbar">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('authoring.surface.systemUiPreview', 'System Screen Workspace')) + '</div>',
      '<h3>' + escapeHtml(t('authoring.template.systemUiScreen', 'System UI Screen')) + '</h3>',
      '<p>' + escapeHtml(t('systemUi.unifiedIntent', 'Click a visible UI region to edit the object behind it. Studio keeps the internal draft type in the background.')) + '</p>',
      renderFamilyPills(screen),
      '</div>',
      '<div class="system-ui-fixtures" data-system-ui-fixtures="true">',
      renderFixtureButton('default', screen.fixture, t('systemUi.fixture.default', 'Default')),
      renderFixtureButton('busy', screen.fixture, t('systemUi.fixture.busy', 'Busy state')),
      '</div>',
      '</header>'
    ].join('');
  }

  function renderFamilyPills(screen) {
    return [
      '<div class="system-screen-families" data-system-screen-families="true">',
      ensureArray(screen.families).map((family) => '<span class="' + (family.active ? 'is-active' : '') + '" data-system-screen-family-pill="' + escapeAttr(family.key) + '">' + escapeHtml(t(family.labelKey, family.fallback)) + '</span>').join(''),
      '</div>'
    ].join('');
  }

  function renderFixtureButton(fixture, current, label) {
    return '<button type="button" class="' + (fixture === current ? 'is-active' : '') + '" data-system-ui-fixture="' + escapeAttr(fixture) + '" aria-pressed="' + (fixture === current ? 'true' : 'false') + '">' + escapeHtml(label) + '</button>';
  }

  function renderPreview(screen) {
    const api = previewApi();
    return api && typeof api.render === 'function' ? api.render(screen) : '';
  }

  function renderInspector(model, screen) {
    const selected = screen.selected || null;
    return [
      '<aside class="system-ui-inspector" data-system-ui-inspector="true">',
      selected ? renderSelectedRegion(screen, selected) : '',
      renderRegionFields(selected),
      renderDiagnostics(screen),
      renderActions(model),
      '</aside>'
    ].join('');
  }

  function renderSelectedRegion(screen, region) {
    const family = (screen.families || []).find((item) => item.key === region.family) || {};
    return [
      '<section class="object-canvas-inspector-card" data-system-ui-selected-region="' + escapeAttr(region.key) + '" data-system-ui-selected-family="' + escapeAttr(region.family) + '">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.selectedRegion', 'Selected UI region')) + '</div>',
      '<h3>' + escapeHtml(region.title) + '</h3>',
      '<p>' + escapeHtml(region.body) + '</p>',
      '<dl class="system-screen-selection-meta">',
      '<dt>' + escapeHtml(t('systemUi.objectFamily', 'Object family')) + '</dt><dd>' + escapeHtml(t(family.labelKey, family.fallback || region.family)) + '</dd>',
      '</dl>',
      '</section>'
    ].join('');
  }

  function renderRegionFields(selected) {
    const fields = selected && selected.fields || [];
    return [
      '<section class="object-event-body" data-object-canvas-event-body="true" data-system-ui-region-fields="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.editRegion', 'Edit selected region')) + '</div>',
      fields.length
        ? fields.map(renderField).join('')
        : '<p class="editing-empty">' + escapeHtml(t('systemUi.noRegionFields', 'This region is visible for context; this recipe has no direct fields for it.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderField(field) {
    const value = String(field && field.value !== undefined ? field.value : field && field.original || '');
    const id = field && field.id || '';
    const multiline = value.indexOf('\n') >= 0 || value.length > 72 || /Body|text|lines/i.test(field && field.label || id);
    const common = ' class="object-inline-input" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '"' + (field && field.readOnly ? ' readonly' : '');
    return [
      '<label class="object-inline-field">',
      '<span>' + escapeHtml(field && field.label || id || '') + '</span>',
      multiline
        ? '<textarea rows="' + rowsFor(value) + '"' + common + '>' + escapeHtml(value) + '</textarea>'
        : '<input type="text"' + common + ' value="' + escapeAttr(value) + '">',
      '</label>'
    ].join('');
  }

  function renderDiagnostics(screen) {
    return [
      '<section class="content-storyboard-detail system-screen-diagnostics" data-system-screen-diagnostics="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.previewIntent', 'Preview intent')) + '</div>',
      ensureArray(screen.diagnostics).map((row) => '<div><span>' + escapeHtml(row.label) + '</span><strong>' + escapeHtml(row.value) + '</strong></div>').join(''),
      '</section>'
    ].join('');
  }

  function renderActions(model) {
    return [
      '<div class="editing-actions object-canvas-actions">',
      '<button type="button" data-object-canvas-action="refresh">' + escapeHtml(t('existingScene.refresh', 'Refresh proposal')) + '</button>',
      '<button type="button" data-object-canvas-action="save">' + escapeHtml(t('editing.saveToChanges', 'Save to My Changes')) + '</button>',
      '<button class="primary-action" type="button" data-object-canvas-action="review">' + escapeHtml(t('existingScene.review', 'Review & Apply')) + '</button>',
      model.mode !== 'existing' ? '<button type="button" data-object-canvas-action="legacy_form">' + escapeHtml(t('objectCanvas.legacyForm', 'Advanced Form')) + '</button>' : '',
      '</div>'
    ].join('');
  }

  function buildScreen(model, options) {
    const api = screenModelApi();
    return api && typeof api.buildScreen === 'function'
      ? api.buildScreen(model, options || {})
      : {template: 'entry', fixture: 'default', recipe: {}, families: [], regions: [], diagnostics: []};
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

  function rowsFor(value) {
    return String(Math.max(3, Math.min(8, String(value || '').split('\n').length + 1)));
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
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

  const api = {render};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSystemUiPreviewSurface = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
