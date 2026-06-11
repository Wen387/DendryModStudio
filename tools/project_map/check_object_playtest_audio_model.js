#!/usr/bin/env node
'use strict';

// Guards the pure play-test AUDIO state machine
// (viewer/object_playtest_audio_model.js). It must turn a sequence of
// `scene.audio` directives (file tokens already resolved to file:// URLs by the
// host) plus 'ended' events into the right COMMANDS for the DOM shell, mirroring
// the reference player (node_modules/dendrynexus/lib/ui/browser.js): single-track
// play/replace/stop/loop/nofade, queue, shuffle (random playlist draw), clear,
// and null|none stop. Crucially, an empty/whitespace directive is a NO-OP so a
// scene with no audio keeps current playback (cross-scene persistence).

const model = require('./viewer/object_playtest_audio_model.js');
const {fail, assert} = require('./check_harness.js');

const A = 'file:///proj/source/audio/a.mp3';
const B = 'file:///proj/source/audio/b.ogg';
const C = 'file:///proj/source/audio/c.wav';

// Helper: drive a sequence of inputs through reduce(), returning every step's
// {state, commands}. opts (e.g. injected RNG) apply to every step.
function run(inputs, opts) {
  let state = model.freshState();
  const steps = [];
  inputs.forEach((input) => {
    const res = model.reduce(state, input, opts);
    state = res.state;
    steps.push(res);
  });
  return {state, steps};
}

function ops(step) {
  return step.commands.map((c) => c.op);
}

