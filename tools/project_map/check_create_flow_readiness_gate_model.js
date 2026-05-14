#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
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

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

const unknownProfile = {
  schemaVersion: '0.1',
  project: {name: 'Readiness Fixture', root: '/tmp/readiness-fixture', profileIds: ['unknown-profile']},
  profiles: [{id: 'unknown-profile'}],
  variables: []
};

const blockedDraft = {
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'blocked_readiness_event',
  title: 'Blocked readiness event',
  heading: '',
  when: {year: 1936, monthStart: 1, monthEnd: 1, requires: '', priority: 0},
  introParagraphs: [''],
  effectsOnTrigger: [{variable: 'new_flag', op: '*=', value: 2}],
  options: [
    {id: 'only', label: '', narrativeParagraphs: [''], returnTarget: 'missing_target'}
  ]
};

const readyProfile = {
  schemaVersion: '0.1',
  project: {name: 'Readiness Fixture', root: '/tmp/readiness-fixture', profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry'}],
  variables: []
};
const readyDraft = {
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'ready_readiness_event',
  title: 'Ready readiness event',
  heading: 'Ready readiness event',
  when: {year: 1936, monthStart: 1, monthEnd: 1, requires: '', priority: 0},
  introParagraphs: ['Ready text.'],
  effectsOnTrigger: [{variable: 'new_flag', op: '+=', value: 1}],
  options: [
    {id: 'first', label: 'First', narrativeParagraphs: ['First result.'], returnTarget: 'root'},
    {id: 'second', label: 'Second', narrativeParagraphs: ['Second result.'], returnTarget: 'root'}
  ]
};

const blocked = canvasModel.buildNewEventCanvas(unknownProfile, blockedDraft, {});
const ready = canvasModel.buildNewEventCanvas(readyProfile, readyDraft, {});
const blockedRows = blocked.eventBody.readinessChecklist.filter((row) => !row.ok);
const blockedHtml = previewEditor.render(blocked);
const objectUi = read('viewer/object_authoring_canvas_ui.js');

assert(blockedRows.length >= 1, 'invalid draft should produce blocked readiness rows', blocked.eventBody.readinessChecklist);
assert(blockedRows.every((row) => row.repairAction && row.repairAction.actionKind), 'each blocker should expose a repair action', blockedRows);
assert(blockedHtml.includes('data-readiness-repair-action'), 'blocked readiness should render repair buttons');
assert(blockedHtml.includes('data-visible-edit-action'), 'readiness repair should dispatch through visible edit action');
assert(objectUi.includes('eventReadinessReviewAllowed()'), 'Object Canvas should gate Review & Apply on event readiness');
assert(objectUi.includes('dataset.reviewReadinessGate'), 'review button should expose readiness gate state');
assert(ready.eventBody.readinessChecklist.every((row) => row.ok), 'fixed draft should pass readiness', ready.eventBody.readinessChecklist);
assert(ready.changeState.installPlan && ready.changeState.installPlan.operations.length >= 1, 'ready draft should produce an install plan');

process.stdout.write(JSON.stringify({
  ok: true,
  blocked: blockedRows.length,
  readyOperations: ready.changeState.installPlan.operations.length
}, null, 2) + '\n');
