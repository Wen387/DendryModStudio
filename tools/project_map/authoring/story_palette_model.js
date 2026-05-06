(function initProjectMapStoryPaletteModel(global) {
  'use strict';

  const DEFAULT_GROUP_LIMIT = 12;
  const MATCH_TYPES = ['all', 'event', 'news', 'card', 'advisor', 'draft'];

  function buildPalette(storyboard, options) {
    const board = isObject(storyboard) ? storyboard : {};
    const opts = isObject(options) ? options : {};
    const cards = ensureArray(board.cards);
    const selected = cardByKey(cards, board.selectedKey) || cards[0] || null;
    const query = String(opts.storyPaletteQuery || opts.paletteQuery || '').trim();
    const type = normalizeType(opts.storyPaletteType || opts.paletteType);
    const limit = numberOr(opts.storyPaletteGroupLimit, DEFAULT_GROUP_LIMIT);
    const groups = buildGroups(board, selected, {query, type, limit});
    return {
      schemaVersion: '0.1',
      open: Boolean(opts.storyPaletteOpen),
      query,
      type,
      dropContext: normalizeDropContext(opts.storyPaletteDropContext),
      groups,
      empty: !groups.some((group) => group.entries.length),
      metrics: {
        groupCount: groups.length,
        visibleEntryCount: groups.reduce((count, group) => count + group.entries.length, 0),
        totalCandidateCount: groups.reduce((count, group) => count + group.totalCount, 0)
      }
    };
  }

  function buildGroups(storyboard, selected, filters) {
    const view = String(storyboard.view || '') === 'chain' ? 'chain' : 'timeline';
    const groups = view === 'chain'
      ? chainGroups(storyboard, selected)
      : timelineGroups(storyboard, selected);
    return groups.map((group) => filterGroup(group, filters)).filter((group) => group.entries.length || group.totalCount);
  }

  function timelineGroups(storyboard, selected) {
    const cards = ensureArray(storyboard.cards);
    const timeline = isObject(storyboard.timeline) ? storyboard.timeline : {};
    const visibleKeys = laneCards(ensureArray(timeline.lanes).concat([{key: 'undated', cards: timeline.undated || []}]));
    const visibleCards = cards.filter((card) => visibleKeys.has(card.key));
    const visibleLaneKeys = new Set(ensureArray(timeline.storyScope && timeline.storyScope.visibleLaneKeys));
    const nearby = ensureArray(timeline.fullLanes).filter((lane) => !visibleLaneKeys.has(String(lane.key)))
      .flatMap((lane) => ensureArray(lane.cards).map((card) => withPaletteReason(card, lane.label || lane.key)));
    const unplaced = cards.filter((card) => !cardHasSchedule(card) || laneKey(card) === 'undated');
    const sameSource = sameSourceCards(cards, selected);
    const drafts = cards.filter((card) => isDraftLike(card));
    return [
      group('current_scope', 'storyboard.palette.group.currentScope', 'Current scope', visibleCards),
      group('nearby', 'storyboard.palette.group.nearby', 'Nearby material', nearby),
      group('unplaced', 'storyboard.palette.group.unplaced', 'Unplaced', unplaced),
      group('same_source', 'storyboard.palette.group.sameSource', 'Same source area', sameSource),
      group('drafts', 'storyboard.palette.group.drafts', 'Drafts and changes', drafts)
    ];
  }

  function chainGroups(storyboard, selected) {
    const chain = isObject(storyboard.chain) ? storyboard.chain : {};
    const levels = Object.fromEntries(ensureArray(chain.levels).map((level) => [level.key, level]));
    const cards = ensureArray(storyboard.cards);
    return [
      group('selected_chain', 'storyboard.palette.group.selectedChain', 'Selected beat', ensureArray(levels.selected && levels.selected.cards)),
      group('upstream', 'storyboard.palette.group.upstream', 'Upstream candidates', ensureArray(levels.upstream && levels.upstream.cards)),
      group('routes', 'storyboard.palette.group.routes', 'Routes and downstream', ensureArray(levels.routes && levels.routes.cards)),
      group('branches', 'storyboard.palette.group.branches', 'Branches and inserts', ensureArray(levels.branches && levels.branches.cards)),
      group('same_source', 'storyboard.palette.group.sameSource', 'Same source area', sameSourceCards(cards, selected)),
      group('drafts', 'storyboard.palette.group.drafts', 'Drafts and changes', cards.filter((card) => isDraftLike(card)))
    ];
  }

  function group(key, labelKey, fallback, cards) {
    const unique = uniqueCards(ensureArray(cards));
    return {
      key,
      labelKey,
      fallback,
      totalCount: unique.length,
      entries: unique.map((card) => entryForCard(card, key))
    };
  }

  function filterGroup(groupValue, filters) {
    const query = String(filters.query || '').toLowerCase();
    const type = normalizeType(filters.type);
    const filtered = ensureArray(groupValue.entries).filter((entry) => {
      if (type !== 'all' && typeForEntry(entry) !== type) {
        return false;
      }
      if (!query) {
        return true;
      }
      return searchable(entry).indexOf(query) >= 0;
    });
    return Object.assign({}, groupValue, {
      totalCount: filtered.length,
      hiddenCount: Math.max(0, filtered.length - filters.limit),
      entries: filtered.slice(0, filters.limit)
    });
  }

  function entryForCard(card, groupKey) {
    const value = isObject(card) ? card : {};
    const kind = normalizeKind(value.kind, value);
    return {
      key: String(value.key || ''),
      id: String(value.id || ''),
      kind,
      title: String(value.title || value.id || ''),
      body: String(value.body || value.storyText && value.storyText.body || '').slice(0, 220),
      scheduleLabel: formatSchedule(value.schedule) || value.timelineLabel || '',
      sourceLabel: sourceLabel(value.source),
      stateTags: stateTags(value),
      groupKey,
      reason: String(value.paletteReason || value.chainSide || ''),
      draggable: true
    };
  }

  function sameSourceCards(cards, selected) {
    const selectedDir = sourceDir(selected && selected.source && selected.source.path);
    if (!selectedDir) {
      return [];
    }
    return ensureArray(cards).filter((card) => {
      const path = card && card.source && card.source.path || '';
      return card && card.key !== (selected && selected.key) && sourceDir(path) === selectedDir;
    });
  }

  function laneCards(lanes) {
    const keys = new Set();
    ensureArray(lanes).forEach((lane) => {
      ensureArray(lane && lane.cards).forEach((card) => {
        if (card && card.key) {
          keys.add(card.key);
        }
      });
    });
    return keys;
  }

  function withPaletteReason(card, reason) {
    return Object.assign({}, card || {}, {paletteReason: reason});
  }

  function uniqueCards(cards) {
    const seen = new Set();
    const out = [];
    ensureArray(cards).forEach((card) => {
      if (!card || !card.key || seen.has(card.key)) {
        return;
      }
      seen.add(card.key);
      out.push(card);
    });
    return out;
  }

  function typeForEntry(entry) {
    if (entry.kind === 'draft') {
      return 'draft';
    }
    return entry.stateTags.includes('draft') || String(entry.key || '').indexOf('draft:') === 0 ? 'draft' : entry.kind;
  }

  function normalizeType(value) {
    const text = String(value || 'all').trim();
    return MATCH_TYPES.includes(text) ? text : 'all';
  }

  function normalizeKind(kind, card) {
    const text = String(kind || '').trim();
    if (String(card && card.key || '').indexOf('draft:') === 0) {
      return 'draft';
    }
    return text || 'event';
  }

  function stateTags(card) {
    const tags = ensureArray(card && card.stateTags).slice();
    if (card && card.current && !tags.includes('current')) {
      tags.unshift('current');
    }
    if (card && card.draftBranch && !tags.includes('draft')) {
      tags.push('draft');
    }
    return tags.filter(Boolean).slice(0, 4);
  }

  function searchable(entry) {
    return [
      entry.key,
      entry.id,
      entry.kind,
      entry.title,
      entry.body,
      entry.scheduleLabel,
      entry.sourceLabel,
      entry.reason,
      ensureArray(entry.stateTags).join(' ')
    ].join(' ').toLowerCase();
  }

  function cardByKey(cards, key) {
    const text = String(key || '');
    return ensureArray(cards).find((card) => card && card.key === text) || null;
  }

  function cardHasSchedule(card) {
    return Boolean(card && card.schedule && card.schedule.year);
  }

  function laneKey(card) {
    return String(card && card.timelinePlacement && card.timelinePlacement.laneKey || '');
  }

  function isDraftLike(card) {
    return Boolean(card && (card.draftBranch || String(card.key || '').indexOf('draft:') === 0 || ensureArray(card.stateTags).includes('changed')));
  }

  function sourceDir(path) {
    const text = String(path || '');
    const index = text.lastIndexOf('/');
    return index >= 0 ? text.slice(0, index) : text;
  }

  function sourceLabel(source) {
    const value = isObject(source) ? source : {};
    if (!value.path) {
      return '';
    }
    return String(value.path).split('/').slice(-2).join('/') + (value.line ? ':' + value.line : '');
  }

  function formatSchedule(schedule) {
    const api = global && global.ProjectMapContentStoryboardModel;
    return api && typeof api.formatSchedule === 'function'
      ? api.formatSchedule(schedule)
      : fallbackSchedule(schedule);
  }

  function fallbackSchedule(schedule) {
    const value = isObject(schedule) ? schedule : {};
    return value.year ? String(value.year) : '';
  }

  function normalizeDropContext(context) {
    const value = isObject(context) ? context : {};
    return {
      itemKey: String(value.itemKey || ''),
      itemTitle: String(value.itemTitle || ''),
      targetKind: String(value.targetKind || ''),
      insertKey: String(value.insertKey || ''),
      view: String(value.view || '')
    };
  }

  function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {buildPalette};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapStoryPaletteModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
