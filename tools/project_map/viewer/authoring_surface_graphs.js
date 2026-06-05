(function initProjectMapAuthoringSurfaceGraphs(global) {
  'use strict';

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const ensureArray = domTextUtils.ensureArray;

  function buildGraph(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const workspace = opts.workspace || 'content';
    const metrics = graphMetrics(model);
    const builders = {
      content: contentGraphNodes,
      system_ui: systemUiGraphNodes,
      project_state: projectStateGraphNodes
    };
    const graph = (builders[workspace] || contentGraphNodes)(model || {}, metrics, opts);
    const positions = opts.nodePositions || {};
    const nodeByKey = {};
    graph.nodes.forEach((node) => {
      const moved = positions[node.key] || null;
      if (moved) {
        node.x = Number(moved.x || node.x || 0);
        node.y = Number(moved.y || node.y || 0);
      }
      nodeByKey[node.key] = node;
    });
    return Object.assign({}, graph, {workspace, nodeByKey});
  }

  function graphMetrics(model) {
    const board = model.contextBoard || {};
    const change = model.changeState || {};
    const summary = change.operationSummary || {};
    const operationCount = Number(summary.total || 0) ||
      Number(summary.safeApply || 0) +
      Number(summary.guardedApply || 0) +
      Number(summary.advancedApply || 0) +
      Number(summary.manualReview || 0) +
      Number(summary.refused || 0);
    return {
      contextCount: countRows(board.flow) + countRows(board.variables) + countRows(board.effects) + countRows(board.sourceEvidence) + countRows(board.manualBoundaries),
      flowCount: countRows(board.flow),
      variableCount: countRows(board.variables),
      effectCount: countRows(board.effects),
      sourceCount: countRows(board.sourceEvidence),
      boundaryCount: countRows(board.manualBoundaries),
      changedCount: Number(change.changedCount || 0),
      operationCount,
      manualCount: Number(summary.manualReview || 0) + Number(summary.refused || 0),
      guardedCount: Number(summary.guardedApply || 0)
    };
  }

  function contentGraphNodes(model, metrics, options) {
    const nodes = [
      graphNode('source', 'source', t('objectCanvas.graph.source.label', 'Source'), t('objectCanvas.graph.source.title', 'Source evidence'), metrics.sourceCount + ' ' + t('editing.group.sourceEvidence', 'Source evidence'), 40, 86, 'context'),
      graphNode('context', 'context', t('objectCanvas.stage.context.label', 'Context'), t('objectCanvas.stage.context.title', 'Related state'), metrics.contextCount + ' ' + t('objectCanvas.stage.context.detail', 'context rows'), 292, 40, 'context'),
      graphNode('object', 'object', t('objectCanvas.stage.object.label', 'Object'), model.title || model.objectId || t('objectCanvas.titleFallback', 'Author object'), metrics.changedCount + ' ' + t('objectCanvas.stage.object.detail', 'edited fields'), 544, 126, 'object'),
      graphNode('routes', 'routes', t('objectCanvas.graph.routes.label', 'Routes'), t('objectCanvas.graph.routes.title', 'Flow and choices'), metrics.flowCount + ' ' + t('objectCanvas.group.flow', 'Flow'), 804, 50, 'context'),
      graphNode('state', 'state', t('objectCanvas.graph.state.label', 'State'), t('editing.group.variables', 'Variables touched'), metrics.variableCount + ' / ' + metrics.effectCount + ' ' + t('editing.group.effects', 'Effects'), 804, 246, 'context'),
      graphNode('plan', 'plan', t('objectCanvas.stage.plan.label', 'Plan'), metrics.operationCount + ' ' + t('objectCanvas.stage.plan.title', 'operations'), metrics.guardedCount + ' ' + t('editing.summary.guarded', 'Guarded') + ' / ' + metrics.manualCount + ' ' + t('editing.summary.manual', 'Manual'), 1068, 88, 'plan'),
      graphNode('review', 'review', t('objectCanvas.stage.review.label', 'Review'), t('objectCanvas.stage.review.title', 'Review & Apply'), t('objectCanvas.stage.review.detail', 'Open the final safety workspace'), 1068, 268, 'review')
    ];
    const edges = [
      {from: 'source', to: 'object'},
      {from: 'context', to: 'object'},
      {from: 'object', to: 'routes'},
      {from: 'object', to: 'state'},
      {from: 'routes', to: 'plan'},
      {from: 'state', to: 'plan'},
      {from: 'plan', to: 'review'}
    ];
    ensureArray(options.draftBranches).slice(0, 6).forEach((draft, index) => {
      const key = 'draft:' + (draft.id || index);
      nodes.push(graphNode(key, 'draft', draft.label || t('objectCanvas.branch.label', 'Draft'), draft.title || draft.id || t('objectCanvas.branch.title', 'New branch'), draft.detail || '', 544 + (index % 3) * 260, 328 + Math.floor(index / 3) * 142, 'draft'));
      edges.push({from: 'object', to: key});
    });
    return {title: t('authoring.workspace.content', 'Content Authoring'), width: 1460, height: 660, nodes, edges};
  }

  function systemUiGraphNodes(model, metrics) {
    const nodes = [
      graphNode('entry', 'source', t('objectCanvas.graph.entry.label', 'Entry'), t('objectCanvas.graph.entry.title', 'Entry point'), metrics.flowCount + ' ' + t('objectCanvas.group.flow', 'Flow'), 40, 92, 'context'),
      graphNode('layout', 'context', t('objectCanvas.graph.layout.label', 'Layout'), t('objectCanvas.graph.layout.title', 'Workspace structure'), metrics.contextCount + ' ' + t('objectCanvas.stage.context.detail', 'context rows'), 292, 44, 'context'),
      graphNode('object', 'object', t('authoring.workspace.systemUi', 'System UI Authoring'), model.title || model.objectId || t('objectCanvas.titleFallback', 'Author object'), metrics.changedCount + ' ' + t('objectCanvas.stage.object.detail', 'edited fields'), 544, 126, 'object'),
      graphNode('sidebar', 'state', t('objectCanvas.graph.sidebar.label', 'Sidebar'), t('objectCanvas.graph.sidebar.title', 'Sidebar and status'), metrics.variableCount + ' ' + t('editing.group.variables', 'Variables touched'), 804, 50, 'context'),
      graphNode('preview', 'routes', t('objectCanvas.graph.preview.label', 'Preview'), t('objectCanvas.preview', 'Player-facing preview'), metrics.sourceCount + ' ' + t('editing.group.sourceEvidence', 'Source evidence'), 804, 246, 'context'),
      graphNode('plan', 'plan', t('objectCanvas.stage.plan.label', 'Plan'), metrics.operationCount + ' ' + t('objectCanvas.stage.plan.title', 'operations'), metrics.guardedCount + ' ' + t('editing.summary.guarded', 'Guarded') + ' / ' + metrics.manualCount + ' ' + t('editing.summary.manual', 'Manual'), 1068, 88, 'plan'),
      graphNode('review', 'review', t('objectCanvas.stage.review.label', 'Review'), t('objectCanvas.stage.review.title', 'Review & Apply'), t('objectCanvas.stage.review.detail', 'Open the final safety workspace'), 1068, 268, 'review')
    ];
    return {
      title: t('authoring.workspace.systemUi', 'System UI Authoring'),
      width: 1360,
      height: 480,
      nodes,
      edges: [
        {from: 'entry', to: 'object'},
        {from: 'layout', to: 'object'},
        {from: 'object', to: 'sidebar'},
        {from: 'object', to: 'preview'},
        {from: 'sidebar', to: 'plan'},
        {from: 'preview', to: 'plan'},
        {from: 'plan', to: 'review'}
      ]
    };
  }

  function projectStateGraphNodes(model, metrics) {
    const nodes = [
      graphNode('evidence', 'source', t('objectCanvas.graph.evidence.label', 'Evidence'), t('editing.group.sourceEvidence', 'Source evidence'), metrics.sourceCount + ' ' + t('editing.group.sourceEvidence', 'Source evidence'), 40, 92, 'context'),
      graphNode('project', 'context', t('objectCanvas.graph.project.label', 'Project'), t('authoring.workspace.projectState', 'Project State'), metrics.contextCount + ' ' + t('objectCanvas.stage.context.detail', 'context rows'), 292, 44, 'context'),
      graphNode('object', 'object', t('objectCanvas.graph.variable.label', 'State object'), model.title || model.objectId || t('objectCanvas.titleFallback', 'Author object'), metrics.changedCount + ' ' + t('objectCanvas.stage.object.detail', 'edited fields'), 544, 126, 'object'),
      graphNode('init', 'state', t('objectCanvas.graph.init.label', 'Initialization'), t('objectCanvas.graph.init.title', 'Root and defaults'), metrics.variableCount + ' ' + t('editing.group.variables', 'Variables touched'), 804, 50, 'context'),
      graphNode('consumers', 'routes', t('objectCanvas.graph.consumers.label', 'Consumers'), t('objectCanvas.graph.consumers.title', 'Where state is read'), metrics.effectCount + ' ' + t('editing.group.effects', 'Effects'), 804, 246, 'context'),
      graphNode('plan', 'plan', t('objectCanvas.stage.plan.label', 'Plan'), metrics.operationCount + ' ' + t('objectCanvas.stage.plan.title', 'operations'), metrics.guardedCount + ' ' + t('editing.summary.guarded', 'Guarded') + ' / ' + metrics.manualCount + ' ' + t('editing.summary.manual', 'Manual'), 1068, 88, 'plan'),
      graphNode('review', 'review', t('objectCanvas.stage.review.label', 'Review'), t('objectCanvas.stage.review.title', 'Review & Apply'), t('objectCanvas.stage.review.detail', 'Open the final safety workspace'), 1068, 268, 'review')
    ];
    return {
      title: t('authoring.workspace.projectState', 'Project State'),
      width: 1360,
      height: 480,
      nodes,
      edges: [
        {from: 'evidence', to: 'object'},
        {from: 'project', to: 'object'},
        {from: 'object', to: 'init'},
        {from: 'object', to: 'consumers'},
        {from: 'init', to: 'plan'},
        {from: 'consumers', to: 'plan'},
        {from: 'plan', to: 'review'}
      ]
    };
  }

  function graphNode(key, kind, label, title, detail, x, y, panel) {
    return {key, kind, label, title, detail, x, y, panel};
  }

  function countRows(rows) {
    return Array.isArray(rows) ? rows.length : 0;
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  const api = {buildGraph};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapAuthoringSurfaceGraphs = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
