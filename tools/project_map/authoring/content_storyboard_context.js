(function initProjectMapContentStoryboardContext(global) {
  'use strict';

  function buildContext(projectIndex, cards, selected, timeline, chain) {
    const selectedKey = selected && selected.key || '';
    const lanes = ensureArray(timeline && timeline.lanes);
    const selectedLane = lanes.find((lane) => ensureArray(lane.cards).some((card) => card.key === selectedKey)) ||
      (ensureArray(timeline && timeline.undated).some((card) => card.key === selectedKey)
        ? {key: 'undated', label: label('Needs schedule'), cards: ensureArray(timeline && timeline.undated)}
        : null);
    const laneIndex = selectedLane ? Math.max(0, lanes.findIndex((lane) => lane.key === selectedLane.key)) : -1;
    const beforeCount = laneIndex >= 0 ? lanes.slice(0, laneIndex).reduce(sumCards, 0) : 0;
    const afterCount = laneIndex >= 0 ? lanes.slice(laneIndex + 1).reduce(sumCards, 0) : 0;
    return {
      selected: {
        key: selectedKey,
        id: selected && selected.id || '',
        title: selected && selected.title || '',
        kind: selected && selected.kind || '',
        laneKey: selectedLane && selectedLane.key || '',
        laneLabel: selectedLane && selectedLane.label || selectedLane && selectedLane.year || '',
        positionLabel: positionLabel(selectedLane, laneIndex, lanes.length),
        beforeCount,
        sameLaneCount: selectedLane ? ensureArray(selectedLane.cards).length : 0,
        afterCount
      },
      timeline: {
        totalCards: ensureArray(cards).length,
        visibleLanes: lanes.length,
        rangeLabel: rangeLabel(timeline && timeline.range, lanes),
        lanes: lanes.map((lane) => laneContext(lane, selectedKey)),
        undatedCount: ensureArray(timeline && timeline.undated).length
      },
      chain: chainContext(chain, selectedKey),
      creationTargets: creationTargets(timeline, chain)
    };
  }

  function laneContext(lane, selectedKey) {
    const cards = ensureArray(lane && lane.cards);
    return {
      key: lane && lane.key || '',
      label: lane && (lane.label || lane.year || lane.key) || '',
      count: cards.length,
      selected: cards.some((card) => card.key === selectedKey),
      insertionKey: lane && lane.insertionKey || ''
    };
  }

  function chainContext(chain, selectedKey) {
    const levels = ensureArray(chain && chain.levels);
    const byKey = {};
    levels.forEach((level) => {
      byKey[level.key] = level;
    });
    const routes = ensureArray(byKey.routes && byKey.routes.cards);
    const branches = ensureArray(byKey.branches && byKey.branches.cards);
    return {
      levels: levels.map((level) => ({
        key: level.key,
        label: level.label || level.key || '',
        count: ensureArray(level.cards).length,
        selected: ensureArray(level.cards).some((card) => card.key === selectedKey)
      })),
      upstreamCount: ensureArray(byKey.upstream && byKey.upstream.cards).length,
      routeCount: routes.length,
      branchCount: branches.length,
      routeLabels: routes.map((card) => card.title || card.id || '').filter(Boolean).slice(0, 4),
      branchLabels: branches.map((card) => card.title || card.id || '').filter(Boolean).slice(0, 4)
    };
  }

  function creationTargets(timeline, chain) {
    const timelineTargets = ensureArray(timeline && timeline.insertionPoints).map((point) => ({
      key: point.key || '',
      label: point.label || point.year || point.laneKey || '',
      kind: 'timeline'
    }));
    const chainTargets = ensureArray(chain && chain.insertionPoints).map((point) => ({
      key: point.key || '',
      label: point.label || '',
      action: point.action || '',
      kind: 'chain'
    }));
    return timelineTargets.concat(chainTargets).filter((target) => target.key || target.label);
  }

  function positionLabel(lane, laneIndex, laneCount) {
    if (!lane) {
      return label('Not placed yet');
    }
    const base = lane.label || lane.year || lane.key || '';
    if (laneIndex < 0) {
      return String(base || label('Needs schedule'));
    }
    return String(base) + ' (' + (laneIndex + 1) + '/' + Math.max(1, laneCount) + ')';
  }

  function rangeLabel(range, lanes) {
    const value = range || {};
    if (value.startYear || value.endYear) {
      return [value.startYear, value.endYear].filter(Boolean).join(' - ');
    }
    if (value.start || value.end) {
      return [value.start, value.end].filter(Boolean).join(' - ');
    }
    const labels = ensureArray(lanes).map((lane) => lane.label || lane.year || lane.key).filter(Boolean);
    return labels.length ? labels[0] + (labels.length > 1 ? ' - ' + labels[labels.length - 1] : '') : '';
  }

  function sumCards(total, lane) {
    return total + ensureArray(lane && lane.cards).length;
  }

  function label(fallback) {
    return fallback;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  const api = {buildContext};

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapContentStoryboardContext = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
