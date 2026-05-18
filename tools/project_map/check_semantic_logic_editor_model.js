#!/usr/bin/env node
// @ts-check
'use strict';

const coverage = require('./authoring/visible_object_coverage_model.js');
const semanticLogic = require('./authoring/semantic_logic_editor_model.js');
const workspace = require('./viewer/semantic_logic_workspace_ui.js');

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

function fixtureIndex() {
  const routePath = 'source/scenes/events/semantic_route.scene.dry';
  const effectPath = 'source/scenes/events/semantic_effect.scene.dry';
  return {
    schemaVersion: '0.1',
    project: {name: 'Semantic Logic Editor Fixture', root: '/tmp/semantic-logic', profileIds: ['generic-dendry']},
    scenes: [
      {
        id: 'semantic_route',
        title: 'Semantic Route',
        path: routePath,
        type: 'event',
        sourceSpan: {path: routePath, startLine: 1, endLine: 80},
        options: [{
          target: {id: 'branch_a'},
          title: 'Take branch',
          sourceSpan: src(routePath, 12, '- @branch_a: Take branch')
        }],
        sections: [{
          id: 'semantic_route.branch_a',
          title: 'Branch A',
          sourceSpan: {path: routePath, startLine: 20, endLine: 28},
          options: [],
          routes: {goTo: [{id: 'branch_b', raw: 'branch_b if Q.flag', predicate: 'Q.flag'}]}
        }, {
          id: 'semantic_route.branch_b',
          title: 'Branch B',
          sourceSpan: {path: routePath, startLine: 30, endLine: 36},
          options: [],
          routes: {}
        }]
      },
      {
        id: 'semantic_effect',
        title: 'Semantic Effect',
        path: effectPath,
        type: 'event',
        sourceSpan: {path: effectPath, startLine: 1, endLine: 60},
        effects: [{
          variable: 'public_order',
          op: '+=',
          value: '1',
          expression: 'Q.public_order += 1',
          displayExpression: 'Q.public_order += 1',
          sourceExpression: 'Q.public_order += 1',
          source: src(effectPath, 18, 'Q.public_order += 1; Q.approval += 1;')
        }]
      }
    ],
    variables: [{
      name: 'public_order',
      reads: [src(effectPath, 14, 'Q.public_order')],
      writes: [src(effectPath, 18, 'Q.public_order += 1; Q.approval += 1;')],
      definedIn: [src(effectPath, 6, 'Q.public_order = 0')],
      readCount: 1,
      writeCount: 1
    }],
    semantic: {
      events: [
        {id: 'semantic_route', title: 'Semantic Route', path: routePath},
        {id: 'semantic_effect', title: 'Semantic Effect', path: effectPath}
      ],
      cards: [],
      news: {items: [], eventPopups: []},
      textCorpus: {
        items: [
          {id: 'route_body', text: 'Route body.', role: 'body', owner: {kind: 'scene', sceneId: 'semantic_route', sectionId: 'start'}, source: src(routePath, 8, 'Route body.')},
          {id: 'route_option', text: 'Take branch', role: 'option_label', owner: {kind: 'scene', sceneId: 'semantic_route', sectionId: 'start', itemId: 'branch_a'}, source: src(routePath, 12, '- @branch_a: Take branch')},
          {id: 'effect_script', text: 'Q.public_order += 1; Q.approval += 1;', role: 'script', owner: {kind: 'scene', sceneId: 'semantic_effect', sectionId: 'start'}, source: src(effectPath, 18, 'Q.public_order += 1; Q.approval += 1;')}
        ]
      },
      parserEvidence: {
        schemaVersion: '0.2',
        kind: 'parser_semantic_evidence',
        core: {
          routeOrderGroups: [{
            id: 'route_group_semantic',
            sceneId: 'semantic_route',
            ownerId: 'semantic_route',
            routeField: 'goTo',
            chainContext: 'ordered_chain',
            source: src(routePath, 20, 'branch_b if Q.flag'),
            parserBacked: true,
            clauses: [
              {order: 1, rawTarget: 'branch_b', resolvedTarget: 'semantic_route.branch_b', targetResolved: true, predicate: 'Q.flag', isFallback: false},
              {order: 2, rawTarget: 'fallback', resolvedTarget: 'semantic_route.fallback', targetResolved: true, predicate: '', isFallback: true}
            ]
          }],
          dynamicKeyEvidence: [{
            id: 'dynamic_public_order',
            sceneId: 'semantic_effect',
            expression: "party + '_approval'",
            classification: 'dynamic_concatenation',
            safeExpansion: false,
            source: src(effectPath, 18, 'Q.public_order += 1; Q.approval += 1;')
          }],
          effectClauses: [{
            id: 'effect_public_order',
            sceneId: 'semantic_effect',
            ownerId: 'semantic_effect',
            variable: 'public_order',
            op: '+=',
            value: '1',
            sourceExpression: 'Q.public_order += 1',
            lineEffectCount: 2,
            tokenUniqueOnLine: true,
            source: src(effectPath, 18, 'Q.public_order += 1; Q.approval += 1;')
          }]
        }
      }
    }
  };
}

