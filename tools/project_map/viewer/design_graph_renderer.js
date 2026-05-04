(function initProjectMapDesignGraphRenderer(root) {
  'use strict';

  function ProjectMapDesignGraphRenderer(ctx) {
    ctx = ctx || {};
    const global = ctx.global || root;
    const state = ctx.state;
    let elements = null;
    const {
      NODE_HALF,
      NODE_EDGE_Y,
      MIN_ZOOM,
      MAX_ZOOM,
      t,
      kindLabel,
      badge,
      escapeHtml,
      escapeAttr
    } = ctx;

    function setElements(nextElements) {
      elements = nextElements;
    }

  function renderGraphCanvas(model, filteredItems) {
    updateViewTabs();
    if (elements.graphCanvas) {
      elements.graphCanvas.dataset.view = state.view;
    }
    if (!filteredItems.length) {
      if (elements.graphEdges) {
        elements.graphEdges.innerHTML = '';
      }
      elements.board.innerHTML = '<div class="empty-state">' + escapeHtml(t('design.noMatches', 'No graph nodes match the current filters.')) + '</div>';
      return;
    }
    if (state.view === 'list') {
      resetGraphViewportForDocumentView();
      renderListCanvas(filteredItems);
      return;
    }
    if (state.view === 'timeline') {
      resetGraphViewportForDocumentView();
      renderTimelineCanvas(filteredItems);
      return;
    }
    const graph = model.graph || {nodes: [], edges: [], width: 1320, height: 620};
    const allowed = new Set(filteredItems.map((item) => item.key));
    const nodes = applyStoredNodePositions(layoutGraphNodes(graph.nodes.filter((node) => allowed.has(node.key))));
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const edges = graph.edges.filter((edge) => {
      if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) {
        return false;
      }
      if (!edge.hiddenByDefault) {
        return true;
      }
      return state.scope === 'focus' && (edge.fromKey === state.selectedKey || edge.toKey === state.selectedKey);
    });
    const width = state.scope === 'focus' ? 1380 : (graph.width || 1640);
    const height = state.scope === 'focus'
      ? Math.max(620, nodes.reduce((value, node) => Math.max(value, Number(node.y || 0) + 170), 0))
      : (graph.height || 620);
    if (elements.graphCanvas) {
      elements.graphCanvas.style.setProperty('--design-graph-width', width + 'px');
      elements.graphCanvas.style.setProperty('--design-graph-height', height + 'px');
    }
    if (elements.graphEdges) {
      elements.graphEdges.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      elements.graphEdges.style.width = width + 'px';
      elements.graphEdges.style.height = height + 'px';
      elements.graphEdges.innerHTML = graphEdgeDefs() + edges.map((edge, index) => renderGraphEdge(edge, nodeById, index)).join('');
    }
    elements.board.className = 'design-flow-board is-graph-view';
    elements.board.style.width = width + 'px';
    elements.board.style.height = height + 'px';
    elements.board.innerHTML = nodes.map(renderGraphNode).join('');
    applyViewport();
  }

  function updateViewTabs() {
    if (!elements || !elements.viewTabs) {
      return;
    }
    elements.viewTabs.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.designView === state.view);
      button.setAttribute('aria-pressed', button.dataset.designView === state.view ? 'true' : 'false');
    });
  }

  function renderListCanvas(items) {
    clearGraphEdges();
    setBoardSurface(items.length);
    elements.board.className = 'design-flow-board is-list-view';
    elements.board.innerHTML = [
      '<div class="design-view-help">' + escapeHtml(t('design.listHelp', 'List view shows the same filtered Design items in a readable order. Select an item to inspect or edit it.')) + '</div>',
      items.map(renderListItem).join('')
    ].join('');
  }

  function renderTimelineCanvas(items) {
    clearGraphEdges();
    setBoardSurface(items.length);
    const sorted = items.slice().sort((a, b) => {
      return Number(a.schedule && a.schedule.year || 9999) - Number(b.schedule && b.schedule.year || 9999) ||
        Number(a.schedule && a.schedule.monthStart || 99) - Number(b.schedule && b.schedule.monthStart || 99) ||
        String(a.title || '').localeCompare(String(b.title || ''));
    });
    elements.board.className = 'design-flow-board is-timeline-view';
    elements.board.innerHTML = [
      '<div class="design-view-help">' + escapeHtml(t('design.timelineHelp', 'Timeline view orders player-facing beats by year and month. Undated items stay at the end.')) + '</div>',
      sorted.map(renderListItem).join('')
    ].join('');
  }

  function clearGraphEdges() {
    if (elements.graphEdges) {
      elements.graphEdges.innerHTML = '';
      elements.graphEdges.style.width = '100%';
      elements.graphEdges.style.height = '100%';
    }
    if (elements.graphCanvas) {
      elements.graphCanvas.dataset.view = state.view;
    }
  }

  function setBoardSurface(count) {
    const height = Math.max(620, count * 92 + 90);
    if (elements.graphCanvas) {
      elements.graphCanvas.style.setProperty('--design-graph-width', '100%');
      elements.graphCanvas.style.setProperty('--design-graph-height', height + 'px');
    }
    elements.board.style.width = '100%';
    elements.board.style.height = 'auto';
    elements.board.style.transform = '';
  }

  function resetGraphViewportForDocumentView() {
    if (elements.graphEdges) {
      elements.graphEdges.style.transform = '';
    }
    if (elements.zoomLabel) {
      elements.zoomLabel.textContent = '';
    }
  }

  function applyViewport() {
    if (!elements || !elements.board || !elements.graphEdges) {
      return;
    }
    const scale = clamp(Number(state.viewport.scale) || 1, MIN_ZOOM, MAX_ZOOM);
    state.viewport.scale = scale;
    const transform = 'translate(' + Math.round(state.viewport.x) + 'px, ' + Math.round(state.viewport.y) + 'px) scale(' + scale.toFixed(3) + ')';
    elements.board.style.transform = transform;
    elements.graphEdges.style.transform = transform;
    elements.board.style.transformOrigin = '0 0';
    elements.graphEdges.style.transformOrigin = '0 0';
    if (elements.zoomLabel) {
      elements.zoomLabel.textContent = Math.round(scale * 100) + '%';
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function renderListItem(item) {
    const selected = item.key === state.selectedKey ? ' is-selected' : '';
    const support = global.ProjectMapDesignModel.designItemDraftSupport(item);
    const source = item.source || {};
    const diagnostics = item.diagnostics && item.diagnostics.length ? item.diagnostics[0].severity || 'info' : '';
    return '<button class="design-list-item' + selected + '" type="button" data-design-key="' + escapeAttr(item.key) + '">' +
      '<span class="design-list-kind">' + escapeHtml(kindLabel(item.kind || 'item')) + '</span>' +
      '<strong>' + escapeHtml(item.title || '(untitled)') + '</strong>' +
      '<small>' + escapeHtml([item.subtitle, source.path].filter(Boolean).join(' · ')) + '</small>' +
      '<span class="design-node-meta">' +
        (item.monthlyPopup ? badge(t('design.monthlyPopupBadge', 'Monthly popup'), 'info') : '') +
        badge(item.compareStatus || 'unknown', 'compare-' + (item.compareStatus || 'unknown')) +
        badge(item.confidence || 'opaque', item.confidence || 'opaque') +
        (diagnostics ? badge(diagnostics, diagnostics) : '') +
        (support.supported ? badge('draft', 'info') : badge('manual', 'warning')) +
      '</span>' +
      '</button>';
  }

  function layoutGraphNodes(nodes) {
    if (state.scope !== 'focus' || !state.selectedKey) {
      return nodes;
    }
    const selected = nodes.find((node) => node.key === state.selectedKey);
    if (!selected) {
      return nodes;
    }
    const graph = state.designModel && state.designModel.graph ? state.designModel.graph : {edges: []};
    const directions = new Map();
    graph.edges.forEach((edge) => {
      if (edge.fromKey === state.selectedKey) {
        directions.set(edge.toKey, 'outgoing');
      } else if (edge.toKey === state.selectedKey) {
        directions.set(edge.fromKey, 'incoming');
      }
    });
    const buckets = {
      incoming: [],
      selected: [selected],
      outgoing: [],
      related: []
    };
    nodes.forEach((node) => {
      if (node.key === state.selectedKey) {
        return;
      }
      const direction = directions.get(node.key);
      if (direction === 'incoming') {
        buckets.incoming.push(node);
      } else if (direction === 'outgoing') {
        buckets.outgoing.push(node);
      } else {
        buckets.related.push(node);
      }
    });
    const placed = [];
    placeBucket(buckets.incoming, 260, 130, placed);
    placeBucket(buckets.selected, 690, Math.max(160, 130 + Math.max(0, buckets.incoming.length - 1) * 62), placed);
    placeBucket(buckets.outgoing, 1120, 130, placed);
    placeBucket(buckets.related, 690, Math.max(440, 280 + Math.max(buckets.incoming.length, buckets.outgoing.length) * 176), placed);
    return placed;
  }

  function placeBucket(nodes, x, y, placed) {
    nodes.forEach((node, index) => {
      placed.push(Object.assign({}, node, {
        x,
        y: y + index * 184
      }));
    });
  }

  function applyStoredNodePositions(nodes) {
    return nodes.map((node) => {
      const position = state.nodePositions[node.key];
      if (!position) {
        return node;
      }
      return Object.assign({}, node, {
        x: Number(position.x) || node.x,
        y: Number(position.y) || node.y
      });
    });
  }

  function renderGraphNode(node) {
    const item = node.item || {};
    const selected = item.key === state.selectedKey ? ' is-selected' : '';
    const missing = item.present === false ? ' is-missing' : '';
    const support = global.ProjectMapDesignModel.designItemDraftSupport(item);
    const source = item.source || {};
    const diagnostics = item.diagnostics && item.diagnostics.length ? item.diagnostics[0].severity || 'info' : '';
    const style = 'left:' + Math.max(0, (node.x || 0) - NODE_HALF) + 'px;top:' + Math.max(0, node.y || 0) + 'px;';
    return '<button class="design-node' + selected + missing + '" style="' + escapeAttr(style) + '" type="button" data-design-key="' + escapeAttr(item.key) + '">' +
      '<span class="design-node-kicker"><b class="dot ' + escapeAttr(item.confidence || 'opaque') + '"></b>' + escapeHtml(kindLabel(item.kind || node.kind || 'item')) + '</span>' +
      '<span class="design-node-title">' + escapeHtml(item.title) + '</span>' +
      '<span class="design-node-subtitle">' + escapeHtml(item.subtitle || item.detail || (source.path ? source.path : '')) + '</span>' +
      '<span class="design-node-meta">' +
        badge(kindLabel(item.kind), '') +
        (item.monthlyPopup ? badge(t('design.monthlyPopupBadge', 'Monthly popup'), 'info') : '') +
        badge(item.compareStatus || 'unknown', 'compare-' + (item.compareStatus || 'unknown')) +
        (diagnostics ? badge(diagnostics, diagnostics) : '') +
        (support.supported ? badge('draft', 'info') : badge('manual', 'warning')) +
      '</span>' +
      '</button>';
  }

  function renderGraphEdge(edge, nodeById, index) {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to || from.key === to.key) {
      return '';
    }
    const fromX = Number(from.x || 0);
    const fromY = Number(from.y || 0);
    const toX = Number(to.x || 0);
    const toY = Number(to.y || 0);
    if (Math.abs(toX - fromX) < NODE_HALF * 0.75) {
      const direction = toY >= fromY ? 1 : -1;
      const x = fromX;
      const y1 = fromY + (direction > 0 ? 142 : 0);
      const y2 = toY + (direction > 0 ? 0 : 142);
      const midY = y1 + (y2 - y1) * 0.5;
      const xBend = x + (((index % 5) - 2) * 18);
      const selected = from.key === state.selectedKey || to.key === state.selectedKey ? ' is-selected' : '';
      const verticalPath = 'M ' + x + ' ' + y1 +
        ' C ' + xBend + ' ' + midY +
        ', ' + xBend + ' ' + midY +
        ', ' + x + ' ' + y2;
      return '<path class="' + selected.trim() + '" d="' + escapeAttr(verticalPath) + '" data-design-edge-id="' + escapeAttr(edge.id) + '" marker-end="url(#design-edge-arrow)"></path>';
    }
    const goesRight = Number(to.x || 0) >= Number(from.x || 0);
    const x1 = Number(from.x || 0) + (goesRight ? NODE_HALF : -NODE_HALF);
    const y1 = Number(from.y || 0) + NODE_EDGE_Y;
    const x2 = Number(to.x || 0) + (goesRight ? -NODE_HALF : NODE_HALF);
    const y2 = Number(to.y || 0) + NODE_EDGE_Y;
    const mid = Math.max(54, Math.abs(x2 - x1) * 0.35);
    const bend = ((index % 7) - 3) * 18;
    const selected = from.key === state.selectedKey || to.key === state.selectedKey ? ' is-selected' : '';
    const direction = goesRight ? 1 : -1;
    const path = 'M ' + x1 + ' ' + y1 +
      ' C ' + (x1 + direction * mid) + ' ' + (y1 + bend) +
      ', ' + (x2 - direction * mid) + ' ' + (y2 - bend) +
      ', ' + x2 + ' ' + y2;
    return '<path class="' + selected.trim() + '" d="' + escapeAttr(path) + '" data-design-edge-id="' + escapeAttr(edge.id) + '" marker-end="url(#design-edge-arrow)"></path>';
  }

  function graphEdgeDefs() {
    return '<defs><marker id="design-edge-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" fill="#d97a4a"></path>' +
      '</marker></defs>';
  }


    return {
      setElements,
      renderGraphCanvas,
      updateViewTabs,
      renderListCanvas,
      renderTimelineCanvas,
      clearGraphEdges,
      setBoardSurface,
      resetGraphViewportForDocumentView,
      applyViewport,
      clamp,
      renderListItem,
      layoutGraphNodes,
      placeBucket,
      applyStoredNodePositions,
      renderGraphNode,
      renderGraphEdge,
      graphEdgeDefs
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectMapDesignGraphRenderer;
  }

  if (root) {
    root.ProjectMapDesignGraphRenderer = ProjectMapDesignGraphRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
