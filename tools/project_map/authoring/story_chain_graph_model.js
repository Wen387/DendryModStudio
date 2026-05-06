(function initProjectMapStoryChainGraphModel(global) {
  'use strict';

  const FULL_DEPTH_LIMIT = 5;
  const MAX_CHAIN_CARDS = 64;

  function buildChain(projectIndex, cards, selected, model, options) {
    const opts = isObject(options) ? options : {};
    const depth = normalizeDepth(opts.storyChainDepth || opts.chainDepth);
    const maxDepth = depth === 'full' ? FULL_DEPTH_LIMIT : Number(depth);
    const cardList = ensureArray(cards);
    const byId = cardMap(cardList);
    const selectedId = String(selected && selected.id || model && model.objectId || '');
    const selectedCard = selected || byId.get(selectedId) || null;
    const graph = edgeGraph(projectIndex);
    const upstream = walk(graph.reverse, selectedId, maxDepth, byId, 'upstream');
    const downstream = walk(graph.forward, selectedId, maxDepth, byId, 'downstream');
    const routes = routeCards(selectedCard, byId);
    const branches = cardList.filter((card) => card && card.draftBranch).map((card) => decorate(card, 'branch', 1, null));
    const levelCards = {
      upstream: uniqueCards(upstream.cards).slice(0, MAX_CHAIN_CARDS),
      selected: selectedCard ? [decorate(selectedCard, 'selected', 0, null)] : [],
      routes: uniqueCards(routes.cards.concat(downstream.cards)).slice(0, MAX_CHAIN_CARDS),
      branches: uniqueCards(branches).slice(0, MAX_CHAIN_CARDS)
    };
    const levels = [
      {key: 'upstream', label: 'Before', cards: levelCards.upstream},
      {key: 'selected', label: 'Selected beat', cards: levelCards.selected},
      {key: 'routes', label: 'Choices and routes', cards: levelCards.routes},
      {key: 'branches', label: 'Branches and inserts', cards: levelCards.branches}
    ];
    const connectors = chainConnectors(levels, graph.edges, routes.connectors, selectedCard, branches);
    return {
      depth,
      maxDepth,
      levels,
      connectors,
      insertionPoints: insertionPoints(selectedCard, levelCards.routes),
      routeLabels: routes.labels,
      metrics: {
        upstreamCount: levelCards.upstream.length,
        routeCount: levelCards.routes.length,
        branchCount: levelCards.branches.length,
        connectorCount: connectors.length
      }
    };
  }

  function cardMap(cards) {
    const byId = new Map();
    ensureArray(cards).forEach((card) => {
      if (card && card.id && !byId.has(String(card.id))) {
        byId.set(String(card.id), card);
      }
    });
    return byId;
  }

  function edgeGraph(projectIndex) {
    const forward = new Map();
    const reverse = new Map();
    const edges = [];
    ensureArray(projectIndex && projectIndex.edges).forEach((edge) => {
      const from = String(edge && edge.from || '');
      const to = String(edge && edge.to || '');
      if (!from || !to) {
        return;
      }
      const normalized = Object.assign({}, edge, {from, to});
      pushEdge(forward, from, normalized);
      pushEdge(reverse, to, normalized);
      edges.push(normalized);
    });
    return {forward, reverse, edges};
  }

  function pushEdge(map, key, edge) {
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(edge);
  }

  function walk(map, selectedId, maxDepth, byId, side) {
    if (!selectedId || !map || !map.size) {
      return {cards: [], ids: new Set()};
    }
    const seen = new Set([selectedId]);
    const queue = [{id: selectedId, depth: 0}];
    const cards = [];
    const ids = new Set();
    while (queue.length && cards.length < MAX_CHAIN_CARDS) {
      const current = queue.shift();
      if (current.depth >= maxDepth) {
        continue;
      }
      ensureArray(map.get(current.id)).forEach((edge) => {
        const nextId = side === 'upstream' ? edge.from : edge.to;
        if (!nextId || seen.has(nextId)) {
          return;
        }
        seen.add(nextId);
        ids.add(nextId);
        const found = byId.get(String(nextId));
        cards.push(decorate(found || edgeCard(nextId, edge, side), side, current.depth + 1, edge));
        queue.push({id: nextId, depth: current.depth + 1});
      });
    }
    return {cards, ids};
  }

  function routeCards(selected, byId) {
    const cards = [];
    const labels = [];
    const connectors = [];
    ensureArray(selected && selected.routeTargets).forEach((target, index) => {
      const id = String(target && target.id || '');
      const found = id ? byId.get(id) : null;
      const label = String(target && (target.label || target.title || target.id) || '');
      if (label) {
        labels.push(label);
      }
      if (found) {
        connectors.push({
          fromKey: selected.key,
          toKey: found.key,
          kind: 'option',
          label: label || id || 'option'
        });
        return;
      }
      const key = 'option:' + (selected && selected.key || 'selected') + ':' + index;
      cards.push({
        key,
        id: id || 'option_' + (index + 1),
        kind: 'route',
        title: label || id || 'Option route',
        body: id ? 'go to ' + id : '',
        route: true,
        editable: false,
        chainDistance: 1,
        chainSide: 'route'
      });
      connectors.push({
        fromKey: selected && selected.key || '',
        toKey: key,
        kind: 'option',
        label: label || id || 'option'
      });
    });
    return {cards, labels, connectors};
  }

  function chainConnectors(levels, edges, routeConnectors, selected, branches) {
    const visible = new Map();
    levels.forEach((level) => {
      ensureArray(level.cards).forEach((card) => {
        if (card && card.id) {
          visible.set(String(card.id), card.key);
        }
      });
    });
    const out = [];
    ensureArray(edges).forEach((edge) => {
      const fromKey = visible.get(String(edge.from));
      const toKey = visible.get(String(edge.to));
      if (!fromKey || !toKey) {
        return;
      }
      out.push({
        key: 'edge:' + edge.from + ':' + edge.to,
        fromKey,
        toKey,
        kind: edge.kind || 'edge',
        label: edge.label || edge.kind || ''
      });
    });
    ensureArray(routeConnectors).forEach((connector, index) => {
      if (connector.fromKey && connector.toKey) {
        out.push(Object.assign({key: 'route:' + index}, connector));
      }
    });
    ensureArray(branches).forEach((branch, index) => {
      if (selected && selected.key && branch && branch.key) {
        out.push({
          key: 'branch:' + index,
          fromKey: selected.key,
          toKey: branch.key,
          kind: 'draft_branch',
          label: 'draft'
        });
      }
    });
    return uniqueConnectors(out);
  }

  function insertionPoints(selected, routes) {
    const base = [
      {key: 'before', label: 'Insert before selected beat', action: 'counterfactual'},
      {key: 'after', label: 'Create follow-up after selected beat', action: 'followup'},
      {key: 'branch', label: 'Create counterfactual branch', action: 'counterfactual'}
    ];
    ensureArray(routes).slice(0, 8).forEach((card) => {
      if (!selected || !card || !card.id) {
        return;
      }
      base.push({
        key: 'edge:' + selected.id + ':' + card.id,
        label: 'Insert between ' + selected.id + ' and ' + card.id,
        action: 'followup',
        fromId: selected.id,
        toId: card.id
      });
    });
    return base;
  }

  function edgeCard(id, edge, direction) {
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

  function decorate(card, side, distance, edge) {
    return Object.assign({}, card || {}, {
      chainSide: side,
      chainDistance: distance,
      chainEdge: edge || null
    });
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
    return out.sort((a, b) => Number(a.chainDistance || 0) - Number(b.chainDistance || 0) ||
      Number(a.storyboardOrder || 9999) - Number(b.storyboardOrder || 9999) ||
      String(a.title || '').localeCompare(String(b.title || '')));
  }

  function uniqueConnectors(connectors) {
    const seen = new Set();
    const out = [];
    ensureArray(connectors).forEach((connector) => {
      const key = String(connector.fromKey || '') + '>' + String(connector.toKey || '') + ':' + String(connector.kind || '');
      if (!connector.fromKey || !connector.toKey || seen.has(key)) {
        return;
      }
      seen.add(key);
      out.push(Object.assign({key}, connector));
    });
    return out;
  }

  function normalizeDepth(value) {
    const text = String(value || '1').trim();
    if (text === '2') {
      return '2';
    }
    if (text === 'full') {
      return 'full';
    }
    return '1';
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    return {
      path: String(value.path || ''),
      line: value.line || value.startLine || '',
      endLine: value.endLine || ''
    };
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {buildChain};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapStoryChainGraphModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
