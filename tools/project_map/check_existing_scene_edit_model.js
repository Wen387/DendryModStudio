#!/usr/bin/env node
'use strict';

const existingEdit = require('./authoring/existing_scene_edit_model.js');
const installPlan = require('./authoring/install_plan.js');
const fs = require('fs');
const os = require('os');
const path = require('path');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

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
    assetRefs: [{path: 'img/events/all_quiet.png', type: 'image', label: 'All Quiet poster', role: 'event_illustration'}],
    sourceSpan: {path: eventPath, startLine: 1, endLine: 80},
    metadata: {
      viewIf: {path: eventPath, line: 3}
    }
  };
  eventScene.options[0].chooseIf = 'public_order >= 0';
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
      title: 'Ask the Army command for backing.',
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
assert(eventModel.assets.length === 1, 'event model should preserve asset refs');

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
const addTriggerEffectField = eventModel.fields.find((field) => field.id === 'structure_add_trigger_effect');
const addOptionEffectField = eventModel.fields.find((field) => field.id === 'structure_add_option_effect_ban');
const removeOptionField = eventModel.fields.find((field) => field.id === 'structure_remove_option_ban');
const removePrereqField = eventModel.fields.find((field) => field.id === 'structure_remove_option_condition_ban');
const removeEffectField = eventModel.fields.find((field) => field.id.startsWith('structure_remove_effect_') && field.label.includes('Q.public_order += 1'));
assert(addOptionField && addOptionField.inputType === 'textarea', 'existing editor should expose an add-option structural action');
assert(addTriggerEffectField && addTriggerEffectField.role === 'effect', 'existing editor should expose an add trigger effect action');
assert(addOptionEffectField && addOptionEffectField.optionId === 'ban', 'existing editor should expose add option effect actions');
assert(removeOptionField && removeOptionField.inputType === 'checkbox', 'existing editor should expose explicit option removal');
assert(removePrereqField && removePrereqField.inputType === 'checkbox', 'existing editor should expose explicit prerequisite removal');
assert(removeEffectField && removeEffectField.inputType === 'checkbox', 'existing editor should expose explicit effect removal');
const structureProposal = existingEdit.buildProposal(eventModel, {
  [addOptionField.id]: '- @public_meeting: Hold a public meeting.\\n# public_meeting\\nThe public meeting reframes the controversy.',
  [addTriggerEffectField.id]: 'Q.public_order += 2',
  [addOptionEffectField.id]: 'Q.public_order -= 1',
  [removeOptionField.id]: 'true',
  [removePrereqField.id]: 'true',
  [removeEffectField.id]: 'true'
});
assert(structureProposal.changes.length === 6, 'structural edits should become proposal changes');
assert(structureProposal.changes.filter((change) => change.editability === 'manual_review').length === 5, 'broad structural edits should stay manual-review');
assert(structureProposal.changes.some((change) => change.fieldId === addOptionEffectField.id && change.editability === 'guarded_apply' && change.operationType === 'insert_text'), 'simple source-backed option effects should become guarded source inserts');
assert(structureProposal.changes.some((change) => change.after.includes('Add option and result layer proposal')), 'add-option proposal should explain the structural insertion');
assert(structureProposal.changes.some((change) => change.after.includes('Remove option: Ban the film')), 'remove-option proposal should explain structural deletion');
assert(structureProposal.changes.some((change) => change.before.includes('public_order >= 0') && change.after.includes('Remove prerequisite')), 'remove-prerequisite proposal should carry the deleted condition');
assert(structureProposal.changes.some((change) => change.before.includes('Q.public_order += 1') && change.after.includes('Remove effect')), 'remove-effect proposal should carry the deleted effect');
const structureBundle = existingEdit.buildExportBundle(structureProposal, index);
assert(structureBundle.installPlan.operations.filter((op) => op.type === 'manual_snippet').length === 5, 'broad structural changes should produce manual review snippets');
assert(structureBundle.installPlan.operations.some((op) => op.type === 'insert_text' && op.safety === 'guarded_apply' && op.content.includes('Q.public_order -= 1')), 'simple source-backed option-effect insertion should produce a guarded install operation');
assert(structureBundle.proposalText.includes('Add trigger effect'), 'structural proposal preview should include effect creation');
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

