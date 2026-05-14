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
    const context = contextApi.buildContextModel(projectIndex, view, itemOrId, {values: opts.values || {}});
    if (!context || !context.ok) {
      return emptyCanvas('existing', diagnostic('warning', 'object_canvas.existing_unavailable', 'This object cannot be opened in the authoring Canvas yet.'), context);
    }
    const body = eventBodyForExisting(context, projectIndex, opts.values || {});
    const output = context.output || {};
    return {
      schemaVersion: OBJECT_AUTHORING_CANVAS_VERSION,
      kind: MODEL_KIND,
      ok: true,
      mode: 'existing',
      objectKind: context.sceneKind === 'card' ? 'card' : 'event',
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
      eventBody: eventBodyForNewEvent(draft),
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
    const pageSectionEditors = ensureArray(editors.pageSections);
    const metadataEditors = allEditors.filter((editor) => String(editor && editor.role || '') === 'metadata');
    const playerTextEditors = ensureArray(editors.playerText)
      .filter((editor) => String(editor && editor.role || '') !== 'metadata')
      .filter((editor) => !titleEditor || editor.id !== titleEditor.id);
    const optionRows = optionBodyRows(context, pageSectionEditors);
    const consumedSectionIds = new Set();
    optionRows.forEach((option) => {
      ensureArray(option.resultFields).forEach((field) => consumedSectionIds.add(String(field.id || '')));
    });
    const primarySectionEditors = pageSectionEditors.filter((editor) => {
      return !consumedSectionIds.has(String(editor.id || '')) && isPrimaryExistingSection(editor, sceneId);
    });
    const branchSectionEditors = pageSectionEditors.filter((editor) => {
      return !consumedSectionIds.has(String(editor.id || '')) && !isPrimaryExistingSection(editor, sceneId);
    });
    const primaryPlayerTextEditors = playerTextEditors.filter((editor) => isPrimaryExistingSection(editor, sceneId));
    const branchPlayerTextEditors = playerTextEditors.filter((editor) => !isPrimaryExistingSection(editor, sceneId));
    const sectionEditors = primarySectionEditors.concat(primaryPlayerTextEditors);
    const effectEditors = ensureArray(editors.effects);
    const body = {
      mode: 'existing',
      eventShape: optionRows.length ? 'choice_event' : 'pure_event',
      title: titleEditor || {
        id: '',
        label: 'Title',
        value: context.title || context.sceneId || '',
        original: context.title || context.sceneId || '',
        status: 'read_only',
        readOnly: true
      },
      sections: sectionEditors.map((editor, index) => Object.assign({slot: 'section_' + (index + 1)}, editor)),
      branchSections: branchSectionEditors.concat(branchPlayerTextEditors).map((editor, index) => Object.assign({slot: 'branch_' + (index + 1)}, editor)),
      options: optionRows,
      assets: assetRowsForExisting(context, projectIndex),
      assetBaseUrl: String(projectIndex && projectIndex.project && projectIndex.project.assetBaseUrl || ''),
      variables: variableRowsForExisting(context),
      backgroundEffects: backgroundEffectRowsForExisting(context),
      metaFields: metadataEditors.concat(ensureArray(editors.conditions), ensureArray(editors.routes)),
      structureActions: ensureArray(editors.structureActions),
      flow: context.flow || context.editModel && context.editModel.flow || {nodes: [], edges: [], summary: {}},
      effects: effectEditors.filter((editor) => !editor.optionId && !editor.sectionId),
      optionEffects: optionRows.map((option) => ({
        id: option.id,
        label: option.label,
        fields: effectEditors.filter((editor) => effectMatchesOption(editor, option))
      })).filter((group) => group.fields.length)
    };
    const structureApi = eventStructureApi();
    const modeledBody = structureApi && typeof structureApi.fromEditingContext === 'function' && typeof structureApi.toEventBody === 'function'
      ? structureApi.toEventBody(structureApi.fromEditingContext(context, projectIndex, {body}))
      : body;
    return bodyWithQueuedStructurePreviews(modeledBody, values);
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
      editability: 'manual_review',
      status: 'manual',
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
    if (assetApi && typeof assetApi.normalizeAssetItem === 'function') {
      return rawAssets.map((asset) => assetApi.normalizeAssetItem(asset, {projectIndex})).filter((asset) => asset && asset.path);
    }
    return rawAssets.map((asset) => ({
      id: String(asset && asset.id || asset && asset.path || ''),
      label: String(asset && (asset.label || asset.name || asset.path) || ''),
      path: String(asset && asset.path || ''),
      type: String(asset && asset.type || 'asset'),
      role: String(asset && asset.role || ''),
      status: {key: 'reference_only', label: 'Reference only'},
      previewCapability: {canPreview: false, mediaKind: String(asset && asset.type || 'asset'), url: '', message: 'Reference only'}
    })).filter((asset) => asset.path);
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
    const resultEditors = ensureArray(sectionEditors).filter((editor) => {
      const role = String(editor && editor.semanticRole || '');
      return role === 'option_result_text' || role === 'conditional_option_result_text';
    });
    const options = ensureArray(context.relationships && context.relationships.options);
    if (options.length) {
      return options.map((option, index) => {
        const fields = optionEditors.filter((editor) => {
          return editor.optionId && option.id && String(editor.optionId) === String(option.id);
        });
        if (!fields.length) {
          fields.push.apply(fields, optionEditors.filter((editor) => {
            return !editor.optionId && String(editor.original || '') === String(option.label || '');
          }));
        }
        const resultFields = resultEditors.filter((editor) => sectionEditorMatchesOption(editor, option));
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
          fields: fields.concat(resultFields),
          resultFields
        };
      });
    }
    return optionEditors.map((editor, index) => ({
      id: editor.optionId || 'option_' + (index + 1),
      targetId: '',
      label: editor.original || editor.label || ('Option ' + (index + 1)),
      subtitle: '',
      fields: [editor],
      resultFields: []
    }));
  }

  function sectionEditorMatchesOption(editor, option) {
    const api = ownershipMatchingApi();
    const editorIds = ensureArray(editor && editor.relatedOptionIds);
    if (api && typeof api.endpointMatches === 'function' && api.endpointMatches(editorIds, [
      option && option.id,
      option && option.rawTargetId,
      option && option.targetId
    ])) {
      return true;
    }
    return api && typeof api.ownerMatchesOption === 'function'
      ? api.ownerMatchesOption({sectionId: editor && editor.sectionId}, option)
      : Boolean(editor && option && (
        String(editor.sectionId || '') === String(option.targetId || '') ||
        String(editor.sectionId || '') === String(option.id || '')
      ));
  }

  function eventBodyForNewEvent(draft) {
    return {
      mode: 'new_event',
      eventShape: draft.eventShape || (ensureArray(draft.options).length ? 'choice_event' : 'pure_event'),
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
      ]
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
      assets: ensureArray(draft.assetRefs).concat(ensureArray(draft.assetInstallRequests)).map((asset) => ({
        label: asset.label || asset.path || asset.targetPath || asset.sourceName || 'asset',
        path: asset.path || asset.targetPath || asset.sourcePath || '',
        role: asset.role || asset.type || 'asset',
        status: 'draft'
      })),
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
    return ensureArray(options).slice(0, 4).map((option, index) => {
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
