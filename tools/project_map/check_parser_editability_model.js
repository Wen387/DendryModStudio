#!/usr/bin/env node
'use strict';

const {spawnSync} = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const existingEdit = require('./authoring/existing_scene_edit_model.js');
const installPlan = require('./authoring/install_plan.js');
const {pythonCommand} = require('./check_python_command.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function fail(message, details) {
  process.stderr.write(JSON.stringify(Object.assign({ok: false, message}, details || {}), null, 2) + '\n');
  process.exit(1);
}

function assert(condition, message, details) {
  if (!condition) {
    fail(message, details);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeFixture(root) {
  const scenes = path.join(root, 'source', 'scenes');
  const events = path.join(scenes, 'events');
  fs.mkdirSync(events, {recursive: true});
  fs.writeFileSync(path.join(root, 'source', 'info.dry'), [
    'title: Parser Editability Fixture',
    'author: Dendry Mod Studio',
    'ifid: 00000000-0000-4000-8000-000000000123',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(scenes, 'root.scene.dry'), [
    'title: Root',
    'new-page: true',
    '',
    '= Root',
    'Open the parser editability fixture.',
    '',
    '- @parser_story: Begin',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(events, 'parser_story.scene.dry'), [
    'title: Parser Story',
    'tags: event parser',
    'view-if: year = 1936 and month >= 1',
    'priority: 2',
    'new-page: true',
    '',
    '= Parser Story',
    'First line of the public scene.',
    'Second line continues the public scene.',
    '',
    '- @next_scene: Open debate——Make it visible.',
    '- #parser_card: Pull tagged card——From the tag lane.',
    '',
    '@next_scene',
    'title: Debate Result',
    'subtitle: Result subtitle',
    'choose-if: public_order > 0',
    'unavailable-subtitle: Not enough order.',
    '',
    '= Debate Result',
    'The debate branch can be edited.',
    '',
    '- @root: Return',
    ''
  ].join('\n'), 'utf8');
}

function buildIndex(root) {
  const out = path.join(os.tmpdir(), 'dms-parser-editability-' + process.pid + '.json');
  const result = spawnSync(pythonCommand(), [
    path.join(REPO_ROOT, 'tools', 'project_map', 'build_project_map.py'),
    '--root',
    root,
    '--out',
    out,
    '--summary'
  ], {cwd: REPO_ROOT, encoding: 'utf8'});
  assert(result.status === 0, 'ProjectIndex build should succeed', {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status
  });
  return readJson(out);
}

function textItems(index) {
  return index.semantic && index.semantic.textCorpus && Array.isArray(index.semantic.textCorpus.items)
    ? index.semantic.textCorpus.items
    : [];
}

function stableTextId(rel, line, role, text) {
  const digest = crypto.createHash('sha1').update(rel + ':' + line + ':' + role + ':' + text).digest('hex').slice(0, 12);
  return 'text_' + digest;
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_parser_editability_'));
writeFixture(root);
const index = buildIndex(root);
const corpus = textItems(index);

const body = corpus.find((item) => item.role === 'body' && String(item.text || '').includes('First line of the public scene'));
assert(body, 'Text Corpus should keep multiline body prose');
assert(body.source && body.source.startLine === 8 && body.source.endLine === 9, 'multiline body should keep source range', body);
assert(String(body.originalText || '').includes('\nSecond line continues'), 'multiline body should keep original source text', body);
assert(body.source.anchorText === 'First line of the public scene.', 'body source should keep first anchor', body);
assert(body.source.endAnchorText === 'Second line continues the public scene.', 'body source should keep end anchor', body);

const optionLabel = corpus.find((item) => item.role === 'option_label' && item.text === 'Open debate');
const optionSubtitle = corpus.find((item) => item.role === 'option_subtitle' && item.text === 'Make it visible.');
const tagOption = corpus.find((item) => item.role === 'option_label' && item.text === 'Pull tagged card');
assert(optionLabel, 'option parser should split visible option labels');
assert(optionSubtitle, 'option parser should split visible option subtitles');
assert(tagOption && tagOption.optionId === 'parser_card', 'option parser should index #tag option labels');
assert(
  optionLabel.id === stableTextId('source/scenes/events/parser_story.scene.dry', 11, 'option_label', 'Open debate——Make it visible.'),
  'split option labels should keep the pre-split stable text id for saved-draft compatibility',
  optionLabel
);

const model = existingEdit.buildEditModel(index, 'events', 'parser_story');
assert(model.ok, 'Existing Scene Edit model should build from parser-backed index', model.diagnostics);
assert(model.fields.some((field) => field.id === optionLabel.id && field.original === 'Open debate'), 'existing edit model should expose parsed option label');
assert(model.fields.some((field) => field.id === optionSubtitle.id && field.original === 'Make it visible.'), 'existing edit model should expose parsed option subtitle');
assert(model.fields.some((field) => field.id === 'metadata_priority' && field.editability === 'guarded_replace_text'), 'existing edit model should expose guarded metadata priority');

const block = model.textBlocks.find((item) => String(item.original || '').includes('First line of the public scene'));
assert(block, 'existing edit model should build a source-backed page block from parsed body text');

const optionProposal = existingEdit.buildProposal(model, {
  [optionLabel.id]: 'Open policy debate',
  metadata_priority: '3'
});
const optionBundle = existingEdit.buildExportBundle(optionProposal, index);
assert(optionBundle.installPlan.operations.length === 2, 'option/metadata proposal should create two operations');
assert(optionBundle.installPlan.operations.every((operation) => operation.type === 'replace_text'), 'option/metadata edits should be replace_text');
assert(optionBundle.installPlan.operations.every((operation) => operation.safety === 'guarded_apply'), 'option/metadata edits should be guarded');

const blockProposal = existingEdit.buildProposal(model, {
  ['block:' + block.id]: [
    '= Parser Story',
    'A replaced parser-backed section.',
    'It still uses guarded source anchors.',
    ''
  ].join('\n')
});
const blockBundle = existingEdit.buildExportBundle(blockProposal, index);
assert(blockBundle.installPlan.operations[0].type === 'replace_section', 'page block edit should create replace_section');
assert(blockBundle.installPlan.operations[0].safety === 'guarded_apply', 'page block edit should be guarded');

const dryRun = installPlan.applyInstallPlan(blockBundle.installPlan, {projectRoot: root, dryRun: true});
assert(dryRun.ok && dryRun.results[0].status === 'would_apply', 'parser-backed section replacement should dry-run cleanly', dryRun);
const applied = installPlan.applyInstallPlan(blockBundle.installPlan, {projectRoot: root, dryRun: false});
assert(applied.ok && applied.results[0].status === 'applied', 'parser-backed section replacement should apply to fixture', applied);
assert(fs.readFileSync(path.join(root, 'source', 'scenes', 'events', 'parser_story.scene.dry'), 'utf8').includes('replaced parser-backed section'), 'source should contain applied parser-backed replacement');

process.stdout.write(JSON.stringify({
  ok: true,
  textItems: corpus.length,
  fields: model.fields.length,
  textBlocks: model.textBlocks.length,
  optionOperations: optionBundle.installPlan.operations.length
}, null, 2) + '\n');
