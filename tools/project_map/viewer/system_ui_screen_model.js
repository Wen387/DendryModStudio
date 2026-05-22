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
    const sidebarCategories = buildSidebarCategories(fields, template, fixtureState, opts.projectIndex);
    const selectedSidebarCategory = selectSidebarCategory(sidebarCategories, opts.selected);
    const rawRegions = template === 'election_results'
      ? buildElectionResultsRegions(fields)
      : buildRegions(fields, template, fixtureState, selectedSidebarCategory);
    const regions = enrichRegions(rawRegions, {template, sourceEvidence, fixtureState});
    const selectedKey = selectRegionKey(regions, opts.selected, recipe.selected);
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
      shell: buildShell(fields, template, fixtureState),
      electionResults: template === 'election_results' ? buildElectionResultsView(fields) : null,
      diagnostics: []
    };
    screen.regionContext = buildRegionContext(screen, {recipe, fixture: fixtureState});
    screen.diagnostics = buildDiagnostics(template, recipe, selected, screen.regionContext, fixtureState);
    attachCapabilityMatrix(screen, {runtimeVisualSurface: opts.runtimeVisualSurface});
    return screen;
  }

  function buildRegions(fields, template, fixture, selectedSidebarCategory) {
    const rootTitle = value(fields, ['project.gameTitle', 'entry.rootTitle', 'play.title', 'layout.title', 'sidebar.statusTitle'], 'Dynamic Social Democracy');
    const headerBody = value(fields, ['project.author', 'project.ifid'], 'Library / Save/Load / Options');
    const hasSelectedSidebarCategory = Boolean(selectedSidebarCategory && selectedSidebarCategory.id);
    const sidebarTitle = hasSelectedSidebarCategory ? selectedSidebarCategory.heading : value(fields, ['sidebar.statusTitle', 'entry.sidebarTitle', 'layout.sidebarHeading'], 'Status');
    const sidebarBody = hasSelectedSidebarCategory ? selectedSidebarCategory.body : value(fields, ['sidebar.sectionBody', 'entry.sidebarBody', 'layout.sidebarBody'], fixture.sidebarBody || 'Resources available: 0');
    const authoredStatusLines = hasSelectedSidebarCategory ? selectedSidebarCategory.statusLines : value(fields, ['sidebar.sectionStatusLines', 'entry.sidebarStatusLines', 'layout.sidebarStatusLines'], '');
    const fixtureStatusLines = ensureArray(fixture.statusLines).join('\n');
    const statusLines = sidebarStatusLinesForPreview({
      authoredStatusLines,
      fixtureStatusLines,
      fixtureKey: fixture.key,
      hasSelectedSidebarCategory
    });
    const mainTitle = value(fields, ['entry.rootTitle', 'play.handTitle', 'layout.starterCardTitle', 'sidebar.sectionHeading'], 'Read.');
    const mainHeading = value(fields, ['entry.rootHeading', 'play.handHeading', 'layout.starterCardHeading', 'sidebar.sectionHeading'], mainTitle);
    const mainBody = value(fields, ['entry.rootIntro', 'play.handBody', 'layout.starterCardBody', 'sidebar.sectionBody'], fixture.mainHint || 'This is the player-facing reading area.');
    const mainOption = value(fields, ['entry.firstOptionTitle', 'play.handDeckOptionLabel', 'layout.handOptionLabel'], fixture.optionHint || 'Continue');
    const deckTitle = value(fields, ['play.deckTitle', 'layout.deckTitle'], 'Starter Deck');
    const deckSubtitle = value(fields, ['play.deckSubtitle', 'layout.deckSubtitle'], fixture.interactiveHint || 'Repeatable actions');
    const cardTitle = value(fields, ['play.cardTitle', 'layout.starterCardTitle'], 'Action Card');
    const cardBody = value(fields, ['play.cardBody', 'layout.starterCardBody'], 'A playable card appears here.');
    const advisorTitle = value(fields, ['play.advisorTitle'], 'Advisor');
    const advisorBody = value(fields, ['play.advisorBody'], 'A pinned advisor or standing object lives beside the hand.');

    return [
      region('layout_frame', 'structure', 'systemUi.region.layoutFrame', 'Screen frame', rootTitle, 'Header, sidebar, main card, and interactive lane share one screen shell.', fieldsFor(fields, fieldIdsForTemplate(template, 'structure'))),
      region('screen_header', 'structure', 'systemUi.region.header', 'Header / menu', rootTitle, headerBody, fieldsFor(fields, ['project.gameTitle', 'project.author', 'project.ifid', 'entry.rootTitle', 'play.title', 'layout.title', 'sidebar.statusTitle'])),
      region('main_content', 'main', 'systemUi.region.mainContent', 'Main content', mainHeading, mainBody, fieldsFor(fields, fieldIdsForTemplate(template, 'main'))),
      region('main_options', 'main', 'systemUi.region.options', 'Options', mainOption, value(fields, ['entry.firstTargetId', 'layout.starterCardReturnTarget'], ''), fieldsFor(fields, ['entry.firstOptionTitle', 'entry.firstTargetId', 'layout.handOptionLabel', 'play.handDeckOptionLabel', 'play.handAdvisorOptionLabel'])),
      region('workspace_hand', 'interactive', 'systemUi.region.hand', 'Hand', value(fields, ['play.handTitle', 'play.handHeading'], 'Workspace Hand'), value(fields, ['play.handBody'], 'This area holds repeatable player actions.'), fieldsFor(fields, ['play.handTitle', 'play.handHeading', 'play.handBody', 'play.handDeckOptionLabel', 'play.handAdvisorOptionLabel'])),
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
        evidence: section.evidence || null
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
      fieldLike('sidebar.sectionStatusLines', 'Status lines', category.statusLines, {inputType: 'textarea'})
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
        ? ['layout.title', 'layout.deckTitle', 'layout.deckSubtitle', 'layout.handOptionLabel', 'layout.handInsertMode', 'layout.sidebarHeading', 'layout.sidebarInsertMode', 'layout.createStarterCard']
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
    if (regions.some((region) => region.key === key)) {
      return key;
    }
    if (regions.some((region) => region.key === fallback)) {
      return fallback;
    }
    return regions[0] && regions[0].key || '';
  }

  function buildDiagnostics(template, recipe, selected, regionContext, fixture) {
    return [
      {id: 'selected_family', labelKey: 'systemUi.diagnostic.selectedFamily', label: 'Selected family', value: selected && selected.family || ''},
      {id: 'selected_region', labelKey: 'systemUi.diagnostic.selectedRegion', label: 'Selected region', value: selected && selected.key || ''},
      {id: 'owner_template', labelKey: 'systemUi.diagnostic.ownerTemplate', label: 'Owner template', value: regionContext && regionContext.ownership && regionContext.ownership.ownerTemplate || ''},
      {id: 'fixture', labelKey: 'systemUi.diagnostic.fixture', label: 'Fixture', value: fixture && fixture.fallback || ''}
    ].concat(ensureArray(fixture && fixture.diagnostics));
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
