#!/usr/bin/env node
'use strict';

const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const eventStructureModel = require('./authoring/event_structure_model.js');
const installPlanApi = require('./authoring/install_plan.js');
const deleteProposalModel = require('./authoring/object_delete_proposal_model.js');
const shellUi = require('./viewer/object_canvas_shell_ui.js');
const previewEditor = require('./viewer/preview_object_editor.js');
global.ProjectMapAuthoringSurfaceGraphs = {
  buildGraph(model) {
    const node = {
      key: 'object',
      panel: 'object',
      label: 'Object',
      title: model && model.title || '',
      detail: 'Fixture object'
    };
    return {title: node.title, width: 1, height: 1, nodes: [node], edges: [], nodeByKey: {object: node}, workspace: 'content'};
  }
};
const graphStage = require('./viewer/object_canvas_graph_stage.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function textareaRows(html, fieldId) {
  const match = new RegExp('<textarea rows="(\\d+)"[^>]*data-object-canvas-field="' + fieldId + '"').exec(html);
  return match ? Number(match[1]) : 0;
}

function scene(id, overrides) {
  const path = overrides && overrides.path || 'source/scenes/events/' + id + '.scene.dry';
  return Object.assign({
    id,
    title: id.replace(/_/g, ' '),
    path,
    type: 'event',
    flags: {isCard: false},
    viewIf: 'year = 1936 and month >= 1 and month <= 3',
    options: [
      {
        target: {id: 'target_scene'},
        title: 'Continue——Open the next beat.',
        sourceSpan: {
          path,
          line: 14,
          startLine: 14,
          endLine: 14,
          anchorText: '- @target_scene: Continue——Open the next beat.',
          endAnchorText: '- @target_scene: Continue——Open the next beat.'
        }
      }
    ],
    sourceSpan: {path, startLine: 1, endLine: 80},
    metadata: {viewIf: {path, line: 4}},
    assetRefs: []
  }, overrides || {});
}

const current = scene('generic_intro', {title: 'Generic Intro'});
current.sections = [{
  id: 'generic_intro.followup',
  title: 'Nice having you, Bruning.',
  sourceSpan: {path: current.path, startLine: 30, endLine: 34},
  routes: {},
  options: []
}];
current.effects = [{
  variable: 'budget',
  op: '+=',
  value: '1',
  hook: 'on-arrival',
  syntax: 'dendry_shorthand',
  sourceExpression: 'budget += 1',
  displayExpression: 'Q.budget += 1',
  expression: 'Q.budget += 1',
  source: {
    path: current.path,
    line: 5,
    startLine: 5,
    endLine: 5,
    anchorText: 'on-arrival: budget += 1;',
    endAnchorText: 'on-arrival: budget += 1;'
  }
}];
const target = scene('target_scene', {title: 'Target Scene'});
const labor = scene('labor_unrest', {
  title: 'Labor Unrest',
  assetRefs: [{path: 'img/events/dnvp_congress.png', type: 'image', label: 'Congress hall', role: 'event_illustration'}],
  options: [{
    target: {id: 'support_labor'},
    title: 'Support labor.',
    sourceSpan: {
      path: 'source/scenes/events/labor_unrest.scene.dry',
      line: 14,
      startLine: 14,
      endLine: 14,
      anchorText: '- @support_labor: Support labor.',
      endAnchorText: '- @support_labor: Support labor.'
    }
  }],
  sections: [
    {
      id: 'labor_unrest.support_labor',
      sourceSpan: {path: 'source/scenes/events/labor_unrest.scene.dry', startLine: 20, endLine: 24},
      routes: {},
      options: []
    },
    {
      id: 'labor_unrest.no_ministry',
      viewIf: 'labor_minister != "SPD"',
      sourceSpan: {path: 'source/scenes/events/labor_unrest.scene.dry', startLine: 25, endLine: 29},
      metadata: {viewIf: {path: 'source/scenes/events/labor_unrest.scene.dry', line: 26}},
      routes: {},
      options: []
    }
  ],
  sourceSpan: {path: 'source/scenes/events/labor_unrest.scene.dry', startLine: 1, endLine: 40},
  metadata: {viewIf: {path: 'source/scenes/events/labor_unrest.scene.dry', line: 4}}
});

