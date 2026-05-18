// @ts-check
(function initProjectMapDynamicSemanticWorkbench(global) {
  'use strict';

  const MODEL_VERSION = '0.1';
  const MODEL_KIND = 'dynamic_semantic_workbench';

  /**
   * @typedef {import('../types/project_map_contracts').ConditionState} ConditionState
   * @typedef {import('../types/project_map_contracts').DynamicSemanticWorkbenchModel} DynamicSemanticWorkbenchModel
   * @typedef {import('../types/project_map_contracts').ProjectIndex} ProjectIndex
   * @typedef {import('../types/project_map_contracts').RouteState} RouteState
   * @typedef {import('../types/project_map_contracts').RouteStateSummary} RouteStateSummary
   */

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function graphApi() {
    if (global && global.ProjectMapSemanticOwnershipGraph) {
      return global.ProjectMapSemanticOwnershipGraph;
    }
    if (typeof require === 'function') {
      try {
        return require('./semantic_ownership_graph_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function eventWorkbenchApi() {
    if (global && global.ProjectMapEventWorkbench) {
      return global.ProjectMapEventWorkbench;
    }
    if (typeof require === 'function') {
      try {
        return require('./event_workbench_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function confidenceApi() {
    if (global && global.ProjectMapParserRendererConfidence) {
      return global.ProjectMapParserRendererConfidence;
    }
    if (typeof require === 'function') {
      try {
        return require('./parser_renderer_confidence_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  /**
   * @param {ProjectIndex|unknown} projectIndex
   * @param {Record<string, unknown>=} options
   * @returns {DynamicSemanticWorkbenchModel}
   */
  function buildDynamicSemanticWorkbench(projectIndex, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    const sampleLimit = positiveInteger(opts.sampleLimit, 6);
    const graphModelApi = graphApi();
    const graph = graphModelApi && typeof graphModelApi.buildSemanticOwnershipGraph === 'function'
      ? graphModelApi.buildSemanticOwnershipGraph(index, opts)
      : emptyGraph(index);
    const lookup = graphModelApi && typeof graphModelApi.buildLookup === 'function'
      ? graphModelApi.buildLookup(index)
      : buildLookup(index);
    const confidence = buildConfidence(index, opts);
    const context = {index, opts, sampleLimit, graph, lookup, graphModelApi, confidence};
    const workflows = ensureArray(graph.workflows).map((workflow) => buildWorkflow(workflow, context));
    return {
      schemaVersion: MODEL_VERSION,
      kind: MODEL_KIND,
      project: graph.project || projectSummary(index),
      summary: summarizeWorkbench(workflows, graph.manualBoundaryPackages),
      workflows,
      semanticOwnershipGraph: {
        kind: graph.kind,
        summary: graph.summary,
        rows: graph.rows
      },
      profileEvidence: profileEvidenceSection(lookup),
      manualBoundaryPackages: graph.manualBoundaryPackages || [],
      diagnostics: graph.diagnostics || []
    };
  }

  function buildWorkflow(workflow, context) {
    if (workflow.kind === 'variable') {
      return buildVariableWorkflow(workflow, context);
    }
    if (workflow.kind === 'monthly_popup') {
      return buildMonthlyPopupWorkflow(workflow, context);
    }
    return buildSceneWorkflow(workflow, context);
  }

  function buildMonthlyPopupWorkflow(workflow, context) {
    const sceneId = String(workflow.sceneId || workflow.id || '');
    const sceneWorkflow = buildSceneWorkflow(Object.assign({}, workflow, {kind: 'monthly_popup_content'}), context);
    const popup = context.lookup.popups.find((item) => String(item && (item.id || item.linkedSceneId || item.sceneId) || '') === sceneId ||
      String(item && item.linkedSceneId || '') === sceneId);
    const routerEntry = context.lookup.monthlyPopupRouterTable.find((item) => String(item && item.linkedSceneId || '') === sceneId) || null;
    const ownership = ownershipForWorkflow(context.graph, workflow.id);
    return Object.assign({}, sceneWorkflow, {
      id: workflow.id,
      workflowKind: 'monthly_popup',
      title: popup && (popup.title || popup.headline) || sceneWorkflow.title || sceneId,
      owner: ownership && ownership.owner || sceneWorkflow.owner,
      sourceTrail: ownership && ownership.sourceTrail || sceneWorkflow.sourceTrail,
      sections: Object.assign({}, sceneWorkflow.sections, {
        routes: readySection({
          contentRoute: 'linked_event',
          linkedSceneId: sceneId,
          routerBoundary: routerEntry && routerEntry.router && routerEntry.router.source || popup && popup.router || null,
          routerTableEntry: routerEntry ? compactMonthlyPopupRouterEntry(routerEntry) : null,
          routeClass: ownership && ownership.editorRoute && ownership.editorRoute.routeClass || 'object_workspace',
          installSafety: 'advanced_apply'
        }),
        manualBoundaries: readySection({
          packages: packageSubset(context.graph, ['monthly_popup_router']),
          reasons: ['Protected post-event router behavior requires advanced source apply.']
        }),
        reviewApplyReadiness: readinessSection(ownership, {
          safeToApplyAutomatically: false,
          nextAction: 'Edit linked event content where guarded; use advanced apply for protected router source patches.'
        })
      })
    });
  }

  function buildSceneWorkflow(workflow, context) {
    const scene = context.lookup.scenesById.get(String(workflow.sceneId || workflow.id || '')) || null;
    const ownership = ownershipForWorkflow(context.graph, workflow.id);
    if (!scene) {
      return missingWorkflow(workflow, ownership, 'Scene was not found.');
    }
    const workbench = buildEventWorkbench(context.index, scene.id);
    const diagnostics = diagnosticsForScene(context.lookup, scene);
    const routeDiagnostics = diagnostics.filter((diag) => String(diag && diag.code || '') === 'project_map.conditional_goto');
    const dynamicDiagnostics = diagnostics.filter((diag) => String(diag && diag.code || '') === 'project_map.dynamic_q_opaque');
    const routeGroups = routeOrderGroupsForScene(context.lookup, scene);
    const dynamicKeys = dynamicKeyEvidenceForScene(context.lookup, scene).filter((row) => String(row && row.reviewBoundary || '') === 'manual_review' || row && row.safeExpansion !== true);
    const effectClauses = effectClausesForScene(context.lookup, scene);
    const electionResult = context.lookup.electionResults.find((item) => {
      return String(item && (item.sceneId || item.id) || '') === String(scene.id || '') &&
        (!workflow.chartElementId || String(item && item.chartElementId || '') === String(workflow.chartElementId));
    }) || null;
    return {
      id: workflow.id,
      workflowKind: workflow.kind,
      status: 'ready',
      owner: ownership && ownership.owner || sceneOwner(scene),
      title: String(scene.title || scene.id || ''),
      sourceTrail: ownership && ownership.sourceTrail || [sourceRef(scene.sourceSpan || {path: scene.path})],
      sections: {
        playerText: playerTextSection(workbench, context.sampleLimit),
        routes: routesSection(workbench, routeGroups, routeDiagnostics, context.sampleLimit),
        conditions: conditionsSection(workbench, context.sampleLimit),
        effects: effectsSection(workbench, dynamicKeys, dynamicDiagnostics, effectClauses, context),
        variables: variablesSection(workbench, context),
        runtimeEvidence: runtimeEvidenceSection(electionResult, context.confidence),
        manualBoundaries: manualBoundariesSection(workflow, routeGroups, dynamicKeys, routeDiagnostics, dynamicDiagnostics, electionResult, context),
        reviewApplyReadiness: readinessSection(ownership, {
          safeToApplyAutomatically: false,
          nextAction: ownership && ownership.recommendedNextAction || 'Open the Event Workbench and review source evidence before install.'
        })
      }
    };
  }

  function buildVariableWorkflow(workflow, context) {
    const variableName = String(workflow.variableName || workflow.id || '');
    const ownership = ownershipForWorkflow(context.graph, workflow.id);
    const provenance = context.graphModelApi && typeof context.graphModelApi.buildVariableProvenance === 'function'
      ? context.graphModelApi.buildVariableProvenance(context.index, variableName, {
        lookup: context.lookup,
        sampleLimit: context.sampleLimit
      })
      : null;
    if (!provenance || !provenance.name) {
      return missingWorkflow(workflow, ownership, 'Variable was not found.');
    }
    const sourceScenes = ownerSceneWorkbenches(context.index, context.lookup, provenance.ownerScenes, context.sampleLimit);
    return {
      id: workflow.id,
      workflowKind: 'variable',
      status: 'ready',
      owner: ownership && ownership.owner || {kind: 'variable', id: variableName, title: variableName},
      title: variableName,
      sourceTrail: ownership && ownership.sourceTrail || provenance.sourceTrail,
      sections: {
        playerText: readySection({
          count: 0,
          samples: [],
          note: 'Variable workflow has no direct player text owner; related event owners are listed through consumers.'
        }),
        routes: readySection({
          ownerSceneCount: sourceScenes.length,
          ownerScenes: sourceScenes.map((item) => item.owner),
          routeClass: 'variable_workspace'
        }),
        conditions: readySection({
          readCount: provenance.reads.length,
          reads: provenance.reads.slice(0, context.sampleLimit)
        }),
        effects: readySection({
          writeCount: provenance.writes.length,
          writes: provenance.writes.slice(0, context.sampleLimit),
          provenanceCategories: provenance.categories
        }),
        variables: readySection({
          name: provenance.name,
          categories: provenance.categories,
          readCount: provenance.readCount,
          writeCount: provenance.writeCount,
          definitionCount: provenance.definitionCount,
          ownerScenes: provenance.ownerScenes
        }),
        runtimeEvidence: readySection({
          runtimeStatus: 'source_only',
          fallbackRequired: runtimeFallbackRequired(context.confidence),
          note: 'Variable workflow uses parser/source provenance; Runtime Lens evidence is attached through owner scenes when available.'
        }),
        manualBoundaries: readySection({
          packages: packageSubset(context.graph, ['variable_provenance']),
          reasons: [provenance.reason]
        }),
        reviewApplyReadiness: readinessSection(ownership, {
          safeToApplyAutomatically: provenance.installSafety === 'guarded_apply',
          nextAction: provenance.recommendedNextAction
        })
      }
    };
  }

  function playerTextSection(workbench, sampleLimit) {
    const rows = ensureArray(workbench && workbench.playerText);
    return readySection({
      count: rows.length,
      samples: rows.slice(0, sampleLimit).map((row) => ({
        id: String(row.id || ''),
        role: String(row.role || ''),
        text: String(row.text || '').slice(0, 220),
        source: sourceRef(row.source || {})
      }))
    });
  }

  function routesSection(workbench, routeGroups, routeDiagnostics, sampleLimit) {
    const links = workbench && workbench.links || {};
    const routeState = workbench && workbench.routeState || {};
    const groups = ensureArray(routeGroups);
    const fallbackDiagnostics = ensureArray(routeDiagnostics);
    const sensitiveCount = groups.length || fallbackDiagnostics.length;
    return readySection({
      outgoingCount: ensureArray(links.outgoing).length,
      incomingCount: ensureArray(links.incoming).length,
      routeOrderSensitiveCount: sensitiveCount,
      routeStateSummary: routeState.summary || {},
      routeStates: ensureArray(routeState.states).slice(0, sampleLimit).map(compactRouteState),
      conditionStates: ensureArray(routeState.conditionStates).slice(0, sampleLimit).map(compactConditionState),
      routeOrderGroups: groups.slice(0, sampleLimit).map(compactRouteOrderGroup),
      routeOrderSamples: groups.length
        ? groups.slice(0, sampleLimit).map(compactRouteOrderGroup)
        : fallbackDiagnostics.slice(0, sampleLimit).map(routeOrderSample),
      chainContext: {
        hasFallbackOrChainContext: sensitiveCount > 0 || ensureArray(links.outgoing).length > 0,
        outgoing: ensureArray(links.outgoing).slice(0, sampleLimit).map(compactLink),
        incoming: ensureArray(links.incoming).slice(0, sampleLimit).map(compactLink)
      }
    });
  }

  function compactRouteState(state) {
    return {
      id: String(state && state.id || ''),
      ownerId: String(state && state.ownerId || ''),
      routeField: String(state && state.routeField || ''),
      routeKind: String(state && state.routeKind || ''),
      routePurpose: String(state && state.routePurpose || ''),
      chainContext: String(state && state.chainContext || ''),
      status: String(state && state.status || ''),
      dependencies: ensureArray(state && state.dependencies).slice(0, 8),
      candidateCount: Number(state && state.candidateCount || 0),
      fallbackTarget: state && state.fallbackCandidate ? String(state.fallbackCandidate.resolvedTarget || state.fallbackCandidate.rawTarget || '') : '',
      dynamicTargetCount: Number(state && state.dynamicTargetCount || 0),
      candidates: ensureArray(state && state.candidates).slice(0, 4).map((candidate) => ({
        order: Number(candidate && candidate.order || 0),
        rawTarget: String(candidate && candidate.rawTarget || ''),
        resolvedTarget: String(candidate && candidate.resolvedTarget || candidate && candidate.target || ''),
        predicate: String(candidate && candidate.predicate || ''),
        predicateStatus: String(candidate && candidate.predicateSummary && candidate.predicateSummary.status || ''),
        dependencies: ensureArray(candidate && candidate.predicateSummary && candidate.predicateSummary.dependencies).slice(0, 8),
        isFallback: Boolean(candidate && candidate.isFallback),
        dynamicTarget: Boolean(candidate && candidate.dynamicTarget),
        targetSource: String(candidate && candidate.targetSource || ''),
        targetKind: String(candidate && candidate.targetKind || '')
      }))
    };
  }

  function compactConditionState(state) {
    return {
      id: String(state && state.id || ''),
      ownerId: String(state && state.ownerId || ''),
      conditionKind: String(state && state.conditionKind || ''),
      raw: String(state && state.raw || ''),
      status: String(state && state.status || ''),
      dependencies: ensureArray(state && state.dependencies).slice(0, 8)
    };
  }

  function conditionsSection(workbench, sampleLimit) {
    const rows = ensureArray(workbench && workbench.conditions);
    return readySection({
      count: rows.length,
      samples: rows.slice(0, sampleLimit).map((item) => ({
        kind: String(item.kind || ''),
        label: String(item.label || ''),
        variable: String(item.variable || ''),
        op: String(item.op || ''),
        value: item.value === undefined || item.value === null ? '' : String(item.value),
        raw: String(item.raw || '')
      }))
    });
  }

  function effectsSection(workbench, dynamicKeys, dynamicDiagnostics, effectClauses, context) {
    const rows = ensureArray(workbench && workbench.effects);
    const dynamicRows = ensureArray(dynamicKeys);
    const fallbackDiagnostics = ensureArray(dynamicDiagnostics);
    const clauses = ensureArray(effectClauses);
    const provenance = rows.slice(0, context.sampleLimit).map((effect) => {
      return context.graphModelApi && typeof context.graphModelApi.buildEffectProvenance === 'function'
        ? context.graphModelApi.buildEffectProvenance(effect, {manualReview: true})
        : compactEffect(effect);
    });
    return readySection({
      count: rows.length,
      samples: rows.slice(0, context.sampleLimit).map(compactEffect),
      provenance,
      effectClauses: {
        count: clauses.length,
        guardedCandidateCount: clauses.filter((item) => String(item && item.installSafety || '') === 'guarded_candidate').length,
        manualReviewCount: clauses.filter((item) => String(item && item.installSafety || '') === 'manual_review').length,
        sharedLineGroupCount: uniqueStrings(clauses.map((item) => String(item && item.sharedLineGroupId || ''))).length,
        samples: clauses.slice(0, context.sampleLimit).map(compactEffectClause)
      },
      dynamicQ: {
        count: dynamicRows.length || fallbackDiagnostics.length,
        structuredEvidenceCount: dynamicRows.length,
        classifications: dynamicRows.length
          ? countBy(dynamicRows, (row) => String(row.classification || 'unknown'))
          : countBy(fallbackDiagnostics, (diag) => String(diag.classification || 'unknown')),
        samples: dynamicRows.length
          ? dynamicRows.slice(0, context.sampleLimit).map((row) => dynamicQEvidenceSample(row, workbench, context.sampleLimit))
          : fallbackDiagnostics.slice(0, context.sampleLimit).map((diag) => dynamicQSample(diag, workbench, context.sampleLimit))
      }
    });
  }

  function variablesSection(workbench, context) {
    const rows = ensureArray(workbench && workbench.variables);
    const graphModelApi = context.graphModelApi;
    return readySection({
      count: rows.length,
      samples: rows.slice(0, context.sampleLimit).map((row) => {
        const provenance = graphModelApi && typeof graphModelApi.buildVariableProvenance === 'function'
          ? graphModelApi.buildVariableProvenance(context.index, row.name, {
            lookup: context.lookup,
            sampleLimit: Math.min(4, context.sampleLimit)
          })
          : null;
        return {
          name: String(row.name || ''),
          accesses: ensureArray(row.accesses).map(String),
          readCount: Number(row.readCount || 0),
          writeCount: Number(row.writeCount || 0),
          categories: provenance && provenance.categories || [],
          source: provenance && provenance.source || sourceRef({})
        };
      }),
      provenanceSummary: summarizeCategories(rows, context)
    });
  }

  function runtimeEvidenceSection(electionResult, confidence) {
    const runtime = confidence && confidence.runtimeReadiness || {};
    return readySection({
      runtimeStatus: String(runtime.status || (runtimeFallbackRequired(confidence) ? 'partial' : 'unknown')),
      fallbackRequired: runtimeFallbackRequired(confidence),
      fallbackMode: String(runtime.fallbackMode || ''),
      missingDependencyCount: Number(runtime.missingDependencyCount || 0),
      electionResult: electionResult ? {
        id: String(electionResult.id || ''),
        chartElementId: String(electionResult.chartElementId || ''),
        usesD3Parliament: Boolean(electionResult.usesD3Parliament),
        partyCount: ensureArray(electionResult.parties).length,
        source: sourceRef({path: electionResult.path, line: electionResult.line})
      } : null
    });
  }

  function manualBoundariesSection(workflow, routeGroups, dynamicKeys, routeDiagnostics, dynamicDiagnostics, electionResult, context) {
    const ids = [];
    const routeCount = ensureArray(routeGroups).length || ensureArray(routeDiagnostics).length;
    const dynamicCount = ensureArray(dynamicKeys).length || ensureArray(dynamicDiagnostics).length;
    if (workflow.kind === 'route_order' || routeCount) {
      ids.push('route_order');
    }
    if (workflow.kind === 'dynamic_q' || dynamicCount) {
      ids.push('dynamic_q');
    }
    if (workflow.kind === 'election_d3' || electionResult) {
      ids.push('protected_output');
    }
    return readySection({
      packages: packageSubset(context.graph, ids),
      routeOrderSensitiveCount: routeCount,
      dynamicQCount: dynamicCount,
      hasElectionRuntimeBoundary: Boolean(electionResult)
    });
  }

  function readinessSection(ownership, fallback) {
    const owner = isObject(ownership) ? ownership : {};
    const route = isObject(owner.editorRoute) ? owner.editorRoute : {};
    const installSafety = String(owner.installSafety || 'manual_review');
    return readySection({
      routeClass: String(route.routeClass || ''),
      installSafety,
      safeToApplyAutomatically: fallback.safeToApplyAutomatically === undefined
        ? installSafety === 'guarded_apply' || installSafety === 'safe_apply'
        : Boolean(fallback.safeToApplyAutomatically),
      reviewEvidence: owner.reviewEvidence || {},
      nextAction: String(fallback.nextAction || owner.recommendedNextAction || '')
    });
  }

  function readySection(payload) {
    return Object.assign({status: 'ready'}, isObject(payload) ? payload : {});
  }

  function missingWorkflow(workflow, ownership, reason) {
    return {
      id: String(workflow && workflow.id || ''),
      workflowKind: String(workflow && workflow.kind || ''),
      status: 'missing',
      owner: ownership && ownership.owner || {},
      title: String(workflow && (workflow.sceneId || workflow.variableName || workflow.id) || ''),
      sourceTrail: ownership && ownership.sourceTrail || [],
      sections: {
        playerText: readySection({count: 0, samples: []}),
        routes: readySection({outgoingCount: 0, incomingCount: 0, routeOrderSensitiveCount: 0}),
        conditions: readySection({count: 0, samples: []}),
        effects: readySection({count: 0, samples: [], dynamicQ: {count: 0, samples: []}}),
        variables: readySection({count: 0, samples: []}),
        runtimeEvidence: readySection({runtimeStatus: 'unknown', fallbackRequired: false}),
        manualBoundaries: readySection({packages: [], reasons: [reason]}),
        reviewApplyReadiness: readySection({installSafety: 'manual_review', safeToApplyAutomatically: false, nextAction: reason})
      }
    };
  }

  function routeOrderSample(diag) {
    const parsed = parseRouteOrderMessage(diag && diag.message);
    return {
      source: sourceRef(diag && diag.source || {path: diag && diag.path}),
      message: String(diag && diag.message || ''),
      routes: parsed
    };
  }

  function compactRouteOrderGroup(group) {
    return {
      id: String(group && group.id || ''),
      sceneId: String(group && group.sceneId || ''),
      ownerId: String(group && group.ownerId || ''),
      routeField: String(group && group.routeField || ''),
      chainContext: String(group && group.chainContext || ''),
      source: sourceRef(group && group.source || {}),
      parserBacked: group && group.parserBacked !== false,
      routes: ensureArray(group && group.clauses).map((clause) => ({
        order: Number(clause && clause.order || 0),
        target: String(clause && (clause.rawTarget || clause.resolvedTarget) || ''),
        rawTarget: String(clause && clause.rawTarget || ''),
        resolvedTarget: String(clause && clause.resolvedTarget || ''),
        targetResolved: Boolean(clause && clause.targetResolved),
        predicate: String(clause && clause.predicate || ''),
        fallbackOrChainContext: clause && clause.isFallback ? 'fallback' : String(group && group.chainContext || ''),
        isFallback: Boolean(clause && clause.isFallback)
      }))
    };
  }

  function parseRouteOrderMessage(message) {
    const text = String(message || '');
    const body = text.indexOf(':') >= 0 ? text.slice(text.indexOf(':') + 1) : text;
    return body.split(';').map((part) => {
      const trimmed = part.trim();
      if (!trimmed) {
        return null;
      }
      const match = trimmed.match(/^(.+?)\s+if\s+(.+)$/i);
      return {
        target: match ? match[1].trim() : trimmed,
        predicate: match ? match[2].trim() : '',
        fallbackOrChainContext: body.indexOf(';') >= 0 ? 'ordered_chain' : 'single_route'
      };
    }).filter(Boolean);
  }

  function dynamicQSample(diag, workbench, sampleLimit) {
    const expression = String(diag && diag.expression || dynamicExpressionFromMessage(diag && diag.message));
    const suffix = dynamicSuffix(expression);
    const variables = ensureArray(workbench && workbench.variables);
    const effects = ensureArray(workbench && workbench.effects);
    return {
      expression,
      classification: String(diag && diag.classification || 'unknown'),
      reviewBoundary: String(diag && diag.reviewBoundary || 'manual_review'),
      safeExpansion: diag && diag.safeExpansion === true,
      source: sourceRef(diag && diag.source || {path: diag && diag.path}),
      affectedVariables: suffix
        ? variables.filter((item) => String(item.name || '').endsWith(suffix)).slice(0, sampleLimit).map((item) => item.name)
        : variables.filter((item) => expression.indexOf(String(item.name || '')) >= 0).slice(0, sampleLimit).map((item) => item.name),
      affectedEffects: effects.filter((effect) => {
        const line = Number(effect && effect.source && (effect.source.line || effect.source.startLine)) || 0;
        const diagLine = Number(diag && diag.source && (diag.source.line || diag.source.startLine)) || 0;
        return diagLine && Math.abs(line - diagLine) <= 1;
      }).slice(0, sampleLimit).map(compactEffect)
    };
  }

  function dynamicQEvidenceSample(row, workbench, sampleLimit) {
    const expression = String(row && row.expression || '');
    const suffix = dynamicSuffix(expression);
    const variables = ensureArray(workbench && workbench.variables);
    const effects = ensureArray(workbench && workbench.effects);
    const expandedKeys = ensureArray(row && row.expandedKeys).map(String);
    return {
      id: String(row && row.id || ''),
      expression,
      accessKind: String(row && row.accessKind || ''),
      classification: String(row && row.classification || 'unknown'),
      reviewBoundary: String(row && row.reviewBoundary || 'manual_review'),
      safeExpansion: row && row.safeExpansion === true,
      expandedKeyCount: Number(row && row.expandedKeyCount || expandedKeys.length || 0),
      expandedKeys: expandedKeys.slice(0, sampleLimit),
      bindingSources: ensureArray(row && row.bindingSources).slice(0, sampleLimit).map((item) => ({
        name: String(item && item.name || ''),
        kind: String(item && item.kind || ''),
        valueCount: Number(item && item.valueCount || 0)
      })),
      source: sourceRef(row && row.source || {}),
      affectedVariables: expandedKeys.length
        ? expandedKeys.slice(0, sampleLimit)
        : suffix
          ? variables.filter((item) => String(item.name || '').endsWith(suffix)).slice(0, sampleLimit).map((item) => item.name)
          : variables.filter((item) => expression.indexOf(String(item.name || '')) >= 0).slice(0, sampleLimit).map((item) => item.name),
      affectedEffects: effects.filter((effect) => {
        const line = Number(effect && effect.source && (effect.source.line || effect.source.startLine)) || 0;
        const rowLine = Number(row && row.source && (row.source.line || row.source.startLine)) || 0;
        return rowLine && Math.abs(line - rowLine) <= 1;
      }).slice(0, sampleLimit).map(compactEffect)
    };
  }

  function dynamicExpressionFromMessage(message) {
    const match = String(message || '').match(/Q\[(.*)\]/);
    return match ? match[1].trim() : '';
  }

  function dynamicSuffix(expression) {
    const match = String(expression || '').match(/\+\s*['"]([^'"]+)['"]/);
    return match ? match[1] : '';
  }

  function compactEffect(effect) {
    return {
      variable: String(effect && effect.variable || ''),
      op: String(effect && effect.op || ''),
      value: effect && effect.value === undefined || effect && effect.value === null ? '' : String(effect && effect.value || ''),
      source: sourceRef(effect && effect.source || {}),
      sectionId: String(effect && effect.sectionId || ''),
      evidence: String(effect && effect.evidence || '')
    };
  }

  function compactEffectClause(clause) {
    return {
      id: String(clause && clause.id || ''),
      sceneId: String(clause && clause.sceneId || ''),
      ownerId: String(clause && clause.ownerId || ''),
      variable: String(clause && clause.variable || ''),
      op: String(clause && clause.op || ''),
      value: clause && clause.value === undefined || clause && clause.value === null ? '' : String(clause && clause.value || ''),
      condition: String(clause && clause.condition || ''),
      hook: String(clause && clause.hook || ''),
      sourceExpression: String(clause && clause.sourceExpression || ''),
      clauseOrder: Number(clause && clause.clauseOrder || 0),
      lineEffectCount: Number(clause && clause.lineEffectCount || 0),
      sharedLineGroupId: String(clause && clause.sharedLineGroupId || ''),
      tokenUniqueOnLine: Boolean(clause && clause.tokenUniqueOnLine),
      installSafety: String(clause && clause.installSafety || ''),
      source: sourceRef(clause && clause.source || {})
    };
  }

  function compactMonthlyPopupRouterEntry(row) {
    return {
      id: String(row && row.id || ''),
      linkedSceneId: String(row && row.linkedSceneId || ''),
      title: String(row && row.title || ''),
      viewIf: String(row && row.viewIf || ''),
      router: sourceRef(row && row.router && row.router.source || {}),
      contentSource: sourceRef(row && row.contentSource || {}),
      installSafety: String(row && row.installSafety || ''),
      reviewBoundary: String(row && row.reviewBoundary || '')
    };
  }

  function compactLink(link) {
    return {
      from: String(link && link.from || ''),
      to: String(link && link.to || ''),
      kind: String(link && link.kind || ''),
      label: String(link && link.label || ''),
      source: sourceRef(link && link.source || {})
    };
  }

  function ownerSceneWorkbenches(index, lookup, ownerScenes, limit) {
    return ensureArray(ownerScenes).slice(0, limit).map((owner) => {
      const scene = lookup.scenesById.get(String(owner && owner.id || '')) || null;
      return {
        owner,
        summary: scene ? buildEventWorkbench(index, scene.id).summary || {} : {}
      };
    });
  }

  function summarizeCategories(rows, context) {
    const counts = {};
    const graphModelApi = context.graphModelApi;
    ensureArray(rows).forEach((row) => {
      const provenance = graphModelApi && typeof graphModelApi.buildVariableProvenance === 'function'
        ? graphModelApi.buildVariableProvenance(context.index, row.name, {
          lookup: context.lookup,
          sampleLimit: 1
        })
        : null;
      ensureArray(provenance && provenance.categories).forEach((category) => {
        counts[category] = (counts[category] || 0) + 1;
      });
    });
    return counts;
  }

  function ownershipForWorkflow(graph, workflowId) {
    return ensureArray(graph && graph.rows).find((row) => String(row.workflowId || '') === String(workflowId || '')) || null;
  }

  function packageSubset(graph, ids) {
    const wanted = new Set(ensureArray(ids).map(String));
    return ensureArray(graph && graph.manualBoundaryPackages)
      .filter((item) => wanted.has(String(item.id || '')))
      .map((item) => ({
        id: item.id,
        label: item.label,
        rowCount: item.rowCount,
        ownerCount: item.ownerCount,
        installSafety: item.installSafety,
        reason: item.reason,
        recommendedNextAction: item.recommendedNextAction
      }));
  }

  function profileEvidenceSection(lookup) {
    const profiles = ensureArray(lookup && lookup.profileEvidence).map((profile) => ({
      profileId: String(profile && profile.profileId || ''),
      profileName: String(profile && profile.profileName || ''),
      packageCount: ensureArray(profile && profile.packages).length,
      routerTableCount: ensureArray(profile && profile.routerTables).length,
      protectedBoundaryCount: ensureArray(profile && profile.protectedBoundaries).length,
      variableSystemCount: ensureArray(profile && profile.variableSystems).length,
      packages: ensureArray(profile && profile.packages).map((item) => ({
        id: String(item && item.id || ''),
        kind: String(item && item.kind || ''),
        label: String(item && item.label || item && item.id || ''),
        rowCount: Number(item && item.rowCount || 0),
        installSafety: String(item && item.installSafety || ''),
        reason: String(item && item.reason || ''),
        recommendedNextAction: String(item && item.recommendedNextAction || '')
      }))
    }));
    return {
      profiles,
      profileCount: profiles.length,
      packageCount: profiles.reduce((sum, profile) => sum + profile.packageCount, 0),
      routerTableCount: profiles.reduce((sum, profile) => sum + profile.routerTableCount, 0)
    };
  }

  function buildEventWorkbench(index, sceneId) {
    const api = eventWorkbenchApi();
    if (!api || typeof api.buildEventWorkbench !== 'function') {
      return {playerText: [], options: [], conditions: [], effects: [], variables: [], links: {outgoing: [], incoming: []}, diagnostics: [], summary: {}};
    }
    try {
      return api.buildEventWorkbench(index, sceneId, {});
    } catch (_err) {
      return {playerText: [], options: [], conditions: [], effects: [], variables: [], links: {outgoing: [], incoming: []}, diagnostics: [], summary: {}};
    }
  }

  function buildConfidence(index, options) {
    if (options && options.confidence) {
      return options.confidence;
    }
    const api = confidenceApi();
    if (!api || typeof api.buildConfidenceReport !== 'function') {
      return {};
    }
    try {
      return api.buildConfidenceReport(index, {sampleLimit: positiveInteger(options && options.sampleLimit, 6)});
    } catch (_err) {
      return {};
    }
  }

  function diagnosticsForScene(lookup, scene) {
    const id = String(scene && scene.id || '');
    const path = normalizePath(scene && (scene.path || scene.sourceSpan && scene.sourceSpan.path || scene.topLevelSpan && scene.topLevelSpan.path));
    return ensureArray(lookup.diagnostics).filter((diag) => {
      const diagPath = normalizePath(diag && (diag.path || diag.source && diag.source.path));
      return String(diag && diag.sceneId || '') === id || diagPath === path;
    });
  }

  function routeOrderGroupsForScene(lookup, scene) {
    const id = String(scene && scene.id || '');
    const path = normalizePath(scene && (scene.path || scene.sourceSpan && scene.sourceSpan.path || scene.topLevelSpan && scene.topLevelSpan.path));
    return ensureArray(lookup && lookup.routeOrderGroups).filter((group) => {
      const groupPath = normalizePath(group && group.source && group.source.path);
      return String(group && group.sceneId || '') === id || groupPath === path;
    });
  }

  function dynamicKeyEvidenceForScene(lookup, scene) {
    const path = normalizePath(scene && (scene.path || scene.sourceSpan && scene.sourceSpan.path || scene.topLevelSpan && scene.topLevelSpan.path));
    return ensureArray(lookup && lookup.dynamicKeyEvidence).filter((row) => {
      return normalizePath(row && row.source && row.source.path) === path;
    });
  }

  function effectClausesForScene(lookup, scene) {
    const id = String(scene && scene.id || '');
    const path = normalizePath(scene && (scene.path || scene.sourceSpan && scene.sourceSpan.path || scene.topLevelSpan && scene.topLevelSpan.path));
    return ensureArray(lookup && lookup.effectClauses).filter((row) => {
      const rowPath = normalizePath(row && row.source && row.source.path);
      return String(row && row.sceneId || '') === id || rowPath === path;
    });
  }

  function parserEvidenceCore(parserEvidence) {
    return isObject(parserEvidence && parserEvidence.core) ? parserEvidence.core : (isObject(parserEvidence) ? parserEvidence : {});
  }

  function parserEvidenceRows(parserEvidence, key) {
    const coreRows = ensureArray(parserEvidenceCore(parserEvidence)[key]);
    return coreRows.length ? coreRows : ensureArray(parserEvidence && parserEvidence[key]);
  }

  function profileEvidenceRows(parserEvidence) {
    return ensureArray(parserEvidence && parserEvidence.profiles);
  }

  function flattenProfileRouterRows(profiles, compatAlias) {
    const out = [];
    ensureArray(profiles).forEach((profile) => {
      const packages = new Map(ensureArray(profile && profile.packages).map((item) => [String(item && item.id || ''), item || {}]));
      ensureArray(profile && profile.routerTables).forEach((table) => {
        const packageRow = packages.get(String(table && table.packageId || '')) || {};
        const alias = String(table && table.compatAlias || packageRow.compatAlias || '');
        if (compatAlias && alias !== compatAlias) {
          return;
        }
        ensureArray(table && table.rows).forEach((row) => {
          out.push(Object.assign({
            profileId: String(profile && profile.profileId || ''),
            packageId: String(table && table.packageId || ''),
            routerTableId: String(table && table.id || ''),
            compatAlias: alias
          }, isObject(row) ? row : {}));
        });
      });
    });
    return out;
  }

  function buildLookup(index) {
    const semantic = isObject(index.semantic) ? index.semantic : {};
    const news = isObject(semantic.news) ? semantic.news : {};
    const parserEvidence = isObject(semantic.parserEvidence) ? semantic.parserEvidence : {};
    const profileEvidence = profileEvidenceRows(parserEvidence);
    const monthlyPopupRouterTable = flattenProfileRouterRows(profileEvidence, 'monthlyPopupRouterTable');
    const scenes = ensureArray(index.scenes);
    const scenesById = new Map();
    const scenesByPath = new Map();
    scenes.forEach((scene) => {
      if (scene && scene.id) {
        scenesById.set(String(scene.id), scene);
      }
      const path = normalizePath(scene && (scene.path || scene.sourceSpan && scene.sourceSpan.path || scene.topLevelSpan && scene.topLevelSpan.path));
      if (path) {
        scenesByPath.set(path, scene);
      }
    });
    return {
      scenesById,
      scenesByPath,
      diagnostics: ensureArray(index.diagnostics),
      parserEvidence,
      profileEvidence,
      routeOrderGroups: parserEvidenceRows(parserEvidence, 'routeOrderGroups'),
      dynamicKeyEvidence: parserEvidenceRows(parserEvidence, 'dynamicKeyEvidence'),
      effectClauses: parserEvidenceRows(parserEvidence, 'effectClauses'),
      monthlyPopupRouterTable: monthlyPopupRouterTable.length ? monthlyPopupRouterTable : ensureArray(parserEvidence.monthlyPopupRouterTable),
      popups: ensureArray(news.eventPopups),
      electionResults: ensureArray(semantic.electionResults && semantic.electionResults.items)
    };
  }

  function emptyGraph(index) {
    return {
      kind: 'semantic_ownership_graph',
      project: projectSummary(index),
      workflows: [],
      rows: [],
      summary: {},
      manualBoundaryPackages: [],
      diagnostics: []
    };
  }

  function summarizeWorkbench(workflows, packages) {
    const rows = ensureArray(workflows);
    return {
      workflowCount: rows.length,
      readyWorkflowCount: rows.filter((item) => item.status === 'ready').length,
      missingWorkflowCount: rows.filter((item) => item.status === 'missing').length,
      manualPackageCount: ensureArray(packages).length,
      activeManualPackageCount: ensureArray(packages).filter((item) => item.status === 'active').length,
      byWorkflowKind: countBy(rows, (item) => item.workflowKind)
    };
  }

  function sceneOwner(scene) {
    return {
      kind: String(scene && scene.type || 'event'),
      id: String(scene && scene.id || ''),
      title: String(scene && (scene.title || scene.id) || ''),
      path: normalizePath(scene && (scene.path || scene.sourceSpan && scene.sourceSpan.path))
    };
  }

  function runtimeFallbackRequired(confidence) {
    const runtime = confidence && confidence.runtimeReadiness || {};
    return runtime.fallbackRequired === true || Number(runtime.missingDependencyCount || 0) > 0;
  }

  function projectSummary(index) {
    const project = isObject(index.project) ? index.project : {};
    return {
      name: String(project.name || project.title || ''),
      root: String(project.root || ''),
      profileIds: ensureArray(project.profileIds).map(String)
    };
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
      anchorText: String(value.anchorText || '').trim()
    };
  }

  function normalizePath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function positiveInteger(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : fallback;
  }

  function countBy(items, keyFn) {
    return ensureArray(items).reduce((counts, item) => {
      const key = String(typeof keyFn === 'function' ? keyFn(item) : item && item[keyFn] || 'unknown');
      counts[key || 'unknown'] = (counts[key || 'unknown'] || 0) + 1;
      return counts;
    }, {});
  }

  function uniqueStrings(values) {
    const seen = new Set();
    const out = [];
    ensureArray(values).forEach((value) => {
      const text = String(value || '');
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      out.push(text);
    });
    return out;
  }

  const api = {
    MODEL_VERSION,
    buildDynamicSemanticWorkbench,
    build: buildDynamicSemanticWorkbench
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapDynamicSemanticWorkbench = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
