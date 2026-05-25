(function initProjectMapContentStoryboardSurface(global) {
  'use strict';

  function render(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    if (isTextReplacement(model)) {
      return renderTextReplacementSurface(model, opts);
    }
    const storyboard = buildStoryboard(model, options || {});
    storyboard.ui = {
      searchQuery: String(opts.storySearchQuery || storyboard.search && storyboard.search.query || ''),
      scopeCollapsed: Boolean(opts.storyScopeCollapsed),
      overviewCollapsed: Boolean(opts.storyOverviewCollapsed),
      cardColors: opts.storyCardColors && typeof opts.storyCardColors === 'object' ? opts.storyCardColors : {}
    };
    const view = storyboard.view || 'timeline';
    return [
      '<section class="object-canvas-stage content-storyboard-surface" data-object-canvas-stage="true" data-content-storyboard-surface="true" data-object-canvas-workspace="content" data-content-storyboard-view="' + escapeAttr(view) + '" aria-label="' + escapeAttr(t('storyboard.aria', 'Content Storyboard Canvas')) + '">',
      renderToolbar(storyboard, options || {}),
      '<div class="content-storyboard-layout">',
      view === 'chain' ? renderChain(storyboard, options || {}) : renderTimeline(storyboard, options || {}),
      renderSidebarResizer(),
      renderEditor(model, storyboard, options || {}),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderPaletteOnly(model, options) {
    const storyboard = buildStoryboard(model, options || {});
    return renderPalette(storyboard);
  }

  function renderTextReplacementSurface(model, options) {
    const storyboard = {
      view: 'text',
      selectedKey: 'object',
      cards: [],
      editor: {
        identity: [
          {label: t('existingScene.kind', 'Kind'), value: t('objectPreview.textPatch', 'Text Patch')},
          {label: t('existingScene.source', 'Source'), value: sourceLabel(model)}
        ],
        context: {},
        storyContext: {}
      },
      palette: {}
    };
    return [
      '<section class="object-canvas-stage content-storyboard-surface content-storyboard-text-surface" data-object-canvas-stage="true" data-content-storyboard-surface="true" data-preview-text-replacement-surface="true" data-object-canvas-workspace="content" aria-label="' + escapeAttr(t('previewObjectEditor.textWorkspace', 'Text Replacement Workspace')) + '">',
      '<header class="object-canvas-stage-toolbar content-storyboard-toolbar">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('objectPreview.textPatch', 'Text Patch')) + '</div>',
      '<h3>' + escapeHtml(t('previewObjectEditor.textWorkspace', 'Text Replacement Workspace')) + '</h3>',
      '<p>' + escapeHtml(t('previewObjectEditor.intent.text', 'Edit replacement text with before, after, and source context.')) + '</p>',
      '</div>',
      '<div class="content-storyboard-controls">',
      '<button type="button" data-object-canvas-action="toggle_overlay">' + escapeHtml(options && options.editorOverlay ? t('objectCanvas.editorDock', 'Close editor') : t('objectCanvas.editorOverlay', 'Open object editor')) + '</button>',
      '</div>',
      '</header>',
      '<div class="content-storyboard-layout content-storyboard-text-layout">',
      renderTextReplacementContext(model),
      renderSidebarResizer(),
      renderEditor(model, storyboard, options || {}),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderToolbar(storyboard, options) {
    const collapsed = Boolean(options && options.boardChromeCollapsed);
    return [
      '<header class="object-canvas-stage-toolbar content-storyboard-toolbar' + (collapsed ? ' is-collapsed' : '') + '" data-board-stage-toolbar="true" data-board-toolbar-collapsed="' + (collapsed ? 'true' : 'false') + '">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('authoring.surface.contentStoryboard', 'Content Storyboard')) + '</div>',
      '<h3>' + escapeHtml(storyboard.view === 'chain' ? t('storyboard.chain.title', 'Story chain') : t('storyboard.timeline.title', 'Timeline storyboard')) + '</h3>',
      '</div>',
      '<div class="content-storyboard-controls">',
      renderProfileBadge(storyboard.timeline && storyboard.timeline.profile),
      renderSearch(storyboard),
      renderCategoryFilters(storyboard),
      renderPanelButton('toggle_story_scope_panel', !(storyboard.ui && storyboard.ui.scopeCollapsed), t('storyboard.scopeShort', 'Scope')),
      renderPanelButton('toggle_story_overview_panel', !(storyboard.ui && storyboard.ui.overviewCollapsed), t('storyboard.years', 'Years')),
      renderViewButton('timeline', storyboard.view === 'timeline', t('storyboard.timeline', 'Timeline')),
      renderViewButton('chain', storyboard.view === 'chain', t('storyboard.chain', 'Chain')),
      '<button type="button" data-object-canvas-action="toggle_overlay">' + escapeHtml(options && options.editorOverlay ? t('objectCanvas.editorDock', 'Close editor') : t('objectCanvas.editorOverlay', 'Open object editor')) + '</button>',
      '</div>',
      '</header>'
    ].join('');
  }

  function renderProfileBadge(profile) {
    if (!profile) {
      return '';
    }
    const label = profile.inferred
      ? t('storyboard.profileInferred', 'Inferred')
      : t('storyboard.profileProject', 'Profile');
    return '<span class="content-storyboard-profile" data-content-storyboard-profile="' + escapeAttr(profile.mode || '') + '">' + escapeHtml(label + ': ' + (profile.unitLabel || profile.mode || 'Timeline')) + '</span>';
  }

  function renderCategoryFilters(storyboard) {
    const category = storyboard && storyboard.canvasCategory || {};
    const active = normalizeCanvasCategory(category.key);
    const cardCount = Number(category.cardObjectCount || 0);
    return [
      '<div class="content-storyboard-category-filter" data-content-storyboard-category-filter="true" aria-label="' + escapeAttr(t('storyboard.category.aria', 'Storyboard category')) + '">',
      renderCategoryButton('story', active, t('storyboard.category.story', 'Story'), 0),
      renderCategoryButton('cards', active, t('storyboard.category.cards', 'Cards'), cardCount),
      renderCategoryButton('all', active, t('storyboard.category.all', 'All'), 0),
      '</div>'
    ].join('');
  }

  function renderSearch(storyboard) {
    const search = storyboard && storyboard.search || {};
    const query = storyboard && storyboard.ui ? storyboard.ui.searchQuery : search.query || '';
    const count = search.active ? search.matchCount : '';
    return [
      '<label class="content-storyboard-search" data-content-storyboard-search-box="true">',
      '<span>' + escapeHtml(t('storyboard.search', 'Search')) + '</span>',
      '<input type="search" value="' + escapeAttr(query) + '" placeholder="' + escapeAttr(t('storyboard.searchPlaceholder', 'Find title, id, source...')) + '" data-content-storyboard-search="true">',
      search.active ? '<small>' + escapeHtml(String(count) + ' ' + t('storyboard.matches', 'matches')) + '</small>' : '',
      '</label>'
    ].join('');
  }

  function renderCategoryButton(category, active, label, count) {
    const selected = active === category;
    return [
      '<button type="button" class="' + (selected ? 'is-active' : '') + '" data-object-canvas-action="set_story_canvas_category" data-storyboard-canvas-category="' + escapeAttr(category) + '" aria-pressed="' + (selected ? 'true' : 'false') + '">',
      '<span>' + escapeHtml(label) + '</span>',
      count ? '<small>' + escapeHtml(String(count)) + '</small>' : '',
      '</button>'
    ].join('');
  }

  function renderViewButton(view, active, label) {
    return '<button type="button" class="' + (active ? 'is-active' : '') + '" data-content-storyboard-view="' + escapeAttr(view) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' + escapeHtml(label) + '</button>';
  }

  function renderPanelButton(action, expanded, label) {
    return '<button type="button" class="' + (expanded ? 'is-active' : '') + '" data-object-canvas-action="' + escapeAttr(action) + '" aria-pressed="' + (expanded ? 'true' : 'false') + '">' + escapeHtml(label) + '</button>';
  }

  function renderSidebarResizer() {
    return '<div class="object-canvas-sidebar-resizer" data-object-canvas-resizer="sidebar" role="separator" aria-orientation="vertical" aria-label="' + escapeAttr(t('objectCanvas.resizeSidebar', 'Resize side panel')) + '" title="' + escapeAttr(t('objectCanvas.resizeSidebar', 'Resize side panel')) + '"></div>';
  }

  function renderTimeline(storyboard, options) {
    const positions = options.nodePositions || {};
    const laneWidth = 1060;
    const laneGap = 38;
    const laneColumns = 3;
    const lanes = storyboard.timeline && storyboard.timeline.lanes || [];
    const width = Math.max(1180, lanes.length * (laneWidth + laneGap) + 96);
    const maxCards = lanes.reduce((count, lane) => Math.max(count, lane.cards.length), 1);
    const maxRows = Math.max(1, Math.ceil(maxCards / laneColumns));
    const height = Math.max(720, maxRows * 326 + 330);
    return [
      '<section class="content-storyboard-canvas" data-content-storyboard-canvas="true" data-storyboard-kind="timeline" data-storyboard-drop-target="canvas" style="--content-storyboard-width: ' + width + 'px; --content-storyboard-height: ' + height + 'px;">',
      renderCanvasControls(),
      renderPalette(storyboard),
      renderGlobalContext(storyboard),
      renderTimelineScope(storyboard),
      renderTimelineOverview(storyboard),
      '<div class="content-storyboard-board" data-content-storyboard-board="true" data-object-canvas-graph-board="true">',
      lanes.map((lane, laneIndex) => renderTimelineLane(lane, laneIndex, laneWidth, laneGap, positions, storyboard)).join(''),
      renderUndatedLane(storyboard.timeline && storyboard.timeline.undated || [], lanes.length, laneWidth, laneGap, positions, storyboard),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderTimelineLane(lane, laneIndex, laneWidth, laneGap, positions, storyboard) {
    const left = 36 + laneIndex * (laneWidth + laneGap);
    const cards = orderCardsForLane(lane.cards || [], storyboard);
    const laneKey = lane.key || lane.year || laneIndex;
    const insertKey = lane.insertionKey || 'time:' + laneKey;
    const laneLabel = lane.unitLabel || t('storyboard.lane', 'Lane');
    const title = lane.label || lane.year || laneKey;
    return [
      '<section class="content-storyboard-lane" data-content-storyboard-lane="' + escapeAttr(laneKey) + '" data-storyboard-drop-target="timeline_lane" data-content-storyboard-insert="' + escapeAttr(insertKey) + '" style="left: ' + left + 'px; top: 178px; width: ' + laneWidth + 'px;">',
      '<header><span>' + escapeHtml(laneLabel) + '</span><strong>' + escapeHtml(String(title)) + '</strong><em>' + cards.length + ' ' + escapeHtml(t('storyboard.beats', 'beats')) + '</em></header>',
      renderLaneCreateMenu(insertKey),
      cards.map((card, cardIndex) => renderCard(card, timelineCardPosition(cardIndex, positions[card.key]), storyboard)).join(''),
      '</section>'
    ].join('');
  }

  function renderUndatedLane(cards, laneIndex, laneWidth, laneGap, positions, storyboard) {
    const orderedCards = orderCardsForLane(cards || [], storyboard);
    if (!orderedCards.length) {
      return '';
    }
    const left = 36 + laneIndex * (laneWidth + laneGap);
    return [
      '<section class="content-storyboard-lane content-storyboard-lane-undated" data-content-storyboard-lane="undated" data-storyboard-drop-target="undated" data-content-storyboard-insert="undated" style="left: ' + left + 'px; top: 178px; width: ' + laneWidth + 'px;">',
      '<header><span>' + escapeHtml(t('storyboard.undated', 'Undated')) + '</span><strong>' + escapeHtml(t('storyboard.needsSchedule', 'Needs schedule')) + '</strong><em>' + orderedCards.length + ' ' + escapeHtml(t('storyboard.beats', 'beats')) + '</em></header>',
      renderLaneCreateMenu('undated'),
      orderedCards.slice(0, 8).map((card, cardIndex) => renderCard(card, timelineCardPosition(cardIndex, positions[card.key]), storyboard)).join(''),
      '</section>'
    ].join('');
  }

  function renderLaneCreateMenu(insertKey) {
    const key = escapeAttr(insertKey || '');
    return [
      '<div class="content-storyboard-create-menu" data-content-storyboard-create-menu="true">',
      '<button type="button" class="content-storyboard-insert" data-object-canvas-action="create_event" data-content-storyboard-insert="' + key + '" data-storyboard-drop-target="timeline_insert">' + escapeHtml(t('storyboard.addEventHere', 'Event here')) + '</button>',
      '<button type="button" class="content-storyboard-insert" data-object-canvas-action="create_card" data-content-storyboard-insert="' + key + '" data-storyboard-drop-target="timeline_insert">' + escapeHtml(t('storyboard.addCardHere', 'Card')) + '</button>',
      '<button type="button" class="content-storyboard-insert" data-object-canvas-action="create_news" data-content-storyboard-insert="' + key + '" data-storyboard-drop-target="timeline_insert">' + escapeHtml(t('storyboard.addNewsHere', 'News')) + '</button>',
      '</div>'
    ].join('');
  }

  function renderChain(storyboard, options) {
    const positions = options.nodePositions || {};
    const levels = storyboard.chain && storyboard.chain.levels || [];
    const columnWidth = 360;
    const cardStep = 250;
    const width = Math.max(1220, levels.length * columnWidth + 72);
    const maxCards = levels.reduce((count, level) => Math.max(count, level.cards.length), 1);
    const height = Math.max(720, maxCards * cardStep + 300);
    return [
      '<section class="content-storyboard-canvas" data-content-storyboard-canvas="true" data-storyboard-kind="chain" data-storyboard-drop-target="canvas" style="--content-storyboard-width: ' + width + 'px; --content-storyboard-height: ' + height + 'px;">',
      renderCanvasControls(),
      renderPalette(storyboard),
      renderGlobalContext(storyboard),
      renderChainDepthControls(storyboard),
      '<svg class="content-storyboard-chain-edges" data-content-storyboard-chain-connectors="true" data-object-canvas-graph-edges="true" viewBox="0 0 ' + width + ' ' + height + '" aria-hidden="true">',
      renderChainConnectors(storyboard, levels, columnWidth, cardStep, positions),
      '</svg>',
      '<div class="content-storyboard-board content-storyboard-chain-board" data-content-storyboard-board="true" data-object-canvas-graph-board="true">',
      renderChainEvidence(storyboard),
      levels.map((level, levelIndex) => renderChainLevel(level, levelIndex, columnWidth, cardStep, positions, storyboard)).join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderCanvasControls() {
    return [
      '<div class="content-storyboard-floating-controls object-canvas-zoom-controls" data-content-storyboard-floating-controls="true" aria-label="' + escapeAttr(t('objectCanvas.zoomAria', 'Canvas zoom')) + '">',
      '<button type="button" data-object-canvas-zoom="out" title="' + escapeAttr(t('objectCanvas.zoomOut', 'Zoom out')) + '">-</button>',
      '<span data-object-canvas-zoom-label="true">100%</span>',
      '<button type="button" data-object-canvas-zoom="in" title="' + escapeAttr(t('objectCanvas.zoomIn', 'Zoom in')) + '">+</button>',
      '<button type="button" data-object-canvas-zoom="reset" title="' + escapeAttr(t('objectCanvas.zoomReset', 'Reset')) + '">' + escapeHtml(t('objectCanvas.fit', 'Fit')) + '</button>',
      '</div>'
    ].join('');
  }

  function renderGlobalContext(storyboard) {
    const context = storyboard.storyContext || {};
    const selected = context.selected || {};
    const timeline = context.timeline || {};
    const chain = context.chain || {};
    return [
      '<section class="content-storyboard-global-context" data-content-storyboard-global-context="true">',
      '<div><span>' + escapeHtml(t('storyboard.nowEditing', 'Now editing')) + '</span><strong>' + escapeHtml(selected.title || selected.id || '') + '</strong></div>',
      '<div><span>' + escapeHtml(t('storyboard.globalPosition', 'Global position')) + '</span><strong>' + escapeHtml(selected.positionLabel || timeline.rangeLabel || '') + '</strong></div>',
      '<div><span>' + escapeHtml(t('storyboard.nearby', 'Nearby')) + '</span><strong>' + escapeHtml([
        (selected.beforeCount || 0) + ' ' + t('storyboard.beforeShort', 'before'),
        (selected.sameLaneCount || 0) + ' ' + t('storyboard.hereShort', 'here'),
        (selected.afterCount || 0) + ' ' + t('storyboard.afterShort', 'after')
      ].join(' / ')) + '</strong></div>',
      '<div><span>' + escapeHtml(t('storyboard.chainEvidence', 'Chain')) + '</span><strong>' + escapeHtml([
        (chain.upstreamCount || 0) + ' ' + t('storyboard.upstreamShort', 'upstream'),
        (chain.routeCount || 0) + ' ' + t('storyboard.routesShort', 'routes'),
        (chain.branchCount || 0) + ' ' + t('storyboard.branchesShort', 'branches')
      ].join(' / ')) + '</strong></div>',
      '</section>'
    ].join('');
  }

  function renderTimelineOverview(storyboard) {
    const api = scopeControlsApi();
    return api && typeof api.renderTimelineOverview === 'function' ? api.renderTimelineOverview(storyboard) : '';
  }

  function renderTimelineScope(storyboard) {
    const api = scopeControlsApi();
    return api && typeof api.renderTimelineScope === 'function' ? api.renderTimelineScope(storyboard) : '';
  }

  function renderChainDepthControls(storyboard) {
    const api = scopeControlsApi();
    return api && typeof api.renderChainDepthControls === 'function' ? api.renderChainDepthControls(storyboard) : '';
  }

  function renderChainLevel(level, levelIndex, columnWidth, cardStep, positions, storyboard) {
    const left = 36 + levelIndex * columnWidth;
    const cards = level.cards || [];
    return [
      '<section class="content-storyboard-chain-level" data-content-storyboard-chain-level="' + escapeAttr(level.key) + '" data-storyboard-drop-target="chain_level" data-content-storyboard-insert="' + escapeAttr(level.key) + '" style="left: ' + left + 'px; top: 150px; width: 324px;">',
      '<header><span>' + escapeHtml(chainLevelLabel(level)) + '</span><strong>' + escapeHtml(cards.length ? String(cards.length) : t('storyboard.openSlot', 'Open slot')) + '</strong></header>',
      cards.length ? cards.map((card, cardIndex) => renderCard(card, defaultPosition(0, 96 + cardIndex * cardStep, positions[card.key]), storyboard)).join('') : renderChainInsert(level.key),
      level.key === 'routes' || level.key === 'branches' ? renderChainInsert(level.key) : '',
      '</section>'
    ].join('');
  }

  function chainLevelLabel(level) {
    const key = String(level && level.key || '');
    return {
      upstream: t('storyboard.level.upstream', 'Upstream'),
      selected: t('storyboard.level.selected', 'Selected event'),
      routes: t('storyboard.level.relationships', 'Relationships'),
      downstream: t('storyboard.level.targets', 'Target events'),
      branches: t('storyboard.level.branches', 'Branches')
    }[key] || level && level.label || key;
  }

  function renderChainInsert(levelKey) {
    const action = levelKey === 'branches' ? 'create_counterfactual' : 'create_followup';
    const label = levelKey === 'branches' ? t('storyboard.addBranch', 'Add branch') : t('storyboard.insertBeat', 'Insert beat');
    return '<button type="button" class="content-storyboard-insert" data-object-canvas-action="' + action + '" data-content-storyboard-insert="' + escapeAttr(levelKey) + '" data-storyboard-drop-target="chain_gap">' + escapeHtml(label) + '</button>';
  }

  function renderPalette(storyboard) {
    const api = paletteApi();
    return api && typeof api.renderPalette === 'function' ? api.renderPalette(storyboard) : '';
  }

  function renderChainEvidence(storyboard) {
    const chain = storyboard.storyContext && storyboard.storyContext.chain || {};
    const topology = chain.topology || {};
    const labels = (chain.routeLabels || []).filter(Boolean);
    if (!labels.length && !topology.kind) {
      return '';
    }
    return [
      '<aside class="content-storyboard-chain-evidence" data-content-storyboard-chain-evidence="true" data-content-storyboard-chain-map="true">',
      '<span>' + escapeHtml(t('storyboard.relationMap', 'Relationship map')) + '</span>',
      topology.kind ? '<strong>' + escapeHtml(topologyLabel(topology.kind)) + '</strong>' : '',
      '<strong>' + escapeHtml([
        (chain.routeCount || 0) + ' ' + t('storyboard.relationsShort', 'relations'),
        (chain.downstreamCount || 0) + ' ' + t('storyboard.targetsShort', 'targets')
      ].join(' / ')) + '</strong>',
      labels.slice(0, 2).map((label) => '<em>' + escapeHtml(label) + '</em>').join(''),
      '</aside>'
    ].join('');
  }

  function renderChainConnectors(storyboard, levels, columnWidth, cardStep, positions) {
    const connectors = storyboard.chain && storyboard.chain.connectors || [];
    if (!connectors.length) {
      return '';
    }
    const nodePositions = chainNodePositions(levels, columnWidth, cardStep, positions);
    return connectors.map((connector) => {
      const from = nodePositions[connector.fromKey];
      const to = nodePositions[connector.toKey];
      if (!from || !to) {
        return '';
      }
      const forward = to.left >= from.left;
      const fromX = forward ? from.left + from.width : from.left;
      const toX = forward ? to.left : to.left + to.width;
      const fromY = from.top + Math.round(from.height * 0.5);
      const toY = to.top + Math.round(to.height * 0.5);
      const bend = Math.max(70, Math.abs(to.x - from.x) * 0.34);
      const d = 'M ' + fromX + ' ' + fromY + ' C ' + (fromX + (forward ? bend : -bend)) + ' ' + fromY + ', ' + (toX - (forward ? bend : -bend)) + ' ' + toY + ', ' + toX + ' ' + toY;
      return '<path data-content-storyboard-chain-connector="' + escapeAttr(connector.key || connector.fromKey + '-' + connector.toKey) + '" class="content-storyboard-chain-edge-' + safeClass(connector.kind || 'edge') + '" d="' + d + '"><title>' + escapeHtml(connector.label || connector.kind || '') + '</title></path>';
    }).join('');
  }

  function chainNodePositions(levels, columnWidth, cardStep, positions) {
    const out = {};
    ensureArray(levels).forEach((level, levelIndex) => {
      const levelLeft = 36 + levelIndex * columnWidth;
      ensureArray(level.cards).forEach((card, cardIndex) => {
        const pos = defaultPosition(0, 96 + cardIndex * cardStep, positions[card.key]);
        const left = levelLeft + Number(pos.x || 0);
        const top = 150 + Number(pos.y || 0);
        out[card.key] = {
          left,
          top,
          width: 324,
          height: 180,
          x: left + 162,
          y: top + 90
        };
      });
    });
    return out;
  }

  function renderCard(card, pos, storyboard) {
    const api = cardRendererApi();
    if (api && typeof api.renderCard === 'function') {
      return api.renderCard(card, pos, storyboard);
    }
    const selected = storyboard.selectedKey === card.key;
    const classes = [
      'content-storyboard-card',
      'content-storyboard-card-' + safeClass(card.kind),
      selected ? 'is-selected' : '',
      card.current ? 'is-current' : '',
      card.draftBranch ? 'is-draft' : '',
      card.route ? 'is-route' : ''
    ].filter(Boolean).join(' ');
    return [
      '<article class="' + classes + '" tabindex="0" data-content-storyboard-card="' + escapeAttr(card.key) + '" data-storyboard-card-face="' + escapeAttr(card.kind || '') + '" data-object-canvas-graph-node="' + escapeAttr(card.key) + '" data-canvas-x="' + pos.x + '" data-canvas-y="' + pos.y + '" style="left: ' + pos.x + 'px; top: ' + pos.y + 'px;">',
      '<strong class="content-storyboard-title">' + renderTextInline(card.title || card.id || '') + '</strong>',
      card.body ? '<p>' + renderTextInline(String(card.body)) + '</p>' : '',
      '</article>'
    ].join('');
  }

  function orderCardsForLane(cards, storyboard) {
    const selectedKey = storyboard && storyboard.selectedKey || '';
    return (cards || []).slice().sort((a, b) => {
      if (a.key === selectedKey) {
        return -1;
      }
      if (b.key === selectedKey) {
        return 1;
      }
      if (a.draftBranch && !b.draftBranch) {
        return -1;
      }
      if (b.draftBranch && !a.draftBranch) {
        return 1;
      }
      return 0;
    });
  }

  function renderEditor(model, storyboard, options) {
    const editor = storyboard.editor || {};
    if (isTextReplacement(model)) {
      return [
        '<aside class="content-storyboard-editor content-storyboard-text-editor" data-content-storyboard-editor="true">',
        renderCommandDock(model, storyboard, options || {}),
        renderPlan(model),
        '</aside>'
      ].join('');
    }
    return [
      '<aside class="content-storyboard-editor" data-content-storyboard-editor="true">',
      renderCommandDock(model, storyboard, options || {}),
      renderRuntimeLens(model, storyboard, options || {}),
      renderIdentity(editor.identity || []),
      renderStoryContext(editor.storyContext || storyboard.storyContext || {}),
      renderPaletteContext(storyboard.palette && storyboard.palette.dropContext),
      renderPlacement(editor.timelinePlacement || {}),
      renderContext(editor.context || {}),
      renderPlan(model),
      '</aside>'
    ].join('');
  }

  function findStoryboardCard(storyboard, key) {
    const target = String(key || '');
    const direct = ensureArray(storyboard && storyboard.cards).find((card) => card && card.key === target);
    if (direct) {
      return direct;
    }
    const levels = ensureArray(storyboard && storyboard.chain && storyboard.chain.levels);
    for (let index = 0; index < levels.length; index += 1) {
      const found = ensureArray(levels[index] && levels[index].cards).find((card) => card && card.key === target);
      if (found) {
        return found;
      }
    }
    return null;
  }

  function renderRuntimeLens(model, storyboard, options) {
    const api = runtimeLensApi();
    if (!api || typeof api.renderPanel !== 'function') {
      return '';
    }
    const focus = typeof api.focusFromCanvas === 'function'
      ? api.focusFromCanvas(options.projectIndex, model, storyboard.selectedKey)
      : {kind: 'event', id: model.objectId || '', title: model.title || ''};
    return api.renderPanel({
      focus,
      session: options.runtimeLensSession,
      status: options.runtimeLensStatus,
      sessionFocusKey: options.runtimeLensFocusKey,
      sessionDraftKey: options.runtimeLensDraftKey,
      currentDraftKey: options.runtimeLensCurrentDraftKey,
      expanded: options.runtimeLensExpanded,
      collapsed: options.runtimeLensCollapsed
    });
  }

  function renderIdentity(rows) {
    return [
      '<section class="content-storyboard-detail" data-content-storyboard-identity="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('objectCanvas.identity.eyebrow', 'Global context')) + '</div>',
      rows.length ? rows.map((row) => '<div><span>' + escapeHtml(row.label) + '</span><strong>' + escapeHtml(row.value) + '</strong></div>').join('') : '<p class="editing-empty">' + escapeHtml(t('storyboard.noIdentity', 'No identity evidence yet.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderStoryContext(context) {
    const selected = context && context.selected || {};
    const chain = context && context.chain || {};
    const topology = chain.topology || {};
    return [
      '<section class="content-storyboard-detail" data-content-storyboard-story-context="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('storyboard.storyContext', 'Story context')) + '</div>',
      '<div><span>' + escapeHtml(t('storyboard.globalPosition', 'Global position')) + '</span><strong>' + escapeHtml(selected.positionLabel || '') + '</strong></div>',
      '<div><span>' + escapeHtml(t('storyboard.nearby', 'Nearby')) + '</span><strong>' + escapeHtml([
        (selected.beforeCount || 0) + ' ' + t('storyboard.beforeShort', 'before'),
        (selected.sameLaneCount || 0) + ' ' + t('storyboard.hereShort', 'here'),
        (selected.afterCount || 0) + ' ' + t('storyboard.afterShort', 'after')
      ].join(' / ')) + '</strong></div>',
      '<div><span>' + escapeHtml(t('storyboard.chainEvidence', 'Chain')) + '</span><strong>' + escapeHtml([
        (chain.upstreamCount || 0) + ' ' + t('storyboard.upstreamShort', 'upstream'),
        (chain.routeCount || 0) + ' ' + t('storyboard.routesShort', 'routes'),
        (chain.branchCount || 0) + ' ' + t('storyboard.branchesShort', 'branches')
      ].join(' / ')) + '</strong></div>',
      topology.kind ? '<div><span>' + escapeHtml(t('storyboard.eventShape', 'Event shape')) + '</span><strong>' + escapeHtml(topologyLabel(topology.kind)) + '</strong></div>' : '',
      topology.kind ? '<div><span>' + escapeHtml(t('storyboard.internalFlow', 'Internal flow')) + '</span><strong>' + escapeHtml([
        (topology.internalStepCount || 0) + ' ' + t('storyboard.stepsShort', 'steps'),
        (topology.internalRouteCount || 0) + ' ' + t('storyboard.routesShort', 'routes'),
        (topology.conditionCount || 0) + ' ' + t('storyboard.conditionsShort', 'conditions')
      ].join(' / ')) + '</strong></div>' : '',
      '</section>'
    ].join('');
  }

  function topologyLabel(kind) {
    return {
      single_event: t('storyboard.shape.singleEvent', 'Single event'),
      single_composite_event: t('storyboard.shape.singleCompositeEvent', 'Single composite event'),
      composite_event_chain_node: t('storyboard.shape.compositeEventChainNode', 'Composite event-chain node'),
      single_composite_event_in_chain: t('storyboard.shape.singleCompositeEventInChain', 'Single composite event in a chain')
    }[kind] || kind || '';
  }

  function renderPaletteContext(context) {
    if (!context || !context.itemKey) {
      return '';
    }
    return [
      '<section class="content-storyboard-detail" data-storyboard-palette-drop-context="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('storyboard.palette.dropContext', 'Palette drop context')) + '</div>',
      '<div><span>' + escapeHtml(t('storyboard.palette.item', 'Item')) + '</span><strong>' + escapeHtml(context.itemTitle || context.itemKey || '') + '</strong></div>',
      '<div><span>' + escapeHtml(t('storyboard.palette.target', 'Target')) + '</span><strong>' + escapeHtml([context.targetKind, context.insertKey].filter(Boolean).join(' / ')) + '</strong></div>',
      '<div><span>' + escapeHtml(t('storyboard.palette.view', 'View')) + '</span><strong>' + escapeHtml(context.view || '') + '</strong></div>',
      '</section>'
    ].join('');
  }

  function renderContext(context) {
    return [
      '<section class="content-storyboard-detail" data-content-storyboard-context="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('storyboard.supportingContext', 'Supporting context')) + '</div>',
      renderContextCount(t('objectCanvas.group.flow', 'Flow'), context.flow),
      renderContextCount(t('editing.group.variables', 'Variables touched'), context.variables),
      renderContextCount(t('editing.group.effects', 'Effects'), context.effects),
      renderContextCount(t('editing.group.sourceEvidence', 'Source evidence'), context.sourceEvidence),
      renderContextCount(t('editing.group.manualBoundaries', 'Manual-review boundaries'), context.manualBoundaries),
      '</section>'
    ].join('');
  }

  function renderPlacement(placement) {
    if (!placement || !placement.reason) {
      return '';
    }
    return [
      '<section class="content-storyboard-detail" data-content-storyboard-placement="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('storyboard.placement', 'Timeline placement')) + '</div>',
      '<div><span>' + escapeHtml(t('storyboard.placementLane', 'Lane')) + '</span><strong>' + escapeHtml(placement.label || placement.laneKey || '') + '</strong></div>',
      '<div><span>' + escapeHtml(t('storyboard.placementWhy', 'Why here')) + '</span><strong>' + escapeHtml(placement.reason || '') + '</strong></div>',
      '<div><span>' + escapeHtml(t('storyboard.placementEvidence', 'Evidence')) + '</span><strong>' + escapeHtml([placement.confidence, placement.profileSource].filter(Boolean).join(' / ')) + '</strong></div>',
      '</section>'
    ].join('');
  }

  function renderContextCount(label, rows) {
    const items = Array.isArray(rows) ? rows : [];
    return '<div class="content-storyboard-context-row"><span>' + escapeHtml(label) + '</span><strong>' + items.length + '</strong></div>';
  }

  function renderObjectPreviewEditor(model, storyboard, options) {
    const editor = previewEditorApi();
    if (editor && typeof editor.render === 'function') {
      return editor.render(model, {
        selectedKey: storyboard && storyboard.selectedKey,
        editorOverlay: options && options.editorOverlay
      });
    }
    const api = lightweightPreviewApi();
    if (api && typeof api.render === 'function') {
      return api.render(model, {selectedKey: storyboard && storyboard.selectedKey});
    }
    const output = model.changeState && model.changeState.output || {};
    return [
      '<section class="editing-preview">',
      '<div class="preview-heading">' + escapeHtml(t('objectCanvas.preview', 'Player-facing preview')) + '</div>',
      '<pre class="code-preview" data-object-canvas-preview="true" data-editing-preview="true">' + escapeHtml(output.playerPreview || output.proposalText || output.previewText || output.sceneDry || '') + '</pre>',
      '</section>'
    ].join('');
  }

  function renderCommandDock(model, storyboard, options) {
    const selected = findStoryboardCard(storyboard, storyboard && storyboard.selectedKey) || {};
    const title = selected.title || model && model.title || t('objectCanvas.titleFallback', 'Author object');
    const displayTitle = displayCompactLabel(title);
    const kind = selected.kind ? kindLabel(selected.kind) : model && (model.templateLabel || model.objectKind) || '';
    const active = Boolean(options && options.editorOverlay);
    return [
      '<section class="object-canvas-command-dock content-storyboard-command-dock" data-object-canvas-command-dock="true">',
      '<div class="object-canvas-command-head">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('storyboard.selected', 'Selected story object')) + '</div>',
      '<h3 data-content-storyboard-selected-title="true" title="' + escapeAttr(title) + '">' + escapeHtml(displayTitle) + '</h3>',
      '</div>',
      kind ? '<span class="object-canvas-command-pill">' + escapeHtml(kind) + '</span>' : '',
      '</div>',
      '<div class="object-canvas-command-row">',
      '<button type="button" class="primary-action" data-object-canvas-action="toggle_overlay">' + escapeHtml(active ? t('objectCanvas.editorDock', 'Close editor') : t('objectCanvas.editorOverlay', 'Open object editor')) + '</button>',
      '</div>',
      renderActions(model),
      '</section>'
    ].join('');
  }

  function renderOpenEditorCard(model, storyboard, options) {
    const selected = storyboard && storyboard.cards && storyboard.cards.find((card) => card.key === storyboard.selectedKey) || {};
    const title = selected.title || model && model.title || t('objectCanvas.titleFallback', 'Author object');
    const displayTitle = displayCompactLabel(title);
    const kind = selected.kind ? kindLabel(selected.kind) : model && (model.templateLabel || model.objectKind) || '';
    const active = Boolean(options && options.editorOverlay);
    return [
      '<section class="content-storyboard-detail object-editor-launch-card" data-object-editor-launch-card="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('previewObjectEditor.modalEyebrow', 'Object editor')) + '</div>',
      '<h3 title="' + escapeAttr(title) + '">' + escapeHtml(displayTitle) + '</h3>',
      '<p>' + escapeHtml(t('previewObjectEditor.modalHint', 'Open a focused editor with a live preview and fields beside it.')) + '</p>',
      kind ? '<small>' + escapeHtml(kind) + '</small>' : '',
      '<button type="button" class="primary-action" data-object-canvas-action="toggle_overlay">' + escapeHtml(active ? t('objectCanvas.editorDock', 'Close editor') : t('objectCanvas.editorOverlay', 'Open object editor')) + '</button>',
      '</section>'
    ].join('');
  }

  function renderTextReplacementContext(model) {
    const source = sourceLabel(model);
    return [
      '<section class="text-replacement-context-canvas" data-text-replacement-context-canvas="true">',
      '<div class="text-replacement-context-card">',
      '<span>' + escapeHtml(t('previewObjectEditor.contextRole', 'Canvas role')) + '</span>',
      '<h4>' + escapeHtml(t('previewObjectEditor.textContextTitle', 'Source-backed text patch')) + '</h4>',
      '<p>' + escapeHtml(t('previewObjectEditor.textContextBody', 'This is not a story beat. It is a bounded text replacement with before/after evidence.')) + '</p>',
      source ? '<small>' + escapeHtml(source) + '</small>' : '',
      '</div>',
      '</section>'
    ].join('');
  }

  function isTextReplacement(model) {
    const value = model || {};
    return value.template === 'surface' || value.objectKind === 'surface_text' || value.mode === 'surface_text';
  }

  function kindLabel(kind) {
    return {
      event: t('create.worldEvent', 'World Event'),
      news: t('create.news', 'News'),
      card: t('create.card', 'Card'),
      advisor: t('systemUi.region.advisor', 'Advisor'),
      surface: t('create.editText', 'Edit Text')
    }[kind] || kind || '';
  }

  function sourceLabel(model) {
    const source = model && model.source || {};
    return source && source.path ? source.path + (source.line ? ':' + source.line : '') : '';
  }

  function renderPlan(model) {
    const change = model.changeState || {};
    const output = change.output || {};
    const plan = change.installPlan || output.installPlan || parseJson(output.installPlanJson);
    const operations = Array.isArray(plan && plan.operations) ? plan.operations : [];
    return [
      '<section class="content-storyboard-detail" data-content-storyboard-plan="true" data-object-canvas-review-plan="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('objectCanvas.planTitle', 'Modification plan')) + '</div>',
      operations.length ? operations.slice(0, 5).map((op) => '<article><strong>' + escapeHtml(op.description || op.id || op.type || '') + '</strong><span>' + escapeHtml([op.safety, op.type, op.path || op.targetPath].filter(Boolean).join(' / ')) + '</span></article>').join('') : '<p class="editing-empty">' + escapeHtml(t('objectCanvas.planEmpty', 'No install operations are available for review yet.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderActions(model) {
    return [
      '<div class="editing-actions object-canvas-actions">',
      '<button type="button" data-object-canvas-action="create_followup">' + escapeHtml(t('objectCanvas.action.followup', 'Create follow-up')) + '</button>',
      '<button type="button" data-object-canvas-action="create_counterfactual">' + escapeHtml(t('objectCanvas.action.counterfactual', 'Create counterfactual')) + '</button>',
      '<button type="button" data-object-canvas-action="create_card">' + escapeHtml(t('objectCanvas.action.card', 'Create related card')) + '</button>',
      '<button type="button" data-object-canvas-action="create_news">' + escapeHtml(t('objectCanvas.action.news', 'Create related news')) + '</button>',
      '<button class="danger-action" type="button" data-object-canvas-action="delete_current_object">' + escapeHtml(t(model.mode === 'existing' ? 'objectCanvas.action.deleteExisting' : 'objectCanvas.action.discardDraft', model.mode === 'existing' ? 'Delete event' : 'Discard draft')) + '</button>',
      '<button type="button" data-object-canvas-action="refresh">' + escapeHtml(t('existingScene.refresh', 'Refresh proposal')) + '</button>',
      '<button type="button" data-object-canvas-action="save">' + escapeHtml(t('editing.saveToChanges', 'Save to My Changes')) + '</button>',
      '<button class="primary-action" type="button" data-object-canvas-action="review">' + escapeHtml(t('existingScene.review', 'Review & Apply')) + '</button>',
      '</div>'
    ].join('');
  }

  function buildStoryboard(model, options) {
    const api = global.ProjectMapContentStoryboardModel;
    if (api && typeof api.buildStoryboard === 'function') {
      return api.buildStoryboard(options.projectIndex, model, options);
    }
    return {view: 'timeline', selectedKey: '', cards: [], timeline: {lanes: []}, chain: {levels: []}, editor: {}};
  }

  function cardRendererApi() {
    if (global && global.ProjectMapStoryboardCardRenderer) {
      return global.ProjectMapStoryboardCardRenderer;
    }
    if (typeof require === 'function') {
      try {
        return require('./storyboard_card_renderer.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function scopeControlsApi() {
    if (global && global.ProjectMapStoryboardScopeControls) {
      return global.ProjectMapStoryboardScopeControls;
    }
    if (typeof require === 'function') {
      try {
        return require('./storyboard_scope_controls.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function paletteApi() {
    if (global && global.ProjectMapStoryboardPaletteSidebar) {
      return global.ProjectMapStoryboardPaletteSidebar;
    }
    if (typeof require === 'function') {
      try {
        return require('./storyboard_palette_sidebar.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function runtimeLensApi() {
    if (global && global.ProjectMapRuntimeLensUi) {
      return global.ProjectMapRuntimeLensUi;
    }
    if (typeof require === 'function') {
      try {
        return require('./runtime_lens_ui.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function renderTextInline(value) {
    const renderer = richTextApi();
    if (renderer && typeof renderer.renderInline === 'function') {
      return renderer.renderInline(value);
    }
    return escapeHtml(value);
  }

  function displayCompactLabel(value) {
    const raw = String(value || '');
    const display = compactDendryInlineLabel(raw) || raw.trim();
    return display || raw;
  }

  function compactDendryInlineLabel(value) {
    const raw = String(value || '');
    if (!raw) {
      return '';
    }
    const conditionalPattern = /\[\?\s*if\s+[^:]+:\s*([\s\S]*?)\?\]/g;
    const matches = [];
    let match;
    while ((match = conditionalPattern.exec(raw)) !== null) {
      matches.push({index: match.index, text: cleanDisplayLabel(match[1]), raw: match[0]});
    }
    if (!matches.length) {
      return cleanDisplayLabel(raw);
    }
    const first = matches[0];
    const last = matches[matches.length - 1];
    const before = raw.slice(0, first.index);
    const after = raw.slice(last.index + last.raw.length);
    const onlyAdjacentConditionals = !cleanDisplayLabel(before) && matches.every((item, index) => {
      if (index === 0) {
        return true;
      }
      const previous = matches[index - 1];
      return !cleanDisplayLabel(raw.slice(previous.index + previous.raw.length, item.index));
    });
    const unique = uniqueNonEmpty(matches.map((item) => item.text));
    if (onlyAdjacentConditionals && unique.length > 1) {
      return cleanDisplayLabel([unique.join(' / '), after].filter(Boolean).join(' '));
    }
    return cleanDisplayLabel(raw.replace(conditionalPattern, (_token, body) => ' ' + cleanDisplayLabel(body) + ' '));
  }

  function cleanDisplayLabel(value) {
    return String(value || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\*\*/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function uniqueNonEmpty(values) {
    const seen = new Set();
    const result = [];
    ensureArray(values).forEach((value) => {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      result.push(text);
    });
    return result;
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

  function lightweightPreviewApi() {
    if (global && global.ProjectMapLightweightObjectPreview) {
      return global.ProjectMapLightweightObjectPreview;
    }
    if (typeof require === 'function') {
      try {
        return require('./lightweight_object_preview.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function previewEditorApi() {
    if (global && global.ProjectMapPreviewObjectEditor) {
      return global.ProjectMapPreviewObjectEditor;
    }
    if (typeof require === 'function') {
      try {
        return require('./preview_object_editor.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function defaultPosition(x, y, override) {
    const value = override || {};
    return {
      x: Number(value.x || x || 0),
      y: Number(value.y || y || 0)
    };
  }

  function timelineCardPosition(index, override) {
    const columns = 3;
    const cardWidth = 324;
    const gap = 18;
    const column = index % columns;
    const row = Math.floor(index / columns);
    return defaultPosition(18 + column * (cardWidth + gap), 132 + row * 326, override);
  }

  function safeClass(value) {
    return String(value || 'item').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  }

  function normalizeCanvasCategory(value) {
    const text = String(value || 'story');
    return text === 'cards' || text === 'all' ? text : 'story';
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function parseJson(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch (_err) {
      return null;
    }
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

  const api = {render, renderPaletteOnly};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapContentStoryboardSurface = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
