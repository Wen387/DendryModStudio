#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const viewer = require('./viewer/app.js');

const DEFAULT_INDEX = '/tmp/dendry_project_map/project-index.json';
const args = process.argv.slice(2);
const expectExcerpts = args.includes('--expect-excerpts');
const fixtureIslands = args.includes('--fixture-islands');
const knownFlags = new Set(['--expect-excerpts', '--fixture-islands']);
const unknownFlag = args.find((arg) => arg.startsWith('--') && !knownFlags.has(arg));
const indexPath = args.find((arg) => !arg.startsWith('--')) || DEFAULT_INDEX;

if (unknownFlag) {
  fail('unknown flag: ' + unknownFlag);
}

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(label + ' expected ' + expected + ', got ' + actual);
  }
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

if (!fs.existsSync(indexPath)) {
  fail('index not found at ' + indexPath + '. Run build_project_map.py first.');
}

let raw;
try {
  raw = fs.readFileSync(indexPath, 'utf8');
} catch (err) {
  fail('could not read ' + indexPath + ': ' + err.message);
}

let index;
try {
  index = JSON.parse(raw);
} catch (err) {
  fail('could not parse JSON from ' + indexPath + ': ' + err.message);
}

const validation = viewer.validateProjectIndex(index);
if (!validation.ok) {
  fail('project index validation failed: ' + validation.errors.join('; '));
}

const model = viewer.buildViewModel(index);

assert(typeof viewer.graphRowsForScene === 'function', 'graphRowsForScene helper should be exported');
assert(typeof viewer.hasSourceExcerpts === 'function', 'hasSourceExcerpts helper should be exported');
assert(typeof viewer.diagnosticGroups === 'function', 'diagnosticGroups helper should be exported');
assert(typeof viewer.sceneIdForEndpoint === 'function', 'sceneIdForEndpoint helper should be exported');

assert(Array.isArray(model.lists.events), 'events list should exist');
assert(Array.isArray(model.lists.cards), 'cards list should exist');
assert(Array.isArray(model.lists.news), 'news list should exist');
assert(Array.isArray(model.lists.surfaceText), 'surfaceText list should exist');
assert(Array.isArray(model.lists.variables), 'variables list should exist');
assert(Array.isArray(model.lists.diagnostics), 'diagnostics list should exist');

if (fixtureIslands) {
  assertEqual(model.summary.sceneCount, 189, 'Island\'s Sunrise fixture sceneCount');
  assertEqual(model.summary.edgeCount, 1827, 'Island\'s Sunrise fixture edgeCount');
  assertEqual(model.summary.variableCount, 2815, 'Island\'s Sunrise fixture variableCount');
  assertEqual(model.scenes.length, 189, 'Island\'s Sunrise fixture scenes length');
  assertEqual(model.edges.length, 1827, 'Island\'s Sunrise fixture edges length');
  assertEqual(model.variables.length, 2815, 'Island\'s Sunrise fixture variables length');
  assert(model.lists.events.length > 0, 'Island\'s Sunrise events list should not be empty');
  assert(model.lists.cards.length > 0, 'Island\'s Sunrise cards list should not be empty');
  assert(model.lists.news.length > 0, 'Island\'s Sunrise news list should not be empty');
  assert(model.lists.surfaceText.length > 0, 'Island\'s Sunrise surface text list should not be empty');
  assert(model.lists.variables.length > 0, 'Island\'s Sunrise variables list should not be empty');
  assert(model.lists.diagnostics.length > 0, 'Island\'s Sunrise diagnostics list should not be empty');
}

const regexOnlyCount = model.diagnostics.filter((diag) => diag.code === 'project_map.regex_only_goto').length;
if (fixtureIslands) {
  assertEqual(regexOnlyCount, 20, 'Island\'s Sunrise fixture project_map.regex_only_goto diagnostics');
} else {
  assert(regexOnlyCount >= 0, 'project_map.regex_only_goto diagnostics should be countable');
}

const groups = viewer.diagnosticGroups(model.diagnostics);
const regexOnlyGroup = groups.find((group) => group.code === 'project_map.regex_only_goto');

if (fixtureIslands) {
  assert(regexOnlyGroup, 'diagnostic groups should include project_map.regex_only_goto');
  assertEqual(regexOnlyGroup.count, 20, 'project_map.regex_only_goto grouped count');
  assertEqual(regexOnlyGroup.severity, 'warning', 'project_map.regex_only_goto grouped severity');
  assert(regexOnlyGroup.examples.length > 0, 'diagnostic group should include examples');

  const sceneSearch = viewer.filterAndSortItems(model, 'scenes', 'community_circle', 'id', 'asc');
  assert(sceneSearch.some((item) => item.raw && item.raw.id === 'community_circle'), 'scene search should find community_circle');

  const variableSearch = viewer.filterAndSortItems(model, 'variables', 'resources', 'name', 'asc');
  assert(variableSearch.some((item) => item.raw && item.raw.name === 'resources'), 'variable search should find resources');

  const surfaceSearch = viewer.filterAndSortItems(model, 'surfaceText', '資源', 'label', 'asc');
  assert(surfaceSearch.some((item) => item.raw && item.raw.label === '資源'), 'surface text search should find 資源');

  const diagnosticSearch = viewer.filterAndSortItems(model, 'diagnostics', 'regex_only', 'severity', 'asc');
  assertEqual(diagnosticSearch.length, 20, 'diagnostic search regex_only');

  const communityOutgoing = model.edgesByFrom.get('community_circle') || [];
  assert(communityOutgoing.length > 0, 'community_circle should have outgoing edges');

  const communityGraph = viewer.graphRowsForScene(model, 'community_circle');
  assert(communityGraph.outgoing.length > 0, 'graphRowsForScene should include community_circle outgoing edges');
  assert(communityGraph.outgoing[0].direction === 'outgoing', 'outgoing graph row should have direction');
  assert(communityGraph.outgoing[0].endpointId, 'outgoing graph row should have endpointId');
  assert(communityGraph.outgoing[0].source, 'outgoing graph row should keep source ref');

  const partyAnchorSceneId = viewer.sceneIdForEndpoint(model, 'party_congress.debate_line');
  assertEqual(partyAnchorSceneId, 'party_congress', 'anchor endpoint should map to parent scene');
  const partyGraph = viewer.graphRowsForScene(model, 'party_congress');
  assert(
    partyGraph.all.some((row) => row.endpointId === 'party_congress.debate_line' && row.endpointScene),
    'party_congress graph should include clickable anchor endpoint rows'
  );
  assert(
    partyGraph.all.some((row) => String(row.edge && row.edge.from).startsWith('party_congress.')),
    'party_congress graph should include rows whose source is a section/anchor'
  );
  const postOpaque = model.diagnostics.find((diag) => diag.code === 'project_map.post_event_opaque');
  assert(postOpaque, 'post_event opaque diagnostic should exist');
  assert(
    /intentionally opaque/i.test(postOpaque.message || ''),
    'post_event opaque diagnostic should say intentionally opaque'
  );
}

assertEqual(viewer.hasSourceExcerpts(index), expectExcerpts, 'source excerpt presence');

process.stdout.write(JSON.stringify({
  ok: true,
  index: path.resolve(indexPath),
  scenes: model.scenes.length,
  edges: model.edges.length,
  variables: model.variables.length,
  surfaceText: model.lists.surfaceText.length,
  regexOnlyGoto: regexOnlyCount,
  sourceExcerpts: viewer.hasSourceExcerpts(index)
}, null, 2) + '\n');
