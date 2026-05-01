#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const installPlan = require('./authoring/install_plan.js');
const applyInstallPlanCli = require('./apply_install_plan.js');
const eventDraft = require('./authoring/event_draft.js');
const newsDraft = require('./authoring/news_draft.js');
const cardDraft = require('./authoring/card_draft.js');
const surfaceDraft = require('./authoring/surface_text_draft.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const SAMPLE_EVENT = path.join(FIXTURES, 'event_drafts', 'sample_world_event.json');
const SAMPLE_NEWS = path.join(FIXTURES, 'news_drafts', 'sample_dated_news.json');
const SAMPLE_CARD = path.join(FIXTURES, 'card_drafts', 'sample_action_card.json');
const SAMPLE_SURFACE = path.join(FIXTURES, 'surface_text_drafts', 'sample_label_replacement.json');
const INSTALL_PLAN_SCHEMA = path.join(__dirname, 'schema', 'install-plan.schema.json');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function syntheticIndex(root) {
  return {
    schemaVersion: '0.1',
    project: {name: 'install fixture', root, profileIds: ['generic-dendry']},
    profiles: [{id: 'generic-dendry'}],
    scenes: [
      {id: 'root'},
      {id: 'status'},
      {
        id: 'main',
        path: 'source/scenes/main.scene.dry',
        options: [
          {id: '#party_affairs', target: {kind: 'tag', id: 'party_affairs'}, sourceSpan: {path: 'source/scenes/main.scene.dry', startLine: 2, endLine: 2}}
        ],
        sections: [
          {
            id: 'main.party',
            options: [
              {id: '#party_affairs', target: {kind: 'tag', id: 'party_affairs'}, sourceSpan: {path: 'source/scenes/main.scene.dry', startLine: 8, endLine: 8}}
            ]
          }
        ]
      }
    ],
    edges: [],
    variables: [{name: 'resources'}, {name: 'media_reach'}, {name: 'civil_society_trust'}],
    semantic: {
      events: [],
      cards: [],
      hands: [{id: 'main', path: 'source/scenes/main.scene.dry'}],
      decks: [],
      pinnedCards: [],
      news: {sources: ['source/scenes/post_event_news.scene.dry'], items: []}
    },
    diagnostics: [],
    summary: {}
  };
}

function bundleFile(bundle, suffix) {
  return bundle.files.find((file) => file.path.endsWith(suffix));
}

function assertInstallFiles(bundle, id) {
  assert(bundle.installPlan, id + ' bundle should expose installPlan object');
  assert(bundle.patchPreview && bundle.patchPreview.includes('diff --git'), id + ' bundle should expose patch preview');
  assert(bundleFile(bundle, '.install-plan.json'), id + ' bundle should include install-plan JSON file');
  assert(bundleFile(bundle, '.patch-preview.diff'), id + ' bundle should include patch preview file');
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_install_plan_fixture_'));
fs.mkdirSync(path.join(tmpRoot, 'source', 'scenes'), {recursive: true});
fs.writeFileSync(path.join(tmpRoot, 'source', 'info.dry'), 'title: Install Fixture\n', 'utf8');
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'status.scene.dry'),
  Array.from({length: 11}, (_, index) => 'line ' + (index + 1)).join('\n') + '\n資源：0\n',
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'root.scene.dry'),
  'ROOT_LABEL\n// ====== U. EVENT SEEN FLAGS ======\nQ.existing_seen = 0;\n',
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'post_event.scene.dry'),
  'POST_EVENT_LABEL\n// Save compatibility: post_event split (post_event_news)\nif (Q.existing_seen === undefined) Q.existing_seen = 0;\n',
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'post_event_news.scene.dry'),
  'POST_EVENT_NEWS_LABEL\n// 2014 headlines + background effects\n',
  'utf8'
);
fs.mkdirSync(path.join(tmpRoot, 'source', 'scenes', 'events'), {recursive: true});
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'event_text.scene.dry'),
  'title: Event Text\n\nOriginal player-facing paragraph.\n',
  'utf8'
);
const index = syntheticIndex(tmpRoot);

