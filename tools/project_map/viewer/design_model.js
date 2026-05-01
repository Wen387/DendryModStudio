(function initProjectMapDesignModel(global) {
  'use strict';

  const COMPARE_STATUSES = ['same', 'added', 'missing_from_current', 'changed', 'unknown', 'no_baseline'];
  const LANE_DEFS = [
    {id: 'timeline_events', label: 'Timeline Events'},
    {id: 'cards_advisors', label: 'Cards / Advisor-like'},
    {id: 'news', label: 'News'},
    {id: 'surface_sidebar', label: 'Surface Text / Sidebar'},
    {id: 'manual_review', label: 'Manual Review / Escape Hatch'}
  ];
  const CONFIDENCE_RANK = {
    exact: 0,
    static_inferred: 1,
    profile_heuristic: 2,
    opaque: 3
  };

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function confidenceRank(value) {
    return CONFIDENCE_RANK[String(value || '')] ?? 9;
  }

  function highConfidence(item) {
    return confidenceRank(item && item.confidence) <= CONFIDENCE_RANK.static_inferred;
  }

  function firstSource(item) {
    if (!item) {
      return null;
    }
    return item.source || item.sourceSpan || (item.scene && item.scene.sourceSpan) || null;
  }

  function sourceLine(source) {
    return source && (source.line || source.startLine) ? String(source.line || source.startLine) : '';
  }

  function sourceKey(source) {
    if (!source || !source.path) {
      return '';
    }
    return source.path + ':' + sourceLine(source);
  }

  function fingerprintValue(item) {
    const fingerprint = item && item.sourceFingerprint;
    if (!fingerprint) {
      return '';
    }
    if (typeof fingerprint === 'string') {
      return fingerprint;
    }
    if (isObject(fingerprint)) {
      return String(fingerprint.value || fingerprint.sha256 || fingerprint.hash || '');
    }
    return '';
  }

  function sceneFor(model, item) {
    if (!item) {
      return null;
    }
    if (item.scene) {
      return item.scene;
    }
    if (item.id && model && model.scenesById && model.scenesById.has(String(item.id))) {
      return model.scenesById.get(String(item.id));
    }
    return item;
  }

  function itemTitle(item) {
    return item.title || item.heading || item.headline || item.label || item.id || '(untitled)';
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
    if (!schedule || (!schedule.year && !schedule.monthStart && !schedule.monthEnd)) {
      return '';
    }
    const months = schedule.monthStart && schedule.monthEnd
      ? (schedule.monthStart === schedule.monthEnd ? String(schedule.monthStart) : schedule.monthStart + '-' + schedule.monthEnd)
      : '';
    return [schedule.year || '', months ? 'month ' + months : ''].filter(Boolean).join(' / ');
  }

  function diagnosticsForScene(model, sceneId, source) {
    const byScene = sceneId && model && model.diagnosticsByScene
      ? ensureArray(model.diagnosticsByScene.get(String(sceneId)))
      : [];
    const byPath = source && source.path && model && model.diagnosticsByPath
      ? ensureArray(model.diagnosticsByPath.get(String(source.path)))
      : [];
    const seen = new Set();
    return byScene.concat(byPath).filter((diag) => {
      const key = [diag.code, diag.path, diag.sceneId, sourceLine(diag.source)].join(':');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function severityRank(value) {
    if (value === 'error') {
      return 3;
    }
    if (value === 'warning') {
      return 2;
    }
    if (value === 'info') {
      return 1;
    }
    return 0;
  }

  function itemSeverity(item) {
    const diagnostics = ensureArray(item && item.diagnostics);
    if (!diagnostics.length) {
      return 'none';
    }
    return diagnostics.reduce((highest, diagnostic) => {
      const severity = diagnostic && diagnostic.severity ? diagnostic.severity : 'info';
      return severityRank(severity) > severityRank(highest) ? severity : highest;
    }, 'none');
  }

  function variablesForScene(model, scene) {
    if (!model || !scene || !scene.path) {
      return [];
    }
    return ensureArray(variableAccessesByPath(model).get(scene.path)).slice(0, 24);
  }

  function variableAccessesByPath(model) {
    if (!model) {
      return new Map();
    }
    if (model.variableAccessesByPath instanceof Map) {
      return model.variableAccessesByPath;
    }
    if (model._designVariableAccessesByPath instanceof Map) {
      return model._designVariableAccessesByPath;
    }
    const byPath = new Map();
    function add(ref, entry) {
      if (!ref || !ref.path) {
        return;
      }
      const key = String(ref.path);
      if (!byPath.has(key)) {
        byPath.set(key, []);
      }
      byPath.get(key).push(entry);
    }
    ensureArray(model.variables).forEach((variable) => {
      const name = variable && variable.name ? String(variable.name) : '';
      if (!name) {
        return;
      }
      ensureArray(variable.reads).forEach((ref) => add(ref, {name, access: 'read', source: ref}));
      ensureArray(variable.writes).forEach((ref) => add(ref, {name, access: 'write', source: ref}));
    });
    model._designVariableAccessesByPath = byPath;
    return byPath;
  }

  function compareKeyForSurface(item) {
    const source = firstSource(item) || {};
    return [
      'surface_text',
      item.area || '',
      item.label || '',
      item.variableName || '',
      source.path || '',
      sourceLine(source)
    ].join(':');
  }

  function compareKeyForNews(item) {
    const source = firstSource(item) || {};
    return [
      'news',
      item.delivery || 'unknown',
      item.slot || item.pool || '',
      item.headline || '',
      source.path || '',
      sourceLine(source)
    ].join(':');
  }

  function makeSceneItem(model, item, kind, laneId, label) {
    const scene = sceneFor(model, item);
    const source = firstSource(scene) || firstSource(item);
    const schedule = scheduleFromCondition(scene && (scene.viewIf || scene.chooseIf || scene.requires));
    const confidence = item.confidence || scene.confidence || scene.classificationConfidence || 'profile_heuristic';
    const key = kind + ':' + (scene.id || item.id || item.path || itemTitle(item));
    return {
      key,
      compareKey: key,
      kind,
      laneId,
      laneLabel: label,
      title: itemTitle(scene),
      subtitle: formatSchedule(schedule) || scene.path || '',
      detail: scene.path || '',
      sceneId: scene.id || '',
      source,
      sourceFingerprint: scene.sourceFingerprint || null,
      confidence,
      tags: ensureArray(scene.tags),
      diagnostics: diagnosticsForScene(model, scene.id, source),
      variables: variablesForScene(model, scene),
      schedule,
      raw: item,
      scene,
      present: true
    };
  }

  function makeNewsItem(item) {
    const source = firstSource(item);
    const year = Number(item.year || (item.when && item.when.year)) || null;
    const month = Number(item.month || (item.when && item.when.month)) || null;
    const schedule = year || month
      ? {year, monthStart: month, monthEnd: month}
      : {};
    return {
      key: compareKeyForNews(item),
      compareKey: compareKeyForNews(item),
      kind: 'news',
      laneId: 'news',
      laneLabel: 'News',
      title: item.headline || '(empty news item)',
      subtitle: [formatSchedule(schedule), item.delivery || '', item.slot || item.pool || ''].filter(Boolean).join(' / '),
      detail: item.description || '',
      source,
      sourceFingerprint: null,
      confidence: item.confidence || 'static_inferred',
      diagnostics: [],
      variables: [],
      schedule,
      raw: item,
      present: true
    };
  }

  function makeSurfaceItem(item) {
    const source = firstSource(item);
    const escapeHatch = item.editability === 'ide_escape_hatch';
    return {
      key: compareKeyForSurface(item),
      compareKey: compareKeyForSurface(item),
      kind: 'surface_text',
      laneId: escapeHatch ? 'manual_review' : 'surface_sidebar',
      laneLabel: escapeHatch ? 'Manual Review / Escape Hatch' : 'Surface Text / Sidebar',
      title: item.label || item.id || '(surface text)',
      subtitle: item.area || '',
      detail: item.reason || item.originalText || '',
      source,
      sourceFingerprint: null,
      confidence: item.confidence || 'profile_heuristic',
      diagnostics: [],
      variables: item.variableName ? [{name: item.variableName, access: 'surface', source}] : [],
      editability: item.editability || '',
      raw: item,
      present: true
    };
  }

  function collectItems(model) {
    if (!model) {
      return [];
    }
    const items = [];
    const eventPopups = ensureArray(model.lists && model.lists.eventPopups);
    const eventPopupBySceneId = new Map();
    eventPopups.forEach((popup) => {
      if (popup && popup.linkedSceneId && !eventPopupBySceneId.has(String(popup.linkedSceneId))) {
        eventPopupBySceneId.set(String(popup.linkedSceneId), popup);
      }
    });
    if (eventPopups.length) {
      const firstPopup = eventPopups[0] || {};
      const router = firstPopup.router || {};
      items.push({
        key: 'router:legacy_event_popup:event',
        compareKey: 'router:legacy_event_popup:event',
        kind: 'monthly_router',
        laneId: 'news',
        laneLabel: 'News',
        title: 'Monthly event router (#event)',
        subtitle: String(eventPopups.length) + ' monthly popups',
        detail: router.path || 'source/scenes/post_event.scene.dry',
        sceneId: '',
        source: router.path ? {path: router.path, line: router.line} : null,
        sourceFingerprint: null,
        confidence: firstPopup.confidence || 'static_inferred',
        diagnostics: [],
        variables: [],
        schedule: {},
        raw: {delivery: 'legacy_event_popup_router', eventPopupCount: eventPopups.length, router},
        routerHub: true,
        present: true
      });
    }
    const timelineSceneIds = new Set();
    ensureArray(model.lists && model.lists.events).forEach((event) => {
      const item = makeSceneItem(model, event, 'event', 'timeline_events', 'Timeline Events');
      const popup = eventPopupBySceneId.get(String(item.sceneId || ''));
      if (popup) {
        item.monthlyPopup = popup;
        item.tags = Array.from(new Set(ensureArray(item.tags).concat(['monthly_popup'])));
      }
      if (item.sceneId) {
        timelineSceneIds.add(item.sceneId);
      }
      items.push(item);
    });
    const seenCardKeys = new Set();
    ensureArray(model.lists && model.lists.cards).forEach((card) => {
      const scene = sceneFor(model, card);
      if (scene && scene.id && timelineSceneIds.has(String(scene.id))) {
        return;
      }
      const advisorLike = (scene.flags && scene.flags.isPinnedCard) || scene.type === 'pinned_card';
      const item = makeSceneItem(model, card, advisorLike ? 'advisor_like' : 'card', 'cards_advisors', 'Cards / Advisor-like');
      seenCardKeys.add(item.key);
      items.push(item);
    });
    ensureArray(model.lists && model.lists.pinnedCards).forEach((card) => {
      const item = makeSceneItem(model, card, 'advisor_like', 'cards_advisors', 'Cards / Advisor-like');
      if (!seenCardKeys.has(item.key)) {
        seenCardKeys.add(item.key);
        items.push(item);
      }
    });
    ensureArray(model.lists && model.lists.news)
      .filter((item) => item && item.headline && item.delivery !== 'legacy_event_popup')
      .forEach((item) => items.push(makeNewsItem(item)));
    ensureArray(model.lists && model.lists.surfaceText)
      .forEach((item) => items.push(makeSurfaceItem(item)));
    return items;
  }

  function computeCompareStatus(item, baselineItem, hasBaseline) {
    if (!hasBaseline) {
      return 'no_baseline';
    }
    if (item && !baselineItem) {
      return 'added';
    }
    if (!item && baselineItem) {
      return 'missing_from_current';
    }
    if (!item || !baselineItem) {
      return 'unknown';
    }
    const currentFp = fingerprintValue(item);
    const baselineFp = fingerprintValue(baselineItem);
    if (!currentFp || !baselineFp || !highConfidence(item) || !highConfidence(baselineItem)) {
      return 'unknown';
    }
    return currentFp === baselineFp ? 'same' : 'changed';
  }

  function cloneMissingItem(baselineItem) {
    return Object.assign({}, baselineItem, {
      key: baselineItem.key,
      present: false,
      baselineItem,
      raw: null,
      scene: null,
      diagnostics: baselineItem.diagnostics || [],
      variables: baselineItem.variables || []
    });
  }

  function sortItems(items) {
    const laneRank = new Map(LANE_DEFS.map((lane, index) => [lane.id, index]));
    return items.slice().sort((a, b) => {
      return (laneRank.get(a.laneId) ?? 99) - (laneRank.get(b.laneId) ?? 99) ||
        (a.schedule && a.schedule.year || 9999) - (b.schedule && b.schedule.year || 9999) ||
        (a.schedule && a.schedule.monthStart || 99) - (b.schedule && b.schedule.monthStart || 99) ||
        String(a.title || '').localeCompare(String(b.title || ''));
    });
  }

  function endpointSceneId(model, endpointId) {
    if (!model || endpointId === undefined || endpointId === null || endpointId === '') {
      return '';
    }
    const raw = String(endpointId);
    if (model.sceneIdsByEndpoint && model.sceneIdsByEndpoint.has(raw)) {
      return model.sceneIdsByEndpoint.get(raw);
    }
    return raw;
  }

  function laneRank(laneId) {
    const index = LANE_DEFS.findIndex((lane) => lane.id === laneId);
    return index >= 0 ? index : LANE_DEFS.length;
  }

  function graphNodeId(item) {
    return 'node:' + (item && item.key ? item.key : 'unknown');
  }

  function buildDesignGraph(projectModel, sortedItems) {
    const nodes = [];
    const itemBySceneId = new Map();
    const laneCounts = new Map();
    const minGraphWidth = 3800;
    const laneLayout = {
      timeline_events: {x: 240, columns: 3, gapX: 360, gapY: 215},
      cards_advisors: {x: 1480, columns: 3, gapX: 360, gapY: 215},
      news: {x: 240, columns: 2, gapX: 360, gapY: 190},
      surface_sidebar: {x: 2720, columns: 3, gapX: 320, gapY: 156},
      manual_review: {x: 2720, columns: 3, gapX: 320, gapY: 156}
    };
    const laneBaseY = {
      timeline_events: 130,
      cards_advisors: 130,
      news: 1480,
      surface_sidebar: 130,
      manual_review: 1620
    };
    ensureArray(sortedItems).forEach((item) => {
      const laneId = item.laneId || 'manual_review';
      const index = laneCounts.get(laneId) || 0;
      laneCounts.set(laneId, index + 1);
      const layout = laneLayout[laneId] || {x: 240 + laneRank(laneId) * 360, columns: 2, gapX: 340, gapY: 185};
      const column = index % layout.columns;
      const row = Math.floor(index / layout.columns);
      const node = {
        id: graphNodeId(item),
        key: item.key,
        compareKey: item.compareKey,
        item,
        title: item.title,
        subtitle: item.subtitle || item.detail || '',
        kind: item.kind,
        laneId,
        compareStatus: item.compareStatus || 'unknown',
        confidence: item.confidence || 'opaque',
        present: item.present !== false,
        source: item.source || null,
        sceneId: item.sceneId || '',
        x: layout.x + column * layout.gapX,
        y: (laneBaseY[laneId] || 120) + row * layout.gapY
      };
      nodes.push(node);
      if (item.sceneId && !itemBySceneId.has(String(item.sceneId))) {
        itemBySceneId.set(String(item.sceneId), node);
      }
    });

    const edgeSeen = new Set();
    const graphEdges = [];
    ensureArray(projectModel && projectModel.edges).forEach((edge, index) => {
      const fromSceneId = endpointSceneId(projectModel, edge.from);
      const toSceneId = endpointSceneId(projectModel, edge.to);
      const fromNode = itemBySceneId.get(String(fromSceneId));
      const toNode = itemBySceneId.get(String(toSceneId));
      if (!fromNode || !toNode || fromNode.id === toNode.id) {
        return;
      }
      const id = [fromNode.id, toNode.id, edge.kind || 'edge', edge.label || '', index].join('::');
      const dedupeKey = [fromNode.id, toNode.id, edge.kind || 'edge', edge.label || ''].join('::');
      if (edgeSeen.has(dedupeKey)) {
        return;
      }
      edgeSeen.add(dedupeKey);
      graphEdges.push({
        id,
        from: fromNode.id,
        to: toNode.id,
        fromKey: fromNode.key,
        toKey: toNode.key,
        fromSceneId,
        toSceneId,
        kind: edge.kind || 'edge',
        label: edge.label || '',
        condition: edge.condition || '',
        confidence: edge.confidence || 'static_inferred',
        source: edge.source || null,
        raw: edge
      });
    });

    const routerNode = nodes.find((node) => node.key === 'router:legacy_event_popup:event');
    if (routerNode) {
      nodes.forEach((node, index) => {
        if (!node.item || !node.item.monthlyPopup) {
          return;
        }
        const popup = node.item.monthlyPopup;
        graphEdges.push({
          id: routerNode.id + '::' + node.id + '::monthly_event_popup::' + index,
          from: routerNode.id,
          to: node.id,
          fromKey: routerNode.key,
          toKey: node.key,
          fromSceneId: '',
          toSceneId: node.sceneId || '',
          kind: 'monthly_event_popup',
          label: '#event',
          condition: popup.viewIf || '',
          confidence: popup.confidence || 'static_inferred',
          source: popup.router && popup.router.path ? {path: popup.router.path, line: popup.router.line} : null,
          raw: popup,
          hiddenByDefault: true
        });
      });
    }

    const maxX = nodes.reduce((value, node) => Math.max(value, Number(node.x || 0)), 0);
    const maxY = nodes.reduce((value, node) => Math.max(value, Number(node.y || 0)), 0);
    return {
      nodes,
      edges: graphEdges,
      width: Math.max(minGraphWidth, maxX + 420),
      height: Math.max(900, maxY + 180)
    };
  }

  function buildDesignModel(projectModel, baselineModel) {
    const hasBaseline = Boolean(baselineModel);
    const currentItems = collectItems(projectModel);
    const baselineItems = hasBaseline ? collectItems(baselineModel) : [];
    const currentByKey = new Map(currentItems.map((item) => [item.compareKey, item]));
    const baselineByKey = new Map(baselineItems.map((item) => [item.compareKey, item]));
    const items = currentItems.map((item) => {
      const baselineItem = baselineByKey.get(item.compareKey) || null;
      const compareStatus = computeCompareStatus(item, baselineItem, hasBaseline);
      return Object.assign({}, item, {baselineItem, compareStatus});
    });
    if (hasBaseline) {
      baselineItems.forEach((baselineItem) => {
        if (!currentByKey.has(baselineItem.compareKey)) {
          const missing = cloneMissingItem(baselineItem);
          missing.compareStatus = computeCompareStatus(null, baselineItem, true);
          items.push(missing);
        }
      });
    }
    const sortedItems = sortItems(items);
    const lanes = LANE_DEFS.map((lane) => {
      const laneItems = sortedItems.filter((item) => item.laneId === lane.id);
      return Object.assign({}, lane, {count: laneItems.length, items: laneItems});
    });
    const compare = COMPARE_STATUSES.reduce((counts, status) => {
      counts[status] = sortedItems.filter((item) => item.compareStatus === status).length;
      return counts;
    }, {});
    const graph = buildDesignGraph(projectModel, sortedItems);
    return {
      projectModel,
      baselineModel: baselineModel || null,
      hasBaseline,
      items: sortedItems,
      itemsByKey: new Map(sortedItems.map((item) => [item.key, item])),
      lanes,
      graph,
      summary: {
        itemCount: sortedItems.length,
        laneCount: lanes.length,
        graphNodeCount: graph.nodes.length,
        graphEdgeCount: graph.edges.length,
        compare
      }
    };
  }

  function filterDesignItems(designModel, filters) {
    const options = filters || {};
    const query = String(options.query || '').trim().toLowerCase();
    return ensureArray(designModel && designModel.items).filter((item) => {
      if (options.lane && options.lane !== 'all' && item.laneId !== options.lane) {
        return false;
      }
      if (options.compare && options.compare !== 'all' && item.compareStatus !== options.compare) {
        return false;
      }
      if (options.kind === 'monthly_popup') {
        if (!item.monthlyPopup && item.kind !== 'monthly_router') {
          return false;
        }
      } else if (options.kind && options.kind !== 'all' && item.kind !== options.kind) {
        return false;
      }
      if (options.authoring && options.authoring !== 'all') {
        const support = designItemDraftSupport(item);
        if (options.authoring === 'editable' && (!support.supported || support.status === 'ide_escape_hatch')) {
          return false;
        }
        if (options.authoring === 'manual' && support.supported) {
          return false;
        }
        if (options.authoring === 'escape_hatch' && support.status !== 'ide_escape_hatch') {
          return false;
        }
      }
      if (options.severity && options.severity !== 'all' && itemSeverity(item) !== options.severity) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        item.key,
        item.kind,
        item.title,
        item.subtitle,
        item.detail,
        item.sceneId,
        item.source && item.source.path,
        item.compareStatus,
        ensureArray(item.tags).join(' ')
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  function designItemCompareStatus(item) {
    return item && item.compareStatus ? item.compareStatus : 'unknown';
  }

  function designItemDraftSupport(item) {
    if (!item || item.present === false) {
      return {supported: false, template: '', view: '', status: 'unsupported'};
    }
    if (item.kind === 'event') {
      return {supported: true, template: 'event', view: 'events', status: 'partial'};
    }
    if (item.kind === 'card' || item.kind === 'advisor_like') {
      return {supported: true, template: 'card', view: 'cards', status: 'partial'};
    }
    if (item.kind === 'news') {
      return {supported: true, template: 'news', view: 'news', status: 'partial'};
    }
    if (item.kind === 'monthly_router') {
      return {supported: false, template: '', view: '', status: 'manual'};
    }
    if (item.kind === 'surface_text') {
      return {
        supported: true,
        template: 'surface',
        view: 'surfaceText',
        status: item.editability === 'ide_escape_hatch' ? 'ide_escape_hatch' : 'proposal'
      };
    }
    return {supported: false, template: '', view: '', status: 'unsupported'};
  }

  function relatedDesignItems(designModel, item, limit) {
    if (!designModel || !item) {
      return [];
    }
    const max = Math.max(1, Number(limit) || 10);
    const related = [];
    const seen = new Set([item.key]);
    const graph = designModel.graph || {nodes: [], edges: []};
    const node = ensureArray(graph.nodes).find((candidate) => candidate.key === item.key);
    const nodeById = new Map(ensureArray(graph.nodes).map((candidate) => [candidate.id, candidate]));

    function add(candidate, reason, direction, edge) {
      if (!candidate || !candidate.key || seen.has(candidate.key)) {
        return;
      }
      seen.add(candidate.key);
      related.push({
        item: candidate,
        key: candidate.key,
        title: candidate.title,
        kind: candidate.kind,
        reason,
        direction: direction || '',
        edge: edge || null
      });
    }

    if (node) {
      ensureArray(graph.edges).forEach((edge) => {
        if (edge.from !== node.id && edge.to !== node.id) {
          return;
        }
        const outgoing = edge.from === node.id;
        const otherNode = nodeById.get(outgoing ? edge.to : edge.from);
        add(otherNode && otherNode.item, outgoing ? 'outgoing graph edge' : 'incoming graph edge', outgoing ? 'outgoing' : 'incoming', edge);
      });
    }

    const source = firstSource(item) || {};
    const sourcePath = String(source.path || '');
    const folder = sourcePath.includes('/') ? sourcePath.split('/').slice(0, -1).join('/') : '';
    const schedule = item.schedule || {};
    ensureArray(designModel.items).forEach((candidate) => {
      if (related.length >= max) {
        return;
      }
      if (!candidate || candidate.key === item.key || candidate.present === false) {
        return;
      }
      if (schedule.year && candidate.schedule && candidate.schedule.year === schedule.year) {
        const monthsOverlap = !schedule.monthStart || !candidate.schedule.monthStart ||
          (candidate.schedule.monthStart <= (schedule.monthEnd || schedule.monthStart) &&
            schedule.monthStart <= (candidate.schedule.monthEnd || candidate.schedule.monthStart));
        if (monthsOverlap) {
          add(candidate, 'same timeline window', '', null);
          return;
        }
      }
      const candidateSource = firstSource(candidate) || {};
      const candidatePath = String(candidateSource.path || '');
      const candidateFolder = candidatePath.includes('/') ? candidatePath.split('/').slice(0, -1).join('/') : '';
      if (sourcePath && candidatePath === sourcePath) {
        add(candidate, 'same source file', '', null);
        return;
      }
      if (folder && folder.split('/').length > 3 && candidateFolder === folder) {
        add(candidate, 'same source folder', '', null);
      }
    });

    return related.slice(0, max);
  }

  const api = {
    LANE_DEFS,
    COMPARE_STATUSES,
    buildDesignModel,
    buildDesignGraph,
    filterDesignItems,
    designItemCompareStatus,
    designItemDraftSupport,
    itemSeverity,
    relatedDesignItems
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapDesignModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
