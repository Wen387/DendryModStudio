(function initProjectMapAuthoringWorkspace(global) {
  'use strict';

  const TEMPLATE_WORKSPACES = {
    event: 'content',
    news: 'content',
    card: 'content',
    surface: 'content',
    existing: 'content',
    entry: 'system_ui',
    play_surface: 'system_ui',
    workspace_layout: 'system_ui',
    sidebar_status: 'system_ui',
    election_results: 'system_ui',
    project: 'system_ui',
    variables: 'project_state'
  };

  const DEFAULT_TEMPLATES = {
    content: 'event',
    system_ui: 'entry',
    project_state: 'variables'
  };

  const WORKSPACE_ITEMS = [
    {key: 'content', labelKey: 'authoring.workspace.content', fallback: 'Content Authoring'},
    {key: 'system_ui', labelKey: 'authoring.workspace.systemUi', fallback: 'System UI Authoring'},
    {key: 'project_state', labelKey: 'authoring.workspace.projectState', fallback: 'Project State'}
  ];

  const TEMPLATE_ITEMS = {
    content: [
      {key: 'event', labelKey: 'create.worldEvent', fallback: 'World Event'},
      {key: 'news', labelKey: 'create.news', fallback: 'News'},
      {key: 'card', labelKey: 'create.card', fallback: 'Card'}
    ],
    system_ui: [
      {key: 'entry', labelKey: 'create.entrySidebar', fallback: 'Entry & Sidebar'},
      {key: 'play_surface', labelKey: 'create.playSurface', fallback: 'Playable Surface'},
      {key: 'workspace_layout', labelKey: 'create.workspaceLayout', fallback: 'Workspace Layout'},
      {key: 'sidebar_status', labelKey: 'create.sidebarStatus', fallback: 'Sidebar / Status'},
      {key: 'election_results', labelKey: 'create.electionResults', fallback: 'Election Results'},
      {key: 'project', labelKey: 'create.gameInfo', fallback: 'Game Info'}
    ],
    project_state: [
      {key: 'variables', labelKey: 'create.variables', fallback: 'Variables'}
    ]
  };

  const state = {
    activeWorkspace: 'content',
    activeTemplate: 'event'
  };

  let elements = null;

  const api = {
    setWorkspace,
    setTemplate,
    workspaceForTemplate,
    surfaceForTemplate,
    activeWorkspace: () => state.activeWorkspace,
    activeTemplate: () => state.activeTemplate
  };

  global.ProjectMapAuthoringWorkspace = api;

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
    const nav = document.querySelector('[data-authoring-workspace-nav]');
    if (nav && !nav.querySelector('[data-authoring-workspace]')) {
      nav.innerHTML = renderWorkspaceNav();
    }
    elements = {
      workspaceButtons: Array.from(document.querySelectorAll('[data-authoring-workspace]')),
      templateGroups: Array.from(document.querySelectorAll('[data-authoring-template-group]')),
      templateButtons: Array.from(document.querySelectorAll('[data-create-template]'))
    };
    if (!elements.workspaceButtons.length || !elements.templateGroups.length) {
      return;
    }
    bindWorkspaceButtons();
    bindTemplateButtons(document);
    bindTemplateEvents(document);
    setTemplate(activeTemplateFromDom() || 'event', {silent: true});
  }

  function bindWorkspaceButtons() {
    elements.workspaceButtons.forEach((button) => {
      button.addEventListener('click', () => {
        setWorkspace(button.dataset.authoringWorkspace || 'content');
      });
    });
  }

  function bindTemplateButtons(document) {
    document.addEventListener('click', (event) => {
      const button = event.target.closest && event.target.closest('[data-create-template]');
      if (!button) {
        return;
      }
      const template = normalizeTemplate(button.dataset.createTemplate) || button.dataset.createTemplate || '';
      if (!template) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      state.activeTemplate = template;
      state.activeWorkspace = workspaceForTemplate(template);
      render();
      document.dispatchEvent(new CustomEvent('ProjectMap:create-template-changed', {
        detail: {template, source: 'authoring-workspace'}
      }));
    }, true);
  }

  function bindTemplateEvents(document) {
    document.addEventListener('ProjectMap:create-template-changed', (event) => {
      const template = event && event.detail && event.detail.template;
      if (template) {
        setTemplate(template, {silent: true});
      }
    });
  }

  function setWorkspace(workspace, options) {
    const next = normalizeWorkspace(workspace);
    const currentTemplateWorkspace = workspaceForTemplate(state.activeTemplate);
    const shouldOpenDefault = currentTemplateWorkspace !== next && !(options && options.keepTemplate);
    state.activeWorkspace = next;
    render();
    if (shouldOpenDefault && !(options && options.silent)) {
      clickTemplate(defaultTemplateForWorkspace(next));
    }
  }

  function setTemplate(template, options) {
    const nextTemplate = normalizeTemplate(template) || 'event';
    state.activeTemplate = nextTemplate;
    state.activeWorkspace = workspaceForTemplate(nextTemplate);
    render();
    if (!(options && options.silent)) {
      clickTemplate(nextTemplate);
    }
  }

  function render() {
    if (!elements) {
      return;
    }
    elements.workspaceButtons.forEach((button) => {
      const active = button.dataset.authoringWorkspace === state.activeWorkspace;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    elements.templateGroups.forEach((group) => {
      const active = group.dataset.authoringTemplateGroup === state.activeWorkspace;
      group.classList.toggle('is-active', active);
      group.hidden = !active;
    });
    elements.templateButtons.forEach((button) => {
      const active = templateButtonIsActive(button.dataset.createTemplate, state.activeTemplate);
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function templateButtonIsActive(buttonTemplate, activeTemplate) {
    return buttonTemplate === activeTemplate;
  }

  function clickTemplate(template) {
    const button = elements && elements.templateButtons.find((candidate) => candidate.dataset.createTemplate === template);
    if (button && typeof button.click === 'function') {
      button.click();
    }
  }

  function renderWorkspaceNav() {
    return [
      '<div class="authoring-workspace-switch" role="tablist" aria-label="Authoring workspace" data-i18n-aria-label="authoring.workspaceAria">',
      workspaceItems().map(renderWorkspaceButton).join(''),
      '</div>',
      '<div class="authoring-template-palette" data-authoring-template-palette="true">',
      workspaceItems().map((workspace) => renderTemplateGroup(workspace.key)).join(''),
      '</div>'
    ].join('');
  }

  function renderWorkspaceButton(item, index) {
    const active = index === 0;
    return '<button class="authoring-workspace-button' + (active ? ' is-active' : '') + '" type="button" role="tab" aria-selected="' + (active ? 'true' : 'false') + '" data-authoring-workspace="' + item.key + '">' +
      iconHtml(iconForWorkspace(item.key)) +
      '<span data-i18n="' + item.labelKey + '">' + item.fallback + '</span>' +
      '</button>';
  }

  function renderTemplateGroup(workspace) {
    const active = workspace === 'content';
    const items = workspaceItems();
    const item = items.find((candidate) => candidate.key === workspace) || items[0];
    return [
      '<div class="template-switch authoring-template-group' + (active ? ' is-active' : '') + '" role="group" aria-label="' + item.fallback + '" data-i18n-aria-label="' + item.labelKey + '" data-authoring-template-group="' + workspace + '"' + (active ? '' : ' hidden') + '>',
      templateItemsForWorkspace(workspace).map((template, index) => renderTemplateButton(template, active && index === 0)).join(''),
      '</div>'
    ].join('');
  }

  function renderTemplateButton(item, active) {
    return '<button class="template-button' + (active ? ' is-active' : '') + '" type="button" role="tab" aria-selected="' + (active ? 'true' : 'false') + '" data-create-template="' + item.key + '">' +
      iconHtml(iconForTemplate(item.key)) +
      '<span data-i18n="' + item.labelKey + '">' + item.fallback + '</span>' +
      '</button>';
  }

  function iconHtml(name) {
    const icons = global.ProjectMapIcons;
    return icons && typeof icons.icon === 'function' ? icons.icon(name) : '';
  }

  function iconForWorkspace(workspace) {
    if (workspace === 'system_ui') {
      return 'settings';
    }
    if (workspace === 'project_state') {
      return 'check';
    }
    return 'edit';
  }

  function iconForTemplate(template) {
    const icons = {
      event: 'play',
      news: 'book',
      card: 'card',
      surface: 'text',
      existing: 'edit',
      entry: 'map',
      play_surface: 'play',
      workspace_layout: 'map',
      sidebar_status: 'text',
      election_results: 'check',
      project: 'settings',
      variables: 'settings'
    };
    return icons[template] || 'plus';
  }

  function activeTemplateFromDom() {
    const active = global.document.querySelector('[data-create-template].is-active');
    return active && active.dataset.createTemplate || '';
  }

  function workspaceForTemplate(template) {
    const registry = registryApi();
    if (registry && typeof registry.workspaceForTemplate === 'function') {
      return registry.workspaceForTemplate(template);
    }
    return TEMPLATE_WORKSPACES[normalizeTemplate(template)] || 'content';
  }

  function surfaceForTemplate(template) {
    const registry = registryApi();
    return registry && typeof registry.surfaceForTemplate === 'function'
      ? registry.surfaceForTemplate(template)
      : null;
  }

  function normalizeTemplate(template) {
    const registry = registryApi();
    if (registry && typeof registry.normalizeTemplate === 'function') {
      return registry.normalizeTemplate(template);
    }
    return String(template || '').trim();
  }

  function normalizeWorkspace(workspace) {
    const registry = registryApi();
    if (registry && typeof registry.normalizeWorkspace === 'function') {
      return registry.normalizeWorkspace(workspace);
    }
    const value = String(workspace || '').trim();
    return DEFAULT_TEMPLATES[value] ? value : 'content';
  }

  function defaultTemplateForWorkspace(workspace) {
    const registry = registryApi();
    if (registry && typeof registry.defaultTemplateForWorkspace === 'function') {
      return registry.defaultTemplateForWorkspace(workspace);
    }
    return DEFAULT_TEMPLATES[workspace] || 'event';
  }

  function workspaceItems() {
    const registry = registryApi();
    return registry && typeof registry.workspaces === 'function' ? registry.workspaces() : WORKSPACE_ITEMS;
  }

  function templateItemsForWorkspace(workspace) {
    const registry = registryApi();
    return registry && typeof registry.templatesForWorkspace === 'function'
      ? registry.templatesForWorkspace(workspace)
      : TEMPLATE_ITEMS[workspace] || [];
  }

  function registryApi() {
    return global.ProjectMapAuthoringSurfaceRegistry || null;
  }
})(typeof window !== 'undefined' ? window : globalThis);