const eventBundle = eventDraft.buildExportBundle(readJson(SAMPLE_EVENT), index);
const newsBundle = newsDraft.buildExportBundle(readJson(SAMPLE_NEWS), index);
const cardBundle = cardDraft.buildExportBundle(readJson(SAMPLE_CARD), index);
const surfaceBundle = surfaceDraft.buildExportBundle(readJson(SAMPLE_SURFACE), index);
const schema = readJson(INSTALL_PLAN_SCHEMA);

assertInstallFiles(eventBundle, 'event');
assertInstallFiles(newsBundle, 'news');
assertInstallFiles(cardBundle, 'card');
assertInstallFiles(surfaceBundle, 'surface');
assert(eventBundle.installPlan.project && eventBundle.installPlan.project.root === tmpRoot, 'event plan should record source project provenance');
assert(newsBundle.installPlan.project && newsBundle.installPlan.project.root === tmpRoot, 'news plan should record source project provenance');
assert(cardBundle.installPlan.project && cardBundle.installPlan.project.root === tmpRoot, 'card plan should record source project provenance');
assert(surfaceBundle.installPlan.project && surfaceBundle.installPlan.project.root === tmpRoot, 'surface plan should record source project provenance');

assert(eventBundle.installPlan.operations.some((op) => op.type === 'create_file' && op.safety === 'safe_apply'), 'event plan should safely create scene file');
assert(eventBundle.installPlan.operations.some((op) => op.id === 'root_seen_flag' && op.type === 'insert_text' && op.safety === 'guarded_apply'), 'event plan should guarded-insert root seen flag init');
assert(eventBundle.installPlan.operations.some((op) => op.id === 'post_event_migration' && op.type === 'insert_text' && op.safety === 'guarded_apply'), 'event plan should guarded-insert post_event migration guard');
assert(installPlan.operationSummary(eventBundle.installPlan).manualReview === 0, 'event plan should not leave root/post_event snippets as manual when anchors are known');
assert(installPlan.operationSummary(eventBundle.installPlan).guardedApply === 2, 'event plan should count root/post_event inserts as guarded operations');
assert(newsBundle.installPlan.operations.some((op) => op.type === 'insert_text' && op.safety === 'guarded_apply'), 'news plan should guarded-insert post_event_news snippets when router anchor evidence is known');
assert(installPlan.operationSummary(newsBundle.installPlan).guardedApply === 1, 'news plan should count one guarded post_event_news insert');
const noEvidenceNewsBundle = newsDraft.buildExportBundle(readJson(SAMPLE_NEWS), {
  schemaVersion: '0.1',
  project: {name: 'no news router evidence', root: tmpRoot, profileIds: ['generic-dendry']},
  semantic: {news: {items: []}},
  scenes: [],
  variables: []
});
assert(noEvidenceNewsBundle.installPlan.operations.every((op) => op.safety === 'manual_review'), 'news plan without post_event_news evidence should stay manual');
assert(cardBundle.installPlan.operations.some((op) => op.type === 'create_file'), 'card plan should safely create scene file');
assert(!cardBundle.installPlan.operations.some((op) => op.id === 'wire_card_flow'), 'card plan should not create a manual wiring step when a matching tag route already exists');
assert(installPlan.operationSummary(cardBundle.installPlan).manualReview === 0, 'tag-routed card plan should have no manual wiring steps');
assert(surfaceBundle.installPlan.operations.some((op) => op.type === 'replace_text'), 'surface plan should include a safe text replacement operation');
assert(schema.properties.schemaVersion.const === '0.1', 'install-plan schema should describe v0.1');
assert(schema.properties.operations.items.properties.type.enum.includes('insert_text'), 'install-plan schema should allow structured insert_text operations');
assert(schema.properties.operations.items.properties.type.enum.includes('copy_asset_file'), 'install-plan schema should allow asset file install proposals');

