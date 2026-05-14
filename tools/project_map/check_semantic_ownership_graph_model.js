#!/usr/bin/env node
'use strict';

const fs = require('fs');
const graphModel = require('./authoring/semantic_ownership_graph_model.js');
const confidenceModel = require('./authoring/parser_renderer_confidence_model.js');

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

function syntheticIndex() {
  return {
    schemaVersion: '0.1',
    project: {name: 'Semantic Ownership Fixture', root: '/tmp/semantic-ownership-fixture', profileIds: ['generic-dendry', 'sdaah-style']},
    scenes: [
      scene('1929', 'event', '1929', 'source/scenes/events/1929.scene.dry', 1, 14, 'year = 1929 and month = 1'),
      scene('presidential_election_1932_campaign', 'event', 'Presidential Election campaigning', 'source/scenes/events/presidential_election_1932_campaign.scene.dry', 1, 40, 'year = 1932 and month >= 2'),
      scene('death_of_hindenburg_president', 'event', 'The Death of Hindenburg', 'source/scenes/events/death_of_hindenburg_president.scene.dry', 1, 80, 'year = 1934 and month >= 7'),
      scene('local_election_france', 'event', '1932 French Legislative Elections', 'source/scenes/events/local_election_france.scene.dry', 1, 90, 'year == 1932 and month == 5'),
      scene('womens_rights', 'card', "Women's Rights", 'source/scenes/government_affairs/womens_rights.scene.dry', 1, 70, '')
    ],
    edges: [
      {from: 'presidential_election_1932_campaign', to: 'campaigning_braun', kind: 'goto', condition: 'braun_campaign', source: {path: 'source/scenes/events/presidential_election_1932_campaign.scene.dry', line: 25}},
      {from: 'death_of_hindenburg_president', to: 'r1_menu', kind: 'goto', condition: 'round = 0', source: {path: 'source/scenes/events/death_of_hindenburg_president.scene.dry', line: 44}}
    ],
    variables: [
      {
        name: 'abortion_rights',
        scope: 'q',
        reads: [
          {path: 'source/scenes/events/center_party_conference_joos.scene.dry', line: 3},
          {path: 'source/scenes/government_affairs/womens_rights.scene.dry', line: 59}
        ],
        writes: [{path: 'source/scenes/government_affairs/womens_rights.scene.dry', line: 59}],
        definedIn: [],
        readCount: 2,
        writeCount: 1
      },
      {name: 'k_running', scope: 'q', reads: [{path: 'source/scenes/events/death_of_hindenburg_president.scene.dry', line: 55}], writes: [], definedIn: [], readCount: 1, writeCount: 0},
      {name: 'year', scope: 'q', reads: [{path: 'source/scenes/root.scene.dry', line: 38}], writes: [], definedIn: [{path: 'source/scenes/root.scene.dry', line: 38}], readCount: 1, writeCount: 0}
    ],
    diagnostics: [
      {
        severity: 'info',
        code: 'project_map.conditional_goto',
        sceneId: 'presidential_election_1932_campaign',
        path: 'source/scenes/events/presidential_election_1932_campaign.scene.dry',
        source: {path: 'source/scenes/events/presidential_election_1932_campaign.scene.dry', line: 25},
        message: 'Conditional or chained goTo requires runtime ordering awareness: campaigning_braun if braun_campaign; campaigning_rosenfeld if rosenfeld_campaign'
      },
      {
        severity: 'info',
        code: 'project_map.dynamic_q_opaque',
        path: 'source/scenes/events/death_of_hindenburg_president.scene.dry',
        source: {path: 'source/scenes/events/death_of_hindenburg_president.scene.dry', line: 55},
        message: "Dynamic Q[] key could not be statically expanded: Q[k + '_running']",
        expression: "k + '_running'",
        classification: 'dynamic_concatenation',
        reviewBoundary: 'manual_review',
        safeExpansion: false
      }
    ],
    semantic: {
      events: [
        {id: '1929', title: '1929'},
        {id: 'presidential_election_1932_campaign', title: 'Presidential Election campaigning'},
        {id: 'death_of_hindenburg_president', title: 'The Death of Hindenburg'},
        {id: 'local_election_france', title: '1932 French Legislative Elections'}
      ],
      cards: [{id: 'womens_rights', title: "Women's Rights"}],
      news: {
        items: [],
        eventPopups: [{
          delivery: 'legacy_event_popup',
          title: '1929',
          headline: '1929',
          linkedSceneId: '1929',
          viewIf: 'year = 1929 and month = 1',
          router: {tag: 'event', anchor: 'events_choice', path: 'source/scenes/post_event.scene.dry', line: 5205},
          source: {path: 'source/scenes/events/1929.scene.dry', line: 8},
          excerptSource: {path: 'source/scenes/events/1929.scene.dry', line: 13}
        }]
      },
      textCorpus: {
        items: [
          text('1929', 'title', '1929', 'source/scenes/events/1929.scene.dry', 1),
          text('1929', 'body', 'A new year begins.', 'source/scenes/events/1929.scene.dry', 13),
          text('presidential_election_1932_campaign', 'body', 'Campaign text.', 'source/scenes/events/presidential_election_1932_campaign.scene.dry', 12),
          text('death_of_hindenburg_president', 'body', 'A presidential crisis begins.', 'source/scenes/events/death_of_hindenburg_president.scene.dry', 12),
          text('local_election_france', 'body', 'French results:', 'source/scenes/events/local_election_france.scene.dry', 40)
        ]
      },
      surfaceText: {items: [{id: 'runtime:title', label: 'Generated title', source: {path: 'out/html/index.html', line: 1}}]},
      electionResults: {
        items: [{
          id: 'local_election_france',
          sceneId: 'local_election_france',
          title: '1932 French Legislative Elections',
          path: 'source/scenes/events/local_election_france.scene.dry',
          line: 61,
          chartElementId: 'france_chamber',
          usesD3Parliament: true,
          parties: [{key: 'sfio', name: 'SFIO', source: {path: 'source/scenes/events/local_election_france.scene.dry', line: 65}}],
          confidence: 'static_inferred'
        }]
      },
      runtimeSurface: {
        readiness: {status: 'partial', quickPreviewReady: false, missingDependencyCount: 2},
        diagnostics: [
          {severity: 'error', code: 'runtime_surface.missing_script', missingPath: 'out/html/core.js', message: 'Runtime HTML references missing script out/html/core.js.'}
        ]
      }
    }
  };
}

