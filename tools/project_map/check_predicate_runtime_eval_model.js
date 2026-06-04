#!/usr/bin/env node
'use strict';

// Verifies the browser/Node predicate evaluator (predicate_runtime_eval.js)
// against ASTs produced by predicate_condition_model.summarizePredicate. The
// evaluator semantics intentionally mirror route_runtime_trial_model.js so the
// editor what-if simulator and the route collision sampler agree; the cases
// below pin every AST node type and comparison operator with hand-computed
// expectations.

const predicateModel = require('./authoring/predicate_condition_model.js');
const evalModel = require('./authoring/predicate_runtime_eval.js');
const {assert} = require('./check_harness.js');

function holds(raw, state) {
  const summary = predicateModel.summarizePredicate(raw);
  return evalModel.evaluatePredicateSummary(summary, state);
}

// Bare identifier truthiness (missing variable defaults to 0 / falsey).
assert(holds('Q.a', {a: 1}) === true, 'truthy identifier should hold when set');
assert(holds('Q.a', {a: 0}) === false, 'identifier should fail when zero');
assert(holds('Q.a', {}) === false, 'missing identifier should default to 0 and fail');

// Comparison operators.
assert(holds('Q.a >= 1', {a: 1}) === true, '>= boundary should hold');
assert(holds('Q.a >= 2', {a: 1}) === false, '>= above value should fail');
assert(holds('Q.a <= 1', {a: 1}) === true, '<= boundary should hold');
assert(holds('Q.a > 0', {a: 1}) === true, '> should hold above threshold');
assert(holds('Q.a < 1', {a: 0}) === true, '< should hold below threshold');
assert(holds('Q.a = 3', {a: 3}) === true, '= equality should hold');
assert(holds('Q.a != 3', {a: 2}) === true, '!= inequality should hold');

// Logical composition: and / or / not.
assert(holds('Q.a >= 1 and Q.b >= 1', {a: 1, b: 1}) === true, 'and requires both sides');
assert(holds('Q.a >= 1 and Q.b >= 1', {a: 1, b: 0}) === false, 'and fails when one side fails');
assert(holds('Q.a >= 1 or Q.b >= 1', {a: 0, b: 1}) === true, 'or holds when one side holds');
assert(holds('not Q.a', {a: 0}) === true, 'not of falsey should hold');
assert(holds('Q.a >= 1 and not Q.b', {a: 1, b: 0}) === true, 'and/not composition should hold');
assert(holds('Q.a >= 1 and not Q.b', {a: 1, b: 1}) === false, 'and/not composition should fail when negated side is truthy');

// Arithmetic inside a comparison.
assert(holds('Q.a + Q.b > 2', {a: 2, b: 1}) === true, 'arithmetic sum comparison should hold');
assert(holds('Q.a + Q.b > 2', {a: 1, b: 1}) === false, 'arithmetic sum comparison should fail at boundary');

// String comparison against a quoted literal.
assert(holds('Q.party != "CVP"', {party: 'SPD'}) === true, 'string inequality should hold for differing values');
assert(holds('Q.party != "CVP"', {party: 'CVP'}) === false, 'string inequality should fail for matching values');

// Empty predicate is treated as always-visible.
assert(evalModel.evaluatePredicateSummary(predicateModel.summarizePredicate(''), {}) === true, 'empty predicate should always hold');

// normalizeState tolerates Q.-prefixed state keys.
assert(holds('Q.a >= 1', {'Q.a': 1}) === true, 'evaluator should normalize Q.-prefixed state keys');
const normalized = evalModel.normalizeState({'Q.metInspector': 2, trust: -1});
assert(normalized.metInspector === 2 && normalized.trust === -1, 'normalizeState should strip Q. prefix and keep bare keys');

