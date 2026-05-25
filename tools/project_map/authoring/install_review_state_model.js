// @ts-check
(function initProjectMapInstallReviewStateModel(global) {
  'use strict';

  /**
   * @typedef {import('../types/project_map_contracts').InstallApplyResult} InstallApplyResult
   * @typedef {import('../types/project_map_contracts').InstallOperationSummary} InstallOperationSummary
   * @typedef {import('../types/project_map_contracts').InstallPreflightResult} InstallPreflightResult
   * @typedef {import('../types/project_map_contracts').ReviewApplyReadiness} ReviewApplyReadiness
   * @typedef {import('../types/project_map_contracts').ReviewApplyUiState} ReviewApplyUiState
   * @typedef {import('../types/project_map_contracts').ReviewApplyStep} ReviewApplyStep
   */

  /**
   * @param {unknown} summary
   * @param {boolean=} checked
   * @param {boolean=} allowAdvanced
   * @param {{classifyReviewApplyReadiness?: (summary: unknown, checked?: boolean, allowAdvanced?: boolean) => ReviewApplyReadiness}=} contracts
   * @returns {ReviewApplyReadiness}
   */
  function buildReviewApplyReadiness(summary, checked, allowAdvanced, contracts) {
    if (contracts && typeof contracts.classifyReviewApplyReadiness === 'function') {
      return contracts.classifyReviewApplyReadiness(summary || emptySummary(), checked === true, allowAdvanced === true);
    }
    const value = normalizeSummary(summary);
    return {
      canApply: false,
      checked: checked === true,
      needsCheck: false,
      needsAdvancedConsent: false,
      manualReviewCount: value.manualReview,
      refusedCount: value.refused,
      automaticOperationCount: value.safeApply + value.guardedApply + value.advancedApply,
      eligibleAutomaticOperationCount: 0,
      skippedAdvancedOperationCount: value.advancedApply
    };
  }

  /**
   * @param {{summary?: unknown, readiness?: ReviewApplyReadiness|null, lastResult?: unknown, postApplyVerification?: unknown}=} options
   * @returns {ReviewApplyUiState}
   */
  function buildReviewApplyUiState(options) {
    const opts = options || {};
    const summary = normalizeSummary(opts.summary);
    const readiness = normalizeReadiness(opts.readiness, summary);
    const autoApplyAvailable = Number(readiness.eligibleAutomaticOperationCount || 0) > 0;
    const checked = readiness.checked === true;
    const postApply = postApplyState(opts.lastResult, opts.postApplyVerification, summary);
    const failedResult = firstFailedResult(opts.lastResult);
    const statusKind = postApply
      ? postApply.statusKind
      : failedResult
      ? 'failed_check'
      : readiness.canApply
      ? 'checked'
      : readiness.needsCheck
      ? (summary.guardedApply ? 'needs_check_guarded' : 'needs_check_safe')
      : summary.refused && !autoApplyAvailable
      ? 'blocked'
      : readiness.needsAdvancedConsent
      ? 'advanced'
      : summary.manualReview
      ? 'manual'
      : summary.refused
      ? 'blocked'
      : 'none';
    const steps = (postApply ? postApply.steps : []).concat(failedResult ? [{
      kind: 'failed_operation',
      labelParts: [failedResult.id || failedResult.type || 'operation', failedResult.path || ''].filter(Boolean).map(String)
    }] : []).concat(summarySteps(summary, readiness, autoApplyAvailable, checked));
    return {
      summary,
      readiness,
      autoApplyAvailable,
      checked,
      failedResult,
      postApply,
      statusKind,
      steps
    };
  }

  /**
   * @param {unknown} result
   * @param {unknown} postApplyVerification
   * @param {InstallOperationSummary} summary
   * @returns {{statusKind: string, steps: ReviewApplyStep[]}|null}
   */
  function postApplyState(result, postApplyVerification, summary) {
    const value = isObject(result) ? result : null;
    if (!value || value.dryRun !== false) {
      return null;
    }
    const verification = isObject(value.postApplyVerification) ? value.postApplyVerification : postApplyVerification;
    if (!isObject(verification)) {
      return {statusKind: 'applied_needs_verification', steps: [{kind: 'apply_done'}]};
    }
    const verificationRows = Array.isArray(verification.results) ? verification.results : [];
    const hasFailures = resultHasFailures(verification) || verification.ok === false;
    const stillPending = verificationRows.some((row) => row && row.status === 'would_apply');
    if (hasFailures || stillPending) {
      return {statusKind: 'applied_attention', steps: [{kind: 'post_verify_attention'}]};
    }
    if (summary.manualReview || summary.refused) {
      return {statusKind: 'applied_manual_remaining', steps: [{kind: 'post_verify_passed'}]};
    }
    return {statusKind: 'applied_verified', steps: [{kind: 'post_verify_passed'}]};
  }

  /**
   * @param {InstallOperationSummary} summary
   * @param {ReviewApplyReadiness} readiness
   * @param {boolean} autoApplyAvailable
   * @param {boolean} checked
   * @returns {ReviewApplyStep[]}
   */
  function summarySteps(summary, readiness, autoApplyAvailable, checked) {
    return [
      autoApplyAvailable
        ? {kind: checked ? 'check_passed' : 'check_needed'}
        : {kind: 'no_check_needed'},
      summary.safeApply ? {kind: 'safe_count', count: summary.safeApply} : {kind: 'no_safe'},
      summary.guardedApply ? {kind: 'guarded_count', count: summary.guardedApply} : {kind: 'no_guarded'},
      summary.advancedApply ? {kind: 'advanced_count', count: summary.advancedApply, skipped: readiness.skippedAdvancedOperationCount || 0} : {kind: 'no_advanced'},
      summary.manualReview ? {kind: 'manual_count', count: summary.manualReview} : {kind: 'no_manual'},
      summary.refused ? {kind: 'refused_count', count: summary.refused} : {kind: 'no_refused'}
    ];
  }

  /**
   * @param {unknown} result
   * @returns {InstallPreflightResult|null}
   */
  function firstFailedResult(result) {
    const value = isObject(result) ? result : {};
    const rows = Array.isArray(value.results) ? value.results : [];
    return /** @type {InstallPreflightResult|null} */ (rows.find((item) => item && item.status === 'failed') || null);
  }

  /**
   * @param {unknown} result
   * @returns {boolean}
   */
  function resultHasFailures(result) {
    const value = isObject(result) ? result : {};
    const rows = Array.isArray(value.results) ? value.results : [];
    return rows.some((item) => item && item.status === 'failed');
  }

  /**
   * @param {unknown} value
   * @param {InstallOperationSummary} summary
   * @returns {ReviewApplyReadiness}
   */
  function normalizeReadiness(value, summary) {
    if (isObject(value)) {
      return /** @type {ReviewApplyReadiness} */ (Object.assign({
        canApply: false,
        checked: false,
        needsCheck: false,
        needsAdvancedConsent: false,
        manualReviewCount: summary.manualReview,
        refusedCount: summary.refused,
        automaticOperationCount: summary.safeApply + summary.guardedApply + summary.advancedApply,
        eligibleAutomaticOperationCount: 0,
        skippedAdvancedOperationCount: 0
      }, value));
    }
    return buildReviewApplyReadiness(summary, false, false);
  }

  /**
   * @param {unknown} value
   * @returns {InstallOperationSummary}
   */
  function normalizeSummary(value) {
    const summary = isObject(value) ? value : {};
    return {
      safeApply: nonNegative(summary.safeApply),
      guardedApply: nonNegative(summary.guardedApply),
      advancedApply: nonNegative(summary.advancedApply),
      manualReview: nonNegative(summary.manualReview),
      refused: nonNegative(summary.refused),
      total: nonNegative(summary.total)
    };
  }

  /**
   * @returns {InstallOperationSummary}
   */
  function emptySummary() {
    return {safeApply: 0, guardedApply: 0, advancedApply: 0, manualReview: 0, refused: 0, total: 0};
  }

  /**
   * @param {unknown} value
   * @returns {number}
   */
  function nonNegative(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  /**
   * @param {unknown} value
   * @returns {value is Record<string, any>}
   */
  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {
    buildReviewApplyReadiness,
    buildReviewApplyUiState,
    firstFailedResult,
    resultHasFailures
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapInstallReviewStateModel = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
