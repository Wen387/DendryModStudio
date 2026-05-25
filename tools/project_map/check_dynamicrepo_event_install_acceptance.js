#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const eventDraft = require('./authoring/event_draft.js');
const existingSceneEdit = require('./authoring/existing_scene_edit_model.js');
const installPlan = require('./authoring/install_plan.js');
const sourceUnits = require('./authoring/event_source_unit_model.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_ROOT = path.resolve(REPO_ROOT, 'SDAAHdynamic', 'dynamic_social_democracy-main');
const ACCEPTANCE_ID = 'dms_dynamicrepo_acceptance_event';

function parseArgs(argv) {
  const opts = {
    root: path.resolve(process.env.DMS_DYNAMICREPO_ROOT || DEFAULT_ROOT),
    requireFixture: false,
    withHtmlBuild: false,
    withRuntimeProof: false,
    json: false
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      opts.root = path.resolve(argv[index + 1] || '');
      index += 1;
    } else if (arg === '--require-fixture') {
      opts.requireFixture = true;
    } else if (arg === '--with-html-build') {
      opts.withHtmlBuild = true;
    } else if (arg === '--with-runtime-proof') {
      opts.withRuntimeProof = true;
      opts.withHtmlBuild = true;
    } else if (arg === '--json') {
      opts.json = true;
    }
  }
  return opts;
}

const {fail, assert} = require('./check_harness.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function copyProjectFixture(sourceRoot) {
  assert(fs.existsSync(path.join(sourceRoot, 'source', 'info.dry')), 'DynamicRepo fixture root should contain source/info.dry: ' + sourceRoot);
  const copyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_dynamicrepo_install_'));
  fs.cpSync(sourceRoot, copyRoot, {
    recursive: true,
    filter: (source) => !source.includes(path.sep + '.git' + path.sep)
  });
  return copyRoot;
}

function buildIndex(projectRoot, label) {
  const indexPath = projectRoot + '.' + label + '.project-index.json';
  const result = childProcess.spawnSync('python3', [
    path.join(REPO_ROOT, 'tools', 'project_map', 'build_project_map.py'),
    '--root', projectRoot,
    '--out', indexPath,
    '--summary',
    '--include-excerpts',
    '--excerpt-context-lines', '1'
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024
  });
  assert(result.status === 0, 'DynamicRepo ProjectIndex build should succeed: ' + result.stderr + result.stdout);
  return {indexPath, index: readJson(indexPath), summary: result.stdout};
}

function operationStatuses(result) {
  return result.results.map((item) => item.id + ':' + item.status).join(', ');
}

function dryRunThenApply(plan, copyRoot) {
  const dry = installPlan.applyInstallPlan(plan, {projectRoot: copyRoot, dryRun: true});
  assert(dry.ok, 'DynamicRepo install plan dry-run should succeed.', dry);
  assert(dry.results.some((result) => result.status === 'would_apply'), 'DynamicRepo dry-run should include an installable mutation: ' + operationStatuses(dry), dry);
  const applied = installPlan.applyInstallPlan(plan, {projectRoot: copyRoot, dryRun: false});
  assert(applied.ok, 'DynamicRepo install plan apply should succeed.', applied);
  assert(applied.results.some((result) => result.status === 'applied'), 'DynamicRepo apply should mutate copied source: ' + operationStatuses(applied), applied);
  return {dry, applied};
}

