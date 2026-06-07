(function initProjectMapSystemUiRegionContext(global) {
  'use strict';

  const REGION_OWNERS = {
    layout_frame: owner('workspace_layout', 'workspace_layout', 'systemUi.owner.layout', 'Workspace Layout', 'layout'),
    screen_header: owner('project', 'project_metadata', 'systemUi.owner.project', 'Game Info', 'header'),
    main_content: owner('entry', 'entry_sidebar', 'systemUi.owner.entry', 'Entry & Sidebar', 'main'),
    main_options: owner('entry', 'entry_sidebar', 'systemUi.owner.entry', 'Entry & Sidebar', 'route'),
    workspace_hand: owner('play_surface', 'play_surface', 'systemUi.owner.playSurface', 'Playable Surface', 'hand'),
    deck_lane: owner('workspace_layout', 'workspace_layout', 'systemUi.owner.layout', 'Workspace Layout', 'deck'),
    action_card: owner('workspace_layout', 'workspace_layout', 'systemUi.owner.layout', 'Workspace Layout', 'card'),
    advisor_lane: owner('play_surface', 'play_surface', 'systemUi.owner.playSurface', 'Playable Surface', 'advisor'),
    sidebar_status: owner('sidebar_status', 'sidebar_status', 'systemUi.owner.sidebar', 'Sidebar / Status', 'sidebar'),
    right_sidebar: owner('right_sidebar', 'right_sidebar', 'systemUi.rightSidebar.label', 'Right panel', 'right'),
    election_results_frame: owner('election_results', 'election_results', 'systemUi.owner.electionResults', 'Election Results', 'frame'),
    election_results_chart: owner('election_results', 'election_results', 'systemUi.owner.electionResults', 'Election Results', 'seat chart'),
    election_results_table: owner('election_results', 'election_results', 'systemUi.owner.electionResults', 'Election Results', 'party table'),
    election_results_coalitions: owner('election_results', 'election_results', 'systemUi.owner.electionResults', 'Election Results', 'coalitions'),
    election_results_choices: owner('election_results', 'election_results', 'systemUi.owner.electionResults', 'Election Results', 'choices')
  };

  const NEARBY = {
    layout_frame: ['screen_header', 'sidebar_status', 'main_content', 'workspace_hand'],
    screen_header: ['layout_frame', 'main_content', 'sidebar_status'],
    main_content: ['screen_header', 'main_options', 'sidebar_status', 'workspace_hand'],
    main_options: ['main_content', 'workspace_hand', 'action_card'],
    workspace_hand: ['main_content', 'deck_lane', 'action_card', 'advisor_lane'],
    deck_lane: ['workspace_hand', 'action_card', 'layout_frame'],
    action_card: ['deck_lane', 'workspace_hand', 'main_options'],
    advisor_lane: ['workspace_hand', 'sidebar_status'],
    sidebar_status: ['screen_header', 'main_content', 'advisor_lane'],
    right_sidebar: ['sidebar_status', 'main_content', 'screen_header'],
    election_results_frame: ['election_results_chart', 'election_results_table', 'election_results_choices'],
    election_results_chart: ['election_results_frame', 'election_results_table', 'election_results_coalitions'],
    election_results_table: ['election_results_chart', 'election_results_coalitions'],
    election_results_coalitions: ['election_results_table', 'election_results_choices'],
    election_results_choices: ['election_results_coalitions', 'election_results_chart']
  };

  function enrichRegions(regions, options) {
    const opts = isObject(options) ? options : {};
    return ensureArray(regions).map((region) => {
      const key = String(region && region.key || '');
      const ownership = ownerForRegion(key);
      const fields = ensureArray(region && region.fields);
      return Object.assign({}, region, {
        ownerTemplate: ownership.template,
        ownerKind: ownership.kind,
        ownerLabelKey: ownership.labelKey,
        ownerFallback: ownership.fallback,
        ownerSlot: ownership.slot,
        routeTemplate: ownership.template,
        fieldIds: fields.map((field) => field && field.id).filter(Boolean),
        sourceEvidence: sourceEvidenceForRegion(key, fields, opts.sourceEvidence)
      });
    });
  }

  function buildContext(screen, options) {
    const opts = isObject(options) ? options : {};
    const model = isObject(screen) ? screen : {};
    const regions = ensureArray(model.regions);
    const selected = model.selected || regions.find((region) => region && 'ui:' + region.key === model.selectedKey) || regions[0] || null;
    const ownership = selected ? ownerForRegion(selected.key) : owner('', '', '', '', '');
    const nearby = ensureArray(selected && NEARBY[selected.key]).map((key) => regions.find((region) => region.key === key)).filter(Boolean);
    const recipe = opts.recipe || model.recipe || {};
    const fixture = opts.fixture || model.fixtureState || {};
    return {
      selectedKey: selected ? 'ui:' + selected.key : '',
      selectedRegion: selected,
      ownership: {
        regionKey: selected && selected.key || '',
        family: selected && selected.family || '',
        ownerTemplate: ownership.template,
        ownerKind: ownership.kind,
        ownerLabelKey: ownership.labelKey,
        ownerFallback: ownership.fallback,
        ownerSlot: ownership.slot,
        activeTemplate: model.template || '',
        activeRecipeKey: recipe.key || '',
        activeRecipeLabelKey: recipe.labelKey || '',
        activeRecipeFallback: recipe.fallback || ''
      },
      nearbyRegions: nearby.map((region) => ({
        key: region.key,
        family: region.family,
        title: region.title,
        labelKey: region.labelKey,
        fallback: region.fallback,
        ownerTemplate: region.ownerTemplate,
        ownerFallback: region.ownerFallback
      })),
      sourceEvidence: selected ? ensureArray(selected.sourceEvidence) : [],
      diagnostics: diagnosticsFor(selected, ownership, recipe, fixture)
    };
  }

  function ownerForRegion(key) {
    return REGION_OWNERS[String(key || '')] || owner('', '', '', '', '');
  }

  function sourceEvidenceForRegion(regionKey, fields, sourceEvidence) {
    const rows = [];
    ensureArray(fields).forEach((field) => {
      const source = field && field.source || {};
      if (source.path) {
        rows.push({
          label: field.label || field.id || regionKey,
          path: source.path,
          line: source.line || source.startLine || null,
          status: field.status || field.editability || 'field'
        });
      }
    });
    ensureArray(sourceEvidence).forEach((row) => {
      if (row && row.path && !rows.some((item) => item.path === row.path && item.line === row.line)) {
        rows.push({
          label: row.label || regionKey,
          path: row.path,
          line: row.line || null,
          status: row.status || 'evidence'
        });
      }
    });
    return rows.slice(0, 4);
  }

  function diagnosticsFor(selected, ownership, recipe, fixture) {
    return [
      {
        id: 'selected_region',
        labelKey: 'systemUi.diagnostic.selectedRegion',
        label: 'Selected region',
        value: selected && selected.key || ''
      },
      {
        id: 'owner_template',
        labelKey: 'systemUi.diagnostic.ownerTemplate',
        label: 'Owner template',
        value: ownership.template || ''
      },
      {
        id: 'active_recipe',
        labelKey: 'systemUi.diagnostic.activeRecipe',
        label: 'Active recipe',
        value: recipe && (recipe.fallback || recipe.key) || ''
      },
      {
        id: 'fixture',
        labelKey: 'systemUi.diagnostic.fixture',
        label: 'Fixture',
        value: fixture && (fixture.fallback || fixture.key) || ''
      }
    ];
  }

  function owner(template, kind, labelKey, fallback, slot) {
    return {template, kind, labelKey, fallback, slot};
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {buildContext, enrichRegions, ownerForRegion};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSystemUiRegionContext = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
