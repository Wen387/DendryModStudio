(function initProjectMapObjectCanvasGraphStage(global) {
  'use strict';

  function render(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const state = opts.state || {};
    const graph = canvasGraphForModel(model, state);
    let selected = graph.nodes.find((node) => node.key === state.selectedCanvasNode);
    if (!selected) {
      state.selectedCanvasNode = 'object';
      selected = graph.nodes.find((node) => node.key === 'object') || graph.nodes[0];
    }
    return [
      '<section class="object-canvas-stage object-canvas-graph-stage" data-object-canvas-stage="true" data-object-canvas-workspace="' + escapeAttr(graph.workspace) + '" aria-label="' + escapeAttr(t('objectCanvas.stageAria', 'Object Canvas')) + '">',
      '<header class="object-canvas-stage-toolbar">',
      '<div><div class="template-eyebrow">' + escapeHtml(t('objectCanvas.stageEyebrow', 'Canvas')) + '</div><h3>' + escapeHtml(graph.title) + '</h3></div>',
      '<div class="object-canvas-zoom-controls" aria-label="' + escapeAttr(t('objectCanvas.zoomAria', 'Canvas zoom')) + '">',
      '<button type="button" data-object-canvas-zoom="out" title="' + escapeAttr(t('objectCanvas.zoomOut', 'Zoom out')) + '">-</button>',
      '<span data-object-canvas-zoom-label="true">' + escapeHtml(String(Math.round((state.canvasZoom || 1) * 100))) + '%</span>',
      '<button type="button" data-object-canvas-zoom="in" title="' + escapeAttr(t('objectCanvas.zoomIn', 'Zoom in')) + '">+</button>',
      '<button type="button" data-object-canvas-zoom="reset" title="' + escapeAttr(t('objectCanvas.zoomReset', 'Reset')) + '">' + escapeHtml(t('objectCanvas.fit', 'Fit')) + '</button>',
      '<button type="button" data-object-canvas-action="toggle_overlay" title="' + escapeAttr(t('objectCanvas.editorOverlay', 'Expand editor')) + '">' + escapeHtml(state.editorOverlay ? t('objectCanvas.editorDock', 'Dock') : t('objectCanvas.editorOverlay', 'Expand editor')) + '</button>',
      '</div>',
      '</header>',
      '<div class="object-canvas-graph-shell">',
      '<div class="object-canvas-graph-canvas" data-object-canvas-graph-canvas="true" style="--object-canvas-graph-width: ' + String(graph.width) + 'px; --object-canvas-graph-height: ' + String(graph.height) + 'px;">',
      '<svg class="object-canvas-graph-edges" data-object-canvas-graph-edges="true" viewBox="0 0 ' + String(graph.width) + ' ' + String(graph.height) + '" aria-hidden="true">',
      graph.edges.map((edge) => renderGraphEdge(edge, graph.nodeByKey)).join(''),
      '</svg>',
      '<div class="object-canvas-graph-board" data-object-canvas-graph-board="true">',
      graph.nodes.map((node) => renderGraphNode(node, selected)).join(''),
      '</div>',
      '</div>',
      '<aside class="object-canvas-graph-inspector" data-object-canvas-graph-inspector="true">',
      renderCanvasInspector(model, selected, opts),
      '</aside>',
      '</div>',
      '</section>'
    ].join('');
  }

  function renderGraphNode(node, selected) {
    const className = [
      'object-canvas-graph-node',
      'object-canvas-graph-node-' + escapeAttr(node.kind || 'context'),
      selected && selected.key === node.key ? 'is-selected' : ''
    ].filter(Boolean).join(' ');
    return [
      '<button type="button" class="' + className + '" data-object-canvas-graph-node="' + escapeAttr(node.key) + '" data-canvas-x="' + String(node.x) + '" data-canvas-y="' + String(node.y) + '" style="left: ' + String(node.x) + 'px; top: ' + String(node.y) + 'px;">',
      '<span>' + escapeHtml(node.label) + '</span>',
      '<strong>' + escapeHtml(node.title) + '</strong>',
      '<small>' + escapeHtml(node.detail) + '</small>',
      '</button>'
    ].join('');
  }

  function renderGraphEdge(edge, nodeByKey) {
    const from = nodeByKey[edge.from];
    const to = nodeByKey[edge.to];
    if (!from || !to) {
      return '';
    }
    const x1 = Number(from.x || 0) + 122;
    const y1 = Number(from.y || 0) + 56;
    const x2 = Number(to.x || 0) + 122;
    const y2 = Number(to.y || 0) + 56;
    const bend = Math.max(80, Math.abs(x2 - x1) * 0.44);
    return '<path data-object-canvas-graph-edge="' + escapeAttr(edge.from + '-' + edge.to) + '" d="M ' + x1 + ' ' + y1 + ' C ' + (x1 + bend) + ' ' + y1 + ', ' + (x2 - bend) + ' ' + y2 + ', ' + x2 + ' ' + y2 + '"></path>';
  }

  function renderCanvasInspector(model, node, options) {
    const selected = node || {key: 'object', title: model.title || '', label: t('objectCanvas.stage.object.label', 'Object')};
    if (selected.panel === 'object') {
      return renderObjectInspector(model, selected, options);
    }
    if (selected.panel === 'plan' || selected.panel === 'review') {
      return [
        renderInspectorIntro(selected),
        callRenderer(options.renderChangePanel, model)
      ].join('');
    }
    if (selected.panel === 'draft') {
      return [
        renderInspectorIntro(selected),
        callRenderer(options.renderActions, model)
      ].join('');
    }
    return [
      renderInspectorIntro(selected),
      renderContextBoard(model.contextBoard || {}),
      callRenderer(options.renderActions, model)
    ].join('');
  }

  function renderObjectInspector(model, node, options) {
    return [
      renderInspectorIntro(node),
      renderEventBody(model.eventBody || {}),
      '<section class="editing-preview object-canvas-inspector-preview">',
      '<div class="preview-heading">' + escapeHtml(t('objectCanvas.preview', 'Player-facing preview')) + '</div>',
      '<pre class="code-preview" data-object-canvas-preview="true" data-editing-preview="true">' + escapeHtml(model.changeState && model.changeState.output && (model.changeState.output.playerPreview || model.changeState.output.proposalText || model.changeState.output.previewText || model.changeState.output.sceneDry) || '') + '</pre>',
      '</section>',
      callRenderer(options.renderActions, model)
    ].join('');
  }

  function renderInspectorIntro(node) {
    return [
      '<section class="object-canvas-inspector-card">',
      '<div class="template-eyebrow">' + escapeHtml(node.label || t('objectCanvas.inspect', 'Inspect')) + '</div>',
      '<h3>' + escapeHtml(node.title || '') + '</h3>',
      '<p>' + escapeHtml(node.detail || '') + '</p>',
      '</section>'
    ].join('');
  }

  function canvasGraphForModel(model, state) {
    const workspace = state.workspace || workspaceForTemplate(state.mode === 'existing' ? 'existing' : state.template || model.template || 'event');
    const graphs = global.ProjectMapAuthoringSurfaceGraphs;
    if (graphs && typeof graphs.buildGraph === 'function') {
      return graphs.buildGraph(model, {
        workspace,
        nodePositions: state.nodePositions || {},
        draftBranches: state.draftBranches || []
      });
    }
    return {title: '', width: 1, height: 1, nodes: [], edges: [], nodeByKey: {}, workspace};
  }

  function renderContextBoard(board) {
    return [
      '<section class="object-canvas-board" data-object-canvas-context="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('objectCanvas.contextEyebrow', 'Context board')) + '</div>',
      '<h3>' + escapeHtml(t('objectCanvas.contextTitle', 'Related state')) + '</h3>',
      renderBoardGroup(t('objectCanvas.group.flow', 'Flow'), board.flow, renderFlowRow),
      renderBoardGroup(t('editing.group.variables', 'Variables touched'), board.variables, renderVariableRow),
      renderBoardGroup(t('editing.group.effects', 'Effects'), board.effects, renderEffectRow),
      renderBoardGroup(t('editing.group.sourceEvidence', 'Source evidence'), board.sourceEvidence, renderSourceRow),
      renderBoardGroup(t('editing.group.manualBoundaries', 'Manual-review boundaries'), board.manualBoundaries, renderBoundaryRow),
      '</section>'
    ].join('');
  }

  function renderBoardGroup(title, rows, renderRow) {
    const items = Array.isArray(rows) ? rows : [];
    return [
      '<details class="object-canvas-board-group" open>',
      '<summary><span>' + escapeHtml(title) + '</span><b>' + items.length + '</b></summary>',
      items.length ? items.slice(0, 12).map(renderRow).join('') : '<p class="editing-empty">' + escapeHtml(t('editing.noContextRows', 'No rows in this context group.')) + '</p>',
      '</details>'
    ].join('');
  }

  function renderFlowRow(row) {
    return '<article class="object-canvas-context-row"><strong>' + escapeHtml(row.label || '') + '</strong><span>' + escapeHtml([row.direction, row.detail].filter(Boolean).join(' / ')) + '</span></article>';
  }

  function renderVariableRow(row) {
    return '<article class="object-canvas-context-row"><strong>Q.' + escapeHtml(row.name || '') + '</strong><span>' + escapeHtml([row.readCount + ' ' + t('editing.reads', 'reads'), row.writeCount + ' ' + t('editing.writes', 'writes')].join(' / ')) + '</span></article>';
  }

  function renderEffectRow(row) {
    return '<article class="object-canvas-context-row"><strong>Q.' + escapeHtml(row.variable || '') + '</strong><span>' + escapeHtml([row.op, row.value, sourceLabel(row.source)].filter(Boolean).join(' ')) + '</span></article>';
  }

  function renderSourceRow(row) {
    const line = row.line || row.startLine || '';
    return '<article class="object-canvas-context-row"><strong>' + escapeHtml(row.label || 'source') + '</strong><span>' + escapeHtml((row.path || '') + (line ? ':' + line : '')) + '</span></article>';
  }

  function renderBoundaryRow(row) {
    return '<article class="object-canvas-context-row"><strong>' + escapeHtml(row.label || '') + '</strong><span>' + escapeHtml(row.reason || '') + '</span></article>';
  }

  function renderEventBody(body) {
    return [
      '<section class="object-event-body" data-object-canvas-event-body="true">',
      '<div class="template-eyebrow">' + escapeHtml(body.bodyEyebrow || t('objectCanvas.eventEyebrow', 'Event body')) + '</div>',
      renderTitleField(body),
      renderSections(body.sections || []),
      renderOptions(body.options || [], body.optionsLabel),
      renderMetaFields(body.metaFields || [], body.metaLabel),
      '</section>'
    ].join('');
  }

  function renderTitleField(body) {
    const title = body.title || {};
    const heading = body.heading || null;
    return [
      '<div class="object-event-title-block">',
      renderInlineField(title, {element: 'input', titleClass: true}),
      heading ? renderInlineField(heading, {element: 'input'}) : '',
      '</div>'
    ].join('');
  }

  function renderSections(sections) {
    const items = Array.isArray(sections) ? sections : [];
    return [
      '<div class="object-event-sections">',
      items.length ? items.map((field) => renderInlineField(field, {element: 'textarea'})).join('') : '<p class="editing-empty">' + escapeHtml(t('objectCanvas.noBodyFields', 'No player-facing body fields are available yet.')) + '</p>',
      '</div>'
    ].join('');
  }

  function renderOptions(options, label) {
    const items = Array.isArray(options) ? options : [];
    return [
      '<section class="object-event-options">',
      '<h3>' + escapeHtml(label || t('existingScene.options', 'Options')) + '</h3>',
      items.length ? items.map(renderOption).join('') : '<p class="editing-empty">' + escapeHtml(t('objectCanvas.noOptions', 'No options found for this object.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderOption(option, index) {
    const fields = Array.isArray(option.fields) ? option.fields : [];
    return [
      '<article class="object-event-option">',
      '<div class="object-event-option-index">' + escapeHtml(String(index + 1)) + '</div>',
      '<div class="object-event-option-fields">',
      fields.length ? fields.map((field) => renderInlineField(field, {element: field.id && field.id.endsWith('.body') ? 'textarea' : 'input'})).join('') : '<strong>' + escapeHtml(option.label || option.id || '') + '</strong>',
      option.targetId ? '<small>' + escapeHtml(t('objectCanvas.optionTarget', 'Target') + ': ' + option.targetId) + '</small>' : '',
      '</div>',
      '</article>'
    ].join('');
  }

  function renderMetaFields(fields, label) {
    const items = Array.isArray(fields) ? fields : [];
    if (!items.length) {
      return '';
    }
    return [
      '<details class="object-event-meta">',
      '<summary>' + escapeHtml(label || t('objectCanvas.advancedFields', 'Timing and advanced fields')) + '</summary>',
      '<div class="object-event-meta-grid">',
      items.map((field) => renderInlineField(field, {element: 'input'})).join(''),
      '</div>',
      '</details>'
    ].join('');
  }

  function renderInlineField(field, options) {
    const value = String(field && field.value !== undefined ? field.value : field && field.original || '');
    const id = field && field.id || '';
    const readOnly = field && (field.readOnly || !id);
    const element = options && options.element === 'input' ? 'input' : 'textarea';
    const className = options && options.titleClass ? ' object-field-title' : '';
    const common = ' class="object-inline-input' + className + '" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '"' + (readOnly ? ' readonly' : '');
    return [
      '<label class="object-inline-field object-inline-field-' + escapeAttr(field && field.status || 'review') + '">',
      '<span>' + escapeHtml(field && field.label || id || '') + '</span>',
      element === 'input'
        ? '<input type="text"' + common + ' value="' + escapeAttr(value) + '">'
        : '<textarea rows="' + rowsFor(value) + '"' + common + '>' + escapeHtml(value) + '</textarea>',
      '<small>' + escapeHtml([statusLabel(field && field.status), sourceLabel(field && field.source)].filter(Boolean).join(' / ')) + '</small>',
      '</label>'
    ].join('');
  }

  function workspaceForTemplate(template) {
    const registry = global.ProjectMapAuthoringSurfaceRegistry;
    if (registry && typeof registry.workspaceForTemplate === 'function') {
      return registry.workspaceForTemplate(template);
    }
    const key = String(template || '');
    if (key === 'entry' || key === 'play_surface' || key === 'workspace_layout' || key === 'sidebar_status' || key === 'project') {
      return 'system_ui';
    }
    return key === 'variables' ? 'project_state' : 'content';
  }

  function callRenderer(fn, model) {
    return typeof fn === 'function' ? fn(model) : '';
  }

  function rowsFor(value) {
    const lines = String(value || '').split('\n').length;
    return String(Math.max(3, Math.min(12, lines + 1)));
  }

  function statusLabel(status) {
    const value = String(status || '');
    if (value === 'guarded') {
      return t('editing.status.guarded', 'guarded apply');
    }
    if (value === 'manual') {
      return t('editing.status.manual', 'manual review');
    }
    if (value === 'read_only') {
      return t('editing.status.readOnly', 'read-only');
    }
    return value;
  }

  function sourceLabel(source) {
    const ref = source && typeof source === 'object' ? source : {};
    return ref.path ? ref.path + (ref.line ? ':' + ref.line : '') : '';
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
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

  const api = {render};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectCanvasGraphStage = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