const complexModel = existingEdit.buildEditModel(index, 'events', 'civil_war');
assert(complexModel.ok, 'single composite event model should build: ' + JSON.stringify(complexModel.diagnostics));
assert(complexModel.options.length === 2, 'single composite event should expose section-owned options');
assert(complexModel.options[0].targetId === 'civil_war.rw_help', 'section option target should resolve to the local section endpoint');
assert(complexModel.options[0].rawTargetId === 'rw_help', 'section option should retain the editable raw target id');
const nakedOption = complexModel.options.find((option) => option.rawTargetId === 'army_backing');
assert(nakedOption && nakedOption.label === 'Ask the Army command for backing.' && nakedOption.labelSource === 'target_title', 'naked option lines should fall back to their target section title instead of generated Option labels');
assert(complexModel.flow && complexModel.flow.summary.sectionCount >= 4, 'single composite event should expose a source-backed internal flow summary');
assert(complexModel.flow.summary.optionEdgeCount === 2, 'flow summary should count section-owned option edges');
assert(complexModel.flow.summary.conditionalRouteCount >= 1, 'flow summary should count conditional section routes');
assert(complexModel.fields.some((field) => field.role === 'condition' && field.sectionId === 'civil_war.war_outcome' && field.original === 'war_choices >= 2'), 'section view-if should be exposed as editable logic context');
assert(complexModel.fields.some((field) => field.id === 'structure_add_branch'), 'single composite event should expose add-layer structure action');
const sectionGotoField = complexModel.fields.find((field) => field.role === 'route' && field.sectionId === 'civil_war.war_outcome' && field.original === 'defeat');
assert(sectionGotoField, 'conditional section go-to should be exposed as an editable route field');
const complexProposal = existingEdit.buildProposal(complexModel, {
  [sectionGotoField.id]: 'stalemate'
});
const complexBundle = existingEdit.buildExportBundle(complexProposal, index);
assert(complexBundle.installPlan.operations.some((op) => op.line === 22 && op.search === 'defeat if total_defeat = 1' && op.replace === 'stalemate if total_defeat = 1'), 'conditional section go-to edit should preserve the predicate in a guarded replace_text operation');

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

const inlineModel = existingEdit.buildEditModel(index, 'events', 'inline_condition_conference');
assert(inlineModel.ok, 'mixed inline conditional fixture should build: ' + JSON.stringify(inlineModel.diagnostics));
assert(inlineModel.title.includes('Conference'), 'metadata title with inline conditionals should remain the object title');
const inlineOpening = inlineModel.textBlocks.find((block) => block.semanticRole === 'opening_text');
assert(inlineOpening && String(inlineOpening.original || '').trim() === inlineConditionalLine, 'mixed inline conditionals should stay as one source-line-aware opening block');
assert(inlineOpening.hasInlineConditionals && inlineOpening.inlineConditions.length === 2, 'mixed inline block should carry inline conditional metadata');
assert(!inlineModel.textBlocks.some((block) => block.semanticRole === 'conditional_text' && String(block.original || '').includes('Center Party')), 'mixed inline conditionals should not become standalone branch cards');

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

const cardModel = existingEdit.buildEditModel(index, 'cards', 'agricultural_policy');
assert(cardModel.ok, 'card edit model should build: ' + JSON.stringify(cardModel.diagnostics));
assert(cardModel.sceneKind === 'card', 'card edit model should classify cards');
assert(cardModel.options.length === 5, 'existing card editor must not cap options at four');
assert(cardModel.fields.some((field) => field.id === 'agri_option_5'), 'existing card editor should include the fifth option field');

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
