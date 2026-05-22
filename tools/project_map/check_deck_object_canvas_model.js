#!/usr/bin/env node
'use strict';
const deckDraft = require('./authoring/deck_pool_draft.js');
const canvas = require('./authoring/object_canvas_content_adapters.js');
const previewEditor = require('./viewer/preview_object_editor.js');
const {buildDynamicRepoSemanticFixture} = require('./fixtures/dynamicrepo_semantic_fixture.js');
function fail(message){ process.stderr.write('FAIL: '+message+'\n'); process.exit(1); }
function assert(condition,message){ if(!condition) fail(message); }
const index = buildDynamicRepoSemanticFixture();
const draft = deckDraft.draftForPool(index, 'main.party');
const model = canvas.buildTemplateCanvas(index, 'deck_pool', draft, {values: {}});
assert(model.template === 'deck_pool', 'deck_pool template should build a canvas model');
assert(model.eventBody.title.id === 'deckPool.label', 'deck pool label field id should be stable');
assert(model.eventBody.metaFields.some((field) => field.id === 'deckPool.routeTag.0'), 'deck pool route tag field id should be stable');
assert(model.eventBody.metaFields.find((field) => field.id === 'deckPool.routeTag.0').readOnly, 'deck pool route tag should render as routing evidence instead of a guarded rename field');
assert(model.eventBody.metaFields.some((field) => field.id === 'deckPool.add.memberCardId' && field.inputType === 'select'), 'add member should render as a selectable card candidate field');
assert(!model.eventBody.metaFields.some((field) => /^deckPool\.(addMemberCardId|removeMemberCardId|moveMemberCardId|moveTargetDeckPoolId)$/.test(field.id)), 'legacy deck pool id fields should stay adapter-compatible without appearing in the primary Object Canvas field model');
assert(model.eventBody.options.some((option) => option.fields.some((field) => field.id === 'deckPool.member.shuffle_leadership.membership')), 'member card field ids should be stable');
assert(model.eventBody.options.some((option) => option.fields.some((field) => field.id === 'deckPool.member.shuffle_leadership.remove' && field.inputType === 'checkbox')), 'member rows should expose remove checkboxes');
assert(model.eventBody.options.some((option) => option.fields.some((field) => field.id === 'deckPool.member.shuffle_leadership.moveTargetDeckPoolId' && field.inputType === 'select')), 'member rows should expose move target selectors');
const rendered = previewEditor.render(model);
assert(rendered.includes('data-preview-object-deck-pool="true"'), 'deck_pool template should render with a dedicated deck pool editor frame');
assert(rendered.includes('deckPool.member.shuffle_leadership.moveTargetDeckPoolId'), 'deck pool editor should render row-level move selectors');
const changedLabel = deckDraft.normalizeDraft(Object.assign({}, draft, {label: 'Party Business'}));
const labelPlan = deckDraft.buildExportBundle(changedLabel, index).installPlan;
assert(labelPlan.operations.some((op) => op.role === 'deck_pool.update_label' && op.safety === 'guarded_apply'), 'source-backed label changes should produce guarded deck_pool.update_label operations');
const unsafeLauncherDraft = deckDraft.normalizeDraft(Object.assign({}, draft, {launcherRoutes: [{id: 'launcher_1', label: 'New launcher', originalLabel: 'Old launcher', targetId: draft.deckPoolId, source: {path: 'source/probe.scene.dry', line: 1, anchorText: '- @main.party'}}]}));
const unsafeLauncherOp = deckDraft.buildExportBundle(unsafeLauncherDraft, index).installPlan.operations.find((op) => op.role === 'deck_pool.update_launcher');
assert(unsafeLauncherOp && unsafeLauncherOp.safety === 'manual_review', 'launcher label edits should not guarded-apply when the source anchor does not contain the original label');
const addCandidate = draft.availableMemberCards.find((card) => card.sourceBacked) || draft.availableMemberCards[0];
assert(addCandidate && addCandidate.cardId, 'deck pool draft should expose addable card candidates');
const addValues = {'deckPool.add.memberCardId': addCandidate.cardId};
const addModel = canvas.buildTemplateCanvas(index, 'deck_pool', draft, {values: addValues});
assert(addModel.changeState.draft.addMemberCardId === addCandidate.cardId, 'add membership field should update the draft delta');
assert(addModel.changeState.installPlan.operations.some((op) => op.role === 'deck_pool.add_member'), 'add membership should produce deck_pool.add_member operation');
const manualAdd = addModel.changeState.installPlan.operations.find((op) => op.role === 'deck_pool.add_member');
assert(manualAdd.safety !== 'guarded_apply' || manualAdd.path, 'guarded deck membership edits should only appear with source evidence');
const duplicateAdd = canvas.buildTemplateCanvas(index, 'deck_pool', draft, {values: {'deckPool.add.memberCardId': 'shuffle_leadership'}}).changeState.installPlan.operations.find((op) => op.role === 'deck_pool.add_member');
assert(duplicateAdd && duplicateAdd.safety === 'manual_review', 'duplicate add should become a review/no-op boundary instead of guarded apply');
const moveDraft = deckDraft.normalizeDraft(Object.assign({}, draft, {moveMemberCardId: 'shuffle_leadership', moveTargetDeckPoolId: 'main.govt'}));
const movePlan = deckDraft.buildExportBundle(moveDraft, index).installPlan;
assert(movePlan.operations.some((op) => op.role === 'deck_pool.move_member'), 'move membership should produce deck_pool.move_member operation');
assert(movePlan.operations.every((op) => op.role !== 'deck_pool.move_member' || op.groupId === 'deck_pool:main_party'), 'deck pool membership operations should be grouped by source pool');
assert(movePlan.operations.some((op) => /Move Shuffle Leadership from Party Affairs to Government Affairs/.test(op.reviewSummary || '')), 'move membership should carry a readable review summary');
const removeMember = draft.memberCards.find((card) => card.cardId !== 'shuffle_leadership') || draft.memberCards[0];
const multiValues = {
  'deckPool.add.memberCardId': addCandidate.cardId,
  ['deckPool.member.' + removeMember.cardId + '.remove']: 'true',
  'deckPool.member.shuffle_leadership.moveTargetDeckPoolId': 'main.govt'
};
const multiPlan = canvas.buildTemplateCanvas(index, 'deck_pool', draft, {values: multiValues}).changeState.installPlan;
const membershipOps = multiPlan.operations.filter((op) => /^deck_pool\.(add_member|remove_member|move_member)$/.test(op.role || ''));
assert(membershipOps.length >= 3, 'multiple row-level membership changes should generate grouped operations');
assert(membershipOps.every((op) => op.groupId === 'deck_pool:main_party' && op.reviewSummary), 'membership operations should carry grouped review metadata');
const conflictValues = {
  'deckPool.member.shuffle_leadership.remove': 'true',
  'deckPool.member.shuffle_leadership.moveTargetDeckPoolId': 'main.govt'
};
const conflictChanges = canvas.buildTemplateCanvas(index, 'deck_pool', draft, {values: conflictValues}).changeState.draft.membershipChanges.filter((change) => change.cardId === 'shuffle_leadership');
assert(conflictChanges.length === 1 && conflictChanges[0].action === 'move', 'row-level move should collapse stale remove checkbox state into one membership change');
const partial = deckDraft.normalizeDraft(Object.assign({}, draft, {kind: 'hybrid', status: 'partial', authoringStatus: 'ready', membershipChanges: [{action: 'add', cardId: addCandidate.cardId}]}));
const partialOp = deckDraft.buildExportBundle(partial, index).installPlan.operations.find((op) => op.role === 'deck_pool.add_member');
assert(partialOp && partialOp.safety === 'manual_review', 'hybrid/dynamic pool membership edits should remain manual review');
const mixedCaseCardId = 'Shuffle-Leadership.v2';
const mixedCaseDraft = deckDraft.normalizeDraft(Object.assign({}, draft, {membershipChanges: [{action: 'add', cardId: mixedCaseCardId}]}));
assert(mixedCaseDraft.membershipChanges[0].cardId === mixedCaseCardId, 'deck pool membership changes should preserve exact card ids instead of coercing them to operation-safe ids');
const mixedCaseCanvas = canvas.buildTemplateCanvas(index, 'deck_pool', Object.assign({}, draft, {availableMemberCards: [{cardId: mixedCaseCardId, title: 'Shuffle Leadership v2', sourceBacked: false}]}), {values: {'deckPool.add.memberCardId': mixedCaseCardId}});
assert(mixedCaseCanvas.changeState.draft.addMemberCardId === mixedCaseCardId, 'deck pool add-card select should preserve exact card ids in the draft delta');
process.stdout.write(JSON.stringify({ok:true, fields:model.eventBody.metaFields.length}, null, 2)+'\n');
