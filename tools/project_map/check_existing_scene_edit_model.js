#!/usr/bin/env node
'use strict';

const existingEdit = require('./authoring/existing_scene_edit_model.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const structureOperationsFactory = require('./authoring/existing_scene_structure_operations.js');
const installPlan = require('./authoring/install_plan.js');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {fail, assert} = require('./check_harness.js');

const structureOperations = structureOperationsFactory.create();
assert(structureOperations.routeLineReplacement('go-to: old_target', 'new_target') === 'go-to: new_target', 'structure operations should reroute simple go-to lines');
const removedRouteClause = structureOperations.routeClauseDeleteReplacement('go-to: left if reform_wins; right if reform_loses', 'left', 'reform_wins');
assert(removedRouteClause.ok && removedRouteClause.line === 'go-to: right if reform_loses', 'structure operations should remove only the matching route clause');
assert(structureOperations.normalizeStructureAction('remove_section') === 'remove_layer', 'structure operations should normalize legacy remove_section actions');
const guardedChangeSummary = structureOperations.classifyChange({
  operationType: 'replace_text',
  editability: 'guarded_apply',
  source: {path: 'source/scenes/events/simple.scene.dry', line: 4, startLine: 4, endLine: 4, anchorText: '- @old: Old'},
  before: '- @old: Old',
  deletesSourceLine: true,
  after: ''
});
assert(guardedChangeSummary.status === 'guarded_apply', 'typed structure operation summary should classify exact line deletion as guarded');
const sectionChangeSummary = structureOperations.classifyChange({
  operationType: 'replace_section',
  editability: 'advanced_source_patch',
  source: {path: 'source/scenes/events/simple.scene.dry', line: 8, startLine: 8, endLine: 12, anchorText: '@child', endAnchorText: 'Result text.'},
  anchorText: '@child',
  endAnchorText: 'Result text.',
  allowEmptyReplace: true,
  before: '@child\n...\nResult text.',
  after: ''
});
assert(sectionChangeSummary.status === 'advanced_apply', 'typed structure operation summary should classify exact section deletion as advanced');
const manualSummary = structureOperations.classifyChange({
  operationType: 'manual_snippet',
  editability: 'manual_review',
  source: {path: 'out/game.json', line: 1},
  before: 'runtime output',
  after: ''
});
assert(manualSummary.status === 'manual_review', 'typed structure operation summary should keep non-source changes manual');
assert(
  /Remove option: Talk/.test(structureOperations.structureActionFallbackText({structureAction: 'remove_option', structureTargetLabel: 'Talk'}, '')),
  'structure operations should own manual fallback text for option removal'
);

function optionFixture(scenePath, line, targetId, title) {
  const anchorText = '- @' + targetId + ': ' + title;
  return {
    target: {id: targetId},
    title,
    sourceSpan: {path: scenePath, line, startLine: line, endLine: line, anchorText, endAnchorText: anchorText}
  };
}

function syntheticIndex() {
  const eventPath = 'source/scenes/events/all_quiet.scene.dry';
  const eventScene = {
    id: 'all_quiet',
    title: 'All Quiet on the Western Front',
    path: eventPath,
    type: 'card',
    tags: ['event'],
    flags: {isCard: true, isPinnedCard: false},
    viewIf: 'year = 1930 and month >= 1 and month <= 4 and all_quiet_seen = 0',
    priority: '1',
    options: [
      optionFixture(eventPath, 14, 'ban', 'Ban the film——Censor the screening.'),
      optionFixture(eventPath, 16, 'permit', 'Permit it——Let the controversy breathe.'),
      optionFixture(eventPath, 18, 'ignore', 'Ignore it.'),
      optionFixture(eventPath, 20, 'debate', 'Hold a debate.')
    ],
    assetRefs: [
      {path: 'img/events/all_quiet.png', type: 'image', label: 'All Quiet poster', role: 'event_illustration'},
      {
        path: 'img/portraits/all_quiet_speaker.png',
        type: 'image',
        label: 'All Quiet speaker',
        directive: 'face-image',
        confidence: 'exact',
        source: {
          path: eventPath,
          line: 6,
          startLine: 6,
          endLine: 6,
          anchorText: 'face-image: img/portraits/all_quiet_speaker.png',
          endAnchorText: 'face-image: img/portraits/all_quiet_speaker.png'
        }
      },
      {directive: 'card-image', label: 'Missing path'}
    ],
    sourceSpan: {path: eventPath, startLine: 1, endLine: 80},
    metadata: {
      viewIf: {path: eventPath, line: 3}
    }
  };
  eventScene.options[0].chooseIf = 'public_order >= 0';
  eventScene.options[0].metadata = {chooseIf: {path: eventPath, line: 13}};
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
            source: {path: eventScene.path, line: 14, anchorText: '- @ban: Ban the film——Censor the screening.', endAnchorText: '- @ban: Ban the film——Censor the screening.'}
          },
          {
            id: 'all_quiet_option_ban_subtitle',
            text: 'Censor the screening.',
            role: 'option_subtitle',
            editability: 'text_proposal',
            owner: {kind: 'scene', sceneId: 'all_quiet', sectionId: 'ban', itemId: 'ban'},
            source: {path: eventScene.path, line: 14, anchorText: '- @ban: Ban the film——Censor the screening.', endAnchorText: '- @ban: Ban the film——Censor the screening.'}
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
            id: 'all_quiet_trigger_script',
            text: 'on-arrival: all_quiet_seen = 1',
            role: 'script',
            editability: 'ide_escape_hatch',
            owner: {kind: 'scene', sceneId: 'all_quiet', sectionId: ''},
            source: {path: eventScene.path, line: 10, anchorText: 'on-arrival: all_quiet_seen = 1', endAnchorText: 'on-arrival: all_quiet_seen = 1'}
          },
          {
            id: 'all_quiet_effect_script',
            text: 'Q.public_order += 1;',
            role: 'script',
            editability: 'ide_escape_hatch',
            owner: {kind: 'scene', sceneId: 'all_quiet', sectionId: 'ban'},
            source: {path: eventScene.path, line: 31, anchorText: 'Q.public_order += 1;', endAnchorText: 'Q.public_order += 1;'}
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
const complexPath = 'source/scenes/events/civil_war.scene.dry';
index.scenes.push({
  id: 'civil_war',
  title: 'Civil War',
  path: complexPath,
  type: 'event',
  tags: ['event'],
  flags: {isCard: false, isPinnedCard: false},
  routes: {goTo: [{id: 'war_menu', raw: 'war_menu'}]},
  options: [],
  sections: [
    {
      id: 'civil_war.war_menu',
      sourceSpan: {path: complexPath, startLine: 10, endLine: 14},
      metadata: {$file: complexPath, $line: 10},
      routes: {},
      options: [{
        id: '@rw_help',
        target: {kind: 'scene', id: 'rw_help'},
        title: 'Appeal to the Reichswehr.',
        sourceSpan: {path: complexPath, line: 12, startLine: 12, endLine: 12, anchorText: '- @rw_help: Appeal to the Reichswehr.', endAnchorText: '- @rw_help: Appeal to the Reichswehr.'}
      }, {
        id: '@army_backing',
        target: {kind: 'scene', id: 'army_backing'},
        sourceSpan: {path: complexPath, line: 13, startLine: 13, endLine: 13, anchorText: '- @army_backing', endAnchorText: '- @army_backing'}
      }]
    },
    {
      id: 'civil_war.rw_help',
      title: 'Ask the Reichswehr for support.',
      maxVisits: '1',
      sourceSpan: {path: complexPath, startLine: 15, endLine: 17},
      metadata: {$file: complexPath, $line: 15, maxVisits: {path: complexPath, line: 16}, goTo: {path: complexPath, line: 17}},
      routes: {goTo: [{id: 'war_menu', raw: 'war_menu'}]},
      options: []
    },
    {
      id: 'civil_war.army_backing',
      title: 'Ask the Army command for backing.  Now.',
      sourceSpan: {path: complexPath, startLine: 18, endLine: 19},
      metadata: {$file: complexPath, $line: 18},
      routes: {goTo: [{id: 'war_menu', raw: 'war_menu'}]},
      options: []
    },
    {
      id: 'civil_war.war_outcome',
      viewIf: 'war_choices >= 2',
      sourceSpan: {path: complexPath, startLine: 20, endLine: 24},
      metadata: {$file: complexPath, $line: 20, viewIf: {path: complexPath, line: 21}, goTo: {path: complexPath, line: 22}},
      routes: {goTo: [{id: 'defeat', raw: 'defeat if total_defeat = 1', predicate: 'total_defeat = 1'}]},
      options: []
    }
  ],
  sourceSpan: {path: complexPath, startLine: 1, endLine: 40},
  topLevelSpan: {path: complexPath, startLine: 1, endLine: 9},
  metadata: {goTo: {path: complexPath, line: 5}, title: {path: complexPath, line: 1}},
  assetRefs: []
});
index.semantic.events.push({id: 'civil_war', title: 'Civil War', path: complexPath, confidence: 'exact'});
index.semantic.textCorpus.items.push(
  {
    id: 'civil_war_title',
    text: 'Civil War',
    role: 'title',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'civil_war'},
    source: {path: complexPath, line: 1}
  },
  {
    id: 'civil_war_intro',
    text: 'The array of forces is uncertain.',
    role: 'body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'civil_war', sectionId: 'civil_war.war_menu'},
    source: {path: complexPath, line: 11}
  },
  {
    id: 'civil_war_rw_option',
    text: 'Appeal to the Reichswehr.',
    role: 'option_label',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'civil_war', sectionId: 'civil_war.war_menu', itemId: 'rw_help'},
    source: {path: complexPath, line: 12, anchorText: '- @rw_help: Appeal to the Reichswehr.', endAnchorText: '- @rw_help: Appeal to the Reichswehr.'}
  },
  {
    id: 'civil_war_shadow_duplicate_option_label',
    text: 'Ask the Army command for backing.',
    role: 'option_label',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'civil_war', sectionId: 'civil_war.war_menu', itemId: 'shadow_duplicate'},
    source: {path: complexPath, line: 8, anchorText: '- @shadow_duplicate: Ask the Army command for backing.', endAnchorText: '- @shadow_duplicate: Ask the Army command for backing.'}
  },
  {
    id: 'civil_war_army_backing_title',
    text: 'Ask the Army command for backing. Now.',
    role: 'title',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'civil_war', sectionId: 'civil_war.army_backing'},
    source: {path: complexPath, line: 19, anchorText: 'title: Ask the Army command for backing.  Now.', endAnchorText: 'title: Ask the Army command for backing.  Now.'}
  }
);

