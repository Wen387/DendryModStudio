#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_INDEX = '/tmp/dendry_project_map/project-index.json';
const DATED_DRAFT = path.join(__dirname, 'fixtures', 'news_drafts', 'sample_dated_news.json');
const BACKGROUND_DRAFT = path.join(__dirname, 'fixtures', 'news_drafts', 'sample_background_news.json');
const INVALID_DRAFT = path.join(__dirname, 'fixtures', 'news_drafts', 'invalid_news.json');
const VIEWER_INDEX = path.join(__dirname, 'viewer', 'index.html');
const NEWS_UI = path.join(__dirname, 'viewer', 'news_ui.js');
const newsDraft = require('./authoring/news_draft.js');
const viewer = require('./viewer/app.js');

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
  if (fs.existsSync(DEFAULT_INDEX)) {
    return readJson(DEFAULT_INDEX);
  }
  return {
    project: {root: REPO_ROOT, profileIds: ['generic-dendry']},
    profiles: [{id: 'generic-dendry', uiLabels: {advisorLikeSingular: 'Advisor', advisorLikePlural: 'Advisors'}}],
    semantic: {news: {sources: ['source/scenes/post_event_news.scene.dry'], items: []}},
    scenes: [],
    variables: []
  };
}

const index = loadIndex();
const dated = readJson(DATED_DRAFT);
const background = readJson(BACKGROUND_DRAFT);
const invalid = readJson(INVALID_DRAFT);
const datedBundle = newsDraft.buildExportBundle(dated, index);
const backgroundBundle = newsDraft.buildExportBundle(background, index);
const invalidResult = newsDraft.validateDraft(invalid, index);
const viewerHtml = fs.readFileSync(VIEWER_INDEX, 'utf8');
const newsUi = fs.readFileSync(NEWS_UI, 'utf8');

assert(datedBundle.ok, 'dated news draft should be valid: ' + JSON.stringify(datedBundle.diagnostics));
assert(backgroundBundle.ok, 'background news draft should be valid: ' + JSON.stringify(backgroundBundle.diagnostics));
assert(datedBundle.snippet.includes('if (Q.year == 2025 && Q.month == 3 && Q.founding_complete) {'), 'dated snippet should render year/month/requiresJs guard');
assert(datedBundle.snippet.includes("Q.news_1 = '[政治] Studio news wizard handles a dated item';"), 'dated snippet should assign selected news slot');
assert(datedBundle.snippet.includes("Q.news_1_desc = 'A short description with \\'quotes\\' and a backslash"), 'dated snippet should escape JS quotes');
assert(datedBundle.snippet.includes('for escaping.\';'), 'dated snippet should preserve escaped backslash content');
assert(backgroundBundle.snippet.includes("if (Q.year >= 2020) social_pool.push({n: '[社會] Background pool item from Studio'"), 'background snippet should render guarded pool push');
assert(backgroundBundle.snippet.includes("d: 'This item enters the social background pool without replacing headline news.'"), 'background snippet should include pool description');
assert(backgroundBundle.installPlan.operations.some((op) => op.anchorText === 'var social_pool = [];' && op.position === 'after'), 'background news should anchor near the matching background pool');
assert(datedBundle.files.some((file) => file.path === 'sample_dated_news.post-event-news.snippet.js'), 'dated bundle should include snippet file');
assert(datedBundle.files.some((file) => file.path === 'sample_dated_news.news-draft.json'), 'dated bundle should include draft JSON file');
assert(datedBundle.files.some((file) => file.path === 'sample_dated_news.install-plan.json'), 'dated bundle should include install plan JSON');
assert(datedBundle.files.some((file) => file.path === 'sample_dated_news.patch-preview.diff'), 'dated bundle should include patch preview');
assert(datedBundle.files.some((file) => file.path === 'sample_dated_news.install-notes.txt'), 'dated bundle should include install notes');
assert(datedBundle.installNotes.includes('source/scenes/post_event_news.scene.dry'), 'install notes should name post_event_news');
assert(datedBundle.installPlan.operations.some((op) => op.type === 'insert_text' && op.safety === 'guarded_apply'), 'news install plan should use guarded insert when router anchor evidence is known');
assert(datedBundle.installPlan.operations.some((op) => op.anchorText === '// 2014 headlines + background effects' && op.position === 'before'), 'dated news should anchor before the dated headline section');
assert(datedBundle.patchPreview.includes('diff --git'), 'news bundle should expose patch preview');
assert(datedBundle.installChecklist.includes('Guarded install'), 'news bundle should expose guarded install checklist');
assert(invalidResult.diagnostics.some((diag) => diag.code === 'news_draft.id'), 'invalid draft should diagnose bad id');
assert(invalidResult.diagnostics.some((diag) => diag.code === 'news_draft.headline'), 'invalid draft should diagnose missing headline');
assert(invalidResult.diagnostics.some((diag) => diag.code === 'news_draft.pool'), 'invalid draft should diagnose bad pool');
assert(invalidResult.diagnostics.some((diag) => diag.code === 'news_draft.requires_js'), 'invalid draft should diagnose Chinese string comparison');

