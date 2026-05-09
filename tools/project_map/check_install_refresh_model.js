#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const INSTALL_UI = path.join(ROOT, 'viewer', 'install_assistant_ui.js');

function assert(condition, message) {
  if (!condition) {
    process.stderr.write('FAIL: ' + message + '\n');
    process.exit(1);
  }
}

function loadInstallAssistant(desktop) {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    dendryDesktop: desktop
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(INSTALL_UI, 'utf8'), context, {filename: INSTALL_UI});
  assert(context.ProjectMapInstallAssistant, 'Install Assistant API should be exposed without DOM');
  return context.ProjectMapInstallAssistant;
}

function desktopHarness(options) {
  const opts = options || {};
  let scanCalls = 0;
  let lastScanOptions = null;
  let applyCalls = 0;
  let lastApplyOptions = null;
  let lastRuntimePreviewOptions = null;
  let closeRuntimePreviewCalls = 0;
  const desktop = {
    applyInstallPlan: async (applyOptions) => {
      applyCalls += 1;
      lastApplyOptions = applyOptions || {};
      if (opts.failDryRun && applyOptions && applyOptions.dryRun) {
        return {
          ok: true,
          dryRun: true,
          results: [{
            id: 'blocked_update',
            type: 'replace_text',
            path: 'source/scenes/main.scene.dry',
            status: 'failed'
          }],
          diagnostics: []
        };
      }
      return {
        ok: true,
        dryRun: Boolean(applyOptions && applyOptions.dryRun),
        results: [{
          id: 'create_event',
          type: 'create_file',
          path: 'source/scenes/events/installed_event.scene.dry',
          status: applyOptions && applyOptions.dryRun ? 'would_apply' : 'applied'
        }],
        diagnostics: []
      };
    },
    createRuntimePreview: async (previewOptions) => {
      lastRuntimePreviewOptions = previewOptions || {};
      return {
        ok: true,
        projectRoot: lastRuntimePreviewOptions.projectRoot,
        plan: lastRuntimePreviewOptions.plan,
        diagnostics: []
      };
    },
    closeRuntimePreview: async () => {
      closeRuntimePreviewCalls += 1;
      return {ok: true};
    },
    scanProject: async (scanOptions) => {
      scanCalls += 1;
      lastScanOptions = scanOptions || {};
      return {
        ok: true,
        root: lastScanOptions.root,
        index: {
          schemaVersion: 'project_map.v1',
          project: {root: lastScanOptions.root || '/tmp/dms-refresh-project'},
          scenes: [],
          graph: {edges: []},
          semantic: {}
        }
      };
    },
    getState: async () => ({
      ok: true,
      lastProject: opts.lastProject || null
    })
  };
  return {
    desktop,
    calls: () => ({scanCalls, applyCalls, closeRuntimePreviewCalls, lastScanOptions, lastApplyOptions, lastRuntimePreviewOptions})
  };
}

function safePlan(id, root) {
  return {
    id,
    project: {root},
    operations: [{
      id: 'create_event',
      type: 'create_file',
      path: 'source/scenes/events/installed_event.scene.dry',
      safety: 'safe_apply',
      content: '* installed_event\n\n# title\nInstalled Event\n'
    }]
  };
}

function advancedPlan(id, root) {
  return {
    id,
    project: {root},
    operations: [{
      id: 'advanced_router_title',
      type: 'replace_text',
      path: 'source/scenes/root.scene.dry',
      safety: 'advanced_apply',
      line: 1,
      search: '# title',
      replace: '# title'
    }]
  };
}

