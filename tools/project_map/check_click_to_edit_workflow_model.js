#!/usr/bin/env node
'use strict';

const coverage = require('./authoring/visible_object_coverage_model.js');
const objectCanvas = require('./authoring/object_authoring_canvas_model.js');
const sourceSlice = require('./authoring/source_slice_editor_model.js');
const semanticLogic = require('./authoring/semantic_logic_editor_model.js');
const variableDraft = require('./authoring/variable_editor_draft.js');
const installPlan = require('./authoring/install_plan.js');

function fail(message, details) {
  process.stderr.write(JSON.stringify(Object.assign({ok: false, message}, details || {}), null, 2) + '\n');
  process.exit(1);
}

function assert(condition, message, details) {
  if (!condition) {
    fail(message, details);
  }
}

function fixtureIndex() {
  const eventPath = 'source/scenes/events/click_event.scene.dry';
  const cardPath = 'source/scenes/cards/click_card.scene.dry';
  const protectedPath = 'source/scenes/post_event_news.scene.dry';
  return {
    schemaVersion: '0.1',
    project: {name: 'Click To Edit Workflow Fixture', root: '/tmp/click-to-edit', profileIds: ['generic-dendry']},
    scenes: [
      {
        id: 'click_event',
        title: 'Click Event',
        path: eventPath,
        type: 'event',
        sourceSpan: {path: eventPath, startLine: 1, endLine: 80},
        options: [{
          target: {id: 'next'},
          title: 'Continue',
          sourceSpan: {path: eventPath, line: 12, startLine: 12, endLine: 12, anchorText: '- @next: Continue', endAnchorText: '- @next: Continue'}
        }],
        sections: [{
          id: 'click_event.next',
          title: 'Next',
          sourceSpan: {path: eventPath, startLine: 20, endLine: 26},
          options: [],
          routes: {}
        }]
      },
      {
        id: 'click_card',
        title: 'Click Card',
        path: cardPath,
        type: 'card',
        flags: {isCard: true},
        tags: ['card'],
        sourceSpan: {path: cardPath, startLine: 1, endLine: 40},
        options: [{
          target: {id: 'click_event'},
          title: 'Play card',
          sourceSpan: {path: cardPath, line: 14, startLine: 14, endLine: 14, anchorText: '- @click_event: Play card', endAnchorText: '- @click_event: Play card'}
        }]
      },
      {
        id: 'route_heavy',
        title: 'Route Heavy',
        path: protectedPath,
        type: 'event',
        sourceSpan: {path: protectedPath, startLine: 100, endLine: 160},
        options: [{
          target: {id: 'fallback_event'},
          title: 'Fallback route',
          sourceSpan: {path: protectedPath, line: 120, startLine: 120, endLine: 120, anchorText: '- @fallback_event: Fallback route', endAnchorText: '- @fallback_event: Fallback route'}
        }],
        effects: [{
          variable: 'dynamic_pressure',
          op: '+=',
          value: '1',
          expression: 'Q.dynamic_pressure += 1',
          displayExpression: 'Q.dynamic_pressure += 1',
          sourceExpression: 'Q.dynamic_pressure += 1',
          source: {
            path: protectedPath,
            line: 130,
            startLine: 130,
            endLine: 130,
            anchorText: 'Q.dynamic_pressure += 1; Q.public_order += 1;',
            endAnchorText: 'Q.dynamic_pressure += 1; Q.public_order += 1;'
          }
        }]
      }
    ],
    variables: [{
      name: 'public_order',
      reads: [{path: eventPath, line: 12}],
      writes: [{path: eventPath, line: 30, text: 'Q.public_order = 1;'}],
      definedIn: [{path: eventPath, line: 30, text: 'Q.public_order = 1;'}],
      readCount: 1,
      writeCount: 1
    }],
    semantic: {
      events: [
        {id: 'click_event', title: 'Click Event', path: eventPath},
        {id: 'route_heavy', title: 'Route Heavy', path: protectedPath}
      ],
      cards: [{id: 'click_card', title: 'Click Card', path: cardPath}],
      news: {
        items: [{
          id: 'router_headline',
          headline: 'Router Headline',
          delivery: 'dated',
          source: {path: protectedPath, line: 8, anchorText: '- @click_event: Router Headline', endAnchorText: '- @click_event: Router Headline'}
        }],
        eventPopups: [{
          id: 'monthly_popup',
          title: 'Monthly Popup',
          linkedSceneId: 'click_event',
          delivery: 'legacy_event_popup',
          excerptSource: {path: eventPath, line: 8, anchorText: 'Click event body.', endAnchorText: 'Click event body.'}
        }]
      },
      textCorpus: {
        items: [
          {
            id: 'event_body',
            text: 'Click event body.\nThe player can edit this body.',
            role: 'body',
            owner: {kind: 'scene', sceneId: 'click_event', sectionId: 'start'},
            source: {path: eventPath, line: 8, startLine: 8, endLine: 9, anchorText: 'Click event body.', endAnchorText: 'The player can edit this body.'}
          },
          {
            id: 'event_option',
            text: 'Continue',
            role: 'option_label',
            owner: {kind: 'scene', sceneId: 'click_event', sectionId: 'start', itemId: 'next'},
            source: {path: eventPath, line: 12, anchorText: '- @next: Continue', endAnchorText: '- @next: Continue'}
          },
          {
            id: 'card_option',
            text: 'Play card',
            role: 'option_label',
            owner: {kind: 'scene', sceneId: 'click_card', sectionId: 'start', itemId: 'click_event', sceneType: 'card'},
            source: {path: cardPath, line: 14, anchorText: '- @click_event: Play card', endAnchorText: '- @click_event: Play card'}
          },
          {
            id: 'route_heavy_option',
            text: 'Fallback route',
            role: 'option_label',
            owner: {kind: 'scene', sceneId: 'route_heavy', sectionId: 'start', itemId: 'fallback_event'},
            source: {path: protectedPath, line: 120, anchorText: '- @fallback_event: Fallback route', endAnchorText: '- @fallback_event: Fallback route'}
          },
          {
            id: 'dynamic_effect_text',
            text: 'Q.dynamic_pressure += 1; Q.public_order += 1;',
            role: 'script',
            owner: {kind: 'scene', sceneId: 'route_heavy', sectionId: 'start'},
            source: {path: protectedPath, line: 130, anchorText: 'Q.dynamic_pressure += 1; Q.public_order += 1;', endAnchorText: 'Q.dynamic_pressure += 1; Q.public_order += 1;'}
          },
          {
            id: 'router_visible',
            text: 'Router Headline',
            role: 'news_headline',
            owner: {kind: 'news', delivery: 'dated'},
            source: {path: protectedPath, line: 8, anchorText: '- @click_event: Router Headline', endAnchorText: '- @click_event: Router Headline'}
          }
        ]
      }
    }
  };
}