const authoringWorkspaceUi = fs.readFileSync(path.join(__dirname, 'viewer', 'authoring_workspace_ui.js'), 'utf8');
assert(authoringWorkspaceUi.includes("key: 'event'"), 'viewer should expose event template switch');
assert(authoringWorkspaceUi.includes("key: 'news'"), 'viewer should expose news template switch');
assert(viewerHtml.includes('id="news-wizard-form"'), 'viewer should expose news wizard form');
assert(viewerHtml.includes('id="news-delivery"'), 'viewer should expose news delivery selector');
assert(viewerHtml.includes('id="news-pool-name"'), 'viewer should expose background pool selector');
assert(viewerHtml.includes('id="news-snippet-preview"'), 'viewer should expose news snippet preview');
assert(viewerHtml.includes('id="news-patch-preview"'), 'viewer should expose News patch preview');
assert(viewerHtml.includes('id="news-download-plan"'), 'viewer should expose News install plan download');
assert(viewerHtml.includes('../authoring/news_draft.js'), 'viewer should load NewsDraft core');
assert(viewerHtml.includes('news_ui.js'), 'viewer should load News Wizard UI');
assert(newsUi.includes('ProjectMapNewsWizard'), 'news UI should expose a small API');
assert(newsUi.includes('data-news-preview-tab'), 'news UI should manage news output tabs');
assert(newsUi.includes('installChecklist'), 'News UI should surface install operation checklist');

const genericModel = viewer.buildViewModel({
  schemaVersion: '0.1',
  project: {name: 'generic', root: '/tmp/generic', profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry', uiLabels: {advisorLikeSingular: 'Advisor', advisorLikePlural: 'Advisors'}}],
  scenes: [],
  edges: [],
  variables: [],
  semantic: {events: [], cards: [], hands: [], decks: [], pinnedCards: [], news: {sources: ['source/scenes/post_event_news.scene.dry'], items: []}},
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
  semantic: {events: [], cards: [], hands: [], decks: [], pinnedCards: [], news: {sources: ['source/scenes/post_event_news.scene.dry'], items: []}},
  diagnostics: [],
  summary: {}
});
assert(genericModel.uiLabels.advisorLikePlural === 'Advisors', 'generic profile should display Advisors');
assert(islandsModel.uiLabels.advisorLikePlural === 'Circles', 'Island profile should display Circles');

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_news_export_smoke_'));
const cli = spawnSync(
  'node',
  [
    path.join(__dirname, 'generate_news.js'),
    '--draft', DATED_DRAFT,
    '--index', DEFAULT_INDEX,
    '--out-dir', outDir,
    '--summary'
  ],
  {cwd: REPO_ROOT, encoding: 'utf8'}
);
if (fs.existsSync(DEFAULT_INDEX)) {
  assert(cli.status === 0, 'News CLI should succeed: ' + cli.stderr);
  assert(fs.existsSync(path.join(outDir, 'sample_dated_news.post-event-news.snippet.js')), 'News CLI should write snippet file');
  assert(fs.existsSync(path.join(outDir, 'sample_dated_news.install-plan.json')), 'News CLI should write install-plan JSON file');
  assert(fs.existsSync(path.join(outDir, 'sample_dated_news.patch-preview.diff')), 'News CLI should write patch preview file');
}

const protectedCli = spawnSync(
  'node',
  [
    path.join(__dirname, 'generate_news.js'),
    '--draft', DATED_DRAFT,
    '--index', DEFAULT_INDEX,
    '--out-dir', path.join(REPO_ROOT, 'out', 'html', 'news-export')
  ],
  {cwd: REPO_ROOT, encoding: 'utf8'}
);
if (fs.existsSync(DEFAULT_INDEX)) {
  assert(protectedCli.status !== 0, 'News CLI should refuse out/html output');
}

process.stdout.write(JSON.stringify({
  ok: true,
  datedSnippet: datedBundle.files[0].path,
  backgroundSnippet: backgroundBundle.files[0].path,
  diagnosticsChecked: true,
  genericAdvisorLabel: genericModel.uiLabels.advisorLikePlural,
  islandsAdvisorLabel: islandsModel.uiLabels.advisorLikePlural
}, null, 2) + '\n');
