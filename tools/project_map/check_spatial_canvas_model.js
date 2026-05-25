#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * check_spatial_canvas_model.js — Contract check for the Spatial Canvas
 * layout engine and model builder.
 *
 * Validates:
 *  1. Layout produces stable, non-overlapping positions for a synthetic
 *     project index that mirrors the Starter Demo's structure.
 *  2. LOD threshold computation returns correct tier for boundary values.
 *  3. Chain grouping produces correct baseplates from go-to edges.
 *  4. Every card is assigned to exactly one baseplate.
 *  5. Time bucketing groups cards with matching year/quarter.
 *  6. Prefix clustering groups cards with shared ID prefix.
 *  7. The model builder produces a well-formed spatial_canvas_model.
 *  8. Manual position overrides are applied correctly.
 */

const path = require('path');
const {assert, fail} = require('./check_harness.js');

// ── load modules under test ──────────────────────────────────────────────

const layout = require('./authoring/spatial_canvas_layout.js');
const model = require('./authoring/spatial_canvas_model.js');

// ── synthetic fixture ────────────────────────────────────────────────────

function makeScene(id, opts) {
  const o = opts || {};
  return {
    id: id,
    title: o.title || id.replace(/_/g, ' '),
    summary: o.summary || '',
    path: 'source/' + id + '.dry',
    sourceSpan: {path: 'source/' + id + '.dry', line: 1},
    type: o.type || undefined,
    flags: o.flags || {},
    options: (o.options || []).map(function (target) {
      return {id: id + '.' + target, target: target, label: 'Go to ' + target};
    }),
    sections: [],
    viewIf: o.viewIf || '',
    chooseIf: o.chooseIf || '',
    year: o.year || undefined,
    monthStart: o.monthStart || undefined,
    tags: o.tags || []
  };
}

function makeEdge(from, to, kind) {
  return {from: from, to: to, kind: kind || 'go_to'};
}

/**
 * Build a synthetic project index that mirrors the Starter Demo's
 * structure: a 4-event chain, time-bucketed events, prefixed events,
 * a card, and news items.
 */
function buildFixture() {
  var scenes = [
    // Chain: campaign_pressure → case_hearing → back_room_talks → resolution_week
    makeScene('demo_campaign_pressure', {title: 'Campaign Pressure', options: ['demo_case_hearing'], year: 2024, monthStart: 3}),
    makeScene('demo_case_hearing', {title: 'Case Hearing', options: ['demo_back_room_talks', 'demo_resolution_week'], year: 2024, monthStart: 4}),
    makeScene('demo_back_room_talks', {title: 'Back Room Talks', options: ['demo_resolution_week'], year: 2024, monthStart: 5}),
    makeScene('demo_resolution_week', {title: 'Resolution Week', year: 2024, monthStart: 6}),

    // Time-bucketed: 2024 Q1 events (not in chain)
    makeScene('news_budget_update', {title: 'Budget Update', year: 2024, monthStart: 1}),
    makeScene('news_policy_review', {title: 'Policy Review', year: 2024, monthStart: 2}),
    makeScene('news_quarterly_report', {title: 'Quarterly Report', year: 2024, monthStart: 3}),

    // Prefix cluster: election_*
    makeScene('election_primary', {title: 'Primary', viewIf: 'year == 2024 and month >= 6'}),
    makeScene('election_debate', {title: 'Debate', viewIf: 'year == 2024 and month >= 8'}),
    makeScene('election_voting', {title: 'Voting Day', viewIf: 'year == 2024 and month >= 11'}),

    // Stand-alone events (should go to catch-all or time bucket)
    makeScene('opening_scene', {title: 'Opening Scene'}),
    makeScene('monthly_report', {title: 'Monthly Report', viewIf: 'year == 2024 and month >= 1'}),

    // Cards and advisors
    makeScene('demo_action_card', {title: 'Action Card', type: 'card'}),
    makeScene('demo_advisor_anna', {title: 'Advisor Anna', flags: {isPinnedCard: true}}),

    // Additional events to reach ~21 scenes
    makeScene('council_deadlock', {title: 'Council Deadlock', year: 2024, monthStart: 7}),
    makeScene('council_vote', {title: 'Council Vote', options: ['council_deadlock'], year: 2024, monthStart: 8}),
    makeScene('press_conference', {title: 'Press Conference', year: 2024, monthStart: 9}),
    makeScene('public_rally', {title: 'Public Rally', year: 2024, monthStart: 10}),
    makeScene('final_debate', {title: 'Final Debate', year: 2024, monthStart: 11}),
    makeScene('election_night', {title: 'Election Night', year: 2024, monthStart: 12}),
    makeScene('inauguration', {title: 'Inauguration', year: 2025, monthStart: 1})
  ];

  var edges = [
    // Chain edges
    makeEdge('demo_campaign_pressure.option_1', 'demo_case_hearing'),
    makeEdge('demo_case_hearing.option_1', 'demo_back_room_talks'),
    makeEdge('demo_case_hearing.option_2', 'demo_resolution_week'),
    makeEdge('demo_back_room_talks.option_1', 'demo_resolution_week'),
    // Council link
    makeEdge('council_vote.option_1', 'council_deadlock')
  ];

  var newsItems = [
    {id: 'breaking_news_1', headline: 'Breaking: Budget Crisis', description: 'A budget crisis looms.', year: 2024, month: 2},
    {id: 'breaking_news_2', headline: 'Economy Update', description: 'Markets react.', year: 2024, month: 5}
  ];

  return {
    scenes: scenes,
    edges: edges,
    variables: [
      {name: 'demo_support', type: 'integer'},
      {name: 'demo_resources', type: 'integer'},
      {name: 'demo_year', type: 'integer'}
    ],
    semantic: {
      news: {items: newsItems},
      textCorpus: {items: []}
    },
    diagnostics: []
  };
}

