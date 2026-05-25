#!/usr/bin/env node
'use strict';

const parsedToDraft = require('./authoring/parsed_to_draft.js');
const eventDraft = require('./authoring/event_draft.js');
const partialRepair = require('./authoring/partial_repair_workflow_model.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');
const {syntheticIndex} = require('./fixtures/archetype_authoring_fixture.js');

const {fail, assert} = require('./check_harness.js');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function missingRoles(result) {
  return Object.entries(result.parity && result.parity.roles || {})
    .filter(([, row]) => row && row.missing)
    .map(([role, row]) => ({role, parsed: row.parsed, draft: row.draft, missing: row.missing, blocking: row.blocking}));
}

const index = syntheticIndex();
const complete = [
  ['events', 'economic_expansion', 'pure_event'],
  ['events', 'banking_crisis', 'large_choice_event'],
  ['cards', 'economic_policy', 'menu_card'],
  ['cards', 'sender', 'large_card'],
  ['events', 'blutmai', 'section_event']
];

complete.forEach(([view, id, archetype]) => {
  const result = parsedToDraft.buildDraftFromParsed(index, {view, itemId: id});
  assert(result.status === 'draft', id + ' should remain installable when role-keyed parity is complete', result);
  assert(result.archetypeHint === archetype, id + ' should preserve archetype hint', result);
  assert(!missingRoles(result).some((row) => row.blocking), id + ' should not have blocking parity loss', missingRoles(result));
});

const economic = parsedToDraft.buildDraftFromParsed(index, {view: 'events', itemId: 'economic_expansion'});
assert(economic.draft.eventShape === 'pure_event', 'economic_expansion should copy as a no-choice text event', economic.draft);
assert(economic.draft.options.length === 0, 'pure_event copy should not insert fake options', economic.draft.options);
assert(economic.parity.roles.effects.parsed === 23 && economic.parity.roles.effects.draft === 23, 'economic_expansion should keep all trigger effects', economic.parity.roles.effects);
assert(economic.parity.roles.viewIf.parsed === 1 && economic.parity.roles.viewIf.draft === 1, 'economic_expansion should keep appearance condition', economic.parity.roles.viewIf);

const routedIndex = clone(index);
const routedEconomic = routedIndex.scenes.find((scene) => scene.id === 'economic_expansion');
routedEconomic.rawRoutes = 'go-to: root if economic_expansion >= 90';
routedEconomic.calls = ['helper_scene'];
routedEconomic.setJump = 'root';
routedEconomic.onDisplay = 'Q.preview_flag = 1;';
routedEconomic.onDeparture = ['Q.preview_flag = 0;'];
const routed = parsedToDraft.buildDraftFromParsed(routedIndex, {view: 'events', itemId: 'economic_expansion'});
assert(routed.status === 'draft', 'string/array route and hook fields should copy without lowering a complete event to partial', routed);
assert(routed.draft.rawRoutes.length === 1 && routed.draft.rawOnDisplay.length === 1 && routed.draft.rawOnDeparture.length === 1, 'route and lifecycle hook fields should be preserved in the draft', routed.draft);
assert(routed.parity.roles.routes.parsed === 1 && routed.parity.roles.routes.draft === 1, 'route parity should count preserved raw routes', routed.parity.roles.routes);
assert(routed.parity.roles.calls.parsed === 1 && routed.parity.roles.calls.draft === 1, 'call parity should count preserved calls', routed.parity.roles.calls);
assert(routed.parity.roles.setJump.parsed === 1 && routed.parity.roles.setJump.draft === 1, 'set-jump parity should count preserved jumps', routed.parity.roles.setJump);
assert(routed.parity.roles.lifecycleHooks.parsed === 2 && routed.parity.roles.lifecycleHooks.draft === 2, 'lifecycle hook parity should count string and array hooks', routed.parity.roles.lifecycleHooks);


const linearIndex = clone(index);
linearIndex.scenes.push({
  id: 'single_path_event',
  title: 'Single Path Event',
  heading: 'Single Path Event',
  tags: ['event', 'world'],
  body: 'A one-choice event opens.',
  options: [{id: 'only_path', label: 'Take the only path.', body: 'The only consequence.'}]
});
const linearResult = parsedToDraft.buildDraftFromParsed(linearIndex, {view: 'events', itemId: 'single_path_event'});
assert(linearResult.status === 'draft', 'single root option parsed events should become installable linear_choice_event drafts.', linearResult);
assert(linearResult.draft.eventShape === 'linear_choice_event', 'single root option should preserve its shape as linear_choice_event.', linearResult.draft);
assert(!linearResult.parity.blockers.some((item) => item.code === 'parsed_to_draft.choice_event_too_few_options'), 'linear_choice_event should not carry the sparse choice blocker.', linearResult.parity.blockers);
const linearDraftValidation = eventDraft.validateDraft(linearResult.draft, linearIndex);
assert(linearDraftValidation.ok, 'parsed linear_choice_event draft should validate.', linearDraftValidation.diagnostics);

