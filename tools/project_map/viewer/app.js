(function initProjectMapViewer(global) {
  'use strict';

  function loadExploreModel(root) {
    if (root && root.ProjectMapExploreModel) {
      return root.ProjectMapExploreModel;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      return require('../authoring/explore_model.js');
    }
    throw new Error('Project Map Explore model module is unavailable.');
  }

  function loadExploreUiFactory(root) {
    if (root && root.ProjectMapExploreUi) {
      return root.ProjectMapExploreUi;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      return require('./explore_ui.js');
    }
    throw new Error('Project Map Explore UI module is unavailable.');
  }

  const EXPLORE_MODEL = loadExploreModel(global);
  const {
    VIEW_DEFS,
    SEVERITY_RANK,
    CONFIDENCE_ORDER,
    EXPLORE_SEARCH_DEBOUNCE_MS,
    EXPLORE_INSPECTOR_WIDTH_KEY,
    EXPLORE_INSPECTOR_MIN_WIDTH,
    EXPLORE_INSPECTOR_MAX_WIDTH,
    VIRTUAL_LIST_THRESHOLD,
    VIRTUAL_LIST_ROW_HEIGHT,
    VIRTUAL_ASSET_ROW_HEIGHT,
    VIRTUAL_ASSET_CARD_MIN_WIDTH,
    VIRTUAL_LIST_OVERSCAN,
    SORT_COLLATOR,
    t,
    currentLocale,
    applyI18n,
    studioContracts,
    assetModelApi,
    editCapabilityApi,
    viewLabel,
    isObject,
    ensureArray,
    requiredArray,
    validateProjectIndex,
    makeMap,
    groupBy,
    buildVariableAccessesByPath,
    diagnosticGroups,
    diagnosticBreakdown,
    coverageRows,
    coverageField,
    coverageWorkflowSteps,
    coveragePriorityLabel,
    coverageCompletionLabel,
    noCodeCompletionLabel,
    coverageCountBadge,
    buildViewModel,
    normalizeAssetForViewer,
    profileUiLabels,
    materializeSceneRefs,
    endpointSceneMap,
    severityRank,
    confidenceRank,
    firstSource,
    sourceLine,
    sourceLabel,
    normalizeForView,
    listForView,
    filterAndSortItems,
    normalizedRowsForView,
    sortedRowsForView,
    virtualWindowForList,
    sortValue,
    compareValues,
    countBy,
    hasSourceExcerpts,
    graphRowsForScene,
    endpointBelongsToScene,
    sceneIdForEndpoint,
    graphRow,
    textCorpusContextRows,
    textRevisionKey,
    textRevisionReplacementFor,
    buildTextRevisionModel,
    humanizeKey,
    textCorpusRoleLabel,
    textCorpusRoleGuidance,
    textCorpusEditabilityLabel,
    editCapabilityForModel,
    editCapabilityRouteLabel,
    editCapabilityActionLabel,
    editCapabilitySummary,
    capabilityBadgeClass
  } = EXPLORE_MODEL;
  let desktopProgressTimer = null;

  const createProjectMapExploreUi = loadExploreUiFactory(global);
  const EXPLORE_UI = createProjectMapExploreUi({
    global,
    VIEW_DEFS,
    VIRTUAL_LIST_THRESHOLD,
    VIRTUAL_LIST_ROW_HEIGHT,
    VIRTUAL_ASSET_ROW_HEIGHT,
    VIRTUAL_ASSET_CARD_MIN_WIDTH,
    VIRTUAL_LIST_OVERSCAN,
    t,
    currentLocale,
    applyI18n,
    studioContracts,
    assetModelApi,
    editCapabilityApi,
    viewLabel,
    ensureArray,
    coverageRows,
    coverageField,
    coverageWorkflowSteps,
    normalizedRowsForView,
    sortedRowsForView,
    virtualWindowForList,
    sourceLabel,
    sourceLine,
    firstSource,
    graphRowsForScene,
    sceneIdForEndpoint,
    textCorpusContextRows,
    textRevisionKey,
    textRevisionReplacementFor,
    buildTextRevisionModel,
    textCorpusRoleLabel,
    textCorpusRoleGuidance,
    textCorpusEditabilityLabel,
    editCapabilityForModel,
    editCapabilityRouteLabel,
    editCapabilityActionLabel,
    editCapabilitySummary,
    capabilityBadgeClass,
    setStatus,
    showError,
    coverageCountBadge,
    diagnosticBreakdown,
    countBy,
    listForView,
    filterAndSortItems,
    normalizeAssetForViewer,
  });
  const {
    render,
    renderList,
    currentItems,
    renderOverview,
    renderFirstModRoadmap,
    renderAssetGallery,
    renderVirtualAssetGallery,
    renderAssetGalleryCard,
    renderAssetPicker,
    renderDraftAssetPanel,
    renderNewsList,
    renderTextCorpusList,
    prepareVirtualList,
    renderListRow,
    renderInspector,
    renderInspectorPreview,
    renderEditDraftAction,
    renderTextProposalAction,
    renderExtractionScope,
    previewDraftExtraction,
    previewTextReplacement,
    draftActionSummary,
    textProposalSummary,
    handleEditAsDraft,
    handleEditExisting,
    handleEditTextProposal,
    handleEditVariable,
    handleEventWorkbenchAction,
    eventWorkbenchSeedForSelection,
    eventWorkbenchActionStatus,
    openDraftInCreate,
    activateMode,
    openDesignSelectionInExplore,
    designRowMatches,
    activateCreateTemplate,
    sceneFromSelection,
    renderSourceButton,
    renderSceneInspector,
    renderEventWorkbenchInspector,
    renderVariableInspector,
    renderCoverageInspector,
    renderDiagnosticInspector,
    renderNewsInspector,
    renderSurfaceTextInspector,
    renderTextCorpusInspector,
    renderTextRevisionPanel,
    updateTextRevisionDom,
    renderTextRevisionDiff,
    handleEditRouteAction,
    renderAssetInspector,
    renderAssetUseActions,
    renderAssetRepairActions,
    renderAssetManifest,
    localizedAssetRoleLabel,
    handleAssetDraftAction,
    handleAssetRepairFileSelection,
    parseAssetActionRef,
    copyText,
    renderAssetReferenceHelper,
    assetReferenceStateLabel,
    renderAssetPreviewFrame,
    renderAssetUsageList,
    renderSourceInspector,
    renderOverviewInspector,
    renderEdgeSection,
    renderSceneEndpoint,
    renderMiniSection,
    renderDiagnosticMini,
    badge,
    renderBadge,
    labelForBadge,
    escapeHtml,
    escapeAttr
  } = EXPLORE_UI;


  const api = {
    VIEW_DEFS,
    validateProjectIndex,
    buildViewModel,
    filterAndSortItems,
    virtualWindowForList,
    countBy,
    sourceLabel,
    sourceLine,
    diagnosticBreakdown,
    coverageRows,
    diagnosticGroups,
    graphRowsForScene,
    sceneIdForEndpoint,
    textCorpusContextRows,
    buildTextRevisionModel,
    renderAssetInspector,
    renderAssetPicker,
    renderAssetManifest,
    renderDraftAssetPanel,
    textCorpusRoleLabel,
    textCorpusEditabilityLabel,
    editCapabilityForModel,
    hasSourceExcerpts,
    loadProjectIndexUrl
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (!global || !global.document) {
    return;
  }

  global.ProjectMapViewer = api;
  global.document.addEventListener('DOMContentLoaded', () => {
    startApp(global.document);
  });

  function startApp(document) {
    const state = {
      model: null,
      view: 'overview',
      query: '',
      sortField: VIEW_DEFS.overview.defaultSort,
      sortDir: 'desc',
      selectedKey: null,
      selected: null,
      currentItems: [],
      virtualListActive: false,
      listRenderSignature: '',
      draftActionMessage: '',
      textActionMessage: '',
      textProposalEdits: {},
      resizingInspector: null,
      assetBaseUrl: autoloadAssetBaseUrl(global.location)
    };

    const elements = {
      explorePane: document.getElementById('explore-pane'),
      file: document.getElementById('index-file'),
      brandSubtitle: document.getElementById('brand-subtitle'),
      status: document.getElementById('status'),
      overview: document.getElementById('overview'),
      list: document.getElementById('list'),
      inspector: document.getElementById('inspector'),
      inspectorPanel: document.querySelector('#explore-pane .inspector'),
      inspectorResizer: document.getElementById('explore-inspector-resizer'),
      search: document.getElementById('search'),
      navBack: document.getElementById('nav-back'),
      sortField: document.getElementById('sort-field'),
      sortDir: document.getElementById('sort-dir'),
      dropZone: document.getElementById('index-drop-zone') || document.getElementById('index-drop-target'),
      filePicker: document.getElementById('index-drop-target'),
      nav: Array.from(document.querySelectorAll('.nav-item')),
      desktopControls: document.getElementById('desktop-controls'),
      desktopOnlyControls: Array.from(document.querySelectorAll('.desktop-only-control')),
      desktopRunDoctor: document.getElementById('desktop-run-doctor'),
      desktopOpenProject: document.getElementById('desktop-open-project'),
      desktopRebuildIndex: document.getElementById('desktop-rebuild-index'),
      desktopIncludeExcerpts: document.getElementById('desktop-include-excerpts'),
      desktopStatus: document.getElementById('desktop-status'),
      desktopProgress: document.getElementById('desktop-progress'),
      desktopProgressBar: document.getElementById('desktop-progress-bar'),
      desktopProgressHint: document.getElementById('desktop-progress-hint'),
      desktopProgressLabel: document.getElementById('desktop-progress-label'),
      topbarMore: document.getElementById('topbar-more'),
      wordmark: document.querySelector('.brand .wordmark'),
      openHomeButton: document.getElementById('studio-open-home')
    };
    let searchRenderTimer = null;
    let listScrollFrame = null;

    // Browser-style back for Explore: each in-pane navigation records the page
    // being left, and the back control / Alt+Left re-opens it. Holds the live
    // `selected` reference (session-scoped), so going back re-opens the exact
    // item without re-deriving it.
    state.navHistory = global.ProjectMapNavigationHistory
      ? global.ProjectMapNavigationHistory.create({limit: 25})
      : null;

    function exploreLocation() {
      return {
        id: 'explore:' + String(state.view) + ':' + String(state.selectedKey || ''),
        mode: 'explore',
        view: state.view,
        selectedKey: state.selectedKey,
        selected: state.selected,
        sortField: state.sortField,
        sortDir: state.sortDir,
        query: state.query
      };
    }

    function recordNavigation() {
      if (state.navHistory) {
        state.navHistory.record(exploreLocation());
        updateBackControl();
      }
    }

    function updateBackControl() {
      if (elements.navBack) {
        elements.navBack.disabled = !(state.navHistory && state.navHistory.canGoBack());
      }
    }

    function restoreExploreLocation(prev) {
      const shell = global.ProjectMapShellNavigation;
      if (shell && typeof shell.setMode === 'function'
        && document.body && document.body.dataset.mode !== 'explore') {
        shell.setMode('explore', {reason: 'nav-back'});
      }
      state.view = prev.view;
      state.selectedKey = prev.selectedKey;
      state.selected = prev.selected;
      state.sortField = prev.sortField;
      state.sortDir = prev.sortDir;
      state.query = prev.query || '';
      if (elements.search) {
        elements.search.value = state.query;
      }
      render(state, elements);
    }

    function goBack() {
      if (!state.navHistory || !state.navHistory.canGoBack()) {
        return;
      }
      const prev = state.navHistory.back();
      if (prev && prev.mode === 'explore') {
        restoreExploreLocation(prev);
      } else if (prev && prev.mode) {
        const shell = global.ProjectMapShellNavigation;
        if (shell && typeof shell.setMode === 'function') {
          shell.setMode(prev.mode, {reason: 'nav-back'});
        }
      }
      updateBackControl();
    }

    // Cross-mode bridge: shell_navigation records the page being left whenever
    // the workspace mode changes, so the single back stack chains Explore page
    // history and mode switches together (browser-style back, from any page).
    global.ProjectMapNavController = {
      recordLeaving: function recordLeaving(previousMode) {
        if (!state.navHistory) {
          return;
        }
        if (previousMode === 'explore') {
          state.navHistory.record(exploreLocation());
        } else if (previousMode) {
          state.navHistory.record({id: 'mode:' + previousMode, mode: previousMode});
        }
        updateBackControl();
      },
      goBack: goBack,
      canGoBack: function canGoBack() {
        return !!(state.navHistory && state.navHistory.canGoBack());
      },
      refresh: updateBackControl
    };

    function readStoredExploreInspectorWidth() {
      try {
        const raw = global.localStorage && global.localStorage.getItem(EXPLORE_INSPECTOR_WIDTH_KEY);
        const parsed = Number.parseFloat(raw || '');
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      } catch (err) {
        return 0;
      }
    }

    function storeExploreInspectorWidth(width) {
      try {
        if (global.localStorage) {
          global.localStorage.setItem(EXPLORE_INSPECTOR_WIDTH_KEY, String(Math.round(width)));
        }
      } catch (err) {
        // Inspector width is only a preference; storage errors should not block Explore.
      }
    }

    function clampExploreInspectorWidth(width) {
      const paneWidth = elements.explorePane && typeof elements.explorePane.getBoundingClientRect === 'function'
        ? elements.explorePane.getBoundingClientRect().width
        : 0;
      const viewportWidth = global.innerWidth || 0;
      const available = (paneWidth || viewportWidth || 1200) - 200 - 320 - 8;
      const maxWidth = Math.max(
        EXPLORE_INSPECTOR_MIN_WIDTH,
        Math.min(EXPLORE_INSPECTOR_MAX_WIDTH, available || EXPLORE_INSPECTOR_MAX_WIDTH)
      );
      return Math.min(Math.max(Number(width) || EXPLORE_INSPECTOR_MIN_WIDTH, EXPLORE_INSPECTOR_MIN_WIDTH), maxWidth);
    }

    function applyExploreInspectorWidth(width) {
      if (!elements.explorePane) {
        return;
      }
      const clamped = clampExploreInspectorWidth(width);
      elements.explorePane.style.setProperty('--explore-inspector-width', Math.round(clamped) + 'px');
    }

    function currentExploreInspectorWidth() {
      if (elements.inspectorPanel && typeof elements.inspectorPanel.getBoundingClientRect === 'function') {
        const rect = elements.inspectorPanel.getBoundingClientRect();
        if (rect.width) {
          return rect.width;
        }
      }
      return readStoredExploreInspectorWidth() || 340;
    }

    function restoreExploreInspectorWidth() {
      const stored = readStoredExploreInspectorWidth();
      if (stored) {
        applyExploreInspectorWidth(stored);
      }
    }

    function beginExploreInspectorResize(event) {
      if (!elements.inspectorResizer || !elements.inspectorPanel) {
        return;
      }
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      event.preventDefault();
      state.resizingInspector = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: currentExploreInspectorWidth()
      };
      elements.inspectorResizer.classList.add('is-dragging');
      if (elements.explorePane) {
        elements.explorePane.classList.add('is-resizing-inspector');
      }
      if (typeof elements.inspectorResizer.setPointerCapture === 'function') {
        try {
          elements.inspectorResizer.setPointerCapture(event.pointerId);
        } catch (err) {
          // Document-level handlers keep resizing usable if capture fails.
        }
      }
    }

    function moveExploreInspectorResize(event) {
      if (!state.resizingInspector || event.pointerId !== state.resizingInspector.pointerId) {
        return;
      }
      event.preventDefault();
      const nextWidth = state.resizingInspector.startWidth + (state.resizingInspector.startX - event.clientX);
      applyExploreInspectorWidth(nextWidth);
    }

    function endExploreInspectorResize(event) {
      if (!state.resizingInspector || event.pointerId !== state.resizingInspector.pointerId) {
        return;
      }
      const pointerId = state.resizingInspector.pointerId;
      state.resizingInspector = null;
      const width = currentExploreInspectorWidth();
      storeExploreInspectorWidth(width);
      if (elements.inspectorResizer) {
        elements.inspectorResizer.classList.remove('is-dragging');
        if (typeof elements.inspectorResizer.releasePointerCapture === 'function') {
          try {
            elements.inspectorResizer.releasePointerCapture(pointerId);
          } catch (err) {
            // Capture may already be released.
          }
        }
      }
      if (elements.explorePane) {
        elements.explorePane.classList.remove('is-resizing-inspector');
      }
    }

    function cancelExploreInspectorResize() {
      if (!state.resizingInspector) {
        return;
      }
      state.resizingInspector = null;
      if (elements.inspectorResizer) {
        elements.inspectorResizer.classList.remove('is-dragging');
      }
      if (elements.explorePane) {
        elements.explorePane.classList.remove('is-resizing-inspector');
      }
    }

    restoreExploreInspectorWidth();

    function scheduleSearchRender() {
      if (searchRenderTimer) {
        global.clearTimeout(searchRenderTimer);
      }
      searchRenderTimer = global.setTimeout(() => {
        searchRenderTimer = null;
        render(state, elements);
      }, EXPLORE_SEARCH_DEBOUNCE_MS);
    }

    function scheduleListRender() {
      if (listScrollFrame) {
        return;
      }
      const run = () => {
        listScrollFrame = null;
        if (!state.virtualListActive) {
          return;
        }
        renderList(state, elements);
        applyI18n(elements.list);
      };
      if (typeof global.requestAnimationFrame === 'function') {
        listScrollFrame = global.requestAnimationFrame(run);
      } else {
        listScrollFrame = global.setTimeout(run, 16);
      }
    }

    elements.file.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        readProjectIndexFile(file, state, elements);
      }
    });

    if (elements.dropZone) {
      elements.dropZone.addEventListener('dragover', (event) => {
        event.preventDefault();
        elements.dropZone.classList.add('is-drag-over');
      });
      elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('is-drag-over');
      });
      elements.dropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        elements.dropZone.classList.remove('is-drag-over');
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if (file) {
          readProjectIndexFile(file, state, elements);
        }
      });
    }

    elements.search.addEventListener('input', () => {
      state.query = elements.search.value;
      scheduleSearchRender();
    });

    elements.sortField.addEventListener('change', () => {
      state.sortField = elements.sortField.value;
      render(state, elements);
    });

    elements.sortDir.addEventListener('click', () => {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      render(state, elements);
    });

    if (elements.navBack) {
      elements.navBack.addEventListener('click', goBack);
    }
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      // Global browser-style back: works from any workspace mode as long as the
      // shared back stack has somewhere to return to.
      if (!state.navHistory || !state.navHistory.canGoBack()) {
        return;
      }
      event.preventDefault();
      goBack();
    });

    elements.nav.forEach((button) => {
      button.addEventListener('click', () => {
        recordNavigation();
        state.view = button.dataset.view;
        state.query = '';
        state.selectedKey = null;
        state.selected = null;
        state.draftActionMessage = '';
        state.textActionMessage = '';
        state.sortField = VIEW_DEFS[state.view].defaultSort;
        state.sortDir = state.view === 'overview' ? 'desc' : 'asc';
        elements.search.value = '';
        render(state, elements);
      });
    });

    if (elements.inspectorResizer) {
      elements.inspectorResizer.addEventListener('pointerdown', beginExploreInspectorResize);
    }
    document.addEventListener('pointermove', moveExploreInspectorResize);
    document.addEventListener('pointerup', endExploreInspectorResize);
    document.addEventListener('pointercancel', cancelExploreInspectorResize);

    elements.list.addEventListener('click', (event) => {
      const row = event.target.closest('[data-row-key]');
      if (!row) {
        return;
      }
      const items = state.currentItems && state.currentItems.length ? state.currentItems : currentItems(state);
      const found = items.find((item) => item.key === row.dataset.rowKey);
      if (found) {
        recordNavigation();
        state.selectedKey = found.key;
        state.selected = {view: state.view, item: found.raw, normalized: found};
        state.draftActionMessage = '';
        state.textActionMessage = '';
        render(state, elements);
        document.dispatchEvent(new CustomEvent('ProjectMap:explore-entry-opened', {
          detail: {view: state.view, key: found.key}
        }));
      }
    });

    elements.list.addEventListener('scroll', () => {
      if (state.virtualListActive) {
        scheduleListRender();
      }
    });

    elements.inspector.addEventListener('click', (event) => {
      const visibleEditAction = event.target.closest('[data-visible-edit-action]');
      if (visibleEditAction) {
        const ui = global.ProjectMapVisibleEditActionUi;
        if (ui && typeof ui.bind === 'function') {
          ui.bind(elements.inspector, {projectIndex: state.model && state.model.index});
        }
        if (ui && typeof ui.open === 'function') {
          try {
            ui.open(JSON.parse(visibleEditAction.dataset.visibleEditAction || '{}'), state.model && state.model.index);
          } catch (_err) {
            ui.open({}, state.model && state.model.index);
          }
        }
        return;
      }
      const eventWorkbenchAction = event.target.closest('[data-event-workbench-action]');
      if (eventWorkbenchAction) {
        handleEventWorkbenchAction(state, elements, eventWorkbenchAction.dataset.eventWorkbenchAction || '');
        return;
      }
      const existingAction = event.target.closest('[data-edit-existing]');
      if (existingAction) {
        handleEditExisting(state, elements);
        return;
      }
      const draftAction = event.target.closest('[data-edit-as-draft]');
      if (draftAction) {
        handleEditAsDraft(state, elements);
        return;
      }
      const textAction = event.target.closest('[data-edit-text-proposal]');
      if (textAction) {
        handleEditTextProposal(state, elements);
        return;
      }
      const routeAction = event.target.closest('[data-edit-route-action]');
      if (routeAction) {
        handleEditRouteAction(state, elements);
        return;
      }
      const variableAction = event.target.closest('[data-edit-variable]');
      if (variableAction) {
        handleEditVariable(state, elements);
        return;
      }
      const assetAction = event.target.closest('[data-asset-action]');
      if (assetAction) {
        handleAssetDraftAction(state, elements, assetAction);
        return;
      }
      const source = event.target.closest('[data-source-json]');
      if (!source) {
        const sceneLink = event.target.closest('[data-scene-id]');
        if (!sceneLink || !state.model) {
          return;
        }
        const scene = state.model.scenesById.get(String(sceneLink.dataset.sceneId));
        if (scene) {
          recordNavigation();
          state.view = 'scenes';
          state.query = '';
          state.sortField = VIEW_DEFS.scenes.defaultSort;
          state.sortDir = 'asc';
          elements.search.value = '';
          state.selectedKey = 'scenes:' + scene.id;
          state.selected = {view: 'scenes', item: scene, normalized: null};
          state.draftActionMessage = '';
          state.textActionMessage = '';
          render(state, elements);
        }
        return;
      }
      try {
        const ref = JSON.parse(source.dataset.sourceJson);
        recordNavigation();
        state.selectedKey = 'source:' + sourceLabel(ref);
        state.selected = {view: 'source', item: ref, normalized: null};
        state.draftActionMessage = '';
        state.textActionMessage = '';
        render(state, elements);
      } catch (err) {
        showError(elements, t('explore.sourceInspectFailed', 'Could not inspect source: {message}').replace('{message}', err.message));
      }
    });

    elements.inspector.addEventListener('input', (event) => {
      const input = event.target.closest('[data-text-revision-input]');
      if (!input || !state.selected || state.selected.view !== 'textCorpus') {
        return;
      }
      const key = input.dataset.textRevisionKey || textRevisionKey(state.selected.item);
      state.textProposalEdits[key] = input.value;
      updateTextRevisionDom(elements.inspector, state.selected.item, input.value, state);
    });

    elements.inspector.addEventListener('change', (event) => {
      const input = event.target.closest('[data-asset-repair-file]');
      if (!input) {
        return;
      }
      handleAssetRepairFileSelection(state, elements, input);
      input.value = '';
    });

    if (elements.topbarMore) {
      document.addEventListener('click', (event) => {
        if (elements.topbarMore.open && !event.target.closest('#topbar-more')) {
          elements.topbarMore.open = false;
        }
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && elements.topbarMore.open) {
          elements.topbarMore.open = false;
        }
      });
    }

    // The brand wordmark and the More-menu "Home" item both open the Home pane,
    // the Studio's home/dashboard surface. Home shares the shell's pane machinery
    // like the work modes, so entry is just a mode switch.
    function goHome(reason) {
      const shell = global.ProjectMapShellNavigation;
      if (shell && typeof shell.setMode === 'function') {
        shell.setMode('home', {reason: reason || 'user'});
      }
      if (elements.topbarMore) {
        elements.topbarMore.open = false;
      }
    }
    if (elements.wordmark) {
      elements.wordmark.addEventListener('click', () => goHome('user'));
      elements.wordmark.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          goHome('user');
        }
      });
    }
    if (elements.openHomeButton) {
      elements.openHomeButton.addEventListener('click', () => goHome('user'));
    }
    // Anything can request a return to Home by dispatching the openHome event
    // (the guided-tour landing and the Tutorial Library close handoff both do).
    const openHomeEventName = (global.ProjectMapStudioSharedConstants
      && global.ProjectMapStudioSharedConstants.EVENT_NAMES
      && global.ProjectMapStudioSharedConstants.EVENT_NAMES.openHome) || 'ProjectMap:open-home';
    document.addEventListener(openHomeEventName, () => goHome('event'));

    document.addEventListener('project-map:design-open-explore', (event) => {
      openDesignSelectionInExplore(event.detail || {}, state, elements);
    });
    document.addEventListener('project-map:locale-changed', () => {
      render(state, elements);
      applyI18n(document);
    });

    initDesktopBridge(state, elements);
    render(state, elements);
    const indexUrl = autoloadIndexUrl(global.location);
    if (indexUrl) {
      loadProjectIndexUrl(indexUrl, state, elements);
    }
  }

  function initDesktopBridge(state, elements) {
    const desktop = global.dendryDesktop;
    if (!desktop || !desktop.isDesktop) {
      return;
    }
    if (elements.desktopControls) {
      elements.desktopControls.classList.remove('hidden');
    }
    if (elements.desktopOnlyControls && elements.desktopOnlyControls.length) {
      elements.desktopOnlyControls.forEach((control) => control.classList.remove('hidden'));
    }
    if (elements.filePicker) {
      elements.filePicker.classList.add('hidden');
    }
    setStatus(elements, t('desktop.openProjectHint', 'Open a Dendry project folder to build a Project Map index.'));
    setDesktopStatus(elements, t('topbar.noProject', 'No project opened.'));

    global.addEventListener('ProjectMap:desktop-index-loaded', (event) => {
      applyDesktopProjectIndex(event.detail || {}, state, elements);
    });
    global.addEventListener('ProjectMap:desktop-scan-progress', (event) => {
      setDesktopProgress(elements, event.detail || {});
    });

    if (elements.desktopRunDoctor) {
      elements.desktopRunDoctor.addEventListener('click', () => {
        runDesktopDoctor(desktop, elements);
      });
    }

    if (elements.desktopOpenProject) {
      elements.desktopOpenProject.addEventListener('click', () => {
        openDesktopProject(desktop, elements);
      });
    }

    if (elements.desktopRebuildIndex) {
      elements.desktopRebuildIndex.addEventListener('click', () => {
        rebuildDesktopIndex(desktop, elements);
      });
    }

    if (typeof desktop.getState === 'function') {
      desktop.getState().then((stateInfo) => {
        if (stateInfo && stateInfo.lastProject) {
          const project = stateInfo.lastProject;
          setDesktopStatus(elements, t('desktop.lastProject', 'Last project: {project}')
            .replace('{project}', project.projectName || project.root || t('desktop.unknownProject', 'unknown')));
        }
      }).catch(() => {
        setDesktopStatus(elements, t('desktop.shellReady', 'Desktop shell ready.'));
      });
    }
  }

  function runDesktopDoctor(desktop, elements) {
    if (!desktop || typeof desktop.doctor !== 'function') {
      showError(elements, t('desktop.setupUnavailable', 'Desktop setup check is unavailable.'));
      return;
    }
    if (elements.desktopRunDoctor) {
      elements.desktopRunDoctor.disabled = true;
    }
    setDesktopStatus(elements, t('desktop.checkingSetup', 'Checking setup...'));
    setStatus(elements, t('desktop.checkingSetupLong', 'Checking desktop app files, bundled Python runtime, scratch storage, and project folder readiness.'));
    desktop.doctor({}).then((result) => {
      const message = desktopDoctorSummary(result);
      setDesktopStatus(elements, message, !result || !result.ok);
      if (result && result.ok) {
        setStatus(elements, message);
      } else {
        showError(elements, message);
      }
    }).catch((err) => {
      const message = err && err.message ? err.message : t('desktop.setupFailed', 'Desktop setup check failed.');
      setDesktopStatus(elements, message, true);
      setDesktopProgress(elements, {
        stage: 'failed',
        percent: 100,
        label: message,
        error: true
      });
      showError(elements, message);
    }).finally(() => {
      if (elements.desktopRunDoctor) {
        elements.desktopRunDoctor.disabled = false;
      }
    });
  }

  function desktopDoctorSummary(result) {
    if (!result || !result.checks) {
      return t('desktop.setupNoResult', 'Desktop setup check did not return a result.');
    }
    const labels = {
      resources: t('desktop.doctor.resources', 'App files'),
      scratch: t('desktop.doctor.scratch', 'Scratch folder'),
      python: t('desktop.doctor.python', 'Python runtime'),
      projectRoot: t('desktop.doctor.projectRoot', 'Project folder')
    };
    const failed = Object.keys(labels).filter((key) => {
      return result.checks[key] && !result.checks[key].ok;
    });
    if (!failed.length) {
      return result.message || t('desktop.readyToScan', 'Dendry Mod Studio is ready to scan this project.');
    }
    return failed.map((key) => {
      const check = result.checks[key];
      return labels[key] + ': ' + (check.message || t('desktop.needsAttention', 'needs attention'));
    }).join(' ');
  }

  function rebuildDesktopIndex(desktop, elements) {
    if (!desktop || typeof desktop.rebuildProjectIndex !== 'function') {
      showError(elements, t('desktop.rebuildUnavailable', 'Rebuild not available.'));
      return;
    }
    if (elements.desktopRebuildIndex) {
      elements.desktopRebuildIndex.disabled = true;
    }
    const includeExcerpts = Boolean(elements.desktopIncludeExcerpts && elements.desktopIncludeExcerpts.checked);
    setDesktopStatus(elements, t('desktop.rebuildingIndex', 'Rebuilding index (cache cleared)...'));
    setDesktopProgress(elements, {
      stage: 'rebuild',
      percent: 5,
      label: t('desktop.rebuildingIndex', 'Rebuilding index (cache cleared)...')
    });
    desktop.rebuildProjectIndex({includeExcerpts}).catch((err) => {
      const message = err && err.message ? err.message : t('desktop.rebuildFailed', 'Index rebuild failed.');
      setDesktopStatus(elements, message, true);
      showError(elements, message);
    }).finally(() => {
      if (elements.desktopRebuildIndex) {
        elements.desktopRebuildIndex.disabled = false;
      }
    });
  }

  function openDesktopProject(desktop, elements) {
    if (!desktop || typeof desktop.openProject !== 'function') {
      showError(elements, t('desktop.projectPickerUnavailable', 'Desktop project picker is unavailable.'));
      return;
    }
    const includeExcerpts = Boolean(elements.desktopIncludeExcerpts && elements.desktopIncludeExcerpts.checked);
    if (elements.desktopOpenProject) {
      elements.desktopOpenProject.disabled = true;
    }
    setDesktopStatus(elements, includeExcerpts
      ? t('desktop.buildingReviewIndex', 'Building review index...')
      : t('desktop.buildingProjectIndex', 'Building project index...'));
    setDesktopProgress(elements, {
      stage: 'starting',
      percent: 1,
      label: t('desktop.waitingProjectSelection', 'Waiting for project folder selection...')
    });
    setStatus(elements, t('desktop.scanningReadOnly', 'Scanning project. This stays read-only and writes the index to app scratch storage.'));
    desktop.openProject({includeExcerpts}).then((result) => {
      if (!result || result.canceled) {
        setDesktopStatus(elements, t('topbar.noProject', 'No project opened.'));
        clearDesktopProgress(elements);
        return;
      }
      if (!result.ok) {
        const message = result.message || (result.error && result.error.message) || t('desktop.openFailed', 'Could not open project.');
        finishDesktopFailure(elements, message, result.stage || 'failed');
      }
    }).catch((err) => {
      const message = err && err.message ? err.message : t('desktop.openFailed', 'Could not open project.');
      finishDesktopFailure(elements, message, 'failed');
    }).finally(() => {
      if (elements.desktopOpenProject) {
        elements.desktopOpenProject.disabled = false;
      }
    });
  }

  function applyDesktopProjectIndex(detail, state, elements) {
    try {
      if (!detail.index) {
        throw new Error('Desktop shell did not provide a ProjectIndex JSON payload.');
      }
      setDesktopProgress(elements, {
        stage: 'render',
        percent: 96,
        label: t('desktop.renderingProject', 'Rendering project workspace...')
      });
      const fileInfo = detail.fileInfo || {
        name: detail.indexPath || 'desktop ProjectIndex',
        size: detail.indexSize || 0
      };
      applyProjectIndex(detail.index, fileInfo, state, elements, {
        assetBaseUrl: detail.assetBaseUrl || ''
      });
      const summary = detail.summary || state.model.summary || {};
      const counts = [
        summary.sceneCount || 0,
        summary.edgeCount || 0,
        summary.variableCount || 0
      ].join(' / ');
      const name = detail.projectName || (state.model.project && state.model.project.name) || t('desktop.projectFallback', 'Project');
      setDesktopStatus(elements, t('desktop.projectLoaded', '{project} loaded.').replace('{project}', name));
      setDesktopProgress(elements, {
        stage: 'loaded',
        percent: 100,
        label: t('desktop.projectLoadedShort', 'Project loaded.')
      });
      clearDesktopProgressSoon(elements);
      setStatus(elements, t('desktop.projectIndexLoaded', 'Desktop ProjectIndex loaded: {counts} scenes / edges / variables.')
        .replace('{counts}', counts));
    } catch (err) {
      state.model = null;
      state.selected = null;
      finishDesktopFailure(elements, t('desktop.projectIndexLoadFailed', 'Could not load desktop ProjectIndex: {message}')
        .replace('{message}', err.message), 'read-index');
      render(state, elements);
    }
  }

  function finishDesktopFailure(elements, message, stage) {
    setDesktopStatus(elements, message, true);
    setDesktopProgress(elements, {
      stage: stage || 'failed',
      percent: 100,
      label: message,
      error: true
    });
    showError(elements, message);
    clearDesktopProgressSoon(elements, 2600);
  }

  function readProjectIndexFile(file, state, elements) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const index = JSON.parse(String(reader.result || ''));
        applyProjectIndex(index, {name: file.name, size: file.size}, state, elements);
      } catch (err) {
        state.model = null;
        state.selected = null;
        state.textActionMessage = '';
        showError(elements, err.validationErrors ? err.validationErrors.join('; ') : err.message);
        render(state, elements);
      }
    };
    reader.onerror = () => {
      showError(elements, t('desktop.readFileFailed', 'Could not read file.'));
    };
    reader.readAsText(file);
  }

  function autoloadIndexUrl(location) {
    if (!location || !location.search || typeof URLSearchParams === 'undefined') {
      return '';
    }
    const params = new URLSearchParams(location.search);
    const value = params.get('index');
    if (!value) {
      return '';
    }
    try {
      const resolved = new URL(value, location.href);
      if (resolved.origin !== location.origin) {
        return '';
      }
      return resolved.pathname + resolved.search;
    } catch (err) {
      return '';
    }
  }

  function autoloadAssetBaseUrl(location) {
    if (!location || !location.search || typeof URLSearchParams === 'undefined') {
      return '';
    }
    const params = new URLSearchParams(location.search);
    const value = params.get('assetBase');
    if (!value) {
      return '';
    }
    try {
      const resolved = new URL(value, location.href);
      if (resolved.origin !== location.origin) {
        return '';
      }
      return resolved.pathname + resolved.search;
    } catch (err) {
      return '';
    }
  }

  function loadProjectIndexUrl(indexUrl, state, elements) {
    if (typeof fetch !== 'function') {
      showError(elements, t('desktop.fetchUnavailable', 'Browser fetch API is unavailable; choose the ProjectIndex JSON file manually.'));
      return;
    }
    setStatus(elements, t('desktop.loadingIndex', 'Loading {index}...').replace('{index}', indexUrl));
    fetch(indexUrl, {cache: 'no-store'})
      .then((response) => {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ' while loading ' + indexUrl);
        }
        return response.text();
      })
      .then((text) => {
        const index = JSON.parse(text);
        applyProjectIndex(index, {name: indexUrl, size: text.length}, state, elements, {
          assetBaseUrl: state.assetBaseUrl
        });
      })
      .catch((err) => {
        state.model = null;
        state.selected = null;
        state.textActionMessage = '';
        showError(elements, t('desktop.autoLoadFailed', 'Could not auto-load ProjectIndex: {message}')
          .replace('{message}', err.message));
        render(state, elements);
      });
  }

  function applyProjectIndex(index, fileInfo, state, elements, options) {
    const assetBaseUrl = normalizeAssetBaseUrl(options && options.assetBaseUrl || state.assetBaseUrl || '');
    state.assetBaseUrl = assetBaseUrl;
    state.model = buildViewModel(indexWithAssetBaseUrl(index, assetBaseUrl));
    state.selectedKey = null;
    state.selected = null;
    state.listRenderSignature = '';
    state.draftActionMessage = '';
    state.textActionMessage = '';
    state.view = 'overview';
    state.query = '';
    state.sortField = VIEW_DEFS.overview.defaultSort;
    state.sortDir = 'desc';
    elements.search.value = '';
    // A freshly loaded project starts a clean back history.
    if (state.navHistory && typeof state.navHistory.clear === 'function') {
      state.navHistory.clear();
    }
    if (elements.navBack) {
      elements.navBack.disabled = true;
    }
    setStatus(elements, t('desktop.loadedFile', 'Loaded {file} ({size}).')
      .replace('{file}', fileInfo.name)
      .replace('{size}', formatBytes(fileInfo.size || 0)));
    notifyIndexLoaded(document, fileInfo, state.model);
    render(state, elements);
  }

  function normalizeAssetBaseUrl(value) {
    return String(value || '').trim();
  }

  function indexWithAssetBaseUrl(index, assetBaseUrl) {
    if (!assetBaseUrl || !index || !isObject(index)) {
      return index;
    }
    return Object.assign({}, index, {
      project: Object.assign({}, index.project || {}, {
        assetBaseUrl
      })
    });
  }

  function notifyIndexLoaded(document, file, model) {
    const detail = {
      index: model.index,
      model,
      fileName: file.name,
      fileSize: file.size,
      sourceExcerpts: hasSourceExcerpts(model.index)
    };
    document.dispatchEvent(new CustomEvent('project-map:index-loaded', {detail, bubbles: true}));
    if (global && typeof global.dispatchEvent === 'function') {
      global.dispatchEvent(new CustomEvent('project-map:index-loaded', {detail}));
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) {
      return bytes + ' B';
    }
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function setStatus(elements, message) {
    elements.status.classList.remove('is-error');
    elements.status.textContent = message;
  }

  function setDesktopStatus(elements, message, isError) {
    if (!elements || !elements.desktopStatus) {
      return;
    }
    elements.desktopStatus.classList.toggle('is-error', Boolean(isError));
    elements.desktopStatus.textContent = message;
  }

  function setDesktopProgress(elements, update) {
    if (!elements || !elements.desktopProgress) {
      return;
    }
    if (desktopProgressTimer) {
      global.clearTimeout(desktopProgressTimer);
      desktopProgressTimer = null;
    }
    const stage = String(update && update.stage || 'working');
    const percent = displayDesktopProgressPercent(clampPercent(update && update.percent), stage);
    const label = stage === 'complete' && clampPercent(update && update.percent) >= 100
      ? t('desktop.preparingWorkspace', 'Project Map index ready. Preparing workspace...')
      : String(update && update.label || 'Working...');
    elements.desktopProgress.classList.remove('hidden');
    elements.desktopProgress.classList.toggle('is-error', Boolean(update && update.error));
    elements.desktopProgress.setAttribute('aria-valuenow', String(percent));
    elements.desktopProgress.setAttribute('aria-label', label);
    elements.desktopProgress.dataset.stage = stage;
    if (elements.desktopProgressBar) {
      elements.desktopProgressBar.style.width = percent + '%';
    }
    if (elements.desktopProgressHint) {
      const hintKey = update && update.hintKey || '';
      const hintFallback = update && update.hint || '';
      const hint = hintKey ? t(hintKey, hintFallback) : hintFallback;
      if (hint) {
        elements.desktopProgressHint.textContent = hint;
        elements.desktopProgressHint.classList.remove('hidden');
      } else {
        elements.desktopProgressHint.classList.add('hidden');
      }
    }
    if (elements.desktopProgressLabel) {
      elements.desktopProgressLabel.textContent = percent + '% · ' + label;
    }
  }

  function displayDesktopProgressPercent(percent, stage) {
    if (percent >= 100 && stage === 'complete') {
      return 99;
    }
    return percent;
  }

  function clearDesktopProgressSoon(elements, delayMs) {
    if (desktopProgressTimer) {
      global.clearTimeout(desktopProgressTimer);
    }
    desktopProgressTimer = global.setTimeout(() => {
      clearDesktopProgress(elements);
      desktopProgressTimer = null;
    }, Number.isFinite(Number(delayMs)) ? Number(delayMs) : 700);
  }

  function clearDesktopProgress(elements) {
    if (!elements || !elements.desktopProgress) {
      return;
    }
    elements.desktopProgress.classList.add('hidden');
    elements.desktopProgress.classList.remove('is-error');
    elements.desktopProgress.setAttribute('aria-valuenow', '0');
    if (elements.desktopProgressBar) {
      elements.desktopProgressBar.style.width = '0%';
    }
    if (elements.desktopProgressLabel) {
      elements.desktopProgressLabel.textContent = t('topbar.idle', 'Idle');
    }
  }

  function clampPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(number)));
  }

  function showError(elements, message) {
    elements.status.classList.add('is-error');
    elements.status.textContent = message;
  }

})(typeof window !== 'undefined' ? window : globalThis);
