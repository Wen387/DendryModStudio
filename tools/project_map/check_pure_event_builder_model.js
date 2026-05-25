#!/usr/bin/env node
'use strict';

const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const eventDraft = require('./authoring/event_draft.js');
const previewEditor = require('./viewer/preview_object_editor.js');

const {fail, assert} = require('./check_harness.js');

const index = {
  schemaVersion: '0.1',
  project: {name: 'Pure Event Fixture', root: '/tmp/dms-pure-event', profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry'}],
  scenes: [{
    id: 'post_event',
    title: 'Post Event',
    path: 'source/scenes/post_event.scene.dry',
    options: [{
      target: {id: 'root'},
      title: 'Continue',
      sourceSpan: {
        path: 'source/scenes/post_event.scene.dry',
        line: 28,
        anchorText: '- @root: Continue',
        endAnchorText: '- @root: Continue'
      }
    }]
  }],
  variables: [{name: 'economic_expansion'}, {name: 'budget'}]
};

const draft = {
  schemaVersion: '0.1',
  kind: 'world_event',
  eventShape: 'pure_event',
  id: 'pure_text_event',
  title: 'Pure text event',
  subtitle: 'A no-choice event',
  heading: 'Pure text event',
  tags: ['event'],
  newPage: true,
  rawViewIf: 'economic_expansion >= 85 and budget >= 0',
  useSeenFlag: false,
  when: {year: 1936, monthStart: 1, monthEnd: 12, requires: '', priority: 0},
  introParagraphs: ['This event is only text and trigger effects.'],
  effectsOnTrigger: [
    {variable: 'economic_expansion', op: '=', value: 0},
    {variable: 'budget', op: '+=', value: 1}
  ],
  options: []
};

const validation = eventDraft.validateDraft(draft, index);
const model = canvasModel.buildNewEventCanvas(index, draft, {});
const scene = eventDraft.renderSceneDry(draft, index);
const html = previewEditor.render(model);
const operations = model.changeState.installPlan && model.changeState.installPlan.operations || [];

assert(validation.ok, 'pure event draft should validate without root choices', validation.diagnostics);
assert(model.ok, 'pure event should build in Object Canvas', model.changeState.diagnostics);
assert(model.eventBody.eventShape === 'pure_event', 'Object Canvas should preserve pure_event shape', model.eventBody);
assert(model.eventBody.options.length === 0, 'pure event builder must not inject fake options', model.eventBody.options);
assert(model.eventBody.readinessChecklist.every((row) => row.ok), 'pure event readiness should pass without root options/routes', model.eventBody.readinessChecklist);
assert(scene.includes('title: Pure text event'), 'rendered scene should include title');
assert(scene.includes('subtitle: A no-choice event'), 'rendered scene should include subtitle');
assert(scene.includes('tags: event'), 'rendered scene should include pure event tags');
assert(scene.includes('view-if: economic_expansion >= 85 and budget >= 0'), 'rendered scene should keep raw appearance condition');
assert(!scene.includes('is-card: true'), 'pure event output must not force is-card');
assert(!scene.includes('- @option_'), 'pure event output must not include fake option anchors');
assert(!scene.includes('Q.pure_text_event_seen'), 'pure event output should not add seen flag by default');
assert(operations.some((op) => op.id === 'create_scene'), 'install plan should create the scene file', operations);
assert(operations.some((op) => op.id === 'event_router_registration'), 'known profile should still produce router registration', operations);
assert(!operations.some((op) => op.id === 'root_seen_flag' || op.id === 'post_event_migration'), 'pure event should not generate seen-flag operations by default', operations);
assert(!operations.some((op) => op.type === 'manual_snippet'), 'pure event path should not produce visible manual snippets', operations);
assert(html.includes('data-event-archetype="pure_event"'), 'pure event UI should expose text-event archetype marker');
assert(html.includes('This event has no player choices.'), 'pure event UI should not show missing-options as a defect');

process.stdout.write(JSON.stringify({
  ok: true,
  options: model.eventBody.options.length,
  readiness: model.eventBody.readinessChecklist.length,
  operations: operations.length
}, null, 2) + '\n');
