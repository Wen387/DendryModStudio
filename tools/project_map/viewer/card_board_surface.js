(function initProjectMapCardBoardSurface(global) {
  'use strict';

  function render(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const board = buildBoard(model, opts);
    return [
      '<section class="object-canvas-stage card-board-surface" data-object-canvas-stage="true" data-card-board-surface="true" data-object-canvas-workspace="content" aria-label="' + escapeAttr(t('cardBoard.aria', 'Card Board Workspace')) + '">',
      renderToolbar(board, opts),
      '<div class="card-board-workspace">',
      renderBoard(board),
      renderEditor(model, board),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderToolbar(board, options) {
    return [
      '<header class="object-canvas-stage-toolbar card-board-toolbar">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('authoring.surface.cardBoard', 'Card Board')) + '</div>',
      '<h3>' + escapeHtml(t('cardBoard.title', 'Card Board Workspace')) + '</h3>',
      '<p>' + escapeHtml(t('cardBoard.intent', 'Arrange card objects around hand, deck, and advisor lanes, then edit the selected card face.')) + '</p>',
      renderMetrics(board),
      '</div>',
      '<div class="card-board-toolbar-actions">',
      '<button type="button" data-object-canvas-action="toggle_overlay">' + escapeHtml(options && options.editorOverlay ? t('objectCanvas.editorDock', 'Dock') : t('objectCanvas.editorOverlay', 'Expand editor')) + '</button>',
      '</div>',
      '</header>'
    ].join('');
  }

  function renderMetrics(board) {
    const metrics = board.metrics || {};
    return [
      '<div class="card-board-metrics" data-card-board-metrics="true">',
      '<span>' + escapeHtml(String(metrics.cardCount || 0)) + ' ' + escapeHtml(t('cardBoard.metric.cards', 'cards')) + '</span>',
      '<span>' + escapeHtml(String(metrics.advisorCount || 0)) + ' ' + escapeHtml(board.labels && board.labels.plural || t('cardBoard.metric.advisors', 'advisors')) + '</span>',
      '<span>' + escapeHtml(String(metrics.unwiredCount || 0)) + ' ' + escapeHtml(t('cardBoard.metric.unwired', 'unwired')) + '</span>',
      '</div>'
    ].join('');
  }

  function renderBoard(board) {
    const lanes = laneMap(board.lanes);
    return [
      '<section class="card-board-canvas" data-card-board-canvas="true">',
      renderFilters(board),
      '<div class="card-board-lane-grid">',
      renderLane(lanes.hand, {compact: true, hand: true}),
      renderLane(lanes.deck, {primary: true}),
      renderLane(lanes.advisor, {primary: true}),
      '</div>',
      '<div class="card-board-pool-grid">',
      renderLane(lanes.pool, {pool: true}),
      renderLane(lanes.unwired, {compact: true}),
      renderLane(lanes.drafts, {compact: true}),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderFilters(board) {
    return [
      '<div class="card-board-filters" data-card-board-filters="true">',
      '<label><span>' + escapeHtml(t('cardBoard.search', 'Search cards')) + '</span><input type="search" data-card-board-query="true" value="' + escapeAttr(board.query || '') + '" placeholder="' + escapeAttr(t('cardBoard.searchPlaceholder', 'Find card, tag, choice...')) + '"></label>',
      '<div class="card-board-type-filters">',
      ['all', 'card', 'advisor', 'deck', 'draft', 'unwired'].map((type) => '<button type="button" class="' + (board.type === type ? 'is-active' : '') + '" data-card-board-type="' + escapeAttr(type) + '" aria-pressed="' + (board.type === type ? 'true' : 'false') + '">' + escapeHtml(typeLabel(type, board)) + '</button>').join(''),
      '</div>',
      '</div>'
    ].join('');
  }

  function renderLane(lane, options) {
    const value = lane || {key: 'empty', cards: []};
    const cards = ensureArray(value.cards);
    const laneLabel = t(value.labelKey, value.fallback || value.key || '');
    const classes = [
      'card-board-lane',
      'card-board-lane-' + safeClass(value.key),
      options && options.primary ? 'is-primary' : '',
      options && options.pool ? 'is-pool' : '',
      options && options.compact ? 'is-compact' : ''
    ].filter(Boolean).join(' ');
    return [
      '<section class="' + classes + '" data-card-board-lane="' + escapeAttr(value.key) + '" data-card-board-drop-target="' + escapeAttr(value.key) + '" data-card-board-lane-label="' + escapeAttr(laneLabel) + '" data-card-board-lane-tag="' + escapeAttr(value.tag || '') + '">',
      '<header>',
      '<span>' + escapeHtml(laneLabel) + '</span>',
      '<strong>' + escapeHtml(String(value.totalCount || cards.length || 0)) + '</strong>',
      '</header>',
      options && options.hand ? renderHandEntries(cards) : renderCardList(cards, options || {}),
      value.key === 'deck' || value.key === 'advisor' ? renderCreateButton(value, laneLabel) : '',
      '</section>'
    ].join('');
  }

  function renderHandEntries(entries) {
    if (!entries.length) {
      return '<p class="card-board-empty">' + escapeHtml(t('cardBoard.empty.hand', 'No hand routes detected yet.')) + '</p>';
    }
    return [
      '<div class="card-board-hand-routes">',
      entries.map((entry) => [
        '<article class="card-board-hand-route" data-card-board-hand-route="' + escapeAttr(entry.key || '') + '">',
        '<span>' + escapeHtml(typeLabel(entry.kind)) + '</span>',
        '<strong>' + escapeHtml(entry.title || '') + '</strong>',
        '<small>' + escapeHtml(entry.detail || '') + '</small>',
        '</article>'
      ].join('')).join(''),
      '</div>'
    ].join('');
  }

  function renderCardList(cards, options) {
    const items = ensureArray(cards);
    if (!items.length) {
      return '<p class="card-board-empty">' + escapeHtml(t('cardBoard.empty.lane', 'No cards in this lane.')) + '</p>';
    }
    const limit = options && options.pool ? 48 : options && options.compact ? 8 : 16;
    return [
      '<div class="card-board-card-list' + (options && options.pool ? ' is-pool' : '') + '" data-card-board-card-list="true">',
      items.slice(0, limit).map(renderCard).join(''),
      items.length > limit ? '<p class="card-board-more">' + escapeHtml(t('cardBoard.moreCards', 'More cards hidden by this view.')) + '</p>' : '',
      '</div>'
    ].join('');
  }

  function renderCard(card) {
    return [
      '<article class="card-board-card card-board-card-' + safeClass(card.kind) + (card.selected ? ' is-selected' : '') + '" tabindex="0" draggable="true" role="button" data-card-board-card="' + escapeAttr(card.key || '') + '" data-card-board-card-kind="' + escapeAttr(card.kind || '') + '" data-card-board-card-title="' + escapeAttr(card.title || '') + '">',
      '<div class="card-board-card-kicker"><span>' + escapeHtml(typeLabel(card.kind)) + '</span><em>' + escapeHtml(ensureArray(card.tags).slice(0, 2).map((tag) => '#' + tag).join(' ')) + '</em></div>',
      '<strong>' + escapeHtml(card.heading || card.title || '') + '</strong>',
      card.subtitle ? '<small>' + escapeHtml(card.subtitle) + '</small>' : '',
      card.body ? '<p>' + escapeHtml(card.body) + '</p>' : '',
      '<div class="card-board-card-options">',
      ensureArray(card.options).slice(0, 3).map((option) => '<span>' + escapeHtml(option.label || option.id || '') + '</span>').join(''),
      '</div>',
      '<div class="card-board-card-tags">',
      ensureArray(card.stateTags).slice(0, 3).map((tag) => '<b>' + escapeHtml(stateLabel(tag)) + '</b>').join(''),
      '</div>',
      '</article>'
    ].join('');
  }

  function renderCreateButton(lane, label) {
    return '<button type="button" class="card-board-create-in-lane" data-card-board-create-lane="' + escapeAttr(lane.key || '') + '" data-card-board-lane-tag="' + escapeAttr(lane.tag || '') + '">' + escapeHtml(t('cardBoard.createHere', 'New card here')) + '</button>';
  }

  function renderEditor(model, board) {
    const editor = editorApi();
    return editor && typeof editor.render === 'function' ? editor.render(model, board) : '';
  }

  function buildBoard(model, options) {
    const api = boardModelApi();
    return api && typeof api.buildBoard === 'function'
      ? api.buildBoard(options.projectIndex, model, options || {})
      : {lanes: [], metrics: {}, labels: {}, selected: null};
  }

  function laneMap(lanes) {
    const out = {};
    ensureArray(lanes).forEach((lane) => {
      out[lane.key] = lane;
    });
    return out;
  }

  function typeLabel(type, board) {
    const labels = board && board.labels || {};
    return {
      all: t('storyboard.palette.type.all', 'All'),
      card: t('create.card', 'Card'),
      advisor: labels.singular || t('cardBoard.type.advisor', 'Advisor'),
      deck: t('cardBoard.type.deck', 'Deck'),
      draft: t('storyboard.state.draft', 'Draft'),
      unwired: t('cardBoard.type.unwired', 'Unwired')
    }[type] || type || '';
  }

  function stateLabel(tag) {
    return {
      source: t('storyboard.state.source', 'Source-backed'),
      draft: t('storyboard.state.draft', 'Draft'),
      changed: t('storyboard.state.changed', 'Changed'),
      unwired: t('cardBoard.type.unwired', 'Unwired')
    }[tag] || tag;
  }

  function boardModelApi() {
    if (global && global.ProjectMapCardBoardModel) {
      return global.ProjectMapCardBoardModel;
    }
    if (typeof require === 'function') {
      try {
        return require('../authoring/card_board_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function editorApi() {
    return global.ProjectMapCardFaceEditor || null;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeClass(value) {
    return String(value || 'item').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  const api = {render};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapCardBoardSurface = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
