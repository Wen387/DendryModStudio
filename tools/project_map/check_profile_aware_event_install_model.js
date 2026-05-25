#!/usr/bin/env node
'use strict';

const eventDraft = require('./authoring/event_draft.js');
const installPlan = require('./authoring/install_plan.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');

const {fail, assert} = require('./check_harness.js');

const draft = {
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'profile_router_event',
  title: 'Profile router event',
  heading: 'Profile router event',
  when: {year: 1936, monthStart: 1, monthEnd: 3, requires: '', priority: 0},
  introParagraphs: ['A profile-aware install fixture.'],
  options: [
    {id: 'first', label: 'First path', narrativeParagraphs: ['First result.']},
    {id: 'second', label: 'Second path', narrativeParagraphs: ['Second result.']}
  ]
};

const knownIndex = {
  schemaVersion: '0.1',
  project: {name: 'Known Profile', root: '/tmp/dms-known-profile', profileIds: ['sdaah-style', 'generic-dendry']},
  profiles: [{id: 'sdaah-style'}, {id: 'generic-dendry'}],
  scenes: [{
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
  }],
  variables: [{name: 'year'}, {name: 'month'}],
  semantic: {parserEvidence: {monthlyPopupRouterTable: []}}
};

const knownBundle = eventDraft.buildExportBundle(draft, knownIndex);
const routerOp = knownBundle.installPlan.operations.find((op) => op.id === 'event_router_registration');
assert(routerOp, 'known profile should generate a router registration operation', knownBundle.installPlan.operations);
assert(routerOp.type === 'insert_text', 'router registration should be an executable insert_text operation', routerOp);
assert(routerOp.safety === 'advanced_apply', 'protected post_event router registration should require advanced apply', routerOp);
assert(routerOp.path === 'source/scenes/post_event.scene.dry', 'router registration should target post_event router source', routerOp);
assert(routerOp.content.includes('- #event'), 'router registration should create or verify the monthly #event lane', routerOp);
assert(installPlan.operationSummary(knownBundle.installPlan).manualReview === 0, 'known profile event install should not produce manual snippets', knownBundle.installPlan);
assert(installPlan.operationSummary(knownBundle.installPlan).advancedApply === 1, 'known profile event install should count router advanced apply', knownBundle.installPlan);
assert(knownBundle.installNotes.includes('profile-aware router registration'), 'install notes should explain the generated router registration', knownBundle.installNotes);

const knownCanvas = canvasModel.buildNewEventCanvas(knownIndex, draft, {});
assert(knownCanvas.contextBoard.manualBoundaries.some((row) => row.status === 'advanced_apply'), 'Object Canvas should describe known profile router apply as advanced, not manual', knownCanvas.contextBoard.manualBoundaries);
assert(knownCanvas.eventBody.readinessChecklist.some((item) => item.id === 'router_registration' && item.ok), 'readiness should mark known profile router registration ready', knownCanvas.eventBody.readinessChecklist);

const missingAnchorIndex = {
  schemaVersion: '0.1',
  project: {name: 'Known Profile Missing Anchor', root: '/tmp/dms-known-profile-no-anchor', profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry'}],
  scenes: [],
  variables: [{name: 'year'}, {name: 'month'}],
  semantic: {}
};
const missingAnchorBundle = eventDraft.buildExportBundle(Object.assign({}, draft, {id: 'known_profile_missing_anchor', seenFlag: 'known_profile_missing_anchor_seen'}), missingAnchorIndex);
assert(!missingAnchorBundle.installPlan.operations.some((op) => op.id === 'event_router_registration'), 'known profile without a router anchor should not invent a router operation', missingAnchorBundle.installPlan.operations);
const missingAnchorCanvas = canvasModel.buildNewEventCanvas(missingAnchorIndex, draft, {});
assert(missingAnchorCanvas.eventBody.readinessChecklist.some((item) => item.id === 'router_registration' && !item.ok), 'known profile without router anchor should keep readiness blocked', missingAnchorCanvas.eventBody.readinessChecklist);

const unknownIndex = {
  schemaVersion: '0.1',
  project: {name: 'Unknown Profile', root: '/tmp/dms-unknown-profile', profileIds: ['custom-router']},
  profiles: [{id: 'custom-router'}],
  scenes: [],
  variables: [{name: 'year'}, {name: 'month'}],
  semantic: {}
};
const unknownBundle = eventDraft.buildExportBundle(Object.assign({}, draft, {id: 'unknown_profile_router_event', seenFlag: 'unknown_profile_router_event_seen'}), unknownIndex);
assert(!unknownBundle.installPlan.operations.some((op) => op.id === 'event_router_registration'), 'unknown profile should not invent a router operation', unknownBundle.installPlan.operations);
assert(unknownBundle.installNotes.includes('Router registration is pending'), 'unknown profile install notes should name pending profile wiring', unknownBundle.installNotes);
const unknownCanvas = canvasModel.buildNewEventCanvas(unknownIndex, draft, {});
assert(unknownCanvas.contextBoard.manualBoundaries.some((row) => row.status === 'pending_profile_rule'), 'unknown profile should surface pending profile rule context', unknownCanvas.contextBoard.manualBoundaries);
assert(unknownCanvas.eventBody.readinessChecklist.some((item) => item.id === 'router_registration' && !item.ok), 'unknown profile readiness should block router registration', unknownCanvas.eventBody.readinessChecklist);

process.stdout.write(JSON.stringify({
  ok: true,
  knownOperations: knownBundle.installPlan.operations.length,
  unknownOperations: unknownBundle.installPlan.operations.length,
  routerSafety: routerOp.safety
}, null, 2) + '\n');
