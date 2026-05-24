#!/usr/bin/env node
'use strict';

const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const eventDraft = require('./authoring/event_draft.js');
const previewEditor = require('./viewer/preview_object_editor.js');

const {fail, assert} = require('./check_harness.js');

const effects = [
  ['economic_expansion', '=', 0],
  ['capital_strike_progress', '-=', 2, 'capital_strike_progress >= 2'],
  ['budget', '+=', 1],
  ['inflation', '+=', 3],
  ['unemployed', '-=', 2],
  ['workers_nsdap', '-=', 10],
  ['new_middle_nsdap', '-=', 10],
  ['old_middle_nsdap', '-=', 10],
  ['rural_nsdap', '-=', 10],
  ['sa_strength', '=', 'sa_strength/2'],
  ['capitalist_support', '+=', 5],
  ['trade_union_power', '+=', 2],
  ['business_confidence', '+=', 4],
  ['spd_support', '+=', 1],
  ['kpd_support', '-=', 1],
  ['tax_revenue', '+=', 3],
  ['public_order', '+=', 1],
  ['housing_pressure', '+=', 2],
  ['exports', '+=', 1],
  ['imports', '+=', 1],
  ['consumer_confidence', '+=', 2],
  ['industrial_output', '+=', 3],
  ['coalition_stability', '+=', 1]
].map((row) => ({variable: row[0], op: row[1], value: row[2], condition: row[3] || '', hook: 'on-arrival'}));

const index = {
  schemaVersion: '0.1',
  project: {name: 'Parsed Fixture', root: '/tmp/dms-parsed-parity', profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry'}],
  scenes: [{
    id: 'economic_expansion',
    title: 'Economic Expansion',
    subtitle: 'The economy is growing steadily.',
    path: 'source/scenes/events/economic_expansion.scene.dry',
    tags: ['event'],
    newPage: true,
    viewIf: 'economic_expansion >= 85 and unemployed <= 6 and inflation <= 6 and spd_in_government',
    effects
  }, {
    id: 'post_event',
    title: 'Post Event',
    path: 'source/scenes/post_event.scene.dry'
  }],
  semantic: {
    textCorpus: {
      items: [
        {id: 'economic_expansion.heading', owner: {kind: 'scene', sceneId: 'economic_expansion'}, role: 'heading', text: 'Economic Expansion'},
        {id: 'economic_expansion.subtitle', owner: {kind: 'scene', sceneId: 'economic_expansion'}, role: 'subtitle', text: 'The economy is growing steadily.'},
        {
          id: 'economic_expansion.body',
          owner: {kind: 'scene', sceneId: 'economic_expansion'},
          role: 'body',
          text: 'The German economy has been growing steadily for an extended period of time, and has low inflation and unemployment.'
        },
        {id: 'economic_expansion.tags', owner: {kind: 'scene', sceneId: 'economic_expansion'}, role: 'metadata', text: 'event'},
        {id: 'economic_expansion.new_page', owner: {kind: 'scene', sceneId: 'economic_expansion'}, role: 'metadata', text: 'true'}
      ]
    }
  },
  variables: effects.map((effect) => ({name: effect.variable}))
};

const draft = eventDraft.fromExistingScene(index, 'economic_expansion', {newId: 'economic_expansion_variant'});
const model = canvasModel.buildNewEventCanvas(index, draft, {});
const scene = eventDraft.renderSceneDry(draft, index);
const existingModel = canvasModel.buildCanvasModel(index, {mode: 'existing', view: 'events', item: {id: 'economic_expansion', title: 'Economic Expansion'}}, {});
const previewHtml = previewEditor.renderPreviewPane(existingModel);

assert(draft.eventShape === 'pure_event', 'parsed no-choice event should become pure_event draft', draft);
assert(draft.id === 'economic_expansion_variant', 'parsed-to-draft should create a new event id', draft);
assert(draft.title === 'Economic Expansion', 'title should survive parsed-to-draft', draft);
assert(draft.subtitle === 'The economy is growing steadily.', 'subtitle should survive parsed-to-draft', draft);
assert(draft.newPage === true, 'new-page metadata should survive parsed-to-draft', draft);
assert(draft.tags.length === 1 && draft.tags[0] === 'event', 'tags should survive parsed-to-draft', draft);
assert(draft.rawViewIf === 'economic_expansion >= 85 and unemployed <= 6 and inflation <= 6 and spd_in_government', 'raw view-if should survive parsed-to-draft', draft);
assert(draft.introParagraphs[0].includes('German economy'), 'body prose should survive parsed-to-draft', draft);
assert(draft.effectsOnTrigger.length === 23, 'all parsed trigger effects should survive parsed-to-draft', draft.effectsOnTrigger);
assert(draft.effectsOnTrigger.some((effect) => effect.variable === 'sa_strength' && effect.value === 'sa_strength/2'), 'expression effect values should survive parsed-to-draft', draft.effectsOnTrigger);
assert(model.eventBody.options.length === 0, 'parsed pure event draft should not gain fake choices', model.eventBody.options);
assert(scene.includes('Q.sa_strength = sa_strength/2;'), 'expression effect should render as source expression');
assert(!scene.includes('is-card: true'), 'parsed pure event source should not force is-card');
assert(!scene.includes('- @option_'), 'parsed pure event source should not include fake options');
assert(!previewHtml.includes('STUDIO 文本類型 NEW PAGE') && !previewHtml.includes('STUDIO text type NEW PAGE'), 'metadata should not be rendered as player preview body');
assert(!previewHtml.includes('This event has no player choices.') || !previewHtml.includes('No options found for this object.'), 'existing pure event preview should not treat no choices as a parser defect');

process.stdout.write(JSON.stringify({
  ok: true,
  effects: draft.effectsOnTrigger.length,
  options: model.eventBody.options.length,
  operations: model.changeState.installPlan.operations.length
}, null, 2) + '\n');