function rowWhere(rows, predicate, message) {
  const row = rows.find(predicate);
  assert(row, message, rows.map((item) => ({id: item.id, role: item.role, routeClass: item.routeClass, action: item.editAction && item.editAction.actionKind})));
  return row;
}

function editObjectField(index, row, nextText) {
  const action = row.editAction;
  const key = action.valueKey || action.fieldId;
  assert(key, 'object edit action should name the field/value key', row);
  const model = objectCanvas.buildExistingCanvas(index, action.targetView, action.targetId, {values: {[key]: nextText}});
  assert(model.ok, 'object field action should open and edit Object Canvas', {row, diagnostics: model.changeState && model.changeState.diagnostics});
  const operations = model.changeState && model.changeState.installPlan && model.changeState.installPlan.operations || [];
  assert(operations.length >= 1, 'object field edit should generate install operation', {row, operations});
  assert(!operations.some((op) => op.type === 'manual_snippet'), 'visible object field edit should not generate manual_snippet', {row, operations});
  return {model, operations};
}

function editSourceSlice(index, row, replacementText) {
  const model = sourceSlice.buildSourceSliceEditor(index, row);
  assert(model.ok, 'source-backed row should open Source Slice Editor', {row, diagnostics: model.diagnostics});
  const proposal = sourceSlice.buildProposal(index, row, {replacementText});
  assert(proposal.ok, 'source-backed row should produce source slice proposal', proposal);
  const operation = proposal.installPlan.operations[0];
  assert(operation && operation.type !== 'manual_snippet', 'source slice visible edit should produce install operation', {row, operation});
  return {model, proposal, operation, classification: installPlan.classifyOperation(operation)};
}

function editSemanticLogic(index, row, replacementText) {
  assert(row.editAction && row.editAction.semanticEditor, 'semantic logic row should carry semantic editor metadata', row);
  const model = semanticLogic.buildSemanticLogicEditor(index, row);
  assert(model.ok, 'semantic logic row should open a semantic editor', {row, diagnostics: model.diagnostics});
  const proposal = semanticLogic.buildProposal(model, {replacementText});
  assert(proposal.ok, 'semantic logic edit should produce a proposal', proposal);
  const operation = proposal.installPlan.operations[0];
  assert(operation && operation.type !== 'manual_snippet', 'semantic logic visible edit should produce install operation', {row, operation});
  return {model, proposal, operation, classification: installPlan.classifyOperation(operation)};
}

const index = fixtureIndex();
const report = coverage.buildCoverageReport(index, {includeVariables: true, includeStructuredLogic: true});
const rows = report.rows.filter((row) => row.visibleContent);

