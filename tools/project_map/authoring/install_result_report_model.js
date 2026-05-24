// @ts-check
(function initProjectMapInstallResultReportModel(global) {
  'use strict';

  /**
   * @typedef {import('../types/project_map_contracts').InstallApplyResult} InstallApplyResult
   * @typedef {import('../types/project_map_contracts').InstallPlan} InstallPlan
   * @typedef {import('../types/project_map_contracts').InstallPlanOperation} InstallPlanOperation
   * @typedef {import('../types/project_map_contracts').InstallResultReportOptions} InstallResultReportOptions
   */

  /**
   * @param {unknown} result
   * @param {InstallResultReportOptions=} options
   * @returns {string}
   */
  function buildInstallResultReport(result, options) {
    if (!result || !isObject(result)) {
      return '';
    }
    const opts = options || {};
    const t = translator(opts.t);
    const lines = [];
    const results = Array.isArray(result.results) ? result.results : [];
    lines.push(result.ok ? t('install.report.ok', 'Install check completed.') : t('install.report.needsAttention', 'Install check needs attention.'));
    lines.push((result.dryRun ? t('install.report.dryRun', 'Mode: dry-run') : t('install.report.apply', 'Mode: apply')) +
      (result.allowAdvanced ? ' · ' + t('install.report.advancedOn', 'advanced opt-in enabled') : ''));
    if (result.message) {
      lines.push(String(result.message));
    }
    const changedFiles = Array.isArray(result.changedFiles) ? result.changedFiles : [];
    const operationCount = Number(result.operationCount || results.filter((row) => row && row.path).length || results.length || 0);
    const uniqueFileCount = Number(result.uniqueFileCount || changedFiles.length || 0);
    if (changedFiles.length) {
      lines.push(t('install.report.verifiedDiffReady', 'Verified diff available') + ': ' +
        operationCount + ' ' + t('install.report.operationCount', 'operation(s)') + ' / ' +
        uniqueFileCount + ' ' + t('install.report.fileCount', 'file(s)'));
    }
    lines.push('');
    lines.push(t('install.report.results', 'Results'));
    const grouped = groupResults(results);
    ['applied', 'already_applied', 'would_apply', 'advanced_review', 'manual_review', 'failed'].forEach((status) => {
      const rows = grouped.get(status) || [];
      lines.push('- ' + statusLabel(status, t) + ': ' + rows.length);
      rows.slice(0, 12).forEach((row) => {
        const value = isObject(row) ? row : {};
        lines.push('  - ' + [value.id || value.type || 'operation', value.path || ''].filter(Boolean).join(' · '));
      });
    });
    const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics : [];
    if (diagnostics.length) {
      lines.push('');
      lines.push(t('install.report.diagnostics', 'Diagnostics'));
      diagnostics.slice(0, 12).forEach((diag) => {
        const value = isObject(diag) ? diag : {};
        lines.push('- ' + (value.severity || 'info') + ' · ' + (value.code || 'diagnostic') + ': ' + (value.message || ''));
      });
    }
    if (changedFiles.length) {
      lines.push('');
      lines.push(t('install.report.changedFiles', 'Changed files'));
      changedFiles.slice(0, 20).forEach((file) => {
        const value = isObject(file) ? file : {};
        const count = Number(value.operationCount || 1);
        lines.push('- ' + [value.path, value.status, value.match, count > 1 ? count + ' ' + t('install.report.operationCount', 'operation(s)') : ''].filter(Boolean).join(' · '));
      });
    }
    if (result.postApplyVerification) {
      lines.push('');
      lines.push(t('install.report.postApplyVerification', 'Post-apply verification'));
      lines.push(postApplyVerificationLabel(result.postApplyVerification, t));
    }
    const rollback = rollbackNotes(results, opts.plan, t);
    if (rollback.length) {
      lines.push('');
      lines.push(t('install.report.rollback', 'Rollback notes'));
      rollback.forEach((note) => lines.push('- ' + note));
    }
    if (!results.length && !diagnostics.length && result.message) {
      lines.push('');
      lines.push(t('install.report.noOperations', 'No install operations were run.'));
    }
    return lines.join('\n');
  }

  /**
   * @param {unknown} verification
   * @param {(key: string, fallback: string) => string} t
   * @returns {string}
   */
  function postApplyVerificationLabel(verification, t) {
    if (!verification || !isObject(verification)) {
      return t('install.report.postApplySkipped', 'Not run');
    }
    if (verification.ok === false || resultHasFailures(verification)) {
      return t('install.report.postApplyAttention', 'Needs attention');
    }
    const rows = Array.isArray(verification.results) ? verification.results : [];
    if (rows.some((row) => row && row.status === 'would_apply')) {
      return t('install.report.postApplyAttention', 'Needs attention');
    }
    return t('install.report.postApplyVerified', 'Applied changes verified');
  }

  /**
   * @param {unknown[]} results
   * @returns {Map<string, unknown[]>}
   */
  function groupResults(results) {
    const map = new Map();
    results.forEach((result) => {
      const value = isObject(result) ? result : {};
      const status = value.status ? String(value.status) : 'unknown';
      if (!map.has(status)) {
        map.set(status, []);
      }
      map.get(status).push(value);
    });
    return map;
  }

  /**
   * @param {string} status
   * @param {(key: string, fallback: string) => string} t
   * @returns {string}
   */
  function statusLabel(status, t) {
    return {
      applied: t('install.report.appliedHuman', 'Applied'),
      already_applied: t('install.report.alreadyAppliedHuman', 'Already applied'),
      would_apply: t('install.report.wouldApplyHuman', 'Check passed, not applied yet'),
      advanced_review: t('install.report.advancedReviewHuman', 'Waiting for advanced opt-in'),
      manual_review: t('install.report.manualReviewHuman', 'Manual step'),
      failed: t('install.report.failedHuman', 'Needs attention')
    }[status] || status;
  }

  /**
   * @param {unknown[]} results
   * @param {InstallPlan|unknown=} plan
   * @param {((key: string, fallback: string) => string)=} t
   * @returns {string[]}
   */
  function rollbackNotes(results, plan, t) {
    const translate = translator(t);
    const operations = new Map();
    if (isObject(plan) && Array.isArray(plan.operations)) {
      plan.operations.forEach((operation) => {
        if (operation && operation.id) {
          operations.set(operation.id, operation);
        }
      });
    }
    return results
      .filter((result) => {
        const value = isObject(result) ? result : {};
        return value.status === 'applied' || value.status === 'would_apply';
      })
      .map((result) => {
        const value = isObject(result) ? result : {};
        const operation = isObject(operations.get(value.id)) ? operations.get(value.id) : {};
        if (operation.type === 'create_file') {
          return (value.status === 'would_apply' ? translate('install.report.wouldDelete', 'Would undo by deleting') : translate('install.report.delete', 'Undo by deleting')) +
            ' ' + (operation.path || value.path || '');
        }
        if (operation.type === 'replace_text') {
          if ((operation.deleteMode === 'line' || operation.deletesSourceLine) && !operation.replace) {
            return (value.status === 'would_apply' ? translate('install.report.wouldRestoreDeletedLine', 'Would undo by restoring deleted line in') : translate('install.report.restoreDeletedLine', 'Undo by restoring deleted line in')) +
              ' ' + (operation.path || value.path || '') + ': "' + shorten(operation.search || '') + '"';
          }
          return (value.status === 'would_apply' ? translate('install.report.wouldRestore', 'Would undo by restoring original text in') : translate('install.report.restore', 'Undo by restoring original text in')) +
            ' ' + (operation.path || value.path || '') + ': "' + shorten(operation.replace || '') + '" -> "' + shorten(operation.search || '') + '"';
        }
        return '';
      })
      .filter(Boolean);
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
   * @returns {string}
   */
  function shorten(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > 80 ? text.slice(0, 77) + '...' : text;
  }

  /**
   * @param {((key: string, fallback: string) => string)|undefined} t
   * @returns {(key: string, fallback: string) => string}
   */
  function translator(t) {
    return typeof t === 'function' ? t : (_key, fallback) => fallback;
  }

  /**
   * @param {unknown} value
   * @returns {value is Record<string, any>}
   */
  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {
    buildInstallResultReport,
    postApplyVerificationLabel,
    rollbackNotes,
    groupResults,
    resultHasFailures
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapInstallResultReportModel = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
