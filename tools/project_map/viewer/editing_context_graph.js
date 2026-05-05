(function initProjectMapEditingContextGraph(root) {
  'use strict';

  function createEditingContextGraph(ctx) {
    ctx = ctx || {};
    const t = ctx.t || ((key, fallback) => fallback || key);
    const escapeHtml = ctx.escapeHtml || ((value) => String(value || ''));

    function renderContextGraph(context) {
      const graph = context && context.graph || {nodes: [], edges: []};
      const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
      const edges = Array.isArray(graph.edges) ? graph.edges : [];
      return [
        '<section class="editing-context-graph" data-editing-context-graph="true">',
        '<header>',
        '<div>',
        '<div class="template-eyebrow">' + escapeHtml(t('editing.graphEyebrow', 'Context graph')) + '</div>',
        '<h3>' + escapeHtml(t('editing.graphTitle', 'Scene context')) + '</h3>',
        '</div>',
        '<span>' + escapeHtml(nodes.length + ' ' + t('editing.graphNodes', 'nodes')) + '</span>',
        '</header>',
        '<div class="editing-graph-lanes">',
        renderLane(t('editing.lane.flow', 'Flow'), nodes.filter(isFlowNode), edges),
        renderLane(t('editing.lane.editable', 'Editable'), nodes.filter(isEditorNode), edges),
        renderLane(t('editing.lane.evidence', 'Evidence'), nodes.filter(isEvidenceNode), edges),
        '</div>',
        '</section>'
      ].join('');
    }

    function renderLane(title, nodes, edges) {
      return [
        '<section class="editing-graph-lane">',
        '<h4>' + escapeHtml(title) + '</h4>',
        nodes.length ? nodes.map((node) => renderNode(node, edges)).join('') : '<div class="editing-empty">' + escapeHtml(t('editing.emptyLane', 'No context nodes.')) + '</div>',
        '</section>'
      ].join('');
    }

    function renderNode(node, edges) {
      const relatedEdges = edges.filter((edge) => edge.from === node.id || edge.to === node.id);
      return [
        '<article class="editing-graph-node editing-node-' + escapeHtml(String(node.type || '').replace(/_/g, '-')) + ' editing-status-' + escapeHtml(String(node.status || 'context').replace(/_/g, '-')) + '" data-editing-node="' + escapeHtml(node.id) + '">',
        '<strong>' + escapeHtml(node.label || node.id) + '</strong>',
        node.subtitle ? '<small>' + escapeHtml(node.subtitle) + '</small>' : '',
        relatedEdges.length ? '<span>' + escapeHtml(relatedEdges.map((edge) => edge.label || edge.type).filter(Boolean).slice(0, 2).join(' / ')) + '</span>' : '',
        '</article>'
      ].join('');
    }

    function isFlowNode(node) {
      return ['current_scene', 'incoming', 'outgoing'].includes(String(node && node.type || ''));
    }

    function isEditorNode(node) {
      return ['page_sections', 'option_text', 'conditions', 'player_text'].includes(String(node && node.type || ''));
    }

    function isEvidenceNode(node) {
      return !isFlowNode(node) && !isEditorNode(node);
    }

    return {renderContextGraph};
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createEditingContextGraph;
  }
  if (root) {
    root.ProjectMapEditingContextGraph = createEditingContextGraph;
  }
})(typeof window !== 'undefined' ? window : globalThis);
