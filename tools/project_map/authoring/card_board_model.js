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
    const laneList = decorateLanes(lanes, filteredCards, Object.assign({}, opts, {selectedKey: selected && selected.key || ''}));
    return {
      schemaVersion: '0.1',
      kind: 'card_board_model',
      query: String(opts.cardBoardQuery || ''),
      type: normalizeType(opts.cardBoardType),
      selectedKey: selected && selected.key || '',
      selectedLane,
      selected,
      labels: advisorLabels(index),
      lanes: laneList,
      metrics: {
        cardCount: cards.filter((card) => card.kind === 'card').length,
        advisorCount: cards.filter((card) => card.kind === 'advisor').length,
        visibleCardCount: filteredCards.length,
        unwiredCount: cards.filter((card) => card.laneKeys.length === 0).length,
        draftCount: cards.filter((card) => card.stateTags.includes('draft')).length
      },
      dropContext: normalizeDropContext(opts.cardBoardDropContext)
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
    const options = ensureArray(scene.options).map((option, index) => ({
      id: String(option && option.target && option.target.id || option && option.id || 'option_' + (index + 1)),
      label: String(option && (option.title || option.label) || text.optionLabels[index] || 'Choice ' + (index + 1)),
      targetId: String(option && option.target && option.target.id || '')
    }));
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
        targetId: String(option && option.gotoAfter || '')
      })),
      tags: ensureArray(draft.tags).map(String).filter(Boolean),
      source: {path: 'draft workspace'},
      stateTags: ['draft'].concat(change.changedCount ? ['changed'] : []),
      laneKeys: [],
      routeEvidence: [],
      raw: draft
    };
  }

  function buildLanes(index, cards) {
    const scenesById = new Map(ensureArray(index.scenes).map((scene) => [String(scene && scene.id || ''), scene]));
    const handScenes = semanticOrSceneList(index, 'hands', (scene) => scene.type === 'hand' || scene.flags && scene.flags.isHand);
    const deckScenes = semanticOrSceneList(index, 'decks', (scene) => scene.type === 'deck' || scene.flags && scene.flags.isDeck);
    const handEntries = [];
    const deckCards = [];
    const advisorCards = [];
    const laneMeta = {hand: {tags: []}, deck: {tags: []}, advisor: {tags: []}};
    const cardById = new Map(cards.map((card) => [card.id, card]));

    deckScenes.forEach((deck) => {
      const scene = scenesById.get(String(deck.id || '')) || deck;
      ensureArray(scene.options).forEach((option) => {
        const target = option && option.target || {};
        if (target.kind === 'tag') {
          laneMeta.deck.tags.push(String(target.id || ''));
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
        }
        handEntries.push({
          key: target.kind === 'scene' && linkedScene && linkedScene.type === 'deck' ? 'deck:' + linkedScene.id : matchedCards[0] && matchedCards[0].key || 'hand:' + (option.id || target.id || handEntries.length + 1),
          kind: target.kind === 'scene' && linkedScene && linkedScene.type === 'deck' ? 'deck' : matchedCards[0] && matchedCards[0].kind || 'route',
          title: option && option.title || linkedScene && linkedScene.title || target.id || 'Hand route',
          detail: target.kind === 'tag' ? '#' + target.id : '@' + target.id,
          source: sourceRef(option && option.sourceSpan || hand.sourceSpan || hand.source || {}),
          linkedCardKeys: matchedCards.map((card) => card.key)
        });
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
      lane('advisor', 'cardBoard.lane.advisor', 'Advisor / pinned', uniqueCards(advisorCards), laneMeta.advisor),
      lane('pool', 'cardBoard.lane.pool', 'All cards', cards, {}),
      lane('unwired', 'cardBoard.lane.unwired', 'Unwired', cards.filter((card) => card.laneKeys.includes('unwired')), {}),
      lane('drafts', 'cardBoard.lane.drafts', 'Drafts', cards.filter((card) => card.stateTags.includes('draft')), {})
    ];
  }

  function decorateLanes(lanes, filteredCards, opts) {
    const visible = new Set(filteredCards.map((card) => card.key));
    return lanes.map((laneValue) => {
      const allCards = ensureArray(laneValue.cards || laneValue.entries);
      const cards = laneValue.key === 'hand' ? allCards : allCards.filter((card) => visible.has(card.key)).map((card) => Object.assign({}, card, {selected: card.key === opts.selectedKey}));
      return Object.assign({}, laneValue, {
        selected: String(opts.cardBoardLane || '') === laneValue.key,
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
      action: String(ctx.action || '')
    };
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

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    return {
      path: String(value.path || ''),
      line: value.line || value.startLine || ''
    };
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
