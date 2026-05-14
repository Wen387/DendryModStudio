(function initProjectMapPreviewObjectEventBuilder(global) {
  'use strict';

  const api = {
    renderAssetReferenceEditor,
    renderEventGraphSummary,
    renderEventReadiness
  };

  if (global) {
    global.ProjectMapPreviewObjectEventBuilder = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  function renderAssetReferenceEditor(assets) {
    const rows = ensureArray(assets).filter((asset) => asset && (asset.path || asset.label || asset.name));
    if (!rows.length) {
      return '';
    }
    return [
      '<section class="preview-object-assets" data-preview-object-assets="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.assets', 'Referenced assets')) + '</div>',
      rows.map((asset) => [
        '<article>',
        '<strong>' + escapeHtml(asset.label || asset.name || asset.path || t('previewObjectEditor.asset', 'Asset')) + '</strong>',
        asset.role || asset.type ? '<small>' + escapeHtml([asset.role, asset.type].filter(Boolean).join(' / ')) + '</small>' : '',
        asset.path ? '<code>' + escapeHtml(asset.path) + '</code>' : '',
        asset.referenceState && asset.referenceState.help ? '<small>' + escapeHtml(asset.referenceState.help) + '</small>' : '',
        '</article>'
      ].join('')).join(''),
      '</section>'
    ].join('');
  }

  function renderEventGraphSummary(graph) {
    if (!graph || !ensureArray(graph.nodes).length) {
      return '';
    }
    const nodes = ensureArray(graph.nodes);
    const edges = ensureArray(graph.edges);
    return [
      '<section class="preview-object-event-graph" data-preview-object-event-graph="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.eventGraph', 'Event graph')) + '</div>',
      '<div class="preview-object-event-graph-row">',
      '<strong>' + escapeHtml(String(graph.nodeCount || nodes.length)) + '</strong><span>' + escapeHtml(t('previewObjectEditor.graphNodes', 'nodes')) + '</span>',
      '<strong>' + escapeHtml(String(graph.edgeCount || edges.length)) + '</strong><span>' + escapeHtml(t('previewObjectEditor.graphRoutes', 'routes')) + '</span>',
      '</div>',
      '<div class="preview-object-event-graph-grid" data-workflow-entry="event_graph_node">',
      nodes.map(renderEventGraphNode).join(''),
      '</div>',
      edges.length ? '<div class="preview-object-event-graph-routes" data-workflow-entry="event_graph_edge">' + edges.map(renderEventGraphEdge).join('') + '</div>' : '',
      '</section>'
    ].join('');
  }

  function renderEventReadiness(items) {
    const rows = ensureArray(items);
    if (!rows.length) {
      return '';
    }
    return [
      '<section class="preview-object-readiness" data-preview-object-readiness="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.installReadiness', 'Install readiness')) + '</div>',
      rows.map((item) => [
        '<article class="preview-object-readiness-item ' + (item && item.ok ? 'is-ready' : 'is-blocked') + '">',
        '<strong>' + escapeHtml(item && item.ok ? t('previewObjectEditor.ready', 'Ready') : t('previewObjectEditor.blocked', 'Blocked')) + '</strong>',
        '<span>' + escapeHtml(item && item.label || '') + '</span>',
        item && !item.ok && item.repairAction ? '<button type="button" class="preview-object-readiness-repair" data-readiness-repair-action="' + escapeAttr(item.id || '') + '" data-visible-edit-action="' + escapeAttr(encodeAction(item.repairAction)) + '" aria-label="' + escapeAttr(t('previewObjectEditor.fixReadinessAria', 'Fix this blocked checklist item')) + '">' + escapeHtml(t('previewObjectEditor.fixReadiness', 'Fix')) + '</button>' : '',
        '</article>'
      ].join('')).join(''),
      '</section>'
    ].join('');
  }

  function renderEventGraphNode(node) {
    const value = node || {};
    const label = value.label || value.id || t('previewObjectEditor.graphNode', 'Node');
    const kind = graphKindLabel(value.kind);
    const action = graphAction(value.editAction);
    const actionAttrs = action ? ' data-visible-edit-action="' + escapeAttr(encodeAction(action)) + '"' : '';
    const title = t('previewObjectEditor.graphNodeAria', 'Edit event graph node: {label}').replace('{label}', label);
    return [
      '<button type="button" class="preview-object-event-graph-node is-' + escapeAttr(safeClass(value.kind || 'node')) + '" data-preview-object-event-graph-node="' + escapeAttr(value.id || '') + '" data-event-graph-clickable="node"' + actionAttrs + ' aria-label="' + escapeAttr(title) + '" title="' + escapeAttr(title) + '">',
      '<small>' + escapeHtml(kind) + '</small>',
      '<strong>' + escapeHtml(label) + '</strong>',
      value.condition ? '<span>' + escapeHtml(value.condition) + '</span>' : '',
      '</button>'
    ].join('');
  }

  function renderEventGraphEdge(edge) {
    const value = edge || {};
    const label = [
      graphKindLabel(value.kind),
      value.targetId || value.to || ''
    ].filter(Boolean).join(' -> ');
    const action = graphAction(value.editAction);
    const actionAttrs = action ? ' data-visible-edit-action="' + escapeAttr(encodeAction(action)) + '"' : '';
    const title = t('previewObjectEditor.graphRouteAria', 'Edit event graph route: {label}').replace('{label}', label || value.kind || 'route');
    return [
      '<button type="button" class="preview-object-event-graph-edge" data-preview-object-event-graph-edge="' + escapeAttr([value.from, value.to, value.kind].filter(Boolean).join('|')) + '" data-event-graph-clickable="edge"' + actionAttrs + ' aria-label="' + escapeAttr(title) + '" title="' + escapeAttr(title) + '">',
      '<span>' + escapeHtml(value.from || '') + '</span>',
      '<b>' + escapeHtml(graphKindLabel(value.kind)) + '</b>',
      '<span>' + escapeHtml(value.to || value.targetId || '') + '</span>',
      '</button>'
    ].join('');
  }

  function graphAction(action) {
    return action && typeof action === 'object' && action.actionKind ? action : null;
  }

  function graphKindLabel(kind) {
    const value = String(kind || '').trim();
    return {
      opening: t('previewObjectEditor.graphOpening', 'Opening'),
      root_option: t('previewObjectEditor.graphRootOption', 'Root option'),
      section_option: t('previewObjectEditor.graphSectionOption', 'Section option'),
      result_section: t('previewObjectEditor.graphResultSection', 'Result section'),
      follow_up_section: t('previewObjectEditor.graphFollowUpSection', 'Follow-up section'),
      conditional_section: t('previewObjectEditor.graphConditionalSection', 'Conditional section'),
      trigger_effect: t('previewObjectEditor.graphTriggerEffect', 'Trigger effect'),
      option_effect: t('previewObjectEditor.graphOptionEffect', 'Option effect'),
      section_effect: t('previewObjectEditor.graphSectionEffect', 'Section effect'),
      variable: t('previewObjectEditor.graphVariable', 'Variable'),
      choice: t('previewObjectEditor.graphChoice', 'Choice'),
      result_route: t('previewObjectEditor.graphResultRoute', 'Result route'),
      return_route: t('previewObjectEditor.graphReturnRoute', 'Return route'),
      exit_route: t('previewObjectEditor.graphExitRoute', 'Exit route')
    }[value] || value.replace(/_/g, ' ') || t('previewObjectEditor.graphNode', 'Node');
  }

  function encodeAction(action) {
    try {
      return JSON.stringify(action || {});
    } catch (_err) {
      return '{}';
    }
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeClass(value) {
    return String(value || 'item').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
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
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
