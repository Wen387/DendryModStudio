#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {readViewerI18n, readExploreBundle} = require('./check_viewer_assets.js');

const ROOT = __dirname;
const variableDraft = require('./authoring/variable_editor_draft.js');
const installPlan = require('./authoring/install_plan.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function syntheticIndex(root) {
  return {
    schemaVersion: '0.1',
    project: {
      name: 'Variable Fixture',
      root,
      profileIds: ['generic-dendry']
    },
    scenes: [],
    variables: [
      {
        name: 'demo_resources',
        scope: 'q',
        confidence: 'exact',
        reads: [{path: 'source/scenes/cards/demo_card.scene.dry', line: 12}],
        writes: [{path: 'source/scenes/root.scene.dry', line: 5, text: 'if (Q.demo_resources === undefined) { Q.demo_resources = 2; }'}],
        definedIn: [{path: 'source/scenes/root.scene.dry', line: 5}],
        readCount: 1,
        writeCount: 1
      }
    ],
    diagnostics: []
  };
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_variable_editor_'));
fs.mkdirSync(path.join(tmpRoot, 'source', 'scenes'), {recursive: true});
fs.writeFileSync(path.join(tmpRoot, 'source', 'info.dry'), 'title: Variable Fixture\nauthor: Studio\n', 'utf8');
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'root.scene.dry'),
  [
    'title: Root',
    'on-arrival: {!',
    'if (Q.demo_resources === undefined) { Q.demo_resources = 2; }',
    '// ====== U. EVENT SEEN FLAGS ======',
    '!}',
    ''
  ].join('\n'),
  'utf8'
);

const index = syntheticIndex(tmpRoot);
const model = variableDraft.buildVariableModel(index);
assert(model.kind === 'variable_editor_model', 'variable model should build from ProjectIndex');
assert(model.variables.length === 1 && model.variables[0].name === 'demo_resources', 'variable model should expose indexed variables');

const editDraft = variableDraft.draftFromVariable(index.variables[0], index);
const editBundle = variableDraft.buildExportBundle(editDraft, index, {locale: 'en'});
assert(editBundle.ok, 'existing variable draft should validate: ' + JSON.stringify(editBundle.diagnostics));
assert(editBundle.installPlan.operations.length === 1, 'existing variables should stay manual-review by default');
assert(editBundle.installPlan.operations[0].safety === 'manual_review', 'existing variable edits should not auto-apply source logic');
assert(editBundle.playerPreview.includes('Q.demo_resources'), 'existing variable preview should show the selected Q variable');

const addDraft = variableDraft.normalizeDraft({
  id: 'add_campaign_energy',
  title: 'Add campaign energy',
  mode: 'add_new',
  variableName: 'campaign_energy',
  label: 'Campaign Energy',
  initialValue: '3',
  valueType: 'number',
  description: 'Tracks remaining campaign energy.',
  includeRootInit: true,
  includePostEventInit: true,
  includeQualityFile: true
});
const addBundle = variableDraft.buildExportBundle(addDraft, index, {locale: 'en'});
assert(addBundle.ok, 'new variable draft should validate: ' + JSON.stringify(addBundle.diagnostics));
assert(addBundle.qualityFile.includes('name: Campaign Energy'), 'quality file should include the label');
assert(addBundle.installPlan.operations.some((op) => op.id === 'variable_root_init' && op.safety === 'guarded_apply'), 'new variables should generate a guarded root init');
assert(addBundle.installPlan.operations.some((op) => op.id === 'variable_quality_file' && op.safety === 'manual_review'), 'quality files should remain manual review');
assert(!/[\u3400-\u9fff]/.test(addBundle.playerPreview), 'English variable preview should not contain CJK text');

const dryRun = installPlan.applyInstallPlan(addBundle.installPlan, {projectRoot: tmpRoot, dryRun: true});
assert(dryRun.ok && dryRun.results.some((item) => item.id === 'variable_root_init' && item.status === 'would_apply'), 'guarded root init should dry-run cleanly: ' + JSON.stringify(dryRun));
const applied = installPlan.applyInstallPlan(addBundle.installPlan, {projectRoot: tmpRoot, dryRun: false});
assert(applied.ok, 'guarded root init should apply cleanly: ' + JSON.stringify(applied));
const rootText = fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'root.scene.dry'), 'utf8');
assert(rootText.includes('if (Q.campaign_energy === undefined) { Q.campaign_energy = 3; }'), 'root init should be inserted into root.scene.dry');

const html = fs.readFileSync(path.join(ROOT, 'viewer', 'index.html'), 'utf8');
const authoringWorkspaceUi = fs.readFileSync(path.join(ROOT, 'viewer', 'authoring_workspace_ui.js'), 'utf8');
const i18n = readViewerI18n(path.join(ROOT, 'viewer'));
const app = readExploreBundle(path.join(ROOT, 'viewer'));
assert(authoringWorkspaceUi.includes("key: 'variables'"), 'Create template switch should include Variables');
assert(html.includes('id="variable-editor-name"'), 'Variable Editor should expose a variable selector/input');
assert(html.includes('id="variable-editor-root-init"'), 'Variable Editor should expose a root init toggle');
assert(i18n.includes("'create.preview': 'Player preview'"), 'English player preview label should be localized and title-cased');
assert(i18n.includes("'create.variables'"), 'Variables Create tab should be localized');
assert(app.includes('data-edit-variable'), 'Explore variable inspector should offer an edit action');

fs.rmSync(tmpRoot, {recursive: true, force: true});

process.stdout.write(JSON.stringify({
  ok: true,
  variables: model.variables.length,
  operations: addBundle.installPlan.operations.length
}, null, 2) + '\n');
