#!/usr/bin/env node
// @ts-check
'use strict';

const routeUnderstanding = require('./authoring/route_understanding_model.js');
const routeScript = require('./authoring/route_script_intelligence_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');

const {fail, assert} = require('./check_harness.js');

const profileEvidence = [{
  profileId: 'presidential-fixture-profile',
  eventSeriesPatterns: [{
    id: 'presidential_1932',
    prefix: 'presidential_election_1932',
    stages: [
      {sceneId: 'presidential_election_1932_hindenburg', stageLabel: 'announcement'},
      {sceneId: 'presidential_election_1932_candidate', stageLabel: 'candidate setup'},
      {sceneId: 'presidential_election_1932_campaign', stageLabel: 'campaign'},
      {sceneId: 'presidential_election_1932_round_1', stageLabel: 'round 1'},
      {sceneId: 'presidential_election_1932_round_2', stageLabel: 'round 2'}
    ]
  }],
  schedulerScenes: [{sceneId: 'post_event.events_choice', tag: 'event', deckRoute: '#event', protected: true}],
  protectedRouterScenes: ['post_event', 'post_event.events_choice'],
  utilityRouteScenes: [{sceneId: 'election_algorithm', utilityKind: 'single_slot_return_utility', returnBinding: 'jumpScene'}]
}];

function source(path, line) {
  return {path, line, startLine: line, endLine: line, anchorText: ''};
}

function scene(id, title, line, viewIf) {
  const path = id === 'election_algorithm' || id.indexOf('post_event') === 0
    ? 'source/scenes/' + id.split('.')[0] + '.scene.dry'
    : 'source/scenes/events/' + id + '.scene.dry';
  return {
    id,
    type: id.indexOf('presidential_election_1932') === 0 ? 'event' : 'system',
    title,
    path,
    tags: id.indexOf('presidential_election_1932') === 0 ? ['event'] : [],
    viewIf,
    priority: id.endsWith('round_2') ? 3 : 2,
    frequency: id.endsWith('round_1') || id.endsWith('round_2') ? 1000 : '',
    maxVisits: 1,
    sourceSpan: source(path, line)
  };
}

const index = {
  schemaVersion: '0.1',
  project: {name: 'Route Understanding Fixture', root: '/tmp/route-understanding-fixture', profileIds: ['generic-dendry', 'presidential-fixture-profile']},
  scenes: [
    scene('presidential_election_1932_hindenburg', 'Hindenburg announcement', 1, 'year = 1932 and month >= 2'),
    scene('presidential_election_1932_candidate', 'Candidate setup', 1, 'year = 1932 and month >= 2'),
    scene('presidential_election_1932_campaign', 'Campaign', 1, 'year = 1932 and month >= 2'),
    scene('presidential_election_1932_round_1', 'Round 1', 1, 'year = 1932 and month == 3'),
    scene('presidential_election_1932_round_2', 'Round 2', 1, 'year = 1932 and month == 4'),
    scene('election_algorithm', 'Election utility', 1, ''),
    scene('post_event', 'Post event router', 1, ''),
    scene('post_event.events_choice', 'Event deck', 5203, '')
  ],
  edges: [
    {from: 'presidential_election_1932_hindenburg', to: 'presidential_election_1932_candidate', kind: 'option', source: source('source/scenes/events/presidential_election_1932_hindenburg.scene.dry', 77)},
    {from: 'presidential_election_1932_candidate', to: 'presidential_election_1932_campaign', kind: 'event_chain', source: source('source/scenes/events/presidential_election_1932_candidate.scene.dry', 890)},
    {from: 'presidential_election_1932_round_1', to: 'election_algorithm', kind: 'go_to', source: source('source/scenes/events/presidential_election_1932_round_1.scene.dry', 16)},
    {from: 'election_algorithm', to: 'jumpScene', kind: 'go_to', source: source('source/scenes/election_algorithm.scene.dry', 104)}
  ],
  semantic: {
    parserEvidence: {
      core: {
        tagDeckRoutes: [{sceneId: 'post_event.events_choice', tag: 'event', deckRoute: '#event', source: source('source/scenes/post_event.scene.dry', 5205)}],
        routeOrderGroups: [],
        dynamicKeyEvidence: [],
        effectClauses: []
      },
      profiles: profileEvidence
    }
  }
};

const body = {
  id: 'presidential_election_1932_round_1',
  projectIndex: index,
  profileEvidence,
  knownSceneIds: index.scenes.map((item) => item.id),
  sections: [
    {id: 'pres_election'},
    {id: 'post_election'},
    {id: 'calculation'},
    {id: 'hindenburg_wins'},
    {id: 'no_majority_round1'}
  ],
  flow: {
    nodes: [
      {id: 'presidential_election_1932_round_1'},
      {id: 'election_algorithm'},
      {id: 'calculation'},
      {id: 'hindenburg_wins'}
    ],
    edges: [
      {from: 'presidential_election_1932_round_1', to: 'election_algorithm', kind: 'route', parserBacked: true, source: source('source/scenes/events/presidential_election_1932_round_1.scene.dry', 16)},
      {from: 'presidential_election_1932_round_1', to: 'pres_election', kind: 'set_jump', parserBacked: true, source: source('source/scenes/events/presidential_election_1932_round_1.scene.dry', 17)},
      {from: 'election_algorithm', to: 'jumpScene', kind: 'route', parserBacked: true, source: source('source/scenes/election_algorithm.scene.dry', 104)},
      {from: 'calculation', to: 'hindenburg_wins', kind: 'conditional_route', condition: 'hindenburg_majority == 1', parserBacked: true, source: source('source/scenes/events/presidential_election_1932_round_1.scene.dry', 670)}
    ]
  },
  scriptRows: [{
    id: 'post_election_vote_math',
    label: 'post_election vote calculation',
    scriptKind: 'opaque_js',
    hook: 'on-arrival',
    sectionId: 'calculation',
    text: '{! for (const party of parties) { Q.hindenburg_majority = Q.hindenburg_votes > 50; } !}',
    writes: ['hindenburg_majority'],
    reads: ['hindenburg_votes'],
    lineCount: 500,
    source: source('source/scenes/events/presidential_election_1932_round_1.scene.dry', 33)
  }],
  eventGraph: {
    kind: 'complex_event_graph',
    nodes: [
      {id: 'root', kind: 'opening', label: 'Round 1'},
      {id: 'section:calculation', kind: 'follow_up', label: 'calculation'},
      {id: 'section:hindenburg_wins', kind: 'result', label: 'hindenburg_wins'}
    ],
    edges: [
      {id: 'edge:calculation:hindenburg', from: 'section:calculation', to: 'section:hindenburg_wins', kind: 'result_route', targetId: 'hindenburg_wins'}
    ],
    nodeCount: 3,
    edgeCount: 1
  }
};

