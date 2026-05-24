#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const objectCanvasModel = require('./authoring/object_authoring_canvas_model.js');
const installPlan = require('./authoring/install_plan.js');
const {fail, assert} = require('./check_harness.js');

const repoRoot = path.resolve(__dirname, '..', '..');
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-election-results-'));
const sourceRoot = path.join(tmpRoot, 'source');
const scenesRoot = path.join(sourceRoot, 'scenes');
const eventsRoot = path.join(scenesRoot, 'events');
fs.mkdirSync(eventsRoot, {recursive: true});

fs.writeFileSync(path.join(sourceRoot, 'info.dry'), [
  'title: Election Results Fixture',
  'author: Dendry Mod Studio',
  'ifid: 00000000-0000-4000-8000-000000000099',
  ''
].join('\n'));
fs.writeFileSync(path.join(scenesRoot, 'root.scene.dry'), [
  'title: Root Scene',
  'new-page: true',
  '',
  '= Election Fixture',
  '',
  '- @election_reichstag: Reichstag',
  '- @presidential_election_1932_campaign: Presidential campaign',
  ''
].join('\n'));
fs.writeFileSync(path.join(eventsRoot, 'election_reichstag.scene.dry'), electionScene({
  title: 'A Reichstag Election Results',
  heading: 'Source Reichstag Results',
  intro: 'Source-backed coalition arrangements are available.',
  chartId: 'reichstag',
  scale: 'Q.reichstag_size',
  sizeLine: 'Q.reichstag_size = 4.93;',
  parties: [
    ['spd', 'SPD', 'Q.spd_r'],
    ['z', 'Center', 'Q.z_r']
  ],
  choices: [
    {
      id: 'grand_coalition',
      label: 'Accept the source grand coalition',
      detail: 'SPD + Z (58.2%)',
      result: 'The source grand coalition result text is installed.'
    },
    {
      id: 'minority',
      label: 'Try a source minority cabinet',
      detail: 'SPD only (28.7%)',
      chooseIf: 'Q.spd_r >= 28',
      result: 'The source minority cabinet result text is shown.'
    }
  ]
}));
fs.writeFileSync(path.join(eventsRoot, 'prussia_election.scene.dry'), electionScene({
  title: 'Prussian Landtag Results',
  chartId: 'prussia_landtag',
  scale: '4.50',
  sizeLine: '',
  parties: [
    ['spd_prussia', 'Prussian SPD', 'Q.spd_r_prussia'],
    ['dnvp_prussia', 'Prussian DNVP', 'Q.dnvp_r_prussia']
  ],
  extraD3Chart: {
    chartId: 'wurttemberg_landtag',
    parties: [
      ['spd_wurttemberg', 'Wurttemberg SPD', 'Q.spd_r_wurttemberg'],
      ['center_wurttemberg', 'Wurttemberg Center', 'Q.z_r_wurttemberg']
    ]
  }
}));
fs.writeFileSync(path.join(eventsRoot, 'split_election.scene.dry'), splitElectionScene());
fs.writeFileSync(path.join(eventsRoot, 'presidential_election_1932_campaign.scene.dry'), [
  'title: Presidential Election campaigning',
  'subtitle: It is campaign season.',
  'tags: event',
  'view-if: year = 1932 and hindenburg_run',
  'go-to: candidate_selection',
  '',
  '= Presidential Election campaigning',
  '',
  'The presidential election campaign is a normal event flow, not a parliament seat chart.',
  '',
  '@candidate_selection',
  '',
  '- @campaigning_braun: Time to hit the campaign trail!',
  '- @campaigning_hindenburg: Hindenburg takes a turn to campaign.',
  '',
  '@campaigning_braun',
  '',
  'We rally the Iron Front and spend resources on the campaign.',
  ''
].join('\n'));

const outPath = path.join(tmpRoot, 'project-index.json');
childProcess.execFileSync('python3', [
  path.join(repoRoot, 'tools/project_map/build_project_map.py'),
  '--root',
  tmpRoot,
  '--out',
  outPath,
  '--include-excerpts'
], {cwd: repoRoot, stdio: 'pipe'});

