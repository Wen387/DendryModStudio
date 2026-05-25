// @ts-check
/**
 * spatial_canvas_interactions.js — Pointer-event bindings for the Spatial
 * Canvas: pan (drag empty space), zoom (wheel/pinch), card click/select,
 * and card drag.
 */
(function initProjectMapSpatialCanvasInteractions(global) {
  'use strict';

  var MIN_DRAG_PX = 4;

  /**
   * Bind interaction handlers to the spatial canvas viewport.
   *
   * @param {HTMLElement} root — host element containing the spatial canvas
   * @param {object} callbacks
   *   - getViewport() → {x, y, zoom}
   *   - onSelect(key)
   *   - onViewport(x, y, opts)
   *   - onZoom(action, event)
   *   - onCardMove(key, x, y, opts)
   */
  function bind(root, callbacks) {
    var canvas = root && root.querySelector('[data-spatial-canvas]');
    if (!canvas || canvas.dataset.spatialCanvasInteractions === 'bound') {
      return;
    }
    canvas.dataset.spatialCanvasInteractions = 'bound';
    var options = callbacks && typeof callbacks === 'object' ? callbacks : {};
    var drag = null;
    var windowListeners = false;

    function addWindowListeners() {
      if (windowListeners || !global) { return; }
      windowListeners = true;
      global.addEventListener('pointerup', finishDrag, true);
      global.addEventListener('pointercancel', cancelDrag, true);
    }

    function removeWindowListeners() {
      if (!windowListeners || !global) { return; }
      windowListeners = false;
      global.removeEventListener('pointerup', finishDrag, true);
      global.removeEventListener('pointercancel', cancelDrag, true);
    }

    function cancelDrag() {
      drag = null;
      removeWindowListeners();
    }

    function finishDrag(event) {
      if (!drag) { return; }
      var current = drag;
      drag = null;
      removeWindowListeners();
      try {
        if (typeof canvas.releasePointerCapture === 'function') {
          canvas.releasePointerCapture(event.pointerId);
        }
      } catch (_err) { /* ignore */ }

      var dx = event.clientX - current.startX;
      var dy = event.clientY - current.startY;

      if (current.type === 'card') {
        if (!current.moved) {
          // Click without drag → select card
          if (options.onSelect) {
            options.onSelect(current.key);
          }
          return;
        }
        // Drag card → move it
        if (options.onCardMove) {
          var vp = typeof options.getViewport === 'function' ? options.getViewport() : {zoom: 1};
          var zoom = vp.zoom || 1;
          options.onCardMove(current.key, Math.round(current.nodeX + dx / zoom), Math.round(current.nodeY + dy / zoom), {preview: false});
        }
      } else {
        // Viewport pan
        if (current.moved && options.onViewport) {
          options.onViewport(Math.round(current.panX + dx), Math.round(current.panY + dy), {preview: false});
        }
      }
    }

    // ── pointerdown: start drag ──────────────────────────────────────────

    canvas.addEventListener('pointerdown', function (event) {
      if (event.button !== undefined && event.button !== 0) { return; }
      // Don't capture if clicking inside interactive elements
      if (event.target.closest && event.target.closest('input, textarea, button, select, a')) { return; }

      var card = event.target.closest && event.target.closest('[data-spatial-card]');
      var vp = typeof options.getViewport === 'function' ? options.getViewport() : {x: 0, y: 0, zoom: 1};

      if (card) {
        var cardKey = card.dataset.spatialCard || '';
        drag = {
          type: 'card',
          key: cardKey,
          startX: event.clientX,
          startY: event.clientY,
          nodeX: Number(card.dataset.canvasX || card.style.left && parseInt(card.style.left, 10) || 0),
          nodeY: Number(card.dataset.canvasY || card.style.top && parseInt(card.style.top, 10) || 0),
          moved: false,
          zoom: vp.zoom || 1
        };
      } else {
        drag = {
          type: 'viewport',
          startX: event.clientX,
          startY: event.clientY,
          panX: vp.x || 0,
          panY: vp.y || 0,
          moved: false
        };
      }

      addWindowListeners();
      try {
        if (typeof canvas.setPointerCapture === 'function') {
          canvas.setPointerCapture(event.pointerId);
        }
      } catch (_err) { /* ignore */ }
    });

    // ── pointermove: live drag preview ───────────────────────────────────

    canvas.addEventListener('pointermove', function (event) {
      if (!drag) { return; }
      var dx = event.clientX - drag.startX;
      var dy = event.clientY - drag.startY;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < MIN_DRAG_PX) { return; }
      drag.moved = true;

      if (drag.type === 'viewport' && options.onViewport) {
        options.onViewport(Math.round(drag.panX + dx), Math.round(drag.panY + dy), {preview: true});
      } else if (drag.type === 'card' && options.onCardMove) {
        var zoom = drag.zoom || 1;
        options.onCardMove(drag.key, Math.round(drag.nodeX + dx / zoom), Math.round(drag.nodeY + dy / zoom), {preview: true});
      }
    });

    // ── wheel: zoom ──────────────────────────────────────────────────────

    canvas.addEventListener('wheel', function (event) {
      event.preventDefault();
      if (options.onZoom) {
        options.onZoom(event.deltaY < 0 ? 'in' : 'out', event);
      }
    }, {passive: false});

    // ── double-click card: zoom-to-fit ───────────────────────────────────

    canvas.addEventListener('dblclick', function (event) {
      var card = event.target.closest && event.target.closest('[data-spatial-card]');
      if (card && options.onSelect) {
        options.onSelect(card.dataset.spatialCard || '', {zoomToFit: true});
      }
    });

    // ── toolbar action buttons ───────────────────────────────────────────

    canvas.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('[data-spatial-canvas-action]');
      if (!button) { return; }
      var action = button.dataset.spatialCanvasAction || '';
      if (action && options.onAction) {
        options.onAction(action, button);
      }
    });
  }

  // ── export ──────────────────────────────────────────────────────────────

  var api = {
    bind: bind
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSpatialCanvasInteractions = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
