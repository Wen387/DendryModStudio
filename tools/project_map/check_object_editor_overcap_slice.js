#!/usr/bin/env node
'use strict';

// 98.5 R4 over-cap magic reachability: blocks beyond the 2000-char/40-line
// edit bound carry anchors only (no rawText), so the object editor showed them
// read-only with an IDE hint — no in-Studio path. The off-budget sibling
// viewer/object_editor_overcap_slice.js attaches a Source Slice entry that
// loads the CURRENT block text from disk (dendryDesktop.readSourceSlice)
// before opening the editor. This check pins the contracts that keep that
// path safe: entries only on anchored read-only blocks, the action seeded
// with the FULL disk text (never an anchor excerpt — replace_section writes
// the edited text over the whole span), the freshness gate refusing stale
// anchors, the read-back rangeHash riding along as expectedRangeHash so the
// apply fails closed on a changed file, and the bounded read API refusing
// anything outside relative source/**/*.dry spans.

const overcapSlice = require('./viewer/object_editor_overcap_slice.js');
const sourceSliceModel = require('./authoring/source_slice_editor_model.js');
const installPlan = require('./authoring/install_plan.js');
const studioCore = require('./desktop/studio_core.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const {assert} = require('./check_harness.js');

assert(typeof overcapSlice.isOvercapCandidate === 'function', 'sibling should export isOvercapCandidate');
assert(typeof overcapSlice.overcapDescriptor === 'function', 'sibling should export overcapDescriptor');
assert(typeof overcapSlice.freshnessOk === 'function', 'sibling should export freshnessOk');
assert(typeof overcapSlice.buildOvercapAction === 'function', 'sibling should export buildOvercapAction');
assert(typeof overcapSlice.renderOvercapEntry === 'function', 'sibling should export renderOvercapEntry');

// --- fixture block + disk text ----------------------------------------------

const BLOCK_LINES = ['on-arrival: {!'];
for (let i = 0; i < 60; i++) {
  BLOCK_LINES.push('    Q.value_' + i + ' = (Q.value_' + i + ' || 0) + 1;');
}
BLOCK_LINES.push('!}');
const FULL_TEXT = BLOCK_LINES.join('\n');

const overcapBlock = {
  id: 'opaque_js_abc123',
  label: 'on-arrival JS block',
  hook: 'on-arrival',
  editable: false,
  editability: 'ide_escape_hatch',
  rawText: '',
  source: {
    path: 'source/scenes/election_algorithm.scene.dry',
    line: 2,
    startLine: 2,
    endLine: 63,
    anchorText: 'on-arrival: {!',
    endAnchorText: '!}',
    rawAnchorText: 'on-arrival: {!',
    rawEndAnchorText: '!}'
  }
};
const editableBlock = Object.assign({}, overcapBlock, {editable: true, editability: 'guarded_replace_section'});
const anchorlessBlock = Object.assign({}, overcapBlock, {source: {path: 'source/scenes/foo.scene.dry', line: 2}});

// --- entry gating -------------------------------------------------------------

const entryHtml = overcapSlice.renderOvercapEntry(overcapBlock, {targetId: 'election_algorithm'});
assert(entryHtml.includes('data-object-overcap-slice='), 'a read-only anchored block should get a Source Slice entry');
assert(overcapSlice.renderOvercapEntry(editableBlock, {}) === '', 'an editable block needs no over-cap entry');
assert(overcapSlice.renderOvercapEntry(anchorlessBlock, {}) === '', 'a block without a full anchor span must not get an entry');

function decodeDescriptor(html) {
  const match = String(html).match(/data-object-overcap-slice="([^"]+)"/);
  return match ? JSON.parse(match[1]
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')) : null;
}

const descriptor = decodeDescriptor(entryHtml);
assert(descriptor && descriptor.source && descriptor.source.path === overcapBlock.source.path, 'the entry should carry the block source path');
assert(descriptor.source.startLine === 2 && descriptor.source.endLine === 63, 'the entry should carry the block line span');
assert(descriptor.fieldId === 'opaque:opaque_js_abc123', 'the entry should reference the block field id');

// --- the full-text + freshness contract ---------------------------------------

const RANGE_HASH = crypto.createHash('sha256').update(FULL_TEXT, 'utf8').digest('hex');
const freshRead = {ok: true, text: FULL_TEXT, rangeHash: RANGE_HASH, startLine: 2, endLine: 63};

const action = overcapSlice.buildOvercapAction(descriptor, freshRead);
assert(action && action.actionKind === 'open_source_slice', 'a fresh read should produce an open_source_slice action');
assert(action.operationTemplate && action.operationTemplate.type === 'replace_section', 'the action should be a replace_section over the block span');
assert(action.operationTemplate.search === FULL_TEXT, 'the action must seed the slice editor with the FULL disk text, never the anchor excerpt');
assert(action.source.expectedRangeHash === RANGE_HASH, 'the read rangeHash must ride along as expectedRangeHash');

// Stale index ⇒ refuse to open: a drifted first or last line means the anchors
// no longer describe the text the editor would seed.
const drifted = Object.assign({}, freshRead, {text: 'on-display: {!\n' + FULL_TEXT.split('\n').slice(1).join('\n')});
assert(overcapSlice.buildOvercapAction(descriptor, drifted) === null, 'a drifted first line must refuse to open (stale index)');
const driftedEnd = Object.assign({}, freshRead, {text: FULL_TEXT.replace(/!\}$/, '") // !never closed')});
assert(overcapSlice.buildOvercapAction(descriptor, driftedEnd) === null, 'a drifted end line must refuse to open (stale index)');
assert(overcapSlice.buildOvercapAction(descriptor, {ok: false, message: 'nope'}) === null, 'a failed read must refuse to open');
assert(overcapSlice.buildOvercapAction(descriptor, Object.assign({}, freshRead, {text: ''})) === null, 'an empty read must refuse to open');

