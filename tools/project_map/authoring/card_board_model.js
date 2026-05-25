(function initProjectMapCardBoardModel(global) {
  'use strict';

  const FILTER_TYPES = ['all', 'card', 'advisor', 'deck', 'draft', 'unwired'];

  function buildBoard(projectIndex, objectModel, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const model = isObject(objectModel) ? objectModel : {};
    const opts = isObject(options) ? options : {};
    const cards = collectCards(index, model);
    const lanes = buildLanes(index, cards);
    const filteredCards = filterCards(cards, opts);
    const selectedKey = selectedCardKey(filteredCards, cards, model, opts);
    const selected = cardByKey(cards, selectedKey) || filteredCards[0] || cards[0] || null;
    const selectedLane = laneForSelected(lanes, selected, opts);
    const dropContext = normalizeDropContext(opts.cardBoardDropContext);
    const selection = normalizeSelection(opts.cardBoardSelection, selected, selectedLane, dropContext);
    const laneList = decorateLanes(lanes, filteredCards, Object.assign({}, opts, {
      selectedKey: selected && selected.key || '',
      selection
    }));
    const selectedObject = selectedObjectFor(selection, laneList, cards, dropContext, model);
    return {
      schemaVersion: '0.1',
      kind: 'card_board_model',
      query: String(opts.cardBoardQuery || ''),
      type: normalizeType(opts.cardBoardType),
      selectedKey: selected && selected.key || '',
      selectedLane,
      selected,
      selection,
      selectedObject,
      labels: advisorLabels(index),
      lanes: laneList,
      metrics: {
        cardCount: cards.filter((card) => card.kind === 'card').length,
        advisorCount: cards.filter((card) => card.kind === 'advisor').length,
        visibleCardCount: filteredCards.length,
        unwiredCount: cards.filter((card) => card.laneKeys.length === 0).length,
        draftCount: cards.filter((card) => card.stateTags.includes('draft')).length
      },
      dropContext
    };
  }

  function collectCards(index, model) {
    const scenes = ensureArray(index.scenes);
    const textByScene = textCorpusByScene(index);
    const cards = [];
    scenes.forEach((scene) => {
      if (!isCardScene(scene)) {
        return;
      }
      cards.push(cardFromScene(scene, textByScene.get(String(scene.id)) || {}));
    });
    const current = currentDraftCard(model);
    if (current) {
      cards.push(current);
    }
    return dedupeCards(cards);
  }

  function cardFromScene(scene, text) {
    const pinned = isPinned(scene);
    const kind = pinned ? 'advisor' : 'card';
    const optionLabels = ensureArray(text && text.optionLabels);
    const options = ensureArray(scene.options).map((option, index) => ({
      id: String(option && option.target && option.target.id || option && option.id || 'option_' + (index + 1)),
      label: String(option && (option.title || option.label) || optionLabels[index] || 'Choice ' + (index + 1)),
      targetId: String(option && option.target && option.target.id || ''),
      index,
      optionIndex: index,
      optionPath: 'root.' + index,
      fieldId: 'card.option.' + index + '.label',
      source: sourceRef(option && option.sourceSpan || {})
    })).concat(sectionOptionsFromScene(scene)).map((option, index) => Object.assign({}, option, {index}));
    return {
      key: kind + ':' + scene.id,
      id: String(scene.id || ''),
      kind,
      cardKind: pinned ? 'advisor_like' : 'action_card',
      title: first(text.title, scene.title, scene.id),
      heading: first(text.heading, text.title, scene.title, scene.id),
      subtitle: first(text.subtitle, scene.subtitle, ''),
      body: first(text.body, scene.summary, scene.description, ''),
      options,
      tags: ensureArray(scene.tags).map(String).filter(Boolean),
      source: sourceRef(scene.sourceSpan || scene.topLevelSpan || {path: scene.path}),
      stateTags: ['source'],
      laneKeys: [],
      routeEvidence: [],
      raw: scene
    };
  }

  function currentDraftCard(model) {
    const change = model && model.changeState || {};
    const draft = change.draft || {};
    if (!draft || model.mode === 'existing' || model.template !== 'card') {
      return null;
    }
    const id = String(draft.id || model.objectId || 'new_action_card');
    const advisor = String(draft.cardKind || '') === 'advisor_like';
    return {
      key: 'draft:card:' + id,
      id,
      kind: advisor ? 'advisor' : 'card',
      cardKind: advisor ? 'advisor_like' : 'action_card',
      title: String(draft.title || draft.heading || id),
      heading: String(draft.heading || draft.title || id),
      subtitle: String(draft.subtitle || ''),
      body: ensureArray(draft.introParagraphs).join('\n\n'),
      options: ensureArray(draft.options).map((option, index) => ({
        id: String(option && option.id || 'option_' + (index + 1)),
        label: String(option && (option.label || option.title) || 'Choice ' + (index + 1)),
        targetId: String(option && option.gotoAfter || ''),
        index,
        optionIndex: index,
        optionPath: 'root.' + index,
        fieldId: 'card.option.' + index + '.label',
        source: {path: 'draft workspace'}
      })).concat(sectionOptionsFromDraft(draft)).map((option, index) => Object.assign({}, option, {index})),
      tags: ensureArray(draft.tags).map(String).filter(Boolean),
      source: {path: 'draft workspace'},
      stateTags: ['draft'].concat(change.changedCount ? ['changed'] : []),
      laneKeys: [],
      routeEvidence: [],
      raw: draft
    };
  }

  function sectionOptionsFromScene(scene) {
    return ensureArray(scene && scene.sections).reduce((rows, section, sectionIndex) => {
      const sectionId = localId(section && section.id) || 'section_' + (sectionIndex + 1);
      const sectionLabel = String(section && (section.title || section.id) || 'Section ' + (sectionIndex + 1));
      return rows.concat(ensureArray(section && section.options).map((option, optionIndex) => ({
        id: String(option && option.target && option.target.id || option && option.id || sectionId + '_option_' + (optionIndex + 1)),
        label: sectionLabel + ': ' + String(option && (option.title || option.label) || 'Choice ' + (optionIndex + 1)),
        targetId: String(option && option.target && option.target.id || ''),
        index: rows.length + optionIndex,
        sectionIndex,
        sectionId,
        sectionLabel,
        optionIndex,
        optionPath: 'section.' + sectionIndex + '.' + optionIndex,
        fieldId: 'card.section.' + sectionIndex + '.option.' + optionIndex + '.label',
        source: sourceRef(option && option.sourceSpan || section && section.sourceSpan || {})
      })));
    }, []);
  }

  function sectionOptionsFromDraft(draft) {
    return ensureArray(draft && draft.sections).reduce((rows, section, sectionIndex) => {
      const sectionId = localId(section && section.id) || 'section_' + (sectionIndex + 1);
      const sectionLabel = String(section && (section.title || section.id) || 'Section ' + (sectionIndex + 1));
      return rows.concat(ensureArray(section && section.options).map((option, optionIndex) => ({
        id: String(option && option.id || sectionId + '_option_' + (optionIndex + 1)),
        label: sectionLabel + ': ' + String(option && (option.label || option.title) || 'Choice ' + (optionIndex + 1)),
        targetId: String(option && option.gotoAfter || ''),
        index: rows.length + optionIndex,
        sectionIndex,
        sectionId,
        sectionLabel,
        optionIndex,
        optionPath: 'section.' + sectionIndex + '.' + optionIndex,
        fieldId: 'card.section.' + sectionIndex + '.option.' + optionIndex + '.label',
        source: {path: 'draft workspace'}
      })));
    }, []);
  }

  function buildLanes(index, cards) {
    const scenesById = new Map(ensureArray(index.scenes).map((scene) => [String(scene && scene.id || ''), scene]));
    const handScenes = semanticOrSceneList(index, 'hands', (scene) => scene.type === 'hand' || scene.flags && scene.flags.isHand);
    const deckScenes = semanticOrSceneList(index, 'decks', (scene) => scene.type === 'deck' || scene.flags && scene.flags.isDeck);
    const deckPoolModel = buildDeckPoolModel(index);
    const deckPools = ensureArray(deckPoolModel && deckPoolModel.deckPools);
    const advisorControllerModel = buildAdvisorControllerModel(index);
    const advisorControllers = ensureArray(advisorControllerModel && advisorControllerModel.advisorControllers);
    const handEntries = [];
    const deckCards = [];
    const advisorCards = [];
    const laneMeta = {hand: {tags: []}, deck: {tags: [], sourceAnchor: null}, advisor: {tags: [], sourceAnchor: null}};
    const cardById = new Map(cards.map((card) => [card.id, card]));

    deckScenes.forEach((deck) => {
      const scene = scenesById.get(String(deck.id || '')) || deck;
      ensureArray(scene.options).forEach((option) => {
        const target = option && option.target || {};
        if (target.kind === 'tag') {
          laneMeta.deck.tags.push(String(target.id || ''));
          if (!laneMeta.deck.sourceAnchor) {
            laneMeta.deck.sourceAnchor = laneAnchorRef(option && option.sourceSpan || scene && scene.sourceSpan || {}, scene && scene.path);
          }
        }
        cards.forEach((card) => {
          if (targetMatchesCard(target, card)) {
            addLane(card, 'deck');
            deckCards.push(card);
            card.routeEvidence.push(evidence('deck', deck, option));
          }
        });
      });
    });

    handScenes.forEach((hand) => {
      const scene = scenesById.get(String(hand.id || '')) || hand;
      ensureArray(scene.options).forEach((option) => {
        const target = option && option.target || {};
        const linkedScene = scenesById.get(String(target.id || ''));
        const matchedCards = cards.filter((card) => targetMatchesCard(target, card));
        matchedCards.forEach((card) => {
          addLane(card, 'hand');
          card.routeEvidence.push(evidence('hand', hand, option));
        });
        if (target.kind === 'tag') {
          laneMeta.advisor.tags.push(String(target.id || ''));
          if (!laneMeta.advisor.sourceAnchor) {
            laneMeta.advisor.sourceAnchor = laneAnchorRef(option && option.sourceSpan || scene && scene.sourceSpan || {}, scene && scene.path);
          }
        }
        const deckPool = deckPoolForHandTarget(target, deckPools);
        const routeKey = handRouteKey(target.kind === 'scene' && linkedScene && linkedScene.type === 'deck'
          ? 'deck:' + linkedScene.id
          : matchedCards[0] && matchedCards[0].key || 'hand:' + (option.id || target.id || handEntries.length + 1), handEntries);
        handEntries.push({
          key: routeKey,
          kind: target.kind === 'scene' && linkedScene && linkedScene.type === 'deck' ? 'deck' : matchedCards[0] && matchedCards[0].kind || 'route',
          title: option && option.title || linkedScene && linkedScene.title || target.id || 'Hand route',
          detail: target.kind === 'tag' ? '#' + target.id : '@' + target.id,
          targetKind: String(target.kind || ''),
          targetId: String(target.id || ''),
          deckPoolId: deckPool && deckPool.id || '',
          source: sourceRef(option && option.sourceSpan || hand.sourceSpan || hand.source || {}),
          linkedCardKeys: matchedCards.map((card) => card.key)
        });
      });
    });

    const deckPoolLanes = deckPools.map((pool) => {
      const poolCards = uniqueCards(ensureArray(pool.memberCardIds).map((cardId) => cardById.get(String(cardId || ''))).filter(Boolean));
      poolCards.forEach((card) => {
        addLane(card, pool.key || 'deck_pool:' + pool.id);
        addLane(card, 'deck');
      });
      return lane(pool.key || 'deck_pool:' + pool.id, '', pool.label || pool.id || 'Deck pool', poolCards, {
        group: 'deck_pool',
        objectKind: 'deck_pool',
        deckPool: pool,
        tags: ensureArray(pool.routeTags),
        sourceAnchor: pool.sourceAnchor || null,
        status: pool.status || 'ready',
        manualBoundary: pool.manualBoundary || ''
      });
    });

    const advisorControllerLanes = advisorControllers.map((controller) => {
      const rosterCards = uniqueCards(ensureArray(controller.roster).map((item) => cardById.get(String(item && item.pinnedCardSceneId || ''))).filter(Boolean));
      rosterCards.forEach((card) => {
        addLane(card, controller.key || 'advisor_controller:' + controller.id);
        addLane(card, 'advisor');
      });
      return lane(controller.key || 'advisor_controller:' + controller.id, '', controller.title || controller.id || 'Advisor controller', rosterCards, {
        group: 'advisor_controller',
        objectKind: 'advisor_controller',
        advisorController: controller,
        tags: unique(ensureArray(controller.roster).reduce((rows, item) => rows.concat(ensureArray(item && item.categoryTags)), [])),
        sourceAnchor: controller.sourceAnchor || null,
        status: controller.confidence || 'partial',
        manualBoundary: controller.manualBoundary || ''
      });
    });

    cards.forEach((card) => {
      if (card.kind === 'advisor') {
        addLane(card, 'advisor');
        advisorCards.push(card);
      }
      if (!card.laneKeys.length) {
        addLane(card, 'unwired');
      }
    });

    return [
      lane('hand', 'cardBoard.lane.hand', 'Hand', handEntries, laneMeta.hand),
      lane('deck', 'cardBoard.lane.deck', 'Deck', uniqueCards(deckCards), laneMeta.deck),
      ...deckPoolLanes,
      lane('advisor', 'cardBoard.lane.advisor', 'Advisor / pinned', uniqueCards(advisorCards), laneMeta.advisor),
      ...advisorControllerLanes,
      lane('pool', 'cardBoard.lane.pool', 'All cards', cards, {}),
      lane('unwired', 'cardBoard.lane.unwired', 'Unwired', cards.filter((card) => card.laneKeys.includes('unwired')), {}),
      lane('drafts', 'cardBoard.lane.drafts', 'Drafts', cards.filter((card) => card.stateTags.includes('draft')), {})
    ];
  }

  function decorateLanes(lanes, filteredCards, opts) {
    const visible = new Set(filteredCards.map((card) => card.key));
    const selection = opts.selection || {};
    return lanes.map((laneValue) => {
      const allCards = ensureArray(laneValue.cards || laneValue.entries);
      const cards = laneValue.key === 'hand'
        ? allCards.map((entry) => Object.assign({}, entry, {selected: selection.kind === 'route' && selection.key === entry.key}))
        : allCards.filter((card) => visible.has(card.key)).map((card) => Object.assign({}, card, {
          selected: card.key === opts.selectedKey,
          selectedOptionIndex: selection.kind === 'option' && selection.cardKey === card.key ? Number(selection.optionIndex) : -1
        }));
      return Object.assign({}, laneValue, {
        selected: selection.kind === 'lane'
          ? selection.laneKey === laneValue.key
          : String(opts.cardBoardLane || '') === laneValue.key,
        totalCount: allCards.length,
        cards
      });
    });
  }

  function lane(key, labelKey, fallback, cards, meta) {
    return Object.assign({
      key,
      labelKey,
      fallback,
      cards: ensureArray(cards),
      tags: [],
      tag: ''
    }, meta || {}, {
      tag: ensureArray(meta && meta.tags)[0] || ''
    });
  }

  function filterCards(cards, opts) {
    const query = String(opts.cardBoardQuery || '').trim().toLowerCase();
    const type = normalizeType(opts.cardBoardType);
    return cards.filter((card) => {
      if (type === 'card' && card.kind !== 'card') {
        return false;
      }
      if (type === 'advisor' && card.kind !== 'advisor') {
        return false;
      }
      if (type === 'deck' && !card.laneKeys.includes('deck')) {
        return false;
      }
      if (type === 'draft' && !card.stateTags.includes('draft')) {
        return false;
      }
      if (type === 'unwired' && !card.laneKeys.includes('unwired')) {
        return false;
      }
      if (!query) {
        return true;
      }
      return searchable(card).indexOf(query) >= 0;
    });
  }

  function selectedCardKey(filteredCards, cards, model, opts) {
    const requested = String(opts.cardBoardSelectedKey || opts.selected || '').trim();
    if (cardByKey(cards, requested)) {
      return requested;
    }
    const current = cards.find((card) => model.mode === 'existing' && card.id === String(model.objectId || '')) ||
      cards.find((card) => card.stateTags.includes('draft'));
    return current && current.key || filteredCards[0] && filteredCards[0].key || cards[0] && cards[0].key || '';
  }

  function laneForSelected(lanes, selected, opts) {
    const requested = String(opts.cardBoardLane || '');
    if (requested) {
      return requested;
    }
    const laneKeys = ensureArray(selected && selected.laneKeys).filter((key) => key !== 'pool');
    return laneKeys[0] || 'pool';
  }

  function textCorpusByScene(index) {
    const out = new Map();
    ensureArray(index.semantic && index.semantic.textCorpus && index.semantic.textCorpus.items).forEach((row) => {
      const owner = row && row.owner || {};
      const sceneId = String(owner.sceneId || '');
      if (!sceneId) {
        return;
      }
      if (!out.has(sceneId)) {
        out.set(sceneId, {optionLabels: []});
      }
      const item = out.get(sceneId);
      const role = String(row.role || '');
      if (role === 'title' && !item.title) {
        item.title = row.text;
      } else if (role === 'heading' && !item.heading) {
        item.heading = row.text;
      } else if (role === 'subtitle' && !item.subtitle && !owner.sectionId) {
        item.subtitle = row.text;
      } else if (role === 'body' && !item.body && !owner.sectionId) {
        item.body = row.text;
      } else if (role === 'option_label') {
        item.optionLabels.push(row.text);
      }
    });
    return out;
  }

  function semanticOrSceneList(index, key, predicate) {
    const semantic = ensureArray(index.semantic && index.semantic[key]);
    if (semantic.length) {
      return semantic;
    }
    return ensureArray(index.scenes).filter(predicate);
  }

  function buildDeckPoolModel(index) {
    const api = deckPoolModelApi();
    if (!api || typeof api.buildDeckPoolModel !== 'function') {
      return {deckPools: []};
    }
    try {
      return api.buildDeckPoolModel(index);
    } catch (_err) {
      return {deckPools: []};
    }
  }

  function buildAdvisorControllerModel(index) {
    const api = advisorControllerModelApi();
    if (!api || typeof api.buildAdvisorControllerModel !== 'function') {
      return {advisorControllers: []};
    }
    try {
      return api.buildAdvisorControllerModel(index);
    } catch (_err) {
      return {advisorControllers: []};
    }
  }

  function deckPoolModelApi() {
    if (global && global.ProjectMapDeckPoolModel) {
      return global.ProjectMapDeckPoolModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./deck_pool_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function advisorControllerModelApi() {
    if (global && global.ProjectMapAdvisorControllerModel) {
      return global.ProjectMapAdvisorControllerModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./advisor_controller_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function targetMatchesCard(target, card) {
    const value = isObject(target) ? target : {};
    if (value.kind === 'scene') {
      return String(value.id || '') === card.id;
    }
    if (value.kind === 'tag') {
      return ensureArray(card.tags).includes(String(value.id || ''));
    }
    return false;
  }

  function addLane(card, key) {
    if (!card.laneKeys.includes(key)) {
      card.laneKeys.push(key);
    }
  }

  function evidence(kind, container, option) {
    return {
      kind,
      containerId: String(container && container.id || ''),
      containerTitle: String(container && container.title || container && container.id || ''),
      optionLabel: String(option && option.title || option && option.id || ''),
      source: sourceRef(option && option.sourceSpan || container && container.sourceSpan || container && container.source || {})
    };
  }

  function isCardScene(scene) {
    const type = String(scene && scene.type || '');
    const flags = scene && scene.flags || {};
    return type === 'card' || type === 'pinned_card' || type === 'advisor' || flags.isCard || flags.isPinnedCard;
  }

  function isPinned(scene) {
    const type = String(scene && scene.type || '');
    const flags = scene && scene.flags || {};
    return type === 'pinned_card' || type === 'advisor' || flags.isPinnedCard;
  }

  function advisorLabels(index) {
    const active = new Set(ensureArray(index.project && index.project.profileIds).map(String));
    return ensureArray(index.profiles).reduce((labels, profile) => {
      if (active.size && !active.has(String(profile.id || ''))) {
        return labels;
      }
      const ui = isObject(profile.uiLabels) ? profile.uiLabels : {};
      return {
        singular: ui.advisorLikeSingular || labels.singular,
        plural: ui.advisorLikePlural || labels.plural
      };
    }, {singular: '', plural: ''});
  }

  function normalizeDropContext(value) {
    const ctx = isObject(value) ? value : {};
    return {
      itemKey: String(ctx.itemKey || ''),
      itemTitle: String(ctx.itemTitle || ''),
      laneKey: String(ctx.laneKey || ''),
      laneLabel: String(ctx.laneLabel || ''),
      laneTag: String(ctx.laneTag || ''),
      laneAnchor: laneAnchorRef(ctx.laneAnchor || ctx.sourceAnchor || {}, ''),
      action: String(ctx.action || '')
    };
  }

  function normalizeSelection(value, selected, selectedLane, dropContext) {
    const raw = isObject(value) ? value : {};
    const kind = String(raw.kind || '').trim();
    if (kind === 'option') {
      const cardKey = String(raw.cardKey || selected && selected.key || '');
      return {
        kind: 'option',
        key: String(raw.key || 'option:' + cardKey + ':' + Number(raw.optionIndex || 0)),
        cardKey,
        optionIndex: Number(raw.optionIndex || 0),
        optionId: String(raw.optionId || ''),
        laneKey: String(raw.laneKey || selectedLane || 'pool')
      };
    }
    if (kind === 'route') {
      return {
        kind: 'route',
        key: String(raw.key || ''),
        laneKey: 'hand'
      };
    }
    if (kind === 'lane') {
      const laneKey = String(raw.laneKey || selectedLane || 'pool');
      return {
        kind: 'lane',
        key: 'lane:' + laneKey,
        laneKey
      };
    }
    if (kind === 'card') {
      return {
        kind: 'card',
        key: String(raw.key || selected && selected.key || ''),
        cardKey: String(raw.cardKey || raw.key || selected && selected.key || ''),
        laneKey: String(raw.laneKey || selectedLane || 'pool')
      };
    }
    if (kind === 'intent' || (!kind && (dropContext.itemKey || dropContext.laneKey))) {
      return {
        kind: 'intent',
        key: 'intent:' + (dropContext.itemKey || '') + ':' + (dropContext.laneKey || ''),
        cardKey: String(dropContext.itemKey || selected && selected.key || ''),
        laneKey: String(dropContext.laneKey || selectedLane || 'pool')
      };
    }
    return {
      kind: 'card',
      key: String(raw.key || selected && selected.key || ''),
      cardKey: String(raw.cardKey || raw.key || selected && selected.key || ''),
      laneKey: String(raw.laneKey || selectedLane || 'pool')
    };
  }

  function selectedObjectFor(selection, lanes, cards, dropContext, model) {
    const value = selection || {};
    if (value.kind === 'option') {
      const card = cardByKey(cards, value.cardKey);
      const option = optionForSelection(card, value);
      return {
        kind: 'option',
        key: value.key,
        title: option && (option.label || option.id) || 'Option',
        card,
        option,
        optionIndex: option && option.optionIndex !== undefined ? option.optionIndex : option ? option.index : Number(value.optionIndex || 0),
        sectionIndex: option && option.sectionIndex !== undefined ? option.sectionIndex : null,
        optionPath: option && option.optionPath || '',
        fieldId: option && option.fieldId || 'card.title',
        laneKey: value.laneKey || laneForCard(card),
        editability: editabilityForCard(card, model)
      };
    }
    if (value.kind === 'route') {
      const route = routeByKey(lanes, value.key);
      const deckPool = deckPoolForRoute(lanes, route);
      return {
        kind: 'route',
        key: value.key,
        title: route && route.title || 'Hand route',
        route,
        deckPool,
        laneKey: 'hand',
        editability: {editable: Boolean(deckPool), reason: deckPool ? 'deck_pool_route' : 'route_intent'}
      };
    }
    if (value.kind === 'lane') {
      const laneValue = laneByKey(lanes, value.laneKey);
      const objectKind = laneValue && (laneValue.objectKind || laneValue.group) || 'lane';
      return {
        kind: 'lane',
        key: value.key,
        title: laneValue && (laneValue.fallback || laneValue.key) || value.laneKey,
        lane: laneValue,
        objectKind,
        deckPool: laneValue && laneValue.deckPool || null,
        advisorController: laneValue && laneValue.advisorController || null,
        laneKey: value.laneKey,
        editability: {editable: true, reason: 'lane_intent'}
      };
    }
    if (value.kind === 'intent') {
      const card = cardByKey(cards, value.cardKey || dropContext.itemKey);
      return {
        kind: 'intent',
        key: value.key,
        title: [dropContext.itemTitle || dropContext.itemKey, dropContext.laneLabel || dropContext.laneKey].filter(Boolean).join(' -> '),
        intent: dropContext,
        card,
        laneKey: value.laneKey,
        editability: {editable: false, reason: 'manual_review'}
      };
    }
    const card = cardByKey(cards, value.cardKey || value.key);
    return {
      kind: 'card',
      key: card && card.key || value.key || '',
      title: displayCardTitle(card),
      card,
      laneKey: value.laneKey || laneForCard(card),
      editability: editabilityForCard(card, model)
    };
  }

  function deckPoolForHandTarget(target, deckPools) {
    if (!target || target.kind !== 'scene') {
      return null;
    }
    const targetId = String(target.id || '');
    return ensureArray(deckPools).find((pool) => deckPoolTargetsScene(pool, targetId)) || null;
  }

  function handRouteKey(baseKey, existingEntries) {
    const base = String(baseKey || 'hand:route').trim() || 'hand:route';
    const seen = new Set(ensureArray(existingEntries).map((entry) => String(entry && entry.key || '')));
    if (!seen.has(base)) {
      return base;
    }
    let index = 2;
    let candidate = base + ':route_' + index;
    while (seen.has(candidate)) {
      index += 1;
      candidate = base + ':route_' + index;
    }
    return candidate;
  }

  function deckPoolForRoute(lanes, route) {
    const targetId = String(route && route.targetId || '');
    const routePoolId = String(route && route.deckPoolId || '');
    const pools = ensureArray(lanes).filter((laneValue) => laneValue && laneValue.deckPool).map((laneValue) => laneValue.deckPool);
    if (routePoolId) {
      return pools.find((pool) => String(pool && pool.id || '') === routePoolId) || null;
    }
    return pools.find((pool) => deckPoolTargetsScene(pool, targetId)) || null;
  }

  function deckPoolTargetsScene(pool, targetId) {
    const value = pool || {};
    const wanted = String(targetId || '');
    if (!wanted) {
      return false;
    }
    if ([value.id, value.ownerSceneId, value.ownerSectionId].map(String).includes(wanted)) {
      return true;
    }
    if (ensureArray(value.directSceneIds).map(String).includes(wanted)) {
      return true;
    }
    return ensureArray(value.launcherRoutes).some((route) => String(route && route.targetId || '') === wanted);
  }

  function displayCardTitle(card) {
    if (!card) {
      return '';
    }
    return String(card.heading || card.title || card.id || '');
  }

  function optionForSelection(card, selection) {
    const options = ensureArray(card && card.options);
    const optionId = String(selection && selection.optionId || '');
    if (optionId) {
      const found = options.find((option) => String(option.id || '') === optionId);
      if (found) {
        return found;
      }
    }
    return options[Number(selection && selection.optionIndex || 0)] || null;
  }

  function routeByKey(lanes, key) {
    const hand = laneByKey(lanes, 'hand');
    return ensureArray(hand && hand.cards).find((route) => route.key === String(key || '')) || null;
  }

  function laneByKey(lanes, key) {
    return ensureArray(lanes).find((laneValue) => laneValue.key === String(key || '')) || null;
  }

  function laneForCard(card) {
    const laneKeys = ensureArray(card && card.laneKeys).filter((key) => key !== 'pool');
    return laneKeys[0] || 'pool';
  }

  function editabilityForCard(card, model) {
    if (!card) {
      return {editable: false, reason: 'missing'};
    }
    if (ensureArray(card.stateTags).includes('draft')) {
      return {editable: true, reason: 'draft'};
    }
    if (model && model.mode === 'existing' && String(model.objectId || '') === String(card.id || '')) {
      return {editable: true, reason: 'source_proposal'};
    }
    return {editable: false, reason: 'open_source_card'};
  }

  function normalizeType(value) {
    const text = String(value || 'all');
    return FILTER_TYPES.includes(text) ? text : 'all';
  }

  function cardByKey(cards, key) {
    return ensureArray(cards).find((card) => card.key === String(key || '')) || null;
  }

  function dedupeCards(cards) {
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

  function uniqueCards(cards) {
    return dedupeCards(cards);
  }

  function unique(values) {
    return Array.from(new Set(ensureArray(values).map(String).filter(Boolean)));
  }

  function searchable(card) {
    return [
      card.key,
      card.id,
      card.kind,
      card.title,
      card.heading,
      card.subtitle,
      card.body,
      ensureArray(card.tags).join(' '),
      ensureArray(card.stateTags).join(' ')
    ].join(' ').toLowerCase();
  }

  function localId(value) {
    const match = String(value || '').split('.').filter(Boolean).pop() || '';
    return match.trim();
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    return {
      path: String(value.path || ''),
      line: value.line || value.startLine || ''
    };
  }

  function laneAnchorRef(source, fallbackPath) {
    const value = isObject(source) ? source : {};
    const path = String(value.path || fallbackPath || '');
    const line = value.line || value.startLine || value.endLine || '';
    const anchorText = String(value.anchorText || value.endAnchorText || '');
    return path && line ? {path, line, anchorText} : null;
  }

  function first() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }
    return '';
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {buildBoard, collectCards};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapCardBoardModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
