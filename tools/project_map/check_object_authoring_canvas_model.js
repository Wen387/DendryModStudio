#!/usr/bin/env node
'use strict';

const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
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
const existingPreviewHtml = previewEditor.renderPreviewPane(existing);
assert(existingPreviewHtml.includes('data-object-editing-preview-effects="true"'), 'left preview should render an effects and impact block');
assert(existingPreviewHtml.includes('Q.budget += 1'), 'left preview should show trigger effect impact text');
const existingEditorHtml = previewEditor.render(existing);
assert(existingEditorHtml.includes('Add option and result layer'), 'preview editor should show structural creation controls');
assert(existingEditorHtml.includes('data-preview-object-creation-grid="true"'), 'preview editor should group structural controls in a creation grid');
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
assert(newEvent.changeState.draft.effectsOnTrigger.some((effect) => effect.variable === 'public_order' && effect.value === 2), 'trigger effect edits should update the draft');
assert(newEvent.changeState.draft.options[0].effects.some((effect) => effect.variable === 'public_order' && effect.value === 1), 'option effect edits should update the draft');
assert(newEvent.contextBoard.flow.some((row) => row.direction === 'seed'), 'new Event context should include Design/Create seed context');
assert(newEvent.contextBoard.manualBoundaries.some((row) => row.label === 'Router wiring'), 'new Event should keep router wiring as manual-review context');
assert(newEvent.changeState.draft.kind === 'world_event', 'new Event draft should be a world_event draft');
assert(newEvent.changeState.output.installPlan, 'new Event should produce an install plan');
assert(newEvent.changeState.operationSummary.total > 0, 'new Event install plan should summarize operations');

process.stdout.write(JSON.stringify({
  ok: true,
  existingMode: existing.mode,
  newMode: newEvent.mode,
  existingChanges: existing.changeState.changedCount,
  newOperations: newEvent.changeState.operationSummary.total
}, null, 2) + '\n');
