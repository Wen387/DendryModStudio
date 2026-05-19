(function initProjectMapPreviewObjectEditor(global) {
  'use strict';

  const LARGE_EVENT_CHOICE_LIMIT = 28;
  const LARGE_EVENT_BRANCH_LIMIT = 32;
  const LARGE_EVENT_CHOICE_THRESHOLD = 36;
  const LARGE_EVENT_BRANCH_THRESHOLD = 48;
  const LARGE_EVENT_STRUCTURE_THRESHOLD = 360;
  let cachedStructureUi = null;

  const api = {
    render,
    renderModal,
    renderModalPreviewPane,
    renderPreviewPane,
    renderTextBlocks
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

  function renderModal(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const body = model && model.eventBody || {};
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
      '<section class="object-editing-preview-pane" data-object-editing-modal-preview-pane="true">',
      renderModalPreviewPane(model, opts),
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
    const chips = [
      sections.length ? t('previewObjectEditor.flowSections', 'Sections') + ': ' + sections.length : '',
      options.length ? t('previewObjectEditor.flowOptions', 'Options') + ': ' + options.length : '',
      branches.length ? t('previewObjectEditor.branchText', 'Conditional and follow-up text') + ': ' + branches.length : '',
      assets.length ? t('previewObjectEditor.assets', 'Referenced assets') + ': ' + assets.length : ''
    ].filter(Boolean);
    return [
      '<article class="object-editing-live-preview object-editing-event-preview is-large-summary" data-object-editing-large-preview-summary="true">',
      '<div class="object-editing-preview-kicker">' + escapeHtml(t('objectPreview.event', 'World Event')) + '</div>',
      renderPreviewHeading(value.title || value.heading, model, 'title', fieldValue(value.title || value.heading) || model && model.title || t('objectPreview.event', 'World Event'), 'h4'),
      chips.length ? '<div class="object-editing-preview-metadata">' + chips.map((chip) => '<span class="object-editing-preview-metadata-chip">' + escapeHtml(chip) + '</span>').join('') + '</div>' : '',
      sections.length ? '<div class="object-editing-preview-copy" data-object-editing-preview-sections="summary">' + sections.slice(0, 2).map((field) => '<section class="object-editing-preview-section">' + renderStudioRoleLabel(previewSectionLabel(field)) + renderTextBlocks(fieldValue(field), {empty: false, assetBaseUrl: value.assetBaseUrl || ''}) + '</section>').join('') + '</div>' : '',
      renderFlowOverview(value.flow, model, 'preview'),
      renderPreviewAssets(assets, 'event', {
        assetCatalog: value.assetCatalog,
        assetAddFields: value.assetAddFields,
        showAddControls: false,
        showReplacementControls: false
      }),
      '<small>' + escapeHtml(t('previewObjectEditor.expandPreview', 'Expand preview')) + '</small>',
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
      model && model.mode !== 'existing' ? '<button type="button" data-object-canvas-action="legacy_form">' + escapeHtml(t('objectCanvas.legacyForm', 'Advanced Form')) + '</button>' : '',
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
      renderPreviewMetadataChips(previewBody.metaFields, model),
      sections.length ? renderPreviewSections(sections, previewBody, model) : renderEmpty(t('objectPreview.noPreview', 'No preview text')),
      renderPreviewChoices(options, 'event', previewBody, model),
      renderFlowOverview(previewBody.flow, model, 'preview'),
      eventBuilderUi().renderChoiceUnitSummary(previewBody.choiceUnits),
      eventBuilderUi().renderConsequenceGroups(previewBody.consequenceGroups),
      eventBuilderUi().renderContinuationMap(previewBody.continuationMap),
      eventBuilderUi().renderPlayabilityChecks(previewBody.playabilityChecks),
      renderPreviewBranches(branchSections, previewTextOptions(previewBody, model), model, previewBody),
      renderPreviewAssets(assets, 'event', {
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
      renderPreviewMetadataChips(body.metaFields, model),
      mainSections.length ? '<div class="object-editing-preview-copy">' + mainSections.map((field) => [
        '<section class="object-editing-preview-section"' + renderedEntryAttrs(actionForField(field, 'text', model, {role: 'body'}), 'text', t('previewObjectEditor.editRenderedText', 'Edit preview text')) + '>',
        renderTextBlocks(fieldValue(field), {empty: false}),
        renderActionContextLens(actionForField(field, 'text', model, {role: 'body'}), 'text'),
        '</section>'
      ].join('')).join('') + '</div>' : renderEmpty(t('objectPreview.empty', 'No player-facing text is available yet.')),
      renderPreviewChoices(ensureArray(body.options), 'card', body, model),
      renderPreviewBranches(branchSections, previewTextOptions(body, model), model, body),
      renderPreviewAssets(body.assets, 'card', {
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

  function renderPreviewMetadataChips(fields, model) {
    const rows = ensureArray(fields).filter((field) => field && fieldValue(field).trim());
    if (!rows.length) {
      return '';
    }
    return [
      '<div class="object-editing-preview-metadata" data-object-editing-preview-metadata="true">',
      rows.slice(0, 12).map((field) => {
        const role = String(field && (field.role || field.semanticRole) || '').toLowerCase();
        const labelText = String(field && field.label || field && field.id || '');
        const metadataKind = role === 'route' ? 'route' : /condition|view|choose|if/i.test(labelText) ? 'condition' : 'metadata';
        const entryKind = metadataKind === 'route' || metadataKind === 'condition' ? 'condition' : 'metadata';
        const action = actionForField(field, entryKind, model, {role: metadataKind});
        const labelParts = previewMetadataLabelParts(displayFieldLabel(field, field && field.label || fieldId(field)), metadataKind);
        const rawValue = fieldValue(field);
        const layout = previewMetadataLayout(metadataKind, labelParts, rawValue);
        const displayValue = previewMetadataValue(rawValue, metadataKind, layout);
        return [
          '<span class="object-editing-preview-metadata-chip" data-metadata-kind="' + escapeAttr(metadataKind) + '" data-metadata-layout="' + escapeAttr(layout) + '"' + (labelParts.context ? ' data-metadata-has-context="true"' : '') + renderedEntryAttrs(action, entryKind, t('previewObjectEditor.editRenderedMetadata', 'Edit metadata')) + '>',
          '<span class="object-editing-preview-metadata-label"><strong>' + escapeHtml(labelParts.label) + '</strong>' + (labelParts.context ? '<small>' + escapeHtml(labelParts.context) + '</small>' : '') + '</span>',
          '<em>' + escapeHtml(displayValue) + '</em>',
          renderActionContextLens(action, entryKind),
          '</span>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function previewMetadataLabelParts(label, kind) {
    const text = String(label || '').replace(/\s+/g, ' ').trim();
    if ((kind === 'condition' || kind === 'route') && text.indexOf(':') > 0) {
      const parts = text.split(':');
      const head = parts.shift().trim();
      const tail = parts.join(':').trim();
      if (head && tail) {
        return {label: head, context: tail};
      }
    }
    return {label: text, context: ''};
  }

  function previewMetadataLayout(kind, labelParts, value) {
    const context = String(labelParts && labelParts.context || '');
    const text = String(value || '');
    if (kind === 'condition') {
      return 'block';
    }
    if (kind === 'route' && (context.length > 32 || text.length > 24)) {
      return 'block';
    }
    return 'inline';
  }

  function previewMetadataValue(value, kind, layout) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (kind !== 'condition' || layout !== 'block' || text.length < 48) {
      return text;
    }
    return text.replace(/\s+(and|or)\s+/gi, '\n$1 ');
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
    return [
      '<div class="object-editing-preview-copy" data-object-editing-preview-sections="true">',
      sections.map((field) => {
        const visualLabel = visualKindsLabel(field && field.visualKinds);
        const action = actionForField(field, 'text', model, {role: 'body'});
        return [
          '<section class="object-editing-preview-section" data-preview-visual-kind="' + escapeAttr(visualLabel ? ensureArray(field.visualKinds).join(' ') : 'text') + '"' + renderedEntryAttrs(action, 'text', t('previewObjectEditor.editRenderedText', 'Edit preview text')) + '>',
          renderStudioRoleLabel(previewSectionLabel(field)),
          visualLabel ? '<small>' + escapeHtml(visualLabel) + '</small>' : '',
          renderTextBlocks(fieldValue(field), Object.assign({empty: false}, opts)),
          renderInlineAssetPlacements(assetsForBranch(field, body), assetAddFieldsForBranch(field, body), editorKind(model, body), body, model, {
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
    return [
      '<div class="object-editing-preview-options" data-object-editing-preview-options="true">',
      '<span class="object-editing-preview-group-label">' + escapeHtml(t('previewObjectEditor.playerChoices', 'Player choices')) + '</span>',
      rows.map((option, index) => renderPreviewChoiceCard(option, index, owner, body, model)).join(''),
      '</div>'
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

  function renderPreviewChoiceCard(option, index, owner, body, model) {
    const fields = ensureArray(option && option.fields);
    const label = choiceLabelField(option, fields, owner, index);
    const resultFields = optionResultFields(option, fields);
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
        renderInlineAssetPlacements(assetsForOption(option, body, resultFields), assetAddFieldsForOption(option, body, resultFields), editorKind(model, body), body, model, {
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
    const body = firstField(fields, /body|result|narrative/i);
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

  function optionConditions(option, resultFields) {
    const values = [
      option && option.chooseIf,
      option && option.sectionViewIf,
      option && option.sectionChooseIf
    ];
    ensureArray(resultFields).forEach((field) => {
      values.push.apply(values, ensureArray(field && field.conditions));
    });
    return uniqueStrings(values.map((value) => String(value || '').trim()).filter(Boolean));
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
      const key = [row.kind || '', row.label || '', row.value || ''].join('|');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function optionEffectFields(option, body) {
    const optionId = normalizeEndpointToken(option && option.id);
    const optionLabel = String(option && option.label || '').trim();
    return ensureArray(body && body.optionEffects).filter((group) => {
      return normalizeEndpointToken(group && group.id) === optionId ||
        (optionLabel && String(group && group.label || '').trim() === optionLabel);
    }).flatMap((group) => ensureArray(group && group.fields));
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
    const rows = ensureArray(branches).filter((field) => field && fieldValue(field).trim()).slice(0, 6);
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
        renderInlineAssetPlacements(assetsForBranch(field, body), assetAddFieldsForBranch(field, body), editorKind(model, body), body, model, {
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

  function renderConditionalAlternatives(field, options) {
    const rows = ensureArray(field && field.conditionalAlternatives).filter((item) => item && (item.condition || item.text));
    if (!rows.length) {
      return '';
    }
    const opts = options || {};
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

  function renderInlineAssetPlacements(assets, addFields, target, body, model, options) {
    const rows = ensureArray(assets).filter((asset) => asset && (asset.path || asset.label || asset.name));
    const adds = ensureArray(addFields);
    const suppressEmptyAddControls = shouldSuppressEmptyFlowAddControls(body, rows, adds);
    if (!rows.length && (!adds.length || suppressEmptyAddControls)) {
      return '';
    }
    const renderOptions = options || {};
    const allowAddControls = Object.prototype.hasOwnProperty.call(renderOptions, 'showAddControls')
      ? Boolean(renderOptions.showAddControls)
      : Boolean(model && model.mode === 'existing');
    const allowReplacementControls = Object.prototype.hasOwnProperty.call(renderOptions, 'showReplacementControls')
      ? Boolean(renderOptions.showReplacementControls)
      : Boolean(model && model.mode === 'existing');
    const opts = {
      assetCatalog: body && body.assetCatalog,
      relatedAssets: rows.concat(ensureArray(body && body.assets)),
      showControls: model && model.mode !== 'existing',
      showAddControls: allowAddControls,
      showReplacementControls: allowReplacementControls
    };
    return [
      '<div class="object-canvas-flow-assets" data-object-canvas-flow-assets="true" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '">',
      '<small>' + escapeHtml(t('assets.flowAssets', 'Flow assets')) + '</small>',
      rows.map((asset) => renderFlowAssetRow(asset, target, opts)).join(''),
      !suppressEmptyAddControls && (opts.showAddControls || opts.showControls) ? adds.map((field) => renderAssetAddFieldControls(field, target, opts)).join('') : '',
      '</div>'
    ].join('');
  }

  function shouldSuppressEmptyFlowAddControls(body, rows, addFields) {
    if (ensureArray(rows).length || !ensureArray(addFields).length) {
      return false;
    }
    const flowAddCount = ensureArray(body && body.assetAddFields).filter(isFlowAssetAddField).length;
    const flowSurfaceCount = ensureArray(body && body.options).length + ensureArray(body && body.branchSections).length;
    return flowAddCount > 20 || flowSurfaceCount > 20;
  }

  function renderFlowAssetRow(asset, target, options) {
    const item = asset || {};
    const role = item.role || 'event_illustration';
    const location = item.displayLocation || item.sectionId || item.optionId || '';
    return [
      '<article class="object-canvas-flow-asset-row" data-object-canvas-flow-asset-row="true" data-asset-placement-kind="' + escapeAttr(item.placementKind || 'unknown_inline') + '" data-asset-role="' + escapeAttr(role) + '">',
      renderPreviewAsset(item, target),
      location ? '<small>' + escapeHtml(location) + '</small>' : '',
      options && options.showReplacementControls ? renderFlowAssetReplacementControl(item, target) : '',
      options && options.showReplacementControls ? renderFlowAssetRemovalControl(item, target) : '',
      '</article>'
    ].join('');
  }

  function renderFlowAssetReplacementControl(asset, target) {
    const item = asset || {};
    const fieldId = String(item.assetEditFieldId || '').trim();
    const directive = String(item.replacementDirective || item.directive || '').trim();
    if (!fieldId || !directive || !item.replacementAvailable) {
      return '';
    }
    return [
      '<label class="object-canvas-asset-picker-control object-canvas-asset-replacement-control" data-object-canvas-asset-replacement="true">',
      '<span>' + escapeHtml(t('assets.replaceFile', 'Replacement file')) + '</span>',
      '<input type="file" accept="' + escapeAttr(item.type === 'audio' ? 'audio/*' : 'image/*') + '" data-object-canvas-asset-file="true" data-existing-asset-field="' + escapeAttr(fieldId) + '" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(item.role || '') + '" data-asset-directive="' + escapeAttr(directive) + '" data-current-asset-path="' + escapeAttr(item.assetCurrentPath || item.path || '') + '" data-asset-original="' + escapeAttr(item.assetOriginal || '') + '">',
      '</label>'
    ].join('');
  }

  function renderFlowAssetRemovalControl(asset, target) {
    const item = asset || {};
    const fieldId = String(item.assetEditFieldId || '').trim();
    if (fieldId && item.pendingAddition) {
      return [
        '<button type="button" class="object-canvas-asset-remove-control" data-object-canvas-action="clear_asset_addition" data-existing-asset-add-field="' + escapeAttr(fieldId) + '" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(item.role || '') + '" data-asset-directive="' + escapeAttr(item.replacementDirective || item.directive || '') + '" data-current-asset-path="' + escapeAttr(item.assetCurrentPath || item.path || '') + '">',
        escapeHtml(t('assets.clearPendingAddition', 'Cancel addition')),
        '</button>'
      ].join('');
    }
    if (!fieldId || !item.allowAssetRemoval || !item.replacementAvailable) {
      return '';
    }
    return [
      '<button type="button" class="' + assetRemovalButtonClass(item.pendingRemoval) + '" data-object-canvas-action="remove_asset_reference" data-existing-asset-field="' + escapeAttr(fieldId) + '" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(item.role || '') + '" data-asset-directive="' + escapeAttr(item.replacementDirective || item.directive || '') + '" data-current-asset-path="' + escapeAttr(item.assetCurrentPath || item.path || '') + '" data-asset-original="' + escapeAttr(item.assetOriginal || '') + '"' + assetRemovalStateAttrs(item.pendingRemoval) + '>',
      assetRemovalButtonLabel(item.pendingRemoval),
      '</button>'
    ].join('');
  }

  function renderAssetAddFieldControls(field, target, options) {
    const role = String(field && field.role || field && field.assetRole || 'event_illustration').trim();
    const directive = String(field && field.directive || field && field.assetDirective || 'inline-image').trim();
    const fieldId = String(field && field.id || '').trim();
    if (!fieldId || !role || !directive) {
      return '';
    }
    const catalog = assetCatalogForSlot(options && options.assetCatalog, {
      type: field.type || field.assetType || 'image',
      role,
      preferredAssetPaths: preferredAssetPathsForField(field, options)
    });
    const label = assetAddFieldLabel(field);
    const fieldAttrs = field.draftPlacement
      ? ' data-object-canvas-asset-placement-id="' + escapeAttr(field.placementId || fieldId) + '" data-asset-placement-kind="' + escapeAttr(field.placementKind || '') + '" data-asset-section-id="' + escapeAttr(field.sectionId || '') + '" data-asset-option-id="' + escapeAttr(field.optionId || '') + '" data-asset-display-location="' + escapeAttr(field.displayLocation || '') + '" data-asset-directive="' + escapeAttr(directive) + '"'
      : ' data-existing-asset-add-field="' + escapeAttr(fieldId) + '" data-asset-directive="' + escapeAttr(directive) + '"';
    return [
      '<div class="object-canvas-flow-asset-add" data-object-canvas-flow-asset-add="true" data-asset-placement-kind="' + escapeAttr(field.placementKind || '') + '">',
      '<span>' + escapeHtml(label) + '</span>',
      '<div class="object-canvas-asset-picker-control">',
      '<span>' + escapeHtml(t('assets.chooseIndexed', 'Indexed asset')) + '</span>',
      renderAssetSelectFilter(catalog),
      '<select data-object-canvas-asset-select="true" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(role) + '"' + fieldAttrs + '>',
      '<option value="">' + escapeHtml(t('assets.slotEmpty', 'No asset selected for this slot.')) + '</option>',
      catalog.map((asset) => renderAssetSelectOption(asset, role)).join(''),
      '</select>',
      '</div>',
      '<label class="object-canvas-asset-picker-control">',
      '<span>' + escapeHtml(t('assets.localFile', 'Local file')) + '</span>',
      '<input type="file" accept="' + escapeAttr((field.type || field.assetType) === 'audio' ? 'audio/*' : 'image/*') + '" data-object-canvas-asset-file="true" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(role) + '"' + fieldAttrs + '>',
      '</label>',
      '</div>'
    ].join('');
  }

  function renderPreviewAssets(assets, target, options) {
    const rows = ensureArray(assets).filter((asset) => asset && (asset.path || asset.label || asset.name));
    const opts = options || {};
    const normalizedTarget = target === 'card' ? 'card' : 'event';
    const globalRows = rows.filter((asset) => !isFlowAsset(asset));
    const flowRows = rows.filter(isFlowAsset);
    const flowAddFields = ensureArray(opts.assetAddFields).filter(isFlowAssetAddField);
    const slots = assetSlotsForRows(globalRows, normalizedTarget, opts);
    const flowAddControls = opts.showControls
      ? flowAddFields.map((field) => renderAssetAddFieldControls(field, normalizedTarget, opts)).join('')
      : renderFlowAssetAddSummary(flowAddFields);
    if (!rows.length && !slots.length && !flowAddFields.length && !opts.forcePanel) {
      return '';
    }
    return [
      '<section class="object-editing-preview-assets preview-object-assets object-canvas-assets-panel" data-object-editing-preview-assets="true" data-preview-object-assets="true" data-object-canvas-assets-panel="true" data-asset-target="' + escapeAttr(normalizedTarget) + '">',
      '<span class="object-editing-preview-group-label">' + escapeHtml(t('previewObjectEditor.assets', 'Referenced assets')) + '</span>',
      renderPreviewAssetSlots(slots, normalizedTarget, opts),
      globalRows.length ? '<div class="object-canvas-asset-row-grid" data-object-canvas-global-assets="true">' + globalRows.slice(0, 8).map((asset) => renderPreviewAsset(asset, normalizedTarget)).join('') + '</div>' : '',
      flowRows.length || flowAddFields.length ? '<div class="object-canvas-asset-row-grid" data-object-canvas-flow-asset-summary="true"><small>' + escapeHtml(t('assets.flowAssets', 'Flow assets')) + '</small>' + flowRows.slice(0, 8).map((asset) => renderFlowAssetRow(asset, normalizedTarget, opts)).join('') + flowAddControls + '</div>' : '',
      rows.length > 8 ? '<small>' + escapeHtml(t('previewObjectEditor.moreAssets', 'More assets') + ': ' + String(rows.length - 8)) + '</small>' : '',
      '</section>'
    ].join('');
  }

  function renderFlowAssetAddSummary(fields) {
    const count = ensureArray(fields).length;
    if (!count) {
      return '';
    }
    return [
      '<div class="object-canvas-flow-asset-add-summary" data-object-canvas-flow-asset-add-summary="true">',
      '<span>' + escapeHtml(t('assets.flowAddSummary', 'Add controls are available in {count} flow locations.').replace('{count}', String(count))) + '</span>',
      '<small>' + escapeHtml(t('assets.flowAddSummaryHint', 'Use the matching option result, branch, or section to add a flow-positioned image.')) + '</small>',
      '</div>'
    ].join('');
  }

  function renderPreviewAssetSlots(slots, target, options) {
    const opts = options || {};
    if (!slots.length) {
      return '';
    }
    return [
      '<div class="object-canvas-asset-slot-grid" data-object-canvas-asset-slots="true">',
      slots.map((slot) => [
        '<article class="object-canvas-asset-slot" data-object-canvas-asset-slot="true" data-asset-slot-role="' + escapeAttr(slot.role || '') + '" data-asset-slot-status="' + escapeAttr(slot.status || 'empty') + '">',
        '<strong>' + escapeHtml(t('assets.role.' + slot.role, slot.roleLabel || slot.label || slot.role || t('previewObjectEditor.asset', 'Asset'))) + '</strong>',
        '<small>' + escapeHtml(t('assets.type.' + (slot.type || 'asset'), slot.type || 'asset')) + '</small>',
        slot.assetRef && slot.assetRef.path ? '<code>' + escapeHtml(slot.assetRef.path) + '</code>' : '<span>' + escapeHtml(t('assets.slotEmpty', 'No asset selected for this slot.')) + '</span>',
        slot.installRequest ? '<em>' + escapeHtml(slot.installRequest.sourceName || slot.installRequest.sourcePath || t('assets.sourcePending', 'Source file selected in this browser session')) + '</em>' : '',
        opts.showControls || opts.showAddControls && slot.addField && !(slot.assetRef && slot.assetRef.path) ? renderAssetSlotControls(slot, target, opts) : '',
        opts.showReplacementControls ? renderAssetReplacementControl(slot, target) : '',
        opts.showReplacementControls ? renderAssetRemovalControl(slot, target) : '',
        '</article>'
      ].join('')).join(''),
      '</div>'
    ].join('');
  }

  function assetSlotsForRows(rows, target, options) {
    const api = assetModelApi();
    if (!api || typeof api.buildAssetSlots !== 'function') {
      return [];
    }
    const opts = options || {};
    const assetRefs = ensureArray(rows).filter((row) => row && row.rowKind !== 'asset_install_request').map((row) => Object.assign({}, row.assetRef || {}, {
      path: row.path || row.assetRef && row.assetRef.path || '',
      type: row.type || row.assetRef && row.assetRef.type || '',
      label: row.label || row.assetRef && row.assetRef.label || '',
      role: row.role || row.assetRef && row.assetRef.role || '',
      directive: row.directive || row.assetRef && row.assetRef.directive || '',
      previewUrl: row.previewUrl || row.assetRef && row.assetRef.previewUrl || '',
      fileExists: row.fileExists
    }));
    const assetInstallRequests = ensureArray(rows).filter((row) => row && row.installRequest).map((row) => row.installRequest);
    return api.buildAssetSlots({assetRefs, assetInstallRequests}, {target}).map((slot) => {
      const matchingRow = ensureArray(rows).find((row) => row && row.role === slot.role);
      const addField = assetSlotAddField(ensureArray(opts.assetAddFields), slot);
      if (!matchingRow || !slot.assetRef) {
        return Object.assign({}, slot, {addField});
      }
      return Object.assign({}, slot, {
        status: slot.installRequest ? 'pending_install' : (matchingRow.status || matchingRow.referenceState && matchingRow.referenceState.key || slot.status),
        addField,
        assetRef: Object.assign({}, slot.assetRef, {
          assetEditFieldId: matchingRow.assetEditFieldId || '',
          assetEditability: matchingRow.assetEditability || matchingRow.editability || '',
          assetOriginal: matchingRow.assetOriginal || '',
          assetCurrentPath: matchingRow.assetCurrentPath || matchingRow.path || '',
          source: matchingRow.source || slot.assetRef.source || null,
          sourcePath: matchingRow.sourcePath || '',
          replacementDirective: matchingRow.replacementDirective || matchingRow.directive || slot.assetRef.directive || '',
          allowAssetRemoval: Boolean(matchingRow.allowAssetRemoval),
          pendingRemoval: Boolean(matchingRow.pendingRemoval),
          pendingAddition: Boolean(matchingRow.pendingAddition),
          replacementAvailable: Boolean(matchingRow.replacementAvailable)
        })
      });
    });
  }

  function assetSlotAddField(fields, slot) {
    const role = String(slot && slot.role || '').trim();
    if (!role) {
      return null;
    }
    return ensureArray(fields).find((field) => {
      if (!field || String(field.role || '') !== role) {
        return false;
      }
      const id = String(field.id || '');
      if (id.indexOf('asset_add_flow_') === 0) {
        return false;
      }
      if (String(field.sectionId || '').trim() || String(field.optionId || '').trim()) {
        return false;
      }
      const kind = String(field.placementKind || 'global_slot');
      return kind === 'global_slot' || (role === 'event_illustration' && kind === 'opening_visual');
    }) || null;
  }

  function renderAssetSlotControls(slot, target, options) {
    const role = String(slot && slot.role || '').trim();
    if (!role) {
      return '';
    }
    const catalog = assetCatalogForSlot(options && options.assetCatalog, slot);
    const currentValue = assetSelectValue(slot.assetRef, role);
    const addField = slot && slot.addField || null;
    const fieldAttrs = addField
      ? ' data-existing-asset-add-field="' + escapeAttr(addField.id || '') + '" data-asset-directive="' + escapeAttr(addField.directive || '') + '"'
      : '';
    return [
      '<div class="object-canvas-asset-picker-control">',
      '<span>' + escapeHtml(t('assets.chooseIndexed', 'Indexed asset')) + '</span>',
      renderAssetSelectFilter(catalog),
      '<select data-object-canvas-asset-select="true" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(role) + '"' + fieldAttrs + '>',
      '<option value="">' + escapeHtml(t('assets.slotEmpty', 'No asset selected for this slot.')) + '</option>',
      currentValue && !catalog.some((asset) => sourceReferencePathForAsset(asset && asset.path) === sourceReferencePathForAsset(slot.assetRef && slot.assetRef.path)) ? '<option value="' + escapeAttr(currentValue) + '" selected data-asset-search-text="' + escapeAttr(assetSearchText(slot.assetRef)) + '">' + escapeHtml(assetOptionLabel(slot.assetRef) || slot.assetRef.path || slot.assetRef.label || role) + '</option>' : '',
      catalog.map((asset) => renderAssetSelectOption(asset, role, currentValue)).join(''),
      '</select>',
      '</div>',
      '<label class="object-canvas-asset-picker-control">',
      '<span>' + escapeHtml(t('assets.localFile', 'Local file')) + '</span>',
      '<input type="file" accept="' + escapeAttr(slot.type === 'audio' ? 'audio/*' : 'image/*') + '" data-object-canvas-asset-file="true" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(role) + '"' + fieldAttrs + '>',
      '</label>'
    ].join('');
  }

  function renderAssetReplacementControl(slot, target) {
    const ref = slot && slot.assetRef || {};
    const role = String(slot && slot.role || ref.role || '').trim();
    const fieldId = String(ref.assetEditFieldId || '').trim();
    const directive = String(ref.replacementDirective || ref.directive || '').trim();
    if (!role || !fieldId || !directive || !ref.replacementAvailable) {
      return '';
    }
    return [
      '<label class="object-canvas-asset-picker-control object-canvas-asset-replacement-control" data-object-canvas-asset-replacement="true">',
      '<span>' + escapeHtml(t('assets.replaceFile', 'Replacement file')) + '</span>',
      '<input type="file" accept="' + escapeAttr(slot.type === 'audio' ? 'audio/*' : 'image/*') + '" data-object-canvas-asset-file="true" data-existing-asset-field="' + escapeAttr(fieldId) + '" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(role) + '" data-asset-directive="' + escapeAttr(directive) + '" data-current-asset-path="' + escapeAttr(ref.assetCurrentPath || ref.path || '') + '" data-asset-original="' + escapeAttr(ref.assetOriginal || '') + '">',
      '</label>'
    ].join('');
  }

  function renderAssetRemovalControl(slot, target) {
    const ref = slot && slot.assetRef || {};
    const fieldId = String(ref.assetEditFieldId || '').trim();
    if (fieldId && ref.pendingAddition) {
      return [
        '<button type="button" class="object-canvas-asset-remove-control" data-object-canvas-action="clear_asset_addition" data-existing-asset-add-field="' + escapeAttr(fieldId) + '" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(slot && slot.role || ref.role || '') + '" data-asset-directive="' + escapeAttr(ref.replacementDirective || ref.directive || '') + '" data-current-asset-path="' + escapeAttr(ref.assetCurrentPath || ref.path || '') + '">',
        escapeHtml(t('assets.clearPendingAddition', 'Cancel addition')),
        '</button>'
      ].join('');
    }
    if (!fieldId || !ref.allowAssetRemoval || !ref.replacementAvailable) {
      return '';
    }
    return [
      '<button type="button" class="' + assetRemovalButtonClass(ref.pendingRemoval) + '" data-object-canvas-action="remove_asset_reference" data-existing-asset-field="' + escapeAttr(fieldId) + '" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(slot && slot.role || ref.role || '') + '" data-asset-directive="' + escapeAttr(ref.replacementDirective || ref.directive || '') + '" data-current-asset-path="' + escapeAttr(ref.assetCurrentPath || ref.path || '') + '" data-asset-original="' + escapeAttr(ref.assetOriginal || '') + '"' + assetRemovalStateAttrs(ref.pendingRemoval) + '>',
      assetRemovalButtonLabel(ref.pendingRemoval),
      '</button>'
    ].join('');
  }

  function assetRemovalButtonClass(pendingRemoval) {
    return 'object-canvas-asset-remove-control' + (pendingRemoval ? ' is-pending-removal' : '');
  }

  function assetRemovalStateAttrs(pendingRemoval) {
    return ' data-asset-removal-state="' + (pendingRemoval ? 'pending' : 'idle') + '" aria-pressed="' + (pendingRemoval ? 'true' : 'false') + '"';
  }

  function assetRemovalButtonLabel(pendingRemoval) {
    return escapeHtml(pendingRemoval ? t('assets.restoreReference', 'Undo removal') : t('assets.removeReference', 'Remove reference'));
  }

  function assetCatalogForSlot(catalog, slot) {
    const type = String(slot && slot.type || '').trim();
    const role = String(slot && slot.role || '').trim();
    const preferredKeys = preferredAssetKeySet(slot);
    return ensureArray(catalog).filter((asset) => {
      const assetType = String(asset && asset.type || '').trim();
      return asset && (asset.path || asset.id) && (!type || !assetType || assetType === type);
    }).map((asset, index) => ({
      asset,
      index,
      score: assetCatalogScore(asset, role, preferredKeys)
    })).sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      const aLabel = String(a.asset && (a.asset.label || a.asset.name || a.asset.path || a.asset.id) || '');
      const bLabel = String(b.asset && (b.asset.label || b.asset.name || b.asset.path || b.asset.id) || '');
      return aLabel.localeCompare(bLabel) || a.index - b.index;
    }).map((row) => row.asset);
  }

  function assetCatalogScore(asset, role, preferredKeys) {
    const item = asset || {};
    const keys = assetPreferenceKeys(item);
    const preferred = keys.some((key) => preferredKeys.has(key)) ? 1000 : 0;
    const roleMatch = role && String(item.role || '').trim() === role ? 40 : 0;
    const path = String(item.path || item.targetPath || item.id || '').toLowerCase();
    const eventMedia = /(^|\/)(img|images|assets)\/.*\.(png|jpe?g|webp|gif)$/i.test(path) ? 8 : 0;
    return preferred + roleMatch + eventMedia;
  }

  function preferredAssetPathsForField(field, options) {
    const paths = ensureArray(field && field.preferredAssetPaths).map(String);
    ensureArray(options && options.relatedAssets).forEach((asset) => {
      const path = String(asset && (asset.path || asset.targetPath || asset.assetCurrentPath || '') || '').trim();
      if (path) {
        paths.push(path);
      }
    });
    return paths;
  }

  function preferredAssetKeySet(source) {
    const keys = new Set();
    ensureArray(source && source.preferredAssetPaths).forEach((path) => {
      assetPreferenceKeys({path}).forEach((key) => keys.add(key));
    });
    ensureArray(source && source.relatedAssets).forEach((asset) => {
      assetPreferenceKeys(asset).forEach((key) => keys.add(key));
    });
    assetPreferenceKeys(source).forEach((key) => keys.add(key));
    return keys;
  }

  function assetPreferenceKeys(asset) {
    const item = asset || {};
    const raw = [
      item.path,
      item.targetPath,
      item.assetCurrentPath,
      item.label,
      item.name,
      item.id
    ].map((value) => String(value || '').trim()).filter(Boolean);
    const keys = [];
    raw.forEach((value) => {
      const normalized = value.replace(/\\/g, '/').toLowerCase();
      keys.push(normalized);
      const file = normalized.split('/').filter(Boolean).pop();
      if (file) {
        keys.push(file);
      }
    });
    return keys;
  }

  function assetAddFieldLabel(field) {
    const kind = String(field && field.placementKind || '').trim();
    if (kind === 'option_result_visual') {
      return t('assets.addToOptionResult', 'Add image to option result');
    }
    if (kind === 'conditional_visual') {
      return t('assets.addToConditional', 'Add image to conditional branch');
    }
    if (kind === 'menu_visual') {
      return t('assets.addToMenu', 'Add image to menu branch');
    }
    if (kind === 'opening_visual') {
      return t('assets.addToOpening', 'Add opening image');
    }
    if (kind === 'section_visual') {
      return t('assets.addToSection', 'Add image to this section');
    }
    return String(field && field.label || '').trim() || t('assets.addHere', 'Add image here');
  }

  function assetSelectValue(asset, role) {
    const item = asset || {};
    const rawPath = String(item.path || item.targetPath || '').trim();
    const path = sourceReferencePathForAsset(rawPath);
    if (!path) {
      return '';
    }
    return JSON.stringify({
      path,
      previewUrl: String(item.previewUrl || item.url || rawPath).trim(),
      type: String(item.type || 'asset').trim(),
      label: String(item.label || item.name || path).trim(),
      role: String(role || item.role || '').trim()
    });
  }

  function renderAssetSelectFilter(catalog) {
    const count = ensureArray(catalog).length;
    if (count < 16) {
      return '';
    }
    return [
      '<input class="object-canvas-asset-filter" type="search" data-object-canvas-asset-filter="true" placeholder="' + escapeAttr(t('assets.filterIndexed', 'Filter asset path or filename')) + '" aria-label="' + escapeAttr(t('assets.filterIndexed', 'Filter asset path or filename')) + '" autocomplete="off" spellcheck="false">',
      '<small class="object-canvas-asset-picker-count" data-object-canvas-asset-picker-count="true">' + escapeHtml(t('assets.indexedCount', '{count} indexed assets').replace('{count}', String(count))) + '</small>'
    ].join('');
  }

  function renderAssetSelectOption(asset, role, currentValue) {
    const value = assetSelectValue(asset, role);
    if (!value) {
      return '';
    }
    const selected = currentValue && value === currentValue ? ' selected' : '';
    return '<option value="' + escapeAttr(value) + '"' + selected + ' data-asset-search-text="' + escapeAttr(assetSearchText(asset)) + '">' + escapeHtml(assetOptionLabel(asset)) + '</option>';
  }

  function assetOptionLabel(asset) {
    const item = asset || {};
    const path = sourceReferencePathForAsset(item.path || item.targetPath || item.assetCurrentPath || '');
    const label = String(item.label || item.name || '').trim();
    if (label && path && label !== path) {
      return label + ' / ' + path;
    }
    return label || path || String(item.id || '').trim();
  }

  function assetSearchText(asset) {
    const item = asset || {};
    return assetPreferenceKeys(item).concat([
      sourceReferencePathForAsset(item.path || ''),
      sourceReferencePathForAsset(item.targetPath || ''),
      sourceReferencePathForAsset(item.assetCurrentPath || ''),
      assetOptionLabel(item)
    ]).join(' ').toLowerCase();
  }

  function sourceReferencePathForAsset(value) {
    const path = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
    return path.replace(/^out\/html\//i, '');
  }

  function renderPreviewAsset(asset, target) {
    const capability = asset && asset.previewCapability || {};
    const label = asset && (asset.label || asset.name || asset.path) || t('previewObjectEditor.asset', 'Asset');
    const role = asset && (asset.roleLabel || asset.role || asset.type) || capability.mediaKind || '';
    const state = asset && asset.referenceState && asset.referenceState.label ||
      asset && asset.statusLabel ||
      asset && asset.status && asset.status.label ||
      capability.message ||
      '';
    const source = sourceLabelFromRef(asset && asset.source);
    const rowAttrs = previewAssetRowAttrs(asset, target, capability.canPreview && capability.mediaKind === 'image' ? 'object-editing-preview-asset-figure' : 'object-editing-preview-asset-ref');
    if (capability.canPreview && capability.mediaKind === 'image' && capability.url) {
      return [
        '<figure' + rowAttrs + '>',
        '<img src="' + escapeAttr(capability.url) + '" alt="' + escapeAttr(label) + '" loading="lazy">',
        '<figcaption>' + escapeHtml([role, label, state].filter(Boolean).join(' / ')) + '</figcaption>',
        source ? '<small>' + escapeHtml(source) + '</small>' : '',
        '</figure>'
      ].join('');
    }
    return [
      '<div' + rowAttrs + '>',
      '<strong>' + escapeHtml(label) + '</strong>',
      role ? '<small>' + escapeHtml(role) + '</small>' : '',
      asset && asset.path ? '<code>' + escapeHtml(asset.path) + '</code>' : '',
      state ? '<small>' + escapeHtml(state) + '</small>' : '',
      asset && asset.installRequest && asset.installRequest.sourceName ? '<small>' + escapeHtml(asset.installRequest.sourceName) + '</small>' : '',
      source ? '<small>' + escapeHtml(source) + '</small>' : '',
      '</div>'
    ].join('');
  }

  function previewAssetRowAttrs(asset, target, baseClass) {
    const rowKind = asset && asset.rowKind || 'asset_ref';
    const state = asset && asset.referenceState && asset.referenceState.key ||
      asset && asset.status && asset.status.key ||
      typeof (asset && asset.status) === 'string' && asset.status ||
      '';
    const classes = [baseClass, 'object-canvas-asset-row', 'asset-kind-' + safeClass(rowKind)].filter(Boolean).join(' ');
    return [
      ' class="' + escapeAttr(classes) + '"',
      ' data-preview-object-asset-row="true"',
      ' data-object-canvas-asset-row="true"',
      ' data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '"',
      ' data-asset-row-kind="' + escapeAttr(rowKind) + '"',
      ' data-asset-role="' + escapeAttr(asset && asset.role || '') + '"',
      ' data-asset-state="' + escapeAttr(state) + '"',
      asset && asset.directive ? ' data-asset-directive="' + escapeAttr(asset.directive) + '"' : ''
    ].join('');
  }

  function renderKindEditor(kind, body, model) {
    if (kind === 'card') {
      return renderCardEditor(body, model);
    }
    if (kind === 'news') {
      return renderNewsEditor(body, model);
    }
    if (kind === 'text-replacement') {
      return renderTextReplacementEditor(body, model);
    }
    return renderEventEditor(body, model);
  }

  function renderEventEditor(body, model) {
    const sections = ensureArray(body.sections);
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
      sections.length
        ? '<div class="preview-object-prose" data-preview-object-prose="true">' + sections.map((field, index) => [
          renderInlineField(field, {
            role: 'body',
            element: 'textarea',
            fallbackLabel: t('previewObjectEditor.paragraph', 'Paragraph') + ' ' + (index + 1),
            assetBaseUrl: textOptions.assetBaseUrl
          }),
          renderInlineAssetPlacements(assetsForBranch(field, body), assetAddFieldsForBranch(field, body), 'event', body, model)
        ].join('')).join('') + '</div>'
        : renderEmpty(t('objectCanvas.noBodyFields', 'No player-facing body fields are available yet.')),
      renderChoiceEditor(options, 'event', body, renderPlan, model),
      renderFlowOverview(body.flow, model, 'editor'),
      eventBuilderUi().renderChoiceUnitSummary(body.choiceUnits),
      eventBuilderUi().renderConsequenceGroups(body.consequenceGroups),
      eventBuilderUi().renderContinuationMap(body.continuationMap),
      eventBuilderUi().renderPlayabilityChecks(body.playabilityChecks),
      eventBuilderUi().renderRouteScriptIntelligence(body),
      eventBuilderUi().renderEventGraphSummary(body.eventGraph),
      eventBuilderUi().renderEventReadiness(body.readinessChecklist),
      renderBranchSectionEditor(branchSections, textOptions, body, renderPlan, model),
      renderAssetEditorPanel(body, 'event', model),
      renderLogicEditor(body, 'event'),
      '</article>'
    ].join('');
  }

  function renderBranchSectionEditor(branches, options, body, renderPlan, model) {
    const rows = ensureArray(branches).filter(Boolean);
    const addBranch = structureUi().firstStructureAction(body, 'add_branch');
    if (!rows.length && !addBranch) {
      return '';
    }
    const opts = options || {};
    const limit = renderPlan && renderPlan.branchLimit && rows.length > renderPlan.branchLimit ? renderPlan.branchLimit : rows.length;
    const visibleRows = rows.slice(0, limit);
    const deferredRows = rows.slice(limit);
    return [
      '<section class="preview-object-branches" data-preview-object-branches="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.branchText', 'Conditional and follow-up text')) + '</div>',
      visibleRows.map((field) => [
        '<article class="preview-object-branch-group" data-preview-object-branch-role="' + escapeAttr(field.semanticRole || field.branchKind || 'branch') + '">',
        renderInlineField(field, {
          role: branchFieldRole(field),
          element: 'textarea',
          fallbackLabel: branchLabel(field),
          assetBaseUrl: opts.assetBaseUrl
        }),
        renderConditionalAlternatives(field, opts),
        renderInlineAssetPlacements(assetsForBranch(field, body), assetAddFieldsForBranch(field, body), editorKind(model, body), body, model),
        structureUi().branchStructureActions(field, body).map((actionField) => {
          return /^add_/.test(String(actionField && actionField.structureAction || ''))
            ? structureUi().renderInlineAddAction(actionField, body)
            : structureUi().renderCompactStructureAction(actionField, body);
        }).join(''),
        '</article>'
      ].join('')).join(''),
      deferredRows.length ? renderDeferredBranchSummary(deferredRows) : '',
      addBranch ? structureUi().renderInlineAddAction(addBranch, body) : '',
      '</section>'
    ].join('');
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
          renderInlineAssetPlacements(assetsForBranch(field, body), assetAddFieldsForBranch(field, body), 'card', body, model)
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
    const limit = renderPlan && owner === 'event' && renderPlan.choiceLimit && rows.length > renderPlan.choiceLimit ? renderPlan.choiceLimit : rows.length;
    const visibleRows = rows.slice(0, limit);
    const deferredRows = rows.slice(limit);
    return [
      '<section class="preview-object-choices" data-preview-object-choices="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('objectPreview.choices', 'Choices')) + '</div>',
      rows.length ? visibleRows.map((option, index) => renderChoice(option, index, owner, body, model)).join('') : renderEmpty(pureEvent ? t('previewObjectEditor.noChoiceEvent', 'This event has no player choices.') : t('objectCanvas.noOptions', 'No options found for this object.')),
      deferredRows.length ? renderDeferredChoiceSummary(deferredRows, visibleRows.length) : '',
      addOption ? structureUi().renderInlineAddAction(addOption, body) : '',
      '</section>'
    ].join('');
  }

  function renderAssetEditorPanel(body, target, model) {
    const value = body && typeof body === 'object' ? body : {};
    return renderPreviewAssets(value.assets, target, {
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
    return [
      '<details class="preview-object-large-deferred" data-preview-object-large-deferred="choices" data-preview-object-deferred-count="' + escapeAttr(String(count)) + '">',
      '<summary>' + escapeHtml(t('previewObjectEditor.largeEventDeferredChoices', '{count} additional choices summarized').replace('{count}', String(count))) + '</summary>',
      '<div class="preview-object-large-deferred-list">',
      ensureArray(rows).slice(0, 10).map((option, index) => renderDeferredChoiceRow(option, offset + index)).join(''),
      count > 10 ? '<small>' + escapeHtml(t('previewObjectEditor.largeEventDeferredMore', '{count} more rows').replace('{count}', String(count - 10))) + '</small>' : '',
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
    return [
      '<details class="preview-object-large-deferred" data-preview-object-large-deferred="branches" data-preview-object-deferred-count="' + escapeAttr(String(count)) + '">',
      '<summary>' + escapeHtml(t('previewObjectEditor.largeEventDeferredBranches', '{count} additional text blocks summarized').replace('{count}', String(count))) + '</summary>',
      '<div class="preview-object-large-deferred-list">',
      ensureArray(rows).slice(0, 10).map(renderDeferredBranchRow).join(''),
      count > 10 ? '<small>' + escapeHtml(t('previewObjectEditor.largeEventDeferredMore', '{count} more rows').replace('{count}', String(count - 10))) + '</small>' : '',
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
    const meta = ensureArray(body && body.metaFields);
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
        triggerEffects.length || triggerActions.length
          ? '<section class="preview-object-logic-section"><h4>' + escapeHtml(t('previewObjectEditor.triggerEffects', 'Trigger effects')) + '</h4>' + renderEffectFields(triggerEffects.concat(triggerActions), body) + '</section>'
          : '',
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
      triggerEffects.length || triggerActions.length
        ? '<section class="preview-object-logic-section"><h4>' + escapeHtml(t('previewObjectEditor.triggerEffects', 'Trigger effects')) + '</h4>' + renderEffectFields(triggerEffects.concat(triggerActions), body) + '</section>'
        : '',
      '</details>'
    ].join('');
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

  function renderEffectGroup(group) {
    const fields = ensureArray(group && group.fields);
    if (!fields.length) {
      return '';
    }
    return [
      '<div class="preview-object-effect-group">',
      '<strong>' + escapeHtml(group && group.label || group && group.id || t('storyboard.option', 'Option')) + '</strong>',
      renderEffectFields(fields),
      '</div>'
    ].join('');
  }

  function renderEffectFields(fields, body) {
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

  function renderChoice(option, index, owner, eventBody, model) {
    const fields = ensureArray(option && option.fields);
    const label = choiceLabelField(option, fields, owner, index);
    const resultFields = optionResultFields(option, fields);
    const resultField = firstField(fields, /body|result|narrative/i) || resultFields[0] || null;
    const subtitle = firstField(fields, /subtitle/i);
    const unavailable = fields.find((field) => String(field && field.role || '') === 'unavailable_text') || null;
    const target = option && (option.targetId || option.gotoAfter || '');
    const choiceActions = structureUi().optionStructureActions(option, eventBody);
    const effectGroup = structureUi().optionEffectGroup(option, eventBody);
    const choiceDeleteActions = choiceActions.filter((field) => ['remove_option', 'remove_option_condition'].includes(String(field && field.structureAction || '')));
    const choiceEffectActions = choiceActions.filter((field) => ['add_option_effect', 'remove_effect'].includes(String(field && field.structureAction || '')));
    const resultActions = structureUi().resultSectionActions(ensureArray(option && option.resultFields), eventBody);
    const conditionFields = resultFields;
    const consumedFields = [label, resultField, subtitle, unavailable].concat(resultFields).filter(Boolean);
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
      target ? '<small>' + escapeHtml(t('objectCanvas.optionTarget', 'Target') + ': ' + target) + '</small>' : '',
      renderOptionConditionChips(option, conditionFields),
      '</div>',
      choiceDeleteActions.length ? '<div class="preview-object-entry-actions">' + choiceDeleteActions.map((field) => structureUi().renderCompactStructureAction(field, eventBody)).join('') + '</div>' : '',
      subtitle ? renderInlineField(subtitle, {
        role: 'choice-subtitle',
        element: 'input'
      }) : '',
      unavailable ? renderInlineField(unavailable, {
        role: 'choice-unavailable',
        element: 'textarea'
      }) : '',
      resultField ? renderInlineField(resultField, {
        role: 'choice-body',
        element: 'textarea'
      }) : '',
      renderInlineAssetPlacements(assetsForOption(option, eventBody, resultFields), assetAddFieldsForOption(option, eventBody, resultFields), owner, eventBody, model),
      resultActions.length ? '<div class="preview-object-entry-actions preview-object-section-actions">' + resultActions.map((field) => structureUi().renderInlineAddAction(field, eventBody)).join('') + '</div>' : '',
      effectGroup || choiceEffectActions.length
        ? '<section class="preview-object-choice-effects"><h5>' + escapeHtml(t('previewObjectEditor.choiceEffects', 'Choice effects')) + '</h5>' + renderEffectFields(ensureArray(effectGroup && effectGroup.fields).concat(choiceEffectActions), eventBody) + '</section>'
        : '',
      rest.length ? '<details class="preview-object-choice-details"><summary>' + escapeHtml(t('objectCanvas.advancedFields', 'Timing and advanced fields')) + '</summary>' + rest.map((field) => renderInlineField(field, {
        role: 'choice-detail',
        element: field && field.id && /body|text/i.test(field.id) ? 'textarea' : 'input'
      })).join('') + '</details>' : '',
      '</article>'
    ].join('');
  }

  function renderOptionConditionChips(option, resultFields) {
    const rows = optionConditionSummaries(option, resultFields);
    if (!rows.length) {
      return '';
    }
    return [
      '<div class="preview-object-condition-chips" data-preview-object-condition-chips="true">',
      rows.map((row) => [
        '<span data-condition-kind="' + escapeAttr(row.kind || 'condition') + '">',
        '<strong>' + escapeHtml(row.label) + '</strong>',
        '<em>' + escapeHtml(row.value) + '</em>',
        '</span>'
      ].join('')).join(''),
      '</div>'
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
    const label = displayFieldLabel(field, rawLabel);
    const readOnly = Boolean(opts.forceReadOnly || field && (field.readOnly || !id));
    const element = opts.element === 'input' || opts.element === 'select' || opts.element === 'checkbox' ? opts.element : 'textarea';
    const action = String(field && field.structureAction || '');
    const className = [
      'preview-object-field',
      'preview-object-field-' + safeClass(opts.role || 'field'),
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
    const renderedPreview = fieldTextPreview(value, id, element, opts);
    return [
      '<label class="' + escapeAttr(className) + '" data-preview-object-field-role="' + escapeAttr(opts.role || 'field') + '"' + structureData + '>',
      label ? renderEditorFieldLabel(label, rawLabel) : '',
      renderFieldContextLens(field, opts.role || 'field'),
      fieldVisualBadges(field),
      fieldContextHint(field) ? '<small class="preview-object-field-context">' + escapeHtml(fieldContextHint(field)) + '</small>' : '',
      fieldLogicChips(field),
      control,
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

  function renderEditorFieldLabel(label, rawLabel) {
    const source = String(rawLabel || '').trim();
    const title = source && source !== String(label || '').trim()
      ? ' title="' + escapeAttr(source) + '"'
      : '';
    return [
      '<span class="preview-object-field-label" data-preview-object-field-label="true"' + title + '>',
      '<em>' + escapeHtml(t('previewObjectEditor.editorField', 'Editor field')) + '</em>',
      '<b>' + escapeHtml(label || '') + '</b>',
      '<i class="visible-edit-affordance" data-visible-edit-affordance="object-canvas-preview">' + escapeHtml(t('visibleEdit.action', 'Edit')) + '</i>',
      '</span>'
    ].join('');
  }

  function displayFieldLabel(field, fallbackLabel) {
    const label = String(fallbackLabel || field && field.label || field && field.id || '').trim();
    const role = String(field && (field.semanticRole || field.branchKind || field.role) || '').toLowerCase();
    const action = String(field && field.structureAction || '').toLowerCase();
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
        optionsList.map((option) => renderOption(option, opts.value)).join(''),
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

  function renderOption(option, current) {
    const value = typeof option === 'string' ? option : String(option && option.value || '');
    const label = typeof option === 'string' ? option : String(option && (option.label || option.value) || '');
    return '<option value="' + escapeAttr(value) + '"' + (String(value) === String(current || '') ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
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
    const role = String(field && (field.role || field.semanticRole) || '');
    if (/^(?:option_result|option_result_text|conditional_option_result_text|unavailable_text)$/.test(role)) {
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
      'text-replacement': t('objectPreview.textPatch', 'Text Patch')
    }[kind] || t('objectPreview.title', 'Object Preview');
  }

  function subtitleForKind(kind) {
    return {
      event: t('previewObjectEditor.intent.event', 'Edit the event as a visible player-facing panel; Canvas keeps the timeline context beside it.'),
      news: t('previewObjectEditor.intent.news', 'Edit the news item as a visible headline and description card.'),
      card: t('previewObjectEditor.intent.card', 'Edit the full card face instead of squeezing card text into the board thumbnail.'),
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

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