function applyExistingEventEdit(index, copyRoot) {
  const model = existingSceneEdit.buildEditModel(index, 'events', 'all_quiet');
  assert(model.ok, 'DynamicRepo all_quiet should build an Existing Scene Editor model.', model.diagnostics);
  const bodyField = model.fields.find((field) => String(field.original || '').includes('anti-war film')) ||
    model.fields.find((field) => field.role === 'body' && String(field.editability || '').includes('guarded'));
  assert(bodyField, 'DynamicRepo all_quiet should expose at least one guarded body text field for existing-event editing.', model.fields);
  const replacement = 'As a Studio DynamicRepo acceptance edit, this copied event now records a bounded existing-event replacement.';
  const proposal = existingSceneEdit.buildProposal(model, {[bodyField.id]: replacement});
  const bundle = existingSceneEdit.buildExportBundle(proposal, index);
  assert(bundle.installPlan.draftKind === 'existing_scene_edit', 'Existing event edit should produce an existing_scene_edit install plan.', bundle.installPlan);
  assert(bundle.installPlan.operations.some((operation) => operation.type === 'replace_text'), 'Existing event edit should produce a guarded replace_text operation.', bundle.installPlan);
  const installResult = dryRunThenApply(bundle.installPlan, copyRoot);
  const eventPath = path.join(copyRoot, 'source', 'scenes', 'events', 'all_quiet.scene.dry');
  const editedText = read(eventPath);
  assert(editedText.includes(replacement), 'Existing-event installer should update all_quiet source in the copied DynamicRepo project.');
  const parsed = sourceUnits.parseEventSourceUnits(editedText, {path: 'source/scenes/events/all_quiet.scene.dry'});
  assert(parsed.coverageComplete, 'Edited all_quiet source units should remain fully represented.', parsed.uncoveredNonEmptyLines);
  assert(sourceUnits.reconstructSourceFromUnits(parsed) === editedText, 'Edited all_quiet should still no-op round-trip through source units.');
  return {
    fieldId: bodyField.id,
    operations: installResult.applied.results.map((item) => ({id: item.id, status: item.status}))
  };
}

function acceptanceDraft() {
  return {
    schemaVersion: '0.1',
    kind: 'world_event',
    eventShape: 'choice_event',
    id: ACCEPTANCE_ID,
    title: 'Studio DynamicRepo Acceptance Event',
    heading: 'Studio DynamicRepo Acceptance Event',
    subtitle: 'Installed only into a copied DynamicRepo fixture.',
    tags: ['event', 'world'],
    newPage: true,
    frequency: 2,
    setJump: 'root',
    calls: ['post_event_news'],
    rawRoutes: ['go-to: ' + ACCEPTANCE_ID + '_follow_up if public_order >= 1'],
    rawOnDisplay: ['Q.dms_dynamicrepo_preview_flag = 1;'],
    rawOnDeparture: ['Q.dms_dynamicrepo_after_event = 1;'],
    assetRefs: [
      {path: 'img/events/dms_dynamicrepo_acceptance.png', type: 'image', role: 'event_portrait'},
      {path: 'clear shuffle music/dms_dynamicrepo_acceptance.ogg', type: 'audio', directive: 'audio'}
    ],
    when: {
      year: 1936,
      monthStart: 1,
      monthEnd: 12,
      requires: 'started = 1',
      priority: 1
    },
    introParagraphs: ['This copied-project acceptance event verifies Studio can install a DynamicRepo-style world event.'],
    conditionalParagraphs: [{condition: 'public_order >= 1', text: 'Conditional acceptance text appears when public order is known.'}],
    effectsOnTrigger: [{variable: 'dms_dynamicrepo_signal', op: '+=', value: 1}],
    rawEffectsOnTrigger: ['Q.dms_dynamicrepo_raw_signal = (Q.dms_dynamicrepo_raw_signal || 0) + 1;'],
    options: [{
      id: 'accept',
      label: 'Accept the report.',
      chooseIf: 'public_order >= 0',
      unavailableText: 'Public order must be known.',
      resultMode: 'native',
      narrativeParagraphs: ['The report is accepted into the copied project.'],
      effects: [{variable: 'dms_dynamicrepo_option_score', op: '+=', value: 1}],
      rawRoutes: ['go-to: ' + ACCEPTANCE_ID + '_follow_up if public_order >= 1'],
      calls: ['post_event_news']
    }, {
      id: 'defer',
      label: 'Defer the report.',
      resultMode: 'native',
      narrativeParagraphs: ['The report waits for another month.']
    }],
    sections: [{
      id: ACCEPTANCE_ID + '_follow_up',
      title: 'Acceptance follow-up',
      condition: 'public_order >= 1',
      paragraphs: ['The follow-up branch confirms section-owned DynamicRepo fields survive installation.'],
      conditionalParagraphs: [{raw: '[? if public_order >= 1: Section conditional acceptance text. ?]', condition: 'public_order >= 1', text: 'Section conditional acceptance text.'}],
      effects: [{variable: 'dms_dynamicrepo_branch_score', op: '+=', value: 1}],
      rawEffects: ['Q.dms_dynamicrepo_branch_score *= 2;'],
      rawRoutes: ['go-to: ' + ACCEPTANCE_ID + ' if public_order < 3'],
      rawOnDeparture: ['Q.dms_dynamicrepo_branch_closed = 1;'],
      exitTarget: 'root',
      options: [{
        id: ACCEPTANCE_ID + '_nested_action',
        label: 'Open nested acceptance branch.',
        resultMode: 'native',
        returnTarget: ACCEPTANCE_ID + '_nested_result',
        effects: [{variable: 'dms_dynamicrepo_nested_choice', op: '+=', value: 1}],
        narrativeParagraphs: ['The nested acceptance branch is selected.']
      }]
    }, {
      id: ACCEPTANCE_ID + '_nested_result',
      title: 'Nested acceptance result',
      paragraphs: ['Nested acceptance result text proves multi-layer event output survives installation.'],
      effects: [{variable: 'dms_dynamicrepo_nested_score', op: '+=', value: 1}],
      assetPlacements: [{path: 'img/events/dms_dynamicrepo_acceptance.png', type: 'image', placement: 'section'}],
      exitTarget: 'root'
    }]
  };
}

