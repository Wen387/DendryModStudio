(function initProjectMapObjectCanvasShellUi(global) {
  'use strict';

  function renderShell(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const state = opts.state || {};
    const model = opts.model || {};
    const surface = opts.surface || {};
    const canCollapse = boardChromeCanCollapse(surface);
    const modalActive = Boolean(state.editorOverlay && previewEditorIsActive(surface));
    const classes = [
      'object-canvas editing-workspace',
      state.editorOverlay ? 'is-editor-overlay' : '',
      previewEditorIsActive(surface) ? 'has-preview-object-editor' : '',
      canCollapse && state.boardChromeCollapsed ? 'is-board-chrome-collapsed' : ''
    ].filter(Boolean).join(' ');
    return [
      '<section class="' + classes + '" data-object-authoring-canvas="true" data-editing-workspace="true" data-authoring-workspace="' + escapeAttr(state.workspace || 'content') + '" data-authoring-surface="' + escapeAttr(surface.key || 'content_graph') + '" data-preview-object-editor-active="' + (previewEditorIsActive(surface) ? 'true' : 'false') + '" data-board-chrome-collapsed="' + (state.boardChromeCollapsed ? 'true' : 'false') + '" style="' + escapeAttr(opts.layoutStyle || '') + '">',
      renderHeader(model, surface, state, opts),
      opts.stageHtml || '',
      opts.modalHtml || '',
      modalActive ? '' : opts.bodyHtml || '',
      '</section>'
    ].join('');
  }

  function renderHeader(model, surface, state, options) {
    const opts = options || {};
    const t = translateFn(opts.translate);
    const canCollapse = boardChromeCanCollapse(surface);
    if (canCollapse) {
      // Banner retired on canvas surfaces (Content Storyboard, Card board,
      // System UI preview, Election/Project boards): the sidebar command dock
      // already shows the object's title, kind, and source, so this header only
      // wasted vertical height. Keep the status node mounted (the canvas UI
      // reads/writes [data-object-canvas-status]) but visually hidden so it
      // claims no layout space.
      return [
        '<header class="object-canvas-header object-canvas-header-retired" data-object-canvas-header="true">',
        '<div class="editing-status-line" data-object-canvas-status="true">' + escapeHtml(state.status || '') + '</div>',
        '</header>'
      ].join('');
    }
    const source = model.source || {};
    const systemUi = surface && surface.key === 'system_ui_preview';
    const modeLabel = model.mode === 'existing'
      ? t('objectCanvas.mode.existing', 'Editing existing object')
      : t('objectCanvas.mode.newObject', 'Authoring object');
    const kindLabel = systemUi ? t('authoring.template.systemUiScreen', 'System UI Screen') : model.templateLabel || model.objectKind || state.template || 'event';
    const surfaceLabel = surface && labelForSurface(surface, opts) || t('objectCanvas.eyebrow', 'Object Authoring Canvas');
    const title = headerTitle(model, surface, t);
    const displayTitle = displayCompactLabel(title);
    const collapsed = canCollapse && state.boardChromeCollapsed;
    const toggleLabel = collapsed
      ? t('objectCanvas.expandBoardChrome', 'Expand board details')
      : t('objectCanvas.collapseBoardChrome', 'Collapse board details');
    return [
      '<header class="object-canvas-header editing-workspace-header' + (canCollapse ? ' is-collapsible' : '') + (collapsed ? ' is-collapsed' : '') + '" data-object-canvas-header="true">',
      '<div>',
      '<div class="object-canvas-title-row">',
      '<div>',
      '<div class="template-eyebrow" data-authoring-surface-label="true">' + escapeHtml(surfaceLabel) + '</div>',
      '<h2 data-object-canvas-title="true" title="' + escapeAttr(title) + '">' + escapeHtml(displayTitle) + '</h2>',
      '</div>',
      canCollapse ? '<button class="object-canvas-chrome-toggle" type="button" data-object-canvas-action="toggle_board_chrome" aria-expanded="' + (collapsed ? 'false' : 'true') + '">' + escapeHtml(toggleLabel) + '</button>' : '',
      '</div>',
      '<p>' + escapeHtml(t('objectCanvas.body', 'Design the object itself: keep context beside it, edit player-facing text directly, then review the exact change operations.')) + '</p>',
      '<div class="editing-status-line" data-object-canvas-status="true">' + escapeHtml(state.status || '') + '</div>',
      '</div>',
      '<dl class="editing-meta">',
      '<dt>' + escapeHtml(t('objectCanvas.mode', 'Mode')) + '</dt><dd>' + escapeHtml(modeLabel) + '</dd>',
      '<dt>' + escapeHtml(t('existingScene.kind', 'Kind')) + '</dt><dd>' + escapeHtml(kindLabel) + '</dd>',
      '<dt>' + escapeHtml(t('existingScene.sceneId', 'Scene')) + '</dt><dd>' + escapeHtml(model.objectId || '') + '</dd>',
      '<dt>' + escapeHtml(t('existingScene.source', 'Source')) + '</dt><dd>' + escapeHtml(source.path ? source.path + (source.line ? ':' + source.line : '') : '') + '</dd>',
      '</dl>',
      '</header>'
    ].join('');
  }

  function renderBody() {
    return '<div class="object-canvas-layout object-canvas-layout-retired" hidden data-object-canvas-support-panels="true"></div>';
  }

  function renderUnavailable(model, options) {
    const t = translateFn(options && options.translate);
    const diagnostics = model && model.changeState && model.changeState.diagnostics || [];
    return [
      '<section class="editing-panel" open>',
      '<div class="editing-empty">' + escapeHtml(t('objectCanvas.unavailable', 'Object Canvas cannot open this selection yet.')) + '</div>',
      diagnostics.map((diag) => '<p class="editing-readonly-line">' + escapeHtml((diag.code || 'diagnostic') + ': ' + (diag.message || '')) + '</p>').join(''),
      '</section>'
    ].join('');
  }

  function renderStageError(surface, err, options) {
    const t = translateFn(options && options.translate);
    return [
      '<section class="object-canvas-stage object-canvas-render-error" data-object-canvas-stage="true" data-object-canvas-render-error="true" data-authoring-surface="' + escapeAttr(surface && surface.key || '') + '">',
      '<div class="editing-empty">',
      '<h3>' + escapeHtml(t('objectCanvas.renderErrorTitle', 'Canvas could not render this workspace.')) + '</h3>',
      '<p>' + escapeHtml(err && err.message ? err.message : String(err || 'Unknown render error')) + '</p>',
      '</div>',
      '</section>'
    ].join('');
  }

  function renderChangePanel(model, options) {
    const opts = options || {};
    const t = translateFn(opts.translate);
    const change = model.changeState || {};
    const summary = change.operationSummary || {};
    const output = change.output || {};
    const installPlan = change.installPlan || output.installPlan || parseJson(output.installPlanJson);
    return [
      '<section class="editing-summary" data-object-canvas-operation-summary="true">',
      '<h3>' + escapeHtml(t('objectCanvas.changeTitle', 'Change and safety')) + '</h3>',
      '<div class="editing-summary-grid">',
      summaryBox(t('editing.summary.guarded', 'Guarded'), summary.guardedApply),
      summaryBox(t('editing.summary.manual', 'Manual'), summary.manualReview),
      summaryBox(t('editing.summary.refused', 'Refused'), summary.refused),
      summaryBox(t('objectCanvas.changedFields', 'Changed'), change.changedCount),
      '</div>',
      '</section>',
      '<section class="editing-preview">',
      '<div class="preview-heading">' + escapeHtml(t('objectCanvas.preview', 'Player-facing preview')) + '</div>',
      '<pre class="code-preview" data-object-canvas-preview="true" data-editing-preview="true">' + escapeHtml(output.playerPreview || output.proposalText || output.previewText || output.sceneDry || '') + '</pre>',
      '</section>',
      renderPlanPreview(installPlan, opts),
      renderDiagnostics(change.diagnostics || [], opts),
      renderActions(model, opts)
    ].join('');
  }

  function renderPlanPreview(plan, options) {
    const t = translateFn(options && options.translate);
    const operations = Array.isArray(plan && plan.operations) ? plan.operations : [];
    return [
      '<section class="editing-panel object-canvas-plan" data-object-canvas-review-plan="true">',
      '<h3>' + escapeHtml(t('objectCanvas.planTitle', 'Modification plan')) + '</h3>',
      operations.length
        ? operations.slice(0, 6).map((operation) => renderPlanOperation(operation, options)).join('')
        : '<p class="editing-empty">' + escapeHtml(t('objectCanvas.planEmpty', 'No install operations are available for review yet.')) + '</p>',
      operations.length > 6 ? '<p class="editing-readonly-line">' + escapeHtml(t('objectCanvas.planMore', 'More operations are available in Review & Apply.')) + '</p>' : '',
      '</section>'
    ].join('');
  }

  function renderPlanOperation(operation, options) {
    const t = translateFn(options && options.translate);
    const op = operation && typeof operation === 'object' ? operation : {};
    const title = op.description || op.id || op.type || t('objectCanvas.planOperation', 'Operation');
    const meta = [
      op.safety || '',
      op.type || '',
      op.path || op.targetPath || ''
    ].filter(Boolean).join(' / ');
    return [
      '<article class="object-canvas-plan-row">',
      '<strong>' + escapeHtml(title) + '</strong>',
      meta ? '<span>' + escapeHtml(meta) + '</span>' : '',
      '</article>'
    ].join('');
  }

  function renderDiagnostics(rows, options) {
    const t = translateFn(options && options.translate);
    const items = Array.isArray(rows) ? rows : [];
    if (!items.length) {
      return '';
    }
    return [
      '<details class="editing-panel object-canvas-diagnostics">',
      '<summary><span>' + escapeHtml(t('create.diagnostics', 'Diagnostics')) + '</span><b>' + items.length + '</b></summary>',
      items.slice(0, 8).map((diag) => '<p class="editing-readonly-line">' + escapeHtml(diag.message || diag.code || '') + '</p>').join(''),
      '</details>'
    ].join('');
  }

  function renderActions(model, options) {
    const t = translateFn(options && options.translate);
    return [
      '<div class="editing-actions object-canvas-actions">',
      '<button type="button" data-object-canvas-action="refresh">' + escapeHtml(t('existingScene.refresh', 'Refresh proposal')) + '</button>',
      '<button type="button" data-object-canvas-action="save">' + escapeHtml(t('editing.saveToChanges', 'Save to My Changes')) + '</button>',
      '<button class="primary-action" type="button" data-object-canvas-action="review">' + escapeHtml(t('existingScene.review', 'Review & Apply')) + '</button>',
      '<button class="danger-action" type="button" data-object-canvas-action="delete_current_object">' + escapeHtml(t(model.mode === 'existing' ? 'objectCanvas.action.deleteExisting' : 'objectCanvas.action.discardDraft', model.mode === 'existing' ? 'Delete event' : 'Discard draft')) + '</button>',
      '</div>'
    ].join('');
  }

  function summaryBox(label, value) {
    return [
      '<div class="editing-summary-box">',
      '<strong>' + escapeHtml(String(Number(value || 0))) + '</strong>',
      '<span>' + escapeHtml(label) + '</span>',
      '</div>'
    ].join('');
  }

  function boardChromeCanCollapse(surface) {
    const key = surface && surface.key || '';
    return key === 'content_storyboard' || key === 'card_board' || key === 'system_ui_preview' || key === 'election_results_board' || key === 'project_state_board';
  }

  function previewEditorIsActive(surface) {
    const key = surface && surface.key || '';
    return key === 'content_storyboard' || key === 'card_board';
  }

  function canRenderSurfaceWithDiagnostics(surface) {
    const key = surface && surface.key || '';
    return key === 'card_board';
  }

  function headerTitle(model, surface, t) {
    return surface && surface.key === 'election_results_board'
      ? t('create.electionResults', 'Election Results')
      : surface && surface.key === 'system_ui_preview'
      ? t('authoring.template.systemUiScreen', 'System UI Screen')
      : model && model.title || t('objectCanvas.titleFallback', 'Author object');
  }

  function displayCompactLabel(value) {
    const raw = String(value || '');
    const display = compactDendryInlineLabel(raw) || raw.trim();
    return display || raw;
  }

  function compactDendryInlineLabel(value) {
    const raw = String(value || '');
    if (!raw) {
      return '';
    }
    const conditionalPattern = /\[\?\s*if\s+[^:]+:\s*([\s\S]*?)\?\]/g;
    const matches = [];
    let match;
    while ((match = conditionalPattern.exec(raw)) !== null) {
      matches.push({index: match.index, text: cleanDisplayLabel(match[1]), raw: match[0]});
    }
    if (!matches.length) {
      return cleanDisplayLabel(raw);
    }
    const first = matches[0];
    const last = matches[matches.length - 1];
    const before = raw.slice(0, first.index);
    const after = raw.slice(last.index + last.raw.length);
    const onlyAdjacentConditionals = !cleanDisplayLabel(before) && matches.every((item, index) => {
      if (index === 0) {
        return true;
      }
      const previous = matches[index - 1];
      return !cleanDisplayLabel(raw.slice(previous.index + previous.raw.length, item.index));
    });
    const unique = uniqueNonEmpty(matches.map((item) => item.text));
    if (onlyAdjacentConditionals && unique.length > 1) {
      return cleanDisplayLabel([unique.join(' / '), after].filter(Boolean).join(' '));
    }
    return cleanDisplayLabel(raw.replace(conditionalPattern, (_token, body) => ' ' + cleanDisplayLabel(body) + ' '));
  }

  function cleanDisplayLabel(value) {
    return String(value || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\*\*/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function uniqueNonEmpty(values) {
    const seen = new Set();
    const result = [];
    (Array.isArray(values) ? values : []).forEach((value) => {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      result.push(text);
    });
    return result;
  }

  function labelForSurface(surface, options) {
    return options && typeof options.surfaceLabelFor === 'function'
      ? options.surfaceLabelFor(surface)
      : surface && (surface.label || surface.title || surface.key) || '';
  }

  function parseJson(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch (_err) {
      return null;
    }
  }

  function translateFn(fn) {
    return typeof fn === 'function' ? fn : identityTranslate;
  }

  function identityTranslate(_key, fallback) {
    return fallback;
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  const api = {
    renderShell,
    renderHeader,
    renderBody,
    renderUnavailable,
    renderStageError,
    renderChangePanel,
    renderPlanPreview,
    renderPlanOperation,
    renderDiagnostics,
    renderActions,
    boardChromeCanCollapse,
    previewEditorIsActive,
    canRenderSurfaceWithDiagnostics
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectCanvasShellUi = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