assert(report.summary.visibleEditableCoverage === 1, 'click-to-edit starts from complete visible editability', report.summary);
assert(report.summary.visibleEditActionCoverage === 1, 'every visible row should have click edit action', report.summary);

const eventBody = rowWhere(rows, (row) => row.id === 'textCorpus:event_body' && row.editAction && row.editAction.actionKind === 'open_object_section', 'event body should click into section editor');
const eventEdit = editObjectField(index, eventBody, 'Updated event body.\nThe player changed this in Studio.');
assert(eventEdit.operations.some((op) => op.type === 'replace_section' && op.safety === 'guarded_apply'), 'event body click edit should generate guarded replace_section', eventEdit.operations);

const cardOption = rowWhere(rows, (row) => row.id === 'textCorpus:card_option' && row.editAction && row.editAction.actionKind === 'open_object_field', 'card option label should click into field editor');
const cardEdit = editObjectField(index, cardOption, 'Play the card now');
assert(cardEdit.operations.some((op) => op.type === 'replace_text' && op.safety === 'guarded_apply'), 'card option label edit should generate guarded replace_text', cardEdit.operations);

const conditionalRoute = rowWhere(rows, (row) => row.view === 'structuredLogic' && row.role === 'route' && row.installSafety === 'advanced_apply', 'conditional/protected route should click into advanced source patch');
const routeEdit = editSemanticLogic(index, conditionalRoute, '- @new_fallback: Updated fallback route');
assert(routeEdit.model.editorKind === 'route_order', 'conditional route should open Route Editor before source fallback', routeEdit.model);
assert(routeEdit.classification.status === 'advanced_apply', 'conditional route source patch should be advanced_apply', routeEdit);

const sharedEffect = rowWhere(rows, (row) => row.view === 'structuredLogic' && row.role === 'effect' && row.installSafety === 'advanced_apply', 'shared-line/dynamic effect should click into advanced source slice');
const effectEdit = editSemanticLogic(index, sharedEffect, 'Q.dynamic_pressure += 2; Q.public_order += 1;');
assert(effectEdit.model.editorKind === 'effect_clause', 'shared effect should open Effect Clause Editor before source fallback', effectEdit.model);
assert(effectEdit.classification.status === 'advanced_apply', 'shared-line effect source patch should be advanced_apply', effectEdit);

const monthlyPopup = rowWhere(rows, (row) => row.role === 'monthly_popup' && row.editAction && row.editAction.actionKind === 'open_linked_event', 'monthly popup should click into linked event editor');
const popupModel = objectCanvas.buildExistingCanvas(index, monthlyPopup.editAction.targetView, monthlyPopup.editAction.targetId, {});
assert(popupModel.ok && popupModel.objectId === 'click_event', 'monthly popup action should open linked event content', popupModel);

const routerEntry = rowWhere(rows, (row) => row.id === 'news:router_headline' && row.editAction && row.editAction.actionKind === 'open_advanced_source_patch', 'router entry should click into advanced source patch');
const routerEdit = editSourceSlice(index, routerEntry, '- @click_event: Updated Router Headline');
assert(routerEdit.classification.status === 'advanced_apply', 'router source patch should be advanced_apply', routerEdit);

const variableRow = rowWhere(rows, (row) => row.objectType === 'variable' && row.editAction && row.editAction.actionKind === 'open_variable_editor', 'variable should click into Variable Workspace');
const variable = index.variables.find((item) => item.name === variableRow.editAction.targetId);
const variableEditDraft = Object.assign(variableDraft.draftFromVariable(variable, index), {initialValue: '4'});
const variableBundle = variableDraft.buildExportBundle(variableEditDraft, index, {locale: 'en'});
assert(variableBundle.ok, 'variable edit draft should validate', variableBundle.diagnostics);
assert(variableBundle.installPlan.operations.some((op) => op.type === 'replace_text' && op.safety === 'guarded_apply'), 'source-backed variable init should generate guarded replace_text', variableBundle.installPlan.operations);
const variableConsumers = variableDraft.buildVariableConsumerModel(index).variables.find((item) => item.name === 'public_order');
assert(variableConsumers && variableConsumers.consumerSummary.total >= 3, 'variable workflow should expose reads/writes/owners impact preview', variableConsumers);

process.stdout.write(JSON.stringify({
  ok: true,
  visibleRows: rows.length,
  workflows: {
    eventBody: eventEdit.operations[0].type,
    cardOption: cardEdit.operations[0].type,
    conditionalRoute: routeEdit.classification.status,
    sharedEffect: effectEdit.classification.status,
    monthlyPopupTarget: popupModel.objectId,
    routerEntry: routerEdit.classification.status,
    variableOperations: variableBundle.installPlan.operations.map((op) => op.type + ':' + op.safety)
  }
}, null, 2) + '\n');
