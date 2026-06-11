#!/usr/bin/env node
'use strict';

// 98.5 R5 qdisplay basic editability: band lines `(a..b) label` in
// source/qdisplays/*.qdisplay.dry are indexed as surface-text items carrying
// the VERBATIM line as source.anchorText. This check pins the contracts that
// make the band edit + safe create path work end to end:
//  - the capability routes qdisplay band items to the source slice editor at
//    safe_apply (guarded replace_text on qdisplay would be refused by the
//    install policy — only the safe and advanced tiers allow it), while
//    status-scene surface items keep their System UI workspace route;
//  - the slice model seeds the editor with the exact band line and the
//    proposal emits replace_text with exact line evidence;
//  - the install layer accepts the safe edit and the new safe create_file
//    allowance for source/qdisplays/*.qdisplay.dry, fails closed on drifted
//    files and on creates over different existing content, and refuses
//    traversal/foreign create paths;
//  - the create panel sibling renders only for qdisplay-backed items, never
//    carries canvas/action attributes, and builds a safe create plan.

const editCapability = require('./authoring/edit_capability_model.js');
const coverage = require('./authoring/visible_object_coverage_model.js');
const sourceSliceModel = require('./authoring/source_slice_editor_model.js');
const installPlan = require('./authoring/install_plan.js');
const createPanel = require('./viewer/qdisplay_create_panel.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {assert} = require('./check_harness.js');

const BAND_LINE = '(3..4) <span style="color: #EBD97D;">trusting</span>';
const QDISPLAY_REL = 'source/qdisplays/confidence.qdisplay.dry';
const FILE_TEXT = '\n' +
  '(..1) <span style="color: #d42f2f;">lost</span>\n' +
  '(1..2) waning\n' +
  '(2..3) uncertain\n' +
  BAND_LINE + '\n' +
  '(4..5) unwavering\n' +
  '(5..) unquestioning';

function bandItem() {
  return {
    id: 'surface_band',
    label: 'confidence (3..4) trusting',
    area: 'qdisplay',
    source: {path: QDISPLAY_REL, line: 5, anchorText: BAND_LINE},
    confidence: 'static',
    editability: 'draft_exportable',
    originalText: BAND_LINE,
    variableName: 'confidence'
  };
}

function statusItem() {
  return {
    id: 'surface_status',
    label: 'Status heading',
    area: 'status_scene',
    source: {path: 'source/scenes/status.scene.dry', line: 3},
    editability: 'draft_exportable',
    originalText: 'Status heading'
  };
}

const INDEX = {schemaVersion: '0.1', surfaceText: {items: [bandItem(), statusItem()]}, variables: []};

// --- capability routing -------------------------------------------------------

const bandCap = editCapability.buildEditCapability(INDEX, 'surfaceText', bandItem(), {});
assert(bandCap.routeClass === 'source_slice_editor', 'band items route to the source slice editor, got ' + bandCap.routeClass);
assert(bandCap.installSafety === 'safe_apply', 'band edits ride the safe tier (guarded qdisplay replace_text is refused by policy), got ' + bandCap.installSafety);
assert(bandCap.operationTemplate && bandCap.operationTemplate.type === 'replace_text', 'band template is replace_text');
assert(bandCap.operationTemplate.line === 5, 'band template carries the exact line');
assert(bandCap.operationTemplate.anchorText === BAND_LINE, 'band template carries the verbatim line as anchorText');

const statusCap = editCapability.buildEditCapability(INDEX, 'surfaceText', statusItem(), {});
assert(statusCap.routeClass === 'system_ui_workspace', 'status-scene surface items keep the System UI route, got ' + statusCap.routeClass);

const anchorless = bandItem();
delete anchorless.source.anchorText;
const anchorlessCap = editCapability.buildEditCapability(INDEX, 'surfaceText', anchorless, {});
assert(anchorlessCap.routeClass !== 'source_slice_editor', 'a band item WITHOUT anchorText must not claim the slice route (stale-index degradation)');

// --- action → slice model → proposal -----------------------------------------

const action = coverage.buildVisibleEditAction(INDEX, 'surfaceText', bandItem(), {
  area: 'system_ui', objectType: 'surface_text', role: 'surface_label',
  label: 'confidence (3..4) trusting', safeEligible: true, previewEligible: true
}, {});
assert(action && action.actionKind === 'open_source_slice', 'band edit action is open_source_slice');
assert(action.installSafety === 'safe_apply', 'the action carries safe_apply');
assert(action.source && action.source.anchorText === BAND_LINE, 'the action source keeps the verbatim band line');

const model = sourceSliceModel.buildSourceSliceEditor(INDEX, {editAction: action});
assert(model.ok === true, 'the slice model builds for a band action');
assert(model.currentText === BAND_LINE, 'the editor seeds with the exact band line');
assert(model.operationType === 'replace_text', 'band edits stay replace_text');
assert(model.installSafety === 'safe_apply', 'the model keeps safe_apply');
assert(model.advancedRequired === false, 'band edits never demand the advanced toggle');

const REPLACEMENT = '(3..4) <span style="color: #EBD97D;">confident</span>';
const proposal = sourceSliceModel.buildProposal(model, {replacementText: REPLACEMENT});
assert(proposal.ok === true, 'the proposal builds');
const op = proposal.operations[0];
assert(op.type === 'replace_text' && op.line === 5, 'the operation carries exact line evidence');
assert(op.search === BAND_LINE && op.replace === REPLACEMENT, 'the operation carries verbatim search/replace');
assert(op.safety === 'safe_apply', 'the operation stays safe_apply');

// --- install layer closed loop on a filesystem fixture ------------------------

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check_r5_qdisplay_'));
try {
  fs.mkdirSync(path.join(root, 'source', 'qdisplays'), {recursive: true});
  fs.mkdirSync(path.join(root, 'source', 'scenes', 'events'), {recursive: true});
  fs.writeFileSync(path.join(root, 'source', 'info.dry'), 'title: R5 Fixture\nauthor: Studio\n');
  const qfile = path.join(root, 'source', 'qdisplays', 'confidence.qdisplay.dry');
  fs.writeFileSync(qfile, FILE_TEXT);

  let result = installPlan.applyInstallPlan(proposal.installPlan, {projectRoot: root, dryRun: true});
  assert(result.ok === true && result.results[0].status === 'would_apply', 'the safe band edit dry-runs to would_apply');

  result = installPlan.applyInstallPlan(proposal.installPlan, {projectRoot: root, dryRun: false});
  assert(result.ok === true, 'the safe band edit applies');
  const afterLines = fs.readFileSync(qfile, 'utf8').split('\n');
  const beforeLines = FILE_TEXT.split('\n');
  const changed = beforeLines.map((line, i) => line !== afterLines[i] ? i + 1 : 0).filter(Boolean);
  assert(changed.length === 1 && changed[0] === 5, 'exactly the band line changes on disk, got lines ' + changed.join(','));
  assert(afterLines[4] === REPLACEMENT, 'the band line carries the replacement text');

  fs.writeFileSync(qfile, FILE_TEXT.replace('trusting', 'DRIFTED'));
  result = installPlan.applyInstallPlan(proposal.installPlan, {projectRoot: root, dryRun: true});
  assert(result.ok === false, 'a drifted file fails the dry-run closed');
  fs.writeFileSync(qfile, FILE_TEXT);

  // Safe create: allowance, idempotence, and the different-content refusal.
  const plan = createPanel.buildCreatePlan(QDISPLAY_REL, 'confidence_copy', FILE_TEXT + '\n');
  assert(plan && plan.operations.length === 1 && plan.operations[0].type === 'create_file', 'the create panel builds a single create_file plan');
  result = installPlan.applyInstallPlan(plan, {projectRoot: root, dryRun: true});
  assert(result.ok === true && result.results[0].status === 'would_apply', 'the qdisplay create dry-runs to would_apply');
  result = installPlan.applyInstallPlan(plan, {projectRoot: root, dryRun: false});
  const copyPath = path.join(root, 'source', 'qdisplays', 'confidence_copy.qdisplay.dry');
  assert(result.ok === true && fs.existsSync(copyPath), 'the qdisplay create applies');
  result = installPlan.applyInstallPlan(plan, {projectRoot: root, dryRun: true});
  assert(result.ok === true && result.results[0].status === 'already_applied', 'recreating the same content reports already_applied (idempotent, no overwrite)');
  fs.writeFileSync(copyPath, '(1..2) different\n');
  result = installPlan.applyInstallPlan(plan, {projectRoot: root, dryRun: true});
  assert(result.ok === false, 'creating over DIFFERENT existing content fails closed');

  // Refusal battery: traversal, foreign directories, foreign extensions.
  ['source/qdisplays/../evil.qdisplay.dry', 'source/other/x.qdisplay.dry',
   'source/qdisplays/x.qdisplay.dry.txt', 'qdisplays/x.qdisplay.dry'].forEach((bad) => {
    const badPlan = installPlan.buildInstallPlan({
      id: 'bad', draftKind: 'qdisplay_create', title: 'bad',
      operations: [{id: 'b', type: 'create_file', path: bad, content: 'x', safety: 'safe_apply', description: 'bad'}]
    });
    const badResult = installPlan.applyInstallPlan(badPlan, {projectRoot: root, dryRun: true});
    assert(badResult.ok === false, 'create_file must refuse ' + bad);
  });

  // Scenes create regression: the qdisplay allowance must not loosen scenes.
  const scenePlan = installPlan.buildInstallPlan({
    id: 'scene', draftKind: 'event', title: 'scene',
    operations: [{id: 's', type: 'create_file', path: 'source/scenes/events/r5_check.scene.dry',
      content: 'title: R5\n', safety: 'safe_apply', description: 'scene create'}]
  });
  result = installPlan.applyInstallPlan(scenePlan, {projectRoot: root, dryRun: true});
  assert(result.ok === true, 'event scene create_file keeps working');
} finally {
  fs.rmSync(root, {recursive: true, force: true});
}

// --- create panel sibling guardrails ------------------------------------------

assert(createPanel.isQdisplayItem(bandItem()) === true, 'the panel recognizes qdisplay items');
assert(createPanel.isQdisplayItem(statusItem()) === false, 'the panel ignores non-qdisplay items');
const panelHtml = createPanel.renderCreatePanel(bandItem());
assert(/data-qdisplay-create-panel/.test(panelHtml), 'the panel renders its container');
assert(/data-qdisplay-create-name/.test(panelHtml) && /data-qdisplay-create-from/.test(panelHtml), 'the panel renders the name input and the create button');
assert(!/data-object-canvas-action|data-object-canvas-field|data-editing-field|data-visible-edit-action/.test(panelHtml),
  'the panel must not carry canvas field/action attributes');
assert(createPanel.renderCreatePanel(statusItem()) === '', 'non-qdisplay items render no panel');
assert(createPanel.targetPathForName('band_copy') === 'source/qdisplays/band_copy.qdisplay.dry', 'valid names map under source/qdisplays/');
['../evil', 'a/b', 'a.b', '', '.hidden'].forEach((bad) => {
  assert(createPanel.targetPathForName(bad) === '', 'the panel must refuse the name ' + JSON.stringify(bad));
});
assert(createPanel.buildCreatePlan('source/scenes/a.scene.dry', 'x', 'y') === null, 'the panel refuses non-qdisplay source paths');

// --- index.html manifest contract ---------------------------------------------

const indexHtml = fs.readFileSync(path.join(__dirname, 'viewer', 'index.html'), 'utf8');
assert(/<script src="qdisplay_create_panel\.js"><\/script>/.test(indexHtml), 'index.html loads qdisplay_create_panel.js');

console.log('PASS: qdisplay band editability + safe create (capability route, safe replace_text closed loop, create allowance + refusals, panel guardrails)');
