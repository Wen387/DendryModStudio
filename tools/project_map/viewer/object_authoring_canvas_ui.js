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
    preserveScrollOnNextRefresh: false,
    model: null,
    status: ''
  };

  let elements = null; let templateClickToken = 0; let reconcileToken = 0; let refreshTimer = null; let projectStateSearchTimer = null; let projectStateSearchFocus = null;

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
    state.editorOverlay = false;
    state.deleteProposal = null;
    state.baseDraft = null;
    state.proposalOptions = options && options.proposalOptions || null;
    state.values = options && options.values || {};
    state.valueOriginals = {};
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
    state.baseDraft = draft || safeDefaultDraftForTemplate(nextTemplate);
    state.proposalOptions = null;
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
    if (value.kind === 'existing_scene_delete') {
      const opened = openFromSelection(state.projectIndex, value.sceneKind === 'card' ? 'cards' : 'events', value.sceneId, {entry: meta});
      if (opened) {
        state.deleteProposal = normalizeDeleteProposal(value, state.model);
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

  function refresh() {
    if (!state.active) {
      return;
    }
    if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
    const scrollSnapshot = state.preserveScrollOnNextRefresh ? captureObjectCanvasScroll() : null;
    state.preserveScrollOnNextRefresh = false;
    state.values = collectValues();
    state.model = state.deleteProposal
      ? buildDeleteProposalModel(state.deleteProposal)
      : state.mode === 'existing' ? buildExistingModel({values: state.values, proposalOptions: state.proposalOptions}) : buildTemplateModel({values: state.values});
    markRuntimeLensStale();
    const surface = currentSurface(state.model);
    if (surface.key === 'system_ui_preview' || surface.key === 'card_board' && !activeInsidePreviewObjectEditor() || shouldRenderSurfaceRefresh(surface)) {
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
    const nextOptions = withStructureCommandValues(options);
    try {
      if (apiModel && typeof apiModel.buildTemplateCanvas === 'function') {
        return apiModel.buildTemplateCanvas(state.projectIndex, template, state.baseDraft || {}, nextOptions || {});
      }
      return buildNewEventModel(nextOptions);
    } catch (err) {
      return diagnosticModel('template', template, state.baseDraft && state.baseDraft.id || '', err, nextOptions);
    }
  }

  function withStructureCommandValues(options) {
    const opts = Object.assign({}, options || {});
    const values = Object.assign({}, opts.values || {});
    if (state.structureCommands && state.structureCommands.length) {
      values.__structureCommands = state.structureCommands.slice();
    }
    opts.values = values;
    return opts;
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
    elements.host.innerHTML = [
      '<section class="object-canvas editing-workspace' + (state.editorOverlay ? ' is-editor-overlay' : '') + (previewEditorIsActive(surface) ? ' has-preview-object-editor' : '') + (boardChromeCanCollapse(surface) && state.boardChromeCollapsed ? ' is-board-chrome-collapsed' : '') + '" data-object-authoring-canvas="true" data-editing-workspace="true" data-authoring-workspace="' + escapeAttr(state.workspace || 'content') + '" data-authoring-surface="' + escapeAttr(surface.key || 'content_graph') + '" data-preview-object-editor-active="' + (previewEditorIsActive(surface) ? 'true' : 'false') + '" data-board-chrome-collapsed="' + (state.boardChromeCollapsed ? 'true' : 'false') + '" style="' + escapeAttr(layoutStyle) + '">',
      renderHeader(model, surface),
      stageHtml,
      renderObjectEditingModal(model, surface),
      stageError ? renderDiagnostics([{message: t('objectCanvas.renderFailed', 'Canvas render failed: {error}').replace('{error}', stageError && stageError.message ? stageError.message : String(stageError || 'unknown error'))}]) : model.ok ? renderBody(model) : renderUnavailable(model),
      '</section>'
    ].join('');
    bindCanvasEvents();
    updateDynamicSurfaces();
    restoreObjectCanvasScroll(scrollSnapshot);
  }

  function renderHeader(model, surface) {
    const source = model.source || {};
    const systemUi = surface && surface.key === 'system_ui_preview';
    const modeLabel = model.mode === 'existing'
      ? t('objectCanvas.mode.existing', 'Editing existing object')
      : t('objectCanvas.mode.newObject', 'Authoring object');
    const kindLabel = systemUi ? t('authoring.template.systemUiScreen', 'System UI Screen') : model.templateLabel || model.objectKind || state.template || 'event';
    const surfaceLabel = surface && surfaceLabelFor(surface) || t('objectCanvas.eyebrow', 'Object Authoring Canvas');
    const title = headerTitle(model, surface);
    const canCollapse = boardChromeCanCollapse(surface);
    const collapsed = canCollapse && state.boardChromeCollapsed;
    const toggleLabel = collapsed
      ? t('objectCanvas.expandBoardChrome', 'Expand board details')
      : t('objectCanvas.collapseBoardChrome', 'Collapse board details');
    return [
      '<header class="object-canvas-header editing-workspace-header' + (canCollapse ? ' is-collapsible' : '') + (collapsed ? ' is-collapsed' : '') + '" data-object-canvas-header="true">',
      '<div>',
      '<div class="object-canvas-title-row">',
      '<div>',
      '<div class="template-eyebrow" data-authoring-surface-label="true">' + escapeHtml(surfaceLabel) + '</div>',
      '<h2 data-object-canvas-title="true">' + escapeHtml(title) + '</h2>',
      '</div>',
      canCollapse ? '<button class="object-canvas-chrome-toggle" type="button" data-object-canvas-action="toggle_board_chrome" aria-expanded="' + (collapsed ? 'false' : 'true') + '">' + escapeHtml(toggleLabel) + '</button>' : '',
      '</div>',
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
    return withRuntimeLensRenderStatus(() => {
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
    const key = surface && surface.key || '';
    return key === 'card_board';
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

  function boardChromeCanCollapse(surface) {
    const key = surface && surface.key || '';
    return key === 'content_storyboard' || key === 'card_board' || key === 'system_ui_preview' || key === 'election_results_board' || key === 'project_state_board';
  }

  function previewEditorIsActive(surface) {
    const key = surface && surface.key || '';
    return key === 'content_storyboard' || key === 'card_board';
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

  function renderUnavailable(model) {
    const diagnostics = model && model.changeState && model.changeState.diagnostics || [];
    return [
      '<section class="editing-panel" open>',
      '<div class="editing-empty">' + escapeHtml(t('objectCanvas.unavailable', 'Object Canvas cannot open this selection yet.')) + '</div>',
      diagnostics.map((diag) => '<p class="editing-readonly-line">' + escapeHtml((diag.code || 'diagnostic') + ': ' + (diag.message || '')) + '</p>').join(''),
      '</section>'
    ].join('');
  }

  function renderStageError(surface, err) {
    return [
      '<section class="object-canvas-stage object-canvas-render-error" data-object-canvas-stage="true" data-object-canvas-render-error="true" data-authoring-surface="' + escapeAttr(surface && surface.key || '') + '">',
      '<div class="editing-empty">',
      '<h3>' + escapeHtml(t('objectCanvas.renderErrorTitle', 'Canvas could not render this workspace.')) + '</h3>',
      '<p>' + escapeHtml(err && err.message ? err.message : String(err || 'Unknown render error')) + '</p>',
      '</div>',
      '</section>'
    ].join('');
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
      '<button class="danger-action" type="button" data-object-canvas-action="delete_current_object">' + escapeHtml(t(model.mode === 'existing' ? 'objectCanvas.action.deleteExisting' : 'objectCanvas.action.discardDraft', model.mode === 'existing' ? 'Delete event' : 'Discard draft')) + '</button>',
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

  function scheduleRefresh() {
    state.preserveScrollOnNextRefresh = true;
    if (refreshTimer) { clearTimeout(refreshTimer); }
    refreshTimer = setTimeout(refresh, 180);
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
    state.values = collectValues();
    state.deleteProposal = null;
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
    state.model = state.mode === 'existing' ? buildExistingModel({values: state.values}) : buildTemplateModel({values: state.values});
    state.selectedCanvasNode = next;
    markRuntimeLensStale();
    render();
  }

  function fastSelectProjectStateNode(next) {
    if (!/^variable:/.test(String(next || ''))) {
      return false;
    }
    if (!state.model || currentSurface(state.model).key !== 'project_state_board') {
      return false;
    }
    state.selectedCanvasNode = next;
    if (!syncProjectStateVariableSelection()) {
      render();
    }
    return true;
  }

  function syncProjectStateVariableSelection() {
    if (!elements || !elements.host || !state.model) {
      return false;
    }
    const surface = global.ProjectMapProjectStateSurface;
    if (!surface || typeof surface.renderInspectorCard !== 'function') {
      return false;
    }
    const selectedName = selectedProjectStateVariableName();
    elements.host.querySelectorAll('[data-project-state-variable-row]').forEach((row) => {
      const active = String(row.dataset && row.dataset.projectStateVariableRow || '') === selectedName;
      row.classList.toggle('is-selected', active);
      row.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const card = elements.host.querySelector('[data-project-state-consumers], [data-project-state-metadata]');
    if (!card) {
      return false;
    }
    card.outerHTML = surface.renderInspectorCard(state.model, {
      projectIndex: state.projectIndex,
      selected: state.selectedCanvasNode,
      query: state.projectStateQuery,
      limit: state.projectStateLimit
    });
    return true;
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
      reviewCurrentPlan();
    } else if (action === 'legacy_form') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      openLegacyForm();
    } else if (action === 'toggle_overlay') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      toggleEditorOverlay();
    } else if (action === 'toggle_preview_expanded') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      toggleObjectEditorPreviewExpanded();
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
    const source = normalizeSource(model && model.source || {});
    const sceneId = String(model && model.objectId || state.item || '').trim();
    const sceneKind = String(model && model.objectKind || '').trim() === 'card' ? 'card' : 'event';
    const title = String(model && model.title || sceneId || '').trim();
    return normalizeDeleteProposal({
      schemaVersion: '0.1',
      kind: 'existing_scene_delete',
      id: 'delete_' + safeDraftId(sceneId || sceneKind),
      title: 'Delete ' + (title || sceneId || sceneKind),
      sceneId,
      sceneKind,
      view: sceneKind === 'card' ? 'cards' : 'events',
      source,
      references: collectDeleteReferences(model, sceneId, source.path),
      reviewNote: 'Manual deletion review for ' + sceneKind + ' ' + sceneId + '.',
      studioAuthoringContext: {
        workspace: 'content',
        surface: 'content_storyboard',
        action: 'delete_current_object',
        selectedCanvasNode: state.selectedCanvasNode || (sceneKind + ':' + sceneId),
        view: state.view || (sceneKind === 'card' ? 'cards' : 'events')
      }
    }, model);
  }

  function normalizeDeleteProposal(input, model) {
    const value = input && typeof input === 'object' ? input : {};
    const sceneId = String(value.sceneId || model && model.objectId || '').trim();
    const sceneKind = String(value.sceneKind || model && model.objectKind || '').trim() === 'card' ? 'card' : 'event';
    const title = String(value.title || 'Delete ' + (model && model.title || sceneId || sceneKind)).trim();
    return {
      schemaVersion: String(value.schemaVersion || '0.1'),
      kind: 'existing_scene_delete',
      id: safeDraftId(value.id || 'delete_' + (sceneId || sceneKind)),
      title,
      sceneId,
      sceneKind,
      view: String(value.view || (sceneKind === 'card' ? 'cards' : 'events')).trim(),
      source: normalizeSource(value.source || model && model.source || {}),
      references: ensureArray(value.references).map(normalizeDeleteReference),
      reviewNote: String(value.reviewNote || '').trim(),
      studioAuthoringContext: value.studioAuthoringContext || value.authoringContext || {}
    };
  }

  function buildDeleteProposalModel(proposalInput) {
    const proposal = normalizeDeleteProposal(proposalInput, state.model);
    const plan = buildDeleteInstallPlan(proposal);
    const installApi = installPlanApi();
    const output = {
      ok: true,
      draft: proposal,
      playerPreview: deletePreviewText(proposal),
      previewText: deletePreviewText(proposal),
      proposalText: deletePreviewText(proposal),
      installPlan: plan,
      installPlanJson: installApi && typeof installApi.renderInstallPlanJson === 'function' ? installApi.renderInstallPlanJson(plan) : JSON.stringify(plan, null, 2) + '\n',
      patchPreview: installApi && typeof installApi.renderPatchPreview === 'function' ? installApi.renderPatchPreview(plan) : '',
      installChecklist: installApi && typeof installApi.renderOperationChecklist === 'function' ? installApi.renderOperationChecklist(plan, {locale: currentLocale()}) : '',
      installNotes: deletePreviewText(proposal)
    };
    return {
      schemaVersion: '0.1',
      kind: 'object_authoring_canvas_model',
      ok: true,
      mode: 'existing',
      template: 'existing',
      templateLabel: proposal.sceneKind === 'card' ? t('objectPreview.card', 'Card') : t('objectPreview.event', 'World Event'),
      objectKind: proposal.sceneKind,
      objectId: proposal.sceneId,
      title: proposal.title,
      source: proposal.source,
      entry: {source: 'Delete', action: 'delete_current_object', label: ''},
      contextBoard: {
        flow: proposal.references.map((ref) => ({
          label: ref.label || ref.kind,
          detail: [ref.kind, ref.detail].filter(Boolean).join(' / '),
          direction: ref.kind === 'incoming' ? 'incoming' : ref.kind === 'outgoing' ? 'outgoing' : 'manual_review',
          source: ref.source || {}
        })),
        variables: [],
        effects: [],
        assets: [],
        sourceEvidence: [{label: 'delete target', path: proposal.source.path || '', line: proposal.source.line || null, status: 'manual_review'}],
        manualBoundaries: [{label: 'Delete source object', reason: 'Deletion requires reviewing all routes, references, and variable consumers before changing files.', status: 'manual_review', source: proposal.source}]
      },
      eventBody: {
        mode: 'delete_existing',
        bodyEyebrow: t('objectCanvas.deleteProposal', 'Delete proposal'),
        title: readOnlyField('delete.title', t('objectCanvas.deleteTarget', 'Delete target'), proposal.title),
        sections: [readOnlyField('delete.review', t('objectCanvas.deleteReview', 'Review checklist'), deletePreviewText(proposal), {inputType: 'textarea'})],
        options: [],
        metaFields: [
          readOnlyField('delete.sceneId', t('existingScene.sceneId', 'Scene'), proposal.sceneId),
          readOnlyField('delete.sceneKind', t('existingScene.kind', 'Kind'), proposal.sceneKind),
          readOnlyField('delete.source', t('existingScene.source', 'Source'), sourceLabel(proposal.source)),
          readOnlyField('delete.references', t('objectCanvas.deleteReferences', 'References to check'), String(proposal.references.length))
        ]
      },
      changeState: {
        draft: proposal,
        proposal,
        output,
        installPlan: plan,
        operationSummary: installApi && typeof installApi.operationSummary === 'function' ? installApi.operationSummary(plan) : {safeApply: 0, guardedApply: 0, advancedApply: 0, manualReview: 1, refused: 0, total: 1},
        changedCount: 1,
        diagnostics: [{severity: 'warning', level: 'warning', code: 'object_canvas.delete_manual_review', message: t('objectCanvas.deleteManualReview', 'Deletion is manual-review only; Studio will not remove source automatically.')}],
        warnings: [t('objectCanvas.deleteManualReview', 'Deletion is manual-review only; Studio will not remove source automatically.')]
      },
      legacy: {template: 'existing'},
      rawContext: null
    };
  }

  function buildDeleteInstallPlan(proposal) {
    const installApi = installPlanApi();
    const rawPlan = {
      id: proposal.id,
      draftKind: 'existing_scene_delete',
      title: proposal.title,
      project: installApi && typeof installApi.projectProvenanceFromIndex === 'function' ? installApi.projectProvenanceFromIndex(state.projectIndex) : null,
      operations: [{
        id: 'existing_scene_delete_review',
        type: 'manual_snippet',
        path: proposal.source.path || ('source/scenes/events/' + (proposal.sceneId || 'scene') + '.scene.dry'),
        content: deletePreviewText(proposal),
        safety: 'manual_review',
        role: 'existing_scene.delete_review',
        description: 'Review and delete this existing event or card after checking every route and reference.'
      }]
    };
    return installApi && typeof installApi.buildInstallPlan === 'function'
      ? installApi.buildInstallPlan(rawPlan)
      : Object.assign({schemaVersion: '0.1', kind: 'install_plan', status: 'proposal_only'}, rawPlan);
  }

  function deletePreviewText(proposal) {
    const rows = [
      deleteText('objectCanvas.deletePreview.header', 'Delete existing {kind}: {id}', {kind: proposal.sceneKind, id: proposal.sceneId}),
      deleteText('objectCanvas.deletePreview.title', 'Title: {title}', {title: proposal.title.replace(/^Delete\s+/, '')}),
      deleteText('objectCanvas.deletePreview.source', 'Source: {source}', {source: sourceLabel(proposal.source) || '(unknown)'}),
      '',
      t('objectCanvas.deletePreview.checklist', 'Manual review checklist:'),
      '- ' + t('objectCanvas.deletePreview.incoming', 'Remove or archive the source scene only after every incoming route has been rewired.'),
      '- ' + t('objectCanvas.deletePreview.outgoing', 'Check outgoing routes and scheduled triggers so follow-up content still has an owner.'),
      '- ' + t('objectCanvas.deletePreview.state', 'Check Q variables and effects referenced by this object before removing related state.'),
      ''
    ];
    if (proposal.references.length) {
      rows.push(t('objectCanvas.deletePreview.references', 'References to inspect:'));
      proposal.references.slice(0, 16).forEach((ref) => {
        rows.push('- ' + [ref.kind, ref.label, ref.detail, sourceLabel(ref.source)].filter(Boolean).join(' / '));
      });
    } else {
      rows.push(t('objectCanvas.deletePreview.noReferences', 'References to inspect: none found in the current ProjectIndex.'));
    }
    return rows.join('\n') + '\n';
  }

  function deleteText(key, fallback, replacements) {
    let value = t(key, fallback);
    Object.keys(replacements || {}).forEach((name) => {
      value = value.replace('{' + name + '}', String(replacements[name] || ''));
    });
    return value;
  }

  function collectDeleteReferences(model, sceneId, sourcePath) {
    const rows = [];
    const relationships = model && model.rawContext && model.rawContext.relationships || {};
    ['incoming', 'internal', 'outgoing'].forEach((key) => {
      ensureArray(relationships[key]).forEach((row) => {
        rows.push(normalizeDeleteReference({
          kind: key,
          label: row.label || row.from || row.to || row.kind || '',
          detail: row.kind || row.condition || row.to || row.from || '',
          source: row.source || row.scene && row.scene.source || {}
        }));
      });
    });
    ensureArray(state.projectIndex && state.projectIndex.scenes).forEach((scene) => {
      const id = String(scene && scene.id || '');
      const path = String(scene && (scene.path || scene.sourcePath || scene.sourceSpan && scene.sourceSpan.path) || '');
      if (!sceneId || id === sceneId || path === sourcePath) {
        return;
      }
      let text = '';
      try {
        text = JSON.stringify(scene);
      } catch (_err) {
        text = '';
      }
      if (text && text.indexOf(sceneId) >= 0) {
        rows.push(normalizeDeleteReference({
          kind: 'indexed reference',
          label: scene.title || id,
          detail: id,
          source: scene.sourceSpan || {path}
        }));
      }
    });
    const seen = new Set();
    return rows.filter((row) => {
      const key = [row.kind, row.label, sourceLabel(row.source)].join('::');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function normalizeDeleteReference(ref) {
    const value = ref && typeof ref === 'object' ? ref : {};
    return {
      kind: String(value.kind || 'reference').trim(),
      label: String(value.label || '').trim(),
      detail: String(value.detail || '').trim(),
      source: normalizeSource(value.source || {})
    };
  }

  function readOnlyField(id, label, value, extra) {
    const textValue = value === undefined || value === null ? '' : String(value);
    return Object.assign({
      id,
      label,
      original: textValue,
      value: textValue,
      status: 'manual_review',
      editability: 'manual_review',
      readOnly: true,
      source: {}
    }, extra || {});
  }

  function normalizeSource(source) {
    const value = source && typeof source === 'object' ? source : {};
    const line = Number(value.line || value.startLine || 0);
    return {
      path: String(value.path || value.sourcePath || '').trim(),
      line: Number.isFinite(line) && line > 0 ? Math.floor(line) : null
    };
  }

  function sourceLabel(source) {
    const value = normalizeSource(source);
    return value.path ? value.path + (value.line ? ':' + value.line : '') : '';
  }

  function handleProjectStateAction(action) {
    if (action === 'project_state_new_variable') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      openVariableDraft(newVariableDraft(), 'projectState.status.addVariable');
      return true;
    }
    if (action === 'project_state_edit_selected') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      const variable = selectedProjectStateVariable();
      if (variable) {
        openVariableDraft(editVariableDraft(variable), 'projectState.status.editSelected', 'variable:' + variable.name);
      } else {
        state.status = t('projectState.status.noSelectedVariable', 'Select a variable before editing it.');
        updateDynamicSurfaces();
      }
      return true;
    }
    if (action === 'project_state_delete_selected') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      const variable = selectedProjectStateVariable();
      if (variable) {
        openVariableDraft(deleteVariableDraft(variable), 'projectState.status.deleteSelected', 'variable:' + variable.name);
      } else {
        state.status = t('projectState.status.noSelectedVariable', 'Select a variable before editing it.');
        updateDynamicSurfaces();
      }
      return true;
    }
    if (action === 'project_state_show_more') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      state.projectStateLimit = Math.max(
        PROJECT_STATE_ROW_LIMIT,
        Number(state.projectStateLimit || PROJECT_STATE_ROW_LIMIT) + PROJECT_STATE_ROW_LIMIT
      );
      render();
      return true;
    }
    if (action === 'project_state_clear_search') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      state.projectStateQuery = '';
      state.projectStateLimit = PROJECT_STATE_ROW_LIMIT;
      projectStateSearchFocus = {start: 0, end: 0};
      render();
      return true;
    }
    return false;
  }

  function openVariableDraft(draft, statusKey, selectedNode) {
    state.values = {};
    state.valueOriginals = {};
    resetStructureCommands();
    state.baseDraft = draft || newVariableDraft();
    state.template = 'variables';
    state.mode = 'variables';
    state.view = 'variables';
    state.workspace = 'project_state';
    state.selectedCanvasNode = selectedNode || selectedNodeForVariableDraft(state.baseDraft);
    state.deleteProposal = null;
    state.model = buildTemplateModel({values: {}, entry: {source: 'Project State'}});
    state.status = t(statusKey, statusKey === 'projectState.status.deleteSelected'
      ? 'Selected variable loaded for deletion review.'
      : statusKey === 'projectState.status.editSelected' ? 'Selected variable loaded for editing.' : 'New variable draft ready.');
    showWorkspace('variables');
    render();
  }

  function selectedProjectStateVariable() {
    const name = selectedProjectStateVariableName();
    const variables = Array.isArray(state.projectIndex && state.projectIndex.variables) ? state.projectIndex.variables : [];
    if (name) {
      const found = variables.find((item) => item && String(item.name || '') === name);
      if (found) {
        return found;
      }
      return null;
    }
    const draftName = state.model && state.model.changeState && state.model.changeState.draft && state.model.changeState.draft.variableName;
    if (draftName) {
      const draftFound = variables.find((item) => item && String(item.name || '') === String(draftName));
      if (draftFound) {
        return draftFound;
      }
    }
    return variables[0] || null;
  }

  function selectedProjectStateVariableName() {
    const selected = String(state.selectedCanvasNode || '');
    return selected.indexOf('variable:') === 0 ? selected.slice('variable:'.length) : '';
  }

  function newVariableDraft() {
    const core = global.ProjectMapVariableEditorDraft;
    if (core && typeof core.defaultDraft === 'function') {
      return core.defaultDraft(state.projectIndex);
    }
    const variableName = nextAvailableVariableName('new_variable');
    const draft = {
      schemaVersion: '0.1',
      kind: 'variable_editor',
      id: variableName,
      title: 'New Variable',
      mode: 'add_new',
      variableName,
      label: labelFromVariableName(variableName),
      initialValue: '0',
      valueType: 'number',
      description: '',
      includeRootInit: true,
      includePostEventInit: false,
      includeQualityFile: true,
      evidence: core && typeof core.buildVariableModel === 'function' ? core.buildVariableModel(state.projectIndex) : {}
    };
    return core && typeof core.normalizeDraft === 'function' ? core.normalizeDraft(draft) : draft;
  }

  function selectedNodeForVariableDraft(draft) {
    const name = draft && draft.variableName ? String(draft.variableName) : '';
    return name ? 'variable:' + name : 'object';
  }

  function nextAvailableVariableName(baseName) {
    const core = global.ProjectMapVariableEditorDraft;
    if (core && typeof core.uniqueVariableName === 'function') {
      return core.uniqueVariableName(state.projectIndex, baseName || 'new_variable');
    }
    const base = safeDraftId(baseName || 'new_variable');
    const variables = Array.isArray(state.projectIndex && state.projectIndex.variables) ? state.projectIndex.variables : [];
    const existing = new Set(variables.map((item) => String(item && item.name || '')).filter(Boolean));
    if (!existing.has(base)) {
      return base;
    }
    let index = 2;
    let next = base + '_' + index;
    while (existing.has(next)) {
      index += 1;
      next = base + '_' + index;
    }
    return next;
  }

  function labelFromVariableName(name) {
    return String(name || 'New Variable')
      .replace(/^q_/, '')
      .replace(/_/g, ' ')
      .replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }

  function editVariableDraft(variable) {
    const core = global.ProjectMapVariableEditorDraft;
    return core && typeof core.draftFromVariable === 'function'
      ? core.draftFromVariable(variable, state.projectIndex)
      : Object.assign(newVariableDraft(), {
        id: 'edit_' + safeDraftId(String(variable && variable.name || 'variable')),
        title: 'Edit ' + String(variable && variable.name || 'Variable'),
        mode: 'edit_existing',
        variableName: String(variable && variable.name || ''),
        includeRootInit: false,
        includePostEventInit: false,
        includeQualityFile: false
      });
  }

  function deleteVariableDraft(variable) {
    const core = global.ProjectMapVariableEditorDraft;
    return core && typeof core.deleteDraftFromVariable === 'function'
      ? core.deleteDraftFromVariable(variable, state.projectIndex)
      : Object.assign(newVariableDraft(), {
        id: 'delete_' + safeDraftId(String(variable && variable.name || 'variable')),
        title: 'Delete ' + String(variable && variable.name || 'Variable'),
        mode: 'delete_existing',
        variableName: String(variable && variable.name || ''),
        includeRootInit: false,
        includePostEventInit: false,
        includeQualityFile: false
      });
  }

  function safeDraftId(value) {
    const text = String(value || 'variable')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return /^[A-Za-z_]/.test(text) ? text : 'variable_' + (text || 'item');
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
    if (action === 'event') {
      openStandaloneEventDraft(relatedDraftContext(target));
      return;
    }
    const branchApi = global.ProjectMapAuthoringReferenceIndex;
    const context = relatedDraftContext(target);
    const branch = branchApi && typeof branchApi.branchDraft === 'function'
      ? branchApi.branchDraft(action, state.model || {}, context)
      : null;
    if (branch && String(branch.template || '') === 'event' && branch.draft) {
      openRelatedEventDraft(branch, context, action);
      return;
    }
    if (branch && branch.draft && openRelatedTemplateDraft(branch, context, action)) {
      return;
    }
    const api = storyboardWorkspaceApi(); if (api && typeof api.createRelatedDraft === 'function') { api.createRelatedDraft(state, action, target, {render, t}); }
  }

  function relatedDraftContext(target) {
    const dataset = target && target.dataset || {};
    const insertKey = String(dataset.contentStoryboardInsert || dataset.contentStoryboardLane || '');
    return {
      insertKey,
      view: state.storyboardView,
      storyCanvasCategory: state.storyCanvasCategory || 'story',
      storySearchQuery: state.storySearchQuery || '',
      selectedKey: state.selectedCanvasNode,
      storyScopeMode: state.storyScopeMode,
      storyScopeWindow: insertKey || state.storyScopeWindow,
      storyChainDepth: state.storyChainDepth,
      paletteDropContext: state.storyPaletteDropContext
    };
  }

  function openRelatedEventDraft(branch, context, action) {
    const previousBranches = draftBranchList().filter((item) => !draftBranchMatches(item, branch));
    const draft = branch.draft || {};
    const opened = openTemplate('event', draft, {source: 'Storyboard', action: 'create_' + String(action || 'followup')});
    if (!opened) {
      return false;
    }
    state.draftBranches = previousBranches;
    restoreStoryboardContextAfterDraftOpen(context, draft, branch);
    state.status = t('objectCanvas.status.branchOpened', 'New event draft opened on the Storyboard.');
    showWorkspace('event');
    render();
    return true;
  }

  function openRelatedTemplateDraft(branch, context, action) {
    const template = normalizeTemplate(branch && branch.template || '');
    if (template !== 'card' && template !== 'news') {
      return false;
    }
    const draft = template === 'card'
      ? relatedCardDraft(branch, context, action)
      : relatedNewsDraft(branch, context, action);
    const opened = openTemplate(template, draft, {source: 'Storyboard', action: 'create_' + String(action || template), template});
    if (!opened) {
      return false;
    }
    if (template === 'card') {
      const key = draftStoryboardKey('card', draft, branch);
      state.cardBoardSelectedKey = key;
      state.selectedCanvasNode = key;
      state.cardBoardLane = 'drafts';
      state.cardBoardDropContext = {
        itemKey: key,
        itemTitle: draft.title || draft.heading || branch.title || '',
        laneKey: 'drafts',
        laneLabel: t('cardBoard.lane.drafts', 'Drafts'),
        laneTag: '',
        action: 'create_related_card',
        sourceKey: context && context.selectedKey || ''
      };
      state.model = buildTemplateModel({values: state.values, entry: {source: 'Storyboard', action: 'create_' + String(action || template)}});
      state.status = t('objectCanvas.status.relatedCardOpened', 'Related card draft opened for editing.');
      showWorkspace('card');
      render();
      return true;
    }
    restoreStoryboardContextAfterDraftOpen(context, draft, branch);
    state.status = t('objectCanvas.status.relatedNewsOpened', 'Related news draft opened for editing.');
    showWorkspace('news');
    render();
    return true;
  }

  function relatedCardDraft(branch, context, action) {
    const base = cloneDraft(safeDefaultDraftForTemplate('card'));
    const sourceTitle = relatedSourceTitle();
    const branchDraft = cloneDraft(branch && branch.draft || {});
    const id = uniqueDraftId(branchDraft.id || branch && branch.id || 'related_card');
    const title = branchDraft.title || branchDraft.heading || relatedTitle(t('objectCanvas.branch.card', 'Related card'), sourceTitle);
    return Object.assign({}, base, branchDraft, {
      schemaVersion: String(branchDraft.schemaVersion || base.schemaVersion || '0.1'),
      kind: 'card',
      id,
      title,
      heading: branchDraft.heading || title,
      introParagraphs: ensureArray(branchDraft.introParagraphs).length
        ? branchDraft.introParagraphs
        : [relatedDescription(t('objectCanvas.branch.card.detail', 'Card created from the selected beat.'), sourceTitle)],
      options: ensureArray(branchDraft.options).length ? branchDraft.options : ensureArray(base.options),
      studioAuthoringContext: {
        workspace: 'content',
        surface: 'card_board',
        selectedCardKey: 'draft:card:' + id,
        selectedLane: 'drafts',
        cardBoardQuery: '',
        cardBoardType: 'all',
        cardBoardDropContext: {
          itemKey: 'draft:card:' + id,
          itemTitle: title,
          laneKey: 'drafts',
          laneLabel: t('cardBoard.lane.drafts', 'Drafts'),
          laneTag: '',
          action: 'create_' + String(action || 'card'),
          sourceKey: context && context.selectedKey || ''
        },
        editorOverlay: false
      }
    });
  }

  function relatedNewsDraft(branch, context, action) {
    const base = cloneDraft(safeDefaultDraftForTemplate('news'));
    const sourceTitle = relatedSourceTitle();
    const branchDraft = cloneDraft(branch && branch.draft || {});
    const id = uniqueDraftId(branchDraft.id || branch && branch.id || 'related_news');
    const headline = branchDraft.headline || branchDraft.title || relatedTitle(t('objectCanvas.branch.news', 'Related news'), sourceTitle);
    return Object.assign({}, base, branchDraft, {
      schemaVersion: String(branchDraft.schemaVersion || base.schemaVersion || '0.1'),
      kind: 'news_item',
      id,
      headline,
      description: branchDraft.description || relatedDescription(t('objectCanvas.branch.news.detail', 'News item attached to this story moment.'), sourceTitle),
      studioAuthoringContext: Object.assign({}, context || {}, {
        workspace: 'content',
        surface: 'content_storyboard',
        action: 'create_' + String(action || 'news'),
        selectedCanvasNode: context && context.selectedKey || ''
      })
    });
  }

  function relatedSourceTitle() {
    return String(state.model && (state.model.title || state.model.objectId) || '').trim();
  }

  function relatedTitle(prefix, sourceTitle) {
    return sourceTitle ? prefix + ': ' + sourceTitle : prefix;
  }

  function relatedDescription(fallback, sourceTitle) {
    return sourceTitle ? fallback + ' ' + sourceTitle : fallback;
  }

  function openStandaloneEventDraft(context) {
    const previousBranches = draftBranchList();
    const draft = standaloneEventDraft(context);
    const opened = openTemplate('event', draft, {source: 'Storyboard', action: 'create_event'});
    if (!opened) {
      return false;
    }
    state.draftBranches = previousBranches;
    restoreStoryboardContextAfterDraftOpen(context, draft, null);
    state.status = t('objectCanvas.status.newEventOpened', 'New blank event draft opened on the Storyboard.');
    showWorkspace('event');
    render();
    return true;
  }

  function openElectionEventDraft(context) {
    const previousBranches = draftBranchList();
    const draft = electionEventDraft(context);
    const opened = openTemplate('event', draft, {source: 'Election Results', action: 'create_election_event'});
    if (!opened) {
      return false;
    }
    state.draftBranches = previousBranches;
    restoreStoryboardContextAfterDraftOpen(context || {}, draft, null);
    state.status = t('electionResults.status.newEventOpened', 'New election event draft opened on the Storyboard.');
    showWorkspace('event');
    render();
    return true;
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
    state.storyboardView = String(context && context.view || '') === 'chain' ? 'chain' : 'timeline';
    state.storyCanvasCategory = normalizeStoryCanvasCategory(context && context.storyCanvasCategory);
    state.storySearchQuery = String(context && context.storySearchQuery || '');
    state.storyScopeMode = String(context && context.storyScopeMode || '') === 'expanded' ? 'expanded' : 'focus';
    state.storyScopeWindow = String(context && (context.insertKey || context.storyScopeWindow) || '');
    state.storyChainDepth = normalizeStoryDepth(context && context.storyChainDepth);
    state.storyPaletteDropContext = context && context.paletteDropContext || null;
    state.selectedCanvasNode = draftStoryboardKey(state.template || branch && branch.template || 'event', draft, branch);
    state.editorOverlay = true;
    state.values = {};
    state.valueOriginals = {};
    resetStructureCommands();
    state.model = buildTemplateModel({values: state.values, source: 'Storyboard'});
  }

  function standaloneEventDraft(context) {
    const base = cloneDraft(safeDefaultDraftForTemplate('event'));
    const year = insertYearFromKey(context && (context.insertKey || context.storyScopeWindow)) || draftYear(base) || 1936;
    const id = uniqueDraftId('new_world_event' + (year ? '_' + year : ''));
    const title = t('create.sample.eventTitle', 'New world event');
    const heading = t('create.sample.eventHeading', title);
    const when = Object.assign({}, base.when || {}, {
      year,
      monthStart: numberOr(base.when && base.when.monthStart, 1),
      monthEnd: numberOr(base.when && base.when.monthEnd, 3),
      requires: String(base.when && base.when.requires || ''),
      priority: numberOr(base.when && base.when.priority, 0)
    });
    return Object.assign({}, base, {
      schemaVersion: String(base.schemaVersion || '0.1'),
      kind: 'world_event',
      id,
      title,
      heading,
      seenFlag: id + '_seen',
      when,
      studioAuthoringContext: Object.assign({}, context || {}, {
        workspace: 'content',
        surface: 'content_storyboard',
        action: 'create_event',
        selectedCanvasNode: context && context.selectedKey || ''
      })
    });
  }

  function electionEventDraft(context) {
    const base = standaloneEventDraft(context || {});
    const year = draftYear(base) || 1936;
    const id = uniqueDraftId('new_election_event_' + year);
    const title = t('electionResults.sample.eventTitle', 'New election results');
    const primaryOption = {
      id: 'continue_after_election',
      label: t('electionResults.sample.optionLabel', 'Continue after the election'),
      subtitle: '',
      chooseIf: '',
      unavailableText: '',
      effects: [],
      narrativeParagraphs: [t('electionResults.sample.optionResult', 'The election result changes the political balance.')],
      variants: [],
      gotoAfter: 'post_election_followup'
    };
    const secondaryOption = {
      id: 'review_election_balance',
      label: t('electionResults.sample.optionLabelAlt', 'Review the coalition balance'),
      subtitle: '',
      chooseIf: '',
      unavailableText: '',
      effects: [],
      narrativeParagraphs: [t('electionResults.sample.optionResultAlt', 'The result remains open for follow-up political choices.')],
      variants: [],
      gotoAfter: 'post_election_review'
    };
    return Object.assign({}, base, {
      id,
      title,
      heading: title,
      seenFlag: id + '_seen',
      introParagraphs: [t('electionResults.sample.intro', 'Write the election result text here. Use the Election Results workspace to shape the chart, table, conditions, and consequences.')],
      effectsOnTrigger: [],
      options: [primaryOption, secondaryOption],
      studioAuthoringContext: Object.assign({}, base.studioAuthoringContext || {}, context || {}, {
        workspace: 'content',
        surface: 'content_storyboard',
        action: 'create_election_event',
        selectedCanvasNode: context && context.selectedKey || ''
      })
    });
  }

  function cloneDraft(value) {
    try {
      return JSON.parse(JSON.stringify(value || {}));
    } catch (_err) {
      return Object.assign({}, value || {});
    }
  }

  function insertYearFromKey(value) {
    const match = String(value || '').match(/^time:(\d{3,4})$/);
    return match ? Number(match[1]) : 0;
  }

  function draftYear(draft) {
    return Number(draft && draft.when && draft.when.year || draft && draft.year || 0) || 0;
  }

  function uniqueDraftId(baseId) {
    const root = safeDraftId(baseId || 'new_world_event');
    const used = new Set();
    ensureArray(state.projectIndex && state.projectIndex.scenes).forEach((scene) => {
      if (scene && scene.id) {
        used.add(String(scene.id));
      }
    });
    draftBranchList().forEach((branch) => {
      const id = branchId(branch);
      if (id) {
        used.add(id);
      }
    });
    if (state.baseDraft && state.baseDraft.id) {
      used.add(String(state.baseDraft.id));
    }
    if (!used.has(root)) {
      return root;
    }
    for (let index = 2; index < 1000; index += 1) {
      const candidate = root + '_' + index;
      if (!used.has(candidate)) {
        return candidate;
      }
    }
    return root + '_' + Date.now();
  }

  function numberOr(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function discardDraftCard(target) {
    const card = target && target.closest ? target.closest('[data-content-storyboard-card]') : null;
    const key = String(target && target.dataset && target.dataset.storyboardDraftKey || card && card.dataset && card.dataset.contentStoryboardCard || '').trim();
    const currentKey = currentDraftStoryboardKey();
    state.draftBranches = draftBranchList().filter((branch) => !draftBranchKeyMatches(branch, key));
    if (key && currentKey && key === currentKey && state.mode !== 'existing') {
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
      return;
    }
    if (state.selectedCanvasNode === key) {
      state.selectedCanvasNode = currentKey || 'object';
    }
    state.status = t('objectCanvas.status.draftDeleted', 'Draft card discarded.');
    render();
  }

  function selectExistingStoryObject(key) {
    const parsed = storyObjectFromKey(key);
    if (!parsed || parsed.kind === 'draft' || parsed.kind === 'route') {
      return false;
    }
    const itemId = parsed.parentId || parsed.id;
    const nextModel = buildExistingModelFor(parsed.view, itemId, {values: {}});
    if (!nextModel || !nextModel.ok) {
      return false;
    }
    state.mode = 'existing';
    state.template = 'existing';
    state.view = parsed.view;
    state.item = itemId;
    state.workspace = 'content';
    state.selectedCanvasNode = key;
    state.editorOverlay = true;
    state.values = {};
    state.valueOriginals = {};
    resetStructureCommands();
    state.baseDraft = null;
    state.deleteProposal = null;
    state.model = nextModel;
    showWorkspace(parsed.view === 'cards' ? 'card' : 'existing');
    render();
    return true;
  }

  function storyObjectFromKey(key) {
    const match = String(key || '').match(/^(event|card|advisor|news|section|route|draft):(.+)$/);
    if (!match) {
      return null;
    }
    const kind = match[1];
    const id = match[2];
    if (kind === 'section') {
      return {kind, id, parentId: String(id || '').split('.')[0] || '', view: 'events'};
    }
    return {kind, id, view: kind === 'event' ? 'events' : kind === 'card' || kind === 'advisor' ? 'cards' : kind};
  }

  function currentDraftStoryboardKey() {
    if (state.mode === 'existing') {
      return '';
    }
    return draftStoryboardKey(state.template || 'event', state.baseDraft || {}, null);
  }

  function draftStoryboardKey(template, draft, branch) {
    const value = draft || {};
    const id = String(value.id || branch && branch.id || 'new_event');
    const kind = normalizeTemplate(template) === 'news' ? 'news' : normalizeTemplate(template) === 'card' ? 'card' : 'event';
    return 'draft:' + kind + ':' + id;
  }

  function draftBranchList() {
    return Array.isArray(state.draftBranches) ? state.draftBranches.slice() : [];
  }

  function draftBranchMatches(a, b) {
    return branchId(a) && branchId(a) === branchId(b);
  }

  function draftBranchKeyMatches(branch, key) {
    const text = String(key || '').trim();
    if (!text) {
      return false;
    }
    const id = branchId(branch);
    return text === 'draft:' + id || text === 'draft:event:' + id || text === 'draft:card:' + id || text === 'draft:news:' + id;
  }

  function branchId(branch) {
    return String(branch && (branch.id || branch.draft && branch.draft.id) || '').trim();
  }

  function normalizeStoryCanvasCategory(value) {
    const text = String(value || 'story');
    return text === 'cards' || text === 'all' ? text : 'story';
  }

  function normalizeStoryDepth(value) {
    const text = String(value || '1');
    return text === '2' || text === 'full' ? text : '1';
  }

  function toggleEditorOverlay(next) {
    state.editorOverlay = next === undefined ? !state.editorOverlay : Boolean(next);
    state.values = collectValues();
    state.model = state.mode === 'existing' ? buildExistingModel({values: state.values}) : buildTemplateModel({values: state.values});
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
    const output = builder.querySelector('[data-preview-object-structure-output]');
    const value = output ? String(output.value || '').trim() : '';
    if (!value) {
      state.status = t('objectCanvas.status.structureCommandEmpty', 'Fill in the structure fields before adding it.');
      updateDynamicSurfaces();
      return;
    }
    const action = builder.dataset.previewObjectStructureBuilder || '';
    const fieldId = builder.dataset.previewObjectStructureFieldId || output && output.dataset.objectCanvasField || '';
    const command = {
      id: 'structure_command_' + (++state.structureCommandCounter),
      type: action,
      action,
      fieldId,
      optionId: builder.dataset.previewObjectStructureOptionId || '',
      sectionId: builder.dataset.previewObjectStructureSectionId || '',
      targetLabel: builder.dataset.previewObjectStructureTargetLabel || '',
      value,
      mode: state.mode === 'existing' ? 'manual_review' : 'draft'
    };
    state.structureCommands = (state.structureCommands || []).concat(command);
    state.values = collectValues();
    if (fieldId) {
      delete state.values[fieldId];
      delete state.valueOriginals[fieldId];
    }
    clearStructureBuilder(builder);
    state.model = state.mode === 'existing' ? buildExistingModel({values: state.values}) : buildTemplateModel({values: state.values});
    state.status = t('objectCanvas.status.structureCommandQueued', 'Structure command added to the current proposal.');
    render({scrollSnapshot});
  }

  function clearStructureBuilder(builder) {
    if (!builder) {
      return;
    }
    builder.querySelectorAll('[data-preview-object-structure-part]').forEach((input) => {
      if (input.tagName === 'SELECT') {
        input.selectedIndex = 0;
      } else {
        input.value = '';
      }
    });
    const output = builder.querySelector('[data-preview-object-structure-output]');
    if (output) {
      output.value = '';
    }
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
      : state.mode === 'existing' ? buildExistingModel({values: state.values}) : buildTemplateModel({values: state.values});
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
    elements.host.querySelectorAll('[data-object-canvas-field]').forEach((input) => {
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

  function syncStructureBuilder(builder) {
    if (!builder) {
      return;
    }
    const output = builder.querySelector('[data-preview-object-structure-output]');
    if (!output) {
      return;
    }
    const action = builder.dataset.previewObjectStructureBuilder || '';
    const parts = {};
    builder.querySelectorAll('[data-preview-object-structure-part]').forEach((input) => {
      parts[input.dataset.previewObjectStructurePart || ''] = String(input.value || '').trim();
    });
    const next = composeStructureValue(action, parts);
    if (output.value === next) {
      return;
    }
    output.value = next;
    output.dispatchEvent(new global.Event('input', {bubbles: true}));
  }

  function composeStructureValue(action, parts) {
    if (action === 'add_option') {
      const label = String(parts.option_label || '').trim();
      const result = String(parts.result_text || '').trim();
      const chooseIf = String(parts.choose_if || '').trim();
      const unavailableText = String(parts.unavailable_text || '').trim();
      const target = String(parts.target_id || '').trim() || slugForStructure(label) || 'new_option';
      if (!label && !result && !String(parts.target_id || '').trim() && !chooseIf && !unavailableText) {
        return '';
      }
      return [
        '- @' + target + ': ' + (label || 'Player-facing option text'),
        '# ' + target,
        chooseIf ? 'choose-if: ' + chooseIf : '',
        unavailableText ? 'unavailable-subtitle: ' + unavailableText : '',
        result || 'Result prose.'
      ].filter(Boolean).join('\n');
    }
    if (action === 'add_branch') {
      const section = String(parts.section_id || '').trim() || 'follow_up';
      const condition = String(parts.condition || '').trim();
      const text = String(parts.branch_text || '').trim();
      if (!String(parts.section_id || '').trim() && !condition && !text) {
        return '';
      }
      return ['# ' + section, condition ? '[? if ' + condition + ' : ' + (text || 'Conditional prose.') + ' ?]' : (text || 'Follow-up prose.')].join('\n');
    }
    if (action === 'add_trigger_effect' || action === 'add_option_effect') {
      const variable = String(parts.variable || '').trim().replace(/^Q\./, '');
      const op = String(parts.operation || '+=').trim() || '+=';
      const value = String(parts.value || '').trim();
      const condition = String(parts.condition || '').trim();
      if (!variable || !value) {
        return '';
      }
      return 'Q.' + variable + ' ' + op + ' ' + value + (condition ? ' if ' + condition : '');
    }
    return '';
  }

  function slugForStructure(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48);
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
      title.textContent = headerTitle(state.model, currentSurface(state.model));
    }
    syncPreviewObjectEditorChrome();
    syncPreviewObjectEditorPane();
    syncObjectCanvasFieldValues();
    syncPreviewObjectRenderedFields();
    const panel = elements.host.querySelector('[data-runtime-lens-panel]');
    if (panel && state.runtimeLensStatus === 'stale') {
      panel.dataset.runtimeLensStatus = 'stale';
      panel.classList.add('is-stale');
      const message = panel.querySelector('[data-runtime-lens-message]');
      if (message) {
        message.textContent = t('runtimeLens.draftStale', 'Lens is behind the current edit. Refresh or rebuild it to observe the latest draft.');
      }
    }
  }

  function syncPreviewObjectEditorPane() {
    if (!elements || !elements.host || !state.model) {
      return;
    }
    const editor = global.ProjectMapPreviewObjectEditor;
    if (!editor || typeof editor.renderPreviewPane !== 'function') {
      return;
    }
    elements.host.querySelectorAll('[data-object-editing-modal-preview-pane]').forEach((node) => {
      node.innerHTML = editor.renderPreviewPane(state.model, {
        template: state.template,
        selectedKey: state.selectedCanvasNode
      });
    });
  }

  function syncPreviewObjectRenderedFields() {
    if (!elements || !elements.host || !state.model) {
      return;
    }
    const editor = global.ProjectMapPreviewObjectEditor;
    if (!editor || typeof editor.renderTextBlocks !== 'function') {
      return;
    }
    const fields = previewObjectFieldMap(state.model);
    elements.host.querySelectorAll('[data-preview-object-rendered-for]').forEach((node) => {
      const key = node.dataset && node.dataset.previewObjectRenderedFor;
      const input = key ? elements.host.querySelector('[data-object-canvas-field="' + cssEscape(key) + '"]') : null;
      const field = key ? fields.get(key) : null;
      const value = input ? input.value : field && field.value !== undefined ? field.value : field && field.original || '';
      node.innerHTML = editor.renderTextBlocks(value, {empty: false});
    });
  }

  function previewObjectFieldMap(model) {
    const map = new Map();
    const body = model && model.eventBody || {};
    [body.title, body.heading].forEach(addField);
    ensureArray(body.sections).forEach(addField);
    ensureArray(body.metaFields).forEach(addField);
    ensureArray(body.structureActions).forEach(addField);
    ensureArray(body.effects).forEach(addField);
    ensureArray(body.options).forEach((option) => {
      ensureArray(option && option.fields).forEach(addField);
    });
    ensureArray(body.optionEffects).forEach((group) => {
      ensureArray(group && group.fields).forEach(addField);
    });
    return map;

    function addField(field) {
      const id = field && field.id;
      if (id) {
        map.set(String(id), field);
      }
    }
  }

  function syncPreviewObjectEditorChrome() {
    if (!elements || !elements.host || !state.model) {
      return;
    }
    const title = headerTitle(state.model, currentSurface(state.model));
    [
      '[data-preview-object-editor-title]',
      '[data-content-storyboard-selected-title]',
      '[data-card-face-selected-title]',
      '.content-storyboard-card.is-selected .content-storyboard-title'
    ].forEach((selector) => {
      elements.host.querySelectorAll(selector).forEach((node) => {
        if (node && !node.matches('input, textarea, select')) {
          if (selector === '[data-preview-object-editor-title]') {
            node.innerHTML = renderVisibleTextInline(title);
          } else {
            node.textContent = title;
          }
        }
      });
    });
    const footer = elements.host.querySelector('[data-preview-object-draft-summary]');
    if (footer) {
      footer.innerHTML = renderPreviewObjectDraftSummary(state.model);
    }
  }

  function renderVisibleTextInline(value) {
    const renderer = global.ProjectMapVisibleTextRenderer;
    return renderer && typeof renderer.renderInline === 'function'
      ? renderer.renderInline(value)
      : escapeHtml(value);
  }

  function renderPreviewObjectDraftSummary(model) {
    const change = model && model.changeState || {};
    const summary = change.operationSummary || {};
    const route = previewObjectRouteLabel(model);
    return [
      '<div><span>' + escapeHtml(t('objectCanvas.changedFields', 'Changed')) + '</span><strong>' + escapeHtml(String(change.changedCount || 0)) + '</strong></div>',
      '<div><span>' + escapeHtml(t('editing.summary.guarded', 'Guarded')) + '</span><strong>' + escapeHtml(String(summary.guardedApply || 0)) + '</strong></div>',
      '<div><span>' + escapeHtml(t('editing.summary.manual', 'Manual')) + '</span><strong>' + escapeHtml(String(summary.manualReview || 0)) + '</strong></div>',
      '<div><span>' + escapeHtml(t('previewObjectEditor.route', 'Editor route')) + '</span><strong>' + escapeHtml(route) + '</strong></div>'
    ].join('');
  }

  function previewObjectRouteLabel(model) {
    const value = String(model && (model.template || model.objectKind || model.mode) || state.template || '').trim();
    if (value === 'news' || value === 'news_item' || value === 'new_news') {
      return t('objectPreview.news', 'News');
    }
    if (value === 'card' || value === 'new_card') {
      return t('objectPreview.card', 'Card');
    }
    if (value === 'surface' || value === 'surface_text' || value === 'text') {
      return t('objectPreview.textPatch', 'Text Patch');
    }
    return t('objectPreview.event', 'World Event');
  }

  function syncObjectCanvasFieldValues() {
    if (!elements || !elements.host) {
      return;
    }
    const active = global.document && global.document.activeElement;
    const values = state.values || {};
    elements.host.querySelectorAll('[data-object-canvas-field]').forEach((input) => {
      const key = input.dataset && input.dataset.objectCanvasField;
      if (!key || !Object.prototype.hasOwnProperty.call(values, key) || input === active) {
        return;
      }
      const next = String(values[key] === undefined || values[key] === null ? '' : values[key]);
      if (input.type === 'checkbox') {
        input.checked = /^(1|true|yes|on)$/i.test(next);
        return;
      }
      if (input.value !== next) {
        input.value = next;
      }
    });
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
  function runtimeLensWorkspaceApi() { return global.ProjectMapRuntimeLensWorkspaceState || null; }
  function cardWorkspaceApi() { return global.ProjectMapCardWorkspaceState || null; }
  function cardDeps(entry) { return {buildExistingModel, buildExistingModelFor, buildTemplateModel, collectValues, defaultDraftForTemplate, entry, render, showWorkspace, t}; }
  function runtimeLensDeps() { return {buildExistingModel, buildTemplateModel, collectValues, render}; }

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

  function installPlanApi() {
    return global.ProjectMapInstallPlan || null;
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
