(function initProjectMapExploreInspector(root) {
  'use strict';

  const domTextUtils = (function () {
    if (root && root.ProjectMapDomText) {
      return root.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const escapeHtml = domTextUtils.escapeHtml;
  const escapeAttr = domTextUtils.escapeAttr;

  function ProjectMapExploreInspector(ctx) {
    ctx = ctx || {};
    const global = ctx.global || root;
    const {
      VIEW_DEFS,
      VIRTUAL_LIST_THRESHOLD,
      VIRTUAL_LIST_ROW_HEIGHT,
      VIRTUAL_ASSET_ROW_HEIGHT,
      VIRTUAL_ASSET_CARD_MIN_WIDTH,
      VIRTUAL_LIST_OVERSCAN,
      t,
      currentLocale,
      applyI18n,
      studioContracts,
      assetModelApi,
      viewLabel,
      ensureArray,
      coverageRows,
      coverageField,
      coverageWorkflowSteps,
      coverageCountBadge,
      diagnosticBreakdown,
      countBy,
      listForView,
      filterAndSortItems,
      normalizeAssetForViewer,
      normalizedRowsForView,
      sortedRowsForView,
      virtualWindowForList,
      sourceLabel,
      sourceLine,
      firstSource,
      graphRowsForScene,
      sceneIdForEndpoint,
      textCorpusContextRows,
      textRevisionKey,
      textRevisionReplacementFor,
      buildTextRevisionModel,
      textCorpusRoleLabel,
      textCorpusRoleGuidance,
      textCorpusEditabilityLabel,
      editCapabilityForModel,
      editCapabilityRouteLabel,
      editCapabilityActionLabel,
      editCapabilitySummary,
      capabilityBadgeClass,
      setStatus,
      showError
    } = ctx;

  function capabilityLabel(routeClass) {
    return editCapabilityRouteLabel ? editCapabilityRouteLabel(routeClass) : String(routeClass || '').replace(/_/g, ' ');
  }

  function capabilityAction(routeClass) {
    return editCapabilityActionLabel ? editCapabilityActionLabel(routeClass) : t('textRevision.actionButton', 'Edit Text Proposal');
  }

  function capabilityClass(capability) {
    return capabilityBadgeClass ? capabilityBadgeClass(capability) : '';
  }

  function capabilityReason(capability) {
    return editCapabilitySummary ? editCapabilitySummary(capability) : capability && capability.reason || '';
  }

  function renderInspector(state, elements) {
    if (!state.model) {
      elements.inspector.innerHTML = '<div class="empty-state">' + escapeHtml(t('explore.inspectorNoIndex', 'Load a project index to inspect it.')) + '</div>';
      return;
    }
    if (!state.selected) {
      elements.inspector.innerHTML = '<div class="empty-state">' + escapeHtml(t('explore.inspectorEmpty', 'Select an item to inspect source spans, confidence, edges, and variable usage.')) + '</div>';
      return;
    }
    const selected = state.selected;
    const preview = renderInspectorPreview(selected, state);
    const visibleEdit = renderVisibleEditActionPanel(selected, state);
    if (selected.view === 'variables') {
      elements.inspector.innerHTML = renderVariableInspector(selected.item);
    } else if (selected.view === 'coverage') {
      elements.inspector.innerHTML = renderCoverageInspector(selected.item);
    } else if (selected.view === 'diagnostics') {
      elements.inspector.innerHTML = renderDiagnosticInspector(selected.item, state.model);
    } else if (selected.view === 'news') {
      const workbench = selected.item && selected.item.delivery === 'legacy_event_popup'
        ? renderEventWorkbenchInspector(selected.item, state.model)
        : '';
      elements.inspector.innerHTML = workbench
        ? workbench
        : renderNewsInspector(selected.item) + preview + visibleEdit + renderEditDraftAction(selected, state) + renderTextProposalAction(selected, state);
    } else if (selected.view === 'surfaceText') {
      elements.inspector.innerHTML = renderSurfaceTextInspector(selected.item) + preview + visibleEdit + (global.ProjectMapQdisplayCreatePanel ? global.ProjectMapQdisplayCreatePanel.renderCreatePanel(selected.item) : '') + renderEditDraftAction(selected, state) + renderTextProposalAction(selected, state);
    } else if (selected.view === 'textCorpus') {
      elements.inspector.innerHTML = renderTextCorpusInspector(selected.item, state.model, state, visibleEdit);
    } else if (selected.view === 'assets') {
      elements.inspector.innerHTML = renderAssetInspector(selected.item, state.model);
    } else if (selected.view === 'source') {
      elements.inspector.innerHTML = renderSourceInspector(selected.item);
    } else if (selected.view === 'overview') {
      elements.inspector.innerHTML = renderOverviewInspector(selected.item, state.model);
    } else {
      const scene = sceneFromSelection(selected.item, state.model);
      const workbench = renderEventWorkbenchInspector(scene || selected.item, state.model);
      elements.inspector.innerHTML = workbench
        ? workbench
        : renderSceneInspector(scene || selected.item, state.model) + preview + visibleEdit + renderEditDraftAction(selected, state) + renderTextProposalAction(selected, state);
    }
  }

  function renderVisibleEditActionPanel(selected, state) {
    if (!selected || !state || !state.model || !selected.item || selected.view === 'coverage' || selected.view === 'diagnostics') {
      return '';
    }
    const ui = global.ProjectMapVisibleEditActionUi;
    if (!ui || typeof ui.actionForItem !== 'function' || typeof ui.renderButton !== 'function') {
      return '';
    }
    const action = ui.actionForItem(state.model.index, selected.view, selected.item, visibleHintsForSelection(selected));
    if (!action) {
      return '';
    }
    return [
      '<div class="inspector-actions visible-edit-action-panel" data-visible-edit-affordance="explore-inspector">',
      ui.renderButton(action, {label: t('visibleEdit.action', 'Edit'), translate: t, escapeHtml, escapeAttr}),
      '<div class="draft-action-status">' + escapeHtml(t('visibleEdit.panelHelp', 'Open the editor for this visible content, then send the generated operation to Review & Apply.')) + '</div>',
      '</div>'
    ].join('');
  }

  function visibleHintsForSelection(selected) {
    const item = selected && selected.item || {};
    const view = selected && selected.view || '';
    const role = String(item.role || (view === 'variables' ? 'variable_definition' : ''));
    return {
      area: view === 'variables' ? 'variables' : 'story',
      objectType: view === 'variables' ? 'variable' : (view === 'textCorpus' ? '' : view),
      role,
      label: String(item.title || item.headline || item.text || item.label || item.id || item.name || ''),
      safeEligible: true,
      previewEligible: true
    };
  }

  function renderInspectorPreview(selected, state) {
    const preview = previewModelForSelection(selected, state);
    if (!preview) {
      return '';
    }
    const meaningUi = global.ProjectMapMeaningLayerUi;
    const apiCore = global.ProjectMapPreviewModel;
    const fallbackText = apiCore && typeof apiCore.renderPreviewText === 'function'
      ? apiCore.renderPreviewText(preview)
      : preview.title || '';
    const previewHtml = meaningUi && typeof meaningUi.renderPreviewHtml === 'function'
      ? meaningUi.renderPreviewHtml(preview, {}, fallbackText)
      : '<pre class="player-preview inspector-preview-text">' + escapeHtml(fallbackText) + '</pre>';
    return [
      '<div class="detail-section inspector-preview" data-inspector-preview="true">',
      '<h3 class="section-title">' + escapeHtml(t('preview.title', 'Preview')) + '</h3>',
      previewHtml,
      '</div>'
    ].join('');
  }

  function previewModelForSelection(selected, state) {
    const apiCore = global.ProjectMapPreviewModel;
    if (!apiCore || typeof apiCore.buildPreviewModel !== 'function' || !selected || !state.model) {
      return null;
    }
    try {
      if (selected.view === 'news' && selected.item && selected.item.delivery === 'legacy_event_popup') {
        return apiCore.buildPreviewModel(selected.item, {sourceKind: 'news', projectIndex: state.model.index});
      }
      if (selected.view === 'surfaceText') {
        const textResult = previewTextReplacement(state.model.index, selected.view, selected.item);
        return apiCore.buildPreviewModel(textResult.ok ? textResult : selected.item, {
          sourceKind: 'surface_text',
          projectIndex: state.model.index
        });
      }
      if (canEditAsDraft(selected.view)) {
        const draftResult = previewDraftExtraction(state.model.index, selected.view, selected.item);
        if (draftResult && draftResult.ok) {
          return apiCore.buildPreviewModel(draftResult, {projectIndex: state.model.index});
        }
      }
      if (selected.view === 'news') {
        return apiCore.buildPreviewModel(selected.item, {sourceKind: 'news', projectIndex: state.model.index});
      }
    } catch (err) {
      return apiCore.buildPreviewModel({
        status: 'unsupported',
        diagnostics: [{severity: 'warning', code: 'preview.failed', message: err && err.message ? err.message : String(err)}]
      }, {sourceKind: selected.view || 'unknown', projectIndex: state.model.index});
    }
    return null;
  }

  function renderEditDraftAction(selected, state) {
    if (!selected || !state.model || !canEditAsDraft(selected.view)) {
      return '';
    }
    const result = previewDraftExtraction(state.model.index, selected.view, selected.item);
    const disabled = !result.ok || result.status === 'unsupported';
    const existingSupported = canEditExisting(selected.view) && existingEditSupported(state.model.index, selected.view, selected.item);
    const status = state.draftActionMessage || draftActionSummary(result);
    const diagnostics = ensureArray(result.diagnostics).slice(0, 4).map((diag) => {
      return badge(diag.severity || 'warning', diag.severity || 'warning') + ' ' +
        escapeHtml(diag.code || '') + '<br>' + escapeHtml(diag.message || '');
    });
    return [
      '<div class="inspector-actions" data-edit-draft-panel="true">',
      canEditExisting(selected.view)
        ? '<button class="draft-action-button" type="button" data-edit-existing="true"' +
          (existingSupported ? '' : ' disabled') + '>' + escapeHtml(t('existingScene.editExisting', 'Edit existing')) + '</button>'
        : '',
      '<button class="draft-action-button" type="button" data-edit-as-draft="true"' +
        (disabled ? ' disabled' : '') + '>' + escapeHtml(t('existingScene.copyAsNew', 'Copy as new draft')) + '</button>',
      '<div class="draft-action-status" data-text-action-status="true">' + escapeHtml(status) + '</div>',
      renderExtractionScope(result),
      diagnostics.length ? renderMiniSection('Draft notes', diagnostics) : '',
      '</div>'
    ].join('');
  }

  function canEditAsDraft(view) {
    return view === 'events' || view === 'cards' || view === 'news' || view === 'surfaceText';
  }

  function canEditExisting(view) {
    return view === 'events' || view === 'cards' || view === 'news';
  }

  function existingEditSupported(index, view, item) {
    if (view === 'news' && (!item || item.delivery !== 'legacy_event_popup' || !item.linkedSceneId)) {
      return false;
    }
    const editor = global.ProjectMapExistingSceneEdit;
    if (!editor || typeof editor.buildEditModel !== 'function') {
      return false;
    }
    try {
      const model = editor.buildEditModel(index, view, item, {});
      return Boolean(model && model.ok && model.source && model.source.path && (
        ensureArray(model.fields).length ||
        ensureArray(model.textBlocks).length ||
        ensureArray(model.options).length
      ));
    } catch (err) {
      return false;
    }
  }

  function renderTextProposalAction(selected, state) {
    if (!selected || !state.model || !canEditTextProposal(selected.view)) {
      return '';
    }
    const result = previewTextReplacement(state.model.index, selected.view, selected.item);
    const disabled = !result.ok && result.status === 'unsupported';
    const status = state.textActionMessage || textProposalSummary(result);
    const diagnostics = ensureArray(result.diagnostics).slice(0, 3).map((diag) => {
      return badge(diag.severity || 'warning', diag.severity || 'warning') + ' ' +
        escapeHtml(diag.code || '') + '<br>' + escapeHtml(diag.message || '');
    });
    return [
      '<div class="inspector-actions" data-edit-text-panel="true">',
      '<button class="draft-action-button" type="button" data-edit-text-proposal="true"' +
        (disabled ? ' disabled' : '') + '>' + escapeHtml(t('textProposal.actionButton', 'Edit Text Proposal')) + '</button>',
      '<div class="draft-action-status" data-text-action-status="true">' + escapeHtml(status) + '</div>',
      renderExtractionScope(result),
      diagnostics.length ? renderMiniSection(t('textProposal.notesTitle', 'Text proposal notes'), diagnostics) : '',
      '</div>'
    ].join('');
  }

  function renderExtractionScope(result) {
    if (!result) {
      return '';
    }
    const captured = ensureArray(result.captured).filter(Boolean);
    const notCaptured = ensureArray(result.notCaptured).filter(Boolean);
    if (!captured.length && !notCaptured.length) {
      return '';
    }
    return [
      '<div class="extraction-scope">',
      captured.length ? renderMiniSection(t('textProposal.capturedTitle', 'Captured by Studio'), captured.map((item) => escapeHtml(item))) : '',
      notCaptured.length ? renderMiniSection(t('textProposal.notCapturedTitle', 'Not captured yet'), notCaptured.map((item) => escapeHtml(item))) : '',
      '</div>'
    ].join('');
  }

  function canEditTextProposal(view) {
    return view === 'scenes' || view === 'events' || view === 'cards' || view === 'news' || view === 'surfaceText' || view === 'textCorpus';
  }

  function previewDraftExtraction(index, view, item) {
    const bridge = global.ProjectMapDraftExtract;
    if (!bridge || typeof bridge.extractDraftFromItem !== 'function') {
      return {
        ok: false,
        status: 'unsupported',
        diagnostics: [{
          severity: 'warning',
          code: 'draft_extract.unavailable',
          message: 'Draft extraction helper is not loaded.'
        }]
      };
    }
    try {
      return bridge.extractDraftFromItem(index, view, item, {});
    } catch (err) {
      return {
        ok: false,
        status: 'unsupported',
        diagnostics: [{
          severity: 'warning',
          code: 'draft_extract.failed',
          message: err && err.message ? err.message : String(err)
        }]
      };
    }
  }

  function previewTextReplacement(index, view, item, options) {
    const bridge = global.ProjectMapDraftExtract;
    if (!bridge || typeof bridge.textReplacementDraftFromItem !== 'function') {
      return {
        ok: false,
        status: 'unsupported',
        diagnostics: [{
          severity: 'warning',
          code: 'draft_extract.text_unavailable',
          message: 'Text replacement helper is not loaded.'
        }]
      };
    }
    try {
      return bridge.textReplacementDraftFromItem(index, view, item, options || {});
    } catch (err) {
      return {
        ok: false,
        status: 'unsupported',
        diagnostics: [{
          severity: 'warning',
          code: 'draft_extract.text_failed',
          message: err && err.message ? err.message : String(err)
        }]
      };
    }
  }

  function draftActionSummary(result) {
    if (!result || result.status === 'unsupported') {
      return t('draftAction.summary.unsupported', 'This row cannot be converted into a Studio draft yet.');
    }
    if (result.status === 'ide_escape_hatch') {
      return t('draftAction.summary.ide', 'Creates a source-mapping draft; Studio needs an owner or anchor before Review & Apply can build an executable patch.');
    }
    if (result.status === 'partial') {
      return t('draftAction.summary.partial', 'Captures the parsed structure as a draft preview; unsupported parts block Review & Apply.');
    }
    return t('draftAction.summary.ok', 'Creates a draft in Create mode so you can preview the install plan.');
  }

  function textProposalSummary(result) {
    if (!result || result.status === 'unsupported') {
      return t('textProposal.summary.unsupported', 'This row cannot seed a text proposal yet.');
    }
    if (!result.ok) {
      return t('textProposal.summary.sourceNeeded', 'This row needs more source evidence before Studio can seed a text proposal.');
    }
    if (result.status === 'ide_escape_hatch') {
      return t('textProposal.summary.manual', 'Creates a text replacement proposal with source review guidance; no executable source edit is created until Studio has a bounded owner.');
    }
    return t('textProposal.summary.guarded', 'Creates a guarded text replacement proposal in Edit Text mode.');
  }

  function handleEditAsDraft(state, elements) {
    if (!state.selected || !state.model || !canEditAsDraft(state.selected.view)) {
      return;
    }
    const result = previewDraftExtraction(state.model.index, state.selected.view, state.selected.item);
    if (!result.ok && result.status === 'unsupported') {
      state.draftActionMessage = draftActionSummary(result);
      ctx.render(state, elements);
      return;
    }
    const opened = openDraftInCreate(result.template, result.draft, result);
    state.draftActionMessage = opened
      ? t('draftAction.status.loaded', 'Draft loaded in Create mode as {template}. Review & Apply can preview supported operations.').replace('{template}', result.template || 'draft')
      : t('draftAction.status.openFailed', 'Could not open Create template for this draft.');
    state.textActionMessage = '';
    ctx.render(state, elements);
  }

  function handleEditExisting(state, elements) {
    if (!state.selected || !state.model || !canEditExisting(state.selected.view)) {
      return;
    }
    const editor = global.ProjectMapObjectAuthoringCanvas;
    if (!editor || typeof editor.openFromSelection !== 'function') {
      showError(elements, t('existingScene.unavailable', 'Existing Scene Editor is not loaded.'));
      return;
    }
    const opened = editor.openFromSelection(state.model.index, state.selected.view, state.selected.item, {
      entry: {source: 'explore', actionKind: 'edit_existing'},
      editorOverlay: true
    });
    state.draftActionMessage = opened
      ? t('existingScene.loaded', 'Existing scene edit opened in Create. Save it to My Changes when ready.')
      : t('existingScene.openFailed', 'This scene needs more source evidence before Studio can edit it here.');
    state.textActionMessage = '';
    ctx.render(state, elements);
  }

  function handleEditTextProposal(state, elements) {
    if (!state.selected || !state.model || !canEditTextProposal(state.selected.view)) {
      return;
    }
    const replacementText = currentTextReplacementValue(elements);
    if (state.selected.view === 'textCorpus' && replacementText === String(state.selected.item && state.selected.item.text || '')) {
      state.textActionMessage = t('textProposal.status.needsChange', 'Change the replacement text to create a proposal.');
      ctx.render(state, elements);
      return;
    }
    const result = previewTextReplacement(state.model.index, state.selected.view, state.selected.item, {
      replacementText,
    });
    if (!result.ok) {
      state.textActionMessage = textProposalSummary(result);
      ctx.render(state, elements);
      return;
    }
    const opened = openDraftInCreate(result.template, result.draft, result);
    state.textActionMessage = opened
      ? t('textProposal.status.loaded', 'Text proposal loaded in Edit Text mode. Nothing is installed automatically.')
      : t('textProposal.status.openFailed', 'Could not open Edit Text proposal template.');
    state.draftActionMessage = '';
    ctx.render(state, elements);
  }

  function handleEditRouteAction(state, elements) {
    if (!state.selected || !state.model || state.selected.view !== 'textCorpus') {
      return;
    }
    const item = state.selected.item || {};
    const replacementText = currentTextReplacementValue(elements);
    const changed = replacementText !== String(item.text || '');
    const capability = editCapabilityForModel
      ? editCapabilityForModel(state.model, 'textCorpus', item, changed ? {replacementText} : null)
      : null;
    const routeClass = String(capability && capability.routeClass || '');
    if (routeClass === 'direct_field_replace' || routeClass === 'direct_section_replace' || routeClass === 'object_workspace') {
      const opened = openRoutedObjectWorkspace(state, capability, changed ? replacementText : '');
      state.textActionMessage = opened
        ? t('editCapability.status.objectLoaded', 'Owning object workspace opened. Save the change to My Changes when ready.')
        : t('existingScene.openFailed', 'This scene needs more source evidence before Studio can edit it here.');
      state.draftActionMessage = '';
      ctx.render(state, elements);
      return;
    }
    if (routeClass === 'system_ui_workspace') {
      const opened = openRoutedSystemUiWorkspace(capability, changed ? replacementText : '');
      state.textActionMessage = opened
        ? t('editCapability.status.systemUiLoaded', 'System UI workspace opened for this text route.')
        : t('editCapability.status.systemUiOpenFailed', 'Could not open the System UI workspace.');
      state.draftActionMessage = '';
      ctx.render(state, elements);
      return;
    }
    handleEditTextProposal(state, elements);
  }

  function openRoutedObjectWorkspace(state, capability, replacementText) {
    const target = capability && capability.target || {};
    const sceneId = target.sceneId || target.itemId || '';
    const view = target.view === 'cards' ? 'cards' : 'events';
    const values = {};
    if (replacementText && target.valueKey) {
      values[target.valueKey] = replacementText;
    }
    const editor = global.ProjectMapObjectAuthoringCanvas;
    if (!editor || typeof editor.openFromSelection !== 'function' || !sceneId) {
      return false;
    }
    return editor.openFromSelection(state.model.index, view, sceneId, {
      values,
      route: capability,
      source: 'Text Corpus edit route'
    });
  }

  function openRoutedSystemUiWorkspace(capability, replacementText) {
    const target = capability && capability.target || {};
    const template = target.internalTemplate || target.template || 'entry';
    const focusFieldId = target.focusFieldId || '';
    const values = {};
    if (focusFieldId && replacementText) {
      values[focusFieldId] = replacementText;
    }
    activateMode('create');
    activateCreateTemplate(template);
    const canvas = global.ProjectMapObjectAuthoringCanvas;
    if (canvas && typeof canvas.openTemplate === 'function') {
      return canvas.openTemplate(template, null, {
        source: 'Text Corpus System UI route',
        route: capability,
        selectedRegion: target.selectedRegion || '',
        selectedCanvasNode: target.selectedRegion || '',
        focusFieldId,
        replacementText: replacementText || '',
        values,
        manualReason: target.manualReason || ''
      });
    }
    return Boolean(global.document && global.document.querySelector('[data-create-template="' + template + '"].is-active'));
  }

  function handleEditVariable(state, elements) {
    if (!state.selected || !state.model || state.selected.view !== 'variables') {
      return;
    }
    const core = global.ProjectMapVariableEditorDraft;
    const draft = core && typeof core.draftFromVariable === 'function'
      ? core.draftFromVariable(state.selected.item, state.model.index)
      : {
        schemaVersion: '0.1',
        kind: 'variable_editor',
        id: 'edit_' + String(state.selected.item && state.selected.item.name || 'variable').replace(/[^A-Za-z0-9_]+/g, '_'),
        title: 'Edit ' + String(state.selected.item && state.selected.item.name || 'Variable'),
        mode: 'edit_existing',
        variableName: String(state.selected.item && state.selected.item.name || ''),
        includeRootInit: false,
        includePostEventInit: false,
        includeQualityFile: false
      };
    const opened = openDraftInCreate('variables', draft, {template: 'variables'});
    state.draftActionMessage = opened
      ? t('variableEditor.loadedFromExplore', 'Variable loaded in Create mode. Review source evidence before applying.')
      : t('variableEditor.openFailed', 'Could not open the Variable Editor.');
    state.textActionMessage = '';
    ctx.render(state, elements);
  }

  function handleEventWorkbenchAction(state, elements, action) {
    if (!state.selected || !state.model) {
      return;
    }
    const core = global.ProjectMapEventWorkbench;
    if (!core || typeof core.buildActionDraft !== 'function') {
      showError(elements, t('eventWorkbench.actionHelperMissing', 'Event Workbench action helper is not loaded.'));
      return;
    }
    const sceneOrItem = eventWorkbenchSeedForSelection(state.selected, state.model);
    const result = core.buildActionDraft(state.model.index, sceneOrItem, action, {locale: currentLocale()});
    if (!result || !result.ok || !result.draft) {
      const message = result && result.diagnostics && result.diagnostics[0]
        ? result.diagnostics[0].message
        : t('eventWorkbench.actionDraftFailed', 'Could not create a draft from this event action.');
      showError(elements, message);
      return;
    }
    const opened = openDraftInCreate(result.template, result.draft, result);
    if (opened) {
      setStatus(elements, eventWorkbenchActionStatus(action, result.template));
      state.draftActionMessage = '';
      state.textActionMessage = '';
    } else {
      showError(elements, t('eventWorkbench.openCreateFailed', 'Could not open the Create template for this Event Workbench action.'));
    }
  }

  function eventWorkbenchSeedForSelection(selected, model) {
    if (!selected) {
      return null;
    }
    if (selected.view === 'news' && selected.item && selected.item.delivery === 'legacy_event_popup') {
      return selected.item;
    }
    return sceneFromSelection(selected.item, model) || selected.item;
  }

  function eventWorkbenchActionStatus(action, template) {
    if (action === 'edit_text') {
      return t('eventWorkbench.status.text', 'Text proposal loaded in Create. Nothing is installed automatically.');
    }
    if (action === 'copy_alt_timeline') {
      return t('eventWorkbench.status.alternate', 'Alternate timeline event draft loaded in Create. Review before export.');
    }
    if (action === 'follow_up') {
      return t('eventWorkbench.status.followup', 'Follow-up event draft loaded in Create. Review before export.');
    }
    return t('eventWorkbench.status.generic', 'Draft loaded in Create as {template}.').replace('{template}', template || 'draft');
  }

  function currentTextReplacementValue(elements) {
    const input = elements && elements.inspector
      ? elements.inspector.querySelector('[data-text-revision-input]')
      : null;
    return input ? input.value : '';
  }

  function openDraftInCreate(template, draft, result) {
    const templateKey = template || '';
    activateMode('create');
    activateCreateTemplate(templateKey);
    const meta = {source: 'Explore Edit as Draft', extraction: result};
    if (global.ProjectMapObjectAuthoringCanvas && typeof global.ProjectMapObjectAuthoringCanvas.loadDraft === 'function') {
      global.ProjectMapObjectAuthoringCanvas.loadDraft(draft, meta);
      return true;
    }
    if (templateKey === 'event' && global.ProjectMapWizard && typeof global.ProjectMapWizard.loadDraft === 'function') {
      global.ProjectMapWizard.loadDraft(draft, meta);
      return true;
    }
    if (templateKey === 'news' && global.ProjectMapNewsWizard && typeof global.ProjectMapNewsWizard.loadDraft === 'function') {
      global.ProjectMapNewsWizard.loadDraft(draft, meta);
      return true;
    }
    if (templateKey === 'card' && global.ProjectMapCardWizard && typeof global.ProjectMapCardWizard.loadDraft === 'function') {
      global.ProjectMapCardWizard.loadDraft(draft, meta);
      return true;
    }
    if (templateKey === 'surface' && global.ProjectMapSurfaceTextWizard && typeof global.ProjectMapSurfaceTextWizard.loadDraft === 'function') {
      global.ProjectMapSurfaceTextWizard.loadDraft(draft, meta);
      return true;
    }
    if (templateKey === 'entry' && global.ProjectMapEntrySidebarWizard && typeof global.ProjectMapEntrySidebarWizard.loadDraft === 'function') {
      global.ProjectMapEntrySidebarWizard.loadDraft(draft, meta);
      return true;
    }
    if (templateKey === 'project' && global.ProjectMapProjectMetadataWizard && typeof global.ProjectMapProjectMetadataWizard.loadDraft === 'function') {
      global.ProjectMapProjectMetadataWizard.loadDraft(draft, meta);
      return true;
    }
    if (templateKey === 'variables' && global.ProjectMapVariableEditorWizard && typeof global.ProjectMapVariableEditorWizard.loadDraft === 'function') {
      global.ProjectMapVariableEditorWizard.loadDraft(draft, meta);
      return true;
    }
    return false;
  }

  function activateMode(mode) {
    const button = global.document && global.document.querySelector('[data-mode="' + mode + '"]');
    if (button && typeof button.click === 'function') {
      button.click();
    }
  }

  function openDesignSelectionInExplore(detail, state, elements) {
    if (!state.model) {
      return;
    }
    const view = VIEW_DEFS[detail.view] ? detail.view : 'scenes';
    activateMode('explore');
    state.view = view;
    state.query = '';
    state.sortField = VIEW_DEFS[view].defaultSort;
    state.sortDir = view === 'overview' ? 'desc' : 'asc';
    state.draftActionMessage = '';
    state.textActionMessage = '';
    elements.search.value = '';
    const items = filterAndSortItems(state.model, view, '', state.sortField, state.sortDir);
    const found = items.find((row) => designRowMatches(row.raw, detail.item));
    if (found) {
      state.selectedKey = found.key;
      state.selected = {view, item: found.raw, normalized: found};
      setStatus(elements, t('design.openedInExplore', 'Opened {view} from Design.').replace('{view}', viewLabel(view)));
    } else {
      state.selectedKey = null;
      state.selected = null;
      showError(elements, t('design.openExploreFailed', 'Could not find a matching Explore row for the selected Design item.'));
    }
    ctx.render(state, elements);
  }

  function designRowMatches(row, item) {
    if (!row || !item) {
      return false;
    }
    if (row === item) {
      return true;
    }
    if (row.id && item.id && String(row.id) === String(item.id)) {
      return true;
    }
    if (row.id && item.sceneId && String(row.id) === String(item.sceneId)) {
      return true;
    }
    if (row.source && item.source && sourceLabel(row.source) === sourceLabel(item.source)) {
      return true;
    }
    if (row.headline && item.headline && row.headline === item.headline) {
      return true;
    }
    return false;
  }

  function activateCreateTemplate(template) {
    const button = global.document && global.document.querySelector('[data-create-template="' + template + '"]');
    if (button && typeof button.click === 'function') {
      button.click();
    }
  }

  function sceneFromSelection(item, model) {
    if (!item) {
      return null;
    }
    if (item.scene) {
      return item.scene;
    }
    if (item.id && model.scenesById.has(String(item.id))) {
      return model.scenesById.get(String(item.id));
    }
    return null;
  }

  function renderSourceButton(source) {
    if (!source) {
      return '';
    }
    return '<button class="source-button" type="button" data-source-json="' +
      escapeAttr(JSON.stringify(source)) + '">' + escapeHtml(sourceLabel(source)) + '</button>';
  }

  function renderSceneInspector(scene, model) {
    if (!scene) {
      return '<div class="empty-state">Scene not found.</div>';
    }
    const graph = graphRowsForScene(model, scene.id);
    const outgoing = graph.outgoing.slice(0, 24);
    const incoming = graph.incoming.slice(0, 24);
    const diagnostics = ensureArray(model.diagnosticsByScene.get(String(scene.id))).slice(0, 12);
    const confidence = scene.classificationConfidence || scene.confidence || 'profile_heuristic';
    return [
      '<h2 class="inspector-title">' + escapeHtml(scene.id || '(missing id)') + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(scene.title || scene.path || '') + '</div>',
      '<div class="badge-line">',
      badge(scene.type || 'scene', ''),
      badge(confidence, confidence),
      ensureArray(scene.tags).map((tag) => badge(tag, '')).join(''),
      '</div>',
      '<dl class="kv">',
      '<dt>' + escapeHtml(t('inspector.path', 'Path')) + '</dt><dd>' + escapeHtml(scene.path || '') + '</dd>',
      '<dt>' + escapeHtml(t('inspector.source', 'Source')) + '</dt><dd>' + renderSourceButton(scene.sourceSpan) + '</dd>',
      '<dt>' + escapeHtml(t('inspector.sections', 'Sections')) + '</dt><dd>' + escapeHtml(ensureArray(scene.sections).length) + '</dd>',
      '<dt>' + escapeHtml(t('inspector.options', 'Options')) + '</dt><dd>' + escapeHtml(ensureArray(scene.options).length) + '</dd>',
      '</dl>',
      renderEdgeSection(t('inspector.outgoing', 'Outgoing'), outgoing),
      renderEdgeSection(t('inspector.incoming', 'Incoming'), incoming),
      renderMiniSection(t('inspector.diagnostics', 'Diagnostics'), diagnostics.map(renderDiagnosticMini))
    ].join('');
  }

  function renderEventWorkbenchInspector(sceneOrItem, model) {
    if (!model || !sceneOrItem || !isEventWorkbenchCandidate(sceneOrItem)) {
      return '';
    }
    const core = global.ProjectMapEventWorkbench;
    const ui = global.ProjectMapEventWorkbenchUi;
    if (!core || !ui || typeof core.buildEventWorkbench !== 'function' || typeof ui.renderEventWorkbench !== 'function') {
      return '';
    }
    const index = model.index || {};
    const workbench = core.buildEventWorkbench(index, sceneOrItem, {locale: currentLocale()});
    if (!workbench || !workbench.sceneId || !workbench.playerText) {
      return '';
    }
    return ui.renderEventWorkbench(workbench, {locale: currentLocale(), eyebrow: t('eventWorkbench.eyebrow', 'Event Workbench')}) +
      '<div class="inspector-actions existing-scene-workbench-actions">' +
      '<button class="draft-action-button" type="button" data-edit-existing="true">' + escapeHtml(t('existingScene.editExisting', 'Edit existing')) + '</button>' +
      '<button class="draft-action-button" type="button" data-edit-as-draft="true">' + escapeHtml(t('existingScene.copyAsNew', 'Copy as new draft')) + '</button>' +
      '</div>';
  }

  function isEventWorkbenchCandidate(item) {
    if (!item) {
      return false;
    }
    if (item.delivery === 'legacy_event_popup' && item.linkedSceneId) {
      return true;
    }
    const type = String(item.type || (item.scene && item.scene.type) || '');
    const tags = ensureArray(item.tags || (item.scene && item.scene.tags));
    return type === 'event' || tags.includes('event');
  }

  function renderVariableInspector(variable) {
    const reads = ensureArray(variable.reads).slice(0, 16).map((source) => renderSourceButton(source));
    const writes = ensureArray(variable.writes).slice(0, 16).map((source) => renderSourceButton(source));
    return [
      '<h2 class="inspector-title">' + escapeHtml(variable.name || t('inspector.unnamedVariable', '(unnamed variable)')) + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(t('inspector.qVariable', 'Q variable')) + '</div>',
      '<div class="badge-line">',
      badge(variable.confidence || 'static_inferred', variable.confidence || 'static_inferred'),
      ensureArray(variable.tags).map((tag) => badge(tag, '')).join(''),
      '</div>',
      '<dl class="kv">',
      '<dt>' + escapeHtml(t('inspector.scope', 'Scope')) + '</dt><dd>' + escapeHtml(variable.scope || 'q') + '</dd>',
      '<dt>' + escapeHtml(t('inspector.reads', 'Reads')) + '</dt><dd>' + escapeHtml(variable.readCount || 0) + '</dd>',
      '<dt>' + escapeHtml(t('inspector.writes', 'Writes')) + '</dt><dd>' + escapeHtml(variable.writeCount || 0) + '</dd>',
      '</dl>',
      '<div class="inspector-actions">',
      '<button class="draft-action-button" type="button" data-edit-variable="true">' + escapeHtml(t('inspector.editVariable', 'Edit variable')) + '</button>',
      '</div>',
      renderMiniSection(t('inspector.readRefs', 'Read refs'), reads),
      renderMiniSection(t('inspector.writeRefs', 'Write refs'), writes)
    ].join('');
  }

  function renderCoverageInspector(item) {
    return [
      '<h2 class="inspector-title">' + escapeHtml(coverageField(item, 'label') || item.id || 'Coverage') + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(t('coverage.authoringCoverage', 'Authoring coverage')) + '</div>',
      '<div class="badge-line">',
      badge(item.coverageLabel || item.coverageLevel || 'unknown', coverageClass(item.coverageLevel)),
      item.releasePriority ? badge(coveragePriorityLabel(item.releasePriority), priorityClass(item.releasePriority)) : '',
      item.noCodeCompletion ? badge(noCodeCompletionLabel(item.noCodeCompletion), completionClass(item.noCodeCompletion)) : '',
      badge(coverageCountBadge('safe', item.safeApplyCount), 'info'),
      badge(coverageCountBadge('manual', item.manualReviewCount), 'warning'),
      item.unsupportedCount ? badge(coverageCountBadge('unsupported', item.unsupportedCount), 'opaque') : '',
      '</div>',
      '<dl class="kv">',
      '<dt>' + escapeHtml(t('coverage.rows', 'Rows')) + '</dt><dd>' + escapeHtml(item.count || 0) + '</dd>',
      '<dt>' + escapeHtml(t('coverage.feedbackPriority', 'Feedback priority')) + '</dt><dd>' + escapeHtml(coveragePriorityLabel(item.releasePriority)) + '</dd>',
      '<dt>' + escapeHtml(t('coverage.noCodeCompletion', 'No-code completion')) + '</dt><dd>' + escapeHtml(coverageCompletionLabel(item.noCodeCompletion)) + '</dd>',
      '<dt>' + escapeHtml(t('coverage.studioPath', 'Studio path')) + '</dt><dd>' + escapeHtml(coverageField(item, 'studioPath')) + '</dd>',
      '<dt>' + escapeHtml(t('coverage.canDo', 'Can do in Studio')) + '</dt><dd>' + escapeHtml(coverageField(item, 'userCanDo')) + '</dd>',
      '<dt>' + escapeHtml(t('coverage.authoring', 'Authoring')) + '</dt><dd>' + escapeHtml(coverageField(item, 'authoringStatus')) + '</dd>',
      '<dt>' + escapeHtml(t('coverage.install', 'Install')) + '</dt><dd>' + escapeHtml(coverageField(item, 'installStatus')) + '</dd>',
      '</dl>',
      renderMiniSection(t('coverage.beginnerWorkflow', 'Beginner workflow'), coverageWorkflowSteps(item).map((step) => escapeHtml(step))),
      renderMiniSection(t('coverage.remainingGap', 'Remaining gap'), [escapeHtml(coverageField(item, 'remainingGap') || item.notes || '')]),
      renderMiniSection(t('coverage.recommendedNextAction', 'Recommended next action'), [escapeHtml(coverageField(item, 'nextAction') || '')])
    ].join('');
  }

  function renderDiagnosticInspector(diag, model) {
    const note = diag.code === 'project_map.regex_only_goto'
      ? '<div class="edge-item">Authoring warning: static text scan found a go-to line that the parser did not expose as metadata.</div>'
      : '';
    const scene = diag.sceneId && model.scenesById.get(String(diag.sceneId));
    return [
      '<h2 class="inspector-title">' + escapeHtml(diag.code || 'diagnostic') + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(diag.message || '') + '</div>',
      '<div class="badge-line">',
      badge(diag.severity || 'info', diag.severity || 'info'),
      badge(diag.confidence || 'opaque', diag.confidence || 'opaque'),
      '</div>',
      '<dl class="kv">',
      '<dt>Scene</dt><dd>' + escapeHtml(diag.sceneId || '') + '</dd>',
      '<dt>Path</dt><dd>' + escapeHtml(diag.path || '') + '</dd>',
      '<dt>Source</dt><dd>' + renderSourceButton(diag.source) + '</dd>',
      '</dl>',
      note,
      scene ? renderMiniSection('Related scene', [escapeHtml(scene.id) + ' - ' + escapeHtml(scene.title || scene.path || '')]) : ''
    ].join('');
  }

  function renderNewsInspector(news) {
    if (news.delivery === 'legacy_event_popup') {
      const router = news.router || {};
      return [
        '<h2 class="inspector-title">' + escapeHtml(news.headline || '(untitled monthly popup)') + '</h2>',
        '<div class="inspector-subtitle">' + escapeHtml(t('news.popupSubtitle', 'Monthly event popup via #event')) + '</div>',
        '<div class="badge-line">',
        badge(t('news.monthlyPopupBadge', 'monthly_popup'), 'info'),
        badge(news.confidence || 'static_inferred', news.confidence || 'static_inferred'),
        '</div>',
        news.description || news.excerpt ? '<p class="inspector-note">' + escapeHtml(news.description || news.excerpt) + '</p>' : '',
        '<dl class="kv">',
        '<dt>' + escapeHtml(t('news.linkedScene', 'Linked scene')) + '</dt><dd>' + (news.linkedSceneId ? '<button type="button" data-scene-id="' + escapeAttr(news.linkedSceneId) + '">' + escapeHtml(news.linkedSceneId) + '</button>' : '') + '</dd>',
        '<dt>' + escapeHtml(t('news.when', 'When')) + '</dt><dd>' + escapeHtml(news.viewIf || '') + '</dd>',
        '<dt>' + escapeHtml(t('news.router', 'Router')) + '</dt><dd>' + escapeHtml([router.anchor, router.tag ? '#' + router.tag : ''].filter(Boolean).join(' / ')) + '</dd>',
        '<dt>' + escapeHtml(t('news.source', 'Source')) + '</dt><dd>' + renderSourceButton(news.source) + '</dd>',
        news.excerptSource ? '<dt>' + escapeHtml(t('news.excerptSource', 'Excerpt')) + '</dt><dd>' + renderSourceButton(news.excerptSource) + '</dd>' : '',
        '</dl>'
      ].join('');
    }
    return [
      '<h2 class="inspector-title">' + escapeHtml(news.headline || '(untitled news)') + '</h2>',
      '<div class="inspector-subtitle">News pool item</div>',
      '<div class="badge-line">' + badge(news.confidence || 'static_inferred', news.confidence || 'static_inferred') + '</div>',
      '<dl class="kv">',
      '<dt>Source</dt><dd>' + renderSourceButton(news.source) + '</dd>',
      '</dl>'
    ].join('');
  }

  function renderSurfaceTextInspector(item) {
    return [
      '<h2 class="inspector-title">' + escapeHtml(item.label || '(missing label)') + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(item.area || 'Surface text') + '</div>',
      '<div class="badge-line">',
      badge(item.editability || 'ide_escape_hatch', item.editability || ''),
      badge(item.confidence || 'static_inferred', item.confidence || 'static_inferred'),
      '</div>',
      '<dl class="kv">',
      '<dt>Source</dt><dd>' + renderSourceButton(item.source) + '</dd>',
      '<dt>Variable</dt><dd>' + escapeHtml(item.variableName || '') + '</dd>',
      '<dt>Editability</dt><dd>' + escapeHtml(item.editability || '') + '</dd>',
      '<dt>Reason</dt><dd>' + escapeHtml(item.reason || '') + '</dd>',
      '</dl>',
      item.originalText
        ? renderMiniSection('Original text', ['<code>' + escapeHtml(item.originalText) + '</code>'])
        : ''
    ].join('');
  }

  function renderTextCorpusInspector(item, model, state, visibleEdit) {
    const owner = item.owner || {};
    const replacement = textRevisionReplacementFor(state, item);
    const revisionModel = buildTextRevisionModel(item, replacement);
    const capability = editCapabilityForModel
      ? editCapabilityForModel(model, 'textCorpus', item, revisionModel.changed ? {replacementText: replacement} : null)
      : null;
    const ownerButton = owner.sceneId
      ? '<button type="button" data-scene-id="' + escapeAttr(owner.sceneId) + '">' + escapeHtml(t('textCorpus.openOwner', 'Open owner scene')) + '</button>'
      : '';
    const contextRows = textCorpusContextRows(model, item).map((row) => {
      const selected = row.id === item.id ? ' is-current' : '';
      return '<div class="text-context-row' + selected + '">' +
        '<span>' + escapeHtml(textCorpusRoleLabel(row.role)) + '</span>' +
        '<b>' + escapeHtml(sourceLabel(row.source)) + '</b>' +
        '<p>' + escapeHtml(row.text || '') + '</p>' +
        '</div>';
    });
    const roleGuidance = textCorpusRoleGuidance(item.role);
    return [
      '<h2 class="inspector-title">' + escapeHtml(item.text || '(empty text)') + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(t('textCorpus.subtitle', 'Player-visible text')) + '</div>',
      '<div class="badge-line">',
      badge(item.role || 'text', ''),
      capability ? badge(capabilityLabel(capability.routeClass), capabilityClass(capability)) : '',
      badge(item.editability || 'text_proposal', item.editability || ''),
      badge(item.confidence || 'static_inferred', item.confidence || 'static_inferred'),
      '</div>',
      ensureArray(item.conditions).length
        ? '<div class="detail-section"><h3>' + escapeHtml(t('textCorpus.conditions', 'Conditions')) + '</h3><pre class="code-preview">' + escapeHtml(ensureArray(item.conditions).join('\n')) + '</pre></div>'
        : '',
      '<dl class="kv">',
      '<dt>' + escapeHtml(t('textCorpus.role', 'Role')) + '</dt><dd>' + escapeHtml(textCorpusRoleLabel(item.role)) + '</dd>',
      '<dt>' + escapeHtml(t('textCorpus.editability', 'Editability')) + '</dt><dd>' + escapeHtml(textCorpusEditabilityLabel(item.editability)) + '</dd>',
      capability ? '<dt>' + escapeHtml(t('editCapability.route', 'Edit route')) + '</dt><dd>' + escapeHtml(capabilityLabel(capability.routeClass)) + '</dd>' : '',
      '<dt>' + escapeHtml(t('textCorpus.owner', 'Owner')) + '</dt><dd>' + escapeHtml([owner.kind, owner.sceneId || owner.itemId, owner.sectionId, owner.area].filter(Boolean).join(' / ')) + '</dd>',
      '<dt>' + escapeHtml(t('textCorpus.source', 'Source')) + '</dt><dd>' + renderSourceButton(item.source) + '</dd>',
      ownerButton ? '<dt>' + escapeHtml(t('textCorpus.ownerAction', 'Owner')) + '</dt><dd>' + ownerButton + '</dd>' : '',
      capability ? '<dt>' + escapeHtml(t('editCapability.routeReason', 'Route reason')) + '</dt><dd>' + escapeHtml(capabilityReason(capability)) + '</dd>' : '',
      roleGuidance ? '<dt>' + escapeHtml(t('textCorpus.guidance', 'Guidance')) + '</dt><dd>' + escapeHtml(roleGuidance) + '</dd>' : '',
      '</dl>',
      visibleEdit || '',
      renderTextRevisionPanel(item, replacement, state, capability),
      contextRows.length ? '<div class="detail-section"><h3>' + escapeHtml(t('textCorpus.context', 'Nearby text')) + '</h3><div class="text-context-list">' + contextRows.join('') + '</div></div>' : '',
      '<p class="inspector-note">' + escapeHtml(t('textCorpus.note', 'Text Corpus is an inspection index: use it to find player-facing prose, then create a proposal or jump to the owning source.')) + '</p>'
    ].join('');
  }

  function renderTextRevisionPanel(item, replacement, state, capabilityInput) {
    const key = textRevisionKey(item);
    const model = buildTextRevisionModel(item, replacement);
    const capability = capabilityInput || (state && state.model && editCapabilityForModel
      ? editCapabilityForModel(state.model, 'textCorpus', item, model.changed ? {replacementText: model.after} : null)
      : null);
    const result = state && state.model && model.changed
      ? previewTextReplacement(state.model.index, 'textCorpus', item, {replacementText: model.after})
      : null;
    const routeClass = capability && capability.routeClass || '';
    const routeCanOpenWithoutChange = routeClass === 'object_workspace' || routeClass === 'system_ui_workspace';
    const disabled = !routeCanOpenWithoutChange && (!model.changed || (result ? (!result.ok && result.status === 'unsupported') : true));
    const status = state && state.textActionMessage
      ? state.textActionMessage
      : model.changed || routeCanOpenWithoutChange
        ? editCapabilityRevisionSummary(capability, result)
        : t('textProposal.status.needsChange', 'Change the replacement text to create a proposal.');
    const diagnostics = ensureArray(result && result.diagnostics).slice(0, 3).map((diag) => {
      return badge(diag.severity || 'warning', diag.severity || 'warning') + ' ' +
        escapeHtml(diag.code || '') + '<br>' + escapeHtml(diag.message || '');
    });
    return [
      '<div class="detail-section text-revision-panel" data-text-revision-panel="true">',
      '<h3>' + escapeHtml(t('textRevision.title', 'Revision draft')) + '</h3>',
      '<label class="text-revision-label">',
      '<span>' + escapeHtml(t('textRevision.afterLabel', 'Replacement text')) + '</span>',
      '<textarea rows="5" data-text-revision-input="true" data-text-revision-key="' + escapeAttr(key) + '">' + escapeHtml(model.after) + '</textarea>',
      '</label>',
      '<div class="text-revision-status" data-text-revision-status="true">' + escapeHtml(textRevisionStatusLabel(model)) + '</div>',
      '<div class="text-revision-diff" data-text-revision-diff="true">' + renderTextRevisionDiff(model) + '</div>',
      '<div class="text-revision-actions" data-edit-text-panel="true">',
      '<button class="draft-action-button" type="button" data-edit-route-action="true"' +
        (disabled ? ' disabled' : '') + '>' + escapeHtml(capability ? capabilityAction(capability.routeClass) : t('textRevision.actionButton', 'Edit Text Proposal')) + '</button>',
      '<div class="draft-action-status" data-text-action-status="true">' + escapeHtml(status) + '</div>',
      renderExtractionScope(result),
      diagnostics.length ? renderMiniSection(t('textProposal.notesTitle', 'Text proposal notes'), diagnostics) : '',
      '</div>',
      '</div>'
    ].join('');
  }

  function editCapabilityRevisionSummary(capability, result) {
    if (!capability) {
      return textProposalSummary(result);
    }
    const routeClass = String(capability.routeClass || '');
    if (routeClass === 'direct_field_replace') {
      return t('editCapability.revision.directField', 'Opens the owning object editor and pre-fills the matching field for Review & Apply.');
    }
    if (routeClass === 'direct_section_replace') {
      return t('editCapability.revision.directSection', 'Opens the owning object editor and pre-fills the matching page section for Review & Apply.');
    }
    if (routeClass === 'object_workspace') {
      return t('editCapability.revision.objectWorkspace', 'Opens the owning Event/Card workspace with story context.');
    }
    if (routeClass === 'system_ui_workspace') {
      return t('editCapability.revision.systemUiWorkspace', 'Opens the System UI workspace; generic text patch remains review-only.');
    }
    return textProposalSummary(result);
  }

  function updateTextRevisionDom(root, item, replacement, state) {
    const model = buildTextRevisionModel(item, replacement);
    const status = root.querySelector('[data-text-revision-status]');
    const diff = root.querySelector('[data-text-revision-diff]');
    const action = root.querySelector('[data-edit-route-action]');
    const actionStatus = root.querySelector('[data-text-action-status]');
    if (status) {
      status.textContent = textRevisionStatusLabel(model);
    }
    if (diff) {
      diff.innerHTML = renderTextRevisionDiff(model);
    }
    if (action || actionStatus) {
      const result = state && state.model && model.changed
        ? previewTextReplacement(state.model.index, 'textCorpus', item, {replacementText: model.after})
        : null;
      const capability = state && state.model && editCapabilityForModel
        ? editCapabilityForModel(state.model, 'textCorpus', item, model.changed ? {replacementText: model.after} : null)
        : null;
      const routeClass = capability && capability.routeClass || '';
      const routeCanOpenWithoutChange = routeClass === 'object_workspace' || routeClass === 'system_ui_workspace';
      const disabled = !routeCanOpenWithoutChange && (!model.changed || (result ? (!result.ok && result.status === 'unsupported') : true));
      if (action) {
        action.disabled = disabled;
        if (capability) {
          action.textContent = capabilityAction(capability.routeClass);
        }
      }
      if (actionStatus) {
        actionStatus.textContent = model.changed || routeCanOpenWithoutChange
          ? editCapabilityRevisionSummary(capability, result)
          : t('textProposal.status.needsChange', 'Change the replacement text to create a proposal.');
      }
    }
  }

  function renderTextRevisionDiff(model) {
    return ensureArray(model.diff).map((row) => {
      return '<div class="text-revision-row ' + escapeAttr(row.kind || '') + '">' +
        '<span>' + escapeHtml(row.label || '') + '</span>' +
        '<p>' + escapeHtml(row.text || '') + '</p>' +
        '</div>';
    }).join('');
  }

  function textRevisionStatusLabel(model) {
    if (!model.changed) {
      return t('textRevision.statusUnchanged', 'No changes yet.');
    }
    if (model.editability === 'ide_escape_hatch') {
      return t('textRevision.statusManual', 'Changed. Studio needs a source mapping before it can build an executable patch.');
    }
    if (model.editability === 'draft_extractable') {
      return t('textRevision.statusDraft', 'Changed. This can seed a draft/proposal for review.');
    }
    return t('textRevision.statusProposal', 'Changed. This will export a text proposal for review.');
  }

  function renderAssetInspector(item, model) {
    const asset = normalizeAssetForViewer(item, model && model.index);
    const source = firstSource(asset) || asset.source || {};
    const usage = ensureArray(asset.usageRefs);
    return [
      '<h2 class="inspector-title">' + escapeHtml(asset.name || asset.path || asset.id || '(unnamed asset)') + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(t('assets.subtitle', 'Image / audio asset reference')) + '</div>',
      '<div class="badge-line">',
      badge(asset.type || 'asset', asset.type || ''),
      badge(asset.sourceKind || 'source_asset', asset.sourceKind || ''),
      badge(asset.status && asset.status.key || asset.editability || 'reference_only', asset.status && asset.status.key || asset.editability || ''),
      usage.length ? badge(t('assets.usedCount', 'used ') + usage.length, 'info') : '',
      badge(asset.confidence || 'static_inferred', asset.confidence || 'static_inferred'),
      '</div>',
      renderAssetPreviewFrame(asset, 'inspector'),
      renderAssetReferenceHelper(asset),
      renderAssetUseActions(asset),
      renderAssetRepairActions(asset),
      usage.length ? renderAssetUsageList(usage) : '<p class="inspector-note">' + escapeHtml(t('assets.noUsage', 'No indexed usage references yet.')) + '</p>',
      '<dl class="kv">',
      '<dt>' + escapeHtml(t('assets.path', 'Path')) + '</dt><dd>' + escapeHtml(asset.path || '') + '</dd>',
      '<dt>' + escapeHtml(t('assets.type', 'Type')) + '</dt><dd>' + escapeHtml(labelForBadge(asset.type || '')) + '</dd>',
      '<dt>' + escapeHtml(t('assets.extension', 'Extension')) + '</dt><dd>' + escapeHtml(asset.extension || '') + '</dd>',
      '<dt>' + escapeHtml(t('assets.size', 'Size')) + '</dt><dd>' + escapeHtml(asset.sizeBytes === undefined ? '' : String(asset.sizeBytes) + ' bytes') + '</dd>',
      '<dt>' + escapeHtml(t('assets.sourceKind', 'Source kind')) + '</dt><dd>' + escapeHtml(labelForBadge(asset.sourceKind || '')) + '</dd>',
      '<dt>' + escapeHtml(t('assets.source', 'Source')) + '</dt><dd>' + renderSourceButton(source) + '</dd>',
      '</dl>',
      '<p class="inspector-note">' + escapeHtml(t('assets.manualNote', 'Asset indexing is read-only for now. Studio can reference this path in previews, but it does not copy, optimize, or install asset files yet.')) + '</p>'
    ].join('');
  }

  function renderAssetUseActions(asset) {
    const api = assetModelApi();
    const ref = api && typeof api.assetDraftReference === 'function'
      ? api.assetDraftReference(asset || {})
      : {path: asset && asset.path || '', type: asset && asset.type || 'asset', label: asset && (asset.label || asset.name) || ''};
    if (!ref.path) {
      return '';
    }
    const payload = escapeAttr(JSON.stringify(ref));
    return [
      '<section class="asset-use-actions">',
      '<div class="preview-heading">' + escapeHtml(t('assets.useInDraft', 'Use in draft')) + '</div>',
      '<div class="asset-use-action-row">',
      '<button type="button" data-asset-action="use-in-draft" data-asset-target="event" data-asset-ref="' + payload + '">' + escapeHtml(t('assets.useInEventDraft', 'Use in Event draft')) + '</button>',
      '<button type="button" data-asset-action="use-in-draft" data-asset-target="card" data-asset-ref="' + payload + '">' + escapeHtml(t('assets.useInCardDraft', 'Use in Card draft')) + '</button>',
      '<button type="button" data-asset-action="copy-asset-ref" data-asset-ref="' + payload + '">' + escapeHtml(t('assets.copyReference', 'Copy asset ref')) + '</button>',
      '</div>',
      '<p>' + escapeHtml(t('assets.useInDraftNote', 'Adds only an assetRefs reference for preview; Studio does not copy or install asset files.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderAssetRepairActions(asset) {
    const state = asset && asset.referenceState && asset.referenceState.key || '';
    if (state !== 'file_missing' && state !== 'missing') {
      return '';
    }
    const targetPath = asset && (asset.path || asset.id || '') || '';
    if (!targetPath) {
      return '';
    }
    return [
      '<section class="asset-repair-actions">',
      '<div class="preview-heading">' + escapeHtml(t('assets.repairMissingFile', 'Provide missing file')) + '</div>',
      '<p>' + escapeHtml(t('assets.repairMissingFileNote', 'Choose a local image or audio file to create an asset install proposal for this missing reference.')) + '</p>',
      '<label>',
      '<span>' + escapeHtml(t('assets.repairAsEvent', 'Prepare for Event draft')) + '</span>',
      '<input type="file" accept="image/*,audio/*" data-asset-repair-file data-asset-repair-target="event" data-asset-repair-path="' + escapeAttr(targetPath) + '">',
      '</label>',
      '<label>',
      '<span>' + escapeHtml(t('assets.repairAsCard', 'Prepare for Card draft')) + '</span>',
      '<input type="file" accept="image/*,audio/*" data-asset-repair-file data-asset-repair-target="card" data-asset-repair-path="' + escapeAttr(targetPath) + '">',
      '</label>',
      '</section>'
    ].join('');
  }

  function renderAssetManifest(refs, projectIndex) {
    const api = assetModelApi();
    const manifest = api && typeof api.buildAssetManifest === 'function'
      ? api.buildAssetManifest(refs || [], {projectIndex})
      : {items: ensureArray(refs), counts: {}, manualActions: []};
    const items = ensureArray(manifest.items);
    if (!items.length) {
      return [
        '<section class="asset-manifest">',
        '<div class="preview-heading">' + escapeHtml(t('assets.manifest', 'Asset manifest')) + '</div>',
        '<p class="inspector-note">' + escapeHtml(t('assets.manifestEmpty', 'No asset references in this draft yet.')) + '</p>',
        '</section>'
      ].join('');
    }
    return [
      '<section class="asset-manifest">',
      '<div class="preview-heading">' + escapeHtml(t('assets.manifest', 'Asset manifest')) + '</div>',
      '<div class="asset-manifest-list">',
      items.map(renderAssetManifestRow).join(''),
      '</div>',
      manifest.manualActions && manifest.manualActions.length
        ? '<ul class="asset-manifest-actions">' + manifest.manualActions.map((line) => '<li>' + escapeHtml(line) + '</li>').join('') + '</ul>'
        : '<p class="inspector-note">' + escapeHtml(t('assets.manifestOk', 'All referenced assets are indexed and no physical-file gaps were detected.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderAssetManifestRow(asset) {
    const state = asset.referenceState && asset.referenceState.key || 'unknown';
    return [
      '<div class="asset-manifest-row">',
      '<strong>' + escapeHtml(localizedAssetRoleLabel(asset) || asset.label || asset.path || '') + '</strong>',
      '<code>' + escapeHtml(asset.path || '') + '</code>',
      '<span class="badge-line">',
      renderBadge(asset.type || 'asset', asset.type || ''),
      renderBadge(state, state),
      '</span>',
      '</div>'
    ].join('');
  }

  function localizedAssetRoleLabel(asset) {
    const role = String(asset && asset.role || '').trim();
    if (!role) {
      return asset && asset.roleLabel || '';
    }
    return t('assets.role.' + role, asset && asset.roleLabel || role);
  }

  function handleAssetDraftAction(state, elements, button) {
    const action = button.dataset.assetAction || '';
    const assetRef = parseAssetActionRef(button.dataset.assetRef);
    if (!assetRef.path) {
      return;
    }
    if (action === 'copy-asset-ref') {
      copyText(JSON.stringify(assetRef));
      return;
    }
    if (action !== 'use-in-draft') {
      return;
    }
    const target = button.dataset.assetTarget === 'card' ? 'card' : 'event';
    const createButton = global.document && global.document.querySelector('[data-mode="create"]');
    if (createButton) {
      createButton.click();
    }
    const templateButton = global.document && global.document.querySelector('[data-create-template="' + target + '"]');
    if (templateButton) {
      templateButton.click();
    }
    global.document.dispatchEvent(new CustomEvent('ProjectMap:asset-reference-selected', {
      detail: {target, assetRef}
    }));
    if (elements && elements.statusText) {
      elements.statusText.textContent = target === 'card'
        ? t('assets.status.addedToCardDraft', 'Asset reference added to Card draft.')
        : t('assets.status.addedToEventDraft', 'Asset reference added to Event draft.');
    }
  }

  function handleAssetRepairFileSelection(state, elements, input) {
    const file = input.files && input.files[0];
    if (!file || !state.selected || state.selected.view !== 'assets') {
      return;
    }
    const asset = normalizeAssetForViewer(state.selected.item, state.model && state.model.index);
    const api = assetModelApi();
    if (!api || typeof api.assetRepairInstallRequest !== 'function') {
      return;
    }
    const target = input.dataset.assetRepairTarget === 'card' ? 'card' : 'event';
    const request = api.assetRepairInstallRequest(asset, {
      name: file.name,
      path: file.path || '',
      size: file.size,
      lastModified: file.lastModified
    }, {projectIndex: state.model && state.model.index});
    const role = target === 'card'
      ? ((request.type === 'audio') ? 'card_audio' : 'card_image')
      : ((request.type === 'audio') ? 'event_audio' : 'event_illustration');
    request.role = request.role === 'reference' ? role : request.role;
    request.roleLabel = api.assetRoleLabel ? api.assetRoleLabel(request.role) : request.role;
    const assetRef = {
      path: request.targetPath,
      type: request.type,
      label: request.label || file.name,
      role: request.role
    };
    const createButton = global.document && global.document.querySelector('[data-mode="create"]');
    if (createButton) {
      createButton.click();
    }
    const templateButton = global.document && global.document.querySelector('[data-create-template="' + target + '"]');
    if (templateButton) {
      templateButton.click();
    }
    global.document.dispatchEvent(new CustomEvent('ProjectMap:asset-install-request-selected', {
      detail: {target, assetRef, assetInstallRequest: request}
    }));
    setStatus(elements, t('assets.status.repairPrepared', 'Asset repair proposal added to Create.'));
  }

  function parseAssetActionRef(value) {
    try {
      const parsed = JSON.parse(String(value || '{}'));
      return {
        path: String(parsed.path || '').trim(),
        type: String(parsed.type || 'asset').trim(),
        label: String(parsed.label || parsed.name || '').trim(),
        role: String(parsed.role || '').trim()
      };
    } catch (_err) {
      return {path: '', type: 'asset', label: '', role: ''};
    }
  }

  function copyText(value) {
    const text = String(value || '');
    if (global.navigator && global.navigator.clipboard && typeof global.navigator.clipboard.writeText === 'function') {
      global.navigator.clipboard.writeText(text).catch(() => null);
    }
  }

  function renderAssetReferenceHelper(asset) {
    const api = assetModelApi();
    const helper = api && typeof api.renderReferenceHelper === 'function'
      ? api.renderReferenceHelper(asset || {})
      : String(asset && (asset.path || asset.id) || '');
    const referenceState = asset && asset.referenceState ? asset.referenceState : {};
    if (!helper) {
      return '';
    }
    return [
      '<section class="asset-reference-helper">',
      '<div class="preview-heading">' + escapeHtml(t('assets.referenceHelper', 'Reference helper')) + '</div>',
      '<code>' + escapeHtml(helper) + '</code>',
      '<p>' + escapeHtml(t('assets.referenceHelperNote', 'Use this path in draft assetRefs or notes; Studio will not install asset files automatically.')) + '</p>',
      referenceState.key ? '<span class="badge ' + escapeAttr(referenceState.key) + '">' + escapeHtml(assetReferenceStateLabel(referenceState.key)) + '</span>' : '',
      '</section>'
    ].join('');
  }

  function assetReferenceStateLabel(key) {
    const labels = {
      indexed: t('assets.referenceState.indexed', 'indexed'),
      missing: t('assets.referenceState.missing', 'missing asset'),
      file_missing: t('assets.referenceState.file_missing', 'file missing'),
      external: t('assets.referenceState.external', 'external asset'),
      unknown: t('assets.referenceState.unknown', 'unknown')
    };
    return labels[String(key || '')] || String(key || '');
  }

  function renderAssetPreviewFrame(asset, mode) {
    const capability = asset && asset.previewCapability ? asset.previewCapability : {};
    const mediaKind = capability.mediaKind || asset && asset.type || 'asset';
    const url = capability.url || asset && asset.path || '';
    const title = asset && (asset.label || asset.name || asset.path) || '';
    if (capability.canPreview && mediaKind === 'image') {
      return [
        '<figure class="asset-preview-frame asset-preview-image" data-asset-preview-mode="' + escapeAttr(mode || 'default') + '">',
        '<img src="' + escapeAttr(url) + '" alt="' + escapeAttr(title) + '" loading="lazy">',
        '<figcaption>' + escapeHtml(title || t('assets.previewImage', 'Image preview')) + '</figcaption>',
        '</figure>'
      ].join('');
    }
    if (capability.canPreview && mediaKind === 'audio') {
      return [
        '<figure class="asset-preview-frame asset-preview-audio" data-asset-preview-mode="' + escapeAttr(mode || 'default') + '">',
        '<audio controls preload="metadata" src="' + escapeAttr(url) + '"></audio>',
        '<figcaption>' + escapeHtml(title || t('assets.previewAudio', 'Audio preview')) + '</figcaption>',
        '</figure>'
      ].join('');
    }
    return [
      '<div class="asset-preview-frame asset-preview-empty" data-asset-preview-mode="' + escapeAttr(mode || 'default') + '">',
      '<span>' + escapeHtml(labelForBadge(mediaKind || 'asset')) + '</span>',
      '<p>' + escapeHtml(capability.message || t('assets.noPreview', 'Studio cannot directly preview this asset yet.')) + '</p>',
      '</div>'
    ].join('');
  }

  function renderAssetUsageList(usage) {
    return [
      '<section class="asset-usage-list">',
      '<div class="preview-heading">' + escapeHtml(t('assets.usage', 'Used by')) + '</div>',
      usage.map((ref) => [
        '<div class="asset-usage-row">',
        '<span>' + escapeHtml(labelForBadge(ref.kind || 'reference')) + '</span>',
        ref.id && ref.view === 'scenes'
          ? '<button class="source-button" type="button" data-scene-id="' + escapeAttr(ref.id) + '">' + escapeHtml(ref.label || ref.id) + '</button>'
          : '<strong>' + escapeHtml(ref.label || ref.id || ref.path || '') + '</strong>',
        '<span class="asset-usage-source">' + (ref.source ? renderSourceButton(ref.source) : '') + '</span>',
        '</div>'
      ].join('')).join(''),
      '</section>'
    ].join('');
  }

  function renderSourceInspector(source) {
    const excerpt = source.excerpt
      ? '<pre class="source-excerpt">' + escapeHtml(source.excerpt) + '</pre>'
      : escapeHtml(t('inspector.excerptMissing', '(not included in this index)'));
    return [
      '<h2 class="inspector-title">' + escapeHtml(t('inspector.sourceSpan', 'Source span')) + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(sourceLabel(source)) + '</div>',
      '<dl class="kv">',
      '<dt>' + escapeHtml(t('inspector.path', 'Path')) + '</dt><dd>' + escapeHtml(source.path || '') + '</dd>',
      '<dt>' + escapeHtml(t('inspector.line', 'Line')) + '</dt><dd>' + escapeHtml(source.line || source.startLine || '') + '</dd>',
      '<dt>' + escapeHtml(t('inspector.endLine', 'End line')) + '</dt><dd>' + escapeHtml(source.endLine || '') + '</dd>',
      '<dt>' + escapeHtml(t('inspector.excerpt', 'Excerpt')) + '</dt><dd>' + excerpt + '</dd>',
      '</dl>'
    ].join('');
  }

  function renderOverviewInspector(item, model) {
    const matching = ensureArray(item.examples).length
      ? ensureArray(item.examples)
      : model.diagnostics.filter((diag) => diag.code === item.code).slice(0, 12);
    const note = item.code === 'project_map.regex_only_goto'
      ? '<div class="edge-item">' + escapeHtml(t('inspector.regexGotoWarning', 'Authoring warning: these go-to refs came from static text scan because the parser did not expose them as metadata.')) + '</div>'
      : '';
    return [
      '<h2 class="inspector-title">' + escapeHtml(item.code) + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(t('inspector.diagnosticCount', '{count} diagnostics').replace('{count}', item.count)) + '</div>',
      '<div class="badge-line">' +
      badge(item.severity || 'info', item.severity || 'info') +
      badge(item.confidence || 'mixed', item.confidence || '') +
      '</div>',
      note,
      renderMiniSection(t('inspector.examples', 'Examples'), matching.map(renderDiagnosticMini))
    ].join('');
  }

  function renderEdgeSection(title, rows) {
    if (!rows.length) {
      return renderMiniSection(title, [escapeHtml(t('inspector.noEdges', 'No edges.'))]);
    }
    return [
      '<div class="detail-section">',
      '<h3 class="section-title">' + escapeHtml(title) + '</h3>',
      '<div class="edge-list">',
      rows.map((row) => {
        const edge = row.edge || {};
        const endpoint = renderSceneEndpoint(row);
        const label = row.label ? '<div class="edge-note">' + escapeHtml(t('inspector.label', 'Label')) + ': ' + escapeHtml(row.label) + '</div>' : '';
        const condition = row.condition ? '<div class="edge-note">' + escapeHtml(t('inspector.condition', 'Condition')) + ': ' + escapeHtml(row.condition) + '</div>' : '';
        return '<div class="edge-item"><strong>' + escapeHtml(row.kind || 'edge') + '</strong> ' +
          escapeHtml(edge.from || '') + ' -> ' + escapeHtml(edge.to || '') +
          '<div>' + escapeHtml(t('inspector.endpoint', 'Endpoint')) + ': ' + endpoint + '</div>' +
          label + condition +
          '<div class="badge-line">' + badge(row.confidence || 'opaque', row.confidence || 'opaque') +
          renderSourceButton(row.source) + '</div></div>';
      }).join(''),
      '</div>',
      '</div>'
    ].join('');
  }

  function renderSceneEndpoint(row) {
    if (row.endpointScene) {
      const label = row.endpointId && row.endpointId !== row.endpointScene.id
        ? row.endpointScene.id + ' (' + row.endpointId + ')'
        : row.endpointScene.id;
      return '<button class="scene-link" type="button" data-scene-id="' +
        escapeAttr(row.endpointScene.id) + '">' + escapeHtml(label) + '</button>';
    }
    return escapeHtml(row.endpointId || '');
  }

  function renderMiniSection(title, items) {
    return [
      '<div class="detail-section">',
      '<h3 class="section-title">' + escapeHtml(title) + '</h3>',
      '<div class="mini-list">',
      (items.length ? items : ['None.']).map((item) => '<div class="mini-item">' + item + '</div>').join(''),
      '</div>',
      '</div>'
    ].join('');
  }

  function renderDiagnosticMini(diag) {
    return badge(diag.severity || 'info', diag.severity || 'info') + ' ' +
      escapeHtml(diag.code || '') + '<br>' + escapeHtml(diag.message || '') +
      '<div>' + renderSourceButton(diag.source) + '</div>';
  }

  function badge(text, className) {
    return renderBadge(text, className);
  }

  function renderBadge(text, className) {
    return '<span class="badge ' + escapeAttr(className || '') + '">' + escapeHtml(labelForBadge(text)) + '</span>';
  }

  function labelForBadge(text) {
    const value = String(text || '');
    const labels = {
      exact: t('confidence.matched', 'matched'),
      static_inferred: t('confidence.inferred', 'inferred'),
      profile_heuristic: t('confidence.guessed', 'guessed'),
      opaque: t('confidence.unknown', 'unknown'),
      error: t('design.severity.error', 'Error'),
      warning: t('design.severity.warning', 'Warning'),
      info: t('design.severity.info', 'Info'),
      'In Studio, read-only': t('coverage.inStudioReadOnly', 'In Studio, read-only'),
      'In Studio, best-effort': t('coverage.inStudioBestEffort', 'In Studio, best-effort'),
      'In Studio, manual install': t('coverage.inStudioManualInstall', 'In Studio, manual install'),
      'In Studio, wiring review': t('coverage.inStudioWiringReview', 'In Studio, wiring review'),
      'In Studio, guarded': t('coverage.inStudioGuarded', 'In Studio, guarded'),
      'Mixed safe / IDE': t('coverage.mixedSafeIde', 'Mixed safe / source review'),
      'IDE guidance': t('coverage.ideGuidance', 'Source review guidance'),
      'Picker + warnings': t('coverage.pickerWarnings', 'Picker + warnings'),
      'Proposal + IDE guidance': t('coverage.proposalIdeGuidance', 'Proposal + source review guidance'),
      'Guided review only': t('coverage.guidedReviewOnly', 'Guided review only'),
      'IDE escape hatch': t('coverage.ideEscapeHatch', 'Source mapping needed'),
      'Not started': t('coverage.notStarted', 'Not started'),
      image: t('assets.type.image', 'image'),
      audio: t('assets.type.audio', 'audio'),
      asset: t('assets.type.asset', 'asset'),
      event_illustration: t('assets.role.event_illustration', 'event illustration'),
      event_portrait: t('assets.role.event_portrait', 'event portrait'),
      event_audio: t('assets.role.event_audio', 'event audio'),
      card_image: t('assets.role.card_image', 'card image'),
      card_portrait: t('assets.role.card_portrait', 'card portrait'),
      card_audio: t('assets.role.card_audio', 'card audio'),
      advisor_portrait: t('assets.role.advisor_portrait', 'advisor portrait'),
      reference: t('assets.role.reference', 'reference'),
      source_asset: t('assets.sourceKind.sourceAsset', 'source asset'),
      runtime_evidence: t('assets.sourceKind.runtimeEvidence', 'runtime evidence'),
      reference_only: t('assets.editability.referenceOnly', 'reference only'),
      manual_review: t('assets.editability.manualReview', 'manual review'),
      indexed: t('assets.referenceState.indexed', 'indexed'),
      missing: t('assets.referenceState.missing', 'missing asset'),
      file_missing: t('assets.referenceState.file_missing', 'file missing'),
      external: t('assets.referenceState.external', 'external'),
      empty: t('assets.slotState.empty', 'empty'),
      selected: t('assets.slotState.selected', 'selected'),
      pending_install: t('assets.slotState.pendingInstall', 'pending install'),
      copy_asset_file: t('install.action.copyAssetFile', 'copy asset file'),
      unknown: t('assets.referenceState.unknown', 'unknown'),
      text_proposal: t('textCorpus.editability.textProposal', 'text proposal'),
      draft_extractable: t('textCorpus.editability.draftExtractable', 'draft extractable'),
      source_patch: t('textCorpus.editability.sourcePatch', 'Studio source patch'),
      body: t('textCorpus.role.body', 'body'),
      heading: t('textCorpus.role.heading', 'heading'),
      title: t('textCorpus.role.title', 'title'),
      subtitle: t('textCorpus.role.subtitle', 'subtitle'),
      option_label: t('textCorpus.role.optionLabel', 'option label'),
      conditional_body: t('textCorpus.role.conditionalBody', 'conditional body'),
      unavailable_text: t('textCorpus.role.unavailableText', 'unavailable text'),
      news_headline: t('textCorpus.role.newsHeadline', 'news headline'),
      news_description: t('textCorpus.role.newsDescription', 'news description'),
      monthly_popup_excerpt: t('textCorpus.role.monthlyPopupExcerpt', 'monthly popup excerpt'),
      surface_label: t('textCorpus.role.surfaceLabel', 'surface label'),
      ide_escape_hatch: t('coverage.ideEscapeHatch', 'Source mapping needed'),
      missing: t('coverage.missing', 'missing')
    };
    if (value.startsWith('no-code ')) {
      return t('coverage.noCode', 'no-code') + ' ' + value.slice('no-code '.length);
    }
    if (value.startsWith('safe ')) {
      return t('coverage.safe', 'safe') + ' ' + value.slice('safe '.length);
    }
    if (value.startsWith('manual ')) {
      return t('coverage.manual', 'manual') + ' ' + value.slice('manual '.length);
    }
    if (value.startsWith('unsupported ')) {
      return t('coverage.unsupported', 'unsupported') + ' ' + value.slice('unsupported '.length);
    }
    return labels[value] || value;
  }

    return {
      renderInspector,
      renderInspectorPreview,
      renderEditDraftAction,
      renderTextProposalAction,
      renderExtractionScope,
      previewDraftExtraction,
      previewTextReplacement,
      draftActionSummary,
      textProposalSummary,
      handleEditAsDraft,
      handleEditExisting,
      handleEditTextProposal,
      handleEditRouteAction,
      handleEditVariable,
      handleEventWorkbenchAction,
      eventWorkbenchSeedForSelection,
      eventWorkbenchActionStatus,
      openDraftInCreate,
      activateMode,
      openDesignSelectionInExplore,
      designRowMatches,
      activateCreateTemplate,
      sceneFromSelection,
      renderSourceButton,
      renderSceneInspector,
      renderEventWorkbenchInspector,
      renderVariableInspector,
      renderCoverageInspector,
      renderDiagnosticInspector,
      renderNewsInspector,
      renderSurfaceTextInspector,
      renderTextCorpusInspector,
      renderTextRevisionPanel,
      updateTextRevisionDom,
      renderTextRevisionDiff,
      renderAssetInspector,
      renderAssetUseActions,
      renderAssetRepairActions,
      renderAssetManifest,
      localizedAssetRoleLabel,
      handleAssetDraftAction,
      handleAssetRepairFileSelection,
      parseAssetActionRef,
      copyText,
      renderAssetReferenceHelper,
      assetReferenceStateLabel,
      renderAssetPreviewFrame,
      renderAssetUsageList,
      renderSourceInspector,
      renderOverviewInspector,
      renderEdgeSection,
      renderSceneEndpoint,
      renderMiniSection,
      renderDiagnosticMini,
      escapeHtml,
      escapeAttr,
      badge,
      renderBadge,
      labelForBadge
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectMapExploreInspector;
  }

  if (root) {
    root.ProjectMapExploreInspector = ProjectMapExploreInspector;
  }
})(typeof window !== 'undefined' ? window : globalThis);
