#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const eventDraft = require('./authoring/event_draft.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SAMPLE_INDEX = path.join(os.tmpdir(), 'dendry_event_wizard_index_' + process.pid + '.json');
const SAMPLE_DRAFT = path.join(__dirname, 'fixtures', 'event_drafts', 'sample_world_event.json');
const GENERIC_DRAFT = path.join(__dirname, 'fixtures', 'event_drafts', 'generic_world_event.json');
const FOUR_CHOICE_DRAFT = path.join(__dirname, 'fixtures', 'event_drafts', 'four_choice_world_event.json');
const ADVANCED_DRAFT = path.join(__dirname, 'fixtures', 'event_drafts', 'advanced_world_event.json');
const VIEWER_INDEX = path.join(__dirname, 'viewer', 'index.html');
const WIZARD_UI = path.join(__dirname, 'viewer', 'wizard_ui.js');

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

function minimalIndex() {
  return {
    project: {root: REPO_ROOT},
    scenes: [{id: 'root'}],
    variables: [
      {name: 'resources'},
      {name: 'media_reach'},
      {name: 'civil_society_trust'},
      {name: 'founding_complete'},
      {name: 'year'},
      {name: 'month'}
    ]
  };
}

function genericMiniIndex() {
  return {
    project: {root: path.join(REPO_ROOT, 'tools', 'project_map', 'fixtures', 'generic-mini')},
    scenes: [],
    variables: [
      {name: 'generic_score'},
      {name: 'year'},
      {name: 'month'}
    ]
  };
}

function diagnosticCodes(result) {
  return result.diagnostics.map((diag) => diag.code);
}

const index = minimalIndex();
fs.writeFileSync(SAMPLE_INDEX, JSON.stringify(index, null, 2) + '\n', 'utf8');
const sample = readJson(SAMPLE_DRAFT);
const bundle = eventDraft.buildExportBundle(sample, index);
const genericBundle = eventDraft.buildExportBundle(readJson(GENERIC_DRAFT), genericMiniIndex());
const fourChoice = readJson(FOUR_CHOICE_DRAFT);
const fourChoiceBundle = eventDraft.buildExportBundle(fourChoice, index);
const advanced = readJson(ADVANCED_DRAFT);
const advancedBundle = eventDraft.buildExportBundle(advanced, index);
const zhAdvancedBundle = eventDraft.buildExportBundle(advanced, index, {defaultContinueLabel: '繼續'});
const viewerHtml = fs.readFileSync(VIEWER_INDEX, 'utf8');
const wizardUi = fs.readFileSync(WIZARD_UI, 'utf8');
delete globalThis.ProjectMapWizard;
require('./viewer/wizard_ui.js');
const wizardApi = globalThis.ProjectMapWizard;

