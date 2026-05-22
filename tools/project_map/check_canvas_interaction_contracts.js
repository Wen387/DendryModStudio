#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function contains(source, needle, label) {
  assert(source.includes(needle), label + ' should include `' + needle + '`');
}

function styleStub() {
  const props = Object.create(null);
  return {
    transform: '',
    transformOrigin: '',
    setProperty(name, value) {
      props[name] = String(value);
    },
    getPropertyValue(name) {
      return props[name] || '';
    }
  };
}

function elementStub() {
  return {
    style: styleStub(),
    textContent: '',
    offsetWidth: 1400,
    offsetHeight: 680,
    getBoundingClientRect() {
      return {left: 0, top: 0, width: 700, height: 420};
    }
  };
}

function rootStub(map) {
  return {
    querySelector(selector) {
      return map[selector] || null;
    }
  };
}

function checkDesignContracts() {
  const html = read('viewer/index.html');
  const designUi = read('viewer/design_ui.js');

  ['out', 'in', 'fit'].forEach((action) => {
    contains(html, 'data-design-zoom="' + action + '"', 'Design zoom control');
  });
  contains(html, 'id="design-inspector-toggle"', 'Design inspector toggle');
  contains(designUi, 'zoomControls: document.querySelector', 'Design UI element map');
  contains(designUi, 'elements.zoomControls.addEventListener(\'pointerdown\'', 'Design zoom controls');
  contains(designUi, 'elements.zoomControls.addEventListener(\'click\'', 'Design zoom controls');
  contains(designUi, 'handleDesignZoom(zoom.dataset.designZoom || \'\')', 'Design zoom controls');
  contains(designUi, 'event.preventDefault();\n        event.stopPropagation();\n        handleDesignZoom', 'Design zoom click isolation');
  contains(designUi, 'details.event-workbench-collapsible > summary, details.mini-section > summary, details.design-preview-collapsible > summary, details.meaning-collapsible > summary', 'Design inspector details delegate');
  contains(designUi, 'toggleInspectorDetails(collapsibleSummary.parentElement)', 'Design inspector details delegate');
  contains(designUi, 'restoreInspectorSectionState(selected)', 'Design inspector details state restore');
  contains(designUi, 'data-design-mini-section', 'Design mini-section marker');
  contains(designUi, 'data-design-preview-section', 'Design preview collapsible marker');
  contains(designUi, 'elements.inspectorToggle.addEventListener(\'pointerdown\'', 'Design inspector toggle');
  contains(designUi, 'toggleInspectorCollapse()', 'Design inspector toggle');
}

