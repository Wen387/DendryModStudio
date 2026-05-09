#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const objectCanvasModel = require('./authoring/object_authoring_canvas_model.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const repoRoot = path.resolve(__dirname, '..', '..');
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-election-results-'));
const sourceRoot = path.join(tmpRoot, 'source');
const scenesRoot = path.join(sourceRoot, 'scenes');
const eventsRoot = path.join(scenesRoot, 'events');
fs.mkdirSync(eventsRoot, {recursive: true});

fs.writeFileSync(path.join(sourceRoot, 'info.dry'), [
  'title: Election Results Fixture',
  'author: Dendry Mod Studio',
  'ifid: 00000000-0000-4000-8000-000000000099',
  ''
].join('\n'));
fs.writeFileSync(path.join(scenesRoot, 'root.scene.dry'), [
  'title: Root Scene',
  'new-page: true',
  '',
  '= Election Fixture',
  '',
  '- @election_reichstag: Reichstag',
  ''
].join('\n'));
fs.writeFileSync(path.join(eventsRoot, 'election_reichstag.scene.dry'), electionScene({
  title: 'A Reichstag Election Results',
  chartId: 'reichstag',
  scale: 'Q.reichstag_size',
  sizeLine: 'Q.reichstag_size = 4.93;',
  parties: [
    ['spd', 'SPD', 'Q.spd_r'],
    ['z', 'Center', 'Q.z_r']
  ]
}));
fs.writeFileSync(path.join(eventsRoot, 'prussia_election.scene.dry'), electionScene({
  title: 'Prussian Landtag Results',
  chartId: 'prussia_landtag',
  scale: '4.50',
  sizeLine: '',
  parties: [
    ['spd_prussia', 'Prussian SPD', 'Q.spd_r_prussia'],
    ['dnvp_prussia', 'Prussian DNVP', 'Q.dnvp_r_prussia']
  ]
}));

const outPath = path.join(tmpRoot, 'project-index.json');
childProcess.execFileSync('python3', [
  path.join(repoRoot, 'tools/project_map/build_project_map.py'),
  '--root',
  tmpRoot,
  '--out',
  outPath,
  '--include-excerpts'
], {cwd: repoRoot, stdio: 'pipe'});

const index = JSON.parse(fs.readFileSync(outPath, 'utf8'));
const electionResults = index.semantic && index.semantic.electionResults && index.semantic.electionResults.items || [];
assert(electionResults.length === 2, 'ProjectIndex should expose source-backed D3 election result screens');
const reichstag = electionResults.find((item) => item.id === 'election_reichstag');
const prussia = electionResults.find((item) => item.id === 'prussia_election');
assert(reichstag && reichstag.chartElementId === 'reichstag', 'Reichstag D3 target should be parsed from d3.select');
assert(reichstag.seatsTotal === '493', 'Reichstag seat total should be inferred from Q.reichstag_size');
assert(reichstag.parties.some((party) => party.name === 'SPD'), 'Reichstag party rows should be parsed from D3 data blocks');
assert(prussia && prussia.chartElementId === 'prussia_landtag', 'State election D3 target should be parsed from d3.select');
assert(prussia.seatsTotal === '450', 'State election seat total should be inferred from static scale factors');
assert(prussia.parties.some((party) => party.name === 'Prussian DNVP'), 'State election party rows should preserve source-specific labels');

const model = objectCanvasModel.buildTemplateCanvas(index, 'election_results', {}, {
  values: {
    'election.targetSceneId': 'prussia_election',
    'election.chartElementId': 'reichstag',
    'election.party.0.name': 'Stale SPD'
  }
});
const draft = model.changeState.draft;
assert(draft.targetSceneId === 'prussia_election', 'Selector change should update targetSceneId');
assert(draft.sourcePath === 'source/scenes/events/prussia_election.scene.dry', 'Selector change should rebase the source path');
assert(draft.chartElementId === 'prussia_landtag', 'Selector change should rebase the D3 chart id');
assert(draft.seatsTotal === '450', 'Selector change should rebase source-derived seat total');
assert(draft.parties.some((party) => party.name === 'Prussian SPD'), 'Selector change should load selected-source parties');
assert(!draft.parties.some((party) => party.name === 'Stale SPD'), 'Selector change should ignore stale party form values');

process.stdout.write(JSON.stringify({
  ok: true,
  electionResults: electionResults.length,
  selected: draft.targetSceneId
}, null, 2) + '\n');

function electionScene(config) {
  return [
    'title: ' + config.title,
    'tags: event',
    'on-display: {!',
    config.sizeLine,
    'var data = [{',
    '  "id": "' + config.parties[0][0] + '",',
    '  "legend": "' + config.parties[0][1] + '",',
    '  "name": "' + config.parties[0][1] + '",',
    '  "seats": Math.round(' + config.parties[0][2] + ' * ' + config.scale + '),',
    '}];',
    'data.push({',
    '  "id": "' + config.parties[1][0] + '",',
    '  "legend": "' + config.parties[1][1] + '",',
    '  "name": "' + config.parties[1][1] + '",',
    '  "seats": Math.round(' + config.parties[1][2] + ' * ' + config.scale + '),',
    '});',
    'if (window && d3) {',
    '  var parliament = d3.parliament();',
    '  d3.select("#' + config.chartId + '").datum(data).call(parliament);',
    '}',
    '!}',
    '',
    '= ' + config.title,
    '',
    '{!<svg id="' + config.chartId + '" style="width: 500px; height: 250px;"> </svg>!}',
    '',
    '- @root: Continue',
    ''
  ].filter((line) => line !== undefined).join('\n');
}
