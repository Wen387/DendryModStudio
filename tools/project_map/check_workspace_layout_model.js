'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const {pythonCommand} = require('./check_python_command.js');

const ROOT = __dirname;
const REPO_ROOT = path.resolve(ROOT, '..', '..');
const TEMPLATE_ROOT = path.join(ROOT, 'templates', 'starter-demo');
const INDEX_OUT = path.join(os.tmpdir(), 'dendry_workspace_layout_index.json');

const workspaceLayout = require('./authoring/workspace_layout_draft.js');
const installPlan = require('./authoring/install_plan.js');

function buildIndex(root, outPath) {
  const result = spawnSync(pythonCommand(), [
    path.join(ROOT, 'build_project_map.py'),
    '--root',
    root,
    '--out',
    outPath
  ], {cwd: REPO_ROOT, encoding: 'utf8'});
  assert.strictEqual(result.status, 0, 'build_project_map should succeed: ' + result.stderr + result.stdout);
  return JSON.parse(fs.readFileSync(outPath, 'utf8'));
}

function copyTemplate() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_workspace_layout_'));
  const projectRoot = path.join(root, 'starter-demo');
  fs.cpSync(TEMPLATE_ROOT, projectRoot, {recursive: true});
  return projectRoot;
}

const index = buildIndex(TEMPLATE_ROOT, INDEX_OUT);
const model = workspaceLayout.buildLayoutModel(index);

assert(model.hand.exists, 'Starter Demo should expose a hand scene');
assert(model.status.exists, 'Starter Demo should expose a status/sidebar scene');
assert(model.handInsert && model.handInsert.anchorText.includes('@root'), 'Layout model should anchor new deck before the back-to-start route');
assert(model.sidebarInsert && model.sidebarInsert.anchorText === '@politics', 'Layout model should anchor new sidebar category before politics');
assert(model.handInsertChoices.some((choice) => choice.id === '@root'), 'Layout model should expose hand insertion choices');
assert(model.sidebarInsertChoices.some((choice) => choice.id === 'organization'), 'Layout model should expose sidebar insertion choices');

const draft = workspaceLayout.normalizeDraft(Object.assign({}, workspaceLayout.defaultDraft(index), {
  id: 'justice_party_layout',
  title: 'Justice Party workspace layout',
  deckId: 'justice_party_media_deck',
  deckTitle: 'Justice Party Media Deck',
  deckSubtitle: 'Messages and press work',
  deckTag: 'justice_party_media',
  handOptionLabel: 'Open media deck',
  handInsertMode: 'before_root',
  sidebarCategoryId: 'media',
  sidebarHeading: 'Media Desk',
  sidebarBody: 'Track the campaign press lane and public narrative.',
  sidebarStatusLines: '[? if media_attention > 0 : Reporters are watching the Justice Party experiment. ?]',
  sidebarInsertMode: 'before_category',
  sidebarAnchorId: 'politics',
  createStarterCard: true,
  starterCardId: 'justice_party_media_briefing_card',
  starterCardTitle: 'Media Briefing',
  starterCardHeading: 'Shape the campaign narrative',
  starterCardBody: 'The Justice Party office chooses whether to hold a public briefing or reserve capacity for coalition calls.',
  starterCardOption0Label: 'Hold a press briefing',
  starterCardOption0Variable: 'media_attention',
  starterCardOption0Delta: '1',
  starterCardOption1Label: 'Prepare coalition calls',
  starterCardOption1Variable: 'coalition_trust',
  starterCardOption1Delta: '1',
  starterCardReturnTarget: 'main',
  evidence: model
}));

const validation = workspaceLayout.validateDraft(draft, index);
assert(validation.ok, 'Justice Party layout draft should validate: ' + JSON.stringify(validation.diagnostics));