function scene(id, type, title, path, startLine, endLine, viewIf) {
  return {
    id,
    type,
    title,
    path,
    viewIf,
    sourceSpan: {path, startLine, endLine},
    topLevelSpan: {path, startLine, endLine},
    options: [],
    sections: [],
    effects: []
  };
}

function text(sceneId, role, value, path, line) {
  return {
    id: 'text:' + sceneId + ':' + role + ':' + line,
    role,
    text: value,
    source: {path, line, startLine: line, endLine: line, anchorText: value},
    owner: {kind: 'scene', sceneId, sceneType: 'event'},
    conditions: []
  };
}

function coverageFixture() {
  return {
    rows: [
      coverageRow('news:1929', 'news', 'monthly_popup', 'monthly_popup', '1929', 'object_workspace', 'advanced_apply', 'source/scenes/events/1929.scene.dry', 'This monthly popup is backed by an event scene.'),
      coverageRow('events:presidential_election_1932_campaign', 'events', 'event', 'object', 'Presidential Election campaigning', 'object_workspace', 'advanced_apply', 'source/scenes/events/presidential_election_1932_campaign.scene.dry', 'Open Event Workbench.'),
      coverageRow('events:death_of_hindenburg_president', 'events', 'event', 'object', 'The Death of Hindenburg', 'object_workspace', 'advanced_apply', 'source/scenes/events/death_of_hindenburg_president.scene.dry', 'Open Event Workbench.'),
      coverageRow('events:local_election_france', 'events', 'event', 'object', '1932 French Legislative Elections', 'object_workspace', 'advanced_apply', 'source/scenes/events/local_election_france.scene.dry', 'Open Event Workbench.'),
      coverageRow('variable:abortion_rights', 'variables', 'variable', 'variable_definition', 'abortion_rights', 'variable_workspace', 'advanced_apply', 'source/scenes/government_affairs/womens_rights.scene.dry', 'Existing variable uses impact preview.'),
      coverageRow('surface:runtime:title', 'surfaceText', 'surface_text', 'surface_label', 'Generated title', 'advanced_source_patch', 'advanced_apply', 'out/html/index.html', 'Generated runtime output needs source mapping.')
    ],
    summary: {routeCoverage: 1, unsupportedCount: 0}
  };
}

function coverageRow(id, view, objectType, role, label, routeClass, installSafety, path, reason) {
  return {
    id,
    view,
    objectType,
    role,
    label,
    routeClass,
    installSafety,
    manualBoundary: installSafety === 'manual_review' || installSafety === 'refused',
    source: {path, line: 1},
    target: {sceneId: id.split(':')[1] || '', source: {path, line: 1}},
    reason
  };
}

