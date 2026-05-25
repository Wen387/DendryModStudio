(function initProjectMapContentStoryboardInteractions(global) {
  'use strict';

  var SNAP_THRESHOLD = 60; // board-coordinate px

  function bind(root, callbacks) {
    const canvas = root && root.querySelector('[data-content-storyboard-canvas]');
    if (!canvas || canvas.dataset.contentStoryboardInteractions === 'bound') {
      return;
    }
    canvas.dataset.contentStoryboardInteractions = 'bound';
    const options = callbacks && typeof callbacks === 'object' ? callbacks : {};
    let drag = null;
    let pointerSelectedKey = '';
    let suppressClickSelect = false;
    let windowPointerListeners = false;

    function addWindowPointerListeners() {
      if (windowPointerListeners || !global || typeof global.addEventListener !== 'function') {
        return;
      }
      windowPointerListeners = true;
      global.addEventListener('pointerup', finishPointerDrag, true);
      global.addEventListener('pointercancel', cancelPointerDrag, true);
    }

    function removeWindowPointerListeners() {
      if (!windowPointerListeners || !global || typeof global.removeEventListener !== 'function') {
        return;
      }
      windowPointerListeners = false;
      global.removeEventListener('pointerup', finishPointerDrag, true);
      global.removeEventListener('pointercancel', cancelPointerDrag, true);
    }

    function clearSnapIndicator() {
      if (!drag || !drag.snapTargetEl) { return; }
      drag.snapTargetEl.classList.remove('is-snap-target');
      drag.snapTargetEl = null;
      drag.snapTarget = null;
    }

    function cancelPointerDrag() {
      // Reset DOM positions so cards don't hang at the last pointermove
      // location when pointer capture is lost mid-drag.
      if (drag && drag.type === 'card' && drag.moved) {
        drag.card.style.left = drag.nodeX + 'px';
        drag.card.style.top = drag.nodeY + 'px';
        if (drag.isGroupDrag) {
          for (var ri = 0; ri < drag.memberEls.length; ri++) {
            drag.memberEls[ri].style.left = (drag.nodeX + drag.memberOffsets[ri].dx) + 'px';
            drag.memberEls[ri].style.top = (drag.nodeY + drag.memberOffsets[ri].dy) + 'px';
          }
        }
      }
      clearSnapIndicator();
      drag = null;
      removeWindowPointerListeners();
    }

    function finishPointerDrag(event) {
      if (!drag) {
        return;
      }
      const current = drag;
      drag = null;
      removeWindowPointerListeners();
      // Clean up snap indicator
      if (current.snapTargetEl) {
        current.snapTargetEl.classList.remove('is-snap-target');
      }
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
        if (!current.moved) {
          if (options.onSelect) {
            pointerSelectedKey = current.key;
            suppressClickSelect = true;
            options.onSelect(current.key);
          }
          return;
        }
        // Group drag: move anchor + all members as a unit (no snap).
        // Pass explicit member positions so the state layer doesn't need
        // to compute a delta (which is fragile when preview updated state).
        if (current.isGroupDrag && options.onGroupMove) {
          var gZoom = current.zoom || 1;
          var gx = Math.round(current.nodeX + dx / gZoom);
          var gy = Math.round(current.nodeY + dy / gZoom);
          var memberPos = [];
          for (var gmi = 0; gmi < current.memberKeys.length; gmi++) {
            memberPos.push({
              key: current.memberKeys[gmi],
              x: gx + current.memberOffsets[gmi].dx,
              y: gy + current.memberOffsets[gmi].dy
            });
          }
          options.onGroupMove(current.key, gx, gy, memberPos);
          return;
        }
        // If snapped to another card, stack instead of move.
        // Pass the anchor's actual DOM position so stackCards doesn't
        // need to guess — the anchor may not be in state.nodePositions
        // if it was auto-positioned by the layout algorithm.
        if (current.snapTarget && options.onCardStack) {
          var anchorPos = null;
          if (current.snapTargetEl) {
            anchorPos = {
              x: Number(current.snapTargetEl.dataset.canvasX || 0),
              y: Number(current.snapTargetEl.dataset.canvasY || 0)
            };
          }
          options.onCardStack(current.key, current.snapTarget, anchorPos);
          return;
        }
        const zoom = current.zoom || 1;
        const x = Math.round(current.nodeX + dx / zoom);
        const y = Math.round(current.nodeY + dy / zoom);
        if (options.onCardMove) {
          options.onCardMove(current.key, x, y, {preview: false});
        }
      } else if (current.moved && options.onViewport) {
        options.onViewport(Math.round(current.panX + dx), Math.round(current.panY + dy), {preview: false});
      }
    }

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
        var cardKey = card.dataset.contentStoryboardCard || card.dataset.objectCanvasGraphNode || '';
        var cardNodeX = Number(card.dataset.canvasX || card.offsetLeft || 0);
        var cardNodeY = Number(card.dataset.canvasY || card.offsetTop || 0);
        drag = {
          type: 'card',
          card,
          key: cardKey,
          startX: event.clientX,
          startY: event.clientY,
          nodeX: cardNodeX,
          nodeY: cardNodeY,
          zoom: Number(viewport.zoom || 1),
          moved: false,
          snapTarget: null,
          snapTargetEl: null,
          isGroupDrag: false,
          memberKeys: [],
          memberEls: [],
          memberOffsets: [],
          // Scope snap detection to the same lane/level container.
          // data-canvas-x/y are lane-local coordinates, so cards in
          // different lanes share the same coordinate space and would
          // snap to each other if searched globally.
          laneEl: card.closest ? (card.closest('[data-content-storyboard-lane]') || card.closest('[data-content-storyboard-chain-level]')) : null
        };
        // Detect group drag: if this card is a stack anchor with members,
        // collect member DOM elements and their offsets from the anchor.
        if (options.getStackMembers) {
          var members = options.getStackMembers(cardKey);
          if (Array.isArray(members) && members.length) {
            for (var mi = 0; mi < members.length; mi++) {
              var mel = canvas.querySelector('[data-content-storyboard-card="' + members[mi] + '"]');
              if (mel) {
                drag.memberKeys.push(members[mi]);
                drag.memberEls.push(mel);
                drag.memberOffsets.push({
                  dx: Number(mel.dataset.canvasX || 0) - cardNodeX,
                  dy: Number(mel.dataset.canvasY || 0) - cardNodeY
                });
              }
            }
            drag.isGroupDrag = drag.memberEls.length > 0;
          }
        }
        // For individual (non-group) drags, collect same-stack peers so
        // snap detection can exclude them.  Without this, a member card
        // at low zoom can't escape its own stack because the zoom-scaled
        // snap threshold is wider than the stack peek offset.
        drag.snapExcludeKeys = [];
        if (!drag.isGroupDrag && options.getStackPeers) {
          drag.snapExcludeKeys = options.getStackPeers(cardKey);
        }
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
      addWindowPointerListeners();
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
        if (drag.isGroupDrag) {
          // Group drag: move all member DOMs with the anchor (DOM-only,
          // do NOT update state.nodePositions — moveGroup sets them
          // atomically on pointerup so delta calculation stays correct).
          for (var gi = 0; gi < drag.memberEls.length; gi++) {
            drag.memberEls[gi].style.left = (x + drag.memberOffsets[gi].dx) + 'px';
            drag.memberEls[gi].style.top = (y + drag.memberOffsets[gi].dy) + 'px';
          }
        } else {
          // Single card drag: update preview state + snap detection
          if (options.onCardMove) {
            options.onCardMove(drag.key, x, y, {preview: true});
          }
          var snap = findSnapTarget(drag.laneEl || canvas, drag.key, x, y, SNAP_THRESHOLD, zoom, drag.snapExcludeKeys);
          var prevKey = drag.snapTarget;
          var nextKey = snap ? snap.key : null;
          if (prevKey !== nextKey) {
            if (drag.snapTargetEl) { drag.snapTargetEl.classList.remove('is-snap-target'); }
            if (snap) { snap.card.classList.add('is-snap-target'); }
            drag.snapTarget = nextKey;
            drag.snapTargetEl = snap ? snap.card : null;
          }
        }
      } else if (options.onViewport) {
        options.onViewport(Math.round(drag.panX + dx), Math.round(drag.panY + dy), {preview: true});
      }
    });

    canvas.addEventListener('pointerup', finishPointerDrag);

    canvas.addEventListener('pointercancel', cancelPointerDrag);

    canvas.addEventListener('click', (event) => {
      // Stack badge toggle
      var badge = event.target.closest && event.target.closest('[data-storyboard-stack-badge]');
      if (badge) {
        event.stopPropagation();
        if (options.onStackToggle) {
          options.onStackToggle(badge.dataset.storyboardStackBadge || '');
        }
        return;
      }
      const card = event.target.closest && event.target.closest('[data-content-storyboard-card]');
      if (!card || event.target.closest && event.target.closest('input, textarea, button, select, a, [data-content-storyboard-floating-controls], [data-storyboard-palette]')) {
        return;
      }
      const key = card.dataset.contentStoryboardCard || card.dataset.objectCanvasGraphNode || '';
      if (!key || !options.onSelect) {
        return;
      }
      if (suppressClickSelect && key === pointerSelectedKey) {
        suppressClickSelect = false;
        pointerSelectedKey = '';
        return;
      }
      suppressClickSelect = false;
      pointerSelectedKey = '';
      options.onSelect(key);
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

  /**
   * Find the nearest card to (boardX, boardY) within threshold,
   * excluding the dragged card itself.  Uses Manhattan distance.
   *
   * The threshold is in screen-space pixels (SNAP_THRESHOLD).  At low zoom
   * the same screen distance covers more board-space, so we divide by zoom
   * to keep snap feel consistent across LOD levels.  Clamped to avoid a
   * huge radius at bird's-eye zoom.
   */
  function findSnapTarget(canvas, dragKey, boardX, boardY, threshold, zoom, excludeKeys) {
    if (!canvas || typeof canvas.querySelectorAll !== 'function') { return null; }
    var z = Math.max(Number(zoom) || 1, 0.15);
    var effectiveThreshold = Math.min(threshold / z, threshold * 3);
    var exclude = Array.isArray(excludeKeys) ? excludeKeys : [];
    var cards = canvas.querySelectorAll('[data-content-storyboard-card]');
    var closest = null;
    var closestDist = effectiveThreshold;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var key = card.dataset.contentStoryboardCard || '';
      if (!key || key === dragKey || exclude.indexOf(key) >= 0) { continue; }
      var cx = Number(card.dataset.canvasX || 0);
      var cy = Number(card.dataset.canvasY || 0);
      var dist = Math.abs(boardX - cx) + Math.abs(boardY - cy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = {key: key, card: card};
      }
    }
    return closest;
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