const eventAssetBundle = eventDraft.buildExportBundle(Object.assign({}, readJson(SAMPLE_EVENT), {
  id: 'asset_install_event',
  seenFlag: 'asset_install_event_seen',
  assetRefs: [
    {path: 'assets/studio/events/asset_install_event/portrait-hero.png', type: 'image', label: 'Portrait Hero', role: 'event_illustration'}
  ],
  assetInstallRequests: [
    {
      sourceName: 'Portrait Hero.PNG',
      targetPath: 'assets/studio/events/asset_install_event/portrait-hero.png',
      type: 'image',
      label: 'Portrait Hero',
      role: 'event_illustration'
    }
  ]
}), index);
assert(eventAssetBundle.draft.assetInstallRequests[0].targetPath.includes('portrait-hero.png'), 'EventDraft should preserve asset install requests');
assert(eventAssetBundle.installPlan.operations.some((op) => op.type === 'copy_asset_file' && op.safety === 'manual_review'), 'event install plan should surface asset copy proposals as manual review');
assert(installPlan.operationSummary(eventAssetBundle.installPlan).manualReview === 1, 'asset copy proposals should stay manual until desktop copy safety is implemented');
assert(installPlan.renderOperationChecklist(eventAssetBundle.installPlan).includes('copy_asset_file'), 'operation checklist should name asset copy proposals');
assert(installPlan.renderPatchPreview(eventAssetBundle.installPlan).includes('Portrait Hero.PNG'), 'patch preview should explain the selected source asset');

const cardAssetBundle = cardDraft.buildExportBundle(Object.assign({}, readJson(SAMPLE_CARD), {
  id: 'asset_install_card',
  assetRefs: [
    {path: 'assets/studio/cards/asset_install_card/card-art.png', type: 'image', label: 'Card art', role: 'card_image'}
  ],
  assetInstallRequests: [
    {
      sourceName: 'Card Art.PNG',
      targetPath: 'assets/studio/cards/asset_install_card/card-art.png',
      type: 'image',
      label: 'Card art',
      role: 'card_image'
    }
  ]
}), index);
assert(cardAssetBundle.draft.assetInstallRequests[0].role === 'card_image', 'CardDraft should preserve asset install request role metadata');
assert(cardAssetBundle.installPlan.operations.some((op) => op.type === 'copy_asset_file' && op.path === 'assets/studio/cards/asset_install_card/card-art.png'), 'card install plan should include asset copy proposal targets');

const sourceAssetDir = path.join(tmpRoot, '_asset_sources');
fs.mkdirSync(sourceAssetDir, {recursive: true});
const sourceAssetPath = path.join(sourceAssetDir, 'Portrait Hero.PNG');
fs.writeFileSync(sourceAssetPath, Buffer.from('fake image bytes'));
const copyAssetPlan = installPlan.buildInstallPlan({
  id: 'copy_asset_guarded',
  draftKind: 'asset',
  operations: [
    {
      id: 'copy_asset_file_1',
      type: 'copy_asset_file',
      path: 'assets/studio/events/copy_asset_guarded/portrait-hero.png',
      sourceName: 'Portrait Hero.PNG',
      sourcePath: sourceAssetPath,
      assetType: 'image',
      safety: 'guarded_apply'
    }
  ]
});
const copyAssetClassification = installPlan.classifyOperation(copyAssetPlan.operations[0]);
assert(copyAssetClassification.status === 'guarded_apply', 'desktop copy_asset_file with sourcePath should become guarded installable');
const copyAssetDryRun = installPlan.applyInstallPlan(copyAssetPlan, {projectRoot: tmpRoot, dryRun: true});
assert(copyAssetDryRun.ok, 'asset copy dry-run should succeed when source and target are safe: ' + JSON.stringify(copyAssetDryRun));
assert(copyAssetDryRun.results[0].status === 'would_apply', 'asset copy dry-run should report would_apply');
assert(copyAssetDryRun.results[0].sourceHash, 'asset copy dry-run should report a source hash for review');
assert(!fs.existsSync(path.join(tmpRoot, 'assets', 'studio', 'events', 'copy_asset_guarded', 'portrait-hero.png')), 'asset copy dry-run must not write the target file');
const copyAssetApply = installPlan.applyInstallPlan(copyAssetPlan, {projectRoot: tmpRoot, dryRun: false});
assert(copyAssetApply.ok, 'asset copy apply should copy the file after guarded dry-run checks: ' + JSON.stringify(copyAssetApply));
const copiedAssetPath = path.join(tmpRoot, 'assets', 'studio', 'events', 'copy_asset_guarded', 'portrait-hero.png');
assert(fs.readFileSync(copiedAssetPath, 'utf8') === 'fake image bytes', 'asset copy apply should write the selected source bytes to the project target');
const copyAssetAgain = installPlan.applyInstallPlan(copyAssetPlan, {projectRoot: tmpRoot, dryRun: false});
assert(copyAssetAgain.ok, 'reapplying identical asset copy should be idempotent');
assert(copyAssetAgain.results[0].status === 'already_applied', 'identical asset copy should report already_applied');
fs.writeFileSync(copiedAssetPath, 'different bytes', 'utf8');
const copyAssetConflict = installPlan.applyInstallPlan(copyAssetPlan, {projectRoot: tmpRoot, dryRun: true});
assert(!copyAssetConflict.ok, 'asset copy dry-run should block overwrite conflicts');
assert(copyAssetConflict.diagnostics.some((diag) => diag.code === 'install_plan.copy_conflict'), 'asset copy conflict should report copy_conflict diagnostic');

