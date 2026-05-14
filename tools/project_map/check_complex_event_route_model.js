#!/usr/bin/env node
'use strict';

const eventDraft = require('./authoring/event_draft.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

function codes(result) {
  return result.diagnostics.map((item) => item.code);
}

const index = {
  schemaVersion: '0.1',
  project: {name: 'Route Fixture', root: '/tmp/dms-route-fixture', profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry'}],
  scenes: [],
  variables: [{name: 'public_order'}, {name: 'year'}, {name: 'month'}]
};

const baseDraft = {
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'route_authoring_event',
  title: 'Route authoring event',
  heading: 'Route authoring event',
  when: {year: 1936, monthStart: 1, monthEnd: 3, requires: '', priority: 0},
  introParagraphs: ['Route editor fixture.'],
  options: [
    {id: 'first', label: 'First path', narrativeParagraphs: ['First result.'], returnTarget: 'follow_up'},
    {id: 'second', label: 'Second path', narrativeParagraphs: ['Second result.'], returnTarget: 'root'}
  ],
  sections: [{
    id: 'follow_up',
    title: 'Follow-up',
    paragraphs: ['Follow-up body.'],
    exitTarget: 'root'
  }]
};

const valid = eventDraft.validateDraft(baseDraft, index);
assert(valid.ok, 'returnTarget should resolve to a same-event section', valid.diagnostics);
const scene = eventDraft.renderSceneDry(baseDraft, index);
assert(scene.includes('@continue_first\n' + 'go-to: follow_up'), 'rendered result route should go to follow_up', scene);
assert(scene.includes('@follow_up'), 'rendered scene should include follow-up section anchor', scene);
assert(scene.includes('go-to: root'), 'rendered section exit route should return to root', scene);

const invalidDraft = JSON.parse(JSON.stringify(baseDraft));
invalidDraft.options[0].returnTarget = 'missing_follow_up';
const invalid = eventDraft.validateDraft(invalidDraft, index);
assert(!invalid.ok && codes(invalid).includes('event_draft.missing_route_target'), 'missing route target should block Review & Apply', invalid.diagnostics);

const updated = canvasModel.buildNewEventCanvas(index, baseDraft, {
  values: {
    'option.0.returnTarget': 'root',
    'event.section.0.exitTarget': 'follow_up'
  }
});
assert(updated.ok, 'route field edits should keep the draft valid', updated.changeState.diagnostics);
assert(updated.changeState.draft.options[0].returnTarget === 'root', 'option return route field should write back to EventDraft');
assert(updated.changeState.draft.sections[0].exitTarget === 'follow_up', 'section exit route field should write back to EventDraft');
assert(updated.eventBody.options[0].fields.some((field) => field.id === 'option.0.returnTarget' && field.role === 'route'), 'route editor field should be exposed on options');
assert(updated.eventBody.branchSections.some((field) => field.id === 'event.section.0.exitTarget' && field.role === 'route'), 'route editor field should be exposed on follow-up sections');
assert(updated.eventBody.eventGraph.edges.some((edge) => edge.kind === 'exit_route' && edge.targetId === 'follow_up'), 'event graph should reflect edited section exit route');

process.stdout.write(JSON.stringify({
  ok: true,
  routeFields: updated.eventBody.options[0].fields.filter((field) => field.role === 'route').length,
  graphEdges: updated.eventBody.eventGraph.edgeCount
}, null, 2) + '\n');
