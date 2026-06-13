#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {readViewerI18n} = require('./check_viewer_assets.js');
const {fail, assert} = require('./check_harness.js');

const contracts = require('./authoring/studio_shared_constants.js');
const model = require('./authoring/guided_tour_model.js');
const tourUiApi = require('./viewer/guided_tour_ui.js');

const ROOT = __dirname;
const VIEWER_HTML = path.join(ROOT, 'viewer', 'index.html');
const TOUR_UI = path.join(ROOT, 'viewer', 'guided_tour_ui.js');
const TOUR_CSS = path.join(ROOT, 'viewer', 'styles', 'guided-tour.css');
const WELCOME_UI = path.join(ROOT, 'viewer', 'welcome_surface_ui.js');
const WELCOME_CSS = path.join(ROOT, 'viewer', 'styles', 'welcome.css');

const PREVIEW_EDITOR = path.join(ROOT, 'viewer', 'preview_object_editor.js');
const CANVAS_SHELL = path.join(ROOT, 'viewer', 'object_canvas_shell_ui.js');
const CANVAS_UI = path.join(ROOT, 'viewer', 'object_authoring_canvas_ui.js');
const SYSTEM_UI_EDITOR = path.join(ROOT, 'viewer', 'system_ui_region_editor.js');

const html = fs.readFileSync(VIEWER_HTML, 'utf8');
const tourUi = fs.readFileSync(TOUR_UI, 'utf8');
const dynamicAnchorSource = [PREVIEW_EDITOR, CANVAS_SHELL, CANVAS_UI, SYSTEM_UI_EDITOR]
  .map((file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''))
  .join('\n');
const tourCss = fs.existsSync(TOUR_CSS) ? fs.readFileSync(TOUR_CSS, 'utf8') : '';
const welcomeUi = fs.readFileSync(WELCOME_UI, 'utf8');
const welcomeCss = fs.existsSync(WELCOME_CSS) ? fs.readFileSync(WELCOME_CSS, 'utf8') : '';
const i18nUi = readViewerI18n(path.join(ROOT, 'viewer'));

const VALID_ADVANCE = ['next', 'click-anchor', 'event'];
const VALID_PLACEMENT = ['auto', 'top', 'bottom', 'left', 'right'];
const VALID_REQUIRES = ['', 'project-loaded'];

// --- Centralized constants -------------------------------------------------
assert(contracts.STORAGE_KEYS.guidedTourSeen === 'dendry-mod-studio-guided-tour-seen',
  'guided tour seen storage key should be centralized');
assert(contracts.STORAGE_KEYS.surfaceHintsSeenPrefix === 'dendry-mod-studio-surface-hints-seen.',
  'surface hints seen prefix should be centralized');
assert(contracts.EVENT_NAMES.openGuidedTour === 'ProjectMap:open-guided-tour',
  'open guided tour event should be centralized');
assert(contracts.EVENT_NAMES.openSurfaceHints === 'ProjectMap:open-surface-hints',
  'open surface hints event should be centralized');
assert(contracts.EVENT_NAMES.welcomeDismissed === 'ProjectMap:welcome-dismissed',
  'welcome dismissed event should be centralized');

// --- Model shape -----------------------------------------------------------
assert(typeof model.linearTour === 'function', 'model should expose linearTour()');
assert(typeof model.surfaceHints === 'function', 'model should expose surfaceHints()');
assert(typeof model.referencedI18nKeys === 'function', 'model should expose referencedI18nKeys()');

const linear = model.linearTour();
assert(Array.isArray(linear) && linear.length >= 5,
  'linear tour should cover at least the five orientation steps');
assert(linear[0].anchor === '.mode-switch', 'linear tour should open on the mode switch bar');
assert(linear.some((step) => step.anchor === '#locale-select'),
  'linear tour should point out the language switch');
assert(linear.some((step) => step.id === 'comfort' && step.anchor === ''),
  'linear tour should include an anchorless comfort-tips step (zoom + refresh)');