function checkObjectCanvasContracts() {
  const graphStage = read('viewer/object_canvas_graph_stage.js');
  const storyboardSurface = read('viewer/content_storyboard_surface.js');
  const objectUi = read('viewer/object_authoring_canvas_ui.js');
  const storyboardDrafts = read('viewer/object_canvas_storyboard_drafts.js');
  const fieldValues = read('viewer/object_canvas_field_values.js');
  const sourceSliceWorkspace = read('viewer/source_slice_workspace_ui.js');
  const semanticLogicWorkspace = read('viewer/semantic_logic_workspace_ui.js');
  const returnStack = read('viewer/object_workspace_return_stack.js');
  const visibleEditAction = read('viewer/visible_edit_action_ui.js');
  const eventBuilder = read('viewer/preview_object_event_builder_ui.js');
  const structureUi = read('viewer/preview_object_structure_ui.js');
  const viewport = read('viewer/object_canvas_viewport.js');
  const graphInteractions = read('viewer/content_graph_interactions.js');
  const shell = read('viewer/object_canvas_shell_ui.js');
  const editingCss = read('viewer/styles/editing.css');

  ['out', 'in', 'reset'].forEach((action) => {
    contains(graphStage, 'data-object-canvas-zoom="' + action + '"', 'Object Canvas graph zoom controls');
    contains(storyboardSurface, 'data-object-canvas-zoom="' + action + '"', 'Content Storyboard zoom controls');
  });
  contains(graphStage, 'data-object-canvas-zoom-label="true"', 'Object Canvas zoom label');
  contains(objectUi, 'querySelectorAll(\'[data-object-canvas-zoom]\')', 'Object Canvas zoom binding');
  contains(objectUi, 'button.addEventListener(\'click\', () => handleCanvasZoom', 'Object Canvas zoom binding');
  contains(viewport, 'label.textContent = Math.round(scale * 100) + \'%\'', 'Object Canvas viewport label update');
  contains(viewport, 'board.style.transform = transform', 'Object Canvas viewport transform update');
  contains(viewport, 'ZOOM_TRANSITION_MS', 'Object Canvas viewport smooth zoom transition timing');
  contains(viewport, 'nextZoom(previous, action, event)', 'Object Canvas viewport should centralize stepped and wheel zoom scaling');
  contains(viewport, 'viewportCanvas(root, event)', 'Object Canvas viewport should share pointer-centered zoom across Canvas surfaces');
  contains(graphInteractions, 'options.onZoom(event.deltaY < 0 ? \'in\' : \'out\', event)', 'Object Graph wheel zoom should pass the pointer event into the shared viewport');
  contains(shell, 'data-object-canvas-action="toggle_board_chrome"', 'Object Canvas chrome toggle');
  contains(shell, 'aria-expanded="', 'Object Canvas chrome toggle accessibility state');
  contains(shell, 'modalActive ? \'\' : opts.bodyHtml', 'Object Canvas modal should not duplicate the full editor body behind large object editors');
  contains(objectUi, 'action === \'toggle_board_chrome\'', 'Object Canvas chrome toggle handler');
  contains(objectUi, 'toggleBoardChrome()', 'Object Canvas chrome toggle handler');
  contains(objectUi, 'openVisibleEditAction', 'Object Canvas visible click-to-edit action bridge');
  contains(objectUi, 'openSourceSliceAction(editAction)', 'Object Canvas source slice action bridge');
  contains(objectUi, 'openSemanticLogicAction(editAction)', 'Object Canvas semantic logic action bridge');
  contains(read('viewer/index.html'), 'object_workspace_return_stack.js', 'Object Canvas transient workspace return stack include');
  contains(returnStack, 'ProjectMapObjectWorkspaceReturnStack', 'Object Canvas transient workspace return stack module');
  contains(returnStack, 'object_workspace_return_context', 'Object Canvas transient workspace return context marker');
  contains(objectUi, 'captureTransientReturnContext(editAction)', 'Object Canvas should capture the source object before opening transient workspaces');
  contains(objectUi, 'pushTransientReturnContext(returnContext)', 'Object Canvas should push a return context after source-backed editor mapping succeeds');
  contains(objectUi, 'data-object-canvas-action="return_from_transient_workspace"', 'Object Canvas transient workspace return action');
  contains(objectUi, 'returnFromTransientWorkspace()', 'Object Canvas transient workspace return handler');
  contains(objectUi, 'shouldKeepSemanticLogicActionInline(editAction)', 'Object Canvas should keep ordinary route/effect clicks in the current object editor');
  contains(objectUi, 'semanticEditorOpenMode === \'standalone\'', 'Object Canvas should require an explicit standalone semantic editor route');
  contains(objectUi, 'if (!sliceModel || !sliceModel.ok)', 'Object Canvas should not switch to Source Slice when source mapping fails');
  contains(objectUi, 'if (!editorModel || !editorModel.ok)', 'Object Canvas should not switch to Semantic Logic when source mapping fails');
  contains(objectUi, 'sourceSliceWorkspaceApi()', 'Object Canvas source slice UI module bridge');
  contains(objectUi, 'semanticLogicWorkspaceApi()', 'Object Canvas semantic logic UI module bridge');
  contains(sourceSliceWorkspace, 'ProjectMapSourceSliceWorkspace', 'Source Slice workspace module');
  contains(sourceSliceWorkspace, 'data-source-slice-textarea="true"', 'Source Slice editable textarea');
  contains(sourceSliceWorkspace, 'data-source-slice-advanced-confirm="true"', 'Source Slice advanced apply confirmation');
  contains(sourceSliceWorkspace, 'data-source-slice-diff="true"', 'Source Slice before/after diff');
  contains(sourceSliceWorkspace, 'data-source-slice-no-changes="true"', 'Source Slice no-op preview state');
  contains(sourceSliceWorkspace, 'reviewAllowed', 'Source Slice no-op and advanced review guard');
  contains(semanticLogicWorkspace, 'ProjectMapSemanticLogicWorkspace', 'Semantic Logic workspace module');
  contains(semanticLogicWorkspace, 'data-semantic-logic-editor="true"', 'Semantic Logic editor marker');
  contains(semanticLogicWorkspace, 'data-route-editor-evidence="true"', 'Route editor evidence marker');
  contains(semanticLogicWorkspace, 'data-effect-clause-evidence="true"', 'Effect clause editor evidence marker');
  contains(semanticLogicWorkspace, 'data-semantic-logic-field-controls="true"', 'Semantic Logic guided field controls');
  contains(semanticLogicWorkspace, "'route-target'", 'Semantic Logic route target control marker');
  contains(semanticLogicWorkspace, "'effect-value'", 'Semantic Logic effect value control marker');
  assert(!semanticLogicWorkspace.includes("'*='") && !semanticLogicWorkspace.includes("'/='"), 'Semantic Logic editor should not offer unsupported effect operators');
  contains(semanticLogicWorkspace, 'data-semantic-logic-advanced-confirm="true"', 'Semantic Logic advanced apply confirmation');
  contains(semanticLogicWorkspace, 'data-semantic-logic-diff="true"', 'Semantic Logic before/after diff marker');
  contains(objectUi, 'sourceSliceReviewAllowed()', 'Object Canvas source slice advanced apply review guard');
  contains(objectUi, 'semanticLogicReviewAllowed()', 'Object Canvas semantic logic advanced apply review guard');
  contains(objectUi, 'objectCanvasFieldValuesApi()', 'Object Canvas field collection should use the field value helper');
  contains(objectUi, 'dispatch: false', 'Structure builder part typing should not refresh/collapse the Object Canvas before commit');
  contains(fieldValues, 'collectCanvasFieldEntries(host, options)', 'Object Canvas field collection should use de-duplicated visible field entries');
  contains(fieldValues, 'fieldIsVisibleForCollection(input, options)', 'Object Canvas field collection should ignore hidden duplicate editor controls');
  contains(fieldValues, 'isCollectableField', 'Object Canvas field collection should ignore non-control asset/list entries');
  contains(fieldValues, 'const activeRow = rows.find((row) => row.active && row.visible)', 'Object Canvas field collection should prefer focused controls only when they are visible');
  contains(storyboardDrafts, 'ProjectMapObjectCanvasStoryboardDrafts', 'Object Canvas Storyboard draft helper should expose a browser API');
  contains(storyboardDrafts, 'createRelatedDraft', 'Object Canvas Storyboard draft helper should own related draft creation');
  contains(objectUi, 'storyboardDraftsApi().createRelatedDraft', 'Object Canvas should delegate Storyboard draft creation to the extracted helper');
  contains(visibleEditAction, 'data-visible-edit-action', 'Visible edit action clickable marker');
  contains(visibleEditAction, 'openVisibleEditAction', 'Visible edit action dispatch bridge');
  contains(objectUi, 'bindVisibleEditUi(elements.host)', 'Object Canvas should bind visible edit/context lens controls after render');
  contains(objectUi, 'syncPreviewObjectEditorPane();\n    syncObjectCanvasFieldValues();', 'Object Canvas should rerender preview pane inside dynamic surface sync');
  contains(objectUi, 'syncPreviewObjectRenderedFields();\n    bindVisibleEditUi(elements.host);', 'Object Canvas should rebind context lens controls after preview pane rerender');
  contains(read('viewer/explore_lists.js'), 'data-visible-edit-affordance="true"', 'Explore list edit affordance marker');
  contains(read('viewer/event_workbench_ui.js'), 'renderEditAction(row, locale)', 'Event Workbench edit affordance renderer');
  contains(read('viewer/card_board_surface.js'), 'data-visible-edit-affordance="card-board"', 'Card Board edit affordance marker');
  contains(read('viewer/preview_object_editor.js'), 'data-visible-edit-affordance="object-canvas-preview"', 'Object Canvas preview edit affordance marker');
  contains(read('viewer/preview_object_metadata_ui.js'), 'data-metadata-kind="', 'Object Canvas preview metadata layout marker');
  contains(read('viewer/preview_object_editor.js'), 'data-object-canvas-asset-replacement="true"', 'Object Canvas exact asset directive replacement marker');
  contains(read('viewer/preview_object_editor.js'), 'data-object-canvas-asset-filter="true"', 'Object Canvas asset selectors should expose an inline filter for large project catalogs');
  contains(read('viewer/preview_object_editor.js'), 'data-existing-asset-field="', 'Object Canvas asset replacement should preserve the existing source field id');
  contains(objectUi, 'filterObjectCanvasAssetSelect', 'Object Canvas should filter large indexed asset selects without rebuilding the editor');
  contains(objectUi, 'input.dataset.existingAssetField', 'Object Canvas asset file handler should route existing source-backed asset replacements');
  contains(objectUi, 'focusDraftField, render, showWorkspace', 'Object Canvas should export the field focus callback into Card Board deps');
  contains(read('viewer/card_board_surface.js'), 'data-card-board-option-field', 'Card Board should surface stable option field ids');
  contains(read('viewer/card_board_surface.js'), 'data-card-board-lane-anchor-text', 'Card Board lane targets should surface source-backed lane anchors');
  contains(read('viewer/card_board_interactions.js'), 'fieldId: option.dataset.cardBoardOptionField', 'Card Board option selection should pass the Object Canvas field id');
  contains(read('viewer/card_workspace_state.js'), 'deps.focusDraftField(fieldId)', 'Card Board option selection should focus Object Canvas fields after render');
  contains(objectUi, 'state.values[fieldId] = existingAssetReferenceLine', 'Object Canvas existing asset replacement should write directive or inline source replacement values');
  contains(objectUi, 'removeExistingAssetReference', 'Object Canvas existing asset references should expose a removal action');
  contains(objectUi, 'existingAssetReferenceLine', 'Object Canvas existing asset references should format directive and inline markdown edits through one helper');
  contains(objectUi, 'state.proposalOptions.assetInstallRequests = upsertObjectCanvasAssetInstallRequest', 'Object Canvas existing asset replacement should carry asset install requests into Review & Apply options');
  contains(objectUi, 'state.mode === \'existing\' && state.model && state.model.objectId', 'Object Canvas existing asset replacement target paths should use the existing object id');
  contains(read('viewer/index.html'), 'preview_object_event_builder_ui.js', 'Complex Event Builder renderer module include');
  contains(eventBuilder, 'ProjectMapPreviewObjectEventBuilder', 'Complex Event Builder extracted renderer module');
  contains(eventBuilder, 'data-preview-object-event-graph-node', 'Complex Event Builder graph node entry marker');
  contains(eventBuilder, 'data-preview-object-event-graph-edge', 'Complex Event Builder graph route entry marker');
  contains(eventBuilder, 'data-readiness-repair-action', 'Complex Event Builder readiness repair marker');
  contains(read('viewer/index.html'), 'preview_object_structure_ui.js', 'Preview Object structure UI module include');
  contains(structureUi, 'ProjectMapPreviewObjectStructureUi', 'Preview Object structure UI extracted module');
  contains(structureUi, 'data-preview-object-structure-builder="', 'Preview Object structure builder marker');
  contains(structureUi, 'data-preview-object-inline-add="', 'Preview Object inline structural add marker');
  contains(structureUi, 'data-object-canvas-action="commit_structure_command"', 'Preview Object structure commit action');
  contains(structureUi, 'data-object-canvas-field', 'Preview Object structure source-backed field marker');
  contains(read('viewer/object_canvas_graph_stage.js'), 'data-workflow-entry="', 'Object Canvas workflow entry marker');
  contains(editingCss, '.object-canvas.is-board-chrome-collapsed', 'Object Canvas collapsed chrome style');
  contains(editingCss, '.source-slice-editor', 'Source Slice Editor style');
  contains(editingCss, '.visible-edit-action-button', 'Visible edit button style');
  contains(editingCss, '.object-editing-preview-metadata-chip[data-metadata-kind="route"]', 'Object preview route metadata chip style');
  contains(editingCss, '.object-editing-preview-metadata-chip[data-metadata-kind="condition"]', 'Object preview condition metadata chip style');
  contains(read('viewer/styles/design.css'), '.design-preview-collapsible > summary', 'Design preview collapsible style');
  contains(editingCss, '.preview-object-event-graph-node', 'Complex Event Builder graph node style');
}

