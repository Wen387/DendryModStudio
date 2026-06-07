#!/usr/bin/env node
'use strict';

// Guards the approximate play-simulator model (viewer/object_play_simulator_model.js):
// it must gate options by their conditions, apply the safe "= += -=" effect
// subset with correct deltas, substitute state into player text, and report
// cross-scene continuation as a boundary. Driven against the bundled starter
// demo so the contract stays anchored to a real, parser-backed event.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TEMPLATE_ROOT = path.join(ROOT, 'templates', 'starter-demo');

const objectCanvasModel = require('./authoring/object_authoring_canvas_model.js');
const sim = require('./viewer/object_play_simulator_model.js');
const conditionModel = require('./authoring/predicate_condition_model.js');
const runtimeEval = require('./authoring/predicate_runtime_eval.js');

const {fail, assert} = require('./check_harness.js');

const inject = {conditionModel: conditionModel, runtimeEval: runtimeEval};

function hasDelta(delta, variable, from, to) {
  return (delta || []).some((entry) =>
    entry.variable === variable && entry.from === from && entry.to === to);
}

function main() {
  const bundledIndex = JSON.parse(fs.readFileSync(path.join(TEMPLATE_ROOT, 'project-index.json'), 'utf8'));
  const canvas = objectCanvasModel.buildExistingCanvas(bundledIndex, 'events', 'demo_campaign_pressure', {});
  assert(canvas.ok, 'campaign pressure event should open in Object Canvas');
  const body = canvas.eventBody;

  assert(sim.isSupported(body), 'an event with options should be play-simulatable');
  assert(!sim.isSupported({options: []}), 'an object without options should not be play-simulatable');

  // ---- variable discovery ----
  const variables = sim.collectVariables(body, inject);
  ['demo_resources', 'demo_support', 'demo_case_strength', 'demo_pressure'].forEach((name) => {
    assert(variables.indexOf(name) !== -1, 'play simulator should discover variable ' + name);
  });

  // ---- effect parsing + safe-subset application ----
  const parsed = sim.parseEffect('demo_resources -= 1');
  assert(parsed && parsed.variable === 'demo_resources' && parsed.op === '-=' && parsed.rhs === '1',
    'parseEffect should split a shorthand effect into variable/op/rhs');
  assert(sim.parseEffect('not an effect') === null, 'parseEffect should reject non-effect text');

  const applied = sim.applyEffects({demo_case_strength: 1}, [
    {expression: 'demo_case_strength += 2'},
    {expression: 'demo_flag = 1'},
    {expression: 'demo_other *= 3'}
  ], inject);
  assert(applied.state.demo_case_strength === 3, 'applyEffects should add with +=');
  assert(applied.state.demo_flag === 1, 'applyEffects should assign with =');
  assert(applied.skipped.some((entry) => entry.reason === 'unsupported_effect'),
    'applyEffects should skip *= as an unsupported effect rather than guessing');

  // ---- state-aware text resolution ----
  const substituted = sim.resolveText('Pressure is [+ demo_pressure +].', {demo_pressure: 4}, inject);
  assert(substituted === 'Pressure is 4.', 'resolveText should substitute [+ var +] with the state value');
  const shown = sim.resolveText('[? if demo_support > 0 : organizers gather ?]', {demo_support: 2}, inject);
  assert(shown.indexOf('organizers gather') !== -1, 'resolveText should keep an inline conditional whose test passes');
  const hidden = sim.resolveText('[? if demo_support > 0 : organizers gather ?]', {demo_support: 0}, inject);
  assert(hidden.trim() === '', 'resolveText should drop an inline conditional whose test fails');

  // ---- entry view: opening on-arrival + condition-gated options ----
  const lowState = sim.initialState(body, {demo_resources: 0}, inject);
  const entryLow = sim.buildEntryView(body, lowState, inject);
  assert(entryLow.options.length === 4, 'campaign event should expose its four root options');
  assert(hasDelta(entryLow.onArrival.applied, 'demo_pressure', 0, 1),
    'entering the scene should apply its on-arrival demo_pressure += 1');
  assert(entryLow.onArrival.state.demo_chain_seen === 1,
    'entering the scene should apply its on-arrival demo_chain_seen = 1');
  const openHearingLow = entryLow.options.filter((option) => option.id === 'open_hearing')[0];
  assert(openHearingLow && openHearingLow.available === false,
    'open_hearing should be unavailable while demo_resources is 0');

  const highState = sim.initialState(body, {demo_resources: 1}, inject);
  const entryHigh = sim.buildEntryView(body, highState, inject);
  const openHearingHigh = entryHigh.options.filter((option) => option.id === 'open_hearing')[0];
  assert(openHearingHigh && openHearingHigh.available === true,
    'open_hearing should be available once demo_resources reaches 1');

  // ---- choosing an option: gating, effect deltas, continuation boundary ----
  const blocked = sim.chooseOption(body, {demo_resources: 0}, 'open_hearing', inject);
  assert(!blocked.ok && blocked.reason === 'condition_not_met',
    'choosing open_hearing without resources should be blocked by its condition');
  assert(blocked.unavailableText.indexOf('no spare capacity') !== -1,
    'a blocked choice should surface its unavailable text');

  const chosen = sim.chooseOption(body, {demo_resources: 1, demo_case_strength: 0}, 'open_hearing', inject);
  assert(chosen.ok, 'choosing open_hearing with resources should resolve');
  assert(hasDelta(chosen.delta, 'demo_resources', 1, 0),
    'open_hearing should spend a resource (demo_resources -= 1)');
  assert(hasDelta(chosen.delta, 'demo_case_strength', 0, 2),
    'open_hearing should build the case (demo_case_strength += 2)');
  assert(chosen.continuation && chosen.continuation.nextTarget === 'demo_case_hearing',
    'open_hearing should report it continues into the demo_case_hearing scene');

  process.stdout.write(JSON.stringify({
    ok: true,
    variables: variables.length,
    options: entryHigh.options.length
  }, null, 2) + '\n');
}

try {
  main();
} catch (err) {
  fail(err && err.stack ? err.stack : String(err));
}
