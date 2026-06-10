#!/usr/bin/env node
'use strict';

// 98.5 R3 deferred-row reachability: the large-event render diet collapses
// beyond-limit choice/branch rows into a read-only digest, which used to cap the
// listing at 10 rows and offer no edit entry at all. The off-budget sibling
// viewer/object_editor_deferred_slice.js now renders EVERY deferred row and
// attaches a Source Slice entry built from the row's own source anchor. This
// check pins the contracts the live click listener and the slice model rely on:
// every row listed (no silent cap), entries only where a safe anchor exists, the
// encoded action carrying the row's FULL text (an anchor excerpt would make a
// replace_section apply drop the tail of the section), and none of the field-id /
// canvas-action hooks that would pollute editor state.

const deferredSlice = require('./viewer/object_editor_deferred_slice.js');
const sourceSliceModel = require('./authoring/source_slice_editor_model.js');
const fs = require('fs');
const path = require('path');
const {assert} = require('./check_harness.js');

assert(typeof deferredSlice.renderDeferredBranchList === 'function', 'sibling should export renderDeferredBranchList');
assert(typeof deferredSlice.renderDeferredChoiceList === 'function', 'sibling should export renderDeferredChoiceList');
assert(typeof deferredSlice.branchSliceAction === 'function', 'sibling should export branchSliceAction');
assert(typeof deferredSlice.choiceSliceAction === 'function', 'sibling should export choiceSliceAction');

function decodeFirstAction(html) {
  const match = String(html).match(/data-object-deferred-slice-action="([^"]+)"/);
  if (!match) {
    return null;
  }
  return JSON.parse(match[1]
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&'));
}

// --- branch digest rows -----------------------------------------------------

const FULL_TEXT = 'We met with the leadership.\nThe demands are listed below.';
const sourcedBranch = {
  fieldId: 'section_text_election_cvp_negotiations',
  label: 'Scene step: Cvp Negotiations',
  value: FULL_TEXT,
  operationType: 'replace_section',
  source: {
    path: 'source/scenes/events/election_1928.scene.dry',
    line: 3268,
    startLine: 3268,
    endLine: 3270,
    anchorText: 'We met with the leadership.',
    endAnchorText: 'The demands are listed below.'
  }
};
const anchorlessBranch = {fieldId: 'no_anchor', label: 'No anchor', value: 'text'};

// Every deferred row is listed — a 15-row digest renders 15 articles, not 10+more.
const manyRows = [];
for (let i = 0; i < 15; i++) {
  manyRows.push(Object.assign({}, sourcedBranch, {fieldId: 'row_' + i}));
}
const longList = deferredSlice.renderDeferredBranchList(manyRows, {
  renderRow: (field) => '<article data-row="' + field.fieldId + '"><strong>x</strong></article>'
});
assert((longList.match(/<article/g) || []).length === 15, 'all 15 deferred branch rows should render (the silent 10-row cap is gone)');
assert((longList.match(/data-object-deferred-slice-action=/g) || []).length === 15, 'every sourced deferred branch row should get a Source Slice entry');

// Entries appear only where the row carries a usable source anchor; rows without
// one are still listed, just without a button.
const mixed = deferredSlice.renderDeferredBranchList([sourcedBranch, anchorlessBranch], {
  renderRow: (field) => '<article data-row="' + field.fieldId + '"><strong>x</strong></article>'
});
assert((mixed.match(/<article/g) || []).length === 2, 'anchorless rows should still be listed in the digest');
assert((mixed.match(/data-object-deferred-slice-action=/g) || []).length === 1, 'anchorless rows should not get a Source Slice entry');
assert(mixed.indexOf('</article>') > mixed.indexOf('data-object-deferred-slice-action='), 'the entry button should sit inside the row article');

// The encoded action must reach the slice editor with the row's FULL text, never
// the source anchor excerpt: replace_section writes the edited text over the
// whole line span, so an excerpt seed would silently drop the section tail.
const action = decodeFirstAction(mixed);
assert(action && action.actionKind === 'open_source_slice', 'branch entry should encode an open_source_slice action');
assert(action.source && action.source.path === sourcedBranch.source.path, 'branch entry should carry the row source path');
assert(action.operationTemplate && action.operationTemplate.type === 'replace_section', 'branch entry should keep the row operation type');
assert(action.operationTemplate.search === FULL_TEXT, 'branch entry must seed the slice editor with the FULL row text, not the anchor excerpt');

