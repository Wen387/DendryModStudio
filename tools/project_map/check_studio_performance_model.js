#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {readExploreBundle} = require('./check_viewer_assets.js');

const viewer = require('./viewer/app.js');
const design = require('./viewer/design_model.js');
const projectStateSurface = require('./viewer/project_state_surface.js');

const DESIGN_UI = path.join(__dirname, 'viewer', 'design_ui.js');
const PROJECT_STATE_SURFACE = path.join(__dirname, 'viewer', 'project_state_surface.js');
const VARIABLE_EDITOR_UI = path.join(__dirname, 'viewer', 'variable_editor_ui.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function largeIndex() {
  const sceneCount = 180;
  const variableCount = 420;
  const textCount = 2400;
  const scenes = Array.from({length: sceneCount}, (_, index) => ({
    id: 'event_' + index,
    title: 'Synthetic event ' + index,
    type: 'event',
    path: 'source/scenes/events/event_' + index + '.scene.dry',
    sourceSpan: {path: 'source/scenes/events/event_' + index + '.scene.dry', line: 1},
    tags: ['event']
  }));
  const variables = Array.from({length: variableCount}, (_, index) => {
    const refs = Array.from({length: 12}, (_unused, refIndex) => ({
      path: scenes[(index + refIndex) % scenes.length].path,
      line: refIndex + 1
    }));
    return {
      name: 'variable_' + index,
      scope: 'q',
      reads: refs,
      writes: refs.slice(0, 4),
      readCount: refs.length,
      writeCount: 4,
      confidence: 'static_inferred'
    };
  });
  const textItems = Array.from({length: textCount}, (_, index) => ({
    id: 'text_' + index,
    text: 'Synthetic player-facing text row ' + index + (index % 7 === 0 ? ' needle' : ''),
    role: index % 3 === 0 ? 'body' : 'option_label',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: scenes[index % scenes.length].id},
    source: {path: scenes[index % scenes.length].path, line: index + 1},
    confidence: 'static_inferred'
  }));
  return {
    schemaVersion: '0.1',
    project: {name: 'large performance fixture', root: '/tmp/dms-large-fixture', profileIds: ['generic-dendry']},
    profiles: [{id: 'generic-dendry'}],
    scenes,
    edges: scenes.slice(1).map((scene, index) => ({
      from: scenes[index].id,
      to: scene.id,
      kind: 'go-to',
      confidence: 'static_inferred'
    })),
    variables,
    diagnostics: [],
    semantic: {
      events: scenes.map((scene) => ({id: scene.id, confidence: 'static_inferred'})),
      cards: [],
      hands: [],
      decks: [],
      pinnedCards: [],
      news: {items: [], eventPopups: []},
      surfaceText: {items: []},
      textCorpus: {items: textItems},
      assets: {items: []}
    },
    summary: {
      sceneCount: scenes.length,
      edgeCount: scenes.length - 1,
      variableCount: variables.length,
      eventCount: scenes.length,
      textCorpusCount: textItems.length,
      assetCount: 0,
      diagnosticCount: 0
    }
  };
}

const index = largeIndex();
const model = viewer.buildViewModel(index);

assert(model.normalizedRowsByView instanceof Map, 'viewer model should expose a normalized row cache');
assert(model.textCorpusContextIndex && model.textCorpusContextIndex.bySceneId instanceof Map, 'viewer model should pre-index Text Corpus context by owner scene');
const firstTextContext = viewer.textCorpusContextRows(model, index.semantic.textCorpus.items[0]);
assert(firstTextContext.length > 0 && firstTextContext.length <= 7, 'Text Corpus inspector context should use a bounded cached window');
const firstNeedle = viewer.filterAndSortItems(model, 'textCorpus', 'needle', 'primary', 'asc');
assert(firstNeedle.length > 0, 'cached textCorpus search should still find matching rows');
assert(
  Array.from(model.normalizedRowsByView.keys()).some((key) => String(key).includes('textCorpus')),
  'filterAndSortItems should populate a per-view normalized row cache'
);
const firstCapability = viewer.editCapabilityForModel(model, 'textCorpus', index.semantic.textCorpus.items[0]);
assert(firstCapability && firstCapability.routeClass, 'Text Corpus inspector should still compute an edit route for a selected row');
assert(model.editCapabilityContext && model.editCapabilityContext.lookup, 'Explore edit capability checks should reuse one lookup per ProjectIndex');
assert(model.editCapabilityContext.existingModelCache instanceof Map, 'Explore edit capability checks should reuse existing-scene model cache');
assert(
  model.editCapabilityContext.existingModelCache.size <= index.scenes.length,
  'Text Corpus inspector route checks should not rebuild existing-scene models per text row'
);
const cachedRows = Array.from(model.normalizedRowsByView.values()).find((value) => Array.isArray(value) && value.length === index.semantic.textCorpus.items.length);
assert(cachedRows && cachedRows.every((row) => typeof row.searchTextLower === 'string'), 'cached rows should store lowercased search text');
const secondNeedle = viewer.filterAndSortItems(model, 'textCorpus', 'needle', 'primary', 'asc');
assert(secondNeedle.length === firstNeedle.length, 'cached textCorpus search should be stable across repeated calls');
assert(model.sortedRowsByView instanceof Map, 'viewer model should expose a sorted row cache');
assert(
  Array.from(model.sortedRowsByView.keys()).some((key) => String(key).includes('textCorpus') && String(key).includes('primary')),
  'filterAndSortItems should populate a per-view sorted row cache'
);
assert(typeof viewer.virtualWindowForList === 'function', 'viewer should expose virtualWindowForList for large Explore lists');
const virtualWindow = viewer.virtualWindowForList(2400, 1160, 580);
assert(virtualWindow.start > 0, 'virtual window should advance as the list scrolls');
assert(virtualWindow.end < 2400, 'virtual window should not render every row in a large list');
assert(virtualWindow.topSpacer > 0, 'virtual window should preserve scroll offset with a top spacer');
assert(virtualWindow.bottomSpacer > 0, 'virtual window should preserve total scroll height with a bottom spacer');

