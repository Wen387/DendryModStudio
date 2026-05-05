(function initProjectMapContentStoryboardSurface(global) {
  'use strict';

  function render(model, options) {
    const storyboard = buildStoryboard(model, options || {});
    const view = storyboard.view || 'timeline';
    return [
      '<section class="object-canvas-stage content-storyboard-surface" data-object-canvas-stage="true" data-content-storyboard-surface="true" data-object-canvas-workspace="content" data-content-storyboard-view="' + escapeAttr(view) + '" aria-label="' + escapeAttr(t('storyboard.aria', 'Content Storyboard Canvas')) + '">',
      renderToolbar(storyboard),
      '<div class="content-storyboard-layout">',
      view === 'chain' ? renderChain(storyboard, options || {}) : renderTimeline(storyboard, options || {}),
      renderEditor(model, storyboard),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderToolbar(storyboard) {
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
      '<button type="button" data-object-canvas-action="toggle_overlay">' + escapeHtml(t('objectCanvas.editorOverlay', 'Expand editor')) + '</button>',
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
    const height = Math.max(620, maxCards * 340 + 150);
    return [
      '<section class="content-storyboard-canvas" data-content-storyboard-canvas="true" data-storyboard-kind="timeline" style="--content-storyboard-width: ' + width + 'px; --content-storyboard-height: ' + height + 'px;">',
      renderCanvasControls(),
      '<div class="content-storyboard-board" data-content-storyboard-board="true" data-object-canvas-graph-board="true">',
      lanes.map((lane, laneIndex) => renderTimelineLane(lane, laneIndex, laneWidth, laneGap, positions, storyboard)).join(''),
      renderUndatedLane(storyboard.timeline && storyboard.timeline.undated || [], lanes.length, laneWidth, laneGap, positions, storyboard),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderTimelineLane(lane, laneIndex, laneWidth, laneGap, positions, storyboard) {
    const left = 36 + laneIndex * (laneWidth + laneGap);
    const cards = lane.cards || [];
    const laneKey = lane.key || lane.year || laneIndex;
    const insertKey = lane.insertionKey || 'time:' + laneKey;
    const laneLabel = lane.unitLabel || t('storyboard.lane', 'Lane');
    const title = lane.label || lane.year || laneKey;
    return [
      '<section class="content-storyboard-lane" data-content-storyboard-lane="' + escapeAttr(laneKey) + '" style="left: ' + left + 'px; top: 24px; width: ' + laneWidth + 'px;">',
      '<header><span>' + escapeHtml(laneLabel) + '</span><strong>' + escapeHtml(String(title)) + '</strong><em>' + cards.length + ' ' + escapeHtml(t('storyboard.beats', 'beats')) + '</em></header>',
      '<button type="button" class="content-storyboard-insert" data-object-canvas-action="create_followup" data-content-storyboard-insert="' + escapeAttr(insertKey) + '">' + escapeHtml(t('storyboard.addHere', 'Add story here')) + '</button>',
      cards.map((card, cardIndex) => renderCard(card, defaultPosition(18, 132 + cardIndex * 326, positions[card.key]), storyboard)).join(''),
      '</section>'
    ].join('');
  }

  function renderUndatedLane(cards, laneIndex, laneWidth, laneGap, positions, storyboard) {
    if (!cards.length) {
      return '';
    }
    const left = 36 + laneIndex * (laneWidth + laneGap);
    return [
      '<section class="content-storyboard-lane content-storyboard-lane-undated" data-content-storyboard-lane="undated" style="left: ' + left + 'px; top: 24px; width: ' + laneWidth + 'px;">',
      '<header><span>' + escapeHtml(t('storyboard.undated', 'Undated')) + '</span><strong>' + escapeHtml(t('storyboard.needsSchedule', 'Needs schedule')) + '</strong><em>' + cards.length + ' ' + escapeHtml(t('storyboard.beats', 'beats')) + '</em></header>',
      '<button type="button" class="content-storyboard-insert" data-object-canvas-action="create_followup" data-content-storyboard-insert="undated">' + escapeHtml(t('storyboard.addHere', 'Add story here')) + '</button>',
      cards.slice(0, 8).map((card, cardIndex) => renderCard(card, defaultPosition(18, 132 + cardIndex * 326, positions[card.key]), storyboard)).join(''),
      '</section>'
    ].join('');
  }

  function renderChain(storyboard, options) {
    const positions = options.nodePositions || {};
    const levels = storyboard.chain && storyboard.chain.levels || [];
    const columnWidth = 316;
    const width = Math.max(1220, levels.length * columnWidth + 72);
    const maxCards = levels.reduce((count, level) => Math.max(count, level.cards.length), 1);
    const height = Math.max(620, maxCards * 320 + 180);
    return [
      '<section class="content-storyboard-canvas" data-content-storyboard-canvas="true" data-storyboard-kind="chain" style="--content-storyboard-width: ' + width + 'px; --content-storyboard-height: ' + height + 'px;">',
      renderCanvasControls(),
      '<div class="content-storyboard-board content-storyboard-chain-board" data-content-storyboard-board="true" data-object-canvas-graph-board="true">',
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

  function renderChainLevel(level, levelIndex, columnWidth, positions, storyboard) {
    const left = 36 + levelIndex * columnWidth;
    const cards = level.cards || [];
    return [
      '<section class="content-storyboard-chain-level" data-content-storyboard-chain-level="' + escapeAttr(level.key) + '" style="left: ' + left + 'px; top: 24px; width: 286px;">',
      '<header><span>' + escapeHtml(level.label || '') + '</span><strong>' + escapeHtml(cards.length ? String(cards.length) : t('storyboard.openSlot', 'Open slot')) + '</strong></header>',
      cards.length ? cards.map((card, cardIndex) => renderCard(card, defaultPosition(0, 96 + cardIndex * 306, positions[card.key]), storyboard)).join('') : renderChainInsert(level.key),
      level.key === 'routes' || level.key === 'branches' ? renderChainInsert(level.key) : '',
      '</section>'
    ].join('');
  }

  function renderChainInsert(levelKey) {
    const action = levelKey === 'branches' ? 'create_counterfactual' : 'create_followup';
    const label = levelKey === 'branches' ? t('storyboard.addBranch', 'Add branch') : t('storyboard.insertBeat', 'Insert beat');
    return '<button type="button" class="content-storyboard-insert" data-object-canvas-action="' + action + '" data-content-storyboard-insert="' + escapeAttr(levelKey) + '">' + escapeHtml(label) + '</button>';
  }

  function renderCard(card, pos, storyboard) {
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
      '<article class="' + classes + '" tabindex="0" data-content-storyboard-card="' + escapeAttr(card.key) + '" data-object-canvas-graph-node="' + escapeAttr(card.key) + '" data-canvas-x="' + pos.x + '" data-canvas-y="' + pos.y + '" style="left: ' + pos.x + 'px; top: ' + pos.y + 'px;">',
      '<div class="content-storyboard-card-kicker"><span>' + escapeHtml(kindLabel(card.kind)) + '</span><em>' + escapeHtml(card.timelineLabel || formatSchedule(card.schedule)) + '</em></div>',
      renderCardTitle(card),
      renderCardBody(card),
      renderCardTiming(card),
      renderCardOptions(card),
      '</article>'
    ].join('');
  }

  function renderCardTitle(card) {
    const field = card.fields && card.fields.title;
    if (card.editable && field && field.id) {
      return renderInlineField(field, {className: 'content-storyboard-title-input', element: 'input'});
    }
    return '<strong class="content-storyboard-title">' + escapeHtml(card.title || '') + '</strong>';
  }

  function renderCardBody(card) {
    const sections = card.fields && card.fields.sections || [];
    if (card.editable && sections.length) {
      return '<div class="content-storyboard-body-fields">' + sections.slice(0, 2).map((field) => renderInlineField(field, {element: 'textarea'})).join('') + '</div>';
    }
    const body = String(card.body || '').trim();
    return body ? '<p>' + escapeHtml(body.slice(0, 260)) + '</p>' : '';
  }

  function renderCardOptions(card) {
    const options = card.fields && card.fields.options || [];
    const routes = card.routeTargets || [];
    if (card.editable && options.length) {
      return '<div class="content-storyboard-options">' + options.slice(0, 3).map((option, index) => {
        const field = (option.fields || []).find((item) => item && item.id && item.id.indexOf('.label') >= 0) || (option.fields || [])[0];
        return '<div class="content-storyboard-option">' + renderInlineField(field, {element: 'input', fallbackLabel: t('storyboard.option', 'Option') + ' ' + (index + 1)}) + '<small>' + escapeHtml(option.targetId || '') + '</small></div>';
      }).join('') + '</div>';
    }
    if (routes.length) {
      return '<div class="content-storyboard-options">' + routes.slice(0, 3).map((route) => '<span>' + escapeHtml(route.label || route.id || '') + '</span>').join('') + '</div>';
    }
    return '';
  }

  function renderCardTiming(card) {
    const fields = card.fields && card.fields.metaFields || [];
    const timing = fields.filter((field) => {
      return field && ['event.year', 'event.monthStart', 'event.monthEnd'].includes(field.id);
    });
    if (!card.editable || !timing.length) {
      return '';
    }
    return '<div class="content-storyboard-timing">' + timing.map((field) => renderInlineField(field, {element: 'input'})).join('') + '</div>';
  }

  function renderEditor(model, storyboard) {
    const editor = storyboard.editor || {};
    return [
      '<aside class="content-storyboard-editor" data-content-storyboard-editor="true">',
      '<section class="object-canvas-inspector-card">',
      '<div class="template-eyebrow">' + escapeHtml(t('storyboard.selected', 'Selected story object')) + '</div>',
      '<h3>' + escapeHtml((storyboard.cards.find((card) => card.key === storyboard.selectedKey) || {}).title || model.title || '') + '</h3>',
      '<p>' + escapeHtml(t('storyboard.editorHint', 'Canvas shows story structure. Technical context, plan, and review stay here.')) + '</p>',
      '</section>',
      renderIdentity(editor.identity || []),
      renderPlacement(editor.timelinePlacement || {}),
      renderContext(editor.context || {}),
      renderPreview(model),
      renderPlan(model),
      renderActions(model),
      '</aside>'
    ].join('');
  }

  function renderIdentity(rows) {
    return [
      '<section class="content-storyboard-detail" data-content-storyboard-identity="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('objectCanvas.identity.eyebrow', 'Global context')) + '</div>',
      rows.length ? rows.map((row) => '<div><span>' + escapeHtml(row.label) + '</span><strong>' + escapeHtml(row.value) + '</strong></div>').join('') : '<p class="editing-empty">' + escapeHtml(t('storyboard.noIdentity', 'No identity evidence yet.')) + '</p>',
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

  function renderInlineField(field, options) {
    if (!field) {
      return '';
    }
    const opts = options || {};
    const id = field.id || '';
    const value = String(field.value !== undefined ? field.value : field.original || '');
    const label = field.label || opts.fallbackLabel || id;
    const element = opts.element === 'input' ? 'input' : 'textarea';
    const common = ' class="object-inline-input ' + escapeAttr(opts.className || '') + '" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '"' + (field.readOnly ? ' readonly' : '');
    return [
      '<label class="object-inline-field content-storyboard-field">',
      '<span>' + escapeHtml(label) + '</span>',
      element === 'input'
        ? '<input type="text"' + common + ' value="' + escapeAttr(value) + '">'
        : '<textarea rows="' + rowsFor(value) + '"' + common + '>' + escapeHtml(value) + '</textarea>',
      '</label>'
    ].join('');
  }

  function buildStoryboard(model, options) {
    const api = global.ProjectMapContentStoryboardModel;
    if (api && typeof api.buildStoryboard === 'function') {
      return api.buildStoryboard(options.projectIndex, model, options);
    }
    return {view: 'timeline', selectedKey: '', cards: [], timeline: {lanes: []}, chain: {levels: []}, editor: {}};
  }

  function defaultPosition(x, y, override) {
    const value = override || {};
    return {
      x: Number(value.x || x || 0),
      y: Number(value.y || y || 0)
    };
  }

  function kindLabel(kind) {
    const labels = {
      event: t('create.worldEvent', 'World Event'),
      card: t('create.card', 'Card'),
      news: t('create.news', 'News'),
      surface: t('create.editText', 'Edit Text'),
      advisor: t('systemUi.region.advisor', 'Advisor'),
      route: t('storyboard.route', 'Route')
    };
    return labels[kind] || kind || 'Object';
  }

  function formatSchedule(schedule) {
    const api = global.ProjectMapContentStoryboardModel;
    return api && typeof api.formatSchedule === 'function' ? api.formatSchedule(schedule) : '';
  }

  function rowsFor(value) {
    return String(Math.max(3, Math.min(8, String(value || '').split('\n').length + 1)));
  }

  function safeClass(value) {
    return String(value || 'item').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
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
