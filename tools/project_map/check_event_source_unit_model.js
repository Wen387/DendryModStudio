#!/usr/bin/env node
'use strict';

const assert = require('assert');
const sourceUnits = require('./authoring/event_source_unit_model.js');

const sample = [
  'title: Test Event',
  'subtitle: A fixture',
  'new-page: true',
  'tags: event',
  'frequency: 1000',
  'view-if: year = 1932 and test_seen = 0',
  'on-arrival: {!',
  'Q.test_seen = 1;',
  'Q.resources += 2 if year = 1932;',
  '!}',
  'on-display: Q.preview_flag = 1',
  'set-jump: post_test',
  'call: helper_scene',
  'face-image: img/test.jpg',
  '',
  '= Test Event',
  '',
  'Opening body.',
  'Election results: The coalition gains ground.',
  '- @accept: Accept.',
  '- @delay: Delay.',
  '',
  '@accept',
  'title: Accept.',
  'choose-if: resources >= 1',
  'unavailable-subtitle: Need resources.',
  'on-departure: Q.after_accept = 1;',
  'go-to: post_test if resources >= 1; fallback if resources < 1',
  'Accept body.',
  '',
  '@delay',
  'audio: clear shuffle music/test.mp3 music/other.ogg',
  'Delay body.'
].join('\n');

const parsed = sourceUnits.parseEventSourceUnits(sample, {path: 'source/scenes/events/test.scene.dry'});
const reconstructed = sourceUnits.reconstructSourceFromUnits(parsed);

assert.strictEqual(parsed.coverageComplete, true, 'all non-empty lines should be represented');
assert.strictEqual(reconstructed, sample, 'no-op source-unit reconstruction should be exact');
assert.strictEqual(parsed.uncoveredNonEmptyLines.length, 0, 'no uncovered lines expected');
assert.strictEqual(parsed.countsByKind.metadata >= 6, true, 'metadata directives should be represented');
assert.strictEqual(parsed.countsByKind.raw_hook_block, 1, 'raw hook block should be grouped');
assert.strictEqual(parsed.countsByKind.hook, 2, 'simple hooks should be represented');
assert.strictEqual(parsed.countsByKind.route, 3, 'call, set-jump, and go-to should be route units');
assert.strictEqual(parsed.countsByKind.asset, 2, 'face-image and audio should be asset units');
assert.strictEqual(parsed.countsByKind.option_label, 2, 'root option labels should be represented');
assert.strictEqual(parsed.countsByKind.section_header, 2, 'section headers should be represented');
assert(parsed.units.some((unit) => unit.normalizedDirective === 'frequency'), 'frequency should be first-class metadata');
assert(parsed.units.some((unit) => unit.normalizedDirective === 'on-departure'), 'on-departure should be represented');
assert(parsed.units.some((unit) => unit.normalizedDirective === 'audio' && unit.text.includes('clear shuffle')), 'raw audio command should be preserved');
assert(parsed.units.some((unit) => unit.coverageClass === 'source_backed_editable'), 'advanced/source-backed units should be classified');
assert(parsed.units.some((unit) => unit.kind === 'body_text' && unit.text === 'Election results: The coalition gains ground.'), 'prose colon lines should remain body text');
assert.strictEqual(parsed.directiveCounts['election results'], undefined, 'prose colon lines should not inflate directive coverage');

const rawBlockWithLiteralClose = [
  'on-display: {!',
  'Q.literal = "!}";',
  'Q.after_literal += 1;',
  '!}',
  'Body after hook.'
].join('\n');
const parsedLiteralClose = sourceUnits.parseEventSourceUnits(rawBlockWithLiteralClose, {path: 'source/scenes/events/raw_literal.scene.dry'});
assert.strictEqual(sourceUnits.reconstructSourceFromUnits(parsedLiteralClose), rawBlockWithLiteralClose, 'raw JS hook reconstruction should ignore !} inside quoted strings');
assert.strictEqual(parsedLiteralClose.countsByKind.raw_hook_block, 1, 'quoted !} should not split raw hook blocks early');
assert(parsedLiteralClose.units.some((unit) => unit.kind === 'raw_hook_block' && unit.text.includes('Q.after_literal += 1;')), 'raw hook block should keep statements after a quoted !}');

console.log(JSON.stringify({
  ok: true,
  unitCount: parsed.units.length,
  countsByKind: parsed.countsByKind,
  countsByCoverageClass: parsed.countsByCoverageClass
}, null, 2));
