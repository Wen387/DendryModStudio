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
const result = parsedToDraft.buildDraftFromParsed(index, {view: 'cards', itemId: 'advisor_note'});
assert(result.status === 'draft', 'zero-option pinned/advisor card should be installable');
assert(result.archetypeHint === 'pinned_text_card', 'zero-option advisor should expose pinned_text_card archetype');
assert(result.draft.cardShape === 'pinned_text_card', 'zero-option advisor should set cardShape');
assert(result.draft.cardKind === 'advisor_like', 'zero-option advisor should preserve advisor-like card kind');
assert(result.draft.options.length === 0, 'zero-option advisor should not synthesize fake choices');

const validation = cardDraft.validateDraft(result.draft, index);
assert(validation.ok, 'CardDraft should validate pinned text card: ' + JSON.stringify(validation.diagnostics));

const bundle = cardDraft.buildExportBundle(result.draft, index);
assert(bundle.ok, 'pinned text card bundle should build: ' + JSON.stringify(bundle.diagnostics));
assert(bundle.scene.includes('is-pinned-card: true'), 'pinned text card should render pinned-card flag');
assert(!/^- @/m.test(bundle.scene), 'pinned text card should not render fake option links');
assert(bundle.installPlan.operations.some((op) => op.id === 'create_scene'), 'pinned text card should create a scene operation');

const model = canvasModel.buildCanvasModel(index, {template: 'card', draft: result.draft});
assert(model.ok, 'Object Canvas should accept pinned text card');
assert(model.eventBody.cardShape === 'pinned_text_card', 'Object Canvas should expose pinned text card shape');
assert(model.eventBody.options.length === 0, 'Object Canvas should not show fake options');

console.log(JSON.stringify({
  ok: true,
  cardShape: result.draft.cardShape,
  operations: bundle.installPlan.operations.length
}, null, 2));
