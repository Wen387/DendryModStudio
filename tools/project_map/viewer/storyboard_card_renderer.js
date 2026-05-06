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
    return [
      '<article class="' + classes + '" tabindex="0" data-content-storyboard-card="' + escapeAttr(value.key) + '" data-storyboard-card-face="' + escapeAttr(value.kind || '') + '" data-storyboard-card-state="' + escapeAttr(stateText(value)) + '" data-object-canvas-graph-node="' + escapeAttr(value.key) + '" data-canvas-x="' + position.x + '" data-canvas-y="' + position.y + '" style="left: ' + position.x + 'px; top: ' + position.y + 'px;">',
      '<div class="content-storyboard-card-kicker"><span>' + escapeHtml(kindLabel(value.kind)) + '</span><em>' + escapeHtml(value.timelineLabel || formatSchedule(value.schedule) || chainLabel(value)) + '</em></div>',
      renderStateTags(value),
      renderCardTitle(value),
      renderCardBody(value),
      renderCardTiming(value),
      renderCardOptions(value),
      renderSourceLine(value),
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
      return '<div class="content-storyboard-body-fields">' + sections.slice(0, 3).map((field) => renderInlineField(field, {element: 'textarea'})).join('') + '</div>';
    }
    const body = String(card.body || card.storyText && card.storyText.body || '').trim();
    return body ? '<p>' + escapeHtml(body.slice(0, 360)) + '</p>' : '';
  }

  function renderCardOptions(card) {
    const options = card.fields && card.fields.options || [];
    const routes = card.routeTargets || [];
    if (card.editable && options.length) {
      return '<div class="content-storyboard-options" data-storyboard-card-options="true">' + options.slice(0, 4).map((option, index) => {
        const field = (option.fields || []).find((item) => item && item.id && item.id.indexOf('.label') >= 0) || (option.fields || [])[0];
        return '<div class="content-storyboard-option">' + renderInlineField(field, {element: 'input', fallbackLabel: t('storyboard.option', 'Option') + ' ' + (index + 1)}) + '<small>' + escapeHtml(option.targetId || '') + '</small></div>';
      }).join('') + '</div>';
    }
    if (routes.length) {
      return '<div class="content-storyboard-options" data-storyboard-card-options="true">' + routes.slice(0, 4).map((route) => '<span>' + escapeHtml(route.label || route.id || '') + '</span>').join('') + '</div>';
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

  function renderInlineField(field, options) {
    if (!field) {
      return '';
    }
    const opts = options || {};
    const id = field.id || '';
    const value = String(field.value !== undefined ? field.value : field.original !== undefined ? field.original : '');
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
      route: t('storyboard.state.route', 'Route')
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
      route: t('storyboard.route', 'Route')
    };
    return labels[kind] || kind || 'Object';
  }

  function formatSchedule(schedule) {
    const api = global.ProjectMapContentStoryboardModel;
    return api && typeof api.formatSchedule === 'function' ? api.formatSchedule(schedule) : '';
  }

  function rowsFor(value) {
    const lines = String(value || '').split('\n').length;
    return String(Math.max(3, Math.min(8, lines + 1)));
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
