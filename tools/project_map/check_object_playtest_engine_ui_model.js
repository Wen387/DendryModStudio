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

  const html = ui.renderPane(view, {variables: ['demo_resources'], startState: {demo_resources: 1}, edited: true});

  // Engine-rendered content + choice HTML are injected verbatim.
  assert(html.indexOf('<p>The office receives three contradictory notes.</p>') !== -1,
    'renderPane should inject the engine content HTML verbatim');
  assert(html.indexOf('Civic Reform Campaign') !== -1, 'renderPane should show the scene title');

  // Available choice is a clickable, index-addressed button.
  assert(/data-play-choice="0"/.test(html), 'an available choice should be a data-play-choice button keyed by index');
  assert(html.indexOf('Open a public hearing.') !== -1, 'the available choice should show its engine-rendered label');
  assert(html.indexOf('Spend capacity') !== -1, 'a choice subtitle should render');

  // Gated choice is disabled, not clickable.
  assert(/data-play-choice="1"/.test(html) === false, 'a gated choice must not be a clickable data-play-choice button');
  assert(html.indexOf('disabled') !== -1, 'a gated choice should render a disabled control');
  assert(html.indexOf('Send organizers.') !== -1, 'a gated choice should still show its label');

  // Rich engine choice titles (styled spans / magic text) must stay on one
  // flowing line: the whole title is wrapped in a single option-label element so
  // the button's column layout cannot stack each inline run as its own row.
  const richHtml = ui.renderNode({
    sceneId: 'rich',
    contentHtml: '<p>x</p>',
    choices: [{
      index: 0,
      id: 'r',
      titleHtml: 'The <span style="color:#a00">Communists</span>? The <span>We</span><span>im</span>ar Parties?',
      canChoose: true,
      subtitle: null
    }]
  }, {});
  assert(/<span class="object-editing-play-option-label">/.test(richHtml),
    'a choice title should be wrapped in a single option-label element');
  const labelAt = richHtml.indexOf('object-editing-play-option-label');
  const innerSpanAt = richHtml.indexOf('color:#a00');
  assert(labelAt !== -1 && innerSpanAt !== -1 && labelAt < innerSpanAt,
    'the styled inner span should live INSIDE the option-label wrapper, not be a sibling flex item');

  // The loading state shows an animated progress affordance (not just static
  // text) so a long compile reads as busy rather than frozen.
  const loadingHtml = ui.renderLoading();
  assert(loadingHtml.indexOf('object-editing-play-engine-progress') !== -1,
    'the loading state should render a progress affordance');

  // Starting-state inputs + reset.
  assert(/data-play-var="demo_resources"/.test(html), 'starting-state should expose a quality input');
  assert(/data-play-action="engine-restart"/.test(html), 'the panel should expose an engine restart/reset control');

  // Unsaved-edit badge.
  assert(html.indexOf('unsaved') !== -1 || html.toLowerCase().indexOf('unsaved') !== -1,
    'an edited play-test should flag that it includes unsaved edits');

  // Game-over rendering.
  const overHtml = ui.renderPane({sceneId: 'x', contentHtml: '<p>Done.</p>', choices: [], gameOver: true}, {});
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

  // ---- art assets: background/sprites/portrait render (host already inlined them) ----
  const artView = {
    sceneId: 'art',
    title: 'Art Scene',
    contentHtml: '<p>Body.</p>',
    choices: [],
    bg: 'data:image/png;base64,AAAA',
    sprites: [{location: 'topLeft', image: 'data:image/png;base64,BBBB'}],
    spriteStyles: {topLeft: 'opacity: 0.8'},
    faceImage: 'data:image/svg+xml;base64,CCCC'
  };
  const artHtml = ui.renderPane(artView, {});
  assert(/object-editing-play-stage[^>]*has-bg/.test(artHtml),
    'a view with a background should render a has-bg stage banner');
  assert(/background-image/.test(artHtml) && artHtml.indexOf('data:image/png;base64,AAAA') !== -1,
    'a data-URI background should be applied as a background-image on the stage');
  assert(/object-editing-play-sprite is-top-left/.test(artHtml),
    'a sprite should render in its mapped corner');
  assert(artHtml.indexOf('src="data:image/png;base64,BBBB"') !== -1,
    'a sprite image should use its inlined data-URI src');
  assert(artHtml.indexOf('opacity: 0.8') !== -1, 'a per-corner sprite style should be applied inline');
  assert(artHtml.indexOf('object-editing-play-portrait') !== -1,
    'a face image should render a portrait figure');
  assert(artHtml.indexOf('src="data:image/svg+xml;base64,CCCC"') !== -1,
    'the portrait should use the inlined face-image data URI');

  // Pictures injected by display/arrival code arrive as inlined data URIs in
  // contentImages and render as full-width figures below the prose.
  const codeImgHtml = ui.renderPane({
    sceneId: 'ci', contentHtml: '<p>x</p>', choices: [],
    contentImages: ['data:image/jpeg;base64,DDDD']
  }, {});
  assert(codeImgHtml.indexOf('object-editing-play-figure') !== -1,
    'a content image should render as a figure');
  assert(codeImgHtml.indexOf('src="data:image/jpeg;base64,DDDD"') !== -1,
    'a content image figure should use its inlined data URI');

  // A CSS-colour background is applied as a colour, not an image.
  const colorHtml = ui.renderPane({sceneId: 'c', contentHtml: '<p>x</p>', choices: [], bg: '#123456'}, {});
  assert(colorHtml.indexOf('background-color:#123456') !== -1,
    'a CSS-colour background should be applied as background-color');

  // No art -> no stage banner (text-only scenes are unchanged).
  const plainHtml = ui.renderPane({sceneId: 'p', contentHtml: '<p>x</p>', choices: []}, {});
  assert(plainHtml.indexOf('object-editing-play-stage') === -1,
    'a view without art should not render a stage banner');

  process.stdout.write(JSON.stringify({ok: true}, null, 2) + '\n');
}

try {
  main();
} catch (err) {
  fail(err && err.stack ? err.stack : String(err));
}
