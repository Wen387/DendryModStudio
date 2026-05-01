#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const REPO = path.resolve(ROOT, '..', '..');
const STUDIO_VERSION = '0.9.2';
const STUDIO_VERSION_LABEL = 'Dendry Mod Studio v0.9.2 dev preview';

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(REPO, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(REPO, relativePath));
}

[
  'tools/project_map/check_onboarding_model.js',
  'tools/project_map/check_localization_surface.js',
  'tools/project_map/check_studio_surface.js',
  'tools/project_map/check_studio_handoff.js',
  'tools/project_map/check_draft_workspace_model.js',
  'tools/project_map/check_install_plan_model.js',
  'tools/project_map/check_install_refresh_model.js',
  'tools/project_map/check_runtime_preview_sandbox_model.js',
  'tools/project_map/check_runtime_preview_debug_model.js',
  'tools/project_map/check_runtime_preview_debug_bridge.js',
  'tools/project_map/check_sdaah_install_write_smoke.js',
  'tools/project_map/check_variable_suggestions_model.js',
  'tools/project_map/check_v067_remaining_model.js',
  'tools/project_map/check_desktop_shell.js',
  'tools/project_map/check_desktop_packaging.js',
  'tools/project_map/check_desktop_deb.js',
  'tools/project_map/check_update_notice_model.js',
  'tools/project_map/check_starter_demo_model.js',
  'tools/project_map/check_player_like_qa_model.js',
  'tools/project_map/check_public_export.js',
  'tools/project_map/scripts/export_studio_repo.js',
  'tools/check_studio_contract.js',
  'studio_contract/README.md',
  'studio_contract/CHANGE_POLICY.md',
  'studio_contract/contract.json',
  'studio_contract/contract.schema.json',
  'studio_contract/parser_fixture/source/info.dry',
  'studio_contract/parser_fixture/source/scenes/root.scene.dry',
  'studio_contract/parser_fixture/source/scenes/post_event.scene.dry',
  'studio_contract/parser_fixture/source/scenes/post_event_news.scene.dry',
  'tools/project_map/RELEASE_NOTES_v0.9.2.md',
  'tools/project_map/qa/run_desktop_scenario.js',
  'tools/project_map/qa/README.md',
  'tools/project_map/qa/scenarios/first_time_user.md',
  'tools/project_map/qa/scenarios/explore_design_existing_edit.md',
  'tools/project_map/qa/scenarios/draft_persistence_restart.md',
  'tools/project_map/qa/scenarios/load_bundled_demo_template.md',
  'tools/project_map/templates/starter-demo/package.json',
  'tools/project_map/templates/starter-demo/source/info.dry',
  'tools/project_map/templates/starter-demo/source/scenes/root.scene.dry',
  'tools/project_map/templates/starter-demo/source/scenes/demo_opening.scene.dry',
  'tools/project_map/templates/starter-demo/source/scenes/post_event.scene.dry',
  'tools/project_map/desktop/update_notice.js',
  'tools/project_map/desktop/update_manifest.json',
  'tools/project_map/viewer/onboarding_ui.js',
  'tools/project_map/viewer/update_notice_ui.js',
  'tools/project_map/viewer/i18n.js',
  'tools/project_map/authoring/variable_suggestions.js',
  'tools/project_map/authoring/studio_contracts.js',
  'tools/project_map/desktop/runtime_preview.js',
  'tools/project_map/desktop/runtime_preview_debug_bridge.js'
].forEach((relativePath) => {
  assert(exists(relativePath), 'release gate expected file: ' + relativePath);
});

const workflow = read('tools/project_map/WORKFLOW.md');
const handover = read('HANDOVER.md');
const sessionLog = read('SESSION_LOG.md');
const readme = read('tools/project_map/README.md');
const releaseNotes = read('tools/project_map/RELEASE_NOTES_v0.9.2.md');
const html = read('tools/project_map/viewer/index.html');
const i18n = read('tools/project_map/viewer/i18n.js');
const contracts = read('tools/project_map/authoring/studio_contracts.js');
const installPlan = read('tools/project_map/authoring/install_plan.js');
const applyInstallPlan = read('tools/project_map/apply_install_plan.js');
const localizationCheck = read('tools/project_map/check_localization_surface.js');
const installPlanSchema = read('tools/project_map/schema/install-plan.schema.json');
const packagingNotes = read('tools/project_map/desktop/PACKAGING_NOTES.md');
const packageJson = JSON.parse(read('tools/project_map/desktop/package.json'));
const packageLock = JSON.parse(read('tools/project_map/desktop/package-lock.json'));
const studioContract = JSON.parse(read('studio_contract/contract.json'));
const studioContractSchema = JSON.parse(read('studio_contract/contract.schema.json'));