function rowWhere(rows, predicate, message) {
  const row = rows.find(predicate);
  assert(row, message, rows.map((item) => ({id: item.id, role: item.role, semanticEditor: item.editAction && item.editAction.semanticEditor})));
  return row;
}

const index = fixtureIndex();
const report = coverage.buildCoverageReport(index, {includeVariables: true, includeStructuredLogic: true});
const rows = report.rows.filter((row) => row.visibleContent);

assert(report.summary.semanticEditorCoverage === 1, 'semantic editor coverage should be complete for eligible visible logic', report.summary);
assert(report.summary.structuredRouteEditorCoverage === 1, 'structured route rows should carry route editor metadata', report.summary);
assert(report.summary.effectClauseEditorCoverage === 1, 'effect rows should carry effect editor metadata', report.summary);

const routeRow = rowWhere(rows, (row) => row.view === 'structuredLogic' && row.role === 'route' && row.editAction && row.editAction.semanticEditor && row.editAction.semanticEditor.kind === 'route_order', 'route row should expose route semantic editor');
const effectRow = rowWhere(rows, (row) => row.view === 'structuredLogic' && row.role === 'effect' && row.editAction && row.editAction.semanticEditor && row.editAction.semanticEditor.kind === 'effect_clause', 'effect row should expose effect semantic editor');
const variableRow = rowWhere(rows, (row) => row.objectType === 'variable' && row.editAction && row.editAction.semanticEditor && row.editAction.semanticEditor.kind === 'variable_provenance', 'variable row should expose variable provenance metadata');

const routeModel = semanticLogic.buildSemanticLogicEditor(index, routeRow);
assert(routeModel.ok, 'route semantic editor should build', routeModel);
assert(routeModel.editorKind === 'route_order', 'route semantic editor should keep route kind', routeModel);
assert(routeModel.routeEvidence.length >= 1, 'route semantic editor should attach parser route evidence', routeModel.routeEvidence);
assert(routeModel.fieldControls && routeModel.fieldControls.mode === 'route', 'route semantic editor should expose guided route fields', routeModel.fieldControls);
const routeFieldText = semanticLogic.composeFieldReplacement(routeModel, {'semantic_logic.routeTarget': 'branch_c'});
assert(routeFieldText.includes('branch_c'), 'guided route target should compose replacement source text', {routeFieldText});
const routeProposal = semanticLogic.buildProposal(routeModel, {'semantic_logic.routeTarget': 'branch_c'});
assert(routeProposal.ok, 'route semantic editor should generate an install proposal', routeProposal);
assert(!routeProposal.installPlan.operations.some((op) => op.type === 'manual_snippet'), 'route semantic editor should not generate manual snippets', routeProposal.installPlan.operations);

