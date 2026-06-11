#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const {pythonCommand} = require('./check_python_command.js');

const ROOT = __dirname;
const REPO_ROOT = path.resolve(ROOT, '..', '..');
const TEMPLATE_ROOT = path.join(ROOT, 'templates', 'starter-demo');

const sidebarStatus = require('./authoring/sidebar_status_draft.js');
const installPlan = require('./authoring/install_plan.js');

function buildIndex(root, outPath) {
  const result = spawnSync(pythonCommand(), [
    path.join(ROOT, 'build_project_map.py'),
    '--root',
    root,
    '--out',
    outPath
  ], {cwd: REPO_ROOT, encoding: 'utf8'});
  assert.strictEqual(result.status, 0, 'build_project_map should succeed: ' + result.stderr + result.stdout);
  return JSON.parse(fs.readFileSync(outPath, 'utf8'));
}

function copyTemplate() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_sidebar_status_'));
  const projectRoot = path.join(root, 'starter-demo');
  fs.cpSync(TEMPLATE_ROOT, projectRoot, {recursive: true});
  return projectRoot;
}

function syntheticIndex(options) {
  const opts = options || {};
  const scenes = [];
  if (opts.status !== false) {
    scenes.push({
      id: 'status',
      title: 'Old Status',
      path: 'source/scenes/status.scene.dry',
      metadata: {title: {path: 'source/scenes/status.scene.dry', line: 1}},
      sections: [
        {id: 'status.organization', sourceSpan: {path: 'source/scenes/status.scene.dry', startLine: 7, endLine: 11}}
      ]
    });
  }
  const textItems = [];
  if (opts.status !== false) {
    textItems.push(
      {
        id: 'status_heading',
        role: 'heading',
        text: 'Old Status',
        owner: {sceneId: 'status', sectionId: ''},
        source: {path: 'source/scenes/status.scene.dry', line: 3, startLine: 3, endLine: 3, anchorText: '= Old Status', endAnchorText: '= Old Status'}
      },
      {
        id: 'org_heading',
        role: 'heading',
        text: 'Organization',
        owner: {sceneId: 'status', sectionId: 'status.organization'},
        source: {path: 'source/scenes/status.scene.dry', line: 9, startLine: 9, endLine: 9, anchorText: '= Organization', endAnchorText: '= Organization'}
      },
      {
        id: 'org_body',
        role: 'body',
        text: 'Old organization status.',
        owner: {sceneId: 'status', sectionId: 'status.organization'},
        source: {path: 'source/scenes/status.scene.dry', line: 11, startLine: 11, endLine: 11, anchorText: 'Old organization status.', endAnchorText: 'Old organization status.'}
      }
    );
  }
  return {
    schemaVersion: '0.1',
    project: {name: 'Sidebar Status fixture', root: '', profileIds: ['generic-dendry']},
    scenes,
    variables: [
      {name: 'volunteer_energy', tags: ['resource'], readCount: 2, writeCount: 2},
      {name: 'coalition_trust', tags: ['politics'], readCount: 1, writeCount: 1}
    ],
    semantic: {
      textCorpus: {items: textItems},
      surfaceText: opts.generatedSidebar ? {items: [], sources: ['out/html/index.html']} : {items: [], sources: []}
    }
  };
}

function surfaceItem(id, originalText, label, line) {
  return {
    id,
    originalText,
    label,
    role: 'label',
    source: {
      path: 'source/scenes/status.scene.dry',
      line,
      startLine: line,
      endLine: line
    },
    confidence: 'static',
    editability: 'draft_exportable'
  };
}

const starterIndex = buildIndex(TEMPLATE_ROOT, path.join(os.tmpdir(), 'dms_sidebar_status_index.json'));
const starterModel = sidebarStatus.buildSidebarModel(starterIndex);

assert.strictEqual(starterModel.kind, 'sidebar_status_model', 'Starter Demo should produce Sidebar / Status model');
assert(starterModel.status.exists, 'Starter Demo should detect status.scene.dry');
assert(starterModel.sections.some((section) => section.id === sidebarStatus.MAIN_SECTION_ID), 'model should expose top-level sidebar display');
assert(starterModel.sections.some((section) => section.id === sidebarStatus.MAIN_SECTION_ID && section.statusLines.includes('Resources: [+ demo_resources +]')), 'model should merge source-backed surface status lines into the top-level sidebar display');
assert(starterModel.sections.some((section) => section.id === 'organization' && section.evidence), 'model should expose source-backed organization section');
assert(starterModel.sections.some((section) => section.id === 'organization' && section.deleteEvidence && section.deleteEvidence.anchorText === '@organization'), 'model should expose exact delete evidence for source-backed sidebar categories');
assert(starterModel.sections.some((section) => section.id === 'cards' && section.evidence), 'model should expose source-backed card section');
assert(starterModel.variables.some((item) => item.name === 'demo_support'), 'model should expose variable recommendations');
assert(starterModel.readiness.some((row) => row.id === 'editable_section' && row.status === 'ready'), 'model should mark source-backed sections ready');

