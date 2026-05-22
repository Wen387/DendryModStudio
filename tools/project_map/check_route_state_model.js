#!/usr/bin/env node
// @ts-check
'use strict';

const routeState = require('./authoring/route_state_model.js');
const fieldPresentation = require('./authoring/object_field_presentation_model.js');
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
const cabinetPath = 'source/scenes/events/cabinet_sacked.scene.dry';
const dvpPath = 'source/scenes/events/dvp_party_congress.scene.dry';
const austriaPath = 'source/scenes/events/austrian_civil_war.scene.dry';
const zeroPath = 'source/scenes/events/zero_valid_route.scene.dry';

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
    {
      id: 'cabinet_sacked',
      title: 'Hindenburg Sacks Cabinet',
      type: 'event',
      path: cabinetPath,
      sourceSpan: {path: cabinetPath, startLine: 1, endLine: 40},
      routes: {goTo: []},
      options: [],
      sections: []
    },
    {
      id: 'dvp_party_congress',
      title: 'DVP Party Vote',
      type: 'event',
      path: dvpPath,
      sourceSpan: {path: dvpPath, startLine: 1, endLine: 70},
      routes: {goTo: []},
      options: [],
      sections: [
        {
          id: 'dvp_party_congress.resultsdvp',
          title: 'Results',
          onArrival: '{! if (Q.dvp_left > Q.dvp_right) Q.dvp_ideology = "Left"; !}',
          sourceSpan: {path: dvpPath, startLine: 20, endLine: 36},
          metadata: {onArrival: src(dvpPath, 23)},
          routes: {},
          options: []
        }
      ],
      opaqueJsBlocks: [
        {
          id: 'opaque_dvp_results',
          sectionId: 'dvp_party_congress.resultsdvp',
          hook: 'on-arrival',
          source: src(dvpPath, 23),
          rawPreview: 'if (Q.dvp_left > Q.dvp_right) Q.dvp_ideology = "Left";',
          reads: ['dvp_left', 'dvp_right'],
          writes: ['dvp_ideology']
        }
      ]
    },
    {
      id: 'austrian_civil_war',
      title: 'Austrian Civil War',
      type: 'event',
      path: austriaPath,
      sourceSpan: {path: austriaPath, startLine: 1, endLine: 90},
      routes: {goTo: []},
      options: [],
      sections: [
        {
          id: 'austrian_civil_war.support_sdapo_govt',
          title: 'Support the SDAPO government',
          onArrival: 'sdapo_strength += 1',
          sourceSpan: {path: austriaPath, startLine: 52, endLine: 66},
          metadata: {onArrival: src(austriaPath, 59)},
          routes: {},
          options: []
        }
      ],
      effects: [
        {
          id: 'effect_sdapo_strength',
          variable: 'sdapo_strength',
          op: '+=',
          operator: '+=',
          value: '1',
          condition: '',
          hook: 'on-arrival',
          sectionId: 'austrian_civil_war.support_sdapo_govt',
          sourceExpression: 'sdapo_strength += 1',
          expression: 'Q.sdapo_strength += 1',
          source: src(austriaPath, 59)
        }
      ]
    },
    {
      id: 'zero_valid_route',
      title: 'Zero Valid Route Fixture',
      type: 'event',
      path: zeroPath,
      sourceSpan: {path: zeroPath, startLine: 1, endLine: 30},
      routes: {goTo: []},
      options: [],
      sections: []
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
        },
        {
          id: 'route_order_cabinet',
          sceneId: 'cabinet_sacked',
          ownerId: 'cabinet_sacked',
          ownerKind: 'event',
          routeField: 'goTo',
          routeKind: 'go_to',
          routeCount: 3,
          chainContext: 'ordered_chain',
          source: src(cabinetPath, 7),
          sourceRaw: 'bruning_right if A; bruning_center_right if B; bruning_chain if not (A) and not (B)',
          parserBacked: true,
          confidence: 'exact',
          installSafety: 'manual_review',
          clauses: [
            {order: 1, raw: 'bruning_right if right_coalition >= 50', rawTarget: 'bruning_right', resolvedTarget: 'cabinet_sacked.bruning_right', targetResolved: true, predicate: 'right_coalition >= 50', routeKind: 'conditional_go_to'},
            {order: 2, raw: 'bruning_center_right if center_right_coalition >= 50 and right_coalition < 50', rawTarget: 'bruning_center_right', resolvedTarget: 'cabinet_sacked.bruning_center_right', targetResolved: true, predicate: 'center_right_coalition >= 50 and right_coalition < 50', routeKind: 'conditional_go_to'},
            {order: 3, raw: 'bruning_chain if not (right_coalition >= 50) and not (center_right_coalition >= 50 and right_coalition < 50)', rawTarget: 'bruning_chain', resolvedTarget: 'cabinet_sacked.bruning_chain', targetResolved: true, predicate: 'not (right_coalition >= 50) and not (center_right_coalition >= 50 and right_coalition < 50)', routeKind: 'conditional_go_to'}
          ]
        },
        {
          id: 'route_order_dvp_overlap',
          sceneId: 'dvp_party_congress',
          ownerId: 'dvp_party_congress.resultsdvp',
          ownerKind: 'section',
          routeField: 'goTo',
          routeKind: 'go_to',
          routeCount: 2,
          chainContext: 'ordered_chain',
          source: src(dvpPath, 28),
          sourceRaw: 'curtius if dvp_ideology = "Left"; luther if foreign_minister_party = "DVP" and dvp_ideology = "Left"',
          parserBacked: true,
          confidence: 'exact',
          installSafety: 'manual_review',
          clauses: [
            {order: 1, raw: 'curtius if dvp_ideology = "Left"', rawTarget: 'curtius', resolvedTarget: 'dvp_party_congress.curtius', targetResolved: true, predicate: 'dvp_ideology = "Left"', routeKind: 'conditional_go_to'},
            {order: 2, raw: 'luther if foreign_minister_party = "DVP" and dvp_ideology = "Left"', rawTarget: 'luther', resolvedTarget: 'dvp_party_congress.luther', targetResolved: true, predicate: 'foreign_minister_party = "DVP" and dvp_ideology = "Left"', routeKind: 'conditional_go_to'}
          ]
        },
        {
          id: 'route_order_austria_sdapo',
          sceneId: 'austrian_civil_war',
          ownerId: 'austrian_civil_war.support_sdapo_govt',
          ownerKind: 'section',
          routeField: 'goTo',
          routeKind: 'go_to',
          routeCount: 2,
          chainContext: 'ordered_chain',
          source: src(austriaPath, 60),
          sourceRaw: 'sdapo_victory if sdapo_strength >= 6; long_war_2 if sdapo_strength < 6',
          parserBacked: true,
          confidence: 'exact',
          installSafety: 'manual_review',
          clauses: [
            {order: 1, raw: 'sdapo_victory if sdapo_strength >= 6', rawTarget: 'sdapo_victory', resolvedTarget: 'austrian_civil_war.sdapo_victory', targetResolved: true, predicate: 'sdapo_strength >= 6', routeKind: 'conditional_go_to'},
            {order: 2, raw: 'long_war_2 if sdapo_strength < 6', rawTarget: 'long_war_2', resolvedTarget: 'austrian_civil_war.long_war_2', targetResolved: true, predicate: 'sdapo_strength < 6', routeKind: 'conditional_go_to'}
          ]
        },
        {
          id: 'route_order_zero_valid',
          sceneId: 'zero_valid_route',
          ownerId: 'zero_valid_route',
          ownerKind: 'event',
          routeField: 'goTo',
          routeKind: 'go_to',
          routeCount: 2,
          chainContext: 'ordered_chain',
          source: src(zeroPath, 12),
          sourceRaw: 'high_path if pressure > 10; low_path if pressure < 0',
          parserBacked: true,
          confidence: 'exact',
          installSafety: 'manual_review',
          clauses: [
            {order: 1, raw: 'high_path if pressure > 10', rawTarget: 'high_path', resolvedTarget: 'zero_valid_route.high_path', targetResolved: true, predicate: 'pressure > 10', routeKind: 'conditional_go_to'},
            {order: 2, raw: 'low_path if pressure < 0', rawTarget: 'low_path', resolvedTarget: 'zero_valid_route.low_path', targetResolved: true, predicate: 'pressure < 0', routeKind: 'conditional_go_to'}
          ]
        }
      ]
    }
  }
};