const index = JSON.parse(fs.readFileSync(outPath, 'utf8'));
const electionResults = index.semantic && index.semantic.electionResults && index.semantic.electionResults.items || [];
assert(electionResults.length === 5, 'ProjectIndex should expose source-backed D3 election result screens, including multiple charts in one scene');
assert(!electionResults.some((item) => item.id === 'presidential_election_1932_campaign'), 'Presidential campaign events should not be parsed as D3 parliament result screens');
const reichstag = electionResults.find((item) => item.id === 'election_reichstag');
const prussia = electionResults.find((item) => item.id === 'prussia_election');
const wurttemberg = electionResults.find((item) => item.id === 'prussia_election__wurttemberg_landtag');
const splitGerman = electionResults.find((item) => item.id === 'split_election');
const splitFrench = electionResults.find((item) => item.id === 'split_election__split_france');
assert(reichstag && reichstag.chartElementId === 'reichstag', 'Reichstag D3 target should be parsed from d3.select');
assert(reichstag.seatsTotal === '493', 'Reichstag seat total should be inferred from Q.reichstag_size');
assert(reichstag.parties.some((party) => party.name === 'SPD'), 'Reichstag party rows should be parsed from D3 data blocks');
assert(prussia && prussia.chartElementId === 'prussia_landtag', 'State election D3 target should be parsed from d3.select');
assert(prussia.seatsTotal === '450', 'State election seat total should be inferred from static scale factors');
assert(prussia.parties.some((party) => party.name === 'Prussian DNVP'), 'State election party rows should preserve source-specific labels');
assert(!prussia.parties.some((party) => party.name === 'Wurttemberg SPD'), 'State election party rows should stay scoped to the selected D3 chart data');
assert(wurttemberg && wurttemberg.sceneId === 'prussia_election', 'Additional D3 charts in the same scene should keep their source scene id for event editing');
assert(wurttemberg.chartElementId === 'wurttemberg_landtag', 'Additional D3 chart target should be exposed as a separate selector source');
assert(wurttemberg.parties.some((party) => party.name === 'Wurttemberg SPD'), 'Additional D3 chart source should carry its own scoped party rows');
assert(splitGerman && splitFrench, 'Split fixture should expose both D3 sources from a multi-section scene');

const model = objectCanvasModel.buildTemplateCanvas(index, 'election_results', {}, {
  values: {
    'election.targetSceneId': 'prussia_election',
    'election.chartElementId': 'reichstag',
    'election.party.0.name': 'Stale SPD'
  }
});
const draft = model.changeState.draft;
assert(draft.targetSceneId === 'prussia_election', 'Selector change should update targetSceneId');
assert(draft.sourcePath === 'source/scenes/events/prussia_election.scene.dry', 'Selector change should rebase the source path');
assert(draft.chartElementId === 'prussia_landtag', 'Selector change should rebase the D3 chart id');
assert(draft.seatsTotal === '450', 'Selector change should rebase source-derived seat total');
assert(draft.parties.some((party) => party.name === 'Prussian SPD'), 'Selector change should load selected-source parties');
assert(!draft.parties.some((party) => party.name === 'Stale SPD'), 'Selector change should ignore stale party form values');
assert(!draft.electionEvents.some((item) => item.id === 'presidential_election_1932_campaign'), 'Election Results source selector should exclude ordinary presidential election events');

const sourceTextModel = objectCanvasModel.buildTemplateCanvas(index, 'election_results', {}, {
  values: {'election.targetSceneId': 'election_reichstag'}
});
const sourceTextDraft = sourceTextModel.changeState.draft;
assert(sourceTextDraft.title === 'Source Reichstag Results', 'Election Results draft should use the selected source event heading as the preview title');
assert(sourceTextDraft.intro === 'Source-backed coalition arrangements are available.', 'Election Results draft should load source event opening text instead of the fixed template intro');
assert(sourceTextDraft.choices.some((choice) => choice.label === 'Accept the source grand coalition'), 'Election Results draft should load source event option labels');
assert(sourceTextDraft.choices.some((choice) => choice.resultText === 'The source minority cabinet result text is shown.'), 'Election Results draft should load source event option result text');
assert(sourceTextDraft.choices.some((choice) => choice.condition === 'Q.spd_r >= 28' && choice.disabled), 'Election Results draft should preserve source option choose-if conditions');
assert(!sourceTextDraft.choices.some((choice) => choice.label === 'We can form a Grand Coalition.'), 'Election Results draft should not keep fixed sample choices for a source-backed event');
assert(sourceTextDraft.coalitions.some((coalition) => coalition.parties.includes('SPD + Z')), 'Election Results draft should derive coalition summary rows from source option details when available');

