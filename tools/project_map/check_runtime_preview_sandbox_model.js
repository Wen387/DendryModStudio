#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const runtimePreview = require('./desktop/runtime_preview.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function htmlBuildRunner(commandLabel) {
  return (root, meta) => {
    const htmlRoot = path.join(root, 'out', 'html');
    fs.mkdirSync(htmlRoot, {recursive: true});
    fs.writeFileSync(path.join(htmlRoot, 'index.html'), '<!doctype html><title>' + (meta && meta.lane || 'build') + '</title>\n', 'utf8');
    return {
      ok: true,
      root,
      lane: meta && meta.lane || '',
      command: commandLabel || 'html build runner',
      htmlRoot,
      diagnostics: []
    };
  };
}

const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_runtime_preview_source_'));
fs.mkdirSync(path.join(sourceRoot, 'source', 'scenes'), {recursive: true});
fs.mkdirSync(path.join(sourceRoot, '.git'), {recursive: true});
fs.mkdirSync(path.join(sourceRoot, 'node_modules'), {recursive: true});
fs.writeFileSync(path.join(sourceRoot, 'source', 'info.dry'), 'title: Runtime Preview Fixture\n', 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'source', 'scenes', 'status.scene.dry'), 'Original label\n', 'utf8');
fs.writeFileSync(path.join(sourceRoot, '.git', 'config'), 'must not copy\n', 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'node_modules', 'large.js'), 'must not copy\n', 'utf8');
fs.mkdirSync(path.join(sourceRoot, 'tools'), {recursive: true});
fs.mkdirSync(path.join(sourceRoot, 'out', 'html'), {recursive: true});
fs.writeFileSync(path.join(sourceRoot, 'out', 'html', 'index.html'), '<!doctype html><title>Old</title>\n', 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'out', 'html', 'game.js'), 'old generated game js\n', 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'tools', 'build_and_validate.sh'), [
  '#!/bin/bash',
  'set -e',
  'mkdir -p out/html',
  'printf "<!doctype html><title>Built %s</title>\\n" "$(basename "$(pwd)")" > out/html/index.html'
].join('\n') + '\n', 'utf8');
fs.chmodSync(path.join(sourceRoot, 'tools', 'build_and_validate.sh'), 0o755);

const sessionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_runtime_preview_sessions_'));
const session = runtimePreview.createSession({
  projectRoot: sourceRoot,
  sessionsRoot: sessionRoot,
  plan: {id: 'runtime_preview_plan', title: 'Runtime Preview Plan', operations: []},
  now: () => new Date('2026-04-29T12:00:00.000Z')
});

assert(session.ok, 'createSession should succeed: ' + JSON.stringify(session));
assert(session.sessionId.includes('runtime_preview_plan'), 'session id should include the plan id');
assert(fs.existsSync(path.join(session.paths.baselineRoot, 'source', 'info.dry')), 'baseline copy should include source/info.dry');
assert(fs.existsSync(path.join(session.paths.modifiedRoot, 'source', 'info.dry')), 'modified copy should include source/info.dry');
assert(!fs.existsSync(path.join(session.paths.baselineRoot, '.git', 'config')), 'sandbox copy must exclude .git');
assert(!fs.existsSync(path.join(session.paths.modifiedRoot, 'node_modules', 'large.js')), 'sandbox copy must exclude node_modules');

const packageOnlyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_runtime_preview_package_only_'));
fs.mkdirSync(path.join(packageOnlyRoot, 'source'), {recursive: true});
fs.writeFileSync(path.join(packageOnlyRoot, 'source', 'info.dry'), 'title: Package Only Fixture\n', 'utf8');
fs.writeFileSync(path.join(packageOnlyRoot, 'package.json'), JSON.stringify({
  name: 'package-only-fixture',
  dependencies: {dendrynexus: 'github:aucchen/dendrynexus'}
}, null, 2) + '\n', 'utf8');
const packageOnlyCommand = runtimePreview.resolveBuildCommand(packageOnlyRoot);
assert(packageOnlyCommand.ok, 'package-only project should resolve a bundled DendryNexus build command: ' + JSON.stringify(packageOnlyCommand));
assert(packageOnlyCommand.cmd === process.execPath, 'package-only project should use the current Node executable, not npx: ' + JSON.stringify(packageOnlyCommand));
if (process.platform === 'win32') {
  assert(packageOnlyCommand.args.some((item) => String(item).includes('dendry_cli_runner.js')), 'Windows package-only project should use Studio Dendry CLI runner: ' + JSON.stringify(packageOnlyCommand));
  assert(packageOnlyCommand.env && String(packageOnlyCommand.env.DMS_DENDRY_CLI_PATH || '').includes(path.join('dendrynexus', 'lib', 'cli', 'main.js')), 'Windows Dendry CLI runner should keep the bundled CLI path in env: ' + JSON.stringify(packageOnlyCommand));
} else {
  assert(packageOnlyCommand.args.some((item) => String(item).includes(path.join('dendrynexus', 'lib', 'cli', 'main.js'))), 'package-only project should use bundled DendryNexus CLI: ' + JSON.stringify(packageOnlyCommand));
}
assert(!packageOnlyCommand.args.includes('dendrynexus'), 'package-only project must not use bare npx dendrynexus resolution: ' + JSON.stringify(packageOnlyCommand));

const sourceOnlyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_runtime_preview_source_only_'));
fs.mkdirSync(path.join(sourceOnlyRoot, 'source'), {recursive: true});
fs.writeFileSync(path.join(sourceOnlyRoot, 'source', 'info.dry'), 'title: Source Only Fixture\n', 'utf8');
const sourceOnlyCommand = runtimePreview.resolveBuildCommand(sourceOnlyRoot);
assert(sourceOnlyCommand.ok, 'source-only Dendry project should resolve bundled DendryNexus build command: ' + JSON.stringify(sourceOnlyCommand));
assert(sourceOnlyCommand.cmd === process.execPath, 'source-only project should use the current Node executable, not npx: ' + JSON.stringify(sourceOnlyCommand));
if (process.platform === 'win32') {
  assert(sourceOnlyCommand.args.some((item) => String(item).includes('dendry_cli_runner.js')), 'Windows source-only project should use Studio Dendry CLI runner: ' + JSON.stringify(sourceOnlyCommand));
}
const wrapperWithBash = runtimePreview.resolveBuildWrapperCommand(sourceRoot, {
  allowProjectBuildWrapper: true,
  platform: 'win32',
  commandExists: () => true
});
assert(wrapperWithBash && wrapperWithBash.cmd === 'bash', 'Windows should use build_and_validate.sh when explicitly allowed and bash is available');
const wrapperWithoutBash = runtimePreview.resolveBuildWrapperCommand(sourceRoot, {
  allowProjectBuildWrapper: true,
  platform: 'win32',
  commandExists: () => false
});
assert(wrapperWithoutBash === null, 'Windows should skip build_and_validate.sh when bash is unavailable and allow bundled Dendry fallback');
const wrapperWithoutConsent = runtimePreview.resolveBuildWrapperCommand(sourceRoot, {
  platform: 'linux',
  commandExists: () => true
});
assert(wrapperWithoutConsent === null, 'Runtime Preview should not run a project-local build wrapper without explicit opt-in');
const commandWithoutConsent = runtimePreview.resolveBuildCommand(sourceRoot, {
  platform: 'linux',
  commandExists: () => true
});
assert(commandWithoutConsent.ok && !commandWithoutConsent.args.includes('tools/build_and_validate.sh'), 'Runtime Preview should prefer bundled Dendry CLI over project-local build wrappers by default');
assert(runtimePreview.firstBuildFailureLine('\u001b[31mError: Cannot extract id or type from filename.\u001b[39m\n') === 'Error: Cannot extract id or type from filename.', 'build failure detail should strip ANSI color codes');
const failureDiagnostics = runtimePreview.buildFailureDiagnostics({}, '', '(node:1) Warning: noisy\nError: useful build failure\n');
assert(failureDiagnostics.some((diag) => diag.code === 'runtime_preview.build_output' && diag.message === 'Error: useful build failure'), 'build failure diagnostics should include the first useful stderr line');

const staleHtmlRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_runtime_preview_stale_html_'));
fs.mkdirSync(path.join(staleHtmlRoot, 'out', 'html'), {recursive: true});
fs.writeFileSync(path.join(staleHtmlRoot, 'out', 'html', 'index.html'), 'stale index\n', 'utf8');
fs.writeFileSync(path.join(staleHtmlRoot, 'out', 'html', 'game.js'), 'stale game\n', 'utf8');
fs.writeFileSync(path.join(staleHtmlRoot, 'out', 'html', 'core.js'), 'stable runtime core\n', 'utf8');
runtimePreview.prepareGeneratedHtmlForBuild(staleHtmlRoot);
assert(!fs.existsSync(path.join(staleHtmlRoot, 'out', 'html', 'index.html')), 'Runtime Preview build prep should remove stale generated index.html from the sandbox');
assert(!fs.existsSync(path.join(staleHtmlRoot, 'out', 'html', 'game.js')), 'Runtime Preview build prep should remove stale generated game.js from the sandbox');
assert(fs.existsSync(path.join(staleHtmlRoot, 'out', 'html', 'core.js')), 'Runtime Preview build prep should keep reusable runtime support files');

fs.writeFileSync(path.join(session.paths.modifiedRoot, 'source', 'scenes', 'status.scene.dry'), 'Changed in sandbox\n', 'utf8');
assert(fs.readFileSync(path.join(sourceRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8') === 'Original label\n', 'modified sandbox must not mutate source project');

const replacePlan = {
  schemaVersion: '0.1',
  kind: 'dendry_mod_studio_install_plan',
  id: 'runtime_replace',
  draftKind: 'surface_text',
  title: 'Runtime Replace',
  status: 'proposal_only',
  project: {root: sourceRoot},
  operations: [
    {
      id: 'replace_label',
      type: 'replace_text',
      path: 'source/scenes/status.scene.dry',
      search: 'Original label',
      replace: 'Modified label',
      safety: 'guarded_apply',
      description: 'Replace source-backed label in sandbox.'
    },
    {
      id: 'manual_note',
      type: 'manual_snippet',
      path: 'source/scenes/status.scene.dry',
      content: 'SHOULD_NOT_APPLY\n',
      safety: 'manual_review',
      description: 'Manual operation should stay manual.'
    }
  ]
};

const debugProjectIndex = {
  project: {name: 'Runtime Preview Fixture', root: sourceRoot},
  variables: [
    {name: 'year', readCount: 5, writeCount: 1, tags: ['time']},
    {name: 'runtime_replace_seen', readCount: 1, writeCount: 1, tags: ['event']}
  ],
  scenes: [
    {id: 'root', title: 'Root', type: 'hand', path: 'source/scenes/root.scene.dry'},
    {id: 'runtime_replace', title: 'Runtime Replace', type: 'event', tags: ['event'], path: 'source/scenes/status.scene.dry'}
  ],
  edges: [{from: 'root', to: 'runtime_replace', label: 'debug jump'}],
  semantic: {events: [{id: 'runtime_replace', title: 'Runtime Replace'}]}
};

const quickSession = runtimePreview.createQuickRuntimePreview({
  projectRoot: sourceRoot,
  sessionsRoot: sessionRoot,
  plan: {id: 'quick_lens', title: 'Quick Lens', operations: []},
  projectIndex: debugProjectIndex,
  serverFactory: runtimePreview.fakeServerFactory(47998),
  now: () => new Date('2026-04-29T12:03:00.000Z')
});
assert(quickSession.ok, 'quick runtime preview should reuse existing generated HTML: ' + JSON.stringify(quickSession));
assert(quickSession.previewMode === 'quick', 'quick runtime preview should report quick mode');
assert(quickSession.modifiedBuild && quickSession.modifiedBuild.skippedBuild === true, 'quick runtime preview should skip project builds');
assert(!quickSession.baselineBuild, 'quick runtime preview should not create a baseline build');
assert(fs.existsSync(path.join(quickSession.paths.modifiedRoot, 'out', 'html', 'index.html')), 'quick runtime preview should copy generated out/html');
assert(fs.existsSync(path.join(quickSession.paths.modifiedRoot, 'out', 'html', 'dms-preview-bridge.js')), 'quick runtime preview should inject the debug bridge into the copied HTML');
assert(!fs.existsSync(path.join(quickSession.paths.modifiedRoot, 'source', 'info.dry')), 'quick runtime preview should not copy the full project source tree');

const applySession = runtimePreview.createRuntimePreview({
  projectRoot: sourceRoot,
  sessionsRoot: sessionRoot,
  plan: replacePlan,
  dryRun: false,
  buildRunner: runtimePreview.fakeBuildRunner({ok: true}),
  serverFactory: runtimePreview.fakeServerFactory(47999),
  now: () => new Date('2026-04-29T12:05:00.000Z')
});

assert(applySession.ok, 'createRuntimePreview should succeed with guarded replace: ' + JSON.stringify(applySession));
assert(applySession.installResult.results.some((item) => item.status === 'applied'), 'sandbox apply should apply guarded operations');
assert(applySession.installResult.results.some((item) => item.status === 'manual_review'), 'sandbox apply should preserve manual operations');
assert(fs.readFileSync(path.join(applySession.paths.modifiedRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8').includes('Modified label'), 'modified sandbox should contain applied replacement');
assert(fs.readFileSync(path.join(sourceRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8') === 'Original label\n', 'real source project must remain unchanged after sandbox apply');
assert(applySession.compareUrl.includes('127.0.0.1'), 'compareUrl should use localhost');

const mismatchPreview = runtimePreview.createRuntimePreview({
  projectRoot: sourceRoot,
  sessionsRoot: sessionRoot,
  plan: Object.assign({}, replacePlan, {
    id: 'runtime_replace_mismatch',
    operations: [Object.assign({}, replacePlan.operations[0], {search: 'Text that is no longer present'})]
  }),
  dryRun: false,
  buildRunner: runtimePreview.fakeBuildRunner({ok: true}),
  serverFactory: runtimePreview.fakeServerFactory(48000),
  now: () => new Date('2026-04-29T12:07:00.000Z')
});
assert(mismatchPreview.ok, 'preview should still be openable when an install operation fails but both builds succeed: ' + JSON.stringify(mismatchPreview));
assert(mismatchPreview.installResult && mismatchPreview.installResult.ok === false, 'preview should preserve install diagnostics when a guarded replace mismatches');
assert(mismatchPreview.diagnostics.some((diag) => String(diag.code || '').indexOf('install_plan.replace_') === 0), 'preview diagnostics should include the replace mismatch reason');

const realWrapperAvailable = Boolean(runtimePreview.resolveBuildWrapperCommand(sourceRoot, {allowProjectBuildWrapper: true}));
const realBuildSession = runtimePreview.createRuntimePreview({
  projectRoot: sourceRoot,
  sessionsRoot: sessionRoot,
  plan: replacePlan,
  projectIndex: debugProjectIndex,
  dryRun: false,
  allowProjectBuildWrapper: realWrapperAvailable,
  buildRunner: realWrapperAvailable ? undefined : htmlBuildRunner('fallback html build runner'),
  serverFactory: runtimePreview.fakeServerFactory(48001),
  now: () => new Date('2026-04-29T12:10:00.000Z')
});

assert(realBuildSession.ok, 'real build runner session should succeed: ' + JSON.stringify(realBuildSession));
if (realWrapperAvailable) {
  assert(realBuildSession.baselineBuild.command.includes('tools/build_and_validate.sh'), 'build runner should prefer protected build wrapper');
} else {
  assert(realBuildSession.baselineBuild.command.includes('fallback html build runner'), 'test should use a cross-platform fallback when bash is unavailable');
}
assert(realBuildSession.modifiedBuild.htmlRoot.endsWith(path.join('out', 'html')), 'build runner should expose out/html root');
assert(fs.existsSync(path.join(realBuildSession.paths.root, 'compare', 'index.html')), 'compare page should be written');
const compareHtml = fs.readFileSync(path.join(realBuildSession.paths.root, 'compare', 'index.html'), 'utf8');
assert(compareHtml.includes('Runtime Preview'), 'compare page should have a human title');
assert(compareHtml.includes('data-preview-mode="split"'), 'compare page should include split mode');
assert(compareHtml.includes('../baseline/out/html/index.html'), 'compare page should reference baseline iframe');
assert(compareHtml.includes('../modified/out/html/index.html'), 'compare page should reference modified iframe');
assert(realBuildSession.debug && realBuildSession.debug.enabled === true, 'runtime preview should enable debug controls when ProjectIndex is available');
assert(realBuildSession.debug.controls.variables.some((item) => item.name === 'year'), 'debug controls should include ProjectIndex variable candidates');
assert(realBuildSession.debug.controls.scenes.some((item) => item.id === 'runtime_replace'), 'debug controls should include ProjectIndex scene candidates');
assert(fs.existsSync(path.join(realBuildSession.paths.modifiedRoot, 'out', 'html', 'dms-preview-bridge.js')), 'debug bridge should be written only to modified out/html');
assert(!fs.existsSync(path.join(realBuildSession.paths.baselineRoot, 'out', 'html', 'dms-preview-bridge.js')), 'debug bridge should not be written to baseline out/html');
const modifiedIndexHtml = fs.readFileSync(path.join(realBuildSession.paths.modifiedRoot, 'out', 'html', 'index.html'), 'utf8');
assert(modifiedIndexHtml.includes('dms-preview-bridge.js'), 'modified runtime index should load the debug bridge inside the iframe');
const debugCompareHtml = fs.readFileSync(path.join(realBuildSession.paths.root, 'compare', 'index.html'), 'utf8');
assert(debugCompareHtml.includes('runtime-debug-console'), 'compare page should include Debug Console panel');
assert(debugCompareHtml.includes('dms-runtime-preview-command'), 'compare page should send structured debug commands to the modified iframe');
assert(debugCompareHtml.includes('runtime-debug-resizer'), 'compare page should include a draggable Debug Console resizer');
assert(debugCompareHtml.includes('--runtime-debug-width'), 'compare page should size the Debug Console through a CSS variable');
assert(debugCompareHtml.includes('dms-runtime-preview-debug-width'), 'compare page should persist Debug Console width between preview sessions');
const historyResult = runtimePreview.recordDebugCommandHistory(realBuildSession.paths.root, {
  type: 'jumpToScene',
  sceneId: 'runtime_replace'
}, {ok: true}, () => new Date('2026-04-29T15:00:00.000Z'));
assert(historyResult.ok, 'recordDebugCommandHistory should succeed: ' + JSON.stringify(historyResult));
const metadataAfterHistory = JSON.parse(fs.readFileSync(path.join(realBuildSession.paths.root, 'metadata.json'), 'utf8'));
assert(metadataAfterHistory.debugCommandHistory.length === 1, 'metadata should store debug command history');
assert(metadataAfterHistory.debugCommandHistory[0].sceneId === 'runtime_replace', 'history should store target scene id');

Promise.resolve(runtimePreview.createRuntimePreview({
  projectRoot: sourceRoot,
  sessionsRoot: sessionRoot,
  plan: replacePlan,
  dryRun: false,
  buildRunner: runtimePreview.fakeBuildRunner({ok: true}),
  serverFactory: () => Promise.resolve(runtimePreview.fakeServerFactory(48111)()),
  now: () => new Date('2026-04-29T12:15:00.000Z')
})).then((asyncServerSession) => {
  assert(asyncServerSession.ok, 'createRuntimePreview should await async preview server startup: ' + JSON.stringify(asyncServerSession));
  assert(asyncServerSession.compareUrl.includes(':48111/'), 'async preview server port should be used in compare URL');
  process.stdout.write(JSON.stringify({
    ok: true,
    sessionId: session.sessionId,
    previewSessionId: applySession.sessionId,
    asyncPreviewSessionId: asyncServerSession.sessionId,
    compareUrl: applySession.compareUrl,
    baselineRoot: session.paths.baselineRoot,
    modifiedRoot: session.paths.modifiedRoot
  }, null, 2) + '\n');
}).catch((err) => {
  fail(err && err.stack ? err.stack : String(err));
});
