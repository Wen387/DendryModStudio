(function initProjectMapSystemUiRegionEditor(global) {
  'use strict';

  function render(model, screen, options) {
    const opts = isObject(options) ? options : {};
    const selected = screen && screen.selected || null;
    return [
      '<aside class="system-ui-inspector" data-system-ui-inspector="true">',
      selected ? renderSelectedRegion(screen, selected) : '',
      selected ? renderCapabilitySummary(selected.capability || screen && screen.regionContext && screen.regionContext.capability) : '',
      renderActions(model, opts),
      renderRuntimeLens(model, screen, opts),
      renderRegionFields(selected),
      renderRegionContext(screen),
      renderDiagnostics(screen),
      '</aside>'
    ].join('');
  }

  function renderSelectedRegion(screen, region) {
    const context = screen.regionContext || {};
    const ownership = context.ownership || {};
    const family = ensureArray(screen.families).find((item) => item.key === region.family) || {};
    return [
      '<section class="object-canvas-inspector-card" data-system-ui-selected-region="' + escapeAttr(region.key) + '" data-system-ui-selected-family="' + escapeAttr(region.family) + '" data-system-ui-owner-template="' + escapeAttr(ownership.ownerTemplate || region.ownerTemplate || '') + '" data-system-ui-capability-region="' + escapeAttr(region.key || '') + '">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.selectedRegion', 'Selected UI region')) + '</div>',
      '<h3>' + escapeHtml(region.title) + '</h3>',
      '<p>' + escapeHtml(region.body) + '</p>',
      '<dl class="system-screen-selection-meta">',
      '<dt>' + escapeHtml(t('systemUi.objectFamily', 'Object family')) + '</dt><dd>' + escapeHtml(t(family.labelKey, family.fallback || region.family)) + '</dd>',
      '<dt>' + escapeHtml(t('systemUi.ownerTemplate', 'Owner draft')) + '</dt><dd>' + escapeHtml(t(ownership.ownerLabelKey || region.ownerLabelKey, ownership.ownerFallback || region.ownerFallback || '')) + '</dd>',
      '<dt>' + escapeHtml(t('systemUi.ownerSlot', 'Visible slot')) + '</dt><dd>' + escapeHtml(ownership.ownerSlot || region.ownerSlot || '') + '</dd>',
      '</dl>',
      renderRegionMirror(region),
      renderCardBoardHandoff(region),
      '</section>'
    ].join('');
  }

  function renderCapabilitySummary(capability) {
    const value = isObject(capability) ? capability : {};
    const theme = isObject(value.themeLayoutCandidate) ? value.themeLayoutCandidate : {};
    const runtime = isObject(value.runtimeEvidenceSummary) ? value.runtimeEvidenceSummary : {};
    const fields = ensureArray(value.supportedEditFields);
    const state = String(value.runtimeEvidenceState || 'runtime_custom');
    return [
      '<section class="content-storyboard-detail system-ui-capability-card" data-system-ui-capability="true" data-system-ui-runtime-state="' + escapeAttr(state) + '" data-system-ui-install-safety="' + escapeAttr(value.installSafety || '') + '" data-system-ui-theme-layout-candidate="' + (theme.supported ? 'true' : 'false') + '">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.capabilityMatrix', 'Capability matrix')) + '</div>',
      '<dl class="system-screen-selection-meta">',
      '<dt>' + escapeHtml(t('systemUi.installSafety', 'Install safety')) + '</dt><dd>' + escapeHtml(value.installSafety || 'manual_review') + '</dd>',
      '<dt>' + escapeHtml(t('systemUi.runtimeEvidence', 'Runtime evidence')) + '</dt><dd>' + escapeHtml(state) + '</dd>',
      '<dt>' + escapeHtml(t('systemUi.runtimeVisible', 'Runtime visible')) + '</dt><dd>' + escapeHtml(runtime.visible ? 'yes' : 'not matched') + '</dd>',
      '<dt>' + escapeHtml(t('systemUi.themeLayoutCandidate', 'Theme/layout candidate')) + '</dt><dd>' + escapeHtml(theme.supported ? theme.scope || 'limited_source_backed' : theme.reason || 'manual') + '</dd>',
      '</dl>',
      fields.length ? '<div class="system-ui-supported-fields" data-system-ui-supported-fields="true">' + fields.map(renderCapabilityField).join('') + '</div>' : '',
      value.manualReason ? '<p class="editing-empty" data-system-ui-manual-reason="true">' + escapeHtml(value.manualReason) + '</p>' : '',
      '</section>'
    ].join('');
  }

  function renderCapabilityField(field) {
    return [
      '<span data-system-ui-supported-field="' + escapeAttr(field && field.id || '') + '" data-system-ui-field-safety="' + escapeAttr(field && field.installSafety || '') + '">',
      escapeHtml(field && (field.label || field.id) || ''),
      '</span>'
    ].join('');
  }

  function renderRegionMirror(region) {
    return [
      '<div class="system-ui-region-mirror" data-system-ui-region-mirror="true">',
      '<span>' + escapeHtml(t(region.labelKey, region.fallback || 'Region')) + '</span>',
      '<strong>' + escapeHtml(region.title || '') + '</strong>',
      region.body ? '<small>' + escapeHtml(region.body) + '</small>' : '',
      '</div>'
    ].join('');
  }

  function renderCardBoardHandoff(region) {
    const lane = cardBoardLaneForRegion(region && region.key);
    if (!lane) {
      return '';
    }
    return [
      '<div class="system-ui-card-board-handoff" data-system-ui-card-board-handoff="true">',
      '<p>' + escapeHtml(t('cardBoard.openFromSystemHelp', 'This UI object belongs to the card play area. Open Card Board to edit hand, deck, advisor, and card faces together.')) + '</p>',
      '<button type="button" data-object-canvas-action="open_card_board" data-system-ui-region-key="' + escapeAttr(region.key || '') + '" data-system-ui-card-board-lane="' + escapeAttr(lane.key) + '" data-system-ui-card-board-lane-label="' + escapeAttr(t(lane.labelKey, lane.fallback)) + '">' + escapeHtml(t('cardBoard.openFromSystem', 'Open Card Board')) + '</button>',
      '</div>'
    ].join('');
  }

  function cardBoardLaneForRegion(key) {
    return {
      workspace_hand: {key: 'hand', labelKey: 'cardBoard.lane.hand', fallback: 'Hand'},
      deck_lane: {key: 'deck', labelKey: 'cardBoard.lane.deck', fallback: 'Deck'},
      action_card: {key: 'deck', labelKey: 'cardBoard.lane.deck', fallback: 'Deck'},
      advisor_lane: {key: 'advisor', labelKey: 'cardBoard.lane.advisor', fallback: 'Advisor / pinned'}
    }[String(key || '')] || null;
  }

  function renderRuntimeLens(model, screen, options) {
    const api = runtimeLensApi();
    if (!api || typeof api.renderPanel !== 'function') {
      return '';
    }
    const focus = typeof api.focusFromSystemRegion === 'function'
      ? api.focusFromSystemRegion(options && options.projectIndex, model, screen && screen.selectedKey, {fixture: screen && screen.fixture})
      : {};
    return api.renderPanel({
      focus,
      session: options.runtimeLensSession,
      status: options.runtimeLensStatus,
      sessionFocusKey: options.runtimeLensFocusKey,
      sessionDraftKey: options.runtimeLensDraftKey,
      currentDraftKey: options.runtimeLensCurrentDraftKey,
      expanded: options.runtimeLensExpanded,
      collapsed: options.runtimeLensCollapsed
    });
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

  function renderRegionContext(screen) {
    const context = screen.regionContext || {};
    const nearby = ensureArray(context.nearbyRegions);
    const capability = context.capability || screen && screen.selected && screen.selected.capability || {};
    const evidence = ensureArray(capability.sourceEvidence).length ? ensureArray(capability.sourceEvidence) : ensureArray(context.sourceEvidence);
    return [
      '<section class="content-storyboard-detail system-ui-region-context" data-system-ui-region-context="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.context', 'Region context')) + '</div>',
      '<h4>' + escapeHtml(t('systemUi.nearbyRegions', 'Nearby visible objects')) + '</h4>',
      nearby.length
        ? '<div class="system-ui-nearby-list">' + nearby.map(renderNearbyRegion).join('') + '</div>'
        : '<p class="editing-empty">' + escapeHtml(t('systemUi.noNearbyRegions', 'No nearby regions in this screen shell.')) + '</p>',
      '<h4>' + escapeHtml(t('systemUi.sourceEvidence', 'Source evidence')) + '</h4>',
      evidence.length
        ? '<div class="system-ui-evidence-list">' + evidence.map(renderEvidence).join('') + '</div>'
        : '<p class="editing-empty">' + escapeHtml(t('systemUi.noSourceEvidence', 'No source evidence attached to this region yet.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderNearbyRegion(region) {
    return [
      '<button type="button" class="system-ui-nearby-region" data-object-canvas-graph-node="ui:' + escapeAttr(region.key) + '" data-system-ui-nearby-region="' + escapeAttr(region.key) + '">',
      '<span>' + escapeHtml(t(region.labelKey, region.fallback || region.key)) + '</span>',
      '<strong>' + escapeHtml(region.title || '') + '</strong>',
      '<small>' + escapeHtml(t('systemUi.ownerTemplate', 'Owner draft') + ': ' + (region.ownerFallback || region.ownerTemplate || '')) + '</small>',
      '</button>'
    ].join('');
  }

  function renderEvidence(row) {
    const location = [row.path, row.line ? String(row.line) : ''].filter(Boolean).join(':');
    return [
      '<div class="system-ui-evidence-row" data-system-ui-source-evidence="true">',
      '<span>' + escapeHtml(row.label || row.status || '') + '</span>',
      '<code>' + renderEvidenceLocation(location || row.status || '') + '</code>',
      '</div>'
    ].join('');
  }

  function renderEvidenceLocation(value) {
    return escapeHtml(value).replace(/([/.:_-])/g, '$1<wbr>');
  }

  function renderField(field) {
    const value = String(field && field.value !== undefined ? field.value : field && field.original || '');
    const id = field && field.id || '';
    const inputType = String(field && field.inputType || '').trim();
    const multiline = value.indexOf('\n') >= 0 || value.length > 72 || /Body|text|lines|intro/i.test(field && field.label || id);
    const common = ' class="object-inline-input" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '" data-object-canvas-original="' + escapeAttr(field && field.original !== undefined ? field.original : value) + '"' + (field && field.readOnly ? ' readonly' : '');
    return [
      '<label class="object-inline-field' + (inputType === 'checkbox' ? ' object-inline-field-checkbox' : '') + '">',
      '<span>' + escapeHtml(field && field.label || id || '') + '</span>',
      inputType === 'checkbox'
        ? '<input type="checkbox"' + common + (booleanValue(value) ? ' checked' : '') + '>'
        : inputType === 'color'
          ? '<input type="color"' + common + ' value="' + escapeAttr(safeColor(value)) + '">'
          : inputType === 'number'
            ? '<input type="number" step="0.1"' + common + ' value="' + escapeAttr(value) + '">'
            : multiline
        ? '<textarea rows="' + rowsFor(value) + '"' + common + '>' + escapeHtml(value) + '</textarea>'
        : '<input type="text"' + common + ' value="' + escapeAttr(value) + '">',
      '</label>'
    ].join('');
  }

  function renderDiagnostics(screen) {
    return [
      '<section class="content-storyboard-detail system-screen-diagnostics" data-system-screen-diagnostics="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.previewIntent', 'Preview intent')) + '</div>',
      ensureArray(screen.diagnostics).map((row) => '<div><span>' + escapeHtml(t(row.labelKey, row.label)) + '</span><strong>' + escapeHtml(row.value) + '</strong></div>').join(''),
      '</section>'
    ].join('');
  }

  function renderActions(model, options) {
    return [
      '<section class="object-canvas-command-dock system-ui-command-dock" data-object-canvas-command-dock="true">',
      '<div class="object-canvas-command-head">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('objectCanvas.changeTitle', 'Change and safety')) + '</div>',
      '<h3>' + escapeHtml(t('authoring.template.systemUiScreen', 'System UI Screen')) + '</h3>',
      '</div>',
      '</div>',
      '<div class="editing-actions object-canvas-actions">',
      '<button type="button" data-object-canvas-action="refresh">' + escapeHtml(t('existingScene.refresh', 'Refresh proposal')) + '</button>',
      '<button type="button" data-object-canvas-action="toggle_overlay">' + escapeHtml(options.editorOverlay ? t('objectCanvas.editorDock', 'Dock editor') : t('objectCanvas.editorOverlay', 'Expand editor')) + '</button>',
      '<button type="button" data-object-canvas-action="save">' + escapeHtml(t('editing.saveToChanges', 'Save to My Changes')) + '</button>',
      '<button class="primary-action" type="button" data-object-canvas-action="review">' + escapeHtml(t('existingScene.review', 'Review & Apply')) + '</button>',
      model.mode !== 'existing' ? '<button type="button" data-object-canvas-action="legacy_form">' + escapeHtml(t('objectCanvas.legacyForm', 'Advanced Form')) + '</button>' : '',
      '</div>',
      '</section>'
    ].join('');
  }

  function rowsFor(value) {
    return String(Math.max(3, Math.min(8, String(value || '').split('\n').length + 1)));
  }

  function booleanValue(value) {
    const text = String(value || '').trim().toLowerCase();
    return text === 'true' || text === '1' || text === 'yes' || text === 'on';
  }

  function safeColor(value) {
    const text = String(value || '').trim();
    return /^#[0-9A-Fa-f]{6}$/.test(text) ? text : '#999999';
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function runtimeLensApi() {
    if (global && global.ProjectMapRuntimeLensUi) {
      return global.ProjectMapRuntimeLensUi;
    }
    if (typeof require === 'function') {
      try {
        return require('./runtime_lens_ui.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
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
    global.ProjectMapSystemUiRegionEditor = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