const index = {
  schemaVersion: '0.1',
  project: {name: 'Object Canvas Fixture', root: '/tmp/object-canvas'},
  scenes: [current, target, labor],
  edges: [
    {from: 'generic_intro', to: 'target_scene', kind: 'go_to', label: 'continues', source: {path: current.path, line: 20}}
  ],
  variables: [
    {name: 'public_order', readCount: 1, writeCount: 1, reads: [{path: current.path, line: 8}], writes: [{path: current.path, line: 25}], tags: ['politics']},
    {name: 'labor_minister', readCount: 1, writeCount: 1, reads: [{path: labor.path, line: 26}], writes: [{path: labor.path, line: 6}], tags: ['labor']}
  ],
  semantic: {
    events: [{id: current.id, title: current.title, path: current.path}, {id: labor.id, title: labor.title, path: labor.path}],
    cards: [],
    textCorpus: {
      items: [
        {
          id: 'generic_intro_title',
          text: 'Generic Intro',
          role: 'title',
          owner: {kind: 'scene', sceneId: 'generic_intro'},
          source: {path: current.path, line: 1}
        },
        {
          id: 'generic_intro_body',
          text: 'The campaign office wakes before dawn.',
          role: 'body',
          owner: {kind: 'scene', sceneId: 'generic_intro', sectionId: 'start'},
          source: {path: current.path, line: 8}
        },
        {
          id: 'generic_intro_option',
          text: 'Continue',
          role: 'option_label',
          owner: {kind: 'scene', sceneId: 'generic_intro', sectionId: 'start', itemId: 'target_scene'},
          source: {path: current.path, line: 14, anchorText: '- @target_scene: Continue——Open the next beat.', endAnchorText: '- @target_scene: Continue——Open the next beat.'}
        },
        {
          id: 'generic_intro_effect',
          text: 'Q.public_order += 1;',
          role: 'script',
          owner: {kind: 'scene', sceneId: 'generic_intro', sectionId: 'target_scene'},
          source: {path: current.path, line: 25, anchorText: 'Q.public_order += 1;', endAnchorText: 'Q.public_order += 1;'}
        },
        {
          id: 'generic_intro_followup_heading',
          text: 'Nice having you, Bruning.',
          role: 'heading',
          owner: {kind: 'scene', sceneId: 'generic_intro', sectionId: 'generic_intro.followup'},
          source: {path: current.path, line: 30, anchorText: '= Nice having you, Bruning.', endAnchorText: '= Nice having you, Bruning.'}
        },
        {
          id: 'generic_intro_followup_body',
          text: 'The story advances into a second page inside the same event.',
          role: 'body',
          owner: {kind: 'scene', sceneId: 'generic_intro', sectionId: 'generic_intro.followup'},
          source: {path: current.path, line: 32, anchorText: 'The story advances into a second page inside the same event.', endAnchorText: 'The story advances into a second page inside the same event.'}
        },
        {
          id: 'labor_unrest_title',
          text: 'Labor Unrest',
          role: 'title',
          owner: {kind: 'scene', sceneId: 'labor_unrest'},
          source: {path: labor.path, line: 1}
        },
        {
          id: 'labor_unrest_opening',
          text: '<table><tr><th>Faction</th><th>Votes</th></tr><tr><td>Hugenberg bloc</td><td>54</td></tr></table>',
          role: 'body',
          owner: {kind: 'scene', sceneId: 'labor_unrest'},
          source: {path: labor.path, line: 8, anchorText: '<table><tr><th>Faction</th><th>Votes</th></tr><tr><td>Hugenberg bloc</td><td>54</td></tr></table>', endAnchorText: '<table><tr><th>Faction</th><th>Votes</th></tr><tr><td>Hugenberg bloc</td><td>54</td></tr></table>'}
        },
        {
          id: 'labor_unrest_option',
          text: 'Support labor.',
          role: 'option_label',
          owner: {kind: 'scene', sceneId: 'labor_unrest', itemId: 'support_labor'},
          source: {path: labor.path, line: 14, anchorText: '- @support_labor: Support labor.', endAnchorText: '- @support_labor: Support labor.'}
        },
        {
          id: 'labor_unrest_result',
          text: 'The cabinet makes a public concession.',
          role: 'body',
          owner: {kind: 'scene', sceneId: 'labor_unrest', sectionId: 'labor_unrest.support_labor'},
          source: {path: labor.path, line: 21}
        },
        {
          id: 'labor_unrest_conditional',
          text: 'The ministry is outside our control.',
          role: 'body',
          owner: {kind: 'scene', sceneId: 'labor_unrest', sectionId: 'labor_unrest.no_ministry'},
          source: {path: labor.path, line: 27}
        }
      ]
    }
  }
};

const menuFlow = scene('menu_flow', {
  title: 'Menu Flow',
  options: [],
  routes: {goTo: [{id: 'menu', raw: 'menu'}]},
  sections: [{
    id: 'menu_flow.menu',
    title: 'Choose a tactic.',
    sourceSpan: {path: 'source/scenes/events/menu_flow.scene.dry', startLine: 20, endLine: 28},
    routes: {},
    options: [{
      target: {id: 'first'},
      title: 'First path.',
      sourceSpan: {
        path: 'source/scenes/events/menu_flow.scene.dry',
        line: 24,
        startLine: 24,
        endLine: 24,
        anchorText: '- @first: First path.',
        endAnchorText: '- @first: First path.'
      }
    }, {
      target: {id: 'second'},
      title: 'Second path.',
      sourceSpan: {
        path: 'source/scenes/events/menu_flow.scene.dry',
        line: 25,
        startLine: 25,
        endLine: 25,
        anchorText: '- @second: Second path.',
        endAnchorText: '- @second: Second path.'
      }
    }]
  }]
});
index.scenes.push(menuFlow);
index.semantic.events.push({id: menuFlow.id, title: menuFlow.title, path: menuFlow.path});
index.semantic.textCorpus.items.push(
  {
    id: 'menu_flow_title',
    text: 'Menu Flow',
    role: 'title',
    owner: {kind: 'scene', sceneId: 'menu_flow'},
    source: {path: menuFlow.path, line: 1}
  },
  {
    id: 'menu_flow_menu_body',
    text: 'The player arrives at a follow-up menu with two choices.',
    role: 'body',
    owner: {kind: 'scene', sceneId: 'menu_flow', sectionId: 'menu_flow.menu'},
    source: {path: menuFlow.path, line: 22}
  }
);

const existing = canvasModel.buildExistingCanvas(index, 'events', 'generic_intro', {
  values: {
    generic_intro_body: 'The campaign office opens to a sharper morning.',
    generic_intro_option: 'Follow the campaign lead'
  },
  entry: {source: 'Design', action: 'edit_existing'}
});

