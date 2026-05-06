(function initProjectMapContentStoryboardSurface(global) {
  'use strict';

  function render(model, options) {
    const storyboard = buildStoryboard(model, options || {});
    const view = storyboard.view || 'timeline';
    return [
      '<section class="object-canvas-stage content-storyboard-surface" data-object-canvas-stage="true" data-content-storyboard-surface="true" data-object-canvas-workspace="content" data-content-storyboard-view="' + escapeAttr(view) + '" aria-label="' + escapeAttr(t('storyboard.aria', 'Content Storyboard Canvas')) + '">',
      renderToolbar(storyboard, options || {}),
      '<div class="content-storyboard-layout">',
      view === 'chain' ? renderChain(storyboard, options || {}) : renderTimeline(storyboard, options || {}),
      renderEditor(model, storyboard, options || {}),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderToolbar(storyboard, options) {
    return [
      '<header class="object-canvas-stage-toolbar content-storyboard-toolbar">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('authoring.surface.contentStoryboard', 'Content Storyboard')) + '</div>',
      '<h3>' + escapeHtml(storyboard.view === 'chain' ? t('storyboard.chain.title', 'Story chain') : t('storyboard.timeline.title', 'Timeline storyboard')) + '</h3>',
      '</div>',
      '<div class="content-storyboard-controls">',
      renderProfileBadge(storyboard.timeline && storyboard.timeline.profile),
      renderViewButton('timeline', storyboard.view === 'timeline', t('storyboard.timeline', 'Timeline')),
      renderViewButton('chain', storyboard.view === 'chain', t('storyboard.chain', 'Chain')),
      '<button type="button" data-object-canvas-action="toggle_overlay">' + escapeHtml(options && options.editorOverlay ? t('objectCanvas.editorDock', 'Dock') : t('objectCanvas.editorOverlay', 'Expand editor')) + '</button>',
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

  function renderViewButton(view, active, label) {
    return '<button type="button" class="' + (active ? 'is-active' : '') + '" data-content-storyboard-view="' + escapeAttr(view) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' + escapeHtml(label) + '</button>';
  }

  function renderTimeline(storyboard, options) {
    const positions = options.nodePositions || {};
    const laneWidth = 360;
    const laneGap = 28;
    const lanes = storyboard.timeline && storyboard.timeline.lanes || [];
    const width = Math.max(1180, lanes.length * (laneWidth + laneGap) + 96);
    const maxCards = lanes.reduce((count, lane) => Math.max(count, lane.cards.length), 1);
    const height = Math.max(720, maxCards * 340 + 260);
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
      cards.map((card, cardIndex) => renderCard(card, defaultPosition(18, 132 + cardIndex * 326, positions[card.key]), storyboard)).join(''),
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
      orderedCards.slice(0, 8).map((card, cardIndex) => renderCard(card, defaultPosition(18, 132 + cardIndex * 326, positions[card.key]), storyboard)).join(''),
      '</section>'
    ].join('');
  }

  function renderLaneCreateMenu(insertKey) {
    const key = escapeAttr(insertKey || '');
    return [
      '<div class="content-storyboard-create-menu" data-content-storyboard-create-menu="true">',
      '<button type="button" class="content-storyboard-insert" data-object-canvas-action="create_followup" data-content-storyboard-insert="' + key + '" data-storyboard-drop-target="timeline_insert">' + escapeHtml(t('storyboard.addEventHere', 'Event here')) + '</button>',
      '<button type="button" class="content-storyboard-insert" data-object-canvas-action="create_card" data-content-storyboard-insert="' + key + '" data-storyboard-drop-target="timeline_insert">' + escapeHtml(t('storyboard.addCardHere', 'Card')) + '</button>',
      '<button type="button" class="content-storyboard-insert" data-object-canvas-action="create_news" data-content-storyboard-insert="' + key + '" data-storyboard-drop-target="timeline_insert">' + escapeHtml(t('storyboard.addNewsHere', 'News')) + '</button>',
      '</div>'
    ].join('');
  }

  function renderChain(storyboard, options) {
    const positions = options.nodePositions || {};
    const levels = storyboard.chain && storyboard.chain.levels || [];
    const columnWidth = 316;
    const width = Math.max(1220, levels.length * columnWidth + 72);
    const maxCards = levels.reduce((count, level) => Math.max(count, level.cards.length), 1);
    const height = Math.max(720, maxCards * 320 + 270);
    return [
      '<section class="content-storyboard-canvas" data-content-storyboard-canvas="true" data-storyboard-kind="chain" data-storyboard-drop-target="canvas" style="--content-storyboard-width: ' + width + 'px; --content-storyboard-height: ' + height + 'px;">',
      renderCanvasControls(),
      renderPalette(storyboard),
      renderGlobalContext(storyboard),
      renderChainDepthControls(storyboard),
      '<svg class="content-storyboard-chain-edges" data-content-storyboard-chain-connectors="true" data-object-canvas-graph-edges="true" viewBox="0 0 ' + width + ' ' + height + '" aria-hidden="true">',
      renderChainConnectors(storyboard, levels, columnWidth, positions),
      '</svg>',
      '<div class="content-storyboard-board content-storyboard-chain-board" data-content-storyboard-board="true" data-object-canvas-graph-board="true">',
      renderChainEvidence(storyboard),
      levels.map((level, levelIndex) => renderChainLevel(level, levelIndex, columnWidth, positions, storyboard)).join(''),
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

  function renderChainLevel(level, levelIndex, columnWidth, positions, storyboard) {
    const left = 36 + levelIndex * columnWidth;
    const cards = level.cards || [];
    return [
      '<section class="content-storyboard-chain-level" data-content-storyboard-chain-level="' + escapeAttr(level.key) + '" data-storyboard-drop-target="chain_level" data-content-storyboard-insert="' + escapeAttr(level.key) + '" style="left: ' + left + 'px; top: 150px; width: 286px;">',
      '<header><span>' + escapeHtml(level.label || '') + '</span><strong>' + escapeHtml(cards.length ? String(cards.length) : t('storyboard.openSlot', 'Open slot')) + '</strong></header>',
      cards.length ? cards.map((card, cardIndex) => renderCard(card, defaultPosition(0, 96 + cardIndex * 306, positions[card.key]), storyboard)).join('') : renderChainInsert(level.key),
      level.key === 'routes' || level.key === 'branches' ? renderChainInsert(level.key) : '',
      '</section>'
    ].join('');
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
    const labels = (chain.routeLabels || []).concat(chain.branchLabels || []).filter(Boolean);
    if (!labels.length) {
      return '';
    }
    return [
      '<aside class="content-storyboard-chain-evidence" data-content-storyboard-chain-evidence="true">',
      '<span>' + escapeHtml(t('storyboard.routeEvidence', 'Route evidence')) + '</span>',
      labels.slice(0, 5).map((label) => '<strong>' + escapeHtml(label) + '</strong>').join(''),
      '</aside>'
    ].join('');
  }

  function renderChainConnectors(storyboard, levels, columnWidth, positions) {
    const connectors = storyboard.chain && storyboard.chain.connectors || [];
    if (!connectors.length) {
      return '';
    }
    const nodePositions = chainNodePositions(levels, columnWidth, positions);
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

  function chainNodePositions(levels, columnWidth, positions) {
    const out = {};
    ensureArray(levels).forEach((level, levelIndex) => {
      const levelLeft = 36 + levelIndex * columnWidth;
      ensureArray(level.cards).forEach((card, cardIndex) => {
        const pos = defaultPosition(0, 96 + cardIndex * 306, positions[card.key]);
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
      '<strong class="content-storyboard-title">' + escapeHtml(card.title || card.id || '') + '</strong>',
      card.body ? '<p>' + escapeHtml(String(card.body).slice(0, 220)) + '</p>' : '',
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
    return [
      '<aside class="content-storyboard-editor" data-content-storyboard-editor="true">',
      '<section class="object-canvas-inspector-card">',
      '<div class="template-eyebrow">' + escapeHtml(t('storyboard.selected', 'Selected story object')) + '</div>',
      '<h3>' + escapeHtml((storyboard.cards.find((card) => card.key === storyboard.selectedKey) || {}).title || model.title || '') + '</h3>',
      '<p>' + escapeHtml(t('storyboard.editorHint', 'Canvas shows story structure. Technical context, plan, and review stay here.')) + '</p>',
      '</section>',
      renderRuntimeLens(model, storyboard, options || {}),
      renderIdentity(editor.identity || []),
      renderStoryContext(editor.storyContext || storyboard.storyContext || {}),
      renderPaletteContext(storyboard.palette && storyboard.palette.dropContext),
      renderPlacement(editor.timelinePlacement || {}),
      renderContext(editor.context || {}),
      renderPreview(model),
      renderPlan(model),
      renderActions(model),
      '</aside>'
    ].join('');
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
      expanded: options.runtimeLensExpanded
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
      '</section>'
    ].join('');
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

  function renderPreview(model) {
    const output = model.changeState && model.changeState.output || {};
    return [
      '<section class="editing-preview">',
      '<div class="preview-heading">' + escapeHtml(t('objectCanvas.preview', 'Player-facing preview')) + '</div>',
      '<pre class="code-preview" data-object-canvas-preview="true" data-editing-preview="true">' + escapeHtml(output.playerPreview || output.proposalText || output.previewText || output.sceneDry || '') + '</pre>',
      '</section>'
    ].join('');
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
      '<button type="button" data-object-canvas-action="refresh">' + escapeHtml(t('existingScene.refresh', 'Refresh proposal')) + '</button>',
      '<button type="button" data-object-canvas-action="save">' + escapeHtml(t('editing.saveToChanges', 'Save to My Changes')) + '</button>',
      '<button class="primary-action" type="button" data-object-canvas-action="review">' + escapeHtml(t('existingScene.review', 'Review & Apply')) + '</button>',
      model.mode !== 'existing' ? '<button type="button" data-object-canvas-action="legacy_form">' + escapeHtml(t('objectCanvas.legacyForm', 'Advanced Form')) + '</button>' : '',
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

  function defaultPosition(x, y, override) {
    const value = override || {};
    return {
      x: Number(value.x || x || 0),
      y: Number(value.y || y || 0)
    };
  }

  function safeClass(value) {
    return String(value || 'item').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
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

  const api = {render};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapContentStoryboardSurface = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
