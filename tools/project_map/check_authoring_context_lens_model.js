#!/usr/bin/env node
'use strict';

const fs = require('fs');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const contextLens = require('./authoring/authoring_context_lens_model.js');
const installPlan = require('./authoring/install_plan.js');
const previewEditor = require('./viewer/preview_object_editor.js');
const reviewUi = require('./viewer/install_review_ui.js');
const {syntheticIndex} = require('./fixtures/archetype_authoring_fixture.js');
const {fail, assert} = require('./check_harness.js');

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#96;/g, '`')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function attrValue(tag, name) {
  const match = new RegExp(name + '="([^"]*)"').exec(tag);
  return match ? decodeHtml(match[1]) : '';
}

function lensMarkers(html) {
  const rows = [];
  const regex = /<span[^>]*data-authoring-context-lens="true"[^>]*>/g;
  let match = regex.exec(html);
  while (match) {
    const tag = match[0];
    let payload = null;
    try {
      payload = JSON.parse(attrValue(tag, 'data-context-lens-payload') || '{}');
    } catch (_err) {
      payload = null;
    }
    rows.push({
      kind: attrValue(tag, 'data-context-lens-kind'),
      evidence: attrValue(tag, 'data-context-lens-evidence'),
      payload,
      focusable: /tabindex="0"/.test(tag),
      roleButton: /role="button"/.test(tag),
      expanded: /aria-expanded="false"/.test(tag),
      pinned: /data-context-lens-pinned="false"/.test(tag)
    });
    match = regex.exec(html);
  }
  return rows;
}

function requireRows(lens, label) {
  const rows = lens && lens.rows || [];
  const rowLabels = rows.map((row) => row.label);
  ['Meaning', 'Context', 'Source', 'Edit route', 'Safety', 'Rule of use'].forEach((expected) => {
    assert(rowLabels.includes(expected), label + ' should include lens row ' + expected, rows);
  });
}

const actionLens = contextLens.buildForAction({
  actionKind: 'open_route_editor',
  entryKind: 'route',
  targetView: 'events',
  targetId: 'banking_crisis',
  fieldId: 'banking_crisis.option.1.route',
  role: 'option_target',
  source: {path: 'source/scenes/events/banking_crisis.scene.dry', line: 42},
  installSafety: 'advanced_apply'
});
requireRows(actionLens, 'action lens');
assert(actionLens.subjectKind === 'route', 'action lens should classify route entries', actionLens);
assert(actionLens.safetyClass === 'advanced_apply', 'action lens should preserve advanced safety', actionLens);
assert(/banking_crisis\.scene\.dry:42/.test(actionLens.source), 'action lens should expose source line', actionLens);

const fieldLens = contextLens.buildForField({
  id: 'draft.title',
  label: 'Title',
  value: 'Draft title',
  status: 'guarded'
}, {role: 'title'});
requireRows(fieldLens, 'field lens');
assert(fieldLens.evidenceState === 'draft', 'sourceless draft fields should be honest draft evidence', fieldLens);

const parityLens = contextLens.buildForParityRole({
  role: 'body',
  parsed: 2,
  draft: 1,
  missing: 1,
  blocking: true
});
requireRows(parityLens, 'parity lens');
assert(parityLens.safetyClass === 'manual_review', 'blocking parity should stay manual-review safety', parityLens);

const operationLens = contextLens.buildForOperation({
  id: 'replace_intro',
  type: 'replace_text',
  path: 'source/scenes/events/opening.scene.dry',
  line: 12,
  safety: 'guarded_apply',
  description: 'Replace one visible sentence.'
});
requireRows(operationLens, 'operation lens');
assert(operationLens.subjectKind === 'operation', 'operation lens should classify install operations', operationLens);

const index = syntheticIndex();
const renderedKinds = new Set();
[
  ['events', 'economic_expansion'],
  ['events', 'banking_crisis'],
  ['cards', 'economic_policy']
].forEach(([view, id]) => {
  const model = canvasModel.buildExistingCanvas(index, view, id, {});
  assert(model.ok, id + ' should build an Object Canvas model');
  const markers = lensMarkers(previewEditor.renderModal(model, {}));
  assert(markers.length > 0, id + ' should render context lens markers');
  markers.forEach((marker) => {
    renderedKinds.add(marker.kind);
    assert(marker.focusable && marker.roleButton && marker.expanded && marker.pinned, id + ' lens marker should be keyboard/pin ready', marker);
    requireRows(marker.payload, id + ' rendered lens payload');
  });
});

['text', 'option', 'route', 'condition', 'effect', 'metadata', 'result'].forEach((kind) => {
  assert(renderedKinds.has(kind), 'rendered Object Canvas should expose context lens kind: ' + kind, Array.from(renderedKinds).sort());
});

