#!/usr/bin/env node
'use strict';

const vm = require('vm');
const bridge = require('./desktop/runtime_preview_debug_bridge.js');

const {fail, assert} = require('./check_harness.js');

const script = bridge.bridgeScript({
  sessionId: 'debug-session',
  allowedOrigin: 'http://127.0.0.1:49000',
  controls: {
    variables: [
      {name: 'year', valueType: 'number'},
      {name: 'labor_law_seen', valueType: 'booleanNumber'}
    ],
    scenes: [{id: 'labor_law_crisis', title: 'Labor Law Crisis'}]
  },
  runtimeSurface: {
    regions: [
      {id: 'content', role: 'content', selector: '#content', label: 'Story content'},
      {id: 'choices', role: 'choices', selector: 'ul.choices', label: 'Choices'},
      {id: 'left_sidebar', role: 'left_sidebar', selector: '#stats_sidebar', label: 'Left sidebar'}
    ],
    cssVariables: [{name: '--accent'}]
  }
});

assert(script.includes('window.DendryModStudioPreview'), 'bridge should expose DendryModStudioPreview');
assert(script.includes('applyVariables'), 'bridge should support applyVariables');
assert(script.includes('jumpToScene'), 'bridge should support jumpToScene');
assert(script.includes('resetToInitialState'), 'bridge should support resetToInitialState');
assert(script.includes('getStateSummary'), 'bridge should support getStateSummary');
assert(script.includes('getRuntimeSnapshot'), 'bridge should support getRuntimeSnapshot');
assert(script.includes('RUNTIME_SURFACE'), 'bridge should carry Runtime Surface evidence');
assert(script.includes('querySelectorAll'), 'bridge should inspect DOM selectors for snapshots');
assert(script.includes('event.origin'), 'bridge should check event origin');
assert(script.includes('dms-runtime-preview-command'), 'bridge should listen for structured command messages');
assert(!/\beval\s*\(/.test(script), 'bridge must not use eval');
assert(!/\bnew Function\b/.test(script), 'bridge must not use new Function');
assert(!script.includes('innerHTML = event.data'), 'bridge must not write raw message data as HTML');

const panel = bridge.debugPanelHtml({
  controls: {
    variables: [
      {name: 'year', valueType: 'number', reason: 'time gate'},
      {name: 'labor_law_seen', valueType: 'booleanNumber', reason: 'event flag'}
    ],
    scenes: [
      {id: 'labor_law_crisis', title: 'Labor Law Crisis', sourcePath: 'source/scenes/events/labor_law.scene.dry'}
    ].concat(Array.from({length: 40}, (_unused, offset) => ({
      id: 'news_scene_' + offset,
      title: 'News Scene ' + offset,
      type: 'news',
      sourcePath: 'source/scenes/news/news_' + offset + '.scene.dry'
    }))),
    links: [{from: 'union_pressure_rises', to: 'labor_law_crisis'}]
  }
});
assert(panel.includes('runtime-debug-console'), 'debug panel should have a stable container class');
assert(panel.includes('runtime-debug-variable-data'), 'debug panel should embed variable data as JSON');
assert(panel.includes('"name":"year"'), 'debug panel JSON should include variable name year');
assert(panel.includes('"name":"labor_law_seen"'), 'debug panel JSON should include variable name labor_law_seen');
assert(panel.includes('runtime-debug-variable-filter'), 'debug panel should provide variable search input');
assert(panel.includes('runtime-debug-variable-groups'), 'debug panel should have variable groups container');
assert(panel.includes('runtime-debug-pinned'), 'debug panel should have pinned variables section');
assert(panel.includes('data-debug-scene="labor_law_crisis"'), 'debug panel should render scene controls');
assert(panel.includes('data-runtime-debug-scene-filter'), 'debug panel should offer scene filtering for larger projects');
assert(panel.includes('data-debug-scene="news_scene_39"'), 'debug panel should render well beyond the previous 32-scene cap');
assert(panel.includes('data-debug-scene-search='), 'debug panel should expose safe client-side search text');
assert(panel.includes('This only changes the temporary modified preview'), 'debug panel should explain preview-only scope');
assert(panel.includes('runtime-debug-nav'), 'debug panel should include a sticky section navigation strip');
assert(panel.includes('data-debug-nav="jump"'), 'debug panel nav should include a jump section link');
assert(panel.includes('data-debug-nav="conditions"'), 'debug panel nav should include a variables section link');
assert(panel.includes('data-debug-section="jump"'), 'debug panel should wrap jump in a collapsible details section');
assert(panel.includes('data-debug-section="history"'), 'debug panel should wrap history in a collapsible details section');
assert(panel.includes('<details'), 'debug panel sections should use details/summary for collapsibility');

assert(typeof bridge.comparePageLabels === 'function', 'bridge should export comparePageLabels');
const enLabels = bridge.comparePageLabels('en');
assert(enLabels.consoleTitle === 'Preview Debug Console', 'English labels should include consoleTitle');
const zhLabels = bridge.comparePageLabels('zh-Hant');
assert(zhLabels.consoleTitle === '預覽除錯控制台', 'zh-Hant labels should localize consoleTitle');
assert(zhLabels.sectionConditions === '測試條件', 'zh-Hant labels should localize sectionConditions');

const zhPanel = bridge.debugPanelHtml({
  controls: {variables: [{name: 'year', valueType: 'number'}], scenes: []},
  labels: zhLabels
});
assert(zhPanel.includes('預覽除錯控制台'), 'debug panel with zh-Hant labels should use localized title');
assert(zhPanel.includes('測試條件'), 'debug panel with zh-Hant labels should use localized section name');
assert(zhPanel.includes('搜尋變數'), 'debug panel with zh-Hant labels should use localized placeholder');

const zhParentScript = bridge.parentDebugScript({sessionId: 'debug-session', labels: zhLabels});
assert(zhParentScript.includes('沒有已變更的變數值可套用'), 'zh-Hant parent script should embed localized noChangedVars label');

const parentScript = bridge.parentDebugScript({sessionId: 'debug-session'});
assert(parentScript.includes('postMessage'), 'parent script should send iframe commands');
assert(parentScript.includes('dms-runtime-preview-result'), 'parent script should receive structured result messages');
assert(parentScript.includes('/api/debug-command-history'), 'parent script should write command history to the preview server');
assert(parentScript.includes('data-debug-dirty'), 'parent script should apply only variable inputs the player changed');
assert(parentScript.includes('data-runtime-debug-scene-filter'), 'parent script should filter scene jump controls');
assert(parentScript.includes('renderGroups'), 'parent script should render variable groups client-side');
assert(parentScript.includes('renderPinned'), 'parent script should render pinned variables client-side');
assert(parentScript.includes('filterVars'), 'parent script should support variable search filtering');
assert(parentScript.includes('togglePin'), 'parent script should support pin/unpin interaction');
assert(parentScript.includes('runtime-debug-toggle'), 'parent script should render boolean toggle inputs');
assert(parentScript.includes('runtime-debug-group'), 'parent script should render group accordions');
assert(parentScript.includes('data-debug-pin'), 'parent script should render pin buttons');
assert(parentScript.includes('GROUP_ORDER'), 'parent script should group variables by meaning in defined order');
assert(parentScript.includes('No changed variable values'), 'parent script should explain when Apply has no changed values');
assert(parentScript.includes('data-debug-nav'), 'parent script should handle section nav clicks');
assert(parentScript.includes('scrollIntoView'), 'parent script should scroll to sections on nav click');
assert(!/\beval\s*\(/.test(parentScript), 'parent script must not use eval');
assert(!/\bnew Function\b/.test(parentScript), 'parent script must not use new Function');

const manyVariables = Array.from({length: 40}, (_unused, offset) => ({
  name: 'var_' + offset,
  valueType: offset < 10 ? 'booleanNumber' : 'number',
  label: 'Variable ' + offset,
  reason: 'test',
  meaning: offset < 10 ? 'event flag' : 'game state'
}));
const largePanel = bridge.debugPanelHtml({
  controls: {variables: manyVariables, scenes: []}
});
const panelData = JSON.parse(
  largePanel.match(/<script[^>]*id="runtime-debug-variable-data"[^>]*>([\s\S]*?)<\/script>/)[1]
);
assert(panelData.length === 40, 'JSON data block should contain all 40 variables without truncation');
assert(panelData[0].name === 'var_0', 'JSON data should preserve variable order');

function runBridgeWithFakeEngine(fakeEngine, fakeDocument) {
  const listeners = {};
  const fakeWindow = {
    document: fakeDocument || null,
    location: {href: 'http://127.0.0.1/runtime/'},
    d3: fakeDocument ? {} : null,
    getComputedStyle: (el) => ({
      display: el && el.hidden ? 'none' : 'block',
      visibility: 'visible',
      opacity: '1',
      position: 'static',
      overflow: 'visible',
      zIndex: 'auto',
      getPropertyValue: (name) => name === '--accent' ? '#aa3333' : ''
    }),
    dendryUI: {dendryEngine: fakeEngine},
    updateSidebar: () => {
      fakeEngine.sidebarUpdates = (fakeEngine.sidebarUpdates || 0) + 1;
    },
    addEventListener: (name, handler) => {
      listeners[name] = handler;
    }
  };
  vm.runInNewContext(script, {
    window: fakeWindow,
    JSON,
    Date,
    Math,
    Object,
    Number,
    String,
    Array,
    Error
  });
  return fakeWindow.DendryModStudioPreview;
}

const variableEngine = {
  state: {
    sceneId: 'root',
    currentSceneId: 'root',
    qualities: {year: 1930, labor_law_seen: 0},
    currentContent: [],
    sprites: {},
    bg: null
  },
  displaySceneContentCalls: 0,
  setState(state) {
    this.state = state;
    return this;
  },
  getExportableState() {
    return this.state;
  },
  getCurrentScene() {
    return {id: this.state.sceneId, options: []};
  },
  _compileChoices() {
    return [];
  },
  displaySceneContent() {
    this.displaySceneContentCalls += 1;
  },
  displayChoices() {
    this.displayChoicesCalls = (this.displayChoicesCalls || 0) + 1;
  },
  ui: {
    newPage() {},
    removeChoices() {},
    setSprites() {},
    setBg() {}
  }
};
const variablePreview = runBridgeWithFakeEngine(variableEngine);
const variableResult = variablePreview.applyVariables([{name: 'year', value: '1932'}]);
assert(variableResult.ok, 'applyVariables should accept allowlisted numeric variables');
assert(variableEngine.state.qualities.year === 1932, 'applyVariables should update the runtime state quality');
assert(variableEngine.displaySceneContentCalls > 0, 'applyVariables should redraw the current scene so changed variables are visible');
assert(variableEngine.sidebarUpdates > 0, 'applyVariables should refresh SDAAH-style sidebars after state changes');

const jumpEngine = {
  jumpedTo: '',
  state: {sceneId: 'root', qualities: {}, currentContent: []},
  getExportableState() {
    return this.state;
  },
  goToScene(sceneId) {
    this.jumpedTo = sceneId;
    this.state.sceneId = sceneId;
    this.displayedContent = true;
    return this;
  }
};
const jumpPreview = runBridgeWithFakeEngine(jumpEngine);
const jumpResult = jumpPreview.jumpToScene({sceneId: 'labor_law_crisis'});
assert(jumpResult.ok, 'jumpToScene should accept allowlisted scenes');
assert(jumpEngine.jumpedTo === 'labor_law_crisis', 'jumpToScene should use DendryEngine.goToScene so scene content and title render');

function fakeElement(text, box, options) {
  const opts = options || {};
  return {
    tagName: opts.tagName || 'DIV',
    nodeName: opts.tagName || 'DIV',
    id: opts.id || '',
    className: opts.className || '',
    dataset: opts.dataset || {},
    textContent: text || '',
    children: Array.from({length: opts.childCount || 0}, () => ({})),
    offsetWidth: box && box.width || 0,
    offsetHeight: box && box.height || 0,
    width: opts.width || box && box.width || 0,
    height: opts.height || box && box.height || 0,
    hidden: opts.hidden === true,
    getBoundingClientRect() {
      return {
        x: box && box.x || 0,
        y: box && box.y || 0,
        left: box && box.x || 0,
        top: box && box.y || 0,
        width: box && box.width || 0,
        height: box && box.height || 0
      };
    },
    getAttribute(name) {
      return opts.attrs && opts.attrs[name] || '';
    },
    getContext() {
      return opts.canvasData ? {
        getImageData() {
          return {data: opts.canvasData};
        }
      } : null;
    }
  };
}

const snapshotDocument = {
  readyState: 'complete',
  title: 'Snapshot Fixture',
  body: fakeElement('', {width: 800, height: 600}),
  documentElement: fakeElement('', {width: 800, height: 600}),
  images: [
    {src: 'img/loaded.png', currentSrc: 'img/loaded.png', complete: true, naturalWidth: 120},
    {src: 'img/broken.png', currentSrc: 'img/broken.png', complete: true, naturalWidth: 0}
  ],
  querySelectorAll(selector) {
    const rows = {
      '#content': [fakeElement('Story content is visible.', {x: 10, y: 20, width: 500, height: 140})],
      'ul.choices': [fakeElement('Choice A Choice B', {x: 20, y: 180, width: 420, height: 80}, {tagName: 'UL', id: 'choices', dataset: {dmsSceneId: 'labor_law_crisis', dmsSourcePath: 'source/scenes/events/labor_law.scene.dry', dmsSourceLine: '22', unrelated: 'ignored'}})],
      '#stats_sidebar': [fakeElement('Emergency Status', {x: 0, y: 20, width: 180, height: 400})],
      '#stats_sidebar_right': [],
      '#options': [fakeElement('Options', {x: 200, y: 100, width: 260, height: 220}, {hidden: true})],
      '#save': [],
      '.background': [fakeElement('', {x: 0, y: 0, width: 800, height: 600})],
      '.hand': [],
      '.pinned-cards': [],
      '.deck': [],
      '.face-img': [],
      'svg': [fakeElement('chart', {x: 40, y: 260, width: 220, height: 120}, {childCount: 2})],
      'canvas': [fakeElement('', {x: 40, y: 400, width: 160, height: 100}, {width: 16, height: 16, canvasData: [0, 0, 0, 255]})],
      'audio': [{src: 'music/theme.ogg', readyState: 4}]
    };
    return rows[selector] || [];
  }
};

const snapshotEngine = {
  state: {sceneId: 'labor_law_crisis', qualities: {year: 1930, labor_law_seen: 1}},
  getExportableState() {
    return this.state;
  }
};
const snapshotPreview = runBridgeWithFakeEngine(snapshotEngine, snapshotDocument);
const snapshotResult = snapshotPreview.getRuntimeSnapshot();
assert(snapshotResult.ok, 'getRuntimeSnapshot should return a structured result: ' + JSON.stringify(snapshotResult));
assert(snapshotResult.runtimeSnapshot.document.bodyPresent === true, 'snapshot should report document body presence');
assert(snapshotResult.runtimeSnapshot.state.sceneId === 'labor_law_crisis', 'snapshot should include current scene id');
assert(snapshotResult.runtimeSnapshot.regions.some((item) => item.selector === '#content' && item.visible), 'snapshot should inspect indexed content region');
assert(snapshotResult.runtimeSnapshot.regions.some((item) => item.selector === 'ul.choices' && item.elementCount === 1), 'snapshot should inspect choices region');
const choicesRegion = snapshotResult.runtimeSnapshot.regions.find((item) => item.selector === 'ul.choices');
assert(choicesRegion.samples.length === 1, 'snapshot should include clipped element samples for a region');
assert(choicesRegion.samples[0].selector === '#choices', 'snapshot sample should prefer stable element ids');
assert(choicesRegion.samples[0].tag === 'ul', 'snapshot sample should include tag names');
assert(choicesRegion.samples[0].dataset.dmsSceneId === 'labor_law_crisis', 'snapshot sample should include safe dms dataset fields');
assert(!choicesRegion.samples[0].dataset.unrelated, 'snapshot sample should not include arbitrary dataset fields');
assert(snapshotResult.runtimeSnapshot.assets.images.total === 2, 'snapshot should summarize images');
assert(snapshotResult.runtimeSnapshot.assets.images.error === 1, 'snapshot should flag broken images');
assert(snapshotResult.runtimeSnapshot.graphics.d3Present === true, 'snapshot should detect D3 presence');
assert(snapshotResult.runtimeSnapshot.graphics.svgNonEmptyCount === 1, 'snapshot should detect non-empty SVG surfaces');
assert(snapshotResult.runtimeSnapshot.graphics.canvasNonEmptyCount === 1, 'snapshot should detect non-empty canvas surfaces');
assert(snapshotResult.runtimeSnapshot.css.variables.some((item) => item.name === '--accent' && item.value), 'snapshot should collect indexed CSS variables');

process.stdout.write(JSON.stringify({ok: true, bridgeBytes: script.length, panelBytes: panel.length}, null, 2) + '\n');
