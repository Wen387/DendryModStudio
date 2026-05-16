(function initProjectMapVisibleObjectCoverage(global) {
  'use strict';

  const COVERAGE_VERSION = '0.2';
  const REPORT_KIND = 'visible_object_coverage_report';
  const SAFE_INSTALL = new Set(['guarded_apply', 'safe_apply']);
  const APPLY_INSTALL = new Set(['safe_apply', 'guarded_apply', 'advanced_apply']);
  const CLICK_ACTIONS = new Set([
    'open_object_field',
    'open_object_section',
    'open_source_slice',
    'open_variable_editor',
    'open_system_ui_editor',
    'open_linked_event',
    'open_advanced_source_patch'
  ]);
  const ROUTED_MANUAL = new Set(['manual_review']);
  const PROTECTED_PATHS = new Set([
    'source/scenes/root.scene.dry',
    'source/scenes/post_event.scene.dry',
    'source/scenes/post_event_news.scene.dry'
  ]);

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function editCapabilityApi() {
    if (global && global.ProjectMapEditCapability) {
      return global.ProjectMapEditCapability;
    }
    if (typeof require === 'function') {
      try {
        return require('./edit_capability_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function existingSceneEditApi() {
    if (global && global.ProjectMapExistingSceneEdit) {
      return global.ProjectMapExistingSceneEdit;
    }
    if (typeof require === 'function') {
      try {
        return require('./existing_scene_edit_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function buildCoverageReport(projectIndex, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    const capabilityApi = opts.editCapabilityApi || editCapabilityApi();
    const capabilityOptions = {
      lookup: capabilityApi && typeof capabilityApi.buildLookup === 'function'
        ? capabilityApi.buildLookup(index)
        : null,
      existingModelCache: new Map()
    };
    const rows = [];
    const semantic = isObject(index.semantic) ? index.semantic : {};
    const news = isObject(semantic.news) ? semantic.news : {};

    ensureArray(semantic.events).forEach((item) => {
      rows.push(rowFromCapability(index, capabilityApi, 'events', item, {
        area: 'story',
        objectType: 'event',
        label: item && (item.title || item.id) || '',
        role: 'object',
        safeEligible: true,
        previewEligible: true
      }, capabilityOptions));
    });

    ensureArray(semantic.cards).forEach((item) => {
      rows.push(rowFromCapability(index, capabilityApi, 'cards', item, {
        area: 'cards',
        objectType: 'card',
        label: item && (item.title || item.id) || '',
        role: 'object',
        safeEligible: true,
        previewEligible: true
      }, capabilityOptions));
    });

    ensureArray(news.items).forEach((item) => {
      rows.push(rowFromCapability(index, capabilityApi, 'news', item, {
        area: 'news',
        objectType: 'news',
        label: item && (item.headline || item.id) || '',
        role: 'news_item',
        safeEligible: sourceBackedNormalContent(item && item.source),
        previewEligible: true
      }, capabilityOptions));
    });

    ensureArray(news.eventPopups).forEach((item) => {
      rows.push(rowFromCapability(index, capabilityApi, 'news', item, {
        area: 'news',
        objectType: 'monthly_popup',
        label: item && (item.title || item.headline || item.linkedSceneId) || '',
        role: 'monthly_popup',
        safeEligible: sourceBackedNormalContent(item && (item.excerptSource || item.source)),
        previewEligible: true
      }, capabilityOptions));
    });

    ensureArray(semantic.textCorpus && semantic.textCorpus.items).forEach((item) => {
      rows.push(rowFromCapability(index, capabilityApi, 'textCorpus', item, {
        area: areaForTextItem(item),
        objectType: objectTypeForTextItem(item),
        label: item && (item.text || item.id) || '',
        role: item && item.role || 'text',
        safeEligible: safeEligibleTextItem(item),
        previewEligible: previewEligibleTextItem(item)
      }, capabilityOptions));
    });

    ensureArray(semantic.surfaceText && semantic.surfaceText.items).forEach((item) => {
      rows.push(rowFromCapability(index, capabilityApi, 'surfaceText', item, {
        area: 'system_ui',
        objectType: 'surface_text',
        label: item && (item.label || item.id) || '',
        role: 'surface_label',
        safeEligible: true,
        previewEligible: true
      }, capabilityOptions));
    });

    if (opts.includeVariables !== false) {
      ensureArray(index.variables).forEach((item) => {
        rows.push(variableRow(item));
      });
    }

    if (opts.includeStructuredLogic !== false) {
      structuredLogicRows(index).forEach((row) => rows.push(row));
    }

    return {
      schemaVersion: COVERAGE_VERSION,
      kind: REPORT_KIND,
      project: projectSummary(index),
      thresholds: {
        goalW: {safeEditCoverage: 0.7, routeCoverage: 1},
        goalX: {safeEditCoverage: 0.9, routeCoverage: 1}
      },
      rows,
      summary: summarize(rows)
    };
  }

  function buildVisibleEditActionRow(projectIndex, view, item, hints, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    const capabilityApi = opts.editCapabilityApi || editCapabilityApi();
    return rowFromCapability(index, capabilityApi, view, item, Object.assign({
      area: view || '',
      safeEligible: true,
      previewEligible: true
    }, hints || {}), opts);
  }

  function buildVisibleEditAction(projectIndex, view, item, hints, options) {
    const row = buildVisibleEditActionRow(projectIndex, view, item, hints, options);
    return row && row.visibleContent ? row.editAction : null;
  }

  function rowFromCapability(index, capabilityApi, view, item, hints, options) {
    const capability = buildCapability(index, capabilityApi, view, item, options);
    const routeClass = String(capability && capability.routeClass || 'unsupported');
    const installSafety = String(capability && capability.installSafety || '');
    const source = sourceRef(capability && capability.target && capability.target.source || item && (item.source || item.sourceSpan || item.excerptSource) || {});
    const area = String(hints && hints.area || view || '');
    const safeEligible = Boolean(hints && hints.safeEligible);
    const previewEligible = Boolean(hints && hints.previewEligible);
    const visibleContent = isPlayerVisibleContent(view, item, hints, source);
    const editable = isEditableRoute(routeClass, installSafety);
    const canGenerateOperation = editable && hasInstallOperation(capability, routeClass);
    const safeEditable = safeEligible && (SAFE_INSTALL.has(installSafety) || (visibleContent && editable));
    const previewable = previewEligible && isPreviewRoute(routeClass);
    const routed = routeClass !== 'unsupported';
    const manualBoundary = routeClass === 'unsupported' || ROUTED_MANUAL.has(routeClass) || installSafety === 'manual_review' || installSafety === 'refused';
    const visibleDisplayOnly = visibleContent && (!editable || !canGenerateOperation);
    const target = isObject(capability && capability.target) ? capability.target : {};
    const operationTemplate = isObject(capability && capability.operationTemplate) ? capability.operationTemplate : null;
    const editAction = editActionFromCapability({
      view,
      item,
      hints,
      capability,
      routeClass,
      installSafety,
      source,
      target,
      operationTemplate,
      visibleContent,
      editable,
      canGenerateOperation
    });
    return {
      id: stableRowId(view, item),
      view,
      area,
      objectType: String(hints && hints.objectType || view || ''),
      role: String(hints && hints.role || item && item.role || ''),
      label: String(hints && hints.label || item && (item.title || item.headline || item.text || item.label || item.id) || ''),
      routeClass,
      installSafety,
      routeCovered: routed,
      editable,
      editRoute: routeClass,
      canGenerateOperation,
      installOperationType: String(operationTemplate && operationTemplate.type || ''),
      editAction,
      editActionResolvable: !visibleContent || editActionIsResolvable(editAction),
      visibleContent,
      visibleDisplayOnly,
      visibleUnsupported: visibleContent && routeClass === 'unsupported',
      visibleManualReview: visibleContent && (routeClass === 'manual_review' || installSafety === 'manual_review'),
      visibleRefused: visibleContent && installSafety === 'refused',
      safeEditEligible: safeEligible,
      safeEditable,
      previewEligible,
      previewable,
      manualBoundary,
      source,
      reason: String(capability && capability.reason || ''),
      target,
      operationTemplate,
      diagnostics: ensureArray(capability && capability.diagnostics)
    };
  }

  function editActionFromCapability(input) {
    const value = isObject(input) ? input : {};
    if (!value.visibleContent || !value.editable || !value.canGenerateOperation) {
      return null;
    }
    const routeClass = String(value.routeClass || '');
    const target = isObject(value.target) ? value.target : {};
    const item = isObject(value.item) ? value.item : {};
    const hints = isObject(value.hints) ? value.hints : {};
    const owner = isObject(item.owner) ? item.owner : {};
    const source = sourceRef(value.source || target.source || item.source || item.sourceSpan || item.excerptSource || {});
    const sceneId = String(target.sceneId || item.linkedSceneId || owner.sceneId || item.sceneId || item.id || target.itemId || '');
    const actionKind = actionKindForRoute(routeClass, {
      view: value.view,
      item,
      hints,
      target,
      source
    });
    if (!CLICK_ACTIONS.has(actionKind)) {
      return null;
    }
    const targetView = targetViewForAction(actionKind, value.view, target, item, owner, hints);
    const targetId = targetIdForAction(actionKind, sceneId, target, item, owner);
    const fieldId = String(target.fieldId || target.sectionId || owner.sectionId || item.fieldId || (routeClass === 'object_workspace' ? '' : item.id) || '');
    const valueKey = String(target.valueKey || target.fieldId || (fieldId ? (actionKind === 'open_object_section' && fieldId.indexOf('block:') !== 0 ? 'block:' + fieldId : fieldId) : '') || '');
    const semanticEditor = semanticEditorForCapabilityAction(value, actionKind, fieldId, valueKey);
    return {
      schemaVersion: '0.1',
      kind: 'visible_edit_action',
      actionKind,
      routeClass,
      targetView,
      targetId,
      fieldId,
      valueKey,
      source,
      installSafety: String(value.installSafety || ''),
      operationType: String(value.operationTemplate && value.operationTemplate.type || ''),
      operationTemplate: value.operationTemplate || null,
      routeReason: String(value.capability && value.capability.reason || ''),
      target: target,
      semanticEditor,
      visibleContent: true
    };
  }

  function actionKindForRoute(routeClass, context) {
    const route = String(routeClass || '');
    const ctx = isObject(context) ? context : {};
    const item = isObject(ctx.item) ? ctx.item : {};
    const hints = isObject(ctx.hints) ? ctx.hints : {};
    const target = isObject(ctx.target) ? ctx.target : {};
    if (route === 'direct_field_replace') {
      return 'open_object_field';
    }
    if (route === 'direct_section_replace') {
      return 'open_object_section';
    }
    if (route === 'object_workspace') {
      if (String(hints.objectType || '') === 'monthly_popup' || item.linkedSceneId || String(target.view || '') === 'events' && String(ctx.view || '') === 'news') {
        return 'open_linked_event';
      }
      return 'open_object_section';
    }
    if (route === 'system_ui_workspace') {
      return 'open_system_ui_editor';
    }
    if (route === 'variable_workspace') {
      return 'open_variable_editor';
    }
    if (route === 'source_slice_editor') {
      return 'open_source_slice';
    }
    if (route === 'advanced_source_patch' || route === 'news_router_workflow') {
      return 'open_advanced_source_patch';
    }
    return '';
  }

  function targetViewForAction(actionKind, view, target, item, owner, hints) {
    const routeTarget = isObject(target) ? target : {};
    const rowItem = isObject(item) ? item : {};
    const rowOwner = isObject(owner) ? owner : {};
    if (actionKind === 'open_variable_editor') {
      return 'variables';
    }
    if (actionKind === 'open_system_ui_editor') {
      return String(routeTarget.template || routeTarget.workspace || 'system_ui');
    }
    if (actionKind === 'open_linked_event') {
      return 'events';
    }
    if (actionKind === 'open_source_slice' || actionKind === 'open_advanced_source_patch') {
      return 'source_slice';
    }
    if (routeTarget.view) {
      return String(routeTarget.view);
    }
    if (String(hints && hints.objectType || '') === 'card' || rowOwner.sceneType === 'card') {
      return 'cards';
    }
    if (String(view || '') === 'cards' || String(view || '') === 'events') {
      return String(view || '');
    }
    if (rowItem.linkedSceneId || rowOwner.sceneId) {
      return 'events';
    }
    return String(view || '');
  }

  function targetIdForAction(actionKind, sceneId, target, item, owner) {
    const routeTarget = isObject(target) ? target : {};
    const rowItem = isObject(item) ? item : {};
    const rowOwner = isObject(owner) ? owner : {};
    if (actionKind === 'open_variable_editor') {
      return String(routeTarget.variableName || rowItem.name || sceneId || '');
    }
    if (actionKind === 'open_linked_event') {
      return String(rowItem.linkedSceneId || routeTarget.sceneId || sceneId || '');
    }
    if (actionKind === 'open_system_ui_editor') {
      return String(routeTarget.template || routeTarget.itemId || rowItem.id || sceneId || '');
    }
    if (actionKind === 'open_source_slice' || actionKind === 'open_advanced_source_patch') {
      return String(routeTarget.itemId || rowItem.id || sceneId || routeTarget.sourcePath || '');
    }
    return String(routeTarget.sceneId || rowOwner.sceneId || sceneId || rowItem.id || routeTarget.itemId || '');
  }

  function editActionIsResolvable(action) {
    if (!isObject(action)) {
      return false;
    }
    const kind = String(action.actionKind || '');
    if (!CLICK_ACTIONS.has(kind)) {
      return false;
    }
    if (!APPLY_INSTALL.has(String(action.installSafety || ''))) {
      return false;
    }
    if (kind === 'open_source_slice' || kind === 'open_advanced_source_patch') {
      return Boolean(action.source && action.source.path);
    }
    return Boolean(action.targetView && action.targetId);
  }

  function buildCapability(index, capabilityApi, view, item, options) {
    if (capabilityApi && typeof capabilityApi.buildEditCapability === 'function') {
      try {
        return capabilityApi.buildEditCapability(index, view, item, options || {});
      } catch (err) {
        return unsupportedCapability(item, err && err.message || String(err));
      }
    }
    return unsupportedCapability(item, 'Edit capability model is unavailable.');
  }

  function unsupportedCapability(item, reason) {
    return {
      routeClass: 'unsupported',
      installSafety: 'manual_review',
      reason: reason || 'No edit route is available.',
      target: {source: sourceRef(item && (item.source || item.sourceSpan) || {})},
      diagnostics: [{severity: 'warning', code: 'visible_coverage.unsupported', message: reason || 'No edit route is available.'}]
    };
  }

  function isEditableRoute(routeClass, installSafety) {
    const route = String(routeClass || '');
    return route !== 'unsupported' &&
      route !== 'manual_review' &&
      APPLY_INSTALL.has(String(installSafety || ''));
  }

  function hasInstallOperation(capability, routeClass) {
    const route = String(routeClass || '');
    if (capability && isObject(capability.operationTemplate) && capability.operationTemplate.type && capability.operationTemplate.type !== 'manual_snippet') {
      return true;
    }
    return route === 'direct_field_replace' ||
      route === 'direct_section_replace' ||
      route === 'object_workspace' ||
      route === 'system_ui_workspace' ||
      route === 'variable_workspace' ||
      route === 'source_slice_editor' ||
      route === 'advanced_source_patch' ||
      route === 'news_router_workflow';
  }

  function isPlayerVisibleContent(view, item, hints, source) {
    const objectType = String(hints && hints.objectType || view || '');
    const role = String(hints && hints.role || item && item.role || '');
    if (role === 'script' || role === 'metadata_internal') {
      return false;
    }
    if (objectType === 'variable' || objectType === 'structured_logic') {
      return true;
    }
    if (view === 'events' || view === 'cards' || view === 'news' || view === 'surfaceText') {
      return true;
    }
    if (view === 'textCorpus') {
      return role !== 'script' && Boolean(source && (source.path || item && (item.text || item.label || item.id)));
    }
    return Boolean(hints && hints.previewEligible);
  }

  function variableRow(item) {
    const name = String(item && item.name || '');
    const reads = ensureArray(item && item.reads);
    const writes = ensureArray(item && item.writes);
    const definedIn = ensureArray(item && item.definedIn);
    const existing = Boolean(definedIn.length || writes.length || reads.length);
    const source = sourceRef(definedIn[0] || writes[0] || reads[0] || {});
    return {
      id: 'variable:' + name,
      view: 'variables',
      area: 'variables',
      objectType: 'variable',
      role: 'variable_definition',
      label: name,
      routeClass: 'variable_workspace',
      installSafety: existing ? 'advanced_apply' : 'guarded_apply',
      routeCovered: true,
      editable: true,
      editRoute: 'variable_workspace',
      canGenerateOperation: true,
      installOperationType: existing ? 'replace_text' : 'insert_text',
      editAction: {
        schemaVersion: '0.1',
        kind: 'visible_edit_action',
        actionKind: 'open_variable_editor',
        routeClass: 'variable_workspace',
        targetView: 'variables',
        targetId: name,
        fieldId: 'variables.initialValue',
        valueKey: 'variables.initialValue',
        source,
        installSafety: existing ? 'advanced_apply' : 'guarded_apply',
        operationType: existing ? 'replace_text' : 'insert_text',
        operationTemplate: null,
        routeReason: existing
          ? 'Open the Variable workspace with read/write impact before editing the source-backed definition.'
          : 'Open the Variable workspace to create a guarded source-backed initialization.',
        target: {workspace: 'variables', variableName: name},
        semanticEditor: {
          schemaVersion: '0.1',
          kind: 'variable_provenance',
          role: 'variable_definition',
          variableName: name,
          label: name,
          source,
          installSafety: existing ? 'advanced_apply' : 'guarded_apply'
        },
        visibleContent: true
      },
      editActionResolvable: Boolean(name),
      visibleContent: true,
      visibleDisplayOnly: false,
      visibleUnsupported: false,
      visibleManualReview: false,
      visibleRefused: false,
      safeEditEligible: true,
      safeEditable: true,
      previewEligible: true,
      previewable: true,
      manualBoundary: false,
      source,
      reason: existing
        ? 'Existing variable definitions can be edited through the Variable workspace; reads/writes are shown as impact preview rather than blocking editability.'
        : 'A new variable can be created through the Variable workspace.',
      target: {workspace: 'variables', variableName: name},
      operationTemplate: null,
      diagnostics: []
    };
  }

  function structuredLogicRows(index) {
    const api = existingSceneEditApi();
    if (!api || typeof api.buildEditModel !== 'function') {
      return [];
    }
    const semantic = isObject(index.semantic) ? index.semantic : {};
    const rows = [];
    ensureArray(semantic.events).forEach((item) => {
      appendStructuredRows(rows, index, api, 'events', item, 'story');
    });
    ensureArray(semantic.cards).forEach((item) => {
      appendStructuredRows(rows, index, api, 'cards', item, 'cards');
    });
    return rows;
  }

  function appendStructuredRows(rows, index, api, view, item, area) {
    let model = null;
    try {
      model = api.buildEditModel(index, view, item, {});
    } catch (_err) {
      model = null;
    }
    if (!model || !model.ok) {
      return;
    }
    const routeFieldIds = new Set();
    const effectFieldIds = new Set();
    ensureArray(model.fields).forEach((field) => {
      const role = String(field && field.role || '');
      if (String(field && field.transform || '') === 'structure_action') {
        return;
      }
      if (!['condition', 'metadata', 'route', 'effect'].includes(role)) {
        return;
      }
      const safe = String(field.editability || '') === 'guarded_replace_text';
      if (role === 'route' && field.optionId) {
        routeFieldIds.add(String(field.optionId));
      }
      if (role === 'effect') {
        effectFieldIds.add(effectKeyFromField(field));
      }
      const installSafety = safe ? 'guarded_apply' : safetyForLogicSource(field.source);
      rows.push(structuredLogicRow({
        id: model.sceneId + ':' + field.id,
        sceneId: model.sceneId,
        targetView: view,
        fieldId: field.id,
        valueKey: field.id,
        area,
        objectType: 'structured_logic',
        role: role === 'condition' ? 'condition' : (role === 'route' ? 'route' : (role === 'effect' ? 'effect' : 'metadata')),
        label: field.label || field.id,
        routeClass: safe ? 'direct_field_replace' : sourcePatchRouteFor(field.source),
        installSafety,
        safeEditEligible: true,
        safeEditable: true,
        source: field.source,
        reason: safe
          ? (field.reason || '')
          : 'This visible logic is source-backed but high risk; Studio edits it through a source slice instead of a manual snippet.'
      }));
    });
    ensureArray(model.options).forEach((option) => {
      if (routeFieldIds.has(String(option.id || ''))) {
        return;
      }
      rows.push(structuredLogicRow({
        id: model.sceneId + ':route:' + (option.id || option.targetId),
        sceneId: model.sceneId,
        targetView: view,
        fieldId: 'route:' + (option.id || option.targetId || ''),
        valueKey: 'route:' + (option.id || option.targetId || ''),
        area,
        objectType: 'structured_logic',
        role: 'route',
        label: option.label || option.targetId || option.id,
        routeClass: sourcePatchRouteFor(option.source),
        installSafety: safetyForLogicSource(option.source),
        safeEditEligible: true,
        safeEditable: true,
        source: option.source,
        reason: option.targetId
          ? 'Route target is visible and validated against the object context; editing uses a source-backed route patch.'
          : 'Route target is visible source-backed content; editing uses a source slice patch.'
      }));
    });
    ensureArray(model.effects).forEach((effect, index) => {
      if (effectFieldIds.has(effectKey(effect.source, ['Q.' + String(effect.variable || ''), effect.op, effect.value].filter(Boolean).join(' ')))) {
        return;
      }
      rows.push(structuredLogicRow({
        id: model.sceneId + ':effect:' + index + ':' + (effect.variable || ''),
        sceneId: model.sceneId,
        targetView: view,
        fieldId: 'effect:' + index + ':' + (effect.variable || ''),
        valueKey: 'effect:' + index + ':' + (effect.variable || ''),
        area,
        objectType: 'structured_logic',
        role: 'effect',
        label: [effect.variable, effect.op, effect.value].filter(Boolean).join(' '),
        routeClass: sourcePatchRouteFor(effect.source),
        installSafety: safetyForLogicSource(effect.source),
        safeEditEligible: true,
        safeEditable: true,
        source: effect.source,
        reason: effect.variable
          ? 'Simple Q effect is represented structurally and editable through a source-backed operation.'
          : 'Effect source is visible; Studio edits it through a source slice patch.'
      }));
    });
  }

  function effectKeyFromField(field) {
    return effectKey(field && field.source, field && field.original);
  }

  function effectKey(source, expression) {
    const ref = sourceRef(source || {});
    return [ref.path || '', ref.line || '', ref.endLine || '', String(expression || '').trim()].join(':');
  }

  function safetyForLogicSource(source) {
    const ref = sourceRef(source || {});
    if (PROTECTED_PATHS.has(ref.path) || isGeneratedPath(ref.path)) {
      return 'advanced_apply';
    }
    return 'guarded_apply';
  }

  function sourcePatchRouteFor(source) {
    const ref = sourceRef(source || {});
    if (PROTECTED_PATHS.has(ref.path) || isGeneratedPath(ref.path)) {
      return 'advanced_source_patch';
    }
    return 'source_slice_editor';
  }

  function structuredLogicRow(input) {
    const source = sourceRef(input && input.source || {});
    const routeClass = String(input.routeClass || 'manual_review');
    const installSafety = String(input.installSafety || 'manual_review');
    const editable = isEditableRoute(routeClass, installSafety);
    const operationType = source.endLine && source.line && source.endLine !== source.line ? 'replace_section' : 'replace_text';
    const target = {
      workspace: 'content',
      view: String(input.targetView || ''),
      sceneId: String(input.sceneId || ''),
      fieldId: String(input.fieldId || ''),
      valueKey: String(input.valueKey || input.fieldId || ''),
      source
    };
    const operationTemplate = editable ? {
      type: operationType,
      path: source.path,
      line: source.line || null,
      startLine: source.startLine || source.line || null,
      endLine: source.endLine || source.line || null,
      anchorText: source.anchorText || '',
      endAnchorText: source.endAnchorText || '',
      search: operationType === 'replace_text' ? source.anchorText || String(input.label || '') : '',
      replace: '',
      content: '',
      dedupeSearch: '',
      safety: installSafety,
      description: 'Edit visible structured logic from Studio.'
    } : null;
    const semanticEditor = editable ? semanticEditorForStructuredLogic(input, source, installSafety, operationType) : null;
    const editAction = editable ? {
      schemaVersion: '0.1',
      kind: 'visible_edit_action',
      actionKind: routeClass === 'direct_field_replace'
        ? 'open_object_field'
        : routeClass === 'source_slice_editor'
        ? 'open_source_slice'
        : 'open_advanced_source_patch',
      routeClass,
      targetView: routeClass === 'direct_field_replace' ? String(input.targetView || '') : 'source_slice',
      targetId: routeClass === 'direct_field_replace' ? String(input.sceneId || '') : String(input.id || source.path || ''),
      fieldId: String(input.fieldId || ''),
      valueKey: String(input.valueKey || input.fieldId || ''),
      source,
      installSafety,
      operationType,
      operationTemplate,
      routeReason: String(input.reason || ''),
      target,
      semanticEditor,
      visibleContent: true
    } : null;
    return {
      id: 'logic:' + String(input.id || ''),
      view: 'structuredLogic',
      area: String(input.area || 'story'),
      objectType: String(input.objectType || 'structured_logic'),
      role: String(input.role || 'logic'),
      label: String(input.label || ''),
      routeClass,
      installSafety,
      routeCovered: routeClass !== 'unsupported',
      editable,
      editRoute: routeClass,
      canGenerateOperation: editable,
      installOperationType: editable ? operationType : '',
      editAction,
      editActionResolvable: editActionIsResolvable(editAction),
      visibleContent: true,
      visibleDisplayOnly: !editable,
      visibleUnsupported: routeClass === 'unsupported',
      visibleManualReview: routeClass === 'manual_review' || installSafety === 'manual_review',
      visibleRefused: installSafety === 'refused',
      safeEditEligible: Boolean(input.safeEditEligible),
      safeEditable: Boolean(input.safeEditable),
      previewEligible: true,
      previewable: routeClass !== 'unsupported',
      structuredLogicEligible: true,
      structuredRepresented: routeClass !== 'unsupported',
      manualBoundary: installSafety === 'manual_review' || installSafety === 'refused' || routeClass === 'manual_review',
      source,
      reason: String(input.reason || ''),
      target,
      operationTemplate,
      diagnostics: []
    };
  }

  function semanticEditorForStructuredLogic(input, source, installSafety, operationType) {
    const role = String(input && input.role || '');
    if (role !== 'route' && role !== 'condition' && role !== 'effect') {
      return null;
    }
    const kind = role === 'effect' ? 'effect_clause' : 'route_order';
    return {
      schemaVersion: '0.1',
      kind,
      role,
      sceneId: String(input && input.sceneId || ''),
      targetView: String(input && input.targetView || ''),
      fieldId: String(input && input.fieldId || ''),
      valueKey: String(input && (input.valueKey || input.fieldId) || ''),
      label: String(input && input.label || ''),
      source: sourceRef(source || {}),
      installSafety: String(installSafety || ''),
      operationType: String(operationType || ''),
      editorRoute: kind === 'effect_clause' ? 'effect_clause_editor' : 'route_editor'
    };
  }

  function semanticEditorForCapabilityAction(input, actionKind, fieldId, valueKey) {
    const value = isObject(input) ? input : {};
    const item = isObject(value.item) ? value.item : {};
    const hints = isObject(value.hints) ? value.hints : {};
    const source = sourceRef(value.source || {});
    const role = String(hints.role || item.role || '');
    const objectType = String(hints.objectType || '');
    const routeClass = String(value.routeClass || '');
    if (role === 'route' || role === 'condition' || role === 'effect') {
      return semanticEditorForStructuredLogic({
        role,
        sceneId: item.sceneId || item.owner && item.owner.sceneId || value.target && value.target.sceneId || '',
        targetView: value.view || value.target && value.target.view || '',
        fieldId,
        valueKey,
        label: hints.label || item.label || item.text || item.id || ''
      }, source, value.installSafety, value.operationTemplate && value.operationTemplate.type || '');
    }
    if ((String(actionKind || '') === 'open_advanced_source_patch' || routeClass === 'news_router_workflow') && objectType === 'news' && isProtectedRouterPath(source.path)) {
      return {
        schemaVersion: '0.1',
        kind: 'route_order',
        role: 'router_entry',
        sceneId: String(item.linkedSceneId || item.sceneId || ''),
        targetView: 'news',
        fieldId: String(fieldId || role || 'router_entry'),
        valueKey: String(valueKey || fieldId || role || 'router_entry'),
        label: String(hints.label || item.headline || item.title || item.id || ''),
        source,
        installSafety: String(value.installSafety || ''),
        operationType: String(value.operationTemplate && value.operationTemplate.type || ''),
        editorRoute: 'route_editor'
      };
    }
    return null;
  }

  function semanticEditorEligibleRow(row) {
    const value = isObject(row) ? row : {};
    if (value.objectType === 'variable') {
      return true;
    }
    if (value.view === 'structuredLogic' && (value.role === 'route' || value.role === 'condition' || value.role === 'effect')) {
      return true;
    }
    const action = isObject(value.editAction) ? value.editAction : {};
    return Boolean(action.semanticEditor && action.semanticEditor.kind);
  }

  function semanticEditorIsResolvable(editor) {
    if (!isObject(editor)) {
      return false;
    }
    const kind = String(editor.kind || '');
    if (!kind) {
      return false;
    }
    if (kind === 'variable_provenance') {
      return Boolean(editor.variableName || editor.label);
    }
    const source = sourceRef(editor.source || {});
    return Boolean(source.path || editor.sceneId || editor.fieldId);
  }

  function summarize(rows) {
    const all = ensureArray(rows);
    const routeEligible = all.filter((row) => row.objectType !== 'variable' || row.routeCovered);
    const safeEligible = all.filter((row) => row.safeEditEligible);
    const previewEligible = all.filter((row) => row.previewEligible);
    const byArea = countBy(all, 'area');
    const byRoute = countBy(all, 'routeClass');
    const bySafety = countBy(all, 'installSafety');
    const byType = countBy(all, 'objectType');
    const manualBoundaries = all.filter((row) => row.manualBoundary);
    const unsupported = all.filter((row) => row.routeClass === 'unsupported');
    const visibleRows = all.filter((row) => row.visibleContent);
    const visibleEditable = visibleRows.filter((row) => row.editable && row.canGenerateOperation);
    const visibleDisplayOnly = visibleRows.filter((row) => row.visibleDisplayOnly);
    const visibleUnsupported = visibleRows.filter((row) => row.visibleUnsupported);
    const visibleManualReview = visibleRows.filter((row) => row.visibleManualReview);
    const visibleRefused = visibleRows.filter((row) => row.visibleRefused);
    const visibleEditAction = visibleRows.filter((row) => editActionIsResolvable(row.editAction));
    const visibleEditActionMissing = visibleRows.filter((row) => !row.editAction);
    const visibleEditActionUnresolved = visibleRows.filter((row) => row.editAction && !editActionIsResolvable(row.editAction));
    const semanticEditorEligible = visibleRows.filter(semanticEditorEligibleRow);
    const semanticEditorRows = semanticEditorEligible.filter((row) => semanticEditorIsResolvable(row.editAction && row.editAction.semanticEditor));
    const structuredRouteRows = visibleRows.filter((row) => row.view === 'structuredLogic' && (row.role === 'route' || row.role === 'condition'));
    const structuredRouteEditorRows = structuredRouteRows.filter((row) => row.editAction && row.editAction.semanticEditor && row.editAction.semanticEditor.kind === 'route_order');
    const effectClauseRows = visibleRows.filter((row) => row.view === 'structuredLogic' && row.role === 'effect');
    const effectClauseEditorRows = effectClauseRows.filter((row) => row.editAction && row.editAction.semanticEditor && row.editAction.semanticEditor.kind === 'effect_clause');
    const sourceSliceFallbackRows = visibleRows.filter((row) => {
      const action = row.editAction || {};
      const kind = String(action.actionKind || '');
      return (kind === 'open_source_slice' || kind === 'open_advanced_source_patch') && !semanticEditorIsResolvable(action.semanticEditor);
    });
    const structuredEligible = all.filter((row) => row.structuredLogicEligible);
    const structuredRepresented = structuredEligible.filter((row) => row.structuredRepresented);
    const goalW = goalSummary(all, (row) => row.safeEditEligible && row.area !== 'variables');
    const goalX = goalSummary(all, (row) => row.safeEditEligible);
    goalX.structuredLogicEligible = structuredEligible.length;
    goalX.structuredRepresented = structuredRepresented.length;
    goalX.structuredLogicCoverage = ratio(structuredRepresented.length, structuredEligible.length);
    return {
      total: all.length,
      routeCovered: routeEligible.filter((row) => row.routeCovered).length,
      routeCoverage: ratio(routeEligible.filter((row) => row.routeCovered).length, routeEligible.length),
      safeEditEligible: safeEligible.length,
      safeEditable: safeEligible.filter((row) => row.safeEditable).length,
      safeEditCoverage: ratio(safeEligible.filter((row) => row.safeEditable).length, safeEligible.length),
      previewEligible: previewEligible.length,
      previewable: previewEligible.filter((row) => row.previewable).length,
      previewCoverage: ratio(previewEligible.filter((row) => row.previewable).length, previewEligible.length),
      visibleContent: visibleRows.length,
      visibleEditable: visibleEditable.length,
      visibleEditableCoverage: ratio(visibleEditable.length, visibleRows.length),
      visibleDisplayOnlyCount: visibleDisplayOnly.length,
      visibleUnsupportedCount: visibleUnsupported.length,
      visibleManualReviewCount: visibleManualReview.length,
      visibleRefusedCount: visibleRefused.length,
      visibleEditActionCount: visibleEditAction.length,
      visibleEditActionCoverage: ratio(visibleEditAction.length, visibleRows.length),
      visibleEditActionMissingCount: visibleEditActionMissing.length,
      visibleEditActionUnresolvedCount: visibleEditActionUnresolved.length,
      semanticEditorEligibleCount: semanticEditorEligible.length,
      semanticEditorCount: semanticEditorRows.length,
      semanticEditorCoverage: ratio(semanticEditorRows.length, semanticEditorEligible.length),
      structuredRouteEditorEligibleCount: structuredRouteRows.length,
      structuredRouteEditorCount: structuredRouteEditorRows.length,
      structuredRouteEditorCoverage: ratio(structuredRouteEditorRows.length, structuredRouteRows.length),
      effectClauseEditorEligibleCount: effectClauseRows.length,
      effectClauseEditorCount: effectClauseEditorRows.length,
      effectClauseEditorCoverage: ratio(effectClauseEditorRows.length, effectClauseRows.length),
      sourceSliceFallbackCount: sourceSliceFallbackRows.length,
      manualBoundaryCount: manualBoundaries.length,
      unsupportedCount: unsupported.length,
      structuredLogicEligible: structuredEligible.length,
      structuredRepresented: structuredRepresented.length,
      structuredLogicCoverage: ratio(structuredRepresented.length, structuredEligible.length),
      byArea,
      byRoute,
      bySafety,
      byType,
      goalW,
      goalX
    };
  }

  function goalSummary(rows, predicate) {
    const eligible = ensureArray(rows).filter(predicate);
    const safeEditable = eligible.filter((row) => row.safeEditable);
    const previewable = eligible.filter((row) => row.previewable);
    return {
      eligible: eligible.length,
      safeEditable: safeEditable.length,
      safeEditCoverage: ratio(safeEditable.length, eligible.length),
      previewable: previewable.length,
      previewCoverage: ratio(previewable.length, eligible.length),
      passes70: ratio(safeEditable.length, eligible.length) >= 0.7,
      passes90: ratio(safeEditable.length, eligible.length) >= 0.9
    };
  }

  function countBy(rows, key) {
    return ensureArray(rows).reduce((acc, row) => {
      const value = String(row && row[key] || 'unknown');
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  function ratio(numerator, denominator) {
    if (!denominator) {
      return 1;
    }
    return Number((numerator / denominator).toFixed(4));
  }

  function stableRowId(view, item) {
    return String(view || 'row') + ':' + String(item && (item.id || item.itemId || item.linkedSceneId || item.name || item.text || item.label) || '');
  }

  function areaForTextItem(item) {
    const owner = isObject(item && item.owner) ? item.owner : {};
    const role = String(item && item.role || '');
    const source = sourceRef(item && item.source || {});
    if (role === 'surface_label' || owner.kind === 'surface_text' || isSystemUiPath(source.path)) {
      return 'system_ui';
    }
    if (role.startsWith('news_') || role.startsWith('monthly_popup') || owner.kind === 'news' || owner.kind === 'monthly_popup') {
      return 'news';
    }
    return objectTypeForTextItem(item) === 'card' ? 'cards' : 'story';
  }

  function objectTypeForTextItem(item) {
    const owner = isObject(item && item.owner) ? item.owner : {};
    const role = String(item && item.role || '');
    const sceneType = String(owner.sceneType || '').toLowerCase();
    if (role === 'surface_label' || owner.kind === 'surface_text') {
      return 'surface_text';
    }
    if (role.startsWith('news_') || role.startsWith('monthly_popup') || owner.kind === 'news' || owner.kind === 'monthly_popup') {
      return 'news';
    }
    if (sceneType.includes('card') || sceneType.includes('advisor')) {
      return 'card';
    }
    return 'event_text';
  }

  function safeEligibleTextItem(item) {
    const role = String(item && item.role || '');
    if (role === 'script') {
      return false;
    }
    const source = sourceRef(item && item.source || {});
    if (!sourceBackedNormalContent(source)) {
      return false;
    }
    const owner = isObject(item && item.owner) ? item.owner : {};
    return owner.kind === 'scene' || role.startsWith('news_') || role.startsWith('monthly_popup');
  }

  function previewEligibleTextItem(item) {
    const role = String(item && item.role || '');
    return role !== 'script';
  }

  function sourceBackedNormalContent(source) {
    const ref = sourceRef(source || {});
    return Boolean(ref.path &&
      ref.path.startsWith('source/') &&
      !PROTECTED_PATHS.has(ref.path) &&
      !isGeneratedPath(ref.path));
  }

  function isPreviewRoute(routeClass) {
    const text = String(routeClass || '');
    return text === 'direct_field_replace' ||
      text === 'direct_section_replace' ||
      text === 'object_workspace' ||
      text === 'system_ui_workspace' ||
      text === 'variable_workspace' ||
      text === 'source_slice_editor' ||
      text === 'advanced_source_patch' ||
      text === 'news_router_workflow';
  }

  function isGeneratedPath(path) {
    const rel = normalizePath(path);
    return rel === 'out/game.json' || rel.startsWith('out/html/') || rel.startsWith('out/');
  }

  function isProtectedRouterPath(path) {
    const rel = normalizePath(path);
    return PROTECTED_PATHS.has(rel);
  }

  function isSystemUiPath(path) {
    const rel = normalizePath(path);
    return rel === 'source/info.dry' ||
      rel === 'source/scenes/root.scene.dry' ||
      rel.startsWith('source/scenes/status') ||
      rel.startsWith('source/qdisplays/');
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    const line = numberOrNull(value.line || value.startLine);
    const endLine = numberOrNull(value.endLine || value.line || value.startLine);
    return {
      path: normalizePath(value.path || ''),
      line,
      startLine: line,
      endLine,
      anchorText: String(value.anchorText || ''),
      endAnchorText: String(value.endAnchorText || '')
    };
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function normalizePath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
  }

  function projectSummary(index) {
    const project = isObject(index.project) ? index.project : {};
    return {
      name: String(project.name || project.title || ''),
      root: String(project.root || ''),
      profileIds: ensureArray(project.profileIds).map(String)
    };
  }

  const api = {
    buildCoverageReport,
    buildVisibleEditAction,
    buildVisibleEditActionRow,
    summarize
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapVisibleObjectCoverage = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
