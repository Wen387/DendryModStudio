(function initProjectMapTutorialLibrary(global) {
  'use strict';

  const ARTICLES = [
    {
      id: 'studio-overview',
      titleKey: 'tutorial.article.overview.title',
      titleFallback: 'How Studio thinks about changes',
      bodyKeys: [
        ['tutorial.article.overview.body', 'Studio reads a Dendry project index, shows player-facing content, lets you draft change proposals, and sends installable proposals to Review & Apply. A saved proposal is still only a proposal until an install plan is reviewed and applied.'],
        ['tutorial.article.overview.body2', 'The reverse parser is evidence-based. When Studio says something is matched, inferred, guessed, or unknown, it is telling you how much source evidence it has for that item.']
      ]
    },
    {
      id: 'mode-buttons',
      titleKey: 'tutorial.article.modes.title',
      titleFallback: 'Explore, Design, Create, and Install',
      bodyKeys: [
        ['tutorial.article.modes.body', 'The top buttons are work areas, not difficulty levels. Explore is the searchable table view: use it when you know a word, file, event, card, asset, or variable you want to inspect. Design is the map view: use it when you want to understand how player-facing beats connect. Create is where you write a proposal. Install, shown as Review & Apply, is where you inspect what the proposal would change before anything touches source files.'],
        ['tutorial.article.modes.body2', 'A practical path is: open a project, search in Explore, switch to Design if you need flow context, use Create to draft the change, save it to My Changes, then send it to Review & Apply. You can move back and forth; nothing is installed just because you opened Create or saved a draft.']
      ]
    },
    {
      id: 'what-is-ide',
      titleKey: 'tutorial.article.ide.title',
      titleFallback: 'What is an IDE?',
      bodyKeys: [
        ['tutorial.article.ide.body', 'An IDE is an editor for source files, such as VS Code, Cursor, or another code editor. It can open folders, search many files, show line numbers, and help you make edits that Studio cannot safely automate yet.'],
        ['tutorial.article.ide.body2', 'IDE editing is still necessary for protected files, unusual routers, handwritten script logic, unsupported mod styles, or any place where Studio can only generate a manual step instead of a safe patch.']
      ]
    },
    {
      id: 'sdaah-style',
      titleKey: 'tutorial.article.sdaah.title',
      titleFallback: 'How SDAAH-style games are usually built',
      bodyKeys: [
        ['tutorial.article.sdaah.body', 'SDAAH-style games usually combine scene files, event routers, cards, news snippets, surface text, assets, and variables. Studio scans those files, builds a ProjectIndex, and turns recognized patterns into Explore rows, Design nodes, draft seeds, previews, and install plans.'],
        ['tutorial.article.sdaah.body2', 'SDAAH Dynamic, Bienio Rossa, and Social Democracy Redux are examples of projects whose editing habits are close enough that Studio can often be useful. Similar habits do not guarantee full compatibility.']
      ]
    },
    {
      id: 'variables-in-sdaah',
      titleKey: 'tutorial.article.variables.sdaah.title',
      titleFallback: 'How variables are used in SDAAH-like games',
      bodyKeys: [
        ['tutorial.article.variables.sdaah.body', 'In SDAAH-like games, variables are the project memory. They store the month, event flags, party strength, relationship values, resources, and many other small facts the game needs after the current screen is gone.'],
        ['tutorial.article.variables.consumers.body', 'A value is consumed when another scene, router, card, sidebar, or status display reads it. For example, a choice may set Q.worker_unrest, post_event may use that value to unlock a later popup, and a sidebar may display the result to the player.'],
        ['tutorial.article.variables.studio.body', 'This matters in Studio because a proposal that changes a variable is not just changing one line. It may affect every condition, event router, card requirement, and visible status label that consumes the same value.'],
        ['tutorial.article.variables.selector.body', 'The variable candidate helper reduces lookup mistakes. It searches existing ProjectIndex variables by name, tags, and source evidence, then inserts a variable name or simple condition into the draft field you are editing. It is still a helper, not a promise that the political logic is correct.']
      ]
    },
    {
      id: 'world-events-router',
      titleKey: 'tutorial.article.worldEvents.router.title',
      titleFallback: 'World events, routers, and news',
      bodyKeys: [
        ['tutorial.article.worldEvents.router.body', 'A world event is the moment the player sees: title, prose, choices, and effects. A router is the hidden traffic controller that decides which event can appear next. In many SDAAH-like projects, post_event or post_event_news plays that routing role.'],
        ['tutorial.article.worldEvents.router.body2', 'This is why Studio separates Island-style ticker news from original SDAAH monthly popups. A monthly popup may feel like news to the player, but technically it is often an event routed from post_event, so it belongs in an event draft.'],
        ['tutorial.article.worldEvents.router.body3', 'Knowing the difference helps you understand why some drafts can be reviewed and applied while others still ask for IDE steps: editing the player text is easier than safely changing the router that decides when it appears.']
      ]
    },
    {
      id: 'tags-event',
      titleKey: 'tutorial.article.tagsEvent.title',
      titleFallback: 'What does tags: event mean?',
      bodyKeys: [
        ['tutorial.article.tagsEvent.body', 'In a Dendry scene file, tags are short labels written by the author. They help the project and Studio group scenes. In SDAAH-like projects, putting event in the tags field usually means “treat this scene as a world event candidate.” It is not the headline, not the title, and not a special magic password; it is a label that existing routers often look for.'],
        ['tutorial.article.tagsEvent.body2', 'When the News Wizard says original SDAAH monthly popups should use World Event with tags: event, it means this: open Create, choose World Event, write the popup as an event, and put event in the tags field. Studio can then build an event-style proposal instead of pretending that monthly popup is the same thing as Island-style ticker news.'],
        ['tutorial.article.tagsEvent.body3', 'If you are editing a different SDAAH-like mod, still check the preview and Review & Apply summary. Some mods use different tag names or route events by hand, and Studio will stay conservative when it cannot prove the router pattern.']
      ]
    },
    {
      id: 'surface-text-sidebar',
      titleKey: 'tutorial.article.surfaceText.sidebar.title',
      titleFallback: 'Sidebar and interface text',
      bodyKeys: [
        ['tutorial.article.surfaceText.sidebar.body', 'Surface text means visible UI words such as Sidebar labels, buttons, tab names, unavailable text, or short status messages. These are not always written beside the event that caused them.'],
        ['tutorial.article.surfaceText.sidebar.body2', 'In SDAAH original, some visible labels are only found in out/html/index.html. In IslandSunrise, more UI is protected custom HTML or JavaScript. Studio can show source-backed text proposals when it has evidence, but protected or generated UI still needs IDE review.'],
        ['tutorial.article.surfaceText.sidebar.body3', 'This helps you decide whether you are changing story prose, a game rule explanation, or a UI label. The same sentence can feel editable, but Studio must check where it actually lives before offering Review & Apply.']
      ]
    },
    {
      id: 'asset-references',
      titleKey: 'tutorial.article.assets.references.title',
      titleFallback: 'Art assets and missing files',
      bodyKeys: [
        ['tutorial.article.assets.references.body', 'An asset reference is a path written in source, such as card-image, face-image, or audio. The reference says what the game wants to use; the physical image or sound file may still be missing from the checkout.'],
        ['tutorial.article.assets.references.body2', 'When Studio says an asset has no physical file, it means the reference was found but the actual img or music file was not present. Studio can still show where it is used, but it cannot preview, copy, optimize, or install that asset yet.'],
        ['tutorial.article.assets.references.body3', 'This matters because a draft may look correct while still needing you to supply the real file. Treat Assets as a read-only map for now, not as an importer.']
      ]
    },
    {
      id: 'review-apply',
      titleKey: 'tutorial.article.install.title',
      titleFallback: 'Does automatic install mean everything is installed?',
      bodyKeys: [
        ['tutorial.article.install.body', 'No. Review & Apply only applies operations that the install plan marks as safe or guarded and that pass source checks. Manual steps, advanced risky operations, unsupported routers, and protected edits are not silently installed.'],
        ['tutorial.article.install.body2', 'Browser mode can review plans but cannot write local files. Desktop mode can dry-run and apply supported operations, then you should still read the result report and test the game.']
      ]
    },
    {
      id: 'local-file-paths',
      titleKey: 'tutorial.article.paths.title',
      titleFallback: 'How to find local file paths',
      bodyKeys: [
        ['tutorial.article.paths.body', 'A file path is the folder route to a file. Studio shows source paths in Explore, Design inspectors, text proposals, and install details when the parser has evidence. A path like source/scenes/example.scene.dry is relative to the project folder you opened.'],
        ['tutorial.article.paths.body2', 'In desktop mode, start from the project folder you opened in Studio. In browser mode, Studio only knows the paths recorded inside ProjectIndex JSON, so you may need to open the same project folder in an IDE to locate the real file.']
      ]
    },
    {
      id: 'faq-export-open-diagnostics',
      titleKey: 'tutorial.article.faq.export.title',
      titleFallback: 'Open project, Export, and Diagnostics',
      bodyKeys: [
        ['tutorial.article.faq.export.body', 'Open Project means choosing the folder that contains the game or mod source. In the desktop app, click Open Project Folder and select the project root, the folder that contains source, out, and package files. In browser mode, Studio cannot read your disk, so you load a ProjectIndex JSON that was already generated.'],
        ['tutorial.article.faq.export.body2', 'Export means “save a file that represents this proposal.” Exporting a draft JSON, scene file, patch preview, or install plan does not automatically change your game. It gives you a portable artifact you can review, share, back up, or load into Review & Apply. If a button says Review & Apply, that is the path where Studio checks what can actually be installed.'],
        ['tutorial.article.faq.export.body3', 'Diagnostics are warnings and notes. They are Studio saying what it knows, what it is guessing, and what still needs your attention. A diagnostic is not always a bug. For example, “manual review” can simply mean Studio found the right idea but will not edit that file automatically.']
      ]
    },
    {
      id: 'faq-git-safety',
      titleKey: 'tutorial.article.faq.git.title',
      titleFallback: 'Using Git as a safety net',
      bodyKeys: [
        ['tutorial.article.faq.git.body', 'Git is a save-history tool for a folder. It lets you see what changed, undo a bad edit, and keep a clean checkpoint before trying a risky mod change. If your project is not already tracked by Git, install Git, open a terminal in the project folder, run git init, then make an initial commit before using automatic apply.'],
        ['tutorial.article.faq.git.body2', 'A simple habit is enough: before a big edit, commit the current working version; after Studio applies a proposal, look at the changed files; if the game breaks, use your Git tool or IDE to inspect and undo the exact changes. Git does not replace testing the game, but it makes mistakes much less scary.'],
        ['tutorial.article.faq.git.body3', 'If Git feels unfamiliar, use a visual Git client or VS Code Source Control first. The important part is not mastering every command. The important part is having a restore point before changing source files.']
      ]
    },
    {
      id: 'faq-ide-project',
      titleKey: 'tutorial.article.faq.ide.title',
      titleFallback: 'Installing an IDE and opening your project',
      bodyKeys: [
        ['tutorial.article.faq.ide.body', 'An IDE is where you can inspect and edit the actual project files when Studio asks for manual review. VS Code is a common beginner-friendly choice: install it, open it, choose File > Open Folder, and select the same project root you opened in Studio. After that you can search files, read source paths from Studio, and jump to the file that needs review.'],
        ['tutorial.article.faq.ide.body2', 'When Studio shows a path like source/scenes/post_event.scene.dry, start from the folder you opened in the IDE, then open source, then scenes, then that file. If Studio gives a line number, use the IDE’s Go to Line command. This is how you reach the exact place Studio is talking about.'],
        ['tutorial.article.faq.ide.body3', 'You do not need to become a programmer to use an IDE for manual review. You mainly need three actions: open the right folder, search text across files, and compare what changed. For protected or unusual files, this is safer than pretending every edit can be a button click.']
      ]
    },
    {
      id: 'troubleshooting',
      titleKey: 'tutorial.article.troubleshooting.title',
      titleFallback: 'If the game errors',
      bodyKeys: [
        ['tutorial.article.troubleshooting.body', 'First read the game error and the Studio install result. Undo or isolate the newest change, check the mentioned file path and line, then test with the smallest project state that still reproduces the problem.'],
        ['tutorial.article.troubleshooting.body2', 'When filing a GitHub issue, include reproduction steps and your environment. Reproduction steps are the exact actions that make the bug happen again. Environment means operating system, Studio version or package, browser or desktop mode, game or mod name and version, and any relevant draft or install plan.']
      ]
    },
    {
      id: 'profile-compatibility',
      titleKey: 'tutorial.article.profileCompatibility.title',
      titleFallback: 'SDAAH-like and IslandSunrise compatibility',
      bodyKeys: [
        ['tutorial.article.profileCompatibility.body', 'A profile is Studio\'s parsing type for a project. Generic Dendry, SDAAH-style, and IslandSunrise share one Studio, but they do not promise the same parsing coverage or install safety.'],
        ['tutorial.article.profileCompatibility.body2', 'SDAAH-like projects usually need strong monthly event, advisor, card, surface text, and asset reference parsing. IslandSunrise adds custom protected UI and project-specific systems such as Circle, district, local, collective, and coverage data.'],
        ['tutorial.article.profileCompatibility.body3', 'Before invited testing, Studio should prefer visible caveats over aggressive automation. If the active profile has weak evidence, Studio may still let you draft and preview, but Review & Apply should stay conservative.'],
        ['tutorial.article.profileCompatibility.compatibilityMeaning.body', 'Compatibility means Studio and the project agree about enough conventions to make a feature useful: where events live, how cards are routed, what variables look like, where interface text is stored, and which files are protected. More compatibility means more reliable search, previews, candidates, and install plans. Less compatibility means Studio should show evidence and ask for IDE review.'],
        ['tutorial.article.profileCompatibility.parserMeaning.body', 'A parser is the reader that turns source files into structured Studio data. Parsing is that reading process. When parser evidence is weak, Studio may know that a line exists without knowing whether it is player prose, a router condition, a variable migration, or a protected UI detail.']
      ]
    },
    {
      id: 'compatibility-open-source',
      titleKey: 'tutorial.article.compatibility.title',
      titleFallback: 'Compatibility, upstream, and open source',
      bodyKeys: [
        ['tutorial.article.compatibility.body', 'Studio does not support every SDAAH-style game equally. It is mainly compatible with projects that follow editing habits close to SDAAH. If naming or implementation differs, reverse parsing and automatic install can become incomplete or wrong.'],
        ['tutorial.article.compatibility.body2', 'Petrograd, Popular Front, or an upstream DendryNexus engine change can break assumptions. Upstream means something Studio depends on: the original engine that runs scene files, the source project whose writing habits Studio learned from, or a dependency used to build or inspect the game. If upstream changes how scenes, routers, or variables are written, Studio may need parser updates.'],
        ['tutorial.article.compatibility.body4', 'Original engine means the runtime rules underneath the mod: how scene files are read, how conditions are evaluated, how choices jump to other sections, and how variables live in Q. Source project means the actual game or mod folder you opened, including its source/scenes and out/html files. Knowing this helps you understand why a change in the engine or source style can make a previously safe Studio feature become uncertain.'],
        ['tutorial.article.compatibility.body3', 'If you are technical, you can submit a GitHub pull request to optimize Studio for a specific mod. If this project is no longer maintained, you can fork the full Studio files and publish your optimized version under the permissive MIT license.']
      ]
    }
  ];

  const state = {
    elements: null,
    activeId: ARTICLES[0].id
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
    document.addEventListener('project-map:locale-changed', render);
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
        state.activeId = article.id;
        render();
      });
      nav.appendChild(button);
    });
  }

  function renderArticle() {
    const article = ARTICLES.find((item) => item.id === state.activeId) || ARTICLES[0];
    const target = state.elements.article;
    target.textContent = '';
    const heading = global.document.createElement('h2');
    heading.textContent = translate(article.titleKey, article.titleFallback);
    target.appendChild(heading);
    article.bodyKeys.forEach(([key, fallback]) => {
      const paragraph = global.document.createElement('p');
      paragraph.textContent = translate(key, fallback);
      target.appendChild(paragraph);
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
    return true;
  }

  function closeDialog() {
    if (!state.elements || !state.elements.dialog) {
      return false;
    }
    state.elements.dialog.classList.add('hidden');
    return true;
  }

  function translate(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function'
      ? i18n.t(key, fallback)
      : fallback;
  }
})(typeof window !== 'undefined' ? window : globalThis);
