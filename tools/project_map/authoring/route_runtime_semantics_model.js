// @ts-check
(function initProjectMapRouteRuntimeSemanticsModel(global) {
  'use strict';

  /**
   * @typedef {import('../types/project_map_contracts').RouteRuntimeSemantics} RouteRuntimeSemantics
   */

  const api = {
    routeRuntimeSemantics,
    emptyPreRouteScriptSummary,
    emptyCollisionSummary
  };

  if (global) {
    global.ProjectMapRouteRuntimeSemanticsModel = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  /**
   * @param {Record<string, any>} state
   * @param {Array<Record<string, any>>} candidates
   * @param {Record<string, any>|null} fallbackCandidate
   * @param {number} dynamicTargetCount
   * @param {number} unresolvedTargetCount
   * @returns {RouteRuntimeSemantics}
   */
  function routeRuntimeSemantics(state, candidates, fallbackCandidate, dynamicTargetCount, unresolvedTargetCount) {
    const rows = ensureArray(candidates);
    const routeKind = normalizeRouteKind(state && state.routeKind || '');
    const conditionalCount = rows.filter((candidate) => String(candidate && candidate.predicate || '').trim()).length;
    const unconditionalCount = rows.length - conditionalCount;
    const warnings = [];
    let selectionMode = 'single_valid_target';
    let exclusivity = rows.length > 1 ? 'unknown' : 'single';
    let possibleRandomization = false;
    let reason = 'Only one route target can be selected from this state.';

    if (routeKind.indexOf('set_jump') >= 0) {
      selectionMode = 'jump_target';
      exclusivity = 'not_applicable';
      reason = 'set-jump records a jump target; it is not an immediate go-to selection.';
    } else if (routeKind.indexOf('go_to_ref') >= 0 || rows.some((candidate) => candidate.dynamicTarget && candidate.targetSource === 'quality')) {
      selectionMode = 'dynamic_quality_target';
      exclusivity = rows.length > 1 ? 'runtime_value' : 'not_applicable';
      reason = 'go-to-ref resolves the target from runtime state.';
    } else if (rows.length <= 1) {
      selectionMode = conditionalCount ? 'conditional_singleton' : 'direct';
      exclusivity = 'single';
      reason = conditionalCount ? 'One conditional route target is present.' : 'One direct route target is present.';
    } else if (unconditionalCount > 0 && conditionalCount > 0) {
      selectionMode = 'random_among_valid';
      exclusivity = 'overlap_possible';
      possibleRandomization = true;
      reason = 'The route list mixes unconditional and conditional targets. DendryNexus treats the unconditional target as valid whenever this route runs, so matching predicates can create multiple valid targets.';
      warnings.push('unconditional_and_conditional_routes_can_randomize');
    } else if (hasExplicitComplementFallback(rows)) {
      selectionMode = 'single_valid_target';
      exclusivity = 'explicit_complement';
      reason = 'A predicate explicitly negates the sibling route predicates, so the group appears to be an authored mutually exclusive fallback.';
    } else if (hasSimpleEqualityPartition(rows)) {
      selectionMode = 'single_valid_target';
      exclusivity = 'simple_equality_partition';
      reason = 'Route predicates compare the same variable to distinct literal values, so the group appears mutually exclusive.';
    } else {
      selectionMode = 'random_among_valid';
      exclusivity = 'unknown_overlap';
      possibleRandomization = true;
      reason = 'Multiple conditional route targets may be valid at the same time. DendryNexus gathers all valid go-to targets and randomizes when more than one matches.';
      warnings.push('conditional_route_overlap_not_ruled_out');
    }

    if (fallbackCandidate && possibleRandomization) {
      warnings.push('source_fallback_is_runtime_unconditional');
    }
    if (unresolvedTargetCount) {
      warnings.push('unresolved_route_target');
    }
    if (dynamicTargetCount && selectionMode !== 'dynamic_quality_target') {
      warnings.push('dynamic_route_target');
    }

    return {
      selectionMode,
      exclusivity,
      possibleRandomization,
      multiValidRisk: possibleRandomization,
      unconditionalCandidateCount: unconditionalCount,
      conditionalCandidateCount: conditionalCount,
      dynamicTargetCount,
      unresolvedTargetCount,
      reason,
      warnings,
      preRouteScript: emptyPreRouteScriptSummary(state && state.ownerId || ''),
      collisionSummary: emptyCollisionSummary()
    };
  }

  /**
   * @param {string} ownerId
   * @returns {import('../types/project_map_contracts').RoutePreRouteScriptSummary}
   */
  function emptyPreRouteScriptSummary(ownerId) {
    return {
      ownerId: String(ownerId || ''),
      hook: 'on-arrival',
      rawPresent: false,
      effectCount: 0,
      safeEffectCount: 0,
      opaqueBlockCount: 0,
      writes: [],
      directDependencyWrites: [],
      routeDependencyWriteCount: 0,
      opaque: false,
      opaqueReasons: [],
      status: 'none',
      effects: []
    };
  }

  /**
   * @returns {import('../types/project_map_contracts').RouteCollisionSummary}
   */
  function emptyCollisionSummary() {
    return {
      tested: false,
      sampleCount: 0,
      dependencyCount: 0,
      before: newCountBucket(),
      after: newCountBucket(),
      preRouteMutationCount: 0,
      verdict: 'untested',
      reason: '',
      examples: {multiValidBefore: [], multiValidAfter: [], zeroValidAfter: [], preRouteMutation: []}
    };
  }

  function newCountBucket() {
    return {zeroValidCount: 0, oneValidCount: 0, multiValidCount: 0};
  }

  function hasExplicitComplementFallback(candidates) {
    const predicates = ensureArray(candidates).map((candidate) => String(candidate && candidate.predicate || '').trim()).filter(Boolean);
    if (predicates.length < 2) {
      return false;
    }
    const keys = predicates.map(predicateKey).filter(Boolean);
    return keys.some((candidateKey, index) => {
      const siblingKeys = keys.filter((_, siblingIndex) => siblingIndex !== index);
      return siblingKeys.length > 0 && siblingKeys.every((key) => candidateKey.includes('not(' + key + ')'));
    });
  }

  function hasSimpleEqualityPartition(candidates) {
    const comparisons = ensureArray(candidates).map((candidate) => simpleEqualityComparison(candidate && candidate.predicateSummary)).filter(Boolean);
    if (comparisons.length !== candidates.length || comparisons.length < 2) {
      return false;
    }
    const variable = comparisons[0].variable;
    return comparisons.every((comparison) => comparison.variable === variable) &&
      unique(comparisons.map((comparison) => comparison.value)).length === comparisons.length;
  }

  function simpleEqualityComparison(summary) {
    const comparisons = ensureArray(summary && summary.comparisons);
    const dependencies = ensureArray(summary && summary.dependencies);
    if (comparisons.length !== 1 || dependencies.length !== 1) {
      return null;
    }
    const comparison = comparisons[0];
    const op = String(comparison && comparison.op || '');
    if (op !== '=' && op !== '==') {
      return null;
    }
    const left = String(comparison.left || '');
    const right = String(comparison.right || '');
    const variable = dependencies[0];
    if (left === variable && right && right !== variable) {
      return {variable, value: right};
    }
    if (right === variable && left && left !== variable) {
      return {variable, value: left};
    }
    return null;
  }

  function predicateKey(raw) {
    return stripOuterParens(String(raw || '').replace(/\s+/g, '').toLowerCase());
  }

  function stripOuterParens(value) {
    let text = String(value || '');
    let changed = true;
    while (changed && text.charAt(0) === '(' && text.charAt(text.length - 1) === ')') {
      changed = false;
      let depth = 0;
      let wraps = true;
      for (let index = 0; index < text.length; index += 1) {
        const char = text.charAt(index);
        if (char === '(') depth += 1;
        if (char === ')') depth -= 1;
        if (depth === 0 && index < text.length - 1) {
          wraps = false;
          break;
        }
      }
      if (wraps) {
        text = text.slice(1, -1);
        changed = true;
      }
    }
    return text;
  }

  function normalizeRouteKind(value) {
    return String(value || '').trim().replace(/-/g, '_').toLowerCase();
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

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }
})(typeof window !== 'undefined' ? window : globalThis);
