#!/usr/bin/env node
'use strict';

const parsedToDraft = require('./authoring/parsed_to_draft.js');
const partialRepair = require('./authoring/partial_repair_workflow_model.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');
const {syntheticIndex} = require('./fixtures/archetype_authoring_fixture.js');

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

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
const lossyHtml = previewEditor.render(lossyCanvas);
assert(lossyHtml.includes('data-preview-object-route-map-review="true"') && lossyHtml.includes('data-route-map-review-chip="partial_blocker"'), 'partial draft Route Map should render parity repair chips', lossyHtml);

process.stdout.write(JSON.stringify({
  ok: true,
  complete: complete.length,
  lossyStatus: lossyResult.status,
  lossyMissing: missingRoles(lossyResult),
  lossyRepairEntries: repairEntries.length
}, null, 2) + '\n');
