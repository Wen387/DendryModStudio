#!/usr/bin/env node
'use strict';

const coverage = require('./authoring/visible_object_coverage_model.js');
const semanticLogic = require('./authoring/semantic_logic_editor_model.js');
const routeGuided = require('./authoring/route_guided_edit_model.js');

function fail(message, details) {
  process.stderr.write(JSON.stringify(Object.assign({ok: false, message}, details || {}), null, 2) + '\n');
  process.exit(1);
}

function assert(condition, message, details) {
  if (!condition) {
    fail(message, details);
  }
}

function src(path, line, anchorText) {
  return {path, line, startLine: line, endLine: line, anchorText, endAnchorText: anchorText};
}

const protectedPath = 'source/scenes/post_event.scene.dry';
const eventPath = 'source/scenes/events/monthly_link.scene.dry';
const index = {
  project: {name: 'Route Editor Workflow Fixture', root: '/tmp/route-editor', profileIds: ['generic-dendry']},
  scenes: [{
    id: 'route_heavy',
    title: 'Route Heavy',
    path: protectedPath,
    type: 'event',
    sourceSpan: {path: protectedPath, startLine: 100, endLine: 140},
    options: [{
      target: {id: 'fallback_event'},
      title: 'Fallback route',
      sourceSpan: src(protectedPath, 120, '- @fallback_event: Fallback route')
    }],
    sections: [{
      id: 'route_heavy.conditional',
      title: 'Conditional',
      sourceSpan: {path: protectedPath, startLine: 122, endLine: 126},
      routes: {goTo: [{id: 'alpha', raw: 'alpha if Q.route_flag', predicate: 'Q.route_flag'}, {id: 'omega', raw: 'omega'}]},
      options: []
    }]
  }, {
    id: 'monthly_link',
    title: 'Monthly Link',
    path: eventPath,
    type: 'event',
    sourceSpan: {path: eventPath, startLine: 1, endLine: 40},
    options: []
  }],
  variables: [],
  semantic: {
    events: [{id: 'route_heavy', title: 'Route Heavy', path: protectedPath}, {id: 'monthly_link', title: 'Monthly Link', path: eventPath}],
    cards: [],
    news: {
      items: [{
        id: 'monthly_router_entry',
        headline: 'Monthly Link',
        delivery: 'legacy_event_popup',
        source: src(protectedPath, 12, '- @monthly_link: Monthly Link')
      }],
      eventPopups: [{
        id: 'monthly_popup',
        title: 'Monthly Link',
        linkedSceneId: 'monthly_link',
        excerptSource: src(eventPath, 8, 'Monthly visible text.')
      }]
    },
    textCorpus: {
      items: [
        {id: 'route_option', text: 'Fallback route', role: 'option_label', owner: {kind: 'scene', sceneId: 'route_heavy', sectionId: 'start', itemId: 'fallback_event'}, source: src(protectedPath, 120, '- @fallback_event: Fallback route')},
        {id: 'monthly_body', text: 'Monthly visible text.', role: 'body', owner: {kind: 'scene', sceneId: 'monthly_link', sectionId: 'start'}, source: src(eventPath, 8, 'Monthly visible text.')}
      ]
    },
    parserEvidence: {
      schemaVersion: '0.2',
      kind: 'parser_semantic_evidence',
      core: {
        routeOrderGroups: [{
          id: 'route_heavy_order',
          sceneId: 'route_heavy',
          ownerId: 'route_heavy',
          routeField: 'goTo',
          chainContext: 'ordered_chain',
          source: src(protectedPath, 122, 'alpha if Q.route_flag'),
          parserBacked: true,
          clauses: [
            {order: 1, rawTarget: 'alpha', resolvedTarget: 'route_heavy.alpha', targetResolved: true, predicate: 'Q.route_flag', isFallback: false},
            {order: 2, rawTarget: 'omega', resolvedTarget: 'route_heavy.omega', targetResolved: true, predicate: '', isFallback: true}
          ]
        }],
        dynamicKeyEvidence: [],
        effectClauses: []
      },
      monthlyPopupRouterTable: [{
        id: 'monthly_router_row',
        linkedSceneId: 'monthly_link',
        title: 'Monthly Link',
        router: {tag: 'event', anchor: 'events_choice', source: src(protectedPath, 12, '- @monthly_link: Monthly Link')},
        contentSource: src(eventPath, 8, 'Monthly visible text.'),
        installSafety: 'manual_review',
        reviewBoundary: 'manual_review'
      }]
    }
  }
};

