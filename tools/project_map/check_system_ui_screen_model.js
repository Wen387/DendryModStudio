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
    Object.assign(scene('status', 'Status', 'source/scenes/status.scene.dry', 'status'), {
      metadata: {title: {path: 'source/scenes/status.scene.dry', line: 1}},
      sections: [
        {id: 'status.politics', sourceSpan: {path: 'source/scenes/status.scene.dry', startLine: 8, endLine: 14}},
        {id: 'status.economics', sourceSpan: {path: 'source/scenes/status.scene.dry', startLine: 16, endLine: 22}}
      ]
    }),
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
        textItem('status_politics_heading', 'Policy Desk', 'heading', 'status', 'source/scenes/status.scene.dry', 9, 'status.politics'),
        textItem('status_politics_body', 'Coalition pressure is visible here.', 'body', 'status', 'source/scenes/status.scene.dry', 11, 'status.politics'),
        textItem('status_politics_line', '[? if public_order > 0 : Public order is steady. ?]', 'conditional_body', 'status', 'source/scenes/status.scene.dry', 13, 'status.politics'),
        textItem('status_economics_heading', 'Budget Desk', 'heading', 'status', 'source/scenes/status.scene.dry', 17, 'status.economics'),
        textItem('status_economics_body', 'The treasury report sits here.', 'body', 'status', 'source/scenes/status.scene.dry', 19, 'status.economics'),
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
  election_results: {family: 'results', selected: 'ui:election_results_chart'},
  project: {family: 'structure', selected: 'ui:screen_header'}
};

Object.keys(expected).forEach((template) => {
  const model = objectCanvasModel.buildTemplateCanvas(index, template, {}, {values: {}});
  assert(model.ok, template + ' template model should build');
  const screen = screenModel.buildScreen(model, {projectIndex: index, fixture: template === 'sidebar_status' ? 'busy' : 'default'});
  assert(screen.kind === 'system_ui_screen_model', template + ' should build a screen model');
  assert(screen.fixtureState && screen.fixtureState.key, template + ' should expose fixture state');
  assert(screen.fixtures.some((fixture) => fixture.key === 'status_heavy'), template + ' should expose status-heavy fixture');
  assert(screen.regionContext && screen.regionContext.ownership, template + ' should expose selected-region ownership context');
  assert(screen.recipe.family === expected[template].family, template + ' should map to the expected recipe family');
  assert(screen.selectedKey === expected[template].selected, template + ' should select the expected default region');
  assert(screen.sidebarCategories.some((category) => category.id === 'politics'), template + ' should expose source-backed sidebar categories');
  assert(screen.sidebarCategories.some((category) => category.id === 'economics'), template + ' should expose every source-backed sidebar category');
  ['structure', 'main', 'interactive', 'results', 'sidebar'].forEach((family) => {
    assert(screen.families.some((item) => item.key === family), template + ' should expose ' + family + ' family');
  });
  const expectedRegions = template === 'election_results'
    ? ['election_results_frame', 'election_results_chart', 'election_results_table', 'election_results_coalitions', 'election_results_choices']
    : ['screen_header', 'main_content', 'workspace_hand', 'deck_lane', 'action_card', 'advisor_lane', 'sidebar_status', 'layout_frame'];
  expectedRegions.forEach((region) => {
    assert(screen.regions.some((item) => item.key === region), template + ' should expose ' + region + ' region in its screen shell');
  });
  const html = surface.render(model, {projectIndex: index, fixture: 'busy'});
  assert(html.includes('data-system-screen-workspace="true"'), template + ' surface should expose the unified screen workspace marker');
  assert(html.includes('data-system-screen-shell="true"'), template + ' surface should render the shared player-screen shell');
  if (template === 'election_results') {
    assert(html.includes('data-system-election-results="true"'), 'Election Results surface should render the dedicated election preview');
    assert(html.includes('data-system-screen-region="election_results_chart"'), 'Election Results surface should render the seat chart region');
    assert(html.includes('data-system-screen-region="election_results_table"'), 'Election Results surface should render the party table region');
    assert(html.includes('data-system-screen-region="election_results_choices"'), 'Election Results surface should render player choices');
    assert(html.includes('data-system-screen-family="results"'), 'Election Results surface should expose result-object regions');
  } else {
    assert(html.includes('data-system-screen-region="main_content"'), template + ' surface should render the main content region');
    assert(html.includes('data-system-screen-region="sidebar_status"'), template + ' surface should render the sidebar/status region');
    assert(html.includes('data-system-screen-family="interactive"'), template + ' surface should render interactive-object regions');
  }
  assert(html.includes('data-runtime-lens-panel="true"'), template + ' surface should render the Runtime Lens observer');
  assert(html.includes('data-system-screen-diagnostics="true"'), template + ' surface should explain recipe and selection intent');
  assert(html.includes('data-system-ui-region-context="true"'), template + ' surface should render selected-region context');
  assert(html.includes('data-system-ui-owner-template='), template + ' surface should render region owner evidence');
  if (template !== 'election_results') {
    assert(html.includes('data-system-screen-sidebar-category="politics"'), template + ' surface should render source-backed sidebar category tabs');
    assert(html.includes('data-system-ui-template="workspace_layout"'), template + ' surface should expose Add category as a Workspace Layout action');
  }
  assert(!html.includes('<span>Main</span><span>Politics</span><span>Defense</span><span>Polls</span>'), template + ' surface should not render the old hard-coded sidebar tabs');
  assert(!html.includes('system-ui-device'), template + ' should not render the old abstract device grid');
});

