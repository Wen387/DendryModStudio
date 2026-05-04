(function initProjectMapExploreUi(root) {
  'use strict';

  function loadFactory(root, globalName, path) {
    if (root && root[globalName]) {
      return root[globalName];
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      return require(path);
    }
    throw new Error(globalName + ' module is unavailable.');
  }

  function createProjectMapExploreUi(ctx) {
    ctx = ctx || {};
    const listFactory = loadFactory(root, 'ProjectMapExploreLists', './explore_lists.js');
    const inspectorFactory = loadFactory(root, 'ProjectMapExploreInspector', './explore_inspector.js');
    const shared = Object.assign({}, ctx);
    const lists = listFactory(shared);
    Object.assign(shared, lists);
    const inspector = inspectorFactory(shared);
    Object.assign(shared, inspector);
    return {
      render: shared.render,
      renderList: shared.renderList,
      currentItems: shared.currentItems,
      renderOverview: shared.renderOverview,
      renderFirstModRoadmap: shared.renderFirstModRoadmap,
      renderAssetGallery: shared.renderAssetGallery,
      renderVirtualAssetGallery: shared.renderVirtualAssetGallery,
      renderAssetGalleryCard: shared.renderAssetGalleryCard,
      renderAssetPicker: shared.renderAssetPicker,
      renderDraftAssetPanel: shared.renderDraftAssetPanel,
      renderNewsList: shared.renderNewsList,
      renderTextCorpusList: shared.renderTextCorpusList,
      prepareVirtualList: shared.prepareVirtualList,
      renderListRow: shared.renderListRow,
      coverageClass: shared.coverageClass,
      priorityClass: shared.priorityClass,
      completionClass: shared.completionClass,
      escapeHtml: shared.escapeHtml,
      escapeAttr: shared.escapeAttr,
      badge: shared.badge,
      renderBadge: shared.renderBadge,
      labelForBadge: shared.labelForBadge,
      renderInspector: shared.renderInspector,
      renderInspectorPreview: shared.renderInspectorPreview,
      renderEditDraftAction: shared.renderEditDraftAction,
      renderTextProposalAction: shared.renderTextProposalAction,
      renderExtractionScope: shared.renderExtractionScope,
      previewDraftExtraction: shared.previewDraftExtraction,
      previewTextReplacement: shared.previewTextReplacement,
      draftActionSummary: shared.draftActionSummary,
      textProposalSummary: shared.textProposalSummary,
      handleEditAsDraft: shared.handleEditAsDraft,
      handleEditExisting: shared.handleEditExisting,
      handleEditTextProposal: shared.handleEditTextProposal,
      handleEditVariable: shared.handleEditVariable,
      handleEventWorkbenchAction: shared.handleEventWorkbenchAction,
      eventWorkbenchSeedForSelection: shared.eventWorkbenchSeedForSelection,
      eventWorkbenchActionStatus: shared.eventWorkbenchActionStatus,
      openDraftInCreate: shared.openDraftInCreate,
      activateMode: shared.activateMode,
      openDesignSelectionInExplore: shared.openDesignSelectionInExplore,
      designRowMatches: shared.designRowMatches,
      activateCreateTemplate: shared.activateCreateTemplate,
      sceneFromSelection: shared.sceneFromSelection,
      renderSourceButton: shared.renderSourceButton,
      renderSceneInspector: shared.renderSceneInspector,
      renderEventWorkbenchInspector: shared.renderEventWorkbenchInspector,
      renderVariableInspector: shared.renderVariableInspector,
      renderCoverageInspector: shared.renderCoverageInspector,
      renderDiagnosticInspector: shared.renderDiagnosticInspector,
      renderNewsInspector: shared.renderNewsInspector,
      renderSurfaceTextInspector: shared.renderSurfaceTextInspector,
      renderTextCorpusInspector: shared.renderTextCorpusInspector,
      renderTextRevisionPanel: shared.renderTextRevisionPanel,
      updateTextRevisionDom: shared.updateTextRevisionDom,
      renderTextRevisionDiff: shared.renderTextRevisionDiff,
      renderAssetInspector: shared.renderAssetInspector,
      renderAssetUseActions: shared.renderAssetUseActions,
      renderAssetRepairActions: shared.renderAssetRepairActions,
      renderAssetManifest: shared.renderAssetManifest,
      localizedAssetRoleLabel: shared.localizedAssetRoleLabel,
      handleAssetDraftAction: shared.handleAssetDraftAction,
      handleAssetRepairFileSelection: shared.handleAssetRepairFileSelection,
      parseAssetActionRef: shared.parseAssetActionRef,
      copyText: shared.copyText,
      renderAssetReferenceHelper: shared.renderAssetReferenceHelper,
      assetReferenceStateLabel: shared.assetReferenceStateLabel,
      renderAssetPreviewFrame: shared.renderAssetPreviewFrame,
      renderAssetUsageList: shared.renderAssetUsageList,
      renderSourceInspector: shared.renderSourceInspector,
      renderOverviewInspector: shared.renderOverviewInspector,
      renderEdgeSection: shared.renderEdgeSection,
      renderSceneEndpoint: shared.renderSceneEndpoint,
      renderMiniSection: shared.renderMiniSection,
      renderDiagnosticMini: shared.renderDiagnosticMini
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createProjectMapExploreUi;
  }

  if (root) {
    root.ProjectMapExploreUi = createProjectMapExploreUi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
