#!/usr/bin/env node
'use strict';

// Gap #2 qdisplay insert: prose fields in the object editor modal
// (preview_object_editor renderInlineField) get a one-click [+ quality +] inserter.
// The markup + caret-splice behaviour live off-budget in
// viewer/object_editor_inserts.js, which also now owns the conditional var-insert
// chips moved out of preview_object_editor to fund this feature. This check pins
// both contracts: prose roles render the inserter with the hooks the live click
// listener relies on (and none of the field-id / canvas-action hooks that would
// pollute state), non-prose roles render nothing, and the moved conditional
// renderer is unchanged.

const inserts = require('./viewer/object_editor_inserts.js');
const {assert} = require('./check_harness.js');

assert(typeof inserts.renderQdisplayInsert === 'function', 'object_editor_inserts should export renderQdisplayInsert');
assert(typeof inserts.setEventContext === 'function', 'object_editor_inserts should export setEventContext');
assert(typeof inserts.renderConditionalVarInserts === 'function', 'object_editor_inserts should export renderConditionalVarInserts (moved from preview_object_editor)');

// Contextual palette = the event's referenced quality names; duplicates collapse.
inserts.setEventContext({variables: [{name: 'money'}, {name: 'unity'}, {name: 'money'}, {name: ''}, null]});

// A prose field renders the inserter with each contextual quality as a [+ name +]
// chip, plus an always-present skeleton button for names not in the palette.
const prose = inserts.renderQdisplayInsert({id: 'scene.body.0'}, {role: 'body', fieldId: 'scene.body.0'});
assert(prose.includes('data-object-qdisplay-insert="true"'), 'prose field should render the qdisplay inserter container');
assert(prose.includes('data-object-qdisplay-token="money"'), 'inserter should expose a one-click token per contextual quality');
assert(prose.includes('[+ money +]'), 'token chip should preview the [+ name +] it inserts');
assert(prose.includes('data-object-qdisplay-skeleton="true"'), 'inserter should expose an empty [+  +] skeleton button');
assert(prose.includes('data-object-qdisplay-field="scene.body.0"'), 'inserter buttons should carry the target field id');
assert((prose.match(/data-object-qdisplay-token="money"/g) || []).length === 1, 'duplicate quality names should collapse in the palette');

// Same two interaction guards as the find toolbar (#6): the inserter must not look
// like an editable field (no field-id hooks the canvas delegation treats as a value
// edit) and its buttons must not borrow the canvas action dispatch.
assert(!prose.includes('data-object-canvas-action'), 'qdisplay inserter must not use the canvas action dispatch');
assert(!/data-editing-field|data-object-canvas-field/.test(prose), 'qdisplay inserter must not carry field hooks that would pollute state values');

// Non-prose roles render nothing -- an inline display is meaningless in logic /
// effect / condition / route / asset fields.
['logic', 'effect', 'condition', 'route', 'asset', 'field'].forEach((role) => {
  assert(inserts.renderQdisplayInsert({id: 'x'}, {role: role, fieldId: 'x'}) === '', 'non-prose role "' + role + '" should render no qdisplay inserter');
});

// With no contextual qualities the skeleton still renders so an author can always
// drop an empty [+  +] and type the name.
inserts.setEventContext({variables: []});
const empty = inserts.renderQdisplayInsert({id: 'scene.body.1'}, {role: 'description', fieldId: 'scene.body.1'});
assert(empty.includes('data-object-qdisplay-skeleton="true"'), 'inserter should render the skeleton even with no contextual qualities');
assert(!empty.includes('data-object-qdisplay-token='), 'inserter should render no token chips when there are no contextual qualities');

// Regression: the conditional var-insert renderer moved here verbatim still emits
// the data-conditional-var-token buttons the canvas_ui handler drives.
const cond = inserts.renderConditionalVarInserts(['alpha', 'beta']);
assert(cond.includes('data-conditional-var-insert="true"'), 'moved renderConditionalVarInserts should still render its container');
assert(cond.includes('data-conditional-var-token="alpha"') && cond.includes('data-conditional-var-token="beta"'), 'moved renderConditionalVarInserts should still emit conditional var tokens');
assert(inserts.renderConditionalVarInserts([]) === '', 'renderConditionalVarInserts with no variables should render nothing');

console.log(JSON.stringify({
  ok: true,
  proseRoles: Object.keys(inserts.PROSE_ROLES),
  rendersTokens: prose.includes('data-object-qdisplay-token='),
  rendersSkeleton: prose.includes('data-object-qdisplay-skeleton="true"')
}, null, 2));
