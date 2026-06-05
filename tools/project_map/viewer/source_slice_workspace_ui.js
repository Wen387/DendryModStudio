(function initProjectMapSourceSliceWorkspace(global) {
  'use strict';

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const ensureArray = domTextUtils.ensureArray;

  const FIELD_KEY = 'source_slice.replacementText';

  const api = {
    FIELD_KEY,
    buildCanvasModel,
    render,
    bind,
    reviewAllowed,
    replacementText
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSourceSliceWorkspace = api;
  }

  function buildCanvasModel(sliceModel, values, deps) {
    const slice = sliceModel || {};
    const options = deps || {};
    const current = String(slice.currentText || '');
    const replacement = replacementText(values, slice);
    const changed = replacement !== current;
    const sourceApi = options.sourceSliceApi || sourceSliceApi();
    const proposal = changed && sourceApi && typeof sourceApi.buildProposal === 'function'
      ? sourceApi.buildProposal(slice, {replacementText: replacement})
      : {ok: Boolean(slice && slice.ok), installPlan: null, operations: [], diagnostics: []};
    const plan = changed ? proposal && proposal.installPlan || null : null;
    const operations = ensureArray(plan && plan.operations || proposal && proposal.operations);
    const title = slice.title || tr(options, 'sourceSlice.title', 'Precise source edit');
    return {
      schemaVersion: '0.1',
      kind: 'object_authoring_canvas_model',
      ok: Boolean(slice && slice.ok),
      mode: 'source_slice',
      template: 'source_slice',
      templateLabel: tr(options, 'sourceSlice.template', 'Precise Source Edit'),
      objectKind: tr(options, 'sourceSlice.objectKind', 'Source-backed edit'),
      objectId: String(slice.targetId || slice.sourcePath || 'source_slice'),
      title,
      source: slice.source || {path: slice.sourcePath || ''},
      entry: {source: 'visible_edit_action'},
      contextBoard: {},
      eventBody: {},
      changeState: {
        draft: {
          schemaVersion: '0.1',
          kind: 'source_slice_editor',
          title,
          targetId: slice.targetId || '',
          source: slice.source || null,
          replacementText: replacement
        },
        proposal,
        output: {
          installPlan: plan,
          playerPreview: replacement,
          previewText: replacement
        },
        installPlan: plan,
        operationSummary: summarizeOperations(operations),
        changedCount: changed ? 1 : 0,
        diagnostics: ensureArray(slice.diagnostics).concat(ensureArray(proposal && proposal.diagnostics)),
        warnings: [],
        sourceSliceChanged: changed,
        sourceSliceBefore: current,
        sourceSliceAfter: replacement
      },
      legacy: {template: 'source_slice'},
      rawContext: slice
    };
  }

  function render(model, state, deps) {
    const options = deps || {};
    const viewState = state || {};
    const canvasModel = model || {};
    const slice = viewState.sourceSliceModel || canvasModel.rawContext || {};
    const change = canvasModel.changeState || {};
    const plan = change.installPlan || null;
    const operations = ensureArray(plan && plan.operations || change.proposal && change.proposal.operations);
    const operation = operations[0] || {};
    const replacement = change.draft && Object.prototype.hasOwnProperty.call(change.draft, 'replacementText')
      ? String(change.draft.replacementText || '')
      : replacementText(viewState.values, slice);
    const current = String(slice.currentText || '');
    const changed = replacement !== current || Boolean(change.changedCount);
    const sourceLabel = [slice.sourcePath || slice.source && slice.source.path || '', sourceLineLabel(slice)].filter(Boolean).join(':');
    const safety = String(slice.installSafety || operation.safety || '');
    const advancedRequired = safety === 'advanced_apply';
    const allowed = reviewAllowed({
      model: canvasModel,
      sourceSliceModel: slice,
      sourceSliceAdvancedConfirmed: Boolean(viewState.sourceSliceAdvancedConfirmed)
    });
    return [
      '<section class="object-canvas-stage source-slice-editor" data-source-slice-editor="true">',
      '<div class="object-canvas-stage-toolbar source-slice-toolbar">',
      '<div>',
      '<div class="template-eyebrow">' + esc(options, tr(options, 'sourceSlice.eyebrow', 'Precise source edit')) + '</div>',
      '<h3>' + esc(options, slice.title || tr(options, 'sourceSlice.title', 'Precise source edit')) + '</h3>',
      '<p>' + esc(options, tr(options, 'sourceSlice.body', 'Edit the exact source text behind this visible content, then review the generated operation.')) + '</p>',
      '</div>',
      '<div class="source-slice-badges">',
      '<span>' + esc(options, safetyLabel(safety, options)) + '</span>',
      '<span>' + esc(options, String(operation.type || slice.operationType || 'replace_text')) + '</span>',
      '</div>',
      '</div>',
      '<div class="source-slice-grid">',
      '<section class="editing-panel source-slice-main">',
      '<div class="editing-field editing-field-' + attr(options, advancedRequired ? 'manual' : 'guarded') + '">',
      '<span>' + esc(options, tr(options, 'sourceSlice.currentContent', 'Editable content')) + '</span>',
      '<small>' + esc(options, sourceLabel || tr(options, 'sourceSlice.sourceMissing', 'Studio could not find the source position for this visible content.')) + '</small>',
      '<textarea data-object-canvas-field="' + attr(options, FIELD_KEY) + '" data-source-slice-textarea="true" data-object-canvas-original="' + attr(options, current) + '" rows="12">' + esc(options, replacement) + '</textarea>',
      '</div>',
      advancedRequired ? renderAdvancedToggle(viewState, options) : '',
      '<div class="editing-actions source-slice-actions">',
      '<button type="button" data-object-canvas-action="refresh">' + esc(options, tr(options, 'sourceSlice.preview', 'Preview change')) + '</button>',
      '<button class="primary-action" type="button" data-object-canvas-action="review"' + (allowed ? '' : ' disabled aria-disabled="true"') + '>' + esc(options, tr(options, 'existingScene.review', 'Review & Apply')) + '</button>',
      '</div>',
      '</section>',
      '<aside class="editing-field-panels">',
      renderEvidence(slice, options),
      changed ? renderDiff(current, replacement, options) : renderNoChanges(options),
      changed ? renderPlan(options, plan) : '',
      renderDiagnostics(options, change.diagnostics || []),
      '</aside>',
      '</div>',
      '</section>'
    ].join('');
  }

  function bind(host, state, deps) {
    const root = host || null;
    if (!root || !root.querySelectorAll) {
      return;
    }
    root.querySelectorAll('[data-source-slice-advanced-confirm]').forEach((input) => {
      if (input.__dmsSourceSliceWorkspaceBound) {
        return;
      }
      input.__dmsSourceSliceWorkspaceBound = true;
      input.addEventListener('change', () => {
        if (state) {
          state.sourceSliceAdvancedConfirmed = Boolean(input.checked);
        }
        if (deps && typeof deps.onAdvancedConfirmed === 'function') {
          deps.onAdvancedConfirmed(Boolean(input.checked));
        }
        syncReviewControls(root, state);
      });
    });
    syncReviewControls(root, state);
  }

  function reviewAllowed(state) {
    const value = state || {};
    const model = value.model || {};
    const slice = value.sourceSliceModel || model.rawContext || {};
    const change = model.changeState || {};
    const changed = Number(change.changedCount || 0) > 0 || Boolean(change.sourceSliceChanged);
    if (!changed) {
      return false;
    }
    const plan = change.installPlan || change.output && change.output.installPlan || null;
    const operation = ensureArray(plan && plan.operations || change.proposal && change.proposal.operations)[0] || {};
    const safety = String(slice.installSafety || operation.safety || '');
    return safety !== 'advanced_apply' || Boolean(value.sourceSliceAdvancedConfirmed || value.advancedConfirmed);
  }

  function replacementText(values, sliceModel) {
    const nextValues = values && typeof values === 'object' ? values : {};
    if (Object.prototype.hasOwnProperty.call(nextValues, FIELD_KEY)) {
      return String(nextValues[FIELD_KEY] === undefined || nextValues[FIELD_KEY] === null ? '' : nextValues[FIELD_KEY]);
    }
    return String(sliceModel && sliceModel.currentText || '');
  }

  function summarizeOperations(operations) {
    const summary = {safeApply: 0, guardedApply: 0, advancedApply: 0, manualReview: 0, refused: 0};
    ensureArray(operations).forEach((operation) => {
      const safety = String(operation && operation.safety || '');
      if (safety === 'safe_apply') {
        summary.safeApply += 1;
      } else if (safety === 'guarded_apply') {
        summary.guardedApply += 1;
      } else if (safety === 'advanced_apply') {
        summary.advancedApply += 1;
      } else if (safety === 'refused') {
        summary.refused += 1;
      } else if (operation) {
        summary.manualReview += 1;
      }
    });
    return summary;
  }

  function renderAdvancedToggle(state, deps) {
    return [
      '<label class="source-slice-advanced-toggle">',
      '<input type="checkbox" data-source-slice-advanced-confirm="true"' + (state && state.sourceSliceAdvancedConfirmed ? ' checked' : '') + '>',
      '<span>' + esc(deps, tr(deps, 'sourceSlice.advancedConfirm', 'Enable advanced apply for this protected source edit.')) + '</span>',
      '</label>'
    ].join('');
  }

  function renderEvidence(slice, deps) {
    const source = slice && slice.source || {};
    const evidence = slice && slice.anchorEvidence || {};
    return [
      '<section class="editing-panel source-slice-evidence">',
      '<h3>' + esc(deps, tr(deps, 'sourceSlice.evidenceTitle', 'Source position')) + '</h3>',
      '<dl class="editing-meta">',
      '<dt>' + esc(deps, tr(deps, 'existingScene.source', 'Source')) + '</dt><dd>' + esc(deps, source.path || '') + '</dd>',
      '<dt>' + esc(deps, tr(deps, 'sourceSlice.lineRange', 'Line range')) + '</dt><dd>' + esc(deps, sourceLineLabel(slice) || '') + '</dd>',
      '<dt>' + esc(deps, tr(deps, 'sourceSlice.anchor', 'Matched text')) + '</dt><dd>' + esc(deps, evidence.anchorText || source.anchorText || '') + '</dd>',
      '<dt>' + esc(deps, tr(deps, 'sourceSlice.safety', 'Safety')) + '</dt><dd>' + esc(deps, safetyLabel(slice && slice.installSafety || '', deps)) + '</dd>',
      '</dl>',
      '</section>'
    ].join('');
  }

  function renderNoChanges(deps) {
    return [
      '<section class="editing-panel source-slice-no-changes" data-source-slice-no-changes="true">',
      '<h3>' + esc(deps, tr(deps, 'sourceSlice.noChangesTitle', 'Preview change')) + '</h3>',
      '<p>' + esc(deps, tr(deps, 'sourceSlice.noChanges', 'No changes yet.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderDiff(before, after, deps) {
    return [
      '<section class="editing-panel source-slice-diff" data-source-slice-diff="true">',
      '<h3>' + esc(deps, tr(deps, 'sourceSlice.diffTitle', 'Before / After')) + '</h3>',
      '<div class="source-slice-diff-grid">',
      '<div data-source-slice-before="true"><span>' + esc(deps, tr(deps, 'sourceSlice.before', 'Before')) + '</span><pre>' + esc(deps, before) + '</pre></div>',
      '<div data-source-slice-after="true"><span>' + esc(deps, tr(deps, 'sourceSlice.after', 'After')) + '</span><pre>' + esc(deps, after) + '</pre></div>',
      '</div>',
      '</section>'
    ].join('');
  }

  function renderPlan(deps, plan) {
    return deps && typeof deps.renderPlanPreview === 'function'
      ? deps.renderPlanPreview(plan)
      : '';
  }

  function renderDiagnostics(deps, diagnostics) {
    return deps && typeof deps.renderDiagnostics === 'function'
      ? deps.renderDiagnostics(diagnostics)
      : '';
  }

  function syncReviewControls(host, state) {
    const allowed = reviewAllowed(state || {});
    host.querySelectorAll('[data-source-slice-editor] [data-object-canvas-action="review"]').forEach((button) => {
      button.disabled = !allowed;
      button.setAttribute('aria-disabled', allowed ? 'false' : 'true');
    });
  }

  function sourceLineLabel(slice) {
    const value = slice || {};
    const start = value.startLine || value.line || value.source && (value.source.startLine || value.source.line);
    const end = value.endLine || value.source && value.source.endLine || start;
    if (!start) {
      return '';
    }
    return end && end !== start ? String(start) + '-' + String(end) : String(start);
  }

  function safetyLabel(value, deps) {
    const safety = String(value || '');
    if (safety === 'advanced_apply') {
      return tr(deps, 'sourceSlice.safety.advanced', 'Advanced apply');
    }
    if (safety === 'safe_apply') {
      return tr(deps, 'sourceSlice.safety.safe', 'Safe apply');
    }
    return tr(deps, 'sourceSlice.safety.guarded', 'Guarded apply');
  }

  function tr(deps, key, fallback) {
    return deps && typeof deps.translate === 'function' ? deps.translate(key, fallback) : fallback;
  }

  function esc(deps, value) {
    return deps && typeof deps.escapeHtml === 'function' ? deps.escapeHtml(value) : fallbackEscape(value);
  }

  function attr(deps, value) {
    return deps && typeof deps.escapeAttr === 'function' ? deps.escapeAttr(value) : fallbackEscape(value);
  }

  function fallbackEscape(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function sourceSliceApi() {
    if (global && global.ProjectMapSourceSliceEditor) {
      return global.ProjectMapSourceSliceEditor;
    }
    if (typeof require === 'function') {
      try {
        return require('../authoring/source_slice_editor_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