// Direct evaluateAst on a parsed AST.
const summary = predicateModel.summarizePredicate('Q.metInspector >= 1 and not Q.cold');
assert(summary.status === 'parsed' && summary.ast, 'representative predicate should parse to an AST');
assert(evalModel.evaluateAst(summary.ast, {metInspector: 1, cold: 0}) === true, 'evaluateAst should hold for satisfying state');
assert(evalModel.evaluateAst(summary.ast, {metInspector: 1, cold: 1}) === false, 'evaluateAst should fail when negated dependency is set');

// What-if render contract: with both predicate globals present (set by the
// requires above), the conditional-layers panel renders a state strip + per
// branch AST data-attrs + state badges. This pins the attribute names the live
// wiring in object_authoring_canvas_ui.js depends on.
const previewObjectEditor = require('./viewer/preview_object_editor.js');
const whatIfField = {
  conditionalTree: [
    {
      condition: 'Q.metInspector >= 1',
      text: 'A figure waits.',
      children: [
        {condition: 'Q.cold', text: 'Her glance is cold.', children: []}
      ]
    }
  ]
};
const whatIfHtml = previewObjectEditor.renderConditionalAlternatives(whatIfField, {});
assert(whatIfHtml.indexOf('data-conditional-whatif-scope="true"') !== -1, 'conditional panel should mark a what-if scope when predicate models are available');
assert(whatIfHtml.indexOf('data-conditional-whatif-var="metInspector"') !== -1, 'what-if strip should expose an input for each referenced quality (metInspector)');
assert(whatIfHtml.indexOf('data-conditional-whatif-var="cold"') !== -1, 'what-if strip should expose an input for nested-branch qualities (cold)');
assert(whatIfHtml.indexOf('data-conditional-branch-ast=') !== -1, 'each evaluable branch should carry a serialized predicate AST for client-side evaluation');
assert(whatIfHtml.indexOf('data-conditional-branch-state="hidden"') !== -1, 'branches should evaluate to hidden under the default all-zero what-if state');

const plainField = {conditionalTree: [{condition: 'Q.metInspector >= 1', text: 'A figure waits.', children: []}]};
const noModelHtml = previewObjectEditorWithoutModels(plainField);
assert(noModelHtml.indexOf('data-conditional-whatif-scope') === -1, 'without predicate globals the panel must degrade to the Phase-1 tree (no what-if)');
assert(noModelHtml.indexOf('preview-object-conditional-branch') !== -1, 'Phase-1 tree should still render its branches without the simulator');

// Inline leaf editor render contract (P3a Pillar D): an editable leaf that the
// edit model stamped with field ids renders source-backed inputs prefilled with
// the verbatim text/condition; a non-editable leaf stays read-only.
const editableLeafField = {
  conditionalTree: [
    {
      condition: 'Q.metInspector >= 1',
      text: 'A figure waits.',
      editable: true,
      rawText: 'A figure waits.',
      rawCondition: 'Q.metInspector >= 1',
      textFieldId: 'cond_leaf_text_demo_8_0',
      conditionFieldId: 'cond_leaf_condition_demo_8_0',
      children: []
    }
  ]
};
const editableHtml = previewObjectEditor.renderConditionalAlternatives(editableLeafField, {});
assert(editableHtml.indexOf('data-conditional-leaf-edit="true"') !== -1, 'an editable leaf should render an inline branch editor');
assert(editableHtml.indexOf('data-object-canvas-field="cond_leaf_text_demo_8_0"') !== -1, 'the branch text input must bind to the stamped text field id for collectValues');
assert(editableHtml.indexOf('data-object-canvas-field="cond_leaf_condition_demo_8_0"') !== -1, 'the branch condition input must bind to the stamped condition field id');
assert(editableHtml.indexOf('data-object-canvas-original="A figure waits."') !== -1, 'the text input must carry the verbatim original so unchanged values are not collected as edits');
// Inline validation feedback slot (P3b #5): each editable input renders a live
// note region the canvas UI fills when a value would break the grammar.
assert(editableHtml.indexOf('data-conditional-leaf-note="text"') !== -1, 'the editable text field must render an inline validation note slot');
assert(editableHtml.indexOf('data-conditional-leaf-note="condition"') !== -1, 'the editable condition field must render an inline validation note slot');
assert(editableHtml.indexOf('aria-live="polite"') !== -1, 'the validation note must be an aria-live region so feedback is announced');
// Editability discoverability affordance (UX #1): the edit toggle reads as an
// actionable chip, the editable branch is marked for the accent rail, and the
// block summary announces how many branches are editable up front.
assert(editableHtml.indexOf('preview-object-conditional-edit-toggle') !== -1, 'the edit toggle must use the actionable affordance class so editing is discoverable');
assert(editableHtml.indexOf('data-conditional-editable="true"') !== -1, 'an editable branch must be marked so the accent rail signals it carries an editor');
assert(editableHtml.indexOf('data-conditional-editable-count="1"') !== -1, 'the block summary must count the single editable branch in this field');
assert(/preview-object-conditional-editable-count/.test(editableHtml), 'the editable-branch count chip must render in the conditional layer summary');
const readOnlyLeafField = {conditionalTree: [{condition: 'Q.metInspector >= 1', text: 'A figure waits.', children: []}]};
const readOnlyHtml = previewObjectEditor.renderConditionalAlternatives(readOnlyLeafField, {});
assert(readOnlyHtml.indexOf('data-conditional-leaf-edit') === -1, 'a leaf without stamped field ids must stay read-only (no inline editor)');
assert(readOnlyHtml.indexOf('data-conditional-editable="true"') === -1, 'a read-only leaf must not be marked editable');
assert(readOnlyHtml.indexOf('data-conditional-editable-count') === -1, 'a read-only layer must not show an editable-branch count');

