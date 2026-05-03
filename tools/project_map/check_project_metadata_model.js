#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const metadataDraft = require('./authoring/project_metadata_draft.js');
const installPlan = require('./authoring/install_plan.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function syntheticIndex(root) {
  return {
    schemaVersion: '0.1',
    project: {
      name: 'Old Game',
      root,
      profileIds: ['generic-dendry'],
      info: {
        title: 'Old Game',
        author: 'Old Author',
        ifid: '00000000-0000-4000-8000-000000000111'
      },
      infoSource: {
        title: {path: 'source/info.dry', line: 1, anchorText: 'title: Old Game'},
        author: {path: 'source/info.dry', line: 2, anchorText: 'author: Old Author'},
        ifid: {path: 'source/info.dry', line: 3, anchorText: 'ifid: 00000000-0000-4000-8000-000000000111'}
      }
    },
    scenes: [],
    variables: [],
    semantic: {},
    diagnostics: []
  };
}

function missingIfidIndex(root) {
  return {
    schemaVersion: '0.1',
    project: {
      name: 'No IFID Game',
      root,
      profileIds: ['generic-dendry'],
      info: {
        title: 'No IFID Game',
        author: 'Fixture Author'
      },
      infoSource: {
        title: {path: 'source/info.dry', line: 1, anchorText: 'title: No IFID Game'},
        author: {path: 'source/info.dry', line: 2, anchorText: 'author: Fixture Author'}
      }
    },
    scenes: [],
    variables: [],
    semantic: {},
    diagnostics: []
  };
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_project_metadata_'));
fs.mkdirSync(path.join(tmpRoot, 'source'), {recursive: true});
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'info.dry'),
  [
    'title: Old Game',
    'author: Old Author',
    'ifid: 00000000-0000-4000-8000-000000000111',
    ''
  ].join('\n'),
  'utf8'
);

const index = syntheticIndex(tmpRoot);
const model = metadataDraft.buildMetadataModel(index);
assert(model.kind === 'project_metadata_model', 'metadata model should build from ProjectIndex');
assert(model.fields.title.line === 1, 'metadata model should expose title line evidence');
assert(model.fields.author.anchorText === 'author: Old Author', 'metadata model should expose author anchor evidence');

const draft = metadataDraft.defaultDraft(index);
draft.title = 'Justice Party Game Info';
draft.gameTitle = 'Justice Party Campaign Office';
draft.author = 'Dendry Mod Studio Playtest';
draft.ifid = '00000000-0000-4000-8000-000000000401';
const bundle = metadataDraft.buildExportBundle(draft, index);
assert(bundle.ok, 'metadata bundle should validate: ' + JSON.stringify(bundle.diagnostics));
assert(bundle.installPlan.draftKind === 'project_metadata', 'bundle should expose project_metadata install plan');
assert(bundle.playerPreview.includes('Justice Party Campaign Office'), 'player preview should show new title');
assert(bundle.installNotes.includes('local-save prefix'), 'install notes should warn about save key changes');
const zhBundle = metadataDraft.buildExportBundle(draft, index, {locale: 'zh-Hant'});
assert(zhBundle.playerPreview.includes('遊戲資訊'), 'localized player preview should translate the Game Info label');
assert(zhBundle.installChecklist.includes('安裝操作檢查清單'), 'localized install checklist should translate the checklist heading');
assert(zhBundle.installNotes.includes('遊戲資訊草稿'), 'localized install notes should translate the draft label');
assert(bundle.installPlan.operations.length === 3, 'changing all metadata fields should generate three operations');
assert(bundle.installPlan.operations.every((op) => op.path === 'source/info.dry'), 'metadata operations must target source/info.dry only');
assert(bundle.installPlan.operations.every((op) => op.safety === 'guarded_apply'), 'source-backed metadata operations should be guarded');
assert(bundle.patchPreview.includes('title: Justice Party Campaign Office'), 'patch preview should show title replacement');