const sourceCategoryScreen = screenModel.buildScreen(
  objectCanvasModel.buildTemplateCanvas(index, 'sidebar_status', {}, {values: {}}),
  {projectIndex: index, selected: 'ui:sidebar_category:economics'}
);
const economicsRegion = sourceCategoryScreen.regions.find((region) => region.key === 'sidebar_status');
assert(economicsRegion && economicsRegion.title === 'Budget Desk', 'source sidebar category selection should use the selected category heading');
assert(economicsRegion.body.includes('The treasury report sits here.'), 'source sidebar category selection should use the selected category body');
assert(!economicsRegion.body.includes('Resources available: 0'), 'source sidebar category preview should not inject default fixture sidebar body');
assert(!economicsRegion.body.includes('Internal dissent: very low'), 'source sidebar category preview should not inject default fixture status lines');

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

const richPreviewHtml = screenPreview.render({
  template: 'entry',
  selectedKey: 'ui:main_content',
  shell: {title: 'Studio Shell'},
  regions: [
    {
      key: 'main_content',
      family: 'main',
      labelKey: 'systemUi.region.mainContent',
      fallback: 'Main content',
      title: 'ROOT SCENE',
      body: 'The <span style="color: #c00000;">**SPD**</span> reads [+ support +] from source/scenes/root.scene.dry.'
    },
    {key: 'main_options', family: 'main', fallback: 'Options', title: 'Start', body: 'Begin'}
  ]
});
assert(richPreviewHtml.includes('data-system-screen-copy="true"'), 'System UI preview should wrap long player text in a bounded copy container');
assert(richPreviewHtml.includes('style="color: #c00000"'), 'System UI preview should render safe HTML color markup inside player text');
assert(!richPreviewHtml.includes('&lt;span style=&quot;color: #c00000'), 'System UI preview should not display raw safe HTML as player-facing text');

const evidenceHtml = global.ProjectMapSystemUiRegionEditor.render({}, {
  selectedKey: 'ui:main_content',
  selected: {key: 'main_content', family: 'main', title: 'Main content', body: 'Body'},
  families: [{key: 'main', fallback: 'Main'}],
  regionContext: {
    ownership: {},
    nearbyRegions: [],
    sourceEvidence: [{label: 'Entry & Sidebar source', path: 'source/scenes/root.scene.dry', line: 1}]
  },
  diagnostics: []
}, {});
assert(evidenceHtml.includes('source/<wbr>scenes/<wbr>root.<wbr>scene.<wbr>dry:<wbr>1'), 'System UI source evidence should add break opportunities at path separators');
assert(evidenceHtml.includes('<code>'), 'System UI source evidence should render source paths as bounded code text');

const election = objectCanvasModel.buildTemplateCanvas(index, 'election_results', {}, {
  values: {'election.party.0.name': 'Social Democrats', 'election.choice.1.disabled': 'false'}
});
const electionHtml = surface.render(election, {selected: 'ui:election_results_table'});
assert(electionHtml.includes('Social Democrats'), 'Election Results party edits should update the WYSIWYG preview');
assert(electionHtml.includes('data-system-ui-selected-region="election_results_table"'), 'Election Results should edit through the selected table region');
assert(electionHtml.includes('type="color"'), 'Election Results should expose color inputs for party colors');
const electionChoicesHtml = surface.render(election, {selected: 'ui:election_results_choices'});
assert(electionChoicesHtml.includes('type="checkbox"'), 'Election Results should expose disabled-choice checkboxes');

const selectedCategory = objectCanvasModel.buildTemplateCanvas(index, 'sidebar_status', {}, {values: {}});
const categoryScreen = screenModel.buildScreen(selectedCategory, {projectIndex: index, selected: 'ui:sidebar_category:economics'});
assert(categoryScreen.selectedSidebarCategory.id === 'economics', 'sidebar category selection should follow clicked category tab');
assert(categoryScreen.selected && categoryScreen.selected.key === 'sidebar_status', 'sidebar category selection should keep editing in the Sidebar / Status region');
assert(categoryScreen.selected.fields.some((field) => field.id === 'sidebar.sectionHeading' && field.value === 'Budget Desk'), 'selected category fields should edit the category heading');
const categoryHtml = surface.render(selectedCategory, {projectIndex: index, selected: 'ui:sidebar_category:economics'});
assert(categoryHtml.includes('Budget Desk'), 'selected sidebar category should render the selected source-backed heading');
assert(categoryHtml.includes('data-system-ui-selected-region="sidebar_status"'), 'selected category should open the region editor for the sidebar');

process.stdout.write(JSON.stringify({
  ok: true,
  templates: Object.keys(expected),
  regions: screenModel.buildScreen(edited, {projectIndex: index}).regions.length
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
  const source = {path, line, startLine: line, endLine: line};
  if (role === 'heading') {
    source.anchorText = '= ' + text;
    source.endAnchorText = '= ' + text;
  } else {
    source.anchorText = text;
    source.endAnchorText = text;
  }
  return {
    id,
    text,
    role,
    owner: {kind: 'scene', sceneId, sectionId: itemId || 'start', itemId: itemId || ''},
    source
  };
}