const model = routeState.buildRouteStateModel(index);
assert(model.summary.routeStateCount >= 4, 'model should include route groups and direct edge states', model.summary);
assert(model.summary.orderedChainCount === 5, 'model should count the ordered go-to chains', model.summary);
assert(model.summary.goToRefCount === 1, 'model should count go-to-ref quality-backed dynamic routes', model.summary);
assert(model.summary.setJumpCount === 1, 'model should preserve set-jump route state', model.summary);
assert(model.summary.possibleRandomRouteCount >= 2, 'summary should count possible random route groups', model.summary);
assert(model.summary.unconditionalMixedRouteCount >= 1, 'summary should count unconditional plus conditional mixed route groups', model.summary);
assert(model.summary.explicitExclusiveRouteCount >= 1, 'summary should count explicit mutually exclusive route groups', model.summary);

const center = routeState.routeStatesForScene(index, 'center_party_conference');
const chain = center.states.find((state) => state.id === 'route_order_center');
assert(chain, 'center route chain should be present', center);
assert(chain.candidateCount === 2, 'chain should preserve both route candidates', chain);
assert(!chain.fallbackCandidate, 'mixed conditional plus unconditional routes should not expose an ordered fallback candidate', chain);
assert(chain.dependencies.includes('z_relation'), 'chain should expose predicate dependency z_relation', chain);
assert(chain.candidates[0].predicateSummary.comparisons[0].op === '>=', 'candidate should expose comparison operator', chain.candidates[0]);
assert(chain.runtimeSemantics.possibleRandomization, 'mixed unconditional plus conditional go-to should be marked as possible runtime randomization', chain.runtimeSemantics);
assert(chain.runtimeSemantics.selectionMode === 'random_among_valid', 'mixed route runtime selection should explain random valid-target behavior', chain.runtimeSemantics);
assert(chain.runtimeSemantics.warnings.includes('unconditional_and_conditional_routes_can_randomize'), 'unconditional mixed routes should warn that the unconditional clause is not fallback', chain.runtimeSemantics);
assert(center.diagnostics.some((item) => item.code === 'route_state.unconditional_not_fallback'), 'scene diagnostics should expose unconditional-not-fallback evidence', center.diagnostics);
assert(chain.semanticTier === 'manual_boundary' && chain.safeEditEligible === false, 'ambiguous random route groups should not be safe structured edits', chain);

