#!/usr/bin/env node
'use strict';

const {spawnSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const editCapability = require('./authoring/edit_capability_model.js');
const draftExtract = require('./authoring/draft_extract.js');
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
  const cards = path.join(scenes, 'cards');
  fs.mkdirSync(events, {recursive: true});
  fs.mkdirSync(cards, {recursive: true});
  fs.writeFileSync(path.join(root, 'source', 'info.dry'), [
    'title: Edit Capability Fixture',
    'author: Dendry Mod Studio',
    'ifid: 00000000-0000-4000-8000-000000000124',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(scenes, 'root.scene.dry'), [
    'title: Root',
    'new-page: true',
    '',
    '= Root',
    'Root intro belongs to entry UI.',
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
    '',
    '= Debate Result',
    'The debate branch can be edited.',
    '',
    '- @root: Return',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(cards, 'parser_card.scene.dry'), [
    'title: Parser Card',
    'tags: card',
    'priority: 1',
    '',
    '= Parser Card',
    'A playable card can be edited.',
    '',
    '- @root: Done',
    ''
  ].join('\n'), 'utf8');
}

function buildIndex(root) {
  const out = path.join(os.tmpdir(), 'dms-edit-capability-' + process.pid + '.json');
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

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_edit_capability_'));
writeFixture(root);
const index = buildIndex(root);
const corpus = textItems(index);

const body = corpus.find((item) => item.role === 'body' && String(item.text || '').includes('First line of the public scene'));
assert(body, 'fixture should expose parser-backed body text');
const bodyCapability = editCapability.buildEditCapability(index, 'textCorpus', body);
assert(bodyCapability.routeClass === 'direct_section_replace', 'body prose should route to a bounded section editor', bodyCapability);
assert(String(bodyCapability.target && bodyCapability.target.valueKey || '').startsWith('block:'), 'body route should identify an Existing Scene block value key', bodyCapability);
assert(bodyCapability.installSafety === 'guarded_apply', 'body section route should preserve guarded apply intent', bodyCapability);

const optionLabel = corpus.find((item) => item.role === 'option_label' && item.text === 'Open debate');
assert(optionLabel, 'fixture should expose option label text');
const optionCapability = editCapability.buildEditCapability(index, 'textCorpus', optionLabel);
assert(optionCapability.routeClass === 'direct_field_replace', 'option labels should route to a concrete object field', optionCapability);
assert(optionCapability.target && optionCapability.target.valueKey === optionLabel.id, 'option label route should identify the matching field value key', optionCapability);

const rootBody = corpus.find((item) => item.role === 'body' && String(item.text || '').includes('Root intro belongs to entry UI'));
assert(rootBody, 'fixture should expose root body text');
const rootCapability = editCapability.buildEditCapability(index, 'textCorpus', rootBody);
assert(rootCapability.routeClass === 'system_ui_workspace', 'root text should route to System UI workspace instead of generic text replacement', rootCapability);
assert(rootCapability.target && rootCapability.target.template === 'entry', 'root text should open the Entry/System UI screen route', rootCapability);

const routerText = {
  id: 'router_copy',
  role: 'monthly_popup_excerpt',
  text: 'Monthly router copy',
  source: {path: 'source/scenes/post_event.scene.dry', line: 12},
  owner: {kind: 'news_router'}
};
const routerCapability = editCapability.buildEditCapability(index, 'textCorpus', routerText);
assert(routerCapability.routeClass === 'news_router_workflow', 'post_event router text should stay in news/router review workflow', routerCapability);
assert(routerCapability.installSafety === 'manual_review', 'router text should not be auto-applied', routerCapability);

const rootSurface = {
  id: 'root_title_surface',
  label: 'Root',
  area: 'entry',
  editability: 'draft_exportable',
  source: {path: 'source/scenes/root.scene.dry', line: 1},
  owner: {kind: 'surface_text'}
};
const surfaceCapability = editCapability.buildEditCapability(index, 'surfaceText', rootSurface);
assert(surfaceCapability.routeClass === 'system_ui_workspace', 'protected root surface text should route to System UI', surfaceCapability);
const surfaceDraftResult = draftExtract.textReplacementDraftFromItem(index, 'surfaceText', rootSurface, {replacementText: 'New Root'});
assert(surfaceDraftResult.ok, 'root surface text should still create a reviewable proposal', surfaceDraftResult);
assert(surfaceDraftResult.draft.editability === 'ide_escape_hatch', 'root surface text proposals should not look like ordinary safe replacements', surfaceDraftResult.draft);

process.stdout.write(JSON.stringify({
  ok: true,
  textItems: corpus.length,
  bodyRoute: bodyCapability.routeClass,
  optionRoute: optionCapability.routeClass,
  rootRoute: rootCapability.routeClass,
  routerRoute: routerCapability.routeClass
}, null, 2) + '\n');