const inlinePath = 'source/scenes/events/inline_condition_conference.scene.dry';
const inlineConditionalLine = 'The leadership of the [? if party_name != "CVP": <span style="color: #000000;">Center Party</span>?][? if party_name == "CVP": <span style="color: #000000;">**CVP**</span>?] meets tonight.';
index.scenes.push({
  id: 'inline_condition_conference',
  title: '[? if party_name != "CVP": Center Party?][? if party_name == "CVP": CVP?] Conference',
  path: inlinePath,
  type: 'event',
  tags: ['event'],
  flags: {isCard: false, isPinnedCard: false},
  options: [],
  sections: [],
  sourceSpan: {path: inlinePath, startLine: 1, endLine: 20},
  topLevelSpan: {path: inlinePath, startLine: 1, endLine: 20},
  metadata: {title: {path: inlinePath, line: 1}},
  assetRefs: []
});
index.semantic.events.push({id: 'inline_condition_conference', title: '[? if party_name != "CVP": Center Party?][? if party_name == "CVP": CVP?] Conference', path: inlinePath, confidence: 'exact'});
index.semantic.textCorpus.items.push(
  {
    id: 'inline_title',
    text: '[? if party_name != "CVP": Center Party?][? if party_name == "CVP": CVP?] Conference',
    role: 'title',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'inline_condition_conference'},
    source: {path: inlinePath, line: 1, anchorText: 'title: ' + inlineConditionalLine, endAnchorText: 'title: ' + inlineConditionalLine}
  },
  {
    id: 'inline_body_split',
    text: 'The leadership of the  meets tonight.',
    role: 'body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'inline_condition_conference'},
    hasInlineConditionals: true,
    inlineConditions: ['party_name != "CVP"', 'party_name == "CVP"'],
    source: {path: inlinePath, line: 8, anchorText: inlineConditionalLine, endAnchorText: inlineConditionalLine}
  },
  {
    id: 'inline_body_center',
    text: '<span style="color: #000000;">Center Party</span>',
    role: 'conditional_body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'inline_condition_conference'},
    conditions: ['party_name != "CVP"'],
    source: {path: inlinePath, line: 8, anchorText: inlineConditionalLine, endAnchorText: inlineConditionalLine}
  },
  {
    id: 'inline_body_cvp',
    text: '<span style="color: #000000;">**CVP**</span>',
    role: 'conditional_body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'inline_condition_conference'},
    conditions: ['party_name == "CVP"'],
    source: {path: inlinePath, line: 8, anchorText: inlineConditionalLine, endAnchorText: inlineConditionalLine}
  }
);

const dnvpPath = 'source/scenes/events/dnvp_congress.scene.dry';
index.scenes.push({
  id: 'dnvp_congress',
  title: 'DNVP Congress',
  path: dnvpPath,
  type: 'event',
  tags: ['event'],
  flags: {isCard: false, isPinnedCard: false},
  options: [
    optionFixture(dnvpPath, 18, 'endorse_hugenberg', 'Endorse Hugenberg.'),
    optionFixture(dnvpPath, 19, 'delay_vote', 'Delay the vote.')
  ],
  sections: [
    {
      id: 'dnvp_congress.endorse_hugenberg',
      sourceSpan: {path: dnvpPath, startLine: 24, endLine: 28},
      metadata: {$file: dnvpPath, $line: 24},
      routes: {},
      options: []
    }
  ],
  sourceSpan: {path: dnvpPath, startLine: 1, endLine: 42},
  topLevelSpan: {path: dnvpPath, startLine: 1, endLine: 22},
  metadata: {title: {path: dnvpPath, line: 1}},
  assetRefs: [{path: 'img/events/dnvp_congress.png', type: 'image', label: 'DNVP Congress hall', role: 'event_illustration'}]
});
index.semantic.events.push({id: 'dnvp_congress', title: 'DNVP Congress', path: dnvpPath, confidence: 'exact'});
index.semantic.textCorpus.items.push(
  {
    id: 'dnvp_congress_title',
    text: 'DNVP Congress',
    role: 'title',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'dnvp_congress'},
    source: {path: dnvpPath, line: 1}
  },
  {
    id: 'dnvp_congress_chart',
    text: '<table><tr><th>Faction</th><th>Votes</th></tr><tr><td>Hugenberg bloc</td><td>54</td></tr></table>',
    role: 'body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'dnvp_congress'},
    source: {path: dnvpPath, line: 8, anchorText: '<table><tr><th>Faction</th><th>Votes</th></tr><tr><td>Hugenberg bloc</td><td>54</td></tr></table>', endAnchorText: '<table><tr><th>Faction</th><th>Votes</th></tr><tr><td>Hugenberg bloc</td><td>54</td></tr></table>'}
  },
  {
    id: 'dnvp_congress_option',
    text: 'Endorse Hugenberg.',
    role: 'option_label',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'dnvp_congress', itemId: 'endorse_hugenberg'},
    source: {path: dnvpPath, line: 18, anchorText: '- @endorse_hugenberg: Endorse Hugenberg.', endAnchorText: '- @endorse_hugenberg: Endorse Hugenberg.'}
  },
  {
    id: 'dnvp_congress_result',
    text: 'The delegates rally behind the chair.',
    role: 'body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'dnvp_congress', sectionId: 'dnvp_congress.endorse_hugenberg'},
    source: {path: dnvpPath, line: 25}
  }
);

const laborPath = 'source/scenes/events/labor_unrest.scene.dry';
index.scenes.push({
  id: 'labor_unrest',
  title: 'Labor Unrest',
  path: laborPath,
  type: 'event',
  tags: ['event'],
  flags: {isCard: false, isPinnedCard: false},
  options: [
    optionFixture(laborPath, 14, 'support_labor', 'Support the workers.'),
    optionFixture(laborPath, 15, 'split_the_pain', 'Both sides share the pain.')
  ],
  sections: [
    {
      id: 'labor_unrest.support_labor',
      sourceSpan: {path: laborPath, startLine: 20, endLine: 24},
      metadata: {$file: laborPath, $line: 20},
      routes: {},
      options: []
    },
    {
      id: 'labor_unrest.split_the_pain',
      sourceSpan: {path: laborPath, startLine: 25, endLine: 29},
      metadata: {$file: laborPath, $line: 25},
      routes: {},
      options: []
    },
    {
      id: 'labor_unrest.no_ministry',
      viewIf: 'labor_minister != "SPD"',
      sourceSpan: {path: laborPath, startLine: 30, endLine: 34},
      metadata: {$file: laborPath, $line: 30, viewIf: {path: laborPath, line: 31}},
      routes: {},
      options: []
    }
  ],
  sourceSpan: {path: laborPath, startLine: 1, endLine: 40},
  topLevelSpan: {path: laborPath, startLine: 1, endLine: 19},
  metadata: {title: {path: laborPath, line: 1}},
  assetRefs: []
});
index.semantic.events.push({id: 'labor_unrest', title: 'Labor Unrest', path: laborPath, confidence: 'exact'});
index.semantic.textCorpus.items.push(
  {
    id: 'labor_unrest_title',
    text: 'Labor Unrest',
    role: 'title',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'labor_unrest'},
    source: {path: laborPath, line: 1}
  },
  {
    id: 'labor_unrest_intro',
    text: 'The Ruhr is beset by strikes.',
    role: 'body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'labor_unrest'},
    source: {path: laborPath, line: 8}
  },
  {
    id: 'labor_unrest_support_option',
    text: 'Support the workers.',
    role: 'option_label',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'labor_unrest', itemId: 'support_labor'},
    source: {path: laborPath, line: 14, anchorText: '- @support_labor: Support the workers.', endAnchorText: '- @support_labor: Support the workers.'}
  },
  {
    id: 'labor_unrest_support_result',
    text: 'We manage to convince the Labor Minister to strike a compromise.',
    role: 'body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'labor_unrest', sectionId: 'labor_unrest.support_labor'},
    source: {path: laborPath, line: 21}
  },
  {
    id: 'labor_unrest_support_conditional',
    text: 'The Social Democrats stand to gain if they own the ministry.',
    role: 'conditional_body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'labor_unrest', sectionId: 'labor_unrest.support_labor'},
    conditions: ['labor_minister = "SPD"'],
    source: {path: laborPath, line: 22, anchorText: '[? if labor_minister = "SPD" : The Social Democrats stand to gain if they own the ministry. ?]', endAnchorText: '[? if labor_minister = "SPD" : The Social Democrats stand to gain if they own the ministry. ?]'}
  },
  {
    id: 'labor_unrest_no_ministry_text',
    text: 'We do not own the Labor Ministry.',
    role: 'body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'labor_unrest', sectionId: 'labor_unrest.no_ministry'},
    source: {path: laborPath, line: 32}
  }
);

