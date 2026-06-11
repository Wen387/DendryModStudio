(function initProjectMapGuidedTour(global) {
  'use strict';

  // Spotlight-style guided tour overlay. Reads its step data from
  // authoring/guided_tour_model.js and renders a dimmed backdrop with a bright
  // cut-out over the current anchor plus a guidance bubble. Two entry points:
  //   - startLinear():          the cross-surface orientation walkthrough.
  //   - startSurfaceHints(name): the per-surface "what's here" hint subset.
  // Phase 1 is modal (the backdrop captures clicks) and advances via the Next
  // button; click-through anchors are reserved for a later pass.

  function model() {
    if (global && global.ProjectMapGuidedTourModel) {
      return global.ProjectMapGuidedTourModel;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('../authoring/guided_tour_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function contracts() {
    if (global && global.ProjectMapStudioSharedConstants) {
      return global.ProjectMapStudioSharedConstants;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('../authoring/studio_shared_constants.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function eventName(key, fallback) {
    const api = contracts();
    return api && api.EVENT_NAMES && api.EVENT_NAMES[key] ? api.EVENT_NAMES[key] : fallback;
  }

  function storageKey(key, fallback) {
    const api = contracts();
    return api && api.STORAGE_KEYS && api.STORAGE_KEYS[key] ? api.STORAGE_KEYS[key] : fallback;
  }

  function shellNav() {
    return global && global.ProjectMapShellNavigation ? global.ProjectMapShellNavigation : null;
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function decorateIcons(root) {
    const i = global && global.ProjectMapIcons;
    if (i && typeof i.decorate === 'function' && root) {
      i.decorate(root);
    }
  }

  function prefersReducedMotion() {
    return Boolean(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function safeStorage() {
    try {
      return global && global.localStorage ? global.localStorage : null;
    } catch (_err) {
      return null;
    }
  }

  function markSeen(key) {
    const storage = safeStorage();
    if (!storage || typeof storage.setItem !== 'function') {
      return;
    }
    try {
      storage.setItem(key, '1');
    } catch (_err) {
      // best effort only
    }
  }

  // The tour's guide, "Tour Fairy" (導遊仙子), shown as kaomoji faces. Plain text
  // so they render in any font with no asset, no SVG, and no new dependency.
  // Different faces for different moments so it is not always the same look:
  //   hello — waving greeting on the intro curtain
  //   bye   — waving sign-off on the ending curtain
  //   step  — cycles per step in the spotlight bubble (eyes/gesture vary)
  // Containers are aria-hidden (decorative); the name is read from a label.
  const MASCOT_FACES = {
    idle: '(*・ω・)',
    hello: '(*・ω・)ﾉ',
    bye: '(*・ω・*)ﾉ',
    step: ['(*・ω・)', '(・ω・*)', '(*・ω・)b', '(*°ω°)', '(*・ω・)ﾉ']
  };

  function stepFace(index) {
    const list = MASCOT_FACES.step;
    return list[((index % list.length) + list.length) % list.length];
  }

  function mascotMarkup(face) {
    return '<span class="guided-tour-mascot-face">' + (face || MASCOT_FACES.idle) + '</span>';
  }

  // A warm full-screen flourish that washes across before the fairy greeting,
  // used when opening the orientation tour (and on the first-run offer). A wave
  // of plain emoji drifts across the background — no asset, no dependency.
  // Skipped under reduced-motion. Laid out as a grid so it reads as a tide.
  const OPENING_EMOJI = ['✨', '🗺️', '📖', '🌿', '⭐', '💡', '🎈', '🍀', '🪄', '💫', '🌸', '🎐'];
  const OPENING_ROWS = 5;
  const OPENING_COLS = 10;

  const state = {
    running: false,
    mode: 'linear',
    surface: '',
    steps: [],
    index: 0,
    els: null,
    rafId: 0,
    lastFocus: null,
    advanceHandler: null,
    advanceEventName: '',
    reposition: null,
    curtainEls: null,
    curtainKind: 'intro',
    curtainLastFocus: null,
    curtainSecondaryFn: null,
    curtainPrimaryFn: null,
    openingEl: null,
    openingActive: false,
    openingTimer: 0,
    openingDoneTimer: 0,
    // Armed when a linear tour's intro curtain shows: when that tour ends or is
    // declined we hand off to the Welcome Hub as the actionable landing.
    pendingHubLanding: false
  };

  const api = {
    startLinear: startLinear,
    startSurfaceHints: startSurfaceHints,
    next: next,
    prev: prev,
    stop: stop,
    isRunning: function isRunning() { return state.running; },
    currentStep: function currentStep() {
      return state.running ? state.steps[state.index] || null : null;
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapGuidedTour = api;
  }
  if (!global || !global.document) {
    return;
  }

  onReady(function () { start(global.document); });

  function onReady(callback) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function start(document) {
    wireMenu(document);
    document.addEventListener(eventName('openGuidedTour', 'ProjectMap:open-guided-tour'), function () {
      startLinear();
    });
    document.addEventListener(eventName('openSurfaceHints', 'ProjectMap:open-surface-hints'), function (event) {
      const detail = event && event.detail ? event.detail : {};
      startSurfaceHints(detail.surface || '');
    });
    document.addEventListener('project-map:locale-changed', function () {
      if (state.running) {
        renderStep();
      }
      if (isCurtainOpen()) {
        showCurtain(state.curtainKind);
      }
    });
    document.addEventListener('ProjectMap:mode-changed', onModeChanged);
    // When the Welcome Hub is dismissed without handing off elsewhere, offer the
    // orientation tour once. Deferred a beat so the dismissal settles first; the
    // offer is gated on a per-user "seen" flag so it never nags.
    document.addEventListener(eventName('welcomeDismissed', 'ProjectMap:welcome-dismissed'), function () {
      global.setTimeout(maybeOfferFirstRunIntro, 500);
    });
    // On a truly fresh install the tour is the warm first thing the user sees;
    // the Welcome Hub (a toolbox/board, not an intro) is deferred until the tour
    // ends or is declined, where it lands as the "what next" surface.
    maybeGreetFirstRun();
  }

  // The fresh-install greeting: only when neither onboarding nor the tour has
  // been seen. The Welcome Hub suppresses its own auto-open in this case
  // (guidedTourGreetsFirst), so we own the first impression here.
  function isFreshFirstRun() {
    const storage = safeStorage();
    if (!storage || typeof storage.getItem !== 'function') {
      return false;
    }
    try {
      const onboarding = storageKey('onboardingSeen', 'dendry-mod-studio-onboarding-seen');
      const tour = storageKey('guidedTourSeen', 'dendry-mod-studio-guided-tour-seen');
      return storage.getItem(onboarding) !== '1' && storage.getItem(tour) !== '1';
    } catch (_err) {
      return false;
    }
  }

  function maybeGreetFirstRun() {
    if (!isFreshFirstRun()) {
      return;
    }
    // A short beat so the shell paints before the flourish.
    global.setTimeout(function () {
      if (isWelcomeOpen() || state.running || isCurtainOpen() || state.openingActive || hasSeenLinear()) {
        return;
      }
      const started = openIntro();
      if (started === false) {
        // The tour could not start (no mount/model) — fall back to the hub so
        // the user is never stranded on a blank shell. (openIntro normally sets
        // the pending-landing flag itself once the intro curtain shows.)
        openWelcomeHub();
      }
    }, 400);
  }

  function openWelcomeHub() {
    if (!global || !global.document) {
      return;
    }
    // The Home overview onboarding face now carries the welcome content inline,
    // so the post-tour landing routes to Home instead of opening the old modal.
    global.document.dispatchEvent(new global.Event(eventName('openHome', 'ProjectMap:open-home')));
  }

  // The Welcome Hub is the actionable landing after any linear tour: when the
  // tour ends or is declined we open it (its Template Hub is how a user loads a
  // project). Armed when the intro curtain shows, so it covers both the
  // first-run greeting and manual replays from the menu, but never surface
  // hints. Choosing "Show hints" disarms it (a continuation, not an exit).
  function finishHubLanding() {
    if (!state.pendingHubLanding) {
      return;
    }
    state.pendingHubLanding = false;
    openWelcomeHub();
  }

  function wireMenu(document) {
    const tourButton = document.getElementById('studio-open-guided-tour');
    if (tourButton) {
      tourButton.addEventListener('click', function () {
        closeMoreMenu(document);
        startLinear();
      });
    }
    const hintsButton = document.getElementById('studio-open-surface-hints');
    if (hintsButton) {
      hintsButton.addEventListener('click', function () {
        closeMoreMenu(document);
        startSurfaceHints(currentMode());
      });
    }
  }

  function currentMode() {
    const body = global.document.body;
    return body && body.dataset && body.dataset.mode ? body.dataset.mode : 'explore';
  }

  function isWelcomeOpen() {
    const el = global.document.getElementById('studio-welcome');
    return Boolean(el && !el.classList.contains('hidden'));
  }

  function hasSeenSurface(surface) {
    const storage = safeStorage();
    if (!storage || typeof storage.getItem !== 'function') {
      return false;
    }
    try {
      const prefix = storageKey('surfaceHintsSeenPrefix', 'dendry-mod-studio-surface-hints-seen.');
      return storage.getItem(prefix + surface) === '1';
    } catch (_err) {
      return false;
    }
  }

  // Auto-fire a surface's hints the first time the user clicks into that
  // workspace, but only when there is content to point at and nothing else is
  // in the way. Marked seen up front so it never nags on later visits — the More
  // menu's "Show hints" can always bring it back on demand.
  function onModeChanged(event) {
    const detail = event && event.detail ? event.detail : {};
    if (detail.reason !== 'user' || state.running) {
      return;
    }
    const surface = detail.nextMode || '';
    const m = model();
    if (!m || !m.hasSurfaceHints(surface)) {
      return;
    }
    if (!tourState().projectLoaded || isWelcomeOpen() || hasSeenSurface(surface)) {
      return;
    }
    const prefix = storageKey('surfaceHintsSeenPrefix', 'dendry-mod-studio-surface-hints-seen.');
    markSeen(prefix + surface);
    startSurfaceHints(surface);
  }

  function anchorResolves(stepItem) {
    if (!stepItem) {
      return false;
    }
    if (!stepItem.anchor) {
      return true;
    }
    let el = safeQuery(stepItem.anchor);
    if (!el && stepItem.fallbackAnchor) {
      el = safeQuery(stepItem.fallbackAnchor);
    }
    return isVisible(el);
  }

  function closeMoreMenu(document) {
    const more = document.getElementById('topbar-more');
    if (more) {
      more.open = false;
    }
  }

  function startLinear() {
    const m = model();
    if (!m) {
      return false;
    }
    if (!global || !global.document) {
      return false;
    }
    // A full-screen welcome flourish (emoji streak + warm wash), then the fairy
    // greeting curtain — instead of dropping straight into the spotlight.
    return openIntro();
  }

  function openIntro() {
    return playOpening(function () { showCurtain('intro'); });
  }

  function beginLinearSteps() {
    const m = model();
    if (!m) {
      return false;
    }
    return run('linear', '', m.linearTour());
  }

  function startSurfaceHints(surface) {
    const m = model();
    if (!m) {
      return false;
    }
    const name = String(surface || '');
    if (!m.hasSurfaceHints(name)) {
      return false;
    }
    return run('hints', name, m.surfaceHints(name));
  }

  function tourState() {
    const nav = shellNav();
    const index = nav && typeof nav.getProjectIndex === 'function' ? nav.getProjectIndex() : null;
    return {projectLoaded: Boolean(index)};
  }

  function run(mode, surface, rawSteps) {
    if (!global || !global.document) {
      return false;
    }
    const m = model();
    let steps = m ? m.visibleSteps(rawSteps, tourState()) : rawSteps;
    // In hint mode the dataset blends always-present chrome with steps that only
    // exist once the user opens the Object Editor / UI Editor. Show only the
    // steps whose anchor currently resolves, so the same group adapts to what is
    // actually on screen ("you act, then it speaks").
    if (mode === 'hints') {
      steps = (steps || []).filter(anchorResolves);
    }
    if (!steps || steps.length === 0) {
      return false;
    }
    if (state.running) {
      teardownStepListeners();
    }
    ensureOverlay(global.document);
    if (!state.els) {
      return false;
    }
    state.running = true;
    state.mode = mode;
    state.surface = surface;
    state.steps = steps;
    state.index = 0;
    state.lastFocus = global.document.activeElement;
    state.els.overlay.classList.remove('hidden');
    // One-shot entrance so the dim and bubble ease in rather than snap. Removed
    // shortly after so it does not replay on every reposition. Skipped under
    // reduced-motion (the stylesheet also disables the animation there).
    if (!prefersReducedMotion()) {
      state.els.overlay.classList.add('guided-tour-overlay--entering');
      global.setTimeout(function () {
        if (state.els) {
          state.els.overlay.classList.remove('guided-tour-overlay--entering');
        }
      }, 380);
    }
    bindWindowListeners();
    renderStep();
    return true;
  }

  function ensureOverlay(document) {
    if (state.els) {
      return;
    }
    const mount = document.getElementById('studio-guided-tour-root') || document.body;
    if (!mount) {
      return;
    }
    const overlay = document.createElement('div');
    overlay.id = 'studio-guided-tour';
    overlay.className = 'guided-tour-overlay hidden';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'guided-tour-title');

    const spotlight = document.createElement('div');
    spotlight.className = 'guided-tour-spotlight';
    spotlight.setAttribute('aria-hidden', 'true');

    const bubble = document.createElement('div');
    bubble.className = 'guided-tour-bubble';

    bubble.innerHTML = [
      '<div class="guided-tour-mascot guided-tour-mascot--corner" aria-hidden="true">' + mascotMarkup(MASCOT_FACES.idle) + '</div>',
      '<div class="guided-tour-progress" data-guided-tour-progress aria-hidden="true"></div>',
      '<h2 id="guided-tour-title" class="guided-tour-title" data-guided-tour-title></h2>',
      '<p class="guided-tour-body" data-guided-tour-body></p>',
      '<div class="guided-tour-learn-more">',
      '  <button type="button" class="guided-tour-learn-more-button" data-guided-tour-learn hidden>',
      '    <span data-ui-icon="book"></span>',
      '    <span data-i18n="tour.learnMore">Learn more</span>',
      '  </button>',
      '</div>',
      '<div class="guided-tour-actions">',
      '  <button type="button" class="guided-tour-skip" data-guided-tour-skip>',
      '    <span data-i18n="tour.skip">Skip tour</span>',
      '  </button>',
      '  <div class="guided-tour-actions-right">',
      '    <button type="button" class="guided-tour-prev" data-guided-tour-prev>',
      '      <span data-i18n="tour.prev">Back</span>',
      '    </button>',
      '    <button type="button" class="primary-action guided-tour-next" data-guided-tour-next>',
      '      <span data-guided-tour-next-label></span>',
      '    </button>',
      '  </div>',
      '</div>'
    ].join('');

    overlay.appendChild(spotlight);
    overlay.appendChild(bubble);
    mount.appendChild(overlay);

    state.els = {
      overlay: overlay,
      spotlight: spotlight,
      bubble: bubble,
      mascotFace: bubble.querySelector('.guided-tour-mascot-face'),
      progress: bubble.querySelector('[data-guided-tour-progress]'),
      title: bubble.querySelector('[data-guided-tour-title]'),
      body: bubble.querySelector('[data-guided-tour-body]'),
      learn: bubble.querySelector('[data-guided-tour-learn]'),
      skip: bubble.querySelector('[data-guided-tour-skip]'),
      prev: bubble.querySelector('[data-guided-tour-prev]'),
      next: bubble.querySelector('[data-guided-tour-next]'),
      nextLabel: bubble.querySelector('[data-guided-tour-next-label]')
    };

    state.els.skip.addEventListener('click', function () { stop(true); finishHubLanding(); });
    state.els.prev.addEventListener('click', function () { prev(); });
    state.els.next.addEventListener('click', function () { next(); });
    state.els.learn.addEventListener('click', openLearnMore);
    overlay.addEventListener('keydown', onOverlayKeydown);
    // Capture clicks on the dim so the page behind is not triggered by accident,
    // but never advance from a stray backdrop click.
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        event.stopPropagation();
      }
    });
  }

  function bindWindowListeners() {
    if (state.reposition) {
      return;
    }
    state.reposition = function () {
      if (state.rafId) {
        global.cancelAnimationFrame(state.rafId);
      }
      state.rafId = global.requestAnimationFrame(function () {
        state.rafId = 0;
        layoutStep();
      });
    };
    global.addEventListener('resize', state.reposition, true);
    global.addEventListener('scroll', state.reposition, true);
  }

  function unbindWindowListeners() {
    if (!state.reposition) {
      return;
    }
    global.removeEventListener('resize', state.reposition, true);
    global.removeEventListener('scroll', state.reposition, true);
    state.reposition = null;
    if (state.rafId) {
      global.cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
  }

  function step() {
    return state.steps[state.index] || null;
  }

  function renderStep() {
    const current = step();
    if (!current || !state.els) {
      return;
    }
    switchSurface(current.surface);
    teardownStepListeners();

    state.els.title.textContent = t(current.titleKey, current.titleFallback);
    state.els.body.textContent = t(current.bodyKey, current.bodyFallback);
    state.els.progress.textContent = (state.index + 1) + ' / ' + state.steps.length;
    // The fairy's expression changes as you progress, so it never looks frozen.
    if (state.els.mascotFace) {
      state.els.mascotFace.textContent = stepFace(state.index);
    }

    const isLast = state.index === state.steps.length - 1;
    state.els.nextLabel.textContent = isLast
      ? t('tour.done', 'Done')
      : t('tour.next', 'Next');
    state.els.prev.hidden = state.index === 0;

    if (current.tutorialArticle) {
      state.els.learn.hidden = false;
      state.els.learn.setAttribute('data-tutorial-article', current.tutorialArticle);
    } else {
      state.els.learn.hidden = true;
      state.els.learn.removeAttribute('data-tutorial-article');
    }

    if (global.ProjectMapI18n && typeof global.ProjectMapI18n.applyTranslations === 'function') {
      global.ProjectMapI18n.applyTranslations(state.els.bubble);
    }
    decorateIcons(state.els.bubble);

    // Scroll the anchor into view, then position. Lay out synchronously first so
    // the spotlight is correct even when requestAnimationFrame is throttled (for
    // example when the window is backgrounded as the tour starts); refine once
    // more on the next frame after a smooth scroll settles.
    const anchor = resolveAnchor(current);
    if (anchor && typeof anchor.scrollIntoView === 'function') {
      anchor.scrollIntoView({
        block: 'center',
        inline: 'center',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
      });
    }
    layoutStep();
    focusBubble();
    global.requestAnimationFrame(function () {
      layoutStep();
    });

    setupStepListeners(current);
  }

  function switchSurface(surface) {
    if (!surface) {
      return;
    }
    const nav = shellNav();
    if (nav && typeof nav.setMode === 'function') {
      nav.setMode(surface, {reason: 'guided-tour'});
    }
  }

  function resolveAnchor(current) {
    if (!current || !current.anchor) {
      return null;
    }
    let anchor = safeQuery(current.anchor);
    if (!anchor && current.fallbackAnchor) {
      anchor = safeQuery(current.fallbackAnchor);
    }
    return isVisible(anchor) ? anchor : null;
  }

  function safeQuery(selector) {
    try {
      return global.document.querySelector(selector);
    } catch (_err) {
      return null;
    }
  }

  function isVisible(element) {
    if (!element) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) {
      return false;
    }
    if (element.closest && element.closest('[hidden], .hidden')) {
      return false;
    }
    return true;
  }

  function layoutStep() {
    const current = step();
    if (!current || !state.els) {
      return;
    }
    const anchor = resolveAnchor(current);
    if (!anchor) {
      placeAnchorless();
      return;
    }
    const rect = anchor.getBoundingClientRect();
    placeSpotlight(rect);
    placeBubble(rect, current.placement);
  }

  function placeSpotlight(rect) {
    const pad = 6;
    const s = state.els.spotlight.style;
    s.display = 'block';
    s.left = Math.max(0, rect.left - pad) + 'px';
    s.top = Math.max(0, rect.top - pad) + 'px';
    s.width = (rect.width + pad * 2) + 'px';
    s.height = (rect.height + pad * 2) + 'px';
  }

  function placeAnchorless() {
    state.els.spotlight.style.display = 'none';
    const bubble = state.els.bubble;
    bubble.classList.add('is-centered');
    bubble.style.left = '';
    bubble.style.top = '';
  }

  function placeBubble(rect, placement) {
    const bubble = state.els.bubble;
    bubble.classList.remove('is-centered');
    const gap = 14;
    const margin = 12;
    const vw = global.innerWidth || global.document.documentElement.clientWidth;
    const vh = global.innerHeight || global.document.documentElement.clientHeight;
    const bw = bubble.offsetWidth || 320;
    const bh = bubble.offsetHeight || 160;

    let where = placement && placement !== 'auto' ? placement : 'bottom';
    if (where === 'bottom' && rect.bottom + gap + bh > vh) {
      where = rect.top - gap - bh > 0 ? 'top' : 'bottom';
    } else if (where === 'top' && rect.top - gap - bh < 0) {
      where = 'bottom';
    }

    let left;
    let top;
    if (where === 'left' || where === 'right') {
      top = rect.top + (rect.height - bh) / 2;
      left = where === 'left' ? rect.left - gap - bw : rect.right + gap;
      if (where === 'right' && left + bw + margin > vw) {
        left = rect.left - gap - bw;
      }
      if (where === 'left' && left < margin) {
        left = rect.right + gap;
      }
    } else {
      left = rect.left + (rect.width - bw) / 2;
      top = where === 'top' ? rect.top - gap - bh : rect.bottom + gap;
    }

    left = clamp(left, margin, Math.max(margin, vw - bw - margin));
    top = clamp(top, margin, Math.max(margin, vh - bh - margin));
    bubble.style.left = Math.round(left) + 'px';
    bubble.style.top = Math.round(top) + 'px';
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function focusBubble() {
    if (!state.els) {
      return;
    }
    const target = state.els.next && !state.els.next.disabled ? state.els.next : state.els.skip;
    if (target && typeof target.focus === 'function') {
      target.focus();
    }
  }

  function setupStepListeners(current) {
    if (current.advanceOn === 'event' && current.advanceEvent) {
      state.advanceEventName = current.advanceEvent;
      state.advanceHandler = function () { next(); };
      global.document.addEventListener(current.advanceEvent, state.advanceHandler, {once: true});
    }
  }

  function teardownStepListeners() {
    if (state.advanceHandler && state.advanceEventName) {
      global.document.removeEventListener(state.advanceEventName, state.advanceHandler);
    }
    state.advanceHandler = null;
    state.advanceEventName = '';
  }

  function next() {
    if (!state.running) {
      return;
    }
    if (state.index >= state.steps.length - 1) {
      completeTour();
      return;
    }
    state.index += 1;
    renderStep();
  }

  function completeTour() {
    const wasLinear = state.mode === 'linear';
    stop(true);
    // The linear orientation ends on a warm sign-off curtain; per-surface hints
    // just close quietly.
    if (wasLinear) {
      showCurtain('ending');
    }
  }

  function prev() {
    if (!state.running || state.index === 0) {
      return;
    }
    state.index -= 1;
    renderStep();
  }

  function stop(completed) {
    if (!state.running) {
      return;
    }
    teardownStepListeners();
    unbindWindowListeners();
    state.running = false;
    if (state.els) {
      state.els.overlay.classList.add('hidden');
      state.els.spotlight.style.display = 'none';
    }
    if (completed) {
      recordSeen();
    }
    restoreFocus();
  }

  function recordSeen() {
    if (state.mode === 'linear') {
      markSeen(storageKey('guidedTourSeen', 'dendry-mod-studio-guided-tour-seen'));
    } else if (state.mode === 'hints' && state.surface) {
      const prefix = storageKey('surfaceHintsSeenPrefix', 'dendry-mod-studio-surface-hints-seen.');
      markSeen(prefix + state.surface);
    }
  }

  function restoreFocus() {
    const last = state.lastFocus;
    state.lastFocus = null;
    if (last && typeof last.focus === 'function' && global.document.contains(last)) {
      last.focus();
    }
  }

  function openLearnMore() {
    const current = step();
    if (!current || !current.tutorialArticle) {
      return;
    }
    const articleId = current.tutorialArticle;
    stop(true);
    const library = global.ProjectMapTutorialLibrary;
    if (library && typeof library.open === 'function') {
      library.open(articleId);
    }
  }

  function onOverlayKeydown(event) {
    if (!state.running) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      stop(false);
      finishHubLanding();
      return;
    }
    if (event.key === 'Tab') {
      trapTab(event);
    }
  }

  function trapTab(event) {
    const focusable = state.els.bubble.querySelectorAll(
      'button:not([hidden]):not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && global.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && global.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // --- Landing / ending curtain ---------------------------------------------
  // A friendly full-screen card (the mascot greeting) shown before the linear
  // tour begins and after it finishes. Built lazily into the same mount as the
  // spotlight overlay, so it never touches the page chrome.

  function ensureCurtain(document) {
    if (state.curtainEls) {
      return;
    }
    const mount = document.getElementById('studio-guided-tour-root') || document.body;
    if (!mount) {
      return;
    }
    const curtain = document.createElement('div');
    curtain.className = 'guided-tour-curtain hidden';
    curtain.setAttribute('role', 'dialog');
    curtain.setAttribute('aria-modal', 'true');
    curtain.setAttribute('aria-labelledby', 'guided-tour-curtain-title');
    curtain.innerHTML = [
      '<div class="guided-tour-curtain-backdrop" aria-hidden="true"></div>',
      '<div class="guided-tour-curtain-card">',
      '  <div class="guided-tour-mascot guided-tour-mascot--hero" aria-hidden="true">' + mascotMarkup(MASCOT_FACES.hello) + '</div>',
      '  <div class="guided-tour-mascot-name" data-i18n="tour.mascot.name"></div>',
      '  <p class="guided-tour-curtain-recommend" data-guided-tour-curtain-recommend></p>',
      '  <h2 id="guided-tour-curtain-title" class="guided-tour-curtain-title" data-guided-tour-curtain-title></h2>',
      '  <p class="guided-tour-curtain-body" data-guided-tour-curtain-body></p>',
      '  <div class="guided-tour-curtain-actions">',
      '    <button type="button" class="guided-tour-curtain-secondary" data-guided-tour-curtain-secondary></button>',
      '    <button type="button" class="primary-action guided-tour-curtain-primary" data-guided-tour-curtain-primary></button>',
      '  </div>',
      '  <button type="button" class="guided-tour-curtain-extra" data-guided-tour-curtain-extra hidden></button>',
      '</div>'
    ].join('');
    mount.appendChild(curtain);
    state.curtainEls = {
      curtain: curtain,
      card: curtain.querySelector('.guided-tour-curtain-card'),
      heroFace: curtain.querySelector('.guided-tour-mascot--hero .guided-tour-mascot-face'),
      recommend: curtain.querySelector('[data-guided-tour-curtain-recommend]'),
      title: curtain.querySelector('[data-guided-tour-curtain-title]'),
      body: curtain.querySelector('[data-guided-tour-curtain-body]'),
      secondary: curtain.querySelector('[data-guided-tour-curtain-secondary]'),
      primary: curtain.querySelector('[data-guided-tour-curtain-primary]'),
      extra: curtain.querySelector('[data-guided-tour-curtain-extra]')
    };
    state.curtainEls.extra.addEventListener('click', onCurtainExtra);
    curtain.addEventListener('keydown', onCurtainKeydown);
    curtain.addEventListener('click', function (event) {
      const target = event.target;
      if (target === curtain || (target.classList && target.classList.contains('guided-tour-curtain-backdrop'))) {
        dismissCurtain();
      }
    });
  }

  function showCurtain(kind) {
    if (!global || !global.document) {
      return false;
    }
    ensureCurtain(global.document);
    if (!state.curtainEls) {
      return false;
    }
    const els = state.curtainEls;
    state.curtainKind = kind === 'ending' ? 'ending' : 'intro';
    if (state.curtainEls.heroFace) {
      // Wave hello on the way in, wave goodbye on the way out.
      state.curtainEls.heroFace.textContent =
        state.curtainKind === 'ending' ? MASCOT_FACES.bye : MASCOT_FACES.hello;
    }
    if (!isCurtainOpen()) {
      state.curtainLastFocus = global.document.activeElement;
    }
    if (global.ProjectMapI18n && typeof global.ProjectMapI18n.applyTranslations === 'function') {
      global.ProjectMapI18n.applyTranslations(els.card);
    }
    if (state.curtainKind === 'intro') {
      // A linear tour is beginning — arm the Welcome Hub landing for whenever it
      // ends or is declined (covers both first-run and manual replays).
      state.pendingHubLanding = true;
      els.recommend.hidden = false;
      els.recommend.textContent = t('tour.intro.recommend', '');
      els.title.textContent = t('tour.intro.title', 'Shall we look around together?');
      els.body.textContent = t('tour.intro.body', '');
      els.secondary.textContent = t('tour.intro.later', 'Maybe later');
      els.primary.textContent = t('tour.intro.start', "Let's go");
      els.extra.hidden = true;
      setCurtainActions(
        function onLater() { markSeenLinear(); closeCurtain(); finishHubLanding(); },
        function onStart() { state.curtainLastFocus = null; closeCurtain(); beginLinearSteps(); }
      );
    } else {
      els.recommend.hidden = true;
      els.recommend.textContent = '';
      els.title.textContent = t('tour.ending.title', 'That is the lay of the land');
      els.body.textContent = t('tour.ending.body', '');
      els.secondary.textContent = t('tour.ending.hints', 'Show hints as I go');
      els.primary.textContent = t('tour.ending.close', 'Start exploring');
      els.extra.hidden = false;
      els.extra.textContent = t('quest.intro.title', 'Want to try it hands-on?');
      setCurtainActions(
        function onHints() {
          // The user chose to keep going with hints — a continuation, not an
          // exit, so disarm the hub landing without popping it.
          state.pendingHubLanding = false;
          state.curtainLastFocus = null;
          closeCurtain();
          startSurfaceHints(currentMode());
        },
        function onClose() { closeCurtain(); finishHubLanding(); }
      );
      // Reaching the sign-off counts as having seen the orientation tour.
      markSeenLinear();
    }
    decorateIcons(els.card);
    els.curtain.classList.remove('hidden');
    requestCurtainEnter(els.curtain);
    if (els.primary && typeof els.primary.focus === 'function') {
      els.primary.focus();
    }
    return true;
  }

  function setCurtainActions(secondaryFn, primaryFn) {
    const els = state.curtainEls;
    if (!els) {
      return;
    }
    if (state.curtainSecondaryFn) {
      els.secondary.removeEventListener('click', state.curtainSecondaryFn);
    }
    if (state.curtainPrimaryFn) {
      els.primary.removeEventListener('click', state.curtainPrimaryFn);
    }
    state.curtainSecondaryFn = secondaryFn;
    state.curtainPrimaryFn = primaryFn;
    els.secondary.addEventListener('click', secondaryFn);
    els.primary.addEventListener('click', primaryFn);
  }

  function requestCurtainEnter(curtain) {
    if (prefersReducedMotion()) {
      curtain.classList.add('is-open');
      return;
    }
    global.requestAnimationFrame(function () {
      curtain.classList.add('is-open');
    });
  }

  function closeCurtain() {
    const els = state.curtainEls;
    if (!els) {
      return;
    }
    els.curtain.classList.remove('is-open');
    const finish = function () { els.curtain.classList.add('hidden'); };
    if (prefersReducedMotion()) {
      finish();
    } else {
      global.setTimeout(finish, 220);
    }
    restoreCurtainFocus();
  }

  function dismissCurtain() {
    if (state.curtainKind === 'intro') {
      markSeenLinear();
    }
    closeCurtain();
    finishHubLanding();
  }

  // The "try it hands-on" invite on the ending curtain hands off to the loose
  // first-proposal quest. That is a continuation of the tour, not an exit, so we
  // disarm the Welcome Hub landing without popping it (mirrors the hints choice).
  function onCurtainExtra() {
    state.pendingHubLanding = false;
    state.curtainLastFocus = null;
    closeCurtain();
    launchFirstProposalQuest();
  }

  function launchFirstProposalQuest() {
    if (global.ProjectMapFirstProposalQuest &&
        typeof global.ProjectMapFirstProposalQuest.open === 'function') {
      global.ProjectMapFirstProposalQuest.open();
      return;
    }
    global.document.dispatchEvent(
      new global.Event(eventName('openFirstProposalQuest', 'ProjectMap:open-first-proposal-quest')));
  }

  function isCurtainOpen() {
    return Boolean(state.curtainEls && !state.curtainEls.curtain.classList.contains('hidden'));
  }

  function onCurtainKeydown(event) {
    if (!isCurtainOpen()) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      dismissCurtain();
      return;
    }
    if (event.key === 'Tab') {
      trapCurtainTab(event);
    }
  }

  function trapCurtainTab(event) {
    const focusable = state.curtainEls.card.querySelectorAll('button:not([hidden]):not([disabled])');
    if (!focusable.length) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && global.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && global.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function restoreCurtainFocus() {
    const last = state.curtainLastFocus;
    state.curtainLastFocus = null;
    if (last && typeof last.focus === 'function' && global.document.contains(last)) {
      last.focus();
    }
  }

  // First-run offer: the orientation tour, shown once after the Welcome Hub is
  // dismissed. Gated so it never stacks on the Welcome Hub or an active tour,
  // and never reappears once seen.
  function maybeOfferFirstRunIntro() {
    if (state.running || state.openingActive || isCurtainOpen() || isWelcomeOpen()) {
      return;
    }
    if (hasSeenLinear()) {
      return;
    }
    // The first run gets the full welcome flourish too — this is meant to feel
    // warmer than landing on a plain page.
    openIntro();
  }

  // --- Opening flourish -----------------------------------------------------
  // A brief full-screen layer: emoji streak diagonally across over a warm wash,
  // and the fairy greeting curtain rises in while they are still clearing.

  function ensureOpeningLayer(document) {
    if (state.openingEl) {
      return;
    }
    const mount = document.getElementById('studio-guided-tour-root') || document.body;
    if (!mount) {
      return;
    }
    const layer = document.createElement('div');
    layer.id = 'studio-guided-tour-opening';
    layer.className = 'guided-tour-opening hidden';
    layer.setAttribute('aria-hidden', 'true');
    mount.appendChild(layer);
    state.openingEl = layer;
  }

  function buildOpeningMarkup() {
    const wash = '<div class="guided-tour-opening-wash"></div>';
    // A full grid of emoji so it reads as a tide washing across the background
    // rather than a thin line. Delay is mostly column-driven (a left-to-right
    // sweep) with a small per-row offset so the front edge is staggered, not a
    // rigid wall. The CSS streak runs ~2s; the latest cell starts ~1.1s in, so
    // the whole wave clears around 3.1s — before playOpening tears the layer
    // down, which is what stops it from vanishing mid-screen.
    const cells = [];
    let n = 0;
    for (let row = 0; row < OPENING_ROWS; row += 1) {
      for (let col = 0; col < OPENING_COLS; col += 1) {
        const glyph = OPENING_EMOJI[n % OPENING_EMOJI.length];
        const top = ((row + 0.5) / OPENING_ROWS) * 92 + (col % 2 ? -3.2 : 3.2);
        const size = 24 + ((n * 5) % 20);
        const delay = (col * 0.11 + row * 0.04).toFixed(2);
        cells.push('<span class="guided-tour-opening-emoji" style="top:' + top.toFixed(1) +
          '%;font-size:' + size + 'px;animation-delay:' + delay + 's">' + glyph + '</span>');
        n += 1;
      }
    }
    return wash + cells.join('');
  }

  function playOpening(onDone) {
    if (prefersReducedMotion() || !global || !global.document) {
      return onDone();
    }
    if (state.openingActive) {
      return true;
    }
    ensureOpeningLayer(global.document);
    if (!state.openingEl) {
      return onDone();
    }
    const layer = state.openingEl;
    layer.innerHTML = buildOpeningMarkup();
    layer.classList.remove('hidden');
    state.openingActive = true;
    if (state.openingDoneTimer) { global.clearTimeout(state.openingDoneTimer); }
    if (state.openingTimer) { global.clearTimeout(state.openingTimer); }
    // Bring the fairy greeting in as the wave is exiting (most cells past
    // center, only the rightmost columns still clearing), then tear the layer
    // down once every cell has finished its ~2s streak. Keeping teardown after
    // the last cell finishes is what fixes the "vanishes mid-screen" bug.
    state.openingDoneTimer = global.setTimeout(function () {
      state.openingActive = false;
      onDone();
    }, 2800);
    state.openingTimer = global.setTimeout(function () {
      if (state.openingEl) {
        state.openingEl.classList.add('hidden');
        state.openingEl.innerHTML = '';
      }
    }, 3500);
    return true;
  }

  function hasSeenLinear() {
    const storage = safeStorage();
    if (!storage || typeof storage.getItem !== 'function') {
      return false;
    }
    try {
      return storage.getItem(storageKey('guidedTourSeen', 'dendry-mod-studio-guided-tour-seen')) === '1';
    } catch (_err) {
      return false;
    }
  }

  function markSeenLinear() {
    markSeen(storageKey('guidedTourSeen', 'dendry-mod-studio-guided-tour-seen'));
  }
})(typeof window !== 'undefined' ? window : globalThis);
