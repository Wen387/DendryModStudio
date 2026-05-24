#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const appModel = require('./viewer/app.js');
const cardDraft = require('./authoring/card_draft.js');
const installPlan = require('./authoring/install_plan.js');
const contracts = require('./authoring/studio_shared_constants.js');
const desktopCore = require('./desktop/studio_core.js');

const ROOT = __dirname;

const {fail, assert} = require('./check_harness.js');

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function syntheticIndex(root) {
  return {
    schemaVersion: '0.1',
    project: {name: 'v067 fixture', root, profileIds: ['generic-dendry']},
    profiles: [{id: 'generic-dendry', uiLabels: {advisorLikeSingular: 'Advisor', advisorLikePlural: 'Advisors'}}],
    scenes: [
      {id: 'main', title: 'Next month', path: 'source/scenes/main.scene.dry', type: 'hand'},
      {id: 'resources_status', title: 'Status', path: 'source/scenes/status.scene.dry'}
    ],
    edges: [],
    variables: [
      {name: 'resources'},
      {name: 'media_reach'},
      {name: 'community_circle_strength'},
      {name: 'advisor_action_timer'}
    ],
    semantic: {
      events: [{id: 'existing_event'}],
      cards: [{id: 'existing_card'}],
      hands: [{id: 'main', path: 'source/scenes/main.scene.dry', title: 'Next month', type: 'hand', confidence: 'exact'}],
      decks: [],
      pinnedCards: [{id: 'community_circle', path: 'source/scenes/circles/community_circle.scene.dry'}],
      news: {items: [{headline: 'Existing headline'}]},
      surfaceText: {
        items: [
          {id: 'status_resources', label: '資源', editability: 'draft_exportable', source: {path: 'source/scenes/status.scene.dry', line: 1}},
          {id: 'html_resources', label: '資源', editability: 'ide_escape_hatch', source: {path: 'out/html/sidebar-ui.js', line: 2}}
        ]
      }
    },
    diagnostics: [],
    summary: {sceneCount: 2, eventCount: 1, cardCount: 1, newsItemCount: 1, surfaceTextCount: 2}
  };
}

function fixtureProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_v067_remaining_fixture_'));
  fs.mkdirSync(path.join(root, 'source', 'scenes'), {recursive: true});
  fs.writeFileSync(path.join(root, 'source', 'info.dry'), 'title: Fixture\n', 'utf8');
  fs.writeFileSync(path.join(root, 'source', 'scenes', 'status.scene.dry'), '= 資源\n', 'utf8');
  return root;
}

const viewerHtml = read('viewer/index.html');
const viewerApp = read('viewer/app.js');
const installUi = read('viewer/install_assistant_ui.js');
const desktopMain = read('desktop/main.js');
const desktopPreload = read('desktop/preload.js');

assert(viewerHtml.includes('data-mode="install"'), 'viewer should expose an Install mode button');
assert(viewerHtml.includes('id="install-plan-file"'), 'viewer should expose install-plan file picker');
assert(viewerHtml.includes('id="install-dry-run"'), 'viewer should expose install dry-run action');
assert(viewerHtml.includes('id="install-apply"'), 'viewer should expose guarded install apply action');
assert(viewerHtml.includes('install-assistant-panel'), 'viewer should use a scoped install assistant panel class');
assert(viewerHtml.includes('data-view="coverage"'), 'viewer should expose Coverage Map view');
assert(viewerHtml.includes('install_assistant_ui.js'), 'viewer should load install assistant UI');
assert(viewerHtml.includes('studio_shared_constants.js'), 'viewer should load shared Studio constants before UI modules');
assert(installUi.includes('ProjectMapInstallAssistant'), 'install assistant should expose a small browser API');
assert(installUi.includes('renderInstallAssistantPlan'), 'install assistant should keep plan rendering testable');
assert(
  installUi.includes('browserReviewOnlyMessage') && contracts.browserReviewOnlyMessage().includes('desktop app'),
  'browser install mode should explain review-only behavior through shared contracts'
);
assert(
  installUi.includes('elements.dryRun.disabled = !state.plan || !global.dendryDesktop'),
  'browser install mode should disable dry-run without desktop bridge'
);
assert(desktopMain.includes('dendry:install-plan-apply'), 'desktop main should provide install plan apply IPC');
assert(desktopPreload.includes('applyInstallPlan'), 'desktop preload should expose applyInstallPlan');
assert(viewerApp.includes('coverageRows'), 'viewer model should build coverage rows');

