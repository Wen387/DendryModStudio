#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const viewer = require('./viewer/app.js');
const installPlan = require('./authoring/install_plan.js');
const eventDraft = require('./authoring/event_draft.js');
const cardDraft = require('./authoring/card_draft.js');

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

const index = {
  schemaVersion: '0.1',
  project: {name: 'Asset Workflow Fixture', root: '/tmp/asset-workflow', profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry'}],
  semantic: {
    assets: {
      items: [{
        id: 'existing_art',
        name: 'existing-art.png',
        path: 'assets/existing/existing-art.png',
        type: 'image',
        sourceKind: 'source_asset',
        editability: 'reference_only'
      }]
    }
  }
};

const request = {
  sourceName: 'New Art.png',
  sourcePath: '/tmp/New Art.png',
  targetPath: 'assets/studio/events/asset_workflow_event/new-art.png',
  type: 'image',
  label: 'New Art',
  role: 'event_illustration'
};

const eventBundle = eventDraft.buildExportBundle({
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'asset_workflow_event',
  title: 'Asset workflow event',
  heading: 'Asset workflow event',
  when: {year: 1936, monthStart: 1, monthEnd: 1, requires: '', priority: 0},
  introParagraphs: ['Asset workflow text.'],
  assetInstallRequests: [request],
  options: [
    {id: 'first', label: 'First', narrativeParagraphs: ['First.'], returnTarget: 'root'},
    {id: 'second', label: 'Second', narrativeParagraphs: ['Second.'], returnTarget: 'root'}
  ]
}, index);

const cardBundle = cardDraft.buildExportBundle({
  schemaVersion: '0.1',
  kind: 'card',
  id: 'asset_workflow_card',
  title: 'Asset workflow card',
  introParagraphs: ['Card asset text.'],
  assetInstallRequests: [Object.assign({}, request, {targetPath: 'assets/studio/cards/asset_workflow_card/new-art.png', role: 'card_image'})],
  options: [
    {id: 'first', label: 'First', narrativeParagraphs: ['First.'], gotoAfter: 'root'}
  ]
}, index);

const pickerEvent = viewer.renderAssetPicker(index, {target: 'event', selectedPath: 'assets/existing/existing-art.png'});
const pickerCard = viewer.renderAssetPicker(index, {target: 'card', selectedPath: 'assets/existing/existing-art.png'});
const eventCopy = eventBundle.installPlan.operations.find((op) => op.type === 'copy_asset_file');
const cardCopy = cardBundle.installPlan.operations.find((op) => op.type === 'copy_asset_file');
const en = read('viewer/i18n/en.js');
const zh = read('viewer/i18n/zh-Hant.js');
const html = read('viewer/index.html');

assert(pickerEvent.includes('asset-picker') && pickerEvent.includes('data-asset-target="event"'), 'Event builder should render asset picker entry');
assert(pickerCard.includes('asset-picker') && pickerCard.includes('data-asset-target="card"'), 'Card builder should render asset picker entry');
assert(eventCopy && eventCopy.sourcePath === '/tmp/New Art.png', 'event install plan should include asset copy source path', eventBundle.installPlan);
assert(cardCopy && cardCopy.path.includes('assets/studio/cards/asset_workflow_card'), 'card install plan should include asset copy target', cardBundle.installPlan);
assert(installPlan.classifyOperation(eventCopy).status === 'guarded_apply', 'source-backed asset copy should be guarded apply', eventCopy);
assert(!/This slice still does not copy files automatically/.test(en + zh + html), 'stale no-copy asset install copy should be removed');
assert(en.includes('guarded asset copy operations') && zh.includes('guarded 資產複製操作'), 'asset install helper should describe guarded copy operations');

process.stdout.write(JSON.stringify({
  ok: true,
  eventCopySafety: installPlan.classifyOperation(eventCopy).status,
  cardTarget: cardCopy.path
}, null, 2) + '\n');