const surfaceOnlyIndex = syntheticIndex();
surfaceOnlyIndex.semantic.textCorpus.items = [];
surfaceOnlyIndex.semantic.surfaceText = {
  items: [
    surfaceItem('surface_paramilitaries_heading', '= Paramilitaries', 'Paramilitaries', 9),
    surfaceItem('surface_reichswehr', 'Reichswehr: [+ reichswehr_strength +] thousand troops.', 'Reichswehr', 11),
    surfaceItem('surface_reichswehr_loyalty', 'Reichswehr Loyalty: [+ reichswehr_loyalty : loyalty +]', 'Reichswehr Loyalty', 12)
  ],
  sources: ['source/scenes/status.scene.dry']
};
surfaceOnlyIndex.scenes[0].sections = [
  {id: 'status.paramilitaries', sourceSpan: {path: 'source/scenes/status.scene.dry', startLine: 7, endLine: 13}}
];
const surfaceOnlyModel = sidebarStatus.buildSidebarModel(surfaceOnlyIndex);
const surfaceParamilitaries = surfaceOnlyModel.sections.find((section) => section.id === 'paramilitaries');
assert(surfaceParamilitaries, 'surface-only status scene should expose the Paramilitaries section');
assert.strictEqual(surfaceParamilitaries.heading, 'Paramilitaries', 'surface heading should become the category heading');
assert(surfaceParamilitaries.statusLines.includes('Reichswehr: [+ reichswehr_strength +] thousand troops.'), 'surface-only status rows should include the Reichswehr count');
assert(surfaceParamilitaries.statusLines.includes('Reichswehr Loyalty: [+ reichswehr_loyalty : loyalty +]'), 'surface-only status rows should include Reichswehr loyalty');

const draft = sidebarStatus.normalizeDraft(Object.assign({}, sidebarStatus.defaultDraft(starterIndex), {
  id: 'justice_party_sidebar',
  title: 'Justice Party sidebar update',
  statusTitle: 'Justice Party Status',
  sectionId: 'organization',
  sectionHeading: 'Justice Party Organization',
  sectionBody: 'Track local branches, volunteer energy, and coalition trust.',
  sectionStatusLines: '[? if volunteer_energy > 0 : Volunteer teams are active. ?]'
}));
const validation = sidebarStatus.validateDraft(draft, starterIndex);
assert(validation.ok, 'Justice Party sidebar draft should validate: ' + JSON.stringify(validation.diagnostics));
const bundle = sidebarStatus.buildExportBundle(draft, starterIndex);
assert(bundle.ok, 'bundle should validate');
assert(bundle.installPlan.operations.some((op) => op.id === 'sidebar_status_title' && op.type === 'replace_text'), 'plan should replace status scene title');
// A wholesale rewrite (multi-line paragraph body replaced by new text) cannot
// be expressed as exact line replacements — it must degrade to manual review,
// and editing an existing section must NEVER reconstruct it via replace_section.
assert(!bundle.installPlan.operations.some((op) => op.type === 'replace_section'), 'editing an existing section must never emit a reconstruction replace_section');
assert(bundle.installPlan.operations.some((op) => op.id === 'sidebar_status_section_manual' && op.safety === 'manual_review'), 'unmappable section rewrites should degrade to manual review');
assert(bundle.playerPreview.includes('Justice Party Organization'), 'player preview should include changed section heading');

// Heading-only edit maps onto the exact heading source line (surgical).
const headingDraft = sidebarStatus.normalizeDraft(Object.assign({}, sidebarStatus.defaultDraft(starterIndex), {
  sectionId: 'organization',
  sectionHeading: 'Justice Party Organization'
}));
const headingBundle = sidebarStatus.buildExportBundle(headingDraft, starterIndex);
const headingOps = headingBundle.installPlan.operations;
assert.strictEqual(headingOps.length, 1, 'heading-only edit should produce exactly one operation: ' + JSON.stringify(headingOps));
assert(headingOps[0].type === 'replace_text' && headingOps[0].safety === 'guarded_apply', 'heading edit should be a guarded line replacement');
assert.strictEqual(headingOps[0].search, '= Organization', 'heading edit should anchor on the exact heading line');
assert.strictEqual(headingOps[0].replace, '= Justice Party Organization', 'heading edit should preserve the heading marker');

