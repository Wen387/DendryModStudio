#!/usr/bin/env node
// @ts-check
'use strict';

const routeScript = require('./authoring/route_script_intelligence_model.js');
const complexAuthoring = require('./authoring/complex_event_authoring_model.js');
const eventStructure = require('./authoring/event_structure_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');

const {fail, assert} = require('./check_harness.js');

function src(path, line, anchorText) {
  return {path, line, startLine: line, endLine: line, anchorText, endAnchorText: anchorText};
}

function dynamicWrites(block) {
  return block && Array.isArray(block.dynamicRouteWrites) ? /** @type {Array<Record<string, any>>} */ (block.dynamicRouteWrites) : [];
}

function routeWriteTargets(write) {
  return write && Array.isArray(write.candidateTargets) ? /** @type {string[]} */ (write.candidateTargets) : [];
}

function fixtureBody() {
  return {
    mode: 'existing',
    eventShape: 'choice_event',
    eventStructure: {id: 'route_script_fixture'},
    projectSceneIds: ['external_project_scene', 'shared_shadow'],
    title: {id: 'title', label: 'Title', value: 'Route Script Fixture'},
    sections: [{id: 'opening', label: 'Opening', value: 'Opening text'}],
    branchSections: [
      {id: 'beta_body', sectionId: 'beta', label: 'Beta', value: 'Beta branch', condition: 'Q.pressure >= 2'},
      {id: 'omega_body', sectionId: 'omega', label: 'Omega', value: 'Omega fallback'},
      {id: 'shared_shadow_body', sectionId: 'shared_shadow', label: 'Shared Shadow', value: 'Local section shadows a global scene id'}
    ],
    options: [
      {id: 'organize', optionId: 'organize', label: 'Organize pressure', targetId: 'beta', chooseIf: 'Q.pressure >= 2', fields: []}
    ],
    flow: {
      edges: [
        {kind: 'route', from: 'root', to: 'beta', source: src('source/scenes/events/route_script.scene.dry', 10, 'go-to: beta')},
        {kind: 'conditional_route', from: 'beta', to: 'omega', condition: 'Q.route_gate = 1', parserBacked: true, source: src('source/scenes/events/route_script.scene.dry', 20, 'omega if Q.route_gate = 1')},
        {kind: 'conditional_route', from: 'beta', to: 'shared_shadow', condition: 'bare_route_flag = 1', parserBacked: true, source: src('source/scenes/events/route_script.scene.dry', 20, 'shared_shadow if bare_route_flag = 1')},
        {kind: 'route', from: 'beta', to: 'opening', source: {path: 'source/scenes/events/route_script.scene.dry', line: 21, excerpt: '21: go-to: opening'}},
        {kind: 'route', from: 'beta', to: 'external_project_scene', source: src('source/scenes/events/route_script.scene.dry', 22, 'go-to: external_project_scene')},
        {kind: 'route', from: 'beta', to: 'shared_shadow', parserBacked: true, source: src('source/scenes/events/route_script.scene.dry', 23, 'go-to: shared_shadow')},
        {kind: 'route', from: 'beta', to: 'profile_alias_target', parserBacked: true, source: src('source/scenes/events/route_script.scene.dry', 24, 'go-to: profile_alias_target')},
        {kind: 'route', from: 'beta', to: 'lost_branch', source: src('source/scenes/events/route_script.scene.dry', 30, 'go-to: lost_branch')},
        {kind: 'route', from: 'omega', to: 'root', source: src('source/scenes/events/route_script.scene.dry', 40, 'go-to: root')},
        {kind: 'route', from: 'omega', to: 'runtime:post_event', source: src('source/scenes/events/route_script.scene.dry', 41, 'go-to: runtime:post_event')},
        {kind: 'go_to_ref', from: 'omega', to: 'quality_ref:next_scene', rawTarget: 'next_scene', dynamicTarget: true, targetSource: 'quality', candidateTargets: ['beta', 'omega'], source: src('source/scenes/events/route_script.scene.dry', 42, 'go-to-ref: next_scene')}
      ]
    },
    metaFields: [
      {id: 'approx_route', role: 'route', label: 'Approx route', value: 'omega', confidence: 'approximate', source: {}},
      {id: 'field_route_gate', role: 'route', label: 'Field route', value: 'beta', condition: 'field_route_flag = 1', confidence: 'exact', source: src('source/scenes/events/route_script.scene.dry', 25, 'beta if field_route_flag = 1')}
    ],
    scriptRows: [
      {
        id: 'guided_arrival',
        label: 'Opening arrival script',
        text: 'on-arrival: Q.pressure += 2; Q.flag = true; Q.route_gate = 1',
        source: src('source/scenes/events/route_script.scene.dry', 5, 'on-arrival: Q.pressure += 2; Q.flag = true; Q.route_gate = 1')
      },
      {
        id: 'manual_display',
        label: 'Display script',
        text: 'on-display: if (Q.pressure > 2) { Q.hidden = 1; call("route_probe"); }',
        source: src('source/scenes/events/route_script.scene.dry', 6, 'on-display: if (Q.pressure > 2) { Q.hidden = 1; call("route_probe"); }')
      },
      {
        id: 'script_route',
        label: 'Script route hint',
        text: 'on-arrival: route = "beta"',
        source: src('source/scenes/events/route_script.scene.dry', 7, 'on-arrival: route = "beta"')
      },
      {
        id: 'bare_predicate_route_write',
        label: 'Bare predicate route write',
        text: 'on-arrival: Q.bare_route_flag = 1',
        source: src('source/scenes/events/route_script.scene.dry', 7, 'on-arrival: Q.bare_route_flag = 1')
      },
      {
        id: 'field_predicate_route_write',
        label: 'Field predicate route write',
        text: 'on-arrival: Q.field_route_flag = 1',
        source: src('source/scenes/events/route_script.scene.dry', 7, 'on-arrival: Q.field_route_flag = 1')
      },
      {
        id: 'hyphen_root_route',
        label: 'Hyphen root route hint',
        text: 'on-arrival: set-root = "omega"',
        source: src('source/scenes/events/route_script.scene.dry', 8, 'on-arrival: set-root = "omega"')
      },
      {
        id: 'conditional_guided',
        label: 'Conditional guided effect',
        text: 'Q.conditional_support += 1 if Q.pressure >= 2 and Q.flag',
        source: src('source/scenes/events/route_script.scene.dry', 9, 'Q.conditional_support += 1 if Q.pressure >= 2 and Q.flag')
      },
      {
        id: 'ternary_route',
        label: 'Ternary route quality',
        text: 'on-arrival: Q.next_scene = Q.flag ? "beta" : "omega"',
        source: src('source/scenes/events/route_script.scene.dry', 13, 'on-arrival: Q.next_scene = Q.flag ? "beta" : "omega"')
      },
      {
        id: 'map_route',
        label: 'Finite map route quality',
        text: 'on-arrival: Q.next_scene = {win: "beta", lose: "omega"}[Q.route_key]',
        source: src('source/scenes/events/route_script.scene.dry', 14, 'on-arrival: Q.next_scene = {win: "beta", lose: "omega"}[Q.route_key]')
      },
      {
        id: 'if_else_route',
        label: 'If else route quality',
        text: 'on-arrival: if (Q.flag) { Q.next_scene = "beta"; } else { Q.next_scene = "omega"; }',
        source: src('source/scenes/events/route_script.scene.dry', 15, 'on-arrival: if (Q.flag) { Q.next_scene = "beta"; } else { Q.next_scene = "omega"; }')
      },
      {
        id: 'random_route',
        label: 'Random route quality',
        text: 'on-arrival: Q.next_scene = Math.random() > 0.5 ? "beta" : "omega"',
        source: src('source/scenes/events/route_script.scene.dry', 16, 'on-arrival: Q.next_scene = Math.random() > 0.5 ? "beta" : "omega"')
      },
      {
        id: 'calculated_advanced',
        label: 'Calculated understandable effect',
        text: 'Q.calculated_support += 2*(1 - dissent) if peoples_party',
        source: src('source/scenes/events/route_script.scene.dry', 11, 'Q.calculated_support += 2*(1 - dissent) if peoples_party')
      }
    ],
    opaqueJsBlocks: [
      {
        id: 'opaque_arrival',
        label: 'Opaque arrival JS',
        scriptKind: 'opaque_js',
        hook: 'on-arrival',
        rawPreview: 'if (Q.route_gate) { Q.hidden = 1; Q.pressure += Q.route_gate; }',
        lineCount: 5,
        reads: ['route_gate', 'pressure'],
        writes: ['hidden', 'pressure'],
        source: src('source/scenes/events/route_script.scene.dry', 12, 'on-arrival: {!')
      }
    ]
  };
}

