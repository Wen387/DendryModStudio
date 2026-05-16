#!/usr/bin/env node
'use strict';

const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const complexAuthoring = require('./authoring/complex_event_authoring_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

function syntheticIndex() {
  return {
    schemaVersion: '0.1',
    project: {name: 'Complex Event Authoring Fixture', root: '/tmp/dms-complex-authoring', profileIds: ['generic-dendry']},
    profiles: [{id: 'generic-dendry'}],
    scenes: [
      {id: 'root', path: 'source/scenes/root.scene.dry'},
      {
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
      }
    ],
    variables: [
      {name: 'demo_support'},
      {name: 'demo_public_attention'},
      {name: 'demo_dynamic_pressure'},
      {name: 'demo_cabinet_balance'},
      {name: 'demo_election_timer'},
      {name: 'year'},
      {name: 'month'}
    ],
    semantic: {events: [], cards: [], news: {sources: []}}
  };
}

function complexDraft() {
  return {
    schemaVersion: '0.1',
    kind: 'world_event',
    id: 'complex_authoring_flow',
    title: 'Complex authoring flow',
    heading: 'Committee meets the crisis',
    subtitle: 'A trial-run fixture',
    tags: ['event', 'world'],
    newPage: true,
    useSeenFlag: true,
    seenFlag: 'complex_authoring_flow_seen',
    when: {
      year: 1932,
      monthStart: 3,
      monthEnd: 4,
      requires: 'demo_support >= 0',
      priority: 1
    },
    introParagraphs: [
      'The committee starts with public pressure, cabinet bargaining, and a possible election follow-up.'
    ],
    effectsOnTrigger: [
      {variable: 'demo_dynamic_pressure', op: '+=', value: 1}
    ],
    options: [
      {
        id: 'hold_line',
        label: 'Hold the organizing line.',
        chooseIf: 'demo_support >= 0',
        unavailableText: 'The organization is not ready.',
        narrativeParagraphs: ['The organizers publish a disciplined instruction sheet.'],
        returnTarget: 'committee_floor',
        effects: [{variable: 'demo_dynamic_pressure', op: '+=', value: 2}]
      },
      {
        id: 'bargain',
        label: 'Bargain with the cabinet bloc.',
        narrativeParagraphs: ['The cabinet bloc asks for a quieter tone.'],
        returnTarget: 'root',
        effects: [{variable: 'demo_cabinet_balance', op: '+=', value: 1}]
      },
      {
        id: 'wait_for_press',
        label: 'Wait for press attention.',
        chooseIf: 'demo_public_attention >= 1',
        unavailableText: 'No press attention exists yet.',
        narrativeParagraphs: ['The press line waits for visible attention.'],
        returnTarget: 'root'
      },
      {
        id: 'call_election',
        label: 'Prepare an election follow-up.',
        narrativeParagraphs: ['The committee prepares a follow-up vote schedule.'],
        returnTarget: 'election_follow_up',
        effects: [{variable: 'demo_election_timer', op: '+=', value: 1}]
      }
    ],
    sections: [
      {
        id: 'committee_floor',
        title: 'Committee floor',
        condition: 'demo_dynamic_pressure >= 2',
        paragraphs: ['The second layer opens after pressure rises.'],
        effects: [{variable: 'demo_cabinet_balance', op: '+=', value: 1}],
        options: [
          {
            id: 'publish_minutes',
            label: 'Publish the minutes.',
            narrativeParagraphs: ['The minutes make the faction split visible.'],
            returnTarget: 'root',
            effects: [{variable: 'demo_public_attention', op: '+=', value: 2}]
          }
        ]
      },
      {
        id: 'election_follow_up',
        title: 'Election follow-up',
        paragraphs: ['A new vote is scheduled after the event path resolves.'],
        exitTarget: 'root'
      }
    ]
  };
}

function groupKeys(groups) {
  return new Set((groups || []).map((group) => group.key));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function runComplexEventAuthoringFlow() {
  const model = canvasModel.buildNewEventCanvas(syntheticIndex(), complexDraft(), {});
  assert(model.ok, 'complex authoring fixture should build', model.changeState.diagnostics);

  const body = model.eventBody;
  assert(Array.isArray(body.choiceUnits) && body.choiceUnits.length === 5, 'EventBody should expose complete choice units, including section-owned choices.', body.choiceUnits);
  const pressureMap = complexAuthoring.referencePressureMap();
  assert(pressureMap.length === 5, 'reference pressure map should include the Dynamic benchmark set', pressureMap);
  assert(pressureMap.some((row) => row.id === 'presidential_election_1932_candidate' && row.pressures.includes('menu_return_loop')), 'pressure map should name the large menu-loop benchmark', pressureMap);

  const holdLine = body.choiceUnits.find((choice) => choice.id === 'hold_line');
  assert(holdLine, 'hold_line choice unit should exist', body.choiceUnits);
  assert(holdLine.chooseCondition === 'demo_support >= 0', 'choice unit should preserve choose condition', holdLine);
  assert(holdLine.unavailableText === 'The organization is not ready.', 'choice unit should preserve unavailable text', holdLine);
  assert(holdLine.consequences.rawEffects.some((effect) => effect.variable === 'demo_dynamic_pressure'), 'choice unit should keep raw effects', holdLine);
  assert(holdLine.continuation.nextTarget === 'committee_floor', 'choice unit should explain the next playable step', holdLine.continuation);

  const keys = groupKeys(body.consequenceGroups);
  assert(keys.has('public_support'), 'consequence groups should classify public pressure/support effects', body.consequenceGroups);
  assert(keys.has('government'), 'consequence groups should classify cabinet/government effects', body.consequenceGroups);
  assert(keys.has('time_election'), 'consequence groups should classify election scheduling effects', body.consequenceGroups);
  assert(body.consequenceGroups.every((group) => group.rawPreserved), 'consequence grouping must not drop raw source-backed effects', body.consequenceGroups);

  assert(body.continuationMap.summary.directRoutes >= 1, 'continuation map should include direct same-event routes', body.continuationMap);
  assert(body.continuationMap.summary.menuReturns >= 1, 'continuation map should include menu returns', body.continuationMap);
  assert(body.playabilityChecks.ok, 'base complex event should have no blocking playability errors', body.playabilityChecks);

  const trial = complexAuthoring.runTrial(body, {
    initialState: {
      demo_support: 1,
      demo_public_attention: 0,
      demo_dynamic_pressure: 0,
      demo_cabinet_balance: 0,
      demo_election_timer: 0
    },
    paths: [
      {name: 'pressure_then_publish_then_return', choices: ['hold_line', 'publish_minutes', 'bargain']},
      {name: 'cabinet_bargain', choices: ['bargain']}
    ]
  });
  assert(trial.ok, 'trial run should walk two playable paths', trial);
  assert(trial.paths.length === 2, 'trial run should report two paths', trial);
  assert(trial.paths[0].steps[0].choices.some((choice) => choice.id === 'wait_for_press' && choice.selectable === false), 'trial run should report unavailable choices', trial.paths[0].steps[0]);
  assert(trial.paths[0].steps[0].scriptEffects.some((effect) => effect === 'Q.demo_dynamic_pressure += 1'), 'trial run should apply safe trigger script effects before choices', trial.paths[0]);
  assert(!trial.paths[0].steps[2].scriptEffects.some((effect) => effect === 'Q.demo_dynamic_pressure += 1'), 'trial run should not reapply root arrival scripts after returning to root', trial.paths[0]);
  assert(trial.paths[0].finalState.demo_dynamic_pressure === 3, 'trial run should apply trigger and first-path pressure effects once', trial.paths[0]);
  assert(trial.paths[0].finalState.demo_public_attention === 2, 'trial run should apply nested path effects', trial.paths[0]);
  assert(trial.paths[1].finalState.demo_cabinet_balance === 1, 'trial run should apply second-path effects', trial.paths[1]);

  const nestedTrial = complexAuthoring.runTrial(body, {
    initialState: {
      demo_support: 1,
      demo_dynamic_pressure: 2,
      demo_public_attention: 0
    },
    paths: [
      {name: 'start_inside_branch', startSection: 'committee_floor', choices: ['publish_minutes']}
    ]
  });
  assert(nestedTrial.ok, 'trial path should preserve explicit startSection for section-owned choices', nestedTrial);

  const proseConditionTrap = clone(body);
  const bargain = proseConditionTrap.options.find((option) => option.id === 'bargain');
  bargain.fields.push({
    id: 'block:section_text_complex_authoring_flow_bargain_conditional_99_1',
    semanticRole: 'conditional_option_result_text',
    label: 'Conditional option result: Bargain with the cabinet bloc.',
    value: '[? if impossible_gate: This is result prose, not a choose condition. ?]'
  });
  const proseTrapReport = complexAuthoring.buildComplexEventAuthoringModel(proseConditionTrap, {trialRun: false});
  const proseTrapChoice = proseTrapReport.choiceUnits.find((choice) => choice.id === 'bargain');
  assert(proseTrapChoice.chooseCondition === '', 'conditional result prose should not be mistaken for a choose condition', proseTrapChoice);

  const broken = clone(body);
  broken.options.forEach((option) => {
    option.chooseIf = option.chooseIf || 'missing_gate >= 1';
    option.fields.forEach((field) => {
      if (/chooseIf$/.test(field.id)) field.value = field.value || 'missing_gate >= 1';
      if (option.id === 'bargain' && /returnTarget$/.test(field.id)) field.value = 'lost_branch';
    });
  });
  const brokenReport = complexAuthoring.buildComplexEventAuthoringModel(broken, {trialRun: false});
  assert(brokenReport.playability.diagnostics.some((item) => item.code === 'complex_event.all_root_choices_conditioned'), 'playability should warn when every root choice is gated', brokenReport.playability);
  assert(brokenReport.playability.diagnostics.some((item) => item.code === 'complex_event.missing_target'), 'playability should flag missing continuation targets', brokenReport.playability);

  const html = previewEditor.render(model);
  assert(html.includes('data-preview-object-choice-units="true"'), 'UI should render complete choice unit summary');
  assert(html.includes('data-preview-object-consequence-groups="true"'), 'UI should render consequence groups');
  assert(html.includes('data-preview-object-continuation-map="true"'), 'UI should render continuation map');

  return {
    ok: true,
    choiceUnits: body.choiceUnits.length,
    consequenceGroups: body.consequenceGroups.length,
    trialPaths: trial.paths.length,
    pressureReferences: pressureMap.length,
    playabilityDiagnostics: brokenReport.playability.diagnostics.length
  };
}

if (require.main === module) {
  process.stdout.write(JSON.stringify(runComplexEventAuthoringFlow(), null, 2) + '\n');
} else {
  module.exports = {runComplexEventAuthoringFlow};
}