function main() {
  // ---- parseDirective: verbs vs file tokens, null/none as stop ----
  const p = model.parseDirective(A + ' loop');
  assert(p.files.length === 1 && p.files[0] === A && p.isLoop === true,
    'parseDirective should split a file token from the loop verb');
  const pStop = model.parseDirective('null');
  assert(pStop.isStop === true && pStop.files.length === 0,
    'null is a stop sentinel, never a file token');
  assert(model.parseDirective('none').isStop === true, 'none is also a stop sentinel');
  const pAll = model.parseDirective(A + ' ' + B + ' queue shuffle nofade clear');
  assert(pAll.files.length === 2 && pAll.isQueue && pAll.isShuffle && pAll.noFade && pAll.isClear,
    'parseDirective should collect multiple files and all verbs');

  // ---- first play: emits play, sets state ----
  let r = run([A]);
  assert(ops(r.steps[0]).indexOf('play') !== -1, 'a first directive should emit a play command');
  const playCmd = r.steps[0].commands.find((c) => c.op === 'play');
  assert(playCmd.url === A && playCmd.fade === true, 'the first play should target the file and fade in');
  assert(r.state.currentAudioURL === A && r.state.isPlaying === true, 'state tracks the current track as playing');
  assert(r.state.playlist.length === 1 && r.state.playlist[0] === A, 'the played file joins the playlist');

  // ---- loop verb -> setLoop true ----
  r = run([A + ' loop']);
  const setLoop = r.steps[0].commands.find((c) => c.op === 'setLoop');
  assert(setLoop && setLoop.value === true, 'a loop directive should emit setLoop:true');
  assert(r.state.isLooping === true, 'state should record looping');

  // ---- nofade -> play without fade ----
  r = run([A + ' nofade']);
  assert(r.steps[0].commands.find((c) => c.op === 'play').fade === false,
    'a nofade directive should start without a fade-in');

  // ---- replace a different track -> replace (cross-fade) ----
  r = run([A, B]);
  assert(ops(r.steps[1]).indexOf('replace') !== -1, 'a different track should emit a replace command');
  const repl = r.steps[1].commands.find((c) => c.op === 'replace');
  assert(repl.url === B && repl.nofade === false, 'replace should cross-fade to the new track by default');
  assert(r.state.currentAudioURL === B, 'state should follow the replaced track');

  // ---- stop via null / none ----
  r = run([A, 'null']);
  assert(ops(r.steps[1]).indexOf('stop') !== -1, 'null should emit a stop command');
  assert(r.steps[1].commands.find((c) => c.op === 'stop').fade === true, 'stop should fade out by default');
  assert(r.state.isPlaying === false && r.state.currentAudioURL === '', 'after stop nothing is current');
  r = run([A, 'none']);
  assert(ops(r.steps[1]).indexOf('stop') !== -1, 'none should also emit a stop command');
  // nofade stop -> immediate
  r = run([A, 'null nofade']);
  assert(r.steps[1].commands.find((c) => c.op === 'stop').fade === false, 'a nofade stop should not fade');

  // ---- PERSISTENCE: empty/whitespace/non-string directive is a no-op ----
  ['', '   ', null, undefined].forEach((empty) => {
    r = run([A, empty]);
    assert(r.steps[1].commands.length === 0, 'an empty directive must emit no commands (persistence)');
    assert(r.state.currentAudioURL === A && r.state.isPlaying === true,
      'an empty directive must leave current playback untouched');
  });

  // ---- queue: enqueue while playing, then advance on ended (LIFO pop) ----
  r = run([A, B + ' queue', C + ' queue', {type: 'ended'}]);
  assert(ops(r.steps[1]).indexOf('enqueue') !== -1, 'a queue directive while playing should enqueue');
  assert(r.steps[1].commands.find((c) => c.op === 'enqueue').url === B, 'enqueue should carry the queued url');
  assert(r.steps[2].commands.find((c) => c.op === 'enqueue').url === C, 'a second queue directive enqueues too');
  // state before ended: queue has [B, C]
  const endedStep = r.steps[3];
  const endedPlay = endedStep.commands.find((c) => c.op === 'play');
  assert(endedPlay && endedPlay.url === C, "on ended, queue pops LIFO -> last-queued plays first (browser.js parity)");
  assert(r.state.currentAudioURL === C && r.state.queue.length === 1 && r.state.queue[0] === B,
    'after one ended, C plays and B remains queued');

  // ---- shuffle: random playlist draw with injected (deterministic) RNG ----
  // playlist becomes [A, B]; random()->0 picks index 0 (A) on ended.
  r = run([A, B + ' shuffle', {type: 'ended'}], {random: () => 0});
  assert(r.steps[1].commands.find((c) => c.op === 'enqueue'), 'a shuffle directive while playing enqueues');
  let shufPlay = r.steps[2].commands.find((c) => c.op === 'play');
  assert(shufPlay && shufPlay.url === A, 'shuffle with random()->0 should draw playlist[0] (A)');
  // random()->0.99 picks the last playlist entry (B)
  r = run([A, B + ' shuffle', {type: 'ended'}], {random: () => 0.99});
  shufPlay = r.steps[2].commands.find((c) => c.op === 'play');
  assert(shufPlay && shufPlay.url === B, 'shuffle with random()->~1 should draw the last playlist entry (B)');

  // ---- clear: empties the playlist but does NOT stop current playback ----
  r = run([A, B + ' queue', 'clear']);
  assert(r.state.playlist.length === 0, 'clear should empty the playlist');
  assert(r.steps[2].commands.find((c) => c.op === 'stop') === undefined,
    'clear alone must not stop the currently playing track');
  assert(r.state.currentAudioURL === B || r.state.currentAudioURL === A,
    'clear leaves a track current');

  // ---- ended with nothing to advance -> stops cleanly ----
  r = run([A, {type: 'ended'}]);
  assert(r.steps[1].commands.find((c) => c.op === 'play') === undefined,
    'ended with no queue/shuffle should not start a new track');
  assert(r.state.isPlaying === false && r.state.onEndedMode === null,
    'ended with nothing queued clears the playing flag');

  // ---- ended while looping -> no advance (a looping element never ends) ----
  r = run([A + ' loop', {type: 'ended'}]);
  assert(r.steps[1].commands.length === 0, 'a looping track ending should not advance the queue');

  // ---- purity: reduce must not mutate the input state ----
  const base = model.freshState();
  const snapshot = JSON.stringify(base);
  model.reduce(base, A + ' loop');
  assert(JSON.stringify(base) === snapshot, 'reduce must not mutate the state it is given');

  process.stdout.write(JSON.stringify({ok: true}, null, 2) + '\n');
}

try {
  main();
} catch (err) {
  fail(err && err.stack ? err.stack : String(err));
}
