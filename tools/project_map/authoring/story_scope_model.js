(function initProjectMapStoryScopeModel(global) {
  'use strict';

  const DEFAULT_FOCUS_RADIUS = 1;
  const DEFAULT_EXPANDED_RADIUS = 6;

  function buildScopedTimeline(projectIndex, timeline, selected, options) {
    const base = isObject(timeline) ? timeline : {};
    const scope = buildScope(projectIndex, base, selected, options);
    return applyScope(base, scope);
  }

  function buildScope(projectIndex, timeline, selected, options) {
    const opts = isObject(options) ? options : {};
    const allLanes = collectAllLanes(projectIndex, timeline, selected);
    const activeLaneKey = activeLane(allLanes, selected, opts);
    const activeIndex = Math.max(0, allLanes.findIndex((lane) => lane.key === activeLaneKey));
    const mode = normalizeMode(opts.storyScopeMode || opts.scopeMode);
    const radius = mode === 'expanded'
      ? numberOr(opts.storyScopeExpandedRadius, DEFAULT_EXPANDED_RADIUS)
      : numberOr(opts.storyScopeRadius, DEFAULT_FOCUS_RADIUS);
    const start = mode === 'expanded'
      ? Math.max(0, activeIndex - radius)
      : Math.max(0, activeIndex - radius);
    const end = mode === 'expanded'
      ? Math.min(allLanes.length, activeIndex + radius + 1)
      : Math.min(allLanes.length, activeIndex + radius + 1);
    const visibleLanes = allLanes.slice(start, end);
    const active = allLanes[activeIndex] || visibleLanes[0] || null;
    const undated = ensureArray(timeline.undated);
    const includeUndated = mode === 'expanded' || activeLaneKey === 'undated';
    return {
      schemaVersion: '0.1',
      mode,
      activeLaneKey: activeLaneKey || '',
      activeLabel: active && active.label || '',
      visibleLaneKeys: visibleLanes.map((lane) => lane.key),
      visibleLanes,
      fullLanes: allLanes.map(cloneLane),
      summaryLanes: allLanes.map((lane, index) => ({
        key: lane.key,
        label: lane.label,
        insertionKey: lane.insertionKey || '',
        count: ensureArray(lane.cards).length,
        selected: lane.key === activeLaneKey,
        beforeWindow: index < start,
        afterWindow: index >= end
      })),
      hiddenBefore: start,
      hiddenAfter: Math.max(0, allLanes.length - end),
      previousLaneKey: allLanes[start - 1] && allLanes[start - 1].key || '',
      nextLaneKey: allLanes[end] && allLanes[end].key || '',
      totalLaneCount: allLanes.length,
      totalCardCount: ensureArray(timeline.cards).length,
      visibleCardCount: visibleLanes.reduce((count, lane) => count + ensureArray(lane.cards).length, 0) + (includeUndated ? undated.length : 0),
      undatedCount: undated.length,
      showUndated: includeUndated
    };
  }

  function applyScope(timeline, scope) {
    const value = isObject(timeline) ? timeline : {};
    const storyScope = isObject(scope) ? scope : buildScope(null, value, null, {});
    const lanes = ensureArray(storyScope.visibleLanes).map(cloneLane);
    const undated = storyScope.showUndated ? ensureArray(value.undated).map((card) => card) : [];
    return Object.assign({}, value, {
      allLanes: ensureArray(storyScope.summaryLanes).map((lane) => Object.assign({}, lane)),
      fullLanes: ensureArray(storyScope.fullLanes).map(cloneLane),
      lanes,
      undated,
      insertionPoints: lanes.map((lane) => ({
        key: lane.insertionKey,
        label: lane.label,
        laneKey: lane.key,
        year: lane.year || ''
      })),
      storyScope
    });
  }

  function collectAllLanes(_projectIndex, timeline, selected) {
    const value = isObject(timeline) ? timeline : {};
    const profile = value.profile || {};
    const byKey = new Map();
    const order = [];
    ensureArray(value.lanes).forEach((lane, index) => addLane(byKey, order, laneFromExisting(lane, index)));
    ensureArray(value.cards).forEach((card, index) => addCardLane(byKey, order, profile, card, index));
    ensureArray(value.undated).forEach((card, index) => addCardLane(byKey, order, profile, card, index + 10000));
    if (!byKey.size && selected) {
      addCardLane(byKey, order, profile, selected, 0);
    }
    return order.map((key) => byKey.get(key)).sort(compareLanes).map((lane, index) => {
      return Object.assign({}, lane, {index});
    });
  }

  function addCardLane(byKey, order, profile, card, index) {
    const lane = laneFromCard(profile, card, index);
    if (!lane) {
      return;
    }
    const found = addLane(byKey, order, lane);
    if (found && card && card.key && !found.cards.some((item) => item.key === card.key)) {
      found.cards.push(card);
      found.cards.sort(compareCards);
    }
  }

  function addLane(byKey, order, lane) {
    if (!lane || !lane.key) {
      return null;
    }
    const key = String(lane.key);
    const existing = byKey.get(key);
    if (existing) {
      mergeCards(existing, lane.cards);
      return existing;
    }
    const next = Object.assign({}, lane, {
      key,
      label: String(lane.label || lane.key),
      cards: ensureArray(lane.cards).slice().sort(compareCards)
    });
    byKey.set(key, next);
    order.push(key);
    return next;
  }

  function laneFromExisting(lane, index) {
    const value = isObject(lane) ? lane : {};
    const key = String(value.key || value.year || index + 1);
    return {
      key,
      label: String(value.label || value.year || key),
      unitLabel: value.unitLabel || '',
      insertionKey: value.insertionKey || insertionKey(value, key),
      year: value.year || '',
      unitValue: value.unitValue,
      sortValue: sortValue(value, key, index),
      cards: ensureArray(value.cards)
    };
  }

  function laneFromCard(profile, card, index) {
    const value = isObject(card) ? card : {};
    const placement = isObject(value.timelinePlacement) ? value.timelinePlacement : {};
    const schedule = isObject(value.schedule) ? value.schedule : {};
    let key = String(placement.laneKey || '');
    let label = String(placement.label || '');
    let year = schedule.year || '';
    if (!key && year) {
      key = String(year);
      label = String(year);
    }
    if (!key && value.storyboardOrder) {
      key = 'source_order';
      label = 'Source order';
    }
    if (!key) {
      key = 'undated';
      label = 'Needs schedule';
    }
    return {
      key,
      label: label || key,
      unitLabel: placement.unitLabel || profile.laneLabel || profile.unitLabel || '',
      insertionKey: placement.mode === 'year_month' || year ? 'time:' + key : (placement.mode || profile.mode || 'lane') + ':' + key,
      year,
      sortValue: year ? Number(year) : value.storyboardOrder || index,
      cards: [value]
    };
  }

  function activeLane(allLanes, selected, options) {
    const explicit = laneKeyFromInsert(options.storyScopeWindow || options.timelineWindow || '');
    if (explicit && allLanes.some((lane) => lane.key === explicit)) {
      return explicit;
    }
    const card = isObject(selected) ? selected : {};
    const placement = isObject(card.timelinePlacement) ? card.timelinePlacement : {};
    const schedule = isObject(card.schedule) ? card.schedule : {};
    const key = String(placement.laneKey || schedule.year || '');
    if (key && allLanes.some((lane) => lane.key === key)) {
      return key;
    }
    return allLanes[0] && allLanes[0].key || '';
  }

  function laneKeyFromInsert(value) {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }
    const match = text.match(/^(?:time|year_month|turn|chapter|phase|chain_order|source_order|lane):(.+)$/);
    return match ? match[1] : text;
  }

  function insertionKey(lane, key) {
    if (lane && lane.year) {
      return 'time:' + lane.year;
    }
    return 'lane:' + key;
  }

  function mergeCards(lane, cards) {
    ensureArray(cards).forEach((card) => {
      if (card && card.key && !lane.cards.some((item) => item.key === card.key)) {
        lane.cards.push(card);
      }
    });
    lane.cards.sort(compareCards);
  }

  function cloneLane(lane) {
    return Object.assign({}, lane, {cards: ensureArray(lane.cards).slice()});
  }

  function compareLanes(a, b) {
    return sortValue(a, a.key, a.index) - sortValue(b, b.key, b.index) || String(a.label || '').localeCompare(String(b.label || ''));
  }

  function compareCards(a, b) {
    return Number(a && a.storyboardOrder || 9999) - Number(b && b.storyboardOrder || 9999) ||
      Number(a && a.schedule && a.schedule.monthStart || 99) - Number(b && b.schedule && b.schedule.monthStart || 99) ||
      String(a && a.title || '').localeCompare(String(b && b.title || ''));
  }

  function sortValue(lane, key, fallback) {
    const value = isObject(lane) ? lane : {};
    const numeric = Number(value.year || value.unitValue || key);
    if (Number.isFinite(numeric) && numeric !== 0) {
      return numeric;
    }
    if (key === 'undated') {
      return 999999;
    }
    return Number(fallback || 0);
  }

  function normalizeMode(value) {
    return String(value || '') === 'expanded' ? 'expanded' : 'focus';
  }

  function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {buildScope, buildScopedTimeline, applyScope};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapStoryScopeModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
