#!/usr/bin/env node
// @ts-check
'use strict';

const rightSidebar = require('./authoring/right_sidebar_draft.js');

const {assert} = require('./check_harness.js');

const index = {
  schemaVersion: '0.1',
  project: {name: 'Test Mod', root: '/tmp/right-sidebar-fixture'},
  scenes: [],
  semantic: {}
};

// --- API surface -----------------------------------------------------------
[
  'buildRightSidebarModel',
  'defaultDraft',
  'normalizeDraft',
  'validateDraft',
  'buildInstallPlan',
  'buildExportBundle',
  'renderRightSidebarHtml'
].forEach((name) => {
  assert(typeof rightSidebar[name] === 'function', 'right_sidebar_draft should export ' + name + '()');
});

// --- Evidence model --------------------------------------------------------
const model = rightSidebar.buildRightSidebarModel(index);
assert(model.kind === 'right_sidebar_model', 'buildRightSidebarModel should produce a right_sidebar_model');
assert(model.applyMode === 'manual_review', 'this slice should keep the apply mode manual review');
assert(model.recommendedTemplateDir === 'templates/html/test-mod', 'template dir should be slugged from the project name');
assert(model.engineTemplate && model.engineTemplate.name === 'default-tabbed-sidebar', 'model should reference the engine default-tabbed-sidebar template');
assert(model.engineTemplate.rightPanelCssReady === true, 'model should note the engine .tools.right CSS is already present');
assert(model.rightPanelElementId === 'stats_sidebar_right', 'model should target the engine right-sidebar element id');
assert(Array.isArray(model.readiness) && model.readiness.length === 3, 'model should expose three readiness rows');
assert(model.readiness.some((row) => row.id === 'mod_template_source' && row.status === 'manual'), 'mod template source should stay manual until ejected');

// --- Draft normalization + validation -------------------------------------
const draft = rightSidebar.defaultDraft(index);
assert(draft.kind === 'right_sidebar', 'defaultDraft should be a right_sidebar draft');
assert(/^[A-Za-z_][A-Za-z0-9_]*$/.test(draft.id), 'default draft id should be file-safe');
assert(draft.templateDir === 'templates/html/test-mod', 'default draft should adopt the recommended template dir');

draft.panelTitle = 'Field Notes';
draft.panelBody = 'Clues gathered so far.\n\nUpdated each chapter.';
draft.panelLines = 'Suspects: 3';

const validation = rightSidebar.validateDraft(draft, index);
assert(validation.ok, 'a draft with a title and content should validate');
assert(validation.diagnostics.some((d) => d.code === 'right_sidebar.manual_review' && d.severity === 'info'),
  'validation should surface the honest manual-review note');

// normalizeDraft is defensive: messy raw input is coerced into a safe, valid
// draft rather than failing, so Review & Apply always has a usable proposal.
const messy = rightSidebar.validateDraft({id: '9bad id', title: '', templateDir: ''}, index);
assert(/^[A-Za-z_][A-Za-z0-9_]*$/.test(messy.draft.id), 'validateDraft should normalize a messy id into a file-safe id');
assert(messy.draft.title.length > 0, 'validateDraft should backfill a default draft title');
assert(messy.draft.templateDir.indexOf('templates/html/') === 0, 'validateDraft should backfill a default template dir');

// --- Install plan: the safety invariant for this slice ---------------------
const plan = rightSidebar.buildInstallPlan(draft, index);
assert(plan && typeof plan.kind === 'string', 'buildInstallPlan should return an install plan');
const ops = Array.isArray(plan.operations) ? plan.operations : [];
assert(ops.length >= 2, 'plan should contain the eject and insert operations');
assert(ops.every((op) => op.safety === 'manual_review'),
  'every template-write operation in this slice MUST stay manual_review (no auto-apply)');
assert(!ops.some((op) => ['safe_apply', 'guarded_apply', 'advanced_apply'].includes(String(op.safety))),
  'this slice must never emit an auto-applyable template write');
assert(ops.every((op) => op.type === 'manual_snippet'), 'template operations should be manual snippets');
assert(ops.every((op) => String(op.path || '').startsWith(draft.templateDir + '/+index.html')),
  'operations should target the mod-owned template +index.html');
assert(!ops.some((op) => /(^|\/)out\/html|(^|\/)\.git(\/|$)/.test(String(op.path || ''))),
  'operations must never target generated out/html or .git');
assert(ops.some((op) => op.role === 'right_sidebar.eject'), 'plan should include the eject/adopt step');
assert(ops.some((op) => op.role === 'right_sidebar.insert'), 'plan should include the panel insert step');

// --- Export bundle ---------------------------------------------------------
const bundle = rightSidebar.buildExportBundle(draft, index);
assert(bundle.ok, 'export bundle should build for a valid draft');
assert(bundle.files.some((file) => file.path.endsWith('.stats-sidebar-right.html') && file.kind === 'snippet'),
  'export bundle should include the pasteable right-panel snippet');
assert(bundle.files.some((file) => file.path.endsWith('.patch-preview.diff')), 'export bundle should include a patch preview');
assert(bundle.files.some((file) => file.path.endsWith('.install-plan.json')), 'export bundle should include the install plan json');
assert(bundle.panelHtml.includes("id='stats_sidebar_right'") && bundle.panelHtml.includes("class='tools right'"),
  'panel html should render the engine right-sidebar element');
assert(bundle.panelHtml.includes('Field Notes'), 'panel html should render the authored panel title');
assert(bundle.panelHtml.includes('Clues gathered so far.'), 'panel html should render the authored panel body');

// --- Eject instructions ----------------------------------------------------
const eject = rightSidebar.renderEjectInstructions(draft, model);
assert(eject.includes('node_modules/dendrynexus/lib/templates/html/default-tabbed-sidebar'),
  'eject instructions should point at the engine template source');
assert(eject.includes('+game.css'), 'eject instructions should adopt both +index.html and +game.css');

process.stdout.write(JSON.stringify({
  ok: true,
  templateDir: model.recommendedTemplateDir,
  operations: ops.length,
  exportFiles: bundle.files.length
}, null, 2) + '\n');
