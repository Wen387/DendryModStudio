(function registerProjectMapI18nEnHome(global) {
  'use strict';

  // Home Hub catalog, split out of en.js so the home.* surface stays off the
  // at-ceiling main catalog. Loaded AFTER en.js (which sets the base object),
  // then merged in. Keys must stay in lockstep with zh-Hant.home.js.
  // NOTE: the home.whatsnew.v0981.* feature copy is placeholder release text
  // describing the Home Hub; finalize the prose once Home is feature-complete.
  const CATALOG = {
    en: {
      'home.navAria': 'Home sections',
      'home.section.overview': 'Overview',
      'home.section.publish': 'Publish',
      'home.section.announcements': 'Notices',
      'home.section.templates': 'Templates',
      'home.section.whatsnew': 'What\'s New',
      'home.menuEntry': 'Home',
      'home.wordmarkAria': 'Go to Home',
      'home.hero.greeting': 'Welcome to your studio',
      'home.hero.sub': 'Pick up wherever you left off.',
      'home.publish.lead': 'Review and publish your mod to GitHub.',
      'home.publish.cta': 'Open publish panel',
      'home.publish.statusInSync': 'Up to date with GitHub',
      'home.publish.statusDirty': 'Unsaved local edits',
      'home.publish.statusOffline': 'Couldn\'t reach GitHub',
      'home.publish.statusConnect': 'Connect GitHub to publish',
      'home.publish.statusNoProject': 'Open a mod to publish',
      'home.publish.statusFirstPublish': 'Not published yet',
      'home.announcements.lead': 'Catch up on the latest notices and updates.',
      'home.announcements.cta': 'Open notices',
      'home.templates.lead': 'Browse and add starter templates.',
      'home.templates.cta': 'Open template hub',
      'home.whatsnew.lead': 'After an update, this is where new features are introduced.',
      'home.whatsnew.title': 'What\'s new',
      'home.whatsnew.empty': 'You\'re all caught up.',
      'home.whatsnew.band.title': 'New in this version',
      'home.whatsnew.band.body': 'See what changed in this update.',
      'home.whatsnew.band.cta': 'See what\'s new',
      'home.whatsnew.band.dismiss': 'Got it',
      'home.whatsnew.link': 'What\'s new in this version',
      'home.whatsnew.v0981.home.title': 'A real Home base',
      'home.whatsnew.v0981.home.body': 'Click the wordmark any time to return to Home — your Studio dashboard, separate from the four work modes.',
      'home.whatsnew.v0981.overview.title': 'An Overview that adapts',
      'home.whatsnew.v0981.overview.body': 'Before a project loads you get onboarding; once one is open, a welcome-back dashboard takes its place.',
      'home.whatsnew.v0981.sections.title': 'Studio tools, gathered',
      'home.whatsnew.v0981.sections.body': 'Publish, notices, templates and What\'s New are moving under Home, one section at a time.',
      'home.dash.welcomeBack': 'Welcome back',
      'home.dash.openOnboarding': 'View the getting-started guide',
      'home.dash.openTutorialLibrary': 'Open Tutorial Library',
      'home.dash.browserHint': 'Publishing and notices are available in the desktop app.',
      'topbar.templateHub': 'Template Hub',
      'topbar.publish': 'Publish to GitHub',
      'topbar.announcements': 'Notice Preview'
    }
  };

  global.ProjectMapI18nDictionaries = global.ProjectMapI18nDictionaries || {};
  global.ProjectMapI18nDictionaries["en"] =
    global.ProjectMapI18nDictionaries["en"] || {};
  Object.assign(global.ProjectMapI18nDictionaries["en"], CATALOG.en);
})(typeof window !== 'undefined' ? window : globalThis);
