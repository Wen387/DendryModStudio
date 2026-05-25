#!/usr/bin/env node
'use strict';

const editingContext = require('./authoring/editing_context_model.js');

const {fail, assert} = require('./check_harness.js');

function scene(id, overrides) {
  const path = overrides && overrides.path || 'source/scenes/events/' + id + '.scene.dry';
  return Object.assign({
    id,
    title: id.replace(/_/g, ' '),
    path,
    type: 'event',
    flags: {isCard: false},
    viewIf: 'year = 1930 and month >= 1 and month <= 4',
    options: [
      {target: {id: 'target_scene'}, title: 'Follow the lead——Open the next scene.'}
    ],
    sourceSpan: {path, startLine: 1, endLine: 80},
    metadata: {viewIf: {path, line: 3}},
    assetRefs: [{path: 'img/events/' + id + '.png', role: 'illustration', label: 'Event art'}]
  }, overrides || {});
}

const current = scene('all_quiet', {title: 'All Quiet on the Western Front'});
const intro = scene('generic_intro', {title: 'Generic Intro'});
const target = scene('target_scene', {title: 'Target Scene'});

const index = {
  schemaVersion: '0.1',
  project: {name: 'Editing Context Fixture', root: '/tmp/editing-context'},
  scenes: [intro, current, target],
  edges: [
    {from: 'generic_intro', to: 'all_quiet', kind: 'go_to', label: 'opens', source: {path: intro.path, line: 12}},
    {from: 'all_quiet', to: 'target_scene', kind: 'go_to', label: 'continues', source: {path: current.path, line: 18}}
  ],
  variables: [
    {
      name: 'public_order',
      readCount: 1,
      writeCount: 1,
      reads: [{path: current.path, line: 9}],
      writes: [{path: current.path, line: 31}],
      tags: ['politics']
    },
    {
      name: 'unrelated',
      reads: [{path: target.path, line: 4}],
      writes: []
    }
  ],
  semantic: {
    events: [{id: current.id, title: current.title, path: current.path}],
    cards: [],
    textCorpus: {
      items: [
        {
          id: 'all_quiet_title',
          text: 'All Quiet on the Western Front',
          role: 'title',
          owner: {kind: 'scene', sceneId: 'all_quiet'},
          source: {path: current.path, line: 1}
        },
        {
          id: 'all_quiet_body',
          text: 'The film arrives with a silence heavier than the posters.',
          role: 'body',
          owner: {kind: 'scene', sceneId: 'all_quiet', sectionId: 'start'},
          source: {path: current.path, line: 8}
        },
        {
          id: 'all_quiet_option',
          text: 'Follow the lead',
          role: 'option_label',
          owner: {kind: 'scene', sceneId: 'all_quiet', sectionId: 'start', itemId: 'target_scene'},
          source: {path: current.path, line: 14}
        },
        {
          id: 'all_quiet_option_subtitle',
          text: 'Open the next scene.',
          role: 'option_subtitle',
          owner: {kind: 'scene', sceneId: 'all_quiet', sectionId: 'start', itemId: 'target_scene'},
          source: {path: current.path, line: 14}
        },
        {
          id: 'all_quiet_effect',
          text: 'Q.public_order += 1;',
          role: 'script',
          owner: {kind: 'scene', sceneId: 'all_quiet', sectionId: 'target_scene'},
          source: {path: current.path, line: 31}
        }
      ]
    }
  }
};

const model = editingContext.buildContextModel(index, 'events', 'all_quiet', {
  values: {
    all_quiet_option: 'Follow the public debate',
    metadata_viewIf: 'year = 1930 and month >= 2 and month <= 4'
  }
});

assert(model.ok, 'context model should build: ' + JSON.stringify(model.diagnostics));
assert(model.kind === 'editing_context_model', 'context model should expose kind');
assert(model.sceneId === 'all_quiet', 'context model should keep scene id');
assert(model.title === 'All Quiet on the Western Front', 'context model should keep title');
assert(model.relationships.incoming.length === 1, 'context should include incoming flow');
assert(model.relationships.outgoing.length === 1, 'context should include outgoing flow');
assert(model.relationships.options.length === 1, 'context should include option targets');
assert(model.editors.pageSections.length >= 1, 'context should expose page section editors');
assert(model.editors.openingSections.some((editor) => editor.semanticRole === 'opening_text'), 'context should classify opening page sections separately');
assert(model.editors.optionText.some((editor) => editor.id === 'all_quiet_option'), 'context should expose option label editor');
assert(model.editors.conditions.some((editor) => editor.id === 'metadata_viewIf'), 'context should expose appearance condition editor');
assert(model.context.variables.some((variable) => variable.name === 'public_order'), 'context should include variables used in this source');
assert(!model.context.variables.some((variable) => variable.name === 'unrelated'), 'context should not include unrelated variables');
assert(model.context.effects.some((effect) => effect.variable === 'public_order'), 'context should show effects as read-only context');
assert(model.context.assets.length === 1, 'context should include asset refs');
assert(model.context.sourceEvidence.length >= 3, 'context should include source evidence rows');
assert(model.graph.nodes.some((node) => node.type === 'current_scene'), 'graph should include current scene node');
assert(model.graph.nodes.some((node) => node.type === 'incoming'), 'graph should include incoming node');
assert(model.graph.nodes.some((node) => node.type === 'outgoing'), 'graph should include outgoing node');
assert(model.graph.nodes.some((node) => node.type === 'option_text'), 'graph should include editable option node');
assert(model.operationSummary.total === 2, 'changed fields should produce install operations');
assert(model.operationSummary.guardedApply === 2, 'changed source-backed fields should be guarded');
assert(model.proposal.changes.length === 2, 'proposal should contain edited values only');

const values = editingContext.proposalValues(model.proposal);
assert(values.all_quiet_option === 'Follow the public debate', 'proposal values should preserve text changes');
assert(values.metadata_viewIf.includes('month >= 2'), 'proposal values should preserve condition changes');

const reloaded = editingContext.buildContextFromProposal(index, model.proposal);
assert(reloaded.ok, 'context should rebuild from saved proposal');
assert(reloaded.proposal.changes.length === 2, 'reloaded proposal should keep changes');

const missing = editingContext.buildContextModel(index, 'events', 'missing_scene');
assert(!missing.ok, 'missing scene should return non-ok context');
assert(missing.diagnostics.some((diag) => diag.code === 'editing_context.not_editable'), 'missing context should explain not editable');

process.stdout.write(JSON.stringify({
  ok: true,
  nodes: model.graph.nodes.length,
  editors: model.editors.all.length,
  operations: model.operationSummary.total
}, null, 2) + '\n');