const effectModel = semanticLogic.buildSemanticLogicEditor(index, effectRow);
assert(effectModel.ok, 'effect semantic editor should build', effectModel);
assert(effectModel.editorKind === 'effect_clause', 'effect semantic editor should keep effect kind', effectModel);
assert(effectModel.effectEvidence.length >= 1, 'effect semantic editor should attach effect clause evidence', effectModel.effectEvidence);
assert(effectModel.dynamicKeyEvidence.length >= 1, 'effect semantic editor should attach dynamic Q evidence when source lines match', effectModel.dynamicKeyEvidence);
assert(effectModel.fieldControls && effectModel.fieldControls.mode === 'effect', 'effect semantic editor should expose guided effect fields', effectModel.fieldControls);
const effectFieldText = semanticLogic.composeFieldReplacement(effectModel, {'semantic_logic.effectValue': '2'});
assert(effectFieldText.includes('Q.public_order += 2'), 'guided effect value should compose the selected clause', {effectFieldText});
assert(effectFieldText.includes('Q.approval += 1'), 'guided effect edit should preserve the rest of a shared source line', {effectFieldText});
const effectProposal = semanticLogic.buildProposal(effectModel, {'semantic_logic.effectValue': '2'});
assert(effectProposal.ok, 'effect semantic editor should generate an install proposal', effectProposal);

const deps = {
  translate: (_key, fallback) => fallback,
  escapeHtml: (value) => String(value === undefined || value === null ? '' : value),
  escapeAttr: (value) => String(value === undefined || value === null ? '' : value),
  renderPlanPreview: (plan) => plan ? '<section data-object-canvas-review-plan="true"></section>' : '',
  renderDiagnostics: () => '',
  semanticLogicApi: semanticLogic
};
const noChange = workspace.buildCanvasModel(routeModel, {}, deps);
assert(noChange.changeState.changedCount === 0, 'semantic editor should not create a fake plan before edits', noChange.changeState);
assert(!workspace.reviewAllowed({model: noChange, semanticLogicModel: routeModel}), 'no-op semantic editor should not be reviewable');
const changed = workspace.buildCanvasModel(routeModel, {'semantic_logic.routeTarget': 'branch_c'}, deps);
assert(changed.changeState.changedCount === 1 && changed.changeState.installPlan, 'semantic editor should produce a plan after edits', changed.changeState);
assert(workspace.reviewAllowed({model: changed, semanticLogicModel: routeModel}), 'guarded semantic editor should be reviewable after edits');
const html = workspace.render(changed, {semanticLogicModel: routeModel, values: {'semantic_logic.routeTarget': 'branch_c'}}, deps);
assert(html.includes('data-semantic-logic-editor="true"'), 'semantic workspace should render editor marker');
assert(html.includes('data-semantic-logic-field-controls="true"'), 'semantic workspace should render guided field controls');
assert(html.includes('data-semantic-logic-control="route-target"'), 'semantic workspace should render route target control');
assert(html.includes('data-route-editor-evidence="true"'), 'semantic workspace should render route evidence marker');
const effectChanged = workspace.buildCanvasModel(effectModel, {'semantic_logic.effectValue': '2'}, deps);
const effectHtml = workspace.render(effectChanged, {semanticLogicModel: effectModel, values: {'semantic_logic.effectValue': '2'}}, deps);
assert(effectHtml.includes('data-semantic-logic-control="effect-value"'), 'semantic workspace should render effect value control');

process.stdout.write(JSON.stringify({
  ok: true,
  coverage: {
    semanticEditorCoverage: report.summary.semanticEditorCoverage,
    structuredRouteEditorCoverage: report.summary.structuredRouteEditorCoverage,
    effectClauseEditorCoverage: report.summary.effectClauseEditorCoverage,
    sourceSliceFallbackCount: report.summary.sourceSliceFallbackCount
  },
  routeOperation: routeProposal.installPlan.operations[0].type + ':' + routeProposal.installPlan.operations[0].safety,
  effectOperation: effectProposal.installPlan.operations[0].type + ':' + effectProposal.installPlan.operations[0].safety,
  variableSemanticEditor: variableRow.editAction.semanticEditor.kind
}, null, 2) + '\n');