const generatedModel = sidebarStatus.buildSidebarModel(syntheticIndex({status: false, generatedSidebar: true}));
assert(generatedModel.hasGeneratedSidebarOnly, 'generated/custom sidebar evidence should be surfaced');
const generatedDraft = sidebarStatus.normalizeDraft(Object.assign({}, sidebarStatus.defaultDraft(syntheticIndex({status: false, generatedSidebar: true})), {
  sectionHeading: 'Generated sidebar review',
  sectionBody: 'This must stay manual.'
}));
const generatedPlan = sidebarStatus.buildInstallPlan(generatedDraft, syntheticIndex({status: false, generatedSidebar: true}));
assert(generatedPlan.operations.some((op) => op.id === 'sidebar_status_generated_manual' && op.safety === 'manual_review'), 'generated/custom sidebar should stay manual review');
const generatedDeleteDraft = sidebarStatus.normalizeDraft(Object.assign({}, generatedDraft, {
  operationMode: 'delete',
  deleteConfirm: true
}));
const generatedDeletePlan = sidebarStatus.buildInstallPlan(generatedDeleteDraft, syntheticIndex({status: false, generatedSidebar: true}));
assert(generatedDeletePlan.operations.some((op) => op.id === 'sidebar_status_generated_manual' && op.safety === 'manual_review' && op.role === 'sidebar_status.delete_section'), 'generated/custom sidebar delete should stay manual review');

const missingStatusDraft = sidebarStatus.normalizeDraft(Object.assign({}, sidebarStatus.defaultDraft(syntheticIndex({status: false})), {
  sectionHeading: 'New Status',
  sectionBody: 'A generic source-backed status scene.'
}));
const missingStatusPlan = sidebarStatus.buildInstallPlan(missingStatusDraft, syntheticIndex({status: false}));
const createOp = missingStatusPlan.operations.find((op) => op.id === 'sidebar_status_create_status_scene');
assert(createOp && createOp.type === 'create_file' && createOp.safety === 'safe_apply', 'missing source sidebar should propose safe status.scene.dry creation');
assert.strictEqual(installPlan.classifyOperation(createOp).status, 'safe_apply', 'status.scene.dry creation should be installable');