function runHtmlBuild(copyRoot, withRuntimeProof) {
  const cli = path.join(REPO_ROOT, 'node_modules', 'dendrynexus', 'lib', 'cli', 'main.js');
  const result = childProcess.spawnSync('node', [cli, 'make-html', '--force', copyRoot], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024
  });
  assert(result.status === 0, 'dendrynexus make-html should compile the installed DynamicRepo copy: ' + result.stderr + result.stdout);
  const htmlPath = path.join(copyRoot, 'out', 'html', 'index.html');
  const gameJsonPath = path.join(copyRoot, 'out', 'game.json');
  assert(fs.existsSync(htmlPath), 'DynamicRepo HTML build should produce out/html/index.html');
  assert(fs.existsSync(gameJsonPath), 'DynamicRepo HTML build should produce out/game.json');
  const gameJsonText = read(gameJsonPath);
  assert(gameJsonText.includes(ACCEPTANCE_ID), 'Compiled DynamicRepo game.json should include the installed acceptance event id.');
  const runtimeProof = withRuntimeProof ? compiledRuntimeProof(gameJsonText) : {status: 'not_run'};
  return {
    status: result.status,
    htmlPath,
    gameJsonPath,
    runtimeProof,
    stdoutTail: result.stdout.trim().split('\n').slice(-5)
  };
}

function compiledRuntimeProof(gameJsonText) {
  const required = [
    ACCEPTANCE_ID + '_follow_up',
    ACCEPTANCE_ID + '_nested_action',
    ACCEPTANCE_ID + '_nested_result',
    'dms_dynamicrepo_nested_score',
    'dms_dynamicrepo_nested_choice',
    'img/events/dms_dynamicrepo_acceptance.png',
    'clear shuffle music/dms_dynamicrepo_acceptance.ogg',
    'Conditional acceptance text appears when public order is known.'
  ];
  const missing = required.filter((needle) => !gameJsonText.includes(needle));
  assert(!missing.length, 'Compiled DynamicRepo game.json should contain nested runtime proof markers.', missing);
  return {status: 'compiled_game_json_verified', checked: required.length};
}

