#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const VIEWER = path.join(ROOT, 'viewer');
const INDEX = path.join(VIEWER, 'index.html');
const AUTHORING_SURFACE_REGISTRY = path.join(VIEWER, 'authoring_surface_registry.js');
const AUTHORING_SURFACE_GRAPHS = path.join(VIEWER, 'authoring_surface_graphs.js');
const AUTHORING_REFERENCE_INDEX = path.join(VIEWER, 'authoring_reference_index.js');
const CONTENT_GRAPH_INTERACTIONS = path.join(VIEWER, 'content_graph_interactions.js');
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
const surfaceRegistry = read(AUTHORING_SURFACE_REGISTRY);
const surfaceGraphs = read(AUTHORING_SURFACE_GRAPHS);
const referenceIndex = read(AUTHORING_REFERENCE_INDEX);
const contentInteractions = read(CONTENT_GRAPH_INTERACTIONS);
const workspaceUi = read(AUTHORING_WORKSPACE_UI);
const canvasUi = read(OBJECT_CANVAS_UI);
const harness = read(HARNESS);

const workspaces = ['content', 'system_ui', 'project_state'];
const groupedTemplates = {
  content: ['event', 'news', 'card', 'surface'],
  system_ui: ['entry', 'play_surface', 'workspace_layout', 'sidebar_status'],
  project_state: ['variables', 'project']
};

assert(html.includes('data-authoring-workspace-nav'), 'Create should keep a small Authoring Workspace host in index.html');
assert(html.includes('authoring_surface_registry.js'), 'viewer should load the Authoring Surface registry before workspace UI');
assert(html.includes('authoring_surface_graphs.js'), 'viewer should load authoring surface graph builders');
assert(html.includes('authoring_reference_index.js'), 'viewer should load authoring reference index helpers');
assert(html.includes('content_graph_interactions.js'), 'viewer should load Content Graph interactions');
assert(surfaceRegistry.includes('content_graph'), 'Surface registry should define the Content Graph surface');
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

assert(surfaceRegistry.includes("defaultTemplate: 'entry'"), 'System UI workspace should default to Entry & Sidebar');
assert(surfaceRegistry.includes("defaultTemplate: 'variables'"), 'Project State workspace should default to Variables');
assert(workspaceUi.includes('ProjectMapAuthoringSurfaceRegistry'), 'Workspace navigation should consume the shared surface registry');
assert(canvasUi.includes('ProjectMapAuthoringSurfaceRegistry'), 'Object Canvas should consume the shared surface registry');
assert(canvasUi.includes('data-authoring-surface'), 'Object Canvas should expose the active authoring surface');
assert(surfaceGraphs.includes('ProjectMapAuthoringSurfaceGraphs'), 'Surface graph builders should expose a browser API');
assert(surfaceGraphs.includes('draftBranches'), 'Content Graph should support related draft nodes');
assert(referenceIndex.includes('contentContext'), 'Reference index should expose selected content global context');
assert(referenceIndex.includes('branchDraft'), 'Reference index should create related branch drafts');
assert(contentInteractions.includes('pointerdown'), 'Content Graph interactions should bind pointer drag behavior');
assert(contentInteractions.includes('onViewport'), 'Content Graph interactions should support background pan');
assert(canvasUi.includes('data-content-global-context'), 'Content Graph inspector should show global context');
assert(canvasUi.includes('data-content-creation-actions'), 'Content Graph inspector should expose object-first creation actions');
assert(canvasUi.includes('is-editor-overlay'), 'Object Canvas should support editor overlay mode');
assert(canvasUi.includes('function canvasGraphForModel'), 'Object Canvas should build a workspace-specific graph model');
assert(surfaceGraphs.includes('function systemUiGraphNodes'), 'Surface graph builders should define a System UI graph');
assert(surfaceGraphs.includes('function projectStateGraphNodes'), 'Surface graph builders should define a Project State graph');
assert(canvasUi.includes('data-object-canvas-graph-inspector'), 'Object Canvas should render a graph inspector');
assert(canvasUi.includes('data-object-canvas-zoom'), 'Object Canvas should expose zoom controls');
assert(harness.includes('data-object-canvas-graph-canvas'), 'Screenshot harness should assert the graph canvas surface');
assert(harness.includes('workspaceForTemplate'), 'Screenshot harness should verify workspace routing');

process.stdout.write(JSON.stringify({ok: true, workspaces, groupedTemplates}, null, 2) + '\n');
