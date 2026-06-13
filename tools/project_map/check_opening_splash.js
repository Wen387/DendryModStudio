#!/usr/bin/env node
'use strict';

// Opening splash (version ceremony) — decision model + wiring contract.
// The splash plays once per app version (the bundled What's New `latest` is
// the single version source), skips instantly on click/Escape, never builds
// under reduced motion, and hands off to the guided tour's fresh-run greeting
// via a done event. These checks pin the pure decision, the storage/event
// centralization, and the shell wiring, all without a DOM.

const fs = require('fs');
const path = require('path');
const {assert} = require('./check_harness.js');

const contracts = require('./authoring/studio_shared_constants.js');
const splash = require('./viewer/opening_splash.js');

const ROOT = __dirname;
const html = fs.readFileSync(path.join(ROOT, 'viewer', 'index.html'), 'utf8');
const stylesManifest = fs.readFileSync(path.join(ROOT, 'viewer', 'styles.css'), 'utf8');
const moduleSource = fs.readFileSync(path.join(ROOT, 'viewer', 'opening_splash.js'), 'utf8');
const tourSource = fs.readFileSync(path.join(ROOT, 'viewer', 'guided_tour_ui.js'), 'utf8');
const cssPath = path.join(ROOT, 'viewer', 'styles', 'opening-splash.css');
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

// --- Centralized constants ---------------------------------------------------
assert(contracts.STORAGE_KEYS.splashSeenVersion === 'dendry-mod-studio-splash-seen-version',
  'splash seen-version storage key should be centralized');
assert(contracts.EVENT_NAMES.openingSplashDone === 'ProjectMap:opening-splash-done',
  'splash done event should be centralized');

// --- API + pure decision -------------------------------------------------------
assert(typeof splash.isActive === 'function' && typeof splash.play === 'function',
  'splash API should expose isActive() and play()');
assert(splash.isActive() === false, 'splash should not report active without a DOM');
const shouldPlay = splash._model && splash._model.shouldPlay;
assert(typeof shouldPlay === 'function', 'splash should expose its pure decision model');

assert(shouldPlay('', '0.98.1', false) === true, 'a fresh install should see the ceremony');
assert(shouldPlay('0.98.0', '0.98.1', false) === true, 'an updated build should see the ceremony once');
assert(shouldPlay('0.98.1', '0.98.1', false) === false, 'the same version should never replay');
assert(shouldPlay('0.98.0', '0.98.1', true) === false, 'reduced motion should suppress the ceremony');
assert(shouldPlay('0.98.0', '', false) === false, 'no version data means no ceremony');

// --- Behavior pinned in source --------------------------------------------------
assert(moduleSource.includes('ProjectMapWhatsNewData'),
  'the splash should read its version from the bundled What\'s New data');
assert(moduleSource.includes('stampSeenVersion(version)'),
  'the splash should stamp the seen version so it never nags twice');
assert(moduleSource.includes("'Escape'") && moduleSource.includes("addEventListener('click'"),
  'the splash should be skippable by click and keyboard');
assert(moduleSource.includes('prefersReducedMotion'),
  'the splash should respect reduced motion');
assert(moduleSource.includes('topbar.author'),
  'the byline should reuse the shell author string');
assert(moduleSource.includes('.brand-mark svg'),
  'the splash should reuse the topbar brand mark');

// --- Tour handoff ----------------------------------------------------------------
assert(tourSource.includes('ProjectMapOpeningSplash') && tourSource.includes('opening-splash-done'),
  'the guided tour should defer its fresh-run greeting until the splash lifts');

// --- Shell wiring + styles --------------------------------------------------------
assert(html.includes('opening_splash.js'), 'viewer should load the opening splash module');
assert(stylesManifest.includes('styles/opening-splash.css'),
  'the styles manifest should import the splash stylesheet');
['.opening-splash', '.opening-splash-glow', '.opening-splash-word', '.opening-splash-meta',
  '.opening-splash.is-leaving', 'prefers-reduced-motion'].forEach((token) => {
  assert(css.includes(token), 'opening-splash.css should define ' + token);
});

process.stdout.write(JSON.stringify({ok: true}, null, 2) + '\n');