const root = fixtureProject();
const index = syntheticIndex(root);
const model = appModel.buildViewModel(index);
assert(model.lists.coverage.length >= 5, 'coverage view should include core authoring categories');
assert(model.lists.coverage.some((row) => row.id === 'surface_text' && row.safeApplyCount === 1), 'coverage should count source-backed surface safe apply');
const cardsCoverageRow = model.lists.coverage.find((row) => row.id === 'cards');
assert(cardsCoverageRow && /guarded/i.test(cardsCoverageRow.installStatus) && /ambiguous/i.test(cardsCoverageRow.remainingGap), 'coverage should show exact card wiring is guarded while ambiguous lanes remain review-only', cardsCoverageRow);
const handsSidebarCoverageRow = model.lists.coverage.find((row) => row.id === 'hands_sidebar');
assert(handsSidebarCoverageRow && /guarded/i.test(handsSidebarCoverageRow.installStatus) && /ambiguous/i.test(handsSidebarCoverageRow.installStatus), 'coverage should distinguish exact hand/sidebar wiring from ambiguous lanes', handsSidebarCoverageRow);

const actionCard = readJson('fixtures/card_drafts/sample_action_card.json');
const actionBundle = cardDraft.buildExportBundle(actionCard, index);
const wiringOp = actionBundle.installPlan.operations.find((op) => op.id === 'wire_card_flow');
assert(wiringOp, 'card install plan should include wire_card_flow operation');
assert(wiringOp.path === 'source/scenes/main.scene.dry', 'action card wiring proposal should point at hand source file');
assert(wiringOp.content.includes('- #party_affairs'), 'action card wiring proposal should mention matching tag/deck insertion');
assert(wiringOp.content.includes('studio_sample_action_card'), 'action card wiring proposal should name the new card id');
assert(actionBundle.installNotes.includes('source/scenes/main.scene.dry'), 'card install notes should name wiring file');

const advisorCard = readJson('fixtures/card_drafts/sample_advisor_card.json');
const advisorBundle = cardDraft.buildExportBundle(advisorCard, index);
const advisorWiringOp = advisorBundle.installPlan.operations.find((op) => op.id === 'wire_card_flow');
assert(advisorWiringOp.path === 'source/scenes/main.scene.dry', 'advisor wiring proposal should point at hand source file');
assert(advisorWiringOp.content.includes('#circle'), 'advisor wiring proposal should mention the pinned card lane');

const plan = installPlan.surfaceTextInstallPlan({
  id: 'rename_resources',
  editability: 'draft_exportable',
  originalLabel: '資源',
  replacementLabel: '資金',
  source: {path: 'source/scenes/status.scene.dry', line: 1}
});
const dryRun = desktopCore.applyInstallPlan({
  plan,
  projectRoot: root,
  dryRun: true
});
assert(dryRun.ok, 'desktop core install dry-run should succeed: ' + JSON.stringify(dryRun));
assert(dryRun.results.some((result) => result.status === 'would_apply'), 'desktop dry-run should report would_apply');
assert(fs.readFileSync(path.join(root, 'source', 'scenes', 'status.scene.dry'), 'utf8').includes('資源'), 'desktop dry-run must not mutate source');

fs.rmSync(root, {recursive: true, force: true});

console.log(JSON.stringify({
  ok: true,
  coverageRows: model.lists.coverage.length,
  actionWiringPath: wiringOp.path,
  advisorWiringPath: advisorWiringOp.path,
  dryRun: dryRun.dryRun
}, null, 2));
