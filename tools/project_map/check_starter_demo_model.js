#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const DESKTOP_DIR = path.join(ROOT, 'desktop');
const TEMPLATE_ROOT = path.join(ROOT, 'templates', 'starter-demo');
const core = require('./desktop/studio_core.js');
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

function read(relativePath) {
  return fs.readFileSync(path.join(TEMPLATE_ROOT, relativePath), 'utf8');
}

async function main() {
  [
    'README.md',
    'package.json',
    'source/info.dry',
    'source/scenes/root.scene.dry',
    'source/scenes/status.scene.dry',
    'source/scenes/demo_opening.scene.dry',
    'source/scenes/post_event.scene.dry'
  ].forEach((relativePath) => {
    assert(fs.existsSync(path.join(TEMPLATE_ROOT, relativePath)), 'starter demo should include ' + relativePath);
  });

  const info = read('source/info.dry');
  const packageJson = JSON.parse(read('package.json'));
  const root = read('source/scenes/root.scene.dry');
  const status = read('source/scenes/status.scene.dry');
  const opening = read('source/scenes/demo_opening.scene.dry');
  const postEvent = read('source/scenes/post_event.scene.dry');

  assert(info.includes('Dendry Mod Studio Starter Demo'), 'starter demo should have a player-facing title');
  assert(packageJson.private === true, 'starter demo package should be private');
  assert(packageJson.dependencies && packageJson.dependencies.dendrynexus, 'starter demo package should signal DendryNexus runtime dependency');
  assert(root.includes('demo_support') && root.includes('demo_conflict'), 'starter demo root should initialize demo variables');
  assert(root.includes('// ====== U. EVENT SEEN FLAGS ======'), 'starter demo root should expose world-event install anchor');
  assert(root.includes('@.demo_opening.demo_status'), 'starter demo root should link to the cross-scene status section with an absolute id');
  assert(root.includes('@.demo_opening.support_followup'), 'starter demo root should link to the cross-scene follow-up section with an absolute id');
  assert(status.includes('Campaign Status'), 'starter demo should include a status sidebar scene for the default Dendry HTML shell');
  assert(status.includes('demo_support') && status.includes('demo_conflict'), 'starter demo status sidebar should reflect demo variables');
  assert(opening.includes('tags: event'), 'starter demo should include an event-like scene');
  assert(opening.includes('Option result text'), 'starter demo should demonstrate option result text');
  assert(opening.includes('view-if: demo_support > 0'), 'starter demo should demonstrate a condition');
  assert(opening.includes('Q.demo_support = (Q.demo_support || 0) + 1;'), 'starter demo should demonstrate an effect');
  assert(postEvent.includes('if (Q.demo_support === undefined)'), 'starter demo should include save migration guards');
  assert(postEvent.includes('// Save compatibility: post_event split (post_event_news)'), 'starter demo should expose post_event install anchor');

  const preparedRoot = path.join(os.tmpdir(), 'dendry_starter_demo_model_' + process.pid);
  const scratchRoot = path.join(os.tmpdir(), 'dendry_starter_demo_index_' + process.pid);
  const prepared = core.prepareStarterDemo({
    desktopDir: DESKTOP_DIR,
    workspaceRoot: preparedRoot
  });
  assert(prepared.ok, 'desktop core should prepare starter demo copy');
  assert(prepared.root.startsWith(preparedRoot), 'prepared starter demo should be a writable copy');
  assert(fs.existsSync(path.join(prepared.root, 'source', 'info.dry')), 'prepared starter demo should contain source/info.dry');
  assert(fs.existsSync(path.join(prepared.root, 'package.json')), 'prepared starter demo should contain package.json for Runtime Preview builds');

  fs.rmSync(path.join(prepared.root, 'package.json'), {force: true});
  fs.writeFileSync(
    path.join(prepared.root, 'source', 'scenes', 'root.scene.dry'),
    root.replace('@.demo_opening.demo_status', '@demo_status')
      .replace('@.demo_opening.support_followup', '@support_followup'),
    'utf8'
  );
  const repaired = core.prepareStarterDemo({
    desktopDir: DESKTOP_DIR,
    workspaceRoot: preparedRoot
  });
  assert(repaired.ok && repaired.reused === true, 'desktop core should reopen an existing starter demo workspace');
  assert(fs.existsSync(path.join(repaired.root, 'package.json')), 'desktop core should repair old starter demo copies missing package.json');
  const repairedRoot = fs.readFileSync(path.join(repaired.root, 'source', 'scenes', 'root.scene.dry'), 'utf8');
  assert(repairedRoot.includes('@.demo_opening.demo_status'), 'desktop core should repair old starter demo status links');
  assert(repairedRoot.includes('@.demo_opening.support_followup'), 'desktop core should repair old starter demo follow-up links');

  const buildCommand = runtimePreview.resolveBuildCommand(prepared.root);
  assert(buildCommand.ok, 'starter demo should resolve a Runtime Preview build command: ' + JSON.stringify(buildCommand));

  const indexed = await core.buildProjectIndex({
    root: prepared.root,
    outDir: scratchRoot,
    includeExcerpts: false,
    python: 'python3',
    desktopDir: DESKTOP_DIR
  });
  assert(indexed.ok, 'starter demo should build a ProjectIndex: ' + JSON.stringify(indexed.error || null));
  assert(indexed.projectName === 'Dendry Mod Studio Starter Demo', 'starter demo ProjectIndex should keep the template title');
  assert(indexed.summary.sceneCount >= 3, 'starter demo should expose multiple scenes');
  assert(indexed.summary.eventCount >= 1, 'starter demo should expose one event-like scene');
  assert(indexed.index.variables.some((item) => item.name === 'demo_support'), 'starter demo ProjectIndex should include demo_support variable');

  fs.rmSync(preparedRoot, {recursive: true, force: true});
  fs.rmSync(scratchRoot, {recursive: true, force: true});

  process.stdout.write(JSON.stringify({
    ok: true,
    templateRoot: TEMPLATE_ROOT,
    sceneCount: indexed.summary.sceneCount,
    eventCount: indexed.summary.eventCount
  }, null, 2) + '\n');
}

main().catch((err) => {
  fail(err && err.stack ? err.stack : String(err));
});
