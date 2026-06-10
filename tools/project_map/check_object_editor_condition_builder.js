#!/usr/bin/env node
'use strict';

// Gap #4 condition builder: semantic condition cards in the object editor modal
// (preview_object_editor renderSemanticLogicField) get structured row editing
// for FLAT view-if/choose-if conditions. The grammar, the byte-exact gate, the
// row markup and the write-back listeners live off-budget in
// viewer/object_editor_condition_builder.js. This check pins the three
// contracts the feature stands on:
//   1. the v1 grammar parses exactly the census-eligible flat shapes and
//      recomposes them byte-exact (round-trip),
//   2. everything outside the grammar -- or formatted non-canonically -- is
//      rejected so the raw-text field stays untouched (degrade, never guess),
//   3. the rendered builder carries its own data hooks and none of the canvas
//      field attributes that would pollute editor state.

const builder = require('./viewer/object_editor_condition_builder.js');
const {assert} = require('./check_harness.js');

assert(typeof builder.parseFlatCondition === 'function', 'builder should export parseFlatCondition');
assert(typeof builder.recomposeFlatCondition === 'function', 'builder should export recomposeFlatCondition');
assert(typeof builder.builderState === 'function', 'builder should export builderState (the byte-exact gate)');
assert(typeof builder.renderConditionBuilder === 'function', 'builder should export renderConditionBuilder');

// --- 1. round-trip on the real corpus shapes (one per census bucket) ---

const ELIGIBLE = [
  'aufhauser_advisor = 1',
  'advisor_action_timer <= 0 and nationalization_adopted == 0 and black_thursday_seen = 1',
  'last_advisor_action = 1 or last_cabinet_action = 1',
  'neorevisionism',
  'not constructive_vonc',
  'chancellor_party == "SPD"',
  'leader_name == \'Braun\'',
  'cvp_leader == president',
  'kpd_relation >= -1',
  'support >= 0.5',
  'a = 1 and not b and c == "x"'
];
ELIGIBLE.forEach((text) => {
  const state = builder.builderState(text);
  assert(state, 'flat condition should pass the gate: ' + text);
  assert(builder.recomposeFlatCondition(state) === text, 'recompose must reproduce the original byte-exact: ' + text);
});

const single = builder.builderState('chancellor_party == "SPD"');
assert(single.clauses.length === 1 && single.clauses[0].name === 'chancellor_party' && single.clauses[0].op === '==' && single.clauses[0].value.kind === 'string', 'string comparison should parse name/op/string-value');
const chain = builder.builderState('a = 1 or b = 2');
assert(chain.connector === 'or' && chain.clauses.length === 2, 'uniform or-chain should parse with its connector');
const negated = builder.builderState('not constructive_vonc');
assert(negated.clauses[0].not === true && negated.clauses[0].op === '', 'not + bare quality should parse as a negated bare clause');

// An empty field is eligible (build a condition from scratch).
const empty = builder.builderState('');
assert(empty && empty.clauses.length === 0, 'an empty condition should be eligible with zero clauses');

// --- 2. the rejection set: outside the grammar or not byte-canonical ---

const REJECTED = [
  'advisor_action_timer <= 0 and (spd_prussia or in_weimar_coalition)', // parens
  'grand_coalition >= 50 or neo_weimar_coalition >= 50 and dvp_exist',  // mixed and/or
  'reformist_strength + neorevisionist_strength < left_strength',       // arithmetic
  '{! return Q.x > 1 !}',                                               // magic JS
  'not presidential_powers >= 1',                                       // not + comparison (precedence unverified)
  'a  >=  1',                                                           // non-canonical spacing
  'a = 1 ',                                                             // trailing whitespace
  'x == "a and b"',                                                     // connector inside a string literal
  'Q.chancellor >= 1',                                                  // magic-context prefix
  'x = some phrase'                                                     // unquoted multi-word value
];
REJECTED.forEach((text) => {
  assert(builder.builderState(text) === null, 'outside-grammar condition must be rejected so the raw field stays untouched: ' + text);
});

// Recompose refuses incomplete or invalid structures instead of guessing.
assert(builder.recomposeFlatCondition({clauses: [{not: false, name: '', op: '=', value: {kind: 'number', raw: '1'}}], connector: 'and'}) === null, 'an empty name must not recompose');
assert(builder.recomposeFlatCondition({clauses: [{not: true, name: 'a', op: '=', value: {kind: 'number', raw: '1'}}], connector: 'and'}) === null, 'not + comparison must not recompose');
assert(builder.recomposeFlatCondition({clauses: [{not: false, name: 'a', op: '=', value: {kind: '', raw: 'two words'}}], connector: 'and'}) === null, 'an invalid value must not recompose');

// Editing the structure recomposes canonically (connector swap stays flat).
const edited = builder.builderState('a = 1 and b = 2');
edited.connector = 'or';
assert(builder.recomposeFlatCondition(edited) === 'a = 1 or b = 2', 'a connector swap should recompose the same clauses with the new connector');

// --- 3. rendered builder markup: own hooks only, no canvas-state pollution ---

const field = {
  id: 'option_1_view_if',
  variablePicker: {enabled: true, candidates: [{name: 'chancellor'}, {insertValue: 'public_order'}, {name: 'chancellor'}, {name: 'bad name'}]}
};
const html = builder.renderConditionBuilder(field, 'chancellor >= 1 and public_order >= 2', {});
assert(html.includes('data-object-condition-builder="option_1_view_if"'), 'builder container should carry the owning field id');
assert((html.match(/data-object-condition-row="true"/g) || []).length === 2, 'one builder row per clause');
assert(html.includes('data-object-condition-part="name"') && html.includes('data-object-condition-part="op"') && html.includes('data-object-condition-part="value"') && html.includes('data-object-condition-part="not"'), 'rows should expose name/op/value/not parts');
assert(html.includes('data-object-condition-part="connector"'), 'footer should expose the uniform connector select');
assert(html.includes('data-object-condition-action="add_clause"') && html.includes('data-object-condition-action="remove_clause"'), 'builder should expose add and remove row actions');
assert(html.includes('<option value="chancellor">') && html.includes('<option value="public_order">'), 'datalist should offer the variable picker candidates');
assert(!html.includes('data-object-canvas-field=') && !html.includes('data-editing-field=') && !html.includes('data-object-canvas-action='), 'builder controls must not carry canvas field/action hooks (state pollution guard)');

// Degrade paths render nothing at all.
assert(builder.renderConditionBuilder(field, 'a = 1 and (b = 2)', {}) === '', 'a gate-rejected condition must render no builder');
assert(builder.renderConditionBuilder(field, 'chancellor >= 1', {readOnly: true}) === '', 'a read-only field must render no builder');
assert(builder.renderConditionBuilder({id: ''}, 'chancellor >= 1', {}) === '', 'a field without an id must render no builder');

// An empty value still renders the builder shell so a condition can be built
// from scratch (zero rows + add button).
const fromScratch = builder.renderConditionBuilder(field, '', {});
assert(fromScratch.includes('data-object-condition-builder=') && !fromScratch.includes('data-object-condition-row="true"') && fromScratch.includes('data-object-condition-action="add_clause"'), 'an empty condition should render the shell with zero rows and an add action');

process.stdout.write('PASS: object editor condition builder (grammar round-trip, degrade set, markup hooks)\n');
