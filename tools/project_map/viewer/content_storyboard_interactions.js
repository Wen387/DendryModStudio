(function initProjectMapContentStoryboardInteractions(global) {
  'use strict';

  function bind(root, callbacks) {
    const canvas = root && root.querySelector('[data-content-storyboard-canvas]');
    if (!canvas || canvas.dataset.contentStoryboardInteractions === 'bound') {
      return;
    }
    canvas.dataset.contentStoryboardInteractions = 'bound';
    const options = callbacks && typeof callbacks === 'object' ? callbacks : {};
    let drag = null;

    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      const card = event.target.closest && event.target.closest('[data-content-storyboard-card]');
      if (event.target.closest && event.target.closest('input, textarea, button, select, a, [data-content-storyboard-floating-controls], [data-storyboard-palette]')) {
        return;
      }
      const viewport = options.getViewport ? options.getViewport() : {x: 0, y: 0, zoom: 1};
      if (card) {
        drag = {
          type: 'card',
          card,
          key: card.dataset.contentStoryboardCard || card.dataset.objectCanvasGraphNode || '',
          startX: event.clientX,
          startY: event.clientY,
          nodeX: Number(card.dataset.canvasX || card.offsetLeft || 0),
          nodeY: Number(card.dataset.canvasY || card.offsetTop || 0),
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
      try {
        if (typeof canvas.setPointerCapture === 'function') {
          canvas.setPointerCapture(event.pointerId);
        }
      } catch (_err) {
        // Synthetic QA drags and older embedded Chromium can reject capture.
      }
      event.preventDefault();
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!drag) {
        return;
      }
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      drag.moved = drag.moved || Math.abs(dx) + Math.abs(dy) > 3;
      if (drag.type === 'card') {
        const zoom = drag.zoom || 1;
        const x = Math.round(drag.nodeX + dx / zoom);
        const y = Math.round(drag.nodeY + dy / zoom);
        drag.card.style.left = x + 'px';
        drag.card.style.top = y + 'px';
        if (options.onCardMove) {
          options.onCardMove(drag.key, x, y, {preview: true});
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
        if (typeof canvas.releasePointerCapture === 'function') {
          canvas.releasePointerCapture(event.pointerId);
        }
      } catch (_err) {
        // Ignore pointer capture release failures in older embedded Chromium.
      }
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      if (current.type === 'card') {
        const zoom = current.zoom || 1;
        const x = Math.round(current.nodeX + dx / zoom);
        const y = Math.round(current.nodeY + dy / zoom);
        if (options.onCardMove) {
          options.onCardMove(current.key, x, y, {preview: false});
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

    canvas.addEventListener('dragstart', (event) => {
      const item = event.target.closest && event.target.closest('[data-storyboard-palette-item]');
      if (!item || !event.dataTransfer) {
        return;
      }
      const payload = {
        source: 'story_palette',
        key: item.dataset.storyboardPaletteKey || item.dataset.objectCanvasGraphNode || '',
        kind: item.dataset.storyboardPaletteKind || '',
        title: item.dataset.storyboardPaletteTitle || ''
      };
      event.dataTransfer.effectAllowed = 'copyMove';
      event.dataTransfer.setData('application/x-dms-story-palette', JSON.stringify(payload));
      event.dataTransfer.setData('text/plain', payload.key);
    });

    canvas.addEventListener('dragover', (event) => {
      const target = event.target.closest && event.target.closest('[data-storyboard-drop-target]');
      if (!target) {
        return;
      }
      event.preventDefault();
      target.classList.add('is-palette-drop-target');
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    });

    canvas.addEventListener('dragleave', (event) => {
      const target = event.target.closest && event.target.closest('[data-storyboard-drop-target]');
      if (target) {
        target.classList.remove('is-palette-drop-target');
      }
    });

    canvas.addEventListener('drop', (event) => {
      const target = event.target.closest && event.target.closest('[data-storyboard-drop-target]');
      if (!target) {
        return;
      }
      event.preventDefault();
      target.classList.remove('is-palette-drop-target');
      const payload = palettePayload(event);
      if (options.onPaletteDrop) {
        options.onPaletteDrop(payload || {}, target, {clientX: event.clientX, clientY: event.clientY});
      }
    });

    canvas.addEventListener('wheel', (event) => {
      if (event.target.closest && event.target.closest('input, textarea, button, select, a, [data-content-storyboard-floating-controls], [data-storyboard-palette]')) {
        return;
      }
      event.preventDefault();
      if (options.onZoom) {
        options.onZoom(event.deltaY < 0 ? 'in' : 'out', event);
      }
    }, {passive: false});
  }

  function palettePayload(event) {
    if (!event.dataTransfer) {
      return null;
    }
    const json = event.dataTransfer.getData('application/x-dms-story-palette');
    if (json) {
      try {
        return JSON.parse(json);
      } catch (_err) {
        return null;
      }
    }
    const key = event.dataTransfer.getData('text/plain');
    return key ? {source: 'story_palette', key} : null;
  }

  const api = {bind};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapContentStoryboardInteractions = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
