#!/usr/bin/env node
'use strict';

const parsedToDraft = require('./authoring/parsed_to_draft.js');
const {syntheticIndex} = require('./fixtures/archetype_authoring_fixture.js');

const {fail, assert} = require('./check_harness.js');

const index = syntheticIndex();
const expected = [
  ['events', 'economic_expansion', 'draft', 'pure_event'],
  ['events', 'banking_crisis', 'draft', 'large_choice_event'],
  ['cards', 'economic_policy', 'draft', 'menu_card'],
  ['cards', 'sender', 'draft', 'large_card'],
  ['cards', 'advisor_note', 'draft', 'pinned_text_card'],
  ['events', 'blutmai', 'draft', 'section_event'],
  ['cards', 'dynamic_policy', 'partial', 'card']
];

expected.forEach(([view, id, status, archetype]) => {
  const result = parsedToDraft.buildDraftFromParsed(index, {view, itemId: id});
  assert(result.status === status, id + ' status should be ' + status + ', got ' + result.status);
  assert(result.archetypeHint === archetype, id + ' archetype should be ' + archetype + ', got ' + result.archetypeHint);
});

const policy = parsedToDraft.buildDraftFromParsed(index, {view: 'cards', itemId: 'economic_policy'});
assert(policy.parity.parsed.options === 5 && policy.parity.draft.options === 5, 'menu card option parity should be complete');
assert(policy.draft.options.length === 0 && policy.draft.sections.length === 2, 'menu card should preserve section structure instead of flattening root options');

const sender = parsedToDraft.buildDraftFromParsed(index, {view: 'cards', itemId: 'sender'});
assert(sender.parity.parsed.rootOptions === 5 && sender.parity.draft.rootOptions === 5, 'large card root option parity should be complete');

const dynamicRaw = parsedToDraft.buildDraftFromParsed(index, {view: 'cards', itemId: 'dynamic_policy'});
assert(dynamicRaw.diagnostics.some((diag) => diag.code === 'parsed_to_draft.dynamic_structure_partial'), 'dynamic/raw structure should remain explicitly partial');

console.log(JSON.stringify({
  ok: true,
  upgraded: expected.filter((item) => item[2] === 'draft').length,
  partial: dynamicRaw.status
}, null, 2));
