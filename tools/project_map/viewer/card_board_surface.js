(function initProjectMapCardBoardSurface(global) {
  'use strict';

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const ensureArray = domTextUtils.ensureArray;
  const escapeHtml = domTextUtils.escapeHtml;
  const escapeAttr = domTextUtils.escapeAttr;

  function render(model, options) {
    return perfMeasure('surface.render', () => {
      const opts = options && typeof options === 'object' ? options : {};
      const board = perfMeasure('buildBoard', () => buildBoard(model, opts), {source: 'surface.render'});
      return [
        '<section class="object-canvas-stage card-board-surface" data-object-canvas-stage="true" data-card-board-surface="true" data-object-canvas-workspace="content" aria-label="' + escapeAttr(t('cardBoard.aria', 'Card Board Workspace')) + '">',
        renderToolbar(board, opts),
        '<div class="card-board-workspace">',
        renderBoard(board),
        renderSidebarResizer(),
        renderEditor(model, board, opts),
        '</div>',
        '</section>'
      ].join('');
    }, {template: model && model.template || '', mode: model && model.mode || ''});
  }

  function renderToolbar(board, options) {
    const collapsed = Boolean(options && options.boardChromeCollapsed);
    return [
      '<header class="object-canvas-stage-toolbar card-board-toolbar' + (collapsed ? ' is-collapsed' : '') + '" data-board-stage-toolbar="true" data-board-toolbar-collapsed="' + (collapsed ? 'true' : 'false') + '">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('authoring.surface.cardBoard', 'Card Board')) + '</div>',
      '<h3>' + escapeHtml(t('cardBoard.title', 'Card Board Workspace')) + '</h3>',
      '<p>' + escapeHtml(t('cardBoard.intent', 'Arrange card objects around hand, deck, and advisor lanes, then edit the selected card face.')) + '</p>',
      renderMetrics(board),
      '</div>',
      '<div class="card-board-toolbar-actions">',
      renderToolbarEditorButton(board, options),
      '</div>',
      '</header>'
    ].join('');
  }

  function renderToolbarEditorButton(board, options) {
    if (options && options.editorOverlay) {
      return '<button type="button" data-object-canvas-action="toggle_overlay" data-visible-edit-affordance="card-board">' + escapeHtml(t('objectCanvas.editorDock', 'Close editor')) + '</button>';
    }
    const selectedObject = board && board.selectedObject || {};
    const deckPool = selectedObject.deckPool || null;
    if (deckPool && deckPool.id) {
      return '<button type="button" data-card-board-action="open_deck_pool_editor" data-card-board-deck-pool="' + escapeAttr(deckPool.id || '') + '" data-visible-edit-affordance="card-board">' + escapeHtml(t('cardBoard.action.openDeckPoolEditor', 'Open deck pool editor')) + '</button>';
    }
    const advisorController = selectedObject.advisorController || null;
    if (advisorController && advisorController.id) {
      return '<button type="button" data-card-board-action="open_advisor_controller_editor" data-card-board-advisor-controller="' + escapeAttr(advisorController.id || '') + '" data-visible-edit-affordance="card-board">' + escapeHtml(t('cardBoard.action.openAdvisorControllerEditor', 'Open advisor controller editor')) + '</button>';
    }
    const card = selectedObject.card || board && board.selected || null;
    return '<button type="button" data-card-board-action="open_card_editor" data-card-board-action-card="' + escapeAttr(card && card.key || '') + '" data-visible-edit-affordance="card-board">' + escapeHtml(t('objectCanvas.editorOverlay', 'Open object editor')) + '</button>';
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

  function renderSidebarResizer() {
    return '<div class="object-canvas-sidebar-resizer card-board-sidebar-resizer" data-object-canvas-resizer="sidebar" role="separator" aria-orientation="vertical" aria-label="' + escapeAttr(t('objectCanvas.resizeSidebar', 'Resize side panel')) + '" title="' + escapeAttr(t('objectCanvas.resizeSidebar', 'Resize side panel')) + '"></div>';
  }

  function renderBoard(board) {
    const lanes = laneMap(board.lanes);
    const deckPools = laneGroup(board.lanes, 'deck_pool');
    const advisorControllers = laneGroup(board.lanes, 'advisor_controller');
    return [
      '<section class="card-board-canvas" data-card-board-canvas="true">',
      renderFilters(board),
      '<div class="card-board-lane-grid">',
      renderLane(lanes.hand, {compact: true, hand: true}),
      renderLane(lanes.deck, {primary: true}),
      renderLane(lanes.advisor, {primary: true}),
      '</div>',
      deckPools.length ? '<div class="card-board-lane-grid is-deck-pools" data-card-board-deck-pools="true">' + deckPools.map((lane) => renderLane(lane, {primary: true, deckPool: true})).join('') + '</div>' : '',
      advisorControllers.length ? '<div class="card-board-lane-grid is-advisor-controllers" data-card-board-advisor-controllers="true">' + advisorControllers.map((lane) => renderLane(lane, {primary: true, advisorController: true})).join('') + '</div>' : '',
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
      options && options.compact ? 'is-compact' : '',
      value.selected ? 'is-selected' : ''
    ].filter(Boolean).join(' ');
    return [
      '<section class="' + classes + '" data-card-board-lane="' + escapeAttr(value.key) + '" data-card-board-drop-target="' + escapeAttr(value.key) + '" data-card-board-lane-label="' + escapeAttr(laneLabel) + '" data-card-board-lane-group="' + escapeAttr(value.group || '') + '" data-card-board-deck-pool="' + escapeAttr(value.deckPool && value.deckPool.id || '') + '" data-card-board-advisor-controller="' + escapeAttr(value.advisorController && value.advisorController.id || '') + '" data-card-board-lane-tag="' + escapeAttr(value.tag || '') + '"' + renderLaneAnchorAttrs(value.sourceAnchor) + '>',
      '<header tabindex="0" role="button" data-card-board-lane-select="' + escapeAttr(value.key) + '" aria-pressed="' + (value.selected ? 'true' : 'false') + '">',
      '<span>' + escapeHtml(laneLabel) + '</span>',
      '<strong>' + escapeHtml(String(value.totalCount || cards.length || 0)) + '</strong>',
      '</header>',
      options && options.hand ? renderHandEntries(cards) : renderCardList(cards, options || {}),
      renderLaneObjectButton(value),
      canCreateInLane(value) ? renderCreateButton(value, laneLabel) : '',
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
        '<article class="card-board-hand-route' + (entry.selected ? ' is-selected' : '') + '" tabindex="0" role="button" data-card-board-hand-route="' + escapeAttr(entry.key || '') + '" data-card-board-hand-target-kind="' + escapeAttr(entry.targetKind || '') + '" data-card-board-hand-target-id="' + escapeAttr(entry.targetId || '') + '" data-card-board-deck-pool="' + escapeAttr(entry.deckPoolId || '') + '"' + (entry.deckPoolId ? ' data-card-board-open-lane-object="deck_pool"' : '') + '>',
        '<span>' + escapeHtml(typeLabel(entry.kind)) + '</span>',
        '<strong>' + renderTextInline(entry.title || '') + '</strong>',
        '<small>' + renderTextInline(entry.detail || '') + '</small>',
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
      '<div class="card-board-card-kicker"><span>' + escapeHtml(typeLabel(card.kind)) + '</span><em>' + escapeHtml(ensureArray(card.tags).slice(0, 2).map((tag) => '#' + tag).join(' ')) + '</em><button type="button" class="visible-edit-affordance card-board-card-edit" data-card-board-action="open_card_editor" data-card-board-action-card="' + escapeAttr(card.key || '') + '" data-visible-edit-affordance="card-board-card">' + escapeHtml(t('visibleEdit.action', 'Edit')) + '</button></div>',
      '<strong>' + renderTextInline(card.heading || card.title || '') + '</strong>',
      card.subtitle ? '<small>' + renderTextInline(card.subtitle) + '</small>' : '',
      card.body ? '<p>' + renderTextInline(card.body) + '</p>' : '',
      '<div class="card-board-card-options">',
      ensureArray(card.options).slice(0, 3).map((option, index) => [
        '<button type="button" class="' + (Number(card.selectedOptionIndex) === index ? 'is-selected' : '') + '" data-card-board-option="' + escapeAttr(card.key + ':' + index) + '" data-card-board-option-card="' + escapeAttr(card.key || '') + '" data-card-board-option-index="' + escapeAttr(String(option.index !== undefined ? option.index : index)) + '" data-card-board-option-id="' + escapeAttr(option.id || '') + '" data-card-board-option-field="' + escapeAttr(option.fieldId || '') + '" data-card-board-option-path="' + escapeAttr(option.optionPath || '') + '" data-card-board-option-section="' + escapeAttr(option.sectionId || '') + '">',
        renderTextInline(option.label || option.id || ''),
        '</button>'
      ].join('')).join(''),
      '</div>',
      '<div class="card-board-card-tags">',
      ensureArray(card.stateTags).slice(0, 3).map((tag) => '<b>' + escapeHtml(stateLabel(tag)) + '</b>').join(''),
      '</div>',
      '</article>'
    ].join('');
  }

  function renderLaneAnchorAttrs(anchor) {
    const value = anchor && typeof anchor === 'object' ? anchor : {};
    return ' data-card-board-lane-source-path="' + escapeAttr(value.path || '') + '"' +
      ' data-card-board-lane-source-line="' + escapeAttr(value.line || '') + '"' +
      ' data-card-board-lane-anchor-text="' + escapeAttr(value.anchorText || '') + '"';
  }

  function renderCreateButton(lane, label) {
    return '<button type="button" class="card-board-create-in-lane" data-card-board-create-lane="' + escapeAttr(lane.key || '') + '" data-card-board-lane-label="' + escapeAttr(label || lane.key || '') + '" data-card-board-lane-tag="' + escapeAttr(lane.tag || '') + '"' + renderLaneAnchorAttrs(lane.sourceAnchor) + '>' + escapeHtml(t('cardBoard.createHere', 'New card here')) + '</button>';
  }

  function renderLaneObjectButton(lane) {
    const value = lane || {};
    if (value.deckPool) {
      return '<button type="button" class="card-board-open-lane-object" data-card-board-action="open_deck_pool_editor" data-card-board-deck-pool="' + escapeAttr(value.deckPool.id || '') + '">' + escapeHtml(t('cardBoard.action.openDeckPoolEditor', 'Open deck pool editor')) + '</button>';
    }
    if (value.advisorController) {
      return '<button type="button" class="card-board-open-lane-object" data-card-board-action="open_advisor_controller_editor" data-card-board-advisor-controller="' + escapeAttr(value.advisorController.id || '') + '">' + escapeHtml(t('cardBoard.action.openAdvisorControllerEditor', 'Open advisor controller editor')) + '</button>';
    }
    return '';
  }

  function renderEditor(model, board, options) {
    const editor = editorApi();
    return editor && typeof editor.render === 'function' ? editor.render(model, board, options || {}) : '';
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

  function laneGroup(lanes, group) {
    return ensureArray(lanes).filter((lane) => String(lane && lane.group || '') === String(group || ''));
  }

  function canCreateInLane(lane) {
    const value = lane || {};
    return value.key === 'deck' || value.key === 'advisor' || value.group === 'deck_pool' || value.group === 'advisor_controller';
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

  function perfApi() {
    if (global && global.ProjectMapCardBoardPerf) {
      return global.ProjectMapCardBoardPerf;
    }
    if (typeof require === 'function') {
      try {
        return require('./card_board_perf.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function perfMeasure(name, fn, detail) {
    const api = perfApi();
    return api && typeof api.measure === 'function' ? api.measure(name, fn, detail || {}) : fn();
  }

  function editorApi() {
    return global.ProjectMapCardFaceEditor || null;
  }

  function renderTextInline(value) {
    const renderer = richTextApi();
    if (renderer && typeof renderer.renderInline === 'function') {
      return renderer.renderInline(value);
    }
    return escapeHtml(value);
  }

  function richTextApi() {
    if (global && global.ProjectMapVisibleTextRenderer) {
      return global.ProjectMapVisibleTextRenderer;
    }
    if (typeof require === 'function') {
      try {
        return require('./visible_text_renderer.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function safeClass(value) {
    return String(value || 'item').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  const api = {render};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapCardBoardSurface = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
