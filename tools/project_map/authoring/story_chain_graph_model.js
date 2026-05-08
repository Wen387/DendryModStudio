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
    const selectedScene = sceneMap(projectIndex).get(selectedId) || null;
    const internalFlow = buildInternalFlow(projectIndex, selectedScene, graph, byId);
    internalFlow.cards.forEach((card) => {
      if (card && card.id && !byId.has(String(card.id))) {
        byId.set(String(card.id), card);
      }
    });
    const upstream = walk(graph.reverse, selectedId, maxDepth, byId, 'upstream');
    const downstream = walk(graph.forward, selectedId, maxDepth, byId, 'downstream');
    const routes = routeCards(selectedCard, byId);
    const relations = relationCards(selectedCard, selectedScene, graph, byId, internalFlow, routes);
    const branches = cardList.filter((card) => card && card.draftBranch).map((card) => decorate(card, 'branch', 1, null));
    const levelCards = {
      upstream: uniqueCards(upstream.cards).slice(0, MAX_CHAIN_CARDS),
      selected: selectedCard ? [decorate(selectedCard, 'selected', 0, null)] : [],
      routes: uniqueCards(relations.cards).slice(0, MAX_CHAIN_CARDS),
      downstream: uniqueCards(relations.targets.concat(downstream.cards)).slice(0, MAX_CHAIN_CARDS),
      branches: uniqueCards(branches).slice(0, MAX_CHAIN_CARDS)
    };
    const levels = [
      {key: 'upstream', label: 'Before', cards: levelCards.upstream},
      {key: 'selected', label: 'Selected beat', cards: levelCards.selected},
      {key: 'routes', label: 'Relationships', cards: levelCards.routes},
      {key: 'downstream', label: 'Targets', cards: levelCards.downstream},
      {key: 'branches', label: 'Branches and inserts', cards: levelCards.branches}
    ];
    const connectors = chainConnectors(levels, graph.edges, [], selectedCard, branches, relations.connectors, relations.representedEdges);
    return {
      depth,
      maxDepth,
      levels,
      connectors,
      insertionPoints: insertionPoints(selectedCard, levelCards.downstream),
      routeLabels: relations.labels.concat(routes.labels).concat(internalFlow.labels).slice(0, 12),
      topology: eventTopology(selectedId, selectedScene, graph, internalFlow),
      metrics: {
        upstreamCount: levelCards.upstream.length,
        routeCount: levelCards.routes.length,
        downstreamCount: levelCards.downstream.length,
        branchCount: levelCards.branches.length,
        connectorCount: connectors.length,
        relationCount: relations.cards.length,
        internalStepCount: internalFlow.internalStepCount,
        internalRouteCount: internalFlow.internalRouteCount
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

  function sceneMap(projectIndex) {
    const map = new Map();
    ensureArray(projectIndex && projectIndex.scenes).forEach((scene) => {
      if (scene && scene.id) {
        map.set(String(scene.id), scene);
      }
    });
    return map;
  }

  function buildInternalFlow(projectIndex, scene, graph, byId) {
    if (!scene || !scene.id) {
      return {cards: [], labels: [], internalStepCount: 0, internalRouteCount: 0, externalRouteCount: 0, conditionCount: 0};
    }
    const sceneId = String(scene.id);
    const sectionText = textBySection(projectIndex, sceneId);
    const internalIds = new Set([sceneId]);
    ensureArray(scene.sections).forEach((section) => {
      if (section && section.id) {
        internalIds.add(String(section.id));
      }
    });
    const cards = ensureArray(scene.sections).map((section, index) => {
      return sectionCard(scene, section, sectionText.get(String(section && section.id || '')) || {}, index);
    }).filter(Boolean);
    const seenExit = new Set(cards.map((card) => card.id));
    ensureArray(graph && graph.edges).forEach((edge) => {
      const from = String(edge && edge.from || '');
      const to = String(edge && edge.to || '');
      if (!internalIds.has(from) || internalIds.has(to) || byId.has(to) || seenExit.has(to)) {
        return;
      }
      seenExit.add(to);
      cards.push(exitRouteCard(to, edge, cards.length));
    });
    const internalEdges = ensureArray(graph && graph.edges).filter((edge) => {
      return internalIds.has(String(edge && edge.from || '')) && internalIds.has(String(edge && edge.to || ''));
    });
    const externalEdges = ensureArray(graph && graph.edges).filter((edge) => {
      return internalIds.has(String(edge && edge.from || '')) && !internalIds.has(String(edge && edge.to || ''));
    });
    const conditionCount = ensureArray(scene.sections).filter((section) => section && (section.viewIf || section.chooseIf)).length +
      internalEdges.filter((edge) => edge && edge.condition).length +
      externalEdges.filter((edge) => edge && edge.condition).length;
    return {
      cards,
      labels: cards.map((card) => card.title || card.id || '').filter(Boolean).slice(0, 8),
      internalStepCount: ensureArray(scene.sections).length,
      internalRouteCount: internalEdges.length,
      externalRouteCount: externalEdges.length,
      conditionCount
    };
  }

  function sectionCard(scene, section, text, index) {
    if (!section || !section.id) {
      return null;
    }
    const sceneId = String(scene && scene.id || '');
    const id = String(section.id);
    const local = localSectionId(sceneId, id);
    const title = String(section.title || text.heading || text.title || humanize(local || id));
    const conditions = [
      section.viewIf ? 'view-if: ' + section.viewIf : '',
      section.chooseIf ? 'choose-if: ' + section.chooseIf : '',
      section.maxVisits ? 'max-visits: ' + section.maxVisits : ''
    ].filter(Boolean);
    const body = [text.body || text.heading || '', conditions.join(' / ')].filter(Boolean).join('\n');
    return {
      key: 'section:' + id,
      id,
      kind: 'route',
      title,
      body,
      schedule: scheduleForSceneLike(scene),
      source: sourceRef(section.sourceSpan || {}),
      routeTargets: [],
      stateTags: ['source', 'route'],
      editable: false,
      route: true,
      internalStep: true,
      chainDistance: 1,
      chainSide: 'route',
      storyboardOrder: Number(section.sourceSpan && (section.sourceSpan.startLine || section.sourceSpan.line) || index + 1),
      raw: section
    };
  }

  function exitRouteCard(id, edge, index) {
    return {
      key: 'route-exit:' + safeKey(id),
      id: String(id || 'exit'),
      kind: 'route',
      title: String(id || 'Route exit'),
      body: [edge && edge.kind, edge && edge.condition ? 'if ' + edge.condition : '', edge && edge.rawTarget ? 'target: ' + edge.rawTarget : ''].filter(Boolean).join(' / '),
      schedule: {},
      source: sourceRef(edge && edge.source),
      routeTargets: [],
      editable: false,
      route: true,
      chainDistance: 1,
      chainSide: 'route',
      storyboardOrder: 9000 + index
    };
  }

  function eventTopology(selectedId, scene, graph, internalFlow) {
    const sceneId = String(selectedId || scene && scene.id || '');
    const endpoints = new Set([sceneId]);
    ensureArray(scene && scene.sections).forEach((section) => {
      if (section && section.id) {
        endpoints.add(String(section.id));
      }
    });
    const externalOutgoing = ensureArray(graph && graph.edges).filter((edge) => {
      return endpoints.has(String(edge && edge.from || '')) && !endpoints.has(String(edge && edge.to || ''));
    }).length;
    const externalIncoming = ensureArray(graph && graph.edges).filter((edge) => {
      return !endpoints.has(String(edge && edge.from || '')) && endpoints.has(String(edge && edge.to || ''));
    }).length;
    const hasInternal = Number(internalFlow && (internalFlow.internalStepCount || internalFlow.internalRouteCount) || 0) > 0;
    const hasChain = externalOutgoing + externalIncoming > 0;
    let kind = 'single_event';
    if (hasInternal && hasChain) {
      kind = 'single_composite_event_in_chain';
    } else if (hasInternal) {
      kind = 'single_composite_event';
    } else if (hasChain) {
      kind = 'composite_event_chain_node';
    }
    return {
      kind,
      shape: hasInternal ? 'single_composite_event' : 'single_event',
      chainRole: hasChain ? 'composite_event_chain_node' : 'standalone',
      internalStepCount: Number(internalFlow && internalFlow.internalStepCount || 0),
      internalRouteCount: Number(internalFlow && internalFlow.internalRouteCount || 0),
      externalRouteCount: externalOutgoing,
      incomingRouteCount: externalIncoming,
      conditionCount: Number(internalFlow && internalFlow.conditionCount || 0)
    };
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

  function relationCards(selected, scene, graph, byId, internalFlow, routeFallback) {
    const selectedId = String(selected && selected.id || scene && scene.id || '');
    const selectedKey = selected && selected.key || '';
    const internalIds = internalEndpointIds(scene);
    const directEdges = ensureArray(graph && graph.edges).filter((edge) => {
      const from = String(edge && edge.from || '');
      const to = String(edge && edge.to || '');
      return from && to && (from === selectedId || internalIds.has(from));
    });
    const fallbackEdges = directEdges.length ? [] : ensureArray(selected && selected.routeTargets).map((target, index) => ({
      from: selectedId,
      to: String(target && target.id || ''),
      kind: 'choice',
      label: String(target && (target.label || target.title || target.id) || ''),
      rawTarget: String(target && target.id || ''),
      source: selected && selected.source || {},
      fallbackIndex: index
    })).filter((edge) => edge.to);
    const edges = directEdges.concat(fallbackEdges).slice(0, MAX_CHAIN_CARDS);
    const cards = [];
    const targets = [];
    const connectors = [];
    const labels = [];
    const representedEdges = new Set();
    const seenTargets = new Set();

    edges.forEach((edge, index) => {
      const fromId = String(edge.from || selectedId);
      const toId = String(edge.to || '');
      const edgeKey = relationEdgeKey(edge);
      representedEdges.add(edgeKey);
      const fromCard = byId.get(fromId) || (fromId === selectedId ? selected : null);
      const targetCard = byId.get(toId) || exitRouteCard(toId || edge.rawTarget || 'route_target', edge, index);
      const relation = relationDetails(edge, fromCard, targetCard, selectedId, internalIds);
      const card = relationCard(edge, relation, selectedKey, index);
      cards.push(card);
      if (targetCard && targetCard.key && !seenTargets.has(targetCard.key)) {
        seenTargets.add(targetCard.key);
        targets.push(decorate(targetCard, relation.scope === 'internal' ? 'internal_target' : 'downstream', relation.distance, edge));
      }
      if (relation.label) {
        labels.push(relation.label);
      }
      if (selectedKey && card.key) {
        connectors.push({
          key: 'relation-in:' + index,
          fromKey: selectedKey,
          toKey: card.key,
          kind: relation.connectorKind,
          label: relation.label
        });
      }
      if (card.key && targetCard && targetCard.key) {
        connectors.push({
          key: 'relation-out:' + index,
          fromKey: card.key,
          toKey: targetCard.key,
          kind: relation.condition ? 'conditional_route' : 'route',
          label: relation.targetTitle
        });
      }
    });

    ensureArray(routeFallback && routeFallback.cards).forEach((card, index) => {
      if (!card || !card.key) {
        return;
      }
      const key = 'fallback>' + card.key;
      if (seenTargets.has(card.key)) {
        return;
      }
      seenTargets.add(card.key);
      targets.push(decorate(card, 'downstream', 1, null));
      representedEdges.add(key);
      const relation = {
        label: card.title || card.id || 'Route',
        trigger: 'choice',
        triggerLabel: 'Player option',
        fromId: selectedId,
        fromTitle: selected && selected.title || selectedId,
        toId: card.id || '',
        targetTitle: card.title || card.id || '',
        condition: '',
        sourceLabel: '',
        rawTarget: card.id || '',
        scope: 'external',
        connectorKind: 'choice',
        distance: 1
      };
      const relationNode = relationCard({kind: 'choice', label: relation.label, from: selectedId, to: card.id || '', fallbackIndex: index}, relation, selectedKey, cards.length);
      cards.push(relationNode);
      connectors.push({key: 'fallback-relation-in:' + index, fromKey: selectedKey, toKey: relationNode.key, kind: 'choice', label: relation.label});
      connectors.push({key: 'fallback-relation-out:' + index, fromKey: relationNode.key, toKey: card.key, kind: 'route', label: relation.targetTitle});
    });

    if (!cards.length && internalFlow && internalFlow.cards && internalFlow.cards.length) {
      internalFlow.cards.slice(0, MAX_CHAIN_CARDS).forEach((card) => {
        if (card && card.key && !seenTargets.has(card.key)) {
          seenTargets.add(card.key);
          targets.push(card);
        }
      });
    }

    return {cards, targets, connectors, labels, representedEdges};
  }

  function relationCard(edge, relation, selectedKey, index) {
    const source = sourceRef(edge && edge.source);
    const key = 'relation:' + safeKey([relation.fromId, relation.toId || relation.rawTarget || index, edge && edge.kind || 'route', source.line || index].join(':'));
    return {
      key,
      id: key,
      kind: 'chain_relation',
      title: relation.label || relation.triggerLabel || 'Route',
      body: relationBody(relation),
      route: true,
      relation: true,
      editable: false,
      chainDistance: relation.distance || 1,
      chainSide: 'route',
      chainRelation: relation,
      routeTargets: relation.toId ? [{id: relation.toId, label: relation.targetTitle}] : [],
      stateTags: ['relation'].concat(relation.trigger ? [relation.trigger] : []).concat(relation.condition ? ['conditional'] : []),
      source,
      storyboardOrder: 3000 + index,
      raw: edge || {}
    };
  }

  function relationDetails(edge, fromCard, targetCard, selectedId, internalIds) {
    const kind = String(edge && edge.kind || 'route');
    const condition = String(edge && (edge.condition || edge.predicate || edge.viewIf || '') || '').trim();
    const fromId = String(edge && edge.from || selectedId || '');
    const toId = String(edge && edge.to || '');
    const label = firstNonEmpty(edge && edge.label, edge && edge.title, edge && edge.rawTarget, targetCard && targetCard.title, toId);
    const trigger = triggerKind(kind, condition);
    const source = sourceRef(edge && edge.source);
    return {
      label,
      trigger,
      triggerLabel: triggerLabel(trigger),
      connectorKind: trigger === 'choice' ? 'choice' : (condition ? 'conditional_route' : 'route'),
      fromId,
      fromTitle: fromCard && (fromCard.title || fromCard.id) || fromId,
      toId,
      targetTitle: targetCard && (targetCard.title || targetCard.id) || toId,
      condition,
      sourceLabel: source.path ? source.path + (source.line ? ':' + source.line : '') : '',
      rawTarget: String(edge && edge.rawTarget || ''),
      scope: internalIds && internalIds.has(toId) ? 'internal' : 'external',
      distance: fromId === selectedId ? 1 : 2
    };
  }

  function relationBody(relation) {
    return [
      relation.triggerLabel,
      relation.condition ? 'if ' + relation.condition : '',
      relation.targetTitle ? 'target: ' + relation.targetTitle : ''
    ].filter(Boolean).join(' / ');
  }

  function triggerKind(kind, condition) {
    const text = String(kind || '').toLowerCase();
    if (text.indexOf('choice') >= 0 || text.indexOf('option') >= 0) {
      return 'choice';
    }
    if (condition || text.indexOf('conditional') >= 0 || text.indexOf('if') >= 0) {
      return 'conditional';
    }
    if (text.indexOf('go') >= 0 || text.indexOf('route') >= 0) {
      return 'goto';
    }
    return 'route';
  }

  function triggerLabel(trigger) {
    return {
      choice: 'Player option',
      conditional: 'Conditional jump',
      goto: 'Immediate jump',
      route: 'Route'
    }[trigger] || 'Route';
  }

  function internalEndpointIds(scene) {
    const ids = new Set();
    if (scene && scene.id) {
      ids.add(String(scene.id));
    }
    ensureArray(scene && scene.sections).forEach((section) => {
      if (section && section.id) {
        ids.add(String(section.id));
      }
    });
    return ids;
  }

  function chainConnectors(levels, edges, routeConnectors, selected, branches, relationConnectors, representedEdges) {
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
      if (representedEdges && representedEdges.has(relationEdgeKey(edge))) {
        return;
      }
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
    ensureArray(relationConnectors).forEach((connector) => {
      if (connector.fromKey && connector.toKey) {
        out.push(connector);
      }
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

  function relationEdgeKey(edge) {
    return [edge && edge.from, edge && edge.to, edge && edge.kind || '', edge && edge.source && (edge.source.path || ''), edge && edge.source && (edge.source.line || edge.source.startLine || '')]
      .map((part) => String(part || ''))
      .join('>');
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

  function textBySection(projectIndex, sceneId) {
    const map = new Map();
    ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic.textCorpus && projectIndex.semantic.textCorpus.items).forEach((item) => {
      const owner = item && item.owner || {};
      if (String(owner.sceneId || item.sceneId || '') !== String(sceneId || '')) {
        return;
      }
      const sectionId = String(owner.sectionId || '');
      if (!sectionId) {
        return;
      }
      if (!map.has(sectionId)) {
        map.set(sectionId, {title: '', heading: '', body: ''});
      }
      const bucket = map.get(sectionId);
      const role = String(item.role || item.kind || '').toLowerCase();
      const text = String(item.text || item.value || '').trim();
      if (!text) {
        return;
      }
      if (!bucket.title && role.indexOf('title') >= 0) {
        bucket.title = text;
      } else if (!bucket.heading && role === 'heading') {
        bucket.heading = text;
      } else if (!bucket.body && (role === 'body' || role === 'section' || role.indexOf('body') >= 0)) {
        bucket.body = text;
      }
    });
    return map;
  }

  function scheduleForSceneLike(scene) {
    const value = isObject(scene) ? scene : {};
    const year = numberOr(value.year || value.startYear || value.yearStart, 0);
    if (!year) {
      return {};
    }
    const monthStart = numberOr(value.monthStart || value.startMonth || value.month, 1);
    const monthEnd = numberOr(value.monthEnd || value.endMonth || value.month, monthStart);
    return {year, monthStart, monthEnd};
  }

  function localSectionId(sceneId, id) {
    const text = String(id || '');
    const prefix = String(sceneId || '') + '.';
    return text.startsWith(prefix) ? text.slice(prefix.length) : text;
  }

  function humanize(value) {
    return String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function safeKey(value) {
    return String(value || 'route').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'route';
  }

  function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : Number(fallback || 0);
  }

  function firstNonEmpty() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];
      if (value != null && String(value).trim()) {
        return String(value).trim();
      }
    }
    return '';
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
