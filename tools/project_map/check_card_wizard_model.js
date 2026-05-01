#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const cardDraft = require('./authoring/card_draft.js');
const viewer = require('./viewer/app.js');
const sceneParser = require('../../node_modules/dendrynexus/lib/parsers/scene.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_INDEX = '/tmp/dendry_project_map/project-index.json';
const SAMPLE_CARD = path.join(__dirname, 'fixtures', 'card_drafts', 'sample_action_card.json');
const SAMPLE_ADVISOR = path.join(__dirname, 'fixtures', 'card_drafts', 'sample_advisor_card.json');
const INVALID_CARD = path.join(__dirname, 'fixtures', 'card_drafts', 'invalid_card.json');
const VIEWER_INDEX = path.join(__dirname, 'viewer', 'index.html');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadIndex() {
  function withFixtureVariables(index) {
    const result = index || {};
    result.variables = Array.isArray(result.variables) ? result.variables.slice() : [];
    const names = new Set(result.variables.map((variable) => variable && variable.name).filter(Boolean));
    ['resources', 'media_reach', 'advisor_action_timer', 'community_circle_active', 'community_circle_strength'].forEach((name) => {
      if (!names.has(name)) {
        result.variables.push({name});
      }
    });
    return result;
  }
  if (fs.existsSync(DEFAULT_INDEX)) {
    return withFixtureVariables(readJson(DEFAULT_INDEX));
  }
  return withFixtureVariables({
    schemaVersion: '0.1',
    project: {root: REPO_ROOT, profileIds: ['generic-dendry']},
    profiles: [{id: 'generic-dendry', uiLabels: {advisorLikeSingular: 'Advisor', advisorLikePlural: 'Advisors'}}],
    scenes: [{id: 'root'}, {id: 'media'}],
    edges: [],
    variables: [
      {name: 'resources'},
      {name: 'media_reach'},
      {name: 'advisor_action_timer'},
      {name: 'community_circle_active'},
      {name: 'community_circle_strength'}
    ],
    semantic: {events: [], cards: [], hands: [], decks: [], pinnedCards: [], news: {items: []}},
    diagnostics: [],
    summary: {}
  });
}

function diagnosticCodes(result) {
  return result.diagnostics.map((diag) => diag.code);
}

const index = loadIndex();
const testIndexFile = path.join(os.tmpdir(), 'dendry_card_check_index_' + process.pid + '.json');
const cliIndex = Object.assign({}, index, {
  project: Object.assign({}, index.project || {}, {root: REPO_ROOT})
});
fs.writeFileSync(testIndexFile, JSON.stringify(cliIndex), 'utf8');
const actionDraft = readJson(SAMPLE_CARD);
const advisorDraft = readJson(SAMPLE_ADVISOR);
const invalidDraft = readJson(INVALID_CARD);
const actionBundle = cardDraft.buildExportBundle(actionDraft, index);
const advisorBundle = cardDraft.buildExportBundle(advisorDraft, index);
const invalidResult = cardDraft.validateDraft(invalidDraft, index);
const viewerHtml = fs.readFileSync(VIEWER_INDEX, 'utf8');
const cardUi = fs.readFileSync(path.join(__dirname, 'viewer', 'card_ui.js'), 'utf8');

assert(actionBundle.ok, 'sample action card should be valid: ' + JSON.stringify(actionBundle.diagnostics));
assert(advisorBundle.ok, 'sample advisor-like card should be valid: ' + JSON.stringify(advisorBundle.diagnostics));
assert(actionBundle.scene.includes('title: Studio Sample Action'), 'action card scene should include title');
assert(actionBundle.scene.includes('is-card: true'), 'action card scene should use is-card flag');
assert(actionBundle.scene.includes('frequency: 200'), 'action card should render frequency');
assert(actionBundle.scene.includes('max-visits: 1'), 'action card should render max-visits');
assert(actionBundle.scene.includes('- @spend_resources: Spend resources on outreach'), 'action card should render option link');
assert(actionBundle.scene.includes('choose-if: resources >= 1'), 'action card should render choose-if');
assert(actionBundle.scene.includes('unavailable-subtitle: 資源不足。'), 'action card should render unavailable text');
assert(actionBundle.scene.includes('Q.resources -= 1;'), 'action card should render resource effect');
assert(actionBundle.scene.includes('Q.media_reach += 2;'), 'action card should render media effect');
let parsedActionScene = null;
sceneParser.parseFromContent('studio_sample_action_card.scene.dry', actionBundle.scene, (err, result) => {
  assert(!err, 'action card scene should parse through DendryNexus: ' + (err && err.message));
  parsedActionScene = result;
});
assert(parsedActionScene, 'action card parse callback should return a scene');
const parsedSpendSection = parsedActionScene.sections.find((section) => section.id === 'studio_sample_action_card.spend_resources');
assert(parsedSpendSection, 'action card parser should expose spend_resources as a section');
assert(parsedSpendSection.goTo && parsedSpendSection.goTo[0] && parsedSpendSection.goTo[0].id === 'root', 'action card option should parse go-to as metadata');
assert(!JSON.stringify(parsedSpendSection.content || '').includes('go-to: root'), 'action card option should not expose go-to as player-facing text');
assert(advisorBundle.scene.includes('is-pinned-card: true'), 'advisor-like card should use pinned card flag');
assert(advisorBundle.installNotes.includes('Advisor-like'), 'advisor-like install notes should name the generic lane');
assert(actionBundle.files.some((file) => file.path === 'studio_sample_action_card.scene.dry'), 'bundle should include .scene.dry');
assert(actionBundle.files.some((file) => file.path === 'studio_sample_action_card.card-draft.json'), 'bundle should include draft JSON');
assert(actionBundle.files.some((file) => file.path === 'studio_sample_action_card.install-plan.json'), 'bundle should include install plan JSON');
assert(actionBundle.files.some((file) => file.path === 'studio_sample_action_card.patch-preview.diff'), 'bundle should include patch preview');
assert(actionBundle.files.some((file) => file.path === 'studio_sample_action_card.install-notes.txt'), 'bundle should include install notes');
assert(actionBundle.installNotes.includes('proposal only / not installed'), 'install notes should mark proposal-only status');
assert(actionBundle.installNotes.includes('Validation command:'), 'install notes should include validation command');
assert(actionBundle.installPlan.operations.some((op) => op.type === 'create_file'), 'card install plan should include create-file operation');
assert(actionBundle.patchPreview.includes('diff --git'), 'card bundle should expose patch preview');
assert(actionBundle.installChecklist.includes('Safe apply'), 'card bundle should expose install operation checklist');

const invalidCodes = diagnosticCodes(invalidResult);
assert(invalidCodes.includes('card_draft.duplicate_scene_id'), 'invalid card should diagnose duplicate scene id');
assert(invalidCodes.includes('card_draft.title'), 'invalid card should diagnose missing title');
assert(invalidCodes.includes('card_draft.choice_count'), 'invalid card should diagnose bad choice count');
assert(invalidCodes.includes('card_draft.missing_variable'), 'invalid card should diagnose unknown effect variable');

assert(viewerHtml.includes('data-create-template="card"'), 'viewer should expose Card template switch');
assert(viewerHtml.includes('id="card-wizard-form"'), 'viewer should expose card wizard form');
assert(viewerHtml.includes('id="card-kind"'), 'viewer should expose card kind selector');
assert(viewerHtml.includes('id="card-option-0-choose-if"'), 'viewer should expose option choose-if');
assert(viewerHtml.includes('id="card-option-0-unavailable"'), 'viewer should expose option unavailable text');
assert(viewerHtml.includes('id="card-patch-preview"'), 'viewer should expose Card patch preview');
assert(viewerHtml.includes('id="card-download-plan"'), 'viewer should expose Card install plan download');
assert(viewerHtml.includes('../authoring/card_draft.js'), 'viewer should load CardDraft core');
assert(viewerHtml.includes('card_ui.js'), 'viewer should load Card Wizard UI');
assert(cardUi.includes('installChecklist'), 'Card UI should surface install operation checklist');

const genericModel = viewer.buildViewModel({
  schemaVersion: '0.1',
  project: {name: 'generic', root: '/tmp/generic', profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry', uiLabels: {advisorLikeSingular: 'Advisor', advisorLikePlural: 'Advisors'}}],
  scenes: [],
  edges: [],
  variables: [],
  semantic: {events: [], cards: [], hands: [], decks: [], pinnedCards: [], news: {items: []}},
  diagnostics: [],
  summary: {}
});
const islandsModel = viewer.buildViewModel({
  schemaVersion: '0.1',
  project: {name: 'islands', root: '/tmp/islands', profileIds: ['generic-dendry', 'sdaah-style', 'islands-sunrise']},
  profiles: [
    {id: 'generic-dendry', uiLabels: {advisorLikeSingular: 'Advisor', advisorLikePlural: 'Advisors'}},
    {id: 'sdaah-style', uiLabels: {advisorLikeSingular: 'Advisor', advisorLikePlural: 'Advisors'}},
    {id: 'islands-sunrise', uiLabels: {advisorLikeSingular: 'Circle', advisorLikePlural: 'Circles'}}
  ],
  scenes: [],
  edges: [],
  variables: [],
  semantic: {events: [], cards: [], hands: [], decks: [], pinnedCards: [], news: {items: []}},
  diagnostics: [],
  summary: {}
});
assert(genericModel.uiLabels.advisorLikePlural === 'Advisors', 'generic/SDAAH label should be Advisors');
assert(islandsModel.uiLabels.advisorLikePlural === 'Circles', 'Island profile label should be Circles');

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_card_export_smoke_'));
const cli = spawnSync(
  'node',
  [
    path.join(__dirname, 'generate_card.js'),
    '--draft', SAMPLE_CARD,
    '--index', testIndexFile,
    '--out-dir', outDir,
    '--summary'
  ],
  {cwd: REPO_ROOT, encoding: 'utf8'}
);
assert(cli.status === 0, 'Card CLI should succeed: ' + cli.stderr);
assert(fs.existsSync(path.join(outDir, 'studio_sample_action_card.scene.dry')), 'Card CLI should write scene file');
assert(fs.existsSync(path.join(outDir, 'studio_sample_action_card.install-plan.json')), 'Card CLI should write install-plan JSON file');
assert(fs.existsSync(path.join(outDir, 'studio_sample_action_card.patch-preview.diff')), 'Card CLI should write patch preview file');

const protectedCli = spawnSync(
  'node',
  [
    path.join(__dirname, 'generate_card.js'),
    '--draft', SAMPLE_CARD,
    '--index', testIndexFile,
    '--out-dir', path.join(REPO_ROOT, 'out', 'html', 'card-export')
  ],
  {cwd: REPO_ROOT, encoding: 'utf8'}
);
assert(protectedCli.status !== 0, 'Card CLI should refuse out/html output');

process.stdout.write(JSON.stringify({
  ok: true,
  actionScene: 'studio_sample_action_card.scene.dry',
  advisorScene: 'studio_sample_advisor_card.scene.dry',
  diagnosticsChecked: true,
  genericAdvisorLabel: genericModel.uiLabels.advisorLikePlural,
  islandsAdvisorLabel: islandsModel.uiLabels.advisorLikePlural
}, null, 2) + '\n');