function checkStoryboardContracts() {
  const interactions = read('viewer/content_storyboard_interactions.js');
  const palette = read('viewer/storyboard_palette_sidebar.js');
  const paletteCss = read('viewer/styles/content-storyboard-palette.css');
  const workspace = read('viewer/storyboard_workspace_state.js');
  const objectUi = read('viewer/object_authoring_canvas_ui.js');

  contains(interactions, '[data-content-storyboard-floating-controls], [data-storyboard-palette]', 'Storyboard interaction exclusion');
  contains(interactions, 'canvas.addEventListener(\'wheel\'', 'Storyboard wheel zoom binding');
  contains(interactions, 'options.onZoom(event.deltaY < 0 ? \'in\' : \'out\', event)', 'Storyboard wheel zoom callback');
  contains(interactions, '{passive: false}', 'Storyboard wheel zoom passive guard');
  contains(palette, 'data-storyboard-palette-open="', 'Storyboard palette open state marker');
  contains(palette, 'data-storyboard-palette-toggle="true"', 'Storyboard palette toggle marker');
  contains(palette, 'data-object-canvas-action="toggle_story_palette"', 'Storyboard palette toggle action');
  contains(palette, 'aria-expanded="', 'Storyboard palette accessibility state');
  contains(workspace, 'action === \'toggle_story_palette\'', 'Storyboard palette toggle handler');
  contains(workspace, '? closePaletteWithMotion(state, deps)', 'Storyboard palette toggle should route closing through motion');
  contains(workspace, 'storyPaletteOpen: true', 'Storyboard palette toggle should still open through palette refresh');
  contains(workspace, 'closePaletteWithMotion', 'Storyboard palette close should allow the drawer to animate out');
  contains(workspace, 'currentOpen && next.getAttribute', 'Storyboard palette should detect already-open refreshes');
  contains(workspace, 'next.classList.add(\'is-refreshing\')', 'Storyboard palette should suppress open animation during search/filter refreshes');
  contains(paletteCss, '.storyboard-palette.is-closing', 'Storyboard palette closing animation state');
  contains(paletteCss, '.storyboard-palette.is-open.is-refreshing:not(.is-closing) .storyboard-palette-drawer', 'Storyboard palette filtering should not replay the open animation');
  contains(paletteCss, '@keyframes storyboard-palette-enter', 'Storyboard palette open animation');
  contains(paletteCss, '@keyframes storyboard-palette-exit', 'Storyboard palette close animation');
  contains(objectUi, 'handleStoryboardAction(action, target)', 'Object Canvas storyboard action bridge');
}

