#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const surfaceDraft = require('./authoring/surface_text_draft.js');
const viewer = require('./viewer/app.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_INDEX = '/tmp/dendry_project_map/project-index.json';
const SOURCE_DRAFT = path.join(__dirname, 'fixtures', 'surface_text_drafts', 'sample_label_replacement.json');
const HTML_DRAFT = path.join(__dirname, 'fixtures', 'surface_text_drafts', 'unsupported_html_label.json');
const VIEWER_INDEX = path.join(__dirname, 'viewer', 'index.html');
const SURFACE_SCHEMA = path.join(__dirname, 'schema', 'surface-text-draft.schema.json');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function syntheticIndex() {
  return {
    schemaVersion: '0.1',
    project: {name: 'surface fixture', root: REPO_ROOT, profileIds: ['generic-dendry']},
    profiles: [{id: 'generic-dendry'}],
    scenes: [],
    edges: [],
    variables: [{name: 'resources', tags: ['resource']}],
    semantic: {
      events: [],
      cards: [],
      hands: [],
      decks: [],
      pinnedCards: [],
      news: {items: []},
      surfaceText: {
        items: [
          {
            id: 'sample-source-resources-label',
            label: '資源',
            area: 'sidebar',
            variableName: 'resources',
            editability: 'draft_exportable',
            confidence: 'static_inferred',
            source: {path: 'source/scenes/status.scene.dry', line: 12}
          },
          {
            id: 'sample-html-resources-label',
            label: '資源',
            area: 'html_sidebar',
            variableName: 'resources',
            editability: 'ide_escape_hatch',
            confidence: 'profile_heuristic',
            source: {path: 'out/html/strategy-sidebar.js', line: 88}
          }
        ]
      }
    },
    diagnostics: [],
    summary: {surfaceTextCount: 2}
  };
}

function loadGeneratedIndex() {
  if (!fs.existsSync(DEFAULT_INDEX)) {
    return null;
  }
  return readJson(DEFAULT_INDEX);
}

const sourceBundle = surfaceDraft.buildExportBundle(readJson(SOURCE_DRAFT), syntheticIndex());
const htmlBundle = surfaceDraft.buildExportBundle(readJson(HTML_DRAFT), syntheticIndex());
const textProposalBundle = surfaceDraft.buildExportBundle({
  schemaVersion: '0.1',
  kind: 'surface_text',
  id: 'rewrite_event_body_paragraph',
  itemId: 'anti_curriculum',
  area: 'body',
  originalLabel: 'Original player-facing paragraph.',
  replacementLabel: 'Rewritten player-facing paragraph.',
  editability: 'text_proposal',
  source: {path: 'source/scenes/events/anti_curriculum.scene.dry', line: 42},
  reason: 'Text Corpus body prose should remain proposal-first and manual-review unless a bounded source editor owns it.'
});
const multiLineTextProposalBundle = surfaceDraft.buildExportBundle({
  schemaVersion: '0.1',
  kind: 'surface_text',
  id: 'rewrite_event_body_multiline',
  itemId: 'anti_curriculum',
  area: 'body',
  originalLabel: 'Original player-facing paragraph.\nSecond original line.',
  replacementLabel: 'Rewritten multi-line player-facing paragraph.',
  editability: 'text_proposal',
  source: {path: 'source/scenes/events/anti_curriculum.scene.dry', line: 42, endLine: 43},
  reason: 'Multi-line Text Corpus prose remains manual until range-aware replacement owns it.'
});
const surfaceSchema = readJson(SURFACE_SCHEMA);
const viewerHtml = fs.readFileSync(VIEWER_INDEX, 'utf8');
const surfaceUi = fs.readFileSync(path.join(__dirname, 'viewer', 'surface_text_ui.js'), 'utf8');
const model = viewer.buildViewModel(syntheticIndex());

assert(sourceBundle.ok, 'source-backed surface text draft should be valid: ' + JSON.stringify(sourceBundle.diagnostics));
assert(htmlBundle.ok, 'HTML escape-hatch surface text draft should be valid: ' + JSON.stringify(htmlBundle.diagnostics));
assert(textProposalBundle.ok, 'Text Corpus text_proposal draft should validate: ' + JSON.stringify(textProposalBundle.diagnostics));
assert(surfaceSchema.properties.editability.enum.includes('text_proposal'), 'SurfaceTextDraft schema should accept Text Corpus text_proposal editability');
assert(sourceBundle.installNotes.includes('proposal only / not installed'), 'source install notes should mark proposal-only status');
assert(sourceBundle.installNotes.includes('資源'), 'source install notes should include original label');
assert(sourceBundle.installNotes.includes('資金'), 'source install notes should include replacement label');
assert(sourceBundle.installNotes.includes('source/scenes/status.scene.dry:12'), 'source install notes should include source path and line');
assert(sourceBundle.proposal.includes('Replace: 資源'), 'source proposal should describe replacement');
assert(htmlBundle.installNotes.includes('IDE escape hatch'), 'HTML install notes should explain escape hatch');
assert(htmlBundle.installNotes.includes('out/html/strategy-sidebar.js:88'), 'HTML install notes should include generated UI evidence');
assert(htmlBundle.installNotes.includes('why Studio will not auto-edit'), 'HTML install notes should explain why it cannot auto-handle generated UI');
assert(textProposalBundle.installNotes.includes('guarded-apply'), 'single-line text proposals should explain guarded apply');
assert(textProposalBundle.installPlan.operations.every((op) => op.safety === 'guarded_apply'), 'single-line text_proposal install plans should use guarded apply');
assert(textProposalBundle.installPlan.operations.every((op) => op.type === 'replace_text'), 'single-line text_proposal install plans should expose guarded replace_text operations');
assert(multiLineTextProposalBundle.installNotes.includes('manual review'), 'multi-line text proposals should explain manual review');
assert(multiLineTextProposalBundle.installPlan.operations.every((op) => op.safety === 'manual_review'), 'multi-line text_proposal install plans should stay manual-review only');
assert(multiLineTextProposalBundle.installPlan.operations.every((op) => op.type === 'manual_snippet'), 'multi-line text_proposal install plans should not expose auto replace_text operations');
assert(sourceBundle.files.some((file) => file.path === 'rename_resources_to_funds.install-plan.json'), 'source bundle should include install plan JSON');
assert(sourceBundle.files.some((file) => file.path === 'rename_resources_to_funds.patch-preview.diff'), 'source bundle should include patch preview');
assert(sourceBundle.installPlan.operations.some((op) => op.type === 'replace_text'), 'source bundle should expose replace-text operation');
assert(sourceBundle.patchPreview.includes('diff --git'), 'source bundle should expose patch preview');
assert(sourceBundle.installChecklist.includes('Safe apply'), 'source bundle should expose install operation checklist');
assert(htmlBundle.files.some((file) => file.path === 'rename_html_resources_to_funds.surface-text-draft.json'), 'surface bundle should include draft JSON');
assert(htmlBundle.files.some((file) => file.path === 'rename_html_resources_to_funds.install-notes.txt'), 'surface bundle should include install notes');

assert(Array.isArray(model.lists.surfaceText), 'viewer model should expose surfaceText list');
assert(model.lists.surfaceText.length === 2, 'viewer model should preserve surfaceText items');
const surfaceSearch = viewer.filterAndSortItems(model, 'surfaceText', '資源', 'label', 'asc');
assert(surfaceSearch.length === 2, 'surface text search should match label');
assert(surfaceSearch.some((item) => item.raw && item.raw.editability === 'ide_escape_hatch'), 'surface text search should preserve escape hatch items');

assert(viewerHtml.includes('data-view="surfaceText"'), 'viewer should expose Surface Text explore nav');
const authoringWorkspaceUi = fs.readFileSync(path.join(__dirname, 'viewer', 'authoring_workspace_ui.js'), 'utf8');
assert(authoringWorkspaceUi.includes("key: 'surface'"), 'viewer should expose Surface Text create template');
assert(viewerHtml.includes('id="surface-text-form"'), 'viewer should expose Surface Text form');
assert(viewerHtml.includes('id="surface-label-original"'), 'viewer should expose original label field');
assert(viewerHtml.includes('id="surface-label-replacement"'), 'viewer should expose replacement label field');
assert(viewerHtml.includes('id="surface-patch-preview"'), 'viewer should expose Surface Text patch preview');
assert(viewerHtml.includes('id="surface-download-plan"'), 'viewer should expose Surface Text install plan download');
assert(viewerHtml.includes('../authoring/surface_text_draft.js'), 'viewer should load SurfaceTextDraft core');
assert(viewerHtml.includes('surface_text_ui.js'), 'viewer should load Surface Text UI');
assert(surfaceUi.includes('installChecklist'), 'Surface Text UI should surface install operation checklist');

const generated = loadGeneratedIndex();
const generatedRoot = generated && generated.project && generated.project.root
  ? generated.project.root
  : REPO_ROOT;
if (generated) {
  const generatedItems = generated.semantic && generated.semantic.surfaceText
    ? generated.semantic.surfaceText.items || []
    : [];
  assert(generatedItems.length > 0, 'generated ProjectIndex should include surfaceText items');
  assert(
    generatedItems.some((item) => String(item.label || '').includes('資源') || item.variableName === 'resources'),
    'generated surfaceText should include resources-like labels'
  );
  assert(
    generatedItems.some((item) => String(item.source && item.source.path || '').startsWith('out/html/') && item.editability === 'ide_escape_hatch'),
    'generated surfaceText should include IDE-only out/html evidence'
  );
}

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_surface_text_export_smoke_'));
const cli = spawnSync(
  'node',
  [
    path.join(__dirname, 'generate_surface_text.js'),
    '--draft', SOURCE_DRAFT,
    '--index', DEFAULT_INDEX,
    '--out-dir', outDir,
    '--summary'
  ],
  {cwd: REPO_ROOT, encoding: 'utf8'}
);
if (fs.existsSync(DEFAULT_INDEX)) {
  assert(cli.status === 0, 'Surface Text CLI should succeed: ' + cli.stderr);
  assert(fs.existsSync(path.join(outDir, 'rename_resources_to_funds.install-notes.txt')), 'Surface Text CLI should write install notes');
  assert(fs.existsSync(path.join(outDir, 'rename_resources_to_funds.install-plan.json')), 'Surface Text CLI should write install-plan JSON file');
  assert(fs.existsSync(path.join(outDir, 'rename_resources_to_funds.patch-preview.diff')), 'Surface Text CLI should write patch preview file');
}

const protectedCli = spawnSync(
  'node',
  [
    path.join(__dirname, 'generate_surface_text.js'),
    '--draft', SOURCE_DRAFT,
    '--index', DEFAULT_INDEX,
    '--out-dir', path.join(generatedRoot, 'source', 'surface-export')
  ],
  {cwd: REPO_ROOT, encoding: 'utf8'}
);
if (fs.existsSync(DEFAULT_INDEX)) {
  assert(protectedCli.status !== 0, 'Surface Text CLI should refuse source/ output');
}

process.stdout.write(JSON.stringify({
  ok: true,
  surfaceItems: model.lists.surfaceText.length,
  generatedSurfaceItems: generated && generated.semantic.surfaceText
    ? generated.semantic.surfaceText.items.length
    : null
}, null, 2) + '\n');
