(function initProjectMapTutorialLibrary(global) {
  'use strict';

  const ARTICLES = [
    {
      id: 'studio-intro',
      titleKey: 'tutorial.article.studioIntro.title',
      titleFallback: 'What Studio is',
      bodyKeys: [
        ['tutorial.article.studioIntro.body', 'Studio is a mod editing tool. It reads a Dendry game project, organizes the files into browsable and editable content, and helps write reviewed changes back to game files.'],
        ['tutorial.article.studioIntro.body2', 'Every edit starts as a proposal: a draft describing what you want to change. Drafts do not modify game files until you reach Install, confirm the checks, and explicitly apply the change.'],
        ['tutorial.article.studioIntro.body3', 'Dendry is the engine under these games. You do not need to understand its source code, but knowing it exists helps explain why Studio can automate some work while asking you to confirm other parts.']
      ]
    },
    {
      id: 'dev-preview',
      titleKey: 'tutorial.article.devPreview.title',
      titleFallback: 'Current development status',
      bodyKeys: [
        ['tutorial.article.devPreview.body', 'Studio is still in Dev Preview, not a finished product. Features will keep changing, and real projects will reveal bugs, unclear interface moments, and places where manual review is required.'],
        ['tutorial.article.devPreview.body2', 'UI editing, variable parsing rules, and the Design workspace are still being developed.'],
        ['tutorial.article.devPreview.body3', 'Useful reports include your operating system, Studio version, mod or project name, what you did, what you expected, what happened, and any relevant screenshot or file path.']
      ]
    },
    {
      id: 'workspaces',
      titleKey: 'tutorial.article.workspaces.title',
      titleFallback: 'The four workspaces',
      bodyKeys: [
        ['tutorial.article.workspaces.body', 'Studio has four top workspaces: Explore, Design, Create, and Install. They serve different parts of the editing route.'],
        ['tutorial.article.workspaces.body2', 'Explore is a searchable list for keywords, cards, events, variables, and other known content.'],
        ['tutorial.article.workspaces.body3', 'Design is a visual flow map for understanding how content connects and how players reach it. This surface is still being refined.'],
        ['tutorial.article.workspaces.body4', 'Create is where you write change proposals. Install, also called Review & Apply, is where you inspect what a proposal would touch before it writes to game files.'],
        ['tutorial.article.workspaces.body5', 'Opening Create, writing a draft, or exporting a file does not change your game. Only an explicit apply action in Install writes changes.']
      ]
    },
    {
      id: 'create-editor',
      titleKey: 'tutorial.article.createEditor.title',
      titleFallback: 'Create: how the editing surface works',
      bodyKeys: [
        ['tutorial.article.createEditor.body', 'Create centers on a canvas. The left asset rail lets you search for event cards and add them to the canvas. The right sidebar provides event management and can run a preview of how the event appears in game.'],
        ['tutorial.article.createEditor.body2', 'Double-click an event card to open the Object Editor. The left side is the preview, and the right side contains editable fields.'],
        ['tutorial.article.createEditor.body3', 'The floating window in the lower-right shows your accumulated draft edits. You can review, rename, or delete drafts from there.']
      ]
    },
    {
      id: 'install-flow',
      titleKey: 'tutorial.article.installFlow.title',
      titleFallback: 'Install: from checks to apply',
      bodyKeys: [
        ['tutorial.article.installFlow.body', 'After editing, go to Install. The flow is check first, apply second. Do not skip the check.'],
        ['tutorial.article.installFlow.body2', 'When you run the check, Studio builds an install test and shows a Diff: the line-by-line difference between current game files and files after your proposal. Read the Diff and confirm the scope before applying.'],
        ['tutorial.article.installFlow.body3', 'Full Preview opens a complete game instance so you can test the result, but it rebuilds the whole game and is slower.'],
        ['tutorial.article.installFlow.body4', 'Advanced install options allow higher-risk operations such as router changes or protected files. They are marked high-risk for a reason, so leave them alone unless you know what you are doing.']
      ]
    },
    {
      id: 'sdaah-structure',
      titleKey: 'tutorial.article.sdaahStructure.title',
      titleFallback: 'SDAAH-style game structure',
      bodyKeys: [
        ['tutorial.article.sdaahStructure.body', 'Studio is optimized for SDAAH-style games. SDAAH, Social Democracy: An Alternate History, is a political simulation built with Dendry, and several mods use similar file structures and writing conventions.'],
        ['tutorial.article.sdaahStructure.body2', 'Scene files are the basic content units. A scene may contain narration, dialogue, an event, choices, and effects triggered by those choices.'],
        ['tutorial.article.sdaahStructure.body3', 'An event router is the hidden scheduling system that decides what event appears next. In many SDAAH-style projects, scenes such as post_event or post_event_news play this role, so router edits often require extra confirmation.'],
        ['tutorial.article.sdaahStructure.body4', 'Cards are interactive game elements such as policy cards, advisor cards, and event cards.'],
        ['tutorial.article.sdaahStructure.body5', 'News differs by project. In original SDAAH, monthly popups are technically events routed through post_event, so they should be edited as world event drafts. IslandSunrise uses ticker-style news, which is a different mechanism.'],
        ['tutorial.article.sdaahStructure.body6', 'Interface text covers short UI words such as sidebar labels, button names, tab titles, and status messages. Some labels in original SDAAH exist only in out/html/index.html, so Studio may mark uncertain text as a source-locating task.'],
        ['tutorial.article.sdaahStructure.body7', 'Art assets are referenced images, audio, and other files. Studio can find references, but a referenced physical file may still be missing from your current project folder.']
      ]
    },
    {
      id: 'variables',
      titleKey: 'tutorial.article.variables.title',
      titleFallback: 'Variables',
      bodyKeys: [
        ['tutorial.article.variables.body', 'Variables are the game state notebook. They record the month, whether an event happened, party support, relationship values, available resources, and anything else the game must remember after the current screen.'],
        ['tutorial.article.variables.body2', 'Changing a variable is rarely just changing one line. A value may be written by one option, read by post_event to unlock a later event, and displayed by the sidebar as a status hint. Renaming or changing the range of a variable can affect conditions, event triggers, card requirements, news, and UI.'],
        ['tutorial.article.variables.body3', 'Studio has a semantic candidate helper that searches existing variable names, reads, writes, and evidence so you can insert variables with fewer spelling mistakes. It is a helper, not a guarantee that the game logic is correct.']
      ]
    },
    {
      id: 'tags-event',
      titleKey: 'tutorial.article.tagsEvent.title',
      titleFallback: 'What tags: event means',
      bodyKeys: [
        ['tutorial.article.tagsEvent.body', 'In Dendry scene files, tags are author-written labels that help projects and tools identify what a scene is for. In SDAAH-style projects, tags: event usually means this scene can be considered by the event router.'],
        ['tutorial.article.tagsEvent.body2', 'It is not player-facing text and not a news title. It is a marker telling the router that this scene can be picked. When writing a monthly event as a world event draft, the event tag helps the existing router find it.'],
        ['tutorial.article.tagsEvent.body3', 'Different mods may use different tags or custom router logic. After creating a proposal, check the preview and Install summary to confirm Studio understood the project correctly.']
      ]
    },
    {
      id: 'confidence',
      titleKey: 'tutorial.article.confidence.title',
      titleFallback: 'How Studio shows what it knows',
      bodyKeys: [
        ['tutorial.article.confidence.body', 'Studio labels its confidence as exact, inferred, guessed, or unknown. This tells you how much evidence Studio found in the source files for a specific item.'],
        ['tutorial.article.confidence.body2', 'Exact means Studio found a direct source match. Inferred means it made a reasonable judgment from convention and context. Guessed means evidence is thin. Unknown means there is not enough information.'],
        ['tutorial.article.confidence.body3', 'The weaker the evidence, the more carefully you should inspect the install plan before applying it.']
      ]
    },
    {
      id: 'island-sunrise',
      titleKey: 'tutorial.article.islandSunrise.title',
      titleFallback: 'IslandSunrise',
      bodyKeys: [
        ['tutorial.article.islandSunrise.body', 'IslandSunrise is an unreleased mod and the Studio author\'s own project. It builds on SDAAH but adds custom systems such as Circle, district, local, collective, and coverage, plus protected custom UI and JavaScript.'],
        ['tutorial.article.islandSunrise.body2', 'Because its structure is more complex than a standard SDAAH-style project, Studio automates less for IslandSunrise in some areas. Changes involving protected UI require manual review instead of automatic apply.']
      ]
    },
    {
      id: 'compatibility',
      titleKey: 'tutorial.article.compatibility.title',
      titleFallback: 'Compatibility',
      bodyKeys: [
        ['tutorial.article.compatibility.body', 'Studio works best when your project overlaps with the conventions Studio understands. It currently recognizes three profiles: generic Dendry, SDAAH-style, and IslandSunrise.'],
        ['tutorial.article.compatibility.body2', 'High compatibility makes search results, previews, variable candidates, and install plans more reliable. Low compatibility, such as unusual naming or a custom router, makes Studio show more evidence and ask for manual confirmation.'],
        ['tutorial.article.compatibility.body3', 'The parser is the reader that turns source files into structured Studio data. When parser evidence is weak, Studio may know a line exists without knowing whether it is player prose, a condition, or a protected UI detail.']
      ]
    },
    {
      id: 'upstream',
      titleKey: 'tutorial.article.upstream.title',
      titleFallback: 'Upstream changes',
      bodyKeys: [
        ['tutorial.article.upstream.body', 'Upstream means the things Studio depends on: the Dendry engine, source projects whose conventions Studio learned from, or packages needed to build the game.'],
        ['tutorial.article.upstream.body2', 'If upstream projects such as Petrograd, Popular Front, or DendryNexus change scene syntax, router logic, or variable access, features that used to be safe may need parser updates. Studio understands games through the assumption that they are written a certain way; when that assumption changes, Studio must change too.']
      ]
    },
    {
      id: 'practical',
      titleKey: 'tutorial.article.practical.title',
      titleFallback: 'Practical basics',
      bodyKeys: [
        ['tutorial.article.practical.body', 'A file path is where a file lives on your computer, such as source/scenes/example.scene.dry, relative to the project folder you opened. Studio shows paths in Explore, Design, Object Editor, and install details.'],
        ['tutorial.article.practical.body2', 'Open Project means handing Studio your game or mod folder. Desktop mode can choose the folder directly; browser mode cannot read your disk and needs a generated ProjectIndex JSON file.'],
        ['tutorial.article.practical.body3', 'Export saves your proposal as a file. It does not change the game. It simply preserves a draft for backup, sharing, or later review.'],
        ['tutorial.article.practical.body4', 'Diagnostics are hints and notes attached to items. They do not always mean errors. A manual step often means Studio found a possible edit but believes you should decide whether to perform it.'],
        ['tutorial.article.practical.body5', 'Review & Apply does not mean everything was installed. It only applies operations that pass checks and are marked safe. Browser mode reviews plans only; desktop mode can dry run and apply, and you should still read the result report and test the game.']
      ]
    },
    {
      id: 'git-safety',
      titleKey: 'tutorial.article.gitSafety.title',
      titleFallback: 'Use Git to protect yourself',
      bodyKeys: [
        ['tutorial.article.gitSafety.body', 'Git tracks file history. Think of it as a restore point before you edit, so you can return to a known-good state if something breaks.'],
        ['tutorial.article.gitSafety.body2', 'If your project does not use Git yet, install Git, open a terminal in the project folder, run git init, then make an initial commit before applying Studio changes.'],
        ['tutorial.article.gitSafety.body3', 'A simple habit is enough: commit before large changes, inspect changed files after Studio applies a proposal, and use Git to understand and undo bad changes. Git does not replace in-game testing, but it makes experimentation much less scary.']
      ]
    },
    {
      id: 'troubleshooting',
      titleKey: 'tutorial.article.troubleshooting.title',
      titleFallback: 'If the game errors',
      bodyKeys: [
        ['tutorial.article.troubleshooting.body', 'Start by reading the game error and the Studio install result. Revert or temporarily disable the newest change, then inspect the file path and line number named in the error. Try to find the smallest project state that reproduces the problem.'],
        ['tutorial.article.troubleshooting.body2', 'When reporting a GitHub issue, include reproduction steps and your environment: operating system, Studio version, browser or desktop mode, mod name and version, and any relevant draft or install plan.']
      ]
    },
    {
      id: 'open-source',
      titleKey: 'tutorial.article.openSource.title',
      titleFallback: 'Open source and contributing',
      bodyKeys: [
        ['tutorial.article.openSource.body', 'Studio is open source. If you are technical, you can submit a GitHub pull request to improve support for a specific mod.'],
        ['tutorial.article.openSource.body2', 'If the project is no longer maintained in the future, you can fork Studio and publish your own version under the MIT license.']
      ]
    }
  ];

  const state = {
    elements: null,
    activeId: ARTICLES[0].id,
    scrollFrame: null
  };

  const api = {
    articles: () => ARTICLES.map((article) => Object.assign({}, article, {
      bodyKeys: article.bodyKeys.slice()
    })),
    articleIds: () => ARTICLES.map((article) => article.id),
    open: (articleId) => openDialog(true, articleId),
    close: () => closeDialog()
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapTutorialLibrary = api;
  }
  if (!global || !global.document) {
    return;
  }

  onReady(() => start(global.document));

  function onReady(callback) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function start(document) {
    state.elements = {
      dialog: document.getElementById('studio-tutorial-library'),
      nav: document.getElementById('tutorial-library-nav'),
      article: document.getElementById('tutorial-library-article'),
      openButtons: [
        document.getElementById('studio-open-tutorial-library'),
        document.getElementById('onboarding-open-tutorial-library')
      ].filter(Boolean),
      topbarMore: document.getElementById('topbar-more')
    };
    if (!state.elements.dialog || !state.elements.nav || !state.elements.article) {
      return;
    }
    render();
    wireEvents(document);
    document.addEventListener('project-map:locale-changed', () => {
      render();
      jumpToArticle(state.activeId, false);
    });
  }

  function wireEvents(document) {
    state.elements.openButtons.forEach((button) => {
      button.addEventListener('click', () => openDialog(true));
    });
    state.elements.dialog.addEventListener('click', (event) => {
      if (event.target === state.elements.dialog || event.target.closest('[data-tutorial-close]')) {
        closeDialog();
      }
    });
    state.elements.article.addEventListener('scroll', syncActiveFromScroll);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !state.elements.dialog.classList.contains('hidden')) {
        closeDialog();
      }
    });
    document.addEventListener('click', (event) => {
      const trigger = event.target && event.target.closest ? event.target.closest('[data-tutorial-open]') : null;
      if (!trigger) {
        return;
      }
      event.preventDefault();
      openDialog(false, trigger.dataset.tutorialOpen || '');
    });
  }

  function render() {
    if (!state.elements) {
      return;
    }
    renderNav();
    renderArticle();
  }

  function renderNav() {
    const nav = state.elements.nav;
    nav.textContent = '';
    ARTICLES.forEach((article) => {
      const button = global.document.createElement('button');
      button.type = 'button';
      button.dataset.tutorialArticle = article.id;
      button.className = article.id === state.activeId ? 'is-active' : '';
      button.textContent = translate(article.titleKey, article.titleFallback);
      button.addEventListener('click', () => {
        jumpToArticle(article.id, true);
      });
      nav.appendChild(button);
    });
  }

  function renderArticle() {
    const target = state.elements.article;
    target.textContent = '';
    ARTICLES.forEach((article) => {
      const section = global.document.createElement('section');
      section.id = 'tutorial-article-' + article.id;
      section.className = 'tutorial-library-section';
      section.dataset.tutorialSection = article.id;
      section.setAttribute('aria-labelledby', 'tutorial-heading-' + article.id);
      const heading = global.document.createElement('h2');
      heading.id = 'tutorial-heading-' + article.id;
      heading.textContent = translate(article.titleKey, article.titleFallback);
      section.appendChild(heading);
      article.bodyKeys.forEach(([key, fallback]) => {
        const paragraph = global.document.createElement('p');
        paragraph.textContent = translate(key, fallback);
        section.appendChild(paragraph);
      });
      target.appendChild(section);
    });
  }

  function openDialog(fromMenu, articleId) {
    if (!state.elements || !state.elements.dialog) {
      return false;
    }
    if (articleId && ARTICLES.some((article) => article.id === articleId)) {
      state.activeId = articleId;
    }
    render();
    state.elements.dialog.classList.remove('hidden');
    if (fromMenu && state.elements.topbarMore) {
      state.elements.topbarMore.open = false;
    }
    const active = state.elements.nav.querySelector('.is-active') || state.elements.nav.querySelector('button');
    if (active) {
      active.focus();
    }
    jumpToArticle(state.activeId, false);
    return true;
  }

  function closeDialog() {
    if (!state.elements || !state.elements.dialog) {
      return false;
    }
    var wasOpen = !state.elements.dialog.classList.contains('hidden');
    state.elements.dialog.classList.add('hidden');
    // Let surfaces that handed off to the Tutorial Library (e.g. the Welcome
    // Hub) restore themselves when it closes, so a first-time user who only
    // peeked at the tutorial is not stranded in an empty Studio.
    if (wasOpen && global.document && typeof global.document.dispatchEvent === 'function') {
      global.document.dispatchEvent(new CustomEvent('project-map:tutorial-library-closed'));
    }
    return true;
  }

  function jumpToArticle(articleId, smooth) {
    if (!state.elements || !state.elements.article || !articleId) {
      return false;
    }
    const section = state.elements.article.querySelector('[data-tutorial-section="' + articleId + '"]');
    if (!section) {
      return false;
    }
    state.activeId = articleId;
    updateActiveNav();
    const container = state.elements.article;
    const delta = section.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollTo({
      top: container.scrollTop + delta,
      behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
    });
    return true;
  }

  function updateActiveNav() {
    if (!state.elements || !state.elements.nav) {
      return;
    }
    state.elements.nav.querySelectorAll('[data-tutorial-article]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.tutorialArticle === state.activeId);
    });
  }

  function syncActiveFromScroll() {
    if (!state.elements || !state.elements.article) {
      return;
    }
    if (state.scrollFrame) {
      global.cancelAnimationFrame(state.scrollFrame);
    }
    state.scrollFrame = global.requestAnimationFrame(() => {
      state.scrollFrame = null;
      const articleTop = state.elements.article.getBoundingClientRect().top;
      let activeId = state.activeId;
      let bestDistance = Infinity;
      state.elements.article.querySelectorAll('[data-tutorial-section]').forEach((section) => {
        const distance = Math.abs(section.getBoundingClientRect().top - articleTop);
        if (distance < bestDistance) {
          bestDistance = distance;
          activeId = section.dataset.tutorialSection || activeId;
        }
      });
      if (activeId !== state.activeId) {
        state.activeId = activeId;
        updateActiveNav();
      }
    });
  }

  function prefersReducedMotion() {
    return Boolean(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function translate(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function'
      ? i18n.t(key, fallback)
      : fallback;
  }
})(typeof window !== 'undefined' ? window : globalThis);