const eventChecklist = installPlan.renderOperationChecklist(eventBundle.installPlan);
assert(eventChecklist.includes('Safe apply'), 'operation checklist should name safe apply operations');
assert(eventChecklist.includes('Guarded install'), 'operation checklist should name guarded install operations');
assert(eventChecklist.includes('source/scenes/events/sample_world_event.scene.dry'), 'operation checklist should include event scene path');
assert(eventChecklist.includes('source/scenes/post_event.scene.dry'), 'operation checklist should include guarded post_event path');

const eventDryRun = installPlan.applyInstallPlan(eventBundle.installPlan, {projectRoot: tmpRoot, dryRun: true});
assert(eventDryRun.ok, 'event dry-run should apply create + guarded inserts: ' + JSON.stringify(eventDryRun));
assert(eventDryRun.operationSummary.safeApply === 1, 'event dry-run should count one safe create operation');
assert(eventDryRun.operationSummary.guardedApply === 2, 'event dry-run should count two guarded insert operations');
const eventApply = installPlan.applyInstallPlan(eventBundle.installPlan, {projectRoot: tmpRoot, dryRun: false});
assert(eventApply.ok, 'event apply should create scene and insert guarded init/migration: ' + JSON.stringify(eventApply));
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'root.scene.dry'), 'utf8').includes('Q.sample_world_event_seen = 0;'), 'event apply should insert root seen flag init');
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'post_event.scene.dry'), 'utf8').includes('Q.sample_world_event_seen === undefined'), 'event apply should insert post_event migration guard');

const newsDryRun = installPlan.applyInstallPlan(newsBundle.installPlan, {projectRoot: tmpRoot, dryRun: true});
assert(newsDryRun.ok, 'news dry-run should accept guarded post_event_news insert: ' + JSON.stringify(newsDryRun));
assert(newsDryRun.operationSummary.guardedApply === 1, 'news dry-run should count one guarded insert');
const newsApply = installPlan.applyInstallPlan(newsBundle.installPlan, {projectRoot: tmpRoot, dryRun: false});
assert(newsApply.ok, 'news apply should insert anchored post_event_news snippet: ' + JSON.stringify(newsApply));
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'post_event_news.scene.dry'), 'utf8').includes('// NewsDraft: sample_dated_news'), 'news apply should insert the generated NewsDraft snippet');

