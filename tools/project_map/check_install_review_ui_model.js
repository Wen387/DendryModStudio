#!/usr/bin/env node
// @ts-check
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const installPlan = require('./authoring/install_plan.js');
const installOperationContracts = require('./authoring/install_operation_contracts.js');
const reviewStateModel = require('./viewer/install_review_state_model.js');
const resultReportModel = require('./viewer/install_result_report_model.js');
const reviewUi = require('./viewer/install_review_ui.js');

const ROOT = __dirname;
const INSTALL_UI = path.join(ROOT, 'viewer', 'install_assistant_ui.js');
const REVIEW_STATE_MODEL = path.join(ROOT, 'viewer', 'install_review_state_model.js');
const RESULT_REPORT_MODEL = path.join(ROOT, 'viewer', 'install_result_report_model.js');

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
    dendryDesktop: {applyInstallPlan() {}},
    ProjectMapInstallOperationContracts: installOperationContracts,
    ProjectMapInstallReviewStateModel: reviewStateModel,
    ProjectMapInstallResultReportModel: resultReportModel
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
  readiness: installOperationContracts.classifyReviewApplyReadiness(installPlan.operationSummary(plan), true, false),
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
assert(reviewHtml.includes('data-review-apply-can-apply="true"'), 'review panel should consume shared readiness can-apply state');
assert(reviewHtml.includes('data-review-apply-needs-check="false"'), 'review panel should consume shared readiness check state');
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
const draftExport = {
  schemaVersion: '0.1',
  exportedAt: '2026-05-20T03:56:48.321Z',
  items: [
    {
      draftId: 'first_saved_draft',
      title: 'First saved draft',
      installPlan: installPlan.buildInstallPlan({
        id: 'first_saved_draft',
        draftKind: 'existing_scene_edit',
        title: 'First saved draft',
        project: {root: '/tmp/dms-draft-project'},
        operations: [
          {
            id: 'replace_first',
            type: 'replace_text',
            path: 'source/scenes/events/first.scene.dry',
            line: 1,
            search: 'First',
            replace: 'First changed',
            safety: 'guarded_apply'
          }
        ]
      })
    },
    {
      draftId: 'second_saved_draft',
      title: 'Second saved draft',
      installPlan: installPlan.buildInstallPlan({
        id: 'second_saved_draft',
        draftKind: 'world_event',
        title: 'Second saved draft',
        project: {root: '/tmp/dms-draft-project'},
        operations: [
          {
            id: 'create_second',
            type: 'create_file',
            path: 'source/scenes/events/second.scene.dry',
            content: '* second\n',
            safety: 'safe_apply'
          }
        ]
      })
    }
  ]
};
assistant.loadPlan(draftExport, {fileName: 'dendry-studio-drafts.json'});
const importedDraftExport = assistant.getState().plan;
assert(importedDraftExport && importedDraftExport.draftKind === 'studio_drafts_export', 'assistant should import Studio drafts export as a combined install plan');
assert(importedDraftExport.operations.length === 2, 'combined Studio drafts export should include every saved draft operation');
assert(importedDraftExport.operations[0].id === 'draft_1_replace_first', 'combined draft export operation ids should stay unique');
assert(importedDraftExport.operations[1].sourceDraftId === 'second_saved_draft', 'combined draft export operations should preserve source draft provenance');
assert(importedDraftExport.project && importedDraftExport.project.root === '/tmp/dms-draft-project', 'combined draft export should preserve common project root');
assistant.loadPlan({
  schemaVersion: '0.1',
  exportedAt: '2026-05-20T03:56:48.321Z',
  items: [draftExport.items[0]]
}, {fileName: 'dendry-studio-drafts.json'});
const singleDraftExport = assistant.getState();
assert(singleDraftExport.plan && singleDraftExport.plan.id === 'first_saved_draft', 'single-item Studio drafts export should load its install plan directly');
assert(singleDraftExport.planFileName === 'first_saved_draft.install-plan.json', 'single-item Studio drafts export should use the draft install-plan filename');
assistant.loadPlan({schemaVersion: '0.1', items: []}, {fileName: 'dendry-studio-drafts.json'});
assert(assistant.getState().plan === null, 'Studio drafts export without install plans should not masquerade as an empty plan');
const readiness = assistant.buildReviewApplyReadiness(plan, {checked: true, allowAdvanced: false});
assert(readiness.canApply === true, 'assistant readiness should allow applying checked automatic operations while manual review remains');
assert(readiness.manualReviewCount === 1, 'assistant readiness should preserve manual review count from the shared classifier');
const uncheckedReadiness = assistant.buildReviewApplyReadiness(plan, {checked: false, allowAdvanced: false});
assert(uncheckedReadiness.canApply === false && uncheckedReadiness.needsCheck === true, 'assistant readiness should block apply before a matching check');
const mixedSummary = {safeApply: 0, guardedApply: 1, advancedApply: 1, manualReview: 1, refused: 1, total: 4};
const mixedState = reviewStateModel.buildReviewApplyUiState({
  summary: mixedSummary,
  readiness: installOperationContracts.classifyReviewApplyReadiness(mixedSummary, true, false)
});
assert(mixedState.statusKind === 'checked', 'mixed review/apply state should prioritize checked automatic apply over remaining manual/refused work');
assert(mixedState.readiness.needsAdvancedConsent === true, 'mixed review/apply state should preserve skipped advanced consent');
assert(mixedState.steps.some((step) => step.kind === 'manual_count' && step.count === 1), 'mixed review/apply state should keep manual work visible');
assert(mixedState.steps.some((step) => step.kind === 'refused_count' && step.count === 1), 'mixed review/apply state should keep refused work visible');
const assistantMixedState = assistant.buildReviewApplyUiState(mixedSummary, false);
assert(assistantMixedState.statusKind === 'needs_check_guarded', 'assistant should consume shared mixed review/apply UI state before check');
const assistantSource = fs.readFileSync(INSTALL_UI, 'utf8');
const reviewStateSource = fs.readFileSync(REVIEW_STATE_MODEL, 'utf8');
const resultReportSource = fs.readFileSync(RESULT_REPORT_MODEL, 'utf8');
assert(reviewStateSource.includes('classifyReviewApplyReadiness'), 'review state model should route readiness through the shared typed classifier');
assert(assistantSource.includes('buildReviewApplyUiState'), 'assistant should route rendered readiness through the shared UI state model');
assert(resultReportSource.includes('rollbackNotes'), 'result report model should own rollback note construction');
assert(assistantSource.includes('buildInstallResultReport'), 'assistant should route result reports through the shared report model');
assert(assistantSource.includes('install.empty.runtimePreview.title'), 'assistant first stage should expose current-project runtime preview copy');
assert(assistantSource.includes('install.result.emptyCurrentPreview'), 'assistant should explain no-plan Runtime Preview instead of asking for a plan only');
assert(assistantSource.includes('install.runtimePreviewEmptyCurrent'), 'assistant runtime preview panel should use no-plan copy for current-project previews');
assert(assistantSource.includes('toggleElement(elements.runtimePreview, hasDesktop)'), 'assistant should keep Runtime Preview visible before a change plan is loaded');
assert(!assistantSource.includes('function hasAutoApplyOperations'), 'assistant should not keep a local auto-apply operation classifier');
assert(!assistantSource.includes('eligibleAutomatic = safe + guarded'), 'assistant should not keep a local readiness classifier fallback');
assert(!assistantSource.includes('refused && !autoApplyAvailable'), 'assistant should not keep local blocked/apply priority rules');
assert(!assistantSource.includes('function rollbackNotes'), 'assistant should not keep local rollback report logic');
assert(!assistantSource.includes('function groupResults'), 'assistant should not keep local result grouping logic');
assistant.loadPlan(installPlan.buildInstallPlan({
  id: 'assistant_report_plan',
  draftKind: 'test',
  title: 'Assistant Report Plan',
  operations: [
    {
      id: 'delete_asset_line',
      type: 'replace_text',
      path: 'source/scenes/events/opening.scene.dry',
      line: 4,
      search: 'face-image: img/portraits/old.png',
      replace: '',
      allowEmptyReplace: true,
      deleteMode: 'line',
      deletesSourceLine: true,
      safety: 'guarded_apply'
    },
    {
      id: 'replace_line_two',
      type: 'replace_text',
      path: 'source/scenes/events/opening.scene.dry',
      line: 5,
      search: 'Old line two.',
      replace: 'New line two.',
      safety: 'guarded_apply'
    },
    {
      id: 'replace_line_three',
      type: 'replace_text',
      path: 'source/scenes/events/opening.scene.dry',
      line: 6,
      search: 'Old line three.',
      replace: 'New line three.',
      safety: 'guarded_apply'
    }
  ]
}));
const assistantReport = assistant.renderResultReport({
  ok: true,
  dryRun: true,
  results: [
    {id: 'delete_asset_line', status: 'would_apply', path: 'source/scenes/events/opening.scene.dry'},
    {id: 'replace_line_two', status: 'would_apply', path: 'source/scenes/events/opening.scene.dry'},
    {id: 'replace_line_three', status: 'would_apply', path: 'source/scenes/events/opening.scene.dry'}
  ],
  changedFiles: [
    {path: 'source/scenes/events/opening.scene.dry', status: 'would_apply', match: 'matched_current_file', operationCount: 3}
  ],
  operationCount: 3,
  uniqueFileCount: 1,
  diagnostics: []
});
assert(assistantReport.includes('3 operation(s) / 1 file(s)'), 'assistant report should separate operation count from unique file count');
assert(assistantReport.includes('source/scenes/events/opening.scene.dry · would_apply · matched_current_file · 3 operation(s)'), 'assistant report should aggregate same-file operation details');
assert(assistantReport.includes('Would undo by restoring deleted line in source/scenes/events/opening.scene.dry'), 'line deletion rollback note should say restore deleted line');
const failedAssistantReport = assistant.renderResultReport({
  ok: false,
  dryRun: true,
  results: [
    {id: 'replace_ok', status: 'would_apply', path: 'source/scenes/events/opening.scene.dry'},
    {id: 'replace_failed', status: 'failed', path: 'source/scenes/events/opening.scene.dry'}
  ],
  diagnostics: [
    {severity: 'error', code: 'install_plan.section_anchor_missing', message: 'Expected exactly one section start anchor match, found 0.'}
  ],
  operationCount: 2,
  uniqueFileCount: 0,
  changedFiles: []
});
assert(failedAssistantReport.includes('Install check needs attention.'), 'failed assistant report should be explicit that the check needs attention');
assert(failedAssistantReport.includes('- Needs attention: 1'), 'failed assistant report should list failed operations separately');
assert(!failedAssistantReport.includes('Verified diff available'), 'failed assistant report without committed/checkable files should not claim a verified diff');
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
assert(!pendingRuntimeHtml.includes('<ol>'), 'pending runtime preview should stay compact');
assert(!pendingRuntimeHtml.includes('full deployment preview'), 'pending runtime preview should avoid verbose inline copy');

process.stdout.write(JSON.stringify({
  ok: true,
  operations: plan.operations.length,
  markers: ['data-install-operation-id', 'install-op-preview', 'data-runtime-preview-frame']
}, null, 2) + '\n');
