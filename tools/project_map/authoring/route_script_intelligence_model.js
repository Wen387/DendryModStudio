(function initProjectMapRouteScriptIntelligenceModel(global) {
  'use strict';

  const ROUTE_SCRIPT_INTELLIGENCE_VERSION = '0.1';
  const MODEL_KIND = 'route_script_intelligence_model';
  const GUIDED_OPS = new Set(['=', '+=', '-=']);
  const SCRIPT_SAFETY = Object.freeze({
    GUIDED: 'guided',
    ADVANCED: 'advanced_review',
    MANUAL: 'manual_boundary'
  });
  const SCRIPT_CATEGORY = Object.freeze({
    SIMPLE: 'simple_state_effect',
    CALCULATED: 'calculated_value',
    OPAQUE: 'opaque_js_block',
    UNKNOWN: 'unknown'
  });

  function buildRouteScriptIntelligence(eventBody, options) {
    const body = isObject(eventBody) ? clone(eventBody) : {};
    const opts = isObject(options) ? options : {};
    const scriptBlocks = buildScriptImpactMap(body, opts);
    const routeEvidence = buildRouteEvidenceMap(body, scriptBlocks, opts);
    const guidedScriptEdits = scriptBlocks.blocks.reduce((rows, block) => rows.concat(ensureArray(block.guidedEdits)), []);
    const diagnostics = diagnosticsFor(routeEvidence, scriptBlocks);
    return {
      schemaVersion: ROUTE_SCRIPT_INTELLIGENCE_VERSION,
      kind: MODEL_KIND,
      ok: !diagnostics.some((item) => item.severity === 'error'),
      eventId: stringValue(opts.eventId || body.eventStructure && body.eventStructure.id || body.id || ''),
      routes: routeEvidence,
      scripts: scriptBlocks,
      guidedScriptEdits,
      diagnostics,
      summary: buildModelSummary(routeEvidence, scriptBlocks, guidedScriptEdits, diagnostics)
    };
  }

  function buildModelSummary(routeEvidence, scriptBlocks, guidedScriptEdits, diagnostics) {
    return {
      routeCount: routeEvidence.items.length,
      scriptBlockCount: scriptBlocks.blocks.length,
      guidedScriptEditCount: guidedScriptEdits.length,
      exactRoutes: routeEvidence.summary.exact || 0,
      parserBackedRoutes: routeEvidence.summary.parser_backed || 0,
      fuzzyRoutes: routeEvidence.summary.fuzzy || 0,
      scriptDerivedRoutes: routeEvidence.summary.script_derived || 0,
      missingRoutes: routeEvidence.summary.missing_target || 0,
      manualScriptBlocks: scriptBlocks.summary[SCRIPT_SAFETY.MANUAL] || 0,
      advancedScriptBlocks: scriptBlocks.summary[SCRIPT_SAFETY.ADVANCED] || 0,
      guidedScriptBlocks: scriptBlocks.summary[SCRIPT_SAFETY.GUIDED] || 0,
      opaqueJsBlocks: scriptBlocks.categorySummary[SCRIPT_CATEGORY.OPAQUE] || 0,
      scriptCategoryCounts: scriptBlocks.categorySummary,
      manualScriptCategories: scriptBlocks.manualCategorySummary,
      advancedScriptCategories: scriptBlocks.advancedCategorySummary,
      warningCount: diagnostics.filter((item) => item.severity === 'warning').length,
      errorCount: diagnostics.filter((item) => item.severity === 'error').length
    };
  }

  function enrichEventBody(eventBody, options) {
    const body = isObject(eventBody) ? clone(eventBody) : {};
    const model = buildRouteScriptIntelligence(body, options || {});
    body.routeScriptIntelligence = {
      schemaVersion: model.schemaVersion,
      kind: model.kind,
      ok: model.ok,
      summary: model.summary,
      diagnostics: model.diagnostics
    };
    body.routeEvidenceMap = model.routes;
    body.scriptImpactMap = model.scripts;
    body.guidedScriptEdits = model.guidedScriptEdits;
    return body;
  }

  function buildRouteEvidenceMap(body, scriptBlocks, options) {
    const rows = [];
    ensureArray(body && body.flow && body.flow.edges).forEach((edge, index) => {
      if (!isRouteEdge(edge)) {
        return;
      }
      rows.push(routeItem({
        id: 'flow_route_' + (index + 1),
        sourceKind: 'flow',
        from: edge && edge.from,
        target: edge && (edge.to || edge.targetId || edge.rawTarget),
        rawTarget: edge && edge.rawTarget,
        predicate: edge && (edge.condition || edge.predicate),
        source: edge && edge.source,
        parserBacked: Boolean(edge && edge.parserBacked) || String(edge && edge.kind) === 'conditional_route',
        confidence: edge && edge.confidence,
        owner: edge && (edge.optionId || edge.from || edge.kind),
        body
      }));
    });
    ensureArray(body && body.metaFields).forEach((field, index) => {
      if (!field || String(field.role || field.semanticRole || '').toLowerCase() !== 'route') {
        return;
      }
      rows.push(routeItem({
        id: 'field_route_' + (index + 1),
        sourceKind: 'field',
        from: field.sectionId || field.owner && field.owner.sectionId || '',
        target: field.value || field.original,
        rawTarget: field.original || field.value,
        predicate: field.routePredicate || field.condition,
        source: field.source,
        confidence: field.confidence,
        owner: field.label || field.id,
        body
      }));
    });
    ensureArray(body && body.continuationMap && body.continuationMap.items).forEach((item, index) => {
      rows.push(routeItem({
        id: 'continuation_route_' + (index + 1),
        sourceKind: 'continuation',
        from: item && (item.choiceId || item.resultTarget),
        target: item && (item.nextTarget || item.rawTarget),
        rawTarget: item && item.rawTarget,
        predicate: firstPredicate(item && item.orderedRoutes),
        source: item && item.sourceEvidence,
        parserBacked: ensureArray(item && item.orderedRoutes).some((route) => route.parserBacked || route.predicate),
        confidence: item && item.kind === 'script_or_external_boundary' ? 'script' : '',
        owner: item && (item.choiceLabel || item.choiceId || item.kind),
        body
      }));
    });
    ensureArray(scriptBlocks && scriptBlocks.blocks).forEach((block, index) => {
      if (!block.routeInfluence) {
        return;
      }
      rows.push(routeItem({
        id: 'script_route_' + (index + 1),
        sourceKind: 'script',
        from: block.sectionId || block.hook || 'script',
        target: block.routeTargets[0] || 'script-controlled',
        rawTarget: block.routeTargets[0] || '',
        predicate: '',
        source: block.source,
        confidence: 'script',
        owner: block.label || block.id,
        body
      }));
    });
    const explicitRows = ensureArray(options && options.routeRows || body && body.routeIntelligenceRows);
    explicitRows.forEach((row, index) => {
      rows.push(routeItem(Object.assign({}, row, {
        id: row.id || 'explicit_route_' + (index + 1),
        sourceKind: row.sourceKind || 'explicit',
        body
      })));
    });
    const uniqueRows = uniqueRouteRows(rows);
    return {
      items: uniqueRows,
      summary: uniqueRows.reduce((out, item) => {
        const key = item.evidenceClass || 'unknown';
        out[key] = (out[key] || 0) + 1;
        return out;
      }, {})
    };
  }

  function buildScriptImpactMap(body, options) {
    const conditionIndex = conditionVariables(body);
    const routePredicateIndex = routePredicateVariables(body);
    const blocks = scriptRows(body, options).map((row, index) => scriptImpactBlock(row, index, conditionIndex, routePredicateIndex));
    return {
      blocks,
      summary: countBy(blocks, (block) => block.safetyClass || SCRIPT_CATEGORY.UNKNOWN),
      categorySummary: countBlockCategories(blocks),
      manualCategorySummary: countBlockCategories(blocks.filter((block) => block.safetyClass === SCRIPT_SAFETY.MANUAL)),
      advancedCategorySummary: countBlockCategories(blocks.filter((block) => block.safetyClass === SCRIPT_SAFETY.ADVANCED))
    };
  }

  function scriptImpactBlock(row, index, conditionIndex, routePredicateIndex) {
    const raw = stringValue(row && (row.text || row.value || row.original || row.sourceExpression || row.expression)).trim();
    if (stringValue(row && row.scriptKind) === 'opaque_js') {
      return opaqueScriptImpactBlock(row, index, conditionIndex, routePredicateIndex, raw);
    }
    const hook = hookFor(raw, row);
    const bodyText = raw.replace(/^(on-arrival|on-display)\s*:\s*/i, '').trim();
    const statements = splitStatements(bodyText).map((statement, statementIndex) => parseScriptStatement(statement, hook, row, statementIndex));
    const complexReasons = complexScriptReasons(bodyText, statements);
    const sets = scriptReadWriteSets(statements);
    const influence = scriptInfluenceFor({hook, text: bodyText, writes: sets.writes}, conditionIndex, routePredicateIndex);
    const safetyClass = scriptSafetyClass(complexReasons, statements);
    const statementCategories = unique(statements.map((statement) => statement.reviewCategory).filter(Boolean));
    const boundaryCategory = scriptBoundaryCategory(safetyClass, complexReasons, statementCategories);
    return {
      id: stringValue(row && row.id || 'script_block_' + (index + 1)),
      label: stringValue(row && row.label || hook || 'script'),
      scriptKind: stringValue(row && (row.scriptKind || row.kind || 'script')),
      hook,
      sectionId: stringValue(row && (row.sectionId || row.owner && row.owner.sectionId)),
      rawText: raw,
      statements,
      reads: sets.reads,
      writes: sets.writes,
      statementCategories,
      boundaryCategory,
      effectShapes: unique(statements.map((statement) => statement.effectShape).filter(Boolean)),
      displayInfluence: influence.display,
      optionInfluence: influence.option,
      routeInfluence: influence.route,
      routeTargets: routeTargetsFromScript(bodyText),
      safetyClass,
      guidedEdits: safetyClass === SCRIPT_SAFETY.GUIDED ? statements.map((statement) => guidedEditFor(row, statement, index)) : [],
      boundaryReasons: complexReasons,
      source: sourceRef(row && row.source || {}),
      sourceEvidence: {
        hasExactLine: hasExactSource(row && row.source),
        source: sourceRef(row && row.source || {})
      }
    };
  }

  function opaqueScriptImpactBlock(row, index, conditionIndex, routePredicateIndex, raw) {
    const hook = hookFor(raw, row);
    const reads = unique(ensureArray(row && row.reads).concat(variablesIn(raw)));
    const writes = unique(ensureArray(row && row.writes));
    const influence = scriptInfluenceFor({hook, text: raw, writes}, conditionIndex, routePredicateIndex);
    return {
      id: stringValue(row && row.id || 'opaque_js_' + (index + 1)),
      label: stringValue(row && row.label || (hook ? hook + ' JS block' : 'JS block')),
      scriptKind: 'opaque_js',
      hook,
      sectionId: stringValue(row && (row.sectionId || row.owner && row.owner.sectionId)),
      rawText: raw,
      rawPreview: stringValue(row && (row.rawPreview || row.preview || raw)).trim(),
      lineCount: Number(row && row.lineCount || 0) || null,
      statements: [],
      reads,
      writes,
      dynamicKeyWrites: unique(ensureArray(row && row.dynamicKeyWrites)),
      statementCategories: [SCRIPT_CATEGORY.OPAQUE],
      boundaryCategory: SCRIPT_CATEGORY.OPAQUE,
      effectShapes: [],
      displayInfluence: influence.display,
      optionInfluence: influence.option,
      routeInfluence: influence.route,
      routeTargets: routeTargetsFromScript(raw),
      safetyClass: SCRIPT_SAFETY.MANUAL,
      guidedEdits: [],
      boundaryReasons: [SCRIPT_CATEGORY.OPAQUE],
      source: sourceRef(row && row.source || {}),
      sourceEvidence: {
        hasExactLine: hasExactSource(row && row.source),
        source: sourceRef(row && row.source || {})
      }
    };
  }

  function parseScriptStatement(statement, hook, row, index) {
    const raw = stringValue(statement).trim();
    const parts = splitTrailingIf(raw);
    const match = parts.expression.match(/^(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*(=|\+=|-=|\*=|\/=)\s*(.+)$/);
    const reads = unique(variablesIn(parts.condition).concat(match ? variablesIn(match[3]) : variablesIn(raw)));
    if (!match) {
      return {
        id: 'statement_' + (index + 1),
        raw,
        guided: false,
        op: '',
        variable: '',
        value: '',
        condition: parts.condition,
        reads,
        writes: [],
        effectShape: 'complex',
        reviewCategory: 'unparsed_statement',
        simulatable: false
      };
    }
    const variable = match[1];
    const op = match[2];
    const value = stringValue(match[3]).trim();
    const reviewCategory = scriptStatementCategory(op, value, parts.condition);
    const guided = reviewCategory === 'simple_state_effect';
    return {
      id: 'statement_' + (index + 1),
      raw,
      guided,
      op,
      variable,
      value,
      condition: parts.condition,
      reads,
      writes: [variable],
      effectShape: effectShape(variable, op, value),
      reviewCategory,
      simulatable: guided
    };
  }

  function composeScriptStatement(statement, values) {
    const item = isObject(statement) ? statement : {};
    const input = isObject(values) ? values : {};
    const variable = cleanVariable(valueFor(input, 'variable', item.variable));
    const op = cleanOperator(valueFor(input, 'op', item.op));
    const rawValue = valueFor(input, 'value', item.value);
    const effectValue = stringValue(rawValue === undefined || rawValue === null ? '' : rawValue).trim();
    const condition = stringValue(valueFor(input, 'condition', item.condition)).trim();
    if (!variable || !op || !effectValue) {
      return stringValue(item.raw);
    }
    return 'Q.' + variable + ' ' + op + ' ' + effectValue + (condition ? ' if ' + condition : '');
  }

  function composeScriptBlockReplacement(block, valuesByStatementId) {
    const value = isObject(block) ? block : {};
    const replacements = isObject(valuesByStatementId) ? valuesByStatementId : {};
    const statements = ensureArray(value.statements);
    if (!statements.length || value.safetyClass !== 'guided') {
      return stringValue(value.rawText);
    }
    const rendered = statements.map((statement) => {
      const values = replacements[statement.id] || replacements[statement.variable] || {};
      return composeScriptStatement(statement, values);
    }).join('; ');
    return (value.hook ? value.hook + ': ' : '') + rendered;
  }

  function applySafeScriptEffects(state, eventBodyOrModel, options) {
    const current = Object.assign({}, state || {});
    const opts = isObject(options) ? options : {};
    const sectionId = stringValue(opts.sectionId);
    const appliedBlocks = opts.appliedBlocks && typeof opts.appliedBlocks.has === 'function' && typeof opts.appliedBlocks.add === 'function'
      ? opts.appliedBlocks
      : null;
    const model = eventBodyOrModel && eventBodyOrModel.kind === MODEL_KIND
      ? eventBodyOrModel
      : buildRouteScriptIntelligence(eventBodyOrModel || {}, {trialRun: false});
    const applied = [];
    const warnings = [];
    ensureArray(model && model.scripts && model.scripts.blocks).forEach((block, blockIndex) => {
      if (block.scriptKind === 'option' || block.scriptKind === 'choice') {
        return;
      }
      if (sectionId && !stringValue(block.sectionId) && (block.scriptKind === 'trigger' || block.scriptKind === 'background')) {
        return;
      }
      if (sectionId && stringValue(block.sectionId) && stringValue(block.sectionId) !== sectionId) {
        return;
      }
      const blockKey = scriptApplicationKey(block, blockIndex);
      const applyOnce = Boolean(appliedBlocks && shouldApplyScriptOncePerTrial(block, sectionId));
      if (applyOnce && appliedBlocks.has(blockKey)) {
        return;
      }
      if (block.safetyClass !== 'guided') {
        if (block.displayInfluence || block.optionInfluence || block.routeInfluence) {
          warnings.push('Unknown script influence not simulated: ' + (block.label || block.id));
        }
        if (applyOnce) {
          appliedBlocks.add(blockKey);
        }
        return;
      }
      ensureArray(block.statements).forEach((statement) => {
        if (applyStatement(current, statement)) {
          applied.push(composeScriptStatement(statement, {}));
        }
      });
      if (applyOnce) {
        appliedBlocks.add(blockKey);
      }
    });
    return {state: current, applied, warnings};
  }

  function scriptRows(body, options) {
    const rows = [];
    appendScriptRows(rows, body && body.scriptRows, 'raw_script', 'script');
    appendOpaqueScriptRows(rows, body && body.opaqueJsBlocks, 'opaque_js');
    appendScriptRows(rows, options && options.scriptRows, 'option_script', 'script');
    appendOpaqueScriptRows(rows, options && options.opaqueJsBlocks, 'option_opaque_js');
    effectRowsFromFields(ensureArray(body && body.effects), 'trigger').forEach((row) => rows.push(row));
    ensureArray(body && body.optionEffects).forEach((group) => {
      effectRowsFromFields(ensureArray(group && group.fields), 'option', group).forEach((row) => rows.push(row));
    });
    ensureArray(body && body.backgroundEffects).forEach((effect, index) => {
      const expression = effectExpression(effect);
      if (expression) {
        rows.push(Object.assign({
          id: 'background_effect_' + (index + 1),
          label: 'background',
          scriptKind: 'background',
          text: expression,
          sectionId: effect && effect.sectionId,
          source: effect && effect.source
        }, effect || {}));
      }
    });
    return rows.filter(hasScriptText);
  }

  function appendScriptRows(rows, sourceRows, idPrefix, scriptKind) {
    ensureArray(sourceRows).forEach((row, index) => {
      rows.push(Object.assign({
        id: idPrefix + '_' + (index + 1),
        scriptKind
      }, row || {}));
    });
  }

  function appendOpaqueScriptRows(rows, sourceRows, idPrefix) {
    ensureArray(sourceRows).forEach((row, index) => {
      rows.push(Object.assign({
        id: idPrefix + '_' + (index + 1),
        label: 'Opaque JS block',
        scriptKind: 'opaque_js',
        text: opaqueScriptText(row)
      }, row || {}));
    });
  }

  function opaqueScriptText(row) {
    return row && (row.text || row.rawPreview || row.rawText || row.preview || '') || '';
  }

  function hasScriptText(row) {
    return Boolean(stringValue(row && (row.text || row.value || row.original || row.sourceExpression || row.expression)).trim());
  }

  function effectRowsFromFields(fields, kind, group) {
    const rows = [];
    const buckets = new Map();
    ensureArray(fields).forEach((field) => {
      const direct = field && (field.sourceExpression || field.value || field.original || '');
      const parsedDirect = parseScriptStatement(direct, field && field.effectHook || field && field.hook || '', field, 0);
      if (parsedDirect.variable && direct && !/\.variable$|\.op$|\.value$|\.condition$|\.hook$/.test(stringValue(field && field.id))) {
        rows.push({
          id: field.id || kind + '_effect_' + (rows.length + 1),
          label: field.label || kind + ' effect',
          scriptKind: kind,
          text: direct,
          sectionId: field.sectionId || group && group.sectionId || '',
          source: field.source
        });
      }
      const match = stringValue(field && field.id).match(/^(.*\.effect\.\d+)\.([A-Za-z]+)$/);
      if (!match) {
        return;
      }
      const key = match[1];
      if (!buckets.has(key)) {
        buckets.set(key, {});
      }
      buckets.get(key)[match[2]] = field;
    });
    buckets.forEach((bucket, key) => {
      const variable = firstNonEmpty(fieldValue(bucket.variable), fieldValue(bucket.name));
      const op = firstNonEmpty(fieldValue(bucket.op), fieldValue(bucket.operator), '+=');
      const value = firstNonEmpty(fieldValue(bucket.value), '1');
      const condition = fieldValue(bucket.condition);
      const hook = fieldValue(bucket.hook);
      if (!variable) {
        return;
      }
      rows.push({
        id: key,
        label: kind + ' effect',
        scriptKind: kind,
        text: (hook ? hook + ': ' : '') + 'Q.' + cleanVariable(variable) + ' ' + op + ' ' + value + (condition ? ' if ' + condition : ''),
        sectionId: group && group.sectionId || '',
        source: firstSource(Object.keys(bucket).map((name) => bucket[name] && bucket[name].source))
      });
    });
    return rows;
  }

  function routeItem(input) {
    const value = isObject(input) ? input : {};
    const body = value.body || {};
    const target = cleanTarget(firstNonEmpty(value.target, value.rawTarget));
    const source = sourceRef(value.source || {});
    const sourceExact = hasExactSource(source);
    const sourceLocated = hasLocatedSource(source);
    const external = isExternalTarget(target);
    const terminal = !target || target === 'root' || target === 'end' || target === 'terminal';
    const missing = Boolean(target && !external && !terminal && !targetResolves(body, target));
    const evidenceClass = missing
      ? 'missing_target'
      : external
      ? 'external'
      : terminal
      ? 'terminal'
      : value.confidence === 'script'
      ? 'script_derived'
      : value.confidence === 'fuzzy' || value.confidence === 'approximate' || !sourceLocated && !value.parserBacked
      ? 'fuzzy'
      : value.parserBacked
      ? 'parser_backed'
      : 'exact';
    return {
      id: stringValue(value.id),
      sourceKind: stringValue(value.sourceKind),
      from: stringValue(value.from),
      target,
      rawTarget: stringValue(value.rawTarget || value.target),
      predicate: stringValue(value.predicate),
      owner: stringValue(value.owner),
      evidenceClass,
      source,
      sourceExact,
      sourceLocated,
      targetResolved: !missing,
      label: routeEvidenceLabel(evidenceClass, target)
    };
  }

  function diagnosticsFor(routes, scripts) {
    const diagnostics = [];
    ensureArray(routes && routes.items).forEach((route) => {
      if (route.evidenceClass === 'missing_target') {
        diagnostics.push(diagnostic('error', 'route_script.missing_target', 'Route target does not resolve: ' + (route.owner || route.from || 'route') + ' -> ' + route.target));
      } else if (route.evidenceClass === 'fuzzy') {
        diagnostics.push(diagnostic('warning', 'route_script.fuzzy_route', 'Route evidence is approximate and needs review: ' + (route.rawTarget || route.target)));
      } else if (route.evidenceClass === 'script_derived') {
        diagnostics.push(diagnostic('info', 'route_script.script_derived_route', 'Route may be controlled by script: ' + (route.owner || route.target)));
      }
    });
    ensureArray(scripts && scripts.blocks).forEach((block) => {
      if (block.safetyClass === 'manual_boundary' && (block.displayInfluence || block.optionInfluence || block.routeInfluence)) {
        diagnostics.push(diagnostic('warning', 'route_script.script_boundary_affects_play', 'Script affects display, options, or routing but is not simulated: ' + (block.label || block.id)));
      }
    });
    return diagnostics;
  }

  function conditionVariables(body) {
    const display = new Set();
    const option = new Set();
    ensureArray(body && body.sections).concat(ensureArray(body && body.branchSections)).forEach((field) => {
      variablesIn(field && (field.condition || field.value || field.original)).forEach((name) => display.add(name));
    });
    ensureArray(body && body.choiceUnits).forEach((choice) => {
      variablesIn(choice && choice.displayCondition).forEach((name) => display.add(name));
      variablesIn(choice && choice.chooseCondition).forEach((name) => option.add(name));
    });
    ensureArray(body && body.options).forEach((choice) => {
      variablesIn(choice && (choice.displayCondition || choice.sectionViewIf)).forEach((name) => display.add(name));
      variablesIn(choice && (choice.chooseIf || choice.sectionChooseIf)).forEach((name) => option.add(name));
    });
    ensureArray(body && body.metaFields).forEach((field) => {
      if (/condition|view|when|if/i.test(stringValue(field && (field.label || field.id || field.role)))) {
        variablesIn(field && (field.value || field.original)).forEach((name) => display.add(name));
      }
    });
    return {display, option};
  }

  function routePredicateVariables(body) {
    const names = new Set();
    ensureArray(body && body.flow && body.flow.edges).forEach((edge) => {
      variablesIn(edge && (edge.condition || edge.predicate)).forEach((name) => names.add(name));
    });
    ensureArray(body && body.continuationMap && body.continuationMap.items).forEach((item) => {
      ensureArray(item && item.orderedRoutes).forEach((route) => {
        variablesIn(route && route.predicate).forEach((name) => names.add(name));
      });
    });
    return names;
  }

  function splitStatements(text) {
    const rows = [];
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
          rows.push(current.trim());
        }
        current = '';
        return;
      }
      current += char;
    });
    if (current.trim()) {
      rows.push(current.trim());
    }
    return rows;
  }

  function splitTrailingIf(value) {
    const text = stringValue(value).trim();
    const marker = text.lastIndexOf(' if ');
    if (marker < 0) {
      return {expression: text, condition: ''};
    }
    return {expression: text.slice(0, marker).trim(), condition: text.slice(marker + 4).trim()};
  }

  function complexScriptReasons(text, statements) {
    const reasons = [];
    const raw = stringValue(text);
    if (hasControlFlowBlock(raw)) {
      reasons.push('control_flow_or_block');
    }
    if (/\b(?:Math\.random|random|call|setTimeout|Promise|new\s+|this\.|window\.|document\.)\b/.test(raw) || hasFunctionCall(raw)) {
      reasons.push('runtime_or_function_side_effect');
    }
    if (/\[[^\]]+\]\s*=/.test(raw)) {
      reasons.push('dynamic_key_write');
    }
    if (ensureArray(statements).some((statement) => statement.reviewCategory === 'unparsed_statement')) {
      reasons.push('unparsed_statement');
    }
    return unique(reasons);
  }

  function hasControlFlowBlock(value) {
    const raw = stringValue(value);
    return /[{}]/.test(raw) || /(^|[;\n])\s*(?:if|for|while|function|return|else)\b/i.test(raw);
  }

  function hasFunctionCall(value) {
    const raw = stringValue(value);
    return /\b(?!if\b|for\b|while\b|function\b|return\b|else\b|and\b|or\b|not\b)[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(raw);
  }

  function scriptStatementCategory(op, value, condition) {
    if (!GUIDED_OPS.has(op)) {
      return 'unsupported_operator';
    }
    if (!isSimpleCondition(condition)) {
      return 'complex_condition';
    }
    if (!isSimpleValue(value)) {
      return SCRIPT_CATEGORY.CALCULATED;
    }
    return SCRIPT_CATEGORY.SIMPLE;
  }

  function scriptReadWriteSets(statements) {
    const rows = ensureArray(statements);
    return {
      reads: unique(rows.reduce((vars, statement) => vars.concat(ensureArray(statement.reads)), [])),
      writes: unique(rows.reduce((vars, statement) => vars.concat(ensureArray(statement.writes)), []))
    };
  }

  function scriptInfluenceFor(input, conditionIndex, routePredicateIndex) {
    const value = isObject(input) ? input : {};
    const writes = ensureArray(value.writes);
    const text = stringValue(value.text);
    return {
      display: value.hook === 'on-display' || writes.some((name) => conditionIndex.display.has(name)),
      option: writes.some((name) => conditionIndex.option.has(name)),
      route: /\b(?:go-to|set-root|route|target)\b/i.test(text) || writes.some((name) => routePredicateIndex.has(name))
    };
  }

  function scriptSafetyClass(complexReasons, statements) {
    const rows = ensureArray(statements);
    if (ensureArray(complexReasons).length) {
      return SCRIPT_SAFETY.MANUAL;
    }
    return rows.length > 0 && rows.every((statement) => statement.guided)
      ? SCRIPT_SAFETY.GUIDED
      : SCRIPT_SAFETY.ADVANCED;
  }

  function scriptBoundaryCategory(safetyClass, reasons, statementCategories) {
    const manual = ensureArray(reasons);
    if (manual.length) {
      return manual[0];
    }
    const categories = ensureArray(statementCategories);
    if (safetyClass === SCRIPT_SAFETY.GUIDED) {
      return SCRIPT_CATEGORY.SIMPLE;
    }
    return categories[0] || safetyClass || SCRIPT_CATEGORY.UNKNOWN;
  }

  function countBlockCategories(blocks) {
    return countBy(blocks, (block) => block && block.boundaryCategory || SCRIPT_CATEGORY.UNKNOWN);
  }

  function countBy(rows, keyFn) {
    return ensureArray(rows).reduce((out, row) => {
      const key = stringValue(keyFn(row) || SCRIPT_CATEGORY.UNKNOWN);
      out[key] = (out[key] || 0) + 1;
      return out;
    }, {});
  }

  function effectShape(variable, op, value) {
    const name = stringValue(variable).toLowerCase();
    const raw = stringValue(value).trim();
    if (/^(?:true|false)$/.test(raw)) return 'boolean_flag';
    if (/year|month|week|timer|delay|schedule|election|countdown/.test(name)) return 'timer_or_schedule';
    if (op === '+=') return 'numeric_increment';
    if (op === '-=') return 'numeric_decrement';
    if (/^['"]/.test(raw)) return 'string_assignment';
    if (/^-?\d+(?:\.\d+)?$/.test(raw)) return 'numeric_assignment';
    return op === '=' ? 'state_assignment' : 'complex';
  }

  function routeTargetsFromScript(text) {
    const targets = [];
    const goTo = stringValue(text).match(/\bgo-to\s*:\s*([A-Za-z_][A-Za-z0-9_.-]*)/i);
    if (goTo) targets.push(goTo[1]);
    const assignment = stringValue(text).match(/\b(?:route|target|next|set[-_]root)\s*=\s*['"]([A-Za-z_][A-Za-z0-9_.-]*)['"]/i);
    if (assignment) targets.push(assignment[1]);
    return unique(targets);
  }

  function shouldApplyScriptOncePerTrial(block, sectionId) {
    if (stringValue(sectionId) || stringValue(block && block.sectionId)) {
      return false;
    }
    const kind = stringValue(block && block.scriptKind);
    const hook = stringValue(block && block.hook);
    return kind === 'trigger' || kind === 'background' || hook === 'on-arrival';
  }

  function scriptApplicationKey(block, index) {
    const value = isObject(block) ? block : {};
    return [
      value.id || 'script_block_' + (index + 1),
      value.scriptKind || '',
      value.hook || '',
      value.sectionId || '',
      value.source && value.source.path || '',
      value.source && value.source.line || '',
      value.rawText || ''
    ].map(stringValue).join('|');
  }

  function applyStatement(state, statement) {
    const item = isObject(statement) ? statement : {};
    if (!item.guided || !conditionPasses(item.condition, state)) {
      return false;
    }
    const variable = cleanVariable(item.variable);
    if (!variable) {
      return false;
    }
    const current = valueForState(state, variable);
    const value = parseRuntimeValue(item.value, state);
    if (item.op === '=') {
      state[variable] = value;
    } else if (item.op === '+=') {
      state[variable] = Number(current || 0) + Number(value || 0);
    } else if (item.op === '-=') {
      state[variable] = Number(current || 0) - Number(value || 0);
    } else {
      return false;
    }
    return true;
  }

  function conditionPasses(condition, state) {
    const text = stringValue(condition).trim();
    if (!text) {
      return true;
    }
    return text.split(/\s+or\s+/i).some((part) => part.split(/\s+and\s+/i).every((clause) => compareClause(clause, state)));
  }

  function compareClause(clause, state) {
    let text = stringValue(clause).trim();
    if (!text) {
      return true;
    }
    if (/^not\s+/i.test(text)) {
      return !compareClause(text.replace(/^not\s+/i, ''), state);
    }
    text = text.replace(/^\((.*)\)$/, '$1').trim();
    const match = text.match(/^(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*(>=|<=|!=|==|=|>|<)\s*(.+)$/);
    if (!match) {
      return Boolean(valueForState(state, text.replace(/^Q\./, '')));
    }
    const left = valueForState(state, match[1]);
    const right = parseRuntimeValue(match[3], state);
    switch (match[2]) {
      case '>=': return Number(left) >= Number(right);
      case '<=': return Number(left) <= Number(right);
      case '>': return Number(left) > Number(right);
      case '<': return Number(left) < Number(right);
      case '!=': return String(left) !== String(right);
      case '==':
      case '=': return String(left) === String(right);
      default: return false;
    }
  }

  function parseRuntimeValue(value, state) {
    const text = stringValue(value).trim();
    const quoted = text.match(/^['"]([\s\S]*)['"]$/);
    if (quoted) {
      return quoted[1];
    }
    if (/^(?:true|false)$/i.test(text)) {
      return /^true$/i.test(text);
    }
    if (/^-?\d+(?:\.\d+)?$/.test(text)) {
      return Number(text);
    }
    return valueForState(state, text.replace(/^Q\./, ''));
  }

  function valueForState(state, key) {
    const clean = cleanVariable(key);
    return Object.prototype.hasOwnProperty.call(state || {}, clean) ? state[clean] : 0;
  }

  function isSimpleValue(value) {
    const text = stringValue(value).trim();
    return /^(?:true|false)$/i.test(text) || /^-?\d+(?:\.\d+)?$/.test(text) || /^['"][\s\S]*['"]$/.test(text) || /^(?:Q\.)?[A-Za-z_][A-Za-z0-9_]*$/.test(text);
  }

  function isSimpleCondition(value) {
    const text = stringValue(value).trim();
    return !text || /^[A-Za-z0-9_.'"=<>!\s()+-]+$/.test(text) && !/[{};]/.test(text);
  }

  function variablesIn(value) {
    const names = [];
    String(value || '').replace(/\bQ\.([A-Za-z_][A-Za-z0-9_]*)\b/g, (_match, name) => {
      names.push(name);
      return '';
    });
    return unique(names);
  }

  function isRouteEdge(edge) {
    const kind = stringValue(edge && edge.kind);
    return kind === 'route' || kind === 'conditional_route' || kind === 'return_route' || kind === 'exit_route';
  }

  function firstPredicate(routes) {
    const hit = ensureArray(routes).find((route) => stringValue(route && route.predicate));
    return stringValue(hit && hit.predicate);
  }

  function uniqueRouteRows(rows) {
    const seen = new Set();
    return ensureArray(rows).filter((row) => {
      const key = [row.sourceKind, row.from, row.target, row.predicate, row.evidenceClass, row.source && row.source.path, row.source && row.source.line].join('|');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function targetResolves(body, target) {
    const clean = cleanTarget(target);
    if (!clean || clean === 'root') {
      return true;
    }
    const ids = new Set(['root']);
    const structureId = stringValue(body && body.eventStructure && body.eventStructure.id || body && body.id);
    if (structureId) {
      ids.add(structureId);
    }
    ensureArray(body && body.branchSections).forEach((field) => {
      [field && field.sectionId, field && field.targetId].map(stringValue).filter(Boolean).forEach((id) => ids.add(cleanTarget(id)));
    });
    ensureArray(body && body.sections).forEach((field) => {
      [field && field.sectionId, field && field.targetId, field && field.id].map(stringValue).filter(Boolean).forEach((id) => ids.add(cleanTarget(id)));
    });
    ensureArray(body && body.options).forEach((option) => {
      [option && option.targetId, option && option.rawTargetId, option && option.id].map(stringValue).filter(Boolean).forEach((id) => ids.add(cleanTarget(id)));
    });
    ensureArray(body && body.flow && body.flow.nodes).forEach((node) => {
      [node && node.id, node && node.sectionId, node && node.targetId].map(stringValue).filter(Boolean).forEach((id) => ids.add(cleanTarget(id)));
    });
    ensureArray(body && body.sourceStructureGraph && body.sourceStructureGraph.nodes).forEach((node) => {
      [node && node.id, node && node.sectionId, node && node.targetId].map(stringValue).filter(Boolean).forEach((id) => ids.add(cleanTarget(id)));
    });
    ensureArray(body && (body.projectSceneIds || body.knownSceneIds || body.globalSceneIds)).forEach((id) => {
      if (id) ids.add(cleanTarget(id));
    });
    if (ids.has(clean)) {
      return true;
    }
    const local = clean.split('.').pop();
    return Array.from(ids).some((id) => id === local || id.split('.').pop() === local);
  }

  function guidedEditFor(row, statement, blockIndex) {
    return {
      id: stringValue(row && row.id || 'script_block_' + (blockIndex + 1)) + '.' + statement.id,
      variable: statement.variable,
      op: statement.op,
      value: statement.value,
      condition: statement.condition,
      source: sourceRef(row && row.source || {}),
      reviewCategory: statement.reviewCategory,
      effectShape: statement.effectShape,
      replacementPreview: composeScriptStatement(statement, {})
    };
  }

  function effectExpression(effect) {
    const variable = cleanVariable(effect && effect.variable);
    if (!variable) {
      return stringValue(effect && (effect.sourceExpression || effect.expression || effect.displayExpression));
    }
    const op = stringValue(effect && (effect.op || effect.operator)).trim();
    if (!/^(?:=|\+=|-=|\*=|\/=)$/.test(op)) {
      return '';
    }
    if (effect && effect.value === undefined) {
      return '';
    }
    return 'Q.' + variable + ' ' + op + ' ' + stringValue(effect && effect.value) + (effect && effect.condition ? ' if ' + effect.condition : '');
  }

  function hookFor(raw, row) {
    const hookMatch = stringValue(raw).match(/^(on-arrival|on-display)\s*:/i);
    if (hookMatch) {
      return hookMatch[1].toLowerCase();
    }
    return stringValue(row && (row.hook || row.effectHook)).toLowerCase();
  }

  function fieldValue(field) {
    if (!field) {
      return '';
    }
    return stringValue(field.value === undefined ? field.original : field.value);
  }

  function firstSource(sources) {
    return ensureArray(sources).map(sourceRef).find((source) => source.path) || {};
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    const line = numberOrNull(value.line || value.startLine);
    const endLine = numberOrNull(value.endLine || value.line || value.startLine);
    return {
      path: normalizePath(value.path || ''),
      line,
      startLine: line,
      endLine,
      anchorText: stringValue(value.anchorText),
      endAnchorText: stringValue(value.endAnchorText || value.anchorText),
      excerpt: stringValue(value.excerpt)
    };
  }

  function hasExactSource(source) {
    const ref = sourceRef(source || {});
    return Boolean(ref.path && ref.line && ref.anchorText);
  }

  function hasLocatedSource(source) {
    const ref = sourceRef(source || {});
    return Boolean(ref.path && ref.line);
  }

  function routeEvidenceLabel(kind, target) {
    const label = {
      exact: 'Exact source route',
      parser_backed: 'Parser-backed route',
      fuzzy: 'Approximate route evidence',
      script_derived: 'Script-derived route',
      missing_target: 'Missing target',
      terminal: 'Terminal or root route',
      external: 'External route'
    }[kind] || kind || 'Route';
    return label + (target ? ': ' + target : '');
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message};
  }

  function firstNonEmpty() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value);
      }
    }
    return '';
  }

  function valueFor(values, key, fallback) {
    return Object.prototype.hasOwnProperty.call(values || {}, key) ? values[key] : fallback;
  }

  function cleanVariable(value) {
    return stringValue(value).trim().replace(/^Q\./, '');
  }

  function cleanOperator(value) {
    const op = stringValue(value).trim();
    return GUIDED_OPS.has(op) ? op : '=';
  }

  function cleanTarget(value) {
    return stringValue(value).trim().replace(/^[@#]+/, '').replace(/^(?:scene|section|result|option):/, '');
  }

  function isExternalTarget(target) {
    return /^(?:runtime:|tag:|http:|https:|external:)/i.test(stringValue(target));
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? Math.floor(num) : null;
  }

  function normalizePath(value) {
    return stringValue(value).replace(/\\/g, '/');
  }

  function unique(values) {
    return Array.from(new Set(ensureArray(values).map(stringValue).filter(Boolean)));
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function stringValue(value) {
    return value === undefined || value === null ? '' : String(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  const api = {
    buildRouteScriptIntelligence,
    enrichEventBody,
    buildRouteEvidenceMap,
    buildScriptImpactMap,
    composeScriptStatement,
    composeScriptBlockReplacement,
    applySafeScriptEffects
  };

  if (global) {
    global.ProjectMapRouteScriptIntelligenceModel = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
