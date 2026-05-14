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
const rendered = [
  read('viewer/index.html'),
  read('viewer/visible_edit_action_ui.js'),
  read('viewer/source_slice_workspace_ui.js'),
  read('viewer/semantic_logic_workspace_ui.js'),
  read('viewer/object_authoring_canvas_ui.js'),
  previewEditor.render(knownModel),
  graphStage.render(knownModel, {state: {selectedCanvasNode: 'object'}}),
  graphStage.render(unknownModel, {state: {selectedCanvasNode: 'object'}})
].join('\n');

const report = workflow.buildWorkflowEntryReport({source: rendered});

assert(report.summary.workflowEntryCoverage === 1, 'all workflow entries should have complete contracts', report.summary);
assert(report.summary.renderedEntryCoverage === 1, 'all workflow entries should have rendered entry markers', report.entries.filter((entry) => !entry.rendered));
assert(report.summary.modelOnlyWorkflowCount === 0, 'no workflow should remain model-only', report.entries.filter((entry) => entry.modelOnly));

process.stdout.write(JSON.stringify({
  ok: true,
  workflowEntryCoverage: report.summary.workflowEntryCoverage,
  renderedEntryCoverage: report.summary.renderedEntryCoverage,
  modelOnlyWorkflowCount: report.summary.modelOnlyWorkflowCount,
  entries: report.summary.total
}, null, 2) + '\n');
