#!/usr/bin/env node
'use strict';

// Home "recent projects" — pure list model + wiring contract.
// The feature records desktop project loads (preload's desktop-index-loaded
// event carries the folder root) and reopens them via the standard
// dendryDesktop.scanProject pipeline. These checks pin the list semantics
// (dedupe / newest-first / cap), the storage-key centralization, and the
// shell/registry/i18n/CSS wiring, all without a DOM.

const fs = require('fs');
const path = require('path');
const {readViewerI18n} = require('./check_viewer_assets.js');
const {assert} = require('./check_harness.js');

const contracts = require('./authoring/studio_shared_constants.js');
const recent = require('./viewer/home_recent_projects.js');

const ROOT = __dirname;
const html = fs.readFileSync(path.join(ROOT, 'viewer', 'index.html'), 'utf8');
const registrySource = fs.readFileSync(path.join(ROOT, 'viewer', 'home_section_registry.js'), 'utf8');
const moduleSource = fs.readFileSync(path.join(ROOT, 'viewer', 'home_recent_projects.js'), 'utf8');
const preloadSource = fs.readFileSync(path.join(ROOT, 'desktop', 'preload.js'), 'utf8');
const homeCss = fs.readFileSync(path.join(ROOT, 'viewer', 'styles', 'home.css'), 'utf8');
const i18nUi = readViewerI18n(path.join(ROOT, 'viewer'));

// --- Centralized storage key -----------------------------------------------
assert(contracts.STORAGE_KEYS.recentProjects === 'dendry-mod-studio-recent-projects',
  'recent projects storage key should be centralized');

// --- Module API --------------------------------------------------------------
['render', 'record', 'remove', 'list'].forEach((method) => {
  assert(typeof recent[method] === 'function', 'recent projects API should expose ' + method + '()');
});
assert(recent._model && typeof recent._model.upsert === 'function' &&
  typeof recent._model.removeFromList === 'function',
  'recent projects should expose its pure list model for testing');

// --- Pure list semantics -----------------------------------------------------
const {upsert, removeFromList, LIMIT} = recent._model;

let list = upsert([], {root: '/a', name: 'A', openedAt: 1});
list = upsert(list, {root: '/b', name: 'B', openedAt: 2});
assert(list.length === 2 && list[0].root === '/b' && list[1].root === '/a',
  'upsert should insert newest first');

list = upsert(list, {root: '/a', name: 'A2', openedAt: 3});
assert(list.length === 2 && list[0].root === '/a' && list[0].name === 'A2',
  'reopening a known root should refresh it to the front, not duplicate it');

let capped = [];
for (let i = 0; i < LIMIT + 3; i += 1) {
  capped = upsert(capped, {root: '/p' + i, name: 'P' + i, openedAt: i});
}
assert(capped.length === LIMIT, 'the list should cap at ' + LIMIT + ' entries');
assert(capped[0].root === '/p' + (LIMIT + 2), 'the cap should keep the newest entries');

assert(upsert(list, {name: 'no root'}).length === list.length,
  'an entry without a root should never be recorded');
assert(upsert(list, {root: '/c'})[0].name === 'c',
  'a missing name should fall back to the folder basename');

assert(removeFromList(list, '/a').every((item) => item.root !== '/a'),
  'removeFromList should drop the matching root');
assert(removeFromList(list, '/nope').length === list.length,
  'removing an unknown root should be a no-op');

// --- Fail-closed without a DOM ----------------------------------------------
assert(Array.isArray(recent.list()), 'list() should return an array without a DOM/storage');
recent.record({root: '/x', projectName: 'X'});
recent.render(null);
assert(true, 'record() and render(null) should not throw without a DOM');

// --- Wiring -------------------------------------------------------------------
assert(html.includes('home_recent_projects.js'), 'viewer should load the recent projects module');
assert(moduleSource.includes('ProjectMap:desktop-index-loaded'),
  'the module should record from the desktop index-loaded event');
assert(moduleSource.includes('scanProject'),
  'reopen should ride the standard scanProject pipeline');
assert(preloadSource.includes('root: result.root'),
  'preload should keep carrying the project root on the index-loaded detail');
assert(registrySource.includes('home-recent-slot') && registrySource.includes('renderRecentSlot'),
  'the Home overview should host a recent-projects slot on both faces');
assert(registrySource.includes('ProjectMapHomeRecentProjects'),
  'the registry should hand the slot to the recent projects module');

// --- i18n + CSS ----------------------------------------------------------------
['home.recent.title', 'home.recent.remove', 'home.recent.openFailed'].forEach((key) => {
  assert(i18nUi.includes("'" + key + "'"), 'recent projects should localize ' + key);
});
['.home-recent-slot:empty', '.home-recent-card', '.home-recent-open', '.home-recent-remove',
  '.home-recent-path', '.home-recent-card.is-failed'].forEach((selector) => {
  assert(homeCss.includes(selector), 'home.css should style ' + selector);
});

process.stdout.write(JSON.stringify({
  ok: true,
  limit: LIMIT
}, null, 2) + '\n');
