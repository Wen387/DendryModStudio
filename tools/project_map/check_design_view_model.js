#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const viewer = require('./viewer/app.js');
const design = require('./viewer/design_model.js');

const args = process.argv.slice(2);
const fixtureIslands = args.includes('--fixture-islands');
const knownFlags = new Set(['--fixture-islands']);
const unknownFlag = args.find((arg) => arg.startsWith('--') && !knownFlags.has(arg));
const indexPath = args.find((arg) => !arg.startsWith('--')) || '';

if (unknownFlag) {
  fail('unknown flag: ' + unknownFlag);
}

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(label + ' expected ' + expected + ', got ' + actual);
  }
}

function cssRuleBlock(source, selector) {
  const start = source.indexOf(selector);
  assert(start >= 0, 'CSS should include ' + selector);
  const open = source.indexOf('{', start);
  assert(open >= 0, 'CSS rule should open for ' + selector);
  const close = source.indexOf('}', open);
  assert(close >= 0, 'CSS rule should close for ' + selector);
  return source.slice(open + 1, close);
}

function source(pathName, startLine) {
  return {path: pathName, startLine: startLine || 1, endLine: (startLine || 1) + 20};
}

function scene(id, overrides) {
  const pathName = (overrides && overrides.path) || 'source/scenes/events/' + id + '.scene.dry';
  return Object.assign({
    id,
    name: id,
    title: id.replace(/_/g, ' '),
    path: pathName,
    type: 'event',
    confidence: 'exact',
    classificationConfidence: 'exact',
    sourceSpan: source(pathName, 1),
    topLevelSpan: source(pathName, 1),
    sourceFingerprint: {algorithm: 'sha256', scope: 'topLevelSpan', value: id + '-fingerprint'},
    tags: ['event'],
    flags: {isCard: false, isPinnedCard: false, isHand: false, isDeck: false},
    viewIf: 'year = 2015 and month >= 7 and month <= 8',
    options: [],
    sections: []
  }, overrides || {});
}

function indexFixture(kind) {
  const same = scene('same_event', {
    title: 'Same event',
    sourceFingerprint: {algorithm: 'sha256', scope: 'topLevelSpan', value: 'same-fp'}
  });
  const added = scene('added_event', {
    title: 'Added event',
    sourceFingerprint: {algorithm: 'sha256', scope: 'topLevelSpan', value: 'added-fp'}
  });
  const opaque = scene('opaque_event', {
    title: 'Opaque event',
    confidence: 'opaque',
    classificationConfidence: 'opaque',
    sourceFingerprint: null
  });
  const cardFlagEvent = scene('card_flag_event', {
    title: 'Card-flagged timeline event',
    flags: {isCard: true, isPinnedCard: false, isHand: false, isDeck: false},
    sourceFingerprint: {algorithm: 'sha256', scope: 'topLevelSpan', value: 'card-flag-event-fp'}
  });
  const changedCard = scene('changed_card', {
    title: 'Changed card',
    type: 'card',
    path: 'source/scenes/party_affairs/changed_card.scene.dry',
    tags: ['party_affairs'],
    flags: {isCard: true, isPinnedCard: false, isHand: false, isDeck: false},
    sourceFingerprint: {algorithm: 'sha256', scope: 'topLevelSpan', value: kind === 'baseline' ? 'old-card-fp' : 'new-card-fp'}
  });
  const missing = scene('missing_event', {
    title: 'Missing baseline event',
    sourceFingerprint: {algorithm: 'sha256', scope: 'topLevelSpan', value: 'missing-fp'}
  });

  const scenes = kind === 'baseline'
    ? [same, opaque, cardFlagEvent, changedCard, missing]
    : [same, added, opaque, cardFlagEvent, changedCard];

  const news = kind === 'baseline'
    ? []
    : [{
      headline: 'Fresh headline',
      description: 'A current-only news item.',
      delivery: 'dated',
      slot: 'news_2',
      source: {path: 'source/scenes/post_event_news.scene.dry', line: 42},
      confidence: 'static_inferred'
    }];

  const surface = [{
    id: 'surface_status_resources',
    label: '資源',
    area: 'status_scene',
    variableName: 'resources',
    source: {path: 'source/scenes/status.scene.dry', line: 33},
    confidence: 'static_inferred',
    editability: 'draft_exportable',
    originalText: '= 資源'
  }];

  return {
    schemaVersion: '0.1',
    generatedAt: '2026-04-28T00:00:00Z',
    project: {
      name: kind === 'baseline' ? 'baseline' : 'current',
      root: '/tmp/design-' + kind,
      profileIds: ['generic-dendry'],
      sourceRoots: ['source']
    },
    profiles: [{id: 'generic-dendry', uiLabels: {advisorLikeSingular: 'Advisor', advisorLikePlural: 'Advisors'}}],
    scenes,
    edges: [
      {from: 'same_event', to: 'added_event', kind: 'go_to', label: 'next', source: {path: same.path, line: 10}}
    ],
    variables: [
      {
        name: 'resources',
        readCount: 1,
        writeCount: 1,
        reads: [{path: same.path, line: 8}],
        writes: [{path: changedCard.path, line: 28}],
        tags: ['resource']
      }
    ],
    diagnostics: [
      {severity: 'warning', code: 'sample.warning', sceneId: 'same_event', path: same.path, source: {path: same.path, line: 9}, confidence: 'static_inferred'}
    ],
    semantic: {
      events: scenes.filter((item) => item.type === 'event').map((item) => ({id: item.id, title: item.title, path: item.path, confidence: item.confidence})),
      cards: scenes
        .filter((item) => item.type === 'card' || item.id === 'card_flag_event')
        .map((item) => ({id: item.id, title: item.title, path: item.path, confidence: item.confidence})),
      hands: [],
      decks: [],
      pinnedCards: [],
      news: {items: news},
      surfaceText: {items: surface}
    },
    summary: {
      sceneCount: scenes.length,
      edgeCount: 1,
      variableCount: 1,
      diagnosticCount: 1,
      eventCount: scenes.filter((item) => item.type === 'event').length,
      cardCount: scenes.filter((item) => item.type === 'card').length,
      newsItemCount: news.length,
      surfaceTextCount: surface.length
    }
  };
}

