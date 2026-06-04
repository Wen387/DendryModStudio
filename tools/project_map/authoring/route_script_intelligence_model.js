// @ts-check
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
  const SEMANTIC_TIER = Object.freeze({
    STATIC: 'static_exact',
    GUIDED: 'guided_profile',
    RUNTIME: 'runtime_observed',
    MANUAL: 'manual_boundary'
  });

  /**
   * @typedef {import('../types/project_map_contracts').DiagnosticRow} DiagnosticRow
   * @typedef {import('../types/project_map_contracts').GuidedScriptEdit} GuidedScriptEdit
   * @typedef {import('../types/project_map_contracts').RouteDynamicBinding} RouteDynamicBinding
   * @typedef {import('../types/project_map_contracts').RouteEvidenceMap} RouteEvidenceMap
   * @typedef {import('../types/project_map_contracts').RouteEvidenceItem} RouteEvidenceItem
   * @typedef {import('../types/project_map_contracts').RouteSemanticTier} RouteSemanticTier
   * @typedef {import('../types/project_map_contracts').RouteGuidedEditModelApi} RouteGuidedEditModelApi
   * @typedef {import('../types/project_map_contracts').RouteScriptIntelligenceModel} RouteScriptIntelligenceModel
   * @typedef {import('../types/project_map_contracts').RouteTargetResolution} RouteTargetResolution
   * @typedef {import('../types/project_map_contracts').RouteUnderstandingModelApi} RouteUnderstandingModelApi
   * @typedef {import('../types/project_map_contracts').RouteUnderstandingProfileEvidence} RouteUnderstandingProfileEvidence
   * @typedef {import('../types/project_map_contracts').RouteUnderstandingUtilityRouteSceneEvidence} RouteUnderstandingUtilityRouteSceneEvidence
   * @typedef {import('../types/project_map_contracts').ScriptImpactMap} ScriptImpactMap
   * @typedef {import('../types/project_map_contracts').ScriptImpactBlock} ScriptImpactBlock
   * @typedef {import('../types/project_map_contracts').SourceRef} SourceRef
   */

  /**
   * @param {unknown} eventBody
   * @param {Record<string, unknown>=} options
   * @returns {RouteScriptIntelligenceModel}
   */
  function buildRouteScriptIntelligence(eventBody, options) {
    const opts = isObject(options) ? options : {};
    // `reuseBody` skips a redundant 86MB deep copy when the caller already
    // owns a private clone (the enrichEventBody wrapper forwards it only from
    // the trusted toEventBody chain, which never passes profileEvidence /
    // projectIndex — so the in-place mutation below stays a no-op there).
    const body = isObject(eventBody) ? (opts.reuseBody ? eventBody : clone(eventBody)) : {};
    if (!body.profileEvidence && opts.profileEvidence) {
      body.profileEvidence = opts.profileEvidence;
    }
    if (!body.projectIndex && opts.projectIndex) {
      body.projectIndex = opts.projectIndex;
    }
    const scriptBlocks = buildScriptImpactMap(body, opts);
    const routeEvidence = buildRouteEvidenceMap(body, scriptBlocks, opts);
    const routeUnderstanding = buildRouteUnderstandingSection(body, routeEvidence, scriptBlocks, opts);
    const routeGuidedEdits = buildRouteGuidedEditSection(body, routeEvidence, scriptBlocks, routeUnderstanding, opts);
    const guidedScriptEdits = scriptBlocks.blocks.reduce((rows, block) => rows.concat(ensureArray(block.guidedEdits)), []);
    const diagnostics = diagnosticsFor(routeEvidence, scriptBlocks);
    return {
      schemaVersion: ROUTE_SCRIPT_INTELLIGENCE_VERSION,
      kind: MODEL_KIND,
      ok: !diagnostics.some((item) => item.severity === 'error'),
      eventId: stringValue(opts.eventId || body.eventStructure && body.eventStructure.id || body.id || ''),
      routes: routeEvidence,
      scripts: scriptBlocks,
      routeUnderstanding,
      routeGuidedEdits,
      guidedScriptEdits,
      diagnostics,
      summary: buildModelSummary(routeEvidence, scriptBlocks, guidedScriptEdits, diagnostics, routeUnderstanding, routeGuidedEdits)
    };
  }

  /**
   * @returns {RouteUnderstandingModelApi | null}
   */
  function routeUnderstandingApi() {
    if (global && global.ProjectMapRouteUnderstandingModel) {
      return global.ProjectMapRouteUnderstandingModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./route_understanding_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function buildRouteUnderstandingSection(body, routeEvidence, scriptBlocks, opts) {
    const api = routeUnderstandingApi();
    if (!api || typeof api.buildRouteUnderstanding !== 'function') {
      return null;
    }
    try {
      return api.buildRouteUnderstanding(body, Object.assign({}, opts || {}, {
        routeEvidence,
        scriptImpactMap: scriptBlocks
      }));
    } catch (_err) {
      return null;
    }
  }

  /**
   * @returns {RouteGuidedEditModelApi | null}
   */
  function routeGuidedEditApi() {
    if (global && global.ProjectMapRouteGuidedEditModel) {
      return global.ProjectMapRouteGuidedEditModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./route_guided_edit_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function buildRouteGuidedEditSection(body, routeEvidence, scriptBlocks, routeUnderstanding, opts) {
    const api = routeGuidedEditApi();
    if (!api || typeof api.buildRouteGuidedEditModel !== 'function') {
      return null;
    }
    try {
      return api.buildRouteGuidedEditModel(body, Object.assign({}, opts || {}, {
        routeEvidence,
        scriptImpactMap: scriptBlocks,
        routeUnderstanding
      }));
    } catch (_err) {
      return null;
    }
  }

  function buildModelSummary(routeEvidence, scriptBlocks, guidedScriptEdits, diagnostics, routeUnderstanding, routeGuidedEdits) {
    return {
      routeCount: routeEvidence.items.length,
      scriptBlockCount: scriptBlocks.blocks.length,
      guidedScriptEditCount: guidedScriptEdits.length,
      exactRoutes: routeEvidence.summary.exact || 0,
      parserBackedRoutes: routeEvidence.summary.parser_backed || 0,
      fuzzyRoutes: routeEvidence.summary.fuzzy || 0,
      scriptDerivedRoutes: routeEvidence.summary.script_derived || 0,
      missingRoutes: routeEvidence.summary.missing_target || 0,
      safeEditableRoutes: routeEvidence.items.filter((item) => item.safeEditEligible).length,
      semanticTierCounts: countBy(routeEvidence.items, (item) => item.semanticTier || SEMANTIC_TIER.MANUAL),
      dynamicRouteBindingCount: routeEvidence.items.filter((item) => item.dynamicBinding && item.dynamicBinding.kind).length,
      manualScriptBlocks: scriptBlocks.summary[SCRIPT_SAFETY.MANUAL] || 0,
      advancedScriptBlocks: scriptBlocks.summary[SCRIPT_SAFETY.ADVANCED] || 0,
      guidedScriptBlocks: scriptBlocks.summary[SCRIPT_SAFETY.GUIDED] || 0,
      guidedRouteEditCount: routeGuidedEdits && routeGuidedEdits.summary && routeGuidedEdits.summary.entryCount || 0,
      safeGuidedRouteEditCount: routeGuidedEdits && routeGuidedEdits.summary && routeGuidedEdits.summary.safeEditCount || 0,
      opaqueJsBlocks: scriptBlocks.categorySummary[SCRIPT_CATEGORY.OPAQUE] || 0,
      scriptCategoryCounts: scriptBlocks.categorySummary,
      manualScriptCategories: scriptBlocks.manualCategorySummary,
      advancedScriptCategories: scriptBlocks.advancedCategorySummary,
      routeUnderstanding: routeUnderstanding && routeUnderstanding.summary || {},
      routeGuidedEdits: routeGuidedEdits && routeGuidedEdits.summary || {},
      warningCount: diagnostics.filter((item) => item.severity === 'warning').length,
      errorCount: diagnostics.filter((item) => item.severity === 'error').length
    };
  }

  function enrichEventBody(eventBody, options) {
    const opts = isObject(options) ? options : {};
    const body = isObject(eventBody) ? (opts.reuseBody ? eventBody : clone(eventBody)) : {};
    // Forward reuseBody (not force it): in the trusted chain the build can work
    // in place, but external callers that pass profileEvidence still need the
    // inner clone so that mutation stays isolated from the returned body.
    const model = buildRouteScriptIntelligence(body, opts);
    body.routeScriptIntelligence = {
      schemaVersion: model.schemaVersion,
      kind: model.kind,
      ok: model.ok,
      summary: model.summary,
      diagnostics: model.diagnostics
    };
    body.routeEvidenceMap = model.routes;
    body.scriptImpactMap = model.scripts;
    if (model.routeUnderstanding) {
      body.routeUnderstanding = model.routeUnderstanding;
    }
    if (model.routeGuidedEdits) {
      body.routeGuidedEdits = model.routeGuidedEdits;
    }
    body.guidedScriptEdits = model.guidedScriptEdits;
    return body;
  }

  /**
   * @param {Record<string, any>} body
   * @param {ScriptImpactMap|Record<string, any>} scriptBlocks
   * @param {Record<string, unknown>=} options
   * @returns {RouteEvidenceMap}
   */
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
        routeKind: edge && edge.kind,
        dynamicTarget: edge && edge.dynamicTarget,
        targetSource: edge && edge.targetSource,
        dynamicBinding: dynamicBindingFromRouteEdge(edge),
        runtimeSemantics: edge && edge.runtimeSemantics,
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
      const writes = ensureArray(block.dynamicRouteWrites);
      if (writes.length) {
        writes.forEach((write, writeIndex) => {
          rows.push(routeItem({
            id: 'script_route_' + (index + 1) + '_' + (writeIndex + 1),
            sourceKind: 'script',
            from: block.sectionId || block.hook || 'script',
            target: write.primaryTarget || ('quality_ref:' + write.variable),
            rawTarget: write.primaryTarget || '',
            predicate: write.condition,
            source: block.source,
            confidence: write.profileBacked ? 'profile' : 'script',
            owner: block.label || block.id,
            dynamicTarget: true,
            targetSource: 'quality',
            dynamicBinding: write,
            body
          }));
        });
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
        dynamicBinding: block.routeTargets && block.routeTargets.length ? {
          kind: 'script_route_hint',
          candidateTargets: ensureArray(block.routeTargets)
        } : null,
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
    ensureArray(body && body.routeEvidenceMap && body.routeEvidenceMap.items).forEach((row, index) => {
      rows.push(routeItem(Object.assign({}, row, {
        id: row.id || 'existing_route_evidence_' + (index + 1),
        sourceKind: row.sourceKind || 'existing_route_evidence',
        body
      })));
    });
    profileRouteEvidenceRows(options && options.profileEvidence || body && body.profileEvidence).forEach((row, index) => {
      rows.push(routeItem(Object.assign({}, row, {
        id: row.id || 'profile_route_' + (index + 1),
        sourceKind: 'profile',
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

  /**
   * @param {Record<string, any>} body
   * @param {Record<string, unknown>=} options
   * @returns {ScriptImpactMap}
   */
  function buildScriptImpactMap(body, options) {
    const conditionIndex = conditionVariables(body);
    const routePredicateIndex = routePredicateVariables(body);
    const routeQualityIndex = routeQualityVariables(body, options);
    const blocks = scriptRows(body, options).map((row, index) => scriptImpactBlock(row, index, conditionIndex, routePredicateIndex, routeQualityIndex));
    return {
      blocks,
      summary: countBy(blocks, (block) => block.safetyClass || SCRIPT_CATEGORY.UNKNOWN),
      categorySummary: countBlockCategories(blocks),
      manualCategorySummary: countBlockCategories(blocks.filter((block) => block.safetyClass === SCRIPT_SAFETY.MANUAL)),
      advancedCategorySummary: countBlockCategories(blocks.filter((block) => block.safetyClass === SCRIPT_SAFETY.ADVANCED))
    };
  }

  function scriptImpactBlock(row, index, conditionIndex, routePredicateIndex, routeQualityIndex) {
    const raw = stringValue(row && (row.text || row.value || row.original || row.sourceExpression || row.expression)).trim();
    if (stringValue(row && row.scriptKind) === 'opaque_js') {
      return opaqueScriptImpactBlock(row, index, conditionIndex, routePredicateIndex, routeQualityIndex, raw);
    }
    const hook = hookFor(raw, row);
    const bodyText = raw.replace(/^(on-arrival|on-departure|on-display)\s*:\s*/i, '').trim();
    const statements = splitStatements(bodyText).map((statement, statementIndex) => parseScriptStatement(statement, hook, row, statementIndex));
    const complexReasons = complexScriptReasons(bodyText, statements);
    const sets = scriptReadWriteSets(statements);
    const dynamicRouteWrites = dynamicRouteWritesFromScript(bodyText, row, routeQualityIndex);
    const routeTargets = routeTargetsForScript(bodyText, dynamicRouteWrites);
    const influence = scriptInfluenceFor({
      hook,
      text: bodyText,
      writes: sets.writes,
      dynamicRouteWrites
    }, conditionIndex, routePredicateIndex, routeQualityIndex);
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
      routeTargets,
      dynamicRouteWrites,
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

  function opaqueScriptImpactBlock(row, index, conditionIndex, routePredicateIndex, routeQualityIndex, raw) {
    const hook = hookFor(raw, row);
    const reads = unique(ensureArray(row && row.reads).concat(variablesIn(raw)));
    const writes = unique(ensureArray(row && row.writes));
    const dynamicRouteWrites = dynamicRouteWritesFromScript(raw, row, routeQualityIndex);
    const routeTargets = routeTargetsForScript(raw, dynamicRouteWrites);
    const influence = scriptInfluenceFor({
      hook,
      text: raw,
      writes,
      dynamicRouteWrites
    }, conditionIndex, routePredicateIndex, routeQualityIndex);
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
      routeTargets,
      dynamicRouteWrites,
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
    const dynamicBinding = utilityReturnBindingFromProfile(value, target, body.profileEvidence) || normalizeDynamicBinding(value.dynamicBinding);
    const dynamicTarget = Boolean(value.dynamicTarget) ||
      Boolean(dynamicBinding && (dynamicBinding.source === 'quality' || dynamicBinding.kind === 'set_jump' || dynamicBinding.kind === 'utility_return_binding')) ||
      target.indexOf('quality_ref:') === 0 ||
      stringValue(value.routeKind).indexOf('go_to_ref') >= 0 ||
      stringValue(value.routeKind).indexOf('set_jump') >= 0;
    const external = isExternalTarget(target);
    const terminal = !target || target === 'root' || target === 'end' || target === 'terminal' || target === 'script-controlled';
    const staticResolution = resolveStaticTarget(body, target);
    const ambiguous = staticResolution.status === 'ambiguous';
    const missing = Boolean(target && !dynamicTarget && !external && !terminal && staticResolution.status === 'missing');
    const evidenceClass = missing
      ? 'missing_target'
      : external
      ? 'external'
      : terminal
      ? 'terminal'
      : ambiguous
      ? 'fuzzy'
      : value.confidence === 'script' || dynamicTarget
      ? 'script_derived'
      : value.confidence === 'fuzzy' || value.confidence === 'approximate' || !sourceLocated && !value.parserBacked
      ? 'fuzzy'
      : value.parserBacked
      ? 'parser_backed'
      : 'exact';
    const targetResolution = routeTargetResolution({
      target,
      dynamicTarget,
      dynamicBinding,
      external,
      terminal,
      missing,
      staticResolution,
      body
    });
    const semanticTier = routeSemanticTier({
      evidenceClass,
      confidence: value.confidence,
      sourceKind: value.sourceKind,
      dynamicTarget,
      dynamicBinding,
      targetResolution
    });
    const runtimeSemantics = isObject(value.runtimeSemantics) ? clone(value.runtimeSemantics) : null;
    const safeEditEligible = routeSafeEditEligible({
      evidenceClass,
      semanticTier,
      targetResolution,
      runtimeSemantics,
      sourceExact,
      parserBacked: Boolean(value.parserBacked)
    });
    return {
      id: stringValue(value.id),
      sourceKind: stringValue(value.sourceKind),
      from: stringValue(value.from),
      target,
      rawTarget: stringValue(value.rawTarget || value.target),
      predicate: stringValue(value.predicate),
      owner: stringValue(value.owner),
      evidenceClass,
      semanticTier,
      targetResolution,
      dynamicBinding,
      runtimeSemantics,
      safeEditEligible,
      dynamicTarget,
      targetSource: stringValue(value.targetSource || (dynamicBinding && dynamicBinding.source) || (dynamicTarget ? 'quality' : 'scene')),
      parserBacked: Boolean(value.parserBacked),
      confidence: stringValue(value.confidence || (value.parserBacked ? 'parser_backed' : '')),
      diagnostics: [],
      source,
      sourceExact,
      sourceLocated,
      targetResolved: !missing,
      label: routeEvidenceLabel(evidenceClass, target)
    };
  }

  /**
   * @param {unknown} value
   * @returns {RouteDynamicBinding | null}
   */
  function normalizeDynamicBinding(value) {
    if (!isObject(value) || !value.kind) {
      return null;
    }
    const kind = stringValue(value.kind);
    const variable = cleanVariable(value.variable || value.quality || value.routeVar || '');
    const candidateTargets = unique(ensureArray(value.candidateTargets || value.targets || value.candidates).map(cleanTarget));
    return {
      kind,
      variable,
      source: stringValue(value.source || value.targetSource || (kind === 'set_jump' || kind === 'utility_return_binding' ? 'jump' : 'quality')),
      shape: stringValue(value.shape || value.kind),
      condition: stringValue(value.condition),
      selector: stringValue(value.selector),
      candidateTargets,
      primaryTarget: cleanTarget(value.primaryTarget || candidateTargets[0] || ''),
      profileBacked: Boolean(value.profileBacked),
      manualBoundary: Boolean(value.manualBoundary),
      reason: stringValue(value.reason)
    };
  }

  /**
   * @param {unknown} value
   * @param {unknown} target
   * @param {RouteUnderstandingProfileEvidence[]=} profileEvidence
   * @returns {RouteDynamicBinding | null}
   */
  function utilityReturnBindingFromProfile(value, target, profileEvidence) {
    const clean = cleanTarget(target);
    if (!clean) {
      return null;
    }
    const route = isObject(value) ? value : {};
    const from = cleanTarget(route.from || route.owner || route.sceneId);
    const utility = utilityRouteScenes(profileEvidence).find((row) => {
      return cleanTarget(row && (row.returnBinding || row.binding || 'jumpScene')) === clean &&
        (!from || cleanTarget(row && (row.sceneId || row.id)) === from);
    });
    if (!utility) {
      return null;
    }
    return {
      kind: 'utility_return_binding',
      variable: clean,
      source: 'jump',
      shape: 'single_slot_return',
      condition: '',
      selector: '',
      candidateTargets: [],
      primaryTarget: '',
      profileBacked: true,
      manualBoundary: false,
      reason: 'Profile marks this target as a utility return binding.'
    };
  }

  /**
   * @param {RouteUnderstandingProfileEvidence[]=} profileEvidence
   * @returns {RouteUnderstandingUtilityRouteSceneEvidence[]}
   */
  function utilityRouteScenes(profileEvidence) {
    /** @type {RouteUnderstandingUtilityRouteSceneEvidence[]} */
    const rows = [];
    ensureArray(profileEvidence).forEach((profile) => {
      ensureArray(profile && profile.utilityRouteScenes).forEach((row) => rows.push(row));
      ensureArray(profile && profile.packages).forEach((pkg) => {
        ensureArray(pkg && pkg.utilityRouteScenes).forEach((row) => rows.push(row));
      });
    });
    return rows;
  }

  /**
   * @param {unknown} input
   * @returns {RouteTargetResolution}
   */
  function routeTargetResolution(input) {
    const value = isObject(input) ? input : {};
    const binding = value.dynamicBinding;
    const candidates = binding && binding.candidateTargets || [];
    if (binding && binding.kind === 'set_jump') {
      return {
        status: 'jump_target',
        target: value.target,
        candidateTargets: candidates,
        quality: binding.variable || 'jumpScene',
        reason: 'set-jump records a single-slot return target rather than an immediate scene route.'
      };
    }
    if (binding && binding.kind === 'utility_return_binding') {
      return {
        status: 'dynamic_return_binding',
        target: value.target,
        candidateTargets: candidates,
        quality: binding.variable || 'jumpScene',
        reason: 'Profile marks this as the runtime return binding for a utility route scene.'
      };
    }
    if (value.dynamicTarget) {
      return {
        status: candidates.length ? 'dynamic_finite' : 'dynamic_unknown',
        target: value.target,
        candidateTargets: candidates,
        quality: binding && binding.variable || routeQualityName(value.target)[0] || '',
        reason: candidates.length ? 'Dynamic route has a finite candidate target set.' : 'Route target is read from runtime state.'
      };
    }
    if (value.missing) {
      return {status: 'missing', target: value.target, candidateTargets: [], reason: 'Target is not known to this event or project index.'};
    }
    if (value.external) {
      return {status: 'external', target: value.target, candidateTargets: [], reason: 'Target is external to normal scene resolution.'};
    }
    if (value.terminal) {
      return {status: 'terminal', target: value.target, candidateTargets: [], reason: 'Target is root, terminal, or intentionally script-controlled.'};
    }
    if (isObject(value.staticResolution) && value.staticResolution.status) {
      return clone(value.staticResolution);
    }
    return {status: 'resolved', target: value.target, candidateTargets: [], reason: 'Target resolves statically.'};
  }

  /**
   * @param {unknown} input
   * @returns {RouteSemanticTier}
   */
  function routeSemanticTier(input) {
    const value = isObject(input) ? input : {};
    if (value.confidence === 'runtime_observed' || value.sourceKind === 'runtime') {
      return SEMANTIC_TIER.RUNTIME;
    }
    if (value.targetResolution && value.targetResolution.status === 'profile_alias') {
      return SEMANTIC_TIER.GUIDED;
    }
    if (value.evidenceClass === 'exact' || value.evidenceClass === 'parser_backed' || value.evidenceClass === 'terminal') {
      return value.dynamicTarget ? SEMANTIC_TIER.GUIDED : SEMANTIC_TIER.STATIC;
    }
    if (value.dynamicBinding && ensureArray(value.dynamicBinding.candidateTargets).length) {
      return SEMANTIC_TIER.GUIDED;
    }
    if (value.confidence === 'profile') {
      return SEMANTIC_TIER.GUIDED;
    }
    if (value.evidenceClass === 'script_derived' && value.dynamicBinding && !value.dynamicBinding.manualBoundary) {
      return SEMANTIC_TIER.GUIDED;
    }
    return SEMANTIC_TIER.MANUAL;
  }

  function routeSafeEditEligible(input) {
    const value = isObject(input) ? input : {};
    const semantics = value.runtimeSemantics || {};
    const collision = semantics.collisionSummary || {};
    const hasZeroValid = collision.after && Number(collision.after.zeroValidCount || 0) > 0;
    return value.semanticTier === SEMANTIC_TIER.STATIC &&
      (value.evidenceClass === 'exact' || value.evidenceClass === 'parser_backed') &&
      value.targetResolution && value.targetResolution.status === 'resolved' &&
      !semantics.possibleRandomization &&
      !hasZeroValid &&
      Boolean(value.sourceExact || value.parserBacked);
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
      const semantics = route.runtimeSemantics || {};
      const warnings = ensureArray(semantics && semantics.warnings);
      const collision = semantics && semantics.collisionSummary || {};
      if (semantics && (semantics.selectionMode === 'random_among_valid' || warnings.some((warning) => /multi|random|unconditional/i.test(warning)))) {
        diagnostics.push(diagnostic('warning', 'route_script.multi_valid_randomization', 'Route can select randomly among multiple valid targets: ' + (route.owner || route.from || route.target)));
      }
      if (warnings.some((warning) => /unconditional/i.test(warning))) {
        diagnostics.push(diagnostic('warning', 'route_script.unconditional_not_fallback', 'Unconditional route clauses are always valid; they are not ordered fallback clauses.'));
      }
      if (collision && collision.after && Number(collision.after.zeroValidCount || 0) > 0 || warnings.some((warning) => /zero/i.test(warning))) {
        diagnostics.push(diagnostic('warning', 'route_script.zero_valid_gap', 'Route sampling found a state with no valid target.'));
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
      predicateVariablesIn(field && field.condition).forEach((name) => display.add(name));
      variablesIn(field && (field.value || field.original)).forEach((name) => display.add(name));
    });
    ensureArray(body && body.choiceUnits).forEach((choice) => {
      predicateVariablesIn(choice && choice.displayCondition).forEach((name) => display.add(name));
      predicateVariablesIn(choice && choice.chooseCondition).forEach((name) => option.add(name));
    });
    ensureArray(body && body.options).forEach((choice) => {
      predicateVariablesIn(choice && (choice.displayCondition || choice.sectionViewIf)).forEach((name) => display.add(name));
      predicateVariablesIn(choice && (choice.chooseIf || choice.sectionChooseIf)).forEach((name) => option.add(name));
    });
    ensureArray(body && body.metaFields).forEach((field) => {
      if (/condition|view|when|if/i.test(stringValue(field && (field.label || field.id || field.role)))) {
        predicateVariablesIn(field && (field.value || field.original)).forEach((name) => display.add(name));
      }
    });
    return {display, option};
  }

  function routePredicateVariables(body) {
    const names = new Set();
    ensureArray(body && body.eventGraph && body.eventGraph.edges).forEach((edge) => {
      const kind = stringValue(edge && edge.kind);
      if (/route/i.test(kind) && !/^(?:choice|result_route)$/i.test(kind)) {
        predicateVariablesIn(edge && (edge.condition || edge.predicate)).forEach((name) => names.add(name));
      }
    });
    ensureArray(body && body.flow && body.flow.edges).forEach((edge) => {
      predicateVariablesIn(edge && (edge.condition || edge.predicate)).forEach((name) => names.add(name));
      const kind = stringValue(edge && edge.kind);
      if (kind.indexOf('go_to_ref') >= 0 || edge && (edge.dynamicTarget || edge.targetSource === 'quality')) {
        routeQualityName(edge && (edge.rawTarget || edge.to || edge.target || edge.targetId)).forEach((name) => names.add(name));
      }
    });
    ensureArray(body && body.continuationMap && body.continuationMap.items).forEach((item) => {
      ensureArray(item && item.orderedRoutes).forEach((route) => {
        predicateVariablesIn(route && route.predicate).forEach((name) => names.add(name));
        const kind = stringValue(route && (route.routeKind || route.kind));
        if (kind.indexOf('go_to_ref') >= 0 || route && (route.dynamicTarget || route.targetSource === 'quality')) {
          routeQualityName(route && (route.rawTarget || route.target || route.resolvedTarget)).forEach((name) => names.add(name));
        }
      });
    });
    ensureArray(body && body.metaFields).forEach((field) => {
      if (String(field && (field.role || field.semanticRole) || '').toLowerCase() === 'route') {
        predicateVariablesIn(field && (field.routePredicate || field.condition)).forEach((name) => names.add(name));
      }
    });
    return names;
  }

  function routeQualityVariables(body, options) {
    const names = new Set();
    routePredicateVariables(body).forEach((name) => names.add(name));
    ensureArray(options && options.routeQualityVars || body && body.routeQualityVars).forEach((name) => {
      const clean = cleanVariable(name);
      if (clean) names.add(clean);
    });
    ensureArray(options && options.profileEvidence).forEach((profile) => {
      ensureArray(profile && profile.routeQualityVars).forEach((name) => {
        const clean = cleanVariable(name);
        if (clean) names.add(clean);
      });
      ensureArray(profile && profile.routeHelperTables).forEach((table) => {
        const routeVar = cleanVariable(table && (table.routeVar || table.quality || table.variable));
        if (routeVar) names.add(routeVar);
      });
    });
    return names;
  }

  function routeQualityName(value) {
    const text = cleanTarget(value).replace(/^quality_ref:/, '');
    const clean = cleanVariable(text);
    return clean ? [clean] : [];
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

  function scriptInfluenceFor(input, conditionIndex, routePredicateIndex, routeQualityIndex) {
    const value = isObject(input) ? input : {};
    const writes = ensureArray(value.writes);
    const text = stringValue(value.text);
    const quality = routeQualityIndex || new Set();
    return {
      display: value.hook === 'on-display' || writes.some((name) => conditionIndex.display.has(name)),
      option: writes.some((name) => conditionIndex.option.has(name)),
      route: ensureArray(value.dynamicRouteWrites).length > 0 || /\b(?:go-to|set-root|route|target)\b/i.test(text) || writes.some((name) => routePredicateIndex.has(name) || quality.has(name))
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

  function routeTargetsForScript(text, dynamicRouteWrites) {
    return unique(routeTargetsFromScript(text).concat(
      ensureArray(dynamicRouteWrites).reduce((targets, write) => targets.concat(ensureArray(write && write.candidateTargets)), [])
    ));
  }

  function profileRouteEvidenceRows(profileEvidence) {
    const rows = [];
    ensureArray(profileEvidence).forEach((profile) => {
      const profileId = stringValue(profile && (profile.profileId || profile.id));
      ensureArray(profile && profile.routeHelperTables).forEach((table, tableIndex) => {
        const variable = cleanVariable(table && (table.routeVar || table.quality || table.variable));
        const targets = unique(ensureArray(table && (table.targets || table.candidateTargets || table.scenes)).map(cleanTarget));
        if (!variable || !targets.length) {
          return;
        }
        rows.push({
          id: 'profile_route_table_' + safeProfileId(profileId || tableIndex + 1) + '_' + safeProfileId(variable),
          from: profileId ? 'profile:' + profileId : 'profile',
          target: 'quality_ref:' + variable,
          rawTarget: variable,
          predicate: '',
          confidence: 'profile',
          targetSource: 'quality',
          dynamicTarget: true,
          owner: stringValue(table && (table.label || table.id || variable)),
          source: table && table.source,
          dynamicBinding: {
            kind: 'profile_route_table',
            variable,
            source: 'quality',
            shape: 'profile_declared_table',
            candidateTargets: targets,
            profileBacked: true
          }
        });
      });
    });
    return rows;
  }

  function dynamicRouteWritesFromScript(text, row, routeQualityIndex) {
    const raw = stringValue(text);
    const routeVars = routeQualityIndex || new Set();
    const writes = [];
    const push = (shape, variable, targets, extra) => {
      const clean = cleanVariable(variable);
      const candidateTargets = unique(ensureArray(targets).map(cleanTarget));
      const condition = stringValue(extra && extra.condition);
      if (!clean || !candidateTargets.length || !routeVariableLooksRouteLike(clean, routeVars)) {
        return;
      }
      if (!isConservativeRouteCondition(condition)) {
        return;
      }
      writes.push(Object.assign({
        kind: 'route_quality_write',
        shape,
        variable: clean,
        source: 'quality',
        candidateTargets,
        primaryTarget: candidateTargets[0],
        condition,
        selector: '',
        profileBacked: routeVars.has(clean),
        manualBoundary: false,
        sourceId: stringValue(row && row.id)
      }, extra || {}));
    };

    replaceAll(raw, /\b(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^?;{}]+?)\?\s*['"]([A-Za-z_][A-Za-z0-9_.-]*)['"]\s*:\s*['"]([A-Za-z_][A-Za-z0-9_.-]*)['"]/g, (match) => {
      push('ternary_literal', match[1], [match[3], match[4]], {condition: stringValue(match[2]).trim()});
    });

    replaceAll(raw, /\b(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{([^{}]+)\}\s*\[\s*(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*\]/g, (match) => {
      const targets = [];
      replaceAll(match[2], /:\s*['"]([A-Za-z_][A-Za-z0-9_.-]*)['"]/g, (targetMatch) => {
        targets.push(targetMatch[1]);
      });
      push('finite_object_map', match[1], targets, {selector: match[3]});
    });

    replaceAll(raw, /\bif\s*\(([^)]*)\)\s*\{?\s*(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"]([A-Za-z_][A-Za-z0-9_.-]*)['"]\s*;?\s*\}?\s*else\s*\{?\s*(?:Q\.)?\2\s*=\s*['"]([A-Za-z_][A-Za-z0-9_.-]*)['"]\s*;?\s*\}?/g, (match) => {
      push('if_else_literal', match[2], [match[3], match[4]], {condition: stringValue(match[1]).trim()});
    });

    replaceAll(raw, /\b(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"]([A-Za-z_][A-Za-z0-9_.-]*)['"]/g, (match) => {
      push('literal_assignment', match[1], [match[2]], {});
    });

    return uniqueRouteWrites(writes);
  }

  function dynamicBindingFromRouteEdge(edge) {
    const kind = stringValue(edge && edge.kind);
    if (kind.indexOf('go_to_ref') >= 0 || edge && (edge.dynamicTarget || edge.targetSource === 'quality')) {
      const variable = routeQualityName(edge && (edge.rawTarget || edge.to || edge.target || edge.targetId))[0] || cleanVariable(edge && (edge.routeVar || edge.quality || edge.variable));
      return {
        kind: 'go_to_ref',
        variable,
        source: 'quality',
        shape: 'runtime_quality_ref',
        candidateTargets: unique(ensureArray(edge && (edge.candidateTargets || edge.targets)).map(cleanTarget)),
        primaryTarget: '',
        profileBacked: Boolean(edge && edge.profileBacked)
      };
    }
    if (kind.indexOf('set_jump') >= 0) {
      return {
        kind: 'set_jump',
        variable: 'jumpScene',
        source: 'jump',
        shape: 'single_slot_return',
        candidateTargets: [cleanTarget(edge && (edge.to || edge.target || edge.rawTarget))].filter(Boolean),
        primaryTarget: cleanTarget(edge && (edge.to || edge.target || edge.rawTarget))
      };
    }
    return null;
  }

  function routeVariableLooksRouteLike(variable, routeVars) {
    const clean = cleanVariable(variable);
    return routeVars && routeVars.has(clean) || /(?:route|target|next|scene|root|jump)$/i.test(clean) || /(?:^|_)(?:route|target|next|scene|root|jump)(?:_|$)/i.test(clean);
  }

  function isConservativeRouteCondition(condition) {
    const text = stringValue(condition).trim();
    if (!text) {
      return true;
    }
    return isSimpleCondition(text) && !hasFunctionCall(text) && !/\b(?:Math\.random|random|this\.|window\.|document\.)\b/.test(text);
  }

  function uniqueRouteWrites(writes) {
    const seen = new Set();
    return ensureArray(writes).filter((write) => {
      const key = [write.shape, write.variable, ensureArray(write.candidateTargets).join(','), write.condition, write.selector].join('|');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function replaceAll(text, regex, callback) {
    String(text || '').replace(regex, function replaceMatch() {
      callback(Array.prototype.slice.call(arguments, 0, -2));
      return arguments[0];
    });
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

  function predicateVariablesIn(value) {
    const text = stringValue(value).replace(/(['"])(?:\\.|(?!\1)[\s\S])*\1/g, ' ');
    const names = [];
    text.replace(/\b(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\b/g, (_match, name) => {
      const clean = cleanVariable(name);
      if (clean && !isPredicateKeyword(clean)) {
        names.push(clean);
      }
      return '';
    });
    return unique(names);
  }

  function isPredicateKeyword(value) {
    return /^(?:and|or|not|if|true|false|null|undefined)$/i.test(stringValue(value));
  }

  function isRouteEdge(edge) {
    const kind = stringValue(edge && edge.kind);
    return kind === 'route' || kind === 'conditional_route' || kind === 'return_route' || kind === 'exit_route' ||
      kind.indexOf('go_to_ref') >= 0 || kind.indexOf('set_jump') >= 0;
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
    return resolveStaticTarget(body, target).status !== 'missing';
  }

  function resolveStaticTarget(body, target) {
    const clean = cleanTarget(target);
    if (!clean || clean === 'root') {
      return {
        status: 'resolved',
        target: clean,
        resolvedId: clean || 'root',
        scope: 'terminal',
        candidateTargets: [clean || 'root'],
        reason: 'Target is the project root or empty terminal target.'
      };
    }
    if (/^\.\./.test(clean)) {
      return {
        status: 'ambiguous',
        target: clean,
        scope: 'parent_relative',
        candidateTargets: [],
        ambiguous: true,
        reason: 'Parent-relative target requires compiler resolution proof before safe editing.'
      };
    }
    const absolute = clean[0] === '.';
    const wanted = absolute ? clean.replace(/^\.+/, '') : clean;
    const rows = routeTargetRows(body);
    const localMatches = rows.filter((row) => row.local && targetRowMatches(row, wanted, absolute));
    const globalMatches = rows.filter((row) => row.global && targetRowMatches(row, wanted, absolute));
    const graphMatches = rows.filter((row) => row.graph && targetRowMatches(row, wanted, absolute));
    const allMatches = localMatches.concat(globalMatches, graphMatches);
    const uniqueMatches = uniqueRowsById(allMatches);
    if (!uniqueMatches.length) {
      return {
        status: 'missing',
        target: clean,
        scope: 'unresolved',
        candidateTargets: [],
        reason: 'Target is not known to this event or project index.'
      };
    }
    const unqualified = clean.indexOf('.') < 0 && !absolute;
    if (unqualified && localMatches.length && globalMatches.length) {
      return ambiguousResolution(clean, localMatches.concat(globalMatches), 'Local route target shadows a global scene id; compiler proof is required before safe structured editing.');
    }
    if (uniqueMatches.length > 1) {
      return ambiguousResolution(clean, uniqueMatches, 'Route target has multiple possible static matches.');
    }
    const match = uniqueMatches[0];
    if (match.scope === 'profile_static_alias') {
      return {
        status: 'profile_alias',
        target: clean,
        resolvedId: match.resolvedId || match.id,
        scope: match.scope,
        candidateTargets: [match.resolvedId || match.id].filter(Boolean),
        proof: match.proof,
        shadowed: false,
        reason: 'Profile declares this route target as a static alias.'
      };
    }
    return {
      status: 'resolved',
      target: clean,
      resolvedId: match.resolvedId || match.id,
      scope: match.scope,
      candidateTargets: [match.resolvedId || match.id].filter(Boolean),
      proof: match.proof,
      shadowed: false,
      reason: 'Target resolves statically as ' + match.scope + '.'
    };
  }

  // Memoized per body: resolveStaticTarget runs once per route and rebuilt this
  // whole list (sections/options/graph nodes + ~all project scene ids) each
  // time, making resolution O(routes x targets) (~51s of a 89s build on a
  // 213-section event). body is a single per-build clone, stable in these
  // fields; the WeakMap keys on it so fresh clones never see stale rows.
  const routeTargetRowsCache = new WeakMap();

  function routeTargetRows(body) {
    if (isObject(body) && routeTargetRowsCache.has(body)) {
      return routeTargetRowsCache.get(body);
    }
    /** @type {Array<Record<string, any>>} */
    const rows = [];
    const structureId = stringValue(body && body.eventStructure && body.eventStructure.id || body && body.id);
    if (structureId) {
      rows.push(targetRow(structureId, 'local_scene', {local: true, proof: 'eventStructure.id'}));
    }
    ensureArray(body && body.branchSections).forEach((field, index) => {
      [field && field.sectionId, field && field.targetId, field && field.id].map(stringValue).filter(Boolean).forEach((id) => {
        rows.push(targetRow(id, 'local_section', {local: true, eventId: structureId, proof: 'branchSections[' + index + ']'}));
      });
    });
    ensureArray(body && body.sections).forEach((field, index) => {
      [field && field.sectionId, field && field.targetId, field && field.id].map(stringValue).filter(Boolean).forEach((id) => {
        rows.push(targetRow(id, 'local_section', {local: true, eventId: structureId, proof: 'sections[' + index + ']'}));
      });
    });
    ensureArray(body && body.options).forEach((option, index) => {
      [option && option.targetId, option && option.rawTargetId].map(stringValue).filter(Boolean).forEach((id) => {
        rows.push(targetRow(id, 'option_target', {local: true, eventId: structureId, proof: 'options[' + index + ']'}));
      });
    });
    ensureArray(body && body.flow && body.flow.nodes).forEach((node, index) => {
      [node && node.id, node && node.sectionId, node && node.targetId].map(stringValue).filter(Boolean).forEach((id) => {
        rows.push(targetRow(id, 'graph_node', {graph: true, local: true, eventId: structureId, proof: 'flow.nodes[' + index + ']'}));
      });
    });
    ensureArray(body && body.sourceStructureGraph && body.sourceStructureGraph.nodes).forEach((node, index) => {
      [node && node.id, node && node.sectionId, node && node.targetId].map(stringValue).filter(Boolean).forEach((id) => {
        rows.push(targetRow(id, 'source_graph_node', {graph: true, local: true, eventId: structureId, proof: 'sourceStructureGraph.nodes[' + index + ']'}));
      });
    });
    ensureArray(body && (body.projectSceneIds || body.knownSceneIds || body.globalSceneIds)).forEach((id, index) => {
      if (id) rows.push(targetRow(id, 'global_scene', {global: true, proof: 'projectSceneIds[' + index + ']'}));
    });
    staticAliasRows(body && body.profileEvidence).forEach((row) => rows.push(row));
    const result = uniqueRowsById(rows);
    if (isObject(body)) {
      routeTargetRowsCache.set(body, result);
    }
    return result;
  }

  function targetRow(id, scope, options) {
    const value = cleanTarget(id);
    const eventId = cleanTarget(options && options.eventId);
    const shortId = value.split('.').pop() || value;
    const qualifiedId = value.indexOf('.') >= 0 || !eventId ? value : eventId + '.' + value;
    return {
      id: value,
      shortId,
      qualifiedId,
      resolvedId: cleanTarget(options && options.resolvedId) || (scope === 'local_section' || scope === 'option_target' || scope === 'graph_node' || scope === 'source_graph_node' ? qualifiedId : value),
      scope,
      local: Boolean(options && options.local),
      global: Boolean(options && options.global),
      graph: Boolean(options && options.graph),
      proof: stringValue(options && options.proof)
    };
  }

  function targetRowMatches(row, wanted, absolute) {
    if (!row || !wanted) {
      return false;
    }
    if (absolute) {
      return row.global && row.id === wanted;
    }
    if (row.scope === 'profile_static_alias') {
      return row.id === wanted || row.shortId === wanted;
    }
    return row.id === wanted || row.qualifiedId === wanted || row.resolvedId === wanted || row.shortId === wanted;
  }

  function uniqueRowsById(rows) {
    const seen = new Set();
    return ensureArray(rows).filter((row) => {
      const key = [row.id, row.resolvedId || row.id].join('|');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return Boolean(row && row.id);
    });
  }

  function ambiguousResolution(target, matches, reason) {
    const rows = uniqueRowsById(matches);
    return {
      status: 'ambiguous',
      target,
      scope: 'ambiguous',
      candidateTargets: unique(rows.map((row) => row.resolvedId || row.id)),
      candidates: rows.map((row) => ({
        id: row.id,
        resolvedId: row.resolvedId || row.id,
        scope: row.scope,
        proof: row.proof
      })),
      ambiguous: true,
      shadowed: rows.some((row) => row.local) && rows.some((row) => row.global),
      reason
    };
  }

  function staticAliasRows(profileEvidence) {
    /** @type {Array<Record<string, any>>} */
    const rows = [];
    ensureArray(profileEvidence).forEach((profile, profileIndex) => {
      const profileId = safeProfileId(profile && (profile.profileId || profile.id || profileIndex + 1));
      const aliases = profile && profile.staticAliases;
      if (Array.isArray(aliases)) {
        aliases.forEach((entry, index) => {
          const alias = cleanTarget(entry && (entry.alias || entry.from || entry.id || entry.name));
          const target = cleanTarget(entry && (entry.target || entry.to || entry.sceneId || entry.value));
          if (alias && target) {
            rows.push(targetRow(alias, 'profile_static_alias', {
              global: true,
              resolvedId: target,
              proof: 'profile.staticAliases[' + profileId + ':' + index + ']'
            }));
          }
        });
      } else if (isObject(aliases)) {
        Object.keys(aliases).forEach((alias) => {
          const target = cleanTarget(aliases[alias]);
          if (alias && target) {
            rows.push(targetRow(alias, 'profile_static_alias', {
              global: true,
              resolvedId: target,
              proof: 'profile.staticAliases[' + profileId + ':' + alias + ']'
            }));
          }
        });
      }
      rows.push.apply(rows, staticAliasRows(profile && profile.packages));
    });
    return rows;
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
    const hookMatch = stringValue(raw).match(/^(on-arrival|on-departure|on-display)\s*:/i);
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

  function safeProfileId(value) {
    return stringValue(value).trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'profile';
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

  /**
   * @param {unknown} value
   * @returns {value is Record<string, any>}
   */
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
