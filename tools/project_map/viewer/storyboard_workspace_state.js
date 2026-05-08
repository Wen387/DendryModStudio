(function initProjectMapStoryboardWorkspaceState(global) {
  'use strict';

  const STORY_CARD_COLOR_STORAGE_KEY = 'dendry-mod-studio-storyboard-card-colors-v1';

  function reset(state) {
    state.storyboardView = 'timeline';
    state.storyCanvasCategory = 'story';
    state.storySearchQuery = '';
    state.storyScopeCollapsed = false;
    state.storyOverviewCollapsed = false;
    state.storyCardColors = readStoredCardColors();
    state.storyScopeMode = 'focus';
    state.storyScopeWindow = '';
    state.storyChainDepth = '1';
    state.storyPaletteOpen = false;
    state.storyPaletteQuery = '';
    state.storyPaletteType = 'all';
    state.storyPaletteDropContext = null;
  }

  function surfaceOptions(state) {
    return {
      view: state.storyboardView,
      storyCanvasCategory: state.storyCanvasCategory || 'story',
      storySearchQuery: state.storySearchQuery || '',
      storyScopeCollapsed: Boolean(state.storyScopeCollapsed),
      storyOverviewCollapsed: Boolean(state.storyOverviewCollapsed),
      storyCardColors: state.storyCardColors || readStoredCardColors(),
      storyScopeMode: state.storyScopeMode,
      storyScopeWindow: state.storyScopeWindow,
      storyChainDepth: state.storyChainDepth,
      storyPaletteOpen: state.storyPaletteOpen,
      storyPaletteQuery: state.storyPaletteQuery,
      storyPaletteType: state.storyPaletteType,
      storyPaletteDropContext: state.storyPaletteDropContext,
      runtimeLensSession: state.runtimeLensSession,
      runtimeLensStatus: state.runtimeLensStatus,
      runtimeLensFocusKey: state.runtimeLensFocusKey,
      runtimeLensDraftKey: state.runtimeLensDraftKey,
      runtimeLensCurrentDraftKey: state.runtimeLensCurrentDraftKey,
      runtimeLensExpanded: state.runtimeLensExpanded,
      runtimeLensCollapsed: state.runtimeLensCollapsed,
      boardChromeCollapsed: Boolean(state.boardChromeCollapsed)
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
    if (action === 'set_story_canvas_category') {
      const category = normalizeCanvasCategory(target && target.dataset && target.dataset.storyboardCanvasCategory);
      return rebuild(state, deps, {
        storyCanvasCategory: category,
        storyScopeMode: category === 'story' ? (state.storyScopeMode || 'focus') : 'expanded'
      });
    }
    if (action === 'toggle_story_scope_panel') {
      return rebuild(state, deps, {storyScopeCollapsed: !state.storyScopeCollapsed});
    }
    if (action === 'toggle_story_overview_panel') {
      return rebuild(state, deps, {storyOverviewCollapsed: !state.storyOverviewCollapsed});
    }
    if (action === 'set_story_card_color') {
      const key = target && target.dataset && target.dataset.storyboardCardColorKey || '';
      const color = target && target.dataset && target.dataset.storyboardCardColor || '';
      return setCardColor(state, key, color, deps);
    }
    if (action === 'toggle_story_palette') {
      return rebuild(state, deps, {storyPaletteOpen: !state.storyPaletteOpen});
    }
    if (action === 'close_story_palette') {
      return rebuild(state, deps, {storyPaletteOpen: false});
    }
    if (action === 'set_story_palette_type') {
      const type = target && target.dataset && target.dataset.storyboardPaletteType || 'all';
      return rebuild(state, deps, {storyPaletteOpen: true, storyPaletteType: normalizePaletteType(type)});
    }
    return false;
  }

  function setPaletteQuery(state, query, deps) {
    return rebuild(state, deps, {storyPaletteOpen: true, storyPaletteQuery: String(query || '')});
  }

  function setSearchQuery(state, query, deps) {
    return rebuild(state, deps, {storySearchQuery: normalizeSearchQuery(query)});
  }

  function bindPalette(root, state, deps) {
    const query = root && root.querySelector && root.querySelector('[data-storyboard-palette-query]');
    if (query && query.dataset.storyboardPaletteQueryBound !== 'true') {
      query.dataset.storyboardPaletteQueryBound = 'true';
      query.addEventListener('input', () => {
        if (query.__dmsStoryboardPaletteQueryTimer) {
          clearTimeout(query.__dmsStoryboardPaletteQueryTimer);
        }
        query.__dmsStoryboardPaletteQueryTimer = setTimeout(() => {
          const value = query.value || '';
          const selection = {
            start: typeof query.selectionStart === 'number' ? query.selectionStart : String(value).length,
            end: typeof query.selectionEnd === 'number' ? query.selectionEnd : String(value).length
          };
          setPaletteQuery(state, value, deps);
          focusPaletteInput(root, value, selection);
        }, 120);
      });
    }
    bindSearch(root, state, deps);
    bindColorPickers(root, state, deps);
  }

  function dropPaletteItem(state, payload, target, deps) {
    const itemKey = String(payload && payload.key || '').trim();
    if (!itemKey) {
      state.status = deps.t('objectCanvas.status.paletteDropUnsupported', 'This palette drop is not supported here.');
      deps.render();
      return false;
    }
    const context = dropContextFor(state, payload, target);
    const insertKey = context.insertKey;
    state.storyPaletteDropContext = context;
    if (insertKey && (context.targetKind === 'timeline_lane' || context.targetKind === 'timeline_insert' || context.targetKind === 'undated')) {
      state.storyScopeWindow = normalizeLane(insertKey);
    }
    const parsed = parseStoryObjectKey(itemKey);
    if (parsed && parsed.kind !== 'draft' && parsed.kind !== 'news') {
      const opened = selectObject(state, itemKey, deps);
      state.storyPaletteDropContext = context;
      if (opened) {
        state.status = deps.t('objectCanvas.status.paletteDropped', 'Palette item is now visible in this Storyboard context.');
        deps.render();
        return true;
      }
    }
    state.selectedCanvasNode = itemKey;
    state.status = deps.t('objectCanvas.status.paletteDropped', 'Palette item is now visible in this Storyboard context.');
    return rebuild(state, deps, {});
  }

  function bindSearch(root, state, deps) {
    const input = root && root.querySelector && root.querySelector('[data-content-storyboard-search]');
    if (!input || input.dataset.contentStoryboardSearchBound === 'true') {
      return;
    }
    input.dataset.contentStoryboardSearchBound = 'true';
    input.addEventListener('input', () => {
      if (input.__dmsStoryboardSearchTimer) {
        clearTimeout(input.__dmsStoryboardSearchTimer);
      }
      input.__dmsStoryboardSearchTimer = setTimeout(() => {
        const value = input.value || '';
        setSearchQuery(state, value, deps);
        focusSearchInput(root, value);
      }, 140);
    });
  }

  function focusSearchInput(root, value) {
    const next = root && root.querySelector && root.querySelector('[data-content-storyboard-search]');
    if (!next || typeof next.focus !== 'function') {
      return;
    }
    try {
      next.focus();
      if (typeof next.setSelectionRange === 'function') {
        const length = String(value || '').length;
        next.setSelectionRange(length, length);
      }
    } catch (_err) {
      // Search remains functional even if the embedded browser refuses focus restoration.
    }
  }

  function focusPaletteInput(root, value, selection) {
    const next = root && root.querySelector && root.querySelector('[data-storyboard-palette-query]');
    if (!next || typeof next.focus !== 'function') {
      return;
    }
    try {
      next.focus();
      if (typeof next.setSelectionRange === 'function') {
        const length = String(value || '').length;
        const start = clampSelection(selection && selection.start, length);
        const end = clampSelection(selection && selection.end, length);
        next.setSelectionRange(start, end);
      }
    } catch (_err) {
      // Palette filtering still works if the browser denies focus restoration.
    }
  }

  function clampSelection(value, length) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return length;
    }
    return Math.max(0, Math.min(length, Math.floor(number)));
  }

  function bindColorPickers(root, state, deps) {
    if (!root || !root.querySelectorAll) {
      return;
    }
    root.querySelectorAll('[data-storyboard-card-color-picker]').forEach((input) => {
      if (input.dataset.storyboardCardColorBound === 'true') {
        return;
      }
      input.dataset.storyboardCardColorBound = 'true';
      input.addEventListener('input', () => {
        setCardColor(state, input.dataset.storyboardCardColorKey || '', input.value || '', deps);
      });
      input.addEventListener('change', () => {
        setCardColor(state, input.dataset.storyboardCardColorKey || '', input.value || '', deps);
      });
    });
  }

  function setCardColor(state, key, color, deps) {
    const cardKey = String(key || '').trim();
    if (!cardKey) {
      return false;
    }
    const next = Object.assign({}, state.storyCardColors || readStoredCardColors());
    const safeColor = normalizeHexColor(color);
    if (safeColor) {
      next[cardKey] = safeColor;
    } else {
      delete next[cardKey];
    }
    state.storyCardColors = trimColorMap(next);
    writeStoredCardColors(state.storyCardColors);
    return rebuild(state, deps, {});
  }

  function selectObject(state, nodeKey, deps) {
    if ((state.workspace || 'content') !== 'content') {
      return false;
    }
    if (String(nodeKey || '').indexOf('relation:') === 0) {
      state.values = deps.collectValues();
      state.selectedCanvasNode = nodeKey;
      state.editorOverlay = true;
      state.model = state.mode === 'existing' ? deps.buildExistingModel({values: state.values}) : deps.buildTemplateModel({values: state.values});
      state.status = deps.t('objectCanvas.status.storyRelationSelected', 'Selected event-chain relationship; edit the source event routes in the object editor.');
      deps.render();
      return true;
    }
    const parsed = parseStoryObjectKey(nodeKey);
    if (!parsed || parsed.kind === 'route' || parsed.kind === 'draft') {
      return false;
    }
    state.values = deps.collectValues();
    const itemId = parsed.parentId || parsed.id;
    if (!itemId) {
      return false;
    }
    if (state.mode === 'existing' && state.item === itemId && (state.view === parsed.view || parsed.view === 'cards' && state.view === 'cards')) {
      state.selectedCanvasNode = nodeKey;
      state.editorOverlay = true;
      state.model = deps.buildExistingModel({values: state.values});
      deps.render();
      return true;
    }
    const nextModel = deps.buildExistingModelFor(parsed.view, itemId, {values: {}});
    if (!nextModel || !nextModel.ok) {
      return false;
    }
    state.mode = 'existing';
    state.template = 'existing';
    state.view = parsed.view;
    state.item = itemId;
    state.workspace = 'content';
    state.selectedCanvasNode = nodeKey;
    state.editorOverlay = true;
    state.values = {};
    state.model = nextModel;
    state.status = deps.t('objectCanvas.status.storyObjectSelected', 'Selected story object opened in the object editor.');
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
        storyCanvasCategory: state.storyCanvasCategory || 'story',
        storySearchQuery: state.storySearchQuery || '',
        storyScopeCollapsed: Boolean(state.storyScopeCollapsed),
        storyOverviewCollapsed: Boolean(state.storyOverviewCollapsed),
        storyScopeMode: state.storyScopeMode,
        storyScopeWindow: state.storyScopeWindow,
        storyChainDepth: state.storyChainDepth,
        storyPaletteOpen: state.storyPaletteOpen,
        storyPaletteQuery: state.storyPaletteQuery,
        storyPaletteType: state.storyPaletteType,
        storyPaletteDropContext: state.storyPaletteDropContext,
        runtimeLensFocusKey: state.runtimeLensFocusKey,
        runtimeLensDraftKey: state.runtimeLensDraftKey,
        runtimeLensCurrentDraftKey: state.runtimeLensCurrentDraftKey,
        runtimeLensCollapsed: state.runtimeLensCollapsed,
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
    state.storyCanvasCategory = normalizeCanvasCategory(context.storyCanvasCategory);
    state.storySearchQuery = normalizeSearchQuery(context.storySearchQuery);
    state.storyScopeCollapsed = Boolean(context.storyScopeCollapsed);
    state.storyOverviewCollapsed = Boolean(context.storyOverviewCollapsed);
    state.storyScopeMode = String(context.storyScopeMode || '') === 'expanded' ? 'expanded' : 'focus';
    state.storyScopeWindow = String(context.storyScopeWindow || '');
    state.storyChainDepth = normalizeDepth(context.storyChainDepth);
    state.storyPaletteOpen = Boolean(context.storyPaletteOpen);
    state.storyPaletteQuery = String(context.storyPaletteQuery || '');
    state.storyPaletteType = normalizePaletteType(context.storyPaletteType);
    state.storyPaletteDropContext = context.storyPaletteDropContext && typeof context.storyPaletteDropContext === 'object' ? Object.assign({}, context.storyPaletteDropContext) : null;
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
      storyCanvasCategory: state.storyCanvasCategory || 'story',
      storySearchQuery: state.storySearchQuery || '',
      selectedKey: state.selectedCanvasNode,
      storyScopeMode: state.storyScopeMode,
      storyScopeWindow: state.storyScopeWindow,
      storyChainDepth: state.storyChainDepth,
      paletteDropContext: state.storyPaletteDropContext
    });
    state.draftBranches.push(draft);
    state.selectedCanvasNode = 'draft:' + draft.id;
    state.editorOverlay = true;
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
    const match = String(nodeKey || '').match(/^(event|card|advisor|news|section|route|draft):(.+)$/);
    if (!match) {
      return null;
    }
    const kind = match[1];
    const id = match[2];
    if (kind === 'section') {
      return {
        kind,
        id,
        parentId: String(id || '').split('.')[0] || '',
        view: 'events'
      };
    }
    return {
      kind,
      id,
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

  function normalizePaletteType(value) {
    const text = String(value || 'all');
    return ['all', 'event', 'news', 'card', 'advisor', 'draft'].includes(text) ? text : 'all';
  }

  function normalizeCanvasCategory(value) {
    const text = String(value || 'story');
    return text === 'cards' || text === 'all' ? text : 'story';
  }

  function normalizeSearchQuery(value) {
    return String(value || '').trim().slice(0, 80);
  }

  function normalizeHexColor(value) {
    const text = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : '';
  }

  function trimColorMap(map) {
    const out = {};
    Object.keys(map || {}).slice(-400).forEach((key) => {
      const color = normalizeHexColor(map[key]);
      if (key && color) {
        out[key] = color;
      }
    });
    return out;
  }

  function readStoredCardColors() {
    if (!global || !global.localStorage) {
      return {};
    }
    try {
      return trimColorMap(JSON.parse(global.localStorage.getItem(STORY_CARD_COLOR_STORAGE_KEY) || '{}'));
    } catch (_err) {
      return {};
    }
  }

  function writeStoredCardColors(map) {
    if (!global || !global.localStorage) {
      return;
    }
    try {
      global.localStorage.setItem(STORY_CARD_COLOR_STORAGE_KEY, JSON.stringify(trimColorMap(map)));
    } catch (_err) {
      // Visual annotations are best-effort local cache; project edits remain unaffected.
    }
  }

  function dropContextFor(state, payload, target) {
    const dataset = target && target.dataset || {};
    return {
      itemKey: String(payload && payload.key || ''),
      itemTitle: String(payload && payload.title || ''),
      targetKind: String(dataset.storyboardDropTarget || 'canvas'),
      insertKey: String(dataset.contentStoryboardInsert || dataset.contentStoryboardLane || ''),
      view: state.storyboardView || 'timeline'
    };
  }

  const api = {reset, surfaceOptions, renderStage, setView, handleAction, setPaletteQuery, setSearchQuery, bindPalette, dropPaletteItem, selectObject, draftWithContext, restoreContext, createRelatedDraft};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapStoryboardWorkspaceState = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
