(function initProjectMapObjectFieldPresentationModel(global) {
  'use strict';

  const GROUPS = {
    player_content: {label: 'Player content', zhLabel: '玩家內容'},
    conditions: {label: 'Conditions', zhLabel: '條件'},
    routes: {label: 'Result and route', zhLabel: '結果與路由'},
    state_changes: {label: 'State changes', zhLabel: '狀態變更'},
    assets: {label: 'Assets', zhLabel: '素材'},
    advanced_source: {label: 'Advanced source', zhLabel: '進階來源'}
  };

  function classifyField(field, options) {
    const value = isObject(field) ? field : {};
    const opts = isObject(options) ? options : {};
    const id = stringValue(value.id || value.fieldId);
    const role = stringValue(value.role || opts.role).toLowerCase();
    const semanticRole = stringValue(value.semanticRole || value.branchKind).toLowerCase();
    const label = stringValue(value.label || opts.fallbackLabel || id);
    const action = stringValue(value.structureAction || value.action).toLowerCase();
    const advanced = isAdvancedSourceField(value, role, semanticRole);
    let intent = 'advanced_source';
    let group = 'advanced_source';
    let displayLabel = label || 'Source field';
    let variableMode = '';

    if (advanced) {
      intent = role.indexOf('effect') >= 0 ? 'advanced_state_source' : role.indexOf('route') >= 0 ? 'advanced_route_source' : 'advanced_source';
      group = 'advanced_source';
      displayLabel = role.indexOf('effect') >= 0 ? 'Raw effect source' : role.indexOf('route') >= 0 ? 'Raw route source' : (label || 'Advanced source');
    } else if (isAssetField(value, id, role, semanticRole)) {
      intent = 'asset_reference';
      group = 'assets';
      displayLabel = assetLabel(value, label);
    } else if (isStateChangeField(value, id, role, semanticRole, action)) {
      intent = action === 'add_trigger_effect' ? 'new_trigger_effect' : action === 'add_option_effect' ? 'new_choice_effect' : 'state_effect';
      group = 'state_changes';
      displayLabel = effectLabel(value, label, action);
      variableMode = effectVariableMode(value, id, role, semanticRole, label, action);
    } else if (isRouteField(value, id, role, semanticRole, action)) {
      intent = routeIntent(value, id, role, semanticRole, action);
      group = 'routes';
      displayLabel = routeLabel(value, label, intent);
      variableMode = intent === 'route_predicate' ? 'js_condition' : '';
    } else if (isConditionField(value, id, role, semanticRole, label, action)) {
      intent = conditionIntent(value, id, role, semanticRole);
      group = 'conditions';
      displayLabel = conditionLabel(value, label, intent);
      variableMode = conditionVariableMode(value, id, role, semanticRole);
    } else if (isUnavailableField(value, id, role, semanticRole)) {
      intent = 'unavailable_text';
      group = 'conditions';
      displayLabel = 'Unavailable text';
    } else if (isPlayerTextField(value, id, role, semanticRole, action)) {
      intent = playerTextIntent(value, id, role, semanticRole, action);
      group = 'player_content';
      displayLabel = playerTextLabel(value, label, intent);
    }

    return {
      intent,
      group,
      groupLabel: groupLabel(group),
      groupZhLabel: groupZhLabel(group),
      label: displayLabel,
      sourceLabel: label,
      statusKind: statusKind(value, advanced),
      statusLabel: statusLabel(value, advanced),
      variablePicker: variableMode ? {
        enabled: true,
        mode: variableMode,
        targetFieldId: id
      } : {enabled: false, mode: '', targetFieldId: id},
      routeTargetPicker: (group === 'routes' && intent !== 'route_predicate')
        ? {enabled: true, targetFieldId: id}
        : {enabled: false, targetFieldId: ''}
    };
  }

  function enrichEventBody(body, projectIndex, options) {
    const next = cloneBody(body);
    const opts = isObject(options) ? options : {};
    const candidates = buildVariableCandidates(projectIndex, opts);
    const sceneTargets = buildSceneTargetCandidates(body);
    // Per-build memo for variable-picker searches. enrichField runs once per
    // field and each call re-scans + re-sorts all project variables (3561 on
    // DynamicRepo) for the field's derived query. Most fields share the same
    // query string (or an empty one), so caching searchVariableCandidates rows
    // by (limit, query) collapses thousands of full scans to a handful. Keyed
    // per build and discarded when this returns, so it never goes stale.
    const searchCache = new Map();
    next.variablePickerCandidates = candidates;
    if (opts.routeState) {
      next.routeState = opts.routeState;
      next.routeStateSummaries = routeStateSummaries(opts.routeState);
    } else if (next.routeState && !next.routeStateSummaries) {
      next.routeStateSummaries = routeStateSummaries(next.routeState);
    }
    next.title = enrichField(next.title, candidates, {sceneTargets, searchCache});
    next.subtitle = enrichField(next.subtitle, candidates, {sceneTargets, searchCache});
    next.heading = enrichField(next.heading, candidates, {sceneTargets, searchCache});
    ['sections', 'branchSections', 'metaFields', 'effects', 'sectionEffects', 'backgroundEffects', 'assetAddFields'].forEach((key) => {
      next[key] = ensureArray(next[key]).map((field) => enrichField(field, candidates, {sceneTargets, searchCache}));
    });
    next.options = ensureArray(next.options).map((option) => enrichOption(option, candidates, {sceneTargets, searchCache}));
    next.optionEffects = ensureArray(next.optionEffects).map((group) => Object.assign({}, group, {
      fields: ensureArray(group && group.fields).map((field) => enrichField(field, candidates, {optionId: group && (group.optionId || group.id), sceneTargets, searchCache}))
    }));
    next.structureActions = ensureArray(next.structureActions).map((field) => enrichField(field, candidates, {sceneTargets, searchCache}));
    return next;
  }

  function enrichOption(option, candidates, options) {
    const value = isObject(option) ? option : {};
    const opts = isObject(options) ? options : {};
    return Object.assign({}, value, {
      fields: ensureArray(value.fields).map((field) => enrichField(field, candidates, {optionId: value.id, sceneTargets: opts.sceneTargets, searchCache: opts.searchCache})),
      resultFields: ensureArray(value.resultFields).map((field) => enrichField(field, candidates, {optionId: value.id, sceneTargets: opts.sceneTargets, searchCache: opts.searchCache}))
    });
  }

  function enrichField(field, candidates, options) {
    if (!isObject(field)) {
      return field;
    }
    const opts = isObject(options) ? options : {};
    const presentation = classifyField(field, opts);
    const picker = buildVariablePicker(candidates, field, {presentation, searchCache: opts.searchCache});
    const routeTargetPicker = buildRouteTargetPicker(opts.sceneTargets || [], field, {presentation});
    return Object.assign({}, field, {
      semanticIntent: presentation.intent,
      semanticGroup: presentation.group,
      semanticPresentation: presentation,
      variablePicker: picker,
      routeTargetPicker: routeTargetPicker
    });
  }

  function buildVariablePicker(candidatesOrProjectIndex, field, options) {
    const opts = isObject(options) ? options : {};
    const presentation = opts.presentation || classifyField(field, opts);
    const picker = presentation.variablePicker || {};
    const id = stringValue(picker.targetFieldId || field && (field.id || field.fieldId));
    if (!picker.enabled || !id) {
      return {enabled: false, candidates: []};
    }
    const candidates = Array.isArray(candidatesOrProjectIndex)
      ? candidatesOrProjectIndex
      : buildVariableCandidates(candidatesOrProjectIndex, opts);
    if (!candidates.length) {
      return {enabled: false, candidates: [], reason: 'no_variables'};
    }
    const query = stringValue(opts.query || variableQueryForField(field));
    const search = variableSuggestionsApi();
    const limit = opts.limit || 8;
    // Reuse identical (limit, query) searches within one build. searchCache is
    // supplied by enrichEventBody; absent for ad-hoc/live-UI callers, which then
    // behave exactly as before. candidates is fixed per build and
    // searchVariableCandidates is pure, so cached rows are always valid.
    const cache = opts.searchCache instanceof Map ? opts.searchCache : null;
    const cacheKey = cache ? limit + '\n' + query : null;
    let rows;
    if (cache && cache.has(cacheKey)) {
      rows = cache.get(cacheKey);
    } else {
      rows = search && typeof search.searchVariableCandidates === 'function'
        ? search.searchVariableCandidates(candidates, query, {limit})
        : candidates.slice(0, limit);
      if (cache) {
        cache.set(cacheKey, rows);
      }
    }
    const result = {
      enabled: rows.length > 0,
      mode: picker.mode,
      targetFieldId: id,
      query,
      candidates: rows.map((candidate) => variablePickerCandidate(candidate, picker.mode))
    };
    if (opts.includeSearchCandidates) {
      result.searchCandidates = candidates.map((candidate) => variablePickerCandidate(candidate, picker.mode));
    }
    return result;
  }

  function buildSceneTargetCandidates(body) {
    return ensureArray(body && body.projectSceneTargets).map((target) => ({
      insertValue: String(target && target.id || ''),
      name: String(target && target.id || ''),
      label: String(target && target.title || target && target.id || ''),
      meaning: target && target.title && target.title !== target.id ? String(target.title) : '',
      summary: ensureArray(target && target.tags).join(', '),
      searchText: [target && target.id || '', target && target.title || '', ensureArray(target && target.tags).join(' ')].join(' ')
    })).filter((candidate) => candidate.insertValue);
  }

  function buildRouteTargetPicker(sceneTargets, field, options) {
    const opts = isObject(options) ? options : {};
    const presentation = opts.presentation || classifyField(field, opts);
    const picker = presentation.routeTargetPicker || {};
    if (!picker.enabled || !ensureArray(sceneTargets).length) {
      return {enabled: false, candidates: []};
    }
    return {
      enabled: true,
      targetFieldId: picker.targetFieldId || stringValue(field && (field.id || field.fieldId)),
      candidates: ensureArray(sceneTargets)
    };
  }

  function routeStateSummaries(routeState) {
    return ensureArray(routeState && routeState.states).map((state) => {
      const candidates = ensureArray(state && state.candidates);
      const runtime = state && state.runtimeSemantics || {};
      const collision = runtime && runtime.collisionSummary || {};
      const after = collision && collision.after || {};
      const badges = [];
      if (state && state.routePurpose === 'quality_backed_dynamic_route') {
        badges.push('quality-backed route');
      }
      if (state && state.routePurpose === 'jump_return_target') {
        badges.push('jump return target');
      }
      if (runtime && runtime.possibleRandomization) {
        badges.push('possible random split');
      }
      if (after && Number(after.zeroValidCount || 0) > 0) {
        badges.push('sampled no-valid');
      }
      if (state && state.fallbackCandidate) {
        badges.push('explicit fallback');
      }
      if (state && state.unresolvedTargetCount) {
        badges.push('unresolved target');
      }
      return {
        id: stringValue(state && state.id),
        ownerId: stringValue(state && state.ownerId),
        ownerKind: stringValue(state && state.ownerKind),
        routeField: stringValue(state && state.routeField),
        routePurpose: stringValue(state && state.routePurpose),
        status: stringValue(state && state.status),
        safeEditEligible: Boolean(state && state.safeEditEligible),
        summaryLabel: stringValue(state && (state.summaryLabel || state.routePurpose || state.routeKind)),
        source: sourceRef(state && state.source || {}),
        sourceRaw: stringValue(state && state.sourceRaw),
        badges: uniqueStrings(badges),
        candidates: candidates.map((candidate) => ({
          rawTarget: stringValue(candidate && candidate.rawTarget),
          resolvedTarget: stringValue(candidate && (candidate.resolvedTarget || candidate.target)),
          predicate: stringValue(candidate && candidate.predicate),
          dynamicTarget: Boolean(candidate && candidate.dynamicTarget),
          targetResolved: candidate && candidate.targetResolved !== false,
          isFallback: Boolean(candidate && candidate.isFallback)
        }))
      };
    });
  }

  function routeSummariesForFields(fields, body) {
    const summaries = ensureArray(body && body.routeStateSummaries);
    const sources = ensureArray(fields).map((field) => sourceRef(field && field.source || {})).filter((source) => source.path && source.line);
    if (!summaries.length || !sources.length) {
      return [];
    }
    return summaries.filter((summary) => sources.some((source) => sameSource(source, summary.source))).slice(0, 3);
  }

  function routeSummariesForOption(option, body, fields) {
    const summaries = ensureArray(body && body.routeStateSummaries);
    if (!summaries.length || !option) {
      return [];
    }
    const tokens = endpointTokens([
      option.id,
      option.targetId,
      option.rawTargetId,
      option.sectionId,
      option.gotoAfter,
      option.returnTarget
    ]);
    const sources = ensureArray(fields).map((field) => sourceRef(field && field.source || {})).filter((source) => source.path && source.line);
    return summaries.filter((summary) => {
      if (sources.some((source) => sameSource(source, summary.source))) {
        return true;
      }
      if (tokens.has(endpointToken(summary.ownerId))) {
        return true;
      }
      return ensureArray(summary.candidates).some((candidate) => {
        return tokens.has(endpointToken(candidate.rawTarget)) || tokens.has(endpointToken(candidate.resolvedTarget));
      });
    }).slice(0, 3);
  }

  function buildVariableCandidates(projectIndex, options) {
    const api = variableSuggestionsApi();
    return api && typeof api.buildVariableCandidates === 'function'
      ? api.buildVariableCandidates(projectIndex, options || {})
      : [];
  }

  function variableSuggestionsApi() {
    if (global && global.ProjectMapVariableSuggestions) {
      return global.ProjectMapVariableSuggestions;
    }
    if (typeof require === 'function') {
      try {
        return require('./variable_suggestions.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function variablePickerCandidate(candidate, mode) {
    const api = variableSuggestionsApi();
    const snippet = api && typeof api.variableSnippet === 'function'
      ? api.variableSnippet(candidate)
      : fallbackSnippet(candidate);
    return {
      name: stringValue(candidate && candidate.name),
      label: stringValue(candidate && (candidate.label || candidate.name)),
      meaning: stringValue(candidate && candidate.meaning),
      summary: stringValue(candidate && candidate.summary),
      reason: stringValue(candidate && candidate.reason),
      insertValue: snippetForMode(snippet, candidate, mode),
      searchText: [
        candidate && candidate.name,
        candidate && candidate.meaning,
        candidate && candidate.summary,
        candidate && candidate.reason,
        ensureArray(candidate && candidate.tags).join(' ')
      ].map(stringValue).join(' ').toLowerCase()
    };
  }

  function snippetForMode(snippet, candidate, mode) {
    if (mode === 'effect_variable') {
      return stringValue(snippet && snippet.effectVariable || candidate && candidate.name);
    }
    if (mode === 'js_condition') {
      return stringValue(snippet && snippet.jsCondition || (candidate && candidate.name ? 'Q.' + candidate.name : ''));
    }
    if (mode === 'route_target_quality') {
      return stringValue(candidate && candidate.name);
    }
    return stringValue(snippet && snippet.metadataCondition || candidate && candidate.name);
  }

  function variableQueryForField(field) {
    const variables = ensureArray(field && field.conditionVariables)
      .concat(ensureArray(field && field.inlineConditionVariables))
      .concat(ensureArray(field && field.textVariables))
      .map(stringValue)
      .filter(Boolean);
    if (variables.length) {
      return variables[0];
    }
    const text = stringValue(field && (field.value || field.original));
    const match = text.match(/\bQ\.([A-Za-z_][A-Za-z0-9_]*)\b/) || text.match(/\b([A-Za-z_][A-Za-z0-9_]*)(?:\s*(?:>=|<=|=|>|<|\+=|-=))/);
    return match ? match[1] : '';
  }

  function groupLabel(group) {
    return GROUPS[group] && GROUPS[group].label || GROUPS.advanced_source.label;
  }

  function groupZhLabel(group) {
    return GROUPS[group] && GROUPS[group].zhLabel || GROUPS.advanced_source.zhLabel;
  }

  function isAdvancedSourceField(field, role, semanticRole) {
    const status = stringValue(field && (field.status || field.editability)).toLowerCase();
    return status.indexOf('advanced') >= 0 ||
      semanticRole.indexOf('raw_') >= 0 ||
      role.indexOf('raw') >= 0 ||
      stringValue(field && field.id).toLowerCase().indexOf('raw') >= 0;
  }

  function isAssetField(field, id, role, semanticRole) {
    return role === 'asset_reference' ||
      semanticRole.indexOf('asset') >= 0 ||
      /(?:asset|image|audio|bg|face)/i.test(id) ||
      Boolean(field && (field.assetRole || field.assetDirective || field.assetType));
  }

  function isStateChangeField(_field, id, role, semanticRole, action) {
    return role.indexOf('effect') >= 0 ||
      semanticRole.indexOf('effect') >= 0 ||
      action.indexOf('effect') >= 0 ||
      /\.effect(?:\.|$)/i.test(id) ||
      /^event\.rawOn/i.test(id);
  }

  function isRouteField(_field, id, role, semanticRole, action) {
    return role.indexOf('route') >= 0 ||
      semanticRole.indexOf('route') >= 0 ||
      action.indexOf('route') >= 0 ||
      /(?:goto|route|target|setjump|calls|exitTarget|returnTarget)/i.test(id);
  }

  function isConditionField(_field, id, role, semanticRole, label, action) {
    return role.indexOf('condition') >= 0 ||
      semanticRole.indexOf('condition') >= 0 ||
      action.indexOf('condition') >= 0 ||
      /(?:chooseIf|viewIf|requires|condition)/i.test(id) ||
      /condition|choose if|view if|appearance/i.test(label);
  }

  function isUnavailableField(_field, id, role, semanticRole) {
    return role.indexOf('unavailable') >= 0 ||
      semanticRole.indexOf('unavailable') >= 0 ||
      /unavailable/i.test(id);
  }

  function isPlayerTextField(_field, id, role, semanticRole, action) {
    return action.indexOf('option') >= 0 ||
      role.indexOf('option') >= 0 ||
      role.indexOf('body') >= 0 ||
      role.indexOf('title') >= 0 ||
      role.indexOf('heading') >= 0 ||
      semanticRole.indexOf('text') >= 0 ||
      semanticRole.indexOf('body') >= 0 ||
      semanticRole.indexOf('title') >= 0 ||
      /(?:title|heading|intro|body|label|subtitle|paragraph)/i.test(id);
  }

  function routeIntent(field, id, _role, semanticRole, _action) {
    var routeKind = String(field && field.routeKind || '');
    if (/predicate/i.test(id)) {
      return 'route_predicate';
    }
    if (routeKind === 'setJump' || /setJump|set-jump/i.test(id) || semanticRole.indexOf('jump') >= 0) {
      return 'jump_return_route';
    }
    if (routeKind === 'call' || /\bcalls?\b/i.test(id) || semanticRole.indexOf('call_route') >= 0) {
      return 'call_route';
    }
    if (/rawRoutes/i.test(id) || semanticRole.indexOf('raw_route') >= 0) {
      return 'advanced_route_source';
    }
    return 'route_target';
  }

  function conditionIntent(_field, id, role, semanticRole) {
    if (/chooseIf/i.test(id) || role.indexOf('option') >= 0 || semanticRole.indexOf('option') >= 0) {
      return 'choice_condition';
    }
    if (/requires|viewIf/i.test(id) || semanticRole.indexOf('section') >= 0) {
      return 'appearance_condition';
    }
    return 'condition';
  }

  function conditionVariableMode(_field, id, _role, semanticRole) {
    if (/routePredicate/i.test(id) || semanticRole.indexOf('script') >= 0) {
      return 'js_condition';
    }
    return 'metadata_condition';
  }

  function effectVariableMode(_field, id, _role, semanticRole, label, _action) {
    if (/effectVariable/i.test(id) || /\.effect\.\d+\.variable$/i.test(id) || /(?:^|\.)variable$/i.test(id) || semanticRole.indexOf('effect_variable') >= 0 || /^variable$/i.test(label)) {
      return 'effect_variable';
    }
    return '';
  }

  function playerTextIntent(_field, id, role, semanticRole) {
    if (/option.*label|choice.*label/i.test(id) || role.indexOf('choice-label') >= 0 || semanticRole.indexOf('option_label') >= 0) {
      return 'player_choice_text';
    }
    if (/unavailable/i.test(id)) {
      return 'unavailable_text';
    }
    if (semanticRole.indexOf('option_result') >= 0 || /option.*body|choice.*result/i.test(id)) {
      return 'choice_result_text';
    }
    if (semanticRole.indexOf('conditional') >= 0) {
      return 'conditional_body';
    }
    return 'event_body_text';
  }

  function assetLabel(_field, label) {
    return label || 'Asset reference';
  }

  function effectLabel(_field, label, action) {
    if (action === 'add_trigger_effect') {
      return 'New opening state change';
    }
    if (action === 'add_option_effect') {
      return 'New choice state change';
    }
    return label && !/^effect$/i.test(label) ? label : 'State change';
  }

  function routeLabel(_field, label, intent) {
    if (intent === 'jump_return_route') {
      return 'Return target';
    }
    if (intent === 'call_route') {
      return 'Call scene';
    }
    if (intent === 'route_predicate') {
      return 'Route condition';
    }
    if (intent === 'advanced_route_source') {
      return 'Advanced route source';
    }
    return label && !/^route$/i.test(label) ? label : 'Route target';
  }

  function conditionLabel(_field, label, intent) {
    if (intent === 'choice_condition') {
      return 'Choice availability';
    }
    if (intent === 'appearance_condition') {
      return 'Appearance condition';
    }
    return label && !/^condition$/i.test(label) ? label : 'Condition';
  }

  function playerTextLabel(_field, label, intent) {
    if (intent === 'player_choice_text') {
      return 'Player option';
    }
    if (intent === 'choice_result_text') {
      return 'Option result';
    }
    if (intent === 'conditional_body') {
      return 'Conditional body';
    }
    return label || 'Player text';
  }

  function statusKind(field, advanced) {
    if (field && field.readOnly) {
      return 'read_only';
    }
    if (advanced) {
      return 'advanced';
    }
    const status = stringValue(field && field.status).toLowerCase();
    if (status.indexOf('manual') >= 0 || status.indexOf('refused') >= 0) {
      return 'manual';
    }
    if (status.indexOf('guarded') >= 0 || status.indexOf('source') >= 0) {
      return 'source_backed';
    }
    return 'editable';
  }

  function statusLabel(field, advanced) {
    const kind = statusKind(field, advanced);
    if (kind === 'read_only') {
      return 'Read only';
    }
    if (kind === 'advanced') {
      return 'Advanced source';
    }
    if (kind === 'manual') {
      return 'Manual review';
    }
    if (kind === 'source_backed') {
      return 'Source-backed';
    }
    return 'Editable';
  }

  function cloneBody(body) {
    return isObject(body) ? Object.assign({}, body) : {};
  }

  function fallbackSnippet(candidate) {
    const name = stringValue(candidate && candidate.name);
    return {
      metadataCondition: name ? name + ' = 1' : '',
      jsCondition: name ? 'Q.' + name : '',
      effectVariable: name
    };
  }

  function endpointTokens(values) {
    const out = new Set();
    ensureArray(values).forEach((value) => {
      const token = endpointToken(value);
      if (token) {
        out.add(token);
      }
    });
    return out;
  }

  function endpointToken(value) {
    const text = stringValue(value).replace(/^[#@]/, '').trim();
    if (!text) {
      return '';
    }
    const parts = text.split('.');
    return parts[parts.length - 1].toLowerCase();
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    return {
      path: stringValue(value.path),
      line: Number(value.line || value.startLine || 0) || 0,
      startLine: Number(value.startLine || value.line || 0) || 0,
      endLine: Number(value.endLine || value.line || value.startLine || 0) || 0
    };
  }

  function sameSource(a, b) {
    const left = sourceRef(a);
    const right = sourceRef(b);
    if (!left.path || left.path !== right.path) {
      return false;
    }
    const line = left.line || left.startLine;
    const start = right.startLine || right.line;
    const end = right.endLine || right.line || start;
    return Boolean(line && start && end && line >= start && line <= end);
  }

  function uniqueStrings(values) {
    const seen = new Set();
    const out = [];
    ensureArray(values).forEach((value) => {
      const text = stringValue(value);
      if (text && !seen.has(text)) {
        seen.add(text);
        out.push(text);
      }
    });
    return out;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function stringValue(value) {
    return value === undefined || value === null ? '' : String(value).trim();
  }

  const api = {
    classifyField,
    enrichEventBody,
    buildVariablePicker,
    routeStateSummaries,
    routeSummariesForFields,
    routeSummariesForOption,
    groupLabel,
    groupZhLabel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectFieldPresentationModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