[
  ['Release Readiness Gate', workflow],
  ['Full gate', workflow],
  ['desktop smoke', workflow],
  ['package:deb', workflow],
  ['check_sdaah_install_write_smoke.js', workflow],
  ['RELEASE_NOTES_v0.9.2.md', workflow],
  ['ProjectMapVariableSuggestions', workflow],
  ['Runtime Preview Sandbox', workflow],
  ['Runtime Preview Debug Console', workflow],
  ['check_runtime_preview_sandbox_model.js', readme],
  ['check_runtime_preview_debug_model.js', readme],
  ['check_starter_demo_model.js', readme],
  ['check_update_notice_model.js', readme],
  ['check_player_like_qa_model.js', readme],
  ['check_public_export.js', readme],
  ['export_studio_repo.js', readme],
  ['.github/workflows/ci.yml', readme],
  ['qa/run_desktop_scenario.js --scenario first_time_user', readme],
  ['qa/run_desktop_scenario.js --scenario explore_design_existing_edit', readme],
  ['qa/run_desktop_scenario.js --scenario draft_persistence_restart', readme],
  ['qa/run_desktop_scenario.js --scenario load_bundled_demo_template', readme],
  ['DMS_SDAAH_FIXTURE_ROOT', readme],
  ['SDAAH install-write smoke', handover],
  ['privacy `.gitignore`', workflow],
  ['Clean public Studio export', workflow],
  ['check_public_export.js', workflow],
  ['export_studio_repo.js', workflow],
  ['npm run check:ci', workflow],
  ['Quick Start', readme],
  ['RELEASE_NOTES_v0.9.2.md', readme],
  ['Player-like QA MVP', workflow],
  ['explore_design_existing_edit', workflow],
  ['draft_persistence_restart', workflow],
  ['load_bundled_demo_template', workflow],
  ['Starter Demo', workflow],
  ['Update Notice MVP', workflow],
  ['update_manifest.json', workflow],
  ['node tools/check_studio_contract.js', workflow],
  ['studio_contract/', readme],
  ['node tools/check_studio_contract.js', readme],
  ['Studio compatibility contract', handover],
  ['IslandSunrise / Studio compatibility contract MVP', sessionLog],
  ['deterministic QA dialog shim', workflow],
  ['未打包狀態', sessionLog],
  ['發佈前', sessionLog],
  ['First-run onboarding 已落地', handover],
  ['更新公告 MVP', handover]
].forEach(([needle, source]) => {
  assert(source.includes(needle), 'release docs should mention ' + needle);
});

[
  ['version title', 'Dendry Mod Studio v0.9.2 Dev Preview Notes'],
  ['developer preview boundary', 'signed public release'],
  ['artifact path', 'DendryModStudio-linux-x64.tar.gz'],
  ['deb artifact path', 'dendry-mod-studio_0.9.2_amd64.deb'],
  ['manual QA boundary', 'Public release QA is not complete'],
  ['Python requirement', 'Python 3 is still a system requirement'],
  ['runtime preview boundary', 'Runtime Preview does not build or patch the real project folder'],
  ['update notice boundary', 'Update Notice MVP'],
  ['provenance guard', 'project provenance'],
  ['known limits', 'Known Limits'],
  ['minimum manual path', 'minimum manual path']
].forEach(([label, needle]) => {
  assert(releaseNotes.includes(needle), 'release notes missing ' + label);
});
[
  ['player-like existing edit scenario', 'explore_design_existing_edit'],
  ['player-like draft persistence scenario', 'draft_persistence_restart'],
  ['player-like bundled demo scenario', 'load_bundled_demo_template'],
  ['bundled starter demo', 'Demo Template'],
  ['player-like draft persistence boundary', 'persisted install plan'],
  ['player-like dialog shim', 'QA dialog shim']
].forEach(([label, needle]) => {
  assert(releaseNotes.includes(needle), 'release notes missing ' + label);
});