const stresemannPath = 'source/scenes/events/death_of_stresemann.scene.dry';
const stresemannConditionalLine = '[? if dvp_leader == "Scholz": Ernst Scholz has succeeded him as leader of the <span style="color: #C0A054;">**DVP**</span>.?][? if dvp_leader == "Curtius": Julius Curtius has succeeded him as leader of the <span style="color: #C0A054;">**DVP**</span>.?]';
index.scenes.push({
  id: 'death_of_stresemann',
  title: 'The Death of Gustav Stresemann',
  path: stresemannPath,
  type: 'event',
  tags: ['event'],
  flags: {isCard: false, isPinnedCard: false},
  viewIf: 'year = 1929 and month >= 10 and not lvp_formed',
  frequency: '1000',
  maxVisits: '1',
  priority: '-1',
  options: [],
  sections: [],
  sourceSpan: {path: stresemannPath, startLine: 1, endLine: 22},
  topLevelSpan: {path: stresemannPath, startLine: 1, endLine: 22},
  metadata: {
    viewIf: {path: stresemannPath, line: 2},
    frequency: {path: stresemannPath, line: 3},
    maxVisits: {path: stresemannPath, line: 4},
    priority: {path: stresemannPath, line: 7}
  },
  assetRefs: [{path: 'img/portraits/Stresemann.jpg', type: 'image', label: 'Stresemann.jpg', role: 'face-image'}]
});
index.semantic.events.push({id: 'death_of_stresemann', title: 'The Death of Gustav Stresemann', path: stresemannPath, confidence: 'exact'});
index.semantic.textCorpus.items.push(
  {
    id: 'stresemann_title',
    text: 'The Death of Gustav Stresemann',
    role: 'title',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'death_of_stresemann'},
    source: {path: stresemannPath, line: 1}
  },
  {
    id: 'stresemann_heading',
    text: 'The Death of Gustav Stresemann',
    role: 'heading',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'death_of_stresemann'},
    source: {path: stresemannPath, line: 11, anchorText: '= The Death of Gustav Stresemann', endAnchorText: '= The Death of Gustav Stresemann'}
  },
  {
    id: 'stresemann_body_1',
    text: 'Gustav Stresemann, leader of the <span style="color: #C0A054;">**DVP**</span>, has died.',
    role: 'body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'death_of_stresemann'},
    source: {path: stresemannPath, line: 13, anchorText: 'Gustav Stresemann, leader of the <span style="color: #C0A054;">**DVP**</span>, has died.', endAnchorText: 'Gustav Stresemann, leader of the <span style="color: #C0A054;">**DVP**</span>, has died.'}
  },
  {
    id: 'stresemann_body_2',
    text: 'A hole has been left within the liberal movement.',
    role: 'body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'death_of_stresemann'},
    source: {path: stresemannPath, line: 15, anchorText: 'A hole has been left within the liberal movement.', endAnchorText: 'A hole has been left within the liberal movement.'}
  },
  {
    id: 'stresemann_conditional_scholz',
    text: 'Ernst Scholz has succeeded him as leader of the <span style="color: #C0A054;">**DVP**</span>.',
    role: 'conditional_body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'death_of_stresemann'},
    conditions: ['dvp_leader == "Scholz"'],
    source: {path: stresemannPath, line: 17, anchorText: stresemannConditionalLine, endAnchorText: stresemannConditionalLine}
  },
  {
    id: 'stresemann_conditional_curtius',
    text: 'Julius Curtius has succeeded him as leader of the <span style="color: #C0A054;">**DVP**</span>.',
    role: 'conditional_body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'death_of_stresemann'},
    conditions: ['dvp_leader == "Curtius"'],
    source: {path: stresemannPath, line: 17, anchorText: stresemannConditionalLine, endAnchorText: stresemannConditionalLine}
  }
);

const eventModel = existingEdit.buildEditModel(index, 'events', 'all_quiet');
assert(eventModel.ok, 'event edit model should build: ' + JSON.stringify(eventModel.diagnostics));
assert(eventModel.kind === 'existing_scene_edit_model', 'event edit model should expose model kind');
assert(eventModel.sceneId === 'all_quiet', 'event edit model should keep scene id');
assert(eventModel.sceneKind === 'event', 'event edit model should classify events');
assert(eventModel.source.path === 'source/scenes/events/all_quiet.scene.dry', 'event edit model should keep source path');
const conditionField = eventModel.fields.find((field) => field.role === 'condition' && field.label === 'Appearance condition');
assert(conditionField, 'event edit model should expose the appearance condition field');
const impossibleMonthIndex = syntheticIndex();
impossibleMonthIndex.scenes[0].viewIf = 'year = 1930 and month >= 5 and month <= 3 and all_quiet_seen = 0';
const impossibleMonthModel = existingEdit.buildEditModel(impossibleMonthIndex, 'events', 'all_quiet');
assert(impossibleMonthModel.diagnostics.some((diag) => diag.code === 'existing_scene_edit.impossible_month_window'), 'existing edit model should warn when an indexed event has an impossible month window');
const sectionMonthIndex = syntheticIndex();
sectionMonthIndex.scenes[0].sections = [{
  id: 'all_quiet.autumn',
  viewIf: 'month >= 9 and month <= 2'
}];
const sectionMonthModel = existingEdit.buildEditModel(sectionMonthIndex, 'events', 'all_quiet');
assert(sectionMonthModel.diagnostics.some((diag) => (
  diag.code === 'existing_scene_edit.impossible_month_window' &&
  diag.message.includes('Section condition: autumn')
)), 'existing edit model should warn when a section viewIf has an impossible month window');
const sectionChoiceMonthIndex = syntheticIndex();
sectionChoiceMonthIndex.scenes[0].sections = [{
  id: 'all_quiet.vote',
  chooseIf: 'month >= 9 and month <= 2'
}];
const sectionChoiceMonthModel = existingEdit.buildEditModel(sectionChoiceMonthIndex, 'events', 'all_quiet');
assert(sectionChoiceMonthModel.diagnostics.some((diag) => (
  diag.code === 'existing_scene_edit.impossible_month_window' &&
  diag.message.includes('Section choice condition: vote')
)), 'existing edit model should warn when a section chooseIf has an impossible month window');
const optionMonthIndex = syntheticIndex();
optionMonthIndex.scenes[0].options[0].chooseIf = 'month >= 9 and month <= 2';
const optionMonthModel = existingEdit.buildEditModel(optionMonthIndex, 'events', 'all_quiet');
assert(optionMonthModel.diagnostics.some((diag) => (
  diag.code === 'existing_scene_edit.impossible_month_window' &&
  diag.message.includes('Choice condition: Ban the film')
)), 'existing edit model should label option chooseIf impossible month diagnostics');
const impossibleMonthProposal = existingEdit.buildProposal(eventModel, {
  [conditionField.id]: 'year = 1930 and month >= 5 and month <= 3 and all_quiet_seen = 0'
});
assert(impossibleMonthProposal.diagnostics.some((diag) => diag.code === 'existing_scene_edit.impossible_month_window'), 'existing edit proposal should warn when a condition edit creates an impossible month window');
const exactCollisionProposal = existingEdit.buildProposal(eventModel, {
  [conditionField.id]: 'month = 3 and month == 4'
});
assert(exactCollisionProposal.diagnostics.some((diag) => diag.message.includes('multiple values')), 'existing edit proposal should warn when a condition edit sets month to multiple exact values');
const outOfRangeProposal = existingEdit.buildProposal(eventModel, {
  [conditionField.id]: 'month <= 13'
});
assert(outOfRangeProposal.diagnostics.some((diag) => diag.message.includes('between 1 and 12')), 'existing edit proposal should warn when a condition edit places month outside the supported range');
assert(eventModel.fields.some((field) => field.role === 'body' && field.original.includes('film arrives')), 'event model should expose body prose');
assert(eventModel.fields.some((field) => field.role === 'option_label' && field.original === 'Ban the film'), 'event model should expose option label text');
assert(eventModel.textBlocks.some((block) => block.role === 'section_text' && block.original.includes('film arrives')), 'event model should expose source-backed section text blocks');
const eventChainField = eventModel.fields.find((field) => field.role === 'condition' && field.id === 'metadata_viewIf');
assert(eventChainField, 'event model should expose source-backed view-if as an editable event-chain field');
assert(eventChainField.source.line === 3, 'event-chain field should keep exact view-if source line');
assert(eventChainField.editability === 'guarded_replace_text', 'event-chain field with exact non-router line should be guarded');
const routeField = eventModel.fields.find((field) => field.role === 'route' && field.optionId === 'ban');
assert(routeField, 'event model should expose option route target as an editable field');
assert(routeField.original === 'ban', 'route field should expose the bare target id');
assert(routeField.editability === 'guarded_replace_text', 'source-backed route target should be guarded');
const effectField = eventModel.fields.find((field) => field.role === 'effect' && field.original === 'Q.public_order += 1');
assert(effectField, 'event model should expose simple Q effects as editable fields');
assert(effectField.editability === 'guarded_replace_text', 'simple source-backed Q effect should be guarded');
assert(eventModel.options.length === 4, 'event model should preserve all event options');
assert(eventModel.effects.length >= 1, 'event model should expose read-only effect summaries');
assert(eventModel.assets.length === 2, 'event model should preserve asset refs with paths');
assert(eventModel.assets.some((asset) => asset.path === 'img/events/all_quiet.png' && asset.role === 'event_illustration'), 'event model should preserve unsupported asset directives as model assets');
const assetReferenceFields = eventModel.fields.filter((field) => field.role === 'asset_reference');
const portraitAssetField = assetReferenceFields.find((field) => field.original === 'face-image: img/portraits/all_quiet_speaker.png');
assert(portraitAssetField, 'event model should expose supported source-backed asset refs as editable fields');
assert(portraitAssetField.label === 'Portrait image', 'asset reference field should keep the face-image label');
assert(portraitAssetField.source.line === 6 && portraitAssetField.source.anchorText === 'face-image: img/portraits/all_quiet_speaker.png', 'asset reference field should keep source line and anchor');
assert(portraitAssetField.sourcePath === 'source/scenes/events/all_quiet.scene.dry', 'asset reference field should keep sourcePath from source evidence');
assert(portraitAssetField.editability === 'guarded_replace_text', 'source-backed asset reference should be guarded');
assert(!assetReferenceFields.some((field) => field.original.includes('all_quiet.png')), 'unsupported asset directive should not produce an editable asset field');
assert(!assetReferenceFields.some((field) => field.label === 'Missing path'), 'asset refs without a path should not produce editable asset fields');

const eventProposal = existingEdit.buildProposal(eventModel, {
  all_quiet_body_1: 'The film arrives with a public silence heavier than the posters.',
  all_quiet_option_ban: 'Ban public screenings',
  metadata_viewIf: 'year = 1930 and month >= 1 and month <= 4 and all_quiet_seen = 0 and film_debate_unlocked = 1',
  [routeField.id]: 'permit',
  [effectField.id]: 'Q.public_order += 2'
});
assert(eventProposal.kind === 'existing_scene_edit', 'proposal should use existing_scene_edit kind');
assert(eventProposal.changes.length === 5, 'proposal should contain only changed fields');
assert(eventProposal.changes.every((change) => change.source && change.source.path === eventModel.source.path), 'changes should keep source evidence');
assert(eventProposal.changeSummary.textFields === 2, 'change summary should count text changes');
assert(eventProposal.changeSummary.metadataFields === 3, 'change summary should count event-chain, route, and effect changes');

const bundle = existingEdit.buildExportBundle(eventProposal, index);
assert(bundle.installPlan, 'existing scene edit bundle should include install plan');
assert(bundle.installPlan.draftKind === 'existing_scene_edit', 'install plan draftKind should be existing_scene_edit');
assert(bundle.installPlan.operations.every((op) => op.type === 'replace_text'), 'source-backed changed fields should use replace_text operations');
assert(bundle.installPlan.operations.every((op) => op.safety === 'guarded_apply'), 'source-backed changed fields should be guarded apply');
assert(bundle.installPlan.operations.some((op) => op.line === 3 && op.search === eventChainField.original && op.replace.includes('film_debate_unlocked')), 'event-chain condition edit should become a guarded exact-line replace_text operation');
assert(bundle.installPlan.operations.some((op) => op.line === 14 && op.search === '@ban' && op.replace === '@permit'), 'route target edit should become a guarded option-line replace_text operation');
assert(bundle.installPlan.operations.some((op) => op.line === 31 && op.search === 'Q.public_order += 1' && op.replace === 'Q.public_order += 2'), 'simple Q effect edit should become a guarded source-line replace_text operation');
assert(bundle.previewText.includes('Modify existing Event'), 'bundle preview text should explain that this modifies an existing event');
assert(bundle.proposalText.includes('Before:'), 'bundle proposal text should include before text');
assert(bundle.proposalText.includes('After:'), 'bundle proposal text should include after text');