const projectRoot = copyTemplate();
const tempIndex = buildIndex(projectRoot, path.join(os.tmpdir(), 'dms_sidebar_status_apply_index.json'));
const beforeStatusText = fs.readFileSync(path.join(projectRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8');
const tempDraft = sidebarStatus.normalizeDraft(Object.assign({}, sidebarStatus.defaultDraft(tempIndex), {
  sectionId: 'organization',
  sectionHeading: 'Justice Party Organization',
  evidence: sidebarStatus.buildSidebarModel(tempIndex)
}));
const tempBundle = sidebarStatus.buildExportBundle(tempDraft, tempIndex);
const dryRun = installPlan.applyInstallPlan(tempBundle.installPlan, {projectRoot, dryRun: true});
assert(dryRun.ok, 'dry-run should pass: ' + JSON.stringify(dryRun.diagnostics));
assert(dryRun.results.some((row) => row.id === 'sidebar_status_section_heading' && row.status === 'would_apply'), 'dry-run should replace the heading line');
const applied = installPlan.applyInstallPlan(tempBundle.installPlan, {projectRoot, dryRun: false});
assert(applied.ok, 'apply should pass: ' + JSON.stringify(applied.diagnostics));
const statusText = fs.readFileSync(path.join(projectRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8');
assert(statusText.includes('= Justice Party Organization'), 'status section heading should be changed');
assert(statusText.includes('@organization'), 'section anchor should be preserved');
assert(statusText.includes('@cards'), 'next section anchor should be preserved');
// Byte-exact acceptance: the heading line is the ONLY changed line.
const beforeLines = beforeStatusText.split('\n');
const afterLines = statusText.split('\n');
assert.strictEqual(afterLines.length, beforeLines.length, 'surgical apply must not add or remove lines');
const changedLines = beforeLines.map((line, idx) => line !== afterLines[idx] ? idx + 1 : 0).filter(Boolean);
assert.strictEqual(changedLines.length, 1, 'surgical apply should change exactly one line, changed: ' + JSON.stringify(changedLines));
assert.strictEqual(beforeLines[changedLines[0] - 1], '= Organization', 'the single changed line should be the section heading');

// ---- S1 regressions (2026-06-10): the three observed destructive-apply failure
// modes on a section-rich real status scene must stay fixed. Fixture mirrors
// the real-mod shape: a __main display with INTERIOR "= X" headings (no @anchor)
// and an over-long status line that the indexer truncates with "...".
// Token-bearing, non-conditional status line > 180 chars: such lines are
// captured ONLY via surfaceText, whose originalText passes through the
// indexer's truncate_excerpt_line (177 chars + "...") — the audited shape.
const LONG_STATUS_LINE = 'Stability report: [+ demo_support +] ' + 'the coalition holds across every region and ministry while reserves remain funded. '.repeat(4).trim();
const RICH_STATUS = [
  'title: Rich Status',
  'new-page: true',
  'is-special: true',
  '',
  '= Status',
  '',
  'Calendar: [+ demo_year +] / [+ demo_month +]',
  '',
  '= Government',
  '',
  'Cabinet stability: [+ demo_support +]',
  '',
  '= Party',
  '',
  'Membership: [+ demo_resources +]',
  '',
  LONG_STATUS_LINE,
  '[? if demo_support > 0 : Party morale is high. ?]',
  '',
  '@organization',
  '',
  '= Organization',
  '',
  'Use this section for organization variables.',
  ''
].join('\n');
const richRoot = copyTemplate();
fs.writeFileSync(path.join(richRoot, 'source', 'scenes', 'status.scene.dry'), RICH_STATUS, 'utf8');
const richIndex = buildIndex(richRoot, path.join(os.tmpdir(), 'dms_sidebar_status_rich_index.json'));
const richModel = sidebarStatus.buildSidebarModel(richIndex);
const richMain = richModel.sections.find((section) => section.id === sidebarStatus.MAIN_SECTION_ID);
assert(richMain, 'rich fixture should expose the top-level sidebar display');

// Regression 1 (wrong section): the canvas value pipeline pins the DISPLAYED
// category id; retargeting must rebase untouched fields and the resulting op
// must anchor on the retargeted section's own heading line.
const richBase = sidebarStatus.defaultDraft(richIndex);
assert.notStrictEqual(richBase.sectionId, sidebarStatus.MAIN_SECTION_ID, 'fixture base draft should target a non-main section (mirrors the audited mismatch)');
const retargeted = sidebarStatus.applyDraftValues(richBase, {
  'sidebar.sectionId': sidebarStatus.MAIN_SECTION_ID,
  'sidebar.sectionHeading': 'Status Centre'
}, {projectIndex: richIndex});
assert.strictEqual(retargeted.sectionId, sidebarStatus.MAIN_SECTION_ID, 'explicit sectionId should retarget the draft');
assert.strictEqual(retargeted.sectionBody, richMain.body, 'retargeting should rebase the untouched body onto the displayed section');
const retargetOps = sidebarStatus.buildInstallPlan(retargeted, richIndex).operations;
assert.strictEqual(retargetOps.length, 1, 'retargeted heading edit should produce exactly one operation: ' + JSON.stringify(retargetOps));
assert.strictEqual(retargetOps[0].search, '= Status', 'the edit must land on the displayed section heading, not the previously targeted section');

// Regression 2 (interior-heading loss): a heading-only edit on a section with
// interior "= X" headings applies as ONE line replacement and leaves every
// other line byte-identical (the audited apply deleted 3 interior headings).
const richApply = installPlan.applyInstallPlan(
  sidebarStatus.buildExportBundle(retargeted, richIndex).installPlan,
  {projectRoot: richRoot, dryRun: false}
);
assert(richApply.ok, 'rich heading apply should pass: ' + JSON.stringify(richApply.diagnostics));
const richAfter = fs.readFileSync(path.join(richRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8').split('\n');
const richBefore = RICH_STATUS.split('\n');
const richChanged = richBefore.map((line, idx) => line !== richAfter[idx] ? idx + 1 : 0).filter(Boolean);
assert.deepStrictEqual(richChanged, [5], 'only the section heading line may change, changed: ' + JSON.stringify(richChanged));
assert(richAfter.includes('= Government') && richAfter.includes('= Party'), 'interior headings must survive a heading edit');
assert.strictEqual(richAfter.length, richBefore.length, 'no lines may be added or removed');

// Regression 3 (truncation write-back): the indexer caps long lines at 180
// chars with a "..." marker; editing such a line must refuse auto-apply and no
// auto operation may carry truncated text.
const truncatedRecord = richMain.statusLineRows.find((row) => row.search.length === 180 && row.search.endsWith('...'));
assert(truncatedRecord, 'fixture should index the over-long status line as a truncated excerpt');
const truncatedIdx = richMain.statusLineRows.indexOf(truncatedRecord);
const editedStatusLines = richMain.statusLines.split('\n');
editedStatusLines[truncatedIdx] = 'Stability report: [+ demo_support +] rewritten.';
const truncatedDraft = sidebarStatus.applyDraftValues(richBase, {
  'sidebar.sectionId': sidebarStatus.MAIN_SECTION_ID,
  'sidebar.sectionStatusLines': editedStatusLines.join('\n')
}, {projectIndex: richIndex});
const truncatedOps = sidebarStatus.buildInstallPlan(truncatedDraft, richIndex).operations;
assert(!truncatedOps.some((op) => op.safety !== 'manual_review'), 'editing a truncated line must not produce auto-apply operations: ' + JSON.stringify(truncatedOps));
sidebarStatus.buildInstallPlan(truncatedDraft, richIndex).operations.forEach((op) => {
  if (op.safety === 'manual_review') {
    return;
  }
  const payload = String(op.replace || '') + '\n' + String(op.content || '');
  assert(!payload.split('\n').some((line) => line.trim().length === 180 && line.trim().endsWith('...')), 'no auto operation may write truncated excerpt text');
});

const deleteProjectRoot = copyTemplate();
const deleteIndex = buildIndex(deleteProjectRoot, path.join(os.tmpdir(), 'dms_sidebar_status_delete_index.json'));
const deleteDraft = sidebarStatus.normalizeDraft(Object.assign({}, sidebarStatus.defaultDraft(deleteIndex), {
  id: 'delete_organization_sidebar',
  title: 'Delete organization sidebar tab',
  sectionId: 'organization',
  sectionHeading: 'Organization',
  operationMode: 'delete',
  deleteConfirm: true,
  evidence: sidebarStatus.buildSidebarModel(deleteIndex)
}));
const deleteValidation = sidebarStatus.validateDraft(deleteDraft, deleteIndex);
assert(deleteValidation.ok, 'source-backed sidebar delete draft should validate: ' + JSON.stringify(deleteValidation.diagnostics));
const deleteBundle = sidebarStatus.buildExportBundle(deleteDraft, deleteIndex);
const deleteOp = deleteBundle.installPlan.operations.find((op) => op.id === 'sidebar_status_delete_section');
assert(deleteOp && deleteOp.type === 'replace_section' && deleteOp.allowEmptyReplace && deleteOp.destructive, 'sidebar delete should produce a destructive empty replace_section operation');
assert(deleteOp.safety === 'guarded_apply' && deleteOp.role === 'sidebar_status.delete_section', 'sidebar delete should stay guarded source apply');
const deleteDryRun = installPlan.applyInstallPlan(deleteBundle.installPlan, {projectRoot: deleteProjectRoot, dryRun: true});
assert(deleteDryRun.ok && deleteDryRun.results.some((row) => row.id === 'sidebar_status_delete_section' && row.status === 'would_apply'), 'sidebar delete dry-run should pass');
const deleteApply = installPlan.applyInstallPlan(deleteBundle.installPlan, {projectRoot: deleteProjectRoot, dryRun: false});
assert(deleteApply.ok, 'sidebar delete apply should pass: ' + JSON.stringify(deleteApply.diagnostics));
const deleteStatusText = fs.readFileSync(path.join(deleteProjectRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8');
assert(!deleteStatusText.includes('@organization'), 'sidebar delete should remove the selected category anchor');
assert(!deleteStatusText.includes('= Organization'), 'sidebar delete should remove the selected category heading');
assert(deleteStatusText.includes('@cards'), 'sidebar delete should preserve the next category');
const deleteAgain = installPlan.applyInstallPlan(deleteBundle.installPlan, {projectRoot: deleteProjectRoot, dryRun: false});
assert(deleteAgain.ok && deleteAgain.results[0].status === 'already_applied', 'sidebar delete should be idempotent after the category is gone');

console.log(JSON.stringify({
  ok: true,
  sections: starterModel.sections.length,
  guardedOps: installPlan.operationSummary(tempBundle.installPlan).guardedApply
}, null, 2));