// Read-only ladder mode (preview pane): the same editable leaf renders the
// condition -> text ladder for READING only. No inline leaf editors, no what-if
// simulator, no filter toolbar — so the editor pane stays the single owner of
// the leaf field inputs and the two panes never duplicate a collectable id.
const readOnlyLadderHtml = previewObjectEditor.renderConditionalAlternatives(editableLeafField, {readOnly: true});
assert(readOnlyLadderHtml.indexOf('preview-object-conditional-branch') !== -1, 'the read-only ladder must still render its branch rows so the breakdown is visible');
assert(readOnlyLadderHtml.indexOf('is-readonly') !== -1, 'the read-only ladder must mark itself is-readonly for styling');
assert(readOnlyLadderHtml.indexOf('data-conditional-leaf-edit') === -1, 'the read-only ladder must NOT render inline leaf editors (no duplicate inputs across panes)');
assert(readOnlyLadderHtml.indexOf('data-object-canvas-field="cond_leaf_text_demo_8_0"') === -1, 'the read-only ladder must NOT bind collectable leaf field inputs');
assert(readOnlyLadderHtml.indexOf('data-conditional-whatif') === -1, 'the read-only ladder must NOT render the what-if simulator strip');
assert(readOnlyLadderHtml.indexOf('data-conditional-filter') === -1, 'the read-only ladder must NOT render the density filter toolbar');

