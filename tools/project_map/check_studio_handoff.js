#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const REPO = path.resolve(ROOT, '..', '..');

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

const workflow = read('tools/project_map/WORKFLOW.md');
const readme = read('tools/project_map/README.md');
const handover = read('HANDOVER.md');
const sessionLog = read('SESSION_LOG.md');
const releaseCheck = read('tools/project_map/check_studio_release_readiness.js');

[
  'tools/project_map/check_studio_handoff.js',
  'tools/project_map/check_studio_release_readiness.js',
  'tools/project_map/check_preview_model.js',
  'tools/project_map/check_asset_model.js',
  'tools/project_map/check_runtime_preview_sandbox_model.js',
  'tools/project_map/desktop/runtime_preview.js',
  'tools/project_map/check_studio_surface.js',
  'tools/project_map/check_localization_surface.js'
].forEach((relativePath) => {
  assert(exists(relativePath), 'handoff gate expected file: ' + relativePath);
});

[
  '### Studio Handoff Gate',
  'Current slice',
  'Changed files',
  'Verification',
  'Boundaries',
  'Next preview slice',
  'node tools/project_map/check_studio_handoff.js'
].forEach((needle) => {
  assert(workflow.includes(needle), 'workflow handoff gate should mention ' + needle);
});

[
  'check_studio_handoff.js',
  'check_preview_model.js',
  'check_asset_model.js',
  'check_runtime_preview_sandbox_model.js',
  'Preview readiness'
].forEach((needle) => {
  assert(readme.includes(needle), 'README should mention handoff/preview command ' + needle);
});

[
  'check_studio_handoff.js',
  'Preview readiness',
  'ProjectMapPreviewModel',
  'Runtime Preview Sandbox',
  '127.0.0.1',
  'desktop file picker 提供絕對 `sourcePath`',
  '瀏覽器或沒有 sourcePath 的請求仍保持 manual review',
  '沒有 asset optimization'
].forEach((needle) => {
  assert(handover.includes(needle), 'root handover should mention ' + needle);
});

[
  'Handoff / Preview readiness',
  'Runtime Preview Sandbox',
  'check_studio_handoff.js',
  'ready_to_review',
  'needs_review',
  'manual_review'
].forEach((needle) => {
  assert(sessionLog.includes(needle), 'session log should mention ' + needle);
});

[
  'Runtime Preview Debug Console',
  'preview-only',
  'ProjectIndex-known variables',
  'ProjectIndex-known scenes',
  '不執行任意 JS',
  '真專案不寫入'
].forEach((needle) => {
  assert(handover.includes(needle) || workflow.includes(needle) || readme.includes(needle), 'runtime preview debug handoff should mention ' + needle);
});

assert(releaseCheck.includes('check_studio_handoff.js'), 'release readiness should include studio handoff gate');

process.stdout.write(JSON.stringify({
  ok: true,
  gate: [
    'Update current slice and boundaries.',
    'List changed files and verification evidence.',
    'Record next preview slice.',
    'Run this handoff gate before final handoff.'
  ]
}, null, 2) + '\n');
