#!/usr/bin/env node
// @ts-check
'use strict';

const routeGuided = require('./authoring/route_guided_edit_model.js');
const routeScript = require('./authoring/route_script_intelligence_model.js');
const semanticLogic = require('./authoring/semantic_logic_editor_model.js');
const workspace = require('./viewer/semantic_logic_workspace_ui.js');

const {fail, assert} = require('./check_harness.js');

function src(path, line, anchorText) {
  return {path, line, startLine: line, endLine: line, anchorText, endAnchorText: anchorText};
}

const path = 'source/scenes/events/presidential_guided.scene.dry';
const utilityPath = 'source/scenes/events/election_algorithm.scene.dry';
const profileEvidence = [{
  profileId: 'presidential-fixture',
  routeQualityVars: ['next_scene'],
  utilityRouteScenes: [{sceneId: 'election_algorithm', utilityKind: 'single_slot_return_utility', returnBinding: 'jumpScene'}],
  routeHelperTables: [{
    routeVar: 'profile_next_scene',
    targets: ['profile_a', 'profile_b'],
    source: src('source/profile/route_table.json', 4, '"profile_a", "profile_b"'),
    sourceText: '"profile_a", "profile_b"'
  }]
}];
const projectIndex = {
  schemaVersion: '0.1',
  project: {name: 'Guided route fixture', root: '/tmp/guided-route', profileIds: ['presidential-fixture']},
  scenes: [
    {id: 'pres_event', path},
    {id: 'election_algorithm', path: utilityPath},
    {id: 'pres_return', path},
    {id: 'a', path},
    {id: 'b', path},
    {id: 'c', path},
    {id: 'profile_a', path},
    {id: 'profile_b', path}
  ],
  semantic: {
    parserEvidence: {
      profiles: profileEvidence,
      core: {
        routeOrderGroups: [{
          id: 'fallback_group',
          sceneId: 'pres_event',
          ownerId: 'pres_event',
          routeField: 'goTo',
          source: src(path, 14, 'go-to: a if Q.x = 1; b'),
          sourceRaw: 'go-to: a if Q.x = 1; b',
          clauses: [
            {order: 1, rawTarget: 'a', predicate: 'Q.x = 1', isFallback: false},
            {order: 2, rawTarget: 'b', predicate: '', isFallback: true}
          ]
        }, {
          id: 'compound_fallback_group',
          sceneId: 'pres_event',
          ownerId: 'pres_event',
          routeField: 'goTo',
          source: src(path, 15, 'go-to: a if Q.x = 1 and Q.y = 2; b'),
          sourceRaw: 'go-to: a if Q.x = 1 and Q.y = 2; b',
          clauses: [
            {order: 1, rawTarget: 'a', predicate: 'Q.x = 1 and Q.y = 2', isFallback: false},
            {order: 2, rawTarget: 'b', predicate: '', isFallback: true}
          ]
        }]
      }
    }
  }
};

