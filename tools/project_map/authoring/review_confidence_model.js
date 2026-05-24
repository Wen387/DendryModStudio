// @ts-check
(function initProjectMapReviewConfidenceModel(global) {
  'use strict';

  const api = {
    buildOperationConfidence,
    buildDryRunRecap,
    buildRuntimeRecommendation
  };

  function buildOperationConfidence(operation, classification, options) {
    const opts = options || {};
    const t = translator(opts.translate);
    const op = operation && typeof operation === 'object' ? operation : {};
    const item = classification && typeof classification === 'object' ? classification : {};
    const status = String(item.status || op.safety || 'manual_review');
    const reason = String(opts.reason || item.reason || op.description || '').trim();
    const source = sourceLabel(op, t);
    const rows = [
      evidenceRow('change', t('reviewConfidence.field.change', 'Change'), changeSummary(op, t)),
      evidenceRow('source', t('reviewConfidence.field.source', 'Source'), source),
      evidenceRow('safety', t('reviewConfidence.field.safety', 'Safety'), safetyLabel(status, t)),
      evidenceRow('boundary', t('reviewConfidence.field.boundary', 'Boundary'), boundarySummary(status, reason, t)),
      evidenceRow('provenance', t('reviewConfidence.field.provenance', 'Provenance'), provenanceSummary(op, opts, t))
    ].filter((row) => row.value);
    return {
      kind: 'review_confidence',
      operationId: String(op.id || ''),
      status,
      source,
      reason,
      rows,
      runtimeRecommendation: buildRuntimeRecommendation(op, item, opts)
    };
  }

  function buildDryRunRecap(result, options) {
    const value = result && typeof result === 'object' ? result : null;
    if (!value) {
      return null;
    }
    const t = translator(options && options.translate);
    const rows = ensureArray(value.results);
    const counts = rows.reduce((acc, row) => {
      const status = String(row && row.status || 'unknown');
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    const diagnostics = ensureArray(value.diagnostics).filter((diag) => diag && diag.severity !== 'info');
    const changedFiles = ensureArray(value.changedFiles).length || unique(rows.map((row) => row && row.path).filter(Boolean)).length;
    const ok = value.ok !== false && !counts.failed && !diagnostics.some((diag) => diag && diag.severity === 'error');
    const label = value.dryRun
      ? ok
        ? t('reviewConfidence.dryRun.ok', 'Dry-run check passed')
        : t('reviewConfidence.dryRun.attention', 'Dry-run needs attention')
      : ok
        ? t('reviewConfidence.apply.ok', 'Apply result verified')
        : t('reviewConfidence.apply.attention', 'Apply result needs attention');
    return {
      kind: 'review_confidence_dry_run',
      ok,
      dryRun: Boolean(value.dryRun),
      label,
      message: String(value.message || ''),
      counts,
      changedFiles,
      diagnostics: diagnostics.map((diag) => String(diag.message || diag.code || '')).filter(Boolean),
      rows: [
        evidenceRow('would_apply', t('reviewConfidence.dryRun.wouldApply', 'Would apply'), String(counts.would_apply || 0)),
        evidenceRow('applied', t('reviewConfidence.dryRun.applied', 'Applied'), String((counts.applied || 0) + (counts.already_applied || 0))),
        evidenceRow('manual', t('reviewConfidence.dryRun.manual', 'Manual'), String((counts.manual_review || 0) + (counts.advanced_review || 0))),
        evidenceRow('failed', t('reviewConfidence.dryRun.failed', 'Needs attention'), String(counts.failed || 0)),
        evidenceRow('files', t('reviewConfidence.dryRun.files', 'Files'), String(changedFiles))
      ]
    };
  }

  function buildRuntimeRecommendation(operation, classification, options) {
    const opts = options || {};
    const t = translator(opts.translate);
    const op = operation && typeof operation === 'object' ? operation : {};
    const item = classification && typeof classification === 'object' ? classification : {};
    const status = String(item.status || op.safety || 'manual_review');
    const readiness = opts.runtimeReadiness || {};
    const missing = runtimeMissingDependencies(readiness);
    const sourceBacked = Boolean(op.path && (op.line || op.startLine || /source\/scenes\//.test(String(op.path))));
    if (status === 'refused') {
      return {
        kind: 'blocked',
        label: t('reviewConfidence.runtime.blocked', 'Runtime check blocked'),
        message: t('reviewConfidence.runtime.blockedMessage', 'Resolve the protected operation before using runtime evidence.'),
        action: 'manual_review'
      };
    }
    if (status === 'manual_review') {
      return {
        kind: 'manual_review',
        label: t('reviewConfidence.runtime.manual', 'Manual review first'),
        message: t('reviewConfidence.runtime.manualMessage', 'Complete the manual step, then use Runtime Preview to inspect the playable result.'),
        action: 'manual_review'
      };
    }
    const type = String(op.type || '');
    const focusable = sourceBacked && /^(replace_text|replace_section|insert_text|create_file|copy_asset_file)$/.test(type);
    const message = focusable
      ? t('reviewConfidence.runtime.lensMessage', 'After a successful dry-run, use Runtime Preview for the whole plan and Quick Lens for the changed object when generated runtime is ready.')
      : t('reviewConfidence.runtime.previewMessage', 'After a successful dry-run, use Runtime Preview to compare the temporary original and modified builds.');
    const fallback = missing.length
      ? t('reviewConfidence.runtime.fullBuildFallback', 'Quick Lens may use a temporary full build because generated runtime files are incomplete: {files}').replace('{files}', missing.join(', '))
      : '';
    return {
      kind: focusable ? 'runtime_preview_and_lens' : 'runtime_preview',
      label: focusable
        ? t('reviewConfidence.runtime.previewAndLens', 'Runtime Preview + Quick Lens')
        : t('reviewConfidence.runtime.preview', 'Runtime Preview'),
      message,
      fallback,
      action: focusable ? 'runtime_preview_then_quick_lens' : 'runtime_preview',
      sourceBacked,
      missingRuntimeDependencies: missing
    };
  }

  function evidenceRow(key, label, value) {
    return {
      key,
      label: String(label || ''),
      value: String(value || '').trim()
    };
  }

  function changeSummary(operation, t) {
    const type = String(operation && operation.type || '');
    if (type === 'create_file') {
      return t('reviewConfidence.change.createFile', 'Create source file');
    }
    if (type === 'replace_text') {
      return t('reviewConfidence.change.replaceText', 'Replace text') + shortInline(operation.search || operation.before || '');
    }
    if (type === 'replace_section') {
      return t('reviewConfidence.change.replaceSection', 'Replace source section');
    }
    if (type === 'insert_text') {
      return t('reviewConfidence.change.insertText', 'Insert source text');
    }
    if (type === 'copy_asset_file') {
      return t('reviewConfidence.change.copyAsset', 'Copy asset file');
    }
    if (type === 'manual_snippet') {
      return t('reviewConfidence.change.manualSnippet', 'Manual snippet');
    }
    return t('reviewConfidence.change.operation', 'Review operation');
  }

  function shortInline(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) {
      return '';
    }
    return ': ' + (text.length > 64 ? text.slice(0, 61).trimEnd() + '...' : text);
  }

  function sourceLabel(operation, t) {
    const path = String(operation && operation.path || '').trim();
    if (!path) {
      return t('reviewConfidence.source.unknown', 'Unknown source');
    }
    const start = operation.startLine || operation.line || '';
    const end = operation.endLine && operation.endLine !== start ? operation.endLine : '';
    return path + (start ? ':' + start + (end ? '-' + end : '') : '');
  }

  function safetyLabel(status, t) {
    return {
      safe_apply: t('reviewConfidence.safety.safe', 'Safe apply'),
      guarded_apply: t('reviewConfidence.safety.guarded', 'Guarded apply'),
      advanced_apply: t('reviewConfidence.safety.advanced', 'Advanced opt-in'),
      manual_review: t('reviewConfidence.safety.manual', 'Manual review'),
      refused: t('reviewConfidence.safety.refused', 'Protected')
    }[status] || status;
  }

  function boundarySummary(status, reason, t) {
    if (status === 'safe_apply') {
      return t('reviewConfidence.boundary.safe', 'Generated or isolated operation; dry-run still checks the plan.');
    }
    if (status === 'guarded_apply') {
      return t('reviewConfidence.boundary.guarded', 'Requires the original source anchor to match during dry-run/apply.');
    }
    if (status === 'advanced_apply') {
      return t('reviewConfidence.boundary.advanced', 'Requires explicit advanced opt-in before apply.');
    }
    if (status === 'manual_review') {
      return reason || t('reviewConfidence.boundary.manual', 'Manual step; Studio will not apply it automatically.');
    }
    if (status === 'refused') {
      return reason || t('reviewConfidence.boundary.refused', 'Protected operation; Studio will not apply it.');
    }
    return reason;
  }

  function provenanceSummary(operation, options, t) {
    const values = [
      operation && operation.provenance,
      operation && operation.sourceEntry,
      options && options.planTitle,
      operation && operation.id
    ].map((value) => String(value || '').trim()).filter(Boolean);
    return values.length ? unique(values).join(' / ') : t('reviewConfidence.provenance.plan', 'Install plan operation');
  }

  function runtimeMissingDependencies(readiness) {
    const value = readiness && typeof readiness === 'object' ? readiness : {};
    const missing = []
      .concat(ensureArray(value.missingRuntimeDependencies))
      .concat(ensureArray(value.missingScripts))
      .concat(ensureArray(value.missingFiles))
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    if (missing.length) {
      return unique(missing);
    }
    if (value.generatedRuntimeComplete === false || value.quickRuntimeComplete === false || value.status === 'incomplete') {
      return [String(value.reason || 'generated runtime dependencies').trim()];
    }
    return [];
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function unique(values) {
    const seen = new Set();
    return values.filter((value) => {
      const key = String(value || '');
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function translator(fn) {
    return typeof fn === 'function' ? fn : (_key, fallback) => fallback;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapReviewConfidenceModel = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
