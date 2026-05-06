#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const VIEWER = path.join(ROOT, 'viewer');
const INDEX = path.join(VIEWER, 'index.html');
const CONTENT_STORYBOARD_MODEL = path.join(ROOT, 'authoring', 'content_storyboard_model.js');
const CARD_BOARD_MODEL = path.join(ROOT, 'authoring', 'card_board_model.js');
const STORY_SCOPE_MODEL = path.join(ROOT, 'authoring', 'story_scope_model.js');
const STORY_CHAIN_GRAPH_MODEL = path.join(ROOT, 'authoring', 'story_chain_graph_model.js');
const STORY_PALETTE_MODEL = path.join(ROOT, 'authoring', 'story_palette_model.js');
const TIMELINE_PROFILE_MODEL = path.join(ROOT, 'authoring', 'timeline_profile_model.js');
const TIMELINE_COORDINATE_ADAPTER = path.join(ROOT, 'authoring', 'timeline_coordinate_adapter.js');
const AUTHORING_SURFACE_REGISTRY = path.join(VIEWER, 'authoring_surface_registry.js');
const AUTHORING_SURFACE_GRAPHS = path.join(VIEWER, 'authoring_surface_graphs.js');
const AUTHORING_REFERENCE_INDEX = path.join(VIEWER, 'authoring_reference_index.js');
const CONTENT_STORYBOARD_SURFACE = path.join(VIEWER, 'content_storyboard_surface.js');
const STORYBOARD_SCOPE_CONTROLS = path.join(VIEWER, 'storyboard_scope_controls.js');
const STORYBOARD_CARD_RENDERER = path.join(VIEWER, 'storyboard_card_renderer.js');
const STORYBOARD_PALETTE_SIDEBAR = path.join(VIEWER, 'storyboard_palette_sidebar.js');
const STORYBOARD_WORKSPACE_STATE = path.join(VIEWER, 'storyboard_workspace_state.js');
const CONTENT_STORYBOARD_INTERACTIONS = path.join(VIEWER, 'content_storyboard_interactions.js');
const RUNTIME_LENS_MODEL = path.join(ROOT, 'authoring', 'runtime_lens_model.js');
const RUNTIME_LENS_UI = path.join(VIEWER, 'runtime_lens_ui.js');
const RUNTIME_LENS_WORKSPACE_STATE = path.join(VIEWER, 'runtime_lens_workspace_state.js');
const CARD_FACE_EDITOR = path.join(VIEWER, 'card_face_editor.js');
const CARD_BOARD_SURFACE = path.join(VIEWER, 'card_board_surface.js');
const CARD_BOARD_INTERACTIONS = path.join(VIEWER, 'card_board_interactions.js');
const CARD_WORKSPACE_STATE = path.join(VIEWER, 'card_workspace_state.js');
const CONTENT_GRAPH_INTERACTIONS = path.join(VIEWER, 'content_graph_interactions.js');
const PROJECT_STATE_SURFACE = path.join(VIEWER, 'project_state_surface.js');
const SYSTEM_UI_FIXTURE_STATE = path.join(VIEWER, 'system_ui_fixture_state.js');
const SYSTEM_UI_REGION_CONTEXT = path.join(VIEWER, 'system_ui_region_context.js');
const SYSTEM_UI_WORKSPACE_STATE = path.join(VIEWER, 'system_ui_workspace_state.js');
const SYSTEM_UI_SCREEN_MODEL = path.join(VIEWER, 'system_ui_screen_model.js');
const SYSTEM_UI_SCREEN_PREVIEW = path.join(VIEWER, 'system_ui_screen_preview.js');
const SYSTEM_UI_REGION_ROUTER = path.join(VIEWER, 'system_ui_region_router.js');
const SYSTEM_UI_REGION_EDITOR = path.join(VIEWER, 'system_ui_region_editor.js');
const SYSTEM_UI_PREVIEW_SURFACE = path.join(VIEWER, 'system_ui_preview_surface.js');
const OBJECT_CANVAS_VIEWPORT = path.join(VIEWER, 'object_canvas_viewport.js');
const OBJECT_CANVAS_GRAPH_STAGE = path.join(VIEWER, 'object_canvas_graph_stage.js');
const AUTHORING_WORKSPACE_UI = path.join(VIEWER, 'authoring_workspace_ui.js');
const OBJECT_CANVAS_UI = path.join(VIEWER, 'object_authoring_canvas_ui.js');
const HARNESS = path.join(ROOT, 'qa', 'authoring_canvas_screenshot_harness.html');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const html = read(INDEX);
const contentStoryboardModel = read(CONTENT_STORYBOARD_MODEL);
const cardBoardModel = read(CARD_BOARD_MODEL);
const storyScopeModel = read(STORY_SCOPE_MODEL);
const storyChainGraphModel = read(STORY_CHAIN_GRAPH_MODEL);
const storyPaletteModel = read(STORY_PALETTE_MODEL);
const timelineProfileModel = read(TIMELINE_PROFILE_MODEL);
const timelineCoordinateAdapter = read(TIMELINE_COORDINATE_ADAPTER);
const surfaceRegistry = read(AUTHORING_SURFACE_REGISTRY);
const surfaceGraphs = read(AUTHORING_SURFACE_GRAPHS);
const referenceIndex = read(AUTHORING_REFERENCE_INDEX);
const contentStoryboardSurface = read(CONTENT_STORYBOARD_SURFACE);
const storyboardScopeControls = read(STORYBOARD_SCOPE_CONTROLS);
const storyboardCardRenderer = read(STORYBOARD_CARD_RENDERER);
const storyboardPaletteSidebar = read(STORYBOARD_PALETTE_SIDEBAR);
const storyboardWorkspaceState = read(STORYBOARD_WORKSPACE_STATE);
const contentStoryboardInteractions = read(CONTENT_STORYBOARD_INTERACTIONS);
const runtimeLensModel = read(RUNTIME_LENS_MODEL);
const runtimeLensUi = read(RUNTIME_LENS_UI);
const runtimeLensWorkspaceState = read(RUNTIME_LENS_WORKSPACE_STATE);
const cardFaceEditor = read(CARD_FACE_EDITOR);
const cardBoardSurface = read(CARD_BOARD_SURFACE);
const cardBoardInteractions = read(CARD_BOARD_INTERACTIONS);
const cardWorkspaceState = read(CARD_WORKSPACE_STATE);
const contentInteractions = read(CONTENT_GRAPH_INTERACTIONS);
const projectStateSurface = read(PROJECT_STATE_SURFACE);
const systemUiFixtureState = read(SYSTEM_UI_FIXTURE_STATE);
const systemUiRegionContext = read(SYSTEM_UI_REGION_CONTEXT);
const systemUiWorkspaceState = read(SYSTEM_UI_WORKSPACE_STATE);
const systemUiScreenModel = read(SYSTEM_UI_SCREEN_MODEL);
const systemUiScreenPreview = read(SYSTEM_UI_SCREEN_PREVIEW);
const systemUiRegionRouter = read(SYSTEM_UI_REGION_ROUTER);
const systemUiRegionEditor = read(SYSTEM_UI_REGION_EDITOR);
const systemUiPreviewSurface = read(SYSTEM_UI_PREVIEW_SURFACE);
const objectCanvasViewport = read(OBJECT_CANVAS_VIEWPORT);
const objectCanvasGraphStage = read(OBJECT_CANVAS_GRAPH_STAGE);
const workspaceUi = read(AUTHORING_WORKSPACE_UI);
const canvasUi = read(OBJECT_CANVAS_UI);
const harness = read(HARNESS);

