(function initProjectMapInstallReviewUi(global) {
  'use strict';

  function renderPlanReview(options) {
    const opts = options || {};
    const plan = opts.plan || null;
    const t = translator(opts.t);
    if (!plan) {
      return [
        '<div class="install-empty-help">',
        '<strong>' + escapeHtml(t('install.human.noPlanTitle', 'No change plan loaded')) + '</strong>',
        '<p>' + escapeHtml(t('install.human.noPlanBody', 'Send a draft from Create, or load an install-plan JSON to review changes here.')) + '</p>',
        '</div>'
      ].join('');
    }
    const operations = Array.isArray(plan.operations) ? plan.operations : [];
    const installApi = opts.installApi || null;
    const resultMap = resultById(opts.result);
    const readinessAttrs = renderReadinessAttrs(opts.readiness);
    const classified = operations.map((operation, index) => {
      const item = classify(installApi, operation);
      item.operation = item.operation || operation;
      item.index = index;
      item.result = resultMap.get(operation && operation.id || '') || null;
      return item;
    });
    const summary = opts.summary || {};
    const groups = [
      ['safe_apply', t('install.human.safeApply', 'Safe to apply'), t('install.human.safeHelp', 'Studio can create or replace this directly after a check.')],
      ['guarded_apply', t('install.human.guardedApply', 'Check then apply'), t('install.human.guardedHelp', 'Studio can apply this if the original text still matches.')],
      ['advanced_apply', t('install.human.advancedApply', 'Advanced opt-in'), t('install.human.advancedHelp', 'This touches a sensitive area and needs explicit advanced consent.')],
      ['manual_review', t('install.human.manualReview', 'Manual steps'), t('install.human.manualHelp', 'Studio will guide you, but it will not edit this automatically.')],
      ['refused', t('install.human.refused', 'Protected'), t('install.human.refusedHelp', 'Studio will not apply this operation. Rewrite it or handle it outside the app.')]
    ];
    return [
      '<div class="install-human-intro"' + readinessAttrs + '>',
      '<strong>' + escapeHtml(t('install.human.title', 'What this will change')) + '</strong>',
      '<span>' + escapeHtml((summary.total || operations.length || 0) + ' ' + t('install.human.changeCount', 'change(s) in this plan')) + '</span>',
      '</div>',
      renderDryRunRecap(opts.result, opts),
      groups.map(([status, title, help]) => renderGroup(status, title, help, classified.filter((item) => item.status === status), opts)).join('')
    ].join('');
  }

  function renderReadinessAttrs(readiness) {
    if (!readiness || typeof readiness !== 'object') {
      return '';
    }
    return ' data-review-apply-can-apply="' + escapeAttr(readiness.canApply ? 'true' : 'false') + '"' +
      ' data-review-apply-needs-check="' + escapeAttr(readiness.needsCheck ? 'true' : 'false') + '"' +
      ' data-review-apply-needs-advanced="' + escapeAttr(readiness.needsAdvancedConsent ? 'true' : 'false') + '"';
  }

  function classify(installApi, operation) {
    if (installApi && typeof installApi.classifyOperation === 'function') {
      return installApi.classifyOperation(operation) || {status: operation && operation.safety || 'manual_review', operation};
    }
    return {status: operation && operation.safety || 'manual_review', reason: operation && operation.description || '', operation};
  }

  function renderGroup(status, title, help, rows, opts) {
    const t = translator(opts.t);
    return [
      '<section class="install-human-group install-human-' + escapeAttr(status.replace(/_/g, '-')) + '">',
      '<header><strong>' + escapeHtml(title) + '</strong><span>' + rows.length + '</span></header>',
      '<p>' + escapeHtml(help) + '</p>',
      rows.length ? '<div class="install-human-ops">' + rows.map((item) => renderOperation(item, opts)).join('') + '</div>' : '<div class="install-human-none">' + escapeHtml(t('install.human.none', 'None')) + '</div>',
      '</section>'
    ].join('');
  }

  function renderOperation(item, opts) {
    const t = translator(opts.t);
    const operation = item.operation || {};
    const reason = operationReason(opts.installApi, item, operation, opts);
    const where = operationWhere(operation, t);
    const result = renderResultBadge(item.result, t);
    const confidence = buildOperationConfidence(operation, item, reason, opts);
    const preview = renderOperationPreview(operation, t);
    const evidence = renderEvidence(item.result, t);
    return [
      '<article class="install-human-op" data-install-operation-id="' + escapeAttr(operation.id || 'operation-' + item.index) + '">',
      '<div class="install-human-op-head">',
      '<strong>' + escapeHtml(actionLabel(operation, t)) + '</strong>',
      result,
      renderOperationContextLens(operation, item, reason, t),
      '</div>',
      where ? '<div class="install-human-where">' + escapeHtml(where) + '</div>' : '',
      reason ? '<p>' + escapeHtml(reason) + '</p>' : '',
      renderConfidenceEvidence(confidence, t),
      preview,
      evidence,
      renderRuntimeRecommendation(confidence && confidence.runtimeRecommendation, t),
      '<details>',
      '<summary>' + escapeHtml(t('install.human.advancedDetails', 'Advanced details')) + '</summary>',
      '<code>' + escapeHtml([operation.type || t('install.action.operation', 'operation'), operation.path || t('install.unknownPath', '(unknown path)')].join(' · ')) + '</code>',
      '</details>',
      '</article>'
    ].join('');
  }

  function renderDryRunRecap(result, opts) {
    const api = confidenceApi();
    if (!api || typeof api.buildDryRunRecap !== 'function') {
      return '';
    }
    const t = translator(opts.t);
    const recap = api.buildDryRunRecap(result, {translate: t});
    if (!recap) {
      return '';
    }
    const rows = Array.isArray(recap.rows) ? recap.rows.filter((row) => row && row.label) : [];
    return [
      '<section class="install-dry-run-recap" data-install-dry-run-recap="true" data-install-dry-run-ok="' + escapeAttr(recap.ok ? 'true' : 'false') + '">',
      '<header><strong>' + escapeHtml(recap.label) + '</strong><span>' + escapeHtml(recap.dryRun ? t('reviewConfidence.dryRun.mode', 'dry-run') : t('reviewConfidence.apply.mode', 'apply')) + '</span></header>',
      recap.message ? '<p>' + escapeHtml(recap.message) + '</p>' : '',
      rows.length ? '<dl>' + rows.map((row) => '<div><dt>' + escapeHtml(row.label) + '</dt><dd>' + escapeHtml(row.value) + '</dd></div>').join('') + '</dl>' : '',
      recap.diagnostics && recap.diagnostics.length ? '<ul>' + recap.diagnostics.slice(0, 3).map((line) => '<li>' + escapeHtml(line) + '</li>').join('') + '</ul>' : '',
      '</section>'
    ].join('');
  }

  function buildOperationConfidence(operation, item, reason, opts) {
    const api = confidenceApi();
    if (!api || typeof api.buildOperationConfidence !== 'function') {
      return null;
    }
    return api.buildOperationConfidence(operation || {}, item || {}, {
      reason,
      planTitle: opts && opts.plan && opts.plan.title || '',
      runtimeReadiness: opts && opts.runtimeReadiness || opts && opts.result && opts.result.runtimeReadiness || null,
      translate: translator(opts && opts.t)
    });
  }

  function renderConfidenceEvidence(confidence, t) {
    const rows = Array.isArray(confidence && confidence.rows) ? confidence.rows.filter((row) => row && row.label && row.value) : [];
    if (!rows.length) {
      return '';
    }
    return [
      '<div class="install-op-confidence" data-install-op-confidence="true" data-install-op-confidence-status="' + escapeAttr(confidence.status || '') + '">',
      '<div class="install-op-confidence-title">' + escapeHtml(t('reviewConfidence.title', 'Review confidence')) + '</div>',
      '<dl>',
      rows.map((row) => '<div data-review-confidence-field="' + escapeAttr(row.key || '') + '"><dt>' + escapeHtml(row.label) + '</dt><dd>' + escapeHtml(row.value) + '</dd></div>').join(''),
      '</dl>',
      '</div>'
    ].join('');
  }

  function renderRuntimeRecommendation(recommendation, t) {
    const value = recommendation && typeof recommendation === 'object' ? recommendation : null;
    if (!value || !value.label) {
      return '';
    }
    return [
      '<div class="install-runtime-recommendation" data-install-runtime-recommendation="true" data-runtime-recommendation-kind="' + escapeAttr(value.kind || '') + '">',
      '<strong>' + escapeHtml(value.label) + '</strong>',
      value.message ? '<p>' + escapeHtml(value.message) + '</p>' : '',
      value.fallback ? '<small>' + escapeHtml(value.fallback) + '</small>' : '',
      '</div>'
    ].join('');
  }

  function renderOperationContextLens(operation, item, reason, t) {
    const api = contextLensApi();
    if (!api || typeof api.buildForOperation !== 'function') {
      return '';
    }
    const lens = api.buildForOperation(operation || {}, {
      status: item && item.status,
      reason,
      translate: t
    });
    const rows = Array.isArray(lens && lens.rows) ? lens.rows.filter((row) => row && row.label && row.value) : [];
    if (!rows.length) {
      return '';
    }
    return [
      '<span class="authoring-context-lens" data-authoring-context-lens="true" data-context-lens-kind="' + escapeAttr(lens.subjectKind || 'operation') + '" data-context-lens-evidence="' + escapeAttr(lens.evidenceState || 'unknown') + '" data-context-lens-pinned="false" data-context-lens-payload="' + escapeAttr(JSON.stringify(lens)) + '" role="button" tabindex="0" aria-expanded="false" aria-label="' + escapeAttr(t('contextLens.openAria', 'Show authoring context') + ': ' + (lens.meaning || lens.subjectKind || '')) + '">',
      '<span class="authoring-context-lens-dot" aria-hidden="true">i</span>',
      '<span class="authoring-context-lens-popover" role="tooltip">',
      '<strong>' + escapeHtml(lens.meaning || t('contextLens.title', 'Authoring context')) + '</strong>',
      '<dl>',
      rows.map((row) => '<div><dt>' + escapeHtml(row.label) + '</dt><dd>' + escapeHtml(row.value) + '</dd></div>').join(''),
      '</dl>',
      '</span>',
      '</span>'
    ].join('');
  }

  function renderEvidence(result, t) {
    const evidence = result && result.evidence || null;
    if (!evidence) {
      return '';
    }
    const rows = [
      [t('install.evidence.match', 'Match'), evidence.match || evidence.status || ''],
      [t('install.evidence.line', 'Line'), evidenceLineLabel(evidence)],
      [t('install.evidence.beforeHash', 'Before hash'), shortHash(evidence.beforeHash)],
      [t('install.evidence.afterHash', 'After hash'), shortHash(evidence.afterHash)],
      [t('install.evidence.sourceHash', 'Source hash'), shortHash(evidence.sourceHash)],
      [t('install.evidence.targetHash', 'Target hash'), shortHash(evidence.targetHash)]
    ].filter((row) => row[1]);
    const snippets = [
      evidence.beforeSnippet ? {label: t('install.evidence.current', 'Current file'), text: evidence.beforeSnippet} : null,
      evidence.afterSnippet ? {label: t('install.evidence.proposed', 'Verified result'), text: evidence.afterSnippet} : null
    ].filter(Boolean);
    return [
      '<div class="install-op-evidence">',
      '<div class="install-op-evidence-title">' + escapeHtml(t('install.evidence.title', 'Current-file evidence')) + '</div>',
      evidence.message ? '<p>' + escapeHtml(evidence.message) + '</p>' : '',
      rows.length ? '<dl>' + rows.map((row) => '<div><dt>' + escapeHtml(row[0]) + '</dt><dd>' + escapeHtml(row[1]) + '</dd></div>').join('') + '</dl>' : '',
      snippets.length ? '<div class="install-op-preview install-op-evidence-snippets">' + snippets.map((block) => [
        '<div class="install-op-snippet">',
        '<span>' + escapeHtml(block.label) + '</span>',
        '<pre>' + escapeHtml(shortSnippet(block.text)) + '</pre>',
        '</div>'
      ].join('')).join('') + '</div>' : '',
      '</div>'
    ].join('');
  }

  function evidenceLineLabel(evidence) {
    if (evidence.startLine && evidence.endLine && evidence.endLine !== evidence.startLine) {
      return evidence.startLine + '-' + evidence.endLine;
    }
    return evidence.line || evidence.startLine || '';
  }

  function shortHash(value) {
    const text = String(value || '');
    return text.length > 16 ? text.slice(0, 12) + '...' : text;
  }

  function renderResultBadge(result, t) {
    if (!result || !result.status) {
      return '';
    }
    const status = String(result.status);
    const label = {
      applied: t('install.report.appliedHuman', 'Applied'),
      already_applied: t('install.report.alreadyAppliedHuman', 'Already applied'),
      would_apply: t('install.report.wouldApplyHuman', 'Check passed, not applied yet'),
      advanced_review: t('install.report.advancedReviewHuman', 'Waiting for advanced opt-in'),
      manual_review: t('install.report.manualReviewHuman', 'Manual step'),
      failed: t('install.report.failedHuman', 'Needs attention')
    }[status] || status;
    return '<span class="install-op-result install-op-result-' + escapeAttr(status.replace(/_/g, '-')) + '">' + escapeHtml(label) + '</span>';
  }

  function operationReason(installApi, item, operation, opts) {
    if (installApi && typeof installApi.operationReason === 'function') {
      return installApi.operationReason(operation || {}, item || {}, {locale: opts.locale || 'en'});
    }
    return item && item.reason || operation && operation.description || '';
  }

  function operationWhere(operation, t) {
    const path = operation && operation.path ? String(operation.path) : '';
    if (!path) {
      return '';
    }
    const start = operation.startLine || operation.line || null;
    const end = operation.endLine && operation.endLine !== start ? operation.endLine : null;
    const line = start
      ? (end
        ? t('install.human.lines', 'lines {start}-{end}').replace('{start}', start).replace('{end}', end)
        : t('install.human.line', 'line {line}').replace('{line}', start))
      : '';
    return [path, line].filter(Boolean).join(' · ');
  }

  function renderOperationPreview(operation, t) {
    const blocks = previewBlocks(operation, t).filter((block) => block && block.text);
    if (!blocks.length) {
      return '';
    }
    return '<div class="install-op-preview">' + blocks.map((block) => [
      '<div class="install-op-snippet">',
      '<span>' + escapeHtml(block.label) + '</span>',
      '<pre>' + escapeHtml(shortSnippet(block.text)) + '</pre>',
      '</div>'
    ].join('')).join('') + '</div>';
  }

  function previewBlocks(operation, t) {
    const type = operation && operation.type;
    if (type === 'create_file') {
      return [{label: t('install.preview.creates', 'Creates'), text: operation.content || ''}];
    }
    if (type === 'replace_text') {
      return [
        {label: t('install.preview.before', 'Before'), text: operation.search || operation.before || ''},
        {label: t('install.preview.after', 'After'), text: operation.replace || operation.after || ''}
      ];
    }
    if (type === 'replace_section') {
      return [
        {label: t('install.preview.match', 'Match'), text: operation.anchorText || operation.search || ''},
        {label: t('install.preview.after', 'After'), text: operation.content || operation.replace || operation.after || ''}
      ];
    }
    if (type === 'insert_text') {
      return [
        {label: t('install.preview.anchor', 'Anchor'), text: operation.anchorText || ''},
        {label: t('install.preview.inserts', 'Inserts'), text: operation.content || ''}
      ];
    }
    if (type === 'manual_snippet') {
      return [{label: t('install.preview.manual', 'Manual snippet'), text: operation.content || ''}];
    }
    if (type === 'copy_asset_file') {
      return [{label: t('install.preview.asset', 'Asset'), text: [operation.sourceName || operation.sourcePath || '', operation.path || ''].filter(Boolean).join(' -> ')}];
    }
    return [];
  }

  function actionLabel(operation, t) {
    const type = operation && operation.type;
    if (type === 'create_file') {
      return t('install.action.createFile', 'Create a new source file');
    }
    if (type === 'replace_text') {
      return t('install.action.replaceText', 'Replace player-facing text');
    }
    if (type === 'replace_section') {
      if (operation && (operation.destructive || operation.allowEmptyReplace && !String(operation.content || '').trim())) {
        return t('install.action.deleteSection', 'Delete a source section');
      }
      return t('install.action.replaceSection', 'Replace a source section');
    }
    if (type === 'insert_text') {
      return t('install.action.insertText', 'Insert source text');
    }
    if (type === 'manual_snippet') {
      return t('install.action.manualSnippet', 'Copy a manual snippet');
    }
    if (type === 'copy_asset_file') {
      return t('install.action.copyAssetFile', 'Copy an asset file');
    }
    return t('install.action.reviewOperation', 'Review this change');
  }

  function resultById(result) {
    const map = new Map();
    const rows = Array.isArray(result && result.results) ? result.results : [];
    rows.forEach((row) => {
      if (row && row.id) {
        map.set(row.id, row);
      }
    });
    return map;
  }

  function shortSnippet(value) {
    const text = String(value || '').trim();
    if (text.length <= 700) {
      return text;
    }
    return text.slice(0, 680).trimEnd() + '\n...';
  }

  function translator(fn) {
    return typeof fn === 'function' ? fn : (_key, fallback) => fallback;
  }

  function contextLensApi() {
    if (global && global.ProjectMapAuthoringContextLens) {
      return global.ProjectMapAuthoringContextLens;
    }
    if (typeof require === 'function') {
      try {
        return require('../authoring/authoring_context_lens_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function confidenceApi() {
    if (global && global.ProjectMapReviewConfidenceModel) {
      return global.ProjectMapReviewConfidenceModel;
    }
    if (typeof require === 'function') {
      try {
        return require('../authoring/review_confidence_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  const api = {renderPlanReview};

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapInstallReviewUi = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
