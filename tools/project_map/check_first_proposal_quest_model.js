#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {assert} = require('./check_harness.js');

const contracts = require('./authoring/studio_shared_constants.js');
const model = require('./authoring/first_proposal_quest_model.js');

const ROOT = __dirname;
const EN = fs.readFileSync(path.join(ROOT, 'viewer', 'i18n', 'en.js'), 'utf8');
const ZH = fs.readFileSync(path.join(ROOT, 'viewer', 'i18n', 'zh-Hant.js'), 'utf8');

const EXPECTED_IDS = ['load', 'open-scene', 'draft', 'check', 'read-diff', 'apply'];
const BROWSER_IDS = ['load', 'open-scene', 'draft'];

// --- Centralized constants -------------------------------------------------
assert(contracts.STORAGE_KEYS.firstProposalQuestProgress === 'dendry-mod-studio-first-proposal-quest.v1',
  'quest progress storage key should be centralized');
assert(contracts.EVENT_NAMES.openFirstProposalQuest === 'ProjectMap:open-first-proposal-quest',
  'open-quest event should be centralized');
assert(contracts.EVENT_NAMES.exploreEntryOpened === 'ProjectMap:explore-entry-opened',
  'explore-entry-opened event should be centralized');
assert(contracts.EVENT_NAMES.installResult === 'ProjectMap:install-result',
  'install-result event should be centralized');

// --- Model surface ---------------------------------------------------------
['items', 'platforms', 'readDiffQuiz', 'copy', 'isItemAvailable', 'availableItems',
  'matchEvent', 'completion', 'referencedI18nKeys'].forEach((name) => {
  assert(typeof model[name] === 'function', 'model should expose ' + name + '()');
});

// --- Item shape ------------------------------------------------------------
const items = model.items();
assert(items.length === EXPECTED_IDS.length,
  'quest should have ' + EXPECTED_IDS.length + ' items, found ' + items.length);
assert(items.map((entry) => entry.id).join(',') === EXPECTED_IDS.join(','),
  'quest items should be in the expected order: ' + EXPECTED_IDS.join(','));

const validPlatforms = model.platforms();
items.forEach((entry) => {
  assert(entry.titleKey && entry.nudgeKey && entry.doneKey,
    'item ' + entry.id + ' should carry title/nudge/done i18n keys');
  assert(validPlatforms.indexOf(entry.platform) !== -1,
    'item ' + entry.id + ' has an invalid platform: ' + entry.platform);
  assert(entry.completion === 'event' || entry.completion === 'quiz',
    'item ' + entry.id + ' has an invalid completion: ' + entry.completion);
  if (entry.completion === 'event') {
    assert(entry.event, 'event-completed item ' + entry.id + ' must name an event');
  }
  if (entry.platform === 'desktop') {
    assert(entry.lockedKey, 'desktop-only item ' + entry.id + ' should carry a locked hint key');
  }
});

// The model's event strings must match the centralized constants, so the
// emitters in app.js / install_assistant_ui.js and the quest stay in lockstep.
assert(model.EVENTS.indexLoaded === contracts.EVENT_NAMES.indexLoaded,
  'quest indexLoaded event should match the centralized constant');
assert(model.EVENTS.exploreEntryOpened === contracts.EVENT_NAMES.exploreEntryOpened,
  'quest exploreEntryOpened event should match the centralized constant');
assert(model.EVENTS.installResult === contracts.EVENT_NAMES.installResult,
  'quest installResult event should match the centralized constant');

// --- Platform split ("browser does half") ----------------------------------
const browser = model.availableItems({desktop: false}).map((entry) => entry.id);
assert(browser.join(',') === BROWSER_IDS.join(','),
  'browser should expose exactly the load/open/draft half, got: ' + browser.join(','));
const desktop = model.availableItems({desktop: true}).map((entry) => entry.id);
assert(desktop.join(',') === EXPECTED_IDS.join(','),
  'desktop should expose every item, got: ' + desktop.join(','));

// --- Event matching predicates ---------------------------------------------
const byId = {};
items.forEach((entry) => { byId[entry.id] = entry; });

