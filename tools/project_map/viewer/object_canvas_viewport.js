(function initProjectMapObjectCanvasViewport(global) {
  'use strict';

  const MIN_ZOOM = 0.10;
  const MAX_ZOOM = 1.8;
  const STEP_ZOOM_DELTA = 0.1;
  const WHEEL_ZOOM_SENSITIVITY = 0.0014;
  const ZOOM_TRANSITION_MS = 140;
  const ZOOM_TRANSITION = 'transform ' + ZOOM_TRANSITION_MS + 'ms cubic-bezier(0.2, 0.8, 0.2, 1)';

  /**
   * LOD thresholds expressed as zoom fractions.  Driven by CSS on the
   * board via `data-canvas-lod`; no HTML re-render needed.
   *
   *   LOD 0 (chip)       zoom < 20%   — bird's-eye navigation
   *   LOD 1 (overview)   zoom 20–35%  — identify cards, large fonts
   *   LOD 2 (working)    zoom 35–60%  — main working range, readable
   *   LOD 3 (full)       zoom ≥ 60%   — full detail, default fonts
   */
  const LOD_ZOOM_0 = 0.20;
  const LOD_ZOOM_1 = 0.35;
  const LOD_ZOOM_2 = 0.60;

  function canvasLod(zoom) {
    if (zoom < LOD_ZOOM_0) { return 0; }
    if (zoom < LOD_ZOOM_1) { return 1; }
    if (zoom < LOD_ZOOM_2) { return 2; }
    return 3;
  }

  function apply(root, state, options) {
    if (!root || !state) {
      return;
    }
    const scale = clamp(Number(state.canvasZoom || 1), MIN_ZOOM, MAX_ZOOM);
    state.canvasZoom = scale;
    const transform = 'translate(' + Number(state.canvasPanX || 0) + 'px, ' + Number(state.canvasPanY || 0) + 'px) scale(' + scale.toFixed(3) + ')';
    const board = root.querySelector('[data-object-canvas-graph-board]');
    const edges = root.querySelector('[data-object-canvas-graph-edges]');
    const label = root.querySelector('[data-object-canvas-zoom-label]');
    setTransformTransition([board, edges], Boolean(options && options.animate));
    var lod = canvasLod(scale);
    if (board) {
      board.style.transform = transform;
      board.style.transformOrigin = '0 0';
      promoteForZoom(board, lod);
    }
    if (edges) {
      edges.style.transform = transform;
      edges.style.transformOrigin = '0 0';
      promoteForZoom(edges, -1);
    }
    if (label) {
      label.textContent = Math.round(scale * 100) + '%';
    }
  }

  function zoom(root, state, action, event) {
    if (!state) {
      return;
    }
    if (action === 'reset' || action === 'fit') {
      if (!fitContentStoryboard(root, state)) {
        state.canvasZoom = 1;
        state.canvasPanX = 0;
        state.canvasPanY = 0;
      }
      apply(root, state, {animate: true});
      return;
    }
    const previous = clamp(Number(state.canvasZoom || 1), MIN_ZOOM, MAX_ZOOM);
    const next = nextZoom(previous, action, event);
    if (Math.abs(previous - next) < 0.001) {
      return;
    }
    if (event && zoomAroundPointer(root, state, previous, next, event)) {
      apply(root, state, {animate: true});
      return;
    }
    state.canvasZoom = next;
    apply(root, state, {animate: true});
  }

  function nextZoom(previous, action, event) {
    if (event && Number.isFinite(Number(event.deltaY))) {
      const factor = clamp(Math.exp(-Number(event.deltaY) * WHEEL_ZOOM_SENSITIVITY), 0.84, 1.19);
      return clamp(previous * factor, MIN_ZOOM, MAX_ZOOM);
    }
    if (action === 'in') {
      return clamp(previous + STEP_ZOOM_DELTA, MIN_ZOOM, MAX_ZOOM);
    }
    if (action === 'out') {
      return clamp(previous - STEP_ZOOM_DELTA, MIN_ZOOM, MAX_ZOOM);
    }
    return previous;
  }

  function zoomAroundPointer(root, state, previous, next, event) {
    const canvas = viewportCanvas(root, event);
    if (!canvas) {
      return false;
    }
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return false;
    }
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const graphX = (localX - Number(state.canvasPanX || 0)) / previous;
    const graphY = (localY - Number(state.canvasPanY || 0)) / previous;
    state.canvasZoom = next;
    state.canvasPanX = Math.round(localX - graphX * next);
    state.canvasPanY = Math.round(localY - graphY * next);
    return true;
  }

  function viewportCanvas(root, event) {
    if (event && isViewportCanvas(event.currentTarget)) {
      return event.currentTarget;
    }
    if (!root || typeof root.querySelector !== 'function') {
      return null;
    }
    return root.querySelector('[data-content-storyboard-canvas]') || root.querySelector('[data-object-canvas-graph-canvas]');
  }

  function isViewportCanvas(element) {
    if (!element || !element.dataset) {
      return false;
    }
    return element.dataset.contentStoryboardCanvas === 'true' || element.dataset.objectCanvasGraphCanvas === 'true';
  }

  /**
   * Temporarily promote to GPU layer during zoom for smooth animation,
   * then demote after ~200ms of inactivity so the browser re-rasterizes
   * text at the current zoom → crisp at rest, smooth during motion.
   */
  var WILL_CHANGE_SETTLE_MS = 300;

  /**
   * During zoom: promote to GPU layer for smooth compositing.
   * After zoom settles: demote (re-rasterize for crisp text) and
   * apply the deferred LOD level in one batched repaint.
   *
   * @param {Element} element  — board or edges element
   * @param {number}  lod      — target LOD (≥0 to set on settle, <0 to skip)
   */
  function promoteForZoom(element, lod) {
    if (!element || !element.style) { return; }
    element.style.willChange = 'transform';
    var lodStr = lod >= 0 ? String(lod) : '';
    // First paint (after render() rebuilds DOM): set LOD immediately so
    // cards don't flash in default/small-font state for 300ms.
    if (lodStr && element.dataset && element.dataset.canvasLod !== lodStr && !element.__dmsWillChangeTimer) {
      element.dataset.canvasLod = lodStr;
    }
    if (!motionAllowed()) {
      // Reduced-motion: keep will-change permanently, update LOD immediately
      if (lodStr && element.dataset) {
        element.dataset.canvasLod = lodStr;
      }
      return;
    }
    if (element.__dmsWillChangeTimer) {
      clearTimeout(element.__dmsWillChangeTimer);
    }
    // Stash target LOD so the settle callback uses the latest value
    if (lod >= 0) { element.__dmsTargetLod = lod; }
    element.__dmsWillChangeTimer = setTimeout(function () {
      // Batch: apply LOD + demote in one frame
      if (element.__dmsTargetLod !== undefined && element.dataset) {
        element.dataset.canvasLod = String(element.__dmsTargetLod);
      }
      element.style.willChange = '';
      element.__dmsWillChangeTimer = null;
    }, WILL_CHANGE_SETTLE_MS);
  }

  function setTransformTransition(elements, animate) {
    const transition = animate && motionAllowed() ? ZOOM_TRANSITION : '';
    elements.forEach((element) => {
      if (!element || !element.style) {
        return;
      }
      if (element.__dmsCanvasZoomTransitionTimer) {
        clearTimeout(element.__dmsCanvasZoomTransitionTimer);
        element.__dmsCanvasZoomTransitionTimer = null;
      }
      element.style.transition = transition;
      if (transition) {
        element.__dmsCanvasZoomTransitionTimer = setTimeout(() => {
          element.style.transition = '';
          element.__dmsCanvasZoomTransitionTimer = null;
        }, ZOOM_TRANSITION_MS + 40);
      }
    });
  }

  function motionAllowed() {
    if (!global || typeof global.matchMedia !== 'function') {
      return true;
    }
    try {
      return !global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_err) {
      return true;
    }
  }

  function fitContentStoryboard(root, state) {
    const canvas = root && root.querySelector('[data-content-storyboard-canvas]');
    const board = root && root.querySelector('[data-content-storyboard-board]');
    if (!canvas || !board || !state) {
      return false;
    }
    const width = dimension(canvas, '--content-storyboard-width', board.offsetWidth || 1400);
    const height = dimension(canvas, '--content-storyboard-height', board.offsetHeight || 680);
    const rect = canvas.getBoundingClientRect();
    if (!width || !height || !rect.width || !rect.height) {
      return false;
    }
    const scale = clamp(Math.min(rect.width / width, rect.height / height) * 0.96, MIN_ZOOM, 1);
    state.canvasZoom = scale;
    state.canvasPanX = Math.round(Math.max(12, (rect.width - width * scale) / 2));
    state.canvasPanY = 18;
    return true;
  }

  function dimension(element, property, fallback) {
    const inline = Number.parseFloat(element.style.getPropertyValue(property) || '');
    if (Number.isFinite(inline) && inline > 0) {
      return inline;
    }
    const computed = global.getComputedStyle ? Number.parseFloat(global.getComputedStyle(element).getPropertyValue(property) || '') : 0;
    return Number.isFinite(computed) && computed > 0 ? computed : Number(fallback || 0);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  const api = {apply, zoom, fitContentStoryboard, clamp, nextZoom};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectCanvasViewport = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