assert(existing.ok, 'existing Event should open in Object Canvas: ' + JSON.stringify(existing.changeState.diagnostics));
assert(existing.kind === 'object_authoring_canvas_model', 'model should expose object canvas kind');
assert(existing.mode === 'existing', 'existing model should keep existing mode');
assert(existing.eventBody.title.value === 'Generic Intro', 'existing body should expose the player-facing title');
assert(existing.eventBody.sections.length >= 1, 'existing body should expose source-backed body fields');
assert(!existing.eventBody.sections.some((field) => field.sectionId === 'generic_intro.followup'), 'existing body should not flatten follow-up pages into opening prose');
assert(existing.eventBody.branchSections.some((field) => field.semanticRole === 'section_text' && field.sectionId === 'generic_intro.followup'), 'existing body should expose same-scene follow-up pages as branch sections');
assert(existing.eventBody.options.length === 1, 'existing body should expose option rows');
assert(existing.eventBody.options[0].target && existing.eventBody.options[0].target.source && existing.eventBody.options[0].target.source.startLine === 1, 'existing option rows should retain target endpoint context for preview impacts');
assert(existing.eventBody.metaFields.some((field) => field.role === 'route' && field.value === 'target_scene'), 'existing body should expose editable route targets in the logic editor');
assert(existing.eventBody.structureActions.some((field) => field.id === 'structure_add_option'), 'existing body should expose add-option structural actions');
assert(existing.eventBody.structureActions.some((field) => field.id === 'structure_remove_option_target_scene'), 'existing body should expose option removal structural actions');
assert(existing.eventBody.effects.some((field) => field.role === 'effect' && field.value === 'Q.budget += 1'), 'existing body should expose trigger effect fields in the preview editor');
assert(existing.eventBody.structureActions.some((field) => field.id === 'structure_add_trigger_effect'), 'existing body should expose trigger effect creation fields');
assert(existing.eventBody.structureActions.some((field) => field.id === 'structure_remove_effect_budget_1'), 'existing body should expose effect removal structural actions');
assert(existing.eventBody.optionEffects[0].fields.some((field) => field.role === 'effect' && field.value === 'Q.public_order += 1'), 'existing body should expose option effect fields in the preview editor');
assert(existing.eventBody.structureActions.some((field) => field.id === 'structure_add_option_effect_target_scene'), 'existing body should expose option effect creation fields');
assert(existing.eventBody.eventStructure && existing.eventBody.eventStructure.kind === 'event_structure', 'existing Event editor body should be derived through EventStructure');
const existingPreviewHtml = previewEditor.renderPreviewPane(existing);
assert(existingPreviewHtml.includes('data-object-editing-preview-effects="true"'), 'left preview should render an effects and impact block');
assert(existingPreviewHtml.includes('Q.budget += 1'), 'left preview should show trigger effect impact text');
assert(existingPreviewHtml.includes('Follow-up page'), 'left preview should label same-scene follow-up text as a follow-up page');
assert(existingPreviewHtml.includes('Section: Nice having you, Bruning.'), 'left preview should keep the follow-up page title as section context');
const menuFlowCanvas = canvasModel.buildExistingCanvas(index, 'events', 'menu_flow', {});
assert(menuFlowCanvas.ok, 'menu-flow existing Event should open in Object Canvas: ' + JSON.stringify(menuFlowCanvas.changeState.diagnostics));
const menuBranch = menuFlowCanvas.eventBody.branchSections.find((field) => field.sectionId === 'menu_flow.menu');
assert(menuBranch && menuBranch.semanticRole === 'menu_section_text', 'follow-up menus should stay in branch sections instead of choice result fields');
assert(menuBranch.ownedOptionIds.length === 2, 'follow-up menu branch sections should expose their owned choices');
assert(menuFlowCanvas.eventBody.options.length === 2, 'follow-up menu choices should still be editable option rows');
assert(menuFlowCanvas.eventBody.options.every((option) => !option.resultFields.some((field) => field.sectionId === 'menu_flow.menu')), 'owned menu text must not be duplicated under every owned option');
assert(menuFlowCanvas.eventBody.structureActions.some((field) => field.structureAction === 'add_option' && field.sectionId === 'menu_flow.menu'), 'follow-up menu sections should expose add-option-in-section controls');
const menuPreviewHtml = previewEditor.renderPreviewPane(menuFlowCanvas);
assert(menuPreviewHtml.includes('Follow-up menu'), 'left preview should label owned-choice sections as follow-up menus');
assert(menuPreviewHtml.includes('Contains choices'), 'left preview should explain which choices belong to a follow-up menu');
const menuEditorHtml = previewEditor.render(menuFlowCanvas);
assert(menuEditorHtml.includes('New option in this section'), 'right editor should place a section-owned option creator inside follow-up sections');
assert(menuEditorHtml.includes('Add to: @menu') && menuEditorHtml.includes('title="menu_flow.menu"'), 'section-owned option creator should show the target section context');
assert(menuEditorHtml.includes('Manual review only; Studio will not change source automatically.'), 'existing structural creators should clearly show manual-review safety');
const existingEditorHtml = previewEditor.render(existing);
assert(existingEditorHtml.includes('data-preview-object-structure-builder="add_option"'), 'preview editor should show structured add-option controls');
assert(existingEditorHtml.includes('New player option'), 'preview editor should present add-option as a creator form instead of a raw snippet');
assert(existingEditorHtml.includes('data-preview-object-structure-builder="add_trigger_effect"'), 'preview editor should show structured trigger-effect controls');
assert(existingEditorHtml.includes('data-preview-object-inline-add="add_option"'), 'preview editor should place structural add controls at the end of the relevant object category');
assert(!existingEditorHtml.includes('preview-object-structure-workbench'), 'preview editor should not isolate structural controls in a separate workbench');
const expandedModalHtml = previewEditor.renderModal(existing, {previewExpanded: true});
assert(expandedModalHtml.includes('is-preview-expanded'), 'preview object modal should expose an expanded preview state');
assert(expandedModalHtml.includes('Collapse preview'), 'expanded preview modal should offer a collapse action');
const pendingStructureValues = {
  structure_add_option: '- @negotiate: Negotiate settlement.\n# negotiate\nThe committee spends [+ public_order +] legitimacy.',
  structure_add_branch: '# late_warning\n[? if Q.public_order >= 2 : Public order is under strain. ?]',
  structure_add_trigger_effect: 'Q.public_order += 2',
  structure_add_option_effect_target_scene: 'Q.public_order -= 1'
};
const pendingStructureModel = canvasModel.buildExistingCanvas(index, 'events', 'generic_intro', {
  values: pendingStructureValues,
  entry: {source: 'Design', action: 'edit_existing'}
});
const pendingPreviewHtml = previewEditor.renderPreviewPane(pendingStructureModel);
assert(pendingStructureModel.changeState.changedCount === 4, 'existing editor should collect add-option, add-branch, trigger-effect, and option-effect proposals');
assert(pendingStructureModel.changeState.installPlan.operations.filter((operation) => operation.type === 'manual_snippet').length === 3, 'broad existing structural proposals should remain manual-review snippets');
assert(pendingStructureModel.changeState.installPlan.operations.some((operation) => operation.type === 'insert_text' && operation.safety === 'guarded_apply'), 'simple source-backed option effects should become guarded inserts');
assert(pendingPreviewHtml.includes('Negotiate settlement.'), 'left preview should materialize a pending new player option');
assert(pendingPreviewHtml.includes('The committee spends') && pendingPreviewHtml.includes('Q.public_order'), 'left preview should show pending option result text and consumed variables');
assert(pendingPreviewHtml.includes('Public order is under strain.'), 'left preview should materialize pending branch/follow-up text');
assert(pendingPreviewHtml.includes('Q.public_order += 2'), 'left preview should show pending trigger effect changes');
assert(pendingPreviewHtml.includes('Q.public_order -= 1'), 'left preview should show pending option effect changes');
const queuedStructureModel = canvasModel.buildExistingCanvas(index, 'events', 'generic_intro', {
  values: {
    __structureCommands: [
      {id: 'queued_add_option', type: 'add_option', action: 'add_option', fieldId: 'structure_add_option', value: '- @press_line: Brief the press.\n# press_line\nThe press office takes over.'},
      {id: 'queued_add_effect', type: 'add_option_effect', action: 'add_option_effect', fieldId: 'structure_add_option_effect_target_scene', optionId: 'target_scene', targetLabel: 'Continue', value: 'Q.public_order += 3'}
    ]
  },
  entry: {source: 'Design', action: 'edit_existing'}
});
assert(queuedStructureModel.changeState.changedCount === 2, 'existing editor should turn queued structure commands into independent manual-review changes');
assert(queuedStructureModel.changeState.installPlan.operations.some((operation) => operation.type === 'manual_snippet'), 'queued existing add-option commands should stay manual-review snippets');
assert(queuedStructureModel.changeState.installPlan.operations.some((operation) => operation.type === 'insert_text' && operation.safety === 'guarded_apply'), 'queued source-backed option-effect commands should become guarded inserts');
const queuedPreviewHtml = previewEditor.renderPreviewPane(queuedStructureModel);
const queuedEditorHtml = previewEditor.render(queuedStructureModel);
assert(queuedPreviewHtml.includes('Brief the press.'), 'left preview should materialize queued add-option commands');
assert(queuedPreviewHtml.includes('Q.public_order += 3'), 'left preview should materialize queued add-option-effect commands');
assert(queuedEditorHtml.includes('Q.public_order += 3'), 'right editor should keep queued option-effect commands visible after commit');
assert(queuedEditorHtml.includes('Simple source-backed Q effects can be applied automatically after review.'), 'right editor should explain guarded source-backed option effects');
assert(queuedEditorHtml.includes('is-readonly'), 'queued existing structural commands should render as reviewable pending rows rather than disappearing');
assert(queuedEditorHtml.includes('is-pending-addition') && queuedEditorHtml.includes('open'), 'queued existing structural commands should stay expanded as pending additions');
const removalPreviewHtml = previewEditor.renderPreviewPane(canvasModel.buildExistingCanvas(index, 'events', 'generic_intro', {
  values: {structure_remove_option_target_scene: 'true'},
  entry: {source: 'Design', action: 'edit_existing'}
}));
assert(removalPreviewHtml.includes('is-pending-removal'), 'existing option deletion should be visible as a pending removal in the preview');
assert(removalPreviewHtml.includes('Pending manual removal'), 'existing option deletion should be labeled as manual-review removal');
const manyChoicePreviewHtml = previewEditor.renderPreviewPane({
  title: 'Many choices',
  eventBody: {
    title: {id: 'title', label: 'Title', value: 'Many choices', original: 'Many choices'},
    sections: [{id: 'body', label: 'Body', value: 'Pick a path.', original: 'Pick a path.'}],
    options: [1, 2, 3, 4, 5].map((number) => ({
      id: 'choice_' + number,
      label: 'Existing choice ' + number,
      fields: [{id: 'choice_' + number + '_label', label: 'Play', value: 'Existing choice ' + number}]
    })),
    structureActions: [{
      id: 'structure_add_option',
      structureAction: 'add_option',
      inputType: 'textarea',
      value: '- @pending_path: Pending sixth choice\n# pending_path\nA new result appears.'
    }]
  }
});
assert(manyChoicePreviewHtml.includes('Existing choice 5'), 'left preview should no longer hide later existing choices');
assert(manyChoicePreviewHtml.includes('Pending sixth choice'), 'left preview should keep pending new choices visible even after many existing choices');
const pendingEditorHtml = previewEditor.render(pendingStructureModel);
assert(pendingEditorHtml.includes('value="Negotiate settlement."'), 'right editor should keep pending option text editable in the inline builder');
assert(pendingEditorHtml.includes('Public order is under strain.'), 'right editor should keep pending branch text editable in the inline builder');
assert(pendingEditorHtml.includes('value="public_order"'), 'right editor should keep pending effect variable editable in the effect builder');
assert(existing.contextBoard.flow.some((row) => row.direction === 'outgoing'), 'context board should include flow rows');
assert(existing.contextBoard.variables.some((row) => row.name === 'public_order'), 'context board should include related variables');
assert(existing.contextBoard.effects.some((row) => row.variable === 'public_order'), 'context board should include readonly effects');
assert(existing.changeState.changedCount === 2, 'existing model should count changed fields');
assert(existing.changeState.operationSummary.guardedApply === 2, 'existing source-backed text changes should be guarded');
const shellHtml = shellUi.renderShell({
  model: existing,
  surface: {key: 'content_storyboard', label: 'Content Storyboard'},
  state: {workspace: 'content', boardChromeCollapsed: false, status: 'Ready'},
  layoutStyle: '--object-canvas-scale: 1;',
  stageHtml: '<section data-object-canvas-stage="true"></section>',
  bodyHtml: shellUi.renderChangePanel(existing, {translate: (_key, fallback) => fallback}),
  translate: (_key, fallback) => fallback,
  surfaceLabelFor: (surface) => surface && surface.label || ''
});
assert(shellHtml.includes('data-object-authoring-canvas="true"'), 'Object Canvas shell helper should render the stable Canvas marker');
assert(shellHtml.includes('data-authoring-surface="content_storyboard"'), 'Object Canvas shell helper should render the active authoring surface marker');
assert(shellHtml.includes('data-object-canvas-review-plan'), 'Object Canvas shell helper should render review-plan markers');
const savedExistingProposal = {
  schemaVersion: '0.1',
  kind: 'existing_scene_edit',
  id: 'edit_existing_generic_intro',
  title: 'Generic Intro',
  sceneId: 'generic_intro',
  sceneKind: 'event',
  sourcePath: 'source/scenes/events/generic_intro.scene.dry',
  changes: [{
    fieldId: 'generic_intro_body',
    role: 'body',
    source: {path: 'source/scenes/events/generic_intro.scene.dry', line: 6},
    before: 'The campaign office opens to a quiet morning.',
    after: 'The campaign office opens to a saved existing-edit morning.'
  }]
};
const savedExistingCanvas = canvasModel.buildCanvasModel(index, {template: 'existing', draft: savedExistingProposal}, {});
assert(savedExistingCanvas.ok, 'saved existing proposal should reopen through the existing editor path');
assert(savedExistingCanvas.mode === 'existing', 'saved existing proposal should not fall back to a new event canvas');
assert(savedExistingCanvas.changeState.installPlan.draftKind === 'existing_scene_edit', 'saved existing proposal should preserve existing edit install kind');
assert(savedExistingCanvas.changeState.installPlan.operations.length > 0, 'saved existing proposal should keep reviewable source edit operations');
assert(savedExistingCanvas.changeState.installPlan.operations.every((operation) => operation.type !== 'create_file'), 'saved existing proposal must not create an already-existing scene file');
const directExistingCanvas = canvasModel.buildCanvasModel(index, savedExistingProposal, {});
assert(directExistingCanvas.mode === 'existing', 'direct existing_scene_edit inputs should route to the existing editor');
assert(directExistingCanvas.changeState.installPlan.operations.every((operation) => operation.type !== 'create_file'), 'direct existing_scene_edit inputs should not emit create_file operations');