const body = {
  id: 'pres_event',
  projectIndex,
  profileEvidence,
  routeEvidenceMap: {
    items: [
      {id: 'call', sourceKind: 'flow', from: 'pres_event', owner: 'pres_event', target: 'election_algorithm', rawTarget: 'election_algorithm', predicate: '', evidenceClass: 'parser_backed', semanticTier: 'static_exact', parserBacked: true, confidence: 'exact', safeEditEligible: true, source: src(path, 10, 'go-to: election_algorithm'), diagnostics: []},
      {id: 'jump', sourceKind: 'flow', from: 'pres_event', owner: 'pres_event', target: 'pres_return', rawTarget: 'pres_return', predicate: '', evidenceClass: 'script_derived', semanticTier: 'guided_profile', parserBacked: true, confidence: 'exact', safeEditEligible: false, source: src(path, 11, 'set-jump: pres_return'), dynamicBinding: {kind: 'set_jump', variable: 'jumpScene', primaryTarget: 'pres_return', candidateTargets: ['pres_return']}, diagnostics: []},
      {id: 'ref', sourceKind: 'flow', from: 'pres_event', owner: 'pres_event', target: 'quality_ref:next_scene', rawTarget: 'next_scene', predicate: '', evidenceClass: 'script_derived', semanticTier: 'guided_profile', parserBacked: true, confidence: 'profile', safeEditEligible: false, source: src(path, 12, 'go-to-ref: next_scene'), dynamicBinding: {kind: 'go_to_ref', variable: 'next_scene', candidateTargets: ['a', 'b']}, diagnostics: []}
    ],
    summary: {}
  },
  routeUnderstanding: {
    schemaVersion: '0.1',
    kind: 'route_understanding',
    eventId: 'pres_event',
    summary: {},
    eventChain: {items: []},
    schedulerContext: {items: []},
    utilityCalls: [{
      from: 'pres_event',
      utilitySceneId: 'election_algorithm',
      setJumpTarget: 'pres_return',
      returnBinding: 'jumpScene',
      utilityKind: 'single_slot_return_utility',
      semanticTier: 'guided_profile',
      evidenceClass: 'profile_utility',
      safeEditEligible: false,
      source: src(path, 10, 'go-to: election_algorithm')
    }],
    stateDependencies: []
  },
  scriptImpactMap: {
    blocks: [{
      id: 'literal',
      label: 'Literal route write',
      scriptKind: 'script',
      rawText: 'Q.next_scene = "a"',
      source: src(path, 20, 'Q.next_scene = "a"'),
      safetyClass: 'guided',
      routeInfluence: true,
      dynamicRouteWrites: [{kind: 'route_quality_write', shape: 'literal_assignment', variable: 'next_scene', candidateTargets: ['a'], primaryTarget: 'a'}],
      reads: [],
      writes: ['next_scene'],
      guidedEdits: []
    }, {
      id: 'ternary',
      label: 'Ternary route write',
      scriptKind: 'script',
      rawText: 'Q.next_scene = Q.flag ? "a" : "b"',
      source: src(path, 21, 'Q.next_scene = Q.flag ? "a" : "b"'),
      safetyClass: 'guided',
      routeInfluence: true,
      dynamicRouteWrites: [{kind: 'route_quality_write', shape: 'ternary_literal', variable: 'next_scene', candidateTargets: ['a', 'b'], primaryTarget: 'a', condition: 'Q.flag'}],
      reads: ['flag'],
      writes: ['next_scene'],
      guidedEdits: []
    }, {
      id: 'object_map',
      label: 'Object map route write',
      scriptKind: 'script',
      rawText: 'Q.next_scene = {left: "a", right: "b"}[Q.route_key]',
      source: src(path, 22, 'Q.next_scene = {left: "a", right: "b"}[Q.route_key]'),
      safetyClass: 'guided',
      routeInfluence: true,
      dynamicRouteWrites: [{kind: 'route_quality_write', shape: 'finite_object_map', variable: 'next_scene', selector: 'route_key', candidateTargets: ['a', 'b'], primaryTarget: 'a'}],
      reads: ['route_key'],
      writes: ['next_scene'],
      guidedEdits: []
    }, {
      id: 'if_else',
      label: 'If else route write',
      scriptKind: 'script',
      rawText: 'if (Q.flag) { Q.next_scene = "a"; } else { Q.next_scene = "b"; }',
      source: src(path, 23, 'if (Q.flag) { Q.next_scene = "a"; } else { Q.next_scene = "b"; }'),
      safetyClass: 'guided',
      routeInfluence: true,
      dynamicRouteWrites: [{kind: 'route_quality_write', shape: 'if_else_literal', variable: 'next_scene', condition: 'Q.flag', candidateTargets: ['a', 'b'], primaryTarget: 'a'}],
      reads: ['flag'],
      writes: ['next_scene'],
      guidedEdits: []
    }, {
      id: 'random',
      label: 'Random route write',
      scriptKind: 'opaque_js',
      rawText: 'Q.next_scene = Math.random() > 0.5 ? "a" : externalPick()',
      rawPreview: 'Q.next_scene = Math.random() > 0.5 ? "a" : externalPick()',
      source: src(path, 30, 'Q.next_scene = Math.random() > 0.5 ? "a" : externalPick()'),
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

const model = routeGuided.buildRouteGuidedEditModel(body, {projectIndex, profileEvidence});
const utility = model.entries.find((entry) => entry.kind === 'utility_pair');
assert(utility && utility.safeEditEligible, 'exact utility call + set-jump should produce safe utility pair edit', utility);
assert(utility.utilityPair && utility.utilityPair.callText === 'go-to: election_algorithm', 'utility pair should preserve call source text', utility);

const utilityEditor = semanticLogic.buildSemanticLogicEditor(projectIndex, {editAction: utility.editAction});
assert(utilityEditor.ok && utilityEditor.fieldControls.mode === 'utility_pair', 'utility pair should open Semantic Logic utility controls', utilityEditor);
const utilityProposal = semanticLogic.buildProposal(utilityEditor, {'semantic_logic.setJumpTarget': 'pres_return_updated'});
assert(utilityProposal.ok, 'utility pair proposal should build', utilityProposal);
assert(utilityProposal.installPlan.operations.length === 2, 'utility pair proposal should emit exactly two replace_text operations', utilityProposal.installPlan.operations);
assert(utilityProposal.installPlan.operations.every((op) => op.type === 'replace_text'), 'utility pair should use existing replace_text operations only', utilityProposal.installPlan.operations);
assert(utilityProposal.installPlan.operations.some((op) => op.replace === 'set-jump: pres_return_updated'), 'utility pair should replace set-jump target in the same proposal', utilityProposal.installPlan.operations);

const literalTable = model.entries.find((entry) => entry.kind === 'route_table_binding' && entry.routeTable && entry.routeTable.shape === 'literal_assignment');
assert(literalTable && literalTable.safeEditEligible, 'literal Q route write should be a safe route table edit', literalTable);
const shapes = new Set(model.entries.filter((entry) => entry.kind === 'route_table_binding' && entry.safeEditEligible).map((entry) => entry.routeTable && entry.routeTable.shape));
['literal_assignment', 'ternary_literal', 'finite_object_map', 'if_else_literal', 'profile_declared_table'].forEach((shape) => {
  assert(shapes.has(shape), 'route table editor should support ' + shape, Array.from(shapes));
});
const tableEditor = semanticLogic.buildSemanticLogicEditor(projectIndex, {editAction: literalTable.editAction});
const tableProposal = semanticLogic.buildProposal(tableEditor, {'semantic_logic.routeTable.0.target': 'c'});
assert(tableProposal.ok, 'route table proposal should build for literal target replacement', tableProposal);
assert(tableProposal.installPlan.operations[0].replace === 'Q.next_scene = "c"', 'route table proposal should only rewrite the literal target value', tableProposal.installPlan.operations[0]);

const manualRouteTable = model.entries.find((entry) => entry.kind === 'route_table_binding' && entry.routeTable && entry.routeTable.shape === 'manual_boundary');
assert(manualRouteTable && !manualRouteTable.safeEditEligible && manualRouteTable.manualReasons.includes('manual_script_boundary'), 'random/function route write should remain manual boundary', manualRouteTable);

const fallback = model.entries.find((entry) => entry.kind === 'explicit_fallback_helper' && entry.safeEditEligible);
assert(fallback, 'simple conditional + unconditional route should produce explicit fallback helper', model.entries);
assert(fallback.fallbackSuggestion.suggestedText === 'go-to: a if Q.x = 1; b if Q.x != 1', 'fallback helper should invert simple equality predicate', fallback.fallbackSuggestion);
const fallbackEditor = semanticLogic.buildSemanticLogicEditor(projectIndex, {editAction: fallback.editAction});
const fallbackProposal = semanticLogic.buildProposal(fallbackEditor, {});
assert(fallbackProposal.ok, 'explicit fallback proposal should build', fallbackProposal);
assert(fallbackProposal.installPlan.operations[0].replace === 'go-to: a if Q.x = 1; b if Q.x != 1', 'explicit fallback proposal should replace with mutually exclusive route clauses', fallbackProposal.installPlan.operations[0]);
const compoundFallback = model.entries.find((entry) => entry.kind === 'explicit_fallback_helper' && entry.fallbackSuggestion && entry.fallbackSuggestion.predicate.includes('and'));
assert(compoundFallback && !compoundFallback.safeEditEligible, 'compound predicate should not auto-generate not(...) fallback rewrite', compoundFallback);

const protectedBody = JSON.parse(JSON.stringify(body));
protectedBody.routeEvidenceMap.items[0].source = src('source/scenes/post_event.scene.dry', 4, 'go-to: election_algorithm');
protectedBody.routeUnderstanding.utilityCalls[0].source = src('source/scenes/post_event.scene.dry', 4, 'go-to: election_algorithm');
const protectedModel = routeGuided.buildRouteGuidedEditModel(protectedBody, {projectIndex, profileEvidence});
const protectedUtility = protectedModel.entries.find((entry) => entry.kind === 'utility_pair');
assert(protectedUtility && !protectedUtility.safeEditEligible && protectedUtility.manualReasons.includes('protected_router_source'), 'protected router utility pair should downgrade to Source Slice/manual', protectedUtility);

const integrated = routeScript.buildRouteScriptIntelligence(body, {projectIndex, profileEvidence});
assert(integrated.routeGuidedEdits && integrated.routeGuidedEdits.entries.some((entry) => entry.kind === 'utility_pair'), 'route script intelligence should include utility guided route edits', integrated.routeGuidedEdits);
assert(integrated.routeGuidedEdits.entries.some((entry) => entry.kind === 'explicit_fallback_helper'), 'route script intelligence should include fallback guided route edits', integrated.routeGuidedEdits);
assert(!integrated.routeGuidedEdits.entries.some((entry) => entry.routeTable && entry.routeTable.variable === 'jumpScene'), 'set-jump should stay utility return evidence, not become a route-table binding', integrated.routeGuidedEdits);
assert(Number(integrated.summary.guidedRouteEditCount || 0) > 0, 'route script summary should count guided route edits', integrated.summary);

const deps = {
  translate: (_key, fallback) => fallback,
  escapeHtml: (value) => String(value === undefined || value === null ? '' : value),
  escapeAttr: (value) => String(value === undefined || value === null ? '' : value),
  renderPlanPreview: (plan) => plan ? '<section data-object-canvas-review-plan="true"></section>' : '',
  renderDiagnostics: () => '',
  semanticLogicApi: semanticLogic
};
const utilityCanvas = workspace.buildCanvasModel(utilityEditor, {'semantic_logic.setJumpTarget': 'pres_return_updated'}, deps);
assert(utilityCanvas.changeState.installPlan.operations.length === 2, 'workspace should preserve utility-pair multi-operation proposal', utilityCanvas.changeState.installPlan.operations);
const utilityHtml = workspace.render(utilityCanvas, {semanticLogicModel: utilityEditor, values: {'semantic_logic.setJumpTarget': 'pres_return_updated'}}, deps);
assert(utilityHtml.includes('data-semantic-logic-field-mode="utility_pair"'), 'workspace should render utility pair controls');

process.stdout.write(JSON.stringify({
  ok: true,
  guidedEntries: model.entries.length,
  utilityOperations: utilityProposal.installPlan.operations.length,
  routeTableShapes: Array.from(shapes).sort(),
  fallbackSuggestion: fallback.fallbackSuggestion.suggestedText
}, null, 2) + '\n');
