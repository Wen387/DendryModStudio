#!/usr/bin/env node
// @ts-check
'use strict';

const routeScript = require('./authoring/route_script_intelligence_model.js');
const complexAuthoring = require('./authoring/complex_event_authoring_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');

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
  return {path, line, startLine: line, endLine: line, anchorText, endAnchorText: anchorText};
}

function fixtureBody() {
  return {
    mode: 'existing',
    eventShape: 'choice_event',
    eventStructure: {id: 'route_script_fixture'},
    projectSceneIds: ['external_project_scene'],
    title: {id: 'title', label: 'Title', value: 'Route Script Fixture'},
    sections: [{id: 'opening', label: 'Opening', value: 'Opening text'}],
    branchSections: [
      {id: 'beta_body', sectionId: 'beta', label: 'Beta', value: 'Beta branch', condition: 'Q.pressure >= 2'},
      {id: 'omega_body', sectionId: 'omega', label: 'Omega', value: 'Omega fallback'}
    ],
    options: [
      {id: 'organize', optionId: 'organize', label: 'Organize pressure', targetId: 'beta', chooseIf: 'Q.pressure >= 2', fields: []}
    ],
    flow: {
      edges: [
        {kind: 'route', from: 'root', to: 'beta', source: src('source/scenes/events/route_script.scene.dry', 10, 'go-to: beta')},
        {kind: 'conditional_route', from: 'beta', to: 'omega', condition: 'Q.route_gate = 1', parserBacked: true, source: src('source/scenes/events/route_script.scene.dry', 20, 'omega if Q.route_gate = 1')},
        {kind: 'route', from: 'beta', to: 'opening', source: {path: 'source/scenes/events/route_script.scene.dry', line: 21, excerpt: '21: go-to: opening'}},
        {kind: 'route', from: 'beta', to: 'external_project_scene', source: src('source/scenes/events/route_script.scene.dry', 22, 'go-to: external_project_scene')},
        {kind: 'route', from: 'beta', to: 'lost_branch', source: src('source/scenes/events/route_script.scene.dry', 30, 'go-to: lost_branch')},
        {kind: 'route', from: 'omega', to: 'root', source: src('source/scenes/events/route_script.scene.dry', 40, 'go-to: root')},
        {kind: 'route', from: 'omega', to: 'runtime:post_event', source: src('source/scenes/events/route_script.scene.dry', 41, 'go-to: runtime:post_event')}
      ]
    },
    metaFields: [
      {id: 'approx_route', role: 'route', label: 'Approx route', value: 'omega', confidence: 'approximate', source: {}}
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

function runRouteScriptIntelligence() {
  const body = fixtureBody();
  const model = routeScript.buildRouteScriptIntelligence(body, {});
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
  const openingRoute = model.routes.items.find((route) => route.target === 'opening');
  assert(openingRoute && openingRoute.evidenceClass === 'exact' && openingRoute.sourceLocated, 'source-located routes to body sections should not be fuzzy or missing', openingRoute);
  const externalProjectRoute = model.routes.items.find((route) => route.target === 'external_project_scene');
  assert(externalProjectRoute && externalProjectRoute.targetResolved && externalProjectRoute.evidenceClass === 'exact', 'known project scene routes should resolve instead of becoming missing targets', externalProjectRoute);

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
  const html = previewEditor.render({mode: 'existing', objectKind: 'event', title: 'Route Script Fixture', eventBody: enriched});
  assert(html.includes('data-preview-object-route-script="true"'), 'event editor should render route/script intelligence summary');
  assert(html.includes('preview-object-route-script-summary') && html.includes('preview-object-route-script-chips'), 'route/script review should render a collapsible summary with counts');
  assert(html.includes('data-preview-object-route-evidence="true"'), 'event editor should render route evidence');
  assert(html.includes('data-preview-object-script-impact="true"'), 'event editor should render script impact');
  const modalHtml = previewEditor.renderModal({mode: 'existing', objectKind: 'event', title: 'Route Script Fixture', eventBody: enriched});
  assert((modalHtml.match(/data-preview-object-route-script="true"/g) || []).length === 1, 'modal editor should show route/script review only once');
  const previewPaneHtml = previewEditor.renderPreviewPane({mode: 'existing', objectKind: 'event', title: 'Route Script Fixture', eventBody: enriched});
  assert(!previewPaneHtml.includes('data-preview-object-route-script="true"'), 'live preview pane should not duplicate route/script review');
  const quietHtml = previewEditor.render({mode: 'existing', objectKind: 'event', title: 'Quiet Route Script Fixture', eventBody: routeScript.enrichEventBody(quietBody(), {})});
  assert(!quietHtml.includes('data-preview-object-route-script="true"'), 'exact routes and simple guided effects should not render a no-op route/script review panel');

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