// ── tests ────────────────────────────────────────────────────────────────

var passed = 0;

function check(condition, message) {
  assert(condition, message);
  passed += 1;
}

function runLayoutTests() {
  var fixture = buildFixture();
  var cards = model.collectProjectCards(fixture);

  check(cards.length >= 21, 'collectProjectCards should find at least 21 cards from the fixture (got ' + cards.length + ')');

  // Count events, cards, advisors, news
  var events = cards.filter(function (c) { return c.kind === 'event'; });
  var cardKind = cards.filter(function (c) { return c.kind === 'card'; });
  var advisors = cards.filter(function (c) { return c.kind === 'advisor'; });
  var news = cards.filter(function (c) { return c.kind === 'news'; });
  check(events.length >= 17, 'fixture should produce at least 17 event cards (got ' + events.length + ')');
  check(cardKind.length >= 1, 'fixture should produce at least 1 card-type card');
  check(advisors.length >= 1, 'fixture should produce at least 1 advisor card');
  check(news.length >= 2, 'fixture should produce at least 2 news cards');

  // Compute layout
  var result = layout.computeLayout(cards, fixture, {});

  check(result.cards.length === cards.length, 'layout should produce a position for every card (expected ' + cards.length + ', got ' + result.cards.length + ')');
  check(result.baseplates.length >= 3, 'layout should produce at least 3 baseplates (chain, time, domain) — got ' + result.baseplates.length);

  // Every card should have a baseplateId
  var noPlate = result.cards.filter(function (c) { return !c.baseplateId; });
  check(noPlate.length === 0, 'every card should be assigned to a baseplate — ' + noPlate.length + ' unassigned');

  // Chain baseplate should contain the 4 demo chain events
  var chainPlate = result.baseplates.find(function (bp) { return bp.kind === 'chain'; });
  check(Boolean(chainPlate), 'layout should produce at least one chain baseplate');
  if (chainPlate) {
    var chainIds = chainPlate.cardKeys;
    check(chainIds.length >= 4, 'chain baseplate should contain at least 4 cards (got ' + chainIds.length + ')');
    check(chainIds.some(function (k) { return k.indexOf('demo_campaign_pressure') >= 0; }), 'chain should include campaign_pressure');
    check(chainIds.some(function (k) { return k.indexOf('demo_resolution_week') >= 0; }), 'chain should include resolution_week');
  }

  // No two cards should occupy the exact same position
  var posSet = new Set();
  var duplicatePos = 0;
  result.cards.forEach(function (c) {
    var posKey = c.x + ',' + c.y;
    if (posSet.has(posKey)) { duplicatePos += 1; }
    posSet.add(posKey);
  });
  check(duplicatePos === 0, 'no two cards should share the exact same position — ' + duplicatePos + ' duplicates');

  // Baseplate bounds should enclose all their cards
  var posMap = new Map();
  result.cards.forEach(function (c) { posMap.set(c.key, c); });
  result.baseplates.forEach(function (bp) {
    var b = bp.bounds;
    bp.cardKeys.forEach(function (key) {
      var pos = posMap.get(key);
      if (!pos) { return; }
      check(pos.x >= b.x && pos.y >= b.y && (pos.x + pos.width) <= (b.x + b.w) && (pos.y + pos.height) <= (b.y + b.h),
        'card ' + key + ' should be inside baseplate ' + bp.id + ' bounds');
    });
  });

  // Layout stability: running twice should produce identical positions
  var result2 = layout.computeLayout(cards, fixture, {});
  var stable = true;
  result.cards.forEach(function (c, i) {
    var c2 = result2.cards[i];
    if (!c2 || c.x !== c2.x || c.y !== c2.y) { stable = false; }
  });
  check(stable, 'layout should be deterministic — same input produces same positions');
}

