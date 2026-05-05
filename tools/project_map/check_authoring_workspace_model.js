#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const VIEWER = path.join(ROOT, 'viewer');
const INDEX = path.join(VIEWER, 'index.html');
const CONTENT_STORYBOARD_MODEL = path.join(ROOT, 'authoring', 'content_storyboard_model.js');
const TIMELINE_PROFILE_MODEL = path.join(ROOT, 'authoring', 'timeline_profile_model.js');
const TIMELINE_COORDINATE_ADAPTER = path.join(ROOT, 'authoring', 'timeline_coordinate_adapter.js');
const AUTHORING_SURFACE_REGISTRY = path.join(VIEWER, 'authoring_surface_registry.js');
const AUTHORING_SURFACE_GRAPHS = path.join(VIEWER, 'authoring_surface_graphs.js');
const AUTHORING_REFERENCE_INDEX = path.join(VIEWER, 'authoring_reference_index.js');
const CONTENT_STORYBOARD_SURFACE = path.join(VIEWER, 'content_storyboard_surface.js');
const CONTENT_STORYBOARD_INTERACTIONS = path.join(VIEWER, 'content_storyboard_interactions.js');
const CONTENT_GRAPH_INTERACTIONS = path.join(VIEWER, 'content_graph_interactions.js');
const PROJECT_STATE_SURFACE = path.join(VIEWER, 'project_state_surface.js');
const SYSTEM_UI_SCREEN_MODEL = path.join(VIEWER, 'system_ui_screen_model.js');
const SYSTEM_UI_SCREEN_PREVIEW = path.join(VIEWER, 'system_ui_screen_preview.js');
const SYSTEM_UI_REGION_ROUTER = path.join(VIEWER, 'system_ui_region_router.js');
const SYSTEM_UI_PREVIEW_SURFACE = path.join(VIEWER, 'system_ui_preview_surface.js');
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
const timelineProfileModel = read(TIMELINE_PROFILE_MODEL);
const timelineCoordinateAdapter = read(TIMELINE_COORDINATE_ADAPTER);
const surfaceRegistry = read(AUTHORING_SURFACE_REGISTRY);
const surfaceGraphs = read(AUTHORING_SURFACE_GRAPHS);
const referenceIndex = read(AUTHORING_REFERENCE_INDEX);
const contentStoryboardSurface = read(CONTENT_STORYBOARD_SURFACE);
const contentStoryboardInteractions = read(CONTENT_STORYBOARD_INTERACTIONS);
const contentInteractions = read(CONTENT_GRAPH_INTERACTIONS);
const projectStateSurface = read(PROJECT_STATE_SURFACE);
const systemUiScreenModel = read(SYSTEM_UI_SCREEN_MODEL);
const systemUiScreenPreview = read(SYSTEM_UI_SCREEN_PREVIEW);
const systemUiRegionRouter = read(SYSTEM_UI_REGION_ROUTER);
const systemUiPreviewSurface = read(SYSTEM_UI_PREVIEW_SURFACE);
const workspaceUi = read(AUTHORING_WORKSPACE_UI);
const canvasUi = read(OBJECT_CANVAS_UI);
const harness = read(HARNESS);

const workspaces = ['content', 'system_ui', 'project_state'];
const groupedTemplates = {
  content: ['event', 'news', 'card', 'surface'],
  system_ui: ['entry'],
  project_state: ['variables', 'project']
};
const internalSystemUiTemplates = ['entry', 'play_surface', 'workspace_layout', 'sidebar_status'];

assert(html.includes('data-authoring-workspace-nav'), 'Create should keep a small Authoring Workspace host in index.html');
assert(html.includes('../authoring/content_storyboard_model.js'), 'viewer should load the Content Storyboard model');
assert(html.includes('../authoring/timeline_profile_model.js'), 'viewer should load the Timeline Profile model');
assert(html.includes('../authoring/timeline_coordinate_adapter.js'), 'viewer should load the Timeline Coordinate adapter');
assert(html.includes('authoring_surface_registry.js'), 'viewer should load the Authoring Surface registry before workspace UI');
assert(html.includes('authoring_surface_graphs.js'), 'viewer should load authoring surface graph builders');
assert(html.includes('authoring_reference_index.js'), 'viewer should load authoring reference index helpers');
assert(html.includes('content_storyboard_surface.js'), 'viewer should load Content Storyboard surface');
assert(html.includes('content_storyboard_interactions.js'), 'viewer should load Content Storyboard interactions');
assert(html.includes('content_graph_interactions.js'), 'viewer should load Content Graph interactions');
assert(html.includes('project_state_surface.js'), 'viewer should load Project State Dependency Board surface');
assert(html.includes('system_ui_screen_model.js'), 'viewer should load System UI Screen model');
assert(html.includes('system_ui_screen_preview.js'), 'viewer should load System UI Screen preview');
assert(html.includes('system_ui_region_router.js'), 'viewer should load System UI region router');
assert(html.includes('system_ui_preview_surface.js'), 'viewer should load System UI Live Preview surface');
assert(surfaceRegistry.includes('content_storyboard'), 'Surface registry should define the Content Storyboard surface');
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

