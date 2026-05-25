#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const DESKTOP_DIR = path.join(ROOT, 'desktop');
const core = require('./desktop/studio_core.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const installPlan = require('./authoring/install_plan.js');
const {pythonCommand} = require('./check_python_command.js');

const {fail, assert} = require('./check_harness.js');

function resultStatuses(result) {
  return (result.results || []).map((row) => row.status).sort();
}

function sceneById(index, id) {
  return (index.scenes || []).find((scene) => String(scene && scene.id || '') === id) || null;
}

function hasLocalSection(scene, localId) {
  return (scene.sections || []).some((section) => String(section && section.id || '').split('.').pop() === localId);
}

function operationByContent(plan, text) {
  return (plan.operations || []).find((operation) => String(operation && operation.content || '').includes(text)) || null;
}

async function runExistingEventRoundtrip() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_existing_roundtrip_'));
  const firstIndexRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_existing_roundtrip_index_'));
  const secondIndexRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_existing_roundtrip_reindex_'));

  try {
    const prepared = core.prepareStarterDemo({desktopDir: DESKTOP_DIR, workspaceRoot});
    assert(prepared.ok, 'starter demo should prepare a writable project copy', prepared);

    const indexed = await core.buildProjectIndex({
      root: prepared.root,
      outDir: firstIndexRoot,
      includeExcerpts: false,
      python: pythonCommand(),
      desktopDir: DESKTOP_DIR
    });
    assert(indexed.ok, 'starter demo should build before existing-event roundtrip', indexed.error || indexed);

    const sceneId = 'demo_opening';
    const initial = canvasModel.buildCanvasModel(indexed.index, {template: 'existing', view: 'events', sceneId}, {});
    assert(initial.ok, 'existing demo event should open in Object Canvas', initial.changeState.diagnostics);
    assert(initial.mode === 'existing', 'existing demo event should use existing mode', initial.mode);
    assert(initial.eventBody.structureActions.some((field) => field.id === 'structure_add_option' && field.editability === 'guarded_apply'), 'existing event should expose guarded add-option', initial.eventBody.structureActions);
    assert(initial.eventBody.structureActions.some((field) => field.id === 'structure_add_branch' && field.editability === 'advanced_source_patch'), 'existing event should expose advanced add-branch', initial.eventBody.structureActions);

    const values = {
      structure_add_option: [
        '- @district_briefing: Hold a district briefing.',
        '@district_briefing',
        'The office compares notes with district organizers.'
      ].join('\n'),
      structure_add_branch: [
        '# late_notice',
        '[? if demo_support >= 1 : A late notice confirms the follow-up desk is active. ?]'
      ].join('\n')
    };

    const edited = canvasModel.buildCanvasModel(indexed.index, {template: 'existing', view: 'events', sceneId}, {values});
    assert(edited.ok, 'edited existing event should stay valid', edited.changeState.diagnostics);
    assert(edited.changeState.changedCount === 2, 'existing-event roundtrip should queue two structural edits', edited.changeState);
    const plan = edited.changeState.installPlan;
    assert(plan && plan.operations && plan.operations.length === 2, 'existing-event roundtrip should produce two install operations', plan);
    const addOptionOperation = operationByContent(plan, '@district_briefing');
    const addBranchOperation = operationByContent(plan, '@late_notice');
    assert(addOptionOperation && addOptionOperation.type === 'insert_text' && addOptionOperation.safety === 'guarded_apply', 'add-option should produce guarded insert_text', plan.operations);
    assert(addBranchOperation && addBranchOperation.type === 'insert_text' && addBranchOperation.safety === 'advanced_apply', 'add-branch should produce advanced insert_text', plan.operations);

    const dryRun = installPlan.applyInstallPlan(plan, {projectRoot: prepared.root, dryRun: true, allowAdvanced: true});
    assert(dryRun.ok, 'existing-event install plan dry-run should succeed', dryRun);
    assert(!resultStatuses(dryRun).some((status) => status === 'manual_review' || status === 'advanced_review' || status === 'failed'), 'dry-run should not leave review-only operations', dryRun.results);

    const applied = installPlan.applyInstallPlan(plan, {projectRoot: prepared.root, dryRun: false, allowAdvanced: true});
    assert(applied.ok, 'existing-event install plan should apply to the writable Demo copy', applied);
    assert(!resultStatuses(applied).some((status) => status === 'manual_review' || status === 'advanced_review' || status === 'failed'), 'apply should execute all planned operations', applied.results);

    const sourcePath = path.join(prepared.root, 'source', 'scenes', 'demo_opening.scene.dry');
    const sourceText = fs.readFileSync(sourcePath, 'utf8');
    assert(sourceText.includes('@district_briefing'), 'modified source should contain the new option/result target');
    assert(sourceText.includes('@late_notice'), 'modified source should contain the new branch');

    const reindexed = await core.buildProjectIndex({
      root: prepared.root,
      outDir: secondIndexRoot,
      includeExcerpts: false,
      python: pythonCommand(),
      desktopDir: DESKTOP_DIR
    });
    assert(reindexed.ok, 'starter demo should rebuild ProjectIndex after existing-event apply', reindexed.error || reindexed);
    const scene = sceneById(reindexed.index, sceneId);
    assert(scene, 'reindexed ProjectIndex should include the edited event scene', reindexed.summary);
    assert(scene.options.some((option) => option && option.target && option.target.id === 'district_briefing'), 'reindexed event should include the new root option', scene.options);
    assert(hasLocalSection(scene, 'district_briefing'), 'reindexed event should include the new result section', scene.sections);
    assert(hasLocalSection(scene, 'late_notice'), 'reindexed event should include the new branch section', scene.sections);

    const reopened = canvasModel.buildCanvasModel(reindexed.index, {template: 'existing', view: 'events', sceneId}, {});
    assert(reopened.ok, 'edited event should reopen as an existing editable object', reopened.changeState.diagnostics);
    assert(reopened.eventBody.options.some((option) => option.id === 'district_briefing'), 'reopened editor should expose the new option', reopened.eventBody.options);
    assert(reopened.eventBody.branchSections.some((section) => section.sectionId === 'demo_opening.late_notice'), 'reopened editor should expose the new branch', reopened.eventBody.branchSections);
    assert(reopened.eventBody.structureActions.some((field) => field.structureAction === 'add_option'), 'reopened editor should keep add-option actions', reopened.eventBody.structureActions);
    assert(reopened.eventBody.structureActions.some((field) => field.structureAction === 'add_branch'), 'reopened editor should keep add-branch actions', reopened.eventBody.structureActions);

    return {
      ok: true,
      scenario: 'existing-event-roundtrip',
      fixture: 'starter-demo-temp-copy',
      sceneId,
      operations: plan.operations.map((operation) => ({
        id: operation.id,
        type: operation.type,
        safety: operation.safety,
        path: operation.path
      })),
      dryRunStatuses: resultStatuses(dryRun),
      applyStatuses: resultStatuses(applied),
      reindexedSceneCount: reindexed.summary.sceneCount,
      reopenedOptions: reopened.eventBody.options.length,
      reopenedActions: reopened.eventBody.structureActions.length,
      support: [
        {family: 'existing_event_roundtrip', status: 'supported', evidence: 'temp-copy apply/reindex/reopen'},
        {family: 'option_add', status: 'guarded', evidence: 'guarded insert_text on starter demo event'},
        {family: 'branch_add', status: 'advanced', evidence: 'advanced insert_text on starter demo event'}
      ]
    };
  } finally {
    fs.rmSync(workspaceRoot, {recursive: true, force: true});
    fs.rmSync(firstIndexRoot, {recursive: true, force: true});
    fs.rmSync(secondIndexRoot, {recursive: true, force: true});
  }
}

async function main() {
  const report = await runExistingEventRoundtrip();
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

if (require.main === module) {
  main().catch((err) => {
    fail(err && err.stack ? err.stack : String(err));
  });
} else {
  module.exports = {runExistingEventRoundtrip};
}
