#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const VIEWER = path.join(ROOT, 'viewer');
const DESKTOP = path.join(ROOT, 'desktop');

const {fail, assert} = require('./check_harness.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const wizardUi = read(path.join(VIEWER, 'wizard_ui.js'));
const objectCanvasUi = read(path.join(VIEWER, 'object_authoring_canvas_ui.js'));
const installAssistantUi = read(path.join(VIEWER, 'install_assistant_ui.js'));
const runtimeLensUi = read(path.join(VIEWER, 'runtime_lens_ui.js'));
const runtimeLensWorkspaceState = read(path.join(VIEWER, 'runtime_lens_workspace_state.js'));
const desktopMain = read(path.join(DESKTOP, 'main.js'));
const runtimePreview = read(path.join(DESKTOP, 'runtime_preview.js'));
const desktopPackage = read(path.join(DESKTOP, 'package.json'));
const cleanupSource = read(path.join(DESKTOP, 'runtime_session_cleanup.js'));

assert(wizardUi.includes('ProjectMap:mode-changing'), 'Wizard should emit mode-changing lifecycle events');
assert(wizardUi.includes('ProjectMap:mode-changed'), 'Wizard should emit mode-changed lifecycle events');
assert(wizardUi.includes('ProjectMap:foreground-changed'), 'Wizard should emit foreground lifecycle events');
assert(wizardUi.includes('visibilitychange'), 'Wizard should observe document visibility changes');

assert(objectCanvasUi.includes('bindRuntimeLifecycle'), 'Object Canvas should bind runtime lifecycle hooks');
assert(objectCanvasUi.includes('suspendForegroundRuntime'), 'Object Canvas should suspend foreground runtime work');
assert(objectCanvasUi.includes('data-runtime-lens-frame'), 'Object Canvas should remove Runtime Lens iframes on suspend');
assert(objectCanvasUi.includes('runtimeLensEmbedsSuspended'), 'Object Canvas should track suspended Lens embeds');
assert(objectCanvasUi.includes('withRuntimeLensRenderStatus'), 'Object Canvas should render suspended Lens sessions without reloading iframe');

assert(installAssistantUi.includes('bindRuntimeLifecycle'), 'Install Assistant should bind runtime lifecycle hooks');
assert(installAssistantUi.includes('suspendRuntimePreview'), 'Install Assistant should suspend runtime preview work');
assert(installAssistantUi.includes('data-runtime-preview-frame'), 'Install Assistant should remove Runtime Preview iframes on suspend');
assert(installAssistantUi.includes('runtimePreviewSuspended'), 'Install Assistant should track suspended preview embeds');
assert(installAssistantUi.includes('install.runtimePreviewSuspended'), 'Install Assistant should show suspended preview copy');

assert(runtimeLensUi.includes("opts.status === 'suspended'"), 'Runtime Lens UI should render a suspended state');
assert(runtimeLensUi.includes("const suspended = opts.status === 'suspended'"), 'Runtime Lens UI should let suspended state win over stale focus');
assert(runtimeLensUi.includes('!suspended &&'), 'Runtime Lens UI should not reframe suspended sessions as stale');
assert(runtimeLensUi.includes('runtimeLens.suspended'), 'Runtime Lens UI should localize suspended state');
assert(runtimeLensWorkspaceState.includes('runtimeLensEmbedsSuspended = false'), 'Runtime Lens actions should clear suspended state before rebuild');
assert(runtimeLensWorkspaceState.includes('result && result.status'), 'Runtime Lens workspace should preserve blocked/partial session status from desktop results');
assert(runtimeLensWorkspaceState.includes('runtimeLens.blocked'), 'Runtime Lens workspace should show blocked readiness copy');
assert(runtimeLensWorkspaceState.includes('renderRuntimeLensEvidence'), 'Runtime Lens workspace should update returned evidence without forcing an iframe reload');
assert(objectCanvasUi.includes('updateRuntimeLensEvidence'), 'Object Canvas should expose a targeted Runtime Lens evidence updater');

assert(desktopMain.includes("require('./runtime_session_cleanup')"), 'Desktop main should load runtime session cleanup helper');
assert(desktopMain.includes('pruneRuntimeSessions'), 'Desktop main should prune runtime sessions');
assert(desktopMain.includes("app.on('before-quit'"), 'Desktop main should close/clean runtime resources before quit');
assert(runtimePreview.includes('function closePreviewServer'), 'Runtime Preview should expose preview server shutdown');
assert(desktopPackage.includes('runtime_session_cleanup.js'), 'Desktop package should include runtime session cleanup helper');
assert(cleanupSource.includes('isSymbolicLink'), 'Runtime cleanup should guard symlinked paths');
assert(cleanupSource.includes('metadata.json'), 'Runtime cleanup should require session metadata');

const cleanup = require(path.join(DESKTOP, 'runtime_session_cleanup.js'));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-runtime-cleanup-check-'));
try {
  const now = new Date('2026-05-07T12:00:00Z');
  const oldStudio = writeSession(tempRoot, 'old-studio', '2026-05-04T12:00:00Z', 'dendry_mod_studio_runtime_preview');
  const recentStudio = writeSession(tempRoot, 'recent-studio', '2026-05-07T11:00:00Z', 'dendry_mod_studio_runtime_preview');
  const otherTool = writeSession(tempRoot, 'other-tool', '2026-05-01T12:00:00Z', 'some_other_tool');
  const invalid = path.join(tempRoot, 'invalid-metadata');
  fs.mkdirSync(invalid);
  fs.writeFileSync(path.join(invalid, 'metadata.json'), '{broken', 'utf8');
  const missing = path.join(tempRoot, 'missing-metadata');
  fs.mkdirSync(missing);

  const result = cleanup.pruneRuntimeSessions(tempRoot, {
    now,
    maxAgeMs: 48 * 60 * 60 * 1000,
    keepRecent: 1
  });

  assert(result.ok, 'Runtime cleanup should complete successfully');
  assert(!fs.existsSync(oldStudio), 'Runtime cleanup should remove old Studio sessions');
  assert(fs.existsSync(recentStudio), 'Runtime cleanup should keep recent Studio sessions');
  assert(fs.existsSync(otherTool), 'Runtime cleanup should keep non-Studio metadata');
  assert(fs.existsSync(invalid), 'Runtime cleanup should keep invalid metadata folders');
  assert(fs.existsSync(missing), 'Runtime cleanup should keep folders without metadata');
  assert(result.removed.length === 1, 'Runtime cleanup should report exactly one removed session');
} finally {
  fs.rmSync(tempRoot, {recursive: true, force: true});
}

function writeSession(root, name, createdAt, kind) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({
    schemaVersion: '0.1',
    kind,
    sessionId: name,
    createdAt
  }, null, 2) + '\n', 'utf8');
  return dir;
}

process.stdout.write('Runtime lifecycle model checks passed.\n');
