#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const eventDraft = require('./authoring/event_draft.js');
const cardDraft = require('./authoring/card_draft.js');
const draftExtract = require('./authoring/draft_extract.js');
const existingSceneEdit = require('./authoring/existing_scene_edit_model.js');
const installPlan = require('./authoring/install_plan.js');
const surfaceDraft = require('./authoring/surface_text_draft.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_ROOT = path.resolve(process.env.DMS_SDAAH_FIXTURE_ROOT || path.join(REPO_ROOT, 'social_democracy_alternate_history-main'));

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function copyProjectFixture(sourceRoot) {
  assert(fs.existsSync(path.join(sourceRoot, 'source', 'info.dry')), 'SDAAH fixture root should contain source/info.dry: ' + sourceRoot);
  const copyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_sdaah_install_write_'));
  fs.cpSync(sourceRoot, copyRoot, {
    recursive: true,
    filter: (source) => !source.includes(path.sep + '.git' + path.sep)
  });
  return copyRoot;
}

function buildIndex(copyRoot) {
  const indexPath = copyRoot + '.project-index.json';
  const result = childProcess.spawnSync('python3', [
    path.join(REPO_ROOT, 'tools', 'project_map', 'build_project_map.py'),
    '--root', copyRoot,
    '--out', indexPath,
    '--summary',
    '--include-excerpts',
    '--excerpt-context-lines', '2'
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });
  assert(result.status === 0, 'SDAAH ProjectIndex build should succeed: ' + result.stderr + result.stdout);
  return {indexPath, index: readJson(indexPath), summary: result.stdout};
}

function operationStatuses(result) {
  return result.results.map((item) => item.id + ':' + item.status).join(', ');
}

function dryRunThenApply(plan, copyRoot, label) {
  const dry = installPlan.applyInstallPlan(plan, {projectRoot: copyRoot, dryRun: true});
  assert(dry.ok, label + ' dry-run should succeed: ' + JSON.stringify(dry));
  assert(dry.results.some((result) => result.status === 'would_apply'), label + ' dry-run should report would_apply: ' + operationStatuses(dry));
  const applied = installPlan.applyInstallPlan(plan, {projectRoot: copyRoot, dryRun: false});
  assert(applied.ok, label + ' apply should succeed: ' + JSON.stringify(applied));
  assert(applied.results.some((result) => result.status === 'applied'), label + ' apply should mutate copy source: ' + operationStatuses(applied));
  return applied;
}

function eventSmokeDraft(id, title, year, month) {
  return {
    schemaVersion: '0.1',
    kind: 'world_event',
    id,
    title,
    heading: title,
    seenFlag: id + '_seen',
    when: {
      year,
      monthStart: month,
      monthEnd: month,
      requires: 'started = 1',
      priority: 0
    },
    introParagraphs: [
      'Studio smoke text: this SDAAH-style popup was installed into a copied project.'
    ],
    options: [
      {
        id: 'acknowledge',
        label: 'Acknowledge the report.',
        effects: [{variable: 'resources', op: '-=', value: 1}],
        narrativeParagraphs: ['The party records the report and moves on.']
      },
      {
        id: 'defer',
        label: 'Defer the matter.',
        effects: [],
        narrativeParagraphs: ['The report remains open for later discussion.']
      }
    ]
  };
}

function cardSmokeDraft() {
  return {
    schemaVersion: '0.1',
    kind: 'card',
    id: 'dms_sdaah_smoke_card',
    title: 'Studio Smoke Card',
    cardKind: 'action_card',
    tags: ['party_affairs'],
    heading: 'Studio Smoke Card',
    subtitle: 'A temporary card installed only in the copied SDAAH project.',
    introParagraphs: ['This card verifies that Create -> Review & Apply can write a new card scene.'],
    options: [
      {
        id: 'organize',
        label: 'Organize a small meeting.',
        title: 'Organize',
        effects: [{variable: 'resources', op: '-=', value: 1}],
        narrativeParagraphs: ['A small meeting leaves a source-level trace in the copied fixture.'],
        gotoAfter: 'root'
      },
      {
        id: 'wait',
        label: 'Wait.',
        title: 'Wait',
        effects: [],
        narrativeParagraphs: ['Nothing is changed beyond the installed card proposal.'],
        gotoAfter: 'root'
      }
    ]
  };
}

function findSurfaceItem(index, label, sourcePath) {
  const items = index.semantic && index.semantic.surfaceText ? index.semantic.surfaceText.items || [] : [];
  return items.find((item) => item.label === label && item.source && item.source.path === sourcePath);
}

function findTextCorpusItem(index, sceneId, textStart) {
  const items = index.semantic && index.semantic.textCorpus ? index.semantic.textCorpus.items || [] : [];
  return items.find((item) => {
    const owner = item.owner || {};
    return owner.sceneId === sceneId &&
      item.source &&
      item.source.line &&
      (!item.source.endLine || item.source.endLine === item.source.line) &&
      String(item.text || '').startsWith(textStart);
  });
}

function applySurfaceText(index, copyRoot) {
  const item = findSurfaceItem(index, 'Government', 'source/scenes/status.scene.dry');
  assert(item, 'SDAAH index should expose source-backed status surface text');
  const original = read(path.join(copyRoot, 'source', 'scenes', 'status.scene.dry'));
  const draftResult = draftExtract.textReplacementDraftFromItem(index, 'surfaceText', item.id, {
    replacementText: 'Government (Studio Smoke)'
  });
  assert(draftResult.ok, 'surface text extraction should produce a draft');
  const bundle = surfaceDraft.buildExportBundle(draftResult.draft, index);
  const applied = installPlan.applyInstallPlan(bundle.installPlan, {projectRoot: copyRoot, dryRun: false});
  assert(applied.ok, 'status surface text proposal should not fail');
  assert(applied.results[0].status === 'manual_review', 'status/sidebar surface text should stay manual_review and route through System UI review');
  assert(read(path.join(copyRoot, 'source', 'scenes', 'status.scene.dry')) === original, 'manual status surface text proposal must not mutate status.scene.dry');
}

function applyHtmlSurfaceManualCheck(index, copyRoot) {
  const item = findSurfaceItem(index, 'Library', 'out/html/index.html');
  assert(item, 'SDAAH index should expose out/html Library surface text');
  const original = read(path.join(copyRoot, 'out', 'html', 'index.html'));
  const draftResult = draftExtract.textReplacementDraftFromItem(index, 'surfaceText', item.id, {
    replacementText: 'Library (Studio Smoke)'
  });
  assert(draftResult.ok, 'HTML surface text extraction should still produce a proposal');
  const bundle = surfaceDraft.buildExportBundle(draftResult.draft, index);
  const applied = installPlan.applyInstallPlan(bundle.installPlan, {projectRoot: copyRoot, dryRun: false});
  assert(applied.ok, 'manual-only HTML surface proposal should not fail');
  assert(applied.results[0].status === 'manual_review', 'out/html surface text should stay manual_review');
  assert(read(path.join(copyRoot, 'out', 'html', 'index.html')) === original, 'out/html surface text proposal must not mutate generated/protected output');
}

function applyTextCorpus(index, copyRoot) {
  const item = findTextCorpusItem(index, 'aufhauser', 'Aufhäuser is a leader of the AfA-Bund');
  assert(item, 'SDAAH index should expose a single-line Text Corpus item');
  const draftResult = draftExtract.textReplacementDraftFromItem(index, 'textCorpus', item.id, {
    replacementText: 'Aufhäuser is a Studio smoke-test advisor entry in this copied project.'
  });
  assert(draftResult.ok, 'text corpus extraction should produce a proposal draft');
  const bundle = surfaceDraft.buildExportBundle(draftResult.draft, index);
  assert(bundle.installPlan.operations[0].safety === 'guarded_apply', 'single-line text corpus replacement should be guarded_apply');
  dryRunThenApply(bundle.installPlan, copyRoot, 'text corpus');
  assert(read(path.join(copyRoot, 'source', 'scenes', 'advisors', 'aufhauser.scene.dry')).includes('Studio smoke-test advisor entry'), 'text corpus apply should update advisor prose');
}

function applyExistingEventText(index, copyRoot) {
  const model = existingSceneEdit.buildEditModel(index, 'events', 'all_quiet');
  assert(model.ok, 'SDAAH all_quiet should build an Existing Scene Editor model: ' + JSON.stringify(model.diagnostics));
  const bodyField = model.fields.find((field) => field.original.startsWith('As an anti-war film'));
  assert(bodyField, 'SDAAH all_quiet Existing Scene Editor model should expose source-backed body prose');
  const proposal = existingSceneEdit.buildProposal(model, {
    [bodyField.id]: 'As a Studio smoke-test edit, this copied event now records a bounded prose replacement.'
  });
  const bundle = existingSceneEdit.buildExportBundle(proposal, index);
  assert(bundle.installPlan.draftKind === 'existing_scene_edit', 'existing event text should use existing_scene_edit install plans');
  assert(bundle.installPlan.operations[0].type === 'replace_text', 'existing scene edit should produce guarded replace_text');
  dryRunThenApply(bundle.installPlan, copyRoot, 'existing event text');
  assert(read(path.join(copyRoot, 'source', 'scenes', 'events', 'all_quiet.scene.dry')).includes('Studio smoke-test edit'), 'existing event text apply should update event source');
}

function applyEventChainEdit(copyRoot, index) {
  const model = existingSceneEdit.buildEditModel(index, 'events', 'all_quiet');
  const conditionField = model.fields.find((field) => field.role === 'condition' && field.id === 'metadata_viewIf');
  assert(conditionField, 'SDAAH all_quiet Existing Scene Editor model should expose editable view-if event-chain condition');
  assert(conditionField.editability === 'guarded_replace_text', 'SDAAH all_quiet view-if should be guarded with exact source evidence');
  const proposal = existingSceneEdit.buildProposal(model, {
    [conditionField.id]: conditionField.original + ' and dms_sdaah_smoke_world_event_seen = 1'
  });
  const bundle = existingSceneEdit.buildExportBundle(proposal, index);
  assert(bundle.installPlan.draftKind === 'existing_scene_edit', 'event-chain condition edit should use existing_scene_edit install plans');
  assert(bundle.installPlan.operations[0].type === 'replace_text', 'event-chain condition edit should produce guarded replace_text');
  assert(bundle.installPlan.operations[0].search === conditionField.original, 'event-chain condition edit should guard against the original view-if text');
  dryRunThenApply(bundle.installPlan, copyRoot, 'event chain edit');
  assert(read(path.join(copyRoot, 'source', 'scenes', 'events', 'all_quiet.scene.dry')).includes('dms_sdaah_smoke_world_event_seen = 1'), 'event chain apply should update all_quiet view-if');
}

const copyRoot = copyProjectFixture(FIXTURE_ROOT);
const originalRootMarker = read(path.join(FIXTURE_ROOT, 'source', 'scenes', 'root.scene.dry'));
const originalAllQuiet = read(path.join(FIXTURE_ROOT, 'source', 'scenes', 'events', 'all_quiet.scene.dry'));
const {index, summary} = buildIndex(copyRoot);

assert(index.project && index.project.root === copyRoot, 'generated index should point at the copied SDAAH root');
assert((index.project.profileIds || []).includes('sdaah-style'), 'SDAAH copy should be detected as sdaah-style');
assert((index.semantic.news.eventPopups || []).length > 0, 'SDAAH copy should expose legacy monthly event popups');

const eventBundle = eventDraft.buildExportBundle(eventSmokeDraft('dms_sdaah_smoke_world_event', 'Studio Smoke World Event', 1930, 2), index);
assert(eventBundle.ok, 'world event bundle should validate: ' + JSON.stringify(eventBundle.diagnostics));
dryRunThenApply(eventBundle.installPlan, copyRoot, 'world event');
assert(fs.existsSync(path.join(copyRoot, 'source', 'scenes', 'events', 'dms_sdaah_smoke_world_event.scene.dry')), 'world event apply should create event scene');
assert(read(path.join(copyRoot, 'source', 'scenes', 'root.scene.dry')).includes('Q.dms_sdaah_smoke_world_event_seen = 0;'), 'world event apply should insert root seen flag');
assert(read(path.join(copyRoot, 'source', 'scenes', 'post_event.scene.dry')).includes('Q.dms_sdaah_smoke_world_event_seen === undefined'), 'world event apply should insert post_event migration guard');

const newsEventBundle = eventDraft.buildExportBundle(eventSmokeDraft('dms_sdaah_smoke_news_event', 'Studio Smoke Monthly News Event', 1930, 3), index);
assert(newsEventBundle.ok, 'SDAAH news-as-event bundle should validate: ' + JSON.stringify(newsEventBundle.diagnostics));
dryRunThenApply(newsEventBundle.installPlan, copyRoot, 'SDAAH news-as-event');
const newsScene = read(path.join(copyRoot, 'source', 'scenes', 'events', 'dms_sdaah_smoke_news_event.scene.dry'));
assert(newsScene.includes('tags: event'), 'SDAAH news-as-event scene should be routed through #event');

const cardBundle = cardDraft.buildExportBundle(cardSmokeDraft(), index);
assert(cardBundle.ok, 'card bundle should validate: ' + JSON.stringify(cardBundle.diagnostics));
const cardCreate = cardBundle.installPlan.operations.find((operation) => operation.id === 'create_scene');
assert(cardCreate && cardCreate.path && cardCreate.path.startsWith('source/scenes/'), 'card bundle should choose a source/scenes path for Dynamic card routes');
dryRunThenApply(cardBundle.installPlan, copyRoot, 'card');
assert(fs.existsSync(path.join(copyRoot, cardCreate.path)), 'card apply should create card scene at the suggested Dynamic-aware path');

applySurfaceText(index, copyRoot);
applyHtmlSurfaceManualCheck(index, copyRoot);
applyTextCorpus(index, copyRoot);
applyExistingEventText(index, copyRoot);
applyEventChainEdit(copyRoot, index);

assert(read(path.join(FIXTURE_ROOT, 'source', 'scenes', 'root.scene.dry')) === originalRootMarker, 'original SDAAH root.scene.dry must remain untouched');
assert(read(path.join(FIXTURE_ROOT, 'source', 'scenes', 'events', 'all_quiet.scene.dry')) === originalAllQuiet, 'original SDAAH event source must remain untouched');

process.stdout.write(JSON.stringify({
  ok: true,
  copyRoot,
  profiles: index.project.profileIds,
  eventPopups: index.semantic.news.eventPopups.length,
  summary: summary.trim().split('\n').slice(0, 4)
}, null, 2) + '\n');
