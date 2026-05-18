#!/usr/bin/env node
// @ts-check
'use strict';

const routeState = require('./authoring/route_state_model.js');
const fs = require('fs');
const path = require('path');
const eventWorkbench = require('./authoring/event_workbench_model.js');
const eventWorkbenchUi = require('./viewer/event_workbench_ui.js');

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

function src(path, line) {
  return {path, line, startLine: line, endLine: line};
}

const electionPath = 'source/scenes/events/election_1928.scene.dry';
const centerPath = 'source/scenes/events/center_party_conference.scene.dry';

const index = {
  schemaVersion: '0.1',
  project: {name: 'Route State Fixture', profileIds: ['generic-dendry', 'sdaah-style']},
  scenes: [
    {
      id: 'election_1928',
      title: 'Reichstag Elections',
      type: 'event',
      path: electionPath,
      viewIf: '(year = next_election_year and month >= next_election_month) or (year > next_election_year)',
      sourceSpan: src(electionPath, 1),
      topLevelSpan: {path: electionPath, startLine: 1, endLine: 16},
      metadata: {viewIf: src(electionPath, 5), setJump: src(electionPath, 8)},
      routes: {setJump: [{id: 'post_election_1928', raw: 'post_election_1928'}]},
      options: [
        {id: '@election_algorithm', title: 'May we do our best...', sourceSpan: src(electionPath, 17)}
      ],
      sections: [
        {
          id: 'election_1928.cancel_elections',
          title: 'Cancel elections',
          viewIf: 'in_emergency_government == 1 and president_ideology == "Left" and not presidential_powers',
          sourceSpan: {path: electionPath, startLine: 22, endLine: 33},
          metadata: {viewIf: src(electionPath, 25)},
          routes: {},
          options: []
        }
      ]
    },
    {
      id: 'center_party_conference',
      title: 'Center Party Conference',
      type: 'event',
      path: centerPath,
      viewIf: 'year = 1928 and month = 12 and z_leader = "Marx"',
      sourceSpan: {path: centerPath, startLine: 1, endLine: 90},
      topLevelSpan: {path: centerPath, startLine: 1, endLine: 26},
      metadata: {viewIf: src(centerPath, 5)},
      routes: {
        goTo: [
          {id: 'joos', raw: 'joos if Q.z_relation >= 70', predicate: 'Q.z_relation >= 70'},
          {id: 'kaas', raw: 'kaas'}
        ],
        goToRef: [
          {id: 'next_event_quality', raw: 'next_event_quality if Q.route_flag', predicate: 'Q.route_flag'}
        ]
      },
      options: [
        {id: '@kaas', title: 'Aufhauser', sourceSpan: src(centerPath, 27)}
      ],
      sections: [
        {
          id: 'center_party_conference.joos_campaign',
          title: 'Joos campaign',
          chooseIf: 'z_relation >= 60 and resources >= 1',
          unavailableSubtitle: 'We need resources.',
          sourceSpan: {path: centerPath, startLine: 74, endLine: 83},
          metadata: {chooseIf: src(centerPath, 75), unavailableSubtitle: src(centerPath, 76)},
          routes: {},
          options: []
        }
      ]
    },
    {id: 'election_algorithm', title: 'Election Algorithm', type: 'event', path: 'source/scenes/election_algorithm.scene.dry', sections: [], options: []}
  ],
  edges: [
    {from: 'election_1928', to: 'post_election_1928', kind: 'set_jump', rawTarget: 'post_election_1928', source: src(electionPath, 8), confidence: 'exact'},
    {from: 'election_1928', to: 'election_algorithm', kind: 'choice', rawTarget: '@election_algorithm', source: src(electionPath, 17), confidence: 'exact'},
    {from: 'center_party_conference', to: 'center_party_conference.joos', kind: 'conditional_go_to', rawTarget: 'joos', condition: 'Q.z_relation >= 70', source: src(centerPath, 8), confidence: 'exact'},
    {from: 'center_party_conference', to: 'center_party_conference.kaas', kind: 'go_to', rawTarget: 'kaas', source: src(centerPath, 8), confidence: 'exact'},
    {from: 'center_party_conference', to: 'quality_ref:next_event_quality', kind: 'conditional_go_to_ref', rawTarget: 'next_event_quality', condition: 'Q.route_flag', dynamicTarget: true, targetSource: 'quality', source: src(centerPath, 9), confidence: 'exact'}
  ],
  diagnostics: [],
  semantic: {
    parserEvidence: {
      routeOrderGroups: [
        {
          id: 'route_order_center',
          sceneId: 'center_party_conference',
          ownerId: 'center_party_conference',
          ownerKind: 'event',
          routeField: 'goTo',
          routeKind: 'go_to',
          routeCount: 2,
          chainContext: 'ordered_chain',
          source: src(centerPath, 8),
          sourceRaw: 'joos if Q.z_relation >= 70; kaas',
          parserBacked: true,
          confidence: 'exact',
          installSafety: 'manual_review',
          clauses: [
            {order: 1, raw: 'joos if Q.z_relation >= 70', rawTarget: 'joos', resolvedTarget: 'center_party_conference.joos', targetResolved: true, predicate: 'Q.z_relation >= 70', isFallback: false, routeKind: 'conditional_go_to'},
            {order: 2, raw: 'kaas', rawTarget: 'kaas', resolvedTarget: 'center_party_conference.kaas', targetResolved: true, predicate: '', isFallback: true, routeKind: 'go_to'}
          ]
        },
        {
          id: 'route_order_ref',
          sceneId: 'center_party_conference',
          ownerId: 'center_party_conference',
          ownerKind: 'event',
          routeField: 'goToRef',
          routeKind: 'go_to_ref',
          routeCount: 1,
          chainContext: 'predicate_singleton',
          source: src(centerPath, 9),
          sourceRaw: 'next_event_quality if Q.route_flag',
          parserBacked: true,
          confidence: 'exact',
          installSafety: 'manual_review',
          clauses: [
            {order: 1, raw: 'next_event_quality if Q.route_flag', rawTarget: 'next_event_quality', resolvedTarget: 'quality_ref:next_event_quality', targetResolved: true, predicate: 'Q.route_flag', isFallback: false, routeKind: 'conditional_go_to_ref', dynamicTarget: true, targetSource: 'quality'}
          ]
        }
      ]
    }
  }
};