const bundle = workspaceLayout.buildExportBundle(draft, index);
assert(bundle.installPlan.operations.some((op) => op.id === 'create_deck_scene' && op.type === 'create_file'), 'install plan should create a deck scene');
assert(bundle.installPlan.operations.some((op) => op.id === 'create_starter_card' && op.type === 'create_file'), 'install plan should create a starter card scene');
assert(bundle.installPlan.operations.some((op) => op.id === 'hand_deck_route' && op.type === 'insert_text'), 'install plan should insert the hand deck route');
assert(bundle.installPlan.operations.some((op) => op.id === 'sidebar_category' && op.type === 'insert_text'), 'install plan should insert the sidebar category');
assert(bundle.deckScene.includes('is-deck: true'), 'deck scene should render is-deck');
assert(bundle.starterCardScene.includes('tags: justice_party_media'), 'starter card should use the deck tag');
assert(bundle.starterCardScene.includes('Q.media_attention = (Q.media_attention || 0) + 1;'), 'starter card should render the first effect');
assert(bundle.sidebarCategory.includes('@media'), 'sidebar category should render section anchor');
assert(bundle.patchPreview.includes('source/scenes/decks/justice_party_media_deck.scene.dry'), 'patch preview should include deck path');
assert(bundle.patchPreview.includes('source/scenes/cards/justice_party_media_briefing_card.scene.dry'), 'patch preview should include starter card path');

const afterCategoryPlan = workspaceLayout.buildInstallPlan(Object.assign({}, draft, {
  sidebarInsertMode: 'after_category',
  sidebarAnchorId: 'organization'
}), index);
const afterCategoryOp = afterCategoryPlan.operations.find((op) => op.id === 'sidebar_category');
assert(afterCategoryOp && afterCategoryOp.anchorText === '@cards' && afterCategoryOp.position === 'before', 'after-category insertion should use the next exact section anchor');

const projectRoot = copyTemplate();
const tempIndex = buildIndex(projectRoot, path.join(os.tmpdir(), 'dendry_workspace_layout_apply_index.json'));
const tempDraft = Object.assign({}, draft, {evidence: workspaceLayout.buildLayoutModel(tempIndex)});
const tempBundle = workspaceLayout.buildExportBundle(tempDraft, tempIndex);
const dryRun = installPlan.applyInstallPlan(tempBundle.installPlan, {projectRoot, dryRun: true});
assert(dryRun.ok, 'dry-run should pass: ' + JSON.stringify(dryRun.diagnostics));
assert(dryRun.results.some((row) => row.id === 'create_deck_scene' && row.status === 'would_apply'), 'dry-run should create deck');
assert(dryRun.results.some((row) => row.id === 'create_starter_card' && row.status === 'would_apply'), 'dry-run should create starter card');
assert(dryRun.results.some((row) => row.id === 'hand_deck_route' && row.status === 'would_apply'), 'dry-run should insert hand route');
assert(dryRun.results.some((row) => row.id === 'sidebar_category' && row.status === 'would_apply'), 'dry-run should insert sidebar category');

const applied = installPlan.applyInstallPlan(tempBundle.installPlan, {projectRoot, dryRun: false});
assert(applied.ok, 'apply should pass: ' + JSON.stringify(applied.diagnostics));
const deckPath = path.join(projectRoot, 'source', 'scenes', 'decks', 'justice_party_media_deck.scene.dry');
const starterCardPath = path.join(projectRoot, 'source', 'scenes', 'cards', 'justice_party_media_briefing_card.scene.dry');
assert(fs.existsSync(deckPath), 'apply should create deck scene');
assert(fs.existsSync(starterCardPath), 'apply should create starter card scene');
assert(fs.readFileSync(deckPath, 'utf8').includes('- #justice_party_media'), 'deck should route its tag');
assert(fs.readFileSync(starterCardPath, 'utf8').includes('Media Briefing'), 'starter card should include title text');
assert(fs.readFileSync(path.join(projectRoot, 'source', 'scenes', 'main.scene.dry'), 'utf8').includes('- @justice_party_media_deck: Open media deck'), 'hand should include the new deck route');
assert(fs.readFileSync(path.join(projectRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8').includes('@media'), 'status should include the new category');

const duplicate = workspaceLayout.validateDraft(Object.assign({}, draft, {deckId: 'demo_action_deck'}), index);
assert(!duplicate.ok, 'duplicate deck id should fail validation');

console.log(JSON.stringify({
  ok: true,
  operations: bundle.installPlan.operations.length,
  deckPath: 'source/scenes/decks/justice_party_media_deck.scene.dry',
  sidebarCategory: 'media'
}, null, 2));
