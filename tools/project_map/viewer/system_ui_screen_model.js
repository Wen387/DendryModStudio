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

  const FAMILY_ORDER = ['structure', 'main', 'interactive', 'sidebar'];
  const FAMILY_LABELS = {
    structure: {labelKey: 'systemUi.family.structure', fallback: 'Screen structure'},
    main: {labelKey: 'systemUi.family.main', fallback: 'Main content'},
    interactive: {labelKey: 'systemUi.family.interactive', fallback: 'Interactive objects'},
    sidebar: {labelKey: 'systemUi.family.sidebar', fallback: 'Sidebar / Status'}
  };

  function buildScreen(model, options) {
    const opts = isObject(options) ? options : {};
    const source = isObject(model) ? model : {};
    const template = normalizeTemplate(source.template || source.objectKind || source.mode);
    const recipe = RECIPES[template] || RECIPES.entry;
    const fields = fieldMap(source);
    const fixture = normalizeFixture(opts.fixture);
    const regions = buildRegions(fields, template, fixture);
    const selectedKey = selectRegionKey(regions, opts.selected, recipe.selected);
    const selected = regionByKey(regions, selectedKey) || regions[0] || null;
    const focusFamilies = recipeFocusFamilies(recipe, selected);
    return {
      schemaVersion: '0.1',
      kind: 'system_ui_screen_model',
      template,
      fixture,
      recipe,
      families: FAMILY_ORDER.map((key) => Object.assign({key, active: focusFamilies.includes(key)}, FAMILY_LABELS[key])),
      focusFamilies,
      selectedKey: selected ? 'ui:' + selected.key : '',
      selected,
      regions,
      shell: buildShell(fields, template, fixture),
      diagnostics: buildDiagnostics(template, recipe, selected)
    };
  }

  function buildRegions(fields, template, fixture) {
    const rootTitle = value(fields, ['project.gameTitle', 'entry.rootTitle', 'play.title', 'layout.title', 'sidebar.statusTitle'], 'Dynamic Social Democracy');
    const headerBody = value(fields, ['project.author', 'project.ifid'], 'Library / Save/Load / Options');
    const sidebarTitle = value(fields, ['sidebar.statusTitle', 'entry.sidebarTitle', 'layout.sidebarHeading'], 'Status');
    const sidebarBody = value(fields, ['sidebar.sectionBody', 'entry.sidebarBody', 'layout.sidebarBody'], 'Resources available: 0');
    const statusLines = value(fields, ['sidebar.sectionStatusLines', 'entry.sidebarStatusLines', 'layout.sidebarStatusLines'], fixture === 'busy' ? 'Internal dissent: rising\nPolicy work has started moving.' : 'Internal dissent: very low\nResources available: 0');
    const mainTitle = value(fields, ['entry.rootTitle', 'play.handTitle', 'layout.starterCardTitle', 'sidebar.sectionHeading'], 'Read.');
    const mainHeading = value(fields, ['entry.rootHeading', 'play.handHeading', 'layout.starterCardHeading', 'sidebar.sectionHeading'], mainTitle);
    const mainBody = value(fields, ['entry.rootIntro', 'play.handBody', 'layout.starterCardBody', 'sidebar.sectionBody'], 'This is the player-facing reading area.');
    const mainOption = value(fields, ['entry.firstOptionTitle', 'play.handDeckOptionLabel', 'layout.handOptionLabel'], 'Continue');
    const deckTitle = value(fields, ['play.deckTitle', 'layout.deckTitle'], 'Starter Deck');
    const deckSubtitle = value(fields, ['play.deckSubtitle', 'layout.deckSubtitle'], 'Repeatable actions');
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
      region('sidebar_status', 'sidebar', 'systemUi.region.sidebar', 'Sidebar / Status', sidebarTitle, [sidebarBody, statusLines].filter(Boolean).join('\n'), fieldsFor(fields, fieldIdsForTemplate(template, 'sidebar')))
    ];
  }

  function buildShell(fields, template, fixture) {
    return {
      title: value(fields, ['project.gameTitle', 'entry.rootTitle', 'play.title', 'layout.title', 'sidebar.statusTitle'], 'Dynamic Social Democracy'),
      subtitle: value(fields, ['project.author', 'entry.rootHeading', 'play.handHeading', 'layout.deckSubtitle', 'sidebar.sectionHeading'], 'An alternate history'),
      menu: ['Library', 'Save/Load', 'Options'],
      fixture,
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

  function buildDiagnostics(template, recipe, selected) {
    return [
      {id: 'selected_family', label: 'Selected family', value: selected && selected.family || ''},
      {id: 'selected_region', label: 'Selected region', value: selected && selected.key || ''}
    ];
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

  function normalizeFixture(value) {
    return String(value || '') === 'busy' ? 'busy' : 'default';
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
