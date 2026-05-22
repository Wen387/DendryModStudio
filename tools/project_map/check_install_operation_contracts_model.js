#!/usr/bin/env node
// @ts-check
'use strict';

const installOperationContracts = require('./authoring/install_operation_contracts.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const normalized = installOperationContracts.normalizeInstallOperation({
  type: 'replace_text',
  safety: 'unsafe_status',
  path: ' source/scenes/events/example.scene.dry ',
  line: '7',
  rawAnchorText: '  raw anchor  ',
  rawEndAnchorText: 'raw end',
  expectedRangeHash: 'abc123',
  deletesSourceLine: true,
  deleteMode: 'line'
}, 2);
assert(normalized.id === 'op_3', 'typed operation core should assign stable fallback ids');
assert(normalized.type === 'replace_text', 'typed operation core should preserve known operation types');
assert(normalized.safety === 'manual_review', 'typed operation core should normalize unsafe statuses to manual review');
assert(normalized.path === 'source/scenes/events/example.scene.dry', 'typed operation core should trim operation paths');
assert(normalized.line === 7, 'typed operation core should normalize line numbers');
assert(normalized.rawAnchorText === '  raw anchor  ', 'typed operation core should preserve raw anchor text');
assert(normalized.rawEndAnchorText === 'raw end', 'typed operation core should preserve raw end anchor text');
assert(normalized.expectedRangeHash === 'abc123', 'typed operation core should preserve expected range hashes');
assert(normalized.deletesSourceLine === true && normalized.deleteMode === 'line', 'typed operation core should preserve whole-line delete evidence');

const unknownType = installOperationContracts.normalizeInstallOperation({type: 'future_operation', safety: 'safe_apply'}, 0);
assert(unknownType.type === 'future_operation', 'typed operation core should preserve unknown operation types for orchestration checks');
const semanticOperation = installOperationContracts.normalizeInstallOperation({type: 'replace_text', safety: 'guarded_apply', semanticOperation: 'deck_pool.add_member', groupId: 'advisor_controller:shuffle_leadership', reviewSummary: 'Roster item'}, 1);
assert(semanticOperation.semanticOperation === 'deck_pool.add_member', 'operation core should preserve deck/advisor semantic operation tags');
assert(semanticOperation.groupId === 'advisor_controller:shuffle_leadership' && semanticOperation.reviewSummary === 'Roster item', 'operation core should preserve grouped review metadata');
['deck_pool.add_member', 'deck_pool.remove_member', 'deck_pool.move_member'].forEach((role, index) => {
  const normalizedDeckOperation = installOperationContracts.normalizeInstallOperation({
    id: role.replace(/\./g, '_'),
    type: 'replace_text',
    safety: 'guarded_apply',
    semanticOperation: role,
    role,
    groupId: 'deck_pool:main_party',
    reviewSummary: 'Move Shuffle Leadership from Party Affairs to Government Affairs'
  }, index);
  assert(normalizedDeckOperation.semanticOperation === role, 'deck pool membership operation should preserve semantic operation ' + role);
  assert(normalizedDeckOperation.groupId === 'deck_pool:main_party' && normalizedDeckOperation.reviewSummary, 'deck pool membership operation should preserve grouped review summary for ' + role);
});

const patchPreview = installOperationContracts.renderPatchPreview({
  operations: [
    {type: 'create_file', path: 'source/scenes/events/new.scene.dry', content: '* new_scene\n'},
    {type: 'replace_text', path: 'source/scenes/events/example.scene.dry', line: 7, search: 'Old', replace: 'New'}
  ]
});
assert(patchPreview.includes('new file mode 100644'), 'typed operation core should render create_file previews');
assert(patchPreview.includes('@@ line 7'), 'typed operation core should render replace_text line previews');

const summary = installOperationContracts.summarizeInstallOperations([
  {safety: 'safe_apply'},
  {safety: 'guarded_apply'},
  {safety: 'advanced_apply'},
  {safety: 'manual_review'},
  {safety: 'unknown_safety'}
]);
assert(summary.safeApply === 1, 'typed operation core should count safe operations');
assert(summary.guardedApply === 1, 'typed operation core should count guarded operations');
assert(summary.advancedApply === 1, 'typed operation core should count advanced operations');
assert(summary.manualReview === 2, 'typed operation core should route unknown safety to manual review');
assert(summary.total === 5, 'typed operation core should count all operations');

const readiness = installOperationContracts.classifyReviewApplyReadiness(summary, true, true);
assert(readiness.manualReviewCount === 2, 'readiness should preserve manual review count');
assert(readiness.automaticOperationCount === 3, 'readiness should count automatic operations separately');
assert(readiness.eligibleAutomaticOperationCount === 3, 'readiness should count eligible automatic operations');
assert(readiness.canApply === true, 'readiness should allow checked automatic apply even when manual review operations remain');

const uncheckedReadiness = installOperationContracts.classifyReviewApplyReadiness(summary, false, false);
assert(uncheckedReadiness.canApply === false, 'readiness should block apply before a matching check');
assert(uncheckedReadiness.needsCheck === true, 'readiness should require a check for eligible safe and guarded operations');
assert(uncheckedReadiness.needsAdvancedConsent === true, 'readiness should report skipped advanced operations when advanced opt-in is off');
assert(uncheckedReadiness.eligibleAutomaticOperationCount === 2, 'readiness should exclude advanced operations until advanced opt-in is on');
assert(uncheckedReadiness.skippedAdvancedOperationCount === 1, 'readiness should count skipped advanced operations');

const evidenceRow = installOperationContracts.withOperationEvidence(
  {id: 'op_ev', type: 'replace_text', path: 'source/scenes/events/example.scene.dry', status: 'would_apply'},
  true,
  {id: 'op_ev', type: 'replace_text', path: 'source/scenes/events/example.scene.dry'},
  installOperationContracts.textOperationEvidence({line: 7}, 'would_apply', '', '', {beforeSnippet: 'Old', afterSnippet: 'New'})
);
assert(evidenceRow.evidence && evidenceRow.evidence.operationId === 'op_ev', 'typed operation core should attach operation evidence');
assert(evidenceRow.evidence && evidenceRow.evidence.beforeSnippet === 'Old', 'typed operation core should preserve text evidence snippets');

const finalized = installOperationContracts.finalizeApplyResult({
  ok: true,
  dryRun: true,
  operationSummary: summary,
  results: [{
    id: 'op_1',
    type: 'replace_text',
    path: 'source/scenes/events/example.scene.dry',
    status: 'would_apply',
    evidence: {
      status: 'would_apply',
      match: 'exact',
      line: 7,
      diff: 'diff --git a/source/scenes/events/example.scene.dry b/source/scenes/events/example.scene.dry'
    }
  }],
  diagnostics: []
}, true);
assert(finalized.changedFiles && finalized.changedFiles.length === 1, 'typed operation core should aggregate changed files');
assert(finalized.operationCount === 1 && finalized.uniqueFileCount === 1, 'typed operation core should count result rows and unique files');
assert(String(finalized.verifiedDiff || '').includes('diff --git'), 'typed operation core should aggregate verified diffs when requested');

process.stdout.write(JSON.stringify({
  ok: true,
  normalizedType: normalized.type,
  unknownType: unknownType.type,
  automaticOperationCount: readiness.automaticOperationCount,
  eligibleAutomaticOperationCount: readiness.eligibleAutomaticOperationCount,
  changedFiles: finalized.changedFiles ? finalized.changedFiles.length : 0
}, null, 2) + '\n');
