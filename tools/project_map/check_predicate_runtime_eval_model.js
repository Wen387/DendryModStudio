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
const readOnlyLeafField = {conditionalTree: [{condition: 'Q.metInspector >= 1', text: 'A figure waits.', children: []}]};
const readOnlyHtml = previewObjectEditor.renderConditionalAlternatives(readOnlyLeafField, {});
assert(readOnlyHtml.indexOf('data-conditional-leaf-edit') === -1, 'a leaf without stamped field ids must stay read-only (no inline editor)');

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