const dynamicEventIndex = clone(index);
dynamicEventIndex.scenes.find((scene) => scene.id === 'banking_crisis').dynamicStructure = true;
const dynamicEventResult = parsedToDraft.buildDraftFromParsed(dynamicEventIndex, {view: 'events', itemId: 'banking_crisis'});
assert(dynamicEventResult.status === 'partial', 'events with dynamic structure should stay partial instead of pretending lossless', dynamicEventResult);
assert(dynamicEventResult.parity.blockers.some((item) => item.code === 'parsed_to_draft.dynamic_structure_partial'), 'dynamic structure should produce an explicit blocker', dynamicEventResult.parity.blockers);

const externalTargetIndex = clone(index);
externalTargetIndex.scenes.find((scene) => scene.id === 'banking_crisis').options[0].targetId = 'external_scene';
const externalTargetResult = parsedToDraft.buildDraftFromParsed(externalTargetIndex, {view: 'events', itemId: 'banking_crisis'});
assert(externalTargetResult.status === 'partial', 'copy-as-new should not silently absorb option routes to outside scenes', externalTargetResult);
assert(externalTargetResult.parity.blockers.some((item) => item.code === 'parsed_to_draft.external_option_route_partial'), 'external option routes should produce an explicit blocker', externalTargetResult.parity.blockers);

const conditionalIndex = clone(index);
conditionalIndex.scenes.push({
  id: 'conditional_body_event',
  title: 'Conditional Body Event',
  heading: 'Conditional Body Event',
  tags: ['event'],
  body: 'Opening body.'
});
conditionalIndex.semantic.textCorpus.items.push({
  id: 'conditional_body_event_body',
  text: 'Opening body.',
  role: 'body',
  owner: {kind: 'scene', sceneId: 'conditional_body_event', sectionId: ''},
  source: {path: 'source/scenes/events/conditional_body_event.scene.dry', line: 8, anchorText: 'Opening body.'}
}, {
  id: 'conditional_body_event_conditional',
  text: 'Conditional line.',
  role: 'conditional_body',
  conditions: ['Q.flag'],
  owner: {kind: 'scene', sceneId: 'conditional_body_event', sectionId: ''},
  source: {path: 'source/scenes/events/conditional_body_event.scene.dry', line: 9, anchorText: '[? if Q.flag: Conditional line. ?]'}
});
const conditionalResult = parsedToDraft.buildDraftFromParsed(conditionalIndex, {view: 'events', itemId: 'conditional_body_event'});
assert(conditionalResult.status === 'draft', 'root conditional_body rows should no longer make a simple copied event partial.', conditionalResult);
assert(conditionalResult.draft.conditionalParagraphs.length === 1, 'conditional_body rows should become EventDraft conditionalParagraphs.', conditionalResult.draft);
assert(conditionalResult.parity.roles.body.parsed === conditionalResult.parity.roles.body.draft, 'conditional_body should count as preserved body text.', conditionalResult.parity.roles.body);
assert(conditionalResult.parity.roles.conditions.parsed === conditionalResult.parity.roles.conditions.draft, 'conditional_body should count as preserved condition text.', conditionalResult.parity.roles.conditions);
const conditionalValidation = eventDraft.validateDraft(conditionalResult.draft, conditionalIndex);
assert(conditionalValidation.ok, 'conditionalParagraphs with raw source should validate.', conditionalValidation.diagnostics);
const conditionalScene = eventDraft.renderSceneDry(conditionalResult.draft, conditionalIndex);
assert(conditionalScene.includes('[? if Q.flag: Conditional line. ?]'), 'conditionalParagraph raw line should render unchanged.', conditionalScene);

