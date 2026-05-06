(function initProjectMapObjectAuthoringCanvas(global) {
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
    mode: 'new_event',
    template: 'event',
    projectIndex: null,
    view: '',
    item: null,
    workspace: 'content',
    selectedCanvasNode: 'object',
    storyboardView: 'timeline',
    storyScopeMode: 'focus',
    storyScopeWindow: '',
    storyChainDepth: '1',
    cardBoardSelectedKey: '',
    cardBoardLane: 'pool',
    cardBoardQuery: '',
    cardBoardType: 'all',
    cardBoardDropContext: null,
    systemUiFixture: 'default',
    canvasZoom: 1,
    canvasPanX: 0,
    canvasPanY: 0,
    nodePositions: {},
    draftBranches: [],
    editorOverlay: false,
    baseDraft: null,
    values: {},
    model: null,
    status: ''
  };

  let elements = null;

  const api = {
    openFromSelection,
    openTemplate,
    openNewEvent,
    loadDraft,
    refresh,
    getDraft: draftWithAuthoringContext,
    getOutput: () => state.model && state.model.changeState && state.model.changeState.output,
    isActive: () => state.active,
    activeTemplate: () => state.mode === 'existing' ? 'existing' : state.template || 'event',
    activeWorkspace: () => state.workspace || workspaceForTemplate(state.template || 'event'),
    activeSurface: () => currentSurface().key,
    selectCanvasNode,
    setStoryboardView,
    zoomCanvas: handleCanvasZoom,
    moveCanvasNode,
    panCanvas,
    createRelatedDraft,
    toggleEditorOverlay,
    setProjectIndex
  };

  global.ProjectMapObjectAuthoringCanvas = api;
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
    bindIndexEvents();
    bindTemplateEvents(document);
  }

  function bindIndexEvents() {
    EVENT_NAMES.forEach((name) => {
      global.document.addEventListener(name, (event) => {
        const detail = event && event.detail || {};
        setProjectIndex(detail.index || detail.projectIndex || detail.model && detail.model.index || null);
      });
    });
  }

  function bindTemplateEvents(document) {
    document.addEventListener('ProjectMap:create-template-changed', (event) => {
      const template = event && event.detail && event.detail.template;
      if (isCanvasTemplate(template)) {
        openTemplateFromCreate(template);
      } else if (template && template !== 'existing' && template !== 'object_canvas') {
        deactivate();
      }
    });
    document.addEventListener('click', (event) => {
      const modeButton = event.target.closest && event.target.closest('[data-mode="create"]');
      if (modeButton) {
        schedule(() => {
          const active = document.querySelector('[data-create-template].is-active');
          if (active && isCanvasTemplate(active.dataset.createTemplate) && !(state.active && workspaceForTemplate(state.template) === 'system_ui' && workspaceForTemplate(active.dataset.createTemplate) === 'system_ui')) {
            openTemplateFromCreate(active.dataset.createTemplate);
          }
        });
      }
    });
  }

  function setProjectIndex(index) {
    if (index && typeof index === 'object') {
      state.projectIndex = index;
      if (state.active) {
        refresh();
      }
    }
  }

  function resetStoryboardState() {
    const api = storyboardWorkspaceApi(); if (api && typeof api.reset === 'function') { api.reset(state); }
  }

  function resetCardBoardState() {
    const api = cardWorkspaceApi(); if (api && typeof api.reset === 'function') { api.reset(state); }
  }

  function openFromSelection(projectIndex, view, item, options) {
    if (projectIndex) {
      state.projectIndex = projectIndex;
    }
    state.mode = 'existing';
    state.template = 'existing';
    state.view = view || '';
    state.item = item || null;
    state.workspace = 'content';
    state.selectedCanvasNode = 'object';
    resetStoryboardState();
    resetCardBoardState();
    if (view === 'cards' && item) {
      state.cardBoardSelectedKey = 'card:' + item;
      state.selectedCanvasNode = state.cardBoardSelectedKey;
    }
    state.systemUiFixture = 'default';
    state.canvasPanX = 0;
    state.canvasPanY = 0;
    state.nodePositions = {};
    state.draftBranches = [];
    state.editorOverlay = false;
    state.baseDraft = null;
    state.values = options && options.values || {};
    state.model = buildExistingModel(options || {});
    state.active = true;
    state.status = state.model && state.model.ok
      ? t('objectCanvas.status.existingLoaded', 'Object Canvas opened for this existing object.')
      : t('existingScene.openFailed', 'This scene needs more source evidence before Studio can edit it here.');
    showWorkspace(view === 'cards' ? 'card' : 'existing');
    render();
    return Boolean(state.model && state.model.ok);
  }

  function openNewEvent(draft, meta) {
    return openTemplate('event', draft, meta);
  }

  function openTemplate(template, draft, meta) {
    const nextTemplate = normalizeTemplate(template) || templateFromDraft(draft) || 'event';
    state.template = nextTemplate;
    state.mode = nextTemplate === 'event' ? 'new_event' : nextTemplate;
    state.view = nextTemplate;
    state.item = null;
    state.workspace = workspaceForTemplate(nextTemplate);
    state.selectedCanvasNode = 'object';
    resetStoryboardState();
    resetCardBoardState();
    state.systemUiFixture = 'default';
    state.canvasPanX = 0;
    state.canvasPanY = 0;
    state.nodePositions = {};
    state.draftBranches = [];
    state.editorOverlay = false;
    state.baseDraft = draft || safeDefaultDraftForTemplate(nextTemplate);
    if (nextTemplate === 'card') {
      state.cardBoardSelectedKey = 'draft:card:' + (state.baseDraft && state.baseDraft.id || 'new_action_card');
      state.selectedCanvasNode = state.cardBoardSelectedKey;
    }
    state.values = {};
    state.model = buildTemplateModel(meta || {});
    state.active = true;
    state.status = statusForTemplate(nextTemplate, meta);
    showWorkspace(nextTemplate);
    render();
    return Boolean(state.model && state.model.ok);
  }

  function openTemplateFromCreate(template) {
    const nextTemplate = normalizeTemplate(template) || 'event';
    if (isCurrentTemplateRendered(nextTemplate)) {
      return;
    }
    openTemplate(nextTemplate, safeDefaultDraftForTemplate(nextTemplate), {source: 'Create'});
  }

  function isCurrentTemplateRendered(template) {
    if (!state.active || state.mode === 'existing' || state.template !== template || !state.model) {
      return false;
    }
    const modelTemplate = state.model.template || (state.model.mode === 'new_event' ? 'event' : state.model.mode);
    if (modelTemplate !== template) {
      return false;
    }
    const wanted = surfaceForTemplate(template);
    const current = currentSurface(state.model);
    return Boolean(wanted && current && wanted.key === current.key);
  }

  function loadDraft(draft, meta) {
    const value = draft || {};
    if (value.kind === 'existing_scene_edit' || value.sceneId && value.changes) {
      const contextApi = global.ProjectMapEditingContextModel;
      const values = contextApi && typeof contextApi.proposalValues === 'function'
        ? contextApi.proposalValues(value)
        : {};
      const opened = openFromSelection(state.projectIndex, value.sceneKind === 'card' ? 'cards' : 'events', value.sceneId, {values, entry: meta});
      if (opened) { restoreAuthoringContext(value.studioAuthoringContext || value.authoringContext || {}, meta); } return opened;
    }
    const context = value.studioAuthoringContext || value.authoringContext || {};
    const ok = openTemplate(templateFromDraft(value) || meta && meta.template || 'event', value, meta || {source: 'Create'});
    if (ok) {
      restoreAuthoringContext(context, meta);
    }
    return ok;
  }

  function refresh() {
    if (!state.active) {
      return;
    }
    state.values = collectValues();
    state.model = state.mode === 'existing' ? buildExistingModel({values: state.values}) : buildTemplateModel({values: state.values});
    const surface = currentSurface(state.model);
    if (surface.key === 'system_ui_preview' || surface.key === 'card_board') {
      render();
      return;
    }
    updateDynamicSurfaces();
  }

  function buildExistingModel(options) {
    return buildExistingModelFor(state.view, state.item, options);
  }

  function buildExistingModelFor(view, item, options) {
    const apiModel = modelApi();
    try {
      return apiModel && typeof apiModel.buildExistingCanvas === 'function'
        ? apiModel.buildExistingCanvas(state.projectIndex, view, item, options || {})
        : diagnosticModel('existing', view || 'existing', item || '', new Error('Object Canvas model is unavailable.'), options);
    } catch (err) {
      return diagnosticModel('existing', view || 'existing', item || '', err, options);
    }
  }

  function buildNewEventModel(options) {
    const apiModel = modelApi();
    return apiModel && typeof apiModel.buildNewEventCanvas === 'function'
      ? apiModel.buildNewEventCanvas(state.projectIndex, state.baseDraft || {}, options || {})
      : null;
  }

  function buildTemplateModel(options) {
    const apiModel = modelApi();
    const template = state.template || 'event';
    try {
      if (apiModel && typeof apiModel.buildTemplateCanvas === 'function') {
        return apiModel.buildTemplateCanvas(state.projectIndex, template, state.baseDraft || {}, options || {});
      }
      return buildNewEventModel(options);
    } catch (err) {
      return diagnosticModel('template', template, state.baseDraft && state.baseDraft.id || '', err, options);
    }
  }

  function diagnosticModel(mode, template, objectId, err, options) {
    const draft = state.baseDraft || {};
    const message = err && err.message ? err.message : String(err || 'Model build failed.');
    return {
      schemaVersion: '0.1',
      kind: 'object_authoring_canvas_model',
      ok: false,
      mode: mode === 'existing' ? 'existing' : String(template || 'event'),
      template: mode === 'existing' ? 'existing' : String(template || 'event'),
      templateLabel: String(template || ''),
      objectKind: String(template || 'object'),
      objectId: String(objectId || draft.id || ''),
      title: String(draft.title || draft.heading || objectId || template || t('objectCanvas.titleFallback', 'Author object')),
      source: {path: ''},
      entry: {source: options && options.source || options && options.entry && options.entry.source || 'Create'},
      contextBoard: {},
      eventBody: {},
      changeState: {
        draft,
        proposal: draft,
        output: {},
        installPlan: null,
        operationSummary: {safeApply: 0, guardedApply: 0, manualReview: 0, refused: 0},
        changedCount: 0,
        diagnostics: [{severity: 'error', code: 'object_canvas.model_build_failed', message}],
        warnings: []
      },
      legacy: {template: String(template || '')},
      rawContext: null
    };
  }

  function showWorkspace(template) {
    activateCreateMode();
    state.workspace = workspaceForTemplate(template);
    const workspaceUi = global.ProjectMapAuthoringWorkspace;
    if (workspaceUi && typeof workspaceUi.setTemplate === 'function') {
      workspaceUi.setTemplate(template, {silent: true});
    }
    if (!elements || !elements.host) {
      return;
    }
    elements.templateButtons.forEach((button) => {
      const active = button.dataset.createTemplate === template || workspaceForTemplate(template) === 'system_ui' && workspaceForTemplate(button.dataset.createTemplate) === 'system_ui';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    elements.templatePanels.forEach((panel) => {
      panel.classList.add('hidden');
    });
    elements.host.hidden = false;
    elements.host.classList.remove('hidden');
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
    if (create && typeof create.click === 'function' && global.document.body.dataset.mode !== 'create') {
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
    const model = state.model || {};
    const surface = currentSurface(model);
    const canRenderStage = model.ok || canRenderSurfaceWithDiagnostics(surface);
    elements.host.innerHTML = [
      '<section class="object-canvas editing-workspace' + (state.editorOverlay ? ' is-editor-overlay' : '') + '" data-object-authoring-canvas="true" data-editing-workspace="true" data-authoring-workspace="' + escapeAttr(state.workspace || 'content') + '" data-authoring-surface="' + escapeAttr(surface.key || 'content_graph') + '">',
      renderHeader(model, surface),
      canRenderStage ? renderCanvasStage(model) : '',
      model.ok ? renderBody(model) : renderUnavailable(model),
      '</section>'
    ].join('');
    bindCanvasEvents();
    updateDynamicSurfaces();
  }

  function renderHeader(model, surface) {
    const source = model.source || {};
    const systemUi = surface && surface.key === 'system_ui_preview';
    const modeLabel = model.mode === 'existing'
      ? t('objectCanvas.mode.existing', 'Editing existing object')
      : t('objectCanvas.mode.newObject', 'Authoring object');
    const kindLabel = systemUi ? t('authoring.template.systemUiScreen', 'System UI Screen') : model.templateLabel || model.objectKind || state.template || 'event';
    const surfaceLabel = surface && surfaceLabelFor(surface) || t('objectCanvas.eyebrow', 'Object Authoring Canvas');
    const title = systemUi ? t('authoring.template.systemUiScreen', 'System UI Screen') : model.title || t('objectCanvas.titleFallback', 'Author object');
    return [
      '<header class="object-canvas-header editing-workspace-header">',
      '<div>',
      '<div class="template-eyebrow" data-authoring-surface-label="true">' + escapeHtml(surfaceLabel) + '</div>',
      '<h2>' + escapeHtml(title) + '</h2>',
      '<p>' + escapeHtml(t('objectCanvas.body', 'Design the object itself: keep context beside it, edit player-facing text directly, then review the exact change operations.')) + '</p>',
      '<div class="editing-status-line" data-object-canvas-status="true">' + escapeHtml(state.status || '') + '</div>',
      '</div>',
      '<dl class="editing-meta">',
      '<dt>' + escapeHtml(t('objectCanvas.mode', 'Mode')) + '</dt><dd>' + escapeHtml(modeLabel) + '</dd>',
      '<dt>' + escapeHtml(t('existingScene.kind', 'Kind')) + '</dt><dd>' + escapeHtml(kindLabel) + '</dd>',
      '<dt>' + escapeHtml(t('existingScene.sceneId', 'Scene')) + '</dt><dd>' + escapeHtml(model.objectId || '') + '</dd>',
      '<dt>' + escapeHtml(t('existingScene.source', 'Source')) + '</dt><dd>' + escapeHtml(source.path ? source.path + (source.line ? ':' + source.line : '') : '') + '</dd>',
      '</dl>',
      '</header>'
    ].join('');
  }

  function renderBody(model) {
    return '<div class="object-canvas-layout object-canvas-layout-retired" hidden data-object-canvas-support-panels="true"></div>';
  }

  function renderCanvasStage(model) {
    const surface = currentSurface(model);
    if (surface.key === 'project_state_board') {
      return renderProjectStateStage(model);
    }
    if (surface.key === 'card_board') {
      return renderCardBoardStage(model);
    }
    if (surface.key === 'system_ui_preview') {
      return renderSystemUiPreviewStage(model);
    }
    if (surface.key === 'content_storyboard' || (state.workspace || 'content') === 'content') {
      return renderContentStoryboardStage(model);
    }
    const graph = graphStageApi();
    return graph && typeof graph.render === 'function'
      ? graph.render(model, {state, renderActions, renderChangePanel})
      : '';
  }

  function canRenderSurfaceWithDiagnostics(surface) {
    const key = surface && surface.key || '';
    return key === 'card_board';
  }

  function renderProjectStateStage(model) {
    const surface = global.ProjectMapProjectStateSurface;
    return surface && typeof surface.render === 'function' ? surface.render(model, {projectIndex: state.projectIndex, selected: state.selectedCanvasNode}) : '';
  }

  function renderSystemUiPreviewStage(model) {
    const surface = global.ProjectMapSystemUiPreviewSurface;
    return surface && typeof surface.render === 'function' ? surface.render(model, {projectIndex: state.projectIndex, selected: state.selectedCanvasNode, fixture: state.systemUiFixture, editorOverlay: state.editorOverlay}) : '';
  }

  function renderContentStoryboardStage(model) {
    const api = storyboardWorkspaceApi(); return api && typeof api.renderStage === 'function' ? api.renderStage(state, model) : '';
  }

  function renderCardBoardStage(model) {
    const api = cardWorkspaceApi(); return api && typeof api.renderStage === 'function' ? api.renderStage(state, model) : '';
  }

  function renderUnavailable(model) {
    const diagnostics = model && model.changeState && model.changeState.diagnostics || [];
    return [
      '<section class="editing-panel" open>',
      '<div class="editing-empty">' + escapeHtml(t('objectCanvas.unavailable', 'Object Canvas cannot open this selection yet.')) + '</div>',
      diagnostics.map((diag) => '<p class="editing-readonly-line">' + escapeHtml((diag.code || 'diagnostic') + ': ' + (diag.message || '')) + '</p>').join(''),
      '</section>'
    ].join('');
  }

  function renderChangePanel(model) {
    const change = model.changeState || {};
    const summary = change.operationSummary || {};
    const output = change.output || {};
    const installPlan = change.installPlan || output.installPlan || parseJson(output.installPlanJson);
    return [
      '<section class="editing-summary" data-object-canvas-operation-summary="true">',
      '<h3>' + escapeHtml(t('objectCanvas.changeTitle', 'Change and safety')) + '</h3>',
      '<div class="editing-summary-grid">',
      summaryBox(t('editing.summary.guarded', 'Guarded'), summary.guardedApply),
      summaryBox(t('editing.summary.manual', 'Manual'), summary.manualReview),
      summaryBox(t('editing.summary.refused', 'Refused'), summary.refused),
      summaryBox(t('objectCanvas.changedFields', 'Changed'), change.changedCount),
      '</div>',
      '</section>',
      '<section class="editing-preview">',
      '<div class="preview-heading">' + escapeHtml(t('objectCanvas.preview', 'Player-facing preview')) + '</div>',
      '<pre class="code-preview" data-object-canvas-preview="true" data-editing-preview="true">' + escapeHtml(output.playerPreview || output.proposalText || output.previewText || output.sceneDry || '') + '</pre>',
      '</section>',
      renderPlanPreview(installPlan),
      renderDiagnostics(change.diagnostics || []),
      renderActions(model)
    ].join('');
  }

  function renderPlanPreview(plan) {
    const operations = Array.isArray(plan && plan.operations) ? plan.operations : [];
    return [
      '<section class="editing-panel object-canvas-plan" data-object-canvas-review-plan="true">',
      '<h3>' + escapeHtml(t('objectCanvas.planTitle', 'Modification plan')) + '</h3>',
      operations.length
        ? operations.slice(0, 6).map(renderPlanOperation).join('')
        : '<p class="editing-empty">' + escapeHtml(t('objectCanvas.planEmpty', 'No install operations are available for review yet.')) + '</p>',
      operations.length > 6 ? '<p class="editing-readonly-line">' + escapeHtml(t('objectCanvas.planMore', 'More operations are available in Review & Apply.')) + '</p>' : '',
      '</section>'
    ].join('');
  }

  function renderPlanOperation(operation) {
    const op = operation && typeof operation === 'object' ? operation : {};
    const title = op.description || op.id || op.type || t('objectCanvas.planOperation', 'Operation');
    const meta = [
      op.safety || '',
      op.type || '',
      op.path || op.targetPath || ''
    ].filter(Boolean).join(' / ');
    return [
      '<article class="object-canvas-plan-row">',
      '<strong>' + escapeHtml(title) + '</strong>',
      meta ? '<span>' + escapeHtml(meta) + '</span>' : '',
      '</article>'
    ].join('');
  }

  function renderDiagnostics(rows) {
    const items = Array.isArray(rows) ? rows : [];
    if (!items.length) {
      return '';
    }
    return [
      '<details class="editing-panel object-canvas-diagnostics">',
      '<summary><span>' + escapeHtml(t('create.diagnostics', 'Diagnostics')) + '</span><b>' + items.length + '</b></summary>',
      items.slice(0, 8).map((diag) => '<p class="editing-readonly-line">' + escapeHtml(diag.message || diag.code || '') + '</p>').join(''),
      '</details>'
    ].join('');
  }

  function renderActions(model) {
    return [
      '<div class="editing-actions object-canvas-actions">',
      '<button type="button" data-object-canvas-action="refresh">' + escapeHtml(t('existingScene.refresh', 'Refresh proposal')) + '</button>',
      '<button type="button" data-object-canvas-action="save">' + escapeHtml(t('editing.saveToChanges', 'Save to My Changes')) + '</button>',
      '<button class="primary-action" type="button" data-object-canvas-action="review">' + escapeHtml(t('existingScene.review', 'Review & Apply')) + '</button>',
      model.mode !== 'existing' ? '<button type="button" data-object-canvas-action="legacy_form">' + escapeHtml(t('objectCanvas.legacyForm', 'Advanced Form')) + '</button>' : '',
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

  function bindCanvasEvents() {
    if (!elements || !elements.host) {
      return;
    }
    elements.host.querySelectorAll('[data-object-canvas-field]').forEach((input) => {
      input.addEventListener('input', refresh);
    });
    elements.host.querySelectorAll('[data-object-canvas-action]').forEach((button) => {
      button.addEventListener('click', () => handleAction(button.dataset.objectCanvasAction || '', button));
    });
    elements.host.querySelectorAll('[data-object-canvas-graph-node]').forEach((button) => {
      button.addEventListener('click', (event) => {
        if (event.target.closest && event.target.closest('input, textarea, select, a')) {
          return;
        }
        selectCanvasNode(button.dataset.objectCanvasGraphNode || 'object');
      });
    });
    elements.host.querySelectorAll('[data-object-canvas-zoom]').forEach((button) => {
      button.addEventListener('click', () => handleCanvasZoom(button.dataset.objectCanvasZoom || 'reset'));
    });
    elements.host.querySelectorAll('button[data-content-storyboard-view]').forEach((button) => {
      button.addEventListener('click', () => setStoryboardView(button.dataset.contentStoryboardView || 'timeline'));
    });
    const systemUiWorkspace = systemUiWorkspaceApi();
    if (systemUiWorkspace && typeof systemUiWorkspace.bind === 'function') {
      systemUiWorkspace.bind(elements.host, {onFixture: setSystemUiFixture, onTemplate: switchSystemUiTemplate});
    }
    const cardWorkspace = cardWorkspaceApi();
    if (cardWorkspace && typeof cardWorkspace.bind === 'function' && currentSurface().key === 'card_board') {
      cardWorkspace.bind(elements.host, state, cardDeps());
    }
    const storyboardInteractions = global.ProjectMapContentStoryboardInteractions;
    if (storyboardInteractions && typeof storyboardInteractions.bind === 'function' && (state.workspace || 'content') === 'content' && currentSurface().key !== 'card_board') {
      storyboardInteractions.bind(elements.host, {
        getViewport: () => ({x: state.canvasPanX, y: state.canvasPanY, zoom: state.canvasZoom}),
        onSelect: selectCanvasNode,
        onCardMove: setCanvasNodePosition,
        onViewport: setCanvasPan,
        onZoom: handleCanvasZoom,
        onPaletteDrop: (payload, target) => { const api = storyboardWorkspaceApi(); return Boolean(api && typeof api.dropPaletteItem === 'function' && api.dropPaletteItem(state, payload, target, storyboardDeps())); }
      });
    }
    const interactions = global.ProjectMapContentGraphInteractions;
    if (interactions && typeof interactions.bind === 'function' && (state.workspace || 'content') === 'content' && elements.host.querySelector('[data-object-canvas-graph-canvas]')) {
      interactions.bind(elements.host, {
        getViewport: () => ({x: state.canvasPanX, y: state.canvasPanY, zoom: state.canvasZoom}),
        onSelect: selectCanvasNode,
        onNodeMove: setCanvasNodePosition,
        onViewport: setCanvasPan,
        onZoom: handleCanvasZoom
      });
    }
    applyCanvasViewport();
    const storyboard = storyboardWorkspaceApi(); if (storyboard && typeof storyboard.bindPalette === 'function' && currentSurface().key !== 'card_board') { storyboard.bindPalette(elements.host, state, storyboardDeps()); }
  }

  function selectCanvasNode(nodeKey) {
    const next = String(nodeKey || 'object').trim() || 'object';
    state.values = collectValues();
    if (switchSystemUiTemplateForRegion(next)) {
      return;
    }
    const cardWorkspace = cardWorkspaceApi();
    if (cardWorkspace && typeof cardWorkspace.selectCard === 'function' && currentSurface().key === 'card_board' && cardWorkspace.selectCard(state, next, cardDeps())) {
      return;
    }
    const storyboard = storyboardWorkspaceApi();
    if (storyboard && typeof storyboard.selectObject === 'function' && storyboard.selectObject(state, next, storyboardDeps())) {
      return;
    }
    state.model = state.mode === 'existing' ? buildExistingModel({values: state.values}) : buildTemplateModel({values: state.values});
    state.selectedCanvasNode = next;
    render();
  }

  function switchSystemUiTemplateForRegion(nodeKey) {
    const api = systemUiWorkspaceApi();
    return Boolean(api && typeof api.switchForRegion === 'function' && api.switchForRegion(state, nodeKey, systemUiDeps()));
  }

  function switchSystemUiTemplate(template) {
    const api = systemUiWorkspaceApi();
    if (api && typeof api.switchTemplate === 'function') { api.switchTemplate(state, template, systemUiDeps()); }
  }

  function setStoryboardView(view) {
    const api = storyboardWorkspaceApi(); if (api && typeof api.setView === 'function') { api.setView(state, view, storyboardDeps()); }
  }

  function setSystemUiFixture(fixture) { const api = systemUiWorkspaceApi(); if (api && typeof api.setFixture === 'function') { api.setFixture(state, fixture, systemUiDeps()); } }

  function handleCanvasZoom(action, event) {
    const viewport = global.ProjectMapObjectCanvasViewport;
    if (viewport && typeof viewport.zoom === 'function') {
      viewport.zoom(elements && elements.host, state, action, event);
    }
  }

  function setCanvasPan(x, y, options) {
    state.canvasPanX = Number(x || 0);
    state.canvasPanY = Number(y || 0);
    applyCanvasViewport();
    if (!(options && options.preview)) {
      render();
    }
  }

  function setCanvasNodePosition(key, x, y, options) {
    const nodeKey = String(key || '').trim();
    if (!nodeKey) {
      return;
    }
    state.nodePositions[nodeKey] = {x: Number(x || 0), y: Number(y || 0)};
    if (!(options && options.preview)) {
      render();
      applyNodeDomPosition(nodeKey, x, y);
    }
  }

  function moveCanvasNode(key, x, y) {
    setCanvasNodePosition(key, x, y);
    applyNodeDomPosition(key, x, y);
    return state.nodePositions[String(key || '').trim()] || null;
  }

  function panCanvas(x, y) {
    setCanvasPan(x, y);
    return {x: state.canvasPanX, y: state.canvasPanY, zoom: state.canvasZoom};
  }

  function applyNodeDomPosition(key, x, y) {
    const nodeKey = String(key || '').trim();
    const nodes = elements && elements.host ? Array.from(elements.host.querySelectorAll('[data-object-canvas-graph-node]')) : [];
    const node = nodes.find((candidate) => candidate.dataset.objectCanvasGraphNode === nodeKey);
    if (!node) {
      return;
    }
    node.dataset.canvasX = String(Number(x || 0));
    node.dataset.canvasY = String(Number(y || 0));
    node.style.left = Number(x || 0) + 'px';
    node.style.top = Number(y || 0) + 'px';
  }

  function applyCanvasViewport() {
    const viewport = global.ProjectMapObjectCanvasViewport;
    if (viewport && typeof viewport.apply === 'function') {
      viewport.apply(elements && elements.host, state);
    }
  }

  function handleAction(action, target) {
    if (action === 'refresh') {
      refresh();
      state.status = t('objectCanvas.status.refreshed', 'Object Canvas refreshed.');
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
    } else if (action === 'legacy_form') {
      openLegacyForm();
    } else if (action === 'toggle_overlay') {
      toggleEditorOverlay();
    } else if (handleCardBoardAction(action, target)) {
      return;
    } else if (handleStoryboardAction(action, target)) {
      return;
    } else if (action.indexOf('create_') === 0) {
      createRelatedDraft(action.replace('create_', ''), target);
    }
  }

  function handleCardBoardAction(action, target) {
    const api = cardWorkspaceApi();
    return action === 'open_card_board' && Boolean(api && typeof api.openFromSystemRegion === 'function' && api.openFromSystemRegion(state, target, cardDeps({source: 'System UI'})));
  }

  function handleStoryboardAction(action, target) {
    const api = storyboardWorkspaceApi(); return Boolean(api && typeof api.handleAction === 'function' && api.handleAction(state, action, target, storyboardDeps()));
  }

  function createRelatedDraft(action, target) {
    const api = storyboardWorkspaceApi(); if (api && typeof api.createRelatedDraft === 'function') { api.createRelatedDraft(state, action, target, {render, t}); }
  }

  function toggleEditorOverlay(next) {
    state.editorOverlay = next === undefined ? !state.editorOverlay : Boolean(next);
    state.values = collectValues();
    state.model = state.mode === 'existing' ? buildExistingModel({values: state.values}) : buildTemplateModel({values: state.values});
    render();
  }

  function reviewCurrentPlan() {
    refresh();
    const output = state.model && state.model.changeState && state.model.changeState.output;
    const plan = output && (output.installPlan || parseJson(output.installPlanJson));
    if (!plan) {
      return;
    }
    const assistant = global.ProjectMapInstallAssistant;
    if (assistant && typeof assistant.loadPlan === 'function') {
      assistant.loadPlan(plan, {fileName: (state.model.objectId || 'object_authoring') + '.install-plan.json'});
      const installButton = global.document.querySelector('[data-mode="install"]');
      if (installButton && typeof installButton.click === 'function') {
        installButton.click();
      }
    }
  }

  function openLegacyForm() {
    const draft = state.model && state.model.changeState && state.model.changeState.draft;
    const template = state.template || 'event';
    deactivate();
    elements.templateButtons.forEach((button) => {
      const active = button.dataset.createTemplate === template ||
        workspaceForTemplate(template) === 'system_ui' && workspaceForTemplate(button.dataset.createTemplate) === 'system_ui';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    elements.templatePanels.forEach((panel) => {
      const active = panel.dataset.createTemplatePanel === template;
      panel.classList.toggle('hidden', !active);
    });
    const wizard = wizardForTemplate(template);
    if (draft && wizard && typeof wizard.loadDraft === 'function') {
      wizard.loadDraft(draft, {source: 'Object Canvas Advanced Form'});
    }
  }

  function collectValues() {
    const values = Object.assign({}, state.values || {});
    if (!elements || !elements.host) {
      return values;
    }
    elements.host.querySelectorAll('[data-object-canvas-field]').forEach((input) => {
      const key = input.dataset.objectCanvasField;
      if (key && input.value !== input.defaultValue) {
        values[key] = input.value;
      }
    });
    return values;
  }

  function updateDynamicSurfaces() {
    if (!elements || !elements.host || !state.model) {
      return;
    }
    const preview = elements.host.querySelector('[data-object-canvas-preview]');
    if (preview) {
      const output = state.model.changeState && state.model.changeState.output || {};
      preview.textContent = output.playerPreview || output.proposalText || output.previewText || output.sceneDry || '';
    }
    const summary = elements.host.querySelector('[data-object-canvas-operation-summary]');
    if (summary) {
      summary.outerHTML = renderChangePanel(state.model).split('<section class="editing-preview">')[0];
    }
    const plan = elements.host.querySelector('[data-object-canvas-review-plan]');
    if (plan) {
      const change = state.model.changeState || {};
      const output = change.output || {};
      plan.outerHTML = renderPlanPreview(change.installPlan || output.installPlan || parseJson(output.installPlanJson));
    }
    const status = elements.host.querySelector('[data-object-canvas-status]');
    if (status) {
      status.textContent = state.status || '';
    }
  }

  function defaultDraftForTemplate(template) {
    const apiModel = modelApi();
    if (apiModel && typeof apiModel.defaultDraftForTemplate === 'function') {
      return apiModel.defaultDraftForTemplate(state.projectIndex, template || 'event');
    }
    const wizard = wizardForTemplate(template || 'event');
    if (wizard && typeof wizard.refresh === 'function') {
      wizard.refresh();
    }
    if (wizard && typeof wizard.getDraft === 'function') {
      const draft = wizard.getDraft();
      if (draft) {
        return draft;
      }
    }
    return {};
  }

  function safeDefaultDraftForTemplate(template) {
    try {
      return defaultDraftForTemplate(template);
    } catch (err) {
      return fallbackDraftForTemplate(template, err);
    }
  }

  function fallbackDraftForTemplate(template, err) {
    const key = normalizeTemplate(template) || 'event';
    const draft = {
      schemaVersion: '0.1',
      kind: key === 'card' ? 'card' : key === 'news' ? 'news_item' : 'event',
      id: key === 'card' ? 'new_action_card' : key === 'news' ? 'new_news_item' : 'new_event',
      title: key === 'news' ? 'New headline' : key === 'card' ? 'New Action Card' : 'New Event',
      heading: key === 'card' ? 'New Action Card' : 'New Event'
    };
    if (key === 'card') {
      draft.cardKind = 'action_card';
      draft.tags = ['cards'];
      draft.introParagraphs = ['Describe the situation shown on this card.'];
      draft.options = [
        {id: 'option_1', label: 'Take action', narrativeParagraphs: ['The card action is resolved.'], gotoAfter: 'root'},
        {id: 'option_2', label: 'Hold back', narrativeParagraphs: ['The card is left for later.'], gotoAfter: 'root'}
      ];
    }
    draft.studioAuthoringFallback = {
      reason: err && err.message ? err.message : String(err || 'default draft failed')
    };
    return draft;
  }

  function draftWithAuthoringContext() {
    const api = systemUiWorkspaceApi();
    const draft = state.model && state.model.changeState && state.model.changeState.draft;
    if ((state.workspace || 'content') === 'content') {
      const cardWorkspace = cardWorkspaceApi();
      if (cardWorkspace && typeof cardWorkspace.draftWithContext === 'function' && currentSurface().key === 'card_board') {
        return cardWorkspace.draftWithContext(state, draft);
      }
      const storyboard = storyboardWorkspaceApi();
      return storyboard && typeof storyboard.draftWithContext === 'function' ? storyboard.draftWithContext(state, draft) : draft;
    }
    return api && typeof api.draftWithContext === 'function' ? api.draftWithContext(state, draft, workspaceForTemplate) : draft;
  }

  function restoreAuthoringContext(context, meta) {
    const cardWorkspace = cardWorkspaceApi();
    if (cardWorkspace && typeof cardWorkspace.restoreContext === 'function' && cardWorkspace.restoreContext(state, context, cardDeps(meta || {source: 'My Changes'}))) {
      return;
    }
    const storyboard = storyboardWorkspaceApi();
    if (storyboard && typeof storyboard.restoreContext === 'function' && storyboard.restoreContext(state, context, storyboardDeps())) {
      return;
    }
    const api = systemUiWorkspaceApi();
    if (api && typeof api.restoreContext === 'function') { api.restoreContext(state, context, systemUiDeps(meta || {source: 'My Changes'})); }
  }

  function templateFromDraft(draft) {
    const apiModel = modelApi();
    if (apiModel && typeof apiModel.templateFromDraft === 'function') {
      return apiModel.templateFromDraft(draft);
    }
    const value = draft || {};
    return value.kind === 'news_item' ? 'news' : value.kind === 'card' ? 'card' : 'event';
  }

  function isCanvasTemplate(template) {
    const registry = registryApi();
    if (registry && typeof registry.isTemplateSupported === 'function') {
      return registry.isTemplateSupported(template) && normalizeTemplate(template) !== 'existing';
    }
    return Boolean(normalizeTemplate(template));
  }

  function normalizeTemplate(template) {
    const registry = registryApi();
    if (registry && typeof registry.normalizeTemplate === 'function') {
      return registry.normalizeTemplate(template);
    }
    const text = String(template || '').trim();
    const supported = {
      event: true,
      news: true,
      card: true,
      play_surface: true,
      workspace_layout: true,
      sidebar_status: true,
      surface: true,
      entry: true,
      project: true,
      variables: true
    };
    return supported[text] ? text : '';
  }

  function workspaceForTemplate(template) {
    const registry = registryApi();
    if (registry && typeof registry.workspaceForTemplate === 'function') {
      return registry.workspaceForTemplate(template);
    }
    const key = normalizeTemplate(template) || (template === 'existing' ? 'existing' : 'event');
    if (key === 'entry' || key === 'play_surface' || key === 'workspace_layout' || key === 'sidebar_status' || key === 'project') {
      return 'system_ui';
    }
    if (key === 'variables') {
      return 'project_state';
    }
    return 'content';
  }

  function systemUiTemplateForRegion(nodeKey) {
    const router = global.ProjectMapSystemUiRegionRouter;
    return router && typeof router.templateForRegion === 'function' ? router.templateForRegion(nodeKey) : '';
  }

  function surfaceForTemplate(template) {
    const registry = registryApi();
    if (registry && typeof registry.surfaceForTemplate === 'function') {
      return registry.surfaceForTemplate(template);
    }
    return {key: 'content_storyboard', workspace: workspaceForTemplate(template), fallback: 'Content Storyboard', labelKey: 'authoring.surface.contentStoryboard'};
  }

  function currentSurface(model) {
    const cardWorkspace = cardWorkspaceApi();
    if (cardWorkspace && typeof cardWorkspace.isCardBoardState === 'function' && cardWorkspace.isCardBoardState(state)) {
      return surfaceForTemplate('card');
    }
    return surfaceForTemplate(state.mode === 'existing' ? 'existing' : state.template || model && model.template || 'event');
  }

  function surfaceLabelFor(surface) {
    const registry = registryApi();
    if (registry && typeof registry.surfaceLabel === 'function') {
      return registry.surfaceLabel(surface, t);
    }
    return surface && surface.fallback || '';
  }

  function registryApi() {
    return global.ProjectMapAuthoringSurfaceRegistry || null;
  }

  function systemUiWorkspaceApi() {
    return global.ProjectMapSystemUiWorkspaceState || null;
  }

  function graphStageApi() { return global.ProjectMapObjectCanvasGraphStage || null; }
  function cardWorkspaceApi() { return global.ProjectMapCardWorkspaceState || null; }
  function cardDeps(entry) { return {buildExistingModel, buildExistingModelFor, buildTemplateModel, collectValues, defaultDraftForTemplate, entry, render, showWorkspace, t}; }

  function storyboardWorkspaceApi() { return global.ProjectMapStoryboardWorkspaceState || null; }
  function storyboardDeps() { return {buildExistingModel, buildExistingModelFor, buildTemplateModel, collectValues, render, showWorkspace, t}; }

  function systemUiDeps(entry) {
    return {buildExistingModel, buildTemplateModel, collectValues, defaultDraftForTemplate, entry, normalizeTemplate, render, showWorkspace, t, templateForRegion: systemUiTemplateForRegion, workspaceForTemplate};
  }

  function statusForTemplate(template, meta) {
    if (meta && meta.source && meta.source !== 'Create') {
      return t('objectCanvas.status.seedLoaded', 'Object Canvas opened from the selected context.');
    }
    return t('objectCanvas.status.newLoaded', 'Object Canvas opened for this template.');
  }

  function wizardForTemplate(template) {
    return {
      event: global.ProjectMapWizard,
      news: global.ProjectMapNewsWizard,
      card: global.ProjectMapCardWizard,
      play_surface: global.ProjectMapPlaySurfaceWizard,
      workspace_layout: global.ProjectMapWorkspaceLayoutWizard,
      sidebar_status: global.ProjectMapSidebarStatusWizard,
      surface: global.ProjectMapSurfaceTextWizard,
      entry: global.ProjectMapEntrySidebarWizard,
      project: global.ProjectMapProjectMetadataWizard,
      variables: global.ProjectMapVariableEditorWizard
    }[template] || null;
  }

  function modelApi() {
    return global.ProjectMapObjectAuthoringCanvasModel || null;
  }

  function schedule(callback) {
    if (typeof global.requestAnimationFrame === 'function') {
      global.requestAnimationFrame(callback);
    } else {
      setTimeout(callback, 0);
    }
  }

  function parseJson(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch (_err) {
      return null;
    }
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