const laborExisting = canvasModel.buildExistingCanvas(index, 'events', 'labor_unrest', {
  values: {},
  entry: {source: 'Design', action: 'edit_existing'}
});
assert(laborExisting.ok, 'Labor Unrest should open in Object Canvas: ' + JSON.stringify(laborExisting.changeState.diagnostics));
assert(laborExisting.eventBody.sections.some((field) => field.semanticRole === 'opening_text'), 'existing event preview should keep opening prose in the main event body');
assert(laborExisting.eventBody.sections.some((field) => field.visualKinds && field.visualKinds.includes('chart')), 'existing event preview should tag rendered charts/tables separately from plain prose');
assert(laborExisting.eventBody.assets.some((asset) => asset.path === 'img/events/dnvp_congress.png'), 'existing event preview should carry referenced assets into the visible editor');
assert(!laborExisting.eventBody.sections.some((field) => String(field.value || '').includes('public concession')), 'option-result prose should not be flattened into the opening preview');
assert(laborExisting.eventBody.options[0].fields.some((field) => field.semanticRole === 'option_result_text' && String(field.value || '').includes('public concession')), 'option-result prose should be attached under the matching option');
assert(laborExisting.eventBody.branchSections.some((field) => field.semanticRole === 'conditional_text' && field.conditions.includes('labor_minister != "SPD"')), 'standalone conditional text should remain in a dedicated branch section');
assert(laborExisting.eventBody.variables.some((variable) => variable.name === 'labor_minister' && variable.reads.length && variable.writes.length), 'existing event editor should surface condition/effect variable reads and writes');
assert(laborExisting.eventBody.backgroundEffects.some((effect) => effect.variable === 'labor_minister' && effect.op === 'writes'), 'existing event editor should include readonly background writes from ProjectIndex variables');
const deleteProposal = deleteProposalModel.buildProposal({
  model: laborExisting,
  projectIndex: index,
  selectedCanvasNode: 'event:labor_unrest',
  view: 'events'
});
const deleteCanvasModel = deleteProposalModel.buildModel({
  proposal: deleteProposal,
  model: laborExisting,
  projectIndex: index,
  installPlanApi,
  translate: (_key, fallback) => fallback
});
assert(deleteProposal.kind === 'existing_scene_delete', 'Object delete helper should build existing_scene_delete proposals');
assert(deleteCanvasModel.changeState.installPlan.operations.length === 1, 'Object delete helper should produce one review operation');
assert(deleteCanvasModel.changeState.installPlan.operations[0].type === 'manual_snippet', 'Object delete helper should keep delete plans as manual snippets');
assert(deleteCanvasModel.changeState.installPlan.operations[0].safety === 'manual_review', 'Object delete helper must keep deletes manual-review only');
assert(deleteCanvasModel.changeState.output.installPlanJson.includes('existing_scene_delete'), 'Object delete helper should render install-plan JSON evidence');
const longOptionLabel = 'Option result: Ban the demonstrations. / It is the fault of corrupt and reactionary elements within the police.';
const compactLabelHtml = previewEditor.render({
  title: 'Long option label fixture',
  eventBody: {
    title: {id: 'title', label: 'Title', value: 'Long option label fixture', original: 'Long option label fixture'},
    sections: [],
    options: [],
    branchSections: [{
      id: 'branch.long_option_result',
      label: longOptionLabel,
      value: 'We issued the order to ban the demonstration.',
      original: 'We issued the order to ban the demonstration.',
      semanticRole: 'option_result_text',
      branchKind: 'option_result',
      relatedOptionLabels: ['Ban the demonstrations.'],
      sectionLabel: 'blutmai.communist_fault',
      status: 'guarded'
    }]
  }
});
assert(compactLabelHtml.includes('<b>Option result</b>'), 'Preview Object Editor should compact generated option-result labels');
assert(!compactLabelHtml.includes('<b>' + longOptionLabel + '</b>'), 'Preview Object Editor should not render long source context as the field label');
assert(compactLabelHtml.includes('After choice: Ban the demonstrations.'), 'Preview Object Editor should keep the option context visible outside the field label');
const compactGraphHtml = graphStage.render({
  title: 'Long option label fixture',
  eventBody: {
    title: {id: 'title', label: 'Title', value: 'Long option label fixture', original: 'Long option label fixture'},
    sections: [],
    options: [{
      id: 'ban',
      label: 'Ban the demonstrations.',
      targetId: 'blutmai.communist_fault',
      fields: [{
        id: 'branch.long_option_result',
        label: longOptionLabel,
        value: 'We issued the order to ban the demonstration.',
        semanticRole: 'option_result_text',
        relatedOptionLabels: ['Ban the demonstrations.'],
        status: 'guarded'
      }]
    }],
    metaFields: []
  },
  changeState: {output: {}}
}, {state: {selectedCanvasNode: 'object'}});
assert(compactGraphHtml.includes('<span title="' + longOptionLabel), 'Object Canvas should retain the full generated label as a tooltip');
assert(compactGraphHtml.includes('>Option result</span>'), 'Object Canvas should render a compact option-result field label');
assert(!compactGraphHtml.includes('>Option result: Ban the demonstrations.'), 'Object Canvas should not expose long option context as a wrapping field label');
const textareaSizingHtml = previewEditor.render({
  title: 'Textarea sizing fixture',
  eventBody: {
    title: {id: 'title', label: 'Title', value: 'Textarea sizing fixture', original: 'Textarea sizing fixture'},
    sections: [{
      id: 'short_body',
      label: 'Opening page text',
      value: '. ?]\n\nEventually...',
      original: '. ?]\n\nEventually.',
      semanticRole: 'opening_text',
      sectionId: 'start',
      status: 'guarded'
    }, {
      id: 'long_body',
      label: 'Opening page text',
      value: [
        '= Uprising in Austria',
        '',
        'The crisis in Austria is continuing. The government led by Engelbert Dollfub continues to rule by emergency decree. It has been persecuting its political opposition, primarily the social democrats of the SDAPO.',
        '',
        'A longer paragraph follows so the editor can grow only a little instead of forcing the author to work through a cramped field or a huge empty block.'
      ].join('\n'),
      original: '',
      semanticRole: 'opening_text',
      sectionId: 'start',
      status: 'guarded'
    }],
    options: []
  }
});
assert(textareaRows(textareaSizingHtml, 'short_body') === 2, 'Preview Object Editor should keep very short textareas compact');
assert(textareaRows(textareaSizingHtml, 'long_body') > 2 && textareaRows(textareaSizingHtml, 'long_body') <= 14, 'Preview Object Editor should let longer textareas grow within a modest cap');

