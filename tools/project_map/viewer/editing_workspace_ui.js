(function initProjectMapEditingWorkspace(global) {
  'use strict';

  const EVENT_NAMES = [
    'project-map:index-loaded',
    'ProjectMap:index-loaded',
    'projectmap:index-loaded',
    'ProjectMapIndexLoaded',
    'project-map:model-loaded'
  ];

  const state = {
    active: false,
    projectIndex: null,
    view: '',
    item: null,
    context: null,
    status: ''
  };

  let elements = null;
  let graphRenderer = null;
  let panelRenderer = null;

  const api = {
    openFromSelection,
    loadDraft,
    refresh,
    getDraft: () => state.context && state.context.proposal,
    getOutput: () => state.context && state.context.output,
    isActive: () => state.active,
    setProjectIndex
  };

  global.ProjectMapEditingWorkspace = api;

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
    elements = {
      host: document.getElementById('existing-scene-editor-host'),
      templateButtons: Array.from(document.querySelectorAll('[data-create-template]')),
      templatePanels: Array.from(document.querySelectorAll('[data-create-template-panel]'))
    };
    if (!elements.host) {
      return;
    }
    graphRenderer = graphFactory()({t, escapeHtml});
    panelRenderer = panelFactory()({t, escapeHtml, escapeAttr});
    bindIndexEvents();
    document.addEventListener('ProjectMap:create-template-changed', (event) => {
      const template = event && event.detail && event.detail.template;
      if (template && template !== 'existing') {
        deactivate();
      }
    });
  }

  function bindIndexEvents() {
    EVENT_NAMES.forEach((name) => {
      global.document.addEventListener(name, (event) => {
        const detail = event && event.detail || {};
        setProjectIndex(detail.index || detail.projectIndex || detail.model && detail.model.index || null);
      });
    });
  }

  function setProjectIndex(index) {
    if (index && typeof index === 'object') {
      state.projectIndex = index;
    }
  }

  function openFromSelection(projectIndex, view, item) {
    if (projectIndex) {
      state.projectIndex = projectIndex;
    }
    state.view = view || '';
    state.item = item || null;
    state.context = buildContext({});
    state.active = true;
    state.status = state.context && state.context.ok
      ? t('editing.status.loaded', 'Contextual Editing loaded.')
      : t('existingScene.openFailed', 'This scene needs more source evidence before Studio can edit it here.');
    showWorkspace();
    render();
    return Boolean(state.context && state.context.ok);
  }

  function loadDraft(draft) {
    const modelApi = contextApi();
    if (!modelApi || typeof modelApi.buildContextFromProposal !== 'function') {
      return false;
    }
    state.view = draft && draft.sceneKind === 'card' ? 'cards' : 'events';
    state.item = draft && draft.sceneId || '';
    state.context = modelApi.buildContextFromProposal(state.projectIndex, draft || {});
    state.active = true;
    state.status = state.context && state.context.ok
      ? t('editing.status.loadedDraft', 'Saved existing edit loaded in Contextual Editing.')
      : t('existingScene.openFailed', 'This scene needs more source evidence before Studio can edit it here.');
    showWorkspace();
    render();
    return Boolean(state.context && state.context.ok);
  }

  function refresh() {
    if (!state.active) {
      return;
    }
    const values = collectValues();
    state.context = buildContext(values);
    updateDynamicSurfaces();
  }

  function buildContext(values) {
    const modelApi = contextApi();
    if (!modelApi || typeof modelApi.buildContextModel !== 'function') {
      return null;
    }
    return modelApi.buildContextModel(state.projectIndex, state.view, state.item, {values});
  }

  function showWorkspace() {
    activateCreateMode();
    if (!elements || !elements.host) {
      return;
    }
    elements.templateButtons.forEach((button) => {
      button.classList.remove('is-active');
      button.setAttribute('aria-selected', 'false');
    });
    elements.templatePanels.forEach((panel) => {
      panel.classList.add('hidden');
    });
    elements.host.hidden = false;
    elements.host.classList.remove('hidden');
    global.document.dispatchEvent(new CustomEvent('ProjectMap:create-template-changed', {
      detail: {template: 'existing'}
    }));
  }

  function deactivate() {
    state.active = false;
    if (elements && elements.host) {
      elements.host.hidden = true;
      elements.host.classList.add('hidden');
    }
  }

  function activateCreateMode() {
    const create = global.document.querySelector('[data-mode="create"]');
    if (create && typeof create.click === 'function') {
      create.click();
    }
  }

  function render() {
    if (!elements || !elements.host) {
      return;
    }
    if (!state.active) {
      elements.host.hidden = true;
      return;
    }
    const context = state.context || {};
    elements.host.innerHTML = [
      '<section class="editing-workspace" data-editing-workspace="true">',
      renderHeader(context),
      context.ok ? renderWorkspaceBody(context) : renderUnavailable(context),
      '</section>'
    ].join('');
    bindWorkspaceEvents();
    updateDynamicSurfaces();
  }

  function renderHeader(context) {
    const source = context.source || {};
    const kind = context.sceneKind === 'card'
      ? t('existingScene.kind.card', 'Card')
      : t('existingScene.kind.event', 'Event');
    return [
      '<header class="editing-workspace-header">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('editing.eyebrow', 'Contextual Editing')) + '</div>',
      '<h2>' + escapeHtml(context.title || context.sceneId || t('existingScene.titleFallback', 'Existing scene edit')) + '</h2>',
      '<p>' + escapeHtml(t('editing.body', 'Edit source-backed fields while keeping flow, source evidence, variables, and install impact visible.')) + '</p>',
      '<div class="editing-status-line" data-editing-status="true">' + escapeHtml(state.status || '') + '</div>',
      '</div>',
      '<dl class="editing-meta">',
      '<dt>' + escapeHtml(t('existingScene.kind', 'Kind')) + '</dt><dd>' + escapeHtml(kind) + '</dd>',
      '<dt>' + escapeHtml(t('existingScene.sceneId', 'Scene')) + '</dt><dd>' + escapeHtml(context.sceneId || '') + '</dd>',
      '<dt>' + escapeHtml(t('existingScene.source', 'Source')) + '</dt><dd>' + escapeHtml(source.path ? source.path + (source.line ? ':' + source.line : '') : '') + '</dd>',
      '</dl>',
      '</header>'
    ].join('');
  }

  function renderWorkspaceBody(context) {
    return [
      '<div class="editing-workspace-layout">',
      '<div class="editing-main-column">',
      graphRenderer.renderContextGraph(context),
      panelRenderer.renderFieldPanels(context),
      '</div>',
      '<aside class="editing-side-column">',
      renderOperationSummary(context),
      renderPreview(context),
      panelRenderer.renderContextPanels(context),
      renderActions(),
      '</aside>',
      '</div>'
    ].join('');
  }

  function renderUnavailable(context) {
    const diagnostics = (context.diagnostics || []).map((diag) => {
      return '<p class="editing-readonly-line">' + escapeHtml((diag.code || 'diagnostic') + ': ' + (diag.message || '')) + '</p>';
    }).join('');
    return [
      '<section class="editing-panel" open>',
      '<div class="editing-empty">' + escapeHtml(t('editing.unavailable', 'Contextual Editing cannot open this selection.')) + '</div>',
      diagnostics,
      '</section>'
    ].join('');
  }

  function renderOperationSummary(context) {
    const summary = context.operationSummary || {};
    const editability = context.editabilitySummary || {};
    return [
      '<section class="editing-summary" data-editing-operation-summary="true">',
      '<h3>' + escapeHtml(t('editing.summaryTitle', 'Edit impact')) + '</h3>',
      '<div class="editing-summary-grid">',
      summaryBox(t('editing.summary.guarded', 'Guarded'), summary.guardedApply),
      summaryBox(t('editing.summary.manual', 'Manual'), summary.manualReview),
      summaryBox(t('editing.summary.refused', 'Refused'), summary.refused),
      summaryBox(t('editing.summary.fields', 'Fields'), editability.total),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderPreview(context) {
    const output = context.output || {};
    return [
      '<section class="editing-preview">',
      '<div class="preview-heading">' + escapeHtml(t('existingScene.proposalPreview', 'Proposal preview')) + '</div>',
      '<pre class="code-preview" data-editing-preview="true">' + escapeHtml(output.proposalText || output.previewText || '') + '</pre>',
      '</section>'
    ].join('');
  }

  function renderActions() {
    return [
      '<div class="editing-actions">',
      '<button type="button" data-editing-action="refresh">' + escapeHtml(t('existingScene.refresh', 'Refresh proposal')) + '</button>',
      '<button type="button" data-editing-action="save">' + escapeHtml(t('editing.saveToChanges', 'Save to My Changes')) + '</button>',
      '<button class="primary-action" type="button" data-editing-action="review">' + escapeHtml(t('existingScene.review', 'Review & Apply')) + '</button>',
      '</div>'
    ].join('');
  }

  function summaryBox(label, value) {
    return [
      '<div class="editing-summary-box">',
      '<strong>' + escapeHtml(String(Number(value || 0))) + '</strong>',
      '<span>' + escapeHtml(label) + '</span>',
      '</div>'
    ].join('');
  }

  function bindWorkspaceEvents() {
    if (!elements || !elements.host) {
      return;
    }
    elements.host.querySelectorAll('[data-editing-field]').forEach((input) => {
      input.addEventListener('input', refresh);
    });
    elements.host.querySelectorAll('[data-editing-action]').forEach((button) => {
      button.addEventListener('click', () => handleAction(button.dataset.editingAction || ''));
    });
  }

  function handleAction(action) {
    if (action === 'refresh') {
      refresh();
      state.status = t('editing.status.refreshed', 'Contextual Editing proposal refreshed.');
      updateDynamicSurfaces();
    } else if (action === 'save') {
      refresh();
      const save = global.document.getElementById('draft-workspace-save');
      if (save && typeof save.click === 'function') {
        save.click();
        state.status = t('editing.status.saved', 'Sent to My Changes.');
      }
      updateDynamicSurfaces();
    } else if (action === 'review') {
      reviewCurrentPlan();
    }
  }

  function reviewCurrentPlan() {
    refresh();
    const output = state.context && state.context.output;
    if (!output || !output.installPlan) {
      return;
    }
    const assistant = global.ProjectMapInstallAssistant;
    if (assistant && typeof assistant.loadPlan === 'function') {
      assistant.loadPlan(output.installPlan, {fileName: (state.context.proposal && state.context.proposal.id || 'existing_scene_edit') + '.install-plan.json'});
      const installButton = global.document.querySelector('[data-mode="install"]');
      if (installButton && typeof installButton.click === 'function') {
        installButton.click();
      }
    }
  }

  function collectValues() {
    const values = {};
    if (!elements || !elements.host) {
      return values;
    }
    elements.host.querySelectorAll('[data-editing-field]').forEach((input) => {
      values[input.dataset.editingField] = input.value;
    });
    return values;
  }

  function updateDynamicSurfaces() {
    if (!elements || !elements.host || !state.context) {
      return;
    }
    const preview = elements.host.querySelector('[data-editing-preview]');
    if (preview) {
      const output = state.context.output || {};
      preview.textContent = output.proposalText || output.previewText || '';
    }
    const summary = elements.host.querySelector('[data-editing-operation-summary]');
    if (summary) {
      summary.outerHTML = renderOperationSummary(state.context);
    }
    const status = elements.host.querySelector('[data-editing-status]');
    if (status) {
      status.textContent = state.status || '';
    }
  }

  function contextApi() {
    return global.ProjectMapEditingContextModel || null;
  }

  function graphFactory() {
    return global.ProjectMapEditingContextGraph || function fallbackGraphFactory() {
      return {renderContextGraph: () => ''};
    };
  }

  function panelFactory() {
    return global.ProjectMapEditingFieldPanels || function fallbackPanelFactory() {
      return {renderFieldPanels: () => '', renderContextPanels: () => ''};
    };
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }
})(typeof window !== 'undefined' ? window : globalThis);
