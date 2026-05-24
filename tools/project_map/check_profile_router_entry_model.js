#!/usr/bin/env node
'use strict';

const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const graphStage = require('./viewer/object_canvas_graph_stage.js');

const {fail, assert} = require('./check_harness.js');

function indexWithProfile(id) {
  const index = {
    schemaVersion: '0.1',
    project: {name: 'Router Fixture', root: '/tmp/router-fixture', profileIds: [id]},
    profiles: [{id}],
    variables: []
  };
  if (id === 'generic-dendry') {
    index.scenes = [{
      id: 'post_event',
      title: 'Post Event',
      path: 'source/scenes/post_event.scene.dry',
      options: [{
        target: {id: 'root'},
        title: 'Continue',
        sourceSpan: {
          path: 'source/scenes/post_event.scene.dry',
          line: 28,
          anchorText: '- @root: Continue',
          endAnchorText: '- @root: Continue'
        }
      }]
    }];
  }
  return index;
}

const draft = {
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'router_entry_event',
  title: 'Router entry event',
  heading: 'Router entry event',
  when: {year: 1936, monthStart: 1, monthEnd: 1, requires: '', priority: 0},
  introParagraphs: ['Router entry text.'],
  options: [
    {id: 'first', label: 'First', narrativeParagraphs: ['First.'], returnTarget: 'root'},
    {id: 'second', label: 'Second', narrativeParagraphs: ['Second.'], returnTarget: 'root'}
  ]
};

const known = canvasModel.buildNewEventCanvas(indexWithProfile('generic-dendry'), draft, {});
const unknown = canvasModel.buildNewEventCanvas(indexWithProfile('unknown-profile'), draft, {});
const knownHtml = graphStage.render(known, {state: {selectedCanvasNode: 'object'}});
const unknownHtml = graphStage.render(unknown, {state: {selectedCanvasNode: 'object'}});

const knownBoundary = known.contextBoard.manualBoundaries.find((row) => row.label === 'Profile-aware router registration');
const unknownBoundary = unknown.contextBoard.manualBoundaries.find((row) => row.status === 'pending_profile_rule');

assert(knownBoundary && knownBoundary.action && knownBoundary.action.actionKind === 'open_advanced_source_patch', 'known profile should expose router registration action', known.contextBoard.manualBoundaries);
assert(known.changeState.installPlan.operations.some((op) => op.id === 'event_router_registration' && op.safety === 'advanced_apply'), 'known profile should create advanced router operation', known.changeState.installPlan);
assert(knownHtml.includes('data-workflow-entry="profile-router-registration"'), 'known profile router registration should render a workflow entry');
assert(unknownBoundary && unknownBoundary.action && unknownBoundary.action.actionKind === 'open_profile_router_rule', 'unknown profile should expose profile rule repair action', unknown.contextBoard.manualBoundaries);
assert(unknown.eventBody.readinessChecklist.some((row) => row.id === 'router_registration' && !row.ok && row.repairAction && row.repairAction.actionKind === 'open_profile_router_rule'), 'unknown profile readiness should expose router repair action', unknown.eventBody.readinessChecklist);
assert(unknownHtml.includes('data-workflow-entry="profile-router-rule"'), 'unknown profile should render profile rule entry');
assert(!unknown.changeState.installPlan.operations.some((op) => op.id === 'event_router_registration'), 'unknown profile should not pretend router registration succeeded', unknown.changeState.installPlan);

process.stdout.write(JSON.stringify({
  ok: true,
  knownRouterSafety: known.changeState.installPlan.operations.find((op) => op.id === 'event_router_registration').safety,
  unknownStatus: unknownBoundary.status
}, null, 2) + '\n');
