#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const runtimePreview = require('./desktop/runtime_preview.js');
const {pythonCommand} = require('./check_python_command.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const {failJson: fail, assertJson: assert} = require('./check_harness.js');

function writeFixture(root) {
  const scenes = path.join(root, 'source', 'scenes');
  const htmlRoot = path.join(root, 'out', 'html');
  fs.mkdirSync(scenes, {recursive: true});
  fs.mkdirSync(path.join(htmlRoot, 'img'), {recursive: true});
  fs.writeFileSync(path.join(root, 'source', 'info.dry'), [
    'title: Runtime Surface Fixture',
    'author: Dendry Mod Studio',
    'ifid: 00000000-0000-4000-8000-000000000777',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(scenes, 'root.scene.dry'), [
    'title: Root',
    'new-page: true',
    '',
    '= Runtime Surface Fixture',
    'Open the runtime surface fixture.',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(htmlRoot, 'index.html'), [
    '<!doctype html>',
    '<html>',
    '<head>',
    '  <link rel="stylesheet" href="game.css">',
    '  <script src="jquery-1.11.1.min.js"></script>',
    '  <script src="core.js"></script>',
    '  <script src="game.js"></script>',
    '</head>',
    '<body>',
    '  <div id="page">',
    '    <div id="bg1" class="background"></div>',
    '    <div id="bg2" class="background"></div>',
    '    <aside id="stats_sidebar"><button onclick="changeTab(\'main\')">Main</button></aside>',
    '    <main id="mid_panel">',
    '      <figure class="face-figure"><img class="face-img" src="img/leader.png" alt="Leader"></figure>',
    '      <section id="content"></section>',
    '      <ul class="choices"></ul>',
    '      <div class="hand"><img class="card-img" src="img/card.png" alt="Card"></div>',
    '    </main>',
    '    <aside id="stats_sidebar_right"></aside>',
    '    <div id="tools_wrapper">',
    '      <button id="options_button" onclick="window.showOptions()">Options</button>',
    '      <button onclick="window.showSave()">Save/Load</button>',
    '    </div>',
    '  </div>',
    '  <div id="options"><label><input type="checkbox" onchange="enableBg()"> Backgrounds</label></div>',
    '  <div id="save"></div>',
    '</body>',
    '</html>',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(htmlRoot, 'game.css'), [
    ':root { --accent-color: #2468ac; }',
    '#content { min-height: 20rem; }',
    'ul.choices { list-style: none; }',
    '#stats_sidebar_right { width: 12rem; }',
    '.background { background-image: url("img/bg.png"); }',
    '.pinned-cards, .deck, .card-tooltip, .face-img { display: block; }',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(htmlRoot, 'game.js'), [
    'window.showOptions = function showOptions() {};',
    'window.showSave = function showSave() {};',
    'window.dendryModifyUI = main;',
    'function main() {',
    '  document.getElementById("content");',
    '  document.querySelector("ul.choices");',
    '  d3.select("#polls_graph");',
    '}',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(htmlRoot, 'img', 'leader.png'), 'not really an image\n', 'utf8');
  fs.writeFileSync(path.join(htmlRoot, 'img', 'card.png'), 'not really an image\n', 'utf8');
}

function buildIndex(root) {
  const out = path.join(os.tmpdir(), 'dms-runtime-surface-' + process.pid + '.json');
  const result = spawnSync(pythonCommand(), [
    path.join(REPO_ROOT, 'tools', 'project_map', 'build_project_map.py'),
    '--root',
    root,
    '--out',
    out,
    '--summary'
  ], {cwd: REPO_ROOT, encoding: 'utf8'});
  assert(result.status === 0, 'ProjectIndex build should succeed', {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status
  });
  return JSON.parse(fs.readFileSync(out, 'utf8'));
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_runtime_surface_'));
const sessionsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_runtime_surface_sessions_'));
writeFixture(root);

const index = buildIndex(root);
const runtimeSurface = index.semantic && index.semantic.runtimeSurface;
assert(runtimeSurface, 'ProjectIndex should expose semantic.runtimeSurface');
assert(runtimeSurface.readiness && runtimeSurface.readiness.status === 'partial', 'missing runtime scripts should mark readiness partial', runtimeSurface.readiness);
assert(runtimeSurface.readiness.quickPreviewReady === false, 'missing runtime scripts should block quick preview readiness');

const regionRoles = new Set((runtimeSurface.regions || []).map((item) => item.role));
[
  'content',
  'choices',
  'left_sidebar',
  'right_sidebar',
  'options_overlay',
  'save_overlay',
  'background',
  'tools',
  'portrait_image',
  'card_hand',
  'card_image',
  'pinned_cards',
  'deck',
  'card_tooltip'
].forEach((role) => {
  assert(regionRoles.has(role), 'runtime surface should include region role: ' + role, runtimeSurface.regions);
});

const controls = runtimeSurface.controls || [];
assert(controls.some((item) => item.label === 'Options' && item.handlers && item.handlers.onclick), 'Options button should be indexed with handler');
assert(controls.some((item) => item.label === 'Save/Load'), 'Save/Load button should be indexed');
assert((runtimeSurface.cssVariables || []).some((item) => item.name === '--accent-color'), 'CSS variables should be indexed');
assert((runtimeSurface.libraries || []).some((item) => item.id === 'd3'), 'D3 JS evidence should be indexed as a library');
assert((runtimeSurface.hooks || []).some((item) => item.name === 'dendryModifyUI'), 'runtime hooks should include dendryModifyUI');
assert((runtimeSurface.assetRefs || []).some((item) => item.path === 'out/html/img/leader.png' && item.fileExists === true), 'HTML image refs should be indexed');
assert((runtimeSurface.assetRefs || []).some((item) => item.path === 'out/html/img/bg.png' && item.fileExists === false), 'CSS image refs should be indexed with missing file status');

const runtimeDiagnostics = runtimeSurface.diagnostics || [];
const topLevelDiagnostics = index.diagnostics || [];
['out/html/jquery-1.11.1.min.js', 'out/html/core.js'].forEach((missingPath) => {
  assert(
    runtimeDiagnostics.some((diag) => diag.code === 'runtime_surface.missing_script' && diag.missingPath === missingPath),
    'runtime surface should report missing script: ' + missingPath,
    runtimeDiagnostics
  );
  assert(
    topLevelDiagnostics.some((diag) => diag.code === 'runtime_surface.missing_script' && diag.missingPath === missingPath),
    'missing runtime scripts should also appear in top-level diagnostics: ' + missingPath,
    topLevelDiagnostics
  );
});
assert(index.summary.runtimeSurfaceRegionCount === runtimeSurface.regions.length, 'summary should count runtime surface regions');
assert(index.summary.runtimeSurfaceControlCount === runtimeSurface.controls.length, 'summary should count runtime surface controls');
assert(index.summary.runtimeSurfaceDiagnosticCount === runtimeSurface.diagnostics.length, 'summary should count runtime surface diagnostics');

const quickMissing = runtimePreview.createQuickRuntimePreview({
  projectRoot: root,
  sessionsRoot,
  plan: {id: 'quick_missing', title: 'Quick Missing', operations: []},
  serverFactory: runtimePreview.fakeServerFactory(48210),
  now: () => new Date('2026-05-12T12:00:00.000Z')
});
assert(!quickMissing.ok && quickMissing.status === 'failed', 'Quick Runtime Lens should fail when referenced scripts are missing', quickMissing);
assert(
  quickMissing.diagnostics.some((diag) => diag.code === 'runtime_surface.missing_script' && diag.missingPath === 'out/html/core.js'),
  'Quick Runtime Lens should report the missing core.js dependency',
  quickMissing.diagnostics
);

fs.writeFileSync(path.join(root, 'out', 'html', 'core.js'), 'window.dendry = {};\n', 'utf8');
fs.writeFileSync(path.join(root, 'out', 'html', 'jquery-1.11.1.min.js'), 'window.jQuery = window.$ = function() {};\n', 'utf8');

const quickReady = runtimePreview.createQuickRuntimePreview({
  projectRoot: root,
  sessionsRoot,
  plan: {id: 'quick_ready', title: 'Quick Ready', operations: []},
  projectIndex: index,
  serverFactory: runtimePreview.fakeServerFactory(48211),
  now: () => new Date('2026-05-12T12:01:00.000Z')
});
assert(quickReady.ok, 'Quick Runtime Lens should open after referenced local dependencies exist: ' + JSON.stringify(quickReady));
assert(quickReady.previewMode === 'quick', 'Quick Runtime Lens should still report quick mode');
assert(fs.existsSync(path.join(quickReady.paths.modifiedRoot, 'out', 'html', 'dms-preview-bridge.js')), 'Quick Runtime Lens should inject the debug bridge into copied HTML');

process.stdout.write(JSON.stringify({
  ok: true,
  regions: runtimeSurface.regions.length,
  controls: runtimeSurface.controls.length,
  diagnostics: runtimeSurface.diagnostics.length,
  quickReady: quickReady.ok
}, null, 2) + '\n');