const currentModel = viewer.buildViewModel(indexFixture('current'));
const baselineModel = viewer.buildViewModel(indexFixture('baseline'));
const designModel = design.buildDesignModel(currentModel, baselineModel);

assert(Array.isArray(designModel.lanes), 'design model should expose lanes');
assert(designModel.graph && Array.isArray(designModel.graph.nodes), 'design model should expose graph nodes');
assert(designModel.graph && Array.isArray(designModel.graph.edges), 'design model should expose graph edges');
assert(designModel.graph.nodes.length > 0, 'design graph should include nodes');
assert(designModel.graph.edges.length > 0, 'design graph should include edges');
assert(designModel.graph.nodes.some((node) => node.kind === 'event'), 'design graph should include event nodes');
assert(designModel.graph.nodes.every((node) => typeof node.x === 'number' && typeof node.y === 'number'), 'design graph nodes should have deterministic coordinates');
assert(designModel.lanes.some((lane) => lane.id === 'timeline_events'), 'timeline lane should exist');
assert(designModel.lanes.some((lane) => lane.id === 'cards_advisors'), 'cards/advisors lane should exist');
assert(designModel.lanes.some((lane) => lane.id === 'news'), 'news lane should exist');
assert(designModel.lanes.some((lane) => lane.id === 'surface_sidebar'), 'surface/sidebar lane should exist');
assert(designModel.lanes.some((lane) => lane.id === 'manual_review'), 'manual review lane should exist');
assert(!designModel.itemsByKey.has('card:card_flag_event'), 'card-flagged timeline event should not duplicate into card lane');
assert(designModel.itemsByKey.has('event:card_flag_event'), 'card-flagged timeline event should stay in timeline lane');

function byKey(key) {
  const item = designModel.itemsByKey.get(key);
  assert(item, 'missing design item ' + key);
  return item;
}

assertEqual(design.designItemCompareStatus(byKey('event:same_event')), 'same', 'same event compare status');
assertEqual(design.designItemCompareStatus(byKey('event:added_event')), 'added', 'added event compare status');
assertEqual(design.designItemCompareStatus(byKey('event:missing_event')), 'missing_from_current', 'missing baseline compare status');
assertEqual(design.designItemCompareStatus(byKey('card:changed_card')), 'changed', 'changed card compare status');
assertEqual(design.designItemCompareStatus(byKey('event:opaque_event')), 'unknown', 'opaque event compare status');
assertEqual(design.designItemCompareStatus(byKey('surface_text:status_scene:資源:resources:source/scenes/status.scene.dry:33')), 'unknown', 'surface text compare status without fingerprint');

