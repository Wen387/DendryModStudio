#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const draftExtract = require('./authoring/draft_extract.js');
const sourceSlice = require('./authoring/source_slice_editor_model.js');
const surfaceDraft = require('./authoring/surface_text_draft.js');
const workflowEntry = require('./authoring/workflow_entry_contract_model.js');

const ROOT = path.resolve(__dirname, '..', '..');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function syntheticIndex() {
  const source = {
    path: 'source/scenes/events/source_patch_event.scene.dry',
    line: 3,
    endLine: 3,
    anchorText: 'title: Source Patch Event'
  };
  return {
    schemaVersion: '0.1',
    project: {name: 'visible source patch fixture', root: ROOT, profileIds: ['generic-dendry']},
    profiles: [{id: 'generic-dendry'}],
    scenes: [
      {
        id: 'source_patch_event',
        title: 'Source Patch Event',
        sourceSpan: source,
        topLevelSpan: source,
        sections: []
      }
    ],
    semantic: {
      events: [{id: 'source_patch_event', title: 'Source Patch Event'}],
      cards: [],
      news: {items: []},
      surfaceText: {items: []},
      textCorpus: {items: []}
    },
    diagnostics: []
  };
}

const index = syntheticIndex();
const extracted = draftExtract.textReplacementDraftFromItem(index, 'events', 'source_patch_event', {
  replacementLabel: 'Renamed Source Patch Event'
});
assert(extracted.ok, 'source-backed visible event text should produce a draft');
assert(extracted.status === 'draft', 'source-backed visible event text should stay in Studio draft flow');
assert(extracted.draft.editability === 'source_patch', 'source-backed visible fallback should use Studio source_patch editability');

const bundle = surfaceDraft.buildExportBundle(extracted.draft, index);
assert(bundle.ok, 'source_patch surface draft should validate');
assert(bundle.installPlan.operations.length === 1, 'source_patch draft should produce one install operation');
assert(bundle.installPlan.operations[0].type === 'replace_text', 'source_patch draft should produce replace_text operation');
assert(bundle.installPlan.operations[0].safety === 'guarded_apply', 'source_patch draft with exact source evidence should use guarded_apply instead of manual review');
assert(bundle.installPlan.operations[0].type !== 'manual_snippet', 'source_patch draft should not become a manual snippet');

const generatedOnly = surfaceDraft.buildExportBundle({
  schemaVersion: '0.1',
  kind: 'surface_text',
  id: 'generated_label_mapping_needed',
  itemId: 'generated_label',
  area: 'runtime_ui',
  originalLabel: 'Budget',
  replacementLabel: 'Treasury',
  editability: 'ide_escape_hatch',
  source: {path: 'out/html/sidebar.js', line: 12},
  reason: 'Generated runtime UI evidence needs source mapping.'
}, index);
assert(generatedOnly.ok, 'generated-only source mapping draft should remain valid guidance');
assert(generatedOnly.installPlan.operations[0].type === 'manual_snippet', 'generated-only source mapping should not pretend to be executable');
assert(!/external editor|IDE escape hatch|Manual IDE steps|will not auto-edit/i.test(generatedOnly.installNotes), 'generated-only install notes should use Studio source-mapping language');

const advancedSlice = sourceSlice.buildSourceSliceEditor(index, {
  id: 'post_event_router_patch',
  label: 'Router condition',
  installSafety: 'advanced_apply',
  source: {
    path: 'source/scenes/post_event.scene.dry',
    line: 44,
    anchorText: '*if Q.ready: source_patch_event'
  }
});
assert(advancedSlice.ok, 'protected source-backed slice should open as a Studio editor');
assert(advancedSlice.playerLimit === false, 'source slice mapping failures should not become player edit limits');
assert(advancedSlice.actionKind === 'open_advanced_source_patch', 'protected source-backed slice should use advanced source patch action');
const advancedProposal = sourceSlice.buildProposal(advancedSlice, {
  replacementText: '*if Q.ready and not Q.seen_source_patch_event: source_patch_event'
});
assert(advancedProposal.ok, 'advanced source slice should generate an executable proposal');
assert(advancedProposal.operations[0].safety === 'advanced_apply', 'advanced source slice proposal should remain advanced_apply');

const entries = workflowEntry.workflowEntries();
assert(entries.some((entry) => entry.actionKind === 'open_source_slice'), 'workflow entries should expose source slice editing');
assert(entries.some((entry) => entry.actionKind === 'open_advanced_source_patch') || entries.some((entry) => entry.featureId === 'source_slice_edit'), 'workflow entries should expose advanced source patch path');
assert(entries.some((entry) => entry.actionKind === 'open_profile_router_rule'), 'workflow entries should expose profile router rule assistant');

const visibleCopyFiles = [
  'tools/project_map/authoring/surface_text_draft.js',
  'tools/project_map/indexer/surface_text.py',
  'tools/project_map/viewer/design_ui.js',
  'tools/project_map/viewer/explore_inspector.js',
  'tools/project_map/viewer/i18n/en.js',
  'tools/project_map/viewer/i18n/zh-Hant.js',
  'tools/project_map/viewer/tutorial_library_ui.js'
];
const forbiddenVisibleCopy = [
  /IDE escape hatch:/i,
  /Creates an IDE guidance/i,
  /This will export IDE guidance/i,
  /Manual IDE steps/i,
  /manual IDE/i,
  /external editor/i,
  /will not auto-edit/i,
  /why Studio will not auto-edit/i,
  /Make IDE change manually/i,
  /manual IDE work/i,
  /IDE 出口/,
  /IDE 指引/,
  /IDE 審查/,
  /手動完成 IDE/,
  /IDE 人工作業/
];
visibleCopyFiles.forEach((relativePath) => {
  const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  forbiddenVisibleCopy.forEach((pattern) => {
    assert(!pattern.test(content), relativePath + ' should not expose old fallback copy: ' + pattern);
  });
});

process.stdout.write(JSON.stringify({
  ok: true,
  sourcePatchSafety: bundle.installPlan.operations[0].safety,
  generatedFallback: generatedOnly.installPlan.operations[0].safety,
  sourceSliceAction: advancedSlice.actionKind
}, null, 2) + '\n');
