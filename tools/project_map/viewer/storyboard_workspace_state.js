(function initProjectMapStoryboardWorkspaceState(global) {
  'use strict';

  function reset(state) {
    state.storyboardView = 'timeline';
    state.storyScopeMode = 'focus';
    state.storyScopeWindow = '';
    state.storyChainDepth = '1';
  }

  function surfaceOptions(state) {
    return {
      view: state.storyboardView,
      storyScopeMode: state.storyScopeMode,
      storyScopeWindow: state.storyScopeWindow,
      storyChainDepth: state.storyChainDepth
    };
  }

  function renderStage(state, model) {
    const surface = global.ProjectMapContentStoryboardSurface;
    return surface && typeof surface.render === 'function'
      ? surface.render(model, Object.assign({
        projectIndex: state.projectIndex,
        selected: state.selectedCanvasNode,
        nodePositions: state.nodePositions || {},
        draftBranches: state.draftBranches || [],
        editorOverlay: state.editorOverlay
      }, surfaceOptions(state)))
      : '';
  }

  function setView(state, view, deps) {
    return rebuild(state, deps, {storyboardView: String(view || '') === 'chain' ? 'chain' : 'timeline'});
  }

  function handleAction(state, action, target, deps) {
    if (action === 'story_scope_focus') {
      return rebuild(state, deps, {storyScopeMode: 'focus'});
    }
    if (action === 'story_scope_expand') {
      return rebuild(state, deps, {storyScopeMode: 'expanded'});
    }
    if (action === 'story_scope_reset') {
      state.canvasPanX = 0;
      state.canvasPanY = 0;
      state.canvasZoom = 1;
      return rebuild(state, deps, {storyScopeMode: 'focus', storyScopeWindow: ''});
    }
    if (action === 'focus_story_scope') {
      const lane = target && target.dataset && (target.dataset.contentStoryboardScopeLane || target.dataset.contentStoryboardInsert) || '';
      return rebuild(state, deps, {storyScopeWindow: normalizeLane(lane), storyScopeMode: state.storyScopeMode || 'focus'});
    }
    if (action === 'set_chain_depth') {
      const depth = target && target.dataset && target.dataset.contentStoryboardDepth || '1';
      return rebuild(state, deps, {storyChainDepth: normalizeDepth(depth)});
    }
    return false;
  }

  function selectObject(state, nodeKey, deps) {
    if ((state.workspace || 'content') !== 'content') {
      return false;
    }
    const parsed = parseStoryObjectKey(nodeKey);
    if (!parsed || parsed.kind === 'news' || parsed.kind === 'route' || parsed.kind === 'draft') {
      return false;
    }
    state.values = deps.collectValues();
    if (state.mode === 'existing' && state.item === parsed.id && (state.view === parsed.view || parsed.view === 'cards' && state.view === 'cards')) {
      state.selectedCanvasNode = nodeKey;
      state.model = deps.buildExistingModel({values: state.values});
      deps.render();
      return true;
    }
    const nextModel = deps.buildExistingModelFor(parsed.view, parsed.id, {values: {}});
    if (!nextModel || !nextModel.ok) {
      return false;
    }
    state.mode = 'existing';
    state.template = 'existing';
    state.view = parsed.view;
    state.item = parsed.id;
    state.workspace = 'content';
    state.selectedCanvasNode = nodeKey;
    state.storyScopeWindow = '';
    state.values = {};
    state.model = nextModel;
    state.status = deps.t('objectCanvas.status.storyObjectSelected', 'Selected story object opened for inline editing.');
    deps.showWorkspace('existing');
    deps.render();
    return true;
  }

  function draftWithContext(state, draft) {
    if (!draft || typeof draft !== 'object') {
      return draft;
    }
    return Object.assign({}, draft, {
      studioAuthoringContext: {
        workspace: 'content',
        surface: 'content_storyboard',
        storyboardView: state.storyboardView,
        storyScopeMode: state.storyScopeMode,
        storyScopeWindow: state.storyScopeWindow,
        storyChainDepth: state.storyChainDepth,
        selectedCanvasNode: state.selectedCanvasNode,
        nodePositions: Object.assign({}, state.nodePositions || {}),
        draftBranchCount: (state.draftBranches || []).length,
        editorOverlay: Boolean(state.editorOverlay)
      }
    });
  }

  function restoreContext(state, context, deps) {
    if (!context || context.workspace !== 'content') {
      return false;
    }
    state.storyboardView = String(context.storyboardView || '') === 'chain' ? 'chain' : 'timeline';
    state.storyScopeMode = String(context.storyScopeMode || '') === 'expanded' ? 'expanded' : 'focus';
    state.storyScopeWindow = String(context.storyScopeWindow || '');
    state.storyChainDepth = normalizeDepth(context.storyChainDepth);
    state.selectedCanvasNode = String(context.selectedCanvasNode || state.selectedCanvasNode || 'object');
    state.nodePositions = context.nodePositions && typeof context.nodePositions === 'object' ? Object.assign({}, context.nodePositions) : {};
    state.editorOverlay = Boolean(context.editorOverlay);
    state.model = state.mode === 'existing' ? deps.buildExistingModel({values: state.values}) : deps.buildTemplateModel({values: state.values});
    deps.render();
    return true;
  }

  function createRelatedDraft(state, action, target, deps) {
    const api = global.ProjectMapAuthoringReferenceIndex;
    if (!api || typeof api.branchDraft !== 'function') {
      return false;
    }
    const draft = api.branchDraft(action, state.model || {}, {
      insertKey: target && target.dataset && target.dataset.contentStoryboardInsert || '',
      view: state.storyboardView,
      selectedKey: state.selectedCanvasNode,
      storyScopeMode: state.storyScopeMode,
      storyScopeWindow: state.storyScopeWindow,
      storyChainDepth: state.storyChainDepth
    });
    state.draftBranches.push(draft);
    state.selectedCanvasNode = 'draft:' + draft.id;
    state.status = deps.t('objectCanvas.status.branchCreated', 'A related draft card was added to the Storyboard.');
    deps.render();
    return true;
  }

  function rebuild(state, deps, patch) {
    Object.assign(state, patch || {});
    state.values = deps.collectValues();
    state.model = state.mode === 'existing' ? deps.buildExistingModel({values: state.values}) : deps.buildTemplateModel({values: state.values});
    deps.render();
    return true;
  }

  function parseStoryObjectKey(nodeKey) {
    const match = String(nodeKey || '').match(/^(event|card|advisor|news|route|draft):(.+)$/);
    if (!match) {
      return null;
    }
    const kind = match[1];
    return {
      kind,
      id: match[2],
      view: kind === 'event' ? 'events' : kind === 'card' || kind === 'advisor' ? 'cards' : kind
    };
  }

  function normalizeLane(value) {
    return String(value || '').replace(/^(?:time|year_month|turn|chapter|phase|chain_order|source_order|lane):/, '');
  }

  function normalizeDepth(value) {
    const text = String(value || '1');
    return text === '2' || text === 'full' ? text : '1';
  }

  const api = {reset, surfaceOptions, renderStage, setView, handleAction, selectObject, draftWithContext, restoreContext, createRelatedDraft};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapStoryboardWorkspaceState = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
