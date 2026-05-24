#!/usr/bin/env node
'use strict';

const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const eventStructureEffectModel = require('./authoring/event_structure_effect_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');

const {fail, assert} = require('./check_harness.js');

const index = {
  schemaVersion: '0.1',
  project: {name: 'Variable Effect Fixture', root: '/tmp/dms-variable-effect', profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry'}],
  scenes: [],
  variables: [{name: 'public_order'}, {name: 'year'}, {name: 'month'}]
};

const draft = {
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'variable_effect_event',
  title: 'Variable effect event',
  heading: 'Variable effect event',
  when: {year: 1936, monthStart: 1, monthEnd: 2, requires: '', priority: 0},
  introParagraphs: ['Variable/effect builder fixture.'],
  options: [
    {id: 'first', label: 'First path', narrativeParagraphs: ['First result.'], effects: [{variable: 'public_order', op: '+=', value: 1}]},
    {id: 'second', label: 'Second path', narrativeParagraphs: ['Second result.']}
  ]
};

const model = canvasModel.buildNewEventCanvas(index, draft, {
  values: {
    'event.effect.add.variable': 'new_signal',
    'event.effect.add.op': '*=',
    'event.effect.add.value': '3',
    'option.1.effect.add.variable': 'new_support',
    'option.1.effect.add.op': '+=',
    'option.1.effect.add.value': '2'
  }
});

assert(model.ok, 'missing event variables should become warnings plus init operations, not a blocked draft', model.changeState.diagnostics);
assert(model.changeState.draft.effectsOnTrigger.some((effect) => effect.variable === 'new_signal' && effect.op === '+='), 'unsupported builder op should normalize to a supported EventDraft op', model.changeState.draft.effectsOnTrigger);
assert(model.changeState.draft.options[1].effects.some((effect) => effect.variable === 'new_support' && effect.op === '+=' && effect.value === 2), 'option effect builder should write effects back to the draft');
assert(model.contextBoard.variables.some((row) => row.name === 'new_signal' && row.createAction && row.createAction.actionKind === 'open_variable_editor'), 'new trigger variable should expose create-variable action', model.contextBoard.variables);
assert(model.contextBoard.variables.some((row) => row.name === 'new_support' && row.status === 'new_or_missing'), 'new option variable should be shown in variable provenance', model.contextBoard.variables);
assert(model.changeState.installPlan.operations.some((op) => op.id.indexOf('event_variable_init_new_signal') === 0 && op.safety === 'guarded_apply'), 'new trigger variable should get root init operation');
assert(model.changeState.installPlan.operations.some((op) => op.id.indexOf('event_variable_init_new_support') === 0 && op.safety === 'guarded_apply'), 'new option variable should get root init operation');

const html = previewEditor.render(model);
assert(!html.includes('<option value="*="'), 'effect builder UI must not offer unsupported *= op');
assert(!html.includes('<option value="/="'), 'effect builder UI must not offer unsupported /= op');
assert(html.includes('data-preview-object-structure-builder="add_trigger_effect"'), 'trigger effect builder should be visible');
assert(html.includes('data-preview-object-variable-context="true"'), 'variable context workspace should be visible');

const parsedEffect = eventStructureEffectModel.parseEffect('Q.public_order += 2 if year >= 1936');
assert(parsedEffect.variable === 'public_order' && parsedEffect.op === '+=' && parsedEffect.value === 2 && parsedEffect.condition === 'year >= 1936', 'typed effect helper should parse conditional Q effects', parsedEffect);
assert(eventStructureEffectModel.normalizeEffectOp('*=') === '+=', 'typed effect helper should normalize unsupported ops');
assert(eventStructureEffectModel.effectLabelForSource({variable: 'public_order', op: '-=', value: 1}) === 'Q.public_order -= 1', 'typed effect helper should format source labels');

process.stdout.write(JSON.stringify({
  ok: true,
  variables: model.contextBoard.variables.map((row) => row.name).sort(),
  initOps: model.changeState.installPlan.operations.filter((op) => op.id.indexOf('event_variable_init_') === 0).length
}, null, 2) + '\n');
