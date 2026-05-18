// @ts-check
(function initProjectMapInstallOperationContracts(global) {
  'use strict';

  /**
   * @typedef {import('../types/project_map_contracts').InstallApplyResult} InstallApplyResult
   * @typedef {import('../types/project_map_contracts').InstallChangedFile} InstallChangedFile
   * @typedef {import('../types/project_map_contracts').InstallOperationClassification} InstallOperationClassification
   * @typedef {import('../types/project_map_contracts').InstallOperationSummary} InstallOperationSummary
   * @typedef {import('../types/project_map_contracts').InstallPlanOperation} InstallPlanOperation
   * @typedef {import('../types/project_map_contracts').InstallPreflightResult} InstallPreflightResult
   * @typedef {import('../types/project_map_contracts').InstallSafety} InstallSafety
   * @typedef {import('../types/project_map_contracts').InstallOperationType} InstallOperationType
   * @typedef {import('../types/project_map_contracts').SourceEvidence} SourceEvidence
   * @typedef {import('../types/project_map_contracts').TextOperationEvidence} TextOperationEvidence
   * @typedef {import('../types/project_map_contracts').AssetOperationEvidence} AssetOperationEvidence
   */

  const INSTALL_OPERATION_CONTRACTS_VERSION = '0.1';
  const APPLY_STATUSES = new Set(['safe_apply', 'guarded_apply', 'advanced_apply']);
  const INSTALL_LEVELS = Object.freeze({
    safe_apply: 1,
    guarded_apply: 2,
    advanced_apply: 3,
    manual_review: 4,
    refused: 5
  });
  const KNOWN_OPERATION_TYPES = new Set([
    'create_file',
    'replace_text',
    'insert_text',
    'replace_section',
    'copy_asset_file',
    'manual_snippet'
  ]);

  /**
   * @param {unknown} operation
   * @param {number=} index
   * @returns {InstallPlanOperation}
   */
  function normalizeInstallOperation(operation, index) {
    const value = isObject(operation) ? clone(operation) : {};
    value.id = String(value.id || 'op_' + ((Number(index) || 0) + 1)).trim();
    value.type = normalizeOperationType(value.type);
    value.path = String(value.path || '').trim();
    value.description = String(value.description || '').trim();
    value.safety = normalizeSafety(value.safety);
    value.content = stringField(value.content);
    value.search = stringField(value.search);
    value.replace = stringField(value.replace);
    value.anchorText = stringField(value.anchorText);
    value.endAnchorText = stringField(value.endAnchorText);
    value.rawAnchorText = stringField(value.rawAnchorText);
    value.rawEndAnchorText = stringField(value.rawEndAnchorText);
    value.expectedRangeHash = stringField(value.expectedRangeHash);
    value.deleteMode = String(value.deleteMode || '').trim() === 'line' ? 'line' : '';
    value.position = String(value.position || 'after').trim() === 'before' ? 'before' : 'after';
    value.dedupeSearch = stringField(value.dedupeSearch);
    value.sourceName = stringField(value.sourceName);
    value.sourcePath = stringField(value.sourcePath);
    value.assetType = stringField(value.assetType);
    value.label = stringField(value.label);
    value.role = stringField(value.role);
    value.allowEmptyReplace = Boolean(value.allowEmptyReplace);
    value.deletesSourceLine = Boolean(value.deletesSourceLine);
    value.line = positiveLineOrNull(value.line);
    value.startLine = numberOrNull(value.startLine);
    value.endLine = numberOrNull(value.endLine);
    return /** @type {InstallPlanOperation} */ (value);
  }

  /**
   * @param {unknown} value
   * @returns {InstallOperationType}
   */
  function normalizeOperationType(value) {
    const text = String(value || 'manual_snippet').trim();
    return /** @type {InstallOperationType} */ (text || 'manual_snippet');
  }

  /**
   * @param {unknown} value
   * @returns {InstallSafety}
   */
  function normalizeSafety(value) {
    const text = String(value || 'manual_review').trim();
    if (APPLY_STATUSES.has(text) || text === 'manual_review' || text === 'refused') {
      return /** @type {InstallSafety} */ (text);
    }
    return 'manual_review';
  }

  /**
   * @param {unknown} source
   * @param {Partial<SourceEvidence>=} fallback
   * @returns {SourceEvidence}
   */
  function normalizeSourceEvidence(source, fallback) {
    const value = isObject(source) ? source : {};
    const base = isObject(fallback) ? fallback : {};
    const line = positiveLineOrNull(value.line !== undefined ? value.line : value.startLine);
    const startLine = positiveLineOrNull(value.startLine !== undefined ? value.startLine : line || base.startLine || base.line);
    const endLine = positiveLineOrNull(value.endLine !== undefined ? value.endLine : value.line || value.startLine || base.endLine || startLine);
    return {
      path: String(value.path || value.sourcePath || base.path || '').trim().replace(/\\/g, '/'),
      line,
      startLine,
      endLine,
      anchorText: stringField(value.anchorText !== undefined ? value.anchorText : base.anchorText),
      endAnchorText: stringField(value.endAnchorText !== undefined ? value.endAnchorText : base.endAnchorText),
      rawAnchorText: stringField(value.rawAnchorText !== undefined ? value.rawAnchorText : base.rawAnchorText),
      rawEndAnchorText: stringField(value.rawEndAnchorText !== undefined ? value.rawEndAnchorText : base.rawEndAnchorText),
      expectedRangeHash: stringField(value.expectedRangeHash !== undefined ? value.expectedRangeHash : base.expectedRangeHash),
      deletesSourceLine: Boolean(value.deletesSourceLine !== undefined ? value.deletesSourceLine : base.deletesSourceLine),
      deleteMode: String(value.deleteMode || base.deleteMode || '').trim() === 'line' ? 'line' : ''
    };
  }

  /**
   * @param {unknown} operation
   * @returns {{path: string, type: InstallOperationType, safety: InstallSafety, source: SourceEvidence}}
   */
  function normalizeInstallTarget(operation) {
    const op = normalizeInstallOperation(operation, 0);
    return {
      path: op.path,
      type: op.type,
      safety: op.safety,
      source: normalizeSourceEvidence(op, {path: op.path})
    };
  }

  /**
   * @param {unknown[]|{operations?: unknown[]}|unknown} planOrOperations
   * @param {(operation: unknown) => InstallOperationClassification=} classify
   * @returns {InstallOperationSummary}
   */
  function summarizeInstallOperations(planOrOperations, classify) {
    const operations = Array.isArray(planOrOperations)
      ? planOrOperations
      : ensureArray(isObject(planOrOperations) ? planOrOperations.operations : []);
    const summary = emptyOperationSummary();
    operations.forEach((operation) => {
      summary.total += 1;
      const classification = typeof classify === 'function'
        ? classify(operation)
        : classifyBySafety(operation);
      incrementSummary(summary, classification.status);
    });
    return summary;
  }

  /**
   * @returns {InstallOperationSummary}
   */
  function emptyOperationSummary() {
    return {safeApply: 0, guardedApply: 0, advancedApply: 0, manualReview: 0, refused: 0, total: 0};
  }

  /**
   * @param {{operations?: unknown[]}|unknown} plan
   * @returns {string}
   */
  function renderPatchPreview(plan) {
    const operations = ensureArray(isObject(plan) ? plan.operations : []);
    return operations.map(renderOperationPreview).join('\n');
  }

  /**
   * @param {unknown} operation
   * @returns {string}
   */
  function renderOperationPreview(operation) {
    const op = isObject(operation) ? operation : {};
    const pathLabel = String(op.path || '(unknown-path)');
    if (op.type === 'create_file') {
      return [
        'diff --git a/' + pathLabel + ' b/' + pathLabel,
        'new file mode 100644',
        '--- /dev/null',
        '+++ b/' + pathLabel,
        '@@',
        prefixLines('+', op.content || '')
      ].join('\n') + '\n';
    }
    if (op.type === 'replace_text') {
      const lineLabel = op.line ? ' line ' + op.line : '';
      return [
        'diff --git a/' + pathLabel + ' b/' + pathLabel,
        '--- a/' + pathLabel,
        '+++ b/' + pathLabel,
        '@@' + lineLabel,
        '-' + (op.search || ''),
        '+' + (op.replace || '')
      ].join('\n') + '\n';
    }
    if (op.type === 'insert_text') {
      return [
        'diff --git a/' + pathLabel + ' b/' + pathLabel,
        '--- a/' + pathLabel,
        '+++ b/' + pathLabel,
        '@@ insert ' + (op.position || 'after') + ' anchor',
        ' ' + (op.anchorText || '(missing anchor)'),
        prefixLines('+', op.content || '')
      ].join('\n') + '\n';
    }
    if (op.type === 'replace_section') {
      return [
        'diff --git a/' + pathLabel + ' b/' + pathLabel,
        '--- a/' + pathLabel,
        '+++ b/' + pathLabel,
        '@@ replace section',
        ' ' + (op.anchorText || '(missing start anchor)'),
        ' ' + (op.endAnchorText || '(missing end anchor)'),
        prefixLines('+', op.content || '')
      ].join('\n') + '\n';
    }
    if (op.type === 'copy_asset_file') {
      return [
        'diff --git a/' + pathLabel + ' b/' + pathLabel,
        'new asset file proposal',
        '--- /dev/null',
        '+++ b/' + pathLabel,
        '@@ asset file install proposal',
        '+# source: ' + (op.sourceName || op.sourcePath || '(select a local file)'),
        '+# target: ' + pathLabel,
        '+# ' + (op.description || 'Copy this asset file by hand.')
      ].join('\n') + '\n';
    }
    return [
      'diff --git a/' + pathLabel + ' b/' + pathLabel,
      '--- a/' + pathLabel,
      '+++ b/' + pathLabel,
      '@@ manual review required',
      '+# ' + (op.description || 'Manual operation'),
      prefixLines('+', op.content || '')
    ].join('\n') + '\n';
  }

  /**
   * @param {string} prefix
   * @param {unknown} text
   * @returns {string}
   */
  function prefixLines(prefix, text) {
    const lines = String(text || '').replace(/\n$/, '').split('\n');
    if (lines.length === 1 && lines[0] === '') {
      return prefix;
    }
    return lines.map((line) => prefix + line).join('\n');
  }

  /**
   * @param {InstallPreflightResult[]} results
   * @returns {InstallPreflightResult[]}
   */
  function markCommittedResults(results) {
    return ensureArray(results).map((result) => {
      if (!result || result.status !== 'would_apply') {
        return result;
      }
      const next = Object.assign({}, result, {status: 'applied'});
      if (isObject(result.evidence)) {
        next.evidence = Object.assign({}, result.evidence, {
          status: 'applied',
          message: evidenceMessage('applied')
        });
      }
      return next;
    });
  }

  /**
   * @param {InstallApplyResult|Record<string, any>} result
   * @param {boolean=} includeEvidence
   * @returns {InstallApplyResult}
   */
  function finalizeApplyResult(result, includeEvidence) {
    const normalized = normalizeApplyResult(result);
    if (!includeEvidence) {
      return normalized;
    }
    const rows = ensureArray(normalized.results);
    const verifiedDiff = rows
      .map((row) => row && row.evidence && row.evidence.diff ? String(row.evidence.diff) : '')
      .filter(Boolean)
      .join('\n');
    const changedFiles = uniqueChangedFiles(rows.map((row) => changedFileForResult(row, normalized.dryRun)).filter(Boolean));
    return Object.assign({}, normalized, {
      verifiedDiff,
      changedFiles,
      operationCount: rows.filter((row) => row && row.path).length,
      uniqueFileCount: changedFiles.length
    });
  }

  /**
   * @param {unknown} result
   * @returns {InstallApplyResult}
   */
  function normalizeApplyResult(result) {
    const value = isObject(result) ? result : {};
    return /** @type {InstallApplyResult} */ (Object.assign({}, value, {
      ok: value.ok === true,
      dryRun: value.dryRun !== false,
      allowAdvanced: value.allowAdvanced === true,
      operationSummary: value.operationSummary || emptyOperationSummary(),
      results: ensureArray(value.results).map(normalizePreflightResult),
      diagnostics: ensureArray(value.diagnostics)
    }));
  }

  /**
   * @param {unknown} result
   * @returns {InstallPreflightResult}
   */
  function normalizePreflightResult(result) {
    const value = isObject(result) ? result : {};
    return /** @type {InstallPreflightResult} */ (Object.assign({}, value, {
      id: String(value.id || ''),
      type: String(value.type || ''),
      path: String(value.path || ''),
      status: String(value.status || '')
    }));
  }

  /**
   * @param {unknown} evidence
   * @returns {Record<string, unknown>}
   */
  function normalizeOperationEvidence(evidence) {
    const value = isObject(evidence) ? evidence : {};
    const normalized = {
      operationId: String(value.operationId || ''),
      type: String(value.type || ''),
      path: String(value.path || ''),
      status: String(value.status || ''),
      match: String(value.match || ''),
      message: String(value.message || ''),
      line: numberOrNull(value.line),
      startLine: numberOrNull(value.startLine),
      endLine: numberOrNull(value.endLine),
      beforeSnippet: truncateEvidence(value.beforeSnippet),
      afterSnippet: truncateEvidence(value.afterSnippet),
      beforeHash: String(value.beforeHash || ''),
      afterHash: String(value.afterHash || ''),
      sourceHash: String(value.sourceHash || ''),
      targetHash: String(value.targetHash || ''),
      diff: String(value.diff || '')
    };
    Object.keys(normalized).forEach((key) => {
      if (normalized[key] === '' || normalized[key] === null) {
        delete normalized[key];
      }
    });
    return normalized;
  }

  /**
   * @param {unknown} result
   * @param {boolean=} includeEvidence
   * @param {unknown=} operation
   * @param {unknown=} evidence
   * @returns {InstallPreflightResult}
   */
  function withOperationEvidence(result, includeEvidence, operation, evidence) {
    const row = normalizePreflightResult(result);
    if (!includeEvidence) {
      return row;
    }
    const op = isObject(operation) ? operation : {};
    return Object.assign({}, row, {
      evidence: normalizeOperationEvidence(Object.assign({
        operationId: op.id || '',
        type: op.type || '',
        path: op.path || ''
      }, isObject(evidence) ? evidence : {}))
    });
  }

  /**
   * @param {InstallPlanOperation|Record<string, any>} operation
   * @param {string} status
   * @param {unknown=} _beforeText
   * @param {unknown=} _afterText
   * @param {unknown=} details
   * @returns {TextOperationEvidence}
   */
  function textOperationEvidence(operation, status, _beforeText, _afterText, details) {
    const op = isObject(operation) ? operation : {};
    const info = isObject(details) ? details : {};
    return {
      status,
      match: String(info.match || status),
      message: String(info.message || evidenceMessage(status)),
      line: info.line || op.line || null,
      startLine: info.startLine || op.startLine || null,
      endLine: info.endLine || op.endLine || null,
      beforeSnippet: info.beforeSnippet !== undefined ? String(info.beforeSnippet) : '',
      afterSnippet: info.afterSnippet !== undefined ? String(info.afterSnippet) : '',
      beforeHash: String(info.beforeHash || ''),
      afterHash: String(info.afterHash || ''),
      diff: String(info.diff || '')
    };
  }

  /**
   * @param {InstallPlanOperation|Record<string, any>} operation
   * @param {string} status
   * @param {string} message
   * @returns {TextOperationEvidence}
   */
  function manualOperationEvidence(operation, status, message) {
    const op = isObject(operation) ? operation : {};
    return {
      status,
      match: status,
      message,
      beforeSnippet: String(op.search || op.anchorText || ''),
      afterSnippet: String(op.replace || op.content || '')
    };
  }

  /**
   * @param {InstallPlanOperation|Record<string, any>} operation
   * @param {string} match
   * @param {string} message
   * @returns {TextOperationEvidence}
   */
  function failedOperationEvidence(operation, match, message) {
    const op = isObject(operation) ? operation : {};
    return {
      status: 'failed',
      match,
      message,
      beforeSnippet: String(op.search || op.anchorText || ''),
      afterSnippet: String(op.replace || op.content || '')
    };
  }

  /**
   * @param {InstallPlanOperation|Record<string, any>} operation
   * @param {string} status
   * @param {unknown=} details
   * @returns {AssetOperationEvidence}
   */
  function assetOperationEvidence(operation, status, details) {
    const op = isObject(operation) ? operation : {};
    const info = isObject(details) ? details : {};
    return {
      status,
      match: String(info.match || status),
      message: String(info.message || evidenceMessage(status)),
      sourceHash: String(info.sourceHash || ''),
      targetHash: String(info.targetHash || ''),
      beforeSnippet: String(op.sourceName || ''),
      afterSnippet: String(op.path || ''),
      diff: String(info.diff || '')
    };
  }

  /**
   * @param {Array<InstallChangedFile|null|undefined|false>} files
   * @returns {InstallChangedFile[]}
   */
  function uniqueChangedFiles(files) {
    const byPath = new Map();
    ensureArray(files).forEach((file) => {
      if (!file || !file.path) {
        return;
      }
      if (!byPath.has(file.path)) {
        byPath.set(file.path, Object.assign({operationCount: 1}, file));
        return;
      }
      const existing = byPath.get(file.path);
      existing.operationCount = Number(existing.operationCount || 1) + 1;
      if (existing.status !== file.status) {
        existing.status = [existing.status, file.status].filter(Boolean).join(',');
      }
      if (!existing.match && file.match) {
        existing.match = file.match;
      }
    });
    return Array.from(byPath.values());
  }

  /**
   * @param {unknown} result
   * @param {boolean=} dryRun
   * @returns {InstallChangedFile|null}
   */
  function changedFileForResult(result, dryRun) {
    const row = isObject(result) ? result : {};
    if (!row.path) {
      return null;
    }
    const status = String(row.status || '');
    if (status === 'would_apply' && !dryRun) {
      return null;
    }
    if (!/^(?:applied|would_apply|already_applied)$/.test(status)) {
      return null;
    }
    const evidence = isObject(row.evidence) ? row.evidence : {};
    return {
      operationId: String(row.id || ''),
      type: String(row.type || ''),
      path: String(row.path || ''),
      status,
      evidenceStatus: String(evidence.status || ''),
      match: String(evidence.match || ''),
      line: positiveLineOrNull(evidence.line),
      startLine: positiveLineOrNull(evidence.startLine),
      endLine: positiveLineOrNull(evidence.endLine),
      operationCount: 1
    };
  }

  /**
   * @param {unknown} operation
   * @returns {InstallOperationClassification}
   */
  function classifyBySafety(operation) {
    const op = normalizeInstallOperation(operation, 0);
    return {
      status: op.safety,
      label: op.safety,
      level: INSTALL_LEVELS[op.safety] || INSTALL_LEVELS.manual_review,
      reason: op.description || '',
      operation: op
    };
  }

  /**
   * @param {InstallOperationSummary|unknown} summary
   * @param {boolean=} checked
   * @param {boolean=} allowAdvanced
   * @returns {import('../types/project_map_contracts').ReviewApplyReadiness}
   */
  function classifyReviewApplyReadiness(summary, checked, allowAdvanced) {
    const value = isObject(summary) ? summary : {};
    const manual = Number(value.manualReview || 0);
    const refused = Number(value.refused || 0);
    const advanced = Number(value.advancedApply || 0);
    const guarded = Number(value.guardedApply || 0);
    const safe = Number(value.safeApply || 0);
    const automatic = safe + guarded + advanced;
    const advancedAllowed = allowAdvanced === true;
    const eligibleAutomatic = safe + guarded + (advancedAllowed ? advanced : 0);
    const checkPassed = checked === true;
    const canApply = eligibleAutomatic > 0 && checkPassed;
    return {
      canApply,
      checked: checkPassed,
      needsCheck: eligibleAutomatic > 0 && !checkPassed,
      needsAdvancedConsent: advanced > 0 && !advancedAllowed,
      manualReviewCount: manual,
      refusedCount: refused,
      automaticOperationCount: automatic,
      eligibleAutomaticOperationCount: eligibleAutomatic,
      skippedAdvancedOperationCount: advancedAllowed ? 0 : advanced
    };
  }

  function incrementSummary(summary, status) {
    if (status === 'safe_apply') {
      summary.safeApply += 1;
    } else if (status === 'guarded_apply') {
      summary.guardedApply += 1;
    } else if (status === 'advanced_apply') {
      summary.advancedApply += 1;
    } else if (status === 'manual_review') {
      summary.manualReview += 1;
    } else {
      summary.refused += 1;
    }
  }

  function evidenceMessage(status) {
    if (status === 'would_apply') {
      return 'Dry-run verified this operation against the current file.';
    }
    if (status === 'applied') {
      return 'Applied this operation after verifying the current file.';
    }
    if (status === 'already_applied') {
      return 'The current file already contains this proposed result.';
    }
    if (status === 'manual_review') {
      return 'This operation remains manual review only.';
    }
    if (status === 'advanced_review') {
      return 'This operation needs advanced opt-in before apply.';
    }
    if (status === 'failed') {
      return 'This operation could not be verified against the current file.';
    }
    return String(status || '');
  }

  function truncateEvidence(value) {
    const text = String(value || '');
    if (text.length <= 4000) {
      return text;
    }
    return text.slice(0, 3980).trimEnd() + '\n...';
  }

  function positiveLineOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? Math.floor(number) : null;
  }

  function stringField(value) {
    return value === undefined || value === null ? '' : String(value);
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /**
   * @param {unknown} value
   * @returns {value is Record<string, any>}
   */
  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  const api = {
    INSTALL_OPERATION_CONTRACTS_VERSION,
    APPLY_STATUSES,
    INSTALL_LEVELS,
    normalizeInstallOperation,
    normalizeOperationType,
    normalizeSafety,
    normalizeSourceEvidence,
    normalizeInstallTarget,
    summarizeInstallOperations,
    emptyOperationSummary,
    renderPatchPreview,
    renderOperationPreview,
    prefixLines,
    markCommittedResults,
    finalizeApplyResult,
    normalizeApplyResult,
    normalizePreflightResult,
    normalizeOperationEvidence,
    withOperationEvidence,
    textOperationEvidence,
    manualOperationEvidence,
    failedOperationEvidence,
    assetOperationEvidence,
    evidenceMessage,
    uniqueChangedFiles,
    changedFileForResult,
    classifyReviewApplyReadiness
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapInstallOperationContracts = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
