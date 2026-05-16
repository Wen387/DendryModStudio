#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const coverage = require('./authoring/visible_object_coverage_model.js');
const objectCanvasModel = require('./authoring/object_authoring_canvas_model.js');
const parserRendererConfidence = require('./authoring/parser_renderer_confidence_model.js');
const dynamicSemanticWorkbench = require('./authoring/dynamic_semantic_workbench_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_MAP_ROOT = __dirname;
const DEFAULT_DYNAMIC_ROOT = path.join(REPO_ROOT, 'SDAAHdynamic', 'dynamic_social_democracy-main');
const DYNAMIC_ROOT = path.resolve(process.env.DMS_DYNAMIC_FIXTURE_ROOT || process.env.DMS_SDAAH_FIXTURE_ROOT || DEFAULT_DYNAMIC_ROOT);
const FIXTURES = [
  {id: 'qa-mini', root: path.join(PROJECT_MAP_ROOT, 'fixtures', 'qa-mini'), includeExcerpts: true},
  {id: 'contract-fixture', root: path.join(REPO_ROOT, 'studio_contract', 'parser_fixture'), includeExcerpts: true},
  {id: 'dynamic-mod', root: DYNAMIC_ROOT, includeExcerpts: true}
];

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildIndex(fixture) {
  assert(fs.existsSync(path.join(fixture.root, 'source', 'info.dry')), fixture.id + ' root should contain source/info.dry', {root: fixture.root});
  const outPath = path.join(os.tmpdir(), 'dms_' + fixture.id.replace(/[^A-Za-z0-9_-]/g, '_') + '_audit_project_index.json');
  const args = [
    path.join(PROJECT_MAP_ROOT, 'build_project_map.py'),
    '--root', fixture.root,
    '--out', outPath,
    '--summary'
  ];
  if (fixture.includeExcerpts) {
    args.push('--include-excerpts', '--excerpt-context-lines', '2');
  }
  const result = childProcess.spawnSync('python3', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  assert(result.status === 0, fixture.id + ' ProjectIndex build should succeed', {stdout: result.stdout, stderr: result.stderr});
  return {
    id: fixture.id,
    root: fixture.root,
    outPath,
    stdout: result.stdout,
    index: readJson(outPath)
  };
}

function summarizeIndex(item) {
  const index = item.index || {};
  const semantic = index.semantic || {};
  const news = semantic.news || {};
  const parserEvidence = semantic.parserEvidence || {};
  const parserCore = parserEvidence.core || parserEvidence;
  const profileRouterRows = flattenProfileRouterRows(parserEvidence.profiles || []);
  const parserEvidenceSummary = parserEvidence.summary || {};
  const diagnostics = Array.isArray(index.diagnostics) ? index.diagnostics : [];
  const report = coverage.buildCoverageReport(index, {includeVariables: true, includeStructuredLogic: true});
  const confidence = parserRendererConfidence.buildConfidenceReport(index, {sampleLimit: 8});
  const semanticWorkbench = dynamicSemanticWorkbench.buildDynamicSemanticWorkbench(index, {
    coverage: report,
    confidence,
    sampleLimit: 8
  });
  return {
    id: item.id,
    project: index.project && index.project.name || '',
    root: item.root,
    profiles: index.project && index.project.profileIds || [],
    counts: {
      scenes: (index.scenes || []).length,
      edges: (index.edges || []).length,
      variables: (index.variables || []).length,
      events: (semantic.events || []).length,
      cards: (semantic.cards || []).length,
      monthlyPopups: (news.eventPopups || []).length,
      surfaceText: semantic.surfaceText && (semantic.surfaceText.items || []).length || 0,
      textCorpus: semantic.textCorpus && (semantic.textCorpus.items || []).length || 0,
      electionResults: semantic.electionResults && (semantic.electionResults.items || []).length || 0,
      routeOrderGroups: parserEvidenceSummary.routeOrderGroupCount || (parserCore.routeOrderGroups || []).length || 0,
      dynamicKeyEvidence: parserEvidenceSummary.dynamicKeyEvidenceCount || (parserCore.dynamicKeyEvidence || []).length || 0,
      dynamicKeyManualReview: parserEvidenceSummary.dynamicKeyManualReviewCount || 0,
      dynamicKeySafeExpansion: parserEvidenceSummary.dynamicKeySafeExpansionCount || 0,
      effectClauses: parserEvidenceSummary.effectClauseCount || (parserCore.effectClauses || []).length || 0,
      monthlyPopupRouters: parserEvidenceSummary.monthlyPopupRouterCount || profileRouterRows.length || (parserEvidence.monthlyPopupRouterTable || []).length || 0,
      assets: semantic.assets && (semantic.assets.items || semantic.assets || []).length || 0,
      diagnostics: diagnostics.length
    },
    diagnostics: diagnosticSummary(diagnostics),
    coverage: compactCoverage(report.summary),
    manualSamples: sampleRows(report.rows, (row) => row.installSafety === 'manual_review' || row.routeClass === 'manual_review', 8),
    refusedSamples: sampleRows(report.rows, (row) => row.installSafety === 'refused', 8),
    weakSafeSamples: sampleRows(report.rows, (row) => row.safeEditEligible && !row.safeEditable, 8),
    gapCandidates: gapCandidates(index, report, diagnostics),
    parserRendererConfidence: confidence,
    dynamicSemanticWorkbench: compactSemanticWorkbench(semanticWorkbench)
  };
}

function compactSemanticWorkbench(workbench) {
  const value = workbench || {};
  return {
    summary: value.summary || {},
    workflows: (value.workflows || []).map((workflow) => ({
      id: workflow.id,
      workflowKind: workflow.workflowKind,
      status: workflow.status,
      title: workflow.title,
      reviewApplyReadiness: workflow.sections && workflow.sections.reviewApplyReadiness || {},
      manualBoundaries: workflow.sections && workflow.sections.manualBoundaries || {},
      runtimeEvidence: workflow.sections && workflow.sections.runtimeEvidence || {}
    })),
    manualBoundaryPackages: (value.manualBoundaryPackages || []).map((item) => ({
      id: item.id,
      label: item.label,
      rowCount: item.rowCount,
      ownerCount: item.ownerCount,
      installSafety: item.installSafety,
      status: item.status,
      reason: item.reason,
      recommendedNextAction: item.recommendedNextAction
    }))
  };
}

function flattenProfileRouterRows(profiles) {
  const rows = [];
  (profiles || []).forEach((profile) => {
    const packages = new Map((profile && profile.packages || []).map((item) => [String(item && item.id || ''), item || {}]));
    (profile && profile.routerTables || []).forEach((table) => {
      const packageRow = packages.get(String(table && table.packageId || '')) || {};
      const alias = String(table && table.compatAlias || packageRow.compatAlias || '');
      (table && table.rows || []).forEach((row) => {
        rows.push(Object.assign({
          profileId: String(profile && profile.profileId || ''),
          packageId: String(table && table.packageId || ''),
          routerTableId: String(table && table.id || ''),
          compatAlias: alias
        }, row || {}));
      });
    });
  });
  return rows;
}

function diagnosticSummary(diagnostics) {
  const byCode = {};
  diagnostics.forEach((item) => {
    const code = String(item && (item.code || item.kind || item.severity) || 'unknown');
    byCode[code] = (byCode[code] || 0) + 1;
  });
  return {
    total: diagnostics.length,
    top: Object.entries(byCode).sort((left, right) => right[1] - left[1]).slice(0, 12).map(([code, count]) => ({code, count})),
    sample: diagnostics.slice(0, 5).map((item) => ({
      severity: item.severity || '',
      code: item.code || '',
      sceneId: item.sceneId || '',
      path: item.path || item.source && item.source.path || '',
      message: String(item.message || '').slice(0, 180)
    }))
  };
}

function compactCoverage(summary) {
  const value = summary || {};
  return {
    total: value.total || 0,
    routeCoverage: round(value.routeCoverage),
    safeEditCoverage: round(value.safeEditCoverage),
    previewCoverage: round(value.previewCoverage),
    visibleEditableCoverage: round(value.visibleEditableCoverage),
    visibleEditActionCoverage: round(value.visibleEditActionCoverage),
    visibleEditActionMissingCount: value.visibleEditActionMissingCount || 0,
    visibleEditActionUnresolvedCount: value.visibleEditActionUnresolvedCount || 0,
    semanticEditorCoverage: round(value.semanticEditorCoverage),
    structuredRouteEditorCoverage: round(value.structuredRouteEditorCoverage),
    effectClauseEditorCoverage: round(value.effectClauseEditorCoverage),
    sourceSliceFallbackCount: value.sourceSliceFallbackCount || 0,
    visibleDisplayOnlyCount: value.visibleDisplayOnlyCount || 0,
    visibleUnsupportedCount: value.visibleUnsupportedCount || 0,
    visibleManualReviewCount: value.visibleManualReviewCount || 0,
    visibleRefusedCount: value.visibleRefusedCount || 0,
    manualBoundaryCount: value.manualBoundaryCount || 0,
    unsupportedCount: value.unsupportedCount || 0,
    structuredLogicCoverage: round(value.structuredLogicCoverage),
    goalW: compactGoal(value.goalW),
    goalX: compactGoal(value.goalX),
    byArea: value.byArea || {},
    byRoute: value.byRoute || {},
    bySafety: value.bySafety || {},
    byType: value.byType || {}
  };
}

function compactGoal(goal) {
  const value = goal || {};
  return {
    eligible: value.eligible || 0,
    safeEditable: value.safeEditable || 0,
    safeEditCoverage: round(value.safeEditCoverage),
    previewCoverage: round(value.previewCoverage),
    passes70: Boolean(value.passes70),
    passes90: Boolean(value.passes90)
  };
}

function sampleRows(rows, predicate, limit) {
  return (rows || []).filter(predicate).slice(0, limit).map((row) => ({
    area: row.area || '',
    type: row.objectType || '',
    role: row.role || '',
    label: String(row.label || '').slice(0, 120),
    route: row.routeClass || '',
    safety: row.installSafety || '',
    source: row.source && row.source.path || ''
  }));
}

function gapCandidates(index, report, diagnostics) {
  const rows = report.rows || [];
  const byDiag = countBy(diagnostics, (item) => item.code || 'unknown');
  const monthlyDisplayOnly = rows.filter((row) => row.objectType === 'monthly_popup' && row.visibleDisplayOnly).length;
  const variableDisplayOnly = rows.filter((row) => row.objectType === 'variable' && row.visibleDisplayOnly).length;
  const refusedRows = rows.filter((row) => row.installSafety === 'refused');
  const protectedRefused = refusedRows.filter((row) => protectedOutputSource(row.source && row.source.path)).length;
  const unexpectedRefused = refusedRows.length - protectedRefused;
  return [
    gap('P1', 'conditional_go_to_runtime_order', byDiag.project_map && byDiag.project_map.conditional_goto || byDiag['project_map.conditional_goto'] || 0, 'Conditional/chained go-to routes are represented, but remain runtime-order-sensitive.'),
    gap('P1', 'opaque_q_dynamic', byDiag['project_map.dynamic_q_opaque'] || 0, 'Opaque Q dynamic expressions cannot be safely rewritten as structured effects.'),
    gap('P1', 'monthly_popup_display_only', monthlyDisplayOnly, 'SDAAH-style monthly event popups are visible but not editable.'),
    gap('P2', 'variable_display_only', variableDisplayOnly, 'Variables are visible but do not generate an edit operation.'),
    gap('P0', 'unexpected_refused_visible_rows', unexpectedRefused, 'Visible rows outside protected output are refused and need routing/safety audit.'),
    gap('P3', 'protected_output_refused_boundary', protectedRefused, 'Protected generated output is visible but intentionally refused for automatic editing.')
  ].filter((item) => item.count > 0);
}

function protectedOutputSource(sourcePath) {
  const value = String(sourcePath || '').replace(/\\/g, '/');
  return value.startsWith('out/html/') || value === 'out/game.json' || value.startsWith('.git/');
}

function countBy(items, keyFn) {
  return (items || []).reduce((counts, item) => {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function gap(severity, id, count, note) {
  return {severity, id, count, note};
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 10000) / 10000 : 0;
}

function assertGenericCompatibility(summaries) {
  summaries.forEach((summary) => {
    assert(summary.profiles.length > 0, summary.id + ' should be assigned at least one parser/profile id', summary);
    assert(summary.counts.scenes > 0, summary.id + ' should expose at least one source scene', summary.counts);
    assert(summary.coverage.total > 0, summary.id + ' should produce visible-object coverage rows', summary.coverage);
    assert(summary.coverage.routeCoverage === 1, summary.id + ' visible objects should stay routed to a Studio surface', summary.coverage);
    assert(summary.coverage.visibleEditableCoverage === 1, summary.id + ' visible content should be editable in Studio', summary.coverage);
    assert(summary.coverage.visibleEditActionCoverage === 1, summary.id + ' visible content should expose click-to-edit actions', summary.coverage);
    assert(summary.coverage.visibleEditActionMissingCount === 0, summary.id + ' should not miss visible click-to-edit actions', summary.coverage);
    assert(summary.coverage.visibleEditActionUnresolvedCount === 0, summary.id + ' should resolve visible click-to-edit actions', summary.coverage);
    assert(summary.coverage.semanticEditorCoverage === 1, summary.id + ' visible route/effect/variable logic should expose semantic editors', summary.coverage);
    assert(summary.coverage.structuredRouteEditorCoverage === 1, summary.id + ' structured route rows should expose Route Editor metadata', summary.coverage);
    assert(summary.coverage.effectClauseEditorCoverage === 1, summary.id + ' effect rows should expose Effect Clause Editor metadata', summary.coverage);
    assert(summary.coverage.visibleDisplayOnlyCount === 0, summary.id + ' should not expose display-only visible content', summary.coverage);
    assert(summary.coverage.visibleUnsupportedCount === 0, summary.id + ' should not expose unsupported visible content', summary.coverage);
    assert(summary.coverage.visibleManualReviewCount === 0, summary.id + ' visible content should not fall back to manual review', summary.coverage);
    assert(summary.coverage.visibleRefusedCount === 0, summary.id + ' visible content should not be refused', summary.coverage);
    assert(summary.coverage.previewCoverage > 0, summary.id + ' should keep at least some previewable content', summary.coverage);
    assert(summary.coverage.unsupportedCount === 0, summary.id + ' should not produce unsupported visible-object rows', summary.coverage);
  });
}

function assertDynamicPressureSample(dynamic) {
  assert(dynamic.profiles.includes('sdaah-style'), 'Dynamic fixture should be detected as sdaah-style', dynamic.profiles);
  assert(dynamic.counts.scenes >= 400, 'Dynamic fixture should exercise a large scene corpus', dynamic.counts);
  assert(dynamic.counts.monthlyPopups >= 100, 'Dynamic fixture should expose monthly event popups', dynamic.counts);
  assert(dynamic.counts.electionResults >= 5, 'Dynamic fixture should expose source-backed D3 election result screens', dynamic.counts);
}

function assertDynamicParserRendererConfidence(dynamic) {
  const confidence = dynamic && dynamic.parserRendererConfidence || {};
  assert(confidence.kind === 'parser_renderer_confidence_report', 'Dynamic audit should include parser/renderer confidence evidence', confidence);
  assert(confidence.routeOrder && confidence.routeOrder.count >= 300, 'Dynamic confidence report should surface conditional route-order evidence', confidence.routeOrder);
  assert(confidence.routeOrder.structuredGroupCount === confidence.routeOrder.count, 'Dynamic route-order evidence should be parser-backed structured groups', confidence.routeOrder);
  assert(confidence.dynamicQ && confidence.dynamicQ.count >= 50, 'Dynamic confidence report should classify opaque dynamic Q boundaries', confidence.dynamicQ);
  assert(confidence.dynamicQ.manualReviewCount === confidence.dynamicQ.count, 'Dynamic Q opaque rows should remain manual review by default', confidence.dynamicQ);
  assert(confidence.dynamicQ.structuredEvidenceCount >= confidence.dynamicQ.count, 'Dynamic Q confidence report should expose structured parser evidence for every manual boundary', confidence.dynamicQ);
  assert(confidence.dynamicQ.safeExpansionCount >= 1, 'Dynamic Q confidence report should expose parser-proven safe expansion evidence separately from manual boundaries', confidence.dynamicQ);
  assert(confidence.monthlyPopups && confidence.monthlyPopups.count >= 100, 'Dynamic confidence report should expose monthly popup workflow evidence', confidence.monthlyPopups);
  assert(confidence.monthlyPopups.routerTableCount === confidence.monthlyPopups.count, 'Dynamic monthly popup evidence should be backed by the router table', confidence.monthlyPopups);
  assert(confidence.monthlyPopups.routerManualReviewCount === confidence.monthlyPopups.count, 'Monthly popup router behavior should stay a manual review boundary', confidence.monthlyPopups);
  assert(confidence.sharedEffects && confidence.sharedEffects.clauseCount >= 1000, 'Dynamic confidence report should expose parser-backed effect clauses', confidence.sharedEffects);
  assert(confidence.runtimeReadiness && confidence.runtimeReadiness.fallbackRequired, 'Dynamic confidence report should mark incomplete generated runtime as requiring fallback', confidence.runtimeReadiness);
  assert(confidence.runtimeReadiness.missingDependencyCount >= 2, 'Dynamic runtime readiness should list missing generated dependencies', confidence.runtimeReadiness);
}

function assertDynamicSemanticWorkbenchSummary(dynamic) {
  const workbench = dynamic && dynamic.dynamicSemanticWorkbench || {};
  const summary = workbench.summary || {};
  const packages = {};
  (workbench.manualBoundaryPackages || []).forEach((item) => {
    packages[item.id] = item;
  });
  assert(summary.workflowCount === 5, 'Dynamic Semantic Workbench should expose five fixed acceptance workflows', summary);
  assert(summary.readyWorkflowCount === 5, 'Dynamic Semantic Workbench should make every fixed workflow ready', summary);
  assert(packages.route_order && packages.route_order.rowCount === 332 && packages.route_order.installSafety === 'advanced_apply', 'Dynamic Semantic Workbench should compress route-order advanced packages', packages.route_order);
  assert(packages.dynamic_q && packages.dynamic_q.rowCount === 77 && packages.dynamic_q.installSafety === 'advanced_apply', 'Dynamic Semantic Workbench should compress dynamic Q advanced packages', packages.dynamic_q);
  assert(packages.monthly_popup_router && packages.monthly_popup_router.rowCount === 348 && packages.monthly_popup_router.installSafety === 'advanced_apply', 'Dynamic Semantic Workbench should compress monthly popup router advanced packages', packages.monthly_popup_router);
  assert(packages.variable_provenance && packages.variable_provenance.rowCount === 3553 && packages.variable_provenance.installSafety === 'advanced_apply', 'Dynamic Semantic Workbench should compress variable provenance advanced packages', packages.variable_provenance);
  assert(!packages.protected_output || packages.protected_output.rowCount === 0, 'Dynamic Semantic Workbench should not expose generated output as refused visible content', packages.protected_output);
  const byId = {};
  (workbench.workflows || []).forEach((item) => {
    byId[item.id] = item;
  });
  assert(byId.monthly_popup_1929 && byId.monthly_popup_1929.manualBoundaries.packages.some((item) => item.id === 'monthly_popup_router'), 'Monthly popup workflow should carry router package evidence', byId.monthly_popup_1929);
  assert(byId.route_order_presidential_1932 && byId.route_order_presidential_1932.manualBoundaries.routeOrderSensitiveCount >= 7, 'Presidential workflow should expose route-order evidence', byId.route_order_presidential_1932);
  assert(byId.dynamic_q_hindenburg_president && byId.dynamic_q_hindenburg_president.manualBoundaries.dynamicQCount === 12, 'Hindenburg workflow should expose dynamic Q evidence', byId.dynamic_q_hindenburg_president);
  assert(byId.election_d3_local_france && byId.election_d3_local_france.runtimeEvidence.electionResult && byId.election_d3_local_france.runtimeEvidence.electionResult.chartElementId === 'france_chamber', 'Election workflow should expose D3 runtime evidence', byId.election_d3_local_france);
  assert(byId.variable_abortion_rights && byId.variable_abortion_rights.reviewApplyReadiness.installSafety === 'advanced_apply', 'Variable workflow should expose existing variable edits as advanced apply', byId.variable_abortion_rights);
}

const built = FIXTURES.map(buildIndex);
const summaries = built.map(summarizeIndex);
const dynamic = summaries.find((item) => item.id === 'dynamic-mod');
const dynamicBuilt = built.find((item) => item.id === 'dynamic-mod');

function assertDynamicElectionEditing(item) {
  const index = item && item.index || {};
  const rows = index.semantic && index.semantic.electionResults && index.semantic.electionResults.items || [];
  const sample = rows.find((row) => row.id === 'local_election_france') || rows[0];
  assert(sample && sample.id, 'Dynamic election audit should have a source-backed election result sample', rows.slice(0, 3));
  assert(!rows.some((row) => row.id === 'presidential_election_1932_campaign'), 'Dynamic presidential campaign should stay out of the D3 parliament results surface', rows.map((row) => row.id).slice(0, 20));
  const reichstag = rows.find((row) => row.id === 'election_1928');
  assert(reichstag && reichstag.chartElementId === 'reichstag', 'Dynamic Reichstag election should stay parsed as a reusable D3 parliament source', rows.map((row) => ({id: row.id, chart: row.chartElementId})).slice(0, 20));
  assertNoDuplicatePartyNames(reichstag, 'Dynamic Reichstag election should not duplicate mutually exclusive party rows in the static preview');
  const local1932 = rows.find((row) => row.id === 'local_election_1932');
  assert(local1932 && local1932.chartElementId === 'bavaria_landtag', 'Dynamic local 1932 election should keep the first D3 parliament chart target', local1932);
  assertNoDuplicatePartyNames(local1932, 'Dynamic local 1932 election should scope party rows to one D3 chart target');
  assert(!(local1932.parties || []).some((party) => party.name === 'Center'), 'Dynamic local 1932 Bavaria chart should not include Wurttemberg party rows', local1932.parties);
  const wurttemberg = rows.find((row) => row.id === 'local_election_1932__wurttemberg_landtag');
  assert(wurttemberg && wurttemberg.sceneId === 'local_election_1932', 'Dynamic local 1932 Wurttemberg chart should be exposed as a separate D3 source', rows.filter((row) => row.id.indexOf('local_election_1932') === 0));
  assert(wurttemberg.chartElementId === 'wurttemberg_landtag', 'Dynamic local 1932 Wurttemberg source should retain its chart target', wurttemberg);
  assert((wurttemberg.parties || []).some((party) => party.name === 'Center'), 'Dynamic local 1932 Wurttemberg chart should carry its own scoped party rows', wurttemberg.parties);
  const presidential = objectCanvasModel.buildExistingCanvas(index, 'events', 'presidential_election_1932_campaign', {});
  assert(presidential.ok, 'Dynamic presidential campaign should still open through the existing Event editor', presidential.changeState && presidential.changeState.diagnostics);
  assert((presidential.eventBody && presidential.eventBody.options || []).length > 0, 'Dynamic presidential campaign should expose event options in the existing Event editor');
  const presidentialBody = presidential.eventBody || {};
  const presidentialFlow = presidentialBody.flow || {};
  assert(presidentialFlow.summary && presidentialFlow.summary.sectionCount >= 60, 'Dynamic presidential campaign should expose its large internal section graph', presidentialFlow.summary);
  assert(presidentialFlow.summary && presidentialFlow.summary.conditionalRouteCount >= 8, 'Dynamic presidential campaign should surface conditional internal routes instead of hiding them in top-level edges', presidentialFlow.summary);
  const ironFrontChoice = (presidentialBody.options || []).find((option) => option.rawTargetId === 'iron_front' && String(option.sectionId || '').includes('campaigning_braun'));
  assert(ironFrontChoice && /Iron|Front/i.test(String(ironFrontChoice.label || '')) && ironFrontChoice.labelSource === 'target_title', 'Dynamic naked option lines should borrow readable labels from their target sections', ironFrontChoice);
  const presidentialBlocks = (presidentialBody.sections || []).concat(presidentialBody.branchSections || []);
  const richConditionalBlock = presidentialBlocks.find((field) => (field.conditionalAlternatives || []).length >= 4);
  assert(richConditionalBlock, 'Dynamic presidential campaign should keep standalone conditional alternatives inspectable in the editor', presidentialBlocks.map((field) => ({label: field.label, alternatives: (field.conditionalAlternatives || []).length})).slice(0, 20));
  const board = objectCanvasModel.buildTemplateCanvas(index, 'election_results', {}, {
    values: {'election.targetSceneId': sample.id}
  });
  const draft = board.changeState && board.changeState.draft || {};
  assert(board.ok, 'Dynamic election results board should build for the selected source event', board.changeState && board.changeState.diagnostics);
  assert(draft.targetSceneId === sample.id, 'Dynamic election results selector should retain the selected source event id', {selected: sample.id, draft: draft.targetSceneId});
  assert(String(draft.sourcePath || '') === String(sample.path || ''), 'Dynamic election results selector should rebase sourcePath from the selected source event', {expected: sample.path, actual: draft.sourcePath});
  assert(String(draft.chartElementId || '') === String(sample.chartElementId || ''), 'Dynamic election results selector should rebase the D3 chart target from the selected source event', {expected: sample.chartElementId, actual: draft.chartElementId});
  const existing = objectCanvasModel.buildExistingCanvas(index, 'events', sample.id, {});
  assert(existing.ok, 'Dynamic selected election source should open through the existing Event editor', {id: sample.id, diagnostics: existing.changeState && existing.changeState.diagnostics});
  assert((existing.eventBody && existing.eventBody.options || []).length > 0, 'Dynamic selected election source should expose player options in the existing Event editor', {id: sample.id});
  return {
    id: sample.id,
    sourcePath: draft.sourcePath,
    chartElementId: draft.chartElementId,
    presidentialEventEditorOptions: (presidential.eventBody && presidential.eventBody.options || []).length,
    presidentialFlowSections: presidentialFlow.summary && presidentialFlow.summary.sectionCount || 0,
    presidentialConditionalRoutes: presidentialFlow.summary && presidentialFlow.summary.conditionalRouteCount || 0,
    presidentialTargetTitleFallbacks: presidentialFlow.summary && presidentialFlow.summary.targetTitleFallbackCount || 0,
    existingSections: (existing.eventBody && existing.eventBody.sections || []).length,
    existingOptions: (existing.eventBody && existing.eventBody.options || []).length
  };
}

function assertDynamicInlineCompositeEvent(item) {
  const index = item && item.index || {};
  const model = objectCanvasModel.buildExistingCanvas(index, 'events', 'center_party_conference', {});
  assert(model.ok, 'Dynamic center_party_conference should open through the existing Event editor', model.changeState && model.changeState.diagnostics);
  const body = model.eventBody || {};
  const title = String(body.title && body.title.value || model.title || '');
  assert(title.includes('Conference'), 'Dynamic inline conditional title should remain an event title', {title});
  const opening = (body.sections || []).map((field) => String(field.value || '')).join('\n');
  assert(opening.includes('Center Party') && opening.includes('CVP'), 'Dynamic mixed inline conditional prose should preserve both visible alternatives in the opening block', {opening: opening.slice(0, 600)});
  assert(!opening.includes('leadership of the .') && !opening.includes('chairman of the .') && !opening.includes("The 's middle class"), 'Dynamic mixed inline conditional prose should not be hollowed out by conditional extraction', {opening: opening.slice(0, 600)});
  const branches = (body.branchSections || []).filter((field) => String(field.semanticRole || '') === 'conditional_text');
  assert(!branches.some((field) => String(field.value || '').includes('Center Party') || String(field.value || '').includes('CVP')), 'Mixed inline conditionals should not become standalone branch cards', branches.map((field) => ({label: field.label, value: String(field.value || '').slice(0, 180)})));
  assert((body.options || []).length >= 4, 'Dynamic composite event should expose its four player options', (body.options || []).map((option) => option.id || option.label));
  assert((body.optionEffects || []).filter((group) => (group.fields || []).length > 0).length >= 4, 'Dynamic composite event should keep option-owned effects attached to choices', (body.optionEffects || []).map((group) => ({id: group.id, count: (group.fields || []).length})));
  return {
    title,
    openingBlocks: (body.sections || []).length,
    options: (body.options || []).length,
    optionEffectGroups: (body.optionEffects || []).filter((group) => (group.fields || []).length > 0).length
  };
}

function assertDynamicFollowUpMenuSemantics(item) {
  const index = item && item.index || {};
  const model = objectCanvasModel.buildExistingCanvas(index, 'events', 'dnf_collapse_center_right_coalition', {});
  assert(model.ok, 'Dynamic DNF coalition collapse event should open through the existing Event editor', model.changeState && model.changeState.diagnostics);
  const body = model.eventBody || {};
  const branchSections = body.branchSections || [];
  const menu = branchSections.find((field) => String(field.sectionId || '').endsWith('.new_prussia_election'));
  assert(menu, 'Dynamic DNF follow-up election menu should be exposed as a branch section', branchSections.map((field) => ({id: field.sectionId, role: field.semanticRole})));
  assert(String(menu.semanticRole || '') === 'menu_section_text', 'Dynamic DNF follow-up election menu should not be classified as an option result', {role: menu.semanticRole, label: menu.label});
  assert((menu.relatedOptionIds || []).length === 0, 'Dynamic DNF menu-owned options should not be treated as incoming options', {relatedOptionIds: menu.relatedOptionIds});
  assert((menu.ownedOptionIds || []).length >= 4, 'Dynamic DNF follow-up menu should expose its owned player choices', {ownedOptionIds: menu.ownedOptionIds, ownedOptionLabels: menu.ownedOptionLabels});
  assert(menu.hasInlineConditionals && (menu.inlineConditions || []).length >= 4, 'Dynamic DNF inline conditional prose should remain one mixed body block with inline condition metadata', {inlineConditions: menu.inlineConditions});
  const ownedOptions = (body.options || []).filter((option) => String(option.sectionId || '').endsWith('.new_prussia_election'));
  assert(ownedOptions.length >= 4, 'Dynamic DNF follow-up menu choices should remain editable option rows', ownedOptions.map((option) => option.id || option.label));
  assert(ownedOptions.every((option) => !(option.resultFields || []).some((field) => String(field.sectionId || '').endsWith('.new_prussia_election'))), 'Dynamic DNF follow-up menu text should not be duplicated under every owned option');
  const resultMenu = branchSections
    .concat((body.options || []).reduce((rows, option) => rows.concat(option.resultFields || []), []))
    .find((field) => String(field.sectionId || '').endsWith('.prussia_coalition') && String(field.semanticRole || '').indexOf('option_result') >= 0);
  assert(resultMenu && String(resultMenu.semanticRole || '').indexOf('option_result') >= 0 && (resultMenu.ownedOptionIds || []).length >= 1, 'Dynamic DNF option result that opens another choice should preserve both incoming and owned-choice metadata', resultMenu && {role: resultMenu.semanticRole, relatedOptionIds: resultMenu.relatedOptionIds, ownedOptionIds: resultMenu.ownedOptionIds});
  return {
    menuRole: menu.semanticRole,
    ownedOptions: (menu.ownedOptionIds || []).length,
    inlineConditions: (menu.inlineConditions || []).length,
    resultMenuOwnedOptions: resultMenu && (resultMenu.ownedOptionIds || []).length || 0
  };
}

function assertDynamicSectionOwnedOptionEntrypoints(item) {
  const index = item && item.index || {};
  const model = objectCanvasModel.buildExistingCanvas(index, 'events', 'blutmai', {});
  assert(model.ok, 'Dynamic blutmai should open through the existing Event editor', model.changeState && model.changeState.diagnostics);
  const body = model.eventBody || {};
  const actions = body.structureActions || [];
  const sectionAdd = actions.find((field) => {
    return String(field && field.structureAction || '') === 'add_option' &&
      String(field && field.sectionId || '').endsWith('.ban');
  });
  assert(sectionAdd, 'Dynamic blutmai @ban result layer should expose a section-owned add-option entrypoint', actions.map((field) => ({
    id: field && field.id,
    action: field && field.structureAction,
    sectionId: field && field.sectionId
  })).slice(0, 20));
  assert(String(sectionAdd.inputType || '') === 'textarea', 'Section-owned add option should use the same guided option builder surface', sectionAdd);
  assert(/choose-if/i.test(String(sectionAdd.placeholder || '')) && /unavailable/i.test(String(sectionAdd.placeholder || '')), 'Section-owned add option placeholder should advertise optional condition fields', sectionAdd.placeholder);
  const joinOption = (body.options || []).find((option) => String(option && (option.rawTargetId || option.targetId || option.gotoAfter) || '') === 'join');
  assert(joinOption, 'Dynamic blutmai should expose the @join option row', (body.options || []).map((option) => ({
    id: option && option.id,
    targetId: option && option.targetId,
    rawTargetId: option && option.rawTargetId,
    label: option && option.label
  })));
  const conditionText = [
    joinOption.chooseIf,
    joinOption.sectionChooseIf,
    joinOption.sectionViewIf,
    joinOption.unavailableText
  ].filter(Boolean).join(' / ');
  assert(/kpd_relation\s*>=\s*45/.test(conditionText), 'Dynamic blutmai @join target section choose-if should be surfaced as an option condition hint', {conditionText, joinOption});
  const html = previewEditor.render(model, {locale: 'en'});
  assert(html.includes('New option in this section'), 'Existing editor HTML should render section-owned add-option builder text for Dynamic blutmai');
  assert(html.includes('Add to: @ban') && html.includes('title="blutmai.ban"'), 'Dynamic blutmai section-owned add-option builder should show the target section context');
  assert(html.includes('kpd_relation &gt;= 45'), 'Dynamic blutmai @join choose-if should render as a visible condition chip in the editor HTML');
  assert(html.includes('Manual review only; Studio will not change source automatically.'), 'Dynamic existing structural creators should clearly show manual-review safety');
  return {
    sectionAddId: sectionAdd.id,
    sectionId: sectionAdd.sectionId,
    joinCondition: conditionText
  };
}

function assertNoDuplicatePartyNames(row, message) {
  const names = (row && row.parties || []).map((party) => String(party.name || '').trim().toLowerCase()).filter(Boolean);
  const unique = new Set(names);
  assert(unique.size === names.length, message, {id: row && row.id, names});
}

assertGenericCompatibility(summaries);
assertDynamicPressureSample(dynamic);
assertDynamicParserRendererConfidence(dynamic);
assertDynamicSemanticWorkbenchSummary(dynamic);
const dynamicElectionEditing = assertDynamicElectionEditing(dynamicBuilt);
const dynamicInlineCompositeEvent = assertDynamicInlineCompositeEvent(dynamicBuilt);
const dynamicFollowUpMenuSemantics = assertDynamicFollowUpMenuSemantics(dynamicBuilt);
const dynamicSectionOwnedOptionEntrypoints = assertDynamicSectionOwnedOptionEntrypoints(dynamicBuilt);

process.stdout.write(JSON.stringify({
  ok: true,
  dynamicRoot: DYNAMIC_ROOT,
  scope: {
    genericCompatibility: {
      fixtures: summaries.map((item) => item.id),
      assertions: [
        'ProjectIndex builds from source/info.dry',
        'parser/profile detection is non-empty',
        'visible-object coverage has no unsupported rows',
        'visible objects keep complete Studio routing',
        'at least some content remains previewable'
      ]
    },
    dynamicPressureSample: {
      fixture: 'dynamic-mod',
      root: DYNAMIC_ROOT,
      assertions: [
        'SDAAH-style profile detection',
        'large real scene corpus',
        'SDAAH-style monthly popup corpus',
        'source-backed D3 election result screen corpus',
        'selected D3 election result source opens through the existing Event editor'
      ],
      note: 'These assertions are intentionally project-profile specific and should not be read as generic Dendry compatibility guarantees.'
    }
  },
  comparison: summaries.map((item) => ({
    id: item.id,
    project: item.project,
    profiles: item.profiles,
    counts: item.counts,
    coverage: {
      routeCoverage: item.coverage.routeCoverage,
      safeEditCoverage: item.coverage.safeEditCoverage,
      visibleEditableCoverage: item.coverage.visibleEditableCoverage,
      visibleEditActionCoverage: item.coverage.visibleEditActionCoverage,
      semanticEditorCoverage: item.coverage.semanticEditorCoverage,
      structuredRouteEditorCoverage: item.coverage.structuredRouteEditorCoverage,
      effectClauseEditorCoverage: item.coverage.effectClauseEditorCoverage,
      sourceSliceFallbackCount: item.coverage.sourceSliceFallbackCount,
      visibleDisplayOnlyCount: item.coverage.visibleDisplayOnlyCount,
      previewCoverage: item.coverage.previewCoverage,
      unsupportedCount: item.coverage.unsupportedCount,
      goalW: item.coverage.goalW,
      goalX: item.coverage.goalX,
      manualBoundaryCount: item.coverage.manualBoundaryCount,
      bySafety: item.coverage.bySafety
    },
    diagnosticTop: item.diagnostics.top.slice(0, 5)
  })),
  dynamic: {
    diagnostics: dynamic.diagnostics,
    coverage: dynamic.coverage,
    manualSamples: dynamic.manualSamples,
    refusedSamples: dynamic.refusedSamples,
    weakSafeSamples: dynamic.weakSafeSamples,
    electionEditing: dynamicElectionEditing,
    inlineCompositeEvent: dynamicInlineCompositeEvent,
    followUpMenuSemantics: dynamicFollowUpMenuSemantics,
    sectionOwnedOptionEntrypoints: dynamicSectionOwnedOptionEntrypoints,
    gapCandidates: dynamic.gapCandidates,
    parserRendererConfidence: dynamic.parserRendererConfidence,
    dynamicSemanticWorkbench: dynamic.dynamicSemanticWorkbench
  }
}, null, 2) + '\n');
