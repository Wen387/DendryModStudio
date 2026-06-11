#!/usr/bin/env node
'use strict';

// Gap #6 findability: the object editor modal (preview_object_editor renderModal)
// gets a pane-level find toolbar for long event fields panes -- filter + collapse-all
// / expand-all. The toolbar markup and behaviour live off-budget in
// viewer/object_editor_find.js. This check pins the contract: a large event renders
// the toolbar with the expected hooks (a catalog of data-attributes the live
// listeners depend on) and a small event renders nothing (no toolbar noise).

const findUi = require('./viewer/object_editor_find.js');
const {fail, assert} = require('./check_harness.js');

assert(typeof findUi.renderFindToolbar === 'function', 'object_editor_find should export renderFindToolbar');
assert(Number.isInteger(findUi.FIND_THRESHOLD) && findUi.FIND_THRESHOLD > 0, 'object_editor_find should export a positive FIND_THRESHOLD');

function bodyWithUnits(count) {
  const sections = [];
  for (let i = 0; i < count; i += 1) {
    sections.push({id: 'section_' + i, value: 'Paragraph ' + i});
  }
  return {sections: sections, options: [], branchSections: [], assets: [], opaqueJsBlocks: []};
}

// Small event: below the threshold -> no toolbar (would be noise on a short pane).
const smallHtml = findUi.renderFindToolbar(bodyWithUnits(findUi.FIND_THRESHOLD - 1));
assert(smallHtml === '', 'small event below FIND_THRESHOLD should render no find toolbar');

// Large event: render the toolbar with every hook the live listeners rely on.
const largeHtml = findUi.renderFindToolbar(bodyWithUnits(findUi.FIND_THRESHOLD));
assert(largeHtml.includes('data-object-editor-find="true"'), 'large event should render the find toolbar container');
assert(/type="search"[^>]*data-object-editor-find-input="true"|data-object-editor-find-input="true"[^>]*type="search"/.test(largeHtml) || (largeHtml.includes('data-object-editor-find-input="true"') && largeHtml.includes('type="search"')), 'find toolbar should expose a search filter input');
assert(largeHtml.includes('data-object-editor-find-collapse="true"'), 'find toolbar should expose a collapse-all control');
assert(largeHtml.includes('data-object-editor-find-expand="true"'), 'find toolbar should expose an expand-all control');
assert(largeHtml.includes('data-object-editor-find-count="true"'), 'find toolbar should expose a live count region');

// Guard the two interaction risks at the markup level: the filter input must not
// look like an editable field (no field id / role attributes that the canvas field
// delegation would treat as a value edit), and the buttons must not borrow the
// canvas action dispatch (own data hooks only, so a click cannot mutate the model).
assert(!largeHtml.includes('data-object-canvas-action'), 'find toolbar must not use the canvas action dispatch');
assert(!/data-preview-object-field|data-editing-field|data-existing-asset-field/.test(largeHtml), 'find toolbar must not carry field-id hooks that would pollute state values');

// Other event shapes also reach the threshold via options / branches / assets / magic.
const mixed = {sections: [{id: 's0', value: 'p'}], options: new Array(6).fill(0).map((_, i) => ({id: 'o' + i})), branchSections: new Array(4).fill(0).map((_, i) => ({id: 'b' + i})), assets: [{id: 'a0'}], opaqueJsBlocks: [{id: 'm0'}]};
assert(findUi.renderFindToolbar(mixed).includes('data-object-editor-find="true"'), 'mixed large event (options+branches+assets+magic) should also render the toolbar');

console.log(JSON.stringify({
  ok: true,
  threshold: findUi.FIND_THRESHOLD,
  smallRendersToolbar: smallHtml !== '',
  largeRendersToolbar: largeHtml.includes('data-object-editor-find="true"')
}, null, 2));
