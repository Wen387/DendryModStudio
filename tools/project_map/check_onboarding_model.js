#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {readViewerI18n} = require('./check_viewer_assets.js');

const contracts = require('./authoring/studio_contracts.js');
const onboarding = require('./viewer/onboarding_ui.js');
const tutorial = require('./viewer/tutorial_library_ui.js');

const ROOT = __dirname;
const VIEWER_HTML = path.join(ROOT, 'viewer', 'index.html');
const ONBOARDING_UI = path.join(ROOT, 'viewer', 'onboarding_ui.js');
const TUTORIAL_UI = path.join(ROOT, 'viewer', 'tutorial_library_ui.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

const html = fs.readFileSync(VIEWER_HTML, 'utf8');
const onboardingUi = fs.readFileSync(ONBOARDING_UI, 'utf8');
const tutorialUi = fs.existsSync(TUTORIAL_UI) ? fs.readFileSync(TUTORIAL_UI, 'utf8') : '';
const i18nUi = readViewerI18n(path.join(ROOT, 'viewer'));

assert(contracts.STORAGE_KEYS.onboardingSeen === 'dendry-mod-studio-onboarding-seen', 'onboarding storage key should be centralized');
assert(contracts.EVENT_NAMES.openOnboarding === 'ProjectMap:open-onboarding', 'onboarding open event should be centralized');
assert(html.includes('id="studio-open-onboarding"'), 'More menu should expose a Quick Start action');
assert(html.includes('id="studio-open-tutorial-library"'), 'More menu should expose a Tutorial Library action');
assert(html.includes('id="studio-onboarding"'), 'viewer should include the onboarding dialog');
assert(html.includes('id="onboarding-open-tutorial-library"'), 'Quick Start should link to the Tutorial Library');
assert(html.includes('id="onboarding-load-demo"'), 'Quick Start should offer the bundled demo template');
assert(html.includes('id="studio-tutorial-library"'), 'viewer should include the Tutorial Library dialog');
assert(html.includes('data-tutorial-open="tags-event"'), 'News Wizard guidance should link to the tags:event explanation');
assert(html.includes('role="dialog"'), 'onboarding should use dialog semantics');
assert(html.includes('aria-modal="true"'), 'onboarding dialog should be modal for assistive technology');
assert(html.includes('onboarding_ui.js'), 'viewer should load onboarding UI');
assert(html.includes('tutorial_library_ui.js'), 'viewer should load tutorial library UI');
assert(onboardingUi.includes('ProjectMapOnboarding'), 'onboarding UI should expose a small browser API');
assert(onboardingUi.includes('data-onboarding-close'), 'onboarding UI should support explicit close actions');
assert(onboardingUi.includes('openStarterDemo'), 'onboarding UI should call the desktop starter demo bridge');
assert(tutorialUi.includes('ProjectMapTutorialLibrary'), 'tutorial library UI should expose a small browser API');
assert(tutorialUi.includes('what-is-ide'), 'tutorial library should define an IDE article');
assert(tutorialUi.includes('sdaah-style'), 'tutorial library should define an SDAAH-style article');
assert(tutorialUi.includes('variables-in-sdaah'), 'tutorial library should explain how SDAAH-like variables are used');
assert(tutorialUi.includes('world-events-router'), 'tutorial library should explain world events and routers');
assert(tutorialUi.includes('surface-text-sidebar'), 'tutorial library should explain sidebar and surface text editing');
assert(tutorialUi.includes('asset-references'), 'tutorial library should explain asset references and missing files');
assert(tutorialUi.includes('tags-event'), 'tutorial library should define a tags:event article');
assert(tutorialUi.includes('mode-buttons'), 'tutorial library should explain Explore / Design / Create / Install');
assert(tutorialUi.includes('faq-export-open-diagnostics'), 'tutorial library should explain open project, export, and diagnostics');
assert(tutorialUi.includes('faq-git-safety'), 'tutorial library should explain Git safety for mod projects');
assert(tutorialUi.includes('faq-ide-project'), 'tutorial library should explain installing/opening an IDE for a project');
assert(tutorialUi.includes('profile-compatibility'), 'tutorial library should explain profile compatibility before tester release');
assert(tutorialUi.includes('compatibility-open-source'), 'tutorial library should define compatibility and open-source guidance');
[
  'tags-event',
  'mode-buttons',
  'faq-export-open-diagnostics',
  'faq-git-safety',
  'faq-ide-project'
].forEach((id) => {
  assert(tutorial.articleIds().includes(id), 'tutorial article registry should include ' + id);
});
assert(i18nUi.includes("'topbar.quickStart'"), 'Quick Start menu label should be localized');
assert(i18nUi.includes("'topbar.tutorialLibrary'"), 'Tutorial Library menu label should be localized');
assert(i18nUi.includes("'onboarding.title'"), 'onboarding title should be localized');
assert(i18nUi.includes("'onboarding.openTutorialLibrary'"), 'onboarding Tutorial Library action should be localized');
assert(i18nUi.includes("'onboarding.loadDemo'"), 'onboarding bundled demo action should be localized');
assert(i18nUi.includes("'onboarding.demoNote'"), 'onboarding bundled demo note should be localized');
assert(i18nUi.includes("'onboarding.primary.desktop'"), 'desktop primary action should be localized');
assert(i18nUi.includes("'onboarding.primary.browser'"), 'browser primary action should be localized');
[
  'tutorial.article.ide.title',
  'tutorial.article.sdaah.body',
  'tutorial.article.variables.selector.body',
  'tutorial.article.variables.sdaah.body',
  'tutorial.article.variables.consumers.body',
  'tutorial.article.worldEvents.router.body',
  'tutorial.article.tagsEvent.body',
  'tutorial.article.modes.body',
  'tutorial.article.faq.export.body',
  'tutorial.article.faq.git.body',
  'tutorial.article.faq.ide.body',
  'tutorial.article.surfaceText.sidebar.body',
  'tutorial.article.assets.references.body',
  'tutorial.article.profileCompatibility.body',
  'tutorial.article.profileCompatibility.compatibilityMeaning.body',
  'tutorial.article.profileCompatibility.parserMeaning.body',
  'tutorial.article.install.body',
  'tutorial.article.paths.body',
  'tutorial.article.troubleshooting.body',
  'tutorial.article.compatibility.body'
].forEach((key) => {
  assert(i18nUi.includes("'" + key + "'"), 'Tutorial Library should localize ' + key);
});
[
  '被消費',
  'post_event',
  'Sidebar',
  '缺實體檔',
  '解析類型',
  '原始引擎',
  '來源專案',
  'parser',
  '語義候選'
].forEach((term) => {
  assert(i18nUi.includes(term), 'Tutorial Library should explain player-facing concept: ' + term);
});
[
  'tags: event',
  '探索',
  '設計',
  '建立',
  '安裝',
  'Export',
  'Git',
  'VS Code',
  '診斷'
].forEach((term) => {
  assert(i18nUi.includes(term), 'Tutorial Library should include plain-language help for: ' + term);
});

assert(typeof onboarding.createController === 'function', 'onboarding should expose createController for tests');
const storage = memoryStorage();
const controller = onboarding.createController({storage});
assert(controller.shouldAutoOpen(), 'first run should auto-open onboarding');
controller.markSeen();
assert(!controller.shouldAutoOpen(), 'dismissed onboarding should not auto-open again');
assert(storage.getItem(contracts.STORAGE_KEYS.onboardingSeen) === '1', 'dismissal should persist onboarding seen flag');
assert(onboarding.primaryActionKind({dendryDesktop: {openProject: () => null}}) === 'desktop', 'desktop bridge should prefer Open Project action');
assert(onboarding.primaryActionKind({}) === 'browser', 'browser mode should prefer ProjectIndex load action');
assert(onboarding.canLoadBundledDemo({dendryDesktop: {openStarterDemo: () => null}}), 'desktop bridge with starter demo should enable bundled demo action');
assert(!onboarding.canLoadBundledDemo({dendryDesktop: {openProject: () => null}}), 'desktop bridge without starter demo should hide bundled demo action');
assert(onboarding.open() === false, 'test environment open() should fail closed without a DOM dialog');
assert(onboarding.close() === false, 'test environment close() should fail closed without a DOM dialog');

process.stdout.write(JSON.stringify({
  ok: true,
  storageKey: contracts.STORAGE_KEYS.onboardingSeen,
  openEvent: contracts.EVENT_NAMES.openOnboarding
}, null, 2) + '\n');
