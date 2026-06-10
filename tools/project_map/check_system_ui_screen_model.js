#!/usr/bin/env node
'use strict';

const objectCanvasModel = require('./authoring/object_authoring_canvas_model.js');
global.ProjectMapSystemUiFixtureState = require('./viewer/system_ui_fixture_state.js');
global.ProjectMapSystemUiRegionContext = require('./viewer/system_ui_region_context.js');
global.ProjectMapSystemUiCapabilityModel = require('./viewer/system_ui_capability_model.js');
global.ProjectMapSystemUiSemanticTaskModel = require('./viewer/system_ui_semantic_task_model.js');
const screenModel = require('./viewer/system_ui_screen_model.js');
global.ProjectMapSystemUiScreenModel = screenModel;
const screenPreview = require('./viewer/system_ui_screen_preview.js');
global.ProjectMapSystemUiScreenPreview = screenPreview;
global.ProjectMapSystemUiRegionEditor = require('./viewer/system_ui_region_editor.js');
const surface = require('./viewer/system_ui_preview_surface.js');
const electionSurface = require('./viewer/election_results_surface.js');

const {fail, assert} = require('./check_harness.js');

function countOccurrences(text, needle) {
  return String(text || '').split(needle).length - 1;
}

const index = {
  schemaVersion: '0.1',
  project: {name: 'System UI Fixture', root: '/tmp/system-ui-fixture'},
  scenes: [
    scene('root', 'Dynamic Social Democracy', 'source/scenes/root.scene.dry', 'root'),
    scene('main', 'Workspace Hand', 'source/scenes/main.scene.dry', 'hand'),
    Object.assign(scene('library', 'Library', 'source/scenes/library.scene.dry', 'event'), {
      flags: {isSpecial: true},
      sections: [{id: 'library.government', sourceSpan: {path: 'source/scenes/library.scene.dry', startLine: 24, endLine: 32}}]
    }),
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
    electionResults: {
      items: [
        {
          id: 'reichstag_results_event',
          title: 'Reichstag Results',
          subtitle: 'Reichstag election results',
          path: 'source/scenes/events/election_1928.scene.dry',
          line: 88,
          electionKind: 'reichstag',
          year: '1928',
          chartElementId: 'reichstag',
          usesD3Parliament: true,
          seatsTotal: '493',
          parties: [
            {key: 'spd', name: 'SPD', color: '#E3000F', seats: '153'},
            {key: 'z', name: 'Center', color: '#000000', seats: '64'}
          ],
          reason: 'd3_parliament'
        },
        {
          id: 'prussia_results_event',
          title: 'Z Prussian Landtag Results',
          subtitle: 'Prussia election results',
          path: 'source/scenes/events/prussia_election_1928.scene.dry',
          line: 144,
          electionKind: 'state',
          year: '1928',
          chartElementId: 'prussia_landtag',
          usesD3Parliament: true,
          seatsTotal: '450',
          parties: [
            {key: 'spd_prussia', name: 'Prussian SPD', color: '#E3000F', seatsExpression: 'Math.round(Q.spd_r_prussia * Q.landtag_size)'},
            {key: 'dnvp_prussia', name: 'Prussian DNVP', color: '#3E88B3', seats: '73'}
          ],
          reason: 'd3_parliament'
        }
      ]
    },
    textCorpus: {
      items: [
        textItem('root_title', 'Dynamic Social Democracy', 'title', 'root', 'source/scenes/root.scene.dry', 1),
        textItem('root_body', 'Read.', 'body', 'root', 'source/scenes/root.scene.dry', 8),
        textItem('root_option', 'Start', 'option_label', 'root', 'source/scenes/root.scene.dry', 15, 'main'),
        textItem('main_title', 'Workspace Hand', 'title', 'main', 'source/scenes/main.scene.dry', 1),
        textItem('main_body', 'The work table is ready.', 'body', 'main', 'source/scenes/main.scene.dry', 7),
        textItem('library_heading', 'Government', 'heading', 'library', 'source/scenes/library.scene.dry', 25, 'library.government'),
        textItem('library_body', 'The Library explains the background institutions.', 'body', 'library', 'source/scenes/library.scene.dry', 27, 'library.government'),
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
  entry: {family: 'main', selected: 'ui:main_options'},
  play_surface: {family: 'interactive', selected: 'ui:main_content'},
  workspace_layout: {family: 'structure', selected: 'ui:layout_frame'},
  sidebar_status: {family: 'sidebar', selected: 'ui:sidebar_status'},
  election_results: {family: 'results', selected: 'ui:election_results_chart'},
  project: {family: 'structure', selected: 'ui:screen_header'}
};

index.scenes.find((item) => item.id === 'root').options = [
  {id: '@main', title: 'Start game', target: {kind: 'scene', id: 'main'}, sourceSpan: {path: 'source/scenes/root.scene.dry', startLine: 15, endLine: 15}},
  {id: '@mod_info', title: 'Mod Info - Last Updated 2026/01/25', target: {kind: 'scene', id: 'mod_info'}, sourceSpan: {path: 'source/scenes/root.scene.dry', startLine: 16, endLine: 16}},
  {id: '@credits', title: 'Credits', target: {kind: 'scene', id: 'credits'}, sourceSpan: {path: 'source/scenes/root.scene.dry', startLine: 17, endLine: 17}}
];

Object.keys(expected).forEach((template) => {
  const model = objectCanvasModel.buildTemplateCanvas(index, template, {}, {values: {}});
  assert(model.ok, template + ' template model should build');
  const screen = screenModel.buildScreen(model, {projectIndex: index, fixture: template === 'sidebar_status' ? 'busy' : 'default'});
  assert(screen.kind === 'system_ui_screen_model', template + ' should build a screen model');
  assert(screen.fixtureState && screen.fixtureState.key, template + ' should expose fixture state');
  assert(screen.fixtures.some((fixture) => fixture.key === 'status_heavy'), template + ' should expose status-heavy fixture');
  assert(screen.regionContext && screen.regionContext.ownership, template + ' should expose selected-region ownership context');
  assert(screen.capabilityMatrix && screen.capabilityMatrix.kind === 'system_ui_capability_matrix', template + ' should expose a System UI capability matrix');
  assert(screen.regions.every((region) => region.capability && region.capability.regionKey === region.key), template + ' should attach deterministic capability to every region');
  assert(screen.selected && screen.selected.capability, template + ' should expose selected-region capability');
  assert(screen.semanticTaskMatrix && screen.semanticTaskMatrix.kind === 'system_ui_semantic_task_matrix', template + ' should expose a semantic task matrix');
  assert(screen.regions.every((region) => Array.isArray(region.semanticTasks) && region.semanticTasks.length), template + ' should attach deterministic semantic tasks to every region');
  assert(screen.playerFlow && screen.playerFlow.kind === 'system_ui_player_flow', template + ' should expose a player-facing flow model');
  ['entry_menu', 'library_page', 'in_game'].forEach((screenId) => {
    assert(screen.playerFlow.screens.some((item) => item.id === screenId), template + ' playerFlow should include ' + screenId);
    assert(screen.playerFlow.byScreen[screenId] && screen.playerFlow.byScreen[screenId].slots.length, template + ' playerFlow should expose slots for ' + screenId);
  });
  screen.playerFlow.screens.forEach((playerScreen) => {
    playerScreen.slots.forEach((slot) => {
      assert(slot.id && slot.screen && slot.label && slot.regionKey, template + ' visible slot should carry identity and region mapping');
      assert(Array.isArray(slot.editableFields), template + ' visible slot should carry editableFields');
      assert(slot.actionKind && slot.sourceState !== undefined, template + ' visible slot should carry action/source state');
      assert(screen.regions.some((region) => region.key === slot.regionKey), template + ' visible slot should map back to a known region');
    });
  });
  assert(screen.selectedSlot && screen.selectedSlot.regionKey === screen.selected.key, template + ' should select a player-visible slot for the selected region');
  if (template !== 'election_results') {
    assert(screen.playerFlow.bySlot['library_page.library_button'].sourceState === 'generated_only', template + ' should keep the topbar Library button as generated/runtime chrome');
    assert(Object.keys(screen.playerFlow.bySlot).some((slotId) => slotId.indexOf('library_page.section:') === 0 && screen.playerFlow.bySlot[slotId].sourceState === 'source_backed'), template + ' should expose Library page sections as source-backed player slots');
    assert(Object.keys(screen.playerFlow.bySlot).some((slotId) => slotId.indexOf('entry_menu.option:') === 0), template + ' should expose root menu options as entry-screen player slots');
  }
  assert(screen.recipe.family === expected[template].family, template + ' should map to the expected recipe family');
  assert(screen.selectedKey === expected[template].selected, template + ' should select the expected default region');
  assert(screen.sidebarCategories.some((category) => category.id === 'politics'), template + ' should expose source-backed sidebar categories');
  assert(screen.sidebarCategories.some((category) => category.id === 'economics'), template + ' should expose every source-backed sidebar category');
  assert(screen.sidebarCategories.some((category) => category.id === 'politics' && category.evidence && category.deleteEvidence && category.canDelete), template + ' should preserve source evidence and delete capability for sidebar categories');
  assert(screen.libraryContent && screen.libraryContent.sourceBacked && screen.libraryContent.sections.some((section) => section.id === 'library.government'), template + ' should expose source-backed Library page content sections');
  ['structure', 'main', 'interactive', 'results', 'sidebar'].forEach((family) => {
    assert(screen.families.some((item) => item.key === family), template + ' should expose ' + family + ' family');
  });
  const expectedRegions = template === 'election_results'
    ? ['election_results_frame', 'election_results_chart', 'election_results_table', 'election_results_coalitions', 'election_results_choices']
    : ['screen_header', 'main_content', 'workspace_hand', 'deck_lane', 'action_card', 'advisor_lane', 'sidebar_status', 'layout_frame', 'right_sidebar'];
  expectedRegions.forEach((region) => {
    assert(screen.regions.some((item) => item.key === region), template + ' should expose ' + region + ' region in its screen shell');
  });
  const html = surface.render(model, {projectIndex: index, fixture: 'busy'});
  assert(html.includes('data-system-screen-workspace="true"'), template + ' surface should expose the unified screen workspace marker');
  assert(html.includes('data-system-screen-shell="true"'), template + ' surface should render the shared player-screen shell');
  assert(html.includes('data-system-player-flow-toolbar="true"'), template + ' surface should expose player screen switching');
  assert(html.includes('data-system-player-flow-tabs="true"'), template + ' preview should expose Entry / Library / in-game preview modes');
  assert(html.includes('data-system-ui-visible-slot='), template + ' preview should mark visible player-facing slots');
  if (template === 'election_results') {
    assert(html.includes('data-system-election-results="true"'), 'Election Results surface should render the dedicated election preview');
    assert(html.includes('data-system-screen-region="election_results_chart"'), 'Election Results surface should render the seat chart region');
    assert(html.includes('data-system-screen-region="election_results_table"'), 'Election Results surface should render the party table region');
    assert(html.includes('data-system-screen-region="election_results_choices"'), 'Election Results surface should render player choices');
    assert(html.includes('data-system-screen-family="results"'), 'Election Results surface should expose result-object regions');
  } else {
    assert(html.includes('data-system-screen-region="main_content"'), template + ' surface should render the main content region');
    assert(html.includes('data-system-screen-region="sidebar_status"'), template + ' surface should render the sidebar/status region');
    assert(html.includes('data-system-screen-region="right_sidebar"'), template + ' surface should render the selectable right-panel extension zone');
    assert(!html.includes('data-system-ui-right-sidebar-add="true"'), template + ' right-panel zone should be a selectable region, not a disabled placeholder button');
    if (['play_surface', 'workspace_layout', 'sidebar_status'].includes(template)) {
      assert(html.includes('data-system-play-surface="true"'), template + ' surface should render the in-game play surface');
      assert(html.includes('data-system-play-section="deck"'), template + ' in-game preview should render decks');
      assert(html.includes('data-system-play-section="hand"'), template + ' in-game preview should render hand cards');
      assert(html.includes('data-system-play-section="advisor"'), template + ' in-game preview should render advisors');
      assert(html.includes('data-system-screen-family="interactive"'), template + ' in-game surface should render interactive-object regions');
    } else {
      assert(!html.includes('system-screen-interactions'), template + ' entry-style preview should not render the old abstract interaction rail');
    }
  }
  assert(html.includes('data-runtime-lens-panel="true"'), template + ' surface should render the Runtime Lens observer');
  assert(html.includes('data-system-screen-diagnostics="true"'), template + ' surface should explain recipe and selection intent');
  assert(html.includes('data-system-ui-region-context="true"'), template + ' surface should render selected-region context');
  assert(html.includes('data-system-ui-owner-template='), template + ' surface should render region owner evidence');
  const fieldsIndex = html.indexOf('data-system-ui-semantic-fields="true"');
  const selectedContextIndex = html.indexOf('data-system-ui-selected-region=');
  assert(fieldsIndex >= 0, template + ' surface should render task-scoped editable fields');
  assert(selectedContextIndex >= 0, template + ' surface should render selected-region metadata');
  assert(fieldsIndex < selectedContextIndex, template + ' surface should put editable fields before selected-region metadata');
  assert(!html.includes('data-system-ui-semantic-task="'), template + ' surface should not render confusing semantic task card choices');
  assert(!html.includes('guarded_apply /') && !html.includes('safe_apply /'), template + ' surface should not show raw safety codes in the beginner summary');
  assert(html.includes('data-system-ui-advanced-details="true"'), template + ' surface should keep capability/source evidence in Advanced details');
  assert(html.includes('data-system-ui-capability="true"'), template + ' surface should render capability matrix summary');
  assert(html.includes('data-system-ui-runtime-state='), template + ' surface should render runtime evidence markers');
  assert(html.includes('data-system-ui-theme-layout-candidate='), template + ' surface should render theme/layout candidate marker');
  assert(html.includes('data-system-ui-library-entry="toolbar"'), template + ' surface should expose an obvious toolbar entry for Library page content');
  if (template !== 'election_results') {
    assert(html.includes('data-system-ui-library-entry="topbar"'), template + ' preview topbar Library item should open Library page content');
  }
  if (template === 'project') {
    assert(html.includes('data-system-ui-library-content="true"'), 'Game Info should expose Library page content as a separate source-backed area');
    assert(html.includes('data-object-canvas-action="open_library_content"'), 'Library content sections should open the owning content scene');
    assert(html.includes('data-system-ui-top-chrome-diagnostics="true"'), 'Game Info should still keep Top Chrome labels as diagnostics');
  }
  if (template !== 'election_results') {
    assert(html.includes('data-system-screen-sidebar-category="politics"'), template + ' surface should render source-backed sidebar category tabs');
    assert(html.includes('data-system-ui-template="workspace_layout"'), template + ' surface should expose Add category as a Workspace Layout action');
    if (['entry', 'project'].includes(template)) {
      assert(html.includes('data-system-screen-entry-options="true"'), template + ' entry preview should render the actual root menu option list');
      assert(html.includes('Start game') && html.includes('Mod Info - Last Updated 2026/01/25') && html.includes('Credits'), template + ' entry preview should show actual root options instead of unrelated prose');
    }
  }
  assert(!html.includes('<span>Main</span><span>Politics</span><span>Defense</span><span>Polls</span>'), template + ' surface should not render the old hard-coded sidebar tabs');
  assert(!html.includes('system-ui-device'), template + ' should not render the old abstract device grid');
});

const playModel = objectCanvasModel.buildTemplateCanvas(index, 'play_surface', {}, {values: {}});
const entryFromPlayHtml = surface.render(playModel, {
  projectIndex: index,
  playerFlowScreen: 'entry_menu',
  selected: 'ui:main_content'
});
assert(entryFromPlayHtml.includes('data-system-entry-menu="true"'), 'switching to Entry should render the opening screen, not the play surface');
assert(entryFromPlayHtml.includes('Start game') && entryFromPlayHtml.includes('Mod Info - Last Updated 2026/01/25') && entryFromPlayHtml.includes('Credits'), 'Entry preview should use actual root menu choices from source evidence');
assert(!entryFromPlayHtml.includes('Old opening body.') && !entryFromPlayHtml.includes('data-system-screen-copy="true"><p>Read.</p>'), 'Entry preview should not replace the start menu with root/library prose when options exist');
assert(!entryFromPlayHtml.includes('The work table is ready.'), 'Entry preview should not leak the in-game/hand scene body');
assert(entryFromPlayHtml.includes('data-object-canvas-action="open_system_content_scene"'), 'Entry text should open the owning content scene instead of hand fields');

const defaultEntryScreen = screenModel.buildScreen(
  objectCanvasModel.buildTemplateCanvas(index, 'entry', {}, {values: {}}),
  {projectIndex: index}
);
assert(defaultEntryScreen.selected && defaultEntryScreen.selected.key === 'main_options', 'entry screen should default to the actual visible start-menu options when source options exist');
assert(defaultEntryScreen.selectedSlot && defaultEntryScreen.selectedSlot.id.indexOf('entry_menu.option:') === 0, 'entry screen should focus the first visible root option instead of unrelated opening prose');

const defaultPlayScreen = screenModel.buildScreen(playModel, {projectIndex: index});
assert(defaultPlayScreen.selected && defaultPlayScreen.selected.key === 'main_content', 'in-game screen should default to central scene text instead of the hand/card structure panel');
assert(defaultPlayScreen.selectedSlot && defaultPlayScreen.selectedSlot.id === 'in_game.scene_copy', 'in-game screen should focus the visible scene passage before secondary card-board controls');

const sidebarFromEntryScreen = screenModel.buildScreen(playModel, {
  projectIndex: index,
  playerFlowScreen: 'entry_menu',
  selected: 'ui:sidebar_category:economics'
});
assert(sidebarFromEntryScreen.selected && sidebarFromEntryScreen.selected.key === 'sidebar_status', 'clicking a sidebar tab should select the Sidebar editor, not the main content editor');
assert(sidebarFromEntryScreen.selectedSlot && sidebarFromEntryScreen.selectedSlot.categoryId === 'economics', 'clicking a sidebar tab should preserve the selected sidebar visible slot');

const inGameSceneScreen = screenModel.buildScreen(playModel, {
  projectIndex: index,
  playerFlowScreen: 'in_game',
  selected: 'ui:main_content'
});
const inGameSceneSlot = inGameSceneScreen.playerFlow.bySlot['in_game.scene_copy'];
assert(inGameSceneSlot && inGameSceneSlot.actionKind === 'open_content_scene', 'in-game scene copy should route to content editing');
assert(inGameSceneSlot.route && inGameSceneSlot.route.sceneId === 'root', 'hand/deck/card targets should not masquerade as the central scene passage');
assert(inGameSceneSlot.title !== 'Workspace Hand', 'central in-game scene slot should not show the hand/workspace title');
const inGameSceneHtml = surface.render(playModel, {
  projectIndex: index,
  playerFlowScreen: 'in_game',
  selected: 'ui:main_content'
});
assert(inGameSceneHtml.includes('data-system-ui-content-scene-handoff="true"'), 'in-game scene copy should expose a content-editor handoff in the inspector');
assert(!inGameSceneHtml.includes('data-object-canvas-field="play.handTitle"'), 'selecting the central scene should not expose hand-area fields');

const runtimeEvidenceScreen = screenModel.buildScreen(
  objectCanvasModel.buildTemplateCanvas(index, 'entry', {}, {values: {}}),
  {
    projectIndex: index,
    selected: 'ui:main_content',
    runtimeVisualSurface: {
      status: 'ready',
      candidates: [
        {id: 'root_text', role: 'main_content text', text: 'Read.', source: {path: 'source/scenes/root.scene.dry', line: 8}, runtimeEvidenceState: 'source_backed', editability: 'draftable'},
        {id: 'generated_css', role: 'style', selector: '.generated', source: {path: 'out/html/style.css', line: 1}, runtimeEvidenceState: 'generated_only', editability: 'generated_only'}
      ]
    }
  }
);
assert(runtimeEvidenceScreen.capabilityMatrix.runtimeEvidenceState === 'source_backed', 'runtime evidence should prefer source-backed candidates over generated-only diagnostics');
assert(runtimeEvidenceScreen.selected.capability.runtimeEvidenceState === 'source_backed', 'selected source-backed runtime evidence should be visible in System UI capability');
const blockedScreen = screenModel.buildScreen(objectCanvasModel.buildTemplateCanvas(index, 'entry', {}, {values: {}}), {
  projectIndex: index,
  runtimeVisualSurface: {status: 'blocked', diagnostics: [{severity: 'error', code: 'blocked'}]}
});
assert(blockedScreen.capabilityMatrix.runtimeEvidenceState === 'blocked', 'blocked runtime evidence should mark the capability matrix blocked');

const sourceCategoryScreen = screenModel.buildScreen(
  objectCanvasModel.buildTemplateCanvas(index, 'sidebar_status', {}, {values: {}}),
  {projectIndex: index, selected: 'ui:sidebar_category:economics'}
);
const economicsRegion = sourceCategoryScreen.regions.find((region) => region.key === 'sidebar_status');
assert(economicsRegion && economicsRegion.title === 'Budget Desk', 'source sidebar category selection should use the selected category heading');
assert(economicsRegion.body.includes('The treasury report sits here.'), 'source sidebar category selection should use the selected category body');
assert(!economicsRegion.body.includes('Resources available: 0'), 'source sidebar category preview should not inject default fixture sidebar body');
assert(!economicsRegion.body.includes('Internal dissent: very low'), 'source sidebar category preview should not inject default fixture status lines');

// WYSIWYG section binding (R1 / S1 regression): the rendered sectionId field
// carries the DRAFT's target as its original (a displayed-category mismatch is
// then collected as a change by the canvas), it is read-only, and the default
// selected category follows the draft target so loaded drafts open on the
// section they actually edit.
const sidebarCanvas = objectCanvasModel.buildTemplateCanvas(index, 'sidebar_status', {}, {values: {}});
const draftTargetId = sidebarCanvas.changeState.draft.sectionId;
const defaultSidebarScreen = screenModel.buildScreen(sidebarCanvas, {projectIndex: index});
assert(defaultSidebarScreen.selectedSidebarCategory.id === draftTargetId, 'default sidebar category selection should follow the draft target (' + defaultSidebarScreen.selectedSidebarCategory.id + ' vs ' + draftTargetId + ')');
const pinnedField = (defaultSidebarScreen.selectedSidebarCategory.fields || []).find((field) => field.id === 'sidebar.sectionId');
assert(pinnedField && pinnedField.readOnly === true, 'sectionId field should be read-only in the region editor');
assert(pinnedField.original === draftTargetId, 'sectionId field original should be the draft target');
assert(pinnedField.value === defaultSidebarScreen.selectedSidebarCategory.id, 'sectionId field value should be the displayed category');
const economicsPin = (sourceCategoryScreen.selectedSidebarCategory.fields || []).find((field) => field.id === 'sidebar.sectionId');
assert(economicsPin && economicsPin.value === 'economics' && economicsPin.original === draftTargetId, 'displayed category id should diverge from the draft original so the retarget is collected');

const surfaceOnlyIndex = JSON.parse(JSON.stringify(index));
const surfaceStatus = surfaceOnlyIndex.scenes.find((item) => item.id === 'status');
surfaceStatus.sections = [
  {id: 'status.paramilitaries', sourceSpan: {path: 'source/scenes/status.scene.dry', startLine: 30, endLine: 36}}
];
surfaceOnlyIndex.semantic.textCorpus.items = surfaceOnlyIndex.semantic.textCorpus.items.filter((item) => !(item.owner && item.owner.sceneId === 'status'));
surfaceOnlyIndex.semantic.surfaceText = {
  items: [
    surfaceTextItem('surface_paramilitaries_heading', '= Paramilitaries', 'Paramilitaries', 31),
    surfaceTextItem('surface_reichswehr', 'Reichswehr: [+ reichswehr_strength +] thousand troops.', 'Reichswehr', 33),
    surfaceTextItem('surface_police', 'Prussian police loyalty: [+ prussian_police_loyalty : loyalty +]', 'Prussian police loyalty', 35)
  ],
  sources: ['source/scenes/status.scene.dry']
};
const surfaceCategoryScreen = screenModel.buildScreen(
  objectCanvasModel.buildTemplateCanvas(surfaceOnlyIndex, 'sidebar_status', {}, {values: {}}),
  {projectIndex: surfaceOnlyIndex, selected: 'ui:sidebar_category:paramilitaries'}
);
const paramilitariesRegion = surfaceCategoryScreen.regions.find((region) => region.key === 'sidebar_status');
assert(paramilitariesRegion && paramilitariesRegion.title === 'Paramilitaries', 'surface-only sidebar category selection should use the parsed surface heading');
assert(paramilitariesRegion.body.includes('Reichswehr: [+ reichswehr_strength +] thousand troops.'), 'surface-only sidebar category selection should expose dynamic status lines');
assert(paramilitariesRegion.body.includes('Prussian police loyalty: [+ prussian_police_loyalty : loyalty +]'), 'surface-only sidebar category selection should keep all source-backed surface rows');

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
assert(projectHtml.includes('data-system-ui-top-chrome-diagnostics="true"'), 'Game Info header should expose Top Chrome diagnostics');
assert(projectHtml.includes('data-system-ui-top-chrome-label="generated_only"'), 'runtime header menu labels should stay generated-only/manual');

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
const electionBoardHtml = electionSurface.render(election, {projectIndex: index});
assert(countOccurrences(electionBoardHtml, 'data-object-canvas-field="election.targetSceneId"') === 1, 'Election Results board should expose one source event selector, not duplicate target-scene controls');
const electionChoicesHtml = surface.render(election, {selected: 'ui:election_results_choices'});
assert(electionChoicesHtml.includes('type="checkbox"'), 'Election Results should expose disabled-choice checkboxes');

const switchedElection = objectCanvasModel.buildTemplateCanvas(index, 'election_results', {}, {
  values: {
    'election.targetSceneId': 'prussia_results_event',
    'election.sourcePath': 'source/scenes/events/election_1928.scene.dry',
    'election.chartElementId': 'reichstag',
    'election.party.0.name': 'Stale Reichstag SPD'
  }
});
const switchedDraft = switchedElection.changeState.draft;
assert(switchedDraft.targetSceneId === 'prussia_results_event', 'Election Results source selector should switch target scenes');
assert(switchedDraft.sourcePath === 'source/scenes/events/prussia_election_1928.scene.dry', 'Election Results source selector should rebase source path from the selected event');
assert(switchedDraft.chartElementId === 'prussia_landtag', 'Election Results source selector should rebase the D3 chart target');
assert(switchedDraft.parties.some((party) => party.name === 'Prussian SPD'), 'Election Results source selector should load source-backed party rows');
assert(!switchedDraft.parties.some((party) => party.name === 'Stale Reichstag SPD'), 'Election Results source switch should ignore stale party form fields from the previous event');
const switchedElectionHtml = surface.render(switchedElection, {selected: 'ui:election_results_chart'});
assert(switchedElectionHtml.includes('Prussian SPD'), 'Election Results preview should visibly change after selecting a different source event');

const selectedCategory = objectCanvasModel.buildTemplateCanvas(index, 'sidebar_status', {}, {values: {}});
const categoryScreen = screenModel.buildScreen(selectedCategory, {projectIndex: index, selected: 'ui:sidebar_category:economics'});
assert(categoryScreen.selectedSidebarCategory.id === 'economics', 'sidebar category selection should follow clicked category tab');
assert(categoryScreen.selected && categoryScreen.selected.key === 'sidebar_status', 'sidebar category selection should keep editing in the Sidebar / Status region');
assert(categoryScreen.selected.fields.some((field) => field.id === 'sidebar.sectionHeading' && field.value === 'Budget Desk'), 'selected category fields should edit the category heading');
const categoryHtml = surface.render(selectedCategory, {projectIndex: index, selected: 'ui:sidebar_category:economics'});
assert(categoryHtml.includes('Budget Desk'), 'selected sidebar category should render the selected source-backed heading');
assert(categoryHtml.includes('data-system-ui-selected-region="sidebar_status"'), 'selected category should open the region editor for the sidebar');
assert(categoryHtml.includes('data-system-ui-sidebar-composer="true"'), 'selected sidebar category should open sidebar editing fields');
assert(categoryHtml.includes('data-system-ui-sidebar-current="true"'), 'selected sidebar category should render only the current selected tab summary');
assert(categoryHtml.includes('data-system-ui-sidebar-composer-modes="true"'), 'Sidebar Composer should expose edit/add/delete mode controls');
assert(categoryHtml.includes('data-system-ui-sidebar-composer-mode="delete"'), 'Sidebar Composer should expose delete mode');
assert(categoryHtml.includes('data-object-canvas-action="sidebar_delete_category"'), 'Sidebar delete mode should prepare a delete draft');
assert(!categoryHtml.includes('system-ui-sidebar-category-list'), 'selected sidebar category should not duplicate the preview tab list in the editor');
assert(categoryHtml.includes('Sidebar intro text') || categoryHtml.includes('側邊欄開頭文字'), 'Sidebar editing should distinguish intro text from status rows');
assert(categoryHtml.includes('Sidebar status lines') || categoryHtml.includes('側邊欄狀態行'), 'Sidebar editing should label the player-facing status rows clearly');
assert(categoryHtml.includes('data-system-ui-field-help="sidebar.sectionStatusLines"'), 'Sidebar editing should explain that status lines are the usually visible in-game rows');
assert(categoryHtml.includes('Player-facing tab heading') || categoryHtml.includes('玩家看到的分頁名稱'), 'Sidebar editing should use semantic field labels');

const deleteCategoryModel = objectCanvasModel.buildTemplateCanvas(index, 'sidebar_status', {}, {
  values: {'sidebar.sectionId': 'economics', 'sidebar.operationMode': 'delete', 'sidebar.deleteConfirm': 'true'}
});
const deleteCategoryHtml = surface.render(deleteCategoryModel, {
  projectIndex: index,
  selected: 'ui:sidebar_category:economics',
  selectedTaskId: 'sidebar_status:sidebar_delete_category'
});
assert(deleteCategoryHtml.includes('data-system-ui-active-task="sidebar_status:sidebar_delete_category"'), 'Sidebar delete action should select the delete task');
assert(deleteCategoryHtml.includes('data-object-canvas-field="sidebar.deleteConfirm"') && deleteCategoryHtml.includes('checked'), 'Sidebar delete task should keep the confirmation field checked for Review & Apply');

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

function surfaceTextItem(id, originalText, label, line) {
  return {
    id,
    originalText,
    label,
    role: 'label',
    source: {
      path: 'source/scenes/status.scene.dry',
      line,
      startLine: line,
      endLine: line
    },
    confidence: 'static',
    editability: 'draft_exportable'
  };
}
