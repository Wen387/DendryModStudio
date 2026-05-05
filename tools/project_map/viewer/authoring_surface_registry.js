(function initProjectMapAuthoringSurfaceRegistry(global) {
  'use strict';

  const WORKSPACES = [
    {key: 'content', labelKey: 'authoring.workspace.content', fallback: 'Content Authoring', defaultTemplate: 'event'},
    {key: 'system_ui', labelKey: 'authoring.workspace.systemUi', fallback: 'System UI Authoring', defaultTemplate: 'entry'},
    {key: 'project_state', labelKey: 'authoring.workspace.projectState', fallback: 'Project State', defaultTemplate: 'variables'}
  ];

  const SURFACES = [
    {
      key: 'content_storyboard',
      workspace: 'content',
      labelKey: 'authoring.surface.contentStoryboard',
      fallback: 'Content Storyboard',
      templates: ['event', 'news', 'card', 'surface', 'existing']
    },
    {
      key: 'system_ui_preview',
      workspace: 'system_ui',
      labelKey: 'authoring.surface.systemUiPreview',
      fallback: 'System UI Live Preview',
      templates: ['entry', 'play_surface', 'workspace_layout', 'sidebar_status']
    },
    {
      key: 'project_state_board',
      workspace: 'project_state',
      labelKey: 'authoring.surface.projectStateBoard',
      fallback: 'Project State Board',
      templates: ['variables', 'project']
    }
  ];

  const TEMPLATES = [
    {key: 'event', workspace: 'content', surface: 'content_storyboard', labelKey: 'create.worldEvent', fallback: 'World Event'},
    {key: 'news', workspace: 'content', surface: 'content_storyboard', labelKey: 'create.news', fallback: 'News'},
    {key: 'card', workspace: 'content', surface: 'content_storyboard', labelKey: 'create.card', fallback: 'Card'},
    {key: 'surface', workspace: 'content', surface: 'content_storyboard', labelKey: 'create.editText', fallback: 'Edit Text'},
    {key: 'existing', workspace: 'content', surface: 'content_storyboard', labelKey: 'objectCanvas.mode.existing', fallback: 'Existing Object'},
    {key: 'entry', workspace: 'system_ui', surface: 'system_ui_preview', labelKey: 'create.entrySidebar', fallback: 'Entry & Sidebar'},
    {key: 'play_surface', workspace: 'system_ui', surface: 'system_ui_preview', labelKey: 'create.playSurface', fallback: 'Playable Surface'},
    {key: 'workspace_layout', workspace: 'system_ui', surface: 'system_ui_preview', labelKey: 'create.workspaceLayout', fallback: 'Workspace Layout'},
    {key: 'sidebar_status', workspace: 'system_ui', surface: 'system_ui_preview', labelKey: 'create.sidebarStatus', fallback: 'Sidebar / Status'},
    {key: 'variables', workspace: 'project_state', surface: 'project_state_board', labelKey: 'create.variables', fallback: 'Variables'},
    {key: 'project', workspace: 'project_state', surface: 'project_state_board', labelKey: 'create.gameInfo', fallback: 'Game Info'}
  ];

  const templatesByKey = indexBy(TEMPLATES, 'key');
  const workspacesByKey = indexBy(WORKSPACES, 'key');
  const surfacesByKey = indexBy(SURFACES, 'key');

  function templateDefinition(template) {
    return templatesByKey[normalizeTemplate(template)] || null;
  }

  function surfaceForTemplate(template) {
    const def = templateDefinition(template) || templatesByKey.event;
    return surfacesByKey[def.surface] || surfacesByKey.content_storyboard;
  }

  function workspaceForTemplate(template) {
    const def = templateDefinition(template);
    return def ? def.workspace : 'content';
  }

  function defaultTemplateForWorkspace(workspace) {
    const def = workspacesByKey[normalizeWorkspace(workspace)] || workspacesByKey.content;
    return def.defaultTemplate;
  }

  function templatesForWorkspace(workspace) {
    const key = normalizeWorkspace(workspace);
    return TEMPLATES.filter((item) => item.workspace === key && item.key !== 'existing').map(clone);
  }

  function workspaces() {
    return WORKSPACES.map(clone);
  }

  function surfaces() {
    return SURFACES.map(clone);
  }

  function isTemplateSupported(template) {
    return Boolean(templateDefinition(template));
  }

  function normalizeTemplate(template) {
    const text = String(template || '').trim();
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
    if (text === 'variable_editor' || text === 'variable') {
      return 'variables';
    }
    return templatesByKey[text] ? text : '';
  }

  function normalizeWorkspace(workspace) {
    const text = String(workspace || '').trim();
    return workspacesByKey[text] ? text : 'content';
  }

  function surfaceLabel(surface, t) {
    const def = typeof surface === 'string' ? surfacesByKey[surface] : surface;
    if (!def) {
      return '';
    }
    return typeof t === 'function' ? t(def.labelKey, def.fallback) : def.fallback;
  }

  function indexBy(items, key) {
    const byKey = {};
    items.forEach((item) => {
      byKey[item[key]] = item;
    });
    return byKey;
  }

  function clone(value) {
    return Object.assign({}, value);
  }

  const api = {
    workspaces,
    surfaces,
    templatesForWorkspace,
    templateDefinition,
    surfaceForTemplate,
    surfaceLabel,
    workspaceForTemplate,
    defaultTemplateForWorkspace,
    isTemplateSupported,
    normalizeTemplate,
    normalizeWorkspace
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapAuthoringSurfaceRegistry = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
