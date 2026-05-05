(function initProjectMapSystemUiPreviewSurface(global) {
  'use strict';

  function render(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const template = model.template || templateFromMode(model.mode);
    const regions = regionsForTemplate(template, fieldMap(model));
    const selectedKey = String(opts.selected || '');
    const selected = regions.find((region) => 'ui:' + region.key === selectedKey) || regions[0] || null;
    return [
      '<section class="object-canvas-stage system-ui-preview-surface" data-object-canvas-stage="true" data-system-ui-preview-surface="true" data-object-canvas-workspace="system_ui" aria-label="' + escapeAttr(t('systemUi.surfaceAria', 'System UI Live Preview')) + '">',
      '<header class="object-canvas-stage-toolbar">',
      '<div><div class="template-eyebrow">' + escapeHtml(t('authoring.surface.systemUiPreview', 'System UI Live Preview')) + '</div><h3>' + escapeHtml(model.title || t('authoring.workspace.systemUi', 'System UI Authoring')) + '</h3></div>',
      '<div class="system-ui-fixtures" data-system-ui-fixtures="true">',
      '<button type="button" data-system-ui-fixture="default">' + escapeHtml(t('systemUi.fixture.default', 'Default')) + '</button>',
      '<button type="button" data-system-ui-fixture="busy">' + escapeHtml(t('systemUi.fixture.busy', 'Busy state')) + '</button>',
      '</div>',
      '</header>',
      '<div class="system-ui-layout">',
      renderPreview(template, regions, selected),
      renderInspector(model, selected),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderPreview(template, regions, selected) {
    return [
      '<section class="system-ui-live-preview system-ui-live-preview-' + escapeAttr(template) + '" data-system-ui-live-preview="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.preview', 'Live preview')) + '</div>',
      '<div class="system-ui-device">',
      regions.map((region) => renderRegion(region, selected)).join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderRegion(region, selected) {
    const active = selected && selected.key === region.key;
    return [
      '<button type="button" class="system-ui-region system-ui-region-' + escapeAttr(region.key) + (active ? ' is-selected' : '') + '" data-object-canvas-graph-node="ui:' + escapeAttr(region.key) + '" data-system-ui-region="' + escapeAttr(region.key) + '">',
      '<span>' + escapeHtml(region.label) + '</span>',
      '<strong>' + escapeHtml(region.title) + '</strong>',
      '<small>' + escapeHtml(region.body) + '</small>',
      '</button>'
    ].join('');
  }

  function renderInspector(model, selected) {
    return [
      '<aside class="system-ui-inspector" data-system-ui-inspector="true">',
      selected ? renderSelectedRegion(selected) : '',
      renderRegionFields(model, selected),
      renderActions(model),
      '</aside>'
    ].join('');
  }

  function renderSelectedRegion(region) {
    return [
      '<section class="object-canvas-inspector-card" data-system-ui-selected-region="' + escapeAttr(region.key) + '">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.selectedRegion', 'Selected UI region')) + '</div>',
      '<h3>' + escapeHtml(region.title) + '</h3>',
      '<p>' + escapeHtml(region.body) + '</p>',
      '</section>'
    ].join('');
  }

  function renderRegionFields(model, selected) {
    const fields = selected ? selected.fields : flattenFields(model.eventBody || {});
    return [
      '<section class="object-event-body" data-object-canvas-event-body="true" data-system-ui-region-fields="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.editRegion', 'Edit selected region')) + '</div>',
      fields.length
        ? fields.map(renderField).join('')
        : '<p class="editing-empty">' + escapeHtml(t('objectCanvas.noBodyFields', 'No player-facing body fields are available yet.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderField(field) {
    const value = String(field && field.value !== undefined ? field.value : field && field.original || '');
    const id = field && field.id || '';
    return [
      '<label class="object-inline-field">',
      '<span>' + escapeHtml(field && field.label || id || '') + '</span>',
      '<input type="text" class="object-inline-input" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '" value="' + escapeAttr(value) + '"' + (field && field.readOnly ? ' readonly' : '') + '>',
      '</label>'
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

  function regionsForTemplate(template, fields) {
    if (template === 'play_surface') {
      return [
        region('hand', t('systemUi.region.hand', 'Hand'), value(fields, 'play.handTitle', 'Workspace Hand'), value(fields, 'play.handBody', ''), pick(fields, ['play.handTitle', 'play.handHeading', 'play.handBody', 'play.handDeckOptionLabel', 'play.handAdvisorOptionLabel'])),
        region('deck', t('systemUi.region.deck', 'Deck'), value(fields, 'play.deckTitle', 'Starter Deck'), value(fields, 'play.deckSubtitle', ''), pick(fields, ['play.deckTitle', 'play.deckSubtitle'])),
        region('card', t('systemUi.region.card', 'Card'), value(fields, 'play.cardTitle', 'Action Card'), value(fields, 'play.cardBody', ''), pick(fields, ['play.cardTitle', 'play.cardHeading', 'play.cardBody', 'play.cardOption0Label', 'play.cardOption1Label'])),
        region('advisor', t('systemUi.region.advisor', 'Advisor'), value(fields, 'play.advisorTitle', 'Advisor'), value(fields, 'play.advisorBody', ''), pick(fields, ['play.advisorTitle', 'play.advisorHeading', 'play.advisorBody', 'play.advisorOption0Label']))
      ];
    }
    if (template === 'workspace_layout') {
      return [
        region('hand', t('systemUi.region.hand', 'Hand'), value(fields, 'layout.handOptionLabel', 'Open deck'), value(fields, 'layout.deckTag', ''), pick(fields, ['layout.handOptionLabel', 'layout.handInsertMode', 'layout.handAnchorId'])),
        region('deck', t('systemUi.region.deck', 'Deck'), value(fields, 'layout.deckTitle', 'Policy Deck'), value(fields, 'layout.deckSubtitle', ''), pick(fields, ['layout.deckTitle', 'layout.deckSubtitle', 'layout.deckId', 'layout.deckTag'])),
        region('starter_card', t('systemUi.region.card', 'Card'), value(fields, 'layout.starterCardTitle', 'Starter Card'), value(fields, 'layout.starterCardBody', ''), pick(fields, ['layout.starterCardTitle', 'layout.starterCardHeading', 'layout.starterCardBody', 'layout.starterCardOption0Label', 'layout.starterCardOption1Label'])),
        region('sidebar', t('systemUi.region.sidebar', 'Sidebar'), value(fields, 'layout.sidebarHeading', 'Policy Desk'), value(fields, 'layout.sidebarBody', ''), pick(fields, ['layout.sidebarHeading', 'layout.sidebarBody', 'layout.sidebarStatusLines', 'layout.sidebarInsertMode']))
      ];
    }
    if (template === 'sidebar_status') {
      return [
        region('sidebar', t('systemUi.region.sidebar', 'Sidebar'), value(fields, 'sidebar.statusTitle', 'Status'), value(fields, 'sidebar.sectionBody', ''), pick(fields, ['sidebar.statusTitle', 'sidebar.sectionHeading', 'sidebar.sectionBody', 'sidebar.sectionStatusLines', 'sidebar.sectionId']))
      ];
    }
    return [
      region('entry', t('systemUi.region.entry', 'Entry'), value(fields, 'entry.rootTitle', 'Start'), value(fields, 'entry.rootIntro', ''), pick(fields, ['entry.rootTitle', 'entry.rootHeading', 'entry.rootIntro', 'entry.firstOptionTitle', 'entry.firstTargetId'])),
      region('sidebar', t('systemUi.region.sidebar', 'Sidebar'), value(fields, 'entry.sidebarTitle', 'Status'), value(fields, 'entry.sidebarBody', ''), pick(fields, ['entry.sidebarTitle', 'entry.sidebarHeading', 'entry.sidebarBody', 'entry.sidebarStatusLines']))
    ];
  }

  function region(key, label, title, body, fields) {
    return {key, label, title, body, fields};
  }

  function fieldMap(model) {
    const fields = {};
    flattenFields(model.eventBody || model || {}).forEach((field) => {
      if (field && field.id) {
        fields[field.id] = field;
      }
    });
    return fields;
  }

  function flattenFields(body) {
    return [body.title, body.heading].filter(Boolean)
      .concat(ensureArray(body.sections))
      .concat(ensureArray(body.options).reduce((all, option) => all.concat(ensureArray(option.fields)), []))
      .concat(ensureArray(body.metaFields));
  }

  function pick(fields, ids) {
    return ids.map((id) => fields[id]).filter(Boolean);
  }

  function value(fields, id, fallback) {
    const field = fields[id] || {};
    return String(field.value !== undefined ? field.value : field.original || fallback || '');
  }

  function templateFromMode(mode) {
    const value = String(mode || '');
    if (value === 'entry_sidebar') {
      return 'entry';
    }
    return value || 'entry';
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

  const api = {render, renderPreview};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSystemUiPreviewSurface = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
