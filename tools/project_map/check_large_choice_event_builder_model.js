#!/usr/bin/env node
'use strict';

const parsedToDraft = require('./authoring/parsed_to_draft.js');
const eventDraft = require('./authoring/event_draft.js');
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
const result = parsedToDraft.buildDraftFromParsed(index, {view: 'events', itemId: 'banking_crisis'});
assert(result.status === 'draft', 'large choice event should be installable');
assert(result.archetypeHint === 'large_choice_event', 'large choice event should keep archetype hint');
assert(result.draft.options.length === 5, 'large choice event should preserve all 5 options');

const validation = eventDraft.validateDraft(result.draft, index);
assert(validation.ok, 'EventDraft should validate 5+ choices: ' + JSON.stringify(validation.diagnostics));

const bundle = eventDraft.buildExportBundle(result.draft, index);
assert(bundle.ok, 'large choice event bundle should build: ' + JSON.stringify(bundle.diagnostics));
assert(bundle.scene.includes('- @delay: Delay the decision.'), 'rendered scene should include the fifth option');
assert(bundle.installPlan.operations.some((op) => op.id === 'create_scene'), 'large choice event should create a scene operation');

const model = canvasModel.buildCanvasModel(index, {template: 'event', draft: result.draft});
assert(model.ok, 'Object Canvas should accept large choice event');
assert(model.eventBody.options.length === 5, 'Object Canvas should render all large-event options');
assert(model.eventBody.readinessChecklist.find((item) => item.id === 'root_options').ok, 'readiness should accept 5+ root options');

console.log(JSON.stringify({
  ok: true,
  options: result.draft.options.length,
  operations: bundle.installPlan.operations.length
}, null, 2));