const newEvent = canvasModel.buildNewEventCanvas(index, {
  id: 'generic_intro_followup',
  title: 'Follow-up: Generic Intro',
  heading: 'Follow-up: Generic Intro',
  year: 1936,
  monthStart: 2,
  monthEnd: 4,
  options: [
    {id: 'accept', title: 'Accept the risk', body: 'The campaign accepts the risk.'},
    {id: 'delay', title: 'Delay the decision', body: 'The campaign waits another week.'}
  ]
}, {
  values: {
    'event.title': 'Follow-up: Campaign Office',
    'event.intro': 'A new question arrives at the campaign office.',
    'event.effect.add.variable': 'public_order',
    'event.effect.add.op': '+=',
    'event.effect.add.value': '2',
    'option.0.label': 'Accept the public risk',
    'option.0.chooseIf': 'public_order >= 0',
    'option.0.effect.add.variable': 'public_order',
    'option.0.effect.add.op': '+=',
    'option.0.effect.add.value': '1'
  },
  seed: {source: 'Design', raw: current}
});

assert(newEvent.ok, 'new Event should open in Object Canvas: ' + JSON.stringify(newEvent.changeState.diagnostics));
assert(newEvent.mode === 'new_event', 'new model should use new_event mode');
assert(newEvent.eventBody.title.value === 'Follow-up: Campaign Office', 'new title should reflect inline values');
assert(newEvent.eventBody.sections[0].value.includes('new question'), 'new body should reflect inline values');
assert(newEvent.eventBody.options[0].fields.some((field) => field.value === 'Accept the public risk'), 'new options should reflect inline values');
assert(newEvent.eventBody.options[0].fields.some((field) => field.id === 'option.0.chooseIf' && field.value === 'public_order >= 0'), 'new options should expose editable choose-if conditions');
assert(newEvent.eventBody.effects.some((field) => field.id === 'event.effect.0.variable' && field.value === 'public_order'), 'new Event should expose trigger effect fields');
assert(newEvent.eventBody.optionEffects[0].fields.some((field) => field.id === 'option.0.effect.0.value' && field.value === '1'), 'new Event should expose option effect fields');
assert(newEvent.eventBody.eventStructure && newEvent.eventBody.eventStructure.provenance === 'draft', 'new Event editor body should be derived through EventStructure');
assert(newEvent.eventBody.structureActions.some((field) => field.structureAction === 'add_option'), 'new Event should expose EventStructure add-option controls');
assert(newEvent.eventBody.structureActions.some((field) => field.structureAction === 'add_branch'), 'new Event should expose EventStructure add-section controls');
const newEventHtml = previewEditor.render(newEvent);
assert(newEventHtml.includes('data-preview-object-condition-chips="true"') && newEventHtml.includes('public_order &gt;= 0'), 'new Event editor should render option conditions as scan-friendly chips');
assert(newEventHtml.includes('Updates the current draft.'), 'new Event structural creators should clearly show draft-update safety');
assert(newEvent.changeState.draft.effectsOnTrigger.some((effect) => effect.variable === 'public_order' && effect.value === 2), 'trigger effect edits should update the draft');
assert(newEvent.changeState.draft.options[0].effects.some((effect) => effect.variable === 'public_order' && effect.value === 1), 'option effect edits should update the draft');
assert(newEvent.contextBoard.flow.some((row) => row.direction === 'seed'), 'new Event context should include Design/Create seed context');
assert(newEvent.contextBoard.manualBoundaries.some((row) => row.label === 'Router wiring'), 'new Event should keep router wiring as manual-review context');
assert(newEvent.changeState.draft.kind === 'world_event', 'new Event draft should be a world_event draft');
assert(newEvent.changeState.output.installPlan, 'new Event should produce an install plan');
assert(newEvent.changeState.operationSummary.total > 0, 'new Event install plan should summarize operations');

