#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {readViewerI18n, readExploreBundle} = require('./check_viewer_assets.js');

const ROOT = __dirname;
const variableDraft = require('./authoring/variable_editor_draft.js');
const installPlan = require('./authoring/install_plan.js');
const projectStateSurface = require('./viewer/project_state_surface.js');
const projectStateWorkspace = require('./viewer/object_canvas_project_state_workspace.js');

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
        writes: [{path: 'source/scenes/root.scene.dry', line: 3, text: 'if (Q.demo_resources === undefined) { Q.demo_resources = 2; }'}],
        definedIn: [{path: 'source/scenes/root.scene.dry', line: 3, text: 'if (Q.demo_resources === undefined) { Q.demo_resources = 2; }'}],
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
const consumerModel = variableDraft.buildVariableConsumerModel(index);
assert(consumerModel.kind === 'variable_consumer_model', 'variable consumer model should build from ProjectIndex');
const consumerRow = consumerModel.variables.find((item) => item.name === 'demo_resources');
assert(consumerRow && consumerRow.consumers.length === 3, 'variable consumer model should expose read/write/definition consumers');
assert(consumerRow.consumerSummary.byArea.system_ui === 2, 'root definition/write should be classified as System UI consumers');
assert(consumerRow.consumerSummary.byArea.card === 1, 'card read should be classified as a card consumer');
const defaultAddDraft = variableDraft.defaultDraft(index);
assert(defaultAddDraft.mode === 'add_new', 'default variable draft should create a new variable instead of editing the first indexed variable');
assert(defaultAddDraft.variableName === 'new_variable', 'default variable draft should not target the first indexed variable');
const uniqueDefaultDraft = variableDraft.defaultDraft(Object.assign({}, index, {variables: index.variables.concat([{name: 'new_variable'}])}));
assert(uniqueDefaultDraft.variableName === 'new_variable_2', 'default variable draft should avoid an existing new_variable name');
const fallbackVariableState = {
  projectIndex: Object.assign({}, index, {
    variables: index.variables.concat([{name: 'new_variable'}, {name: 'new_variable_2'}])
  }),
  selectedCanvasNode: 'variable:demo_resources'
};
const fallbackDeps = {global: {}, variableEditorDraft: null};
assert(projectStateWorkspace.nextAvailableVariableName(fallbackVariableState, 'new_variable', fallbackDeps) === 'new_variable_3', 'Project State workspace fallback should suffix duplicate variable names');
const fallbackDeleteDraft = projectStateWorkspace.deleteVariableDraft(fallbackVariableState, {name: 'demo_resources'}, fallbackDeps);
assert(fallbackDeleteDraft.mode === 'delete_existing', 'Project State workspace fallback delete draft should use delete_existing mode');
assert(fallbackDeleteDraft.id === 'delete_demo_resources', 'Project State workspace fallback delete draft should use a stable safe id');
assert(projectStateWorkspace.selectedNodeForVariableDraft({variableName: 'demo_resources'}) === 'variable:demo_resources', 'Project State workspace should map variable drafts back to Canvas variable nodes');
assert(projectStateWorkspace.safeDraftId('123 odd name') === 'variable_123_odd_name', 'Project State workspace should prefix unsafe draft ids');
const fastSelectState = {
  projectIndex: index,
  model: {changeState: {draft: defaultAddDraft}},
  baseDraft: defaultAddDraft,
  selectedCanvasNode: 'variable:new_variable',
  template: 'variables',
  mode: 'variables',
  view: 'variables',
  workspace: 'project_state',
  values: {stale: 'draft value'},
  valueOriginals: {stale: 'draft value'}
};
let fastSelectRendered = false;
const fastSelectDeps = {
  currentSurface: () => ({key: 'project_state_board'}),
  buildTemplateModel: ({values}) => ({
    changeState: {draft: fastSelectState.baseDraft},
    eventBody: {
      title: {id: 'variables.title', label: 'Draft title', value: fastSelectState.baseDraft.title},
      heading: {id: 'variables.label', label: 'Label', value: fastSelectState.baseDraft.label},
      sections: [{id: 'variables.description', label: 'Description', value: fastSelectState.baseDraft.description}],
      metaFields: [{id: 'variables.mode', label: 'Mode', value: fastSelectState.baseDraft.mode}]
    },
    values
  }),
  ensureArray: (value) => Array.isArray(value) ? value : [],
  render: () => {
    fastSelectRendered = true;
  },
  resetRuntimeLens: () => {},
  resetStructureCommands: () => {},
  showWorkspace: () => {},
  t: (_key, fallback) => fallback,
  variableEditorDraft: variableDraft
};
assert(projectStateWorkspace.fastSelectNode(fastSelectState, 'variable:demo_resources', fastSelectDeps), 'Project State row selection should handle existing variables');
assert(fastSelectRendered, 'Project State row selection should rerender the editor pane');
assert(fastSelectState.baseDraft.mode === 'edit_existing', 'Project State row selection should load an edit-existing draft');
assert(fastSelectState.baseDraft.variableName === 'demo_resources', 'Project State row selection should target the selected variable');
assert(fastSelectState.model.eventBody.title.value !== 'New Variable', 'Project State right editor should not keep the add-new placeholder after selecting an existing variable');
assert(Object.keys(fastSelectState.values).length === 0, 'Project State row selection should clear stale add-new field values');

