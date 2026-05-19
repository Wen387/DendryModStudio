// @ts-check
(function initProjectMapRouteRuntimeTrialModel(global) {
  'use strict';

  /**
   * @typedef {import('../types/project_map_contracts').RouteCollisionSummary} RouteCollisionSummary
   * @typedef {import('../types/project_map_contracts').RoutePreRouteScriptSummary} RoutePreRouteScriptSummary
   * @typedef {import('../types/project_map_contracts').RouteRuntimeSemantics} RouteRuntimeSemantics
   * @typedef {import('../types/project_map_contracts').SourceRef} SourceRef
   */

  const api = {
    enrichRuntimeSemantics,
    preRouteScriptSummary,
    emptyPreRouteScriptSummary,
    routeCollisionSummary,
    emptyCollisionSummary
  };

  if (global) {
    global.ProjectMapRouteRuntimeTrialModel = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  /**
   * @param {RouteRuntimeSemantics|Record<string, any>} semantics
   * @param {RoutePreRouteScriptSummary|Record<string, any>} preRouteScript
   * @param {RouteCollisionSummary|Record<string, any>} collisionSummary
   * @returns {RouteRuntimeSemantics}
   */
  function enrichRuntimeSemantics(semantics, preRouteScript, collisionSummary) {
    const value = Object.assign({}, semantics || {});
    const warnings = ensureArray(value.warnings).slice();
    const preRoute = preRouteScript || emptyPreRouteScriptSummary('');
    const collision = collisionSummary || emptyCollisionSummary();
    if (preRoute.routeDependencyWriteCount > 0) {
      warnings.push('on_arrival_writes_route_dependencies');
    } else if (preRoute.opaque) {
      warnings.push('opaque_on_arrival_before_route');
    }
    if (collision.tested && collision.after && collision.after.multiValidCount > 0) {
      value.selectionMode = 'random_among_valid';
      if (value.exclusivity === 'single' || value.exclusivity === 'unknown') {
        value.exclusivity = 'sampled_overlap';
      }
      value.possibleRandomization = true;
      value.multiValidRisk = true;
      value.reason = 'Sampled route trials found more than one valid target for at least one state.';
      warnings.push('sampled_multi_valid_routes');
    }
    if (collision.tested && collision.after && collision.after.zeroValidCount > 0) {
      warnings.push('sampled_zero_valid_routes');
    }
    value.preRouteScript = preRoute;
    value.collisionSummary = collision;
    value.warnings = uniqueStrings(warnings);
    return /** @type {RouteRuntimeSemantics} */ (value);
  }

  /**
   * @param {Record<string, any>} input
   * @returns {RoutePreRouteScriptSummary}
   */
  function preRouteScriptSummary(input) {
    const value = input || {};
    const ownerId = String(value.ownerId || '');
    const raw = String(value.raw || '');
    const effects = ensureArray(value.effects);
    const opaqueBlocks = ensureArray(value.opaqueBlocks);
    const routeDependencies = ensureArray(value.dependencies);
    const safeEffects = effects.filter((effect) => isSafePreRouteEffect(effect, value.summarizePredicate));
    const effectWrites = uniqueStrings(effects.map((effect) => cleanVariable(effect && effect.variable)));
    const opaqueWrites = uniqueStrings(opaqueBlocks.flatMap((block) => ensureArray(block && block.writes).map(cleanVariable)));
    const writes = uniqueStrings(effectWrites.concat(opaqueWrites));
    const directDependencyWrites = writes.filter((name) => routeDependencies.includes(name));
    const opaqueReasons = [];
    if (opaqueBlocks.length) {
      opaqueReasons.push('opaque_js_block');
    }
    if (raw && rawIsOpaqueScript(raw) && !effects.length && !opaqueBlocks.length) {
      opaqueReasons.push('unparsed_on_arrival');
    }
    const status = !raw && !effects.length && !opaqueBlocks.length
      ? 'none'
      : directDependencyWrites.length
      ? 'direct_dependency_write'
      : opaqueReasons.length
      ? 'opaque_pre_route_script'
      : safeEffects.length
      ? 'safe_effects'
      : 'present';
    return {
      ownerId,
      hook: 'on-arrival',
      rawPresent: Boolean(raw),
      effectCount: effects.length,
      safeEffectCount: safeEffects.length,
      opaqueBlockCount: opaqueBlocks.length,
      writes,
      directDependencyWrites,
      routeDependencyWriteCount: directDependencyWrites.length,
      opaque: Boolean(opaqueReasons.length),
      opaqueReasons,
      status,
      effects: safeEffects.slice(0, 12).map((effect) => ({
        variable: cleanVariable(effect && effect.variable),
        op: String(effect && (effect.op || effect.operator) || ''),
        value: stringValue(effect && effect.value),
        condition: String(effect && effect.condition || ''),
        source: sourceRef(effect && effect.source || {})
      }))
    };
  }

  /**
   * @param {string} ownerId
   * @returns {RoutePreRouteScriptSummary}
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
   * @param {Record<string, any>} _state
   * @param {Array<Record<string, any>>} candidates
   * @param {RoutePreRouteScriptSummary|Record<string, any>} preRouteScript
   * @param {Record<string, any>=} options
   * @returns {RouteCollisionSummary}
   */
  function routeCollisionSummary(_state, candidates, preRouteScript, options) {
    const opts = isObject(options) ? options : {};
    const sampleLimit = Number(opts.sampleLimit || 64) || 64;
    const summarize = typeof opts.summarizePredicate === 'function' ? opts.summarizePredicate : emptyPredicateSummary;
    const rows = ensureArray(candidates);
    const empty = emptyCollisionSummary();
    if (rows.length <= 1 || rows.some((candidate) => candidate.dynamicTarget)) {
      return empty;
    }
    if (!rows.every((candidate) => predicateCanEvaluate(candidate && candidate.predicateSummary))) {
      return Object.assign({}, empty, {
        tested: false,
        reason: 'At least one route predicate is opaque or dynamic.'
      });
    }
    const domains = routeSampleDomains(rows, preRouteScript, summarize);
    const samples = sampleStates(domains, sampleLimit);
    const before = newCountBucket();
    const after = newCountBucket();
    const examples = {multiValidBefore: [], multiValidAfter: [], zeroValidAfter: [], preRouteMutation: []};
    let preRouteMutationCount = 0;
    samples.forEach((sample) => {
      const beforeTargets = validTargetsForState(rows, sample, summarize);
      countValidTargets(before, beforeTargets.length);
      if (beforeTargets.length > 1 && examples.multiValidBefore.length < 3) {
        examples.multiValidBefore.push({state: sample, validTargets: beforeTargets});
      }
      const next = applySafePreRouteEffects(sample, preRouteScript, summarize);
      if (stateChanged(sample, next)) {
        preRouteMutationCount += 1;
        if (examples.preRouteMutation.length < 3) {
          examples.preRouteMutation.push({before: sample, after: next});
        }
      }
      const afterTargets = validTargetsForState(rows, next, summarize);
      countValidTargets(after, afterTargets.length);
      if (afterTargets.length > 1 && examples.multiValidAfter.length < 3) {
        examples.multiValidAfter.push({state: next, validTargets: afterTargets});
      } else if (afterTargets.length === 0 && examples.zeroValidAfter.length < 3) {
        examples.zeroValidAfter.push({state: next, validTargets: afterTargets});
      }
    });
    const verdict = after.multiValidCount > 0
      ? 'proven_multi_valid'
      : after.zeroValidCount > 0
      ? 'zero_valid_possible'
      : 'sampled_single_valid';
    return {
      tested: true,
      sampleCount: samples.length,
      dependencyCount: Object.keys(domains).length,
      before,
      after,
      preRouteMutationCount,
      verdict,
      reason: collisionReason(verdict, preRouteMutationCount),
      examples
    };
  }

  /**
   * @returns {RouteCollisionSummary}
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

  function countValidTargets(bucket, count) {
    if (count <= 0) {
      bucket.zeroValidCount += 1;
    } else if (count === 1) {
      bucket.oneValidCount += 1;
    } else {
      bucket.multiValidCount += 1;
    }
  }

  function collisionReason(verdict, preRouteMutationCount) {
    const suffix = preRouteMutationCount ? ' after applying safe on-arrival effects.' : '.';
    if (verdict === 'proven_multi_valid') {
      return 'Sampled states can make multiple route targets valid' + suffix;
    }
    if (verdict === 'zero_valid_possible') {
      return 'Sampled states can make no route target valid' + suffix;
    }
    if (verdict === 'sampled_single_valid') {
      return 'Sampled states selected one valid target' + suffix;
    }
    return '';
  }

  function rawIsOpaqueScript(raw) {
    const text = String(raw || '');
    return /\{!|[{}]|\b(?:var|let|const|for|while|function|return|else)\b/.test(text);
  }

  function isSafePreRouteEffect(effect, summarizePredicate) {
    const variable = cleanVariable(effect && effect.variable);
    const op = String(effect && (effect.op || effect.operator) || '');
    const value = String(effect && effect.value === undefined ? '' : effect && effect.value).trim();
    const condition = String(effect && effect.condition || '').trim();
    if (!variable || !['=', '+=', '-='].includes(op) || !isSimpleRuntimeValue(value)) {
      return false;
    }
    if (!condition) {
      return true;
    }
    const summary = callSummarizePredicate(summarizePredicate, condition);
    return summary.status === 'parsed' || summary.status === 'empty';
  }

  function predicateCanEvaluate(summary) {
    const value = summary || {};
    return !value.raw || value.status === 'parsed' || value.status === 'empty';
  }

  function routeSampleDomains(candidates, preRouteScript, summarizePredicate) {
    const domains = {};
    ensureArray(candidates).forEach((candidate) => {
      const summary = candidate && candidate.predicateSummary || {};
      ensureArray(summary.dependencies).forEach((name) => ensureDomain(domains, name));
      ensureArray(summary.comparisons).forEach((comparison) => addComparisonValues(domains, comparison));
    });
    ensureArray(preRouteScript && preRouteScript.effects).forEach((effect) => {
      ensureDomain(domains, effect && effect.variable);
      const condition = callSummarizePredicate(summarizePredicate, effect && effect.condition || '');
      ensureArray(condition.dependencies).forEach((name) => ensureDomain(domains, name));
      ensureArray(condition.comparisons).forEach((comparison) => addComparisonValues(domains, comparison));
      addRuntimeValueDomain(domains, effect && effect.value, '', effect && effect.variable);
    });
    Object.keys(domains).forEach((name) => {
      domains[name] = uniqueRuntimeValues(domains[name]).slice(0, 6);
    });
    return domains;
  }

  function ensureDomain(domains, name) {
    const key = cleanVariable(name);
    if (key && !domains[key]) {
      domains[key] = [0, 1];
    }
  }

  function addComparisonValues(domains, comparison) {
    const deps = ensureArray(comparison && comparison.dependencies);
    const variable = cleanVariable(deps[0]);
    if (!variable) {
      return;
    }
    ensureDomain(domains, variable);
    [comparison && comparison.left, comparison && comparison.right].forEach((part) => {
      addRuntimeValueDomain(domains, part, variable, variable);
    });
  }

  function addRuntimeValueDomain(domains, value, skipVariable, targetVariable) {
    const text = String(value === undefined || value === null ? '' : value).trim();
    if (!text || text === skipVariable) {
      return;
    }
    const target = cleanVariable(targetVariable);
    const names = target && domains[target] ? [target] : Object.keys(domains);
    const quoted = text.match(/^['"]([\s\S]*)['"]$/);
    if (quoted) {
      names.forEach((name) => domains[name].push(quoted[1], '__other__'));
      return;
    }
    if (/^-?\d+(?:\.\d+)?$/.test(text)) {
      const n = Number(text);
      names.forEach((name) => domains[name].push(n - 1, n, n + 1));
    }
  }

  function sampleStates(domains, sampleLimit) {
    const names = Object.keys(domains).slice(0, 10);
    if (!names.length) {
      return [{}];
    }
    const limit = Math.max(1, Math.min(Number(sampleLimit || 64) || 64, 1024));
    const product = names.reduce((total, name) => total * Math.max(1, ensureArray(domains[name]).length), 1);
    if (product <= limit) {
      const rows = [{}];
      names.forEach((name) => {
        const next = [];
        rows.forEach((row) => {
          ensureArray(domains[name]).forEach((value) => next.push(Object.assign({}, row, {[name]: value})));
        });
        rows.splice(0, rows.length, ...next);
      });
      return rows;
    }
    const rows = [];
    let seed = 1337;
    for (let index = 0; index < limit; index += 1) {
      const row = {};
      names.forEach((name) => {
        const values = ensureArray(domains[name]);
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        row[name] = values[seed % values.length];
      });
      rows.push(row);
    }
    return rows;
  }

  function validTargetsForState(candidates, state, summarizePredicate) {
    return ensureArray(candidates).filter((candidate) => {
      const summary = candidate && candidate.predicateSummary || callSummarizePredicate(summarizePredicate, candidate && candidate.predicate || '');
      return !summary.raw || evaluatePredicateSummary(summary, state);
    }).map((candidate) => String(candidate.resolvedTarget || candidate.rawTarget || '')).filter(Boolean);
  }

  function applySafePreRouteEffects(state, preRouteScript, summarizePredicate) {
    const next = Object.assign({}, state || {});
    ensureArray(preRouteScript && preRouteScript.effects).forEach((effect) => {
      if (!isSafePreRouteEffect(effect, summarizePredicate)) {
        return;
      }
      const condition = String(effect.condition || '').trim();
      if (condition && !evaluatePredicateSummary(callSummarizePredicate(summarizePredicate, condition), next)) {
        return;
      }
      const variable = cleanVariable(effect.variable);
      const current = valueForRuntimeState(next, variable);
      const value = parseRuntimeValue(effect.value, next);
      if (effect.op === '=') {
        next[variable] = value;
      } else if (effect.op === '+=') {
        next[variable] = Number(current || 0) + Number(value || 0);
      } else if (effect.op === '-=') {
        next[variable] = Number(current || 0) - Number(value || 0);
      }
    });
    return next;
  }

  function stateChanged(before, after) {
    const keys = uniqueStrings(Object.keys(before || {}).concat(Object.keys(after || {})));
    return keys.some((key) => before[key] !== after[key]);
  }

  function evaluatePredicateSummary(summary, state) {
    const value = summary || {};
    if (!value.raw) {
      return true;
    }
    if (!value.ast) {
      return false;
    }
    return Boolean(evaluateAst(value.ast, state));
  }

  function evaluateAst(ast, state) {
    if (!ast) {
      return false;
    }
    if (ast.type === 'identifier') {
      return valueForRuntimeState(state, ast.name);
    }
    if (ast.type === 'literal') {
      return ast.value;
    }
    if (ast.type === 'group') {
      return evaluateAst(ast.value, state);
    }
    if (ast.type === 'unary' && ast.op === 'not') {
      return !Boolean(evaluateAst(ast.value, state));
    }
    if (ast.type === 'logical') {
      return ast.op === 'or'
        ? Boolean(evaluateAst(ast.left, state)) || Boolean(evaluateAst(ast.right, state))
        : Boolean(evaluateAst(ast.left, state)) && Boolean(evaluateAst(ast.right, state));
    }
    if (ast.type === 'arithmetic') {
      const left = Number(evaluateAst(ast.left, state) || 0);
      const right = Number(evaluateAst(ast.right, state) || 0);
      if (ast.op === '+') return left + right;
      if (ast.op === '-') return left - right;
      if (ast.op === '*') return left * right;
      if (ast.op === '/') return right ? left / right : 0;
    }
    if (ast.type === 'comparison') {
      return compareRuntimeValues(evaluateAst(ast.left, state), evaluateAst(ast.right, state), ast.op);
    }
    return false;
  }

  function compareRuntimeValues(left, right, op) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    const bothNumeric = left !== '' && right !== '' && Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
    const a = bothNumeric ? leftNumber : String(left);
    const b = bothNumeric ? rightNumber : String(right);
    if (op === '=' || op === '==') return a === b;
    if (op === '!=' || op === '<>') return a !== b;
    if (op === '>=') return a >= b;
    if (op === '<=') return a <= b;
    if (op === '>') return a > b;
    if (op === '<') return a < b;
    return false;
  }

  function parseRuntimeValue(value, state) {
    const text = String(value === undefined || value === null ? '' : value).trim();
    if (/^true$/i.test(text)) return true;
    if (/^false$/i.test(text)) return false;
    if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
    const quoted = text.match(/^['"]([\s\S]*)['"]$/);
    if (quoted) return quoted[1];
    return valueForRuntimeState(state, text);
  }

  function valueForRuntimeState(state, key) {
    const clean = cleanVariable(key);
    return Object.prototype.hasOwnProperty.call(state || {}, clean) ? state[clean] : 0;
  }

  function isSimpleRuntimeValue(value) {
    const text = String(value === undefined || value === null ? '' : value).trim();
    return /^(?:true|false)$/i.test(text) ||
      /^-?\d+(?:\.\d+)?$/.test(text) ||
      /^['"][\s\S]*['"]$/.test(text) ||
      /^(?:Q\.)?[A-Za-z_][A-Za-z0-9_]*$/.test(text);
  }

  function callSummarizePredicate(summarizePredicate, raw) {
    if (typeof summarizePredicate === 'function') {
      return summarizePredicate(raw);
    }
    return emptyPredicateSummary(raw);
  }

  function emptyPredicateSummary(raw) {
    return {
      raw: String(raw || ''),
      normalized: String(raw || ''),
      status: raw ? 'opaque' : 'empty',
      dependencies: [],
      comparisons: [],
      ast: null,
      reasons: raw ? ['predicate_summary_unavailable'] : []
    };
  }

  function sourceRef(source) {
    return {
      path: String(source && source.path || ''),
      line: Number(source && (source.line || source.startLine)) || 0,
      startLine: Number(source && (source.startLine || source.line)) || 0,
      endLine: Number(source && (source.endLine || source.line || source.startLine)) || 0
    };
  }

  function cleanVariable(value) {
    return String(value || '').trim().replace(/^Q\./, '');
  }

  function stringValue(value) {
    return String(value === undefined || value === null ? '' : value);
  }

  function uniqueRuntimeValues(values) {
    const seen = new Set();
    const out = [];
    ensureArray(values).forEach((value) => {
      const key = typeof value + ':' + String(value);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      out.push(value);
    });
    return out;
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

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
})(typeof window !== 'undefined' ? window : globalThis);
