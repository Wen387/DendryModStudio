(function initProjectMapObjectCanvasContentAdapters(global) {
  'use strict';

  const SUPPORTED_TEMPLATES = [
    'event',
    'news',
    'card',
    'play_surface',
    'workspace_layout',
    'sidebar_status',
    'surface',
    'entry',
    'project',
    'variables'
  ];

  const TEMPLATE_BY_KIND = {
    world_event: 'event',
    news_item: 'news',
    card: 'card',
    play_surface: 'play_surface',
    workspace_layout: 'workspace_layout',
    sidebar_status: 'sidebar_status',
    surface_text: 'surface',
    entry_sidebar: 'entry',
    project_metadata: 'project',
    variable_editor: 'variables'
  };

  const BODIES = contentBodiesApi();

  const DEFINITIONS = {
    event: {
      label: 'World Event',
      objectKind: 'event',
      mode: 'new_event',
      globalName: 'ProjectMapEventDraft',
      moduleName: 'event_draft.js',
      defaultDraft: defaultEventDraft,
      normalize: normalizeEventDraft,
      applyValues: applyEventValues,
      body: BODIES.eventBody,
      source: (draft) => sourceRef({path: 'source/scenes/events/' + (draft.id || 'new_world_event') + '.scene.dry'}),
      preview: (bundle) => bundle.scene || bundle.sceneDry || ''
    },
    news: {
      label: 'News',
      objectKind: 'news',
      mode: 'new_news',
      globalName: 'ProjectMapNewsDraft',
      moduleName: 'news_draft.js',
      defaultDraft: defaultNewsDraft,
      normalize: (draft, api) => normalizeWithApi(api, draft),
      applyValues: applyNewsValues,
      body: BODIES.newsBody,
      source: () => sourceRef({path: 'source/scenes/post_event_news.scene.dry'}),
      preview: (bundle) => bundle.snippet || ''
    },
    card: {
      label: 'Card',
      objectKind: 'card',
      mode: 'new_card',
      globalName: 'ProjectMapCardDraft',
      moduleName: 'card_draft.js',
      defaultDraft: defaultCardDraft,
      normalize: (draft, api) => normalizeWithApi(api, draft),
      applyValues: applyCardValues,
      body: BODIES.cardBody,
      source: (draft) => sourceRef({path: 'source/scenes/cards/' + (draft.id || 'new_card') + '.scene.dry'}),
      preview: (bundle) => bundle.scene || bundle.sceneDry || ''
    },
    surface: {
      label: 'Text Replacement',
      objectKind: 'surface_text',
      mode: 'surface_text',
      globalName: 'ProjectMapSurfaceTextDraft',
      moduleName: 'surface_text_draft.js',
      defaultDraft: defaultSurfaceDraft,
      normalize: (draft, api) => normalizeWithApi(api, draft),
      applyValues: applySurfaceValues,
      body: BODIES.surfaceBody,
      source: (draft) => sourceRef(draft.source),
      preview: (bundle) => bundle.proposal || ''
    },
    entry: {
      label: 'Entry & Sidebar',
      objectKind: 'entry_sidebar',
      mode: 'entry_sidebar',
      globalName: 'ProjectMapEntrySidebarDraft',
      moduleName: 'entry_sidebar_draft.js',
      applyValues: applyEntryValues,
      body: BODIES.entryBody
    },
    play_surface: {
      label: 'Playable Surface',
      objectKind: 'play_surface',
      mode: 'play_surface',
      globalName: 'ProjectMapPlaySurfaceDraft',
      moduleName: 'play_surface_draft.js',
      applyValues: applyPlaySurfaceValues,
      body: BODIES.playSurfaceBody
    },
    workspace_layout: {
      label: 'Workspace Layout',
      objectKind: 'workspace_layout',
      mode: 'workspace_layout',
      globalName: 'ProjectMapWorkspaceLayoutDraft',
      moduleName: 'workspace_layout_draft.js',
      applyValues: applyWorkspaceLayoutValues,
      body: BODIES.workspaceLayoutBody
    },
    sidebar_status: {
      label: 'Sidebar / Status',
      objectKind: 'sidebar_status',
      mode: 'sidebar_status',
      globalName: 'ProjectMapSidebarStatusDraft',
      moduleName: 'sidebar_status_draft.js',
      applyValues: applySidebarStatusValues,
      body: BODIES.sidebarStatusBody
    },
    project: {
      label: 'Game Info',
      objectKind: 'project_metadata',
      mode: 'project_metadata',
      globalName: 'ProjectMapProjectMetadataDraft',
      moduleName: 'project_metadata_draft.js',
      applyValues: applyProjectValues,
      body: BODIES.projectBody
    },
    variables: {
      label: 'Variables',
      objectKind: 'variable_editor',
      mode: 'variable_editor',
      globalName: 'ProjectMapVariableEditorDraft',
      moduleName: 'variable_editor_draft.js',
      applyValues: applyVariableValues,
      body: BODIES.variableBody
    }
  };

  function isSupportedTemplate(template) {
    return SUPPORTED_TEMPLATES.includes(String(template || '').trim());
  }

  function templateFromDraft(input) {
    const draft = isObject(input) ? input : {};
    const explicit = normalizeTemplate(draft.template || draft.draftTemplate || draft.type);
    if (explicit) {
      return explicit;
    }
    return TEMPLATE_BY_KIND[String(draft.kind || '').trim()] || '';
  }

  function defaultDraftForTemplate(projectIndex, template) {
    const key = normalizeTemplate(template) || 'event';
    const def = DEFINITIONS[key] || DEFINITIONS.event;
    const api = draftApi(def);
    try {
      if (typeof def.defaultDraft === 'function') {
        return def.defaultDraft(projectIndex, api);
      }
      if (api && typeof api.defaultDraft === 'function') {
        return api.defaultDraft(projectIndex);
      }
    } catch (_err) {
      return fallbackDraftForTemplate(key);
    }
    return fallbackDraftForTemplate(key);
  }

  function buildTemplateCanvas(projectIndex, template, draftInput, options) {
    const key = normalizeTemplate(template) || templateFromDraft(draftInput) || 'event';
    const def = DEFINITIONS[key] || DEFINITIONS.event;
    const opts = isObject(options) ? options : {};
    const api = draftApi(def);
    const baseDraft = draftInput && Object.keys(draftInput).length
      ? draftInput
      : defaultDraftForTemplate(projectIndex, key);
    const normalized = normalizeDraft(def, baseDraft, api);
    const draft = typeof def.applyValues === 'function'
      ? def.applyValues(normalized, opts.values || {})
      : normalized;
    const bundle = buildBundle(def, api, draft, projectIndex, opts);
    const output = normalizeOutput(bundle, draft, def);
    const diagnostics = normalizeDiagnostics(bundle && bundle.diagnostics);
    const installPlan = output.installPlan || null;
    return {
      schemaVersion: '0.1',
      kind: 'object_authoring_canvas_model',
      ok: output.ok !== false && !diagnostics.some(isError),
      mode: def.mode,
      template: key,
      templateLabel: def.label,
      objectKind: def.objectKind,
      objectId: objectId(draft),
      title: titleForDraft(def, draft),
      source: sourceForDraft(def, draft),
      entry: entryInfo(opts.entry || opts.seed || {}),
      contextBoard: contextBoardForDraft(projectIndex, def, draft, opts),
      eventBody: def.body(draft, projectIndex, opts),
      changeState: {
        draft,
        proposal: draft,
        output,
        installPlan,
        operationSummary: operationSummary(installPlan),
        changedCount: changedCountFromValues(opts.values),
        diagnostics,
        warnings: diagnostics.filter(isWarning).map((item) => item.message || item.code || '')
      },
      legacy: {template: key},
      rawContext: null
    };
  }

  function normalizeTemplate(value) {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }
    if (text === 'world_event') {
      return 'event';
    }
    if (text === 'news_item') {
      return 'news';
    }
    if (text === 'surface_text' || text === 'text') {
      return 'surface';
    }
    if (text === 'entry_sidebar') {
      return 'entry';
    }
    if (text === 'project_metadata' || text === 'game_info') {
      return 'project';
    }
    if (text === 'variable_editor' || text === 'variable' || text === 'variables') {
      return 'variables';
    }
    return isSupportedTemplate(text) ? text : '';
  }

  function contentBodiesApi() {
    if (global && global.ProjectMapObjectCanvasContentBodies) {
      return global.ProjectMapObjectCanvasContentBodies;
    }
    if (typeof require === 'function') {
      try {
        return require('./object_canvas_content_bodies.js');
      } catch (_err) {
        return {};
      }
    }
    return {};
  }

  function draftApi(def) {
    if (global && global[def.globalName]) {
      return global[def.globalName];
    }
    if (typeof require === 'function') {
      try {
        return require('./' + def.moduleName);
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function normalizeDraft(def, draft, api) {
    if (typeof def.normalize === 'function') {
      return def.normalize(draft, api);
    }
    return normalizeWithApi(api, draft);
  }

  function normalizeWithApi(api, draft) {
    if (api && typeof api.normalizeDraft === 'function') {
      return api.normalizeDraft(draft);
    }
    return clone(draft);
  }

  function buildBundle(def, api, draft, projectIndex, options) {
    if (!api || typeof api.buildExportBundle !== 'function') {
      return {
        ok: true,
        draft,
        diagnostics: [diagnostic('warning', 'object_canvas.core_missing', def.label + ' core is unavailable; Canvas is showing a local draft preview.')]
      };
    }
    try {
      return api.buildExportBundle(draft, projectIndex, {
        defaultContinueLabel: options.defaultContinueLabel || 'Continue'
      });
    } catch (err) {
      return {
        ok: false,
        draft,
        diagnostics: [diagnostic('error', 'object_canvas.build_failed', err && err.message || def.label + ' build failed.')]
      };
    }
  }

  function normalizeOutput(bundle, draft, def) {
    const value = isObject(bundle) ? bundle : {};
    const preview = firstNonEmpty(
      value.playerPreview,
      value.previewText,
      value.proposalText,
      value.proposal,
      value.scene,
      value.sceneDry,
      value.snippet,
      value.sidebarSection,
      value.qualityFile,
      typeof def.preview === 'function' ? def.preview(value, draft) : '',
      JSON.stringify(draft, null, 2)
    );
    return {
      ok: value.ok !== false,
      draft: value.draft || draft,
      fileName: fileNameForDraft(def, draft),
      playerPreview: preview,
      previewText: preview,
      proposalText: value.proposal || value.proposalText || '',
      sceneDry: value.scene || value.sceneDry || '',
      scene: value.scene || value.sceneDry || '',
      snippet: value.snippet || '',
      draftJson: value.draftJson || JSON.stringify(draft, null, 2) + '\n',
      rootInitSnippet: value.rootSnippet || value.rootInitSnippet || '',
      migrationSnippet: value.migrationSnippet || '',
      installPlan: value.installPlan || null,
      installPlanJson: value.installPlanJson || '',
      patchPreview: value.patchPreview || '',
      installNotes: value.installNotes || '',
      installChecklist: value.installChecklist || ''
    };
  }

  function defaultEventDraft() {
    return {
      schemaVersion: '0.1',
      kind: 'world_event',
      id: 'new_world_event',
      title: 'New World Event',
      heading: 'New World Event',
      seenFlag: 'new_world_event_seen',
      when: {year: 1936, monthStart: 1, monthEnd: 3, requires: '', priority: 0},
      introParagraphs: ['Write the opening event text here.'],
      effectsOnTrigger: [],
      options: [
        {id: 'option_1', label: 'Take the first path', narrativeParagraphs: ['The first consequence appears.'], effects: [], gotoAfter: 'continue_option_1'},
        {id: 'option_2', label: 'Choose another path', narrativeParagraphs: ['The second consequence appears.'], effects: [], gotoAfter: 'continue_option_2'}
      ]
    };
  }

  function normalizeEventDraft(input, api) {
    const value = isObject(input) ? clone(input) : {};
    const when = isObject(value.when) ? value.when : value;
    const id = safeId(value.id || value.rawId || 'new_world_event');
    const converted = Object.assign(defaultEventDraft(), value, {
      schemaVersion: String(value.schemaVersion || '0.1'),
      kind: 'world_event',
      id,
      title: String(value.title || value.heading || 'New World Event').trim(),
      heading: String(value.heading || value.title || 'New World Event').trim(),
      seenFlag: safeId(value.seenFlag || value.rawSeenFlag || id + '_seen'),
      when: {
        year: numberOr(value.year || when.year, 1936),
        monthStart: numberOr(value.monthStart || when.monthStart, 1),
        monthEnd: numberOr(value.monthEnd || when.monthEnd, 3),
        requires: String(value.requires || when.requires || '').trim(),
        priority: numberOr(value.priority || when.priority, 0)
      },
      introParagraphs: paragraphs(value.introParagraphs || value.intro || value.body || 'Write the opening event text here.'),
      options: normalizeEventOptions(ensureArray(value.options).length ? value.options : defaultEventDraft().options)
    });
    return normalizeWithApi(api, converted);
  }

  function normalizeEventOptions(options) {
    return ensureArray(options).slice(0, 4).map((option, index) => {
      const value = isObject(option) ? option : {};
      const id = safeId(value.id || value.rawId || 'option_' + (index + 1));
      return {
        id,
        label: String(value.label || value.title || 'Choice ' + (index + 1)).trim(),
        subtitle: String(value.subtitle || '').trim(),
        chooseIf: String(value.chooseIf || '').trim(),
        unavailableText: String(value.unavailableText || '').trim(),
        effects: ensureArray(value.effects),
        narrativeParagraphs: paragraphs(value.narrativeParagraphs || value.body || value.text || 'Describe the result of this choice.'),
        variants: ensureArray(value.variants),
        gotoAfter: safeId(value.gotoAfter || 'continue_' + id)
      };
    });
  }

  function defaultNewsDraft() {
    return {
      schemaVersion: '0.1',
      kind: 'news_item',
      id: 'new_news_item',
      headline: 'New headline',
      description: 'Write a short news description.',
      delivery: 'dated',
      when: {year: 1936, month: 1, slot: 1, requiresJs: ''},
      pool: {name: 'social_pool', requiresJs: ''}
    };
  }

  function defaultCardDraft() {
    return {
      schemaVersion: '0.1',
      kind: 'card',
      id: 'new_action_card',
      title: 'New Action Card',
      cardKind: 'action_card',
      tags: ['cards'],
      viewIf: '',
      priority: 0,
      frequency: 1,
      maxVisits: 1,
      heading: 'New Action Card',
      subtitle: '',
      introParagraphs: ['Describe the situation shown on this card.'],
      assetRefs: [],
      assetInstallRequests: [],
      options: [
        {id: 'option_1', label: 'Take action', title: '', subtitle: '', chooseIf: '', unavailableText: '', effects: [], narrativeParagraphs: ['The card action is resolved.'], gotoAfter: 'root'},
        {id: 'option_2', label: 'Hold back', title: '', subtitle: '', chooseIf: '', unavailableText: '', effects: [], narrativeParagraphs: ['The card is left for later.'], gotoAfter: 'root'}
      ]
    };
  }

  function defaultSurfaceDraft() {
    return {
      schemaVersion: '0.1',
      kind: 'surface_text',
      id: 'surface_text_update',
      itemId: 'surface_text_update',
      area: 'Text Corpus',
      originalLabel: 'Original text',
      replacementLabel: 'Replacement text',
      editability: 'text_proposal',
      source: {path: 'source/scenes/root.scene.dry', line: 1, endLine: 1},
      reason: 'Review the replacement in context.'
    };
  }

  function fallbackDraftForTemplate(template) {
    if (template === 'event') {
      return defaultEventDraft();
    }
    if (template === 'news') {
      return defaultNewsDraft();
    }
    if (template === 'card') {
      return defaultCardDraft();
    }
    if (template === 'surface') {
      return defaultSurfaceDraft();
    }
    if (template === 'entry') {
      return {
        schemaVersion: '0.1',
        kind: 'entry_sidebar',
        id: 'entry_sidebar_update',
        title: 'Entry & Sidebar Update',
        rootTitle: 'Start',
        rootHeading: 'Start',
        rootIntro: 'Choose where the story begins.',
        firstOptionTitle: 'Start',
        firstTargetId: 'root',
        sidebarTitle: 'Status',
        sidebarHeading: 'Status',
        sidebarBody: 'Track the state of the story here.',
        sidebarStatusLines: '',
        evidence: {}
      };
    }
    if (template === 'play_surface') {
      return {
        schemaVersion: '0.1',
        kind: 'play_surface',
        id: 'play_surface_update',
        title: 'Playable Surface Update',
        handTitle: 'Workspace Hand',
        handHeading: 'Workspace Hand',
        handBody: 'Choose a playable surface.',
        handDeckOptionLabel: 'Open deck',
        handAdvisorOptionLabel: 'Review advisor',
        deckTitle: 'Starter Deck',
        deckSubtitle: '',
        cardTitle: 'Starter Action Card',
        cardHeading: 'Action Card',
        cardBody: 'Resolve the starter card.',
        cardOption0Label: 'Spend resources',
        cardOption1Label: 'Save capacity',
        advisorTitle: 'Starter Advisor',
        advisorSubtitle: '',
        advisorHeading: 'Advisor',
        advisorBody: 'Ask for advice.',
        advisorOption0Label: 'Ask for help',
        evidence: {}
      };
    }
    if (template === 'workspace_layout') {
      return {
        schemaVersion: '0.1',
        kind: 'workspace_layout',
        id: 'workspace_layout_update',
        title: 'Workspace Layout Update',
        deckId: 'policy_deck',
        deckTitle: 'Policy Deck',
        deckSubtitle: 'Repeatable policy work',
        deckTag: 'policy_action',
        handOptionLabel: 'Open policy deck',
        handInsertMode: 'auto',
        sidebarCategoryId: 'policy',
        sidebarHeading: 'Policy Desk',
        sidebarBody: 'Use this section for policy work.',
        sidebarStatusLines: '',
        sidebarInsertMode: 'auto',
        createStarterCard: true,
        starterCardId: 'policy_starter_card',
        starterCardTitle: 'Policy Starter Card',
        starterCardHeading: 'Plan the first policy push',
        starterCardBody: 'Choose how this new lane changes state.',
        starterCardOption0Label: 'Build momentum',
        starterCardOption0Variable: 'policy_momentum',
        starterCardOption0Delta: '1',
        starterCardOption1Label: 'Save capacity',
        starterCardOption1Variable: 'policy_capacity',
        starterCardOption1Delta: '1',
        starterCardReturnTarget: 'root',
        evidence: {}
      };
    }
    if (template === 'sidebar_status') {
      return {
        schemaVersion: '0.1',
        kind: 'sidebar_status',
        id: 'sidebar_status_update',
        title: 'Sidebar / Status Update',
        statusTitle: 'Status',
        sectionId: 'main',
        sectionHeading: 'Status',
        sectionBody: 'Track the current state here.',
        sectionStatusLines: '',
        evidence: {}
      };
    }
    if (template === 'project') {
      return {
        schemaVersion: '0.1',
        kind: 'project_metadata',
        id: 'project_metadata_update',
        title: 'Game Info Update',
        gameTitle: 'Untitled Dendry Project',
        author: '',
        ifid: '',
        evidence: {}
      };
    }
    if (template === 'variables') {
      return {
        schemaVersion: '0.1',
        kind: 'variable_editor',
        id: 'new_variable',
        title: 'New Variable',
        mode: 'add_new',
        variableName: 'new_variable',
        label: 'New Variable',
        initialValue: '0',
        valueType: 'number',
        description: '',
        includeRootInit: true,
        includePostEventInit: false,
        includeQualityFile: true,
        evidence: {}
      };
    }
    return {};
  }

  function applyEventValues(baseDraft, values) {
    const draft = clone(baseDraft);
    const data = isObject(values) ? values : {};
    if (!draft.when) {
      draft.when = {};
    }
    setString(data, draft, 'event.id', 'id', safeId);
    setString(data, draft, 'event.title', 'title');
    setString(data, draft, 'event.heading', 'heading');
    if (has(data, 'event.intro')) {
      draft.introParagraphs = paragraphs(data['event.intro']);
    }
    setNumber(data, draft.when, 'event.year', 'year');
    setNumber(data, draft.when, 'event.monthStart', 'monthStart');
    setNumber(data, draft.when, 'event.monthEnd', 'monthEnd');
    setString(data, draft.when, 'event.requires', 'requires');
    setNumber(data, draft.when, 'event.priority', 'priority');
    draft.options = ensureArray(draft.options).map((option, index) => {
      const next = clone(option);
      setString(data, next, 'option.' + index + '.label', 'label');
      setString(data, next, 'option.' + index + '.subtitle', 'subtitle');
      setString(data, next, 'option.' + index + '.chooseIf', 'chooseIf');
      setString(data, next, 'option.' + index + '.gotoAfter', 'gotoAfter', safeId);
      if (has(data, 'option.' + index + '.body')) {
        next.narrativeParagraphs = paragraphs(data['option.' + index + '.body']);
      }
      return next;
    });
    if (!draft.heading) {
      draft.heading = draft.title;
    }
    if (!draft.seenFlag || has(data, 'event.id')) {
      draft.seenFlag = safeId((draft.id || 'new_world_event') + '_seen');
    }
    return draft;
  }

  function applyNewsValues(baseDraft, values) {
    const draft = clone(baseDraft);
    const data = isObject(values) ? values : {};
    draft.when = isObject(draft.when) ? draft.when : {};
    draft.pool = isObject(draft.pool) ? draft.pool : {};
    setString(data, draft, 'news.id', 'id', safeId);
    setString(data, draft, 'news.headline', 'headline');
    setString(data, draft, 'news.description', 'description');
    setString(data, draft, 'news.delivery', 'delivery');
    setNumber(data, draft.when, 'news.year', 'year');
    setNumber(data, draft.when, 'news.month', 'month');
    setNumber(data, draft.when, 'news.slot', 'slot');
    setString(data, draft.when, 'news.requiresJs', 'requiresJs');
    setString(data, draft.pool, 'news.poolName', 'name');
    setString(data, draft.pool, 'news.poolRequiresJs', 'requiresJs');
    return draft;
  }

  function applyCardValues(baseDraft, values) {
    const draft = clone(baseDraft);
    const data = isObject(values) ? values : {};
    setString(data, draft, 'card.id', 'id', safeId);
    setString(data, draft, 'card.title', 'title');
    setString(data, draft, 'card.heading', 'heading');
    setString(data, draft, 'card.subtitle', 'subtitle');
    setString(data, draft, 'card.cardKind', 'cardKind');
    setString(data, draft, 'card.viewIf', 'viewIf');
    setNumber(data, draft, 'card.priority', 'priority');
    setNumber(data, draft, 'card.frequency', 'frequency');
    setNumber(data, draft, 'card.maxVisits', 'maxVisits');
    if (has(data, 'card.tags')) {
      draft.tags = splitList(data['card.tags']);
    }
    if (has(data, 'card.intro')) {
      draft.introParagraphs = paragraphs(data['card.intro']);
    }
    draft.options = ensureArray(draft.options).map((option, index) => {
      const next = clone(option);
      setString(data, next, 'card.option.' + index + '.label', 'label');
      setString(data, next, 'card.option.' + index + '.title', 'title');
      setString(data, next, 'card.option.' + index + '.subtitle', 'subtitle');
      setString(data, next, 'card.option.' + index + '.chooseIf', 'chooseIf');
      setString(data, next, 'card.option.' + index + '.gotoAfter', 'gotoAfter', safeId);
      if (has(data, 'card.option.' + index + '.body')) {
        next.narrativeParagraphs = paragraphs(data['card.option.' + index + '.body']);
      }
      return next;
    });
    if (!draft.heading) {
      draft.heading = draft.title;
    }
    return draft;
  }

  function applySurfaceValues(baseDraft, values) {
    const draft = clone(baseDraft);
    const data = isObject(values) ? values : {};
    draft.source = isObject(draft.source) ? draft.source : {};
    setString(data, draft, 'surface.id', 'id', safeId);
    setString(data, draft, 'surface.itemId', 'itemId');
    setString(data, draft, 'surface.area', 'area');
    setString(data, draft, 'surface.replacementLabel', 'replacementLabel');
    setString(data, draft, 'surface.reason', 'reason');
    setString(data, draft, 'surface.editability', 'editability');
    setString(data, draft.source, 'surface.source.path', 'path');
    setNumber(data, draft.source, 'surface.source.line', 'line');
    draft.source.endLine = draft.source.line || draft.source.endLine || null;
    return draft;
  }

  function applyEntryValues(baseDraft, values) {
    return applyScalarValues(baseDraft, values, 'entry.', [
      'id',
      'title',
      'rootTitle',
      'rootHeading',
      'rootIntro',
      'firstOptionTitle',
      'firstTargetId',
      'sidebarTitle',
      'sidebarHeading',
      'sidebarBody',
      'sidebarStatusLines'
    ], ['id']);
  }

  function applyPlaySurfaceValues(baseDraft, values) {
    return applyScalarValues(baseDraft, values, 'play.', [
      'id',
      'title',
      'handTitle',
      'handHeading',
      'handBody',
      'handDeckOptionLabel',
      'handAdvisorOptionLabel',
      'deckTitle',
      'deckSubtitle',
      'cardTitle',
      'cardHeading',
      'cardBody',
      'cardOption0Label',
      'cardOption1Label',
      'advisorTitle',
      'advisorSubtitle',
      'advisorHeading',
      'advisorBody',
      'advisorOption0Label'
    ], ['id']);
  }

  function applyWorkspaceLayoutValues(baseDraft, values) {
    const draft = applyScalarValues(baseDraft, values, 'layout.', [
      'id',
      'title',
      'deckId',
      'deckTitle',
      'deckSubtitle',
      'deckTag',
      'handOptionLabel',
      'handInsertMode',
      'handAnchorId',
      'sidebarCategoryId',
      'sidebarHeading',
      'sidebarBody',
      'sidebarStatusLines',
      'sidebarInsertMode',
      'sidebarAnchorId',
      'starterCardId',
      'starterCardTitle',
      'starterCardHeading',
      'starterCardBody',
      'starterCardOption0Label',
      'starterCardOption0Variable',
      'starterCardOption0Delta',
      'starterCardOption1Label',
      'starterCardOption1Variable',
      'starterCardOption1Delta',
      'starterCardReturnTarget'
    ], ['id', 'deckId', 'deckTag', 'sidebarCategoryId', 'starterCardId', 'starterCardOption0Variable', 'starterCardOption1Variable', 'starterCardReturnTarget']);
    if (has(values, 'layout.createStarterCard')) {
      draft.createStarterCard = booleanValue(values['layout.createStarterCard']);
    }
    return draft;
  }

  function applySidebarStatusValues(baseDraft, values) {
    return applyScalarValues(baseDraft, values, 'sidebar.', [
      'id',
      'title',
      'statusTitle',
      'sectionId',
      'sectionHeading',
      'sectionBody',
      'sectionStatusLines'
    ], ['id', 'sectionId']);
  }

  function applyProjectValues(baseDraft, values) {
    return applyScalarValues(baseDraft, values, 'project.', ['id', 'title', 'gameTitle', 'author', 'ifid'], ['id']);
  }

  function applyVariableValues(baseDraft, values) {
    const draft = applyScalarValues(baseDraft, values, 'variables.', [
      'id',
      'title',
      'mode',
      'variableName',
      'label',
      'initialValue',
      'valueType',
      'description'
    ], ['id', 'variableName']);
    ['includeRootInit', 'includePostEventInit', 'includeQualityFile'].forEach((key) => {
      if (has(values, 'variables.' + key)) {
        draft[key] = booleanValue(values['variables.' + key]);
      }
    });
    return draft;
  }

  function applyScalarValues(baseDraft, values, prefix, keys, idKeys) {
    const draft = clone(baseDraft);
    const data = isObject(values) ? values : {};
    const ids = new Set(idKeys || []);
    keys.forEach((key) => {
      if (has(data, prefix + key)) {
        draft[key] = ids.has(key) ? safeId(data[prefix + key]) : String(data[prefix + key] || '').trim();
      }
    });
    return draft;
  }

  function contextBoardForDraft(projectIndex, def, draft, options) {
    return {
      flow: flowRows(def, draft, options),
      variables: variableRows(projectIndex, draft),
      effects: effectRows(draft),
      assets: assetRows(draft),
      sourceEvidence: sourceRows(def, draft),
      manualBoundaries: boundaryRows(def, draft)
    };
  }

  function flowRows(def, draft, options) {
    const seed = seedContextRow(options.seed || options.entry);
    return [
      seed,
      {
        label: def.label,
        detail: objectId(draft),
        direction: 'current',
        source: sourceForDraft(def, draft)
      }
    ].filter(Boolean);
  }

  function variableRows(projectIndex, draft) {
    const names = new Set();
    effectRows(draft).forEach((row) => {
      if (row.variable) {
        names.add(row.variable);
      }
    });
    [
      draft.starterCardOption0Variable,
      draft.starterCardOption1Variable,
      draft.variableName
    ].forEach((name) => {
      if (name) {
        names.add(String(name));
      }
    });
    const existing = new Map();
    ensureArray(projectIndex && projectIndex.variables).forEach((variable) => {
      if (variable && variable.name) {
        existing.set(String(variable.name), variable);
      }
    });
    return Array.from(names).map((name) => {
      const variable = existing.get(name) || {};
      return {
        name,
        reads: ensureArray(variable.reads),
        writes: ensureArray(variable.writes),
        readCount: Number(variable.readCount || 0),
        writeCount: Number(variable.writeCount || 0),
        tags: ensureArray(variable.tags).map(String),
        status: existing.has(name) ? 'referenced' : 'new_or_missing'
      };
    });
  }

  function effectRows(draft) {
    const rows = [];
    ensureArray(draft.effectsOnTrigger).forEach((effect) => rows.push(effectRow(effect)));
    ensureArray(draft.options).forEach((option) => {
      ensureArray(option.effects).forEach((effect) => rows.push(effectRow(effect)));
    });
    [
      ['starterCardOption0Variable', 'starterCardOption0Delta'],
      ['starterCardOption1Variable', 'starterCardOption1Delta']
    ].forEach(([variableKey, deltaKey]) => {
      if (draft[variableKey]) {
        rows.push({variable: draft[variableKey], op: '+=', value: String(draft[deltaKey] || ''), source: {}, status: 'draft'});
      }
    });
    return rows.filter((row) => row.variable);
  }

  function effectRow(effect) {
    const value = isObject(effect) ? effect : {};
    return {
      variable: String(value.variable || ''),
      op: String(value.op || ''),
      value: value.value === undefined || value.value === null ? '' : String(value.value),
      source: {},
      status: 'draft'
    };
  }

  function assetRows(draft) {
    return ensureArray(draft.assetRefs).concat(ensureArray(draft.assetInstallRequests)).map((asset) => ({
      label: asset.label || asset.path || asset.targetPath || asset.sourceName || 'asset',
      path: asset.path || asset.targetPath || asset.sourcePath || '',
      role: asset.role || asset.type || 'asset',
      status: 'draft'
    }));
  }

  function sourceRows(def, draft) {
    const primary = sourceForDraft(def, draft);
    const rows = primary.path ? [{label: def.label + ' source', path: primary.path, line: primary.line, status: 'draft'}] : [];
    const evidence = isObject(draft.evidence) ? draft.evidence : {};
    ['root', 'sidebar', 'hand', 'deck', 'card', 'advisor', 'status'].forEach((key) => {
      const item = isObject(evidence[key]) ? evidence[key] : {};
      if (item.path) {
        rows.push({label: key, path: item.path, line: item.line || item.titleLine || null, status: item.exists === false ? 'missing' : 'evidence'});
      }
    });
    return rows;
  }

  function boundaryRows(def) {
    if (def.objectKind === 'event') {
      return [{
        label: 'Router wiring',
        reason: 'New events may still need project-specific router review.',
        status: 'manual_review',
        source: {}
      }];
    }
    return [{
      label: def.label + ' install review',
      reason: 'Review generated operations before applying changes to source files.',
      status: 'manual_review',
      source: {}
    }];
  }

  function objectId(draft) {
    return String(draft.id || draft.itemId || draft.variableName || draft.deckId || '').trim();
  }

  function titleForDraft(def, draft) {
    return firstNonEmpty(draft.title, draft.heading, draft.headline, draft.gameTitle, draft.replacementLabel, draft.variableName, def.label);
  }

  function fileNameForDraft(def, draft) {
    const id = objectId(draft) || safeId(def.label);
    if (def.objectKind === 'news') {
      return id + '.post-event-news.snippet.js';
    }
    if (def.objectKind === 'surface_text') {
      return id + '.surface-text-proposal.txt';
    }
    if (def.objectKind === 'project_metadata') {
      return id + '.project-metadata-draft.json';
    }
    if (def.objectKind === 'variable_editor') {
      return id + '.variable-draft.json';
    }
    return id + '.scene.dry';
  }

  function sourceForDraft(def, draft) {
    if (typeof def.source === 'function') {
      return def.source(draft);
    }
    const evidence = isObject(draft.evidence) ? draft.evidence : {};
    return sourceRef(evidence.root || evidence.hand || evidence.status || {});
  }

  function sourceRef(ref) {
    const value = isObject(ref) ? ref : {};
    const line = numberOrNull(value.line || value.startLine || value.titleLine);
    return {
      path: String(value.path || value.sourcePath || '').trim(),
      line,
      startLine: line,
      endLine: numberOrNull(value.endLine || value.line || value.startLine || value.titleLine),
      anchorText: String(value.anchorText || '').trim(),
      endAnchorText: String(value.endAnchorText || '').trim()
    };
  }

  function seedContextRow(seed) {
    const value = isObject(seed) ? seed : {};
    const raw = value.raw || value.item || value.scene || value;
    if (!isObject(raw)) {
      return null;
    }
    const title = raw.title || raw.name || raw.sceneId || raw.id || value.title;
    const detail = raw.source && raw.source.path || raw.path || raw.sceneId || raw.id || '';
    return title ? {label: String(title), detail: String(detail), direction: 'seed', source: raw.source || raw.sourceSpan || {}} : null;
  }

  function operationSummary(plan) {
    const api = installPlanApi();
    if (api && typeof api.operationSummary === 'function') {
      return api.operationSummary(plan || {operations: []});
    }
    return {safeApply: 0, guardedApply: 0, advancedApply: 0, manualReview: 0, refused: 0, total: 0};
  }

  function installPlanApi() {
    if (global && global.ProjectMapInstallPlan) {
      return global.ProjectMapInstallPlan;
    }
    if (typeof require === 'function') {
      try {
        return require('./install_plan.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function normalizeDiagnostics(items) {
    return ensureArray(items).map((item) => {
      if (!isObject(item)) {
        return diagnostic('info', 'object_canvas.note', String(item || ''));
      }
      return Object.assign({
        severity: item.severity || item.level || 'info',
        level: item.level || item.severity || 'info',
        code: item.code || 'object_canvas.note',
        message: item.message || ''
      }, item);
    });
  }

  function diagnostic(severity, code, message) {
    return {severity, level: severity, code, message, confidence: 'static_inferred'};
  }

  function isError(item) {
    return item && (item.severity === 'error' || item.level === 'error');
  }

  function isWarning(item) {
    return item && (item.severity === 'warning' || item.level === 'warning');
  }

  function changedCountFromValues(values) {
    return isObject(values) ? Object.keys(values).length : 0;
  }

  function entryInfo(entry) {
    const value = isObject(entry) ? entry : {};
    return {
      source: String(value.source || ''),
      action: String(value.action || ''),
      label: String(value.label || '')
    };
  }

  function setString(data, target, fieldId, key, transform) {
    if (has(data, fieldId)) {
      const value = String(data[fieldId] || '').trim();
      target[key] = typeof transform === 'function' ? transform(value) : value;
    }
  }

  function setNumber(data, target, fieldId, key) {
    if (has(data, fieldId)) {
      target[key] = numberOr(data[fieldId], target[key]);
    }
  }

  function splitList(value) {
    return String(value || '').split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
  }

  function paragraphs(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    return String(value || '').split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  }

  function joinParagraphs(value) {
    return ensureArray(value).map((item) => String(item || '').trim()).filter(Boolean).join('\n\n');
  }

  function firstNonEmpty() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value);
      }
    }
    return '';
  }

  function safeId(value) {
    const text = String(value || '').trim()
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return /^[A-Za-z_]/.test(text) ? text : 'draft_' + (text || 'item');
  }

  function booleanValue(value) {
    if (value === true || value === false) {
      return value;
    }
    return /^(1|true|yes|on)$/i.test(String(value || '').trim());
  }

  function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function numberOrNull(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
  }

  function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(isObject(value) || Array.isArray(value) ? value : {}));
  }

  const api = {
    SUPPORTED_TEMPLATES,
    TEMPLATE_BY_KIND,
    isSupportedTemplate,
    templateFromDraft,
    defaultDraftForTemplate,
    buildTemplateCanvas
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectCanvasContentAdapters = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
