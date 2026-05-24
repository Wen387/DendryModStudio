#!/usr/bin/env node
'use strict';

const debugModel = require('./authoring/runtime_preview_debug_model.js');

const {fail, assert} = require('./check_harness.js');

const index = {
  schemaVersion: '0.1',
  project: {name: 'Debug Fixture', root: '/tmp/debug-fixture', profileIds: ['generic-dendry']},
  variables: [
    {name: 'year', readCount: 12, writeCount: 3, tags: ['time'], reads: [{path: 'source/scenes/root.scene.dry', line: 5}]},
    {name: 'month', readCount: 12, writeCount: 3, tags: ['time'], reads: [{path: 'source/scenes/root.scene.dry', line: 6}]},
    {name: 'labor_law_seen', readCount: 4, writeCount: 1, tags: ['event'], writes: [{path: 'source/scenes/events/labor_law.scene.dry', line: 3}]},
    {name: 'worker_support', readCount: 7, writeCount: 2, tags: ['labor'], reads: [{path: 'source/scenes/events/labor_law.scene.dry', line: 12}]}
  ],
  scenes: [
    {id: 'root', title: 'Root', type: 'hand', path: 'source/scenes/root.scene.dry'},
    {id: 'labor_law_crisis', title: 'Labor Law Crisis', type: 'event', tags: ['event'], path: 'source/scenes/events/labor_law.scene.dry'},
    {id: 'cabinet_compromise', title: 'Cabinet Compromise', type: 'event', tags: ['event'], sourceSpan: {path: 'source/scenes/events/cabinet.scene.dry', startLine: 1}}
  ].concat(Array.from({length: 120}, (_unused, offset) => ({
    id: 'extra_scene_' + offset,
    title: 'Extra Scene ' + offset,
    type: 'scene',
    path: 'source/scenes/extra_' + offset + '.scene.dry'
  }))),
  edges: [
    {from: 'union_pressure_rises', to: 'labor_law_crisis', label: 'unlocks'},
    {from: 'labor_law_crisis', to: 'cabinet_compromise', label: 'follow-up'}
  ],
  semantic: {
    events: [{id: 'labor_law_crisis', title: 'Labor Law Crisis'}],
    news: [{id: 'cabinet_news', title: 'Cabinet News', path: 'source/scenes/news/cabinet_news.scene.dry'}],
    cards: [{id: 'labor_card', title: 'Labor Card', path: 'source/scenes/cards/labor_card.scene.dry'}],
    decks: [{id: 'starter_deck', title: 'Starter Deck', path: 'source/scenes/decks/starter_deck.scene.dry'}]
  }
};

const controls = debugModel.buildDebugControls(index, {selectedSceneId: 'labor_law_crisis'});
assert(controls.schemaVersion === '0.1', 'debug controls should expose schema version');
assert(controls.variables.some((item) => item.name === 'year' && item.valueType === 'number'), 'year should be a numeric debug variable');
assert(controls.variables.some((item) => item.name === 'labor_law_seen' && item.valueType === 'booleanNumber'), 'event seen flag should be booleanNumber');
assert(controls.variables.some((item) => item.name === 'worker_support'), 'non-flag known variable should be available');
assert(!controls.variables.some((item) => item.name === 'missing_flag'), 'unknown variables must not appear');
assert(controls.scenes.some((item) => item.id === 'labor_law_crisis' && item.sourcePath.includes('labor_law')), 'known event scene should appear');
assert(controls.scenes.some((item) => item.id === 'cabinet_news' && item.type === 'news'), 'semantic news scene should appear');
assert(controls.scenes.some((item) => item.id === 'labor_card' && item.type === 'card'), 'semantic card scene should appear');
assert(controls.scenes.some((item) => item.id === 'starter_deck' && item.type === 'deck'), 'semantic deck scene should appear');
assert(controls.scenes.some((item) => item.id === 'extra_scene_119'), 'debug scene controls should not truncate large projects at 80 scenes');
assert(controls.links.some((item) => item.from === 'union_pressure_rises' && item.to === 'labor_law_crisis'), 'incoming selected-scene link should appear');
assert(controls.links.some((item) => item.from === 'labor_law_crisis' && item.to === 'cabinet_compromise'), 'outgoing selected-scene link should appear');

const applied = debugModel.validateVariableCommand(controls, [
  {name: 'year', value: '1932'},
  {name: 'labor_law_seen', value: '0'},
  {name: 'worker_support', value: 65}
]);
assert(applied.ok, 'valid variable command should pass: ' + JSON.stringify(applied));
assert(applied.variables[0].value === 1932, 'numeric values should be coerced to numbers');
assert(applied.variables[1].value === 0, 'booleanNumber values should accept 0');

const badVariable = debugModel.validateVariableCommand(controls, [{name: 'unknown_score', value: 1}]);
assert(!badVariable.ok, 'unknown variables should be rejected');
assert(badVariable.diagnostics[0].code === 'runtime_preview_debug.unknown_variable', 'unknown variable diagnostic should be stable');

const badBoolean = debugModel.validateVariableCommand(controls, [{name: 'labor_law_seen', value: 2}]);
assert(!badBoolean.ok, 'booleanNumber variables should reject values other than 0 or 1');
assert(badBoolean.diagnostics[0].code === 'runtime_preview_debug.invalid_boolean_number', 'invalid boolean diagnostic should be stable');

const badObject = debugModel.validateVariableCommand(controls, [{name: 'year', value: {raw: 1932}}]);
assert(!badObject.ok, 'object values should be rejected');
assert(badObject.diagnostics[0].code === 'runtime_preview_debug.invalid_value_type', 'object value diagnostic should be stable');

const jump = debugModel.validateJumpCommand(controls, {sceneId: 'labor_law_crisis'});
assert(jump.ok, 'known scene jump should pass');
assert(jump.scene.id === 'labor_law_crisis', 'jump result should include the scene');

const badJump = debugModel.validateJumpCommand(controls, {sceneId: 'not_in_index'});
assert(!badJump.ok, 'unknown scene jump should be rejected');
assert(badJump.diagnostics[0].code === 'runtime_preview_debug.unknown_scene', 'unknown scene diagnostic should be stable');

const history = debugModel.commandHistoryEntry(
  {type: 'applyVariables', variables: applied.variables},
  {ok: true},
  {now: () => new Date('2026-04-29T14:00:00.000Z')}
);
assert(history.timestamp === '2026-04-29T14:00:00.000Z', 'history timestamp should be stable with injected clock');
assert(history.type === 'applyVariables', 'history should keep command type');
assert(history.variableNames.join(',') === 'year,labor_law_seen,worker_support', 'history should store variable names');
assert(!JSON.stringify(history).includes('1932'), 'history should not store large/raw variable values');

process.stdout.write(JSON.stringify({
  ok: true,
  variables: controls.variables.length,
  scenes: controls.scenes.length,
  links: controls.links.length
}, null, 2) + '\n');
