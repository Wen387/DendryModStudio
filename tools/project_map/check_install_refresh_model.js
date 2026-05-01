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
  let lastApplyOptions = null;
  let lastRuntimePreviewOptions = null;
  const desktop = {
    applyInstallPlan: async (applyOptions) => {
      lastApplyOptions = applyOptions || {};
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
    calls: () => ({scanCalls, lastScanOptions, lastApplyOptions, lastRuntimePreviewOptions})
  };
}

async function main() {
  const harness = desktopHarness();
  const assistant = loadInstallAssistant(harness.desktop);

  assistant.loadPlan({
    id: 'refresh_plan',
    project: {root: '/tmp/dms-refresh-project'},
    operations: []
  });

  const dryRun = await assistant.applyLoadedPlan({dryRun: true});
  let calls = harness.calls();
  assert(dryRun && dryRun.dryRun === true, 'dry-run should return the desktop result');
  assert(calls.lastApplyOptions.projectRoot === '/tmp/dms-refresh-project', 'desktop apply should receive the install plan project root');
  assert(calls.scanCalls === 0, 'dry-run must not refresh ProjectIndex');

  const applied = await assistant.applyLoadedPlan({dryRun: false});
  calls = harness.calls();
  assert(applied && applied.dryRun === false, 'apply should return the desktop result');
  assert(calls.lastApplyOptions.projectRoot === '/tmp/dms-refresh-project', 'desktop apply should keep receiving the active project root');
  assert(calls.scanCalls === 1, 'successful apply should refresh ProjectIndex once');
  assert(calls.lastScanOptions.root === '/tmp/dms-refresh-project', 'refresh should scan the install plan project root');

  const runtimePreview = await assistant.createRuntimePreview({});
  calls = harness.calls();
  assert(runtimePreview && runtimePreview.ok, 'runtime preview should return the desktop result');
  assert(calls.lastRuntimePreviewOptions.projectRoot === '/tmp/dms-refresh-project', 'runtime preview should receive the active project root');

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
