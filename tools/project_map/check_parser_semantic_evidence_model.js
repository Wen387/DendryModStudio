#!/usr/bin/env node
'use strict';

const confidenceModel = require('./authoring/parser_renderer_confidence_model.js');
const graphModel = require('./authoring/semantic_ownership_graph_model.js');
const workbenchModel = require('./authoring/dynamic_semantic_workbench_model.js');

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

function src(path, line, anchorText) {
  const out = {path, line, startLine: line, endLine: line};
  if (anchorText) {
    out.anchorText = anchorText;
  }
  return out;
}

function scene(id, type, title, path) {
  return {
    id,
    type,
    title,
    path,
    sourceSpan: {path, startLine: 1, endLine: 90},
    topLevelSpan: {path, startLine: 1, endLine: 90},
    options: [],
    sections: [],
    effects: []
  };
}

const routePath = 'source/scenes/events/presidential_election_1932_campaign.scene.dry';
const dynamicPath = 'source/scenes/events/death_of_hindenburg_president.scene.dry';
const monthlyPath = 'source/scenes/events/1929.scene.dry';
const effectLine = 'on-arrival: k_running = 1; k_running = 2';

const index = {
  project: {name: 'Parser Semantic Evidence Fixture', profileIds: ['generic-dendry', 'sdaah-style']},
  scenes: [
    scene('1929', 'event', '1929', monthlyPath),
    scene('presidential_election_1932_campaign', 'event', 'Presidential campaign', routePath),
    scene('death_of_hindenburg_president', 'event', 'Death of Hindenburg', dynamicPath),
    scene('local_election_france', 'event', 'France election', 'source/scenes/events/local_election_france.scene.dry'),
    scene('womens_rights', 'card', "Women's Rights", 'source/scenes/government_affairs/womens_rights.scene.dry')
  ],
  edges: [
    {from: 'presidential_election_1932_campaign', to: 'campaigning_braun', kind: 'conditional_go_to', condition: 'braun_campaign', source: src(routePath, 25)}
  ],
  variables: [
    {name: 'k_running', scope: 'q', reads: [src(dynamicPath, 55)], writes: [src(dynamicPath, 59)], definedIn: [], readCount: 1, writeCount: 1},
    {name: 'abortion_rights', scope: 'q', reads: [src('source/scenes/government_affairs/womens_rights.scene.dry', 59)], writes: [src('source/scenes/government_affairs/womens_rights.scene.dry', 59)], definedIn: [], readCount: 1, writeCount: 1}
  ],
  diagnostics: [],
  semantic: {
    events: [
      {id: '1929', title: '1929'},
      {id: 'presidential_election_1932_campaign', title: 'Presidential campaign'},
      {id: 'death_of_hindenburg_president', title: 'Death of Hindenburg'},
      {id: 'local_election_france', title: 'France election'}
    ],
    cards: [{id: 'womens_rights', title: "Women's Rights"}],
    news: {
      eventPopups: [{
        linkedSceneId: '1929',
        title: '1929',
        router: {tag: 'event', anchor: 'events_choice', path: 'source/scenes/post_event.scene.dry', line: 5205},
        excerptSource: src(monthlyPath, 13)
      }]
    },
    textCorpus: {
      items: [
        text('1929', 'body', 'A new year begins.', monthlyPath, 13),
        text('presidential_election_1932_campaign', 'body', 'Campaign text.', routePath, 12),
        text('death_of_hindenburg_president', 'body', 'Hindenburg text.', dynamicPath, 12)
      ]
    },
    electionResults: {items: [{id: 'local_election_france', sceneId: 'local_election_france', chartElementId: 'france_chamber', usesD3Parliament: true, path: 'source/scenes/events/local_election_france.scene.dry', line: 61, parties: [{key: 'sfio'}]}]},
    runtimeSurface: {readiness: {status: 'partial', quickPreviewReady: false, missingDependencyCount: 2}, diagnostics: []},
    parserEvidence: {
      kind: 'parser_semantic_evidence',
      routeOrderGroups: [{
        id: 'route_order_fixture',
        sceneId: 'presidential_election_1932_campaign',
        ownerId: 'presidential_election_1932_campaign',
        routeField: 'goTo',
        chainContext: 'ordered_chain',
        source: src(routePath, 25),
        parserBacked: true,
        installSafety: 'manual_review',
        clauses: [
          {order: 1, rawTarget: 'campaigning_braun', resolvedTarget: 'presidential_election_1932_campaign.campaigning_braun', targetResolved: true, predicate: 'braun_campaign', isFallback: false},
          {order: 2, rawTarget: 'campaigning_fallback', resolvedTarget: 'presidential_election_1932_campaign.campaigning_fallback', targetResolved: true, predicate: '', isFallback: true}
        ]
      }],
      dynamicKeyEvidence: [
        {
          id: 'dynamic_q_manual_fixture',
          expression: "k + '_running'",
          accessKind: 'write',
          classification: 'dynamic_concatenation',
          source: src(dynamicPath, 55),
          safeExpansion: false,
          expandedKeys: [],
          bindingSources: [{name: 'k', kind: 'unresolved_identifier', valueCount: 0}],
          reviewBoundary: 'manual_review',
          installSafety: 'manual_review'
        },
        {
          id: 'dynamic_q_safe_fixture',
          expression: "party + '_running'",
          accessKind: 'read',
          classification: 'dynamic_concatenation',
          source: src(dynamicPath, 56),
          safeExpansion: true,
          expandedKeys: ['spd_running', 'z_running'],
          expandedKeyCount: 2,
          bindingSources: [{name: 'party', kind: 'known_array', valueCount: 2}],
          reviewBoundary: 'guarded_candidate',
          installSafety: 'guarded_candidate'
        }
      ],
      effectClauses: [
        {id: 'effect_clause_manual_a', sceneId: 'death_of_hindenburg_president', ownerId: 'death_of_hindenburg_president', variable: 'k_running', op: '=', value: '1', hook: 'on-arrival', sourceExpression: 'k_running = 1', clauseOrder: 1, lineEffectCount: 2, sharedLineGroupId: 'effect_line_fixture', tokenUniqueOnLine: false, installSafety: 'manual_review', source: src(dynamicPath, 59, effectLine)},
        {id: 'effect_clause_guarded_b', sceneId: 'death_of_hindenburg_president', ownerId: 'death_of_hindenburg_president', variable: 'k_running', op: '=', value: '2', hook: 'on-arrival', sourceExpression: 'k_running = 2', clauseOrder: 2, lineEffectCount: 2, sharedLineGroupId: 'effect_line_fixture', tokenUniqueOnLine: true, installSafety: 'guarded_candidate', source: src(dynamicPath, 59, effectLine)}
      ],
      monthlyPopupRouterTable: [{
        id: 'monthly_popup_router_1929',
        linkedSceneId: '1929',
        title: '1929',
        viewIf: 'year = 1929 and month = 1',
        router: {tag: 'event', anchor: 'events_choice', source: src('source/scenes/post_event.scene.dry', 5205)},
        contentSource: src(monthlyPath, 13),
        installSafety: 'manual_review',
        reviewBoundary: 'manual_review'
      }]
    }
  }
};

