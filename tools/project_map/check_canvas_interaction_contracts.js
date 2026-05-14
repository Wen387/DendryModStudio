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
  contains(designUi, 'details.event-workbench-collapsible > summary, details.mini-section > summary', 'Design inspector details delegate');
  contains(designUi, 'toggleInspectorDetails(collapsibleSummary.parentElement)', 'Design inspector details delegate');
  contains(designUi, 'restoreInspectorSectionState(selected)', 'Design inspector details state restore');
  contains(designUi, 'data-design-mini-section', 'Design mini-section marker');
  contains(designUi, 'elements.inspectorToggle.addEventListener(\'pointerdown\'', 'Design inspector toggle');
  contains(designUi, 'toggleInspectorCollapse()', 'Design inspector toggle');
}

function checkObjectCanvasContracts() {
  const graphStage = read('viewer/object_canvas_graph_stage.js');
  const storyboardSurface = read('viewer/content_storyboard_surface.js');
  const objectUi = read('viewer/object_authoring_canvas_ui.js');
  const sourceSliceWorkspace = read('viewer/source_slice_workspace_ui.js');
  const semanticLogicWorkspace = read('viewer/semantic_logic_workspace_ui.js');
  const visibleEditAction = read('viewer/visible_edit_action_ui.js');
  const eventBuilder = read('viewer/preview_object_event_builder_ui.js');
  const viewport = read('viewer/object_canvas_viewport.js');
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
  contains(shell, 'data-object-canvas-action="toggle_board_chrome"', 'Object Canvas chrome toggle');
  contains(shell, 'aria-expanded="', 'Object Canvas chrome toggle accessibility state');
  contains(objectUi, 'action === \'toggle_board_chrome\'', 'Object Canvas chrome toggle handler');
  contains(objectUi, 'toggleBoardChrome()', 'Object Canvas chrome toggle handler');
  contains(objectUi, 'openVisibleEditAction', 'Object Canvas visible click-to-edit action bridge');
  contains(objectUi, 'openSourceSliceAction(editAction)', 'Object Canvas source slice action bridge');
  contains(objectUi, 'openSemanticLogicAction(editAction)', 'Object Canvas semantic logic action bridge');
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
  contains(visibleEditAction, 'data-visible-edit-action', 'Visible edit action clickable marker');
  contains(visibleEditAction, 'openVisibleEditAction', 'Visible edit action dispatch bridge');
  contains(read('viewer/explore_lists.js'), 'data-visible-edit-affordance="true"', 'Explore list edit affordance marker');
  contains(read('viewer/event_workbench_ui.js'), 'renderEditAction(row, locale)', 'Event Workbench edit affordance renderer');
  contains(read('viewer/card_board_surface.js'), 'data-visible-edit-affordance="card-board"', 'Card Board edit affordance marker');
  contains(read('viewer/preview_object_editor.js'), 'data-visible-edit-affordance="object-canvas-preview"', 'Object Canvas preview edit affordance marker');
  contains(read('viewer/index.html'), 'preview_object_event_builder_ui.js', 'Complex Event Builder renderer module include');
  contains(eventBuilder, 'ProjectMapPreviewObjectEventBuilder', 'Complex Event Builder extracted renderer module');
  contains(eventBuilder, 'data-preview-object-event-graph-node', 'Complex Event Builder graph node entry marker');
  contains(eventBuilder, 'data-preview-object-event-graph-edge', 'Complex Event Builder graph route entry marker');
  contains(eventBuilder, 'data-readiness-repair-action', 'Complex Event Builder readiness repair marker');
  contains(read('viewer/object_canvas_graph_stage.js'), 'data-workflow-entry="', 'Object Canvas workflow entry marker');
  contains(editingCss, '.object-canvas.is-board-chrome-collapsed', 'Object Canvas collapsed chrome style');
  contains(editingCss, '.source-slice-editor', 'Source Slice Editor style');
  contains(editingCss, '.visible-edit-action-button', 'Visible edit button style');
  contains(editingCss, '.preview-object-event-graph-node', 'Complex Event Builder graph node style');
}

function checkStoryboardContracts() {
  const interactions = read('viewer/content_storyboard_interactions.js');
  const palette = read('viewer/storyboard_palette_sidebar.js');
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
  contains(workspace, 'storyPaletteOpen: !state.storyPaletteOpen', 'Storyboard palette toggle state update');
  contains(objectUi, 'handleStoryboardAction(action, target)', 'Object Canvas storyboard action bridge');
}

function checkReviewAndLensContracts() {
  const installReview = read('viewer/install_review_ui.js');
  const installCss = read('viewer/styles/install-preview.css');
  const eventWorkbench = read('viewer/event_workbench_ui.js');
  const runtimeLens = read('viewer/runtime_lens_ui.js');

  contains(installReview, '<details>', 'Review & Apply operation details');
  contains(installReview, 'install.human.advancedDetails', 'Review & Apply operation details summary');
  contains(installCss, '.install-human-op details', 'Review & Apply details style');
  contains(eventWorkbench, 'event-workbench-collapsible', 'Event Workbench collapsible sections');
  contains(eventWorkbench, 'data-event-workbench-section="', 'Event Workbench section marker');
  contains(runtimeLens, 'data-runtime-lens-action="toggle_collapse"', 'Runtime Lens collapse action');
  contains(runtimeLens, 'data-runtime-lens-action="toggle_expand"', 'Runtime Lens expand action');
  contains(runtimeLens, 'root.querySelectorAll(\'[data-runtime-lens-action]\')', 'Runtime Lens action binding');
  contains(runtimeLens, 'button.dataset.runtimeLensBound = \'true\'', 'Runtime Lens duplicate binding guard');
  contains(read('viewer/runtime_lens_workspace_state.js'), 'renderRuntimeLensEvidence', 'Runtime Lens evidence update contract');
  contains(read('viewer/object_authoring_canvas_ui.js'), 'updateRuntimeLensEvidence', 'Runtime Lens evidence update contract');
}

function checkRenderedAndPureBehavior() {
  const viewport = require('./viewer/object_canvas_viewport.js');
  const installReview = require('./viewer/install_review_ui.js');
  const eventWorkbench = require('./viewer/event_workbench_ui.js');
  const runtimeLens = require('./viewer/runtime_lens_ui.js');

  const board = elementStub();
  const edges = elementStub();
  const label = elementStub();
  const root = rootStub({
    '[data-object-canvas-graph-board]': board,
    '[data-object-canvas-graph-edges]': edges,
    '[data-object-canvas-zoom-label]': label
  });
  const state = {canvasZoom: 1, canvasPanX: 0, canvasPanY: 0};
  viewport.zoom(root, state, 'in');
  assert(state.canvasZoom > 1, 'Object Canvas viewport zoom should increase state');
  assert(label.textContent === '110%', 'Object Canvas viewport zoom should update the label');
  assert(board.style.transform.includes('scale(1.100)'), 'Object Canvas viewport zoom should update board transform');

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
