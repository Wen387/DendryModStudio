#!/usr/bin/env node
'use strict';

const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');
const {fail, assert} = require('./check_harness.js');

const index = {
  schemaVersion: '0.1',
  project: {name: 'Graph Entry Fixture', root: '/tmp/graph-entry', profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry'}],
  variables: [{name: 'public_order'}]
};

const draft = {
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'graph_entry_event',
  title: 'Graph entry event',
  heading: 'Graph entry event',
  when: {year: 1936, monthStart: 2, monthEnd: 3, requires: '', priority: 0},
  introParagraphs: ['The event graph is a clickable authoring surface.'],
  effectsOnTrigger: [{variable: 'new_signal', op: '+=', value: 1}],
  options: [
    {id: 'organize', label: 'Organize', narrativeParagraphs: ['Organize.'], returnTarget: 'follow_up', effects: [{variable: 'public_order', op: '+=', value: 1}]},
    {id: 'wait', label: 'Wait', narrativeParagraphs: ['Wait.'], returnTarget: 'root'}
  ],
  sections: [{
    id: 'follow_up',
    title: 'Follow-up',
    paragraphs: ['Follow-up text.'],
    exitTarget: 'root'
  }]
};

const model = canvasModel.buildNewEventCanvas(index, draft, {});
const graph = model.eventBody.eventGraph;
const html = previewEditor.render(model) + previewEditor.renderEventReviewDetailsPanels(model.eventBody || {}, model);

assert(graph && graph.kind === 'complex_event_graph', 'complex builder should expose event graph', graph);
assert(graph.nodes.every((node) => node.editAction && node.editAction.actionKind), 'every graph node should have edit action', graph.nodes);
assert(graph.edges.every((edge) => edge.editAction && edge.editAction.actionKind), 'every graph edge should have edit action', graph.edges);
assert(graph.edges.some((edge) => edge.editAction.actionKind === 'open_route_editor'), 'route edges should open route editor', graph.edges);
assert(graph.nodes.some((node) => node.kind === 'trigger_effect' && node.editAction.actionKind === 'open_effect_editor'), 'effect badges should open effect editor', graph.nodes);
assert(graph.nodes.some((node) => node.kind === 'variable' && node.editAction.actionKind === 'open_variable_editor'), 'variable badges should open variable workspace', graph.nodes);
assert(html.includes('data-preview-object-event-graph-node'), 'rendered graph should expose node buttons');
assert(html.includes('data-preview-object-event-graph-edge'), 'rendered graph should expose route edge buttons');
assert(html.includes('data-event-graph-clickable="node"'), 'graph node should have clickable marker');
assert(html.includes('data-event-graph-clickable="edge"'), 'graph edge should have clickable marker');
assert(html.includes('open_route_editor'), 'rendered graph route action should survive encoding');
assert(html.includes('open_effect_editor'), 'rendered graph effect action should survive encoding');
assert(html.includes('open_variable_editor'), 'rendered graph variable action should survive encoding');

process.stdout.write(JSON.stringify({
  ok: true,
  nodeCount: graph.nodeCount,
  edgeCount: graph.edgeCount
}, null, 2) + '\n');