const workspaces = ['content', 'system_ui', 'project_state'];
const groupedTemplates = {
  content: ['event', 'news', 'card', 'surface'],
  system_ui: ['entry', 'project'],
  project_state: ['variables']
};
const internalSystemUiTemplates = ['entry', 'play_surface', 'workspace_layout', 'sidebar_status', 'project'];

assert(html.includes('data-authoring-workspace-nav'), 'Create should keep a small Authoring Workspace host in index.html');
assert(html.includes('../authoring/content_storyboard_model.js'), 'viewer should load the Content Storyboard model');
assert(html.includes('../authoring/runtime_lens_model.js'), 'viewer should load the Runtime Lens model');
assert(html.includes('../authoring/card_board_model.js'), 'viewer should load the Card Board model');
assert(html.includes('../authoring/story_scope_model.js'), 'viewer should load the Story Scope model');
assert(html.includes('../authoring/story_chain_graph_model.js'), 'viewer should load the Story Chain Graph model');
assert(html.includes('../authoring/story_palette_model.js'), 'viewer should load the Story Palette model');
assert(html.includes('../authoring/timeline_profile_model.js'), 'viewer should load the Timeline Profile model');
assert(html.includes('../authoring/timeline_coordinate_adapter.js'), 'viewer should load the Timeline Coordinate adapter');
assert(html.includes('authoring_surface_registry.js'), 'viewer should load the Authoring Surface registry before workspace UI');
assert(html.includes('authoring_surface_graphs.js'), 'viewer should load authoring surface graph builders');
assert(html.includes('authoring_reference_index.js'), 'viewer should load authoring reference index helpers');
assert(html.includes('storyboard_scope_controls.js'), 'viewer should load Storyboard scope controls');
assert(html.includes('storyboard_card_renderer.js'), 'viewer should load Storyboard card renderer');
assert(html.includes('storyboard_palette_sidebar.js'), 'viewer should load Storyboard palette sidebar');
assert(html.includes('storyboard_workspace_state.js'), 'viewer should load Storyboard workspace state');
assert(html.includes('content_storyboard_surface.js'), 'viewer should load Content Storyboard surface');
assert(html.includes('content_storyboard_interactions.js'), 'viewer should load Content Storyboard interactions');
assert(html.includes('runtime_lens_ui.js'), 'viewer should load Runtime Lens UI');
assert(html.includes('runtime_lens_workspace_state.js'), 'viewer should load Runtime Lens workspace state');
assert(html.includes('card_face_editor.js'), 'viewer should load Card Face editor');
assert(html.includes('card_board_surface.js'), 'viewer should load Card Board surface');
assert(html.includes('card_board_interactions.js'), 'viewer should load Card Board interactions');
assert(html.includes('card_workspace_state.js'), 'viewer should load Card Board workspace state');
assert(html.includes('content_graph_interactions.js'), 'viewer should load Content Graph interactions');
assert(html.includes('project_state_surface.js'), 'viewer should load Project State Dependency Board surface');
assert(html.includes('system_ui_fixture_state.js'), 'viewer should load System UI fixture helper');
assert(html.includes('system_ui_region_context.js'), 'viewer should load System UI context helper');
assert(html.includes('system_ui_workspace_state.js'), 'viewer should load System UI workspace state helper');
assert(html.includes('system_ui_screen_model.js'), 'viewer should load System UI Screen model');
assert(html.includes('system_ui_screen_preview.js'), 'viewer should load System UI Screen preview');
assert(html.includes('system_ui_region_router.js'), 'viewer should load System UI region router');
assert(html.includes('system_ui_region_editor.js'), 'viewer should load System UI region editor');
assert(html.includes('system_ui_preview_surface.js'), 'viewer should load System UI Live Preview surface');
assert(html.includes('object_canvas_viewport.js'), 'viewer should load Object Canvas viewport controls');
assert(html.includes('object_canvas_graph_stage.js'), 'viewer should load the fallback Object Canvas graph stage');
assert(surfaceRegistry.includes('content_storyboard'), 'Surface registry should define the Content Storyboard surface');
assert(surfaceRegistry.includes('card_board'), 'Surface registry should define the Card Board surface');
assert(surfaceRegistry.includes('system_ui_preview'), 'Surface registry should define the System UI Preview surface');
assert(surfaceRegistry.includes('project_state_board'), 'Surface registry should define the Project State Board surface');

