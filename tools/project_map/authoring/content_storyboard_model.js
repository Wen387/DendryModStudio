(function initProjectMapContentStoryboardModel(global) {
  'use strict';

  function buildStoryboard(projectIndex, objectModel, options) {
    const opts = isObject(options) ? options : {};
    const model = isObject(objectModel) ? objectModel : {};
    const draftBranches = ensureArray(opts.draftBranches).map((branch, index) => draftBranchCard(branch, model, index));
    const current = currentCard(model);
    const cards = collectProjectCards(projectIndex, current).concat([current]).concat(draftBranches);
    const deduped = dedupeCards(cards);
    const selectedKey = cardByKey(deduped, opts.selected) ? String(opts.selected) : current.key;
    const selected = cardByKey(deduped, selectedKey) || current;
    const view = normalizeView(opts.view);
    return {
      schemaVersion: '0.1',
      kind: 'content_storyboard_model',
      view,
      selectedKey,
      currentKey: current.key,
      cards: deduped,
      timeline: buildTimeline(deduped, selected),
      chain: buildChain(projectIndex, deduped, selected, model),
      editor: buildEditor(projectIndex, model, selected),
      metrics: {
        cardCount: deduped.length,
        branchCount: draftBranches.length,
        edgeCount: ensureArray(projectIndex && projectIndex.edges).length
      }
    };
  }

  function collectProjectCards(projectIndex, current) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const cards = [];
    ensureArray(index.scenes).forEach((scene) => {
      if (!scene || !scene.id) {
        return;
      }
      const kind = sceneKind(scene);
      if (kind !== 'event' && kind !== 'card' && kind !== 'advisor') {
        return;
      }
      cards.push({
        key: kind + ':' + scene.id,
        id: String(scene.id),
        kind,
        title: scene.title || scene.id,
        body: firstNonEmpty(scene.summary, scene.description, scene.subtitle, scene.path),
        schedule: scheduleForScene(scene),
        source: sourceRef(scene.sourceSpan || scene.source || {path: scene.path}),
        routeTargets: routeTargets(scene),
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
      editable: false,
      current: false,
      draftBranch: true,
      raw: draft
    };
  }

  function buildTimeline(cards, selected) {
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
      range: {startYear: lanes[0] && lanes[0].year || startYear, endYear: lanes[lanes.length - 1] && lanes[lanes.length - 1].year || endYear},
      lanes,
      undated,
      insertionPoints: lanes.map((lane) => ({
        key: 'time:' + lane.year,
        year: lane.year,
        label: String(lane.year)
      }))
    };
  }

  function buildChain(projectIndex, cards, selected, model) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const byId = new Map();
    cards.forEach((card) => {
      if (card.id) {
        byId.set(String(card.id), card);
      }
    });
    const selectedId = String(selected && selected.id || model.objectId || '');
    const upstream = [];
    const downstream = [];
    ensureArray(index.edges).forEach((edge) => {
      const from = String(edge && edge.from || '');
      const to = String(edge && edge.to || '');
      if (to === selectedId) {
        upstream.push(edgeCard(byId, from, edge, 'upstream'));
      } else if (from === selectedId) {
        downstream.push(edgeCard(byId, to, edge, 'downstream'));
      }
    });
    const optionTargets = ensureArray(selected && selected.routeTargets).map((target, index) => ({
      key: 'option:' + selected.key + ':' + index,
      id: target.id || 'option_' + (index + 1),
      kind: 'route',
      title: target.label || target.id || 'Option route',
      body: target.id ? 'go to ' + target.id : '',
      route: true,
      editable: false
    }));
    const branches = cards.filter((card) => card.draftBranch);
    return {
      levels: [
        {key: 'upstream', label: 'Before', cards: uniqueCards(upstream)},
        {key: 'selected', label: 'Selected beat', cards: [selected]},
        {key: 'routes', label: 'Choices and routes', cards: optionTargets.concat(uniqueCards(downstream))},
        {key: 'branches', label: 'Branches and inserts', cards: branches}
      ],
      insertionPoints: [
        {key: 'before', label: 'Insert before selected beat', action: 'counterfactual'},
        {key: 'after', label: 'Create follow-up after selected beat', action: 'followup'},
        {key: 'branch', label: 'Create counterfactual branch', action: 'counterfactual'}
      ]
    };
  }

  function buildEditor(projectIndex, model, selected) {
    const board = model.contextBoard || {};
    const source = selected && selected.source || {};
    return {
      identity: [
        pair('ID', selected && selected.id),
        pair('Kind', selected && selected.kind),
        pair('Time', formatSchedule(selected && selected.schedule)),
        pair('Source', source.path ? source.path + (source.line ? ':' + source.line : '') : '')
      ].filter((row) => row.value),
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

  function edgeCard(byId, id, edge, direction) {
    const found = byId.get(String(id || ''));
    if (found) {
      return found;
    }
    return {
      key: direction + ':' + id,
      id: String(id || direction),
      kind: 'event',
      title: String(id || 'Unknown beat'),
      body: [edge && edge.kind, edge && edge.label].filter(Boolean).join(' / '),
      schedule: {},
      source: sourceRef(edge && edge.source),
      routeTargets: [],
      editable: false
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

  function uniqueCards(cards) {
    return dedupeCards(ensureArray(cards));
  }

  function cardByKey(cards, key) {
    const text = String(key || '');
    return ensureArray(cards).find((card) => card.key === text) || null;
  }

  function routeTargets(scene) {
    return ensureArray(scene && scene.options).map((option) => ({
      id: option && option.target && option.target.id || option && option.targetId || '',
      label: option && (option.title || option.label) || ''
    })).filter((item) => item.id || item.label);
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

  function fieldById(fields, id) {
    return ensureArray(fields).find((field) => field && field.id === id) || null;
  }

  function fieldValue(field, fallback) {
    if (!field) {
      return String(fallback || '');
    }
    return String(field.value !== undefined ? field.value : field.original !== undefined ? field.original : fallback || '');
  }

  function sceneKind(scene) {
    const value = isObject(scene) ? scene : {};
    if (value.flags && value.flags.isCard || value.type === 'card') {
      return 'card';
    }
    if (value.flags && value.flags.isPinnedCard || value.type === 'pinned_card') {
      return 'advisor';
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

  function normalizeView(view) {
    return String(view || '') === 'chain' ? 'chain' : 'timeline';
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
