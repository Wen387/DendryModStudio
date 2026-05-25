#!/usr/bin/env node
'use strict';

const parsedToDraft = require('./authoring/parsed_to_draft.js');
const cardDraft = require('./authoring/card_draft.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const {syntheticIndex} = require('./fixtures/archetype_authoring_fixture.js');
const {fail, assert} = require('./check_harness.js');

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
assert(model.eventBody.branchSections.some((field) => field.id === 'card.section.0.option.0.label'), 'Object Canvas should expose menu section option field ids');
assert(model.eventBody.structureActions.some((field) => field.id === 'structure_add_option_section_taxes'), 'menu card should expose add section option structure actions');
const editedMenuModel = canvasModel.buildCanvasModel(index, {template: 'card', draft: result.draft}, {values: {__structureCommands: [{type: 'add_option', sectionId: 'taxes', value: '- @land_value_tax: Introduce a land value tax.\n# land_value_tax\nThe proposal shifts the debate.'}]}});
assert(editedMenuModel.ok, 'Object Canvas should accept menu section option structure edits');
assert(editedMenuModel.changeState.draft.sections[0].options.some((option) => option.id === 'land_value_tax'), 'menu card section option structure edit should update the draft');
const editedBundle = cardDraft.buildExportBundle(editedMenuModel.changeState.draft, index);
assert(editedBundle.scene.includes('- @land_value_tax: Introduce a land value tax.'), 'menu card section option structure edit should render in the scene');

console.log(JSON.stringify({
  ok: true,
  sections: result.draft.sections.length,
  sectionOptions: result.parity.draft.sectionOptions,
  operations: bundle.installPlan.operations.length
}, null, 2));
