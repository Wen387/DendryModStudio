#!/usr/bin/env node
'use strict';

const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const storyboardModel = require('./authoring/content_storyboard_model.js');
global.ProjectMapContentStoryboardModel = storyboardModel;
const storyboardSurface = require('./viewer/content_storyboard_surface.js');
const storyPaletteModel = require('./authoring/story_palette_model.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function scene(id, title, year, options) {
  const path = 'source/scenes/events/' + id + '.scene.dry';
  return {
    id,
    title,
    path,
    type: 'event',
    flags: {isCard: false},
    viewIf: 'year = ' + year + ' and month >= 1 and month <= 3',
    options: options || [],
    sourceSpan: {path, startLine: 1, endLine: 80}
  };
}

const electionStart = scene('election_start', '1929 Election Begins', 1929, [
  {target: {id: 'election_rally'}, title: 'Open the rally route'}
]);
const electionRally = scene('election_rally', '1929 Rally Response', 1929, [
  {target: {id: 'election_backlash'}, title: 'Let backlash form'}
]);
const electionBacklash = scene('election_backlash', 'Backlash Builds', 1930, []);
const cardPath = 'source/scenes/cards/campaign_card.scene.dry';

const index = {
  schemaVersion: '0.1',
  project: {name: 'Storyboard Fixture', root: '/tmp/storyboard-fixture'},
  scenes: [
    electionStart,
    electionRally,
    electionBacklash,
    {
      id: 'campaign_card',
      title: 'Campaign Organizing Card',
      path: cardPath,
      type: 'card',
      flags: {isCard: true},
      tags: ['cards'],
      options: [{target: {id: 'election_rally'}, title: 'Organize the rally'}],
      sourceSpan: {path: cardPath, startLine: 1, endLine: 70}
    }
  ],
  edges: [
    {from: 'election_start', to: 'election_rally', kind: 'go_to', label: 'rally route', source: {path: electionStart.path, line: 18}},
    {from: 'election_rally', to: 'election_backlash', kind: 'go_to', label: 'backlash branch', source: {path: electionRally.path, line: 22}}
  ],
  variables: [
    {name: 'public_order', readCount: 1, writeCount: 1, reads: [{path: electionStart.path, line: 4}], writes: [{path: electionRally.path, line: 20}]}
  ],
  semantic: {
    events: [
      {id: 'election_start', title: '1929 Election Begins', path: electionStart.path},
      {id: 'election_rally', title: '1929 Rally Response', path: electionRally.path}
    ],
    cards: [{id: 'campaign_card', title: 'Campaign Organizing Card', path: cardPath}],
    news: {
      sources: ['source/scenes/post_event_news.scene.dry'],
      items: [{
        id: 'rally_news',
        headline: 'Rally news reaches the papers',
        description: 'The public reads the first response.',
        when: {year: 1929, month: 2},
        source: {path: 'source/scenes/post_event_news.scene.dry', line: 40}
      }]
    },
    textCorpus: {
      items: [
        textItem('election_start_title', '1929 Election Begins', 'title', 'election_start', electionStart.path, 1),
        textItem('election_start_body', 'The election chain opens in 1929.', 'body', 'election_start', electionStart.path, 8),
        textItem('election_start_option', 'Open the rally route', 'option_label', 'election_start', electionStart.path, 16, 'election_rally')
      ]
    }
  }
};

const existing = canvasModel.buildExistingCanvas(index, 'events', 'election_start', {
  values: {election_start_body: 'The election opens with a sharper public meeting.'},
  entry: {source: 'Design', action: 'edit_existing'}
});

assert(existing.ok, 'existing event should open for storyboard check: ' + JSON.stringify(existing.changeState.diagnostics));

const timeline = storyboardModel.buildStoryboard(index, existing, {
  view: 'timeline',
  draftBranches: [
    {template: 'event', id: 'election_start_followup', title: 'Follow-up event', detail: 'Next beat after the selected election opening.'}
  ]
});

