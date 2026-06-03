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
const readOnlyLeafField = {conditionalTree: [{condition: 'Q.metInspector >= 1', text: 'A figure waits.', children: []}]};
const readOnlyHtml = previewObjectEditor.renderConditionalAlternatives(readOnlyLeafField, {});
assert(readOnlyHtml.indexOf('data-conditional-leaf-edit') === -1, 'a leaf without stamped field ids must stay read-only (no inline editor)');

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