const guardedTextModel = objectCanvasModel.buildTemplateCanvas(index, 'election_results', {}, {
  values: {
    'election.targetSceneId': 'election_reichstag',
    'election.title': 'Updated Reichstag Results',
    'election.choice.0.label': 'Accept the updated source grand coalition'
  }
});
const guardedOps = guardedTextModel.changeState.installPlan.operations;
assert(guardedOps.some((op) => op.id === 'election_results_title' && op.type === 'replace_text' && op.safety === 'guarded_apply'), 'Election Results install plan should guard exact source-backed title replacements');
assert(guardedOps.some((op) => op.id === 'election_choice_grand_coalition_label' && op.type === 'replace_text' && op.safety === 'guarded_apply'), 'Election Results install plan should guard exact source-backed choice label replacements');
assert(guardedOps.some((op) => op.type === 'manual_snippet' && op.role === 'election_results.runtime_renderer'), 'Election Results install plan should keep D3/chart/custom renderer wiring manual');
assert(!guardedOps.some((op) => /chart|d3|party/i.test(op.id) && op.safety === 'guarded_apply'), 'Election Results install plan should not auto-guard D3 chart or party formula rewrites');
const guardedDryRun = installPlan.applyInstallPlan(guardedTextModel.changeState.installPlan, {
  projectRoot: tmpRoot,
  dryRun: true,
  includeEvidence: true
});
assert(guardedDryRun.ok, 'Election Results guarded source plan should pass installer dry-run', guardedDryRun);
assert(guardedDryRun.results.some((result) => result.id === 'election_results_title' && result.status === 'would_apply'), 'Election Results title should be dry-run applyable', guardedDryRun);
assert(guardedDryRun.results.some((result) => result.id === 'election_choice_grand_coalition_label' && result.status === 'would_apply'), 'Election Results choice label should be dry-run applyable', guardedDryRun);
assert(guardedDryRun.results.some((result) => result.id === 'election_results_runtime_manual_review' && result.status === 'manual_review'), 'Election Results runtime renderer should remain manual in installer dry-run', guardedDryRun);
const guardedApply = installPlan.applyInstallPlan(guardedTextModel.changeState.installPlan, {
  projectRoot: tmpRoot,
  dryRun: false,
  includeEvidence: true
});
assert(guardedApply.ok, 'Election Results guarded source plan should apply through Studio installer', guardedApply);
const appliedElectionSource = fs.readFileSync(path.join(eventsRoot, 'election_reichstag.scene.dry'), 'utf8');
assert(appliedElectionSource.includes('Updated Reichstag Results'), 'Installer apply should update the source-backed Election Results title');
assert(appliedElectionSource.includes('Accept the updated source grand coalition'), 'Installer apply should update the source-backed Election Results choice label');
assert(!fs.existsSync(path.join(tmpRoot, 'out')), 'Election Results installer apply should not write generated runtime output');

const splitGermanDraft = objectCanvasModel.buildTemplateCanvas(index, 'election_results', {}, {
  values: {'election.targetSceneId': 'split_election'}
}).changeState.draft;
assert(splitGermanDraft.intro.includes('German source body'), 'First D3 source should load text from its own section');
assert(!splitGermanDraft.intro.includes('French source body'), 'First D3 source should not load text from a later D3 section');
assert(splitGermanDraft.choices.some((choice) => choice.label === 'Keep German result'), 'First D3 source should load its own section option');
assert(!splitGermanDraft.choices.some((choice) => choice.label === 'Keep French result'), 'First D3 source should not keep a later section option');

const splitFrenchDraft = objectCanvasModel.buildTemplateCanvas(index, 'election_results', {}, {
  values: {'election.targetSceneId': 'split_election__split_france'}
}).changeState.draft;
assert(splitFrenchDraft.intro.includes('French source body'), 'Second D3 source should load text from its own section');
assert(!splitFrenchDraft.intro.includes('German source body'), 'Second D3 source should not inherit the first D3 source text');
assert(splitFrenchDraft.choices.some((choice) => choice.label === 'Keep French result'), 'Second D3 source should load its own section option');
assert(!splitFrenchDraft.choices.some((choice) => choice.label === 'Keep German result'), 'Second D3 source should not keep the first section option');

const presidential = objectCanvasModel.buildExistingCanvas(index, 'events', 'presidential_election_1932_campaign', {});
assert(presidential.ok, 'Presidential election campaign should still open in the existing Event editor');
assert(presidential.eventBody && presidential.eventBody.options.length >= 1, 'Presidential election campaign should expose event options in the existing Event editor');