const sharedEffectIndex = syntheticIndex();
const sharedEffectLine = 'Q.public_order += 1; Q.stability += 1;';
const sharedEffectRows = sharedEffectIndex.semantic.textCorpus.items;
const sharedPublicOrder = sharedEffectRows.find((item) => item.id === 'all_quiet_effect_script');
sharedPublicOrder.source = Object.assign({}, sharedPublicOrder.source, {
  anchorText: sharedEffectLine,
  endAnchorText: sharedEffectLine
});
sharedEffectRows.push({
  id: 'all_quiet_effect_script_stability',
  text: 'Q.stability += 1;',
  role: 'script',
  editability: 'ide_escape_hatch',
  owner: {kind: 'scene', sceneId: 'all_quiet', sectionId: 'ban'},
  source: {path: eventModel.source.path, line: 31, anchorText: sharedEffectLine, endAnchorText: sharedEffectLine}
});
const sharedEffectModel = existingEdit.buildEditModel(sharedEffectIndex, 'events', 'all_quiet');
const sharedEffectField = sharedEffectModel.fields.find((field) => field.role === 'effect' && field.original === 'Q.public_order += 1');
assert(sharedEffectField, 'shared-line event model should expose the original effect field');
assert(sharedEffectField.sharedSourceLine === true, 'co-located effects should carry shared source-line evidence');
assert(sharedEffectField.sourceLineEffectCount === 2, 'shared effect fields should count adjacent source-line effects');
assert(sharedEffectField.editability === 'guarded_replace_text', 'co-located effects with a unique token should keep guarded apply');
assert(sharedEffectField.sourceLineSafety === 'shared_line_exact_token_guarded', 'co-located effect safety should name the shared-line guarded boundary');
assert(sharedEffectField.reason.includes('shares a source line'), 'shared effect field should explain the shared-line boundary');

const duplicateEffectIndex = syntheticIndex();
const duplicateEffectLine = 'Q.public_order += 1; Q.public_order += 1;';
const duplicatePublicOrder = duplicateEffectIndex.semantic.textCorpus.items.find((item) => item.id === 'all_quiet_effect_script');
duplicatePublicOrder.source = Object.assign({}, duplicatePublicOrder.source, {
  anchorText: duplicateEffectLine,
  endAnchorText: duplicateEffectLine
});
const duplicateEffectModel = existingEdit.buildEditModel(duplicateEffectIndex, 'events', 'all_quiet');
const duplicateEffectField = duplicateEffectModel.fields.find((field) => field.role === 'effect' && field.original === 'Q.public_order += 1');
assert(duplicateEffectField, 'duplicate-token event model should expose the original effect field');
assert(duplicateEffectField.sharedSourceLine === true, 'duplicate-token effects should carry shared source-line evidence');
assert(duplicateEffectField.editability === 'advanced_source_patch', 'duplicate-token effects should use source slice advanced apply because the search token is ambiguous');
assert(duplicateEffectField.sourceLineSafety === 'whole_line_advanced_source_patch', 'duplicate-token effect safety should name the whole-line advanced boundary');

const addOptionField = eventModel.fields.find((field) => field.id === 'structure_add_option');
const addBranchField = eventModel.fields.find((field) => field.id === 'structure_add_branch');
const addTriggerEffectField = eventModel.fields.find((field) => field.id === 'structure_add_trigger_effect');
const addOptionEffectField = eventModel.fields.find((field) => field.id === 'structure_add_option_effect_ban');
const removeOptionField = eventModel.fields.find((field) => field.id === 'structure_remove_option_ban');
const removePrereqField = eventModel.fields.find((field) => field.id === 'structure_remove_option_condition_ban');
const removeEffectField = eventModel.fields.find((field) => field.id.startsWith('structure_remove_effect_') && field.label.includes('Q.public_order += 1'));
assert(addOptionField && addOptionField.inputType === 'textarea', 'existing editor should expose an add-option structural action');
assert(addOptionField.editability === 'guarded_apply', 'root add-option structural actions should advertise guarded apply when the insert anchor is exact');
assert(addOptionField.structureSourceBlock && addOptionField.structureSourceBlock.kind === 'root_option_insert_anchor', 'root add-option structural actions should carry source block insert evidence');
assert(addBranchField && addBranchField.inputType === 'textarea', 'existing editor should expose an add-branch structural action');
assert(addBranchField.editability === 'advanced_source_patch', 'source-backed add-branch should advertise advanced source apply when a graph-backed insert anchor exists');
assert(addBranchField.structureSourceBlock && addBranchField.structureSourceBlock.kind === 'branch_insert_anchor', 'source-backed add-branch should carry branch insert evidence');
assert(addTriggerEffectField && addTriggerEffectField.role === 'effect', 'existing editor should expose an add trigger effect action');
assert(addTriggerEffectField.editability === 'guarded_apply', 'source-backed trigger effects should advertise guarded apply when an on-arrival insert anchor is exact');
assert(addOptionEffectField && addOptionEffectField.optionId === 'ban', 'existing editor should expose add option effect actions');
assert(addOptionEffectField.editability === 'guarded_apply', 'source-backed add option effect actions should advertise guarded apply when the insert anchor is exact');
assert(removeOptionField && removeOptionField.inputType === 'checkbox', 'existing editor should expose explicit option removal');
assert(removePrereqField && removePrereqField.inputType === 'checkbox', 'existing editor should expose explicit prerequisite removal');
assert(removePrereqField.editability === 'guarded_apply', 'source-backed option prerequisite removal should advertise guarded apply when the choose-if line is exact');
assert(removeEffectField && removeEffectField.inputType === 'checkbox', 'existing editor should expose explicit effect removal');
assert(removeEffectField.editability === 'guarded_apply', 'single-line source-backed effect removals should advertise guarded apply');
const structureProposal = existingEdit.buildProposal(eventModel, {
  [addOptionField.id]: '- @public_meeting: Hold a public meeting.\n# public_meeting\nThe public meeting reframes the controversy.',
  [addBranchField.id]: '# late_warning\n[? if public_order >= 2 : Public order is under strain. ?]',
  [addTriggerEffectField.id]: 'Q.public_order += 2',
  [addOptionEffectField.id]: 'Q.public_order -= 1',
  [removeOptionField.id]: 'true',
  [removePrereqField.id]: 'true',
  [removeEffectField.id]: 'true'
});
assert(structureProposal.changes.length === 8, 'structural edits should become proposal changes, including source-backed bundle deletes');
assert(structureProposal.changes.filter((change) => change.editability === 'manual_review').length === 0, 'source-backed structural inserts/effects/deletes/condition removals should become guarded or advanced instead of fake manual review');
assert(structureProposal.changes.some((change) => change.fieldId === addOptionField.id && change.editability === 'guarded_apply' && change.operationType === 'insert_text' && change.after.includes('@public_meeting')), 'simple root add-option proposals should become guarded source inserts');
assert(structureProposal.changes.some((change) => change.fieldId === addBranchField.id && change.editability === 'advanced_source_patch' && change.operationType === 'insert_text' && change.after.includes('@late_warning')), 'simple source-backed add-branch proposals should become advanced source inserts');
assert(structureProposal.changes.some((change) => change.fieldId === addTriggerEffectField.id && change.editability === 'guarded_apply' && change.operationType === 'replace_text' && change.before === 'on-arrival: all_quiet_seen = 1' && change.after.includes('public_order += 2')), 'simple source-backed trigger effects should append to existing on-arrival lines');
assert(structureProposal.changes.some((change) => change.fieldId === addOptionEffectField.id && change.editability === 'guarded_apply' && change.operationType === 'insert_text'), 'simple source-backed option effects should become guarded source inserts');
assert(structureProposal.changes.some((change) => change.fieldId === removePrereqField.id && change.editability === 'guarded_apply' && change.operationType === 'replace_text' && change.before === 'choose-if: public_order >= 0' && change.after === '' && change.allowEmptyReplace), 'source-backed option prerequisite removal should become a guarded empty replace_text');
assert(structureProposal.changes.some((change) => change.fieldId === removeEffectField.id && change.editability === 'guarded_apply' && change.operationType === 'replace_text' && change.after === '' && change.allowEmptyReplace), 'single-line source-backed effect removals should become guarded empty replacements');
assert(structureProposal.changes.some((change) => change.fieldId === removeOptionField.id && change.editability === 'advanced_source_patch' && change.operationType === 'replace_text' && change.after === ''), 'source-backed option removal should delete the option line as an advanced patch');
assert(structureProposal.changes.some((change) => change.fieldId === removeOptionField.id + '__section' && change.editability === 'advanced_source_patch' && change.operationType === 'replace_section' && change.after === ''), 'source-backed option removal should delete the local result section as an advanced patch');
assert(structureProposal.changes.some((change) => change.before.includes('public_order >= 0') && change.after === ''), 'remove-prerequisite proposal should carry the deleted condition');
assert(structureProposal.changes.some((change) => change.before.includes('Q.public_order += 1') && change.after === ''), 'remove-effect proposal should carry the deleted effect');
const structureBundle = existingEdit.buildExportBundle(structureProposal, index);
assert(structureBundle.installPlan.operations.filter((op) => op.type === 'manual_snippet').length === 0, 'source-backed structural changes should avoid fake manual snippets');
assert(structureBundle.installPlan.operations.some((op) => op.type === 'insert_text' && op.safety === 'guarded_apply' && op.content.includes('@public_meeting')), 'simple root add-option proposals should produce guarded install operations');
assert(structureBundle.installPlan.operations.some((op) => op.type === 'insert_text' && op.safety === 'advanced_apply' && op.content.includes('@late_warning')), 'simple source-backed add-branch proposals should produce advanced install operations');
assert(structureBundle.installPlan.operations.some((op) => op.type === 'replace_text' && op.safety === 'guarded_apply' && op.search === 'on-arrival: all_quiet_seen = 1' && op.replace.includes('public_order += 2')), 'simple trigger effect insertion should produce a guarded on-arrival replacement operation');
assert(structureBundle.installPlan.operations.some((op) => op.type === 'insert_text' && op.safety === 'guarded_apply' && op.content.includes('Q.public_order -= 1')), 'simple source-backed option-effect insertion should produce a guarded install operation');
assert(structureBundle.installPlan.operations.some((op) => op.type === 'replace_text' && op.safety === 'guarded_apply' && op.search === 'choose-if: public_order >= 0' && op.replace === ''), 'source-backed prerequisite removal should produce a guarded empty replace_text operation');
assert(structureBundle.installPlan.operations.some((op) => op.type === 'replace_text' && op.safety === 'guarded_apply' && op.search === 'Q.public_order += 1;' && op.replace === ''), 'single-line source-backed effect removal should produce a guarded empty replace_text operation');
assert(structureBundle.installPlan.operations.some((op) => op.type === 'replace_text' && op.safety === 'advanced_apply' && op.search.includes('@ban') && op.replace === ''), 'source-backed option removal should produce an advanced empty replace_text operation');
assert(structureBundle.installPlan.operations.some((op) => op.type === 'replace_section' && op.safety === 'advanced_apply' && op.allowEmptyReplace), 'source-backed option removal should produce an advanced empty replace_section operation');
assert(structureBundle.proposalText.includes('Add trigger effect'), 'structural proposal preview should include effect creation');
const addSectionOptionField = eventModel.fields.find((field) => field.structureAction === 'add_option' && field.structureSourceBlock && field.structureSourceBlock.kind === 'section_text_option_insert_anchor');
assert(addSectionOptionField, 'existing editor should expose a source-backed add-option control for a selected result section');
const complexSectionOptionProposal = existingEdit.buildProposal(eventModel, {
  [addSectionOptionField.id]: '- @republican_concordat: What next?\n# republican_concordat\nresult-mode: native\nchoose-if: resources >= 1\nunavailable-subtitle: We need at least one resource.\non-arrival: resources -= 1 if public_order >= 0\nA complex result can be created without falling back to a fake manual snippet.'
});
const complexSectionOptionChange = complexSectionOptionProposal.changes.find((change) => change.fieldId === addSectionOptionField.id);
assert(complexSectionOptionChange && complexSectionOptionChange.editability === 'guarded_apply' && complexSectionOptionChange.operationType === 'insert_text', 'conditioned add-option result proposals should remain source-backed and installable');
assert(complexSectionOptionChange.after.includes('choose-if: resources >= 1'), 'conditioned add-option insert should preserve choose-if evidence');
assert(complexSectionOptionChange.after.includes('unavailable-subtitle: We need at least one resource.'), 'conditioned add-option insert should preserve unavailable text');
assert(complexSectionOptionChange.after.includes('on-arrival: resources -= 1 if public_order >= 0'), 'conditioned add-option insert should preserve simple choice effects inside the new result section');
const complexSectionOptionBundle = existingEdit.buildExportBundle(complexSectionOptionProposal, index);
assert(complexSectionOptionBundle.installPlan.operations.some((op) => op.type === 'insert_text' && op.content.includes('on-arrival: resources -= 1 if public_order >= 0')), 'conditioned add-option effects should reach the install plan');
const unsafeBranchProposal = existingEdit.buildProposal(eventModel, {
  [addBranchField.id]: '# q_prefixed_branch\n[? if Q.public_order >= 2 : This source-invalid branch should not auto-apply. ?]'
});
assert(unsafeBranchProposal.changes.some((change) => change.fieldId === addBranchField.id && change.editability === 'manual_review' && change.operationType === 'manual_snippet'), 'Q-prefixed branch conditions should fall back to manual review instead of producing invalid source');
const singleLineEffectModel = Object.assign({}, eventModel, {
  fields: [{
    id: 'structure_add_option_effect_inline',
    role: 'effect',
    label: 'Add effect to option: Inline',
    transform: 'structure_action',
    structureAction: 'add_option_effect',
    inputType: 'text',
    source: {path: eventModel.source.path, line: 50, startLine: 50, endLine: 50, anchorText: 'on-arrival: rfb_banned = 1; hindenburg_angry -= 4', endAnchorText: 'on-arrival: rfb_banned = 1; hindenburg_angry -= 4'}
  }]
});
const singleLineEffectProposal = existingEdit.buildProposal(singleLineEffectModel, {
  structure_add_option_effect_inline: 'Q.resources += 2 if Q.flag'
});
assert(singleLineEffectProposal.changes[0].operationType === 'replace_text', 'single-line on-arrival option effects should append through guarded line replacement');
assert(singleLineEffectProposal.changes[0].after === 'on-arrival: rfb_banned = 1; hindenburg_angry -= 4; resources += 2 if flag', 'single-line on-arrival append should preserve SDAAH shorthand syntax');
const singleLineEffectBundle = existingEdit.buildExportBundle(singleLineEffectProposal, index);
assert(singleLineEffectBundle.installPlan.operations[0].type === 'replace_text' && singleLineEffectBundle.installPlan.operations[0].safety === 'guarded_apply', 'single-line on-arrival option effects should become guarded replace_text operations');

