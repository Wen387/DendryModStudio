(function initProjectMapPreviewObjectEditor(global) {
  'use strict';

  const api = {
    render,
    renderModal,
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
    return [
      '<div class="object-editing-modal-backdrop" data-object-editing-modal="true" data-object-editing-modal-kind="' + escapeAttr(kind) + '">',
      '<section class="object-editing-modal-dialog" role="dialog" aria-modal="true" aria-label="' + escapeAttr(t('previewObjectEditor.modalTitle', 'Object editor')) + '">',
      '<header class="object-editing-modal-header">',
      '<div>',
      '<span>' + escapeHtml(t('previewObjectEditor.eyebrow', 'Visible object editor')) + '</span>',
      '<h3 data-preview-object-editor-title="true">' + renderTextInline(title || labelForKind(kind)) + '</h3>',
      '<p>' + escapeHtml(subtitleForKind(kind)) + '</p>',
      '</div>',
      '<button type="button" data-object-canvas-action="toggle_overlay" aria-label="' + escapeAttr(t('previewObjectEditor.close', 'Close editor')) + '">' + escapeHtml(t('previewObjectEditor.close', 'Close editor')) + '</button>',
      '</header>',
      '<div class="object-editing-modal-grid">',
      '<section class="object-editing-preview-pane" data-object-editing-modal-preview-pane="true">',
      renderPreviewPane(model, opts),
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
    return [
      '<div class="editing-actions object-editing-modal-actions">',
      '<button type="button" data-object-canvas-action="refresh">' + escapeHtml(t('existingScene.refresh', 'Refresh proposal')) + '</button>',
      '<button type="button" data-object-canvas-action="save">' + escapeHtml(t('editing.saveToChanges', 'Save to My Changes')) + '</button>',
      '<button class="primary-action" type="button" data-object-canvas-action="review">' + escapeHtml(t('existingScene.review', 'Review & Apply')) + '</button>',
      model && model.mode !== 'existing' ? '<button type="button" data-object-canvas-action="legacy_form">' + escapeHtml(t('objectCanvas.legacyForm', 'Advanced Form')) + '</button>' : '',
      '</div>'
    ].join('');
  }

  function renderEventPreview(body, model) {
    const previewBody = bodyWithPendingStructure(body);
    const sections = ensureArray(previewBody.sections);
    const branchSections = ensureArray(previewBody.branchSections);
    const options = ensureArray(previewBody.options);
    const assets = ensureArray(previewBody.assets);
    return [
      '<article class="object-editing-live-preview object-editing-event-preview">',
      '<div class="object-editing-preview-kicker">' + escapeHtml(t('objectPreview.event', 'World Event')) + '</div>',
      '<h4>' + renderTextInline(fieldValue(previewBody.title || previewBody.heading) || model && model.title || t('objectPreview.event', 'World Event')) + '</h4>',
      previewBody.heading && fieldId(previewBody.heading) !== fieldId(previewBody.title) ? '<h5>' + renderTextInline(fieldValue(previewBody.heading)) + '</h5>' : '',
      sections.length ? renderPreviewSections(sections, previewBody, model) : renderEmpty(t('objectPreview.noPreview', 'No preview text')),
      renderPreviewChoices(options, 'event', previewBody, model),
      renderPreviewBranches(branchSections, previewTextOptions(previewBody, model)),
      renderPreviewAssets(assets),
      renderPreviewEffects(previewBody, model),
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
    const subtitle = firstField(sections, /subtitle/i);
    const mainSections = sections.filter((field) => field !== subtitle);
    return [
      '<article class="object-editing-live-preview object-editing-card-preview">',
      '<div class="object-editing-preview-kicker">' + escapeHtml(t('objectPreview.card', 'Card')) + '</div>',
      '<h4>' + renderTextInline(fieldValue(body.title || body.heading) || model && model.title || t('objectPreview.card', 'Card')) + '</h4>',
      subtitle ? '<em>' + renderTextInline(fieldValue(subtitle)) + '</em>' : '',
      mainSections.length ? '<div class="object-editing-preview-copy">' + mainSections.map((field) => renderTextBlocks(fieldValue(field), {empty: false})).join('') + '</div>' : renderEmpty(t('objectPreview.empty', 'No player-facing text is available yet.')),
      renderPreviewChoices(ensureArray(body.options), 'card', body, model),
      renderPreviewEffects(body, model),
      '</article>'
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
        return [
          '<section class="object-editing-preview-section" data-preview-visual-kind="' + escapeAttr(visualLabel ? ensureArray(field.visualKinds).join(' ') : 'text') + '">',
          renderStudioRoleLabel(previewSectionLabel(field)),
          visualLabel ? '<small>' + escapeHtml(visualLabel) + '</small>' : '',
          renderTextBlocks(fieldValue(field), Object.assign({empty: false}, opts)),
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
        '<li data-preview-effect-kind="' + escapeAttr(row.kind || 'effect') + '">',
        '<strong>' + escapeHtml(row.label) + '</strong>',
        '<code>' + escapeHtml(row.value) + '</code>',
        row.context ? '<small>' + escapeHtml(row.context) + '</small>' : '',
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
        context: sourceLabelFromRef(field && field.source)
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
          context: sourceLabelFromRef(field && field.source)
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
        context: sourceLabelFromRef(effect && effect.source)
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
    const label = firstField(fields, /(?:^|\.)(label|title)$/i) || fields[0] || fallbackField(owner + '.option.' + index + '.label', t('storyboard.option', 'Option') + ' ' + (index + 1), option && (option.label || option.id));
    const resultFields = optionResultFields(option, fields);
    const impacts = optionImpactRows(option, body, resultFields, model);
    return [
      '<article class="object-editing-preview-choice-card" data-object-editing-preview-choice="' + escapeAttr(option && option.id || String(index + 1)) + '">',
      '<div class="object-editing-preview-choice-head">',
      '<b>' + escapeHtml(String(index + 1)) + '</b>',
      '<button type="button" disabled>' + renderTextInline(fieldValue(label) || option && option.id || String(index + 1)) + '</button>',
      '</div>',
      resultFields.length ? [
        '<div class="object-editing-preview-choice-result" data-object-editing-preview-choice-result="true">',
        renderStudioRoleLabel(t('previewObjectEditor.afterChoice', 'After choice')),
        resultFields.map((field) => renderTextBlocks(fieldValue(field), Object.assign({empty: false}, previewTextOptions(body, model)))).join(''),
        '</div>'
      ].join('') : '',
      impacts.length ? [
        '<ul class="object-editing-preview-choice-impacts" data-object-editing-preview-choice-impacts="true">',
        impacts.map((impact) => '<li data-choice-impact-kind="' + escapeAttr(impact.kind || 'impact') + '"><strong>' + escapeHtml(impact.label) + '</strong>' + (impact.value ? '<span>' + escapeHtml(impact.value) + '</span>' : '') + '</li>').join(''),
        '</ul>'
      ].join('') : '',
      '</article>'
    ].join('');
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
        value: endpointDisplay(optionTarget, model)
      });
    }
    routeFieldsForOption(option, body, resultFields).forEach((field) => {
      const value = endpointDisplay(fieldValue(field), model);
      if (value) {
        rows.push({
          kind: 'route',
          label: t('previewObjectEditor.continuesTo', 'Continues to'),
          value
        });
      }
    });
    optionConditions(option, resultFields).forEach((condition) => {
      rows.push({
        kind: 'condition',
        label: t('previewObjectEditor.when', 'When'),
        value: condition
      });
    });
    optionEffectFields(option, body).forEach((field) => {
      const value = fieldValue(field);
      if (value) {
        rows.push({
          kind: 'effect',
          label: t('previewObjectEditor.choiceEffects', 'Choice effects'),
          value
        });
      }
    });
    optionConsumedVariables(resultFields).forEach((name) => {
      rows.push({
        kind: 'variable',
        label: t('previewObjectEditor.textConsumes', 'text consumes'),
        value: 'Q.' + name
      });
    });
    optionConditionVariables(resultFields).forEach((name) => {
      rows.push({
        kind: 'variable',
        label: t('previewObjectEditor.conditionReads', 'condition reads'),
        value: 'Q.' + name
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
      out.push({kind: row.kind || 'impact', label, value});
    });
    return out;
  }

  function renderPreviewBranches(branches, options) {
    const rows = ensureArray(branches).filter((field) => field && fieldValue(field).trim()).slice(0, 6);
    if (!rows.length) {
      return '';
    }
    const opts = options || {};
    return [
      '<div class="object-editing-preview-branches" data-object-editing-preview-branches="true">',
      '<span class="object-editing-preview-group-label">' + escapeHtml(t('previewObjectEditor.branchPreview', 'Follow-up and branch text')) + '</span>',
      rows.map((field) => [
        '<article data-preview-branch-role="' + escapeAttr(field && (field.semanticRole || field.branchKind) || 'branch') + '">',
        renderStudioRoleLabel(branchLabel(field)),
        branchConditionText(field) ? '<small>' + escapeHtml(branchConditionText(field)) + '</small>' : '',
        renderTextBlocks(fieldValue(field), {empty: false, assetBaseUrl: opts.assetBaseUrl || ''}),
        '</article>'
      ].join('')).join(''),
      '</div>'
    ].join('');
  }

  function renderPreviewAssets(assets) {
    const rows = ensureArray(assets).filter((asset) => asset && (asset.path || asset.label || asset.name));
    if (!rows.length) {
      return '';
    }
    return [
      '<div class="object-editing-preview-assets" data-object-editing-preview-assets="true">',
      '<span class="object-editing-preview-group-label">' + escapeHtml(t('previewObjectEditor.assets', 'Referenced assets')) + '</span>',
      rows.slice(0, 4).map(renderPreviewAsset).join(''),
      '</div>'
    ].join('');
  }

  function renderPreviewAsset(asset) {
    const capability = asset && asset.previewCapability || {};
    const label = asset && (asset.label || asset.name || asset.path) || t('previewObjectEditor.asset', 'Asset');
    const role = asset && (asset.role || asset.type) || capability.mediaKind || '';
    const state = asset && asset.referenceState && asset.referenceState.label || asset && asset.status && asset.status.label || capability.message || '';
    if (capability.canPreview && capability.mediaKind === 'image' && capability.url) {
      return [
        '<figure>',
        '<img src="' + escapeAttr(capability.url) + '" alt="' + escapeAttr(label) + '" loading="lazy">',
        '<figcaption>' + escapeHtml([role, label, state].filter(Boolean).join(' / ')) + '</figcaption>',
        '</figure>'
      ].join('');
    }
    return [
      '<div class="object-editing-preview-asset-ref">',
      '<strong>' + escapeHtml(label) + '</strong>',
      role ? '<small>' + escapeHtml(role) + '</small>' : '',
      asset && asset.path ? '<code>' + escapeHtml(asset.path) + '</code>' : '',
      state ? '<small>' + escapeHtml(state) + '</small>' : '',
      '</div>'
    ].join('');
  }

  function bodyWithPendingStructure(body) {
    const base = body && typeof body === 'object' ? body : {};
    const pending = pendingStructurePreview(base);
    if (!pending.options.length && !pending.branches.length && !pending.triggerEffects.length && !pending.optionEffects.length) {
      return base;
    }
    return Object.assign({}, base, {
      options: ensureArray(base.options).concat(pending.options),
      branchSections: ensureArray(base.branchSections).concat(pending.branches),
      effects: ensureArray(base.effects).concat(pending.triggerEffects),
      optionEffects: ensureArray(base.optionEffects).concat(pending.optionEffects)
    });
  }

  function pendingStructurePreview(body) {
    const pending = {
      options: [],
      branches: [],
      triggerEffects: [],
      optionEffects: []
    };
    ensureArray(body && body.structureActions).forEach((field) => {
      const action = String(field && field.structureAction || '');
      const value = fieldValue(field).trim();
      if (!value || field && field.inputType === 'checkbox') {
        return;
      }
      if (action === 'add_option') {
        const draft = parseAddOptionDraft(value);
        const target = draft.target || slugForStructurePreview(draft.label) || 'new_option';
        const label = draft.label || t('previewObjectEditor.structureOptionTextPlaceholder', 'What the player clicks');
        const result = draft.result || '';
        pending.options.push({
          id: 'draft_' + safeClass(fieldId(field) || target),
          targetId: target,
          rawTargetId: target,
          sectionId: target,
          sectionLabel: target,
          label,
          isPendingStructure: true,
          fields: [{
            id: (fieldId(field) || target) + '_preview_label',
            label: t('previewObjectEditor.structureOptionText', 'Option text'),
            value: label,
            original: label,
            readOnly: true,
            status: 'manual'
          }],
          resultFields: result ? [{
            id: (fieldId(field) || target) + '_preview_result',
            label: t('previewObjectEditor.optionResult', 'Option result'),
            value: result,
            original: result,
            semanticRole: 'option_result_text',
            sectionId: target,
            sectionLabel: target,
            textVariables: variablesFromDendryText(result),
            readOnly: true,
            status: 'manual'
          }] : []
        });
        return;
      }
      if (action === 'add_branch') {
        const draft = parseBranchDraft(value);
        const section = draft.section || 'follow_up';
        const text = draft.text || '';
        const conditionVariables = variablesFromCondition(draft.condition);
        pending.branches.push({
          id: (fieldId(field) || section) + '_preview_branch',
          label: draft.condition
            ? t('previewObjectEditor.conditionalText', 'Conditional text')
            : t('previewObjectEditor.followUpPage', 'Follow-up page'),
          value: draft.condition
            ? '[? if ' + draft.condition + ' : ' + (text || t('previewObjectEditor.structureBranchTextPlaceholder', 'Conditional or follow-up prose')) + ' ?]'
            : (text || t('previewObjectEditor.structureBranchTextPlaceholder', 'Conditional or follow-up prose')),
          original: text,
          semanticRole: draft.condition ? 'conditional_text' : 'section_text',
          branchKind: draft.condition ? 'conditional' : 'section',
          sectionId: section,
          sectionLabel: section,
          conditions: draft.condition ? [draft.condition] : [],
          conditionVariables,
          logicContext: conditionVariables.length ? {conditions: [{raw: draft.condition, variables: conditionVariables}], reads: conditionVariables, conditionVariables, textVariables: []} : null,
          readOnly: true,
          status: 'manual'
        });
        return;
      }
      if (action === 'add_trigger_effect') {
        pending.triggerEffects.push(Object.assign({}, field, {
          value,
          original: value,
          label: t('previewObjectEditor.structureTriggerEffectTitle', 'New trigger effect'),
          status: 'manual'
        }));
        return;
      }
      if (action === 'add_option_effect') {
        const target = String(field && (field.optionId || field.sectionId || field.structureTargetLabel || field.label) || '').trim();
        pending.optionEffects.push({
          id: target,
          label: String(field && (field.structureTargetLabel || field.label || target) || ''),
          fields: [Object.assign({}, field, {
            value,
            original: value,
            label: t('previewObjectEditor.structureChoiceEffectTitle', 'New choice effect'),
            status: 'manual'
          })]
        });
      }
    });
    return pending;
  }

  function slugForStructurePreview(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48);
  }

  function variablesFromDendryText(value) {
    const names = [];
    const re = /\[\+\s*([A-Za-z_][A-Za-z0-9_]*)\b/g;
    let match;
    while ((match = re.exec(String(value || ''))) !== null) {
      names.push(match[1]);
    }
    return uniqueStrings(names);
  }

  function variablesFromCondition(value) {
    const text = String(value || '')
      .replace(/'[^']*'|"[^"]*"/g, ' ')
      .replace(/<[^>]+>/g, ' ');
    const names = [];
    let match;
    const dotted = /\bQ\.([A-Za-z_][A-Za-z0-9_]*)\b/g;
    while ((match = dotted.exec(text)) !== null) {
      names.push(match[1]);
    }
    const reserved = new Set(['and', 'or', 'not', 'if', 'true', 'false', 'is', 'in']);
    const bare = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
    while ((match = bare.exec(text)) !== null) {
      const name = match[1];
      if (!reserved.has(name.toLowerCase()) && !/^\d/.test(name)) {
        names.push(name);
      }
    }
    return uniqueStrings(names);
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
    return [
      '<article class="preview-object-frame preview-object-event-frame" data-preview-object-event="true">',
      '<div class="preview-object-kicker">' + escapeHtml(t('objectPreview.event', 'World Event')) + '</div>',
      renderInlineField(body.title || body.heading || fallbackField('event.title', t('create.help.title', 'Title'), model && model.title), {
        role: 'title',
        element: 'input',
        className: 'preview-object-title-input'
      }),
      body.heading && fieldId(body.heading) !== fieldId(body.title) ? renderInlineField(body.heading, {
        role: 'heading',
        element: 'input'
      }) : '',
      sections.length
        ? '<div class="preview-object-prose" data-preview-object-prose="true">' + sections.map((field, index) => renderInlineField(field, {
          role: 'body',
          element: 'textarea',
          fallbackLabel: t('previewObjectEditor.paragraph', 'Paragraph') + ' ' + (index + 1),
          assetBaseUrl: textOptions.assetBaseUrl
        })).join('') + '</div>'
        : renderEmpty(t('objectCanvas.noBodyFields', 'No player-facing body fields are available yet.')),
      renderChoiceEditor(options, 'event', body),
      renderBranchSectionEditor(branchSections, textOptions, body),
      renderLogicEditor(body, 'event'),
      renderAssetReferenceEditor(body.assets),
      '</article>'
    ].join('');
  }

  function renderBranchSectionEditor(branches, options, body) {
    const rows = ensureArray(branches).filter(Boolean);
    const addBranch = firstStructureAction(body, 'add_branch');
    if (!rows.length && !addBranch) {
      return '';
    }
    const opts = options || {};
    return [
      '<section class="preview-object-branches" data-preview-object-branches="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.branchText', 'Conditional and follow-up text')) + '</div>',
      rows.map((field) => [
        '<article class="preview-object-branch-group" data-preview-object-branch-role="' + escapeAttr(field.semanticRole || field.branchKind || 'branch') + '">',
        renderInlineField(field, {
          role: branchFieldRole(field),
          element: 'textarea',
          fallbackLabel: branchLabel(field),
          assetBaseUrl: opts.assetBaseUrl
        }),
        branchStructureActions(field, body).map(renderCompactStructureAction).join(''),
        '</article>'
      ].join('')).join(''),
      addBranch ? renderInlineAddAction(addBranch) : '',
      '</section>'
    ].join('');
  }

  function renderAssetReferenceEditor(assets) {
    const rows = ensureArray(assets).filter((asset) => asset && (asset.path || asset.label || asset.name));
    if (!rows.length) {
      return '';
    }
    return [
      '<section class="preview-object-assets" data-preview-object-assets="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.assets', 'Referenced assets')) + '</div>',
      rows.map((asset) => [
        '<article>',
        '<strong>' + escapeHtml(asset.label || asset.name || asset.path || t('previewObjectEditor.asset', 'Asset')) + '</strong>',
        asset.role || asset.type ? '<small>' + escapeHtml([asset.role, asset.type].filter(Boolean).join(' / ')) + '</small>' : '',
        asset.path ? '<code>' + escapeHtml(asset.path) + '</code>' : '',
        asset.referenceState && asset.referenceState.help ? '<small>' + escapeHtml(asset.referenceState.help) + '</small>' : '',
        '</article>'
      ].join('')).join(''),
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
    const subtitle = firstField(sections, /subtitle/i);
    const mainSections = sections.filter((field) => field !== subtitle);
    const options = ensureArray(body.options);
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
        ? '<div class="preview-object-prose" data-preview-object-prose="true">' + mainSections.map((field) => renderInlineField(field, {
          role: 'body',
          element: 'textarea'
        })).join('') + '</div>'
        : renderEmpty(t('objectPreview.empty', 'No player-facing text is available yet.')),
      renderChoiceEditor(options, 'card', body),
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

  function renderChoiceEditor(options, owner, body) {
    const rows = ensureArray(options);
    const addOption = firstStructureAction(body, 'add_option');
    if (!rows.length && !addOption) {
      return '<section class="preview-object-choices is-empty">' + renderEmpty(t('objectCanvas.noOptions', 'No options found for this object.')) + '</section>';
    }
    return [
      '<section class="preview-object-choices" data-preview-object-choices="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('objectPreview.choices', 'Choices')) + '</div>',
      rows.length ? rows.map((option, index) => renderChoice(option, index, owner, body)).join('') : renderEmpty(t('objectCanvas.noOptions', 'No options found for this object.')),
      addOption ? renderInlineAddAction(addOption) : '',
      '</section>'
    ].join('');
  }

  function renderLogicEditor(body, owner) {
    const meta = ensureArray(body && body.metaFields);
    const variables = ensureArray(body && body.variables);
    const backgroundEffects = ensureArray(body && body.backgroundEffects);
    const triggerEffects = ensureArray(body && body.effects);
    const triggerActions = triggerStructureActions(body);
    if (!meta.length && !variables.length && !backgroundEffects.length && !triggerEffects.length && !triggerActions.length) {
      return '';
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
        ? '<section class="preview-object-logic-section"><h4>' + escapeHtml(t('previewObjectEditor.triggerEffects', 'Trigger effects')) + '</h4>' + renderEffectFields(triggerEffects.concat(triggerActions)) + '</section>'
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

  function renderStructureActionField(field) {
    const action = String(field && field.structureAction || '');
    if (action === 'add_option') {
      return renderAddOptionBuilder(field);
    }
    if (action === 'add_branch') {
      return renderAddBranchBuilder(field);
    }
    if (action === 'add_trigger_effect' || action === 'add_option_effect') {
      return renderEffectBuilder(field, action);
    }
    return renderInlineField(field, {
      role: 'structure',
      element: logicFieldElement(field)
    });
  }

  function renderInlineAddAction(field) {
    return [
      '<details class="preview-object-inline-add" data-preview-object-inline-add="' + escapeAttr(String(field && field.structureAction || 'add')) + '">',
      '<summary><span>+</span>' + escapeHtml(displayFieldLabel(field, field && field.label || '')) + '</summary>',
      renderStructureActionField(field),
      '</details>'
    ].join('');
  }

  function renderCompactStructureAction(field) {
    const action = String(field && field.structureAction || '');
    if (/^add_/.test(action)) {
      return renderInlineAddAction(field);
    }
    const id = fieldId(field);
    const original = field && field.original !== undefined ? String(field.original || '') : 'false';
    const rawLabel = String(field && field.label || '');
    const title = rawLabel ? ' title="' + escapeAttr(rawLabel) + '"' : '';
    const context = structureActionContext(field);
    return [
      '<label class="preview-object-structure-delete preview-object-action-' + escapeAttr(safeClass(action || 'remove')) + '"' + title + '>',
      id ? '<input type="checkbox" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '" data-object-canvas-original="' + escapeAttr(original) + '">' : '',
      '<span>' + escapeHtml(displayFieldLabel(field, rawLabel)) + '</span>',
      context ? '<small>' + escapeHtml(context) + '</small>' : '',
      '</label>'
    ].join('');
  }

  function firstStructureAction(body, action) {
    return ensureArray(body && body.structureActions).find((field) => String(field && field.structureAction || '') === action) || null;
  }

  function triggerStructureActions(body) {
    return ensureArray(body && body.structureActions).filter((field) => {
      const action = String(field && field.structureAction || '');
      if (action === 'add_trigger_effect') {
        return true;
      }
      return action === 'remove_effect' && !String(field && field.optionId || '').trim();
    });
  }

  function optionStructureActions(option, body) {
    return ensureArray(body && body.structureActions).filter((field) => {
      const action = String(field && field.structureAction || '');
      if (!['add_option_effect', 'remove_option', 'remove_option_condition', 'remove_effect'].includes(action)) {
        return false;
      }
      return structureActionMatchesOption(field, option);
    });
  }

  function branchStructureActions(field, body) {
    return ensureArray(body && body.structureActions).filter((actionField) => {
      const action = String(actionField && actionField.structureAction || '');
      if (action !== 'remove_layer') {
        return false;
      }
      const section = String(field && field.sectionId || field && field.id || '').trim();
      const actionSection = String(actionField && actionField.sectionId || '').trim();
      return Boolean(section && actionSection && section === actionSection);
    });
  }

  function optionEffectGroup(option, body) {
    return ensureArray(body && body.optionEffects).find((group) => structureActionMatchesOption(group, option)) || null;
  }

  function structureActionMatchesOption(field, option) {
    const optionIds = [
      option && option.id,
      option && option.optionId,
      option && option.targetId,
      option && option.sectionId,
      option && option.rawTargetId
    ].map((value) => String(value || '').trim()).filter(Boolean);
    const labels = [
      option && option.label,
      option && option.title
    ].map((value) => String(value || '').trim()).filter(Boolean);
    const actionIds = [
      field && field.id,
      field && field.optionId,
      field && field.sectionId
    ].map((value) => String(value || '').trim()).filter(Boolean);
    const target = String(field && (field.structureTargetLabel || field.label) || '').trim();
    return actionIds.some((id) => optionIds.includes(id)) ||
      Boolean(target && labels.some((label) => target === label || target.includes(label)));
  }

  function structureActionContext(field) {
    const action = String(field && field.structureAction || '');
    const target = String(field && (field.structureTargetLabel || field.optionId || field.sectionId) || '').trim();
    const before = String(field && field.structureBefore || '').trim().split(/\r?\n/).filter(Boolean)[0] || '';
    if (action === 'remove_effect' && before) {
      return before;
    }
    return target;
  }

  function renderAddOptionBuilder(field) {
    const draft = parseAddOptionDraft(fieldValue(field));
    return renderStructureBuilder(field, 'add_option', t('previewObjectEditor.structureAddOptionTitle', 'New player option'), [
      builderInput('option_label', t('previewObjectEditor.structureOptionText', 'Option text'), draft.label, t('previewObjectEditor.structureOptionTextPlaceholder', 'What the player clicks')),
      builderInput('target_id', t('previewObjectEditor.structureTargetId', 'Target section ID'), draft.target, 'new_option'),
      builderTextarea('result_text', t('previewObjectEditor.structureResultText', 'Result text'), draft.result, t('previewObjectEditor.structureResultTextPlaceholder', 'What happens after this choice'))
    ]);
  }

  function renderAddBranchBuilder(field) {
    const draft = parseBranchDraft(fieldValue(field));
    return renderStructureBuilder(field, 'add_branch', t('previewObjectEditor.structureAddBranchTitle', 'New branch or follow-up'), [
      builderInput('section_id', t('previewObjectEditor.structureSectionId', 'Section ID'), draft.section, 'follow_up'),
      builderInput('condition', t('previewObjectEditor.structureCondition', 'Condition'), draft.condition, 'Q.variable >= 1'),
      builderTextarea('branch_text', t('previewObjectEditor.structureBranchText', 'Branch text'), draft.text, t('previewObjectEditor.structureBranchTextPlaceholder', 'Conditional or follow-up prose'))
    ]);
  }

  function renderEffectBuilder(field, action) {
    const draft = parseEffectDraft(fieldValue(field));
    return renderStructureBuilder(field, action, action === 'add_option_effect'
      ? t('previewObjectEditor.structureChoiceEffectTitle', 'New choice effect')
      : t('previewObjectEditor.structureTriggerEffectTitle', 'New trigger effect'), [
      builderInput('variable', t('previewObjectEditor.structureVariable', 'Variable'), draft.variable, 'public_order'),
      builderSelect('operation', t('previewObjectEditor.structureOperation', 'Operation'), draft.op || '+=', ['=', '+=', '-=', '*=', '/=']),
      builderInput('value', t('previewObjectEditor.structureValue', 'Value'), draft.value, '1'),
      builderInput('condition', t('previewObjectEditor.structureConditionOptional', 'Condition (optional)'), draft.condition, 'Q.flag')
    ]);
  }

  function renderStructureBuilder(field, action, title, controls) {
    const value = fieldValue(field);
    const id = fieldId(field);
    const original = field && field.original !== undefined ? String(field.original || '') : value;
    return [
      '<article class="preview-object-structure-builder preview-object-action-' + escapeAttr(safeClass(action)) + '" data-preview-object-structure-builder="' + escapeAttr(action) + '">',
      '<header>',
      '<span>' + escapeHtml(t('previewObjectEditor.editorField', 'Editor field')) + '</span>',
      '<strong>' + escapeHtml(title) + '</strong>',
      '</header>',
      '<div class="preview-object-structure-form">',
      controls.join(''),
      '</div>',
      structureActionHelp(action) ? '<small class="preview-object-structure-help">' + escapeHtml(structureActionHelp(action)) + '</small>' : '',
      id ? '<input type="hidden" data-preview-object-structure-output="true" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '" data-object-canvas-original="' + escapeAttr(original) + '" value="' + escapeAttr(value) + '">' : '',
      '</article>'
    ].join('');
  }

  function structureActionHelp(action) {
    return {
      add_option: t('previewObjectEditor.structureHelpAddOption', 'Creates a manual-reviewed proposal for an option line and its result section.'),
      add_branch: t('previewObjectEditor.structureHelpAddBranch', 'Creates a manual-reviewed proposal for a conditional or follow-up section.'),
      add_trigger_effect: t('previewObjectEditor.structureHelpTriggerEffect', 'Creates a manual-reviewed Q effect that runs when this object opens.'),
      add_option_effect: t('previewObjectEditor.structureHelpChoiceEffect', 'Creates a manual-reviewed Q effect for this choice or result.')
    }[String(action || '')] || '';
  }

  function builderInput(part, label, value, placeholder) {
    return [
      '<label>',
      '<span>' + escapeHtml(label) + '</span>',
      '<input type="text" data-preview-object-structure-part="' + escapeAttr(part) + '" value="' + escapeAttr(value) + '"' + (placeholder ? ' placeholder="' + escapeAttr(placeholder) + '"' : '') + '>',
      '</label>'
    ].join('');
  }

  function builderTextarea(part, label, value, placeholder) {
    return [
      '<label class="is-wide">',
      '<span>' + escapeHtml(label) + '</span>',
      '<textarea rows="3" data-preview-object-structure-part="' + escapeAttr(part) + '"' + (placeholder ? ' placeholder="' + escapeAttr(placeholder) + '"' : '') + '>' + escapeHtml(value) + '</textarea>',
      '</label>'
    ].join('');
  }

  function builderSelect(part, label, value, options) {
    return [
      '<label>',
      '<span>' + escapeHtml(label) + '</span>',
      '<select data-preview-object-structure-part="' + escapeAttr(part) + '">',
      ensureArray(options).map((option) => '<option value="' + escapeAttr(option) + '"' + (String(option) === String(value) ? ' selected' : '') + '>' + escapeHtml(option) + '</option>').join(''),
      '</select>',
      '</label>'
    ].join('');
  }

  function parseAddOptionDraft(value) {
    const lines = String(value || '').split(/\r?\n/);
    const first = lines.find((line) => /^\s*-\s*@[^:]+:/.test(line)) || '';
    const match = first.match(/^\s*-\s*@([^:]+):\s*(.*)$/);
    const section = lines.find((line) => /^\s*#\s*\S+/.test(line)) || '';
    const target = match && match[1] || (section.match(/^\s*#\s*(\S+)/) || [])[1] || '';
    const label = match && match[2] || '';
    const result = lines.filter((line) => line !== first && line !== section).join('\n').trim();
    return {target, label, result};
  }

  function parseBranchDraft(value) {
    const text = String(value || '');
    const lines = text.split(/\r?\n/);
    const sectionLine = lines.find((line) => /^\s*#\s*\S+/.test(line)) || '';
    const section = (sectionLine.match(/^\s*#\s*(\S+)/) || [])[1] || '';
    const body = lines.filter((line) => line !== sectionLine).join('\n').trim();
    const conditional = body.match(/^\[\?\s*if\s+(.+?)\s*:\s*([\s\S]*?)\s*\?\]$/);
    return {
      section,
      condition: conditional ? conditional[1].trim() : '',
      text: conditional ? conditional[2].trim() : body
    };
  }

  function parseEffectDraft(value) {
    const text = String(value || '').trim().replace(/^Q\./, '');
    const parts = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|\/=|=)\s*(.*)$/);
    if (!parts) {
      return {variable: '', op: '+=', value: '', condition: ''};
    }
    const tail = splitEffectCondition(parts[3]);
    return {variable: parts[1], op: parts[2], value: tail.value, condition: tail.condition};
  }

  function splitEffectCondition(value) {
    const text = String(value || '').trim();
    const match = text.match(/^([\s\S]*?)\s+if\s+([\s\S]+)$/i);
    return match ? {value: match[1].trim(), condition: match[2].trim()} : {value: text, condition: ''};
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

  function renderEffectFields(fields) {
    return '<div class="preview-object-effect-fields">' + ensureArray(fields).map((field) => {
      if (field && field.structureAction) {
        return /^add_/.test(String(field.structureAction || ''))
          ? renderInlineAddAction(field)
          : renderCompactStructureAction(field);
      }
      return renderInlineField(field, {
        role: 'effect',
        element: logicFieldElement(field)
      });
    }).join('') + '</div>';
  }

  function logicFieldElement(field) {
    return field && field.inputType === 'checkbox'
      ? 'checkbox'
      : field && field.inputType === 'select' ? 'select' : field && field.inputType === 'textarea' ? 'textarea' : 'input';
  }

  function renderChoice(option, index, owner, eventBody) {
    const fields = ensureArray(option && option.fields);
    const label = firstField(fields, /(?:^|\.)(label|title)$/i) || fields[0] || fallbackField(owner + '.option.' + index + '.label', t('storyboard.option', 'Option') + ' ' + (index + 1), option && (option.label || option.id));
    const resultField = firstField(fields, /body|result|narrative/i);
    const subtitle = firstField(fields, /subtitle/i);
    const target = option && (option.targetId || option.gotoAfter || '');
    const choiceActions = optionStructureActions(option, eventBody);
    const effectGroup = optionEffectGroup(option, eventBody);
    const choiceDeleteActions = choiceActions.filter((field) => ['remove_option', 'remove_option_condition'].includes(String(field && field.structureAction || '')));
    const choiceEffectActions = choiceActions.filter((field) => ['add_option_effect', 'remove_effect'].includes(String(field && field.structureAction || '')));
    const routeNotes = [
      option && option.sectionLabel ? t('previewObjectEditor.section', 'Section') + ': ' + option.sectionLabel : '',
      option && option.chooseIf ? t('previewObjectEditor.chooseIf', 'Choose if') + ': ' + option.chooseIf : '',
      option && option.sectionViewIf ? t('previewObjectEditor.viewIf', 'View if') + ': ' + option.sectionViewIf : '',
      option && option.sectionChooseIf ? t('previewObjectEditor.chooseIf', 'Choose if') + ': ' + option.sectionChooseIf : ''
    ].filter(Boolean);
    const rest = fields.filter((field) => field !== label && field !== resultField && field !== subtitle);
    return [
      '<article class="preview-object-choice" data-preview-object-choice="' + escapeAttr(option && option.id || String(index + 1)) + '">',
      '<div class="preview-object-choice-main">',
      '<b>' + escapeHtml(String(index + 1)) + '</b>',
      renderInlineField(label, {
        role: 'choice-label',
        element: 'input',
        fallbackLabel: t('storyboard.option', 'Option') + ' ' + (index + 1)
      }),
      target ? '<small>' + escapeHtml(t('objectCanvas.optionTarget', 'Target') + ': ' + target) + '</small>' : '',
      routeNotes.length ? '<small>' + escapeHtml(routeNotes.join(' / ')) + '</small>' : '',
      '</div>',
      choiceDeleteActions.length ? '<div class="preview-object-entry-actions">' + choiceDeleteActions.map(renderCompactStructureAction).join('') + '</div>' : '',
      subtitle ? renderInlineField(subtitle, {
        role: 'choice-subtitle',
        element: 'input'
      }) : '',
      resultField ? renderInlineField(resultField, {
        role: 'choice-body',
        element: 'textarea'
      }) : '',
      effectGroup || choiceEffectActions.length
        ? '<section class="preview-object-choice-effects"><h5>' + escapeHtml(t('previewObjectEditor.choiceEffects', 'Choice effects')) + '</h5>' + renderEffectFields(ensureArray(effectGroup && effectGroup.fields).concat(choiceEffectActions)) + '</section>'
        : '',
      rest.length ? '<details class="preview-object-choice-details"><summary>' + escapeHtml(t('objectCanvas.advancedFields', 'Timing and advanced fields')) + '</summary>' + rest.map((field) => renderInlineField(field, {
        role: 'choice-detail',
        element: field && field.id && /body|text/i.test(field.id) ? 'textarea' : 'input'
      })).join('') + '</details>' : '',
      '</article>'
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
      '</footer>'
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
      '</span>'
    ].join('');
  }

  function displayFieldLabel(field, fallbackLabel) {
    const label = String(fallbackLabel || field && field.label || field && field.id || '').trim();
    const role = String(field && (field.semanticRole || field.branchKind || field.role) || '').toLowerCase();
    const action = String(field && field.structureAction || '').toLowerCase();
    if (action === 'add_option') {
      return t('previewObjectEditor.structureAddOptionTitle', 'New player option');
    }
    if (action === 'add_branch') {
      return t('previewObjectEditor.structureAddBranchTitle', 'New branch or follow-up');
    }
    if (action === 'add_trigger_effect') {
      return t('previewObjectEditor.structureTriggerEffectTitle', 'New trigger effect');
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
    return '<textarea rows="' + rowsFor(opts.value || opts.placeholder, opts.role) + '" class="' + escapeAttr(opts.controlClass) + '"' + opts.data + placeholder + (opts.readOnly ? ' readonly' : '') + '>' + escapeHtml(opts.value) + '</textarea>';
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
    const optionLabels = ensureArray(field.relatedOptionLabels).map(String).filter(Boolean);
    if (optionLabels.length) {
      parts.push(t('previewObjectEditor.afterChoice', 'After choice') + ': ' + optionLabels.join(' / '));
    }
    const conditions = ensureArray(field.conditions).map(String).filter(Boolean);
    if (conditions.length) {
      parts.push(t('previewObjectEditor.when', 'When') + ': ' + conditions.join(' / '));
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
    const conditions = ensureArray(field.conditionVariables).map(String).filter(Boolean);
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
      return renderer.renderBlocks(value, options || {});
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
      safe: t('editing.summary.safe', 'safe'),
      manual: t('editing.summary.manual', 'manual'),
      read_only: t('previewObjectEditor.readonly', 'Read only')
    }[String(status || '')] || String(status || '');
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
