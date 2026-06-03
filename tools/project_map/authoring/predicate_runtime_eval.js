// @ts-check
(function initProjectMapPredicateRuntimeEval(global) {
  'use strict';

  /**
   * Browser- and Node-safe predicate evaluator. Walks the AST produced by
   * ProjectMapPredicateConditionModel.summarizePredicate against a flat quality
   * state map ({varName: value}, no "Q." prefix required) and returns a boolean.
   *
   * The semantics intentionally mirror route_runtime_trial_model.js so the
   * editor what-if simulator and the route collision sampler agree. The
   * check_predicate_runtime_eval_model.js drift guard keeps the two in sync.
   */

  const api = {
    evaluateAst,
    evaluatePredicateSummary,
    normalizeState
  };

  if (global) {
    global.ProjectMapPredicateRuntimeEval = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  /**
   * @param {{raw?: string, ast?: any}|null|undefined} summary
   * @param {Record<string, unknown>} state
   * @returns {boolean}
   */
  function evaluatePredicateSummary(summary, state) {
    const value = summary || {};
    if (!value.raw) {
      return true;
    }
    if (!value.ast) {
      return false;
    }
    return Boolean(evaluateAst(value.ast, normalizeState(state)));
  }

  /**
   * @param {any} ast
   * @param {Record<string, unknown>} state
   * @returns {unknown}
   */
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

  /**
   * @param {unknown} left
   * @param {unknown} right
   * @param {string} op
   * @returns {boolean}
   */
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

  /**
   * @param {Record<string, unknown>} state
   * @param {string} key
   * @returns {unknown}
   */
  function valueForRuntimeState(state, key) {
    const clean = cleanVariable(key);
    return Object.prototype.hasOwnProperty.call(state || {}, clean) ? state[clean] : 0;
  }

  /**
   * Accepts a raw state map whose keys may carry a "Q." prefix and returns a
   * clean map keyed by the bare variable name.
   * @param {Record<string, unknown>|null|undefined} state
   * @returns {Record<string, unknown>}
   */
  function normalizeState(state) {
    /** @type {Record<string, unknown>} */
    const out = {};
    if (!state || typeof state !== 'object') {
      return out;
    }
    Object.keys(state).forEach((key) => {
      const clean = cleanVariable(key);
      if (clean) {
        out[clean] = state[key];
      }
    });
    return out;
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  function cleanVariable(value) {
    return String(value || '').trim().replace(/^Q\./, '');
  }
})(typeof window !== 'undefined' ? window : globalThis);
