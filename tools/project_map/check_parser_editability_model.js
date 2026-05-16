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
    'on-arrival: parser_seen = 1; debate_leader = "Scholz"; debate_leader = "Curtius" if reform_done; public_order -= 2 if reform_done = 0',
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
assert(body.source && body.source.startLine === 9 && body.source.endLine === 10, 'multiline body should keep source range', body);
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
  optionLabel.id === stableTextId('source/scenes/events/parser_story.scene.dry', 12, 'option_label', 'Open debate——Make it visible.'),
  'split option labels should keep the pre-split stable text id for saved-draft compatibility',
  optionLabel
);

const reformVariable = index.variables.find((variable) => variable.name === 'reform_done');
const leaderVariable = index.variables.find((variable) => variable.name === 'debate_leader');
assert(reformVariable && reformVariable.reads.some((ref) => ref.path === 'source/scenes/events/parser_story.scene.dry' && ref.line === 5), 'shorthand on-arrival if suffix should index condition variables as reads', reformVariable);
assert(leaderVariable && leaderVariable.writes.some((ref) => ref.path === 'source/scenes/events/parser_story.scene.dry' && ref.line === 5), 'shorthand on-arrival assignments should still index variable writes', leaderVariable);

const indexedScene = index.scenes.find((item) => item.id === 'parser_story');
assert(indexedScene && indexedScene.effects && indexedScene.effects.some((effect) => effect.variable === 'public_order' && effect.sourceExpression === 'public_order -= 2 if reform_done = 0'), 'ProjectIndex should keep source-backed shorthand on-arrival effects', indexedScene && indexedScene.effects);
const indexedOption = indexedScene && indexedScene.options && indexedScene.options.find((option) => option.id === '@next_scene');
assert(indexedOption && indexedOption.sourceSpan && indexedOption.sourceSpan.anchorText === '- @next_scene: Open debate——Make it visible.', 'ProjectIndex should keep option source anchors for structural deletion', indexedOption);

const model = existingEdit.buildEditModel(index, 'events', 'parser_story');
assert(model.ok, 'Existing Scene Edit model should build from parser-backed index', model.diagnostics);
assert(model.fields.some((field) => field.id === optionLabel.id && field.original === 'Open debate'), 'existing edit model should expose parsed option label');
assert(model.fields.some((field) => field.id === optionSubtitle.id && field.original === 'Make it visible.'), 'existing edit model should expose parsed option subtitle');
assert(model.fields.some((field) => field.id === 'metadata_priority' && field.editability === 'guarded_replace_text'), 'existing edit model should expose guarded metadata priority');
const publicOrderEffect = model.fields.find((field) => field.role === 'effect' && field.original === 'Q.public_order -= 2 if reform_done = 0');
assert(publicOrderEffect, 'existing edit model should expose shorthand on-arrival effects as editable effect fields');
assert(publicOrderEffect.editability === 'guarded_replace_text', 'source-backed shorthand effect should be guarded', publicOrderEffect);
assert(publicOrderEffect.searchText === 'public_order -= 2 if reform_done = 0', 'shorthand effect should preserve bare source syntax for replacement', publicOrderEffect);
const removeOptionField = model.fields.find((field) => field.structureAction === 'remove_option' && field.optionId === 'next_scene');
assert(removeOptionField, 'existing edit model should expose parser-backed option deletion');
assert(removeOptionField.editability === 'advanced_source_patch', 'source-backed option deletion with local result fallout should be applyable, not manual review', removeOptionField);
assert(removeOptionField.structureSourceBlock && removeOptionField.structureSourceBlock.kind === 'option_bundle_delete', 'option deletion with local result fallout should carry source-backed bundle evidence', removeOptionField);

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

const removeOptionProposal = existingEdit.buildProposal(model, {
  [removeOptionField.id]: 'true'
});
const removeOptionBundle = existingEdit.buildExportBundle(removeOptionProposal, index);
assert(removeOptionBundle.installPlan.operations.length === 2, 'option deletion with local result fallout should create option-line and result-section operations');
assert(removeOptionBundle.installPlan.operations[0].type === 'replace_text', 'option deletion should replace exactly one source line');
assert(removeOptionBundle.installPlan.operations.every((operation) => operation.safety === 'advanced_apply'), 'option deletion bundle should be advanced apply, not manual review');
assert(removeOptionBundle.installPlan.operations[0].search === '- @next_scene: Open debate——Make it visible.', 'option deletion should search for the exact option line', removeOptionBundle.installPlan.operations[0]);
assert(removeOptionBundle.installPlan.operations[0].replace === '', 'option deletion should remove the exact option line', removeOptionBundle.installPlan.operations[0]);
const removeOptionDryRun = installPlan.applyInstallPlan(removeOptionBundle.installPlan, {projectRoot: root, dryRun: true, allowAdvanced: true});
assert(removeOptionDryRun.ok && removeOptionDryRun.results[0].status === 'would_apply', 'source-backed option deletion should dry-run cleanly', removeOptionDryRun);

const effectProposal = existingEdit.buildProposal(model, {
  [publicOrderEffect.id]: 'Q.public_order -= 3 if reform_done = 0'
});
const effectBundle = existingEdit.buildExportBundle(effectProposal, index);
assert(effectBundle.installPlan.operations.length === 1, 'effect proposal should create one operation');
assert(effectBundle.installPlan.operations[0].search === 'public_order -= 2 if reform_done = 0', 'effect edit should search for the bare source expression', effectBundle.installPlan.operations[0]);
assert(effectBundle.installPlan.operations[0].replace === 'public_order -= 3 if reform_done = 0', 'effect edit should write back Dendry shorthand without Q prefix', effectBundle.installPlan.operations[0]);
const effectDryRun = installPlan.applyInstallPlan(effectBundle.installPlan, {projectRoot: root, dryRun: true});
assert(effectDryRun.ok && effectDryRun.results[0].status === 'would_apply', 'source-backed shorthand effect replacement should dry-run cleanly', effectDryRun);
const effectApplied = installPlan.applyInstallPlan(effectBundle.installPlan, {projectRoot: root, dryRun: false});
assert(effectApplied.ok && effectApplied.results[0].status === 'applied', 'source-backed shorthand effect replacement should apply cleanly', effectApplied);
assert(fs.readFileSync(path.join(root, 'source', 'scenes', 'events', 'parser_story.scene.dry'), 'utf8').includes('public_order -= 3 if reform_done = 0'), 'source should contain applied shorthand effect replacement');

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
const removeOptionApplied = installPlan.applyInstallPlan(removeOptionBundle.installPlan, {projectRoot: root, dryRun: false, allowAdvanced: true});
assert(removeOptionApplied.ok && removeOptionApplied.results[0].status === 'applied', 'source-backed option deletion should apply to fixture', removeOptionApplied);
assert(!fs.readFileSync(path.join(root, 'source', 'scenes', 'events', 'parser_story.scene.dry'), 'utf8').includes('- @next_scene: Open debate——Make it visible.'), 'source should no longer contain the deleted option line');

process.stdout.write(JSON.stringify({
  ok: true,
  textItems: corpus.length,
  fields: model.fields.length,
  textBlocks: model.textBlocks.length,
  optionOperations: optionBundle.installPlan.operations.length,
  removeOptionSafety: removeOptionBundle.installPlan.operations[0].safety
}, null, 2) + '\n');
