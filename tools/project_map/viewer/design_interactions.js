(function initProjectMapDesignInteractions(root) {
  'use strict';

  function ProjectMapDesignInteractions(ctx) {
    ctx = ctx || {};
    const global = ctx.global || root;
    const state = ctx.state;
    let elements = null;
    const {
      NODE_HALF,
      MIN_ZOOM,
      MAX_ZOOM,
      INSPECTOR_WIDTH_KEY,
      MIN_INSPECTOR_WIDTH,
      MAX_INSPECTOR_WIDTH,
      applyViewport,
      clamp,
      render
    } = ctx;

    function setElements(nextElements) {
      elements = nextElements;
    }

  function beginNodeDrag(event) {
    const node = event.target.closest && event.target.closest('.design-node');
    if (!node || state.view !== 'graph') {
      return;
    }
    event.preventDefault();
    const key = node.dataset.designKey || '';
    if (!key) {
      return;
    }
    const left = parseFloat(node.style.left || '0') || 0;
    const top = parseFloat(node.style.top || '0') || 0;
    state.dragging = {
      key,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: left + NODE_HALF,
      originY: top,
      moved: false,
      target: node
    };
    if (typeof node.setPointerCapture === 'function') {
      try {
        node.setPointerCapture(event.pointerId);
      } catch (err) {
        // Pointer capture can fail after a render; document-level handlers still keep dragging usable.
      }
    }
  }

  function moveNodeDrag(event) {
    if (!state.dragging || event.pointerId !== state.dragging.pointerId) {
      return;
    }
    event.preventDefault();
    const dx = event.clientX - state.dragging.startX;
    const dy = event.clientY - state.dragging.startY;
    if (Math.abs(dx) + Math.abs(dy) < 3) {
      return;
    }
    state.dragging.moved = true;
    state.suppressNextClick = true;
    state.nodePositions[state.dragging.key] = {
      x: Math.max(NODE_HALF + 12, state.dragging.originX + dx),
      y: Math.max(24, state.dragging.originY + dy)
    };
    scheduleDragRender();
  }

  function endNodeDrag(event) {
    if (!state.dragging || event.pointerId !== state.dragging.pointerId) {
      return;
    }
    const moved = state.dragging.moved;
    const pointerId = state.dragging.pointerId;
    const target = state.dragging.target;
    state.dragging = null;
    if (target && typeof target.releasePointerCapture === 'function') {
      try {
        target.releasePointerCapture(pointerId);
      } catch (err) {
        // Capture may already be released.
      }
    }
    if (moved) {
      state.suppressNextClick = true;
      render();
    }
  }

  function cancelNodeDrag() {
    if (!state.dragging) {
      return;
    }
    state.dragging = null;
  }

  function beginCanvasPan(event) {
    if (state.view !== 'graph' || !elements || !elements.graphCanvas) {
      return;
    }
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    if (event.target.closest && (
      event.target.closest('.design-node') ||
      event.target.closest('.design-zoom-controls') ||
      event.target.closest('[data-design-edge-id]')
    )) {
      return;
    }
    event.preventDefault();
    state.panning = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: state.viewport.x,
      originY: state.viewport.y,
      moved: false
    };
    elements.graphCanvas.classList.add('is-panning');
    if (typeof elements.graphCanvas.setPointerCapture === 'function') {
      try {
        elements.graphCanvas.setPointerCapture(event.pointerId);
      } catch (err) {
        // Document-level handlers keep panning usable if capture fails.
      }
    }
  }

  function moveCanvasPan(event) {
    if (!state.panning || event.pointerId !== state.panning.pointerId) {
      return;
    }
    event.preventDefault();
    const dx = event.clientX - state.panning.startX;
    const dy = event.clientY - state.panning.startY;
    if (Math.abs(dx) + Math.abs(dy) < 3) {
      return;
    }
    state.panning.moved = true;
    state.suppressNextClick = true;
    state.viewport.x = state.panning.originX + dx;
    state.viewport.y = state.panning.originY + dy;
    applyViewport();
  }

  function endCanvasPan(event) {
    if (!state.panning || event.pointerId !== state.panning.pointerId) {
      return;
    }
    const moved = state.panning.moved;
    const pointerId = state.panning.pointerId;
    state.panning = null;
    if (elements && elements.graphCanvas) {
      elements.graphCanvas.classList.remove('is-panning');
      if (typeof elements.graphCanvas.releasePointerCapture === 'function') {
        try {
          elements.graphCanvas.releasePointerCapture(pointerId);
        } catch (err) {
          // Capture may already be released.
        }
      }
    }
    if (moved) {
      state.suppressNextClick = true;
    }
  }

  function cancelCanvasPan() {
    if (!state.panning) {
      return;
    }
    state.panning = null;
    if (elements && elements.graphCanvas) {
      elements.graphCanvas.classList.remove('is-panning');
    }
    state.suppressNextClick = true;
  }

  function cancelDesignInteractions() {
    cancelNodeDrag();
    cancelCanvasPan();
    cancelInspectorResize();
  }

  function readStoredInspectorWidth() {
    try {
      const raw = global.localStorage && global.localStorage.getItem(INSPECTOR_WIDTH_KEY);
      const value = Number(raw || 0);
      return Number.isFinite(value) ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function storeInspectorWidth(width) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(INSPECTOR_WIDTH_KEY, String(Math.round(width)));
      }
    } catch (err) {
      // Resize state is a preference; restricted storage should not block use.
    }
  }

  function clampInspectorWidth(width) {
    const layoutWidth = elements && elements.graphLayout ? elements.graphLayout.getBoundingClientRect().width : 0;
    const maxByLayout = layoutWidth > 0 ? Math.max(MIN_INSPECTOR_WIDTH, Math.min(MAX_INSPECTOR_WIDTH, layoutWidth * 0.48)) : MAX_INSPECTOR_WIDTH;
    return Math.max(MIN_INSPECTOR_WIDTH, Math.min(maxByLayout, width));
  }

  function applyInspectorWidth(width) {
    if (!elements || !elements.pane) {
      return;
    }
    const clamped = clampInspectorWidth(width);
    elements.pane.style.setProperty('--design-inspector-width', Math.round(clamped) + 'px');
  }

  function restoreInspectorWidth() {
    const stored = readStoredInspectorWidth();
    if (stored) {
      applyInspectorWidth(stored);
    }
  }

  function currentInspectorWidth() {
    if (!elements || !elements.inspector) {
      return 360;
    }
    const rect = elements.inspector.getBoundingClientRect();
    return rect.width || readStoredInspectorWidth() || 360;
  }

  function beginInspectorResize(event) {
    if (!elements || !elements.inspectorResizer || !elements.graphLayout) {
      return;
    }
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    event.preventDefault();
    state.resizingInspector = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: currentInspectorWidth()
    };
    elements.inspectorResizer.classList.add('is-dragging');
    elements.pane.classList.add('is-resizing-inspector');
    if (typeof elements.inspectorResizer.setPointerCapture === 'function') {
      try {
        elements.inspectorResizer.setPointerCapture(event.pointerId);
      } catch (err) {
        // Document-level handlers keep resizing usable if capture fails.
      }
    }
  }

  function moveInspectorResize(event) {
    if (!state.resizingInspector || event.pointerId !== state.resizingInspector.pointerId) {
      return;
    }
    event.preventDefault();
    const nextWidth = state.resizingInspector.startWidth + (state.resizingInspector.startX - event.clientX);
    applyInspectorWidth(nextWidth);
  }

  function endInspectorResize(event) {
    if (!state.resizingInspector || event.pointerId !== state.resizingInspector.pointerId) {
      return;
    }
    const pointerId = state.resizingInspector.pointerId;
    state.resizingInspector = null;
    const width = currentInspectorWidth();
    storeInspectorWidth(width);
    if (elements && elements.inspectorResizer) {
      elements.inspectorResizer.classList.remove('is-dragging');
      if (typeof elements.inspectorResizer.releasePointerCapture === 'function') {
        try {
          elements.inspectorResizer.releasePointerCapture(pointerId);
        } catch (err) {
          // Capture may already be released.
        }
      }
    }
    if (elements && elements.pane) {
      elements.pane.classList.remove('is-resizing-inspector');
    }
  }

  function cancelInspectorResize() {
    if (!state.resizingInspector) {
      return;
    }
    state.resizingInspector = null;
    if (elements && elements.inspectorResizer) {
      elements.inspectorResizer.classList.remove('is-dragging');
    }
    if (elements && elements.pane) {
      elements.pane.classList.remove('is-resizing-inspector');
    }
  }

  function zoomCanvasWheel(event) {
    if (state.view !== 'graph') {
      return;
    }
    event.preventDefault();
    const delta = event.deltaY < 0 ? 1.08 : 1 / 1.08;
    zoomCanvas(delta, event.clientX, event.clientY);
  }

  function zoomCanvas(factor, clientX, clientY) {
    const previous = clamp(Number(state.viewport.scale) || 1, MIN_ZOOM, MAX_ZOOM);
    const next = clamp(previous * factor, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(previous - next) < 0.001) {
      return;
    }
    const rect = elements.graphCanvas ? elements.graphCanvas.getBoundingClientRect() : {left: 0, top: 0, width: 1, height: 1};
    const anchorX = clientX === undefined ? rect.left + rect.width / 2 : clientX;
    const anchorY = clientY === undefined ? rect.top + rect.height / 2 : clientY;
    const localX = anchorX - rect.left;
    const localY = anchorY - rect.top;
    const graphX = (localX - state.viewport.x) / previous;
    const graphY = (localY - state.viewport.y) / previous;
    state.viewport.scale = next;
    state.viewport.x = localX - graphX * next;
    state.viewport.y = localY - graphY * next;
    applyViewport();
  }

  function fitCanvas() {
    if (!elements || !elements.graphCanvas) {
      return;
    }
    const width = Number.parseFloat(elements.graphCanvas.style.getPropertyValue('--design-graph-width')) || 1320;
    const height = Number.parseFloat(elements.graphCanvas.style.getPropertyValue('--design-graph-height')) || 900;
    const rect = elements.graphCanvas.getBoundingClientRect();
    const scale = clamp(Math.min(rect.width / width, rect.height / height) * 0.96, MIN_ZOOM, 1);
    state.viewport.scale = scale;
    state.viewport.x = Math.max(12, (rect.width - width * scale) / 2);
    state.viewport.y = 18;
    applyViewport();
  }

  function scheduleFitCanvas() {
    if (state.view !== 'graph') {
      return;
    }
    const schedule = typeof global.requestAnimationFrame === 'function'
      ? global.requestAnimationFrame.bind(global)
      : (callback) => callback();
    schedule(() => fitCanvas());
  }

  function scheduleDragRender() {
    if (state.pendingDragRender) {
      return;
    }
    state.pendingDragRender = true;
    const schedule = typeof global.requestAnimationFrame === 'function'
      ? global.requestAnimationFrame.bind(global)
      : (callback) => callback();
    schedule(() => {
      state.pendingDragRender = false;
      if (state.dragging) {
        render();
      }
    });
  }


    return {
      setElements,
      beginNodeDrag,
      moveNodeDrag,
      endNodeDrag,
      cancelNodeDrag,
      beginCanvasPan,
      moveCanvasPan,
      endCanvasPan,
      cancelCanvasPan,
      cancelDesignInteractions,
      readStoredInspectorWidth,
      storeInspectorWidth,
      clampInspectorWidth,
      applyInspectorWidth,
      restoreInspectorWidth,
      currentInspectorWidth,
      beginInspectorResize,
      moveInspectorResize,
      endInspectorResize,
      cancelInspectorResize,
      zoomCanvasWheel,
      zoomCanvas,
      fitCanvas,
      scheduleFitCanvas,
      scheduleDragRender
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectMapDesignInteractions;
  }

  if (root) {
    root.ProjectMapDesignInteractions = ProjectMapDesignInteractions;
  }
})(typeof window !== 'undefined' ? window : globalThis);
