#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const installPlan = require('./authoring/install_plan.js');
const reviewUi = require('./viewer/install_review_ui.js');

const ROOT = __dirname;
const INSTALL_UI = path.join(ROOT, 'viewer', 'install_assistant_ui.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function t(_key, fallback) {
  return fallback;
}

function loadAssistant() {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    dendryDesktop: {applyInstallPlan() {}}
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(INSTALL_UI, 'utf8'), context, {filename: INSTALL_UI});
  assert(context.ProjectMapInstallAssistant, 'Install Assistant API should load without DOM');
  return context.ProjectMapInstallAssistant;
}

const plan = installPlan.buildInstallPlan({
  id: 'review_ui_plan',
  draftKind: 'world_event',
  title: 'Review UI Plan',
  operations: [
    {
      id: 'replace_intro',
      type: 'replace_text',
      path: 'source/scenes/events/opening.scene.dry',
      line: 12,
      search: 'Old player-facing sentence.',
      replace: 'New player-facing sentence.',
      safety: 'guarded_apply',
      description: 'Replace one visible sentence after matching the original line.'
    },
    {
      id: 'create_scene',
      type: 'create_file',
      path: 'source/scenes/events/new_event.scene.dry',
      content: '* new_event\n\n# title\nNew Event\n',
      safety: 'safe_apply',
      description: 'Create the exported event scene.'
    },
    {
      id: 'manual_route',
      type: 'manual_snippet',
      path: 'source/scenes/main.scene.dry',
      content: '- @new_event: Open new event\n',
      safety: 'manual_review',
      description: 'Review the hand route manually.'
    }
  ]
});

const reviewHtml = reviewUi.renderPlanReview({
  plan,
  summary: installPlan.operationSummary(plan),
  installApi: installPlan,
  runtimeReadiness: {
    generatedRuntimeComplete: false,
    missingRuntimeDependencies: ['out/html/core.js']
  },
  result: {
    ok: true,
    dryRun: true,
    message: 'Dry-run verified current files.',
    results: [
      {
        id: 'replace_intro',
        status: 'would_apply',
        path: 'source/scenes/events/opening.scene.dry',
        evidence: {
          status: 'would_apply',
          match: 'matched_current_file',
          line: 12,
          beforeSnippet: 'Old player-facing sentence.',
          afterSnippet: 'New player-facing sentence.',
          beforeHash: '1234567890abcdef1234567890abcdef',
          afterHash: 'abcdef1234567890abcdef1234567890'
        }
      },
      {id: 'create_scene', status: 'would_apply', path: 'source/scenes/events/new_event.scene.dry'},
      {id: 'manual_route', status: 'manual_review', path: 'source/scenes/main.scene.dry'}
    ],
    diagnostics: []
  },
  locale: 'en',
  t
});

assert(reviewHtml.includes('data-install-operation-id="replace_intro"'), 'review cards should expose stable operation ids');
assert(reviewHtml.includes('data-authoring-context-lens="true"'), 'review cards should expose context lens affordances');
assert(reviewHtml.includes('data-context-lens-kind="operation"'), 'review operation lens should identify operation context');
assert(reviewHtml.includes('data-install-dry-run-recap="true"'), 'review panel should summarize dry-run evidence');
assert(reviewHtml.includes('Dry-run check passed'), 'review panel should show dry-run recap status');
assert(reviewHtml.includes('Dry-run verified current files.'), 'review panel should preserve dry-run recap message');
assert(reviewHtml.includes('data-install-op-confidence="true"'), 'review cards should expose confidence evidence blocks');
assert(reviewHtml.includes('data-review-confidence-field="change"'), 'confidence evidence should include change summary');
assert(reviewHtml.includes('data-review-confidence-field="source"'), 'confidence evidence should include source summary');
assert(reviewHtml.includes('data-review-confidence-field="safety"'), 'confidence evidence should include safety summary');
assert(reviewHtml.includes('data-review-confidence-field="boundary"'), 'confidence evidence should include boundary summary');
assert(reviewHtml.includes('data-review-confidence-field="provenance"'), 'confidence evidence should include provenance summary');
assert(reviewHtml.includes('Runtime Preview + Quick Lens'), 'source-backed installable operations should recommend runtime preview plus focused lens');
assert(reviewHtml.includes('temporary full build'), 'runtime recommendation should explain quick-lens full-build fallback when generated runtime is incomplete');
assert(reviewHtml.includes('out/html/core.js'), 'runtime fallback should list missing generated runtime dependency');
assert(reviewHtml.includes('Manual review first'), 'manual operations should recommend completing manual review before runtime evidence');
assert(reviewHtml.includes('Old player-facing sentence.'), 'review cards should show replace_text before text');
assert(reviewHtml.includes('New player-facing sentence.'), 'review cards should show replace_text after text');
assert(reviewHtml.includes('line 12'), 'review cards should show source line context');
assert(reviewHtml.includes('Check passed, not applied yet'), 'review cards should show dry-run status badges');
assert(reviewHtml.includes('Manual snippet'), 'review cards should show manual snippets');
assert(reviewHtml.includes('Current-file evidence'), 'review cards should render current-file evidence after dry-run');
assert(reviewHtml.includes('matched_current_file'), 'review cards should show the evidence match status');
assert(reviewHtml.includes('1234567890ab...'), 'review cards should shorten evidence hashes');

const assistant = loadAssistant();
const runtimeHtml = assistant.renderRuntimePreviewResult({
  ok: true,
  sessionId: 'review_ui_runtime',
  compareUrl: 'http://127.0.0.1:47999/session/compare/',
  modifiedUrl: 'http://127.0.0.1:47999/session/modified/',
  baselineBuild: {ok: true, command: 'npm run build'},
  modifiedBuild: {ok: true, command: 'npm run build'}
});
assert(runtimeHtml.includes('data-runtime-preview-frame="true"'), 'runtime preview result should embed an inline frame');
assert(runtimeHtml.includes('http://127.0.0.1:47999/session/compare/'), 'runtime preview frame should prefer the comparison URL');
assert(runtimeHtml.includes('data-runtime-preview-action="end"'), 'runtime preview result should expose an explicit end preview action');

const pendingRuntimeHtml = assistant.renderRuntimePreviewResult({
  ok: true,
  pending: true,
  message: 'Creating preview...'
});
assert(pendingRuntimeHtml.includes('<progress'), 'pending runtime preview should show progress');
assert(pendingRuntimeHtml.includes('full deployment preview'), 'pending runtime preview should explain full deployment preview cost');

process.stdout.write(JSON.stringify({
  ok: true,
  operations: plan.operations.length,
  markers: ['data-install-operation-id', 'install-op-preview', 'data-runtime-preview-frame']
}, null, 2) + '\n');