assert(bundle.ok, 'sample draft should be valid: ' + JSON.stringify(bundle.diagnostics));
assert(genericBundle.ok, 'generic draft should be valid against generic-mini variables: ' + JSON.stringify(genericBundle.diagnostics));
assert(fourChoiceBundle.ok, 'four-choice draft should be valid: ' + JSON.stringify(fourChoiceBundle.diagnostics));
assert(advancedBundle.ok, 'advanced draft should be valid: ' + JSON.stringify(advancedBundle.diagnostics));
assert(genericBundle.scene.includes('Q.generic_score += 1;'), 'generic draft should render generic_score increment');
assert(fourChoiceBundle.scene.includes('- @observe_line: Observe first.'), 'four-choice scene should render fourth choice');
assert(fourChoiceBundle.scene.includes('@continue_observe_line'), 'four-choice scene should render fourth continuation anchor');
assert(advancedBundle.scene.includes('advanced_world_event_reviewed = 0'), 'advanced draft should use custom seen flag in view-if');
assert(advancedBundle.scene.includes('Q.media_reach += 1;'), 'advanced draft should render trigger effect');
assert(advancedBundle.scene.includes('choose-if: resources >= 1'), 'advanced draft should render option choose-if');
assert(advancedBundle.scene.includes('unavailable-subtitle: Resources are too low.'), 'advanced draft should render unavailable text');
assert(
  advancedBundle.scene.includes('[? if media_reach >= 5 : Existing media relationships make the response travel farther. ?]'),
  'advanced draft should render variant inline text'
);
assert(advancedBundle.scene.includes('- @after_public_response: Continue'), 'advanced draft should default continuation labels to English');
assert(zhAdvancedBundle.scene.includes('- @after_public_response: 繼續'), 'advanced draft should accept localized continuation labels');
assert(advancedBundle.scene.includes('@after_public_response'), 'advanced draft should render custom continuation anchor');
assert(fourChoiceBundle.installNotes.includes('Export bundle files:'), 'install notes should list bundle files');
assert(viewerHtml.includes('id="wizard-draft-file"'), 'wizard should expose an EventDraft JSON loader');
assert(viewerHtml.includes('id="wizard-option-count"'), 'wizard should expose a 2-4 option count control');
assert(viewerHtml.includes('data-option-index="3"'), 'wizard should include a fourth option editor block');
assert(viewerHtml.includes('id="wizard-seen-flag"'), 'wizard should expose custom seen flag');
assert(viewerHtml.includes('id="wizard-trigger-effects"'), 'wizard should expose trigger effects');
assert(viewerHtml.includes('id="wizard-effect-variable"'), 'wizard should expose an effect variable helper');
assert(viewerHtml.includes('id="wizard-effect-variable-options"'), 'wizard should expose variable datalist options');
assert(viewerHtml.includes('id="wizard-option-0-choose-if"'), 'wizard should expose option choose-if');
assert(viewerHtml.includes('id="wizard-option-0-unavailable"'), 'wizard should expose option unavailable text');
assert(viewerHtml.includes('id="wizard-option-0-variants"'), 'wizard should expose option variants');
assert(viewerHtml.includes('id="wizard-option-0-goto-after"'), 'wizard should expose option continuation anchor');
assert(viewerHtml.includes('id="wizard-patch-preview"'), 'wizard should expose patch preview');
assert(viewerHtml.includes('id="wizard-download-plan"'), 'wizard should expose install plan download');
assert(viewerHtml.includes('id="wizard-download-patch-preview"'), 'wizard should expose patch preview download');
assert(wizardUi.includes('applyEventDraftToForm'), 'wizard UI should be able to load an EventDraft into the form');
assert(wizardUi.includes('installChecklist'), 'wizard UI should surface install operation checklist');
assert(wizardUi.includes('variantsToText'), 'wizard UI should contain variantsToText helper');
assert(wizardUi.includes('function escapeAttr'), 'wizard UI should define escapeAttr for variable datalist rendering');
assert(wizardUi.includes('function escapeHtml'), 'wizard UI should define escapeHtml for escapeAttr');
assert(
  wizardUi.includes("t('create.default.continue', 'Continue')"),
  'fallback preview should use the localized continuation label'
);
assert(wizardApi && wizardApi.helpers, 'wizard API should expose pure helper functions');
const variantText = wizardApi.helpers.variantsToText(advanced.options[0].variants);
assert(variantText.includes('media_reach >= 5 => Existing media relationships'), 'variantsToText should serialize condition and text');
const roundTripVariants = wizardApi.helpers.variantsFromText(variantText);
assert(roundTripVariants[0].condition === 'media_reach >= 5', 'variantsFromText should recover condition');
assert(
  roundTripVariants[0].text === 'Existing media relationships make the response travel farther.',
  'variantsFromText should recover text'
);
const effectText = wizardApi.helpers.effectsToText(advanced.effectsOnTrigger);
assert(effectText.trim() === 'media_reach += 1', 'effectsToText should serialize trigger effects');
const roundTripEffects = wizardApi.helpers.effectsFromText(effectText);
assert(roundTripEffects[0].variable === 'media_reach' && roundTripEffects[0].op === '+=', 'effectsFromText should parse effect lines');
assert(bundle.scene.includes('title: Sample World Event'), 'scene should include title');
assert(bundle.scene.includes('view-if: year = 2024 and month >= 1 and month <= 3 and sample_world_event_seen = 0'), 'scene should include event window and seen flag');
assert(bundle.scene.includes('Q.sample_world_event_seen = 1;'), 'scene should set seen flag');
assert(bundle.rootSnippet.trim() === 'Q.sample_world_event_seen = 0;', 'root init snippet should match style');
assert(
  bundle.migrationSnippet.trim() === 'if (Q.sample_world_event_seen === undefined) Q.sample_world_event_seen = 0;',
  'migration snippet should match style'
);
assert(bundle.files.some((file) => file.path === 'sample_world_event.scene.dry'), 'bundle should include scene file');
assert(bundle.files.some((file) => file.path === 'sample_world_event.event-draft.json'), 'bundle should include draft JSON');
assert(bundle.files.some((file) => file.path === 'sample_world_event.install-plan.json'), 'bundle should include install plan JSON');
assert(bundle.files.some((file) => file.path === 'sample_world_event.patch-preview.diff'), 'bundle should include patch preview');
assert(bundle.installPlan && bundle.installPlan.operations.some((op) => op.type === 'create_file'), 'bundle should expose a create-file install operation');
assert(bundle.patchPreview.includes('diff --git'), 'bundle should expose a patch preview');
assert(bundle.installChecklist.includes('Safe apply'), 'bundle should expose install operation checklist');
assert(bundle.installChecklist.includes('Manual review'), 'bundle checklist should include manual review operations');