// --- slice model + proposal --------------------------------------------------

const sliceModel = sourceSliceModel.buildSourceSliceEditor({}, {editAction: action});
assert(sliceModel.ok === true, 'the slice model should accept the over-cap action');
assert(sliceModel.currentText === FULL_TEXT, 'the slice editor currentText must equal the full disk text');
assert(sliceModel.operationType === 'replace_section', 'the slice model should honor replace_section');
assert(sliceModel.installSafety === 'guarded_apply', 'a normal scene block should stay guarded_apply');

const EDITED = FULL_TEXT.replace('{!', '{! /* edited */');
const proposal = sourceSliceModel.buildProposal({}, {editAction: action}, {replacementText: EDITED});
assert(proposal.ok === true && proposal.operations.length === 1, 'an over-cap edit should produce exactly one operation');
assert(proposal.operations[0].type === 'replace_section', 'the operation should be replace_section');
assert(proposal.operations[0].expectedRangeHash === RANGE_HASH, 'expectedRangeHash must be carried into the install operation');

// post_event is a protected router path ⇒ the same entry escalates to advanced.
const peDescriptor = JSON.parse(JSON.stringify(descriptor));
peDescriptor.source.path = 'source/scenes/post_event.scene.dry';
const peAction = overcapSlice.buildOvercapAction(peDescriptor, freshRead);
const peModel = sourceSliceModel.buildSourceSliceEditor({}, {editAction: peAction});
assert(peModel.ok === true, 'the slice model should accept a post_event over-cap action');
assert(peModel.installSafety === 'advanced_apply' && peModel.advancedRequired === true, 'a post_event block must require advanced apply');