assert(surfaceRegistry.includes("defaultTemplate: 'entry'"), 'System UI workspace should default to Entry & Sidebar');
assert(surfaceRegistry.includes("defaultTemplate: 'variables'"), 'Project State workspace should default to Variables');
assert(workspaceUi.includes('ProjectMapAuthoringSurfaceRegistry'), 'Workspace navigation should consume the shared surface registry');
assert(canvasUi.includes('ProjectMapAuthoringSurfaceRegistry'), 'Object Canvas should consume the shared surface registry');
assert(canvasUi.includes('data-authoring-surface'), 'Object Canvas should expose the active authoring surface');
assert(contentStoryboardModel.includes('ProjectMapContentStoryboardModel'), 'Content Storyboard model should expose a browser API');
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
assert(contentStoryboardInteractions.includes('ProjectMapContentStoryboardInteractions'), 'Content Storyboard interactions should expose a browser API');
assert(contentStoryboardInteractions.includes('onViewport'), 'Content Storyboard interactions should support background pan');
assert(contentStoryboardInteractions.includes('onCardMove'), 'Content Storyboard interactions should support card drag');
assert(surfaceGraphs.includes('ProjectMapAuthoringSurfaceGraphs'), 'Surface graph builders should remain available for fallback and non-content surfaces');
assert(referenceIndex.includes('contentContext'), 'Reference index should expose selected content global context');
assert(referenceIndex.includes('branchDraft'), 'Reference index should create related branch drafts');
assert(contentInteractions.includes('pointerdown'), 'Content Graph interactions should bind pointer drag behavior');
assert(contentInteractions.includes('onViewport'), 'Content Graph interactions should support background pan');
assert(canvasUi.includes('ProjectMapContentStoryboardSurface'), 'Object Canvas should route content templates to the Storyboard surface');
assert(canvasUi.includes('data-content-storyboard-view'), 'Object Canvas should bind Storyboard view switching');
assert(canvasUi.includes('is-editor-overlay'), 'Object Canvas should support editor overlay mode');
assert(projectStateSurface.includes('ProjectMapProjectStateSurface'), 'Project State surface should expose a browser API');
assert(projectStateSurface.includes('data-project-state-surface'), 'Project State surface should expose a stable QA marker');
assert(projectStateSurface.includes('data-project-state-consumers'), 'Project State surface should render variable consumers');
assert(canvasUi.includes('ProjectMapProjectStateSurface'), 'Object Canvas should route Project State templates to the dedicated surface');
assert(systemUiPreviewSurface.includes('ProjectMapSystemUiPreviewSurface'), 'System UI Preview surface should expose a browser API');
assert(systemUiPreviewSurface.includes('data-system-ui-preview-surface'), 'System UI Preview surface should expose a stable QA marker');
assert(systemUiPreviewSurface.includes('data-system-ui-region'), 'System UI Preview surface should render selectable UI regions');
assert(systemUiScreenModel.includes('ProjectMapSystemUiScreenModel'), 'System UI Screen model should expose a browser API');
assert(systemUiScreenModel.includes('RECIPES'), 'System UI Screen model should map templates as recipes');
assert(systemUiScreenModel.includes('FAMILY_ORDER'), 'System UI Screen model should expose object families');
assert(systemUiScreenPreview.includes('ProjectMapSystemUiScreenPreview'), 'System UI Screen preview should expose a browser API');
assert(systemUiScreenPreview.includes('data-system-screen-shell'), 'System UI Screen preview should render the shared shell');
assert(systemUiPreviewSurface.includes('data-system-screen-workspace'), 'System UI surface should expose the unified screen workspace marker');
assert(canvasUi.includes('ProjectMapSystemUiPreviewSurface'), 'Object Canvas should route System UI templates to the dedicated surface');
assert(canvasUi.includes('function renderContentStoryboardStage'), 'Object Canvas should render the Content Storyboard stage');
assert(surfaceGraphs.includes('function systemUiGraphNodes'), 'Surface graph builders should define a System UI graph');
assert(surfaceGraphs.includes('function projectStateGraphNodes'), 'Surface graph builders should define a Project State graph');
assert(contentStoryboardSurface.includes('data-content-storyboard-editor'), 'Content Storyboard should render an editor/detail panel');
assert(canvasUi.includes('data-object-canvas-zoom'), 'Object Canvas should expose zoom controls');
assert(harness.includes('data-content-storyboard-surface'), 'Screenshot harness should assert the Storyboard surface');
assert(harness.includes('workspaceForTemplate'), 'Screenshot harness should verify workspace routing');

process.stdout.write(JSON.stringify({ok: true, workspaces, groupedTemplates}, null, 2) + '\n');