assertEqual(designModel.summary.compare.same, 2, 'same count');
assertEqual(designModel.summary.compare.added, 2, 'added count');
assertEqual(designModel.summary.compare.missing_from_current, 1, 'missing count');
assertEqual(designModel.summary.compare.changed, 1, 'changed count');
assertEqual(designModel.summary.compare.unknown, 2, 'unknown count');
assertEqual(designModel.summary.compare.no_baseline, 0, 'no baseline count with baseline');

const noBaseline = design.buildDesignModel(currentModel, null);
assert(noBaseline.items.every((item) => design.designItemCompareStatus(item) === 'no_baseline'), 'items should not be marked added when no baseline is loaded');
assertEqual(noBaseline.summary.compare.no_baseline, noBaseline.items.length, 'no baseline summary count');

const filtered = design.filterDesignItems(designModel, {query: 'changed', lane: 'cards_advisors', compare: 'changed'});
assertEqual(filtered.length, 1, 'filtered changed card count');
assertEqual(filtered[0].key, 'card:changed_card', 'filtered changed card key');
const filteredByKind = design.filterDesignItems(designModel, {kind: 'news'});
assertEqual(filteredByKind.length, 1, 'kind filter should isolate news');
const editableItems = design.filterDesignItems(designModel, {authoring: 'editable'});
assert(editableItems.some((item) => item.kind === 'event'), 'authoring filter should include editable events');
assert(editableItems.every((item) => design.designItemDraftSupport(item).supported), 'authoring editable filter should only include supported draft items');
const warningItems = design.filterDesignItems(designModel, {severity: 'warning'});
assert(warningItems.some((item) => item.key === 'event:same_event'), 'severity filter should include warning event');
assertEqual(design.itemSeverity(byKey('event:same_event')), 'warning', 'item severity helper');

assertEqual(design.designItemDraftSupport(byKey('event:same_event')).template, 'event', 'event draft support');
assertEqual(design.designItemDraftSupport(byKey('card:changed_card')).template, 'card', 'card draft support');
assertEqual(
  design.designItemDraftSupport(byKey('news:dated:news_2:Fresh headline:source/scenes/post_event_news.scene.dry:42')).template,
  'news',
  'news draft support'
);
assertEqual(
  design.designItemDraftSupport(byKey('surface_text:status_scene:資源:resources:source/scenes/status.scene.dry:33')).template,
  'surface',
  'surface draft support'
);
assertEqual(design.designItemDraftSupport(byKey('event:missing_event')).supported, false, 'missing baseline item should not be draft editable');