// --- bounded disk read API (studio_core.readSourceSlice) ----------------------

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'overcap-slice-'));
try {
  fs.mkdirSync(path.join(fixtureRoot, 'source', 'scenes'), {recursive: true});
  fs.writeFileSync(path.join(fixtureRoot, 'source', 'info.dry'), 'title: Fixture\nauthor: Check\n');
  const sceneRel = 'source/scenes/election_algorithm.scene.dry';
  const sceneText = 'title: Election Algorithm\n' + FULL_TEXT + '\ntail: after the block\n';
  fs.writeFileSync(path.join(fixtureRoot, sceneRel), sceneText);

  const read = studioCore.readSourceSlice({root: fixtureRoot, path: sceneRel, startLine: 2, endLine: 63});
  assert(read.ok === true, 'readSourceSlice should read a valid source span');
  assert(read.text === FULL_TEXT, 'readSourceSlice must return the byte-exact line span');
  assert(read.rangeHash === RANGE_HASH, 'readSourceSlice must hash the returned span');
  assert(read.totalLines === sceneText.split('\n').length, 'readSourceSlice should report the file line count');

  const refusals = [
    [{root: fixtureRoot, path: '../outside.dry', startLine: 1, endLine: 1}, 'a parent-relative path'],
    [{root: fixtureRoot, path: 'source/../source/info.dry', startLine: 1, endLine: 1}, 'a dot-dot segment'],
    [{root: fixtureRoot, path: 'out/html/index.html', startLine: 1, endLine: 1}, 'a non-source path'],
    [{root: fixtureRoot, path: path.join(fixtureRoot, sceneRel), startLine: 1, endLine: 1}, 'an absolute path'],
    [{root: fixtureRoot, path: 'source/scenes/missing.scene.dry', startLine: 1, endLine: 1}, 'a missing file'],
    [{root: fixtureRoot, path: sceneRel, startLine: 0, endLine: 3}, 'a zero start line'],
    [{root: fixtureRoot, path: sceneRel, startLine: 5, endLine: 4}, 'an inverted range'],
    [{root: fixtureRoot, path: sceneRel, startLine: 2, endLine: 99999}, 'a range beyond the file']
  ];
  refusals.forEach(([options, label]) => {
    const refused = studioCore.readSourceSlice(options);
    assert(refused.ok === false, 'readSourceSlice must refuse ' + label);
    assert(!refused.text, 'a refused read must not leak text for ' + label);
  });

  // --- closed loop on the fixture: read → action → proposal → dry-run --------
  const loopAction = overcapSlice.buildOvercapAction(descriptor, read);
  assert(loopAction, 'the fixture read should pass the freshness gate');
  const loopProposal = sourceSliceModel.buildProposal({}, {editAction: loopAction}, {replacementText: EDITED});
  const dry = installPlan.applyInstallPlan(loopProposal.installPlan, {projectRoot: fixtureRoot, dryRun: true});
  assert(dry.ok === true && dry.results[0].status === 'would_apply', 'the over-cap edit should dry-run as would_apply on the fixture');

  // TOCTOU: an INNER line changes after the read (anchors and line count are
  // intact, so only expectedRangeHash can catch it) ⇒ the apply must fail closed.
  fs.writeFileSync(path.join(fixtureRoot, sceneRel), sceneText.replace('Q.value_30', 'Q.value_changed'));
  const staleDry = installPlan.applyInstallPlan(loopProposal.installPlan, {projectRoot: fixtureRoot, dryRun: true});
  assert(staleDry.ok === false && staleDry.results[0].status === 'failed', 'a file changed after the read must fail the hash gate, not silently overwrite');
  assert(staleDry.diagnostics.some((d) => String(d.code || '').includes('section_range_hash_mismatch')), 'the failure should name the range-hash mismatch');
} finally {
  fs.rmSync(fixtureRoot, {recursive: true, force: true});
}

// --- interaction guardrails (same family as the digest entries) ---------------

assert(!entryHtml.includes('data-object-canvas-action'), 'the over-cap entry must not borrow the canvas action dispatch');
assert(!/data-editing-field|data-object-canvas-field/.test(entryHtml), 'the over-cap entry must not carry field hooks that would pollute state values');

// --- load-order manifest contract ---------------------------------------------

const indexHtml = fs.readFileSync(path.join(__dirname, 'viewer/index.html'), 'utf8');
const overcapTag = indexHtml.indexOf('object_editor_overcap_slice.js');
const editorTag = indexHtml.indexOf('preview_object_editor.js');
assert(overcapTag !== -1, 'index.html should load object_editor_overcap_slice.js');
assert(overcapTag < editorTag, 'object_editor_overcap_slice.js must load before preview_object_editor.js');

console.log(JSON.stringify({
  ok: true,
  fullTextSeed: action.operationTemplate.search === FULL_TEXT,
  hashCarried: proposal.operations[0].expectedRangeHash === RANGE_HASH,
  postEventAdvanced: peModel.installSafety === 'advanced_apply'
}, null, 2));
