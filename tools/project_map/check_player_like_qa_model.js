#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const REPO = path.resolve(ROOT, '..', '..');
const RUNNER = path.join(ROOT, 'qa', 'run_desktop_scenario.js');
const README = path.join(ROOT, 'qa', 'README.md');
const DESKTOP_MIXED_APPLY_FLOW = path.join(ROOT, 'qa', 'desktop_mixed_apply_flow.js');
const QA_FIXTURE = path.join(ROOT, 'fixtures', 'qa-mini');
const SCENARIO_DIR = path.join(ROOT, 'qa', 'scenarios');

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

[
  RUNNER,
  README,
  DESKTOP_MIXED_APPLY_FLOW,
  path.join(SCENARIO_DIR, 'first_time_user.md'),
  path.join(SCENARIO_DIR, 'explore_design_existing_edit.md'),
  path.join(SCENARIO_DIR, 'content_storyboard_canvas_selection.md'),
  path.join(SCENARIO_DIR, 'draft_persistence_restart.md'),
  path.join(SCENARIO_DIR, 'load_bundled_demo_template.md'),
  path.join(SCENARIO_DIR, 'justice_party_template_mod.md'),
  path.join(SCENARIO_DIR, 'runtime_preview_entry_flow.md'),
  path.join(SCENARIO_DIR, 'dynamic_mod_smoke.md'),
  path.join(QA_FIXTURE, 'source', 'info.dry'),
  path.join(QA_FIXTURE, 'source', 'scenes', 'root.scene.dry'),
  path.join(QA_FIXTURE, 'source', 'scenes', 'generic_intro.scene.dry'),
  path.join(QA_FIXTURE, 'source', 'scenes', 'post_event.scene.dry')
].forEach((filePath) => {
  assert(fs.existsSync(filePath), 'expected QA file: ' + path.relative(REPO, filePath));
});

const runner = read(RUNNER);
const readme = read(README);
const desktopMixedApplyFlow = read(DESKTOP_MIXED_APPLY_FLOW);
const existingScenarioCard = read(path.join(SCENARIO_DIR, 'explore_design_existing_edit.md'));
const storyboardSelectionScenarioCard = read(path.join(SCENARIO_DIR, 'content_storyboard_canvas_selection.md'));
const persistenceScenarioCard = read(path.join(SCENARIO_DIR, 'draft_persistence_restart.md'));
const demoScenarioCard = read(path.join(SCENARIO_DIR, 'load_bundled_demo_template.md'));
const justicePartyScenarioCard = read(path.join(SCENARIO_DIR, 'justice_party_template_mod.md'));
const runtimePreviewScenarioCard = read(path.join(SCENARIO_DIR, 'runtime_preview_entry_flow.md'));
const dynamicSmokeScenarioCard = read(path.join(SCENARIO_DIR, 'dynamic_mod_smoke.md'));
const rootScene = read(path.join(QA_FIXTURE, 'source', 'scenes', 'root.scene.dry'));
const postEvent = read(path.join(QA_FIXTURE, 'source', 'scenes', 'post_event.scene.dry'));