const model = routeState.buildRouteStateModel(index);
assert(model.summary.routeStateCount >= 4, 'model should include route groups and direct edge states', model.summary);
assert(model.summary.orderedChainCount === 1, 'model should count the ordered go-to chain', model.summary);
assert(model.summary.goToRefCount === 1, 'model should count go-to-ref quality-backed dynamic routes', model.summary);
assert(model.summary.setJumpCount === 1, 'model should preserve set-jump route state', model.summary);

const center = routeState.routeStatesForScene(index, 'center_party_conference');
const chain = center.states.find((state) => state.id === 'route_order_center');
assert(chain, 'center route chain should be present', center);
assert(chain.candidateCount === 2, 'chain should preserve both route candidates', chain);
assert(chain.fallbackCandidate && chain.fallbackCandidate.rawTarget === 'kaas', 'chain should mark the unconditional route as fallback', chain);
assert(chain.dependencies.includes('z_relation'), 'chain should expose predicate dependency z_relation', chain);
assert(chain.candidates[0].predicateSummary.comparisons[0].op === '>=', 'candidate should expose comparison operator', chain.candidates[0]);

const goToRef = center.states.find((state) => state.routeField === 'goToRef');
assert(goToRef && goToRef.routePurpose === 'quality_backed_dynamic_route', 'go-to-ref should be classified as quality-backed dynamic route', goToRef);
assert(goToRef.candidates[0].dynamicTarget && goToRef.candidates[0].targetSource === 'quality', 'go-to-ref candidate should keep quality target source', goToRef);

const election = routeState.routeStatesForScene(index, 'election_1928');
const jump = election.states.find((state) => state.routeKind === 'set_jump');
assert(jump && jump.routePurpose === 'jump_return_target', 'set-jump should be a jump/return target, not an immediate go-to', election.states);
assert(election.conditionStates.some((state) => state.conditionKind === 'view_if' && state.dependencies.includes('next_election_year')), 'scene view-if dependencies should be captured', election.conditionStates);

const joosCondition = center.conditionStates.find((state) => state.ownerId === 'center_party_conference.joos_campaign');
assert(joosCondition && joosCondition.dependencies.includes('resources') && joosCondition.dependencies.includes('z_relation'), 'section choose-if dependencies should be captured', center.conditionStates);

const workbench = eventWorkbench.buildEventWorkbench(index, 'center_party_conference');
assert(workbench.routeState.summary.routeStateCount >= 1, 'Event Workbench should consume structured route-state data', workbench.routeState);
const rendered = eventWorkbenchUi.renderEventWorkbench(workbench, {locale: 'en'});
assert(rendered.includes('data-event-workbench-section="routeState"'), 'Event Workbench UI should render route-state section', rendered);
assert(rendered.includes('data-event-workbench-route-state='), 'Event Workbench UI should render route-state rows', rendered);
const html = fs.readFileSync(path.join(__dirname, 'viewer', 'index.html'), 'utf8');
const dependencyLoader = fs.readFileSync(path.join(__dirname, 'authoring', 'authoring_dependency_loader.js'), 'utf8');
assert(html.indexOf('authoring_dependency_loader.js') >= 0 && html.indexOf('authoring_dependency_loader.js') < html.indexOf('event_workbench_model.js'), 'viewer should load authoring dependencies before Event Workbench');
assert(dependencyLoader.includes('route_state_model.js'), 'authoring dependency loader should load route_state_model');

process.stdout.write(JSON.stringify({
  ok: true,
  routeStates: model.summary.routeStateCount,
  orderedChains: model.summary.orderedChainCount,
  goToRef: model.summary.goToRefCount,
  setJump: model.summary.setJumpCount,
  centerDependencies: chain.dependencies
}, null, 2) + '\n');
