(function initProjectMapStoryPaletteModel(global) {
  'use strict';

  const DEFAULT_GROUP_LIMIT = 12;
  const DEFAULT_RENDER_LIMIT = 90;
  const DEFAULT_ROW_HEIGHT = 96;
  const DEFAULT_VIEWPORT_HEIGHT = 560;
  const DEFAULT_OVERSCAN = 8;
  const DEFAULT_PALETTE_WIDTH = 376;
  const MIN_PALETTE_WIDTH = 300;
  const MAX_PALETTE_WIDTH = 620;
  const MATCH_TYPES = ['all', 'event', 'news', 'card', 'advisor', 'state', 'draft'];
  const SCOPE_FILTERS = ['all', 'related', 'source', 'state_linked'];

  function buildPalette(storyboard, options) {
    const board = isObject(storyboard) ? storyboard : {};
    const opts = isObject(options) ? options : {};
    const cards = ensureArray(board.cards);
    const selected = cardByKey(cards, board.selectedKey) || cards[0] || null;
    const query = String(opts.storyPaletteQuery || opts.paletteQuery || '').trim();
    const type = normalizeType(opts.storyPaletteType || opts.paletteType);
    const scopeFilter = normalizeScopeFilter(opts.storyPaletteScopeFilter || opts.paletteScopeFilter);
    const limit = numberOr(opts.storyPaletteGroupLimit, DEFAULT_GROUP_LIMIT);
    const selectedKey = String(opts.storyPaletteSelectedKey || opts.paletteSelectedKey || '').trim();
    const pinnedKeys = normalizeKeyList(opts.storyPalettePinnedKeys || opts.palettePinnedKeys);
    const recentKeys = normalizeKeyList(opts.storyPaletteRecentKeys || opts.paletteRecentKeys);
    const rawGroups = buildGroups(board, selected);
    const rawIndex = candidateIndex(rawGroups);
    const scopeContext = scopeContextFor(board, selected, rawIndex);
    const decoratedGroups = rawGroups.map((groupValue) => decorateGroup(groupValue, scopeContext));
    const index = candidateIndex(decoratedGroups);
    const specialGroups = specialPaletteGroups(index, pinnedKeys, recentKeys);
    const filteredGroups = specialGroups.concat(decoratedGroups)
      .map((groupValue) => filterGroup(groupValue, {query, type, scopeFilter, limit}))
      .map((groupValue) => markPaletteState(groupValue, selectedKey, pinnedKeys, recentKeys))
      .filter((groupValue) => groupValue.entries.length || groupValue.totalCount);
    const windowedGroups = applyRenderWindow(filteredGroups, {
      query,
      renderLimit: numberOr(opts.storyPaletteRenderLimit, DEFAULT_RENDER_LIMIT),
      rowHeight: numberOr(opts.storyPaletteRowHeight, DEFAULT_ROW_HEIGHT),
      viewportHeight: numberOr(opts.storyPaletteViewportHeight, DEFAULT_VIEWPORT_HEIGHT),
      overscan: numberOr(opts.storyPaletteOverscan, DEFAULT_OVERSCAN),
      scrollOffset: numberAtLeast(opts.storyPaletteScrollOffset || opts.paletteScrollOffset, 0)
    });
    const groups = windowedGroups.groups;
    const selectedEntry = selectedKey ? index.get(selectedKey) : null;
    const typeCounts = countEntryTypes(index);
    const totalMatchedCount = windowedGroups.totalMatchedCount;
    return {
      schemaVersion: '0.1',
      open: Boolean(opts.storyPaletteOpen),
      chromeCollapsed: Boolean(opts.storyPaletteChromeCollapsed || opts.paletteChromeCollapsed),
      width: clampNumber(opts.storyPaletteWidth || opts.paletteWidth, MIN_PALETTE_WIDTH, MAX_PALETTE_WIDTH, DEFAULT_PALETTE_WIDTH),
      query,
      type,
      scopeFilter,
      dropContext: normalizeDropContext(opts.storyPaletteDropContext),
      groups,
      empty: !groups.some((group) => group.entries.length),
      typeCounts,
      inspector: buildInspector(selectedEntry, {
        selectedKey,
        pinned: pinnedKeys.includes(selectedKey)
      }),
      scope: {
        filter: scopeFilter,
        selectedKey: scopeContext.selectedKey,
        currentKey: scopeContext.currentKey,
        sourceDir: scopeContext.sourceDir,
        year: scopeContext.year
      },
      diagnostics: {
        stateVariableCount: typeCounts.state || 0,
        stateBadgeCounts: stateBadgeCounts(index)
      },
      pinned: {keys: pinnedKeys},
      recent: {keys: recentKeys},
      renderWindow: windowedGroups.renderWindow,
      metrics: {
        groupCount: groups.length,
        visibleEntryCount: groups.reduce((count, group) => count + group.entries.length, 0),
        totalMatchedCount,
        totalCandidateCount: index.size
      }
    };
  }

  function buildGroups(storyboard, selected) {
    const view = String(storyboard.view || '') === 'chain' ? 'chain' : 'timeline';
    const groups = view === 'chain'
      ? chainGroups(storyboard, selected)
      : timelineGroups(storyboard, selected);
    const stateGroup = stateVariableGroup(storyboard.projectIndex || storyboard.index || null);
    return groups.concat(stateGroup ? [stateGroup] : []);
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
      group('routes', 'storyboard.palette.group.routes', 'Relationships', ensureArray(levels.routes && levels.routes.cards)),
      group('downstream', 'storyboard.palette.group.downstream', 'Target events', ensureArray(levels.downstream && levels.downstream.cards)),
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

  function entryGroup(key, labelKey, fallback, entries) {
    const unique = uniqueEntries(ensureArray(entries));
    return {
      key,
      labelKey,
      fallback,
      totalCount: unique.length,
      entries: unique
    };
  }

  function entryForCard(card, groupKey) {
    const value = isObject(card) ? card : {};
    const kind = normalizeKind(value.kind, value);
    const source = isObject(value.source) ? value.source : {};
    const scheduleYear = scheduleYearFor(value.schedule);
    return {
      key: String(value.key || ''),
      id: String(value.id || ''),
      kind,
      title: String(value.title || value.id || ''),
      body: String(value.body || value.storyText && value.storyText.body || '').slice(0, 220),
      scheduleLabel: formatSchedule(value.schedule) || value.timelineLabel || '',
      sourceLabel: sourceLabel(value.source),
      sourcePath: String(source.path || ''),
      sourceDir: sourceDir(source.path),
      scheduleYear,
      stateTags: stateTags(value),
      groupKey,
      reason: String(value.paletteReason || value.chainSide || ''),
      draggable: true
    };
  }

  function stateVariableGroup(projectIndex) {
    const variables = ensureArray(projectIndex && projectIndex.variables)
      .map(variableEntry)
      .filter((entry) => entry.key);
    if (!variables.length) {
      return null;
    }
    return entryGroup('state_variables', 'storyboard.palette.group.stateVariables', 'State variables', variables);
  }

  function variableEntry(variable) {
    const value = isObject(variable) ? variable : {};
    const name = String(value.name || '').trim();
    if (!name) {
      return {key: ''};
    }
    const readCount = countOr(value.readCount, ensureArray(value.reads).length);
    const writeCount = countOr(value.writeCount, ensureArray(value.writes).length);
    const diagnosticBadges = variableDiagnosticBadges(readCount, writeCount);
    const usagePaths = refPaths(ensureArray(value.reads).concat(ensureArray(value.writes)).concat(ensureArray(value.definedIn)));
    const diagnostic = [
      readCount + ' reads',
      writeCount + ' writes'
    ].join(' / ');
    return {
      key: 'variable:' + name,
      id: name,
      kind: 'state',
      title: 'Q.' + name,
      body: String(value.label || value.description || diagnostic || '').slice(0, 220),
      scheduleLabel: diagnostic,
      sourceLabel: sourceLabel(firstSource(value)),
      stateTags: ['state', value.confidence || 'source'].filter(Boolean),
      groupKey: 'state_variables',
      reason: String(value.scope || 'Q'),
      draggable: false,
      readCount,
      writeCount,
      usagePaths,
      diagnosticBadges,
      diagnostics: {
        badges: diagnosticBadges,
        readCount,
        writeCount,
        referenceCount: readCount + writeCount
      }
    };
  }

  function candidateIndex(groups) {
    const index = new Map();
    ensureArray(groups).forEach((groupValue) => {
      ensureArray(groupValue.entries).forEach((entry) => {
        if (entry && entry.key && !index.has(entry.key)) {
          index.set(entry.key, entry);
        }
      });
    });
    return index;
  }

  function decorateGroup(groupValue, scopeContext) {
    return Object.assign({}, groupValue, {
      entries: ensureArray(groupValue.entries).map((entry) => decorateEntry(entry, scopeContext))
    });
  }

  function decorateEntry(entry, scopeContext) {
    const scope = scopeForEntry(entry, scopeContext);
    return Object.assign({}, entry, {
      scope,
      scopeBadges: scope.badges
    });
  }

  function specialPaletteGroups(index, pinnedKeys, recentKeys) {
    const pinned = entriesForKeys(index, pinnedKeys);
    const recent = entriesForKeys(index, recentKeys).filter((entry) => !pinnedKeys.includes(entry.key));
    return [
      pinned.length ? entryGroup('pinned', 'storyboard.palette.group.pinned', 'Pinned', pinned.map((entry) => Object.assign({}, entry, {pinned: true}))) : null,
      recent.length ? entryGroup('recent', 'storyboard.palette.group.recent', 'Recent', recent.map((entry) => Object.assign({}, entry, {recent: true}))) : null
    ].filter(Boolean);
  }

  function markPaletteState(groupValue, selectedKey, pinnedKeys, recentKeys) {
    const pinned = new Set(pinnedKeys);
    const recent = new Set(recentKeys);
    return Object.assign({}, groupValue, {
      entries: ensureArray(groupValue.entries).map((entry) => Object.assign({}, entry, {
        selected: Boolean(selectedKey && entry.key === selectedKey),
        pinned: pinned.has(entry.key),
        recent: recent.has(entry.key)
      }))
    });
  }

  function entriesForKeys(index, keys) {
    return normalizeKeyList(keys).map((key) => index.get(key)).filter(Boolean);
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

  function uniqueEntries(entries) {
    const seen = new Set();
    const out = [];
    ensureArray(entries).forEach((entry) => {
      if (!entry || !entry.key || seen.has(entry.key)) {
        return;
      }
      seen.add(entry.key);
      out.push(entry);
    });
    return out;
  }

  function typeForEntry(entry) {
    if (entry.kind === 'state') {
      return 'state';
    }
    if (entry.kind === 'draft') {
      return 'draft';
    }
    return ensureArray(entry.stateTags).includes('draft') || String(entry.key || '').indexOf('draft:') === 0 ? 'draft' : entry.kind;
  }

  function normalizeType(value) {
    const text = String(value || 'all').trim();
    return MATCH_TYPES.includes(text) ? text : 'all';
  }

  function normalizeScopeFilter(value) {
    const text = String(value || 'all').trim();
    return SCOPE_FILTERS.includes(text) ? text : 'all';
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
      entry.readCount,
      entry.writeCount,
      ensureArray(entry.scopeBadges).join(' '),
      ensureArray(entry.diagnosticBadges).join(' '),
      ensureArray(entry.stateTags).join(' ')
    ].join(' ').toLowerCase();
  }

  function countEntryTypes(index) {
    const seen = new Set();
    const counts = {all: 0, event: 0, news: 0, card: 0, advisor: 0, state: 0, draft: 0};
    index.forEach((entry) => {
      if (!entry || !entry.key || seen.has(entry.key)) {
        return;
      }
      seen.add(entry.key);
      const type = typeForEntry(entry);
      counts.all += 1;
      if (Object.prototype.hasOwnProperty.call(counts, type)) {
        counts[type] += 1;
      }
    });
    return counts;
  }

  function filterGroup(groupValue, filters) {
    const query = String(filters.query || '').toLowerCase();
    const type = normalizeType(filters.type);
    const scopeFilter = normalizeScopeFilter(filters.scopeFilter);
    const shouldLimit = Boolean(query);
    const limit = shouldLimit ? filters.limit : Number.MAX_SAFE_INTEGER;
    const filtered = ensureArray(groupValue.entries).filter((entry) => {
      if (type !== 'all' && typeForEntry(entry) !== type) {
        return false;
      }
      if (!query && !scopeMatches(entry, scopeFilter)) {
        return false;
      }
      if (!query) {
        return true;
      }
      return searchable(entry).indexOf(query) >= 0;
    });
    const entries = isOrderedPreferenceGroup(groupValue) ? filtered : filtered.sort(scopeSort);
    return Object.assign({}, groupValue, {
      totalCount: entries.length,
      hiddenCount: shouldLimit ? Math.max(0, entries.length - filters.limit) : 0,
      entries: entries.slice(0, limit)
    });
  }

  function isOrderedPreferenceGroup(groupValue) {
    return groupValue && (groupValue.key === 'pinned' || groupValue.key === 'recent');
  }

  function scopeMatches(entry, scopeFilter) {
    if (scopeFilter === 'all') {
      return true;
    }
    const badges = new Set(ensureArray(entry && entry.scopeBadges));
    if (scopeFilter === 'related') {
      return badges.size > 0;
    }
    if (scopeFilter === 'source') {
      return badges.has('current') || badges.has('same_source');
    }
    if (scopeFilter === 'state_linked') {
      return badges.has('state_linked');
    }
    return true;
  }

  function applyRenderWindow(groups, options) {
    const query = String(options.query || '').trim();
    const totalMatchedCount = ensureArray(groups).reduce((count, groupValue) => count + ensureArray(groupValue.entries).length, 0);
    const renderLimit = Math.max(1, numberOr(options.renderLimit, DEFAULT_RENDER_LIMIT));
    if (query || totalMatchedCount <= renderLimit) {
      return {
        groups,
        totalMatchedCount,
        renderWindow: {
          enabled: false,
          start: 0,
          end: totalMatchedCount,
          total: totalMatchedCount,
          rowHeight: numberOr(options.rowHeight, DEFAULT_ROW_HEIGHT),
          overscan: 0,
          viewportHeight: numberOr(options.viewportHeight, DEFAULT_VIEWPORT_HEIGHT),
          topSpacer: 0,
          bottomSpacer: 0
        }
      };
    }
    const rowHeight = numberOr(options.rowHeight, DEFAULT_ROW_HEIGHT);
    const viewportHeight = numberOr(options.viewportHeight, DEFAULT_VIEWPORT_HEIGHT);
    const overscan = numberOr(options.overscan, DEFAULT_OVERSCAN);
    const target = Math.min(totalMatchedCount, renderLimit);
    const start = Math.max(0, Math.min(totalMatchedCount - target, Math.floor(numberAtLeast(options.scrollOffset, 0) / rowHeight) - overscan));
    const end = Math.min(totalMatchedCount, start + target);
    let cursor = 0;
    let topSpacerApplied = false;
    const out = ensureArray(groups).map((groupValue) => {
      const entries = ensureArray(groupValue.entries);
      const groupStart = cursor;
      const groupEnd = groupStart + entries.length;
      cursor = groupEnd;
      if (groupEnd <= start || groupStart >= end) {
        return Object.assign({}, groupValue, {entries: [], renderWindow: {topSpacer: 0, bottomSpacer: 0}});
      }
      const localStart = Math.max(0, start - groupStart);
      const localEnd = Math.min(entries.length, end - groupStart);
      const topSpacer = topSpacerApplied ? 0 : Math.max(0, groupStart + localStart) * rowHeight;
      topSpacerApplied = true;
      const bottomSpacer = groupEnd >= end ? Math.max(0, totalMatchedCount - end) * rowHeight : 0;
      return Object.assign({}, groupValue, {
        entries: entries.slice(localStart, localEnd),
        renderWindow: {
          topSpacer,
          bottomSpacer
        }
      });
    }).filter((groupValue) => groupValue.entries.length || groupValue.renderWindow && (groupValue.renderWindow.topSpacer || groupValue.renderWindow.bottomSpacer));
    return {
      groups: out,
      totalMatchedCount,
      renderWindow: {
        enabled: true,
        start,
        end,
        total: totalMatchedCount,
        rowHeight,
        overscan,
        viewportHeight,
        topSpacer: start * rowHeight,
        bottomSpacer: Math.max(0, totalMatchedCount - end) * rowHeight,
        visibleEntryCount: end - start
      }
    };
  }

  function scopeContextFor(storyboard, selected, index) {
    const selectedKey = String(storyboard.selectedKey || selected && selected.key || '');
    const currentKey = String(storyboard.currentKey || '');
    const selectedEntry = index.get(selectedKey) || entryForCard(selected || {}, 'selected');
    return {
      selectedKey,
      currentKey,
      sourceDir: selectedEntry && selectedEntry.sourceDir || sourceDir(selected && selected.source && selected.source.path),
      sourcePath: selectedEntry && selectedEntry.sourcePath || selected && selected.source && selected.source.path || '',
      year: selectedEntry && selectedEntry.scheduleYear || scheduleYearFor(selected && selected.schedule),
      stateTags: new Set(ensureArray(selectedEntry && selectedEntry.stateTags).filter((tag) => !['current', 'source', 'changed', 'draft', 'route', 'state'].includes(String(tag || ''))))
    };
  }

  function scopeForEntry(entry, context) {
    const badges = [];
    const value = isObject(entry) ? entry : {};
    const selectedKey = context && context.selectedKey || '';
    if ((value.key && value.key === selectedKey) || (value.key && value.key === (context && context.currentKey))) {
      badges.push('current');
    }
    if (value.groupKey === 'upstream') {
      badges.push('upstream');
    }
    if (value.groupKey === 'downstream' || value.groupKey === 'routes') {
      badges.push('downstream');
    }
    if (value.sourceDir && context && context.sourceDir && value.sourceDir === context.sourceDir && value.key !== selectedKey) {
      badges.push('same_source');
    }
    if (value.scheduleYear && context && context.year && String(value.scheduleYear) === String(context.year) && value.key !== selectedKey) {
      badges.push('same_year');
    }
    if (isStateLinked(value, context)) {
      badges.push('state_linked');
    }
    return {
      badges: uniqueStrings(badges),
      score: scopeScore(badges)
    };
  }

  function isStateLinked(entry, context) {
    if (!entry || !context) {
      return false;
    }
    if (entry.kind === 'state') {
      const paths = new Set(ensureArray(entry.usagePaths));
      return Boolean(context.sourcePath && paths.has(context.sourcePath)) || ensureArray(entry.diagnosticBadges).includes('hot');
    }
    const selectedTags = context.stateTags || new Set();
    return ensureArray(entry.stateTags).some((tag) => selectedTags.has(tag));
  }

  function scopeScore(badges) {
    const weights = {current: 80, upstream: 35, downstream: 35, same_source: 25, same_year: 12, state_linked: 30};
    return uniqueStrings(badges).reduce((score, badge) => score + (weights[badge] || 0), 0);
  }

  function buildInspector(entry, options) {
    const value = isObject(entry) ? entry : null;
    if (!value || !value.key) {
      return {
        selectedKey: '',
        empty: true,
        rows: [],
        badges: [],
        actions: []
      };
    }
    const rows = [
      row('storyboard.palette.id', 'ID', value.id || value.key),
      value.sourceLabel ? row('storyboard.palette.source', 'Source', value.sourceLabel) : null,
      value.scheduleLabel ? row('storyboard.palette.schedule', 'Schedule', value.scheduleLabel) : null,
      value.reason ? row('storyboard.palette.reason', 'Reason', value.reason) : null
    ].filter(Boolean);
    if (value.kind === 'state') {
      rows.push(row('storyboard.palette.reads', 'Reads', String(value.readCount || 0)));
      rows.push(row('storyboard.palette.writes', 'Writes', String(value.writeCount || 0)));
    }
    return {
      selectedKey: value.key,
      empty: false,
      key: value.key,
      kind: value.kind,
      title: value.title || value.id || value.key,
      body: value.body || '',
      rows,
      badges: uniqueStrings(ensureArray(value.scopeBadges).concat(ensureArray(value.diagnosticBadges))),
      draggable: value.draggable !== false,
      pinned: Boolean(options && options.pinned),
      actions: [
        {action: 'open_story_palette_selection', labelKey: 'storyboard.palette.openSelection', fallback: 'Open'}
      ]
    };
  }

  function row(labelKey, fallback, value) {
    return {
      labelKey,
      fallback,
      value: String(value || '')
    };
  }

  function variableDiagnosticBadges(readCount, writeCount) {
    const badges = [];
    if (readCount === 0 && writeCount === 0) {
      badges.push('unused');
    }
    if (readCount > 0 && writeCount === 0) {
      badges.push('read_only');
    }
    if (readCount === 0 && writeCount > 0) {
      badges.push('write_only');
    }
    if (readCount + writeCount >= 20) {
      badges.push('hot');
    }
    return badges;
  }

  function stateBadgeCounts(index) {
    const counts = {unused: 0, read_only: 0, write_only: 0, hot: 0};
    index.forEach((entry) => {
      if (!entry || entry.kind !== 'state') {
        return;
      }
      ensureArray(entry.diagnosticBadges).forEach((badge) => {
        if (Object.prototype.hasOwnProperty.call(counts, badge)) {
          counts[badge] += 1;
        }
      });
    });
    return counts;
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

  function firstSource(variable) {
    return ensureArray(variable && variable.definedIn)[0] ||
      ensureArray(variable && variable.writes)[0] ||
      ensureArray(variable && variable.reads)[0] ||
      variable && variable.source ||
      null;
  }

  function scheduleYearFor(schedule) {
    const value = isObject(schedule) ? schedule : {};
    const year = value.year || value.yearStart || value.startYear || value.when && value.when.year;
    return year ? String(year) : '';
  }

  function refPaths(refs) {
    return uniqueStrings(ensureArray(refs)
      .map((ref) => isObject(ref) ? ref.path : '')
      .filter(Boolean));
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

  function countOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  function numberAtLeast(value, minimum) {
    const number = Number(value);
    const min = Number(minimum) || 0;
    return Number.isFinite(number) ? Math.max(min, number) : min;
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, number));
  }

  function normalizeKeyList(value) {
    const input = Array.isArray(value) ? value : String(value || '').split(',');
    return uniqueStrings(input.map((item) => String(item || '').trim()).filter(Boolean)).slice(0, 80);
  }

  function uniqueStrings(values) {
    const seen = new Set();
    const out = [];
    ensureArray(values).forEach((value) => {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      out.push(text);
    });
    return out;
  }

  function scopeSort(a, b) {
    const left = a && a.scope && a.scope.score || 0;
    const right = b && b.scope && b.scope.score || 0;
    return right - left;
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
