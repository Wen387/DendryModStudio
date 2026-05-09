#!/usr/bin/env node
'use strict';

const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const eventStructureModel = require('./authoring/event_structure_model.js');
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
const existingEditorHtml = previewEditor.render(existing);
assert(existingEditorHtml.includes('data-preview-object-structure-builder="add_option"'), 'preview editor should show structured add-option controls');
assert(existingEditorHtml.includes('New player option'), 'preview editor should present add-option as a creator form instead of a raw snippet');
assert(existingEditorHtml.includes('data-preview-object-structure-builder="add_trigger_effect"'), 'preview editor should show structured trigger-effect controls');
assert(existingEditorHtml.includes('data-preview-object-inline-add="add_option"'), 'preview editor should place structural add controls at the end of the relevant object category');
assert(!existingEditorHtml.includes('preview-object-structure-workbench'), 'preview editor should not isolate structural controls in a separate workbench');
const pendingStructureValues = {
  structure_add_option: '- @negotiate: Negotiate settlement.\n# negotiate\nThe committee spends [+ public_order +] legitimacy.',
  structure_add_branch: '# late_warning\n[? if Q.public_order >= 2 : Public order is under strain. ?]',
  structure_add_trigger_effect: 'Q.public_order += 2',
  structure_add_option_effect_target_scene: 'Q.public_order -= 1 if Q.flag'
};
const pendingStructureModel = canvasModel.buildExistingCanvas(index, 'events', 'generic_intro', {
  values: pendingStructureValues,
  entry: {source: 'Design', action: 'edit_existing'}
});
const pendingPreviewHtml = previewEditor.renderPreviewPane(pendingStructureModel);
assert(pendingStructureModel.changeState.changedCount === 4, 'existing editor should collect add-option, add-branch, trigger-effect, and option-effect proposals');
assert(pendingStructureModel.changeState.installPlan.operations.every((operation) => operation.type === 'manual_snippet'), 'new structural proposals for existing events should remain manual-review snippets');
assert(pendingPreviewHtml.includes('Negotiate settlement.'), 'left preview should materialize a pending new player option');
assert(pendingPreviewHtml.includes('The committee spends') && pendingPreviewHtml.includes('Q.public_order'), 'left preview should show pending option result text and consumed variables');
assert(pendingPreviewHtml.includes('Public order is under strain.'), 'left preview should materialize pending branch/follow-up text');
assert(pendingPreviewHtml.includes('Q.public_order += 2'), 'left preview should show pending trigger effect changes');
assert(pendingPreviewHtml.includes('Q.public_order -= 1 if Q.flag'), 'left preview should show pending option effect changes');
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

process.stdout.write(JSON.stringify({
  ok: true,
  existingMode: existing.mode,
  newMode: newEvent.mode,
  existingChanges: existing.changeState.changedCount,
  newOperations: newEvent.changeState.operationSummary.total
}, null, 2) + '\n');