assert(linear.some((step) => step.id === 'preview' && step.anchor === '#install-runtime-preview'),
  'linear tour should cover Runtime Preview (playtest a change safely)');
assert(linear.some((step) => step.id === 'mode' && step.anchor === ''),
  'linear tour should explain desktop app vs browser capabilities');
assert(linear.some((step) => step.id === 'home' && step.surface === 'home' && step.anchor === '.wordmark'),
  'linear tour should introduce Home (the first-run landing) and point at the wordmark way back');

const surfaces = model.surfaces();
['explore', 'create', 'install'].forEach((surface) => {
  assert(surfaces.indexOf(surface) !== -1, 'model should know the ' + surface + ' surface');
  assert(model.hasSurfaceHints(surface), surface + ' should define surface hints');
  assert(model.surfaceHints(surface).length > 0, surface + ' surface hints should be non-empty');
});

function assertStepShape(step, context) {
  assert(typeof step.id === 'string' && step.id, context + ' step should have an id');
  assert(typeof step.anchor === 'string', context + ' step anchor should be a string');
  assert(typeof step.titleKey === 'string' && step.titleKey, context + ' step should have a titleKey');
  assert(typeof step.bodyKey === 'string' && step.bodyKey, context + ' step should have a bodyKey');
  assert(VALID_ADVANCE.indexOf(step.advanceOn) !== -1,
    context + ' step advanceOn should be one of ' + VALID_ADVANCE.join('/') + ' (got ' + step.advanceOn + ')');
  assert(VALID_PLACEMENT.indexOf(step.placement) !== -1,
    context + ' step placement should be valid (got ' + step.placement + ')');
  assert(VALID_REQUIRES.indexOf(step.requires) !== -1,
    context + ' step requires should be valid (got ' + step.requires + ')');
}

linear.forEach((step) => assertStepShape(step, 'linear'));
surfaces.forEach((surface) => {
  model.surfaceHints(surface).forEach((step) => assertStepShape(step, surface + ' hint'));
});

// step() should normalize unknown values to safe defaults.
const normalized = model.step({id: 'x', advanceOn: 'bogus', placement: 'sideways', surface: 'nope'});
assert(normalized.advanceOn === 'next', 'unknown advanceOn should normalize to next');
assert(normalized.placement === 'auto', 'unknown placement should normalize to auto');
assert(normalized.surface === '', 'unknown surface should normalize to empty');

// State gating.
const gated = model.step({id: 'g', titleKey: 't', bodyKey: 'b', requires: 'project-loaded'});
assert(!model.isStepAvailable(gated, {projectLoaded: false}), 'project-loaded step should hide without a project');
assert(model.isStepAvailable(gated, {projectLoaded: true}), 'project-loaded step should show with a project');
assert(model.visibleSteps([gated], {projectLoaded: false}).length === 0,
  'visibleSteps should drop gated steps when state is unmet');

// --- i18n parity (keys present in the viewer catalog) ----------------------
['tour.next', 'tour.prev', 'tour.done', 'tour.skip', 'tour.learnMore',
  'topbar.guidedTour', 'topbar.surfaceHints', 'welcome.startTour', 'welcome.startTourHint',
  'tour.mascot.name',
  'tour.intro.recommend', 'tour.intro.title', 'tour.intro.body', 'tour.intro.start', 'tour.intro.later',
  'tour.ending.title', 'tour.ending.body', 'tour.ending.hints', 'tour.ending.close'].forEach((key) => {
  assert(i18nUi.includes("'" + key + "'"), 'guided tour chrome should localize ' + key);
});
model.referencedI18nKeys().forEach((key) => {
  assert(i18nUi.includes("'" + key + "'"), 'guided tour should localize step key ' + key);
});

