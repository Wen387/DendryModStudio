// @ts-check
(function initProjectMapTimelineCoordinateAdapter(global) {
  'use strict';

  const MAX_LANES = 8;
  const PROJECT_INDEX_LOOKUPS = typeof WeakMap === 'function' ? new WeakMap() : null;

  function buildTimeline(projectIndex, cards, selected, options) {
    const opts = isObject(options) ? options : {};
    const profile = profileApi().buildProfile(projectIndex, opts);
    const baseCards = ensureArray(cards).map((card, index) => enrichCard(projectIndex, card, index, profile));
    const placed = placeCards(projectIndex, baseCards, selected, profile);
    return {
      schemaVersion: '0.1',
      profile,
      range: placed.range,
      lanes: placed.lanes,
      undated: placed.undated,
      insertionPoints: placed.lanes.map((lane) => ({
        key: lane.insertionKey,
        label: lane.label,
        laneKey: lane.key,
        year: lane.year || ''
      })),
      cards: placed.cards,
      diagnostics: placed.diagnostics
    };
  }

  function placeCards(projectIndex, cards, selected, profile) {
    if (profile.mode === 'year_month') {
      return placeYearMonth(cards, selected, profile);
    }
    if (profile.mode === 'turn') {
      return placeNumeric(projectIndex, cards, selected, profile, ['turn', 'when.turn', 'metadata.turn'], 'turn');
    }
    if (profile.mode === 'chapter' || profile.mode === 'phase') {
      return placeNamed(projectIndex, cards, selected, profile);
    }
    if (profile.mode === 'chain_order') {
      return placeChain(projectIndex, cards, selected, profile);
    }
    return placeSourceOrder(cards, profile, 'No timeline values found; using source order.');
  }

  function placeYearMonth(cards, selected, profile) {
    const sorted = cards.slice().sort(compareByYearMonth);
    const years = sorted.map((card) => Number(card.schedule && card.schedule.year || 0)).filter(Boolean);
    const selectedYear = Number(selected && selected.schedule && selected.schedule.year || 0);
    if (!years.length && !selectedYear) {
      return placeSourceOrder(cards, profile, 'No year/month evidence found; using source order fallback.');
    }
    const startYear = years.length ? Math.min.apply(Math, years.concat(selectedYear || [])) : selectedYear;
    const endYear = years.length ? Math.max.apply(Math, years.concat(selectedYear || [])) : selectedYear;
    const focusStart = selectedYear ? Math.min(selectedYear, startYear) : startYear;
    const laneYears = [];
    for (let year = focusStart; year <= Math.max(endYear, focusStart + 2) && laneYears.length < MAX_LANES; year += 1) {
      laneYears.push(year);
    }
    const lanes = laneYears.map((year) => lane(profile, String(year), String(year), sorted.filter((card) => {
      return Number(card.schedule && card.schedule.year || 0) === year;
    }).map((card) => withPlacement(card, profile, String(year), String(year), 'Placed from year/month evidence.', 'matched')), {year}));
    const undated = sorted.filter((card) => !Number(card.schedule && card.schedule.year || 0)).map((card) => {
      return withPlacement(card, profile, 'undated', 'Needs schedule', 'No year/month evidence was found.', 'unknown');
    });
    return bundle(cards, lanes, undated, profile, {startYear: laneYears[0], endYear: laneYears[laneYears.length - 1]});
  }

  function placeNumeric(projectIndex, cards, selected, profile, paths, modeName) {
    const enriched = cards.map((card) => {
      const value = numericCoordinate(projectIndex, card, paths, modeName);
      return {card, value};
    });
    const values = enriched.map((item) => item.value).filter((value) => Number.isFinite(value));
    if (!values.length) {
      return placeSourceOrder(cards, profile, 'No ' + profile.unitLabel.toLowerCase() + ' evidence found; using source order fallback.');
    }
    const selectedKey = selected && selected.key;
    const selectedValue = (enriched.find((item) => item.card.key === selectedKey) || {}).value;
    const laneValues = selectLaneValues(uniqueNumbers(values), selectedValue);
    const lanes = laneValues.map((value) => {
      const label = laneLabel(profile, String(value), profile.unitLabel + ' ' + value);
      const laneCards = enriched.filter((item) => item.value === value).map((item) => {
        return withPlacement(item.card, profile, String(value), label, 'Placed from ' + modeName + ' evidence.', 'matched');
      });
      return lane(profile, String(value), label, laneCards, {unitValue: value});
    });
    const undated = enriched.filter((item) => !Number.isFinite(item.value)).map((item) => {
      return withPlacement(item.card, profile, 'undated', 'Needs ' + profile.unitLabel, 'No ' + modeName + ' evidence was found.', 'unknown');
    });
    return bundle(cards, lanes, undated, profile, {start: laneValues[0], end: laneValues[laneValues.length - 1]});
  }

  function placeNamed(projectIndex, cards, selected, profile) {
    const placed = cards.map((card) => {
      const coord = namedCoordinate(projectIndex, card, profile);
      return {card, coord};
    });
    const laneIds = orderedLaneIds(profile, placed.map((item) => item.coord && item.coord.key).filter(Boolean));
    if (!laneIds.length) {
      return placeSourceOrder(cards, profile, 'No ' + profile.mode + ' evidence found; using source order fallback.');
    }
    const lanes = laneIds.slice(0, MAX_LANES).map((key) => {
      const label = laneLabel(profile, key, titleCase(key));
      const laneCards = placed.filter((item) => item.coord && item.coord.key === key).map((item) => {
        return withPlacement(item.card, profile, key, label, item.coord.reason, item.coord.confidence);
      });
      return lane(profile, key, label, laneCards);
    });
    const undated = placed.filter((item) => !item.coord || !item.coord.key).map((item) => {
      return withPlacement(item.card, profile, 'undated', 'Needs ' + profile.unitLabel, 'No matching ' + profile.mode + ' rule or field was found.', 'unknown');
    });
    return bundle(cards, lanes, undated, profile, {start: lanes[0] && lanes[0].key, end: lanes[lanes.length - 1] && lanes[lanes.length - 1].key});
  }

  function placeChain(projectIndex, cards, selected, profile) {
    const selectedId = String(selected && selected.id || '');
    const edges = ensureArray(projectIndex && projectIndex.edges);
    if (!selectedId || !edges.length) {
      return placeSourceOrder(cards, profile, 'No story edges found; using source order fallback.');
    }
    const upstreamIds = new Set();
    const downstreamIds = new Set();
    edges.forEach((edge) => {
      const from = String(edge && edge.from || '');
      const to = String(edge && edge.to || '');
      if (to === selectedId) {
        upstreamIds.add(from);
      }
      if (from === selectedId) {
        downstreamIds.add(to);
      }
    });
    const groups = [
      {key: 'before', label: 'Before', ids: upstreamIds, reason: 'Connected by incoming story edges.'},
      {key: 'selected', label: 'Selected', ids: new Set([selectedId]), reason: 'This is the selected story object.'},
      {key: 'after', label: 'After', ids: downstreamIds, reason: 'Connected by outgoing story edges.'}
    ];
    const laneList = groups.map((group) => lane(profile, group.key, group.label, cards.filter((card) => group.ids.has(String(card.id))).map((card) => {
      return withPlacement(card, profile, group.key, group.label, group.reason, 'matched');
    })));
    const used = new Set(laneList.flatMap((item) => item.cards.map((card) => card.key)));
    const undated = cards.filter((card) => !used.has(card.key)).map((card) => {
      return withPlacement(card, profile, 'other', 'Other chain objects', 'No direct edge to the selected story object.', 'inferred');
    });
    return bundle(cards, laneList, undated, profile, {start: 'before', end: 'after'});
  }

  function placeSourceOrder(cards, profile, reason) {
    const sorted = cards.slice().sort(compareBySourceOrder);
    const laneCards = sorted.map((card, index) => {
      return withPlacement(card, profile, 'source_order', '#' + (index + 1), reason, 'inferred');
    });
    const sourceLane = lane(profile, 'source_order', 'Source order', laneCards);
    return bundle(cards, [sourceLane], [], profile, {start: 'source_order', end: 'source_order'});
  }

  function enrichCard(projectIndex, card, index, profile) {
    const sourceIndex = sourceOrder(projectIndex, card);
    return Object.assign({}, card, {
      storyboardOrder: Number.isFinite(sourceIndex) ? sourceIndex : index,
      timelineProfileMode: profile.mode
    });
  }

  function namedCoordinate(projectIndex, card, profile) {
    const byRule = coordinateFromRules(projectIndex, card, profile);
    if (byRule) {
      return byRule;
    }
    const paths = profile.mode === 'chapter'
      ? ['chapter', 'when.chapter', 'metadata.chapter']
      : ['phase', 'when.phase', 'metadata.phase'];
    const raw = projectScene(projectIndex, card) || card.raw;
    const value = firstPath(raw, paths);
    if (value) {
      return {key: safeId(value), reason: 'Placed from ' + profile.mode + ' field.', confidence: 'matched'};
    }
    const fromPath = laneFromPath(sourcePath(projectIndex, card), profile);
    if (fromPath) {
      return fromPath;
    }
    return null;
  }

  function coordinateFromRules(projectIndex, card, profile) {
    const rules = ensureArray(profile.rules);
    const raw = projectScene(projectIndex, card) || card.raw;
    const path = sourcePath(projectIndex, card);
    for (let index = 0; index < rules.length; index += 1) {
      const rule = rules[index];
      if (rule.source === 'path' && rule.match && rule.lane && globMatch(path, rule.match)) {
        return {key: rule.lane, reason: 'Matched profile path rule: ' + rule.match, confidence: 'matched'};
      }
      if ((rule.source === 'field' || rule.source === 'metadata') && rule.path) {
        const value = firstPath(raw, [rule.path]);
        if (value) {
          return {key: safeId(rule.lane || value), reason: 'Matched profile field rule: ' + rule.path, confidence: 'matched'};
        }
      }
    }
    return null;
  }

  function laneFromPath(path, profile) {
    const text = String(path || '').toLowerCase();
    const lanes = ensureArray(profile.lanes);
    for (let index = 0; index < lanes.length; index += 1) {
      const key = lanes[index].id;
      if (key && text.indexOf(key.replace(/_/g, '-')) >= 0 || key && text.indexOf(key) >= 0) {
        return {key, reason: 'Matched lane name in source path.', confidence: 'inferred'};
      }
    }
    return null;
  }

  function numericCoordinate(projectIndex, card, paths, modeName) {
    const raw = projectScene(projectIndex, card) || card.raw;
    const explicit = Number(firstPath(raw, paths));
    if (Number.isFinite(explicit) && explicit !== 0) {
      return explicit;
    }
    const text = String([
      raw && raw.viewIf,
      raw && raw.chooseIf,
      raw && raw.requires,
      raw && raw.condition
    ].filter(Boolean).join(' '));
    const match = text.match(new RegExp('\\b' + modeName + '\\s*(?:={1,3}|>=)\\s*(\\d+)'));
    return match ? Number(match[1]) : NaN;
  }

  function lane(profile, key, label, cards, extras) {
    const value = Object.assign({}, extras || {});
    value.key = safeId(key) || 'lane';
    value.label = String(label || key || '');
    value.unitLabel = profile.laneLabel || profile.unitLabel;
    value.insertionKey = profile.mode === 'year_month' ? 'time:' + value.key : profile.mode + ':' + value.key;
    value.cards = ensureArray(cards).sort(compareBySourceOrder);
    return value;
  }

  function withPlacement(card, profile, laneKey, label, reason, confidence) {
    const placement = {
      mode: profile.mode,
      unitLabel: profile.unitLabel,
      laneKey,
      label,
      reason,
      confidence: confidence || 'inferred',
      profileSource: profile.source || 'inferred'
    };
    return Object.assign({}, card, {
      timelinePlacement: placement,
      timelineLabel: label
    });
  }

  function bundle(originalCards, lanes, undated, profile, range) {
    const byKey = new Map();
    lanes.forEach((item) => item.cards.forEach((card) => byKey.set(card.key, card)));
    ensureArray(undated).forEach((card) => byKey.set(card.key, card));
    const cards = originalCards.map((card) => byKey.get(card.key) || card);
    return {
      cards,
      lanes,
      undated: ensureArray(undated),
      range,
      diagnostics: {
        mode: profile.mode,
        explanation: profile.explanation || ''
      }
    };
  }

  function orderedLaneIds(profile, ids) {
    const seen = new Set();
    const ordered = [];
    ensureArray(profile.lanes).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)).forEach((lane) => {
      if (ids.includes(lane.id) && !seen.has(lane.id)) {
        seen.add(lane.id);
        ordered.push(lane.id);
      }
    });
    ids.forEach((id) => {
      const key = safeId(id);
      if (key && !seen.has(key)) {
        seen.add(key);
        ordered.push(key);
      }
    });
    return ordered;
  }

  function laneLabel(profile, key, fallback) {
    const found = ensureArray(profile.lanes).find((lane) => lane.id === safeId(key) || String(lane.value) === String(key));
    return found && found.label || fallback || String(key || '');
  }

  function selectLaneValues(values, selectedValue) {
    const ordered = values.sort((a, b) => a - b);
    if (ordered.length <= MAX_LANES || !Number.isFinite(selectedValue)) {
      return ordered.slice(0, MAX_LANES);
    }
    const selectedIndex = Math.max(0, ordered.indexOf(selectedValue));
    const start = Math.max(0, Math.min(selectedIndex - 3, ordered.length - MAX_LANES));
    return ordered.slice(start, start + MAX_LANES);
  }

  function uniqueNumbers(values) {
    return Array.from(new Set(values.filter((value) => Number.isFinite(value))));
  }

  function compareByYearMonth(a, b) {
    return Number(a.schedule && a.schedule.year || 9999) - Number(b.schedule && b.schedule.year || 9999) ||
      Number(a.schedule && a.schedule.monthStart || 99) - Number(b.schedule && b.schedule.monthStart || 99) ||
      compareBySourceOrder(a, b);
  }

  function compareBySourceOrder(a, b) {
    return Number(a.storyboardOrder || 9999) - Number(b.storyboardOrder || 9999) ||
      String(a.source && a.source.path || '').localeCompare(String(b.source && b.source.path || '')) ||
      String(a.title || '').localeCompare(String(b.title || ''));
  }

  function sourceOrder(projectIndex, card) {
    const id = String(card && card.id || '');
    const path = String(card && card.source && card.source.path || card && card.raw && card.raw.path || '');
    const lookup = projectIndexLookup(projectIndex);
    if (lookup) {
      if (id && lookup.orderById.has(id)) {
        return lookup.orderById.get(id);
      }
      if (path && lookup.orderByPath.has(path)) {
        return lookup.orderByPath.get(path);
      }
    }
    return NaN;
  }

  function sourcePath(projectIndex, card) {
    const scene = projectScene(projectIndex, card);
    return String(scene && scene.path || card && card.source && card.source.path || card && card.raw && card.raw.path || '');
  }

  function projectScene(projectIndex, card) {
    const id = String(card && card.id || '');
    const path = String(card && card.source && card.source.path || card && card.raw && card.raw.path || '');
    const lookup = projectIndexLookup(projectIndex);
    if (!lookup) {
      return null;
    }
    return id && lookup.byId.get(id) || path && lookup.byPath.get(path) || null;
  }

  function projectIndexLookup(projectIndex) {
    if (!isObject(projectIndex)) {
      return null;
    }
    const scenes = ensureArray(projectIndex.scenes);
    if (PROJECT_INDEX_LOOKUPS) {
      const cached = PROJECT_INDEX_LOOKUPS.get(projectIndex);
      if (cached && cached.scenes === scenes && cached.length === scenes.length) {
        return cached;
      }
    }
    const lookup = {
      scenes,
      length: scenes.length,
      byId: new Map(),
      byPath: new Map(),
      orderById: new Map(),
      orderByPath: new Map()
    };
    scenes.forEach((scene, index) => {
      const id = String(scene && scene.id || '');
      const path = String(scene && scene.path || '');
      const order = index + 1;
      if (id && !lookup.byId.has(id)) {
        lookup.byId.set(id, scene);
        lookup.orderById.set(id, order);
      }
      if (path && !lookup.byPath.has(path)) {
        lookup.byPath.set(path, scene);
        lookup.orderByPath.set(path, order);
      }
    });
    if (PROJECT_INDEX_LOOKUPS) {
      PROJECT_INDEX_LOOKUPS.set(projectIndex, lookup);
    }
    return lookup;
  }

  function firstPath(object, paths) {
    for (let index = 0; index < paths.length; index += 1) {
      const value = readPath(object, paths[index]);
      if (value !== undefined && value !== null && String(value).trim()) {
        return value;
      }
    }
    return '';
  }

  function readPath(object, path) {
    return String(path || '').split('.').reduce((value, part) => {
      if (!isObject(value)) {
        return undefined;
      }
      return value[part];
    }, object);
  }

  function globMatch(value, pattern) {
    const escaped = String(pattern || '').split('**').map((part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')).join('.*');
    return new RegExp('^' + escaped + '$').test(String(value || ''));
  }

  function titleCase(value) {
    return String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function safeId(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_:-]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function profileApi() {
    if (global && global.ProjectMapTimelineProfileModel) {
      return global.ProjectMapTimelineProfileModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./timeline_profile_model.js');
      } catch (_err) {
        return {buildProfile: () => ({mode: 'source_order', unitLabel: 'Source order', laneLabel: 'Source', lanes: [], rules: []})};
      }
    }
    return {buildProfile: () => ({mode: 'source_order', unitLabel: 'Source order', laneLabel: 'Source', lanes: [], rules: []})};
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {buildTimeline};

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapTimelineCoordinateAdapter = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
