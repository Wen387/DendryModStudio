(function initProjectMapStoryboardPaletteSidebar(global) {
  'use strict';

  const TYPES = ['all', 'event', 'news', 'card', 'advisor', 'draft'];

  function renderPalette(storyboard) {
    const palette = storyboard && storyboard.palette || {};
    const open = Boolean(palette.open);
    return [
      '<aside class="storyboard-palette ' + (open ? 'is-open' : 'is-closed') + '" data-storyboard-palette="true" data-storyboard-palette-open="' + (open ? 'true' : 'false') + '">',
      renderHandle(open),
      open ? renderDrawer(palette) : '',
      '</aside>'
    ].join('');
  }

  function renderHandle(open) {
    return [
      '<button type="button" class="storyboard-palette-handle" data-object-canvas-action="toggle_story_palette" data-storyboard-palette-toggle="true" aria-expanded="' + (open ? 'true' : 'false') + '" title="' + escapeAttr(open ? t('storyboard.palette.close', 'Close palette') : t('storyboard.palette.open', 'Open palette')) + '">',
      open ? escapeHtml(t('storyboard.palette.closeShort', 'Close')) : escapeHtml(t('storyboard.palette.openShort', 'Palette')),
      '</button>'
    ].join('');
  }

  function renderDrawer(palette) {
    const groups = ensureArray(palette.groups);
    return [
      '<section class="storyboard-palette-drawer" data-storyboard-palette-drawer="true">',
      '<header class="storyboard-palette-header">',
      '<div>',
      '<span>' + escapeHtml(t('storyboard.palette.eyebrow', 'Story palette')) + '</span>',
      '<strong>' + escapeHtml(t('storyboard.palette.title', 'Matching story objects')) + '</strong>',
      '</div>',
      '<button type="button" data-object-canvas-action="close_story_palette" title="' + escapeAttr(t('storyboard.palette.close', 'Close palette')) + '">×</button>',
      '</header>',
      renderSearch(palette),
      renderTypeFilters(palette.type || 'all'),
      groups.length ? groups.map(renderGroup).join('') : renderEmpty(),
      '</section>'
    ].join('');
  }

  function renderSearch(palette) {
    return [
      '<label class="storyboard-palette-search">',
      '<span>' + escapeHtml(t('storyboard.palette.search', 'Search')) + '</span>',
      '<input type="search" data-storyboard-palette-query="true" value="' + escapeAttr(palette.query || '') + '" placeholder="' + escapeAttr(t('storyboard.palette.searchPlaceholder', 'Find event, card, news...')) + '">',
      '</label>'
    ].join('');
  }

  function renderTypeFilters(activeType) {
    return [
      '<div class="storyboard-palette-filters" data-storyboard-palette-filters="true">',
      TYPES.map((type) => {
        const active = type === activeType;
        return '<button type="button" class="' + (active ? 'is-active' : '') + '" data-object-canvas-action="set_story_palette_type" data-storyboard-palette-type="' + escapeAttr(type) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' + escapeHtml(typeLabel(type)) + '</button>';
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderGroup(group) {
    const entries = ensureArray(group.entries);
    if (!entries.length) {
      return '';
    }
    return [
      '<section class="storyboard-palette-group" data-storyboard-palette-group="' + escapeAttr(group.key || '') + '">',
      '<header><strong>' + escapeHtml(t(group.labelKey, group.fallback || group.key || 'Matches')) + '</strong><span>' + escapeHtml(String(group.totalCount || entries.length)) + '</span></header>',
      '<div class="storyboard-palette-list">',
      entries.map((entry) => renderEntry(entry)).join(''),
      '</div>',
      group.hiddenCount ? '<p class="storyboard-palette-more">' + escapeHtml(t('storyboard.palette.moreMatches', 'More matches hidden by this group limit.')) + '</p>' : '',
      '</section>'
    ].join('');
  }

  function renderEntry(entry) {
    return [
      '<article class="storyboard-palette-item storyboard-palette-item-' + safeClass(entry.kind) + '" tabindex="0" draggable="true" data-storyboard-palette-item="true" data-storyboard-palette-key="' + escapeAttr(entry.key || '') + '" data-storyboard-palette-kind="' + escapeAttr(entry.kind || '') + '" data-storyboard-palette-title="' + escapeAttr(entry.title || '') + '" data-object-canvas-graph-node="' + escapeAttr(entry.key || '') + '">',
      '<div class="storyboard-palette-item-kicker"><span>' + escapeHtml(typeLabel(entry.kind)) + '</span><em>' + escapeHtml(entry.scheduleLabel || entry.reason || '') + '</em></div>',
      '<strong>' + escapeHtml(entry.title || entry.id || '') + '</strong>',
      entry.body ? '<p>' + escapeHtml(entry.body) + '</p>' : '',
      renderTags(entry),
      entry.sourceLabel ? '<small>' + escapeHtml(entry.sourceLabel) + '</small>' : '',
      '</article>'
    ].join('');
  }

  function renderTags(entry) {
    const tags = ensureArray(entry.stateTags).slice(0, 3);
    if (!tags.length) {
      return '';
    }
    return '<div class="storyboard-palette-tags">' + tags.map((tag) => '<span>' + escapeHtml(stateLabel(tag)) + '</span>').join('') + '</div>';
  }

  function renderEmpty() {
    return '<p class="storyboard-palette-empty" data-storyboard-palette-empty="true">' + escapeHtml(t('storyboard.palette.empty', 'No matching story objects for this palette filter.')) + '</p>';
  }

  function typeLabel(type) {
    return {
      all: t('storyboard.palette.type.all', 'All'),
      event: t('create.worldEvent', 'World Event'),
      news: t('create.news', 'News'),
      card: t('create.card', 'Card'),
      advisor: t('systemUi.region.advisor', 'Advisor'),
      draft: t('storyboard.state.draft', 'Draft')
    }[type] || type || '';
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

  function safeClass(value) {
    return String(value || 'item').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
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

  const api = {renderPalette};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapStoryboardPaletteSidebar = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