function checkReviewAndLensContracts() {
  const installReview = read('viewer/install_review_ui.js');
  const installAssistant = read('viewer/install_assistant_ui.js');
  const installCss = read('viewer/styles/install-preview.css');
  const dialogsCss = read('viewer/styles/dialogs.css');
  const editingCss = read('viewer/styles/editing.css');
  const eventWorkbench = read('viewer/event_workbench_ui.js');
  const runtimeLens = read('viewer/runtime_lens_ui.js');
  const runtimeLensWorkspace = read('viewer/runtime_lens_workspace_state.js');
  const runtimePreviewLoading = read('viewer/runtime_preview_loading_ui.js');
  const visibleEdit = read('viewer/visible_edit_action_ui.js');

  contains(installReview, '<details>', 'Review & Apply operation details');
  contains(installReview, 'install.human.advancedDetails', 'Review & Apply operation details summary');
  contains(installReview, 'data-authoring-context-lens="true"', 'Review & Apply context lens marker');
  contains(installCss, '.install-human-op details', 'Review & Apply details style');
  contains(installAssistant, 'confirmEnableAdvanced()', 'Install assistant should confirm before enabling advanced operations');
  contains(installAssistant, 'install.confirmEnableAdvanced', 'Install assistant should explain advanced-operation risk');
  contains(installCss, 'background: #fff7d6', 'Advanced operation toggle should use a visible but restrained warning block');
  contains(installCss, '.install-advanced-toggle.is-disabled', 'Advanced operation toggle should stay visible but disabled when no advanced operations exist');
  contains(installCss, '.wizard-actions.install-actions', 'Install action bar should override generic wizard action layout');
  contains(read('viewer/index.html'), 'class="install-action-icon" data-ui-icon="search"', 'Install action buttons should include inline icons');
  contains(read('viewer/index.html'), 'data-install-advanced-label', 'Install advanced toggle should preserve its icon while updating dynamic label text');
  contains(installCss, '.install-actions .ui-icon', 'Install action icons should have compact toolbar sizing');
  contains(installAssistant, 'syncAdvancedToggle', 'Install assistant should keep the advanced toggle label and disabled state synchronized');
  contains(read('viewer/index.html'), 'runtime_preview_loading_ui.js', 'Runtime preview loading helper should be loaded by the viewer');
  contains(runtimePreviewLoading, 'ProjectMapRuntimePreviewLoading', 'Runtime preview loading helper should expose a shared UI API');
  contains(runtimePreviewLoading, 'data-runtime-preview-loading-overlay', 'Runtime preview loading helper should mark the overlay with a stable data hook');
  contains(runtimePreviewLoading, 'document.createElement(\'progress\')', 'Runtime preview loading helper should render only progress for the visible control');
  contains(dialogsCss, '.runtime-preview-loading-overlay', 'Runtime preview loading overlay should have dialog-level styling');
  contains(installAssistant, 'showRuntimePreviewLoading()', 'Install assistant should show the shared runtime preview loading overlay');
  contains(runtimeLensWorkspace, 'showRuntimePreviewLoading()', 'Runtime Lens should show the shared runtime preview loading overlay');
  contains(read('viewer/i18n/zh-Hant.js'), "'install.includeAdvancedCount': '進階修改（{count}）'", 'Advanced operation toggle should show a localized operation count');
  contains(read('viewer/i18n/zh-Hant.js'), "'install.noAdvancedChanges': '沒有進階修改'", 'Advanced operation toggle should explain when no advanced operations exist');
  contains(editingCss, '.authoring-context-lens-popover', 'Authoring context lens popover style');
  contains(editingCss, 'data-context-lens-placement="left"', 'Authoring context lens left-edge placement style');
  contains(editingCss, '.authoring-context-lens[data-authoring-context-lens][aria-expanded="true"]', 'Authoring context lens elevated open state');
  contains(visibleEdit, 'bindContextLens', 'Authoring context lens interaction binding');
  contains(visibleEdit, 'data-context-lens-pinned', 'Authoring context lens pinned state');
  contains(visibleEdit, 'updateContextLensPlacement', 'Authoring context lens boundary-aware placement binding');
  contains(eventWorkbench, 'event-workbench-collapsible', 'Event Workbench collapsible sections');
  contains(eventWorkbench, 'data-event-workbench-section="', 'Event Workbench section marker');
  contains(runtimeLens, 'data-runtime-lens-action="toggle_collapse"', 'Runtime Lens collapse action');
  contains(runtimeLens, 'data-runtime-lens-action="toggle_expand"', 'Runtime Lens expand action');
  contains(runtimeLens, 'root.querySelectorAll(\'[data-runtime-lens-action]\')', 'Runtime Lens action binding');
  contains(runtimeLens, 'button.dataset.runtimeLensBound = \'true\'', 'Runtime Lens duplicate binding guard');
  contains(runtimeLensWorkspace, 'renderRuntimeLensEvidence', 'Runtime Lens evidence update contract');
  contains(read('viewer/object_authoring_canvas_ui.js'), 'updateRuntimeLensEvidence', 'Runtime Lens evidence update contract');
  contains(read('viewer/object_authoring_canvas_ui.js'), 'syncObjectCanvasReviewButtons', 'Object Canvas should synchronize duplicate Review & Apply buttons after programmatic asset edits');
  contains(read('viewer/object_authoring_canvas_ui.js'), 'dataset.reviewState', 'Object Canvas Review & Apply buttons should expose synchronized ready/blocked state');
  contains(read('viewer/object_authoring_canvas_ui.js'), 'syncObjectCanvasAssetActionState', 'Object Canvas should synchronize asset action button labels after programmatic asset edits');
}