function runSyntheticAssertions() {
  const index = syntheticIndex();
  const confidence = confidenceModel.buildConfidenceReport(index, {sampleLimit: 4});
  const graph = graphModel.buildSemanticOwnershipGraph(index, {
    coverage: coverageFixture(),
    confidence,
    sampleLimit: 4
  });
  assert(graph.kind === 'semantic_ownership_graph', 'graph should expose its kind', graph);
  assert(graph.summary.workflowCount === 5 && graph.rows.length === 5, 'graph should produce one ownership row for each fixed workflow', graph.summary);
  const monthly = row(graph, 'monthly_popup_1929');
  assert(monthly.reviewEvidence.routerBoundary.path === 'source/scenes/post_event.scene.dry', 'monthly popup should retain router boundary evidence', monthly);
  assert(monthly.installSafety === 'advanced_apply', 'monthly popup router should use advanced apply', monthly);
  const route = row(graph, 'route_order_presidential_1932');
  assert(route.reviewEvidence.routeOrderSensitiveCount === 1, 'route workflow should expose route-order diagnostic count', route.reviewEvidence);
  const dynamicQ = row(graph, 'dynamic_q_hindenburg_president');
  assert(dynamicQ.reviewEvidence.dynamicQCount === 1, 'dynamic Q workflow should expose dynamic Q count', dynamicQ.reviewEvidence);
  assert(dynamicQ.reviewEvidence.dynamicQClassifications.dynamic_concatenation === 1, 'dynamic Q workflow should preserve classifications', dynamicQ.reviewEvidence);
  const election = row(graph, 'election_d3_local_france');
  assert(election.reviewEvidence.electionResult.chartElementId === 'france_chamber', 'election workflow should link chart element evidence', election.reviewEvidence);
  assert(election.editorRoute.entrypoints.includes('runtime_lens'), 'election route should include Runtime Lens entrypoint', election.editorRoute);
  const variable = row(graph, 'variable_abortion_rights');
  assert(variable.reviewEvidence.categories.includes('write-backed'), 'variable workflow should classify write-backed provenance', variable.reviewEvidence);
  assert(variable.reviewEvidence.categories.includes('advanced-review'), 'variable workflow should use advanced review as impact preview', variable.reviewEvidence);
  const packages = Object.fromEntries(graph.manualBoundaryPackages.map((item) => [item.id, item]));
  ['route_order', 'dynamic_q', 'monthly_popup_router', 'variable_provenance', 'protected_output'].forEach((id) => {
    assert(packages[id], 'manual boundary package should exist: ' + id, graph.manualBoundaryPackages);
  });
  assert(packages.protected_output.installSafety === 'advanced_apply' || packages.protected_output.rowCount === 0, 'protected output package should not preserve refused visible rows', packages.protected_output);
  return graph;
}

function row(graph, workflowId) {
  const found = graph.rows.find((item) => item.workflowId === workflowId);
  assert(found, 'missing graph row for workflow ' + workflowId, graph.rows);
  return found;
}

function runDynamicAssertionsIfRequested() {
  const filePath = process.env.DMS_GOAL_AB_DYNAMIC_INDEX || '';
  if (!filePath) {
    return {dynamicChecked: false};
  }
  assert(fs.existsSync(filePath), 'DMS_GOAL_AB_DYNAMIC_INDEX should point at a readable ProjectIndex', {filePath});
  const index = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const graph = graphModel.buildSemanticOwnershipGraph(index, {sampleLimit: 4});
  const packages = Object.fromEntries(graph.manualBoundaryPackages.map((item) => [item.id, item]));
  assert(graph.summary.workflowCount === 5 && graph.summary.manualReviewRowCount === 0, 'Dynamic graph should cover all five workflows without visible manual-review rows', graph.summary);
  assert(packages.route_order.rowCount === 332, 'Dynamic route-order package should preserve baseline count', packages.route_order);
  assert(packages.dynamic_q.rowCount === 77, 'Dynamic Q package should preserve baseline count', packages.dynamic_q);
  assert(packages.monthly_popup_router.rowCount === 348, 'Dynamic monthly popup package should preserve baseline count', packages.monthly_popup_router);
  assert(packages.variable_provenance.rowCount === 3553, 'Dynamic variable provenance package should summarize all variables', packages.variable_provenance);
  assert(packages.protected_output.rowCount === 0, 'Dynamic protected output package should not preserve refused visible rows', packages.protected_output);
  assert(row(graph, 'dynamic_q_hindenburg_president').reviewEvidence.dynamicQCount === 12, 'Dynamic Hindenburg sample should expose its dynamic Q diagnostics', row(graph, 'dynamic_q_hindenburg_president').reviewEvidence);
  assert(row(graph, 'dynamic_q_hindenburg_president').reviewEvidence.dynamicKeyEvidence.length > 0, 'Dynamic Hindenburg sample should expose structured dynamic Q evidence', row(graph, 'dynamic_q_hindenburg_president').reviewEvidence);
  assert(row(graph, 'route_order_presidential_1932').reviewEvidence.routeOrderSensitiveCount >= 7, 'Dynamic presidential campaign should expose route-order diagnostics', row(graph, 'route_order_presidential_1932').reviewEvidence);
  assert(row(graph, 'route_order_presidential_1932').reviewEvidence.routeOrderGroups.length > 0, 'Dynamic presidential campaign should expose sampled structured route-order groups', row(graph, 'route_order_presidential_1932').reviewEvidence);
  return {dynamicChecked: true, summary: graph.summary, packages: graph.manualBoundaryPackages.map((item) => ({id: item.id, rowCount: item.rowCount}))};
}

const synthetic = runSyntheticAssertions();
const dynamic = runDynamicAssertionsIfRequested();
process.stdout.write(JSON.stringify({
  ok: true,
  synthetic: {
    summary: synthetic.summary,
    packages: synthetic.manualBoundaryPackages.map((item) => ({id: item.id, rowCount: item.rowCount, installSafety: item.installSafety}))
  },
  dynamic
}, null, 2) + '\n');
