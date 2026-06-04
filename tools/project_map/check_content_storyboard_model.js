#!/usr/bin/env node
'use strict';

const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const storyboardModel = require('./authoring/content_storyboard_model.js');
const storyboardWorkspaceState = require('./viewer/storyboard_workspace_state.js');
const referenceIndex = require('./viewer/authoring_reference_index.js');
global.ProjectMapContentStoryboardModel = storyboardModel;
global.ProjectMapRuntimeLensUi = require('./viewer/runtime_lens_ui.js');
const storyboardSurface = require('./viewer/content_storyboard_surface.js');
const storyPaletteModel = require('./authoring/story_palette_model.js');

const {fail, assert} = require('./check_harness.js');

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
const civilWar = scene('civil_war', 'Civil War', 1932, []);
civilWar.routes = {goTo: [{id: 'war_menu', raw: 'war_menu'}]};
civilWar.sections = [
  {
    id: 'civil_war.war_menu',
    sourceSpan: {path: civilWar.path, startLine: 40, endLine: 45},
    routes: {},
    options: [
      {id: '@rw_help', target: {kind: 'scene', id: 'rw_help'}, title: 'Appeal to the Reichswehr.', sourceSpan: {path: civilWar.path, line: 43, startLine: 43, endLine: 43}},
      {id: '@war_outcome', target: {kind: 'scene', id: 'war_outcome'}, title: 'Now, the battle...', sourceSpan: {path: civilWar.path, line: 44, startLine: 44, endLine: 44}}
    ]
  },
  {
    id: 'civil_war.rw_help',
    maxVisits: '1',
    sourceSpan: {path: civilWar.path, startLine: 46, endLine: 52},
    routes: {goTo: [{id: 'war_menu', raw: 'war_menu'}]},
    options: []
  },
  {
    id: 'civil_war.war_outcome',
    viewIf: 'war_choices >= 2',
    sourceSpan: {path: civilWar.path, startLine: 53, endLine: 56},
    routes: {goTo: [{id: 'defeat', raw: 'defeat if total_defeat = 1', predicate: 'total_defeat = 1'}]},
    options: []
  },
  {
    id: 'civil_war.defeat',
    sourceSpan: {path: civilWar.path, startLine: 57, endLine: 62},
    routes: {},
    options: []
  }
];
const cardPath = 'source/scenes/cards/campaign_card.scene.dry';
const advisorPath = 'source/scenes/advisors/campaign_advisor.scene.dry';

