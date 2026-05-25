// @ts-check
/**
 * spatial_canvas_workspace_state.js — UI state management for the Spatial
 * Canvas surface.
 *
 * Mirrors the role of storyboard_workspace_state.js: holds pan/zoom/LOD
 * state, delegates rendering to the surface renderer, and dispatches
 * actions from user interaction.
 *
 * Phase 0: skeleton with state management; no actual UI rendering yet.
 */
(function initProjectMapSpatialCanvasWorkspaceState(global) {
  'use strict';

  var LAYOUT_STORAGE_KEY = 'dendry-mod-studio-spatial-canvas-layout-v1';
  var DEFAULT_ZOOM = 0.5;
  var MIN_ZOOM = 0.05;
  var MAX_ZOOM = 2.0;
  var ZOOM_STEP = 0.1;

  // ── state lifecycle ────────────────────────────────────────────────────

  /**
   * Initialize spatial canvas state fields on the shared state object.
   */
  function reset(state) {
    state.spatialPanX = 0;
    state.spatialPanY = 0;
    state.spatialZoom = DEFAULT_ZOOM;
    state.spatialSelectedKey = '';
    state.spatialCollapsedStacks = {};
    state.spatialLodOverride = null;
    state.spatialSearchQuery = '';
    state.spatialModel = null;
  }

  /**
   * Collect the options needed for the surface renderer.
   */
  function surfaceOptions(state) {
    return {
      panX: state.spatialPanX || 0,
      panY: state.spatialPanY || 0,
      zoom: clampZoom(state.spatialZoom),
      selectedKey: state.spatialSelectedKey || '',
      collapsedStacks: state.spatialCollapsedStacks || {},
      lodOverride: state.spatialLodOverride,
      searchQuery: state.spatialSearchQuery || '',
      runtimeLensSession: state.runtimeLensSession,
      runtimeLensStatus: state.runtimeLensStatus,
      boardChromeCollapsed: Boolean(state.boardChromeCollapsed)
    };
  }

  /**
   * Render the stage HTML by delegating to the surface renderer.
   */
  function renderStage(state, model) {
    var surface = surfaceApi();
    if (!surface || typeof surface.render !== 'function') {
      return '';
    }
    return surface.render(model, Object.assign({
      projectIndex: state.projectIndex,
      selected: state.spatialSelectedKey || state.selectedCanvasNode,
      nodePositions: state.nodePositions || {},
      editorOverlay: state.editorOverlay
    }, surfaceOptions(state)));
  }

  // ── action dispatch ────────────────────────────────────────────────────

  function handleAction(state, action, target, deps) {
    if (action === 'spatial_pan') {
      var dx = Number(target && target.dataset && target.dataset.spatialDx || 0);
      var dy = Number(target && target.dataset && target.dataset.spatialDy || 0);
      state.spatialPanX = (state.spatialPanX || 0) + dx;
      state.spatialPanY = (state.spatialPanY || 0) + dy;
      return rebuild(state, deps);
    }
    if (action === 'spatial_zoom_in') {
      state.spatialZoom = clampZoom((state.spatialZoom || DEFAULT_ZOOM) + ZOOM_STEP);
      return rebuild(state, deps);
    }
    if (action === 'spatial_zoom_out') {
      state.spatialZoom = clampZoom((state.spatialZoom || DEFAULT_ZOOM) - ZOOM_STEP);
      return rebuild(state, deps);
    }
    if (action === 'spatial_zoom_reset') {
      state.spatialPanX = 0;
      state.spatialPanY = 0;
      state.spatialZoom = DEFAULT_ZOOM;
      return rebuild(state, deps);
    }
    if (action === 'spatial_select_card') {
      var key = target && target.dataset && target.dataset.spatialCardKey || '';
      state.spatialSelectedKey = key;
      return rebuild(state, deps);
    }
    if (action === 'spatial_zoom_to_card') {
      var cardKey = target && target.dataset && target.dataset.spatialCardKey || '';
      return zoomToCard(state, cardKey, deps);
    }
    if (action === 'spatial_toggle_stack') {
      var stackId = target && target.dataset && target.dataset.spatialStackId || '';
      if (stackId) {
        var stacks = Object.assign({}, state.spatialCollapsedStacks || {});
        stacks[stackId] = !stacks[stackId];
        state.spatialCollapsedStacks = stacks;
      }
      return rebuild(state, deps);
    }
    if (action === 'spatial_search') {
      state.spatialSearchQuery = target && target.value || '';
      return rebuild(state, deps);
    }
    return false;
  }

  // ── zoom-to-card ───────────────────────────────────────────────────────

  function zoomToCard(state, cardKey, deps) {
    var model = state.spatialModel;
    if (!model || !cardKey) { return rebuild(state, deps); }
    var card = ensureArray(model.cards).find(function (c) { return c.key === cardKey; });
    if (!card || !card.position) { return rebuild(state, deps); }
    var pos = card.position;
    // Measure the viewport element if available, else use defaults.
    var vp = measureViewport();
    var vpW = vp.width || 1200;
    var vpH = vp.height || 800;
    // Target zoom: card fills ~60% of viewport width
    var zoom = clampZoom(vpW * 0.6 / (pos.width || 300));
    // Center the card in the viewport
    var cx = pos.x + (pos.width || 300) / 2;
    var cy = pos.y + (pos.height || 120) / 2;
    state.spatialZoom = zoom;
    state.spatialPanX = -(cx * zoom - vpW / 2);
    state.spatialPanY = -(cy * zoom - vpH / 2);
    state.spatialSelectedKey = cardKey;
    // Signal the renderer to animate this transition
    state.spatialAnimateNext = true;
    return rebuild(state, deps);
  }

  /**
   * Zoom the viewport to fit all cards (overview) or a specific baseplate.
   */
  function zoomToFitAll(state, deps, baseplateId) {
    var model = state.spatialModel;
    if (!model) { return rebuild(state, deps); }
    var cards = ensureArray(model.cards);
    if (baseplateId) {
      var bp = ensureArray(model.baseplates).find(function (b) { return b.id === baseplateId; });
      if (bp) {
        var bpKeys = new Set(bp.cardKeys || []);
        cards = cards.filter(function (c) { return bpKeys.has(c.key); });
      }
    }
    if (!cards.length) { return rebuild(state, deps); }
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cards.forEach(function (c) {
      var p = c.position || {};
      minX = Math.min(minX, p.x || 0);
      minY = Math.min(minY, p.y || 0);
      maxX = Math.max(maxX, (p.x || 0) + (p.width || 300));
      maxY = Math.max(maxY, (p.y || 0) + (p.height || 120));
    });
    var vp = measureViewport();
    var vpW = vp.width || 1200;
    var vpH = vp.height || 800;
    var contentW = maxX - minX + 80;
    var contentH = maxY - minY + 80;
    var zoom = clampZoom(Math.min(vpW / contentW, vpH / contentH));
    var cx = (minX + maxX) / 2;
    var cy = (minY + maxY) / 2;
    state.spatialZoom = zoom;
    state.spatialPanX = -(cx * zoom - vpW / 2);
    state.spatialPanY = -(cy * zoom - vpH / 2);
    state.spatialAnimateNext = true;
    return rebuild(state, deps);
  }

  function measureViewport() {
    if (typeof document === 'undefined') { return {width: 1200, height: 800}; }
    var el = document.querySelector('.spatial-canvas-viewport');
    if (el) { return {width: el.clientWidth, height: el.clientHeight}; }
    return {width: 1200, height: 800};
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  function clampZoom(value) {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value) || DEFAULT_ZOOM));
  }

  function rebuild(state, deps) {
    if (deps && typeof deps.scheduleRefresh === 'function') {
      deps.scheduleRefresh({source: 'spatialCanvas'});
    }
    return true;
  }

  function surfaceApi() {
    if (global && global.ProjectMapSpatialCanvasSurface) {
      return global.ProjectMapSpatialCanvasSurface;
    }
    if (typeof require === 'function') {
      try { return require('./spatial_canvas_surface.js'); } catch (_err) { return null; }
    }
    return null;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  // ── export ──────────────────────────────────────────────────────────────

  var api = {
    reset: reset,
    surfaceOptions: surfaceOptions,
    renderStage: renderStage,
    handleAction: handleAction,
    zoomToCard: zoomToCard,
    zoomToFitAll: zoomToFitAll,
    MIN_ZOOM: MIN_ZOOM,
    MAX_ZOOM: MAX_ZOOM,
    DEFAULT_ZOOM: DEFAULT_ZOOM
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSpatialCanvasWorkspaceState = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