assert(model.variableAccessesByPath instanceof Map, 'viewer model should pre-index variable accesses by source path');
const targetPath = index.scenes[0].path;
assert((model.variableAccessesByPath.get(targetPath) || []).length > 0, 'variable access index should include source-backed variable refs');

const started = Date.now();
const designModel = design.buildDesignModel(model, null);
const elapsed = Date.now() - started;
assert(designModel.summary.itemCount === index.scenes.length, 'Design model should preserve synthetic event count');
assert(elapsed < 750, 'Design model should build from indexed variable refs without quadratic path scans; elapsed=' + elapsed + 'ms');

const largeVariableIndex = largeIndex();
largeVariableIndex.variables = Array.from({length: 3000}, (_, variableIndex) => ({
  name: 'global_variable_' + variableIndex,
  scope: 'q',
  reads: [{path: 'source/scenes/state_' + (variableIndex % 10) + '.scene.dry', line: variableIndex + 1}],
  writes: variableIndex % 3 === 0 ? [{path: 'source/scenes/root.scene.dry', line: variableIndex + 1}] : [],
  readCount: 1,
  writeCount: variableIndex % 3 === 0 ? 1 : 0
}));
const projectStateHtml = projectStateSurface.render({
  ok: true,
  title: 'Global Variables',
  contextBoard: {variables: []},
  changeState: {draft: {variableName: 'global_variable_2999'}},
  eventBody: {}
}, {
  projectIndex: largeVariableIndex,
  selected: 'variable:global_variable_2999',
  limit: 120
});
const projectStateRows = projectStateHtml.match(/data-project-state-variable-row=/g) || [];
assert(projectStateRows.length <= 120, 'Project State should not render every global variable at once; rows=' + projectStateRows.length);
assert(projectStateHtml.includes('data-project-state-variable-search'), 'Project State should expose search instead of requiring full-row render');
assert(projectStateHtml.includes('project_state_show_more'), 'Project State should expose incremental loading for large variable sets');

const appUi = readExploreBundle(path.join(__dirname, 'viewer'));
const designUi = fs.readFileSync(DESIGN_UI, 'utf8');
const projectStateUi = fs.readFileSync(PROJECT_STATE_SURFACE, 'utf8');
const variableEditorUi = fs.readFileSync(VARIABLE_EDITOR_UI, 'utf8');
assert(appUi.includes('SORT_COLLATOR'), 'Explore sorting should reuse one collator instead of rebuilding localeCompare options per comparison');
assert(appUi.includes('EXPLORE_SEARCH_DEBOUNCE_MS'), 'Explore search should use a named debounce interval');
assert(appUi.includes('scheduleSearchRender'), 'Explore search input should debounce full renders');
assert(appUi.includes('state.currentItems'), 'Explore row clicks should reuse the last rendered item list');
assert(appUi.includes('editCapabilityContextForModel'), 'Explore edit capability routing should reuse ProjectIndex-level lookup/cache state');
assert(appUi.includes('textCorpusContextIndex'), 'Text Corpus inspector context should be indexed, not re-sorted on every selection');
assert(appUi.includes('VIRTUAL_LIST_THRESHOLD'), 'Explore large lists should use a named virtualization threshold');
assert(appUi.includes('renderVirtualTextCorpusList'), 'Text Corpus should render a virtualized list when row count is large');
assert(appUi.includes('renderVirtualAssetGallery'), 'Assets should render a virtualized gallery when asset count is large');
assert(appUi.includes('renderVirtualNewsList'), 'News should render a virtualized list when news count is large');
assert(designUi.includes('inspectorCache'), 'Design inspector should cache selected-item render output');
assert(designUi.includes('inspectorCacheKey'), 'Design inspector should build explicit cache keys');
assert(designUi.includes('renderInspectorContent'), 'Design inspector heavy HTML construction should be isolated behind cache lookup');
assert(projectStateUi.includes('rowCache'), 'Project State variable rows should be cached per ProjectIndex object');
assert(variableEditorUi.includes('VARIABLE_OPTION_LIMIT'), 'Variable Editor should cap datalist options for large global variable sets');
const inspectorContentMatch = designUi.match(/function renderInspectorContent[\s\S]*?\n  function renderEventWorkbenchForSelected/);
assert(inspectorContentMatch, 'Design inspector content renderer should have a stable function boundary');
assert(!inspectorContentMatch[0].includes('elements.inspector.innerHTML ='), 'Design inspector content renderer should return HTML, not assign undefined through the cache path');
assert(inspectorContentMatch[0].includes('return ['), 'Design inspector content renderer should return the generated HTML array');

process.stdout.write(JSON.stringify({
  ok: true,
  cachedRows: cachedRows.length,
  designMs: elapsed
}, null, 2) + '\n');