[
  'BrowserWindow',
  'capturePage',
  'QA_LEDGER.md',
  'transcript.json',
  'first_time_user',
  'explore_design_existing_edit',
  'desktop_mixed_apply_flow',
  'content_storyboard_canvas_selection',
  'draft_persistence_restart',
  'load_bundled_demo_template',
  'justice_party_template_mod',
  'runtime_preview_entry_flow',
  'dynamic_mod_smoke',
  'complex_event_authoring_flow',
  'event_graph_click_edit_flow',
  'asset_picker_copy_review_flow',
  'variable_create_from_event_flow',
  'unknown_profile_router_rule_flow',
  'Runtime preview support is visible',
  'waitForGameText',
  'demo_support',
  'justice_party_ticker_news',
  'justice_party_play_surface',
  'justice_party_workspace_layout',
  'justice_party_sidebar_status',
  'justice_party_party_affairs_card',
  'justice_party_labor_advisor',
  'Entry & Sidebar',
  'Playable Surface',
  'Workspace Layout',
  'Sidebar / Status',
  'Card Wizard',
  'entry_sidebar',
  'data-create-template="play_surface"',
  'data-create-template="workspace_layout"',
  'data-create-template="sidebar_status"',
  'entry-create-first-event',
  'waitForEntryOutput',
  'waitForPlaySurfaceOutput',
  'waitForWorkspaceLayoutOutput',
  'waitForSidebarStatusOutput',
  'waitForCardOutput',
  'fillJusticePlaySurface',
  'fillJusticeWorkspaceLayout',
  'fillJusticeSidebarStatus',
  'post_event_news',
  'ProjectMapInstallAssistant',
  'desktopMixedApplyFlow.definition',
  'data-design-edit-existing',
  'data-editing-workspace',
  'data-object-authoring-canvas',
  'dispatchStoryboardPointerClick',
  'data-object-editing-modal',
  'data-object-editing-modal-preview-pane',
  'reloadStudioWindow',
  'dendry:open-starter-demo',
  'dendry:update-notice-check',
  'guided_ui_qa_offline',
  'Civic Reform Office Briefing',
  'qa_persistent_event',
  'install_plan.project_mismatch',
  'openProjectViaDialog',
  'deterministic test dialog adapter for native folder selection',
  'replace_section'
].forEach((needle) => {
  assert(runner.includes(needle), 'runner should include ' + needle);
});

[
  'Guided UI QA',
  'first_time_user',
  'explore_design_existing_edit',
  'desktop_mixed_apply_flow',
  'content_storyboard_canvas_selection',
  'draft_persistence_restart',
  'load_bundled_demo_template',
  'justice_party_template_mod',
  'runtime_preview_entry_flow',
  'Playable Surface',
  'Workspace Layout',
  'project_mismatch',
  'post-apply verification',
  'test dialog adapter',
  'Do not treat these runs as full manual QA'
].forEach((needle) => {
  assert(readme.includes(needle), 'QA README should mention ' + needle);
});

[
  'Desktop bridge dry-runs, applies, and verifies mixed create/replace/copy operations',
  'copy_selected_asset',
  'create_mixed_scene',
  'replace_intro_paragraph',
  'post-apply verify',
  'already_applied',
  'local-art.png'
].forEach((needle) => {
  assert(desktopMixedApplyFlow.includes(needle), 'desktop mixed apply flow should include ' + needle);
});

assert(rootScene.includes('// ====== U. EVENT SEEN FLAGS ======'), 'QA fixture root should include event seen flag anchor');
assert(rootScene.includes('Q.generic_score = 0;'), 'QA fixture should initialize generic_score');
assert(postEvent.includes('// Save compatibility: post_event split (post_event_news)'), 'QA fixture post_event should include migration anchor');

