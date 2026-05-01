#!/usr/bin/env node
'use strict';

const existingEdit = require('./authoring/existing_scene_edit_model.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function syntheticIndex() {
  const eventScene = {
    id: 'all_quiet',
    title: 'All Quiet on the Western Front',
    path: 'source/scenes/events/all_quiet.scene.dry',
    type: 'card',
    tags: ['event'],
    flags: {isCard: true, isPinnedCard: false},
    viewIf: 'year = 1930 and month >= 1 and month <= 4 and all_quiet_seen = 0',
    priority: '1',
    options: [
      {target: {id: 'ban'}, title: 'Ban the film——Censor the screening.'},
      {target: {id: 'permit'}, title: 'Permit it——Let the controversy breathe.'},
      {target: {id: 'ignore'}, title: 'Ignore it.'},
      {target: {id: 'debate'}, title: 'Hold a debate.'}
    ],
    assetRefs: [{path: 'img/events/all_quiet.png', type: 'image', label: 'All Quiet poster', role: 'event_illustration'}],
    sourceSpan: {path: 'source/scenes/events/all_quiet.scene.dry', startLine: 1, endLine: 80},
    metadata: {
      viewIf: {path: 'source/scenes/events/all_quiet.scene.dry', line: 3}
    }
  };
  const cardScene = {
    id: 'agricultural_policy',
    title: 'Agricultural Policy',
    path: 'source/scenes/government_affairs/agricultural_policy.scene.dry',
    type: 'card',
    tags: ['government_affairs'],
    flags: {isCard: true, isPinnedCard: false},
    viewIf: 'agriculture_unlocked = 1',
    priority: '0',
    frequency: '150',
    maxVisits: '1',
    options: [
      {target: {id: 'small_farms'}, title: 'Support small farms.'},
      {target: {id: 'cooperatives'}, title: 'Build cooperatives.'},
      {target: {id: 'market'}, title: 'Let markets decide.'},
      {target: {id: 'mechanize'}, title: 'Mechanize agriculture.'},
      {target: {id: 'land_reform'}, title: 'Push land reform.'}
    ],
    assetRefs: [{path: 'img/cards/agriculture.png', type: 'image', label: 'Agriculture card', role: 'card_image'}],
    sourceSpan: {path: 'source/scenes/government_affairs/agricultural_policy.scene.dry', startLine: 1, endLine: 120}
  };
  return {
    schemaVersion: '0.1',
    project: {name: 'Existing Edit Fixture', root: '/tmp/existing-edit-fixture', profileIds: ['sdaah-style']},
    scenes: [eventScene, cardScene],
    variables: [
      {name: 'all_quiet_seen', writes: [{path: eventScene.path, line: 10}]},
      {name: 'public_order', writes: [{path: eventScene.path, line: 31}]}
    ],
    semantic: {
      events: [{id: 'all_quiet', title: eventScene.title, path: eventScene.path, confidence: 'exact'}],
      cards: [{id: 'agricultural_policy', title: cardScene.title, path: cardScene.path, confidence: 'exact'}],
      assets: {items: eventScene.assetRefs.concat(cardScene.assetRefs)},
      textCorpus: {
        items: [
          {
            id: 'all_quiet_title',
            text: 'All Quiet on the Western Front',
            role: 'title',
            editability: 'text_proposal',
            owner: {kind: 'scene', sceneId: 'all_quiet'},
            source: {path: eventScene.path, line: 1}
          },
          {
            id: 'all_quiet_body_1',
            text: 'The film arrives with a silence heavier than the posters.',
            role: 'body',
            editability: 'text_proposal',
            owner: {kind: 'scene', sceneId: 'all_quiet', sectionId: 'start'},
            source: {path: eventScene.path, line: 8}
          },
          {
            id: 'all_quiet_option_ban',
            text: 'Ban the film',
            role: 'option_label',
            editability: 'text_proposal',
            owner: {kind: 'scene', sceneId: 'all_quiet', sectionId: 'start', itemId: 'ban'},
            source: {path: eventScene.path, line: 14}
          },
          {
            id: 'all_quiet_option_ban_subtitle',
            text: 'Censor the screening.',
            role: 'option_subtitle',
            editability: 'text_proposal',
            owner: {kind: 'scene', sceneId: 'all_quiet', sectionId: 'ban', itemId: 'ban'},
            source: {path: eventScene.path, line: 14}
          },
          {
            id: 'all_quiet_ban_body',
            text: 'Police notes thicken into policy.',
            role: 'body',
            editability: 'text_proposal',
            owner: {kind: 'scene', sceneId: 'all_quiet', sectionId: 'ban'},
            source: {path: eventScene.path, line: 22}
          },
          {
            id: 'all_quiet_effect_script',
            text: 'Q.public_order += 1;',
            role: 'script',
            editability: 'ide_escape_hatch',
            owner: {kind: 'scene', sceneId: 'all_quiet', sectionId: 'ban'},
            source: {path: eventScene.path, line: 31}
          },
          {
            id: 'agri_body',
            text: 'The cabinet asks whether farms are a constituency or a country.',
            role: 'body',
            editability: 'text_proposal',
            owner: {kind: 'scene', sceneId: 'agricultural_policy', sectionId: 'start'},
            source: {path: cardScene.path, line: 7}
          },
          {
            id: 'agri_option_5',
            text: 'Push land reform.',
            role: 'option_label',
            editability: 'text_proposal',
            owner: {kind: 'scene', sceneId: 'agricultural_policy', sectionId: 'start', itemId: 'land_reform'},
            source: {path: cardScene.path, line: 30}
          }
        ]
      }
    },
    diagnostics: []
  };
}

