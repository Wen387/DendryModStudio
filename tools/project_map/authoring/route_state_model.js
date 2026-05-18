// @ts-check
(function initProjectMapRouteStateModel(global) {
  'use strict';

  const ROUTE_STATE_VERSION = '0.1';
  const RESERVED_WORDS = new Set(['and', 'or', 'not', 'true', 'false', 'if']);

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
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  /**
   * @param {ProjectIndex|unknown} projectIndex
   * @param {Record<string, unknown>=} options
   * @returns {RouteStateModel}
   */
  function buildRouteStateModel(projectIndex, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const lookup = buildLookup(index);
    const states = routeStatesForLookup(lookup, '');

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
    const lookup = buildLookup(index);
    const scene = resolveScene(lookup, sceneOrId);
    if (!scene) {
      return emptySceneRouteState(sceneOrId);
    }
    const sceneId = String(scene.id || '');
    const states = routeStatesForLookup(lookup, sceneId);
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

  function routeStatesForLookup(lookup, sceneId) {
    const filterSceneId = String(sceneId || '');
    const groupSourceKeys = new Set();
    const states = [];
    lookup.routeOrderGroups.filter((group) => {
      return !filterSceneId || routeStateBelongsToScene({
        sceneId: group && group.sceneId || '',
        ownerId: group && group.ownerId || ''
      }, filterSceneId);
    }).forEach((group) => {
      const state = routeStateFromGroup(group, lookup);
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
      const state = routeStateFromEdge(edge, lookup, index + 1);
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

  function routeStateFromGroup(group, lookup) {
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
    });
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

  function routeStateFromEdge(edge, lookup, order) {
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
    });
  }

  function finalizeRouteState(state) {
    const candidates = ensureArray(state.candidates);
    const dependencies = unique(candidates.flatMap((candidate) => ensureArray(candidate.predicateSummary && candidate.predicateSummary.dependencies)));
    const dynamicTargetCount = candidates.filter((candidate) => candidate.dynamicTarget).length;
    const unresolvedTargetCount = candidates.filter((candidate) => !candidate.targetResolved).length;
    const fallbackCandidate = candidates.find((candidate) => candidate.isFallback) || null;
    return Object.assign({}, state, {
      candidateCount: candidates.length,
      fallbackCandidate,
      dependencies,
      predicateDependencyCount: dependencies.length,
      dynamicTargetCount,
      unresolvedTargetCount,
      status: unresolvedTargetCount ? 'needs_review' : dynamicTargetCount ? 'dynamic' : state.chainContext === 'direct' ? 'direct' : 'reviewable',
      summaryLabel: routeStateLabel(state, candidates, fallbackCandidate)
    });
  }

  /**
   * @param {string|unknown} rawInput
   * @returns {PredicateSummary}
   */
  function summarizePredicate(rawInput) {
    const raw = String(rawInput || '').trim();
    if (!raw) {
      return {
        schemaVersion: ROUTE_STATE_VERSION,
        kind: 'predicate_summary',
        raw,
        status: 'empty',
        dependencies: [],
        operators: [],
        comparisons: [],
        dynamicRefs: [],
        ast: null,
        opaqueReasons: []
      };
    }
    const dynamicRefs = dynamicQRefs(raw);
    const prepared = raw.replace(/Q\s*\[[^\]]+\]/g, 'dynamic_q_ref');
    const tokenized = tokenizePredicate(prepared);
    const fallbackDependencies = unique(variablesIn(raw));
    if (tokenized.unsupported.length) {
      return {
        schemaVersion: ROUTE_STATE_VERSION,
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
        schemaVersion: ROUTE_STATE_VERSION,
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
      schemaVersion: ROUTE_STATE_VERSION,
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
    scenes.forEach((scene) => {
      if (scene && scene.id) {
        scenesById.set(String(scene.id), scene);
      }
      ensureArray(scene && scene.sections).forEach((section) => {
        if (section && section.id) {
          sectionToScene.set(String(section.id), String(scene.id || ''));
        }
      });
    });
    const parserEvidence = index.semantic && index.semantic.parserEvidence || {};
    return {
      index,
      scenes,
      scenesById,
      sectionToScene,
      edges: ensureArray(index.edges),
      diagnostics: ensureArray(index.diagnostics),
      routeOrderGroups: parserEvidenceRows(parserEvidence, 'routeOrderGroups')
    };
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
