(function initProjectMapSemanticOwnershipGraph(global) {
  'use strict';

  const MODEL_VERSION = '0.1';
  const MODEL_KIND = 'semantic_ownership_graph';
  const PROTECTED_ROUTER_PATHS = new Set([
    'source/scenes/root.scene.dry',
    'source/scenes/post_event.scene.dry',
    'source/scenes/post_event_news.scene.dry'
  ]);
  const DEFAULT_WORKFLOWS = [
    {id: 'monthly_popup_1929', kind: 'monthly_popup', sceneId: '1929'},
    {id: 'route_order_presidential_1932', kind: 'route_order', sceneId: 'presidential_election_1932_campaign'},
    {id: 'dynamic_q_hindenburg_president', kind: 'dynamic_q', sceneId: 'death_of_hindenburg_president'},
    {id: 'election_d3_local_france', kind: 'election_d3', sceneId: 'local_election_france', chartElementId: 'france_chamber'},
    {id: 'variable_abortion_rights', kind: 'variable', variableName: 'abortion_rights'}
  ];

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function visibleCoverageApi() {
    if (global && global.ProjectMapVisibleObjectCoverage) {
      return global.ProjectMapVisibleObjectCoverage;
    }
    if (typeof require === 'function') {
      try {
        return require('./visible_object_coverage_model.js');
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

  function buildSemanticOwnershipGraph(projectIndex, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    const sampleLimit = positiveInteger(opts.sampleLimit, 8);
    const workflows = normalizeWorkflowSpecs(opts.workflows || DEFAULT_WORKFLOWS);
    const lookup = buildLookup(index);
    const coverage = buildCoverage(index, opts);
    const confidence = buildConfidence(index, opts);
    const context = {index, lookup, coverage, confidence, sampleLimit};
    const rows = [];
    const diagnostics = [];

    workflows.forEach((workflow) => {
      const before = rows.length;
      if (workflow.kind === 'monthly_popup') {
        appendMonthlyPopupRows(rows, workflow, context);
      } else if (workflow.kind === 'variable') {
        appendVariableRows(rows, workflow, context);
      } else {
        appendSceneRows(rows, workflow, context);
      }
      if (rows.length === before) {
        diagnostics.push(diagnostic('warning', 'semantic_ownership.workflow_missing', 'No semantic owner row could be built for workflow ' + workflow.id, {
          workflowId: workflow.id,
          sceneId: workflow.sceneId || '',
          variableName: workflow.variableName || ''
        }));
      }
    });

    const manualBoundaryPackages = buildManualBoundaryPackages(index, {
      lookup,
      coverage,
      confidence,
      sampleLimit
    });
    return {
      schemaVersion: MODEL_VERSION,
      kind: MODEL_KIND,
      project: projectSummary(index),
      workflows,
      rows,
      summary: summarizeGraph(rows, manualBoundaryPackages),
      manualBoundaryPackages,
      diagnostics
    };
  }

  function normalizeWorkflowSpecs(workflows) {
    return ensureArray(workflows).map((item) => {
      const value = isObject(item) ? item : {id: String(item || ''), sceneId: String(item || '')};
      const kind = String(value.kind || (value.variableName ? 'variable' : 'event')).trim();
      const sceneId = String(value.sceneId || value.id || '').trim();
      const variableName = String(value.variableName || '').trim();
      const id = String(value.id || variableName || sceneId || kind).trim();
      return {
        id,
        kind,
        sceneId,
        variableName,
        chartElementId: String(value.chartElementId || '').trim()
      };
    }).filter((item) => item.id);
  }

  function appendMonthlyPopupRows(rows, workflow, context) {
    const lookup = context.lookup;
    const sceneId = String(workflow.sceneId || workflow.id || '');
    const popup = lookup.popups.find((item) => {
      return String(item && (item.id || item.linkedSceneId || item.sceneId) || '') === sceneId ||
        String(item && item.linkedSceneId || '') === sceneId ||
        String(item && item.sceneId || '') === sceneId;
    });
    const scene = lookup.scenesById.get(sceneId) || null;
    if (!popup && !scene) {
      return;
    }
    const routerEntry = lookup.monthlyPopupRouterTable.find((item) => {
      return String(item && item.linkedSceneId || '') === sceneId;
    }) || null;
    const routerSource = sourceRef(popup && popup.router || {});
    const contentSource = sourceRef(popup && (popup.excerptSource || popup.source) || sceneSource(scene));
    const coverageRow = findCoverageRow(context.coverage, (row) => {
      return row.objectType === 'monthly_popup' &&
        (String(row.id || '').endsWith(':' + sceneId) || String(row.target && row.target.sceneId || '') === sceneId || String(row.label || '') === sceneId);
    });
    rows.push(ownershipRow({
      workflowId: workflow.id,
      workflowKind: workflow.kind,
      source: contentSource,
      sourceTrail: uniqueSources([contentSource, routerSource, sceneSource(scene)]),
      owner: {
        kind: 'monthly_popup',
        id: sceneId,
        title: String(popup && (popup.title || popup.headline) || scene && (scene.title || scene.id) || sceneId),
        linkedSceneId: sceneId,
        delivery: String(popup && popup.delivery || 'legacy_event_popup')
      },
      semanticRole: 'monthly_popup_router_package',
      editorRoute: {
        surface: 'Event Workbench',
        routeClass: 'object_workspace',
        view: 'events',
        targetId: sceneId,
        entrypoints: ['event_workbench', 'object_canvas']
      },
      installSafety: 'advanced_apply',
      reviewEvidence: {
        reason: 'Monthly popup content is source-backed through the linked event; protected post-event router edits use advanced apply.',
        manualBoundaryPackageId: 'monthly_popup_router',
        linkedSceneId: sceneId,
        routerTableEntry: routerEntry ? compactMonthlyPopupRouterEntry(routerEntry) : null,
        routerBoundary: routerSource.path ? routerSource : null,
        contentRoute: coverageRow ? coverageRow.routeClass : 'object_workspace',
        routeReason: coverageRow ? coverageRow.reason : ''
      },
      recommendedNextAction: 'Open the linked Event Workbench for content edits; use advanced apply for protected router source patches.'
    }));
  }

  function appendSceneRows(rows, workflow, context) {
    const lookup = context.lookup;
    const scene = lookup.scenesById.get(String(workflow.sceneId || workflow.id || ''));
    if (!scene) {
      return;
    }
    const source = sceneSource(scene);
    const coverageRow = sceneCoverageRow(context.coverage, scene.id);
    const diagnostics = diagnosticsForScene(lookup, scene);
    const routeDiagnostics = diagnostics.filter((diag) => String(diag && diag.code || '') === 'project_map.conditional_goto');
    const dynamicDiagnostics = diagnostics.filter((diag) => String(diag && diag.code || '') === 'project_map.dynamic_q_opaque');
    const routeGroups = routeOrderGroupsForScene(lookup, scene);
    const dynamicKeys = dynamicKeyEvidenceForScene(lookup, scene).filter((row) => String(row && row.reviewBoundary || '') === 'manual_review' || row && row.safeExpansion !== true);
    const election = lookup.electionResults.find((item) => {
      return String(item && (item.sceneId || item.id) || '') === String(scene.id || '') &&
        (!workflow.chartElementId || String(item && item.chartElementId || '') === String(workflow.chartElementId));
    }) || null;
    const role = workflow.kind === 'route_order'
      ? 'route_order_package'
      : workflow.kind === 'dynamic_q'
        ? 'dynamic_q_package'
        : workflow.kind === 'election_d3'
          ? 'election_d3_source'
          : 'event_semantic_owner';
    const manualPackageId = workflow.kind === 'route_order'
      ? 'route_order'
      : workflow.kind === 'dynamic_q'
        ? 'dynamic_q'
        : workflow.kind === 'election_d3'
          ? 'runtime_election_review'
          : 'event_review';
    const installSafety = routeDiagnostics.length || dynamicDiagnostics.length || workflow.kind === 'election_d3'
      ? 'advanced_apply'
      : coverageRow && coverageRow.installSafety || 'manual_review';
    rows.push(ownershipRow({
      workflowId: workflow.id,
      workflowKind: workflow.kind,
      source,
      sourceTrail: uniqueSources([source].concat(
        (routeGroups.length ? routeGroups.map((group) => sourceRef(group.source || {})) : routeDiagnostics.map((diag) => sourceRef(diag.source || {path: diag.path}))),
        (dynamicKeys.length ? dynamicKeys.map((row) => sourceRef(row.source || {})) : dynamicDiagnostics.map((diag) => sourceRef(diag.source || {path: diag.path}))),
        election ? [sourceRef({path: election.path, line: election.line})] : []
      )),
      owner: {
        kind: String(scene.type || 'event'),
        id: String(scene.id || ''),
        title: String(scene.title || scene.id || ''),
        path: source.path
      },
      semanticRole: role,
      editorRoute: {
        surface: workflow.kind === 'election_d3' ? 'Object Canvas + Event Workbench' : 'Event Workbench',
        routeClass: coverageRow && coverageRow.routeClass || 'object_workspace',
        view: scene.type === 'card' ? 'cards' : 'events',
        targetId: String(scene.id || ''),
        entrypoints: workflow.kind === 'election_d3'
          ? ['election_results_canvas', 'event_workbench', 'runtime_lens']
          : ['event_workbench', 'object_canvas']
      },
      installSafety: routeGroups.length || dynamicKeys.length || routeDiagnostics.length || dynamicDiagnostics.length || workflow.kind === 'election_d3'
        ? 'advanced_apply'
        : installSafety,
      reviewEvidence: {
        reason: sceneReviewReason(workflow.kind, routeGroups, dynamicKeys, routeDiagnostics, dynamicDiagnostics, election),
        manualBoundaryPackageId: manualPackageId,
        routeOrderSensitiveCount: routeGroups.length || routeDiagnostics.length,
        routeOrderGroups: routeGroups.slice(0, context.sampleLimit).map(compactRouteOrderGroup),
        dynamicQCount: dynamicKeys.length || dynamicDiagnostics.length,
        dynamicKeyEvidence: dynamicKeys.slice(0, context.sampleLimit).map(compactDynamicKeyEvidence),
        dynamicQClassifications: dynamicKeys.length
          ? countBy(dynamicKeys, (row) => String(row.classification || 'unknown'))
          : countBy(dynamicDiagnostics, (diag) => String(diag.classification || 'unknown')),
        electionResult: election ? {
          id: String(election.id || ''),
          chartElementId: String(election.chartElementId || ''),
          usesD3Parliament: Boolean(election.usesD3Parliament),
          source: sourceRef({path: election.path, line: election.line})
        } : null,
        coverageReason: coverageRow ? coverageRow.reason : ''
      },
      recommendedNextAction: sceneRecommendedNextAction(workflow.kind)
    }));
  }

  function appendVariableRows(rows, workflow, context) {
    const variableName = String(workflow.variableName || workflow.id || '');
    const variable = context.lookup.variablesByName.get(variableName);
    if (!variable) {
      return;
    }
    const provenance = buildVariableProvenance(context.index, variableName, {
      lookup: context.lookup,
      sampleLimit: context.sampleLimit
    });
    rows.push(ownershipRow({
      workflowId: workflow.id,
      workflowKind: workflow.kind,
      source: provenance.source,
      sourceTrail: provenance.sourceTrail,
      owner: {
        kind: 'variable',
        id: variableName,
        title: variableName,
        scope: String(variable.scope || 'q')
      },
      semanticRole: 'variable_effect_provenance',
      editorRoute: {
        surface: 'Variable Workspace',
        routeClass: 'variable_workspace',
        view: 'variables',
        targetId: variableName,
        entrypoints: ['variable_workspace', 'project_state_canvas']
      },
      installSafety: provenance.installSafety,
      reviewEvidence: {
        reason: provenance.reason,
        manualBoundaryPackageId: 'variable_provenance',
        categories: provenance.categories,
        readCount: provenance.readCount,
        writeCount: provenance.writeCount,
        definitionCount: provenance.definitionCount,
        ownerScenes: provenance.ownerScenes
      },
      recommendedNextAction: provenance.recommendedNextAction
    }));
  }

  function buildVariableProvenance(projectIndex, variableOrName, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    const lookup = opts.lookup || buildLookup(index);
    const variable = isObject(variableOrName)
      ? variableOrName
      : lookup.variablesByName.get(String(variableOrName || ''));
    const empty = {
      kind: 'variable_provenance',
      name: String(isObject(variableOrName) ? variableOrName.name || '' : variableOrName || ''),
      categories: ['manual-review'],
      source: sourceRef({}),
      sourceTrail: [],
      reads: [],
      writes: [],
      definitions: [],
      ownerScenes: [],
      readCount: 0,
      writeCount: 0,
      definitionCount: 0,
      installSafety: 'manual_review',
      reason: 'Variable was not found in ProjectIndex.',
      recommendedNextAction: 'Rebuild ProjectIndex and review source manually.'
    };
    if (!variable) {
      return empty;
    }
    const reads = ensureArray(variable.reads).map(sourceRef).filter((item) => item.path);
    const writes = ensureArray(variable.writes).map(sourceRef).filter((item) => item.path);
    const definitions = ensureArray(variable.definedIn).map(sourceRef).filter((item) => item.path);
    const allSources = definitions.concat(writes, reads);
    const categories = variableCategories(variable, lookup);
    const ownerScenes = ownerScenesForSources(lookup, allSources, positiveInteger(opts.sampleLimit, 8));
    const hasExistingConsumers = reads.length || writes.length || definitions.length;
    const installSafety = hasExistingConsumers ? 'advanced_apply' : 'guarded_apply';
    return {
      kind: 'variable_provenance',
      name: String(variable.name || ''),
      scope: String(variable.scope || 'q'),
      categories,
      source: allSources[0] || sourceRef({}),
      sourceTrail: uniqueSources(allSources).slice(0, positiveInteger(opts.sampleLimit, 8)),
      reads,
      writes,
      definitions,
      ownerScenes,
      readCount: Number(variable.readCount || reads.length || 0),
      writeCount: Number(variable.writeCount || writes.length || 0),
      definitionCount: definitions.length,
      installSafety,
      reason: hasExistingConsumers
        ? 'Existing variable has source-backed readers, writers, or definitions; Studio can navigate provenance and use advanced apply with impact preview.'
        : 'No existing consumers were found; a new-variable style workflow can be guarded through the Variable Workspace.',
      recommendedNextAction: hasExistingConsumers
        ? 'Open variable provenance, review affected owner scenes, then use advanced apply for source-backed definition/init edits.'
        : 'Use the Variable Workspace add-new flow with guarded root initialization.'
    };
  }

  function buildEffectProvenance(effect, options) {
    const value = isObject(effect) ? effect : {};
    const opts = isObject(options) ? options : {};
    const source = sourceRef(value.source || {});
    const categories = [];
    if (value.variable) {
      categories.push('write-backed');
    }
    if (isProtectedRouterPath(source.path)) {
      categories.push('router-owned');
    }
    if (opts.dynamicKey) {
      categories.push('dynamic-key');
    }
    if (opts.safeCandidate) {
      categories.push('safe-candidate');
    }
    if (!categories.length || opts.manualReview !== false) {
      categories.push('advanced-review');
    }
    return {
      kind: 'effect_provenance',
      variable: String(value.variable || ''),
      op: String(value.op || ''),
      value: value.value === undefined || value.value === null ? '' : String(value.value),
      source,
      categories: uniqueStrings(categories),
      installSafety: categories.includes('advanced-review') || categories.includes('router-owned') || categories.includes('dynamic-key')
        ? 'advanced_apply'
        : 'guarded_apply',
      reason: categories.includes('dynamic-key')
        ? 'Dynamic-key effect evidence uses proof-first advanced source editing.'
        : categories.includes('router-owned')
          ? 'Router-owned effect evidence uses advanced source apply.'
          : 'Effect is source-backed; guarded operations are used when possible and advanced source apply is available otherwise.'
    };
  }

  function variableCategories(variable, lookup) {
    const reads = ensureArray(variable && variable.reads);
    const writes = ensureArray(variable && variable.writes);
    const definitions = ensureArray(variable && variable.definedIn);
    const sources = definitions.concat(writes, reads).map(sourceRef);
    const categories = [];
    if (definitions.length) {
      categories.push('source-defined');
    }
    if (reads.length && !writes.length) {
      categories.push('read-only');
    }
    if (writes.length) {
      categories.push('write-backed');
    }
    if (sources.some((source) => isProtectedRouterPath(source.path))) {
      categories.push('router-owned');
    }
    if (lookup && variableHasDynamicEvidence(variable, lookup)) {
      categories.push('dynamic-key');
    }
    if (!reads.length && !writes.length && !definitions.length) {
      categories.push('safe-candidate');
    }
    if (reads.length || writes.length || definitions.length || categories.includes('dynamic-key') || categories.includes('router-owned')) {
      categories.push('advanced-review');
    }
    return uniqueStrings(categories.length ? categories : ['advanced-review']);
  }

  function variableHasDynamicEvidence(variable, lookup) {
    const name = String(variable && variable.name || '');
    if (!name) {
      return false;
    }
    if (ensureArray(lookup && lookup.dynamicKeyEvidence).some((row) => {
      return ensureArray(row && row.affectedVariables).map(String).includes(name) ||
        String(row && row.expression || '').indexOf(name) >= 0;
    })) {
      return true;
    }
    return ensureArray(lookup && lookup.diagnostics).some((diag) => {
      if (String(diag && diag.code || '') !== 'project_map.dynamic_q_opaque') {
        return false;
      }
      const expression = String(diag.expression || diag.message || '');
      return expression.indexOf(name) >= 0;
    });
  }

  function buildManualBoundaryPackages(projectIndex, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    const lookup = opts.lookup || buildLookup(index);
    const coverage = opts.coverage || buildCoverage(index, opts);
    const confidence = opts.confidence || buildConfidence(index, opts);
    const sampleLimit = positiveInteger(opts.sampleLimit, 8);
    const rows = ensureArray(coverage && coverage.rows);
    const diagnostics = ensureArray(lookup.diagnostics);
    const routeDiagnostics = diagnostics.filter((diag) => String(diag && diag.code || '') === 'project_map.conditional_goto');
    const dynamicDiagnostics = diagnostics.filter((diag) => String(diag && diag.code || '') === 'project_map.dynamic_q_opaque');
    const routeGroups = ensureArray(lookup.routeOrderGroups);
    const dynamicKeys = ensureArray(lookup.dynamicKeyEvidence).filter((row) => String(row && row.reviewBoundary || '') === 'manual_review' || row && row.safeExpansion !== true);
    const variableRows = rows.filter((row) => row.objectType === 'variable');
    const protectedRows = rows.filter((row) => row.installSafety === 'refused');
    const monthlyPopups = lookup.monthlyPopupRouterTable.length ? lookup.monthlyPopupRouterTable : lookup.popups;
    const profilePackages = buildProfileManualPackages(lookup, sampleLimit);
    const hasProfileMonthlyPackage = profilePackages.some((item) => String(item && item.id || '') === 'monthly_popup_router');
    const packages = [
      packageRow({
        id: 'route_order',
        label: 'Conditional route order package',
        rowCount: routeGroups.length || routeDiagnostics.length,
        ownerCount: uniqueStrings((routeGroups.length ? routeGroups.map((group) => String(group.sceneId || '')) : routeDiagnostics.map((diag) => sceneIdForDiagnostic(lookup, diag)))).filter(Boolean).length,
        installSafety: 'advanced_apply',
        reason: 'Conditional or chained go-to clauses are parser-backed as ordered groups and editable through advanced source patches.',
        recommendedNextAction: 'Review route order as a workflow package, then use advanced apply for source-backed route rewrites.',
        evidence: {
          routeOrderGroups: routeGroups.slice(0, sampleLimit).map(compactRouteOrderGroup),
          diagnostics: routeGroups.length ? [] : routeDiagnostics.slice(0, sampleLimit).map(compactDiagnostic),
          routeOrderSensitiveCount: confidence && confidence.routeOrder && confidence.routeOrder.count || routeGroups.length || routeDiagnostics.length
        }
      }),
      packageRow({
        id: 'dynamic_q',
        label: 'Dynamic Q package',
        rowCount: dynamicKeys.length || dynamicDiagnostics.length,
        ownerCount: uniqueStrings((dynamicKeys.length ? dynamicKeys.map((row) => normalizePath(row.source && row.source.path)) : dynamicDiagnostics.map((diag) => normalizePath(diag.path || diag.source && diag.source.path)))).filter(Boolean).length,
        installSafety: 'advanced_apply',
        reason: 'Dynamic Q[] keys remain proof-first, but source-backed visible effects are edited through advanced source patches.',
        recommendedNextAction: 'Classify expressions, inspect affected variable/effect owners, then use advanced apply for source-backed edits.',
        evidence: {
          classifications: dynamicKeys.length
            ? countBy(dynamicKeys, (row) => String(row.classification || 'unknown'))
            : countBy(dynamicDiagnostics, (diag) => String(diag.classification || 'unknown')),
          dynamicKeyEvidence: dynamicKeys.slice(0, sampleLimit).map(compactDynamicKeyEvidence),
          diagnostics: dynamicKeys.length ? [] : dynamicDiagnostics.slice(0, sampleLimit).map(compactDiagnostic)
        }
      })
    ].concat(profilePackages);
    if (!hasProfileMonthlyPackage) {
      packages.push(packageRow({
        id: 'monthly_popup_router',
        label: 'Monthly popup router package',
        rowCount: monthlyPopups.length,
        ownerCount: monthlyPopups.length,
        installSafety: 'advanced_apply',
        reason: 'Popup content opens through linked events, and protected router source changes use advanced apply.',
        recommendedNextAction: 'Edit linked event content where guarded; use advanced apply for protected router source patches.',
        evidence: {
          routerManualReviewCount: confidence && confidence.monthlyPopups && confidence.monthlyPopups.routerManualReviewCount || monthlyPopups.length,
          routerTable: lookup.monthlyPopupRouterTable.slice(0, sampleLimit).map(compactMonthlyPopupRouterEntry),
          popups: lookup.monthlyPopupRouterTable.length ? [] : monthlyPopups.slice(0, sampleLimit).map((popup) => ({
            id: String(popup && (popup.id || popup.linkedSceneId || popup.sceneId) || ''),
            linkedSceneId: String(popup && (popup.linkedSceneId || popup.sceneId) || ''),
            router: sourceRef(popup && popup.router || {})
          }))
        }
      }));
    }
    packages.push(packageRow({
        id: 'variable_provenance',
        label: 'Variable provenance package',
        rowCount: variableRows.length,
        ownerCount: variableRows.length,
        installSafety: 'advanced_apply',
        reason: 'Existing variables are navigable and editable; readers, writers, and definitions are impact preview, not blockers.',
        recommendedNextAction: 'Open variable provenance, group by owner scene, then use guarded or advanced source-backed variable edits.',
        evidence: {
          categories: summarizeVariableCategories(lookup),
          samples: variableRows.slice(0, sampleLimit).map((row) => ({
            id: row.id,
            label: row.label,
            source: row.source,
            reason: row.reason
          }))
        }
      }));
    packages.push(packageRow({
        id: 'protected_output',
        label: 'Protected output package',
        rowCount: protectedRows.length,
        ownerCount: uniqueStrings(protectedRows.map((row) => row.source && row.source.path || '')).filter(Boolean).length,
        installSafety: 'advanced_apply',
        reason: 'Generated runtime output must be mapped back to source-backed owners before Studio edits it.',
        recommendedNextAction: 'Use source-backed owners and advanced source patches; do not edit generated output files directly.',
        evidence: {
          bySource: countBy(protectedRows, (row) => row.source && row.source.path || 'unknown'),
          samples: protectedRows.slice(0, sampleLimit).map((row) => ({
            id: row.id,
            label: row.label,
            source: row.source,
            reason: row.reason
          }))
        }
      }));
    return packages;
  }

  function packageRow(input) {
    const rowCount = Number(input.rowCount || 0);
    return {
      id: String(input.id || ''),
      label: String(input.label || input.id || ''),
      rowCount,
      ownerCount: Number(input.ownerCount || 0),
      profileId: String(input.profileId || ''),
      packageKind: String(input.kind || input.packageKind || ''),
      installSafety: String(input.installSafety || 'manual_review'),
      status: rowCount > 0 ? 'active' : 'empty',
      reason: String(input.reason || ''),
      recommendedNextAction: String(input.recommendedNextAction || ''),
      evidence: isObject(input.evidence) ? input.evidence : {}
    };
  }

  function buildProfileManualPackages(lookup, sampleLimit) {
    return ensureArray(lookup && lookup.profilePackages).map((profilePackage) => {
      const packageId = String(profilePackage && profilePackage.id || '');
      const profileId = String(profilePackage && profilePackage.profileId || '');
      const routerTables = ensureArray(lookup && lookup.profileRouterTables)
        .filter((table) => String(table && table.packageId || '') === packageId && String(table && table.profileId || '') === profileId);
      const routerRows = routerTables.flatMap((table) => ensureArray(table && table.rows));
      return packageRow({
        id: packageId,
        profileId,
        kind: String(profilePackage && profilePackage.kind || ''),
        label: String(profilePackage && (profilePackage.label || profilePackage.id) || ''),
        rowCount: Number(profilePackage && profilePackage.rowCount || routerRows.length || 0),
        ownerCount: Number(profilePackage && profilePackage.ownerCount || uniqueStrings(routerRows.map((row) => String(row && (row.linkedSceneId || row.id) || ''))).length || 0),
        installSafety: packageId === 'monthly_popup_router'
          ? 'advanced_apply'
          : String(profilePackage && profilePackage.installSafety || 'manual_review'),
        reason: packageId === 'monthly_popup_router'
          ? 'Profile-declared monthly popup router evidence uses advanced source apply for protected router edits.'
          : String(profilePackage && profilePackage.reason || 'Profile-declared semantic evidence remains review evidence.'),
        recommendedNextAction: packageId === 'monthly_popup_router'
          ? 'Edit linked event content where guarded; use advanced apply for protected router source patches.'
          : String(profilePackage && profilePackage.recommendedNextAction || 'Review the profile-declared evidence package before install.'),
        evidence: Object.assign({}, isObject(profilePackage && profilePackage.evidence) ? profilePackage.evidence : {}, {
          profileId,
          packageKind: String(profilePackage && profilePackage.kind || ''),
          routerTables: routerTables.slice(0, sampleLimit).map(compactProfileRouterTable),
          routerRows: routerRows.slice(0, sampleLimit).map(compactMonthlyPopupRouterEntry)
        })
      });
    });
  }

  function compactProfileRouterTable(table) {
    return {
      id: String(table && table.id || ''),
      profileId: String(table && table.profileId || ''),
      packageId: String(table && table.packageId || ''),
      kind: String(table && table.kind || ''),
      source: String(table && table.source || ''),
      rowCount: Number(table && table.rowCount || ensureArray(table && table.rows).length || 0),
      installSafety: String(table && table.installSafety || ''),
      reviewBoundary: String(table && table.reviewBoundary || ''),
      compatAlias: String(table && table.compatAlias || '')
    };
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

  function flattenProfilePackages(profiles) {
    const out = [];
    ensureArray(profiles).forEach((profile) => {
      ensureArray(profile && profile.packages).forEach((item) => {
        out.push(Object.assign({profileId: String(profile && profile.profileId || '')}, isObject(item) ? item : {}));
      });
    });
    return out;
  }

  function flattenProfileRouterTables(profiles) {
    const out = [];
    ensureArray(profiles).forEach((profile) => {
      ensureArray(profile && profile.routerTables).forEach((table) => {
        out.push(Object.assign({profileId: String(profile && profile.profileId || '')}, isObject(table) ? table : {}));
      });
    });
    return out;
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

  function flattenProfileRules(profiles, key) {
    const out = [];
    ensureArray(profiles).forEach((profile) => {
      ensureArray(profile && profile[key]).forEach((item) => {
        out.push(Object.assign({profileId: String(profile && profile.profileId || '')}, isObject(item) ? item : {}));
      });
    });
    return out;
  }

  function buildLookup(index) {
    const semantic = isObject(index.semantic) ? index.semantic : {};
    const news = isObject(semantic.news) ? semantic.news : {};
    const parserEvidence = isObject(semantic.parserEvidence) ? semantic.parserEvidence : {};
    const profileEvidence = profileEvidenceRows(parserEvidence);
    const profileRouterRows = flattenProfileRouterRows(profileEvidence, '');
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
    const variablesByName = new Map();
    ensureArray(index.variables).forEach((variable) => {
      if (variable && variable.name) {
        variablesByName.set(String(variable.name), variable);
      }
    });
    return {
      index,
      semantic,
      scenes,
      scenesById,
      scenesByPath,
      diagnostics: ensureArray(index.diagnostics),
      parserEvidence,
      profileEvidence,
      profilePackages: flattenProfilePackages(profileEvidence),
      profileRouterTables: flattenProfileRouterTables(profileEvidence),
      profileRouterRows,
      profileProtectedBoundaries: flattenProfileRules(profileEvidence, 'protectedBoundaries'),
      profileVariableSystems: flattenProfileRules(profileEvidence, 'variableSystems'),
      routeOrderGroups: parserEvidenceRows(parserEvidence, 'routeOrderGroups'),
      dynamicKeyEvidence: parserEvidenceRows(parserEvidence, 'dynamicKeyEvidence'),
      effectClauses: parserEvidenceRows(parserEvidence, 'effectClauses'),
      monthlyPopupRouterTable: monthlyPopupRouterTable.length ? monthlyPopupRouterTable : ensureArray(parserEvidence.monthlyPopupRouterTable),
      popups: ensureArray(news.eventPopups),
      electionResults: ensureArray(semantic.electionResults && semantic.electionResults.items),
      variables: ensureArray(index.variables),
      variablesByName
    };
  }

  function buildCoverage(index, options) {
    if (options && options.coverage) {
      return options.coverage;
    }
    const api = visibleCoverageApi();
    if (!api || typeof api.buildCoverageReport !== 'function') {
      return {rows: [], summary: {}};
    }
    try {
      return api.buildCoverageReport(index, {includeVariables: true, includeStructuredLogic: true});
    } catch (_err) {
      return {rows: [], summary: {}};
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
      return api.buildConfidenceReport(index, {sampleLimit: positiveInteger(options && options.sampleLimit, 8)});
    } catch (_err) {
      return {};
    }
  }

  function diagnosticsForScene(lookup, scene) {
    const id = String(scene && scene.id || '');
    const path = normalizePath(sceneSource(scene).path);
    return ensureArray(lookup.diagnostics).filter((diag) => {
      const diagPath = normalizePath(diag && (diag.path || diag.source && diag.source.path));
      return String(diag && diag.sceneId || '') === id || diagPath === path;
    });
  }

  function routeOrderGroupsForScene(lookup, scene) {
    const id = String(scene && scene.id || '');
    const path = normalizePath(sceneSource(scene).path);
    return ensureArray(lookup && lookup.routeOrderGroups).filter((group) => {
      const sourcePath = normalizePath(group && group.source && group.source.path);
      return String(group && group.sceneId || '') === id || sourcePath === path;
    });
  }

  function dynamicKeyEvidenceForScene(lookup, scene) {
    const path = normalizePath(sceneSource(scene).path);
    return ensureArray(lookup && lookup.dynamicKeyEvidence).filter((row) => {
      return normalizePath(row && row.source && row.source.path) === path;
    });
  }

  function sceneCoverageRow(coverage, sceneId) {
    return findCoverageRow(coverage, (row) => {
      return (row.view === 'events' || row.view === 'cards' || row.view === 'scenes') &&
        (String(row.id || '').endsWith(':' + sceneId) ||
          String(row.target && row.target.sceneId || '') === String(sceneId) ||
          String(row.target && row.target.targetId || '') === String(sceneId));
    });
  }

  function findCoverageRow(coverage, predicate) {
    return ensureArray(coverage && coverage.rows).find((row) => {
      try {
        return predicate(row || {});
      } catch (_err) {
        return false;
      }
    }) || null;
  }

  function sceneReviewReason(kind, routeGroups, dynamicKeys, routeDiagnostics, dynamicDiagnostics, election) {
    if (kind === 'route_order') {
      return routeGroups.length || routeDiagnostics.length
        ? 'Conditional route order is parser-backed with ordered clauses, predicates, fallback context, and source lines, but rewrites remain manual review.'
        : 'Route ownership is visible; no route-order diagnostic was found for this sample.';
    }
    if (kind === 'dynamic_q') {
      return dynamicKeys.length || dynamicDiagnostics.length
        ? 'Dynamic Q expressions have parser evidence, classification, binding context, and affected-variable candidates; unresolved keys remain manual review.'
        : 'Dynamic Q workflow has no opaque dynamic Q diagnostic in this ProjectIndex.';
    }
    if (kind === 'election_d3') {
      return election
        ? 'Source-backed D3 election result can open through Event Workbench/Object Canvas, while runtime evidence and install boundaries remain review-first.'
        : 'Election workflow did not expose a matching D3 result row.';
    }
    return 'Source ownership and editor routing are visible through Studio authoring surfaces.';
  }

  function sceneRecommendedNextAction(kind) {
    if (kind === 'route_order') {
      return 'Inspect route order, predicate, fallback, and chain context before route edits.';
    }
    if (kind === 'dynamic_q') {
      return 'Review dynamic Q classifications and affected variables/effects before changing parser safety.';
    }
    if (kind === 'election_d3') {
      return 'Use the source-backed election canvas and Runtime Lens evidence, then keep Review & Apply conservative.';
    }
    return 'Open the owning Event Workbench and review source-backed sections.';
  }

  function ownershipRow(input) {
    return {
      id: stableId([input.workflowId, input.semanticRole, input.owner && input.owner.id].join(':')),
      workflowId: String(input.workflowId || ''),
      workflowKind: String(input.workflowKind || ''),
      source: sourceRef(input.source || {}),
      sourceTrail: uniqueSources(input.sourceTrail || [input.source]),
      owner: isObject(input.owner) ? input.owner : {},
      semanticRole: String(input.semanticRole || ''),
      editorRoute: isObject(input.editorRoute) ? input.editorRoute : {},
      installSafety: String(input.installSafety || 'manual_review'),
      reviewEvidence: isObject(input.reviewEvidence) ? input.reviewEvidence : {},
      recommendedNextAction: String(input.recommendedNextAction || '')
    };
  }

  function summarizeGraph(rows, packages) {
    const all = ensureArray(rows);
    const manual = all.filter((row) => row.installSafety === 'manual_review' || row.installSafety === 'refused');
    return {
      rowCount: all.length,
      workflowCount: uniqueStrings(all.map((row) => row.workflowId)).length,
      manualReviewRowCount: manual.length,
      packageCount: ensureArray(packages).length,
      activePackageCount: ensureArray(packages).filter((item) => item.status === 'active').length,
      byWorkflowKind: countBy(all, (row) => row.workflowKind),
      bySemanticRole: countBy(all, (row) => row.semanticRole),
      byInstallSafety: countBy(all, (row) => row.installSafety)
    };
  }

  function summarizeVariableCategories(lookup) {
    const counts = {};
    ensureArray(lookup && lookup.variables).forEach((variable) => {
      variableCategories(variable, lookup).forEach((category) => {
        counts[category] = (counts[category] || 0) + 1;
      });
    });
    return counts;
  }

  function ownerScenesForSources(lookup, sources, limit) {
    const seen = new Set();
    const out = [];
    ensureArray(sources).forEach((source) => {
      const ref = sourceRef(source);
      const scene = lookup.scenesByPath.get(ref.path);
      const key = scene && scene.id ? String(scene.id) : ref.path;
      if (!key || seen.has(key)) {
        return;
      }
      seen.add(key);
      out.push({
        id: scene && scene.id || '',
        title: scene && (scene.title || scene.id) || '',
        kind: scene && scene.type || sourceArea(ref.path),
        source: ref
      });
    });
    return out.slice(0, limit || 8);
  }

  function sceneIdForDiagnostic(lookup, diag) {
    const explicit = String(diag && diag.sceneId || '');
    if (explicit) {
      return explicit;
    }
    const path = normalizePath(diag && (diag.path || diag.source && diag.source.path));
    const scene = lookup.scenesByPath.get(path);
    return scene && scene.id || '';
  }

  function compactDiagnostic(diag) {
    return {
      code: String(diag && diag.code || ''),
      path: normalizePath(diag && (diag.path || diag.source && diag.source.path)),
      source: sourceRef(diag && diag.source || {path: diag && diag.path}),
      message: String(diag && diag.message || '').slice(0, 220),
      expression: String(diag && diag.expression || ''),
      classification: String(diag && diag.classification || ''),
      reviewBoundary: String(diag && diag.reviewBoundary || '')
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
      clauses: ensureArray(group && group.clauses).map((clause) => ({
        order: Number(clause && clause.order || 0),
        rawTarget: String(clause && clause.rawTarget || ''),
        resolvedTarget: String(clause && clause.resolvedTarget || ''),
        targetResolved: Boolean(clause && clause.targetResolved),
        predicate: String(clause && clause.predicate || ''),
        isFallback: Boolean(clause && clause.isFallback)
      }))
    };
  }

  function compactDynamicKeyEvidence(row) {
    return {
      id: String(row && row.id || ''),
      expression: String(row && row.expression || ''),
      accessKind: String(row && row.accessKind || ''),
      classification: String(row && row.classification || ''),
      source: sourceRef(row && row.source || {}),
      safeExpansion: row && row.safeExpansion === true,
      expandedKeyCount: Number(row && row.expandedKeyCount || ensureArray(row && row.expandedKeys).length || 0),
      expandedKeys: ensureArray(row && row.expandedKeys).slice(0, 8).map(String),
      bindingSources: ensureArray(row && row.bindingSources).slice(0, 8).map((item) => ({
        name: String(item && item.name || ''),
        kind: String(item && item.kind || ''),
        valueCount: Number(item && item.valueCount || 0)
      })),
      reviewBoundary: String(row && row.reviewBoundary || '')
    };
  }

  function compactMonthlyPopupRouterEntry(row) {
    return {
      id: String(row && row.id || ''),
      profileId: String(row && row.profileId || ''),
      packageId: String(row && row.packageId || ''),
      routerTableId: String(row && row.routerTableId || ''),
      linkedSceneId: String(row && row.linkedSceneId || ''),
      title: String(row && row.title || ''),
      viewIf: String(row && row.viewIf || ''),
      router: sourceRef(row && row.router && row.router.source || {}),
      contentSource: sourceRef(row && row.contentSource || {}),
      installSafety: String(row && row.installSafety || ''),
      reviewBoundary: String(row && row.reviewBoundary || ''),
      reason: String(row && row.reason || '')
    };
  }

  function sourceArea(path) {
    const rel = normalizePath(path);
    if (rel.indexOf('/cards/') >= 0) {
      return 'card';
    }
    if (rel.indexOf('/events/') >= 0) {
      return 'event';
    }
    if (rel.indexOf('/government_affairs/') >= 0 || rel.indexOf('/party_affairs/') >= 0) {
      return 'event';
    }
    if (rel === 'source/scenes/root.scene.dry' || rel === 'source/scenes/post_event.scene.dry') {
      return 'router';
    }
    return rel ? 'source' : '';
  }

  function projectSummary(index) {
    const project = isObject(index.project) ? index.project : {};
    return {
      name: String(project.name || project.title || ''),
      root: String(project.root || ''),
      profileIds: ensureArray(project.profileIds).map(String)
    };
  }

  function sceneSource(scene) {
    return sourceRef(scene && (scene.sourceSpan || scene.topLevelSpan || {path: scene.path}));
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

  function uniqueSources(sources) {
    const seen = new Set();
    const out = [];
    ensureArray(sources).forEach((source) => {
      const ref = sourceRef(source);
      if (!ref.path) {
        return;
      }
      const key = [ref.path, ref.line || '', ref.endLine || '', ref.anchorText || ''].join('\u0000');
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      out.push(ref);
    });
    return out;
  }

  function isProtectedRouterPath(path) {
    return PROTECTED_ROUTER_PATHS.has(normalizePath(path));
  }

  function isGeneratedPath(path) {
    const rel = normalizePath(path);
    return rel === 'out/game.json' || rel.startsWith('out/html/') || rel.startsWith('out/') || rel.startsWith('.git/');
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

  function stableId(value) {
    const text = String(value || 'semantic_owner').replace(/[^A-Za-z0-9_.:-]+/g, '_').replace(/^_+|_+$/g, '');
    return text || 'semantic_owner';
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

  function diagnostic(severity, code, message, extra) {
    return Object.assign({severity, code, message}, isObject(extra) ? extra : {});
  }

  const api = {
    MODEL_VERSION,
    DEFAULT_WORKFLOWS,
    buildSemanticOwnershipGraph,
    buildManualBoundaryPackages,
    buildVariableProvenance,
    buildEffectProvenance,
    buildLookup,
    sourceRef,
    isProtectedRouterPath,
    isGeneratedPath
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSemanticOwnershipGraph = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