[
  ['viewer fallback topbar', html],
  ['i18n topbar label', i18n]
].forEach(([label, source]) => {
  assert(source.includes(STUDIO_VERSION_LABEL), label + ' should expose ' + STUDIO_VERSION_LABEL);
});
assert(packageJson.version === STUDIO_VERSION, 'desktop package version should be ' + STUDIO_VERSION);
assert(
  packageJson.dendryModStudio && /update_manifest\.json$/.test(packageJson.dendryModStudio.updateManifestUrl || ''),
  'desktop package should configure update manifest URL'
);
assert(packageLock.version === STUDIO_VERSION, 'desktop package lock version should be ' + STUDIO_VERSION);
assert(
  packageLock.packages && packageLock.packages[''] && packageLock.packages[''].version === STUDIO_VERSION,
  'desktop package lock root package version should be ' + STUDIO_VERSION
);
assert(packagingNotes.includes('v' + STUDIO_VERSION), 'packaging notes should mention v' + STUDIO_VERSION);
assert(handover.includes('v' + STUDIO_VERSION), 'handover should mention v' + STUDIO_VERSION);
assert(workflow.includes('v' + STUDIO_VERSION), 'workflow should mention v' + STUDIO_VERSION);
assert(studioContract.schemaVersion === 1, 'Studio contract schemaVersion should be 1');
assert(studioContract.profileId === 'islands-sunrise', 'Studio contract should target islands-sunrise profile');
assert(
  Array.isArray(studioContract.profileChain) &&
    studioContract.profileChain.join(',') === 'generic-dendry,sdaah-style,islands-sunrise',
  'Studio contract should preserve the profile chain'
);
assert(
  studioContract.parserFixtureExpectations &&
    Array.isArray(studioContract.parserFixtureExpectations.profileIds) &&
    studioContract.parserFixtureExpectations.profileIds.join(',') === 'generic-dendry,sdaah-style,islands-sunrise',
  'Studio contract parser fixture should expect the profile chain'
);
assert(
  studioContractSchema.additionalProperties === false &&
    Array.isArray(studioContractSchema.required) &&
    studioContractSchema.required.includes('profileChain') &&
    studioContractSchema.required.includes('parserFixtureExpectations'),
  'Studio contract schema should lock required top-level fields'
);

[
  ['Quick Start menu', 'id="studio-open-onboarding"'],
  ['Quick Start dialog', 'id="studio-onboarding"'],
  ['Quick Start bundled demo', 'id="onboarding-load-demo"'],
  ['Update Notice banner', 'id="update-notice-banner"'],
  ['Check updates menu item', 'id="studio-check-updates"'],
  ['Onboarding script', 'onboarding_ui.js'],
  ['Update Notice script', 'update_notice_ui.js'],
  ['My Changes panel', 'draft-workspace-panel'],
  ['Review & Apply mode', 'id="install-pane"'],
  ['Design mode', 'id="design-pane"'],
  ['Event Workbench UI', 'event_workbench_ui.js'],
  ['Localization UI', 'i18n.js']
].forEach(([label, snippet]) => {
  assert(html.includes(snippet), 'viewer release surface missing ' + label);
});

[
  'topbar.quickStart',
  'topbar.checkUpdates',
  'updateNotice.download',
  'onboarding.title',
  'onboarding.loadDemo',
  'draftWorkspace.title',
  'install.reviewPlan',
  'eventWorkbench.eyebrow',
  'create.eventWizard',
  'create.newsWizard',
  'create.cardWizard',
  'create.textProposalWizard'
].forEach((key) => {
  assert(i18n.includes("'" + key + "'"), 'release localization missing key ' + key);
});

[
  'onboardingSeen',
  'openOnboarding',
  'draftWorkspace',
  'browserReviewOnlyMessage'
].forEach((needle) => {
  assert(contracts.includes(needle), 'Studio contracts missing release contract ' + needle);
});

[
  'projectProvenanceFromIndex',
  'validateProjectProvenance'
].forEach((needle) => {
  assert(installPlan.includes(needle), 'install plan module missing release guard ' + needle);
});

[
  'safe_apply',
  'guarded_apply',
  'advanced_apply',
  'manual_review',
  'refused',
  'project_mismatch',
  'out/html',
  'out/game.json',
  '.git'
].forEach((needle) => {
  assert(installPlan.includes(needle), 'install plan safety surface missing ' + needle);
});
assert(applyInstallPlan.includes('allowAdvanced'), 'apply CLI should preserve explicit advanced opt-in');
assert(applyInstallPlan.includes('dryRun'), 'apply CLI should preserve dry-run default path');
assert(installPlanSchema.includes('"project"'), 'install-plan schema should document optional project provenance');

['start', 'package:dir', 'package:portable', 'package:deb', 'smoke', 'doctor'].forEach((scriptName) => {
  assert(packageJson.scripts && packageJson.scripts[scriptName], 'desktop package.json missing script ' + scriptName);
});

assert(localizationCheck.includes('data-i18n'), 'localization check should cover static data-i18n attributes');
assert(localizationCheck.includes('extractConcreteTKeys'), 'localization check should cover literal t() calls');

process.stdout.write(JSON.stringify({
  ok: true,
  releaseGate: [
    'Run targeted model and UI smoke checks.',
    'Run full regression/build validate before packaging.',
    'Run desktop smoke and doctor in the target packaging environment.',
    'Build or verify fresh portable/.deb package artifacts for the current workspace.',
    'Publish or attach the v0.9.2 dev preview notes with known limits.',
    'Run the player-like QA scenarios and attach their QA ledgers.',
    'Do manual browser/desktop QA for Quick Start, My Changes, Review & Apply, and install dry-run/apply boundaries.'
  ],
  packageVersion: packageJson.version
}, null, 2) + '\n');
