#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const REPO = path.resolve(ROOT, '..', '..');
const RUNNER = path.join(ROOT, 'qa', 'run_desktop_scenario.js');
const README = path.join(ROOT, 'qa', 'README.md');
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
  path.join(SCENARIO_DIR, 'first_time_user.md'),
  path.join(SCENARIO_DIR, 'explore_design_existing_edit.md'),
  path.join(SCENARIO_DIR, 'draft_persistence_restart.md'),
  path.join(SCENARIO_DIR, 'load_bundled_demo_template.md'),
  path.join(QA_FIXTURE, 'source', 'info.dry'),
  path.join(QA_FIXTURE, 'source', 'scenes', 'root.scene.dry'),
  path.join(QA_FIXTURE, 'source', 'scenes', 'generic_intro.scene.dry'),
  path.join(QA_FIXTURE, 'source', 'scenes', 'post_event.scene.dry')
].forEach((filePath) => {
  assert(fs.existsSync(filePath), 'expected QA file: ' + path.relative(REPO, filePath));
});

const runner = read(RUNNER);
const readme = read(README);
const existingScenarioCard = read(path.join(SCENARIO_DIR, 'explore_design_existing_edit.md'));
const persistenceScenarioCard = read(path.join(SCENARIO_DIR, 'draft_persistence_restart.md'));
const demoScenarioCard = read(path.join(SCENARIO_DIR, 'load_bundled_demo_template.md'));
const rootScene = read(path.join(QA_FIXTURE, 'source', 'scenes', 'root.scene.dry'));
const postEvent = read(path.join(QA_FIXTURE, 'source', 'scenes', 'post_event.scene.dry'));

[
  'BrowserWindow',
  'capturePage',
  'QA_LEDGER.md',
  'transcript.json',
  'first_time_user',
  'explore_design_existing_edit',
  'draft_persistence_restart',
  'load_bundled_demo_template',
  'ProjectMapInstallAssistant',
  'data-design-edit-existing',
  'reloadStudioWindow',
  'dendry:open-starter-demo',
  'A Small Campaign Office',
  'qa_persistent_event',
  'install_plan.project_mismatch',
  'openProjectViaDialog',
  'deterministic test dialog adapter for native folder selection',
  'Replace existing Body'
].forEach((needle) => {
  assert(runner.includes(needle), 'runner should include ' + needle);
});

[
  'Guided UI QA',
  'first_time_user',
  'explore_design_existing_edit',
  'draft_persistence_restart',
  'load_bundled_demo_template',
  'project_mismatch',
  'test dialog adapter',
  'Do not treat these runs as full manual QA'
].forEach((needle) => {
  assert(readme.includes(needle), 'QA README should mention ' + needle);
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
  existingScenarioCard.includes('Persona:') && existingScenarioCard.includes('Required checkpoints:') && existingScenarioCard.includes('Allowed shortcut:'),
  'existing edit scenario card should be written as a player journey'
);
assert(
  persistenceScenarioCard.includes('Persona:') && persistenceScenarioCard.includes('Required checkpoints:') && persistenceScenarioCard.includes('Allowed shortcut:'),
  'draft persistence scenario card should be written as a player journey'
);
assert(
  demoScenarioCard.includes('Persona:') && demoScenarioCard.includes('Required checkpoints:') && demoScenarioCard.includes('Allowed shortcut:'),
  'bundled demo scenario card should be written as a player journey'
);

process.stdout.write(JSON.stringify({
  ok: true,
  scenarioCount: 4,
  runner: path.relative(REPO, RUNNER)
}, null, 2) + '\n');
