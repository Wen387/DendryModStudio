(function initProjectMapStoryboardPaletteSidebar(global) {
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

  const TYPES = ['all', 'event', 'news', 'card', 'advisor', 'state', 'draft'];
  const SCOPE_FILTERS = ['all', 'related', 'source', 'state_linked'];
  const DEFAULT_PALETTE_WIDTH = 376;
  const MIN_PALETTE_WIDTH = 300;
  const MAX_PALETTE_WIDTH = 620;

  function renderPalette(storyboard) {
    const palette = storyboard && storyboard.palette || {};
    const open = Boolean(palette.open);
    const width = clampPaletteWidth(palette.width);
    return [
      '<aside class="storyboard-palette ' + (open ? 'is-open' : 'is-closed') + '" data-storyboard-palette="true" data-storyboard-palette-open="' + (open ? 'true' : 'false') + '" style="--storyboard-palette-width: ' + width + 'px;">',
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
    const collapsed = Boolean(palette.chromeCollapsed);
    return [
      '<section class="storyboard-palette-drawer' + (collapsed ? ' is-chrome-collapsed' : '') + '" data-storyboard-palette-drawer="true" data-storyboard-palette-density="compact" data-storyboard-palette-chrome-collapsed="' + (collapsed ? 'true' : 'false') + '">',
      renderResizer(),
      '<header class="storyboard-palette-header">',
      '<div>',
      '<span>' + escapeHtml(t('storyboard.palette.eyebrow', 'Canvas asset rail')) + '</span>',
      '<strong>' + escapeHtml(t('storyboard.palette.title', 'Canvas assets')) + '</strong>',
      renderMetric(palette),
      '</div>',
      '<div class="storyboard-palette-header-actions">',
      '<button type="button" class="storyboard-palette-collapse-button" data-object-canvas-action="toggle_story_palette_chrome" aria-expanded="' + (collapsed ? 'false' : 'true') + '" title="' + escapeAttr(collapsed ? t('storyboard.palette.expandChrome', 'Expand top panel') : t('storyboard.palette.collapseChrome', 'Collapse top panel')) + '">' + escapeHtml(collapsed ? t('storyboard.palette.expandChromeShort', 'Expand') : t('storyboard.palette.collapseChromeShort', 'Collapse')) + '</button>',
      '<button type="button" data-object-canvas-action="close_story_palette" title="' + escapeAttr(t('storyboard.palette.close', 'Close palette')) + '">×</button>',
      '</div>',
      '</header>',
      renderChromePanel(palette, collapsed),
      '<div class="storyboard-palette-scroll" data-storyboard-palette-scroll="true"' + renderScrollWindowAttrs(palette.renderWindow) + '>',
      groups.length ? groups.map(renderGroup).join('') : renderEmpty(),
      '</div>',
      renderInspector(palette.inspector),
      '</section>'
    ].join('');
  }

  function renderChromePanel(palette, collapsed) {
    if (collapsed) {
      return '<div class="storyboard-palette-chrome-panel" data-storyboard-palette-chrome-panel="true" hidden></div>';
    }
    return [
      '<div class="storyboard-palette-chrome-panel" data-storyboard-palette-chrome-panel="true">',
      renderSearch(palette),
      renderTypeFilters(palette),
      renderScopeFilters(palette),
      '</div>'
    ].join('');
  }

  function renderResizer() {
    return '<div class="storyboard-palette-resizer" data-storyboard-palette-resizer="true" role="separator" aria-orientation="vertical" aria-label="' + escapeAttr(t('storyboard.palette.resize', 'Resize asset rail')) + '" title="' + escapeAttr(t('storyboard.palette.resize', 'Resize asset rail')) + '"></div>';
  }

  function renderScrollWindowAttrs(renderWindow) {
    const win = renderWindow && typeof renderWindow === 'object' ? renderWindow : {};
    return [
      ' data-storyboard-palette-window-enabled="' + (win.enabled ? 'true' : 'false') + '"',
      ' data-storyboard-palette-window-start="' + escapeAttr(String(numberOr(win.start, 0))) + '"',
      ' data-storyboard-palette-window-end="' + escapeAttr(String(numberOr(win.end, 0))) + '"',
      ' data-storyboard-palette-window-total="' + escapeAttr(String(numberOr(win.total, 0))) + '"',
      ' data-storyboard-palette-row-height="' + escapeAttr(String(numberOr(win.rowHeight, 220))) + '"',
      ' data-storyboard-palette-overscan="' + escapeAttr(String(numberOr(win.overscan, 0))) + '"'
    ].join('');
  }

  function renderMetric(palette) {
    const count = palette && palette.metrics && palette.metrics.visibleEntryCount || 0;
    const total = palette && palette.metrics && palette.metrics.totalMatchedCount || count;
    return '<small class="storyboard-palette-count">' + escapeHtml(t('storyboard.palette.visibleCount', '{count} visible').replace('{count}', String(count))) + (total > count ? ' / ' + escapeHtml(String(total)) : '') + '</small>';
  }

  function renderSearch(palette) {
    return [
      '<label class="storyboard-palette-search">',
      '<span>' + escapeHtml(t('storyboard.palette.search', 'Search')) + '</span>',
      '<input type="search" data-storyboard-palette-query="true" value="' + escapeAttr(palette.query || '') + '" placeholder="' + escapeAttr(t('storyboard.palette.searchPlaceholder', 'Find event, card, news...')) + '">',
      '</label>'
    ].join('');
  }

  function renderTypeFilters(palette) {
    const activeType = palette && palette.type || 'all';
    const counts = palette && palette.typeCounts || {};
    return [
      '<div class="storyboard-palette-filters" data-storyboard-palette-filters="true">',
      TYPES.map((type) => {
        const active = type === activeType;
        const count = counts[type];
        return '<button type="button" class="' + (active ? 'is-active' : '') + '" data-object-canvas-action="set_story_palette_type" data-storyboard-palette-type="' + escapeAttr(type) + '" aria-pressed="' + (active ? 'true' : 'false') + '"><span>' + escapeHtml(typeLabel(type)) + '</span>' + (count || count === 0 ? '<small>' + escapeHtml(String(count)) + '</small>' : '') + '</button>';
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderScopeFilters(palette) {
    const active = palette && palette.scopeFilter || 'all';
    return [
      '<div class="storyboard-palette-scope-filters" data-storyboard-palette-scope-filters="true">',
      SCOPE_FILTERS.map((filter) => '<button type="button" class="' + (filter === active ? 'is-active' : '') + '" data-object-canvas-action="set_story_palette_scope" data-storyboard-palette-scope="' + escapeAttr(filter) + '" aria-pressed="' + (filter === active ? 'true' : 'false') + '">' + escapeHtml(scopeFilterLabel(filter)) + '</button>').join(''),
      '</div>'
    ].join('');
  }

  function renderInspector(inspector) {
    const value = inspector && typeof inspector === 'object' ? inspector : {};
    if (value.empty || !value.key) {
      return [
        '<aside class="storyboard-palette-inspector is-empty" data-storyboard-palette-inspector="true">',
        '<span>' + escapeHtml(t('storyboard.palette.inspector', 'Inspector')) + '</span>',
        '<p>' + escapeHtml(t('storyboard.palette.noSelection', 'Select an asset to inspect it.')) + '</p>',
        '</aside>'
      ].join('');
    }
    return [
      '<aside class="storyboard-palette-inspector" data-storyboard-palette-inspector="true" data-storyboard-palette-inspector-key="' + escapeAttr(value.key || '') + '">',
      '<header>',
      '<div><span>' + escapeHtml(typeLabel(value.kind)) + '</span><strong>' + escapeHtml(value.title || value.key || '') + '</strong></div>',
      '<button type="button" data-storyboard-palette-pin="' + escapeAttr(value.key || '') + '" aria-pressed="' + (value.pinned ? 'true' : 'false') + '" title="' + escapeAttr(value.pinned ? t('storyboard.palette.unpin', 'Unpin') : t('storyboard.palette.pin', 'Pin')) + '">' + escapeHtml(value.pinned ? t('storyboard.palette.unpinShort', 'Unpin') : t('storyboard.palette.pinShort', 'Pin')) + '</button>',
      '</header>',
      value.body ? '<p>' + escapeHtml(value.body) + '</p>' : '',
      renderBadgeStrip(value.badges),
      renderInspectorRows(value.rows),
      '<div class="storyboard-palette-inspector-actions">',
      '<button type="button" data-object-canvas-action="open_story_palette_selection">' + escapeHtml(t('storyboard.palette.openSelection', 'Open')) + '</button>',
      '</div>',
      '</aside>'
    ].join('');
  }

  function renderInspectorRows(rows) {
    const values = ensureArray(rows).filter((row) => row && row.value);
    if (!values.length) {
      return '';
    }
    return '<dl class="storyboard-palette-inspector-rows">' + values.map((row) => '<div><dt>' + escapeHtml(t(row.labelKey, row.fallback || 'Field')) + '</dt><dd>' + escapeHtml(row.value) + '</dd></div>').join('') + '</dl>';
  }

  function renderGroup(group) {
    const entries = ensureArray(group.entries);
    const topSpacer = group.renderWindow && group.renderWindow.topSpacer;
    const bottomSpacer = group.renderWindow && group.renderWindow.bottomSpacer;
    if (!entries.length && !topSpacer && !bottomSpacer) {
      return '';
    }
    return [
      '<section class="storyboard-palette-group" data-storyboard-palette-group="' + escapeAttr(group.key || '') + '">',
      '<header><strong>' + escapeHtml(t(group.labelKey, group.fallback || group.key || 'Matches')) + '</strong><span>' + escapeHtml(String(group.totalCount || entries.length)) + '</span></header>',
      '<div class="storyboard-palette-list">',
      renderVirtualSpacer(topSpacer),
      entries.map((entry) => renderEntry(entry)).join(''),
      renderVirtualSpacer(bottomSpacer),
      '</div>',
      group.hiddenCount ? '<p class="storyboard-palette-more">' + escapeHtml(t('storyboard.palette.moreMatches', 'More matches hidden by this group limit.')) + '</p>' : '',
      '</section>'
    ].join('');
  }

  function renderEntry(entry) {
    const draggable = entry.draggable !== false;
    const selected = Boolean(entry.selected);
    const pinned = Boolean(entry.pinned);
    return [
      '<article class="storyboard-palette-item storyboard-palette-item-' + safeClass(entry.kind) + (draggable ? '' : ' is-reference-only') + (selected ? ' is-selected' : '') + '" tabindex="0"' + (draggable ? ' draggable="true"' : '') + ' data-storyboard-palette-item="true" data-storyboard-palette-key="' + escapeAttr(entry.key || '') + '" data-storyboard-palette-kind="' + escapeAttr(entry.kind || '') + '" data-storyboard-palette-title="' + escapeAttr(entry.title || '') + '" data-storyboard-palette-selected="' + (selected ? 'true' : 'false') + '">',
      '<div class="storyboard-palette-item-type">' + iconHtml(iconForKind(entry.kind)) + '<span>' + escapeHtml(typeLabel(entry.kind)) + '</span></div>',
      '<div class="storyboard-palette-item-main">',
      '<div class="storyboard-palette-item-title-row"><strong title="' + escapeAttr(entry.title || entry.id || '') + '">' + escapeHtml(entry.title || entry.id || '') + '</strong>' + renderEntryHint(entry) + '</div>',
      entry.body ? '<p class="storyboard-palette-item-preview">' + escapeHtml(entry.body) + '</p>' : '',
      '<div class="storyboard-palette-item-footer">',
      renderEntryMeta(entry),
      renderBadgeStrip(ensureArray(entry.scopeBadges).concat(ensureArray(entry.diagnosticBadges))),
      renderTags(entry),
      entry.sourceLabel ? '<small class="storyboard-palette-source" title="' + escapeAttr(entry.sourceLabel) + '">' + escapeHtml(entry.sourceLabel) + '</small>' : '',
      '</div>',
      '</div>',
      '<button type="button" class="storyboard-palette-pin" data-storyboard-palette-pin="' + escapeAttr(entry.key || '') + '" aria-pressed="' + (pinned ? 'true' : 'false') + '" title="' + escapeAttr(pinned ? t('storyboard.palette.unpin', 'Unpin') : t('storyboard.palette.pin', 'Pin')) + '">' + escapeHtml(pinned ? t('storyboard.palette.unpinShort', 'Unpin') : t('storyboard.palette.pinShort', 'Pin')) + '</button>',
      '</article>'
    ].join('');
  }

  function renderEntryHint(entry) {
    const value = entry && (entry.scheduleLabel || entry.reason) || '';
    return value ? '<em>' + escapeHtml(value) + '</em>' : '';
  }

  function renderVirtualSpacer(height) {
    const pixels = Math.max(0, Number(height) || 0);
    return pixels ? '<div class="storyboard-palette-virtual-spacer" data-storyboard-palette-spacer="true" style="height: ' + pixels + 'px;"></div>' : '';
  }

  function renderEntryMeta(entry) {
    const rows = [];
    if (entry.id) {
      rows.push([t('storyboard.palette.id', 'ID'), entry.id]);
    }
    if (entry.kind === 'state') {
      rows.push([t('storyboard.palette.reads', 'Reads'), String(entry.readCount || 0)]);
      rows.push([t('storyboard.palette.writes', 'Writes'), String(entry.writeCount || 0)]);
    }
    if (!rows.length) {
      return '';
    }
    return '<dl class="storyboard-palette-meta">' + rows.map((row) => '<div><dt>' + escapeHtml(row[0]) + '</dt><dd>' + escapeHtml(row[1]) + '</dd></div>').join('') + '</dl>';
  }

  function renderTags(entry) {
    const tags = ensureArray(entry.stateTags).slice(0, 3);
    if (!tags.length) {
      return '';
    }
    return '<div class="storyboard-palette-tags">' + tags.map((tag) => '<span>' + escapeHtml(stateLabel(tag)) + '</span>').join('') + '</div>';
  }

  function renderBadgeStrip(badges) {
    const values = ensureArray(badges).slice(0, 5);
    if (!values.length) {
      return '';
    }
    return '<div class="storyboard-palette-badges">' + values.map((badge) => '<span data-storyboard-palette-badge="' + escapeAttr(badge) + '">' + escapeHtml(badgeLabel(badge)) + '</span>').join('') + '</div>';
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
      state: t('storyboard.palette.type.state', 'State'),
      draft: t('storyboard.state.draft', 'Draft')
    }[type] || type || '';
  }

  function scopeFilterLabel(filter) {
    return {
      all: t('storyboard.palette.scope.all', 'All'),
      related: t('storyboard.palette.scope.related', 'Related'),
      source: t('storyboard.palette.scope.source', 'Source'),
      state_linked: t('storyboard.palette.scope.stateLinked', 'State-linked')
    }[filter] || filter || '';
  }

  function stateLabel(tag) {
    return {
      current: t('storyboard.state.current', 'Current'),
      source: t('storyboard.state.source', 'Source-backed'),
      changed: t('storyboard.state.changed', 'Changed'),
      draft: t('storyboard.state.draft', 'Draft'),
      route: t('storyboard.state.route', 'Route'),
      state: t('storyboard.palette.type.state', 'State')
    }[tag] || tag;
  }

  function badgeLabel(badge) {
    return {
      current: t('storyboard.palette.badge.current', 'Current'),
      upstream: t('storyboard.palette.badge.upstream', 'Upstream'),
      downstream: t('storyboard.palette.badge.downstream', 'Downstream'),
      same_source: t('storyboard.palette.badge.sameSource', 'Same source'),
      same_year: t('storyboard.palette.badge.sameYear', 'Same year'),
      state_linked: t('storyboard.palette.badge.stateLinked', 'State-linked'),
      unused: t('storyboard.palette.badge.unused', 'Unused'),
      read_only: t('storyboard.palette.badge.readOnly', 'Read-only'),
      write_only: t('storyboard.palette.badge.writeOnly', 'Write-only'),
      hot: t('storyboard.palette.badge.hot', 'Hot')
    }[badge] || badge;
  }

  function iconForKind(kind) {
    return {
      event: 'play',
      news: 'book',
      card: 'card',
      advisor: 'settings',
      state: 'settings',
      draft: 'edit',
      chain_relation: 'chevron'
    }[kind] || 'map';
  }

  function iconHtml(name) {
    const icons = global.ProjectMapIcons;
    return icons && typeof icons.icon === 'function' ? icons.icon(name) : '';
  }

  function safeClass(value) {
    return String(value || 'item').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  }

  function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clampPaletteWidth(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return DEFAULT_PALETTE_WIDTH;
    }
    return Math.max(MIN_PALETTE_WIDTH, Math.min(MAX_PALETTE_WIDTH, number));
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  const api = {renderPalette};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapStoryboardPaletteSidebar = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