const sectionHeaderEffectModel = Object.assign({}, eventModel, {
  fields: [{
    id: 'structure_add_option_effect_section_header',
    role: 'effect',
    label: 'Add effect to option: Section header',
    transform: 'structure_action',
    structureAction: 'add_option_effect',
    inputType: 'text',
    structureSourceBlock: {kind: 'section_on_arrival_insert_anchor', sectionId: 'all_quiet.target_scene'},
    source: {path: eventModel.source.path, line: 52, startLine: 52, endLine: 52, anchorText: '@target_scene', endAnchorText: '@target_scene'}
  }]
});
const sectionHeaderEffectProposal = existingEdit.buildProposal(sectionHeaderEffectModel, {
  structure_add_option_effect_section_header: 'Q.resources += 2 if Q.flag'
});
assert(sectionHeaderEffectProposal.changes[0].operationType === 'insert_text', 'section-header option effect anchors should create guarded inserts');
assert(sectionHeaderEffectProposal.changes[0].position === 'after', 'section-header option effect inserts should land immediately after the local section anchor');
assert(sectionHeaderEffectProposal.changes[0].after === 'on-arrival: resources += 2 if flag', 'section-header option effect inserts should render source-valid on-arrival shorthand');
const sectionHeaderEffectBundle = existingEdit.buildExportBundle(sectionHeaderEffectProposal, index);
assert(sectionHeaderEffectBundle.installPlan.operations[0].type === 'insert_text' && sectionHeaderEffectBundle.installPlan.operations[0].content.includes('on-arrival: resources += 2 if flag'), 'section-header option effects should become guarded install operations');

const removeSharedLineEffectModel = Object.assign({}, eventModel, {
  fields: [{
    id: 'structure_remove_effect_inline',
    role: 'effect',
    label: 'Remove effect: Q.public_order += 1',
    transform: 'structure_action',
    structureAction: 'remove_effect',
    structureBefore: 'Q.public_order += 1',
    structureSourceExpression: 'public_order += 1',
    inputType: 'checkbox',
    source: {
      path: eventModel.source.path,
      line: 51,
      startLine: 51,
      endLine: 51,
      anchorText: 'on-arrival: public_order += 1; stability += 1',
      endAnchorText: 'on-arrival: public_order += 1; stability += 1'
    }
  }]
});
const removeSharedLineEffectProposal = existingEdit.buildProposal(removeSharedLineEffectModel, {
  structure_remove_effect_inline: 'true'
});
assert(removeSharedLineEffectProposal.changes[0].operationType === 'replace_text', 'shared-line on-arrival effect removal should use guarded line replacement');
assert(removeSharedLineEffectProposal.changes[0].after === 'on-arrival: stability += 1', 'shared-line on-arrival effect removal should remove only the selected clause');
const removeSharedLineEffectBundle = existingEdit.buildExportBundle(removeSharedLineEffectProposal, index);
assert(removeSharedLineEffectBundle.installPlan.operations[0].type === 'replace_text' && removeSharedLineEffectBundle.installPlan.operations[0].safety === 'guarded_apply', 'shared-line on-arrival effect removal should become a guarded replace_text operation');

const removeSingleOnArrivalEffectModel = Object.assign({}, eventModel, {
  fields: [{
    id: 'structure_remove_effect_single_inline',
    role: 'effect',
    label: 'Remove effect: Q.public_order += 1',
    transform: 'structure_action',
    structureAction: 'remove_effect',
    structureBefore: 'Q.public_order += 1',
    structureSourceExpression: 'public_order += 1',
    inputType: 'checkbox',
    source: {
      path: eventModel.source.path,
      line: 52,
      startLine: 52,
      endLine: 52,
      anchorText: 'on-arrival: public_order += 1',
      endAnchorText: 'on-arrival: public_order += 1'
    }
  }]
});
const removeSingleOnArrivalEffectProposal = existingEdit.buildProposal(removeSingleOnArrivalEffectModel, {
  structure_remove_effect_single_inline: 'true'
});
assert(removeSingleOnArrivalEffectProposal.changes[0].operationType === 'replace_text', 'single-clause on-arrival effect removal should use guarded line replacement');
assert(removeSingleOnArrivalEffectProposal.changes[0].after === '' && removeSingleOnArrivalEffectProposal.changes[0].allowEmptyReplace, 'single-clause on-arrival effect removal should allow an empty replacement');
const removeSingleOnArrivalEffectBundle = existingEdit.buildExportBundle(removeSingleOnArrivalEffectProposal, index);
assert(removeSingleOnArrivalEffectBundle.installPlan.operations[0].type === 'replace_text' && removeSingleOnArrivalEffectBundle.installPlan.operations[0].replace === '', 'single-clause on-arrival effect removal should become a guarded empty replace_text operation');

