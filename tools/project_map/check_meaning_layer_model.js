#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const previewModel = require('./authoring/preview_model.js');
const meaningLayer = require('./authoring/meaning_layer.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const surfaceEscapeHatch = previewModel.buildPreviewModel({
  template: 'surface',
  status: 'ide_escape_hatch',
  draft: {
    schemaVersion: '0.1',
    kind: 'surface_text',
    id: 'carlo_title',
    area: 'card_title',
    originalLabel: 'Carlo Mierendorff',
    replacementLabel: 'Carlo Mierendorff',
    editability: 'ide_escape_hatch',
    source: {path: 'source/scenes/advisors/mierendorff.scene.dry', line: 1}
  }
}, {sourceKind: 'surface_text'});

const zhModel = meaningLayer.buildMeaningModel(surfaceEscapeHatch, {locale: 'zh-Hant'});
assert(zhModel.title === 'Carlo Mierendorff', 'surface meaning title should keep player text only');
assert(zhModel.status.label === '需要手動確認', 'unsupported confidence should become human status');
assert(zhModel.readiness && zhModel.readiness.label === '需要手動確認', 'meaning model should expose human preview readiness');
assert(zhModel.readiness.runtimePreview === false, 'meaning readiness should preserve non-runtime boundary');
assert(zhModel.primary.some((row) => row.label === '文字位置' && row.value === '卡牌標題'), 'card_title should become 卡牌標題');
assert(zhModel.primary.some((row) => row.kind === 'game-text' && row.value === 'Carlo Mierendorff'), 'player text should be marked as game-text');
assert(zhModel.advanced.some((row) => row.label === '來源' && /mierendorff\.scene\.dry:1/.test(row.value)), 'source path should be advanced detail');

const renderedText = JSON.stringify(zhModel);
['unsupported', 'ide_escape_hatch', 'card_title', 'Preview notes'].forEach((term) => {
  assert(!renderedText.includes(term), 'human meaning model should hide internal term: ' + term);
});

const enModel = meaningLayer.buildMeaningModel(surfaceEscapeHatch, {locale: 'en'});
assert(enModel.status.label === 'Manual review needed', 'English status should be human-readable');
assert(enModel.primary.some((row) => row.label === 'Text area' && row.value === 'Card title'), 'English card_title label should be human-readable');

const defaultModel = meaningLayer.buildMeaningModel(surfaceEscapeHatch, {});
assert(defaultModel.status.label === 'Manual review needed', 'MeaningLayer should default to English without an explicit locale');
assert(!/[\u3400-\u9fff]/.test(JSON.stringify(defaultModel)), 'default MeaningLayer output should not contain CJK text');

const html = fs.readFileSync(path.join(__dirname, 'viewer', 'index.html'), 'utf8');
assert(html.includes('../authoring/meaning_layer.js'), 'viewer should load MeaningLayer core');
assert(html.includes('meaning_layer_ui.js'), 'viewer should load MeaningLayer UI renderer');

['wizard_ui.js', 'news_ui.js', 'card_ui.js', 'surface_text_ui.js'].forEach((fileName) => {
  const content = fs.readFileSync(path.join(__dirname, 'viewer', fileName), 'utf8');
  assert(content.includes('ProjectMapMeaningLayerUi'), fileName + ' should route player previews through MeaningLayer UI');
});

process.stdout.write(JSON.stringify({
  ok: true,
  title: zhModel.title,
  status: zhModel.status.label,
  primaryRows: zhModel.primary.length,
  advancedRows: zhModel.advanced.length
}, null, 2) + '\n');
