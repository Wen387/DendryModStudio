(function initProjectMapObjectCanvasContentAdapters(global) {
  'use strict';

  const SUPPORTED_TEMPLATES = [
    'event',
    'news',
    'card',
    'play_surface',
    'workspace_layout',
    'sidebar_status',
    'election_results',
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
    election_results: 'election_results',
    surface_text: 'surface',
    entry_sidebar: 'entry',
    project_metadata: 'project',
    variable_editor: 'variables'
  };

  const BODIES = contentBodiesApi();
  const variableMapCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

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
    election_results: {
      label: 'Election Results',
      objectKind: 'election_results',
      mode: 'election_results',
      globalName: 'ProjectMapElectionResultsDraft',
      moduleName: 'election_results_draft.js',
      applyValues: applyElectionResultsValues,
      body: BODIES.electionResultsBody
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
        return avoidDefaultIdCollision(projectIndex, key, def.defaultDraft(projectIndex, api));
      }
      if (api && typeof api.defaultDraft === 'function') {
        return avoidDefaultIdCollision(projectIndex, key, api.defaultDraft(projectIndex));
      }
    } catch (_err) {
      return avoidDefaultIdCollision(projectIndex, key, fallbackDraftForTemplate(key));
    }
    return avoidDefaultIdCollision(projectIndex, key, fallbackDraftForTemplate(key));
  }

  function avoidDefaultIdCollision(projectIndex, template, draftInput) {
    const draft = clone(draftInput || {});
    if (template === 'variables') {
      return avoidDefaultVariableCollision(projectIndex, draft);
    }
    if (!['event', 'news', 'card'].includes(template)) {
      return draft;
    }
    const id = String(draft.id || '').trim();
    if (!id) {
      return draft;
    }
    const existing = new Set(ensureArray(projectIndex && projectIndex.scenes).map((scene) => String(scene && scene.id || '').trim()).filter(Boolean));
    if (!existing.has(id)) {
      return draft;
    }
    let index = 2;
    let next = id + '_' + index;
    while (existing.has(next)) {
      index += 1;
      next = id + '_' + index;
    }
    draft.id = next;
    return draft;
  }

  function avoidDefaultVariableCollision(projectIndex, draftInput) {
    const draft = clone(draftInput || {});
    if (draft.mode && draft.mode !== 'add_new') {
      return draft;
    }
    const existing = new Set(ensureArray(projectIndex && projectIndex.variables).map((variable) => String(variable && variable.name || '').trim()).filter(Boolean));
    const base = safeId(draft.variableName || 'new_variable');
    if (!existing.has(base)) {
      if (!draft.variableName) {
        draft.variableName = base;
      }
      if (!draft.id) {
        draft.id = base;
      }
      return draft;
    }
    let index = 2;
    let next = base + '_' + index;
    while (existing.has(next)) {
      index += 1;
      next = base + '_' + index;
    }
    draft.variableName = next;
    if (!draft.id || draft.id === base) {
      draft.id = next;
    }
    if (!draft.label || draft.label === labelFromName(base)) {
      draft.label = labelFromName(next);
    }
    return draft;
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
      ? def.applyValues(normalized, opts.values || {}, {projectIndex, api, template: key})
      : normalized;
    const bundle = buildBundle(def, api, draft, projectIndex, opts);
    const output = normalizeOutput(bundle, draft, def);
    const diagnostics = normalizeDiagnostics(bundle && bundle.diagnostics);
    if (isPartialAuthoringDraft(draft)) {
      diagnostics.push(diagnostic('error', 'parsed_to_draft.partial_blocked', partialDraftMessage(draft)));
      output.ok = false;
      output.installPlan = null;
      output.installPlanJson = '';
      output.patchPreview = '';
      output.installChecklist = '';
    }
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

  function isPartialAuthoringDraft(draft) {
    return String(draft && draft.authoringStatus || '').trim() === 'partial';
  }

  function partialDraftMessage(draft) {
    const blockers = ensureArray(draft && draft.authoringBlockers).map((item) => String(item || '').trim()).filter(Boolean);
    return blockers.length
      ? blockers.join(' ')
      : 'This parsed structure is captured for preview, but structured create-as-new support is not complete yet.';
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
    if (text === 'election_result' || text === 'election_results_ui') {
      return 'election_results';
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

  function eventStructureApi() {
    if (global && global.ProjectMapEventStructureModel) {
      return global.ProjectMapEventStructureModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./event_structure_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
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
      eventShape: 'choice_event',
      id: 'new_world_event',
      title: 'New World Event',
      subtitle: '',
      heading: 'New World Event',
      seenFlag: 'new_world_event_seen',
      useSeenFlag: true,
      tags: ['event', 'world'],
      newPage: true,
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
    const explicitOptions = Object.prototype.hasOwnProperty.call(value, 'options');
    const eventShape = String(value.eventShape || '').trim() === 'pure_event' || (explicitOptions && ensureArray(value.options).length === 0)
      ? 'pure_event'
      : 'choice_event';
    const defaultDraft = defaultEventDraft();
    const converted = Object.assign(defaultEventDraft(), value, {
      schemaVersion: String(value.schemaVersion || '0.1'),
      kind: 'world_event',
      eventShape,
      id,
      title: String(value.title || value.heading || 'New World Event').trim(),
      subtitle: String(value.subtitle || '').trim(),
      heading: String(value.heading || value.title || 'New World Event').trim(),
      tags: normalizeTags(value.tags, eventShape),
      newPage: value.newPage === undefined ? true : booleanValue(value.newPage),
      rawViewIf: String(value.rawViewIf || value.viewIf || '').trim(),
      useSeenFlag: value.useSeenFlag === undefined ? eventShape === 'choice_event' : booleanValue(value.useSeenFlag),
      seenFlag: eventShape === 'choice_event' || booleanValue(value.useSeenFlag) ? safeId(value.seenFlag || value.rawSeenFlag || id + '_seen') : '',
      maxVisits: value.maxVisits === undefined ? null : numberOr(value.maxVisits, null),
      when: {
        year: numberOr(value.year || when.year, 1936),
        monthStart: numberOr(value.monthStart || when.monthStart, 1),
        monthEnd: numberOr(value.monthEnd || when.monthEnd, 3),
        requires: String(value.requires || when.requires || '').trim(),
        priority: numberOr(value.priority || when.priority, 0)
      },
      introParagraphs: paragraphs(value.introParagraphs || value.intro || value.body || 'Write the opening event text here.'),
      options: normalizeEventOptions(explicitOptions ? value.options : defaultDraft.options)
    });
    return normalizeWithApi(api, converted);
  }

  function normalizeTags(value, eventShape) {
    if (Array.isArray(value)) {
      const tags = value.map((tag) => String(tag || '').trim()).filter(Boolean);
      return tags.length ? tags : (eventShape === 'pure_event' ? ['event'] : ['event', 'world']);
    }
    if (typeof value === 'string' && value.trim()) {
      const tags = value.split(',').map((tag) => tag.trim()).filter(Boolean);
      return tags.length ? tags : (eventShape === 'pure_event' ? ['event'] : ['event', 'world']);
    }
    return eventShape === 'pure_event' ? ['event'] : ['event', 'world'];
  }

  function normalizeEventOptions(options) {
    return ensureArray(options).map((option, index) => {
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
        gotoAfter: safeId(value.gotoAfter || 'continue_' + id),
        returnTarget: safeId(value.returnTarget || value.afterResultTarget || 'root')
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
      cardShape: 'choice_card',
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
    if (template === 'election_results') {
      return {
        schemaVersion: '0.1',
        kind: 'election_results',
        id: 'election_results_update',
        title: 'Election Results',
        subtitle: 'Reichstag election results',
        intro: 'There are some potential coalition arrangements.',
        seatsTotal: '515',
        targetSceneId: '',
        electionKind: 'reichstag',
        year: '',
        month: '',
        viewIf: '',
        resultText: 'Use this area for the consequence text shown after a coalition choice.',
        conditionText: '',
        sourcePath: 'source/scenes/events/election_results.scene.dry',
        chartElementId: 'reichstag_results',
        useD3Parliament: true,
        parties: [
          {key: 'spd', name: 'SPD', color: '#D9341F', voteShare: '28.7', voteChange: '2.7', seatsShare: '29.8', seatsChange: '3.3', seats: '153'},
          {key: 'kpd', name: 'KPD', color: '#7A1708', voteShare: '10.5', voteChange: '1.5', seatsShare: '10.9', seatsChange: '1.8', seats: '56'},
          {key: 'ddp', name: 'DDP', color: '#D6CD54', voteShare: '4.5', voteChange: '-1.8', seatsShare: '4.7', seatsChange: '-1.8', seats: '24'},
          {key: 'z', name: 'Z', color: '#000000', voteShare: '11.9', voteChange: '-1.7', seatsShare: '12.4', seatsChange: '-2.3', seats: '64'},
          {key: 'bvp', name: 'BVP', color: '#B8E2EB', voteShare: '3.0', voteChange: '-0.7', seatsShare: '3.1', seatsChange: '-0.8', seats: '16'},
          {key: 'dvp', name: 'DVP', color: '#D6B339', voteShare: '8.5', voteChange: '-1.6', seatsShare: '8.9', seatsChange: '-1.4', seats: '46'},
          {key: 'others', name: 'Others', color: '#9B9B9B', voteShare: '14.0', voteChange: '6.2', seatsShare: '10.5', seatsChange: '4.6', seats: '54'},
          {key: 'dnvp', name: 'DNVP', color: '#5A8FBD', voteShare: '14.9', voteChange: '-5.6', seatsShare: '15.5', seatsChange: '-5.4', seats: '80'},
          {key: 'nsdap', name: 'NSDAP', color: '#85500E', voteShare: '4.1', voteChange: '1.1', seatsShare: '4.3', seatsChange: '1.3', seats: '22'}
        ],
        coalitions: [
          {key: 'weimar', name: 'Weimar Coalition', parties: 'SPD + Z + DDP', share: '46.9', description: ''},
          {key: 'grand', name: 'Grand Coalition', parties: 'SPD + Z + BVP + DDP + DVP', share: '58.9', description: ''},
          {key: 'bourgeois', name: 'Bourgeois Coalition', parties: 'Z + BVP + DDP + DVP + Others', share: '39.6', description: ''},
          {key: 'right_wing', name: 'Right-wing Coalition', parties: 'Z + BVP + DVP + Others + DNVP', share: '50.4', description: ''}
        ],
        choices: [
          {key: 'grand', label: 'We can form a Grand Coalition.', detail: 'SPD + Z + BVP + DDP + DVP (58.9%)', disabled: false, condition: '', resultText: 'A grand coalition government is formed.', effects: []},
          {key: 'popular_front', label: 'A new "Popular Front" coalition?', detail: 'SPD + KPD + Z + DDP (57.8%) - relations are not good enough.', disabled: true, condition: 'kpd_relations >= 50', resultText: '', effects: []},
          {key: 'refuse', label: 'Refuse to form a government, so that a right-wing coalition may be formed.', detail: 'Z + BVP + DVP + Others + DNVP (50.4%)', disabled: false, condition: '', resultText: 'A right-wing coalition may attempt to form a government.', effects: []}
        ],
        effects: [],
        electionEvents: [],
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
    let draft = clone(baseDraft);
    const data = isObject(values) ? values : {};
    if (!draft.when) {
      draft.when = {};
    }
    setString(data, draft, 'event.id', 'id', safeId);
    setString(data, draft, 'event.title', 'title');
    setString(data, draft, 'event.subtitle', 'subtitle');
    setString(data, draft, 'event.heading', 'heading');
    setString(data, draft, 'event.eventShape', 'eventShape');
    if (has(data, 'event.tags')) {
      draft.tags = String(data['event.tags'] || '').split(',').map((tag) => tag.trim()).filter(Boolean);
    }
    if (has(data, 'event.newPage')) {
      draft.newPage = booleanValue(data['event.newPage']);
    }
    if (has(data, 'event.useSeenFlag')) {
      draft.useSeenFlag = booleanValue(data['event.useSeenFlag']);
    }
    if (has(data, 'event.intro')) {
      draft.introParagraphs = paragraphs(data['event.intro']);
    }
    setNumber(data, draft.when, 'event.year', 'year');
    setNumber(data, draft.when, 'event.monthStart', 'monthStart');
    setNumber(data, draft.when, 'event.monthEnd', 'monthEnd');
    setString(data, draft.when, 'event.requires', 'requires');
    if (String(draft.eventShape || '') === 'pure_event' && has(data, 'event.requires')) {
      draft.rawViewIf = String(data['event.requires'] || '').trim();
      draft.when.requires = '';
    }
    setNumber(data, draft.when, 'event.priority', 'priority');
    draft.effectsOnTrigger = applyEffectValues(data, 'event.effect', draft.effectsOnTrigger);
    draft.options = ensureArray(draft.options).map((option, index) => {
      const next = clone(option);
      setString(data, next, 'option.' + index + '.label', 'label');
      setString(data, next, 'option.' + index + '.subtitle', 'subtitle');
      setString(data, next, 'option.' + index + '.chooseIf', 'chooseIf');
      setString(data, next, 'option.' + index + '.unavailableText', 'unavailableText');
      setString(data, next, 'option.' + index + '.gotoAfter', 'gotoAfter', safeId);
      setString(data, next, 'option.' + index + '.returnTarget', 'returnTarget', safeId);
      if (has(data, 'option.' + index + '.body')) {
        next.narrativeParagraphs = paragraphs(data['option.' + index + '.body']);
      }
      next.effects = applyEffectValues(data, 'option.' + index + '.effect', next.effects);
      return next;
    });
    const sections = ensureArray(draft.sections).map((section, index) => {
      const next = clone(section);
      setString(data, next, 'event.section.' + index + '.title', 'title');
      setString(data, next, 'event.section.' + index + '.condition', 'condition');
      setString(data, next, 'event.section.' + index + '.exitTarget', 'exitTarget', safeId);
      if (has(data, 'event.section.' + index + '.body')) {
        next.paragraphs = paragraphs(data['event.section.' + index + '.body']);
      }
      return next;
    });
    if (sections.length) {
      draft.sections = sections;
    } else {
      delete draft.sections;
    }
    if (!draft.heading) {
      draft.heading = draft.title;
    }
    if (!draft.seenFlag || has(data, 'event.id')) {
      draft.seenFlag = safeId((draft.id || 'new_world_event') + '_seen');
    }
    if (!draft.useSeenFlag) {
      draft.seenFlag = '';
    }
    draft = applyEventStructureValues(draft, data);
    return draft;
  }

  function applyEventStructureValues(draft, data) {
    const structureApi = eventStructureApi();
    if (!structureApi || typeof structureApi.fromDraft !== 'function' || typeof structureApi.commandsFromValues !== 'function' || typeof structureApi.applyCommand !== 'function' || typeof structureApi.toDraft !== 'function') {
      return draft;
    }
    let structure = structureApi.fromDraft(draft);
    const commands = structureApi.commandsFromValues(data, structure);
    if (!commands.length) {
      return draft;
    }
    commands.forEach((command) => {
      structure = structureApi.applyCommand(structure, command);
    });
    return structureApi.toDraft(structure, draft);
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
    const titleChanged = has(data, 'card.title');
    const headingChanged = has(data, 'card.heading');
    setString(data, draft, 'card.id', 'id', safeId);
    setString(data, draft, 'card.title', 'title');
    setString(data, draft, 'card.heading', 'heading');
    setString(data, draft, 'card.subtitle', 'subtitle');
    setString(data, draft, 'card.cardShape', 'cardShape');
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
      setString(data, next, 'card.option.' + index + '.unavailableText', 'unavailableText');
      setString(data, next, 'card.option.' + index + '.gotoAfter', 'gotoAfter', safeId);
      if (has(data, 'card.option.' + index + '.body')) {
        next.narrativeParagraphs = paragraphs(data['card.option.' + index + '.body']);
      }
      next.effects = applyEffectValues(data, 'card.option.' + index + '.effect', next.effects);
      return next;
    });
    const sections = ensureArray(draft.sections).map((section, index) => {
      const next = clone(section);
      setString(data, next, 'card.section.' + index + '.title', 'title');
      setString(data, next, 'card.section.' + index + '.condition', 'condition');
      setString(data, next, 'card.section.' + index + '.exitTarget', 'exitTarget', safeId);
      if (has(data, 'card.section.' + index + '.body')) {
        next.paragraphs = paragraphs(data['card.section.' + index + '.body']);
      }
      next.effects = applyEffectValues(data, 'card.section.' + index + '.effect', next.effects);
      next.options = ensureArray(next.options).map((option, optionIndex) => {
        const optionNext = clone(option);
        setString(data, optionNext, 'card.section.' + index + '.option.' + optionIndex + '.label', 'label');
        setString(data, optionNext, 'card.section.' + index + '.option.' + optionIndex + '.title', 'title');
        setString(data, optionNext, 'card.section.' + index + '.option.' + optionIndex + '.subtitle', 'subtitle');
        setString(data, optionNext, 'card.section.' + index + '.option.' + optionIndex + '.chooseIf', 'chooseIf');
        setString(data, optionNext, 'card.section.' + index + '.option.' + optionIndex + '.unavailableText', 'unavailableText');
        setString(data, optionNext, 'card.section.' + index + '.option.' + optionIndex + '.gotoAfter', 'gotoAfter', safeId);
        if (has(data, 'card.section.' + index + '.option.' + optionIndex + '.body')) {
          optionNext.narrativeParagraphs = paragraphs(data['card.section.' + index + '.option.' + optionIndex + '.body']);
        }
        optionNext.effects = applyEffectValues(data, 'card.section.' + index + '.option.' + optionIndex + '.effect', optionNext.effects);
        return optionNext;
      });
      return next;
    });
    if (sections.length) {
      draft.sections = sections;
    }
    if (titleChanged && !headingChanged) {
      draft.heading = draft.title;
    } else if (!draft.heading) {
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

  function applyElectionResultsValues(baseDraft, values, context) {
    const data = isObject(values) ? values : {};
    const previousTarget = String(baseDraft && baseDraft.targetSceneId || '').trim();
    const requestedTarget = has(data, 'election.targetSceneId')
      ? String(data['election.targetSceneId'] || '').trim()
      : previousTarget;
    const targetChanged = Boolean(requestedTarget && requestedTarget !== previousTarget);
    const draft = applyScalarValues(baseDraft, values, 'election.', [
      'id',
      'title',
      'subtitle',
      'targetSceneId',
      'electionKind',
      'year',
      'month',
      'viewIf',
      'intro',
      'resultText',
      'conditionText',
      'seatsTotal',
      'sourcePath',
      'chartElementId'
    ], ['id']);
    const selectedSource = targetChanged ? selectedElectionSourceForDraft(draft, requestedTarget, context) : null;
    if (selectedSource) {
      applySelectedElectionSource(draft, selectedSource);
    }
    if (targetChanged && selectedSource) {
      return draft;
    }
    if (has(data, 'election.useD3Parliament')) {
      draft.useD3Parliament = booleanValue(data['election.useD3Parliament']);
    }
    draft.effects = applyEffectValues(data, 'election.effect', draft.effects);
    draft.parties = ensureArray(draft.parties).map((party, index) => {
      if (has(data, 'election.party.' + index + '.remove') && booleanValue(data['election.party.' + index + '.remove'])) {
        return null;
      }
      const next = clone(party);
      setString(data, next, 'election.party.' + index + '.key', 'key', safeId);
      setString(data, next, 'election.party.' + index + '.name', 'name');
      setString(data, next, 'election.party.' + index + '.color', 'color', safeColor);
      setString(data, next, 'election.party.' + index + '.voteShare', 'voteShare');
      setString(data, next, 'election.party.' + index + '.voteChange', 'voteChange');
      setString(data, next, 'election.party.' + index + '.seatsShare', 'seatsShare');
      setString(data, next, 'election.party.' + index + '.seatsChange', 'seatsChange');
      setString(data, next, 'election.party.' + index + '.seats', 'seats');
      return next;
    }).filter(Boolean);
    const addedParty = electionPartyFromAddFields(data);
    if (addedParty) {
      draft.parties.push(addedParty);
    }
    draft.coalitions = ensureArray(draft.coalitions).map((coalition, index) => {
      if (has(data, 'election.coalition.' + index + '.remove') && booleanValue(data['election.coalition.' + index + '.remove'])) {
        return null;
      }
      const next = clone(coalition);
      setString(data, next, 'election.coalition.' + index + '.key', 'key', safeId);
      setString(data, next, 'election.coalition.' + index + '.name', 'name');
      setString(data, next, 'election.coalition.' + index + '.parties', 'parties');
      setString(data, next, 'election.coalition.' + index + '.share', 'share');
      setString(data, next, 'election.coalition.' + index + '.description', 'description');
      return next;
    }).filter(Boolean);
    const addedCoalition = electionCoalitionFromAddFields(data);
    if (addedCoalition) {
      draft.coalitions.push(addedCoalition);
    }
    draft.choices = ensureArray(draft.choices).map((choice, index) => {
      if (has(data, 'election.choice.' + index + '.remove') && booleanValue(data['election.choice.' + index + '.remove'])) {
        return null;
      }
      const next = clone(choice);
      setString(data, next, 'election.choice.' + index + '.key', 'key', safeId);
      setString(data, next, 'election.choice.' + index + '.label', 'label');
      setString(data, next, 'election.choice.' + index + '.detail', 'detail');
      setString(data, next, 'election.choice.' + index + '.condition', 'condition');
      setString(data, next, 'election.choice.' + index + '.resultText', 'resultText');
      if (has(data, 'election.choice.' + index + '.disabled')) {
        next.disabled = booleanValue(data['election.choice.' + index + '.disabled']);
      }
      next.effects = applyEffectValues(data, 'election.choice.' + index + '.effect', next.effects);
      return next;
    }).filter(Boolean);
    const addedChoice = electionChoiceFromAddFields(data);
    if (addedChoice) {
      draft.choices.push(addedChoice);
    }
    return draft;
  }

  function selectedElectionSourceForDraft(draft, targetSceneId, context) {
    const target = String(targetSceneId || '').trim();
    if (!target) {
      return null;
    }
    const existing = ensureArray(draft && draft.electionEvents).find((item) => item && String(item.id || '') === target);
    if (existing && hasElectionSourceText(existing)) {
      return existing;
    }
    const api = context && context.api;
    if (api && typeof api.collectElectionEvents === 'function') {
      const rows = api.collectElectionEvents(context.projectIndex);
      return ensureArray(rows).find((item) => item && String(item.id || '') === target) || existing || null;
    }
    return existing || null;
  }

  function applySelectedElectionSource(draft, source) {
    if (!draft || !source) {
      return draft;
    }
    const hasSourceText = hasElectionSourceText(source);
    draft.targetSceneId = String(source.id || draft.targetSceneId || '').trim();
    draft.sourceBacked = hasSourceText;
    draft.title = String(hasSourceText ? (source.screenTitle || source.title || draft.title || '') : (source.title || draft.title || '')).trim();
    draft.subtitle = String(source.subtitle || draft.subtitle || '').trim();
    if (hasSourceText) {
      draft.intro = String(source.intro || '').trim();
    } else {
      draft.intro = '';
    }
    draft.electionKind = String(source.electionKind || draft.electionKind || 'election').trim();
    draft.year = String(source.year || draft.year || '').trim();
    draft.month = String(source.month || draft.month || '').trim();
    draft.viewIf = String(source.viewIf || '').trim();
    draft.conditionText = String(source.conditionText || '').trim();
    if (hasSourceText) {
      draft.resultText = String(source.resultText || '').trim();
    } else {
      draft.resultText = '';
    }
    draft.sourcePath = String(source.path || draft.sourcePath || '').trim();
    draft.chartElementId = String(source.chartElementId || draft.chartElementId || '').trim();
    if (source.seatsTotal) {
      draft.seatsTotal = String(source.seatsTotal);
    }
    if (source.usesD3Parliament !== undefined) {
      draft.useD3Parliament = booleanValue(source.usesD3Parliament);
    }
    if (Array.isArray(source.parties) && source.parties.length) {
      draft.parties = clone(source.parties);
    }
    if (hasSourceText) {
      draft.coalitions = Array.isArray(source.coalitions) ? clone(source.coalitions) : [];
      draft.choices = Array.isArray(source.choices) ? clone(source.choices) : [];
    } else {
      draft.coalitions = [];
      draft.choices = [];
    }
    draft.evidence = Object.assign({}, draft.evidence || {}, source.evidence || {});
    return draft;
  }

  function hasElectionSourceText(source) {
    return Boolean(source && (
      source.intro ||
      source.resultText ||
      ensureArray(source.choices).length ||
      ensureArray(source.coalitions).length ||
      source.evidence && Number(source.evidence.sourceChoices || 0) > 0
    ));
  }

  function electionPartyFromAddFields(data) {
    const name = String(data && data['election.party.add.name'] || '').trim();
    const key = safeId(data && data['election.party.add.key'] || name || '');
    if (!name && !data['election.party.add.key']) {
      return null;
    }
    return {
      key,
      name: name || key,
      color: safeColor(data['election.party.add.color'] || '#999999'),
      voteShare: String(data['election.party.add.voteShare'] || '').trim(),
      voteChange: String(data['election.party.add.voteChange'] || '0').trim(),
      seatsShare: String(data['election.party.add.seatsShare'] || '').trim(),
      seatsChange: String(data['election.party.add.seatsChange'] || '0').trim(),
      seats: String(data['election.party.add.seats'] || '').trim()
    };
  }

  function electionCoalitionFromAddFields(data) {
    const name = String(data && data['election.coalition.add.name'] || '').trim();
    const parties = String(data && data['election.coalition.add.parties'] || '').trim();
    const key = safeId(data && data['election.coalition.add.key'] || name || parties || '');
    if (!name && !parties && !data['election.coalition.add.key']) {
      return null;
    }
    return {
      key,
      name: name || key,
      parties,
      share: String(data['election.coalition.add.share'] || '').trim(),
      description: String(data['election.coalition.add.description'] || '').trim()
    };
  }

  function electionChoiceFromAddFields(data) {
    const label = String(data && data['election.choice.add.label'] || '').trim();
    const key = safeId(data && data['election.choice.add.key'] || label || '');
    if (!label && !data['election.choice.add.key']) {
      return null;
    }
    return {
      key,
      label: label || key,
      detail: String(data['election.choice.add.detail'] || '').trim(),
      condition: String(data['election.choice.add.condition'] || '').trim(),
      resultText: String(data['election.choice.add.resultText'] || '').trim(),
      disabled: has(data, 'election.choice.add.disabled') && booleanValue(data['election.choice.add.disabled']),
      effects: []
    };
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
      manualBoundaries: boundaryRows(projectIndex, def, draft)
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
    const existing = variableMapForProject(projectIndex);
    return Array.from(names).map((name) => {
      const variable = existing.get(name) || {};
      return {
        name,
        reads: ensureArray(variable.reads),
        writes: ensureArray(variable.writes),
        readCount: Number(variable.readCount || 0),
        writeCount: Number(variable.writeCount || 0),
        tags: ensureArray(variable.tags).map(String),
        status: existing.has(name) ? 'referenced' : 'new_or_missing',
        createAction: existing.has(name) ? null : {
          actionKind: 'open_variable_editor',
          targetView: 'variables',
          targetId: name,
          variableName: name,
          installSafety: 'guarded_apply'
        }
      };
    });
  }

  function variableMapForProject(projectIndex) {
    const index = projectIndex && typeof projectIndex === 'object' ? projectIndex : null;
    if (index && variableMapCache && variableMapCache.has(index)) {
      return variableMapCache.get(index);
    }
    const existing = new Map();
    ensureArray(projectIndex && projectIndex.variables).forEach((variable) => {
      if (variable && variable.name) {
        existing.set(String(variable.name), variable);
      }
    });
    if (index && variableMapCache) {
      variableMapCache.set(index, existing);
    }
    return existing;
  }

  function effectRows(draft) {
    const rows = [];
    ensureArray(draft.effects).forEach((effect) => rows.push(effectRow(effect)));
    ensureArray(draft.effectsOnTrigger).forEach((effect) => rows.push(effectRow(effect)));
    ensureArray(draft.options).forEach((option) => {
      ensureArray(option.effects).forEach((effect) => rows.push(effectRow(effect)));
    });
    ensureArray(draft.choices).forEach((choice) => {
      ensureArray(choice.effects).forEach((effect) => rows.push(effectRow(effect)));
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
      condition: String(value.condition || ''),
      hook: String(value.hook || ''),
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

  function boundaryRows(projectIndex, def, draft) {
    if (def.objectKind === 'event') {
      const routerRegistration = eventRouterRegistrationHint(projectIndex, draft);
      if (routerRegistration) {
        return [{
          label: 'Profile-aware router registration',
          reason: 'Known Dendry-style profiles can register the monthly #event lane through Review & Apply.',
          status: 'advanced_apply',
          source: {path: routerRegistration.path || 'source/scenes/post_event.scene.dry'},
          action: {
            actionKind: 'open_advanced_source_patch',
            routeClass: 'news_router_workflow',
            targetView: 'router',
            targetId: draft && draft.id || '',
            fieldId: 'router.registration',
            installSafety: 'advanced_apply',
            draftAction: true
          }
        }];
      }
      return [{
        label: 'Router wiring',
        reason: 'No known profile router rule was found; router wiring remains a pending profile setup item.',
        status: 'pending_profile_rule',
        action: {
          actionKind: 'open_profile_router_rule',
          routeClass: 'profile_router_rule',
          targetView: 'router',
          targetId: draft && draft.id || '',
          fieldId: 'router.registration',
          installSafety: 'guarded_apply',
          draftAction: true
        },
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

  function eventRouterRegistrationHint(projectIndex, draft) {
    const api = draftApi(DEFINITIONS.event);
    if (!api || typeof api.routerInstallHint !== 'function') {
      return null;
    }
    try {
      return api.routerInstallHint(draft || {}, projectIndex || null, null);
    } catch (_err) {
      return null;
    }
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
    if (def.objectKind === 'election_results') {
      return id + '.election-results-draft.json';
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
    if (!isObject(values)) {
      return 0;
    }
    return Object.keys(values).reduce((count, key) => {
      if (key === '__structureCommands' || key === 'structure_commands' || key === 'structureCommands') {
        return count + (Array.isArray(values[key]) ? values[key].length : 0);
      }
      return count + 1;
    }, 0);
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

  function applyEffectValues(data, prefix, effects) {
    const rows = ensureArray(effects).map((effect) => {
      const value = isObject(effect) ? clone(effect) : {};
      return {
        variable: String(value.variable || '').trim(),
        op: String(value.op || '').trim(),
        value: value.value,
        condition: String(value.condition || '').trim(),
        hook: String(value.hook || '').trim()
      };
    });
    rows.forEach((effect, index) => {
      setString(data, effect, prefix + '.' + index + '.variable', 'variable', safeId);
      setString(data, effect, prefix + '.' + index + '.op', 'op');
      effect.op = normalizeEffectOp(effect.op);
      if (has(data, prefix + '.' + index + '.value')) {
        effect.value = effectValue(data[prefix + '.' + index + '.value'], effect.op, effect.value);
      }
      setString(data, effect, prefix + '.' + index + '.condition', 'condition');
      setString(data, effect, prefix + '.' + index + '.hook', 'hook');
    });
    const addVariable = String(data && data[prefix + '.add.variable'] || '').trim();
    if (addVariable) {
      const op = normalizeEffectOp(data[prefix + '.add.op'] || '+=');
      rows.push({
        variable: safeId(addVariable),
        op,
        value: effectValue(data[prefix + '.add.value'], op, 1),
        condition: String(data[prefix + '.add.condition'] || '').trim(),
        hook: String(data[prefix + '.add.hook'] || '').trim()
      });
    }
    return rows.filter((effect) => effect.variable);
  }

  function normalizeEffectOp(value) {
    const op = String(value || '+=').trim();
    return op === '=' || op === '+=' || op === '-=' ? op : '+=';
  }

  function effectValue(value, op, fallback) {
    const text = String(value === undefined || value === null ? '' : value).trim();
    if (op && op !== '=') {
      const number = Number(text);
      return Number.isFinite(number) ? number : numberOr(fallback, 0);
    }
    if (/^-?\d+(?:\.\d+)?$/.test(text)) {
      return Number(text);
    }
    return text || fallback || '';
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

  function labelFromName(name) {
    return String(name || 'New Variable')
      .replace(/^q_/, '')
      .replace(/_/g, ' ')
      .replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }

  function safeColor(value) {
    const text = String(value || '').trim();
    return /^#[0-9A-Fa-f]{6}$/.test(text) ? text.toUpperCase() : text;
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