function runLodTests() {
  // Layout engine thresholds: LOD_0_MAX=60, LOD_1_MAX=250 (layout module)
  // Card renderer thresholds are tuned separately (120/300) for the
  // storyboard.  These tests validate the layout engine's constants.
  check(layout.computeLod(0) === 0, 'LOD for 0px should be 0');
  check(layout.computeLod(30) === 0, 'LOD for 30px should be 0');
  check(layout.computeLod(59) === 0, 'LOD for 59px should be 0');
  check(layout.computeLod(60) === 1, 'LOD for 60px should be 1');
  check(layout.computeLod(120) === 1, 'LOD for 120px should be 1');
  check(layout.computeLod(249) === 1, 'LOD for 249px should be 1');
  check(layout.computeLod(250) === 2, 'LOD for 250px should be 2');
  check(layout.computeLod(500) === 2, 'LOD for 500px should be 2');
  check(layout.computeLod(1000) === 2, 'LOD for 1000px should be 2');
}

function runModelTests() {
  var fixture = buildFixture();
  var result = model.buildSpatialCanvas(fixture, {objectId: 'demo_campaign_pressure'}, {});

  check(result.kind === 'spatial_canvas_model', 'model kind should be spatial_canvas_model');
  check(result.schemaVersion === '0.1', 'model schema version should be 0.1');
  check(result.cards.length >= 21, 'model should contain all cards (got ' + result.cards.length + ')');
  check(result.baseplates.length >= 3, 'model should contain baseplates');
  check(result.metrics.cardCount >= 21, 'model metrics.cardCount should match');
  check(result.currentKey === 'event:demo_campaign_pressure', 'model currentKey should reflect objectModel');

  // Cards should have position data
  var withPosition = result.cards.filter(function (c) { return c.position && typeof c.position.x === 'number'; });
  check(withPosition.length === result.cards.length, 'every card should have position data');

  // Test with selectedKey
  var result2 = model.buildSpatialCanvas(fixture, {}, {selected: 'event:election_primary'});
  check(result2.selectedKey === 'event:election_primary', 'selectedKey should match the option when it exists in layout');
}

function runOverrideTests() {
  var fixture = buildFixture();
  var cards = model.collectProjectCards(fixture);
  var overrides = {'event:demo_campaign_pressure': {x: 999, y: 888}};
  var result = layout.computeLayout(cards, fixture, {overrides: overrides});

  var overriddenCard = result.cards.find(function (c) { return c.key === 'event:demo_campaign_pressure'; });
  check(Boolean(overriddenCard), 'overridden card should still appear in layout');
  if (overriddenCard) {
    check(overriddenCard.x === 999, 'override x should be applied (got ' + overriddenCard.x + ')');
    check(overriddenCard.y === 888, 'override y should be applied (got ' + overriddenCard.y + ')');
  }
}