const structureEvent = canvasModel.buildNewEventCanvas(index, {
  id: 'structured_new_event',
  title: 'Structured new event',
  heading: 'Structured new event',
  year: 1936,
  monthStart: 2,
  monthEnd: 4,
  options: [
    {id: 'stay', title: 'Stay', body: 'Stay here.'},
    {id: 'leave', title: 'Leave', body: 'Leave now.'}
  ]
}, {
  values: {
    structure_add_option: '- @third_path: Try a third path.\n# third_path\nThe third path opens.',
    structure_add_branch: '# follow_up\n[? if public_order >= 1 : The follow-up layer is visible. ?]',
    structure_add_trigger_effect: 'Q.public_order += 1',
    structure_add_option_effect_stay: 'Q.public_order += 2'
  }
});
assert(structureEvent.ok, 'structured new Event should remain valid: ' + JSON.stringify(structureEvent.changeState.diagnostics));
assert(structureEvent.changeState.draft.options.length === 3, 'EventStructure add-option command should write back to the draft options');
assert(structureEvent.changeState.draft.sections.length === 1, 'EventStructure add-section command should upgrade the draft to a composite event');
assert(structureEvent.changeState.output.scene.includes('@follow_up'), 'composite EventDraft should render the new follow-up anchor');
assert(structureEvent.changeState.output.scene.includes('- @third_path: Try a third path.'), 'composite EventDraft should render the new option line');
assert(structureEvent.changeState.output.scene.includes('Q.public_order += 1;'), 'EventStructure trigger effect command should render into the scene');