const editDraft = Object.assign(variableDraft.draftFromVariable(index.variables[0], index), {initialValue: '5'});
const editBundle = variableDraft.buildExportBundle(editDraft, index, {locale: 'en'});
assert(editBundle.ok, 'existing variable draft should validate: ' + JSON.stringify(editBundle.diagnostics));
assert(editBundle.installPlan.operations.length === 1, 'existing source-backed variables should produce a single edit operation');
assert(editBundle.installPlan.operations[0].type === 'replace_text', 'existing variable edits should replace the source-backed initializer');
assert(editBundle.installPlan.operations[0].safety === 'advanced_apply', 'protected existing variable init should require advanced apply');
assert(editBundle.installPlan.operations[0].replace.includes('Q.demo_resources = 5'), 'existing variable edit should carry the requested initial value');
assert(editBundle.playerPreview.includes('Q.demo_resources'), 'existing variable preview should show the selected Q variable');
const editDryRun = installPlan.applyInstallPlan(editBundle.installPlan, {projectRoot: tmpRoot, dryRun: true, allowAdvanced: true});
assert(editDryRun.ok && editDryRun.results.some((item) => item.id === 'variable_existing_init' && item.status === 'would_apply'), 'advanced existing variable edit should dry-run when explicitly allowed: ' + JSON.stringify(editDryRun));

const deleteDraft = variableDraft.deleteDraftFromVariable(index.variables[0], index);
const deleteBundle = variableDraft.buildExportBundle(deleteDraft, index, {locale: 'en'});
assert(deleteDraft.mode === 'delete_existing', 'delete draft should use delete_existing mode');
assert(deleteBundle.installPlan.operations.length === 1, 'delete variables should produce a single review operation');
assert(deleteBundle.installPlan.operations[0].id === 'variable_delete_review', 'delete variables should produce a deletion review operation');
assert(deleteBundle.installPlan.operations[0].safety === 'manual_review', 'variable deletion should not auto-apply source changes');
assert(deleteBundle.installPlan.operations[0].content.includes('Consumer map'), 'variable delete review should include consumer evidence');
assert(deleteBundle.playerPreview.includes('Delete existing variable'), 'delete preview should label the destructive mode');

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
const duplicateAdd = variableDraft.buildExportBundle(Object.assign({}, addDraft, {
  id: 'add_demo_resources_again',
  variableName: 'demo_resources'
}), index, {locale: 'en'});
assert(!duplicateAdd.ok, 'add-new should fail when the variable already exists');
assert(duplicateAdd.diagnostics.some((diag) => diag.code === 'variable_editor.duplicate' && diag.severity === 'error'), 'duplicate add-new variable should be a blocking diagnostic');
assert(!duplicateAdd.installPlan.operations.some((op) => op.id === 'variable_root_init' && op.safety === 'guarded_apply'), 'duplicate add-new variable should not generate a guarded root init');

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
assert(html.includes('value="delete_existing"'), 'Variable Editor should expose a delete-existing mode');
assert(i18n.includes("'create.preview': 'Player preview'"), 'English player preview label should be localized and title-cased');
assert(i18n.includes("'create.variables'"), 'Variables Create tab should be localized');
assert(i18n.includes("'create.option.deleteExisting'"), 'Delete variable mode should be localized');
assert(i18n.includes("'variableEditor.evidence.consumers'"), 'Variable consumer evidence should be localized');
assert(app.includes('data-edit-variable'), 'Explore variable inspector should offer an edit action');
const variableSurfaceHtml = projectStateSurface.render({
  title: 'Variables',
  contextBoard: {variables: []},
  changeState: {draft: addDraft},
  eventBody: {
    title: {id: 'variables.title', label: 'Draft title', value: addDraft.title},
    heading: {id: 'variables.label', label: 'Label', value: addDraft.label},
    sections: [{id: 'variables.description', label: 'Description', value: addDraft.description}],
    metaFields: [
      {id: 'variables.mode', label: 'Mode', value: addDraft.mode, inputType: 'select', options: ['add_new', 'edit_existing', 'delete_existing']},
      {id: 'variables.includeRootInit', label: 'Root init', value: addDraft.includeRootInit, inputType: 'checkbox'}
    ]
  }
}, {projectIndex: index, selected: 'variable:demo_resources'});
assert(variableSurfaceHtml.includes('data-object-canvas-action="project_state_new_variable"'), 'Project State surface should expose Add Variable');
assert(variableSurfaceHtml.includes('data-object-canvas-action="project_state_edit_selected"'), 'Project State surface should expose Edit Selected');
assert(variableSurfaceHtml.includes('data-object-canvas-action="project_state_delete_selected"'), 'Project State surface should expose Delete Selected');
assert(variableSurfaceHtml.includes('delete_existing'), 'Project State variable editor should expose delete mode');
assert(variableSurfaceHtml.includes('type="checkbox"'), 'Project State variable editor should render boolean toggles as checkboxes');
const draftSelectedSurfaceHtml = projectStateSurface.render({
  title: 'Variables',
  contextBoard: {variables: []},
  changeState: {draft: addDraft},
  eventBody: {
    title: {id: 'variables.title', label: 'Draft title', value: addDraft.title},
    heading: {id: 'variables.label', label: 'Label', value: addDraft.label},
    sections: [],
    metaFields: []
  }
}, {projectIndex: index, selected: 'object'});
assert(draftSelectedSurfaceHtml.includes('class="project-state-row is-selected" data-object-canvas-graph-node="variable:campaign_energy"'), 'Project State surface should select the add-new draft variable instead of the first indexed variable');

fs.rmSync(tmpRoot, {recursive: true, force: true});

process.stdout.write(JSON.stringify({
  ok: true,
  variables: model.variables.length,
  operations: addBundle.installPlan.operations.length
}, null, 2) + '\n');