assert(model.matchEvent(byId['load'], contracts.EVENT_NAMES.indexLoaded, {}) === true,
  'load should complete on any index-loaded');
assert(model.matchEvent(byId['open-scene'], contracts.EVENT_NAMES.exploreEntryOpened, {view: 'scenes'}) === true,
  'open-scene should complete when a scene is opened');
assert(model.matchEvent(byId['open-scene'], contracts.EVENT_NAMES.exploreEntryOpened, {view: 'events'}) === false,
  'open-scene should ignore non-scene entries');
assert(model.matchEvent(byId['draft'], model.EVENTS.draftWorkspaceUpdated, {count: 1}) === true,
  'draft should complete once a draft exists');
assert(model.matchEvent(byId['draft'], model.EVENTS.draftWorkspaceUpdated, {count: 0}) === false,
  'draft should not complete on an empty draft workspace');
assert(model.matchEvent(byId['check'], contracts.EVENT_NAMES.installResult, {dryRun: true, ok: true}) === true,
  'check should complete on a successful dry-run');
assert(model.matchEvent(byId['check'], contracts.EVENT_NAMES.installResult, {dryRun: false, ok: true}) === false,
  'check should not complete on an apply result');
assert(model.matchEvent(byId['apply'], contracts.EVENT_NAMES.installResult, {dryRun: false, ok: true}) === true,
  'apply should complete on a successful apply');
assert(model.matchEvent(byId['apply'], contracts.EVENT_NAMES.installResult, {dryRun: false, ok: false}) === false,
  'apply should not complete on a failed apply');
assert(model.matchEvent(byId['read-diff'], contracts.EVENT_NAMES.installResult, {dryRun: true, ok: true}) === false,
  'the read-diff quiz item should never complete from an app event');

// --- Completion math -------------------------------------------------------
const browserDone = model.completion({load: true, 'open-scene': true, draft: true}, {desktop: false});
assert(browserDone.available === 3 && browserDone.done === 3 && browserDone.allDone === true,
  'finishing the three browser items should read as done on browser');
const desktopPartial = model.completion({load: true, 'open-scene': true, draft: true}, {desktop: true});
assert(desktopPartial.available === 6 && desktopPartial.done === 3 && desktopPartial.allDone === false,
  'the same progress should be partial on desktop (3/6)');
const allProgress = {};
EXPECTED_IDS.forEach((id) => { allProgress[id] = true; });
const desktopDone = model.completion(allProgress, {desktop: true});
assert(desktopDone.done === 6 && desktopDone.allDone === true,
  'completing every item should read as done on desktop');

// --- Read-diff quiz --------------------------------------------------------
const quiz = model.readDiffQuiz();
assert(quiz.promptKey && quiz.correctKey && quiz.wrongKey, 'quiz should carry prompt/correct/wrong keys');
assert(Array.isArray(quiz.lines) && quiz.lines.length >= 3, 'quiz should present at least three diff lines');
const added = quiz.lines.filter((line) => line.kind === 'added');
const removed = quiz.lines.filter((line) => line.kind === 'removed');
assert(added.length === 1, 'quiz should mark exactly one added (+) line');
assert(removed.length === 1, 'quiz should mark exactly one removed (-) line');
assert(quiz.answer === added[0].id,
  'the correct quiz answer should be the added line (what the file becomes)');

// --- i18n parity (every referenced key present in BOTH locales) ------------
const keys = model.referencedI18nKeys();
assert(keys.length >= 30, 'quest should reference a full copy set, found ' + keys.length);
keys.forEach((key) => {
  const token = "'" + key + "'";
  assert(EN.includes(token), 'en.js is missing quest key ' + key);
  assert(ZH.includes(token), 'zh-Hant.js is missing quest key ' + key);
});

process.stdout.write(JSON.stringify({
  ok: true,
  items: items.length,
  browserItems: browser.length,
  desktopItems: desktop.length,
  quizLines: quiz.lines.length,
  i18nKeys: keys.length
}, null, 2) + '\n');
