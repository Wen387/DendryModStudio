#!/usr/bin/env node
'use strict';

const objectCanvasModel = require('./authoring/object_authoring_canvas_model.js');
global.ProjectMapSystemUiFixtureState = require('./viewer/system_ui_fixture_state.js');
global.ProjectMapSystemUiRegionContext = require('./viewer/system_ui_region_context.js');
const screenModel = require('./viewer/system_ui_screen_model.js');
global.ProjectMapSystemUiScreenModel = screenModel;
const screenPreview = require('./viewer/system_ui_screen_preview.js');
global.ProjectMapSystemUiScreenPreview = screenPreview;
global.ProjectMapSystemUiRegionEditor = require('./viewer/system_ui_region_editor.js');
const surface = require('./viewer/system_ui_preview_surface.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const index = {
  schemaVersion: '0.1',
  project: {name: 'System UI Fixture', root: '/tmp/system-ui-fixture'},
  scenes: [
    scene('root', 'Dynamic Social Democracy', 'source/scenes/root.scene.dry', 'root'),
    scene('main', 'Workspace Hand', 'source/scenes/main.scene.dry', 'hand'),
    scene('status', 'Status', 'source/scenes/status.scene.dry', 'status'),
    scene('starter_deck', 'Starter Deck', 'source/scenes/decks/starter_deck.scene.dry', 'deck'),
    scene('starter_card', 'Starter Action Card', 'source/scenes/cards/starter_card.scene.dry', 'card')
  ],
  variables: [{name: 'public_order', readCount: 1, writeCount: 1}],
  semantic: {
    hands: [{id: 'main', title: 'Workspace Hand', path: 'source/scenes/main.scene.dry'}],
    cards: [{id: 'starter_card', title: 'Starter Action Card', path: 'source/scenes/cards/starter_card.scene.dry'}],
    textCorpus: {
      items: [
        textItem('root_title', 'Dynamic Social Democracy', 'title', 'root', 'source/scenes/root.scene.dry', 1),
        textItem('root_body', 'Read.', 'body', 'root', 'source/scenes/root.scene.dry', 8),
        textItem('root_option', 'Start', 'option_label', 'root', 'source/scenes/root.scene.dry', 15, 'main'),
        textItem('main_title', 'Workspace Hand', 'title', 'main', 'source/scenes/main.scene.dry', 1),
        textItem('main_body', 'The work table is ready.', 'body', 'main', 'source/scenes/main.scene.dry', 7),
        textItem('status_title', 'Status', 'title', 'status', 'source/scenes/status.scene.dry', 1),
        textItem('status_body', 'Resources available: 0', 'body', 'status', 'source/scenes/status.scene.dry', 7),
        textItem('card_title', 'Starter Action Card', 'title', 'starter_card', 'source/scenes/cards/starter_card.scene.dry', 1),
        textItem('card_body', 'Choose what the team does next.', 'body', 'starter_card', 'source/scenes/cards/starter_card.scene.dry', 8)
      ]
    }
  }
};

const expected = {
  entry: {family: 'main', selected: 'ui:main_content'},
  play_surface: {family: 'interactive', selected: 'ui:workspace_hand'},
  workspace_layout: {family: 'structure', selected: 'ui:layout_frame'},
  sidebar_status: {family: 'sidebar', selected: 'ui:sidebar_status'},
  project: {family: 'structure', selected: 'ui:screen_header'}
};