const guardedTextPlan = installPlan.surfaceTextInstallPlan({
  id: 'rewrite_event_body',
  originalLabel: 'Original player-facing paragraph.',
  replacementLabel: 'Rewritten player-facing paragraph.',
  editability: 'draft_extractable',
  source: {path: 'source/scenes/events/event_text.scene.dry', line: 3}
});
const guardedClassification = installPlan.classifyOperation(guardedTextPlan.operations[0]);
assert(guardedClassification.status === 'guarded_apply', 'scene text replacement should be guarded installable');
assert(guardedClassification.level === 2, 'guarded scene text replacement should be Level 2');
const guardedSummary = installPlan.operationSummary(guardedTextPlan);
assert(guardedSummary.guardedApply === 1, 'operation summary should count guarded install operations');
const guardedChecklist = installPlan.renderOperationChecklist(guardedTextPlan);
assert(guardedChecklist.includes('Guarded install'), 'operation checklist should name guarded install operations');
const guardedDryRun = installPlan.applyInstallPlan(guardedTextPlan, {projectRoot: tmpRoot, dryRun: true});
assert(guardedDryRun.ok, 'guarded scene text dry-run should succeed: ' + JSON.stringify(guardedDryRun));
assert(guardedDryRun.results.some((result) => result.status === 'would_apply'), 'guarded dry-run should report would_apply');

const textProposalPlan = installPlan.surfaceTextInstallPlan({
  id: 'rewrite_event_body_proposal',
  originalLabel: 'Original player-facing paragraph.',
  replacementLabel: 'Rewritten player-facing paragraph.',
  editability: 'text_proposal',
  source: {path: 'source/scenes/events/event_text.scene.dry', line: 3, endLine: 3}
});
const textProposalClassification = installPlan.classifyOperation(textProposalPlan.operations[0]);
assert(textProposalClassification.status === 'guarded_apply', 'single-line text_proposal body prose with source evidence should become guarded replace_text');
assert(textProposalPlan.operations[0].type === 'replace_text', 'single-line text_proposal should become a guarded replace_text operation');
assert(textProposalPlan.operations[0].description.includes('Text proposal'), 'text_proposal guarded step should explain proposal-first review');
const textProposalApply = installPlan.applyInstallPlan(textProposalPlan, {projectRoot: tmpRoot, dryRun: false});
assert(textProposalApply.ok, 'text_proposal manual apply should not fail');
assert(textProposalApply.results[0].status === 'applied', 'single-line text_proposal guarded apply should mutate source after matching line evidence');
assert(
  fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'event_text.scene.dry'), 'utf8').includes('Rewritten player-facing paragraph.'),
  'single-line text_proposal guarded apply should replace source text'
);

const multiLineTextProposalPlan = installPlan.surfaceTextInstallPlan({
  id: 'rewrite_multiline_event_body_proposal',
  originalLabel: 'First visible line. Second visible line.',
  replacementLabel: 'Rewritten multi-line paragraph.',
  editability: 'text_proposal',
  source: {path: 'source/scenes/events/event_text.scene.dry', line: 3, endLine: 4}
});
assert(installPlan.classifyOperation(multiLineTextProposalPlan.operations[0]).status === 'manual_review', 'multi-line text_proposal should stay manual until range replacement exists');

