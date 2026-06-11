#!/usr/bin/env node
'use strict';

const coverage = require('./authoring/visible_object_coverage_model.js');
const objectCanvas = require('./authoring/object_authoring_canvas_model.js');
const sourceSlice = require('./authoring/source_slice_editor_model.js');
const installPlan = require('./authoring/install_plan.js');

const {failJson: fail, assertJson: assert} = require('./check_harness.js');

function fixtureIndex() {
  const eventPath = 'source/scenes/events/click_event.scene.dry';
  const cardPath = 'source/scenes/cards/click_card.scene.dry';
  const routerPath = 'source/scenes/post_event_news.scene.dry';
  return {
    schemaVersion: '0.1',
    project: {name: 'Visible Edit Action Fixture', root: '/tmp/visible-edit-action', profileIds: ['generic-dendry']},
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
        tags: ['card'],
        flags: {isCard: true},
        sourceSpan: {path: cardPath, startLine: 1, endLine: 40},
        options: [{
          target: {id: 'click_event'},
          title: 'Play card',
          sourceSpan: {path: cardPath, line: 14, startLine: 14, endLine: 14, anchorText: '- @click_event: Play card', endAnchorText: '- @click_event: Play card'}
        }]
      },
      {
        id: 'library',
        title: 'Library',
        path: 'source/scenes/library.scene.dry',
        type: 'event',
        flags: {isSpecial: true},
        sourceSpan: {path: 'source/scenes/library.scene.dry', startLine: 1, endLine: 40},
        sections: [{
          id: 'library.government',
          title: 'Government',
          sourceSpan: {path: 'source/scenes/library.scene.dry', startLine: 8, endLine: 14},
          options: [],
          routes: {}
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
      events: [{id: 'click_event', title: 'Click Event', path: eventPath}],
      cards: [{id: 'click_card', title: 'Click Card', path: cardPath}],
      news: {
        items: [{
          id: 'router_headline',
          headline: 'Router Headline',
          delivery: 'dated',
          source: {path: routerPath, line: 8, anchorText: '- @click_event: Router Headline', endAnchorText: '- @click_event: Router Headline'}
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
            text: 'Click event body.',
            role: 'body',
            owner: {kind: 'scene', sceneId: 'click_event', sectionId: 'start'},
            source: {path: eventPath, line: 8, startLine: 8, endLine: 9, anchorText: 'Click event body.', endAnchorText: 'The player can edit this body.'}
          },
          {
            id: 'event_body_line',
            text: 'Click event body.',
            role: 'subtitle',
            owner: {kind: 'scene', sceneId: 'click_event', sectionId: 'start'},
            source: {path: eventPath, line: 8, anchorText: 'Click event body.', endAnchorText: 'Click event body.'}
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
            id: 'library_background',
            text: 'The Library explains the background institutions.',
            role: 'body',
            owner: {kind: 'scene', sceneId: 'library', sectionId: 'library.government'},
            source: {path: 'source/scenes/library.scene.dry', line: 10, startLine: 10, endLine: 11, anchorText: 'The Library explains the background institutions.', endAnchorText: 'It is source-backed page content.'}
          },
          {
            id: 'unowned_visible',
            text: 'Unowned visible line',
            role: 'body',
            owner: {kind: 'source_text'},
            source: {path: 'source/scenes/events/unowned.scene.dry', line: 3, anchorText: 'Unowned visible line', endAnchorText: 'Unowned visible line'}
          },
          {
            id: 'router_visible',
            text: 'Router Headline',
            role: 'news_headline',
            owner: {kind: 'news', delivery: 'dated'},
            source: {path: routerPath, line: 8, anchorText: '- @click_event: Router Headline', endAnchorText: '- @click_event: Router Headline'}
          }
        ]
      },
      surfaceText: {
        items: [{
          id: 'sidebar_label',
          label: 'Resources',
          area: 'sidebar',
          editability: 'draft_exportable',
          owner: {kind: 'surface_text'},
          // status scene path: keeps open_system_ui_editor coverage — since
          // 98.5 R5, qdisplay band lines route to the source slice editor.
          source: {path: 'source/scenes/status.scene.dry', line: 1, anchorText: 'Resources', endAnchorText: 'Resources'}
        }]
      }
    }
  };
}

function validateObjectAction(index, row) {
  const action = row.editAction;
  const model = objectCanvas.buildExistingCanvas(index, action.targetView || 'events', action.targetId, {});
  assert(model.ok, 'object edit action should open Object Canvas', {row, diagnostics: model.changeState && model.changeState.diagnostics});
  if (action.fieldId || action.valueKey) {
    const target = String(action.valueKey || action.fieldId || '').replace(/^block:/, '');
    const editors = model.rawContext && model.rawContext.editors && model.rawContext.editors.all || [];
    assert(editors.some((editor) => editor.id === target || editor.fieldId === target), 'object edit action should resolve an editor field or section', {row, target, editors: editors.map((editor) => ({id: editor.id, fieldId: editor.fieldId}))});
  }
}

function validateSourceAction(index, row) {
  const model = sourceSlice.buildSourceSliceEditor(index, row);
  assert(model.ok, 'source edit action should open Source Slice Editor', {row, diagnostics: model.diagnostics});
  const proposal = sourceSlice.buildProposal(index, row, {replacementText: model.currentText + ' updated'});
  assert(proposal.ok, 'source edit action should generate a proposal', proposal);
  const op = proposal.installPlan.operations[0];
  assert(op && op.type !== 'manual_snippet', 'visible source edit action must not generate manual_snippet', {row, op});
  const classified = installPlan.classifyOperation(op);
  assert(['safe_apply', 'guarded_apply', 'advanced_apply'].includes(classified.status), 'visible source edit operation should be installable', {row, classified, op});
}

const index = fixtureIndex();
const report = coverage.buildCoverageReport(index, {includeVariables: true, includeStructuredLogic: true});
const visibleRows = report.rows.filter((row) => row.visibleContent);
const actionKinds = new Set();

assert(report.summary.visibleEditableCoverage === 1, 'visible rows should stay editable', report.summary);
assert(report.summary.visibleEditActionCoverage === 1, 'every visible row should expose a resolvable editAction', report.summary);
assert(report.summary.visibleEditActionMissingCount === 0, 'visible rows must not miss editAction', report.summary);
assert(report.summary.visibleEditActionUnresolvedCount === 0, 'visible editAction targets must resolve', report.summary);
assert(report.summary.semanticEditorCoverage === 1, 'eligible visible logic should expose semantic editor metadata', report.summary);

visibleRows.forEach((row) => {
  const action = row.editAction;
  assert(action && action.kind === 'visible_edit_action', 'visible row should include editAction contract', row);
  assert(action.actionKind, 'editAction should include actionKind', row);
  assert(action.routeClass === row.routeClass, 'editAction routeClass should match row route', row);
  assert(action.installSafety === row.installSafety, 'editAction installSafety should match row safety', row);
  assert(action.source && typeof action.source.path === 'string', 'editAction should carry source evidence', row);
  actionKinds.add(action.actionKind);
  if (['open_object_field', 'open_object_section', 'open_linked_event'].includes(action.actionKind)) {
    validateObjectAction(index, row);
  } else if (['open_source_slice', 'open_advanced_source_patch'].includes(action.actionKind)) {
    validateSourceAction(index, row);
  } else if (action.actionKind === 'open_variable_editor') {
    assert(index.variables.some((variable) => variable.name === action.targetId), 'variable edit action should target an indexed variable', row);
  } else if (action.actionKind === 'open_system_ui_editor') {
    assert(action.targetView && action.targetId, 'System UI edit action should target a UI workspace', row);
    assert(action.workspace === 'system_ui', 'System UI edit action should carry workspace payload', row);
    assert(action.template && action.internalTemplate, 'System UI edit action should carry template/internalTemplate payload', row);
    assert(action.selectedRegion && action.selectedRegion.indexOf('ui:') === 0, 'System UI edit action should carry selected region payload', row);
    assert(action.focusFieldId, 'System UI edit action should carry a focus field for semantic task handoff', row);
    assert(Object.prototype.hasOwnProperty.call(action, 'replacementText'), 'System UI edit action should preserve replacement text even when manual review is needed', row);
    assert(action.target && action.target.source && action.target.source.path, 'System UI edit action should keep source evidence on the target', row);
  } else {
    fail('unsupported visible editAction kind', row);
  }
  if (row.view === 'structuredLogic' && (row.role === 'route' || row.role === 'effect')) {
    assert(action.semanticEditor && ['route_order', 'effect_clause'].includes(action.semanticEditor.kind), 'structured logic action should carry semantic editor metadata', row);
  }
  if (row.objectType === 'variable') {
    assert(action.semanticEditor && action.semanticEditor.kind === 'variable_provenance', 'variable action should carry provenance editor metadata', row);
  }
});

const libraryRow = visibleRows.find((row) => row.id === 'textCorpus:library_background');
assert(libraryRow && libraryRow.editAction && libraryRow.editAction.workspace === 'content', 'Library page content should open the content workspace, not the System UI chrome editor', libraryRow);
assert(libraryRow.editAction.actionKind === 'open_object_section', 'Library page content should route to the owning source-backed section editor', libraryRow);

[
  'open_object_field',
  'open_object_section',
  'open_source_slice',
  'open_variable_editor',
  'open_system_ui_editor',
  'open_linked_event',
  'open_advanced_source_patch'
].forEach((kind) => {
  assert(actionKinds.has(kind), 'fixture should cover editAction kind ' + kind, {actionKinds: Array.from(actionKinds), rows: visibleRows});
});

process.stdout.write(JSON.stringify({
  ok: true,
  visibleRows: visibleRows.length,
  visibleEditActionCoverage: report.summary.visibleEditActionCoverage,
  semanticEditorCoverage: report.summary.semanticEditorCoverage,
  actionKinds: Array.from(actionKinds).sort()
}, null, 2) + '\n');
