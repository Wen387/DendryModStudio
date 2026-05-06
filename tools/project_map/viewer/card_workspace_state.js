(function initProjectMapCardWorkspaceState(global) {
  'use strict';

  function reset(state) {
    state.cardBoardSelectedKey = '';
    state.cardBoardLane = 'pool';
    state.cardBoardQuery = '';
    state.cardBoardType = 'all';
    state.cardBoardDropContext = null;
  }

  function isCardBoardState(state) {
    return state && ((state.mode === 'existing' && state.view === 'cards') || state.template === 'card');
  }

  function surfaceOptions(state) {
    return {
      selected: state.cardBoardSelectedKey || state.selectedCanvasNode,
      cardBoardSelectedKey: state.cardBoardSelectedKey || state.selectedCanvasNode,
      cardBoardLane: state.cardBoardLane || 'pool',
      cardBoardQuery: state.cardBoardQuery || '',
      cardBoardType: state.cardBoardType || 'all',
      cardBoardDropContext: state.cardBoardDropContext || null
    };
  }

  function renderStage(state, model) {
    const surface = global.ProjectMapCardBoardSurface;
    return surface && typeof surface.render === 'function'
      ? surface.render(model, Object.assign({
        projectIndex: state.projectIndex,
        editorOverlay: state.editorOverlay
      }, surfaceOptions(state)))
      : '';
  }

  function bind(root, state, deps) {
    const interactions = global.ProjectMapCardBoardInteractions;
    if (!interactions || typeof interactions.bind !== 'function') {
      return;
    }
    interactions.bind(root, {
      onSelect: (key) => selectCard(state, key, deps),
      onQuery: (query) => rebuild(state, deps, {cardBoardQuery: String(query || '')}),
      onType: (type) => rebuild(state, deps, {cardBoardType: normalizeType(type)}),
      onDrop: (payload, target) => dropCard(state, payload, target, deps),
      onCreate: (button) => createInLane(state, button, deps)
    });
  }

  function openFromSystemRegion(state, target, deps) {
    const dataset = target && target.dataset || {};
    const regionKey = String(dataset.systemUiRegionKey || '');
    const laneKey = String(dataset.systemUiCardBoardLane || 'deck');
    const draft = deps.defaultDraftForTemplate('card') || {};
    if (laneKey === 'advisor') {
      draft.cardKind = 'advisor_like';
    } else {
      draft.cardKind = 'action_card';
    }
    draft.title = draft.title || (laneKey === 'advisor'
      ? deps.t('cardBoard.sample.advisorTitle', 'New Advisor Card')
      : deps.t('cardBoard.sample.cardTitle', 'New Action Card'));
    draft.heading = draft.heading || draft.title;
    state.mode = 'card';
    state.template = 'card';
    state.view = 'card';
    state.item = null;
    state.workspace = 'content';
    state.baseDraft = draft;
    state.values = {};
    state.cardBoardLane = laneKey;
    state.cardBoardSelectedKey = 'draft:card:' + (draft.id || 'new_action_card');
    state.selectedCanvasNode = state.cardBoardSelectedKey;
    state.cardBoardDropContext = {
      itemKey: state.cardBoardSelectedKey,
      itemTitle: draft.title,
      laneKey,
      laneLabel: String(dataset.systemUiCardBoardLaneLabel || laneKey),
      laneTag: '',
      regionKey,
      action: 'system_region'
    };
    state.model = deps.buildTemplateModel({values: {}, entry: {source: 'System UI Card Board'}});
    state.status = deps.t('cardBoard.status.systemRegion', 'Card Board opened from the selected UI region.');
    deps.showWorkspace('card');
    deps.render();
    return true;
  }

  function selectCard(state, key, deps) {
    if (!isCardBoardState(state)) {
      return false;
    }
    const parsed = parseCardKey(key);
    if (!parsed || parsed.kind === 'draft') {
      return rebuild(state, deps, {
        selectedCanvasNode: key || 'object',
        cardBoardSelectedKey: key || '',
        cardBoardLane: parsed && parsed.kind === 'draft' ? 'drafts' : state.cardBoardLane || 'pool'
      });
    }
    const nextModel = deps.buildExistingModelFor('cards', parsed.id, {values: {}});
    if (!nextModel || !nextModel.ok) {
      return rebuild(state, deps, {selectedCanvasNode: key, cardBoardSelectedKey: key});
    }
    state.mode = 'existing';
    state.template = 'existing';
    state.view = 'cards';
    state.item = parsed.id;
    state.workspace = 'content';
    state.values = {};
    state.model = nextModel;
    state.selectedCanvasNode = key;
    state.cardBoardSelectedKey = key;
    state.cardBoardLane = parsed.kind === 'advisor' ? 'advisor' : state.cardBoardLane || 'pool';
    state.status = deps.t('cardBoard.status.cardSelected', 'Card opened in the Card Board editor.');
    deps.showWorkspace('card');
    deps.render();
    return true;
  }

  function createInLane(state, button, deps) {
    const dataset = button && button.dataset || {};
    const laneKey = String(dataset.cardBoardCreateLane || 'deck');
    const laneTag = String(dataset.cardBoardLaneTag || '');
    const draft = deps.defaultDraftForTemplate('card') || {};
    if (laneKey === 'advisor') {
      draft.cardKind = 'advisor_like';
    }
    if (laneTag) {
      draft.tags = [laneTag];
    }
    draft.title = laneKey === 'advisor'
      ? deps.t('cardBoard.sample.advisorTitle', 'New Advisor Card')
      : deps.t('cardBoard.sample.cardTitle', 'New Action Card');
    draft.heading = draft.title;
    state.mode = 'card';
    state.template = 'card';
    state.view = 'card';
    state.item = null;
    state.workspace = 'content';
    state.baseDraft = draft;
    state.values = {};
    state.cardBoardLane = laneKey;
    state.cardBoardSelectedKey = 'draft:card:' + (draft.id || 'new_action_card');
    state.selectedCanvasNode = state.cardBoardSelectedKey;
    state.cardBoardDropContext = {
      itemKey: state.cardBoardSelectedKey,
      itemTitle: draft.title,
      laneKey,
      laneLabel: String(dataset.cardBoardLaneLabel || laneKey),
      laneTag,
      action: 'create'
    };
    state.model = deps.buildTemplateModel({values: {}, entry: {source: 'Card Board'}});
    state.status = deps.t('cardBoard.status.createInLane', 'New card draft is using this board lane as context.');
    deps.showWorkspace('card');
    deps.render();
    return true;
  }

  function dropCard(state, payload, target, deps) {
    const itemKey = String(payload && payload.key || '').trim();
    const dataset = target && target.dataset || {};
    const laneKey = String(dataset.cardBoardDropTarget || '').trim();
    if (!itemKey || !laneKey) {
      state.status = deps.t('cardBoard.status.dropUnsupported', 'This card drop is not supported here.');
      deps.render();
      return false;
    }
    const laneTag = String(dataset.cardBoardLaneTag || '');
    const laneLabel = String(dataset.cardBoardLaneLabel || laneKey);
    state.cardBoardDropContext = {
      itemKey,
      itemTitle: String(payload.title || ''),
      laneKey,
      laneLabel,
      laneTag,
      action: 'move'
    };
    state.cardBoardLane = laneKey;
    state.cardBoardSelectedKey = itemKey;
    state.selectedCanvasNode = itemKey;
    if (itemKey.indexOf('draft:') === 0 || state.template === 'card' && state.mode !== 'existing') {
      state.values = deps.collectValues();
      if (laneTag) {
        state.values['card.tags'] = laneTag;
      }
      if (laneKey === 'advisor') {
        state.values['card.cardKind'] = 'advisor_like';
      } else if (laneKey === 'deck') {
        state.values['card.cardKind'] = 'action_card';
      }
    }
    state.status = deps.t('cardBoard.status.dropRecorded', 'Card Board recorded this lane intent for review.');
    state.model = state.mode === 'existing' ? deps.buildExistingModel({values: state.values}) : deps.buildTemplateModel({values: state.values, entry: {source: 'Card Board'}});
    deps.render();
    return true;
  }

  function draftWithContext(state, draft) {
    if (!draft || typeof draft !== 'object' || !isCardBoardState(state)) {
      return draft;
    }
    return Object.assign({}, draft, {
      studioAuthoringContext: {
        workspace: 'content',
        surface: 'card_board',
        selectedCardKey: state.cardBoardSelectedKey || state.selectedCanvasNode,
        selectedLane: state.cardBoardLane || 'pool',
        cardBoardQuery: state.cardBoardQuery || '',
        cardBoardType: state.cardBoardType || 'all',
        cardBoardDropContext: state.cardBoardDropContext || null,
        editorOverlay: Boolean(state.editorOverlay)
      }
    });
  }

  function restoreContext(state, context, deps) {
    const value = context && typeof context === 'object' ? context : {};
    if (value.surface !== 'card_board') {
      return false;
    }
    state.workspace = 'content';
    state.cardBoardSelectedKey = String(value.selectedCardKey || state.selectedCanvasNode || '');
    state.selectedCanvasNode = state.cardBoardSelectedKey || state.selectedCanvasNode;
    state.cardBoardLane = String(value.selectedLane || 'pool');
    state.cardBoardQuery = String(value.cardBoardQuery || '');
    state.cardBoardType = normalizeType(value.cardBoardType);
    state.cardBoardDropContext = value.cardBoardDropContext && typeof value.cardBoardDropContext === 'object' ? Object.assign({}, value.cardBoardDropContext) : null;
    state.editorOverlay = Boolean(value.editorOverlay);
    state.model = state.mode === 'existing' ? deps.buildExistingModel({values: state.values}) : deps.buildTemplateModel({values: state.values});
    deps.render();
    return true;
  }

  function rebuild(state, deps, patch) {
    Object.assign(state, patch || {});
    state.values = deps.collectValues();
    state.model = state.mode === 'existing' ? deps.buildExistingModel({values: state.values}) : deps.buildTemplateModel({values: state.values, entry: {source: 'Card Board'}});
    deps.render();
    return true;
  }

  function parseCardKey(key) {
    const match = String(key || '').match(/^(card|advisor|draft):(.+)$/);
    if (!match) {
      return null;
    }
    return {
      kind: match[1],
      id: match[1] === 'draft' ? match[2].replace(/^card:/, '') : match[2]
    };
  }

  function normalizeType(value) {
    const text = String(value || 'all');
    return ['all', 'card', 'advisor', 'deck', 'draft', 'unwired'].includes(text) ? text : 'all';
  }

  const api = {bind, draftWithContext, isCardBoardState, openFromSystemRegion, renderStage, reset, restoreContext, selectCard};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapCardWorkspaceState = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