function text(sceneId, role, value, path, line) {
  return {id: 'text:' + sceneId + ':' + role, role, text: value, owner: {kind: 'scene', sceneId}, source: src(path, line, value)};
}

const confidence = confidenceModel.buildConfidenceReport(index, {sampleLimit: 4});
assert(confidence.routeOrder.structuredGroupCount === 1, 'confidence should use structured route groups', confidence.routeOrder);
assert(confidence.routeOrder.samples[0].clauses[0].predicate === 'braun_campaign', 'route sample should expose parser-backed predicates', confidence.routeOrder.samples);
assert(confidence.dynamicQ.structuredEvidenceCount === 2, 'confidence should count all dynamic key evidence', confidence.dynamicQ);
assert(confidence.dynamicQ.count === 1 && confidence.dynamicQ.safeExpansionCount === 1, 'dynamic Q should separate manual and safe expansion evidence', confidence.dynamicQ);
assert(confidence.monthlyPopups.routerTableCount === 1, 'monthly confidence should use router table evidence', confidence.monthlyPopups);
assert(confidence.sharedEffects.clauseCount === 2 && confidence.sharedEffects.guardedCandidateCount === 1, 'effect confidence should expose clause-level safety', confidence.sharedEffects);

const graph = graphModel.buildSemanticOwnershipGraph(index, {sampleLimit: 4});
const packages = Object.fromEntries(graph.manualBoundaryPackages.map((item) => [item.id, item]));
assert(packages.route_order.rowCount === 1 && packages.route_order.evidence.routeOrderGroups.length === 1, 'route package should carry route groups', packages.route_order);
assert(packages.dynamic_q.rowCount === 1 && packages.dynamic_q.evidence.dynamicKeyEvidence.length === 1, 'dynamic package should carry manual key evidence', packages.dynamic_q);
assert(packages.monthly_popup_router.evidence.routerTable.length === 1, 'monthly package should carry router table rows', packages.monthly_popup_router);
assert(graph.rows.find((row) => row.workflowId === 'monthly_popup_1929').reviewEvidence.routerTableEntry.linkedSceneId === '1929', 'monthly workflow should link router table entry', graph.rows);

const workbench = workbenchModel.buildDynamicSemanticWorkbench(index, {sampleLimit: 4});
const routeWorkflow = workbench.workflows.find((row) => row.id === 'route_order_presidential_1932');
const dynamicWorkflow = workbench.workflows.find((row) => row.id === 'dynamic_q_hindenburg_president');
const monthlyWorkflow = workbench.workflows.find((row) => row.id === 'monthly_popup_1929');
assert(routeWorkflow.sections.routes.routeOrderGroups[0].parserBacked, 'workbench should render parser-backed route groups', routeWorkflow.sections.routes);
assert(dynamicWorkflow.sections.effects.dynamicQ.structuredEvidenceCount === 1, 'workbench should render manual dynamic Q evidence', dynamicWorkflow.sections.effects.dynamicQ);
assert(dynamicWorkflow.sections.effects.effectClauses.count === 2, 'workbench should render effect clauses for the owner scene', dynamicWorkflow.sections.effects.effectClauses);
assert(monthlyWorkflow.sections.routes.routerTableEntry.linkedSceneId === '1929', 'workbench should render monthly router table entry', monthlyWorkflow.sections.routes);

process.stdout.write(JSON.stringify({
  ok: true,
  confidence: confidence.summary,
  packages: graph.manualBoundaryPackages.map((item) => ({id: item.id, rowCount: item.rowCount})),
  workbench: workbench.summary
}, null, 2) + '\n');