function main() {
  const opts = parseArgs(process.argv);
  const eventsDir = path.join(opts.root, 'source', 'scenes', 'events');
  if (!fs.existsSync(eventsDir)) {
    const skipped = {ok: true, skipped: true, reason: 'DynamicRepo fixture not found', root: opts.root};
    if (opts.requireFixture) {
      fail('DynamicRepo fixture not found: ' + opts.root, skipped);
    }
    process.stdout.write(JSON.stringify(skipped, null, 2) + '\n');
    return;
  }

  const originalPostEvent = read(path.join(opts.root, 'source', 'scenes', 'post_event.scene.dry'));
  const originalAllQuiet = read(path.join(opts.root, 'source', 'scenes', 'events', 'all_quiet.scene.dry'));
  const copyRoot = copyProjectFixture(opts.root);
  const before = buildIndex(copyRoot, 'before');
  assert(before.index.project && before.index.project.root === copyRoot, 'DynamicRepo copied ProjectIndex should point at the copied root.');
  assert((before.index.project.profileIds || []).includes('sdaah-style'), 'DynamicRepo copy should be detected as sdaah-style.', before.index.project);

  const draft = acceptanceDraft();
  const bundle = eventDraft.buildExportBundle(draft, before.index);
  assert(bundle.ok, 'DynamicRepo acceptance event bundle should validate.', bundle.diagnostics);
  assert(!bundle.diagnostics.some((diag) => /duplicate_anchor|unresolved_anchor_mapping/.test(String(diag && diag.code || ''))), 'Acceptance event should not contain duplicate or unresolved anchor diagnostics.', bundle.diagnostics);
  assert(bundle.installPlan.operations.some((operation) => operation.id === 'create_scene'), 'Install plan should create the acceptance event scene.', bundle.installPlan);
  const routerOperation = bundle.installPlan.operations.find((operation) => operation.id === 'event_router_registration');
  const existingEventLane = /-\s+#event\b/.test(read(path.join(copyRoot, 'source', 'scenes', 'post_event.scene.dry')));
  assert(routerOperation || existingEventLane, 'DynamicRepo install should either generate router registration or detect an existing #event lane.', bundle.installPlan);
  const installResult = dryRunThenApply(bundle.installPlan, copyRoot);
  const existingEditResult = applyExistingEventEdit(before.index, copyRoot);

  const scenePath = path.join(copyRoot, 'source', 'scenes', 'events', ACCEPTANCE_ID + '.scene.dry');
  assert(fs.existsSync(scenePath), 'Studio installer should create the DynamicRepo acceptance event scene.');
  const sceneText = read(scenePath);
  [
    'frequency: 2',
    'set-jump: root',
    'call: post_event_news',
    'audio: clear shuffle music/dms_dynamicrepo_acceptance.ogg',
    'Q.dms_dynamicrepo_preview_flag = 1;',
    'Q.dms_dynamicrepo_branch_closed = 1;',
    'go-to: ' + ACCEPTANCE_ID + '_follow_up if public_order >= 1',
    '[? if public_order >= 1: Section conditional acceptance text. ?]',
    '- @' + ACCEPTANCE_ID + '_nested_action: Open nested acceptance branch.',
    '@' + ACCEPTANCE_ID + '_nested_result',
    'Q.dms_dynamicrepo_nested_score += 1;'
  ].forEach((needle) => assert(sceneText.includes(needle), 'Installed source should include ' + needle));

  const parsedUnits = sourceUnits.parseEventSourceUnits(sceneText, {path: 'source/scenes/events/' + ACCEPTANCE_ID + '.scene.dry'});
  assert(parsedUnits.coverageComplete, 'Installed acceptance event source units should be fully represented.', parsedUnits.uncoveredNonEmptyLines);
  assert(sourceUnits.reconstructSourceFromUnits(parsedUnits) === sceneText, 'Installed acceptance event should round-trip through no-op source-unit reconstruction.');

  const after = buildIndex(copyRoot, 'after');
  const scene = (after.index.scenes || []).find((item) => item.id === ACCEPTANCE_ID);
  assert(scene, 'Rebuilt DynamicRepo ProjectIndex should include the installed event scene.');
  assert((scene.tags || []).includes('event'), 'Installed event should retain tags:event for monthly popup routing.', scene);
  assert((after.index.semantic.events || []).some((item) => item.id === ACCEPTANCE_ID), 'Semantic event index should include the installed acceptance event.');
  assert(read(path.join(opts.root, 'source', 'scenes', 'post_event.scene.dry')) === originalPostEvent, 'Original DynamicRepo fixture must remain untouched.');
  assert(read(path.join(opts.root, 'source', 'scenes', 'events', 'all_quiet.scene.dry')) === originalAllQuiet, 'Original DynamicRepo all_quiet source must remain untouched.');

  const htmlBuild = opts.withHtmlBuild ? runHtmlBuild(copyRoot, opts.withRuntimeProof) : {status: 'not_run'};
  const report = {
    ok: true,
    kind: 'dynamicrepo_event_install_acceptance',
    fixtureRoot: opts.root,
    copyRoot,
    profiles: after.index.project.profileIds,
    routerCoverage: routerOperation ? 'install_plan_operation' : 'existing_event_lane',
    operations: installResult.applied.results.map((item) => ({id: item.id, status: item.status})),
    existingEdit: existingEditResult,
    sceneUnits: parsedUnits.summary,
    htmlBuild,
    beforeSummary: before.summary.trim().split('\n').slice(0, 4),
    afterSummary: after.summary.trim().split('\n').slice(0, 4)
  };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main();
