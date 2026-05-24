#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const {fail, assert} = require('./check_harness.js');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function contains(source, needle, label) {
  assert(source.includes(needle), label + ' should include `' + needle + '`');
}

const workspace = require('./viewer/source_slice_workspace_ui.js');
const coverage = require('./authoring/visible_object_coverage_model.js');

const guardedSlice = {
  ok: true,
  title: 'Probe body',
  targetId: 'probe_event:body',
  currentText: 'Before body',
  installSafety: 'guarded_apply',
  operationType: 'replace_text',
  source: {
    path: 'source/scenes/probe.scene.dry',
    line: 12,
    startLine: 12,
    endLine: 12,
    anchorText: 'Before body'
  },
  anchorEvidence: {anchorText: 'Before body'}
};

const advancedSlice = Object.assign({}, guardedSlice, {
  targetId: 'root-router',
  installSafety: 'advanced_apply',
  source: {
    path: 'source/scenes/root.scene.dry',
    line: 4,
    startLine: 4,
    endLine: 4,
    anchorText: 'Before body'
  }
});

const deps = {
  translate: (_key, fallback) => fallback,
  escapeHtml: (value) => String(value === undefined || value === null ? '' : value),
  escapeAttr: (value) => String(value === undefined || value === null ? '' : value),
  renderPlanPreview: (plan) => plan ? '<section data-object-canvas-review-plan="true"></section>' : '',
  renderDiagnostics: () => '',
  sourceSliceApi: {
    buildProposal(slice, options) {
      const replacement = String(options && options.replacementText || '');
      const source = slice.source || {};
      return {
        ok: true,
        installPlan: {
          operations: [{
            id: 'source_slice_probe',
            type: slice.operationType || 'replace_text',
            path: source.path,
            line: source.line,
            search: source.anchorText || slice.currentText || '',
            replace: replacement,
            safety: slice.installSafety || 'guarded_apply'
          }]
        },
        operations: []
      };
    }
  }
};

const noChange = workspace.buildCanvasModel(guardedSlice, {}, deps);
assert(noChange.changeState.changedCount === 0, 'no-op source slice should report zero changed fields');
assert(!noChange.changeState.installPlan, 'no-op source slice should not expose an install plan');
assert(!workspace.reviewAllowed({model: noChange, sourceSliceModel: guardedSlice}), 'no-op source slice should not be reviewable');
const noChangeHtml = workspace.render(noChange, {sourceSliceModel: guardedSlice, values: {}, sourceSliceAdvancedConfirmed: false}, deps);
contains(noChangeHtml, 'data-source-slice-no-changes="true"', 'Source Slice no-op render');

const changed = workspace.buildCanvasModel(guardedSlice, {'source_slice.replacementText': 'After body'}, deps);
assert(changed.changeState.changedCount === 1, 'changed source slice should report one changed field');
assert(changed.changeState.installPlan, 'changed source slice should expose an install plan');
assert(changed.changeState.installPlan.operations[0].type === 'replace_text', 'changed source slice should produce replace_text');
assert(workspace.reviewAllowed({model: changed, sourceSliceModel: guardedSlice}), 'guarded source slice should be reviewable after editing');
const changedHtml = workspace.render(changed, {sourceSliceModel: guardedSlice, values: {'source_slice.replacementText': 'After body'}, sourceSliceAdvancedConfirmed: false}, deps);
contains(changedHtml, 'data-source-slice-diff="true"', 'Source Slice changed render');
contains(changedHtml, 'data-source-slice-before="true"', 'Source Slice before diff marker');
contains(changedHtml, 'data-source-slice-after="true"', 'Source Slice after diff marker');

const advanced = workspace.buildCanvasModel(advancedSlice, {'source_slice.replacementText': 'After body'}, deps);
assert(advanced.changeState.installPlan.operations[0].safety === 'advanced_apply', 'protected source slice should stay advanced apply');
assert(!workspace.reviewAllowed({model: advanced, sourceSliceModel: advancedSlice, sourceSliceAdvancedConfirmed: false}), 'advanced source slice should require confirmation');
assert(workspace.reviewAllowed({model: advanced, sourceSliceModel: advancedSlice, sourceSliceAdvancedConfirmed: true}), 'advanced source slice should be reviewable after confirmation');
const advancedHtml = workspace.render(advanced, {sourceSliceModel: advancedSlice, values: {'source_slice.replacementText': 'After body'}, sourceSliceAdvancedConfirmed: false}, deps);
contains(advancedHtml, 'data-source-slice-advanced-confirm="true"', 'Source Slice advanced toggle');

assert(typeof coverage.buildVisibleEditAction === 'function', 'Visible Object Coverage should export buildVisibleEditAction');
const action = coverage.buildVisibleEditAction({
  semantic: {textCorpus: {items: []}}
}, 'textCorpus', {
  id: 'text:probe',
  text: 'Before body',
  source: guardedSlice.source,
  owner: {sceneId: 'probe_event', kind: 'scene', sectionId: 'body'}
}, {
  area: 'story',
  objectType: 'event_text',
  role: 'body',
  label: 'Body',
  safeEligible: true,
  previewEligible: true
});
assert(action && action.kind === 'visible_edit_action', 'Visible edit action should be buildable for source-backed visible text');
assert(action.actionKind, 'Visible edit action should include actionKind');
assert(action.installSafety === 'guarded_apply' || action.installSafety === 'advanced_apply' || action.installSafety === 'safe_apply', 'Visible edit action should be executable');

contains(read('viewer/visible_edit_action_ui.js'), 'data-visible-edit-action', 'Visible edit action UI');
contains(read('viewer/explore_lists.js'), 'data-visible-edit-affordance="true"', 'Explore rows edit marker');
contains(read('viewer/explore_inspector.js'), 'visible-edit-action-panel', 'Explore inspector edit panel');
contains(read('viewer/event_workbench_ui.js'), 'renderEditAction(row, locale)', 'Event Workbench edit marker');
contains(read('viewer/card_board_surface.js'), 'data-visible-edit-affordance="card-board"', 'Card Board edit marker');
contains(read('viewer/preview_object_editor.js'), 'data-visible-edit-affordance="object-canvas-preview"', 'Object Canvas preview edit marker');
contains(read('viewer/object_authoring_canvas_ui.js'), 'sourceSliceWorkspaceApi()', 'Object Canvas Source Slice module boundary');
contains(read('viewer/object_authoring_canvas_ui.js'), 'openSemanticLogicAction(editAction)', 'Object Canvas semantic logic editor dispatch');
contains(read('viewer/semantic_logic_workspace_ui.js'), 'data-semantic-logic-editor="true"', 'Semantic Logic workspace editor marker');
contains(read('authoring/semantic_logic_editor_model.js'), 'buildSemanticLogicEditor', 'Semantic Logic editor model builder');

process.stdout.write('PASS: click-to-edit polish model\n');