assert(
  runner.includes("'--list'") && runner.includes('listScenarios'),
  'runner should expose a --list scenario inventory'
);
assert(
  runner.includes('switches project through the Open Project button and confirms wrong-project refusal'),
  'first_time_user should include wrong-project refusal'
);
assert(
  runner.includes('explore_design_existing_edit') && runner.includes("draftKind === 'existing_scene_edit'"),
  'runner should include existing scene edit scenario and assert the install-plan kind'
);
assert(
  runner.includes('draft_persistence_restart') && runner.includes("state.plan && state.plan.id === 'qa_persistent_event'"),
  'runner should include draft persistence restart scenario and assert the persisted install-plan id'
);
assert(
  runner.includes('load_bundled_demo_template') && runner.includes('Dendry Mod Studio Starter Demo'),
  'runner should include bundled starter demo scenario and assert the loaded project name'
);
assert(
  existingScenarioCard.includes('Persona:') &&
    existingScenarioCard.includes('Required checkpoints:') &&
    existingScenarioCard.includes('Allowed shortcut:') &&
    existingScenarioCard.includes('Object Authoring Canvas') &&
    existingScenarioCard.includes('context board') &&
    existingScenarioCard.includes('focused object editor') &&
    existingScenarioCard.includes('live preview'),
  'existing edit scenario card should be written as a unified object authoring journey'
);
assert(
  storyboardSelectionScenarioCard.includes('Persona:') &&
    storyboardSelectionScenarioCard.includes('Required checkpoints:') &&
    storyboardSelectionScenarioCard.includes('Allowed shortcut:') &&
    storyboardSelectionScenarioCard.includes('Content Storyboard Canvas') &&
    storyboardSelectionScenarioCard.includes('source-backed `event:*` Storyboard card') &&
    storyboardSelectionScenarioCard.includes('visible object editor modal'),
  'Content Storyboard Canvas selection scenario card should cover click-to-editor behavior'
);
assert(
  persistenceScenarioCard.includes('Persona:') && persistenceScenarioCard.includes('Required checkpoints:') && persistenceScenarioCard.includes('Allowed shortcut:'),
  'draft persistence scenario card should be written as a player journey'
);
assert(
  demoScenarioCard.includes('Persona:') && demoScenarioCard.includes('Required checkpoints:') && demoScenarioCard.includes('Allowed shortcut:'),
  'bundled demo scenario card should be written as a player journey'
);
assert(
  justicePartyScenarioCard.includes('Persona:') &&
    justicePartyScenarioCard.includes('Required checkpoints:') &&
    justicePartyScenarioCard.includes('Entry & Sidebar') &&
    justicePartyScenarioCard.includes('Playable Surface') &&
    justicePartyScenarioCard.includes('Workspace Layout') &&
    justicePartyScenarioCard.includes('Sidebar / Status') &&
    justicePartyScenarioCard.includes('Card Wizard') &&
    justicePartyScenarioCard.includes('media deck') &&
    justicePartyScenarioCard.includes('briefing card') &&
    justicePartyScenarioCard.includes('party-affairs workspace') &&
    justicePartyScenarioCard.includes('party-affairs') &&
    justicePartyScenarioCard.includes('labor advisor') &&
    justicePartyScenarioCard.includes('Variable recommendation') &&
    justicePartyScenarioCard.includes('two news systems'),
  'Justice Party scenario card should cover card/advisor drafts, variable recommendations, and both news systems'
);
assert(
  runtimePreviewScenarioCard.includes('Persona:') &&
    runtimePreviewScenarioCard.includes('Required checkpoints:') &&
    runtimePreviewScenarioCard.includes('Runtime Preview') &&
    runtimePreviewScenarioCard.includes('Runtime preview support is visible'),
  'Runtime Preview scenario card should cover first route click and sidebar/status change'
);
assert(
  runner.includes('dynamic_mod_smoke') &&
    runner.includes('--dynamic-project-root') &&
    runner.includes('existing_scene_edit') &&
    runner.includes('unsafe_path'),
  'runner should include Dynamic Mod smoke scenario with Dynamic root, existing edit, and card path refusal coverage'
);
assert(
  dynamicSmokeScenarioCard.includes('Persona:') &&
    dynamicSmokeScenarioCard.includes('Required checkpoints:') &&
    dynamicSmokeScenarioCard.includes('All Quiet on the Western Front') &&
    dynamicSmokeScenarioCard.includes('Dynamic `party_affairs` Card') &&
    dynamicSmokeScenarioCard.includes('unsafe_path'),
  'Dynamic Mod scenario card should cover real Dynamic existing event and card path safety'
);

process.stdout.write(JSON.stringify({
  ok: true,
  scenarioCount: 14,
  runner: path.relative(REPO, RUNNER)
}, null, 2) + '\n');
