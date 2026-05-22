#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sourceUnits = require('./authoring/event_source_unit_model.js');
const parsedToDraft = require('./authoring/parsed_to_draft.js');
const eventDraft = require('./authoring/event_draft.js');
const existingSceneEdit = require('./authoring/existing_scene_edit_model.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_ROOT = path.resolve(REPO_ROOT, 'SDAAHdynamic', 'dynamic_social_democracy-main');
const DEFAULT_SAMPLES = [
  {id: 'hindenburg_unban_sh', expectation: 'draft', reason: 'tiny pure event'},
  {id: 'all_quiet', expectation: 'draft', reason: 'choice event with sections and guarded edits'},
  {id: 'lvp_party_congress_1928_1', expectation: 'draft', reason: 'large section event that should still round-trip into a draft'},
  {id: 'bruning_public_works', expectation: 'partial_or_better', reason: 'known partial event with sparse root choices'},
  {id: 'banking_crisis', expectation: 'partial_or_better', reason: 'large-choice event with many conditions'},
  {id: 'election_1928', expectation: 'partial_or_better', reason: 'very large election router event'}
];

function parseArgs(argv) {
  const opts = {
    root: path.resolve(process.env.DMS_DYNAMICREPO_ROOT || DEFAULT_ROOT),
    samples: DEFAULT_SAMPLES,
    requireFixture: false,
    json: false
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      opts.root = path.resolve(argv[index + 1] || '');
      index += 1;
    } else if (arg === '--samples') {
      opts.samples = String(argv[index + 1] || '')
        .split(',')
        .map((id) => ({id: id.trim(), expectation: 'partial_or_better', reason: 'requested sample'}))
        .filter((sample) => sample.id);
      index += 1;
    } else if (arg === '--require-fixture') {
      opts.requireFixture = true;
    } else if (arg === '--json') {
      opts.json = true;
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv);
  const eventsDir = path.join(opts.root, 'source', 'scenes', 'events');
  if (!fs.existsSync(eventsDir)) {
    const skipped = {ok: true, skipped: true, reason: 'DynamicRepo fixture not found', root: opts.root};
    if (opts.requireFixture) {
      fail('DynamicRepo fixture not found: ' + opts.root, skipped);
    }
    writeReport(skipped, opts);
    return;
  }

  const built = buildIndex(opts.root);
  const index = built.index;
  const samples = opts.samples.map((sample) => inspectSample(opts.root, index, sample));
  const report = {
    ok: samples.every((sample) => sample.ok),
    kind: 'dynamicrepo_event_editor_sample_audit',
    root: opts.root,
    sampleCount: samples.length,
    projectSummary: built.summary.trim().split('\n').slice(0, 6),
    aggregate: aggregate(samples),
    samples
  };
  if (!report.ok) {
    fail('DynamicRepo event editor sample audit found regressions.', report);
  }
  writeReport(report, opts);
}

function buildIndex(projectRoot) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-dynamic-samples-'));
  const indexPath = path.join(tmpDir, 'project-index.json');
  const result = childProcess.spawnSync('python3', [
    path.join(__dirname, 'build_project_map.py'),
    '--root', projectRoot,
    '--out', indexPath,
    '--summary'
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024
  });
  assert(result.status === 0, 'DynamicRepo ProjectIndex build should succeed.', {stderr: result.stderr, stdout: result.stdout});
  return {
    index: JSON.parse(fs.readFileSync(indexPath, 'utf8')),
    summary: result.stdout
  };
}