function quietBody() {
  return {
    mode: 'existing',
    eventShape: 'choice_event',
    eventStructure: {id: 'quiet_route_script_fixture'},
    title: {id: 'title', label: 'Title', value: 'Quiet Route Script Fixture'},
    sections: [{id: 'opening', label: 'Opening', value: 'Opening text'}],
    options: [
      {id: 'continue', optionId: 'continue', label: 'Continue', targetId: 'opening', fields: []}
    ],
    flow: {
      edges: [
        {kind: 'route', from: 'root', to: 'opening', source: src('source/scenes/events/quiet_route_script.scene.dry', 10, 'go-to: opening')}
      ]
    },
    scriptRows: [
      {
        id: 'simple_arrival',
        label: 'Simple arrival script',
        text: 'on-arrival: Q.pressure += 1',
        source: src('source/scenes/events/quiet_route_script.scene.dry', 5, 'on-arrival: Q.pressure += 1')
      }
    ]
  };
}

// Regression guard for the 2026-06-04 reuseBody clone-elision optimization.
// enrichEventBody can now mutate its input in place when the trusted caller
// opts in via reuseBody; external callers must still get a cloned, isolated
// result. These assertions lock that contract so a future refactor cannot
// silently leak profileEvidence/projectIndex or start mutating caller bodies.
function assertEnrichBodyIsolation() {
  // routeScript external caller (no reuseBody): input untouched, no leak, cloned.
  const extBody = {flow: {edges: []}, options: [], sections: []};
  const extOut = routeScript.enrichEventBody(extBody, {profileEvidence: {x: 1}, projectIndex: {y: 2}});
  assert(!('profileEvidence' in extBody) && !('projectIndex' in extBody), 'routeScript enrichEventBody must not mutate an external caller body', extBody);
  assert(!('profileEvidence' in extOut) && !('projectIndex' in extOut), 'routeScript enrichEventBody must not leak profileEvidence/projectIndex onto the returned body', Object.keys(extOut));
  assert(extOut !== extBody, 'routeScript enrichEventBody must return a cloned body for external callers', null);

  // routeScript reuseBody path: mutates in place and returns the same reference.
  const reuseBody = {flow: {edges: []}, options: [], sections: []};
  const reuseOut = routeScript.enrichEventBody(reuseBody, {reuseBody: true});
  assert(reuseOut === reuseBody, 'routeScript enrichEventBody must reuse the body in place when reuseBody is set', null);

  // routeScript: reuseBody output must deep-equal the clone-path output.
  const shape = () => ({flow: {edges: [{from: 'a', to: 'b', kind: 'choice'}]}, options: [{id: 'o1', targetId: 'b'}], sections: [{id: 'b'}], eventGraph: {nodes: [], edges: []}});
  assert(JSON.stringify(routeScript.enrichEventBody(shape(), {})) === JSON.stringify(routeScript.enrichEventBody(shape(), {reuseBody: true})), 'routeScript enrichEventBody reuseBody path must match the clone path byte for byte', null);

  // complexEvent: external input untouched + reuseBody output matches clone path.
  const cBody = {options: [{id: 'o1', label: 'X'}], sections: []};
  const cSnapshot = JSON.stringify(cBody);
  const cClone = complexAuthoring.enrichEventBody(cBody, {});
  assert(JSON.stringify(cBody) === cSnapshot, 'complexEvent enrichEventBody must not mutate an external caller body', cBody);
  const cReuse = complexAuthoring.enrichEventBody(JSON.parse(cSnapshot), {reuseBody: true});
  assert(JSON.stringify(cClone) === JSON.stringify(cReuse), 'complexEvent enrichEventBody reuseBody path must match the clone path byte for byte', null);
}

