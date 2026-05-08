(function initProjectMapVisibleObjectCoverage(global) {
  'use strict';

  const COVERAGE_VERSION = '0.1';
  const REPORT_KIND = 'visible_object_coverage_report';
  const SAFE_INSTALL = new Set(['guarded_apply', 'safe_apply']);
  const ROUTED_MANUAL = new Set(['manual_review', 'news_router_workflow']);
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
        safeEligible: false,
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

  function rowFromCapability(index, capabilityApi, view, item, hints, options) {
    const capability = buildCapability(index, capabilityApi, view, item, options);
    const routeClass = String(capability && capability.routeClass || 'unsupported');
    const installSafety = String(capability && capability.installSafety || '');
    const source = sourceRef(capability && capability.target && capability.target.source || item && (item.source || item.sourceSpan || item.excerptSource) || {});
    const area = String(hints && hints.area || view || '');
    const safeEligible = Boolean(hints && hints.safeEligible);
    const previewEligible = Boolean(hints && hints.previewEligible);
    const safeEditable = safeEligible && SAFE_INSTALL.has(installSafety);
    const previewable = previewEligible && isPreviewRoute(routeClass);
    const routed = routeClass !== 'unsupported';
    const manualBoundary = routeClass === 'unsupported' || ROUTED_MANUAL.has(routeClass) || installSafety === 'manual_review' || installSafety === 'refused';
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
      safeEditEligible: safeEligible,
      safeEditable,
      previewEligible,
      previewable,
      manualBoundary,
      source,
      reason: String(capability && capability.reason || ''),
      target: isObject(capability && capability.target) ? capability.target : {},
      diagnostics: ensureArray(capability && capability.diagnostics)
    };
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

  function variableRow(item) {
    const name = String(item && item.name || '');
    const reads = ensureArray(item && item.reads);
    const writes = ensureArray(item && item.writes);
    const definedIn = ensureArray(item && item.definedIn);
    return {
      id: 'variable:' + name,
      view: 'variables',
      area: 'variables',
      objectType: 'variable',
      role: 'variable_definition',
      label: name,
      routeClass: 'variable_workspace',
      installSafety: definedIn.length || writes.length || reads.length ? 'manual_review' : 'guarded_apply',
      routeCovered: true,
      safeEditEligible: true,
      safeEditable: !definedIn.length && !writes.length && !reads.length,
      previewEligible: true,
      previewable: true,
      manualBoundary: Boolean(definedIn.length || writes.length || reads.length),
      source: sourceRef(definedIn[0] || writes[0] || reads[0] || {}),
      reason: definedIn.length || writes.length || reads.length
        ? 'Existing variables need consumer review before Studio changes initialization or quality metadata.'
        : 'A new variable can be created through the Variable workspace.',
      target: {workspace: 'variables', variableName: name},
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
      rows.push(structuredLogicRow({
        id: model.sceneId + ':' + field.id,
        area,
        objectType: 'structured_logic',
        role: role === 'condition' ? 'condition' : (role === 'route' ? 'route' : (role === 'effect' ? 'effect' : 'metadata')),
        label: field.label || field.id,
        routeClass: safe ? 'direct_field_replace' : 'manual_review',
        installSafety: safe ? 'guarded_apply' : 'manual_review',
        safeEditEligible: true,
        safeEditable: safe,
        source: field.source,
        reason: field.reason || ''
      }));
    });
    ensureArray(model.options).forEach((option) => {
      if (routeFieldIds.has(String(option.id || ''))) {
        return;
      }
      rows.push(structuredLogicRow({
        id: model.sceneId + ':route:' + (option.id || option.targetId),
        area,
        objectType: 'structured_logic',
        role: 'route',
        label: option.label || option.targetId || option.id,
        routeClass: option.targetId ? 'object_workspace' : 'manual_review',
        installSafety: 'manual_review',
        safeEditEligible: false,
        safeEditable: false,
        source: option.source,
        reason: option.targetId
          ? 'Route target is visible and validated against the object context, but changing existing routes remains review-first.'
          : 'Route target needs manual review.'
      }));
    });
    ensureArray(model.effects).forEach((effect, index) => {
      if (effectFieldIds.has(effectKey(effect.source, ['Q.' + String(effect.variable || ''), effect.op, effect.value].filter(Boolean).join(' ')))) {
        return;
      }
      rows.push(structuredLogicRow({
        id: model.sceneId + ':effect:' + index + ':' + (effect.variable || ''),
        area,
        objectType: 'structured_logic',
        role: 'effect',
        label: [effect.variable, effect.op, effect.value].filter(Boolean).join(' '),
        routeClass: effect.variable ? 'object_workspace' : 'manual_review',
        installSafety: 'manual_review',
        safeEditEligible: false,
        safeEditable: false,
        source: effect.source,
        reason: effect.variable
          ? 'Simple Q effect is represented structurally; editing existing effect source remains manual until Goal X effect operations are guarded.'
          : 'Effect needs manual review.'
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

  function structuredLogicRow(input) {
    const source = sourceRef(input && input.source || {});
    const routeClass = String(input.routeClass || 'manual_review');
    const installSafety = String(input.installSafety || 'manual_review');
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
      safeEditEligible: Boolean(input.safeEditEligible),
      safeEditable: Boolean(input.safeEditable),
      previewEligible: true,
      previewable: routeClass !== 'unsupported',
      structuredLogicEligible: true,
      structuredRepresented: routeClass !== 'unsupported',
      manualBoundary: installSafety === 'manual_review' || installSafety === 'refused' || routeClass === 'manual_review',
      source,
      reason: String(input.reason || ''),
      target: {workspace: 'content', source},
      diagnostics: []
    };
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
    if (role === 'script' || role === 'surface_label') {
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
      text === 'variable_workspace';
  }

  function isGeneratedPath(path) {
    const rel = normalizePath(path);
    return rel === 'out/game.json' || rel.startsWith('out/html/') || rel.startsWith('out/');
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
      endLine
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
    summarize
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapVisibleObjectCoverage = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