const queuedNewEvent = canvasModel.buildNewEventCanvas(index, {
  id: 'queued_new_event',
  title: 'Queued new event',
  heading: 'Queued new event',
  year: 1936,
  monthStart: 2,
  monthEnd: 4,
  options: [
    {id: 'stay', title: 'Stay', body: 'Stay here.'},
    {id: 'leave', title: 'Leave', body: 'Leave now.'}
  ]
}, {
  values: {
    __structureCommands: [
      {id: 'queued_option_1', type: 'add_option', action: 'add_option', value: '- @third_path: Third path\n# third_path\nThe third path opens.'},
      {id: 'queued_option_2', type: 'add_option', action: 'add_option', value: '- @fourth_path: Fourth path\n# fourth_path\nThe fourth path opens.'},
      {id: 'queued_effect_1', type: 'add_option_effect', action: 'add_option_effect', optionId: 'stay', value: 'Q.public_order += 1'},
      {id: 'queued_effect_2', type: 'add_option_effect', action: 'add_option_effect', optionId: 'stay', value: 'Q.public_order += 2'}
    ]
  }
});
assert(queuedNewEvent.ok, 'queued new Event should remain valid: ' + JSON.stringify(queuedNewEvent.changeState.diagnostics));
assert(queuedNewEvent.changeState.draft.options.length === 4, 'queued add-option commands should allow consecutive new choices');
assert(queuedNewEvent.changeState.draft.options[0].effects.length === 2, 'queued option-effect commands should allow multiple effects on the same option');
assert(queuedNewEvent.changeState.changedCount === 4, 'queued new Event should count each structure command as an individual change');

const removedStructure = eventStructureModel.applyCommand(
  eventStructureModel.fromDraft(structureEvent.changeState.draft),
  {type: 'remove_option', optionId: 'third_path'}
);
const removedDraft = eventStructureModel.toDraft(removedStructure, structureEvent.changeState.draft);
assert(removedDraft.options.length === 2 && !removedDraft.options.some((option) => option.id === 'third_path'), 'EventStructure remove-option command should preserve a valid two-option draft');

