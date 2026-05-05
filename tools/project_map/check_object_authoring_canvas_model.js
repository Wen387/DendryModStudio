#!/usr/bin/env node
'use strict';

const canvasModel = require('./authoring/object_authoring_canvas_model.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function scene(id, overrides) {
  const path = overrides && overrides.path || 'source/scenes/events/' + id + '.scene.dry';
  return Object.assign({
    id,
    title: id.replace(/_/g, ' '),
    path,
    type: 'event',
    flags: {isCard: false},
    viewIf: 'year = 1936 and month >= 1 and month <= 3',
    options: [
      {target: {id: 'target_scene'}, title: 'Continue——Open the next beat.'}
    ],
    sourceSpan: {path, startLine: 1, endLine: 80},
    metadata: {viewIf: {path, line: 4}},
    assetRefs: []
  }, overrides || {});
}

const current = scene('generic_intro', {title: 'Generic Intro'});
const target = scene('target_scene', {title: 'Target Scene'});

const index = {
  schemaVersion: '0.1',
  project: {name: 'Object Canvas Fixture', root: '/tmp/object-canvas'},
  scenes: [current, target],
  edges: [
    {from: 'generic_intro', to: 'target_scene', kind: 'go_to', label: 'continues', source: {path: current.path, line: 20}}
  ],
  variables: [
    {name: 'public_order', readCount: 1, writeCount: 1, reads: [{path: current.path, line: 8}], writes: [{path: current.path, line: 25}], tags: ['politics']}
  ],
  semantic: {
    events: [{id: current.id, title: current.title, path: current.path}],
    cards: [],
    textCorpus: {
      items: [
        {
          id: 'generic_intro_title',
          text: 'Generic Intro',
          role: 'title',
          owner: {kind: 'scene', sceneId: 'generic_intro'},
          source: {path: current.path, line: 1}
        },
        {
          id: 'generic_intro_body',
          text: 'The campaign office wakes before dawn.',
          role: 'body',
          owner: {kind: 'scene', sceneId: 'generic_intro', sectionId: 'start'},
          source: {path: current.path, line: 8}
        },
        {
          id: 'generic_intro_option',
          text: 'Continue',
          role: 'option_label',
          owner: {kind: 'scene', sceneId: 'generic_intro', sectionId: 'start', itemId: 'target_scene'},
          source: {path: current.path, line: 14}
        },
        {
          id: 'generic_intro_effect',
          text: 'Q.public_order += 1;',
          role: 'script',
          owner: {kind: 'scene', sceneId: 'generic_intro', sectionId: 'target_scene'},
          source: {path: current.path, line: 25}
        }
      ]
    }
  }
};

const existing = canvasModel.buildExistingCanvas(index, 'events', 'generic_intro', {
  values: {
    generic_intro_body: 'The campaign office opens to a sharper morning.',
    generic_intro_option: 'Follow the campaign lead'
  },
  entry: {source: 'Design', action: 'edit_existing'}
});

assert(existing.ok, 'existing Event should open in Object Canvas: ' + JSON.stringify(existing.changeState.diagnostics));
assert(existing.kind === 'object_authoring_canvas_model', 'model should expose object canvas kind');
assert(existing.mode === 'existing', 'existing model should keep existing mode');
assert(existing.eventBody.title.value === 'Generic Intro', 'existing body should expose the player-facing title');
assert(existing.eventBody.sections.length >= 1, 'existing body should expose source-backed body fields');
assert(existing.eventBody.options.length === 1, 'existing body should expose option rows');
assert(existing.contextBoard.flow.some((row) => row.direction === 'outgoing'), 'context board should include flow rows');
assert(existing.contextBoard.variables.some((row) => row.name === 'public_order'), 'context board should include related variables');
assert(existing.contextBoard.effects.some((row) => row.variable === 'public_order'), 'context board should include readonly effects');
assert(existing.changeState.changedCount === 2, 'existing model should count changed fields');
assert(existing.changeState.operationSummary.guardedApply === 2, 'existing source-backed text changes should be guarded');

const newEvent = canvasModel.buildNewEventCanvas(index, {
  id: 'generic_intro_followup',
  title: 'Follow-up: Generic Intro',
  heading: 'Follow-up: Generic Intro',
  year: 1936,
  monthStart: 2,
  monthEnd: 4,
  options: [
    {id: 'accept', title: 'Accept the risk', body: 'The campaign accepts the risk.'},
    {id: 'delay', title: 'Delay the decision', body: 'The campaign waits another week.'}
  ]
}, {
  values: {
    'event.title': 'Follow-up: Campaign Office',
    'event.intro': 'A new question arrives at the campaign office.',
    'option.0.label': 'Accept the public risk'
  },
  seed: {source: 'Design', raw: current}
});

assert(newEvent.ok, 'new Event should open in Object Canvas: ' + JSON.stringify(newEvent.changeState.diagnostics));
assert(newEvent.mode === 'new_event', 'new model should use new_event mode');
assert(newEvent.eventBody.title.value === 'Follow-up: Campaign Office', 'new title should reflect inline values');
assert(newEvent.eventBody.sections[0].value.includes('new question'), 'new body should reflect inline values');
assert(newEvent.eventBody.options[0].fields.some((field) => field.value === 'Accept the public risk'), 'new options should reflect inline values');
assert(newEvent.contextBoard.flow.some((row) => row.direction === 'seed'), 'new Event context should include Design/Create seed context');
assert(newEvent.contextBoard.manualBoundaries.some((row) => row.label === 'Router wiring'), 'new Event should keep router wiring as manual-review context');
assert(newEvent.changeState.draft.kind === 'world_event', 'new Event draft should be a world_event draft');
assert(newEvent.changeState.output.installPlan, 'new Event should produce an install plan');
assert(newEvent.changeState.operationSummary.total > 0, 'new Event install plan should summarize operations');

process.stdout.write(JSON.stringify({
  ok: true,
  existingMode: existing.mode,
  newMode: newEvent.mode,
  existingChanges: existing.changeState.changedCount,
  newOperations: newEvent.changeState.operationSummary.total
}, null, 2) + '\n');
