(function initProjectMapObjectAuthoringCanvas(global) {
  'use strict';

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const ensureArray = domTextUtils.ensureArray;
  const escapeHtml = domTextUtils.escapeHtml;
  const escapeAttr = domTextUtils.escapeAttr;

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
    systemUiPlayerFlowScreen: '',
    systemUiFocusFieldId: '',
    systemUiReplacementText: '',
    systemUiManualReason: '',
    systemUiSelectedTaskId: '',
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
    draftWorkspaceId: '',
    draftSavedSnapshot: '',
    model: null,
    status: ''
  };

  let elements = null; let templateClickToken = 0; let reconcileToken = 0; let refreshTimer = null; let pendingRebuildHandle = 0; let refreshGeneration = 0; let projectStateSearchTimer = null; let projectStateSearchFocus = null;

  const api = {
    openFromSelection,
    openVisibleEditAction,
    openTemplate,
    openNewEvent,
    loadDraft,
    refresh,
    getDraft: draftWithAuthoringContext,
    getOutput: () => state.model && state.model.changeState && state.model.changeState.output,
    getDraftWorkspaceId: () => state.draftWorkspaceId || '',
    setDraftWorkspaceId,
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
        openTemplateFromCreate(template, {forceNew: shouldOpenFreshDraftFromTemplateClick(template, source)});
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
    cancelPendingRebuild();
    refreshGeneration++;
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
      const root = index.project && index.project.root || '';
      const storyApi = storyboardWorkspaceApi();
      if (root && storyApi && typeof storyApi.setProjectId === 'function') {
        storyApi.setProjectId(root);
      }
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
    if (values && Object.prototype.hasOwnProperty.call(values, 'event.pattern') && eventPatternChangeShouldMaterialize(values)) {
      return true;
    }
    return Object.keys(values || {}).some((key) => {
      return /^structure_remove_/.test(String(key || '')) && truthyStructureValue(values[key]);
    });
  }

  function eventPatternChangeShouldMaterialize(values) {
    if (!values || !Object.prototype.hasOwnProperty.call(values, 'event.pattern')) {
      return false;
    }
    if (truthyStructureValue(values.eventPatternReset || values['event.patternReset'])) {
      return true;
    }
    const adapters = contentAdaptersApi();
    if (!adapters || typeof adapters.eventPatternForDraft !== 'function') {
      return true;
    }
    const current = adapters.eventPatternForDraft(state.baseDraft || {});
    return String(values['event.pattern'] || '') !== String(current || '');
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
    state.systemUiPlayerFlowScreen = '';
    state.systemUiFocusFieldId = '';
    state.systemUiReplacementText = '';
    state.systemUiManualReason = '';
    state.systemUiSelectedTaskId = '';
    state.systemUiFocusFieldId = String(opts.focusFieldId || '');
    state.systemUiReplacementText = String(opts.replacementText || '');
    state.systemUiManualReason = String(opts.manualReason || '');
    state.systemUiSelectedTaskId = String(opts.selectedTaskId || '');
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
    // Cancel pending rebuilds from the previous view (same rationale as openTemplate).
    if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
    cancelPendingRebuild();
    refreshGeneration++;
    templateClickToken += 1;
    reconcileToken += 1;
    if (projectIndex) {
      state.projectIndex = projectIndex;
    }
    const previousBranches = storyboardDraftsApi().withCurrentDraftBranch
      ? storyboardDraftsApi().withCurrentDraftBranch(state, draftBranchList(), storyboardDraftDeps())
      : draftBranchList();
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
    state.systemUiPlayerFlowScreen = '';
    state.systemUiFocusFieldId = String(options && options.focusFieldId || '');
    state.systemUiReplacementText = String(options && options.replacementText || '');
    state.systemUiManualReason = String(options && options.manualReason || '');
    state.systemUiSelectedTaskId = String(options && options.selectedTaskId || '');
    state.canvasPanX = 0;
    state.canvasPanY = 0;
    state.nodePositions = {};
    state.draftBranches = previousBranches;
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
      const target = editAction.target || {};
      const template = normalizeTemplate(target.internalTemplate || editAction.internalTemplate || target.template || editAction.template || editAction.targetView || 'entry') || 'entry';
      const selectedRegion = String(target.selectedRegion || editAction.selectedRegion || '').trim();
      const focusFieldId = String(target.focusFieldId || editAction.focusFieldId || '').trim();
      const replacementText = String(editAction.replacementText || target.replacementText || editAction.value || '');
      const values = {};
      if (focusFieldId && replacementText) {
        values[focusFieldId] = replacementText;
      }
      const opened = openTemplate(template, safeDefaultDraftForTemplate(template), {
        source: 'visible_edit_action',
        actionKind: kind,
        route: editAction,
        selectedRegion,
        selectedCanvasNode: selectedRegion,
        focusFieldId,
        replacementText,
        values,
        manualReason: target.manualReason || editAction.manualReason || ''
      });
      if (opened && selectedRegion) {
        state.selectedCanvasNode = selectedRegion;
        render();
      }
      if (opened && focusFieldId) {
        const focused = focusDraftField(focusFieldId);
        state.status = focused
          ? t('objectCanvas.status.graphEntryFocused', 'Opened the matching editor field.')
          : (target.manualReason || t('objectCanvas.status.graphEntryMissing', 'Studio could not find that editor field in this draft.'));
        updateDynamicSurfaces();
      }
      return opened;
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
    if (!focused && action.source && action.source.path) {
      // Render-diet fields have no DOM node to focus; the action's own source
      // anchor still reaches them through the Source Slice workspace.
      return openSourceSliceAction(action);
    }
    state.status = focused
      ? t('objectCanvas.status.graphEntryFocused', 'Opened the matching editor field.')
      : t('objectCanvas.status.graphEntryMissing', 'Studio could not find that editor field in this draft.');
    updateDynamicSurfaces();
    return focused;
  }

  function focusDraftField(fieldId) {
    const key = String(fieldId || '').trim();
    const perfToken = perfStart('focusDraftField', {fieldId: key});
    if (!key || !elements || !elements.host) {
      perfEnd(perfToken, {found: false});
      return false;
    }
    const field = elements.host.querySelector('[data-object-canvas-field="' + cssEscape(key) + '"]');
    if (!field) {
      perfEnd(perfToken, {found: false});
      return false;
    }
    const details = field.closest && field.closest('details');
    if (details) {
      details.open = true;
    }
    const focusRoot = field.closest && field.closest('[data-preview-object-inline-add], [data-preview-object-structure-builder], .preview-object-frame');
    const focusTarget = field.matches && field.matches('input[type="hidden"]') && focusRoot
      ? focusRoot.querySelector('input:not([type="hidden"]), textarea, select, button')
      : field;
    const target = focusTarget || field;
    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({block: 'center', inline: 'nearest'});
    } else if (typeof field.scrollIntoView === 'function') {
      field.scrollIntoView({block: 'center', inline: 'nearest'});
    }
    if (typeof target.focus === 'function') {
      target.focus();
    }
    if (typeof target.select === 'function' && /input|textarea/i.test(target.tagName || '')) {
      target.select();
    }
    perfEnd(perfToken, {found: true});
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
    // Cancel any pending deferred refresh (e.g. from overlay_close) immediately.
    // Without this, a queued rIC from the previous view runs a 300-500ms
    // buildExistingModelFor for an event the user is no longer looking at,
    // blocking the Create page transition.
    if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
    cancelPendingRebuild();
    refreshGeneration++;
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
    state.systemUiPlayerFlowScreen = '';
    state.systemUiFocusFieldId = String(meta && meta.focusFieldId || '');
    state.systemUiReplacementText = String(meta && meta.replacementText || '');
    state.systemUiManualReason = String(meta && meta.manualReason || '');
    state.systemUiSelectedTaskId = String(meta && meta.selectedTaskId || '');
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
    state.draftWorkspaceId = meta && meta.workspaceId ? String(meta.workspaceId) : '';
    state.draftSavedSnapshot = state.draftWorkspaceId ? savedDraftSnapshot(state.baseDraft) : '';
    state.proposalOptions = null;
    clearTransientReturnStack();
    if (nextTemplate === 'card') {
      state.cardBoardSelectedKey = 'draft:card:' + (state.baseDraft && state.baseDraft.id || 'new_action_card');
      state.selectedCanvasNode = state.cardBoardSelectedKey;
    } else if (nextTemplate === 'variables' && state.baseDraft && state.baseDraft.variableName) {
      state.selectedCanvasNode = 'variable:' + state.baseDraft.variableName;
    }
    if (meta && (meta.selectedCanvasNode || meta.selectedRegion)) {
      state.selectedCanvasNode = String(meta.selectedCanvasNode || meta.selectedRegion || '').trim() || state.selectedCanvasNode;
    }
    state.values = Object.assign({}, meta && meta.values || {});
    state.valueOriginals = {};
    resetStructureCommands();
    try {
      state.model = buildTemplateModel(meta || {});
    } catch (err) {
      showWorkspace(nextTemplate);
      showCanvasError(t('objectCanvas.status.canvasInitFailed', 'Object Canvas could not initialize: {error}').replace('{error}', err && err.message || String(err)));
      return false;
    }
    state.active = true;
    state.status = statusForTemplate(nextTemplate, meta);
    showWorkspace(nextTemplate);
    try {
      render();
    } catch (err) {
      showCanvasError(t('objectCanvas.status.canvasRenderFailed', 'Object Canvas render failed: {error}').replace('{error}', err && err.message || String(err)));
      return false;
    }
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
      if (opts.forceNew) {
        openFreshTemplateFromCreate(nextTemplate);
        return;
      }
      showWorkspace(nextTemplate);
      return;
    }
    if (opts.forceNew) {
      openFreshTemplateFromCreate(nextTemplate);
      return;
    }
    openTemplate(nextTemplate, safeDefaultDraftForTemplate(nextTemplate), {source: 'Create'});
  }

  function openFreshTemplateFromCreate(template) {
    const previousBranches = storyboardDraftsApi().withCurrentDraftBranch
      ? storyboardDraftsApi().withCurrentDraftBranch(state, draftBranchList(), storyboardDraftDeps())
      : draftBranchList();
    const opened = openTemplate(template, freshDefaultDraftForTemplate(template), {source: 'Create'});
    if (opened && previousBranches.length) {
      state.draftBranches = previousBranches;
      render();
    }
  }

  function shouldOpenFreshDraftFromTemplateClick(template, source) {
    const nextTemplate = normalizeTemplate(template);
    return Boolean(
      source === 'authoring-workspace' &&
      nextTemplate &&
      state.active &&
      state.mode !== 'existing' &&
      state.template === nextTemplate &&
      isCurrentTemplateRendered(nextTemplate) &&
      currentDraftMatchesSavedWorkspace()
    );
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

  function currentDraftMatchesSavedWorkspace() {
    if (!state.draftWorkspaceId || !state.draftSavedSnapshot) {
      return false;
    }
    const draft = draftWithAuthoringContext() || state.model && state.model.changeState && state.model.changeState.draft || state.baseDraft;
    return savedDraftSnapshot(draft) === state.draftSavedSnapshot;
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
    perfMeasure('refresh', () => refreshBody(opts), {source: opts.source || ''});
  }

  function refreshBody(opts) {
    if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
    cancelPendingRebuild();
    const scrollSnapshot = state.preserveScrollOnNextRefresh ? captureObjectCanvasScroll() : null;
    state.preserveScrollOnNextRefresh = false;
    if (!opts.preserveStateValues) {
      state.values = perfMeasure('refresh.collectValues', () => collectValues(), {});
    }
    state.model = perfMeasure('refresh.buildModel', () => (state.deleteProposal
      ? buildDeleteProposalModel(state.deleteProposal)
      : state.mode === 'source_slice'
      ? buildSourceSliceCanvasModel(state.sourceSliceModel, state.values)
      : state.mode === 'semantic_logic'
      ? buildSemanticLogicCanvasModel(state.semanticLogicModel, state.values)
      : state.mode === 'existing' ? buildExistingModel({values: state.values, proposalOptions: state.proposalOptions}) : buildTemplateModel({values: state.values})), {mode: state.mode || ''});
    if (!state.deleteProposal && shouldMaterializeNewEventDraft(state.values)) {
      state.model = materializeNewEventDraft(state.model);
    }
    markRuntimeLensStale();
    const surface = currentSurface(state.model);
    if (surface.key === 'source_slice_editor' || surface.key === 'semantic_logic_editor' || surface.key === 'system_ui_preview' || surface.key === 'card_board' && !activeInsidePreviewObjectEditor() || shouldRenderSurfaceRefresh(surface)) {
      render({scrollSnapshot});
      return;
    }
    updateDynamicSurfaces({
      changedFieldKeys: opts.changedFieldKeys || null
    });
    restoreObjectCanvasScroll(scrollSnapshot);
  }

  function buildExistingModel(options) {
    return buildExistingModelFor(state.view, state.item, withStructureCommandValues(options));
  }

  function buildExistingModelFor(view, item, options) {
    return perfMeasure('buildExistingModelFor', () => modelBuilderApi().buildExistingModelFor(view, item, options, modelBuilderDeps()), {
      view: String(view || ''),
      item: String(item || '')
    });
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

  function showCanvasError(message) {
    if (!elements || !elements.host) { return; }
    elements.host.innerHTML = '<div class="object-canvas-error" style="padding:32px;text-align:center;color:var(--danger,#a04040);font-size:15px;line-height:1.6;">' +
      '<p style="font-weight:700;font-size:18px;margin:0 0 8px;">' + escapeHtml(t('objectCanvas.status.canvasErrorTitle', 'Object Canvas Error')) + '</p>' +
      '<p style="margin:0;">' + escapeHtml(message) + '</p></div>';
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
        stageHtml = perfMeasure('renderCanvasStage', () => renderCanvasStage(model), {surface: surface.key || ''});
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
      : model.ok ? perfMeasure('renderBody', () => renderBody(model), {surface: surface.key || ''}) : renderUnavailable(model);
    const modalHtml = perfMeasure('renderObjectEditingModal', () => renderObjectEditingModal(model, surface), {surface: surface.key || '', editorOverlay: state.editorOverlay ? 'true' : 'false'});
    const shellHtml = shell.renderShell({
      model,
      surface,
      state,
      layoutStyle,
      stageHtml,
      modalHtml,
      bodyHtml,
      translate: t,
      surfaceLabelFor
    });
    const htmlToken = perfStart('host.innerHTML', {surface: surface.key || ''});
    elements.host.innerHTML = shellHtml;
    perfEnd(htmlToken, {bytes: shellHtml.length});
    // Full DOM replacement: cancel any pending deferred rebuild so it doesn't
    // fire a redundant 450-900ms refresh against the already-replaced DOM.
    // Also bump the generation so any in-flight rIC callback (already queued
    // but not yet run) becomes a no-op via the generation guard.
    cancelPendingRebuild();
    refreshGeneration++;
    // After a full DOM replacement, the preview pane nodes are new and need a
    // fresh sync even if the model reference hasn't changed. Clear the tracker
    // so the next updateDynamicSurfaces call always runs the pane sync.
    state._lastPreviewPaneModel = null;
    const bindToken = perfStart('bindCanvasEvents', {surface: surface.key || ''});
    bindCanvasEvents();
    perfEnd(bindToken);
    updateDynamicSurfaces({skipRenderedFieldsSync: true});
    restoreObjectCanvasScroll(scrollSnapshot);
    if (typeof global.requestAnimationFrame === 'function') {
      const paintStart = global.performance && global.performance.now ? global.performance.now() : Date.now();
      global.requestAnimationFrame(() => {
        global.requestAnimationFrame(() => {
          const paintEnd = global.performance && global.performance.now ? global.performance.now() : Date.now();
          const api = perfApi();
          if (api && typeof api.record === 'function') {
            api.record('render.paintTime', paintEnd - paintStart, {view: state.view});
          }
        });
      });
    }
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
    return surface && typeof surface.render === 'function' ? surface.render(model, {
      projectIndex: state.projectIndex,
      selected: state.selectedCanvasNode,
      fixture: state.systemUiFixture,
      playerFlowScreen: state.systemUiPlayerFlowScreen,
      editorOverlay: state.editorOverlay,
      boardChromeCollapsed: state.boardChromeCollapsed,
      runtimeLensSession: state.runtimeLensSession,
      runtimeVisualSurface: runtimeVisualSurfaceForSystemUi(),
      runtimeLensStatus: state.runtimeLensStatus,
      runtimeLensFocusKey: state.runtimeLensFocusKey,
      runtimeLensDraftKey: state.runtimeLensDraftKey,
      runtimeLensCurrentDraftKey: state.runtimeLensCurrentDraftKey,
      runtimeLensExpanded: state.runtimeLensExpanded,
      runtimeLensCollapsed: state.runtimeLensCollapsed,
      focusFieldId: state.systemUiFocusFieldId,
      replacementText: state.systemUiReplacementText,
      manualReason: state.systemUiManualReason,
      selectedTaskId: state.systemUiSelectedTaskId
    }) : '';
  }

  function runtimeVisualSurfaceForSystemUi() {
    const session = state.runtimeLensSession || {};
    return session.runtimeVisualSurface || session.visualSurface || null;
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
        const routeTargetButton = event.target && event.target.closest ? event.target.closest('[data-object-canvas-route-target-insert]') : null;
        if (routeTargetButton && elements.host.contains(routeTargetButton)) {
          event.preventDefault();
          event.__dmsObjectCanvasHandled = true;
          handleRouteTargetInsert(routeTargetButton);
          return;
        }
        const variableButton = event.target && event.target.closest ? event.target.closest('[data-object-canvas-variable-copy]') : null;
        if (variableButton && elements.host.contains(variableButton)) {
          event.preventDefault();
          event.__dmsObjectCanvasHandled = true;
          handleVariableCopy(variableButton);
          return;
        }
        const condVarButton = event.target && event.target.closest ? event.target.closest('[data-conditional-var-token]') : null;
        if (condVarButton && elements.host.contains(condVarButton)) {
          event.preventDefault();
          event.__dmsObjectCanvasHandled = true;
          handleConditionalVarInsert(condVarButton);
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
    if (!elements.host.__dmsObjectCanvasWhatIfDelegated) {
      elements.host.__dmsObjectCanvasWhatIfDelegated = true;
      elements.host.addEventListener('input', handleConditionalWhatIfInput);
      elements.host.addEventListener('input', handleConditionalLeafValidation);
      elements.host.addEventListener('input', handleConditionalFilterInput);
      elements.host.addEventListener('change', handleConditionalFilterInput);
    }
    if (!elements.host.__dmsObjectCanvasPlaySimDelegated) {
      elements.host.__dmsObjectCanvasPlaySimDelegated = true;
      elements.host.addEventListener('click', handlePlaySimClick);
      elements.host.addEventListener('input', handlePlaySimInput);
    }
    if (!elements.host.__dmsObjectCanvasReviewDetailsDelegated) {
      elements.host.__dmsObjectCanvasReviewDetailsDelegated = true;
      elements.host.addEventListener('toggle', (event) => {
        const details = event.target;
        if (!details || details.dataset.previewObjectReviewDetailsLazy !== 'pending' || !details.open) {
          return;
        }
        const previewApi = global.ProjectMapPreviewObjectEditor;
        if (!previewApi || typeof previewApi.hydrateLazyReviewDetails !== 'function' || !state.model) {
          return;
        }
        previewApi.hydrateLazyReviewDetails(details, state.model.eventBody || {}, state.model);
      }, true);
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
    if (!elements.host.__dmsObjectCanvasFieldDelegated) {
      elements.host.__dmsObjectCanvasFieldDelegated = true;
      const fieldDelegatedHandler = (event) => {
        const target = event.target;
        if (!target || !target.closest) {
          return;
        }
        const fieldEl = target.closest('[data-object-canvas-field]');
        if (fieldEl) {
          if (event.type === 'input') {
            // Live preview: rewrite only the matching [data-preview-object-rendered-for]
            // node(s) directly from the input's current value. Coalesced to one
            // rAF per frame inside updateRenderedPreviewForField. The lastInputAt
            // stamp lets the deferred refresh back off while the user is typing.
            state.lastInputAt = Date.now();
            updateRenderedPreviewForField(target);
          } else if (event.type === 'change') {
            const key = fieldEl.dataset && fieldEl.dataset.objectCanvasField || '';
            if (isPlainTextField(target)) {
              // Plain text edits cannot change event structure. Capture
              // values immediately (cheap, <20ms) so Save/Apply sees them,
              // then schedule a deferred refresh to update the canvas
              // preview (left panel). The deferred path goes through the
              // same 180ms debounce + rIC + typing back-off + generation
              // guard as structural fields, so it never fires mid-typing.
              // The ~450-900ms buildExistingModelFor only runs when the
              // user is genuinely idle.
              state.values = collectValues();
              scheduleRefresh({source: 'text_field_change', changedFieldKey: key || null});
            } else {
              scheduleRefresh({source: event.type, changedFieldKey: key || null});
            }
          }
        }
        const effectPart = target.closest('[data-object-canvas-effect-part]');
        if (effectPart) {
          syncSemanticEffectParts(effectPart, event.type);
        }
      };
      elements.host.addEventListener('input', fieldDelegatedHandler);
      elements.host.addEventListener('change', fieldDelegatedHandler);
    }
    if (global.document && typeof global.document.querySelectorAll === 'function') {
      global.document.querySelectorAll('[data-object-canvas-asset-select], [data-object-canvas-asset-file]').forEach((control) => {
        if (control.__dmsObjectCanvasAssetBound) {
          return;
        }
        control.__dmsObjectCanvasAssetBound = true;
        control.addEventListener('change', handleObjectCanvasAssetChange);
        if (control.dataset && control.dataset.assetSelectDeferred && typeof control.addEventListener === 'function') {
          control.addEventListener('focus', populateDeferredAssetSelectControl);
          control.addEventListener('mousedown', populateDeferredAssetSelectControl);
        }
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
      perfMeasure('bindCanvasEvents.sourceSliceWorkspace', () => sourceSliceWorkspace.bind(elements.host, state, sourceSliceWorkspaceDeps()), {});
    }
    const semanticLogicWorkspace = semanticLogicWorkspaceApi();
    if (semanticLogicWorkspace && typeof semanticLogicWorkspace.bind === 'function') {
      perfMeasure('bindCanvasEvents.semanticLogicWorkspace', () => semanticLogicWorkspace.bind(elements.host, state, semanticLogicWorkspaceDeps()), {});
    }
    perfMeasure('bindCanvasEvents.visibleEditUi', () => bindVisibleEditUi(elements.host), {
      visibleEditActions: elements.host.querySelectorAll('[data-visible-edit-action]').length,
      contextLensMarkers: elements.host.querySelectorAll('[data-authoring-context-lens]').length
    });
    perfMeasure('bindCanvasEvents.structureParts', () => {
      elements.host.querySelectorAll('[data-preview-object-structure-part]').forEach((input) => {
        if (input.__dmsStructureBuilderBound) {
          return;
        }
        input.__dmsStructureBuilderBound = true;
        input.addEventListener('input', () => syncStructureBuilder(input.closest('[data-preview-object-structure-builder]')));
        input.addEventListener('change', () => syncStructureBuilder(input.closest('[data-preview-object-structure-builder]')));
      });
    }, {});
    elements.host.querySelectorAll('[data-project-state-variable-search]').forEach((input) => {
      input.addEventListener('input', () => scheduleProjectStateSearch(input));
    });
    if (!elements.host.__dmsObjectCanvasVariableSearchDelegated) {
      elements.host.__dmsObjectCanvasVariableSearchDelegated = true;
      elements.host.addEventListener('input', (event) => {
        const target = event.target;
        const input = target && target.closest ? target.closest('[data-object-canvas-variable-search]') : null;
        if (input) {
          filterObjectCanvasVariablePicker(input);
        }
        const routeTargetSearch = target && target.closest ? target.closest('[data-object-canvas-route-target-search]') : null;
        if (routeTargetSearch) {
          filterRouteTargetPicker(target);
        }
      });
    }
    perfMeasure('bindCanvasEvents.graphNodes', () => {
      const nodes = elements.host.querySelectorAll('[data-object-canvas-graph-node]');
      nodes.forEach((button) => {
        button.addEventListener('click', (event) => {
          if (event.__dmsObjectCanvasHandled || event.target.closest && event.target.closest('[data-object-canvas-action]')) {
            return;
          }
          if (event.target.closest && event.target.closest('input, textarea, select, a')) {
            return;
          }
          const slotId = button.dataset.systemUiVisibleSlot || '';
          selectCanvasNode(slotId ? 'ui:slot:' + slotId : button.dataset.objectCanvasGraphNode || 'object');
        });
      });
      return nodes.length;
    }, {});
    elements.host.querySelectorAll('[data-object-canvas-zoom]').forEach((button) => {
      button.addEventListener('click', () => handleCanvasZoom(button.dataset.objectCanvasZoom || 'reset'));
    });
    elements.host.querySelectorAll('button[data-content-storyboard-view]').forEach((button) => {
      button.addEventListener('click', () => setStoryboardView(button.dataset.contentStoryboardView || 'timeline'));
    });
    const systemUiWorkspace = systemUiWorkspaceApi();
    if (systemUiWorkspace && typeof systemUiWorkspace.bind === 'function') {
      systemUiWorkspace.bind(elements.host, {onFixture: setSystemUiFixture, onTemplate: switchSystemUiTemplate, onPlayerFlowScreen: setSystemUiPlayerFlowScreen});
    }
    const cardWorkspace = cardWorkspaceApi();
    if (cardWorkspace && typeof cardWorkspace.bind === 'function' && elements.host.querySelector('[data-card-board-surface]')) {
      cardWorkspace.bind(elements.host, state, cardDeps());
    }
    const storyboardInteractions = global.ProjectMapContentStoryboardInteractions;
    if (storyboardInteractions && typeof storyboardInteractions.bind === 'function' && (state.workspace || 'content') === 'content' && currentSurface().key !== 'card_board') {
      perfMeasure('bindCanvasEvents.storyboardInteractions', () => storyboardInteractions.bind(elements.host, {
        getViewport: () => ({x: state.canvasPanX, y: state.canvasPanY, zoom: state.canvasZoom}),
        onSelect: selectCanvasNode,
        onCardMove: (key, x, y, opts) => { setCanvasNodePosition(key, x, y, opts); if (!(opts && opts.preview)) { const wsApi = storyboardWorkspaceApi(); if (wsApi && typeof wsApi.unstackCard === 'function') { wsApi.unstackCard(state, key); } } },
        onViewport: setCanvasPan,
        onZoom: handleCanvasZoom,
        onPaletteDrop: (payload, target) => { const api = storyboardWorkspaceApi(); return Boolean(api && typeof api.dropPaletteItem === 'function' && api.dropPaletteItem(state, payload, target, storyboardDeps())); },
        onCardStack: (draggedKey, anchorKey, anchorPos) => { const api = storyboardWorkspaceApi(); if (api && typeof api.stackCards === 'function') { api.stackCards(state, draggedKey, anchorKey, storyboardDeps(), anchorPos); } },
        onGroupMove: (anchorKey, x, y, memberPos) => { const api = storyboardWorkspaceApi(); if (api && typeof api.moveGroup === 'function') { api.moveGroup(state, anchorKey, x, y, memberPos, storyboardDeps()); } },
        getStackMembers: (key) => { const stacks = state.storyCardStacks || {}; const s = stacks[key]; return s && Array.isArray(s.members) ? s.members.slice() : []; },
        getStackPeers: (key) => { const stacks = state.storyCardStacks || {}; if (stacks[key] && Array.isArray(stacks[key].members)) { return stacks[key].members.slice(); } const anchors = Object.keys(stacks); for (let pi = 0; pi < anchors.length; pi++) { const ps = stacks[anchors[pi]]; if (ps && Array.isArray(ps.members) && ps.members.indexOf(key) >= 0) { return [anchors[pi]].concat(ps.members.filter((m) => m !== key)); } } return []; },
        onStackToggle: (anchorKey) => { handleAction('toggle_story_card_stack', {dataset: {storyboardStackBadge: anchorKey}}); }
      }), {});
    }
    const interactions = global.ProjectMapContentGraphInteractions;
    if (interactions && typeof interactions.bind === 'function' && (state.workspace || 'content') === 'content' && elements.host.querySelector('[data-object-canvas-graph-canvas]')) {
      perfMeasure('bindCanvasEvents.graphInteractions', () => interactions.bind(elements.host, {
        getViewport: () => ({x: state.canvasPanX, y: state.canvasPanY, zoom: state.canvasZoom}),
        onSelect: selectCanvasNode,
        onNodeMove: setCanvasNodePosition,
        onViewport: setCanvasPan,
        onZoom: handleCanvasZoom
      }), {});
    }
    perfMeasure('bindCanvasEvents.applyCanvasViewport', () => applyCanvasViewport(), {});
    const storyboard = storyboardWorkspaceApi(); if (storyboard && typeof storyboard.bindPalette === 'function' && currentSurface().key !== 'card_board' && !state.editorOverlay) {
      perfMeasure('bindCanvasEvents.bindPalette', () => storyboard.bindPalette(elements.host, state, storyboardDeps()), {});
    }
    const runtimeLens = runtimeLensWorkspaceApi(); if (runtimeLens && typeof runtimeLens.bind === 'function') {
      perfMeasure('bindCanvasEvents.runtimeLens', () => runtimeLens.bind(elements.host, state, runtimeLensDeps()), {});
    }
    perfMeasure('bindCanvasEvents.restoreProjectStateSearchFocus', () => restoreProjectStateSearchFocus(), {});
  }

  function scheduleRefresh(options) {
    state.preserveScrollOnNextRefresh = true;
    const opts = options || {};
    // 'change' wins over 'input' if both arrive in the same debounce window —
    // change implies a commit/blur which should run the full sync.
    const incoming = opts.source || 'full';
    const prior = state.pendingRefreshSource || null;
    const merged = (prior === 'change' || incoming === 'change')
      ? 'change'
      : (prior === 'full' || incoming === 'full' ? 'full' : incoming);
    state.pendingRefreshSource = merged;
    // Accumulate the changed-field keys across the debounce window so the
    // refresh can sync only those nodes (skipping the 101-node walk). If
    // any caller in the window doesn't pass a key (programmatic refresh),
    // sync widens back to "all" — we can't tell what changed.
    if (opts.changedFieldKey) {
      if (!(state.pendingChangedFieldKeys instanceof Set)) {
        state.pendingChangedFieldKeys = new Set();
      }
      state.pendingChangedFieldKeys.add(opts.changedFieldKey);
    } else {
      state.pendingSyncAll = true;
    }
    if (refreshTimer) { clearTimeout(refreshTimer); }
    cancelPendingRebuild();
    refreshTimer = setTimeout(() => {
      const finalSource = state.pendingRefreshSource || merged;
      const finalKeys = state.pendingSyncAll ? null : state.pendingChangedFieldKeys;
      state.pendingRefreshSource = null;
      state.pendingChangedFieldKeys = null;
      state.pendingSyncAll = false;
      // Defer the heavy refresh (buildExistingModelFor + syncs, ~450ms+) to
      // the next idle frame so it doesn't block the focus change and the
      // user's first keystrokes on the next field. Plus: if the user has
      // typed within the last 250ms, requeue — rIC alone yields to *new*
      // input events but once the rebuild starts it runs to completion and
      // stalls in-flight keystrokes. The back-off keeps the rebuild from
      // firing in the middle of a typing burst on the next field.
      //
      // Generation guard: capture the current generation so that if render()
      // fires between our scheduling and the rIC callback, the stale callback
      // is a no-op instead of running a redundant 450-900ms refresh against
      // an already-replaced DOM.
      const TYPING_BACKOFF_MS = 250;
      const MAX_BACKOFF_MS = 1500;
      const startedAt = Date.now();
      const capturedGeneration = ++refreshGeneration;
      const runRefresh = () => refresh(Object.assign({}, opts, {source: finalSource, changedFieldKeys: finalKeys}));
      const tryRun = () => {
        if (capturedGeneration !== refreshGeneration) {
          return;
        }
        const elapsed = Date.now() - startedAt;
        const sinceInput = Date.now() - (state.lastInputAt || 0);
        if (sinceInput < TYPING_BACKOFF_MS && elapsed < MAX_BACKOFF_MS) {
          scheduleRebuild(tryRun);
          return;
        }
        runRefresh();
      };
      scheduleRebuild(tryRun);
    }, 180);
  }

  function scheduleRebuild(callback) {
    if (typeof callback !== 'function') {
      return;
    }
    if (typeof global.requestIdleCallback === 'function') {
      pendingRebuildHandle = global.requestIdleCallback(callback, {timeout: 500});
      return;
    }
    if (typeof global.requestAnimationFrame === 'function') {
      pendingRebuildHandle = global.requestAnimationFrame(callback);
      return;
    }
    pendingRebuildHandle = 0;
    callback();
  }

  function cancelPendingRebuild() {
    if (!pendingRebuildHandle) {
      return;
    }
    if (typeof global.cancelIdleCallback === 'function') {
      global.cancelIdleCallback(pendingRebuildHandle);
    }
    // cancelAnimationFrame also works for rIC handles on most engines, but
    // call it only when rIC is unavailable (same branch as scheduleRebuild).
    if (typeof global.cancelIdleCallback !== 'function' && typeof global.cancelAnimationFrame === 'function') {
      global.cancelAnimationFrame(pendingRebuildHandle);
    }
    pendingRebuildHandle = 0;
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

  // Conditional what-if simulator: when an author edits a quality in the
  // what-if strip, re-evaluate every branch predicate in that scope and flip
  // its state badge between "shows" and "hidden". Evaluation reuses the shared
  // browser predicate evaluator; the predicate AST is carried per branch in a
  // data-attribute by preview_object_editor.js.
  // ---- play simulator (approximate inline dry-run) ----
  // Play state is tied to the live model: a rebuild (refresh) yields a new
  // model object, which resets the dry-run so it never mixes a stale run with
  // freshly edited fields.
  function ensurePlaySim() {
    if (!state.playSim || state.playSim.modelRef !== state.model) {
      state.playSim = {modelRef: state.model, q: {}, chosen: null};
    }
    return state.playSim;
  }

  function playPreviewPane() {
    if (!elements || !elements.host || typeof elements.host.querySelector !== 'function') {
      return null;
    }
    return elements.host.querySelector('[data-object-editing-modal-preview-pane]');
  }

  function setPlayMode(mode) {
    const pane = playPreviewPane();
    if (!pane) {
      return;
    }
    const showPlay = mode === 'play';
    pane.dataset.previewPaneMode = showPlay ? 'play' : 'preview';
    const previewPanel = pane.querySelector('[data-preview-mode-panel="preview"]');
    const playPanel = pane.querySelector('[data-preview-mode-panel="play"]');
    if (previewPanel) {
      previewPanel.hidden = showPlay;
    }
    if (playPanel) {
      playPanel.hidden = !showPlay;
    }
    pane.querySelectorAll('[data-preview-modes-toolbar] button').forEach((button) => {
      const active = (button.dataset.playAction === 'show-play') === showPlay;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (showPlay) {
      renderPlaySimPane();
    }
  }

  function renderPlaySimPane() {
    const simUi = global.ProjectMapObjectPlaySimulatorUi;
    const pane = playPreviewPane();
    const body = state.model && state.model.eventBody;
    const container = pane && pane.querySelector('[data-play-sim-pane]');
    if (!container) {
      return;
    }
    // Prefer the real DendryEngine over the approximate dry-run when the desktop
    // bridge is available and the object maps to a scene we can play.
    const engineUi = global.ProjectMapObjectPlaytestEngineUi;
    if (engineUi && typeof engineUi.claimPane === 'function' && engineUi.claimPane(container, engineDeps())) {
      container.dataset.playSimPending = 'false';
      return;
    }
    if (!simUi || typeof simUi.renderPane !== 'function' || !body) {
      return;
    }
    container.innerHTML = simUi.renderPane(body, state.model, ensurePlaySim());
    container.dataset.playSimPending = 'false';
  }

  function renderPlaySimNode() {
    const simUi = global.ProjectMapObjectPlaySimulatorUi;
    const pane = playPreviewPane();
    const body = state.model && state.model.eventBody;
    const node = pane && pane.querySelector('[data-play-node]');
    if (!simUi || typeof simUi.renderNode !== 'function' || !body || !node) {
      return;
    }
    node.innerHTML = simUi.renderNode(body, state.model, ensurePlaySim());
  }

  // Real-engine play-test (Phase 2): hand the controller (ProjectMapObject-
  // PlaytestEngineUi) accessors; it claims the pane when the desktop bridge is
  // present, else the approximate simulator above runs (plain browser viewer).
  function engineDeps() {
    return {getModel: function () { return state.model; }, getHost: function () { return elements && elements.host; }, getInstallPlan: function () { try { return currentInstallPlan(); } catch (_e) { return null; } }, getPreviewPane: playPreviewPane};
  }

  function handlePlaySimClick(event) {
    const target = event && event.target;
    if (!target || !target.closest || !elements || !elements.host) {
      return;
    }
    // The real-engine controller owns its own controls (choices + restart);
    // let it claim the event first, then fall through to the approximate panel.
    const engineUi = global.ProjectMapObjectPlaytestEngineUi;
    if (engineUi && typeof engineUi.handleClick === 'function' && engineUi.handleClick(event, engineDeps())) {
      return;
    }
    const actionButton = target.closest('[data-play-action]');
    if (actionButton && elements.host.contains(actionButton)) {
      const action = actionButton.dataset.playAction || '';
      if (action === 'show-play' || action === 'show-preview') {
        event.preventDefault();
        setPlayMode(action === 'show-play' ? 'play' : 'preview');
        return;
      }
      if (action === 'reset') {
        event.preventDefault();
        const ps = ensurePlaySim();
        ps.q = {};
        ps.chosen = null;
        renderPlaySimPane();
        return;
      }
      if (action === 'back') {
        event.preventDefault();
        ensurePlaySim().chosen = null;
        renderPlaySimNode();
        return;
      }
    }
    const optionButton = target.closest('[data-play-option]');
    if (optionButton && elements.host.contains(optionButton)) {
      event.preventDefault();
      ensurePlaySim().chosen = optionButton.dataset.playOption || null;
      renderPlaySimNode();
    }
  }

  function handlePlaySimInput(event) {
    const target = event && event.target;
    if (!target || !target.closest || !elements || !elements.host) {
      return;
    }
    // Real-engine mode: the controller re-runs from the edited starting state.
    const engineUi = global.ProjectMapObjectPlaytestEngineUi;
    if (engineUi && typeof engineUi.handleInput === 'function' && engineUi.handleInput(event, engineDeps())) {
      return;
    }
    const varInput = target.closest('[data-play-var]');
    if (!varInput || !elements.host.contains(varInput)) {
      return;
    }
    const name = varInput.dataset.playVar || '';
    if (!name) {
      return;
    }
    const ps = ensurePlaySim();
    const num = Number(varInput.value);
    ps.q[name] = Number.isFinite(num) ? num : 0;
    // A starting-state change invalidates the current result; drop back to the
    // entry node. Only the node is re-rendered so the state inputs keep focus.
    ps.chosen = null;
    renderPlaySimNode();
  }

  function handleConditionalWhatIfInput(event) {
    const target = event && event.target;
    if (!target || !target.closest || !elements || !elements.host) {
      return;
    }
    const varInput = target.closest('[data-conditional-whatif-var]');
    if (varInput && elements.host.contains(varInput)) {
      const scope = varInput.closest('[data-conditional-whatif-scope="true"]');
      if (scope) {
        applyConditionalWhatIf(scope);
      }
      return;
    }
    // A live condition edit must re-bake the branch's predicate AST: the AST
    // baked into data-conditional-branch-ast at render time still reflects the
    // OLD condition, so without re-parsing the badge would keep showing the
    // pre-edit shows/hidden verdict. We re-parse with the same predicate model
    // the renderer used, rewrite the branch AST, then re-run the scope.
    const condInput = target.closest('[data-conditional-leaf-input="condition"]');
    if (condInput && elements.host.contains(condInput)) {
      handleConditionalConditionEdit(condInput);
    }
  }

  function handleConditionalConditionEdit(input) {
    const branch = input.closest('.preview-object-conditional-branch');
    if (!branch) {
      return;
    }
    const ast = rebakeBranchConditionAst(branch, String(input.value || ''));
    if (!ast) {
      // Empty or unparseable condition: we cannot simulate it, so degrade the
      // badge to the honest "state unknown" rather than leave a stale verdict.
      setConditionalBranchState(branch, null);
    }
    const scope = input.closest('[data-conditional-whatif-scope="true"]');
    if (scope) {
      applyConditionalWhatIf(scope);
    }
  }

  // Density governance: a dense conditional layer renders a filter toolbar
  // (preview_object_editor.renderConditionalFilterToolbar). Narrow the top-level
  // branch list by free text and, when the what-if simulator is live, to only
  // the branches that currently show. Pure DOM show/hide — no model mutation.
  function handleConditionalFilterInput(event) {
    const target = event && event.target;
    if (!target || !target.closest || !elements || !elements.host) {
      return;
    }
    const control = target.closest('[data-conditional-filter-input], [data-conditional-filter-shows]');
    if (!control || !elements.host.contains(control)) {
      return;
    }
    const toolbar = control.closest('[data-conditional-filter]');
    if (toolbar) {
      applyConditionalFilter(toolbar);
    }
  }

  function applyConditionalFilter(toolbar) {
    if (!toolbar || typeof toolbar.querySelector !== 'function') {
      return;
    }
    const layer = toolbar.closest('[data-preview-object-conditional-tree]') || toolbar.parentElement;
    if (!layer) {
      return;
    }
    const queryInput = toolbar.querySelector('[data-conditional-filter-input]');
    const showsInput = toolbar.querySelector('[data-conditional-filter-shows]');
    const query = String(queryInput && queryInput.value || '').trim().toLowerCase();
    const showsOnly = Boolean(showsInput && showsInput.checked);
    const branches = layer.querySelectorAll(':scope > ul > li.preview-object-conditional-branch');
    let shown = 0;
    branches.forEach((branch) => {
      let visible = !query || (branch.textContent || '').toLowerCase().indexOf(query) !== -1;
      if (visible && showsOnly) {
        const badge = branch.querySelector(':scope > [data-conditional-branch-state]');
        const state = badge && badge.dataset ? badge.dataset.conditionalBranchState : '';
        if (state !== 'active') {
          visible = false;
        }
      }
      branch.classList.toggle('is-filtered-out', !visible);
      if (visible) {
        shown += 1;
      }
    });
    const count = toolbar.querySelector('[data-conditional-filter-count]');
    if (count) {
      count.textContent = t('previewObjectEditor.filterCount', 'Showing {shown} of {total}')
        .replace('{shown}', String(shown))
        .replace('{total}', String(branches.length));
    }
  }

  // Insert a layer variable name at the condition input's caret, then dispatch
  // 'input' so the already-wired handlers (leaf validation + what-if re-bake +
  // collectValues) all fire exactly as if the author had typed the token. Keeps
  // the byte-exact guarded-splice contract intact (it is just text entry).
  function handleConditionalVarInsert(button) {
    const token = button && button.dataset ? String(button.dataset.conditionalVarToken || '') : '';
    if (!token) {
      return;
    }
    const editor = button.closest('.preview-object-conditional-edit');
    const input = editor && editor.querySelector('[data-conditional-leaf-input="condition"]');
    if (!input) {
      return;
    }
    const value = String(input.value || '');
    const start = typeof input.selectionStart === 'number' ? input.selectionStart : value.length;
    const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
    input.value = value.slice(0, start) + token + value.slice(end);
    const caret = start + token.length;
    input.focus();
    try {
      input.setSelectionRange(caret, caret);
    } catch (_err) {
      // selection range is best-effort; ignore unsupported inputs
    }
    const InputCtor = global.InputEvent || global.Event;
    input.dispatchEvent(new InputCtor('input', {bubbles: true}));
  }

  function rebakeBranchConditionAst(branch, conditionText) {
    const model = global.ProjectMapPredicateConditionModel;
    let ast = null;
    if (model && typeof model.summarizePredicate === 'function' && conditionText.trim()) {
      try {
        const summary = model.summarizePredicate(conditionText);
        ast = summary && summary.ast ? summary.ast : null;
      } catch (_err) {
        ast = null;
      }
    }
    if (ast) {
      branch.dataset.conditionalBranchAst = JSON.stringify(ast);
    } else if (branch.dataset) {
      delete branch.dataset.conditionalBranchAst;
    }
    return ast;
  }

  function applyConditionalWhatIf(scope) {
    const evaler = global.ProjectMapPredicateRuntimeEval;
    if (!scope || !evaler || typeof evaler.evaluateAst !== 'function') {
      return;
    }
    const runtimeState = {};
    scope.querySelectorAll('[data-conditional-whatif-var]').forEach((input) => {
      const name = input.dataset.conditionalWhatifVar || '';
      if (!name) {
        return;
      }
      const raw = input.value;
      const num = Number(raw);
      runtimeState[name] = raw !== '' && Number.isFinite(num) ? num : raw;
    });
    scope.querySelectorAll('[data-conditional-branch-ast]').forEach((branch) => {
      let ast = null;
      try {
        ast = JSON.parse(branch.dataset.conditionalBranchAst || 'null');
      } catch (_err) {
        ast = null;
      }
      if (!ast) {
        return;
      }
      setConditionalBranchState(branch, Boolean(evaler.evaluateAst(ast, runtimeState)));
    });
    // If a "only branches that show" filter is active, re-run it so the visible
    // set tracks the freshly evaluated what-if verdicts.
    const filterToolbar = scope.querySelector('[data-conditional-filter]');
    if (filterToolbar) {
      const showsInput = filterToolbar.querySelector('[data-conditional-filter-shows]');
      if (showsInput && showsInput.checked) {
        applyConditionalFilter(filterToolbar);
      }
    }
  }

  function setConditionalBranchState(branch, active) {
    const badge = branch.querySelector(':scope > [data-conditional-branch-state]');
    if (!badge) {
      return;
    }
    // active === null marks an unknown verdict (empty/unparseable condition),
    // mirroring branchStateBadge(null) in preview_object_editor.js.
    const stateName = active === null ? 'opaque' : (active ? 'active' : 'hidden');
    badge.dataset.conditionalBranchState = stateName;
    badge.classList.remove('is-active', 'is-hidden', 'is-opaque');
    badge.classList.add('is-' + stateName);
    badge.textContent = stateName === 'opaque'
      ? t('previewObjectEditor.whatIfUnknown', 'state unknown')
      : (active
        ? t('previewObjectEditor.whatIfShows', 'shows')
        : t('previewObjectEditor.whatIfHidden', 'hidden'));
  }

  // Inline validation feedback (P3b #5): a leaf edit whose value breaks the
  // inline-conditional grammar silently downgrades to a manual snippet at apply
  // time. Surface that verdict live so the author understands why the edit will
  // not become a clean guarded replace, instead of being surprised later. The
  // grammar check reuses the shared describeInlineLeafValue helper so the UI and
  // the apply-time gate can never disagree.
  function handleConditionalLeafValidation(event) {
    const target = event && event.target;
    if (!target || !target.closest || !elements || !elements.host) {
      return;
    }
    const input = target.closest('[data-conditional-leaf-input]');
    if (!input || !elements.host.contains(input)) {
      return;
    }
    const helpers = global.ProjectMapExistingSceneTextBlockHelpers;
    const label = input.closest('.preview-object-conditional-edit-field');
    const note = label ? label.querySelector('[data-conditional-leaf-note]') : null;
    if (!helpers || typeof helpers.describeInlineLeafValue !== 'function' || !note) {
      return;
    }
    const kind = input.dataset.conditionalLeafInput === 'condition' ? 'condition' : 'text';
    const verdict = helpers.describeInlineLeafValue(input.value, kind);
    if (verdict.ok) {
      note.hidden = true;
      note.textContent = '';
      input.classList.remove('is-leaf-invalid');
      input.removeAttribute('aria-invalid');
      return;
    }
    note.textContent = conditionalLeafNoteMessage(verdict.code);
    note.hidden = false;
    input.classList.add('is-leaf-invalid');
    input.setAttribute('aria-invalid', 'true');
  }

  function conditionalLeafNoteMessage(code) {
    if (code === 'delimiter') {
      return t('previewObjectEditor.leafInvalidDelimiter', 'Inline markers [? and ?] cannot be edited here — this branch will stay a manual snippet.');
    }
    if (code === 'empty_condition') {
      return t('previewObjectEditor.leafInvalidEmptyCondition', 'A branch condition cannot be empty.');
    }
    if (code === 'condition_colon') {
      return t('previewObjectEditor.leafInvalidColon', 'A condition cannot contain ":" — it would be read as a text separator.');
    }
    return t('previewObjectEditor.leafInvalidGeneric', 'This value cannot be applied safely and will stay a manual snippet.');
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
    if (select && select.dataset && (select.dataset.existingAssetAddField || select.dataset.existingAssetField)) {
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

  function populateDeferredAssetSelectControl(event) {
    populateDeferredAssetSelectElement(event && event.currentTarget);
  }

  function populateDeferredAssetSelectElement(select) {
    if (!select) {
      return;
    }
    const assetEditor = global.ProjectMapPreviewAssetEditor;
    if (assetEditor && typeof assetEditor.populateDeferredAssetSelect === 'function') {
      assetEditor.populateDeferredAssetSelect(select);
    }
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
    if (select.dataset && select.dataset.assetSelectDeferred && select.dataset.assetSelectReady !== 'true') {
      populateDeferredAssetSelectElement(select);
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

  function collectAudioModifiers(control) {
    if (!control || !control.closest) { return []; }
    // Guard against detached DOM nodes (e.g., after re-render)
    if (control.ownerDocument && typeof control.ownerDocument.contains === 'function' && !control.ownerDocument.contains(control)) {
      return [];
    }
    var slot = control.closest('.object-canvas-asset-slot');
    if (!slot) { return []; }
    var fieldset = slot.querySelector('[data-audio-modifier-fieldset]');
    if (!fieldset) { return []; }
    var checked = fieldset.querySelectorAll('input[data-audio-modifier-toggle]:checked');
    var result = [];
    for (var i = 0; i < checked.length; i++) {
      result.push(String(checked[i].value || '').trim().toLowerCase());
    }
    return result.filter(Boolean);
  }

  function updateExistingObjectCanvasAssetSelection(select) {
    const fieldId = String(select.dataset.existingAssetAddField || select.dataset.existingAssetField || '').trim();
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
      role,
      original: String(select.dataset.assetOriginal || ''),
      currentPath: String(select.dataset.currentAssetPath || ''),
      modifiers: collectAudioModifiers(select)
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
      role,
      modifiers: collectAudioModifiers(input)
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
    var contract = assetContractApi();
    if (contract && typeof contract.formatDirectiveText === 'function') {
      var formatted = contract.formatDirectiveText(directive, targetPath, opts.modifiers);
      if (formatted) { return formatted; }
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

  function isPlainTextField(element) {
    // True for textarea and free-form text-shaped inputs. False for select,
    // checkbox, radio, file, etc. — those represent structural choices and
    // need the full refresh path. Used by the delegated change handler to
    // bypass buildExistingModelFor on plain text blurs.
    if (!element) {
      return false;
    }
    const tag = String(element.tagName || '').toLowerCase();
    if (tag === 'textarea') {
      return true;
    }
    if (tag !== 'input') {
      return false;
    }
    const type = String(element.type || 'text').toLowerCase();
    return type === 'text' || type === 'search' || type === 'url' || type === 'email' || type === 'tel' || type === 'password' || type === 'number';
  }

  function syncSemanticEffectParts(input, eventType) {
    if (!input || !input.closest || !elements || !elements.host) {
      return;
    }
    const targetId = input.dataset && input.dataset.objectCanvasEffectTarget || '';
    if (!targetId) {
      return;
    }
    const card = input.closest('[data-object-canvas-semantic-card="state_change"]');
    const target = elements.host.querySelector('[data-object-canvas-field="' + cssEscape(targetId) + '"]');
    if (!card || !target || target.readOnly || target.disabled) {
      return;
    }
    const variable = semanticEffectPartValue(card, 'variable');
    const op = semanticEffectPartValue(card, 'op') || '+=';
    const value = semanticEffectPartValue(card, 'value') || '0';
    const condition = semanticEffectPartValue(card, 'condition');
    const expression = [normalizeSemanticEffectVariable(variable), op, value].filter(Boolean).join(' ') + (condition ? ' if ' + condition : '');
    if (target.value !== expression) {
      target.value = expression;
    }
    // Used to dispatch synthetic 'input' + 'change' events on the target so the
    // delegated handlers would re-pick them up. That fired scheduleRefresh on
    // every keystroke (synthetic 'change' dispatched unconditionally, even when
    // the user's natural event was 'input'), resetting the 180ms debounce and
    // queueing an rIC rebuild on every char. It also forced every other
    // host-level input listener (variable search, etc.) to re-run per
    // keystroke. Replaced with direct calls: live preview update always,
    // scheduleRefresh only when the user's natural event was a commit.
    updateRenderedPreviewForField(target);
    if (eventType === 'change') {
      scheduleRefresh({source: 'effect_part_change', changedFieldKey: targetId});
    }
  }

  function semanticEffectPartValue(card, part) {
    const control = card && card.querySelector('[data-object-canvas-effect-part="' + cssEscape(part) + '"]');
    return String(control && control.value || '').trim();
  }

  function normalizeSemanticEffectVariable(value) {
    const text = String(value || '').trim().replace(/^Q\./, '');
    return text ? 'Q.' + text : '';
  }

  function handleRouteTargetInsert(button) {
    if (!button) {
      return;
    }
    const value = button.dataset && button.dataset.objectCanvasRouteTargetInsert || '';
    const targetFieldId = button.dataset && button.dataset.objectCanvasRouteTargetField || '';
    if (!value || !targetFieldId) {
      return;
    }
    const roots = collectCanvasValueRoots();
    let input = null;
    for (let index = 0; index < roots.length; index += 1) {
      input = roots[index].querySelector('[data-object-canvas-field="' + targetFieldId + '"]');
      if (input) {
        break;
      }
    }
    if (!input) {
      return;
    }
    input.value = value;
    input.dispatchEvent(new (global.Event || Event)('input', {bubbles: true}));
    input.dispatchEvent(new (global.Event || Event)('change', {bubbles: true}));
    state.values = collectValues();
    scheduleRefresh({source: 'route_target_insert', changedFieldKey: targetFieldId});
    const picker = button.closest('[data-object-canvas-route-target-picker]');
    if (picker && picker.open !== undefined) {
      picker.open = false;
    }
  }

  function handleVariableCopy(button) {
    if (!button) {
      return;
    }
    const value = button.dataset && button.dataset.objectCanvasVariableCopy || '';
    if (!value) {
      return;
    }
    copyTextToClipboard(value).then((ok) => {
      markVariableCopyState(button, ok ? 'copied' : 'manual');
    });
  }

  function copyTextToClipboard(value) {
    const text = String(value || '');
    const clipboard = global.navigator && global.navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === 'function') {
      return clipboard.writeText(text).then(() => true).catch(() => fallbackCopyText(text));
    }
    return Promise.resolve(fallbackCopyText(text));
  }

  function fallbackCopyText(value) {
    if (!global.document || typeof global.document.createElement !== 'function') {
      return false;
    }
    const textarea = global.document.createElement('textarea');
    textarea.value = String(value || '');
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    global.document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
      ok = Boolean(global.document.execCommand && global.document.execCommand('copy'));
    } catch (_err) {
      ok = false;
    }
    textarea.remove();
    return ok;
  }

  function markVariableCopyState(button, stateName) {
    if (!button || !button.dataset) {
      return;
    }
    button.dataset.objectCanvasVariableCopyState = stateName;
    button.setAttribute('aria-label', stateName === 'copied'
      ? t('previewObjectEditor.variableCopied', 'Copied variable snippet')
      : t('previewObjectEditor.variableCopyManual', 'Copy this variable snippet'));
  }

  function filterRouteTargetPicker(input) {
    if (!input || !input.closest) {
      return;
    }
    const picker = input.closest('[data-object-canvas-route-target-picker]');
    if (!picker) {
      return;
    }
    const terms = String(input.value || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    const limit = Math.max(1, Number(picker.dataset && picker.dataset.routeTargetPickerLimit || 12));
    let shown = 0;
    picker.querySelectorAll('[data-object-canvas-route-target-insert]').forEach((button) => {
      const haystack = String(button.dataset && button.dataset.objectCanvasRouteTargetSearchText || button.textContent || '').toLowerCase();
      const visible = (!terms.length || terms.every((term) => haystack.indexOf(term) >= 0)) && shown < limit;
      button.hidden = !visible;
      if (visible) {
        shown += 1;
      }
    });
  }

  function filterObjectCanvasVariablePicker(input) {
    if (!input || !input.closest) {
      return;
    }
    const picker = input.closest('[data-object-canvas-variable-picker]');
    if (!picker) {
      return;
    }
    const list = picker.querySelector('[data-object-canvas-variable-candidates]');
    const targetFieldId = picker.dataset && picker.dataset.variableTargetField || '';
    const mode = picker.dataset && picker.dataset.variablePickerMode || '';
    const limit = Math.max(1, Number(picker.dataset && picker.dataset.variablePickerLimit || 12));
    const rows = variablePickerRowsForQuery(targetFieldId, mode, input.value, limit);
    if (rows && list) {
      list.innerHTML = rows.map((candidate) => variablePickerCandidateButtonHtml(candidate, targetFieldId, mode)).join('');
      return;
    }
    const terms = String(input.value || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    picker.querySelectorAll('[data-object-canvas-variable-copy]').forEach((button) => {
      const haystack = String(button.dataset && button.dataset.objectCanvasVariableSearchText || button.textContent || '').toLowerCase();
      const visible = !terms.length || terms.every((term) => haystack.indexOf(term) >= 0);
      button.hidden = !visible;
    });
  }

  function variablePickerRowsForQuery(targetFieldId, mode, query, limit) {
    const api = global.ProjectMapObjectFieldPresentationModel;
    if (!api || typeof api.buildVariablePicker !== 'function') {
      return null;
    }
    const candidates = variablePickerCandidateSource();
    if (!candidates.length) {
      return null;
    }
    const picker = api.buildVariablePicker(candidates, {id: targetFieldId, value: String(query || '')}, {
      query: String(query || ''),
      limit,
      presentation: {variablePicker: {enabled: true, mode, targetFieldId}}
    });
    return picker && picker.enabled ? ensureArray(picker.candidates) : [];
  }

  function variablePickerCandidateSource() {
    const bodyCandidates = state && state.model && state.model.eventBody && state.model.eventBody.variablePickerCandidates;
    if (Array.isArray(bodyCandidates) && bodyCandidates.length) {
      return bodyCandidates;
    }
    const api = global.ProjectMapVariableSuggestions;
    const index = state && (state.projectIndex || state.index) || state && state.model && state.model.projectIndex || {};
    return api && typeof api.buildVariableCandidates === 'function' ? api.buildVariableCandidates(index) : [];
  }

  function variablePickerCandidateButtonHtml(candidate, targetFieldId, mode) {
    const value = String(candidate && (candidate.insertValue || candidate.name) || '');
    if (!value) {
      return '';
    }
    const searchText = String(candidate && (candidate.searchText || [candidate.name, candidate.label, candidate.meaning, candidate.summary, candidate.reason].join(' ')) || '').toLowerCase();
    return [
      '<button type="button" class="object-canvas-variable-candidate" data-object-canvas-variable-copy="' + escapeAttr(value) + '" data-object-canvas-variable-target="' + escapeAttr(targetFieldId) + '" data-object-canvas-variable-mode="' + escapeAttr(mode || '') + '" data-object-canvas-variable-search-text="' + escapeAttr(searchText) + '">',
      '<strong>' + escapeHtml(candidate && (candidate.label || candidate.name) || value) + '</strong>',
      candidate && candidate.meaning ? '<span>' + escapeHtml(candidate.meaning) + '</span>' : '',
      candidate && candidate.summary ? '<small>' + escapeHtml(candidate.summary) + '</small>' : '',
      '<code>' + escapeHtml(value) + '</code>',
      '</button>'
    ].join('');
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
    state.selectedCanvasNode = next;
    state.model = state.mode === 'existing' ? buildExistingModel({values: state.values, proposalOptions: state.proposalOptions}) : buildTemplateModel({values: state.values});
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

  function setSystemUiPlayerFlowScreen(screen) { const api = systemUiWorkspaceApi(); if (api && typeof api.setPlayerFlowScreen === 'function') { api.setPlayerFlowScreen(state, screen, systemUiDeps()); } }

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
    } else if (action === 'toggle_overlay') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      toggleEditorOverlay(undefined, target);
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
    } else if (action === 'open_library_content') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      openLibraryContent(target);
      return;
    } else if (action === 'open_system_content_scene') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      openSystemContentScene(target);
      return;
    } else if (action === 'open_project_metadata') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      openProjectMetadataEditor();
      return;
    } else if (action === 'sidebar_delete_category') {
      global.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      prepareSidebarCategoryDelete(target);
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

  function openLibraryContent(target) {
    const sceneId = String(target && target.dataset && target.dataset.systemUiLibrarySceneId || 'library').trim() || 'library';
    const sectionId = String(target && target.dataset && target.dataset.systemUiLibrarySectionId || '').trim();
    const focusFieldId = sectionId ? 'block:' + sectionId : '';
    const opened = openFromSelection(state.projectIndex, 'events', sceneId, {
      entry: {source: 'system_ui_library_content', actionKind: 'open_library_content'},
      focus: focusFieldId ? {fieldId: focusFieldId, valueKey: focusFieldId, sectionId} : null
    });
    if (!opened) {
      state.status = t('existingScene.openFailed', 'This scene needs more source evidence before Studio can edit it here.');
      updateDynamicSurfaces();
      return false;
    }
    if (focusFieldId) {
      focusDraftField(focusFieldId);
    }
    return true;
  }

  function openSystemContentScene(target) {
    const sceneId = String(target && target.dataset && target.dataset.systemUiContentSceneId || '').trim();
    const sectionId = String(target && target.dataset && target.dataset.systemUiContentSectionId || '').trim();
    if (!sceneId) {
      state.status = t('existingScene.openFailed', 'This scene needs more source evidence before Studio can edit it here.');
      updateDynamicSurfaces();
      return false;
    }
    const focusFieldId = sectionId ? 'block:' + sectionId : '';
    const opened = openFromSelection(state.projectIndex, 'events', sceneId, {
      entry: {source: 'system_ui_player_flow', actionKind: 'open_content_scene'},
      focus: focusFieldId ? {fieldId: focusFieldId, valueKey: focusFieldId, sectionId} : null
    });
    if (!opened) {
      state.status = t('existingScene.openFailed', 'This scene needs more source evidence before Studio can edit it here.');
      updateDynamicSurfaces();
      return false;
    }
    if (focusFieldId) {
      focusDraftField(focusFieldId);
    }
    return true;
  }

  // The System UI header shows the game's title + author — real game metadata,
  // not a scene field. Route a header click to the Game Info editor (the
  // screen_header region's declared owner template = project), which edits
  // gameTitle/author/ifid as proper fields. openTemplate sets the status and
  // shows the workspace itself, so this just opens it with the current draft.
  function openProjectMetadataEditor() {
    return openTemplate('project', safeDefaultDraftForTemplate('project'), {
      source: 'system_ui_game_identity',
      actionKind: 'open_project_metadata'
    });
  }

  function prepareSidebarCategoryDelete(target) {
    const sectionId = String(target && target.dataset && target.dataset.systemUiSidebarCategory || state.selectedCanvasNode || '')
      .replace(/^ui:sidebar_category:/, '')
      .replace(/^sidebar_category:/, '')
      .trim();
    const values = collectValues();
    if (sectionId) {
      values['sidebar.sectionId'] = sectionId;
    }
    values['sidebar.operationMode'] = 'delete';
    values['sidebar.deleteConfirm'] = 'true';
    state.values = values;
    const selectedRegion = sectionId ? 'ui:sidebar_category:' + sectionId : 'ui:sidebar_status';
    return openTemplate('sidebar_status', state.baseDraft || safeDefaultDraftForTemplate('sidebar_status'), {
      source: 'system_ui_sidebar_delete',
      selectedRegion,
      selectedCanvasNode: selectedRegion,
      selectedTaskId: 'sidebar_status:sidebar_delete_category',
      focusFieldId: 'sidebar.deleteConfirm',
      values
    });
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

  function toggleEditorOverlay(next, sourceTarget) {
    const opening = next === undefined ? !state.editorOverlay : Boolean(next);
    if (opening && !state.editorOverlay && currentSurface(state.model).key === 'card_board') {
      const cardWorkspace = cardWorkspaceApi();
      const focusFieldId = sourceTarget && sourceTarget.dataset ? String(sourceTarget.dataset.cardBoardOptionField || '') : '';
      if (cardWorkspace && typeof cardWorkspace.openSelectedCardEditor === 'function' && cardWorkspace.openSelectedCardEditor(state, cardDeps(), {focusFieldId})) {
        return;
      }
    }
    state.editorOverlay = opening;
    if (opening) {
      // Opening still does the full path: the modal needs a fresh model so
      // it reflects edits the user made in the underlying canvas.
      state.values = collectValues();
      state.model = state.mode === 'existing'
        ? buildExistingModel({values: state.values, proposalOptions: state.proposalOptions})
        : buildTemplateModel({values: state.values});
      render();
      return;
    }
    // Fast close: snapshot fresh values from the DOM (Save/Apply correctness),
    // remove the modal markup in place for instant visual close, and defer
    // the heavy model rebuild + underlying-canvas refresh to scheduleRefresh.
    // The pre-existing synchronous path here was buildExistingModelFor
    // (~450ms) plus full render() (~300ms innerHTML rewrite + bindCanvasEvents)
    // on a large existing event — that combined ~800ms+ click→close lag was
    // the main reason "Close editor" felt sluggish. state.model is briefly
    // stale until the deferred refresh runs (~250-500ms via typing-aware rIC).
    state.values = collectValues();
    removeEditorOverlayMarkup();
    scheduleRefresh({source: 'overlay_close'});
  }

  function removeEditorOverlayMarkup() {
    if (!elements || !elements.host || typeof elements.host.querySelectorAll !== 'function') {
      return;
    }
    elements.host.querySelectorAll('[data-object-editing-modal="true"]').forEach((node) => {
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
    // The .object-canvas section carries an 'is-editor-overlay' class that
    // toggles dim/desaturate styles on the underlying canvas (saturate 0.78,
    // opacity 0.58, pointer-events: none — see styles/editing.css). Removing
    // the modal element alone leaves that class behind, so the underlying
    // canvas stays dimmed until the deferred refresh re-renders the shell.
    // Strip it now so close looks visually clean immediately.
    elements.host.querySelectorAll('.object-canvas.is-editor-overlay').forEach((node) => {
      if (node && node.classList && typeof node.classList.remove === 'function') {
        node.classList.remove('is-editor-overlay');
      }
    });
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

  function collectValues() {
    const values = Object.assign({}, state.values || {});
    if (!elements || !elements.host) {
      return values;
    }
    const changed = {};
    const originalKeys = new Set();
    collectCanvasValueRoots().forEach((root) => {
      collectCanvasFieldEntries(root).forEach((input) => {
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

  function collectCanvasValueRoots() {
    const roots = [];
    const modal = global.document && global.document.querySelector('[data-object-editing-modal="true"]');
    if (modal && (!elements || !elements.host || !elements.host.contains(modal))) {
      return [modal];
    }
    if (elements && elements.host) {
      roots.push(elements.host);
    }
    return roots;
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

  function updateDynamicSurfaces(options) {
    if (!elements || !elements.host || !state.model) {
      return;
    }
    const opts = options && typeof options === 'object' ? options : {};
    perfMeasure('updateDynamicSurfaces', () => updateDynamicSurfacesBody(opts), {
      skipHeavySync: opts.skipHeavySync ? 'true' : 'false',
      skipRenderedFieldsSync: opts.skipRenderedFieldsSync ? 'true' : 'false'
    });
  }

  function updateDynamicSurfacesBody(opts) {
    const preview = elements.host.querySelector('[data-object-canvas-preview]');
    if (preview) {
      const output = state.model.changeState && state.model.changeState.output || {};
      preview.textContent = output.playerPreview || output.proposalText || output.previewText || output.sceneDry || '';
    }
    // The change-panel + install-plan HTML rewrites are heavy on large events
    // (they re-stringify the entire model summary). They show only counts/labels
    // that the user is not staring at while typing — defer to commit (change/blur).
    if (!opts.skipHeavySync) {
      const summary = elements.host.querySelector('[data-object-canvas-operation-summary]');
      if (summary) {
        perfMeasure('updateDynamicSurfaces.operationSummary', () => {
          summary.outerHTML = renderChangePanel(state.model).split('<section class="editing-preview">')[0];
        }, {});
      }
      const plan = elements.host.querySelector('[data-object-canvas-review-plan]');
      if (plan) {
        perfMeasure('updateDynamicSurfaces.reviewPlan', () => {
          const change = state.model.changeState || {};
          const output = change.output || {};
          plan.outerHTML = renderPlanPreview(change.installPlan || output.installPlan || parseJson(output.installPlanJson));
        }, {});
      }
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
    // Preview pane is the right-side rendered view; it rebuilds the entire
    // pane HTML each call. Cheap UI niceties during typing aren't worth the
    // cost — let the user's pause/blur trigger this.
    // The preview pane rebuild (syncPreviewObjectEditorPane) parses the
    // model into full HTML — ~100ms on large events. It only needs to run
    // when the model has actually been rebuilt. Focusing a field, changing
    // plain text, or any action that calls updateDynamicSurfaces without
    // a model rebuild can safely skip it. After render() the tracker is
    // cleared (state._lastPreviewPaneModel = null) so the first post-
    // render updateDynamicSurfaces always syncs.
    if (!opts.skipHeavySync && state.model !== state._lastPreviewPaneModel) {
      state._lastPreviewPaneModel = state.model;
      perfMeasure('updateDynamicSurfaces.previewPane', () => syncPreviewObjectEditorPane(), {});
    }
    syncObjectCanvasFieldValues();
    syncObjectCanvasAssetActionState();
    syncSourceSliceAdvancedControls();
    syncSemanticLogicAdvancedControls();
    syncEventReadinessControls();
    syncObjectCanvasReviewButtons();
    // On a fresh full render the rendered-text nodes were just emitted by
    // fieldTextPreview with the same renderTextBlocks(value) output, so the
    // sync is a no-op rewrite. Skip it to avoid 1+ second of redundant
    // collectCanvasFieldEntries + innerHTML writes on large events. The same
    // sync is the dominant typing-pause cost, so also defer on skipHeavySync.
    // When changedFieldKeys is supplied (typical blur path), the sync narrows
    // to those nodes only — turns a 101-node walk into 1.
    if (!opts.skipRenderedFieldsSync && !opts.skipHeavySync) {
      syncPreviewObjectRenderedFields(opts.changedFieldKeys);
    }
    perfMeasure('updateDynamicSurfaces.bindVisibleEditUi', () => bindVisibleEditUi(elements.host), {});
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

  function syncPreviewObjectRenderedFields(changedFieldKeys) {
    const deps = previewEditorSyncDeps();
    if (changedFieldKeys instanceof Set && changedFieldKeys.size > 0) {
      deps.changedFieldKeys = changedFieldKeys;
    }
    previewEditorSyncApi().syncPreviewObjectRenderedFields(deps);
  }

  function updateRenderedPreviewForField(input) {
    // Throttle live preview writes to ~7/sec instead of 60/sec. Each write
    // sets innerHTML on a preview node, which forces the browser to
    // recalculate layout for the entire 40K+ node DOM. At 60fps (rAF) that
    // layout work starves the textarea's own rendering, making characters
    // appear one-by-one. At 150ms intervals the browser handles the textarea
    // natively between flushes, so typing feels smooth. The 150ms preview
    // latency is barely perceptible.
    if (!input || !input.dataset) {
      return;
    }
    const key = input.dataset.objectCanvasField;
    if (!key) {
      return;
    }
    if (!state.pendingLivePreviewInputs) {
      state.pendingLivePreviewInputs = new Map();
    }
    state.pendingLivePreviewInputs.set(key, input);
    if (state.livePreviewFrameHandle) {
      return;
    }
    var LIVE_PREVIEW_THROTTLE_MS = 150;
    const flush = () => {
      state.livePreviewFrameHandle = 0;
      const pending = state.pendingLivePreviewInputs;
      if (!pending || !pending.size) {
        return;
      }
      state.pendingLivePreviewInputs = new Map();
      const api = previewEditorSyncApi();
      if (!api || typeof api.updateRenderedPreviewForField !== 'function') {
        return;
      }
      const deps = previewEditorSyncDeps();
      perfMeasure('livePreviewFlush', () => {
        pending.forEach((entry) => {
          api.updateRenderedPreviewForField(deps, entry);
        });
      }, {keys: pending.size});
    };
    state.livePreviewFrameHandle = setTimeout(flush, LIVE_PREVIEW_THROTTLE_MS);
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

  function freshDefaultDraftForTemplate(template) {
    return draftWithUniqueFreshId(template, safeDefaultDraftForTemplate(template));
  }

  function draftWithUniqueFreshId(template, draftInput) {
    const nextTemplate = normalizeTemplate(template) || 'event';
    if (!['event', 'card', 'news'].includes(nextTemplate)) {
      return draftInput || {};
    }
    const draft = clonePlainObject(draftInput || {});
    const currentId = String(draft.id || '').trim();
    if (!currentId) {
      return draft;
    }
    const used = usedDraftIdsForTemplate(nextTemplate);
    if (!used.has(currentId)) {
      return draft;
    }
    let suffix = 2;
    let nextId = currentId + '_' + suffix;
    while (used.has(nextId)) {
      suffix += 1;
      nextId = currentId + '_' + suffix;
    }
    applyFreshDraftId(nextTemplate, draft, currentId, nextId);
    return draft;
  }

  function usedDraftIdsForTemplate(template) {
    const used = new Set();
    if (template === 'event' || template === 'card') {
      ensureArray(state.projectIndex && state.projectIndex.scenes).forEach((scene) => {
        const id = String(scene && scene.id || '').trim();
        if (id) {
          used.add(id);
        }
      });
    }
    const draftWorkspace = global.ProjectMapDraftWorkspaceUi;
    const draftState = draftWorkspace && typeof draftWorkspace.getState === 'function'
      ? draftWorkspace.getState()
      : null;
    ensureArray(draftState && draftState.items).forEach((item) => {
      if (item && item.template === template && item.draftId) {
        used.add(String(item.draftId));
      }
    });
    draftBranchList().forEach((branch) => {
      if (branch && String(branch.template || 'event') === template) {
        const id = String(branch.id || branch.draft && branch.draft.id || '').trim();
        if (id) {
          used.add(id);
        }
      }
    });
    if (state.baseDraft && state.template === template && state.baseDraft.id) {
      used.add(String(state.baseDraft.id));
    }
    return used;
  }

  function applyFreshDraftId(template, draft, previousId, nextId) {
    draft.id = nextId;
    if (template === 'event') {
      const previousSeenFlag = previousId ? previousId + '_seen' : '';
      if (draft.seenFlag === previousSeenFlag || !draft.seenFlag) {
        draft.seenFlag = nextId + '_seen';
      }
    }
  }

  function clonePlainObject(value) {
    try {
      return JSON.parse(JSON.stringify(value || {}));
    } catch (_err) {
      return Object.assign({}, value || {});
    }
  }

  function setDraftWorkspaceId(workspaceId, draft) {
    state.draftWorkspaceId = String(workspaceId || '');
    state.draftSavedSnapshot = state.draftWorkspaceId
      ? savedDraftSnapshot(draft || state.model && state.model.changeState && state.model.changeState.draft || state.baseDraft)
      : '';
  }

  function savedDraftSnapshot(draft) {
    try {
      return JSON.stringify(snapshotDraftPayload(draft || {}));
    } catch (_err) {
      return '';
    }
  }

  function snapshotDraftPayload(value) {
    if (!value || typeof value !== 'object') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(snapshotDraftPayload);
    }
    return Object.keys(value).sort().reduce((out, key) => {
      if (key !== 'studioAuthoringContext' && key !== 'authoringContext') {
        out[key] = snapshotDraftPayload(value[key]);
      }
      return out;
    }, {});
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

  function contentAdaptersApi() {
    return global.ProjectMapObjectCanvasContentAdapters || null;
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
  function perfApi() {
    if (global.ProjectMapCardBoardPerf) {
      return global.ProjectMapCardBoardPerf;
    }
    if (typeof require === 'function') {
      try {
        return require('./card_board_perf.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }
  function perfStart(name, detail) {
    const api = perfApi();
    return api && typeof api.start === 'function' ? api.start(name, detail || {}) : null;
  }
  function perfEnd(token, detail) {
    const api = token ? perfApi() : null;
    return api && typeof api.end === 'function' ? api.end(token, detail || {}) : null;
  }
  function perfMeasure(name, fn, detail) {
    const api = perfApi();
    return api && typeof api.measure === 'function' ? api.measure(name, fn, detail || {}) : fn();
  }
  function cardDeps(entry) { return {buildExistingModel, buildExistingModelFor, buildTemplateModel, collectValues, defaultDraftForTemplate, entry, focusDraftField, render, showWorkspace, t}; }
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

  function assetContractApi() {
    return global.ProjectMapAssetContractModel || null;
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
      semanticLogicApi: semanticLogicApi(),
      projectIndex: state && state.projectIndex || null,
      state
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

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function currentLocale() {
    const i18n = global.ProjectMapI18n;
    const value = i18n && typeof i18n.getLocale === 'function' ? i18n.getLocale() : global.document && global.document.documentElement && global.document.documentElement.lang || '';
    return String(value || '').toLowerCase().startsWith('zh') ? 'zh-Hant' : 'en';
  }

  function cssEscape(value) {
    const css = global && global.CSS;
    if (css && typeof css.escape === 'function') {
      return css.escape(String(value || ''));
    }
    return String(value || '').replace(/["\\\]]/g, '\\$&');
  }

})(typeof window !== 'undefined' ? window : globalThis);