const index = {
  schemaVersion: '0.1',
  project: {name: 'Storyboard Fixture', root: '/tmp/storyboard-fixture'},
  scenes: [
    electionStart,
    electionRally,
    electionBacklash,
    civilWar,
    {
      id: 'campaign_card',
      title: 'Campaign Organizing Card',
      path: cardPath,
      type: 'card',
      flags: {isCard: true},
      tags: ['cards'],
      options: [{target: {id: 'election_rally'}, title: 'Organize the rally'}],
      sourceSpan: {path: cardPath, startLine: 1, endLine: 70}
    },
    {
      id: 'campaign_advisor',
      title: 'Campaign Advisor',
      path: advisorPath,
      type: 'advisor',
      flags: {isCard: true, isPinnedCard: true},
      tags: ['advisor'],
      options: [],
      sourceSpan: {path: advisorPath, startLine: 1, endLine: 44}
    }
  ],
  edges: [
    {from: 'election_start', to: 'election_rally', kind: 'go_to', label: 'rally route', source: {path: electionStart.path, line: 18}},
    {from: 'election_rally', to: 'election_backlash', kind: 'go_to', label: 'backlash branch', source: {path: electionRally.path, line: 22}},
    {from: 'civil_war', to: 'civil_war.war_menu', kind: 'go_to', rawTarget: 'war_menu', source: {path: civilWar.path, line: 12}},
    {from: 'civil_war.war_menu', to: 'civil_war.rw_help', kind: 'choice', label: 'Appeal to the Reichswehr.', rawTarget: '@rw_help', source: {path: civilWar.path, line: 43}},
    {from: 'civil_war.rw_help', to: 'civil_war.war_menu', kind: 'go_to', rawTarget: 'war_menu', source: {path: civilWar.path, line: 48}},
    {from: 'civil_war.war_menu', to: 'civil_war.war_outcome', kind: 'choice', label: 'Now, the battle...', rawTarget: '@war_outcome', source: {path: civilWar.path, line: 44}},
    {from: 'civil_war.war_outcome', to: 'civil_war.defeat', kind: 'conditional_go_to', condition: 'total_defeat = 1', rawTarget: 'defeat', source: {path: civilWar.path, line: 55}}
  ],
  variables: [
    {name: 'public_order', readCount: 1, writeCount: 1, reads: [{path: electionStart.path, line: 4}], writes: [{path: electionRally.path, line: 20}]},
    {name: 'unused_flag', readCount: 0, writeCount: 0, reads: [], writes: []},
    {name: 'read_only_flag', readCount: 3, writeCount: 0, reads: [{path: electionStart.path, line: 12}], writes: []},
    {name: 'write_only_flag', readCount: 0, writeCount: 2, reads: [], writes: [{path: electionRally.path, line: 21}]},
    {name: 'hot_flag', readCount: 24, writeCount: 4, reads: [{path: electionStart.path, line: 13}], writes: [{path: electionRally.path, line: 22}]}
  ],
  semantic: {
    events: [
      {id: 'election_start', title: '1929 Election Begins', path: electionStart.path},
      {id: 'election_rally', title: '1929 Rally Response', path: electionRally.path},
      {id: 'civil_war', title: 'Civil War', path: civilWar.path}
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
        textItem('election_start_option', 'Open the rally route', 'option_label', 'election_start', electionStart.path, 16, 'election_rally'),
        textItem('civil_war_title', 'Civil War', 'title', 'civil_war', civilWar.path, 1),
        textItem('civil_war_body', 'The array of forces is uncertain.', 'body', 'civil_war', civilWar.path, 41, '', 'civil_war.war_menu'),
        textItem('civil_war_rw', 'Appeal to the Reichswehr.', 'option_label', 'civil_war', civilWar.path, 43, 'rw_help', 'civil_war.war_menu')
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
assert(timeline.canvasCategory && timeline.canvasCategory.key === 'story', 'storyboard should default to the story-only category');
assert(!timeline.cards.some((card) => card.kind === 'card' && card.title === 'Campaign Organizing Card'), 'story category should keep card/advisor objects out of the world-event canvas by default');
assert(!timeline.cards.some((card) => card.kind === 'advisor' && card.title === 'Campaign Advisor'), 'story category should keep advisor objects out of the world-event canvas by default');
assert(timeline.metrics && timeline.metrics.hiddenByCategoryCount >= 1, 'story category should report hidden card/advisor objects');
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
assert(timeline.palette.groups.some((group) => group.entries.some((entry) => entry.key === 'card:campaign_card')), 'default Story Palette should include cards hidden from the story canvas category');
assert(timeline.palette.groups.some((group) => group.entries.some((entry) => entry.key === 'advisor:campaign_advisor')), 'default Story Palette should include advisors hidden from the story canvas category');
assert(timeline.palette.groups.some((group) => group.key === 'state_variables' && group.entries.some((entry) => entry.key === 'variable:public_order' && entry.kind === 'state' && entry.draggable === false)), 'Story Palette should expose Project State variables as read-only Canvas assets');
assert(timeline.palette.typeCounts && timeline.palette.typeCounts.state === 5, 'Story Palette should count state variable assets');
assert(timeline.palette.groups.every((group) => !group.hiddenCount), 'empty Story Palette search should not hide entries behind a group limit');
assert(timeline.storyContext && timeline.storyContext.selected && timeline.storyContext.selected.positionLabel.includes('1929'), 'story context should explain selected global timeline position');
assert(timeline.storyContext.timeline.lanes.some((lane) => lane.selected && lane.count >= 2), 'story context should mark the selected dense lane');
assert(timeline.storyContext.creationTargets.some((target) => target.key === 'time:1929'), 'story context should expose timeline creation targets');

const searchTimeline = storyboardModel.buildStoryboard(index, existing, {
  view: 'timeline',
  storySearchQuery: 'rally'
});
assert(searchTimeline.search && searchTimeline.search.active, 'storyboard search should mark the query active');
assert(searchTimeline.search.matchCount >= 1, 'storyboard search should report matching story cards');
assert(searchTimeline.cards.some((card) => card.title.indexOf('Rally') >= 0 || card.body.indexOf('rally') >= 0), 'storyboard search should retain matching cards on the canvas');

const cardsCategory = storyboardModel.buildStoryboard(index, existing, {
  view: 'timeline',
  storyCanvasCategory: 'cards'
});
assert(cardsCategory.canvasCategory && cardsCategory.canvasCategory.key === 'cards', 'cards category should be selectable');
assert(cardsCategory.cards.some((card) => card.kind === 'card' && card.title === 'Campaign Organizing Card'), 'cards category should show card/advisor objects when requested');
assert(cardsCategory.cards.some((card) => card.kind === 'advisor' && card.title === 'Campaign Advisor'), 'cards category should show advisor objects when requested');
assert(cardsCategory.cards.some((card) => card.key === 'event:election_start' && card.current), 'cards category should keep the current story object as the selected anchor');

const allCategory = storyboardModel.buildStoryboard(index, existing, {
  view: 'timeline',
  storyCanvasCategory: 'all'
});
assert(allCategory.cards.some((card) => card.kind === 'card' && card.title === 'Campaign Organizing Card'), 'all category should include card/advisor objects for cross-context switching');
assert(allCategory.cards.some((card) => card.kind === 'advisor' && card.title === 'Campaign Advisor'), 'all category should include advisors for cross-context switching');
assert(allCategory.cards.some((card) => card.kind === 'news'), 'all category should retain news objects');

const chain = storyboardModel.buildStoryboard(index, existing, {
  view: 'chain',
  draftBranches: [
    {template: 'event', id: 'counterfactual_rally', title: 'Counterfactual rally', detail: 'Alternative branch after the election opening.'}
  ]
});

const levels = Object.fromEntries(chain.chain.levels.map((level) => [level.key, level]));
assert(chain.view === 'chain', 'chain view should be selected');
assert(levels.selected.cards.some((card) => card.id === 'election_start'), 'chain should center the selected event');
assert(levels.routes.cards.some((card) => card.kind === 'chain_relation' && card.chainRelation && card.chainRelation.toId === 'election_rally'), 'chain should show route relationships as first-class cards');
assert(levels.downstream.cards.some((card) => card.id === 'election_rally'), 'chain should show downstream route targets separately from relationships');
assert(levels.branches.cards.some((card) => card.id === 'counterfactual_rally'), 'chain should show branch draft cards');
assert(chain.chain.insertionPoints.some((point) => point.action === 'followup'), 'chain should expose follow-up insertion');
assert(chain.chain.connectors.some((connector) => connector.fromKey === 'event:election_start' && String(connector.toKey || '').indexOf('relation:') === 0), 'chain should connect selected events to relationship cards');
assert(chain.chain.connectors.some((connector) => String(connector.fromKey || '').indexOf('relation:') === 0 && connector.toKey === 'event:election_rally'), 'chain should connect relationship cards to downstream targets');
assert(chain.chain.depth === '1', 'chain should default to one-hop focus depth');
assert(chain.palette.groups.some((group) => group.key === 'routes' && group.entries.some((entry) => String(entry.key || '').indexOf('relation:') === 0)), 'chain palette should expose jump relationship candidates');
assert(chain.palette.groups.some((group) => group.key === 'downstream' && group.entries.some((entry) => entry.key === 'event:election_rally')), 'chain palette should expose downstream targets');
assert(chain.storyContext.chain.routeCount >= 1, 'story context should summarize route/downstream count');
assert(chain.storyContext.chain.downstreamCount >= 1, 'story context should summarize downstream target count');
assert(chain.storyContext.chain.branchCount >= 1, 'story context should summarize branch count');
assert(chain.editor.storyContext.selected.positionLabel.includes('1929'), 'editor should receive story context outside the canvas nodes');
const relationKey = levels.routes.cards[0] && levels.routes.cards[0].key;
const relationSelectState = {
  workspace: 'content',
  mode: 'existing',
  view: 'events',
  item: 'election_start',
  values: {},
  selectedCanvasNode: 'event:election_start',
  model: existing
};
let relationSelectRendered = false;
assert(storyboardWorkspaceState.selectObject(relationSelectState, relationKey, {
  collectValues: () => ({}),
  buildExistingModel: () => existing,
  buildTemplateModel: () => existing,
  render: () => { relationSelectRendered = true; },
  t: (_key, fallback) => fallback
}), 'clicking a relationship card should keep the current event open for route editing');
assert(relationSelectState.selectedCanvasNode === relationKey && relationSelectState.editorOverlay && relationSelectRendered, 'relationship selection should highlight the relation and open the object editor overlay');

const complexExisting = canvasModel.buildExistingCanvas(index, 'events', 'civil_war', {
  values: {},
  entry: {source: 'Design', action: 'edit_existing'}
});
assert(complexExisting.ok, 'single composite event should open for storyboard check: ' + JSON.stringify(complexExisting.changeState.diagnostics));
assert(complexExisting.eventBody.options.some((option) => option.targetId === 'civil_war.rw_help'), 'object editor should expose section-owned choices for single composite events');
assert(complexExisting.eventBody.metaFields.some((field) => field.role === 'route' && field.sectionId === 'civil_war.war_outcome' && field.original === 'defeat'), 'object editor should expose conditional internal go-to routes');
assert(complexExisting.contextBoard.flow.some((row) => row.direction === 'internal' && row.label === 'rw_help'), 'context board should include internal section flow rows');
const complexChain = storyboardModel.buildStoryboard(index, complexExisting, {
  view: 'chain',
  selected: 'event:civil_war',
  storyChainDepth: 'full'
});
assert(complexChain.chain.topology && complexChain.chain.topology.kind === 'single_composite_event', 'chain model should classify internal section flow as a single composite event');
assert(complexChain.chain.topology.internalStepCount >= 4, 'single composite event topology should count internal steps');
assert(complexChain.chain.levels.some((level) => level.key === 'downstream' && level.cards.some((card) => card.id === 'civil_war.war_menu')), 'chain should render local section endpoints as target cards');
assert(complexChain.chain.levels.some((level) => level.key === 'routes' && level.cards.some((card) => card.kind === 'chain_relation' && card.chainRelation && card.chainRelation.toId === 'civil_war.war_menu')), 'chain should render internal flow as editable relationship evidence');
assert(complexChain.chain.connectors.some((connector) => connector.fromKey === 'event:civil_war' && String(connector.toKey || '').indexOf('relation:') === 0), 'chain should connect scene entries to internal relationship cards');
assert(complexChain.storyContext.chain.topology.kind === 'single_composite_event', 'story context should carry event-shape topology');
const sectionSelectState = {
  workspace: 'content',
  mode: 'existing',
  view: 'events',
  item: 'civil_war',
  values: {},
  selectedCanvasNode: 'event:civil_war',
  model: complexExisting
};
let sectionSelectRendered = false;
const sectionSelected = storyboardWorkspaceState.selectObject(sectionSelectState, 'section:civil_war.war_menu', {
  collectValues: () => ({}),
  buildExistingModel: () => complexExisting,
  buildExistingModelFor: (view, id) => view === 'events' && id === 'civil_war' ? complexExisting : null,
  showWorkspace: () => {},
  render: () => { sectionSelectRendered = true; },
  t: (_key, fallback) => fallback
});
assert(sectionSelected, 'clicking an internal section card should select its parent event object');
assert(sectionSelectState.item === 'civil_war' && sectionSelectState.selectedCanvasNode === 'section:civil_war.war_menu', 'section selection should keep parent event open while preserving clicked section key');
assert(sectionSelectState.editorOverlay && sectionSelectRendered, 'section selection should open the object editor overlay');

const filteredPalette = storyPaletteModel.buildPalette(timeline, {storyPaletteQuery: 'rally', storyPaletteType: 'event'});
assert(filteredPalette.groups.some((group) => group.entries.some((entry) => entry.key === 'event:election_rally')), 'palette search should retain matching event entries');
assert(!filteredPalette.groups.some((group) => group.entries.some((entry) => entry.kind === 'news')), 'palette type filter should remove non-event entries');
const cardPalette = storyboardModel.buildStoryboard(index, existing, {view: 'timeline', storyPaletteType: 'card'}).palette;
assert(cardPalette.groups.some((group) => group.entries.some((entry) => entry.key === 'card:campaign_card')), 'card palette filter should search the full project candidate pool');
assert(!cardPalette.groups.some((group) => group.entries.some((entry) => entry.kind === 'event')), 'card palette filter should hide non-card entries');
const statePalette = storyboardModel.buildStoryboard(index, existing, {view: 'timeline', storyPaletteType: 'state'}).palette;
assert(statePalette.groups.some((group) => group.key === 'state_variables' && group.entries.some((entry) => entry.key === 'variable:public_order')), 'state palette filter should show Project State variables');
assert(!statePalette.groups.some((group) => group.entries.some((entry) => entry.kind === 'event')), 'state palette filter should hide story events');
const advisorPalette = storyboardModel.buildStoryboard(index, existing, {view: 'timeline', storyPaletteType: 'advisor'}).palette;
assert(advisorPalette.groups.some((group) => group.entries.some((entry) => entry.key === 'advisor:campaign_advisor')), 'advisor palette filter should search the full project candidate pool');
assert(!advisorPalette.groups.some((group) => group.entries.some((entry) => entry.kind === 'event')), 'advisor palette filter should hide non-advisor entries');
const paletteBoard = {
  view: 'timeline',
  selectedKey: 'event:election_start',
  currentKey: 'event:election_start',
  projectIndex: index,
  cards: timeline.cards,
  timeline: timeline.timeline,
  chain: timeline.chain
};
const diagnosticPalette = storyPaletteModel.buildPalette(paletteBoard, {
  storyPaletteOpen: true,
  storyPaletteType: 'state',
  storyPaletteSelectedKey: 'variable:unused_flag',
  storyPalettePinnedKeys: ['variable:unused_flag', 'variable:hot_flag'],
  storyPaletteRecentKeys: ['event:election_rally', 'variable:read_only_flag']
});
assert(diagnosticPalette.diagnostics.stateBadgeCounts.unused === 1, 'palette diagnostics should count unused state variables');
assert(diagnosticPalette.diagnostics.stateBadgeCounts.read_only === 1, 'palette diagnostics should count read-only state variables');
assert(diagnosticPalette.diagnostics.stateBadgeCounts.write_only === 1, 'palette diagnostics should count write-only state variables');
assert(diagnosticPalette.diagnostics.stateBadgeCounts.hot === 1, 'palette diagnostics should count hot state variables');
assert(diagnosticPalette.groups[0] && diagnosticPalette.groups[0].key === 'pinned', 'pinned assets should render before normal palette groups');
assert(diagnosticPalette.groups[0].entries[0].key === 'variable:unused_flag', 'pinned assets should preserve local preference order');
assert(diagnosticPalette.groups.some((group) => group.key === 'recent'), 'recent assets should render as their own palette group');
assert(diagnosticPalette.inspector && diagnosticPalette.inspector.key === 'variable:unused_flag', 'palette should build a lightweight inspector for selected assets');
assert(diagnosticPalette.inspector.badges.includes('unused'), 'state inspector should include diagnostic badges');
const stateLinkedPalette = storyPaletteModel.buildPalette(paletteBoard, {storyPaletteScopeFilter: 'state_linked'});
assert(stateLinkedPalette.groups.some((group) => group.entries.some((entry) => entry.key === 'variable:public_order')), 'state-linked scope should include variables referenced by the selected event source');
const syntheticCards = Array.from({length: 14}, (_item, index) => ({
  key: 'event:fixture_' + index,
  id: 'fixture_' + index,
  kind: 'event',
  title: 'Fixture item ' + index,
  body: 'Fixture body ' + index
}));
const unlimitedPalette = storyPaletteModel.buildPalette({view: 'timeline', cards: syntheticCards}, {storyPaletteType: 'all'});
const unlimitedGroup = unlimitedPalette.groups.find((group) => group.key === 'unplaced');
assert(unlimitedGroup && unlimitedGroup.entries.length === 14 && unlimitedGroup.hiddenCount === 0, 'empty palette search should show every matching entry in a group');
const limitedPalette = storyPaletteModel.buildPalette({view: 'timeline', cards: syntheticCards}, {storyPaletteQuery: 'Fixture', storyPaletteType: 'all'});
const limitedGroup = limitedPalette.groups.find((group) => group.key === 'unplaced');
assert(limitedGroup && limitedGroup.entries.length === 12 && limitedGroup.hiddenCount === 2, 'active palette search should still use the compact group limit');

const timelineHtml = storyboardSurface.render(existing, {
  projectIndex: index,
  view: 'timeline',
  selected: 'event:election_start',
  draftBranches: timeline.cards.filter((card) => card.draftBranch),
  storyPaletteOpen: true,
  storyPaletteSelectedKey: 'variable:public_order',
  storyPaletteScopeFilter: 'related',
  storyPalettePinnedKeys: ['variable:public_order'],
  storyPaletteRecentKeys: ['event:election_rally'],
  storyPaletteWidth: 444,
  storyCardColors: {'event:election_start': '#1a6f9f'}
});
assert(timelineHtml.includes('data-content-storyboard-surface="true"'), 'surface should expose storyboard QA marker');
assert(timelineHtml.includes('data-storyboard-kind="timeline"'), 'surface should render the timeline canvas');
assert(timelineHtml.includes('data-content-storyboard-search="true"'), 'surface should render quick Storyboard search');
assert(timelineHtml.includes('data-content-storyboard-category-filter="true"'), 'surface should render storyboard category filters');
assert(timelineHtml.includes('data-storyboard-canvas-category="cards"'), 'surface should expose the card/advisor category switch');
assert(timelineHtml.includes('data-object-canvas-action="toggle_story_navigator"'), 'surface should expose the single timeline navigator collapse toggle');
assert(timelineHtml.includes('data-storyboard-card-color-picker="true"'), 'surface should render card edge color controls');
assert(timelineHtml.includes('--storyboard-card-edge: #1a6f9f'), 'surface should apply cached custom card edge colors');
assert(timelineHtml.includes('data-object-canvas-action="discard_draft_card"'), 'surface should expose draft card discard controls');
assert(timelineHtml.includes('data-storyboard-draft-key="draft:election_start_followup"'), 'draft discard controls should target the rendered draft card key');
assert(timelineHtml.includes('data-content-storyboard-card="event:election_start"'), 'surface should render event cards');
assert(timelineHtml.includes('data-storyboard-palette="true"'), 'surface should render the Storyboard Palette');
assert(timelineHtml.includes('--storyboard-palette-width: 444px'), 'palette should apply a user-sized asset rail width');
assert(timelineHtml.includes('data-storyboard-palette-density="compact"'), 'palette should render the Canvas asset rail as a compact IDE-style explorer');
assert(timelineHtml.includes('data-storyboard-palette-resizer="true"'), 'palette should expose a local width resizer');
assert(timelineHtml.includes('data-object-canvas-action="toggle_story_palette_chrome"'), 'palette should expose a compact controls toggle');
assert(timelineHtml.includes('data-storyboard-palette-item="true"'), 'palette should render draggable story object items');
assert(timelineHtml.includes('storyboard-palette-item-type'), 'palette entries should expose a compact type rail');
assert(timelineHtml.includes('storyboard-palette-item-footer'), 'palette entries should keep source, tags, and badges in a dense footer');
assert(timelineHtml.includes('data-storyboard-palette-scroll="true"'), 'palette should render an independently scrollable asset list');
assert(timelineHtml.includes('data-storyboard-palette-window-enabled='), 'palette scroll region should expose virtual-window metadata');
assert(timelineHtml.includes('data-storyboard-palette-scope-filters="true"'), 'palette should render scope-aware filters');
assert(timelineHtml.includes('data-storyboard-palette-inspector="true"'), 'palette should render a lightweight inspector');
assert(timelineHtml.includes('data-object-canvas-action="open_story_palette_selection"'), 'palette inspector should expose explicit open action');
assert(timelineHtml.includes('data-storyboard-palette-pin='), 'palette should expose local pin buttons');
assert(timelineHtml.includes('data-storyboard-palette-badge='), 'palette should render scope or diagnostic badges');
assert(timelineHtml.includes('storyboard-palette-item-state is-reference-only'), 'palette should render state variables as reference navigation items');
assert(timelineHtml.includes('data-storyboard-palette-kind="state"'), 'palette should expose stable state asset markers');
assert(timelineHtml.includes('storyboard-palette-meta'), 'palette should render asset metadata rows');
assert(timelineHtml.includes('data-storyboard-drop-target="timeline_lane"'), 'timeline lanes should expose palette drop targets');
assert(timelineHtml.includes('data-content-storyboard-insert="time:1929"'), 'surface should render time-slot insertion');
assert(timelineHtml.includes('data-content-storyboard-navigator="true"'), 'surface should render the merged timeline navigator panel');
assert(timelineHtml.includes('data-content-storyboard-story-context="true"'), 'sidebar should carry global story context (now that the canvas banner is retired)');
assert(timelineHtml.includes('data-content-storyboard-overview="true"'), 'surface should render a timeline overview/minimap strip');
assert(timelineHtml.includes('data-content-storyboard-scope="true"'), 'surface should render focused story scope controls');
assert(timelineHtml.includes('data-storyboard-card-face="event"'), 'surface should render player-facing card face markers');
assert(timelineHtml.includes('data-storyboard-card-state='), 'surface should render card state markers');
assert(timelineHtml.includes('data-content-storyboard-create-menu="true"'), 'surface should render create-here event/card/news affordances');
const collapsedPaletteHtml = storyboardSurface.render(existing, {
  projectIndex: index,
  view: 'timeline',
  selected: 'event:election_start',
  storyPaletteOpen: true,
  storyPaletteChromeCollapsed: true
});
assert(collapsedPaletteHtml.includes('data-storyboard-palette-chrome-collapsed="true"'), 'palette should mark compact chrome state');
assert(!collapsedPaletteHtml.includes('data-storyboard-palette-scope-filters="true"'), 'compact palette chrome should free vertical room by hiding filters');
assert(timelineHtml.includes('data-object-canvas-action="create_event"'), 'timeline create-here event button should create a blank event, not a follow-up');
assert(timelineHtml.includes('data-object-canvas-action="delete_current_object"'), 'Storyboard editor actions should expose a delete/discard object entry');
assert(timelineHtml.includes('data-content-storyboard-story-context="true"'), 'editor should render story context outside the canvas cards');
assert(timelineHtml.includes('data-runtime-lens-panel="true"'), 'editor should render the focused Runtime Lens panel');
assert(timelineHtml.includes('Runtime Lens'), 'Runtime Lens panel should be visible in the Storyboard editor');
assert(!timelineHtml.includes('data-object-canvas-graph-inspector'), 'content storyboard should not render the old graph inspector');
assert(!timelineHtml.includes('>Object</span><strong>'), 'content storyboard should not render the old Object workflow node');
assert(!timelineHtml.includes('>Plan</span><strong>'), 'content storyboard should not render Plan as a canvas node');

const conditionalIndex = JSON.parse(JSON.stringify(index));
const conditionalTitle = '[? if z_party_name != "CVP": <span style="color: #000000;">Center Party</span>?][? if z_party_name == "CVP": <span style="color: #000000;">**CVP**</span>?] Conference';
conditionalIndex.scenes.find((item) => item.id === 'election_start').title = conditionalTitle;
conditionalIndex.semantic.textCorpus.items.find((item) => item.id === 'election_start_title').text = conditionalTitle;
const conditionalExisting = canvasModel.buildExistingCanvas(conditionalIndex, 'events', 'election_start', {
  entry: {source: 'Design', action: 'edit_existing'}
});
const conditionalStoryboardHtml = storyboardSurface.render(conditionalExisting, {
  projectIndex: conditionalIndex,
  view: 'timeline',
  selected: 'event:election_start'
});
assert(conditionalStoryboardHtml.includes('data-content-storyboard-selected-title="true" title="[? if z_party_name != &quot;CVP&quot;'), 'Storyboard selected-title chip should retain raw conditional title evidence');
assert(conditionalStoryboardHtml.includes('>Center Party / CVP Conference</h3>'), 'Storyboard selected-title chip should display a compact conditional title');

const newEvent = canvasModel.buildNewEventCanvas(index, {
  kind: 'world_event',
  id: 'studio_followup_event',
  title: 'Studio follow-up event',
  heading: 'Studio follow-up event',
  when: {year: 1929, monthStart: 2, monthEnd: 2}
}, {
  entry: {source: 'Storyboard', action: 'create_followup'}
});
assert(newEvent.ok, 'new Storyboard event draft should build as a true event model');
const newEventHtml = storyboardSurface.render(newEvent, {
  projectIndex: index,
  view: 'timeline',
  selected: 'draft:event:studio_followup_event'
});
assert(newEventHtml.includes('data-content-storyboard-card="draft:event:studio_followup_event"'), 'new event drafts should render as true draft event cards');
assert(newEventHtml.includes('data-storyboard-draft-key="draft:event:studio_followup_event"'), 'new event drafts should expose a discard key matching the true draft card');

const blankEventBranch = referenceIndex.branchDraft('event', existing, {
  insertKey: 'time:1929',
  view: 'timeline',
  selectedKey: 'event:election_start'
});
assert(blankEventBranch.template === 'event', 'blank event insertion should still create an event draft');
assert(blankEventBranch.title !== 'Follow-up event', 'blank event insertion should not be labeled as a follow-up event');

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
assert(chainHtml.includes('data-content-storyboard-chain-relation="true"'), 'chain surface should render jump relationships as dedicated cards');
assert(chainHtml.includes('Target events'), 'chain surface should separate downstream target events from relationship evidence');
assert(chainHtml.includes('data-content-storyboard-chain-connectors="true"'), 'chain surface should render causal connector layer');
assert(chainHtml.includes('data-content-storyboard-depth-controls="true"'), 'chain surface should render depth controls');
assert(chainHtml.includes('data-storyboard-drop-target="chain_gap"'), 'chain surface should expose palette drop targets');
assert(chainHtml.includes('data-content-storyboard-plan="true"'), 'technical plan should live in the editor panel');

const complexChainHtml = storyboardSurface.render(complexExisting, {
  projectIndex: index,
  view: 'chain',
  selected: 'event:civil_war'
});
assert(complexChainHtml.includes('Single composite event'), 'chain editor should name the single composite event shape');
assert(complexChainHtml.includes('Internal flow'), 'chain editor should summarize internal flow counts');
assert(complexChainHtml.includes('data-content-storyboard-card="section:civil_war.war_menu"'), 'chain surface should render internal section cards');

process.stdout.write(JSON.stringify({
  ok: true,
  timelineCards: timeline.cards.length,
  canvasCategory: timeline.canvasCategory && timeline.canvasCategory.key,
  hiddenByCategory: timeline.metrics && timeline.metrics.hiddenByCategoryCount,
  timelineYears: timeline.timeline.lanes.map((lane) => lane.year),
  chainLevels: chain.chain.levels.map((level) => level.key)
}, null, 2) + '\n');

function textItem(id, text, role, sceneId, path, line, itemId, sectionId) {
  return {
    id,
    text,
    role,
    owner: {kind: 'scene', sceneId, itemId, sectionId: sectionId || ''},
    source: {path, line}
  };
}