function rowWhere(rows, predicate, message) {
  const row = rows.find(predicate);
  assert(row, message, rows.map((item) => ({id: item.id, role: item.role, action: item.editAction && item.editAction.actionKind, semantic: item.editAction && item.editAction.semanticEditor})));
  return row;
}

function semanticEdit(row, replacementText) {
  const model = semanticLogic.buildSemanticLogicEditor(index, row);
  assert(model.ok, 'route semantic action should open Route Editor', {row, model});
  assert(model.editorKind === 'route_order', 'route semantic action should use route editor kind', model);
  const proposal = semanticLogic.buildProposal(model, {replacementText});
  assert(proposal.ok, 'route semantic edit should build an install proposal', proposal);
  const operation = proposal.installPlan.operations[0];
  assert(operation && operation.type !== 'manual_snippet', 'route semantic edit should be executable', {row, operation});
  return {model, operation};
}

const report = coverage.buildCoverageReport(index, {includeVariables: true, includeStructuredLogic: true});
const rows = report.rows.filter((row) => row.visibleContent);

assert(report.summary.structuredRouteEditorCoverage === 1, 'all structured routes should have route editor metadata', report.summary);

const protectedRoute = rowWhere(rows, (row) => row.view === 'structuredLogic' && row.role === 'route' && row.installSafety === 'advanced_apply', 'protected conditional route should expose advanced route editor');
const protectedEdit = semanticEdit(protectedRoute, '- @new_fallback: Updated fallback route');
assert(protectedEdit.operation.safety === 'advanced_apply', 'protected route editor operation should stay advanced_apply', protectedEdit.operation);
assert(protectedEdit.model.routeEvidence.length >= 1, 'conditional route editor should expose route-order evidence', protectedEdit.model.routeEvidence);

const routeOrderModel = semanticLogic.buildSemanticLogicEditor(index, {
  id: 'route_order_group',
  label: 'alpha if Q.route_flag',
  role: 'route',
  sceneId: 'route_heavy',
  editAction: {
    actionKind: 'open_source_slice',
    semanticEditor: {kind: 'route_order', role: 'route', sceneId: 'route_heavy'},
    source: src(protectedPath, 122, 'alpha if Q.route_flag'),
    installSafety: 'advanced_apply',
    operationType: 'replace_text'
  }
});
assert(routeOrderModel.ok, 'route-order group should open the route editor', routeOrderModel);
assert(routeOrderModel.fieldControls.routeClauses.length === 2, 'conditional route editor should expose the whole route-order chain', routeOrderModel.fieldControls);
const routeBundleReplacement = semanticLogic.composeFieldReplacement(routeOrderModel, {
  'semantic_logic.routeClauses': [
    {target: 'beta', predicate: 'Q.route_flag'},
    {target: 'omega', isFallback: true}
  ]
});
assert(routeBundleReplacement === 'beta if Q.route_flag; omega', 'guided route editor should compose multi-clause route-order replacements', {routeBundleReplacement});
const routeBundleProposal = semanticLogic.buildProposal(routeOrderModel, {
  'semantic_logic.routeClauses': [
    {target: 'beta', predicate: 'Q.route_flag'},
    {target: 'omega', isFallback: true}
  ]
});
assert(routeBundleProposal.ok, 'guided route-order bundle should build an install proposal', routeBundleProposal);
assert(routeBundleProposal.replacementText === 'beta if Q.route_flag; omega', 'guided route-order proposal should preserve fallback clauses', routeBundleProposal);

