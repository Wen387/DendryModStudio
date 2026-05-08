#!/usr/bin/env node
'use strict';

const vm = require('vm');
const bridge = require('./desktop/runtime_preview_debug_bridge.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const script = bridge.bridgeScript({
  sessionId: 'debug-session',
  allowedOrigin: 'http://127.0.0.1:49000',
  controls: {
    variables: [
      {name: 'year', valueType: 'number'},
      {name: 'labor_law_seen', valueType: 'booleanNumber'}
    ],
    scenes: [{id: 'labor_law_crisis', title: 'Labor Law Crisis'}]
  }
});

assert(script.includes('window.DendryModStudioPreview'), 'bridge should expose DendryModStudioPreview');
assert(script.includes('applyVariables'), 'bridge should support applyVariables');
assert(script.includes('jumpToScene'), 'bridge should support jumpToScene');
assert(script.includes('resetToInitialState'), 'bridge should support resetToInitialState');
assert(script.includes('getStateSummary'), 'bridge should support getStateSummary');
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
assert(panel.includes('data-debug-variable="year"'), 'debug panel should render variable controls');
assert(panel.includes('data-debug-scene="labor_law_crisis"'), 'debug panel should render scene controls');
assert(panel.includes('data-runtime-debug-scene-filter'), 'debug panel should offer scene filtering for larger projects');
assert(panel.includes('data-debug-scene="news_scene_39"'), 'debug panel should render well beyond the previous 32-scene cap');
assert(panel.includes('data-debug-scene-search='), 'debug panel should expose safe client-side search text');
assert(panel.includes('This only changes the temporary modified preview'), 'debug panel should explain preview-only scope');

const parentScript = bridge.parentDebugScript({sessionId: 'debug-session'});
assert(parentScript.includes('postMessage'), 'parent script should send iframe commands');
assert(parentScript.includes('dms-runtime-preview-result'), 'parent script should receive structured result messages');
assert(parentScript.includes('/api/debug-command-history'), 'parent script should write command history to the preview server');
assert(parentScript.includes('data-debug-dirty'), 'parent script should apply only variable inputs the player changed');
assert(parentScript.includes('data-runtime-debug-scene-filter'), 'parent script should filter scene jump controls');
assert(parentScript.includes('No changed variable values'), 'parent script should explain when Apply has no changed values');
assert(!/\beval\s*\(/.test(parentScript), 'parent script must not use eval');
assert(!/\bnew Function\b/.test(parentScript), 'parent script must not use new Function');

function runBridgeWithFakeEngine(fakeEngine) {
  const listeners = {};
  const fakeWindow = {
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

process.stdout.write(JSON.stringify({ok: true, bridgeBytes: script.length, panelBytes: panel.length}, null, 2) + '\n');
