// @ts-check
(function initProjectMapEventStructureEffectModel(global) {
  'use strict';

  /**
   * @typedef {import('../types/project_map_contracts').EventStructureEffect} EventStructureEffect
   * @typedef {import('../types/project_map_contracts').EventStructureEffectConditionSplit} EventStructureEffectConditionSplit
   * @typedef {import('../types/project_map_contracts').EventStructureEffectModelApi} EventStructureEffectModelApi
   */

  /**
   * @param {unknown} effect
   * @returns {EventStructureEffect}
   */
  function effectFromDraft(effect) {
    const value = /** @type {Record<string, any>} */ (isObject(effect) ? effect : {});
    return {
      variable: safeId(value.variable || ''),
      op: normalizeEffectOp(value.op || '+='),
      value: value.value,
      condition: stringValue(value.condition),
      hook: stringValue(value.hook)
    };
  }

  /**
   * @param {unknown} effect
   * @returns {EventStructureEffect}
   */
  function effectToDraft(effect) {
    const value = /** @type {Record<string, any>} */ (isObject(effect) ? effect : {});
    const out = {
      variable: safeId(value.variable || ''),
      op: normalizeEffectOp(value.op || '+='),
      value: effectValue(value.value, value.op),
      condition: '',
      hook: ''
    };
    if (value.condition) {
      out.condition = stringValue(value.condition);
    }
    if (value.hook) {
      out.hook = stringValue(value.hook);
    }
    return out;
  }

  /**
   * @param {unknown} value
   * @returns {EventStructureEffect}
   */
  function parseEffect(value) {
    const text = stringValue(value).trim().replace(/^Q\./, '');
    const match = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|=)\s*([\s\S]*)$/);
    if (!match) {
      return {variable: '', op: '+=', value: '', condition: '', hook: ''};
    }
    const tail = splitEffectCondition(match[3]);
    return {
      variable: safeId(match[1]),
      op: match[2],
      value: effectValue(tail.value, match[2]),
      condition: tail.condition,
      hook: ''
    };
  }

  /**
   * @param {unknown} value
   * @returns {EventStructureEffectConditionSplit}
   */
  function splitEffectCondition(value) {
    const text = stringValue(value).trim();
    const match = text.match(/^([\s\S]*?)\s+if\s+([\s\S]+)$/i);
    return match ? {value: match[1].trim(), condition: match[2].trim()} : {value: text, condition: ''};
  }

  /**
   * @param {unknown} effect
   * @returns {string}
   */
  function effectLabel(effect) {
    const value = /** @type {Record<string, any>} */ (isObject(effect) ? effect : {});
    const variable = value.variable ? 'Q.' + value.variable : 'Q.variable';
    const op = value.op || '+=';
    const tail = variable + ' ' + op + ' ' + stringValue(value.value === undefined ? 1 : value.value);
    return value.condition ? tail + ' if ' + value.condition : tail;
  }

  /**
   * @param {unknown} effect
   * @returns {string}
   */
  function effectLabelForSource(effect) {
    const value = /** @type {Record<string, any>} */ (isObject(effect) ? effect : {});
    const explicit = stringValue(value.displayExpression || value.expression || value.sourceExpression).trim();
    if (explicit) {
      return explicit;
    }
    const variable = stringValue(value.variable).trim();
    if (!variable) {
      return '';
    }
    const op = stringValue(value.op || value.operator || '+=').trim() || '+=';
    const amount = stringValue(value.value === undefined || value.value === null ? 1 : value.value).trim();
    const expression = (variable.indexOf('Q.') === 0 ? variable : 'Q.' + variable) + ' ' + op + ' ' + amount;
    return value.condition ? expression + ' if ' + value.condition : expression;
  }

  /**
   * @param {unknown} value
   * @param {unknown} op
   * @returns {string | number}
   */
  function effectValue(value, op) {
    const text = stringValue(value).trim();
    if (op && op !== '=') {
      const num = Number(text);
      return Number.isFinite(num) ? num : text;
    }
    if (/^-?\d+(?:\.\d+)?$/.test(text)) {
      return Number(text);
    }
    return text;
  }

  /**
   * @param {unknown} value
   * @returns {'=' | '+=' | '-='}
   */
  function normalizeEffectOp(value) {
    const op = stringValue(value || '+=').trim();
    return op === '=' || op === '+=' || op === '-=' ? op : '+=';
  }

  /**
   * @param {unknown} value
   * @returns {string[]}
   */
  function rawEffectLines(value) {
    if (Array.isArray(value)) {
      return value.reduce((rows, item) => rows.concat(rawEffectLines(item)), []);
    }
    return stringValue(value)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  function joinRawEffectLines(value) {
    return rawEffectLines(value).join('\n');
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  function safeId(value) {
    const text = stringValue(value).trim()
      .replace(/^[@#]/, '')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return /^[A-Za-z_]/.test(text) ? text : 'draft_' + (text || 'item');
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  function stringValue(value) {
    return value === undefined || value === null ? '' : String(value);
  }

  /**
   * @param {unknown} value
   * @returns {value is Record<string, unknown>}
   */
  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = /** @type {EventStructureEffectModelApi} */ ({
    effectFromDraft,
    effectToDraft,
    parseEffect,
    splitEffectCondition,
    effectLabel,
    effectLabelForSource,
    effectValue,
    normalizeEffectOp,
    rawEffectLines,
    joinRawEffectLines
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapEventStructureEffectModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
