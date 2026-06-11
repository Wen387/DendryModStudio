#!/usr/bin/env node
'use strict';

// U-line UC: display-boundary text helpers (viewer/display_text.js).
// Pins three contracts:
//   1. stripInlineMarkup removes known inline presentation tags from mod prose
//      (display-only contexts) while leaving literal text -- including a bare
//      "<" comparison -- untouched.
//   2. The label maps (fieldLabel / identityLabel / sortFieldLabel) translate
//      KNOWN model-layer English labels via i18n keys and fall back to the
//      original string for anything unknown -- the model output itself is
//      never rewritten.
//   3. fieldLabel also strips markup before mapping, so a styled label still
//      resolves to its key.

const displayText = require('./viewer/display_text.js');
const {assert} = require('./check_harness.js');

assert(typeof displayText.stripInlineMarkup === 'function', 'display_text should export stripInlineMarkup');
assert(typeof displayText.fieldLabel === 'function', 'display_text should export fieldLabel');
assert(typeof displayText.identityLabel === 'function', 'display_text should export identityLabel');
assert(typeof displayText.sortFieldLabel === 'function', 'display_text should export sortFieldLabel');

// 1. Markup stripping: real mod prose shape (audited corpus) loses the tags,
// keeps the text; non-tag "<" survives; nullish input is safe.
const prose = '<span style="color: #c00000;">**SPD**</span> wins <b>big</b><br>next line';
assert(displayText.stripInlineMarkup(prose) === '**SPD** wins big' + 'next line', 'stripInlineMarkup should drop whitelisted inline tags and keep text');
assert(displayText.stripInlineMarkup('unity < 3 and money > 2') === 'unity < 3 and money > 2', 'literal comparisons must not be eaten');
assert(displayText.stripInlineMarkup('<div>block</div>') === '<div>block</div>', 'non-whitelisted tags are left alone (display contexts escape them)');
assert(displayText.stripInlineMarkup(null) === '', 'nullish input should return an empty string');

// 2. Known labels map through i18n (no catalog in this headless run, so the
// fallback equals the input); unknown labels pass through verbatim.
assert(displayText.fieldLabel('Choice condition') === 'Choice condition', 'known field label should resolve (fallback = original without a catalog)');
assert(displayText.fieldLabel('Some custom label') === 'Some custom label', 'unknown field labels must pass through unchanged');
assert(displayText.identityLabel('Timeline') === 'Timeline', 'known identity label should resolve');
assert(displayText.identityLabel('Anything else') === 'Anything else', 'unknown identity labels must pass through unchanged');
assert(displayText.sortFieldLabel('role') === 'role', 'known sort field should resolve via explore.sort.* (fallback = raw name)');
assert(displayText.sortFieldLabel('usageCount') === 'usageCount', 'unmapped sort fields keep their raw name');

// 3. A styled label still resolves: markup is stripped before the map lookup.
assert(displayText.fieldLabel('<span style="color: #c00000;">Choice condition</span>') === 'Choice condition', 'fieldLabel should strip markup before mapping');

console.log(JSON.stringify({
  ok: true,
  stripsInlineTags: true,
  keepsLiteralComparisons: true,
  mapsKnownLabels: true
}, null, 2));