const cabinet = routeState.routeStatesForScene(index, 'cabinet_sacked');
const cabinetChain = cabinet.states.find((state) => state.id === 'route_order_cabinet');
assert(cabinetChain && cabinetChain.runtimeSemantics.exclusivity === 'explicit_complement', 'explicit complement routes should be classified as mutually exclusive fallback', cabinetChain);
assert(!cabinetChain.runtimeSemantics.possibleRandomization, 'explicit complement route should not be flagged as random', cabinetChain && cabinetChain.runtimeSemantics);
assert(cabinetChain.semanticTier === 'static_exact' && cabinetChain.safeEditEligible, 'explicit complement routes should qualify as safe structured static routes', cabinetChain);

const dvp = routeState.routeStatesForScene(index, 'dvp_party_congress');
const dvpOverlap = dvp.states.find((state) => state.id === 'route_order_dvp_overlap');
assert(dvpOverlap && dvpOverlap.runtimeSemantics.exclusivity === 'unknown_overlap', 'overlapping complex route predicates should stay marked as possible overlap', dvpOverlap);
assert(dvpOverlap.runtimeSemantics.possibleRandomization, 'overlapping complex route predicates should be marked as possible random valid-target behavior', dvpOverlap && dvpOverlap.runtimeSemantics);
assert(dvpOverlap.preRouteScript.opaque, 'opaque on-arrival script before a route should be preserved as route evidence', dvpOverlap && dvpOverlap.preRouteScript);
assert(dvpOverlap.preRouteScript.directDependencyWrites.includes('dvp_ideology'), 'opaque pre-route script writes should intersect route dependencies when known', dvpOverlap && dvpOverlap.preRouteScript);
assert(dvpOverlap.runtimeSemantics.collisionSummary.tested, 'route collision sampling should run for parsed overlapping predicates', dvpOverlap && dvpOverlap.runtimeSemantics.collisionSummary);
assert(dvpOverlap.runtimeSemantics.collisionSummary.after.multiValidCount > 0, 'collision sampling should prove the DVP overlap can select multiple valid targets', dvpOverlap && dvpOverlap.runtimeSemantics.collisionSummary);