const index = syntheticIndex();

const eventModel = existingEdit.buildEditModel(index, 'events', 'all_quiet');
assert(eventModel.ok, 'event edit model should build: ' + JSON.stringify(eventModel.diagnostics));
assert(eventModel.kind === 'existing_scene_edit_model', 'event edit model should expose model kind');
assert(eventModel.sceneId === 'all_quiet', 'event edit model should keep scene id');
assert(eventModel.sceneKind === 'event', 'event edit model should classify events');
assert(eventModel.source.path === 'source/scenes/events/all_quiet.scene.dry', 'event edit model should keep source path');
assert(eventModel.fields.some((field) => field.role === 'body' && field.original.includes('film arrives')), 'event model should expose body prose');
assert(eventModel.fields.some((field) => field.role === 'option_label' && field.original === 'Ban the film'), 'event model should expose option label text');
const eventChainField = eventModel.fields.find((field) => field.role === 'condition' && field.id === 'metadata_viewIf');
assert(eventChainField, 'event model should expose source-backed view-if as an editable event-chain field');
assert(eventChainField.source.line === 3, 'event-chain field should keep exact view-if source line');
assert(eventChainField.editability === 'guarded_replace_text', 'event-chain field with exact non-router line should be guarded');
assert(eventModel.options.length === 4, 'event model should preserve all event options');
assert(eventModel.effects.length >= 1, 'event model should expose read-only effect summaries');
assert(eventModel.assets.length === 1, 'event model should preserve asset refs');

const eventProposal = existingEdit.buildProposal(eventModel, {
  all_quiet_body_1: 'The film arrives with a public silence heavier than the posters.',
  all_quiet_option_ban: 'Ban public screenings',
  metadata_viewIf: 'year = 1930 and month >= 1 and month <= 4 and all_quiet_seen = 0 and film_debate_unlocked = 1'
});
assert(eventProposal.kind === 'existing_scene_edit', 'proposal should use existing_scene_edit kind');
assert(eventProposal.changes.length === 3, 'proposal should contain only changed fields');
assert(eventProposal.changes.every((change) => change.source && change.source.path === eventModel.source.path), 'changes should keep source evidence');
assert(eventProposal.changeSummary.textFields === 2, 'change summary should count text changes');
assert(eventProposal.changeSummary.metadataFields === 1, 'change summary should count event-chain condition changes');

const bundle = existingEdit.buildExportBundle(eventProposal, index);
assert(bundle.installPlan, 'existing scene edit bundle should include install plan');
assert(bundle.installPlan.draftKind === 'existing_scene_edit', 'install plan draftKind should be existing_scene_edit');
assert(bundle.installPlan.operations.every((op) => op.type === 'replace_text'), 'source-backed changed fields should use replace_text operations');
assert(bundle.installPlan.operations.every((op) => op.safety === 'guarded_apply'), 'source-backed changed fields should be guarded apply');
assert(bundle.installPlan.operations.some((op) => op.line === 3 && op.search === eventChainField.original && op.replace.includes('film_debate_unlocked')), 'event-chain condition edit should become a guarded exact-line replace_text operation');
assert(bundle.previewText.includes('Modify existing Event'), 'bundle preview text should explain that this modifies an existing event');
assert(bundle.proposalText.includes('Before:'), 'bundle proposal text should include before text');
assert(bundle.proposalText.includes('After:'), 'bundle proposal text should include after text');

const unchangedProposal = existingEdit.buildProposal(eventModel, {});
assert(unchangedProposal.changes.length === 0, 'proposal with no edited values should have no changes');
assert(unchangedProposal.diagnostics.some((diag) => diag.code === 'existing_scene_edit.no_changes'), 'no-change proposal should diagnose empty edit');

const cardModel = existingEdit.buildEditModel(index, 'cards', 'agricultural_policy');
assert(cardModel.ok, 'card edit model should build: ' + JSON.stringify(cardModel.diagnostics));
assert(cardModel.sceneKind === 'card', 'card edit model should classify cards');
assert(cardModel.options.length === 5, 'existing card editor must not cap options at four');
assert(cardModel.fields.some((field) => field.id === 'agri_option_5'), 'existing card editor should include the fifth option field');

const manualModel = existingEdit.buildEditModel({
  scenes: [{id: 'protected_router', title: 'Router Scene', sourceSpan: {path: 'source/scenes/post_event.scene.dry', startLine: 12, endLine: 20}}],
  semantic: {textCorpus: {items: [{
    id: 'router_text',
    text: 'Protected router text.',
    role: 'body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'protected_router'},
    source: {path: 'source/scenes/post_event.scene.dry', line: 12}
  }]}}
}, 'events', 'protected_router');
assert(manualModel.fields[0].editability === 'manual_review', 'protected router-backed fields should stay manual review');

console.log(JSON.stringify({
  ok: true,
  eventFields: eventModel.fields.length,
  eventChanges: eventProposal.changes.length,
  cardOptions: cardModel.options.length,
  manualEditability: manualModel.fields[0].editability
}, null, 2));