function checkRenderedAndPureBehavior() {
  const viewport = require('./viewer/object_canvas_viewport.js');
  const installReview = require('./viewer/install_review_ui.js');
  const eventWorkbench = require('./viewer/event_workbench_ui.js');
  const runtimeLens = require('./viewer/runtime_lens_ui.js');
  const fieldValues = require('./viewer/object_canvas_field_values.js');
  const previewEditorSync = require('./viewer/object_canvas_preview_editor_sync.js');

  const board = elementStub();
  const edges = elementStub();
  const label = elementStub();
  const canvas = elementStub();
  canvas.dataset = {objectCanvasGraphCanvas: 'true'};
  canvas.getBoundingClientRect = () => ({left: 0, top: 0, width: 700, height: 420});
  const root = rootStub({
    '[data-object-canvas-graph-board]': board,
    '[data-object-canvas-graph-edges]': edges,
    '[data-object-canvas-zoom-label]': label,
    '[data-object-canvas-graph-canvas]': canvas
  });
  const state = {canvasZoom: 1, canvasPanX: 0, canvasPanY: 0};
  viewport.zoom(root, state, 'in');
  assert(state.canvasZoom > 1, 'Object Canvas viewport zoom should increase state');
  assert(label.textContent === '110%', 'Object Canvas viewport zoom should update the label');
  assert(board.style.transform.includes('scale(1.100)'), 'Object Canvas viewport zoom should update board transform');
  assert(board.style.transition.includes('transform'), 'Object Canvas viewport zoom should apply a short transform transition');
  const centeredState = {canvasZoom: 1, canvasPanX: 0, canvasPanY: 0};
  viewport.zoom(root, centeredState, 'in', {deltaY: -120, clientX: 350, clientY: 210, currentTarget: canvas});
  assert(centeredState.canvasZoom > 1.01, 'Object Canvas viewport wheel zoom should use continuous scaling');
  assert(centeredState.canvasPanX < 0 && centeredState.canvasPanY < 0, 'Object Canvas viewport wheel zoom should keep the pointer as the zoom center');

  const visibleField = fieldStub('title', 'visible', {rects: [{}]});
  const activeField = fieldStub('title', 'active', {rects: [{}]});
  const structureField = fieldStub('body', 'structure', {
    previewObjectStructureOutput: 'true',
    value: 'Generated body'
  });
  const firstHiddenField = fieldStub('body', 'first');
  const assetArticle = fieldStub('asset:path', undefined, {tagName: 'ARTICLE', type: ''});
  const host = fieldHost([visibleField, activeField, firstHiddenField, structureField, assetArticle]);
  const collected = fieldValues.collectCanvasFieldEntries(host, {
    activeElement: activeField,
    getComputedStyle: () => ({display: 'block', visibility: 'visible'})
  });
  assert(collected[0] === activeField, 'Object Canvas field helper should prefer the active duplicate field');
  assert(collected[1] === structureField, 'Object Canvas field helper should prefer valued structure output before the first hidden duplicate');
  assert(!collected.includes(assetArticle), 'Object Canvas field helper should ignore non-control asset/list entries');
  const hiddenActiveField = fieldStub('subtitle', 'stale hidden active');
  const visibleDuplicateField = fieldStub('subtitle', 'visible duplicate', {rects: [{}]});
  const visibleDuplicateCollected = fieldValues.collectCanvasFieldEntries(fieldHost([hiddenActiveField, visibleDuplicateField]), {
    activeElement: hiddenActiveField,
    getComputedStyle: () => ({display: 'block', visibility: 'visible'})
  });
  assert(visibleDuplicateCollected[0] === visibleDuplicateField, 'Object Canvas field helper should not let a hidden active duplicate override the visible editor field');

  const planHtml = installReview.renderPlanReview({
    plan: {operations: [{id: 'probe', type: 'replace_text', path: 'source/probe.scene.dry', safety: 'guarded_apply', search: 'before', replace: 'after'}]},
    summary: {total: 1},
    installApi: {
      classifyOperation: (operation) => ({status: operation.safety, operation})
    }
  });
  contains(planHtml, '<details>', 'Review & Apply rendered operation details');
  contains(planHtml, 'data-install-operation-id="probe"', 'Review & Apply rendered operation marker');

  const eventHtml = eventWorkbench.renderEventWorkbench({
    sceneId: 'probe',
    title: 'Probe',
    playerText: [{role: 'body', text: 'Visible text.'}],
    options: [{id: 'next', label: 'Continue.'}],
    actions: [{id: 'follow_up'}]
  });
  contains(eventHtml, 'event-workbench-collapsible', 'Event Workbench rendered collapsibles');
  contains(eventHtml, 'data-event-workbench-section="playerText"', 'Event Workbench rendered section marker');

  const collapsedLens = runtimeLens.renderPanel({
    focus: {label: 'Probe'},
    collapsed: true,
    expanded: false,
    status: 'ready',
    url: 'about:blank',
    session: {ok: true}
  });
  contains(collapsedLens, 'is-collapsed', 'Runtime Lens collapsed render state');
  assert(!collapsedLens.includes('data-runtime-lens-frame="true"'), 'Runtime Lens collapsed state should hide the iframe');

  const fieldMap = previewEditorSync.previewObjectFieldMap({
    eventBody: {
      title: {id: 'title'},
      heading: {id: 'heading'},
      sections: [{id: 'section'}],
      metaFields: [{id: 'meta'}],
      structureActions: [{id: 'structure'}],
      effects: [{id: 'effect'}],
      options: [{fields: [{id: 'option_field'}]}],
      optionEffects: [{fields: [{id: 'option_effect'}]}]
    }
  });
  ['title', 'heading', 'section', 'meta', 'structure', 'effect', 'option_field', 'option_effect'].forEach((id) => {
    assert(fieldMap.has(id), 'Preview editor field map should collect ' + id);
  });

  const activeInput = syncFieldStub('title', 'typed', {tagName: 'INPUT'});
  const textInput = syncFieldStub('body', 'old body', {tagName: 'TEXTAREA'});
  const checkbox = syncFieldStub('flag', '', {tagName: 'INPUT', type: 'checkbox'});
  previewEditorSync.syncObjectCanvasFieldValues({
    host: syncHost([activeInput, textInput, checkbox]),
    state: {values: {title: 'model title', body: 'new body', flag: 'on'}},
    document: {activeElement: activeInput}
  });
  assert(activeInput.value === 'typed', 'Preview editor sync should not overwrite the focused input');
  assert(textInput.value === 'new body', 'Preview editor sync should update non-focused text fields');
  assert(checkbox.checked === true, 'Preview editor sync should treat on as a checked checkbox value');
  previewEditorSync.syncObjectCanvasFieldValues({
    host: syncHost([checkbox]),
    state: {values: {flag: 'false'}},
    document: {activeElement: null}
  });
  assert(checkbox.checked === false, 'Preview editor sync should treat false as an unchecked checkbox value');

  const removeAssetButton = syncAssetActionButtonStub('asset_face_image_7');
  previewEditorSync.syncObjectCanvasAssetActionState({
    host: syncAssetActionHost([removeAssetButton]),
    state: {values: {asset_face_image_7: ''}},
    t: (key, fallback) => key === 'assets.restoreReference' ? '撤銷刪除' : fallback
  });
  assert(removeAssetButton.textContent === '撤銷刪除', 'Preview editor sync should relabel pending asset removal buttons');
  assert(removeAssetButton.dataset.assetRemovalState === 'pending', 'Preview editor sync should mark pending asset removal state');
  assert(removeAssetButton.attributes['aria-pressed'] === 'true', 'Preview editor sync should expose pending asset removal as pressed');
  assert(removeAssetButton.classList.has('is-pending-removal'), 'Preview editor sync should style pending asset removal buttons');
  previewEditorSync.syncObjectCanvasAssetActionState({
    host: syncAssetActionHost([removeAssetButton]),
    state: {values: {}}
  });
  assert(removeAssetButton.textContent === 'Remove reference', 'Preview editor sync should restore idle asset removal labels');
  assert(removeAssetButton.dataset.assetRemovalState === 'idle', 'Preview editor sync should clear pending asset removal state');
  assert(removeAssetButton.attributes['aria-pressed'] === 'false', 'Preview editor sync should expose idle asset removal as not pressed');
  assert(!removeAssetButton.classList.has('is-pending-removal'), 'Preview editor sync should remove pending asset removal styling');

  const summaryHtml = previewEditorSync.renderPreviewObjectDraftSummary({
    template: 'card',
    changeState: {changedCount: 2, operationSummary: {guardedApply: 1, manualReview: 3}}
  });
  ['Changed', 'Guarded', 'Manual', 'Editor route'].forEach((label) => {
    contains(summaryHtml, label, 'Preview editor draft summary');
  });
  assert(previewEditorSync.previewObjectRouteLabel({template: 'news'}) === 'News', 'Preview editor route label should map news');
  assert(previewEditorSync.previewObjectRouteLabel({template: 'card'}) === 'Card', 'Preview editor route label should map card');
  assert(previewEditorSync.previewObjectRouteLabel({template: 'surface'}) === 'Text Patch', 'Preview editor route label should map surface');
  assert(previewEditorSync.previewObjectRouteLabel({template: 'event'}) === 'World Event', 'Preview editor route label should map event');
}

