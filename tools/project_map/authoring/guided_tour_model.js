(function initProjectMapGuidedTourModel(global) {
  'use strict';

  // Pure data + sequencing logic for the guided tour. No DOM access lives here:
  // viewer/guided_tour_ui.js renders the spotlight overlay and drives playback.
  //
  // One dataset, two playback modes:
  //   - linearTour(): a curated cross-surface "lay of the land" walkthrough for
  //     first-time / low-confidence users (the basic safety net).
  //   - surfaceHints(surface): the per-surface "show me what's here" subset that
  //     can fire on first visit or be re-opened on demand, so a user does not
  //     miss a feature that actually fits their need.
  //
  // Every step is normalized to one uniform shape via step() so consumers never
  // have to guess which optional fields exist. anchor is a CSS selector the UI
  // spotlights; an empty anchor means a centered, anchorless message card.

  const ADVANCE_MODES = ['next', 'click-anchor', 'event'];
  const PLACEMENTS = ['auto', 'top', 'bottom', 'left', 'right'];
  // 'home' is a valid step surface (the linear tour visits the Home pane) but
  // deliberately has no per-surface hint subset: Home is self-describing chrome.
  const SURFACES = ['explore', 'create', 'install', 'home'];

  function asString(value) {
    return value === undefined || value === null ? '' : String(value);
  }

  function normalizeAdvance(value) {
    const mode = asString(value);
    return ADVANCE_MODES.indexOf(mode) === -1 ? 'next' : mode;
  }

  function normalizePlacement(value) {
    const placement = asString(value) || 'auto';
    return PLACEMENTS.indexOf(placement) === -1 ? 'auto' : placement;
  }

  function normalizeSurface(value) {
    const surface = asString(value);
    return SURFACES.indexOf(surface) === -1 ? '' : surface;
  }

  function step(spec) {
    const source = spec || {};
    return {
      id: asString(source.id),
      // Workspace to switch to before showing this step ('' = leave current).
      surface: normalizeSurface(source.surface),
      // CSS selector for the spotlight target ('' = centered message card).
      anchor: asString(source.anchor),
      // Optional second selector tried when the primary anchor is absent.
      fallbackAnchor: asString(source.fallbackAnchor),
      titleKey: asString(source.titleKey),
      titleFallback: asString(source.titleFallback),
      bodyKey: asString(source.bodyKey),
      bodyFallback: asString(source.bodyFallback),
      // How the step advances: a Next click, clicking the anchor itself, or a
      // document event (advanceEvent) so the tour can wait for the user to act.
      advanceOn: normalizeAdvance(source.advanceOn),
      advanceEvent: asString(source.advanceEvent),
      placement: normalizePlacement(source.placement),
      // Gate: '' = always shown, 'project-loaded' = only when an index is loaded.
      requires: asString(source.requires),
      // Optional Tutorial Library article id for a "learn more" deep link.
      tutorialArticle: asString(source.tutorialArticle)
    };
  }

  // Cross-surface orientation walkthrough. Anchors are top-level chrome that is
  // always present regardless of whether a project is loaded, so this tour never
  // lands on a missing element. Each step switches to the surface it describes.
  const LINEAR_TOUR = [
    step({
      id: 'intro',
      anchor: '.mode-switch',
      titleKey: 'tour.linear.intro.title',
      titleFallback: 'Welcome — a quick lay of the land',
      bodyKey: 'tour.linear.intro.body',
      bodyFallback: 'Studio has a few workspaces along the top. This short tour points out what each one is for. You can leave any time with Esc.',
      advanceOn: 'next',
      placement: 'bottom'
    }),
    step({
      // The tour begins where a fresh install lands: Home. Introducing it
      // before touring the workspaces closes the gap where the tour used to
      // end by dropping the user onto a pane it had never explained.
      id: 'home',
      surface: 'home',
      anchor: '.wordmark',
      titleKey: 'tour.linear.home.title',
      titleFallback: 'Home — your home base',
      bodyKey: 'tour.linear.home.body',
      bodyFallback: 'This is Home: announcements, templates, publishing, and what changed in each version all gather here. Click the Dendry Mod Studio wordmark in the corner any time to come back.',
      advanceOn: 'next',
      placement: 'bottom'
    }),
    step({
      id: 'explore',
      surface: 'explore',
      anchor: '#mode-explore',
      titleKey: 'tour.linear.explore.title',
      titleFallback: 'Explore — find content',
      bodyKey: 'tour.linear.explore.body',
      bodyFallback: 'Explore is where you search and browse what is in the project: scenes, events, cards, variables, and more. It is the usual starting point when you want to change something.',
      advanceOn: 'next',
      placement: 'bottom',
      tutorialArticle: 'workspaces'
    }),
    step({
      id: 'create',
      surface: 'create',
      anchor: '#mode-create',
      titleKey: 'tour.linear.create.title',
      titleFallback: 'Create — make your edits',
      bodyKey: 'tour.linear.create.body',
      bodyFallback: 'Create is the editing workspace. Whatever you change here becomes a draft proposal — your real game files are not touched until you choose to apply later.',
      advanceOn: 'next',
      placement: 'bottom',
      tutorialArticle: 'create-editor'
    }),
    step({
      id: 'install',
      surface: 'install',
      anchor: '#mode-install',
      titleKey: 'tour.linear.install.title',
      titleFallback: 'Install — check, then apply',
      bodyKey: 'tour.linear.install.body',
      bodyFallback: 'Install is where a proposal becomes a real change. Until you apply, your real files stay untouched — every edit waits as a draft. The order is always check first, apply second: read the diff, confirm the scope, then apply. Studio backs up what it replaces, so a change can be undone.',
      advanceOn: 'next',
      placement: 'bottom',
      tutorialArticle: 'install-flow'
    }),
    step({
      id: 'preview',
      surface: 'install',
      anchor: '#install-runtime-preview',
      fallbackAnchor: '#mode-install',
      titleKey: 'tour.linear.preview.title',
      titleFallback: 'See your change actually run',
      bodyKey: 'tour.linear.preview.body',
      bodyFallback: 'Runtime Preview plays a proposal in a sandbox so you can watch how it behaves before it touches anything — a safe way to sanity-check a change without leaving Studio.',
      advanceOn: 'next',
      placement: 'top',
      tutorialArticle: 'install-flow'
    }),
    step({
      id: 'mode',
      surface: 'explore',
      anchor: '',
      titleKey: 'tour.linear.mode.title',
      titleFallback: 'Desktop app vs the browser',
      bodyKey: 'tour.linear.mode.body',
      bodyFallback: 'In the browser you can browse and review freely. The verified diff, applying changes, and Runtime Preview need the desktop app, which can reach your project files directly. If a button looks unavailable, that is usually why.',
      advanceOn: 'next',
      placement: 'auto'
    }),
    step({
      id: 'language',
      surface: 'explore',
      anchor: '#locale-select',
      fallbackAnchor: '.topbar-locale-switch',
      titleKey: 'tour.linear.language.title',
      titleFallback: 'Switch language any time',
      bodyKey: 'tour.linear.language.body',
      bodyFallback: 'Prefer another language? This switch in the top bar changes the whole interface between English and Traditional Chinese. Auto follows your system setting.',
      advanceOn: 'next',
      placement: 'bottom'
    }),
    step({
      id: 'more',
      surface: 'explore',
      anchor: '#topbar-more',
      fallbackAnchor: '#studio-open-onboarding',
      titleKey: 'tour.linear.more.title',
      titleFallback: 'The More menu holds the rest',
      bodyKey: 'tour.linear.more.body',
      bodyFallback: 'This More menu is your back pocket: reopen this tour, open the Tutorial Library for deeper reading, revisit the Welcome Hub, and check for new versions and notices. Nothing here is one-time — it is all here whenever you need it.',
      advanceOn: 'next',
      placement: 'bottom'
    }),
    step({
      id: 'comfort',
      surface: 'explore',
      anchor: '',
      titleKey: 'tour.linear.comfort.title',
      titleFallback: 'A couple of comfort tips',
      bodyKey: 'tour.linear.comfort.body',
      bodyFallback: 'Two handy things: zoom the whole interface with Ctrl and plus or minus (Cmd on Mac), and reset with Ctrl and 0. And if Studio ever seems stuck, it is almost always just loading — give it a moment, or refresh with Ctrl and R.',
      advanceOn: 'next',
      placement: 'auto'
    })
  ];

  // Per-surface hint subsets. Phase 1 uses only stable chrome anchors (no
  // lazy-rendered targets). The deeper Object Editor / UI Editor field-level
  // hints are intentionally deferred to a later pass.
  const SURFACE_HINTS = {
    explore: [
      step({
        id: 'explore-sidebar',
        surface: 'explore',
        anchor: '#explore-pane .sidebar',
        titleKey: 'tour.hint.explore.sidebar.title',
        titleFallback: 'Browse by category',
        bodyKey: 'tour.hint.explore.sidebar.body',
        bodyFallback: 'These groups split the project by kind — scenes, events, cards, variables, text, assets. Pick a category to list everything of that type.',
        advanceOn: 'next',
        placement: 'right'
      }),
      step({
        id: 'explore-edit-entry',
        surface: 'explore',
        anchor: '[data-view="events"]',
        fallbackAnchor: '#explore-pane .sidebar',
        titleKey: 'tour.hint.explore.editEntry.title',
        titleFallback: 'From here into editing',
        bodyKey: 'tour.hint.explore.editEntry.body',
        bodyFallback: 'When you open an item you will find ways to edit it or to copy it as a new draft. That is how you move from just looking into actually proposing a change.',
        advanceOn: 'next',
        placement: 'right',
        tutorialArticle: 'workspaces'
      })
    ],
    // Create blends always-present canvas chrome with deeper steps that only
    // appear when the Object Editor or UI Editor is open. The UI filters hint
    // steps to whichever anchors currently resolve, so this one group adapts:
    // canvas-only when nothing is open, richer once you open an object.
    create: [
      step({
        id: 'create-canvas',
        surface: 'create',
        anchor: '#create-pane [data-authoring-workspace-nav]',
        fallbackAnchor: '#create-pane',
        titleKey: 'tour.hint.create.canvas.title',
        titleFallback: 'The editing workspace',
        bodyKey: 'tour.hint.create.canvas.body',
        bodyFallback: 'Create centers on a canvas with an asset rail and a side panel. Everything you do here is collected as drafts — nothing is written to game files yet.',
        advanceOn: 'next',
        placement: 'bottom',
        tutorialArticle: 'create-editor'
      }),
      step({
        id: 'create-object-title',
        surface: 'create',
        anchor: '[data-object-canvas-title="true"]',
        titleKey: 'tour.hint.create.objectTitle.title',
        titleFallback: 'The Object Editor',
        bodyKey: 'tour.hint.create.objectTitle.body',
        bodyFallback: 'When you open an object you land here. The left side previews how it reads in game; the right side holds the editable fields. The preview updates as you type.',
        advanceOn: 'next',
        placement: 'bottom',
        tutorialArticle: 'create-editor'
      }),
      step({
        id: 'create-condition',
        surface: 'create',
        anchor: '[data-object-canvas-semantic-card="condition"]',
        titleKey: 'tour.hint.create.condition.title',
        titleFallback: 'Conditions decide when content shows',
        bodyKey: 'tour.hint.create.condition.body',
        bodyFallback: 'A condition card controls when a piece of content appears, based on variables. It reads variable names and comparisons — Studio offers existing names so you spell them the same way the rest of the project does.',
        advanceOn: 'next',
        placement: 'left',
        tutorialArticle: 'variables'
      }),
      step({
        id: 'create-effect',
        surface: 'create',
        anchor: '[data-preview-object-effect-row]',
        titleKey: 'tour.hint.create.effect.title',
        titleFallback: 'Effects change the game state',
        bodyKey: 'tour.hint.create.effect.body',
        bodyFallback: 'An effect row writes to a variable when this content runs — for example raising support or marking that an event happened. Changing one variable can ripple into conditions, later events, and the sidebar, so check the install preview after.',
        advanceOn: 'next',
        placement: 'left',
        tutorialArticle: 'variables'
      }),
      step({
        id: 'create-ui-field',
        surface: 'create',
        anchor: '[data-system-ui-supported-field]',
        fallbackAnchor: '[data-system-ui-semantic-task]',
        titleKey: 'tour.hint.create.uiField.title',
        titleFallback: 'UI Editor fields',
        bodyKey: 'tour.hint.create.uiField.body',
        bodyFallback: 'In the UI Editor each field is tagged with what it means and how it maps back to source. Studio edits the parts it understands directly and flags the rest as manual steps, so unfamiliar custom UI is never silently rewritten.',
        advanceOn: 'next',
        placement: 'top',
        tutorialArticle: 'workspaces'
      })
    ],
    install: [
      step({
        id: 'install-check',
        surface: 'install',
        anchor: '#install-dry-run',
        titleKey: 'tour.hint.install.check.title',
        titleFallback: 'Always check first',
        bodyKey: 'tour.hint.install.check.body',
        bodyFallback: 'Run the check before anything else. Studio builds a test install and shows what your proposal would change, line by line.',
        advanceOn: 'next',
        placement: 'top',
        tutorialArticle: 'install-flow'
      }),
      step({
        id: 'install-diff',
        surface: 'install',
        anchor: '#install-diff-section',
        fallbackAnchor: '#install-apply',
        titleKey: 'tour.hint.install.diff.title',
        titleFallback: 'Read the diff, then apply',
        bodyKey: 'tour.hint.install.diff.body',
        bodyFallback: 'The diff is the difference between current files and files after your proposal. Read it, confirm the scope, and only then apply.',
        advanceOn: 'next',
        placement: 'top',
        tutorialArticle: 'install-flow'
      }),
      step({
        id: 'install-advanced',
        surface: 'install',
        anchor: '#install-allow-advanced',
        fallbackAnchor: '#install-apply',
        titleKey: 'tour.hint.install.advanced.title',
        titleFallback: 'Advanced options are high-risk',
        bodyKey: 'tour.hint.install.advanced.body',
        bodyFallback: 'Advanced install options allow riskier operations such as router or protected-file changes. Leave them off unless you know exactly what you are doing.',
        advanceOn: 'next',
        placement: 'top'
      })
    ]
  };

  function cloneStep(item) {
    return step(item);
  }

  function linearTour() {
    return LINEAR_TOUR.map(cloneStep);
  }

  function surfaces() {
    return SURFACES.slice();
  }

  function hasSurfaceHints(surface) {
    return Boolean(SURFACE_HINTS[normalizeSurface(surface)]);
  }

  function surfaceHints(surface) {
    const list = SURFACE_HINTS[normalizeSurface(surface)];
    return Array.isArray(list) ? list.map(cloneStep) : [];
  }

  function isStepAvailable(stepItem, stateInput) {
    if (!stepItem || !stepItem.requires) {
      return true;
    }
    const state = stateInput || {};
    if (stepItem.requires === 'project-loaded') {
      return Boolean(state.projectLoaded);
    }
    return true;
  }

  function visibleSteps(steps, state) {
    return (Array.isArray(steps) ? steps : []).filter(function (item) {
      return isStepAvailable(item, state);
    });
  }

  // Collect every i18n key the dataset references, so the localization check can
  // confirm both locales define them without re-listing keys by hand.
  function referencedI18nKeys() {
    const keys = [];
    const seen = {};
    function collect(list) {
      list.forEach(function (item) {
        [item.titleKey, item.bodyKey].forEach(function (key) {
          if (key && !seen[key]) {
            seen[key] = true;
            keys.push(key);
          }
        });
      });
    }
    collect(LINEAR_TOUR);
    SURFACES.forEach(function (surface) {
      collect(SURFACE_HINTS[surface] || []);
    });
    return keys;
  }

  const api = {
    step,
    linearTour,
    surfaces,
    hasSurfaceHints,
    surfaceHints,
    isStepAvailable,
    visibleSteps,
    referencedI18nKeys
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapGuidedTourModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
