(function initProjectMapDesignUi(global) {
  'use strict';

  if (!global || !global.document) {
    return;
  }

  const NODE_WIDTH = 280;
  const NODE_HALF = NODE_WIDTH / 2;
  const NODE_EDGE_Y = 68;
  const HELP_SEEN_KEY = 'dendry-mod-studio-design-help-seen';
  const INSPECTOR_COLLAPSED_KEY = 'dendry-mod-studio-design-inspector-collapsed';
  const MIN_ZOOM = 0.08;
  const MAX_ZOOM = 1.6;
  const INSPECTOR_WIDTH_KEY = 'dendry-mod-studio-design-inspector-width';
  const MIN_INSPECTOR_WIDTH = 280;
  const MAX_INSPECTOR_WIDTH = 680;

  const state = {
    projectModel: null,
    baselineModel: null,
    designModel: null,
    selectedKey: '',
    view: 'graph',
    query: '',
    scope: 'all',
    lane: 'all',
    kind: 'all',
    authoring: 'all',
    severity: 'all',
    compare: 'all',
    nodePositions: Object.create(null),
    viewport: {x: 0, y: 0, scale: 0.82},
    panning: null,
    resizingInspector: null,
    showHelp: false,
    dragging: null,
    suppressNextClick: false,
    pendingDragRender: false,
    designModelStale: false,
    designRevision: 0,
    inspectorCollapsed: false,
    inspectorSections: Object.create(null),
    inspectorCache: {key: '', html: ''}
  };

  let elements = null;

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function currentLocale() {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.getLocale === 'function' ? i18n.getLocale() : 'en';
  }

  function applyI18n(root) {
    const i18n = global && global.ProjectMapI18n;
    if (i18n && typeof i18n.applyTranslations === 'function') {
      i18n.applyTranslations(root || global.document);
    }
  }
  function loadDesignFactory(root, globalName, path) {
    if (root && root[globalName]) {
      return root[globalName];
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      return require(path);
    }
    throw new Error(globalName + ' module is unavailable.');
  }

  const createDesignGraphRenderer = loadDesignFactory(global, 'ProjectMapDesignGraphRenderer', './design_graph_renderer.js');
  const designGraphRenderer = createDesignGraphRenderer({
    global,
    state,
    NODE_HALF,
    NODE_EDGE_Y,
    MIN_ZOOM,
    MAX_ZOOM,
    t,
    kindLabel,
    badge,
    escapeHtml,
    escapeAttr
  });
  const {
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
  } = designGraphRenderer;

  const createDesignInteractions = loadDesignFactory(global, 'ProjectMapDesignInteractions', './design_interactions.js');
  const designInteractions = createDesignInteractions({
    global,
    state,
    NODE_HALF,
    MIN_ZOOM,
    MAX_ZOOM,
    INSPECTOR_WIDTH_KEY,
    MIN_INSPECTOR_WIDTH,
    MAX_INSPECTOR_WIDTH,
    applyViewport,
    clamp,
    render
  });
  const {
    beginNodeDrag,
    moveNodeDrag,
    endNodeDrag,
    cancelNodeDrag,
    beginCanvasPan,
    moveCanvasPan,
    endCanvasPan,
    cancelCanvasPan,
    cancelDesignInteractions,
    readStoredInspectorWidth,
    storeInspectorWidth,
    clampInspectorWidth,
    applyInspectorWidth,
    restoreInspectorWidth,
    currentInspectorWidth,
    beginInspectorResize,
    moveInspectorResize,
    endInspectorResize,
    cancelInspectorResize,
    zoomCanvasWheel,
    zoomCanvas,
    fitCanvas,
    scheduleFitCanvas,
    scheduleDragRender
  } = designInteractions;


  onReady(() => startDesignUi(global.document));

  function onReady(callback) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function readHelpSeen() {
    try {
      return global.localStorage && global.localStorage.getItem(HELP_SEEN_KEY) === '1';
    } catch (err) {
      return false;
    }
  }

  function markHelpSeen() {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(HELP_SEEN_KEY, '1');
      }
    } catch (err) {
      // Help state is cosmetic; restricted storage should not block the Studio.
    }
  }

  function startDesignUi(document) {
    elements = {
      pane: document.getElementById('design-pane'),
      status: document.getElementById('design-status'),
      summary: document.getElementById('design-summary'),
      board: document.getElementById('design-flow-board'),
      graphCanvas: document.getElementById('design-graph-canvas'),
      graphEdges: document.getElementById('design-graph-edges'),
      graphLayout: document.querySelector('.design-graph-layout'),
      inspectorResizer: document.getElementById('design-inspector-resizer'),
      inspector: document.getElementById('design-inspector'),
      inspectorToggle: document.getElementById('design-inspector-toggle'),
      zoomControls: document.querySelector('.design-zoom-controls'),
      search: document.getElementById('design-search'),
      scopeFilter: document.getElementById('design-scope-filter'),
      scopeOptions: Array.from(document.querySelectorAll('[data-design-scope]')),
      laneFilter: document.getElementById('design-lane-filter'),
      kindFilter: document.getElementById('design-kind-filter'),
      authoringFilter: document.getElementById('design-authoring-filter'),
      severityFilter: document.getElementById('design-severity-filter'),
      compareFilter: document.getElementById('design-compare-filter'),
      baselineFile: document.getElementById('design-baseline-file'),
      baselineStatus: document.getElementById('design-baseline-status'),
      projectName: document.getElementById('design-project-name'),
      starter: document.getElementById('design-starter'),
      breadcrumb: document.getElementById('design-breadcrumb'),
      helpToggle: document.getElementById('design-help-toggle'),
      zoomLabel: document.getElementById('design-zoom-label'),
      statusCount: document.getElementById('design-status-count'),
      statusDiagnostics: document.getElementById('design-status-diagnostics'),
      statusSchema: document.getElementById('design-status-schema'),
      showAll: document.getElementById('design-show-all'),
      resetLayout: document.getElementById('design-reset-layout'),
      viewTabs: Array.from(document.querySelectorAll('[data-design-view]'))
    };
    if (!elements.pane) {
      return;
    }
    designGraphRenderer.setElements(elements);
    designInteractions.setElements(elements);
    restoreInspectorWidth();
    state.inspectorCollapsed = readInspectorCollapsed();
    state.showHelp = !readHelpSeen();
    bindControls(document);
    syncInspectorCollapse();
    render();
  }

  function bindControls(document) {
    document.addEventListener('project-map:index-loaded', (event) => {
      state.projectModel = event.detail && event.detail.model ? event.detail.model : null;
      state.selectedKey = '';
      state.designModel = null;
      state.designModelStale = true;
      invalidateInspectorCache();
      if (designModeIsActive()) {
        render();
      }
    });

    document.addEventListener('ProjectMap:mode-changing', (event) => {
      const detail = event && event.detail || {};
      if (detail.previousMode === 'design' && detail.nextMode !== 'design') {
        cancelDesignInteractions();
      }
    });

    document.addEventListener('click', (event) => {
      const modeButton = event.target.closest && event.target.closest('[data-mode="design"]');
      if (!modeButton) {
        return;
      }
      schedule(() => {
        if (designModeIsActive()) {
          render();
        }
      });
    });

    if (elements.search) {
      elements.search.addEventListener('input', () => {
        state.query = elements.search.value;
        render();
      });
    }
    elements.viewTabs.forEach((button) => {
      button.addEventListener('click', () => {
        const nextView = button.dataset.designView || 'graph';
        if (!['graph', 'list', 'timeline'].includes(nextView)) {
          return;
        }
        state.view = nextView;
        render();
      });
    });
    if (elements.scopeOptions && elements.scopeOptions.length) {
      elements.scopeOptions.forEach((button) => {
        button.addEventListener('click', () => {
          state.scope = button.dataset.designScope === 'focus' ? 'focus' : 'all';
          syncScopeControl();
          render();
        });
      });
    } else if (elements.scopeFilter) {
      elements.scopeFilter.addEventListener('change', () => {
        state.scope = elements.scopeFilter.value === 'focus' ? 'focus' : 'all';
        render();
      });
    }
    if (elements.showAll) {
      elements.showAll.addEventListener('click', () => {
        showAllDesignNodes();
      });
    }
    if (elements.helpToggle) {
      elements.helpToggle.addEventListener('click', () => {
        state.showHelp = !state.showHelp;
        if (!state.showHelp) {
          markHelpSeen();
        }
        render();
      });
    }
    if (elements.resetLayout) {
      elements.resetLayout.addEventListener('click', () => {
        state.nodePositions = Object.create(null);
        state.viewport = {x: 0, y: 0, scale: 0.82};
        setDesignStatus(t('design.layoutReset', 'Layout reset. Drag nodes again if you want to arrange a local working view.'));
        render();
      });
    }
    if (elements.laneFilter) {
      elements.laneFilter.addEventListener('change', () => {
        state.lane = elements.laneFilter.value;
        render();
      });
    }
    if (elements.kindFilter) {
      elements.kindFilter.addEventListener('change', () => {
        state.kind = elements.kindFilter.value;
        render();
      });
    }
    if (elements.authoringFilter) {
      elements.authoringFilter.addEventListener('change', () => {
        state.authoring = elements.authoringFilter.value;
        render();
      });
    }
    if (elements.severityFilter) {
      elements.severityFilter.addEventListener('change', () => {
        state.severity = elements.severityFilter.value;
        render();
      });
    }
    if (elements.compareFilter) {
      elements.compareFilter.addEventListener('change', () => {
        state.compare = elements.compareFilter.value;
        render();
      });
    }
    if (elements.baselineFile) {
      elements.baselineFile.addEventListener('change', (event) => {
        const file = event.target.files && event.target.files[0];
        if (file) {
          readBaselineFile(file);
        }
      });
    }
    if (elements.pane) {
      elements.pane.addEventListener('click', (event) => {
        if (event.target.closest('[data-design-help-close]')) {
          state.showHelp = false;
          markHelpSeen();
          render();
          return;
        }
        if (event.target.closest('[data-design-show-all-inline]')) {
          showAllDesignNodes();
        }
      });
    }
    if (elements.board) {
      elements.board.addEventListener('pointerdown', beginNodeDrag);
      elements.board.addEventListener('click', (event) => {
        if (state.suppressNextClick) {
          state.suppressNextClick = false;
          return;
        }
        const card = event.target.closest('[data-design-key]');
        if (!card) {
          exitFocusGraph();
          return;
        }
        state.selectedKey = card.dataset.designKey;
        render();
      });
    }
    if (elements.graphCanvas) {
      elements.graphCanvas.addEventListener('pointerdown', beginCanvasPan);
      elements.graphCanvas.addEventListener('wheel', zoomCanvasWheel, {passive: false});
      elements.graphCanvas.addEventListener('click', (event) => {
        if (state.suppressNextClick) {
          state.suppressNextClick = false;
          return;
        }
        if (event.target === elements.graphCanvas || event.target === elements.graphEdges) {
          exitFocusGraph();
        }
      });
      elements.graphCanvas.addEventListener('click', (event) => {
        const zoom = event.target.closest && event.target.closest('[data-design-zoom]');
        if (!zoom) {
          return;
        }
        handleDesignZoom(zoom.dataset.designZoom || '');
      });
    }
    if (elements.zoomControls) {
      elements.zoomControls.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      elements.zoomControls.addEventListener('click', (event) => {
        const zoom = event.target.closest && event.target.closest('[data-design-zoom]');
        if (!zoom) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        handleDesignZoom(zoom.dataset.designZoom || '');
      });
    }
    if (elements.graphEdges) {
      elements.graphEdges.addEventListener('click', (event) => {
        const path = event.target.closest('[data-design-edge-id]');
        if (!path) {
          return;
        }
        selectEdgeNeighbor(path.dataset.designEdgeId);
      });
    }
    if (elements.inspector) {
      elements.inspector.addEventListener('click', (event) => {
        const collapsibleSummary = event.target.closest && event.target.closest('details.event-workbench-collapsible > summary, details.mini-section > summary');
        if (collapsibleSummary && elements.inspector.contains(collapsibleSummary)) {
          event.preventDefault();
          event.stopPropagation();
          toggleInspectorDetails(collapsibleSummary.parentElement);
          return;
        }
        const eventWorkbenchAction = event.target.closest('[data-event-workbench-action]');
        if (eventWorkbenchAction) {
          handleEventWorkbenchAction(eventWorkbenchAction.dataset.eventWorkbenchAction || '');
          return;
        }
        const editExisting = event.target.closest('[data-design-edit-existing]');
        if (editExisting) {
          editSelectedExisting();
          return;
        }
        const edit = event.target.closest('[data-design-edit-draft]');
        if (edit) {
          editSelectedDraft();
          return;
        }
        const editText = event.target.closest('[data-design-edit-text]');
        if (editText) {
          editSelectedTextProposal();
          return;
        }
        const create = event.target.closest('[data-design-create-action]');
        if (create) {
          createRelatedDraft(create.dataset.designCreateAction, create.dataset.designPeerKey || '');
          return;
        }
        const edgeTarget = event.target.closest('[data-design-target-key]');
        if (edgeTarget) {
          selectDesignKey(edgeTarget.dataset.designTargetKey);
          return;
        }
        const open = event.target.closest('[data-design-open-explore]');
        if (open) {
          openSelectedInExplore();
        }
      });
    }
    if (elements.inspectorResizer) {
      elements.inspectorResizer.addEventListener('pointerdown', beginInspectorResize);
    }
    if (elements.inspectorToggle) {
      elements.inspectorToggle.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      elements.inspectorToggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleInspectorCollapse();
      });
    }
    document.addEventListener('pointermove', moveNodeDrag);
    document.addEventListener('pointerup', endNodeDrag);
    document.addEventListener('pointercancel', cancelNodeDrag);
    document.addEventListener('pointermove', moveCanvasPan);
    document.addEventListener('pointerup', endCanvasPan);
    document.addEventListener('pointercancel', cancelCanvasPan);
    document.addEventListener('pointermove', moveInspectorResize);
    document.addEventListener('pointerup', endInspectorResize);
    document.addEventListener('pointercancel', cancelInspectorResize);
    document.addEventListener('mouseup', cancelDesignInteractions);
    if (global && typeof global.addEventListener === 'function') {
      global.addEventListener('blur', cancelDesignInteractions);
    }
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.pane.classList.contains('hidden')) {
        exitFocusGraph();
      }
    });
    document.addEventListener('project-map:locale-changed', () => {
      populateLaneFilter();
      invalidateInspectorCache();
      render();
    });
  }

  function readBaselineFile(file) {
    const reader = new FileReader();
    setBaselineStatus(t('design.loadingBaseline', 'Loading baseline...'));
    reader.onload = () => {
      try {
        const index = JSON.parse(String(reader.result || ''));
        const viewer = global.ProjectMapViewer;
        if (!viewer || typeof viewer.validateProjectIndex !== 'function' || typeof viewer.buildViewModel !== 'function') {
          throw new Error('Project Map viewer model helper is unavailable.');
        }
        const validation = viewer.validateProjectIndex(index);
        if (!validation.ok) {
          throw new Error(validation.errors.join('; '));
        }
        state.baselineModel = viewer.buildViewModel(index);
        state.selectedKey = '';
        rebuildDesignModel();
        setBaselineStatus(t('design.baselineLoaded', 'Baseline loaded: ') + (file.name || 'ProjectIndex') + '.');
        render();
      } catch (err) {
        state.baselineModel = null;
        rebuildDesignModel();
        setBaselineStatus(t('design.baselineLoadFailed', 'Could not load baseline: ') + (err && err.message ? err.message : String(err)), true);
        render();
      }
    };
    reader.onerror = () => {
      setBaselineStatus(t('design.baselineReadFailed', 'Could not read baseline file.'), true);
    };
    reader.readAsText(file);
  }

  function rebuildDesignModel() {
    const design = global.ProjectMapDesignModel;
    if (!design || typeof design.buildDesignModel !== 'function' || !state.projectModel) {
      state.designModel = null;
      state.designModelStale = false;
      state.designRevision += 1;
      invalidateInspectorCache();
      return;
    }
    state.designModel = design.buildDesignModel(state.projectModel, state.baselineModel);
    state.designModelStale = false;
    state.designRevision += 1;
    invalidateInspectorCache();
    populateLaneFilter();
  }

  function invalidateInspectorCache() {
    state.inspectorCache = {key: '', html: ''};
  }

  function populateLaneFilter() {
    if (!elements || !elements.laneFilter || !state.designModel) {
      return;
    }
    const current = elements.laneFilter.value || 'all';
    elements.laneFilter.innerHTML = '<option value="all">' + escapeHtml(t('design.lane.all', 'All lanes')) + '</option>' +
      state.designModel.lanes.map((lane) => {
        return '<option value="' + escapeAttr(lane.id) + '">' +
          escapeHtml(laneLabel(lane)) + ' (' + escapeHtml(lane.count) + ')</option>';
      }).join('');
    elements.laneFilter.value = state.designModel.lanes.some((lane) => lane.id === current) ? current : 'all';
    state.lane = elements.laneFilter.value;
  }

  function laneLabel(lane) {
    const keys = {
      timeline_events: 'design.type.events',
      cards_advisors: 'design.type.advisorLike',
      news: 'design.type.news',
      surface_sidebar: 'design.type.surfaceText',
      manual_review: 'design.authoring.manual'
    };
    return t(keys[lane && lane.id] || '', lane && lane.label ? lane.label : '');
  }

  function setBaselineStatus(message, isError) {
    if (!elements || !elements.baselineStatus) {
      return;
    }
    elements.baselineStatus.textContent = message;
    elements.baselineStatus.classList.toggle('is-error', Boolean(isError));
  }

  function exitFocusGraph() {
    if (state.view !== 'graph') {
      state.selectedKey = '';
      render();
      return;
    }
    if (state.scope !== 'all' || state.selectedKey) {
      state.scope = 'all';
      state.selectedKey = '';
      syncScopeControl();
      setDesignStatus(t('design.showAll', 'Showing all matching Design nodes. Select a node to focus again.'));
      render();
      scheduleFitCanvas();
    }
  }

  function showAllDesignNodes() {
    state.scope = 'all';
    state.selectedKey = '';
    syncScopeControl();
    setDesignStatus(t('design.showAll', 'Showing all matching Design nodes. Select a node to focus again.'));
    render();
    scheduleFitCanvas();
  }

  function handleDesignZoom(action) {
    if (action === 'in') {
      zoomCanvas(1.12);
    } else if (action === 'out') {
      zoomCanvas(1 / 1.12);
    } else if (action === 'fit') {
      fitCanvas();
    }
  }

  function render() {
    syncScopeControl();
    syncInspectorCollapse();
    if (!elements) {
      return;
    }
    if (!state.projectModel) {
      elements.status.textContent = t('design.status.initial', 'Load a ProjectIndex to build the graph design view.');
      if (elements.starter) {
        elements.starter.innerHTML = renderStarter(null, []);
        elements.starter.classList.remove('hidden');
      }
      if (elements.breadcrumb) {
        elements.breadcrumb.innerHTML = '';
      }
      elements.summary.innerHTML = '';
      elements.board.innerHTML = '<div class="empty-state">' + escapeHtml(t('design.noIndex', 'No project index loaded.')) + '</div>';
      if (elements.graphEdges) {
        elements.graphEdges.innerHTML = '';
      }
      updateStatusBar(null, []);
      elements.inspector.innerHTML = '<div class="empty-state">' + escapeHtml(t('design.selectNode', 'Select a graph node to inspect authoring status, compare state, and source.')) + '</div>';
      return;
    }
    if (!state.designModel || state.designModelStale) {
      rebuildDesignModel();
    }
    const model = state.designModel;
    const design = global.ProjectMapDesignModel;
    const baseFiltered = design.filterDesignItems(model, {
      query: state.query,
      lane: state.lane,
      kind: state.kind,
      authoring: state.authoring,
      severity: state.severity,
      compare: state.compare
    });
    if (!baseFiltered.length) {
      state.selectedKey = '';
    } else if (state.selectedKey && !baseFiltered.some((item) => item.key === state.selectedKey) && baseFiltered.length) {
      state.selectedKey = '';
    }
    const filtered = scopedDesignItems(model, baseFiltered);
    elements.status.textContent = model.hasBaseline
      ? t('design.readyBaseline', 'Design view ready with baseline comparison. Changed is only shown when strong fingerprints differ.')
      : t('design.ready', 'Design view ready. Load a baseline ProjectIndex to compare against an original project.');
    if (elements.starter) {
      elements.starter.innerHTML = state.showHelp ? renderStarter(model, baseFiltered) : '';
      elements.starter.classList.toggle('hidden', !state.showHelp);
    }
    if (elements.breadcrumb) {
      elements.breadcrumb.innerHTML = renderBreadcrumb(model);
    }
    elements.summary.innerHTML = renderSummary(model.summary.compare);
    renderGraphCanvas(model, filtered);
    updateStatusBar(model, filtered);
    renderInspector(model);
    applyI18n(elements.pane);
  }

  function renderStarter(model, items) {
    const count = model && model.summary ? model.summary.itemCount || 0 : 0;
    const shown = items ? items.length : 0;
    const selected = model && state.selectedKey && model.itemsByKey ? model.itemsByKey.get(state.selectedKey) : null;
    const intro = selected
      ? t('design.starter.selected', 'You are inspecting one player-facing beat. Use the next-step panel on the right, or return to the full project graph.')
      : t('design.starter.intro', 'Use Design as the player-flow workbench: find what exists, inspect what can be edited, then create related drafts without opening source files first.');
    const cards = [
      ['design.starter.exploreTitle', 'Explore player flow', 'design.starter.exploreBody', 'Move through events, cards, news, and surface text as the player will encounter them.'],
      ['design.starter.findTitle', 'Find what to change', 'design.starter.findBody', 'Search or switch to List/Timeline when you already know a title, year, file, or content type.'],
      ['design.starter.createTitle', 'Create next step', 'design.starter.createBody', 'Select a node, then use the inspector to make a follow-up event, related news, card, or text proposal.']
    ];
    return [
      '<div class="design-starter-copy">',
      '<div class="design-starter-header"><strong>' + escapeHtml(t('design.starter.title', 'Design workbench')) + '</strong>' +
        '<button type="button" data-design-help-close="true">' + escapeHtml(t('design.helpClose', 'Got it')) + '</button></div>',
      '<span>' + escapeHtml(intro) + '</span>',
      '<small>' + escapeHtml(String(shown) + ' / ' + String(count) + ' ' + t('design.starter.visible', 'items visible')) + '</small>',
      '<div class="design-help-legend">' +
        '<b class="dot exact"></b><span>' + escapeHtml(t('confidence.matched', 'matched')) + '</span>' +
        '<b class="dot static_inferred"></b><span>' + escapeHtml(t('confidence.inferred', 'inferred')) + '</span>' +
        '<b class="dot profile_heuristic"></b><span>' + escapeHtml(t('confidence.guessed', 'guessed')) + '</span>' +
        '<b class="dot opaque"></b><span>' + escapeHtml(t('confidence.unknown', 'unknown')) + '</span>' +
      '</div>',
      '</div>',
      '<div class="design-starter-cards">',
      cards.map(([titleKey, titleFallback, bodyKey, bodyFallback]) => {
        return '<div class="design-starter-card">' +
          '<b>' + escapeHtml(t(titleKey, titleFallback)) + '</b>' +
          '<span>' + escapeHtml(t(bodyKey, bodyFallback)) + '</span>' +
        '</div>';
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderBreadcrumb(model) {
    const selected = model && state.selectedKey && model.itemsByKey ? model.itemsByKey.get(state.selectedKey) : null;
    const crumbs = [
      t('design.breadcrumb.all', 'All content'),
      state.view === 'timeline' ? t('design.view.timeline', 'Timeline') : state.view === 'list' ? t('design.view.list', 'List') : t('design.view.graph', 'Graph')
    ];
    if (selected) {
      crumbs.push(kindLabel(selected.kind));
      crumbs.push(selected.title || selected.key);
    }
    return '<div class="design-breadcrumb-path">' + crumbs.map((crumb) => '<span>' + escapeHtml(crumb) + '</span>').join('<b>/</b>') + '</div>' +
      '<button type="button" data-design-show-all-inline="true">' + escapeHtml(t('design.backToAll', 'Back to all')) + '</button>';
  }

  function kindLabel(kind) {
    const labels = {
      event: t('design.type.events', 'Events'),
      card: t('design.type.cards', 'Cards'),
      advisor_like: t('design.type.advisorLike', 'Advisor-like'),
      news: t('design.type.news', 'News'),
      monthly_router: t('design.type.monthlyRouter', 'Monthly router'),
      monthly_popup: t('design.type.monthlyPopup', 'Monthly popup'),
      surface_text: t('design.type.surfaceText', 'Surface Text')
    };
    return labels[kind] || kind || t('design.item', 'Item');
  }

  function syncScopeControl() {
    if (!elements) {
      return;
    }
    if (elements.scopeFilter && elements.scopeFilter.value !== undefined) {
      elements.scopeFilter.value = state.scope === 'focus' ? 'focus' : 'all';
    }
    if (elements.scopeOptions && elements.scopeOptions.length) {
      elements.scopeOptions.forEach((button) => {
        const active = button.dataset.designScope === state.scope;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
  }

  function renderSummary(compare) {
    const labels = [
      ['same', t('design.same', 'Same')],
      ['changed', t('design.changed', 'Changed')],
      ['added', t('design.added', 'Added')],
      ['missing_from_current', t('design.missing', 'Missing')],
      ['unknown', t('design.unknown', 'Unknown')],
      ['no_baseline', t('design.noBaselineShort', 'No baseline')]
    ];
    return labels.map(([key, label]) => {
      return '<div class="design-summary-card compare-' + escapeAttr(key) + '">' +
        '<span class="metric-value">' + escapeHtml(compare[key] || 0) + '</span>' +
        '<span class="metric-label">' + escapeHtml(label) + '</span>' +
        '</div>';
    }).join('');
  }

  function scopedDesignItems(model, filteredItems) {
    if (state.scope !== 'focus' || !state.selectedKey || !model || !model.itemsByKey) {
      return filteredItems;
    }
    const selected = model.itemsByKey.get(state.selectedKey);
    if (!selected) {
      return filteredItems;
    }
    const allowed = new Set([selected.key]);
    graphRowsForSelected(model, selected).forEach((row) => {
      if (row.targetKey) {
        allowed.add(row.targetKey);
      }
    });
    relatedRowsForSelected(model, selected).forEach((row) => {
      if (row.key) {
        allowed.add(row.key);
      }
    });
    if (state.lane === 'all' && state.kind === 'all') {
      addCrossLaneFocusContext(filteredItems, selected, allowed);
    }
    const scoped = filteredItems.filter((item) => allowed.has(item.key));
    return scoped.length > 1 ? scoped : filteredItems.slice(0, Math.min(24, filteredItems.length));
  }

  function addCrossLaneFocusContext(items, selected, allowed) {
    const wantedLanes = ['timeline_events', 'cards_advisors', 'news', 'surface_sidebar', 'manual_review'];
    const selectedYear = selected && selected.schedule ? Number(selected.schedule.year || 0) : 0;
    wantedLanes.forEach((laneId) => {
      if ([...allowed].some((key) => {
        const item = state.designModel && state.designModel.itemsByKey.get(key);
        return item && item.laneId === laneId;
      })) {
        return;
      }
      const candidate = items
        .filter((item) => item.laneId === laneId && item.key !== selected.key)
        .sort((a, b) => {
          const aYear = Number(a.schedule && a.schedule.year || 9999);
          const bYear = Number(b.schedule && b.schedule.year || 9999);
          return Math.abs(aYear - selectedYear) - Math.abs(bYear - selectedYear) ||
            String(a.title || '').localeCompare(String(b.title || ''));
        })[0];
      if (candidate) {
        allowed.add(candidate.key);
      }
    });
  }


  function updateStatusBar(model, filteredItems) {
    if (elements.projectName && model && model.projectModel && model.projectModel.project) {
      elements.projectName.textContent = model.projectModel.project.name || model.projectModel.project.root || 'ProjectIndex';
    }
    if (elements.statusCount) {
      elements.statusCount.textContent = model
        ? String(filteredItems.length) + ' ' + t('design.statusShown', 'shown') + ' · ' +
          String(model.summary.graphNodeCount || 0) + ' ' + t('design.statusNodes', 'nodes') + ' · ' +
          String(model.summary.graphEdgeCount || 0) + ' ' + t('design.statusEdges', 'edges')
        : t('design.noIndex', 'No ProjectIndex loaded.');
    }
    if (elements.statusDiagnostics) {
      const diagnostics = model && model.projectModel ? model.projectModel.diagnostics || [] : [];
      const errors = diagnostics.filter((diag) => diag.severity === 'error').length;
      const warnings = diagnostics.filter((diag) => diag.severity === 'warning').length;
      const info = diagnostics.filter((diag) => !diag.severity || diag.severity === 'info').length;
      elements.statusDiagnostics.textContent = errors + ' ' + t('design.statusErrors', 'errors') + ' · ' +
        warnings + ' ' + t('design.statusWarnings', 'warnings') + ' · ' +
        info + ' ' + t('design.severity.info', 'info');
    }
    if (elements.statusSchema && model && model.projectModel && model.projectModel.index) {
      elements.statusSchema.textContent = 'schema ' + (model.projectModel.index.schemaVersion || 'unknown');
    }
  }

  function renderInspector(model) {
    const selected = model.itemsByKey.get(state.selectedKey);
    if (!selected) {
      elements.inspector.innerHTML = '<div class="empty-state">' + escapeHtml(t('design.selectNode', 'Select a design card to inspect authoring status, compare state, and source.')) + '</div>';
      invalidateInspectorCache();
      return;
    }
    const cacheKey = inspectorCacheKey(model, selected);
    if (state.inspectorCache && state.inspectorCache.key === cacheKey) {
      elements.inspector.innerHTML = state.inspectorCache.html;
      restoreInspectorSectionState(selected);
      return;
    }
    const html = renderInspectorContent(model, selected);
    state.inspectorCache = {key: cacheKey, html};
    elements.inspector.innerHTML = html;
    restoreInspectorSectionState(selected);
  }

  function inspectorCacheKey(model, selected) {
    const source = selected && selected.source || {};
    const fingerprint = selected && selected.sourceFingerprint && selected.sourceFingerprint.value || '';
    const projectRoot = model && model.projectModel && model.projectModel.project && model.projectModel.project.root || '';
    return [
      state.designRevision || 0,
      currentLocale(),
      projectRoot,
      selected && selected.key || '',
      selected && selected.compareStatus || '',
      fingerprint,
      source.path || '',
      sourceLine(source)
    ].join('::');
  }

  function renderInspectorContent(model, selected) {
    const support = global.ProjectMapDesignModel.designItemDraftSupport(selected);
    const canOpenExplore = selected.present !== false && selected.kind !== 'monthly_router';
    const source = selected.source || {};
    const playerSummary = playerFacingSummary(selected);
    const variables = (selected.variables || []).slice(0, 12).map((variable) => {
      return escapeHtml(variable.name + (variable.access ? ' (' + variable.access + ')' : ''));
    });
    const diagnostics = (selected.diagnostics || []).slice(0, 8).map((diag) => {
      return '<div class="edge-item">' + badge(diag.severity || 'info', diag.severity || 'info') + ' ' +
        escapeHtml(diag.code || 'diagnostic') + '<br>' + escapeHtml(diag.message || '') + '</div>';
    });
    const graphRows = graphRowsForSelected(model, selected).map((row) => {
      return '<button class="edge-button" type="button" data-design-target-key="' + escapeAttr(row.targetKey || '') + '"' +
        (row.targetKey ? '' : ' disabled') + '>' +
        escapeHtml(row.direction + ' · ' + row.kind + ': ' + row.title) +
        (row.label ? '<br><span class="muted">' + escapeHtml(row.label) + '</span>' : '') +
        '</button>';
    });
    const relatedRows = relatedRowsForSelected(model, selected).map((row) => {
      return '<div class="related-item-row">' +
        '<button class="related-item-button" type="button" data-design-target-key="' + escapeAttr(row.key || '') + '">' +
          '<span>' + escapeHtml(row.title || row.key) + '</span>' +
          '<small>' + escapeHtml([row.kind, row.reason].filter(Boolean).join(' · ')) + '</small>' +
        '</button>' +
        '<button class="related-bridge-button" type="button" data-design-create-action="bridge_event" data-design-peer-key="' + escapeAttr(row.key || '') + '">' + escapeHtml(t('design.bridgeEvent', 'Bridge event')) + '</button>' +
      '</div>';
    });
    const eventWorkbenchHtml = renderEventWorkbenchForSelected(model, selected);
    const generalWorkbenchHtml = eventWorkbenchHtml ? '' : [
      '<section class="design-workbench-panel">',
      '<h3>' + escapeHtml(t('design.workbench', 'Player-flow workbench')) + '</h3>',
      '<p>' + escapeHtml(playerSummary) + '</p>',
      '<div class="design-workbench-actions">',
      '<button type="button" data-design-create-action="followup_event"' + (canCreateFrom(selected) ? '' : ' disabled') + '>' + escapeHtml(t('design.createFollowup', 'Create follow-up event')) + '<small>' + escapeHtml(t('design.outputDraft', 'Output: draft')) + '</small></button>',
      '<button type="button" data-design-create-action="related_news"' + (canCreateFrom(selected) ? '' : ' disabled') + '>' + escapeHtml(t('design.createNews', 'Create related news')) + '<small>' + escapeHtml(t('design.outputDraft', 'Output: draft')) + '</small></button>',
      '<button type="button" data-design-create-action="related_card"' + (canCreateFrom(selected) ? '' : ' disabled') + '>' + escapeHtml(t('design.createCard', 'Create related card')) + '<small>' + escapeHtml(t('design.outputDraft', 'Output: draft')) + '</small></button>',
      '</div>',
      '</section>'
    ].join('');
    const inspectorActionHtml = eventWorkbenchHtml
      ? [
          '<div class="inspector-actions">',
          '<button class="draft-action-button" type="button" data-design-edit-existing="true"' + (support.supported && canEditExistingSupport(support.view) ? '' : ' disabled') + '>' + escapeHtml(t('existingScene.editExisting', 'Edit existing')) + '<small>' + escapeHtml(t('design.outputProposal', 'Output: proposal')) + '</small></button>',
          '<button class="draft-action-button" type="button" data-design-edit-draft="true"' + (support.supported ? '' : ' disabled') + '>' + escapeHtml(t('existingScene.copyAsNew', 'Copy as new draft')) + '<small>' + escapeHtml(t('design.outputDraft', 'Output: draft')) + '</small></button>',
          '<button type="button" data-design-open-explore="true"' + (canOpenExplore ? '' : ' disabled') + '>' + escapeHtml(t('design.openExplore', 'Open in Explore')) + '<small>' + escapeHtml(t('design.outputInspect', 'Output: inspect')) + '</small></button>',
          '</div>'
        ].join('')
      : [
          '<div class="inspector-actions">',
          '<button class="draft-action-button" type="button" data-design-edit-existing="true"' + (support.supported && canEditExistingSupport(support.view) ? '' : ' disabled') + '>' + escapeHtml(t('existingScene.editExisting', 'Edit existing')) + '<small>' + escapeHtml(t('design.outputProposal', 'Output: proposal')) + '</small></button>',
          '<button class="draft-action-button" type="button" data-design-edit-draft="true"' + (support.supported ? '' : ' disabled') + '>' + escapeHtml(t('existingScene.copyAsNew', 'Copy as new draft')) + '<small>' + escapeHtml(t('design.outputDraft', 'Output: draft')) + '</small></button>',
          '<button class="draft-action-button" type="button" data-design-edit-text="true"' + (support.supported ? '' : ' disabled') + '>' + escapeHtml(t('design.editText', 'Edit Text Proposal')) + '<small>' + escapeHtml(t('design.outputProposal', 'Output: proposal')) + '</small></button>',
          '<button type="button" data-design-open-explore="true"' + (canOpenExplore ? '' : ' disabled') + '>' + escapeHtml(t('design.openExplore', 'Open in Explore')) + '<small>' + escapeHtml(t('design.outputInspect', 'Output: inspect')) + '</small></button>',
          '</div>'
        ].join('');
    return [
      '<h2 class="inspector-title">' + escapeHtml(selected.title) + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(selected.laneLabel || selected.kind) + '</div>',
      '<div class="badge-line">',
      badge(selected.kind, ''),
      badge(selected.compareStatus || 'unknown', 'compare-' + (selected.compareStatus || 'unknown')),
      badge(selected.confidence || 'opaque', selected.confidence || 'opaque'),
      '</div>',
      '<dl class="kv">',
      '<dt>' + escapeHtml(t('design.authoringLabel', 'Authoring')) + '</dt><dd>' + escapeHtml(support.supported ? (t('existingScene.copyAsNew', 'Copy as new draft') + ' -> ' + support.template) : t('design.authoring.manual', 'Manual review')) + '</dd>',
      '<dt>' + escapeHtml(t('design.compareLabel', 'Compare')) + '</dt><dd>' + escapeHtml(compareLabel(selected.compareStatus)) + '</dd>',
      '<dt>' + escapeHtml(t('design.source', 'Source')) + '</dt><dd>' + escapeHtml(source.path ? source.path + (sourceLine(source) ? ':' + sourceLine(source) : '') : '(no source ref)') + '</dd>',
      '<dt>' + escapeHtml(t('design.detail', 'Detail')) + '</dt><dd>' + escapeHtml(selected.detail || selected.subtitle || '') + '</dd>',
      '</dl>',
      generalWorkbenchHtml,
      eventWorkbenchHtml || renderDesignPreview(model, selected),
      inspectorActionHtml,
      support.status === 'ide_escape_hatch'
        ? '<div class="edge-item">' + escapeHtml(t('design.ideEscapeHatch', 'IDE escape hatch: Studio can draft guidance, but it will not pretend this is a safe automatic edit.')) + '</div>'
        : '',
      miniSection('variables', t('design.variablesTouched', 'Variables touched'), variables),
      miniSection('flow_edges', t('design.flowEdges', 'Flow edges'), graphRows),
      miniSection('related_content', t('design.relatedContent', 'Related content'), relatedRows),
      miniSection('diagnostics', t('design.diagnostics', 'Diagnostics'), diagnostics)
    ].join('');
  }

  function renderEventWorkbenchForSelected(model, selected) {
    if (!model || !selected || (selected.kind !== 'event' && selected.kind !== 'monthly_popup')) {
      return '';
    }
    const core = global.ProjectMapEventWorkbench;
    const ui = global.ProjectMapEventWorkbenchUi;
    const projectIndex = model.projectModel && model.projectModel.index;
    if (!core || !ui || !projectIndex || typeof core.buildEventWorkbench !== 'function' || typeof ui.renderEventWorkbench !== 'function') {
      return '';
    }
    const sceneSeed = selected.scene || selected.raw || selected.sceneId || selected.id;
    const workbench = core.buildEventWorkbench(projectIndex, sceneSeed, {locale: currentLocale()});
    if (!workbench || !workbench.sceneId || !workbench.playerText) {
      return '';
    }
    return ui.renderEventWorkbench(workbench, {locale: currentLocale(), eyebrow: t('eventWorkbench.eyebrow', 'Event Workbench')});
  }

  function renderDesignPreview(model, selected) {
    const preview = previewModelForDesignItem(model, selected);
    if (!preview) {
      return '';
    }
    const meaningUi = global.ProjectMapMeaningLayerUi;
    const apiCore = global.ProjectMapPreviewModel;
    const fallbackText = apiCore && typeof apiCore.renderPreviewText === 'function'
      ? apiCore.renderPreviewText(preview)
      : preview.title || '';
    const previewHtml = meaningUi && typeof meaningUi.renderPreviewHtml === 'function'
      ? meaningUi.renderPreviewHtml(preview, {}, fallbackText)
      : '<pre class="player-preview inspector-preview-text">' + escapeHtml(fallbackText) + '</pre>';
    return [
      '<section class="design-workbench-panel design-preview-panel" data-design-preview="true">',
      '<h3>' + escapeHtml(t('preview.title', 'Preview')) + '</h3>',
      previewHtml,
      '</section>'
    ].join('');
  }

  function previewModelForDesignItem(model, item) {
    const apiCore = global.ProjectMapPreviewModel;
    if (!apiCore || typeof apiCore.buildPreviewModel !== 'function' || !model || !item || item.kind === 'monthly_router') {
      return null;
    }
    const projectIndex = model.projectModel && model.projectModel.index;
    try {
      if (item.kind === 'news' && item.raw) {
        return apiCore.buildPreviewModel(item.raw, {sourceKind: 'news', projectIndex});
      }
      if (item.kind === 'surface_text' && global.ProjectMapDraftExtract && typeof global.ProjectMapDraftExtract.textReplacementDraftFromItem === 'function') {
        const textResult = global.ProjectMapDraftExtract.textReplacementDraftFromItem(projectIndex, 'surfaceText', item.raw, {});
        return apiCore.buildPreviewModel(textResult.ok ? textResult : item.raw, {sourceKind: 'surface_text', projectIndex});
      }
      const support = global.ProjectMapDesignModel.designItemDraftSupport(item);
      if (support.supported && global.ProjectMapDraftExtract && typeof global.ProjectMapDraftExtract.extractDraftFromItem === 'function') {
        const result = global.ProjectMapDraftExtract.extractDraftFromItem(projectIndex, support.view, item.raw, {});
        if (result && result.ok) {
          return apiCore.buildPreviewModel(result, {projectIndex});
        }
      }
      if (item.raw) {
        return apiCore.buildPreviewModel(item.raw, {sourceKind: designPreviewKind(item), projectIndex});
      }
    } catch (err) {
      return apiCore.buildPreviewModel({
        status: 'unsupported',
        diagnostics: [{severity: 'warning', code: 'preview.failed', message: err && err.message ? err.message : String(err)}]
      }, {sourceKind: designPreviewKind(item), projectIndex});
    }
    return null;
  }

  function designPreviewKind(item) {
    if (!item) {
      return 'unknown';
    }
    if (item.kind === 'advisor_like') {
      return 'card';
    }
    if (item.kind === 'event' || item.kind === 'card' || item.kind === 'news' || item.kind === 'surface_text') {
      return item.kind;
    }
    return 'unknown';
  }

  function graphRowsForSelected(model, selected) {
    const graph = model && model.graph ? model.graph : {nodes: [], edges: []};
    const node = graph.nodes.find((candidate) => candidate.key === selected.key);
    if (!node) {
      return [];
    }
    const nodeById = new Map(graph.nodes.map((candidate) => [candidate.id, candidate]));
    return graph.edges
      .filter((edge) => edge.from === node.id || edge.to === node.id)
      .slice(0, 12)
      .map((edge) => {
        const outgoing = edge.from === node.id;
        const otherNode = nodeById.get(outgoing ? edge.to : edge.from);
        return {
          direction: outgoing ? 'outgoing' : 'incoming',
          kind: edge.kind || 'edge',
          label: edge.label || edge.condition || '',
          title: otherNode && otherNode.title ? otherNode.title : (outgoing ? edge.toSceneId : edge.fromSceneId),
          targetKey: otherNode ? otherNode.key : ''
        };
      });
  }

  function relatedRowsForSelected(model, selected) {
    const design = global.ProjectMapDesignModel;
    if (!design || typeof design.relatedDesignItems !== 'function') {
      return [];
    }
    return design.relatedDesignItems(model, selected, 8);
  }

  function selectEdgeNeighbor(edgeId) {
    const model = state.designModel;
    if (!model || !model.graph) {
      return;
    }
    const edge = model.graph.edges.find((candidate) => candidate.id === edgeId);
    if (!edge) {
      setDesignStatus(t('design.edgeMissing', 'This edge no longer has a matching graph item.'), true);
      return;
    }
    const nextKey = state.selectedKey === edge.toKey ? edge.fromKey : edge.toKey;
    selectDesignKey(nextKey || edge.toKey || edge.fromKey);
  }

  function selectDesignKey(key) {
    if (!key || !state.designModel || !state.designModel.itemsByKey.has(key)) {
      setDesignStatus(t('design.navigateMissing', 'Could not navigate to that linked design item.'), true);
      return;
    }
    state.selectedKey = key;
    render();
  }

  function scrollSelectedNodeIntoView() {
    if (!state.selectedKey || !elements || !elements.board) {
      return;
    }
    const selector = '[data-design-key="' + cssEscape(state.selectedKey) + '"]';
    const node = elements.board.querySelector(selector);
    if (!node || typeof node.scrollIntoView !== 'function') {
      return;
    }
    const schedule = typeof global.requestAnimationFrame === 'function'
      ? global.requestAnimationFrame.bind(global)
      : (callback) => callback();
    schedule(() => {
      node.scrollIntoView({block: 'nearest', inline: 'nearest'});
    });
  }


  function editSelectedDraft() {
    const item = state.designModel && state.designModel.itemsByKey.get(state.selectedKey);
    if (!item) {
      return;
    }
    const support = global.ProjectMapDesignModel.designItemDraftSupport(item);
    if (!support.supported || !global.ProjectMapDraftExtract || typeof global.ProjectMapDraftExtract.extractDraftFromItem !== 'function') {
      return;
    }
    const result = global.ProjectMapDraftExtract.extractDraftFromItem(state.projectModel.index, support.view, item.raw, {});
    if (!result || (!result.ok && result.status === 'unsupported')) {
      setDesignStatus(t('design.cannotDraft', 'This design card cannot be converted into a draft yet.'), true);
      return;
    }
    openDraftInCreate(result.template, result.draft, result);
    setDesignStatus(t('design.draftLoaded', 'Draft loaded in Create mode. Review & Apply can preview supported operations.'));
  }

  function editSelectedExisting() {
    const item = state.designModel && state.designModel.itemsByKey.get(state.selectedKey);
    if (!item) {
      return;
    }
    const support = global.ProjectMapDesignModel.designItemDraftSupport(item);
    const editor = global.ProjectMapEditingWorkspace || global.ProjectMapExistingSceneEditor;
    if (!support.supported || !canEditExistingSupport(support.view) || !editor || typeof editor.openFromSelection !== 'function') {
      setDesignStatus(t('existingScene.openFailed', 'This scene needs more source evidence before Studio can edit it here.'), true);
      return;
    }
    const opened = editor.openFromSelection(state.projectModel.index, support.view, item.raw);
    setDesignStatus(opened
      ? t('objectCanvas.status.designExisting', 'Object Canvas opened from Design. Save it to My Changes when ready.')
      : t('existingScene.openFailed', 'This scene needs more source evidence before Studio can edit it here.'),
    !opened);
  }

  function canEditExistingSupport(view) {
    return view === 'events' || view === 'cards';
  }

  function editSelectedTextProposal() {
    const item = state.designModel && state.designModel.itemsByKey.get(state.selectedKey);
    if (!item) {
      return;
    }
    const support = global.ProjectMapDesignModel.designItemDraftSupport(item);
    if (!support.supported || !global.ProjectMapDraftExtract || typeof global.ProjectMapDraftExtract.textReplacementDraftFromItem !== 'function') {
      setDesignStatus(t('design.cannotTextProposal', 'This Design node cannot seed a text proposal yet.'), true);
      return;
    }
    const result = global.ProjectMapDraftExtract.textReplacementDraftFromItem(state.projectModel.index, support.view, item.raw, {});
    if (!result || !result.ok) {
      setDesignStatus(t('design.cannotTextProposal', 'This Design node cannot seed a text proposal yet.'), true);
      return;
    }
    openDraftInCreate(result.template, result.draft, result);
    setDesignStatus(t('design.textProposalLoaded', 'Text replacement proposal loaded in Create mode. Nothing is installed automatically.'));
  }

  function createRelatedDraft(action, peerKey) {
    const item = state.designModel && state.designModel.itemsByKey.get(state.selectedKey);
    if (!item || !canCreateFrom(item)) {
      setDesignStatus(t('design.selectCurrentForRelated', 'Select a current project item before creating a related draft.'), true);
      return;
    }
    if (action === 'bridge_event') {
      const peer = peerKey && state.designModel.itemsByKey.get(peerKey);
      if (!peer || peer.present === false) {
        setDesignStatus(t('design.selectRelatedForBridge', 'Select a current related item before creating a bridge event.'), true);
        return;
      }
      const draft = makeBridgeEventDraft(item, peer);
      openDraftInCreate('event', draft, {ok: true, status: 'seed', template: 'event', source: item.source || null});
      setDesignStatus(t('design.bridgeSeeded', 'Bridge event draft seeded from two Design nodes.'));
      return;
    }
    if (action === 'followup_event') {
      const draft = makeFollowupEventDraft(item);
      openDraftInCreate('event', draft, {ok: true, status: 'seed', template: 'event', source: item.source || null});
      setDesignStatus(t('design.followupSeeded', 'Follow-up event draft seeded from the selected Design node.'));
      return;
    }
    if (action === 'related_news') {
      const draft = makeRelatedNewsDraft(item);
      openDraftInCreate('news', draft, {ok: true, status: 'seed', template: 'news', source: item.source || null});
      setDesignStatus(t('design.newsSeeded', 'Related news draft seeded from the selected Design node.'));
      return;
    }
    if (action === 'related_card') {
      const draft = makeRelatedCardDraft(item);
      openDraftInCreate('card', draft, {ok: true, status: 'seed', template: 'card', source: item.source || null});
      setDesignStatus(t('design.cardSeeded', 'Related card draft seeded from the selected Design node.'));
    }
  }

  function handleEventWorkbenchAction(action) {
    const item = state.designModel && state.designModel.itemsByKey.get(state.selectedKey);
    const projectIndex = state.projectModel && state.projectModel.index;
    const core = global.ProjectMapEventWorkbench;
    if (!item || !projectIndex || !core || typeof core.buildActionDraft !== 'function') {
      setDesignStatus(t('eventWorkbench.actionUnavailable', 'Event Workbench action is unavailable for this item.'), true);
      return;
    }
    const sceneSeed = item.scene || item.raw || item.sceneId || item.id;
    const result = core.buildActionDraft(projectIndex, sceneSeed, action, {locale: currentLocale()});
    if (!result || !result.ok || !result.draft) {
      const message = result && result.diagnostics && result.diagnostics[0]
        ? result.diagnostics[0].message
        : t('eventWorkbench.actionFailed', 'Could not create a draft from this Event Workbench action.');
      setDesignStatus(message, true);
      return;
    }
    openDraftInCreate(result.template, result.draft, result);
    setDesignStatus(eventWorkbenchActionStatus(action));
  }

  function eventWorkbenchActionStatus(action) {
    if (action === 'edit_text') {
      return t('eventWorkbench.status.text', 'Text proposal loaded in Create. Nothing is installed automatically.');
    }
    if (action === 'copy_alt_timeline') {
      return t('eventWorkbench.status.alternate', 'Alternate timeline event draft loaded in Create. Review before export.');
    }
    if (action === 'follow_up') {
      return t('eventWorkbench.status.followup', 'Follow-up event draft loaded in Create. Review before export.');
    }
    return t('eventWorkbench.status.generic', 'Draft loaded in Create.');
  }

  function openDraftInCreate(template, draft, result) {
    clickSelector('[data-mode="create"]');
    clickSelector('[data-create-template="' + template + '"]');
    const meta = {source: 'Design mode Edit as Draft', extraction: result};
    if (global.ProjectMapObjectAuthoringCanvas && typeof global.ProjectMapObjectAuthoringCanvas.loadDraft === 'function') {
      global.ProjectMapObjectAuthoringCanvas.loadDraft(draft, meta);
    } else if (template === 'event' && global.ProjectMapWizard && typeof global.ProjectMapWizard.loadDraft === 'function') {
      global.ProjectMapWizard.loadDraft(draft, meta);
    } else if (template === 'news' && global.ProjectMapNewsWizard && typeof global.ProjectMapNewsWizard.loadDraft === 'function') {
      global.ProjectMapNewsWizard.loadDraft(draft, meta);
    } else if (template === 'card' && global.ProjectMapCardWizard && typeof global.ProjectMapCardWizard.loadDraft === 'function') {
      global.ProjectMapCardWizard.loadDraft(draft, meta);
    } else if (template === 'surface' && global.ProjectMapSurfaceTextWizard && typeof global.ProjectMapSurfaceTextWizard.loadDraft === 'function') {
      global.ProjectMapSurfaceTextWizard.loadDraft(draft, meta);
    }
  }

  function canCreateFrom(item) {
    return Boolean(item && item.present !== false && item.kind !== 'surface_text');
  }

  function makeFollowupEventDraft(item) {
    const base = safeId(item.sceneId || item.title || 'design_item');
    const id = uniqueSceneId(base + '_followup');
    const schedule = nextSchedule(item.schedule);
    return {
      schemaVersion: '0.1',
      kind: 'world_event',
      id,
      title: 'Follow-up: ' + (item.title || base),
      heading: 'Follow-up: ' + (item.title || base),
      seenFlag: id + '_seen',
      when: {
        year: schedule.year,
        monthStart: schedule.monthStart,
        monthEnd: schedule.monthEnd,
        requires: '',
        priority: 0
      },
      introParagraphs: [
        'Draft a follow-up beat connected to "' + (item.title || base) + '". Replace this note with the player-facing setup.'
      ],
      effectsOnTrigger: [],
      options: [
        {
          id: 'respond',
          label: 'Respond',
          subtitle: 'Define the active response.',
          chooseIf: '',
          unavailableText: '',
          effects: [],
          narrativeParagraphs: ['Describe what the player does and what changes.'],
          variants: [],
          gotoAfter: id + '_continue'
        },
        {
          id: 'hold_back',
          label: 'Hold back',
          subtitle: 'Leave room for later.',
          chooseIf: '',
          unavailableText: '',
          effects: [],
          narrativeParagraphs: ['Describe the quieter path and its cost.'],
          variants: [],
          gotoAfter: id + '_continue'
        }
      ],
      sourceSeed: designSeed(item)
    };
  }

  function makeBridgeEventDraft(item, peer) {
    const base = safeId((item.sceneId || item.title || 'node') + '_to_' + (peer.sceneId || peer.title || 'node'));
    const id = uniqueSceneId(base + '_bridge');
    const schedule = bridgeSchedule(item.schedule, peer.schedule);
    return {
      schemaVersion: '0.1',
      kind: 'world_event',
      id,
      title: 'Bridge: ' + shortTitle(item) + ' / ' + shortTitle(peer),
      heading: 'Bridge: ' + shortTitle(item) + ' / ' + shortTitle(peer),
      seenFlag: id + '_seen',
      when: {
        year: schedule.year,
        monthStart: schedule.monthStart,
        monthEnd: schedule.monthEnd,
        requires: '',
        priority: 0
      },
      introParagraphs: [
        'Draft a connective beat between "' + shortTitle(item) + '" and "' + shortTitle(peer) + '". Use it to make the player understand why these two parts of the mod belong in the same flow.'
      ],
      effectsOnTrigger: [],
      options: [
        {
          id: 'connect_threads',
          label: 'Connect the threads',
          subtitle: 'Make the relationship visible to the player.',
          chooseIf: '',
          unavailableText: '',
          effects: [],
          narrativeParagraphs: ['Describe how these two beats meet in player-facing terms.'],
          variants: [],
          gotoAfter: id + '_continue'
        },
        {
          id: 'keep_separate',
          label: 'Keep them separate',
          subtitle: 'Let the tension remain unresolved.',
          chooseIf: '',
          unavailableText: '',
          effects: [],
          narrativeParagraphs: ['Describe what remains unresolved if the player does not connect these threads.'],
          variants: [],
          gotoAfter: id + '_continue'
        }
      ],
      sourceSeed: {
        from: designSeed(item),
        to: designSeed(peer)
      }
    };
  }

  function makeRelatedNewsDraft(item) {
    const base = safeId(item.sceneId || item.title || 'design_item');
    const id = uniqueNewsId(base + '_news');
    const schedule = scheduleOrDefault(item.schedule);
    return {
      schemaVersion: '0.1',
      kind: 'news_item',
      id,
      headline: t('design.newsDraftPrefix', '[News]') + ' ' + (item.title || base),
      description: 'Short public-facing news text related to "' + (item.title || base) + '".',
      delivery: 'dated',
      when: {
        year: schedule.year,
        month: schedule.monthStart,
        slot: 1,
        requiresJs: ''
      },
      pool: {
        name: 'social_pool',
        requiresJs: ''
      },
      sourceSeed: designSeed(item)
    };
  }

  function makeRelatedCardDraft(item) {
    const base = safeId(item.sceneId || item.title || 'design_item');
    const id = uniqueSceneId(base + '_card');
    return {
      schemaVersion: '0.1',
      kind: 'card',
      id,
      title: 'Action: ' + (item.title || base),
      cardKind: 'action_card',
      tags: ['party_affairs'],
      viewIf: '',
      priority: 0,
      frequency: 200,
      maxVisits: 1,
      heading: 'Action: ' + (item.title || base),
      subtitle: 'A player action connected to the selected Design node.',
      introParagraphs: [
        'Draft an action card that gives the player a repeatable intervention connected to "' + (item.title || base) + '".'
      ],
      options: [
        {
          id: 'invest',
          label: 'Invest effort',
          subtitle: 'Spend capacity for a stronger result.',
          chooseIf: '',
          unavailableText: '',
          effects: [],
          narrativeParagraphs: ['Describe the active intervention and its result.'],
          gotoAfter: 'root'
        },
        {
          id: 'wait',
          label: 'Wait',
          subtitle: 'Keep capacity for later.',
          chooseIf: '',
          unavailableText: '',
          effects: [],
          narrativeParagraphs: ['Describe what happens if the player leaves this alone.'],
          gotoAfter: 'root'
        }
      ],
      sourceSeed: designSeed(item)
    };
  }

  function playerFacingSummary(item) {
    const parts = [];
    if (item.schedule && (item.schedule.year || item.schedule.monthStart)) {
      parts.push('Appears around ' + scheduleLabel(item.schedule) + '.');
    }
    if (item.kind === 'event') {
      parts.push('Timeline beat: usually a monthly event the player reacts to.');
    } else if (item.kind === 'card' || item.kind === 'advisor_like') {
      parts.push('Action/card beat: usually something the player can trigger from a hand or advisor-like surface.');
    } else if (item.kind === 'news') {
      parts.push('News beat: player-facing ticker or background pool text.');
    } else if (item.kind === 'surface_text') {
      parts.push('Surface text: wording that shapes what players see in sidebar/status/UI areas.');
    }
    const variables = (item.variables || []).slice(0, 3).map((variable) => variable.name).filter(Boolean);
    if (variables.length) {
      parts.push('Touches ' + variables.join(', ') + '.');
    }
    return parts.join(' ') || 'Use this node as the anchor for nearby events, news, cards, or manual review work.';
  }

  function scheduleLabel(schedule) {
    if (!schedule) {
      return 'an unknown month';
    }
    const year = schedule.year || 'unknown year';
    const start = schedule.monthStart || '';
    const end = schedule.monthEnd || start;
    const month = start ? (start === end ? String(start) : start + '-' + end) : 'unknown month';
    return year + ' / month ' + month;
  }

  function nextSchedule(schedule) {
    const current = scheduleOrDefault(schedule);
    let start = Number(current.monthEnd || current.monthStart || 1) + 1;
    let year = Number(current.year || 2025);
    if (start > 12) {
      start = 1;
      year += 1;
    }
    return {year, monthStart: start, monthEnd: start};
  }

  function bridgeSchedule(first, second) {
    const a = scheduleOrDefault(first);
    const b = scheduleOrDefault(second);
    if (first && second && first.year && second.year) {
      const later = (b.year > a.year || (b.year === a.year && b.monthStart >= a.monthStart)) ? b : a;
      return {
        year: later.year,
        monthStart: later.monthStart,
        monthEnd: later.monthEnd || later.monthStart
      };
    }
    return nextSchedule(first || second);
  }

  function scheduleOrDefault(schedule) {
    return {
      year: Number(schedule && schedule.year) || 2025,
      monthStart: Number(schedule && schedule.monthStart) || 1,
      monthEnd: Number(schedule && schedule.monthEnd) || Number(schedule && schedule.monthStart) || 1
    };
  }

  function uniqueSceneId(base) {
    const scenes = state.projectModel && state.projectModel.scenesById ? state.projectModel.scenesById : new Map();
    return uniqueId(base, (id) => scenes.has(String(id)));
  }

  function uniqueNewsId(base) {
    const news = state.projectModel && state.projectModel.lists ? state.projectModel.lists.news || [] : [];
    const existing = new Set(news.map((item) => item && item.id).filter(Boolean).map(String));
    return uniqueId(base, (id) => existing.has(String(id)));
  }

  function uniqueId(base, exists) {
    const root = safeId(base || 'new_draft');
    let candidate = root;
    let counter = 2;
    while (exists(candidate) && counter < 1000) {
      candidate = root + '_' + counter;
      counter += 1;
    }
    return candidate;
  }

  function safeId(value) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!normalized) {
      return 'new_draft';
    }
    return /^[a-z_]/.test(normalized) ? normalized : 'draft_' + normalized;
  }

  function shortTitle(item) {
    const text = String(item && item.title ? item.title : item && item.sceneId ? item.sceneId : 'node').trim();
    return text.length > 42 ? text.slice(0, 39) + '...' : text;
  }

  function designSeed(item) {
    const source = item.source || {};
    return {
      designKey: item.key || '',
      sourceSceneId: item.sceneId || '',
      sourceTitle: item.title || '',
      sourcePath: source.path || '',
      sourceLine: sourceLine(source)
    };
  }

  function openSelectedInExplore() {
    const item = state.designModel && state.designModel.itemsByKey.get(state.selectedKey);
    if (!item) {
      return;
    }
    if (item.present === false) {
      setDesignStatus(t('design.baselineOnly', 'This item only exists in the baseline index, so there is no current Explore row to open.'), true);
      return;
    }
    const support = global.ProjectMapDesignModel.designItemDraftSupport(item);
    global.document.dispatchEvent(new CustomEvent('project-map:design-open-explore', {
      detail: {
        view: support.view || 'scenes',
        item: item.raw || item.scene || item,
        key: item.key
      },
      bubbles: true
    }));
  }

  function clickSelector(selector) {
    const target = global.document.querySelector(selector);
    if (target && typeof target.click === 'function') {
      target.click();
    }
  }

  function setDesignStatus(message, isError) {
    if (!elements || !elements.status) {
      return;
    }
    elements.status.textContent = message;
    elements.status.classList.toggle('is-error', Boolean(isError));
  }

  function miniSection(id, title, rows) {
    if (!rows || !rows.length) {
      return '';
    }
    return '<details class="mini-section" open data-design-mini-section="' + escapeAttr(id || '') + '"><summary aria-expanded="true"><span>' + escapeHtml(title) + '</span><b>' + escapeHtml(String(rows.length)) + '</b></summary>' + rows.join('') + '</details>';
  }

  function toggleInspectorDetails(details) {
    if (!details) {
      return;
    }
    const nextOpen = !details.open;
    details.open = nextOpen;
    const key = inspectorDetailsStateKey(details);
    if (key) {
      state.inspectorSections[key] = nextOpen;
    }
    syncDetailsAria(details);
  }

  function restoreInspectorSectionState(selected) {
    if (!elements || !elements.inspector) {
      return;
    }
    const detailsList = Array.from(elements.inspector.querySelectorAll('details.event-workbench-collapsible[data-event-workbench-section], details.mini-section[data-design-mini-section]'));
    detailsList.forEach((details) => {
      const key = inspectorDetailsStateKey(details, selected && selected.key);
      if (key && Object.prototype.hasOwnProperty.call(state.inspectorSections, key)) {
        details.open = Boolean(state.inspectorSections[key]);
      }
      syncDetailsAria(details);
    });
  }

  function inspectorDetailsStateKey(details, selectedKey) {
    if (!details) {
      return '';
    }
    const sectionId = details.dataset.eventWorkbenchSection || details.dataset.designMiniSection || '';
    if (!sectionId) {
      return '';
    }
    const prefix = details.classList.contains('event-workbench-collapsible') ? 'event_workbench' : 'design';
    return [selectedKey || state.selectedKey || '', prefix, sectionId].join('::');
  }

  function syncDetailsAria(details) {
    if (!details) {
      return;
    }
    const summary = details.querySelector('summary');
    if (summary) {
      summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');
    }
  }

  function readInspectorCollapsed() {
    try {
      return Boolean(global.localStorage && global.localStorage.getItem(INSPECTOR_COLLAPSED_KEY) === '1');
    } catch (err) {
      return false;
    }
  }

  function storeInspectorCollapsed(collapsed) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(INSPECTOR_COLLAPSED_KEY, collapsed ? '1' : '0');
      }
    } catch (err) {
      // Inspector collapse state is a preference; storage failure should not block Design.
    }
  }

  function syncInspectorCollapse() {
    if (!elements || !elements.pane) {
      return;
    }
    const collapsed = Boolean(state.inspectorCollapsed);
    elements.pane.classList.toggle('is-design-inspector-collapsed', collapsed);
    if (elements.inspectorToggle) {
      const label = collapsed
        ? t('design.expandInspector', 'Expand Design inspector')
        : t('design.collapseInspector', 'Collapse Design inspector');
      elements.inspectorToggle.textContent = collapsed ? '›' : '‹';
      elements.inspectorToggle.setAttribute('aria-label', label);
      elements.inspectorToggle.setAttribute('title', label);
      elements.inspectorToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
  }

  function toggleInspectorCollapse() {
    state.inspectorCollapsed = !state.inspectorCollapsed;
    storeInspectorCollapsed(state.inspectorCollapsed);
    syncInspectorCollapse();
    schedule(() => {
      if (state.view === 'graph') {
        fitCanvas();
      }
    });
  }

  function badge(text, className) {
    return '<span class="badge ' + escapeAttr(className || '') + '">' + escapeHtml(labelForBadge(text || '')) + '</span>';
  }

  function labelForBadge(text) {
    const value = String(text || '');
    const labels = {
      exact: t('confidence.matched', 'matched'),
      static_inferred: t('confidence.inferred', 'inferred'),
      profile_heuristic: t('confidence.guessed', 'guessed'),
      opaque: t('confidence.unknown', 'unknown'),
      event: t('design.type.events', 'Event'),
      card: t('design.type.cards', 'Card'),
      advisor_like: t('design.type.advisorLike', 'Advisor-like'),
      news: t('design.type.news', 'News'),
      surface_text: t('design.type.surfaceText', 'Surface Text'),
      no_baseline: t('design.compare.noBaseline', 'No baseline'),
      same: t('design.compare.same', 'Same'),
      changed: t('design.compare.changed', 'Changed'),
      added: t('design.compare.added', 'Added'),
      missing_from_current: t('design.compare.missing', 'Missing'),
      unknown: t('design.compare.unknown', 'Unknown'),
      warning: t('design.severity.warning', 'Warning'),
      error: t('design.severity.error', 'Error'),
      info: t('design.severity.info', 'Info'),
      draft: t('design.outputDraftShort', 'draft'),
      manual: t('design.authoring.manual', 'Manual review')
    };
    return labels[value] || value;
  }

  function compareLabel(status) {
    const labels = {
      same: t('design.compare.sameLong', 'Same as baseline'),
      changed: t('design.compare.changedLong', 'Changed from baseline'),
      added: t('design.compare.addedLong', 'Added in current project'),
      missing_from_current: t('design.compare.missingLong', 'Exists in baseline, missing from current'),
      unknown: t('design.compare.unknownLong', 'Unknown; insufficient confidence or fingerprint'),
      no_baseline: t('design.compare.noBaselineLong', 'No baseline loaded')
    };
    return labels[status] || status || 'unknown';
  }

  function sourceLine(source) {
    return source && (source.line || source.startLine) ? String(source.line || source.startLine) : '';
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function cssEscape(value) {
    if (global.CSS && typeof global.CSS.escape === 'function') {
      return global.CSS.escape(String(value));
    }
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function designModeIsActive() {
    return Boolean(global.document && global.document.body && global.document.body.dataset.mode === 'design');
  }

  function schedule(callback) {
    if (typeof global.requestAnimationFrame === 'function') {
      global.requestAnimationFrame(callback);
      return;
    }
    global.setTimeout(callback, 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
