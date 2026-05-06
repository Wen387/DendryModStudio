#!/usr/bin/env node
'use strict';

global.ProjectMapI18n = {t: (_key, fallback) => fallback};

const runtimeLensUi = require('./viewer/runtime_lens_ui.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const projectIndex = {
  scenes: [
    {
      id: 'election_start',
      title: 'Election Begins',
      type: 'event',
      path: 'source/scenes/events/election_start.scene.dry',
      sourceSpan: {path: 'source/scenes/events/election_start.scene.dry', startLine: 1}
    }
  ]
};
const model = {
  objectId: 'election_start',
  objectKind: 'event',
  title: 'Election Begins',
  source: {path: 'source/scenes/events/election_start.scene.dry', line: 1}
};

const focus = runtimeLensUi.focusFromCanvas(projectIndex, model, 'event:election_start');
assert(focus.kind === 'event', 'Storyboard Runtime Lens focus should resolve event kind');
assert(focus.id === 'election_start', 'Storyboard Runtime Lens focus should resolve selected id');
assert(focus.title === 'Election Begins', 'Storyboard Runtime Lens focus should resolve selected title');
assert(focus.source.path === 'source/scenes/events/election_start.scene.dry', 'Storyboard Runtime Lens focus should keep source reference');

const browserHtml = runtimeLensUi.renderPanel({focus, status: 'idle'});
assert(browserHtml.includes('data-runtime-lens-panel="true"'), 'Runtime Lens panel should expose a stable marker');
assert(browserHtml.includes('Desktop app required'), 'Runtime Lens panel should explain browser unavailability');
assert(browserHtml.includes('disabled'), 'Runtime Lens create button should be disabled without desktop bridge');

global.dendryDesktop = {createRuntimeLens() {}};
const readyHtml = runtimeLensUi.renderPanel({
  focus,
  status: 'ready',
  sessionFocusKey: 'event:election_start',
  session: {
    ok: true,
    status: 'ready',
    lensUrl: 'http://127.0.0.1:4000/session/lens/',
    externalUrl: 'http://127.0.0.1:4000/session/lens/'
  }
});
assert(readyHtml.includes('data-runtime-lens-frame="true"'), 'Ready Runtime Lens panel should render an iframe');
assert(readyHtml.includes('http://127.0.0.1:4000/session/lens/'), 'Runtime Lens iframe should point at the focused wrapper URL');
assert(readyHtml.includes('Refresh'), 'Ready Runtime Lens panel should offer refresh');
assert(readyHtml.includes('Open'), 'Ready Runtime Lens panel should offer external open');

const staleHtml = runtimeLensUi.renderPanel({
  focus,
  status: 'ready',
  sessionFocusKey: 'event:other_scene',
  session: {ok: true, status: 'ready', lensUrl: 'http://127.0.0.1:4000/session/lens/'}
});
assert(staleHtml.includes('data-runtime-lens-status="stale"'), 'Runtime Lens panel should mark stale focus');
assert(staleHtml.includes('previous selection'), 'Runtime Lens stale panel should explain the mismatch');

const systemProjectIndex = {
  scenes: [
    {
      id: 'root',
      title: 'Dynamic Social Democracy',
      type: 'root',
      path: 'source/scenes/root.scene.dry',
      sourceSpan: {path: 'source/scenes/root.scene.dry', startLine: 1}
    },
    {
      id: 'main',
      title: 'Workspace Hand',
      type: 'hand',
      path: 'source/scenes/main.scene.dry',
      sourceSpan: {path: 'source/scenes/main.scene.dry', startLine: 1}
    }
  ],
  semantic: {hands: [{id: 'main', title: 'Workspace Hand'}]}
};
const systemModel = {
  template: 'project',
  eventBody: {
    title: {id: 'project.gameTitle', label: 'Game title', value: 'Runtime Lens Game Title', source: {path: 'source/scenes/root.scene.dry', line: 1}},
    heading: {id: 'project.author', label: 'Author', value: 'Studio Tester', source: {path: 'source/scenes/root.scene.dry', line: 2}}
  }
};
const systemFocus = runtimeLensUi.focusFromSystemRegion(systemProjectIndex, systemModel, 'ui:screen_header', {fixture: 'status_heavy'});
assert(systemFocus.kind === 'system_region', 'System UI Runtime Lens focus should resolve system_region kind');
assert(systemFocus.regionId === 'screen_header', 'System UI Runtime Lens focus should resolve selected region id');
assert(systemFocus.targetSceneId === 'root', 'System UI Runtime Lens focus should target the runtime scene behind the selected region');
assert(systemFocus.source.path === 'source/scenes/root.scene.dry', 'System UI Runtime Lens focus should preserve source evidence');
assert(systemFocus.key === 'system_region:screen_header:status_heavy', 'System UI Runtime Lens focus key should include fixture context');

process.stdout.write(JSON.stringify({
  ok: true,
  focus: focus.key,
  systemFocus: systemFocus.key,
  markers: ['data-runtime-lens-panel', 'data-runtime-lens-frame', 'stale', 'system_region']
}, null, 2) + '\n');
