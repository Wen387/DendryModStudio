// @ts-check
(function initProjectMapRouteStateModel(global) {
  'use strict';

  const ROUTE_STATE_VERSION = '0.1';

  /**
   * @typedef {import('../types/project_map_contracts').ConditionState} ConditionState
   * @typedef {import('../types/project_map_contracts').ProjectIndex} ProjectIndex
   * @typedef {import('../types/project_map_contracts').ProjectIndexScene} ProjectIndexScene
   * @typedef {import('../types/project_map_contracts').RouteStateModel} RouteStateModel
   * @typedef {import('../types/project_map_contracts').RouteState} RouteState
   * @typedef {import('../types/project_map_contracts').SceneRouteState} SceneRouteState
   * @typedef {import('../types/project_map_contracts').PredicateSummary} PredicateSummary
   */

  const api = {
    buildRouteStateModel,
    routeStatesForScene,
    summarizePredicate,
    predicateDependencies,
    conditionStatesForScene
  };

  if (global) {
    global.ProjectMapRouteStateModel = api;
  }

  function predicateConditionApi() {
    if (global && global.ProjectMapPredicateConditionModel) {
      return global.ProjectMapPredicateConditionModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./predicate_condition_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  function routeRuntimeTrialApi() {
    if (global && global.ProjectMapRouteRuntimeTrialModel) {
      return global.ProjectMapRouteRuntimeTrialModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./route_runtime_trial_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function routeRuntimeSemanticsApi() {
    if (global && global.ProjectMapRouteRuntimeSemanticsModel) {
      return global.ProjectMapRouteRuntimeSemanticsModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./route_runtime_semantics_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  /**
   * @param {ProjectIndex|unknown} projectIndex
   * @param {Record<string, unknown>=} options
   * @returns {RouteStateModel}
   */
  function buildRouteStateModel(projectIndex, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    const lookup = buildLookup(index);
    const states = routeStatesForLookup(lookup, '', opts);

    const conditionStates = [];
    lookup.scenes.forEach((scene) => {
      conditionStates.push.apply(conditionStates, conditionStatesForScene(index, scene));
    });

    const diagnostics = diagnosticsForStates(states, conditionStates);
    const summary = summarizeStates(states, conditionStates, diagnostics);
    return {
      schemaVersion: ROUTE_STATE_VERSION,
      kind: 'route_state_model',
      summary,
      states,
      conditionStates: conditionStates.sort(compareConditionStates),
      diagnostics
    };
  }

  /**
   * @param {ProjectIndex|unknown} projectIndex
   * @param {ProjectIndexScene|string|unknown} sceneOrId
   * @param {Record<string, unknown>=} options
   * @returns {SceneRouteState}
   */
  function routeStatesForScene(projectIndex, sceneOrId, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    const lookup = buildLookup(index);
    const scene = resolveScene(lookup, sceneOrId);
    if (!scene) {
      return emptySceneRouteState(sceneOrId);
    }
    const sceneId = String(scene.id || '');
    const states = routeStatesForLookup(lookup, sceneId, opts);
    const conditionStates = conditionStatesForScene(index, scene);
    const diagnostics = diagnosticsForStates(states, conditionStates);
    return {
      schemaVersion: ROUTE_STATE_VERSION,
      kind: 'scene_route_state',
      sceneId,
      title: String(scene.title || scene.id || ''),
      summary: summarizeStates(states, conditionStates, diagnostics),
      states,
      conditionStates: conditionStates.sort(compareConditionStates),
      diagnostics
    };
  }

  /**
   * @param {ProjectIndex|unknown} projectIndex
   * @param {ProjectIndexScene|string|unknown} sceneOrId
   * @returns {ConditionState[]}
   */
  function conditionStatesForScene(projectIndex, sceneOrId) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const lookup = buildLookup(index);
    const scene = resolveScene(lookup, sceneOrId);
    if (!scene) {
      return [];
    }
    const sceneId = String(scene.id || '');
    const rows = [];
    pushConditionState(rows, scene, scene, {
      kind: 'view_if',
      ownerId: sceneId,
      ownerKind: String(scene.type || 'scene'),
      raw: scene.viewIf,
      source: sourceForField(scene, 'viewIf')
    });
    ensureArray(scene.sections).forEach((section) => {
      pushConditionState(rows, scene, section, {
        kind: 'view_if',
        ownerId: String(section.id || sceneId),
        ownerKind: 'section',
        raw: section.viewIf,
        source: sourceForField(section, 'viewIf', scene.path)
      });
      pushConditionState(rows, scene, section, {
        kind: 'choose_if',
        ownerId: String(section.id || sceneId),
        ownerKind: 'section',
        raw: section.chooseIf,
        source: sourceForField(section, 'chooseIf', scene.path)
      });
      ensureArray(section.options).forEach((option) => {
        pushConditionState(rows, scene, option, {
          kind: 'option_choose_if',
          ownerId: String(section.id || sceneId),
          ownerKind: 'option',
          raw: option.chooseIf,
          source: option.sourceSpan || sourceForField(option, 'chooseIf', scene.path),
          optionId: String(option.id || '')
        });
      });
    });
    ensureArray(scene.options).forEach((option) => {
      pushConditionState(rows, scene, option, {
        kind: 'option_choose_if',
        ownerId: sceneId,
        ownerKind: 'option',
        raw: option.chooseIf,
        source: option.sourceSpan || sourceForField(option, 'chooseIf', scene.path),
        optionId: String(option.id || '')
      });
    });
    return rows;
  }

  function routeStatesForLookup(lookup, sceneId, options) {
    const filterSceneId = String(sceneId || '');
    const groupSourceKeys = new Set();
    const states = [];
    lookup.routeOrderGroups.filter((group) => {
      return !filterSceneId || routeStateBelongsToScene({
        sceneId: group && group.sceneId || '',
        ownerId: group && group.ownerId || ''
      }, filterSceneId);
    }).forEach((group) => {
      const state = routeStateFromGroup(group, lookup, options);
      if (state) {
        states.push(state);
        groupSourceKeys.add(sourceKey(state.source) + '|' + state.ownerId + '|' + state.routeField);
      }
    });
    lookup.edges.filter((edge) => {
      return !filterSceneId || routeStateBelongsToScene({
        sceneId: sceneIdForOwner(lookup, edge && edge.from) || '',
        ownerId: edge && edge.from || ''
      }, filterSceneId);
    }).forEach((edge, index) => {
      const key = sourceKey(edge && edge.source) + '|' + String(edge && edge.from || '') + '|' + routeFieldForKind(edge && edge.kind);
      if (groupSourceKeys.has(key)) {
        return;
      }
      const state = routeStateFromEdge(edge, lookup, index + 1, options);
      if (state) {
        states.push(state);
      }
    });
    return states.sort(compareRouteStates);
  }

  function pushConditionState(rows, scene, owner, input) {
    const raw = String(input && input.raw || '').trim();
    if (!raw) {
      return;
    }
    const summary = summarizePredicate(raw);
    rows.push({
      id: stableId('condition_state', scene && scene.id, input.kind, input.ownerId, raw),
      sceneId: String(scene && scene.id || ''),
      ownerId: String(input.ownerId || scene && scene.id || ''),
      ownerKind: String(input.ownerKind || 'scene'),
      optionId: String(input.optionId || owner && owner.id || ''),
      conditionKind: String(input.kind || 'condition'),
      raw,
      summary,
      dependencies: summary.dependencies,
      status: summary.status,
      source: sourceRef(input.source || {})
    });
  }

  function routeStateFromGroup(group, lookup, options) {
    const clauses = ensureArray(group && group.clauses);
    if (!group || !clauses.length) {
      return null;
    }
    const sceneId = String(group.sceneId || sceneIdForOwner(lookup, group.ownerId) || '');
    const routeField = String(group.routeField || '');
    const routeKind = normalizeRouteKind(group.routeKind || routeFieldForKind(routeField));
    const candidates = clauses.map((clause, index) => routeCandidateFromClause(clause, group, lookup, index + 1));
    const predicateSummaries = candidates.map((candidate) => candidate.predicateSummary).filter(Boolean);
    const source = sourceRef(group.source || {});
    return finalizeRouteState({
      id: String(group.id || stableId('route_state_group', sceneId, group.ownerId, routeField, sourceKey(source))),
      sceneId,
      ownerId: String(group.ownerId || sceneId),
      ownerKind: String(group.ownerKind || 'scene'),
      routeField,
      routeKind,
      routePurpose: routePurpose(routeKind, candidates),
      chainContext: String(group.chainContext || (candidates.length > 1 ? 'ordered_chain' : 'predicate_singleton')),
      parserBacked: group.parserBacked !== false,
      confidence: String(group.confidence || 'exact'),
      installSafety: String(group.installSafety || 'manual_review'),
      reviewBoundary: String(group.reviewBoundary || group.installSafety || 'manual_review'),
      source,
      sourceRaw: String(group.sourceRaw || candidates.map((candidate) => candidate.raw || candidate.rawTarget).join('; ')),
      candidates,
      predicateSummaries
    }, lookup, options);
  }

  function routeCandidateFromClause(clause, group, lookup, order) {
    const rawTarget = String(clause && (clause.rawTarget || clause.target || clause.id) || '').trim();
    const resolvedTarget = String(clause && (clause.resolvedTarget || clause.target || '') || '').trim();
    const routeKind = normalizeRouteKind(clause && clause.routeKind || group && group.routeKind || group && group.routeField || '');
    const predicate = String(clause && clause.predicate || '').trim();
    const dynamicTarget = Boolean(clause && clause.dynamicTarget) || resolvedTarget.indexOf('quality_ref:') === 0 || routeKind === 'go_to_ref' || routeKind === 'conditional_go_to_ref';
    const candidate = {
      id: String(clause && clause.id || stableId('route_candidate', group && group.id, order, rawTarget, predicate)),
      order: Number(clause && clause.order || order) || order,
      raw: String(clause && clause.raw || rawTarget),
      rawTarget,
      target: resolvedTarget || rawTarget,
      resolvedTarget: resolvedTarget || rawTarget,
      targetResolved: clause && clause.targetResolved !== false,
      targetKind: targetKind(resolvedTarget || rawTarget, dynamicTarget),
      routeKind,
      routePurpose: routePurpose(routeKind, []),
      predicate,
      predicateSummary: summarizePredicate(predicate),
      isFallback: Boolean(clause && clause.isFallback),
      dynamicTarget,
      targetSource: String(clause && clause.targetSource || (dynamicTarget ? 'quality' : 'scene')),
      confidence: String(clause && clause.confidence || group && group.confidence || 'exact'),
      installSafety: String(clause && clause.installSafety || group && group.installSafety || 'manual_review'),
      source: sourceRef(clause && clause.source || group && group.source || {})
    };
    if (!candidate.targetResolved && !candidate.dynamicTarget && targetResolves(lookup, candidate.resolvedTarget)) {
      candidate.targetResolved = true;
    }
    return candidate;
  }

  function routeStateFromEdge(edge, lookup, order, options) {
    if (!edge || !edge.from) {
      return null;
    }
    const routeKind = normalizeRouteKind(edge.kind || '');
    const sceneId = sceneIdForOwner(lookup, edge.from) || sceneIdForOwner(lookup, edge.to) || '';
    const source = sourceRef(edge.source || {});
    const dynamicTarget = Boolean(edge.dynamicTarget) || String(edge.to || '').indexOf('quality_ref:') === 0 || routeKind.indexOf('go_to_ref') >= 0;
    const targetResolved = !missingTargetForEdge(edge, lookup) || dynamicTarget;
    const predicate = String(edge.condition || edge.predicate || '').trim();
    const candidate = {
      id: stableId('route_candidate_edge', edge.from, edge.to, routeKind, sourceKey(source), order),
      order: 1,
      raw: String(edge.raw || edge.rawTarget || edge.to || ''),
      rawTarget: String(edge.rawTarget || edge.to || ''),
      target: String(edge.to || ''),
      resolvedTarget: String(edge.to || ''),
      targetResolved,
      targetKind: targetKind(edge.to, dynamicTarget),
      routeKind,
      routePurpose: routePurpose(routeKind, []),
      predicate,
      predicateSummary: summarizePredicate(predicate),
      isFallback: false,
      dynamicTarget,
      targetSource: String(edge.targetSource || (dynamicTarget ? 'quality' : routeKind === 'tag_choice' ? 'tag' : 'scene')),
      confidence: String(edge.confidence || 'exact'),
      installSafety: 'manual_review',
      source
    };
    return finalizeRouteState({
      id: stableId('route_state_edge', edge.from, edge.to, routeKind, sourceKey(source), order),
      sceneId,
      ownerId: String(edge.from || ''),
      ownerKind: String(edge.from || '').indexOf('.') >= 0 ? 'section' : 'scene',
      routeField: routeFieldForKind(routeKind),
      routeKind,
      routePurpose: routePurpose(routeKind, [candidate]),
      chainContext: predicate ? 'predicate_singleton' : 'direct',
      parserBacked: edge.parserBacked !== false,
      confidence: String(edge.confidence || 'exact'),
      installSafety: 'manual_review',
      reviewBoundary: 'manual_review',
      source,
      sourceRaw: candidate.raw,
      candidates: [candidate],
      predicateSummaries: predicate ? [candidate.predicateSummary] : []
    }, lookup, options);
  }

  function finalizeRouteState(state, lookup, options) {
    const candidates = ensureArray(state.candidates);
    const dependencies = unique(candidates.flatMap((candidate) => ensureArray(candidate.predicateSummary && candidate.predicateSummary.dependencies)));
    const dynamicTargetCount = candidates.filter((candidate) => candidate.dynamicTarget).length;
    const unresolvedTargetCount = candidates.filter((candidate) => !candidate.targetResolved).length;
    const sourceFallbackCandidate = candidates.find((candidate) => candidate.isFallback) || null;
    const routeTrial = routeRuntimeTrialApi();
    if (!routeTrial) {
      throw new Error('route_runtime_trial_model.js is required before route_state_model.js');
    }
    const routeSemantics = routeRuntimeSemanticsApi();
    if (!routeSemantics) {
      throw new Error('route_runtime_semantics_model.js is required before route_state_model.js');
    }
    const owner = ownerForRoute(lookup, state.ownerId);
    const preRouteScript = routeTrial.preRouteScriptSummary({
      ownerId: state.ownerId,
      raw: owner && owner.onArrival || '',
      effects: preRouteEffectsForOwner(lookup, state.ownerId),
      opaqueBlocks: preRouteOpaqueBlocksForOwner(lookup, state.ownerId),
      dependencies,
      summarizePredicate
    });
    const collisionSummary = routeTrial.routeCollisionSummary(state, candidates, preRouteScript, Object.assign({}, options || {}, {summarizePredicate}));
    const runtimeSemantics = routeTrial.enrichRuntimeSemantics(
      routeSemantics.routeRuntimeSemantics(state, candidates, sourceFallbackCandidate, dynamicTargetCount, unresolvedTargetCount),
      preRouteScript,
      collisionSummary
    );
    const fallbackCandidate = runtimeSemantics.possibleRandomization ? null : sourceFallbackCandidate;
    const safeEditEligible = routeSafeEditEligible(state, candidates, runtimeSemantics, preRouteScript);
    return Object.assign({}, state, {
      candidateCount: candidates.length,
      fallbackCandidate,
      dependencies,
      predicateDependencyCount: dependencies.length,
      dynamicTargetCount,
      unresolvedTargetCount,
      preRouteScript,
      runtimeSemantics,
      safeEditEligible,
      semanticTier: routeSemanticTier(state, candidates, runtimeSemantics, safeEditEligible),
      status: unresolvedTargetCount ? 'needs_review' : runtimeSemantics.possibleRandomization ? 'runtime_ambiguous' : dynamicTargetCount ? 'dynamic' : state.chainContext === 'direct' ? 'direct' : 'reviewable',
      summaryLabel: routeStateLabel(state, candidates, fallbackCandidate)
    });
  }

  function routeSafeEditEligible(state, candidates, runtimeSemantics, preRouteScript) {
    const rows = ensureArray(candidates);
    const collision = runtimeSemantics && runtimeSemantics.collisionSummary || {};
    const hasZeroValid = collision.after && Number(collision.after.zeroValidCount || 0) > 0;
    return Boolean(state && state.parserBacked) &&
      rows.length > 0 &&
      rows.every((candidate) => candidate && candidate.targetResolved && !candidate.dynamicTarget && predicateCanSupportSafeEdit(candidate.predicateSummary)) &&
      runtimeSemantics &&
      !runtimeSemantics.possibleRandomization &&
      !hasZeroValid &&
      preRouteScript &&
      !preRouteScript.opaque;
  }

  function routeSemanticTier(state, candidates, runtimeSemantics, safeEditEligible) {
    if (safeEditEligible) {
      return 'static_exact';
    }
    if (ensureArray(candidates).some((candidate) => candidate && candidate.dynamicTarget && candidate.targetSource === 'quality')) {
      return 'guided_profile';
    }
    if (runtimeSemantics && runtimeSemantics.possibleRandomization) {
      return 'manual_boundary';
    }
    if (state && state.parserBacked && ensureArray(candidates).every((candidate) => candidate && candidate.targetResolved && !candidate.dynamicTarget)) {
      return 'static_exact';
    }
    return 'manual_boundary';
  }

  function predicateCanSupportSafeEdit(summary) {
    const value = summary || {};
    return !value.raw || value.status === 'empty' || value.status === 'parsed';
  }

  function ownerForRoute(lookup, ownerId) {
    const id = String(ownerId || '');
    if (!lookup || !id) {
      return null;
    }
    if (lookup.ownersById && lookup.ownersById.has(id)) {
      return lookup.ownersById.get(id);
    }
    const sceneId = sceneIdForOwner(lookup, id);
    return sceneId && lookup.scenesById ? lookup.scenesById.get(sceneId) || null : null;
  }

  function preRouteEffectsForOwner(lookup, ownerId) {
    if (!lookup || !lookup.effectsByOwner) {
      return [];
    }
    return ensureArray(lookup.effectsByOwner.get(String(ownerId || ''))).filter((effect) => {
      const hook = String(effect && (effect.hook || effect.effectHook) || '').toLowerCase();
      return hook === 'on-arrival';
    });
  }

  function preRouteOpaqueBlocksForOwner(lookup, ownerId) {
    if (!lookup || !lookup.opaqueBlocksByOwner) {
      return [];
    }
    return ensureArray(lookup.opaqueBlocksByOwner.get(String(ownerId || ''))).filter((block) => {
      const hook = String(block && (block.hook || block.effectHook || block.scriptKind) || '').toLowerCase();
      return !hook || hook === 'on-arrival' || hook === 'opaque_js';
    });
  }

  /**
   * @param {string|unknown} rawInput
   * @returns {PredicateSummary}
   */
  function summarizePredicate(rawInput) {
    const predicateModel = predicateConditionApi();
    if (!predicateModel) {
      throw new Error('predicate_condition_model.js is required before route_state_model.js');
    }
    return predicateModel.summarizePredicate(rawInput);
  }

  /**
   * @param {string|unknown} raw
   * @returns {string[]}
   */
  function predicateDependencies(raw) {
    const predicateModel = predicateConditionApi();
    if (!predicateModel) {
      throw new Error('predicate_condition_model.js is required before route_state_model.js');
    }
    return predicateModel.predicateDependencies(raw);
  }

  function diagnosticsForStates(states, conditionStates) {
    const diagnostics = [];
    ensureArray(states).forEach((state) => {
      ensureArray(state.candidates).forEach((candidate) => {
        if (!candidate.targetResolved && !candidate.dynamicTarget) {
          diagnostics.push({
            severity: 'warning',
            code: 'route_state.unresolved_target',
            sceneId: state.sceneId,
            ownerId: state.ownerId,
            message: 'Route target does not resolve: ' + state.ownerId + ' -> ' + candidate.rawTarget,
            source: candidate.source || state.source
          });
        }
        if (candidate.predicateSummary && candidate.predicateSummary.status === 'opaque') {
          diagnostics.push({
            severity: 'info',
            code: 'route_state.opaque_predicate',
            sceneId: state.sceneId,
            ownerId: state.ownerId,
            message: 'Route predicate needs source review: ' + candidate.predicate,
            source: candidate.source || state.source
          });
        }
      });
      if (state.runtimeSemantics && state.runtimeSemantics.possibleRandomization) {
        diagnostics.push({
          severity: 'info',
          code: 'route_state.multi_valid_randomization',
          sceneId: state.sceneId,
          ownerId: state.ownerId,
          message: state.runtimeSemantics.reason,
          source: state.source
        });
      }
      if (state.runtimeSemantics && ensureArray(state.runtimeSemantics.warnings).some((warning) => String(warning).indexOf('unconditional') >= 0)) {
        diagnostics.push({
          severity: 'warning',
          code: 'route_state.unconditional_not_fallback',
          sceneId: state.sceneId,
          ownerId: state.ownerId,
          message: 'Unconditional route clauses are always valid and are not ordered fallbacks.',
          source: state.source
        });
      }
      if (state.runtimeSemantics && state.runtimeSemantics.collisionSummary && state.runtimeSemantics.collisionSummary.after && Number(state.runtimeSemantics.collisionSummary.after.zeroValidCount || 0) > 0) {
        diagnostics.push({
          severity: 'warning',
          code: 'route_state.zero_valid_gap',
          sceneId: state.sceneId,
          ownerId: state.ownerId,
          message: 'Route sampling found a state with no valid target.',
          source: state.source
        });
      }
      if (state.preRouteScript && state.preRouteScript.routeDependencyWriteCount > 0) {
        diagnostics.push({
          severity: 'info',
          code: 'route_state.pre_route_dependency_write',
          sceneId: state.sceneId,
          ownerId: state.ownerId,
          message: 'on-arrival writes variables used by immediate route predicates: ' + state.preRouteScript.directDependencyWrites.join(', '),
          source: state.source
        });
      } else if (state.preRouteScript && state.preRouteScript.opaque) {
        diagnostics.push({
          severity: 'info',
          code: 'route_state.opaque_pre_route_script',
          sceneId: state.sceneId,
          ownerId: state.ownerId,
          message: 'on-arrival contains opaque script before route selection.',
          source: state.source
        });
      }
    });
    ensureArray(conditionStates).forEach((condition) => {
      if (condition.summary && condition.summary.status === 'opaque') {
        diagnostics.push({
          severity: 'info',
          code: 'route_state.opaque_condition',
          sceneId: condition.sceneId,
          ownerId: condition.ownerId,
          message: 'Condition needs source review: ' + condition.raw,
          source: condition.source
        });
      }
    });
    return diagnostics;
  }

  function summarizeStates(states, conditionStates, diagnostics) {
    const routeStates = ensureArray(states);
    const conditions = ensureArray(conditionStates);
    return {
      routeStateCount: routeStates.length,
      routeCandidateCount: routeStates.reduce((sum, state) => sum + Number(state.candidateCount || 0), 0),
      orderedChainCount: routeStates.filter((state) => state.chainContext === 'ordered_chain').length,
      predicateRouteCount: routeStates.filter((state) => ensureArray(state.candidates).some((candidate) => candidate.predicate)).length,
      fallbackCount: routeStates.filter((state) => state.fallbackCandidate).length,
      dynamicTargetCount: routeStates.reduce((sum, state) => sum + Number(state.dynamicTargetCount || 0), 0),
      unresolvedTargetCount: routeStates.reduce((sum, state) => sum + Number(state.unresolvedTargetCount || 0), 0),
      possibleRandomRouteCount: routeStates.filter((state) => state.runtimeSemantics && state.runtimeSemantics.possibleRandomization).length,
      unconditionalMixedRouteCount: routeStates.filter((state) => state.runtimeSemantics && state.runtimeSemantics.unconditionalCandidateCount > 0 && state.runtimeSemantics.conditionalCandidateCount > 0).length,
      explicitExclusiveRouteCount: routeStates.filter((state) => state.runtimeSemantics && ['explicit_complement', 'simple_equality_partition'].includes(state.runtimeSemantics.exclusivity)).length,
      preRouteScriptCount: routeStates.filter((state) => state.preRouteScript && state.preRouteScript.status !== 'none').length,
      preRouteRouteDependencyWriteCount: routeStates.filter((state) => state.preRouteScript && state.preRouteScript.routeDependencyWriteCount > 0).length,
      preRouteOpaqueScriptCount: routeStates.filter((state) => state.preRouteScript && state.preRouteScript.opaque).length,
      collisionTestedRouteCount: routeStates.filter((state) => state.runtimeSemantics && state.runtimeSemantics.collisionSummary && state.runtimeSemantics.collisionSummary.tested).length,
      collisionProvenMultiValidCount: routeStates.filter((state) => state.runtimeSemantics && state.runtimeSemantics.collisionSummary && state.runtimeSemantics.collisionSummary.after && state.runtimeSemantics.collisionSummary.after.multiValidCount > 0).length,
      setJumpCount: routeStates.filter((state) => String(state.routeKind || '').indexOf('set_jump') >= 0).length,
      goToRefCount: routeStates.filter((state) => ensureArray(state.candidates).some((candidate) => candidate.dynamicTarget && candidate.targetSource === 'quality')).length,
      conditionStateCount: conditions.length,
      predicateDependencyCount: unique(routeStates.flatMap((state) => ensureArray(state.dependencies)).concat(conditions.flatMap((state) => ensureArray(state.dependencies)))).length,
      opaquePredicateCount: routeStates.flatMap((state) => ensureArray(state.candidates)).filter((candidate) => candidate.predicateSummary && candidate.predicateSummary.status === 'opaque').length + conditions.filter((state) => state.status === 'opaque').length,
      diagnosticCount: ensureArray(diagnostics).length
    };
  }

  function buildLookup(index) {
    const scenes = ensureArray(index.scenes);
    const scenesById = new Map();
    const sectionToScene = new Map();
    const ownersById = new Map();
    const effectsByOwner = new Map();
    const opaqueBlocksByOwner = new Map();
    scenes.forEach((scene) => {
      if (scene && scene.id) {
        scenesById.set(String(scene.id), scene);
        ownersById.set(String(scene.id), scene);
      }
      ensureArray(scene && scene.sections).forEach((section) => {
        if (section && section.id) {
          sectionToScene.set(String(section.id), String(scene.id || ''));
          ownersById.set(String(section.id), section);
        }
      });
      ensureArray(scene && scene.effects).forEach((effect) => {
        const ownerId = String(effect && effect.sectionId || scene && scene.id || '');
        if (!ownerId) {
          return;
        }
        pushMapRow(effectsByOwner, ownerId, effect);
      });
      ensureArray(scene && scene.opaqueJsBlocks).forEach((block) => {
        const ownerId = opaqueBlockOwnerId(scene, block);
        if (!ownerId) {
          return;
        }
        pushMapRow(opaqueBlocksByOwner, ownerId, block);
      });
    });
    const parserEvidence = index.semantic && index.semantic.parserEvidence || {};
    return {
      index,
      scenes,
      scenesById,
      sectionToScene,
      ownersById,
      effectsByOwner,
      opaqueBlocksByOwner,
      edges: ensureArray(index.edges),
      diagnostics: ensureArray(index.diagnostics),
      routeOrderGroups: parserEvidenceRows(parserEvidence, 'routeOrderGroups')
    };
  }

  function pushMapRow(map, key, row) {
    const id = String(key || '');
    if (!id) {
      return;
    }
    if (!map.has(id)) {
      map.set(id, []);
    }
    const rows = map.get(id);
    if (rows) {
      rows.push(row);
    }
  }

  function opaqueBlockOwnerId(scene, block) {
    const explicit = String(block && block.sectionId || block && block.ownerId || '');
    if (explicit) {
      return explicit;
    }
    const line = sourceLine(block && block.source || {});
    const section = ensureArray(scene && scene.sections).find((item) => {
      const span = item && item.sourceSpan || {};
      const start = Number(span.startLine || span.line) || 0;
      const end = Number(span.endLine || span.line || start) || start;
      return line && start && line >= start && line <= end;
    });
    return String(section && section.id || scene && scene.id || '');
  }

  function parserEvidenceRows(parserEvidence, key) {
    const evidence = parserEvidence || {};
    const core = evidence.core || {};
    if (Array.isArray(core[key])) {
      return core[key];
    }
    return ensureArray(evidence[key]);
  }

  function resolveScene(lookup, sceneOrId) {
    if (isObject(sceneOrId)) {
      if (sceneOrId.scene && sceneOrId.scene.id) {
        return sceneOrId.scene;
      }
      const id = sceneOrId.sceneId || sceneOrId.linkedSceneId || sceneOrId.id;
      if (id && lookup.scenesById.has(String(id))) {
        return lookup.scenesById.get(String(id));
      }
      if (sceneOrId.id || sceneOrId.path || sceneOrId.sourceSpan) {
        return sceneOrId;
      }
    }
    return lookup.scenesById.get(String(sceneOrId || '')) || null;
  }

  function sceneIdForOwner(lookup, ownerId) {
    const id = String(ownerId || '');
    if (!id) {
      return '';
    }
    if (lookup.scenesById.has(id)) {
      return id;
    }
    if (lookup.sectionToScene.has(id)) {
      return lookup.sectionToScene.get(id);
    }
    if (id.indexOf('.') >= 0) {
      const sceneId = id.split('.', 1)[0];
      if (lookup.scenesById.has(sceneId)) {
        return sceneId;
      }
    }
    return '';
  }

  function routeStateBelongsToScene(state, sceneId) {
    const id = String(sceneId || '');
    return String(state.sceneId || '') === id || String(state.ownerId || '') === id || String(state.ownerId || '').startsWith(id + '.');
  }

  function missingTargetForEdge(edge, lookup) {
    const target = String(edge && edge.to || '');
    const source = sourceKey(edge && edge.source);
    return lookup.diagnostics.some((diag) => {
      return String(diag && diag.code || '') === 'project_map.missing_target' &&
        String(diag && diag.target || '') === target &&
        (!source || sourceKey(diag && diag.source) === source);
    });
  }

  function targetResolves(lookup, target) {
    const value = String(target || '');
    if (!value || value.indexOf('runtime:') === 0 || value.indexOf('tag:') === 0 || value.indexOf('quality_ref:') === 0) {
      return true;
    }
    if (lookup.scenesById.has(value) || lookup.sectionToScene.has(value)) {
      return true;
    }
    if (value.indexOf('.') > 0) {
      return lookup.scenesById.has(value.split('.', 1)[0]);
    }
    return false;
  }

  function routePurpose(kind, candidates) {
    const routeKind = normalizeRouteKind(kind);
    if (routeKind.indexOf('set_jump') >= 0) {
      return 'jump_return_target';
    }
    if (routeKind.indexOf('go_to_ref') >= 0 || ensureArray(candidates).some((candidate) => candidate.dynamicTarget && candidate.targetSource === 'quality')) {
      return 'quality_backed_dynamic_route';
    }
    if (routeKind.indexOf('go_sub') >= 0) {
      return 'subroutine_route';
    }
    if (routeKind === 'tag_choice') {
      return 'tag_router_choice';
    }
    if (routeKind === 'choice') {
      return 'player_choice';
    }
    return 'scene_route';
  }

  function targetKind(target, dynamicTarget) {
    const value = String(target || '');
    if (dynamicTarget || value.indexOf('quality_ref:') === 0) {
      return 'dynamic_quality';
    }
    if (value.indexOf('runtime:') === 0) {
      return 'runtime';
    }
    if (value.indexOf('tag:') === 0) {
      return 'tag';
    }
    if (value.indexOf('http://') === 0 || value.indexOf('https://') === 0) {
      return 'external';
    }
    if (value.indexOf('.') >= 0) {
      return 'section';
    }
    return value ? 'scene' : 'terminal';
  }

  function routeStateLabel(state, candidates, fallbackCandidate) {
    const targets = ensureArray(candidates).map((candidate) => candidate.resolvedTarget || candidate.rawTarget).filter(Boolean);
    return [
      state.routePurpose || state.routeKind || 'route',
      targets.slice(0, 3).join(' -> '),
      fallbackCandidate ? 'fallback ' + (fallbackCandidate.resolvedTarget || fallbackCandidate.rawTarget) : ''
    ].filter(Boolean).join(' / ');
  }

  function routeFieldForKind(kind) {
    const value = String(kind || '');
    if (value.indexOf('go_to_ref') >= 0 || value === 'goToRef') {
      return 'goToRef';
    }
    if (value.indexOf('go_sub_start') >= 0) {
      return 'goSubStart';
    }
    if (value.indexOf('go_sub_end') >= 0) {
      return 'goSubEnd';
    }
    if (value.indexOf('go_sub') >= 0) {
      return 'goSub';
    }
    if (value.indexOf('set_jump') >= 0) {
      return 'setJump';
    }
    if (value.indexOf('check_success') >= 0) {
      return 'checkSuccessGoTo';
    }
    if (value.indexOf('check_failure') >= 0) {
      return 'checkFailureGoTo';
    }
    if (value === 'choice' || value === 'tag_choice') {
      return 'option';
    }
    return 'goTo';
  }

  function normalizeRouteKind(value) {
    const raw = String(value || '');
    if (!raw) {
      return '';
    }
    return raw.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/-/g, '_').toLowerCase();
  }

  function sourceForField(item, field, fallbackPath) {
    const metadata = item && item.metadata || {};
    return sourceRef(metadata[field] || {path: fallbackPath || metadata.$file || '', line: sourceLine(item && item.sourceSpan)});
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    const line = sourceLine(value);
    const out = {
      path: String(value.path || value.sourcePath || ''),
      line: line || null,
      startLine: Number(value.startLine || value.line) || line || null,
      endLine: Number(value.endLine || value.line || value.startLine) || line || null
    };
    if (value.anchorText) {
      out.anchorText = String(value.anchorText);
    }
    if (value.endAnchorText) {
      out.endAnchorText = String(value.endAnchorText);
    }
    return out;
  }

  function sourceLine(source) {
    return Number(source && (source.line || source.startLine)) || 0;
  }

  function sourceKey(source) {
    const value = sourceRef(source || {});
    return [value.path || '', value.line || value.startLine || ''].join(':');
  }

  function compareRouteStates(a, b) {
    return String(a.source && a.source.path || '').localeCompare(String(b.source && b.source.path || '')) ||
      sourceLine(a.source) - sourceLine(b.source) ||
      String(a.ownerId || '').localeCompare(String(b.ownerId || '')) ||
      String(a.id || '').localeCompare(String(b.id || ''));
  }

  function compareConditionStates(a, b) {
    return String(a.source && a.source.path || '').localeCompare(String(b.source && b.source.path || '')) ||
      sourceLine(a.source) - sourceLine(b.source) ||
      String(a.ownerId || '').localeCompare(String(b.ownerId || '')) ||
      String(a.conditionKind || '').localeCompare(String(b.conditionKind || ''));
  }

  /**
   * @param {unknown} sceneOrId
   * @returns {SceneRouteState}
   */
  function emptySceneRouteState(sceneOrId) {
    return {
      schemaVersion: ROUTE_STATE_VERSION,
      kind: 'scene_route_state',
      sceneId: String(sceneOrId || ''),
      title: '',
      summary: summarizeStates([], [], []),
      states: [],
      conditionStates: [],
      diagnostics: [{severity: 'warning', code: 'route_state.scene_not_found', message: 'No matching scene was found.'}]
    };
  }

  function unique(values) {
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

  function stableId(prefix) {
    const raw = Array.prototype.slice.call(arguments, 1).map((value) => String(value || '')).join(':');
    let hash = 0;
    for (let index = 0; index < raw.length; index += 1) {
      hash = ((hash << 5) - hash + raw.charCodeAt(index)) | 0;
    }
    return prefix + '_' + Math.abs(hash).toString(16);
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
})(typeof window !== 'undefined' ? window : globalThis);