function fieldHost(fields) {
  return {
    querySelectorAll(selector) {
      assert(selector === '[data-object-canvas-field]', 'Object Canvas field helper should query the field contract');
      return fields;
    }
  };
}

function fieldStub(key, value, options) {
  const opts = options || {};
  const dataset = {objectCanvasField: key};
  if (opts.previewObjectStructureOutput) {
    dataset.previewObjectStructureOutput = opts.previewObjectStructureOutput;
  }
  return {
    dataset,
    disabled: false,
    tagName: opts.tagName || 'TEXTAREA',
    type: 'textarea',
    value,
    offsetWidth: opts.offsetWidth || 0,
    offsetHeight: opts.offsetHeight || 0,
    closest: () => null,
    getClientRects: () => opts.rects || [],
    matches: (selector) => {
      const tag = String(opts.tagName || 'TEXTAREA').toLowerCase();
      return String(selector || '').split(',').map((part) => part.trim()).includes(tag);
    }
  };
}

function syncHost(fields) {
  return {
    querySelectorAll(selector) {
      assert(selector === '[data-object-canvas-field]', 'Preview editor sync should query the field contract');
      return fields;
    }
  };
}

function syncAssetActionHost(buttons) {
  return {
    querySelectorAll(selector) {
      assert(selector === '[data-object-canvas-action="remove_asset_reference"][data-existing-asset-field]', 'Preview editor sync should query asset action buttons by stable contract');
      return buttons;
    }
  };
}

function syncFieldStub(key, value, options) {
  const opts = options || {};
  return {
    checked: false,
    dataset: {objectCanvasField: key},
    tagName: opts.tagName || 'INPUT',
    type: opts.type || 'text',
    value
  };
}

function syncAssetActionButtonStub(fieldId) {
  const classes = new Set();
  return {
    attributes: {},
    classList: {
      has: (name) => classes.has(name),
      toggle: (name, enabled) => {
        if (enabled) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
      }
    },
    dataset: {existingAssetField: fieldId},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    textContent: 'Remove reference'
  };
}

function main() {
  checkDesignContracts();
  checkObjectCanvasContracts();
  checkStoryboardContracts();
  checkReviewAndLensContracts();
  checkRenderedAndPureBehavior();
  process.stdout.write(JSON.stringify({
    ok: true,
    contracts: ['design', 'object_canvas', 'storyboard', 'review_apply', 'runtime_lens']
  }, null, 2) + '\n');
}

main();
