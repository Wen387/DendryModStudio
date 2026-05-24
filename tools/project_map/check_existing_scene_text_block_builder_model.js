#!/usr/bin/env node
'use strict';

const existingEdit = require('./authoring/existing_scene_edit_model.js');

const {fail, assert} = require('./check_harness.js');

function sceneFixture(id, title, relPath) {
  return {
    id,
    title,
    path: relPath,
    type: 'event',
    tags: ['event'],
    flags: {isCard: false, isPinnedCard: false},
    options: [],
    sections: [],
    sourceSpan: {path: relPath, startLine: 1, endLine: 20},
    topLevelSpan: {path: relPath, startLine: 1, endLine: 20},
    assetRefs: []
  };
}

const spanPath = 'source/scenes/events/source_span_text.scene.dry';
const sharedLinePath = 'source/scenes/events/shared_line_safety.scene.dry';
const index = {
  schemaVersion: '0.1',
  project: {name: 'Existing Text Block Builder Fixture', root: '/tmp/existing-text-block-builder-fixture'},
  scenes: [
    sceneFixture('source_span_text', 'Source Span Text', spanPath),
    sceneFixture('shared_line_safety', 'Shared Line Safety', sharedLinePath)
  ],
  variables: [],
  semantic: {
    events: [
      {id: 'source_span_text', title: 'Source Span Text', path: spanPath, confidence: 'exact'},
      {id: 'shared_line_safety', title: 'Shared Line Safety', path: sharedLinePath, confidence: 'exact'}
    ],
    cards: [],
    assets: {items: []},
    textCorpus: {
      items: [
        {
          id: 'span_multiline_body',
          text: 'First source-backed line.\nSecond source-backed line.',
          role: 'body',
          editability: 'text_proposal',
          owner: {kind: 'scene', sceneId: 'source_span_text'},
          source: {
            path: spanPath,
            line: 5,
            startLine: 5,
            endLine: 7,
            anchorText: 'First source-backed line.',
            endAnchorText: 'Second source-backed line.'
          }
        },
        {
          id: 'shared_line_prose',
          text: 'Shared prose.',
          role: 'body',
          editability: 'text_proposal',
          owner: {kind: 'scene', sceneId: 'shared_line_safety'},
          source: {path: sharedLinePath, line: 6, startLine: 6, endLine: 6, anchorText: 'Shared prose.', endAnchorText: 'Shared prose.'}
        },
        {
          id: 'shared_line_conditional',
          text: 'Shared conditional.',
          role: 'conditional_body',
          editability: 'text_proposal',
          owner: {kind: 'scene', sceneId: 'shared_line_safety'},
          conditions: ['Q.flag'],
          source: {path: sharedLinePath, line: 6, startLine: 6, endLine: 6, anchorText: '[? if Q.flag: Shared conditional. ?]', endAnchorText: '[? if Q.flag: Shared conditional. ?]'}
        }
      ]
    }
  },
  diagnostics: []
};

const spanModel = existingEdit.buildEditModel(index, 'events', 'source_span_text');
assert(spanModel.ok, 'multi-line source span fixture should build: ' + JSON.stringify(spanModel.diagnostics));
const spanOpening = spanModel.textBlocks.find((block) => block.semanticRole === 'opening_text');
assert(spanOpening && spanOpening.source.line === 5 && spanOpening.source.endLine === 7, 'multi-line source span text block should preserve source line and endLine');
assert(spanOpening.source.anchorText === 'First source-backed line.' && spanOpening.source.endAnchorText === 'Second source-backed line.', 'multi-line source span text block should preserve source anchors');

const sharedLineModel = existingEdit.buildEditModel(index, 'events', 'shared_line_safety');
assert(sharedLineModel.ok, 'shared-line safety fixture should build: ' + JSON.stringify(sharedLineModel.diagnostics));
assert(sharedLineModel.textBlocks.length === 2, 'shared-line prose and conditional rows should remain separate text block runs');
assert(sharedLineModel.textBlocks.every((block) => block.editability === 'advanced_source_patch'), 'shared-line prose plus conditional runs should keep advanced source safety');

process.stdout.write(JSON.stringify({
  ok: true,
  textBlocks: {
    span: spanModel.textBlocks.length,
    sharedLine: sharedLineModel.textBlocks.length
  }
}) + '\n');