const complexModel = existingEdit.buildEditModel(index, 'events', 'civil_war');
assert(complexModel.ok, 'single composite event model should build: ' + JSON.stringify(complexModel.diagnostics));
assert(complexModel.options.length === 2, 'single composite event should expose section-owned options');
assert(complexModel.options[0].targetId === 'civil_war.rw_help', 'section option target should resolve to the local section endpoint');
assert(complexModel.options[0].rawTargetId === 'rw_help', 'section option should retain the editable raw target id');
const nakedOption = complexModel.options.find((option) => option.rawTargetId === 'army_backing');
assert(nakedOption && nakedOption.label === 'Ask the Army command for backing.  Now.' && nakedOption.labelSource === 'field', 'naked option lines should expose the inherited target section title as a source-backed option label');
const nakedOptionField = complexModel.fields.find((field) => field.role === 'option_label' && field.optionId === 'army_backing' && field.original === 'Ask the Army command for backing.  Now.');
assert(nakedOptionField && nakedOptionField.editability === 'guarded_replace_text', 'inherited target section title option labels should be editable instead of read-only');
assert(nakedOptionField.source && nakedOptionField.source.line === 19, 'inherited option labels should edit the target section title source line');
assert(nakedOption.labelFieldId === nakedOptionField.id, 'option rows should link naked option labels to the generated source-backed field');
const nakedOptionProposal = existingEdit.buildProposal(complexModel, {
  [nakedOptionField.id]: 'Ask the Army command for support.'
});
const nakedOptionBundle = existingEdit.buildExportBundle(nakedOptionProposal, index);
assert(nakedOptionBundle.installPlan.operations.some((op) => op.line === 19 && op.search === 'Ask the Army command for backing.  Now.' && op.replace === 'Ask the Army command for support.'), 'editing an inherited option label should create a guarded replace_text operation for the target section title');
const complexCanvas = canvasModel.buildExistingCanvas(index, 'events', 'civil_war');
const canvasNakedOption = complexCanvas.eventBody.options.find((option) => option.rawTargetId === 'army_backing');
const canvasNakedLabel = canvasNakedOption && canvasNakedOption.fields.find((field) => field.role === 'option_label');
assert(canvasNakedLabel && !canvasNakedLabel.readOnly && canvasNakedLabel.editability !== 'read_only', 'Object Canvas should not fall back to a read-only player option editor for target-title labels');
assert(complexModel.flow && complexModel.flow.summary.sectionCount >= 4, 'single composite event should expose a source-backed internal flow summary');
assert(complexModel.flow.summary.optionEdgeCount === 2, 'flow summary should count section-owned option edges');
assert(complexModel.flow.summary.conditionalRouteCount >= 1, 'flow summary should count conditional section routes');
const warOutcomeRouteEdge = complexModel.flow.edges.find((edge) => edge.from === 'civil_war.war_outcome' && edge.rawTarget === 'defeat' && edge.kind === 'conditional_route');
assert(warOutcomeRouteEdge && warOutcomeRouteEdge.source && warOutcomeRouteEdge.source.line === 22, 'flow route edges should reuse editable route source evidence');
assert(complexModel.fields.some((field) => field.role === 'condition' && field.sectionId === 'civil_war.war_outcome' && field.original === 'war_choices >= 2'), 'section view-if should be exposed as editable logic context');
assert(complexModel.fields.some((field) => field.id === 'structure_add_branch'), 'single composite event should expose add-layer structure action');
const sectionGotoField = complexModel.fields.find((field) => field.role === 'route' && field.sectionId === 'civil_war.war_outcome' && field.original === 'defeat');
assert(sectionGotoField, 'conditional section go-to should be exposed as an editable route field');
assert(sectionGotoField.condition === 'total_defeat = 1', 'conditional section go-to should expose its predicate as field condition context');
assert(sectionGotoField.conditions && sectionGotoField.conditions.includes('total_defeat = 1'), 'conditional section go-to should surface route predicates to Object Editor condition rows');
const complexProposal = existingEdit.buildProposal(complexModel, {
  [sectionGotoField.id]: 'stalemate'
});
const complexBundle = existingEdit.buildExportBundle(complexProposal, index);
assert(complexBundle.installPlan.operations.some((op) => op.line === 22 && op.search === 'defeat if total_defeat = 1' && op.replace === 'stalemate if total_defeat = 1'), 'conditional section go-to edit should preserve the predicate in a guarded replace_text operation');

const sectionPrereqPath = 'source/scenes/events/section_prereq.scene.dry';
const sectionPrereqLine = 'choose-if: public_order >= 2';
index.scenes.push({
  id: 'section_prereq',
  title: 'Section Prerequisite',
  path: sectionPrereqPath,
  type: 'event',
  tags: ['event'],
  flags: {isCard: false, isPinnedCard: false},
  routes: {goTo: [{id: 'menu', raw: 'menu'}]},
  options: [],
  sections: [
    {
      id: 'section_prereq.menu',
      title: 'Menu',
      sourceSpan: {path: sectionPrereqPath, startLine: 10, endLine: 14},
      metadata: {$file: sectionPrereqPath, $line: 10},
      routes: {},
      options: [{
        target: {id: 'open_gate'},
        title: 'Open the gated path.',
        sourceSpan: {
          path: sectionPrereqPath,
          line: 12,
          startLine: 12,
          endLine: 12,
          anchorText: '- @open_gate: Open the gated path.',
          endAnchorText: '- @open_gate: Open the gated path.'
        }
      }]
    },
    {
      id: 'section_prereq.open_gate',
      title: 'Gated Path',
      chooseIf: 'public_order >= 2',
      sourceSpan: {path: sectionPrereqPath, startLine: 20, endLine: 24},
      metadata: {
        $file: sectionPrereqPath,
        $line: 20,
        chooseIf: {path: sectionPrereqPath, line: 21, anchorText: sectionPrereqLine, endAnchorText: sectionPrereqLine}
      },
      routes: {},
      options: []
    }
  ],
  sourceSpan: {path: sectionPrereqPath, startLine: 1, endLine: 30},
  topLevelSpan: {path: sectionPrereqPath, startLine: 1, endLine: 9},
  metadata: {title: {path: sectionPrereqPath, line: 1}},
  assetRefs: []
});
index.semantic.events.push({id: 'section_prereq', title: 'Section Prerequisite', path: sectionPrereqPath, confidence: 'exact'});
const sectionPrereqModel = existingEdit.buildEditModel(index, 'events', 'section_prereq');
assert(sectionPrereqModel.ok, 'section prerequisite fixture should build: ' + JSON.stringify(sectionPrereqModel.diagnostics));
const sectionPrereqOption = sectionPrereqModel.options.find((option) => option.rawTargetId === 'open_gate');
assert(sectionPrereqOption && sectionPrereqOption.sectionChooseIf === 'public_order >= 2', 'target section choose-if should be attached to the owning option row');
const sectionPrereqField = sectionPrereqModel.fields.find((field) => field.structureAction === 'remove_option_condition' && field.optionId === 'menu__open_gate');
assert(sectionPrereqField, 'target section choose-if should expose a remove-prerequisite structure action');
assert(sectionPrereqField.editability === 'advanced_source_patch', 'target section choose-if removal should be advanced source-backed instead of fake manual review');
assert(sectionPrereqField.source && sectionPrereqField.source.line === 21, 'target section choose-if removal should keep exact source line evidence');
assert(sectionPrereqField.structureSourceBlock && sectionPrereqField.structureSourceBlock.conditionScope === 'target_section_choose_if', 'target section choose-if removal should keep section-scope evidence');
const sectionPrereqProposal = existingEdit.buildProposal(sectionPrereqModel, {
  [sectionPrereqField.id]: 'true'
});
assert(sectionPrereqProposal.changes.some((change) => change.fieldId === sectionPrereqField.id && change.editability === 'advanced_source_patch' && change.operationType === 'replace_text' && change.before === sectionPrereqLine && change.after === '' && change.allowEmptyReplace), 'target section choose-if removal should become an advanced empty replace_text change');
const sectionPrereqBundle = existingEdit.buildExportBundle(sectionPrereqProposal, index);
assert(sectionPrereqBundle.installPlan.operations.some((op) => op.type === 'replace_text' && op.safety === 'advanced_apply' && op.search === sectionPrereqLine && op.replace === ''), 'target section choose-if removal should produce an advanced empty replace_text operation');

const laborModel = existingEdit.buildEditModel(index, 'events', 'labor_unrest');
assert(laborModel.ok, 'labor unrest model should build: ' + JSON.stringify(laborModel.diagnostics));
const laborOpening = laborModel.textBlocks.find((block) => block.semanticRole === 'opening_text');
const laborResult = laborModel.textBlocks.find((block) => block.semanticRole === 'conditional_option_result_text');
const laborConditional = laborModel.textBlocks.find((block) => block.semanticRole === 'conditional_text');
assert(laborOpening && laborOpening.label === 'Opening page text', 'existing editor should classify top-level prose as opening text');
assert(laborResult && laborResult.relatedOptionIds.includes('support_labor'), 'existing editor should attach option-result text to the source option');
assert(laborResult.conditions.includes('labor_minister = "SPD"'), 'option-result text should preserve inline condition context');
assert(laborResult.label.includes('Conditional option result'), 'option-result labels should distinguish conditional result prose');
assert(laborConditional && laborConditional.conditions.includes('labor_minister != "SPD"'), 'standalone conditional section text should be classified separately from option results');

const stresemannModel = existingEdit.buildEditModel(index, 'events', 'death_of_stresemann');
assert(stresemannModel.ok, 'Death of Stresemann model should build: ' + JSON.stringify(stresemannModel.diagnostics));
const stresemannOpening = stresemannModel.textBlocks.find((block) => block.semanticRole === 'opening_text');
const stresemannBranch = stresemannModel.textBlocks.find((block) => block.semanticRole === 'conditional_text');
assert(stresemannOpening && stresemannOpening.original.includes('liberal movement') && !stresemannOpening.original.includes('dvp_leader'), 'mixed opening prose should stay separate from inline conditional branches');
assert(stresemannBranch && stresemannBranch.conditions.length === 2, 'inline conditional alternatives should be grouped as conditional branch text');
assert(stresemannBranch.conditionVariables.includes('dvp_leader'), 'conditional branch text should expose the variable it consumes');
assert(stresemannBranch.logicContext && stresemannBranch.logicContext.reads.includes('dvp_leader'), 'conditional branch text should carry logic context for the editor');
assert(stresemannBranch.conditionalAlternatives && stresemannBranch.conditionalAlternatives.length === 2, 'standalone conditional alternatives should remain inspectable as separate alternatives');
assert(stresemannBranch.conditionalAlternatives.every((item) => item.condition && item.text && item.source && item.source.path === stresemannPath && item.source.line), 'conditional alternatives should preserve condition/text/source path/source line in the edit model');
const stresemannAssetField = stresemannModel.fields.find((field) => field.role === 'asset_reference' && field.original === 'face-image: img/portraits/Stresemann.jpg');
assert(stresemannAssetField && stresemannAssetField.editability === 'manual_review', 'asset refs without safe source evidence should use the manual review branch');
assert(stresemannAssetField.sourcePath === stresemannPath, 'asset refs without source path should fall back to the scene source path');

