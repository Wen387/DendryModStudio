#!/usr/bin/env node
'use strict';

// Guards the real-engine play-test renderer (viewer/object_playtest_engine_ui.js):
// it must inject the engine's already-rendered content/choice HTML verbatim,
// expose available choices as data-play-choice buttons while showing gated
// choices disabled, surface the starting-state inputs + reset control, flag
// unsaved-edit state, render a game-over banner, and detect the desktop bridge.

const ui = require('./viewer/object_playtest_engine_ui.js');
const {fail, assert} = require('./check_harness.js');

function main() {
  const view = {
    sceneId: 'demo_campaign_pressure',
    title: 'Civic Reform Campaign',
    contentHtml: '<p>The office receives three contradictory notes.</p>',
    choices: [
      {index: 0, id: 'open_hearing', titleHtml: 'Open a public hearing.', canChoose: true, subtitle: 'Spend capacity'},
      {index: 1, id: 'street_canvass', titleHtml: 'Send organizers.', canChoose: false, subtitle: null}
    ],
    gameOver: false,
    qualities: {demo_resources: 1}
  };

  const html = ui.renderView(view, {variables: ['demo_resources'], startState: {demo_resources: 1}, edited: true});

  // Engine-rendered content + choice HTML are injected verbatim.
  assert(html.indexOf('<p>The office receives three contradictory notes.</p>') !== -1,
    'renderView should inject the engine content HTML verbatim');
  assert(html.indexOf('Civic Reform Campaign') !== -1, 'renderView should show the scene title');

  // Available choice is a clickable, index-addressed button.
  assert(/data-play-choice="0"/.test(html), 'an available choice should be a data-play-choice button keyed by index');
  assert(html.indexOf('Open a public hearing.') !== -1, 'the available choice should show its engine-rendered label');
  assert(html.indexOf('Spend capacity') !== -1, 'a choice subtitle should render');

  // Gated choice is disabled, not clickable.
  assert(/data-play-choice="1"/.test(html) === false, 'a gated choice must not be a clickable data-play-choice button');
  assert(html.indexOf('disabled') !== -1, 'a gated choice should render a disabled control');
  assert(html.indexOf('Send organizers.') !== -1, 'a gated choice should still show its label');

  // Starting-state inputs + reset.
  assert(/data-play-var="demo_resources"/.test(html), 'starting-state should expose a quality input');
  assert(/data-play-action="engine-restart"/.test(html), 'the panel should expose an engine restart/reset control');

  // Unsaved-edit badge.
  assert(html.indexOf('unsaved') !== -1 || html.toLowerCase().indexOf('unsaved') !== -1,
    'an edited play-test should flag that it includes unsaved edits');

  // Game-over rendering.
  const overHtml = ui.renderView({sceneId: 'x', contentHtml: '<p>Done.</p>', choices: [], gameOver: true}, {});
  assert(overHtml.indexOf('object-editing-play-engine-gameover') !== -1,
    'a game-over view should render the game-over banner');

  // Error rendering carries a retry control.
  const errHtml = ui.renderError({error: 'compile-error'});
  assert(/data-play-action="engine-restart"/.test(errHtml), 'an error view should offer a retry control');
  assert(errHtml.indexOf('object-editing-play-engine') !== -1, 'an error view should use the engine play container');

  // Bridge detection keys off the desktop capability surface.
  assert(ui.isAvailable({dendryDesktop: {objectPlaytest: function () {}}}) === true,
    'isAvailable should be true when the desktop bridge exposes objectPlaytest');
  assert(ui.isAvailable({}) === false, 'isAvailable should be false without the desktop bridge');

  // Entry-scene picker: a multi-scene list renders a <select> of options, marks
  // the edited object's own scene, and preselects the active entry.
  const picker = ui.renderPane(view, {
    variables: ['demo_resources'],
    startState: {demo_resources: 1},
    scenes: [
      {id: 'demo_campaign_pressure', title: 'Demo Campaign Pressure'},
      {id: 'demo_case_hearing', title: 'Demo Case Hearing'},
      {id: 'root', title: 'Starter Demo'}
    ],
    entry: 'root',
    defaultEntry: 'demo_campaign_pressure'
  });
  assert(/data-play-entry/.test(picker),
    'the play pane should render an entry-scene picker when several scenes are selectable');
  assert(picker.indexOf('Start from scene') !== -1, 'the entry picker should carry a label');
  assert(picker.indexOf('<option value="root"') !== -1, 'the picker should offer each scene as an option');
  assert(/<option value="root"[^>]*selected/.test(picker), 'the picker should preselect the active entry scene');
  assert(picker.indexOf('Demo Campaign Pressure') !== -1, 'the picker should label scenes by title');
  assert(picker.indexOf('(this object)') !== -1, "the picker should mark the edited object's own scene");

  // With only one selectable scene there is nothing to choose, so the picker is omitted.
  const single = ui.renderPane(view, {scenes: [{id: 'only', title: 'Only'}], entry: 'only', defaultEntry: 'only'});
  assert(/data-play-entry/.test(single) === false,
    'the entry picker should be omitted when only one scene is selectable');

  process.stdout.write(JSON.stringify({ok: true}, null, 2) + '\n');
}

try {
  main();
} catch (err) {
  fail(err && err.stack ? err.stack : String(err));
}
