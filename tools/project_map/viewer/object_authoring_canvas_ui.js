(function initProjectMapObjectAuthoringCanvas(global) {
  'use strict';

  const EVENT_NAMES = [
    'project-map:index-loaded',
    'ProjectMap:index-loaded',
    'projectmap:index-loaded',
    'ProjectMapIndexLoaded',
    'project-map:model-loaded'
  ];
  const AUTHORING_SIDEBAR_WIDTH_KEY = 'dendry-mod-studio-authoring-sidebar-width';
  const OBJECT_EDITOR_PREVIEW_WIDTH_KEY = 'dendry-mod-studio-object-editor-preview-width';
  const AUTHORING_SIDEBAR_MIN_WIDTH = 300;
  const AUTHORING_SIDEBAR_MAX_WIDTH = 760;
  const OBJECT_EDITOR_PREVIEW_MIN_WIDTH = 360;
  const OBJECT_EDITOR_PREVIEW_MAX_WIDTH = 900;
  const PROJECT_STATE_ROW_LIMIT = 120;
  const PROJECT_STATE_SEARCH_DEBOUNCE_MS = 140;

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
    storyCanvasCategory: 'story',
    storySearchQuery: '',
    storyScopeCollapsed: false,
    storyOverviewCollapsed: false,
    storyCardColors: {},
    storyScopeMode: 'focus',
    storyScopeWindow: '',
    storyChainDepth: '1',
    cardBoardSelectedKey: '',
    cardBoardLane: 'pool',
    cardBoardQuery: '',
    cardBoardType: 'all',
    cardBoardDropContext: null,
    projectStateQuery: '',
    projectStateLimit: PROJECT_STATE_ROW_LIMIT,
    systemUiFixture: 'default',
    canvasZoom: 1,
    canvasPanX: 0,
    canvasPanY: 0,
    nodePositions: {},
    draftBranches: [],
    editorOverlay: false,
    deleteProposal: null,
    sourceSliceModel: null,
    sourceSliceAdvancedConfirmed: false,
    semanticLogicModel: null,
    semanticLogicAdvancedConfirmed: false,
    boardChromeCollapsed: true,
    runtimeLensSession: null,
    runtimeLensStatus: 'idle',
    runtimeLensFocusKey: '',
    runtimeLensDraftKey: '', runtimeLensCurrentDraftKey: '',
    runtimeLensExpanded: false, runtimeLensCollapsed: false,
    runtimeLensEmbedsSuspended: false,
    authoringSidebarWidth: readStoredNumber(AUTHORING_SIDEBAR_WIDTH_KEY, 390),
    objectEditorPreviewWidth: readStoredNumber(OBJECT_EDITOR_PREVIEW_WIDTH_KEY, 620),
    objectEditorPreviewExpanded: false,
    resizingPane: null,
    baseDraft: null,
    proposalOptions: null,
    values: {},
    valueOriginals: {},
    structureCommands: [],
    structureCommandCounter: 0,
    transientReturnStack: [],
    preserveScrollOnNextRefresh: false,
    model: null,
    status: ''
  };

  let elements = null; let templateClickToken = 0; let reconcileToken = 0; let refreshTimer = null; let projectStateSearchTimer = null; let projectStateSearchFocus = null;

  const api = {
    openFromSelection,
    openVisibleEditAction,
    openTemplate,
    openNewEvent,
    loadDraft,
    refresh,
    getDraft: draftWithAuthoringContext,
    getOutput: () => state.model && state.model.changeState && state.model.changeState.output,
    getSourceSliceModel: () => state.sourceSliceModel || null,
    getSemanticLogicModel: () => state.semanticLogicModel || null,
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
    returnFromTransientWorkspace,
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
      createPane: document.getElementById('create-pane'),
      templateButtons: Array.from(document.querySelectorAll('[data-create-template]')),
      templatePanels: Array.from(document.querySelectorAll('[data-create-template-panel]'))
    };
    if (!elements.host) {
      return;
    }
    bindIndexEvents();
    bindTemplateEvents(document);
    bindTemplateReconciler(document);
    bindRuntimeLifecycle(document);
    bindPaneResizeEvents(document);
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
      const source = event && event.detail && event.detail.source || '';
      if (isCanvasTemplate(template)) {
        if (templateMatchesExistingView(template)) {
          if (source === 'authoring-workspace') {
            openTemplateFromCreate(template, {forceNew: true});
            scheduleTemplateReconcile(document);
            return;
          }
          scheduleTemplateReconcile(document);
          return;
        }
        openTemplateFromCreate(template);
        scheduleTemplateReconcile(document);
      } else if (template && template !== 'existing' && template !== 'object_canvas') {
        deactivate();
      }
    });
    document.addEventListener('click', (event) => {
      const templateButton = event.target.closest && event.target.closest('[data-create-template]');
      if (templateButton) {
        const clickedTemplate = templateButton.dataset.createTemplate || '';
        const token = ++templateClickToken;
        schedule(() => {
          if (token === templateClickToken) {
            if (templateMatchesExistingView(clickedTemplate)) {
              openTemplateFromCreate(clickedTemplate, {forceNew: true});
              scheduleTemplateReconcile(document);
              return;
            }
            syncTemplateButtonClick(clickedTemplate);
            scheduleTemplateReconcile(document);
          }
        });
      }
      const modeButton = event.target.closest && event.target.closest('[data-mode="create"]');
      if (modeButton) {
        schedule(() => {
          const active = document.querySelector('[data-create-template].is-active');
          if (active && isCanvasTemplate(active.dataset.createTemplate) && !templateMatchesExistingView(active.dataset.createTemplate) && !(state.active && workspaceForTemplate(state.template) === 'system_ui' && workspaceForTemplate(active.dataset.createTemplate) === 'system_ui')) {
            openTemplateFromCreate(active.dataset.createTemplate);
          }
          scheduleTemplateReconcile(document);
        });
      }
    });
  }

  function bindTemplateReconciler(document) {
    const target = document.querySelector('[data-authoring-workspace-nav]') || document.body;
    if (!target || typeof MutationObserver === 'undefined') {
      return;
    }
    const observer = new MutationObserver(() => {
      scheduleTemplateReconcile(document);
    });
    observer.observe(target, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-selected', 'hidden']
    });
    scheduleTemplateReconcile(document);
  }

  function bindRuntimeLifecycle(document) {
    document.addEventListener('ProjectMap:mode-changing', (event) => {
      const detail = event && event.detail || {};
      if (detail.previousMode === 'create' && detail.nextMode !== 'create') {
        suspendForegroundRuntime('mode');
      }
    });
    document.addEventListener('ProjectMap:foreground-changed', (event) => {
      const detail = event && event.detail || {};
      if (detail.visible === false && createModeIsActive(document)) {
        suspendForegroundRuntime('background');
      }
    });
  }

  function suspendForegroundRuntime(_reason) {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    if (projectStateSearchTimer) {
      clearTimeout(projectStateSearchTimer);
      projectStateSearchTimer = null;
      projectStateSearchFocus = null;
    }
    cancelPaneResize();
    if (state.runtimeLensSession && state.runtimeLensSession.ok) {
      state.runtimeLensEmbedsSuspended = true;
      if (state.runtimeLensStatus !== 'failed') {
        state.runtimeLensStatus = 'suspended';
      }
    }
    removeRuntimeLensFrames();
  }

  function removeRuntimeLensFrames() {
    if (!elements || !elements.host || !elements.host.querySelectorAll) {
      return;
    }
    elements.host.querySelectorAll('[data-runtime-lens-frame]').forEach((frame) => {
      frame.setAttribute('src', 'about:blank');
      if (frame.parentNode) {
        frame.parentNode.removeChild(frame);
      }
    });
  }

  function bindPaneResizeEvents(document) {
    document.addEventListener('pointermove', movePaneResize);
    document.addEventListener('pointerup', endPaneResize);
    document.addEventListener('pointercancel', cancelPaneResize);
    if (global && typeof global.addEventListener === 'function') {
      global.addEventListener('blur', cancelPaneResize);
    }
  }

  function beginPaneResize(event) {
    const resizer = event.currentTarget;
    const type = resizer && resizer.dataset && resizer.dataset.objectCanvasResizer || '';
    if (!type || event.button !== undefined && event.button !== 0) {
      return;
    }
    event.preventDefault();
    state.resizingPane = {
      type,
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: type === 'object_editor' ? currentObjectEditorPreviewWidth() : currentAuthoringSidebarWidth()
    };
    resizer.classList.add('is-dragging');
    const root = objectCanvasRoot();
    if (root) {
      root.classList.add('is-resizing-pane');
    }
    if (typeof resizer.setPointerCapture === 'function') {
      try {
        resizer.setPointerCapture(event.pointerId);
      } catch (_err) {
        // Document-level listeners keep the resize active if pointer capture is unavailable.
      }
    }
  }

  function movePaneResize(event) {
    if (!state.resizingPane || event.pointerId !== state.resizingPane.pointerId) {
      return;
    }
    event.preventDefault();
    const delta = event.clientX - state.resizingPane.startX;
    const nextWidth = state.resizingPane.type === 'object_editor'
      ? state.resizingPane.startWidth + delta
      : state.resizingPane.startWidth - delta;
    applyPaneWidth(state.resizingPane.type, nextWidth);
  }

  function endPaneResize(event) {
    if (!state.resizingPane || event.pointerId !== state.resizingPane.pointerId) {
      return;
    }
    const type = state.resizingPane.type;
    const activeResizer = elements && elements.host && elements.host.querySelector('[data-object-canvas-resizer].is-dragging');
    state.resizingPane = null;
    if (activeResizer) {
      activeResizer.classList.remove('is-dragging');
      if (typeof activeResizer.releasePointerCapture === 'function') {
        try {
          activeResizer.releasePointerCapture(event.pointerId);
        } catch (_err) {
          // Capture may already be released.
        }
      }
    }
    const root = objectCanvasRoot();
    if (root) {
      root.classList.remove('is-resizing-pane');
    }
    storeStoredNumber(
      type === 'object_editor' ? OBJECT_EDITOR_PREVIEW_WIDTH_KEY : AUTHORING_SIDEBAR_WIDTH_KEY,
      type === 'object_editor' ? state.objectEditorPreviewWidth : state.authoringSidebarWidth
    );
  }

  function cancelPaneResize() {
    if (!state.resizingPane) {
      return;
    }
    state.resizingPane = null;
    if (elements && elements.host) {
      elements.host.querySelectorAll('[data-object-canvas-resizer].is-dragging').forEach((resizer) => {
        resizer.classList.remove('is-dragging');
      });
    }
    const root = objectCanvasRoot();
    if (root) {
      root.classList.remove('is-resizing-pane');
    }
  }

  function applyPaneWidth(type, width) {
    const root = objectCanvasRoot();
    if (type === 'object_editor') {
      state.objectEditorPreviewWidth = clampObjectEditorPreviewWidth(width);
      if (root) {
        root.style.setProperty('--object-editor-preview-width', state.objectEditorPreviewWidth + 'px');
      }
      return;
    }
    state.authoringSidebarWidth = clampAuthoringSidebarWidth(width);
    if (root) {
      root.style.setProperty('--object-canvas-sidebar-width', state.authoringSidebarWidth + 'px');
    }
  }

  function currentAuthoringSidebarWidth() {
    if (elements && elements.host) {
      const sidebar = elements.host.querySelector('[data-content-storyboard-editor], [data-card-face-editor]');
      if (sidebar && typeof sidebar.getBoundingClientRect === 'function') {
        const rect = sidebar.getBoundingClientRect();
        if (rect.width) {
          return rect.width;
        }
      }
    }
    return state.authoringSidebarWidth || 390;
  }

  function currentObjectEditorPreviewWidth() {
    if (elements && elements.host) {
      const pane = elements.host.querySelector('[data-object-editing-modal-preview-pane]');
      if (pane && typeof pane.getBoundingClientRect === 'function') {
        const rect = pane.getBoundingClientRect();
        if (rect.width) {
          return rect.width;
        }
      }
    }
    return state.objectEditorPreviewWidth || 620;
  }

  function clampAuthoringSidebarWidth(width) {
    const available = objectCanvasAvailableWidth();
    const maxWidth = Math.min(AUTHORING_SIDEBAR_MAX_WIDTH, Math.max(AUTHORING_SIDEBAR_MIN_WIDTH, available - 430));
    return clampNumber(width, AUTHORING_SIDEBAR_MIN_WIDTH, maxWidth);
  }

  function clampObjectEditorPreviewWidth(width) {
    const available = objectEditorAvailableWidth();
    const maxWidth = Math.min(OBJECT_EDITOR_PREVIEW_MAX_WIDTH, Math.max(OBJECT_EDITOR_PREVIEW_MIN_WIDTH, available - 438));
    return clampNumber(width, OBJECT_EDITOR_PREVIEW_MIN_WIDTH, maxWidth);
  }

  function objectCanvasAvailableWidth() {
    const root = objectCanvasRoot();
    if (root && typeof root.getBoundingClientRect === 'function') {
      const rect = root.getBoundingClientRect();
      if (rect.width) {
        return rect.width;
      }
    }
    return global.innerWidth || 1280;
  }

  function objectEditorAvailableWidth() {
    if (elements && elements.host) {
      const dialog = elements.host.querySelector('.object-editing-modal-dialog');
      if (dialog && typeof dialog.getBoundingClientRect === 'function') {
        const rect = dialog.getBoundingClientRect();
        if (rect.width) {
          return rect.width;
        }
      }
    }
    return Math.max(720, (global.innerWidth || 1280) - 52);
  }

  function objectCanvasRoot() {
    return elements && elements.host && elements.host.querySelector('[data-object-authoring-canvas]');
  }

  function captureObjectCanvasScroll() {
    if (!elements || !elements.host) {
      return null;
    }
    const selectors = [
      '[data-object-editing-modal-preview-pane]',
      '.object-editing-fields-pane',
      '[data-preview-object-editor]',
      '[data-content-storyboard-canvas]',
      '[data-content-storyboard-editor]',
      '[data-card-board-surface]',
      '[data-card-face-editor]',
      '[data-system-ui-live-preview]',
      '[data-system-ui-inspector]',
      '[data-project-state-board]',
      '[data-object-canvas-graph-canvas]',
      '[data-object-canvas-stage]'
    ];
    const entries = [];
    selectors.forEach((selector) => {
      elements.host.querySelectorAll(selector).forEach((node, index) => {
        entries.push({
          selector,
          index,
          top: Number(node.scrollTop || 0),
          left: Number(node.scrollLeft || 0)
        });
      });
    });
    const active = global.document && global.document.activeElement;
    const activeField = active && elements.host.contains(active) && typeof active.closest === 'function'
      ? active.closest('[data-object-canvas-field]')
      : null;
    const key = activeField && activeField.dataset && activeField.dataset.objectCanvasField || '';
    return {
      windowX: Number(global.scrollX || global.pageXOffset || 0),
      windowY: Number(global.scrollY || global.pageYOffset || 0),
      activeField: key ? {
        key,
        start: typeof activeField.selectionStart === 'number' ? activeField.selectionStart : null,
        end: typeof activeField.selectionEnd === 'number' ? activeField.selectionEnd : null
      } : null,
      entries
    };
  }

  function restoreObjectCanvasScroll(snapshot) {
    if (!snapshot || !elements || !elements.host) {
      return;
    }
    const apply = () => {
      if (!elements || !elements.host) {
        return;
      }
      restoreObjectCanvasFocus(snapshot.activeField);
      ensureArray(snapshot.entries).forEach((entry) => {
        const nodes = elements.host.querySelectorAll(entry.selector);
        const node = nodes && nodes[entry.index];
        if (!node) {
          return;
        }
        node.scrollTop = Number(entry.top || 0);
        node.scrollLeft = Number(entry.left || 0);
      });
      if (typeof global.scrollTo === 'function') {
        try {
          global.scrollTo(Number(snapshot.windowX || 0), Number(snapshot.windowY || 0));
        } catch (_err) {
          // Some embedded runtimes do not allow window scroll restoration.
        }
      }
    };
    apply();
    if (typeof global.requestAnimationFrame === 'function') {
      global.requestAnimationFrame(apply);
    }
  }

  function restoreObjectCanvasFocus(activeField) {
    const key = activeField && activeField.key;
    if (!key || !elements || !elements.host) {
      return;
    }
    const field = elements.host.querySelector('[data-object-canvas-field="' + cssEscape(key) + '"]');
    if (!field || typeof field.focus !== 'function' || global.document && global.document.activeElement === field) {
      return;
    }
    try {
      field.focus({preventScroll: true});
    } catch (_err) {
      try {
        field.focus();
      } catch (_focusErr) {
        return;
      }
    }
    if (
      activeField.start !== null &&
      activeField.end !== null &&
      typeof field.setSelectionRange === 'function' &&
      !/^(?:checkbox|radio)$/i.test(String(field.type || ''))
    ) {
      try {
        field.setSelectionRange(activeField.start, activeField.end);
      } catch (_err) {
        // Unsupported input types can ignore selection restoration.
      }
    }
  }

  function clampNumber(value, min, max) {
    const numeric = Number(value);
    const upper = Math.max(min, Number(max) || min);
    return Math.min(Math.max(Number.isFinite(numeric) ? numeric : min, min), upper);
  }

  function readStoredNumber(key, fallback) {
    try {
      const raw = global.localStorage && global.localStorage.getItem(key);
      const parsed = Number.parseFloat(raw || '');
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    } catch (_err) {
      return fallback;
    }
  }

  function storeStoredNumber(key, value) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(key, String(Math.round(Number(value) || 0)));
      }
    } catch (_err) {
      // Layout width is a preference; storage failures should not block editing.
    }
  }

  function scheduleTemplateReconcile(document) {
    const token = ++reconcileToken;
    schedule(() => {
      if (token === reconcileToken) {
        reconcileActiveTemplate(document);
      }
    });
  }

  function reconcileActiveTemplate(document) {
    if (!createModeIsActive(document)) {
      return;
    }
    const template = activeTemplateFromDom(document);
    if (shouldReconcileTemplate(template)) {
      openTemplateFromCreate(template);
    }
  }

  function shouldReconcileTemplate(template) {
    if (!isCanvasTemplate(template)) {
      return false;
    }
    if (state.mode === 'existing') {
      return false;
    }
    const currentTemplate = normalizeTemplate(state.template) || '';
    if (
      currentTemplate &&
      currentTemplate !== template &&
      workspaceForTemplate(currentTemplate) === 'system_ui' &&
      workspaceForTemplate(template) === 'system_ui'
    ) {
      return false;
    }
    return true;
  }

  function templateMatchesExistingView(template) {
    if (!state.active || state.mode !== 'existing') {
      return false;
    }
    const existingTemplate = templateForExistingView(state.view);
    const nextTemplate = normalizeTemplate(template);
    return Boolean(existingTemplate && nextTemplate && existingTemplate === nextTemplate);
  }

  function templateForExistingView(view) {
    const value = String(view || '').trim();
    if (value === 'cards' || value === 'card' || value === 'advisors' || value === 'pinnedCards') {
      return 'card';
    }
    if (value === 'events' || value === 'event') {
      return 'event';
    }
    if (value === 'news') {
      return 'news';
    }
    if (value === 'surface' || value === 'surface_text' || value === 'surfaceText') {
      return 'surface';
    }
    return '';
  }

  function createModeIsActive(document) {
    return Boolean(document && document.body && document.body.dataset.mode === 'create');
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

  function resetProjectStateState() {
    state.projectStateQuery = '';
    state.projectStateLimit = PROJECT_STATE_ROW_LIMIT;
  }

  function resetStructureCommands() {
    state.structureCommands = [];
    state.structureCommandCounter = 0;
  }

  function shouldMaterializeNewEventDraft(values) {
    if (state.mode !== 'new_event' || state.template !== 'event') {
      return false;
    }
    if (state.structureCommands && state.structureCommands.length) {
      return true;
    }
    return Object.keys(values || {}).some((key) => {
      return /^structure_remove_/.test(String(key || '')) && truthyStructureValue(values[key]);
    });
  }

  function materializeNewEventDraft(model) {
    const draft = model && model.changeState && model.changeState.draft;
    if (!draft || state.mode !== 'new_event' || state.template !== 'event') {
      return model;
    }
    state.baseDraft = cloneDraft(draft);
    state.values = {};
    state.valueOriginals = {};
    resetStructureCommands();
    return buildTemplateModel({values: {}});
  }

  function truthyStructureValue(value) {
    return /^(1|true|yes|on)$/i.test(String(value || '').trim());
  }

  function resetTransientEditWorkspace(options) {
    const opts = options || {};
    state.mode = opts.mode || '';
    state.template = opts.template || opts.mode || '';
    state.view = opts.view || opts.mode || '';
    state.item = opts.item || null;
    state.workspace = opts.workspace || 'content';
    state.selectedCanvasNode = opts.selectedCanvasNode || opts.mode || 'object';
    resetStoryboardState();
    resetCardBoardState();
    resetRuntimeLens();
    resetProjectStateState();
    state.systemUiFixture = 'default';
    state.canvasPanX = 0;
    state.canvasPanY = 0;
    state.nodePositions = {};
    state.draftBranches = [];
    state.editorOverlay = Boolean(options && options.editorOverlay);
    state.deleteProposal = null;
    if (opts.activeModel !== 'source_slice') {
      state.sourceSliceModel = null;
      state.sourceSliceAdvancedConfirmed = false;
    }
    if (opts.activeModel !== 'semantic_logic') {
      state.semanticLogicModel = null;
      state.semanticLogicAdvancedConfirmed = false;
    }
    state.baseDraft = null;
    state.proposalOptions = null;
    state.values = {};
    state.valueOriginals = {};
    resetStructureCommands();
  }

  function openFromSelection(projectIndex, view, item, options) {
    templateClickToken += 1;
    reconcileToken += 1;
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
    resetRuntimeLens();
    resetProjectStateState();
    if (view === 'cards' && item) {
      state.cardBoardSelectedKey = 'card:' + item;
      state.selectedCanvasNode = state.cardBoardSelectedKey;
    }
    state.systemUiFixture = 'default';
    state.canvasPanX = 0;
    state.canvasPanY = 0;
    state.nodePositions = {};
    state.draftBranches = [];
    state.editorOverlay = Boolean(options && options.editorOverlay);
    state.deleteProposal = null;
    state.sourceSliceModel = null;
    state.sourceSliceAdvancedConfirmed = false;
    state.semanticLogicModel = null;
    state.semanticLogicAdvancedConfirmed = false;
    state.baseDraft = null;
    state.proposalOptions = options && options.proposalOptions || null;
    state.values = options && options.values || {};
    state.valueOriginals = {};
    clearTransientReturnStack();
    resetStructureCommands();
    state.model = buildExistingModel(options || {});
    state.active = true;
    state.status = state.model && state.model.ok
      ? t('objectCanvas.status.existingLoaded', 'Object Canvas opened for this existing object.')
      : t('existingScene.openFailed', 'This scene needs more source evidence before Studio can edit it here.');
    showWorkspace(view === 'cards' ? 'card' : 'existing');
    render();
    return Boolean(state.model && state.model.ok);
  }

  function openVisibleEditAction(projectIndex, action) {
    const editAction = action && action.editAction || action || {};
    const kind = String(editAction.actionKind || '');
    if (projectIndex) {
      state.projectIndex = projectIndex;
    }
    if (shouldKeepSemanticLogicActionInline(editAction)) {
      return openDraftEditAction(editAction);
    }
    if (shouldOpenStandaloneSemanticLogicAction(editAction) && !editAction.draftAction) {
      return openSemanticLogicAction(editAction);
    }
    if (kind === 'open_route_editor' || kind === 'open_effect_editor' || kind === 'open_profile_router_rule' || (editAction.draftAction && (kind === 'open_object_field' || kind === 'open_object_section' || kind === 'open_variable_editor'))) {
      return openDraftEditAction(editAction);
    }
    if (shouldOpenStandaloneSemanticLogicAction(editAction)) {
      return openSemanticLogicAction(editAction);
    }
    if (kind === 'open_object_field' || kind === 'open_object_section' || kind === 'open_linked_event') {
      return openFromSelection(state.projectIndex, editAction.targetView || 'events', editAction.targetId || '', {
        entry: {source: 'visible_edit_action', actionKind: kind},
        focus: editAction
      });
    }
    if (kind === 'open_variable_editor') {
      const draft = Object.assign({}, safeDefaultDraftForTemplate('variables'), {
        kind: 'variable_editor',
        mode: 'edit_existing',
        id: 'edit_' + String(editAction.targetId || 'variable').replace(/[^A-Za-z0-9_]+/g, '_'),
        title: 'Edit ' + String(editAction.targetId || 'variable'),
        variableName: String(editAction.targetId || ''),
        label: String(editAction.targetId || '')
      });
      return openTemplate('variables', draft, {source: 'visible_edit_action', actionKind: kind});
    }
    if (kind === 'open_system_ui_editor') {
      const template = normalizeTemplate(editAction.targetView || editAction.target && editAction.target.template || 'entry') || 'entry';
      return openTemplate(template, safeDefaultDraftForTemplate(template), {source: 'visible_edit_action', actionKind: kind});
    }
    if (kind === 'open_advanced_source_patch' && editAction.draftAction && !editAction.source) {
      state.status = t('objectCanvas.status.profileRouterRule', 'Router setup needs a profile rule or an advanced source anchor.');
      updateDynamicSurfaces();
      return true;
    }
    if (kind === 'open_source_slice' || kind === 'open_advanced_source_patch') {
      return openSourceSliceAction(editAction);
    }
    if (kind === 'open_profile_router_rule') {
      state.status = t('objectCanvas.status.profileRouterRule', 'Router setup needs a profile rule or an advanced source anchor.');
      updateDynamicSurfaces();
      return true;
    }
    return false;
  }

  function openDraftEditAction(editAction) {
    const action = editAction || {};
    const kind = String(action.actionKind || '');
    if (kind === 'open_variable_editor') {
      const draft = Object.assign({}, safeDefaultDraftForTemplate('variables'), {
        kind: 'variable_editor',
        mode: 'create_or_edit',
        id: 'edit_' + String(action.targetId || action.variableName || 'variable').replace(/[^A-Za-z0-9_]+/g, '_'),
        title: 'Edit ' + String(action.targetId || action.variableName || 'variable'),
        variableName: String(action.targetId || action.variableName || ''),
        label: String(action.targetId || action.variableName || '')
      });
      return openTemplate('variables', draft, {source: 'event_graph', actionKind: kind});
    }
    if (kind === 'open_profile_router_rule') {
      state.status = t('objectCanvas.status.profileRouterRule', 'Router setup needs a profile rule or an advanced source anchor.');
      updateDynamicSurfaces();
      return true;
    }
    const focused = focusDraftField(action.fieldId || action.valueKey || '');
    state.status = focused
      ? t('objectCanvas.status.graphEntryFocused', 'Opened the matching editor field.')
      : t('objectCanvas.status.graphEntryMissing', 'Studio could not find that editor field in this draft.');
    updateDynamicSurfaces();
    return focused;
  }

  function focusDraftField(fieldId) {
    const key = String(fieldId || '').trim();
    if (!key || !elements || !elements.host) {
      return false;
    }
    const field = elements.host.querySelector('[data-object-canvas-field="' + cssEscape(key) + '"]');
    if (!field) {
      return false;
    }
    if (typeof field.scrollIntoView === 'function') {
      field.scrollIntoView({block: 'center', inline: 'nearest'});
    }
    if (typeof field.focus === 'function') {
      field.focus();
    }
    if (typeof field.select === 'function' && /input|textarea/i.test(field.tagName || '')) {
      field.select();
    }
    return true;
  }

  function captureTransientReturnContext(editAction) {
    const stack = returnStackApi();
    if (!stack || typeof stack.capture !== 'function') {
      return null;
    }
    state.values = collectValues();
    return stack.capture(state, {
      label: transientReturnLabel(editAction),
      scrollSnapshot: captureObjectCanvasScroll(),
      focusSelector: transientFocusSelector(editAction)
    });
  }

  function pushTransientReturnContext(context) {
    const stack = returnStackApi();
    if (stack && typeof stack.push === 'function' && context) {
      stack.push(state, context);
    }
  }

  function clearTransientReturnStack() {
    const stack = returnStackApi();
    if (stack && typeof stack.clear === 'function') {
      stack.clear(state);
    } else {
      state.transientReturnStack = [];
    }
  }

  function transientReturnContext() {
    const stack = returnStackApi();
    return stack && typeof stack.peek === 'function' ? stack.peek(state) : null;
  }

  function transientReturnLabel(editAction) {
    const model = state.model || {};
    return String(
      model.title ||
      model.objectId ||
      editAction && (editAction.sceneTitle || editAction.targetTitle || editAction.targetId) ||
      state.item ||
      t('objectCanvas.titleFallback', 'Author object')
    ).trim();
  }

  function transientFocusSelector(editAction) {
    const key = editAction && (editAction.fieldId || editAction.valueKey);
    return key ? '[data-object-canvas-field="' + cssEscape(key) + '"]' : '';
  }

  function openSourceSliceAction(editAction) {
    const apiModel = sourceSliceApi();
    if (!apiModel || typeof apiModel.buildSourceSliceEditor !== 'function') {
      return false;
    }
    const sliceModel = apiModel.buildSourceSliceEditor(state.projectIndex, {editAction});
    if (!sliceModel || !sliceModel.ok) {
      state.sourceSliceModel = sliceModel || null;
      state.status = t('sourceSlice.status.mappingBug', 'Studio could not find the source position for this visible content.');
      updateDynamicSurfaces();
      return false;
    }
    const returnContext = captureTransientReturnContext(editAction);
    state.sourceSliceModel = sliceModel;
    state.sourceSliceAdvancedConfirmed = false;
    pushTransientReturnContext(returnContext);
    resetTransientEditWorkspace({
      mode: 'source_slice',
      item: sliceModel && sliceModel.targetId || null,
      selectedCanvasNode: 'source_slice',
      activeModel: 'source_slice'
    });
    state.model = buildSourceSliceCanvasModel(sliceModel, {});
    state.active = true;
    state.status = t('sourceSlice.status.prepared', 'Precise source edit opened for this visible content.');
    showWorkspace('source_slice');
    render();
    return Boolean(sliceModel && sliceModel.ok);
  }

  function shouldOpenSemanticLogicAction(editAction) {
    const editor = editAction && editAction.semanticEditor || null;
    const kind = String(editor && editor.kind || '');
    return kind === 'route_order' || kind === 'effect_clause';
  }

  function shouldOpenStandaloneSemanticLogicAction(editAction) {
    if (!shouldOpenSemanticLogicAction(editAction)) {
      return false;
    }
    return Boolean(editAction && (editAction.forceSemanticEditor || editAction.semanticEditorOpenMode === 'standalone'));
  }

  function shouldKeepSemanticLogicActionInline(editAction) {
    if (!shouldOpenSemanticLogicAction(editAction) || shouldOpenStandaloneSemanticLogicAction(editAction)) {
      return false;
    }
    const kind = String(editAction && editAction.actionKind || '');
    return kind === 'open_route_editor' || kind === 'open_effect_editor';
  }

  function openSemanticLogicAction(editAction) {
    const apiModel = semanticLogicApi();
    if (!apiModel || typeof apiModel.buildSemanticLogicEditor !== 'function') {
      return openSourceSliceAction(editAction);
    }
    const editorModel = apiModel.buildSemanticLogicEditor(state.projectIndex, {editAction});
    if (!editorModel || !editorModel.ok) {
      state.semanticLogicModel = editorModel || null;
      state.status = t('sourceSlice.status.mappingBug', 'Studio could not find the source position for this visible content.');
      updateDynamicSurfaces();
      return false;
    }
    const returnContext = captureTransientReturnContext(editAction);
    state.semanticLogicModel = editorModel;
    state.semanticLogicAdvancedConfirmed = false;
    pushTransientReturnContext(returnContext);
    resetTransientEditWorkspace({
      mode: 'semantic_logic',
      item: editorModel && editorModel.targetId || null,
      selectedCanvasNode: 'semantic_logic',
      activeModel: 'semantic_logic'
    });
    state.model = buildSemanticLogicCanvasModel(editorModel, {});
    state.active = true;
    state.status = t('semanticLogic.status.prepared', 'Semantic editor opened for this visible logic.');
    showWorkspace('semantic_logic');
    render();
    return Boolean(editorModel && editorModel.ok);
  }

  function openNewEvent(draft, meta) {
    return openTemplate('event', draft, meta);
  }

  function openTemplate(template, draft, meta) {
    const nextTemplate = normalizeTemplate(template) || templateFromDraft(draft) || 'event';
    if (nextTemplate === 'existing' && draft && (draft.kind === 'existing_scene_edit' || draft.sceneId && draft.changes)) {
      return loadDraft(draft, meta || {source: 'Create'});
    }
    state.template = nextTemplate;
    state.mode = nextTemplate === 'event' ? 'new_event' : nextTemplate;
    state.view = nextTemplate;
    state.item = null;
    state.workspace = workspaceForTemplate(nextTemplate);
    state.selectedCanvasNode = 'object';
    resetStoryboardState();
    resetCardBoardState();
    resetRuntimeLens();
    resetProjectStateState();
    state.systemUiFixture = 'default';
    state.canvasPanX = 0;
    state.canvasPanY = 0;
    state.nodePositions = {};
    state.draftBranches = [];
    state.editorOverlay = false;
    state.deleteProposal = null;
    state.sourceSliceModel = null;
    state.sourceSliceAdvancedConfirmed = false;
    state.semanticLogicModel = null;
    state.semanticLogicAdvancedConfirmed = false;
    state.baseDraft = draft || safeDefaultDraftForTemplate(nextTemplate);
    state.proposalOptions = null;
    clearTransientReturnStack();
    if (nextTemplate === 'card') {
      state.cardBoardSelectedKey = 'draft:card:' + (state.baseDraft && state.baseDraft.id || 'new_action_card');
      state.selectedCanvasNode = state.cardBoardSelectedKey;
    } else if (nextTemplate === 'variables' && state.baseDraft && state.baseDraft.variableName) {
      state.selectedCanvasNode = 'variable:' + state.baseDraft.variableName;
    }
    state.values = {};
    state.valueOriginals = {};
    resetStructureCommands();
    state.model = buildTemplateModel(meta || {});
    state.active = true;
    state.status = statusForTemplate(nextTemplate, meta);
    showWorkspace(nextTemplate);
    render();
    return Boolean(state.model && state.model.ok);
  }

  function openTemplateFromCreate(template, options) {
    const nextTemplate = normalizeTemplate(template) || 'event';
    const opts = options && typeof options === 'object' ? options : {};
    if (!opts.forceNew && templateMatchesExistingView(nextTemplate)) {
      showWorkspace(nextTemplate);
      return;
    }
    if (isCurrentTemplateRendered(nextTemplate)) {
      showWorkspace(nextTemplate);
      return;
    }
    openTemplate(nextTemplate, safeDefaultDraftForTemplate(nextTemplate), {source: 'Create'});
  }

  function syncTemplateButtonClick(template) {
    if (!createModeIsActive(global.document)) {
      return;
    }
    const nextTemplate = normalizeTemplate(template);
    if (!isCanvasTemplate(nextTemplate)) {
      return;
    }
    if (templateMatchesExistingView(nextTemplate)) {
      return;
    }
    openTemplateFromCreate(nextTemplate);
  }

  function activeTemplateFromDom(document) {
    const root = document.querySelector('[data-authoring-template-group].is-active') || document;
    const active = Array.from(root.querySelectorAll('[data-create-template].is-active'));
    const button = active.length ? active[active.length - 1] : document.querySelector('[data-create-template].is-active');
    return button && button.dataset.createTemplate || '';
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
    state.sourceSliceModel = null;
    state.sourceSliceAdvancedConfirmed = false;
    state.semanticLogicModel = null;
    state.semanticLogicAdvancedConfirmed = false;
    if (value.kind === 'existing_scene_delete') {
      const opened = openFromSelection(state.projectIndex, value.sceneKind === 'card' ? 'cards' : 'events', value.sceneId, {entry: meta});
      if (opened) {
        state.deleteProposal = objectDeleteProposalApi().normalizeProposal(value, state.model);
        state.model = buildDeleteProposalModel(state.deleteProposal);
        state.status = t('objectCanvas.status.deletePrepared', 'Delete proposal prepared for Review & Apply.');
        render();
      }
      return opened;
    }
    if (value.kind === 'existing_scene_edit' || value.sceneId && value.changes) {
      const contextApi = global.ProjectMapEditingContextModel;
      const values = contextApi && typeof contextApi.proposalValues === 'function'
        ? contextApi.proposalValues(value)
        : {};
      const opened = openFromSelection(state.projectIndex, value.sceneKind === 'card' ? 'cards' : 'events', value.sceneId, {
        values,
        entry: meta,
        proposalOptions: {
          id: value.id,
          assetInstallRequests: value.assetInstallRequests || []
        }
      });
      if (opened) { restoreAuthoringContext(value.studioAuthoringContext || value.authoringContext || {}, meta); } return opened;
    }
    const context = value.studioAuthoringContext || value.authoringContext || {};
    const ok = openTemplate(templateFromDraft(value) || meta && meta.template || 'event', value, meta || {source: 'Create'});
    if (ok) {
      restoreAuthoringContext(context, meta);
    }
    return ok;
  }

  function refresh(options) {
    if (!state.active) {
      return;
    }
    const opts = options || {};
    if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
    const scrollSnapshot = state.preserveScrollOnNextRefresh ? captureObjectCanvasScroll() : null;
    state.preserveScrollOnNextRefresh = false;
    if (!opts.preserveStateValues) {
      state.values = collectValues();
    }
    state.model = state.deleteProposal
      ? buildDeleteProposalModel(state.deleteProposal)
      : state.mode === 'source_slice'
      ? buildSourceSliceCanvasModel(state.sourceSliceModel, state.values)
      : state.mode === 'semantic_logic'
      ? buildSemanticLogicCanvasModel(state.semanticLogicModel, state.values)
      : state.mode === 'existing' ? buildExistingModel({values: state.values, proposalOptions: state.proposalOptions}) : buildTemplateModel({values: state.values});
    if (!state.deleteProposal && shouldMaterializeNewEventDraft(state.values)) {
      state.model = materializeNewEventDraft(state.model);
    }
    markRuntimeLensStale();
    const surface = currentSurface(state.model);
    if (surface.key === 'source_slice_editor' || surface.key === 'semantic_logic_editor' || surface.key === 'system_ui_preview' || surface.key === 'card_board' && !activeInsidePreviewObjectEditor() || shouldRenderSurfaceRefresh(surface)) {
      render({scrollSnapshot});
      return;
    }
    updateDynamicSurfaces();
    restoreObjectCanvasScroll(scrollSnapshot);
  }

  function buildExistingModel(options) {
    return buildExistingModelFor(state.view, state.item, withStructureCommandValues(options));
  }

  function buildExistingModelFor(view, item, options) {
    return modelBuilderApi().buildExistingModelFor(view, item, options, modelBuilderDeps());
  }

  function buildNewEventModel(options) {
    return modelBuilderApi().buildNewEventModel(options, modelBuilderDeps());
  }

  function buildTemplateModel(options) {
    return modelBuilderApi().buildTemplateModel(options, modelBuilderDeps());
  }

  function buildSourceSliceCanvasModel(sliceModel, values) {
    return modelBuilderApi().buildSourceSliceCanvasModel(sliceModel, values, modelBuilderDeps());
  }

  function buildSemanticLogicCanvasModel(editorModel, values) {
    return modelBuilderApi().buildSemanticLogicCanvasModel(editorModel, values, modelBuilderDeps());
  }

  function sourceSliceReplacementText(values) {
    const workspace = sourceSliceWorkspaceApi();
    return workspace && typeof workspace.replacementText === 'function'
      ? workspace.replacementText(values, state.sourceSliceModel)
      : state.sourceSliceModel && state.sourceSliceModel.currentText || '';
  }

  function withStructureCommandValues(options) {
    return modelBuilderApi().withStructureCommandValues(options, modelBuilderDeps());
  }

  function diagnosticModel(mode, template, objectId, err, options) {
    return modelBuilderApi().diagnosticModel(mode, template, objectId, err, options, modelBuilderDeps());
  }

  function modelBuilderDeps() {
    return {
      modelApi,
      projectIndex: state.projectIndex,
      baseDraft: state.baseDraft || {},
      template: state.template || 'event',
      sourceSliceWorkspaceApi,
      sourceSliceWorkspaceDeps,
      semanticLogicWorkspaceApi,
      semanticLogicWorkspaceDeps,
      state,
      structureCommands: state.structureCommands,
      t
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
    if (elements.createPane) {
      elements.createPane.classList.add('is-object-authoring');
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
    if (elements && elements.createPane) {
      elements.createPane.classList.remove('is-object-authoring');
    }
  }

  function activateCreateMode() {
    const create = global.document.querySelector('[data-mode="create"]');
    if (create && typeof create.click === 'function' && global.document.body.dataset.mode !== 'create') {
      create.click();
    }
  }

  function render(options) {
    if (!elements || !elements.host) {
      return;
    }
    const opts = options && typeof options === 'object' ? options : {};
    const scrollSnapshot = opts.scrollSnapshot || (opts.preserveScroll ? captureObjectCanvasScroll() : null);
    if (!state.active) {
      elements.host.hidden = true;
      if (elements.createPane) {
        elements.createPane.classList.remove('is-object-authoring');
      }
      return;
    }
    const model = state.model || {};
    const surface = currentSurface(model);
    const canRenderStage = model.ok || canRenderSurfaceWithDiagnostics(surface);
    let stageHtml = '';
    let stageError = null;
    if (canRenderStage) {
      try {
        stageHtml = renderCanvasStage(model);
      } catch (err) {
        stageError = err;
        recordRenderError(err, surface);
        stageHtml = renderStageError(surface, err);
      }
    }
    const layoutStyle = [
      '--object-canvas-sidebar-width: ' + clampAuthoringSidebarWidth(state.authoringSidebarWidth) + 'px',
      '--object-editor-preview-width: ' + clampObjectEditorPreviewWidth(state.objectEditorPreviewWidth) + 'px'
    ].join('; ');
    const shell = objectCanvasShellApi();
    const bodyHtml = stageError
      ? renderDiagnostics([{message: t('objectCanvas.renderFailed', 'Canvas render failed: {error}').replace('{error}', stageError && stageError.message ? stageError.message : String(stageError || 'unknown error'))}])
      : model.ok ? renderBody(model) : renderUnavailable(model);
    elements.host.innerHTML = shell.renderShell({
      model,
      surface,
      state,
      layoutStyle,
      stageHtml,
      modalHtml: renderObjectEditingModal(model, surface),
      bodyHtml,
      translate: t,
      surfaceLabelFor
    });
    bindCanvasEvents();
    updateDynamicSurfaces();
    restoreObjectCanvasScroll(scrollSnapshot);
  }

  function renderHeader(model, surface) {
    return objectCanvasShellApi().renderHeader(model, surface, state, {translate: t, surfaceLabelFor});
  }

  function renderBody(model) {
    return objectCanvasShellApi().renderBody(model, {translate: t});
  }

  function renderCanvasStage(model) {
    return withRuntimeLensRenderStatus(() => {
      const surface = currentSurface(model);
      if (surface.key === 'source_slice_editor') {
        return renderSourceSliceStage(model);
      }
      if (surface.key === 'semantic_logic_editor') {
        return renderSemanticLogicStage(model);
      }
      if (surface.key === 'project_state_board') {
        return renderProjectStateStage(model);
      }
      if (surface.key === 'card_board') {
        return renderCardBoardStage(model);
      }
      if (surface.key === 'system_ui_preview') {
        return renderSystemUiPreviewStage(model);
      }
      if (surface.key === 'election_results_board') {
        return renderElectionResultsStage(model);
      }
      if (surface.key === 'content_storyboard' || (state.workspace || 'content') === 'content') {
        return renderContentStoryboardStage(model);
      }
      const graph = graphStageApi();
      return graph && typeof graph.render === 'function'
        ? graph.render(model, {state, renderActions, renderChangePanel})
        : '';
    });
  }

  function withRuntimeLensRenderStatus(callback) {
    const originalStatus = state.runtimeLensStatus;
    if (state.runtimeLensEmbedsSuspended && state.runtimeLensSession && state.runtimeLensSession.ok) {
      state.runtimeLensStatus = 'suspended';
    }
    try {
      return callback();
    } finally {
      state.runtimeLensStatus = originalStatus;
    }
  }

  function canRenderSurfaceWithDiagnostics(surface) {
    return objectCanvasShellApi().canRenderSurfaceWithDiagnostics(surface);
  }

  function renderProjectStateStage(model) {
    const surface = global.ProjectMapProjectStateSurface;
    return surface && typeof surface.render === 'function' ? surface.render(model, {
      projectIndex: state.projectIndex,
      selected: state.selectedCanvasNode,
      query: state.projectStateQuery,
      limit: state.projectStateLimit,
      boardChromeCollapsed: state.boardChromeCollapsed
    }) : '';
  }

  function renderSystemUiPreviewStage(model) {
    const surface = global.ProjectMapSystemUiPreviewSurface;
    return surface && typeof surface.render === 'function' ? surface.render(model, {projectIndex: state.projectIndex, selected: state.selectedCanvasNode, fixture: state.systemUiFixture, editorOverlay: state.editorOverlay, boardChromeCollapsed: state.boardChromeCollapsed, runtimeLensSession: state.runtimeLensSession, runtimeLensStatus: state.runtimeLensStatus, runtimeLensFocusKey: state.runtimeLensFocusKey, runtimeLensDraftKey: state.runtimeLensDraftKey, runtimeLensCurrentDraftKey: state.runtimeLensCurrentDraftKey, runtimeLensExpanded: state.runtimeLensExpanded, runtimeLensCollapsed: state.runtimeLensCollapsed}) : '';
  }

  function renderElectionResultsStage(model) {
    const surface = global.ProjectMapElectionResultsSurface;
    return surface && typeof surface.render === 'function' ? surface.render(model, {
      projectIndex: state.projectIndex,
      selected: state.selectedCanvasNode,
      boardChromeCollapsed: state.boardChromeCollapsed
    }) : '';
  }

  function renderContentStoryboardStage(model) {
    const api = storyboardWorkspaceApi(); return api && typeof api.renderStage === 'function' ? api.renderStage(state, model) : '';
  }

  function renderCardBoardStage(model) {
    const api = cardWorkspaceApi(); return api && typeof api.renderStage === 'function' ? api.renderStage(state, model) : '';
  }

  function renderSourceSliceStage(model) {
    const workspace = sourceSliceWorkspaceApi();
    return workspace && typeof workspace.render === 'function'
      ? renderTransientReturnBar() + workspace.render(model, state, sourceSliceWorkspaceDeps())
      : '';
  }

  function renderSemanticLogicStage(model) {
    const workspace = semanticLogicWorkspaceApi();
    return workspace && typeof workspace.render === 'function'
      ? renderTransientReturnBar() + workspace.render(model, state, semanticLogicWorkspaceDeps())
      : '';
  }

  function renderTransientReturnBar() {
    const context = transientReturnContext();
    if (!context) {
      return '';
    }
    const label = context.label || t('objectCanvas.titleFallback', 'Author object');
    const button = t('objectCanvas.returnToObject', 'Back to: {label}').replace('{label}', label);
    return [
      '<div class="object-canvas-return-bar" data-object-canvas-return-bar="true">',
      '<button type="button" data-object-canvas-action="return_from_transient_workspace">' + escapeHtml(button) + '</button>',
      '<span>' + escapeHtml(t('objectCanvas.returnNotice', 'You are in an advanced source workspace; returning will restore the previous object editor.')) + '</span>',
      '</div>'
    ].join('');
  }

  function boardChromeCanCollapse(surface) {
    return objectCanvasShellApi().boardChromeCanCollapse(surface);
  }

  function previewEditorIsActive(surface) {
    return objectCanvasShellApi().previewEditorIsActive(surface);
  }

  function activeInsidePreviewObjectEditor() {
    if (!elements || !elements.host || !global.document) {
      return false;
    }
    const active = global.document.activeElement;
    return Boolean(active && elements.host.contains(active) && typeof active.closest === 'function' && active.closest('[data-preview-object-editor]'));
  }

  function shouldRenderSurfaceRefresh(surface) {
    const key = surface && surface.key || '';
    if (!elements || !elements.host) {
      return false;
    }
    const active = global.document && global.document.activeElement;
    if (key === 'election_results_board') {
      return Boolean(
        active &&
        elements.host.contains(active) &&
        active.dataset &&
        active.dataset.objectCanvasField === 'election.targetSceneId'
      );
    }
    if (key !== 'content_storyboard') {
      return false;
    }
    if (!active || !elements.host.contains(active) || typeof active.closest !== 'function') {
      return true;
    }
    if (active.closest('.preview-object-structure-delete')) {
      return true;
    }
    return !active.closest('[data-preview-object-editor]');
  }

  function renderObjectEditingModal(model, surface) {
    if (!state.editorOverlay || !previewEditorIsActive(surface)) {
      return '';
    }
    const editor = global.ProjectMapPreviewObjectEditor;
    if (editor && typeof editor.renderModal === 'function') {
      return editor.renderModal(model, {
        template: state.template,
        selectedKey: state.selectedCanvasNode,
        surface: surface && surface.key || '',
        previewExpanded: state.objectEditorPreviewExpanded
      });
    }
    return '';
  }

  function headerTitle(model, surface) {
    return surface && surface.key === 'election_results_board'
      ? t('create.electionResults', 'Election Results')
      : surface && surface.key === 'system_ui_preview'
      ? t('authoring.template.systemUiScreen', 'System UI Screen')
      : model && model.title || t('objectCanvas.titleFallback', 'Author object');
  }

  function displayCompactLabel(value) {
    const raw = String(value || '');
    const display = compactDendryInlineLabel(raw) || raw.trim();
    return display || raw;
  }

  function compactDendryInlineLabel(value) {
    const raw = String(value || '');
    if (!raw) {
      return '';
    }
    const conditionalPattern = /\[\?\s*if\s+[^:]+:\s*([\s\S]*?)\?\]/g;
    const matches = [];
    let match;
    while ((match = conditionalPattern.exec(raw)) !== null) {
      matches.push({index: match.index, text: cleanDisplayLabel(match[1]), raw: match[0]});
    }
    if (!matches.length) {
      return cleanDisplayLabel(raw);
    }
    const first = matches[0];
    const last = matches[matches.length - 1];
    const before = raw.slice(0, first.index);
    const after = raw.slice(last.index + last.raw.length);
    const onlyAdjacentConditionals = !cleanDisplayLabel(before) && matches.every((item, index) => {
      if (index === 0) {
        return true;
      }
      const previous = matches[index - 1];
      return !cleanDisplayLabel(raw.slice(previous.index + previous.raw.length, item.index));
    });
    const unique = uniqueNonEmpty(matches.map((item) => item.text));
    if (onlyAdjacentConditionals && unique.length > 1) {
      return cleanDisplayLabel([unique.join(' / '), after].filter(Boolean).join(' '));
    }
    return cleanDisplayLabel(raw.replace(conditionalPattern, (_token, body) => ' ' + cleanDisplayLabel(body) + ' '));
  }

  function cleanDisplayLabel(value) {
    return String(value || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\*\*/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function uniqueNonEmpty(values) {
    const seen = new Set();
    const result = [];
    ensureArray(values).forEach((value) => {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      result.push(text);
    });
    return result;
  }

  function renderUnavailable(model) {
    return objectCanvasShellApi().renderUnavailable(model, {translate: t});
  }

  function renderStageError(surface, err) {
    return objectCanvasShellApi().renderStageError(surface, err, {translate: t});
  }

  function recordRenderError(err, surface) {
    const row = {
      template: state.template || '',
      surface: surface && surface.key || '',
      message: err && err.message ? err.message : String(err || 'Unknown render error')
    };
    global.__DMS_OBJECT_CANVAS_ERRORS__ = (global.__DMS_OBJECT_CANVAS_ERRORS__ || []).concat(row).slice(-10);
    if (global.console && typeof global.console.error === 'function') {
      global.console.error('Object Canvas render failed:', row.message, err);
    }
  }

  function renderChangePanel(model) {
    return objectCanvasShellApi().renderChangePanel(model, {translate: t});
  }

  function renderPlanPreview(plan) {
    return objectCanvasShellApi().renderPlanPreview(plan, {translate: t});
  }

  function renderPlanOperation(operation) {
    return objectCanvasShellApi().renderPlanOperation(operation, {translate: t});
  }

  function renderDiagnostics(rows) {
    return objectCanvasShellApi().renderDiagnostics(rows, {translate: t});
  }

  function renderActions(model) {
    return objectCanvasShellApi().renderActions(model, {translate: t});
  }

  function bindCanvasEvents() {
    if (!elements || !elements.host) {
      return;
    }
    if (!elements.host.__dmsObjectCanvasActionDelegated) {
      elements.host.__dmsObjectCanvasActionDelegated = true;
      elements.host.addEventListener('click', (event) => {
        if (event.__dmsObjectCanvasHandled) {
          return;
        }
        const button = event.target && event.target.closest ? event.target.closest('[data-object-canvas-action]') : null;
        if (!button || !elements.host.contains(button)) {
          return;
        }
        handleAction(button.dataset.objectCanvasAction || '', button);
      });
    }
    if (!elements.host.__dmsObjectCanvasAssetDelegated) {
      elements.host.__dmsObjectCanvasAssetDelegated = true;
      elements.host.addEventListener('change', handleObjectCanvasAssetChange);
    }
    if (global.document && !global.document.__dmsObjectCanvasAssetDelegated) {
      global.document.__dmsObjectCanvasAssetDelegated = true;
      global.document.addEventListener('change', handleObjectCanvasAssetChange, true);
      global.document.addEventListener('input', handleObjectCanvasAssetChange, true);
    }
    elements.host.querySelectorAll('[data-object-canvas-action]').forEach((button) => {
      if (button.__dmsObjectCanvasActionBound) {
        return;
      }
      button.__dmsObjectCanvasActionBound = true;
      button.addEventListener('click', (event) => {
        event.__dmsObjectCanvasHandled = true;
        handleAction(button.dataset.objectCanvasAction || '', button);
      });
    });
    elements.host.querySelectorAll('[data-object-editing-modal]').forEach((backdrop) => {
      if (backdrop.__dmsObjectEditingModalBound) {
        return;
      }
      backdrop.__dmsObjectEditingModalBound = true;
      backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) {
          toggleEditorOverlay(false);
        }
      });
    });
    elements.host.querySelectorAll('[data-object-canvas-resizer]').forEach((resizer) => {
      if (resizer.__dmsObjectCanvasResizeBound) {
        return;
      }
      resizer.__dmsObjectCanvasResizeBound = true;
      resizer.addEventListener('pointerdown', beginPaneResize);
    });
    elements.host.querySelectorAll('[data-object-canvas-field]').forEach((input) => {
      input.addEventListener('input', scheduleRefresh);
      input.addEventListener('change', scheduleRefresh);
    });
    if (global.document && typeof global.document.querySelectorAll === 'function') {
      global.document.querySelectorAll('[data-object-canvas-asset-select], [data-object-canvas-asset-file]').forEach((control) => {
        if (control.__dmsObjectCanvasAssetBound) {
          return;
        }
        control.__dmsObjectCanvasAssetBound = true;
        control.addEventListener('change', handleObjectCanvasAssetChange);
      });
      global.document.querySelectorAll('[data-object-canvas-asset-filter]').forEach((control) => {
        if (control.__dmsObjectCanvasAssetFilterBound) {
          return;
        }
        control.__dmsObjectCanvasAssetFilterBound = true;
        control.addEventListener('input', () => filterObjectCanvasAssetSelect(control));
      });
    }
    const sourceSliceWorkspace = sourceSliceWorkspaceApi();
    if (sourceSliceWorkspace && typeof sourceSliceWorkspace.bind === 'function') {
      sourceSliceWorkspace.bind(elements.host, state, sourceSliceWorkspaceDeps());
    }
    const semanticLogicWorkspace = semanticLogicWorkspaceApi();
    if (semanticLogicWorkspace && typeof semanticLogicWorkspace.bind === 'function') {
      semanticLogicWorkspace.bind(elements.host, state, semanticLogicWorkspaceDeps());
    }
    bindVisibleEditUi(elements.host);
    elements.host.querySelectorAll('[data-preview-object-structure-part]').forEach((input) => {
      if (input.__dmsStructureBuilderBound) {
        return;
      }
      input.__dmsStructureBuilderBound = true;
      input.addEventListener('input', () => syncStructureBuilder(input.closest('[data-preview-object-structure-builder]')));
      input.addEventListener('change', () => syncStructureBuilder(input.closest('[data-preview-object-structure-builder]')));
    });
    elements.host.querySelectorAll('[data-project-state-variable-search]').forEach((input) => {
      input.addEventListener('input', () => scheduleProjectStateSearch(input));
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
    if (cardWorkspace && typeof cardWorkspace.bind === 'function' && elements.host.querySelector('[data-card-board-surface]')) {
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
    const runtimeLens = runtimeLensWorkspaceApi(); if (runtimeLens && typeof runtimeLens.bind === 'function') { runtimeLens.bind(elements.host, state, runtimeLensDeps()); }
    restoreProjectStateSearchFocus();
  }

  function scheduleRefresh(options) {
    state.preserveScrollOnNextRefresh = true;
    if (refreshTimer) { clearTimeout(refreshTimer); }
    refreshTimer = setTimeout(() => refresh(options || {}), 180);
  }

  function collectValuesForProgrammaticUpdate() {
    state.values = collectValues();
    if (!state.values || typeof state.values !== 'object') {
      state.values = {};
    }
    return state.values;
  }

  function refreshProgrammaticValues() {
    state.preserveScrollOnNextRefresh = true;
    refresh({preserveStateValues: true});
  }

  function handleObjectCanvasAssetChange(event) {
    const target = event && event.target;
    if (!target || event.__dmsObjectCanvasAssetHandled || !elements || !elements.host) {
      return;
    }
    const assetControl = target.closest && target.closest('[data-object-canvas-asset-select], [data-object-canvas-asset-file]');
    if (!assetControl) {
      return;
    }
    const insideHost = elements.host.contains(target);
    const insideObjectEditor = target.closest && target.closest('[data-preview-object-editor], [data-object-editing-preview-assets], [data-object-canvas-assets-panel]');
    if (!insideHost && !insideObjectEditor) {
      return;
    }
    event.__dmsObjectCanvasAssetHandled = true;
    const select = target.closest && target.closest('[data-object-canvas-asset-select]');
    if (select) {
      updateObjectCanvasAssetSelection(select);
      return;
    }
    const input = target.closest && target.closest('[data-object-canvas-asset-file]');
    if (input) {
      updateObjectCanvasAssetFile(input);
    }
  }

  function updateObjectCanvasAssetSelection(select) {
    if (select && select.dataset && select.dataset.objectCanvasAssetPlacementId) {
      updateDraftObjectCanvasAssetPlacementSelection(select);
      return;
    }
    if (select && select.dataset && select.dataset.existingAssetAddField) {
      updateExistingObjectCanvasAssetSelection(select);
      return;
    }
    const target = select.dataset.assetTarget === 'card' ? 'card' : 'event';
    const role = String(select.dataset.assetRole || '').trim();
    if (!role) {
      return;
    }
    const prefix = objectCanvasAssetValuePrefix(target);
    state.values = collectValuesForProgrammaticUpdate();
    if (select.value) {
      const ref = normalizeAssetReferenceForSource(parseStructuredAssetValue(select.value) || {path: select.value});
      state.values[prefix + 'assetRef.' + role] = JSON.stringify(Object.assign({}, ref, {role: ref.role || role}));
      state.status = t('objectCanvas.status.assetReferencePrepared', 'Asset reference prepared in Object Canvas.');
    } else {
      delete state.values[prefix + 'assetRef.' + role];
      delete state.values[prefix + 'assetInstallRequest.' + role];
      state.status = t('objectCanvas.status.assetReferenceCleared', 'Asset reference cleared in Object Canvas.');
    }
    refreshProgrammaticValues();
  }

  function filterObjectCanvasAssetSelect(input) {
    if (!input || !input.closest) {
      return;
    }
    const control = input.closest('.object-canvas-asset-picker-control');
    const select = control && control.querySelector && control.querySelector('select[data-object-canvas-asset-select]');
    if (!select || !select.options) {
      return;
    }
    const terms = String(input.value || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    const selectedValue = String(select.value || '');
    let matchCount = 0;
    Array.from(select.options).forEach((option, index) => {
      if (!option.value || index === 0) {
        option.hidden = false;
        option.disabled = false;
        return;
      }
      const haystack = String(option.dataset && option.dataset.assetSearchText || option.textContent || option.value || '').toLowerCase();
      const matches = !terms.length || terms.every((term) => haystack.includes(term));
      const keep = matches || Boolean(selectedValue && option.value === selectedValue);
      option.hidden = !keep;
      option.disabled = !keep;
      if (matches) {
        matchCount += 1;
      }
    });
    select.dataset.assetFilterActive = terms.length ? 'true' : 'false';
    control.dataset.assetFilterMatchCount = String(matchCount);
  }

  function updateObjectCanvasAssetFile(input) {
    if (input && input.dataset && input.dataset.objectCanvasAssetPlacementId) {
      updateDraftObjectCanvasAssetPlacementFile(input);
      return;
    }
    if (input && input.dataset && input.dataset.existingAssetField) {
      updateExistingObjectCanvasAssetFile(input);
      return;
    }
    if (input && input.dataset && input.dataset.existingAssetAddField) {
      updateExistingObjectCanvasAssetAddFile(input);
      return;
    }
    const file = input.files && input.files[0];
    const target = input.dataset.assetTarget === 'card' ? 'card' : 'event';
    const role = String(input.dataset.assetRole || '').trim();
    if (!file || !role) {
      return;
    }
    const request = objectCanvasAssetInstallRequestFromFile(file, target, role);
    const prefix = objectCanvasAssetValuePrefix(target);
    state.values = collectValuesForProgrammaticUpdate();
    state.values[prefix + 'assetInstallRequest.' + role] = JSON.stringify(request);
    state.values[prefix + 'assetRef.' + role] = JSON.stringify({
      path: request.targetPath,
      type: request.type,
      label: request.label || request.sourceName,
      role
    });
    state.status = t('objectCanvas.status.assetInstallPrepared', 'Asset install proposal prepared in Object Canvas.');
    input.value = '';
    refreshProgrammaticValues();
  }

  function updateDraftObjectCanvasAssetPlacementSelection(select) {
    const target = select.dataset.assetTarget === 'card' ? 'card' : 'event';
    const role = String(select.dataset.assetRole || '').trim();
    const placement = assetPlacementFromDataset(select.dataset, role);
    if (!role || !placement.placementId) {
      return;
    }
    const prefix = objectCanvasAssetValuePrefix(target);
    state.values = collectValuesForProgrammaticUpdate();
    if (!select.value) {
      delete state.values[prefix + 'assetPlacementRef.' + placement.placementId];
      delete state.values[prefix + 'assetPlacementInstallRequest.' + placement.placementId];
      state.status = t('objectCanvas.status.assetReferenceCleared', 'Asset reference cleared in Object Canvas.');
      refreshProgrammaticValues();
      return;
    }
    const ref = Object.assign({}, normalizeAssetReferenceForSource(parseStructuredAssetValue(select.value) || {}), placement, {role});
    state.values[prefix + 'assetPlacementRef.' + placement.placementId] = JSON.stringify(ref);
    state.status = t('objectCanvas.status.assetReferencePrepared', 'Asset reference prepared in Object Canvas.');
    refreshProgrammaticValues();
  }

  function updateDraftObjectCanvasAssetPlacementFile(input) {
    const file = input.files && input.files[0];
    const target = input.dataset.assetTarget === 'card' ? 'card' : 'event';
    const role = String(input.dataset.assetRole || '').trim();
    const placement = assetPlacementFromDataset(input.dataset, role);
    if (!file || !role || !placement.placementId) {
      return;
    }
    const request = Object.assign({}, objectCanvasAssetInstallRequestFromFile(file, target, role), placement, {role});
    const prefix = objectCanvasAssetValuePrefix(target);
    state.values = collectValuesForProgrammaticUpdate();
    state.values[prefix + 'assetPlacementInstallRequest.' + placement.placementId] = JSON.stringify(request);
    state.values[prefix + 'assetPlacementRef.' + placement.placementId] = JSON.stringify({
      path: request.targetPath,
      type: request.type,
      label: request.label || request.sourceName,
      role,
      directive: placement.directive,
      placementId: placement.placementId,
      placementKind: placement.placementKind,
      sectionId: placement.sectionId,
      optionId: placement.optionId,
      displayLocation: placement.displayLocation
    });
    state.status = t('objectCanvas.status.assetInstallPrepared', 'Asset install proposal prepared in Object Canvas.');
    input.value = '';
    refreshProgrammaticValues();
  }

  function assetPlacementFromDataset(dataset, role) {
    const data = dataset || {};
    return {
      placementId: String(data.objectCanvasAssetPlacementId || '').trim(),
      placementKind: String(data.assetPlacementKind || 'opening_visual').trim(),
      sectionId: String(data.assetSectionId || '').trim(),
      optionId: String(data.assetOptionId || '').trim(),
      directive: String(data.assetDirective || 'inline-image').trim(),
      displayLocation: String(data.assetDisplayLocation || '').trim(),
      role: String(role || data.assetRole || '').trim()
    };
  }

  function updateExistingObjectCanvasAssetFile(input) {
    const file = input.files && input.files[0];
    const target = input.dataset.assetTarget === 'card' ? 'card' : 'event';
    const role = String(input.dataset.assetRole || '').trim();
    const fieldId = String(input.dataset.existingAssetField || '').trim();
    const directive = String(input.dataset.assetDirective || '').trim();
    if (!file || !role || !fieldId || !directive) {
      return;
    }
    const request = objectCanvasAssetInstallRequestFromFile(file, target, role);
    state.values = collectValuesForProgrammaticUpdate();
    state.values[fieldId] = existingAssetReferenceLine({
      directive,
      targetPath: request.targetPath,
      label: request.label || request.sourceName,
      original: input.dataset.assetOriginal || '',
      currentPath: input.dataset.currentAssetPath || '',
      target,
      role
    });
    state.proposalOptions = state.proposalOptions && typeof state.proposalOptions === 'object'
      ? Object.assign({}, state.proposalOptions)
      : {};
    state.proposalOptions.assetInstallRequests = upsertObjectCanvasAssetInstallRequest(state.proposalOptions.assetInstallRequests, Object.assign({}, request, {
      role,
      directive,
      fieldId
    }));
    state.status = t('objectCanvas.status.assetReplacementPrepared', 'Asset replacement proposal prepared in Object Canvas.');
    input.value = '';
    refreshProgrammaticValues();
  }

  function updateExistingObjectCanvasAssetSelection(select) {
    const fieldId = String(select.dataset.existingAssetAddField || '').trim();
    const directive = String(select.dataset.assetDirective || '').trim();
    const target = select.dataset.assetTarget === 'card' ? 'card' : 'event';
    const role = String(select.dataset.assetRole || '').trim();
    if (!fieldId || !directive) {
      return;
    }
    state.values = collectValuesForProgrammaticUpdate();
    if (!select.value) {
      delete state.values[fieldId];
      state.proposalOptions = removeObjectCanvasAssetInstallRequestForField(state.proposalOptions, fieldId);
      state.status = t('objectCanvas.status.assetReferenceCleared', 'Asset reference cleared in Object Canvas.');
      refreshProgrammaticValues();
      return;
    }
    const ref = normalizeAssetReferenceForSource(parseStructuredAssetValue(select.value));
    const path = String(ref && (ref.path || ref.targetPath) || '').trim();
    if (!path) {
      return;
    }
    state.values[fieldId] = existingAssetReferenceLine({
      directive,
      targetPath: path,
      label: ref.label || ref.name || path,
      target,
      role
    });
    state.proposalOptions = removeObjectCanvasAssetInstallRequestForField(state.proposalOptions, fieldId);
    state.status = t('objectCanvas.status.assetReferencePrepared', 'Asset reference prepared in Object Canvas.');
    refreshProgrammaticValues();
  }

  function updateExistingObjectCanvasAssetAddFile(input) {
    const file = input.files && input.files[0];
    const target = input.dataset.assetTarget === 'card' ? 'card' : 'event';
    const role = String(input.dataset.assetRole || '').trim();
    const fieldId = String(input.dataset.existingAssetAddField || '').trim();
    const directive = String(input.dataset.assetDirective || '').trim();
    if (!file || !role || !fieldId || !directive) {
      return;
    }
    const request = objectCanvasAssetInstallRequestFromFile(file, target, role);
    state.values = collectValuesForProgrammaticUpdate();
    state.values[fieldId] = existingAssetReferenceLine({
      directive,
      targetPath: request.targetPath,
      label: request.label || request.sourceName,
      target,
      role
    });
    state.proposalOptions = state.proposalOptions && typeof state.proposalOptions === 'object'
      ? Object.assign({}, state.proposalOptions)
      : {};
    state.proposalOptions.assetInstallRequests = upsertObjectCanvasAssetInstallRequest(state.proposalOptions.assetInstallRequests, Object.assign({}, request, {
      role,
      directive,
      fieldId
    }));
    state.status = t('objectCanvas.status.assetInstallPrepared', 'Asset install proposal prepared in Object Canvas.');
    input.value = '';
    refreshProgrammaticValues();
  }

  function removeExistingAssetReference(target) {
    const fieldId = String(target && target.dataset && target.dataset.existingAssetField || '').trim();
    if (!fieldId) {
      return;
    }
    state.values = collectValuesForProgrammaticUpdate();
    if (Object.prototype.hasOwnProperty.call(state.values, fieldId) && !String(state.values[fieldId] || '').trim()) {
      delete state.values[fieldId];
      state.proposalOptions = removeObjectCanvasAssetInstallRequestForField(state.proposalOptions, fieldId);
      state.status = t('objectCanvas.status.assetReferenceCleared', 'Asset reference cleared in Object Canvas.');
      refreshProgrammaticValues();
      return;
    }
    state.values[fieldId] = '';
    state.proposalOptions = removeObjectCanvasAssetInstallRequestForField(state.proposalOptions, fieldId);
    state.status = t('objectCanvas.status.assetRemovalPrepared', 'Asset removal proposal prepared in Object Canvas.');
    refreshProgrammaticValues();
  }

  function clearExistingAssetAddition(target) {
    const fieldId = String(target && target.dataset && target.dataset.existingAssetAddField || '').trim();
    if (!fieldId) {
      return;
    }
    state.values = collectValuesForProgrammaticUpdate();
    delete state.values[fieldId];
    state.proposalOptions = removeObjectCanvasAssetInstallRequestForField(state.proposalOptions, fieldId);
    state.status = t('objectCanvas.status.assetReferenceCleared', 'Asset reference cleared in Object Canvas.');
    refreshProgrammaticValues();
  }

  function existingAssetReferenceLine(options) {
    const opts = options || {};
    const directive = String(opts.directive || '').trim();
    const targetPath = sourceReferencePathForAsset(opts.targetPath || '');
    if (!targetPath) {
      return '';
    }
    if (directive === 'inline-image' || directive === 'inline-asset') {
      const original = String(opts.original || '');
      const currentPath = String(opts.currentPath || '').trim();
      if (original && currentPath && original.includes(currentPath)) {
        return original.replace(currentPath, targetPath);
      }
      const target = opts.target === 'card' ? 'card' : 'event';
      if (target === 'card') {
        return 'card-image: ' + targetPath;
      }
      if (String(opts.role || '').trim() === 'event_illustration') {
        return 'face-image: ' + targetPath;
      }
      const label = String(opts.label || '').trim().replace(/[\]\r\n]/g, ' ');
      return '![' + label + '](' + targetPath + ')';
    }
    return directive + ': ' + targetPath;
  }

  function upsertObjectCanvasAssetInstallRequest(requests, request) {
    const next = [];
    const fieldId = String(request && request.fieldId || '').trim();
    const role = String(request && request.role || '').trim();
    ensureArray(requests).forEach((item) => {
      const itemFieldId = String(item && item.fieldId || '').trim();
      const itemRole = String(item && item.role || '').trim();
      if (fieldId && itemFieldId && itemFieldId === fieldId) {
        return;
      }
      if (!fieldId && role && itemRole === role) {
        return;
      }
      next.push(item);
    });
    next.push(request);
    return next;
  }

  function removeObjectCanvasAssetInstallRequestForField(options, fieldId) {
    if (!options || typeof options !== 'object') {
      return options;
    }
    const next = Object.assign({}, options);
    next.assetInstallRequests = ensureArray(next.assetInstallRequests).filter((request) => {
      return String(request && request.fieldId || '') !== String(fieldId || '');
    });
    return next;
  }

  function parseStructuredAssetValue(value) {
    const text = String(value || '').trim();
    if (!text) {
      return null;
    }
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_err) {
      return {path: text};
    }
  }

  function normalizeAssetReferenceForSource(value) {
    if (!value || typeof value !== 'object') {
      return value;
    }
    const next = Object.assign({}, value);
    if (next.path) {
      next.path = sourceReferencePathForAsset(next.path);
    }
    if (next.targetPath) {
      next.targetPath = sourceReferencePathForAsset(next.targetPath);
    }
    return next;
  }

  function sourceReferencePathForAsset(value) {
    const path = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
    return path.replace(/^out\/html\//i, '');
  }

  function objectCanvasAssetInstallRequestFromFile(file, target, role) {
    const type = objectCanvasAssetType(file, role);
    const draft = state.model && state.model.changeState && state.model.changeState.draft || state.baseDraft || {};
    const draftId = state.mode === 'existing' && state.model && state.model.objectId
      ? state.model.objectId
      : draft && draft.id;
    const api = assetModelApi();
    const targetPath = api && typeof api.suggestAssetTargetPath === 'function'
      ? api.suggestAssetTargetPath({name: file && file.name, type}, {target, draftId, role})
      : fallbackObjectCanvasAssetTargetPath(file && file.name, type, target, draftId);
    const input = {
      sourceName: file && file.name || '',
      sourcePath: file && file.path || '',
      targetPath,
      type,
      label: file && file.name || '',
      role,
      sourceSize: file && file.size,
      sourceLastModified: file && file.lastModified
    };
    return api && typeof api.assetInstallRequest === 'function'
      ? api.assetInstallRequest(input, {target, draftId: draft && draft.id, role})
      : input;
  }

  function objectCanvasAssetType(file, role) {
    const name = String(file && file.name || '').toLowerCase();
    if (/audio/.test(String(role || '')) || /\.(mp3|ogg|wav|flac|m4a)$/.test(name)) {
      return 'audio';
    }
    if (/\.(png|jpe?g|gif|webp|svg)$/.test(name)) {
      return 'image';
    }
    return 'asset';
  }

  function fallbackObjectCanvasAssetTargetPath(name, type, target, draftId) {
    const lane = target === 'card' ? 'cards' : 'events';
    const draft = String(draftId || target || 'draft')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'draft';
    const fileName = String(objectCanvasFileName(name) || (type === 'audio' ? 'asset.ogg' : 'asset.png'))
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-+|-+$/g, '') || (type === 'audio' ? 'asset.ogg' : 'asset.png');
    return 'assets/studio/' + lane + '/' + draft + '/' + fileName;
  }

  function objectCanvasFileName(path) {
    return String(path || '').replace(/\\/g, '/').split('/').filter(Boolean).pop() || '';
  }

  function objectCanvasAssetValuePrefix(target) {
    return target === 'card' ? 'card.' : 'event.';
  }

  function scheduleProjectStateSearch(input) {
    if (!input) {
      return;
    }
    if (projectStateSearchTimer) {
      clearTimeout(projectStateSearchTimer);
    }
    const value = String(input.value || '');
    const start = typeof input.selectionStart === 'number' ? input.selectionStart : value.length;
    const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
    projectStateSearchTimer = setTimeout(() => {
      projectStateSearchTimer = null;
      state.projectStateQuery = value;
      state.projectStateLimit = PROJECT_STATE_ROW_LIMIT;
      projectStateSearchFocus = {start, end};
      render();
    }, PROJECT_STATE_SEARCH_DEBOUNCE_MS);
  }

  function sourceSliceReviewAllowed() {
    if (state.mode !== 'source_slice' || !state.sourceSliceModel) {
      return true;
    }
    const workspace = sourceSliceWorkspaceApi();
    return workspace && typeof workspace.reviewAllowed === 'function'
      ? workspace.reviewAllowed(state)
      : false;
  }

  function sourceSliceBlockedStatus() {
    if (state.mode !== 'source_slice') {
      return t('sourceSlice.status.advancedRequired', 'Enable advanced apply before reviewing this protected source edit.');
    }
    const changed = Number(state.model && state.model.changeState && state.model.changeState.changedCount || 0) > 0;
    if (!changed) {
      return t('sourceSlice.status.noChanges', 'Make a change before sending this edit to Review & Apply.');
    }
    return t('sourceSlice.status.advancedRequired', 'Enable advanced apply before reviewing this protected source edit.');
  }

  function semanticLogicReviewAllowed() {
    if (state.mode !== 'semantic_logic' || !state.semanticLogicModel) {
      return true;
    }
    const workspace = semanticLogicWorkspaceApi();
    return workspace && typeof workspace.reviewAllowed === 'function'
      ? workspace.reviewAllowed(state)
      : false;
  }

  function semanticLogicBlockedStatus() {
    if (state.mode !== 'semantic_logic') {
      return t('semanticLogic.status.advancedRequired', 'Enable advanced apply before reviewing this semantic source edit.');
    }
    const changed = Number(state.model && state.model.changeState && state.model.changeState.changedCount || 0) > 0;
    if (!changed) {
      return t('semanticLogic.status.noChanges', 'Make a route or effect change before sending this edit to Review & Apply.');
    }
    return t('semanticLogic.status.advancedRequired', 'Enable advanced apply before reviewing this semantic source edit.');
  }

  function eventReadinessReviewAllowed() {
    if (state.mode !== 'new_event') {
      return true;
    }
    const rows = ensureArray(state.model && state.model.eventBody && state.model.eventBody.readinessChecklist);
    return !rows.length || rows.every((row) => row && row.ok);
  }

  function eventReadinessBlockedStatus() {
    const blocked = ensureArray(state.model && state.model.eventBody && state.model.eventBody.readinessChecklist)
      .filter((row) => row && !row.ok)
      .map((row) => row.label || row.id)
      .filter(Boolean);
    return blocked.length
      ? t('objectCanvas.status.readinessBlocked', 'Finish blocked checklist items before Review & Apply: {items}').replace('{items}', blocked.slice(0, 3).join('; '))
      : t('objectCanvas.status.readinessBlockedGeneric', 'Finish the event checklist before Review & Apply.');
  }

  function restoreProjectStateSearchFocus() {
    if (!projectStateSearchFocus || !elements || !elements.host) {
      projectStateSearchFocus = null;
      return;
    }
    const input = elements.host.querySelector('[data-project-state-variable-search]');
    const focus = projectStateSearchFocus;
    projectStateSearchFocus = null;
    if (!input || typeof input.focus !== 'function') {
      return;
    }
    input.focus();
    if (typeof input.setSelectionRange === 'function') {
      try {
        input.setSelectionRange(focus.start, focus.end);
      } catch (_err) {
        // Search focus restoration is a convenience; unsupported inputs can ignore it.
      }
    }
  }

  function selectCanvasNode(nodeKey) {
    const next = String(nodeKey || 'object').trim() || 'object';
    if (fastSelectProjectStateNode(next)) {
      return;
    }
    if (openProjectStateVariableFromCanvas(next)) {
      return;
    }
    state.values = collectValues();
    state.deleteProposal = null;
    state.sourceSliceModel = null;
    state.sourceSliceAdvancedConfirmed = false;
    state.semanticLogicModel = null;
    state.semanticLogicAdvancedConfirmed = false;
    if (switchSystemUiTemplateForRegion(next)) {
      return;
    }
    const cardWorkspace = cardWorkspaceApi();
    if (cardWorkspace && typeof cardWorkspace.selectCard === 'function' && elements.host.querySelector('[data-card-board-surface]') && cardWorkspace.selectCard(state, next, cardDeps())) {
      return;
    }
    const storyboard = storyboardWorkspaceApi();
    if (storyboard && typeof storyboard.selectObject === 'function' && storyboard.selectObject(state, next, storyboardDeps())) {
      return;
    }
    state.model = state.mode === 'existing' ? buildExistingModel({values: state.values, proposalOptions: state.proposalOptions}) : buildTemplateModel({values: state.values});
    state.selectedCanvasNode = next;
    markRuntimeLensStale();
    render();
  }

  function fastSelectProjectStateNode(next) {
    return projectStateWorkspaceApi().fastSelectNode(state, next, projectStateWorkspaceDeps());
  }

  function openProjectStateVariableFromCanvas(next) {
    return projectStateWorkspaceApi().openVariableFromCanvas(state, next, projectStateWorkspaceDeps());
  }

  function findProjectStateVariable(name) {
    return projectStateWorkspaceApi().findVariable(state, name, projectStateWorkspaceDeps());
  }

  function syncProjectStateVariableSelection() {
    return projectStateWorkspaceApi().syncVariableSelection(state, projectStateWorkspaceDeps());
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
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      refresh();
      state.status = t('objectCanvas.status.refreshed', 'Object Canvas refreshed.');
      updateDynamicSurfaces();
    } else if (action === 'save') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      refresh();
      const save = global.document.getElementById('draft-workspace-save');
      if (save && typeof save.click === 'function') {
        save.click();
        state.status = t('editing.status.saved', 'Sent to My Changes.');
      }
      updateDynamicSurfaces();
    } else if (action === 'review') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      if (state.mode === 'source_slice' || state.mode === 'semantic_logic') {
        refresh();
      }
      if (!sourceSliceReviewAllowed()) {
        state.status = sourceSliceBlockedStatus();
        updateDynamicSurfaces();
        return;
      }
      if (!semanticLogicReviewAllowed()) {
        state.status = semanticLogicBlockedStatus();
        updateDynamicSurfaces();
        return;
      }
      if (!eventReadinessReviewAllowed()) {
        state.status = eventReadinessBlockedStatus();
        updateDynamicSurfaces();
        return;
      }
      reviewCurrentPlan();
    } else if (action === 'create_similar_event') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      createSimilarEventDraft();
    } else if (action === 'legacy_form') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      openLegacyForm();
    } else if (action === 'toggle_overlay') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      toggleEditorOverlay();
    } else if (action === 'toggle_preview_expanded') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      toggleObjectEditorPreviewExpanded();
    } else if (action === 'return_from_transient_workspace') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      returnFromTransientWorkspace();
      return;
    } else if (action === 'commit_structure_command') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      commitStructureCommand(target);
    } else if (action === 'toggle_board_chrome') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      toggleBoardChrome();
    } else if (action === 'delete_current_object') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      handleDeleteCurrentObject(target);
      return;
    } else if (action === 'remove_asset_reference') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      removeExistingAssetReference(target);
      return;
    } else if (action === 'clear_asset_addition') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      clearExistingAssetAddition(target);
      return;
    } else if (action === 'create_election_event') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      openElectionEventDraft(relatedDraftContext(target));
      return;
    } else if (action === 'open_selected_election_event') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      openSelectedElectionEvent();
      return;
    } else if (handleProjectStateAction(action)) {
      return;
    } else if (handleCardBoardAction(action, target)) {
      return;
    } else if (action === 'discard_draft_card') {
      discardDraftCard(target);
      return;
    } else if (handleStoryboardAction(action, target)) {
      return;
    } else if (action.indexOf('create_') === 0) {
      createRelatedDraft(action.replace('create_', ''), target);
    }
  }

  function createSimilarEventDraft() {
    const sceneId = state.model && (state.model.objectId || state.model.sceneId);
    const parsedApi = parsedToDraftApi();
    const sourceView = normalizeParsedDraftView(state.model && (state.model.objectView || state.view || state.model.objectKind));
    if (parsedApi && typeof parsedApi.buildDraftFromParsed === 'function' && sceneId) {
      const result = parsedApi.buildDraftFromParsed(state.projectIndex, {
        view: sourceView,
        itemId: sceneId,
        sourceEntry: 'object_canvas_create_similar'
      });
      if (result && result.ok && result.draft) {
        openTemplate(result.template || templateForParsedView(sourceView), result.draft, {
          source: 'Create similar object',
          action: 'create_similar_event',
          parsedToDraft: result
        });
        state.status = result.status === 'partial'
          ? t('objectCanvas.status.createSimilarPartialOpened', 'Similar draft opened with a parity gate; Review & Apply is blocked until missing structure is handled.')
          : t('objectCanvas.status.createSimilarOpened', 'Similar draft opened.');
        updateDynamicSurfaces();
        return true;
      }
    }
    const api = global.ProjectMapEventDraft;
    if (!api || typeof api.fromExistingScene !== 'function' || !sceneId) {
      state.status = t('objectCanvas.status.createSimilarUnavailable', 'Studio could not build a new draft from this object.');
      updateDynamicSurfaces();
      return false;
    }
    const draft = api.fromExistingScene(state.projectIndex, sceneId);
    openTemplate('event', draft, {source: 'Create similar event', action: 'create_similar_event'});
    state.status = t('objectCanvas.status.createSimilarOpened', 'Similar draft opened.');
    updateDynamicSurfaces();
    return true;
  }

  function normalizeParsedDraftView(view) {
    const text = String(view || '').trim();
    if (text === 'card' || text === 'cards') {
      return 'cards';
    }
    if (text === 'news') {
      return 'news';
    }
    return 'events';
  }

  function templateForParsedView(view) {
    return view === 'cards' ? 'card' : view === 'news' ? 'news' : 'event';
  }

  function handleDeleteCurrentObject(target) {
    if (state.mode !== 'existing') {
      discardCurrentDraftObject(target);
      return;
    }
    if (!state.model || !state.model.objectId) {
      state.status = t('objectCanvas.status.deleteUnavailable', 'Select an existing event before deleting.');
      updateDynamicSurfaces();
      return;
    }
    state.deleteProposal = buildDeleteProposal(state.model);
    state.values = {};
    state.valueOriginals = {};
    resetStructureCommands();
    state.model = buildDeleteProposalModel(state.deleteProposal);
    state.editorOverlay = true;
    state.status = t('objectCanvas.status.deletePrepared', 'Delete proposal prepared for Review & Apply.');
    render();
  }

  function discardCurrentDraftObject(target) {
    if (target && target.dataset && target.dataset.storyboardDraftKey) {
      discardDraftCard(target);
      return;
    }
    const currentKey = currentDraftStoryboardKey();
    if (currentKey) {
      state.draftBranches = draftBranchList().filter((branch) => !draftBranchKeyMatches(branch, currentKey));
    }
    const context = state.baseDraft && state.baseDraft.studioAuthoringContext || {};
    const previousKey = String(context.selectedCanvasNode || '').trim();
    if (previousKey && selectExistingStoryObject(previousKey)) {
      state.status = t('objectCanvas.status.draftDeleted', 'Draft card discarded.');
      render();
      return;
    }
    openTemplate('event', safeDefaultDraftForTemplate('event'), {source: 'Create'});
    state.status = t('objectCanvas.status.draftDeleted', 'Draft card discarded.');
    render();
  }

  function buildDeleteProposal(model) {
    return objectDeleteProposalApi().buildProposal({
      model,
      item: state.item,
      selectedCanvasNode: state.selectedCanvasNode,
      view: state.view,
      projectIndex: state.projectIndex
    });
  }

  function buildDeleteProposalModel(proposalInput) {
    return objectDeleteProposalApi().buildModel({
      proposal: proposalInput,
      model: state.model,
      projectIndex: state.projectIndex,
      installPlanApi: installPlanApi(),
      locale: currentLocale(),
      translate: t
    });
  }

  function handleProjectStateAction(action) {
    return projectStateWorkspaceApi().handleAction(state, action, projectStateWorkspaceDeps());
  }

  function openVariableDraft(draft, statusKey, selectedNode) {
    return projectStateWorkspaceApi().openVariableDraft(state, draft, statusKey, selectedNode, projectStateWorkspaceDeps());
  }

  function selectedProjectStateVariable() {
    return projectStateWorkspaceApi().selectedVariable(state, projectStateWorkspaceDeps());
  }

  function selectedProjectStateVariableName() {
    return projectStateWorkspaceApi().selectedVariableName(state);
  }

  function newVariableDraft() {
    return projectStateWorkspaceApi().newVariableDraft(state, projectStateWorkspaceDeps());
  }

  function selectedNodeForVariableDraft(draft) {
    return projectStateWorkspaceApi().selectedNodeForVariableDraft(draft);
  }

  function nextAvailableVariableName(baseName) {
    return projectStateWorkspaceApi().nextAvailableVariableName(state, baseName, projectStateWorkspaceDeps());
  }

  function labelFromVariableName(name) {
    return projectStateWorkspaceApi().labelFromVariableName(name);
  }

  function editVariableDraft(variable) {
    return projectStateWorkspaceApi().editVariableDraft(state, variable, projectStateWorkspaceDeps());
  }

  function deleteVariableDraft(variable) {
    return projectStateWorkspaceApi().deleteVariableDraft(state, variable, projectStateWorkspaceDeps());
  }

  function safeDraftId(value) {
    return projectStateWorkspaceApi().safeDraftId(value);
  }

  function projectStateWorkspaceDeps() {
    return {
      buildTemplateModel,
      currentSurface,
      elements,
      ensureArray,
      global,
      projectStateRowLimit: PROJECT_STATE_ROW_LIMIT,
      render,
      resetRuntimeLens,
      resetStructureCommands,
      setProjectStateSearchFocus,
      showWorkspace,
      t,
      updateDynamicSurfaces,
      variableEditorDraft: global.ProjectMapVariableEditorDraft,
      projectStateSurface: global.ProjectMapProjectStateSurface
    };
  }

  function setProjectStateSearchFocus(value) {
    projectStateSearchFocus = value;
  }

  function resetRuntimeLens() {
    const api = runtimeLensWorkspaceApi();
    if (api && typeof api.reset === 'function') {
      api.reset(state);
      return;
    }
    state.runtimeLensSession = null;
    state.runtimeLensStatus = 'idle';
    state.runtimeLensFocusKey = '';
    state.runtimeLensDraftKey = ''; state.runtimeLensCurrentDraftKey = '';
    state.runtimeLensExpanded = false; state.runtimeLensCollapsed = false;
    state.runtimeLensEmbedsSuspended = false;
  }

  function markRuntimeLensStale() { const api = runtimeLensWorkspaceApi(); if (api && typeof api.markStale === 'function') { api.markStale(state); } }

  function handleCardBoardAction(action, target) {
    const api = cardWorkspaceApi();
    return action === 'open_card_board' && Boolean(api && typeof api.openFromSystemRegion === 'function' && api.openFromSystemRegion(state, target, cardDeps({source: 'System UI'})));
  }

  function handleStoryboardAction(action, target) {
    const api = storyboardWorkspaceApi(); return Boolean(api && typeof api.handleAction === 'function' && api.handleAction(state, action, target, storyboardDeps()));
  }

  function createRelatedDraft(action, target) {
    return storyboardDraftsApi().createRelatedDraft(state, action, target, storyboardDraftDeps());
  }

  function relatedDraftContext(target) {
    return storyboardDraftsApi().relatedDraftContext(state, target);
  }

  function openRelatedEventDraft(branch, context, action) {
    return storyboardDraftsApi().openRelatedEventDraft(state, branch, context, action, storyboardDraftDeps());
  }

  function openRelatedTemplateDraft(branch, context, action) {
    return storyboardDraftsApi().openRelatedTemplateDraft(state, branch, context, action, storyboardDraftDeps());
  }

  function relatedCardDraft(branch, context, action) {
    return storyboardDraftsApi().relatedCardDraft(state, branch, context, action, storyboardDraftDeps());
  }

  function relatedNewsDraft(branch, context, action) {
    return storyboardDraftsApi().relatedNewsDraft(state, branch, context, action, storyboardDraftDeps());
  }

  function relatedSourceTitle() {
    return storyboardDraftsApi().relatedSourceTitle(state);
  }

  function relatedTitle(prefix, sourceTitle) {
    return storyboardDraftsApi().relatedTitle(prefix, sourceTitle);
  }

  function relatedDescription(fallback, sourceTitle) {
    return storyboardDraftsApi().relatedDescription(fallback, sourceTitle);
  }

  function openStandaloneEventDraft(context) {
    return storyboardDraftsApi().openStandaloneEventDraft(state, context, storyboardDraftDeps());
  }

  function openElectionEventDraft(context) {
    return storyboardDraftsApi().openElectionEventDraft(state, context, storyboardDraftDeps());
  }

  function openSelectedElectionEvent() {
    state.values = collectValues();
    state.model = buildTemplateModel({values: state.values});
    const draft = state.model && state.model.changeState && state.model.changeState.draft || {};
    const sourceRow = ensureArray(draft.electionEvents).find((row) => row && String(row.id || '') === String(draft.targetSceneId || '')) || null;
    const sceneId = String(sourceRow && sourceRow.sceneId || draft.targetSceneId || '').trim();
    if (!sceneId) {
      state.status = t('electionResults.status.noSourceEvent', 'Choose an election source event first.');
      render();
      return false;
    }
    const opened = openFromSelection(state.projectIndex, 'events', sceneId, {
      entry: {
        source: 'Election Results',
        action: 'open_selected_election_event',
        selectedCanvasNode: sceneId
      }
    });
    state.status = opened
      ? t('electionResults.status.sourceOpened', 'Opened the selected election source in the Event editor.')
      : t('electionResults.status.sourceOpenFailed', 'This election source needs more source evidence before Studio can edit it here.');
    render();
    return opened;
  }

  function restoreStoryboardContextAfterDraftOpen(context, draft, branch) {
    return storyboardDraftsApi().restoreStoryboardContextAfterDraftOpen(state, context, draft, branch, storyboardDraftDeps());
  }

  function standaloneEventDraft(context) {
    return storyboardDraftsApi().standaloneEventDraft(state, context, storyboardDraftDeps());
  }

  function electionEventDraft(context) {
    return storyboardDraftsApi().electionEventDraft(state, context, storyboardDraftDeps());
  }

  function cloneDraft(value) {
    return storyboardDraftsApi().cloneDraft(value);
  }

  function insertYearFromKey(value) {
    return storyboardDraftsApi().insertYearFromKey(value);
  }

  function draftYear(draft) {
    return storyboardDraftsApi().draftYear(draft);
  }

  function uniqueDraftId(baseId) {
    return storyboardDraftsApi().uniqueDraftId(state, baseId, storyboardDraftDeps());
  }

  function numberOr(value, fallback) {
    return storyboardDraftsApi().numberOr(value, fallback);
  }

  function discardDraftCard(target) {
    return storyboardDraftsApi().discardDraftCard(state, target, storyboardDraftDeps());
  }

  function selectExistingStoryObject(key) {
    return storyboardDraftsApi().selectExistingStoryObject(state, key, storyboardDraftDeps());
  }

  function storyObjectFromKey(key) {
    return storyboardDraftsApi().storyObjectFromKey(key);
  }

  function currentDraftStoryboardKey() {
    return storyboardDraftsApi().currentDraftStoryboardKey(state, storyboardDraftDeps());
  }

  function draftStoryboardKey(template, draft, branch) {
    return storyboardDraftsApi().draftStoryboardKey(template, draft, branch, storyboardDraftDeps());
  }

  function draftBranchList() {
    return storyboardDraftsApi().draftBranchList(state);
  }

  function draftBranchMatches(a, b) {
    return storyboardDraftsApi().draftBranchMatches(a, b);
  }

  function draftBranchKeyMatches(branch, key) {
    return storyboardDraftsApi().draftBranchKeyMatches(branch, key);
  }

  function branchId(branch) {
    return storyboardDraftsApi().branchId(branch);
  }

  function normalizeStoryCanvasCategory(value) {
    return storyboardDraftsApi().normalizeStoryCanvasCategory(value);
  }

  function normalizeStoryDepth(value) {
    return storyboardDraftsApi().normalizeStoryDepth(value);
  }

  function toggleEditorOverlay(next) {
    state.editorOverlay = next === undefined ? !state.editorOverlay : Boolean(next);
    state.values = collectValues();
    state.model = state.mode === 'existing' ? buildExistingModel({values: state.values, proposalOptions: state.proposalOptions}) : buildTemplateModel({values: state.values});
    render();
  }

  function toggleBoardChrome(next) {
    state.boardChromeCollapsed = next === undefined ? !state.boardChromeCollapsed : Boolean(next);
    render();
  }

  function toggleObjectEditorPreviewExpanded(next) {
    state.objectEditorPreviewExpanded = next === undefined ? !state.objectEditorPreviewExpanded : Boolean(next);
    render();
  }

  function returnFromTransientWorkspace() {
    const stack = returnStackApi();
    const context = stack && typeof stack.pop === 'function' ? stack.pop(state) : null;
    if (!context) {
      state.status = t('objectCanvas.status.returnUnavailable', 'There is no previous object editor to return to.');
      updateDynamicSurfaces();
      return false;
    }
    const scrollSnapshot = stack && typeof stack.restore === 'function'
      ? stack.restore(state, context)
      : context.scrollSnapshot || null;
    state.sourceSliceModel = null;
    state.sourceSliceAdvancedConfirmed = false;
    state.semanticLogicModel = null;
    state.semanticLogicAdvancedConfirmed = false;
    state.active = true;
    state.model = rebuildRestoredObjectModel();
    state.status = t('objectCanvas.status.returnedToObject', 'Returned to the previous object editor.');
    showWorkspace(state.mode === 'existing' ? (state.view === 'cards' ? 'card' : 'existing') : state.template);
    render({scrollSnapshot});
    return true;
  }

  function rebuildRestoredObjectModel() {
    if (state.deleteProposal) {
      return buildDeleteProposalModel(state.deleteProposal);
    }
    if (state.mode === 'existing') {
      return buildExistingModel({values: state.values, proposalOptions: state.proposalOptions});
    }
    return buildTemplateModel({values: state.values});
  }

  function commitStructureCommand(target) {
    const builder = target && typeof target.closest === 'function'
      ? target.closest('[data-preview-object-structure-builder]')
      : null;
    if (!builder) {
      return;
    }
    const scrollSnapshot = captureObjectCanvasScroll();
    syncStructureBuilder(builder);
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    state.preserveScrollOnNextRefresh = false;
    const draftCommand = structureDraftApi().readBuilderCommand(builder, {counter: state.structureCommandCounter + 1, Event: global.Event});
    if (!draftCommand || !draftCommand.value) {
      state.status = t('objectCanvas.status.structureCommandEmpty', 'Fill in the structure fields before adding it.');
      updateDynamicSurfaces();
      return;
    }
    const command = {
      id: draftCommand.id,
      type: draftCommand.action,
      action: draftCommand.action,
      fieldId: draftCommand.fieldId,
      optionId: draftCommand.optionId,
      sectionId: draftCommand.sectionId,
      targetLabel: draftCommand.targetLabel,
      value: draftCommand.value,
      mode: state.mode === 'existing' ? 'manual_review' : 'draft'
    };
    state.structureCommandCounter += 1;
    state.structureCommands = (state.structureCommands || []).concat(command);
    state.values = collectValues();
    if (command.fieldId) {
      delete state.values[command.fieldId];
      delete state.valueOriginals[command.fieldId];
    }
    clearStructureBuilder(builder);
    state.model = state.mode === 'existing' ? buildExistingModel({values: state.values, proposalOptions: state.proposalOptions}) : buildTemplateModel({values: state.values});
    if (shouldMaterializeNewEventDraft(state.values)) {
      state.model = materializeNewEventDraft(state.model);
    }
    state.status = t('objectCanvas.status.structureCommandQueued', 'Structure command added to the current proposal.');
    render({scrollSnapshot});
  }

  function clearStructureBuilder(builder) {
    structureDraftApi().clearBuilder(builder);
  }

  function reviewCurrentPlan() {
    refresh();
    const plan = currentInstallPlan();
    if (!plan) {
      return;
    }
    const assistant = global.ProjectMapInstallAssistant;
    if (assistant && typeof assistant.loadPlan === 'function') {
      assistant.loadPlan(plan, {fileName: (state.model.objectId || 'object_authoring') + '.install-plan.json'});
      switchToInstallMode();
      if (typeof global.setTimeout === 'function') {
        global.setTimeout(switchToInstallMode, 0);
        global.setTimeout(switchToInstallMode, 80);
      }
    }
  }

  function switchToInstallMode() {
    const wizard = global.ProjectMapWizard;
    if (wizard && typeof wizard.setMode === 'function') {
      wizard.setMode('install');
      return;
    }
    const installButton = global.document.querySelector('[data-mode="install"]');
    if (installButton && typeof installButton.click === 'function') {
      installButton.click();
    }
  }

  function openLegacyForm() {
    state.values = collectValues();
    state.model = state.deleteProposal
      ? buildDeleteProposalModel(state.deleteProposal)
      : state.mode === 'existing' ? buildExistingModel({values: state.values, proposalOptions: state.proposalOptions}) : buildTemplateModel({values: state.values});
    const draft = draftWithAuthoringContext() || state.model && state.model.changeState && state.model.changeState.draft;
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
    const changed = {};
    const originalKeys = new Set();
    collectCanvasFieldEntries(elements.host).forEach((input) => {
      const key = input.dataset.objectCanvasField;
      if (!key) {
        return;
      }
      const hasOriginal = input.dataset && Object.prototype.hasOwnProperty.call(input.dataset, 'objectCanvasOriginal');
      if (input.type === 'checkbox') {
        const domOriginal = hasOriginal
          ? (/^(1|true|yes|on)$/i.test(input.dataset.objectCanvasOriginal || '') ? 'true' : 'false')
          : (input.defaultChecked ? 'true' : 'false');
        const originalChecked = rememberFieldOriginal(key, domOriginal) === 'true';
        if (input.checked !== originalChecked) {
          changed[key] = input.checked ? 'true' : 'false';
        } else if (hasOriginal) {
          originalKeys.add(key);
        }
        return;
      }
      const domOriginal = hasOriginal ? String(input.dataset.objectCanvasOriginal || '') : input.defaultValue;
      const originalValue = rememberFieldOriginal(key, domOriginal);
      if (input.value !== originalValue) {
        changed[key] = input.value;
      } else if (hasOriginal) {
        originalKeys.add(key);
      }
    });
    Object.keys(changed).forEach((key) => {
      values[key] = changed[key];
    });
    originalKeys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(changed, key)) {
        delete values[key];
      }
    });
    return values;
  }

  function collectCanvasFieldEntries(host) {
    const api = objectCanvasFieldValuesApi();
    return api.collectCanvasFieldEntries(host, {
      activeElement: global.document && global.document.activeElement || null,
      getComputedStyle: global.getComputedStyle ? global.getComputedStyle.bind(global) : null
    });
  }

  function syncStructureBuilder(builder) {
    structureDraftApi().syncBuilder(builder, {Event: global.Event, dispatch: false});
  }

  function rememberFieldOriginal(key, value) {
    state.valueOriginals = state.valueOriginals && typeof state.valueOriginals === 'object' ? state.valueOriginals : {};
    if (!Object.prototype.hasOwnProperty.call(state.valueOriginals, key)) {
      state.valueOriginals[key] = String(value === undefined || value === null ? '' : value);
    }
    return String(state.valueOriginals[key] || '');
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
    const title = elements.host.querySelector('[data-object-canvas-title]');
    if (title) {
      const rawTitle = headerTitle(state.model, currentSurface(state.model));
      title.textContent = displayCompactLabel(rawTitle);
      title.setAttribute('title', rawTitle);
    }
    syncPreviewObjectEditorChrome();
    syncPreviewObjectEditorPane();
    syncObjectCanvasFieldValues();
    syncObjectCanvasAssetActionState();
    syncSourceSliceAdvancedControls();
    syncSemanticLogicAdvancedControls();
    syncEventReadinessControls();
    syncObjectCanvasReviewButtons();
    syncPreviewObjectRenderedFields();
    bindVisibleEditUi(elements.host);
    const panel = elements.host.querySelector('[data-runtime-lens-panel]');
    if (panel && state.runtimeLensStatus === 'stale') {
      panel.dataset.runtimeLensStatus = 'stale';
      syncRuntimeLensStatusClass(panel, 'stale');
      const message = panel.querySelector('[data-runtime-lens-message]');
      if (message) {
        message.textContent = t('runtimeLens.draftStale', 'Lens is behind the current edit. Refresh or rebuild it to observe the latest draft.');
      }
    }
  }

  function syncSourceSliceAdvancedControls() {
    if (!elements || !elements.host || state.mode !== 'source_slice') {
      return;
    }
    const allowed = sourceSliceReviewAllowed();
    elements.host.querySelectorAll('[data-object-canvas-action="review"]').forEach((button) => {
      button.disabled = !allowed;
      button.setAttribute('aria-disabled', allowed ? 'false' : 'true');
    });
  }

  function syncSemanticLogicAdvancedControls() {
    if (!elements || !elements.host || state.mode !== 'semantic_logic') {
      return;
    }
    const allowed = semanticLogicReviewAllowed();
    elements.host.querySelectorAll('[data-object-canvas-action="review"]').forEach((button) => {
      button.disabled = !allowed;
      button.setAttribute('aria-disabled', allowed ? 'false' : 'true');
    });
  }

  function syncEventReadinessControls() {
    if (!elements || !elements.host || state.mode !== 'new_event') {
      return;
    }
    const allowed = eventReadinessReviewAllowed();
    elements.host.querySelectorAll('[data-object-canvas-action="review"]').forEach((button) => {
      button.disabled = !allowed;
      button.setAttribute('aria-disabled', allowed ? 'false' : 'true');
      button.dataset.reviewReadinessGate = allowed ? 'ready' : 'blocked';
    });
  }

  function syncObjectCanvasReviewButtons() {
    if (!elements || !elements.host || !state.model) {
      return;
    }
    const allowed = objectCanvasReviewAllowed();
    elements.host.querySelectorAll('[data-object-canvas-action="review"]').forEach((button) => {
      button.disabled = !allowed;
      button.setAttribute('aria-disabled', allowed ? 'false' : 'true');
      button.dataset.reviewState = allowed ? 'ready' : 'blocked';
    });
  }

  function objectCanvasReviewAllowed() {
    if (state.mode === 'source_slice') {
      return sourceSliceReviewAllowed();
    }
    if (state.mode === 'semantic_logic') {
      return semanticLogicReviewAllowed();
    }
    if (state.mode === 'new_event') {
      return eventReadinessReviewAllowed() && Boolean(currentInstallPlan());
    }
    return Boolean(currentInstallPlan());
  }

  function currentInstallPlan() {
    const change = state.model && state.model.changeState || {};
    const output = change.output || {};
    return change.installPlan || output.installPlan || parseJson(output.installPlanJson);
  }

  function updateRuntimeLensEvidence() {
    if (!elements || !elements.host) {
      return false;
    }
    const panel = elements.host.querySelector('[data-runtime-lens-panel]');
    if (!panel) {
      return false;
    }
    const session = state.runtimeLensSession || {};
    const status = state.runtimeLensStatus || session.status || 'ready';
    panel.dataset.runtimeLensStatus = status;
    syncRuntimeLensStatusClass(panel, status);
    const message = panel.querySelector('[data-runtime-lens-message]');
    if (message) {
      message.textContent = runtimeLensEvidenceMessage(session, status);
    }
    const statusNode = elements.host.querySelector('[data-object-canvas-status]');
    if (statusNode) {
      statusNode.textContent = state.status || '';
    }
    return true;
  }

  function syncRuntimeLensStatusClass(panel, status) {
    if (!panel || !panel.classList) {
      return;
    }
    ['idle', 'building', 'ready', 'partial', 'blocked', 'stale', 'failed', 'suspended', 'unavailable'].forEach((value) => {
      panel.classList.remove('is-' + value);
    });
    const safe = safeRuntimeLensStatus(status);
    if (safe) {
      panel.classList.add('is-' + safe);
    }
    panel.classList.toggle('is-stale', safe === 'stale');
  }

  function runtimeLensEvidenceMessage(session, status) {
    const snapshot = session && session.runtimeSnapshot || null;
    if ((snapshot && snapshot.status === 'blocked') || status === 'blocked') {
      const diag = firstRuntimeDiagnostic(snapshot) || firstRuntimeDiagnostic(session && session.runtimeDomMap) || firstRuntimeDiagnostic(session && session.runtimeVisualSurface);
      return diag && (diag.message || diag.code) || t('runtimeLens.blocked', 'Runtime Lens is blocked by incomplete generated runtime files.');
    }
    if (snapshot && snapshot.summary) {
      const summary = snapshot.summary || {};
      const runtimeStatus = String(snapshot.status || status || 'ready');
      const prefix = runtimeStatus === 'partial'
        ? 'Partial runtime snapshot: '
        : 'Runtime loaded, ';
      return prefix + Number(summary.visibleRegionCount || 0) + '/' + Number(summary.indexedRegionCount || 0) + ' regions visible, ' + Number(summary.choiceCount || 0) + ' choices rendered.';
    }
    return {
      ready: t('runtimeLens.ready', 'Lens is ready.'),
      partial: t('runtimeLens.partial', 'Lens loaded with runtime snapshot warnings.'),
      failed: t('runtimeLens.failed', 'Lens could not be created.'),
      suspended: t('runtimeLens.suspended', 'Lens is suspended while this workspace is in the background. Refresh to reload it.')
    }[status] || t('runtimeLens.ready', 'Lens is ready.');
  }

  function firstRuntimeDiagnostic(value) {
    return ensureArray(value && value.diagnostics).find((diag) => diag && diag.severity === 'error') ||
      ensureArray(value && value.diagnostics).find(Boolean) ||
      null;
  }

  function safeRuntimeLensStatus(status) {
    return String(status || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function syncPreviewObjectEditorPane() {
    previewEditorSyncApi().syncPreviewObjectEditorPane(previewEditorSyncDeps());
  }

  function syncPreviewObjectRenderedFields() {
    previewEditorSyncApi().syncPreviewObjectRenderedFields(previewEditorSyncDeps());
  }

  function previewObjectFieldMap(model) {
    return previewEditorSyncApi().previewObjectFieldMap(model, previewEditorSyncDeps());
  }

  function syncPreviewObjectEditorChrome() {
    previewEditorSyncApi().syncPreviewObjectEditorChrome(previewEditorSyncDeps());
  }

  function renderVisibleTextInline(value) {
    return previewEditorSyncApi().renderVisibleTextInline(value, previewEditorSyncDeps());
  }

  function renderPreviewObjectDraftSummary(model) {
    return previewEditorSyncApi().renderPreviewObjectDraftSummary(model, previewEditorSyncDeps());
  }

  function previewObjectRouteLabel(model) {
    return previewEditorSyncApi().previewObjectRouteLabel(model, previewEditorSyncDeps());
  }

  function syncObjectCanvasFieldValues() {
    previewEditorSyncApi().syncObjectCanvasFieldValues(previewEditorSyncDeps());
  }

  function syncObjectCanvasAssetActionState() {
    previewEditorSyncApi().syncObjectCanvasAssetActionState(previewEditorSyncDeps());
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
    if (state.deleteProposal) {
      return state.deleteProposal;
    }
    if (state.mode === 'source_slice' || state.mode === 'semantic_logic') {
      return draft;
    }
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
    return surfaceAdapterApi().templateFromDraft(draft, surfaceAdapterDeps());
  }

  function isCanvasTemplate(template) {
    return surfaceAdapterApi().isCanvasTemplate(template, surfaceAdapterDeps());
  }

  function normalizeTemplate(template) {
    return surfaceAdapterApi().normalizeTemplate(template, surfaceAdapterDeps());
  }

  function workspaceForTemplate(template) {
    return surfaceAdapterApi().workspaceForTemplate(template, surfaceAdapterDeps());
  }

  function systemUiTemplateForRegion(nodeKey) {
    return surfaceAdapterApi().systemUiTemplateForRegion(nodeKey, surfaceAdapterDeps());
  }

  function surfaceForTemplate(template) {
    return surfaceAdapterApi().surfaceForTemplate(template, surfaceAdapterDeps());
  }

  function currentSurface(model) {
    return surfaceAdapterApi().currentSurface(model, surfaceAdapterDeps());
  }

  function surfaceLabelFor(surface) {
    return surfaceAdapterApi().surfaceLabelFor(surface, surfaceAdapterDeps());
  }

  function surfaceAdapterDeps() {
    return {
      cardWorkspaceApi,
      modelApi,
      regionRouterApi,
      registryApi,
      state,
      surfaceForTemplate,
      t
    };
  }

  function registryApi() {
    return global.ProjectMapAuthoringSurfaceRegistry || null;
  }

  function regionRouterApi() {
    return global.ProjectMapSystemUiRegionRouter || null;
  }

  function surfaceAdapterApi() {
    return global.ProjectMapObjectCanvasSurfaceAdapter;
  }

  function modelBuilderApi() {
    return global.ProjectMapObjectCanvasModelBuilder;
  }

  function projectStateWorkspaceApi() {
    return global.ProjectMapObjectCanvasProjectStateWorkspace;
  }

  function objectCanvasShellApi() { return global.ProjectMapObjectCanvasShellUi || null; }
  function objectDeleteProposalApi() { return global.ProjectMapObjectDeleteProposalModel || null; }
  function systemUiWorkspaceApi() {
    return global.ProjectMapSystemUiWorkspaceState || null;
  }

  function graphStageApi() { return global.ProjectMapObjectCanvasGraphStage || null; }
  function runtimeLensWorkspaceApi() { return global.ProjectMapRuntimeLensWorkspaceState || null; }
  function cardWorkspaceApi() { return global.ProjectMapCardWorkspaceState || null; }
  function cardDeps(entry) { return {buildExistingModel, buildExistingModelFor, buildTemplateModel, collectValues, defaultDraftForTemplate, entry, render, showWorkspace, t}; }
  function runtimeLensDeps() { return {buildExistingModel, buildTemplateModel, collectValues, render, renderRuntimeLensEvidence: updateRuntimeLensEvidence}; }

  function storyboardWorkspaceApi() { return global.ProjectMapStoryboardWorkspaceState || null; }
  function storyboardDeps() { return {buildExistingModel, buildExistingModelFor, buildTemplateModel, collectValues, render, selectCanvasNode, showWorkspace, t}; }

  function storyboardDraftsApi() {
    if (global.ProjectMapObjectCanvasStoryboardDrafts) {
      return global.ProjectMapObjectCanvasStoryboardDrafts;
    }
    throw new Error('ProjectMapObjectCanvasStoryboardDrafts must load before Object Canvas UI.');
  }

  function storyboardDraftDeps() {
    return {
      branchApi: global.ProjectMapAuthoringReferenceIndex,
      buildExistingModelFor,
      buildTemplateModel,
      collectValues,
      ensureArray,
      normalizeTemplate,
      openFromSelection,
      openTemplate,
      render,
      resetStructureCommands,
      safeDefaultDraftForTemplate,
      safeDraftId,
      showWorkspace,
      storyboardDeps,
      storyboardWorkspaceApi,
      t
    };
  }

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

  function installPlanApi() {
    return global.ProjectMapInstallPlan || null;
  }

  function assetModelApi() {
    return global.ProjectMapAssetModel || null;
  }

  function sourceSliceApi() {
    return global.ProjectMapSourceSliceEditor || null;
  }

  function sourceSliceWorkspaceApi() {
    return global.ProjectMapSourceSliceWorkspace || null;
  }

  function returnStackApi() {
    return global.ProjectMapObjectWorkspaceReturnStack || null;
  }

  function semanticLogicApi() {
    return global.ProjectMapSemanticLogicEditor || null;
  }

  function semanticLogicWorkspaceApi() {
    return global.ProjectMapSemanticLogicWorkspace || null;
  }

  function visibleEditActionUi() {
    return global.ProjectMapVisibleEditActionUi || null;
  }

  function structureDraftApi() {
    if (global.ProjectMapPreviewObjectStructureDraft) {
      return global.ProjectMapPreviewObjectStructureDraft;
    }
    if (typeof require === 'function') {
      return require('./preview_object_structure_draft.js');
    }
    throw new Error('ProjectMapPreviewObjectStructureDraft must load before Object Canvas structure builders.');
  }

  function objectCanvasFieldValuesApi() {
    if (global.ProjectMapObjectCanvasFieldValues) {
      return global.ProjectMapObjectCanvasFieldValues;
    }
    if (typeof require === 'function') {
      return require('./object_canvas_field_values.js');
    }
    throw new Error('ProjectMapObjectCanvasFieldValues must load before Object Canvas UI.');
  }

  function previewEditorSyncApi() {
    if (global.ProjectMapObjectCanvasPreviewEditorSync) {
      return global.ProjectMapObjectCanvasPreviewEditorSync;
    }
    if (typeof require === 'function') {
      return require('./object_canvas_preview_editor_sync.js');
    }
    throw new Error('ProjectMapObjectCanvasPreviewEditorSync must load before Object Canvas UI.');
  }

  function previewEditorSyncDeps() {
    return {
      cssEscape,
      currentSurface,
      document: global.document,
      elements,
      ensureArray,
      escapeHtml,
      global,
      headerTitle,
      previewObjectEditor: global.ProjectMapPreviewObjectEditor,
      state,
      t,
      visibleTextRenderer: global.ProjectMapVisibleTextRenderer
    };
  }

  function bindVisibleEditUi(root) {
    const visibleEditUi = visibleEditActionUi();
    const host = root || elements && elements.host;
    if (visibleEditUi && typeof visibleEditUi.bind === 'function' && host) {
      visibleEditUi.bind(host, {projectIndex: state.projectIndex});
    }
  }

  function parsedToDraftApi() {
    return global.ProjectMapParsedToDraft || null;
  }

  function sourceSliceWorkspaceDeps() {
    return {
      translate: t,
      escapeHtml,
      escapeAttr,
      renderPlanPreview,
      renderDiagnostics,
      sourceSliceApi: sourceSliceApi()
    };
  }

  function semanticLogicWorkspaceDeps() {
    return {
      translate: t,
      escapeHtml,
      escapeAttr,
      renderPlanPreview,
      renderDiagnostics,
      semanticLogicApi: semanticLogicApi()
    };
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

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function currentLocale() {
    const i18n = global.ProjectMapI18n;
    const value = i18n && typeof i18n.getLocale === 'function' ? i18n.getLocale() : global.document && global.document.documentElement && global.document.documentElement.lang || '';
    return String(value || '').toLowerCase().startsWith('zh') ? 'zh-Hant' : 'en';
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function cssEscape(value) {
    const css = global && global.CSS;
    if (css && typeof css.escape === 'function') {
      return css.escape(String(value || ''));
    }
    return String(value || '').replace(/["\\\]]/g, '\\$&');
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