const inlineModel = existingEdit.buildEditModel(index, 'events', 'inline_condition_conference');
assert(inlineModel.ok, 'mixed inline conditional fixture should build: ' + JSON.stringify(inlineModel.diagnostics));
assert(inlineModel.title.includes('Conference'), 'metadata title with inline conditionals should remain the object title');
const inlineOpening = inlineModel.textBlocks.find((block) => block.semanticRole === 'opening_text');
assert(inlineOpening && String(inlineOpening.original || '').trim() === inlineConditionalLine, 'mixed inline conditionals should stay as one source-line-aware opening block');
assert(inlineOpening.hasInlineConditionals && inlineOpening.inlineConditions.length === 2, 'mixed inline block should carry inline conditional metadata');
assert(inlineOpening.conditionalAlternatives && inlineOpening.conditionalAlternatives.length === 2, 'mixed inline block should expose conditional text alternatives for Object Editor display');
assert(inlineOpening.conditionalAlternatives.some((item) => item.condition === 'party_name != "CVP"' && item.text.includes('Center Party')), 'mixed inline alternatives should preserve condition text and conditional prose');
assert(inlineOpening.logicContext && inlineOpening.logicContext.conditionalAlternatives.length === 2, 'mixed inline logic context should include conditional alternatives');
assert(!inlineModel.textBlocks.some((block) => block.semanticRole === 'conditional_text' && String(block.original || '').includes('Center Party')), 'mixed inline conditionals should not become standalone branch cards');

// Inline conditional leaf editing (P3a Pillar C): each editable branch exposes
// a text + condition field whose guarded edit splices only that branch's range.
const inlineLeafTextFields = inlineModel.fields.filter((field) => field.role === 'conditional_leaf_text');
const inlineLeafConditionFields = inlineModel.fields.filter((field) => field.role === 'conditional_leaf_condition');
assert(inlineLeafTextFields.length === 2 && inlineLeafConditionFields.length === 2, 'each inline conditional branch should expose an editable text field and condition field');
const centerTextField = inlineLeafTextFields.find((field) => field.original === '<span style="color: #000000;">Center Party</span>');
assert(centerTextField && centerTextField.editability === 'guarded_replace_text', 'the Center Party branch text should be a guarded inline-leaf field');
const centerConditionField = inlineLeafConditionFields.find((field) => field.original === 'party_name != "CVP"');
assert(centerConditionField && centerConditionField.editability === 'guarded_replace_text', 'the Center Party branch condition should be a guarded inline-leaf field');
assert(centerTextField.inlineLeaf && centerTextField.inlineLeaf.lineText === inlineConditionalLine, 'inline-leaf fields should carry the verbatim source line to splice against');

// Text edit -> guarded single-line replace that changes only this branch.
const leafTextProposal = existingEdit.buildProposal(inlineModel, {[centerTextField.id]: 'Zentrum'}, {});
const leafTextChange = leafTextProposal.changes.find((change) => change.fieldId === centerTextField.id);
assert(leafTextChange && leafTextChange.before === inlineConditionalLine, 'inline-leaf text edit should anchor on the verbatim original line');
assert(leafTextChange.after === inlineConditionalLine.replace('<span style="color: #000000;">Center Party</span>', 'Zentrum'), 'inline-leaf text edit should splice only the edited branch and keep every other byte');
const leafTextBundle = existingEdit.buildExportBundle(leafTextProposal, index);
const leafTextOp = leafTextBundle.installPlan.operations.find((op) => op.line === 8 && op.type === 'replace_text');
assert(leafTextOp && leafTextOp.safety === 'guarded_apply' && leafTextOp.search === inlineConditionalLine && leafTextOp.replace.includes('Zentrum') && !leafTextOp.replace.includes('Center Party'), 'inline-leaf text edit should become a guarded exact-line replace_text operation');

// Condition edit -> splice only the condition range.
const leafConditionProposal = existingEdit.buildProposal(inlineModel, {[centerConditionField.id]: 'party_name != "ZEN"'}, {});
const leafConditionChange = leafConditionProposal.changes.find((change) => change.fieldId === centerConditionField.id);
assert(leafConditionChange && leafConditionChange.after === inlineConditionalLine.replace('party_name != "CVP"', 'party_name != "ZEN"'), 'inline-leaf condition edit should splice only the condition range');

// Gate fallback: a value that would break the grammar must not auto-guard.
const leafGateProposal = existingEdit.buildProposal(inlineModel, {[centerTextField.id]: 'broken ?] inject'}, {});
const leafGateChange = leafGateProposal.changes.find((change) => change.fieldId === centerTextField.id);
assert(leafGateChange && leafGateChange.operationType === 'manual_snippet', 'a grammar-breaking inline-leaf value must downgrade to manual review, not a guarded replace');
const leafGateBundle = existingEdit.buildExportBundle(leafGateProposal, index);
assert(!leafGateBundle.installPlan.operations.some((op) => op.type === 'replace_text' && op.safety === 'guarded_apply' && op.line === 8 && op.replace.includes('?] inject')), 'a grammar-breaking inline-leaf edit must never produce a guarded replace_text operation');

const menuPath = 'source/scenes/events/menu_branch_fixture.scene.dry';
index.scenes.push({
  id: 'menu_branch_fixture',
  title: 'Menu Branch Fixture',
  path: menuPath,
  type: 'event',
  tags: ['event'],
  flags: {isCard: false, isPinnedCard: false},
  routes: {goTo: [{id: 'free_menu', raw: 'free_menu'}]},
  options: [
    optionFixture(menuPath, 14, 'result_menu', 'Open negotiations.')
  ],
  sections: [
    {
      id: 'menu_branch_fixture.free_menu',
      title: 'Choose a tactic.',
      sourceSpan: {path: menuPath, startLine: 20, endLine: 26},
      metadata: {$file: menuPath, $line: 20},
      routes: {},
      options: [{
        id: '@talk',
        target: {kind: 'scene', id: 'talk'},
        title: 'Talk.',
        sourceSpan: {path: menuPath, line: 23, startLine: 23, endLine: 23, anchorText: '- @talk: Talk.', endAnchorText: '- @talk: Talk.'}
      }, {
        id: '@walk',
        target: {kind: 'scene', id: 'walk'},
        title: 'Walk away.',
        sourceSpan: {path: menuPath, line: 24, startLine: 24, endLine: 24, anchorText: '- @walk: Walk away.', endAnchorText: '- @walk: Walk away.'}
      }]
    },
    {
      id: 'menu_branch_fixture.result_menu',
      title: 'Negotiations open.',
      sourceSpan: {path: menuPath, startLine: 30, endLine: 36},
      metadata: {$file: menuPath, $line: 30},
      routes: {},
      options: [{
        id: '@continue',
        target: {kind: 'scene', id: 'continue'},
        title: 'Continue.',
        sourceSpan: {path: menuPath, line: 34, startLine: 34, endLine: 34, anchorText: '- @continue: Continue.', endAnchorText: '- @continue: Continue.'}
      }]
    }
  ],
  sourceSpan: {path: menuPath, startLine: 1, endLine: 40},
  topLevelSpan: {path: menuPath, startLine: 1, endLine: 18},
  metadata: {goTo: {path: menuPath, line: 5}, title: {path: menuPath, line: 1}},
  assetRefs: []
});
index.semantic.events.push({id: 'menu_branch_fixture', title: 'Menu Branch Fixture', path: menuPath, confidence: 'exact'});
index.semantic.textCorpus.items.push(
  {
    id: 'menu_branch_fixture_title',
    text: 'Menu Branch Fixture',
    role: 'title',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'menu_branch_fixture'},
    source: {path: menuPath, line: 1}
  },
  {
    id: 'menu_branch_fixture_free_menu_body',
    text: 'This is a follow-up menu that owns choices but is not itself a choice result.',
    role: 'body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'menu_branch_fixture', sectionId: 'menu_branch_fixture.free_menu'},
    source: {path: menuPath, line: 22}
  },
  {
    id: 'menu_branch_fixture_result_menu_body',
    text: 'The first choice opens this result and then presents another decision.',
    role: 'body',
    editability: 'text_proposal',
    owner: {kind: 'scene', sceneId: 'menu_branch_fixture', sectionId: 'menu_branch_fixture.result_menu'},
    source: {path: menuPath, line: 32}
  }
);