const routerEntry = rowWhere(rows, (row) => row.id === 'news:monthly_router_entry' && row.editAction && row.editAction.semanticEditor && row.editAction.semanticEditor.kind === 'route_order', 'monthly router row should expose route editor metadata');
const routerEdit = semanticEdit(routerEntry, '- @monthly_link: Updated Monthly Link');
assert(routerEdit.operation.safety === 'advanced_apply', 'monthly router route editor operation should stay advanced_apply', routerEdit.operation);
assert(routerEdit.model.routerEvidence.length >= 1, 'monthly router route editor should expose router table evidence', routerEdit.model.routerEvidence);

const goToModel = semanticLogic.buildSemanticLogicEditor(index, {
  id: 'go_to_route_line',
  label: 'go-to: old_target',
  role: 'route',
  sceneId: 'go_to_event',
  editAction: {
    actionKind: 'open_source_slice',
    semanticEditor: {kind: 'route_order', role: 'route', sceneId: 'go_to_event'},
    source: src('source/scenes/events/go_to.scene.dry', 9, 'go-to: old_target'),
    installSafety: 'guarded_apply',
    operationType: 'replace_text'
  }
});
assert(goToModel.ok, 'go-to route line should open the route editor', goToModel);
const goToReplacement = semanticLogic.composeFieldReplacement(goToModel, {'semantic_logic.routeTarget': 'new_target'});
assert(goToReplacement === 'go-to: new_target', 'guided route editor should preserve go-to syntax', {goToReplacement, controls: goToModel.fieldControls});
const goToBundleReplacement = semanticLogic.composeFieldReplacement(goToModel, {
  'semantic_logic.routeClauses': [
    {target: 'new_target', predicate: 'Q.ready'},
    {target: 'fallback_target', isFallback: true}
  ]
});
assert(goToBundleReplacement === 'go-to: new_target if Q.ready; fallback_target', 'guided route editor should preserve go-to syntax for route bundles', {goToBundleReplacement, controls: goToModel.fieldControls});

