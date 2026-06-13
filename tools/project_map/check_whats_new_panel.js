#!/usr/bin/env node
'use strict';

// What's New reading panel — decision model + wiring contract.
// The panel is the full release introduction (bodies + optional screenshots);
// the Home page keeps only a slim digest. It auto-opens exactly once on the
// first boot after an UPDATE (never on a fresh install — the release band's
// silent seeding marks those), deferred until the opening splash lifts, and
// opening stamps the shared last-seen-version key so the release band flips
// to its quiet link. These checks pin the pure decision, the shared-key and
// event centralization, the load-order dependency, and the digest handoff.

const fs = require('fs');
const path = require('path');
const {assert} = require('./check_harness.js');

const contracts = require('./authoring/studio_shared_constants.js');
const panel = require('./viewer/whats_new_panel.js');

const ROOT = __dirname;
const html = fs.readFileSync(path.join(ROOT, 'viewer', 'index.html'), 'utf8');
const stylesManifest = fs.readFileSync(path.join(ROOT, 'viewer', 'styles.css'), 'utf8');
const moduleSource = fs.readFileSync(path.join(ROOT, 'viewer', 'whats_new_panel.js'), 'utf8');
const registrySource = fs.readFileSync(path.join(ROOT, 'viewer', 'home_section_registry.js'), 'utf8');
const cssPath = path.join(ROOT, 'viewer', 'styles', 'whats-new-panel.css');
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
const enHome = fs.readFileSync(path.join(ROOT, 'viewer', 'i18n', 'en.home.js'), 'utf8');
const zhHome = fs.readFileSync(path.join(ROOT, 'viewer', 'i18n', 'zh-Hant.home.js'), 'utf8');

// --- Centralized constants ---------------------------------------------------
assert(contracts.EVENT_NAMES.whatsNewSeen === 'ProjectMap:whats-new-seen',
  'whats-new-seen event should be centralized');
assert(moduleSource.includes('STORAGE_KEYS.lastSeenVersion'),
  'the panel should stamp the SAME last-seen-version key the release band reads');

// --- API + pure decision -------------------------------------------------------
assert(typeof panel.open === 'function' && typeof panel.close === 'function' &&
  typeof panel.isOpen === 'function', 'panel API should expose open()/close()/isOpen()');
assert(panel.isOpen() === false, 'panel should not report open without a DOM');
const shouldAutoOpen = panel._model && panel._model.shouldAutoOpen;
assert(typeof shouldAutoOpen === 'function', 'panel should expose its pure decision model');

assert(shouldAutoOpen('', '0.98.1') === false,
  'a fresh install should NOT auto-open (the welcome surface owns that moment)');
assert(shouldAutoOpen('0.98.0', '0.98.1') === true,
  'the first boot after an update should auto-open once');
assert(shouldAutoOpen('0.98.1', '0.98.1') === false,
  'the same version should never auto-open again');
assert(shouldAutoOpen('0.98.0', '') === false, 'no version data means no auto-open');

// --- Behavior pinned in source --------------------------------------------------
assert(moduleSource.includes('opening-splash-done') || moduleSource.includes('openingSplashDone'),
  'the auto-open should defer until the opening splash lifts');
assert(moduleSource.includes('stampSeenVersion(currentVersion())') &&
  moduleSource.includes('announceSeen()'),
  'opening should stamp the seen version and announce it');
assert(moduleSource.includes("'Escape'"),
  'the panel should close on Escape');
assert(moduleSource.includes('item.image') && moduleSource.includes('imageAltKey'),
  'items should support an optional screenshot with localized alt text');
assert(moduleSource.includes('returnFocus'),
  'closing should hand focus back to the opener');

// --- Load order ------------------------------------------------------------------
const splashAt = html.indexOf('opening_splash.js');
const panelAt = html.indexOf('whats_new_panel.js');
assert(splashAt !== -1 && panelAt !== -1, 'viewer should load both splash and panel modules');
assert(panelAt > splashAt,
  'whats_new_panel.js must load AFTER opening_splash.js (both boot on DOMContentLoaded)');

// --- Digest handoff ----------------------------------------------------------------
assert(registrySource.includes('ProjectMapWhatsNewPanel'),
  'the release band / digest open path should go through the reading panel');
assert(registrySource.includes('whatsNewSeen'),
  'the registry should re-render the band when the panel announces itself');
assert(registrySource.includes('home.whatsnew.digest.cta'),
  'the digest should carry a "see the full introduction" button');
assert(!registrySource.includes('home-whatsnew-item-body'),
  'digest rows should be title-only — body copy belongs to the panel');

// --- i18n + styles ------------------------------------------------------------------
['home.whatsnew.digest.cta', 'home.whatsnew.panel.title', 'home.whatsnew.panel.close',
  'home.whatsnew.panel.done'].forEach((key) => {
  assert(enHome.includes(key) && zhHome.includes(key),
    'both home catalogs should define ' + key);
});
assert(stylesManifest.includes('styles/whats-new-panel.css'),
  'the styles manifest should import the panel stylesheet');
['.whats-new-panel', '.whats-new-panel-card', '.whats-new-panel-figure',
  '.whats-new-panel-item', '.whats-new-panel-done', 'prefers-reduced-motion'].forEach((token) => {
  assert(css.includes(token), 'whats-new-panel.css should define ' + token);
});

process.stdout.write(JSON.stringify({ok: true}, null, 2) + '\n');
