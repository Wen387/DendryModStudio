#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const indexPath = path.join(ROOT, 'templates', 'starter-demo', 'project-index.json');
const cardBoardModel = require('./authoring/card_board_model.js');
const cardFaceEditor = require('./viewer/card_face_editor.js');

global.ProjectMapI18n = {t: (_key, fallback) => fallback};
global.ProjectMapCardBoardModel = cardBoardModel;
global.ProjectMapCardFaceEditor = cardFaceEditor;
const cardBoardSurface = require('./viewer/card_board_surface.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

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

const advisorOnly = cardBoardModel.buildBoard(index, draftModel, {cardBoardType: 'advisor'});
assert(lane(advisorOnly, 'advisor').cards.length >= 1, 'Advisor filter should keep advisor cards visible');
assert(!cardKeys(lane(advisorOnly, 'pool')).includes('card:demo_action_card'), 'Advisor filter should hide action cards from the pool');

const searched = cardBoardModel.buildBoard(index, draftModel, {cardBoardQuery: 'starter action'});
assert(cardKeys(lane(searched, 'pool')).includes('card:demo_action_card'), 'Search should find card face text from the text corpus');

const existingBoard = cardBoardModel.buildBoard(index, existingCardModel, {cardBoardSelectedKey: 'card:demo_action_card'});
assert(existingBoard.selected && existingBoard.selected.id === 'demo_action_card', 'Existing source-backed card should be selectable');

const optionBoard = cardBoardModel.buildBoard(index, existingCardModel, {
  cardBoardSelectedKey: 'card:demo_action_card',
  cardBoardSelection: {kind: 'option', cardKey: 'card:demo_action_card', optionIndex: 0}
});
assert(optionBoard.selectedObject && optionBoard.selectedObject.kind === 'option', 'Card Board should expose selected option objects');
assert(optionBoard.selectedObject.option && optionBoard.selectedObject.option.label === 'Spend resources', 'Selected option should retain its card choice label');

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

const routeHtml = cardBoardSurface.render(draftModel, {
  projectIndex: index,
  cardBoardSelection: {kind: 'route', key: routeKey}
});
assert(routeHtml.includes('data-card-board-route-inspector="true"'), 'Card Board should render a selected route inspector');

const laneHtml = cardBoardSurface.render(draftModel, {
  projectIndex: index,
  cardBoardSelection: {kind: 'lane', laneKey: 'deck'}
});
assert(laneHtml.includes('data-card-board-lane-inspector="true"'), 'Card Board should render a selected lane inspector');

process.stdout.write(JSON.stringify({
  ok: true,
  cards: board.metrics.cardCount,
  advisors: board.metrics.advisorCount,
  lanes: board.lanes.map((item) => item.key)
}, null, 2) + '\n');