const menuModel = existingEdit.buildEditModel(index, 'events', 'menu_branch_fixture');
assert(menuModel.ok, 'menu branch fixture should build: ' + JSON.stringify(menuModel.diagnostics));
const freeMenuBlock = menuModel.textBlocks.find((block) => block.sectionId === 'menu_branch_fixture.free_menu');
const resultMenuBlock = menuModel.textBlocks.find((block) => block.sectionId === 'menu_branch_fixture.result_menu');
assert(freeMenuBlock && freeMenuBlock.semanticRole === 'menu_section_text', 'a section that only owns choices should be a follow-up menu, not an option result');
assert(freeMenuBlock.relatedOptionIds.length === 0, 'owned choices must not be treated as incoming options for menu-only sections');
assert(freeMenuBlock.ownedOptionIds.length === 2, 'menu-only sections should expose the choices they own');
assert(resultMenuBlock && resultMenuBlock.semanticRole === 'option_result_text', 'a section targeted by a choice should remain an option result');
assert(resultMenuBlock.relatedOptionIds.includes('result_menu'), 'targeted result sections should preserve incoming option ids');
assert(resultMenuBlock.ownedOptionIds.length === 1, 'option-result sections can also expose follow-up choices without duplicating their text');
const freeMenuAddOptionField = menuModel.fields.find((field) => field.structureAction === 'add_option' && field.sectionId === 'menu_branch_fixture.free_menu');
assert(freeMenuAddOptionField && freeMenuAddOptionField.editability === 'guarded_apply', 'source-backed menu sections should expose guarded add-option controls');
assert(freeMenuAddOptionField.structureSourceBlock && freeMenuAddOptionField.structureSourceBlock.kind === 'section_option_insert_anchor', 'section-owned add-option controls should carry section insert evidence');
assert(freeMenuAddOptionField.source && freeMenuAddOptionField.source.line === 24, 'section-owned add-option controls should insert after the last option in that section');
const freeMenuAddOptionProposal = existingEdit.buildProposal(menuModel, {
  [freeMenuAddOptionField.id]: '- @listen: Listen carefully.\n# listen\nThe room listens before choosing.'
});
assert(freeMenuAddOptionProposal.changes.length === 1, 'section-owned add-option proposal should contain one change');
assert(freeMenuAddOptionProposal.changes[0].editability === 'guarded_apply' && freeMenuAddOptionProposal.changes[0].operationType === 'insert_text', 'simple section-owned add-option proposals should become guarded inserts');
assert(freeMenuAddOptionProposal.changes[0].sectionId === 'menu_branch_fixture.free_menu', 'section-owned add-option proposals should retain the target section id');
const freeMenuAddOptionBundle = existingEdit.buildExportBundle(freeMenuAddOptionProposal, index);
assert(freeMenuAddOptionBundle.installPlan.operations.some((op) => op.type === 'insert_text' && op.safety === 'guarded_apply' && op.content.includes('@listen')), 'section-owned add-option proposals should produce guarded install operations');
const freeMenuRemoveOptionField = menuModel.fields.find((field) => field.structureAction === 'remove_option' && field.sectionId === 'menu_branch_fixture.free_menu' && field.structureTargetLabel === 'Walk away.');
assert(freeMenuRemoveOptionField && freeMenuRemoveOptionField.editability === 'guarded_apply', 'external-target menu choices without effects should expose guarded option-line removal');
assert(freeMenuRemoveOptionField.structureSourceBlock && freeMenuRemoveOptionField.structureSourceBlock.kind === 'option_line_delete', 'guarded option removal should carry option-line delete evidence');
const freeMenuRemoveOptionProposal = existingEdit.buildProposal(menuModel, {
  [freeMenuRemoveOptionField.id]: 'true'
});
assert(freeMenuRemoveOptionProposal.changes.length === 1, 'guarded option removal proposal should contain one change');
assert(freeMenuRemoveOptionProposal.changes[0].editability === 'guarded_apply' && freeMenuRemoveOptionProposal.changes[0].operationType === 'replace_text', 'safe option removal should become a guarded replace_text');
assert(freeMenuRemoveOptionProposal.changes[0].after === '' && freeMenuRemoveOptionProposal.changes[0].allowEmptyReplace && freeMenuRemoveOptionProposal.changes[0].deletesSourceLine, 'safe option removal should explicitly allow deleting the source option line');
const freeMenuRemoveOptionBundle = existingEdit.buildExportBundle(freeMenuRemoveOptionProposal, index);
assert(freeMenuRemoveOptionBundle.installPlan.operations.some((op) => op.type === 'replace_text' && op.safety === 'guarded_apply' && op.search === '- @walk: Walk away.' && op.replace === ''), 'safe option removal should produce a guarded empty replace_text operation');

const dnvpModel = existingEdit.buildEditModel(index, 'events', 'dnvp_congress');
assert(dnvpModel.ok, 'DNVP Congress model should build: ' + JSON.stringify(dnvpModel.diagnostics));
const dnvpVisual = dnvpModel.textBlocks.find((block) => block.visualKinds && block.visualKinds.includes('chart'));
assert(dnvpVisual && dnvpVisual.visualKinds.includes('html'), 'DNVP Congress visual table should be marked as chart/html content instead of plain prose');
assert(dnvpModel.assets.some((asset) => asset.path === 'img/events/dnvp_congress.png'), 'DNVP Congress should preserve referenced visual assets for the editor');

const unsafeLogicProposal = existingEdit.buildProposal(eventModel, {
  [routeField.id]: 'target with space',
  [effectField.id]: 'Q.public_order += 1; alert("unsafe")'
});
const unsafeLogicBundle = existingEdit.buildExportBundle(unsafeLogicProposal, index);
assert(unsafeLogicBundle.installPlan.operations.every((op) => op.type === 'replace_text' && op.safety === 'advanced_apply'), 'invalid but source-backed route/effect edits should fall back to advanced source patch');

const openingBlock = eventModel.textBlocks.find((block) => block.original.includes('film arrives'));
assert(openingBlock, 'event model should expose an opening text block');
const blockProposal = existingEdit.buildProposal(eventModel, {
  ['block:' + openingBlock.id]: 'The film arrives as a Studio section edit with a clearer public argument.\n'
});
assert(blockProposal.changes.length === 1, 'section proposal should contain one block change');
assert(blockProposal.changes[0].operationType === 'replace_section', 'section proposal should mark replace_section operation type');
const blockBundle = existingEdit.buildExportBundle(blockProposal, index);
assert(blockBundle.installPlan.operations[0].type === 'replace_section', 'section block edit should use replace_section');
assert(blockBundle.installPlan.operations[0].safety === 'guarded_apply', 'section block edit should be guarded');
blockBundle.installPlan.project = null;

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_existing_section_'));
const eventPath = path.join(tmpRoot, 'source', 'scenes', 'events');
fs.mkdirSync(eventPath, {recursive: true});
fs.writeFileSync(path.join(tmpRoot, 'source', 'info.dry'), 'title: Existing Section Fixture\n', 'utf8');
fs.writeFileSync(path.join(eventPath, 'all_quiet.scene.dry'), [
  'title: All Quiet on the Western Front',
  'tags: event',
  'view-if: year = 1930 and month >= 1 and month <= 4 and all_quiet_seen = 0',
  'priority: 1',
  'new-page: true',
  '',
  '= All Quiet on the Western Front',
  'The film arrives with a silence heavier than the posters.',
  '',
  '- @ban: Ban the film',
  '',
  '@ban',
  'Police notes thicken into policy.',
  ''
].join('\n'), 'utf8');
const blockApply = installPlan.applyInstallPlan(blockBundle.installPlan, {projectRoot: tmpRoot, dryRun: false});
assert(blockApply.ok, 'section block apply should succeed: ' + JSON.stringify(blockApply));
assert(fs.readFileSync(path.join(eventPath, 'all_quiet.scene.dry'), 'utf8').includes('Studio section edit'), 'section block apply should mutate copied source');

const unchangedProposal = existingEdit.buildProposal(eventModel, {});
assert(unchangedProposal.changes.length === 0, 'proposal with no edited values should have no changes');
assert(unchangedProposal.diagnostics.some((diag) => diag.code === 'existing_scene_edit.no_changes'), 'no-change proposal should diagnose empty edit');

const legacyNewsModel = existingEdit.buildEditModel(index, 'news', {
  delivery: 'legacy_event_popup',
  linkedSceneId: 'all_quiet',
  headline: 'All Quiet on the Western Front',
  source: {path: 'source/scenes/events/all_quiet.scene.dry', line: 2},
  excerptSource: {path: 'source/scenes/events/all_quiet.scene.dry', line: 8}
});
assert(legacyNewsModel.ok, 'legacy monthly popup news should open the linked event object');
assert(legacyNewsModel.sceneId === 'all_quiet', 'legacy monthly popup should resolve to linked scene id');
assert(legacyNewsModel.fields.some((field) => field.id === 'all_quiet_body_1'), 'legacy monthly popup editor should expose linked event text fields');

const excerptIndex = syntheticIndex();
excerptIndex.semantic.textCorpus.items.push({
  id: 'all_quiet_monthly_excerpt',
  text: 'The film arrives with a silence heavier than the posters.',
  role: 'monthly_popup_excerpt',
  editability: 'text_proposal',
  owner: {kind: 'scene', sceneId: 'all_quiet'},
  source: {
    path: 'source/scenes/events/all_quiet.scene.dry',
    line: 8,
    anchorText: 'The film arrives with a silence heavier than the posters.',
    endAnchorText: 'The film arrives with a silence heavier than the posters.'
  }
});
const excerptModel = existingEdit.buildEditModel(excerptIndex, 'events', 'all_quiet');
const derivedExcerptField = excerptModel.fields.find((field) => field.role === 'monthly_popup_excerpt');
assert(derivedExcerptField && derivedExcerptField.derivedAlias === true, 'monthly popup excerpt fields should be marked as derived aliases');
assert(derivedExcerptField.derivedFromRole === 'body', 'derived monthly popup excerpts should point users back to the body source');

const cardModel = existingEdit.buildEditModel(index, 'cards', 'agricultural_policy');
assert(cardModel.ok, 'card edit model should build: ' + JSON.stringify(cardModel.diagnostics));
assert(cardModel.sceneKind === 'card', 'card edit model should classify cards');
assert(cardModel.options.length === 5, 'existing card editor must not cap options at four');
assert(cardModel.fields.some((field) => field.id === 'agri_option_5'), 'existing card editor should include the fifth option field');
const starterDemoIndex = JSON.parse(fs.readFileSync(path.join(__dirname, 'templates/starter-demo/project-index.json'), 'utf8'));
const starterCardModel = existingEdit.buildEditModel(starterDemoIndex, 'cards', 'demo_action_card');
assert(starterCardModel.ok, 'starter demo card edit model should build: ' + JSON.stringify(starterCardModel.diagnostics));
const starterRemoveEffectField = starterCardModel.fields.find((field) => field.id === 'structure_remove_effect_demo_resources_1');
const starterNativeEffectLine = 'on-arrival: demo_resources -= 1; demo_support += 1; demo_public_attention += 1; demo_card_progress += 1';
const starterNativeEffectLineWithoutResourceSpend = 'on-arrival: demo_support += 1; demo_public_attention += 1; demo_card_progress += 1';
assert(starterRemoveEffectField && starterRemoveEffectField.editability === 'guarded_apply', 'starter demo native card effects should expose guarded effect deletion');
assert(starterRemoveEffectField.source && starterRemoveEffectField.source.anchorText === starterNativeEffectLine, 'starter demo card effect deletion should recover the exact native effect line anchor');
const starterRemoveEffectProposal = existingEdit.buildProposal(starterCardModel, {
  [starterRemoveEffectField.id]: 'true'
});
const starterRemoveEffectBundle = existingEdit.buildExportBundle(starterRemoveEffectProposal, starterDemoIndex);
assert(starterRemoveEffectBundle.installPlan.operations.some((operation) => operation.type === 'replace_text' && operation.safety === 'guarded_apply' && operation.search === starterNativeEffectLine && operation.replace === starterNativeEffectLineWithoutResourceSpend), 'starter demo card effect deletion should export a guarded native effect-line replacement');

const advancedModel = existingEdit.buildEditModel({
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
assert(advancedModel.fields[0].editability === 'advanced_source_patch', 'protected router-backed fields should stay editable through advanced source patch');

console.log(JSON.stringify({
  ok: true,
  eventFields: eventModel.fields.length,
  textBlocks: eventModel.textBlocks.length,
  eventChanges: eventProposal.changes.length,
  cardOptions: cardModel.options.length,
  advancedEditability: advancedModel.fields[0].editability
}, null, 2));
