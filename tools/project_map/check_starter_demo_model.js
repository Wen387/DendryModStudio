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
const {pythonCommand} = require('./check_python_command.js');

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
    'source/scenes/main.scene.dry',
    'source/scenes/status.scene.dry',
    'source/scenes/decks/demo_action_deck.scene.dry',
    'source/scenes/cards/demo_action_card.scene.dry',
    'source/scenes/advisors/demo_advisor.scene.dry',
    'source/scenes/demo_opening.scene.dry',
    'source/scenes/post_event.scene.dry',
    'source/qdisplays/qdemo_level.qdisplay.dry',
    'source/qualities/demo_resources.quality.dry',
    'source/qualities/demo_advisor_trust.quality.dry',
    'source/qualities/demo_card_progress.quality.dry',
    'project-index.json',
    'project-index-excerpts.json'
  ].forEach((relativePath) => {
    assert(fs.existsSync(path.join(TEMPLATE_ROOT, relativePath)), 'starter demo should include ' + relativePath);
  });

  const info = read('source/info.dry');
  const packageJson = JSON.parse(read('package.json'));
  const bundledProjectIndex = JSON.parse(read('project-index.json'));
  const bundledProjectIndexExcerpts = JSON.parse(read('project-index-excerpts.json'));
  const root = read('source/scenes/root.scene.dry');
  const status = read('source/scenes/status.scene.dry');
  const main = read('source/scenes/main.scene.dry');
  const deck = read('source/scenes/decks/demo_action_deck.scene.dry');
  const actionCard = read('source/scenes/cards/demo_action_card.scene.dry');
  const advisor = read('source/scenes/advisors/demo_advisor.scene.dry');
  const opening = read('source/scenes/demo_opening.scene.dry');
  const postEvent = read('source/scenes/post_event.scene.dry');

  assert(info.includes('Dendry Mod Studio Starter Demo'), 'starter demo should have a player-facing title');
  assert(packageJson.private === true, 'starter demo package should be private');
  assert(packageJson.dependencies && packageJson.dependencies.dendrynexus, 'starter demo package should signal DendryNexus runtime dependency');
  assert(root.includes('demo_support') && root.includes('demo_conflict'), 'starter demo root should initialize demo variables');
  assert(root.includes('demo_resources') && root.includes('demo_advisor_trust'), 'starter demo root should initialize whiteboard card/advisor variables');
  assert(root.includes('// ====== U. EVENT SEEN FLAGS ======'), 'starter demo root should expose world-event install anchor');
  assert(root.includes('@main: Open the workspace hand'), 'starter demo root should link to the whiteboard hand');
  assert(root.includes('@demo_opening.demo_status'), 'starter demo root should link to the cross-scene status section with a qualified id');
  assert(root.includes('@demo_opening.support_followup'), 'starter demo root should link to the cross-scene follow-up section with a qualified id');
  assert(status.includes('Campaign Status'), 'starter demo should include a status sidebar scene for the default Dendry HTML shell');
  assert(status.includes('demo_support') && status.includes('demo_conflict'), 'starter demo status sidebar should reflect demo variables');
  assert(status.includes('qdemo_level') && status.includes('demo_card_progress'), 'starter demo status sidebar should show qdisplay-backed whiteboard variables');
  assert(main.includes('is-hand: true') && main.includes('@demo_action_deck') && main.includes('#demo_advisor'), 'starter demo should include a hand with deck and advisor lanes');
  assert(deck.includes('is-deck: true') && deck.includes('#demo_action'), 'starter demo should include an action deck');
  assert(actionCard.includes('is-card: true') && actionCard.includes('Q.demo_card_progress'), 'starter demo should include a minimal action card');
  assert(advisor.includes('is-pinned-card: true') && advisor.includes('Q.demo_advisor_trust'), 'starter demo should include a minimal advisor-like pinned card');
  assert(opening.includes('tags: event'), 'starter demo should include an event-like scene');
  assert(opening.includes('Option result text'), 'starter demo should demonstrate option result text');
  assert(opening.includes('view-if: demo_support > 0'), 'starter demo should demonstrate a condition');
  assert(opening.includes('Q.demo_support = (Q.demo_support || 0) + 1;'), 'starter demo should demonstrate an effect');
  assert(postEvent.includes('if (Q.demo_support === undefined)'), 'starter demo should include save migration guards');
  assert(postEvent.includes('if (Q.demo_resources === undefined)'), 'starter demo should migrate whiteboard card/advisor variables');
  assert(postEvent.includes('// Save compatibility: post_event split (post_event_news)'), 'starter demo should expose post_event install anchor');
  assert(bundledProjectIndex.project.root === '__STARTER_DEMO_TEMPLATE_ROOT__', 'starter demo cached ProjectIndex should not store a developer absolute path');
  assert(bundledProjectIndexExcerpts.project.root === '__STARTER_DEMO_TEMPLATE_ROOT__', 'starter demo cached excerpt ProjectIndex should not store a developer absolute path');

  const preparedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_starter_demo_model_'));
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_starter_demo_index_'));
  const prepared = core.prepareStarterDemo({
    desktopDir: DESKTOP_DIR,
    workspaceRoot: preparedRoot
  });
  assert(prepared.ok, 'desktop core should prepare starter demo copy');
  assert(prepared.root.startsWith(preparedRoot), 'prepared starter demo should be a writable copy');
  assert(fs.existsSync(path.join(prepared.root, 'source', 'info.dry')), 'prepared starter demo should contain source/info.dry');
  assert(fs.existsSync(path.join(prepared.root, 'package.json')), 'prepared starter demo should contain package.json for Runtime Preview builds');

  const cachedIndex = core.loadStarterDemoIndex({
    desktopDir: DESKTOP_DIR,
    prepared,
    includeExcerpts: false
  });
  assert(cachedIndex.ok, 'starter demo should open from the bundled ProjectIndex cache');
  assert(cachedIndex.fromCache === true, 'starter demo cached ProjectIndex should report cache usage');
  assert(cachedIndex.root === prepared.root, 'starter demo cached ProjectIndex should use the writable template copy as root');
  assert(cachedIndex.index.project.root === prepared.root, 'starter demo cached ProjectIndex should rewrite project.root');
  assert(cachedIndex.projectName === 'Dendry Mod Studio Starter Demo', 'starter demo cached ProjectIndex should keep template title');
  assert(cachedIndex.summary.sceneCount >= 3, 'starter demo cached ProjectIndex should expose multiple scenes');
  assert(cachedIndex.summary.eventCount >= 1, 'starter demo cached ProjectIndex should expose one event-like scene');
  assert(cachedIndex.summary.cardCount >= 1, 'starter demo cached ProjectIndex should expose one action card');
  assert(cachedIndex.index.variables.some((item) => item.name === 'demo_support'), 'starter demo cached ProjectIndex should include demo_support variable');

  const cachedExcerpts = core.loadStarterDemoIndex({
    desktopDir: DESKTOP_DIR,
    prepared,
    includeExcerpts: true
  });
  assert(cachedExcerpts.ok, 'starter demo should open from the bundled excerpt ProjectIndex cache');
  assert(cachedExcerpts.includeExcerpts === true, 'starter demo excerpt cache should report excerpts');
  assert(JSON.stringify(cachedExcerpts.index).includes('"excerpt"'), 'starter demo excerpt cache should include source excerpts');

  fs.rmSync(path.join(prepared.root, 'package.json'), {force: true});
  fs.rmSync(path.join(prepared.root, 'source', 'scenes', 'main.scene.dry'), {force: true});
  fs.rmSync(path.join(prepared.root, 'source', 'scenes', 'cards'), {recursive: true, force: true});
  fs.rmSync(path.join(prepared.root, 'source', 'scenes', 'advisors'), {recursive: true, force: true});
  fs.rmSync(path.join(prepared.root, 'source', 'scenes', 'decks'), {recursive: true, force: true});
  fs.rmSync(path.join(prepared.root, 'source', 'qualities'), {recursive: true, force: true});
  fs.rmSync(path.join(prepared.root, 'source', 'qdisplays'), {recursive: true, force: true});
  fs.writeFileSync(
    path.join(prepared.root, 'source', 'scenes', 'root.scene.dry'),
    root.replace('@demo_opening.demo_status', '@demo_status')
      .replace('@demo_opening.support_followup', '@support_followup')
      .replace('- @main: Open the workspace hand\n', '')
      .replace('if (Q.demo_resources === undefined) { Q.demo_resources = 2; }\n', '')
      .replace('if (Q.demo_advisor_trust === undefined) { Q.demo_advisor_trust = 0; }\n', '')
      .replace('if (Q.demo_card_progress === undefined) { Q.demo_card_progress = 0; }\n', ''),
    'utf8'
  );
  const repaired = core.prepareStarterDemo({
    desktopDir: DESKTOP_DIR,
    workspaceRoot: preparedRoot
  });
  assert(repaired.ok && repaired.reused === true, 'desktop core should reopen an existing starter demo workspace');
  assert(fs.existsSync(path.join(repaired.root, 'package.json')), 'desktop core should repair old starter demo copies missing package.json');
  assert(fs.existsSync(path.join(repaired.root, 'source', 'scenes', 'main.scene.dry')), 'desktop core should repair old starter demo copies missing the hand scene');
  assert(fs.existsSync(path.join(repaired.root, 'source', 'scenes', 'cards', 'demo_action_card.scene.dry')), 'desktop core should repair old starter demo copies missing the action card');
  assert(fs.existsSync(path.join(repaired.root, 'source', 'scenes', 'advisors', 'demo_advisor.scene.dry')), 'desktop core should repair old starter demo copies missing the advisor card');
  assert(fs.existsSync(path.join(repaired.root, 'source', 'qdisplays', 'qdemo_level.qdisplay.dry')), 'desktop core should repair old starter demo copies missing qdisplays');
  const repairedRoot = fs.readFileSync(path.join(repaired.root, 'source', 'scenes', 'root.scene.dry'), 'utf8');
  assert(repairedRoot.includes('@demo_opening.demo_status'), 'desktop core should repair old starter demo status links');
  assert(repairedRoot.includes('@demo_opening.support_followup'), 'desktop core should repair old starter demo follow-up links');
  assert(repairedRoot.includes('@main: Open the workspace hand'), 'desktop core should repair old starter demo hand route');
  assert(repairedRoot.includes('Q.demo_resources === undefined'), 'desktop core should repair old starter demo whiteboard variables');

  const buildCommand = runtimePreview.resolveBuildCommand(prepared.root);
  assert(buildCommand.ok, 'starter demo should resolve a Runtime Preview build command: ' + JSON.stringify(buildCommand));

  const indexed = await core.buildProjectIndex({
    root: prepared.root,
    outDir: scratchRoot,
    includeExcerpts: false,
    python: pythonCommand(),
    desktopDir: DESKTOP_DIR
  });
  assert(indexed.ok, 'starter demo should build a ProjectIndex: ' + JSON.stringify(indexed.error || null));
  assert(indexed.projectName === 'Dendry Mod Studio Starter Demo', 'starter demo ProjectIndex should keep the template title');
  assert(indexed.summary.sceneCount >= 3, 'starter demo should expose multiple scenes');
  assert(indexed.summary.eventCount >= 1, 'starter demo should expose one event-like scene');
  assert(indexed.summary.cardCount >= 1, 'starter demo should expose one action card');
  assert(indexed.summary.handCount >= 1, 'starter demo should expose one hand scene');
  assert(indexed.summary.deckCount >= 1, 'starter demo should expose one deck scene');
  assert(indexed.summary.pinnedCardCount >= 1, 'starter demo should expose one advisor-like pinned card');
  assert(indexed.index.variables.some((item) => item.name === 'demo_support'), 'starter demo ProjectIndex should include demo_support variable');
  assert(indexed.index.variables.some((item) => item.name === 'demo_resources'), 'starter demo ProjectIndex should include demo_resources variable');

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