const austrian = routeState.routeStatesForScene(index, 'austrian_civil_war');
const austrianChain = austrian.states.find((state) => state.id === 'route_order_austria_sdapo');
assert(austrianChain && austrianChain.preRouteScript.routeDependencyWriteCount === 1, 'safe on-arrival effects should be linked to immediate route dependency writes', austrianChain && austrianChain.preRouteScript);
assert(austrianChain.preRouteScript.directDependencyWrites.includes('sdapo_strength'), 'pre-route dependency evidence should name the written route variable', austrianChain && austrianChain.preRouteScript);
assert(austrianChain.runtimeSemantics.preRouteScript.status === 'direct_dependency_write', 'runtime semantics should embed pre-route script status', austrianChain && austrianChain.runtimeSemantics);
assert(austrianChain.runtimeSemantics.collisionSummary.tested, 'route collision sampling should test safe pre-route effect chains', austrianChain && austrianChain.runtimeSemantics.collisionSummary);
assert(austrianChain.runtimeSemantics.collisionSummary.preRouteMutationCount > 0, 'safe on-arrival effects should be applied during collision sampling', austrianChain && austrianChain.runtimeSemantics.collisionSummary);

const zeroValid = routeState.routeStatesForScene(index, 'zero_valid_route');
const zeroValidChain = zeroValid.states.find((state) => state.id === 'route_order_zero_valid');
assert(zeroValidChain && zeroValidChain.runtimeSemantics.collisionSummary.after.zeroValidCount > 0, 'route collision sampling should preserve zero-valid route samples', zeroValidChain && zeroValidChain.runtimeSemantics.collisionSummary);
assert(zeroValid.diagnostics.some((item) => item.code === 'route_state.zero_valid_gap'), 'zero-valid route gaps should have a dedicated diagnostic code', zeroValid.diagnostics);
const zeroValidRendered = eventWorkbenchUi.renderEventWorkbench(eventWorkbench.buildEventWorkbench(index, 'zero_valid_route'), {locale: 'en'});
assert(zeroValidRendered.includes('sampled no-valid'), 'Event Workbench UI should surface sampled no-valid route states', zeroValidRendered);

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
assert(rendered.includes('possible random split'), 'Event Workbench UI should render runtime route semantics', rendered);
const routePresentationRows = fieldPresentation.routeStateSummaries(center);
assert(routePresentationRows.some((row) => row.badges.includes('possible random split')), 'Object Canvas route-state summaries should preserve randomization warnings');
assert(routePresentationRows.some((row) => row.candidates.some((candidate) => candidate.predicate)), 'Object Canvas route-state summaries should preserve predicates near route fields');
const previewEditorSource = fs.readFileSync(path.join(__dirname, 'viewer', 'preview_object_editor.js'), 'utf8');
assert(previewEditorSource.includes('data-object-canvas-route-state-summary'), 'Object Canvas editor should render route-state summary markers');
const html = fs.readFileSync(path.join(__dirname, 'viewer', 'index.html'), 'utf8');
const dependencyLoader = fs.readFileSync(path.join(__dirname, 'authoring', 'authoring_dependency_loader.js'), 'utf8');
assert(html.indexOf('authoring_dependency_loader.js') >= 0 && html.indexOf('authoring_dependency_loader.js') < html.indexOf('event_workbench_model.js'), 'viewer should load authoring dependencies before Event Workbench');
assert(dependencyLoader.includes('route_state_model.js'), 'authoring dependency loader should load route_state_model');

process.stdout.write(JSON.stringify({
  ok: true,
  routeStates: model.summary.routeStateCount,
  orderedChains: model.summary.orderedChainCount,
  possibleRandomRoutes: model.summary.possibleRandomRouteCount,
  explicitExclusiveRoutes: model.summary.explicitExclusiveRouteCount,
  preRouteScripts: model.summary.preRouteScriptCount,
  preRouteDependencyWrites: model.summary.preRouteRouteDependencyWriteCount,
  collisionTestedRoutes: model.summary.collisionTestedRouteCount,
  goToRef: model.summary.goToRefCount,
  setJump: model.summary.setJumpCount,
  centerDependencies: chain.dependencies
}, null, 2) + '\n');