// --- Anchor targets exist in the shell -------------------------------------
[
  'class="mode-switch"',
  'class="wordmark"',
  'id="mode-explore"',
  'id="mode-create"',
  'id="mode-install"',
  'id="install-runtime-preview"',
  'id="locale-select"',
  'id="topbar-more"',
  'id="explore-pane"',
  'data-view="events"',
  'id="create-pane"',
  'data-authoring-workspace-nav',
  'id="install-dry-run"',
  'id="install-diff-section"',
  'id="install-apply"',
  'id="install-allow-advanced"'
].forEach((token) => {
  assert(html.includes(token), 'shell should still provide guided tour anchor: ' + token);
});

// --- Shell wiring ----------------------------------------------------------
assert(html.includes('id="studio-open-guided-tour"'), 'More menu should expose a Guided Tour action');
assert(html.includes('id="studio-open-surface-hints"'), 'More menu should expose a Show hints action');
assert(html.includes('id="studio-guided-tour-root"'), 'viewer should include the guided tour mount point');
assert(html.includes('guided_tour_model.js'), 'viewer should load the guided tour model');
assert(html.includes('guided_tour_ui.js'), 'viewer should load the guided tour UI');
assert(welcomeUi.includes('id="welcome-start-tour"'), 'Welcome Hub should offer a guided tour launch button');
assert(welcomeUi.includes('startLinear') || welcomeUi.includes('open-guided-tour'),
  'Welcome Hub should hand off to the guided tour');
assert(welcomeUi.includes('welcome-tour-invite'), 'Welcome Hub should give the tour a prominent invite block');
assert(welcomeCss.includes('.welcome-surface.is-catalog-only .welcome-tour-invite'),
  'the tour invite should be hidden in the Template Hub (catalog-only) view, not just the full Welcome Hub');
assert(welcomeUi.includes('welcome.startTourHint'), 'Welcome Hub should show a newcomer hint next to the tour button');
assert(welcomeUi.includes('welcomeDismissed'), 'Welcome Hub should announce dismissal so the tour can offer a first run');

// --- UI module contract ----------------------------------------------------
assert(tourUi.includes('ProjectMapGuidedTour'), 'guided tour UI should expose a browser API');
['startLinear', 'startSurfaceHints', 'next', 'prev', 'stop', 'isRunning'].forEach((method) => {
  assert(typeof tourUiApi[method] === 'function', 'guided tour API should expose ' + method + '()');
});
assert(tourUi.includes("'Escape'"), 'guided tour should support Escape to exit');
assert(tourUi.includes('setMode'), 'guided tour should drive workspace switching via setMode');
assert(tourUi.includes('requestAnimationFrame'), 'guided tour should reposition on a frame boundary');
assert(tourUi.includes('prefersReducedMotion'), 'guided tour should respect reduced-motion');
// Phase 2 behaviours: anchor-aware hint filtering + first-visit auto-fire.
assert(tourUi.includes('anchorResolves'), 'hint mode should filter to steps whose anchor resolves');
assert(tourUi.includes('ProjectMap:mode-changed'), 'guided tour should auto-fire surface hints on a workspace change');
assert(tourUi.includes('hasSeenSurface'), 'auto-fire should respect a per-surface seen flag');
assert(tourUi.includes('isWelcomeOpen'), 'auto-fire should not stack on the Welcome Hub');
assert(tourUi.includes('isDocked'),
  'the docked (Home-inline) welcome must not count as an open dialog, or the first-run greeting never fires');
// Phase 3 behaviours: mascot, landing/ending curtain, first-run offer.
assert(tourUi.includes('guided-tour-mascot-face') && tourUi.includes('MASCOT_FACES'),
  'guided tour should render the kaomoji mascot face');
assert(tourUi.includes('stepFace'), 'the mascot expression should change per step so it is not frozen');
assert(tourUi.includes('MASCOT_FACES.hello') && tourUi.includes('MASCOT_FACES.bye'),
  'the fairy should wave hello on the intro and goodbye on the ending');
