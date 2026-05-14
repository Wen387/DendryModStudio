#!/usr/bin/env node
'use strict';

const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

const index = {
  schemaVersion: '0.1',
  project: {name: 'Complex Event Builder Fixture', root: '/tmp/dms-complex-event', profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry'}],
  scenes: [
    {id: 'root', path: 'source/scenes/root.scene.dry'},
    {id: 'post_event', title: 'Post Event', path: 'source/scenes/post_event.scene.dry'}
  ],
  variables: [
    {name: 'public_order', reads: [], writes: [], tags: ['state']},
    {name: 'civil_society_trust', reads: [], writes: [], tags: ['state']},
    {name: 'year'},
    {name: 'month'}
  ],
  semantic: {events: [], cards: [], news: {sources: []}}
};

const draft = {
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'complex_event_builder',
  title: 'Complex event builder',
  heading: 'Complex event builder',
  when: {year: 1936, monthStart: 2, monthEnd: 4, requires: 'public_order >= 0', priority: 1},
  introParagraphs: ['The player starts from a structured event draft instead of a raw source slice.'],
  effectsOnTrigger: [{variable: 'new_campaign_signal', op: '+=', value: 1}],
  assetRefs: [{path: 'assets/events/complex_event_builder.png', type: 'image', label: 'Event illustration', role: 'event_illustration'}],
  options: [
    {id: 'organize', label: 'Organize the response', subtitle: '+ order', chooseIf: 'public_order >= 0', unavailableText: 'Public order is too low.', narrativeParagraphs: ['The organizers act in public.'], returnTarget: 'follow_up', effects: [{variable: 'public_order', op: '+=', value: 1}]},
    {id: 'negotiate', label: 'Negotiate quietly', narrativeParagraphs: ['A quieter route opens.'], returnTarget: 'root', effects: [{variable: 'civil_society_trust', op: '+=', value: 1}]},
    {id: 'delay', label: 'Delay the decision', narrativeParagraphs: ['The meeting waits.'], returnTarget: 'root'},
    {id: 'publish', label: 'Publish the statement', narrativeParagraphs: ['The statement reaches the press.'], returnTarget: 'root'}
  ],
  sections: [{
    id: 'follow_up',
    title: 'Follow-up layer',
    condition: 'public_order >= 1',
    paragraphs: ['A second layer appears when the first choice changed the state.'],
    exitTarget: 'root',
    options: [{
      id: 'nested_choice',
      label: 'Choose a nested response',
      narrativeParagraphs: ['The nested response resolves.'],
      effects: [{variable: 'public_order', op: '+=', value: 2}]
    }]
  }]
};

const model = canvasModel.buildNewEventCanvas(index, draft, {});

assert(model.ok, 'complex event draft should build from zero', model.changeState.diagnostics);
assert(model.mode === 'new_event', 'complex builder should use the new_event Object Canvas flow', model.mode);
assert(model.eventBody.options.filter((option) => !option.sectionId).length === 4, 'builder should preserve four root options', model.eventBody.options);
assert(model.eventBody.options.some((option) => option.sectionId === 'follow_up'), 'builder should expose section-owned options', model.eventBody.options);
assert(model.eventBody.branchSections.some((field) => field.id === 'event.section.0.title'), 'branch editor should expose section title');
assert(model.eventBody.branchSections.some((field) => field.id === 'event.section.0.condition'), 'branch editor should expose section condition');
assert(model.eventBody.branchSections.some((field) => field.id === 'event.section.0.exitTarget'), 'branch editor should expose section exit route');
assert(model.eventBody.eventGraph && model.eventBody.eventGraph.kind === 'complex_event_graph', 'builder should expose a clickable event graph model', model.eventBody.eventGraph);
assert(model.eventBody.eventGraph.nodes.every((node) => node.editAction && node.editAction.actionKind), 'event graph nodes should be clickable/editable', model.eventBody.eventGraph.nodes);
assert(model.eventBody.eventGraph.edges.some((edge) => edge.kind === 'return_route' && edge.targetId === 'follow_up'), 'event graph should show option return routes', model.eventBody.eventGraph.edges);
assert(model.eventBody.readinessChecklist.every((item) => item.id !== 'routes_resolve' || item.ok), 'readiness should pass route resolution for the complex draft', model.eventBody.readinessChecklist);
assert(model.contextBoard.variables.some((row) => row.name === 'new_campaign_signal' && row.status === 'new_or_missing' && row.createAction), 'unknown effect variable should expose a create-variable action', model.contextBoard.variables);
assert(model.contextBoard.manualBoundaries.some((row) => row.label === 'Profile-aware router registration' && row.status === 'advanced_apply'), 'known profile should expose profile-aware router registration context', model.contextBoard.manualBoundaries);
assert(model.changeState.installPlan.operations.some((op) => op.id === 'event_router_registration' && op.safety === 'advanced_apply'), 'install plan should include advanced router registration');
assert(model.changeState.installPlan.operations.some((op) => op.id.indexOf('event_variable_init_new_campaign_signal') === 0 && op.safety === 'guarded_apply'), 'install plan should initialize new event variables');
assert(!model.changeState.installPlan.operations.some((op) => op.type === 'manual_snippet'), 'known-profile complex event path should not fall back to manual snippets');

const html = previewEditor.render(model);
assert(html.includes('data-preview-object-event-graph="true"'), 'UI should render the event graph summary');
assert(html.includes('data-preview-object-readiness="true"'), 'UI should render install readiness');
assert(html.includes('After result route'), 'UI should expose option return route fields');

process.stdout.write(JSON.stringify({
  ok: true,
  rootOptions: model.eventBody.options.filter((option) => !option.sectionId).length,
  graphNodes: model.eventBody.eventGraph.nodeCount,
  operations: model.changeState.installPlan.operations.length
}, null, 2) + '\n');