const guidedBody = {
  id: 'guided_workflow',
  routeEvidenceMap: {
    items: [
      {id: 'utility_call', sourceKind: 'flow', from: 'guided_workflow', owner: 'guided_workflow', target: 'utility_scene', rawTarget: 'utility_scene', predicate: '', evidenceClass: 'parser_backed', parserBacked: true, confidence: 'exact', source: src(eventPath, 24, 'go-to: utility_scene'), diagnostics: []},
      {id: 'utility_jump', sourceKind: 'flow', from: 'guided_workflow', owner: 'guided_workflow', target: 'return_scene', rawTarget: 'return_scene', predicate: '', evidenceClass: 'script_derived', parserBacked: true, confidence: 'exact', source: src(eventPath, 25, 'set-jump: return_scene'), dynamicBinding: {kind: 'set_jump', primaryTarget: 'return_scene', candidateTargets: ['return_scene']}, diagnostics: []}
    ],
    summary: {}
  },
  routeUnderstanding: {
    utilityCalls: [{
      from: 'guided_workflow',
      utilitySceneId: 'utility_scene',
      setJumpTarget: 'return_scene',
      returnBinding: 'jumpScene',
      utilityKind: 'single_slot_return_utility',
      semanticTier: 'guided_profile',
      evidenceClass: 'profile_utility',
      safeEditEligible: false,
      source: src(eventPath, 24, 'go-to: utility_scene')
    }]
  },
  scriptImpactMap: {
    blocks: [{
      id: 'route_table',
      label: 'Route table',
      scriptKind: 'script',
      rawText: 'Q.next_scene = "return_scene"',
      source: src(eventPath, 26, 'Q.next_scene = "return_scene"'),
      safetyClass: 'guided',
      routeInfluence: true,
      dynamicRouteWrites: [{shape: 'literal_assignment', variable: 'next_scene', candidateTargets: ['return_scene'], primaryTarget: 'return_scene'}],
      reads: [],
      writes: ['next_scene'],
      guidedEdits: []
    }, {
      id: 'manual_route_table',
      label: 'Manual route table',
      scriptKind: 'opaque_js',
      rawText: 'Q.next_scene = pickRoute()',
      source: src(eventPath, 27, 'Q.next_scene = pickRoute()'),
      safetyClass: 'manual_boundary',
      routeInfluence: true,
      dynamicRouteWrites: [],
      boundaryReasons: ['runtime_or_function_side_effect'],
      reads: [],
      writes: ['next_scene'],
      guidedEdits: []
    }],
    summary: {},
    categorySummary: {},
    manualCategorySummary: {},
    advancedCategorySummary: {}
  }
};
const guidedProfile = [{utilityRouteScenes: [{sceneId: 'utility_scene', utilityKind: 'single_slot_return_utility', returnBinding: 'jumpScene'}]}];
const guidedEntries = routeGuided.buildRouteGuidedEditModel(guidedBody, {
  profileEvidence: guidedProfile,
  routeOrderGroups: [{
    id: 'guided_fallback',
    sceneId: 'guided_workflow',
    ownerId: 'guided_workflow',
    routeField: 'goTo',
    source: src(eventPath, 28, 'go-to: alpha if Q.route_flag = 1; omega'),
    sourceRaw: 'go-to: alpha if Q.route_flag = 1; omega',
    clauses: [
      {rawTarget: 'alpha', predicate: 'Q.route_flag = 1', isFallback: false},
      {rawTarget: 'omega', predicate: '', isFallback: true}
    ]
  }, {
    id: 'guided_compound_fallback',
    sceneId: 'guided_workflow',
    ownerId: 'guided_workflow',
    routeField: 'goTo',
    source: src(eventPath, 29, 'go-to: alpha if Q.route_flag = 1 and Q.mode = 2; omega'),
    sourceRaw: 'go-to: alpha if Q.route_flag = 1 and Q.mode = 2; omega',
    clauses: [
      {rawTarget: 'alpha', predicate: 'Q.route_flag = 1 and Q.mode = 2', isFallback: false},
      {rawTarget: 'omega', predicate: '', isFallback: true}
    ]
  }]
}).entries;
['utility_pair', 'route_table_binding', 'explicit_fallback_helper'].forEach((kind) => {
  const entry = guidedEntries.find((item) => item.kind === kind && item.safeEditEligible);
  assert(entry && entry.editAction && entry.editAction.actionKind === 'open_route_editor' && entry.editAction.semanticEditor && entry.editAction.semanticEditor.kind === kind && !entry.editAction.draftAction, kind + ' should open Semantic Logic without draft rewrite actions', entry);
});
const manualGuided = guidedEntries.find((item) => item.kind === 'route_table_binding' && item.manualReasons.includes('manual_script_boundary'));
assert(manualGuided && manualGuided.editAction && manualGuided.editAction.actionKind === 'open_source_slice' && !manualGuided.editAction.semanticEditor && !manualGuided.editAction.draftAction, 'manual guided route table evidence should route to Source Slice without draft rewrite', manualGuided);

process.stdout.write(JSON.stringify({
  ok: true,
  protectedRoute: protectedEdit.operation.type + ':' + protectedEdit.operation.safety,
  monthlyRouter: routerEdit.operation.type + ':' + routerEdit.operation.safety,
  routeBundle: routeBundleProposal.installPlan.operations[0].type + ':' + routeBundleProposal.installPlan.operations[0].safety,
  structuredRouteEditorCoverage: report.summary.structuredRouteEditorCoverage
}, null, 2) + '\n');