async function main() {
  const harness = desktopHarness();
  const assistant = loadInstallAssistant(harness.desktop);

  assistant.loadPlan(safePlan('refresh_plan', '/tmp/dms-refresh-project'));

  const blockedApply = await assistant.applyLoadedPlan({dryRun: false});
  let calls = harness.calls();
  assert(blockedApply && blockedApply.ok === false, 'apply should be blocked before a successful check');
  assert(calls.applyCalls === 0, 'blocked apply must not call the desktop apply API');

  const dryRun = await assistant.applyLoadedPlan({dryRun: true});
  calls = harness.calls();
  assert(dryRun && dryRun.dryRun === true, 'dry-run should return the desktop result');
  assert(calls.lastApplyOptions.projectRoot === '/tmp/dms-refresh-project', 'desktop apply should receive the install plan project root');
  assert(calls.scanCalls === 0, 'dry-run must not refresh ProjectIndex');

  const applied = await assistant.applyLoadedPlan({dryRun: false});
  calls = harness.calls();
  assert(applied && applied.dryRun === false, 'apply should return the desktop result');
  assert(calls.lastApplyOptions.projectRoot === '/tmp/dms-refresh-project', 'desktop apply should keep receiving the active project root');
  assert(calls.scanCalls === 1, 'successful apply should refresh ProjectIndex once');
  assert(calls.lastScanOptions.root === '/tmp/dms-refresh-project', 'refresh should scan the install plan project root');

  const advancedHarness = desktopHarness();
  const advancedAssistant = loadInstallAssistant(advancedHarness.desktop);
  advancedAssistant.loadPlan(advancedPlan('advanced_gate_plan', '/tmp/dms-advanced-project'));
  const normalCheck = await advancedAssistant.applyLoadedPlan({dryRun: true, allowAdvanced: false});
  const advancedBlocked = await advancedAssistant.applyLoadedPlan({dryRun: false, allowAdvanced: true});
  let advancedCalls = advancedHarness.calls();
  assert(normalCheck && normalCheck.dryRun === true, 'non-advanced check should run');
  assert(advancedBlocked && advancedBlocked.ok === false, 'advanced apply should require an advanced check');
  assert(advancedCalls.applyCalls === 1, 'advanced-gated apply must not call desktop until checked with advanced enabled');
  const advancedCheck = await advancedAssistant.applyLoadedPlan({dryRun: true, allowAdvanced: true});
  const advancedApplied = await advancedAssistant.applyLoadedPlan({dryRun: false, allowAdvanced: true});
  advancedCalls = advancedHarness.calls();
  assert(advancedCheck && advancedCheck.dryRun === true, 'advanced check should run');
  assert(advancedApplied && advancedApplied.dryRun === false, 'advanced apply should work after a matching check');
  assert(advancedCalls.applyCalls === 3, 'advanced checked apply should call desktop after the matching dry-run');

  const failingHarness = desktopHarness({failDryRun: true});
  const failingAssistant = loadInstallAssistant(failingHarness.desktop);
  failingAssistant.loadPlan(safePlan('failed_check_plan', '/tmp/dms-failing-project'));
  const failedCheck = await failingAssistant.applyLoadedPlan({dryRun: true});
  const blockedAfterFailure = await failingAssistant.applyLoadedPlan({dryRun: false});
  const failingCalls = failingHarness.calls();
  assert(failedCheck && failedCheck.dryRun === true, 'failed dry-run should return the desktop result');
  assert(blockedAfterFailure && blockedAfterFailure.ok === false, 'failed dry-run should not unlock apply');
  assert(failingCalls.applyCalls === 1, 'apply after a failed check must not call desktop');

  const browserAssistant = loadInstallAssistant(null);
  browserAssistant.loadPlan(safePlan('browser_review_plan', '/tmp/dms-browser-project'));
  const browserResult = await browserAssistant.applyLoadedPlan({dryRun: false});
  assert(browserResult && browserResult.ok === false, 'browser apply should remain blocked');
  assert(/desktop app/i.test(browserResult.message || ''), 'browser apply should explain that applying needs the desktop app');

  const emptyHarness = desktopHarness();
  const emptyAssistant = loadInstallAssistant(emptyHarness.desktop);
  emptyAssistant.loadPlan({
    id: 'empty_review_plan',
    project: {root: '/tmp/dms-empty-project'},
    operations: []
  });
  await emptyAssistant.applyLoadedPlan({dryRun: true});
  const emptyApply = await emptyAssistant.applyLoadedPlan({dryRun: false});
  const emptyCalls = emptyHarness.calls();
  assert(emptyApply && emptyApply.ok === false, 'empty plans should not unlock apply after a check');
  assert(emptyCalls.applyCalls === 1, 'empty plan apply must not call desktop after dry-run');

  const runtimePreview = await assistant.createRuntimePreview({});
  const endedPreview = await assistant.endRuntimePreview();
  calls = harness.calls();
  assert(runtimePreview && runtimePreview.ok, 'runtime preview should return the desktop result');
  assert(calls.lastRuntimePreviewOptions.projectRoot === '/tmp/dms-refresh-project', 'runtime preview should receive the active project root');
  assert(endedPreview && endedPreview.ended === true, 'ending runtime preview should mark the preview ended');
  assert(calls.closeRuntimePreviewCalls === 1, 'ending runtime preview should call the desktop close API');

  assistant.loadPlan(null);
  const barePreview = await assistant.createRuntimePreview({});
  calls = harness.calls();
  assert(barePreview && barePreview.ok, 'runtime preview should be available without a loaded change plan when a project root is known');
  assert(calls.lastRuntimePreviewOptions.projectRoot === '/tmp/dms-refresh-project', 'bare runtime preview should keep using the last active project root');
  assert(calls.lastRuntimePreviewOptions.plan && calls.lastRuntimePreviewOptions.plan.id === 'runtime_preview_current_project', 'bare runtime preview should send a synthetic empty plan');
  assert(Array.isArray(calls.lastRuntimePreviewOptions.plan.operations) && calls.lastRuntimePreviewOptions.plan.operations.length === 0, 'bare runtime preview synthetic plan should not contain operations');

  const lastProjectHarness = desktopHarness({
    lastProject: {root: '/tmp/dms-last-project-root', includeExcerpts: false}
  });
  const freshAssistant = loadInstallAssistant(lastProjectHarness.desktop);
  const lastProjectPreview = await freshAssistant.createRuntimePreview({});
  const lastProjectCalls = lastProjectHarness.calls();
  assert(lastProjectPreview && lastProjectPreview.ok, 'runtime preview should work with no plan when desktop lastProject has a root');
  assert(lastProjectCalls.lastRuntimePreviewOptions.projectRoot === '/tmp/dms-last-project-root', 'no-plan runtime preview should fall back to desktop lastProject root');
  assert(lastProjectCalls.lastRuntimePreviewOptions.plan && lastProjectCalls.lastRuntimePreviewOptions.plan.operations.length === 0, 'lastProject fallback should use an empty synthetic plan');

  console.log(JSON.stringify({ok: true, scanCalls: calls.scanCalls, root: calls.lastScanOptions.root}, null, 2));
}

main().catch((err) => {
  process.stderr.write('FAIL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