assert(timeline.kind === 'content_storyboard_model', 'storyboard model should expose its kind');
assert(timeline.view === 'timeline', 'timeline view should be selected');
assert(timeline.cards.some((card) => card.key === 'event:election_start' && card.current && card.editable), 'current event should be an editable story card');
assert(timeline.cards.some((card) => card.kind === 'card' && card.title === 'Campaign Organizing Card'), 'timeline should include card story objects');
assert(timeline.cards.some((card) => card.kind === 'news'), 'timeline should include news story objects');
assert(timeline.timeline.lanes.some((lane) => lane.year === 1929 && lane.cards.length >= 2), 'timeline should include a 1929 lane with story cards');
assert(timeline.timeline.insertionPoints.some((point) => point.year === 1929), 'timeline should expose year insertion points');
assert(timeline.timeline.storyScope && timeline.timeline.storyScope.mode === 'focus', 'timeline should expose a focused story scope window');
assert(timeline.timeline.storyScope.summaryLanes.some((lane) => lane.key === '1929' && lane.selected), 'scope overview should mark the selected year');
assert(timeline.timeline.allLanes.some((lane) => lane.key === '1930'), 'timeline should retain all lanes outside the visible window');
assert(timeline.cards.some((card) => card.key === 'draft:election_start_followup'), 'draft branch should appear as a storyboard card');
assert(timeline.cards.some((card) => card.key === 'event:election_start' && card.body.includes('chain opens')), 'story cards should prefer player-facing text corpus excerpts');
assert(timeline.palette && timeline.palette.groups.some((group) => group.key === 'current_scope' && group.entries.length), 'timeline palette should expose current-scope story objects');
assert(timeline.palette.groups.some((group) => group.key === 'drafts' && group.entries.some((entry) => entry.key === 'draft:election_start_followup')), 'timeline palette should expose draft story objects');
assert(timeline.storyContext && timeline.storyContext.selected && timeline.storyContext.selected.positionLabel.includes('1929'), 'story context should explain selected global timeline position');
assert(timeline.storyContext.timeline.lanes.some((lane) => lane.selected && lane.count >= 2), 'story context should mark the selected dense lane');
assert(timeline.storyContext.creationTargets.some((target) => target.key === 'time:1929'), 'story context should expose timeline creation targets');

const chain = storyboardModel.buildStoryboard(index, existing, {
  view: 'chain',
  draftBranches: [
    {template: 'event', id: 'counterfactual_rally', title: 'Counterfactual rally', detail: 'Alternative branch after the election opening.'}
  ]
});

const levels = Object.fromEntries(chain.chain.levels.map((level) => [level.key, level]));
assert(chain.view === 'chain', 'chain view should be selected');
assert(levels.selected.cards.some((card) => card.id === 'election_start'), 'chain should center the selected event');
assert(levels.routes.cards.some((card) => card.id === 'election_rally'), 'chain should show downstream event-route consumers');
assert(levels.branches.cards.some((card) => card.id === 'counterfactual_rally'), 'chain should show branch draft cards');
assert(chain.chain.insertionPoints.some((point) => point.action === 'followup'), 'chain should expose follow-up insertion');
assert(chain.chain.connectors.some((connector) => connector.fromKey === 'event:election_start' && connector.toKey === 'event:election_rally'), 'chain should expose visible event connectors');
assert(chain.chain.depth === '1', 'chain should default to one-hop focus depth');
assert(chain.palette.groups.some((group) => group.key === 'routes' && group.entries.some((entry) => entry.key === 'event:election_rally')), 'chain palette should expose route/downstream candidates');
assert(chain.storyContext.chain.routeCount >= 1, 'story context should summarize route/downstream count');
assert(chain.storyContext.chain.branchCount >= 1, 'story context should summarize branch count');
assert(chain.editor.storyContext.selected.positionLabel.includes('1929'), 'editor should receive story context outside the canvas nodes');