const sliceModel = sourceSliceModel.buildSourceSliceEditor({}, {editAction: action});
assert(sliceModel.ok === true, 'the slice model should accept a decoded branch entry action');
assert(sliceModel.currentText === FULL_TEXT, 'the slice editor currentText must equal the full row text');
assert(sliceModel.operationType === 'replace_section', 'the slice model should honor the encoded operation type');

const proposal = sourceSliceModel.buildProposal({}, {editAction: action}, {replacementText: FULL_TEXT + ' edited'});
assert(proposal.ok === true && proposal.operations.length === 1, 'a digest entry edit should produce exactly one operation');
assert(proposal.operations[0].type === 'replace_section', 'the digest entry operation should be a replace_section');
assert(proposal.operations[0].safety === 'guarded_apply', 'a normal scene digest entry should stay guarded_apply');

// --- choice digest rows -----------------------------------------------------

// Deferred options anchor target.source to the whole section span (excerpt trap),
// so the entry uses the option's own single-line label field instead.
const option = {
  id: 'coalition_menu__no_majority',
  label: 'There is no clear governing majority.',
  sectionId: 'election_1928.coalition_menu',
  target: {source: {path: 'source/scenes/events/election_1928.scene.dry', line: 2526, endLine: 2532, anchorText: '@no_majority'}},
  fields: [
    {role: 'option_label', fieldId: 'other_label', value: 'Different option label', operationType: 'replace_text',
      source: {path: 'source/scenes/events/election_1928.scene.dry', line: 3689, anchorText: 'Different option label'}},
    {role: 'option_label', fieldId: 'own_label', value: 'There is no clear governing majority.', operationType: 'replace_text',
      source: {path: 'source/scenes/events/election_1928.scene.dry', line: 2527, anchorText: 'There is no clear governing majority.'}}
  ]
};
const choiceHtml = deferredSlice.renderDeferredChoiceList([option, {id: 'bare', label: 'No fields', fields: []}], {
  renderRow: (opt, index) => '<article data-opt="' + opt.id + '"><b>' + index + '</b></article>',
  offset: 28
});
assert((choiceHtml.match(/<article/g) || []).length === 2, 'all deferred choice rows should render');
assert((choiceHtml.match(/data-object-deferred-slice-action=/g) || []).length === 1, 'options without a sourced label field should get no entry');
assert(choiceHtml.includes('<b>28</b>') && choiceHtml.includes('<b>29</b>'), 'choice rows should keep their digest numbering offset');

const choiceAction = decodeFirstAction(choiceHtml);
assert(choiceAction.fieldId === 'own_label', 'the choice entry should pick the label field whose value matches the option label');
assert(choiceAction.operationTemplate.type === 'replace_text', 'the choice entry should be a surgical replace_text on the label line');
assert(choiceAction.operationTemplate.search === option.label, 'the choice entry should carry the label text as its slice content');
assert(choiceAction.source.line === 2527, 'the choice entry should anchor the label line, not the whole section span');

// --- interaction guardrails (same family as find toolbar / inserts) ---------

const allHtml = longList + mixed + choiceHtml;
assert(!allHtml.includes('data-object-canvas-action'), 'digest entries must not borrow the canvas action dispatch');
assert(!/data-editing-field|data-object-canvas-field/.test(allHtml), 'digest entries must not carry field hooks that would pollute state values');

// --- load-order manifest contract -------------------------------------------

// The sibling must load before preview_object_editor.js so the digest renderers
// see the global on first render in the browser.
const indexHtml = fs.readFileSync(path.join(__dirname, 'viewer/index.html'), 'utf8');
const sliceTag = indexHtml.indexOf('object_editor_deferred_slice.js');
const editorTag = indexHtml.indexOf('preview_object_editor.js');
assert(sliceTag !== -1, 'index.html should load object_editor_deferred_slice.js');
assert(sliceTag < editorTag, 'object_editor_deferred_slice.js must load before preview_object_editor.js');

console.log(JSON.stringify({
  ok: true,
  branchEntryFullText: action.operationTemplate.search === FULL_TEXT,
  choiceEntryLabelLine: choiceAction.source.line === 2527,
  capRemoved: (longList.match(/<article/g) || []).length === 15
}, null, 2));
