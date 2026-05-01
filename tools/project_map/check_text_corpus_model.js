#!/usr/bin/env node
'use strict';

const fs = require('fs');
const viewer = require('./viewer/app.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const indexPath = process.argv[2];
if (!indexPath) {
  fail('usage: node tools/project_map/check_text_corpus_model.js <project-index.json>');
}

const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const textCorpus = index.semantic && index.semantic.textCorpus;

function textOf(item) {
  return String((item && item.text) || '').trim();
}

function isHiddenScriptOrComment(value) {
  const text = String(value || '').trim();
  return (
    text.startsWith('//') ||
    /^Q\./.test(text) ||
    /;\s*Q\./.test(text) ||
    /\bQ\.[A-Za-z_][A-Za-z0-9_]*\s*(?:[+\-*/%]?=)/.test(text)
  );
}

assert(textCorpus && Array.isArray(textCorpus.items), 'semantic.textCorpus.items should exist');
assert(textCorpus.items.length > 0, 'text corpus should contain player-visible text items');
assert(textCorpus.items.some((item) => item.role === 'body'), 'text corpus should include body text');
assert(textCorpus.items.some((item) => item.role === 'option_label'), 'text corpus should include option labels');

const scriptLikeBodyRows = textCorpus.items.filter((item) => item.role === 'body' && isHiddenScriptOrComment(item.text));
assert(
  scriptLikeBodyRows.length === 0,
  'text corpus body rows should not include hidden script/comment text: ' +
    scriptLikeBodyRows.slice(0, 3).map((item) => textOf(item)).join(' | ')
);

const maxTextLength = Math.max(...textCorpus.items.map((item) => textOf(item).length));
assert(maxTextLength > 180, 'text corpus should preserve full player text beyond the excerpt limit');
assert(
  !textCorpus.items.some((item) => textOf(item).length === 180 && textOf(item).endsWith('...')),
  'text corpus should not store 180-character excerpt truncations as canonical text'
);

const fullLengthBody = textCorpus.items.find((item) => item.role === 'body' && textOf(item).length > 180);
assert(fullLengthBody && fullLengthBody.source && Number.isInteger(fullLengthBody.source.endLine),
  'full-length body rows should keep a source endLine for multi-line review context');

const foodSafetyRows = textCorpus.items.filter((item) => item.owner && item.owner.sceneId === 'food_safety_2014');
if (foodSafetyRows.length > 0) {
  assert(
    foodSafetyRows.some((item) =>
      item.role === 'body' &&
      textOf(item).includes('整條供應鏈') &&
      textOf(item).includes('產出這家企業的制度')
    ),
    'food_safety_2014 should preserve the complete visible body paragraph'
  );
  assert(
    !foodSafetyRows.some((item) => isHiddenScriptOrComment(item.text)),
    'food_safety_2014 corpus rows should not expose Q.* scripts or // comments as player text'
  );
}

const sdaah1929Rows = textCorpus.items.filter((item) => item.owner && item.owner.sceneId === '1929');
if (sdaah1929Rows.length > 0) {
  assert(
    !sdaah1929Rows.some((item) => isHiddenScriptOrComment(item.text)),
    'SDAAH 1929 text rows should skip post_event-style script comments and Q.* code'
  );
}

assert(viewer.VIEW_DEFS.textCorpus, 'viewer should expose Text Corpus view definition');
const model = viewer.buildViewModel(index);
assert(model.lists.textCorpus.length === textCorpus.items.length, 'view model should include text corpus list');

const islandRows = viewer.filterAndSortItems(model, 'textCorpus', '頂新', 'role', 'asc');
const sdaahRows = viewer.filterAndSortItems(model, 'textCorpus', 'A new year begins', 'role', 'asc');
assert(
  islandRows.length > 0 || sdaahRows.length > 0,
  'Text view search should find known player-facing prose in supported fixtures'
);
if (islandRows.length > 0) {
  assert(islandRows.some((row) => String(row.primary || '').includes('頂新')), 'Text rows should show matched Island text content');
} else {
  assert(sdaahRows.some((row) => String(row.primary || '').includes('A new year begins')), 'Text rows should show matched SDAAH text content');
}

const bodyItem = textCorpus.items.find((item) => item.role === 'body' && item.owner && item.owner.sceneId);
assert(bodyItem, 'should have body item with scene owner');
const context = viewer.textCorpusContextRows(model, bodyItem);
assert(context.length > 0, 'Text inspector should be able to build nearby context rows');
assert(context.some((item) => item.id === bodyItem.id), 'nearby context should include selected text item');

assert(typeof viewer.buildTextRevisionModel === 'function', 'viewer should expose text revision preview model');
assert(typeof viewer.textCorpusRoleLabel === 'function', 'viewer should expose human text corpus role labels');
assert(typeof viewer.textCorpusEditabilityLabel === 'function', 'viewer should expose human text editability labels');
assert(viewer.textCorpusRoleLabel('conditional_body') === 'conditional body', 'role helper should hide raw conditional_body keys');
assert(viewer.textCorpusRoleLabel('news_description') === 'news description', 'role helper should hide raw news_description keys');
assert(viewer.textCorpusEditabilityLabel('text_proposal') === 'text proposal', 'editability helper should hide raw text_proposal keys');
const revision = viewer.buildTextRevisionModel(bodyItem, bodyItem.text + ' 修訂');
assert(revision.before === bodyItem.text, 'text revision should keep original before text');
assert(revision.after.endsWith('修訂'), 'text revision should use replacement as after text');
assert(revision.changed === true, 'text revision should mark changed replacement');
assert(revision.diff.length >= 2, 'text revision should expose simple before/after diff rows');

process.stdout.write(JSON.stringify({
  ok: true,
  textItems: textCorpus.items.length,
  contextRows: context.length,
  revisionChanged: revision.changed,
  roles: Array.from(new Set(textCorpus.items.map((item) => item.role))).sort()
}, null, 2) + '\n');
