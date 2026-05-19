// @ts-check
(function initProjectMapEventWorkbench(global) {
  'use strict';

  const EVENT_WORKBENCH_VERSION = '0.1';
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const PROTECTED_PATHS = new Set([
    'source/scenes/root.scene.dry',
    'source/scenes/post_event.scene.dry',
    'source/scenes/post_event_news.scene.dry'
  ]);

  /**
   * @typedef {import('../types/project_map_contracts').EventWorkbenchModel} EventWorkbenchModel
   * @typedef {import('../types/project_map_contracts').ProjectIndex} ProjectIndex
   * @typedef {import('../types/project_map_contracts').ProjectIndexScene} ProjectIndexScene
   * @typedef {import('../types/project_map_contracts').SceneRouteState} SceneRouteState
   * @typedef {import('../types/project_map_contracts').SourceRef} SourceRef
   */

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function ownershipMatchingApi() {
    if (global && global.ProjectMapOwnershipMatching) {
      return global.ProjectMapOwnershipMatching;
    }
    if (typeof require === 'function') {
      try {
        return require('./ownership_matching_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function routeStateApi() {
    if (global && global.ProjectMapRouteStateModel) {
      return global.ProjectMapRouteStateModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./route_state_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  /**
   * @param {ProjectIndex|unknown} projectIndex
   * @param {ProjectIndexScene|string|unknown} sceneOrId
   * @param {Record<string, unknown>=} options
   * @returns {EventWorkbenchModel}
   */
  function buildEventWorkbench(projectIndex, sceneOrId, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    const lookup = buildLookup(index);
    const scene = resolveScene(lookup, sceneOrId);
    if (!scene) {
      return emptyWorkbench(sceneOrId);
    }
    const textRows = textRowsForScene(lookup, scene);
    const scriptRows = textRows.filter(isEffectScriptRow);
    const playerRows = textRows.filter((row) => !isEffectScriptRow(row));
    const effectRows = effectsForScene(lookup, scene, scriptRows).map((row) => effectEditActionRow(index, scene, row));
    const variables = variablesForScene(lookup, scene);
    const links = linksForScene(lookup, scene);
    const diagnostics = diagnosticsForScene(lookup, scene);
    const conditions = conditionCards(scene, playerRows);
    const eventOptions = optionRows(index, scene, playerRows, effectRows);
    const routeState = buildRouteState(index, scene, opts);
    const path = sourcePath(scene);

    return {
      schemaVersion: EVENT_WORKBENCH_VERSION,
      kind: 'event_workbench',
      sceneId: String(scene.id || ''),
      title: String(scene.title || scene.id || ''),
      sceneType: String(scene.type || 'event'),
      confidence: scene.classificationConfidence || scene.confidence || 'static_inferred',
      summary: {
        timing: timingSummary(conditions),
        conditionCount: conditions.length,
        optionCount: eventOptions.length,
        effectCount: effectRows.length,
        variableCount: variables.length,
        linkCount: links.outgoing.length + links.incoming.length,
        routeStateCount: routeState.summary.routeStateCount || 0,
        routePredicateDependencyCount: routeState.summary.predicateDependencyCount || 0,
        textCount: playerRows.length
      },
      playerText: playerRows.map((row) => playerTextRow(row, index)),
      options: eventOptions,
      conditions,
      effects: effectRows,
      variables,
      links,
      routeState,
      diagnostics,
      actions: actionRows(scene),
      advanced: {
        source: scene.sourceSpan || scene.topLevelSpan || {path},
        path,
        rawViewIf: String(scene.viewIf || ''),
        tags: ensureArray(scene.tags).map(String),
        notCaptured: notCapturedNotes(opts.locale)
      }
    };
  }

  function buildActionDraft(projectIndex, sceneOrId, action, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    const lookup = buildLookup(index);
    const scene = resolveScene(lookup, sceneOrId);
    if (!scene) {
      return actionUnsupported(action, 'event_workbench_action.not_found', 'No matching event was found.');
    }
    const workbench = buildEventWorkbench(index, scene, opts);
    const actionId = String(action || '').trim();
    if (actionId === 'edit_text') {
      return textProposalFromWorkbench(workbench, opts);
    }
    if (actionId === 'copy_alt_timeline') {
      return eventDraftFromWorkbench(workbench, lookup, 'alternate', opts);
    }
    if (actionId === 'follow_up') {
      return eventDraftFromWorkbench(workbench, lookup, 'follow_up', opts);
    }
    return actionUnsupported(actionId, 'event_workbench_action.unknown', 'Unknown Event Workbench action: ' + actionId);
  }

  function notCapturedNotes(locale) {
    if (locale === 'zh-Hant') {
      return [
        'Studio 目前用 source line 證據摘要效果，還不能完整復原任意 JavaScript 區塊。',
        'Router、root init、migration、hand/deck/sidebar wiring 仍是審查項目，除非之後的 install plan 明確標成安全。'
      ];
    }
    return [
      'Studio shows source-line evidence for effects; it does not fully reconstruct arbitrary JavaScript blocks.',
      'Router, root init, migration, hand/deck/sidebar wiring remain review-only unless a later install plan marks them safe.'
    ];
  }

  function emptyWorkbench(sceneOrId) {
    return {
      schemaVersion: EVENT_WORKBENCH_VERSION,
      kind: 'event_workbench',
      sceneId: String(sceneOrId || ''),
      title: '(event not found)',
      sceneType: 'event',
      confidence: 'opaque',
      summary: {},
      playerText: [],
      options: [],
      conditions: [],
      effects: [],
      variables: [],
      links: {outgoing: [], incoming: []},
      routeState: emptyRouteState(sceneOrId),
      diagnostics: [{severity: 'warning', code: 'event_workbench.not_found', message: 'No matching scene was found.'}],
      actions: [],
      advanced: {}
    };
  }

  function buildRouteState(index, scene, opts) {
    const routeState = routeStateApi();
    if (!routeState || typeof routeState.routeStatesForScene !== 'function') {
      return emptyRouteState(scene && scene.id);
    }
    return routeState.routeStatesForScene(index, scene, {sampleLimit: opts.sampleLimit || 6});
  }

  /**
   * @param {unknown} sceneOrId
   * @returns {SceneRouteState}
   */
  function emptyRouteState(sceneOrId) {
    return {
      schemaVersion: EVENT_WORKBENCH_VERSION,
      kind: 'scene_route_state',
      sceneId: String(sceneOrId || ''),
      title: '',
      summary: {
        routeStateCount: 0,
        routeCandidateCount: 0,
        orderedChainCount: 0,
        predicateRouteCount: 0,
        fallbackCount: 0,
        dynamicTargetCount: 0,
        unresolvedTargetCount: 0,
        possibleRandomRouteCount: 0,
        unconditionalMixedRouteCount: 0,
        explicitExclusiveRouteCount: 0,
        setJumpCount: 0,
        goToRefCount: 0,
        conditionStateCount: 0,
        predicateDependencyCount: 0,
        opaquePredicateCount: 0,
        preRouteScriptCount: 0,
        preRouteRouteDependencyWriteCount: 0,
        preRouteOpaqueScriptCount: 0,
        collisionTestedRouteCount: 0,
        collisionProvenMultiValidCount: 0,
        diagnosticCount: 0
      },
      states: [],
      conditionStates: [],
      diagnostics: []
    };
  }

  function buildLookup(index) {
    const scenes = ensureArray(index.scenes);
    const scenesById = new Map();
    scenes.forEach((scene) => {
      if (scene && scene.id) {
        scenesById.set(String(scene.id), scene);
      }
    });
    return {
      index,
      scenes,
      scenesById,
      edges: ensureArray(index.edges),
      variables: ensureArray(index.variables),
      diagnostics: ensureArray(index.diagnostics),
      textCorpus: ensureArray(index.semantic && index.semantic.textCorpus && index.semantic.textCorpus.items)
    };
  }

  function resolveScene(lookup, sceneOrId) {
    if (isObject(sceneOrId)) {
      if (sceneOrId.scene && sceneOrId.scene.id) {
        return sceneOrId.scene;
      }
      const linked = sceneOrId.linkedSceneId || sceneOrId.sceneId || sceneOrId.id;
      if (linked && lookup.scenesById.has(String(linked))) {
        return lookup.scenesById.get(String(linked));
      }
      if (sceneOrId.id || sceneOrId.sourceSpan || sceneOrId.path) {
        return sceneOrId;
      }
    }
    return lookup.scenesById.get(String(sceneOrId || '')) || null;
  }

  function textRowsForScene(lookup, scene) {
    const id = String(scene.id || '');
    const span = scene.sourceSpan || scene.topLevelSpan || {};
    const path = sourcePath(scene);
    return lookup.textCorpus
      .filter((item) => item && item.owner && String(item.owner.sceneId || '') === id)
      .filter((item) => {
        if (!item.source || !item.source.path || !path) {
          return true;
        }
        return String(item.source.path) === path;
      })
      .filter((item) => {
        const line = sourceLine(item.source);
        if (!line || !span.startLine || !span.endLine) {
          return true;
        }
        return line >= span.startLine && line <= span.endLine;
      })
      .sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
  }

  function isEffectScriptRow(row) {
    const text = String(row && row.text || '').trim();
    if (!text) {
      return false;
    }
    if (/^(?:on-arrival|on-departure|on-display)\s*:/i.test(text)) {
      return true;
    }
    if (/^(?:Q\.)?[A-Za-z_][A-Za-z0-9_]*\s*(?:[+\-*/]?=)/.test(text) && /(?:^|;)\s*(?:Q\.)?[A-Za-z_][A-Za-z0-9_]*\s*(?:[+\-*/]?=)/.test(text)) {
      return true;
    }
    if (/^Q\.[A-Za-z_][A-Za-z0-9_]*\s*(?:[+\-*/]?=)/.test(text)) {
      return true;
    }
    return /(?:^|[;\s])Q\.[A-Za-z_][A-Za-z0-9_]*\s*(?:[+\-*/]?=)/.test(text) && text.includes(';');
  }

  function playerTextRow(row, projectIndex) {
    const owner = row.owner || {};
    const output = {
      id: row.id || '',
      role: String(row.role || 'text'),
      label: roleLabel(row.role),
      text: String(row.text || ''),
      source: row.source || null,
      editability: row.editability || '',
      owner: {
        sceneId: owner.sceneId || '',
        sectionId: owner.sectionId || '',
        itemId: owner.itemId || '',
        kind: owner.kind || ''
      },
      sectionId: row.owner && row.owner.sectionId || '',
      optionId: row.optionId || '',
      conditions: ensureArray(row.conditions)
    };
    output.editAction = visibleEditAction(projectIndex, 'textCorpus', row, {
      area: 'story',
      objectType: objectTypeForTextRow(row),
      role: output.role,
      label: output.label || output.text,
      safeEligible: true,
      previewEligible: true
    });
    return output;
  }

  function objectTypeForTextRow(row) {
    const owner = row && row.owner || {};
    if (String(owner.sceneType || '').toLowerCase().includes('card')) {
      return 'card';
    }
    return 'event_text';
  }

  function roleLabel(role) {
    const labels = {
      title: 'Title',
      heading: 'Heading',
      subtitle: 'Subtitle',
      body: 'Body',
      conditional_body: 'Conditional text',
      option_label: 'Player option',
      option_subtitle: 'Option subtitle',
      unavailable_text: 'Unavailable text',
      news_headline: 'News headline',
      news_description: 'News description',
      monthly_popup_excerpt: 'Monthly popup excerpt'
    };
    return labels[String(role || '')] || String(role || 'Text');
  }

  function effectsForScene(lookup, scene, scriptRows) {
    const path = sourcePath(scene);
    const span = scene.sourceSpan || scene.topLevelSpan || {};
    const rows = [];
    const seen = new Set();
    const structuredWrites = new Set();
    ensureArray(scene && scene.effects).forEach((effect) => {
      const item = normalizeSceneEffect(effect);
      pushUniqueEffect(rows, seen, item);
      structuredWrites.add(effectWriteKey(item));
    });
    ensureArray(scriptRows).forEach((row) => {
      parseEffectText(row.text).forEach((effect) => {
        const item = Object.assign({}, effect, {
          source: row.source || null,
          sectionId: row.owner && row.owner.sectionId || '',
          evidence: 'script_text'
        });
        pushUniqueEffect(rows, seen, item);
        structuredWrites.add(effectWriteKey(item));
      });
    });
    lookup.variables.forEach((variable) => {
      ensureArray(variable.writes).forEach((source) => {
        if (!sourceInScene(source, path, span)) {
          return;
        }
        const sectionId = sectionForLine(scene, sourceLine(source));
        if (structuredWrites.has([String(variable.name || ''), sourceLine(source), sectionId].join('|'))) {
          return;
        }
        pushUniqueEffect(rows, seen, {
          variable: String(variable.name || ''),
          op: 'writes',
          value: '',
          source,
          sectionId,
          evidence: 'variable_write'
        });
      });
    });
    return rows.sort((a, b) => sourceLine(a.source) - sourceLine(b.source) || sourceOrder(a) - sourceOrder(b) || a.variable.localeCompare(b.variable));
  }

  function effectWriteKey(effect) {
    return [String(effect && effect.variable || ''), sourceLine(effect && effect.source), String(effect && effect.sectionId || '')].join('|');
  }

  function normalizeSceneEffect(effect) {
    const variable = String(effect && effect.variable || '').trim();
    const op = String(effect && (effect.op || effect.operator) || '').trim();
    const value = String(effect && effect.value === undefined || effect && effect.value === null ? '' : effect && effect.value).trim();
    const condition = String(effect && effect.condition || '').trim();
    const expression = String(effect && (effect.displayExpression || effect.expression) || '').trim() ||
      effectExpression(variable, op, value, condition, true);
    const sourceExpression = String(effect && effect.sourceExpression || '').trim() ||
      effectExpression(variable, op, value, condition, effect && effect.syntax !== 'dendry_shorthand');
    return {
      variable,
      op,
      value,
      condition,
      hook: String(effect && effect.hook || ''),
      syntax: String(effect && effect.syntax || ''),
      expression,
      displayExpression: expression,
      sourceExpression,
      sourceOrder: Number(effect && effect.sourceOrder || 0) || 0,
      source: effect && effect.source || null,
      sectionId: String(effect && effect.sectionId || ''),
      evidence: effect && effect.evidence || 'scene_effect'
    };
  }

  function parseEffectText(text) {
    const rows = [];
    const raw = String(text || '').trim();
    const hookMatch = raw.match(/^(on-arrival|on-departure|on-display)\s*:\s*(.+)$/i);
    const hook = hookMatch ? hookMatch[1].toLowerCase() : '';
    const body = hookMatch ? hookMatch[2] : raw;
    splitEffectClauses(body).forEach((clause, index) => {
      const parsed = parseEffectClause(clause, hook);
      if (parsed) {
        parsed.sourceOrder = index + 1;
        rows.push(parsed);
      }
    });
    return rows;
  }

  function splitEffectClauses(text) {
    const clauses = [];
    let current = '';
    let quote = '';
    let escaped = false;
    String(text || '').split('').forEach((char) => {
      if (escaped) {
        current += char;
        escaped = false;
        return;
      }
      if (char === '\\' && quote) {
        current += char;
        escaped = true;
        return;
      }
      if (quote) {
        current += char;
        if (char === quote) {
          quote = '';
        }
        return;
      }
      if (char === '"' || char === "'") {
        quote = char;
        current += char;
        return;
      }
      if (char === ';') {
        if (current.trim()) {
          clauses.push(current.trim());
        }
        current = '';
        return;
      }
      current += char;
    });
    if (current.trim()) {
      clauses.push(current.trim());
    }
    return clauses;
  }

  function parseEffectClause(clause, hook) {
    const parts = splitTrailingIf(clause);
    const match = parts.expression.match(/^(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|\/=|=)\s*(.+)$/);
    if (!match) {
      return null;
    }
    const syntax = hook && !/^Q\./.test(parts.expression) ? 'dendry_shorthand' : '';
    const variable = match[1];
    const op = match[2];
    const value = String(match[3] || '').trim();
    return {
      variable,
      op,
      value,
      condition: parts.condition,
      hook,
      syntax,
      expression: effectExpression(variable, op, value, parts.condition, true),
      displayExpression: effectExpression(variable, op, value, parts.condition, true),
      sourceExpression: effectExpression(variable, op, value, parts.condition, syntax !== 'dendry_shorthand')
    };
  }

  function splitTrailingIf(value) {
    const text = String(value || '').trim();
    let quote = '';
    let escaped = false;
    let splitAt = -1;
    for (let index = 0; index < text.length; index += 1) {
      const char = text.charAt(index);
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\' && quote) {
        escaped = true;
        continue;
      }
      if (quote) {
        if (char === quote) {
          quote = '';
        }
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (text.slice(index, index + 4).toLowerCase() === ' if ') {
        splitAt = index;
      }
    }
    if (splitAt < 0) {
      return {expression: text, condition: ''};
    }
    return {expression: text.slice(0, splitAt).trim(), condition: text.slice(splitAt + 4).trim()};
  }

  function effectExpression(variable, op, value, condition, qPrefix) {
    if (!variable || !op || !value) {
      return '';
    }
    return (qPrefix ? 'Q.' : '') + variable + ' ' + op + ' ' + value + (condition ? ' if ' + condition : '');
  }

  function sourceOrder(effect) {
    return Number(effect && effect.sourceOrder || 0) || 0;
  }

  function pushUniqueEffect(rows, seen, item) {
    if (!item.variable) {
      return;
    }
    const key = [item.variable, item.op, item.value, item.condition || '', item.sourceExpression || item.expression || '', sourceLine(item.source), item.sectionId].join('|');
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    rows.push(item);
  }

  function variablesForScene(lookup, scene) {
    const path = sourcePath(scene);
    const span = scene.sourceSpan || scene.topLevelSpan || {};
    const rows = [];
    lookup.variables.forEach((variable) => {
      const reads = ensureArray(variable.reads).filter((source) => sourceInScene(source, path, span));
      const writes = ensureArray(variable.writes).filter((source) => sourceInScene(source, path, span));
      if (!reads.length && !writes.length) {
        return;
      }
      const accesses = [];
      if (reads.length) {
        accesses.push('read');
      }
      if (writes.length) {
        accesses.push('write');
      }
      rows.push({
        name: String(variable.name || ''),
        label: humanVariable(variable.name),
        accesses,
        readCount: reads.length,
        writeCount: writes.length,
        totalReadCount: Number(variable.readCount || 0),
        totalWriteCount: Number(variable.writeCount || 0),
        reads,
        writes,
        tags: ensureArray(variable.tags)
      });
    });
    return rows.sort((a, b) => {
      const aw = a.accesses.includes('write') ? 0 : 1;
      const bw = b.accesses.includes('write') ? 0 : 1;
      return aw - bw || a.name.localeCompare(b.name);
    });
  }

  function sourceInScene(source, path, span) {
    if (!source || String(source.path || '') !== String(path || '')) {
      return false;
    }
    const line = sourceLine(source);
    if (!line || !span.startLine || !span.endLine) {
      return true;
    }
    return line >= span.startLine && line <= span.endLine;
  }

  function sourceLine(source) {
    return Number(source && (source.line || source.startLine)) || 0;
  }

  function sourcePath(scene) {
    return String(scene && (scene.path || (scene.sourceSpan && scene.sourceSpan.path) || (scene.topLevelSpan && scene.topLevelSpan.path)) || '');
  }

  function humanVariable(name) {
    return String(name || '').replace(/^Q\./, '').replace(/_/g, ' ');
  }

  function sectionForLine(scene, line) {
    if (!line) {
      return '';
    }
    const section = ensureArray(scene.sections).find((item) => {
      const span = item && item.sourceSpan || {};
      return span.startLine && span.endLine && line >= span.startLine && line <= span.endLine;
    });
    return section && section.id || '';
  }

  function conditionCards(scene, textRows) {
    const raw = [];
    if (scene.viewIf) {
      raw.push(String(scene.viewIf));
    }
    ensureArray(textRows).forEach((row) => {
      ensureArray(row.conditions).forEach((condition) => raw.push(String(condition || '')));
    });
    ensureArray(scene.sections).forEach((section) => {
      if (section.chooseIf) {
        raw.push(String(section.chooseIf));
      }
    });
    const cards = [];
    const seen = new Set();
    unique(raw).forEach((condition) => {
      splitClauses(condition).forEach((clause) => {
        const card = conditionCardForClause(clause);
        const key = [card.kind, card.variable || '', card.op || '', card.value || '', card.raw].join('|');
        if (!seen.has(key)) {
          seen.add(key);
          cards.push(card);
        }
      });
    });
    return cards;
  }

  function splitClauses(condition) {
    return String(condition || '')
      .split(/\s+\band\b\s+/i)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function conditionCardForClause(clause) {
    let match = clause.match(/^year\s*=\s*(\d+)$/i);
    if (match) {
      return {kind: 'year', label: 'Year', value: Number(match[1]), raw: clause};
    }
    match = clause.match(/^month\s*(>=|<=|=|>|<)\s*(\d+)$/i);
    if (match) {
      return {kind: 'month', label: 'Month', op: match[1], value: Number(match[2]), raw: clause};
    }
    match = clause.match(/^([A-Za-z_][A-Za-z0-9_]*_seen)\s*=\s*0$/);
    if (match) {
      return {kind: 'seen_flag', label: 'Not seen yet', variable: match[1], op: '=', value: 0, raw: clause};
    }
    match = clause.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(=|!=|>=|<=|>|<)\s*(.+)$/);
    if (match) {
      return {
        kind: 'variable',
        label: humanVariable(match[1]),
        variable: match[1],
        op: match[2],
        value: match[3].trim(),
        raw: clause
      };
    }
    return {kind: 'opaque', label: 'Advanced condition', raw: clause};
  }

  function timingSummary(cards) {
    const year = cards.find((item) => item.kind === 'year');
    const monthCards = cards.filter((item) => item.kind === 'month');
    if (!year && !monthCards.length) {
      return '';
    }
    const months = monthCards.map((item) => item.op + ' ' + item.value).join(', ');
    return [year ? String(year.value) : '', months ? 'month ' + months : ''].filter(Boolean).join(' / ');
  }

  function optionRows(projectIndex, scene, textRows, effects) {
    const ownership = ownershipMatchingApi();
    const sectionByTarget = new Map();
    ensureArray(scene.sections).forEach((section) => {
      const local = String(section.id || '').split('.').pop();
      if (local) {
        sectionByTarget.set(local, section);
      }
    });
    return ensureArray(scene.options).map((option, index) => {
      const target = option.target && option.target.id || '';
      const section = sectionByTarget.get(String(target || '').replace(/^@/, '')) || null;
      const sectionId = section && section.id || '';
      const sourceTexts = textRows.filter((row) => {
        const owner = row.owner || {};
        if (!ownership || typeof ownership.ownerMatchesOption !== 'function') {
          return row.optionId === target || owner.sectionId === sectionId;
        }
        return ownership.ownerMatchesOption({optionId: row.optionId, sectionId: owner.sectionId}, {
          id: target,
          targetId: target,
          rawTargetId: target,
          sectionId
        });
      }).filter((row) => !isEffectScriptRow(row));
      const sectionEffects = effects.filter((effect) => {
        if (!sectionId) {
          return false;
        }
        return ownership && typeof ownership.ownerMatchesSection === 'function'
          ? ownership.ownerMatchesSection(effect, sectionId)
          : effect.sectionId === sectionId;
      });
      const output = {
        index,
        id: String(target || option.id || ('option_' + (index + 1))),
        label: String(option.title || ''),
        target: String(target || ''),
        source: option.sourceSpan || option.source || null,
        chooseIf: option.chooseIf || (section && section.chooseIf) || '',
        unavailableText: option.unavailableText || (section && section.unavailableSubtitle) || '',
        subtitle: section && section.subtitle || '',
        text: sourceTexts.map((row) => playerTextRow(row, projectIndex)),
        effects: sectionEffects
      };
      const optionItem = {
        id: output.id,
        title: output.label,
        text: output.label,
        source: output.source || sourceTexts[0] && sourceTexts[0].source || null,
        owner: {sceneId: String(scene.id || ''), sectionId, kind: 'scene', sceneType: scene.type || ''}
      };
      output.editAction = visibleEditAction(projectIndex, 'textCorpus', optionItem, {
        area: 'story',
        objectType: String(scene.type || '').toLowerCase().includes('card') ? 'card' : 'event_text',
        role: 'option_label',
        label: output.label || output.id,
        safeEligible: true,
        previewEligible: true
      });
      return output;
    });
  }

  function effectEditActionRow(projectIndex, scene, row) {
    const output = Object.assign({}, row || {});
    const expression = output.displayExpression || output.sourceExpression || effectLabelForAction(output);
    output.editAction = visibleEditAction(projectIndex, 'structuredLogic', {
      id: [scene && scene.id || '', 'effect', output.variable || '', sourceLine(output.source)].join(':'),
      text: expression,
      label: expression,
      source: output.source || null,
      owner: {sceneId: String(scene && scene.id || ''), sectionId: output.sectionId || '', kind: 'scene'}
    }, {
      area: 'story',
      objectType: 'structured_logic',
      role: 'effect',
      label: expression,
      safeEligible: true,
      previewEligible: true
    });
    return output;
  }

  function effectLabelForAction(row) {
    return [row && row.variable, row && row.op, row && row.value].filter(Boolean).join(' ');
  }

  function visibleEditAction(projectIndex, view, item, hints) {
    const value = item || {};
    const owner = value.owner || {};
    const source = actionSource(value.source || value.sourceSpan || {});
    const role = String(hints && hints.role || value.role || '');
    const sceneId = String(owner.sceneId || value.sceneId || value.id || '');
    const installSafety = safetyForActionSource(source);
    const operationType = source.endLine && source.line && source.endLine !== source.line ? 'replace_section' : 'replace_text';
    const protectedSource = installSafety === 'advanced_apply';
    if (!source.path && view !== 'variables') {
      return null;
    }
    if (view === 'structuredLogic') {
      return sourceEditAction(value, hints, source, protectedSource, operationType);
    }
    if (view === 'textCorpus' && sceneId && !protectedSource && isSectionTextRole(role)) {
      const scene = findSceneById(projectIndex, sceneId);
      const targetView = scene && String(scene.type || '').toLowerCase().includes('card') || owner.sceneType === 'card' ? 'cards' : 'events';
      return {
        schemaVersion: '0.1',
        kind: 'visible_edit_action',
        actionKind: 'open_object_section',
        routeClass: 'direct_section_replace',
        targetView,
        targetId: sceneId,
        fieldId: String(owner.sectionId || value.sectionId || ''),
        valueKey: 'block:' + String(owner.sectionId || value.sectionId || ''),
        source,
        installSafety: 'guarded_apply',
        operationType: 'replace_section',
        operationTemplate: null,
        routeReason: 'Open the owning object editor for this visible section.',
        target: {workspace: 'content', view: targetView, sceneId, source},
        visibleContent: true
      };
    }
    return sourceEditAction(value, hints, source, protectedSource, operationType);
  }

  function sourceEditAction(item, hints, source, protectedSource, operationType) {
    return {
      schemaVersion: '0.1',
      kind: 'visible_edit_action',
      actionKind: protectedSource ? 'open_advanced_source_patch' : 'open_source_slice',
      routeClass: protectedSource ? 'advanced_source_patch' : 'source_slice_editor',
      targetView: 'source_slice',
      targetId: String(item && item.id || source.path || ''),
      fieldId: String(hints && hints.role || ''),
      valueKey: String(hints && hints.role || ''),
      source,
      installSafety: protectedSource ? 'advanced_apply' : 'guarded_apply',
      operationType,
      operationTemplate: {
        type: operationType,
        path: source.path,
        line: source.line || null,
        startLine: source.startLine || source.line || null,
        endLine: source.endLine || source.line || null,
        anchorText: source.anchorText || '',
        endAnchorText: source.endAnchorText || '',
        search: operationType === 'replace_text' ? source.anchorText || String(item && (item.text || item.label) || '') : '',
        replace: '',
        content: '',
        safety: protectedSource ? 'advanced_apply' : 'guarded_apply',
        description: 'Edit visible content from Event Workbench.'
      },
      routeReason: protectedSource
        ? 'Protected visible content opens Precise Source Edit with advanced apply.'
        : 'Visible content opens Precise Source Edit when a field route is not already known.',
      target: {workspace: 'content', view: 'source_slice', source},
      semanticEditor: semanticEditorForSourceAction(item, hints, source, protectedSource ? 'advanced_apply' : 'guarded_apply', operationType),
      visibleContent: true
    };
  }

  function semanticEditorForSourceAction(item, hints, source, installSafety, operationType) {
    const role = String(hints && hints.role || item && item.role || '');
    if (role !== 'route' && role !== 'condition' && role !== 'effect') {
      return null;
    }
    const owner = item && item.owner || {};
    const kind = role === 'effect' ? 'effect_clause' : 'route_order';
    return {
      schemaVersion: '0.1',
      kind,
      role,
      sceneId: String(owner.sceneId || item && item.sceneId || ''),
      fieldId: String(item && item.id || role || ''),
      valueKey: String(item && item.id || role || ''),
      label: String(hints && hints.label || item && (item.label || item.text || item.id) || ''),
      source,
      installSafety,
      operationType,
      editorRoute: kind === 'effect_clause' ? 'effect_clause_editor' : 'route_editor'
    };
  }

  function isSectionTextRole(role) {
    return ['body', 'conditional_body', 'subtitle', 'heading', 'title', 'news_description'].includes(String(role || ''));
  }

  function safetyForActionSource(source) {
    const path = String(source && source.path || '');
    return PROTECTED_PATHS.has(path) || path.indexOf('out/') === 0 ? 'advanced_apply' : 'guarded_apply';
  }

  function actionSource(source) {
    const value = source || {};
    const line = sourceLine(value);
    const endLine = Number(value.endLine || value.line || value.startLine) || line || null;
    return {
      path: String(value.path || ''),
      line: line || null,
      startLine: Number(value.startLine || value.line) || line || null,
      endLine,
      anchorText: String(value.anchorText || ''),
      endAnchorText: String(value.endAnchorText || value.anchorText || '')
    };
  }

  function findSceneById(index, sceneId) {
    return ensureArray(index && index.scenes).find((scene) => scene && String(scene.id || '') === String(sceneId || '')) || null;
  }

  function linksForScene(lookup, scene) {
    const id = String(scene.id || '');
    const belongs = (value) => value === id || String(value || '').startsWith(id + '.');
    const toRow = (edge, direction) => ({
      direction,
      from: edge.from || '',
      to: edge.to || '',
      kind: edge.kind || '',
      label: edge.label || edge.rawTarget || edge.condition || '',
      confidence: edge.confidence || '',
      source: edge.source || null
    });
    return {
      outgoing: lookup.edges.filter((edge) => belongs(edge.from)).map((edge) => toRow(edge, 'outgoing')),
      incoming: lookup.edges.filter((edge) => belongs(edge.to)).map((edge) => toRow(edge, 'incoming'))
    };
  }

  function diagnosticsForScene(lookup, scene) {
    const id = String(scene.id || '');
    const path = sourcePath(scene);
    return lookup.diagnostics.filter((diag) => {
      return String(diag.sceneId || '') === id || String(diag.path || '') === path ||
        (diag.source && String(diag.source.path || '') === path);
    });
  }

  function actionRows(scene) {
    const id = scene && scene.id || '';
    return [
      {
        id: 'edit_text',
        label: 'Rewrite player text',
        route: 'surface_text_proposal',
        safety: 'guarded_or_manual',
        description: 'Create a text replacement proposal from selected player-facing prose.'
      },
      {
        id: 'copy_alt_timeline',
        label: 'Copy as alternate timeline event',
        route: 'world_event_draft',
        safety: 'proposal_only',
        description: 'Seed a new event draft from ' + id + '. Review body text and effects before export.'
      },
      {
        id: 'follow_up',
        label: 'Create follow-up event',
        route: 'world_event_draft',
        safety: 'proposal_only',
        description: 'Create a new event that continues the selected beat.'
      }
    ];
  }

  function textProposalFromWorkbench(workbench, opts) {
    const row = preferredTextRow(workbench);
    if (!row || !String(row.text || '').trim()) {
      return actionUnsupported('edit_text', 'event_workbench_action.no_text', 'No player-facing text was extracted for this event.');
    }
    const locale = opts.locale === 'zh-Hant' ? 'zh-Hant' : 'en';
    const sceneId = workbench.sceneId || (row.owner && row.owner.sceneId) || '';
    const label = String(row.text || '').trim();
    const source = sourceRef(row.source || (workbench.advanced && workbench.advanced.source));
    const draft = {
      schemaVersion: '0.1',
      kind: 'surface_text',
      id: safeId('rewrite_event_text_' + (sceneId || workbench.title || 'event')),
      itemId: sceneId,
      area: String(row.role || 'event_text'),
      originalLabel: label,
      replacementLabel: String(opts.replacementText || opts.replacementLabel || label).trim(),
      editability: row.editability || 'ide_escape_hatch',
      source,
      reason: locale === 'zh-Hant'
        ? '從事件工作台建立的玩家文字改寫提案。Studio 會帶出來源與原文，但任意 scene body 改寫仍需要審查。'
        : 'Text rewrite proposal created from Event Workbench. Studio carries source evidence, but arbitrary scene body rewrites still need review.'
    };
    return {
      ok: Boolean(draft.originalLabel && draft.source.path),
      status: draft.editability === 'draft_exportable' ? 'draft' : 'ide_escape_hatch',
      template: 'surface',
      draft,
      source,
      diagnostics: draft.source.path ? [] : [diagnostic('warning', 'event_workbench_action.source_missing', 'No source path was available for this text proposal.')],
      captured: ['player-facing text', 'source path/line when available', 'replacement proposal'],
      notCaptured: ['automatic arbitrary scene body rewrite', 'runtime preview']
    };
  }

  function preferredTextRow(workbench) {
    const rows = ensureArray(workbench && workbench.playerText);
    const roles = ['body', 'conditional_body', 'heading', 'title', 'subtitle', 'option_label'];
    for (const role of roles) {
      const found = rows.find((row) => row && row.role === role && String(row.text || '').trim());
      if (found) {
        return found;
      }
    }
    return rows.find((row) => row && String(row.text || '').trim()) || null;
  }

  function eventDraftFromWorkbench(workbench, lookup, mode, opts) {
    const locale = opts.locale === 'zh-Hant' ? 'zh-Hant' : 'en';
    const timing = timingFromWorkbench(workbench);
    const schedule = mode === 'follow_up' ? nextTiming(timing) : timing;
    const sourceId = safeId(workbench.sceneId || workbench.title || 'event');
    const id = uniqueSceneId(
      mode === 'follow_up' ? sourceId + '_followup' : sourceId + '_alt_timeline',
      lookup.scenesById
    );
    const titlePrefix = mode === 'follow_up'
      ? (locale === 'zh-Hant' ? '後續：' : 'Follow-up: ')
      : (locale === 'zh-Hant' ? '另類世界線：' : 'Alternative: ');
    const contextLine = mode === 'follow_up'
      ? (locale === 'zh-Hant'
          ? '接續「' + (workbench.title || workbench.sceneId) + '」的新事件草稿。請把這段說明改成玩家會看到的正文。'
          : 'Draft a follow-up beat connected to "' + (workbench.title || workbench.sceneId) + '". Replace this note with player-facing prose.')
      : (locale === 'zh-Hant'
          ? '從「' + (workbench.title || workbench.sceneId) + '」複製出的另類世界線事件草稿。保留原事件脈絡，但請重新審查正文、條件與效果。'
          : 'Alternate timeline draft copied from "' + (workbench.title || workbench.sceneId) + '". Keep the context, then review prose, conditions, and effects.');
    const intro = mode === 'follow_up'
      ? [contextLine]
      : playerParagraphs(workbench, contextLine);
    const options = optionDraftsFromWorkbench(workbench, mode);
    const draft = {
      schemaVersion: '0.1',
      kind: 'world_event',
      id,
      title: titlePrefix + (workbench.title || workbench.sceneId || 'Event'),
      heading: titlePrefix + (workbench.title || workbench.sceneId || 'Event'),
      seenFlag: id + '_seen',
      when: {
        year: schedule.year,
        monthStart: schedule.monthStart,
        monthEnd: schedule.monthEnd,
        requires: mode === 'follow_up' ? '' : requirementTextFromWorkbench(workbench),
        priority: 0
      },
      effectsOnTrigger: mode === 'alternate' ? draftEffectsFromWorkbench(workbench).slice(0, 8) : [],
      introParagraphs: intro,
      options,
      sourceSceneId: workbench.sceneId,
      source: sourceRef(workbench.advanced && workbench.advanced.source),
      notes: {
        eventWorkbenchAction: mode,
        sourceTitle: workbench.title || '',
        sourceSceneId: workbench.sceneId || ''
      }
    };
    return {
      ok: true,
      status: 'partial',
      template: 'event',
      draft,
      source: draft.source,
      diagnostics: [diagnostic('warning', 'event_workbench_action.partial_scene_copy', mode === 'follow_up'
        ? 'Follow-up draft is a new event shell; review router/root wiring before install.'
        : 'Alternate timeline draft is best-effort; review copied conditions/effects before export.')],
      captured: mode === 'follow_up'
        ? ['source event title', 'next plausible month', 'source reference']
        : ['source event title', 'timing conditions', 'player-facing paragraphs', 'simple effects', 'parser option labels'],
      notCaptured: ['full arbitrary JavaScript behavior', 'router wiring', 'root init / migration install', 'runtime preview']
    };
  }

  function timingFromWorkbench(workbench) {
    const conditions = ensureArray(workbench && workbench.conditions);
    const year = Number((conditions.find((item) => item.kind === 'year') || {}).value) || 2025;
    let monthStart = 1;
    let monthEnd = 1;
    conditions.filter((item) => item.kind === 'month').forEach((item) => {
      const value = Number(item.value);
      if (!value) {
        return;
      }
      if (item.op === '>=' || item.op === '>' || item.op === '=') {
        monthStart = value;
      }
      if (item.op === '<=' || item.op === '<' || item.op === '=') {
        monthEnd = value;
      }
    });
    if (monthEnd < monthStart) {
      monthEnd = monthStart;
    }
    return {year, monthStart: clampMonth(monthStart), monthEnd: clampMonth(monthEnd)};
  }

  function nextTiming(timing) {
    let month = Number(timing.monthEnd || timing.monthStart || 1) + 1;
    let year = Number(timing.year || 2025);
    if (month > 12) {
      month = 1;
      year += 1;
    }
    return {year, monthStart: month, monthEnd: month};
  }

  function clampMonth(value) {
    const number = Number(value) || 1;
    return Math.max(1, Math.min(12, Math.round(number)));
  }

  function requirementTextFromWorkbench(workbench) {
    return ensureArray(workbench && workbench.conditions)
      .filter((item) => item.kind !== 'year' && item.kind !== 'month' && item.kind !== 'seen_flag')
      .map((item) => item.raw || [item.variable, item.op, item.value].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(' and ');
  }

  function playerParagraphs(workbench, fallback) {
    const rows = ensureArray(workbench && workbench.playerText)
      .filter((row) => row && ['body', 'conditional_body', 'heading', 'subtitle'].includes(row.role))
      .map((row) => String(row.text || '').trim())
      .filter(Boolean);
    return rows.length ? rows.slice(0, 6) : [fallback];
  }

  function optionDraftsFromWorkbench(workbench, mode) {
    const options = ensureArray(workbench && workbench.options).filter((option) => option && (option.label || option.id)).slice(0, 4);
    const rows = options.map((option, index) => {
      const optionId = safeId(option.id || 'option_' + (index + 1));
      const narrative = ensureArray(option.text)
        .map((row) => String(row.text || '').trim())
        .filter(Boolean)
        .slice(0, 2);
      return {
        id: optionId,
        label: String(option.label || ('Option ' + (index + 1))).trim(),
        subtitle: String(option.subtitle || '').trim(),
        chooseIf: mode === 'alternate' ? String(option.chooseIf || '').trim() : '',
        unavailableText: mode === 'alternate' ? String(option.unavailableText || '').trim() : '',
        effects: mode === 'alternate' ? simpleEffects(option.effects).slice(0, 6) : [],
        narrativeParagraphs: narrative,
        variants: [],
        gotoAfter: safeId('continue_' + optionId)
      };
    });
    while (rows.length < 2) {
      const number = rows.length + 1;
      rows.push({
        id: 'option_' + number,
        label: number === 1 ? 'Respond' : 'Wait',
        subtitle: '',
        chooseIf: '',
        unavailableText: '',
        effects: [],
        narrativeParagraphs: [],
        variants: [],
        gotoAfter: 'continue_option_' + number
      });
    }
    return rows;
  }

  function draftEffectsFromWorkbench(workbench) {
    const seenFlags = new Set(
      ensureArray(workbench && workbench.conditions)
        .filter((item) => item && item.kind === 'seen_flag' && item.variable)
        .map((item) => String(item.variable))
    );
    if (workbench && workbench.sceneId) {
      seenFlags.add(String(workbench.sceneId) + '_seen');
    }
    return simpleEffects(ensureArray(workbench && workbench.effects))
      .filter((effect) => !seenFlags.has(String(effect.variable || '')));
  }

  function simpleEffects(rows) {
    return ensureArray(rows)
      .map((row) => {
        const op = String(row && row.op || '').trim();
        if (!['=', '+=', '-='].includes(op)) {
          return null;
        }
        const variable = String(row.variable || '').trim();
        if (!ID_RE.test(variable)) {
          return null;
        }
        return {variable, op, value: String(row.value || '').trim() || '1'};
      })
      .filter(Boolean);
  }

  function uniqueSceneId(base, scenesById) {
    const root = safeId(base);
    if (!scenesById || !scenesById.has(root)) {
      return root;
    }
    let counter = 2;
    while (scenesById.has(root + '_' + counter) && counter < 1000) {
      counter += 1;
    }
    return root + '_' + counter;
  }

  function safeId(value) {
    let text = String(value || 'draft_item')
      .trim()
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!text) {
      text = 'draft_item';
    }
    if (!/^[A-Za-z_]/.test(text)) {
      text = 'draft_' + text;
    }
    return ID_RE.test(text) ? text : 'draft_item';
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    return {
      path: String(value.path || '').trim(),
      line: sourceLine(value) || null
    };
  }

  function actionUnsupported(action, code, message) {
    return {
      ok: false,
      status: 'unsupported',
      template: '',
      draft: null,
      diagnostics: [diagnostic('warning', code, message || 'Unsupported action: ' + action)]
    };
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message, confidence: 'static_inferred'};
  }

  function unique(values) {
    const seen = new Set();
    const result = [];
    ensureArray(values).forEach((value) => {
      const text = String(value || '').trim();
      if (text && !seen.has(text)) {
        seen.add(text);
        result.push(text);
      }
    });
    return result;
  }

  const api = {
    EVENT_WORKBENCH_VERSION,
    buildEventWorkbench,
    buildActionDraft,
    build: buildEventWorkbench
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapEventWorkbench = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
