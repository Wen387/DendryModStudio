(function initProjectMapSystemUiWorkspaceState(global) {
  'use strict';

  const DEFAULT_REGIONS = {
    entry: 'ui:main_content',
    project: 'ui:screen_header',
    play_surface: 'ui:workspace_hand',
    workspace_layout: 'ui:layout_frame',
    sidebar_status: 'ui:sidebar_status',
    election_results: 'ui:election_results_chart'
  };

  function bind(host, actions) {
    const element = host || null;
    const callbacks = actions || {};
    if (!element) {
      return;
    }
    element.querySelectorAll('[data-system-ui-fixture]').forEach((button) => {
      button.addEventListener('click', () => callbacks.onFixture && callbacks.onFixture(button.dataset.systemUiFixture || 'default'));
    });
    element.querySelectorAll('[data-system-ui-template]').forEach((button) => {
      button.addEventListener('click', () => callbacks.onTemplate && callbacks.onTemplate(button.dataset.systemUiTemplate || 'entry'));
    });
    element.querySelectorAll('[data-system-player-flow-control][data-system-player-flow-screen]').forEach((button) => {
      button.addEventListener('click', () => callbacks.onPlayerFlowScreen && callbacks.onPlayerFlowScreen(button.dataset.systemPlayerFlowScreen || 'entry_menu'));
    });
  }

  function switchForRegion(state, nodeKey, deps) {
    if (!isSystemUiState(state, deps)) {
      return false;
    }
    const nextTemplate = deps.templateForRegion(nodeKey);
    if (!nextTemplate || nextTemplate === state.template) {
      return false;
    }
    applyTemplate(state, nextTemplate, nodeKey, 'System UI region', deps);
    return true;
  }

  function switchTemplate(state, template, deps) {
    const nextTemplate = deps.normalizeTemplate(template);
    if (!nextTemplate || deps.workspaceForTemplate(nextTemplate) !== 'system_ui' || state.template === nextTemplate && state.mode === nextTemplate) {
      return;
    }
    applyTemplate(state, nextTemplate, defaultRegionForTemplate(nextTemplate), 'System UI recipe', deps);
  }

  function setFixture(state, fixture, deps) {
    state.systemUiFixture = normalizeFixture(fixture);
    rebuild(state, deps);
    deps.render();
  }

  function draftWithContext(state, draft, workspaceForTemplate) {
    if (!draft || typeof draft !== 'object' || (state.workspace || workspaceForTemplate(state.template || '')) !== 'system_ui') {
      return draft;
    }
    return Object.assign({}, draft, {
      studioAuthoringContext: {
        workspace: 'system_ui',
        selectedRegion: state.selectedCanvasNode,
        fixture: state.systemUiFixture,
        playerFlowScreen: state.systemUiPlayerFlowScreen || '',
        template: state.template || ''
      }
    });
  }

  function restoreContext(state, context, deps) {
    const value = context && typeof context === 'object' ? context : {};
    if (value.workspace !== 'system_ui') {
      return;
    }
    state.workspace = 'system_ui';
    state.systemUiFixture = normalizeFixture(value.fixture);
    state.systemUiPlayerFlowScreen = normalizePlayerFlowScreen(value.playerFlowScreen);
    state.selectedCanvasNode = String(value.selectedRegion || '').trim() || defaultRegionForTemplate(state.template || '');
    rebuild(state, deps);
    deps.render();
  }

  function applyTemplate(state, nextTemplate, nodeKey, source, deps) {
    state.values = deps.collectValues();
    state.template = nextTemplate;
    state.mode = nextTemplate;
    state.view = nextTemplate;
    state.workspace = 'system_ui';
    state.baseDraft = deps.defaultDraftForTemplate(nextTemplate);
    state.selectedCanvasNode = nodeKey;
    state.model = deps.buildTemplateModel({values: state.values, entry: {source}});
    state.status = deps.t('objectCanvas.status.systemUiRegion', 'Opened the matching System UI draft for this region.');
    deps.showWorkspace(nextTemplate);
    deps.render();
  }

  function setPlayerFlowScreen(state, screen, deps) {
    const next = normalizePlayerFlowScreen(screen);
    if (!next) {
      return;
    }
    state.systemUiPlayerFlowScreen = next;
    if (next === 'entry_menu' && state.template !== 'entry') {
      applyTemplate(state, 'entry', defaultRegionForTemplate('entry'), 'Player screen', deps);
      return;
    }
    if (next === 'in_game' && !['play_surface', 'workspace_layout', 'sidebar_status'].includes(state.template)) {
      applyTemplate(state, 'play_surface', defaultRegionForTemplate('play_surface'), 'Player screen', deps);
      return;
    }
    if (next === 'library_page' && state.template !== 'project') {
      applyTemplate(state, 'project', defaultRegionForTemplate('project'), 'Player screen', deps);
      state.systemUiPlayerFlowScreen = next;
      return;
    }
    rebuild(state, deps);
    deps.render();
  }

  function rebuild(state, deps) {
    state.values = deps.collectValues();
    state.model = state.mode === 'existing' ? deps.buildExistingModel({values: state.values}) : deps.buildTemplateModel({values: state.values, entry: deps.entry || {source: 'System UI'}});
  }

  function isSystemUiState(state, deps) {
    return state.mode !== 'existing' && deps.workspaceForTemplate(state.template || '') === 'system_ui';
  }

  function defaultRegionForTemplate(template) {
    return DEFAULT_REGIONS[template] || 'ui:main_content';
  }

  function normalizeFixture(fixture) {
    const api = global.ProjectMapSystemUiFixtureState;
    return api && typeof api.normalizeFixture === 'function'
      ? api.normalizeFixture(fixture)
      : String(fixture || '') === 'busy' ? 'changed' : 'default';
  }

  function normalizePlayerFlowScreen(value) {
    const text = String(value || '').trim();
    return ['entry_menu', 'library_page', 'in_game'].includes(text) ? text : '';
  }

  const api = {bind, defaultRegionForTemplate, draftWithContext, restoreContext, setFixture, setPlayerFlowScreen, switchForRegion, switchTemplate};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSystemUiWorkspaceState = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