const compositeNewEvent = canvasModel.buildNewEventCanvas(index, {
  id: 'composite_new_event',
  title: 'Composite new event',
  heading: 'Composite new event',
  when: {year: 1936, monthStart: 2, monthEnd: 4},
  options: [
    {id: 'stay', label: 'Stay', narrativeParagraphs: ['Stay here.']},
    {id: 'leave', label: 'Leave', narrativeParagraphs: ['Leave now.']}
  ],
  sections: [{
    id: 'follow_up',
    title: 'Follow-up layer',
    paragraphs: ['Nested setup.'],
    options: [{
      id: 'nested_choice',
      label: 'Nested choice',
      narrativeParagraphs: ['Nested result.'],
      effects: [{variable: 'public_order', op: '+=', value: 1}]
    }]
  }]
}, {
  values: {
    'event.section.0.body': 'Nested setup with a clearer cue.',
    'option.2.label': 'Nested choice edited',
    'option.2.effect.0.value': '3',
    structure_add_option_effect_nested_choice: 'Q.public_order += 4'
  }
});
assert(compositeNewEvent.ok, 'composite new Event should remain valid: ' + JSON.stringify(compositeNewEvent.changeState.diagnostics));
assert(compositeNewEvent.eventBody.options.some((option) => option.sectionId === 'follow_up' && option.label === 'Nested choice edited'), 'section-owned options should render in the unified Event editor');
assert(compositeNewEvent.eventBody.structureActions.some((field) => field.id === 'structure_add_option_effect_nested_choice'), 'section-owned options should expose effect creation controls');
assert(compositeNewEvent.changeState.draft.sections[0].paragraphs[0] === 'Nested setup with a clearer cue.', 'section body edits should write back through EventStructure');
assert(compositeNewEvent.changeState.draft.sections[0].options[0].label === 'Nested choice edited', 'section-owned option edits should write back through EventStructure');
assert(compositeNewEvent.changeState.draft.sections[0].options[0].effects.length === 2, 'adding an effect to a section-owned option should not duplicate through the flattened structure list');
assert(compositeNewEvent.changeState.draft.sections[0].options[0].effects.some((effect) => effect.variable === 'public_order' && effect.value === 3), 'section-owned option effect edits should update existing effects');
assert(compositeNewEvent.changeState.draft.sections[0].options[0].effects.some((effect) => effect.variable === 'public_order' && effect.value === 4), 'section-owned option effect additions should write back to the nested draft option');

const sectionOptionNewEvent = canvasModel.buildNewEventCanvas(index, {
  id: 'section_option_new_event',
  title: 'Section option new event',
  heading: 'Section option new event',
  when: {year: 1936, monthStart: 2, monthEnd: 4},
  options: [
    {id: 'one', label: 'One', narrativeParagraphs: ['One result.']},
    {id: 'two', label: 'Two', narrativeParagraphs: ['Two result.']},
    {id: 'three', label: 'Three', narrativeParagraphs: ['Three result.']},
    {id: 'four', label: 'Four', narrativeParagraphs: ['Four result.']}
  ],
  sections: [{
    id: 'follow_up',
    title: 'Follow-up layer',
    paragraphs: ['Nested setup.'],
    options: []
  }]
}, {
  values: {
    __structureCommands: [
      {id: 'queued_nested_a', type: 'add_option', action: 'add_option', sectionId: 'follow_up', value: '- @nested_a: Nested A\n# nested_a\nchoose-if: public_order >= 1\nunavailable-subtitle: Public order is too low.\nNested A result.'},
      {id: 'queued_nested_b', type: 'add_option', action: 'add_option', sectionId: 'follow_up', value: '- @nested_b: Nested B\n# nested_b\nNested B result.'},
      {id: 'queued_nested_effect', type: 'add_option_effect', action: 'add_option_effect', optionId: 'nested_a', value: 'Q.public_order += 2'}
    ]
  }
});
assert(sectionOptionNewEvent.ok, 'section-owned option creation should keep a four-root-option draft valid: ' + JSON.stringify(sectionOptionNewEvent.changeState.diagnostics));
assert(sectionOptionNewEvent.changeState.draft.options.length === 4, 'section-owned option creation should not bypass root option count by adding root choices');
assert(sectionOptionNewEvent.changeState.draft.sections[0].options.length === 2, 'section-owned add-option commands should write into the target section');
assert(sectionOptionNewEvent.changeState.draft.sections[0].options[0].chooseIf === 'public_order >= 1', 'section-owned add-option should preserve choose-if');
assert(sectionOptionNewEvent.changeState.draft.sections[0].options[0].unavailableText === 'Public order is too low.', 'section-owned add-option should preserve unavailable text');
assert(sectionOptionNewEvent.changeState.draft.sections[0].options[0].effects.some((effect) => effect.variable === 'public_order' && effect.value === 2), 'newly added section-owned options should accept follow-up effects');
assert(sectionOptionNewEvent.changeState.output.scene.includes('choose-if: public_order >= 1'), 'section-owned add-option should render choose-if into scene output');
assert(sectionOptionNewEvent.changeState.output.scene.includes('unavailable-subtitle: Public order is too low.'), 'section-owned add-option should render unavailable-subtitle into scene output');
const removedNestedStructure = eventStructureModel.applyCommand(
  eventStructureModel.fromDraft(sectionOptionNewEvent.changeState.draft),
  {type: 'remove_option', optionId: 'nested_b'}
);
const removedNestedDraft = eventStructureModel.toDraft(removedNestedStructure, sectionOptionNewEvent.changeState.draft);
assert(removedNestedDraft.sections[0].options.length === 1 && removedNestedDraft.sections[0].options[0].id === 'nested_a', 'section-owned remove-option should remove only the targeted nested option');

process.stdout.write(JSON.stringify({
  ok: true,
  existingMode: existing.mode,
  newMode: newEvent.mode,
  existingChanges: existing.changeState.changedCount,
  newOperations: newEvent.changeState.operationSummary.total
}, null, 2) + '\n');
