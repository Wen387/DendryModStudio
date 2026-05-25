(function initProjectMapSystemUiScreenModel(global) {
  'use strict';

  const RECIPES = {
    entry: {
      key: 'entry',
      family: 'main',
      selected: 'main_content',
      labelKey: 'create.entrySidebar',
      fallback: 'Entry & Sidebar',
      intentKey: 'systemUi.recipe.entry.intent',
      intentFallback: 'Edit the opening screen and the sidebar the player sees beside it.'
    },
    play_surface: {
      key: 'play_surface',
      family: 'interactive',
      selected: 'workspace_hand',
      labelKey: 'create.playSurface',
      fallback: 'Playable Surface',
      intentKey: 'systemUi.recipe.playSurface.intent',
      intentFallback: 'Edit repeatable hand, deck, card, and advisor objects inside the same screen.'
    },
    workspace_layout: {
      key: 'workspace_layout',
      family: 'structure',
      selected: 'layout_frame',
      labelKey: 'create.workspaceLayout',
      fallback: 'Workspace Layout',
      intentKey: 'systemUi.recipe.workspaceLayout.intent',
      intentFallback: 'Edit screen structure: routes, columns, deck lane, starter card, and sidebar placement.'
    },
    sidebar_status: {
      key: 'sidebar_status',
      family: 'sidebar',
      selected: 'sidebar_status',
      labelKey: 'create.sidebarStatus',
      fallback: 'Sidebar / Status',
      intentKey: 'systemUi.recipe.sidebarStatus.intent',
      intentFallback: 'Edit stateful sidebar and status sections with preview-only fixture values.'
    },
    election_results: {
      key: 'election_results',
      family: 'results',
      selected: 'election_results_chart',
      labelKey: 'create.electionResults',
      fallback: 'Election Results',
      intentKey: 'systemUi.recipe.electionResults.intent',
      intentFallback: 'Edit the player-facing election-results screen: chart, party table, coalitions, and choices.'
    },
    project: {
      key: 'project',
      family: 'structure',
      selected: 'screen_header',
      labelKey: 'create.gameInfo',
      fallback: 'Game Info',
      intentKey: 'systemUi.recipe.project.intent',
      intentFallback: 'Edit the game title, author, and IFID where the player sees the game identity.'
    }
  };

  const FAMILY_ORDER = ['structure', 'main', 'interactive', 'results', 'sidebar'];
  const FAMILY_LABELS = {
    structure: {labelKey: 'systemUi.family.structure', fallback: 'Screen structure'},
    main: {labelKey: 'systemUi.family.main', fallback: 'Main content'},
    interactive: {labelKey: 'systemUi.family.interactive', fallback: 'Interactive objects'},
    results: {labelKey: 'systemUi.family.results', fallback: 'Election results'},
    sidebar: {labelKey: 'systemUi.family.sidebar', fallback: 'Sidebar / Status'}
  };

  function buildScreen(model, options) {
    const opts = isObject(options) ? options : {};
    const source = isObject(model) ? model : {};
    const template = normalizeTemplate(source.template || source.objectKind || source.mode);
    const recipe = RECIPES[template] || RECIPES.entry;
    const fields = fieldMap(source);
    const fixtureState = systemUiFixtureState(opts.fixture);
    const sourceEvidence = ensureArray(source.contextBoard && source.contextBoard.sourceEvidence);
    const sourceUi = buildSourceUi(opts.projectIndex, fixtureState);
    const activePlayerScreen = normalizePlayerFlowScreen(opts.playerFlowScreen) || defaultPlayerFlowScreen(template);
    const sidebarCategories = buildSidebarCategories(fields, template, fixtureState, opts.projectIndex);
    const selectedSidebarCategory = selectSidebarCategory(sidebarCategories, opts.selected);
    const libraryContent = buildLibraryContent(opts.projectIndex);
    const rawRegions = template === 'election_results'
      ? buildElectionResultsRegions(fields)
      : buildRegions(fields, template, fixtureState, selectedSidebarCategory, sourceUi, activePlayerScreen, libraryContent);
    const regions = enrichRegions(rawRegions, {template, sourceEvidence, fixtureState});
    const selectedFallback = defaultSelectedRegionForPlayerScreen(recipe.selected, activePlayerScreen, sourceUi, libraryContent);
    const selectedKey = selectRegionKey(regions, opts.selected, selectedFallback);
    const selected = regionByKey(regions, selectedKey) || regions[0] || null;
    const focusFamilies = recipeFocusFamilies(recipe, selected);
    const screen = {
      schemaVersion: '0.1',
      kind: 'system_ui_screen_model',
      template,
      fixture: fixtureState.key,
      fixtureState,
      fixtures: systemUiFixtures(),
      recipe,
      families: FAMILY_ORDER.map((key) => Object.assign({key, active: focusFamilies.includes(key)}, FAMILY_LABELS[key])),
      focusFamilies,
      selectedKey: selected ? 'ui:' + selected.key : '',
      selected,
      regions,
      sidebarCategories: sidebarCategories.map((category) => Object.assign({}, category, {
        selected: selectedSidebarCategory && category.id === selectedSidebarCategory.id
      })),
      selectedSidebarCategory,
      libraryContent,
      sourceUi,
      shell: buildShell(fields, template, fixtureState),
      electionResults: template === 'election_results' ? buildElectionResultsView(fields) : null,
      diagnostics: []
    };
    screen.regionContext = buildRegionContext(screen, {recipe, fixture: fixtureState});
    screen.diagnostics = buildDiagnostics(template, recipe, selected, screen.regionContext, fixtureState);
    attachCapabilityMatrix(screen, {runtimeVisualSurface: opts.runtimeVisualSurface});
    attachSemanticTasks(screen);
    attachPlayerFlow(screen, {activeScreen: opts.playerFlowScreen, selected: opts.selected});
    return screen;
  }

  function attachPlayerFlow(screen, options) {
    const flow = buildPlayerFlow(screen, options || {});
    screen.playerFlow = flow;
    screen.selectedSlot = selectVisibleSlot(flow, options && options.selected, screen.selected && screen.selected.key, screen.selectedSidebarCategory);
  }

  function buildPlayerFlow(screen, options) {
    const activeScreen = normalizePlayerFlowScreen(options && options.activeScreen) || defaultPlayerFlowScreen(screen && screen.template);
    const screens = screen && screen.template === 'election_results'
      ? electionPlayerScreens(screen)
      : [
        playerScreen('entry_menu', 'systemUi.flow.entry', 'Entry', entryMenuSlots(screen)),
        playerScreen('library_page', 'systemUi.flow.library', 'Library', libraryPageSlots(screen)),
        playerScreen('in_game', 'systemUi.flow.inGame', 'In game', inGameSlots(screen))
      ];
    const byScreen = {};
    const bySlot = {};
    screens.forEach((item) => {
      byScreen[item.id] = item;
      ensureArray(item.slots).forEach((slot) => {
        bySlot[slot.id] = slot;
      });
    });
    return {
      schemaVersion: '0.1',
      kind: 'system_ui_player_flow',
      activeScreen,
      screens,
      byScreen,
      bySlot
    };
  }

  function electionPlayerScreens(screen) {
    return [
      playerScreen('entry_menu', 'systemUi.flow.entry', 'Entry', [
        visibleSlot(screen, 'entry_menu.election_intro', 'entry_menu', 'election_results_frame', 'Election result intro', {actionKind: 'edit_fields', preferredTask: 'election_intro'}),
        visibleSlot(screen, 'entry_menu.election_choices', 'entry_menu', 'election_results_choices', 'Election result choices', {actionKind: 'edit_fields', preferredTask: 'election_choices'})
      ]),
      playerScreen('library_page', 'systemUi.flow.library', 'Library', [
        visibleSlot(screen, 'library_page.election_intro', 'library_page', 'election_results_frame', 'Election result intro', {actionKind: 'edit_fields', preferredTask: 'election_intro'})
      ]),
      playerScreen('in_game', 'systemUi.flow.inGame', 'In game', [
        visibleSlot(screen, 'in_game.election_intro', 'in_game', 'election_results_frame', 'Election result intro', {actionKind: 'edit_fields', preferredTask: 'election_intro'}),
        visibleSlot(screen, 'in_game.election_chart', 'in_game', 'election_results_chart', 'Seat chart', {actionKind: 'runtime_review', preferredTask: 'election_chart_review'}),
        visibleSlot(screen, 'in_game.election_table', 'in_game', 'election_results_table', 'Party result table', {actionKind: 'edit_fields', preferredTask: 'election_party_table'}),
        visibleSlot(screen, 'in_game.election_coalitions', 'in_game', 'election_results_coalitions', 'Coalition copy', {actionKind: 'edit_fields', preferredTask: 'election_coalitions'}),
        visibleSlot(screen, 'in_game.election_choices', 'in_game', 'election_results_choices', 'Election result choices', {actionKind: 'edit_fields', preferredTask: 'election_choices'})
      ])
    ];
  }

  function playerScreen(id, labelKey, fallback, slots) {
    return {
      id,
      labelKey,
      fallback,
      slots: ensureArray(slots).filter((slot) => slot && slot.id)
    };
  }

  function entryMenuSlots(screen) {
    const entry = screen && screen.sourceUi && screen.sourceUi.entry || {};
    const entryRoute = {
      workspace: 'content',
      template: 'existing',
      view: 'events',
      sceneId: entry.sceneId || 'root',
      sectionId: 'start'
    };
    const optionSlots = ensureArray(entry.options).length
      ? ensureArray(entry.options).map((option, index) => visibleSlot(screen, 'entry_menu.option:' + safeSlotId(option.id || option.targetId || String(index + 1)), 'entry_menu', 'main_options', option.label || 'Start game option', {
        actionKind: 'open_content_scene',
        fields: [],
        taskId: '',
        sourceState: entry.sceneId ? 'source_backed' : 'manual_review',
        title: option.label || '',
        body: option.targetId || '',
        route: entryRoute,
        manualReasonKey: 'systemUi.manual.entryChoice',
        manualReason: 'This opening choice belongs to the root scene. Open the content editor to change its label, conditions, effects, or route.'
      }))
      : [visibleSlot(screen, 'entry_menu.start_option', 'entry_menu', 'main_options', entry.optionLabel || 'Start game option', {actionKind: 'open_content_scene', fields: [], taskId: '', sourceState: entry.sceneId ? 'source_backed' : 'manual_review', title: entry.optionLabel || '', body: entry.optionTargetId || '', route: entryRoute, manualReasonKey: 'systemUi.manual.entryChoice', manualReason: 'This opening choice belongs to the root scene. Open the content editor to change its label, conditions, effects, or route.'})];
    return [
      visibleSlot(screen, 'entry_menu.header', 'entry_menu', 'screen_header', 'Game title and top menu', {actionKind: 'edit_fields', preferredTask: 'identity_title'}),
      visibleSlot(screen, 'entry_menu.library_button', 'entry_menu', 'screen_header', 'Library button', libraryButtonSlotOptions(screen)),
      visibleSlot(screen, 'entry_menu.sidebar_status', 'entry_menu', 'sidebar_status', 'Sidebar status', {actionKind: 'sidebar_composer', preferredTask: 'sidebar_edit_section'}),
      visibleSlot(screen, 'entry_menu.main_copy', 'entry_menu', 'main_content', entry.heading || entry.title || 'Entry page text', {actionKind: 'open_content_scene', fields: [], taskId: '', sourceState: entry.sceneId ? 'source_backed' : 'manual_review', title: entry.heading || entry.title || '', body: ensureArray(entry.options).length ? '' : entry.body || '', route: entryRoute, manualReasonKey: 'systemUi.manual.entrySceneContent', manualReason: 'This is the opening scene content. Open the owning content editor to change what the player reads before starting.'})
    ].concat(optionSlots, sidebarTabSlots(screen, 'entry_menu'));
  }

  function libraryPageSlots(screen) {
    const library = screen && screen.libraryContent || {};
    const sections = ensureArray(library.sections);
    const slots = [
      visibleSlot(screen, 'library_page.header', 'library_page', 'screen_header', 'Game title and top menu', {actionKind: 'edit_fields', preferredTask: 'identity_title'}),
      visibleSlot(screen, 'library_page.library_button', 'library_page', 'screen_header', 'Library button', libraryButtonSlotOptions(screen)),
      visibleSlot(screen, 'library_page.sidebar_status', 'library_page', 'sidebar_status', 'Sidebar status', {actionKind: 'sidebar_composer', preferredTask: 'sidebar_edit_section'})
    ].concat(sidebarTabSlots(screen, 'library_page'));
    if (!sections.length) {
      slots.push(visibleSlot(screen, 'library_page.content', 'library_page', 'main_content', library.title || 'Library content', {
        actionKind: 'open_content_scene',
        preferredTask: 'library_content',
        sourceState: library.sourceBacked ? 'source_backed' : 'manual_review',
        route: {workspace: 'content', template: 'existing', view: 'events', sceneId: library.sceneId || 'library', sectionId: ''}
      }));
      return slots;
    }
    return slots.concat(sections.map((section) => visibleSlot(screen, 'library_page.section:' + safeSlotId(section.id || section.label), 'library_page', 'main_content', section.label || library.title || 'Library content', {
      actionKind: 'open_content_scene',
      preferredTask: 'library_content',
      sourceState: section.sourceBacked ? 'source_backed' : 'manual_review',
      title: section.label || library.title || 'Library',
      body: section.body || '',
      route: section.route || {workspace: 'content', template: 'existing', view: 'events', sceneId: library.sceneId || 'library', sectionId: section.id || ''}
    })));
  }

  function inGameSlots(screen) {
    const gameScene = screen && screen.sourceUi && screen.sourceUi.inGame && screen.sourceUi.inGame.scene || {};
    const gameRoute = {
      workspace: 'content',
      template: 'existing',
      view: 'events',
      sceneId: gameScene.sceneId || 'main',
      sectionId: 'start'
    };
    return [
      visibleSlot(screen, 'in_game.header', 'in_game', 'screen_header', 'Game title and top menu', {actionKind: 'edit_fields', preferredTask: 'identity_title'}),
      visibleSlot(screen, 'in_game.library_button', 'in_game', 'screen_header', 'Library button', libraryButtonSlotOptions(screen)),
      visibleSlot(screen, 'in_game.sidebar_status', 'in_game', 'sidebar_status', 'Sidebar status', {actionKind: 'sidebar_composer', preferredTask: 'sidebar_edit_section'}),
      visibleSlot(screen, 'in_game.scene_copy', 'in_game', 'main_content', gameScene.heading || gameScene.title || 'Current scene text', {actionKind: 'open_content_scene', fields: [], taskId: '', sourceState: gameScene.sceneId ? 'source_backed' : 'manual_review', title: gameScene.heading || gameScene.title || '', body: gameScene.body || '', route: gameRoute, manualReasonKey: 'systemUi.manual.inGameSceneContent', manualReason: 'This is scene content. Open the owning content editor to change the player-facing passage.'}),
      visibleSlot(screen, 'in_game.scene_option', 'in_game', 'main_options', gameScene.optionLabel || 'Visible choice', {actionKind: 'open_content_scene', fields: [], taskId: '', sourceState: gameScene.sceneId ? 'source_backed' : 'manual_review', title: gameScene.optionLabel || '', body: gameScene.optionTargetId || '', route: gameRoute, manualReasonKey: 'systemUi.manual.inGameSceneChoice', manualReason: 'This choice belongs to the current scene. Open the content editor to change its label, conditions, effects, or route.'}),
      visibleSlot(screen, 'in_game.layout', 'in_game', 'layout_frame', 'Screen layout', {actionKind: 'edit_fields', preferredTask: 'layout_shell'}),
      visibleSlot(screen, 'in_game.deck', 'in_game', 'deck_lane', 'Decks', {actionKind: 'edit_fields', preferredTask: 'deck_labels'}),
      visibleSlot(screen, 'in_game.hand', 'in_game', 'workspace_hand', 'Hand area', {actionKind: 'edit_fields', preferredTask: 'hand_surface'}),
      visibleSlot(screen, 'in_game.card', 'in_game', 'action_card', 'Visible card', {actionKind: 'edit_fields', preferredTask: 'action_card_copy'}),
      visibleSlot(screen, 'in_game.advisors', 'in_game', 'advisor_lane', 'Advisors', {actionKind: 'edit_fields', preferredTask: 'advisor_copy'})
    ].concat(sidebarTabSlots(screen, 'in_game'));
  }

  function sidebarTabSlots(screen, screenId) {
    return ensureArray(screen && screen.sidebarCategories).map((category) => visibleSlot(screen, screenId + '.sidebar_tab:' + safeSlotId(category.id || category.label), screenId, 'sidebar_status', category.label || category.heading || category.id || 'Sidebar tab', {
      actionKind: 'sidebar_composer',
      preferredTask: 'sidebar_edit_section',
      categoryId: category.id || '',
      title: category.heading || category.label || category.id || '',
      body: combineSidebarPreviewLines(category.body || '', category.statusLines || ''),
      sourceState: category.source === 'source' ? 'source_backed' : category.source || 'manual_review'
    }));
  }

  function libraryButtonSlotOptions(screen) {
    const library = screen && screen.libraryContent || {};
    const section = ensureArray(library.sections).find((item) => item && item.sourceBacked) || ensureArray(library.sections)[0] || {};
    return {
      actionKind: 'open_content_scene',
      preferredTask: 'library_content',
      sourceState: 'generated_only',
      runtimeEvidenceState: 'generated_only',
      manualReasonKey: 'systemUi.manual.libraryButtonChrome',
      manualReason: 'The top Library button is generated/runtime chrome; click it to edit the source-backed Library page content instead.',
      route: section.route || {workspace: 'content', template: 'existing', view: 'events', sceneId: library.sceneId || 'library', sectionId: section.id || ''}
    };
  }

  function visibleSlot(screen, id, screenId, regionKey, label, options) {
    const opts = options || {};
    const region = regionByKey(screen && screen.regions, regionKey) || {};
    const task = taskForSlot(region, opts.preferredTask);
    const capability = isObject(region.capability) ? region.capability : {};
    const fields = opts.fields || task && task.fields || region.fields || [];
    const sourceState = opts.sourceState || task && task.sourceEvidenceState || sourceStateFromFields(fields) || capability.runtimeEvidenceState || '';
    return {
      id,
      screen: screenId,
      label: String(label || region.title || region.fallback || regionKey || ''),
      regionKey,
      title: String(opts.title || region.title || label || ''),
      body: String(opts.body !== undefined ? opts.body : region.body || ''),
      editableFields: ensureArray(fields).map(slotField),
      actionKind: opts.actionKind || task && task.actionKind || 'edit_fields',
      sourceState,
      sourceEvidenceState: sourceState,
      runtimeEvidenceState: opts.runtimeEvidenceState || task && task.runtimeEvidenceState || capability.runtimeEvidenceState || '',
      safety: task && task.safety || capability.installSafety || 'manual_review',
      template: String(screen && screen.template || ''),
      internalTemplate: task && task.internalTemplate || capability.ownerTemplate || region.ownerTemplate || '',
      focusFieldId: opts.focusFieldId || task && task.primaryFieldId || '',
      taskId: opts.taskId !== undefined ? String(opts.taskId || '') : task && task.id || '',
      categoryId: opts.categoryId || '',
      route: opts.route || null,
      manualReasonKey: opts.manualReasonKey || task && task.manualReasonKey || '',
      manualReason: opts.manualReason || task && task.manualReason || capability.manualReason || ''
    };
  }

  function taskForSlot(region, preferredIntent) {
    const tasks = ensureArray(region && region.semanticTasks);
    if (preferredIntent) {
      const found = tasks.find((task) => task && task.intent === preferredIntent);
      if (found) {
        return found;
      }
    }
    return tasks.find((task) => ensureArray(task && task.fields).length) || tasks[0] || null;
  }

  function slotField(field) {
    return {
      id: String(field && field.id || ''),
      label: String(field && field.label || field && field.id || ''),
      value: String(field && (field.value !== undefined ? field.value : field.original) || ''),
      sourceEvidenceState: String(field && field.sourceEvidenceState || ''),
      installSafety: String(field && field.installSafety || '')
    };
  }

  function sourceStateFromFields(fields) {
    const states = ensureArray(fields).map((field) => String(field && field.sourceEvidenceState || '')).filter(Boolean);
    if (states.includes('source_backed')) {
      return 'source_backed';
    }
    if (states.includes('ambiguous')) {
      return 'ambiguous';
    }
    if (states.includes('generated_only')) {
      return 'generated_only';
    }
    return states[0] || '';
  }

  function selectVisibleSlot(flow, selected, selectedRegionKey, selectedSidebarCategory) {
    const slots = ensureArray(flow && flow.byScreen && flow.byScreen[flow.activeScreen] && flow.byScreen[flow.activeScreen].slots);
    const selectedText = String(selected || '').replace(/^ui:/, '');
    const explicitSlot = selectedText.indexOf('slot:') === 0 ? selectedText.slice('slot:'.length) : '';
    if (explicitSlot && flow && flow.bySlot && flow.bySlot[explicitSlot]) {
      return flow.bySlot[explicitSlot];
    }
    const categoryId = selectedText.indexOf('sidebar_category:') === 0
      ? selectedText.slice('sidebar_category:'.length)
      : '';
    if (categoryId) {
      const categorySlot = slots.find((slot) => slot && slot.categoryId === categoryId);
      if (categorySlot) {
        return categorySlot;
      }
    }
    return slots.find((slot) => slot && slot.regionKey === selectedRegionKey) || slots[0] || null;
  }

  function defaultSelectedRegionForPlayerScreen(fallback, activeScreen, sourceUi, libraryContent) {
    const screen = normalizePlayerFlowScreen(activeScreen) || 'entry_menu';
    if (screen === 'entry_menu' && String(fallback || '') !== 'screen_header' && ensureArray(sourceUi && sourceUi.entry && sourceUi.entry.options).length) {
      return 'main_options';
    }
    if (screen === 'library_page' && (libraryContent && libraryContent.exists || ensureArray(libraryContent && libraryContent.sections).length)) {
      return 'main_content';
    }
    if (screen === 'in_game' && String(fallback || '') === 'workspace_hand') {
      return 'main_content';
    }
    return fallback;
  }

  function defaultPlayerFlowScreen(template) {
    const value = String(template || '');
    if (value === 'play_surface' || value === 'workspace_layout' || value === 'sidebar_status' || value === 'election_results') {
      return 'in_game';
    }
    return 'entry_menu';
  }

  function normalizePlayerFlowScreen(value) {
    const text = String(value || '').trim();
    return ['entry_menu', 'library_page', 'in_game'].includes(text) ? text : '';
  }

  function safeSlotId(value) {
    return String(value || 'slot').trim().replace(/[^A-Za-z0-9_.:-]+/g, '_') || 'slot';
  }

  function buildRegions(fields, template, fixture, selectedSidebarCategory, sourceUi, activePlayerScreen, libraryContent) {
    const source = sourceUi || {};
    const rootTitle = value(fields, ['project.gameTitle', 'entry.rootTitle', 'play.title', 'layout.title', 'sidebar.statusTitle'], source.entry && source.entry.title || 'Dynamic Social Democracy');
    const headerBody = value(fields, ['project.author', 'project.ifid'], 'Library / Save/Load / Options');
    const hasSelectedSidebarCategory = Boolean(selectedSidebarCategory && selectedSidebarCategory.id);
    const sidebarTitle = hasSelectedSidebarCategory ? selectedSidebarCategory.heading : value(fields, ['sidebar.statusTitle', 'entry.sidebarTitle', 'layout.sidebarHeading'], source.sidebar && source.sidebar.heading || 'Status');
    const sidebarBody = hasSelectedSidebarCategory ? selectedSidebarCategory.body : value(fields, ['sidebar.sectionBody', 'entry.sidebarBody', 'layout.sidebarBody'], source.sidebar && source.sidebar.body || fixture.sidebarBody || 'Resources available: 0');
    const authoredStatusLines = hasSelectedSidebarCategory ? selectedSidebarCategory.statusLines : value(fields, ['sidebar.sectionStatusLines', 'entry.sidebarStatusLines', 'layout.sidebarStatusLines'], '');
    const fixtureStatusLines = ensureArray(fixture.statusLines).join('\n');
    const statusLines = sidebarStatusLinesForPreview({
      authoredStatusLines,
      fixtureStatusLines,
      fixtureKey: fixture.key,
      hasSelectedSidebarCategory
    });
    const entryTitle = source.entry && (source.entry.heading || source.entry.title) || 'Read.';
    const playScene = source.inGame && source.inGame.scene || {};
    const librarySection = ensureArray(libraryContent && libraryContent.sections).find((section) => section && section.sourceBacked) || ensureArray(libraryContent && libraryContent.sections)[0] || {};
    const mainScreen = normalizePlayerFlowScreen(activePlayerScreen) || defaultPlayerFlowScreen(template);
    const entryMain = mainScreen === 'entry_menu';
    const libraryMain = mainScreen === 'library_page';
    const mainTitle = entryMain
      ? value(fields, ['entry.rootTitle', 'sidebar.sectionHeading'], entryTitle)
      : libraryMain
        ? libraryContent && libraryContent.title || librarySection.label || 'Library'
        : value(fields, ['entry.rootTitle', 'sidebar.sectionHeading'], playScene.title || entryTitle);
    const mainHeading = entryMain
      ? value(fields, ['entry.rootHeading', 'sidebar.sectionHeading'], source.entry && source.entry.heading || mainTitle)
      : libraryMain
        ? librarySection.label || libraryContent && libraryContent.title || mainTitle
        : value(fields, ['entry.rootHeading', 'sidebar.sectionHeading'], playScene.heading || playScene.title || mainTitle);
    const mainBody = entryMain
      ? value(fields, ['entry.rootIntro', 'sidebar.sectionBody'], source.entry && source.entry.body || fixture.mainHint || 'This is the player-facing reading area.')
      : libraryMain
        ? librarySection.body || libraryContent && libraryContent.manualReason || ''
        : value(fields, ['entry.rootIntro', 'sidebar.sectionBody'], playScene.body || source.entry && source.entry.body || fixture.mainHint || 'This is the player-facing reading area.');
    const mainOption = entryMain
      ? value(fields, ['entry.firstOptionTitle'], source.entry && source.entry.optionLabel || fixture.optionHint || 'Continue')
      : libraryMain
        ? librarySection.label || 'Open Library section'
        : value(fields, ['entry.firstOptionTitle'], playScene.optionLabel || source.entry && source.entry.optionLabel || fixture.optionHint || 'Continue');
    const deckTitle = value(fields, ['play.deckTitle', 'layout.deckTitle'], source.play && source.play.deck && source.play.deck.title || 'Starter Deck');
    const deckSubtitle = value(fields, ['play.deckSubtitle', 'layout.deckSubtitle'], source.play && source.play.deck && source.play.deck.body || fixture.interactiveHint || 'Repeatable actions');
    const cardTitle = value(fields, ['play.cardTitle', 'layout.starterCardTitle'], source.play && source.play.card && source.play.card.title || 'Action Card');
    const cardBody = value(fields, ['play.cardBody', 'layout.starterCardBody'], source.play && source.play.card && source.play.card.body || 'A playable card appears here.');
    const advisorTitle = value(fields, ['play.advisorTitle'], source.play && source.play.advisor && source.play.advisor.title || 'Advisor');
    const advisorBody = value(fields, ['play.advisorBody'], source.play && source.play.advisor && source.play.advisor.body || 'A pinned advisor or standing object lives beside the hand.');
    const handTitle = value(fields, ['play.handTitle', 'play.handHeading'], source.play && source.play.hand && source.play.hand.title || 'Workspace Hand');
    const handBody = value(fields, ['play.handBody'], source.play && source.play.hand && source.play.hand.body || 'This area holds repeatable player actions.');

    return [
      region('layout_frame', 'structure', 'systemUi.region.layoutFrame', 'Screen frame', rootTitle, 'Header, sidebar, main card, and interactive lane share one screen shell.', fieldsFor(fields, fieldIdsForTemplate(template, 'structure'))),
      region('screen_header', 'structure', 'systemUi.region.header', 'Header / menu', rootTitle, headerBody, fieldsFor(fields, ['project.gameTitle', 'project.author', 'project.ifid', 'entry.rootTitle', 'play.title', 'layout.title', 'sidebar.statusTitle'])),
      region('main_content', 'main', 'systemUi.region.mainContent', 'Main content', mainHeading, mainBody, fieldsFor(fields, fieldIdsForTemplate(template, 'main'))),
      region('main_options', 'main', 'systemUi.region.options', 'Options', mainOption, value(fields, ['entry.firstTargetId', 'layout.starterCardReturnTarget'], ''), fieldsFor(fields, ['entry.firstOptionTitle', 'entry.firstTargetId', 'layout.handOptionLabel', 'play.handDeckOptionLabel', 'play.handAdvisorOptionLabel'])),
      region('workspace_hand', 'interactive', 'systemUi.region.hand', 'Hand', handTitle, handBody, fieldsFor(fields, ['play.handTitle', 'play.handHeading', 'play.handBody', 'play.handDeckOptionLabel', 'play.handAdvisorOptionLabel'])),
      region('deck_lane', 'interactive', 'systemUi.region.deck', 'Deck', deckTitle, deckSubtitle, fieldsFor(fields, ['play.deckTitle', 'play.deckSubtitle', 'layout.deckTitle', 'layout.deckSubtitle', 'layout.deckTag'])),
      region('action_card', 'interactive', 'systemUi.region.card', 'Card', cardTitle, cardBody, fieldsFor(fields, ['play.cardTitle', 'play.cardHeading', 'play.cardBody', 'play.cardOption0Label', 'play.cardOption1Label', 'layout.starterCardTitle', 'layout.starterCardHeading', 'layout.starterCardBody', 'layout.starterCardOption0Label', 'layout.starterCardOption1Label'])),
      region('advisor_lane', 'interactive', 'systemUi.region.advisor', 'Advisor', advisorTitle, advisorBody, fieldsFor(fields, ['play.advisorTitle', 'play.advisorSubtitle', 'play.advisorHeading', 'play.advisorBody', 'play.advisorOption0Label'])),
      region('sidebar_status', 'sidebar', 'systemUi.region.sidebar', 'Sidebar / Status', sidebarTitle, combineSidebarPreviewLines(sidebarBody, statusLines), selectedSidebarCategory && selectedSidebarCategory.fields && selectedSidebarCategory.fields.length ? selectedSidebarCategory.fields : fieldsFor(fields, fieldIdsForTemplate(template, 'sidebar')))
    ];
  }

  function buildElectionResultsRegions(fields) {
    const view = buildElectionResultsView(fields);
    const partyChartFields = electionPartyFieldIds(fields, ['color', 'seats', 'seatsShare']).concat(['election.seatsTotal']);
    const partyTableFields = electionPartyFieldIds(fields, ['key', 'name', 'color', 'voteShare', 'voteChange', 'seatsShare', 'seatsChange', 'seats']);
    const coalitionFields = electionCoalitionFieldIds(fields, ['key', 'name', 'parties', 'share', 'description']);
    const choiceFields = electionChoiceFieldIds(fields, ['key', 'label', 'detail', 'disabled']);
    return [
      region(
        'election_results_frame',
        'structure',
        'systemUi.region.electionFrame',
        'Election frame',
        view.title,
        [view.subtitle, view.sourcePath].filter(Boolean).join('\n'),
        fieldsFor(fields, ['election.title', 'election.subtitle', 'election.intro', 'election.sourcePath', 'election.id'])
      ),
      region(
        'election_results_chart',
        'results',
        'systemUi.region.electionChart',
        'Seat chart',
        view.subtitle || view.title,
        String(view.seatsTotal || '') + ' seats / ' + String(view.parties.length || 0) + ' parties',
        fieldsFor(fields, partyChartFields)
      ),
      region(
        'election_results_table',
        'results',
        'systemUi.region.electionTable',
        'Party result table',
        'Party vote and seat shares',
        view.parties.map((party) => party.name + ' ' + formatPercent(party.voteShare)).join(', '),
        fieldsFor(fields, partyTableFields)
      ),
      region(
        'election_results_coalitions',
        'results',
        'systemUi.region.electionCoalitions',
        'Coalitions',
        'Potential coalitions',
        view.coalitions.map((coalition) => coalition.name + ' ' + formatPercent(coalition.share)).join(', '),
        fieldsFor(fields, ['election.intro'].concat(coalitionFields))
      ),
      region(
        'election_results_choices',
        'main',
        'systemUi.region.electionChoices',
        'Player choices',
        'Coalition choices',
        view.choices.map((choice) => choice.label).join('\n'),
        fieldsFor(fields, choiceFields)
      )
    ];
  }

  function buildElectionResultsView(fields) {
    const parties = fieldIndices(fields, 'election.party').map((index) => ({
      key: value(fields, ['election.party.' + index + '.key'], 'party_' + (index + 1)),
      name: value(fields, ['election.party.' + index + '.name'], 'Party ' + (index + 1)),
      color: safeColor(value(fields, ['election.party.' + index + '.color'], '#999999')),
      voteShare: numberValue(fields, 'election.party.' + index + '.voteShare', 0),
      voteChange: numberValue(fields, 'election.party.' + index + '.voteChange', 0),
      seatsShare: numberValue(fields, 'election.party.' + index + '.seatsShare', 0),
      seatsChange: numberValue(fields, 'election.party.' + index + '.seatsChange', 0),
      seats: numberValue(fields, 'election.party.' + index + '.seats', 0)
    })).filter((party) => party.name);
    const coalitions = fieldIndices(fields, 'election.coalition').map((index) => ({
      key: value(fields, ['election.coalition.' + index + '.key'], 'coalition_' + (index + 1)),
      name: value(fields, ['election.coalition.' + index + '.name'], 'Coalition ' + (index + 1)),
      parties: value(fields, ['election.coalition.' + index + '.parties'], ''),
      share: numberValue(fields, 'election.coalition.' + index + '.share', 0),
      description: value(fields, ['election.coalition.' + index + '.description'], '')
    })).filter((coalition) => coalition.name);
    const choices = fieldIndices(fields, 'election.choice').map((index) => ({
      key: value(fields, ['election.choice.' + index + '.key'], 'choice_' + (index + 1)),
      label: value(fields, ['election.choice.' + index + '.label'], 'Choice ' + (index + 1)),
      detail: value(fields, ['election.choice.' + index + '.detail'], ''),
      disabled: booleanValue(value(fields, ['election.choice.' + index + '.disabled'], 'false'))
    })).filter((choice) => choice.label);
    return {
      title: value(fields, ['election.title'], 'Election Results'),
      subtitle: value(fields, ['election.subtitle'], 'Reichstag election results'),
      intro: value(fields, ['election.intro'], 'There are some potential coalition arrangements.'),
      sourcePath: value(fields, ['election.sourcePath'], ''),
      seatsTotal: numberValue(fields, 'election.seatsTotal', partySeatTotal(parties) || 515),
      parties,
      coalitions,
      choices
    };
  }

  function buildSourceUi(projectIndex, fixture) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const entry = buildEntrySource(index);
    const play = buildPlaySource(index);
    const sidebar = buildSidebarSource(index, fixture);
    return {
      entry,
      inGame: {
        scene: buildInGameSceneSource(index, entry)
      },
      play,
      sidebar
    };
  }

  function buildEntrySource(index) {
    const rootScene = findRootScene(index);
    const options = rootOptionSources(index, rootScene);
    const api = entrySidebarApi();
    if (api && typeof api.buildEntryModel === 'function') {
      try {
        const model = api.buildEntryModel(index);
        const root = model && model.root || {};
        const entryOptions = options.length ? options : root.firstOption ? [{
          id: root.firstOption.id || root.firstOption.targetId || 'start',
          label: root.firstOption.title || 'Start',
          targetId: root.firstOption.targetId || ''
        }] : [];
        return {
          sceneId: root.id || 'root',
          title: root.title || root.heading || 'Dynamic Social Democracy',
          heading: root.heading || root.title || 'Dynamic Social Democracy',
          body: root.intro || '',
          optionLabel: entryOptions[0] && entryOptions[0].label || 'Start',
          optionTargetId: entryOptions[0] && entryOptions[0].targetId || '',
          options: entryOptions
        };
      } catch (_err) {}
    }
    const root = rootScene;
    const surface = sceneTextSurface(index, root && root.id || 'root');
    const entryOptions = options.length ? options : [];
    return {
      sceneId: root && root.id || 'root',
      title: root && root.title || surface.title || 'Dynamic Social Democracy',
      heading: surface.heading || root && root.title || 'Dynamic Social Democracy',
      body: surface.body || '',
      optionLabel: entryOptions[0] && entryOptions[0].label || 'Start',
      optionTargetId: entryOptions[0] && entryOptions[0].targetId || '',
      options: entryOptions
    };
  }

  function rootOptionSources(index, root) {
    const scene = isObject(root) ? root : {};
    const fromScene = ensureArray(scene.options).map((option, index) => ({
      id: safeSlotId(option && (option.id || option.itemId || optionTargetId(option)) || 'option_' + String(index + 1)),
      label: String(option && (option.title || option.label || option.text) || 'Option ' + String(index + 1)),
      targetId: optionTargetId(option),
      line: sourceLine(option && (option.sourceSpan || option.source || option.metadata))
    })).filter((option) => option.label);
    if (fromScene.length) {
      return fromScene;
    }
    return ensureArray(index && index.semantic && index.semantic.textCorpus && index.semantic.textCorpus.items)
      .filter((row) => row && row.owner && String(row.owner.sceneId || '') === String(scene.id || 'root') && String(row.role || '') === 'option_label')
      .sort((a, b) => sourceLine(a.source) - sourceLine(b.source))
      .map((row, index) => ({
        id: safeSlotId(row.owner && row.owner.itemId || row.id || 'option_' + String(index + 1)),
        label: String(row.text || row.label || 'Option ' + String(index + 1)),
        targetId: String(row.owner && row.owner.itemId || '').replace(/^[@#.]/, ''),
        line: sourceLine(row.source)
      }));
  }

  function buildInGameSceneSource(index, entry) {
    const targetId = entry && entry.optionTargetId || '';
    const targetScene = sceneById(index, targetId);
    const scene = isGameplayTextScene(targetScene) ? targetScene : firstPlayableScene(index) || findRootScene(index) || targetScene || {};
    const surface = sceneTextSurface(index, scene.id || targetId);
    const option = ensureArray(scene.options)[0] || {};
    return {
      sceneId: scene.id || targetId || '',
      title: surface.title || scene.title || entry && entry.heading || 'Current scene',
      heading: surface.heading || surface.title || scene.title || '',
      body: surface.body || entry && entry.body || '',
      optionLabel: option.title || entry && entry.optionLabel || 'Continue',
      optionTargetId: optionTargetId(option)
    };
  }

  function buildPlaySource(index) {
    const api = playSurfaceApi();
    if (api && typeof api.buildSurfaceModel === 'function') {
      try {
        const model = api.buildSurfaceModel(index);
        return {
          hand: playSceneSource(index, model && model.hand, 'Hand'),
          deck: playSceneSource(index, model && model.deck, 'Deck'),
          card: playSceneSource(index, model && model.card, 'Card'),
          advisor: playSceneSource(index, model && model.advisor, 'Advisor')
        };
      } catch (_err) {}
    }
    return {
      hand: playSceneSource(index, firstSceneByTypes(index, ['hand']), 'Hand'),
      deck: playSceneSource(index, firstSceneByTypes(index, ['deck']), 'Deck'),
      card: playSceneSource(index, firstSceneByTypes(index, ['card']), 'Card'),
      advisor: playSceneSource(index, firstSceneByTypes(index, ['pinned_card', 'circle']), 'Advisor')
    };
  }

  function playSceneSource(index, scene, fallback) {
    const row = isObject(scene) ? scene : {};
    const surface = sceneTextSurface(index, row.id || '');
    return {
      sceneId: row.id || '',
      title: row.title || surface.title || fallback,
      heading: row.heading || surface.heading || row.title || fallback,
      body: row.body || surface.body || '',
      optionLabel: row.options && row.options[0] && row.options[0].title || '',
      exists: Boolean(row.exists || row.id)
    };
  }

  function buildSidebarSource(index, fixture) {
    const api = sidebarStatusApi();
    if (api && typeof api.buildSidebarModel === 'function') {
      try {
        const model = api.buildSidebarModel(index);
        const section = ensureArray(model && model.sections)[0] || {};
        return {
          title: model && model.status && model.status.title || 'Status',
          heading: section.heading || model && model.status && model.status.title || 'Status',
          body: section.body || fixture && fixture.sidebarBody || '',
          statusLines: section.statusLines || ''
        };
      } catch (_err) {}
    }
    return {
      title: 'Status',
      heading: 'Status',
      body: fixture && fixture.sidebarBody || '',
      statusLines: ensureArray(fixture && fixture.statusLines).join('\n')
    };
  }

  function sceneTextSurface(index, sceneId) {
    const id = String(sceneId || '').trim();
    const scene = sceneById(index, id) || {};
    const rows = ensureArray(index && index.semantic && index.semantic.textCorpus && index.semantic.textCorpus.items)
      .filter((row) => row && row.owner && String(row.owner.sceneId || '') === id)
      .sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
    const heading = rows.find((row) => ['heading', 'title'].includes(String(row.role || '')) && String(row.text || row.label || '').trim());
    const bodyRows = rows.filter((row) => ['body', 'conditional_body', 'subtitle', 'label'].includes(String(row.role || '')));
    return {
      title: String(scene.title || heading && (heading.text || heading.label) || ''),
      heading: cleanSurfaceText(heading && (heading.text || heading.label) || scene.title || ''),
      body: bodyRows.map((row) => String(row.text || row.originalText || row.label || '').trim()).filter(Boolean).join('\n')
    };
  }

  function findRootScene(index) {
    return ensureArray(index && index.scenes).find((scene) => scene && scene.id === 'root') ||
      ensureArray(index && index.scenes).find((scene) => scene && scene.type === 'root') ||
      ensureArray(index && index.scenes).find((scene) => normalizedPath(scene && scene.path) === 'source/scenes/root.scene.dry') ||
      null;
  }

  function sceneById(index, sceneId) {
    const id = String(sceneId || '').replace(/^[@#.]/, '');
    return ensureArray(index && index.scenes).find((scene) => String(scene && scene.id || '') === id) || null;
  }

  function firstPlayableScene(index) {
    return ensureArray(index && index.scenes).find((scene) => isGameplayTextScene(scene) && String(scene.id || '') !== 'root') || null;
  }

  function isGameplayTextScene(scene) {
    const row = isObject(scene) ? scene : null;
    if (!row || !row.id) {
      return false;
    }
    const id = String(row.id || '');
    const type = String(row.type || '');
    if (['status', 'library'].includes(id)) {
      return false;
    }
    return !['status', 'hand', 'deck', 'card', 'pinned_card', 'circle'].includes(type);
  }

  function firstSceneByTypes(index, types) {
    const set = new Set(ensureArray(types).map(String));
    return ensureArray(index && index.scenes).find((scene) => scene && set.has(String(scene.type || ''))) || null;
  }

  function optionTargetId(option) {
    const row = isObject(option) ? option : {};
    return String(row.target && row.target.id || row.targetId || row.id || '').replace(/^[@#.]/, '');
  }

  function cleanSurfaceText(value) {
    return String(value || '').replace(/^=\s*/, '').trim();
  }

  function buildSidebarCategories(fields, template, fixture, projectIndex) {
    const sourceCategories = sourceSidebarCategories(projectIndex);
    const draftCategory = draftSidebarCategory(fields, template);
    const rows = sourceCategories.length ? sourceCategories.slice() : [];
    if (draftCategory && !rows.some((category) => category.id === draftCategory.id)) {
      rows.push(draftCategory);
    }
    if (!rows.length) {
      rows.push({
        id: 'main',
        label: value(fields, ['sidebar.statusTitle', 'entry.sidebarTitle'], 'Main'),
        heading: value(fields, ['sidebar.sectionHeading', 'entry.sidebarHeading'], 'Status'),
        body: value(fields, ['sidebar.sectionBody', 'entry.sidebarBody'], fixture.sidebarBody || 'Resources available: 0'),
        statusLines: value(fields, ['sidebar.sectionStatusLines', 'entry.sidebarStatusLines'], ensureArray(fixture.statusLines).join('\n')),
        source: 'fallback'
      });
    }
    return rows.map((category) => normalizeSidebarCategory(category, fields, template));
  }

  function sourceSidebarCategories(projectIndex) {
    const api = sidebarStatusApi();
    if (!api || typeof api.buildSidebarModel !== 'function') {
      return [];
    }
    try {
      const model = api.buildSidebarModel(projectIndex);
      return ensureArray(model && model.sections).map((section) => ({
        id: String(section.id || section.anchorId || 'main'),
        label: String(section.label || section.heading || section.id || 'Status'),
        heading: String(section.heading || section.label || 'Status'),
        body: String(section.body || ''),
        statusLines: String(section.statusLines || ''),
        source: 'source',
        path: section.path || '',
        line: section.line || null,
        evidence: section.evidence || null,
        deleteEvidence: section.deleteEvidence || null
      })).filter((category) => category.id);
    } catch (_err) {
      return [];
    }
  }

  function draftSidebarCategory(fields, template) {
    if (template === 'workspace_layout') {
      const id = value(fields, ['layout.sidebarCategoryId'], '');
      if (!id) {
        return null;
      }
      return {
        id,
        label: value(fields, ['layout.sidebarHeading'], id),
        heading: value(fields, ['layout.sidebarHeading'], id),
        body: value(fields, ['layout.sidebarBody'], ''),
        statusLines: value(fields, ['layout.sidebarStatusLines'], ''),
        source: 'draft_new'
      };
    }
    if (template === 'sidebar_status') {
      const id = value(fields, ['sidebar.sectionId'], '');
      if (!id) {
        return null;
      }
      return {
        id,
        label: value(fields, ['sidebar.sectionHeading'], id),
        heading: value(fields, ['sidebar.sectionHeading'], id),
        body: value(fields, ['sidebar.sectionBody'], ''),
        statusLines: value(fields, ['sidebar.sectionStatusLines'], ''),
        source: 'draft_edit'
      };
    }
    return null;
  }

  function normalizeSidebarCategory(category, fields, template) {
    const value = isObject(category) ? category : {};
    const id = safeCategoryId(value.id || value.label || 'main');
    const heading = String(value.heading || value.label || id);
    const body = String(value.body || '');
    const statusLines = String(value.statusLines || '');
    const source = String(value.source || '');
    return {
      id,
      label: String(value.label || heading || id),
      heading,
      body,
      statusLines,
      source,
      path: String(value.path || ''),
      line: value.line || null,
      evidence: isObject(value.evidence) ? value.evidence : null,
      deleteEvidence: isObject(value.deleteEvidence) ? value.deleteEvidence : null,
      canEdit: source === 'source' || source === 'draft_edit' || source === 'draft_new',
      canAddAfter: source === 'source' || source === 'draft_edit',
      canDelete: source === 'source' && isObject(value.deleteEvidence) && id !== 'main' && id !== '__main',
      deleteManualReason: source === 'source' && !isObject(value.deleteEvidence)
        ? 'This sidebar category has no exact source span for removing the tab anchor and section together.'
        : source === 'source'
          ? ''
          : 'Generated, fallback, or draft-only sidebar categories stay manual-review for deletion.',
      fields: sidebarCategoryFields({id, heading, body, statusLines, source}, fields, template)
    };
  }

  function sidebarCategoryFields(category, fields, template) {
    if (template === 'workspace_layout' && category.source === 'draft_new') {
      return fieldsFor(fields, ['layout.sidebarCategoryId', 'layout.sidebarHeading', 'layout.sidebarBody', 'layout.sidebarStatusLines', 'layout.sidebarInsertMode', 'layout.sidebarAnchorId']);
    }
    return [
      fieldLike('sidebar.sectionId', 'Section id', category.id),
      fieldLike('sidebar.sectionHeading', 'Section heading', category.heading),
      fieldLike('sidebar.sectionBody', 'Section body', category.body, {inputType: 'textarea'}),
      fieldLike('sidebar.sectionStatusLines', 'Status lines', category.statusLines, {inputType: 'textarea'}),
      Object.assign({}, fields['sidebar.operationMode'] || fieldLike('sidebar.operationMode', 'Sidebar operation', 'edit'), {readOnly: true}),
      Object.assign({}, fields['sidebar.deleteConfirm'] || fieldLike('sidebar.deleteConfirm', 'Confirm delete', 'false'), {inputType: 'checkbox'})
    ];
  }

  function selectSidebarCategory(categories, selected) {
    const value = String(selected || '').replace(/^ui:/, '');
    const id = value.indexOf('sidebar_category:') === 0 ? value.slice('sidebar_category:'.length) : '';
    if (id) {
      const found = ensureArray(categories).find((category) => category.id === id);
      if (found) {
        return found;
      }
    }
    return ensureArray(categories)[0] || null;
  }

  function buildShell(fields, template, fixture) {
    return {
      title: value(fields, ['election.title', 'project.gameTitle', 'entry.rootTitle', 'play.title', 'layout.title', 'sidebar.statusTitle'], 'Dynamic Social Democracy'),
      subtitle: value(fields, ['election.subtitle', 'project.author', 'entry.rootHeading', 'play.handHeading', 'layout.deckSubtitle', 'sidebar.sectionHeading'], 'An alternate history'),
      menu: ['Library', 'Save/Load', 'Options'],
      fixture: fixture.key || 'default',
      fixtureClass: fixture.bodyClass || '',
      template
    };
  }

  function fieldIdsForTemplate(template, family) {
    if (family === 'structure') {
      if (template === 'project') {
        return ['project.gameTitle', 'project.author', 'project.ifid'];
      }
      return template === 'workspace_layout'
        ? ['layout.title', 'layout.deckTitle', 'layout.deckSubtitle', 'layout.handOptionLabel', 'layout.handInsertMode', 'layout.sidebarCategoryId', 'layout.sidebarHeading', 'layout.sidebarBody', 'layout.sidebarStatusLines', 'layout.sidebarInsertMode', 'layout.sidebarAnchorId', 'layout.createStarterCard']
        : ['entry.rootTitle', 'play.title', 'sidebar.statusTitle'];
    }
    if (family === 'main') {
      return template === 'entry'
        ? ['entry.rootTitle', 'entry.rootHeading', 'entry.rootIntro', 'entry.firstOptionTitle', 'entry.firstTargetId']
        : ['play.handTitle', 'play.handHeading', 'play.handBody', 'layout.starterCardTitle', 'layout.starterCardHeading', 'layout.starterCardBody', 'sidebar.sectionHeading', 'sidebar.sectionBody'];
    }
    if (family === 'sidebar') {
      if (template === 'sidebar_status') {
        return ['sidebar.statusTitle', 'sidebar.sectionHeading', 'sidebar.sectionBody', 'sidebar.sectionStatusLines', 'sidebar.sectionId'];
      }
      if (template === 'entry') {
        return ['entry.sidebarTitle', 'entry.sidebarHeading', 'entry.sidebarBody', 'entry.sidebarStatusLines'];
      }
      return ['layout.sidebarHeading', 'layout.sidebarBody', 'layout.sidebarStatusLines', 'layout.sidebarCategoryId', 'layout.sidebarInsertMode'];
    }
    return [];
  }

  function electionPartyFieldIds(fields, suffixes) {
    return fieldIdsFromIndices(fields, 'election.party', suffixes);
  }

  function electionCoalitionFieldIds(fields, suffixes) {
    return fieldIdsFromIndices(fields, 'election.coalition', suffixes);
  }

  function electionChoiceFieldIds(fields, suffixes) {
    return fieldIdsFromIndices(fields, 'election.choice', suffixes);
  }

  function fieldIdsFromIndices(fields, prefix, suffixes) {
    const ids = [];
    fieldIndices(fields, prefix).forEach((index) => {
      ensureArray(suffixes).forEach((suffix) => {
        const id = prefix + '.' + index + '.' + suffix;
        if (fields[id]) {
          ids.push(id);
        }
      });
    });
    return ids;
  }

  function fieldIndices(fields, prefix) {
    const pattern = new RegExp('^' + escapeRegExp(prefix) + '\\.(\\d+)\\.');
    const seen = {};
    Object.keys(fields || {}).forEach((id) => {
      const match = id.match(pattern);
      if (match) {
        seen[Number(match[1])] = true;
      }
    });
    return Object.keys(seen).map((value) => Number(value)).sort((a, b) => a - b);
  }

  function recipeFocusFamilies(recipe, selected) {
    const family = selected && selected.family || recipe.family;
    return Array.from(new Set([recipe.family, family]));
  }

  function selectRegionKey(regions, selected, fallback) {
    const key = String(selected || '').replace(/^ui:/, '');
    const slotRegion = regionKeyForVisibleSlot(key);
    if (slotRegion && regions.some((region) => region.key === slotRegion)) {
      return slotRegion;
    }
    if (key.indexOf('sidebar_category:') === 0 && regions.some((region) => region.key === 'sidebar_status')) {
      return 'sidebar_status';
    }
    if (regions.some((region) => region.key === key)) {
      return key;
    }
    if (regions.some((region) => region.key === fallback)) {
      return fallback;
    }
    return regions[0] && regions[0].key || '';
  }

  function regionKeyForVisibleSlot(key) {
    const slot = String(key || '').indexOf('slot:') === 0 ? String(key || '').slice('slot:'.length) : '';
    if (!slot) {
      return '';
    }
    if (slot.indexOf('.sidebar_tab:') >= 0 || slot.endsWith('.sidebar_status')) {
      return 'sidebar_status';
    }
    if (slot.endsWith('.main_copy') || slot.indexOf('.section:') >= 0 || slot === 'library_page.content') {
      return 'main_content';
    }
    if (slot.endsWith('.start_option') || slot.indexOf('.option:') >= 0 || slot.endsWith('.scene_option')) {
      return 'main_options';
    }
    if (slot.endsWith('.deck')) {
      return 'deck_lane';
    }
    if (slot.endsWith('.hand')) {
      return 'workspace_hand';
    }
    if (slot.endsWith('.card')) {
      return 'action_card';
    }
    if (slot.endsWith('.advisors')) {
      return 'advisor_lane';
    }
    return '';
  }

  function buildDiagnostics(template, recipe, selected, regionContext, fixture) {
    return [
      {id: 'selected_family', labelKey: 'systemUi.diagnostic.selectedFamily', label: 'Selected family', value: selected && selected.family || ''},
      {id: 'selected_region', labelKey: 'systemUi.diagnostic.selectedRegion', label: 'Selected region', value: selected && selected.key || ''},
      {id: 'owner_template', labelKey: 'systemUi.diagnostic.ownerTemplate', label: 'Owner template', value: regionContext && regionContext.ownership && regionContext.ownership.ownerTemplate || ''},
      {id: 'fixture', labelKey: 'systemUi.diagnostic.fixture', label: 'Fixture', value: fixture && fixture.fallback || ''}
    ].concat(ensureArray(fixture && fixture.diagnostics));
  }

  function buildLibraryContent(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const scene = libraryScene(index);
    if (!scene) {
      return {
        exists: false,
        sourceBacked: false,
        sceneId: 'library',
        title: 'Library',
        sections: [],
        manualReason: 'No source-backed Library scene was found in the current ProjectIndex.'
      };
    }
    const sceneId = String(scene.id || 'library');
    const rows = ensureArray(index.semantic && index.semantic.textCorpus && index.semantic.textCorpus.items)
      .filter((row) => row && row.owner && String(row.owner.sceneId || '') === sceneId)
      .filter((row) => !isGeneratedPath(row.source && row.source.path))
      .sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
    const sections = groupLibraryRows(scene, rows);
    const sourceBacked = Boolean(normalizedPath(scene.path || '').startsWith('source/') && sections.some((section) => section.sourceBacked));
    return {
      exists: true,
      sourceBacked,
      sceneId,
      title: String(scene.title || sceneId || 'Library'),
      path: normalizedPath(scene.path || ''),
      line: sourceLine(scene.sourceSpan || scene.metadata) || null,
      sections,
      manualReason: sourceBacked ? '' : 'Library scene exists, but no exact source-backed text section was found.'
    };
  }

  function libraryScene(index) {
    const scenes = ensureArray(index && index.scenes);
    return scenes.find((scene) => String(scene && scene.id || '').toLowerCase() === 'library') ||
      scenes.find((scene) => normalizedPath(scene && scene.path).toLowerCase() === 'source/scenes/library.scene.dry') ||
      scenes.find((scene) => scene && scene.flags && scene.flags.isSpecial && /library/i.test(String(scene.title || scene.id || scene.path || ''))) ||
      null;
  }

  function groupLibraryRows(scene, rows) {
    const groups = {};
    ensureArray(scene && scene.sections).forEach((section) => {
      const id = String(section && section.id || '').trim();
      if (!id) {
        return;
      }
      groups[id] = {
        id,
        label: sectionLabel(section, id),
        sourceSpan: section.sourceSpan || null,
        rows: []
      };
    });
    ensureArray(rows).forEach((row) => {
      const sectionId = String(row && row.owner && row.owner.sectionId || '').trim() || '__intro';
      groups[sectionId] = groups[sectionId] || {id: sectionId, label: sectionLabel(null, sectionId), sourceSpan: null, rows: []};
      groups[sectionId].rows.push(row);
    });
    return Object.keys(groups)
      .filter((id) => ensureArray(groups[id].rows).length)
      .sort((a, b) => groupLine(groups[a]) - groupLine(groups[b]))
      .map((id) => librarySectionSummary(scene, groups[id]));
  }

  function librarySectionSummary(scene, group) {
    const rows = ensureArray(group && group.rows);
    const heading = rows.find((row) => String(row.role || '') === 'heading' && String(row.text || row.label || '').trim());
    const bodyRows = rows.filter((row) => ['body', 'conditional_body', 'subtitle', 'heading'].includes(String(row.role || '')));
    const first = bodyRows.find((row) => sourceLine(row.source)) || rows.find((row) => sourceLine(row.source)) || null;
    const span = group && group.sourceSpan || {};
    const path = normalizedPath(first && first.source && first.source.path || span.path || scene && scene.path || '');
    const line = sourceLine(first && first.source || span);
    return {
      id: String(group && group.id || '__intro'),
      label: String(heading && (heading.text || heading.label) || group && group.label || scene && scene.title || 'Library'),
      body: bodyRows.filter((row) => String(row.role || '') !== 'heading')
        .map((row) => String(row.text || row.originalText || row.label || '').trim())
        .filter(Boolean)
        .slice(0, 3)
        .join('\n'),
      path,
      line,
      sourceBacked: Boolean(path && path.startsWith('source/') && line),
      route: {
        workspace: 'content',
        template: 'existing',
        view: 'events',
        sceneId: String(scene && scene.id || 'library'),
        sectionId: String(group && group.id || '')
      }
    };
  }

  function sectionLabel(section, fallback) {
    return String(section && (section.title || section.label) || fallback || '')
      .replace(/^library[._-]?/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim() || 'Library';
  }

  function groupLine(group) {
    const first = ensureArray(group && group.rows).find((row) => sourceLine(row.source));
    return sourceLine(first && first.source) || sourceLine(group && group.sourceSpan) || 999999;
  }

  function sourceLine(source) {
    const line = Number(source && (source.line || source.startLine || source.$line) || 0);
    return Number.isFinite(line) && line > 0 ? Math.floor(line) : null;
  }

  function normalizedPath(value) {
    return String(value || '').replace(/\\/g, '/');
  }

  function isGeneratedPath(value) {
    const path = normalizedPath(value);
    return path.startsWith('out/') || path.includes('/out/');
  }

  function fieldMap(model) {
    const fields = {};
    flattenFields(model.eventBody || {}).forEach((field) => {
      if (field && field.id) {
        fields[field.id] = field;
      }
    });
    return fields;
  }

  function flattenFields(body) {
    return [body.title, body.heading].filter(Boolean)
      .concat(ensureArray(body.sections))
      .concat(ensureArray(body.options).reduce((all, option) => all.concat(ensureArray(option.fields)), []))
      .concat(ensureArray(body.metaFields));
  }

  function fieldsFor(fields, ids) {
    return ids.map((id) => fields[id]).filter(Boolean);
  }

  function value(fields, ids, fallback) {
    for (let index = 0; index < ids.length; index += 1) {
      const field = fields[ids[index]];
      if (field) {
        const text = String(field.value !== undefined ? field.value : field.original || '').trim();
        if (text) {
          return text;
        }
      }
    }
    return String(fallback || '');
  }

  function numberValue(fields, id, fallback) {
    const field = fields[id];
    const raw = field ? field.value !== undefined ? field.value : field.original : fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : Number(fallback) || 0;
  }

  function booleanValue(value) {
    const text = String(value || '').trim().toLowerCase();
    return text === 'true' || text === '1' || text === 'yes' || text === 'on';
  }

  function partySeatTotal(parties) {
    return ensureArray(parties).reduce((total, party) => total + (Number(party && party.seats) || 0), 0);
  }

  function formatPercent(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? String(parsed) + '%' : '';
  }

  function region(key, family, labelKey, fallback, title, body, fields) {
    return {
      key,
      family,
      labelKey,
      fallback,
      title: String(title || fallback || ''),
      body: String(body || ''),
      fields: ensureArray(fields)
    };
  }

  function fieldLike(id, label, value, extra) {
    return Object.assign({
      id,
      label,
      original: value === undefined || value === null ? '' : String(value),
      value: value === undefined || value === null ? '' : String(value),
      status: 'guarded',
      editability: 'guarded',
      source: {}
    }, extra || {});
  }

  function safeCategoryId(value) {
    const text = String(value || 'main').trim()
      .replace(/^@+/, '')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return text || 'main';
  }

  function sidebarStatusLinesForPreview(options) {
    const opts = options || {};
    const authored = String(opts.authoredStatusLines || '').trim();
    const fixture = String(opts.fixtureStatusLines || '').trim();
    if (String(opts.fixtureKey || '') !== 'default') {
      return combineSidebarPreviewLines(authored, fixture);
    }
    if (authored) {
      return authored;
    }
    if (opts.hasSelectedSidebarCategory && String(opts.fixtureKey || '') === 'default') {
      return '';
    }
    return fixture;
  }

  function combineSidebarPreviewLines(body, statusLines) {
    const rows = [];
    String(body || '').split('\n').forEach((line) => pushUniquePreviewLine(rows, line));
    String(statusLines || '').split('\n').forEach((line) => pushUniquePreviewLine(rows, line));
    return rows.join('\n');
  }

  function pushUniquePreviewLine(rows, line) {
    const text = String(line || '').trim();
    if (!text) {
      return;
    }
    const key = text.replace(/\s+/g, ' ').toLowerCase();
    if (rows.some((row) => row.replace(/\s+/g, ' ').toLowerCase() === key)) {
      return;
    }
    rows.push(text);
  }

  function safeColor(value) {
    const text = String(value || '').trim();
    return /^#[0-9A-Fa-f]{6}$/.test(text) ? text : '#999999';
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function regionByKey(regions, key) {
    return ensureArray(regions).find((region) => region.key === key) || null;
  }

  function normalizeTemplate(value) {
    const text = String(value || '').trim();
    if (text === 'entry_sidebar') {
      return 'entry';
    }
    return RECIPES[text] ? text : 'entry';
  }

  function enrichRegions(regions, options) {
    const api = regionContextApi();
    return api && typeof api.enrichRegions === 'function' ? api.enrichRegions(regions, options || {}) : regions;
  }

  function buildRegionContext(screen, options) {
    const api = regionContextApi();
    return api && typeof api.buildContext === 'function' ? api.buildContext(screen, options || {}) : {};
  }

  function attachCapabilityMatrix(screen, options) {
    const api = capabilityApi();
    if (!api || typeof api.buildCapabilityMatrix !== 'function') {
      screen.capabilityMatrix = null;
      return;
    }
    const matrix = api.buildCapabilityMatrix(screen, options || {});
    screen.capabilityMatrix = matrix;
    const byRegion = matrix && matrix.byRegion || {};
    screen.regions = ensureArray(screen.regions).map((region) => Object.assign({}, region, {
      capability: byRegion[region.key] || null
    }));
    screen.selected = screen.selected
      ? screen.regions.find((region) => region.key === screen.selected.key) || screen.selected
      : null;
    if (screen.regionContext && screen.selected) {
      screen.regionContext = Object.assign({}, screen.regionContext, {
        selectedRegion: screen.selected,
        capability: screen.selected.capability || null
      });
    }
  }

  function attachSemanticTasks(screen) {
    const api = semanticTaskApi();
    if (api && typeof api.attachTasks === 'function') {
      api.attachTasks(screen);
      return;
    }
    screen.semanticTaskMatrix = null;
    screen.regions = ensureArray(screen.regions).map((region) => Object.assign({}, region, {
      semanticTasks: []
    }));
    screen.selected = screen.selected
      ? screen.regions.find((region) => region.key === screen.selected.key) || screen.selected
      : null;
  }

  function systemUiFixtures() {
    const api = fixtureApi();
    return api && typeof api.fixtureList === 'function' ? api.fixtureList() : [{key: 'default', labelKey: 'systemUi.fixture.default', fallback: 'Default'}];
  }

  function systemUiFixtureState(value) {
    const api = fixtureApi();
    if (api && typeof api.fixtureState === 'function') {
      return api.fixtureState(value);
    }
    return {
      key: String(value || '') === 'busy' ? 'changed' : 'default',
      fallback: String(value || '') === 'busy' ? 'Changed state' : 'Default',
      statusLines: String(value || '') === 'busy' ? ['Internal dissent: rising', 'Policy work has started moving.'] : ['Internal dissent: very low', 'Resources available: 0']
    };
  }

  function fixtureApi() {
    if (global && global.ProjectMapSystemUiFixtureState) {
      return global.ProjectMapSystemUiFixtureState;
    }
    if (typeof require === 'function') {
      try {
        return require('./system_ui_fixture_state.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function regionContextApi() {
    if (global && global.ProjectMapSystemUiRegionContext) {
      return global.ProjectMapSystemUiRegionContext;
    }
    if (typeof require === 'function') {
      try {
        return require('./system_ui_region_context.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function capabilityApi() {
    if (global && global.ProjectMapSystemUiCapabilityModel) {
      return global.ProjectMapSystemUiCapabilityModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./system_ui_capability_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function semanticTaskApi() {
    if (global && global.ProjectMapSystemUiSemanticTaskModel) {
      return global.ProjectMapSystemUiSemanticTaskModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./system_ui_semantic_task_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function entrySidebarApi() {
    if (global && global.ProjectMapEntrySidebarDraft) {
      return global.ProjectMapEntrySidebarDraft;
    }
    if (typeof require === 'function') {
      try {
        return require('../authoring/entry_sidebar_draft.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function playSurfaceApi() {
    if (global && global.ProjectMapPlaySurfaceDraft) {
      return global.ProjectMapPlaySurfaceDraft;
    }
    if (typeof require === 'function') {
      try {
        return require('../authoring/play_surface_draft.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function sidebarStatusApi() {
    if (global && global.ProjectMapSidebarStatusDraft) {
      return global.ProjectMapSidebarStatusDraft;
    }
    if (typeof require === 'function') {
      try {
        return require('../authoring/sidebar_status_draft.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {buildScreen};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSystemUiScreenModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
