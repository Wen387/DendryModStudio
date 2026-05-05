(function initProjectMapContentGraphInteractions(global) {
  'use strict';

  function bind(root, callbacks) {
    const canvas = root && root.querySelector('[data-object-canvas-graph-canvas]');
    if (!canvas || canvas.dataset.contentGraphInteractions === 'bound') {
      return;
    }
    canvas.dataset.contentGraphInteractions = 'bound';
    const options = callbacks && typeof callbacks === 'object' ? callbacks : {};
    let drag = null;

    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      const node = event.target.closest && event.target.closest('[data-object-canvas-graph-node]');
      const viewport = options.getViewport ? options.getViewport() : {x: 0, y: 0, zoom: 1};
      if (node) {
        const rect = node.getBoundingClientRect();
        drag = {
          type: 'node',
          node,
          key: node.dataset.objectCanvasGraphNode || 'object',
          startX: event.clientX,
          startY: event.clientY,
          nodeX: Number(node.dataset.canvasX || node.offsetLeft || 0),
          nodeY: Number(node.dataset.canvasY || node.offsetTop || 0),
          zoom: Number(viewport.zoom || 1),
          moved: false
        };
      } else {
        drag = {
          type: 'pan',
          startX: event.clientX,
          startY: event.clientY,
          panX: Number(viewport.x || 0),
          panY: Number(viewport.y || 0),
          moved: false
        };
      }
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!drag) {
        return;
      }
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      drag.moved = drag.moved || Math.abs(dx) + Math.abs(dy) > 3;
      if (drag.type === 'node') {
        const zoom = drag.zoom || 1;
        const x = Math.round(drag.nodeX + dx / zoom);
        const y = Math.round(drag.nodeY + dy / zoom);
        drag.node.style.left = x + 'px';
        drag.node.style.top = y + 'px';
        if (options.onNodeMove) {
          options.onNodeMove(drag.key, x, y, {preview: true});
        }
      } else if (options.onViewport) {
        options.onViewport(Math.round(drag.panX + dx), Math.round(drag.panY + dy), {preview: true});
      }
    });

    canvas.addEventListener('pointerup', (event) => {
      if (!drag) {
        return;
      }
      const current = drag;
      drag = null;
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch (_err) {
        // Ignore pointer capture release failures in older embedded Chromium.
      }
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      if (current.type === 'node') {
        const zoom = current.zoom || 1;
        const x = Math.round(current.nodeX + dx / zoom);
        const y = Math.round(current.nodeY + dy / zoom);
        if (options.onNodeMove) {
          options.onNodeMove(current.key, x, y, {preview: false});
        }
        if (!current.moved && options.onSelect) {
          options.onSelect(current.key);
        }
      } else if (options.onViewport) {
        options.onViewport(Math.round(current.panX + dx), Math.round(current.panY + dy), {preview: false});
      }
    });

    canvas.addEventListener('pointercancel', () => {
      drag = null;
    });

    canvas.addEventListener('wheel', (event) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      if (options.onZoom) {
        options.onZoom(event.deltaY < 0 ? 'in' : 'out');
      }
    }, {passive: false});
  }

  const api = {bind};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapContentGraphInteractions = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
