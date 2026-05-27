(function initProjectMapObjectAuthoringCanvasModel(global) {
  'use strict';

  const OBJECT_AUTHORING_CANVAS_VERSION = '0.1';
  const MODEL_KIND = 'object_authoring_canvas_model';

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function editingContextApi() {
    if (global && global.ProjectMapEditingContextModel) {
      return global.ProjectMapEditingContextModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./editing_context_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function eventDraftApi() {
    if (global && global.ProjectMapEventDraft) {
      return global.ProjectMapEventDraft;
    }
    if (typeof require === 'function') {
      try {
        return require('./event_draft.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function contentAdaptersApi() {
    if (global && global.ProjectMapObjectCanvasContentAdapters) {
      return global.ProjectMapObjectCanvasContentAdapters;
    }
    if (typeof require === 'function') {
      try {
        return require('./object_canvas_content_adapters.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function eventStructureApi() {
    if (global && global.ProjectMapEventStructureModel) {
      return global.ProjectMapEventStructureModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./event_structure_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function installPlanApi() {
    if (global && global.ProjectMapInstallPlan) {
      return global.ProjectMapInstallPlan;
    }
    if (typeof require === 'function') {
      try {
        return require('./install_plan.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function assetModelApi() {
    if (global && global.ProjectMapAssetModel) {
      return global.ProjectMapAssetModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./asset_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function ownershipMatchingApi() {
    if (global && global.ProjectMapOwnershipMatching) {
      return global.ProjectMapOwnershipMatching;
    }
    if (typeof require === 'function') {
      try {
        return require('./ownership_matching_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function fieldPresentationApi() {
    if (global && global.ProjectMapObjectFieldPresentationModel) {
      return global.ProjectMapObjectFieldPresentationModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./object_field_presentation_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function routeStateApi() {
    if (global && global.ProjectMapRouteStateModel) {
      return global.ProjectMapRouteStateModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./route_state_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function isExistingProposal(value) {
    return isObject(value) && (value.kind === 'existing_scene_edit' || Boolean(value.sceneId && value.changes));
  }

  function isExistingCanvasRequest(value, template) {
    const request = isObject(value) ? value : {};
    const draft = isObject(request.draft) ? request.draft : request;
    const mode = String(request.mode || '').trim();
    const type = String(request.type || '').trim();
    const key = String(template || request.template || '').trim();
    return mode === 'existing' ||
      type === 'existing' ||
      key === 'existing' ||
      isExistingProposal(draft);
  }

  function existingViewForRequest(value) {
    const request = isObject(value) ? value : {};
    const draft = isObject(request.draft) ? request.draft : request;
    const explicit = String(request.view || '').trim();
    if (explicit) {
      return explicit;
    }
    return String(draft.sceneKind || request.sceneKind || '') === 'card' ? 'cards' : 'events';
  }

  function existingItemForRequest(value) {
    const request = isObject(value) ? value : {};
    const draft = isObject(request.draft) ? request.draft : request;
    return request.item || request.itemOrId || request.sceneId || draft.sceneId || draft.item || draft.id || '';
  }

  function existingOptionsForRequest(value, options) {
    const request = isObject(value) ? value : {};
    const draft = isObject(request.draft) ? request.draft : request;
    const opts = Object.assign({}, isObject(options) ? options : {});
    if (!isObject(opts.values) || !Object.keys(opts.values).length) {
      const api = editingContextApi();
      if (api && typeof api.proposalValues === 'function' && isExistingProposal(draft)) {
        opts.values = api.proposalValues(draft);
      }
    }
    if (!opts.entry && request.entry) {
      opts.entry = request.entry;
    }
    if (isExistingProposal(draft) && ensureArray(draft.assetInstallRequests).length) {
      const proposalOptions = Object.assign({}, isObject(opts.proposalOptions) ? opts.proposalOptions : {});
      if (!ensureArray(proposalOptions.assetInstallRequests).length) {
        proposalOptions.assetInstallRequests = ensureArray(draft.assetInstallRequests);
      }
      opts.proposalOptions = proposalOptions;
    }
    return opts;
  }

  function buildCanvasModel(projectIndex, input, options) {
    const value = isObject(input) ? input : {};
    if (isExistingCanvasRequest(value)) {
      return buildExistingCanvas(
        projectIndex,
        existingViewForRequest(value),
        existingItemForRequest(value),
        existingOptionsForRequest(value, options)
      );
    }
    const adapters = contentAdaptersApi();
    if (adapters && typeof adapters.buildTemplateCanvas === 'function') {
      const draft = value.draft || value;
      const template = value.template || adapters.templateFromDraft && adapters.templateFromDraft(draft) || 'event';
      return adapters.buildTemplateCanvas(projectIndex, template, draft, options);
    }
    return buildNewEventCanvas(projectIndex, value.draft || value, options);
  }

  function buildExistingCanvas(projectIndex, view, itemOrId, options) {
    const opts = isObject(options) ? options : {};
    const contextApi = editingContextApi();
    if (!contextApi || typeof contextApi.buildContextModel !== 'function') {
      return emptyCanvas('existing', diagnostic('error', 'object_canvas.context_missing', 'Context model is unavailable.'));
    }
    const context = contextApi.buildContextModel(projectIndex, view, itemOrId, {
      values: opts.values || {},
      proposalOptions: opts.proposalOptions || {}
    });
    if (!context || !context.ok) {
      return emptyCanvas('existing', diagnostic('warning', 'object_canvas.existing_unavailable', 'This object cannot be opened in the authoring Canvas yet.'), context);
    }
    const body = perfMeasure('eventBodyForExisting', () => eventBodyForExisting(context, projectIndex, opts.values || {}), {view, item: String(itemOrId || '')});
    const output = context.output || {};
    return {
      schemaVersion: OBJECT_AUTHORING_CANVAS_VERSION,
      kind: MODEL_KIND,
      ok: true,
      mode: 'existing',
      objectKind: context.sceneKind === 'card' ? 'card' : 'event',
      objectView: view,
      objectId: context.sceneId || '',
      title: context.title || context.sceneId || '',
      source: sourceRef(context.source || {}),
      entry: entryInfo(opts.entry),
      contextBoard: contextBoardFromEditingContext(context),
      eventBody: body,
      changeState: {
        draft: context.proposal,
        proposal: context.proposal,
        output,
        installPlan: output.installPlan || null,
        operationSummary: context.operationSummary || operationSummary(null),
        changedCount: ensureArray(context.proposal && context.proposal.changes).length,
        diagnostics: ensureArray(context.diagnostics),
        warnings: ensureArray(context.warnings)
      },
      legacy: {template: 'existing'},
      rawContext: context
    };
  }

  function buildNewEventCanvas(projectIndex, draftInput, options) {
    const adapters = contentAdaptersApi();
    if (adapters && typeof adapters.buildTemplateCanvas === 'function') {
      return adapters.buildTemplateCanvas(projectIndex, 'event', draftInput, options);
    }
    const opts = isObject(options) ? options : {};
    const draft = draftFromValues(normalizeEventInput(draftInput), opts.values || {});
    const api = eventDraftApi();
    let output = fallbackEventOutput(draft);
    let diagnostics = [];
    if (api && typeof api.buildExportBundle === 'function') {
      try {
        const bundle = api.buildExportBundle(draft, projectIndex, {defaultContinueLabel: opts.defaultContinueLabel || 'Continue'});
        output = normalizeEventOutput(bundle, draft);
        diagnostics = normalizeDiagnostics(bundle && bundle.diagnostics);
      } catch (err) {
        diagnostics = [diagnostic('error', 'object_canvas.event_build_failed', err && err.message || 'Event draft build failed.')];
      }
    } else {
      diagnostics = [diagnostic('warning', 'object_canvas.event_core_missing', 'EventDraft core is unavailable; Canvas is showing a local draft preview.')];
    }
    const summary = operationSummary(output.installPlan);
    return {
      schemaVersion: OBJECT_AUTHORING_CANVAS_VERSION,
      kind: MODEL_KIND,
      ok: !diagnostics.some((item) => item.severity === 'error' || item.level === 'error'),
      mode: 'new_event',
      objectKind: 'event',
      objectId: draft.id || '',
      title: draft.title || draft.heading || draft.id || 'New Event',
      source: {path: 'source/scenes/events/' + (draft.id || 'new_event') + '.scene.dry'},
      entry: entryInfo(opts.entry || {source: 'create'}),
      contextBoard: contextBoardForNewEvent(projectIndex, draft, opts.seed || opts.entry),
      eventBody: eventBodyForNewEvent(draft, projectIndex),
      changeState: {
        draft,
        proposal: draft,
        output,
        installPlan: output.installPlan || null,
        operationSummary: summary,
        changedCount: changedCountFromValues(opts.values),
        diagnostics,
        warnings: diagnostics.filter((item) => item.severity === 'warning' || item.level === 'warning').map((item) => item.message)
      },
      legacy: {template: 'event'},
      rawContext: null
    };
  }

  function buildTemplateCanvas(projectIndex, template, draftInput, options) {
    const existingRequest = {template, draft: draftInput};
    if (isExistingCanvasRequest(existingRequest)) {
      return buildExistingCanvas(
        projectIndex,
        existingViewForRequest(existingRequest),
        existingItemForRequest(existingRequest),
        existingOptionsForRequest(existingRequest, options)
      );
    }
    const adapters = contentAdaptersApi();
    if (adapters && typeof adapters.buildTemplateCanvas === 'function') {
      return adapters.buildTemplateCanvas(projectIndex, template, draftInput, options);
    }
    return buildNewEventCanvas(projectIndex, draftInput, options);
  }

  function defaultDraftForTemplate(projectIndex, template) {
    const adapters = contentAdaptersApi();
    if (adapters && typeof adapters.defaultDraftForTemplate === 'function') {
      return adapters.defaultDraftForTemplate(projectIndex, template);
    }
    return normalizeEventInput({});
  }

  function templateFromDraft(draft) {
    if (isExistingProposal(draft)) {
      return 'existing';
    }
    const adapters = contentAdaptersApi();
    if (adapters && typeof adapters.templateFromDraft === 'function') {
      return adapters.templateFromDraft(draft);
    }
    return 'event';
  }

  function eventBodyForExisting(context, projectIndex, values) {
    const editors = context.editors || {};
    const allEditors = ensureArray(editors.all);
    const sceneId = String(context && context.sceneId || '');
    const titleEditor = allEditors.find((editor) => editor.role === 'title' && !String(editor.sectionId || '').trim()) ||
      allEditors.find((editor) => editor.role === 'title') ||
      allEditors.find((editor) => editor.role === 'heading' && isOpeningSectionId(sceneId, editor.sectionId)) ||
      allEditors.find((editor) => editor.role === 'heading') ||
      null;
    const subtitleEditor = allEditors.find((editor) => editor.role === 'subtitle') || null;
    const headingEditor = (titleEditor && titleEditor.role !== 'heading')
      ? (allEditors.find((editor) => editor.role === 'heading' && !String(editor.sectionId || '').trim()) ||
         allEditors.find((editor) => editor.role === 'heading' && isOpeningSectionId(sceneId, editor.sectionId)) ||
         null)
      : null;
    const extractedIds = [titleEditor, subtitleEditor, headingEditor].filter(Boolean).map((e) => e.id);
    const pageSectionEditors = ensureArray(editors.pageSections)
      .filter((editor) => !extractedIds.includes(editor.id));
    const metadataEditors = allEditors.filter((editor) => String(editor && editor.role || '') === 'metadata');
    const playerTextEditors = ensureArray(editors.playerText)
      .filter((editor) => String(editor && editor.role || '') !== 'metadata')
      .filter((editor) => String(editor && editor.role || '') !== 'asset_reference')
      .filter((editor) => !extractedIds.includes(editor.id));
    const optionRows = optionBodyRows(context, pageSectionEditors);
    const consumedSectionIds = new Set();
    const consumedPlayerTextIds = new Set();
    optionRows.forEach((option) => {
      ensureArray(option.resultFields).forEach((field) => consumedSectionIds.add(String(field.id || '')));
      ensureArray(option.fields).forEach((field) => {
        if (String(field && field.role || '') === 'unavailable_text') {
          consumedPlayerTextIds.add(String(field.id || ''));
        }
      });
    });
    const primarySectionEditors = pageSectionEditors.filter((editor) => {
      return !consumedSectionIds.has(String(editor.id || '')) && isPrimaryExistingSection(editor, sceneId);
    });
    const branchSectionEditors = pageSectionEditors.filter((editor) => {
      return !consumedSectionIds.has(String(editor.id || '')) && !isPrimaryExistingSection(editor, sceneId);
    });
    const primaryPlayerTextEditors = playerTextEditors.filter((editor) => !consumedPlayerTextIds.has(String(editor.id || '')) && isPrimaryExistingSection(editor, sceneId));
    const branchPlayerTextEditors = playerTextEditors.filter((editor) => !consumedPlayerTextIds.has(String(editor.id || '')) && !isPrimaryExistingSection(editor, sceneId));
    const sectionEditors = primarySectionEditors.concat(primaryPlayerTextEditors);
    const effectEditors = ensureArray(editors.effects);
    const body = {
      mode: 'existing',
      eventShape: optionRows.length > 1 ? 'choice_event' : optionRows.length === 1 ? 'linear_choice_event' : 'pure_event',
      title: titleEditor || {
        id: '',
        label: 'Title',
        value: context.title || context.sceneId || '',
        original: context.title || context.sceneId || '',
        status: 'read_only',
        readOnly: true
      },
      subtitle: subtitleEditor || undefined,
      heading: headingEditor || undefined,
      sections: sectionEditors.map((editor, index) => Object.assign({slot: 'section_' + (index + 1)}, editor)),
      branchSections: branchSectionEditors.concat(branchPlayerTextEditors).map((editor, index) => Object.assign({slot: 'branch_' + (index + 1)}, editor)),
      options: optionRows,
      assets: assetRowsForExisting(context, projectIndex),
      assetAddFields: assetAddFieldsForExisting(context),
      assetCatalog: assetCatalogForProject(projectIndex, context.sceneKind === 'card' ? 'card' : 'event'),
      assetBaseUrl: String(projectIndex && projectIndex.project && projectIndex.project.assetBaseUrl || ''),
      variables: variableRowsForExisting(context),
      backgroundEffects: backgroundEffectRowsForExisting(context),
      metaFields: metadataEditors.concat(ensureArray(editors.conditions), ensureArray(editors.routes)),
      structureActions: ensureArray(editors.structureActions),
      scriptRows: ensureArray(context.editModel && context.editModel.scriptRows),
      opaqueJsBlocks: ensureArray(context.editModel && context.editModel.opaqueJsBlocks),
      projectSceneIds: ensureArray(projectIndex && projectIndex.scenes).map((scene) => String(scene && scene.id || '')).filter(Boolean),
      flow: context.flow || context.editModel && context.editModel.flow || {nodes: [], edges: [], summary: {}},
      sourceStructureGraph: context.sourceStructureGraph || context.editModel && context.editModel.sourceStructureGraph || null,
      effects: effectEditors.filter((editor) => !editor.optionId && !editor.sectionId),
      sectionEffects: effectEditors.filter((editor) => editor.sectionId),
      optionEffects: optionRows.map((option) => ({
        id: option.id,
        label: option.label,
        fields: effectEditors.filter((editor) => effectMatchesOption(editor, option))
      })).filter((group) => group.fields.length)
    };
    const structureApi = eventStructureApi();
    const modeledBody = structureApi && typeof structureApi.fromEditingContext === 'function' && typeof structureApi.toEventBody === 'function'
      ? perfMeasure('structureApi.fromEditingContext+toEventBody', () => structureApi.toEventBody(structureApi.fromEditingContext(context, projectIndex, {body})), {})
      : body;
    const regrouped = perfMeasure('regroupOptionOwnedText', () => regroupOptionOwnedText(modeledBody), {options: ensureArray(modeledBody && modeledBody.options).length});
    const queued = bodyWithQueuedStructurePreviews(regrouped, values);
    return perfMeasure('enrichFieldPresentation', () => enrichFieldPresentation(
      queued,
      projectIndex,
      {routeState: routeStateForExisting(projectIndex, context)}
    ), {sections: ensureArray(queued && queued.sections).length, options: ensureArray(queued && queued.options).length});
  }

  function enrichFieldPresentation(body, projectIndex, options) {
    const presentation = fieldPresentationApi();
    return presentation && typeof presentation.enrichEventBody === 'function'
      ? presentation.enrichEventBody(body, projectIndex, options || {})
      : body;
  }

  function routeStateForExisting(projectIndex, context) {
    if (!context || String(context.sceneKind || 'event') === 'card') {
      return null;
    }
    const api = routeStateApi();
    if (!api || typeof api.routeStatesForScene !== 'function') {
      return null;
    }
    try {
      return api.routeStatesForScene(projectIndex, context.sceneId || '', {sampleLimit: 6});
    } catch (_err) {
      return null;
    }
  }

  function regroupOptionOwnedText(body) {
    const next = clone(body || {});
    const options = ensureArray(next.options).map((option) => Object.assign({}, option, {
      fields: ensureArray(option && option.fields).slice(),
      resultFields: ensureArray(option && option.resultFields).slice()
    }));
    const consumed = new Set();
    const candidates = ensureArray(next.sections).concat(ensureArray(next.branchSections));
    options.forEach((option) => {
      candidates.forEach((field) => {
        const fieldKey = String(field && (field.id || field.fieldId) || '');
        if (!field || (fieldKey && consumed.has(fieldKey))) {
          return;
        }
        if (isUnavailableTextEditor(field) && optionUnavailableMatches(field, option)) {
          option.fields = uniqueEditors(option.fields.concat([field]));
          option.unavailableText = unavailableTextForOption(option, [field]);
          if (fieldKey) {
            consumed.add(fieldKey);
          }
          return;
        }
        if (isOptionResultEditor(field) && sectionEditorMatchesOption(field, option)) {
          option.resultFields = uniqueEditors(option.resultFields.concat([field]));
          option.fields = uniqueEditors(option.fields.concat([field]));
          if (fieldKey) {
            consumed.add(fieldKey);
          }
        }
      });
    });
    next.options = options;
    next.sections = ensureArray(next.sections).filter((field) => !consumed.has(String(field && (field.id || field.fieldId) || '')));
    next.branchSections = ensureArray(next.branchSections).filter((field) => !consumed.has(String(field && (field.id || field.fieldId) || '')));
    return next;
  }

  function bodyWithQueuedStructurePreviews(body, values) {
    const commands = queuedStructureCommands(values);
    if (!commands.length) {
      return body;
    }
    const next = clone(body || {});
    next.structureActions = ensureArray(next.structureActions).slice();
    commands.forEach((command, index) => {
      const field = queuedStructurePreviewField(next, command, index);
      if (field) {
        next.structureActions.push(field);
      }
    });
    return next;
  }

  function queuedStructureCommands(values) {
    const raw = values && (values.__structureCommands || values.structure_commands || values.structureCommands);
    const rows = Array.isArray(raw) ? raw : parseJsonArray(raw);
    return rows.map((row) => isObject(row) ? row : null).filter(Boolean);
  }

  function parseJsonArray(value) {
    if (typeof value !== 'string' || !value.trim()) {
      return [];
    }
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }

  function queuedStructurePreviewField(body, command, index) {
    const action = normalizeStructureAction(command.action || command.type);
    if (!action) {
      return null;
    }
    const template = structureActionFieldForCommand(body, command, action) || {};
    const id = safeId(command.id || command.fieldId || action + '_' + (index + 1));
    const targetLabel = String(command.targetLabel || template.structureTargetLabel || template.label || '').trim();
    const field = Object.assign({}, template, {
      id,
      fieldId: id,
      original: /^remove_/.test(action) ? 'false' : '',
      value: /^remove_/.test(action) ? 'true' : String(command.value || ''),
      editability: template.editability || 'manual_review',
      status: template.status || editorStatus(template.editability || 'manual_review'),
      transform: 'structure_action',
      structureAction: action,
      optionId: String(command.optionId || template.optionId || ''),
      sectionId: String(command.sectionId || template.sectionId || ''),
      structureTargetLabel: targetLabel,
      inputType: /^remove_/.test(action) ? 'checkbox' : (template.inputType || (action === 'add_option' || action === 'add_branch' ? 'textarea' : 'text')),
      readOnly: true,
      isQueuedStructure: true,
      queuedStructureCommandId: String(command.id || id)
    });
    if (!field.label) {
      field.label = targetLabel || action.replace(/_/g, ' ');
    }
    return field;
  }

  function structureActionFieldForCommand(body, command, action) {
    const fields = ensureArray(body && body.structureActions).filter((field) => String(field && field.transform || '') === 'structure_action' || field && field.structureAction);
    const ownership = ownershipMatchingApi();
    const fieldId = String(command && command.fieldId || '').trim();
    if (fieldId) {
      const direct = fields.find((field) => String(field && field.id || '') === fieldId);
      if (direct) {
        return direct;
      }
    }
    const optionId = safeCompareId(command && command.optionId);
    const sectionId = safeCompareId(command && command.sectionId);
    return fields.find((field) => {
      if (normalizeStructureAction(field && field.structureAction) !== action) {
        return false;
      }
      if (optionId) {
        const optionMatches = ownership && typeof ownership.endpointMatches === 'function'
          ? ownership.endpointMatches(field && field.optionId, command && command.optionId)
          : safeCompareId(field && field.optionId) === optionId;
        if (!optionMatches) {
          return false;
        }
      }
      if (sectionId) {
        const sectionMatches = ownership && typeof ownership.endpointMatches === 'function'
          ? ownership.endpointMatches(field && field.sectionId, command && command.sectionId)
          : safeCompareId(field && field.sectionId) === sectionId;
        if (!sectionMatches) {
          return false;
        }
      }
      return true;
    }) || null;
  }

  function editorStatus(editability) {
    const text = String(editability || '');
    if (text === 'guarded_replace_text' || text === 'guarded_replace_section' || text === 'guarded_apply') {
      return 'guarded';
    }
    if (text === 'manual_review') {
      return 'manual';
    }
    return text ? 'review' : 'read_only';
  }

  function normalizeStructureAction(value) {
    const text = String(value || '').trim();
    if (text === 'add_section') {
      return 'add_branch';
    }
    if (text === 'remove_section') {
      return 'remove_layer';
    }
    if (text === 'remove_trigger_effect' || text === 'remove_option_effect') {
      return 'remove_effect';
    }
    return text;
  }

  function safeCompareId(value) {
    return String(value || '').trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function variableRowsForExisting(context) {
    return ensureArray(context && context.context && context.context.variables).map((variable) => ({
      name: String(variable && variable.name || ''),
      reads: ensureArray(variable && variable.reads).map(sourceRef),
      writes: ensureArray(variable && variable.writes).map(sourceRef),
      definedIn: ensureArray(variable && variable.definedIn).map(sourceRef),
      readCount: Number(variable && variable.readCount || 0),
      writeCount: Number(variable && variable.writeCount || 0),
      tags: ensureArray(variable && variable.tags).map(String),
      status: String(variable && variable.status || 'read_only')
    })).filter((variable) => variable.name);
  }

  function backgroundEffectRowsForExisting(context) {
    return ensureArray(context && context.context && context.context.effects).map((effect) => ({
      variable: String(effect && effect.variable || ''),
      op: String(effect && effect.op || effect.operator || ''),
      value: String(effect && effect.value === undefined || effect && effect.value === null ? '' : effect && effect.value),
      condition: String(effect && effect.condition || ''),
      hook: String(effect && effect.hook || ''),
      syntax: String(effect && effect.syntax || ''),
      expression: String(effect && effect.expression || ''),
      sourceExpression: String(effect && effect.sourceExpression || ''),
      sectionId: String(effect && effect.sectionId || ''),
      source: sourceRef(effect && effect.source || {}),
      status: String(effect && effect.status || 'read_only')
    })).filter((effect) => effect.variable && effect.status !== 'guarded');
  }

  function assetRowsForExisting(context, projectIndex) {
    const assetApi = assetModelApi();
    const rawAssets = ensureArray(context && context.editModel && context.editModel.assets);
    const target = context && context.sceneKind === 'card' ? 'card' : 'event';
    const assetFields = ensureArray(context && context.editModel && context.editModel.fields)
      .filter((field) => String(field && field.role || '') === 'asset_reference' && String(field && field.transform || '') !== 'asset_add_reference');
    const assetAddFields = ensureArray(context && context.editModel && context.editModel.fields)
      .filter((field) => String(field && field.role || '') === 'asset_reference' && String(field && field.transform || '') === 'asset_add_reference');
    const changes = ensureArray(context && context.proposal && context.proposal.changes);
    const pendingAddRefs = pendingAssetAddRefs(assetAddFields, changes, projectIndex);
    const installRequests = ensureArray(context && context.proposal && context.proposal.assetInstallRequests);
    const enrichRows = (rows) => ensureArray(rows)
      .map((row) => enrichExistingAssetRow(row, assetFields, changes, context, projectIndex, target))
      .map((row) => enrichPendingAssetAddRow(row, pendingAddRefs));
    if (assetApi && typeof assetApi.buildAssetRows === 'function') {
      return enrichRows(assetApi.buildAssetRows({
        assetRefs: rawAssets.concat(pendingAddRefs),
        assetInstallRequests: installRequests
      }, {projectIndex, target}));
    }
    if (assetApi && typeof assetApi.normalizeAssetItem === 'function') {
      return enrichRows(rawAssets.concat(pendingAddRefs).map((asset) => assetApi.normalizeAssetItem(asset, {projectIndex})).filter((asset) => asset && asset.path));
    }
    return enrichRows(rawAssets.concat(pendingAddRefs).map((asset) => ({
      id: String(asset && asset.id || asset && asset.path || ''),
      label: String(asset && (asset.label || asset.name || asset.path) || ''),
      path: String(asset && asset.path || ''),
      type: String(asset && asset.type || 'asset'),
      role: String(asset && asset.role || ''),
      status: {key: 'reference_only', label: 'Reference only'},
      previewCapability: {canPreview: false, mediaKind: String(asset && asset.type || 'asset'), url: '', message: 'Reference only'}
    })).filter((asset) => asset.path));
  }

  function pendingAssetAddRefs(assetAddFields, changes, projectIndex) {
    return ensureArray(assetAddFields).map((field) => {
      const change = ensureArray(changes).find((item) => String(item && item.fieldId || '') === String(field && field.id || ''));
      const after = String(change && change.after || '').trim();
      const path = assetPathFromReferenceLine(after);
      if (!path) {
        return null;
      }
      const directive = String(field && field.assetDirective || '').trim();
      const role = String(field && field.assetRole || '').trim();
      const globalSlot = isGlobalAssetAddField(field);
      return {
        id: safeId(['pending_asset_add', field.id, path].join('_')),
        path,
        previewUrl: indexedPreviewUrlForAssetPath(projectIndex, path),
        type: String(field && field.assetType || ''),
        label: fileName(path) || path,
        name: fileName(path) || path,
        role,
        directive,
        source: sourceRef(field && field.source || {}),
        sourceKind: 'pending_asset_add',
        editability: 'guarded_apply',
        confidence: String(field && field.confidence || 'source_anchor'),
        placementId: safeId(['pending_asset_add', field.id].join('_')),
        placementKind: globalSlot ? 'global_slot' : String(field && field.placementKind || ''),
        displayLocation: globalSlot ? 'Global media slot' : String(field && field.displayLocation || ''),
        operationCapability: 'guarded_apply',
        sectionId: globalSlot ? '' : String(field && field.sectionId || ''),
        optionId: globalSlot ? '' : String(field && field.optionId || ''),
        pendingAssetAddFieldId: String(field && field.id || ''),
        pendingAssetAddSourcePath: String(field && (field.sourcePath || field.source && field.source.path) || ''),
        pendingAssetAddDirective: directive
      };
    }).filter(Boolean);
  }

  function indexedPreviewUrlForAssetPath(projectIndex, path) {
    const wanted = sourceReferencePathForAsset(path);
    const wantedFile = fileName(wanted).toLowerCase();
    if (!wanted && !wantedFile) {
      return '';
    }
    const items = ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic.assets && projectIndex.semantic.assets.items);
    const match = items.find((asset) => {
      const candidate = String(asset && (asset.path || asset.previewUrl || asset.url || asset.id) || '').trim();
      const normalized = sourceReferencePathForAsset(candidate);
      return Boolean(
        wanted && normalized && normalized === wanted ||
        wantedFile && fileName(candidate).toLowerCase() === wantedFile
      );
    });
    return String(match && (match.previewUrl || match.url || match.path) || '').trim();
  }

  function assetPathFromReferenceLine(value) {
    const text = String(value || '').trim();
    const directiveMatch = /^[a-z-]+\s*:\s*(.+)$/i.exec(text);
    if (directiveMatch) {
      return directiveMatch[1].trim();
    }
    const markdownMatch = /!\[[^\]]*\]\(([^)]+)\)/.exec(text);
    if (markdownMatch) {
      return markdownMatch[1].trim();
    }
    return '';
  }

  function isGlobalAssetAddField(field) {
    const id = String(field && field.id || '');
    if (id.indexOf('asset_add_flow_') === 0) {
      return false;
    }
    return !String(field && field.sectionId || '').trim() && !String(field && field.optionId || '').trim();
  }

  function enrichPendingAssetAddRow(row, pendingAddRefs) {
    const value = isObject(row) ? Object.assign({}, row) : {};
    if (!value.path || value.rowKind === 'asset_install_request') {
      return value;
    }
    if (String(value.sourceKind || '') !== 'pending_asset_add') {
      return value;
    }
    const pending = ensureArray(pendingAddRefs).find((ref) => {
      const samePath = String(ref && ref.path || '') === String(value.path || value.assetRef && value.assetRef.path || '');
      const sameRole = !ref || !ref.role || String(ref.role || '') === String(value.role || value.assetRef && value.assetRef.role || '');
      const sameDirective = !ref || !ref.directive || String(ref.directive || '') === String(value.directive || value.assetRef && value.assetRef.directive || '');
      return samePath && sameRole && sameDirective;
    });
    if (!pending) {
      return value;
    }
    return Object.assign(value, {
      status: 'pending_addition',
      statusLabel: 'Pending addition',
      pendingAddition: true,
      assetEditFieldId: String(pending.pendingAssetAddFieldId || ''),
      assetEditability: 'guarded_apply',
      assetOriginal: '',
      assetCurrentPath: String(pending.path || value.path || ''),
      source: value.source || sourceRef(pending.source || {}),
      sourcePath: String(pending.pendingAssetAddSourcePath || pending.source && pending.source.path || ''),
      replacementDirective: String(pending.pendingAssetAddDirective || pending.directive || value.directive || ''),
      allowAssetRemoval: false,
      replacementAvailable: false,
      placementKind: pending.placementKind || value.placementKind,
      displayLocation: pending.displayLocation || value.displayLocation,
      operationCapability: pending.operationCapability || value.operationCapability,
      sectionId: pending.sectionId || value.sectionId || '',
      optionId: pending.optionId || value.optionId || '',
      flowAsset: pending.placementKind ? pending.placementKind !== 'global_slot' : value.flowAsset,
      assetRef: Object.assign({}, value.assetRef || {}, {
        path: pending.path || value.path,
        label: pending.label || value.label,
        role: pending.role || value.role || value.assetRef && value.assetRef.role || '',
        directive: pending.directive || value.directive || value.assetRef && value.assetRef.directive || ''
      })
    });
  }

  function enrichExistingAssetRow(row, assetFields, changes, context, projectIndex, target) {
    const value = isObject(row) ? Object.assign({}, row) : {};
    if (!value.path || value.rowKind === 'asset_install_request') {
      return value;
    }
    const field = findAssetReferenceField(value, assetFields);
    const placement = existingAssetPlacementForRow(value, context, projectIndex, target);
    if (!field) {
      return Object.assign(value, placement);
    }
    const change = ensureArray(changes).find((item) => String(item && item.fieldId || '') === String(field.id || ''));
    const replacement = replacementAssetPathFromChange(change, value.path);
    const pendingRemoval = Boolean(change && !String(change.after || '').trim() && change.allowEmptyReplace);
    return Object.assign(value, replacement && !pendingRemoval ? {
      path: replacement,
      label: fileName(replacement) || value.label,
      name: fileName(replacement) || value.name,
      status: 'pending_replacement',
      statusLabel: 'Pending replacement',
      assetRef: Object.assign({}, value.assetRef || {}, {path: replacement, label: fileName(replacement) || value.label})
    } : {}, pendingRemoval ? {
      status: 'pending_removal',
      statusLabel: 'Pending removal',
      pendingRemoval: true
    } : {}, {
      assetEditFieldId: String(field.id || ''),
      assetEditability: String(field.editability || ''),
      assetOriginal: String(field.original || ''),
      assetCurrentPath: String(field.assetPath || value.path || ''),
      source: value.source || sourceRef(field.source || {}),
      sourcePath: String(field.sourcePath || field.source && field.source.path || ''),
      replacementDirective: assetDirectiveForRow(value, field),
      allowAssetRemoval: Boolean(field.allowEmptyReplace),
      replacementAvailable: String(field.editability || '') === 'guarded_replace_text'
    }, placement);
  }

  function existingAssetPlacementForRow(row, context, projectIndex, target) {
    const source = sourceRef(row && row.source || {});
    const directive = String(row && row.directive || '').trim();
    const textBlocks = ensureArray(context && context.editModel && context.editModel.textBlocks);
    const optionRows = ensureArray(context && context.relationships && context.relationships.options);
    const scene = resolveProjectScene(projectIndex, context && context.sceneId);
    const section = sectionForSource(scene, source);
    const option = optionForAssetSource(optionRows, source, section);
    const block = textBlockForAssetSource(textBlocks, source, section, option);
    let placementKind = 'global_slot';
    if (block) {
      placementKind = placementKindForBlock(block);
    } else if (option) {
      placementKind = 'option_result_visual';
    } else if (isOpeningInlineAsset(row, directive)) {
      placementKind = 'opening_visual';
    } else if (directive === 'inline-image' || directive === 'inline-asset') {
      placementKind = 'unknown_inline';
    }
    const sectionId = String(block && block.sectionId || option && (option.targetId || option.sectionId) || section && section.id || '').trim();
    const optionId = String(option && option.id || block && block.relatedOptionIds && block.relatedOptionIds[0] || '').trim();
    const displayLocation = assetPlacementDisplayLocation(placementKind, row, block, option, section);
    return {
      placementId: safeId(row && row.placementId || ['asset_placement', placementKind, optionId || sectionId || row && row.role || row && row.path].join('_')),
      placementKind,
      displayLocation,
      operationCapability: String(row && row.editability || '') === 'manual_review' || placementKind === 'unknown_inline' ? 'manual_review' : 'guarded_apply',
      sectionId,
      optionId,
      branchKind: String(block && block.branchKind || ''),
      relatedOptionIds: uniqueStrings([optionId].concat(ensureArray(block && block.relatedOptionIds))).filter(Boolean),
      flowAsset: placementKind !== 'global_slot'
    };
  }

  function resolveProjectScene(projectIndex, sceneId) {
    const id = String(sceneId || '').trim();
    return ensureArray(projectIndex && projectIndex.scenes).find((scene) => String(scene && scene.id || '') === id) || null;
  }

  function sectionForSource(scene, source) {
    if (!source || !source.path || !source.line) {
      return null;
    }
    return ensureArray(scene && scene.sections).find((section) => sourceWithin(source, section && section.sourceSpan || section && section.source || {})) || null;
  }

  function optionForAssetSource(options, source, section) {
    const sourceSectionId = String(section && section.id || '').trim();
    return ensureArray(options).find((option) => {
      if (sourceSectionId && [option && option.targetId, option && option.sectionId].some((id) => endpointTokensEqual(id, sourceSectionId))) {
        return true;
      }
      return sourceWithin(source, option && option.target && option.target.source || {});
    }) || null;
  }

  function textBlockForAssetSource(blocks, source, section, option) {
    return ensureArray(blocks).find((block) => sourceWithin(source, block && block.source || {})) ||
      ensureArray(blocks).find((block) => {
        const blockSection = String(block && block.sectionId || '').trim();
        if (section && blockSection && endpointTokensEqual(blockSection, section.id)) {
          return true;
        }
        if (option) {
          return ensureArray(block && block.relatedOptionIds).some((id) => endpointTokensEqual(id, option.id));
        }
        return false;
      }) ||
      null;
  }

  function placementKindForBlock(block) {
    const role = String(block && block.semanticRole || '');
    const branchKind = String(block && block.branchKind || '');
    if (role === 'option_result_text') {
      return 'option_result_visual';
    }
    if (role === 'conditional_option_result_text' || role === 'conditional_text' || ensureArray(block && block.conditions).length) {
      return 'conditional_visual';
    }
    if (branchKind === 'menu' || ensureArray(block && block.ownedOptionIds).length) {
      return 'menu_visual';
    }
    if (role === 'opening_text') {
      return 'opening_visual';
    }
    return 'section_visual';
  }

  function isOpeningInlineAsset(row, directive) {
    if (directive !== 'inline-image' && directive !== 'inline-asset') {
      return false;
    }
    const source = sourceRef(row && row.source || {});
    return Boolean(source.path && source.line);
  }

  function assetPlacementDisplayLocation(kind, row, block, option, section) {
    if (kind === 'global_slot') {
      return 'Global media slot';
    }
    if (option && option.label) {
      return 'Option: ' + option.label;
    }
    if (block && block.label) {
      return block.label;
    }
    if (section && (section.title || section.id)) {
      return section.title || section.id;
    }
    if (kind === 'opening_visual') {
      return 'Opening visual';
    }
    return row && (row.label || row.path) || 'Inline visual';
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

  function endpointTokensEqual(a, b) {
    return normalizeEndpointToken(a) === normalizeEndpointToken(b);
  }

  function normalizeEndpointToken(value) {
    const text = String(value || '').trim().replace(/^[@#]/, '');
    if (!text) {
      return '';
    }
    return text.includes('.') ? text.split('.').pop() : text;
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

  function findAssetReferenceField(row, assetFields) {
    const directive = assetDirectiveForRow(row, null);
    const path = String(row && row.path || '').trim();
    if (!directive || !path) {
      return null;
    }
    const original = directive + ': ' + path;
    return ensureArray(assetFields).find((field) => {
      const fieldDirective = assetDirectiveForRow(row, field);
      const fieldPath = String(field && field.assetPath || '').trim();
      return fieldDirective === directive && fieldPath === path;
    }) ||
      ensureArray(assetFields).find((field) => String(field && field.original || '').trim() === original) ||
      ensureArray(assetFields).find((field) => {
        const text = String(field && field.original || '').trim();
        return text.startsWith(directive + ':') && text.slice(directive.length + 1).trim() === path;
      }) ||
      null;
  }

  function assetDirectiveForRow(row, field) {
    const api = assetModelApi();
    const normalize = api && typeof api.normalizeAssetDirective === 'function'
      ? api.normalizeAssetDirective
      : (value) => {
        const text = String(value || '').trim().toLowerCase();
        return text === 'face-image' || text === 'card-image' || text === 'set-bg' || text === 'set-music' || text === 'audio' ? text : '';
      };
    const explicit = normalize(row && (row.directive || row.replacementDirective));
    if (explicit) {
      return explicit;
    }
    const original = String(field && field.original || '').trim();
    const match = /^([a-z-]+)\s*:/.exec(original);
    return match ? normalize(match[1]) : '';
  }

  function replacementAssetPathFromChange(change, currentPath) {
    if (!change || !String(change.after || '').trim()) {
      return '';
    }
    const after = String(change.after || '').trim();
    const directiveMatch = /^[a-z-]+\s*:\s*(.+)$/i.exec(after);
    if (directiveMatch) {
      return directiveMatch[1].trim();
    }
    const current = String(currentPath || '').trim();
    const imageMatch = /!\[[^\]]*\]\(([^)]+)\)/.exec(after);
    if (imageMatch) {
      return imageMatch[1].trim();
    }
    if (current && after.includes(current)) {
      return current;
    }
    return '';
  }

  function assetAddFieldsForExisting(context) {
    return ensureArray(context && context.editModel && context.editModel.fields)
      .filter((field) => String(field && field.transform || '') === 'asset_add_reference')
      .map((field) => ({
        id: String(field.id || ''),
        role: String(field.assetRole || ''),
        directive: String(field.assetDirective || ''),
        type: String(field.assetType || ''),
        label: String(field.label || ''),
        placementKind: String(field.placementKind || ''),
        displayLocation: String(field.displayLocation || ''),
        sectionId: String(field.sectionId || ''),
        optionId: String(field.optionId || ''),
        source: sourceRef(field.source || {}),
        anchorText: String(field.anchorText || field.source && field.source.anchorText || ''),
        status: editorStatus(field.editability || '')
      }))
      .filter((field) => field.id && field.role && field.directive);
  }

  function assetCatalogForProject(projectIndex, target) {
    const assetApi = assetModelApi();
    if (assetApi && typeof assetApi.buildAssetCatalog === 'function') {
      return assetApi.buildAssetCatalog(projectIndex, {target});
    }
    return ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic.assets && projectIndex.semantic.assets.items).map((asset) => {
      const normalized = assetApi && typeof assetApi.normalizeAssetRef === 'function'
        ? assetApi.normalizeAssetRef(asset)
        : asset;
      const role = assetApi && typeof assetApi.inferAssetRole === 'function'
        ? assetApi.inferAssetRole(normalized, target)
        : '';
      return Object.assign({}, normalized, {role});
    }).filter((asset) => asset && (asset.path || asset.id));
  }

  function sourceReferencePathForAsset(value) {
    const path = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
    return path.replace(/^out\/html\//i, '');
  }

  function fileName(path) {
    const text = String(path || '').replace(/\\/g, '/');
    return text.split('/').filter(Boolean).pop() || '';
  }

  function isPrimaryExistingSection(editor, sceneId) {
    const role = String(editor && editor.semanticRole || '');
    if (!role || role === 'opening_text') {
      return isOpeningEditor(editor, sceneId);
    }
    if (role === 'section_text') {
      return isOpeningEditor(editor, sceneId);
    }
    return false;
  }

  function isOpeningEditor(editor, sceneId) {
    return isOpeningSectionId(sceneId, editor && editor.sectionId);
  }

  function isOpeningSectionId(sceneId, sectionId) {
    const text = String(sectionId || '').trim();
    if (!text) {
      return true;
    }
    const scene = String(sceneId || '').trim();
    const local = scene && text.startsWith(scene + '.') ? text.slice(scene.length + 1) : text;
    return /^(?:start|opening|intro|main)$/i.test(local);
  }

  function effectMatchesOption(editor, option) {
    const api = ownershipMatchingApi();
    return api && typeof api.ownerMatchesOption === 'function'
      ? api.ownerMatchesOption(editor, option)
      : Boolean(
        editor &&
        option &&
        (
          (editor.optionId && String(editor.optionId) === String(option.id || '')) ||
          (editor.sectionId && String(editor.sectionId) === String(option.targetId || '')) ||
          (editor.sectionId && String(editor.sectionId) === String(option.id || ''))
        )
      );
  }

  function optionBodyRows(context, sectionEditors) {
    const editors = context.editors || {};
    const optionEditors = ensureArray(editors.optionText);
    const conditionEditors = ensureArray(editors.conditions).filter(isOptionConditionEditor);
    const routeEditors = ensureArray(editors.routes).filter(isOptionRouteEditor);
    const unavailableEditors = ensureArray(editors.all).filter((editor) => String(editor && editor.role || '') === 'unavailable_text');
    const resultEditors = ensureArray(sectionEditors).filter((editor) => {
      const role = String(editor && editor.semanticRole || '');
      return role === 'option_result_text' || role === 'conditional_option_result_text';
    });
    const options = ensureArray(context.relationships && context.relationships.options);
    if (options.length) {
      return options.map((option, index) => {
        const fields = optionEditors.filter((editor) => optionTextFieldMatchesOption(editor, option));
        if (!fields.length) {
          fields.push.apply(fields, optionEditors.filter((editor) => {
            return !editor.optionId && String(editor.original || '') === String(option.label || '');
          }));
        }
        if (!fields.some(isOptionLabelEditor)) {
          fields.unshift(optionLabelFallbackEditor(option, index));
        }
        const conditionFields = conditionEditors.filter((editor) => optionConditionMatches(editor, option));
        const routeFields = routeEditors.filter((editor) => optionRouteMatches(editor, option));
        const unavailableFields = unavailableEditors.filter((editor) => optionUnavailableMatches(editor, option));
        const resultFields = resultEditors.filter((editor) => sectionEditorMatchesOption(editor, option));
        const allFields = uniqueEditors(fields.concat(conditionFields, routeFields, unavailableFields, resultFields));
        return {
          id: option.id || 'option_' + (index + 1),
          targetId: option.targetId || '',
          rawTargetId: option.rawTargetId || '',
          sectionId: option.sectionId || '',
          sectionLabel: option.sectionLabel || '',
          target: option.target || null,
          chooseIf: option.chooseIf || '',
          sectionViewIf: option.sectionViewIf || '',
          sectionChooseIf: option.sectionChooseIf || '',
          labelSource: option.labelSource || '',
          label: option.label || ('Option ' + (index + 1)),
          subtitle: option.subtitle || '',
          unavailableText: unavailableTextForOption(option, unavailableFields),
          fields: allFields,
          resultFields
        };
      });
    }
    return optionEditors.map((editor, index) => ({
      id: editor.optionId || 'option_' + (index + 1),
      targetId: '',
      label: editor.original || editor.label || ('Option ' + (index + 1)),
      subtitle: '',
      unavailableText: '',
      fields: [editor],
      resultFields: []
    }));
  }

  function optionTextFieldMatchesOption(editor, option) {
    if (!editor || !option) {
      return false;
    }
    const editorOptionId = String(editor.optionId || '').trim();
    if (!editorOptionId) {
      return false;
    }
    const optionIds = [
      option.id,
      option.rawTargetId,
      option.targetId
    ].map((value) => String(value || '').trim()).filter(Boolean);
    const api = ownershipMatchingApi();
    if (api && typeof api.endpointMatches === 'function') {
      return optionIds.some((optionId) => api.endpointMatches(editorOptionId, optionId));
    }
    return optionIds.some((optionId) => normalizeEndpointId(editorOptionId) === normalizeEndpointId(optionId));
  }

  function normalizeEndpointId(value) {
    const text = String(value || '').trim().replace(/^[@#]/, '');
    const parts = text.split('.');
    return parts[parts.length - 1] || text;
  }

  function optionUnavailableMatches(editor, option) {
    if (!editor || !option) {
      return false;
    }
    if (editor.optionId && option.id && String(editor.optionId) === String(option.id)) {
      return true;
    }
    return sectionEditorMatchesOption(editor, option);
  }

  function isOptionConditionEditor(editor) {
    return String(editor && editor.role || '') === 'condition' &&
      String(editor && editor.transform || '') !== 'goto_route_predicate';
  }

  function optionConditionMatches(editor, option) {
    if (!editor || !option) {
      return false;
    }
    if (editor.optionId && optionTextFieldMatchesOption(editor, option)) {
      return true;
    }
    return sectionEditorMatchesOption(editor, option);
  }

  function isOptionRouteEditor(editor) {
    return String(editor && editor.role || '') === 'route';
  }

  function optionRouteMatches(editor, option) {
    if (!editor || !option) {
      return false;
    }
    if (editor.optionId && optionTextFieldMatchesOption(editor, option)) {
      return true;
    }
    return sectionEditorMatchesOption(editor, option);
  }

  function isUnavailableTextEditor(editor) {
    return String(editor && editor.role || '') === 'unavailable_text';
  }

  function isOptionResultEditor(editor) {
    const role = String(editor && editor.semanticRole || '');
    return role === 'option_result_text' || role === 'conditional_option_result_text';
  }

  function unavailableTextForOption(option, fields) {
    const fieldValue = ensureArray(fields)
      .map((field) => String(field && (field.value !== undefined ? field.value : field.original) || '').trim())
      .find(Boolean);
    return fieldValue || String(option && option.unavailableText || '').trim();
  }

  function uniqueEditors(fields) {
    const seen = new Set();
    const out = [];
    ensureArray(fields).forEach((field) => {
      const key = String(field && (field.id || field.fieldId) || '');
      if (key && seen.has(key)) {
        return;
      }
      if (key) {
        seen.add(key);
      }
      out.push(field);
    });
    return out;
  }

  function isOptionLabelEditor(editor) {
    return String(editor && editor.role || '') === 'option_label';
  }

  function optionLabelFallbackEditor(option, index) {
    const label = String(option && (option.label || option.title || option.id) || ('Option ' + (index + 1)));
    const id = 'fallback_option_label_' + safeCompareId(option && (option.id || option.rawTargetId || option.targetId) || ('option_' + (index + 1)));
    return {
      id,
      fieldId: id,
      group: 'option_text',
      role: 'option_label',
      label: 'Player option',
      original: label,
      value: label,
      editability: 'read_only',
      source: sourceRef(option && option.source || {}),
      sectionId: String(option && option.sectionId || ''),
      optionId: String(option && (option.id || option.rawTargetId || option.targetId) || ''),
      status: 'read_only',
      readOnly: true
    };
  }

  function sectionEditorMatchesOption(editor, option) {
    const api = ownershipMatchingApi();
    const editorIds = ensureArray(editor && editor.relatedOptionIds);
    const optionTargets = [
      option && option.id,
      option && option.rawTargetId,
      option && option.targetId
    ];
    if (editorIds.length) {
      return api && typeof api.endpointMatches === 'function'
        ? api.endpointMatches(editorIds, optionTargets)
        : editorIds.some((id) => optionTargets.some((target) => String(id || '') === String(target || '')));
    }
    const editorSection = String(editor && editor.sectionId || '').trim();
    if (!editorSection) {
      return false;
    }
    if (api && typeof api.endpointMatches === 'function' && api.endpointMatches(editorSection, optionTargets)) {
      return true;
    }
    return Boolean(editor && option && optionTargets.some((target) => String(editorSection) === String(target || '')));
  }

  function eventBodyForNewEvent(draft, projectIndex) {
    return {
      mode: 'new_event',
      eventShape: draft.eventShape || (ensureArray(draft.options).length > 1 ? 'choice_event' : ensureArray(draft.options).length === 1 ? 'linear_choice_event' : 'pure_event'),
      title: field('event.title', 'Title', draft.title, 'guarded'),
      subtitle: field('event.subtitle', 'Subtitle', draft.subtitle || '', 'guarded'),
      heading: field('event.heading', 'Heading', draft.heading || draft.title, 'guarded'),
      sections: [
        field('event.intro', 'Opening text', ensureArray(draft.introParagraphs).join('\n\n'), 'guarded')
      ],
      options: ensureArray(draft.options).map((option, index) => ({
        id: option.id || 'option_' + (index + 1),
        targetId: option.gotoAfter || '',
        label: option.label || '',
        subtitle: option.subtitle || '',
        fields: [
          field('option.' + index + '.label', 'Option label', option.label || '', 'guarded'),
          field('option.' + index + '.subtitle', 'Option subtitle', option.subtitle || '', 'guarded'),
          field('option.' + index + '.body', 'Result text', ensureArray(option.narrativeParagraphs).join('\n\n'), 'guarded')
        ]
      })),
      metaFields: [
        field('event.id', 'Event id', draft.id, 'guarded'),
        field('event.eventShape', 'Event type', draft.eventShape || 'choice_event', 'guarded'),
        field('event.tags', 'Tags', ensureArray(draft.tags).join(', '), 'guarded'),
        field('event.newPage', 'New page', draft.newPage === false ? 'false' : 'true', 'guarded'),
        field('event.year', 'Year', draft.when && draft.when.year, 'guarded'),
        field('event.monthStart', 'Month start', draft.when && draft.when.monthStart, 'guarded'),
        field('event.monthEnd', 'Month end', draft.when && draft.when.monthEnd, 'guarded'),
        field('event.requires', 'Condition', draft.when && draft.when.requires, 'guarded'),
        field('event.priority', 'Priority', draft.when && draft.when.priority, 'guarded')
      ],
      assets: assetRowsForDraft(projectIndex, draft, 'event')
    };
  }

  function field(id, label, value, status) {
    const text = value === undefined || value === null ? '' : String(value);
    return {
      id,
      label,
      original: text,
      value: text,
      status: status || 'guarded',
      editability: status || 'guarded',
      source: {}
    };
  }

  function contextBoardFromEditingContext(context) {
    const rows = context.context || {};
    return {
      flow: flowRows(context),
      variables: ensureArray(rows.variables),
      effects: ensureArray(rows.effects),
      assets: ensureArray(rows.assets),
      sourceEvidence: ensureArray(rows.sourceEvidence),
      manualBoundaries: ensureArray(rows.manualBoundaries)
    };
  }

  function contextBoardForNewEvent(projectIndex, draft, seed) {
    const seedRow = seedContextRow(seed);
    return {
      flow: [
        seedRow || {
          label: 'New Event',
          detail: 'Created from Create.',
          direction: 'new'
        },
        {
          label: draft.id || 'new_event',
          detail: 'source/scenes/events/' + (draft.id || 'new_event') + '.scene.dry',
          direction: 'current'
        }
      ].filter(Boolean),
      variables: variablesMentionedByDraft(projectIndex, draft),
      effects: effectRowsForDraft(draft),
      assets: assetRowsForDraft(projectIndex, draft, 'event'),
      sourceEvidence: [
        {label: 'new scene target', path: 'source/scenes/events/' + (draft.id || 'new_event') + '.scene.dry', status: 'draft'}
      ],
      manualBoundaries: [
        {
          label: 'Router wiring',
          reason: 'New events may still need project-specific router review.',
          status: 'manual_review',
          source: {}
        }
      ]
    };
  }

  function assetRowsForDraft(projectIndex, draft, target) {
    const assetApi = assetModelApi();
    if (assetApi && typeof assetApi.buildAssetRows === 'function') {
      return assetApi.buildAssetRows(draft || {}, {projectIndex, target});
    }
    return ensureArray(draft && draft.assetRefs).concat(ensureArray(draft && draft.assetInstallRequests)).map((asset) => ({
      label: asset.label || asset.path || asset.targetPath || asset.sourceName || 'asset',
      path: asset.path || asset.targetPath || asset.sourcePath || '',
      role: asset.role || asset.type || 'asset',
      status: 'draft'
    }));
  }

  function flowRows(context) {
    const relationships = context.relationships || {};
    const incoming = ensureArray(relationships.incoming).map((row) => ({
      label: row.scene && row.scene.title || row.from,
      detail: [row.kind, row.label].filter(Boolean).join(' / '),
      direction: 'incoming',
      source: row.source || {}
    }));
    const current = relationships.current ? [{
      label: relationships.current.title || context.title,
      detail: relationships.current.id || context.sceneId,
      direction: 'current',
      source: relationships.current.source || context.source || {}
    }] : [];
    const internal = ensureArray(relationships.internal).map((row) => ({
      label: row.toEndpoint && row.toEndpoint.title || row.to,
      detail: [row.kind, row.label, row.condition].filter(Boolean).join(' / '),
      direction: 'internal',
      source: row.source || {}
    }));
    const outgoing = ensureArray(relationships.outgoing).map((row) => ({
      label: row.scene && row.scene.title || row.to,
      detail: [row.kind, row.label].filter(Boolean).join(' / '),
      direction: 'outgoing',
      source: row.source || {}
    }));
    return incoming.concat(current, internal, outgoing);
  }

  function normalizeEventInput(input) {
    const value = isObject(input) ? input : {};
    const id = safeId(value.id || value.rawId || 'new_world_event');
    const when = isObject(value.when) ? value.when : value;
    const options = ensureArray(value.options);
    return {
      schemaVersion: '0.1',
      kind: 'world_event',
      id,
      title: String(value.title || value.heading || 'New World Event').trim(),
      heading: String(value.heading || value.title || 'New World Event').trim(),
      seenFlag: safeId(value.seenFlag || value.rawSeenFlag || id + '_seen'),
      when: {
        year: numberOr(value.year || when.year, 1936),
        monthStart: numberOr(value.monthStart || when.monthStart, 1),
        monthEnd: numberOr(value.monthEnd || when.monthEnd, 3),
        requires: String(value.requires || when.requires || '').trim(),
        priority: numberOr(value.priority || when.priority, 0)
      },
      introParagraphs: normalizeParagraphs(value.introParagraphs || value.intro || value.body || 'Write the opening event text here.'),
      effectsOnTrigger: ensureArray(value.effectsOnTrigger || value.triggerEffects).map(normalizeEffect),
      assetRefs: ensureArray(value.assetRefs),
      assetInstallRequests: ensureArray(value.assetInstallRequests),
      options: normalizeEventOptions(options.length ? options : defaultOptions())
    };
  }

  function normalizeEventOptions(options) {
    return ensureArray(options).map((option, index) => {
      const value = isObject(option) ? option : {};
      const id = safeId(value.id || value.rawId || 'option_' + (index + 1));
      return {
        id,
        label: String(value.label || value.title || 'Choice ' + (index + 1)).trim(),
        subtitle: String(value.subtitle || '').trim(),
        chooseIf: String(value.chooseIf || '').trim(),
        unavailableText: String(value.unavailableText || '').trim(),
        effects: ensureArray(value.effects).map(normalizeEffect),
        narrativeParagraphs: normalizeParagraphs(value.narrativeParagraphs || value.body || value.text || 'Describe the result of this choice.'),
        variants: ensureArray(value.variants),
        gotoAfter: safeId(value.gotoAfter || 'continue_' + id)
      };
    });
  }

  function defaultOptions() {
    return [
      {id: 'option_1', label: 'Take the first path', body: 'The first consequence appears.'},
      {id: 'option_2', label: 'Choose another path', body: 'The second consequence appears.'}
    ];
  }

  function draftFromValues(baseDraft, values) {
    const draft = clone(baseDraft);
    const data = isObject(values) ? values : {};
    if (has(data, 'event.id')) {
      const previousId = draft.id;
      draft.id = safeId(data['event.id'] || draft.id);
      if (!draft.seenFlag || draft.seenFlag === previousId + '_seen') {
        draft.seenFlag = safeId(draft.id + '_seen');
      } else {
        draft.seenFlag = safeId(draft.seenFlag);
      }
    }
    if (has(data, 'event.title')) {
      draft.title = String(data['event.title'] || '').trim();
    }
    if (has(data, 'event.heading')) {
      draft.heading = String(data['event.heading'] || '').trim();
    }
    if (has(data, 'event.intro')) {
      draft.introParagraphs = normalizeParagraphs(data['event.intro']);
    }
    if (has(data, 'event.year')) {
      draft.when.year = numberOr(data['event.year'], draft.when.year);
    }
    if (has(data, 'event.monthStart')) {
      draft.when.monthStart = numberOr(data['event.monthStart'], draft.when.monthStart);
    }
    if (has(data, 'event.monthEnd')) {
      draft.when.monthEnd = numberOr(data['event.monthEnd'], draft.when.monthEnd);
    }
    if (has(data, 'event.requires')) {
      draft.when.requires = String(data['event.requires'] || '').trim();
    }
    if (has(data, 'event.priority')) {
      draft.when.priority = numberOr(data['event.priority'], draft.when.priority);
    }
    draft.options = ensureArray(draft.options).map((option, index) => {
      const next = clone(option);
      if (has(data, 'option.' + index + '.label')) {
        next.label = String(data['option.' + index + '.label'] || '').trim();
      }
      if (has(data, 'option.' + index + '.subtitle')) {
        next.subtitle = String(data['option.' + index + '.subtitle'] || '').trim();
      }
      if (has(data, 'option.' + index + '.body')) {
        next.narrativeParagraphs = normalizeParagraphs(data['option.' + index + '.body']);
      }
      return next;
    });
    if (!draft.heading) {
      draft.heading = draft.title;
    }
    if (!draft.seenFlag) {
      draft.seenFlag = safeId(draft.id + '_seen');
    }
    return draft;
  }

  function normalizeEventOutput(bundle, draft) {
    const value = isObject(bundle) ? bundle : {};
    return {
      ok: value.ok !== false,
      draft: value.draft || draft,
      fileName: draft.id + '.scene.dry',
      playerPreview: playerPreviewText(draft),
      previewText: playerPreviewText(draft),
      sceneDry: value.scene || value.sceneDry || '',
      scene: value.scene || value.sceneDry || '',
      draftJson: value.draftJson || JSON.stringify(draft, null, 2) + '\n',
      rootInitSnippet: value.rootSnippet || value.rootInitSnippet || '',
      migrationSnippet: value.migrationSnippet || '',
      installPlan: value.installPlan || null,
      installPlanJson: value.installPlanJson || '',
      patchPreview: value.patchPreview || '',
      installNotes: value.installNotes || '',
      installChecklist: value.installChecklist || ''
    };
  }

  function fallbackEventOutput(draft) {
    const preview = playerPreviewText(draft);
    return {
      ok: true,
      draft,
      fileName: draft.id + '.scene.dry',
      playerPreview: preview,
      previewText: preview,
      sceneDry: '',
      scene: '',
      draftJson: JSON.stringify(draft, null, 2) + '\n',
      installPlan: null,
      installPlanJson: '',
      patchPreview: ''
    };
  }

  function playerPreviewText(draft) {
    const lines = [
      draft.title || draft.heading || draft.id || 'New Event',
      '',
      draft.heading || draft.title || '',
      ''
    ];
    ensureArray(draft.introParagraphs).forEach((paragraph) => lines.push(paragraph, ''));
    ensureArray(draft.options).forEach((option) => {
      lines.push('- ' + (option.label || option.id || 'Option'));
      if (option.subtitle) {
        lines.push('  ' + option.subtitle);
      }
    });
    return lines.join('\n').replace(/\n+$/, '\n');
  }

  function variablesMentionedByDraft(projectIndex, draft) {
    const names = new Set();
    effectRowsForDraft(draft).forEach((effect) => names.add(effect.variable));
    const existing = new Map();
    ensureArray(projectIndex && projectIndex.variables).forEach((variable) => {
      if (variable && variable.name) {
        existing.set(String(variable.name), variable);
      }
    });
    return Array.from(names).map((name) => {
      const variable = existing.get(name) || {};
      return {
        name,
        reads: ensureArray(variable.reads),
        writes: ensureArray(variable.writes),
        readCount: Number(variable.readCount || 0),
        writeCount: Number(variable.writeCount || 0),
        tags: ensureArray(variable.tags).map(String),
        status: existing.has(name) ? 'referenced' : 'new_or_missing'
      };
    });
  }

  function effectRowsForDraft(draft) {
    return Array.prototype.concat.apply(ensureArray(draft.effectsOnTrigger), ensureArray(draft.options).map((option) => ensureArray(option.effects)))
      .map((effect) => ({
        variable: String(effect.variable || ''),
        op: String(effect.op || ''),
        value: String(effect.value === undefined || effect.value === null ? '' : effect.value),
        source: {},
        status: 'draft'
      }))
      .filter((effect) => effect.variable);
  }

  function seedContextRow(seed) {
    const value = isObject(seed) ? seed : {};
    const raw = value.raw || value.item || value.scene || value;
    if (!isObject(raw)) {
      return null;
    }
    const title = raw.title || raw.name || raw.sceneId || raw.id || value.title;
    const detail = raw.source && raw.source.path || raw.path || raw.sceneId || raw.id || '';
    return title ? {label: String(title), detail: String(detail), direction: 'seed', source: raw.source || raw.sourceSpan || {}} : null;
  }

  function normalizeEffect(effect) {
    const value = isObject(effect) ? effect : {};
    return {
      variable: String(value.variable || '').trim(),
      op: String(value.op || '').trim(),
      value: value.value
    };
  }

  function normalizeParagraphs(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    return String(value || '').split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  }

  function operationSummary(plan) {
    const api = installPlanApi();
    if (api && typeof api.operationSummary === 'function') {
      return api.operationSummary(plan || {operations: []});
    }
    return {safeApply: 0, guardedApply: 0, advancedApply: 0, manualReview: 0, refused: 0, total: 0};
  }

  function changedCountFromValues(values) {
    if (!isObject(values)) {
      return 0;
    }
    return Object.keys(values).reduce((count, key) => {
      if (key === '__structureCommands' || key === 'structure_commands' || key === 'structureCommands') {
        const rows = Array.isArray(values[key]) ? values[key] : [];
        return count + rows.length;
      }
      return count + 1;
    }, 0);
  }

  function emptyCanvas(mode, extraDiagnostic, rawContext) {
    return {
      schemaVersion: OBJECT_AUTHORING_CANVAS_VERSION,
      kind: MODEL_KIND,
      ok: false,
      mode: mode || 'unknown',
      objectKind: 'event',
      objectId: '',
      title: '',
      source: {},
      entry: entryInfo(null),
      contextBoard: {flow: [], variables: [], effects: [], assets: [], sourceEvidence: [], manualBoundaries: []},
      eventBody: {mode: mode || 'unknown', title: null, sections: [], options: [], metaFields: []},
      changeState: {
        draft: null,
        proposal: null,
        output: {},
        installPlan: null,
        operationSummary: operationSummary(null),
        changedCount: 0,
        diagnostics: extraDiagnostic ? [extraDiagnostic] : [],
        warnings: []
      },
      legacy: {},
      rawContext: rawContext || null
    };
  }

  function entryInfo(entry) {
    const value = isObject(entry) ? entry : {};
    return {
      source: String(value.source || ''),
      action: String(value.action || ''),
      label: String(value.label || '')
    };
  }

  function sourceRef(ref) {
    const value = isObject(ref) ? ref : {};
    const line = numberOrNull(value.line || value.startLine);
    return {
      path: String(value.path || value.sourcePath || '').trim(),
      line,
      startLine: line,
      endLine: numberOrNull(value.endLine || value.line || value.startLine),
      anchorText: String(value.anchorText || '').trim(),
      endAnchorText: String(value.endAnchorText || '').trim()
    };
  }

  function normalizeDiagnostics(items) {
    return ensureArray(items).map((item) => {
      if (!isObject(item)) {
        return diagnostic('info', 'object_canvas.note', String(item || ''));
      }
      return Object.assign({
        severity: item.severity || item.level || 'info',
        code: item.code || 'object_canvas.note',
        message: item.message || ''
      }, item);
    });
  }

  function diagnostic(severity, code, message) {
    return {severity, level: severity, code, message, confidence: 'static_inferred'};
  }

  function safeId(value) {
    const text = String(value || '').trim()
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return /^[A-Za-z_]/.test(text) ? text : 'event_' + (text || 'draft');
  }

  function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function numberOrNull(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
  }

  function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function perfApi() {
    if (global && global.ProjectMapCardBoardPerf) {
      return global.ProjectMapCardBoardPerf;
    }
    if (typeof require === 'function') {
      try {
        return require('../viewer/card_board_perf.js');
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

  const api = {
    OBJECT_AUTHORING_CANVAS_VERSION,
    MODEL_KIND,
    buildCanvasModel,
    buildExistingCanvas,
    buildTemplateCanvas,
    buildNewEventCanvas,
    defaultDraftForTemplate,
    templateFromDraft,
    normalizeEventInput,
    draftFromValues
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectAuthoringCanvasModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
