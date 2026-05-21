// @ts-check
(function initProjectMapRouteGuidedEditModel(global) {
  'use strict';

  const MODEL_VERSION = '0.1';
  const MODEL_KIND = 'route_guided_edit_model';
  const SEMANTIC_TIER = Object.freeze({
    STATIC: 'static_exact',
    GUIDED: 'guided_profile',
    RUNTIME: 'runtime_observed',
    MANUAL: 'manual_boundary'
  });
  const GUIDED_KINDS = Object.freeze({
    UTILITY_PAIR: 'utility_pair',
    ROUTE_TABLE: 'route_table_binding',
    FALLBACK: 'explicit_fallback_helper'
  });
  const ROUTE_TABLE_SHAPES = new Set(['literal_assignment', 'ternary_literal', 'finite_object_map', 'if_else_literal', 'profile_declared_table']);

  /**
   * @typedef {import('../types/project_map_contracts').DiagnosticRow} DiagnosticRow
   * @typedef {import('../types/project_map_contracts').ExplicitFallbackSuggestion} ExplicitFallbackSuggestion
   * @typedef {import('../types/project_map_contracts').RouteBindingTableEdit} RouteBindingTableEdit
   * @typedef {import('../types/project_map_contracts').RouteEvidenceItem} RouteEvidenceItem
   * @typedef {import('../types/project_map_contracts').RouteGuidedEditBuildOptions} RouteGuidedEditBuildOptions
   * @typedef {import('../types/project_map_contracts').RouteGuidedEditEntry} RouteGuidedEditEntry
   * @typedef {import('../types/project_map_contracts').RouteGuidedEditModel} RouteGuidedEditModel
   * @typedef {import('../types/project_map_contracts').RouteUnderstandingProfileEvidence} RouteUnderstandingProfileEvidence
   * @typedef {import('../types/project_map_contracts').RouteUnderstandingUtilityCall} RouteUnderstandingUtilityCall
   * @typedef {import('../types/project_map_contracts').ScriptImpactBlock} ScriptImpactBlock
   * @typedef {import('../types/project_map_contracts').SourceRef} SourceRef
   * @typedef {import('../types/project_map_contracts').UtilityPairEdit} UtilityPairEdit
   */

  /**
   * @param {unknown} eventBody
   * @param {RouteGuidedEditBuildOptions=} options
   * @returns {RouteGuidedEditModel}
   */
  function buildRouteGuidedEditModel(eventBody, options) {
    /** @type {Record<string, any>} */
    const body = isObject(eventBody) ? eventBody : {};
    /** @type {Record<string, any>} */
    const opts = isObject(options) ? options : {};
    const index = projectIndexFor(body, opts);
    const eventId = stringValue(opts.eventId || body.eventStructure && body.eventStructure.id || body.id);
    /** @type {RouteEvidenceItem[]} */
    const routeEvidence = ensureArray(opts.routeEvidence && opts.routeEvidence.items || body.routeEvidenceMap && body.routeEvidenceMap.items);
    /** @type {ScriptImpactBlock[]} */
    const scripts = ensureArray(opts.scriptImpactMap && opts.scriptImpactMap.blocks || body.scriptImpactMap && body.scriptImpactMap.blocks);
    const routeUnderstanding = isObject(opts.routeUnderstanding) ? opts.routeUnderstanding : body.routeUnderstanding || {};
    const profiles = profileEvidenceRows(body, opts, index);
    const context = {
      body,
      opts,
      index,
      eventId,
      routeEvidence,
      scripts,
      routeUnderstanding,
      profiles,
      routeOrderGroups: routeOrderGroupsFor(body, opts, index),
      protectedSceneIds: protectedRouterSceneSet(profiles)
    };
    const entries = uniqueEntries([]
      .concat(buildUtilityPairEntries(context))
      .concat(buildRouteTableEntries(context))
      .concat(buildExplicitFallbackEntries(context)));
    const diagnostics = diagnosticsFor(entries);
    return {
      schemaVersion: MODEL_VERSION,
      kind: MODEL_KIND,
      eventId,
      entries,
      summary: {
        entryCount: entries.length,
        safeEditCount: entries.filter((entry) => entry.safeEditEligible).length,
        manualBoundaryCount: entries.filter((entry) => !entry.safeEditEligible || entry.semanticTier === SEMANTIC_TIER.MANUAL).length,
        utilityPairCount: entries.filter((entry) => entry.kind === GUIDED_KINDS.UTILITY_PAIR).length,
        routeTableBindingCount: entries.filter((entry) => entry.kind === GUIDED_KINDS.ROUTE_TABLE).length,
        explicitFallbackHelperCount: entries.filter((entry) => entry.kind === GUIDED_KINDS.FALLBACK).length
      },
      diagnostics
    };
  }

  function buildUtilityPairEntries(context) {
    /** @type {RouteGuidedEditEntry[]} */
    const entries = [];
    const utilityCalls = ensureArray(context.routeUnderstanding && context.routeUnderstanding.utilityCalls);
    utilityCalls.forEach((call, index) => {
      const utility = cleanTarget(call && call.utilitySceneId);
      const setJumpTarget = cleanTarget(call && call.setJumpTarget);
      if (!utility || !setJumpTarget) {
        return;
      }
      const callRoute = findUtilityCallRoute(context.routeEvidence, call);
      const jumpRoute = findSetJumpRoute(context.routeEvidence, call);
      const callSource = sourceWithAnchor(callRoute && callRoute.source || call && call.source || {}, callRoute && (callRoute.source && callRoute.source.anchorText || routeLineText('go-to', utility)));
      const jumpSource = sourceWithAnchor(jumpRoute && jumpRoute.source || {}, jumpRoute && (jumpRoute.source && jumpRoute.source.anchorText || routeLineText('set-jump', setJumpTarget)));
      const pair = {
        from: stringValue(call && call.from || callRoute && callRoute.from || callRoute && callRoute.owner),
        utilitySceneId: utility,
        setJumpTarget,
        returnBinding: stringValue(call && call.returnBinding || 'jumpScene'),
        utilityKind: stringValue(call && call.utilityKind || 'single_slot_return_utility'),
        callSource,
        setJumpSource: jumpSource,
        callText: callSource.anchorText || routeLineText('go-to', utility),
        setJumpText: jumpSource.anchorText || routeLineText('set-jump', setJumpTarget),
        exactSource: hasExactSource(callSource) && hasExactSource(jumpSource),
        profileBacked: String(call && call.evidenceClass || '') === 'profile_utility' || String(call && call.semanticTier || '') === SEMANTIC_TIER.GUIDED
      };
      const manualReasons = utilityPairManualReasons(pair, context, callRoute, jumpRoute);
      const safe = manualReasons.length === 0;
      entries.push(guidedEntry({
        id: 'utility_pair_' + safeId([pair.from, utility, setJumpTarget, index + 1].join('_')),
        kind: GUIDED_KINDS.UTILITY_PAIR,
        label: 'Utility pair: ' + [pair.from, utility].filter(Boolean).join(' -> '),
        semanticTier: safe ? SEMANTIC_TIER.GUIDED : SEMANTIC_TIER.MANUAL,
        evidenceClass: 'profile_utility',
        safeEditEligible: safe,
        installSafety: safe ? 'guarded_apply' : 'advanced_apply',
        source: pair.callSource,
        sourceEvidence: {callSource: pair.callSource, setJumpSource: pair.setJumpSource},
        manualReasons,
        utilityPair: pair,
        editAction: guidedEditAction({
          kind: GUIDED_KINDS.UTILITY_PAIR,
          label: 'Edit utility pair',
          targetId: pair.from || pair.utilitySceneId,
          installSafety: safe ? 'guarded_apply' : 'advanced_apply',
          source: pair.callSource,
          semanticPayload: {utilityPair: pair}
        }, safe)
      }));
    });
    return entries;
  }

  function buildRouteTableEntries(context) {
    /** @type {RouteGuidedEditEntry[]} */
    const entries = [];
    context.scripts.forEach((block, blockIndex) => {
      const writes = ensureArray(block && block.dynamicRouteWrites);
      if (!writes.length && block && block.routeInfluence && block.safetyClass === 'manual_boundary') {
        entries.push(manualRouteTableEntry(block, blockIndex));
        return;
      }
      writes.forEach((write, writeIndex) => {
        const table = routeTableFromScriptWrite(block, write, writeIndex);
        if (!table) {
          return;
        }
        const manualReasons = routeTableManualReasons(table, block);
        const safe = manualReasons.length === 0;
        entries.push(guidedEntry({
          id: 'route_table_' + safeId([table.variable, table.shape, block.id || blockIndex + 1, writeIndex + 1].join('_')),
          kind: GUIDED_KINDS.ROUTE_TABLE,
          label: 'Route table: ' + table.variable,
          semanticTier: safe ? SEMANTIC_TIER.GUIDED : SEMANTIC_TIER.MANUAL,
          evidenceClass: 'script_derived',
          safeEditEligible: safe,
          installSafety: safe ? 'guarded_apply' : 'advanced_apply',
          source: table.source,
          sourceEvidence: {shape: table.shape, sourceKind: table.sourceKind},
          manualReasons,
          routeTable: table,
          editAction: guidedEditAction({
            kind: GUIDED_KINDS.ROUTE_TABLE,
            label: 'Edit route table',
            targetId: table.variable,
            installSafety: safe ? 'guarded_apply' : 'advanced_apply',
            source: table.source,
            semanticPayload: {routeTable: table}
          }, safe)
        }));
      });
    });
    profileRouteHelperTables(context).forEach((table, index) => {
      const routeTable = routeTableFromProfileTable(table, index);
      if (!routeTable) {
        return;
      }
      const manualReasons = routeTableManualReasons(routeTable, {});
      const safe = manualReasons.length === 0;
      entries.push(guidedEntry({
        id: 'route_profile_table_' + safeId([routeTable.variable, index + 1].join('_')),
        kind: GUIDED_KINDS.ROUTE_TABLE,
        label: 'Profile route table: ' + routeTable.variable,
        semanticTier: safe ? SEMANTIC_TIER.GUIDED : SEMANTIC_TIER.MANUAL,
        evidenceClass: 'profile_route_table',
        safeEditEligible: safe,
        installSafety: safe ? 'guarded_apply' : 'advanced_apply',
        source: routeTable.source,
        sourceEvidence: {shape: routeTable.shape, sourceKind: routeTable.sourceKind},
        manualReasons,
        routeTable,
        editAction: guidedEditAction({
          kind: GUIDED_KINDS.ROUTE_TABLE,
          label: 'Edit route table',
          targetId: routeTable.variable,
          installSafety: safe ? 'guarded_apply' : 'advanced_apply',
          source: routeTable.source,
          semanticPayload: {routeTable}
        }, safe)
      }));
    });
    routeEvidenceDynamicRefs(context.routeEvidence).forEach((route, index) => {
      const binding = route && route.dynamicBinding || {};
      const targets = ensureArray(binding.candidateTargets).map(cleanTarget).filter(Boolean);
      if (!targets.length || entries.some((entry) => entry.routeTable && entry.routeTable.variable === binding.variable)) {
        return;
      }
      const table = {
        variable: cleanVariable(binding.variable || route.rawTarget || route.target),
        shape: stringValue(binding.shape || binding.kind || 'runtime_quality_ref'),
        sourceKind: stringValue(route.sourceKind || 'route_evidence'),
        source: sourceRef(route.source || {}),
        sourceText: '',
        candidateTargets: targets,
        rows: targets.map((target, rowIndex) => ({
          id: 'candidate_' + (rowIndex + 1),
          label: 'Candidate ' + (rowIndex + 1),
          target,
          source: sourceRef(route.source || {}),
          sourceText: '',
          editable: false,
          manualReason: 'candidate_targets_not_source_literal'
        }))
      };
      entries.push(guidedEntry({
        id: 'route_ref_table_' + safeId([table.variable, index + 1].join('_')),
        kind: GUIDED_KINDS.ROUTE_TABLE,
        label: 'Route ref candidates: ' + table.variable,
        semanticTier: SEMANTIC_TIER.MANUAL,
        evidenceClass: 'script_derived',
        safeEditEligible: false,
        installSafety: 'advanced_apply',
        source: table.source,
        sourceEvidence: {shape: table.shape, sourceKind: table.sourceKind},
        manualReasons: ['candidate_targets_not_source_literal'],
        routeTable: table,
        editAction: guidedEditAction({
          kind: GUIDED_KINDS.ROUTE_TABLE,
          label: 'Review route ref candidates',
          targetId: table.variable,
          installSafety: 'advanced_apply',
          source: table.source,
          semanticPayload: {routeTable: table}
        }, false)
      }));
    });
    return entries;
  }

  function buildExplicitFallbackEntries(context) {
    /** @type {RouteGuidedEditEntry[]} */
    const entries = [];
    ensureArray(context.routeOrderGroups).forEach((group, index) => {
      const suggestion = explicitFallbackSuggestion(group);
      if (!suggestion) {
        return;
      }
      const source = sourceRef(group && group.source || {});
      const manualReasons = suggestion.editable ? [] : [suggestion.manualReason || 'fallback_predicate_not_simple'];
      entries.push(guidedEntry({
        id: 'explicit_fallback_' + safeId(group && (group.id || group.ownerId || group.sceneId) || index + 1),
        kind: GUIDED_KINDS.FALLBACK,
        label: suggestion.editable ? 'Make explicit fallback' : 'Fallback needs manual review',
        semanticTier: suggestion.editable ? SEMANTIC_TIER.STATIC : SEMANTIC_TIER.MANUAL,
        evidenceClass: 'parser_backed',
        safeEditEligible: Boolean(suggestion.editable),
        installSafety: suggestion.editable ? 'guarded_apply' : 'advanced_apply',
        source,
        sourceEvidence: {routeField: group && group.routeField, routeKind: group && group.routeKind},
        manualReasons,
        fallbackSuggestion: suggestion,
        editAction: guidedEditAction({
          kind: GUIDED_KINDS.FALLBACK,
          label: suggestion.editable ? 'Make explicit fallback' : 'Review fallback source',
          targetId: stringValue(group && (group.ownerId || group.sceneId)),
          installSafety: suggestion.editable ? 'guarded_apply' : 'advanced_apply',
          source,
          semanticPayload: {fallbackSuggestion: suggestion}
        }, Boolean(suggestion.editable))
      }));
    });
    return entries;
  }

  function findUtilityCallRoute(routes, call) {
    const utility = cleanTarget(call && call.utilitySceneId);
    const from = stringValue(call && call.from);
    return ensureArray(routes).find((route) => {
      return cleanTarget(route && route.target) === utility &&
        route && (!route.dynamicBinding || route.dynamicBinding.kind !== 'set_jump') &&
        (!from || sameOwner(route, from));
    }) || null;
  }

  function findSetJumpRoute(routes, call) {
    const target = cleanTarget(call && call.setJumpTarget);
    const from = stringValue(call && call.from);
    return ensureArray(routes).find((route) => {
      const binding = route && route.dynamicBinding || {};
      return (binding.kind === 'set_jump' || String(route && route.routeKind || '').indexOf('set_jump') >= 0) &&
        (!target || cleanTarget(route && (route.target || route.rawTarget || binding.primaryTarget)) === target) &&
        (!from || sameOwner(route, from));
    }) || null;
  }

  function sameOwner(route, owner) {
    const clean = stringValue(owner);
    return !clean || [route && route.from, route && route.owner].map(stringValue).includes(clean);
  }

  function utilityPairManualReasons(pair, context, callRoute, jumpRoute) {
    const reasons = [];
    if (!callRoute) reasons.push('utility_call_route_missing');
    if (!jumpRoute) reasons.push('set_jump_route_missing');
    if (!pair.exactSource) reasons.push('source_evidence_not_exact');
    if (pair.utilityKind !== 'single_slot_return_utility') reasons.push('utility_kind_not_single_slot');
    if (!isSimpleTarget(pair.setJumpTarget)) reasons.push('computed_or_nested_jump_target');
    if (isProtectedSource(pair.callSource.path) || isProtectedSource(pair.setJumpSource.path)) reasons.push('protected_router_source');
    if (context.protectedSceneIds.has(pair.from) || context.protectedSceneIds.has(pair.utilitySceneId)) reasons.push('protected_router_scene');
    return uniqueStrings(reasons);
  }

  function routeTableFromScriptWrite(block, write, index) {
    const shape = stringValue(write && write.shape || write && write.kind);
    const variable = cleanVariable(write && write.variable);
    const candidates = ensureArray(write && write.candidateTargets).map(cleanTarget).filter(Boolean);
    if (!variable || !candidates.length) {
      return null;
    }
    const sourceText = stringValue(block && (block.rawText || block.text || block.rawPreview));
    const source = sourceWithAnchor(block && block.source || {}, sourceText);
    return {
      variable,
      shape,
      sourceKind: stringValue(block && block.scriptKind || 'script'),
      source,
      sourceText,
      candidateTargets: candidates,
      rows: candidates.map((target, rowIndex) => ({
        id: 'route_table_row_' + (rowIndex + 1),
        label: routeTableRowLabel(shape, rowIndex, write),
        condition: rowIndex === 0 ? stringValue(write && write.condition) : '',
        key: rowIndex === 0 ? stringValue(write && write.selector) : '',
        target,
        source,
        sourceText,
        editable: ROUTE_TABLE_SHAPES.has(shape),
        manualReason: ROUTE_TABLE_SHAPES.has(shape) ? '' : 'route_table_shape_not_editable'
      }))
    };
  }

  function manualRouteTableEntry(block, index) {
    const sourceText = stringValue(block && (block.rawText || block.rawPreview || block.text));
    const source = sourceWithAnchor(block && block.source || {}, sourceText);
    const table = {
      variable: stringValue(block && (block.label || block.id || 'dynamic_route')),
      shape: 'manual_boundary',
      sourceKind: stringValue(block && block.scriptKind || 'script'),
      source,
      sourceText,
      candidateTargets: ensureArray(block && block.routeTargets).map(cleanTarget).filter(Boolean),
      rows: [{
        id: 'manual_boundary',
        label: 'Manual boundary',
        target: '',
        source,
        sourceText,
        editable: false,
        manualReason: ensureArray(block && block.boundaryReasons).join(', ') || 'manual_script_boundary'
      }]
    };
    return guidedEntry({
      id: 'route_table_manual_' + safeId(block && block.id || index + 1),
      kind: GUIDED_KINDS.ROUTE_TABLE,
      label: 'Route table needs manual review: ' + table.variable,
      semanticTier: SEMANTIC_TIER.MANUAL,
      evidenceClass: 'script_derived',
      safeEditEligible: false,
      installSafety: 'advanced_apply',
      source,
      sourceEvidence: {shape: table.shape, sourceKind: table.sourceKind},
      manualReasons: ['manual_script_boundary'].concat(ensureArray(block && block.boundaryReasons).map(stringValue)),
      routeTable: table,
      editAction: guidedEditAction({
        kind: GUIDED_KINDS.ROUTE_TABLE,
        label: 'Review route table source',
        targetId: table.variable,
        installSafety: 'advanced_apply',
        source,
        semanticPayload: {routeTable: table}
      }, false)
    });
  }

  function routeTableFromProfileTable(table, index) {
    const variable = cleanVariable(table && (table.routeVar || table.quality || table.variable));
    const rows = ensureArray(table && table.rows);
    const targets = uniqueStrings(rows.length
      ? rows.map((row) => cleanTarget(row && (row.target || row.sceneId || row.value)))
      : ensureArray(table && (table.targets || table.candidateTargets || table.scenes)).map(cleanTarget));
    if (!variable || !targets.length) {
      return null;
    }
    const sourceText = stringValue(table && (table.sourceText || table.text || table.source && table.source.anchorText));
    const source = sourceWithAnchor(table && table.source || {}, sourceText);
    return {
      variable,
      shape: 'profile_declared_table',
      sourceKind: 'profile',
      source,
      sourceText,
      candidateTargets: targets,
      rows: targets.map((target, rowIndex) => {
        const row = rows[rowIndex] || {};
        return {
          id: stringValue(row && row.id || 'profile_route_table_' + (index + 1) + '_' + (rowIndex + 1)),
          label: stringValue(row && (row.label || row.key || row.condition) || 'Entry ' + (rowIndex + 1)),
          key: stringValue(row && row.key),
          condition: stringValue(row && row.condition),
          target,
          source,
          sourceText,
          editable: true,
          manualReason: ''
        };
      })
    };
  }

  function routeTableManualReasons(table, block) {
    const reasons = [];
    if (!ROUTE_TABLE_SHAPES.has(table.shape)) reasons.push('route_table_shape_not_editable');
    if (!hasExactSource(table.source) || !table.sourceText) reasons.push('source_evidence_not_exact');
    if (isProtectedSource(table.source.path)) reasons.push('protected_router_source');
    if (block && block.safetyClass === 'manual_boundary') reasons.push('manual_script_boundary');
    if (ensureArray(table.rows).some((row) => row.editable === false)) reasons.push('nonliteral_candidate_target');
    return uniqueStrings(reasons);
  }

  function explicitFallbackSuggestion(group) {
    const source = sourceWithAnchor(group && group.source || {}, stringValue(group && group.sourceRaw));
    const clauses = ensureArray(group && group.clauses).map((clause, index) => ({
      order: Number(clause && clause.order || index + 1),
      target: cleanTarget(clause && (clause.rawTarget || clause.target || clause.resolvedTarget)),
      predicate: stringValue(clause && clause.predicate).trim(),
      raw: stringValue(clause && clause.raw)
    })).filter((clause) => clause.target);
    const sourceText = stringValue(group && (group.sourceRaw || source.anchorText || source.excerpt));
    const fallbackBase = {
      sourceText,
      suggestedText: sourceText,
      conditionalTarget: '',
      fallbackTarget: '',
      predicate: '',
      complementPredicate: '',
      source,
      editable: false,
      manualReason: ''
    };
    const conditional = clauses.filter((clause) => clause.predicate);
    const unconditional = clauses.filter((clause) => !clause.predicate);
    if (!conditional.length || !unconditional.length) {
      return null;
    }
    if (!(clauses.length === 2 && conditional.length === 1 && unconditional.length === 1)) {
      return Object.assign({}, fallbackBase, {manualReason: 'fallback_shape_not_single_conditional'});
    }
    const complement = complementPredicate(conditional[0].predicate);
    if (!complement) {
      return Object.assign({}, fallbackBase, {
        conditionalTarget: conditional[0].target,
        fallbackTarget: unconditional[0].target,
        predicate: conditional[0].predicate,
        manualReason: 'fallback_predicate_not_simple'
      });
    }
    if (!hasExactSource(source)) {
      return Object.assign({}, fallbackBase, {
        conditionalTarget: conditional[0].target,
        fallbackTarget: unconditional[0].target,
        predicate: conditional[0].predicate,
        complementPredicate: complement,
        manualReason: 'source_evidence_not_exact'
      });
    }
    const linePrefix = /^go-to\s*:/i.test(sourceText) ? sourceText.match(/^\s*go-to\s*:\s*/i)[0] : 'go-to: ';
    const rendered = linePrefix + conditional[0].target + ' if ' + conditional[0].predicate + '; ' + unconditional[0].target + ' if ' + complement;
    return {
      sourceText,
      suggestedText: rendered,
      conditionalTarget: conditional[0].target,
      fallbackTarget: unconditional[0].target,
      predicate: conditional[0].predicate,
      complementPredicate: complement,
      source,
      editable: true,
      manualReason: ''
    };
  }

  function complementPredicate(predicate) {
    const text = stringValue(predicate).trim().replace(/^\((.*)\)$/, '$1').trim();
    if (/\b(?:and|or|not)\b/i.test(text)) {
      return '';
    }
    const match = text.match(/^(.+?)\s*(>=|<=|!=|==|=|>|<)\s*(.+)$/);
    if (!match || /[{};]/.test(text)) {
      return '';
    }
    const inverse = {
      '=': '!=',
      '==': '!=',
      '!=': '=',
      '>': '<=',
      '>=': '<',
      '<': '>=',
      '<=': '>'
    }[match[2]];
    if (!inverse) {
      return '';
    }
    return [match[1].trim(), inverse, match[3].trim()].join(' ');
  }

  function guidedEntry(input) {
    const value = input || {};
    return {
      id: stringValue(value.id),
      kind: stringValue(value.kind),
      label: stringValue(value.label),
      semanticTier: stringValue(value.semanticTier || SEMANTIC_TIER.MANUAL),
      safeEditEligible: Boolean(value.safeEditEligible),
      installSafety: stringValue(value.installSafety || (value.safeEditEligible ? 'guarded_apply' : 'advanced_apply')),
      evidenceClass: stringValue(value.evidenceClass || ''),
      source: sourceRef(value.source || {}),
      sourceEvidence: value.sourceEvidence || {},
      manualReasons: uniqueStrings(ensureArray(value.manualReasons).map(stringValue)),
      editAction: value.editAction || null,
      utilityPair: value.utilityPair || undefined,
      routeTable: value.routeTable || undefined,
      fallbackSuggestion: value.fallbackSuggestion || undefined
    };
  }

  function guidedEditAction(input, semantic) {
    const value = input || {};
    const source = sourceRef(value.source || {});
    if (!semantic) {
      return {
        actionKind: source.path ? 'open_source_slice' : 'manual_review',
        routeClass: value.installSafety === 'advanced_apply' ? 'advanced_source_patch' : 'source_slice_editor',
        targetView: 'source_slice',
        targetId: stringValue(value.targetId || source.path),
        fieldId: 'guided.' + stringValue(value.kind || 'route'),
        label: stringValue(value.label || 'Review source'),
        installSafety: stringValue(value.installSafety || 'advanced_apply'),
        source
      };
    }
    return {
      actionKind: 'open_route_editor',
      routeClass: 'route_guided_editor',
      targetView: 'events',
      targetId: stringValue(value.targetId || source.path),
      fieldId: 'guided.' + stringValue(value.kind || 'route'),
      label: stringValue(value.label || 'Open guided editor'),
      installSafety: stringValue(value.installSafety || 'guarded_apply'),
      source,
      forceSemanticEditor: true,
      semanticEditor: Object.assign({
        kind: stringValue(value.kind || 'route_order'),
        role: 'route',
        title: stringValue(value.label || 'Guided route edit'),
        source,
        installSafety: stringValue(value.installSafety || 'guarded_apply')
      }, value.semanticPayload || {})
    };
  }

  function diagnosticsFor(entries) {
    const diagnostics = [];
    ensureArray(entries).forEach((entry) => {
      ensureArray(entry && entry.manualReasons).forEach((reason) => {
        diagnostics.push({
          severity: entry.safeEditEligible ? 'info' : 'warning',
          code: 'route_guided_edit.' + stringValue(reason || 'manual_boundary'),
          message: stringValue(entry.label) + ': ' + stringValue(reason),
          source: sourceRef(entry.source || {})
        });
      });
    });
    return diagnostics;
  }

  function projectIndexFor(body, opts) {
    return isObject(opts.projectIndex) ? opts.projectIndex : isObject(body.projectIndex) ? body.projectIndex : {};
  }

  function profileEvidenceRows(body, opts, index) {
    const semantic = isObject(index && index.semantic) ? index.semantic : {};
    const parserEvidence = isObject(semantic.parserEvidence) ? semantic.parserEvidence : {};
    const direct = ensureArray(opts.profileEvidence || body.profileEvidence);
    const parser = ensureArray(parserEvidence.profiles || parserEvidence.core && parserEvidence.core.profiles);
    return direct.concat(parser);
  }

  function routeOrderGroupsFor(body, opts, index) {
    if (Array.isArray(opts.routeOrderGroups)) {
      return opts.routeOrderGroups;
    }
    const semantic = isObject(index && index.semantic) ? index.semantic : {};
    const parser = isObject(semantic.parserEvidence) ? semantic.parserEvidence : {};
    const core = isObject(parser.core) ? parser.core : parser;
    return ensureArray(core.routeOrderGroups || parser.routeOrderGroups || body.routeOrderGroups);
  }

  function protectedRouterSceneSet(profiles) {
    const set = new Set();
    ensureArray(profiles).forEach((profile) => {
      ensureArray(profile && profile.protectedRouterScenes).forEach((row) => {
        const id = cleanTarget(isObject(row) ? row.sceneId || row.id : row);
        if (id) set.add(id);
      });
      ensureArray(profile && profile.packages).forEach((pkg) => {
        ensureArray(pkg && pkg.protectedRouterScenes).forEach((row) => {
          const id = cleanTarget(isObject(row) ? row.sceneId || row.id : row);
          if (id) set.add(id);
        });
      });
    });
    return set;
  }

  function profileRouteHelperTables(context) {
    const rows = [];
    const seen = new Set();
    ensureArray(context.profiles).forEach((profile) => {
      ensureArray(profile && profile.routeHelperTables).forEach((table) => {
        const key = [table && (table.routeVar || table.quality || table.variable), table && table.source && table.source.path, table && table.source && table.source.line].map(stringValue).join('|');
        if (!seen.has(key)) {
          seen.add(key);
          rows.push(table);
        }
      });
      ensureArray(profile && profile.packages).forEach((pkg) => {
        ensureArray(pkg && pkg.routeHelperTables).forEach((table) => {
          const key = [table && (table.routeVar || table.quality || table.variable), table && table.source && table.source.path, table && table.source && table.source.line].map(stringValue).join('|');
          if (!seen.has(key)) {
            seen.add(key);
            rows.push(table);
          }
        });
      });
    });
    return rows;
  }

  function routeEvidenceDynamicRefs(routes) {
    return ensureArray(routes).filter((route) => {
      const binding = route && route.dynamicBinding || {};
      return binding && (binding.kind === 'go_to_ref' || binding.kind === 'profile_route_table' || route.targetSource === 'quality');
    });
  }

  function routeTableRowLabel(shape, index, write) {
    if (shape === 'ternary_literal') {
      return index === 0 ? 'When true' : 'When false';
    }
    if (shape === 'finite_object_map') {
      return index === 0 && write && write.selector ? 'Map entry for ' + write.selector : 'Map entry ' + (index + 1);
    }
    if (shape === 'if_else_literal') {
      return index === 0 ? 'if branch' : 'else branch';
    }
    return 'Target ' + (index + 1);
  }

  function routeLineText(prefix, target) {
    return prefix + ': ' + cleanTarget(target);
  }

  function sourceWithAnchor(source, fallbackText) {
    const ref = sourceRef(source || {});
    if (!ref.anchorText && fallbackText) {
      ref.anchorText = stringValue(fallbackText);
      ref.endAnchorText = ref.anchorText;
    }
    if (!ref.excerpt && fallbackText) {
      ref.excerpt = stringValue(fallbackText);
    }
    return ref;
  }

  function hasExactSource(source) {
    const ref = sourceRef(source || {});
    return Boolean(ref.path && (ref.line || ref.startLine) && (ref.anchorText || ref.endAnchorText));
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    const line = numberOrNull(value.line || value.startLine);
    const endLine = numberOrNull(value.endLine || value.line || value.startLine);
    return {
      path: normalizePath(value.path || value.sourcePath || ''),
      line,
      startLine: line,
      endLine,
      anchorText: stringValue(value.anchorText || ''),
      endAnchorText: stringValue(value.endAnchorText || ''),
      excerpt: stringValue(value.excerpt || value.rawPreview || '')
    };
  }

  function isProtectedSource(path) {
    const rel = normalizePath(path);
    return rel === 'source/scenes/root.scene.dry' ||
      rel === 'source/scenes/post_event.scene.dry' ||
      rel === 'source/scenes/post_event_news.scene.dry' ||
      rel === 'source/info.dry' ||
      rel.startsWith('source/scenes/post_event') ||
      rel.startsWith('source/scenes/root');
  }

  function isSimpleTarget(value) {
    return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(cleanTarget(value));
  }

  function cleanTarget(value) {
    return stringValue(value).replace(/^[@#]/, '').trim();
  }

  function cleanVariable(value) {
    return stringValue(value).replace(/^Q\./, '').trim();
  }

  function normalizePath(path) {
    return stringValue(path).replace(/\\/g, '/').replace(/^\.\//, '').trim();
  }

  function safeId(value) {
    const text = stringValue(value).replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    return (text || 'route_guided_edit').slice(0, 96);
  }

  function uniqueEntries(entries) {
    const seen = new Set();
    return ensureArray(entries).filter((entry) => {
      const key = stringValue(entry && entry.id);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function uniqueStrings(values) {
    const seen = new Set();
    const out = [];
    ensureArray(values).forEach((value) => {
      const text = stringValue(value).trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      out.push(text);
    });
    return out;
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? Math.floor(num) : null;
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

  const api = {
    MODEL_VERSION,
    GUIDED_KINDS,
    buildRouteGuidedEditModel,
    build: buildRouteGuidedEditModel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapRouteGuidedEditModel = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
