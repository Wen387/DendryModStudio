#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const workflow = require('./authoring/workflow_entry_contract_model.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');
const graphStage = require('./viewer/object_canvas_graph_stage.js');

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

const draft = {
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'workflow_entry_event',
  title: 'Workflow entry event',
  heading: 'Workflow entry event',
  when: {year: 1936, monthStart: 1, monthEnd: 2, requires: '', priority: 0},
  introParagraphs: ['Every reachable feature needs a visible entry.'],
  effectsOnTrigger: [{variable: 'new_workflow_flag', op: '+=', value: 1}],
  assetInstallRequests: [{
    sourceName: 'workflow.png',
    sourcePath: '/tmp/workflow.png',
    targetPath: 'assets/studio/events/workflow_entry_event/workflow.png',
    type: 'image',
    label: 'Workflow illustration',
    role: 'event_illustration'
  }],
  options: [
    {id: 'continue', label: 'Continue', narrativeParagraphs: ['Continue.'], returnTarget: 'root'},
    {id: 'review', label: 'Review', narrativeParagraphs: ['Review.'], returnTarget: 'root'}
  ]
};

const knownIndex = {
  schemaVersion: '0.1',
  project: {name: 'Workflow Fixture', root: '/tmp/workflow-entry', profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry'}],
  scenes: [
    {id: 'post_event', title: 'Post Event', path: 'source/scenes/post_event.scene.dry'},
    {id: 'parsed_event', title: 'Parsed event', path: 'source/scenes/events/parsed_event.scene.dry'}
  ],
  variables: []
};
const unknownIndex = {
  schemaVersion: '0.1',
  project: {name: 'Workflow Fixture', root: '/tmp/workflow-entry', profileIds: ['unknown-profile']},
  profiles: [{id: 'unknown-profile'}],
  variables: []
};

const knownModel = canvasModel.buildNewEventCanvas(knownIndex, draft, {});
const unknownModel = canvasModel.buildNewEventCanvas(unknownIndex, draft, {});
const textEventModel = canvasModel.buildNewEventCanvas(knownIndex, Object.assign({}, draft, {
  id: 'workflow_text_event',
  title: 'Workflow text event',
  eventShape: 'pure_event',
  subtitle: 'No choices',
  options: [],
  useSeenFlag: false
}), {});
const existingModel = canvasModel.buildCanvasModel(knownIndex, {
  mode: 'existing',
  view: 'events',
  item: {id: 'parsed_event', title: 'Parsed event'}
}, {});
const renderedUi = [
  previewEditor.render(knownModel),
  previewEditor.render(textEventModel),
  previewEditor.renderModal(existingModel),
  graphStage.render(knownModel, {state: {selectedCanvasNode: 'object'}}),
  graphStage.render(unknownModel, {state: {selectedCanvasNode: 'object'}})
].join('\n');
const rendered = [
  read('viewer/index.html'),
  read('viewer/visible_edit_action_ui.js'),
  read('viewer/source_slice_workspace_ui.js'),
  read('viewer/semantic_logic_workspace_ui.js'),
  read('viewer/object_authoring_canvas_ui.js'),
  renderedUi
].join('\n');

const report = workflow.buildWorkflowEntryReport({source: rendered});

assert(report.summary.workflowEntryCoverage === 1, 'all workflow entries should have complete contracts', report.summary);
assert(report.summary.renderedEntryCoverage === 1, 'all workflow entries should have rendered entry markers', report.entries.filter((entry) => !entry.rendered));
assert(report.summary.modelOnlyWorkflowCount === 0, 'no workflow should remain model-only', report.entries.filter((entry) => entry.modelOnly));

const visibleActions = visibleEditActions(renderedUi);
const visibleActionKinds = new Set(visibleActions.map((action) => action.actionKind));
const supportedActions = new Set([
  'open_object_field',
  'open_object_section',
  'open_source_slice',
  'open_variable_editor',
  'open_system_ui_editor',
  'open_linked_event',
  'open_advanced_source_patch',
  'open_route_editor',
  'open_effect_editor',
  'open_profile_router_rule'
]);
assert(visibleActions.length >= 1, 'rendered workflow entries should include dispatchable visible edit actions');
visibleActions.forEach((action) => {
  assert(supportedActions.has(action.actionKind), 'rendered visible edit action should be handled by Object Canvas dispatch', action);
});
['open_route_editor', 'open_effect_editor', 'open_variable_editor', 'open_advanced_source_patch', 'open_profile_router_rule'].forEach((kind) => {
  assert(visibleActionKinds.has(kind), 'workflow fixture should render dispatchable ' + kind + ' action', Array.from(visibleActionKinds).sort());
});

process.stdout.write(JSON.stringify({
  ok: true,
  workflowEntryCoverage: report.summary.workflowEntryCoverage,
  renderedEntryCoverage: report.summary.renderedEntryCoverage,
  modelOnlyWorkflowCount: report.summary.modelOnlyWorkflowCount,
  entries: report.summary.total
}, null, 2) + '\n');

function visibleEditActions(source) {
  const actions = [];
  const regex = /data-visible-edit-action="([^"]+)"/g;
  let match = regex.exec(source);
  while (match) {
    const decoded = decodeHtml(match[1]);
    try {
      const action = JSON.parse(decoded);
      if (action && action.actionKind) {
        actions.push(action);
      }
    } catch (_err) {
      // Ignore malformed source snippets; rendered UI actions must still parse.
    }
    match = regex.exec(source);
  }
  return actions;
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
