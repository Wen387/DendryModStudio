#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const {pythonCommand} = require('./check_python_command.js');
const profileModel = require('./authoring/timeline_profile_model.js');
const adapter = require('./authoring/timeline_coordinate_adapter.js');
const storyboardModel = require('./authoring/content_storyboard_model.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function scene(id, title, extras) {
  const path = extras && extras.path || 'source/scenes/events/' + id + '.scene.dry';
  return Object.assign({
    id,
    title,
    path,
    type: 'event',
    flags: {isCard: false},
    sourceSpan: {path, startLine: 1, endLine: 80}
  }, extras || {});
}

const yearIndex = {
  scenes: [
    scene('opening', 'Opening', {viewIf: 'year = 1936 and month >= 1 and month <= 2'}),
    scene('crisis', 'Crisis', {viewIf: 'year = 1937'})
  ],
  edges: []
};
const yearProfile = profileModel.buildProfile(yearIndex);
assert(yearProfile.mode === 'year_month', 'year/month evidence should infer year_month');

const turnIndex = {
  timelineProfile: {
    mode: 'turn',
    unitLabel: 'Turn',
    lanes: [{id: 1, label: 'Turn 1'}, {id: 2, label: 'Turn 2'}, {id: 3, label: 'Turn 3'}]
  },
  scenes: [
    scene('turn_open', 'Turn opening', {metadata: {turn: 1}}),
    scene('turn_choice', 'Turn choice', {metadata: {turn: 2}}),
    scene('turn_result', 'Turn result', {condition: 'turn >= 3'})
  ],
  edges: []
};
const turnTimeline = adapter.buildTimeline(turnIndex, cardsFrom(turnIndex), {key: 'event:turn_choice', id: 'turn_choice'}, {});
assert(turnTimeline.profile.mode === 'turn', 'explicit project profile should select turn mode');
assert(turnTimeline.lanes.some((lane) => lane.label === 'Turn 2'), 'turn fixture should expose Turn 2 lane');
assert(turnTimeline.cards.find((card) => card.id === 'turn_choice').timelinePlacement.reason.indexOf('turn') >= 0, 'turn placement should explain its evidence');

const phaseIndex = {
  timelineProfile: {
    mode: 'phase',
    unitLabel: 'Phase',
    lanes: [
      {id: 'opening', label: 'Opening'},
      {id: 'election', label: 'Election'},
      {id: 'crisis', label: 'Crisis'}
    ],
    rules: [
      {source: 'path', match: 'source/scenes/election/**', lane: 'election'},
      {source: 'field', path: 'metadata.phase'}
    ]
  },
  scenes: [
    scene('opening_a', 'Opening A', {metadata: {phase: 'opening'}}),
    scene('vote_a', 'Vote A', {path: 'source/scenes/election/vote_a.scene.dry'}),
    scene('crisis_a', 'Crisis A', {metadata: {phase: 'crisis'}})
  ],
  edges: []
};
const phaseTimeline = storyboardModel.buildStoryboard(phaseIndex, existingModel('vote_a'), {selected: 'event:vote_a'});
assert(phaseTimeline.timeline.profile.mode === 'phase', 'storyboard should consume phase profile');
assert(phaseTimeline.timeline.lanes.some((lane) => lane.label === 'Election' && lane.cards.some((card) => card.id === 'vote_a')), 'phase path rule should place the election card');
assert(phaseTimeline.editor.timelinePlacement.reason.indexOf('path rule') >= 0, 'selected phase placement should be visible to the editor');

const sparseIndex = {
  scenes: [
    scene('first', 'First'),
    scene('second', 'Second')
  ],
  edges: []
};
const sparseTimeline = storyboardModel.buildStoryboard(sparseIndex, existingModel('first'), {selected: 'event:first'});
assert(sparseTimeline.timeline.profile.mode === 'source_order', 'sparse fixture should fall back to source order');
assert(sparseTimeline.timeline.lanes.length === 1 && sparseTimeline.timeline.lanes[0].key === 'source_order', 'source-order fallback should use a stable lane');
assert(sparseTimeline.editor.timelinePlacement.reason.indexOf('source order') >= 0, 'source-order fallback should explain itself');