workspaces.forEach((workspace) => {
  assert(workspaceUi.includes("key: '" + workspace + "'"), workspace + ' workspace should be available in Create');
  assert(workspaceUi.includes('data-authoring-template-group'), workspace + ' templates should be grouped under their workspace');
  assert(workspaceUi.includes(workspace), workspace + ' should be known to the workspace controller');
});

Object.keys(groupedTemplates).forEach((workspace) => {
  groupedTemplates[workspace].forEach((template) => {
    assert(workspaceUi.includes("key: '" + template + "'"), template + ' should stay reachable from Create');
    assert(surfaceRegistry.includes("key: '" + template + "'"), template + ' should be registered as an authoring template');
    assert(surfaceRegistry.includes("workspace: '" + workspace + "'"), workspace + ' workspace mappings should live in the registry');
  });
});
internalSystemUiTemplates.forEach((template) => {
  assert(surfaceRegistry.includes("key: '" + template + "'"), template + ' should remain registered as an internal System UI draft template');
});
assert(workspaceUi.includes('SYSTEM_UI_SCREEN_ITEM'), 'System UI workspace should expose one visible screen entry');
assert(workspaceUi.includes('return [SYSTEM_UI_SCREEN_ITEM]'), 'System UI workspace should collapse the four internal draft templates into one visible choice');
assert(canvasUi.includes('systemUiTemplateForRegion'), 'Object Canvas should switch internal System UI draft type from preview-region clicks');
assert(systemUiRegionRouter.includes('ProjectMapSystemUiRegionRouter'), 'System UI region router should expose a browser API');
assert(systemUiRegionRouter.includes("deck_lane: 'workspace_layout'"), 'System UI region router should map deck clicks to the layout draft');
assert(systemUiRegionRouter.includes("screen_header: 'project'"), 'System UI region router should map header clicks to the Game Info draft');

