#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const entrySidebar = require('./authoring/entry_sidebar_draft.js');
const installPlan = require('./authoring/install_plan.js');
const core = require('./desktop/studio_core.js');

const ROOT = __dirname;
const DESKTOP_DIR = path.join(ROOT, 'desktop');
const TEMPLATE_ROOT = path.join(ROOT, 'templates', 'starter-demo');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function syntheticIndex(options) {
  const opts = options || {};
  const scenes = [
    {
      id: 'root',
      title: 'Old Start',
      path: 'source/scenes/root.scene.dry',
      metadata: {title: {path: 'source/scenes/root.scene.dry', line: 1}},
      options: [
        {
          id: '@old_event',
          title: 'Begin here',
          target: {kind: 'scene', id: 'old_event'},
          sourceSpan: {path: 'source/scenes/root.scene.dry', startLine: 6, endLine: 6}
        }
      ]
    },
    {id: 'old_event', title: 'Old Event', type: 'event', path: 'source/scenes/events/old_event.scene.dry'}
  ];
  if (opts.status !== false) {
    scenes.push({
      id: 'status',
      title: 'Old Status',
      path: 'source/scenes/status.scene.dry',
      metadata: {title: {path: 'source/scenes/status.scene.dry', line: 1}}
    });
  }
  const textItems = [
    {id: 'root_heading', role: 'heading', text: 'Old Start', owner: {sceneId: 'root'}, source: {path: 'source/scenes/root.scene.dry', line: 3}},
    {id: 'root_body', role: 'body', text: 'Old opening body.', owner: {sceneId: 'root'}, source: {path: 'source/scenes/root.scene.dry', line: 5}}
  ];
  if (opts.status !== false) {
    textItems.push(
      {id: 'status_heading', role: 'heading', text: 'Old Status', owner: {sceneId: 'status'}, source: {path: 'source/scenes/status.scene.dry', line: 3}},
      {id: 'status_body', role: 'body', text: 'Old status body.', owner: {sceneId: 'status'}, source: {path: 'source/scenes/status.scene.dry', line: 5}}
    );
  }
  return {
    schemaVersion: '0.1',
    project: {name: 'Entry fixture', root: opts.root || '', profileIds: ['generic-dendry']},
    scenes,
    variables: [
      {name: 'volunteer_energy', tags: ['resource'], readCount: 2, writeCount: 3},
      {name: 'month', tags: ['time'], readCount: 4}
    ],
    semantic: {
      textCorpus: {items: textItems},
      surfaceText: opts.generatedSidebar ? {items: [], sources: ['out/html/index.html']} : {items: [], sources: []}
    },
    summary: {}
  };
}

function editedDraft(index) {
  const draft = entrySidebar.defaultDraft(index);
  draft.title = 'Justice Party Entry';
  draft.rootTitle = 'Justice Party Campaign';
  draft.rootHeading = 'Justice Party Campaign Office';
  draft.rootIntro = 'A small organizing team prepares its first month.';
  draft.firstOptionTitle = 'Open the first organizing meeting';
  draft.firstTargetId = 'old_event';
  draft.sidebarTitle = 'Justice Party Status';
  draft.sidebarHeading = 'Campaign Status';
  draft.sidebarBody = 'Track the first organizing push.';
  draft.sidebarStatusLines = '[? if volunteer_energy > 0 : Volunteer energy is rising. ?]';
  return draft;
}

function assertBundle(bundle) {
  assert(bundle.ok, 'Entry/Sidebar bundle should validate: ' + JSON.stringify(bundle.diagnostics));
  assert(bundle.installPlan && bundle.installPlan.draftKind === 'entry_sidebar', 'bundle should expose entry_sidebar install plan');
  assert(bundle.files.some((file) => file.path.endsWith('.entry-sidebar-draft.json')), 'bundle should include draft JSON');
  assert(bundle.files.some((file) => file.path.endsWith('.entry-sidebar-preview.txt')), 'bundle should include player preview');
  assert(bundle.files.some((file) => file.path.endsWith('.install-plan.json')), 'bundle should include install plan JSON');
  assert(bundle.files.some((file) => file.path.endsWith('.patch-preview.diff')), 'bundle should include patch preview');
  assert(bundle.installChecklist.includes('replace_section'), 'human checklist should name replace_section operations');
  assert(bundle.patchPreview.includes('@@ replace section'), 'patch preview should show section replacement hunks');
}