function inspectSample(projectRoot, projectIndex, sample) {
  const scene = (projectIndex.scenes || []).find((item) => item && item.id === sample.id);
  assert(scene, 'Sample event should exist in DynamicRepo ProjectIndex: ' + sample.id);
  const relativePath = String(scene.path || path.join('source/scenes/events', sample.id + '.scene.dry')).split(path.sep).join('/');
  const sourcePath = path.join(projectRoot, relativePath);
  const original = fs.readFileSync(sourcePath, 'utf8');
  const parsedSource = sourceUnits.parseEventSourceUnits(original, {path: relativePath});
  const reconstructed = sourceUnits.reconstructSourceFromUnits(parsedSource);
  const editModel = existingSceneEdit.buildEditModel(projectIndex, 'events', sample.id);
  const draftResult = parsedToDraft.buildDraftFromParsed(projectIndex, {
    view: 'events',
    itemId: sample.id,
    newId: sample.id + '_studio_sample_copy'
  });
  const draft = draftResult.draft || null;
  const validation = draft ? eventDraft.validateDraft(draft, projectIndex) : {ok: false, diagnostics: [{code: 'sample.no_draft'}]};
  const canvas = draft ? canvasModel.buildNewEventCanvas(projectIndex, draft, {entry: {source: 'DynamicRepo sample audit'}}) : null;
  const renderedSource = canvas && canvas.changeState && canvas.changeState.output && canvas.changeState.output.sceneDry || '';
  const renderedUnits = renderedSource ? sourceUnits.parseEventSourceUnits(renderedSource, {path: 'source/scenes/events/' + (draft && draft.id || sample.id) + '.scene.dry'}) : null;
  const blockers = draftResult.parity && draftResult.parity.blockers || [];
  const completeCreateAsNew = draftResult.status === 'draft' && blockers.length === 0;
  const renderedRoundTripOk = Boolean(
    renderedUnits &&
    renderedUnits.coverageComplete &&
    sourceUnits.reconstructSourceFromUnits(renderedUnits) === renderedSource
  );
  const canInstallAsNew = Boolean(completeCreateAsNew && validation.ok && canvas && canvas.ok);
  const expectationMet = sample.expectation === 'draft'
    ? canInstallAsNew
    : canInstallAsNew || (draftResult.status === 'partial' && blockers.length > 0);
  const guardedFieldCount = (editModel.fields || []).filter((field) => {
    return ['guarded_replace_text', 'guarded_apply'].includes(String(field && field.editability || ''));
  }).length;
  const ok = Boolean(
    parsedSource.coverageComplete &&
    reconstructed === original &&
    editModel.ok &&
    (editModel.fields || []).length > 0 &&
    guardedFieldCount > 0 &&
    renderedRoundTripOk &&
    expectationMet
  );
  return {
    ok,
    id: sample.id,
    reason: sample.reason,
    expectation: sample.expectation,
    source: {
      path: relativePath,
      lines: parsedSource.lineCount,
      nonEmptyLines: parsedSource.nonEmptyLineCount,
      sourceUnitCoverageComplete: parsedSource.coverageComplete,
      noOpReconstructionExact: reconstructed === original,
      sourceUnitSummary: parsedSource.summary
    },
    existingEditor: {
      ok: Boolean(editModel.ok),
      fieldCount: (editModel.fields || []).length,
      sections: (editModel.sections || []).length,
      options: (editModel.options || []).length,
      byEditability: countBy(editModel.fields || [], (field) => field.editability || 'unknown'),
      topRoles: topCounts(countBy(editModel.fields || [], (field) => field.role || 'unknown'), 10),
      diagnostics: (editModel.diagnostics || []).slice(0, 5)
    },
    createAsNew: {
      status: draftResult.status || 'unknown',
      completeCreateAsNew,
      canInstallAsNew,
      expectationMet,
      archetype: draftResult.archetypeHint || 'unknown',
      blockerCodes: blockers.map((blocker) => blocker.code || 'unknown'),
      notCaptured: (draftResult.notCaptured || []).slice(0, 8),
      roleParity: compactRoleParity(draftResult.parity && draftResult.parity.roles),
      validationOk: Boolean(validation.ok),
      canvasOk: Boolean(canvas && canvas.ok),
      renderedLines: renderedUnits ? renderedUnits.lineCount : 0,
      renderedSourceUnitCoverageComplete: Boolean(renderedUnits && renderedUnits.coverageComplete),
      renderedNoOpReconstructionExact: renderedRoundTripOk,
      canvasEditableSurface: canvas ? {
        metaFields: canvas.eventBody && canvas.eventBody.metaFields && canvas.eventBody.metaFields.length || 0,
        options: canvas.eventBody && canvas.eventBody.options && canvas.eventBody.options.length || 0,
        branchFields: canvas.eventBody && canvas.eventBody.branchSections && canvas.eventBody.branchSections.length || 0,
        diagnostics: canvas.changeState && canvas.changeState.diagnostics && canvas.changeState.diagnostics.slice(0, 5) || []
      } : null
    }
  };
}

function aggregate(samples) {
  return {
    exactSourceUnitSamples: samples.filter((sample) => sample.source.noOpReconstructionExact).length,
    completeCreateAsNewSamples: samples.filter((sample) => sample.createAsNew.completeCreateAsNew).length,
    installableCreateAsNewSamples: samples.filter((sample) => sample.createAsNew.canInstallAsNew).length,
    partialCreateAsNewSamples: samples.filter((sample) => sample.createAsNew.status === 'partial').length,
    totalExistingEditableFields: samples.reduce((sum, sample) => sum + sample.existingEditor.fieldCount, 0)
  };
}

function compactRoleParity(roles) {
  return Object.keys(roles || {}).sort().map((key) => {
    const role = roles[key] || {};
    return {
      role: key,
      parsed: role.parsed || 0,
      draft: role.draft || 0,
      missing: role.missing || 0,
      blocking: Boolean(role.blocking)
    };
  });
}

function topCounts(counts, limit) {
  return Object.keys(counts || {})
    .sort((left, right) => counts[right] - counts[left] || left.localeCompare(right))
    .slice(0, limit || 10)
    .reduce((out, key) => {
      out[key] = counts[key];
      return out;
    }, {});
}

function countBy(items, keyFn) {
  return (items || []).reduce((out, item) => {
    const key = String(keyFn(item) || 'unknown');
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
}

function writeReport(report, opts) {
  const text = JSON.stringify(report, null, 2) + '\n';
  process.stdout.write(text);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

main();
