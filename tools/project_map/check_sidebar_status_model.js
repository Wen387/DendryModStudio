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
assert(bundle.installPlan.operations.some((op) => op.id === 'sidebar_status_section' && op.type === 'replace_section'), 'plan should replace status section');
assert(bundle.patchPreview.includes('@@ replace section'), 'patch preview should show replace_section');
assert(bundle.playerPreview.includes('Justice Party Organization'), 'player preview should include changed section heading');
assert(installPlan.operationSummary(bundle.installPlan).guardedApply >= 2, 'source-backed changes should be guarded');

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
const tempDraft = Object.assign({}, draft, {evidence: sidebarStatus.buildSidebarModel(tempIndex)});
const tempBundle = sidebarStatus.buildExportBundle(tempDraft, tempIndex);
const dryRun = installPlan.applyInstallPlan(tempBundle.installPlan, {projectRoot, dryRun: true});
assert(dryRun.ok, 'dry-run should pass: ' + JSON.stringify(dryRun.diagnostics));
assert(dryRun.results.some((row) => row.id === 'sidebar_status_section' && row.status === 'would_apply'), 'dry-run should replace the section');
const applied = installPlan.applyInstallPlan(tempBundle.installPlan, {projectRoot, dryRun: false});
assert(applied.ok, 'apply should pass: ' + JSON.stringify(applied.diagnostics));
const statusText = fs.readFileSync(path.join(projectRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8');
assert(statusText.includes('title: Justice Party Status'), 'status title should be changed');
assert(statusText.includes('= Justice Party Organization'), 'status section heading should be changed');
assert(statusText.includes('Volunteer teams are active.'), 'conditional sidebar line should be changed');
assert(statusText.includes('@organization'), 'section anchor should be preserved');
assert(statusText.includes('@cards'), 'next section anchor should be preserved');

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