async function main() {
  const model = entrySidebar.buildEntryModel(syntheticIndex());
  assert(model.kind === 'entry_sidebar_model', 'synthetic ProjectIndex should build an Entry/Sidebar model');
  assert(model.root && model.root.firstOption && model.root.firstOption.targetId === 'old_event', 'model should detect first playable root route');
  assert(model.sidebar && model.sidebar.exists === true, 'model should detect source-backed status/sidebar scene');
  assert(model.variables.some((item) => item.name === 'volunteer_energy'), 'model should expose variable candidates');
  assert(model.playability.some((row) => row.id === 'root' && row.status === 'ready'), 'model should mark detected root as playable-ready');
  assert(model.playability.some((row) => row.id === 'first_route' && row.status === 'ready'), 'model should mark detected first route as playable-ready');
  assert(model.playability.some((row) => row.id === 'first_target' && row.status === 'ready'), 'model should mark existing first target as playable-ready');
  assert(model.playability.some((row) => row.id === 'sidebar' && row.status === 'ready'), 'model should mark source-backed sidebar as playable-ready');

  const draft = editedDraft(syntheticIndex());
  assert(entrySidebar.validateDraft(draft).ok, 'edited draft should validate');
  const bundle = entrySidebar.buildExportBundle(draft, syntheticIndex());
  assertBundle(bundle);
  assert(bundle.playerPreview.includes('Justice Party Campaign Office'), 'player preview should show start menu heading');
  assert(bundle.playerPreview.includes('Volunteer energy'), 'player preview should show conditional status line');
  assert(bundle.installPlan.operations.some((op) => op.id === 'entry_opening_section' && op.type === 'replace_section'), 'plan should replace root opening section');
  assert(bundle.installPlan.operations.some((op) => op.id === 'sidebar_section' && op.type === 'replace_section'), 'plan should replace sidebar section');
  assert(installPlan.operationSummary(bundle.installPlan).guardedApply >= 2, 'source-backed entry/sidebar changes should be guarded');

  const generatedDraft = editedDraft(syntheticIndex({status: false, generatedSidebar: true}));
  const generatedModel = entrySidebar.buildEntryModel(syntheticIndex({status: false, generatedSidebar: true}));
  assert(generatedModel.playability.some((row) => row.id === 'sidebar' && row.status === 'manual'), 'generated/custom sidebar evidence should be surfaced as manual review readiness');
  const generatedPlan = entrySidebar.buildInstallPlan(generatedDraft, syntheticIndex({status: false, generatedSidebar: true}));
  assert(generatedPlan.operations.some((op) => op.id === 'sidebar_generated_manual' && op.safety === 'manual_review'), 'generated/custom sidebar evidence should stay manual review');
  assert(!generatedPlan.operations.some((op) => op.type === 'create_file'), 'generated/custom sidebar evidence should not create a status scene automatically');

  const missingStatusDraft = editedDraft(syntheticIndex({status: false}));
  const missingStatusPlan = entrySidebar.buildInstallPlan(missingStatusDraft, syntheticIndex({status: false}));
  assert(missingStatusPlan.operations.some((op) => op.id === 'sidebar_create_status_scene' && op.type === 'create_file' && op.safety === 'safe_apply'), 'missing status scene should create a safe source-backed proposal');
  assert(installPlan.classifyOperation(missingStatusPlan.operations.find((op) => op.id === 'sidebar_create_status_scene')).status === 'safe_apply', 'status.scene.dry creation should be installable');

  const invalid = entrySidebar.validateDraft(Object.assign({}, draft, {rootTitle: '', firstOptionTitle: ''}));
  const codes = invalid.diagnostics.map((item) => item.code);
  assert(codes.includes('entry_sidebar.root_title'), 'invalid draft should diagnose missing root title');
  assert(codes.includes('entry_sidebar.first_option'), 'invalid draft should diagnose missing first option text');

  const preparedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_entry_sidebar_starter_'));
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_entry_sidebar_index_'));
  const prepared = core.prepareStarterDemo({desktopDir: DESKTOP_DIR, workspaceRoot: preparedRoot});
  assert(prepared.ok, 'starter demo should prepare for Entry/Sidebar model check');
  const indexed = await core.buildProjectIndex({
    root: prepared.root,
    outDir: scratchRoot,
    includeExcerpts: false,
    python: 'python3',
    desktopDir: DESKTOP_DIR
  });
  assert(indexed.ok, 'starter demo should build a ProjectIndex for Entry/Sidebar model: ' + JSON.stringify(indexed.error || null));
  const starterModel = entrySidebar.buildEntryModel(indexed.index);
  assert(starterModel.root && starterModel.root.id === 'root', 'starter demo model should detect root entry scene');
  assert(starterModel.sidebar && starterModel.sidebar.exists === true && starterModel.sidebar.id === 'status', 'starter demo model should detect status sidebar scene');
  assert(starterModel.root.firstOption && starterModel.root.firstOption.targetId === 'main', 'starter demo model should detect the whiteboard hand as the first playable route');
  assert(starterModel.playableScenes.some((scene) => scene.id === 'main'), 'starter demo model should offer the whiteboard hand as a first playable scene choice');
  assert(fs.existsSync(path.join(TEMPLATE_ROOT, 'source', 'scenes', 'status.scene.dry')), 'starter demo should include status.scene.dry');
  const starterDraft = entrySidebar.defaultDraft(indexed.index);
  starterDraft.id = 'starter_entry_sidebar_probe';
  starterDraft.title = 'Starter Entry Sidebar Probe';
  starterDraft.rootHeading = 'Changed Starter Entry';
  starterDraft.rootIntro = 'Changed opening text for the source-backed starter entry.';
  starterDraft.firstOptionTitle = 'Begin changed starter event';
  starterDraft.sidebarHeading = 'Changed Campaign Status';
  starterDraft.sidebarBody = 'Changed status body for the starter sidebar.';
  starterDraft.sidebarStatusLines = '[? if demo_support > 0 : Changed support status is visible. ?]';
  const starterPlan = entrySidebar.buildInstallPlan(starterDraft, indexed.index);
  assert(starterPlan.operations.some((op) => op.id === 'entry_opening_section' && op.startLine && op.endLine), 'starter entry section should include exact line evidence: ' + JSON.stringify(starterPlan.operations));
  assert(starterPlan.operations.some((op) => op.id === 'sidebar_section' && op.startLine && op.endLine), 'starter sidebar section should include exact line evidence: ' + JSON.stringify(starterPlan.operations));
  const starterDryRun = installPlan.applyInstallPlan(starterPlan, {projectRoot: prepared.root, dryRun: true});
  assert(starterDryRun.ok, 'starter Entry/Sidebar dry-run should succeed with exact anchors: ' + JSON.stringify(starterDryRun));
  assert(!starterDryRun.results.some((item) => item.status === 'failed'), 'starter Entry/Sidebar dry-run should not hide failed operations');
  const starterApply = installPlan.applyInstallPlan(starterPlan, {projectRoot: prepared.root, dryRun: false});
  assert(starterApply.ok, 'starter Entry/Sidebar apply should succeed on temp copy: ' + JSON.stringify(starterApply));
  const starterRootText = fs.readFileSync(path.join(prepared.root, 'source', 'scenes', 'root.scene.dry'), 'utf8');
  const starterStatusText = fs.readFileSync(path.join(prepared.root, 'source', 'scenes', 'status.scene.dry'), 'utf8');
  assert(starterRootText.includes('= Changed Starter Entry'), 'starter root should contain changed entry heading after apply');
  assert(!starterRootText.includes('player-facing event.'), 'starter root replacement should not leave old opening fragments behind');
  assert(starterRootText.includes('- @main: Begin changed starter event'), 'starter root should keep the first route with the changed label');
  assert(starterStatusText.includes('Changed support status is visible.'), 'starter status should contain changed conditional sidebar line');
  fs.rmSync(preparedRoot, {recursive: true, force: true});
  fs.rmSync(scratchRoot, {recursive: true, force: true});

  process.stdout.write(JSON.stringify({
    ok: true,
    guardedOps: installPlan.operationSummary(bundle.installPlan).guardedApply,
    starterFirstTarget: starterModel.root.firstOption.targetId
  }, null, 2) + '\n');
}

main().catch((err) => {
  fail(err && err.stack ? err.stack : String(err));
});
