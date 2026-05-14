#!/usr/bin/env node
'use strict';

const parsedToDraft = require('./authoring/parsed_to_draft.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const {syntheticIndex} = require('./fixtures/archetype_authoring_fixture.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const index = syntheticIndex();
const cases = [
  {view: 'events', id: 'banking_crisis', archetype: 'large_choice_event'},
  {view: 'cards', id: 'economic_policy', archetype: 'menu_card'},
  {view: 'cards', id: 'sender', archetype: 'large_card'},
  {view: 'cards', id: 'advisor_note', archetype: 'pinned_text_card'}
];

cases.forEach((item) => {
  const result = parsedToDraft.buildDraftFromParsed(index, {view: item.view, itemId: item.id});
  assert(result.status === 'draft', item.id + ' should be a supported draft, got ' + result.status);
  assert(result.archetypeHint === item.archetype, item.id + ' should expose archetype ' + item.archetype + ', got ' + result.archetypeHint);
  const model = canvasModel.buildCanvasModel(index, {template: result.template, draft: result.draft});
  assert(model.ok, item.id + ' Object Canvas model should be ready: ' + JSON.stringify(model.changeState.diagnostics));
  assert(model.changeState.installPlan, item.id + ' should produce an install plan');
});

const dynamicRaw = parsedToDraft.buildDraftFromParsed(index, {view: 'cards', itemId: 'dynamic_policy'});
assert(dynamicRaw.status === 'partial', 'dynamic raw card should remain partial');
assert(dynamicRaw.diagnostics.some((diag) => diag.code === 'parsed_to_draft.dynamic_structure_partial'), 'dynamic raw card should explain the unsupported structure');
const blockedModel = canvasModel.buildCanvasModel(index, {template: dynamicRaw.template, draft: dynamicRaw.draft});
assert(!blockedModel.ok, 'dynamic raw partial should stay blocked');
assert(!blockedModel.changeState.installPlan, 'dynamic raw partial should not produce fake install plan');

console.log(JSON.stringify({
  ok: true,
  supported: cases.length,
  partial: dynamicRaw.status
}, null, 2));
