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
    getDraft: () => state.model && state.model.changeState && state.model.changeState.draft,
    getOutput: () => state.model && state.model.changeState && state.model.changeState.output,
    isActive: () => state.active,
    activeTemplate: () => state.mode === 'existing' ? 'existing' : state.template || 'event',
    activeWorkspace: () => state.workspace || workspaceForTemplate(state.template || 'event'),
    activeSurface: () => surfaceForTemplate(state.mode === 'existing' ? 'existing' : state.template || 'event').key,
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
          if (active && isCanvasTemplate(active.dataset.createTemplate)) {
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
    state.storyboardView = 'timeline';
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
    showWorkspace('existing');
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
    state.storyboardView = 'timeline';
    state.systemUiFixture = 'default';
    state.canvasPanX = 0;
    state.canvasPanY = 0;
    state.nodePositions = {};
    state.draftBranches = [];
    state.editorOverlay = false;
    state.baseDraft = draft || defaultDraftForTemplate(nextTemplate);
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
    if (state.active && state.mode !== 'existing' && state.template === nextTemplate) {
      return;
    }
    openTemplate(nextTemplate, defaultDraftForTemplate(nextTemplate), {source: 'Create'});
  }

  function loadDraft(draft, meta) {
    const value = draft || {};
    if (value.kind === 'existing_scene_edit' || value.sceneId && value.changes) {
      const contextApi = global.ProjectMapEditingContextModel;
      const values = contextApi && typeof contextApi.proposalValues === 'function'
        ? contextApi.proposalValues(value)
        : {};
      return openFromSelection(state.projectIndex, value.sceneKind === 'card' ? 'cards' : 'events', value.sceneId, {values, entry: meta});
    }
    return openTemplate(templateFromDraft(value) || meta && meta.template || 'event', value, meta || {source: 'Create'});
  }

  function refresh() {
    if (!state.active) {
      return;
    }
    state.values = collectValues();
    state.model = state.mode === 'existing' ? buildExistingModel({values: state.values}) : buildTemplateModel({values: state.values});
    if (surfaceForTemplate(state.mode === 'existing' ? 'existing' : state.template || 'event').key === 'system_ui_preview') {
      render();
      return;
    }
    updateDynamicSurfaces();
  }

  function buildExistingModel(options) {
    const apiModel = modelApi();
    return apiModel && typeof apiModel.buildExistingCanvas === 'function'
      ? apiModel.buildExistingCanvas(state.projectIndex, state.view, state.item, options || {})
      : null;
  }

  function buildNewEventModel(options) {
    const apiModel = modelApi();
    return apiModel && typeof apiModel.buildNewEventCanvas === 'function'
      ? apiModel.buildNewEventCanvas(state.projectIndex, state.baseDraft || {}, options || {})
      : null;
  }

  function buildTemplateModel(options) {
    const apiModel = modelApi();
    if (apiModel && typeof apiModel.buildTemplateCanvas === 'function') {
      return apiModel.buildTemplateCanvas(state.projectIndex, state.template || 'event', state.baseDraft || {}, options || {});
    }
    return buildNewEventModel(options);
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
      const active = button.dataset.createTemplate === template;
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
    const surface = surfaceForTemplate(state.mode === 'existing' ? 'existing' : state.template || model.template || 'event');
    elements.host.innerHTML = [
      '<section class="object-canvas editing-workspace' + (state.editorOverlay ? ' is-editor-overlay' : '') + '" data-object-authoring-canvas="true" data-editing-workspace="true" data-authoring-workspace="' + escapeAttr(state.workspace || 'content') + '" data-authoring-surface="' + escapeAttr(surface.key || 'content_graph') + '">',
      renderHeader(model, surface),
      model.ok ? renderCanvasStage(model) : '',
      model.ok ? renderBody(model) : renderUnavailable(model),
      '</section>'
    ].join('');
    bindCanvasEvents();
    updateDynamicSurfaces();
  }

  function renderHeader(model, surface) {
    const source = model.source || {};
    const modeLabel = model.mode === 'existing'
      ? t('objectCanvas.mode.existing', 'Editing existing object')
      : t('objectCanvas.mode.newObject', 'Authoring object');
    const kindLabel = model.templateLabel || model.objectKind || state.template || 'event';
    const surfaceLabel = surface && surfaceLabelFor(surface) || t('objectCanvas.eyebrow', 'Object Authoring Canvas');
    return [
      '<header class="object-canvas-header editing-workspace-header">',
      '<div>',
      '<div class="template-eyebrow" data-authoring-surface-label="true">' + escapeHtml(surfaceLabel) + '</div>',
      '<h2>' + escapeHtml(model.title || t('objectCanvas.titleFallback', 'Author object')) + '</h2>',
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
    const surface = surfaceForTemplate(state.mode === 'existing' ? 'existing' : state.template || model.template || 'event');
    if (surface.key === 'project_state_board') {
      return renderProjectStateStage(model);
    }
    if (surface.key === 'system_ui_preview') {
      return renderSystemUiPreviewStage(model);
    }
    if (surface.key === 'content_storyboard' || (state.workspace || 'content') === 'content') {
      return renderContentStoryboardStage(model);
    }
    const graph = canvasGraphForModel(model);
    let selected = graph.nodes.find((node) => node.key === state.selectedCanvasNode);
    if (!selected) {
      state.selectedCanvasNode = 'object';
      selected = graph.nodes.find((node) => node.key === 'object') || graph.nodes[0];
    }
    return [
      '<section class="object-canvas-stage object-canvas-graph-stage" data-object-canvas-stage="true" data-object-canvas-workspace="' + escapeAttr(graph.workspace) + '" aria-label="' + escapeAttr(t('objectCanvas.stageAria', 'Object Canvas')) + '">',
      '<header class="object-canvas-stage-toolbar">',
      '<div><div class="template-eyebrow">' + escapeHtml(t('objectCanvas.stageEyebrow', 'Canvas')) + '</div><h3>' + escapeHtml(graph.title) + '</h3></div>',
      '<div class="object-canvas-zoom-controls" aria-label="' + escapeAttr(t('objectCanvas.zoomAria', 'Canvas zoom')) + '">',
      '<button type="button" data-object-canvas-zoom="out" title="' + escapeAttr(t('objectCanvas.zoomOut', 'Zoom out')) + '">-</button>',
      '<span data-object-canvas-zoom-label="true">' + escapeHtml(String(Math.round(state.canvasZoom * 100))) + '%</span>',
      '<button type="button" data-object-canvas-zoom="in" title="' + escapeAttr(t('objectCanvas.zoomIn', 'Zoom in')) + '">+</button>',
      '<button type="button" data-object-canvas-zoom="reset" title="' + escapeAttr(t('objectCanvas.zoomReset', 'Reset')) + '">' + escapeHtml(t('objectCanvas.fit', 'Fit')) + '</button>',
      '<button type="button" data-object-canvas-action="toggle_overlay" title="' + escapeAttr(t('objectCanvas.editorOverlay', 'Expand editor')) + '">' + escapeHtml(state.editorOverlay ? t('objectCanvas.editorDock', 'Dock') : t('objectCanvas.editorOverlay', 'Expand editor')) + '</button>',
      '</div>',
      '</header>',
      '<div class="object-canvas-graph-shell">',
      '<div class="object-canvas-graph-canvas" data-object-canvas-graph-canvas="true" style="--object-canvas-graph-width: ' + String(graph.width) + 'px; --object-canvas-graph-height: ' + String(graph.height) + 'px;">',
      '<svg class="object-canvas-graph-edges" data-object-canvas-graph-edges="true" viewBox="0 0 ' + String(graph.width) + ' ' + String(graph.height) + '" aria-hidden="true">',
      graph.edges.map((edge) => renderGraphEdge(edge, graph.nodeByKey)).join(''),
      '</svg>',
      '<div class="object-canvas-graph-board" data-object-canvas-graph-board="true">',
      graph.nodes.map((node) => renderGraphNode(node, selected)).join(''),
      '</div>',
      '</div>',
      '<aside class="object-canvas-graph-inspector" data-object-canvas-graph-inspector="true">',
      renderCanvasInspector(model, selected),
      '</aside>',
      '</div>',
      '</section>'
    ].join('');
  }

  function renderProjectStateStage(model) {
    const surface = global.ProjectMapProjectStateSurface;
    return surface && typeof surface.render === 'function'
      ? surface.render(model, {projectIndex: state.projectIndex, selected: state.selectedCanvasNode})
      : '';
  }

  function renderSystemUiPreviewStage(model) {
    const surface = global.ProjectMapSystemUiPreviewSurface;
    return surface && typeof surface.render === 'function'
      ? surface.render(model, {projectIndex: state.projectIndex, selected: state.selectedCanvasNode, fixture: state.systemUiFixture})
      : '';
  }

  function renderContentStoryboardStage(model) {
    const surface = global.ProjectMapContentStoryboardSurface;
    return surface && typeof surface.render === 'function'
      ? surface.render(model, {
        projectIndex: state.projectIndex,
        selected: state.selectedCanvasNode,
        view: state.storyboardView,
        nodePositions: state.nodePositions || {},
        draftBranches: state.draftBranches || []
      })
      : '';
  }

  function renderGraphNode(node, selected) {
    const className = [
      'object-canvas-graph-node',
      'object-canvas-graph-node-' + escapeAttr(node.kind || 'context'),
      selected && selected.key === node.key ? 'is-selected' : ''
    ].filter(Boolean).join(' ');
    return [
      '<button type="button" class="' + className + '" data-object-canvas-graph-node="' + escapeAttr(node.key) + '" data-canvas-x="' + String(node.x) + '" data-canvas-y="' + String(node.y) + '" style="left: ' + String(node.x) + 'px; top: ' + String(node.y) + 'px;">',
      '<span>' + escapeHtml(node.label) + '</span>',
      '<strong>' + escapeHtml(node.title) + '</strong>',
      '<small>' + escapeHtml(node.detail) + '</small>',
      '</button>'
    ].join('');
  }

  function renderGraphEdge(edge, nodeByKey) {
    const from = nodeByKey[edge.from];
    const to = nodeByKey[edge.to];
    if (!from || !to) {
      return '';
    }
    const x1 = Number(from.x || 0) + 122;
    const y1 = Number(from.y || 0) + 56;
    const x2 = Number(to.x || 0) + 122;
    const y2 = Number(to.y || 0) + 56;
    const bend = Math.max(80, Math.abs(x2 - x1) * 0.44);
    return '<path data-object-canvas-graph-edge="' + escapeAttr(edge.from + '-' + edge.to) + '" d="M ' + x1 + ' ' + y1 + ' C ' + (x1 + bend) + ' ' + y1 + ', ' + (x2 - bend) + ' ' + y2 + ', ' + x2 + ' ' + y2 + '"></path>';
  }

  function renderCanvasInspector(model, node) {
    const selected = node || {key: 'object', title: model.title || '', label: t('objectCanvas.stage.object.label', 'Object')};
    if (selected.panel === 'object') {
      return renderObjectInspector(model, selected);
    }
    if (selected.panel === 'plan' || selected.panel === 'review') {
      return [
        renderInspectorIntro(selected),
        renderChangePanel(model)
      ].join('');
    }
    if (selected.panel === 'draft') {
      return [
        renderInspectorIntro(selected),
        renderActions(model)
      ].join('');
    }
    return [
      renderInspectorIntro(selected),
      renderContextBoard(model.contextBoard || {}),
      renderActions(model)
    ].join('');
  }

  function renderObjectInspector(model, node) {
    return [
      renderInspectorIntro(node),
      renderEventBody(model.eventBody || {}),
      '<section class="editing-preview object-canvas-inspector-preview">',
      '<div class="preview-heading">' + escapeHtml(t('objectCanvas.preview', 'Player-facing preview')) + '</div>',
      '<pre class="code-preview" data-object-canvas-preview="true" data-editing-preview="true">' + escapeHtml(model.changeState && model.changeState.output && (model.changeState.output.playerPreview || model.changeState.output.proposalText || model.changeState.output.previewText || model.changeState.output.sceneDry) || '') + '</pre>',
      '</section>',
      renderActions(model)
    ].join('');
  }

  function renderInspectorIntro(node) {
    return [
      '<section class="object-canvas-inspector-card">',
      '<div class="template-eyebrow">' + escapeHtml(node.label || t('objectCanvas.inspect', 'Inspect')) + '</div>',
      '<h3>' + escapeHtml(node.title || '') + '</h3>',
      '<p>' + escapeHtml(node.detail || '') + '</p>',
      '</section>'
    ].join('');
  }

  function canvasGraphForModel(model) {
    const workspace = state.workspace || workspaceForTemplate(state.mode === 'existing' ? 'existing' : state.template || model.template || 'event');
    const graphs = global.ProjectMapAuthoringSurfaceGraphs;
    if (graphs && typeof graphs.buildGraph === 'function') {
      return graphs.buildGraph(model, {
        workspace,
        nodePositions: state.nodePositions || {},
        draftBranches: state.draftBranches || []
      });
    }
    return {title: '', width: 1, height: 1, nodes: [], edges: [], nodeByKey: {}, workspace};
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

  function renderContextBoard(board) {
    return [
      '<section class="object-canvas-board" data-object-canvas-context="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('objectCanvas.contextEyebrow', 'Context board')) + '</div>',
      '<h3>' + escapeHtml(t('objectCanvas.contextTitle', 'Related state')) + '</h3>',
      renderBoardGroup(t('objectCanvas.group.flow', 'Flow'), board.flow, renderFlowRow),
      renderBoardGroup(t('editing.group.variables', 'Variables touched'), board.variables, renderVariableRow),
      renderBoardGroup(t('editing.group.effects', 'Effects'), board.effects, renderEffectRow),
      renderBoardGroup(t('editing.group.sourceEvidence', 'Source evidence'), board.sourceEvidence, renderSourceRow),
      renderBoardGroup(t('editing.group.manualBoundaries', 'Manual-review boundaries'), board.manualBoundaries, renderBoundaryRow),
      '</section>'
    ].join('');
  }

  function renderBoardGroup(title, rows, renderRow) {
    const items = Array.isArray(rows) ? rows : [];
    return [
      '<details class="object-canvas-board-group" open>',
      '<summary><span>' + escapeHtml(title) + '</span><b>' + items.length + '</b></summary>',
      items.length ? items.slice(0, 12).map(renderRow).join('') : '<p class="editing-empty">' + escapeHtml(t('editing.noContextRows', 'No rows in this context group.')) + '</p>',
      '</details>'
    ].join('');
  }

  function renderFlowRow(row) {
    return '<article class="object-canvas-context-row"><strong>' + escapeHtml(row.label || '') + '</strong><span>' + escapeHtml([row.direction, row.detail].filter(Boolean).join(' / ')) + '</span></article>';
  }

  function renderVariableRow(row) {
    return '<article class="object-canvas-context-row"><strong>Q.' + escapeHtml(row.name || '') + '</strong><span>' + escapeHtml([row.readCount + ' ' + t('editing.reads', 'reads'), row.writeCount + ' ' + t('editing.writes', 'writes')].join(' / ')) + '</span></article>';
  }

  function renderEffectRow(row) {
    return '<article class="object-canvas-context-row"><strong>Q.' + escapeHtml(row.variable || '') + '</strong><span>' + escapeHtml([row.op, row.value, sourceLabel(row.source)].filter(Boolean).join(' ')) + '</span></article>';
  }

  function renderSourceRow(row) {
    const line = row.line || row.startLine || '';
    return '<article class="object-canvas-context-row"><strong>' + escapeHtml(row.label || 'source') + '</strong><span>' + escapeHtml((row.path || '') + (line ? ':' + line : '')) + '</span></article>';
  }

  function renderBoundaryRow(row) {
    return '<article class="object-canvas-context-row"><strong>' + escapeHtml(row.label || '') + '</strong><span>' + escapeHtml(row.reason || '') + '</span></article>';
  }

  function renderEventBody(body) {
    return [
      '<section class="object-event-body" data-object-canvas-event-body="true">',
      '<div class="template-eyebrow">' + escapeHtml(body.bodyEyebrow || t('objectCanvas.eventEyebrow', 'Event body')) + '</div>',
      renderTitleField(body),
      renderSections(body.sections || []),
      renderOptions(body.options || [], body.optionsLabel),
      renderMetaFields(body.metaFields || [], body.metaLabel),
      '</section>'
    ].join('');
  }

  function renderTitleField(body) {
    const title = body.title || {};
    const heading = body.heading || null;
    return [
      '<div class="object-event-title-block">',
      renderInlineField(title, {element: 'input', titleClass: true}),
      heading ? renderInlineField(heading, {element: 'input'}) : '',
      '</div>'
    ].join('');
  }

  function renderSections(sections) {
    const items = Array.isArray(sections) ? sections : [];
    return [
      '<div class="object-event-sections">',
      items.length ? items.map((field) => renderInlineField(field, {element: 'textarea'})).join('') : '<p class="editing-empty">' + escapeHtml(t('objectCanvas.noBodyFields', 'No player-facing body fields are available yet.')) + '</p>',
      '</div>'
    ].join('');
  }

  function renderOptions(options, label) {
    const items = Array.isArray(options) ? options : [];
    return [
      '<section class="object-event-options">',
      '<h3>' + escapeHtml(label || t('existingScene.options', 'Options')) + '</h3>',
      items.length ? items.map(renderOption).join('') : '<p class="editing-empty">' + escapeHtml(t('objectCanvas.noOptions', 'No options found for this object.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderOption(option, index) {
    const fields = Array.isArray(option.fields) ? option.fields : [];
    return [
      '<article class="object-event-option">',
      '<div class="object-event-option-index">' + escapeHtml(String(index + 1)) + '</div>',
      '<div class="object-event-option-fields">',
      fields.length ? fields.map((field) => renderInlineField(field, {element: field.id && field.id.endsWith('.body') ? 'textarea' : 'input'})).join('') : '<strong>' + escapeHtml(option.label || option.id || '') + '</strong>',
      option.targetId ? '<small>' + escapeHtml(t('objectCanvas.optionTarget', 'Target') + ': ' + option.targetId) + '</small>' : '',
      '</div>',
      '</article>'
    ].join('');
  }

  function renderMetaFields(fields, label) {
    const items = Array.isArray(fields) ? fields : [];
    if (!items.length) {
      return '';
    }
    return [
      '<details class="object-event-meta">',
      '<summary>' + escapeHtml(label || t('objectCanvas.advancedFields', 'Timing and advanced fields')) + '</summary>',
      '<div class="object-event-meta-grid">',
      items.map((field) => renderInlineField(field, {element: 'input'})).join(''),
      '</div>',
      '</details>'
    ].join('');
  }

  function renderInlineField(field, options) {
    const value = String(field && field.value !== undefined ? field.value : field && field.original || '');
    const id = field && field.id || '';
    const readOnly = field && (field.readOnly || !id);
    const element = options && options.element === 'input' ? 'input' : 'textarea';
    const className = options && options.titleClass ? ' object-field-title' : '';
    const common = ' class="object-inline-input' + className + '" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '"' + (readOnly ? ' readonly' : '');
    return [
      '<label class="object-inline-field object-inline-field-' + escapeAttr(field && field.status || 'review') + '">',
      '<span>' + escapeHtml(field && field.label || id || '') + '</span>',
      element === 'input'
        ? '<input type="text"' + common + ' value="' + escapeAttr(value) + '">'
        : '<textarea rows="' + rowsFor(value) + '"' + common + '>' + escapeHtml(value) + '</textarea>',
      '<small>' + escapeHtml([statusLabel(field && field.status), sourceLabel(field && field.source)].filter(Boolean).join(' / ')) + '</small>',
      '</label>'
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
      button.addEventListener('click', () => handleAction(button.dataset.objectCanvasAction || ''));
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
    elements.host.querySelectorAll('[data-content-storyboard-view]').forEach((button) => {
      button.addEventListener('click', () => setStoryboardView(button.dataset.contentStoryboardView || 'timeline'));
    });
    elements.host.querySelectorAll('[data-system-ui-fixture]').forEach((button) => {
      button.addEventListener('click', () => setSystemUiFixture(button.dataset.systemUiFixture || 'default'));
    });
    const storyboardInteractions = global.ProjectMapContentStoryboardInteractions;
    if (storyboardInteractions && typeof storyboardInteractions.bind === 'function' && (state.workspace || 'content') === 'content') {
      storyboardInteractions.bind(elements.host, {
        getViewport: () => ({x: state.canvasPanX, y: state.canvasPanY, zoom: state.canvasZoom}),
        onSelect: selectCanvasNode,
        onCardMove: setCanvasNodePosition,
        onViewport: setCanvasPan,
        onZoom: handleCanvasZoom
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
  }

  function selectCanvasNode(nodeKey) {
    const next = String(nodeKey || 'object').trim() || 'object';
    state.values = collectValues();
    state.model = state.mode === 'existing' ? buildExistingModel({values: state.values}) : buildTemplateModel({values: state.values});
    state.selectedCanvasNode = next;
    render();
  }

  function setStoryboardView(view) {
    state.storyboardView = String(view || '') === 'chain' ? 'chain' : 'timeline';
    state.values = collectValues();
    state.model = state.mode === 'existing' ? buildExistingModel({values: state.values}) : buildTemplateModel({values: state.values});
    render();
  }

  function setSystemUiFixture(fixture) {
    state.systemUiFixture = String(fixture || '') === 'busy' ? 'busy' : 'default';
    state.values = collectValues();
    state.model = state.mode === 'existing' ? buildExistingModel({values: state.values}) : buildTemplateModel({values: state.values});
    render();
  }

  function handleCanvasZoom(action) {
    if (action === 'in') {
      state.canvasZoom = Math.min(1.4, Number(state.canvasZoom || 1) + 0.1);
    } else if (action === 'out') {
      state.canvasZoom = Math.max(0.7, Number(state.canvasZoom || 1) - 0.1);
    } else {
      state.canvasZoom = 1;
      state.canvasPanX = 0;
      state.canvasPanY = 0;
    }
    applyCanvasViewport();
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
    if (!elements || !elements.host) {
      return;
    }
    const scale = Math.max(0.7, Math.min(1.4, Number(state.canvasZoom || 1)));
    state.canvasZoom = scale;
    const transform = 'translate(' + Number(state.canvasPanX || 0) + 'px, ' + Number(state.canvasPanY || 0) + 'px) scale(' + scale.toFixed(3) + ')';
    const board = elements.host.querySelector('[data-object-canvas-graph-board]');
    const edges = elements.host.querySelector('[data-object-canvas-graph-edges]');
    const label = elements.host.querySelector('[data-object-canvas-zoom-label]');
    if (board) {
      board.style.transform = transform;
      board.style.transformOrigin = '0 0';
    }
    if (edges) {
      edges.style.transform = transform;
      edges.style.transformOrigin = '0 0';
    }
    if (label) {
      label.textContent = Math.round(scale * 100) + '%';
    }
  }

  function handleAction(action) {
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
    } else if (action.indexOf('create_') === 0) {
      createRelatedDraft(action.replace('create_', ''));
    }
  }

  function createRelatedDraft(action) {
    const api = global.ProjectMapAuthoringReferenceIndex;
    if (!api || typeof api.branchDraft !== 'function') {
      return;
    }
    const draft = api.branchDraft(action, state.model || {});
    state.draftBranches.push(draft);
    state.selectedCanvasNode = 'draft:' + draft.id;
    state.status = t('objectCanvas.status.branchCreated', 'A related draft card was added to the Storyboard.');
    render();
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
      const active = button.dataset.createTemplate === template;
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
    const values = {};
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
    if (key === 'entry' || key === 'play_surface' || key === 'workspace_layout' || key === 'sidebar_status') {
      return 'system_ui';
    }
    if (key === 'project' || key === 'variables') {
      return 'project_state';
    }
    return 'content';
  }

  function surfaceForTemplate(template) {
    const registry = registryApi();
    if (registry && typeof registry.surfaceForTemplate === 'function') {
      return registry.surfaceForTemplate(template);
    }
    return {key: 'content_storyboard', workspace: workspaceForTemplate(template), fallback: 'Content Storyboard', labelKey: 'authoring.surface.contentStoryboard'};
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

  function rowsFor(value) {
    const lines = String(value || '').split('\n').length;
    return String(Math.max(3, Math.min(12, lines + 1)));
  }

  function statusLabel(status) {
    const value = String(status || '');
    if (value === 'guarded') {
      return t('editing.status.guarded', 'guarded apply');
    }
    if (value === 'manual') {
      return t('editing.status.manual', 'manual review');
    }
    if (value === 'read_only') {
      return t('editing.status.readOnly', 'read-only');
    }
    return value;
  }

  function sourceLabel(source) {
    const ref = source && typeof source === 'object' ? source : {};
    return ref.path ? ref.path + (ref.line ? ':' + ref.line : '') : '';
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
