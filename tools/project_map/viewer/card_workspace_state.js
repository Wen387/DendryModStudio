(function initProjectMapCardWorkspaceState(global) {
  'use strict';

  function reset(state) {
    state.cardBoardSelectedKey = '';
    state.cardBoardLane = 'pool';
    state.cardBoardQuery = '';
    state.cardBoardType = 'all';
    state.cardBoardDropContext = null;
    state.cardBoardSelection = null;
  }

  function isCardBoardState(state) {
    return state && ((state.mode === 'existing' && state.view === 'cards') || ['card', 'deck_pool', 'advisor_controller'].includes(state.template));
  }

  function surfaceOptions(state) {
    return {
      selected: state.cardBoardSelectedKey || state.selectedCanvasNode,
      cardBoardSelectedKey: state.cardBoardSelectedKey || state.selectedCanvasNode,
      cardBoardLane: state.cardBoardLane || 'pool',
      cardBoardQuery: state.cardBoardQuery || '',
      cardBoardType: state.cardBoardType || 'all',
      cardBoardDropContext: state.cardBoardDropContext || null,
      cardBoardSelection: state.cardBoardSelection || null
    };
  }

  function renderStage(state, model) {
    const surface = global.ProjectMapCardBoardSurface;
    return surface && typeof surface.render === 'function'
      ? surface.render(model, Object.assign({
        projectIndex: state.projectIndex,
        editorOverlay: state.editorOverlay,
        runtimeLensSession: state.runtimeLensSession,
        runtimeLensStatus: state.runtimeLensStatus,
        runtimeLensFocusKey: state.runtimeLensFocusKey,
        runtimeLensDraftKey: state.runtimeLensDraftKey,
        runtimeLensCurrentDraftKey: state.runtimeLensCurrentDraftKey,
        runtimeLensExpanded: state.runtimeLensExpanded,
        runtimeLensCollapsed: state.runtimeLensCollapsed,
        boardChromeCollapsed: Boolean(state.boardChromeCollapsed)
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
      onCreate: (button) => createInLane(state, button, deps),
      onObjectSelect: (selection) => selectObject(state, selection, deps),
      onAction: (action, button) => handleAction(state, action, button, deps)
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
    state.cardBoardSelection = intentSelection(state.cardBoardSelectedKey, laneKey);
    state.editorOverlay = true;
    state.model = deps.buildTemplateModel({values: {}, entry: {source: 'System UI Card Board'}});
    state.status = deps.t('cardBoard.status.systemRegion', 'Card Board opened from the selected UI region.');
    deps.showWorkspace('card');
    deps.render();
    return true;
  }

  function selectCard(state, key, deps) {
    return perfMeasure('selectCard', () => selectCardImpl(state, key, deps), {key: String(key || '')});
  }

  function selectCardImpl(state, key, deps) {
    if (!isCardBoardState(state)) {
      return false;
    }
    const parsed = parseCardKey(key);
    if (!parsed || parsed.kind === 'draft') {
      const laneKey = parsed && parsed.kind === 'draft' ? 'drafts' : state.cardBoardLane || 'pool';
      return rebuild(state, deps, {
        selectedCanvasNode: key || 'object',
        cardBoardSelectedKey: key || '',
        cardBoardLane: laneKey,
        cardBoardSelection: cardSelection(key || '', laneKey),
        editorOverlay: Boolean(key)
      });
    }
    if (state.editorOverlay) {
      return openCardEditorForKey(state, key, deps, {
        status: deps.t('cardBoard.status.cardSelected', 'Card opened in the Card Board editor.')
      });
    }
    state.mode = 'existing';
    state.template = 'existing';
    state.view = 'cards';
    state.item = parsed.id;
    state.workspace = 'content';
    state.values = {};
    state.model = lightweightCardInspectModel(state.projectIndex, parsed.id, key);
    state.selectedCanvasNode = key;
    state.cardBoardSelectedKey = key;
    state.cardBoardLane = parsed.kind === 'advisor' ? 'advisor' : state.cardBoardLane || 'pool';
    state.cardBoardSelection = cardSelection(key, state.cardBoardLane);
    state.editorOverlay = false;
    state.status = deps.t('cardBoard.status.cardSelectedLight', 'Card selected. Open the Object Editor when you are ready to edit.');
    deps.showWorkspace('card');
    deps.render();
    return true;
  }

  function selectObject(state, selection, deps) {
    if (!isCardBoardState(state)) {
      return false;
    }
    const next = normalizeSelection(selection, state);
    if (next.kind === 'card') {
      return selectCard(state, next.cardKey || next.key, deps);
    }
    if (next.kind === 'option') {
      return selectCardObject(state, next, deps);
    }
    const patch = {
      selectedCanvasNode: next.key || next.laneKey || 'object',
      cardBoardSelection: next
    };
    if (next.kind === 'lane') {
      patch.cardBoardLane = next.laneKey || 'pool';
    }
    state.status = statusForSelection(next, deps);
    return rebuild(state, deps, patch);
  }

  function selectCardObject(state, selection, deps) {
    const cardKey = String(selection && selection.cardKey || '').trim();
    if (!cardKey) {
      return false;
    }
    const parsed = parseCardKey(cardKey);
    const normalizedSelection = Object.assign({kind: 'option'}, selection, {cardKey});
    const sameOpenCard = parsed && parsed.kind !== 'draft' && state.editorOverlay &&
      state.mode === 'existing' && state.view === 'cards' && String(state.item || '') === parsed.id;
    if (sameOpenCard) {
      state.selectedCanvasNode = cardKey;
      state.cardBoardSelectedKey = cardKey;
      state.cardBoardSelection = normalizedSelection;
      state.status = deps.t('cardBoard.status.optionSelected', 'Card choice selected in the Card Board editor.');
      deps.showWorkspace('card');
      focusSelectedOptionField(state.cardBoardSelection, deps);
      return true;
    }
    if (parsed && parsed.kind !== 'draft') {
      return openCardEditorForKey(state, cardKey, deps, {
        selection: normalizedSelection,
        focusFieldId: fieldIdForSelection(normalizedSelection),
        status: deps.t('cardBoard.status.optionSelected', 'Card choice selected in the Card Board editor.')
      });
    }
    state.values = deps.collectValues();
    state.model = state.mode === 'existing' ? deps.buildExistingModel({values: state.values}) : deps.buildTemplateModel({values: state.values, entry: {source: 'Card Board'}});
    state.selectedCanvasNode = cardKey;
    state.cardBoardSelectedKey = cardKey;
    state.cardBoardSelection = normalizedSelection;
    state.editorOverlay = true;
    state.status = deps.t('cardBoard.status.optionSelected', 'Card choice selected in the Card Board editor.');
    deps.showWorkspace('card');
    deps.render();
    focusSelectedOptionField(state.cardBoardSelection, deps);
    return true;
  }

  function openSelectedCardEditor(state, deps, options) {
    if (!isCardBoardState(state)) {
      return false;
    }
    const opts = options && typeof options === 'object' ? options : {};
    const selection = opts.selection || state.cardBoardSelection || {};
    const key = String(opts.cardKey || selection.cardKey || state.cardBoardSelectedKey || state.selectedCanvasNode || '').trim();
    return openCardEditorForKey(state, key, deps, {
      selection,
      focusFieldId: opts.focusFieldId || (selection.kind === 'option' ? fieldIdForSelection(selection) : ''),
      status: opts.status || deps.t('cardBoard.status.cardSelected', 'Card opened in the Card Board editor.')
    });
  }

  function openCardEditorForKey(state, key, deps, options) {
    const parsed = parseCardKey(key);
    if (!parsed || parsed.kind === 'draft') {
      return false;
    }
    const opts = options && typeof options === 'object' ? options : {};
    const nextModel = deps.buildExistingModelFor('cards', parsed.id, {values: {}});
    if (!nextModel || !nextModel.ok) {
      return rebuild(state, deps, {selectedCanvasNode: key, cardBoardSelectedKey: key});
    }
    const laneKey = parsed.kind === 'advisor' ? 'advisor' : state.cardBoardLane || 'pool';
    state.mode = 'existing';
    state.template = 'existing';
    state.view = 'cards';
    state.item = parsed.id;
    state.workspace = 'content';
    state.values = {};
    state.model = nextModel;
    state.selectedCanvasNode = key;
    state.cardBoardSelectedKey = key;
    state.cardBoardLane = laneKey;
    state.cardBoardSelection = opts.selection || cardSelection(key, laneKey);
    state.editorOverlay = true;
    state.status = opts.status || deps.t('cardBoard.status.cardSelected', 'Card opened in the Card Board editor.');
    deps.showWorkspace('card');
    deps.render();
    if (opts.focusFieldId) {
      focusSelectedOptionField(Object.assign({}, state.cardBoardSelection, {fieldId: opts.focusFieldId}), deps);
    }
    return true;
  }

  function handleAction(state, action, target, deps) {
    if (!isCardBoardState(state)) {
      return false;
    }
    const value = String(action || '').trim();
    if (value === 'duplicate_card') {
      return duplicateSelectedCard(state, deps);
    }
    if (value === 'add_to_deck') {
      return recordLaneIntent(state, 'deck', 'add_to_deck', deps);
    }
    if (value === 'add_to_advisor') {
      return recordLaneIntent(state, 'advisor', 'add_to_advisor', deps);
    }
    if (value === 'remove_from_lane') {
      return recordLaneIntent(state, 'unwired', 'remove_from_lane', deps);
    }
    if (value === 'set_card_kind_action') {
      return setDraftCardKind(state, 'action_card', 'deck', deps);
    }
    if (value === 'set_card_kind_advisor') {
      return setDraftCardKind(state, 'advisor_like', 'advisor', deps);
    }
    if (value === 'create_in_selected_lane') {
      return createInLane(state, target || fakeLaneButton(state.cardBoardLane || 'deck'), deps);
    }
    if (value === 'open_deck_pool_editor') {
      return openLaneObjectEditor(state, 'deck_pool', target, deps);
    }
    if (value === 'open_advisor_controller_editor') {
      return openLaneObjectEditor(state, 'advisor_controller', target, deps);
    }
    if (value === 'open_card_editor') {
      return openSelectedCardEditor(state, deps, {
        cardKey: target && target.dataset && target.dataset.cardBoardActionCard || '',
        focusFieldId: target && target.dataset && target.dataset.cardBoardOptionField || ''
      });
    }
    if (value === 'open_linked_card') {
      return selectCard(state, target && target.dataset && target.dataset.cardBoardActionCard || '', deps);
    }
    return false;
  }

  function openLaneObjectEditor(state, template, target, deps) {
    const board = currentBoard(state);
    const dataset = target && target.dataset || {};
    const selectedObject = board && board.selectedObject || {};
    let lane = selectedObject.lane || boardLane(board, state.cardBoardLane || '');
    const id = template === 'deck_pool'
      ? String(dataset.cardBoardDeckPool || selectedObject.deckPool && selectedObject.deckPool.id || lane && lane.deckPool && lane.deckPool.id || '')
      : String(dataset.cardBoardAdvisorController || selectedObject.advisorController && selectedObject.advisorController.id || lane && lane.advisorController && lane.advisorController.id || '');
    lane = semanticLaneForObject(board, template, id) || lane;
    const draft = draftForLaneObject(template, state.projectIndex, id);
    if (!draft || !draft.id) {
      state.status = deps.t('cardBoard.status.semanticObjectMissing', 'This board lane does not have a complete semantic object yet.');
      deps.render();
      return false;
    }
    state.mode = template;
    state.template = template;
    state.view = template;
    state.item = id;
    state.workspace = 'content';
    state.baseDraft = draft;
    state.values = {};
    state.selectedCanvasNode = template + ':' + id;
    state.cardBoardSelectedKey = state.selectedCanvasNode;
    state.cardBoardLane = lane && lane.key || state.cardBoardLane || 'pool';
    state.cardBoardSelection = {kind: 'lane', key: 'lane:' + state.cardBoardLane, laneKey: state.cardBoardLane};
    state.editorOverlay = true;
    state.model = deps.buildTemplateModel({values: {}, entry: {source: 'Card Board lane'}});
    state.status = template === 'deck_pool'
      ? deps.t('cardBoard.status.deckPoolOpened', 'Deck pool opened in the Object Editor.')
      : deps.t('cardBoard.status.advisorControllerOpened', 'Advisor controller opened in the Object Editor.');
    deps.showWorkspace(template);
    deps.render();
    return true;
  }

  function draftForLaneObject(template, projectIndex, id) {
    const api = template === 'deck_pool' ? deckPoolDraftApi() : advisorControllerDraftApi();
    if (api && template === 'deck_pool' && typeof api.draftForPool === 'function') {
      return api.draftForPool(projectIndex, id);
    }
    if (api && template === 'advisor_controller' && typeof api.draftForController === 'function') {
      return api.draftForController(projectIndex, id);
    }
    return null;
  }

  function laneAnchorFromDataset(dataset) {
    const value = dataset || {};
    const path = String(value.cardBoardLaneSourcePath || '');
    const line = String(value.cardBoardLaneSourceLine || '');
    const anchorText = String(value.cardBoardLaneAnchorText || '');
    return path && line ? {path, line, anchorText} : null;
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
      laneAnchor: laneAnchorFromDataset(dataset),
      action: 'create'
    };
    state.cardBoardSelection = intentSelection(state.cardBoardSelectedKey, laneKey);
    state.editorOverlay = true;
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
      laneAnchor: laneAnchorFromDataset(dataset),
      action: 'move'
    };
    state.cardBoardLane = laneKey;
    state.cardBoardSelectedKey = itemKey;
    state.selectedCanvasNode = itemKey;
    state.cardBoardSelection = intentSelection(itemKey, laneKey);
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
    state.editorOverlay = true;
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
        cardBoardSelection: state.cardBoardSelection || null,
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
    state.cardBoardSelection = value.cardBoardSelection && typeof value.cardBoardSelection === 'object' ? Object.assign({}, value.cardBoardSelection) : null;
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

  function duplicateSelectedCard(state, deps) {
    const board = currentBoard(state);
    const card = selectedCard(board);
    if (!card) {
      state.status = deps.t('cardBoard.status.noCardForAction', 'Select a card before using this Card Board action.');
      deps.render();
      return false;
    }
    const draft = draftFromCard(card, state);
    state.mode = 'card';
    state.template = 'card';
    state.view = 'card';
    state.item = null;
    state.workspace = 'content';
    state.baseDraft = draft;
    state.values = {};
    state.cardBoardLane = laneForDraft(draft, card);
    state.cardBoardSelectedKey = 'draft:card:' + draft.id;
    state.selectedCanvasNode = state.cardBoardSelectedKey;
    state.cardBoardDropContext = null;
    state.cardBoardSelection = cardSelection(state.cardBoardSelectedKey, state.cardBoardLane);
    state.model = deps.buildTemplateModel({values: {}, entry: {source: 'Card Board duplicate'}});
    state.status = deps.t('cardBoard.status.duplicated', 'Copied the selected card into an editable draft.');
    deps.showWorkspace('card');
    deps.render();
    return true;
  }

  function recordLaneIntent(state, laneKey, action, deps) {
    const board = currentBoard(state);
    const card = selectedCard(board);
    if (!card) {
      state.status = deps.t('cardBoard.status.noCardForAction', 'Select a card before using this Card Board action.');
      deps.render();
      return false;
    }
    const lane = boardLane(board, laneKey);
    const laneLabel = lane && (deps.t(lane.labelKey, lane.fallback || lane.key) || lane.key) || laneKey;
    const laneTag = lane && lane.tag || '';
    state.values = deps.collectValues();
    if (isDraftLikeCard(card, state)) {
      if (laneKey === 'advisor') {
        state.values['card.cardKind'] = 'advisor_like';
      } else if (laneKey === 'deck') {
        state.values['card.cardKind'] = 'action_card';
      }
      if (laneTag) {
        state.values['card.tags'] = laneTag;
      }
    }
    state.cardBoardLane = laneKey;
    state.cardBoardSelectedKey = card.key;
    state.selectedCanvasNode = card.key;
    state.cardBoardDropContext = {
      itemKey: card.key,
      itemTitle: card.title || card.heading || card.id || card.key,
      laneKey,
      laneLabel,
      laneTag,
      action
    };
    state.cardBoardSelection = intentSelection(card.key, laneKey);
    state.model = state.mode === 'existing' ? deps.buildExistingModel({values: state.values}) : deps.buildTemplateModel({values: state.values, entry: {source: 'Card Board'}});
    state.status = deps.t('cardBoard.status.intentRecorded', 'Card Board recorded this card-lane intent for review.');
    deps.render();
    return true;
  }

  function setDraftCardKind(state, cardKind, laneKey, deps) {
    state.values = deps.collectValues();
    state.values['card.cardKind'] = cardKind;
    state.cardBoardLane = laneKey;
    state.cardBoardSelection = cardSelection(state.cardBoardSelectedKey || state.selectedCanvasNode || '', laneKey);
    state.model = state.mode === 'existing' ? deps.buildExistingModel({values: state.values}) : deps.buildTemplateModel({values: state.values, entry: {source: 'Card Board'}});
    state.status = deps.t('cardBoard.status.kindChanged', 'Card Board updated the draft card kind.');
    deps.render();
    return true;
  }

  function currentBoard(state) {
    const api = global.ProjectMapCardBoardModel;
    return api && typeof api.buildBoard === 'function'
      ? perfMeasure('buildBoard', () => api.buildBoard(state.projectIndex, state.model, surfaceOptions(state)), {source: 'currentBoard'})
      : {lanes: [], selected: null, selectedObject: null};
  }

  function selectedCard(board) {
    const object = board && board.selectedObject || {};
    if (object.card) {
      return object.card;
    }
    const intent = object.intent || {};
    if (intent.itemKey) {
      return cardFromBoard(board, intent.itemKey);
    }
    return board && board.selected || null;
  }

  function cardFromBoard(board, key) {
    const target = String(key || '');
    for (const lane of ensureArray(board && board.lanes)) {
      const found = ensureArray(lane.cards).find((card) => card && card.key === target && (card.kind === 'card' || card.kind === 'advisor'));
      if (found) {
        return found;
      }
    }
    return null;
  }

  function boardLane(board, key) {
    return ensureArray(board && board.lanes).find((lane) => lane && lane.key === String(key || '')) || null;
  }

  function semanticLaneForObject(board, template, id) {
    const objectId = String(id || '');
    if (!objectId) {
      return null;
    }
    return ensureArray(board && board.lanes).find((lane) => {
      if (!lane) {
        return false;
      }
      if (template === 'deck_pool') {
        return String(lane.deckPool && lane.deckPool.id || '') === objectId;
      }
      if (template === 'advisor_controller') {
        return String(lane.advisorController && lane.advisorController.id || '') === objectId;
      }
      return false;
    }) || null;
  }

  function lightweightCardInspectModel(projectIndex, cardId, key) {
    const card = lightweightCardFromIndex(projectIndex, cardId, key);
    return {
      ok: true,
      schemaVersion: '0.1',
      kind: 'object_authoring_canvas_model',
      mode: 'existing',
      template: 'existing',
      objectKind: 'card',
      objectId: '__card_board_lightweight__',
      title: card.title || cardId || 'Card',
      source: card.source || {},
      eventBody: {},
      changeState: {
        draft: null,
        proposal: null,
        output: {},
        installPlan: null,
        operationSummary: {safeApply: 0, guardedApply: 0, manualReview: 0, refused: 0},
        changedCount: 0,
        diagnostics: [],
        warnings: []
      }
    };
  }

  function lightweightCardFromIndex(projectIndex, cardId, key) {
    const index = projectIndex && typeof projectIndex === 'object' ? projectIndex : {};
    const id = String(cardId || '');
    const scene = ensureArray(index.scenes).find((item) => String(item && item.id || '') === id) || {};
    const text = textForScene(index, id);
    const title = String(text.heading || text.title || scene.title || id || '');
    return {
      key: String(key || ''),
      id,
      title,
      source: sourceRef(scene.sourceSpan || scene.topLevelSpan || {path: scene.path})
    };
  }

  function textForScene(index, sceneId) {
    const out = {};
    ensureArray(index && index.semantic && index.semantic.textCorpus && index.semantic.textCorpus.items).forEach((row) => {
      const owner = row && row.owner || {};
      if (String(owner.sceneId || '') !== String(sceneId || '')) {
        return;
      }
      const role = String(row.role || '');
      if ((role === 'heading' || role === 'title') && !out[role]) {
        out[role] = String(row.text || '');
      }
    });
    return out;
  }

  function sourceRef(source) {
    const value = source && typeof source === 'object' ? source : {};
    return {
      path: String(value.path || ''),
      line: value.line || value.startLine || ''
    };
  }

  function focusSelectedOptionField(selection, deps) {
    if (!deps || typeof deps.focusDraftField !== 'function') {
      return false;
    }
    const fieldId = fieldIdForSelection(selection) || 'card.title';
    return deps.focusDraftField(fieldId);
  }

  function fieldIdForSelection(selection) {
    const value = selection && typeof selection === 'object' ? selection : {};
    const explicit = String(value.fieldId || '').trim();
    if (explicit) {
      return explicit;
    }
    const optionPath = String(value.optionPath || '').trim();
    const sectionMatch = optionPath.match(/^section\.(\d+)\.(\d+)$/);
    if (sectionMatch) {
      return 'card.section.' + sectionMatch[1] + '.option.' + sectionMatch[2] + '.label';
    }
    const sectionIndex = value.sectionIndex !== undefined && value.sectionIndex !== null
      ? Number(value.sectionIndex)
      : NaN;
    if (Number.isFinite(sectionIndex)) {
      return 'card.section.' + sectionIndex + '.option.' + Number(value.optionIndex || 0) + '.label';
    }
    if (value.optionIndex === undefined || value.optionIndex === null || value.optionIndex === '') {
      return 'card.title';
    }
    return 'card.option.' + Number(value.optionIndex || 0) + '.label';
  }

  function parsedDraftFromCard(card, state) {
    if (!card || !card.id || String(card.key || '').indexOf('draft:') === 0) {
      return null;
    }
    const api = parsedToDraftApi();
    if (!api || typeof api.buildDraftFromParsed !== 'function') {
      return null;
    }
    try {
      const result = api.buildDraftFromParsed(state && state.projectIndex, {
        view: 'cards',
        itemId: card.id,
        newId: safeId((card.id || card.title || 'card') + '_draft')
      });
      return result && result.draft || null;
    } catch (_err) {
      return null;
    }
  }

  function draftFromCard(card, state) {
    const parsedDraft = parsedDraftFromCard(card, state);
    if (parsedDraft) {
      return parsedDraft;
    }
    const options = ensureArray(card.options).map((option, index) => ({
      id: safeId(option.id || 'option_' + (index + 1)),
      label: String(option.label || option.id || 'Option ' + (index + 1)),
      title: '',
      subtitle: '',
      chooseIf: '',
      narrativeParagraphs: [],
      gotoAfter: safeId(option.targetId || 'root') || 'root'
    }));
    return {
      schemaVersion: '0.1',
      kind: 'card',
      id: safeId((card.id || card.title || 'card') + '_draft'),
      title: String(card.title || card.heading || card.id || 'New Action Card'),
      heading: String(card.heading || card.title || card.id || 'New Action Card'),
      subtitle: String(card.subtitle || ''),
      introParagraphs: String(card.body || '').trim() ? [String(card.body || '').trim()] : [],
      cardKind: card.kind === 'advisor' ? 'advisor_like' : 'action_card',
      tags: ensureArray(card.tags).map(String),
      options: options.length ? options : [{id: 'return', label: 'Return', narrativeParagraphs: [], gotoAfter: 'root'}],
      sourceSceneId: String(card.id || ''),
      source: card.source || {}
    };
  }

  function isDraftLikeCard(card, state) {
    return Boolean(card && (String(card.key || '').indexOf('draft:') === 0 || state.template === 'card' && state.mode !== 'existing'));
  }

  function laneForDraft(draft, card) {
    if (draft && draft.cardKind === 'advisor_like') {
      return 'advisor';
    }
    const lanes = ensureArray(card && card.laneKeys).filter((key) => key !== 'pool');
    return lanes[0] || 'drafts';
  }

  function normalizeSelection(selection, state) {
    const raw = selection && typeof selection === 'object' ? selection : {};
    const kind = String(raw.kind || '').trim();
    if (kind === 'option') {
      const cardKey = String(raw.cardKey || state.cardBoardSelectedKey || state.selectedCanvasNode || '');
      const optionIndex = Number(raw.optionIndex || 0);
      return {
        kind: 'option',
        key: String(raw.key || 'option:' + cardKey + ':' + optionIndex),
        cardKey,
        optionIndex,
        sectionIndex: raw.sectionIndex !== undefined && raw.sectionIndex !== null && raw.sectionIndex !== '' ? Number(raw.sectionIndex) : null,
        optionId: String(raw.optionId || ''),
        fieldId: String(raw.fieldId || ''),
        optionPath: String(raw.optionPath || ''),
        sectionId: String(raw.sectionId || ''),
        laneKey: String(raw.laneKey || state.cardBoardLane || 'pool')
      };
    }
    if (kind === 'route') {
      return {kind: 'route', key: String(raw.key || ''), laneKey: 'hand'};
    }
    if (kind === 'lane') {
      const laneKey = String(raw.laneKey || state.cardBoardLane || 'pool');
      return {kind: 'lane', key: 'lane:' + laneKey, laneKey};
    }
    if (kind === 'intent') {
      const context = state.cardBoardDropContext || {};
      return {
        kind: 'intent',
        key: String(raw.key || 'intent:' + (context.itemKey || '') + ':' + (context.laneKey || '')),
        cardKey: String(context.itemKey || state.cardBoardSelectedKey || ''),
        laneKey: String(context.laneKey || state.cardBoardLane || 'pool')
      };
    }
    const key = String(raw.cardKey || raw.key || state.cardBoardSelectedKey || state.selectedCanvasNode || '');
    return cardSelection(key, String(raw.laneKey || state.cardBoardLane || 'pool'));
  }

  function statusForSelection(selection, deps) {
    if (selection.kind === 'route') {
      return deps.t('cardBoard.status.routeSelected', 'Hand route selected in the Card Board editor.');
    }
    if (selection.kind === 'lane') {
      return deps.t('cardBoard.status.laneSelected', 'Card Board lane selected.');
    }
    if (selection.kind === 'intent') {
      return deps.t('cardBoard.status.intentSelected', 'Board intent selected for review.');
    }
    return deps.t('cardBoard.status.cardSelected', 'Card opened in the Card Board editor.');
  }

  function cardSelection(key, laneKey) {
    return {
      kind: 'card',
      key: String(key || ''),
      cardKey: String(key || ''),
      laneKey: String(laneKey || 'pool')
    };
  }

  function intentSelection(cardKey, laneKey) {
    return {
      kind: 'intent',
      key: 'intent:' + String(cardKey || '') + ':' + String(laneKey || ''),
      cardKey: String(cardKey || ''),
      laneKey: String(laneKey || 'pool')
    };
  }

  function fakeLaneButton(laneKey) {
    return {
      dataset: {
        cardBoardCreateLane: String(laneKey || 'deck'),
        cardBoardLaneLabel: String(laneKey || 'deck'),
        cardBoardLaneTag: ''
      }
    };
  }

  function deckPoolDraftApi() {
    if (global && global.ProjectMapDeckPoolDraft) {
      return global.ProjectMapDeckPoolDraft;
    }
    if (typeof require === 'function') {
      try {
        return require('../authoring/deck_pool_draft.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function advisorControllerDraftApi() {
    if (global && global.ProjectMapAdvisorControllerDraft) {
      return global.ProjectMapAdvisorControllerDraft;
    }
    if (typeof require === 'function') {
      try {
        return require('../authoring/advisor_controller_draft.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function parsedToDraftApi() {
    if (global && global.ProjectMapParsedToDraft) {
      return global.ProjectMapParsedToDraft;
    }
    if (typeof require === 'function') {
      try {
        return require('../authoring/parsed_to_draft.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function perfApi() {
    if (global && global.ProjectMapCardBoardPerf) {
      return global.ProjectMapCardBoardPerf;
    }
    if (typeof require === 'function') {
      try {
        return require('./card_board_perf.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function perfMeasure(name, fn, detail) {
    const api = perfApi();
    return api && typeof api.measure === 'function' ? api.measure(name, fn, detail || {}) : fn();
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

  function safeId(value) {
    const text = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    return /^[a-z_]/.test(text) ? text : 'card_' + (text || 'draft');
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  const api = {bind, draftWithContext, handleAction, isCardBoardState, openFromSystemRegion, openSelectedCardEditor, renderStage, reset, restoreContext, selectCard, selectObject};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapCardWorkspaceState = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
