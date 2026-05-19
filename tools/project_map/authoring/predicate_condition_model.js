// @ts-check
(function initProjectMapPredicateConditionModel(global) {
  'use strict';

  const PREDICATE_MODEL_VERSION = '0.1';
  const RESERVED_WORDS = new Set(['and', 'or', 'not', 'true', 'false', 'if']);

  /**
   * @typedef {import('../types/project_map_contracts').PredicateSummary} PredicateSummary
   */

  const api = {
    summarizePredicate,
    predicateDependencies
  };

  if (global) {
    global.ProjectMapPredicateConditionModel = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  /**
   * @param {string|unknown} rawInput
   * @returns {PredicateSummary}
   */
  function summarizePredicate(rawInput) {
    const raw = String(rawInput || '').trim();
    if (!raw) {
      return emptyPredicateSummary(raw);
    }
    const dynamicRefs = dynamicQRefs(raw);
    const prepared = raw.replace(/Q\s*\[[^\]]+\]/g, 'dynamic_q_ref');
    const tokenized = tokenizePredicate(prepared);
    const fallbackDependencies = unique(variablesIn(raw));
    if (tokenized.unsupported.length) {
      return {
        schemaVersion: PREDICATE_MODEL_VERSION,
        kind: 'predicate_summary',
        raw,
        status: dynamicRefs.length ? 'dynamic' : 'opaque',
        dependencies: unique(fallbackDependencies.concat(dynamicRefs.flatMap((ref) => ref.dependencies))),
        operators: tokenized.tokens.filter((token) => token.type === 'operator').map((token) => String(token.value)),
        comparisons: [],
        dynamicRefs,
        ast: null,
        opaqueReasons: tokenized.unsupported
      };
    }
    const parser = createPredicateParser(tokenized.tokens);
    const parsed = parser.parseExpression();
    if (!parsed || !astIsComplete(parsed) || parser.peek().type !== 'eof') {
      return {
        schemaVersion: PREDICATE_MODEL_VERSION,
        kind: 'predicate_summary',
        raw,
        status: dynamicRefs.length ? 'dynamic' : 'opaque',
        dependencies: unique(fallbackDependencies.concat(dynamicRefs.flatMap((ref) => ref.dependencies))),
        operators: [],
        comparisons: [],
        dynamicRefs,
        ast: null,
        opaqueReasons: ['Could not parse the full predicate.']
      };
    }
    const dependencies = unique(dependenciesForAst(parsed).concat(dynamicRefs.flatMap((ref) => ref.dependencies))).filter((item) => item !== 'dynamic_q_ref');
    const operators = unique(operatorsForAst(parsed));
    const comparisons = comparisonsForAst(parsed);
    return {
      schemaVersion: PREDICATE_MODEL_VERSION,
      kind: 'predicate_summary',
      raw,
      status: dynamicRefs.length ? 'dynamic' : 'parsed',
      dependencies,
      operators,
      comparisons,
      dynamicRefs,
      ast: parsed,
      opaqueReasons: []
    };
  }

  /**
   * @param {string|unknown} raw
   * @returns {string[]}
   */
  function predicateDependencies(raw) {
    return summarizePredicate(raw).dependencies;
  }

  /**
   * @param {string|unknown} raw
   * @returns {PredicateSummary}
   */
  function emptyPredicateSummary(raw) {
    return {
      schemaVersion: PREDICATE_MODEL_VERSION,
      kind: 'predicate_summary',
      raw: String(raw || ''),
      status: 'empty',
      dependencies: [],
      operators: [],
      comparisons: [],
      dynamicRefs: [],
      ast: null,
      opaqueReasons: []
    };
  }

  function tokenizePredicate(raw) {
    const text = String(raw || '');
    const tokens = [];
    const unsupported = [];
    let index = 0;
    while (index < text.length) {
      const char = text.charAt(index);
      if (/\s/.test(char)) {
        index += 1;
        continue;
      }
      const pair = text.slice(index, index + 2);
      if (['>=', '<=', '==', '!=', '&&', '||'].includes(pair)) {
        tokens.push({type: 'operator', value: pair === '&&' ? 'and' : pair === '||' ? 'or' : pair});
        index += 2;
        continue;
      }
      if (['(', ')', '+', '-', '*', '/', '=', '>', '<', '!'].includes(char)) {
        tokens.push({type: char === '(' || char === ')' ? 'paren' : 'operator', value: char === '!' ? 'not' : char});
        index += 1;
        continue;
      }
      if (char === '"' || char === "'") {
        const parsed = readQuoted(text, index);
        if (!parsed) {
          unsupported.push('Unterminated string literal.');
          break;
        }
        tokens.push({type: 'literal', value: parsed.value, raw: parsed.raw});
        index = parsed.next;
        continue;
      }
      const numberMatch = text.slice(index).match(/^\d+(?:\.\d+)?/);
      if (numberMatch) {
        tokens.push({type: 'literal', value: Number(numberMatch[0]), raw: numberMatch[0]});
        index += numberMatch[0].length;
        continue;
      }
      const identMatch = text.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/);
      if (identMatch) {
        const value = identMatch[0];
        const lower = value.toLowerCase();
        if (lower === 'and' || lower === 'or' || lower === 'not') {
          tokens.push({type: 'operator', value: lower});
        } else if (lower === 'true' || lower === 'false') {
          tokens.push({type: 'literal', value: lower === 'true', raw: value});
        } else {
          tokens.push({type: 'identifier', value});
        }
        index += value.length;
        continue;
      }
      unsupported.push('Unsupported token near "' + text.slice(index, index + 12) + '".');
      index += 1;
    }
    tokens.push({type: 'eof', value: ''});
    return {tokens, unsupported};
  }

  function astIsComplete(ast) {
    if (!ast) {
      return false;
    }
    if (ast.type === 'identifier' || ast.type === 'literal') {
      return true;
    }
    if (ast.type === 'group' || ast.type === 'unary') {
      return astIsComplete(ast.value);
    }
    if (ast.type === 'logical' || ast.type === 'arithmetic' || ast.type === 'comparison') {
      return astIsComplete(ast.left) && astIsComplete(ast.right);
    }
    return false;
  }

  function createPredicateParser(tokens) {
    let index = 0;
    return {
      peek,
      consume,
      parseExpression: parseOr
    };

    function peek() {
      return tokens[index] || {type: 'eof', value: ''};
    }

    function consume(value) {
      const token = peek();
      if (value && token.value !== value) {
        return null;
      }
      index += 1;
      return token;
    }

    function parseOr() {
      let left = parseAnd();
      while (peek().type === 'operator' && peek().value === 'or') {
        consume();
        left = {type: 'logical', op: 'or', left, right: parseAnd()};
      }
      return left;
    }

    function parseAnd() {
      let left = parseNot();
      while (peek().type === 'operator' && peek().value === 'and') {
        consume();
        left = {type: 'logical', op: 'and', left, right: parseNot()};
      }
      return left;
    }

    function parseNot() {
      if (peek().type === 'operator' && peek().value === 'not') {
        consume();
        return {type: 'unary', op: 'not', value: parseNot()};
      }
      return parseComparison();
    }

    function parseComparison() {
      const left = parseAdditive();
      if (peek().type === 'operator' && ['=', '==', '!=', '>=', '<=', '>', '<'].includes(peek().value)) {
        const op = consume().value;
        return {type: 'comparison', op, left, right: parseAdditive()};
      }
      return left;
    }

    function parseAdditive() {
      let left = parseMultiplicative();
      while (peek().type === 'operator' && ['+', '-'].includes(peek().value)) {
        const op = consume().value;
        left = {type: 'arithmetic', op, left, right: parseMultiplicative()};
      }
      return left;
    }

    function parseMultiplicative() {
      let left = parsePrimary();
      while (peek().type === 'operator' && ['*', '/'].includes(peek().value)) {
        const op = consume().value;
        left = {type: 'arithmetic', op, left, right: parsePrimary()};
      }
      return left;
    }

    function parsePrimary() {
      const token = peek();
      if (token.type === 'identifier') {
        consume();
        return {type: 'identifier', name: normalizeVariable(token.value)};
      }
      if (token.type === 'literal') {
        consume();
        return {type: 'literal', value: token.value, raw: token.raw};
      }
      if (token.type === 'paren' && token.value === '(') {
        consume('(');
        const inner = parseOr();
        if (peek().type === 'paren' && peek().value === ')') {
          consume(')');
          return {type: 'group', value: inner};
        }
        return null;
      }
      return null;
    }
  }

  function readQuoted(text, start) {
    const quote = text.charAt(start);
    let value = '';
    let escaped = false;
    for (let index = start + 1; index < text.length; index += 1) {
      const char = text.charAt(index);
      if (escaped) {
        value += char;
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        return {value, raw: text.slice(start, index + 1), next: index + 1};
      } else {
        value += char;
      }
    }
    return null;
  }

  function dependenciesForAst(ast) {
    if (!ast) {
      return [];
    }
    if (ast.type === 'identifier') {
      return ast.name && !RESERVED_WORDS.has(ast.name) ? [ast.name] : [];
    }
    if (ast.type === 'literal') {
      return [];
    }
    return unique([].concat(
      dependenciesForAst(ast.left),
      dependenciesForAst(ast.right),
      dependenciesForAst(ast.value)
    ));
  }

  function operatorsForAst(ast) {
    if (!ast) {
      return [];
    }
    return unique([ast.op || ''].filter(Boolean).concat(
      operatorsForAst(ast.left),
      operatorsForAst(ast.right),
      operatorsForAst(ast.value)
    ));
  }

  function comparisonsForAst(ast) {
    if (!ast) {
      return [];
    }
    const rows = [];
    if (ast.type === 'comparison') {
      rows.push({
        left: expressionLabel(ast.left),
        op: ast.op,
        right: expressionLabel(ast.right),
        dependencies: unique(dependenciesForAst(ast.left).concat(dependenciesForAst(ast.right)))
      });
    }
    rows.push.apply(rows, comparisonsForAst(ast.left));
    rows.push.apply(rows, comparisonsForAst(ast.right));
    rows.push.apply(rows, comparisonsForAst(ast.value));
    return rows;
  }

  function expressionLabel(ast) {
    if (!ast) {
      return '';
    }
    if (ast.type === 'identifier') {
      return ast.name;
    }
    if (ast.type === 'literal') {
      return ast.raw !== undefined ? String(ast.raw) : String(ast.value);
    }
    if (ast.type === 'group') {
      return '(' + expressionLabel(ast.value) + ')';
    }
    if (ast.type === 'unary') {
      return ast.op + ' ' + expressionLabel(ast.value);
    }
    if (ast.left || ast.right) {
      return [expressionLabel(ast.left), ast.op, expressionLabel(ast.right)].filter(Boolean).join(' ');
    }
    return '';
  }

  function dynamicQRefs(raw) {
    const refs = [];
    const pattern = /Q\s*\[([^\]]+)\]/g;
    let match = pattern.exec(String(raw || ''));
    while (match) {
      refs.push({
        expression: match[1].trim(),
        dependencies: variablesIn(match[1]),
        raw: match[0]
      });
      match = pattern.exec(String(raw || ''));
    }
    return refs;
  }

  function variablesIn(raw) {
    const text = stripQuotedStrings(String(raw || '').replace(/Q\s*\[[^\]]+\]/g, ' '));
    const values = [];
    const pattern = /\b(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\b/g;
    let match = pattern.exec(text);
    while (match) {
      const name = normalizeVariable(match[1]);
      const lower = name.toLowerCase();
      if (!RESERVED_WORDS.has(lower) && !['Q', 'NaN', 'Infinity'].includes(name) && !/^\d/.test(name)) {
        values.push(name);
      }
      match = pattern.exec(text);
    }
    return unique(values);
  }

  function stripQuotedStrings(value) {
    let out = '';
    let quote = '';
    let escaped = false;
    String(value || '').split('').forEach((char) => {
      if (escaped) {
        escaped = false;
        return;
      }
      if (quote) {
        if (char === '\\') {
          escaped = true;
        } else if (char === quote) {
          quote = '';
        }
        return;
      }
      if (char === '"' || char === "'") {
        quote = char;
        return;
      }
      out += char;
    });
    return out;
  }

  function normalizeVariable(value) {
    return String(value || '').replace(/^Q\./, '');
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
