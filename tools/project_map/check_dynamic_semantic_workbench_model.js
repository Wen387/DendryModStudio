#!/usr/bin/env node
// @ts-check
'use strict';

const fs = require('fs');
const workbenchModel = require('./authoring/dynamic_semantic_workbench_model.js');

const {fail, assert} = require('./check_harness.js');

function syntheticIndex() {
  // Keep this fixture local to the check so the model stays independent from
  // private DynamicSDAAH data in public CI.
  return {
    schemaVersion: '0.1',
    project: {name: 'Dynamic Semantic Workbench Fixture', root: '/tmp/dynamic-semantic-workbench-fixture', profileIds: ['generic-dendry', 'sdaah-style']},
    scenes: [
      scene('1929', 'event', '1929', 'source/scenes/events/1929.scene.dry', 1, 14, 'year = 1929 and month = 1', [{variable: 'economic_growth', op: '+=', value: '-1', source: {path: 'source/scenes/events/1929.scene.dry', line: 5}}]),
      scene('presidential_election_1932_campaign', 'event', 'Presidential Election campaigning', 'source/scenes/events/presidential_election_1932_campaign.scene.dry', 1, 60, 'year = 1932 and month >= 2', [{variable: 'campaigning_count', op: '+=', value: '1', source: {path: 'source/scenes/events/presidential_election_1932_campaign.scene.dry', line: 12}}]),
      scene('death_of_hindenburg_president', 'event', 'The Death of Hindenburg', 'source/scenes/events/death_of_hindenburg_president.scene.dry', 1, 90, 'year = 1934 and month >= 7', [{variable: 'k_running', op: '=', value: '1', source: {path: 'source/scenes/events/death_of_hindenburg_president.scene.dry', line: 55}}]),
      scene('local_election_france', 'event', '1932 French Legislative Elections', 'source/scenes/events/local_election_france.scene.dry', 1, 120, 'year == 1932 and month == 5', [{variable: 'france_left_seen', op: '=', value: '1', source: {path: 'source/scenes/events/local_election_france.scene.dry', line: 5}}]),
      scene('womens_rights', 'card', "Women's Rights", 'source/scenes/government_affairs/womens_rights.scene.dry', 1, 80, '', [{variable: 'abortion_rights', op: '+=', value: '1', source: {path: 'source/scenes/government_affairs/womens_rights.scene.dry', line: 59}}])
    ],
    edges: [
      {from: 'presidential_election_1932_campaign', to: 'campaigning_braun', kind: 'goto', condition: 'braun_campaign', source: {path: 'source/scenes/events/presidential_election_1932_campaign.scene.dry', line: 25}},
      {from: 'presidential_election_1932_campaign', to: 'campaigning_rosenfeld', kind: 'goto', condition: 'rosenfeld_campaign', source: {path: 'source/scenes/events/presidential_election_1932_campaign.scene.dry', line: 25}},
      {from: 'death_of_hindenburg_president', to: 'r1_menu', kind: 'goto', condition: 'round = 0', source: {path: 'source/scenes/events/death_of_hindenburg_president.scene.dry', line: 70}}
    ],
    variables: [
      variable('economic_growth', [{path: 'source/scenes/events/1929.scene.dry', line: 5}], [{path: 'source/scenes/events/1929.scene.dry', line: 5}], []),
      variable('campaigning_count', [{path: 'source/scenes/events/presidential_election_1932_campaign.scene.dry', line: 25}], [{path: 'source/scenes/events/presidential_election_1932_campaign.scene.dry', line: 12}], []),
      variable('k_running', [{path: 'source/scenes/events/death_of_hindenburg_president.scene.dry', line: 55}], [], []),
      variable('france_left_seen', [{path: 'source/scenes/events/local_election_france.scene.dry', line: 10}], [{path: 'source/scenes/events/local_election_france.scene.dry', line: 5}], []),
      variable('abortion_rights', [{path: 'source/scenes/events/center_party_conference_joos.scene.dry', line: 3}, {path: 'source/scenes/government_affairs/womens_rights.scene.dry', line: 59}], [{path: 'source/scenes/government_affairs/womens_rights.scene.dry', line: 59}], [])
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
          linkedSceneId: '1929',
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
          text('local_election_france', 'body', 'French results:', 'source/scenes/events/local_election_france.scene.dry', 40),
          text('womens_rights', 'body', 'Expand rights.', 'source/scenes/government_affairs/womens_rights.scene.dry', 20)
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
          parties: [{key: 'sfio', name: 'SFIO', source: {path: 'source/scenes/events/local_election_france.scene.dry', line: 65}}]
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

function scene(id, type, title, path, startLine, endLine, viewIf, effects) {
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
    effects: effects || []
  };
}

function text(sceneId, role, value, path, line) {
  return {
    id: 'text:' + sceneId + ':' + role + ':' + line,
    role,
    text: value,
    source: {path, line, startLine: line, endLine: line, anchorText: value},
    owner: {kind: 'scene', sceneId, sceneType: sceneId === 'womens_rights' ? 'card' : 'event'},
    conditions: []
  };
}

function variable(name, reads, writes, definedIn) {
  return {name, scope: 'q', reads, writes, definedIn, readCount: reads.length, writeCount: writes.length};
}

function runAssertions(index, dynamicChecked) {
  const model = workbenchModel.buildDynamicSemanticWorkbench(index, {sampleLimit: 4});
  assert(model.kind === 'dynamic_semantic_workbench', 'workbench should expose its kind', model);
  assert(model.summary.workflowCount === 5, 'workbench should contain five fixed workflows', model.summary);
  assert(model.summary.readyWorkflowCount === 5, 'all workflows should be ready', model.summary);
  model.workflows.forEach((workflow) => {
    ['playerText', 'routes', 'conditions', 'effects', 'variables', 'runtimeEvidence', 'manualBoundaries', 'reviewApplyReadiness'].forEach((section) => {
      assert(workflow.sections[section] && workflow.sections[section].status === 'ready', workflow.id + ' should expose section ' + section, workflow.sections);
    });
  });
  const monthly = workflow(model, 'monthly_popup_1929');
  assert(monthly.sections.routes.routerBoundary && monthly.sections.routes.installSafety === 'advanced_apply', 'monthly popup should expose advanced router apply boundary', monthly.sections.routes);
  const route = workflow(model, 'route_order_presidential_1932');
  assert(route.sections.routes.routeOrderSensitiveCount > 0, 'route-heavy workflow should expose route-order count', route.sections.routes);
  assert(route.sections.routes.routeOrderSamples[0].routes[0].predicate, 'route-order sample should parse predicates', route.sections.routes.routeOrderSamples);
  assert(route.sections.routes.routeStateSummary.routeStateCount >= 1, 'route-heavy workflow should expose structured route-state summary', route.sections.routes.routeStateSummary);
  assert(route.sections.routes.routeStates[0].candidates[0].predicateStatus, 'route state candidates should include predicate parse status', route.sections.routes.routeStates);
  assert(route.sections.routes.routeStates[0].runtimeSemantics && route.sections.routes.routeStates[0].runtimeSemantics.selectionMode, 'route states should expose runtime route selection semantics', route.sections.routes.routeStates);
  const dynamicQ = workflow(model, 'dynamic_q_hindenburg_president');
  assert(dynamicQ.sections.effects.dynamicQ.count > 0, 'dynamic Q workflow should expose dynamic Q section', dynamicQ.sections.effects.dynamicQ);
  assert(dynamicQ.sections.effects.dynamicQ.samples[0].classification === 'dynamic_concatenation', 'dynamic Q sample should preserve classification', dynamicQ.sections.effects.dynamicQ.samples);
  assert(dynamicQ.sections.effects.dynamicQ.samples[0].affectedVariables.length > 0, 'dynamic Q sample should include affected variable candidates', dynamicQ.sections.effects.dynamicQ.samples[0]);
  const election = workflow(model, 'election_d3_local_france');
  assert(election.sections.runtimeEvidence.electionResult.chartElementId === 'france_chamber', 'election workflow should expose D3 chart evidence', election.sections.runtimeEvidence);
  assert(election.sections.reviewApplyReadiness.nextAction.includes('Runtime Lens'), 'election workflow should name Runtime Lens readiness', election.sections.reviewApplyReadiness);
  const variableWorkflow = workflow(model, 'variable_abortion_rights');
  assert(variableWorkflow.sections.variables.categories.includes('write-backed'), 'variable workflow should classify writes', variableWorkflow.sections.variables);
  assert(variableWorkflow.sections.effects.writeCount > 0, 'variable workflow should expose writes/effects', variableWorkflow.sections.effects);
  assert(variableWorkflow.sections.reviewApplyReadiness.installSafety === 'advanced_apply', 'existing variable should remain editable through advanced apply', variableWorkflow.sections.reviewApplyReadiness);
  if (dynamicChecked) {
    assert(route.sections.playerText.count >= 200, 'Dynamic presidential workflow should expose large player-text context', route.sections.playerText);
    assert(route.sections.routes.routeOrderGroups.length >= 1 && route.sections.routes.routeOrderGroups[0].parserBacked, 'Dynamic presidential workflow should render parser-backed route-order groups', route.sections.routes.routeOrderGroups);
    assert(route.sections.routes.routeStateSummary.predicateRouteCount >= 1, 'Dynamic presidential workflow should render predicate route-state count', route.sections.routes.routeStateSummary);
    assert(dynamicQ.sections.effects.dynamicQ.count === 12, 'Dynamic Hindenburg workflow should expose 12 dynamic Q diagnostics', dynamicQ.sections.effects.dynamicQ);
    assert(dynamicQ.sections.effects.dynamicQ.structuredEvidenceCount === 12, 'Dynamic Hindenburg workflow should render structured manual dynamic Q evidence', dynamicQ.sections.effects.dynamicQ);
    assert(dynamicQ.sections.effects.effectClauses.count > 0, 'Dynamic Hindenburg workflow should render parser-backed effect clauses', dynamicQ.sections.effects.effectClauses);
    assert(monthly.sections.routes.routerTableEntry && monthly.sections.routes.routerTableEntry.linkedSceneId === '1929', 'Dynamic monthly popup workflow should render router table evidence', monthly.sections.routes);
    assert(election.sections.runtimeEvidence.electionResult.partyCount >= 10, 'Dynamic election workflow should expose D3 party rows', election.sections.runtimeEvidence.electionResult);
    assert(variableWorkflow.sections.variables.readCount === 9 && variableWorkflow.sections.variables.writeCount === 1, 'Dynamic abortion_rights workflow should preserve read/write counts', variableWorkflow.sections.variables);
  }
  return model;
}

function workflow(model, id) {
  const found = model.workflows.find((item) => item.id === id);
  assert(found, 'missing workflow ' + id, model.workflows.map((item) => item.id));
  return found;
}

const synthetic = runAssertions(syntheticIndex(), false);
let dynamic = {dynamicChecked: false};
const dynamicIndexPath = process.env.DMS_GOAL_AB_DYNAMIC_INDEX || '';
if (dynamicIndexPath) {
  assert(fs.existsSync(dynamicIndexPath), 'DMS_GOAL_AB_DYNAMIC_INDEX should point at a readable ProjectIndex', {dynamicIndexPath});
  const dynamicModel = runAssertions(JSON.parse(fs.readFileSync(dynamicIndexPath, 'utf8')), true);
  dynamic = {
    dynamicChecked: true,
    summary: dynamicModel.summary,
    packages: dynamicModel.manualBoundaryPackages.map((item) => ({id: item.id, rowCount: item.rowCount, installSafety: item.installSafety}))
  };
}

process.stdout.write(JSON.stringify({
  ok: true,
  synthetic: {
    summary: synthetic.summary,
    packages: synthetic.manualBoundaryPackages.map((item) => ({id: item.id, rowCount: item.rowCount, installSafety: item.installSafety}))
  },
  dynamic
}, null, 2) + '\n');