const duplicate = eventDraft.validateDraft(Object.assign({}, sample, {id: 'root'}), index);
assert(diagnosticCodes(duplicate).includes('event_draft.duplicate_scene_id'), 'duplicate scene id should be diagnosed');

const unknownVariable = JSON.parse(JSON.stringify(sample));
unknownVariable.options[0].effects.push({variable: 'not_in_index_var', op: '+=', value: 1});
assert(
  diagnosticCodes(eventDraft.validateDraft(unknownVariable, index)).includes('event_draft.missing_variable'),
  'unknown effect variable should be diagnosed'
);

const bad = JSON.parse(JSON.stringify(sample));
bad.when.monthStart = 12;
bad.when.monthEnd = 1;
bad.when.priority = 4;
bad.when.requires = "party_name = '社民黨'";
bad.options = bad.options.slice(0, 1);
const badCodes = diagnosticCodes(eventDraft.validateDraft(bad, index));
assert(badCodes.includes('event_draft.invalid_month_range'), 'invalid month range should be diagnosed');
assert(badCodes.includes('event_draft.reserved_priority'), 'reserved priority should be diagnosed');
assert(badCodes.includes('event_draft.requires'), 'Chinese string comparison should be diagnosed');
assert(badCodes.includes('event_draft.choice_count'), 'choice count should be diagnosed');

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_event_export_smoke_'));
const cli = spawnSync(
  'node',
  [
    path.join(__dirname, 'generate_event.js'),
    '--draft', SAMPLE_DRAFT,
    '--index', SAMPLE_INDEX,
    '--out-dir', outDir,
    '--summary'
  ],
  {cwd: REPO_ROOT, encoding: 'utf8'}
);
assert(cli.status === 0, 'CLI exporter should succeed: ' + cli.stderr);
assert(fs.existsSync(path.join(outDir, 'sample_world_event.scene.dry')), 'CLI should write scene file');
assert(fs.existsSync(path.join(outDir, 'sample_world_event.event-draft.json')), 'CLI should write draft JSON file');
assert(fs.existsSync(path.join(outDir, 'sample_world_event.install-plan.json')), 'CLI should write install-plan JSON file');
assert(fs.existsSync(path.join(outDir, 'sample_world_event.patch-preview.diff')), 'CLI should write patch preview file');

const protectedCli = spawnSync(
  'node',
  [
    path.join(__dirname, 'generate_event.js'),
    '--draft', SAMPLE_DRAFT,
    '--index', SAMPLE_INDEX,
    '--out-dir', path.join(REPO_ROOT, 'out', 'html', 'event-export')
  ],
  {cwd: REPO_ROOT, encoding: 'utf8'}
);
assert(protectedCli.status !== 0, 'CLI should refuse out/html output');

const protectedOutCli = spawnSync(
  'node',
  [
    path.join(__dirname, 'generate_event.js'),
    '--draft', SAMPLE_DRAFT,
    '--index', SAMPLE_INDEX,
    '--out-dir', path.join(REPO_ROOT, 'out', 'event-export')
  ],
  {cwd: REPO_ROOT, encoding: 'utf8'}
);
assert(protectedOutCli.status !== 0, 'CLI should refuse out/ output');

const noRootIndex = path.join(os.tmpdir(), 'dendry_event_no_root_index_' + process.pid + '.json');
fs.writeFileSync(noRootIndex, JSON.stringify({project: {}, scenes: [], variables: []}), 'utf8');
const noRootCli = spawnSync(
  'node',
  [
    path.join(__dirname, 'generate_event.js'),
    '--draft', SAMPLE_DRAFT,
    '--index', noRootIndex,
    '--out-dir', path.join(os.tmpdir(), 'dendry_event_no_root_out_' + process.pid)
  ],
  {cwd: REPO_ROOT, encoding: 'utf8'}
);
assert(noRootCli.status !== 0, 'CLI should require project.root for path guards');

process.stdout.write(JSON.stringify({
  ok: true,
  sampleScene: 'sample_world_event.scene.dry',
  diagnosticsChecked: true,
  cliOutDir: outDir,
  usedIndex: SAMPLE_INDEX
}, null, 2) + '\n');