// Density governance (UX #2): a dense conditional layer renders a filter toolbar
// (search input + live count) so authors can narrow a 30+ branch list; a small
// layer stays toolbar-free; and no branch is silently truncated.
const denseTree = [];
for (let i = 0; i < 11; i += 1) {
  denseTree.push({condition: 'Q.flag' + i + ' >= 1', text: 'Branch ' + i + ' prose.', children: []});
}
const denseHtml = previewObjectEditor.renderConditionalAlternatives({conditionalTree: denseTree}, {});
assert(denseHtml.indexOf('data-conditional-filter="true"') !== -1, 'a dense conditional layer (>8 branches) must render the density filter toolbar');
assert(denseHtml.indexOf('data-conditional-filter-input="true"') !== -1, 'the filter toolbar must expose a search input to narrow branches');
assert(denseHtml.indexOf('data-conditional-filter-count="true"') !== -1, 'the filter toolbar must expose a live shown/total count');
assert(denseHtml.indexOf('Showing 11 of 11') !== -1, 'the filter count must start by announcing every branch is shown');
assert((denseHtml.match(/preview-object-conditional-branch"/g) || []).length >= 11, 'every dense-layer branch must render (no silent truncation under the raised cap)');
// What-if dense layer also offers the "only branches that show" toggle.
const denseWhatIfHtml = previewObjectEditor.renderConditionalAlternatives({conditionalTree: denseTree.map((n) => Object.assign({}, n, {condition: 'Q.metInspector >= 1'}))}, {});
assert(denseWhatIfHtml.indexOf('data-conditional-filter-shows="true"') !== -1, 'a dense what-if layer must offer a "only branches that show" filter toggle');
const sparseHtml = previewObjectEditor.renderConditionalAlternatives({conditionalTree: [{condition: 'Q.a >= 1', text: 'Only one.', children: []}]}, {});
assert(sparseHtml.indexOf('data-conditional-filter') === -1, 'a short conditional layer must not render the filter toolbar');

// Raw-syntax friendliness (UX #3): an editable condition offers the layer's
// variables as one-click insert chips so authors do not have to recall exact
// quality names; a read-only layer exposes no insert chips.
assert(editableHtml.indexOf('data-conditional-var-insert="true"') !== -1, 'an editable condition must offer a variable-insert chip row');
assert(editableHtml.indexOf('data-conditional-var-token="metInspector"') !== -1, 'the insert chips must surface the layer variable referenced by the condition');
assert(readOnlyHtml.indexOf('data-conditional-var-insert') === -1, 'a read-only conditional layer must not render variable-insert chips');

// What-if live refresh contract (P3b #2): editing a branch condition must re-bake
// the predicate AST so the shows/hidden badge tracks the NEW condition rather than
// the one baked at render. We pin the two halves the live wiring composes: (a)
// re-parsing an edited condition yields a fresh evaluable AST that flips with the
// what-if state, and (b) an empty or unparseable condition yields no AST, which is
// the honest "unknown" badge path (missing variables still evaluate as 0).
const rebakedSummary = predicateModel.summarizePredicate('Q.metInspector >= 1');
assert(rebakedSummary.ast && evalModel.evaluateAst(rebakedSummary.ast, {metInspector: 1}) === true,
  'an edited condition should re-parse to an AST that re-evaluates true under a satisfying what-if state');
assert(evalModel.evaluateAst(rebakedSummary.ast, {metInspector: 0}) === false,
  'the re-baked AST must flip to hidden once the what-if state no longer satisfies it');
assert(!predicateModel.summarizePredicate('').ast,
  'an empty edited condition must yield no AST so the live wiring degrades the badge to unknown');
assert(!predicateModel.summarizePredicate('Q.a >=').ast,
  'an unparseable edited condition must yield no AST rather than a stale verdict');

// Live wiring drift guard: the condition-edit handler in object_authoring_canvas_ui.js
// must target the leaf condition input, re-bake through the shared predicate model,
// rewrite/clear data-conditional-branch-ast, re-run the scope evaluator, and degrade
// an unparseable condition to the opaque/unknown badge.
const canvasUiSource = require('fs').readFileSync(require('path').join(__dirname, 'viewer', 'object_authoring_canvas_ui.js'), 'utf8');
assert(canvasUiSource.indexOf('data-conditional-leaf-input="condition"') !== -1,
  'the canvas UI must listen for condition-leaf edits to refresh badges');
assert(/rebakeBranchConditionAst/.test(canvasUiSource) && /ProjectMapPredicateConditionModel/.test(canvasUiSource) && /summarizePredicate/.test(canvasUiSource),
  'condition edits must re-bake the branch AST through the shared predicate model summarizePredicate');
assert(/conditionalBranchAst\s*=\s*JSON\.stringify/.test(canvasUiSource) && /delete branch\.dataset\.conditionalBranchAst/.test(canvasUiSource),
  'a valid re-baked condition must rewrite data-conditional-branch-ast; an invalid one must clear it');
assert(/setConditionalBranchState\(branch,\s*null\)/.test(canvasUiSource) && /active === null \? 'opaque'/.test(canvasUiSource),
  'an unparseable edited condition must degrade the branch badge to the opaque/unknown state');
assert(/handleConditionalConditionEdit\([^)]*\)[\s\S]{0,900}applyConditionalWhatIf\(scope\)/.test(canvasUiSource),
  'after re-baking, the condition-edit handler must re-run applyConditionalWhatIf over the what-if scope');

// Density filter drift guard (UX #2): the filter handler must narrow top-level
// branches by text + (when active) the live what-if shows state, listen for
// change so the checkbox applies, and re-run an active shows-only filter when
// the what-if state is recomputed so the visible set tracks new verdicts.
assert(/handleConditionalFilterInput/.test(canvasUiSource) && /function applyConditionalFilter/.test(canvasUiSource),
  'the canvas UI must wire a conditional-filter handler and applyConditionalFilter');
assert(/data-conditional-filter-input/.test(canvasUiSource) && /is-filtered-out/.test(canvasUiSource),
  'the filter handler must read the search input and toggle the is-filtered-out branch class');
assert(/addEventListener\('change', handleConditionalFilterInput\)/.test(canvasUiSource),
  'the filter handler must also listen for change so the shows-only checkbox applies');
assert(/conditionalBranchState[\s\S]{0,80}!==\s*'active'/.test(canvasUiSource),
  'the shows-only filter must hide branches whose live state is not active');
assert(/applyConditionalWhatIf[\s\S]{0,600}data-conditional-filter[\s\S]{0,200}applyConditionalFilter/.test(canvasUiSource),
  'recomputing the what-if state must re-run an active shows-only filter');

// Variable-insert drift guard (UX #3): clicking an insert chip must place the
// token at the condition input caret and dispatch 'input' so the existing leaf
// validation + what-if re-bake fire, keeping the guarded-splice contract intact.
assert(/data-conditional-var-token/.test(canvasUiSource) && /handleConditionalVarInsert/.test(canvasUiSource),
  'the canvas UI must wire a variable-insert handler for condition chips');
assert(/handleConditionalVarInsert[\s\S]{0,900}data-conditional-leaf-input="condition"[\s\S]{0,800}setSelectionRange/.test(canvasUiSource),
  'the insert handler must target the condition input and place the caret after the inserted token');
assert(/dispatchEvent\(new InputCtor\('input'/.test(canvasUiSource),
  'the insert handler must dispatch an input event so validation + what-if re-bake re-run');

// Inline validation drift guard (P3b #5): the leaf-validation handler must reuse
// the shared describeInlineLeafValue gate, target the rendered note slot, and
// toggle the invalid affordance so the UI and the apply-time gate never disagree.
assert(/handleConditionalLeafValidation/.test(canvasUiSource) && /describeInlineLeafValue/.test(canvasUiSource),
  'the canvas UI must validate leaf edits through the shared describeInlineLeafValue gate');
assert(/data-conditional-leaf-note/.test(canvasUiSource) && /is-leaf-invalid/.test(canvasUiSource),
  'leaf validation must drive the rendered note slot and an invalid affordance class');
assert(/addEventListener\('input', handleConditionalLeafValidation\)/.test(canvasUiSource),
  'leaf validation must run live on input');

function previewObjectEditorWithoutModels(field) {
  const savedModel = global.ProjectMapPredicateConditionModel;
  const savedEval = global.ProjectMapPredicateRuntimeEval;
  delete global.ProjectMapPredicateConditionModel;
  delete global.ProjectMapPredicateRuntimeEval;
  try {
    return previewObjectEditor.renderConditionalAlternatives(field, {});
  } finally {
    global.ProjectMapPredicateConditionModel = savedModel;
    global.ProjectMapPredicateRuntimeEval = savedEval;
  }
}

process.stdout.write(JSON.stringify({ok: true, checked: ['predicate_runtime_eval']}) + '\n');
