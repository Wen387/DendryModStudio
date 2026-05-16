#!/usr/bin/env node
'use strict';

const eventDraft = require('./authoring/event_draft.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

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
assert(scene.includes('go-to: root'), 'rendered section exit route should return to root', scene);

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
    'option.0.returnTarget': 'root',
    'event.section.0.exitTarget': 'follow_up'
  }
});
assert(updated.ok, 'route field edits should keep the draft valid', updated.changeState.diagnostics);
assert(updated.changeState.draft.options[0].returnTarget === 'root', 'option return route field should write back to EventDraft');
assert(updated.changeState.draft.sections[0].exitTarget === 'follow_up', 'section exit route field should write back to EventDraft');
assert(updated.eventBody.options[0].fields.some((field) => field.id === 'option.0.returnTarget' && field.role === 'route'), 'route editor field should be exposed on options');
assert(updated.eventBody.branchSections.some((field) => field.id === 'event.section.0.exitTarget' && field.role === 'route'), 'route editor field should be exposed on follow-up sections');
assert(updated.eventBody.eventGraph.edges.some((edge) => edge.kind === 'exit_route' && edge.targetId === 'follow_up'), 'event graph should reflect edited section exit route');

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