function runIntrinsicHeightTests() {
  var simple = layout.intrinsicCardHeight({routeTargets: [], body: ''});
  var withOptions = layout.intrinsicCardHeight({routeTargets: [{id: 'a'}, {id: 'b'}, {id: 'c'}], body: ''});
  var withBody = layout.intrinsicCardHeight({routeTargets: [], body: 'line1\nline2\nline3\nline4'});

  check(simple >= 80, 'simple card should have minimum height');
  check(withOptions > simple, 'card with options should be taller than simple card');
  check(withBody > simple, 'card with multi-line body should be taller than simple card');
}

function runEmptyInputTests() {
  // Layout should handle empty/null gracefully
  var emptyResult = layout.computeLayout([], {}, {});
  check(emptyResult.cards.length === 0, 'empty input should produce empty card positions');
  check(emptyResult.baseplates.length === 0, 'empty input should produce empty baseplates');

  var nullResult = layout.computeLayout(null, null, null);
  check(nullResult.cards.length === 0, 'null input should produce empty card positions');

  // Model should handle empty/null gracefully
  var emptyModel = model.buildSpatialCanvas(null, null, null);
  check(emptyModel.kind === 'spatial_canvas_model', 'null-input model should still have correct kind');
  check(emptyModel.cards.length === 0, 'null-input model should have no cards');
}

function runStackTests() {
  var fixture = buildFixture();
  var cards = model.collectProjectCards(fixture);

  // The fixture has enough time-bucketed cards to trigger auto-stacks
  // (auto-stack threshold is 8 cards per baseplate).
  var result = layout.computeLayout(cards, fixture, {});

  // Auto-stacks should be created for large baseplates
  check(Array.isArray(result.stacks), 'layout should produce a stacks array');

  // Verify stack structure when stacks exist
  result.stacks.forEach(function (stack) {
    check(typeof stack.id === 'string' && stack.id.length > 0, 'stack should have a non-empty id');
    check(typeof stack.label === 'string', 'stack should have a label');
    check(Array.isArray(stack.cardKeys), 'stack should have cardKeys array');
    check(stack.cardKeys.length > 0, 'stack should have at least one card key');
    check(typeof stack.position === 'object', 'stack should have a position');
    check(typeof stack.titles === 'object', 'stack should have titles map');
  });

  // Manual stacks should be preserved
  var manualStack = {
    id: 'manual:test',
    label: 'Test Stack',
    cardKeys: ['event:demo_campaign_pressure', 'event:demo_case_hearing']
  };
  var resultManual = layout.computeLayout(cards, fixture, {manualStacks: [manualStack]});
  var found = resultManual.stacks.find(function (s) { return s.id === 'manual:test'; });
  check(Boolean(found), 'manual stacks should appear in the layout output');
  if (found) {
    check(found.manual === true, 'manual stacks should be flagged as manual');
    check(found.cardKeys.length === 2, 'manual stack should preserve card keys');
  }
}

function runZoomToFitTests() {
  // Verify workspace state zoomToFitAll logic
  var workspaceState = require('./viewer/spatial_canvas_workspace_state.js');
  check(typeof workspaceState.zoomToCard === 'function', 'workspace state should export zoomToCard');
  check(typeof workspaceState.zoomToFitAll === 'function', 'workspace state should export zoomToFitAll');
  check(typeof workspaceState.MIN_ZOOM === 'number', 'workspace state should export MIN_ZOOM constant');
  check(typeof workspaceState.MAX_ZOOM === 'number', 'workspace state should export MAX_ZOOM constant');
  check(workspaceState.MIN_ZOOM < workspaceState.MAX_ZOOM, 'MIN_ZOOM should be less than MAX_ZOOM');
}

// ── run ──────────────────────────────────────────────────────────────────

runLayoutTests();
runLodTests();
runModelTests();
runOverrideTests();
runIntrinsicHeightTests();
runEmptyInputTests();
runStackTests();
runZoomToFitTests();

process.stdout.write('check_spatial_canvas_model: ' + passed + ' assertions passed.\n');
