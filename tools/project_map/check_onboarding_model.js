#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {readViewerI18n} = require('./check_viewer_assets.js');

const contracts = require('./authoring/studio_shared_constants.js');
const onboarding = require('./viewer/onboarding_ui.js');
const welcome = require('./viewer/welcome_surface_ui.js');
const tutorial = require('./viewer/tutorial_library_ui.js');

const ROOT = __dirname;
const VIEWER_HTML = path.join(ROOT, 'viewer', 'index.html');
const ONBOARDING_UI = path.join(ROOT, 'viewer', 'onboarding_ui.js');
const WELCOME_UI = path.join(ROOT, 'viewer', 'welcome_surface_ui.js');
const TUTORIAL_UI = path.join(ROOT, 'viewer', 'tutorial_library_ui.js');

const {fail, assert} = require('./check_harness.js');

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
const welcomeUi = fs.readFileSync(WELCOME_UI, 'utf8');
const tutorialUi = fs.existsSync(TUTORIAL_UI) ? fs.readFileSync(TUTORIAL_UI, 'utf8') : '';
const i18nUi = readViewerI18n(path.join(ROOT, 'viewer'));
const welcomeSurface = html + '\n' + welcomeUi;

assert(contracts.STORAGE_KEYS.onboardingSeen === 'dendry-mod-studio-onboarding-seen', 'onboarding storage key should be centralized');
assert(contracts.EVENT_NAMES.openOnboarding === 'ProjectMap:open-onboarding', 'onboarding open event should be centralized');
assert(html.includes('id="studio-open-onboarding"'), 'More menu should expose a Welcome Hub action');
assert(html.includes('id="studio-open-tutorial-library"'), 'More menu should expose a Tutorial Library action');
assert(html.includes('id="studio-welcome-root"'), 'viewer should include the Welcome Hub mount point');
assert(welcomeSurface.includes('id="studio-welcome"'), 'Welcome Hub UI should include the dialog');
assert(welcomeSurface.includes('id="welcome-primary"'), 'Welcome Hub should expose the Open Project / Load ProjectIndex route');
assert(welcomeSurface.includes('id="welcome-browse-workspace"'), 'Welcome Hub should expose the Browse Workspace route');
assert(welcomeSurface.includes('id="onboarding-open-tutorial-library"'), 'Welcome Hub should link to the Tutorial Library');
assert(welcomeSurface.includes('id="onboarding-load-demo"'), 'Welcome Hub should offer the bundled demo template');
assert(html.includes('id="studio-tutorial-library"'), 'viewer should include the Tutorial Library dialog');
assert(html.includes('data-tutorial-open="tags-event"'), 'News Wizard guidance should link to the tags:event explanation');
assert(welcomeSurface.includes('role="dialog"'), 'onboarding should use dialog semantics');
assert(welcomeSurface.includes('aria-modal="true"'), 'onboarding dialog should be modal for assistive technology');
assert(html.includes('icons.js'), 'viewer should load the shared icon layer');
assert(html.includes('welcome_surface_ui.js'), 'viewer should load Welcome Hub UI');
assert(html.includes('onboarding_ui.js'), 'viewer should load onboarding compatibility UI');
assert(html.includes('tutorial_library_ui.js'), 'viewer should load tutorial library UI');
assert(onboardingUi.includes('ProjectMapOnboarding'), 'onboarding UI should expose a small browser API');
assert(welcomeUi.includes('ProjectMapWelcomeSurface'), 'Welcome Hub UI should expose a small browser API');
assert(welcomeSurface.includes('data-onboarding-close'), 'Welcome Hub should support legacy explicit close actions');
assert(welcomeUi.includes('openStarterDemo'), 'Welcome Hub UI should call the desktop starter demo bridge');
assert(tutorialUi.includes('ProjectMapTutorialLibrary'), 'tutorial library UI should expose a small browser API');
assert(tutorial.articleIds().length === 16, 'tutorial library should define the current 16-section one-page guide');
assert(tutorialUi.includes('studio-intro'), 'tutorial library should explain what Studio is');
assert(tutorialUi.includes('dev-preview'), 'tutorial library should define a Dev Preview status article');
assert(tutorialUi.includes('workspaces'), 'tutorial library should explain the four workspaces');
assert(tutorialUi.includes('create-editor'), 'tutorial library should explain the Create editing surface');
assert(tutorialUi.includes('install-flow'), 'tutorial library should explain install check/apply flow');
assert(tutorialUi.includes('sdaah-structure'), 'tutorial library should define an SDAAH-style structure article');
assert(tutorialUi.includes('variables'), 'tutorial library should explain variables');
assert(tutorialUi.includes('tags-event'), 'tutorial library should define a tags:event article');
assert(tutorialUi.includes('confidence'), 'tutorial library should explain parser confidence labels');
assert(tutorialUi.includes('island-sunrise'), 'tutorial library should explain IslandSunrise boundaries');
assert(tutorialUi.includes('compatibility'), 'tutorial library should explain compatibility');
assert(tutorialUi.includes('upstream'), 'tutorial library should explain upstream changes');
assert(tutorialUi.includes('practical'), 'tutorial library should explain practical basics');
assert(tutorialUi.includes('git-safety'), 'tutorial library should explain Git safety for mod projects');
assert(tutorialUi.includes('troubleshooting'), 'tutorial library should explain troubleshooting');
assert(tutorialUi.includes('open-source'), 'tutorial library should define open-source guidance');
[
  'studio-intro',
  'dev-preview',
  'workspaces',
  'create-editor',
  'install-flow',
  'sdaah-structure',
  'variables',
  'tags-event',
  'confidence',
  'island-sunrise',
  'compatibility',
  'upstream',
  'practical',
  'git-safety',
  'troubleshooting',
  'open-source'
].forEach((id) => {
  assert(tutorial.articleIds().includes(id), 'tutorial article registry should include ' + id);
});
assert(i18nUi.includes("'topbar.welcome'"), 'Welcome Hub menu label should be localized');
assert(i18nUi.includes("'topbar.tutorialLibrary'"), 'Tutorial Library menu label should be localized');
assert(i18nUi.includes("'welcome.title'"), 'Welcome Hub title should be localized');
assert(i18nUi.includes("'welcome.openTutorialLibrary'"), 'Welcome Hub Tutorial Library action should be localized');
assert(i18nUi.includes("'welcome.action.demo.cta'"), 'Welcome Hub bundled demo action should be localized');
assert(i18nUi.includes("'welcome.compassBody'"), 'Welcome Hub demo guidance should be localized');
assert(i18nUi.includes("'welcome.action.openProject.cta'"), 'desktop primary action should be localized');
assert(i18nUi.includes("'welcome.action.loadIndex.cta'"), 'browser primary action should be localized');
[
  'tutorial.article.studioIntro.body',
  'tutorial.article.devPreview.body',
  'tutorial.article.devPreview.body2',
  'tutorial.article.devPreview.body3',
  'tutorial.article.workspaces.body',
  'tutorial.article.createEditor.body',
  'tutorial.article.installFlow.body',
  'tutorial.article.sdaahStructure.body',
  'tutorial.article.variables.body',
  'tutorial.article.tagsEvent.body',
  'tutorial.article.confidence.body',
  'tutorial.article.islandSunrise.body',
  'tutorial.article.compatibility.body',
  'tutorial.article.upstream.body',
  'tutorial.article.practical.body',
  'tutorial.article.gitSafety.body',
  'tutorial.article.troubleshooting.body',
  'tutorial.article.openSource.body'
].forEach((key) => {
  assert(i18nUi.includes("'" + key + "'"), 'Tutorial Library should localize ' + key);
});
[
  'post_event',
  'out/html/index.html',
  '找不到實體資產',
  '解析設定檔',
  '上游',
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
  '診斷',
  'Diff',
  'ProjectIndex'
].forEach((term) => {
  assert(i18nUi.includes(term), 'Tutorial Library should include plain-language help for: ' + term);
});

