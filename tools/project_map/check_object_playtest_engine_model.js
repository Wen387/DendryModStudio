#!/usr/bin/env node
'use strict';

// Guards the real-engine play-test model (object_playtest_engine_model.js):
// it must compile the bundled starter demo with the vendored DendryEngine,
// start a play-test at an authored event, honour true engine semantics
// (condition-gated choices, inline conditional text, on-arrival effect deltas,
// cross-scene continuation), replay a committed choice from exportable state,
// reject invalid/unavailable choices, and reflect unsaved edits supplied as
// in-memory .dry overrides. Anchored to the same demo_campaign_pressure event
// the approximate simulator check uses so both phases stay comparable.

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const PROJECT_ROOT = path.join(ROOT, 'templates', 'starter-demo');
const SOURCE_ROOT = path.join(PROJECT_ROOT, 'source');
const CAMPAIGN_FILE = 'scenes/events/demo_campaign_pressure.scene.dry';
const SCENE = 'demo_campaign_pressure';

const model = require('./object_playtest_engine_model.js');
const host = require('./desktop/object_playtest_host.js');
const {fail, assert} = require('./check_harness.js');

function collectDryFiles(sourceRoot, current, out) {
  const dir = current || sourceRoot;
  const result = out || [];
  fs.readdirSync(dir).forEach((name) => {
    const filePath = path.join(dir, name);
    if (fs.statSync(filePath).isDirectory()) {
      collectDryFiles(sourceRoot, filePath, result);
    } else if (/\.dry$/.test(name)) {
      result.push({
        name: path.relative(sourceRoot, filePath).replace(/\\/g, '/'),
        contents: fs.readFileSync(filePath, 'utf8')
      });
    }
  });
  return result;
}

function plainText(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ');
}

function optionById(view, id) {
  return (view.choices || []).filter((choice) => choice.id === SCENE + '.' + id)[0] || null;
}

// Electron's IPC serialises replies with structured clone. structuredClone
// throws on the first non-cloneable value (e.g. a function), exactly as the IPC
// hop does -- so it is the faithful gate for "would this reply cross the wire?".
function assertCloneable(value, message) {
  try {
    structuredClone(value);
  } catch (err) {
    fail(message + ' -- ' + String((err && err.message) || err));
  }
}

// A compiled conditional/styled title is the canonical clone hazard: confirm
// the raw title really does carry a function so the coercion checks below are
// not vacuous, then return the compiled game for the IPC-safety assertions.
const COND_FILES = [
  {name: 'info.dry', contents: 'title: T\nauthor: x\n'},
  {
    name: 'scenes/root.scene.dry',
    contents: 'title: [? if zx > 0: Hot ?][? if zx <= 0: Cold ?]\n\nConditional-title body.\n'
  }
];

function rawTitleIsCloneable(game) {
  try {
    structuredClone(game.scenes.root.title);
    return true;
  } catch (err) {
    return false;
  }
}

