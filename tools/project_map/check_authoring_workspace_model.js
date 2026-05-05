#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const VIEWER = path.join(ROOT, 'viewer');
const INDEX = path.join(VIEWER, 'index.html');
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

workspaces.forEach((workspace) => {
  assert(workspaceUi.includes("key: '" + workspace + "'"), workspace + ' workspace should be available in Create');
  assert(workspaceUi.includes('data-authoring-template-group'), workspace + ' templates should be grouped under their workspace');
  assert(workspaceUi.includes(workspace), workspace + ' should be known to the workspace controller');
});

Object.keys(groupedTemplates).forEach((workspace) => {
  groupedTemplates[workspace].forEach((template) => {
    assert(workspaceUi.includes("key: '" + template + "'"), template + ' should stay reachable from Create');
    assert(workspaceUi.includes(template + ": '" + workspace + "'"), template + ' should map to the ' + workspace + ' workspace');
  });
});

assert(workspaceUi.includes("system_ui: 'entry'"), 'System UI workspace should default to Entry & Sidebar');
assert(workspaceUi.includes("project_state: 'variables'"), 'Project State workspace should default to Variables');
assert(canvasUi.includes('function canvasGraphForModel'), 'Object Canvas should build a workspace-specific graph model');
assert(canvasUi.includes('function systemUiGraphNodes'), 'Object Canvas should define a System UI graph');
assert(canvasUi.includes('function projectStateGraphNodes'), 'Object Canvas should define a Project State graph');
assert(canvasUi.includes('data-object-canvas-graph-inspector'), 'Object Canvas should render a graph inspector');
assert(canvasUi.includes('data-object-canvas-zoom'), 'Object Canvas should expose zoom controls');
assert(harness.includes('data-object-canvas-graph-canvas'), 'Screenshot harness should assert the graph canvas surface');
assert(harness.includes('workspaceForTemplate'), 'Screenshot harness should verify workspace routing');

process.stdout.write(JSON.stringify({ok: true, workspaces, groupedTemplates}, null, 2) + '\n');
