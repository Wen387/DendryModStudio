#!/usr/bin/env node
'use strict';

const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');
const parsedToDraft = require('./authoring/parsed_to_draft.js');
const {syntheticIndex} = require('./fixtures/archetype_authoring_fixture.js');

const {fail, assert} = require('./check_harness.js');

const index = syntheticIndex();
const samples = [
  ['events', 'economic_expansion', 'event', 'pure_event'],
  ['events', 'blutmai', 'event', 'section_event'],
  ['cards', 'economic_policy', 'card', 'menu_card'],
  ['cards', 'sender', 'card', 'large_card']
];

samples.forEach(([view, id, kind, archetype]) => {
  const model = canvasModel.buildExistingCanvas(index, view, id, {});
  assert(model.ok, id + ' should open in Object Canvas');
  const html = previewEditor.renderModal(model, {});
  assert(html.includes('data-create-similar-object="true"'), id + ' should expose Create similar / Copy as New from Object Canvas');
  assert(html.includes('data-create-similar-kind="' + kind + '"'), id + ' should label the Create similar entry as ' + kind);
  const result = parsedToDraft.buildDraftFromParsed(index, {view, itemId: id, sourceEntry: 'object_canvas_create_similar'});
  assert(result.ok, id + ' should resolve through parsed-to-draft for Create similar', result);
  assert(result.archetypeHint === archetype, id + ' should preserve the expected archetype hint', result);
});

process.stdout.write(JSON.stringify({
  ok: true,
  copyAsNewEntries: samples.length
}, null, 2) + '\n');