Object.keys(expected).forEach((template) => {
  const model = objectCanvasModel.buildTemplateCanvas(index, template, {}, {values: {}});
  assert(model.ok, template + ' template model should build');
  const screen = screenModel.buildScreen(model, {fixture: template === 'sidebar_status' ? 'busy' : 'default'});
  assert(screen.kind === 'system_ui_screen_model', template + ' should build a screen model');
  assert(screen.fixtureState && screen.fixtureState.key, template + ' should expose fixture state');
  assert(screen.fixtures.some((fixture) => fixture.key === 'status_heavy'), template + ' should expose status-heavy fixture');
  assert(screen.regionContext && screen.regionContext.ownership, template + ' should expose selected-region ownership context');
  assert(screen.recipe.family === expected[template].family, template + ' should map to the expected recipe family');
  assert(screen.selectedKey === expected[template].selected, template + ' should select the expected default region');
  ['structure', 'main', 'interactive', 'sidebar'].forEach((family) => {
    assert(screen.families.some((item) => item.key === family), template + ' should expose ' + family + ' family');
  });
  ['screen_header', 'main_content', 'workspace_hand', 'deck_lane', 'action_card', 'advisor_lane', 'sidebar_status', 'layout_frame'].forEach((region) => {
    assert(screen.regions.some((item) => item.key === region), template + ' should expose ' + region + ' region in the shared shell');
  });
  const html = surface.render(model, {fixture: 'busy'});
  assert(html.includes('data-system-screen-workspace="true"'), template + ' surface should expose the unified screen workspace marker');
  assert(html.includes('data-system-screen-shell="true"'), template + ' surface should render the shared player-screen shell');
  assert(html.includes('data-system-screen-region="main_content"'), template + ' surface should render the main content region');
  assert(html.includes('data-system-screen-region="sidebar_status"'), template + ' surface should render the sidebar/status region');
  assert(html.includes('data-system-screen-family="interactive"'), template + ' surface should render interactive-object regions');
  assert(html.includes('data-system-screen-diagnostics="true"'), template + ' surface should explain recipe and selection intent');
  assert(html.includes('data-system-ui-region-context="true"'), template + ' surface should render selected-region context');
  assert(html.includes('data-system-ui-owner-template='), template + ' surface should render region owner evidence');
  assert(!html.includes('system-ui-device'), template + ' should not render the old abstract device grid');
});

const edited = objectCanvasModel.buildTemplateCanvas(index, 'workspace_layout', {}, {
  values: {'layout.deckTitle': 'Live Edited Policy Deck'}
});
const editedHtml = surface.render(edited, {selected: 'ui:deck_lane'});
assert(editedHtml.includes('Live Edited Policy Deck'), 'live field values should update the shared screen preview');
assert(editedHtml.includes('data-system-ui-selected-region="deck_lane"'), 'selected region editor should follow clicked preview object');
assert(editedHtml.includes('data-system-ui-owner-template="workspace_layout"'), 'deck lane should identify Workspace Layout as owner');

const project = objectCanvasModel.buildTemplateCanvas(index, 'project', {}, {
  values: {'project.gameTitle': 'Live Edited Game Title', 'project.author': 'Studio Tester'}
});
const projectHtml = surface.render(project, {selected: 'ui:screen_header'});
assert(projectHtml.includes('Live Edited Game Title'), 'Game Info title edits should render in the System UI header preview');
assert(projectHtml.includes('Studio Tester'), 'Game Info author edits should render in the System UI header subtitle');
assert(projectHtml.includes('data-system-ui-selected-region="screen_header"'), 'Game Info should edit through the selected header region');

const statusHeavy = surface.render(edited, {fixture: 'status_heavy', selected: 'ui:sidebar_status'});
assert(statusHeavy.includes('Reichstag composition'), 'status-heavy fixture should visibly change the sidebar');

const interactive = surface.render(edited, {fixture: 'interactive', selected: 'ui:action_card'});
assert(interactive.includes('data-system-ui-fixture-current="interactive"'), 'interactive fixture should be selectable');

process.stdout.write(JSON.stringify({
  ok: true,
  templates: Object.keys(expected),
  regions: screenModel.buildScreen(edited, {}).regions.length
}, null, 2) + '\n');

function scene(id, title, path, type) {
  return {
    id,
    title,
    path,
    type,
    sourceSpan: {path, startLine: 1, endLine: 40},
    options: [{id: 'continue', title: 'Continue', target: {id: 'main'}}]
  };
}

function textItem(id, text, role, sceneId, path, line, itemId) {
  return {
    id,
    text,
    role,
    owner: {kind: 'scene', sceneId, sectionId: itemId || 'start', itemId: itemId || ''},
    source: {path, line}
  };
}
