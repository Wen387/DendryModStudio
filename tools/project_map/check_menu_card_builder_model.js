#!/usr/bin/env node
'use strict';

const parsedToDraft = require('./authoring/parsed_to_draft.js');
const cardDraft = require('./authoring/card_draft.js');
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
const result = parsedToDraft.buildDraftFromParsed(index, {view: 'cards', itemId: 'economic_policy'});
assert(result.status === 'draft', 'menu card should be installable');
assert(result.draft.cardShape === 'menu_card', 'menu card should set cardShape');
assert(result.draft.sections.length === 2, 'menu card should preserve sections');
assert(result.parity.parsed.sectionOptions === 5 && result.parity.draft.sectionOptions === 5, 'menu card should preserve section-owned options');

const validation = cardDraft.validateDraft(result.draft, index);
assert(validation.ok, 'CardDraft should validate menu card: ' + JSON.stringify(validation.diagnostics));

const bundle = cardDraft.buildExportBundle(result.draft, index);
assert(bundle.ok, 'menu card bundle should build: ' + JSON.stringify(bundle.diagnostics));
assert(bundle.scene.includes('@taxes'), 'rendered menu card should include section anchor');
assert(bundle.scene.includes('- @wealth_tax: Introduce a wealth tax.'), 'rendered menu card should include section-owned options');
assert(bundle.scene.includes('Q.policy_focus = 1;'), 'rendered menu card should include section effects');
assert(bundle.installPlan.operations.some((op) => op.id === 'create_scene'), 'menu card should create a scene operation');

const model = canvasModel.buildCanvasModel(index, {template: 'card', draft: result.draft});
assert(model.ok, 'Object Canvas should accept menu card');
assert(model.eventBody.cardShape === 'menu_card', 'Object Canvas should expose menu card shape');
assert(model.eventBody.branchSections.length >= 8, 'Object Canvas should expose section and section-option fields');
assert(model.eventBody.optionEffects.some((group) => group.sectionId === 'taxes'), 'Object Canvas should expose section option effects');

console.log(JSON.stringify({
  ok: true,
  sections: result.draft.sections.length,
  sectionOptions: result.parity.draft.sectionOptions,
  operations: bundle.installPlan.operations.length
}, null, 2));
