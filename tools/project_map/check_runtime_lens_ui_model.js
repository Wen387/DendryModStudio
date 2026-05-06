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

process.stdout.write(JSON.stringify({
  ok: true,
  focus: focus.key,
  markers: ['data-runtime-lens-panel', 'data-runtime-lens-frame', 'stale']
}, null, 2) + '\n');
