// @ts-check
(function initProjectMapContentStoryboardModel(global) {
  'use strict';

  function buildStoryboard(projectIndex, objectModel, options) {
    const opts = isObject(options) ? options : {};
    const model = isObject(objectModel) ? objectModel : {};
    const draftBranches = ensureArray(opts.draftBranches).map((branch, index) => draftBranchCard(branch, model, index));
    const current = currentCard(model);
    const canvasCategory = normalizeCanvasCategory(opts.storyCanvasCategory || opts.storyboardCategory || opts.canvasCategory);
    const rawCards = collectProjectCards(projectIndex, current);
    enrichCardsWithMusicState(rawCards, projectIndex);
    const allCards = dedupeCards(rawCards.concat([current]).concat(draftBranches));
    const categoryCards = filterCardsForCanvas(allCards, canvasCategory, current.key);
    const searchQuery = normalizeSearchQuery(opts.storySearchQuery || opts.searchQuery);
    const searchMatches = searchQuery ? categoryCards.filter((card) => cardMatchesSearch(card, searchQuery)) : categoryCards;
    const visibleBaseCards = searchQuery ? dedupeCards([cardByKey(categoryCards, current.key)].concat(searchMatches)) : categoryCards;
    const categorySummary = {
      key: canvasCategory,
      totalCardCount: allCards.length,
      storyObjectCount: allCards.filter((card) => isStoryCanvasKind(card.kind)).length,
      cardObjectCount: allCards.filter((card) => isCardCanvasKind(card.kind)).length,
      visibleCardCount: categoryCards.length,
      hiddenCardCount: Math.max(0, allCards.length - categoryCards.length)
    };
    const selectedKey = cardByKey(visibleBaseCards, opts.selected) ? String(opts.selected) : current.key;
    const selectedBase = cardByKey(visibleBaseCards, selectedKey) || current;
    const rawTimeline = buildTimeline(projectIndex, visibleBaseCards, selectedBase, opts);
    const storyboardCards = ensureArray(rawTimeline.cards).length ? rawTimeline.cards : visibleBaseCards;
    const selected = cardByKey(storyboardCards, selectedKey) || selectedBase;
    const timeline = buildScopedTimeline(projectIndex, rawTimeline, selected, opts);
    const view = normalizeView(opts.view);
    const chain = buildChain(projectIndex, storyboardCards, selected, model, opts);
    const storyContext = buildStoryContext(projectIndex, storyboardCards, selected, timeline, chain);
    const displaySelectedKey = view === 'chain' && chainCardByKey(chain, opts.selected) ? String(opts.selected) : selectedKey;
    const paletteSelected = cardByKey(allCards, displaySelectedKey) || cardByKey(allCards, selectedKey) || selected;
    const paletteRawTimeline = buildTimeline(projectIndex, allCards, paletteSelected, opts);
    const paletteTimeline = buildScopedTimeline(projectIndex, paletteRawTimeline, paletteSelected, opts);
    const paletteChain = buildChain(projectIndex, allCards, paletteSelected, model, opts);
    const palette = buildPalette({
      view,
      canvasCategory: {
        key: canvasCategory,
        totalCardCount: allCards.length,
        storyObjectCount: categorySummary.storyObjectCount,
        cardObjectCount: categorySummary.cardObjectCount,
        visibleCardCount: allCards.length,
        hiddenCardCount: categorySummary.hiddenCardCount
      },
      search: {
        query: searchQuery,
        matchCount: searchQuery ? searchMatches.length : 0,
        active: Boolean(searchQuery)
      },
      selectedKey: displaySelectedKey,
      currentKey: current.key,
      projectIndex,
      cards: allCards,
      timeline: paletteTimeline,
      chain: paletteChain,
      storyContext
    }, opts);
    return {
      schemaVersion: '0.1',
      kind: 'content_storyboard_model',
      view,
      selectedKey: displaySelectedKey,
      currentKey: current.key,
      canvasCategory: Object.assign({}, categorySummary, {
        visibleCardCount: storyboardCards.length
      }),
      search: {
        query: searchQuery,
        matchCount: searchQuery ? searchMatches.length : 0,
        active: Boolean(searchQuery)
      },
      cards: storyboardCards,
      timeline,
      chain,
      storyContext,
      palette,
      editor: buildEditor(projectIndex, model, selected, timeline.profile, storyContext),
      metrics: {
        cardCount: storyboardCards.length,
        allCardCount: allCards.length,
        hiddenByCategoryCount: categorySummary.hiddenCardCount,
        searchMatchCount: searchQuery ? searchMatches.length : 0,
        branchCount: draftBranches.length,
        edgeCount: ensureArray(projectIndex && projectIndex.edges).length,
        visibleCardCount: timeline.storyScope && timeline.storyScope.visibleCardCount || storyboardCards.length,
        chainConnectorCount: ensureArray(chain && chain.connectors).length,
        paletteEntryCount: palette && palette.metrics && palette.metrics.visibleEntryCount || 0
      }
    };
  }

  function collectProjectCards(projectIndex, current) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const textByScene = textCorpusByScene(index);
    const cards = [];
    ensureArray(index.scenes).forEach((scene) => {
      if (!scene || !scene.id) {
        return;
      }
      const kind = sceneKind(scene);
      if (kind !== 'event' && kind !== 'card' && kind !== 'advisor') {
        return;
      }
      const sceneText = textByScene.get(String(scene.id)) || {};
      const title = firstNonEmpty(sceneText.title, scene.title, scene.id);
      const body = firstNonEmpty(sceneText.body, scene.summary, scene.description, scene.subtitle, scene.path);
      cards.push({
        key: kind + ':' + scene.id,
        id: String(scene.id),
        kind,
        title,
        body,
        schedule: scheduleForScene(scene),
        source: sourceRef(scene.sourceSpan || scene.source || {path: scene.path}),
        routeTargets: routeTargets(scene, sceneText),
        storyText: {
          title,
          body,
          options: ensureArray(sceneText.optionLabels)
        },
        audioAssets: audioAssetsForScene(scene),
        stateTags: ['source'],
        editable: false,
        current: current && current.id === String(scene.id),
        raw: scene
      });
    });
    ensureArray(index.semantic && index.semantic.news && index.semantic.news.items).forEach((item, index) => {
      if (!item) {
        return;
      }
      const id = item.id || item.headline || 'news_' + (index + 1);
      cards.push({
        key: 'news:' + safeId(id),
        id: safeId(id),
        kind: 'news',
        title: item.headline || 'News',
        body: item.description || '',
        schedule: scheduleForNews(item),
        source: sourceRef(item.source),
        routeTargets: [],
        storyText: {title: item.headline || 'News', body: item.description || '', options: []},
        stateTags: ['source'],
        editable: false,
        current: false,
        raw: item
      });
    });
    return cards;
  }

  function currentCard(model) {
    const body = model.eventBody || {};
    const titleField = body.title || {};
    const sections = ensureArray(body.sections);
    const options = ensureArray(body.options);
    const draft = model.changeState && model.changeState.draft || {};
    const id = model.objectId || draft.id || draft.itemId || safeId(model.title || 'current_object');
    const kind = normalizeKind(model.objectKind || model.template || body.mode || draft.kind);
    return {
      key: model.mode === 'existing' ? kind + ':' + id : 'draft:' + kind + ':' + id,
      id: String(id || 'current_object'),
      kind,
      title: fieldValue(titleField, model.title || id || 'Current object'),
      body: sections.map((field) => fieldValue(field, '')).filter(Boolean).join('\n\n'),
      schedule: scheduleForModel(model),
      source: sourceRef(model.source),
      routeTargets: options.map((option) => ({
        id: option.targetId || option.id || '',
        label: option.label || option.title || option.id || ''
      })).filter((target) => target.id || target.label),
      storyText: {
        title: fieldValue(titleField, model.title || id || 'Current object'),
        body: sections.map((field) => fieldValue(field, '')).filter(Boolean).join('\n\n'),
        options: options.map((option) => option.label || option.title || option.id || '').filter(Boolean)
      },
      stateTags: [model.mode === 'existing' ? 'source' : 'draft'].concat(model.changeState && model.changeState.changedCount ? ['changed'] : []),
      fields: {
        title: titleField,
        heading: body.heading || null,
        sections,
        options,
        metaFields: ensureArray(body.metaFields)
      },
      editable: true,
      current: true,
      raw: draft
    };
  }

  function draftBranchCard(branch, model, index) {
    const value = isObject(branch) ? branch : {};
    const draft = isObject(value.draft) ? value.draft : {};
    const id = value.id || draft.id || 'branch_' + (index + 1);
    const kind = normalizeKind(value.template || draft.kind || 'event');
    return {
      key: 'draft:' + id,
      id: String(id),
      kind,
      title: value.title || draft.title || draft.heading || draft.headline || 'New branch',
      body: value.detail || draft.description || '',
      schedule: scheduleForDraft(draft, scheduleForModel(model)),
      source: {path: 'draft workspace'},
      routeTargets: [],
      storyText: {title: value.title || draft.title || draft.heading || draft.headline || 'New branch', body: value.detail || draft.description || '', options: []},
      stateTags: ['draft'],
      insertionContext: value.insertionContext || draft.studioAuthoringContext || null,
      editable: false,
      current: false,
      draftBranch: true,
      raw: draft
    };
  }

  function buildTimeline(projectIndex, cards, selected, options) {
    const adapter = timelineAdapterApi();
    if (adapter && typeof adapter.buildTimeline === 'function') {
      return adapter.buildTimeline(projectIndex, cards, selected, options);
    }
    const scheduled = cards.slice().sort(compareBySchedule);
    const years = scheduled.map((card) => Number(card.schedule && card.schedule.year || 0)).filter(Boolean);
    const selectedYear = Number(selected && selected.schedule && selected.schedule.year || 0);
    const startYear = years.length ? Math.min.apply(Math, years.concat(selectedYear || [])) : selectedYear || 1936;
    const endYear = years.length ? Math.max.apply(Math, years.concat(selectedYear || [])) : selectedYear || 1936;
    const focusStart = selectedYear ? Math.min(selectedYear, startYear) : startYear;
    const lanes = [];
    for (let year = focusStart; year <= Math.max(endYear, focusStart + 2); year += 1) {
      lanes.push({
        year,
        cards: scheduled.filter((card) => Number(card.schedule && card.schedule.year || 0) === year)
      });
      if (lanes.length >= 8) {
        break;
      }
    }
    if (!lanes.some((lane) => lane.cards.length)) {
      lanes[0].cards = scheduled.slice(0, 8);
    }
    const undated = scheduled.filter((card) => !Number(card.schedule && card.schedule.year || 0));
    return {
      profile: {mode: 'year_month', unitLabel: 'Year', laneLabel: 'Year', source: 'legacy', lanes: [], rules: []},
      range: {startYear: lanes[0] && lanes[0].year || startYear, endYear: lanes[lanes.length - 1] && lanes[lanes.length - 1].year || endYear},
      lanes,
      undated,
      cards,
      insertionPoints: lanes.map((lane) => ({
        key: 'time:' + lane.year,
        year: lane.year,
        label: String(lane.year)
      }))
    };
  }

  function buildChain(projectIndex, cards, selected, model, options) {
    const api = storyChainApi();
    if (api && typeof api.buildChain === 'function') {
      return api.buildChain(projectIndex, cards, selected, model, options || {});
    }
    return {
      levels: [
        {key: 'upstream', label: 'Before', cards: []},
        {key: 'selected', label: 'Selected beat', cards: selected ? [selected] : []},
        {key: 'routes', label: 'Choices and routes', cards: []},
        {key: 'branches', label: 'Branches and inserts', cards: cards.filter((card) => card.draftBranch)}
      ],
      connectors: [],
      insertionPoints: [
        {key: 'before', label: 'Insert before selected beat', action: 'counterfactual'},
        {key: 'after', label: 'Create follow-up after selected beat', action: 'followup'},
        {key: 'branch', label: 'Create counterfactual branch', action: 'counterfactual'}
      ]
    };
  }

  function buildEditor(projectIndex, model, selected, profile, storyContext) {
    const board = model.contextBoard || {};
    const source = selected && selected.source || {};
    const placement = selected && selected.timelinePlacement || null;
    return {
      identity: [
        pair('ID', selected && selected.id),
        pair('Kind', selected && selected.kind),
        pair('Timeline', placement && placement.label || formatSchedule(selected && selected.schedule)),
        pair('Profile', profile && profile.unitLabel),
        pair('Source', source.path ? source.path + (source.line ? ':' + source.line : '') : '')
      ].filter((row) => row.value),
      timelinePlacement: placement,
      storyContext: storyContext || null,
      context: {
        flow: ensureArray(board.flow),
        variables: ensureArray(board.variables),
        effects: ensureArray(board.effects),
        sourceEvidence: ensureArray(board.sourceEvidence),
        manualBoundaries: ensureArray(board.manualBoundaries)
      },
      projectSummary: {
        scenes: ensureArray(projectIndex && projectIndex.scenes).length,
        edges: ensureArray(projectIndex && projectIndex.edges).length,
        variables: ensureArray(projectIndex && projectIndex.variables).length
      }
    };
  }

  function dedupeCards(cards) {
    const seen = new Set();
    const out = [];
    ensureArray(cards).forEach((card) => {
      if (!card || !card.key) {
        return;
      }
      if (seen.has(card.key)) {
        if (card.current) {
          const existing = out.findIndex((item) => item.key === card.key);
          if (existing >= 0) {
            out[existing] = card;
          }
        }
        return;
      }
      seen.add(card.key);
      out.push(card);
    });
    return out;
  }

  function cardByKey(cards, key) {
    const text = String(key || '');
    return ensureArray(cards).find((card) => card.key === text) || null;
  }

  function chainCardByKey(chain, key) {
    const text = String(key || '');
    if (!text) {
      return null;
    }
    const levels = ensureArray(chain && chain.levels);
    for (let index = 0; index < levels.length; index += 1) {
      const found = cardByKey(levels[index] && levels[index].cards, text);
      if (found) {
        return found;
      }
    }
    return null;
  }

  function filterCardsForCanvas(cards, category, currentKey) {
    const normalized = normalizeCanvasCategory(category);
    const selectedKey = String(currentKey || '');
    return ensureArray(cards).filter((card) => {
      if (!card || !card.key) {
        return false;
      }
      if (card.key === selectedKey) {
        return true;
      }
      if (normalized === 'all') {
        return true;
      }
      if (normalized === 'cards') {
        return isCardCanvasKind(card.kind);
      }
      return isStoryCanvasKind(card.kind);
    });
  }

  function isStoryCanvasKind(kind) {
    const text = String(kind || '');
    return text === 'event' || text === 'news' || text === 'surface';
  }

  function isCardCanvasKind(kind) {
    const text = String(kind || '');
    return text === 'card' || text === 'advisor';
  }

  function cardMatchesSearch(card, query) {
    if (!query) {
      return true;
    }
    const source = card && card.source || {};
    const haystack = [
      card && card.key,
      card && card.id,
      card && card.kind,
      card && card.title,
      card && card.body,
      source.path,
      source.line,
      ensureArray(card && card.routeTargets).map((target) => [target.id, target.label].filter(Boolean).join(' ')).join(' ')
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.indexOf(query) >= 0;
  }

  function routeTargets(scene, sceneText) {
    const optionLabels = ensureArray(sceneText && sceneText.optionLabels);
    const targets = ensureArray(scene && scene.options).map((option, index) => {
      const id = option && option.target && option.target.id || option && option.targetId || '';
      const fromText = optionLabels.find((item) => item.itemId && String(item.itemId) === String(id)) || optionLabels[index] || null;
      return {
        id,
        label: option && (option.title || option.label) || fromText && fromText.text || ''
      };
    }).filter((item) => item.id || item.label);
    optionLabels.forEach((item) => {
      if (item.itemId && targets.some((target) => String(target.id) === String(item.itemId))) {
        return;
      }
      if (item.text) {
        targets.push({id: item.itemId || '', label: item.text});
      }
    });
    return targets;
  }

  function scheduleForModel(model) {
    const draft = model && model.changeState && model.changeState.draft || {};
    const fromDraft = scheduleForDraft(draft, {});
    if (fromDraft.year) {
      return fromDraft;
    }
    const body = model && model.eventBody || {};
    const fields = ensureArray(body.metaFields);
    const year = fieldById(fields, 'event.year');
    const monthStart = fieldById(fields, 'event.monthStart');
    const monthEnd = fieldById(fields, 'event.monthEnd');
    if (year && year.value) {
      return {
        year: numberOr(year.value, 0),
        monthStart: numberOr(monthStart && monthStart.value, 1),
        monthEnd: numberOr(monthEnd && monthEnd.value, numberOr(monthStart && monthStart.value, 1))
      };
    }
    const condition = fieldById(fields, 'metadata_viewIf') || fields.find((field) => field && field.role === 'condition');
    const fromCondition = scheduleFromCondition(fieldValue(condition, ''));
    if (fromCondition.year) {
      return fromCondition;
    }
    return scheduleForScene(model && model.rawContext && model.rawContext.scene || {});
  }

  function scheduleForDraft(draft, fallback) {
    const value = isObject(draft) ? draft : {};
    const when = isObject(value.when) ? value.when : value;
    const year = numberOr(value.year || when.year, 0);
    if (!year) {
      return fallback || {};
    }
    return {
      year,
      monthStart: numberOr(value.monthStart || when.monthStart || when.month, 1),
      monthEnd: numberOr(value.monthEnd || when.monthEnd || when.month, numberOr(value.monthStart || when.monthStart || when.month, 1))
    };
  }

  function scheduleForScene(scene) {
    const value = isObject(scene) ? scene : {};
    const explicit = scheduleFromObject(value);
    if (explicit.year) {
      return explicit;
    }
    return scheduleFromCondition(value.viewIf || value.chooseIf || value.requires || value.condition || '');
  }

  function scheduleForNews(item) {
    const value = isObject(item) ? item : {};
    const when = isObject(value.when) ? value.when : value;
    const year = numberOr(value.year || when.year, 0);
    const month = numberOr(value.month || when.month, 0);
    return year ? {year, monthStart: month || 1, monthEnd: month || 1} : {};
  }

  function scheduleFromCondition(condition) {
    const text = String(condition || '');
    const yearMatch = text.match(/\byear\s*(?:={1,3})\s*(\d{4})/);
    const monthEq = text.match(/\bmonth\s*(?:={1,3})\s*(\d{1,2})/);
    const monthStart = text.match(/\bmonth\s*>=\s*(\d{1,2})/);
    const monthEnd = text.match(/\bmonth\s*<=\s*(\d{1,2})/);
    const out = {};
    if (yearMatch) {
      out.year = Number(yearMatch[1]);
    }
    if (monthEq) {
      out.monthStart = Number(monthEq[1]);
      out.monthEnd = Number(monthEq[1]);
    } else {
      if (monthStart) {
        out.monthStart = Number(monthStart[1]);
      }
      if (monthEnd) {
        out.monthEnd = Number(monthEnd[1]);
      }
    }
    return out;
  }

  function scheduleFromObject(value) {
    const raw = isObject(value) ? value : {};
    const when = isObject(raw.when) ? raw.when : {};
    const year = numberOr(raw.year || when.year || raw.startYear || raw.yearStart, 0);
    if (!year) {
      return {};
    }
    const monthStart = numberOr(
      raw.monthStart || raw.startMonth || raw.month || when.monthStart || when.startMonth || when.month,
      1
    );
    const monthEnd = numberOr(
      raw.monthEnd || raw.endMonth || raw.month || when.monthEnd || when.endMonth || when.month,
      monthStart
    );
    return {year, monthStart, monthEnd};
  }

  function formatSchedule(schedule) {
    const value = schedule || {};
    if (!value.year) {
      return '';
    }
    const start = value.monthStart || '';
    const end = value.monthEnd || '';
    const months = start && end ? (start === end ? String(start) : start + '-' + end) : '';
    return [value.year, months ? 'month ' + months : ''].filter(Boolean).join(' / ');
  }

  function compareBySchedule(a, b) {
    return Number(a.schedule && a.schedule.year || 9999) - Number(b.schedule && b.schedule.year || 9999) ||
      Number(a.schedule && a.schedule.monthStart || 99) - Number(b.schedule && b.schedule.monthStart || 99) ||
      String(a.title || '').localeCompare(String(b.title || ''));
  }

  function timelineAdapterApi() {
    if (global && global.ProjectMapTimelineCoordinateAdapter) {
      return global.ProjectMapTimelineCoordinateAdapter;
    }
    if (typeof require === 'function') {
      try {
        return require('./timeline_coordinate_adapter.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function buildScopedTimeline(projectIndex, timeline, selected, options) {
    const api = storyScopeApi();
    return api && typeof api.buildScopedTimeline === 'function'
      ? api.buildScopedTimeline(projectIndex, timeline, selected, options || {})
      : timeline;
  }

  function storyScopeApi() {
    if (global && global.ProjectMapStoryScopeModel) {
      return global.ProjectMapStoryScopeModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./story_scope_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function storyChainApi() {
    if (global && global.ProjectMapStoryChainGraphModel) {
      return global.ProjectMapStoryChainGraphModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./story_chain_graph_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function buildStoryContext(projectIndex, cards, selected, timeline, chain) {
    const api = storyContextApi();
    return api && typeof api.buildContext === 'function'
      ? api.buildContext(projectIndex, cards, selected, timeline, chain)
      : null;
  }

  function buildPalette(storyboard, options) {
    const api = storyPaletteApi();
    return api && typeof api.buildPalette === 'function'
      ? api.buildPalette(storyboard, options || {})
      : {groups: [], open: false, query: '', type: 'all', metrics: {visibleEntryCount: 0}};
  }

  function storyContextApi() {
    if (global && global.ProjectMapContentStoryboardContext) {
      return global.ProjectMapContentStoryboardContext;
    }
    if (typeof require === 'function') {
      try {
        return require('./content_storyboard_context.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function storyPaletteApi() {
    if (global && global.ProjectMapStoryPaletteModel) {
      return global.ProjectMapStoryPaletteModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./story_palette_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function textCorpusByScene(projectIndex) {
    const out = new Map();
    ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic.textCorpus && projectIndex.semantic.textCorpus.items).forEach((item) => {
      const owner = item && item.owner || {};
      const sceneId = String(owner.sceneId || item && item.sceneId || '');
      if (!sceneId) {
        return;
      }
      if (!out.has(sceneId)) {
        out.set(sceneId, {title: '', body: '', optionLabels: []});
      }
      const bucket = out.get(sceneId);
      const role = String(item.role || item.kind || '').toLowerCase();
      const text = String(item.text || item.value || '').trim();
      if (!text) {
        return;
      }
      if (!bucket.title && (role === 'title' || role === 'heading' || role.indexOf('title') >= 0)) {
        bucket.title = text;
        return;
      }
      if (role.indexOf('option') >= 0) {
        bucket.optionLabels.push({
          id: item.id || '',
          text,
          itemId: owner.itemId || item.optionId || ''
        });
        return;
      }
      if (!bucket.body && (role === 'body' || role === 'page' || role === 'section' || role === 'description' || role.indexOf('body') >= 0)) {
        bucket.body = text;
      }
    });
    return out;
  }

  function fieldById(fields, id) {
    return ensureArray(fields).find((field) => field && field.id === id) || null;
  }

  function fieldValue(field, fallback) {
    if (!field) {
      return String(fallback || '');
    }
    return String(field.value !== undefined ? field.value : field.original !== undefined ? field.original : fallback || '');
  }

  function musicStateApi() {
    if (global && global.ProjectMapMusicStateModel) {
      return global.ProjectMapMusicStateModel;
    }
    if (typeof require === 'function') {
      try { return require('./music_state_model.js'); } catch (_err) { /* optional */ }
    }
    return null;
  }

  function enrichCardsWithMusicState(cards, projectIndex) {
    var api = musicStateApi();
    if (!api || typeof api.computeMusicState !== 'function') { return; }
    try {
      var stateMap = api.computeMusicState(projectIndex);
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var entry = stateMap.get(card.id);
        if (entry) {
          card.musicState = entry;
        }
      }
    } catch (_err) {
      // Gracefully degrade: skip music state if computation fails
    }
  }

  function audioAssetsForScene(scene) {
    const refs = ensureArray(scene && scene.assetRefs);
    const results = [];
    for (var i = 0; i < refs.length; i++) {
      var ref = refs[i];
      if (!isObject(ref)) { continue; }
      var directive = String(ref.directive || ref.assetDirective || '').trim().toLowerCase();
      var type = String(ref.type || '').trim().toLowerCase();
      if (directive !== 'set-music' && directive !== 'audio' && type !== 'audio') { continue; }
      var path = String(ref.path || ref.src || ref.url || '').trim();
      if (!path) { continue; }
      var parts = path.split(/[\\/]/);
      var name = parts[parts.length - 1] || path;
      results.push({
        name: name,
        directive: directive || 'audio',
        modifiers: ensureArray(ref.audioModifiers),
        groupId: String(ref.audioGroupId || '')
      });
    }
    return results;
  }

  function sceneKind(scene) {
    const value = isObject(scene) ? scene : {};
    if (value.flags && value.flags.isPinnedCard || value.type === 'pinned_card' || value.type === 'advisor') {
      return 'advisor';
    }
    if (value.flags && value.flags.isCard || value.type === 'card') {
      return 'card';
    }
    return 'event';
  }

  function normalizeKind(kind) {
    const text = String(kind || '').trim();
    if (text === 'world_event' || text === 'existing') {
      return 'event';
    }
    if (text === 'news_item') {
      return 'news';
    }
    if (text === 'surface_text') {
      return 'surface';
    }
    return text || 'event';
  }

  function normalizeCanvasCategory(value) {
    const text = String(value || 'story').trim();
    return text === 'cards' || text === 'all' ? text : 'story';
  }

  function normalizeSearchQuery(value) {
    return String(value || '').trim().toLowerCase().slice(0, 80);
  }

  function normalizeView(view) {
    var v = String(view || '');
    return v === 'chain' ? 'chain' : v === 'spatial' ? 'spatial' : 'timeline';
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    return {
      path: String(value.path || ''),
      line: value.line || value.startLine || '',
      endLine: value.endLine || ''
    };
  }

  function pair(label, value) {
    return {label, value: String(value || '')};
  }

  function firstNonEmpty() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value);
      }
    }
    return '';
  }

  function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : Number(fallback || 0);
  }

  function safeId(value) {
    return String(value || 'item').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {
    buildStoryboard,
    formatSchedule,
    scheduleFromCondition
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapContentStoryboardModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