const filteredPalette = storyPaletteModel.buildPalette(timeline, {storyPaletteQuery: 'rally', storyPaletteType: 'event'});
assert(filteredPalette.groups.some((group) => group.entries.some((entry) => entry.key === 'event:election_rally')), 'palette search should retain matching event entries');
assert(!filteredPalette.groups.some((group) => group.entries.some((entry) => entry.kind === 'news')), 'palette type filter should remove non-event entries');

const timelineHtml = storyboardSurface.render(existing, {
  projectIndex: index,
  view: 'timeline',
  selected: 'event:election_start',
  draftBranches: timeline.cards.filter((card) => card.draftBranch),
  storyPaletteOpen: true
});
assert(timelineHtml.includes('data-content-storyboard-surface="true"'), 'surface should expose storyboard QA marker');
assert(timelineHtml.includes('data-storyboard-kind="timeline"'), 'surface should render the timeline canvas');
assert(timelineHtml.includes('data-content-storyboard-card="event:election_start"'), 'surface should render event cards');
assert(timelineHtml.includes('data-storyboard-palette="true"'), 'surface should render the Storyboard Palette');
assert(timelineHtml.includes('data-storyboard-palette-item="true"'), 'palette should render draggable story object items');
assert(timelineHtml.includes('data-storyboard-drop-target="timeline_lane"'), 'timeline lanes should expose palette drop targets');
assert(timelineHtml.includes('data-content-storyboard-insert="time:1929"'), 'surface should render time-slot insertion');
assert(timelineHtml.includes('data-content-storyboard-global-context="true"'), 'surface should render global story context in the canvas');
assert(timelineHtml.includes('data-content-storyboard-overview="true"'), 'surface should render a timeline overview/minimap strip');
assert(timelineHtml.includes('data-content-storyboard-scope="true"'), 'surface should render focused story scope controls');
assert(timelineHtml.includes('data-storyboard-card-face="event"'), 'surface should render player-facing card face markers');
assert(timelineHtml.includes('data-storyboard-card-state='), 'surface should render card state markers');
assert(timelineHtml.includes('data-content-storyboard-create-menu="true"'), 'surface should render create-here event/card/news affordances');
assert(timelineHtml.includes('data-content-storyboard-story-context="true"'), 'editor should render story context outside the canvas cards');
assert(!timelineHtml.includes('data-object-canvas-graph-inspector'), 'content storyboard should not render the old graph inspector');
assert(!timelineHtml.includes('>Object</span><strong>'), 'content storyboard should not render the old Object workflow node');
assert(!timelineHtml.includes('>Plan</span><strong>'), 'content storyboard should not render Plan as a canvas node');

const chainHtml = storyboardSurface.render(existing, {
  projectIndex: index,
  view: 'chain',
  selected: 'event:election_start',
  draftBranches: [{template: 'event', id: 'counterfactual_rally', title: 'Counterfactual rally'}],
  storyPaletteOpen: true
});
assert(chainHtml.includes('data-storyboard-kind="chain"'), 'surface should render the chain canvas');
assert(chainHtml.includes('Counterfactual rally'), 'chain surface should show branch draft cards');
assert(chainHtml.includes('data-content-storyboard-chain-evidence="true"'), 'chain surface should render route/branch evidence labels');
assert(chainHtml.includes('data-content-storyboard-chain-connectors="true"'), 'chain surface should render causal connector layer');
assert(chainHtml.includes('data-content-storyboard-depth-controls="true"'), 'chain surface should render depth controls');
assert(chainHtml.includes('data-storyboard-drop-target="chain_gap"'), 'chain surface should expose palette drop targets');
assert(chainHtml.includes('data-content-storyboard-plan="true"'), 'technical plan should live in the editor panel');

process.stdout.write(JSON.stringify({
  ok: true,
  timelineCards: timeline.cards.length,
  timelineYears: timeline.timeline.lanes.map((lane) => lane.year),
  chainLevels: chain.chain.levels.map((level) => level.key)
}, null, 2) + '\n');

function textItem(id, text, role, sceneId, path, line, itemId) {
  return {
    id,
    text,
    role,
    owner: {kind: 'scene', sceneId, itemId},
    source: {path, line}
  };
}