async function main() {
  assert(model.isSupported(), 'real-engine play-test model should report supported when dendrynexus is present');

  const baseFiles = collectDryFiles(SOURCE_ROOT);
  assert(baseFiles.length > 0, 'starter demo should ship .dry sources');

  const game = await model.compileGameFromDryFiles(baseFiles);
  assert(game && game.scenes, 'compileGameFromDryFiles should return a game with scenes');
  assert(game.scenes[SCENE], 'compiled game should contain the demo_campaign_pressure event');
  assert(game.scenes.demo_case_hearing, 'compiled game should contain the demo_case_hearing continuation');

  // ---- start at the event with no spare capacity: gated choices + conditional text ----
  const low = model.start({game: game, entrySceneId: SCENE, startState: {demo_resources: 0}});
  assert(low.ok, 'starting a play-test at the event should succeed', low);
  assert(low.view.sceneId === SCENE, 'play-test should land on the requested event scene');
  assert(low.state && low.state.sceneId === SCENE, 'start should return exportable state at the event');
  assert(plainText(low.view.contentHtml).indexOf('Civic Reform Campaign') !== -1,
    'rendered content should include the event heading', low.view.contentHtml);
  assert(plainText(low.view.contentHtml).indexOf('short on capacity') !== -1,
    'an inline conditional should show its body while demo_resources < 1');

  const openLow = optionById(low.view, 'open_hearing');
  assert(openLow && openLow.canChoose === false,
    'open_hearing should be unavailable while demo_resources is 0', low.view.choices);
  const quietLow = optionById(low.view, 'quiet_briefing');
  assert(quietLow && quietLow.canChoose === true, 'quiet_briefing should always be available');

  // ---- start with capacity: the gate opens and the conditional text drops ----
  const high = model.start({game: game, entrySceneId: SCENE, startState: {demo_resources: 1}});
  assert(high.ok, 'starting with capacity should succeed');
  assert(plainText(high.view.contentHtml).indexOf('short on capacity') === -1,
    'the short-on-capacity conditional should drop once demo_resources reaches 1');
  const openHigh = optionById(high.view, 'open_hearing');
  assert(openHigh && openHigh.canChoose === true,
    'open_hearing should become available once demo_resources reaches 1');

  // ---- commit the choice from exportable state: effect deltas + continuation ----
  const after = model.advance({game: game, state: high.state, choiceIndex: openHigh.index});
  assert(after.ok, 'advancing through open_hearing should succeed', after);
  assert(after.view.sceneId === 'demo_case_hearing',
    'open_hearing should continue into the demo_case_hearing scene', after.view.sceneId);
  assert(after.view.qualities.demo_resources === 0,
    'open_hearing should spend a resource (demo_resources 1 -> 0)', after.view.qualities);
  assert(after.view.qualities.demo_case_strength === 2,
    'open_hearing should build the case (demo_case_strength 0 -> 2)', after.view.qualities);
  assert(plainText(after.view.contentHtml).trim().length > 0,
    'the continuation scene should render content');
  assert((after.view.choices || []).some((choice) => choice.id === 'demo_case_hearing.force_vote'),
    'the continuation scene should expose its own choices');

  // ---- invalid / unavailable choices are rejected, not guessed ----
  const outOfRange = model.advance({game: game, state: high.state, choiceIndex: 99});
  assert(!outOfRange.ok && outOfRange.error === 'bad-choice-index',
    'an out-of-range choice index should be rejected');
  const gated = model.advance({game: game, state: low.state, choiceIndex: openLow.index});
  assert(!gated.ok && gated.error === 'choice-unavailable',
    'committing a condition-gated choice should be rejected as unavailable');
  const unknown = model.start({game: game, entrySceneId: 'no_such_scene'});
  assert(!unknown.ok && unknown.error === 'unknown-scene',
    'starting at an unknown scene should report unknown-scene');

  // ---- applyFileOverrides merges replacements and additions ----
  const merged = model.applyFileOverrides(
    [{name: 'a.dry', contents: 'old'}, {name: 'b.dry', contents: 'keep'}],
    {'a.dry': 'new', 'c.dry': 'added'}
  );
  const mergedByName = {};
  merged.forEach((file) => {
    mergedByName[file.name] = file.contents;
  });
  assert(mergedByName['a.dry'] === 'new', 'applyFileOverrides should replace an existing file');
  assert(mergedByName['b.dry'] === 'keep', 'applyFileOverrides should preserve untouched files');
  assert(mergedByName['c.dry'] === 'added', 'applyFileOverrides should add a new file');

  // ---- reflect unsaved edits: an in-memory override of the event source shows live ----
  const original = baseFiles.filter((file) => file.name === CAMPAIGN_FILE)[0];
  assert(original, 'the campaign event source file should be present');
  assert(original.contents.indexOf('= Civic Reform Campaign') !== -1,
    'the campaign source should contain the heading we patch');
  const editedContents = original.contents.replace(
    '= Civic Reform Campaign',
    '= Civic Reform Campaign EDITED_MARKER'
  );
  const editedFiles = model.applyFileOverrides(baseFiles, {[CAMPAIGN_FILE]: editedContents});
  const editedGame = await model.compileGameFromDryFiles(editedFiles);
  const editedStart = model.start({game: editedGame, entrySceneId: SCENE, startState: {demo_resources: 1}});
  assert(editedStart.ok, 'a play-test on the edited game should start');
  assert(plainText(editedStart.view.contentHtml).indexOf('EDITED_MARKER') !== -1,
    'an unsaved edit to the event source should appear in the real-engine play-test');

  // ---- host: read a real project root, compile (cached), start + advance ----
  assert(host.isSupported(), 'the play-test host should report supported when dendrynexus is present');
  host._clearCache();
  const hostStart = await host.start({projectRoot: PROJECT_ROOT, entrySceneId: SCENE, startState: {demo_resources: 1}});
  assert(hostStart.ok, 'host.start should compile the on-disk project and start a play-test', hostStart);
  assert(hostStart.view.sceneId === SCENE, 'host.start should land on the requested scene');
  assert(typeof hostStart.token === 'string' && hostStart.token.length > 0,
    'host.start should return a compiled-game token for cheap follow-up interactions');
  assert(hostStart.edited === false, 'host.start without a plan should report the saved (unedited) source');
  const hostOpen = optionById(hostStart.view, 'open_hearing');
  assert(hostOpen && hostOpen.canChoose === true, 'host.start should surface the available open_hearing option');

  // ---- host: surface the selectable entry scenes for the play-test picker ----
  assert(Array.isArray(hostStart.scenes), 'host.start should return a list of selectable entry scenes', hostStart);
  const sceneIds = (hostStart.scenes || []).map((scene) => scene.id);
  assert(sceneIds.indexOf(SCENE) !== -1, 'the entry-scene list should include the started scene');
  assert(sceneIds.indexOf('demo_case_hearing') !== -1, 'the entry-scene list should include other authored scenes');
  assert(sceneIds.indexOf('root') !== -1,
    'the entry-scene list should include root so authors can play from the beginning');
  assert(sceneIds.every((id) => id.indexOf('.') === -1),
    'the entry-scene list should exclude generated option sub-scenes (dotted ids)');
  assert(sceneIds.indexOf('jumpScene') === -1,
    'the entry-scene list should exclude untitled engine navigation scenes');
  const startedScene = (hostStart.scenes || []).filter((scene) => scene.id === SCENE)[0];
  assert(startedScene && startedScene.title, 'each listed scene should carry its title for the picker');

  const hostAdvance = await host.advance({token: hostStart.token, state: hostStart.state, choiceIndex: hostOpen.index});
  assert(hostAdvance.ok, 'host.advance should reuse the cached game by token', hostAdvance);
  assert(hostAdvance.view.sceneId === 'demo_case_hearing', 'host.advance should continue into demo_case_hearing');
  assert(hostAdvance.view.qualities.demo_case_strength === 2,
    'host.advance should apply the real effect deltas (demo_case_strength 0 -> 2)');
  assert(hostAdvance.token === hostStart.token, 'host.advance should reuse the same compiled-game token');

  host._clearCache();
  const hostRecovered = await host.advance({projectRoot: PROJECT_ROOT, state: hostStart.state, choiceIndex: hostOpen.index});
  assert(hostRecovered.ok && hostRecovered.view.sceneId === 'demo_case_hearing',
    'host.advance should recover from a cache miss by recompiling from the project root');

  // ---- structured-clone safety: function-bearing compiled titles must survive the IPC hop ----
  // A conditional/styled title compiles to a content structure carrying predicate
  // FUNCTIONS. Electron's IPC serialises replies with structured clone, which
  // rejects functions ("An object could not be cloned"); the desktop play-test
  // silently failed on any mod with such a title. The node checks above call the
  // model/host directly (no serialisation) so never caught it -- these assertions
  // exercise the coercion (model) and the toCloneable net (host.handle) that fix it.
  const condGame = await model.compileGameFromDryFiles(COND_FILES);
  assert(!rawTitleIsCloneable(condGame),
    'a conditional title should compile to a function-bearing structure (the real clone hazard)');
  const condStart = model.start({game: condGame, entrySceneId: 'root'});
  assert(condStart.ok, 'a play-test on a conditional-title scene should start', condStart);
  assert(condStart.view.title === null || typeof condStart.view.title === 'string',
    'view.title must be coerced to a plain string or null, never a function-bearing structure',
    condStart.view.title);
  assert(plainText(condStart.view.contentHtml).indexOf('Conditional-title body') !== -1,
    'the scene body should still render even though the styled title is dropped');
  assertCloneable(condStart, 'model.start reply on a conditional-title scene must be structured-clone safe');

  // ---- host.handle (the real IPC entry point) must always return a clone-safe reply ----
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-playtest-check-'));
  try {
    const tmpScenes = path.join(tmpRoot, 'source', 'scenes');
    fs.mkdirSync(tmpScenes, {recursive: true});
    COND_FILES.forEach((file) => {
      const dest = path.join(tmpRoot, 'source', file.name);
      fs.mkdirSync(path.dirname(dest), {recursive: true});
      fs.writeFileSync(dest, file.contents);
    });
    host._clearCache();
    const handledStart = await host.handle({action: 'start', projectRoot: tmpRoot, entrySceneId: 'root'});
    assert(handledStart.ok, 'host.handle should start a play-test through the IPC entry point', handledStart);
    assertCloneable(handledStart,
      'host.handle reply must be structured-clone safe even when scenes have function-bearing titles');
    assert(handledStart.view.title === null || typeof handledStart.view.title === 'string',
      'host.handle must not leak a function-bearing view title across IPC', handledStart.view.title);
    assert(Array.isArray(handledStart.scenes) &&
      handledStart.scenes.every((scene) => scene.title === null || typeof scene.title === 'string'),
      'the entry-scene list must carry plain-string (or null) titles only', handledStart.scenes);
  } finally {
    fs.rmSync(tmpRoot, {recursive: true, force: true});
  }

  // ---- host.handle dispatches 'advance' and that reply is clone-safe too ----
  host._clearCache();
  const handledSeed = await host.handle({action: 'start', projectRoot: PROJECT_ROOT, entrySceneId: SCENE, startState: {demo_resources: 1}});
  assert(handledSeed.ok, 'host.handle start should seed an advance', handledSeed);
  const handledOpen = optionById(handledSeed.view, 'open_hearing');
  const handledAdvance = await host.handle({
    action: 'advance',
    token: handledSeed.token,
    state: handledSeed.state,
    choiceIndex: handledOpen.index
  });
  assert(handledAdvance.ok && handledAdvance.view.sceneId === 'demo_case_hearing',
    'host.handle should dispatch advance and continue into demo_case_hearing', handledAdvance);
  assertCloneable(handledAdvance, 'host.handle advance reply must be structured-clone safe');

  process.stdout.write(JSON.stringify({
    ok: true,
    scenes: Object.keys(game.scenes).length,
    startScene: low.view.sceneId,
    continuation: after.view.sceneId,
    hostToken: hostStart.token.slice(0, 12)
  }, null, 2) + '\n');
}

main().catch((err) => {
  fail(err && err.stack ? err.stack : String(err));
});