const html = fs.readFileSync(path.join(__dirname, 'viewer', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'viewer', 'styles.css'), 'utf8');
const wizardUi = fs.readFileSync(path.join(__dirname, 'viewer', 'wizard_ui.js'), 'utf8');
assert(html.includes('data-mode="design"'), 'Direction C Design mode should be exposed in the top-level mode switch');
assert(html.includes('id="design-pane"'), 'viewer should expose the Design pane');
assert(html.includes('id="design-baseline-file"'), 'Design pane should include baseline ProjectIndex picker');
assert(html.includes('id="design-graph-canvas"'), 'Design pane should include a graph canvas');
assert(html.includes('id="design-status-bar"'), 'Design pane should include an Atelier status bar');
assert(html.includes('id="design-kind-filter"'), 'Design pane should include type filter');
assert(html.includes('id="design-authoring-filter"'), 'Design pane should include authoring-state filter');
assert(html.includes('id="design-severity-filter"'), 'Design pane should include severity filter');
assert(html.includes('design_model.js'), 'viewer should load design model helper');
assert(html.includes('design_ui.js'), 'viewer should load design UI helper');
assert(css.includes('.design-workspace'), 'CSS should style Design workspace');
assert(css.includes('.design-flow-board'), 'CSS should style Design flow board');
assert(css.includes('.design-graph-canvas'), 'Design CSS should style the Atelier graph canvas');
assert(css.includes('.design-status-bar'), 'Design CSS should style the persistent Atelier status bar');
assert(!css.includes('body[data-mode="design"] .topbar'), 'Design mode must not darken the global topbar');
assert(!css.includes('grid-template-columns: 200px minmax(0, 1fr) 320px'), 'Design workspace should not use the Direction B three-pane layout');
assert(!css.includes('.design-stage-header'), 'Design mode should not use the Studio stage header');
assert(!css.includes('minmax(430px'), 'Design mode should not use the mistaken wide lane dump');
const designNodeTitleCss = cssRuleBlock(css, '.design-node-title');
assert(!/font-size:\s*2[0-9]px/.test(designNodeTitleCss), 'Design graph node titles should not use oversized screenshot-derived titles');
assert(wizardUi.includes("mode === 'design'"), 'mode switch should keep Design mode visible');
const designUi = fs.readFileSync(path.join(__dirname, 'viewer', 'design_ui.js'), 'utf8');
assert(designUi.includes('selected.present !== false'), 'Design UI should not open missing baseline-only rows in Explore');
assert(designUi.includes('canOpenExplore ?'), 'Design inspector should disable Open in Explore when no current row exists');
assert(designUi.includes('renderGraphCanvas'), 'Design UI should render a graph canvas');
assert(designUi.includes('selectEdgeNeighbor'), 'Design UI should support graph edge navigation');
assert(designUi.includes('data-design-target-key'), 'Design inspector edge rows should navigate to linked nodes');
assert(!designUi.includes('renderDesignRow'), 'Design UI should not render the old lane-row board as the primary view');

let realIndexStats = null;
if (indexPath) {
  if (!fs.existsSync(indexPath)) {
    fail('index not found at ' + indexPath);
  }
  const realIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const validation = viewer.validateProjectIndex(realIndex);
  if (!validation.ok) {
    fail('real index validation failed: ' + validation.errors.join('; '));
  }
  const realModel = viewer.buildViewModel(realIndex);
  const realDesignModel = design.buildDesignModel(realModel, null);
  const eventIds = new Set(realModel.lists.events.map((item) => item.id));
  const duplicateCardEvents = realModel.lists.cards.filter((item) => eventIds.has(item.id));
  assertEqual(duplicateCardEvents.length, 0, 'real index events duplicated in card/advisor list');
  assert(realDesignModel.items.length > 0, 'real index should produce design items');
  assert(realDesignModel.graph.nodes.length > 0, 'real index should produce design graph nodes');
  assert(realDesignModel.graph.edges.length > 0, 'real index should produce design graph edges');
  assert(realDesignModel.lanes.some((lane) => lane.id === 'timeline_events' && lane.count > 0), 'real index should populate timeline lane');
  assert(realDesignModel.lanes.some((lane) => lane.id === 'cards_advisors' && lane.count > 0), 'real index should populate cards/advisors lane');
  assert(realDesignModel.lanes.some((lane) => lane.id === 'news' && lane.count > 0), 'real index should populate news lane');
  assert(realDesignModel.lanes.some((lane) => lane.id === 'surface_sidebar' && lane.count > 0), 'real index should populate surface/sidebar lane');
  assert(realDesignModel.items.every((item) => design.designItemCompareStatus(item) === 'no_baseline'), 'real index without baseline should not mark items added');
  const fingerprintedScenes = realModel.scenes.filter((scene) => scene.sourceFingerprint).length;
  const postEvent = realModel.scenesById.get('post_event');
  assert(fingerprintedScenes > 0, 'real index should include optional scene source fingerprints');
  assert(!postEvent || !postEvent.sourceFingerprint, 'post_event should not get a source fingerprint');
  if (fixtureIslands) {
    assertEqual(realModel.summary.sceneCount, 189, 'Island fixture scene count');
    assertEqual(realModel.summary.edgeCount, 1827, 'Island fixture edge count');
    assertEqual(realModel.summary.variableCount, 2815, 'Island fixture variable count');
  }
  realIndexStats = {
    path: path.resolve(indexPath),
    rows: realDesignModel.items.length,
    fingerprintedScenes
  };
}

console.log(JSON.stringify({
  ok: true,
  rows: designModel.items.length,
  lanes: designModel.lanes.length,
  compare: designModel.summary.compare,
  realIndex: realIndexStats
}, null, 2));