const model = routeScript.buildRouteScriptIntelligence(body, {
  eventId: body.id,
  projectIndex: index,
  profileEvidence
});
assert(typeof routeUnderstanding.buildRouteUnderstanding === 'function', 'route understanding model should expose a stable typed API');
const understanding = model.routeUnderstanding || routeUnderstanding.buildRouteUnderstanding(body, {
  eventId: body.id,
  projectIndex: index,
  profileEvidence,
  routeEvidence: model.routes,
  scriptImpactMap: model.scripts
});

assert(understanding.kind === 'route_understanding', 'route understanding model should expose its kind', understanding);
const routeUnderstandingSummary = model.summary.routeUnderstanding && typeof model.summary.routeUnderstanding === 'object'
  ? /** @type {Record<string, unknown>} */ (model.summary.routeUnderstanding)
  : {};
assert(routeUnderstandingSummary.utilityCallCount === 1, 'route script summary should carry routeUnderstanding counts', model.summary);
assert(understanding.eventChain.items.length === 5, 'profile event series should produce the five-stage presidential chain', understanding.eventChain);
assert(understanding.eventChain.items.map((item) => item.stageLabel).join(' > ') === 'announcement > candidate setup > campaign > round 1 > round 2', 'event chain should preserve profile stage labels', understanding.eventChain.items);
assert(understanding.eventChain.items.every((item) => item.semanticTier === 'guided_profile' && Array.isArray(item.metadata.tags)), 'event chain items should expose typed semantic tier and metadata tags', understanding.eventChain.items);

const scheduler = understanding.schedulerContext.items.find((item) => item.deckRoute === '#event' && item.protected);
assert(scheduler && scheduler.readiness === 'scheduler_proven' && scheduler.protected, 'scheduler context should recognize protected #event deck routing', understanding.schedulerContext);

const utility = understanding.utilityCalls[0];
assert(utility && utility.utilitySceneId === 'election_algorithm' && utility.setJumpTarget === 'pres_election' && utility.returnBinding === 'jumpScene', 'set-jump utility call should become call/return evidence', understanding.utilityCalls);
assert(utility.safeEditEligible === false && utility.semanticTier === 'guided_profile' && utility.evidenceClass === 'profile_utility', 'utility call evidence should remain guided and not safe inline edit', utility);

const jumpSceneRoute = model.routes.items.find((route) => route.from === 'election_algorithm' && route.target === 'jumpScene');
assert(jumpSceneRoute && jumpSceneRoute.evidenceClass !== 'missing_target' && jumpSceneRoute.targetResolution.status === 'dynamic_return_binding', 'profile-marked jumpScene should not be treated as a missing target', jumpSceneRoute);

const safeStaticRoute = model.routes.items.find((route) => route.from === 'calculation' && route.target === 'hindenburg_wins');
assert(safeStaticRoute && safeStaticRoute.semanticTier === 'static_exact' && safeStaticRoute.safeEditEligible, 'understanding layer should not downgrade existing safe static route edits', safeStaticRoute);

const state = understanding.stateDependencies.find((item) => item.ownerId === 'calculation');
assert(state && state.opaque && state.directDependencyWrites.includes('hindenburg_majority'), 'opaque vote JS should produce manual state dependency evidence only', understanding.stateDependencies);

const renderModelInput = {kind: 'event', eventBody: Object.assign({}, body, {
  routeScriptIntelligence: {summary: model.summary, diagnostics: model.diagnostics},
  routeEvidenceMap: model.routes,
  scriptImpactMap: model.scripts,
  routeUnderstanding: understanding
})};
const html = previewEditor.render(renderModelInput) + previewEditor.renderEventReviewDetailsPanels(renderModelInput.eventBody, renderModelInput);
assert(html.includes('data-preview-object-route-understanding="true"'), 'Route Map UI should render route understanding context', html);
assert(html.includes('data-route-understanding-section="event_chain"'), 'Route Map UI should render event chain context', html);
assert(html.includes('data-route-understanding-section="scheduler"'), 'Route Map UI should render scheduler context', html);
assert(html.includes('data-route-understanding-section="utility"'), 'Route Map UI should render utility context', html);
assert(html.includes('data-route-understanding-section="state_dependency"'), 'Route Map UI should render state dependency context', html);

process.stdout.write(JSON.stringify({
  ok: true,
  summary: understanding.summary,
  scheduler: {readiness: scheduler.readiness, protected: scheduler.protected},
  utility: {utilitySceneId: utility.utilitySceneId, setJumpTarget: utility.setJumpTarget, returnBinding: utility.returnBinding}
}, null, 2) + '\n');
