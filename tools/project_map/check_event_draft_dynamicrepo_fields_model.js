#!/usr/bin/env node
'use strict';

const eventDraft = require('./authoring/event_draft.js');
const eventStructure = require('./authoring/event_structure_model.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');

const {fail, assert} = require('./check_harness.js');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const index = {
  schemaVersion: '0.1',
  project: {name: 'DynamicRepo fields fixture', root: '/tmp/dms-dynamic-fields', profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry'}],
  scenes: [{id: 'helper_scene'}, {id: 'helper_scene_two'}],
  variables: [
    {name: 'public_order'},
    {name: 'preview_flag'},
    {name: 'after_event'},
    {name: 'branch_closed'},
    {name: 'conditional_flag'},
    {name: 'section_score'},
    {name: 'option_score'},
    {name: 'year'},
    {name: 'month'}
  ]
};

const draft = {
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'dynamicrepo_fields_event',
  title: 'DynamicRepo fields event',
  heading: 'DynamicRepo fields event',
  tags: ['event', 'world'],
  newPage: true,
  frequency: 2,
  setJump: 'root',
  calls: ['helper_scene'],
  rawRoutes: ['go-to: follow_up if public_order >= 2'],
  rawOnDisplay: ['Q.preview_flag = 1;'],
  rawOnDeparture: ['Q.after_event = 1;'],
  assetRefs: [
    {path: 'img/events/meeting.png', type: 'image', role: 'event_portrait'},
    {path: 'clear shuffle music/meeting.ogg', type: 'audio', directive: 'audio'}
  ],
  when: {year: 1936, monthStart: 1, monthEnd: 12, requires: 'public_order >= 0', priority: 1},
  introParagraphs: ['Opening body.'],
  conditionalParagraphs: [{raw: '[? if conditional_flag: Root conditional body. ?]', condition: 'conditional_flag', text: 'Root conditional body.'}],
  effectsOnTrigger: [{variable: 'public_order', op: '+=', value: 1}],
  rawEffectsOnTrigger: ['Q.preview_flag += 1;'],
  options: [{
    id: 'accept',
    label: 'Accept the plan.',
    chooseIf: 'public_order >= 1',
    unavailableText: 'Public order is too low.',
    resultMode: 'native',
    narrativeParagraphs: ['Accept result.'],
    effects: [{variable: 'option_score', op: '+=', value: 1}],
    rawRoutes: ['go-to: follow_up if public_order >= 2'],
    calls: ['helper_scene_two']
  }, {
    id: 'delay',
    label: 'Delay the plan.',
    resultMode: 'native',
    narrativeParagraphs: ['Delay result.']
  }],
  sections: [{
    id: 'follow_up',
    title: 'Follow up',
    condition: 'public_order >= 1',
    paragraphs: ['Follow-up body.'],
    conditionalParagraphs: [{condition: 'conditional_flag', text: 'Section conditional body.'}],
    effects: [{variable: 'section_score', op: '+=', value: 1}],
    rawEffects: ['Q.section_score *= 2;'],
    rawRoutes: ['go-to: dynamicrepo_fields_event if public_order < 3'],
    rawOnDeparture: ['Q.branch_closed = 1;'],
    exitTarget: 'root'
  }]
};

const validation = eventDraft.validateDraft(draft, index);
assert(validation.ok, 'DynamicRepo-style EventDraft fields should validate for create-as-new.', validation.diagnostics);

const missingRawRouteDraft = clone(draft);
missingRawRouteDraft.id = 'dynamicrepo_missing_raw_route';
missingRawRouteDraft.rawRoutes = ['go-to: missing_result if public_order >= 2'];
const missingRawRouteValidation = eventDraft.validateDraft(missingRawRouteDraft, index);
assert(!missingRawRouteValidation.ok, 'static rawRoutes should be checked against local anchors and project scenes.', missingRawRouteValidation.diagnostics);
assert(missingRawRouteValidation.diagnostics.some((diag) => diag.code === 'event_draft.missing_route_target'), 'missing static rawRoutes should report missing_route_target.', missingRawRouteValidation.diagnostics);

const missingOptionRawRouteDraft = clone(draft);
missingOptionRawRouteDraft.id = 'dynamicrepo_missing_option_raw_route';
missingOptionRawRouteDraft.options[0].rawRoutes = ['check-success-go-to: missing_option_result'];
const missingOptionRawRouteValidation = eventDraft.validateDraft(missingOptionRawRouteDraft, index);
assert(!missingOptionRawRouteValidation.ok, 'option rawRoutes should be checked against local anchors and project scenes.', missingOptionRawRouteValidation.diagnostics);
assert(missingOptionRawRouteValidation.diagnostics.some((diag) => diag.code === 'event_draft.missing_route_target'), 'missing option rawRoutes should report missing_route_target.', missingOptionRawRouteValidation.diagnostics);

const duplicateEventAnchorDraft = clone(draft);
duplicateEventAnchorDraft.options[0].id = duplicateEventAnchorDraft.id;
const duplicateEventAnchorValidation = eventDraft.validateDraft(duplicateEventAnchorDraft, index);
assert(!duplicateEventAnchorValidation.ok, 'new event id should be reserved as a rendered anchor to prevent self-overwriting sections/options.', duplicateEventAnchorValidation.diagnostics);
assert(duplicateEventAnchorValidation.diagnostics.some((diag) => diag.code === 'event_draft.duplicate_anchor'), 'event-id anchor collisions should report duplicate_anchor.', duplicateEventAnchorValidation.diagnostics);

const scene = eventDraft.renderSceneDry(draft, index);
const renderedNeedles = [
  'frequency: 2',
  'set-jump: root',
  'call: helper_scene',
  'go-to: follow_up if public_order >= 2',
  'on-display: {!',
  'Q.preview_flag = 1;',
  'on-departure: {!',
  'Q.after_event = 1;',
  'face-image: img/events/meeting.png',
  'audio: clear shuffle music/meeting.ogg',
  '[? if conditional_flag: Root conditional body. ?]',
  '[? if conditional_flag : Section conditional body. ?]',
  'Q.section_score *= 2;',
  'Q.branch_closed = 1;',
  'call: helper_scene_two'
];
renderedNeedles.forEach((needle) => {
  assert(scene.includes(needle), 'Rendered scene should include DynamicRepo field: ' + needle, scene);
});

const model = canvasModel.buildNewEventCanvas(index, draft, {
  values: {
    'event.frequency': '3',
    'event.setJump': 'follow_up',
    'event.calls': 'helper_scene\nhelper_scene_two',
    'event.rawOnDisplay': 'Q.preview_flag = 2;',
    'event.conditionalBody': '[? if conditional_flag: Edited root conditional. ?]',
    'option.0.rawRoutes': 'go-to: follow_up if public_order >= 3',
    'event.section.0.conditionalBody': '[? if conditional_flag: Edited section conditional. ?]',
    'event.section.0.rawOnDeparture': 'Q.branch_closed = 2;'
  }
});
assert(model.ok, 'Object Canvas should keep edited DynamicRepo fields installable.', model.changeState.diagnostics);
assert(model.changeState.draft.frequency === 3, 'frequency field should write back to EventDraft.', model.changeState.draft);
assert(model.changeState.draft.setJump === 'follow_up', 'set-jump field should write back to EventDraft.', model.changeState.draft);
assert(model.changeState.draft.calls.length === 2, 'call routes should write back as line list.', model.changeState.draft.calls);
assert(model.changeState.draft.rawOnDisplay[0] === 'Q.preview_flag = 2;', 'raw on-display hook should write back.', model.changeState.draft.rawOnDisplay);
assert(model.changeState.draft.conditionalParagraphs[0].raw === '[? if conditional_flag: Edited root conditional. ?]', 'root conditional body should write back.', model.changeState.draft.conditionalParagraphs);
assert(model.changeState.draft.options[0].rawRoutes[0].includes('public_order >= 3'), 'option raw route should write back.', model.changeState.draft.options[0]);
assert(model.changeState.draft.sections[0].conditionalParagraphs[0].raw === '[? if conditional_flag: Edited section conditional. ?]', 'section conditional body should write back.', model.changeState.draft.sections[0]);
assert(model.changeState.draft.sections[0].rawOnDeparture[0] === 'Q.branch_closed = 2;', 'section raw hook should write back.', model.changeState.draft.sections[0]);
assert(model.changeState.output.sceneDry.includes('frequency: 3'), 'edited frequency should render into install preview.', model.changeState.output.sceneDry);
assert(model.changeState.output.sceneDry.includes('set-jump: follow_up'), 'edited set-jump should render into install preview.', model.changeState.output.sceneDry);
assert(model.changeState.output.sceneDry.includes('call: helper_scene_two'), 'edited calls should render into install preview.', model.changeState.output.sceneDry);
assert(model.changeState.output.sceneDry.includes('Q.preview_flag = 2;'), 'edited on-display hook should render into install preview.', model.changeState.output.sceneDry);
assert(model.changeState.output.sceneDry.includes('[? if conditional_flag: Edited root conditional. ?]'), 'edited root conditional body should render into install preview.', model.changeState.output.sceneDry);
assert(model.changeState.output.sceneDry.includes('[? if conditional_flag: Edited section conditional. ?]'), 'edited section conditional body should render into install preview.', model.changeState.output.sceneDry);
assert(model.eventBody.metaFields.some((field) => field.id === 'event.frequency'), 'Object Canvas should expose frequency as a meta field.', model.eventBody.metaFields);
assert(model.eventBody.metaFields.some((field) => field.id === 'event.rawRoutes'), 'Object Canvas should expose raw root routes as a meta field.', model.eventBody.metaFields);
assert(model.eventBody.sections.some((field) => field.id === 'event.conditionalBody'), 'Object Canvas should expose root conditional body.', model.eventBody.sections);
assert(model.eventBody.options.some((option) => option.fields.some((field) => field.id === 'option.0.rawRoutes')), 'Object Canvas should expose option raw routes.', model.eventBody.options);
assert(model.eventBody.branchSections.some((field) => field.id === 'event.section.0.conditionalBody'), 'Object Canvas should expose section conditional body.', model.eventBody.branchSections);
assert(model.eventBody.branchSections.some((field) => field.id === 'event.section.0.rawOnDeparture'), 'Object Canvas should expose section lifecycle hooks.', model.eventBody.branchSections);

const clearedFrequencyModel = canvasModel.buildNewEventCanvas(index, draft, {values: {'event.frequency': ''}});
assert(clearedFrequencyModel.ok, 'clearing frequency should not make the event draft invalid.', clearedFrequencyModel.changeState.diagnostics);
assert(clearedFrequencyModel.changeState.draft.frequency === null, 'blank frequency should write back as null.', clearedFrequencyModel.changeState.draft);
assert(!clearedFrequencyModel.changeState.output.sceneDry.includes('frequency:'), 'blank frequency should remove the frequency directive from rendered source.', clearedFrequencyModel.changeState.output.sceneDry);


const linearDraft = {
  schemaVersion: '0.1',
  kind: 'world_event',
  eventShape: 'linear_choice_event',
  id: 'linear_choice_fixture',
  title: 'Linear choice fixture',
  heading: 'Linear choice fixture',
  tags: ['event', 'world'],
  newPage: true,
  when: {year: 1936, monthStart: 1, monthEnd: 12, requires: '', priority: 0},
  introParagraphs: ['A single visible path opens.'],
  options: [{id: 'continue_path', label: 'Continue the path.', narrativeParagraphs: ['The single consequence appears.'], resultMode: 'continue', gotoAfter: 'continue_continue_path', returnTarget: 'root'}]
};
const linearValidation = eventDraft.validateDraft(linearDraft, index);
assert(linearValidation.ok, 'linear_choice_event should validate with exactly one root option.', linearValidation.diagnostics);
assert(eventDraft.renderSceneDry(linearDraft, index).includes('is-card: true'), 'linear_choice_event should render like a choice scene.');
const invalidLinearDraft = clone(linearDraft);
invalidLinearDraft.options = invalidLinearDraft.options.concat({id: 'second_path', label: 'Second path.', narrativeParagraphs: ['Second.']});
const invalidLinearValidation = eventDraft.validateDraft(invalidLinearDraft, index);
assert(!invalidLinearValidation.ok && invalidLinearValidation.diagnostics.some((diag) => diag.code === 'event_draft.linear_choice_count'), 'linear_choice_event should reject more than one root option.', invalidLinearValidation.diagnostics);

let nestedStructure = eventStructure.fromDraft(linearDraft, index);
nestedStructure = eventStructure.applyCommand(nestedStructure, {type: 'link_option_to_new_section', optionId: 'continue_path', value: '# nested_followup\nNested follow-up body.'});
nestedStructure = eventStructure.applyCommand(nestedStructure, {type: 'add_option', sectionId: 'nested_followup', value: '- @nested_choice: Take nested action.\n# nested_choice\nNested action result.'});
nestedStructure = eventStructure.applyCommand(nestedStructure, {type: 'rename_anchor', targetId: 'nested_followup', value: 'renamed_followup'});
const nestedDraft = eventStructure.toDraft(nestedStructure, linearDraft);
const nestedValidation = eventDraft.validateDraft(nestedDraft, index);
assert(nestedValidation.ok, 'nested event tree commands should produce a valid draft.', nestedValidation.diagnostics);
const nestedScene = eventDraft.renderSceneDry(nestedDraft, index);
assert(nestedScene.includes('@renamed_followup') && nestedScene.includes('go-to: renamed_followup') && nestedScene.includes('- @nested_choice: Take nested action.'), 'nested structure commands should render renamed follow-up and section-owned option.', nestedScene);

const ambiguousStructure = eventStructure.fromDraft(Object.assign({}, linearDraft, {
  rawRoutes: ['go-to: nested_followup if conditional_flag'],
  sections: [{id: 'nested_followup', title: 'Nested followup', paragraphs: ['Nested body.'], rawRoutes: ['go-to: nested_followup if public_order >= 1'], exitTarget: 'root'}]
}), index);
const ambiguousRenamed = eventStructure.applyCommand(ambiguousStructure, {type: 'rename_anchor', targetId: 'nested_followup', value: 'unsafe_rename'});
const ambiguousDraft = eventStructure.toDraft(ambiguousRenamed, linearDraft);
const ambiguousValidation = eventDraft.validateDraft(ambiguousDraft, index);
assert(!ambiguousValidation.ok && ambiguousValidation.diagnostics.some((diag) => diag.code === 'event_draft.unresolved_anchor_mapping'), 'ambiguous raw route anchor rename should be blocked with unresolved mapping diagnostics.', ambiguousValidation.diagnostics);

const sectionLinkDraft = {
  schemaVersion: '0.1',
  kind: 'world_event',
  eventShape: 'choice_event',
  id: 'section_link_event',
  title: 'Section link event',
  heading: 'Section link event',
  tags: ['event'],
  newPage: true,
  when: {year: 1936, monthStart: 1, monthEnd: 12, requires: '', priority: 0},
  introParagraphs: ['Choose a linked section.'],
  options: [
    {id: 'follow_up', label: 'Open the follow-up.'},
    {id: 'close', label: 'Close the event.'}
  ],
  sections: [
    {id: 'follow_up', paragraphs: ['Follow-up body.'], exitTarget: 'root'},
    {id: 'close', paragraphs: ['Closing body.'], exitTarget: 'root'}
  ]
};
const sectionLinkValidation = eventDraft.validateDraft(sectionLinkDraft, index);
const sectionLinkScene = eventDraft.renderSceneDry(sectionLinkDraft, index);
assert(sectionLinkValidation.ok, 'label-only options may link to existing sections without duplicate anchors.', sectionLinkValidation.diagnostics);
assert((sectionLinkScene.match(/\n@follow_up\n/g) || []).length === 1, 'section-linked option should not render a duplicate result anchor.', sectionLinkScene);

const externalSceneLinkDraft = Object.assign({}, sectionLinkDraft, {
  id: 'external_scene_link_event',
  options: [
    {id: 'helper_scene', label: 'Jump to helper scene.'},
    {id: 'close', label: 'Close the event.'}
  ]
});
const externalSceneLinkValidation = eventDraft.validateDraft(externalSceneLinkDraft, index);
const externalSceneLinkScene = eventDraft.renderSceneDry(externalSceneLinkDraft, index);
assert(externalSceneLinkValidation.ok, 'label-only options may link to existing scenes without generating duplicate local anchors.', externalSceneLinkValidation.diagnostics);
assert(!externalSceneLinkScene.includes('\n@helper_scene\n'), 'external scene-linked option should not render a local result anchor.', externalSceneLinkScene);

const contentfulSameIdDraft = Object.assign({}, sectionLinkDraft, {
  id: 'contentful_same_id_event',
  options: [
    {id: 'follow_up', label: 'Open the follow-up.', narrativeParagraphs: ['This inline result would be lost if treated as a pure section link.']},
    {id: 'close', label: 'Close the event.'}
  ]
});
const contentfulValidation = eventDraft.validateDraft(contentfulSameIdDraft, index);
assert(!contentfulValidation.ok, 'contentful same-id options should not be silently treated as section links.', contentfulValidation.diagnostics);
assert(contentfulValidation.diagnostics.some((item) => item.code === 'event_draft.duplicate_anchor'), 'contentful same-id option should report duplicate anchor instead of losing result content.', contentfulValidation.diagnostics);

console.log(JSON.stringify({
  ok: true,
  renderedChecks: renderedNeedles.length,
  metaFields: model.eventBody.metaFields.length,
  branchFields: model.eventBody.branchSections.length
}, null, 2));
