(function registerProjectMapI18nEnHome(global) {
  'use strict';

  // Home Hub catalog, split out of en.js so the home.* surface stays off the
  // at-ceiling main catalog. Loaded AFTER en.js (which sets the base object),
  // then merged in. Keys must stay in lockstep with zh-Hant.home.js.
  // NOTE: the home.whatsnew.v0985.* copy is a reviewed draft (one block per
  // release theme, from the 123-commit backlog survey) awaiting the author's
  // final pass before release.
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
      'home.whatsnew.unavailable': 'Release notes are unavailable right now.',
      'home.whatsnew.band.title': 'New in this version',
      'home.whatsnew.band.body': 'See what changed in this update.',
      'home.whatsnew.band.cta': 'See what\'s new',
      'home.whatsnew.band.dismiss': 'Got it',
      'home.whatsnew.link': 'What\'s new in this version',
      'home.whatsnew.digest.cta': 'See the full introduction',
      'home.whatsnew.panel.title': 'What\'s new in this version',
      'home.whatsnew.panel.close': 'Close',
      'home.whatsnew.panel.done': 'Start exploring',
      'home.whatsnew.v0985.home.title': 'A brand-new Home Hub',
      'home.whatsnew.v0985.home.body': 'The welcome popup grew into a real home page: overview, publish, notices, templates and What\'s New on one page, recent projects one click away, and a once-per-version opening ceremony. The wordmark brings you back any time.',
      'home.whatsnew.v0985.home.alt': 'The Home Hub overview page showing quick actions, recent projects, and the What\'s New section.',
      'home.whatsnew.v0985.tour.title': 'A guided tour to get you started',
      'home.whatsnew.v0985.tour.body': 'A spotlight walkthrough with the Tour Fairy, one-time hints on key surfaces, and a hands-on quest that walks you through your first edit proposal.',
      'home.whatsnew.v0985.tour.alt': 'The Tour Fairy welcome dialog offering an optional guided walkthrough of the Studio.',
      'home.whatsnew.v0985.publish.title': 'Publish straight to GitHub',
      'home.whatsnew.v0985.publish.body': 'First publish, update pushes and sync pulls all inside Studio; the management dashboard shows commit history, edits visibility and description, and an interrupted publish retries safely.',
      'home.whatsnew.v0985.playtest.title': 'Play-test inside the Object Editor',
      'home.whatsnew.v0985.playtest.body': 'Play your event on the real Dendry engine without a separate build — scene art and music included, starting from any upstream scene, with a fresh-seed re-roll for randomness.',
      'home.whatsnew.v0985.playtest.alt': 'An event open in the Object Editor with the inline play-test controls running on the real Dendry engine.',
      'home.whatsnew.v0985.editor.title': 'Conditionals and authoring, upgraded',
      'home.whatsnew.v0985.editor.body': 'Nested inline conditionals render as a navigable layered tree with a live what-if simulator that resolves which branches a given state would reach. Over-cap magic blocks, qdisplay inserts, asset swaps, a long-event find toolbar and a card Create Similar action close the smaller authoring gaps.',
      'home.whatsnew.v0985.darkmode.title': 'Dark mode arrives',
      'home.whatsnew.v0985.darkmode.body': 'Light, dark or auto — a warm-charcoal workspace, while your content previews keep their paper palette so WYSIWYG stays intact.',
      'home.whatsnew.v0985.darkmode.alt': 'The Studio in dark mode — the Explore overview and project stats on a warm-charcoal background.',
      'home.whatsnew.v0985.systemui.title': 'System UI authoring, made intuitive',
      'home.whatsnew.v0985.systemui.body': 'The create entry now uses three intuitive buckets, the right sidebar is a real selectable, editable region, and changes apply surgically to your template without touching other fields.',
      'home.whatsnew.v0985.polish.title': 'A faster, quieter Studio',
      'home.whatsnew.v0985.polish.body': 'Large events now open in under 10 seconds instead of around 89; plus a full polish pass — empty and error states with retry, fewer duplicate signals, and an always-available back button.',
      'home.dash.welcomeBack': 'Welcome back',
      'home.dash.quickActions': 'Quick actions',
      'home.dash.openOnboarding': 'View the getting-started guide',
      'home.dash.openTutorialLibrary': 'Open Tutorial Library',
      'home.dash.browserHint': 'Publishing and notices are available in the desktop app.',
      'home.recent.title': 'Recent projects',
      'home.recent.remove': 'Remove from list',
      'home.recent.openFailed': 'Could not open this folder — it may have moved or been renamed.',
      'topbar.templateHub': 'Template Hub',
      'topbar.publish': 'Publish to GitHub',
      'topbar.announcements': 'Notice Preview',
      // V3 state-safety empty/ready strings. These belong to non-home surfaces
      // (playtest, storyboard, card board, workspace layout, route map) but are
      // parked in this off-budget split catalog because the main en.js/zh-Hant.js
      // is at its line ceiling. Keys keep their own namespace prefix; the catalog
      // merge is flat so the call sites resolve them normally.
      'playSim.ready': 'Ready — pick a scene to begin.',
      'storyboard.empty.title': 'No events on the storyboard yet',
      'storyboard.empty.hint': 'Add a story event from the palette, or load a project with dated events to see them here.',
      'cardBoard.empty.board': 'No cards yet — open a project with card objects to see them here.',
      'workspaceLayout.readinessEmpty': 'Load a ProjectIndex to check workspace anchors.',
      'previewObjectEditor.routeMapEmpty': 'No route map yet — add an option to see routing.',
      // Guided-tour step introducing Home itself. Parked here for the same
      // ceiling reason as the block above; placeholder copy pending final prose.
      'tour.linear.home.title': 'Home — your home base',
      'tour.linear.home.body': 'This is Home: announcements, templates, publishing, and what changed in each version all gather here. Click the Dendry Mod Studio wordmark in the corner any time to come back.'
    }
  };

  global.ProjectMapI18nDictionaries = global.ProjectMapI18nDictionaries || {};
  global.ProjectMapI18nDictionaries["en"] =
    global.ProjectMapI18nDictionaries["en"] || {};
  Object.assign(global.ProjectMapI18nDictionaries["en"], CATALOG.en);
})(typeof window !== 'undefined' ? window : globalThis);
