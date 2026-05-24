#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const indexPath = path.join(ROOT, 'templates', 'starter-demo', 'project-index.json');
const cardBoardModel = require('./authoring/card_board_model.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const cardWorkspaceState = require('./viewer/card_workspace_state.js');
const cardFaceEditor = require('./viewer/card_face_editor.js');
const cardBoardPerf = require('./viewer/card_board_perf.js');
const {buildDynamicRepoSemanticFixture} = require('./fixtures/dynamicrepo_semantic_fixture.js');

global.ProjectMapI18n = {t: (_key, fallback) => fallback};
global.ProjectMapCardBoardModel = cardBoardModel;
global.ProjectMapCardFaceEditor = cardFaceEditor;
const cardBoardSurface = require('./viewer/card_board_surface.js');

const {fail, assert} = require('./check_harness.js');

function lane(board, key) {
  return board.lanes.find((item) => item.key === key) || {cards: []};
}

function cardKeys(laneValue) {
  return laneValue.cards.map((card) => card.key);
}

const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const draftModel = {
  mode: 'card',
  template: 'card',
  objectId: 'new_action_card',
  eventBody: {
    title: {id: 'card.title', label: 'Card title', value: 'New Action Card'},
    sections: [{id: 'card.intro', label: 'Body', value: 'Draft card body.'}],
    options: []
  },
  changeState: {
    changedCount: 1,
    operationSummary: {safeApply: 1},
    draft: {
      kind: 'card',
      id: 'new_action_card',
      title: 'New Action Card',
      heading: 'New Action Card',
      introParagraphs: ['Draft card body.'],
      cardKind: 'action_card',
      tags: ['demo_action'],
      options: [{id: 'first', label: 'Use the new card', gotoAfter: 'root'}]
    }
  }
};
const existingCardModel = {
  mode: 'existing',
  template: 'existing',
  objectId: 'demo_action_card',
  eventBody: {
    title: {id: 'demo_action_card_title', label: 'Title', value: 'Starter Action Card'},
    sections: [{id: 'demo_action_card_body', label: 'Body', value: 'Existing card body.'}],
    options: []
  },
  changeState: {changedCount: 0, operationSummary: {}, output: {}}
};

const board = cardBoardModel.buildBoard(index, draftModel, {
  cardBoardSelectedKey: 'draft:card:new_action_card',
  cardBoardLane: 'deck'
});

assert(board.kind === 'card_board_model', 'Card Board should expose its model kind');
assert(board.metrics.cardCount >= 1, 'Card Board should count source-backed cards');
assert(board.metrics.advisorCount >= 1, 'Card Board should count advisor-like cards');
assert(cardKeys(lane(board, 'deck')).includes('card:demo_action_card'), 'Deck lane should include the starter action card through #demo_action');
assert(cardKeys(lane(board, 'deck')).includes('draft:card:new_action_card'), 'Deck lane should include a draft tagged for the deck');
assert(cardKeys(lane(board, 'advisor')).includes('advisor:demo_advisor'), 'Advisor lane should include the starter advisor card');
assert(lane(board, 'hand').cards.some((entry) => entry.kind === 'deck' && entry.title === 'Draw from the starter deck'), 'Hand lane should show a deck route from the hand scene');
assert(lane(board, 'hand').cards.some((entry) => entry.kind === 'advisor' && entry.title === 'Review starter advisor'), 'Hand lane should show an advisor route from the hand scene');
assert(board.selected && board.selected.key === 'draft:card:new_action_card', 'Selected draft card should remain selected');
const handRouteKeys = lane(board, 'hand').cards.map((entry) => entry.key);
assert(new Set(handRouteKeys).size === handRouteKeys.length, 'Hand route keys should be unique even when multiple routes point at the same linked card');
const deckRouteEntry = lane(board, 'hand').cards.find((entry) => entry.kind === 'deck');
assert(deckRouteEntry && deckRouteEntry.deckPoolId === 'demo_action_deck', 'Hand deck routes should link to their editable deck pool object');
const deckRouteBoard = cardBoardModel.buildBoard(index, draftModel, {
  cardBoardSelection: {kind: 'route', key: deckRouteEntry && deckRouteEntry.key}
});
assert(deckRouteBoard.selectedObject && deckRouteBoard.selectedObject.deckPool && deckRouteBoard.selectedObject.deckPool.id === 'demo_action_deck', 'Selected hand deck route should expose a deck pool editor target');
const duplicateAdvisorRoutes = lane(board, 'hand').cards.filter((entry) => entry.linkedCardKeys && entry.linkedCardKeys.includes('advisor:demo_advisor'));
assert(duplicateAdvisorRoutes.length >= 2 && duplicateAdvisorRoutes[0].key !== duplicateAdvisorRoutes[1].key, 'Distinct hand routes to the same advisor should not collapse into one selection key');

const advisorOnly = cardBoardModel.buildBoard(index, draftModel, {cardBoardType: 'advisor'});
assert(lane(advisorOnly, 'advisor').cards.length >= 1, 'Advisor filter should keep advisor cards visible');
assert(!cardKeys(lane(advisorOnly, 'pool')).includes('card:demo_action_card'), 'Advisor filter should hide action cards from the pool');

const searched = cardBoardModel.buildBoard(index, draftModel, {cardBoardQuery: 'starter action'});
assert(cardKeys(lane(searched, 'pool')).includes('card:demo_action_card'), 'Search should find card face text from the text corpus');

const existingBoard = cardBoardModel.buildBoard(index, existingCardModel, {cardBoardSelectedKey: 'card:demo_action_card'});
assert(existingBoard.selected && existingBoard.selected.id === 'demo_action_card', 'Existing source-backed card should be selectable');

const sparseCardIndex = Object.assign({}, index, {
  scenes: (index.scenes || []).concat([{
    id: 'sparse_option_card',
    title: 'Sparse Option Card',
    path: 'source/scenes/cards/sparse_option_card.scene.dry',
    type: 'card',
    flags: {isCard: true},
    options: Array.from({length: 7}, (_item, optionIndex) => ({
      id: 'choice_' + (optionIndex + 1),
      target: {kind: 'scene', id: 'root'}
    }))
  }])
});
const sparseBoard = cardBoardModel.buildBoard(sparseCardIndex, draftModel, {cardBoardSelectedKey: 'card:sparse_option_card'});
const sparseCard = sparseBoard.selected;
assert(sparseCard && sparseCard.options[6] && sparseCard.options[6].label === 'Choice 7', 'Card Board should fallback-label options when textCorpus option labels are absent');
assert(sparseCard.options[6].fieldId === 'card.option.6.label', 'Card Board root options should expose Object Canvas field ids');

const menuCardIndex = Object.assign({}, index, {
  scenes: (index.scenes || []).concat([{
    id: 'menu_policy_card',
    title: 'Menu Policy Card',
    path: 'source/scenes/cards/menu_policy_card.scene.dry',
    type: 'card',
    flags: {isCard: true},
    tags: ['menu_policy'],
    options: [],
    sections: [{
      id: 'menu_policy_card.tax',
      title: 'Tax policy',
      paragraphs: ['Discuss tax options.'],
      options: [{id: 'wealth_tax', title: 'Introduce wealth tax', target: {kind: 'scene', id: 'root'}}]
    }]
  }])
});
const menuBoard = cardBoardModel.buildBoard(menuCardIndex, draftModel, {
  cardBoardSelectedKey: 'card:menu_policy_card',
  cardBoardSelection: {kind: 'option', cardKey: 'card:menu_policy_card', optionId: 'wealth_tax'}
});
assert(menuBoard.selected && menuBoard.selected.options.some((option) => option.fieldId === 'card.section.0.option.0.label'), 'Card Board should expose section-owned card choices with Object Canvas field ids');
assert(menuBoard.selectedObject && menuBoard.selectedObject.fieldId === 'card.section.0.option.0.label', 'Selected section-owned option should retain its focus field id');

const genericTitleIndex = Object.assign({}, index, {
  scenes: (index.scenes || []).concat([{
    id: 'generic_advisor_title_card',
    title: 'New Action Card',
    path: 'source/scenes/advisors/generic_advisor_title_card.scene.dry',
    type: 'pinned_card',
    flags: {isCard: true, isPinnedCard: true},
    tags: ['advisor'],
    options: []
  }]),
  semantic: Object.assign({}, index.semantic, {
    textCorpus: {
      items: (index.semantic && index.semantic.textCorpus && index.semantic.textCorpus.items || []).concat([
        {id: 'generic_advisor_title_card_heading', owner: {kind: 'scene', sceneId: 'generic_advisor_title_card'}, role: 'heading', text: 'Fritz Baade'},
        {id: 'generic_advisor_title_card_body', owner: {kind: 'scene', sceneId: 'generic_advisor_title_card'}, role: 'body', text: 'Baade is one of the few agricultural experts.'}
      ])
    }
  })
});
const genericTitleBoard = cardBoardModel.buildBoard(genericTitleIndex, existingCardModel, {
  cardBoardSelectedKey: 'advisor:generic_advisor_title_card'
});
assert(genericTitleBoard.selectedObject && genericTitleBoard.selectedObject.title === 'Fritz Baade', 'Card Board selected card titles should prefer the player-facing heading over generic source metadata titles');

const semanticOnlyDeckPoolIndex = Object.assign({}, index, {
  scenes: (index.scenes || []).concat([{
    id: 'semantic_only_pool_card',
    title: 'Semantic Only Pool Card',
    path: 'source/scenes/cards/semantic_only_pool_card.scene.dry',
    type: 'card',
    flags: {isCard: true},
    tags: ['semantic_only_pool'],
    options: []
  }]),
  semantic: Object.assign({}, index.semantic, {
    deckPools: [{
      id: 'main.semantic_only',
      label: 'Semantic Only Deck Pool',
      routeTags: ['semantic_only_pool'],
      routeTargets: [{kind: 'tag', id: 'semantic_only_pool'}],
      sourceAnchor: {path: 'source/scenes/main.scene.dry', line: 30}
    }]
  })
});
const semanticOnlyBoard = cardBoardModel.buildBoard(semanticOnlyDeckPoolIndex, existingCardModel, {
  cardBoardLane: 'deck_pool:main.semantic_only'
});
const semanticOnlyCard = lane(semanticOnlyBoard, 'deck_pool:main.semantic_only').cards.find((card) => card.id === 'semantic_only_pool_card');
assert(semanticOnlyCard, 'Cards that are only known through semantic deck pools should still render in their deck pool lane');
assert(!semanticOnlyCard.laneKeys.includes('unwired'), 'Semantic deck pool membership should be applied before unwired classification');
assert(!cardKeys(lane(semanticOnlyBoard, 'unwired')).includes('card:semantic_only_pool_card'), 'Semantic deck pool members should not also appear in the unwired lane');

const sectionOwnedDeckIndex = Object.assign({}, index, {
  semantic: Object.assign({}, index.semantic, {
    decks: [{
      id: 'main.parser_deck',
      title: 'Inline Parser Deck',
      type: 'deck',
      ownerKind: 'section',
      ownerSceneId: 'main',
      path: 'source/scenes/main.scene.dry',
      options: [{
        id: '#demo_action',
        target: {kind: 'tag', id: 'demo_action'},
        sourceSpan: {path: 'source/scenes/main.scene.dry', startLine: 14, line: 14, anchorText: '- #demo_action'}
      }]
    }]
  })
});
const sectionOwnedDeckBoard = cardBoardModel.buildBoard(sectionOwnedDeckIndex, draftModel, {cardBoardLane: 'deck'});
const sectionDeckCard = lane(sectionOwnedDeckBoard, 'deck').cards.find((card) => card.id === 'demo_action_card');
assert(sectionDeckCard, 'Card Board should place tagged cards in section-owned semantic deck lanes');
assert(sectionDeckCard.routeEvidence.some((item) => item.containerId === 'main.parser_deck'), 'section-owned deck route evidence should keep the section deck id');
assert(lane(sectionOwnedDeckBoard, 'deck').sourceAnchor && lane(sectionOwnedDeckBoard, 'deck').sourceAnchor.anchorText === '- #demo_action', 'section-owned deck lane should expose a source anchor for lane-aware install');

const optionBoard = cardBoardModel.buildBoard(index, existingCardModel, {
  cardBoardSelectedKey: 'card:demo_action_card',
  cardBoardSelection: {kind: 'option', cardKey: 'card:demo_action_card', optionIndex: 0}
});
assert(optionBoard.selectedObject && optionBoard.selectedObject.kind === 'option', 'Card Board should expose selected option objects');
assert(optionBoard.selectedObject.option && optionBoard.selectedObject.option.label === 'Mobilize volunteers', 'Selected option should retain its card choice label');
assert(optionBoard.selectedObject.fieldId === 'card.option.0.label', 'Selected root option should expose its Object Canvas focus field');

function duplicateFixtureState(projectIndex, selectedKey) {
  const state = {
    projectIndex,
    model: existingCardModel,
    mode: 'existing',
    template: 'existing',
    view: 'cards',
    item: '',
    workspace: 'content',
    cardBoardSelectedKey: selectedKey,
    selectedCanvasNode: selectedKey,
    cardBoardLane: 'pool',
    cardBoardSelection: {kind: 'card', key: selectedKey, cardKey: selectedKey},
    values: {}
  };
  const deps = {
    collectValues() { return state.values || {}; },
    defaultDraftForTemplate() { return {}; },
    buildExistingModel() { return state.model; },
    buildTemplateModel() {
      return {
        mode: 'card',
        template: 'card',
        objectId: state.baseDraft && state.baseDraft.id,
        changeState: {draft: state.baseDraft, changedCount: 1, operationSummary: {safeApply: 1}}
      };
    },
    showWorkspace() {},
    render() {},
    t(_key, fallback) { return fallback; }
  };
  return {state, deps};
}

const duplicateLarge = duplicateFixtureState(sparseCardIndex, 'card:sparse_option_card');
assert(cardWorkspaceState.handleAction(duplicateLarge.state, 'duplicate_card', null, duplicateLarge.deps), 'Card Board duplicate action should run for source-backed cards');
assert(duplicateLarge.state.baseDraft.options.length === 7, 'Card Board Copy as draft should preserve every parsed option instead of capping at four');
assert(duplicateLarge.state.baseDraft.id === 'sparse_option_card_draft', 'Card Board Copy as draft should pass the canonical new draft id');

const duplicateMenu = duplicateFixtureState(menuCardIndex, 'card:menu_policy_card');
assert(cardWorkspaceState.handleAction(duplicateMenu.state, 'duplicate_card', null, duplicateMenu.deps), 'Card Board duplicate should run for menu cards');
assert(duplicateMenu.state.baseDraft.cardShape === 'menu_card', 'Card Board Copy as draft should use parsed-to-draft for menu cards');
assert(duplicateMenu.state.baseDraft.sections && duplicateMenu.state.baseDraft.sections[0].options.length === 1, 'Card Board Copy as draft should preserve section-owned options');

const dynamicCardIndex = Object.assign({}, sparseCardIndex, {
  scenes: (sparseCardIndex.scenes || []).concat([{
    id: 'dynamic_policy_card',
    title: 'Dynamic Policy Card',
    path: 'source/scenes/cards/dynamic_policy_card.scene.dry',
    type: 'card',
    flags: {isCard: true},
    dynamicStructure: true,
    options: [{id: 'one', target: {kind: 'scene', id: 'root'}}, {id: 'two', target: {kind: 'scene', id: 'root'}}]
  }])
});
const duplicateDynamic = duplicateFixtureState(dynamicCardIndex, 'card:dynamic_policy_card');
assert(cardWorkspaceState.handleAction(duplicateDynamic.state, 'duplicate_card', null, duplicateDynamic.deps), 'Card Board duplicate should still open dynamic cards as partial drafts');
assert(duplicateDynamic.state.baseDraft.authoringStatus === 'partial', 'Dynamic/raw card copy should remain partial');
const dynamicModel = canvasModel.buildCanvasModel(dynamicCardIndex, {template: 'card', draft: duplicateDynamic.state.baseDraft});
assert(!dynamicModel.ok && !dynamicModel.changeState.installPlan, 'Partial dynamic card drafts must not produce fake install plans');

function selectableFixtureState(selectedKey, overlayOpen) {
  const state = {
    projectIndex: index,
    model: Object.assign({ok: true}, existingCardModel),
    mode: 'existing',
    template: 'existing',
    view: 'cards',
    item: overlayOpen ? String(selectedKey || '').replace(/^(card|advisor):/, '') : '',
    workspace: 'content',
    editorOverlay: Boolean(overlayOpen),
    cardBoardSelectedKey: selectedKey,
    selectedCanvasNode: selectedKey,
    cardBoardLane: 'pool',
    cardBoardSelection: {kind: 'card', key: selectedKey, cardKey: selectedKey},
    values: {}
  };
  const counts = {
    buildExistingFor: 0,
    buildExisting: 0,
    buildTemplate: 0,
    render: 0,
    focus: 0,
    workspace: 0
  };
  const deps = {
    collectValues() { return state.values || {}; },
    defaultDraftForTemplate() { return {}; },
    buildExistingModel() {
      counts.buildExisting += 1;
      return state.model;
    },
    buildExistingModelFor(view, item) {
      counts.buildExistingFor += 1;
      return Object.assign({}, existingCardModel, {
        ok: true,
        objectId: item,
        view
      });
    },
    buildTemplateModel() {
      counts.buildTemplate += 1;
      return draftModel;
    },
    focusDraftField(fieldId) {
      counts.focus += 1;
      counts.lastFocusField = fieldId;
      return true;
    },
    showWorkspace() { counts.workspace += 1; },
    render() { counts.render += 1; },
    t(_key, fallback) { return fallback; }
  };
  return {state, deps, counts};
}

const lightweightSelect = selectableFixtureState('card:demo_action_card', false);
assert(cardWorkspaceState.selectCard(lightweightSelect.state, 'card:demo_action_card', lightweightSelect.deps), 'Card Board source card selection should run');
assert(lightweightSelect.counts.buildExistingFor === 0, 'Plain source card selection should not build a full existing Object Editor model');
assert(lightweightSelect.state.editorOverlay === false, 'Plain source card selection should not auto-open the Object Editor overlay');
assert(lightweightSelect.state.item === 'demo_action_card', 'Plain source card selection should update the current card id for explicit editor opening');
assert(lightweightSelect.state.model && lightweightSelect.state.model.title === 'Starter Action Card', 'Plain source card selection should replace stale editor models with a lightweight selected-card inspect model');
assert(lightweightSelect.state.model.objectId !== 'demo_action_card', 'Lightweight selected-card inspect model should not masquerade as a full existing editor model');

const overlaySelect = selectableFixtureState('card:demo_action_card', true);
assert(cardWorkspaceState.selectCard(overlaySelect.state, 'card:demo_action_card', overlaySelect.deps), 'Card Board source card selection should keep working with the editor open');
assert(overlaySelect.counts.buildExistingFor === 1, 'Selecting a source card while the Object Editor is open should rebuild that card editor');
assert(overlaySelect.state.editorOverlay === true, 'Selecting a card while the Object Editor is open should keep the overlay open');
assert(overlaySelect.state.model.objectId === 'demo_action_card', 'Selecting a card while the Object Editor is open should target the selected card');

const explicitOpen = selectableFixtureState('card:demo_action_card', false);
cardWorkspaceState.selectCard(explicitOpen.state, 'card:demo_action_card', explicitOpen.deps);
assert(cardWorkspaceState.openSelectedCardEditor(explicitOpen.state, explicitOpen.deps), 'Open object editor should explicitly build the selected source-backed card');
assert(explicitOpen.counts.buildExistingFor === 1, 'Open object editor should build the full existing card model once');
assert(explicitOpen.state.editorOverlay === true, 'Open object editor should open the overlay for the selected card');

const explicitActionOpen = selectableFixtureState('card:demo_action_card', false);
cardWorkspaceState.selectCard(explicitActionOpen.state, 'card:demo_action_card', explicitActionOpen.deps);
assert(cardWorkspaceState.handleAction(explicitActionOpen.state, 'open_card_editor', {dataset: {}}, explicitActionOpen.deps), 'Card Board open_card_editor action should open the selected source-backed card');
assert(explicitActionOpen.counts.buildExistingFor === 1 && explicitActionOpen.state.editorOverlay === true, 'Card Board open_card_editor action should build and open the Object Editor');

const inlineCardActionOpen = selectableFixtureState('card:demo_action_card', false);
assert(cardWorkspaceState.handleAction(inlineCardActionOpen.state, 'open_card_editor', {dataset: {cardBoardActionCard: 'card:demo_action_card'}}, inlineCardActionOpen.deps), 'Card Board inline card Edit action should open the target source-backed card');
assert(inlineCardActionOpen.state.item === 'demo_action_card' && inlineCardActionOpen.state.editorOverlay === true, 'Card Board inline card Edit action should target the clicked source-backed card');

const deckPoolActionOpen = selectableFixtureState('card:demo_action_card', false);
deckPoolActionOpen.deps.buildTemplateModel = function buildDeckPoolTemplate() {
  return {
    ok: true,
    mode: deckPoolActionOpen.state.template,
    template: deckPoolActionOpen.state.template,
    objectId: deckPoolActionOpen.state.baseDraft && deckPoolActionOpen.state.baseDraft.deckPoolId,
    eventBody: {title: {id: 'deckPool.label', value: deckPoolActionOpen.state.baseDraft && deckPoolActionOpen.state.baseDraft.label || ''}},
    changeState: {draft: deckPoolActionOpen.state.baseDraft, changedCount: 0, operationSummary: {}}
  };
};
assert(cardWorkspaceState.handleAction(deckPoolActionOpen.state, 'open_deck_pool_editor', {dataset: {cardBoardDeckPool: 'demo_action_deck'}}, deckPoolActionOpen.deps), 'Card Board deck pool action should open the deck pool Object Editor');
assert(deckPoolActionOpen.state.mode === 'deck_pool' && deckPoolActionOpen.state.editorOverlay === true, 'Deck pool action should switch the workspace into a deck_pool editor overlay');
assert(deckPoolActionOpen.state.baseDraft && deckPoolActionOpen.state.baseDraft.deckPoolId === 'demo_action_deck', 'Deck pool action should build the requested deck pool draft');
assert(deckPoolActionOpen.state.cardBoardLane === 'deck_pool:demo_action_deck', 'Deck pool action should preserve the semantic deck pool lane context');

const optionClosed = selectableFixtureState('card:demo_action_card', false);
assert(cardWorkspaceState.selectObject(optionClosed.state, {kind: 'option', cardKey: 'card:demo_action_card', optionIndex: 0, fieldId: 'card.option.0.label'}, optionClosed.deps), 'Selecting an option should run from Card Board');
assert(optionClosed.counts.buildExistingFor === 1, 'Selecting an option with the editor closed should open the matching Object Editor');
assert(optionClosed.state.editorOverlay === true, 'Selecting an option with the editor closed should open the overlay');
assert(optionClosed.counts.focus === 1 && optionClosed.counts.lastFocusField === 'card.option.0.label', 'Selecting an option should focus its Object Canvas field after opening');

const optionOpen = selectableFixtureState('card:demo_action_card', true);
assert(cardWorkspaceState.selectObject(optionOpen.state, {kind: 'option', cardKey: 'card:demo_action_card', optionIndex: 1, fieldId: 'card.option.1.label'}, optionOpen.deps), 'Selecting another option should run with the editor open');
assert(optionOpen.counts.buildExistingFor === 0, 'Selecting an option on the already open card should not rebuild the Object Editor');
assert(optionOpen.counts.render === 0, 'Selecting an option on the already open card should not rerender the whole Card Board');
assert(optionOpen.counts.focus === 1 && optionOpen.counts.lastFocusField === 'card.option.1.label', 'Selecting an option on the already open card should only focus the requested field');

const sectionFocus = selectableFixtureState('card:menu_policy_card', false);
assert(cardWorkspaceState.selectObject(sectionFocus.state, {kind: 'option', cardKey: 'card:menu_policy_card', sectionIndex: 0, optionIndex: 0}, sectionFocus.deps), 'Selecting a section-owned option should infer a section field id');
assert(sectionFocus.counts.lastFocusField === 'card.section.0.option.0.label', 'Section-owned option selection should focus the matching section option field');

delete global.__DMS_CARD_BOARD_PERF__;
global.__DMS_CARD_BOARD_PERF_ENABLED__ = false;
cardBoardPerf.record('disabledProbe', 1, {check: 'card-board'});
assert(!Array.isArray(global.__DMS_CARD_BOARD_PERF__), 'Card Board perf probe should not write the global buffer while disabled');
const previousLocalStorage = global.localStorage;
delete global.__DMS_CARD_BOARD_PERF_ENABLED__;
global.localStorage = {getItem() { throw new Error('storage blocked'); }};
cardBoardPerf.record('blockedStorageProbe', 1, {check: 'card-board'});
assert(!Array.isArray(global.__DMS_CARD_BOARD_PERF__), 'Card Board perf probe should safely no-op when localStorage is unavailable');
if (previousLocalStorage === undefined) {
  delete global.localStorage;
} else {
  global.localStorage = previousLocalStorage;
}
global.__DMS_CARD_BOARD_PERF_ENABLED__ = true;
for (let indexValue = 0; indexValue < 60; indexValue += 1) {
  cardBoardPerf.record('probe.' + indexValue, indexValue, {check: 'card-board'});
}
const measuredValue = cardBoardPerf.measure('probe.measure', () => 'measured', {check: 'card-board'});
assert(measuredValue === 'measured', 'Card Board perf measure should return the wrapped function result');
assert(Array.isArray(global.__DMS_CARD_BOARD_PERF__) && global.__DMS_CARD_BOARD_PERF__.length === 50, 'Card Board perf probe should retain only the most recent 50 rows');
assert(global.__DMS_CARD_BOARD_PERF__.some((row) => row && row.name === 'probe.measure'), 'Card Board perf probe should record named measures when enabled');
global.__DMS_CARD_BOARD_PERF_ENABLED__ = false;
const disabledLength = global.__DMS_CARD_BOARD_PERF__.length;
cardBoardPerf.record('disabledProbeAfterEnable', 1, {check: 'card-board'});
assert(global.__DMS_CARD_BOARD_PERF__.length === disabledLength, 'Card Board perf probe should return to no-op mode when disabled');
delete global.__DMS_CARD_BOARD_PERF_ENABLED__;

const routeKey = lane(board, 'hand').cards[0] && lane(board, 'hand').cards[0].key;
const routeBoard = cardBoardModel.buildBoard(index, draftModel, {
  cardBoardSelection: {kind: 'route', key: routeKey}
});
assert(routeBoard.selectedObject && routeBoard.selectedObject.kind === 'route', 'Card Board should expose selected hand route objects');

const laneBoard = cardBoardModel.buildBoard(index, draftModel, {
  cardBoardSelection: {kind: 'lane', laneKey: 'deck'}
});
assert(laneBoard.selectedObject && laneBoard.selectedObject.kind === 'lane', 'Card Board should expose selected lane objects');
assert(lane(laneBoard, 'deck').selected, 'Selected lane should be marked for rendering');

const intentBoard = cardBoardModel.buildBoard(index, draftModel, {
  cardBoardDropContext: {itemKey: 'draft:card:new_action_card', itemTitle: 'New Action Card', laneKey: 'deck', laneLabel: 'Deck', action: 'move'},
  cardBoardSelection: {kind: 'intent'}
});
assert(intentBoard.selectedObject && intentBoard.selectedObject.kind === 'intent', 'Card Board should expose selected board intents');

const html = cardBoardSurface.render(draftModel, {projectIndex: index, cardBoardSelectedKey: 'draft:card:new_action_card'});
assert(html.includes('data-card-board-surface="true"'), 'Card Board surface should expose a stable QA marker');
assert(html.includes('data-card-board-canvas="true"'), 'Card Board surface should render a visual board canvas');
assert(html.includes('data-card-board-lane="deck"'), 'Card Board surface should render the deck lane');
assert(html.includes('data-card-board-lane="advisor"'), 'Card Board surface should render the advisor lane');
assert(html.includes('data-card-face-editor="true"'), 'Card Board surface should render the card face editor');
assert(html.includes('data-runtime-lens-panel="true"'), 'Card Board surface should render the Runtime Lens observer');
assert(html.includes('data-card-board-create-lane="deck"'), 'Card Board should offer lane-aware card creation');
assert(html.includes('data-card-board-option-card="draft:card:new_action_card"'), 'Card Board cards should expose clickable card options');
assert(html.includes('data-card-board-lane-select="deck"'), 'Card Board lanes should expose selectable lane headers');

const optionHtml = cardBoardSurface.render(existingCardModel, {
  projectIndex: index,
  cardBoardSelectedKey: 'card:demo_action_card',
  cardBoardSelection: {kind: 'option', cardKey: 'card:demo_action_card', optionIndex: 0}
});
assert(optionHtml.includes('data-card-board-option-inspector="true"'), 'Card Board should render a selected option inspector');

const lightweightSourceHtml = cardBoardSurface.render(draftModel, {
  projectIndex: index,
  cardBoardSelectedKey: 'card:demo_action_card',
  editorOverlay: false
});
assert(lightweightSourceHtml.includes('Open object editor'), 'Lightweight source-card selection should keep an explicit Object Editor opening button');
assert(lightweightSourceHtml.includes('data-card-board-action="open_card_editor"'), 'Lightweight source-card selection should use the Card Board explicit editor opening action');
assert(lightweightSourceHtml.includes('data-card-board-action-card="card:demo_action_card"'), 'Card Board card Edit affordance should carry the clicked card key');
assert(lightweightSourceHtml.includes('0 Changed'), 'Lightweight source-card selection should not show stale draft change counts');
assert(!lightweightSourceHtml.includes('data-object-canvas-action="review"'), 'Lightweight source-card selection should not expose stale Review & Apply actions before opening the editor');
assert(lightweightSourceHtml.includes('data-card-board-open-lane-object="deck_pool"'), 'Hand deck route entries should be direct deck pool editor targets');
assert(lightweightSourceHtml.includes('data-card-board-action="open_deck_pool_editor"'), 'Card Board deck pool lanes should expose direct Object Editor actions on the board');

const genericTitleHtml = cardBoardSurface.render(existingCardModel, {
  projectIndex: genericTitleIndex,
  cardBoardSelectedKey: 'advisor:generic_advisor_title_card',
  editorOverlay: false
});
assert(genericTitleHtml.includes('Fritz Baade'), 'Lightweight source card sidebar should show the selected player-facing heading');
assert(!genericTitleHtml.includes('data-card-face-selected-title="true">New Action Card</h3>'), 'Lightweight source card sidebar should not show a generic source metadata title as the selected card title');

const routeHtml = cardBoardSurface.render(draftModel, {
  projectIndex: index,
  cardBoardSelection: {kind: 'route', key: routeKey}
});
assert(routeHtml.includes('data-card-board-route-inspector="true"'), 'Card Board should render a selected route inspector');

const deckRouteHtml = cardBoardSurface.render(draftModel, {
  projectIndex: index,
  cardBoardSelection: {kind: 'route', key: deckRouteEntry && deckRouteEntry.key}
});
assert(deckRouteHtml.includes('data-card-board-action="open_deck_pool_editor"'), 'Selected hand deck route should expose a deck pool Object Editor action');
assert(deckRouteHtml.includes('data-card-board-deck-pool="demo_action_deck"'), 'Selected hand deck route Object Editor action should carry the deck pool id');
assert(!deckRouteHtml.includes('class="primary-action" data-card-board-action="open_card_editor">'), 'Selected hand deck route should not use the card editor as its primary action');

const laneHtml = cardBoardSurface.render(draftModel, {
  projectIndex: index,
  cardBoardSelection: {kind: 'lane', laneKey: 'deck'}
});
assert(laneHtml.includes('data-card-board-lane-inspector="true"'), 'Card Board should render a selected lane inspector');

const deckPoolLaneHtml = cardBoardSurface.render(draftModel, {
  projectIndex: index,
  cardBoardSelection: {kind: 'lane', laneKey: 'deck_pool:demo_action_deck'}
});
assert(deckPoolLaneHtml.includes('data-card-board-action="open_deck_pool_editor"'), 'Selected deck pool lane should expose a deck pool Object Editor action');
assert(deckPoolLaneHtml.includes('data-card-board-deck-pool="demo_action_deck"'), 'Selected deck pool lane Object Editor action should carry the deck pool id');

const dynamicIndex = buildDynamicRepoSemanticFixture();
const dynamicBoard = cardBoardModel.buildBoard(dynamicIndex, draftModel, {
  cardBoardSelection: {kind: 'lane', laneKey: 'deck_pool:main.party'}
});
assert(lane(dynamicBoard, 'deck_pool:main.party').deckPool, 'Card Board should expose Party Affairs as a named deck pool lane');
assert(lane(dynamicBoard, 'deck_pool:main.govt').deckPool, 'Card Board should expose Government Affairs as a named deck pool lane');
assert(cardKeys(lane(dynamicBoard, 'deck_pool:main.party')).includes('card:shuffle_leadership'), 'Shuffle Leadership should belong to the Party Affairs deck pool lane');
assert(!cardKeys(lane(dynamicBoard, 'deck_pool:main.govt')).includes('card:shuffle_leadership'), 'Shuffle Leadership should not belong to Government Affairs');
assert(dynamicBoard.selectedObject && dynamicBoard.selectedObject.deckPool && dynamicBoard.selectedObject.deckPool.id === 'main.party', 'Selecting a deck pool lane should expose the deck pool object');
const controllerBoard = cardBoardModel.buildBoard(dynamicIndex, draftModel, {
  cardBoardSelection: {kind: 'lane', laneKey: 'advisor_controller:shuffle_leadership'}
});
assert(lane(controllerBoard, 'advisor_controller:shuffle_leadership').advisorController, 'Card Board should expose Shuffle Leadership as an advisor controller lane');
assert(controllerBoard.selectedObject && controllerBoard.selectedObject.advisorController && controllerBoard.selectedObject.advisorController.id === 'shuffle_leadership', 'Selecting advisor controller lane should expose controller object');
const dynamicHtml = cardBoardSurface.render(draftModel, {projectIndex: dynamicIndex, cardBoardSelection: {kind: 'lane', laneKey: 'deck_pool:main.party'}});
assert(dynamicHtml.includes('data-card-board-deck-pool="main.party"'), 'Card Board surface should render deck pool lane metadata');
assert(dynamicHtml.includes('data-card-board-action="open_deck_pool_editor"'), 'Deck pool lane inspector should offer Object Editor entry');

process.stdout.write(JSON.stringify({
  ok: true,
  cards: board.metrics.cardCount,
  advisors: board.metrics.advisorCount,
  lanes: board.lanes.map((item) => item.key)
}, null, 2) + '\n');