assert(typeof onboarding.createController === 'function', 'onboarding should expose createController for tests');
assert(typeof welcome.createController === 'function', 'Welcome Hub should expose createController for tests');
const storage = memoryStorage();
const controller = welcome.createController({storage});
assert(controller.shouldAutoOpen(), 'first run should auto-open Welcome Hub');
controller.markSeen();
assert(!controller.shouldAutoOpen(), 'dismissed Welcome Hub should not auto-open again');
assert(storage.getItem(contracts.STORAGE_KEYS.onboardingSeen) === '1', 'dismissal should persist Welcome Hub seen flag');
assert(onboarding.primaryActionKind({dendryDesktop: {openProject: () => null}}) === 'desktop', 'desktop bridge should prefer Open Project action');
assert(onboarding.primaryActionKind({}) === 'browser', 'browser mode should prefer ProjectIndex load action');
assert(onboarding.canLoadBundledDemo({dendryDesktop: {openStarterDemo: () => null}}), 'desktop bridge with starter demo should enable bundled demo action');
assert(!onboarding.canLoadBundledDemo({dendryDesktop: {openProject: () => null}}), 'desktop bridge without starter demo should hide bundled demo action');
assert(welcome.primaryActionKind({dendryDesktop: {openProject: () => null}}) === 'desktop', 'Welcome Hub desktop bridge should prefer Open Project action');
assert(welcome.primaryActionKind({}) === 'browser', 'Welcome Hub browser mode should prefer ProjectIndex load action');
assert(welcome.canLoadBundledDemo({dendryDesktop: {openStarterDemo: () => null}}), 'Welcome Hub should enable bundled demo when bridge exists');
assert(!welcome.canLoadBundledDemo({dendryDesktop: {openProject: () => null}}), 'Welcome Hub should hide bundled demo when bridge is missing');
assert(onboarding.open() === false, 'test environment open() should fail closed without a DOM dialog');
assert(onboarding.close() === false, 'test environment close() should fail closed without a DOM dialog');
assert(welcome.open() === false, 'Welcome Hub test environment open() should fail closed without a DOM dialog');
assert(welcome.close() === false, 'Welcome Hub test environment close() should fail closed without a DOM dialog');

process.stdout.write(JSON.stringify({
  ok: true,
  storageKey: contracts.STORAGE_KEYS.onboardingSeen,
  openEvent: contracts.EVENT_NAMES.openOnboarding
}, null, 2) + '\n');
