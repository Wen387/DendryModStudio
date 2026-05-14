#!/usr/bin/env node
'use strict';

const coverage = require('./authoring/visible_object_coverage_model.js');
const semanticLogic = require('./authoring/semantic_logic_editor_model.js');

function fail(message, details) {
  process.stderr.write(JSON.stringify(Object.assign({ok: false, message}, details || {}), null, 2) + '\n');
  process.exit(1);
}

function assert(condition, message, details) {
  if (!condition) {
    fail(message, details);
  }
}

function src(path, line, anchorText) {
  return {path, line, startLine: line, endLine: line, anchorText, endAnchorText: anchorText};
}

const guardedPath = 'source/scenes/events/effect_guarded.scene.dry';
const protectedPath = 'source/scenes/post_event_news.scene.dry';
const guardedLine = 'Q.public_order += 1';
const sharedLine = 'Q.dynamic_pressure += 1; Q.public_order += 1;';
const index = {
  project: {name: 'Effect Clause Editor Fixture', root: '/tmp/effect-editor', profileIds: ['generic-dendry']},
  scenes: [{
    id: 'effect_guarded',
    title: 'Effect Guarded',
    path: guardedPath,
    type: 'event',
    sourceSpan: {path: guardedPath, startLine: 1, endLine: 50},
    effects: [{
      variable: 'public_order',
      op: '+=',
      value: '1',
      expression: guardedLine,
      displayExpression: guardedLine,
      sourceExpression: guardedLine,
      source: src(guardedPath, 18, guardedLine)
    }]
  }, {
    id: 'effect_advanced',
    title: 'Effect Advanced',
    path: protectedPath,
    type: 'event',
    sourceSpan: {path: protectedPath, startLine: 100, endLine: 150},
    effects: [{
      variable: 'dynamic_pressure',
      op: '+=',
      value: '1',
      expression: 'Q.dynamic_pressure += 1',
      displayExpression: 'Q.dynamic_pressure += 1',
      sourceExpression: 'Q.dynamic_pressure += 1',
      source: src(protectedPath, 130, sharedLine)
    }]
  }],
  variables: [],
  semantic: {
    events: [
      {id: 'effect_guarded', title: 'Effect Guarded', path: guardedPath},
      {id: 'effect_advanced', title: 'Effect Advanced', path: protectedPath}
    ],
    cards: [],
    news: {items: [], eventPopups: []},
    textCorpus: {
      items: [
        {id: 'guarded_script', text: guardedLine, role: 'script', owner: {kind: 'scene', sceneId: 'effect_guarded', sectionId: 'start'}, source: src(guardedPath, 18, guardedLine)},
        {id: 'advanced_script', text: sharedLine, role: 'script', owner: {kind: 'scene', sceneId: 'effect_advanced', sectionId: 'start'}, source: src(protectedPath, 130, sharedLine)}
      ]
    },
    parserEvidence: {
      schemaVersion: '0.2',
      kind: 'parser_semantic_evidence',
      core: {
        routeOrderGroups: [],
        dynamicKeyEvidence: [{
          id: 'dynamic_q_pressure',
          sceneId: 'effect_advanced',
          expression: "scope + '_pressure'",
          accessKind: 'write',
          classification: 'dynamic_concatenation',
          safeExpansion: false,
          source: src(protectedPath, 130, sharedLine)
        }],
        effectClauses: [
          {id: 'effect_guarded_clause', sceneId: 'effect_guarded', ownerId: 'effect_guarded', variable: 'public_order', op: '+=', value: '1', sourceExpression: guardedLine, lineEffectCount: 1, tokenUniqueOnLine: true, source: src(guardedPath, 18, guardedLine)},
          {id: 'effect_advanced_clause', sceneId: 'effect_advanced', ownerId: 'effect_advanced', variable: 'dynamic_pressure', op: '+=', value: '1', sourceExpression: 'Q.dynamic_pressure += 1', lineEffectCount: 2, tokenUniqueOnLine: true, source: src(protectedPath, 130, sharedLine)}
        ]
      }
    }
  }
};

function rowWhere(rows, predicate, message) {
  const row = rows.find(predicate);
  assert(row, message, rows.map((item) => ({id: item.id, role: item.role, safety: item.installSafety, semantic: item.editAction && item.editAction.semanticEditor})));
  return row;
}

function semanticEdit(row, replacementText) {
  const model = semanticLogic.buildSemanticLogicEditor(index, row);
  assert(model.ok, 'effect semantic action should open Effect Clause Editor', {row, model});
  assert(model.editorKind === 'effect_clause', 'effect semantic action should use effect clause editor kind', model);
  assert(model.effectEvidence.length >= 1, 'effect semantic action should expose effect clause evidence', model.effectEvidence);
  const proposal = semanticLogic.buildProposal(model, {replacementText});
  assert(proposal.ok, 'effect semantic edit should build an install proposal', proposal);
  const operation = proposal.installPlan.operations[0];
  assert(operation && operation.type !== 'manual_snippet', 'effect semantic edit should be executable', {row, operation});
  return {model, operation};
}

const report = coverage.buildCoverageReport(index, {includeVariables: false, includeStructuredLogic: true});
const rows = report.rows.filter((row) => row.visibleContent);

assert(report.summary.effectClauseEditorCoverage === 1, 'all effect rows should have effect clause editor metadata', report.summary);

const guardedEffect = rowWhere(rows, (row) => row.view === 'structuredLogic' && row.role === 'effect' && row.installSafety === 'guarded_apply', 'simple effect should expose guarded effect editor');
const guardedEdit = semanticEdit(guardedEffect, 'Q.public_order += 2');
assert(guardedEdit.operation.safety === 'guarded_apply', 'simple effect clause editor operation should stay guarded_apply', guardedEdit.operation);

const advancedEffect = rowWhere(rows, (row) => row.view === 'structuredLogic' && row.role === 'effect' && row.installSafety === 'advanced_apply', 'shared/protected effect should expose advanced effect editor');
const advancedEdit = semanticEdit(advancedEffect, 'Q.dynamic_pressure += 2; Q.public_order += 1;');
assert(advancedEdit.operation.safety === 'advanced_apply', 'shared/protected effect clause editor operation should stay advanced_apply', advancedEdit.operation);
assert(advancedEdit.model.dynamicKeyEvidence.length >= 1, 'dynamic effect editor should expose dynamic Q evidence', advancedEdit.model.dynamicKeyEvidence);

const unsupportedOperator = semanticLogic.buildSemanticLogicEditor(index, {
  id: 'multiply_effect',
  label: 'Q.public_order *= 2',
  role: 'effect',
  sceneId: 'effect_guarded',
  editAction: {
    actionKind: 'open_source_slice',
    semanticEditor: {kind: 'effect_clause', role: 'effect', sceneId: 'effect_guarded'},
    source: src(guardedPath, 22, 'Q.public_order *= 2'),
    installSafety: 'guarded_apply',
    operationType: 'replace_text'
  }
});
assert(unsupportedOperator.ok, 'unsupported operator should still have a source-backed edit path', unsupportedOperator);
assert(!unsupportedOperator.fieldControls, 'unsupported effect operators should not be shown in the guided operator dropdown', unsupportedOperator.fieldControls);

process.stdout.write(JSON.stringify({
  ok: true,
  guardedEffect: guardedEdit.operation.type + ':' + guardedEdit.operation.safety,
  advancedEffect: advancedEdit.operation.type + ':' + advancedEdit.operation.safety,
  effectClauseEditorCoverage: report.summary.effectClauseEditorCoverage
}, null, 2) + '\n');
