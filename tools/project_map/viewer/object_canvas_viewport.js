(function initProjectMapObjectCanvasViewport(global) {
  'use strict';

  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 1.8;

  function apply(root, state) {
    if (!root || !state) {
      return;
    }
    const scale = clamp(Number(state.canvasZoom || 1), MIN_ZOOM, MAX_ZOOM);
    state.canvasZoom = scale;
    const transform = 'translate(' + Number(state.canvasPanX || 0) + 'px, ' + Number(state.canvasPanY || 0) + 'px) scale(' + scale.toFixed(3) + ')';
    const board = root.querySelector('[data-object-canvas-graph-board]');
    const edges = root.querySelector('[data-object-canvas-graph-edges]');
    const label = root.querySelector('[data-object-canvas-zoom-label]');
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
      apply(root, state);
      return;
    }
    const previous = clamp(Number(state.canvasZoom || 1), MIN_ZOOM, MAX_ZOOM);
    const next = action === 'in'
      ? Math.min(MAX_ZOOM, previous + 0.1)
      : action === 'out'
        ? Math.max(MIN_ZOOM, previous - 0.1)
        : previous;
    if (Math.abs(previous - next) < 0.001) {
      return;
    }
    if (event && zoomAroundPointer(root, state, previous, next, event)) {
      apply(root, state);
      return;
    }
    state.canvasZoom = next;
    apply(root, state);
  }

  function zoomAroundPointer(root, state, previous, next, event) {
    const canvas = root && root.querySelector('[data-content-storyboard-canvas]');
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

  const api = {apply, zoom, fitContentStoryboard, clamp};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectCanvasViewport = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
