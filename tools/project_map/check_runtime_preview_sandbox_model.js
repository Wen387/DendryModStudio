#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const runtimePreview = require('./desktop/runtime_preview.js');
const debugBridge = require('./desktop/runtime_preview_debug_bridge.js');

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

const confinedSession = runtimePreview.resolvePreviewSessionRoot('/tmp/dms-preview-root', 'session-1/api/runtime-snapshot');
assert(confinedSession.ok, 'preview session path should allow a normal session segment');
assert(confinedSession.root === path.resolve('/tmp/dms-preview-root', 'session-1'), 'preview session path should resolve under preview root');
assert(!runtimePreview.resolvePreviewSessionRoot('/tmp/dms-preview-root', '../escape/api/runtime-snapshot').ok, 'preview session path should reject parent traversal');
assert(!runtimePreview.resolvePreviewSessionRoot('/tmp/dms-preview-root', '/api/runtime-snapshot').ok, 'preview session path should reject missing session segment');

const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_runtime_preview_source_'));
fs.mkdirSync(path.join(sourceRoot, 'source', 'scenes'), {recursive: true});
fs.mkdirSync(path.join(sourceRoot, 'source', 'scenes', 'decks'), {recursive: true});
fs.mkdirSync(path.join(sourceRoot, '.git'), {recursive: true});
fs.mkdirSync(path.join(sourceRoot, 'node_modules'), {recursive: true});
fs.writeFileSync(path.join(sourceRoot, 'source', 'info.dry'), 'title: Runtime Preview Fixture\n', 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'source', 'scenes', 'status.scene.dry'), 'Original label\n', 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'source', 'scenes', 'decks', 'demo_action_deck.scene.dry'), [
  'title: Starter Deck',
  'is-deck: true',
  '',
  '- #demo_action'
].join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(sourceRoot, '.git', 'config'), 'must not copy\n', 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'node_modules', 'large.js'), 'must not copy\n', 'utf8');
fs.mkdirSync(path.join(sourceRoot, 'tools'), {recursive: true});
fs.mkdirSync(path.join(sourceRoot, 'out', 'html'), {recursive: true});
fs.writeFileSync(path.join(sourceRoot, 'out', 'html', 'index.html'), '<!doctype html><title>Old</title>\n', 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'out', 'html', 'game.js'), 'old generated game js\n', 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'out', 'html', 'game.css'), '.face-image { width: 140px; object-fit: cover; }\n', 'utf8');
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
const mixedFailureDiagnostics = runtimePreview.buildFailureDiagnostics(
  {},
  'Game file is out of date, recompiling.\nError: source/scenes/cards/demo_action_card.scene.dry line 8: Invalid property definition.\n',
  '(node:1) Warning: noisy\n(Use `electron --trace-warnings ...` to show where the warning was created)\n'
);
assert(mixedFailureDiagnostics.some((diag) => diag.code === 'runtime_preview.build_output' && diag.message.includes('demo_action_card.scene.dry line 8')), 'build failure diagnostics should prefer stdout parser errors over Electron trace-warning hints');

const faceImageCssRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_runtime_preview_face_img_css_'));
fs.mkdirSync(faceImageCssRoot, {recursive: true});
fs.writeFileSync(path.join(faceImageCssRoot, 'game.css'), '.face-image { width: 140px; object-fit: cover; }\n', 'utf8');
const browserUiSource = fs.readFileSync(require.resolve('dendrynexus/lib/ui/browser'), 'utf8');
const stockCssSource = fs.readFileSync(path.join(path.dirname(require.resolve('dendrynexus/lib/ui/browser')), '..', 'templates', 'html', 'default', '+game.css'), 'utf8');
assert(/className\s*=\s*["']face-img["']/.test(browserUiSource), 'field note check: bundled DendryNexus browser UI should emit scene portraits as .face-img');
assert(/\.face-image\s*\{/.test(stockCssSource) && !/\.face-img\s*\{/.test(stockCssSource), 'field note check: bundled DendryNexus stock CSS should style .face-image but not .face-img');
const faceImagePatch = runtimePreview.patchRuntimeHtmlCompatibility(faceImageCssRoot);
assert(faceImagePatch.ok && faceImagePatch.patched, 'runtime preview should patch generated CSS for DendryNexus face-img output');
const faceImageCss = fs.readFileSync(path.join(faceImageCssRoot, 'game.css'), 'utf8');
assert(faceImageCss.includes('.face-img') && faceImageCss.includes('object-fit: contain'), 'runtime preview CSS patch should style .face-img without cropping event art');
const faceImageSecondPatch = runtimePreview.patchRuntimeHtmlCompatibility(faceImageCssRoot);
assert(faceImageSecondPatch.ok && !faceImageSecondPatch.patched, 'runtime preview CSS patch should be idempotent');

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
    {id: 'runtime_replace', title: 'Runtime Replace', type: 'event', tags: ['event'], path: 'source/scenes/status.scene.dry'},
    {id: 'demo_action_deck', title: 'Starter Deck', type: 'deck', path: 'source/scenes/decks/demo_action_deck.scene.dry'}
  ],
  edges: [{from: 'root', to: 'runtime_replace', label: 'debug jump'}],
  semantic: {
    events: [{id: 'runtime_replace', title: 'Runtime Replace'}],
    decks: [{id: 'demo_action_deck', title: 'Starter Deck', path: 'source/scenes/decks/demo_action_deck.scene.dry'}]
  }
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
const quickCss = fs.readFileSync(path.join(quickSession.paths.modifiedRoot, 'out', 'html', 'game.css'), 'utf8');
assert(quickCss.includes('.face-img'), 'quick runtime preview should patch copied HTML so event face images use the emitted runtime class');

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

const createScenePreview = runtimePreview.createRuntimePreview({
  projectRoot: sourceRoot,
  sessionsRoot: sessionRoot,
  plan: Object.assign({}, replacePlan, {
    id: 'runtime_created_scene_debug',
    draftKind: 'world_event',
    operations: [{
      id: 'create_scene',
      type: 'create_file',
      path: 'source/scenes/events/runtime_created_scene.scene.dry',
      content: [
        'title: Runtime Created Scene',
        'tags: event, demo',
        'view-if: year = 1930 and demo_pressure >= 1 and dnvp_leader = "Hergt" and runtime_created_scene_seen = 0',
        '',
        '= Runtime Created Scene',
        '',
        'Preview me.',
        '',
        '- @press: Invite the press.',
        '',
        '@press',
        'choose-if: demo_public_attention >= 1',
        '',
        'The press arrives.'
      ].join('\n') + '\n',
      safety: 'safe_apply',
      description: 'Create a scene that only exists in the modified preview.'
    }]
  }),
  projectIndex: debugProjectIndex,
  dryRun: false,
  buildRunner: runtimePreview.fakeBuildRunner({ok: true}),
  serverFactory: runtimePreview.fakeServerFactory(48004),
  now: () => new Date('2026-04-29T12:05:30.000Z')
});
assert(createScenePreview.ok, 'create-scene runtime preview should open: ' + JSON.stringify(createScenePreview));
assert(createScenePreview.debug.controls.scenes.some((scene) => scene.id === 'runtime_created_scene' && scene.title === 'Runtime Created Scene'), 'debug controls should include scenes created by the install plan');
const createdPreset = createScenePreview.debug.controls.focusPresets.find((preset) => preset.sceneId === 'runtime_created_scene');
assert(createdPreset, 'debug controls should include a focused entry preset for install-plan-created scenes');
assert(createdPreset.type === 'event', 'created world events should remain labelled as events even when Dendry uses is-card internally');
assert(createdPreset.variables.some((item) => item.name === 'year' && item.value === 1930), 'focused entry preset should set the scheduled year');
assert(createdPreset.variables.some((item) => item.name === 'demo_pressure' && item.value === 1), 'focused entry preset should set numeric condition gates');
assert(createdPreset.variables.some((item) => item.name === 'dnvp_leader' && item.value === 'Hergt' && item.valueType === 'string'), 'focused entry preset should support string condition gates');
assert(createdPreset.variables.some((item) => item.name === 'runtime_created_scene_seen' && item.value === 0 && item.valueType === 'booleanNumber'), 'focused entry preset should reset generated seen flags');
assert(createScenePreview.debug.controls.variables.some((item) => item.name === 'demo_public_attention'), 'debug controls should include variables referenced only by created scene choice conditions');
assert(fs.readFileSync(createScenePreview.comparePage.path, 'utf8').includes('data-debug-focus-preset="focus_runtime_created_scene"'), 'compare page should render focused entry buttons');
assert(debugBridge.bridgeScript({controls: createScenePreview.debug.controls}).includes('applyFocusPreset'), 'preview bridge should expose an atomic focused-entry command');
assert(debugBridge.bridgeScript({controls: createScenePreview.debug.controls}).includes('type==="string"'), 'preview bridge should accept string-valued condition presets');

const createCardPreview = runtimePreview.createRuntimePreview({
  projectRoot: sourceRoot,
  sessionsRoot: sessionRoot,
  plan: Object.assign({}, replacePlan, {
    id: 'runtime_created_card_debug',
    draftKind: 'card',
    operations: [
      {
        id: 'create_scene',
        type: 'create_file',
        path: 'source/scenes/cards/runtime_created_card.scene.dry',
        content: [
          'title: Runtime Created Card',
          'new-page: true',
          'is-card: true',
          'tags: runtime_card',
          'view-if: demo_pressure >= 1',
          '',
          '= Runtime Created Card',
          '',
          'Preview me from the deck.',
          '',
          '- @advance: Advance',
          '- @hold: Hold',
          '',
          '@advance',
          'on-arrival: {!',
          'Q.demo_public_attention += 1;',
          '!}',
          'go-to: main',
          '',
          'The card advances.',
          '',
          '@hold',
          'go-to: main',
          '',
          'The card holds.'
        ].join('\n') + '\n',
        sceneKind: 'card',
        safety: 'safe_apply',
        description: 'Create a card that only exists in the modified preview.'
      },
      {
        id: 'card_deck_tag_route',
        type: 'insert_text',
        path: 'source/scenes/decks/demo_action_deck.scene.dry',
        line: 4,
        anchorText: '- #demo_action',
        position: 'after',
        content: '- #runtime_card\n',
        dedupeSearch: '- #runtime_card',
        safety: 'guarded_apply',
        kind: 'deck_tag_route',
        description: 'Wire the generated card into the source-backed deck.'
      }
    ]
  }),
  projectIndex: debugProjectIndex,
  dryRun: false,
  buildRunner: runtimePreview.fakeBuildRunner({ok: true}),
  serverFactory: runtimePreview.fakeServerFactory(48005),
  now: () => new Date('2026-04-29T12:05:45.000Z')
});
assert(createCardPreview.ok, 'create-card runtime preview should open: ' + JSON.stringify(createCardPreview));
const createdCardPreset = createCardPreview.debug.controls.focusPresets.find((preset) => preset.sceneId === 'runtime_created_card');
assert(createdCardPreset && createdCardPreset.type === 'card', 'created cards should get a direct focused entry preset');
assert(createdCardPreset.variables.some((item) => item.name === 'demo_pressure' && item.value === 1), 'card direct preset should set view-if gates');
const cardDeckPreset = createCardPreview.debug.controls.focusPresets.find((preset) => preset.id === 'focus_runtime_created_card_via_demo_action_deck');
assert(cardDeckPreset, 'created card previews should include the deck that received the card route');
assert(cardDeckPreset.sceneId === 'demo_action_deck' && cardDeckPreset.type === 'deck', 'card lane preset should open the source-backed deck');
assert(cardDeckPreset.variables.some((item) => item.name === 'demo_pressure' && item.value === 1), 'card lane preset should reuse the card view-if gates');
assert(fs.readFileSync(createCardPreview.comparePage.path, 'utf8').includes('data-debug-focus-preset="focus_runtime_created_card_via_demo_action_deck"'), 'compare page should render deck focused-entry buttons for created cards');

const modifiedOnlySession = runtimePreview.createModifiedRuntimePreview({
  projectRoot: sourceRoot,
  sessionsRoot: sessionRoot,
  plan: replacePlan,
  dryRun: false,
  buildRunner: htmlBuildRunner('modified-only html build runner'),
  serverFactory: runtimePreview.fakeServerFactory(48003),
  now: () => new Date('2026-04-29T12:06:00.000Z')
});
assert(modifiedOnlySession.ok, 'createModifiedRuntimePreview should succeed with only the modified lane: ' + JSON.stringify(modifiedOnlySession));
assert(modifiedOnlySession.modifiedBuild && modifiedOnlySession.modifiedBuild.command === 'modified-only html build runner', 'modified-only preview should build the modified lane');
assert(!modifiedOnlySession.baselineBuild, 'modified-only preview should not build a baseline lane');
assert(!modifiedOnlySession.paths.baselineRoot, 'modified-only preview should not create a baseline project copy');
assert(!modifiedOnlySession.compareUrl, 'modified-only preview should not expose a compare URL');
assert(modifiedOnlySession.modifiedUrl.includes('/modified/out/html/'), 'modified-only preview should expose the modified runtime URL');
assert(!modifiedOnlySession.timings.stages.some((item) => item.stage === 'build_baseline'), 'modified-only preview timings should omit baseline build work');

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
const snapshotResult = runtimePreview.recordRuntimeSnapshot(realBuildSession.paths.root, {
  document: {readyState: 'complete', bodyPresent: true, title: 'Runtime Replace'},
  state: {exportable: true, sceneId: 'runtime_replace', qualityCount: 2},
  regions: [
    {selector: '#content', role: 'content', found: true, visible: true, text: 'Modified label', samples: [{selector: '#content p', role: 'content', tag: 'p', text: 'Modified label', visible: true}]},
    {selector: 'ul.choices', role: 'choices', found: true, visible: true, text: 'Next', samples: [{selector: 'ul.choices li', role: 'choices', tag: 'li', text: 'Next', visible: true}]}
  ],
  graphics: {d3Present: true, svgCount: 1, svgNonEmptyCount: 1, canvasCount: 0}
}, {
  runtimeSurface: {
    readiness: {status: 'ready', quickPreviewReady: true, missingDependencyCount: 0},
    regions: [
      {id: 'content', role: 'content', selector: '#content', label: 'Story content'},
      {id: 'choices', role: 'choices', selector: 'ul.choices', label: 'Choices'}
    ],
    diagnostics: []
  },
  sourceEvidence: {
    ready: true,
    scenes: [
      {
        id: 'runtime_replace',
        title: 'Runtime Replace',
        source: {path: 'source/scenes/status.scene.dry', startLine: 1},
        options: [{id: '@next', title: 'Next', source: {path: 'source/scenes/status.scene.dry', line: 2}}],
        sections: []
      }
    ],
    textCorpus: [
      {id: 'text-modified-label', role: 'body', text: 'Modified label', sceneId: 'runtime_replace', source: {path: 'source/scenes/status.scene.dry', line: 1}, editability: 'text_proposal'},
      {id: 'text-next', role: 'option_label', text: 'Next', sceneId: 'runtime_replace', source: {path: 'source/scenes/status.scene.dry', line: 2}, editability: 'draft_extractable'}
    ],
    assets: []
  }
}, () => new Date('2026-04-29T15:05:00.000Z'));
assert(snapshotResult.ok, 'recordRuntimeSnapshot should succeed: ' + JSON.stringify(snapshotResult));
const metadataAfterSnapshot = JSON.parse(fs.readFileSync(path.join(realBuildSession.paths.root, 'metadata.json'), 'utf8'));
assert(metadataAfterSnapshot.runtimeSnapshot.status === 'ready', 'metadata should store normalized runtime snapshot status');
assert(metadataAfterSnapshot.runtimeSnapshot.summary.visibleRegionCount === 2, 'metadata should store runtime snapshot region summary');
assert(metadataAfterSnapshot.runtimeDomMap.status === 'ready', 'metadata should store normalized runtime DOM source map status');
assert(metadataAfterSnapshot.runtimeDomMap.summary.sourceBackedCount === 2, 'metadata should store runtime DOM source map summary');
assert(metadataAfterSnapshot.runtimeSnapshot.runtimeDomMap.summary.mappedCount === 2, 'runtime snapshot should carry the normalized DOM source map');
assert(metadataAfterSnapshot.runtimeSnapshotUpdatedAt === '2026-04-29T15:05:00.000Z', 'metadata should store runtime snapshot update timestamp');

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