assert(tourUi.includes('guided-tour-curtain'), 'guided tour should build a landing/ending curtain');
assert(tourUi.includes("showCurtain('intro')"), 'startLinear should open on the intro curtain');
assert(tourUi.includes("showCurtain('ending')"), 'finishing the linear tour should show the ending curtain');
assert(tourUi.includes('completeTour'), 'guided tour should route the final step through completeTour');
assert(tourUi.includes('maybeOfferFirstRunIntro'), 'guided tour should offer a first-run intro');
assert(tourUi.includes('welcomeDismissed') || tourUi.includes('welcome-dismissed'),
  'guided tour should listen for Welcome Hub dismissal to offer the first-run intro');
assert(tourUi.includes('hasSeenLinear'), 'first-run offer should respect a seen flag so it never nags');
// First-run choreography (Option B, Home Hub era): the tour greets first on a
// fresh install, then hands off to Home — its overview onboarding face carries
// the old welcome content inline, so the landing routes to the Home pane
// instead of opening the retired auto-welcome modal.
assert(tourUi.includes('maybeGreetFirstRun') && tourUi.includes('isFreshFirstRun'),
  'the tour should greet first on a fresh install (onboarding + tour unseen)');
assert(tourUi.includes('finishHubLanding') && tourUi.includes('openWelcomeHub') && tourUi.includes('pendingHubLanding'),
  'ending or declining any linear tour should open the hub landing');
assert(tourUi.includes('openHome') || tourUi.includes('open-home'),
  'the first-run landing should reuse the Home open event');
assert(welcomeUi.includes('no longer auto-opens') && welcomeUi.includes('shouldAutoOpen'),
  'the welcome modal must not auto-open on first run (Home overview onboarding face owns the greeting) while keeping shouldAutoOpen for deliberate callers');
// The full-screen opening moment belongs to the version-ceremony splash now
// (opening_splash.js, checked separately); the tour defers its fresh-run
// greeting until the splash lifts, and manual replays open on the curtain.
assert(tourUi.includes('ProjectMapOpeningSplash') && tourUi.includes('opening-splash-done'),
  'the fresh-run greeting should wait for the opening splash to lift');
assert(!tourUi.includes('OPENING_EMOJI'),
  'the retired emoji flourish should not linger in the tour UI');

// --- Deep create hints reference real, dynamically-rendered anchors --------
const createHints = model.surfaceHints('create');
assert(createHints.length >= 5, 'create hints should cover canvas plus Object/UI editor regions');
[
  'data-object-canvas-title',
  'data-object-canvas-semantic-card',
  'data-preview-object-effect-row',
  'data-system-ui-supported-field'
].forEach((attr) => {
  const used = createHints.some((step) => step.anchor.indexOf(attr) !== -1 || step.fallbackAnchor.indexOf(attr) !== -1);
  assert(used, 'create hints should anchor on ' + attr);
  assert(dynamicAnchorSource.indexOf(attr) !== -1, 'editor source should still render the anchor attribute ' + attr);
});

// --- Styles ----------------------------------------------------------------
assert(tourCss.includes('.guided-tour-overlay'), 'guided tour styles should define the overlay');
assert(tourCss.includes('.guided-tour-spotlight'), 'guided tour styles should define the spotlight');
assert(tourCss.includes('box-shadow'), 'guided tour spotlight should dim via box-shadow');
assert(tourCss.includes('.guided-tour-curtain'), 'guided tour styles should define the landing/ending curtain');
assert(tourCss.includes('.guided-tour-mascot'), 'guided tour styles should define the mascot');
assert(tourCss.includes('guided-tour-wave'), 'guided tour styles should define the mascot wave');
assert(tourCss.includes('prefers-reduced-motion'), 'guided tour styles should respect reduced-motion');

// --- Fail-closed without a DOM ---------------------------------------------
assert(tourUiApi.isRunning() === false, 'guided tour should not report running without a DOM');
assert(tourUiApi.startLinear() === false || tourUiApi.startLinear() === undefined,
  'guided tour startLinear should fail closed without a DOM dialog');

process.stdout.write(JSON.stringify({
  ok: true,
  linearSteps: linear.length,
  surfaces: surfaces,
  i18nKeys: model.referencedI18nKeys().length
}, null, 2) + '\n');
