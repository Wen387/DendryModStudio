#!/usr/bin/env node
'use strict';

const eventDraft = require('./authoring/event_draft.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');

const {fail, assert} = require('./check_harness.js');

function codes(result) {
  return result.diagnostics.map((item) => item.code);
}

const index = {
  schemaVersion: '0.1',
  project: {name: 'Route Fixture', root: '/tmp/dms-route-fixture', profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry'}],
  scenes: [],
  variables: [{name: 'public_order'}, {name: 'year'}, {name: 'month'}]
};

const baseDraft = {
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'route_authoring_event',
  title: 'Route authoring event',
  heading: 'Route authoring event',
  when: {year: 1936, monthStart: 1, monthEnd: 3, requires: '', priority: 0},
  introParagraphs: ['Route editor fixture.'],
  options: [
    {id: 'first', label: 'First path', narrativeParagraphs: ['First result.'], returnTarget: 'follow_up'},
    {id: 'second', label: 'Second path', narrativeParagraphs: ['Second result.'], returnTarget: 'root'}
  ],
  sections: [{
    id: 'follow_up',
    title: 'Follow-up',
    paragraphs: ['Follow-up body.'],
    exitTarget: 'root'
  }]
};

const valid = eventDraft.validateDraft(baseDraft, index);
assert(valid.ok, 'returnTarget should resolve to a same-event section', valid.diagnostics);
const scene = eventDraft.renderSceneDry(baseDraft, index);
assert(scene.includes('@continue_first\n' + 'go-to: follow_up'), 'rendered result route should go to follow_up', scene);
assert(scene.includes('@follow_up'), 'rendered scene should include follow-up section anchor', scene);
assert(scene.includes('@continue_second\n' + 'go-to: route_authoring_event'), 'root return routes should target the generated event opening scene id', scene);
assert(scene.includes('@follow_up\n' + 'title: Follow-up') && scene.includes('go-to: route_authoring_event'), 'rendered section exit route should return to the event opening scene id', scene);

const nativeDraft = JSON.parse(JSON.stringify(baseDraft));
nativeDraft.id = 'capital_strike_like';
nativeDraft.title = 'Capital Strike Like';
nativeDraft.heading = 'Capital Strike Like';
nativeDraft.rawEffectsOnTrigger = [
  'Q.workers_spd*= 0.7;',
  'Q.economic_growth -= 4;'
];
nativeDraft.options = [{
  id: 'seize',
  label: 'Empower workers to seize the factories!',
  resultMode: 'native',
  chooseIf: 'public_order >= 1',
  unavailableText: 'The judiciary would never allow this.',
  narrativeParagraphs: ['If the capitalists are going to attack us, then we must hit them back.'],
  rawEffects: ['Q.workers_spd*= 1.2;', 'Q.public_order -= 1;']
}, {
  id: 'capital_controls',
  label: 'Enact capital controls to lessen the impact.',
  resultMode: 'native',
  narrativeParagraphs: ['The controls buy time.']
}];
const nativeValid = eventDraft.validateDraft(nativeDraft, index);
assert(nativeValid.ok, 'native Dynamic-style option sections should validate', nativeValid.diagnostics);
const normalizedNativeDraft = eventDraft.normalizeDraft(nativeDraft);
assert(normalizedNativeDraft.options.every((option) => option.resultMode !== 'native' || !option.gotoAfter), 'native options without explicit gotoAfter should not inherit artificial continue targets', normalizedNativeDraft.options);
const nativeScene = eventDraft.renderSceneDry(nativeDraft, index);
assert(nativeScene.includes('- @seize: Empower workers to seize the factories!'), 'root option should point directly at native section', nativeScene);
assert(nativeScene.includes('@seize\n' + 'title: Empower workers to seize the factories!'), 'native option section should reuse the option anchor', nativeScene);
assert(!nativeScene.includes('@continue_seize'), 'native option sections should not generate artificial continue anchors', nativeScene);
assert(!nativeScene.includes('= Empower workers to seize the factories!'), 'native option result should not duplicate the choice label as a prose heading', nativeScene);
assert(nativeScene.includes('unavailable-subtitle: The judiciary would never allow this.'), 'unavailable text should remain attached to the owning option section', nativeScene);
assert(nativeScene.includes('Q.workers_spd*= 0.7;') && nativeScene.includes('Q.workers_spd*= 1.2;'), 'raw effect lines should be preserved verbatim', nativeScene);
const nativeCanvas = canvasModel.buildNewEventCanvas(index, nativeDraft, {values: {}});
assert(nativeCanvas.ok, 'native Dynamic-style draft should open in Object Canvas', nativeCanvas.changeState.diagnostics);
assert(nativeCanvas.changeState.draft.options.every((option) => option.resultMode !== 'native' || !option.gotoAfter), 'Object Canvas should keep native option targets direct after normalizing the draft', nativeCanvas.changeState.draft.options);
assert(nativeCanvas.eventBody.options.some((option) => option.id === 'seize' && option.targetId === 'seize'), 'Object Canvas preview should show native option sections as direct route targets');

const invalidDraft = JSON.parse(JSON.stringify(baseDraft));
invalidDraft.options[0].returnTarget = 'missing_follow_up';
const invalid = eventDraft.validateDraft(invalidDraft, index);
assert(!invalid.ok && codes(invalid).includes('event_draft.missing_route_target'), 'missing route target should block Review & Apply', invalid.diagnostics);

const updated = canvasModel.buildNewEventCanvas(index, baseDraft, {
  values: {
    'option.0.gotoAfter': 'continue_first_edit',
    'option.0.returnTarget': 'root',
    'option.0.chooseIf': 'public_order >= 2',
    'option.0.unavailableText': 'Order must be stronger.',
    'event.section.0.condition': 'public_order >= 1',
    'event.section.0.exitTarget': 'follow_up'
  }
});
assert(updated.ok, 'route field edits should keep the draft valid', updated.changeState.diagnostics);
assert(updated.changeState.draft.options[0].gotoAfter === 'continue_first_edit', 'option target route field should write back to EventDraft');
assert(updated.changeState.draft.options[0].returnTarget === 'root', 'option return route field should write back to EventDraft');
assert(updated.changeState.draft.options[0].chooseIf === 'public_order >= 2', 'option condition field should write back to EventDraft');
assert(updated.changeState.draft.options[0].unavailableText === 'Order must be stronger.', 'option unavailable text field should write back to EventDraft');
assert(updated.changeState.draft.sections[0].condition === 'public_order >= 1', 'section condition field should write back to EventDraft');
assert(updated.changeState.draft.sections[0].exitTarget === 'follow_up', 'section exit route field should write back to EventDraft');
assert(updated.changeState.output.sceneDry.includes('@first\n' + 'title: First path\n' + 'choose-if: public_order >= 2\n' + 'unavailable-subtitle: Order must be stronger.'), 'option condition and unavailable text should render into the install preview');
assert(updated.changeState.output.sceneDry.includes('@follow_up\n' + 'title: Follow-up\n' + 'view-if: public_order >= 1'), 'section condition should render into the install preview');
assert(updated.eventBody.options[0].fields.some((field) => field.id === 'option.0.returnTarget' && field.role === 'route'), 'route editor field should be exposed on options');
assert(updated.eventBody.options[0].fields.some((field) => field.id === 'option.0.chooseIf' && field.value === 'public_order >= 2'), 'condition editor field should be exposed on options');
assert(updated.eventBody.options[0].fields.some((field) => field.id === 'option.0.unavailableText' && field.value === 'Order must be stronger.'), 'unavailable text editor field should be exposed on options');
assert(updated.eventBody.branchSections.some((field) => field.id === 'event.section.0.condition' && field.value === 'public_order >= 1'), 'section condition editor field should be exposed on follow-up sections');
assert(updated.eventBody.branchSections.some((field) => field.id === 'event.section.0.exitTarget' && field.role === 'route'), 'route editor field should be exposed on follow-up sections');
assert(updated.eventBody.eventGraph.edges.some((edge) => edge.kind === 'exit_route' && edge.targetId === 'follow_up'), 'event graph should reflect edited section exit route');
assert(updated.eventBody.eventGraph.edges.every((edge) => edge.id && edge.sourceKind === 'draft' && edge.evidenceClass === 'draft' && edge.fieldId), 'route map edges should carry stable ids, draft evidence, and editable fields', updated.eventBody.eventGraph.edges);
assert(updated.eventBody.eventGraph.edges.every((edge) => edge.semanticTier === 'static_exact' && edge.safeEditEligible === true && edge.targetResolution && edge.dynamicBinding), 'draft Route Map edges should expose semantic tier, target resolution, dynamic binding placeholder, and safe edit eligibility', updated.eventBody.eventGraph.edges);
assert(updated.eventBody.eventGraph.edges.some((edge) => edge.kind === 'return_route' && edge.fieldId === 'option.0.returnTarget' && edge.installSafety === 'guarded_apply'), 'return route edge should point at the EventDraft returnTarget field');
assert(updated.eventBody.eventGraph.nodes.some((node) => node.id === 'option:first' && node.secondaryActions.some((action) => action.fieldId === 'option.0.chooseIf' && action.editAction && action.editAction.draftAction)), 'Route Map option node should expose a draft condition edit action');
assert(updated.eventBody.eventGraph.nodes.some((node) => node.id === 'option:first' && node.secondaryActions.some((action) => action.fieldId === 'option.0.unavailableText' && action.editAction && action.editAction.draftAction)), 'Route Map option node should expose a draft unavailable-text edit action');
assert(updated.eventBody.eventGraph.nodes.some((node) => node.id === 'section:follow_up' && node.secondaryActions.some((action) => action.fieldId === 'event.section.0.condition' && action.editAction && action.editAction.draftAction)), 'Route Map section node should expose a draft condition edit action');
const routeMapHtml = previewEditor.render(updated);
assert(routeMapHtml.includes('data-preview-object-choice-logic="true"'), 'choice editor should render route/condition controls inside the owning choice');
assert(routeMapHtml.includes('data-object-canvas-field="option.0.chooseIf"') && routeMapHtml.includes('data-object-canvas-field="option.0.returnTarget"'), 'choice editor should expose draft condition and return route fields on the choice row');
assert(routeMapHtml.includes('data-preview-object-route-map="true"'), 'UI should render the structured Route Map panel');
assert(routeMapHtml.includes('data-preview-object-route-causal-flow="true"') && routeMapHtml.includes('data-route-causal-edge="'), 'Route Map should render a cause/gate/result causal flow before raw route rows');
assert(routeMapHtml.includes('data-route-map-field="option.0.gotoAfter"'), 'Route Map should expose editable target route field handles');
assert(routeMapHtml.includes('data-route-map-field="option.0.returnTarget"'), 'Route Map should expose editable return route field handles');
assert(routeMapHtml.includes('data-route-map-field="option.0.chooseIf"'), 'Route Map should expose editable condition field handles');
assert(routeMapHtml.includes('data-route-map-field="option.0.unavailableText"'), 'Route Map should expose editable unavailable-text field handles');
assert(routeMapHtml.includes('data-route-map-field="event.section.0.condition"'), 'Route Map should expose editable section condition field handles');
assert(routeMapHtml.includes('data-route-map-field="event.section.0.exitTarget"'), 'Route Map should expose editable section exit field handles');

const createdWithNativeOption = canvasModel.buildNewEventCanvas(index, nativeDraft, {
  values: {
    structure_add_option: [
      '- @propaganda: Launch a propaganda campaign blaming the capitalists for the crisis.',
      '# propaganda',
      'result-mode: native',
      'choose-if: public_order >= 1',
      'unavailable-subtitle: The press will not carry it.',
      'The newspapers carry the line.'
    ].join('\n')
  }
});
assert(createdWithNativeOption.ok, 'native add-option command should keep the new draft valid', createdWithNativeOption.changeState.diagnostics);
assert(createdWithNativeOption.changeState.draft.options.some((option) => option.id === 'propaganda' && option.resultMode === 'native' && !option.gotoAfter), 'add-option builder should create native Dynamic-style result sections by default');
assert(createdWithNativeOption.changeState.output.sceneDry.includes('@propaganda\n' + 'title: Launch a propaganda campaign blaming the capitalists for the crisis.'), 'generated source should include the new native option section');
assert(!createdWithNativeOption.changeState.output.sceneDry.includes('@continue_propaganda'), 'generated source should not add an unwanted continue section for native add-option commands');
const rematerializedNativeOption = canvasModel.buildNewEventCanvas(index, createdWithNativeOption.changeState.draft, {values: {}});
assert(rematerializedNativeOption.ok, 'rematerialized native option draft should stay valid', rematerializedNativeOption.changeState.diagnostics);
assert(rematerializedNativeOption.changeState.draft.options.some((option) => option.id === 'propaganda' && option.resultMode === 'native' && !option.gotoAfter), 'native add-option should survive the UI materialize/rebuild round trip without becoming continue');
assert(!rematerializedNativeOption.changeState.output.sceneDry.includes('@continue_propaganda'), 'rematerialized native option should still avoid artificial continue sections');

const deleteWithStaleIndexedValues = canvasModel.buildNewEventCanvas(index, nativeDraft, {
  values: {
    'option.1.label': 'Stale police label that belonged to the removed option',
    'option.1.body': 'Stale police result that belonged to the removed option.',
    __structureCommands: [
      {
        type: 'add_option',
        optionId: '',
        sectionId: '',
        value: [
          '- @coalition: Call the coalition leaders into a night session.',
          '# coalition',
          'result-mode: native',
          'The coalition talks through the night.'
        ].join('\n')
      },
      {type: 'remove_option', optionId: 'capital_controls'}
    ]
  }
});
assert(deleteWithStaleIndexedValues.ok, 'delete plus add should keep the draft valid', deleteWithStaleIndexedValues.changeState.diagnostics);
assert(deleteWithStaleIndexedValues.changeState.draft.options.length === 2, 'removed option should stay removed after queued structural commands', deleteWithStaleIndexedValues.changeState.draft.options);
assert(deleteWithStaleIndexedValues.changeState.draft.options.some((option) => option.id === 'coalition' && option.label === 'Call the coalition leaders into a night session.'), 'newly-added option should not inherit stale index-based fields', deleteWithStaleIndexedValues.changeState.draft.options);
assert(!deleteWithStaleIndexedValues.changeState.draft.options.some((option) => option.label.indexOf('Stale police') >= 0 || (Array.isArray(option.narrativeParagraphs) ? option.narrativeParagraphs : []).join('\n').indexOf('Stale police') >= 0), 'stale fields for the deleted option should not be carried forward', deleteWithStaleIndexedValues.changeState.draft.options);

process.stdout.write(JSON.stringify({
  ok: true,
  routeFields: updated.eventBody.options[0].fields.filter((field) => field.role === 'route').length,
  graphEdges: updated.eventBody.eventGraph.edgeCount
}, null, 2) + '\n');