const existingSceneEditPlan = installPlan.existingSceneEditInstallPlan({
  id: 'edit_existing_event_text',
  kind: 'existing_scene_edit',
  title: 'Event Text',
  sceneId: 'event_text',
  sceneKind: 'event',
  sourcePath: 'source/scenes/events/event_text.scene.dry',
  changes: [
    {
      fieldId: 'event_text_body',
      role: 'body',
      label: 'Body',
      source: {path: 'source/scenes/events/event_text.scene.dry', line: 3},
      before: 'Rewritten player-facing paragraph.',
      after: 'Rewritten existing paragraph.'
    },
    {
      fieldId: 'event_text_missing_evidence',
      role: 'body',
      label: 'Unsupported body',
      source: {},
      before: 'Missing source evidence.',
      after: 'Manual replacement.'
    }
  ]
}, {project: installPlan.projectProvenanceFromIndex(index)});
assert(existingSceneEditPlan.draftKind === 'existing_scene_edit', 'existing scene edit plan should keep existing_scene_edit draft kind');
assert(existingSceneEditPlan.operations[0].type === 'replace_text', 'source-backed existing scene edits should produce replace_text');
assert(existingSceneEditPlan.operations[0].safety === 'guarded_apply', 'source-backed existing scene edits should be guarded installable');
assert(existingSceneEditPlan.operations[0].description.includes('existing'), 'existing scene edit operation should explain existing-source modification');
assert(existingSceneEditPlan.operations[1].type === 'manual_snippet', 'missing existing scene edit source evidence should become manual review');
assert(installPlan.operationSummary(existingSceneEditPlan).guardedApply === 1, 'existing scene edit summary should count guarded replace operation');
assert(installPlan.operationSummary(existingSceneEditPlan).manualReview === 1, 'existing scene edit summary should count manual unsupported field');
const existingSceneDryRun = installPlan.applyInstallPlan(existingSceneEditPlan, {projectRoot: tmpRoot, dryRun: true});
assert(existingSceneDryRun.ok, 'existing scene edit dry-run should accept guarded replacements and skip manual fields: ' + JSON.stringify(existingSceneDryRun));
assert(existingSceneDryRun.results[0].status === 'would_apply', 'existing scene edit dry-run should report would_apply for guarded change');
const existingSceneApply = installPlan.applyInstallPlan(existingSceneEditPlan, {projectRoot: tmpRoot, dryRun: false});
assert(existingSceneApply.ok, 'existing scene edit apply should replace exact source text: ' + JSON.stringify(existingSceneApply));
assert(
  fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'event_text.scene.dry'), 'utf8').includes('Rewritten existing paragraph.'),
  'existing scene edit apply should modify the existing source file'
);

const protectedExistingSceneEditPlan = installPlan.existingSceneEditInstallPlan({
  id: 'edit_protected_router',
  kind: 'existing_scene_edit',
  sceneId: 'post_event',
  sourcePath: 'source/scenes/post_event.scene.dry',
  changes: [{
    fieldId: 'router_text',
    role: 'body',
    source: {path: 'source/scenes/post_event.scene.dry', line: 1},
    before: 'POST_EVENT_LABEL',
    after: 'POST_EVENT_CHANGED'
  }]
});
assert(protectedExistingSceneEditPlan.operations[0].safety === 'manual_review', 'existing scene edits should not guarded-replace protected routers');

const advancedPlan = installPlan.buildInstallPlan({
  id: 'advanced_router_line',
  draftKind: 'test',
  operations: [
    {
      id: 'advanced_router_line',
      type: 'replace_text',
      path: 'source/scenes/post_event.scene.dry',
      line: 1,
      search: 'POST_EVENT_LABEL',
      replace: 'POST_EVENT_CHANGED',
      safety: 'advanced_apply'
    }
  ]
});
const advancedSummary = installPlan.operationSummary(advancedPlan);
assert(advancedSummary.advancedApply === 1, 'operation summary should count advanced install operations');
const advancedBlocked = installPlan.applyInstallPlan(advancedPlan, {projectRoot: tmpRoot, dryRun: false});
assert(advancedBlocked.ok, 'advanced operation without opt-in should be deferred, not fail');
assert(advancedBlocked.results[0].status === 'advanced_review', 'advanced operation should require explicit opt-in');
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'post_event.scene.dry'), 'utf8').includes('POST_EVENT_LABEL'), 'advanced operation without opt-in must not mutate');
const advancedDryRun = installPlan.applyInstallPlan(advancedPlan, {projectRoot: tmpRoot, dryRun: true, allowAdvanced: true});
assert(advancedDryRun.ok, 'advanced dry-run with opt-in should succeed: ' + JSON.stringify(advancedDryRun));
assert(advancedDryRun.results[0].status === 'would_apply', 'advanced dry-run with opt-in should report would_apply');

