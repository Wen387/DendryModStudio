(function initProjectMapStoryboardCardRenderer(global) {
  'use strict';

  function renderCard(card, pos, storyboard) {
    const value = card || {};
    const position = pos || {x: 0, y: 0};
    const selected = storyboard && storyboard.selectedKey === value.key;
    const classes = [
      'content-storyboard-card',
      'content-storyboard-card-' + safeClass(value.kind),
      selected ? 'is-selected' : '',
      value.current ? 'is-current' : '',
      value.draftBranch ? 'is-draft' : '',
      value.route ? 'is-route' : '',
      value.chainDistance ? 'is-chain-distance-' + safeClass(value.chainDistance) : ''
    ].filter(Boolean).join(' ');
    const color = cardColor(value, storyboard);
    const style = [
      'left: ' + position.x + 'px',
      'top: ' + position.y + 'px',
      color ? '--storyboard-card-edge: ' + color : ''
    ].filter(Boolean).join('; ') + ';';
    if (value.kind === 'chain_relation') {
      return renderRelationCard(value, position, classes, style, color);
    }
    return [
      '<article class="' + classes + '" tabindex="0" data-content-storyboard-card="' + escapeAttr(value.key) + '" data-storyboard-card-face="' + escapeAttr(value.kind || '') + '" data-storyboard-card-state="' + escapeAttr(stateText(value)) + '" data-object-canvas-graph-node="' + escapeAttr(value.key) + '" data-canvas-x="' + position.x + '" data-canvas-y="' + position.y + '" style="' + escapeAttr(style) + '">',
      '<div class="content-storyboard-card-kicker"><span>' + escapeHtml(kindLabel(value.kind)) + '</span><em>' + escapeHtml(value.timelineLabel || formatSchedule(value.schedule) || chainLabel(value)) + '</em>' + renderCardTools(value, color) + '</div>',
      renderStateTags(value),
      renderCardTitle(value),
      renderCardBody(value),
      renderCardTiming(value),
      renderCardOptions(value),
      renderSourceLine(value),
      '</article>'
    ].join('');
  }

  function renderRelationCard(value, position, classes, style, color) {
    const relation = value.chainRelation || {};
    const trigger = relationTriggerLabel(relation);
    return [
      '<article class="' + classes + '" tabindex="0" data-content-storyboard-card="' + escapeAttr(value.key) + '" data-storyboard-card-face="' + escapeAttr(value.kind || '') + '" data-storyboard-card-state="' + escapeAttr(stateText(value)) + '" data-content-storyboard-chain-relation="true" data-object-canvas-graph-node="' + escapeAttr(value.key) + '" data-canvas-x="' + position.x + '" data-canvas-y="' + position.y + '" style="' + escapeAttr(style) + '">',
      '<div class="content-storyboard-card-kicker"><span>' + escapeHtml(trigger || kindLabel(value.kind)) + '</span><em>' + escapeHtml(relation.sourceLabel || '') + '</em>' + renderCardTools(value, color) + '</div>',
      renderStateTags(value),
      '<strong class="content-storyboard-title">' + renderTextInline(value.title || relation.label || '') + '</strong>',
      '<dl class="content-storyboard-relation-facts">',
      relation.fromTitle ? '<div><dt>' + escapeHtml(t('storyboard.relation.from', 'From')) + '</dt><dd>' + renderTextInline(relation.fromTitle) + '</dd></div>' : '',
      relation.targetTitle ? '<div><dt>' + escapeHtml(t('storyboard.relation.target', 'Target')) + '</dt><dd>' + renderTextInline(relation.targetTitle) + '</dd></div>' : '',
      relation.condition ? '<div><dt>' + escapeHtml(t('storyboard.relation.condition', 'Condition')) + '</dt><dd><code>' + escapeHtml(relation.condition) + '</code></dd></div>' : '',
      relation.rawTarget ? '<div><dt>' + escapeHtml(t('storyboard.relation.rawTarget', 'Raw target')) + '</dt><dd><code>' + escapeHtml(relation.rawTarget) + '</code></dd></div>' : '',
      '</dl>',
      relation.sourceLabel ? '<small class="content-storyboard-source">' + escapeHtml(relation.sourceLabel) + '</small>' : renderSourceLine(value),
      '</article>'
    ].join('');
  }

  function relationTriggerLabel(relation) {
    return {
      choice: t('storyboard.relation.trigger.choice', 'Player option'),
      conditional: t('storyboard.relation.trigger.conditional', 'Conditional jump'),
      goto: t('storyboard.relation.trigger.goto', 'Immediate jump'),
      route: t('storyboard.relation.trigger.route', 'Route')
    }[String(relation && relation.trigger || '')] || relation && relation.triggerLabel || '';
  }

  function renderCardTitle(card) {
    return '<strong class="content-storyboard-title">' + renderTextInline(card.title || '') + '</strong>';
  }

  function renderCardBody(card) {
    const body = String(card.body || card.storyText && card.storyText.body || '').trim();
    return body ? '<p>' + renderTextInline(body) + '</p>' : '';
  }

  function renderCardOptions(card) {
    const routes = card.routeTargets || [];
    if (routes.length) {
      return '<div class="content-storyboard-options" data-storyboard-card-options="true">' + routes.slice(0, 4).map((route) => '<span>' + renderTextInline(route.label || route.id || '') + '</span>').join('') + '</div>';
    }
    return '';
  }

  function renderCardTiming(card) {
    return '';
  }

  function renderStateTags(card) {
    const tags = stateTags(card);
    if (!tags.length) {
      return '';
    }
    return '<div class="content-storyboard-card-tags">' + tags.map((tag) => '<span>' + escapeHtml(stateLabel(tag)) + '</span>').join('') + '</div>';
  }

  function renderSourceLine(card) {
    const source = card && card.source || {};
    if (!source.path) {
      return '';
    }
    const line = source.line ? ':' + source.line : '';
    return '<small class="content-storyboard-source">' + escapeHtml(source.path + line) + '</small>';
  }

  function renderColorTools(card, color) {
    const key = card && card.key || '';
    if (!key) {
      return '';
    }
    const swatch = color || '#a64b2a';
    return [
      '<span class="content-storyboard-card-color-tools" data-storyboard-card-color-tools="true">',
      '<input type="color" value="' + escapeAttr(swatch) + '" data-storyboard-card-color-picker="true" data-storyboard-card-color-key="' + escapeAttr(key) + '" aria-label="' + escapeAttr(t('storyboard.color.pick', 'Set card edge color')) + '" title="' + escapeAttr(t('storyboard.color.pick', 'Set card edge color')) + '">',
      color ? '<button type="button" data-object-canvas-action="set_story_card_color" data-storyboard-card-color-key="' + escapeAttr(key) + '" data-storyboard-card-color="" aria-label="' + escapeAttr(t('storyboard.color.clear', 'Clear card edge color')) + '" title="' + escapeAttr(t('storyboard.color.clear', 'Clear card edge color')) + '">×</button>' : '',
      '</span>'
    ].join('');
  }

  function renderCardTools(card, color) {
    return [
      '<span class="content-storyboard-card-tools" data-storyboard-card-tools="true">',
      renderColorTools(card, color),
      renderDraftDeleteTool(card),
      '</span>'
    ].join('');
  }

  function renderDraftDeleteTool(card) {
    const key = card && card.key || '';
    if (!key || !isDraftCard(card)) {
      return '';
    }
    return '<button type="button" class="content-storyboard-card-delete" data-object-canvas-action="discard_draft_card" data-storyboard-draft-key="' + escapeAttr(key) + '" aria-label="' + escapeAttr(t('storyboard.deleteDraftCard', 'Discard draft card')) + '" title="' + escapeAttr(t('storyboard.deleteDraftCard', 'Discard draft card')) + '">×</button>';
  }

  function isDraftCard(card) {
    if (!card) {
      return false;
    }
    if (card.draftBranch || String(card.key || '').indexOf('draft:') === 0) {
      return true;
    }
    return stateTags(card).includes('draft');
  }

  function stateTags(card) {
    const tags = Array.isArray(card && card.stateTags) ? card.stateTags.slice() : [];
    if (card && card.current && !tags.includes('current')) {
      tags.unshift('current');
    }
    if (card && card.draftBranch && !tags.includes('draft')) {
      tags.push('draft');
    }
    if (card && card.route && !tags.includes('route')) {
      tags.push('route');
    }
    return tags.filter(Boolean).slice(0, 4);
  }

  function stateText(card) {
    return stateTags(card).join(' ');
  }

  function stateLabel(tag) {
    return {
      current: t('storyboard.state.current', 'Current'),
      source: t('storyboard.state.source', 'Source-backed'),
      changed: t('storyboard.state.changed', 'Changed'),
      draft: t('storyboard.state.draft', 'Draft'),
      route: t('storyboard.state.route', 'Route'),
      relation: t('storyboard.state.relation', 'Relation'),
      choice: t('storyboard.state.choice', 'Choice'),
      conditional: t('storyboard.state.conditional', 'Conditional'),
      goto: t('storyboard.state.goto', 'Jump')
    }[tag] || tag;
  }

  function chainLabel(card) {
    if (!card || !card.chainDistance) {
      return '';
    }
    return card.chainDistance + ' ' + t('storyboard.chainHop', 'hop');
  }

  function kindLabel(kind) {
    const labels = {
      event: t('create.worldEvent', 'World Event'),
      card: t('create.card', 'Card'),
      news: t('create.news', 'News'),
      surface: t('create.editText', 'Edit Text'),
      advisor: t('systemUi.region.advisor', 'Advisor'),
      route: t('storyboard.route', 'Route'),
      chain_relation: t('storyboard.relation', 'Relationship')
    };
    return labels[kind] || kind || 'Object';
  }

  function formatSchedule(schedule) {
    const api = global.ProjectMapContentStoryboardModel;
    return api && typeof api.formatSchedule === 'function' ? api.formatSchedule(schedule) : '';
  }

  function cardColor(card, storyboard) {
    const colors = storyboard && storyboard.ui && storyboard.ui.cardColors || storyboard && storyboard.cardColors || {};
    const color = colors && colors[card && card.key || ''];
    return /^#[0-9a-fA-F]{6}$/.test(String(color || '')) ? String(color).toLowerCase() : '';
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

  const api = {renderCard};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapStoryboardCardRenderer = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
