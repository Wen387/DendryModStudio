#!/usr/bin/env node
'use strict';

const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');
const {syntheticIndex} = require('./fixtures/archetype_authoring_fixture.js');

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#96;/g, '`')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function attrValue(tag, name) {
  const match = new RegExp(name + '="([^"]*)"').exec(tag);
  return match ? decodeHtml(match[1]) : '';
}

function renderedEntries(html) {
  const rows = [];
  const regex = /<[^>]*data-rendered-authoring-entry="true"[^>]*>/g;
  let match = regex.exec(html);
  while (match) {
    const tag = match[0];
    let action = null;
    try {
      action = JSON.parse(attrValue(tag, 'data-visible-edit-action') || '{}');
    } catch (_err) {
      action = null;
    }
    rows.push({
      kind: attrValue(tag, 'data-rendered-entry-kind'),
      action,
      focusable: /tabindex="0"/.test(tag),
      aria: attrValue(tag, 'aria-label')
    });
    match = regex.exec(html);
  }
  return rows;
}

const index = syntheticIndex();
const samples = [
  ['events', 'economic_expansion', ['text', 'metadata', 'condition', 'effect']],
  ['events', 'banking_crisis', ['option', 'route']],
  ['events', 'blutmai', ['section', 'route']],
  ['cards', 'economic_policy', ['option', 'route']],
  ['cards', 'sender', ['option', 'route']]
];

const allEntries = [];
samples.forEach(([view, id, expectedKinds]) => {
  const model = canvasModel.buildExistingCanvas(index, view, id, {});
  assert(model.ok, id + ' should build an existing Object Canvas model');
  const entries = renderedEntries(previewEditor.renderModal(model, {}));
  const lensCount = (previewEditor.renderModal(model, {}).match(/data-authoring-context-lens="true"/g) || []).length;
  const kinds = new Set(entries.map((entry) => entry.kind));
  expectedKinds.forEach((kind) => {
    assert(kinds.has(kind), id + ' preview should render authoring entry kind: ' + kind, Array.from(kinds).sort());
  });
  entries.forEach((entry) => {
    assert(entry.focusable, id + ' rendered entry should be keyboard focusable', entry);
    assert(entry.aria, id + ' rendered entry should have an aria label', entry);
    assert(entry.action && entry.action.actionKind, id + ' rendered entry should carry a dispatchable action', entry);
  });
  assert(lensCount >= entries.length, id + ' rendered entries should expose context lens affordances', {lensCount, entryCount: entries.length});
  allEntries.push.apply(allEntries, entries);
});

const variableModel = {
  mode: 'existing',
  objectKind: 'event',
  objectId: 'variable_preview',
  title: 'Variable preview',
  eventBody: {
    title: {id: 'variable.title', label: 'Title', value: 'Variable preview', original: 'Variable preview', status: 'guarded'},
    sections: [{id: 'variable.body', label: 'Body', value: 'Variable body.', original: 'Variable body.', status: 'guarded'}],
    variables: [{name: 'budget', reads: [{path: 'source/scenes/events/variable.scene.dry', line: 4}], writes: []}]
  },
  changeState: {draft: {}, operationSummary: {}, changedCount: 0}
};
const variableEntries = renderedEntries(previewEditor.renderModal(variableModel, {}));
assert(variableEntries.some((entry) => entry.kind === 'variable' && entry.action && entry.action.actionKind === 'open_variable_editor'), 'preview variables should open the variable workspace', variableEntries);

const longConditionModel = {
  mode: 'existing',
  objectKind: 'event',
  objectId: 'long_condition_preview',
  title: 'Long condition preview',
  eventBody: {
    title: {id: 'long.title', label: 'Title', value: 'Long condition preview', original: 'Long condition preview', status: 'guarded'},
    metaFields: [{
      id: 'long.choice.condition',
      label: 'Choice condition: Empower workers to seize the factories!',
      value: 'left_strength > reformist_strength + neorevisionist_strength and (judicial_reform >= 3 or rb_militancy >= 0.25) and works_councils >= 1',
      original: 'left_strength > reformist_strength + neorevisionist_strength and (judicial_reform >= 3 or rb_militancy >= 0.25) and works_councils >= 1',
      role: 'condition',
      status: 'guarded',
      source: {path: 'source/scenes/events/long_condition.scene.dry', line: 12}
    }],
    sections: [{id: 'long.body', label: 'Body', value: 'Long condition body.', original: 'Long condition body.', status: 'guarded'}]
  },
  changeState: {draft: {}, operationSummary: {}, changedCount: 0}
};
const longConditionHtml = previewEditor.renderModal(longConditionModel, {});
assert(longConditionHtml.includes('data-metadata-kind="condition" data-metadata-layout="block"'), 'long condition metadata should use the readable block layout');
assert(longConditionHtml.includes('<strong>Choice condition</strong><small>Empower workers to seize the factories!</small>'), 'long condition metadata should split the field label from the option context');
assert(longConditionHtml.includes('\nand (judicial_reform'), 'long condition metadata should format logical operators on readable lines');

const effectActions = allEntries.filter((entry) => entry.kind === 'effect').map((entry) => entry.action);
assert(effectActions.length >= 1, 'effect rows should be rendered entries');
effectActions.forEach((action) => {
  assert(action.actionKind === 'open_effect_editor', 'effect entries should dispatch to the effect editor', action);
  assert(action.semanticEditor && action.semanticEditor.kind === 'effect_clause', 'effect entries should carry effect semantic editor metadata', action);
});

const routeActions = allEntries.filter((entry) => entry.kind === 'route' || entry.kind === 'condition').map((entry) => entry.action);
assert(routeActions.length >= 1, 'route/condition rows should be rendered entries');
routeActions.forEach((action) => {
  assert(action.actionKind === 'open_route_editor', 'route/condition entries should dispatch to the route editor', action);
});

process.stdout.write(JSON.stringify({
  ok: true,
  renderedEntries: allEntries.length + variableEntries.length,
  effectEntries: effectActions.length,
  routeEntries: routeActions.length
}, null, 2) + '\n');