const manualPlan = installPlan.buildInstallPlan({
  id: 'manual_only',
  draftKind: 'test',
  operations: [
    {
      id: 'manual',
      type: 'manual_snippet',
      path: 'source/scenes/status.scene.dry',
      content: 'SHOULD_NOT_APPLY\n',
      safety: 'manual_review'
    }
  ]
});
const manualApply = installPlan.applyInstallPlan(manualPlan, {projectRoot: tmpRoot, dryRun: false});
assert(manualApply.ok, 'manual-only apply should not fail: ' + JSON.stringify(manualApply));
assert(manualApply.results[0].status === 'manual_review', 'manual operation should stay manual_review');
assert(!fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8').includes('SHOULD_NOT_APPLY'), 'manual operation must not mutate source');

const unsafePlan = installPlan.buildInstallPlan({
  id: 'unsafe',
  draftKind: 'test',
  operations: [
    {
      id: 'unsafe_html',
      type: 'create_file',
      path: 'out/html',
      content: 'unsafe',
      safety: 'safe_apply'
    }
  ]
});
const unsafeApply = installPlan.applyInstallPlan(unsafePlan, {projectRoot: tmpRoot, dryRun: false});
assert(!unsafeApply.ok, 'out/html safe operation should be refused');
assert(unsafeApply.diagnostics.some((diag) => diag.code === 'install_plan.unsafe_path'), 'unsafe path should produce unsafe_path diagnostic');

[
  ['root', 'source/scenes/root.scene.dry', 'ROOT_LABEL'],
  ['post_event', 'source/scenes/post_event.scene.dry', 'POST_EVENT_LABEL'],
  ['post_event_news', 'source/scenes/post_event_news.scene.dry', 'POST_EVENT_NEWS_LABEL']
].forEach(([label, relPath, marker]) => {
  const adversarialPlan = installPlan.buildInstallPlan({
    id: 'unsafe_' + label,
    draftKind: 'test',
    operations: [
      {
        id: 'unsafe_' + label,
        type: 'replace_text',
        path: relPath,
        search: marker,
        replace: 'MUTATED',
        safety: 'safe_apply'
      }
    ]
  });
  const result = installPlan.applyInstallPlan(adversarialPlan, {projectRoot: tmpRoot, dryRun: false});
  assert(!result.ok, label + ' safe_apply rewrite should be refused');
  assert(result.diagnostics.some((diag) => diag.code === 'install_plan.unsafe_path'), label + ' refusal should use unsafe_path diagnostic');
  assert(fs.readFileSync(path.join(tmpRoot, relPath), 'utf8').includes(marker), label + ' file must remain unchanged');
});

[
  ['out_html_file', 'out/html/file.js'],
  ['out_game', 'out/game.json'],
  ['git_config', '.git/config'],
  ['escape', '../escape.scene.dry'],
  ['absolute', path.join(tmpRoot, 'source', 'scenes', 'status.scene.dry')]
].forEach(([label, relPath]) => {
  const adversarialPlan = installPlan.buildInstallPlan({
    id: 'unsafe_' + label,
    draftKind: 'test',
    operations: [
      {
        id: 'unsafe_' + label,
        type: 'create_file',
        path: relPath,
        content: 'unsafe\n',
        safety: 'safe_apply'
      }
    ]
  });
  const result = installPlan.applyInstallPlan(adversarialPlan, {projectRoot: tmpRoot, dryRun: false});
  assert(!result.ok, label + ' path should be refused');
  assert(result.diagnostics.some((diag) => diag.code === 'install_plan.unsafe_path'), label + ' should produce unsafe_path diagnostic');
});

const staleLinePlan = installPlan.buildInstallPlan({
  id: 'stale_line',
  draftKind: 'test',
  operations: [
    {
      id: 'stale_line',
      type: 'replace_text',
      path: 'source/scenes/status.scene.dry',
      line: 99,
      search: '資源',
      replace: '資金',
      safety: 'safe_apply'
    }
  ]
});
const staleLineResult = installPlan.applyInstallPlan(staleLinePlan, {projectRoot: tmpRoot, dryRun: false});
assert(!staleLineResult.ok, 'stale line evidence should fail instead of falling back to global replacement');
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8').includes('資源'), 'stale line replacement must not mutate status');

const dryRun = installPlan.applyInstallPlan(surfaceBundle.installPlan, {projectRoot: tmpRoot, dryRun: true});
assert(dryRun.ok, 'surface dry-run should succeed: ' + JSON.stringify(dryRun));
assert(dryRun.operationSummary.safeApply === 1, 'surface dry-run summary should count one safe operation');
assert(dryRun.operationSummary.manualReview === 0, 'surface dry-run summary should count no manual operations');
assert(dryRun.results.some((result) => result.status === 'would_apply'), 'surface dry-run should report would_apply');
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8').includes('資源'), 'dry-run must not mutate source');

const wrongRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_install_plan_wrong_project_'));
fs.mkdirSync(path.join(wrongRoot, 'source'), {recursive: true});
fs.writeFileSync(path.join(wrongRoot, 'source', 'info.dry'), 'title: Wrong Fixture\n', 'utf8');
const mismatchApply = installPlan.applyInstallPlan(surfaceBundle.installPlan, {projectRoot: wrongRoot, dryRun: false});
assert(!mismatchApply.ok, 'project provenance mismatch should block install before file operations');
assert(mismatchApply.diagnostics.some((diag) => diag.code === 'install_plan.project_mismatch'), 'project provenance mismatch should report project_mismatch diagnostic');
assert(!fs.existsSync(path.join(wrongRoot, 'source', 'scenes', 'status.scene.dry')), 'project provenance mismatch must not create or mutate target files');
fs.rmSync(wrongRoot, {recursive: true, force: true});

const planFile = path.join(tmpRoot, 'surface.install-plan.json');
fs.writeFileSync(planFile, JSON.stringify(surfaceBundle.installPlan, null, 2) + '\n', 'utf8');
let cliStdout = '';
let cliStderr = '';
const cliStatus = applyInstallPlanCli.runCli(
  ['--plan', planFile, '--root', tmpRoot, '--summary'],
  {
    stdout: {write: (text) => { cliStdout += text; }},
    stderr: {write: (text) => { cliStderr += text; }}
  }
);
assert(cliStatus === 0, 'apply_install_plan dry-run CLI should succeed: ' + cliStderr);
assert(cliStdout.includes('"dryRun": true'), 'apply_install_plan CLI should default to dry-run');
assert(cliStdout.includes('"operationSummary"'), 'apply_install_plan JSON summary should include operation summary');

let humanStdout = '';
let humanStderr = '';
const humanStatus = applyInstallPlanCli.runCli(
  ['--plan', planFile, '--root', tmpRoot],
  {
    stdout: {write: (text) => { humanStdout += text; }},
    stderr: {write: (text) => { humanStderr += text; }}
  }
);
assert(humanStatus === 0, 'apply_install_plan human dry-run CLI should succeed: ' + humanStderr);
assert(humanStdout.includes('safe apply: 1'), 'human CLI summary should count safe apply operations');
assert(humanStdout.includes('manual review: 0'), 'human CLI summary should count manual review operations');

const applied = installPlan.applyInstallPlan(surfaceBundle.installPlan, {projectRoot: tmpRoot, dryRun: false});
assert(applied.ok, 'surface apply should succeed: ' + JSON.stringify(applied));
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8').includes('資金'), 'apply should replace source-backed label');

fs.rmSync(tmpRoot, {recursive: true, force: true});

process.stdout.write(JSON.stringify({
  ok: true,
  eventOps: eventBundle.installPlan.operations.length,
  newsOps: newsBundle.installPlan.operations.length,
  cardOps: cardBundle.installPlan.operations.length,
  surfaceOps: surfaceBundle.installPlan.operations.length
}, null, 2) + '\n');