const variableModel = {
  mode: 'existing',
  objectKind: 'event',
  objectId: 'variable_preview',
  title: 'Variable preview',
  eventBody: {
    title: {id: 'variable.title', label: 'Title', value: 'Variable preview', original: 'Variable preview', status: 'guarded'},
    sections: [{id: 'variable.body', label: 'Body', value: 'Variable body.', original: 'Variable body.', status: 'guarded'}],
    variables: [{name: 'budget', reads: [{path: 'source/scenes/events/variable.scene.dry', line: 4}], writes: []}]
  },
  changeState: {draft: {}, operationSummary: {}, changedCount: 0}
};
assert(lensMarkers(previewEditor.renderModal(variableModel, {})).some((marker) => marker.kind === 'variable'), 'preview variable lens should be present');

const partialModel = {
  mode: 'existing',
  objectKind: 'event',
  objectId: 'partial_preview',
  title: 'Partial preview',
  eventBody: {
    title: {id: 'partial.title', label: 'Title', value: 'Partial preview', original: 'Partial preview', status: 'guarded'},
    sections: [{id: 'partial.body', label: 'Body', value: 'Partial body.', original: 'Partial body.', status: 'guarded'}]
  },
  changeState: {
    draft: {
      parsedToDraftParity: {
        roles: {
          body: {role: 'body', parsed: 2, draft: 1, missing: 1, blocking: true}
        }
      }
    },
    operationSummary: {},
    changedCount: 0
  }
};
assert(lensMarkers(previewEditor.renderModal(partialModel, {})).some((marker) => marker.payload && marker.payload.role === 'body' && marker.payload.safetyClass === 'manual_review'), 'partial parity blocker should expose a blocking context lens');

const plan = installPlan.buildInstallPlan({
  id: 'context_lens_plan',
  draftKind: 'world_event',
  title: 'Context lens plan',
  operations: [{
    id: 'replace_intro',
    type: 'replace_text',
    path: 'source/scenes/events/opening.scene.dry',
    line: 12,
    search: 'Old sentence.',
    replace: 'New sentence.',
    safety: 'guarded_apply',
    description: 'Replace one visible sentence.'
  }]
});
const reviewMarkers = lensMarkers(reviewUi.renderPlanReview({
  plan,
  summary: installPlan.operationSummary(plan),
  installApi: installPlan,
  t: (_key, fallback) => fallback
}));
assert(reviewMarkers.some((marker) => marker.kind === 'operation'), 'Review & Apply operation rows should expose context lens markers', reviewMarkers);

const uiSource = fs.readFileSync(require.resolve('./viewer/visible_edit_action_ui.js'), 'utf8');
const editingCss = fs.readFileSync(require.resolve('./viewer/styles/editing.css'), 'utf8');
assert(uiSource.includes('bindContextLens'), 'visible edit UI should bind context lens interactions');
assert(uiSource.includes('data-context-lens-pinned'), 'context lens should support pin/unpin state');
assert(uiSource.includes("event.key === 'Escape'"), 'context lens should support Escape dismiss');
assert(uiSource.includes('updateContextLensPlacement'), 'context lens should update placement when opened');
assert(uiSource.includes('closeSiblingContextLenses'), 'context lens should collapse sibling popovers before opening another one');
assert(uiSource.includes('contextLensPlacement'), 'context lens should mark left/right placement for boundary-aware popovers');
assert(uiSource.includes("--context-lens-popover-position', 'fixed'"), 'context lens should switch open popovers to fixed positioning');
assert(uiSource.includes('--context-lens-popover-left'), 'context lens should write fixed-position horizontal placement');
assert(uiSource.includes('--context-lens-popover-top'), 'context lens should write fixed-position vertical placement');
assert(uiSource.includes("global.addEventListener('scroll'"), 'context lens should update open popovers during pane scroll');
assert(uiSource.includes('.object-editing-preview-pane'), 'context lens placement should respect the preview pane boundary');
assert(editingCss.includes('position: var(--context-lens-popover-position, absolute)'), 'context lens popover should have a CSS hover fallback and JS fixed-position mode');
assert(editingCss.includes('--context-lens-popover-left'), 'context lens CSS should consume fixed horizontal placement');
assert(editingCss.includes('--context-lens-popover-top'), 'context lens CSS should consume fixed vertical placement');
assert(editingCss.includes('.authoring-context-lens[data-authoring-context-lens]'), 'context lens marker should outrank nested span layout rules');
assert(editingCss.includes('.authoring-context-lens[data-authoring-context-lens] > .authoring-context-lens-popover'), 'context lens hidden state should outrank nested span layout rules');
assert(editingCss.includes('.authoring-context-lens[data-authoring-context-lens]:hover > .authoring-context-lens-popover'), 'context lens should keep a direct-child CSS hover fallback');
assert(!editingCss.includes('.authoring-context-lens:hover .authoring-context-lens-popover'), 'context lens popover should not use the old broad hover selector');

process.stdout.write(JSON.stringify({
  ok: true,
  renderedKinds: Array.from(renderedKinds).sort(),
  reviewLensMarkers: reviewMarkers.length
}, null, 2) + '\n');
