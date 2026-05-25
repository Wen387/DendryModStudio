// @ts-check
/**
 * spatial_canvas_model.js — Model builder for the Spatial Canvas surface.
 *
 * Consumes ProjectIndex data and the layout engine to produce a model
 * suitable for spatial_canvas_surface.js (Phase 1+) and the contract
 * check.  This module mirrors the role that content_storyboard_model.js
 * plays for the Content Storyboard surface.
 */
(function initProjectMapSpatialCanvasModel(global) {
  'use strict';

  // ── public entry ───────────────────────────────────────────────────────

  /**
   * Build the spatial canvas model for the current project.
   *
   * @param {object} projectIndex — indexed project data
   * @param {object=} objectModel — current object canvas model (for current selection)
   * @param {object=} options
   * @returns {object} spatial canvas model
   */
  function buildSpatialCanvas(projectIndex, objectModel, options) {
    var opts = isObject(options) ? options : {};
    var model = isObject(objectModel) ? objectModel : {};
    var index = isObject(projectIndex) ? projectIndex : {};

    // Collect cards from project index (same logic as storyboard).
    var allCards = collectProjectCards(index);
    var current = currentCard(model);
    if (current && current.key && !allCards.some(function (c) { return c.key === current.key; })) {
      allCards.push(current);
    }

    // Compute layout.
    var layoutApi = layoutEngineApi();
    var overrides = isObject(opts.overrides) ? opts.overrides : {};
    var layout = layoutApi
      ? layoutApi.computeLayout(allCards, index, {overrides: overrides})
      : {cards: [], baseplates: [], stacks: [], metrics: {cardCount: 0, baseplateCount: 0, stackCount: 0}};

    // Build card position lookup for quick access.
    var posMap = new Map();
    ensureArray(layout.cards).forEach(function (pos) { posMap.set(pos.key, pos); });

    // Enrich cards with position data.
    var positionedCards = allCards.map(function (card) {
      var pos = posMap.get(card.key) || {x: 0, y: 0, width: 300, height: 120, baseplateId: ''};
      return {
        key: card.key,
        id: card.id,
        kind: card.kind,
        title: card.title,
        body: card.body,
        schedule: card.schedule,
        source: card.source,
        routeTargets: card.routeTargets,
        storyText: card.storyText,
        stateTags: card.stateTags,
        editable: card.editable,
        current: card.current,
        viewIf: card.viewIf,
        raw: card.raw,
        position: pos
      };
    });

    var selectedKey = opts.selected && posMap.has(String(opts.selected))
      ? String(opts.selected)
      : (current && current.key || '');

    return {
      schemaVersion: '0.1',
      kind: 'spatial_canvas_model',
      selectedKey: selectedKey,
      currentKey: current && current.key || '',
      cards: positionedCards,
      layout: layout,
      baseplates: layout.baseplates,
      stacks: layout.stacks,
      stateContext: opts.stateContext || null,
      metrics: {
        cardCount: positionedCards.length,
        baseplateCount: layout.baseplates.length,
        stackCount: layout.stacks.length,
        edgeCount: ensureArray(index.edges).length
      }
    };
  }

  // ── card collection ────────────────────────────────────────────────────

  /**
   * Collect all project cards from the index.  Mirrors the logic in
   * content_storyboard_model.collectProjectCards but kept local to avoid
   * coupling to the storyboard module's internals.
   */
  function collectProjectCards(index) {
    var textByScene = textCorpusByScene(index);
    var cards = [];

    ensureArray(index.scenes).forEach(function (scene) {
      if (!scene || !scene.id) { return; }
      var kind = sceneKind(scene);
      if (kind !== 'event' && kind !== 'card' && kind !== 'advisor') { return; }
      var sceneText = textByScene.get(String(scene.id)) || {};
      var title = firstNonEmpty(sceneText.title, scene.title, scene.id);
      var body = firstNonEmpty(sceneText.body, scene.summary, scene.description, scene.subtitle, scene.path);
      cards.push({
        key: kind + ':' + scene.id,
        id: String(scene.id),
        kind: kind,
        title: title,
        body: body,
        schedule: scheduleForScene(scene),
        source: sourceRef(scene.sourceSpan || scene.source || {path: scene.path}),
        routeTargets: routeTargets(scene, sceneText),
        storyText: {title: title, body: body, options: ensureArray(sceneText.optionLabels)},
        viewIf: String(scene.viewIf || scene.chooseIf || ''),
        stateTags: ['source'],
        editable: false,
        current: false,
        raw: scene
      });
    });

    ensureArray(index.semantic && index.semantic.news && index.semantic.news.items).forEach(function (item, idx) {
      if (!item) { return; }
      var id = item.id || item.headline || 'news_' + (idx + 1);
      cards.push({
        key: 'news:' + safeId(id),
        id: safeId(id),
        kind: 'news',
        title: item.headline || 'News',
        body: item.description || '',
        schedule: scheduleForNews(item),
        source: sourceRef(item.source),
        routeTargets: [],
        storyText: {title: item.headline || 'News', body: item.description || '', options: []},
        viewIf: '',
        stateTags: ['source'],
        editable: false,
        current: false,
        raw: item
      });
    });

    return cards;
  }

  // ── current card from object model ─────────────────────────────────────

  function currentCard(model) {
    var value = isObject(model) ? model : {};
    var id = String(value.objectId || value.sceneId || value.id || '');
    if (!id) { return null; }
    var kind = String(value.objectKind || value.sceneKind || 'event');
    return {
      key: kind + ':' + id,
      id: id,
      kind: kind,
      title: String(value.title || value.objectTitle || id),
      body: '',
      schedule: {},
      source: {},
      routeTargets: [],
      storyText: {title: '', body: '', options: []},
      viewIf: '',
      stateTags: ['current'],
      editable: true,
      current: true,
      raw: value
    };
  }

  // ── schedule helpers (mirroring storyboard model) ──────────────────────

  function scheduleForScene(scene) {
    var value = isObject(scene) ? scene : {};
    var explicit = scheduleFromObject(value);
    if (explicit.year) { return explicit; }
    return scheduleFromCondition(value.viewIf || value.chooseIf || value.requires || value.condition || '');
  }

  function scheduleForNews(item) {
    var value = isObject(item) ? item : {};
    var when = isObject(value.when) ? value.when : value;
    var year = numberOr(value.year || when.year, 0);
    var month = numberOr(value.month || when.month, 0);
    return year ? {year: year, monthStart: month || 1, monthEnd: month || 1} : {};
  }

  function scheduleFromObject(value) {
    var raw = isObject(value) ? value : {};
    var when = isObject(raw.when) ? raw.when : {};
    var year = numberOr(raw.year || when.year || raw.startYear || raw.yearStart, 0);
    if (!year) { return {}; }
    var monthStart = numberOr(raw.monthStart || raw.startMonth || raw.month || when.monthStart || when.startMonth || when.month, 1);
    var monthEnd = numberOr(raw.monthEnd || raw.endMonth || raw.month || when.monthEnd || when.endMonth || when.month, monthStart);
    return {year: year, monthStart: monthStart, monthEnd: monthEnd};
  }

  function scheduleFromCondition(condition) {
    var text = String(condition || '');
    var yearMatch = text.match(/\byear\s*(?:={1,3})\s*(\d{4})/);
    var monthEq = text.match(/\bmonth\s*(?:={1,3})\s*(\d{1,2})/);
    var monthStart = text.match(/\bmonth\s*>=\s*(\d{1,2})/);
    var monthEnd = text.match(/\bmonth\s*<=\s*(\d{1,2})/);
    var out = {};
    if (yearMatch) { out.year = Number(yearMatch[1]); }
    if (monthEq) {
      out.monthStart = Number(monthEq[1]);
      out.monthEnd = Number(monthEq[1]);
    } else {
      if (monthStart) { out.monthStart = Number(monthStart[1]); }
      if (monthEnd) { out.monthEnd = Number(monthEnd[1]); }
    }
    return out;
  }

  // ── route targets ──────────────────────────────────────────────────────

  function routeTargets(scene, sceneText) {
    var out = [];
    var optionLabels = ensureArray(sceneText && sceneText.optionLabels);
    ensureArray(scene && scene.options).forEach(function (option) {
      if (!option) { return; }
      var label = optionLabelFor(option, optionLabels);
      out.push({id: String(option.id || option.target || ''), label: label});
    });
    return out.slice(0, 8);
  }

  function optionLabelFor(option, optionLabels) {
    var id = String(option.id || '');
    var match = optionLabels.find(function (ol) { return ol && (ol.itemId === id || ol.id === id); });
    if (match && match.text) { return String(match.text); }
    return String(option.label || option.title || option.id || '');
  }

  // ── text corpus ────────────────────────────────────────────────────────

  function textCorpusByScene(projectIndex) {
    var out = new Map();
    ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic.textCorpus && projectIndex.semantic.textCorpus.items).forEach(function (item) {
      var owner = item && item.owner || {};
      var sceneId = String(owner.sceneId || item && item.sceneId || '');
      if (!sceneId) { return; }
      if (!out.has(sceneId)) { out.set(sceneId, {title: '', body: '', optionLabels: []}); }
      var bucket = out.get(sceneId);
      var role = String(item.role || item.kind || '').toLowerCase();
      var text = String(item.text || item.value || '').trim();
      if (!text) { return; }
      if (!bucket.title && (role === 'title' || role === 'heading' || role.indexOf('title') >= 0)) {
        bucket.title = text;
        return;
      }
      if (role.indexOf('option') >= 0) {
        bucket.optionLabels.push({id: item.id || '', text: text, itemId: owner.itemId || item.optionId || ''});
        return;
      }
      if (!bucket.body && (role === 'body' || role === 'page' || role === 'section' || role === 'description' || role.indexOf('body') >= 0)) {
        bucket.body = text;
      }
    });
    return out;
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  function sceneKind(scene) {
    var value = isObject(scene) ? scene : {};
    if (value.flags && value.flags.isPinnedCard || value.type === 'pinned_card' || value.type === 'advisor') {
      return 'advisor';
    }
    if (value.flags && value.flags.isCard || value.type === 'card') {
      return 'card';
    }
    return 'event';
  }

  function sourceRef(source) {
    var value = isObject(source) ? source : {};
    return {path: String(value.path || ''), line: value.line || value.startLine || '', endLine: value.endLine || ''};
  }

  function firstNonEmpty() {
    for (var i = 0; i < arguments.length; i++) {
      var value = arguments[i];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value);
      }
    }
    return '';
  }

  function numberOr(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function safeId(value) {
    return String(value || 'item').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
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
      try { return require('./spatial_canvas_layout.js'); } catch (_err) { return null; }
    }
    return null;
  }

  // ── export ──────────────────────────────────────────────────────────────

  var api = {
    buildSpatialCanvas: buildSpatialCanvas,
    collectProjectCards: collectProjectCards
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSpatialCanvasModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
