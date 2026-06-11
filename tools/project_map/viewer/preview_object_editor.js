(function initProjectMapPreviewObjectEditor(global) {
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

  const LARGE_EVENT_CHOICE_LIMIT = 28;
  const LARGE_EVENT_BRANCH_LIMIT = 32;
  const LARGE_EVENT_CHOICE_THRESHOLD = 36;
  const LARGE_EVENT_BRANCH_THRESHOLD = 48;
  const LARGE_EVENT_STRUCTURE_THRESHOLD = 360;
  let cachedStructureUi = null;
  let cachedChoicePathModel = null;
  let cachedMetadataUi = null;
  let cachedOpeningContextUi = null;
  let cachedFieldPresentation = null;
  let cachedSemanticOperations = null;
  let cachedAssetEditorUi = null;
  let branchSectionGroupsCallCount = 0;

  function perfApi() {
    if (global && global.ProjectMapCardBoardPerf) {
      return global.ProjectMapCardBoardPerf;
    }
    if (typeof require === 'function') {
      try {
        return require('./card_board_perf.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function perfMeasure(name, fn, detail) {
    const api = perfApi();
    return api && typeof api.measure === 'function' ? api.measure(name, fn, detail || {}) : fn();
  }

  function perfRecord(name, value, detail) {
    const api = perfApi();
    if (api && typeof api.record === 'function') {
      api.record(name, Number(value) || 0, detail || {});
    }
  }

  const api = {
    render,
    renderModal,
    renderModalPreviewPane,
    renderPreviewPane,
    renderTextBlocks,
    renderConditionalAlternatives,
    renderEventReviewDetailsPanels,
    hydrateLazyReviewDetails
  };

  if (global) {
    global.ProjectMapPreviewObjectEditor = api;
  }

  function render(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const body = model && model.eventBody || {};
    const kind = editorKind(model, opts);
    const title = titleText(body, model, kind);
    const source = sourceLabel(model);
    return [
      '<section class="preview-object-editor is-' + escapeAttr(kind) + '" data-preview-object-editor="true" data-preview-object-editor-kind="' + escapeAttr(kind) + '" data-object-canvas-preview-editor="true">',
      '<header class="preview-object-editor-header">',
      '<div>',
      '<span>' + escapeHtml(t('previewObjectEditor.eyebrow', 'Visible object editor')) + '</span>',
      '<h3 data-preview-object-editor-title="true">' + renderTextInline(title || labelForKind(kind)) + '</h3>',
      '<p>' + escapeHtml(subtitleForKind(kind)) + '</p>',
      '</div>',
      '<dl>',
      '<dt>' + escapeHtml(t('previewObjectEditor.kind', 'Kind')) + '</dt><dd>' + escapeHtml(labelForKind(kind)) + '</dd>',
      '<dt>' + escapeHtml(t('existingScene.source', 'Source')) + '</dt><dd>' + escapeHtml(source || t('previewObjectEditor.sourceDraft', 'Draft / generated target')) + '</dd>',
      '</dl>',
      '</header>',
      renderKindEditor(kind, body, model),
      renderEditorSummary(model, kind),
      '</section>'
    ].join('');
  }

  // Resolve the off-budget insert sibling: browser global, else require() (so Node
  // check harnesses loading only this module still get the insert chip renderers).
  function objectEditorInserts() {
    if (global && global.ProjectMapObjectEditorInserts) { return global.ProjectMapObjectEditorInserts; }
    try { return require('./object_editor_inserts.js'); } catch (_err) { return null; }
  }

  // Same resolution for the off-budget flat-condition row builder sibling.
  function objectEditorConditionBuilder() {
    if (global && global.ProjectMapObjectEditorConditionBuilder) { return global.ProjectMapObjectEditorConditionBuilder; }
    try { return require('./object_editor_condition_builder.js'); } catch (_err) { return null; }
  }

  // Same resolution for the off-budget deferred-row source-slice entry sibling.
  function objectEditorDeferredSlice() {
    if (global && global.ProjectMapObjectEditorDeferredSlice) { return global.ProjectMapObjectEditorDeferredSlice; }
    try { return require('./object_editor_deferred_slice.js'); } catch (_err) { return null; }
  }

  function objectEditorOvercapSlice() {
    if (global && global.ProjectMapObjectEditorOvercapSlice) { return global.ProjectMapObjectEditorOvercapSlice; }
    try { return require('./object_editor_overcap_slice.js'); } catch (_err) { return null; }
  }

  function renderModal(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const body = model && model.eventBody || {};
    const modalInserts = objectEditorInserts();
    if (modalInserts) { modalInserts.setEventContext(body); }
    const kind = editorKind(model, opts);
    const title = titleText(body, model, kind);
    const source = sourceLabel(model);
    const expanded = Boolean(opts.previewExpanded);
    const expandLabel = expanded
      ? t('previewObjectEditor.collapsePreview', 'Collapse preview')
      : t('previewObjectEditor.expandPreview', 'Expand preview');
    return [
      '<div class="object-editing-modal-backdrop' + (expanded ? ' is-preview-expanded' : '') + '" data-object-editing-modal="true" data-object-editing-modal-kind="' + escapeAttr(kind) + '" data-object-editing-preview-expanded="' + (expanded ? 'true' : 'false') + '">',
      '<section class="object-editing-modal-dialog' + (expanded ? ' is-preview-expanded' : '') + '" role="dialog" aria-modal="true" aria-label="' + escapeAttr(t('previewObjectEditor.modalTitle', 'Object editor')) + '">',
      '<header class="object-editing-modal-header">',
      '<div>',
      '<span>' + escapeHtml(t('previewObjectEditor.eyebrow', 'Visible object editor')) + '</span>',
      '<h3 data-preview-object-editor-title="true">' + renderTextInline(title || labelForKind(kind)) + '</h3>',
      '<p>' + escapeHtml(subtitleForKind(kind)) + '</p>',
      '</div>',
      '<div class="object-editing-modal-header-actions">',
      '<button type="button" data-object-canvas-action="toggle_preview_expanded" aria-pressed="' + (expanded ? 'true' : 'false') + '">' + escapeHtml(expandLabel) + '</button>',
      '<button type="button" data-object-canvas-action="toggle_overlay" aria-label="' + escapeAttr(t('previewObjectEditor.close', 'Close editor')) + '">' + escapeHtml(t('previewObjectEditor.close', 'Close editor')) + '</button>',
      '</div>',
      '</header>',
      '<div class="object-editing-modal-grid">',
      '<section class="object-editing-preview-pane" data-object-editing-modal-preview-pane="true" data-preview-pane-mode="preview">',
      renderPreviewPaneWithPlay(model, opts),
      '</section>',
      '<div class="object-editing-modal-resizer" data-object-canvas-resizer="object_editor" role="separator" aria-orientation="vertical" aria-label="' + escapeAttr(t('previewObjectEditor.resizePanes', 'Resize editor panes')) + '" title="' + escapeAttr(t('previewObjectEditor.resizePanes', 'Resize editor panes')) + '"></div>',
      '<section class="object-editing-fields-pane preview-object-editor" data-preview-object-editor="true" data-preview-object-editor-kind="' + escapeAttr(kind) + '" data-object-canvas-preview-editor="true">',
      '<header class="preview-object-editor-header object-editing-fields-header">',
      '<div>',
      '<span>' + escapeHtml(t('previewObjectEditor.fieldsEyebrow', 'Editable fields')) + '</span>',
      '<h3>' + escapeHtml(labelForKind(kind)) + '</h3>',
      '<p>' + escapeHtml(t('previewObjectEditor.fieldsHint', 'Change the fields here; the preview updates beside it.')) + '</p>',
      '</div>',
      '<dl>',
      '<dt>' + escapeHtml(t('previewObjectEditor.kind', 'Kind')) + '</dt><dd>' + escapeHtml(labelForKind(kind)) + '</dd>',
      '<dt>' + escapeHtml(t('existingScene.source', 'Source')) + '</dt><dd>' + escapeHtml(source || t('previewObjectEditor.sourceDraft', 'Draft / generated target')) + '</dd>',
      '</dl>',
      '</header>',
      (global && global.ProjectMapObjectEditorFind ? global.ProjectMapObjectEditorFind.renderFindToolbar(body) : ''),
      renderKindEditor(kind, body, model),
      renderEditorSummary(model, kind),
      renderModalActions(model),
      '</section>',
      '</div>',
      '</section>',
      '</div>'
    ].join('');
  }

  function renderModalPreviewPane(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const body = model && model.eventBody || {};
    const kind = editorKind(model, opts);
    if (!opts.previewExpanded && kind === 'event' && largeModalEventPlan(body)) {
      return renderLargeEventModalPreview(body, model);
    }
    return renderPreviewPane(model, opts);
  }

  // ---- play simulator (approximate inline dry-run) ----
  // Rendering lives in object_play_simulator_ui.js; these thin wrappers keep
  // this module's public api stable while delegating the markup there.

  function renderPreviewPaneWithPlay(model, options) {
    const previewHtml = renderModalPreviewPane(model, options && typeof options === 'object' ? options : {});
    let ui = global && global.ProjectMapObjectPlaySimulatorUi;
    if (!ui && typeof require === 'function') {
      try { ui = require('./object_play_simulator_ui.js'); } catch (_err) { ui = null; }
    }
    return ui && typeof ui.renderPaneWithPlay === 'function'
      ? ui.renderPaneWithPlay(previewHtml, model && model.eventBody || {}, model)
      : previewHtml;
  }

  function largeModalEventPlan(body) {
    if (largeEventRenderPlan(body)) {
      return true;
    }
    const flowAddCount = ensureArray(body && body.assetAddFields).filter(isFlowAssetAddField).length;
    const flowSurfaceCount = ensureArray(body && body.options).length + ensureArray(body && body.branchSections).length;
    return flowAddCount > 20 || flowSurfaceCount > 20;
  }

  function renderLargeEventModalPreview(body, model) {
    const value = body && typeof body === 'object' ? body : {};
    const sections = ensureArray(value.sections);
    const options = ensureArray(value.options);
    const branches = ensureArray(value.branchSections);
    const assets = ensureArray(value.assets);
    const audioAssetCount = assets.filter(function (a) { return a && (a.type === 'audio' || /audio|music/.test(String(a.role || ''))); }).length;
    const chips = [
      sections.length ? t('previewObjectEditor.flowSections', 'Sections') + ': ' + sections.length : '',
      options.length ? t('previewObjectEditor.flowOptions', 'Options') + ': ' + options.length : '',
      branches.length ? t('previewObjectEditor.branchText', 'Conditional and follow-up text') + ': ' + branches.length : '',
      assets.length ? t('previewObjectEditor.assets', 'Referenced assets') + ': ' + assets.length : ''
    ].filter(Boolean);
    if (audioAssetCount) {
      chips.push('♫ ' + t('previewObjectEditor.audioAssets', 'Audio') + ': ' + audioAssetCount);
    }
    return [
      '<article class="object-editing-live-preview object-editing-event-preview is-large-summary" data-object-editing-large-preview-summary="true">',
      '<div class="object-editing-preview-kicker">' + escapeHtml(t('objectPreview.event', 'World Event')) + '</div>',
      renderPreviewHeading(value.title || value.heading, model, 'title', fieldValue(value.title || value.heading) || model && model.title || t('objectPreview.event', 'World Event'), 'h4'),
      chips.length ? '<div class="object-editing-preview-metadata">' + chips.map((chip) => '<span class="object-editing-preview-metadata-chip">' + escapeHtml(chip) + '</span>').join('') + '</div>' : '',
      sections.length ? '<div class="object-editing-preview-copy" data-object-editing-preview-sections="summary">' + sections.slice(0, 2).map((field) => '<section class="object-editing-preview-section">' + renderStudioRoleLabel(previewSectionLabel(field)) + renderTextBlocks(fieldValue(field), {empty: false, assetBaseUrl: value.assetBaseUrl || ''}) + '</section>').join('') + '</div>' : '',
      renderFlowOverview(value.flow, model, 'preview'),
      assetEditorUi().renderPreviewAssets(assets, 'event', {
        assetCatalog: value.assetCatalog,
        assetAddFields: value.assetAddFields,
        showAddControls: false,
        showReplacementControls: false
      }),
      '<button type="button" class="object-canvas-expand-preview-btn" data-object-canvas-action="toggle_preview_expanded">' + escapeHtml(t('previewObjectEditor.expandPreview', 'Expand preview')) + '</button>',
      '</article>'
    ].join('');
  }

  function renderPreviewPane(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const body = model && model.eventBody || {};
    const kind = editorKind(model, opts);
    if (kind === 'card') {
      return renderCardPreview(body, model);
    }
    if (kind === 'news') {
      return renderNewsPreview(body, model);
    }
    if (kind === 'text-replacement') {
      return renderTextReplacementPreview(body, model);
    }
    return renderEventPreview(body, model);
  }

  function renderModalActions(model) {
    const kind = editorKind(model, {});
    const createSimilar = model && model.mode === 'existing' && (kind === 'event' || kind === 'card');
    return [
      '<div class="editing-actions object-editing-modal-actions">',
      '<button type="button" data-object-canvas-action="refresh">' + escapeHtml(t('existingScene.refresh', 'Refresh proposal')) + '</button>',
      createSimilar ? '<button type="button" data-object-canvas-action="create_similar_event" data-create-similar-object="true" data-create-similar-kind="' + escapeAttr(kind) + '">' + escapeHtml(createSimilarLabel(kind, model)) + '</button>' : '',
      '<button type="button" data-object-canvas-action="save">' + escapeHtml(t('editing.saveToChanges', 'Save to My Changes')) + '</button>',
      '<button class="primary-action" type="button" data-object-canvas-action="review">' + escapeHtml(t('existingScene.review', 'Review & Apply')) + '</button>',
      '</div>'
    ].join('');
  }

  function createSimilarLabel(kind) {
    if (kind === 'card') {
      return t('previewObjectEditor.createSimilarCard', 'Create similar card');
    }
    return t('previewObjectEditor.createSimilarEvent', 'Create similar event');
  }

  function renderEventPreview(body, model) {
    const previewBody = structureUi().bodyWithPendingStructure(body);
    const sections = ensureArray(previewBody.sections);
    const branchSections = ensureArray(previewBody.branchSections);
    const options = ensureArray(previewBody.options);
    const assets = ensureArray(previewBody.assets);
    return [
      '<article class="object-editing-live-preview object-editing-event-preview">',
      '<div class="object-editing-preview-kicker">' + escapeHtml(t('objectPreview.event', 'World Event')) + '</div>',
      renderPreviewHeading(previewBody.title || previewBody.heading, model, 'title', fieldValue(previewBody.title || previewBody.heading) || model && model.title || t('objectPreview.event', 'World Event'), 'h4'),
      previewBody.subtitle && fieldValue(previewBody.subtitle) ? renderPreviewHeading(previewBody.subtitle, model, 'subtitle', fieldValue(previewBody.subtitle), 'em') : '',
      previewBody.heading && fieldId(previewBody.heading) !== fieldId(previewBody.title) ? renderPreviewHeading(previewBody.heading, model, 'heading', fieldValue(previewBody.heading), 'h5') : '',
      metadataUi().renderChips(previewBody.metaFields, model),
      sections.length ? renderPreviewSections(sections, previewBody, model) : renderEmpty(t('objectPreview.noPreview', 'No preview text')),
      renderPreviewChoices(options, 'event', previewBody, model),
      renderFlowOverview(previewBody.flow, model, 'preview'),
      eventBuilderUi().renderChoiceUnitSummary(previewBody.choiceUnits),
      eventBuilderUi().renderConsequenceGroups(previewBody.consequenceGroups),
      eventBuilderUi().renderContinuationMap(previewBody.continuationMap),
      eventBuilderUi().renderPlayabilityChecks(previewBody.playabilityChecks),
      renderPreviewBranches(branchSections, previewTextOptions(previewBody, model), model, previewBody),
      assetEditorUi().renderPreviewAssets(assets, 'event', {
        assetCatalog: previewBody.assetCatalog,
        assetAddFields: previewBody.assetAddFields,
        forcePanel: model && model.mode !== 'existing',
        showControls: model && model.mode !== 'existing',
        showAddControls: model && model.mode === 'existing',
        showReplacementControls: model && model.mode === 'existing'
      }),
      renderPreviewEffects(previewBody, model),
      renderPreviewVariables(previewBody.variables, model),
      '</article>'
    ].join('');
  }

  function renderNewsPreview(body, model) {
    const sections = ensureArray(body.sections);
    return [
      '<article class="object-editing-live-preview object-editing-news-preview">',
      '<div class="object-editing-preview-kicker">' + escapeHtml(t('objectPreview.news', 'News')) + '</div>',
      '<h4>' + renderTextInline(fieldValue(body.title) || model && model.title || t('objectPreview.news', 'News')) + '</h4>',
      sections.length ? '<div class="object-editing-preview-copy">' + sections.map((field) => renderTextBlocks(fieldValue(field), {empty: false})).join('') + '</div>' : renderEmpty(t('objectPreview.noPreview', 'No preview text')),
      '</article>'
    ].join('');
  }

  function renderCardPreview(body, model) {
    const sections = ensureArray(body.sections);
    const branchSections = ensureArray(body.branchSections);
    const subtitle = firstField(sections, /subtitle/i);
    const mainSections = sections.filter((field) => field !== subtitle);
    return [
      '<article class="object-editing-live-preview object-editing-card-preview">',
      '<div class="object-editing-preview-kicker">' + escapeHtml(t('objectPreview.card', 'Card')) + '</div>',
      renderPreviewHeading(body.title || body.heading, model, 'title', fieldValue(body.title || body.heading) || model && model.title || t('objectPreview.card', 'Card'), 'h4'),
      subtitle ? renderPreviewHeading(subtitle, model, 'subtitle', fieldValue(subtitle), 'em') : '',
      metadataUi().renderChips(body.metaFields, model),
      mainSections.length ? '<div class="object-editing-preview-copy">' + mainSections.map((field) => [
        '<section class="object-editing-preview-section"' + renderedEntryAttrs(actionForField(field, 'text', model, {role: 'body'}), 'text', t('previewObjectEditor.editRenderedText', 'Edit preview text')) + '>',
        renderTextBlocks(fieldValue(field), {empty: false}),
        renderActionContextLens(actionForField(field, 'text', model, {role: 'body'}), 'text'),
        '</section>'
      ].join('')).join('') + '</div>' : renderEmpty(t('objectPreview.empty', 'No player-facing text is available yet.')),
      renderPreviewChoices(ensureArray(body.options), 'card', body, model),
      renderPreviewBranches(branchSections, previewTextOptions(body, model), model, body),
      assetEditorUi().renderPreviewAssets(body.assets, 'card', {
        assetCatalog: body.assetCatalog,
        assetAddFields: body.assetAddFields,
        forcePanel: model && model.mode !== 'existing',
        showControls: model && model.mode !== 'existing',
        showAddControls: model && model.mode === 'existing',
        showReplacementControls: model && model.mode === 'existing'
      }),
      renderPreviewEffects(body, model),
      renderPreviewVariables(body.variables, model),
      '</article>'
    ].join('');
  }

  function renderPreviewHeading(field, model, role, value, tag) {
    const name = /^(h4|h5|em)$/.test(String(tag || '')) ? tag : 'h4';
    const action = actionForField(field, 'text', model, {role});
    return '<' + name + renderedEntryAttrs(action, 'text', t('previewObjectEditor.editRenderedText', 'Edit preview text')) + '>' + renderTextInline(value || '') + renderActionContextLens(action, 'text') + '</' + name + '>';
  }

  function renderPreviewVariables(variables, model) {
    const rows = ensureArray(variables).filter((variable) => variable && variable.name).slice(0, 12);
    if (!rows.length) {
      return '';
    }
    return [
      '<details class="object-editing-preview-variables" data-object-editing-preview-variables="true">',
      '<summary>' + escapeHtml(t('previewObjectEditor.stateVariables', 'State variables')) + ' <b>' + escapeHtml(String(rows.length)) + '</b></summary>',
      '<div>',
      rows.map((variable) => {
        const reads = ensureArray(variable && variable.reads).length;
        const writes = ensureArray(variable && variable.writes).length;
        const detail = [
          reads ? t('previewObjectEditor.reads', 'reads') + ' ' + reads : '',
          writes ? t('previewObjectEditor.writes', 'writes') + ' ' + writes : ''
        ].filter(Boolean).join(' / ');
        return [
          '<article' + renderedEntryAttrs(actionForVariable(variable && variable.name, model), 'variable', t('previewObjectEditor.editRenderedVariable', 'Edit variable')) + '>',
          '<strong>Q.' + escapeHtml(variable && variable.name || '') + '</strong>',
          detail ? '<small>' + escapeHtml(detail) + '</small>' : '',
          renderActionContextLens(actionForVariable(variable && variable.name, model), 'variable'),
          '</article>'
        ].join('');
      }).join(''),
      '</div>',
      '</details>'
    ].join('');
  }

  function renderTextReplacementPreview(body, model) {
    const sections = ensureArray(body.sections);
    const original = firstField(sections, /original|before/i) || {};
    const replacement = body.title || fallbackField('surface.replacementLabel', t('objectPreview.after', 'After'), model && model.title);
    return [
      '<article class="object-editing-live-preview object-editing-text-preview">',
      '<div class="object-editing-preview-kicker">' + escapeHtml(t('objectPreview.textPatch', 'Text Patch')) + '</div>',
      '<div class="object-editing-preview-before-after">',
      '<div><span>' + escapeHtml(t('objectPreview.before', 'Before')) + '</span>' + renderTextBlocks(fieldValue(original), {empty: false}) + '</div>',
      '<div><span>' + escapeHtml(t('objectPreview.after', 'After')) + '</span>' + renderTextBlocks(fieldValue(replacement), {empty: false}) + '</div>',
      '</div>',
      sourceLabel(model) ? '<small class="object-editing-preview-source">' + escapeHtml(sourceLabel(model)) + '</small>' : '',
      '</article>'
    ].join('');
  }

  function renderPreviewSections(sections, body, model) {
    const opts = previewTextOptions(body, model);
    // Mirror the editor: hide flat conditional-leaf rows the ladder already owns
    // and show one read-only condition -> text ladder for the owning field.
    const visibleSections = ensureArray(sections).filter((field) => !ladderOwnsLeafField(field, body));
    return [
      '<div class="object-editing-preview-copy" data-object-editing-preview-sections="true">',
      visibleSections.map((field) => {
        const visualLabel = visualKindsLabel(field && field.visualKinds);
        const action = actionForField(field, 'text', model, {role: 'body'});
        return [
          '<section class="object-editing-preview-section" data-preview-visual-kind="' + escapeAttr(visualLabel ? ensureArray(field.visualKinds).join(' ') : 'text') + '"' + renderedEntryAttrs(action, 'text', t('previewObjectEditor.editRenderedText', 'Edit preview text')) + '>',
          renderStudioRoleLabel(previewSectionLabel(field)),
          visualLabel ? '<small>' + escapeHtml(visualLabel) + '</small>' : '',
          renderTextBlocks(fieldValue(field), Object.assign({empty: false}, opts)),
          renderConditionalAlternatives(field, {assetBaseUrl: opts.assetBaseUrl, readOnly: true}),
          assetEditorUi().renderInlineAssetPlacements(assetsForBranch(field, body), assetAddFieldsForBranch(field, body), editorKind(model, body), body, model, {
            showAddControls: false,
            showReplacementControls: false
          }),
          renderActionContextLens(action, 'text'),
          '</section>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderPreviewChoices(options, owner, body, model) {
    const rows = ensureArray(options);
    if (!rows.length) {
      return '';
    }
    const tree = owner === 'event' ? choiceTreePlan(rows, body) : null;
    const sectionRootRows = tree && !tree.rootRows.length ? tree.rootSectionRows : [];
    const renderRows = sectionRootRows.length ? sectionRootRows : (tree ? tree.rootRows : rows);
    return [
      '<div class="object-editing-preview-options' + (tree ? ' is-player-path-layout' : '') + '" data-object-editing-preview-options="true"' + (tree ? ' data-object-editing-preview-choice-layout="player_path"' : '') + '>',
      '<span class="object-editing-preview-group-label">' + escapeHtml(t('previewObjectEditor.playerChoices', 'Player choices')) + '</span>',
      renderRows.map((item, index) => {
        return item && item.__sectionRoot
          ? renderPreviewChoiceSectionRoot(item, owner, body, model, tree, {depth: 0, visited: [], renderedSections: new Set()})
          : renderPreviewChoiceBranch(item, index, owner, body, model, tree, {depth: 0, visited: [], renderedSections: new Set()});
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderPreviewChoiceSectionRoot(item, owner, body, model, tree, context) {
    const section = item && item.section || {};
    const sectionId = normalizeEndpointToken(section && section.id || item && item.id);
    return [
      '<div class="object-editing-preview-choice-branch is-section-root" data-object-editing-preview-choice-section-root="' + escapeAttr(sectionId) + '" data-preview-object-choice-depth="' + escapeAttr(String(context && context.depth || 0)) + '">',
      renderPreviewNestedSection(section, ensureArray(item && item.children), owner, body, model, tree, Object.assign({}, context || {}, {
        visited: ensureArray(context && context.visited).concat(sectionId).filter(Boolean)
      })),
      '</div>'
    ].join('');
  }

  function renderPreviewChoiceBranch(option, index, owner, body, model, tree, context) {
    const ctx = context || {};
    const sectionId = tree ? nextChoiceSectionId(option, body) : '';
    const normalized = normalizeEndpointToken(sectionId);
    const renderedSections = renderedChoiceSections(ctx);
    const visited = ensureArray(ctx.visited).map(normalizeEndpointToken).filter(Boolean);
    const repeated = Boolean(normalized && visited.includes(normalized)) || Number(ctx.depth || 0) >= 6;
    const childRows = tree && normalized ? ensureArray(tree.childrenBySection && tree.childrenBySection[normalized]) : [];
    const section = tree && normalized ? tree.sectionGroups && tree.sectionGroups[normalized] : null;
    const sharedSectionRendered = Boolean(normalized && renderedSections.has(normalized));
    const optionKey = normalizeEndpointToken(option && (option.id || option.optionId));
    const optionRouteOutcomes = tree && !section && optionKey ? ensureArray(tree.routeOutcomesByOption && tree.routeOutcomesByOption[optionKey]) : [];
    const nextVisited = normalized ? visited.concat([normalized]) : visited;
    const choiceHtml = renderPreviewChoiceCard(option, index, owner, body, model, {
      suppressResultSection: (section || sharedSectionRendered) ? normalized : ''
    });
    if (!section && !sharedSectionRendered && choiceHasResultForSection(option, normalized)) {
      renderedSections.add(normalized);
    }
    return [
      '<div class="object-editing-preview-choice-branch" data-object-editing-preview-choice-branch="' + escapeAttr(option && (option.id || option.optionId) || String(index + 1)) + '" data-preview-object-choice-depth="' + escapeAttr(String(ctx.depth || 0)) + '">',
      choiceHtml,
      optionRouteOutcomes.length ? renderPreviewRouteOutcomeBranches(optionRouteOutcomes, owner, body, model, tree, {
        depth: Number(ctx.depth || 0) + 1,
        visited: nextVisited,
        renderedSections,
        repeated
      }) : '',
      section ? (sharedSectionRendered
        ? renderPreviewSharedSectionReference(section, normalized)
        : renderPreviewNestedSection(section, childRows, owner, body, model, tree, {
          depth: Number(ctx.depth || 0) + 1,
          visited: nextVisited,
          renderedSections,
          repeated
        })) : (sharedSectionRendered && childRows.length ? renderPreviewSharedSectionReference({id: normalized, label: normalized}, normalized) : ''),
      !section && childRows.length && !repeated && !sharedSectionRendered ? renderPreviewChoiceChildren(childRows, owner, body, model, tree, {
        depth: Number(ctx.depth || 0) + 1,
        visited: nextVisited,
        renderedSections
      }) : '',
      repeated ? '<small class="object-editing-preview-choice-loop">' + escapeHtml(t('previewObjectEditor.choiceLoopOrReturn', 'Loop or return route; nested choices stop here.')) + '</small>' : '',
      '</div>'
    ].join('');
  }

  function renderPreviewNestedSection(section, childRows, owner, body, model, tree, context) {
    const ctx = context || {};
    const renderedSections = renderedChoiceSections(ctx);
    const sectionId = normalizeEndpointToken(section && section.id);
    if (sectionId) {
      renderedSections.add(sectionId);
    }
    const fields = ensureArray(section && section.fields);
    const visibleFields = fields.filter((field) => !isSectionLogicField(field));
    const routeOutcomes = tree && section && section.id ? ensureArray(tree.routeOutcomesBySection && tree.routeOutcomesBySection[normalizeEndpointToken(section.id)]) : [];
    return [
      '<section class="object-editing-preview-nested-section" data-object-editing-preview-nested-section="' + escapeAttr(section && section.id || '') + '">',
      '<header>',
      '<span>' + escapeHtml(t('previewObjectEditor.choiceResultStep', 'Result / next step')) + '</span>',
      '<strong>' + escapeHtml(section && (section.label || section.id) || t('previewObjectEditor.sceneStep', 'Scene step')) + '</strong>',
      section && section.condition ? '<code>' + escapeHtml(section.condition) + '</code>' : '',
      '</header>',
      visibleFields.map((field) => renderPreviewBranchField(field, body, model)).join(''),
      routeOutcomes.length && !ctx.repeated ? renderPreviewRouteOutcomeBranches(routeOutcomes, owner, body, model, tree, ctx) : '',
      ensureArray(childRows).length && !ctx.repeated ? renderPreviewChoiceChildren(childRows, owner, body, model, tree, ctx) : '',
      '</section>'
    ].join('');
  }

  function renderPreviewRouteOutcomeBranches(outcomes, owner, body, model, tree, context) {
    const rows = ensureArray(outcomes).filter(Boolean);
    if (!rows.length) {
      return '';
    }
    return [
      '<section class="object-editing-preview-route-outcomes" data-object-editing-preview-route-outcomes="true">',
      '<div class="object-editing-preview-route-outcomes-title">' + escapeHtml(t('previewObjectEditor.routeOutcomes', 'Route outcomes')) + '</div>',
      rows.map((outcome) => renderPreviewRouteOutcome(outcome, owner, body, model, tree, context)).join(''),
      '</section>'
    ].join('');
  }

  function renderPreviewRouteOutcome(outcome, owner, body, model, tree, context) {
    const section = outcome && outcome.section || null;
    const fields = ensureArray(section && section.fields);
    const visibleFields = fields.filter((field) => !isSectionLogicField(field));
    const childRows = tree && outcome && outcome.targetKey ? ensureArray(tree.childrenBySection && tree.childrenBySection[outcome.targetKey]) : [];
    const predicateField = outcome && outcome.predicateField;
    const ctx = context || {};
    const renderedSections = renderedChoiceSections(ctx);
    const visited = ensureArray(ctx.visited).map(normalizeEndpointToken).filter(Boolean);
    const targetKey = normalizeEndpointToken(outcome && outcome.targetKey);
    const sharedSectionRendered = Boolean(section && targetKey && renderedSections.has(targetKey));
    const repeated = Boolean(targetKey && visited.includes(targetKey)) || Boolean(ctx.repeated);
    const nextCtx = Object.assign({}, ctx, {
      depth: Number(ctx.depth || 0) + 1,
      visited: targetKey ? visited.concat([targetKey]) : visited,
      renderedSections,
      repeated
    });
    if (section && targetKey && !sharedSectionRendered && !repeated) {
      renderedSections.add(targetKey);
    }
    return [
      '<article class="object-editing-preview-route-outcome" data-object-editing-preview-route-outcome="' + escapeAttr(outcome && outcome.targetKey || '') + '">',
      '<header>',
      '<span>' + escapeHtml(t('previewObjectEditor.conditionalOutcome', 'Conditional outcome')) + '</span>',
      '<strong>' + escapeHtml(section && (section.label || section.id) || outcome && (outcome.label || outcome.targetKey) || '') + '</strong>',
      outcome && outcome.condition ? '<code' + renderedEntryAttrs(actionForField(predicateField, 'condition', model, {role: 'route-outcome-condition'}), 'condition', t('previewObjectEditor.editRenderedImpact', 'Edit impact')) + '>' + escapeHtml(t('previewObjectEditor.when', 'When') + ': ' + outcome.condition) + '</code>' : '',
      '</header>',
      sharedSectionRendered ? renderPreviewSharedSectionReference(section, targetKey) : '',
      !sharedSectionRendered ? visibleFields.map((field) => renderPreviewBranchField(field, body, model)).join('') : '',
      childRows.length && !repeated && !sharedSectionRendered ? renderPreviewChoiceChildren(childRows, owner, body, model, tree, nextCtx) : '',
      repeated ? '<small class="object-editing-preview-choice-loop">' + escapeHtml(t('previewObjectEditor.choiceLoopOrReturn', 'Loop or return route; nested choices stop here.')) + '</small>' : '',
      '</article>'
    ].join('');
  }

  function renderPreviewChoiceChildren(rows, owner, body, model, tree, context) {
    return [
      '<div class="object-editing-preview-choice-children" data-object-editing-preview-choice-children="true">',
      ensureArray(rows).map((option, index) => renderPreviewChoiceBranch(option, index, owner, body, model, tree, context || {})).join(''),
      '</div>'
    ].join('');
  }

  function renderPreviewSharedSectionReference(section, sectionId) {
    const label = section && (section.label || section.id) || sectionId || '';
    return [
      '<aside class="object-editing-preview-shared-section" data-object-editing-preview-shared-section="' + escapeAttr(sectionId || '') + '">',
      '<strong>' + escapeHtml(t('previewObjectEditor.sharedChoiceStep', 'Shared step')) + '</strong>',
      '<span>' + escapeHtml(label) + '</span>',
      '</aside>'
    ].join('');
  }

  function renderPreviewBranchField(field, body, model) {
    const opts = previewTextOptions(body, model);
    return [
      '<article class="object-editing-preview-nested-text" data-preview-branch-role="' + escapeAttr(field && (field.semanticRole || field.branchKind) || 'branch') + '"' + renderedEntryAttrs(actionForField(field, 'result', model, {role: 'branch'}), 'result', t('previewObjectEditor.editRenderedResult', 'Edit result text')) + '>',
      renderStudioRoleLabel(branchLabel(field)),
      branchConditionText(field) ? '<small>' + escapeHtml(branchConditionText(field)) + '</small>' : '',
      renderTextBlocks(fieldValue(field), {empty: false, assetBaseUrl: opts.assetBaseUrl || ''}),
      renderConditionalAlternatives(field, opts),
      assetEditorUi().renderInlineAssetPlacements(assetsForBranch(field, body), assetAddFieldsForBranch(field, body), editorKind(model, body), body, model, {
        showAddControls: false,
        showReplacementControls: false
      }),
      renderActionContextLens(actionForField(field, 'result', model, {role: 'branch'}), 'result'),
      '</article>'
    ].join('');
  }

  function renderPreviewEffects(body, model) {
    const rows = previewEffectRows(body, model);
    if (!rows.length) {
      return '';
    }
    return [
      '<div class="object-editing-preview-effects" data-object-editing-preview-effects="true">',
      '<span class="object-editing-preview-group-label">' + escapeHtml(t('previewObjectEditor.effectsAndImpact', 'Effects and impact')) + ' <b>' + escapeHtml(String(rows.length)) + '</b></span>',
      '<ul>',
      rows.map((row) => [
        '<li data-preview-effect-kind="' + escapeAttr(row.kind || 'effect') + '"' + renderedEntryAttrs(row.action, 'effect', t('previewObjectEditor.editRenderedEffect', 'Edit effect')) + '>',
        '<strong>' + escapeHtml(row.label) + '</strong>',
        '<code>' + escapeHtml(row.value) + '</code>',
        row.context ? '<small>' + escapeHtml(row.context) + '</small>' : '',
        renderActionContextLens(row.action, 'effect'),
        '</li>'
      ].join('')).join(''),
      '</ul>',
      '</div>'
    ].join('');
  }

  function previewEffectRows(body, model) {
    const rows = [];
    const seen = new Set();
    ensureArray(body && body.effects).forEach((field) => {
      const value = fieldValue(field).trim();
      if (!value) {
        return;
      }
      pushPreviewEffect(rows, seen, {
        kind: 'trigger',
        label: effectHookLabel(field) || t('previewObjectEditor.triggerEffects', 'Trigger effects'),
        value,
        context: sourceLabelFromRef(field && field.source),
        action: actionForField(field, 'effect', model, {role: 'trigger_effect'})
      });
    });
    ensureArray(body && body.optionEffects).forEach((group) => {
      ensureArray(group && group.fields).forEach((field) => {
        const value = fieldValue(field).trim();
        if (!value) {
          return;
        }
        pushPreviewEffect(rows, seen, {
          kind: 'choice',
          label: (group && (group.label || group.id))
            ? t('previewObjectEditor.choiceEffects', 'Choice effects') + ': ' + endpointDisplay(group.label || group.id, model)
            : t('previewObjectEditor.choiceEffects', 'Choice effects'),
          value,
          context: sourceLabelFromRef(field && field.source),
          action: actionForField(field, 'effect', model, {role: 'option_effect', optionId: group && group.id})
        });
      });
    });
    ensureArray(body && body.backgroundEffects).forEach((effect) => {
      const value = effectExpressionLabel(effect);
      if (!value) {
        return;
      }
      pushPreviewEffect(rows, seen, {
        kind: 'background',
        label: effectHookLabel(effect) || t('previewObjectEditor.backgroundEffects', 'Background writes'),
        value,
        context: sourceLabelFromRef(effect && effect.source),
        action: actionForEffect(effect, model, {role: 'background_effect'})
      });
    });
    ensureArray(body && body.pendingStructureRemovals).forEach((removal) => {
      const action = String(removal && removal.action || '');
      if (action !== 'remove_effect') {
        return;
      }
      pushPreviewEffect(rows, seen, {
        kind: 'pending-removal',
        label: t('previewObjectEditor.pendingRemoval', 'Pending manual removal'),
        value: String(removal && removal.before || removal && removal.label || '').trim(),
        context: String(removal && removal.label || '').trim()
      });
    });
    return rows;
  }

  function pushPreviewEffect(rows, seen, row) {
    const value = String(row && row.value || '').trim();
    if (!value) {
      return;
    }
    const key = [row.kind || '', row.label || '', value].join('|');
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    rows.push(row);
  }

  function renderPreviewChoiceCard(option, index, owner, body, model, renderOptions) {
    const fields = ensureArray(option && option.fields);
    const opts = renderOptions || {};
    const label = choiceLabelField(option, fields, owner, index);
    const resultFields = choiceCardResultFields(option, fields, opts.suppressResultSection);
    const impacts = optionImpactRows(option, body, resultFields, model);
    const conditionRows = optionConditionSummaries(option, resultFields);
    const pendingRemoval = pendingRemovalForOption(option, body);
    const pendingAddition = Boolean(option && option.isPendingStructure);
    return [
      '<article class="object-editing-preview-choice-card' + (pendingRemoval ? ' is-pending-removal' : '') + (pendingAddition ? ' is-pending-addition' : '') + '" data-object-editing-preview-choice="' + escapeAttr(option && option.id || String(index + 1)) + '">',
      '<div class="object-editing-preview-choice-head">',
      '<b>' + escapeHtml(String(index + 1)) + '</b>',
      '<button type="button"' + renderedEntryAttrs(actionForField(label, 'option', model, {role: 'option_label', optionId: option && option.id}), 'option', t('previewObjectEditor.editRenderedOption', 'Edit option')) + '>' + renderTextInline(fieldValue(label) || option && option.id || String(index + 1)) + '</button>',
      renderActionContextLens(actionForField(label, 'option', model, {role: 'option_label', optionId: option && option.id}), 'option'),
      pendingRemoval ? '<span class="object-editing-pending-badge">' + escapeHtml(t('previewObjectEditor.pendingRemoval', 'Pending manual removal')) + '</span>' : '',
      !pendingRemoval && pendingAddition ? '<span class="object-editing-pending-badge is-addition">' + escapeHtml(t('previewObjectEditor.pendingAdd', 'Pending addition')) + '</span>' : '',
      '</div>',
      conditionRows.length ? [
        '<div class="object-editing-preview-choice-conditions" data-object-editing-preview-choice-conditions="true">',
        conditionRows.map((condition) => '<span data-condition-kind="' + escapeAttr(condition.kind || 'condition') + '"' + renderedEntryAttrs(actionForCondition(condition, option, resultFields, model), condition.kind || 'condition', t('previewObjectEditor.editRenderedImpact', 'Edit impact')) + '><strong>' + escapeHtml(condition.label) + '</strong><em>' + escapeHtml(condition.value) + '</em>' + renderActionContextLens(actionForCondition(condition, option, resultFields, model), condition.kind || 'condition') + '</span>').join(''),
        '</div>'
      ].join('') : '',
      resultFields.length ? [
        '<div class="object-editing-preview-choice-result" data-object-editing-preview-choice-result="true"' + renderedEntryAttrs(actionForField(resultFields[0], 'result', model, {role: 'option_result', optionId: option && option.id}), 'result', t('previewObjectEditor.editRenderedResult', 'Edit result text')) + '>',
        renderStudioRoleLabel(t('previewObjectEditor.afterChoice', 'After choice')),
        resultFields.map((field) => renderTextBlocks(fieldValue(field), Object.assign({empty: false}, previewTextOptions(body, model)))).join(''),
        assetEditorUi().renderInlineAssetPlacements(assetsForOption(option, body, resultFields), assetAddFieldsForOption(option, body, resultFields), editorKind(model, body), body, model, {
          showAddControls: false,
          showReplacementControls: false
        }),
        renderActionContextLens(actionForField(resultFields[0], 'result', model, {role: 'option_result', optionId: option && option.id}), 'result'),
        '</div>'
      ].join('') : '',
      impacts.length ? [
        '<ul class="object-editing-preview-choice-impacts" data-object-editing-preview-choice-impacts="true">',
        impacts.map((impact) => '<li data-choice-impact-kind="' + escapeAttr(impact.kind || 'impact') + '"' + renderedEntryAttrs(impact.action, impact.kind || 'impact', t('previewObjectEditor.editRenderedImpact', 'Edit impact')) + '><strong>' + escapeHtml(impact.label) + '</strong>' + (impact.value ? '<span>' + escapeHtml(impact.value) + '</span>' : '') + renderActionContextLens(impact.action, impact.kind || 'impact') + '</li>').join(''),
        '</ul>'
      ].join('') : '',
      '</article>'
    ].join('');
  }

  function pendingRemovalForOption(option, body) {
    const optionIds = [
      option && option.id,
      option && option.optionId,
      option && option.targetId,
      option && option.sectionId,
      option && option.rawTargetId
    ].map((value) => safeClass(value || '')).filter(Boolean);
    if (!optionIds.length) {
      return null;
    }
    return ensureArray(body && body.pendingStructureRemovals).find((removal) => {
      if (String(removal && removal.action || '') !== 'remove_option') {
        return false;
      }
      const removalIds = [removal && removal.optionId, removal && removal.sectionId, removal && removal.fieldId]
        .map((value) => safeClass(value || ''))
        .filter(Boolean);
      return removalIds.some((id) => optionIds.includes(id));
    }) || null;
  }

  function optionResultFields(option, fields) {
    const explicit = ensureArray(option && option.resultFields).filter((field) => field && fieldValue(field).trim());
    if (explicit.length) {
      return explicit;
    }
    const body = firstField(ensureArray(fields).filter((field) => {
      return !isChoiceConditionField(field) && !isChoiceRouteField(field) && !isChoiceEffectField(field);
    }), /body|result|narrative/i);
    return body && fieldValue(body).trim() ? [body] : [];
  }

  function optionImpactRows(option, body, resultFields, model) {
    const rows = [];
    const optionTarget = String(option && (option.targetId || option.gotoAfter || '') || '').trim();
    if (optionTarget) {
      rows.push({
        kind: 'route',
        label: t('previewObjectEditor.opensSection', 'Opens'),
        value: endpointDisplay(optionTarget, model),
        action: actionForRoute(option, model, {role: 'option_target', value: optionTarget})
      });
    }
    routeFieldsForOption(option, body, resultFields).forEach((field) => {
      const value = endpointDisplay(fieldValue(field), model);
      if (value) {
        rows.push({
          kind: 'route',
          label: t('previewObjectEditor.continuesTo', 'Continues to'),
          value,
          action: actionForField(field, 'route', model, {role: 'route'})
        });
      }
    });
    optionEffectFields(option, body).forEach((field) => {
      const value = fieldValue(field);
      if (value) {
        rows.push({
          kind: 'effect',
          label: t('previewObjectEditor.choiceEffects', 'Choice effects'),
          value,
          action: actionForField(field, 'effect', model, {role: 'option_effect', optionId: option && option.id})
        });
      }
    });
    optionConsumedVariables(resultFields).forEach((name) => {
      rows.push({
        kind: 'variable',
        label: t('previewObjectEditor.textConsumes', 'text consumes'),
        value: 'Q.' + name,
        action: actionForVariable(name, model)
      });
    });
    optionConditionVariables(resultFields).forEach((name) => {
      rows.push({
        kind: 'variable',
        label: t('previewObjectEditor.conditionReads', 'condition reads'),
        value: 'Q.' + name,
        action: actionForVariable(name, model)
      });
    });
    assetsForOption(option, body, resultFields).forEach((asset) => {
      rows.push({
        kind: 'asset',
        label: t('previewObjectEditor.visualAsset', 'Asset reference'),
        value: asset.label || asset.name || asset.path
      });
    });
    ensureArray(resultFields).forEach((field) => {
      const visual = visualKindsLabel(field && field.visualKinds);
      if (visual) {
        rows.push({
          kind: 'visual',
          label: t('previewObjectEditor.visualContent', 'Visual content'),
          value: visual.replace(/^.*?:\s*/, '')
        });
      }
    });
    return dedupeImpacts(rows).slice(0, 10);
  }

  function routeFieldsForOption(option, body, resultFields) {
    const optionId = normalizeEndpointToken(option && option.id);
    const optionTargets = optionEndpointTokens(option, resultFields);
    return ensureArray(body && body.metaFields).filter((field) => {
      if (String(field && field.role || '') !== 'route') {
        return false;
      }
      const fieldOption = normalizeEndpointToken(field && field.optionId);
      if (fieldOption && fieldOption === optionId) {
        return false;
      }
      const section = normalizeEndpointToken(field && field.sectionId);
      return Boolean(section && optionTargets.includes(section));
    });
  }

  function optionEndpointTokens(option, resultFields) {
    const values = [
      option && option.id,
      option && option.rawTargetId,
      option && option.targetId,
      option && option.sectionId
    ];
    ensureArray(resultFields).forEach((field) => {
      values.push(field && field.sectionId);
    });
    return uniqueStrings(values.map(normalizeEndpointToken).filter(Boolean));
  }

  function optionConditionSummaries(option, resultFields) {
    const rows = [];
    pushSummary(rows, 'section', t('previewObjectEditor.section', 'Section'), option && option.sectionLabel);
    pushSummary(rows, 'choose-if', t('previewObjectEditor.chooseIf', 'Choose if'), option && option.chooseIf);
    pushSummary(rows, 'view-if', t('previewObjectEditor.viewIf', 'View if'), option && option.sectionViewIf);
    pushSummary(rows, 'choose-if', t('previewObjectEditor.chooseIf', 'Choose if'), option && option.sectionChooseIf);
    pushSummary(rows, 'unavailable', t('previewObjectEditor.unavailableText', 'Unavailable text'), option && option.unavailableText);
    ensureArray(resultFields).forEach((field) => {
      ensureArray(field && field.conditions).forEach((condition) => {
        pushSummary(rows, 'condition', t('previewObjectEditor.when', 'When'), condition);
      });
    });
    return dedupeSummaries(rows);
  }

  function pushSummary(rows, kind, label, value) {
    const text = String(value || '').trim();
    if (!text) {
      return;
    }
    rows.push({kind, label, value: text});
  }

  function dedupeSummaries(rows) {
    const seen = new Set();
    return ensureArray(rows).filter((row) => {
      const value = normalizeSummaryValue(row && row.value);
      const key = row.kind === 'section'
        ? [row.kind || '', row.label || '', value].join('|')
        : value;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function normalizeSummaryValue(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function optionEffectFields(option, body) {
    const optionId = normalizeEndpointToken(option && option.id);
    const optionLabel = String(option && option.label || '').trim();
    return ensureArray(body && body.optionEffects).filter((group) => {
      return normalizeEndpointToken(group && group.id) === optionId ||
        (optionLabel && String(group && group.label || '').trim() === optionLabel);
    }).flatMap((group) => ensureArray(group && group.fields));
  }

  function sectionEffectFields(sectionId, body) {
    const target = normalizeEndpointToken(sectionId);
    if (!target) {
      return [];
    }
    const fields = ensureArray(body && body.sectionEffects).filter((field) => {
      return normalizeEndpointToken(field && field.sectionId) === target;
    });
    const actions = ensureArray(body && body.structureActions).filter((field) => {
      return String(field && field.structureAction || '') === 'remove_effect' &&
        normalizeEndpointToken(field && field.sectionId) === target;
    });
    return fields.concat(actions);
  }

  function optionConsumedVariables(resultFields) {
    return uniqueStrings(ensureArray(resultFields).flatMap((field) => {
      const context = field && field.logicContext || {};
      return ensureArray(field && field.textVariables).concat(ensureArray(context.textVariables));
    }));
  }

  function optionConditionVariables(resultFields) {
    return uniqueStrings(ensureArray(resultFields).flatMap((field) => {
      const context = field && field.logicContext || {};
      return ensureArray(field && field.conditionVariables).concat(ensureArray(context.conditionVariables));
    }));
  }

  function assetsForOption(option, body, resultFields) {
    const targetSource = option && option.target && option.target.source || {};
    const resultSources = ensureArray(resultFields).map((field) => field && field.source || {}).filter(Boolean);
    return ensureArray(body && body.assets).filter((asset) => {
      if (!isFlowAsset(asset)) {
        return false;
      }
      if (assetMatchesOption(asset, option)) {
        return true;
      }
      const source = asset && asset.source || {};
      if (!source || !source.path || !source.line) {
        return false;
      }
      if (sourceWithin(source, targetSource)) {
        return true;
      }
      return resultSources.some((resultSource) => sameSourcePath(source, resultSource) && sourceWithin(source, resultSource));
    });
  }

  function assetsForBranch(field, body) {
    return ensureArray(body && body.assets).filter((asset) => {
      if (!isFlowAsset(asset)) {
        return false;
      }
      return assetMatchesField(asset, field);
    });
  }

  function assetAddFieldsForOption(option, body, resultFields) {
    return ensureArray(body && body.assetAddFields).filter((field) => {
      if (!isFlowAssetAddField(field)) {
        return false;
      }
      if (assetAddFieldMatchesOption(field, option)) {
        return true;
      }
      return ensureArray(resultFields).some((resultField) => assetAddFieldMatchesField(field, resultField));
    });
  }

  function assetAddFieldsForBranch(field, body) {
    return ensureArray(body && body.assetAddFields).filter((addField) => isFlowAssetAddField(addField) && assetAddFieldMatchesField(addField, field));
  }

  function isFlowAsset(asset) {
    const kind = String(asset && asset.placementKind || '').trim();
    return Boolean(kind && kind !== 'global_slot');
  }

  function isFlowAssetAddField(field) {
    const kind = String(field && field.placementKind || '').trim();
    return Boolean(kind && kind !== 'global_slot');
  }

  function assetMatchesOption(asset, option) {
    const optionIds = optionEndpointTokens(option, []);
    const assetOptionIds = [asset && asset.optionId].concat(ensureArray(asset && asset.relatedOptionIds)).map(normalizeEndpointToken).filter(Boolean);
    return assetOptionIds.some((id) => optionIds.includes(id));
  }

  function assetMatchesField(asset, field) {
    const sectionId = normalizeEndpointToken(field && field.sectionId);
    const optionIds = ensureArray(field && field.relatedOptionIds).map(normalizeEndpointToken).filter(Boolean);
    const assetSection = normalizeEndpointToken(asset && asset.sectionId);
    const assetOptions = [asset && asset.optionId].concat(ensureArray(asset && asset.relatedOptionIds)).map(normalizeEndpointToken).filter(Boolean);
    return Boolean(
      sectionId && assetSection && sectionId === assetSection ||
      optionIds.length && assetOptions.some((id) => optionIds.includes(id))
    );
  }

  function assetAddFieldMatchesOption(field, option) {
    const optionIds = optionEndpointTokens(option, []);
    const fieldOption = normalizeEndpointToken(field && field.optionId);
    const fieldSection = normalizeEndpointToken(field && field.sectionId);
    return Boolean((fieldOption && optionIds.includes(fieldOption)) || (fieldSection && optionIds.includes(fieldSection)));
  }

  function assetAddFieldMatchesField(addField, field) {
    const fieldSection = normalizeEndpointToken(field && field.sectionId);
    const addSection = normalizeEndpointToken(addField && addField.sectionId);
    const fieldOptions = ensureArray(field && field.relatedOptionIds).map(normalizeEndpointToken).filter(Boolean);
    const addOption = normalizeEndpointToken(addField && addField.optionId);
    return Boolean(
      fieldSection && addSection && fieldSection === addSection ||
      addOption && fieldOptions.includes(addOption)
    );
  }

  function sourceWithin(source, range) {
    if (!source || !range || !sameSourcePath(source, range)) {
      return false;
    }
    const line = Number(source.line || source.startLine || 0);
    const start = Number(range.startLine || range.line || 0);
    const end = Number(range.endLine || range.line || start || 0);
    return Boolean(line && start && end && line >= start && line <= end);
  }

  function sameSourcePath(a, b) {
    return String(a && a.path || '') === String(b && b.path || '');
  }

  function endpointDisplay(value, model) {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }
    const sceneId = String(model && (model.objectId || model.sceneId) || '').trim();
    return sceneId && text.startsWith(sceneId + '.') ? text.slice(sceneId.length + 1) : text;
  }

  function normalizeEndpointToken(value) {
    const text = String(value || '').trim().replace(/^[@#]/, '');
    if (!text) {
      return '';
    }
    return text.includes('.') ? text.split('.').pop() : text;
  }

  function dedupeImpacts(rows) {
    const seen = new Set();
    const out = [];
    ensureArray(rows).forEach((row) => {
      const label = String(row && row.label || '').trim();
      const value = String(row && row.value || '').trim();
      if (!label || !value) {
        return;
      }
      const key = [row.kind || '', label, value].join('|');
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      out.push(Object.assign({}, row, {kind: row.kind || 'impact', label, value}));
    });
    return out;
  }

  function actionForField(field, kind, model, options) {
    const value = field && typeof field === 'object' ? field : null;
    if (!value) {
      return null;
    }
    const id = fieldId(value);
    const source = sourceRef(value.source || {});
    const role = String(options && options.role || value.semanticRole || value.role || kind || '').trim();
    const targetId = String(model && (model.objectId || model.sceneId) || value.sceneId || '').trim();
    const base = {
      entryKind: kind || 'field',
      routeClass: routeClassForField(value, kind),
      targetView: targetViewForModel(model),
      targetId,
      fieldId: id,
      valueKey: id,
      label: String(value.label || value.id || '').trim(),
      role,
      source,
      installSafety: installSafetyFor(value, source)
    };
    if (options && options.optionId) {
      base.optionId = String(options.optionId || '');
    }
    if (kind === 'effect') {
      return Object.assign(base, {
        actionKind: 'open_effect_editor',
        semanticEditor: {
          kind: 'effect_clause',
          sceneId: targetId,
          fieldId: id,
          role,
          title: String(value.label || t('previewObjectEditor.choiceEffects', 'Choice effects')),
          source
        }
      });
    }
    if (kind === 'route' || kind === 'condition') {
      return Object.assign(base, {
        actionKind: 'open_route_editor',
        semanticEditor: {
          kind: 'route_order',
          sceneId: targetId,
          fieldId: id,
          role,
          title: String(value.label || t('previewObjectEditor.route', 'Editor route')),
          source
        }
      });
    }
    if (!id && !source.path) {
      return null;
    }
    if (!id && source.path) {
      return Object.assign(base, {
        actionKind: base.installSafety === 'advanced_apply' ? 'open_advanced_source_patch' : 'open_source_slice'
      });
    }
    return Object.assign(base, {
      actionKind: kind === 'result' || role.indexOf('section') >= 0 ? 'open_object_section' : 'open_object_field',
      draftAction: true
    });
  }

  function actionForEffect(effect, model, options) {
    const value = effect && typeof effect === 'object' ? effect : {};
    const source = sourceRef(value.source || {});
    const targetId = String(model && (model.objectId || model.sceneId) || value.sceneId || '').trim();
    const expression = effectExpressionLabel(value);
    return {
      entryKind: 'effect',
      actionKind: 'open_effect_editor',
      routeClass: routeClassForField(value, 'effect'),
      targetView: targetViewForModel(model),
      targetId,
      fieldId: String(value.id || value.fieldId || ''),
      valueKey: String(value.id || value.fieldId || ''),
      label: expression,
      role: options && options.role || 'effect',
      source,
      installSafety: installSafetyFor(value, source),
      semanticEditor: {
        kind: 'effect_clause',
        sceneId: targetId,
        role: options && options.role || 'effect',
        title: expression || t('previewObjectEditor.choiceEffects', 'Choice effects'),
        source
      }
    };
  }

  function actionForRoute(option, model, options) {
    const source = sourceRef(option && option.target && option.target.source || option && option.source || {});
    const targetId = String(model && (model.objectId || model.sceneId) || '').trim();
    return {
      entryKind: 'route',
      actionKind: 'open_route_editor',
      routeClass: installSafetyFor(option || {}, source) === 'advanced_apply' ? 'advanced_source_patch' : 'route_editor',
      targetView: targetViewForModel(model),
      targetId,
      fieldId: String(option && (option.fieldId || option.id) || ''),
      valueKey: String(option && (option.fieldId || option.id) || ''),
      label: String(options && options.value || option && option.targetId || ''),
      role: options && options.role || 'route',
      source,
      installSafety: installSafetyFor(option || {}, source),
      semanticEditor: {
        kind: 'route_order',
        sceneId: targetId,
        role: options && options.role || 'route',
        title: t('previewObjectEditor.route', 'Editor route'),
        source
      }
    };
  }

  function actionForCondition(condition, option, resultFields, model) {
    const sourceField = ensureArray(resultFields).find((field) => field && field.source && field.source.path) || {};
    return actionForField(sourceField, 'condition', model, {
      role: String(condition && condition.kind || 'condition'),
      optionId: option && option.id
    }) || actionForRoute(option, model, {role: String(condition && condition.kind || 'condition'), value: condition && condition.value});
  }

  function actionForVariable(name, model) {
    const variable = String(name || '').replace(/^Q\./, '').trim();
    if (!variable) {
      return null;
    }
    return {
      entryKind: 'variable',
      actionKind: 'open_variable_editor',
      routeClass: 'variable_workspace',
      targetView: 'variables',
      targetId: variable,
      fieldId: variable,
      valueKey: variable,
      label: 'Q.' + variable,
      source: {},
      installSafety: 'guarded_apply',
      semanticEditor: {kind: 'variable_provenance', variable}
    };
  }

  function renderedEntryAttrs(action, kind, ariaLabel) {
    if (!action || typeof action !== 'object' || !action.actionKind) {
      return '';
    }
    return [
      ' data-rendered-authoring-entry="true"',
      ' data-rendered-entry-kind="' + escapeAttr(kind || action.entryKind || 'entry') + '"',
      ' data-visible-edit-action="' + escapeAttr(encodeAction(action)) + '"',
      ' role="button"',
      ' tabindex="0"',
      ' aria-label="' + escapeAttr(ariaLabel || t('previewObjectEditor.editRenderedEntry', 'Edit this preview item')) + '"'
    ].join('');
  }

  function renderActionContextLens(action, kind) {
    const api = contextLensApi();
    if (!api || typeof api.buildForAction !== 'function' || !action) {
      return '';
    }
    return renderContextLens(api.buildForAction(action, {entryKind: kind, translate: t}));
  }

  function renderFieldContextLens(field, role) {
    const api = contextLensApi();
    if (!api || typeof api.buildForField !== 'function' || !field) {
      return '';
    }
    return renderContextLens(api.buildForField(field, {role, translate: t}));
  }

  function renderParityContextLens(row) {
    const api = contextLensApi();
    if (!api || typeof api.buildForParityRole !== 'function' || !row) {
      return '';
    }
    return renderContextLens(api.buildForParityRole(row, {translate: t}));
  }

  function renderContextLens(lens) {
    const value = lens && typeof lens === 'object' ? lens : null;
    const rows = ensureArray(value && value.rows).filter((row) => row && row.label && row.value);
    if (!value || !rows.length) {
      return '';
    }
    return [
      '<span class="authoring-context-lens" data-authoring-context-lens="true" data-context-lens-kind="' + escapeAttr(value.subjectKind || 'entry') + '" data-context-lens-evidence="' + escapeAttr(value.evidenceState || 'unknown') + '" data-context-lens-pinned="false" data-context-lens-payload="' + escapeAttr(encodeAction(value)) + '" role="button" tabindex="0" aria-expanded="false" aria-label="' + escapeAttr(t('contextLens.openAria', 'Show authoring context') + ': ' + (value.meaning || value.subjectKind || '')) + '">',
      '<span class="authoring-context-lens-dot" aria-hidden="true">i</span>',
      '<span class="authoring-context-lens-popover" role="tooltip">',
      '<strong>' + escapeHtml(value.meaning || t('contextLens.title', 'Authoring context')) + '</strong>',
      '<dl>',
      rows.map((row) => '<div><dt>' + escapeHtml(row.label) + '</dt><dd>' + escapeHtml(row.value) + '</dd></div>').join(''),
      '</dl>',
      '</span>',
      '</span>'
    ].join('');
  }

  function targetViewForModel(model) {
    const kind = editorKind(model || {}, {});
    return kind === 'card' ? 'cards' : kind === 'news' ? 'news' : 'events';
  }

  function routeClassForField(field, kind) {
    const safety = installSafetyFor(field, sourceRef(field && field.source || {}));
    if (kind === 'route' || kind === 'condition') {
      return safety === 'advanced_apply' ? 'advanced_source_patch' : 'route_editor';
    }
    if (kind === 'effect') {
      return safety === 'advanced_apply' ? 'advanced_source_patch' : 'effect_clause_editor';
    }
    return 'object_field';
  }

  function installSafetyFor(field, source) {
    const explicit = String(field && (field.installSafety || field.applySafety || field.reviewSafety) || '').trim();
    if (/^(safe_apply|guarded_apply|advanced_apply)$/.test(explicit)) {
      return explicit;
    }
    const status = String(field && (field.status || field.editability || field.routeClass) || '').trim();
    if (/advanced|protected|router|manual/i.test(status)) {
      return 'advanced_apply';
    }
    const path = String(source && source.path || '').toLowerCase();
    if (/(?:router|post_event|root)\b/.test(path)) {
      return 'advanced_apply';
    }
    if (/safe/i.test(status)) {
      return 'safe_apply';
    }
    return 'guarded_apply';
  }

  function sourceRef(source) {
    const ref = source && typeof source === 'object' ? source : {};
    return {
      path: String(ref.path || '').trim(),
      line: numberOrNull(ref.line || ref.startLine),
      startLine: numberOrNull(ref.startLine || ref.line),
      endLine: numberOrNull(ref.endLine || ref.line || ref.startLine),
      anchorText: String(ref.anchorText || ref.text || '').trim()
    };
  }

  function numberOrNull(value) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  function encodeAction(action) {
    try {
      return JSON.stringify(action || {});
    } catch (_err) {
      return '{}';
    }
  }

  function renderPreviewBranches(branches, options, model, body) {
    const consumed = choiceTreeSectionIds(body);
    const rows = ensureArray(branches).filter((field) => {
      const section = normalizeEndpointToken(field && (field.sectionId || field.id));
      return field && fieldValue(field).trim() && !(section && consumed.has(section));
    }).slice(0, 6);
    if (!rows.length) {
      return '';
    }
    const opts = options || {};
    return [
      '<div class="object-editing-preview-branches" data-object-editing-preview-branches="true">',
      '<span class="object-editing-preview-group-label">' + escapeHtml(t('previewObjectEditor.branchPreview', 'Follow-up and branch text')) + '</span>',
      rows.map((field) => [
        '<article data-preview-branch-role="' + escapeAttr(field && (field.semanticRole || field.branchKind) || 'branch') + '"' + renderedEntryAttrs(actionForField(field, 'result', model, {role: 'branch'}), 'result', t('previewObjectEditor.editRenderedResult', 'Edit result text')) + '>',
        renderStudioRoleLabel(branchLabel(field)),
        branchConditionText(field) ? '<small>' + escapeHtml(branchConditionText(field)) + '</small>' : '',
        renderTextBlocks(fieldValue(field), {empty: false, assetBaseUrl: opts.assetBaseUrl || ''}),
        renderConditionalAlternatives(field, opts),
        assetEditorUi().renderInlineAssetPlacements(assetsForBranch(field, body), assetAddFieldsForBranch(field, body), editorKind(model, body), body, model, {
          showAddControls: false,
          showReplacementControls: false
        }),
        renderActionContextLens(actionForField(field, 'result', model, {role: 'branch'}), 'result'),
        '</article>'
      ].join('')).join(''),
      '</div>'
    ].join('');
  }

  function renderFlowOverview(flow, model, mode) {
    const value = flow && typeof flow === 'object' ? flow : {};
    const nodes = ensureArray(value.nodes);
    const edges = ensureArray(value.edges);
    const summary = value.summary || {};
    if (!nodes.length && !edges.length) {
      return '';
    }
    const nodeMap = new Map(nodes.map((node) => [String(node && node.id || ''), node]));
    const chips = [
      summary.sectionCount ? t('previewObjectEditor.flowSections', 'Sections') + ': ' + summary.sectionCount : '',
      summary.optionCount ? t('previewObjectEditor.flowOptions', 'Options') + ': ' + summary.optionCount : '',
      summary.routeEdgeCount ? t('previewObjectEditor.flowRoutes', 'Routes') + ': ' + summary.routeEdgeCount : '',
      summary.conditionalRouteCount ? t('previewObjectEditor.flowConditionalRoutes', 'Conditional routes') + ': ' + summary.conditionalRouteCount : '',
      summary.targetTitleFallbackCount ? t('previewObjectEditor.flowTargetTitleFallbacks', 'Target-titled choices') + ': ' + summary.targetTitleFallbackCount : ''
    ].filter(Boolean);
    const menuRows = nodes.filter((node) => String(node && node.kind || '') === 'menu').slice(0, 6);
    const routeRows = edges.filter((edge) => ['option', 'route', 'conditional_route'].includes(String(edge && edge.kind || ''))).slice(0, 8);
    return [
      '<section class="preview-object-flow-overview is-' + escapeAttr(mode || 'editor') + '" data-preview-object-flow="true">',
      '<div class="preview-object-flow-header">',
      '<strong>' + escapeHtml(t('previewObjectEditor.eventFlow', 'Event flow')) + '</strong>',
      chips.length ? '<span>' + chips.map(escapeHtml).join(' / ') + '</span>' : '',
      '</div>',
      menuRows.length ? '<div class="preview-object-flow-menus"><small>' + escapeHtml(t('previewObjectEditor.flowMenuSections', 'Menu sections')) + '</small>' + menuRows.map((node) => renderFlowNode(node, model)).join('') + '</div>' : '',
      routeRows.length ? '<div class="preview-object-flow-routes"><small>' + escapeHtml(t('previewObjectEditor.flowRoutePreview', 'Route preview')) + '</small>' + routeRows.map((edge) => renderFlowEdge(edge, nodeMap, model)).join('') + '</div>' : '',
      '</section>'
    ].join('');
  }

  function renderFlowNode(node, model) {
    const count = Number(node && node.optionCount || 0);
    const label = node && (node.label || node.localId || node.id) || '';
    const detail = [
      node && node.localId ? endpointDisplay(node.localId, model) : '',
      count ? t('previewObjectEditor.flowOptions', 'Options') + ': ' + count : '',
      node && node.viewIf ? t('previewObjectEditor.viewIf', 'View if') + ': ' + node.viewIf : '',
      node && node.chooseIf ? t('previewObjectEditor.chooseIf', 'Choose if') + ': ' + node.chooseIf : ''
    ].filter(Boolean).join(' / ');
    return [
      '<article>',
      '<b>' + renderTextInline(label) + '</b>',
      detail ? '<span>' + escapeHtml(detail) + '</span>' : '',
      '</article>'
    ].join('');
  }

  function renderFlowEdge(edge, nodeMap, model) {
    const from = flowEndpointLabel(edge && edge.from, nodeMap, model);
    const to = flowEndpointLabel(edge && edge.to, nodeMap, model);
    const kind = String(edge && edge.kind || '');
    const label = String(edge && edge.label || '');
    const condition = String(edge && edge.condition || '');
    return [
      '<article data-preview-object-flow-edge-kind="' + escapeAttr(kind || 'route') + '">',
      '<span>' + renderTextInline(label || kind || t('previewObjectEditor.route', 'Editor route')) + '</span>',
      '<b>' + renderTextInline(from || '') + '</b>',
      '<em>&rarr;</em>',
      '<b>' + renderTextInline(to || '') + '</b>',
      condition ? '<small>' + escapeHtml(t('previewObjectEditor.when', 'When') + ': ' + condition) + '</small>' : '',
      '</article>'
    ].join('');
  }

  function flowEndpointLabel(value, nodeMap, model) {
    const id = String(value || '').trim();
    if (!id) {
      return '';
    }
    const node = nodeMap && nodeMap.get(id);
    return node && (node.label || node.localId) || endpointDisplay(id, model);
  }

  function conditionalTreeRows(nodes) {
    return ensureArray(nodes).filter((node) => node && (node.condition || node.text || ensureArray(node.children).length));
  }

  // A conditional leaf field is the flat per-branch text/condition row the edit
  // model emits so the install/collect path has a field id to bind. The same
  // leaf is also carried (with the same stamped field ids) inside the owning
  // field's conditionalTree, which renders as a compact ladder. When a ladder
  // covers a leaf, rendering the flat field too would just stack a redundant
  // heavyweight row, so we suppress the flat field and let the ladder own it.
  function isConditionalLeafField(field) {
    const role = String(field && field.role || '');
    return role === 'conditional_leaf_text' || role === 'conditional_leaf_condition';
  }

  function collectConditionalLeafIds(nodes, acc) {
    ensureArray(nodes).forEach((node) => {
      if (!node) {
        return;
      }
      if (node.textFieldId) {
        acc.add(String(node.textFieldId));
      }
      if (node.conditionFieldId) {
        acc.add(String(node.conditionFieldId));
      }
      if (ensureArray(node.children).length) {
        collectConditionalLeafIds(node.children, acc);
      }
    });
  }

  // Set of leaf field ids that a rendered conditional ladder owns. Scope: only
  // sections + branchSections, because those fields render a ladder in BOTH the
  // editor and preview panes. Option-owned conditional leaves are intentionally
  // excluded — the editor choice path renders no ladder for them, so their flat
  // field is still their only editor, and dropping it would lose editing.
  var conditionalLadderCoverCache = (typeof WeakMap === 'function') ? new WeakMap() : null;
  function conditionalLadderCoveredIds(body) {
    if (!body || typeof body !== 'object') {
      return new Set();
    }
    if (conditionalLadderCoverCache && conditionalLadderCoverCache.has(body)) {
      return conditionalLadderCoverCache.get(body);
    }
    const ids = new Set();
    ensureArray(body.sections).forEach((field) => collectConditionalLeafIds(field && field.conditionalTree, ids));
    ensureArray(body.branchSections).forEach((field) => collectConditionalLeafIds(field && field.conditionalTree, ids));
    if (conditionalLadderCoverCache) {
      conditionalLadderCoverCache.set(body, ids);
    }
    return ids;
  }

  function ladderOwnsLeafField(field, body) {
    return isConditionalLeafField(field) && conditionalLadderCoveredIds(body).has(String(fieldId(field)));
  }

  // What-if simulator: parse each branch condition with the predicate model and
  // evaluate it against an editable quality state so the author sees which
  // layers show. Gated on BOTH browser globals so Node checks stay on the
  // Phase-1 (no-simulator) rendering path.
  function whatIfModels() {
    if (!global) {
      return null;
    }
    const model = global.ProjectMapPredicateConditionModel;
    const evaler = global.ProjectMapPredicateRuntimeEval;
    if (model && typeof model.summarizePredicate === 'function' && evaler && typeof evaler.evaluateAst === 'function') {
      return {model, evaler};
    }
    return null;
  }

  function collectWhatIfVariables(nodes, model, acc) {
    ensureArray(nodes).forEach((node) => {
      const condition = node && node.condition;
      if (condition) {
        const summary = model.summarizePredicate(condition);
        if (summary && summary.ast) {
          ensureArray(summary.dependencies).forEach((dep) => {
            const name = String(dep || '').trim();
            if (name) {
              acc.add(name);
            }
          });
        }
      }
      collectWhatIfVariables(node && node.children, model, acc);
    });
  }

  function renderWhatIfStrip(variables) {
    return [
      '<div class="preview-object-conditional-whatif" data-conditional-whatif="true">',
      '<span class="preview-object-conditional-whatif-label">' + escapeHtml(t('previewObjectEditor.whatIfLabel', 'What-if state')) + '</span>',
      '<div class="preview-object-conditional-whatif-vars">',
      variables.map((name) => [
        '<label class="preview-object-conditional-whatif-var">',
        '<span>Q.' + escapeHtml(name) + '</span>',
        '<input type="number" step="1" value="0" data-conditional-whatif-var="' + escapeAttr(name) + '" aria-label="' + escapeAttr('Q.' + name) + '">',
        '</label>'
      ].join('')).join(''),
      '</div>',
      '</div>'
    ].join('');
  }

  function branchStateBadge(active) {
    const state = active === null ? 'opaque' : (active ? 'active' : 'hidden');
    const label = state === 'opaque'
      ? t('previewObjectEditor.whatIfUnknown', 'state unknown')
      : (state === 'active' ? t('previewObjectEditor.whatIfShows', 'shows') : t('previewObjectEditor.whatIfHidden', 'hidden'));
    return '<span class="preview-object-conditional-state is-' + state + '" data-conditional-branch-state="' + state + '">' + escapeHtml(label) + '</span>';
  }

  // Inline editor for a structurally-editable conditional leaf (P3a). The
  // inputs carry data-object-canvas-field so the existing collectValues() pass
  // picks up edits; the model splices only this branch's span into a guarded
  // single-line replace. Rendered only when the edit model stamped field ids.
  // Inline pencil affordance so an editable branch reads as actionable at a
  // glance (discoverability). Falls back to no icon in Node/non-icon contexts.
  function conditionalEditIcon() {
    const icons = global && global.ProjectMapIcons;
    if (icons && typeof icons.icon === 'function') {
      return icons.icon('edit', {className: 'preview-object-conditional-edit-icon'});
    }
    return '';
  }

  // Count leaves that expose an inline editor, so the block summary can signal
  // "this layer is editable" up front instead of hiding it behind each toggle.
  function countEditableLeaves(nodes) {
    let total = 0;
    ensureArray(nodes).forEach((node) => {
      if (node && node.editable && node.textFieldId) {
        total += 1;
      }
      total += countEditableLeaves(node && node.children);
    });
    return total;
  }

  // Dense conditional layers (30+ branches in one layer is common in large
  // mods) get a filter toolbar so authors can narrow the list by text and, when
  // the what-if simulator is live, to only the branches that currently show.
  // Below the threshold the list is short enough that a toolbar is just noise.
  var CONDITIONAL_FILTER_THRESHOLD = 8;
  function renderConditionalFilterToolbar(tree, whatIf) {
    const total = conditionalTreeRows(tree).length;
    if (total <= CONDITIONAL_FILTER_THRESHOLD) {
      return '';
    }
    const placeholder = t('previewObjectEditor.filterPlaceholder', 'Filter branches');
    const showsToggle = whatIf
      ? '<label class="preview-object-conditional-filter-shows"><input type="checkbox" data-conditional-filter-shows="true"><span>' + escapeHtml(t('previewObjectEditor.filterOnlyShows', 'Only branches that show')) + '</span></label>'
      : '';
    const countText = t('previewObjectEditor.filterCount', 'Showing {shown} of {total}')
      .replace('{shown}', String(total))
      .replace('{total}', String(total));
    return [
      '<div class="preview-object-conditional-filter" data-conditional-filter="true">',
      '<input type="search" class="preview-object-conditional-filter-input" data-conditional-filter-input="true" placeholder="' + escapeAttr(placeholder) + '" aria-label="' + escapeAttr(placeholder) + '">',
      showsToggle,
      '<span class="preview-object-conditional-filter-count" data-conditional-filter-count="true" aria-live="polite">' + escapeHtml(countText) + '</span>',
      '</div>'
    ].join('');
  }

  // renderConditionalVarInserts (and the prose [+ qdisplay +] inserter) live in the
  // off-budget sibling object_editor_inserts.js; object_authoring_canvas_ui still
  // owns the data-conditional-var-token click handler that drives those chips.

  function renderConditionalLeafEditor(node, options) {
    if (!node || !node.editable || !node.textFieldId) {
      return '';
    }
    const opts = options || {};
    const rawText = String(node.rawText || '');
    const rawCondition = String(node.rawCondition || '');
    const rows = [
      '<details class="preview-object-conditional-edit" data-conditional-leaf-edit="true">',
      '<summary class="preview-object-conditional-edit-toggle">' + conditionalEditIcon() + '<span>' + escapeHtml(t('previewObjectEditor.editBranch', 'Edit this branch')) + '</span></summary>',
      '<label class="preview-object-conditional-edit-field">',
      '<span>' + escapeHtml(t('previewObjectEditor.editBranchText', 'Branch text')) + '</span>',
      '<textarea class="preview-object-conditional-edit-input" rows="2" data-object-canvas-field="' + escapeAttr(node.textFieldId) + '" data-object-canvas-original="' + escapeAttr(rawText) + '" data-conditional-leaf-input="text">' + escapeHtml(rawText) + '</textarea>',
      '<small class="preview-object-conditional-edit-note" data-conditional-leaf-note="text" role="status" aria-live="polite" hidden></small>',
      '</label>'
    ];
    if (node.conditionFieldId) {
      rows.push(
        '<label class="preview-object-conditional-edit-field">',
        '<span>' + escapeHtml(t('previewObjectEditor.editBranchCondition', 'Branch condition')) + '</span>',
        '<input type="text" class="preview-object-conditional-edit-input" value="' + escapeAttr(rawCondition) + '" data-object-canvas-field="' + escapeAttr(node.conditionFieldId) + '" data-object-canvas-original="' + escapeAttr(rawCondition) + '" data-conditional-leaf-input="condition">',
        ((m) => m ? m.renderConditionalVarInserts(opts.conditionVariables) : '')(objectEditorInserts()),
        '<small class="preview-object-conditional-edit-note" data-conditional-leaf-note="condition" role="status" aria-live="polite" hidden></small>',
        '</label>'
      );
    }
    rows.push('</details>');
    return rows.join('');
  }

  function renderConditionalTree(nodes, options, depth, whatIf) {
    const rows = conditionalTreeRows(nodes);
    if (!rows.length) {
      return '';
    }
    const opts = options || {};
    const level = Number(depth || 0);
    // Top-level layers render every branch (a single dense layer can hold 30+):
    // the filter toolbar, not silent truncation, governs density so no branch is
    // hidden behind a dead "More alternatives" line the author cannot reach.
    const cap = level === 0 ? 120 : 12;
    const shown = rows.slice(0, cap);
    const hidden = rows.length - shown.length;
    return [
      '<ul class="preview-object-conditional-branches" data-depth="' + escapeAttr(String(level)) + '">',
      shown.map((node) => {
        const children = renderConditionalTree(node.children, opts, level + 1, whatIf);
        let astAttr = '';
        let badge = '';
        if (whatIf && node.condition) {
          const summary = whatIf.model.summarizePredicate(node.condition);
          const ast = summary && summary.ast;
          if (ast) {
            const active = Boolean(whatIf.evaler.evaluateAst(ast, whatIf.state));
            astAttr = ' data-conditional-branch-ast="' + escapeAttr(JSON.stringify(ast)) + '"';
            badge = branchStateBadge(active);
          } else {
            badge = branchStateBadge(null);
          }
        }
        const editableLeaf = Boolean(node.editable && node.textFieldId);
        return [
          '<li class="preview-object-conditional-branch"' + (children ? ' data-has-children="true"' : '') + (editableLeaf ? ' data-conditional-editable="true"' : '') + astAttr + '>',
          node.condition ? '<code class="preview-object-conditional-when">' + escapeHtml(t('previewObjectEditor.when', 'When') + ': ' + node.condition) + '</code>' : '',
          badge,
          node.text ? '<div class="preview-object-conditional-text">' + renderTextBlocks(node.text, {empty: false, assetBaseUrl: opts.assetBaseUrl || ''}) + '</div>' : '',
          opts.readOnly ? '' : renderConditionalLeafEditor(node, opts),
          children,
          '</li>'
        ].join('');
      }).join(''),
      hidden > 0 ? '<li class="preview-object-conditional-more"><small>' + escapeHtml(t('previewObjectEditor.moreAlternatives', 'More alternatives') + ': ' + String(hidden)) + '</small></li>' : '',
      '</ul>'
    ].join('');
  }

  function renderConditionalAlternatives(field, options) {
    const opts = options || {};
    // Read-only mode (preview pane): render the condition -> text ladder for
    // reading only. No what-if simulator, no filter toolbar, no inline editors,
    // so the editor pane stays the single owner of the leaf field inputs.
    const readOnly = Boolean(opts.readOnly);
    const tree = conditionalTreeRows(field && field.conditionalTree);
    if (tree.length) {
      const models = readOnly ? null : whatIfModels();
      let whatIf = null;
      let strip = '';
      let conditionVariables = [];
      if (models) {
        const acc = new Set();
        collectWhatIfVariables(tree, models.model, acc);
        if (acc.size) {
          whatIf = {model: models.model, evaler: models.evaler, state: {}};
          conditionVariables = Array.from(acc).sort();
          strip = renderWhatIfStrip(conditionVariables);
        }
      }
      const treeOpts = Object.assign({}, opts, {conditionVariables: conditionVariables, readOnly: readOnly});
      const editableCount = readOnly ? 0 : countEditableLeaves(tree);
      const editableChip = editableCount
        ? '<span class="preview-object-conditional-editable-count" data-conditional-editable-count="' + escapeAttr(String(editableCount)) + '">' + escapeHtml(t('previewObjectEditor.editableBranchCount', '{n} editable').replace('{n}', String(editableCount))) + '</span>'
        : '';
      return [
        '<details class="preview-object-conditional-alternatives preview-object-conditional-tree' + (readOnly ? ' is-readonly' : '') + '" open data-preview-object-conditional-alternatives="true" data-preview-object-conditional-tree="true"' + (whatIf ? ' data-conditional-whatif-scope="true"' : '') + '>',
        '<summary><span class="preview-object-conditional-summary-label">' + escapeHtml(t('previewObjectEditor.conditionalLayers', 'Conditional layers')) + '</span>' + editableChip + '</summary>',
        readOnly ? '' : strip,
        readOnly ? '' : renderConditionalFilterToolbar(tree, whatIf),
        renderConditionalTree(tree, treeOpts, 0, whatIf),
        '</details>'
      ].join('');
    }
    const rows = ensureArray(field && field.conditionalAlternatives).filter((item) => item && (item.condition || item.text));
    if (!rows.length) {
      return '';
    }
    return [
      '<details class="preview-object-conditional-alternatives" open data-preview-object-conditional-alternatives="true">',
      '<summary>' + escapeHtml(t('previewObjectEditor.conditionalAlternatives', 'Conditional alternatives')) + '</summary>',
      rows.slice(0, 8).map((item) => [
        '<article>',
        item.condition ? '<code>' + escapeHtml(item.condition) + '</code>' : '',
        item.text ? '<div>' + renderTextBlocks(item.text, {empty: false, assetBaseUrl: opts.assetBaseUrl || ''}) + '</div>' : '',
        '</article>'
      ].join('')).join(''),
      rows.length > 8 ? '<small>' + escapeHtml(t('previewObjectEditor.moreAlternatives', 'More alternatives') + ': ' + String(rows.length - 8)) + '</small>' : '',
      '</details>'
    ].join('');
  }

  function renderKindEditor(kind, body, model) {
    return perfMeasure('renderKindEditor', () => {
      branchSectionGroupsCallCount = 0;
      let html;
      if (kind === 'card') {
        html = renderCardEditor(body, model);
      } else if (kind === 'deck_pool') {
        html = renderDeckPoolEditor(body, model);
      } else if (kind === 'news') {
        html = renderNewsEditor(body, model);
      } else if (kind === 'text-replacement') {
        html = renderTextReplacementEditor(body, model);
      } else {
        html = renderEventEditor(body, model);
      }
      perfRecord('renderKindEditor.branchSectionGroups.calls', branchSectionGroupsCallCount, {
        kind,
        options: ensureArray(body && body.options).length,
        branchSections: ensureArray(body && body.branchSections).length,
        structureActions: ensureArray(body && body.structureActions).length
      });
      return html;
    }, {kind});
  }

  function renderDeckPoolEditor(body, model) {
    const members = ensureArray(body && body.options);
    const meta = ensureArray(body && body.metaFields);
    const addFields = meta.filter((field) => /^deckPool\.add\./.test(fieldId(field)));
    const routingFields = meta.filter((field) => /^deckPool\.(launcher|routeTag)\./.test(fieldId(field)));
    const infoFields = ensureArray(body && body.sections);
    return [
      '<article class="preview-object-frame preview-object-deck-pool-frame" data-preview-object-deck-pool="true">',
      '<div class="preview-object-kicker">' + escapeHtml(body && body.bodyEyebrow || t('objectPreview.deckPool', 'Deck pool')) + '</div>',
      renderInlineField(body.title || fallbackField('deckPool.label', t('previewObjectEditor.deckPoolLabel', 'Deck label'), model && model.title), {
        role: 'title',
        element: 'input',
        className: 'preview-object-title-input'
      }),
      infoFields.length ? '<section class="preview-object-logic-section"><h4>' + escapeHtml(t('previewObjectEditor.deckPoolIdentity', 'Pool identity')) + '</h4>' + infoFields.map((field) => renderInlineField(field, {role: 'source-context', element: 'input'})).join('') + '</section>' : '',
      routingFields.length ? '<section class="preview-object-logic-section"><h4>' + escapeHtml(t('previewObjectEditor.deckPoolRouting', 'Pool routing')) + '</h4>' + routingFields.map((field) => renderInlineField(field, {role: 'route', element: logicFieldElement(field)})).join('') + '</section>' : '',
      addFields.length ? '<section class="preview-object-logic-section"><h4>' + escapeHtml(t('previewObjectEditor.deckPoolAddMember', 'Add card to pool')) + '</h4>' + addFields.map((field) => renderInlineField(field, {role: 'deck-pool-add', element: logicFieldElement(field)})).join('') + '</section>' : '',
      '<section class="preview-object-choices preview-object-deck-pool-members" data-preview-object-deck-pool-members="true">',
      '<div class="preview-object-section-title">' + escapeHtml(body && body.optionsLabel || t('previewObjectEditor.deckPoolMembers', 'Pool members')) + '</div>',
      members.length ? members.map((member, index) => renderDeckPoolMember(member, index, body, model)).join('') : renderEmpty(t('previewObjectEditor.deckPoolNoMembers', 'No cards are currently in this pool.')),
      '</section>',
      '</article>'
    ].join('');
  }

  function renderDeckPoolMember(option, index, body, model) {
    const fields = ensureArray(option && option.fields);
    const title = firstField(fields, /\.title$/i) || fallbackField('deckPool.member.' + index + '.title', t('previewObjectEditor.cardTitle', 'Card title'), option && (option.label || option.id));
    const id = firstField(fields, /\.id$/i);
    const membership = firstField(fields, /\.membership$/i);
    const evidence = firstField(fields, /\.editableReason$/i);
    const remove = firstField(fields, /\.remove$/i);
    const move = firstField(fields, /\.moveTargetDeckPoolId$/i);
    return [
      '<article class="preview-object-choice preview-object-deck-pool-member" data-preview-object-deck-pool-member="' + escapeAttr(option && option.id || String(index + 1)) + '">',
      '<div class="preview-object-choice-main">',
      '<b>' + escapeHtml(String(index + 1)) + '</b>',
      renderInlineField(title, {role: 'deck-pool-member-title', element: 'input'}),
      '</div>',
      '<div class="preview-object-choice-details" open>',
      id ? renderInlineField(id, {role: 'deck-pool-member-id', element: 'input'}) : '',
      membership ? renderInlineField(membership, {role: 'deck-pool-member-membership', element: 'input'}) : '',
      evidence ? renderInlineField(evidence, {role: 'deck-pool-member-evidence', element: 'input'}) : '',
      remove ? renderInlineField(remove, {role: 'deck-pool-member-remove', element: logicFieldElement(remove)}) : '',
      move ? renderInlineField(move, {role: 'deck-pool-member-move', element: logicFieldElement(move)}) : '',
      '</div>',
      '</article>'
    ].join('');
  }

  function renderEventEditor(body, model) {
    // Drop the flat conditional-leaf rows whose owning field already renders a
    // compact ladder below; the ladder carries the same leaf field ids, so the
    // flat rows were a redundant heavyweight duplicate (the "wall" of repeated
    // CONDITIONAL BRANCH TEXT/CONDITION fields). Leaves with no ladder (option
    // owned) keep their flat field so editing is never lost.
    const sections = ensureArray(body.sections).filter((field) => !ladderOwnsLeafField(field, body));
    const branchSections = ensureArray(body.branchSections);
    const options = ensureArray(body.options);
    const textOptions = previewTextOptions(body, model);
    const renderPlan = largeEventRenderPlan(body);
    return [
      '<article class="preview-object-frame preview-object-event-frame" data-preview-object-event="true">',
      '<div class="preview-object-kicker">' + escapeHtml(t('objectPreview.event', 'World Event')) + '</div>',
      renderInlineField(body.title || body.heading || fallbackField('event.title', t('create.help.title', 'Title'), model && model.title), {
        role: 'title',
        element: 'input',
        className: 'preview-object-title-input'
      }),
      body.subtitle ? renderInlineField(body.subtitle, {
        role: 'subtitle',
        element: 'input'
      }) : '',
      body.heading && fieldId(body.heading) !== fieldId(body.title) ? renderInlineField(body.heading, {
        role: 'heading',
        element: 'input'
      }) : '',
      openingContextUi().render(body, model),
      sections.length
        ? '<section class="preview-object-semantic-section" data-object-canvas-semantic-section="player_content"><div class="preview-object-semantic-section-title" data-object-canvas-semantic-group="player_content">' + escapeHtml(t('previewObjectEditor.semanticGroup.player_content', 'Player content')) + '</div><div class="preview-object-prose" data-preview-object-prose="true">' + sections.map((field, index) => [
          renderInlineField(field, {
            role: 'body',
            element: 'textarea',
            fallbackLabel: t('previewObjectEditor.paragraph', 'Paragraph') + ' ' + (index + 1),
            assetBaseUrl: textOptions.assetBaseUrl
          }),
          renderConditionalAlternatives(field, {assetBaseUrl: textOptions.assetBaseUrl}),
          assetEditorUi().renderInlineAssetPlacements(assetsForBranch(field, body), assetAddFieldsForBranch(field, body), 'event', body, model)
        ].join('')).join('') + '</div></section>'
        : renderEmpty(t('objectCanvas.noBodyFields', 'No player-facing body fields are available yet.')),
      renderChoiceEditor(options, 'event', body, renderPlan, model),
      renderBranchSectionEditor(branchSections, textOptions, body, renderPlan, model),
      renderAssetEditorPanel(body, 'event', model),
      renderLogicEditor(body, 'event'),
      renderOpaqueBlocks(body),
      renderEventReviewDetails(body, model),
      '</article>'
    ].join('');
  }

  // Magic {! … !} blocks (opaque arbitrary JS hooks) — previously invisible in the
  // object editor. Surfaced as raw-JS textareas bound to 'opaque:<id>' so a save
  // becomes a guarded replace_section over the block's span (raw-text edit by
  // policy; Studio never interprets the JS). Oversized/unanchored blocks (model
  // marks them not editable) render read-only with an IDE escape hint.
  function renderOpaqueBlocks(body) {
    const items = ensureArray(body && body.opaqueJsBlocks);
    if (!items.length) {
      return '';
    }
    const rows = items.map((block) => {
      const editable = Boolean(block && block.editable && block.id);
      const writes = ensureArray(block && block.writes);
      const reads = ensureArray(block && block.reads);
      const hint = [
        writes.length ? t('objectCanvas.magicWrites', 'Writes') + ': ' + writes.join(', ') : '',
        reads.length ? t('objectCanvas.magicReads', 'Reads') + ': ' + reads.join(', ') : '',
        editable ? '' : t('objectCanvas.magicIdeOnly', 'Large or unanchored block — edit in your IDE.')
      ].filter(Boolean).join('  ·  ');
      const field = {
        id: editable ? 'opaque:' + block.id : '',
        value: String((editable ? (block.value !== undefined ? block.value : block.rawText) : (block.rawPreview || block.value)) || ''),
        label: (block && block.hook ? block.hook + ' ' : '') + t('objectCanvas.magicBlock', 'magic {! … !}'),
        status: editable ? 'guarded' : 'review',
        readOnly: !editable
      };
      const overcapUi = editable ? null : objectEditorOvercapSlice();
      return '<div class="preview-object-magic-block">' + renderInlineField(field, {role: 'logic', element: 'textarea'})
        + (hint ? '<small class="preview-object-field-context">' + escapeHtml(hint) + '</small>' : '')
        + (overcapUi ? overcapUi.renderOvercapEntry(block, {}) : '') + '</div>';
    }).join('');
    return '<details class="preview-object-logic-details" data-preview-object-magic="true"><summary>'
      + escapeHtml(t('objectCanvas.magicBlocks', 'Magic / JS blocks')) + '</summary>'
      + '<div class="preview-object-magic-blocks">' + rows + '</div></details>';
  }

  function branchSectionGroups(body) {
    branchSectionGroupsCallCount += 1;
    const groups = {};
    ensureArray(body && body.branchSections).forEach((field) => {
      const id = normalizeEndpointToken(field && (field.sectionId || field.id));
      if (!id) {
        return;
      }
      if (!groups[id]) {
        groups[id] = {
          id,
          label: branchLabel(field),
          condition: branchConditionText(field) || '',
          fields: []
        };
      }
      groups[id].fields.push(field);
      if (!groups[id].condition) {
        groups[id].condition = branchConditionText(field) || '';
      }
      if (!groups[id].label || groups[id].label === t('previewObjectEditor.sceneStep', 'Scene step')) {
        groups[id].label = branchLabel(field);
      }
    });
    return groups;
  }

  function renderEventReviewDetailsPanels(body, model) {
    return perfMeasure('renderEventReviewDetailsPanels', () => [
      renderFlowOverview(body && body.flow, model, 'editor'),
      eventBuilderUi().renderChoiceUnitSummary(body && body.choiceUnits),
      eventBuilderUi().renderConsequenceGroups(body && body.consequenceGroups),
      eventBuilderUi().renderContinuationMap(body && body.continuationMap),
      eventBuilderUi().renderPlayabilityChecks(body && body.playabilityChecks),
      eventBuilderUi().renderRouteScriptIntelligence(body),
      eventBuilderUi().renderEventGraphSummary(body && body.eventGraph, body),
      eventBuilderUi().renderEventReadiness(body && body.readinessChecklist)
    ].filter(Boolean).join(''), {});
  }

  function hasReviewDetailsContent(body) {
    if (!body) {
      return false;
    }
    if (body.flow && typeof body.flow === 'object') {
      const nodes = ensureArray(body.flow.nodes).length;
      const edges = ensureArray(body.flow.edges).length;
      if (nodes || edges) {
        return true;
      }
    }
    if (ensureArray(body.choiceUnits).length) return true;
    if (ensureArray(body.consequenceGroups).length) return true;
    if (body.continuationMap && ensureArray(body.continuationMap.entries).length) return true;
    if (ensureArray(body.playabilityChecks).length) return true;
    if (body.eventGraph && (ensureArray(body.eventGraph.nodes).length || ensureArray(body.eventGraph.edges).length)) return true;
    if (body.readinessChecklist && ensureArray(body.readinessChecklist.items).length) return true;
    if (body.scriptRows && ensureArray(body.scriptRows).length) return true;
    return false;
  }

  function renderEventReviewDetails(body, model) {
    if (!hasReviewDetailsContent(body)) {
      return '';
    }
    return [
      '<details class="preview-object-review-details" data-preview-object-review-details="true" data-preview-object-review-details-lazy="pending">',
      '<summary>' + escapeHtml(t('previewObjectEditor.reviewDetails', 'Route and install review')) + '</summary>',
      '<div class="preview-object-review-details-body" data-preview-object-review-details-body="pending">',
      '<small class="preview-object-review-details-pending">' + escapeHtml(t('previewObjectEditor.reviewDetailsLoading', 'Loading review details…')) + '</small>',
      '</div>',
      '</details>'
    ].join('');
  }

  function hydrateLazyReviewDetails(detailsEl, body, model) {
    if (!detailsEl || detailsEl.dataset.previewObjectReviewDetailsLazy !== 'pending') {
      return false;
    }
    const bodyEl = detailsEl.querySelector('[data-preview-object-review-details-body="pending"]');
    if (!bodyEl) {
      detailsEl.dataset.previewObjectReviewDetailsLazy = 'hydrated';
      return false;
    }
    const html = renderEventReviewDetailsPanels(body, model);
    bodyEl.innerHTML = html;
    bodyEl.dataset.previewObjectReviewDetailsBody = 'hydrated';
    detailsEl.dataset.previewObjectReviewDetailsLazy = 'hydrated';
    return true;
  }

  function renderBranchSectionEditor(branches, options, body, renderPlan, model) {
    const consumed = choiceTreeSectionIds(body);
    const rows = ensureArray(branches).filter((field) => {
      const section = normalizeEndpointToken(field && (field.sectionId || field.id));
      return Boolean(field) && !(section && consumed.has(section));
    });
    const mode = String(body && body.mode || model && model.mode || '');
    const addBranch = rows.length || mode !== 'new_event'
      ? structureUi().firstStructureAction(body, 'add_branch')
      : null;
    if (!rows.length && !addBranch) {
      return '';
    }
    const opts = options || {};
    const limit = renderPlan && renderPlan.branchLimit && rows.length > renderPlan.branchLimit ? renderPlan.branchLimit : rows.length;
    const visibleRows = rows.slice(0, limit);
    const deferredRows = rows.slice(limit);
    return [
      '<section class="preview-object-branches" data-preview-object-branches="true">',
      '<details class="preview-object-branch-details" data-preview-object-branch-details="true">',
      '<summary><span class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.unownedFlowPages', 'Other flow pages')) + '</span></summary>',
      visibleRows.map((field) => [
        '<article class="preview-object-branch-group" data-preview-object-branch-role="' + escapeAttr(field.semanticRole || field.branchKind || 'branch') + '">',
        renderInlineField(field, {
          role: branchFieldRole(field),
          element: 'textarea',
          fallbackLabel: branchLabel(field),
          assetBaseUrl: opts.assetBaseUrl
        }),
        renderConditionalAlternatives(field, opts),
        assetEditorUi().renderInlineAssetPlacements(assetsForBranch(field, body), assetAddFieldsForBranch(field, body), editorKind(model, body), body, model),
        structureUi().branchStructureActions(field, body).map((actionField) => {
          return /^add_/.test(String(actionField && actionField.structureAction || ''))
            ? structureUi().renderInlineAddAction(actionField, body)
            : structureUi().renderCompactStructureAction(actionField, body);
        }).join(''),
        '</article>'
      ].join('')).join(''),
      deferredRows.length ? renderDeferredBranchSummary(deferredRows) : '',
      addBranch ? structureUi().renderInlineAddAction(addBranch, body) : '',
      '</details>',
      '</section>'
    ].join('');
  }

  function choiceTreeSectionIds(body) {
    return new Set(choicePathModel().choiceTreeSectionIds(body, {
      sectionGroups: branchSectionGroups(body)
    }));
  }

  function renderNewsEditor(body, model) {
    const sections = ensureArray(body.sections);
    return [
      '<article class="preview-object-frame preview-object-news-frame" data-preview-object-news="true">',
      '<div class="preview-object-kicker">' + escapeHtml(t('objectPreview.news', 'News')) + '</div>',
      renderInlineField(body.title || fallbackField('news.headline', t('previewObjectEditor.headline', 'Headline'), model && model.title), {
        role: 'headline',
        element: 'input',
        className: 'preview-object-title-input'
      }),
      sections.length
        ? '<div class="preview-object-prose" data-preview-object-prose="true">' + sections.map((field) => renderInlineField(field, {
          role: 'description',
          element: 'textarea',
          fallbackLabel: t('previewObjectEditor.description', 'Description')
        })).join('') + '</div>'
        : renderEmpty(t('objectCanvas.noBodyFields', 'No player-facing body fields are available yet.')),
      '</article>'
    ].join('');
  }

  function renderCardEditor(body, model) {
    const sections = ensureArray(body.sections);
    const branchSections = ensureArray(body.branchSections);
    const subtitle = firstField(sections, /subtitle/i);
    const mainSections = sections.filter((field) => field !== subtitle);
    const options = ensureArray(body.options);
    const textOptions = previewTextOptions(body, model);
    return [
      '<article class="preview-object-frame preview-object-card-frame" data-preview-object-card="true" data-card-face-preview="true">',
      '<div class="preview-object-card-shell">',
      '<div class="preview-object-kicker">' + escapeHtml(t('objectPreview.card', 'Card')) + '</div>',
      renderInlineField(body.title || body.heading || fallbackField('card.title', t('create.help.title', 'Title'), model && model.title), {
        role: 'title',
        element: 'input',
        className: 'preview-object-title-input'
      }),
      body.heading && fieldId(body.heading) !== fieldId(body.title) ? renderInlineField(body.heading, {
        role: 'heading',
        element: 'input'
      }) : '',
      subtitle ? renderInlineField(subtitle, {
        role: 'subtitle',
        element: 'input'
      }) : '',
      mainSections.length
        ? '<div class="preview-object-prose" data-preview-object-prose="true">' + mainSections.map((field) => [
          renderInlineField(field, {
            role: 'body',
            element: 'textarea'
          }),
          assetEditorUi().renderInlineAssetPlacements(assetsForBranch(field, body), assetAddFieldsForBranch(field, body), 'card', body, model)
        ].join('')).join('') + '</div>'
        : renderEmpty(t('objectPreview.empty', 'No player-facing text is available yet.')),
      renderChoiceEditor(options, 'card', body, null, model),
      renderBranchSectionEditor(branchSections, textOptions, body, null, model),
      renderAssetEditorPanel(body, 'card', model),
      renderLogicEditor(body, 'card'),
      '</div>',
      '</article>'
    ].join('');
  }

  function renderTextReplacementEditor(body, model) {
    const sections = ensureArray(body.sections);
    const original = firstField(sections, /original|before/i) || {};
    const reason = firstField(sections, /reason|note/i);
    const replacement = body.title || fallbackField('surface.replacementLabel', t('objectPreview.after', 'After'), model && model.title);
    return [
      '<article class="preview-object-frame preview-object-text-frame" data-preview-object-text-replacement="true">',
      '<div class="preview-object-kicker">' + escapeHtml(t('objectPreview.textPatch', 'Text Patch')) + '</div>',
      '<div class="preview-object-before-after">',
      '<div>',
      '<span>' + escapeHtml(t('objectPreview.before', 'Before')) + '</span>',
      renderInlineField(original, {
        role: 'before',
        element: 'textarea',
        forceReadOnly: true,
        fallbackLabel: t('objectPreview.before', 'Before')
      }),
      '</div>',
      '<div>',
      '<span>' + escapeHtml(t('objectPreview.after', 'After')) + '</span>',
      renderInlineField(replacement, {
        role: 'after',
        element: 'textarea',
        fallbackLabel: t('objectPreview.after', 'After')
      }),
      '</div>',
      '</div>',
      reason ? renderInlineField(reason, {
        role: 'reason',
        element: 'textarea'
      }) : '',
      renderSourceContext(model, body),
      '</article>'
    ].join('');
  }

  function renderChoiceEditor(options, owner, body, renderPlan, model) {
    const rows = ensureArray(options);
    const addOption = structureUi().firstStructureAction(body, 'add_option');
    const pureEvent = String(body && body.eventShape || '') === 'pure_event';
    if (!rows.length && !addOption) {
      return '<section class="preview-object-choices is-empty">' + renderEmpty(pureEvent ? t('previewObjectEditor.noChoiceEvent', 'This event has no player choices.') : t('objectCanvas.noOptions', 'No options found for this object.')) + '</section>';
    }
    const tree = owner === 'event' ? choiceTreePlan(rows, body) : null;
    const sectionRootRows = tree && !tree.rootRows.length ? tree.rootSectionRows : [];
    const renderRows = sectionRootRows.length ? sectionRootRows : (tree ? tree.rootRows : rows);
    const limit = renderPlan && owner === 'event' && renderPlan.choiceLimit && renderRows.length > renderPlan.choiceLimit ? renderPlan.choiceLimit : renderRows.length;
    const visibleRows = renderRows.slice(0, limit);
    const deferredRows = renderRows.slice(limit);
    return [
      '<section class="preview-object-choices' + (tree ? ' is-player-path-layout' : '') + '" data-preview-object-choices="true"' + (tree ? ' data-preview-object-choice-layout="player_path"' : '') + '>',
      '<div class="preview-object-section-title">' + escapeHtml(t('objectPreview.choices', 'Choices')) + '</div>',
      renderRows.length ? visibleRows.map((item, index) => {
        return item && item.__sectionRoot
          ? renderChoiceSectionRoot(item, owner, body, model, tree, {depth: 0, visited: [], renderedSections: new Set()})
          : renderChoiceBranch(item, index, owner, body, model, tree, {depth: 0, visited: [], renderedSections: new Set()});
      }).join('') : renderEmpty(pureEvent ? t('previewObjectEditor.noChoiceEvent', 'This event has no player choices.') : t('objectCanvas.noOptions', 'No options found for this object.')),
      deferredRows.length ? renderDeferredChoiceSummary(deferredRows, visibleRows.length) : '',
      addOption ? structureUi().renderInlineAddAction(addOption, body) : '',
      '</section>'
    ].join('');
  }

  function choiceTreePlan(options, body) {
    return choicePathModel().choiceTreePlan(options, body, {
      sectionGroups: branchSectionGroups(body)
    });
  }

  function renderChoiceSectionRoot(item, owner, body, model, tree, context) {
    const section = item && item.section || {};
    const sectionId = normalizeEndpointToken(section && section.id || item && item.id);
    const childRows = ensureArray(item && item.children);
    const renderedSections = renderedChoiceSections(context);
    return [
      '<div class="preview-object-choice-branch is-section-root" data-preview-object-choice-section-root="' + escapeAttr(sectionId) + '" data-preview-object-choice-depth="' + escapeAttr(String(context && context.depth || 0)) + '">',
      renderChoiceNestedSection(section, childRows, owner, body, model, tree, Object.assign({}, context || {}, {
        visited: ensureArray(context && context.visited).concat(sectionId).filter(Boolean),
        renderedSections
      })),
      '</div>'
    ].join('');
  }

  function renderChoiceBranch(option, index, owner, body, model, tree, context) {
    const ctx = context || {};
    const sectionId = tree ? nextChoiceSectionId(option, body) : '';
    const normalized = normalizeEndpointToken(sectionId);
    const renderedSections = renderedChoiceSections(ctx);
    const visited = ensureArray(ctx.visited).map(normalizeEndpointToken).filter(Boolean);
    const repeated = Boolean(normalized && visited.includes(normalized)) || Number(ctx.depth || 0) >= 6;
    const childRows = tree && normalized ? ensureArray(tree.childrenBySection && tree.childrenBySection[normalized]) : [];
    const section = tree && normalized ? tree.sectionGroups && tree.sectionGroups[normalized] : null;
    const sharedSectionRendered = Boolean(normalized && renderedSections.has(normalized));
    const optionKey = normalizeEndpointToken(option && (option.id || option.optionId));
    const optionRouteOutcomes = tree && !section && optionKey ? ensureArray(tree.routeOutcomesByOption && tree.routeOutcomesByOption[optionKey]) : [];
    const nextVisited = normalized ? visited.concat([normalized]) : visited;
    const choiceHtml = renderChoice(option, index, owner, body, model, {
      suppressResultSection: (section || sharedSectionRendered) ? normalized : ''
    });
    if (!section && !sharedSectionRendered && choiceHasResultForSection(option, normalized)) {
      renderedSections.add(normalized);
    }
    return [
      '<div class="preview-object-choice-branch" data-preview-object-choice-branch="' + escapeAttr(option && (option.id || option.optionId) || String(index + 1)) + '" data-preview-object-choice-depth="' + escapeAttr(String(ctx.depth || 0)) + '">',
      choiceHtml,
      optionRouteOutcomes.length ? renderRouteOutcomeBranches(optionRouteOutcomes, owner, body, model, tree, {
        depth: Number(ctx.depth || 0) + 1,
        visited: nextVisited,
        renderedSections,
        repeated
      }) : '',
      section ? (sharedSectionRendered
        ? renderChoiceSharedSectionReference(section, normalized)
        : renderChoiceNestedSection(section, childRows, owner, body, model, tree, {
        depth: Number(ctx.depth || 0) + 1,
        visited: nextVisited,
        renderedSections,
        repeated
      })) : (sharedSectionRendered && childRows.length ? renderChoiceSharedSectionReference({id: normalized, label: normalized}, normalized) : ''),
      !section && childRows.length && !repeated && !sharedSectionRendered ? renderChoiceChildren(childRows, owner, body, model, tree, {
        depth: Number(ctx.depth || 0) + 1,
        visited: nextVisited,
        renderedSections
      }) : '',
      repeated ? '<small class="preview-object-choice-loop">' + escapeHtml(t('previewObjectEditor.choiceLoopOrReturn', 'Loop or return route; nested choices stop here.')) + '</small>' : '',
      '</div>'
    ].join('');
  }

  function renderChoiceNestedSection(section, childRows, owner, body, model, tree, context) {
    const ctx = context || {};
    const renderedSections = renderedChoiceSections(ctx);
    const sectionId = normalizeEndpointToken(section && section.id);
    if (sectionId) {
      renderedSections.add(sectionId);
    }
    const fields = ensureArray(section && section.fields);
    const visibleFields = fields.filter((field) => !isSectionLogicField(field)).slice(0, 3);
    const addAction = firstAddOptionAction(body, section && section.id);
    const routeOutcomes = tree && section && section.id ? ensureArray(tree.routeOutcomesBySection && tree.routeOutcomesBySection[normalizeEndpointToken(section.id)]) : [];
    return [
      '<section class="preview-object-choice-nested-section" data-preview-object-choice-nested-section="' + escapeAttr(section && section.id || '') + '">',
      '<header>',
      '<span>' + escapeHtml(t('previewObjectEditor.choiceResultStep', 'Result / next step')) + '</span>',
      '<strong>' + escapeHtml(section && (section.label || section.id) || t('previewObjectEditor.sceneStep', 'Scene step')) + '</strong>',
      section && section.condition ? '<code>' + escapeHtml(section.condition) + '</code>' : '',
      '</header>',
      visibleFields.map((field) => renderInlineField(field, {
        role: branchFieldRole(field),
        element: 'textarea',
        fallbackLabel: branchLabel(field),
        assetBaseUrl: previewTextOptions(body, model).assetBaseUrl
      })).join(''),
      renderSectionLogicPanel(section, fields, body, model, sectionEffectFields(section && section.id, body)),
      addAction ? structureUi().renderInlineAddAction(addAction, body) : '',
      routeOutcomes.length && !ctx.repeated ? renderRouteOutcomeBranches(routeOutcomes, owner, body, model, tree, ctx) : '',
      ensureArray(childRows).length && !ctx.repeated ? renderChoiceChildren(childRows, owner, body, model, tree, ctx) : '',
      '</section>'
    ].join('');
  }

  function routeOutcomeIndex(body, sectionGroups) {
    return choicePathModel().routeOutcomeIndex(body, sectionGroups || branchSectionGroups(body));
  }

  function renderRouteOutcomeBranches(outcomes, owner, body, model, tree, context) {
    const rows = ensureArray(outcomes).filter(Boolean);
    if (!rows.length) {
      return '';
    }
    return [
      '<section class="preview-object-route-outcomes" data-preview-object-route-outcomes="true">',
      '<div class="preview-object-route-outcomes-title">' + escapeHtml(t('previewObjectEditor.routeOutcomes', 'Route outcomes')) + '</div>',
      rows.map((outcome) => renderRouteOutcome(outcome, owner, body, model, tree, context)).join(''),
      '</section>'
    ].join('');
  }

  function renderRouteOutcome(outcome, owner, body, model, tree, context) {
    const section = outcome && outcome.section || null;
    const fields = ensureArray(section && section.fields);
    const visibleFields = fields.filter((field) => !isSectionLogicField(field)).slice(0, 2);
    const childRows = tree && outcome && outcome.targetKey ? ensureArray(tree.childrenBySection && tree.childrenBySection[outcome.targetKey]) : [];
    const routeField = outcome && outcome.routeField;
    const predicateField = outcome && outcome.predicateField;
    const effectFields = sectionEffectFields(outcome && outcome.targetKey || section && section.id, body);
    const ctx = context || {};
    const renderedSections = renderedChoiceSections(ctx);
    const visited = ensureArray(ctx.visited).map(normalizeEndpointToken).filter(Boolean);
    const targetKey = normalizeEndpointToken(outcome && outcome.targetKey);
    const sharedSectionRendered = Boolean(section && targetKey && renderedSections.has(targetKey));
    const repeated = Boolean(targetKey && visited.includes(targetKey)) || Boolean(ctx.repeated);
    const nextCtx = Object.assign({}, ctx, {
      depth: Number(ctx.depth || 0) + 1,
      visited: targetKey ? visited.concat([targetKey]) : visited,
      renderedSections,
      repeated
    });
    if (section && targetKey && !sharedSectionRendered && !repeated) {
      renderedSections.add(targetKey);
    }
    return [
      '<article class="preview-object-route-outcome" data-preview-object-route-outcome="' + escapeAttr(outcome && outcome.targetKey || '') + '">',
      '<header>',
      '<span>' + escapeHtml(t('previewObjectEditor.conditionalOutcome', 'Conditional outcome')) + '</span>',
      '<strong>' + escapeHtml(section && (section.label || section.id) || outcome && (outcome.label || outcome.targetKey) || '') + '</strong>',
      outcome && outcome.condition ? '<code>' + escapeHtml(t('previewObjectEditor.when', 'When') + ': ' + outcome.condition) + '</code>' : '',
      '</header>',
      predicateField ? '<div class="preview-object-route-outcome-target">' + renderInlineField(predicateField, {
        role: 'route-outcome-condition',
        element: logicFieldElement(predicateField),
        fallbackLabel: t('previewObjectEditor.when', 'When')
      }) + '</div>' : '',
      routeField ? '<div class="preview-object-route-outcome-target">' + renderInlineField(routeField, {
        role: 'route-outcome-target',
        element: logicFieldElement(routeField),
        fallbackLabel: t('previewObjectEditor.routeTarget', 'Route target')
      }) + '</div>' : '',
      sharedSectionRendered ? renderChoiceSharedSectionReference(section, targetKey) : '',
      !sharedSectionRendered ? visibleFields.map((field) => renderInlineField(field, {
        role: branchFieldRole(field),
        element: 'textarea',
        fallbackLabel: branchLabel(field),
        assetBaseUrl: previewTextOptions(body, model).assetBaseUrl
      })).join('') : '',
      section && !sharedSectionRendered ? renderSectionLogicPanel(section, fields, body, model, effectFields) : '',
      childRows.length && !repeated && !sharedSectionRendered ? renderChoiceChildren(childRows, owner, body, model, tree, nextCtx) : '',
      repeated ? '<small class="preview-object-choice-loop">' + escapeHtml(t('previewObjectEditor.choiceLoopOrReturn', 'Loop or return route; nested choices stop here.')) + '</small>' : '',
      '</article>'
    ].join('');
  }

  function renderChoiceChildren(rows, owner, body, model, tree, context) {
    const ctx = context || {};
    return [
      '<div class="preview-object-choice-children" data-preview-object-choice-children="true">',
      ensureArray(rows).map((option, index) => renderChoiceBranch(option, index, owner, body, model, tree, ctx)).join(''),
      '</div>'
    ].join('');
  }

  function nextChoiceSectionId(option, body) {
    return choicePathModel().nextChoiceSectionId(option, body);
  }

  function choiceHasResultForSection(option, sectionId) {
    const target = normalizeEndpointToken(sectionId);
    if (!target) {
      return false;
    }
    return ensureArray(option && option.resultFields).some((field) => normalizeEndpointToken(field && field.sectionId) === target);
  }

  function renderedChoiceSections(context) {
    const value = context && context.renderedSections;
    return value && typeof value.add === 'function' && typeof value.has === 'function'
      ? value
      : new Set();
  }

  function renderChoiceSharedSectionReference(section, sectionId) {
    const label = section && (section.label || section.id) || sectionId || '';
    return [
      '<aside class="preview-object-choice-shared-section" data-preview-object-choice-shared-section="' + escapeAttr(sectionId || '') + '">',
      '<strong>' + escapeHtml(t('previewObjectEditor.sharedChoiceStep', 'Shared step')) + '</strong>',
      '<span>' + escapeHtml(label) + '</span>',
      '<small>' + escapeHtml(t('previewObjectEditor.sharedChoiceStepNote', 'Already editable above in this player path.')) + '</small>',
      '</aside>'
    ].join('');
  }

  function firstAddOptionAction(body, sectionId) {
    const section = normalizeEndpointToken(sectionId || '');
    return ensureArray(body && body.structureActions).find((field) => {
      if (String(field && field.structureAction || '') !== 'add_option') {
        return false;
      }
      const actionSection = normalizeEndpointToken(field && field.sectionId);
      return section ? actionSection === section : !actionSection;
    }) || null;
  }

  function renderAssetEditorPanel(body, target, model) {
    const value = body && typeof body === 'object' ? body : {};
    return assetEditorUi().renderPreviewAssets(value.assets, target, {
      assetCatalog: value.assetCatalog,
      assetAddFields: value.assetAddFields,
      forcePanel: model && model.mode !== 'existing',
      showControls: model && model.mode !== 'existing',
      showAddControls: model && model.mode === 'existing',
      showReplacementControls: model && model.mode === 'existing'
    });
  }

  function largeEventRenderPlan(body) {
    const options = ensureArray(body && body.options).length;
    const branches = ensureArray(body && body.branchSections).length;
    const structureActions = ensureArray(body && body.structureActions).length;
    const isLarge = options > LARGE_EVENT_CHOICE_THRESHOLD ||
      branches > LARGE_EVENT_BRANCH_THRESHOLD ||
      structureActions > LARGE_EVENT_STRUCTURE_THRESHOLD;
    if (!isLarge) {
      return null;
    }
    return {
      choiceLimit: LARGE_EVENT_CHOICE_LIMIT,
      branchLimit: LARGE_EVENT_BRANCH_LIMIT
    };
  }

  function renderDeferredChoiceSummary(rows, offset) {
    const count = ensureArray(rows).length;
    if (!count) {
      return '';
    }
    const sliceUi = objectEditorDeferredSlice();
    return [
      '<details class="preview-object-large-deferred" data-preview-object-large-deferred="choices" data-preview-object-deferred-count="' + escapeAttr(String(count)) + '">',
      '<summary>' + escapeHtml(t('previewObjectEditor.largeEventDeferredChoices', '{count} additional choices summarized').replace('{count}', String(count))) + '</summary>',
      '<div class="preview-object-large-deferred-list">',
      sliceUi
        ? sliceUi.renderDeferredChoiceList(rows, {renderRow: renderDeferredChoiceRow, offset})
        : ensureArray(rows).slice(0, 10).map((option, index) => renderDeferredChoiceRow(option, offset + index)).join('') +
          (count > 10 ? '<small>' + escapeHtml(t('previewObjectEditor.largeEventDeferredMore', '{count} more rows').replace('{count}', String(count - 10))) + '</small>' : ''),
      '</div>',
      '</details>'
    ].join('');
  }

  function renderDeferredChoiceRow(option, index) {
    const target = option && (option.targetId || option.gotoAfter || option.rawTargetId || '');
    const owner = option && (option.sectionLabel || option.sectionId || '');
    return [
      '<article data-preview-object-deferred-choice="' + escapeAttr(option && option.id || String(index + 1)) + '">',
      '<b>' + escapeHtml(String(index + 1)) + '</b>',
      '<strong>' + renderTextInline(option && (option.label || option.title || option.id) || '') + '</strong>',
      target ? '<small>' + escapeHtml(t('objectCanvas.optionTarget', 'Target') + ': ' + target) + '</small>' : '',
      owner ? '<small>' + escapeHtml(owner) + '</small>' : '',
      '</article>'
    ].join('');
  }

  function renderDeferredBranchSummary(rows) {
    const count = ensureArray(rows).length;
    if (!count) {
      return '';
    }
    const sliceUi = objectEditorDeferredSlice();
    return [
      '<details class="preview-object-large-deferred" data-preview-object-large-deferred="branches" data-preview-object-deferred-count="' + escapeAttr(String(count)) + '">',
      '<summary>' + escapeHtml(t('previewObjectEditor.largeEventDeferredBranches', '{count} additional text blocks summarized').replace('{count}', String(count))) + '</summary>',
      '<div class="preview-object-large-deferred-list">',
      sliceUi
        ? sliceUi.renderDeferredBranchList(rows, {renderRow: renderDeferredBranchRow})
        : ensureArray(rows).slice(0, 10).map(renderDeferredBranchRow).join('') +
          (count > 10 ? '<small>' + escapeHtml(t('previewObjectEditor.largeEventDeferredMore', '{count} more rows').replace('{count}', String(count - 10))) + '</small>' : ''),
      '</div>',
      '</details>'
    ].join('');
  }

  function renderDeferredBranchRow(field) {
    const label = branchLabel(field);
    const section = String(field && field.sectionId || '').trim();
    const condition = branchConditionText(field);
    return [
      '<article data-preview-object-deferred-branch="' + escapeAttr(fieldId(field) || section || label) + '">',
      '<strong>' + escapeHtml(label || section || t('previewObjectEditor.branchText', 'Conditional and follow-up text')) + '</strong>',
      section ? '<small>' + escapeHtml(section) + '</small>' : '',
      condition ? '<code>' + escapeHtml(condition) + '</code>' : '',
      '</article>'
    ].join('');
  }

  function renderLogicEditor(body, owner) {
    const consumed = choiceOwnedLogicFieldIds(body);
    const meta = ensureArray(body && body.metaFields).filter((field) => {
      if (owner === 'event' && openingContextUi().isOpeningContextField(field)) {
        return false;
      }
      const id = fieldId(field);
      return !(id && consumed.has(id));
    });
    const variables = ensureArray(body && body.variables);
    const backgroundEffects = ensureArray(body && body.backgroundEffects);
    const triggerEffects = ensureArray(body && body.effects);
    const triggerActions = structureUi().triggerStructureActions(body);
    const pureEvent = String(body && body.eventShape || '') === 'pure_event';
    if (!meta.length && !variables.length && !backgroundEffects.length && !triggerEffects.length && !triggerActions.length) {
      return '';
    }
    if (pureEvent) {
      return [
        '<details class="preview-object-logic-details" open data-preview-object-logic="true" data-event-archetype="pure_event">',
        '<summary>' + escapeHtml(t('previewObjectEditor.textEventLogic', 'Text event conditions and effects')) + '</summary>',
        renderGroupedTriggerEffects(triggerEffects, triggerActions, body),
        meta.length
          ? '<section class="preview-object-logic-section"><h4>' + escapeHtml(t('previewObjectEditor.conditions', 'Conditions and scheduling')) + '</h4>' + meta.map((field) => renderInlineField(field, {
            role: 'logic',
            element: logicFieldElement(field)
          })).join('') + '</section>'
          : '',
        backgroundEffects.length
          ? '<section class="preview-object-logic-section"><h4>' + escapeHtml(t('previewObjectEditor.backgroundEffects', 'Background writes')) + '</h4>' + renderBackgroundEffectRows(backgroundEffects) + '</section>'
          : '',
        variables.length
          ? '<details class="preview-object-logic-section" data-preview-object-variable-details="true"><summary>' + escapeHtml(t('previewObjectEditor.stateVariables', 'State variables')) + '</summary>' + renderVariableRows(variables) + '</details>'
          : '',
        '</details>'
      ].join('');
    }
    return [
      '<details class="preview-object-logic-details" open data-preview-object-logic="true">',
      '<summary>' + escapeHtml(t('previewObjectEditor.logic', 'Conditions, routes, and effects')) + '</summary>',
      meta.length
        ? '<section class="preview-object-logic-section"><h4>' + escapeHtml(t('previewObjectEditor.conditions', 'Conditions and scheduling')) + '</h4>' + meta.map((field) => renderInlineField(field, {
          role: 'logic',
          element: logicFieldElement(field)
        })).join('') + '</section>'
        : '',
      variables.length
        ? '<section class="preview-object-logic-section"><h4>' + escapeHtml(t('previewObjectEditor.stateVariables', 'State variables')) + '</h4>' + renderVariableRows(variables) + '</section>'
        : '',
      backgroundEffects.length
        ? '<section class="preview-object-logic-section"><h4>' + escapeHtml(t('previewObjectEditor.backgroundEffects', 'Background writes')) + '</h4>' + renderBackgroundEffectRows(backgroundEffects) + '</section>'
        : '',
      renderGroupedTriggerEffects(triggerEffects, triggerActions, body),
      '</details>'
    ].join('');
  }

  function effectHookName(field) {
    return String(field && (field.effectHook || field.hook) || '').trim().toLowerCase();
  }

  function renderGroupedTriggerEffects(effects, actions, body) {
    var arrival = effects.filter(function(field) { return effectHookName(field) !== 'on-departure' && effectHookName(field) !== 'on-display'; });
    var departure = effects.filter(function(field) { return effectHookName(field) === 'on-departure'; });
    var display = effects.filter(function(field) { return effectHookName(field) === 'on-display'; });
    var parts = [];
    if (arrival.length || actions.length) {
      parts.push('<section class="preview-object-logic-section"><h4>' + escapeHtml(t('previewObjectEditor.triggerEffects', 'Trigger effects')) + '</h4>' + renderEffectFields(arrival.concat(actions), body) + '</section>');
    }
    if (departure.length) {
      parts.push('<section class="preview-object-logic-section"><h4>' + escapeHtml(t('previewObjectEditor.departureEffects', 'Departure effects')) + '</h4>' + renderEffectFields(departure, body) + '</section>');
    }
    if (display.length) {
      parts.push('<section class="preview-object-logic-section"><h4>' + escapeHtml(t('previewObjectEditor.displayEffects', 'Display effects')) + '</h4>' + renderEffectFields(display, body) + '</section>');
    }
    return parts.join('');
  }

  function choiceOwnedLogicFieldIds(body) {
    const ids = new Set();
    ensureArray(body && body.options).forEach((option) => {
      ensureArray(option && option.fields).forEach((field) => {
        const id = fieldId(field);
        if (id) {
          ids.add(id);
        }
      });
    });
    const routeOutcomes = routeOutcomeIndex(body, branchSectionGroups(body));
    Object.keys(routeOutcomes.byOption || {}).concat(Object.keys(routeOutcomes.bySection || {})).forEach((ownerKey) => {
      ensureArray(routeOutcomes.byOption && routeOutcomes.byOption[ownerKey]).concat(ensureArray(routeOutcomes.bySection && routeOutcomes.bySection[ownerKey])).forEach((outcome) => {
        [outcome && outcome.routeField, outcome && outcome.predicateField].forEach((field) => {
          const id = fieldId(field);
          if (id) {
            ids.add(id);
          }
        });
      });
    });
    return ids;
  }

  function renderVariableRows(variables) {
    return [
      '<div class="preview-object-variable-context" data-preview-object-variable-context="true">',
      ensureArray(variables).slice(0, 16).map((variable) => {
        const reads = ensureArray(variable && variable.reads);
        const writes = ensureArray(variable && variable.writes);
        const access = [
          reads.length ? t('previewObjectEditor.reads', 'reads') + ' ' + reads.length : '',
          writes.length ? t('previewObjectEditor.writes', 'writes') + ' ' + writes.length : ''
        ].filter(Boolean).join(' / ');
        const source = sourceList(reads, writes);
        return [
          '<article>',
          '<strong>Q.' + escapeHtml(variable && variable.name || '') + '</strong>',
          access ? '<small>' + escapeHtml(access) + '</small>' : '',
          source ? '<code>' + escapeHtml(source) + '</code>' : '',
          '</article>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderBackgroundEffectRows(effects) {
    return [
      '<div class="preview-object-background-effects" data-preview-object-background-effects="true">',
      ensureArray(effects).slice(0, 16).map((effect) => {
        const expression = effectExpressionLabel(effect);
        const source = sourceLabelFromRef(effect && effect.source);
        return [
          '<article>',
          '<strong>' + escapeHtml(expression) + '</strong>',
          source ? '<code>' + escapeHtml(source) + '</code>' : '',
          effect && effect.sectionId ? '<small>' + escapeHtml(t('previewObjectEditor.section', 'Section') + ': ' + effect.sectionId) + '</small>' : '',
          '</article>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderEffectFields(fields, body) {
    const semantic = semanticOperationsApi();
    if (semantic && typeof semantic.buildEffectOperations === 'function') {
      const operations = semantic.buildEffectOperations(fields, {
        variables: semantic.variableEvidenceMap && semantic.variableEvidenceMap({variables: body && body.variablePickerCandidates || []})
      });
      return renderSemanticEffectFields(operations, body);
    }
    return renderLegacyEffectFields(fields, body);
  }

  function renderLegacyEffectFields(fields, body) {
    const rows = pairedEffectRows(fields);
    return '<div class="preview-object-effect-fields">' + rows.map((row) => {
      if (row.kind === 'add') {
        return structureUi().renderInlineAddAction(row.field, body);
      }
      if (row.kind === 'structure') {
        return structureUi().renderCompactStructureAction(row.field, body);
      }
      if (row.kind === 'effect-delete') {
        return renderDeleteOnlyEffectRow(row.field, body);
      }
      return renderEffectRow(row.field, row.removeAction, body);
    }).join('') + '</div>';
  }

  function renderSemanticEffectFields(operations, body) {
    const cards = ensureArray(operations && operations.cards);
    const advanced = ensureArray(operations && operations.advancedItems);
    const structureRows = ensureArray(operations && operations.structureRows);
    const html = cards.map((card) => renderSemanticEffectCard(card, body))
      .concat(advanced.map((card) => renderSemanticAdvancedEffectCard(card, body)))
      .concat(structureRows.map((row) => renderSemanticEffectStructureRow(row, body)))
      .join('');
    return html ? '<div class="preview-object-effect-fields is-semantic-effects" data-object-canvas-semantic-effects="true">' + html + '</div>' : '';
  }

  function renderSemanticEffectStructureRow(row, body) {
    if (!row) {
      return '';
    }
    if (row.kind === 'add') {
      return structureUi().renderInlineAddAction(row.field, body);
    }
    if (row.kind === 'structure') {
      return structureUi().renderCompactStructureAction(row.field, body);
    }
    if (row.kind === 'effect-delete') {
      return renderSemanticDeleteOnlyEffectRow(row.field, body);
    }
    return '';
  }

  function renderSemanticEffectCard(card, body) {
    const sourceFieldId = card && card.sourceFieldId || '';
    const variable = card && card.variable || '';
    const op = card && card.op || '+=';
    const value = card && card.value || '';
    const condition = card && card.condition || '';
    return [
      '<article class="preview-object-semantic-effect-card" data-object-canvas-semantic-card="state_change"' + (sourceFieldId ? ' data-object-canvas-effect-source-field="' + escapeAttr(sourceFieldId) + '"' : '') + '>',
      '<header>',
      '<span>' + escapeHtml(t('previewObjectEditor.semanticEffect.title', 'State change')) + '</span>',
      card && card.removeAction ? renderSemanticEffectDeleteControl(card.removeAction, body) : '',
      '</header>',
      renderSemanticEffectSummary(variable, op, value, condition),
      '<div class="preview-object-semantic-effect-grid">',
      renderSemanticEffectPart(card, 'variable', t('previewObjectEditor.semanticEffect.variable', 'Variable ID'), variable, {field: card && card.fields && card.fields.variable}),
      renderSemanticEffectPart(card, 'op', t('previewObjectEditor.semanticEffect.operation', 'Change'), op, {field: card && card.fields && card.fields.op, options: semanticEffectOperatorOptions()}),
      renderSemanticEffectPart(card, 'value', t('previewObjectEditor.semanticEffect.value', 'Value / expression'), value, {field: card && card.fields && card.fields.value}),
      renderSemanticEffectPart(card, 'condition', t('previewObjectEditor.semanticEffect.condition', 'Only when'), condition, {field: card && card.fields && card.fields.condition, emptyLabel: t('previewObjectEditor.semanticEffect.noCondition', 'Always')}),
      '</div>',
      renderSemanticVariableEvidence(card && card.variableEvidence),
      renderSemanticEffectSourceControl(card),
      renderSemanticEffectEvidence(card),
      '</article>'
    ].join('');
  }

  function renderSemanticEffectSummary(variable, op, value, condition) {
    const opLabel = semanticEffectOperatorLabel(op);
    return [
      '<div class="preview-object-semantic-effect-summary" data-object-canvas-state-change-summary="true">',
      '<span>' + escapeHtml(t('previewObjectEditor.semanticEffect.summaryPrefix', 'Change')) + '</span>',
      variable ? '<code>' + escapeHtml(variable) + '</code>' : '<em>' + escapeHtml(t('previewObjectEditor.semanticEffect.missingVariable', 'choose a variable')) + '</em>',
      '<strong>' + escapeHtml(opLabel) + '</strong>',
      value ? '<code>' + escapeHtml(value) + '</code>' : '<em>' + escapeHtml(t('previewObjectEditor.semanticEffect.missingValue', 'enter a value')) + '</em>',
      condition ? '<span class="preview-object-semantic-effect-condition">' + escapeHtml(t('previewObjectEditor.semanticEffect.when', 'when')) + ' <code>' + escapeHtml(condition) + '</code></span>' : '',
      '</div>'
    ].join('');
  }

  function semanticEffectOperatorOptions() {
    return [
      {value: '=', label: semanticEffectOperatorLabel('=') + ' (=)'},
      {value: '+=', label: semanticEffectOperatorLabel('+=') + ' (+=)'},
      {value: '-=', label: semanticEffectOperatorLabel('-=') + ' (-=)'}
    ];
  }

  function semanticEffectOperatorLabel(op) {
    const value = String(op || '').trim();
    if (value === '=') {
      return t('previewObjectEditor.semanticEffect.op.set', 'set to');
    }
    if (value === '+=') {
      return t('previewObjectEditor.semanticEffect.op.increase', 'increase by');
    }
    if (value === '-=') {
      return t('previewObjectEditor.semanticEffect.op.decrease', 'decrease by');
    }
    if (value === '*=') {
      return t('previewObjectEditor.semanticEffect.op.multiply', 'multiply by');
    }
    if (value === '/=') {
      return t('previewObjectEditor.semanticEffect.op.divide', 'divide by');
    }
    return value || t('previewObjectEditor.semanticEffect.op.change', 'change by');
  }

  function renderSemanticEffectPart(card, part, label, value, options) {
    const opts = options || {};
    const field = opts.field || null;
    const text = field ? fieldValue(field) : String(value || '');
    const fieldIdValue = fieldId(field);
    const sourceFieldId = card && card.sourceFieldId || '';
    const data = fieldIdValue
      ? ' data-object-canvas-field="' + escapeAttr(fieldIdValue) + '" data-editing-field="' + escapeAttr(fieldIdValue) + '" data-object-canvas-original="' + escapeAttr(field && field.original !== undefined ? field.original : field && field.value || '') + '"'
      : sourceFieldId ? ' data-object-canvas-effect-part="' + escapeAttr(part) + '" data-object-canvas-effect-target="' + escapeAttr(sourceFieldId) + '"' : '';
    const common = ' class="preview-object-semantic-effect-input"';
    const control = opts.options
      ? '<select' + common + data + '>' + opts.options.map((option) => {
        const optionValue = typeof option === 'object' ? String(option.value || '') : String(option || '');
        const optionLabel = typeof option === 'object' ? String(option.label || optionValue) : optionValue;
        return '<option value="' + escapeAttr(optionValue) + '"' + (optionValue === text ? ' selected' : '') + '>' + escapeHtml(optionLabel) + '</option>';
      }).join('') + '</select>'
      : '<input type="text"' + common + data + ' value="' + escapeAttr(text) + '" placeholder="' + escapeAttr(opts.emptyLabel || '') + '">';
    return [
      '<label class="preview-object-semantic-effect-part is-' + escapeAttr(safeClass(part)) + '">',
      '<span>' + escapeHtml(label) + '</span>',
      control,
      field && part === 'variable' ? renderFieldVariablePicker(field, fieldPresentation(field, {fallbackLabel: label}), false) : '',
      field && part === 'condition' ? renderFieldVariablePicker(field, fieldPresentation(field, {fallbackLabel: label}), false) : '',
      '</label>'
    ].join('');
  }

  function renderSemanticEffectSourceControl(card) {
    if (!card || !card.sourceFieldId) {
      return '';
    }
    const original = card.field && card.field.original !== undefined ? String(card.field.original || '') : String(card.sourceExpression || '');
    const current = card.field ? fieldValue(card.field) : String(card.sourceExpression || original);
    return '<textarea class="preview-object-semantic-effect-source-field" data-object-canvas-field="' + escapeAttr(card.sourceFieldId) + '" data-editing-field="' + escapeAttr(card.sourceFieldId) + '" data-object-canvas-original="' + escapeAttr(original) + '" aria-hidden="true" tabindex="-1">' + escapeHtml(current) + '</textarea>';
  }

  function renderSemanticEffectEvidence(card) {
    const evidence = card && card.evidence || {};
    const source = evidence.sourceLabel || '';
    const expression = card && card.sourceExpression || evidence.sourceExpression || '';
    if (!source && !expression) {
      return '';
    }
    return [
      '<details class="preview-object-semantic-source-evidence">',
      '<summary>' + escapeHtml(t('previewObjectEditor.semanticEffect.sourceEvidence', 'Source evidence')) + '</summary>',
      expression ? '<code>' + escapeHtml(expression) + '</code>' : '',
      source ? '<small>' + escapeHtml(source) + '</small>' : '',
      evidence.sharedSourceLine ? '<small>' + escapeHtml(t('previewObjectEditor.semanticEffect.sharedLine', 'Shared source line')) + '</small>' : '',
      '</details>'
    ].join('');
  }

  function renderSemanticVariableEvidence(evidence) {
    if (!evidence) {
      return '';
    }
    const pieces = [];
    pieces.push(t('previewObjectEditor.semanticEffect.reads', 'reads') + ' ' + Number(evidence.readCount || 0));
    pieces.push(t('previewObjectEditor.semanticEffect.writes', 'writes') + ' ' + Number(evidence.writeCount || 0));
    const hints = ensureArray(evidence.sourceHints).slice(0, 1);
    return [
      '<details class="preview-object-semantic-variable-evidence">',
      '<summary>' + escapeHtml(t('previewObjectEditor.semanticEffect.variableEvidence', 'Variable evidence')) + '</summary>',
      '<code>' + escapeHtml(evidence.displayName || ('Q.' + evidence.name)) + '</code>',
      '<span>' + escapeHtml(pieces.join(' · ')) + '</span>',
      hints.length ? '<small>' + escapeHtml(hints[0]) + '</small>' : '',
      '</details>'
    ].join('');
  }

  function renderSemanticAdvancedEffectCard(card, body) {
    return [
      '<article class="preview-object-semantic-effect-card is-advanced-source" data-object-canvas-semantic-card="advanced_source">',
      '<header>',
      '<span>' + escapeHtml(t('previewObjectEditor.semanticEffect.advancedTitle', 'Advanced effect source')) + '</span>',
      card && card.removeAction ? renderSemanticEffectDeleteControl(card.removeAction, body) : '',
      '</header>',
      card && card.field ? renderInlineField(card.field, {role: 'effect', element: logicFieldElement(card.field)}) : '',
      renderSemanticEffectEvidence(card),
      '</article>'
    ].join('');
  }

  function renderSemanticDeleteOnlyEffectRow(field, body) {
    const context = structureUi().structureActionContext(field);
    return [
      '<article class="preview-object-semantic-effect-card is-delete-only" data-object-canvas-semantic-card="state_change_delete">',
      '<header><span>' + escapeHtml(t('previewObjectEditor.semanticEffect.deleteOnlyTitle', 'Remove state change')) + '</span></header>',
      context ? '<code>' + escapeHtml(context) + '</code>' : '',
      renderSemanticEffectDeleteControl(field, body),
      '</article>'
    ].join('');
  }

  function renderSemanticEffectDeleteControl(field, body) {
    const id = fieldId(field);
    const original = field && field.original !== undefined ? String(field.original || '') : 'false';
    const safety = structureUi().structureActionSafetyLabel(body, field);
    return [
      '<label class="preview-object-semantic-effect-delete preview-object-action-remove_effect" data-preview-object-effect-delete="true">',
      id ? '<input type="checkbox" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '" data-object-canvas-original="' + escapeAttr(original) + '">' : '',
      '<span>' + escapeHtml(t('previewObjectEditor.semanticEffect.remove', 'Remove')) + '</span>',
      safety ? '<small class="preview-object-structure-safety">' + escapeHtml(safety) + '</small>' : '',
      '</label>'
    ].join('');
  }

  function pairedEffectRows(fields) {
    const normal = [];
    const removeActions = [];
    const addActions = [];
    const otherStructure = [];
    ensureArray(fields).forEach((field) => {
      const action = String(field && field.structureAction || '');
      if (action === 'remove_effect') {
        removeActions.push(field);
        return;
      }
      if (/^add_/.test(action)) {
        addActions.push(field);
        return;
      }
      if (action) {
        otherStructure.push(field);
        return;
      }
      normal.push(field);
    });
    const usedRemove = new Set();
    const rows = normal.map((field) => {
      const removeAction = matchingRemoveEffectAction(field, removeActions, usedRemove);
      if (removeAction) {
        usedRemove.add(removeAction);
      }
      return {kind: 'effect', field, removeAction};
    });
    removeActions.forEach((field) => {
      if (!usedRemove.has(field)) {
        rows.push({kind: 'effect-delete', field});
      }
    });
    otherStructure.forEach((field) => rows.push({kind: 'structure', field}));
    addActions.forEach((field) => rows.push({kind: 'add', field}));
    return rows;
  }

  function matchingRemoveEffectAction(field, removeActions, usedRemove) {
    const key = normalizedEffectKey(fieldValue(field));
    if (!key) {
      return null;
    }
    let best = null;
    let bestScore = 0;
    removeActions.forEach((action) => {
      if (usedRemove.has(action)) {
        return;
      }
      const actionKey = normalizedEffectKey(action && (action.structureBefore || action.structureSourceExpression || action.before || action.value || action.original));
      if (!actionKey || actionKey !== key) {
        return;
      }
      const score = effectMatchScore(field, action);
      if (score > bestScore) {
        best = action;
        bestScore = score;
      }
    });
    return best;
  }

  function effectMatchScore(field, action) {
    let score = 1;
    if (String(field && field.optionId || '').trim() && String(field && field.optionId || '').trim() === String(action && action.optionId || '').trim()) {
      score += 3;
    }
    if (String(field && field.sectionId || '').trim() && String(field && field.sectionId || '').trim() === String(action && action.sectionId || '').trim()) {
      score += 2;
    }
    const fieldSource = field && field.source || {};
    const actionSource = action && action.source || {};
    if (String(fieldSource.path || '') && String(fieldSource.path || '') === String(actionSource.path || '')) {
      score += 1;
    }
    const fieldLine = Number(fieldSource.line || fieldSource.startLine || 0);
    const actionLine = Number(actionSource.line || actionSource.startLine || 0);
    if (fieldLine && actionLine && fieldLine === actionLine) {
      score += 4;
    }
    return score;
  }

  function normalizedEffectKey(value) {
    return String(value || '')
      .replace(/^\s*on-(?:arrival|departure|display)\s*:\s*/i, '')
      .replace(/;\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function renderEffectRow(field, removeAction, body) {
    const id = fieldId(field);
    return [
      '<article class="preview-object-effect-row' + (removeAction ? ' has-delete-action' : '') + '" data-preview-object-effect-row="true"' + (id ? ' data-preview-object-effect-field-id="' + escapeAttr(id) + '"' : '') + '>',
      renderInlineField(field, {
        role: 'effect',
        element: logicFieldElement(field)
      }),
      removeAction ? renderEffectDeleteControl(removeAction, body) : '',
      '</article>'
    ].join('');
  }

  function renderDeleteOnlyEffectRow(field, body) {
    const context = structureUi().structureActionContext(field);
    return [
      '<article class="preview-object-effect-row has-delete-action is-delete-only" data-preview-object-effect-row="true">',
      '<div class="preview-object-effect-readonly">',
      '<span>' + escapeHtml(t('previewObjectEditor.effectDeleteOnly', 'Effect')) + '</span>',
      context ? '<code>' + escapeHtml(context) + '</code>' : '',
      '</div>',
      renderEffectDeleteControl(field, body),
      '</article>'
    ].join('');
  }

  function renderEffectDeleteControl(field, body) {
    const id = fieldId(field);
    const original = field && field.original !== undefined ? String(field.original || '') : 'false';
    const safety = structureUi().structureActionSafetyLabel(body, field);
    const context = structureUi().structureActionContext(field);
    return [
      '<label class="preview-object-effect-delete preview-object-action-remove_effect" data-preview-object-effect-delete="true">',
      id ? '<input type="checkbox" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '" data-object-canvas-original="' + escapeAttr(original) + '">' : '',
      '<span>' + escapeHtml(t('previewObjectEditor.deleteEffect', 'Delete effect')) + '</span>',
      context ? '<code>' + escapeHtml(context) + '</code>' : '',
      safety ? '<small class="preview-object-structure-safety">' + escapeHtml(safety) + '</small>' : '',
      '</label>'
    ].join('');
  }

  function logicFieldElement(field) {
    return field && field.inputType === 'checkbox'
      ? 'checkbox'
      : field && field.inputType === 'select' ? 'select' : field && field.inputType === 'textarea' ? 'textarea' : 'input';
  }

  function renderChoice(option, index, owner, eventBody, model, renderOptions) {
    const rawFields = ensureArray(option && option.fields);
    const opts = renderOptions || {};
    const nextSection = owner === 'event' ? nextChoiceSectionId(option, eventBody) : '';
    const fields = choiceCardFields(option, rawFields, owner, eventBody, nextSection);
    const label = choiceLabelField(option, fields, owner, index);
    const resultFields = choiceCardResultFields(option, fields, opts.suppressResultSection);
    const resultField = resultFields[0] || null;
    const subtitle = firstField(fields, /subtitle/i);
    const optionAssets = assetsForOption(option, eventBody, resultFields);
    const optionAssetAddFields = assetAddFieldsForOption(option, eventBody, resultFields);
    const choiceActions = structureUi().optionStructureActions(option, eventBody);
    const effectGroup = choiceCardEffectGroup(structureUi().optionEffectGroup(option, eventBody), option, nextSection, eventBody);
    const conditionRemoveActions = choiceActions.filter((field) => String(field && field.structureAction || '') === 'remove_option_condition');
    const choiceDeleteActions = choiceActions.filter((field) => ['remove_option', 'move_option_up', 'move_option_down'].includes(String(field && field.structureAction || '')));
    const choiceEffectActions = choiceActions.filter((field) => choiceEffectActionBelongsOnChoice(field, option, nextSection, eventBody));
    const resultActions = structureUi().resultSectionActions(resultFields, eventBody);
    const logicFields = choiceLogicFields(fields);
    const consumedFields = [label, resultField, subtitle].concat(resultFields, logicFields.all, optionAssetAddFields).filter(Boolean);
    const consumedFieldRefs = new Set(consumedFields);
    const consumedFieldIds = new Set(consumedFields.map((field) => fieldId(field)).filter(Boolean));
    const rest = fields.filter((field) => !consumedFieldRefs.has(field) && !(fieldId(field) && consumedFieldIds.has(fieldId(field))));
    return [
      '<article class="preview-object-choice" data-preview-object-choice="' + escapeAttr(option && option.id || String(index + 1)) + '">',
      '<div class="preview-object-choice-main">',
      '<b>' + escapeHtml(String(index + 1)) + '</b>',
      renderInlineField(label, {
        role: 'choice-label',
        element: 'textarea',
        fallbackLabel: t('storyboard.option', 'Option') + ' ' + (index + 1)
      }),
      '</div>',
      choiceDeleteActions.length ? '<div class="preview-object-entry-actions">' + choiceDeleteActions.map((field) => structureUi().renderCompactStructureAction(field, eventBody)).join('') + '</div>' : '',
      subtitle ? renderInlineField(subtitle, {
        role: 'choice-subtitle',
        element: 'input'
      }) : '',
      renderChoiceLogicPanel(option, fields, resultFields, effectGroup, choiceEffectActions, eventBody, model, conditionRemoveActions),
      resultField ? renderInlineField(resultField, {
        role: 'choice-body',
        element: 'textarea'
      }) : '',
      assetEditorUi().renderInlineAssetPlacements(optionAssets, optionAssetAddFields, owner, eventBody, model),
      resultActions.length ? '<div class="preview-object-entry-actions preview-object-section-actions">' + resultActions.map((field) => structureUi().renderInlineAddAction(field, eventBody)).join('') + '</div>' : '',
      rest.length ? '<details class="preview-object-choice-details"><summary>' + escapeHtml(t('objectCanvas.advancedFields', 'Timing and advanced fields')) + '</summary>' + rest.map((field) => renderInlineField(field, {
        role: 'choice-detail',
        element: field && field.id && /body|text/i.test(field.id) ? 'textarea' : 'input'
      })).join('') + '</details>' : '',
      '</article>'
    ].join('');
  }

  function choiceLogicFields(fields) {
    const rows = ensureArray(fields);
    const conditions = rows.filter(isChoiceConditionField);
    const routes = rows.filter(isChoiceRouteField);
    const effects = rows.filter(isChoiceEffectField);
    return {
      conditions,
      routes,
      effects,
      all: uniqueFieldRefs(conditions.concat(routes, effects))
    };
  }

  function choiceCardResultFields(option, fields, suppressResultSection) {
    const resultFields = optionResultFields(option, fields);
    const suppressed = normalizeEndpointToken(suppressResultSection);
    if (!suppressed) {
      return resultFields;
    }
    return resultFields.filter((field) => normalizeEndpointToken(field && field.sectionId) !== suppressed);
  }

  function choiceCardFields(option, fields, owner, eventBody, nextSection) {
    if (owner !== 'event') {
      return ensureArray(fields);
    }
    const targetSection = normalizeEndpointToken(nextSection || nextChoiceSectionId(option, eventBody));
    if (!targetSection) {
      return ensureArray(fields);
    }
    return ensureArray(fields).filter((field) => {
      const section = normalizeEndpointToken(field && field.sectionId);
      if (!section || section !== targetSection) {
        return true;
      }
      return isChoiceConditionField(field) ||
        String(field && (field.role || field.semanticRole) || '') === 'option_label';
    });
  }

  function choiceCardEffectGroup(group, option, nextSection, eventBody) {
    const fields = ensureArray(group && group.fields);
    const targetSection = normalizeEndpointToken(nextSection);
    const ownerSection = normalizeEndpointToken(option && option.sectionId);
    const renderableSections = branchSectionGroups(eventBody);
    const sectionOwnedEffectIds = new Set((renderableSections[targetSection] ? sectionEffectFields(targetSection, eventBody) : [])
      .concat(renderableSections[ownerSection] ? sectionEffectFields(ownerSection, eventBody) : [])
      .map((field) => fieldId(field))
      .filter(Boolean));
    if (!group || (!targetSection && !ownerSection)) {
      return group;
    }
    const filtered = fields.filter((field) => {
      const id = fieldId(field);
      if (id && sectionOwnedEffectIds.has(id)) {
        return false;
      }
      const section = normalizeEndpointToken(field && field.sectionId);
      const fieldOption = normalizeEndpointToken(field && field.optionId);
      const currentOption = normalizeEndpointToken(option && option.id);
      if (fieldOption && currentOption) {
        return fieldOption === currentOption;
      }
      return !section || (section !== targetSection && section !== ownerSection);
    });
    return Object.assign({}, group, {fields: filtered});
  }

  function choiceEffectActionBelongsOnChoice(field, option, nextSection, eventBody) {
    const action = String(field && field.structureAction || '');
    if (!['add_option_effect', 'remove_effect'].includes(action)) {
      return false;
    }
    if (action !== 'remove_effect') {
      return true;
    }
    const targetSection = normalizeEndpointToken(nextSection);
    const ownerSection = normalizeEndpointToken(option && option.sectionId);
    const section = normalizeEndpointToken(field && field.sectionId);
    const renderableSections = branchSectionGroups(eventBody);
    const sectionOwnedEffectIds = new Set((renderableSections[targetSection] ? sectionEffectFields(targetSection, eventBody) : [])
      .concat(renderableSections[ownerSection] ? sectionEffectFields(ownerSection, eventBody) : [])
      .map((row) => fieldId(row))
      .filter(Boolean));
    const id = fieldId(field);
    if (id && sectionOwnedEffectIds.has(id)) {
      return false;
    }
    const fieldOption = normalizeEndpointToken(field && field.optionId);
    const currentOption = normalizeEndpointToken(option && option.id);
    if (fieldOption && currentOption) {
      return fieldOption === currentOption;
    }
    return !section || (section !== targetSection && section !== ownerSection);
  }

  function uniqueFieldRefs(fields) {
    const seenRefs = new Set();
    const seenIds = new Set();
    const out = [];
    ensureArray(fields).forEach((field) => {
      if (!field) {
        return;
      }
      const id = fieldId(field);
      if (seenRefs.has(field) || (id && seenIds.has(id))) {
        return;
      }
      seenRefs.add(field);
      if (id) {
        seenIds.add(id);
      }
      out.push(field);
    });
    return out;
  }

  function isChoiceConditionField(field) {
    const roleText = String(field && [field.role, field.semanticRole].filter(Boolean).join(' ') || '');
    if (/\bunavailable_text\b/.test(roleText)) {
      return true;
    }
    if (isChoiceResultField(field)) {
      return false;
    }
    const text = fieldSearchText(field);
    const role = String(field && (field.role || field.semanticRole) || '');
    return /^(?:condition|unavailable_text|option_condition)$/.test(role) ||
      /(?:chooseIf|viewIf|condition|unavailableText|unavailable[_ -]?text|unavailable-subtitle)/i.test(text);
  }

  function isChoiceRouteField(field) {
    const text = fieldSearchText(field);
    const role = String(field && (field.role || field.semanticRole) || '');
    return role === 'route' || /(?:resultMode|gotoAfter|returnTarget|routeTarget|target|goTo|\broute\b)/i.test(text);
  }

  function isChoiceEffectField(field) {
    const text = fieldSearchText(field);
    const role = String(field && (field.role || field.semanticRole) || '');
    return role === 'effect' || /(?:rawEffects|effect\.)/i.test(text);
  }

  function isSectionConditionField(field) {
    const text = fieldSearchText(field);
    const role = String(field && (field.role || field.semanticRole) || '');
    return role === 'condition' || /(?:section_condition|\.condition$|viewIf|chooseIf)/i.test(text);
  }

  function isSectionRouteField(field) {
    const text = fieldSearchText(field);
    const role = String(field && (field.role || field.semanticRole) || '');
    return role === 'route' || /(?:section_exit_route|exitTarget|returnTarget|routeTarget|goTo|\broute\b)/i.test(text);
  }

  function isSectionLogicField(field) {
    return isSectionConditionField(field) || isSectionRouteField(field);
  }

  function fieldSearchText(field) {
    return String(field && [field.id, field.key, field.role, field.semanticRole, field.branchKind, field.transform, field.structureAction].filter(Boolean).join(' ') || '');
  }

  function renderChoiceLogicPanel(option, fields, resultFields, effectGroup, choiceEffectActions, eventBody, model, conditionRemoveActions) {
    const logic = choiceLogicFields(fields);
    const conditionRemoves = ensureArray(conditionRemoveActions);
    const conditionContent = [
      renderEditableOptionConditions(option, resultFields, logic.conditions, eventBody),
      logic.conditions.length ? renderLogicFields(logic.conditions, 'choice-condition') : '',
      conditionRemoves.length ? '<div class="preview-object-entry-actions preview-object-condition-actions">' + conditionRemoves.map(function(field) { return structureUi().renderCompactStructureAction(field, eventBody); }).join('') + '</div>' : ''
    ].join('');
    const routeTarget = option && (option.targetId || option.gotoAfter || option.returnTarget || '');
    const routeContent = [
      renderChoiceRouteStateSummary(option, eventBody, fields, resultFields),
      routeTarget ? renderLogicSummaryChip(t('objectCanvas.optionTarget', 'Target'), endpointDisplay(routeTarget, model), 'route') : '',
      logic.routes.length ? renderLogicFields(logic.routes, 'choice-route') : ''
    ].join('');
    const effectFields = uniqueFieldRefs(logic.effects.concat(ensureArray(effectGroup && effectGroup.fields), choiceEffectActions));
    const effectContent = effectFields.length ? renderEffectFields(effectFields, eventBody) : '';
    const groups = [
      renderChoiceLogicGroup('gate', t('previewObjectEditor.semanticGroup.conditions', 'Conditions'), conditionContent),
      renderChoiceLogicGroup('route', t('previewObjectEditor.semanticGroup.routes', 'Result and route'), routeContent),
      renderChoiceLogicGroup('effects', t('previewObjectEditor.semanticGroup.state_changes', 'State changes'), effectContent)
    ].filter(Boolean);
    if (!groups.length) {
      return '';
    }
    return [
      '<section class="preview-object-choice-logic" data-preview-object-choice-logic="true">',
      '<h5>' + escapeHtml(t('previewObjectEditor.choiceLogic', 'Choice logic')) + '</h5>',
      groups.join(''),
      '</section>'
    ].join('');
  }

  function renderSectionLogicPanel(section, fields, body, model, effectFields) {
    const conditionFields = ensureArray(fields).filter(isSectionConditionField);
    const routeFields = ensureArray(fields).filter(isSectionRouteField);
    const effects = uniqueFieldRefs(ensureArray(effectFields));
    const conditionContent = conditionFields.length
      ? renderLogicFields(conditionFields, 'section-condition')
      : section && section.condition ? renderLogicSummaryChip(t('previewObjectEditor.when', 'When'), section.condition, 'gate') : '';
    const routeContent = [
      renderFieldRouteStateSummary(routeFields, body),
      routeFields.length ? renderLogicFields(routeFields, 'section-route') : ''
    ].join('');
    const effectContent = effects.length ? renderEffectFields(effects, body) : '';
    const groups = [
      renderChoiceLogicGroup('gate', t('previewObjectEditor.semanticGroup.conditions', 'Conditions'), conditionContent),
      renderChoiceLogicGroup('route', t('previewObjectEditor.semanticGroup.routes', 'Result and route'), routeContent),
      renderChoiceLogicGroup('effects', t('previewObjectEditor.semanticGroup.state_changes', 'State changes'), effectContent)
    ].filter(Boolean);
    if (!groups.length) {
      return '';
    }
    return [
      '<section class="preview-object-choice-logic is-section-logic" data-preview-object-section-logic="' + escapeAttr(section && section.id || '') + '">',
      '<h5>' + escapeHtml(t('previewObjectEditor.sectionLogic', 'Step logic')) + '</h5>',
      groups.join(''),
      '</section>'
    ].join('');
  }

  function renderChoiceLogicGroup(kind, label, content) {
    const html = String(content || '').trim();
    if (!html) {
      return '';
    }
    return [
      '<div class="preview-object-choice-logic-group is-' + escapeAttr(safeClass(kind || 'logic')) + '" data-preview-object-choice-logic-group="' + escapeAttr(kind || 'logic') + '">',
      '<strong>' + escapeHtml(label || '') + '</strong>',
      html,
      '</div>'
    ].join('');
  }

  function renderLogicFields(fields, role) {
    if (/condition/i.test(role || '')) {
      return renderSemanticLogicFields(fields, 'condition', role);
    }
    if (/route/i.test(role || '')) {
      return renderSemanticLogicFields(fields, 'route', role);
    }
    return ensureArray(fields).map((field) => renderInlineField(field, {
      role,
      element: logicFieldElement(field)
    })).join('');
  }

  function renderSemanticLogicFields(fields, kind, role) {
    return ensureArray(fields).map((field) => renderSemanticLogicField(field, kind, role)).join('');
  }

  function renderSemanticLogicField(field, kind, role) {
    const id = fieldId(field);
    const rawLabel = field && field.label || id || '';
    const presentation = fieldPresentation(field, {fallbackLabel: rawLabel});
    const label = semanticFieldLabel(field, rawLabel, presentation);
    const value = fieldValue(field);
    const original = field && field.original !== undefined ? String(field.original || '') : value;
    const data = id
      ? ' data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '" data-object-canvas-original="' + escapeAttr(original) + '"'
      : '';
    const readOnly = Boolean(field && (field.readOnly || !id));
    const control = renderControl({
      element: logicFieldElement(field),
      value,
      field,
      role,
      data,
      readOnly,
      controlClass: 'preview-object-semantic-logic-input preview-object-control',
      placeholder: field && field.placeholder
    });
    const overview = kind === 'route'
      ? renderSemanticRouteOverview(value, label, field)
      : renderSemanticConditionOverview(value, label);
    // Editable flat-condition rows when the byte-exact gate passes; the
    // read-only structure preview keeps covering everything the builder rejects.
    const conditionBuilderHtml = kind === 'condition'
      ? ((m) => m ? m.renderConditionBuilder(field, value, {readOnly: readOnly}) : '')(objectEditorConditionBuilder())
      : '';
    return [
      '<article class="preview-object-semantic-logic-card is-' + escapeAttr(safeClass(kind)) + '" data-object-canvas-semantic-card="' + escapeAttr(kind === 'route' ? 'route_outcome' : 'condition') + '"' + (presentation ? ' data-semantic-intent="' + escapeAttr(presentation.intent || '') + '" data-semantic-group="' + escapeAttr(presentation.group || '') + '"' : '') + '>',
      '<header>',
      '<span>' + escapeHtml(kind === 'route' ? routeCardTitle(field) : t('previewObjectEditor.semanticCondition.title', 'Condition')) + '</span>',
      renderSemanticStatusBadge(presentation, readOnly),
      '</header>',
      overview,
      '<label class="preview-object-semantic-logic-main">',
      '<span>' + escapeHtml(kind === 'route' ? t('previewObjectEditor.semanticRoute.target', 'Target') : (label || rawLabel)) + '</span>',
      control,
      '</label>',
      conditionBuilderHtml || (kind === 'condition' ? renderConditionStructurePreview(value) : ''),
      kind === 'condition' ? renderFieldVariablePicker(field, presentation, readOnly) : '',
      kind === 'route' ? renderFieldRouteTargetPicker(field, presentation, readOnly) : '',
      renderSemanticLogicEvidence(field),
      '</article>'
    ].join('');
  }

  function routeOverviewPrefix(field) {
    var intent = String(field && (field.semanticIntent || field.semanticPresentation && field.semanticPresentation.intent) || '');
    if (intent === 'jump_return_route') {
      return t('previewObjectEditor.semanticRoute.jumpPrefix', 'Set return point to');
    }
    if (intent === 'call_route') {
      return t('previewObjectEditor.semanticRoute.callPrefix', 'Call utility scene');
    }
    return t('previewObjectEditor.semanticRoute.summaryPrefix', 'After this choice, go to');
  }

  function routeCardTitle(field) {
    var intent = String(field && (field.semanticIntent || field.semanticPresentation && field.semanticPresentation.intent) || '');
    if (intent === 'jump_return_route') {
      return t('previewObjectEditor.semanticRoute.jumpTitle', 'Return point');
    }
    if (intent === 'call_route') {
      return t('previewObjectEditor.semanticRoute.callTitle', 'Scene call');
    }
    return t('previewObjectEditor.semanticRoute.title', 'Route outcome');
  }

  function renderSemanticRouteOverview(value, label, field) {
    const target = String(value || '').trim();
    const description = String(label || '').trim();
    const candidates = ensureArray(field && field.routeTargetPicker && field.routeTargetPicker.candidates);
    const match = candidates.find((c) => String(c && (c.insertValue || c.name) || '') === target);
    const titleDisplay = match && match.meaning ? String(match.meaning) : '';
    return [
      '<div class="preview-object-semantic-logic-overview is-route' + (target && !match && candidates.length ? ' is-unknown-target' : '') + '">',
      '<span>' + escapeHtml(routeOverviewPrefix(field)) + '</span>',
      target ? '<code>' + escapeHtml(target) + '</code>' : '<em>' + escapeHtml(t('previewObjectEditor.semanticRoute.missingTarget', 'choose a target')) + '</em>',
      titleDisplay ? '<small class="preview-object-route-target-title">' + escapeHtml(titleDisplay) + '</small>' : '',
      description && description !== target && description !== titleDisplay ? '<small>' + escapeHtml(description) + '</small>' : '',
      '</div>'
    ].join('');
  }

  function renderSemanticConditionOverview(value, label) {
    const condition = String(value || '').trim();
    if (!condition) {
      return '';
    }
    return [
      '<div class="preview-object-semantic-logic-overview is-condition">',
      '<span>' + escapeHtml(label || t('previewObjectEditor.semanticCondition.title', 'Condition')) + '</span>',
      '<code>' + escapeHtml(condition) + '</code>',
      '</div>'
    ].join('');
  }

  function renderConditionStructurePreview(value) {
    const parsed = parseCondition(value);
    if (!parsed) {
      return '';
    }
    if (parsed.compound) {
      return renderCompoundConditionPreview(parsed);
    }
    return renderSingleClausePreview(parsed);
  }

  function renderSingleClausePreview(clause) {
    return [
      '<div class="preview-object-condition-structure" data-object-canvas-condition-structure="true">',
      renderClauseColumns(clause),
      '</div>'
    ].join('');
  }

  function renderCompoundConditionPreview(parsed) {
    const conjunctionLabel = parsed.conjunction === 'or'
      ? t('previewObjectEditor.semanticCondition.or', 'OR')
      : t('previewObjectEditor.semanticCondition.and', 'AND');
    return [
      '<div class="preview-object-condition-structure is-compound" data-object-canvas-condition-structure="true" data-condition-conjunction="' + escapeAttr(parsed.conjunction) + '">',
      parsed.clauses.map(function(clause, index) {
        return (index > 0 ? '<span class="preview-object-condition-conjunction"><em>' + escapeHtml(conjunctionLabel) + '</em></span>' : '') +
          '<div class="preview-object-condition-clause">' + renderClauseColumns(clause) + '</div>';
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderClauseColumns(clause) {
    return [
      '<span><strong>' + escapeHtml(t('previewObjectEditor.semanticCondition.variable', 'Variable')) + '</strong><em>' + escapeHtml(clause.variable) + '</em></span>',
      '<span><strong>' + escapeHtml(t('previewObjectEditor.semanticCondition.operator', 'Operator')) + '</strong><em>' + escapeHtml(clause.operator) + '</em></span>',
      '<span><strong>' + escapeHtml(t('previewObjectEditor.semanticCondition.value', 'Value')) + '</strong><em>' + escapeHtml(clause.value) + '</em></span>'
    ].join('');
  }

  function parseCondition(value) {
    const text = String(value || '').trim();
    if (!text) {
      return null;
    }
    if (/[()]/.test(text)) {
      return null;
    }
    const hasAnd = /\s+and\s+/i.test(text);
    const hasOr = /\s+or\s+/i.test(text);
    if (hasAnd && hasOr) {
      return null;
    }
    if (hasAnd || hasOr) {
      const conjunction = hasAnd ? 'and' : 'or';
      const parts = text.split(new RegExp('\\s+' + conjunction + '\\s+', 'i'));
      const clauses = parts.map(parseConditionClause).filter(Boolean);
      if (clauses.length !== parts.length || clauses.length < 2) {
        return null;
      }
      return {compound: true, conjunction: conjunction, clauses: clauses};
    }
    return parseConditionClause(text);
  }

  function parseConditionClause(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      return null;
    }
    const negatedBare = trimmed.match(/^not\s+(Q\.)?([A-Za-z_][A-Za-z0-9_]*)$/i);
    if (negatedBare) {
      return {
        variable: (negatedBare[1] || 'Q.') + negatedBare[2],
        operator: 'is',
        value: 'false'
      };
    }
    const comparison = trimmed.match(/^(Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*(>=|<=|!=|==|=|>|<)\s*(.+)$/);
    if (comparison) {
      const compValue = comparison[4].trim();
      if (/\s+(?:and|or)\s+/i.test(compValue)) {
        return null;
      }
      return {
        variable: (comparison[1] || 'Q.') + comparison[2],
        operator: comparison[3],
        value: compValue
      };
    }
    const bare = trimmed.match(/^(Q\.)?([A-Za-z_][A-Za-z0-9_]*)$/);
    if (bare) {
      return {
        variable: (bare[1] || 'Q.') + bare[2],
        operator: 'is',
        value: 'true'
      };
    }
    return null;
  }

  function renderSemanticLogicEvidence(field) {
    const source = field && field.source || {};
    const path = source && source.path || field && field.sourcePath || '';
    const line = Number(source && (source.line || source.startLine) || 0);
    if (!path && !fieldContextHint(field)) {
      return '';
    }
    return [
      '<details class="preview-object-semantic-source-evidence">',
      '<summary>' + escapeHtml(t('previewObjectEditor.semanticEffect.sourceEvidence', 'Source evidence')) + '</summary>',
      path ? '<small>' + escapeHtml(path + (line ? ':' + line : '')) + '</small>' : '',
      fieldContextHint(field) ? '<small>' + escapeHtml(fieldContextHint(field)) + '</small>' : '',
      '</details>'
    ].join('');
  }

  function renderChoiceRouteStateSummary(option, body, fields, resultFields) {
    const api = fieldPresentationApi();
    const summaries = api && typeof api.routeSummariesForOption === 'function'
      ? api.routeSummariesForOption(option, body, ensureArray(fields).concat(ensureArray(resultFields)))
      : [];
    return renderRouteStateSummary(summaries);
  }

  function renderFieldRouteStateSummary(fields, body) {
    const api = fieldPresentationApi();
    const summaries = api && typeof api.routeSummariesForFields === 'function'
      ? api.routeSummariesForFields(fields, body)
      : [];
    return renderRouteStateSummary(summaries);
  }

  function renderRouteStateSummary(summaries) {
    const rows = ensureArray(summaries);
    if (!rows.length) {
      return '';
    }
    return [
      '<details class="preview-object-route-state-summary" data-object-canvas-route-state-summary="true">',
      '<summary><span>' + escapeHtml(t('previewObjectEditor.routeStateSummary', 'Route check')) + '</span><em>' + escapeHtml(routeStateSummaryCount(rows)) + '</em></summary>',
      '<div class="preview-object-route-state-summary-body">',
      rows.map((row) => [
        '<article data-object-canvas-route-state="' + escapeAttr(row.id || row.ownerId || '') + '" data-route-state-status="' + escapeAttr(row.status || '') + '">',
        '<strong>' + escapeHtml(routeStateFriendlyLabel(row)) + '</strong>',
        '<span>' + escapeHtml(routeStateStatusLabel(row)) + '</span>',
        routeStateCandidateList(row),
        routeStateBadges(row),
        '</article>'
      ].join('')).join(''),
      '</div>',
      '</details>'
    ].join('');
  }

  function routeStateSummaryCount(rows) {
    const count = ensureArray(rows).reduce((total, row) => total + Math.max(1, ensureArray(row && row.candidates).length), 0);
    return t('previewObjectEditor.routeStateSummaryCount', '{count} target checks').replace('{count}', String(count));
  }

  function routeStateFriendlyLabel(row) {
    const candidates = ensureArray(row && row.candidates);
    if (candidates.length === 1) {
      const target = candidates[0] && (candidates[0].resolvedTarget || candidates[0].rawTarget);
      if (target) {
        return t('previewObjectEditor.routeStateTarget', 'Target') + ': ' + target;
      }
    }
    return row && row.routePurpose ? row.routePurpose : t('previewObjectEditor.routeState', 'Route state');
  }

  function routeStateCandidateList(row) {
    const candidates = ensureArray(row && row.candidates).slice(0, 4);
    if (!candidates.length) {
      return '';
    }
    return '<ul>' + candidates.map((candidate) => {
      const target = candidate.resolvedTarget || candidate.rawTarget || '';
      const predicate = candidate.predicate ? ' if ' + candidate.predicate : '';
      const suffix = candidate.dynamicTarget ? ' · ' + t('previewObjectEditor.routeDynamic', 'dynamic') : candidate.isFallback ? ' · ' + t('previewObjectEditor.routeFallback', 'fallback') : '';
      return '<li>' + escapeHtml(target + predicate + suffix) + '</li>';
    }).join('') + '</ul>';
  }

  function routeStateBadges(row) {
    const badges = ensureArray(row && row.badges);
    if (!badges.length) {
      return '';
    }
    return '<div class="preview-object-route-state-badges">' + badges.map((badge) => '<em>' + escapeHtml(routeStateBadgeLabel(badge)) + '</em>').join('') + '</div>';
  }

  function routeStateStatusLabel(row) {
    if (row && row.safeEditEligible) {
      return t('previewObjectEditor.routeState.safe', 'safe guided edit');
    }
    const status = String(row && row.status || '');
    if (status === 'runtime_ambiguous') {
      return t('previewObjectEditor.routeState.runtimeAmbiguous', 'runtime-sensitive');
    }
    if (status === 'dynamic') {
      return t('previewObjectEditor.routeState.dynamic', 'dynamic target');
    }
    if (status === 'needs_review') {
      return t('previewObjectEditor.routeState.needsReview', 'needs review');
    }
    return t('previewObjectEditor.routeState.reviewable', 'reviewable');
  }

  function routeStateBadgeLabel(badge) {
    const key = String(badge || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
    const fallback = String(badge || '');
    return t('previewObjectEditor.routeStateBadge.' + key, fallback);
  }

  function renderLogicSummaryChip(label, value, kind) {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }
    return [
      '<span class="preview-object-choice-logic-chip" data-preview-object-choice-logic-chip="' + escapeAttr(kind || 'logic') + '">',
      '<strong>' + escapeHtml(label || '') + '</strong>',
      '<em>' + escapeHtml(text) + '</em>',
      '</span>'
    ].join('');
  }

  function renderEditableOptionConditions(option, resultFields, existingConditionFields, eventBody) {
    const chipRows = optionConditionSummaries(option, resultFields);
    if (!chipRows.length) {
      return '';
    }
    const coveredValues = new Set(ensureArray(existingConditionFields).map(function(field) {
      return normalizeSummaryValue(field && (field.original || field.value));
    }).filter(Boolean));
    var parts = [];
    chipRows.forEach(function(row) {
      var normalized = normalizeSummaryValue(row.value);
      if (normalized && coveredValues.has(normalized)) {
        return;
      }
      if (row.kind === 'choose-if' || row.kind === 'view-if' || row.kind === 'condition') {
        var metaField = findMatchingMetaCondition(row, eventBody);
        if (metaField) {
          parts.push(renderSemanticLogicField(metaField, 'condition', 'inline-choice-condition'));
          coveredValues.add(normalized);
          return;
        }
      }
      parts.push(renderConditionChip(row));
    });
    return parts.length
      ? '<div class="preview-object-condition-chips" data-preview-object-condition-chips="true">' + parts.join('') + '</div>'
      : '';
  }

  function findMatchingMetaCondition(chipRow, eventBody) {
    var metaFields = ensureArray(eventBody && eventBody.metaFields);
    var chipValue = normalizeSummaryValue(chipRow && chipRow.value);
    if (!chipValue) {
      return null;
    }
    return metaFields.find(function(field) {
      if (String(field && field.role || '') !== 'condition') {
        return false;
      }
      var fieldValue = normalizeSummaryValue(field && (field.original || field.value));
      return fieldValue === chipValue;
    }) || null;
  }

  function renderConditionChip(row) {
    return [
      '<span data-condition-kind="' + escapeAttr(row.kind || 'condition') + '">',
      '<strong>' + escapeHtml(row.label) + '</strong>',
      '<em>' + escapeHtml(row.value) + '</em>',
      '</span>'
    ].join('');
  }

  function renderSourceContext(model, body) {
    const source = sourceLabel(model);
    const meta = ensureArray(body && body.metaFields);
    if (!source && !meta.length) {
      return '';
    }
    return [
      '<details class="preview-object-source-context" open>',
      '<summary>' + escapeHtml(t('previewObjectEditor.sourceContext', 'Source context')) + '</summary>',
      source ? '<p>' + escapeHtml(source) + '</p>' : '',
      meta.slice(0, 6).map((field) => renderInlineField(field, {
        role: 'source-context',
        element: 'input'
      })).join(''),
      '</details>'
    ].join('');
  }

  function renderEditorSummary(model, kind) {
    const change = model && model.changeState || {};
    const summary = change.operationSummary || {};
    return [
      '<footer class="preview-object-editor-summary" data-preview-object-draft-summary="true">',
      '<div><span>' + escapeHtml(t('objectCanvas.changedFields', 'Changed')) + '</span><strong>' + escapeHtml(String(change.changedCount || 0)) + '</strong></div>',
      '<div><span>' + escapeHtml(t('editing.summary.guarded', 'Guarded')) + '</span><strong>' + escapeHtml(String(summary.guardedApply || 0)) + '</strong></div>',
      '<div><span>' + escapeHtml(t('editing.summary.manual', 'Manual')) + '</span><strong>' + escapeHtml(String(summary.manualReview || 0)) + '</strong></div>',
      '<div><span>' + escapeHtml(t('previewObjectEditor.route', 'Editor route')) + '</span><strong>' + escapeHtml(labelForKind(kind)) + '</strong></div>',
      '</footer>',
      renderParityPanel(change.draft && change.draft.parsedToDraftParity, model, kind)
    ].join('');
  }

  function renderParityPanel(parity, model, kind) {
    const value = parity && typeof parity === 'object' ? parity : null;
    const roles = value && value.roles || {};
    const rows = Object.keys(roles).map((key) => roles[key]).filter((row) => row && (row.parsed || row.draft));
    if (!rows.length) {
      return '';
    }
    const missing = rows.filter((row) => Number(row.missing || 0) > 0);
    const repairApi = partialRepairApi();
    const repairs = repairApi && typeof repairApi.buildRepairEntries === 'function'
      ? repairApi.buildRepairEntries(value, {model, body: model && model.eventBody, kind, translate: t})
      : [];
    return [
      '<section class="preview-object-parity-panel" data-preview-object-parity-panel="true" data-preview-object-parity-status="' + (missing.some((row) => row.blocking) ? 'partial' : 'draft') + '">',
      '<header>',
      '<strong>' + escapeHtml(t('previewObjectEditor.parityTitle', 'Copy-as-new parity')) + '</strong>',
      '<span>' + escapeHtml(missing.length ? t('previewObjectEditor.parityMissing', 'Some parsed content still needs support before install.') : t('previewObjectEditor.parityComplete', 'Parsed content is preserved in this draft.')) + '</span>',
      '</header>',
      '<ul>',
      rows.map((row) => [
        '<li data-parity-role="' + escapeAttr(row.role || '') + '" data-parity-missing="' + escapeAttr(String(row.missing || 0)) + '">',
        '<strong>' + escapeHtml(roleDisplayLabel(row.role)) + '</strong>',
        '<span>' + escapeHtml(String(row.draft || 0) + '/' + String(row.parsed || 0)) + '</span>',
        row.blocking ? '<em>' + escapeHtml(t('previewObjectEditor.parityBlocksReview', 'blocks Review & Apply')) + '</em>' : '',
        renderParityContextLens(row),
        renderParityRepairEntries(row, repairs),
        '</li>'
      ].join('')).join(''),
      '</ul>',
      '</section>'
    ].join('');
  }

  function roleDisplayLabel(role) {
    return String(role || '').replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
  }

  function renderParityRepairEntries(row, repairs) {
    const role = String(row && row.role || '');
    const entries = ensureArray(repairs).filter((entry) => String(entry && entry.role || '') === role);
    if (!entries.length) {
      return '';
    }
    return [
      '<div class="preview-object-parity-repairs" data-partial-repair-role="' + escapeAttr(role) + '">',
      entries.map((entry) => [
        '<article data-partial-repair-entry="' + escapeAttr(entry.id || role) + '" data-partial-repair-status="' + escapeAttr(entry.status || 'warning') + '" data-partial-repair-kind="' + escapeAttr(entry.repairKind || role) + '">',
        '<div>',
        '<strong>' + escapeHtml(entry.label || roleDisplayLabel(role)) + '</strong>',
        entry.description ? '<span>' + escapeHtml(entry.description) + '</span>' : '',
        '</div>',
        entry.repairAction ? '<button type="button" data-visible-edit-action="' + escapeAttr(encodeAction(entry.repairAction)) + '">' + escapeHtml(entry.routeLabel || t('partialRepair.route.openRepair', 'Open repair path')) + '</button>' : '<span class="preview-object-repair-boundary">' + escapeHtml(entry.routeLabel || entry.boundaryReason || t('partialRepair.route.manualBoundary', 'Manual source review required')) + '</span>',
        entry.boundaryReason ? '<small>' + escapeHtml(entry.boundaryReason) + '</small>' : '',
        renderContextLens(entry.lens),
        '</article>'
      ].join('')).join(''),
      '</div>'
    ].join('');
  }

  function renderInlineField(field, options) {
    const opts = options || {};
    const value = fieldValue(field);
    const id = fieldId(field);
    const rawLabel = field && field.label || opts.fallbackLabel || id || '';
    const presentation = fieldPresentation(field, Object.assign({}, opts, {fallbackLabel: rawLabel}));
    const label = semanticFieldLabel(field, rawLabel, presentation);
    const readOnly = Boolean(opts.forceReadOnly || field && (field.readOnly || !id));
    const element = opts.element === 'input' || opts.element === 'select' || opts.element === 'checkbox' ? opts.element : 'textarea';
    const action = String(field && field.structureAction || '');
    const className = [
      'preview-object-field',
      'preview-object-field-' + safeClass(opts.role || 'field'),
      presentation && presentation.group ? 'preview-object-field-group-' + safeClass(presentation.group) : '',
      presentation && presentation.intent ? 'preview-object-field-intent-' + safeClass(presentation.intent) : '',
      action ? 'preview-object-action-' + safeClass(action) : '',
      field && field.status ? 'is-' + safeClass(field.status) : '',
      readOnly ? 'is-readonly' : ''
    ].filter(Boolean).join(' ');
    const controlClass = ['object-inline-input', 'preview-object-control', opts.className || ''].filter(Boolean).join(' ');
    const original = field && field.original !== undefined ? String(field.original || '') : value;
    const data = id
      ? ' data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '" data-object-canvas-original="' + escapeAttr(original) + '"'
      : '';
    const structureData = action ? ' data-preview-object-structure-action="' + escapeAttr(action) + '"' : '';
    const semanticData = presentation ? ' data-semantic-intent="' + escapeAttr(presentation.intent || '') + '" data-semantic-group="' + escapeAttr(presentation.group || '') + '"' : '';
    const control = renderControl({
      element,
      value,
      field,
      role: opts.role,
      data,
      readOnly,
      controlClass,
      placeholder: field && field.placeholder
    });
    // A field with a conditional tree renders a per-branch ladder right after
    // this control, where each branch's text is shown separately under its
    // condition. The flat inline preview would instead mash every branch's text
    // together (a state no player ever sees), so skip it and let the ladder own
    // the rendered view.
    const hasConditionalLadder = Boolean(field && ensureArray(field.conditionalTree).length);
    const renderedPreview = hasConditionalLadder ? '' : fieldTextPreview(value, id, element, opts);
    // Suppress the diagnostic chrome (status badge, condition/variable chips,
    // "When: ..." context hint, raw-source variable picker) on conditional rows:
    // a field that owns a ladder shows it per branch below, and a flat
    // conditional leaf is already a terse one-line branch fragment that the
    // chrome would bury. The field label, context lens, and media badges stay so
    // the row is still identifiable.
    const suppressFieldDiagnostics = hasConditionalLadder || isConditionalLeafField(field);
    return [
      '<label class="' + escapeAttr(className) + '" data-preview-object-field-role="' + escapeAttr(opts.role || 'field') + '"' + structureData + semanticData + '>',
      label ? renderEditorFieldLabel(label, rawLabel, presentation) : '',
      renderFieldContextLens(field, opts.role || 'field'),
      fieldVisualBadges(field),
      suppressFieldDiagnostics ? '' : renderSemanticStatusBadge(presentation, readOnly),
      suppressFieldDiagnostics || !fieldContextHint(field) ? '' : '<small class="preview-object-field-context">' + escapeHtml(((m) => m && m.stripInlineMarkup ? m.stripInlineMarkup(fieldContextHint(field)) : fieldContextHint(field))(global.ProjectMapDisplayText)) + '</small>',
      suppressFieldDiagnostics ? '' : fieldLogicChips(field),
      control,
      ((m) => m ? m.renderQdisplayInsert(field, {role: opts.role || 'field', fieldId: id}) : '')(objectEditorInserts()),
      suppressFieldDiagnostics ? '' : renderFieldVariablePicker(field, presentation, readOnly),
      renderedPreview,
      field && field.status ? '<small>' + escapeHtml(statusLabel(field.status, readOnly)) + '</small>' : '',
      '</label>'
    ].join('');
  }

  function renderStudioRoleLabel(label) {
    return [
      '<span class="object-editing-preview-role-label" data-studio-preview-label="true">',
      '<small>' + escapeHtml(t('previewObjectEditor.studioTextRole', 'Studio text role')) + '</small>',
      '<b>' + escapeHtml(label || t('previewObjectEditor.visibleText', 'Visible text')) + '</b>',
      '</span>'
    ].join('');
  }

  function renderEditorFieldLabel(label, rawLabel, presentation) {
    const source = String(rawLabel || '').trim();
    const title = source && source !== String(label || '').trim()
      ? ' title="' + escapeAttr(source) + '"'
      : '';
    const group = semanticGroupDisplay(presentation);
    return [
      '<span class="preview-object-field-label" data-preview-object-field-label="true"' + title + (presentation ? ' data-preview-object-field-intent="' + escapeAttr(presentation.intent || '') + '"' : '') + '>',
      '<em>' + escapeHtml(group || t('previewObjectEditor.editorField', 'Editor field')) + '</em>',
      '<b>' + escapeHtml(((m) => m && m.fieldLabel ? m.fieldLabel(label || '') : label || '')(global.ProjectMapDisplayText)) + '</b>',
      '<i class="visible-edit-affordance" data-visible-edit-affordance="object-canvas-preview">' + escapeHtml(t('visibleEdit.action', 'Edit')) + '</i>',
      '</span>'
    ].join('');
  }

  function renderSemanticStatusBadge(presentation, readOnly) {
    if (!presentation) {
      return '';
    }
    const kind = readOnly ? 'read_only' : String(presentation.statusKind || 'editable');
    const label = readOnly ? t('previewObjectEditor.semanticStatus.readOnly', 'Read only') : semanticStatusDisplay(presentation);
    if (!label) {
      return '';
    }
    return '<small class="preview-object-semantic-status is-' + escapeAttr(safeClass(kind)) + '" data-preview-object-semantic-status="' + escapeAttr(kind) + '">' + escapeHtml(label) + '</small>';
  }

  function renderFieldVariablePicker(field, presentation, readOnly) {
    const picker = field && field.variablePicker || {};
    const id = fieldId(field) || String(picker.targetFieldId || '');
    if (readOnly || !picker.enabled || !id || !ensureArray(picker.candidates).length) {
      return '';
    }
    const searchId = 'variable_picker_' + safeClass(id);
    return [
      '<details class="object-canvas-variable-picker" data-object-canvas-variable-picker="true" data-variable-target-field="' + escapeAttr(id) + '" data-variable-picker-mode="' + escapeAttr(picker.mode || '') + '" data-variable-picker-limit="12">',
      '<summary>' + escapeHtml(t('previewObjectEditor.variablePicker', 'Variable picker')) + '</summary>',
      '<label class="object-canvas-variable-search"><span>' + escapeHtml(t('previewObjectEditor.variableSearch', 'Search variables')) + '</span><input id="' + escapeAttr(searchId) + '" type="search" data-object-canvas-variable-search="true" placeholder="' + escapeAttr(t('previewObjectEditor.variableSearchPlaceholder', 'type to filter')) + '"></label>',
      '<div class="object-canvas-variable-candidates" data-object-canvas-variable-candidates="true">',
      // Render only a starter slice (matching data-variable-picker-limit above).
      // The full catalog can be the whole project variable pool and a picker is
      // emitted per field, so rendering every candidate inline multiplied into
      // hundreds of thousands of DOM nodes (multi-hundred-MB innerHTML, multi-
      // second paint) on dense events. The search box rebuilds the list from the
      // model on demand (filterObjectCanvasVariablePicker), so nothing is lost.
      ensureArray(picker.candidates).slice(0, 12).map((candidate) => renderVariableCandidate(candidate, id, picker.mode, presentation)).join(''),
      '</div>',
      '</details>'
    ].join('');
  }

  function renderVariableCandidate(candidate, targetFieldId, mode, presentation) {
    const value = String(candidate && candidate.insertValue || candidate && candidate.name || '');
    if (!value) {
      return '';
    }
    const search = String(candidate && (candidate.searchText || [candidate.name, candidate.meaning, candidate.summary].join(' ')) || '').toLowerCase();
    return [
      '<button type="button" class="object-canvas-variable-candidate" data-object-canvas-variable-copy="' + escapeAttr(value) + '" data-object-canvas-variable-target="' + escapeAttr(targetFieldId) + '" data-object-canvas-variable-mode="' + escapeAttr(mode || '') + '" data-object-canvas-variable-search-text="' + escapeAttr(search) + '">',
      '<strong>' + escapeHtml(candidate && (candidate.label || candidate.name) || value) + '</strong>',
      candidate && candidate.meaning ? '<span>' + escapeHtml(candidate.meaning) + '</span>' : '',
      candidate && candidate.summary ? '<small>' + escapeHtml(candidate.summary) + '</small>' : '',
      presentation && presentation.variablePicker && presentation.variablePicker.mode ? '<code>' + escapeHtml(value) + '</code>' : '',
      '</button>'
    ].join('');
  }

  function renderFieldRouteTargetPicker(field, presentation, readOnly) {
    const picker = field && field.routeTargetPicker || {};
    const id = fieldId(field);
    if (readOnly || !picker.enabled || !id || !ensureArray(picker.candidates).length) {
      return '';
    }
    const searchId = 'route_target_picker_' + safeClass(id);
    return [
      '<details class="object-canvas-route-target-picker" data-object-canvas-route-target-picker="true" data-route-target-field="' + escapeAttr(id) + '" data-route-target-picker-limit="12">',
      '<summary>' + escapeHtml(t('previewObjectEditor.routeTargetPicker', 'Scene target picker')) + '</summary>',
      '<label class="object-canvas-variable-search"><span>' + escapeHtml(t('previewObjectEditor.routeTargetSearch', 'Search scenes')) + '</span><input id="' + escapeAttr(searchId) + '" type="search" data-object-canvas-route-target-search="true" placeholder="' + escapeAttr(t('previewObjectEditor.routeTargetSearchPlaceholder', 'type to filter scenes')) + '"></label>',
      '<div class="object-canvas-route-target-candidates" data-object-canvas-route-target-candidates="true">',
      ensureArray(picker.candidates).slice(0, 12).map((candidate) => renderRouteTargetCandidate(candidate, id)).join(''),
      '</div>',
      '</details>'
    ].join('');
  }

  function renderRouteTargetCandidate(candidate, targetFieldId) {
    const value = String(candidate && (candidate.insertValue || candidate.name) || '');
    if (!value) {
      return '';
    }
    const search = String(candidate && (candidate.searchText || [candidate.name, candidate.label, candidate.meaning, candidate.summary].join(' ')) || '').toLowerCase();
    return [
      '<button type="button" class="object-canvas-route-target-candidate" data-object-canvas-route-target-insert="' + escapeAttr(value) + '" data-object-canvas-route-target-field="' + escapeAttr(targetFieldId) + '" data-object-canvas-route-target-search-text="' + escapeAttr(search) + '">',
      '<strong>' + escapeHtml(value) + '</strong>',
      candidate && candidate.meaning ? '<span>' + escapeHtml(candidate.meaning) + '</span>' : '',
      candidate && candidate.summary ? '<small>' + escapeHtml(candidate.summary) + '</small>' : '',
      '</button>'
    ].join('');
  }

  function semanticFieldLabel(field, rawLabel, presentation) {
    const current = displayFieldLabel(field, rawLabel);
    const semantic = presentation && presentation.label || '';
    if (!semantic) {
      return current;
    }
    if (!current || current === rawLabel || /^(Condition|Effect|Route|Option label|Choice label|Result text|Go to after|Set jump|Raw route directives|Call scenes)$/i.test(current)) {
      return semantic;
    }
    return current;
  }

  function semanticGroupDisplay(presentation) {
    if (!presentation || !presentation.group) {
      return '';
    }
    return t('previewObjectEditor.semanticGroup.' + presentation.group, presentation.groupLabel || presentation.group || 'Field');
  }

  function semanticStatusDisplay(presentation) {
    const kind = String(presentation && presentation.statusKind || '');
    if (kind === 'read_only') {
      return t('previewObjectEditor.semanticStatus.readOnly', 'Read only');
    }
    if (kind === 'advanced') {
      return t('previewObjectEditor.semanticStatus.advanced', 'Advanced source');
    }
    if (kind === 'manual') {
      return t('previewObjectEditor.semanticStatus.manual', 'Manual review');
    }
    if (kind === 'source_backed') {
      return t('previewObjectEditor.semanticStatus.sourceBacked', 'Source-backed');
    }
    return t('previewObjectEditor.semanticStatus.editable', 'Editable');
  }

  function displayFieldLabel(field, fallbackLabel) {
    const label = String(fallbackLabel || field && field.label || field && field.id || '').trim();
    const id = String(field && field.id || '').trim();
    const role = String(field && (field.semanticRole || field.branchKind || field.role) || '').toLowerCase();
    const action = String(field && field.structureAction || '').toLowerCase();
    if (id === 'event.pattern') {
      return t('previewObjectEditor.field.eventPattern', 'Event template');
    }
    if (id === 'event.patternReset') {
      return t('previewObjectEditor.field.patternReset', 'Apply selected template');
    }
    if (action === 'add_option') {
      if (field && field.sectionId) {
        return t('previewObjectEditor.structureAddSectionOptionTitle', 'New option in this section');
      }
      return t('previewObjectEditor.structureAddOptionTitle', 'New player option');
    }
    if (action === 'add_branch') {
      return t('previewObjectEditor.structureAddBranchTitle', 'New branch or follow-up');
    }
    if (action === 'add_trigger_effect') {
      return t('previewObjectEditor.structureTriggerEffectTitle', 'New on-arrival effect');
    }
    if (action === 'add_option_effect') {
      return t('previewObjectEditor.structureChoiceEffectTitle', 'New choice effect');
    }
    if (action === 'remove_option') {
      return t('previewObjectEditor.structureRemoveOptionTitle', 'Remove choice');
    }
    if (action === 'move_option_up') {
      return t('previewObjectEditor.structureMoveOptionUpTitle', 'Move choice up');
    }
    if (action === 'move_option_down') {
      return t('previewObjectEditor.structureMoveOptionDownTitle', 'Move choice down');
    }
    if (action === 'remove_option_condition') {
      return t('previewObjectEditor.structureRemoveConditionTitle', 'Remove prerequisite');
    }
    if (action === 'remove_effect') {
      return t('previewObjectEditor.structureRemoveEffectTitle', 'Remove effect');
    }
    if (action === 'remove_layer') {
      return t('previewObjectEditor.structureRemoveLayerTitle', 'Remove layer');
    }
    if (role.indexOf('option_result') >= 0 || /^conditional option result\s*:/i.test(label) || /^option result\s*:/i.test(label)) {
      return t('previewObjectEditor.optionResult', 'Option result');
    }
    if (role.indexOf('conditional') >= 0 || /^conditional text\s*:/i.test(label)) {
      return t('previewObjectEditor.conditionalText', 'Conditional text');
    }
    if (isMenuSectionField(field)) {
      return t('previewObjectEditor.followUpMenu', 'Follow-up menu');
    }
    if (isFollowUpSectionField(field) || /^scene step\s*:/i.test(label)) {
      return t('previewObjectEditor.followUpPage', 'Follow-up page');
    }
    if (/^option condition\s*:/i.test(label)) {
      return t('previewObjectEditor.chooseIf', 'Choose if');
    }
    if (/^section gate\s*:/i.test(label)) {
      return t('previewObjectEditor.viewIf', 'View if');
    }
    return label;
  }

  function renderControl(options) {
    const opts = options || {};
    if (opts.element === 'checkbox') {
      return '<input type="checkbox" class="' + escapeAttr(opts.controlClass) + '"' + opts.data + (isChecked(opts.value) ? ' checked' : '') + (opts.readOnly ? ' disabled' : '') + '>';
    }
    if (opts.element === 'select') {
      const optionsList = Array.isArray(opts.field && opts.field.options) ? opts.field.options : [];
      return [
        '<select class="' + escapeAttr(opts.controlClass) + '"' + opts.data + (opts.readOnly ? ' disabled' : '') + '>',
        optionsList.map((option) => renderOption(option, opts.value, opts.field)).join(''),
        '</select>'
      ].join('');
    }
    const placeholder = opts.placeholder ? ' placeholder="' + escapeAttr(opts.placeholder) + '"' : '';
    if (opts.element === 'input') {
      return '<input type="text" class="' + escapeAttr(opts.controlClass) + '"' + opts.data + ' value="' + escapeAttr(opts.value) + '"' + placeholder + (opts.readOnly ? ' readonly' : '') + '>';
    }
    return '<textarea rows="' + rowsFor(opts.value || opts.placeholder, opts.role) + '" wrap="soft" class="' + escapeAttr(opts.controlClass) + '"' + opts.data + placeholder + (opts.readOnly ? ' readonly' : '') + '>' + escapeHtml(opts.value) + '</textarea>';
  }

  function fieldTextPreview(value, id, element, options) {
    if (element !== 'textarea' || !shouldShowFieldTextPreview(value, options)) {
      return '';
    }
    return [
      '<div class="preview-object-field-rendered" data-preview-object-field-rendered="true"' + (id ? ' data-preview-object-rendered-for="' + escapeAttr(id) + '"' : '') + '>',
      renderTextBlocks(value, {empty: false, assetBaseUrl: options && options.assetBaseUrl || ''}),
      '</div>'
    ].join('');
  }

  function shouldShowFieldTextPreview(value, options) {
    const text = String(value || '');
    const role = String(options && options.role || '');
    const renderer = richTextApi();
    return /body|description|reason|before|after|section/i.test(role) ||
      text.length > 160 ||
      text.indexOf('\n') >= 0 ||
      Boolean(renderer && typeof renderer.hasMarkup === 'function' && renderer.hasMarkup(text));
  }

  function branchFieldRole(field) {
    const role = String(field && field.semanticRole || field && field.branchKind || '');
    if (role.indexOf('option_result') >= 0) {
      return 'choice-body';
    }
    if (role.indexOf('conditional') >= 0) {
      return 'conditional-body';
    }
    if (role.indexOf('menu_section') >= 0 || role.indexOf('follow_up_section') >= 0) {
      return 'menu-body';
    }
    return 'section-body';
  }

  function branchLabel(field) {
    const role = String(field && field.semanticRole || '');
    const label = String(field && field.label || '').trim();
    if (role.indexOf('option_result') >= 0) {
      return t('previewObjectEditor.optionResult', 'Option result');
    }
    if (role.indexOf('conditional') >= 0) {
      return t('previewObjectEditor.conditionalText', 'Conditional text');
    }
    if (isMenuSectionField(field)) {
      return t('previewObjectEditor.followUpMenu', 'Follow-up menu');
    }
    if (isFollowUpSectionField(field) || /^scene step\s*:/i.test(label)) {
      return t('previewObjectEditor.followUpPage', 'Follow-up page');
    }
    return label || t('previewObjectEditor.sceneStep', 'Scene step');
  }

  function branchConditionText(field) {
    const conditions = ensureArray(field && field.conditions).map(String).filter(Boolean);
    if (conditions.length) {
      return t('previewObjectEditor.when', 'When') + ': ' + conditions.join(' / ');
    }
    const labels = ensureArray(field && field.relatedOptionLabels).map(String).filter(Boolean);
    if (labels.length) {
      return t('previewObjectEditor.afterChoice', 'After choice') + ': ' + labels.join(' / ');
    }
    const ownedLabels = ensureArray(field && field.ownedOptionLabels).map(String).filter(Boolean);
    if (ownedLabels.length) {
      return t('previewObjectEditor.containsChoices', 'Contains choices') + ': ' + ownedLabels.join(' / ');
    }
    const section = String(field && field.sectionLabel || '').trim();
    if (section && isFollowUpSectionField(field)) {
      return t('previewObjectEditor.section', 'Section') + ': ' + section;
    }
    return '';
  }

  function fieldContextHint(field) {
    if (!field || typeof field !== 'object') {
      return '';
    }
    const parts = [];
    const id = String(field.id || '').trim();
    if (id === 'event.pattern') {
      parts.push(eventPatternDescription(fieldValue(field)));
    } else if (id === 'event.patternReset') {
      parts.push(t('previewObjectEditor.patternResetHelp', 'Changing the template alone keeps edited content. Check this to replace the draft with the selected template.'));
    } else if (field.help) {
      parts.push(String(field.help));
    }
    if (field.derivedAlias) {
      parts.push(t('previewObjectEditor.derivedAlias', 'Derived from the source body'));
    }
    const optionLabels = ensureArray(field.relatedOptionLabels).map(String).filter(Boolean);
    if (optionLabels.length) {
      parts.push(t('previewObjectEditor.afterChoice', 'After choice') + ': ' + optionLabels.join(' / '));
    }
    const ownedLabels = ensureArray(field.ownedOptionLabels).map(String).filter(Boolean);
    if (ownedLabels.length) {
      parts.push(t('previewObjectEditor.containsChoices', 'Contains choices') + ': ' + ownedLabels.join(' / '));
    }
    const conditions = ensureArray(field.conditions).map(String).filter(Boolean);
    if (conditions.length) {
      parts.push(t('previewObjectEditor.when', 'When') + ': ' + conditions.join(' / '));
    }
    const inlineConditions = ensureArray(field.inlineConditions).map(String).filter(Boolean);
    if (inlineConditions.length) {
      parts.push(t('previewObjectEditor.when', 'When') + ': ' + inlineConditions.join(' / '));
    }
    const section = String(field.sectionLabel || '').trim();
    if (section && !optionLabels.length) {
      parts.push(t('previewObjectEditor.section', 'Section') + ': ' + section);
    }
    const visualLabel = visualKindsLabel(field.visualKinds);
    if (visualLabel) {
      parts.push(visualLabel);
    }
    return parts.join(' / ');
  }

  function fieldVisualBadges(field) {
    const kinds = ensureArray(field && field.visualKinds).map(String).filter(Boolean);
    if (!kinds.length) {
      return '';
    }
    return '<span class="preview-object-field-badges">' + kinds.map((kind) => '<b>' + escapeHtml(visualKindLabel(kind)) + '</b>').join('') + '</span>';
  }

  function fieldLogicChips(field) {
    if (!field || typeof field !== 'object') {
      return '';
    }
    const conditions = uniqueStrings(ensureArray(field.conditionVariables).concat(ensureArray(field.inlineConditionVariables)).map(String).filter(Boolean));
    const textVariables = ensureArray(field.textVariables).map(String).filter(Boolean);
    const reads = uniqueStrings(conditions.concat(textVariables));
    if (!reads.length) {
      return '';
    }
    const chips = [];
    if (conditions.length) {
      chips.push(t('previewObjectEditor.conditionReads', 'condition reads') + ': ' + conditions.map((name) => 'Q.' + name).join(', '));
    }
    const visibleOnly = textVariables.filter((name) => !conditions.includes(name));
    if (visibleOnly.length) {
      chips.push(t('previewObjectEditor.textConsumes', 'text consumes') + ': ' + visibleOnly.map((name) => 'Q.' + name).join(', '));
    }
    return '<small class="preview-object-logic-chips">' + chips.map((chip) => '<b>' + escapeHtml(chip) + '</b>').join('') + '</small>';
  }

  function previewSectionLabel(field) {
    const role = String(field && field.semanticRole || '');
    if (role === 'opening_text') {
      return t('previewObjectEditor.visibleText', 'Visible text');
    }
    if (role.indexOf('conditional') >= 0) {
      return t('previewObjectEditor.conditionalText', 'Conditional text');
    }
    if (role.indexOf('option_result') >= 0) {
      return t('previewObjectEditor.optionResult', 'Option result');
    }
    if (isMenuSectionField(field)) {
      return t('previewObjectEditor.followUpMenu', 'Follow-up menu');
    }
    if (isFollowUpSectionField(field)) {
      return t('previewObjectEditor.followUpPage', 'Follow-up page');
    }
    return field && field.label || t('previewObjectEditor.visibleText', 'Visible text');
  }

  function isFollowUpSectionField(field) {
    if (!field || typeof field !== 'object') {
      return false;
    }
    const role = String(field.semanticRole || field.branchKind || field.role || '').toLowerCase();
    const label = String(field.label || '').trim();
    if (role.indexOf('option_result') >= 0 || role.indexOf('conditional') >= 0) {
      return false;
    }
    if (isMenuSectionField(field)) {
      return true;
    }
    if (role === 'section_text' || role === 'section' || /^scene step\s*:/i.test(label)) {
      return true;
    }
    if (role && !['body', 'heading', 'title', 'subtitle', 'text', 'section_body', 'section-body'].includes(role)) {
      return false;
    }
    const sectionId = String(field.sectionId || '').trim();
    if (!sectionId || isLikelyOpeningSectionId(sectionId)) {
      return false;
    }
    return Boolean(
      !ensureArray(field.relatedOptionIds).length &&
      !ensureArray(field.relatedOptionLabels).length &&
      !ensureArray(field.conditions).length
    );
  }

  function isMenuSectionField(field) {
    if (!field || typeof field !== 'object') {
      return false;
    }
    const role = String(field.semanticRole || field.branchKind || field.role || '').toLowerCase();
    return role.indexOf('menu_section') >= 0 ||
      role.indexOf('follow_up_section') >= 0 ||
      role === 'menu' ||
      role === 'conditional_menu' ||
      ensureArray(field.ownedOptionIds).length > 0 ||
      ensureArray(field.ownedOptionLabels).length > 0;
  }

  function isLikelyOpeningSectionId(sectionId) {
    const text = String(sectionId || '').trim();
    if (!text) {
      return true;
    }
    const local = text.includes('.') ? text.split('.').pop() : text;
    return /^(?:start|opening|intro|main)$/i.test(local);
  }

  function visualKindsLabel(kinds) {
    const labels = ensureArray(kinds).map(visualKindLabel).filter(Boolean);
    return labels.length ? t('previewObjectEditor.visualContent', 'Visual content') + ': ' + labels.join(' / ') : '';
  }

  function visualKindLabel(kind) {
    return {
      chart: t('previewObjectEditor.visualChart', 'Chart / table'),
      asset: t('previewObjectEditor.visualAsset', 'Asset reference'),
      html: t('previewObjectEditor.visualHtml', 'Styled HTML')
    }[String(kind || '')] || '';
  }

  function previewTextOptions(body, model) {
    return {
      assetBaseUrl: String(body && body.assetBaseUrl || model && model.assetBaseUrl || '')
    };
  }

  function effectExpressionLabel(effect) {
    const explicit = String(effect && (effect.expression || effect.displayExpression) || '').trim();
    if (explicit) {
      return explicit;
    }
    const variable = String(effect && effect.variable || '').trim();
    const op = String(effect && effect.op || '').trim();
    const value = String(effect && effect.value || '').trim();
    if (!variable) {
      return '';
    }
    if (op === 'writes' || !op) {
      return t('previewObjectEditor.writesVariable', 'writes') + ' Q.' + variable;
    }
    return 'Q.' + variable + ' ' + op + (value ? ' ' + value : '') + (effect && effect.condition ? ' if ' + effect.condition : '');
  }

  function effectHookLabel(effect) {
    const hook = String(effect && (effect.effectHook || effect.hook) || '').trim();
    if (hook === 'on-arrival') {
      return t('previewObjectEditor.onArrival', 'On arrival');
    }
    if (hook === 'on-departure') {
      return t('previewObjectEditor.onDeparture', 'On departure');
    }
    if (hook === 'on-display') {
      return t('previewObjectEditor.onDisplay', 'On display');
    }
    return '';
  }

  function sourceList(reads, writes) {
    const rows = [];
    ensureArray(reads).slice(0, 2).forEach((source) => rows.push(t('previewObjectEditor.read', 'read') + ' ' + sourceLabelFromRef(source)));
    ensureArray(writes).slice(0, 2).forEach((source) => rows.push(t('previewObjectEditor.write', 'write') + ' ' + sourceLabelFromRef(source)));
    return rows.filter((row) => !/\s$/.test(row)).join(' / ');
  }

  function sourceLabelFromRef(source) {
    const ref = source || {};
    return ref && ref.path ? String(ref.path) + (ref.line ? ':' + ref.line : '') : '';
  }

  function renderTextBlocks(value, options) {
    const renderer = richTextApi();
    if (renderer && typeof renderer.renderBlocks === 'function') {
      const opts = Object.assign({runtimeAssetRoot: 'out/html'}, options || {});
      return renderer.renderBlocks(value, opts);
    }
    const text = String(value || '').trim();
    return text ? '<p>' + escapeHtml(text) + '</p>' : '';
  }

  function renderTextInline(value) {
    const renderer = richTextApi();
    if (renderer && typeof renderer.renderInline === 'function') {
      return renderer.renderInline(value);
    }
    return escapeHtml(value);
  }

  function richTextApi() {
    if (global && global.ProjectMapVisibleTextRenderer) {
      return global.ProjectMapVisibleTextRenderer;
    }
    if (typeof require === 'function') {
      try {
        return require('./visible_text_renderer.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function renderOption(option, current, field) {
    const value = typeof option === 'string' ? option : String(option && option.value || '');
    const label = optionLabel(option, value, field);
    return '<option value="' + escapeAttr(value) + '"' + (String(value) === String(current || '') ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
  }

  function optionLabel(option, value, field) {
    if (String(field && field.id || '') === 'event.pattern') {
      return eventPatternLabel(value);
    }
    return typeof option === 'string' ? option : String(option && (option.label || option.value) || '');
  }

  function eventPatternLabel(value) {
    const text = String(value || '').trim();
    if (text === 'pure_text') {
      return t('previewObjectEditor.eventPattern.pure', 'Text / popup');
    }
    if (text === 'conditional_menu_loop') {
      return t('previewObjectEditor.eventPattern.menu', 'Conditional menu / loop');
    }
    return t('previewObjectEditor.eventPattern.branching', 'Branching choices');
  }

  function eventPatternDescription(value) {
    const text = String(value || '').trim();
    if (text === 'pure_text') {
      return t('previewObjectEditor.eventPattern.pureHelp', 'Creates a no-choice event: text, appearance conditions, and optional trigger effects only.');
    }
    if (text === 'conditional_menu_loop') {
      return t('previewObjectEditor.eventPattern.menuHelp', 'Creates an event that opens a follow-up menu or section with conditional choices, unavailable text, and loop routes.');
    }
    return t('previewObjectEditor.eventPattern.branchingHelp', 'Creates a standard event with multiple player choices, each leading to its own consequence page, effects, and return route.');
  }

  function isChecked(value) {
    return /^(1|true|yes|on)$/i.test(String(value || '').trim());
  }

  function renderEmpty(message) {
    return '<p class="preview-object-empty">' + escapeHtml(message || '') + '</p>';
  }

  function firstField(fields, pattern) {
    const rows = ensureArray(fields);
    return rows.find((field) => {
      const text = String(field && (field.id || field.key || field.label) || '');
      return pattern.test(text);
    }) || null;
  }

  function choiceLabelField(option, fields, owner, index) {
    const rows = ensureArray(fields);
    const explicit = rows.find((field) => String(field && field.role || '') === 'option_label') ||
      rows.find((field) => String(field && field.semanticRole || '') === 'option_label') ||
      firstField(rows, /(?:^|\.)(label|title)$/i);
    if (explicit) {
      return explicit;
    }
    const nonResult = rows.find((field) => !isChoiceResultField(field));
    if (nonResult) {
      return nonResult;
    }
    const optionLabel = String(option && (option.label || option.title || '') || '').trim();
    if (optionLabel) {
      return fallbackField(owner + '.option.' + index + '.label', t('storyboard.option', 'Option') + ' ' + (index + 1), optionLabel);
    }
    return fallbackField(owner + '.option.' + index + '.label', t('storyboard.option', 'Option') + ' ' + (index + 1), option && option.id);
  }

  function isChoiceResultField(field) {
    const role = String(field && [field.role, field.semanticRole].filter(Boolean).join(' ') || '');
    if (/\b(?:option_result|option_result_text|conditional_option_result_text|unavailable_text)\b/.test(role)) {
      return true;
    }
    const branchKind = String(field && field.branchKind || '');
    if (/^option_result/.test(branchKind)) {
      return true;
    }
    const text = String(field && [field.id, field.key, field.label].filter(Boolean).join(' ') || '').toLowerCase();
    return /body|result|narrative|after choice|選擇後|選項反應|反應文本/.test(text);
  }

  function fallbackField(id, label, value) {
    return {
      id: id || '',
      label: label || id || '',
      value: value || '',
      original: value || '',
      status: id ? 'guarded' : 'read_only',
      readOnly: !id
    };
  }

  function titleText(body, model, kind) {
    return fieldValue(body && (body.title || body.heading)) || model && model.title || labelForKind(kind);
  }

  function sourceLabel(model) {
    const source = model && model.source || model && model.item && model.item.source || {};
    return source && source.path ? source.path + (source.line ? ':' + source.line : '') : model && model.sourcePath || '';
  }

  function editorKind(model, options) {
    const template = normalizeTemplate(options && options.template || model && (model.template || model.objectKind || model.mode));
    if (template === 'card') {
      return 'card';
    }
    if (template === 'news') {
      return 'news';
    }
    if (template === 'surface') {
      return 'text-replacement';
    }
    if (template === 'deck_pool') {
      return 'deck_pool';
    }
    const objectKind = normalizeTemplate(model && model.objectKind);
    if (objectKind === 'card') {
      return 'card';
    }
    if (objectKind === 'news') {
      return 'news';
    }
    if (objectKind === 'surface') {
      return 'text-replacement';
    }
    if (objectKind === 'deck_pool') {
      return 'deck_pool';
    }
    return 'event';
  }

  function normalizeTemplate(value) {
    const text = String(value || '').trim();
    if (text === 'new_event' || text === 'world_event' || text === 'event' || text === 'existing') {
      return 'event';
    }
    if (text === 'news_item' || text === 'new_news' || text === 'news') {
      return 'news';
    }
    if (text === 'new_card' || text === 'advisor' || text === 'card') {
      return 'card';
    }
    if (text === 'deck_pool' || text === 'deck-pool' || text === 'deckPool') {
      return 'deck_pool';
    }
    if (text === 'surface_text' || text === 'text' || text === 'textPatch' || text === 'surface') {
      return 'surface';
    }
    return text;
  }

  function labelForKind(kind) {
    return {
      event: t('objectPreview.event', 'World Event'),
      news: t('objectPreview.news', 'News'),
      card: t('objectPreview.card', 'Card'),
      deck_pool: t('objectPreview.deckPool', 'Deck pool'),
      'text-replacement': t('objectPreview.textPatch', 'Text Patch')
    }[kind] || t('objectPreview.title', 'Object Preview');
  }

  function subtitleForKind(kind) {
    return {
      event: t('previewObjectEditor.intent.event', 'Edit the event as a visible player-facing panel; Canvas keeps the timeline context beside it.'),
      news: t('previewObjectEditor.intent.news', 'Edit the news item as a visible headline and description card.'),
      card: t('previewObjectEditor.intent.card', 'Edit the full card face instead of squeezing card text into the board thumbnail.'),
      deck_pool: t('previewObjectEditor.intent.deckPool', 'Manage which cards belong to this deck pool while keeping source-backed routing evidence visible.'),
      'text-replacement': t('previewObjectEditor.intent.text', 'Edit replacement text with before, after, and source context.')
    }[kind] || t('previewObjectEditor.intent.default', 'Edit visible player-facing text in place.');
  }

  function statusLabel(status, readOnly) {
    if (readOnly) {
      return t('previewObjectEditor.readonly', 'Read only');
    }
    return {
      guarded: t('editing.summary.guarded', 'Guarded'),
      guarded_apply: t('editing.summary.guarded', 'Guarded'),
      safe: t('editing.summary.safe', 'safe'),
      manual: t('editing.summary.manual', 'manual'),
      read_only: t('previewObjectEditor.readonly', 'Read only')
    }[String(status || '')] || String(status || '');
  }

  function statusFromEditability(editability) {
    const text = String(editability || '');
    if (text === 'guarded_replace_text' || text === 'guarded_replace_section' || text === 'guarded_apply') {
      return 'guarded';
    }
    if (text === 'manual_review') {
      return 'manual';
    }
    return text ? 'review' : '';
  }

  function fieldId(field) {
    return String(field && field.id || '');
  }

  function fieldValue(field) {
    if (!field) {
      return '';
    }
    if (typeof field === 'string') {
      return field;
    }
    return String(field.value !== undefined ? field.value : field.replacement !== undefined ? field.replacement : field.text !== undefined ? field.text : field.original !== undefined ? field.original : '');
  }

  function rowsFor(value, role) {
    const text = String(value || '');
    const trimmed = text.trim();
    if (!trimmed) {
      return '2';
    }
    const normalized = text.replace(/\n{3,}/g, '\n\n');
    const visualLines = normalized.split('\n').reduce((total, line) => {
      const length = line.replace(/\t/g, '    ').trimEnd().length;
      if (!length) {
        return total + 0.35;
      }
      return total + Math.max(1, Math.ceil(length / 76));
    }, 0);
    const compactShortText = trimmed.length < 140 ? -1 : 0;
    const longTextBonus = trimmed.length > 1100 ? 2 : trimmed.length > 620 ? 1 : 0;
    const maxRows = /logic|condition|route|effect/i.test(String(role || '')) ? 6 : 14;
    const rows = Math.ceil(visualLines + compactShortText + longTextBonus);
    return String(Math.max(2, Math.min(maxRows, rows)));
  }

  function uniqueStrings(values) {
    const seen = new Set();
    const out = [];
    ensureArray(values).forEach((value) => {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      out.push(text);
    });
    return out;
  }

  function safeClass(value) {
    return String(value || 'item').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  }

  function fieldPresentation(field, options) {
    if (field && field.semanticPresentation) {
      return field.semanticPresentation;
    }
    const api = fieldPresentationApi();
    return api && typeof api.classifyField === 'function'
      ? api.classifyField(field || {}, options || {})
      : null;
  }

  function fieldPresentationApi() {
    if (cachedFieldPresentation) {
      return cachedFieldPresentation;
    }
    if (global && global.ProjectMapObjectFieldPresentationModel) {
      cachedFieldPresentation = global.ProjectMapObjectFieldPresentationModel;
      return cachedFieldPresentation;
    }
    if (typeof require === 'function') {
      try {
        cachedFieldPresentation = require('../authoring/object_field_presentation_model.js');
        return cachedFieldPresentation;
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function semanticOperationsApi() {
    if (cachedSemanticOperations) {
      return cachedSemanticOperations;
    }
    if (global && global.ProjectMapObjectSemanticOperations) {
      cachedSemanticOperations = global.ProjectMapObjectSemanticOperations;
      return cachedSemanticOperations;
    }
    if (typeof require === 'function') {
      try {
        cachedSemanticOperations = require('../authoring/object_semantic_operations_model.js');
        return cachedSemanticOperations;
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function structureDraftApi() {
    if (global && global.ProjectMapPreviewObjectStructureDraft) {
      return global.ProjectMapPreviewObjectStructureDraft;
    }
    if (typeof require === 'function') {
      return require('./preview_object_structure_draft.js');
    }
    throw new Error('ProjectMapPreviewObjectStructureDraft is required before preview_object_editor.js');
  }

  function structureUi() {
    if (cachedStructureUi) {
      return cachedStructureUi;
    }
    const factory = structureUiFactory();
    cachedStructureUi = factory.create({
      t,
      escapeHtml,
      escapeAttr,
      ensureArray,
      fieldId,
      fieldValue,
      safeClass,
      statusFromEditability,
      renderInlineField,
      logicFieldElement,
      structureDraftApi,
      displayFieldLabel
    });
    return cachedStructureUi;
  }

  function structureUiFactory() {
    if (global && global.ProjectMapPreviewObjectStructureUi) {
      return global.ProjectMapPreviewObjectStructureUi;
    }
    if (typeof require === 'function') {
      return require('./preview_object_structure_ui.js');
    }
    throw new Error('ProjectMapPreviewObjectStructureUi is required before preview_object_editor.js');
  }

  function eventBuilderUi() {
    if (global && global.ProjectMapPreviewObjectEventBuilder) {
      return global.ProjectMapPreviewObjectEventBuilder;
    }
    if (typeof require === 'function') {
      try {
        return require('./preview_object_event_builder_ui.js');
      } catch (_err) {
        return fallbackEventBuilderUi();
      }
    }
    return fallbackEventBuilderUi();
  }

  function choicePathModel() {
    if (cachedChoicePathModel) {
      return cachedChoicePathModel;
    }
    if (global && global.ProjectMapEventChoicePathModel) {
      cachedChoicePathModel = global.ProjectMapEventChoicePathModel;
      return cachedChoicePathModel;
    }
    if (typeof require === 'function') {
      cachedChoicePathModel = require('../authoring/event_choice_path_model.js');
      return cachedChoicePathModel;
    }
    throw new Error('ProjectMapEventChoicePathModel is required before preview_object_editor.js');
  }

  function openingContextUi() {
    if (cachedOpeningContextUi) {
      return cachedOpeningContextUi;
    }
    const factory = openingContextUiFactory();
    cachedOpeningContextUi = factory.create({
      t,
      escapeHtml,
      ensureArray,
      fieldId,
      renderInlineField,
      logicFieldElement
    });
    return cachedOpeningContextUi;
  }

  function openingContextUiFactory() {
    if (global && global.ProjectMapPreviewObjectOpeningContextUi) {
      return global.ProjectMapPreviewObjectOpeningContextUi;
    }
    if (typeof require === 'function') {
      return require('./preview_object_opening_context_ui.js');
    }
    throw new Error('ProjectMapPreviewObjectOpeningContextUi is required before preview_object_editor.js');
  }

  function assetEditorUi() {
    if (cachedAssetEditorUi) {
      return cachedAssetEditorUi;
    }
    const factory = assetEditorUiFactory();
    cachedAssetEditorUi = factory.create({
      t,
      escapeHtml,
      escapeAttr,
      ensureArray,
      safeClass,
      isFlowAsset,
      isFlowAssetAddField,
      assetModelApi,
      sourceLabelFromRef
    });
    return cachedAssetEditorUi;
  }

  function assetEditorUiFactory() {
    if (global && global.ProjectMapPreviewAssetEditor) {
      return global.ProjectMapPreviewAssetEditor;
    }
    if (typeof require === 'function') {
      return require('./preview_asset_editor.js');
    }
    throw new Error('ProjectMapPreviewAssetEditor is required before preview_object_editor.js');
  }

  function metadataUi() {
    if (cachedMetadataUi) {
      return cachedMetadataUi;
    }
    const factory = metadataUiFactory();
    cachedMetadataUi = factory.create({
      t,
      escapeHtml,
      escapeAttr,
      ensureArray,
      fieldValue,
      fieldId,
      displayFieldLabel,
      actionForField,
      renderedEntryAttrs,
      renderActionContextLens
    });
    return cachedMetadataUi;
  }

  function metadataUiFactory() {
    if (global && global.ProjectMapPreviewObjectMetadataUi) {
      return global.ProjectMapPreviewObjectMetadataUi;
    }
    if (typeof require === 'function') {
      return require('./preview_object_metadata_ui.js');
    }
    throw new Error('ProjectMapPreviewObjectMetadataUi is required before preview_object_editor.js');
  }

  function fallbackEventBuilderUi() {
    return {
      renderAssetReferenceEditor: () => '',
      renderEventGraphSummary: () => '',
      renderEventReadiness: () => ''
    };
  }

  function assetModelApi() {
    if (global && global.ProjectMapAssetModel) {
      return global.ProjectMapAssetModel;
    }
    if (typeof require === 'function') {
      try {
        return require('../authoring/asset_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function contextLensApi() {
    if (global && global.ProjectMapAuthoringContextLens) {
      return global.ProjectMapAuthoringContextLens;
    }
    if (typeof require === 'function') {
      try {
        return require('../authoring/authoring_context_lens_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function partialRepairApi() {
    if (global && global.ProjectMapPartialRepairWorkflow) {
      return global.ProjectMapPartialRepairWorkflow;
    }
    if (typeof require === 'function') {
      try {
        return require('../authoring/partial_repair_workflow_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }


  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
