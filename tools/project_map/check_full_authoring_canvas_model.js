#!/usr/bin/env node
'use strict';

const canvasModel = require('./authoring/object_authoring_canvas_model.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const index = {
  schemaVersion: '0.1',
  project: {name: 'Full Canvas Fixture', root: '/tmp/full-canvas'},
  scenes: [
    {
      id: 'root',
      title: 'Root',
      path: 'source/scenes/root.scene.dry',
      type: 'event',
      sourceSpan: {path: 'source/scenes/root.scene.dry', startLine: 1, endLine: 40}
    },
    {
      id: 'main',
      title: 'Workspace Hand',
      path: 'source/scenes/main.scene.dry',
      type: 'event',
      options: [{target: {id: 'policy_deck'}, title: 'Open policy deck'}],
      sourceSpan: {path: 'source/scenes/main.scene.dry', startLine: 1, endLine: 60}
    }
  ],
  variables: [
    {name: 'public_order', readCount: 1, writeCount: 1, reads: [], writes: [], tags: ['politics']},
    {name: 'policy_momentum', readCount: 0, writeCount: 0, reads: [], writes: [], tags: ['policy']},
    {name: 'policy_capacity', readCount: 0, writeCount: 0, reads: [], writes: [], tags: ['policy']}
  ],
  semantic: {
    news: {sources: ['source/scenes/post_event_news.scene.dry'], items: []},
    hands: [{id: 'main', title: 'Workspace Hand', path: 'source/scenes/main.scene.dry'}],
    textCorpus: {items: []}
  }
};

const templates = [
  'event',
  'news',
  'card',
  'surface',
  'entry',
  'play_surface',
  'workspace_layout',
  'sidebar_status',
  'project',
  'variables'
];

const editedValues = {
  event: {'event.title': 'Edited Event', 'event.intro': 'Edited event text.', 'option.0.label': 'Take the edited path'},
  news: {'news.headline': 'Edited headline', 'news.description': 'Edited news description.'},
  card: {'card.title': 'Edited Card', 'card.intro': 'Edited card body.', 'card.option.0.label': 'Use the card'},
  surface: {'surface.replacementLabel': 'Edited replacement text', 'surface.reason': 'Needs clearer wording.'},
  entry: {'entry.rootTitle': 'Edited Start', 'entry.firstOptionTitle': 'Begin edited route'},
  play_surface: {'play.title': 'Edited Play Surface', 'play.handBody': 'Edited hand body.'},
  workspace_layout: {'layout.deckTitle': 'Edited Policy Deck', 'layout.handOptionLabel': 'Open edited policy deck'},
  sidebar_status: {'sidebar.sectionHeading': 'Edited Status', 'sidebar.sectionBody': 'Edited status body.'},
  project: {'project.gameTitle': 'Edited Project Title', 'project.author': 'Studio Tester'},
  variables: {'variables.variableName': 'edited_variable', 'variables.label': 'Edited Variable'}
};

const summary = {};

templates.forEach((template) => {
  const base = canvasModel.defaultDraftForTemplate(index, template);
  const model = canvasModel.buildTemplateCanvas(index, template, base, {
    values: editedValues[template] || {},
    entry: {source: 'Full Canvas Check', action: 'open_template'}
  });
  const diagnostics = model.changeState && model.changeState.diagnostics || [];
  const errors = diagnostics.filter((item) => item.severity === 'error' || item.level === 'error');
  assert(model.ok, template + ' should open in Object Canvas: ' + JSON.stringify(errors));
  assert(model.template === template, template + ' should preserve template identity');
  assert(model.legacy && model.legacy.template === template, template + ' should keep legacy template bridge');
  assert(model.eventBody && model.eventBody.title, template + ' should expose an inline title field');
  assert(Array.isArray(model.eventBody.sections), template + ' should expose a Canvas section list');
  assert(model.changeState && model.changeState.draft, template + ' should expose a draft for My Changes');
  assert(model.changeState.output && model.changeState.output.previewText, template + ' should expose a review preview');
  assert(model.changeState.output.installPlan, template + ' should expose an install plan for Review & Apply');
  assert(model.contextBoard && Array.isArray(model.contextBoard.flow), template + ' should expose context board flow rows');
  assert(canvasModel.templateFromDraft(model.changeState.draft) === template, template + ' draft should round-trip to its Canvas template');
  if (template === 'card') {
    assert(model.changeState.draft.heading === 'Edited Card', 'Card Canvas should keep visible heading in sync when only the title changes');
  }
  summary[template] = {
    title: model.eventBody.title.value,
    operations: model.changeState.operationSummary.total,
    warnings: diagnostics.filter((item) => item.severity === 'warning' || item.level === 'warning').length
  };
});

const existing = canvasModel.buildCanvasModel(index, {template: 'card', draft: canvasModel.defaultDraftForTemplate(index, 'card')}, {});
assert(existing.template === 'card', 'buildCanvasModel should route non-event templates through the full Canvas adapter');

process.stdout.write(JSON.stringify({ok: true, templates: summary}, null, 2) + '\n');