function runRouteScriptIntelligence() {
  assertEnrichBodyIsolation();
  const body = fixtureBody();
  const profileEvidence = [{
    profileId: 'generic-dynamic-routes',
    routeQualityVars: ['next_scene'],
    routeHelperTables: [{
      id: 'next_scene_table',
      routeVar: 'next_scene',
      targets: ['beta', 'omega'],
      label: 'Next scene table'
    }],
    staticAliases: {profile_alias_target: 'external_project_scene'}
  }];
  const model = routeScript.buildRouteScriptIntelligence(body, {profileEvidence});
  const classes = new Set(model.routes.items.map((item) => item.evidenceClass));
  ['exact', 'parser_backed', 'fuzzy', 'script_derived', 'missing_target', 'terminal', 'external'].forEach((kind) => {
    assert(classes.has(kind), 'route evidence should include ' + kind, model.routes.items);
  });

  const guided = model.scripts.blocks.find((block) => block.id === 'guided_arrival');
  assert(guided && guided.safetyClass === 'guided', 'simple arrival script should be guided', guided);
  assert(guided.writes.includes('pressure') && guided.writes.includes('flag') && guided.writes.includes('route_gate'), 'guided script should report writes', guided);
  assert(guided.optionInfluence, 'script writes should report option influence when choices read the variable', guided);
  assert(guided.routeInfluence, 'script writes should report route influence when route predicates read the variable', guided);
  assert(model.guidedScriptEdits.length >= 3, 'guided script edit rows should be exposed', model.guidedScriptEdits);
  const conditionalGuided = model.scripts.blocks.find((block) => block.id === 'conditional_guided');
  assert(conditionalGuided && conditionalGuided.safetyClass === 'guided', 'simple trailing-if effects should be guided, not fake manual boundaries', conditionalGuided);
  assert(conditionalGuided.boundaryCategory === 'simple_state_effect', 'guided trailing-if effects should be categorized as simple state effects', conditionalGuided);
  const barePredicateWrite = model.scripts.blocks.find((block) => block.id === 'bare_predicate_route_write');
  assert(barePredicateWrite && barePredicateWrite.routeInfluence, 'scripts that write bare Dendry route predicate variables should report route influence', barePredicateWrite);
  const fieldPredicateWrite = model.scripts.blocks.find((block) => block.id === 'field_predicate_route_write');
  assert(fieldPredicateWrite && fieldPredicateWrite.routeInfluence, 'scripts that write route field predicate variables should report route influence', fieldPredicateWrite);

  const calculatedAdvanced = model.scripts.blocks.find((block) => block.id === 'calculated_advanced');
  assert(calculatedAdvanced && calculatedAdvanced.safetyClass === 'advanced_review', 'parseable calculated effects should be understandable but not simulated as guided', calculatedAdvanced);
  assert(calculatedAdvanced.boundaryCategory === 'calculated_value', 'calculated effect should explain its review category', calculatedAdvanced);

  const opaque = model.scripts.blocks.find((block) => block.id === 'opaque_arrival');
  assert(opaque && opaque.safetyClass === 'manual_boundary', 'opaque JS blocks should stay visible manual boundaries', opaque);
  assert(opaque.boundaryCategory === 'opaque_js_block', 'opaque JS blocks should carry a specific boundary category', opaque);
  assert(opaque.writes.includes('hidden') && opaque.reads.includes('route_gate'), 'opaque JS blocks should preserve indexed read/write hints', opaque);
  assert(model.summary.opaqueJsBlocks === 1, 'summary should count opaque JS boundaries separately', model.summary);

  const manual = model.scripts.blocks.find((block) => block.id === 'manual_display');
  assert(manual && manual.safetyClass === 'manual_boundary', 'complex display script should stay manual boundary', manual);
  assert(manual.displayInfluence, 'on-display script should report display influence', manual);
  const manualReasons = manual && Array.isArray(manual.boundaryReasons) ? /** @type {string[]} */ (manual.boundaryReasons) : [];
  assert(manualReasons.includes('control_flow_or_block'), 'manual script should explain the boundary reason', manual);
  const hyphenRootRoute = model.scripts.blocks.find((block) => block.id === 'hyphen_root_route');
  assert(hyphenRootRoute && hyphenRootRoute.routeTargets.includes('omega'), 'hyphenated set-root scripts should expose route targets', hyphenRootRoute);
  const ternaryRoute = model.scripts.blocks.find((block) => block.id === 'ternary_route');
  assert(ternaryRoute && dynamicWrites(ternaryRoute).some((write) => write.shape === 'ternary_literal' && routeWriteTargets(write).length === 2), 'ternary route-quality writes should produce finite dynamic route evidence', ternaryRoute);
  const mapRoute = model.scripts.blocks.find((block) => block.id === 'map_route');
  assert(mapRoute && dynamicWrites(mapRoute).some((write) => write.shape === 'finite_object_map' && routeWriteTargets(write).includes('beta') && routeWriteTargets(write).includes('omega')), 'finite object maps should produce guided dynamic route evidence', mapRoute);
  const ifElseRoute = model.scripts.blocks.find((block) => block.id === 'if_else_route');
  assert(ifElseRoute && dynamicWrites(ifElseRoute).some((write) => write.shape === 'if_else_literal' && routeWriteTargets(write).length === 2), 'simple if/else literal route writes should produce guided dynamic route evidence', ifElseRoute);
  const randomRoute = model.scripts.blocks.find((block) => block.id === 'random_route');
  assert(randomRoute && randomRoute.safetyClass === 'manual_boundary' && !dynamicWrites(randomRoute).length, 'random route writes should remain a manual boundary without guided candidates', randomRoute);
  const dynamicEvidence = model.routes.items.filter((route) => route.semanticTier === 'guided_profile' && route.dynamicBinding && route.dynamicBinding.kind === 'route_quality_write');
  assert(dynamicEvidence.length >= 4, 'finite route-quality writes should become guided/profile route evidence', dynamicEvidence);
  assert(dynamicEvidence.every((route) => route.targetResolution && route.targetResolution.status === 'dynamic_finite' && !route.safeEditEligible), 'dynamic route evidence should expose finite resolution without safe inline editing', dynamicEvidence);
  const openingRoute = model.routes.items.find((route) => route.target === 'opening');
  assert(openingRoute && openingRoute.evidenceClass === 'exact' && openingRoute.sourceLocated, 'source-located routes to body sections should not be fuzzy or missing', openingRoute);
  const externalProjectRoute = model.routes.items.find((route) => route.target === 'external_project_scene');
  assert(externalProjectRoute && externalProjectRoute.targetResolved && externalProjectRoute.evidenceClass === 'exact', 'known project scene routes should resolve instead of becoming missing targets', externalProjectRoute);
  const goToRefRoute = model.routes.items.find((route) => route.dynamicBinding && route.dynamicBinding.kind === 'go_to_ref');
  assert(goToRefRoute && goToRefRoute.evidenceClass === 'script_derived' && goToRefRoute.semanticTier === 'guided_profile' && goToRefRoute.targetResolution.status === 'dynamic_finite', 'go-to-ref should be quality-backed dynamic route evidence, not a missing target', goToRefRoute);
  const profileRoute = model.routes.items.find((route) => route.sourceKind === 'profile' && route.dynamicBinding && route.dynamicBinding.kind === 'profile_route_table');
  assert(profileRoute && profileRoute.semanticTier === 'guided_profile' && profileRoute.dynamicBinding.profileBacked && profileRoute.targetResolution.status === 'dynamic_finite', 'profile route helper tables should become guided dynamic evidence without project hardcoding', profileRoute);
  const shadowedRoute = model.routes.items.find((route) => route.target === 'shared_shadow');
  assert(shadowedRoute && shadowedRoute.targetResolution && shadowedRoute.targetResolution.status === 'ambiguous' && shadowedRoute.targetResolution.shadowed && !shadowedRoute.safeEditEligible, 'local/global shadowed route targets should carry ambiguity proof and not become safe edits', shadowedRoute);
  const aliasRoute = model.routes.items.find((route) => route.target === 'profile_alias_target');
  assert(aliasRoute && aliasRoute.semanticTier === 'guided_profile' && aliasRoute.targetResolution && aliasRoute.targetResolution.status === 'profile_alias' && aliasRoute.targetResolution.resolvedId === 'external_project_scene' && !aliasRoute.safeEditEligible, 'profile static aliases should resolve as guided evidence without becoming safe structured edits', aliasRoute);
  assert(model.routeGuidedEdits && model.routeGuidedEdits.entries.some((entry) => entry.kind === 'route_table_binding' && entry.safeEditEligible), 'routeQualityVars / helper tables should feed the route table guided editor', model.routeGuidedEdits);
  assert(model.routeGuidedEdits.entries.some((entry) => entry.kind === 'route_table_binding' && !entry.safeEditEligible && entry.manualReasons.includes('manual_script_boundary')), 'manual dynamic route scripts should stay Source Slice/manual in guided edit evidence', model.routeGuidedEdits);

  const replacement = routeScript.composeScriptBlockReplacement(guided, {
    statement_1: {variable: 'pressure', op: '+=', value: '3'},
    flag: {variable: 'flag', op: '=', value: 'false'}
  });
  assert(replacement.includes('Q.pressure += 3'), 'guided replacement should update the first statement', replacement);
  assert(replacement.includes('Q.flag = false'), 'guided replacement should update a statement by variable key', replacement);

  const applied = routeScript.applySafeScriptEffects({pressure: 0, route_gate: 0}, model, {});
  assert(applied.state.pressure === 2, 'safe script simulation should apply numeric increments', applied);
  assert(applied.state.flag === true, 'safe script simulation should apply boolean flags', applied);
  assert(applied.state.route_gate === 1, 'safe script simulation should apply route predicate state', applied);
  assert(applied.state.conditional_support === 1, 'safe script simulation should apply simple conditional effects when the seeded state passes', applied);
  assert(applied.state.calculated_support === undefined, 'advanced calculated effects should not be simulated as safe effects', applied);
  assert(applied.warnings.some((warning) => warning.includes('Display script')), 'unsafe display script influence should be reported', applied);

  const trialBody = routeScript.enrichEventBody(body, {});
  const trial = complexAuthoring.runTrial(trialBody, {
    initialState: {pressure: 0, route_gate: 0},
    paths: [{name: 'script_unblocks_choice', choices: ['organize']}]
  });
  assert(trial.ok, 'script-aware trial run should let safe scripts affect choice availability', trial);
  assert(trial.paths[0].steps[0].scriptEffects.some((effect) => effect === 'Q.pressure += 2'), 'trial step should report safe script effects', trial.paths[0]);

  const enriched = routeScript.enrichEventBody(body, {});
  const enrichedModel = {mode: 'existing', objectKind: 'event', title: 'Route Script Fixture', eventBody: enriched};
  const enrichedPanels = previewEditor.renderEventReviewDetailsPanels(enriched, enrichedModel);
  const html = previewEditor.render(enrichedModel) + enrichedPanels;
  assert(html.includes('data-preview-object-route-script="true"'), 'event editor should render route/script intelligence summary');
  assert(html.includes('preview-object-route-script-summary') && html.includes('preview-object-route-script-chips'), 'route/script review should render a collapsible summary with counts');
  assert(html.includes('data-preview-object-route-evidence="true"'), 'event editor should render route evidence');
  assert(html.includes('data-preview-object-script-impact="true"'), 'event editor should render script impact');
  const modalHtml = previewEditor.renderModal(enrichedModel) + enrichedPanels;
  assert((modalHtml.match(/data-preview-object-route-script="true"/g) || []).length === 1, 'modal editor should show route/script review only once');
  const previewPaneHtml = previewEditor.renderPreviewPane(enrichedModel);
  assert(!previewPaneHtml.includes('data-preview-object-route-script="true"'), 'live preview pane should not duplicate route/script review');
  const quietModel = {mode: 'existing', objectKind: 'event', title: 'Quiet Route Script Fixture', eventBody: routeScript.enrichEventBody(quietBody(), {})};
  const quietHtml = previewEditor.render(quietModel) + previewEditor.renderEventReviewDetailsPanels(quietModel.eventBody, quietModel);
  assert(!quietHtml.includes('data-preview-object-route-script="true"'), 'exact routes and simple guided effects should not render a no-op route/script review panel');

  const structuredBody = eventStructure.toEventBody(eventStructure.fromEditingContext({
    sceneId: 'route_script_fixture',
    title: 'Route Script Fixture',
    source: src('source/scenes/events/route_script.scene.dry', 1, 'title: Route Script Fixture')
  }, null, {body}), {});
  const routeMap = structuredBody.eventGraph || {};
  assert(routeMap.edges.some((edge) => edge.routeEvidenceId && edge.evidenceClass === 'missing_target' && edge.kind === 'missing_route' && edge.editAction && edge.editAction.actionKind === 'open_route_editor' && !edge.editAction.draftAction), 'existing Route Map should surface missing route evidence through the safe route editor', routeMap.edges);
  assert(routeMap.edges.some((edge) => edge.routeEvidenceId && edge.evidenceClass === 'script_derived' && ['script_route', 'dynamic_route'].includes(edge.kind) && edge.semanticTier === 'guided_profile' && edge.dynamicBinding && edge.editAction && edge.editAction.actionKind === 'open_source_slice'), 'script-derived Route Map evidence should route to Source Slice instead of a draft rewrite', routeMap.edges);
  assert(routeMap.nodes.some((node) => node.kind === 'missing_route_target'), 'Route Map should include a visible missing-target node', routeMap.nodes);
  assert(routeMap.reviewHints.some((hint) => hint.key === 'missing_target' && hint.count >= 1), 'Route Map should expose missing-target review hints from model evidence', routeMap.reviewHints);
  assert(routeMap.reviewHints.some((hint) => hint.key === 'manual_boundary' && hint.count >= 1), 'Route Map should expose manual script boundary review hints from model evidence', routeMap.reviewHints);
  assert(routeMap.reviewHintCounts && routeMap.reviewHintCounts.missing_target && routeMap.reviewHintCounts.missing_target.count >= 1, 'Route Map should expose model-owned review hint counts for missing targets', routeMap.reviewHintCounts);
  assert(routeMap.reviewHintCounts && routeMap.reviewHintCounts.manual_boundary && routeMap.reviewHintCounts.manual_boundary.count >= 1, 'Route Map should expose model-owned review hint counts for manual script boundaries', routeMap.reviewHintCounts);
  const routeMapModel = {mode: 'existing', objectKind: 'event', title: 'Route Script Fixture', eventBody: structuredBody};
  const routeMapHtml = previewEditor.render(routeMapModel) + previewEditor.renderEventReviewDetailsPanels(structuredBody, routeMapModel);
  assert(routeMapHtml.includes('data-preview-object-route-edge-id="edge:evidence:'), 'rendered Route Map should include model-provided evidence edges', routeMapHtml);
  assert(routeMapHtml.includes('data-route-map-review-chip="missing_target"'), 'rendered Route Map should show model-provided missing-target review chips', routeMapHtml);
  assert(routeMapHtml.includes('data-preview-object-route-causal-flow="true"') && routeMapHtml.includes('data-route-causal-edge="'), 'rendered Route Map should show cause/gate/result route flow rows', routeMapHtml);
  assert(routeMapHtml.includes('preview-object-route-chip is-warning'), 'rendered Route Map should classify risky chips with the shared warning visual tone', routeMapHtml);
  assert(routeMapHtml.includes('target: shadowed'), 'rendered Route Map should expose target resolution proof for shadowed local/global routes', routeMapHtml);
  assert(routeMapHtml.includes('guided/profile') && routeMapHtml.includes('Q route write'), 'rendered Route Map should show semantic-tier and dynamic-binding chips for guided dynamic routes', routeMapHtml);
  assert(routeMapHtml.includes('data-preview-object-route-guided-edits="true"') && routeMapHtml.includes('preview-object-route-guided-header'), 'rendered Route Map should show guided route edit tools as a recommended action panel', routeMapHtml);

  return {
    ok: true,
    routeClasses: Array.from(classes).sort(),
    scriptBlocks: model.scripts.blocks.length,
    opaqueJsBlocks: model.summary.opaqueJsBlocks,
    guidedScriptEdits: model.guidedScriptEdits.length,
    diagnostics: model.diagnostics.length
  };
}

if (require.main === module) {
  process.stdout.write(JSON.stringify(runRouteScriptIntelligence(), null, 2) + '\n');
} else {
  module.exports = {runRouteScriptIntelligence};
}
