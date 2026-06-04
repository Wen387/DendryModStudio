#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {assert} = require('./check_harness.js');

const history = require('./viewer/navigation_history.js');

const ROOT = __dirname;
const APP_JS = path.join(ROOT, 'viewer', 'app.js');
const INDEX_HTML = path.join(ROOT, 'viewer', 'index.html');
const EN_I18N = path.join(ROOT, 'viewer', 'i18n', 'en.js');
const ZH_I18N = path.join(ROOT, 'viewer', 'i18n', 'zh-Hant.js');

const appJs = fs.readFileSync(APP_JS, 'utf8');
const indexHtml = fs.readFileSync(INDEX_HTML, 'utf8');
const enI18n = fs.readFileSync(EN_I18N, 'utf8');
const zhI18n = fs.readFileSync(ZH_I18N, 'utf8');

// --- module behaviour ------------------------------------------------------
assert(typeof history.create === 'function', 'navigation_history should expose create()');
assert(history.DEFAULT_LIMIT > 0, 'a positive default limit is exposed');

const nav = history.create({limit: 3});
assert(nav.canGoBack() === false, 'a fresh history cannot go back');
assert(nav.size() === 0, 'a fresh history is empty');
assert(nav.back() === null, 'back() on an empty history returns null');

assert(nav.record({id: 'a'}) === true, 'recording a new page returns true');
assert(nav.record({id: 'a'}) === false, 'recording the same page id twice in a row is a no-op');
assert(nav.size() === 1, 'consecutive duplicate pages do not stack');
assert(nav.canGoBack() === true, 'after a record the history can go back');

nav.record({id: 'b'});
nav.record({id: 'c'});
assert(nav.size() === 3, 'distinct pages stack');

nav.record({id: 'd'});
assert(nav.size() === 3, 'the stack is capped at the configured limit');
assert(nav.peek().id === 'd', 'peek returns the most recent page');

assert(nav.back().id === 'd', 'back returns the most recent page first (LIFO)');
assert(nav.back().id === 'c', 'back then returns the prior page');
assert(nav.size() === 1, 'back pops entries off the stack');

nav.clear();
assert(nav.size() === 0 && nav.canGoBack() === false, 'clear empties the history');

assert(nav.record(null) === false, 'recording null is ignored');
assert(nav.record('x') === false, 'recording a non-object is ignored');

const nav2 = history.create();
nav2.record({view: 'overview'});
assert(nav2.record({view: 'scenes'}) === false, 'records without ids collapse to a single empty-id entry');
assert(nav2.size() === 1, 'id-less records do not stack');

// --- app.js wiring ---------------------------------------------------------
assert(appJs.includes('ProjectMapNavigationHistory'), 'app.js should use the navigation history module');
assert(appJs.includes('function goBack('), 'app.js should define goBack()');
assert(appJs.includes('recordNavigation()'), 'app.js should record navigation at the chokepoints');
assert(/ArrowLeft/.test(appJs) && /altKey/.test(appJs), 'app.js should bind the Alt+Left shortcut');
assert(appJs.includes('exploreBack'), 'app.js should drive the Explore back control');

// --- markup + i18n parity --------------------------------------------------
assert(indexHtml.includes('id="explore-back"'), 'index.html should include the Explore back button');
assert(indexHtml.includes('navigation_history.js'), 'index.html should load navigation_history.js');
assert(enI18n.includes("'explore.back'"), 'en locale should define explore.back');
assert(zhI18n.includes("'explore.back'"), 'zh-Hant locale should define explore.back');

process.stdout.write(JSON.stringify({ok: true, defaultLimit: history.DEFAULT_LIMIT}, null, 2) + '\n');
