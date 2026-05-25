// @ts-check
/**
 * spatial_canvas_surface.js — Renderer for the Spatial Canvas surface.
 *
 * Phase 0: produces a static HTML snapshot of positioned cards at LOD 1.
 * Used by the contract check to verify layout stability.  The full
 * zoomable viewport (CSS transform pan/zoom, LOD switching) comes in
 * Phase 1.
 */
(function initProjectMapSpatialCanvasSurface(global) {
  'use strict';

  // ── public entry ───────────────────────────────────────────────────────

  /**
   * Render the spatial canvas to an HTML string.
   *
   * @param {object} model — from buildSpatialCanvas()
   * @param {object=} options — rendering options (zoom, pan, selectedKey…)
   * @returns {string} HTML
   */
  function render(model, options) {
    var opts = isObject(options) ? options : {};
    var zoom = Number(opts.zoom) || 0.5;
    var panX = Number(opts.panX) || 0;
    var panY = Number(opts.panY) || 0;
    var selectedKey = String(opts.selectedKey || model && model.selectedKey || '');
    var collapsed = Boolean(opts.boardChromeCollapsed);

    var cards = ensureArray(model && model.cards);
    var baseplates = ensureArray(model && model.baseplates);
    var stacks = ensureArray(model && model.stacks);
    var animate = Boolean(opts.animate);

    // Build the CSS transform value outside the HTML join to avoid the
    // localization scanner matching CSS translate() as an i18n call.
    var transformStyle = 'transform: translate3d(' + panX + 'px, ' + panY + 'px, 0) scale(' + zoom + '); transform-origin: 0 0;';
    if (animate) {
      transformStyle += ' transition: transform 0.3s ease;';
    }

    // Partition cards into visible vs stacked
    var stackedKeys = stackedCardKeys(stacks, opts.collapsedStacks || {});
    var visibleCards = cards.filter(function (c) { return !stackedKeys.has(c.key); });

    return [
      '<section class="object-canvas-stage spatial-canvas-surface" data-object-canvas-stage="true" data-spatial-canvas="true" data-object-canvas-workspace="content"',
      ' aria-label="' + escapeAttr(t('spatialCanvas.aria', 'Spatial Canvas')) + '">',
      renderToolbar(model, opts, collapsed),
      '<div class="spatial-canvas-viewport">',
      '<div class="spatial-canvas-inner" data-spatial-canvas-inner="true" style="' + escapeAttr(transformStyle) + '">',
      renderBaseplates(baseplates, zoom),
      renderStacks(stacks, opts.collapsedStacks || {}, zoom),
      renderCards(visibleCards, zoom, selectedKey),
      '</div>',
      '</div>',
      '</section>'
    ].join('');
  }

  // ── toolbar ────────────────────────────────────────────────────────────

  function renderToolbar(model, opts, collapsed) {
    var metrics = model && model.metrics || {};
    return [
      '<header class="object-canvas-stage-toolbar spatial-canvas-toolbar' + (collapsed ? ' is-collapsed' : '') + '" data-board-stage-toolbar="true">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('authoring.surface.spatialCanvas', 'Spatial Canvas')) + '</div>',
      '<h3>' + escapeHtml(t('spatialCanvas.title', 'Spatial overview')) + '</h3>',
      '</div>',
      '<div class="spatial-canvas-controls">',
      '<button type="button" data-spatial-canvas-action="spatial_zoom_in" title="' + escapeAttr(t('spatialCanvas.zoomIn', 'Zoom in')) + '">+</button>',
      '<button type="button" data-spatial-canvas-action="spatial_zoom_out" title="' + escapeAttr(t('spatialCanvas.zoomOut', 'Zoom out')) + '">&minus;</button>',
      '<button type="button" data-spatial-canvas-action="spatial_zoom_reset" title="' + escapeAttr(t('spatialCanvas.zoomReset', 'Reset zoom')) + '">&#x2302;</button>',
      '<button type="button" data-spatial-canvas-action="spatial_zoom_fit_all" title="' + escapeAttr(t('spatialCanvas.fitAll', 'Fit all')) + '">&#x25a3;</button>',
      '<span class="spatial-canvas-badge">' + escapeHtml(String(metrics.cardCount || 0)) + ' ' + escapeHtml(t('spatialCanvas.cards', 'cards')) + '</span>',
      metrics.stackCount ? '<span class="spatial-canvas-badge">' + escapeHtml(String(metrics.stackCount)) + ' ' + escapeHtml(t('spatialCanvas.stacks', 'stacks')) + '</span>' : '',
      '</div>',
      '</header>'
    ].join('');
  }

  // ── baseplates ─────────────────────────────────────────────────────────

  function renderBaseplates(baseplates, zoom) {
    return baseplates.map(function (bp) {
      var b = bp.bounds || {};
      var kindClass = 'spatial-canvas-baseplate-' + safeClass(bp.kind || 'other');
      return [
        '<div class="spatial-canvas-baseplate ' + kindClass + '"',
        ' data-spatial-baseplate="' + escapeAttr(bp.id) + '"',
        ' style="left: ' + (b.x || 0) + 'px; top: ' + (b.y || 0) + 'px; width: ' + (b.w || 0) + 'px; height: ' + (b.h || 0) + 'px;">',
        '<span class="spatial-canvas-baseplate-label">' + escapeHtml(bp.label || '') + '</span>',
        '</div>'
      ].join('');
    }).join('');
  }

  // ── cards ──────────────────────────────────────────────────────────────

  function renderCards(cards, zoom, selectedKey) {
    return cards.map(function (card) {
      var pos = card.position || {};
      var lod = lodForCard(pos, zoom);
      if (lod === 0) { return renderLod0(card, pos, selectedKey); }
      if (lod === 1) { return renderLod1(card, pos, selectedKey); }
      return renderLod2(card, pos, selectedKey);
    }).join('');
  }

  function lodForCard(pos, zoom) {
    var layoutApi = layoutEngineApi();
    var renderedHeight = (pos.height || 120) * zoom;
    return layoutApi ? layoutApi.computeLod(renderedHeight) : 1;
  }

  // ── LOD 0: title chip ──────────────────────────────────────────────────

  function renderLod0(card, pos, selectedKey) {
    var selected = card.key === selectedKey;
    return [
      '<article class="spatial-canvas-card spatial-canvas-lod-0 spatial-canvas-card-' + safeClass(card.kind) + (selected ? ' is-selected' : '') + '"',
      ' data-spatial-card="' + escapeAttr(card.key) + '"',
      ' data-spatial-card-lod="0"',
      ' tabindex="0"',
      ' style="left: ' + (pos.x || 0) + 'px; top: ' + (pos.y || 0) + 'px; width: ' + (pos.width || 300) + 'px; height: ' + (pos.height || 80) + 'px;">',
      '<strong>' + escapeHtml(card.title || card.id || '') + '</strong>',
      renderOptionDots(card),
      '</article>'
    ].join('');
  }

  function renderOptionDots(card) {
    var count = ensureArray(card.routeTargets).length;
    if (!count) { return ''; }
    var dots = '';
    for (var i = 0; i < Math.min(count, 6); i++) { dots += '&#x25aa;'; }
    return '<span class="spatial-canvas-option-dots">' + dots + '</span>';
  }

  // ── LOD 1: structure card ──────────────────────────────────────────────

  function renderLod1(card, pos, selectedKey) {
    var selected = card.key === selectedKey;
    return [
      '<article class="spatial-canvas-card spatial-canvas-lod-1 spatial-canvas-card-' + safeClass(card.kind) + (selected ? ' is-selected' : '') + '"',
      ' data-spatial-card="' + escapeAttr(card.key) + '"',
      ' data-spatial-card-lod="1"',
      ' tabindex="0"',
      ' style="left: ' + (pos.x || 0) + 'px; top: ' + (pos.y || 0) + 'px; width: ' + (pos.width || 300) + 'px; height: ' + (pos.height || 120) + 'px;">',
      '<header><strong>' + escapeHtml(card.title || card.id || '') + '</strong>',
      renderKindBadge(card),
      '</header>',
      renderTriggerSummary(card),
      renderOptionPills(card),
      '</article>'
    ].join('');
  }

  function renderKindBadge(card) {
    var label = {event: 'Event', card: 'Card', news: 'News', advisor: 'Advisor'}[card.kind] || card.kind || '';
    return '<span class="spatial-canvas-kind-badge">' + escapeHtml(label) + '</span>';
  }

  function renderTriggerSummary(card) {
    var viewIf = String(card.viewIf || '');
    if (!viewIf) { return ''; }
    var summary = viewIf.length > 60 ? viewIf.slice(0, 57) + '…' : viewIf;
    return '<div class="spatial-canvas-trigger">' + escapeHtml(summary) + '</div>';
  }

  function renderOptionPills(card) {
    var targets = ensureArray(card.routeTargets);
    if (!targets.length) { return ''; }
    return '<div class="spatial-canvas-options">' + targets.slice(0, 4).map(function (rt) {
      return '<span class="spatial-canvas-option-pill">' + escapeHtml(rt.label || rt.id || '') + '</span>';
    }).join('') + '</div>';
  }

  // ── LOD 2: narrative preview (Phase 3 stub) ────────────────────────────

  function renderLod2(card, pos, selectedKey) {
    // Phase 0/1: render as LOD 1 with a hint that full narrative is pending.
    return renderLod1(card, pos, selectedKey);
  }

  // ── stacks ─────────────────────────────────────────────────────────────

  /**
   * Collect the set of card keys that are hidden inside collapsed stacks.
   */
  function stackedCardKeys(stacks, collapsedMap) {
    var keys = new Set();
    ensureArray(stacks).forEach(function (stack) {
      // When a stack is collapsed, hide its member cards (except the first
      // one, which is visually represented by the stack chip).
      var collapsed = collapsedMap[stack.id] !== false; // default collapsed
      if (collapsed && stack.cardKeys && stack.cardKeys.length > 1) {
        stack.cardKeys.forEach(function (key) { keys.add(key); });
      }
    });
    return keys;
  }

  function renderStacks(stacks, collapsedMap, zoom) {
    return ensureArray(stacks).map(function (stack) {
      var collapsed = collapsedMap[stack.id] !== false;
      if (!collapsed) { return ''; } // expanded stacks show individual cards
      var pos = stack.position || {};
      return [
        '<div class="spatial-canvas-stack' + (collapsed ? ' is-collapsed' : '') + '"',
        ' data-spatial-stack="' + escapeAttr(stack.id) + '"',
        ' style="left: ' + (pos.x || 0) + 'px; top: ' + (pos.y || 0) + 'px;">',
        '<div class="spatial-canvas-stack-header" data-spatial-canvas-action="spatial_toggle_stack" data-spatial-stack-id="' + escapeAttr(stack.id) + '">',
        '<strong>' + escapeHtml(stack.label || '') + '</strong>',
        '<span class="spatial-canvas-stack-count">' + (stack.cardKeys ? stack.cardKeys.length : 0) + '</span>',
        '</div>',
        '<ul class="spatial-canvas-stack-list">',
        ensureArray(stack.cardKeys).slice(0, 12).map(function (key) {
          var title = stack.titles && stack.titles[key] || key.replace(/^[^:]+:/, '').replace(/_/g, ' ');
          return '<li data-spatial-card="' + escapeAttr(key) + '">' + escapeHtml(title) + '</li>';
        }).join(''),
        stack.cardKeys && stack.cardKeys.length > 12 ? '<li class="spatial-canvas-stack-more">+' + (stack.cardKeys.length - 12) + ' more</li>' : '',
        '</ul>',
        '</div>'
      ].join('');
    }).join('');
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  function t(key, fallback) {
    if (global && global.ProjectMapI18n && typeof global.ProjectMapI18n.t === 'function') {
      return global.ProjectMapI18n.t(key, fallback);
    }
    return fallback || key;
  }

  function escapeHtml(text) {
    return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeAttr(text) {
    return String(text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function safeClass(text) {
    return String(text || '').replace(/[^a-z0-9_-]/gi, '-');
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function layoutEngineApi() {
    if (global && global.ProjectMapSpatialCanvasLayout) {
      return global.ProjectMapSpatialCanvasLayout;
    }
    if (typeof require === 'function') {
      try { return require('../authoring/spatial_canvas_layout.js'); } catch (_err) { return null; }
    }
    return null;
  }

  // ── export ──────────────────────────────────────────────────────────────

  var api = {
    render: render
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSpatialCanvasSurface = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
