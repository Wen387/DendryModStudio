#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const eventStructureModel = require('./authoring/event_structure_model.js');
const eventWorkbench = require('./authoring/event_workbench_model.js');
const ownershipMatching = require('./authoring/ownership_matching_model.js');
const installPlanApi = require('./authoring/install_plan.js');
const deleteProposalModel = require('./authoring/object_delete_proposal_model.js');
const shellUi = require('./viewer/object_canvas_shell_ui.js');
const modelBuilder = require('./viewer/object_canvas_model_builder.js');
const storyboardDrafts = require('./viewer/object_canvas_storyboard_drafts.js');
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

assert(ownershipMatching.endpointMatches('deport_hitler.force_approach', 'force_approach'), 'ownership matching should bridge qualified and local section ids');
assert(ownershipMatching.endpointMatches('@force_approach', '#force_approach'), 'ownership matching should bridge route sigils');
assert(!ownershipMatching.endpointMatches('deport_hitler.force_approach', 'other_scene.force_approach'), 'ownership matching should not merge different qualified scene owners');
assert(typeof modelBuilder.buildExistingModelFor === 'function', 'Object Canvas model builder should export existing model adapter');
assert(typeof modelBuilder.diagnosticModel === 'function', 'Object Canvas model builder should export diagnostic fallback builder');
assert(typeof storyboardDrafts.createRelatedDraft === 'function', 'Object Canvas Storyboard drafts helper should export related draft creation');
assert(storyboardDrafts.draftStoryboardKey('card', {id: 'x'}) === 'draft:card:x', 'Storyboard draft helper should key card drafts by template and id');
const sectionObject = storyboardDrafts.storyObjectFromKey('section:event.section');
assert(sectionObject && sectionObject.kind === 'section' && sectionObject.parentId === 'event' && sectionObject.view === 'events', 'Storyboard draft helper should parse section keys back to event parents');
assert(storyboardDrafts.draftBranchKeyMatches({draft: {id: 'followup'}}, 'draft:event:followup'), 'Storyboard draft helper should match event draft branch keys');
assert(storyboardDrafts.draftBranchKeyMatches({id: 'card_branch'}, 'draft:card:card_branch'), 'Storyboard draft helper should match card draft branch keys');
const storyboardDraftDeps = {
  ensureArray(value) { return Array.isArray(value) ? value : []; },
  normalizeTemplate(value) { return value === 'card' || value === 'news' ? value : 'event'; },
  safeDefaultDraftForTemplate(template) {
    return template === 'card'
      ? {schemaVersion: '0.1', options: [{id: 'keep'}]}
      : {schemaVersion: '0.1'};
  },
  safeDraftId(value) { return String(value || '').replace(/[^a-z0-9_]+/gi, '_').toLowerCase(); },
  t(_key, fallback) { return fallback; }
};
const relatedCard = storyboardDrafts.relatedCardDraft(
  {model: {title: 'Fixture Beat'}, draftBranches: [], projectIndex: {scenes: []}},
  {id: 'branch card', draft: {title: 'Branch Card'}},
  {selectedKey: 'event:fixture'},
  'card',
  storyboardDraftDeps
);
assert(relatedCard.kind === 'card' && relatedCard.id === 'branch_card', 'Storyboard draft helper should build related card drafts');
assert(relatedCard.studioAuthoringContext.cardBoardDropContext.sourceKey === 'event:fixture', 'Related card draft should keep source selection context');
const commandValues = modelBuilder.withStructureCommandValues({values: {title: 'Draft'}}, {
  structureCommands: [{id: 'structure_command_1', value: 'Q.test += 1'}]
});
assert(commandValues.values.title === 'Draft', 'Object Canvas model builder should preserve existing values');
assert(commandValues.values.__structureCommands.length === 1, 'Object Canvas model builder should inject structure commands into values');
const sourceSliceFallback = modelBuilder.buildSourceSliceCanvasModel({targetId: 'scene.source'}, {}, {
  baseDraft: {id: 'draft_source', title: 'Draft Source'},
  t(_key, fallback) { return fallback; }
});
assert(!sourceSliceFallback.ok, 'Object Canvas model builder should diagnostic-fallback when Source Slice workspace is unavailable');
assert(sourceSliceFallback.changeState.diagnostics[0].code === 'object_canvas.model_build_failed', 'Object Canvas model builder fallback should keep diagnostic code shape');
const diagnosticFallback = modelBuilder.diagnosticModel('template', 'event', 'draft_event', new Error('Boom'), {entry: {source: 'Fixture'}}, {
  baseDraft: {id: 'draft_event', title: 'Draft Event'},
  t(_key, fallback) { return fallback; }
});
assert(diagnosticFallback.entry.source === 'Fixture', 'Object Canvas diagnostic model should preserve entry source');
assert(diagnosticFallback.changeState.operationSummary.manualReview === 0, 'Object Canvas diagnostic model should keep operation summary shape');

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
const rootEffectless = scene('root_effectless_event', {
  title: 'Root Effectless Event',
  options: [],
  effects: [],
  sourceSpan: {
    path: 'source/scenes/events/root_effectless_event.scene.dry',
    startLine: 1,
    endLine: 18,
    line: 1,
    anchorText: 'title: Root Effectless Event',
    endAnchorText: 'Opening prose.'
  },
  topLevelSpan: {
    path: 'source/scenes/events/root_effectless_event.scene.dry',
    startLine: 1,
    endLine: 8,
    line: 1,
    anchorText: 'title: Root Effectless Event',
    endAnchorText: '= Root Effectless Event'
  },
  metadata: {
    title: {
      path: 'source/scenes/events/root_effectless_event.scene.dry',
      line: 1,
      excerpt: '1: title: Root Effectless Event\n2: subtitle: No trigger yet.\n3: new-page: true'
    },
    subtitle: {
      path: 'source/scenes/events/root_effectless_event.scene.dry',
      line: 2,
      excerpt: '1: title: Root Effectless Event\n2: subtitle: No trigger yet.\n3: new-page: true\n4: tags: event'
    },
    newPage: {
      path: 'source/scenes/events/root_effectless_event.scene.dry',
      line: 3,
      excerpt: '1: title: Root Effectless Event\n2: subtitle: No trigger yet.\n3: new-page: true\n4: tags: event\n5: view-if: year = 1936'
    },
    tags: {
      path: 'source/scenes/events/root_effectless_event.scene.dry',
      line: 4,
      excerpt: '2: subtitle: No trigger yet.\n3: new-page: true\n4: tags: event\n5: view-if: year = 1936\n6: max-visits: 1'
    },
    viewIf: {
      path: 'source/scenes/events/root_effectless_event.scene.dry',
      line: 5,
      excerpt: '3: new-page: true\n4: tags: event\n5: view-if: year = 1936\n6: max-visits: 1\n7: '
    },
    maxVisits: {
      path: 'source/scenes/events/root_effectless_event.scene.dry',
      line: 6,
      excerpt: '4: tags: event\n5: view-if: year = 1936\n6: max-visits: 1\n7: \n8: = Root Effectless Event'
    }
  }
});
const routeBranchEvent = scene('route_branch_event', {
  title: 'Route Branch Event',
  options: [{
    target: {id: 'results'},
    title: 'Resolve the vote.',
    sourceSpan: {
      path: 'source/scenes/events/route_branch_event.scene.dry',
      line: 12,
      startLine: 12,
      endLine: 12,
      anchorText: '- @results: Resolve the vote.',
      endAnchorText: '- @results: Resolve the vote.'
    }
  }],
  sections: [
    {
      id: 'route_branch_event.results',
      sourceSpan: {
        path: 'source/scenes/events/route_branch_event.scene.dry',
        line: 14,
        startLine: 14,
        endLine: 15,
        anchorText: '@results',
        endAnchorText: 'go-to: left if reform_wins; right if reform_loses; compromise if reform_ties'
      },
      metadata: {
        goTo: {
          path: 'source/scenes/events/route_branch_event.scene.dry',
          line: 15,
          excerpt: '13: \n14: @results\n15: go-to: left if reform_wins; right if reform_loses; compromise if reform_ties\n16: '
        }
      },
      routes: {
        goTo: [
          {id: 'left', raw: 'left if reform_wins', predicate: 'reform_wins'},
          {id: 'right', raw: 'right if reform_loses', predicate: 'reform_loses'},
          {id: 'compromise', raw: 'compromise if reform_ties', predicate: 'reform_ties'}
        ]
      },
      options: []
    },
    {
      id: 'route_branch_event.left',
      sourceSpan: {
        path: 'source/scenes/events/route_branch_event.scene.dry',
        line: 17,
        startLine: 17,
        endLine: 20,
        anchorText: '@left',
        endAnchorText: 'The left wins.'
      },
      routes: {},
      options: []
    },
    {
      id: 'route_branch_event.right',
      sourceSpan: {
        path: 'source/scenes/events/route_branch_event.scene.dry',
        line: 22,
        startLine: 22,
        endLine: 25,
        anchorText: '@right',
        endAnchorText: 'The right wins.'
      },
      routes: {},
      options: []
    },
    {
      id: 'route_branch_event.compromise',
      sourceSpan: {
        path: 'source/scenes/events/route_branch_event.scene.dry',
        line: 27,
        startLine: 27,
        endLine: 30,
        anchorText: '@compromise',
        endAnchorText: 'The vote is tied.'
      },
      routes: {},
      options: []
    }
  ],
  sourceSpan: {
    path: 'source/scenes/events/route_branch_event.scene.dry',
    startLine: 1,
    endLine: 30,
    line: 1,
    anchorText: 'title: Route Branch Event',
    endAnchorText: 'The vote is tied.'
  },
  metadata: {viewIf: {path: 'source/scenes/events/route_branch_event.scene.dry', line: 4}}
});
const labor = scene('labor_unrest', {
  title: 'Labor Unrest',
  assetRefs: [
    {path: 'img/events/dnvp_congress.png', type: 'image', label: 'Congress hall', role: 'event_illustration'},
    {
      path: 'img/events/iron_front_branch.png',
      type: 'image',
      label: 'Iron Front branch poster',
      directive: 'face-image',
      source: {
        path: 'source/scenes/events/labor_unrest.scene.dry',
        line: 20,
        startLine: 20,
        endLine: 20,
        anchorText: 'face-image: img/events/iron_front_branch.png',
        endAnchorText: 'face-image: img/events/iron_front_branch.png'
      }
    }
  ],
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
const assetDirectiveEvent = scene('asset_directive_event', {
  title: 'Asset Directive Event',
  options: [],
  sourceSpan: {path: 'source/scenes/events/asset_directive_event.scene.dry', startLine: 1, endLine: 20},
  metadata: {viewIf: {path: 'source/scenes/events/asset_directive_event.scene.dry', line: 4}},
  assetRefs: [
    {
      path: 'img/events/current-face.png',
      type: 'image',
      label: 'Current face',
      directive: 'face-image',
      source: {
        path: 'source/scenes/events/asset_directive_event.scene.dry',
        line: 7,
        startLine: 7,
        endLine: 7,
        anchorText: 'face-image: img/events/current-face.png',
        endAnchorText: 'face-image: img/events/current-face.png'
      }
    },
    {
      path: 'img/events/current-bg.jpg',
      type: 'image',
      label: 'Current background',
      directive: 'set-bg',
      source: {
        path: 'source/scenes/events/asset_directive_event.scene.dry',
        line: 8,
        startLine: 8,
        endLine: 8,
        anchorText: 'set-bg: img/events/current-bg.jpg',
        endAnchorText: 'set-bg: img/events/current-bg.jpg'
      }
    },
    {
      path: 'audio/events/current-theme.ogg',
      type: 'audio',
      label: 'Current theme',
      directive: 'audio',
      source: {
        path: 'source/scenes/events/asset_directive_event.scene.dry',
        line: 9,
        startLine: 9,
        endLine: 9,
        anchorText: 'audio: audio/events/current-theme.ogg',
        endAnchorText: 'audio: audio/events/current-theme.ogg'
      }
    },
    {
      path: 'img/events/current-inline.jpg',
      type: 'image',
      label: 'Current inline campaign',
      directive: 'inline-image',
      source: {
        path: 'source/scenes/events/asset_directive_event.scene.dry',
        line: 10,
        startLine: 10,
        endLine: 10,
        anchorText: '![Campaign crowd](img/events/current-inline.jpg)',
        endAnchorText: '![Campaign crowd](img/events/current-inline.jpg)'
      }
    }
  ]
});
const fuzzyAssetEvent = scene('fuzzy_asset_event', {
  title: 'Fuzzy Asset Event',
  options: [],
  sourceSpan: {path: 'source/scenes/events/fuzzy_asset_event.scene.dry', startLine: 1, endLine: 20},
  assetRefs: [{
    path: 'img/events/fuzzy-bg.jpg',
    type: 'image',
    label: 'Fuzzy background',
    directive: 'set-bg',
    source: {path: 'source/scenes/events/fuzzy_asset_event.scene.dry'}
  }]
});
const assetDirectiveCard = scene('asset_directive_card', {
  title: 'Asset Directive Card',
  path: 'source/scenes/cards/asset_directive_card.scene.dry',
  type: 'card',
  flags: {isCard: true},
  viewIf: '',
  options: [],
  sourceSpan: {path: 'source/scenes/cards/asset_directive_card.scene.dry', startLine: 1, endLine: 20},
  assetRefs: [{
    path: 'img/cards/current-card.png',
    type: 'image',
    label: 'Current card',
    directive: 'card-image',
    source: {
      path: 'source/scenes/cards/asset_directive_card.scene.dry',
      line: 6,
      startLine: 6,
      endLine: 6,
      anchorText: 'card-image: img/cards/current-card.png',
      endAnchorText: 'card-image: img/cards/current-card.png'
    }
  }]
});

const index = {
  schemaVersion: '0.1',
  project: {name: 'Object Canvas Fixture', root: '/tmp/object-canvas'},
  scenes: [current, target, rootEffectless, routeBranchEvent, labor, assetDirectiveEvent, fuzzyAssetEvent, assetDirectiveCard],
  edges: [
    {from: 'generic_intro', to: 'target_scene', kind: 'go_to', label: 'continues', source: {path: current.path, line: 20}}
  ],
  variables: [
    {name: 'public_order', readCount: 1, writeCount: 1, reads: [{path: current.path, line: 8}], writes: [{path: current.path, line: 25}], tags: ['politics']},
    {name: 'labor_minister', readCount: 1, writeCount: 1, reads: [{path: labor.path, line: 26}], writes: [{path: labor.path, line: 6}], tags: ['labor']}
  ],
  semantic: {
    events: [
      {id: current.id, title: current.title, path: current.path},
      {id: rootEffectless.id, title: rootEffectless.title, path: rootEffectless.path},
      {id: routeBranchEvent.id, title: routeBranchEvent.title, path: routeBranchEvent.path},
      {id: labor.id, title: labor.title, path: labor.path},
      {id: assetDirectiveEvent.id, title: assetDirectiveEvent.title, path: assetDirectiveEvent.path},
      {id: fuzzyAssetEvent.id, title: fuzzyAssetEvent.title, path: fuzzyAssetEvent.path}
    ],
    cards: [{id: assetDirectiveCard.id, title: assetDirectiveCard.title, path: assetDirectiveCard.path}],
    assets: {
      items: [
        {path: 'img/events/dnvp_congress.png', type: 'image', label: 'Congress hall', fileExists: true},
        {path: 'img/events/iron_front_branch.png', type: 'image', label: 'Iron Front branch poster', fileExists: true},
        {path: 'img/events/current-face.png', type: 'image', label: 'Current face', fileExists: true},
        {path: 'img/events/current-bg.jpg', type: 'image', label: 'Current background', fileExists: true},
        {path: 'img/events/current-inline.jpg', type: 'image', label: 'Current inline campaign', fileExists: true},
        {path: 'audio/events/current-theme.ogg', type: 'audio', label: 'Current theme', fileExists: true},
        {path: 'img/cards/current-card.png', type: 'image', label: 'Current card', fileExists: true},
        {path: 'img/events/indexed-portrait.png', type: 'image', label: 'Indexed portrait', fileExists: true},
        {path: 'out/html/img/events/runtime-indexed.png', type: 'image', label: 'Runtime indexed', fileExists: true},
        {path: 'img/cards/indexed-card.png', type: 'image', label: 'Indexed card art', fileExists: true},
        {path: 'audio/events/indexed-theme.ogg', type: 'audio', label: 'Indexed theme', fileExists: true}
      ]
    },
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
          id: 'generic_intro_qualified_effect',
          text: 'Q.stability += 2;',
          role: 'script',
          owner: {kind: 'scene', sceneId: 'generic_intro', sectionId: 'generic_intro.target_scene'},
          source: {path: current.path, line: 26, anchorText: 'Q.stability += 2;', endAnchorText: 'Q.stability += 2;'}
        },
        {
          id: 'route_branch_right_result',
          text: 'The right wins.',
          role: 'body',
          owner: {kind: 'scene', sceneId: 'route_branch_event', sectionId: 'route_branch_event.right'},
          source: {
            path: routeBranchEvent.path,
            line: 25,
            startLine: 25,
            endLine: 25,
            anchorText: 'The right wins.',
            endAnchorText: 'The right wins.'
          }
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
        },
        {
          id: 'asset_directive_event_inline_image',
          text: '![Campaign crowd](img/events/current-inline.jpg)',
          role: 'body',
          owner: {kind: 'scene', sceneId: 'asset_directive_event'},
          source: {
            path: assetDirectiveEvent.path,
            line: 10,
            anchorText: '![Campaign crowd](img/events/current-inline.jpg)',
            endAnchorText: '![Campaign crowd](img/events/current-inline.jpg)'
          }
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
  },
  {
    id: 'menu_flow_first_effect',
    text: 'Q.public_order += 2;',
    role: 'script',
    owner: {kind: 'scene', sceneId: 'menu_flow', sectionId: 'first'},
    source: {path: menuFlow.path, line: 26, anchorText: 'Q.public_order += 2;', endAnchorText: 'Q.public_order += 2;'}
  },
  {
    id: 'menu_flow_menu_script',
    text: 'Q.menu_seen += 1;',
    role: 'script',
    owner: {kind: 'scene', sceneId: 'menu_flow', sectionId: 'menu_flow.menu'},
    source: {path: menuFlow.path, line: 27, anchorText: 'Q.menu_seen += 1;', endAnchorText: 'Q.menu_seen += 1;'}
  }
);

const factoryResultText = 'If the capitalists are going to attack us, then we must hit them back.';
const factoryControlsResultText = 'Enact capital controls to lessen the impact.';
const factoryUnavailableText = 'The judiciary would never allow this.';
const factoryCrisis = scene('factory_crisis', {
  title: 'Factory Crisis',
  path: 'source/scenes/events/factory_crisis.scene.dry',
  options: [{
    target: {id: 'seize'},
    title: factoryResultText,
    sourceSpan: {
      path: 'source/scenes/events/factory_crisis.scene.dry',
      line: 12,
      startLine: 12,
      endLine: 12,
      anchorText: '- @seize: Empower workers to seize the factories!',
      endAnchorText: '- @seize: Empower workers to seize the factories!'
    }
  }, {
    target: {id: 'controls'},
    title: 'Enact capital controls to lessen the impact.',
    chooseIf: 'judicial_reform >= 2',
    sourceSpan: {
      path: 'source/scenes/events/factory_crisis.scene.dry',
      line: 13,
      startLine: 13,
      endLine: 13,
      anchorText: '- @controls: Enact capital controls to lessen the impact.',
      endAnchorText: '- @controls: Enact capital controls to lessen the impact.'
    }
  }],
  sections: [
    {
      id: 'factory_crisis.seize',
      sourceSpan: {path: 'source/scenes/events/factory_crisis.scene.dry', startLine: 20, endLine: 24},
      routes: {},
      options: []
    },
    {
      id: 'factory_crisis.controls',
      sourceSpan: {path: 'source/scenes/events/factory_crisis.scene.dry', startLine: 25, endLine: 29},
      routes: {},
      options: []
    }
  ],
  sourceSpan: {path: 'source/scenes/events/factory_crisis.scene.dry', startLine: 1, endLine: 40}
});
index.scenes.push(factoryCrisis);
index.semantic.events.push({id: factoryCrisis.id, title: factoryCrisis.title, path: factoryCrisis.path});
index.semantic.textCorpus.items.push(
  {
    id: 'factory_crisis_title',
    text: 'Factory Crisis',
    role: 'title',
    owner: {kind: 'scene', sceneId: 'factory_crisis'},
    source: {path: factoryCrisis.path, line: 1}
  },
  {
    id: 'factory_crisis_body',
    text: 'The strike committee waits for an answer.',
    role: 'body',
    owner: {kind: 'scene', sceneId: 'factory_crisis'},
    source: {path: factoryCrisis.path, line: 8}
  },
  {
    id: 'factory_crisis_seize_result',
    text: factoryResultText,
    role: 'body',
    owner: {kind: 'scene', sceneId: 'factory_crisis', sectionId: 'factory_crisis.seize'},
    source: {path: factoryCrisis.path, line: 21, anchorText: factoryResultText, endAnchorText: factoryResultText}
  },
  {
    id: 'factory_crisis_controls_result',
    text: factoryControlsResultText,
    role: 'body',
    owner: {kind: 'scene', sceneId: 'factory_crisis', sectionId: 'factory_crisis.controls'},
    source: {path: factoryCrisis.path, line: 26, anchorText: factoryControlsResultText, endAnchorText: factoryControlsResultText}
  },
  {
    id: 'factory_crisis_controls_unavailable',
    text: factoryUnavailableText,
    role: 'unavailable_text',
    owner: {kind: 'scene', sceneId: 'factory_crisis', sectionId: 'factory_crisis.controls'},
    source: {path: factoryCrisis.path, line: 27, anchorText: 'unavailable-subtitle: ' + factoryUnavailableText, endAnchorText: 'unavailable-subtitle: ' + factoryUnavailableText}
  }
);

const existing = canvasModel.buildExistingCanvas(index, 'events', 'generic_intro', {
  values: {
    generic_intro_body: 'The campaign office opens to a sharper morning.',
    generic_intro_option: 'Follow the campaign lead'
  },
  entry: {source: 'Design', action: 'edit_existing'}
});
const impossibleMonthCanvasIndex = JSON.parse(JSON.stringify(index));
impossibleMonthCanvasIndex.scenes.find((item) => item.id === 'generic_intro').viewIf = 'year = 1936 and month >= 5 and month <= 3';
const impossibleMonthCanvas = canvasModel.buildExistingCanvas(impossibleMonthCanvasIndex, 'events', 'generic_intro', {
  entry: {source: 'Design', action: 'edit_existing'}
});
assert(impossibleMonthCanvas.changeState.diagnostics.some((diag) => diag.code === 'existing_scene_edit.impossible_month_window'), 'Object Canvas should surface impossible month-window warnings for existing events');

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
assert(existing.eventBody.optionEffects[0].fields.some((field) => field.role === 'effect' && field.value === 'Q.stability += 2' && field.optionId === 'target_scene'), 'existing body should map fully-qualified section effects back to the matching option preview group');
assert(existing.eventBody.structureActions.some((field) => field.id === 'structure_add_option_effect_target_scene'), 'existing body should expose option effect creation fields');
assert(existing.eventBody.eventStructure && existing.eventBody.eventStructure.kind === 'event_structure', 'existing Event editor body should be derived through EventStructure');
const existingPreviewHtml = previewEditor.renderPreviewPane(existing);
assert(existingPreviewHtml.includes('data-object-editing-preview-effects="true"'), 'left preview should render an effects and impact block');
assert(existingPreviewHtml.includes('Q.budget += 1'), 'left preview should show trigger effect impact text');
assert(existingPreviewHtml.includes('Q.stability += 2'), 'left preview should show fully-qualified section option effects under the matching player choice');
assert(existingPreviewHtml.includes('Follow-up page'), 'left preview should label same-scene follow-up text as a follow-up page');
assert(existingPreviewHtml.includes('Section: Nice having you, Bruning.'), 'left preview should keep the follow-up page title as section context');
const factoryCanvas = canvasModel.buildExistingCanvas(index, 'events', 'factory_crisis', {});
assert(factoryCanvas.ok, 'source-line option title fallback fixture should build: ' + JSON.stringify(factoryCanvas.changeState.diagnostics));
const factoryOption = factoryCanvas.eventBody.options.find((option) => option.id === 'seize');
assert(factoryOption && factoryOption.label === 'Empower workers to seize the factories!', 'option title should come from the source option line instead of the target result prose');
assert(factoryOption.fields.some((field) => field.role === 'option_label' && field.original === 'Empower workers to seize the factories!' && field.editability !== 'read_only'), 'source-line option titles should remain editable label fields even without textCorpus option_label rows');
assert(factoryOption.resultFields.length === 1 && String(factoryOption.resultFields[0].original || '').trim() === factoryResultText, 'option result prose should remain attached as after-choice text');
const capitalControlsOption = factoryCanvas.eventBody.options.find((option) => option.id === 'controls');
assert(capitalControlsOption && capitalControlsOption.unavailableText === factoryUnavailableText, 'unavailable option text should be attached to the owning player choice');
assert(capitalControlsOption.fields.some((field) => field.role === 'unavailable_text' && field.original === factoryUnavailableText), 'unavailable option text should remain editable from the option fields');
assert(capitalControlsOption.resultFields.length === 1 && String(capitalControlsOption.resultFields[0].original || '').trim() === factoryControlsResultText, 'conditional option result text should be attached to the owning player choice');
assert(!factoryCanvas.eventBody.sections.concat(factoryCanvas.eventBody.branchSections).some((field) => String(field.original || '').includes(factoryUnavailableText)), 'unavailable option text should not render as a standalone page section');
assert(!factoryCanvas.eventBody.branchSections.some((field) => String(field.original || '').includes(factoryControlsResultText)), 'conditional option result text should not render as a standalone branch section when it belongs to a player choice');
const capitalControlsRemove = factoryCanvas.eventBody.structureActions.find((field) => field.structureAction === 'remove_option' && field.optionId === 'controls');
assert(capitalControlsRemove && capitalControlsRemove.editability === 'advanced_source_patch', 'exact source-backed option deletion with unresolved fallout should still be advanced-applyable');
assert(capitalControlsRemove.structureSourceBlock && ['option_line_delete', 'option_bundle_delete'].includes(capitalControlsRemove.structureSourceBlock.kind), 'advanced option deletion should carry exact source-backed delete evidence');
const capitalControlsDeleteCanvas = canvasModel.buildExistingCanvas(index, 'events', 'factory_crisis', {
  values: {structure_remove_option_controls: 'true'}
});
assert(capitalControlsDeleteCanvas.changeState.installPlan.operations.some((operation) => operation.type === 'replace_text' && operation.safety === 'advanced_apply' && operation.search === '- @controls: Enact capital controls to lessen the impact.'), 'line-only advanced option deletion should become an advanced source-backed replace_text operation');
assert(!capitalControlsDeleteCanvas.changeState.installPlan.operations.some((operation) => operation.type === 'manual_snippet'), 'line-only advanced option deletion should not fall back to manual snippets');
const factoryPreviewHtml = previewEditor.renderPreviewPane(factoryCanvas);
assert(/<button[^>]*>Empower workers to seize the factories!<\/button>/.test(factoryPreviewHtml), 'left preview should render the player choice label in the option button');
assert(!/<button[^>]*>If the capitalists are going to attack us/.test(factoryPreviewHtml), 'left preview must not promote after-choice prose into the option button title');
assert(/data-object-editing-preview-choice="controls"[\s\S]*Unavailable text[\s\S]*The judiciary would never allow this\./.test(factoryPreviewHtml), 'left preview should show unavailable text inside the owning option card');
const factoryEditorHtml = previewEditor.render(factoryCanvas);
assert(/data-preview-object-choice="controls"[\s\S]*data-object-canvas-field="factory_crisis_controls_unavailable"[\s\S]*data-object-canvas-field="block:section_text_factory_crisis_controls"/.test(factoryEditorHtml), 'right editor should group option label, unavailable text, and result text inside the same choice editor');
assert(!/data-preview-object-branches="true"[\s\S]*The judiciary would never allow this\./.test(factoryEditorHtml), 'right editor must not render unavailable text as a separate branch card');
const menuFlowCanvas = canvasModel.buildExistingCanvas(index, 'events', 'menu_flow', {});
assert(menuFlowCanvas.ok, 'menu-flow existing Event should open in Object Canvas: ' + JSON.stringify(menuFlowCanvas.changeState.diagnostics));
const menuBranch = menuFlowCanvas.eventBody.branchSections.find((field) => field.sectionId === 'menu_flow.menu');
assert(menuBranch && menuBranch.semanticRole === 'menu_section_text', 'follow-up menus should stay in branch sections instead of choice result fields');
assert(menuBranch.ownedOptionIds.length === 2, 'follow-up menu branch sections should expose their owned choices');
assert(menuFlowCanvas.eventBody.options.length === 2, 'follow-up menu choices should still be editable option rows');
const menuFlowFirstOption = menuFlowCanvas.eventBody.options.find((option) => option.rawTargetId === 'first');
assert(menuFlowFirstOption && menuFlowFirstOption.fields.some((field) => field.role === 'option_label' && field.original === 'First path.' && field.editability !== 'read_only' && !field.readOnly), 'section-owned source-line option labels should stay editable instead of falling back to read-only');
assert(menuFlowCanvas.eventBody.options.every((option) => !option.resultFields.some((field) => field.sectionId === 'menu_flow.menu')), 'owned menu text must not be duplicated under every owned option');
const menuAddOptionField = menuFlowCanvas.eventBody.structureActions.find((field) => field.structureAction === 'add_option' && field.sectionId === 'menu_flow.menu');
assert(menuAddOptionField, 'follow-up menu sections should expose add-option-in-section controls');
assert(menuAddOptionField.editability === 'guarded_apply', 'source-backed follow-up menu add-option controls should advertise guarded apply');
assert(menuAddOptionField.structureSourceBlock && menuAddOptionField.structureSourceBlock.kind === 'section_option_insert_anchor', 'follow-up menu add-option controls should carry section insert evidence');
const menuAddFirstEffectField = menuFlowCanvas.eventBody.structureActions.find((field) => field.structureAction === 'add_option_effect' && field.optionId === menuFlowFirstOption.id);
assert(menuAddFirstEffectField && menuAddFirstEffectField.editability === 'guarded_apply', 'section-owned option effects should keep guarded source-backed insertion even when source owner uses the raw local target');
assert(menuAddFirstEffectField.structureSourceBlock && menuAddFirstEffectField.structureSourceBlock.kind === 'effect_insert_anchor', 'section-owned option effect insertion should carry the matching source effect anchor');
const menuRemoveOptionField = menuFlowCanvas.eventBody.structureActions.find((field) => field.structureAction === 'remove_option' && field.sectionId === 'menu_flow.menu' && field.structureTargetLabel === 'Second path.');
assert(menuRemoveOptionField && menuRemoveOptionField.editability === 'guarded_apply', 'source-backed follow-up menu option removal should advertise guarded apply when it has no local-result fallout');
assert(menuRemoveOptionField.structureSourceBlock && menuRemoveOptionField.structureSourceBlock.kind === 'option_line_delete', 'follow-up menu option removal should carry exact option-line evidence');
const menuRemoveFirstOptionField = menuFlowCanvas.eventBody.structureActions.find((field) => field.structureAction === 'remove_option' && field.sectionId === 'menu_flow.menu' && field.structureTargetLabel === 'First path.');
assert(menuRemoveFirstOptionField && menuRemoveFirstOptionField.editability === 'advanced_source_patch', 'section-owned option removal should detect source-backed effects through raw-target ownership and keep advanced apply evidence');
assert(menuRemoveFirstOptionField.structureSourceBlock && menuRemoveFirstOptionField.structureSourceBlock.fallout && menuRemoveFirstOptionField.structureSourceBlock.fallout.effectCount === 1, 'section-owned option removal fallout should count only the matching option effect');
const menuPreviewHtml = previewEditor.renderPreviewPane(menuFlowCanvas);
assert(menuPreviewHtml.includes('Follow-up menu'), 'left preview should label owned-choice sections as follow-up menus');
assert(menuPreviewHtml.includes('Contains choices'), 'left preview should explain which choices belong to a follow-up menu');
const menuEditorHtml = previewEditor.render(menuFlowCanvas);
assert(menuEditorHtml.includes('New option in this section'), 'right editor should place a section-owned option creator inside follow-up sections');
assert(menuEditorHtml.includes('Add to: @menu') && menuEditorHtml.includes('title="menu_flow.menu"'), 'section-owned option creator should show the target section context');
assert(menuEditorHtml.includes('Simple source-backed options can be applied automatically after review.'), 'guarded section-owned option creators should clearly show guarded apply safety');
assert(menuEditorHtml.includes('This source-backed structural change can be applied automatically after review.'), 'guarded option removals should clearly show guarded apply safety');
const menuComplexAddOption = canvasModel.buildExistingCanvas(index, 'events', 'menu_flow', {
  values: {
    __structureCommands: [{
      type: 'add_option',
      action: 'add_option',
      fieldId: 'structure_add_option_section_menu_flow_menu',
      sectionId: 'menu_flow.menu',
      value: [
        '- @third: Third path.',
        '# third',
        'result-mode: native',
        'choose-if: public_order >= 1',
        'unavailable-subtitle: Public order is too low.',
        'Third result.'
      ].join('\n')
    }]
  }
});
assert(menuComplexAddOption.ok, 'complex source-backed section option insertion should build');
assert(menuComplexAddOption.changeState.installPlan.operations.some((operation) =>
  operation.type === 'insert_text' &&
  operation.safety === 'guarded_apply' &&
  String(operation.content || '').includes('- @third: Third path.') &&
  String(operation.content || '').includes('choose-if: public_order >= 1') &&
  String(operation.content || '').includes('unavailable-subtitle: Public order is too low.') &&
  !String(operation.content || '').includes('result-mode: native')
), 'complex source-backed option insertion should stay guarded and source-backed instead of a manual snippet');
assert(!menuComplexAddOption.changeState.installPlan.operations.some((operation) => operation.type === 'manual_snippet'), 'complex source-backed option insertion should not fall back to manual review');
const conditionalOptionEffect = canvasModel.buildExistingCanvas(index, 'events', 'generic_intro', {
  values: {
    __structureCommands: [{
      type: 'add_option_effect',
      action: 'add_option_effect',
      fieldId: 'structure_add_option_effect_target_scene',
      optionId: 'target_scene',
      value: 'Q.public_order += 2 if public_order >= 1'
    }]
  }
});
assert(conditionalOptionEffect.ok, 'conditional source-backed option effect insertion should build');
assert(conditionalOptionEffect.changeState.installPlan.operations.some((operation) =>
  operation.type === 'insert_text' &&
  operation.safety === 'advanced_apply' &&
  String(operation.content || '').includes('if (Q.public_order >= 1) { Q.public_order += 2; }')
), 'conditional source-backed option effects should become advanced raw-effect inserts instead of manual snippets');
assert(!conditionalOptionEffect.changeState.installPlan.operations.some((operation) => operation.type === 'manual_snippet'), 'conditional source-backed option effects should not fall back to manual review');
const existingEditorHtml = previewEditor.render(existing);
assert(existingEditorHtml.includes('data-preview-object-structure-builder="add_option"'), 'preview editor should show structured add-option controls');
assert(/data-preview-object-structure-output="true"[^>]*data-object-canvas-field="structure_add_option"/.test(existingEditorHtml), 'structure builder hidden output should preserve the source-backed add-option field id');
assert(existingEditorHtml.includes('New player option'), 'preview editor should present add-option as a creator form instead of a raw snippet');
assert(existingEditorHtml.includes('data-preview-object-structure-builder="add_trigger_effect"'), 'preview editor should show structured trigger-effect controls');
assert(existingEditorHtml.includes('New on-arrival effect'), 'preview editor should label event-level trigger effects as on-arrival effects');
assert(existingEditorHtml.includes('Simple source-backed Q effects can be applied automatically after review.'), 'preview editor should not label source-backed trigger effects as manual review');
assert(!/data-preview-object-structure-builder="add_trigger_effect"[\s\S]{0,1600}Manual review only/.test(existingEditorHtml), 'source-backed trigger-effect builders should not show the manual-review notice');
assert(existingEditorHtml.includes('data-preview-object-effect-row="true"'), 'preview editor should render effect edits as unified effect rows');
assert(/data-preview-object-effect-row="true"[\s\S]*Q\.budget \+= 1[\s\S]*data-preview-object-effect-delete="true"[\s\S]*structure_remove_effect_budget_1/.test(existingEditorHtml), 'trigger effect edit and delete controls should share one effect row');
assert(/data-preview-object-effect-row="true"[\s\S]*Q\.public_order \+= 1[\s\S]*data-preview-object-effect-delete="true"[\s\S]*structure_remove_effect_public_order_/.test(existingEditorHtml), 'choice effect edit and delete controls should share one effect row');
assert(!/preview-object-structure-delete[^"]*preview-object-action-remove_effect/.test(existingEditorHtml), 'paired effect deletions should not render as separate delete cards');
assert(existingEditorHtml.includes('data-preview-object-inline-add="add_option"'), 'preview editor should place structural add controls at the end of the relevant object category');
assert(!existingEditorHtml.includes('preview-object-structure-workbench'), 'preview editor should not isolate structural controls in a separate workbench');
const rootEffectlessExisting = canvasModel.buildExistingCanvas(index, 'events', 'root_effectless_event', {});
const rootEffectlessTriggerField = rootEffectlessExisting.eventBody.structureActions.find((field) => field.structureAction === 'add_trigger_effect');
assert(rootEffectlessTriggerField && rootEffectlessTriggerField.editability === 'guarded_apply', 'events without an existing root on-arrival line should still expose source-backed trigger-effect insertion');
assert(rootEffectlessTriggerField.structureSourceBlock && rootEffectlessTriggerField.structureSourceBlock.kind === 'root_on_arrival_insert_anchor', 'root trigger insertion should carry a root on-arrival insert anchor');
assert(rootEffectlessTriggerField.source && rootEffectlessTriggerField.source.anchorText === 'max-visits: 1', 'root trigger insertion should anchor after the last exact root metadata line');
const rootEffectlessEditorHtml = previewEditor.render(rootEffectlessExisting);
assert(!/data-preview-object-structure-builder="add_trigger_effect"[\s\S]{0,1600}Manual review only/.test(rootEffectlessEditorHtml), 'root trigger insertion builders should not show manual review when metadata anchors are exact');
const rootEffectlessChanged = canvasModel.buildExistingCanvas(index, 'events', 'root_effectless_event', {
  values: {structure_add_trigger_effect: 'Q.public_order += 1'}
});
const rootEffectlessTriggerOp = rootEffectlessChanged.changeState.installPlan.operations.find((operation) => operation.type === 'insert_text' && operation.anchorText === 'max-visits: 1');
assert(rootEffectlessTriggerOp && rootEffectlessTriggerOp.safety === 'guarded_apply' && String(rootEffectlessTriggerOp.content || '').includes('on-arrival: public_order += 1'), 'root trigger insertion should create a guarded on-arrival insert instead of a manual snippet');
assert(!rootEffectlessChanged.changeState.installPlan.operations.some((operation) => operation.type === 'manual_snippet'), 'root trigger insertion should not fall back to manual review');
const routeBranchExisting = canvasModel.buildExistingCanvas(index, 'events', 'route_branch_event', {});
const routeBranchRightLayer = routeBranchExisting.eventBody.structureActions.find((field) => field.structureAction === 'remove_layer' && field.sectionId === 'route_branch_event.right');
assert(routeBranchRightLayer && routeBranchRightLayer.editability === 'advanced_source_patch', 'routed branch layers reached by a multi-clause go-to line should be advanced-deleteable');
assert(routeBranchRightLayer.structureSourceBlock && routeBranchRightLayer.structureSourceBlock.kind === 'layer_bundle_delete', 'routed branch deletion should carry a bundle delete block');
assert(routeBranchRightLayer.structureSourceBlock.incomingRouteSources[0].target === 'right', 'routed branch deletion should preserve the route clause target');
assert(routeBranchRightLayer.structureSourceBlock.incomingRouteSources[0].anchorText === 'go-to: left if reform_wins; right if reform_loses; compromise if reform_ties', 'routed branch deletion should recover the full go-to line from source excerpts');
const routeBranchDelete = canvasModel.buildExistingCanvas(index, 'events', 'route_branch_event', {
  values: {[routeBranchRightLayer.id]: 'true'}
});
assert(routeBranchDelete.changeState.installPlan.operations.some((operation) =>
  operation.type === 'replace_section' &&
  operation.safety === 'advanced_apply' &&
  operation.anchorText === '@right'
), 'routed branch deletion should remove the target section through advanced apply');
assert(routeBranchDelete.changeState.installPlan.operations.some((operation) =>
  operation.type === 'replace_text' &&
  operation.safety === 'advanced_apply' &&
  operation.search === 'go-to: left if reform_wins; right if reform_loses; compromise if reform_ties' &&
  operation.replace === 'go-to: left if reform_wins; compromise if reform_ties'
), 'routed branch deletion should remove only the matching go-to clause and preserve sibling route clauses');
assert(!routeBranchDelete.changeState.installPlan.operations.some((operation) => operation.type === 'manual_snippet'), 'routed branch deletion should not fall back to manual review');
const expandedModalHtml = previewEditor.renderModal(existing, {previewExpanded: true});
assert(expandedModalHtml.includes('is-preview-expanded'), 'preview object modal should expose an expanded preview state');
assert(expandedModalHtml.includes('Collapse preview'), 'expanded preview modal should offer a collapse action');
const pendingStructureValues = {
  structure_add_option: '- @negotiate: Negotiate settlement.\n# negotiate\nThe committee spends [+ public_order +] legitimacy.',
  structure_add_branch: '# late_warning\n[? if public_order >= 2 : Public order is under strain. ?]',
  structure_add_trigger_effect: 'Q.public_order += 2',
  structure_add_option_effect_target_scene: 'Q.public_order -= 1'
};
const pendingStructureModel = canvasModel.buildExistingCanvas(index, 'events', 'generic_intro', {
  values: pendingStructureValues,
  entry: {source: 'Design', action: 'edit_existing'}
});
const pendingPreviewHtml = previewEditor.renderPreviewPane(pendingStructureModel);
assert(pendingStructureModel.changeState.changedCount === 4, 'existing editor should collect add-option, add-branch, trigger-effect, and option-effect proposals');
assert(pendingStructureModel.changeState.installPlan.operations.filter((operation) => operation.type === 'manual_snippet').length === 0, 'source-backed option/effect/trigger/branch changes should avoid fake manual review');
assert(pendingStructureModel.changeState.installPlan.operations.some((operation) => operation.type === 'insert_text' && operation.safety === 'guarded_apply' && operation.content.includes('@negotiate')), 'simple root add-option commands should become guarded inserts');
assert(pendingStructureModel.changeState.installPlan.operations.some((operation) => operation.type === 'insert_text' && operation.safety === 'advanced_apply' && operation.content.includes('@late_warning')), 'simple source-backed branch commands should become advanced inserts');
assert(pendingStructureModel.changeState.installPlan.operations.some((operation) => operation.type === 'insert_text' && operation.safety === 'guarded_apply'), 'simple source-backed option effects should become guarded inserts');
assert(pendingStructureModel.changeState.installPlan.operations.some((operation) => operation.type === 'replace_text' && operation.safety === 'guarded_apply' && operation.search.includes('on-arrival') && operation.replace.includes('public_order += 2')), 'simple source-backed trigger effects should become guarded on-arrival replacements');
assert(pendingPreviewHtml.includes('Negotiate settlement.'), 'left preview should materialize a pending new player option');
assert(pendingPreviewHtml.includes('The committee spends') && pendingPreviewHtml.includes('Q.public_order'), 'left preview should show pending option result text and consumed variables');
assert(pendingPreviewHtml.includes('Public order is under strain.'), 'left preview should materialize pending branch/follow-up text');
assert(pendingPreviewHtml.includes('Q.public_order += 2'), 'left preview should show pending trigger effect changes');
assert(pendingPreviewHtml.includes('Q.public_order -= 1'), 'left preview should show pending option effect changes');
const queuedStructureModel = canvasModel.buildExistingCanvas(index, 'events', 'generic_intro', {
  values: {
    __structureCommands: [
      {id: 'queued_add_option', type: 'add_option', action: 'add_option', fieldId: 'structure_add_option', value: '- @press_line: Brief the press.\n# press_line\nThe press office takes over.'},
      {id: 'queued_add_effect', type: 'add_option_effect', action: 'add_option_effect', fieldId: 'structure_add_option_effect_target_scene', optionId: 'target_scene', targetLabel: 'Continue', value: 'Q.public_order += 3'},
      {id: 'queued_add_effect_qualified', type: 'add_option_effect', action: 'add_option_effect', optionId: 'generic_intro.target_scene', targetLabel: 'Continue', value: 'Q.stability += 4'}
    ]
  },
  entry: {source: 'Design', action: 'edit_existing'}
});
assert(queuedStructureModel.changeState.changedCount === 3, 'existing editor should turn queued structure commands into independent manual-review changes');
assert(!queuedStructureModel.changeState.installPlan.operations.some((operation) => operation.type === 'manual_snippet'), 'queued simple add-option/effect commands should avoid manual-review snippets');
assert(queuedStructureModel.changeState.installPlan.operations.some((operation) => operation.type === 'insert_text' && operation.safety === 'guarded_apply' && operation.content.includes('@press_line')), 'queued simple root add-option commands should become guarded inserts');
assert(queuedStructureModel.changeState.installPlan.operations.some((operation) => operation.type === 'insert_text' && operation.safety === 'guarded_apply'), 'queued source-backed option-effect commands should become guarded inserts');
const queuedPreviewHtml = previewEditor.renderPreviewPane(queuedStructureModel);
const queuedEditorHtml = previewEditor.render(queuedStructureModel);
assert(queuedPreviewHtml.includes('Brief the press.'), 'left preview should materialize queued add-option commands');
assert(queuedPreviewHtml.includes('Q.public_order += 3'), 'left preview should materialize queued add-option-effect commands');
assert(queuedPreviewHtml.includes('Q.stability += 4'), 'left preview should materialize queued option effects whose command uses a fully-qualified option id');
assert(queuedEditorHtml.includes('Q.public_order += 3'), 'right editor should keep queued option-effect commands visible after commit');
assert(queuedEditorHtml.includes('Q.stability += 4'), 'right editor should keep queued fully-qualified option-effect commands visible after commit');
assert(queuedEditorHtml.includes('Simple source-backed Q effects can be applied automatically after review.'), 'right editor should explain guarded source-backed option effects');

const workbenchPath = 'source/scenes/events/workbench_matching.scene.dry';
const workbenchIndex = {
  project: {name: 'Workbench Matching Fixture'},
  scenes: [{
    id: 'workbench_matching',
    title: 'Workbench Matching',
    path: workbenchPath,
    type: 'event',
    options: [{
      target: {id: 'force_approach'},
      title: 'Force the approach!',
      sourceSpan: {path: workbenchPath, line: 8, startLine: 8, endLine: 8, anchorText: '- @force_approach: Force the approach!', endAnchorText: '- @force_approach: Force the approach!'}
    }],
    sections: [{
      id: 'workbench_matching.force_approach',
      sourceSpan: {path: workbenchPath, startLine: 20, endLine: 30},
      routes: {},
      options: []
    }],
    sourceSpan: {path: workbenchPath, startLine: 1, endLine: 40}
  }],
  semantic: {textCorpus: {items: [
    {id: 'workbench_option', text: 'Force the approach!', role: 'option_label', owner: {kind: 'scene', sceneId: 'workbench_matching', sectionId: 'start', itemId: 'force_approach'}, source: {path: workbenchPath, line: 8, anchorText: '- @force_approach: Force the approach!', endAnchorText: '- @force_approach: Force the approach!'}},
    {id: 'workbench_effect', text: 'Q.stability += 2;', role: 'script', owner: {kind: 'scene', sceneId: 'workbench_matching', sectionId: 'workbench_matching.force_approach'}, source: {path: workbenchPath, line: 24, anchorText: 'Q.stability += 2;', endAnchorText: 'Q.stability += 2;'}}
  ]}}
};
const workbench = eventWorkbench.buildEventWorkbench(workbenchIndex, 'workbench_matching', {});
assert(workbench.options[0].effects.some((effect) => effect.displayExpression === 'Q.stability += 2'), 'Event Workbench should map fully-qualified section effects back to the matching option row');
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
assert(laborExisting.eventBody.assets.some((asset) => asset.role === 'event_illustration' && asset.roleLabel === 'Event illustration' && asset.rowKind === 'asset_ref'), 'existing event asset rows should use the shared Object Canvas asset contract');
assert(laborExisting.eventBody.assets.some((asset) => asset.path === 'img/events/iron_front_branch.png' && asset.placementKind === 'option_result_visual' && asset.optionId === 'support_labor' && asset.flowAsset), 'existing branch face-image should be classified as an option-result flow asset');
const laborSupportRemoveLayer = laborExisting.eventBody.structureActions.find((field) => field.structureAction === 'remove_layer' && field.sectionId === 'labor_unrest.support_labor');
assert(laborSupportRemoveLayer && laborSupportRemoveLayer.editability === 'advanced_source_patch', 'referenced leaf result layers with exact incoming option and exact body text should be advanced-deleteable when the parser inferred the section header');
assert(laborSupportRemoveLayer.structureSourceBlock && laborSupportRemoveLayer.structureSourceBlock.kind === 'layer_bundle_delete', 'advanced referenced leaf deletion should carry a bundle delete source block');
assert(laborSupportRemoveLayer.structureSourceBlock.sectionSource.anchorText === '@support_labor', 'advanced referenced leaf deletion should infer the local section header from the result section id');
assert(laborSupportRemoveLayer.structureSourceBlock.incomingOptionSources.length === 1, 'advanced referenced leaf deletion should preserve the exact incoming option line evidence');
const laborSupportDeleteCanvas = canvasModel.buildExistingCanvas(index, 'events', 'labor_unrest', {
  values: {[laborSupportRemoveLayer.id]: 'true'}
});
assert(laborSupportDeleteCanvas.changeState.installPlan.operations.some((operation) => operation.type === 'replace_section' && operation.anchorText === '@support_labor' && operation.safety === 'advanced_apply'), 'referenced leaf layer deletion should replace the inferred result section through advanced apply');
assert(laborSupportDeleteCanvas.changeState.installPlan.operations.some((operation) => operation.type === 'replace_text' && operation.search === '- @support_labor: Support labor.' && operation.safety === 'advanced_apply'), 'referenced leaf layer deletion should also delete the exact incoming option line');
assert(!laborSupportDeleteCanvas.changeState.installPlan.operations.some((operation) => operation.type === 'manual_snippet'), 'referenced leaf layer deletion should not fall back to manual snippets');
const laborNoMinistryRemoveLayer = laborExisting.eventBody.structureActions.find((field) => field.structureAction === 'remove_layer' && field.sectionId === 'labor_unrest.no_ministry');
assert(laborNoMinistryRemoveLayer && laborNoMinistryRemoveLayer.editability === 'advanced_source_patch', 'standalone source-spanned layers with exact body text should be advanced-deleteable even when the parser inferred the section header');
assert(laborNoMinistryRemoveLayer.structureSourceBlock && laborNoMinistryRemoveLayer.structureSourceBlock.kind === 'layer_section_delete', 'advanced inferred layer deletion should carry a section delete source block');
assert(laborNoMinistryRemoveLayer.structureSourceBlock.sectionSource.anchorText === '@no_ministry', 'advanced inferred layer deletion should derive the local Dendry section header from the section id');
assert(laborNoMinistryRemoveLayer.structureSourceBlock.sectionSource.endAnchorText === 'The ministry is outside our control.', 'advanced inferred layer deletion should use exact body text as the dry-run end anchor');
const laborNoMinistryDeleteCanvas = canvasModel.buildExistingCanvas(index, 'events', 'labor_unrest', {
  values: {[laborNoMinistryRemoveLayer.id]: 'true'}
});
const laborNoMinistryDeleteOp = laborNoMinistryDeleteCanvas.changeState.installPlan.operations.find((operation) => {
  return operation.type === 'replace_section' && operation.anchorText === '@no_ministry';
});
assert(laborNoMinistryDeleteOp && laborNoMinistryDeleteOp.safety === 'advanced_apply', 'standalone inferred layer deletion should become an advanced replace_section operation');
assert(!laborNoMinistryDeleteCanvas.changeState.installPlan.operations.some((operation) => operation.type === 'manual_snippet'), 'standalone inferred layer deletion should not fall back to manual snippets');
const laborAssetPreviewHtml = previewEditor.renderPreviewPane(laborExisting);
assert(laborAssetPreviewHtml.includes('data-object-canvas-assets-panel="true"'), 'existing event preview should render the Object Canvas assets panel');
assert(laborAssetPreviewHtml.includes('data-object-canvas-asset-slots="true"'), 'existing event preview should render Object Canvas asset slot markers');
assert(laborAssetPreviewHtml.includes('data-asset-slot-role="event_illustration"'), 'existing event asset slots should expose the event illustration role marker');
assert(laborAssetPreviewHtml.includes('data-asset-role="event_illustration"'), 'existing event asset rows should expose stable role markers');
assert(laborAssetPreviewHtml.includes('data-object-canvas-flow-assets="true"'), 'existing event preview should render flow-positioned asset groups');
assert(laborAssetPreviewHtml.includes('data-asset-placement-kind="option_result_visual"'), 'existing branch assets should expose option-result placement markers');
const laborFlowSummaryStart = laborAssetPreviewHtml.indexOf('data-object-canvas-flow-asset-summary="true"');
const laborFlowSummaryHtml = laborFlowSummaryStart >= 0
  ? laborAssetPreviewHtml.slice(laborFlowSummaryStart, laborAssetPreviewHtml.indexOf('</section>', laborFlowSummaryStart))
  : '';
assert(laborFlowSummaryHtml.includes('data-object-canvas-flow-asset-add-summary="true"'), 'flow asset summary should collapse global add-here controls into a count');
assert(!laborFlowSummaryHtml.includes('data-object-canvas-asset-select="true"'), 'flow asset summary should not render every add-here asset selector');
const laborAssetEditorHtml = previewEditor.render(laborExisting);
assert(laborAssetEditorHtml.includes('data-preview-object-inline-add="add_option"'), 'existing event editor should keep the player-choice add-option entry visible after asset panel rendering');
assert(laborAssetEditorHtml.includes('data-object-canvas-assets-panel="true"'), 'existing event editor should render the same Object Canvas asset panel as the preview pane');
assert(laborAssetEditorHtml.includes('data-asset-slot-role="event_illustration"'), 'existing event editor asset panel should expose the event illustration slot marker');
assert(laborAssetEditorHtml.includes('data-existing-asset-add-field="asset_add_event_portrait"'), 'existing event empty asset slots should expose source-backed add controls');
assert(laborAssetEditorHtml.includes('data-asset-directive="face-image"'), 'existing event add controls should carry the directive to insert');
assert(laborAssetEditorHtml.includes('data-object-canvas-flow-asset-add="true"'), 'existing event editor should expose add-here controls for flow-positioned assets');
assert(laborAssetEditorHtml.includes('Add image to option result'), 'existing flow asset add labels should be normalized through the localized wording');
const largeCatalog = Array.from({length: 650}, (_item, index) => ({
  path: 'img/events/filler_' + String(index).padStart(3, '0') + '.jpg',
  type: 'image',
  label: 'Filler asset ' + String(index).padStart(3, '0'),
  fileExists: true
})).concat({
  path: 'img/events/late-related.jpg',
  type: 'image',
  label: 'Late related campaign',
  fileExists: true
});
const lateRelatedHtml = previewEditor.render({
  mode: 'existing',
  objectKind: 'event',
  objectId: 'late_related_fixture',
  title: 'Late Related Fixture',
  eventBody: {
    title: {value: 'Late Related Fixture'},
    sections: [{id: 'late_related_fixture.opening', value: 'Opening text.'}],
    branchSections: [{
      id: 'late_related_fixture.branch',
      sectionId: 'late_related_fixture.branch',
      relatedOptionIds: ['late_branch'],
      semanticRole: 'option_result_text',
      label: 'Option: Late branch',
      value: 'The option result contains a related image.'
    }],
    assets: [{
      path: 'img/events/late-related.jpg',
      type: 'image',
      label: 'Late related campaign',
      placementKind: 'option_result_visual',
      sectionId: 'late_related_fixture.branch',
      optionId: 'late_branch',
      flowAsset: true
    }],
    assetCatalog: largeCatalog,
    assetAddFields: [{
      id: 'asset_add_flow_late_branch',
      role: 'event_illustration',
      directive: 'face-image',
      type: 'image',
      placementKind: 'option_result_visual',
      sectionId: 'late_related_fixture.branch',
      optionId: 'late_branch',
      displayLocation: 'Option: Late branch'
    }]
  }
});
const lateSelectMarker = lateRelatedHtml.indexOf('data-existing-asset-add-field="asset_add_flow_late_branch"');
const lateSelectHtml = lateRelatedHtml.slice(lateRelatedHtml.lastIndexOf('<select', lateSelectMarker), lateRelatedHtml.indexOf('</select>', lateSelectMarker));
const latePickerHtml = lateRelatedHtml.slice(lateRelatedHtml.lastIndexOf('<div class="object-canvas-flow-asset-add"', lateSelectMarker), lateRelatedHtml.indexOf('</div>', lateSelectMarker) + 6);
assert(latePickerHtml.includes('data-object-canvas-asset-filter="true"'), 'large asset selectors should expose an inline filter for finding Dynamic-scale assets');
assert(latePickerHtml.includes('651 indexed assets'), 'large asset selectors should show the full candidate count instead of hiding catalog size');
assert(lateSelectHtml.includes('img/events/late-related.jpg'), 'local flow add selector should prioritize related event assets even when the project catalog is large');
assert(lateSelectHtml.includes('img/events/filler_649.jpg'), 'large project asset selectors should expose the full Dynamic-scale image list, not only the first page of candidates');
const outHtmlAssetSelectorHtml = previewEditor.render({
  mode: 'existing',
  objectKind: 'event',
  objectId: 'out_html_selector_fixture',
  title: 'out/html selector fixture',
  eventBody: {
    title: {value: 'out/html selector fixture'},
    sections: [],
    options: [],
    assets: [],
    assetCatalog: [{path: 'out/html/img/article48.jpg', type: 'image', label: 'article48.jpg', fileExists: true}],
    assetAddFields: [{
      id: 'asset_add_event_background',
      role: 'event_background',
      directive: 'set-bg',
      type: 'image',
      placementKind: 'global_slot',
      displayLocation: 'Global media slot'
    }]
  }
});
assert(outHtmlAssetSelectorHtml.includes('&quot;path&quot;:&quot;img/article48.jpg&quot;'), 'asset selector values should write Dendry source-relative paths instead of out/html runtime paths');
assert(outHtmlAssetSelectorHtml.includes('&quot;previewUrl&quot;:&quot;out/html/img/article48.jpg&quot;'), 'asset selector values should preserve runtime preview paths separately from source refs');
const existingAssetEvent = canvasModel.buildExistingCanvas(index, 'events', 'asset_directive_event', {});
assert(existingAssetEvent.eventBody.assets.some((asset) => asset.directive === 'face-image' && asset.role === 'event_portrait' && asset.assetEditFieldId === 'asset_face_image_7'), 'existing face-image directive should map to a source-backed asset edit field');
assert(existingAssetEvent.eventBody.assets.some((asset) => asset.directive === 'set-bg' && asset.role === 'event_background' && asset.assetEditFieldId === 'asset_set_bg_8'), 'existing set-bg directive should map to a source-backed asset edit field');
assert(existingAssetEvent.eventBody.assets.some((asset) => asset.directive === 'audio' && asset.role === 'event_audio' && asset.assetEditFieldId === 'asset_audio_9'), 'existing audio directive should map to a source-backed asset edit field');
assert(existingAssetEvent.eventBody.assets.some((asset) => asset.directive === 'inline-image' && asset.role === 'event_illustration' && asset.assetEditFieldId === 'asset_inline_image_10'), 'existing inline image evidence should map into the managed event illustration slot');
assert(existingAssetEvent.eventBody.assetAddFields.some((field) => field.id === 'asset_add_event_illustration' && field.role === 'event_illustration' && field.directive === 'face-image'), 'existing opening inline images should not hide the event illustration add slot and should add a runtime image directive');
const existingAssetPreviewHtml = previewEditor.renderPreviewPane(existingAssetEvent);
assert(existingAssetPreviewHtml.includes('data-object-canvas-asset-replacement="true"'), 'existing exact asset directives should expose Object Canvas replacement controls');
assert(existingAssetPreviewHtml.includes('data-existing-asset-field="asset_face_image_7"'), 'existing asset replacement control should carry the source-backed field id');
assert(existingAssetPreviewHtml.includes('data-asset-directive="face-image"'), 'existing asset replacement control should preserve the source directive marker');
assert(existingAssetPreviewHtml.includes('data-existing-asset-field="asset_inline_image_10"'), 'existing inline image slot should expose replacement/removal controls');
assert(existingAssetPreviewHtml.includes('data-asset-directive="inline-image"'), 'existing inline image controls should preserve the inline directive marker');
assert(existingAssetPreviewHtml.includes('data-existing-asset-add-field="asset_add_event_illustration"'), 'existing event illustration slot should expose a source-backed add control when current inline images are flow assets');
assert(existingAssetPreviewHtml.includes('data-object-canvas-action="remove_asset_reference"'), 'existing exact asset references should expose a remove-reference action');
const existingAssetEditorHtml = previewEditor.render(existingAssetEvent);
assert(existingAssetEditorHtml.includes('data-object-canvas-asset-replacement="true"'), 'existing event editor should expose exact asset replacement controls in the editing pane');
assert(existingAssetEditorHtml.includes('data-existing-asset-field="asset_face_image_7"'), 'existing event editor replacement control should carry the source-backed field id');
const eventReplacementTarget = 'assets/studio/events/asset_directive_event/new-face.png';
const existingAssetReplacement = canvasModel.buildExistingCanvas(index, 'events', 'asset_directive_event', {
  values: {
    asset_face_image_7: 'face-image: ' + eventReplacementTarget
  },
  proposalOptions: {
    assetInstallRequests: [{
      sourceName: 'New Face.png',
      sourcePath: '/tmp/New Face.png',
      targetPath: eventReplacementTarget,
      type: 'image',
      label: 'New Face.png',
      role: 'event_portrait'
    }]
  }
});
assert(existingAssetReplacement.changeState.proposal.changes.some((change) => change.before === 'face-image: img/events/current-face.png' && change.after === 'face-image: ' + eventReplacementTarget), 'existing asset replacement should build an exact before/after source change');
assert(existingAssetReplacement.changeState.installPlan.operations.some((operation) => operation.type === 'replace_text' && operation.safety === 'guarded_apply' && operation.search === 'face-image: img/events/current-face.png'), 'existing asset replacement should produce a guarded replace_text operation');
assert(existingAssetReplacement.changeState.installPlan.operations.some((operation) => operation.type === 'copy_asset_file' && operation.safety === 'guarded_apply' && operation.sourcePath === '/tmp/New Face.png' && operation.path === eventReplacementTarget), 'existing asset replacement should include a guarded copy_asset_file when desktop sourcePath is present');
assert(existingAssetReplacement.eventBody.assets.some((asset) => asset.rowKind === 'asset_install_request' && asset.path === eventReplacementTarget && asset.role === 'event_portrait'), 'existing asset replacement should render the pending asset install request row');
assert(existingAssetReplacement.eventBody.assets.some((asset) => asset.rowKind === 'asset_install_request' && asset.referenceState && asset.referenceState.key === 'pending_install'), 'existing local asset replacement should show pending install rather than missing asset');
const existingAssetReplacementHtml = previewEditor.renderPreviewPane(existingAssetReplacement);
assert(existingAssetReplacementHtml.includes('data-asset-state="pending_install"'), 'existing local asset replacement preview should mark pending install rows with a stable state');
assert(!/data-asset-row-kind="asset_install_request"[\s\S]{0,500}Missing asset/.test(existingAssetReplacementHtml), 'existing local asset replacement preview should not label queued local files as missing assets');
const inlineReplacementTarget = 'assets/studio/events/asset_directive_event/inline-new.jpg';
const existingInlineReplacement = canvasModel.buildExistingCanvas(index, 'events', 'asset_directive_event', {
  values: {
    asset_inline_image_10: '![Campaign crowd](' + inlineReplacementTarget + ')'
  }
});
assert(existingInlineReplacement.changeState.proposal.changes.some((change) => change.before === '![Campaign crowd](img/events/current-inline.jpg)' && change.after === '![Campaign crowd](' + inlineReplacementTarget + ')'), 'existing inline image replacement should preserve the markdown line while changing the referenced path');
assert(existingInlineReplacement.changeState.installPlan.operations.some((operation) => operation.type === 'replace_text' && operation.safety === 'guarded_apply' && operation.search === '![Campaign crowd](img/events/current-inline.jpg)' && operation.replace === '![Campaign crowd](' + inlineReplacementTarget + ')'), 'existing inline image replacement should produce a guarded replace_text operation');
const existingInlineRemoval = canvasModel.buildExistingCanvas(index, 'events', 'asset_directive_event', {
  values: {
    asset_inline_image_10: ''
  }
});
assert(existingInlineRemoval.changeState.proposal.changes.some((change) => change.fieldId === 'asset_inline_image_10' && change.allowEmptyReplace), 'existing inline image removal should preserve the empty replace safety marker');
assert(existingInlineRemoval.changeState.installPlan.operations.some((operation) => operation.type === 'replace_text' && operation.safety === 'guarded_apply' && operation.search === '![Campaign crowd](img/events/current-inline.jpg)' && operation.replace === ''), 'existing inline image removal should produce a guarded line removal proposal');
const existingInlineRemovalHtml = previewEditor.render(existingInlineRemoval);
assert(existingInlineRemovalHtml.includes('data-asset-removal-state="pending"'), 'existing inline image removal editor should mark the pending removal action state');
assert(existingInlineRemovalHtml.includes('Undo removal'), 'existing inline image removal editor should relabel the right-pane action as undo removal');
const existingAssetAdd = canvasModel.buildExistingCanvas(index, 'events', 'labor_unrest', {
  values: {
    asset_add_event_portrait: 'face-image: img/events/indexed-portrait.png'
  }
});
assert(existingAssetAdd.changeState.proposal.changes.some((change) => change.fieldId === 'asset_add_event_portrait' && change.operationType === 'insert_text'), 'existing event add-asset control should build an insert_text proposal');
assert(existingAssetAdd.changeState.installPlan.operations.some((operation) => operation.type === 'insert_text' && operation.safety === 'guarded_apply' && operation.content.includes('face-image: img/events/indexed-portrait.png')), 'existing event add-asset control should produce a guarded insert_text operation');
assert(existingAssetAdd.eventBody.assets.some((asset) => asset.path === 'img/events/indexed-portrait.png' && asset.role === 'event_portrait' && asset.status === 'pending_addition'), 'existing event indexed add should render an immediate pending asset row');
const existingAssetAddHtml = previewEditor.renderPreviewPane(existingAssetAdd);
assert(existingAssetAddHtml.includes('<code>img/events/indexed-portrait.png</code>'), 'existing event indexed add should update the visible slot path immediately');
assert(existingAssetAddHtml.includes('data-object-canvas-action="clear_asset_addition"') && existingAssetAddHtml.includes('data-existing-asset-add-field="asset_add_event_portrait"'), 'existing event pending add should expose a clear-addition action');
const existingRuntimePathAssetAdd = canvasModel.buildExistingCanvas(index, 'events', 'labor_unrest', {
  values: {
    asset_add_event_background: 'set-bg: img/events/runtime-indexed.png'
  }
});
assert(existingRuntimePathAssetAdd.eventBody.assets.some((asset) => asset.path === 'img/events/runtime-indexed.png' && asset.previewUrl === 'out/html/img/events/runtime-indexed.png'), 'pending indexed adds should keep runtime previewUrl while writing source-relative paths');
const existingAudioAdd = canvasModel.buildExistingCanvas(index, 'events', 'labor_unrest', {
  values: {
    asset_add_event_audio: 'audio: audio/events/indexed-theme.ogg'
  }
});
assert(existingAudioAdd.changeState.installPlan.operations.some((operation) => operation.type === 'insert_text' && operation.content.includes('audio: audio/events/indexed-theme.ogg')), 'existing event audio add should produce a guarded insert_text operation');
assert(existingAudioAdd.eventBody.assets.some((asset) => asset.path === 'audio/events/indexed-theme.ogg' && asset.role === 'event_audio' && asset.type === 'audio' && asset.status === 'pending_addition'), 'existing event audio indexed add should render as pending audio immediately');
const existingIllustrationAdd = canvasModel.buildExistingCanvas(index, 'events', 'asset_directive_event', {
  values: {
    asset_add_event_illustration: 'face-image: img/events/indexed-portrait.png'
  }
});
assert(existingIllustrationAdd.eventBody.assets.some((asset) => asset.path === 'img/events/indexed-portrait.png' && asset.role === 'event_illustration' && asset.status === 'pending_addition' && asset.flowAsset === false), 'existing event illustration add should render as a pending slot asset instead of disappearing into flow summary');
assert(existingIllustrationAdd.changeState.installPlan.operations.some((operation) => operation.type === 'insert_text' && operation.content.includes('face-image: img/events/indexed-portrait.png')), 'existing event illustration add should write a runtime face-image directive');
const branchReplacementTarget = 'assets/studio/events/labor_unrest/iron-front-new.png';
const existingBranchAssetReplacement = canvasModel.buildExistingCanvas(index, 'events', 'labor_unrest', {
  values: {
    asset_face_image_20: 'face-image: ' + branchReplacementTarget
  }
});
assert(existingBranchAssetReplacement.changeState.proposal.changes.some((change) => change.fieldId === 'asset_face_image_20' && change.after === 'face-image: ' + branchReplacementTarget), 'existing branch face-image replacement should keep the source-backed branch field id');
assert(existingBranchAssetReplacement.changeState.installPlan.operations.some((operation) => operation.type === 'replace_text' && operation.safety === 'guarded_apply' && operation.search === 'face-image: img/events/iron_front_branch.png'), 'existing branch face-image replacement should produce a guarded source replace operation');
const existingBranchAssetRemoval = canvasModel.buildExistingCanvas(index, 'events', 'labor_unrest', {
  values: {
    asset_face_image_20: ''
  }
});
assert(existingBranchAssetRemoval.changeState.installPlan.operations.some((operation) => operation.type === 'replace_text' && operation.safety === 'guarded_apply' && operation.search === 'face-image: img/events/iron_front_branch.png' && operation.replace === ''), 'existing branch face-image removal should produce a guarded line removal operation');
const existingBranchAssetAdd = canvasModel.buildExistingCanvas(index, 'events', 'labor_unrest', {
  values: {
    asset_add_flow_support_labor: 'face-image: img/events/support-branch-added.png'
  }
});
assert(existingBranchAssetAdd.changeState.proposal.changes.some((change) => change.fieldId === 'asset_add_flow_support_labor' && change.operationType === 'insert_text'), 'existing branch add-here control should build a source-backed insert proposal');
assert(existingBranchAssetAdd.changeState.installPlan.operations.some((operation) => operation.type === 'insert_text' && operation.safety === 'guarded_apply' && operation.content.includes('face-image: img/events/support-branch-added.png')), 'existing branch add-here control should produce a guarded branch insert operation');
assert(existingBranchAssetAdd.changeState.installPlan.operations.some((operation) => operation.type === 'insert_text' && operation.position === 'before' && operation.anchorText === 'The cabinet makes a public concession.'), 'existing branch add-here control should insert image directives before branch body text so Dendry parses them as metadata');
assert(existingBranchAssetAdd.eventBody.assets.some((asset) => asset.path === 'img/events/support-branch-added.png' && asset.status === 'pending_addition' && asset.placementKind === 'option_result_visual'), 'existing branch add-here control should render a pending flow-positioned asset row');
const branchAssetApplyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_branch_asset_insert_'));
const branchAssetSourcePath = path.join(branchAssetApplyRoot, 'source', 'scenes', 'events');
fs.mkdirSync(branchAssetSourcePath, {recursive: true});
fs.writeFileSync(path.join(branchAssetApplyRoot, 'source', 'info.dry'), 'title: Branch asset insert fixture\n', 'utf8');
const branchAssetFixtureLines = Array.from({length: 24}, (_, index) => 'fixture line ' + (index + 1));
branchAssetFixtureLines[20] = 'The cabinet makes a public concession.';
fs.writeFileSync(path.join(branchAssetSourcePath, 'labor_unrest.scene.dry'), branchAssetFixtureLines.join('\n') + '\n', 'utf8');
const branchAssetPlan = Object.assign({}, existingBranchAssetAdd.changeState.installPlan, {
  project: Object.assign({}, existingBranchAssetAdd.changeState.installPlan.project || {}, {root: branchAssetApplyRoot})
});
const branchAssetApply = installPlanApi.applyInstallPlan(branchAssetPlan, {projectRoot: branchAssetApplyRoot, dryRun: false});
const branchAssetAppliedSource = fs.readFileSync(path.join(branchAssetSourcePath, 'labor_unrest.scene.dry'), 'utf8');
assert(branchAssetApply.ok, 'existing branch add-here insert should apply against exact source evidence: ' + JSON.stringify(branchAssetApply.diagnostics || branchAssetApply.results || branchAssetApply));
assert(branchAssetAppliedSource.indexOf('face-image: img/events/support-branch-added.png') < branchAssetAppliedSource.indexOf('The cabinet makes a public concession.'), 'existing branch add-here install should write image directives before branch body text');
const existingBranchAssetAddHtml = previewEditor.render(existingBranchAssetAdd);
assert(existingBranchAssetAddHtml.includes('data-object-canvas-action="clear_asset_addition"') && existingBranchAssetAddHtml.includes('data-existing-asset-add-field="asset_add_flow_support_labor"'), 'existing branch pending add should expose a clear-addition action');
const proposalOnlyReplacement = canvasModel.buildExistingCanvas(index, 'events', 'asset_directive_event', {
  values: {
    asset_set_bg_8: 'set-bg: assets/studio/events/asset_directive_event/new-bg.jpg'
  },
  proposalOptions: {
    assetInstallRequests: [{
      sourceName: 'New Background.jpg',
      targetPath: 'assets/studio/events/asset_directive_event/new-bg.jpg',
      type: 'image',
      label: 'New Background.jpg',
      role: 'event_background'
    }]
  }
});
assert(proposalOnlyReplacement.changeState.installPlan.operations.some((operation) => operation.type === 'copy_asset_file' && operation.safety === 'manual_review'), 'existing asset replacement without desktop sourcePath should keep copy_asset_file manual-review');
const fuzzyAssetCanvas = canvasModel.buildExistingCanvas(index, 'events', 'fuzzy_asset_event', {});
const fuzzyAssetHtml = previewEditor.renderPreviewPane(fuzzyAssetCanvas);
assert(!fuzzyAssetHtml.includes('data-object-canvas-asset-replacement="true"'), 'fuzzy asset directives should not expose guarded replacement controls');
const existingAssetCard = canvasModel.buildExistingCanvas(index, 'cards', 'asset_directive_card', {
  values: {
    asset_card_image_6: 'card-image: assets/studio/cards/asset_directive_card/new-card.png'
  },
  proposalOptions: {
    assetInstallRequests: [{
      sourceName: 'New Card.png',
      sourcePath: '/tmp/New Card.png',
      targetPath: 'assets/studio/cards/asset_directive_card/new-card.png',
      type: 'image',
      label: 'New Card.png',
      role: 'card_image'
    }]
  }
});
assert(existingAssetCard.objectKind === 'card', 'existing card asset directive should stay in card Object Canvas mode');
assert(existingAssetCard.eventBody.assets.some((asset) => asset.directive === 'card-image' && asset.role === 'card_image' && asset.assetEditFieldId === 'asset_card_image_6'), 'existing card-image directive should map to a card source-backed asset edit field');
assert(existingAssetCard.changeState.installPlan.operations.some((operation) => operation.type === 'replace_text' && operation.safety === 'guarded_apply' && operation.search === 'card-image: img/cards/current-card.png'), 'existing card-image replacement should produce a guarded replace_text operation');
assert(existingAssetCard.changeState.installPlan.operations.some((operation) => operation.type === 'copy_asset_file' && operation.safety === 'guarded_apply' && operation.path === 'assets/studio/cards/asset_directive_card/new-card.png'), 'existing card-image replacement should include a guarded copy_asset_file operation');
const existingAssetCardEditorHtml = previewEditor.render(existingAssetCard);
assert(existingAssetCardEditorHtml.includes('data-object-canvas-assets-panel="true"'), 'existing Card editor should render the Object Canvas asset panel');
assert(existingAssetCardEditorHtml.includes('data-existing-asset-field="asset_card_image_6"'), 'existing Card editor should expose card-image replacement controls');
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
function nestedChoiceSource(path, line, text) {
  return {path, line, startLine: line, endLine: line, anchorText: text, endAnchorText: text};
}
const nestedChoicePath = 'source/scenes/events/blutmai.scene.dry';
const nestedChoiceScene = {
  id: 'blutmai',
  title: 'May Day, 1929',
  path: nestedChoicePath,
  tags: ['event'],
  sourceSpan: {path: nestedChoicePath, startLine: 1, endLine: 80},
  options: [
    {id: 'ban', title: 'Ban the demonstrations.', target: {id: 'ban'}, sourceSpan: nestedChoiceSource(nestedChoicePath, 10, '- @ban: Ban the demonstrations.')}
  ],
  sections: [
    {
      id: 'blutmai.ban',
      title: 'Ban',
      options: [
        {id: 'corrupt_police', title: 'It is the fault of corrupt police.', target: {id: 'corrupt_police'}, sourceSpan: nestedChoiceSource(nestedChoicePath, 20, '- @corrupt_police: It is the fault of corrupt police.')},
        {id: 'communist_fault', title: 'It is the fault of the Communists.', target: {id: 'communist_fault'}, sourceSpan: nestedChoiceSource(nestedChoicePath, 21, '- @communist_fault: It is the fault of the Communists.')},
        {id: 'no_fault', title: "It is no one's fault.", target: {id: 'no_fault'}, sourceSpan: nestedChoiceSource(nestedChoicePath, 22, "- @no_fault: It is no one's fault.")}
      ]
    },
    {id: 'blutmai.corrupt_police', title: 'Corrupt Police'},
    {id: 'blutmai.communist_fault', title: 'Communist Fault'},
    {id: 'blutmai.no_fault', title: 'No Fault'}
  ]
};
const nestedChoiceTextRows = [
  ['blutmai_title', 'May Day, 1929', 'title', '', 1],
  ['blutmai_body', 'Opening text.', 'body', '', 5],
  ['ban_body', 'We issued the order to ban.', 'body', 'blutmai.ban', 19],
  ['corrupt_body', 'We blamed corrupt police.', 'body', 'blutmai.corrupt_police', 30],
  ['communist_body', 'We blamed the Communists.', 'body', 'blutmai.communist_fault', 31],
  ['no_fault_body', 'We treated it as no fault.', 'body', 'blutmai.no_fault', 32]
].map(([id, text, role, sectionId, line]) => ({
  id,
  text,
  role,
  owner: {kind: 'scene', sceneId: 'blutmai', sectionId},
  source: nestedChoiceSource(nestedChoicePath, line, text)
}));
const nestedChoiceCanvas = canvasModel.buildExistingCanvas({
  scenes: [nestedChoiceScene],
  semantic: {events: [{id: 'blutmai', title: 'May Day, 1929', path: nestedChoicePath}], cards: [], textCorpus: {items: nestedChoiceTextRows}},
  project: {profileIds: []}
}, 'events', 'blutmai', {});
assert(nestedChoiceCanvas.ok, 'nested section-owned choice fixture should build');
const nestedChoiceOptions = nestedChoiceCanvas.eventBody.options || [];
const banOption = nestedChoiceOptions.find((option) => option.id === 'ban');
const nestedOptions = nestedChoiceOptions.filter((option) => String(option.sectionId || '') === 'blutmai.ban');
assert(banOption && banOption.resultFields.length === 1 && banOption.resultFields[0].sectionId === 'blutmai.ban', 'parent option should own only its result-menu text');
assert(nestedOptions.length === 3, 'section-owned follow-up player choices should stay as three distinct options');
nestedOptions.forEach((option) => {
  assert(option.resultFields.length === 1, 'nested option should not inherit the parent result-menu text');
  assert(option.resultFields[0].sectionId === option.targetId, 'nested option result text should come from its own target section');
});
const nestedRemoveActions = nestedChoiceCanvas.eventBody.structureActions.filter((field) => field.structureAction === 'remove_option');
assert(nestedRemoveActions.length === nestedChoiceOptions.length, 'nested choice editor should expose one remove action per option');
const nestedChildRemoveActions = nestedRemoveActions.filter((field) => String(field.sectionId || '') === 'blutmai.ban');
assert(nestedChildRemoveActions.length === nestedOptions.length, 'nested follow-up choices should expose one remove action each');
assert(nestedChildRemoveActions.every((field) => field.editability === 'advanced_source_patch'), 'source-backed nested follow-up option removals with result sections should be applyable advanced patches');
const nestedChoiceHtml = previewEditor.render(nestedChoiceCanvas, {locale: 'en'});
assert((nestedChoiceHtml.match(/preview-object-structure-delete/g) || []).length === nestedChoiceOptions.length, 'each nested option should render only its own delete action');
assert(nestedChoiceHtml.includes('Source-backed deletion can be applied after advanced confirmation.'), 'source-backed nested option deletion should not be shown as manual-review only');
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
    options: [{
      id: 'long_option',
      label: 'A long option label',
      fields: [{
        id: 'long_option_label',
        label: 'Player option',
        value: 'The <span style="color: #3E88B3;">**DNVP**</span> replaces us in government and leaves the player with a long visible choice.',
        original: '',
        status: 'guarded'
      }],
      targetId: 'long_option_target'
    }]
  }
});
assert(textareaRows(textareaSizingHtml, 'short_body') === 2, 'Preview Object Editor should keep very short textareas compact');
assert(textareaRows(textareaSizingHtml, 'long_body') > 2 && textareaRows(textareaSizingHtml, 'long_body') <= 14, 'Preview Object Editor should let longer textareas grow within a modest cap');
assert(textareaRows(textareaSizingHtml, 'long_option_label') >= 2, 'Preview Object Editor should render long player option labels as readable multi-line controls');

const newEvent = canvasModel.buildNewEventCanvas(index, {
  id: 'generic_intro_followup',
  title: 'Follow-up: Generic Intro',
  heading: 'Follow-up: Generic Intro',
  year: 1936,
  monthStart: 2,
  monthEnd: 4,
  assetRefs: [{path: 'img/events/followup-bg.png', type: 'image', label: 'Follow-up background', directive: 'set-bg'}],
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
assert(newEvent.eventBody.assets.some((asset) => asset.directive === 'set-bg' && asset.role === 'event_background'), 'new Event asset rows should map draft asset directives through the shared asset contract');
assert(newEvent.eventBody.eventStructure && newEvent.eventBody.eventStructure.provenance === 'draft', 'new Event editor body should be derived through EventStructure');
assert(newEvent.eventBody.structureActions.some((field) => field.structureAction === 'add_option'), 'new Event should expose EventStructure add-option controls');
assert(newEvent.eventBody.structureActions.some((field) => field.structureAction === 'add_branch'), 'new Event should expose EventStructure add-section controls');
const newEventHtml = previewEditor.render(newEvent);
assert(newEventHtml.includes('data-preview-object-condition-chips="true"') && newEventHtml.includes('public_order &gt;= 0'), 'new Event editor should render option conditions as scan-friendly chips');
assert(newEventHtml.includes('Updates the current draft.'), 'new Event structural creators should clearly show draft-update safety');
assert(newEventHtml.includes('data-object-canvas-assets-panel="true"'), 'new Event editor should render Object Canvas asset slots in the editing pane');
assert(newEventHtml.includes('data-object-canvas-asset-select="true"'), 'new Event editor should expose indexed asset selectors in the editing pane');
const newEventPreviewHtml = previewEditor.renderPreviewPane(newEvent);
assert(newEventPreviewHtml.includes('data-object-canvas-assets-panel="true"'), 'new Event preview should render the Object Canvas assets panel');
assert(newEventPreviewHtml.includes('data-object-canvas-asset-slots="true"'), 'new Event preview should render Object Canvas asset slot markers');
assert(newEventPreviewHtml.includes('data-asset-slot-role="event_background"'), 'new Event asset slots should expose background slot markers');
assert(newEventPreviewHtml.includes('data-asset-slot-role="event_audio"'), 'new Event asset slots should expose audio slot markers');
assert(newEventPreviewHtml.includes('data-asset-directive="set-bg"'), 'new Event asset rows should preserve source directive markers');
assert(newEventPreviewHtml.includes('data-object-canvas-asset-select="true"'), 'new Event asset panel should expose indexed asset selection controls');
assert(newEventPreviewHtml.includes('data-object-canvas-asset-file="true"'), 'new Event asset panel should expose local file proposal controls');
assert(newEvent.changeState.draft.effectsOnTrigger.some((effect) => effect.variable === 'public_order' && effect.value === 2), 'trigger effect edits should update the draft');
assert(newEvent.changeState.draft.options[0].effects.some((effect) => effect.variable === 'public_order' && effect.value === 1), 'option effect edits should update the draft');
assert(newEvent.contextBoard.flow.some((row) => row.direction === 'seed'), 'new Event context should include Design/Create seed context');
assert(newEvent.contextBoard.manualBoundaries.some((row) => row.label === 'Router wiring'), 'new Event should keep router wiring as manual-review context');
assert(newEvent.changeState.draft.kind === 'world_event', 'new Event draft should be a world_event draft');
assert(newEvent.changeState.output.installPlan, 'new Event should produce an install plan');
assert(newEvent.changeState.operationSummary.total > 0, 'new Event install plan should summarize operations');
assert(newEvent.changeState.output.scene.includes('max-visits: 1'), 'one-shot new Event should render a runtime-valid default max-visits value');

const largeNewEventAssetIndex = Object.assign({}, index, {
  semantic: Object.assign({}, index.semantic, {
    assets: {
      items: Array.from({length: 90}, (_item, assetIndex) => ({
        path: 'img/events/new-event-catalog-' + String(assetIndex).padStart(3, '0') + '.jpg',
        type: 'image',
        label: 'New event catalog ' + String(assetIndex).padStart(3, '0'),
        fileExists: true
      })).concat({
        path: 'audio/events/new-event-theme.ogg',
        type: 'audio',
        label: 'New event theme',
        fileExists: true
      })
    }
  })
});
const largeCatalogNewEvent = canvasModel.buildNewEventCanvas(largeNewEventAssetIndex, {
  id: 'large_catalog_new_event',
  title: 'Large catalog new event',
  heading: 'Large catalog new event',
  year: 1936,
  monthStart: 2,
  monthEnd: 4,
  options: [
    {id: 'first', title: 'First option', body: 'First result.'},
    {id: 'second', title: 'Second option', body: 'Second result.'}
  ]
}, {});
assert(largeCatalogNewEvent.eventBody.assetCatalog.length === 91, 'new Event asset catalog should keep the full project asset list for picker scoring');
assert(largeCatalogNewEvent.eventBody.assetCatalog.some((asset) => asset.path === 'audio/events/new-event-theme.ogg' && asset.role === 'event_audio'), 'new Event asset catalog should include late audio assets');

const indexedAssetEvent = canvasModel.buildNewEventCanvas(index, {
  id: 'indexed_asset_event',
  title: 'Indexed asset event',
  heading: 'Indexed asset event',
  year: 1936,
  monthStart: 2,
  monthEnd: 4,
  options: [{id: 'continue', title: 'Continue', body: 'Continue.'}]
}, {
  values: {
    'event.assetRef.event_portrait': JSON.stringify({path: 'img/events/indexed-portrait.png', type: 'image', label: 'Indexed portrait', role: 'event_portrait'}),
    'event.assetRef.event_audio': JSON.stringify({path: 'audio/events/indexed-theme.ogg', type: 'audio', label: 'Indexed theme', role: 'event_audio'})
  }
});
assert(indexedAssetEvent.changeState.draft.assetRefs.some((asset) => asset.path === 'img/events/indexed-portrait.png' && asset.role === 'event_portrait'), 'new Event indexed asset selection should write a role-aware assetRefs entry');
assert(indexedAssetEvent.changeState.draft.assetRefs.some((asset) => asset.path === 'audio/events/indexed-theme.ogg' && asset.role === 'event_audio'), 'new Event indexed audio selection should write a role-aware assetRefs entry');
assert(indexedAssetEvent.eventBody.assets.some((asset) => asset.path === 'img/events/indexed-portrait.png' && asset.role === 'event_portrait'), 'new Event indexed asset selection should render through shared asset rows');
assert(indexedAssetEvent.changeState.output.scene.includes('face-image: img/events/indexed-portrait.png'), 'new Event indexed portrait asset should render a Dendry face-image directive');
assert(indexedAssetEvent.changeState.output.scene.includes('audio: audio/events/indexed-theme.ogg'), 'new Event indexed audio asset should render a Dendry audio directive');

const localAssetEvent = canvasModel.buildNewEventCanvas(index, {
  id: 'local_asset_event',
  title: 'Local asset event',
  heading: 'Local asset event',
  year: 1936,
  monthStart: 2,
  monthEnd: 4,
  options: [{id: 'continue', title: 'Continue', body: 'Continue.'}]
}, {
  values: {
    'event.assetInstallRequest.event_illustration': JSON.stringify({
      sourceName: 'Hero Local.png',
      sourcePath: '/tmp/Hero Local.png',
      targetPath: 'assets/studio/events/local_asset_event/hero-local.png',
      type: 'image',
      label: 'Hero Local.png',
      role: 'event_illustration'
    })
  }
});
assert(localAssetEvent.changeState.draft.assetRefs.some((asset) => asset.path === 'assets/studio/events/local_asset_event/hero-local.png' && asset.role === 'event_illustration'), 'new Event local asset proposal should create the matching target assetRefs entry');
assert(localAssetEvent.changeState.draft.assetInstallRequests.some((request) => request.sourcePath === '/tmp/Hero Local.png' && request.targetPath === 'assets/studio/events/local_asset_event/hero-local.png'), 'new Event local asset proposal should preserve desktop sourcePath and targetPath');
assert(localAssetEvent.changeState.installPlan.operations.some((operation) => operation.type === 'copy_asset_file' && operation.sourcePath === '/tmp/Hero Local.png' && operation.path === 'assets/studio/events/local_asset_event/hero-local.png'), 'new Event local asset proposal should produce a copy_asset_file operation');
assert(localAssetEvent.changeState.output.scene.includes('set-bg: assets/studio/events/local_asset_event/hero-local.png'), 'new Event local illustration proposal should render a Dendry set-bg directive');

const branchAssetEvent = canvasModel.buildNewEventCanvas(index, {
  id: 'presidential_1932_fixture',
  title: '1932 Campaign Fixture',
  heading: '1932 Campaign Fixture',
  year: 1932,
  monthStart: 3,
  monthEnd: 4,
  introParagraphs: ['The campaign opens with a public rally.'],
  options: [
    {id: 'campaigning_braun', title: 'Campaign with Braun', body: 'Braun answers the crowd from the platform.'},
    {id: 'stay_quiet', title: 'Stay quiet', body: 'The posters stay rolled up.'}
  ]
}, {
  values: {
    'event.assetPlacementRef.option_campaigning_braun': JSON.stringify({
      path: 'img/events/iron-front.png',
      type: 'image',
      label: 'Iron Front poster',
      role: 'event_illustration',
      directive: 'face-image',
      placementId: 'option_campaigning_braun',
      placementKind: 'option_result_visual',
      optionId: 'campaigning_braun',
      displayLocation: 'Option: Campaign with Braun'
    })
  }
});
const branchAssetScene = branchAssetEvent.changeState.output.scene;
const branchOptionIndex = branchAssetScene.indexOf('@campaigning_braun');
const branchImageIndex = branchAssetScene.indexOf('face-image: img/events/iron-front.png');
assert(branchAssetEvent.changeState.draft.assetPlacements.some((asset) => asset.path === 'img/events/iron-front.png' && asset.optionId === 'campaigning_braun'), 'new Event flow asset selection should write a placement-scoped draft asset');
assert(!branchAssetEvent.changeState.draft.assetRefs.some((asset) => asset.path === 'img/events/iron-front.png'), 'new Event flow asset selection should not pollute global assetRefs');
assert(branchOptionIndex >= 0 && branchImageIndex > branchOptionIndex, 'new Event flow asset should render inside the option result branch');
assert(!branchAssetScene.slice(0, branchOptionIndex).includes('img/events/iron-front.png'), 'new Event flow asset should not render in the opening event body');
assert(branchAssetEvent.eventBody.assets.some((asset) => asset.path === 'img/events/iron-front.png' && asset.placementKind === 'option_result_visual' && asset.flowAsset), 'new Event flow assets should be visible through shared Object Canvas asset rows');
const branchAssetEventHtml = previewEditor.render(branchAssetEvent);
assert(branchAssetEventHtml.includes('data-object-canvas-asset-placement-id="option_campaigning_braun"'), 'new Event editor should expose placement-scoped asset controls');
assert(branchAssetEventHtml.includes('data-asset-placement-kind="option_result_visual"'), 'new Event editor should expose option-result placement markers');

const localBranchAssetEvent = canvasModel.buildNewEventCanvas(index, {
  id: 'presidential_1932_local_fixture',
  title: '1932 Campaign Local Fixture',
  heading: '1932 Campaign Local Fixture',
  year: 1932,
  monthStart: 3,
  monthEnd: 4,
  options: [
    {id: 'iron_front', title: 'Rally the Iron Front', body: 'The rally fills the avenue.'},
    {id: 'radio', title: 'Stay on radio', body: 'The speech goes out over the air.'}
  ]
}, {
  values: {
    'event.assetPlacementInstallRequest.option_iron_front': JSON.stringify({
      sourceName: 'Iron Front Local.png',
      sourcePath: '/tmp/Iron Front Local.png',
      targetPath: 'assets/studio/events/presidential_1932_local_fixture/iron-front-local.png',
      type: 'image',
      label: 'Iron Front Local.png',
      role: 'event_illustration',
      directive: 'face-image',
      placementKind: 'option_result_visual',
      optionId: 'iron_front',
      displayLocation: 'Option: Rally the Iron Front'
    })
  }
});
assert(localBranchAssetEvent.changeState.draft.assetPlacements.some((asset) => asset.path === 'assets/studio/events/presidential_1932_local_fixture/iron-front-local.png' && asset.optionId === 'iron_front'), 'new Event local flow asset proposal should write a target path into placement-scoped draft assets');
assert(localBranchAssetEvent.changeState.draft.assetInstallRequests.some((request) => request.placementId === 'option_iron_front' && request.targetPath === 'assets/studio/events/presidential_1932_local_fixture/iron-front-local.png'), 'new Event local flow asset proposal should preserve placement metadata on install requests');
assert(localBranchAssetEvent.changeState.installPlan.operations.some((operation) => operation.type === 'copy_asset_file' && operation.path === 'assets/studio/events/presidential_1932_local_fixture/iron-front-local.png'), 'new Event local flow asset proposal should still produce a copy_asset_file operation');
assert(localBranchAssetEvent.changeState.output.scene.indexOf('face-image: assets/studio/events/presidential_1932_local_fixture/iron-front-local.png') > localBranchAssetEvent.changeState.output.scene.indexOf('@iron_front'), 'new Event local flow asset proposal should render in the targeted option branch');

const indexedAssetCard = canvasModel.buildTemplateCanvas(index, 'card', {
  id: 'indexed_asset_card',
  title: 'Indexed asset card',
  heading: 'Indexed asset card',
  options: [{id: 'play', label: 'Play card', narrativeParagraphs: ['The card resolves.'], gotoAfter: 'root'}]
}, {
  values: {
    'card.assetRef.card_image': JSON.stringify({path: 'img/cards/indexed-card.png', type: 'image', label: 'Indexed card art', role: 'card_image'})
  }
});
assert(indexedAssetCard.mode === 'new_card', 'new Card should open through the template canvas path');
assert(indexedAssetCard.changeState.draft.assetRefs.some((asset) => asset.path === 'img/cards/indexed-card.png' && asset.role === 'card_image'), 'new Card indexed asset selection should write a role-aware assetRefs entry');
assert(indexedAssetCard.changeState.output.scene.includes('card-image: img/cards/indexed-card.png'), 'new Card indexed image asset should render a Dendry card-image directive');
const indexedCardPreviewHtml = previewEditor.renderPreviewPane(indexedAssetCard);
assert(indexedCardPreviewHtml.includes('data-asset-target="card"'), 'new Card asset panel should keep card target markers');
assert(indexedCardPreviewHtml.includes('data-object-canvas-asset-select="true"'), 'new Card asset panel should expose indexed asset selection controls');
assert(indexedCardPreviewHtml.includes('data-object-canvas-asset-file="true"'), 'new Card asset panel should expose local file proposal controls');
const indexedCardEditorHtml = previewEditor.render(indexedAssetCard);
assert(indexedCardEditorHtml.includes('data-object-canvas-assets-panel="true"'), 'new Card editor should render Object Canvas asset slots in the editing pane');
assert(indexedCardEditorHtml.includes('data-object-canvas-asset-select="true"'), 'new Card editor should expose indexed asset selectors in the editing pane');

const localAssetCard = canvasModel.buildTemplateCanvas(index, 'card', {
  id: 'local_asset_card',
  title: 'Local asset card',
  heading: 'Local asset card',
  options: [{id: 'play', label: 'Play card', narrativeParagraphs: ['The card resolves.'], gotoAfter: 'root'}]
}, {
  values: {
    'card.assetInstallRequest.card_image': JSON.stringify({
      sourceName: 'Card Local.png',
      sourcePath: '/tmp/Card Local.png',
      targetPath: 'assets/studio/cards/local_asset_card/card-local.png',
      type: 'image',
      label: 'Card Local.png',
      role: 'card_image'
    })
  }
});
assert(localAssetCard.changeState.draft.assetRefs.some((asset) => asset.path === 'assets/studio/cards/local_asset_card/card-local.png' && asset.role === 'card_image'), 'new Card local asset proposal should create the matching target assetRefs entry');
assert(localAssetCard.changeState.installPlan.operations.some((operation) => operation.type === 'copy_asset_file' && operation.path === 'assets/studio/cards/local_asset_card/card-local.png'), 'new Card local asset proposal should produce a copy_asset_file operation');
assert(localAssetCard.changeState.output.scene.includes('card-image: assets/studio/cards/local_asset_card/card-local.png'), 'new Card local image proposal should render a Dendry card-image directive');

const invalidMaxVisitsEvent = canvasModel.buildNewEventCanvas(index, {
  id: 'invalid_max_visits_event',
  title: 'Invalid max visits event',
  heading: 'Invalid max visits event',
  maxVisits: 0,
  when: {year: 1936, monthStart: 2, monthEnd: 4},
  options: [
    {id: 'stay', title: 'Stay', body: 'Stay here.'},
    {id: 'leave', title: 'Leave', body: 'Leave now.'}
  ]
}, {});
assert(!invalidMaxVisitsEvent.ok, 'new Event should reject max-visits values that Dendry runtime will reject');
assert(invalidMaxVisitsEvent.changeState.diagnostics.some((item) => item.code === 'event_draft.max_visits'), 'invalid max-visits should surface a specific validation diagnostic');

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