process.stdout.write(JSON.stringify({
  ok: true,
  electionResults: electionResults.length,
  selected: draft.targetSceneId
}, null, 2) + '\n');

function electionScene(config) {
  const choices = Array.isArray(config.choices) && config.choices.length
    ? config.choices
    : [{id: 'root', label: 'Continue', detail: '', result: ''}];
  return [
    'title: ' + config.title,
    'tags: event',
    'on-display: {!',
    config.sizeLine,
    'var data = [{',
    '  "id": "' + config.parties[0][0] + '",',
    '  "legend": "' + config.parties[0][1] + '",',
    '  "name": "' + config.parties[0][1] + '",',
    '  "seats": Math.round(' + config.parties[0][2] + ' * ' + config.scale + '),',
    '}];',
    'data.push({',
    '  "id": "' + config.parties[1][0] + '",',
    '  "legend": "' + config.parties[1][1] + '",',
    '  "name": "' + config.parties[1][1] + '",',
    '  "seats": Math.round(' + config.parties[1][2] + ' * ' + config.scale + '),',
    '});',
    'if (window && d3) {',
    '  var parliament = d3.parliament();',
    '  d3.select("#' + config.chartId + '").datum(data).call(parliament);',
    extraD3ChartLines(config.extraD3Chart),
    '}',
    '!}',
    '',
    '= ' + (config.heading || config.title),
    '',
    config.intro || '',
    '',
    '{!<svg id="' + config.chartId + '" style="width: 500px; height: 250px;"> </svg>!}',
    '',
    ...choices.map((choice) => '- @' + choice.id + ': ' + choice.label + (choice.detail ? ' — ' + choice.detail : '')),
    '',
    ...choices.flatMap((choice) => choice.result ? [
      '@' + choice.id,
      choice.chooseIf ? 'choose-if: ' + choice.chooseIf : '',
      '',
      choice.result,
      ''
    ] : []),
    ''
  ].filter((line) => line !== undefined).join('\n');
}

function extraD3ChartLines(config) {
  if (!config) {
    return undefined;
  }
  return [
    '  const otherData = [{',
    '    "id": "' + config.parties[0][0] + '",',
    '    "legend": "' + config.parties[0][1] + '",',
    '    "name": "' + config.parties[0][1] + '",',
    '    "seats": Math.round(' + config.parties[0][2] + ' * 0.80),',
    '  }];',
    '  otherData.push({',
    '    "id": "' + config.parties[1][0] + '",',
    '    "legend": "' + config.parties[1][1] + '",',
    '    "name": "' + config.parties[1][1] + '",',
    '    "seats": Math.round(' + config.parties[1][2] + ' * 0.80),',
    '  });',
    '  d3.select("#' + config.chartId + '").datum(otherData).call(parliament);'
  ].join('\n');
}

function splitElectionScene() {
  return [
    'title: Split Election Sources',
    'tags: event',
    '',
    '@german_result',
    'on-display: {!',
    'var germanData = [{',
    '  "id": "spd",',
    '  "legend": "German SPD",',
    '  "name": "German SPD",',
    '  "seats": Math.round(Q.spd_r * 4.93),',
    '}];',
    'if (window && d3) {',
    '  var parliament = d3.parliament();',
    '  d3.select("#split_reichstag").datum(germanData).call(parliament);',
    '}',
    '!}',
    '',
    '= German Results',
    '',
    'German source body should stay with the Reichstag chart.',
    '',
    '{!<svg id="split_reichstag" style="width: 500px; height: 250px;"> </svg>!}',
    '',
    '- @german_finish: Keep German result — SPD + Z (52.0%)',
    '',
    '@german_finish',
    '',
    'German result body.',
    '',
    '@french_result',
    'on-display: {!',
    'var frenchData = [{',
    '  "id": "sfio",',
    '  "legend": "French SFIO",',
    '  "name": "French SFIO",',
    '  "seats": Math.round(Q.sfio_r * 4.00),',
    '}];',
    'if (window && d3) {',
    '  var parliament = d3.parliament();',
    '  d3.select("#split_france").datum(frenchData).call(parliament);',
    '}',
    '!}',
    '',
    '= French Results',
    '',
    'French source body should stay with the France chart.',
    '',
    '{!<svg id="split_france" style="width: 500px; height: 250px;"> </svg>!}',
    '',
    '- @french_finish: Keep French result — SFIO + PRS (48.0%)',
    '',
    '@french_finish',
    '',
    'French result body.',
    ''
  ].join('\n');
}