const dryRun = installPlan.applyInstallPlan(bundle.installPlan, {projectRoot: tmpRoot, dryRun: true});
assert(dryRun.ok && dryRun.results.every((item) => item.status === 'would_apply'), 'metadata dry-run should apply with exact line evidence: ' + JSON.stringify(dryRun));
const applied = installPlan.applyInstallPlan(bundle.installPlan, {projectRoot: tmpRoot, dryRun: false});
assert(applied.ok, 'metadata apply should succeed: ' + JSON.stringify(applied));
const infoText = fs.readFileSync(path.join(tmpRoot, 'source', 'info.dry'), 'utf8');
assert(infoText.includes('title: Justice Party Campaign Office'), 'metadata apply should update title');
assert(infoText.includes('author: Dendry Mod Studio Playtest'), 'metadata apply should update author');
assert(infoText.includes('ifid: 00000000-0000-4000-8000-000000000401'), 'metadata apply should update ifid');

const missingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_project_metadata_missing_'));
fs.mkdirSync(path.join(missingRoot, 'source'), {recursive: true});
fs.writeFileSync(path.join(missingRoot, 'source', 'info.dry'), 'title: No IFID Game\nauthor: Fixture Author\n', 'utf8');
const insertDraft = metadataDraft.defaultDraft(missingIfidIndex(missingRoot));
insertDraft.ifid = '00000000-0000-4000-8000-000000000402';
const insertPlan = metadataDraft.buildInstallPlan(insertDraft, missingIfidIndex(missingRoot));
assert(insertPlan.operations.some((op) => op.type === 'insert_text' && op.id === 'project_metadata_ifid_insert'), 'missing ifid should generate guarded insert_text');
const insertApply = installPlan.applyInstallPlan(insertPlan, {projectRoot: missingRoot, dryRun: false});
assert(insertApply.ok, 'missing ifid insert should apply: ' + JSON.stringify(insertApply));
assert(fs.readFileSync(path.join(missingRoot, 'source', 'info.dry'), 'utf8').includes('ifid: 00000000-0000-4000-8000-000000000402'), 'ifid insert should write source/info.dry');

const invalid = metadataDraft.validateDraft(Object.assign({}, draft, {ifid: 'not-an-ifid'}));
assert(!invalid.ok && invalid.diagnostics.some((item) => item.code === 'project_metadata.ifid'), 'invalid IFID should be diagnosed');
const invalidPlan = metadataDraft.buildInstallPlan(Object.assign({}, draft, {ifid: 'not-an-ifid'}), index);
assert(invalidPlan.operations.length === 1 && invalidPlan.operations[0].safety === 'manual_review', 'invalid metadata drafts should not generate guarded operations');

const refused = installPlan.applyInstallPlan({
  schemaVersion: '0.1',
  kind: 'dendry_mod_studio_install_plan',
  id: 'bad_metadata',
  draftKind: 'project_metadata',
  status: 'proposal_only',
  project: {root: tmpRoot},
  operations: [{
    id: 'bad',
    type: 'replace_text',
    path: 'source/info.dry',
    line: 1,
    search: 'title: Justice Party Campaign Office',
    replace: 'javascript: alert(1)',
    safety: 'guarded_apply',
    role: 'project_metadata.title'
  }]
}, {projectRoot: tmpRoot, dryRun: true});
assert(!refused.ok && refused.results[0].status === 'failed', 'non-metadata line replacement should be refused');

const starterOut = path.join(os.tmpdir(), 'dendry_project_metadata_starter_' + process.pid + '.json');
const starterIndexResult = spawnSync('python3', [
  path.join(__dirname, 'build_project_map.py'),
  '--root',
  path.join(__dirname, 'templates', 'starter-demo'),
  '--out',
  starterOut
], {cwd: path.resolve(__dirname, '..', '..'), encoding: 'utf8'});
assert(starterIndexResult.status === 0, 'starter demo index should build with metadata source evidence: ' + (starterIndexResult.stderr || starterIndexResult.stdout));
const starterIndex = JSON.parse(fs.readFileSync(starterOut, 'utf8'));
assert(starterIndex.project.info.title === 'Dendry Mod Studio Starter Demo', 'ProjectIndex should preserve source/info.dry title');
assert(starterIndex.project.infoSource.title.line === 1, 'ProjectIndex should expose title line evidence from source/info.dry');
assert(starterIndex.project.infoSource.author.anchorText === 'author: Dendry Mod Studio', 'ProjectIndex should expose author anchor text from source/info.dry');
fs.rmSync(starterOut, {force: true});

fs.rmSync(tmpRoot, {recursive: true, force: true});
fs.rmSync(missingRoot, {recursive: true, force: true});

process.stdout.write(JSON.stringify({
  ok: true,
  operations: bundle.installPlan.operations.length,
  insertedIfid: true
}, null, 2) + '\n');