const duplicateAnchorIndex = clone(index);
duplicateAnchorIndex.scenes.push({
  id: 'duplicate_anchor_event',
  title: 'Duplicate Anchor Event',
  heading: 'Duplicate Anchor Event',
  tags: ['event'],
  options: [
    {id: 'repeat', label: 'Repeat at root', body: 'Root repeat result.'},
    {id: 'second', label: 'Second path', body: 'Second result.'}
  ],
  sections: [{
    id: 'repeat',
    title: 'Repeated section',
    body: 'Repeated section body.',
    options: [
      {id: 'repeat', label: 'Repeat inside section', body: 'Nested repeat result.'},
      {id: 'leave', label: 'Leave section', body: 'Leave result.'}
    ]
  }]
});
const duplicateResult = parsedToDraft.buildDraftFromParsed(duplicateAnchorIndex, {view: 'events', itemId: 'duplicate_anchor_event'});
assert(duplicateResult.draft.anchorResolution && duplicateResult.draft.anchorResolution.rewrites.length >= 2, 'copy-as-new should record duplicate anchor rewrites.', duplicateResult.draft);
const duplicateValidation = eventDraft.validateDraft(duplicateResult.draft, duplicateAnchorIndex);
assert(duplicateValidation.ok, 'copy-as-new duplicate local anchors should be rewritten before validation.', duplicateValidation.diagnostics);
assert(!duplicateValidation.diagnostics.some((item) => item.code === 'event_draft.duplicate_anchor'), 'rewritten copy should not report duplicate_anchor.', duplicateValidation.diagnostics);
const duplicateScene = eventDraft.renderSceneDry(duplicateResult.draft, duplicateAnchorIndex);
assert((duplicateScene.match(/\n@repeat\n/g) || []).length <= 1, 'rendered copy should not duplicate the original repeated anchor.', duplicateScene);

const lossy = clone(index);
lossy.semantic.textCorpus.items.push({
  id: 'banking_crisis_unmapped_conditional_body',
  text: 'This conditional paragraph is parsed but has no draft section support yet.',
  role: 'conditional_body',
  owner: {kind: 'scene', sceneId: 'banking_crisis', sectionId: 'banking_crisis.unmapped'},
  source: {path: 'source/scenes/events/banking_crisis.scene.dry', line: 99}
});
const lossyResult = parsedToDraft.buildDraftFromParsed(lossy, {view: 'events', itemId: 'banking_crisis'});
assert(lossyResult.status === 'partial', 'lossy parsed-to-draft result should be blocked instead of pretending installable', lossyResult);
assert(missingRoles(lossyResult).some((row) => row.role === 'body' && row.blocking), 'lossy body parity should become a blocking role-keyed gate', missingRoles(lossyResult));
assert(!lossyResult.draft || lossyResult.draft.authoringStatus === 'partial', 'partial parity should mark the draft itself as partial', lossyResult.draft);

const repairEntries = partialRepair.buildRepairEntries(lossyResult.parity, {
  model: {
    objectView: 'events',
    objectId: 'banking_crisis',
    eventBody: {
      sections: [{
        id: 'banking_crisis.body',
        label: 'Body',
        value: 'Existing parsed body.',
        original: 'Existing parsed body.',
        source: {path: 'source/scenes/events/banking_crisis.scene.dry', line: 12},
        status: 'guarded'
      }]
    }
  }
});
assert(repairEntries.some((entry) => entry.role === 'body' && entry.repairAction && entry.repairAction.actionKind === 'open_object_section'), 'partial parsed-to-draft body blockers should expose a repair route without unblocking install', repairEntries);
const lossyCanvas = canvasModel.buildCanvasModel(lossy, {template: 'event', draft: lossyResult.draft});
assert(!lossyCanvas.ok && lossyCanvas.changeState.diagnostics.some((diag) => diag.code === 'parsed_to_draft.partial_blocked'), 'partial draft should remain blocked in Object Canvas', lossyCanvas.changeState.diagnostics);
assert(lossyCanvas.eventBody.eventGraph && lossyCanvas.eventBody.eventGraph.reviewHints.some((hint) => hint.key === 'partial_blocker' && hint.count >= 1), 'partial draft Route Map should expose parity repair hints without unblocking install', lossyCanvas.eventBody.eventGraph);
const lossyHtml = previewEditor.render(lossyCanvas) + previewEditor.renderEventReviewDetailsPanels(lossyCanvas.eventBody || {}, lossyCanvas);
assert(lossyHtml.includes('data-preview-object-route-map-review="true"') && lossyHtml.includes('data-route-map-review-chip="partial_blocker"'), 'partial draft Route Map should render parity repair chips', lossyHtml);

process.stdout.write(JSON.stringify({
  ok: true,
  complete: complete.length,
  lossyStatus: lossyResult.status,
  lossyMissing: missingRoles(lossyResult),
  lossyRepairEntries: repairEntries.length
}, null, 2) + '\n');