assert(surfaceRegistry.includes("defaultTemplate: 'entry'"), 'System UI workspace should default to Entry & Sidebar');
assert(surfaceRegistry.includes("defaultTemplate: 'variables'"), 'Project State workspace should default to Variables');
assert(workspaceUi.includes('ProjectMapAuthoringSurfaceRegistry'), 'Workspace navigation should consume the shared surface registry');
assert(canvasUi.includes('ProjectMapAuthoringSurfaceRegistry'), 'Object Canvas should consume the shared surface registry');
assert(canvasUi.includes('data-authoring-surface'), 'Object Canvas should expose the active authoring surface');
assert(contentStoryboardModel.includes('ProjectMapContentStoryboardModel'), 'Content Storyboard model should expose a browser API');
assert(cardBoardModel.includes('ProjectMapCardBoardModel'), 'Card Board model should expose a browser API');
assert(cardBoardModel.includes('buildBoard'), 'Card Board model should build hand/deck/advisor lanes');
assert(storyScopeModel.includes('ProjectMapStoryScopeModel'), 'Story Scope model should expose a browser API');
assert(storyScopeModel.includes('summaryLanes'), 'Story Scope model should preserve overview lanes');
assert(storyChainGraphModel.includes('ProjectMapStoryChainGraphModel'), 'Story Chain Graph model should expose a browser API');
assert(storyChainGraphModel.includes('chainConnectors'), 'Story Chain Graph model should build visible connectors');
assert(storyPaletteModel.includes('ProjectMapStoryPaletteModel'), 'Story Palette model should expose a browser API');
assert(storyPaletteModel.includes('buildPalette'), 'Story Palette model should build context-matching groups');
assert(timelineProfileModel.includes('ProjectMapTimelineProfileModel'), 'Timeline Profile model should expose a browser API');
assert(timelineCoordinateAdapter.includes('ProjectMapTimelineCoordinateAdapter'), 'Timeline Coordinate adapter should expose a browser API');
assert(contentStoryboardModel.includes('ProjectMapTimelineCoordinateAdapter'), 'Content Storyboard should consume the Timeline Coordinate adapter');
assert(contentStoryboardModel.includes('buildTimeline'), 'Content Storyboard model should build timeline lanes');
assert(contentStoryboardModel.includes('buildChain'), 'Content Storyboard model should build story chains');
assert(contentStoryboardSurface.includes('ProjectMapContentStoryboardSurface'), 'Content Storyboard surface should expose a browser API');
assert(contentStoryboardSurface.includes('data-content-storyboard-surface'), 'Content Storyboard surface should expose a stable QA marker');
assert(contentStoryboardSurface.includes('data-content-storyboard-card'), 'Content Storyboard surface should render story cards');
assert(contentStoryboardSurface.includes('data-content-storyboard-insert'), 'Content Storyboard surface should render insertion affordances');
assert(contentStoryboardSurface.includes('data-content-storyboard-plan'), 'Content Storyboard should keep plan details in the editor panel');
assert(contentStoryboardSurface.includes('renderRuntimeLens'), 'Content Storyboard should render the Runtime Lens panel in the editor');
assert(storyboardScopeControls.includes('data-content-storyboard-scope'), 'Storyboard scope controls should expose scope controls');
assert(storyboardScopeControls.includes('data-content-storyboard-depth-controls'), 'Storyboard scope controls should expose chain depth controls');
assert(storyboardCardRenderer.includes('data-storyboard-card-face'), 'Storyboard card renderer should render player-facing cards');
assert(storyboardPaletteSidebar.includes('ProjectMapStoryboardPaletteSidebar'), 'Storyboard palette sidebar should expose a browser API');
assert(storyboardPaletteSidebar.includes('data-storyboard-palette'), 'Storyboard palette sidebar should expose a stable QA marker');
assert(storyboardPaletteSidebar.includes('data-storyboard-palette-item'), 'Storyboard palette sidebar should render draggable story items');
assert(storyboardWorkspaceState.includes('ProjectMapStoryboardWorkspaceState'), 'Storyboard workspace state should expose a browser API');
assert(storyboardWorkspaceState.includes('restoreContext'), 'Storyboard workspace state should restore saved context');
assert(storyboardWorkspaceState.includes('dropPaletteItem'), 'Storyboard workspace state should handle Palette drops');
assert(contentStoryboardInteractions.includes('ProjectMapContentStoryboardInteractions'), 'Content Storyboard interactions should expose a browser API');
assert(contentStoryboardInteractions.includes('onViewport'), 'Content Storyboard interactions should support background pan');
assert(contentStoryboardInteractions.includes('onCardMove'), 'Content Storyboard interactions should support card drag');
assert(contentStoryboardInteractions.includes('onPaletteDrop'), 'Content Storyboard interactions should support Palette drops');
assert(contentStoryboardInteractions.includes("options.onZoom(event.deltaY < 0 ? 'in' : 'out', event)"), 'Content Storyboard interactions should support mouse-wheel zoom');
assert(runtimeLensModel.includes('ProjectMapRuntimeLensModel'), 'Runtime Lens model should expose a browser API');
assert(runtimeLensUi.includes('ProjectMapRuntimeLensUi'), 'Runtime Lens UI should expose a browser API');
assert(runtimeLensUi.includes('data-runtime-lens-frame'), 'Runtime Lens UI should render an embedded frame marker');
assert(runtimeLensWorkspaceState.includes('ProjectMapRuntimeLensWorkspaceState'), 'Runtime Lens workspace state should expose a browser API');
assert(runtimeLensWorkspaceState.includes('createRuntimeLens'), 'Runtime Lens workspace state should call the desktop bridge');
assert(cardFaceEditor.includes('ProjectMapCardFaceEditor'), 'Card Face editor should expose a browser API');
assert(cardFaceEditor.includes('data-card-face-editor'), 'Card Face editor should expose a stable QA marker');
assert(cardBoardSurface.includes('ProjectMapCardBoardSurface'), 'Card Board surface should expose a browser API');
assert(cardBoardSurface.includes('data-card-board-surface'), 'Card Board surface should expose a stable QA marker');
assert(cardBoardSurface.includes('data-card-board-lane="'), 'Card Board surface should render lane markers');
assert(cardBoardSurface.includes('ProjectMapCardFaceEditor'), 'Card Board surface should render through the card face editor');
assert(cardBoardInteractions.includes('ProjectMapCardBoardInteractions'), 'Card Board interactions should expose a browser API');
assert(cardBoardInteractions.includes('application/x-dms-card-board'), 'Card Board interactions should support drag/drop payloads');
assert(cardWorkspaceState.includes('ProjectMapCardWorkspaceState'), 'Card Board workspace state should expose a browser API');
assert(cardWorkspaceState.includes('openFromSystemRegion'), 'Card Board workspace state should open from System UI regions');
assert(contentStoryboardSurface.includes('data-content-storyboard-floating-controls'), 'Content Storyboard zoom controls should float inside the canvas');
assert(contentStoryboardSurface.includes('data-storyboard-drop-target'), 'Content Storyboard should expose Palette drop targets');
assert(objectCanvasViewport.includes('fitContentStoryboard'), 'Object Canvas viewport helper should fit the Storyboard canvas');
assert(objectCanvasGraphStage.includes('ProjectMapObjectCanvasGraphStage'), 'Fallback Object Canvas graph stage should stay extracted from the main controller');
assert(surfaceGraphs.includes('ProjectMapAuthoringSurfaceGraphs'), 'Surface graph builders should remain available for fallback and non-content surfaces');
assert(referenceIndex.includes('contentContext'), 'Reference index should expose selected content global context');
assert(referenceIndex.includes('branchDraft'), 'Reference index should create related branch drafts');
assert(contentInteractions.includes('pointerdown'), 'Content Graph interactions should bind pointer drag behavior');
assert(contentInteractions.includes('onViewport'), 'Content Graph interactions should support background pan');
assert(canvasUi.includes('storyboardWorkspaceApi'), 'Object Canvas should delegate content templates to the Storyboard workspace state');
assert(canvasUi.includes('runtimeLensWorkspaceApi'), 'Object Canvas should delegate Runtime Lens behavior to its workspace state helper');
assert(canvasUi.includes('cardWorkspaceApi'), 'Object Canvas should delegate Card templates to the Card Board workspace state');
assert(storyboardWorkspaceState.includes('ProjectMapContentStoryboardSurface'), 'Storyboard workspace state should route content templates to the Storyboard surface');
assert(contentStoryboardSurface.includes('data-content-storyboard-view'), 'Content Storyboard surface should bind Storyboard view switching');
assert(canvasUi.includes('is-editor-overlay'), 'Object Canvas should support editor overlay mode');
assert(projectStateSurface.includes('ProjectMapProjectStateSurface'), 'Project State surface should expose a browser API');
assert(projectStateSurface.includes('data-project-state-surface'), 'Project State surface should expose a stable QA marker');
assert(projectStateSurface.includes('data-project-state-consumers'), 'Project State surface should render variable consumers');
assert(canvasUi.includes('ProjectMapProjectStateSurface'), 'Object Canvas should route Project State templates to the dedicated surface');
assert(systemUiFixtureState.includes('fixtureList'), 'System UI fixture helper should expose fixture presets');
assert(systemUiRegionContext.includes('buildContext'), 'System UI context helper should build selected-region context');
assert(systemUiWorkspaceState.includes('draftWithContext'), 'System UI workspace state should save region/fixture context');
assert(systemUiPreviewSurface.includes('ProjectMapSystemUiPreviewSurface'), 'System UI Preview surface should expose a browser API');
assert(systemUiPreviewSurface.includes('data-system-ui-preview-surface'), 'System UI Preview surface should expose a stable QA marker');
assert(systemUiScreenPreview.includes('data-system-ui-region'), 'System UI Screen preview should render selectable UI regions');
assert(systemUiScreenModel.includes('ProjectMapSystemUiScreenModel'), 'System UI Screen model should expose a browser API');
assert(systemUiScreenModel.includes('RECIPES'), 'System UI Screen model should map templates as recipes');
assert(systemUiScreenModel.includes('FAMILY_ORDER'), 'System UI Screen model should expose object families');
assert(systemUiScreenPreview.includes('ProjectMapSystemUiScreenPreview'), 'System UI Screen preview should expose a browser API');
assert(systemUiScreenPreview.includes('data-system-screen-shell'), 'System UI Screen preview should render the shared shell');
assert(systemUiRegionEditor.includes('data-system-ui-owner-template'), 'System UI region editor should expose owner evidence');
assert(systemUiRegionEditor.includes('data-system-ui-card-board-handoff'), 'System UI region editor should deep-link card play regions into Card Board');
assert(systemUiPreviewSurface.includes('data-system-screen-workspace'), 'System UI surface should expose the unified screen workspace marker');
assert(canvasUi.includes('ProjectMapSystemUiPreviewSurface'), 'Object Canvas should route System UI templates to the dedicated surface');
assert(canvasUi.includes('function renderContentStoryboardStage'), 'Object Canvas should render the Content Storyboard stage');
assert(surfaceGraphs.includes('function systemUiGraphNodes'), 'Surface graph builders should define a System UI graph');
assert(surfaceGraphs.includes('function projectStateGraphNodes'), 'Surface graph builders should define a Project State graph');
assert(contentStoryboardSurface.includes('data-content-storyboard-editor'), 'Content Storyboard should render an editor/detail panel');
assert(canvasUi.includes('data-object-canvas-zoom'), 'Object Canvas should expose zoom controls');
assert(harness.includes('data-content-storyboard-surface'), 'Screenshot harness should assert the Storyboard surface');
assert(harness.includes('content-runtime-lens-ready'), 'Screenshot harness should cover Storyboard Runtime Lens ready state');
assert(harness.includes('content-runtime-lens-expanded'), 'Screenshot harness should cover expanded Storyboard Runtime Lens');
assert(harness.includes('data-card-board-surface'), 'Screenshot harness should assert the Card Board surface');
assert(harness.includes('workspaceForTemplate'), 'Screenshot harness should verify workspace routing');

process.stdout.write(JSON.stringify({ok: true, workspaces, groupedTemplates}, null, 2) + '\n');