const parserTimeline = buildParserTimelineFixture();
assert(parserTimeline.indexScene.year === '1936', 'ProjectIndex should preserve parser-backed year metadata');
assert(parserTimeline.indexScene.monthStart === '9', 'ProjectIndex should preserve parser-backed month-start metadata');
assert(parserTimeline.indexScene.phase === 'campaign', 'ProjectIndex should preserve parser-backed phase metadata');
assert(parserTimeline.profile.mode === 'year_month', 'parser-backed year metadata should infer a year/month timeline');
assert(parserTimeline.card && parserTimeline.card.schedule.year === 1936, 'storyboard cards should schedule from parser-backed year metadata');
assert(parserTimeline.card && parserTimeline.card.schedule.monthStart === 9, 'storyboard cards should schedule from parser-backed month metadata');
assert(parserTimeline.lane && parserTimeline.lane.cards.some((card) => card.id === 'dated_event'), 'timeline should place parser-backed dated scenes in their year lane');

process.stdout.write(JSON.stringify({
  ok: true,
  modes: [yearProfile.mode, turnTimeline.profile.mode, phaseTimeline.timeline.profile.mode, sparseTimeline.timeline.profile.mode],
  phaseLanes: phaseTimeline.timeline.lanes.map((lane) => lane.label),
  parserTimeline: {
    mode: parserTimeline.profile.mode,
    lane: parserTimeline.lane && parserTimeline.lane.label,
    schedule: parserTimeline.card && parserTimeline.card.schedule
  }
}, null, 2) + '\n');

function cardsFrom(index) {
  return index.scenes.map((item) => ({
    key: 'event:' + item.id,
    id: item.id,
    kind: 'event',
    title: item.title,
    body: '',
    schedule: {},
    source: {path: item.path},
    routeTargets: [],
    editable: false,
    raw: item
  }));
}

function existingModel(id) {
  return {
    mode: 'existing',
    objectId: id,
    objectKind: 'event',
    title: id,
    source: {path: 'source/scenes/events/' + id + '.scene.dry'},
    eventBody: {title: {id: id + '_title', value: id}, sections: []},
    contextBoard: {},
    changeState: {draft: {id, kind: 'event'}, output: {}}
  };
}

function buildParserTimelineFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-timeline-parser-'));
  const sourceDir = path.join(root, 'source');
  const scenesDir = path.join(sourceDir, 'scenes');
  const eventsDir = path.join(scenesDir, 'events');
  fs.mkdirSync(eventsDir, {recursive: true});
  fs.writeFileSync(path.join(sourceDir, 'info.dry'), [
    'title: Timeline Parser Fixture',
    'author: Dendry Mod Studio',
    'ifid: 00000000-0000-4000-8000-000000000090',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(scenesDir, 'root.scene.dry'), [
    'title: Root',
    '',
    'Open fixture.',
    '- @dated_event: Open dated event',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(eventsDir, 'dated_event.scene.dry'), [
    'title: Parser-backed Dated Event',
    'tags: event',
    'year: 1936',
    'month-start: 9',
    'month-end: 11',
    'phase: campaign',
    'turn: 3',
    '',
    'A dated scene that relies on explicit author metadata rather than view-if.',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(eventsDir, 'future_event.scene.dry'), [
    'title: Parser-backed Future Event',
    'tags: event',
    'year: 1937',
    'month: 1',
    '',
    'A later event.',
    ''
  ].join('\n'), 'utf8');

  const outPath = path.join(root, 'project-index.json');
  const result = spawnSync(
    pythonCommand(),
    [path.join(__dirname, 'build_project_map.py'), '--root', root, '--out', outPath],
    {cwd: path.resolve(__dirname, '..', '..'), encoding: 'utf8'}
  );
  if (result.status !== 0) {
    fail('parser-backed timeline fixture should build: ' + (result.stderr || result.stdout || ''));
  }
  const index = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  const story = storyboardModel.buildStoryboard(index, existingModel('scratch'), {selected: 'event:dated_event'});
  const indexScene = index.scenes.find((item) => item.id === 'dated_event') || {};
  const card = story.cards.find((item) => item.key === 'event:dated_event') || null;
  const lane = story.timeline.lanes.find((item) => Number(item.year || item.key) === 1936) || null;
  fs.rmSync(root, {recursive: true, force: true});
  return {indexScene, profile: story.timeline.profile, card, lane};
}
