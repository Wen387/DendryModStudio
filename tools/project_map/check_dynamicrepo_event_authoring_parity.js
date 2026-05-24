#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const sourceUnits = require('./authoring/event_source_unit_model.js');
const {fail} = require('./check_harness.js');

const DEFAULT_ROOT = path.resolve(__dirname, '..', '..', 'SDAAHdynamic', 'dynamic_social_democracy-main');
const REQUIRED_DIRECTIVES = [
  'title',
  'subtitle',
  'tags',
  'new-page',
  'priority',
  'frequency',
  'max-visits',
  'view-if',
  'on-arrival',
  'on-display',
  'on-departure',
  'choose-if',
  'unavailable-subtitle',
  'go-to',
  'call',
  'set-jump',
  'face-image',
  'set-bg',
  'audio'
];

function parseArgs(argv) {
  const opts = {
    root: DEFAULT_ROOT,
    requireFixture: false,
    withProjectIndex: false,
    json: false
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      opts.root = path.resolve(argv[index + 1] || '');
      index += 1;
    } else if (arg === '--require-fixture') {
      opts.requireFixture = true;
    } else if (arg === '--with-project-index') {
      opts.withProjectIndex = true;
    } else if (arg === '--json') {
      opts.json = true;
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv);
  if (!fs.existsSync(path.join(opts.root, 'source', 'scenes', 'events'))) {
    const skipped = {
      ok: true,
      skipped: true,
      reason: 'DynamicRepo fixture not found',
      root: opts.root
    };
    if (opts.requireFixture) {
      fail('DynamicRepo fixture not found: ' + opts.root, skipped);
    }
    writeReport(skipped, opts);
    return;
  }

  const eventFiles = walk(path.join(opts.root, 'source', 'scenes', 'events'))
    .filter((file) => file.endsWith('.scene.dry'))
    .sort();
  const fileReports = eventFiles.map((file) => {
    const text = fs.readFileSync(file, 'utf8');
    const parsed = sourceUnits.parseEventSourceUnits(text, {path: rel(opts.root, file)});
    const reconstructed = sourceUnits.reconstructSourceFromUnits(parsed);
    return {
      file: rel(opts.root, file),
      lineCount: parsed.lineCount,
      nonEmptyLineCount: parsed.nonEmptyLineCount,
      coverageComplete: parsed.coverageComplete,
      noOpMatchesOriginal: reconstructed === text,
      uncoveredNonEmptyLines: parsed.uncoveredNonEmptyLines,
      countsByKind: parsed.countsByKind,
      countsByCoverageClass: parsed.countsByCoverageClass,
      directiveCounts: parsed.directiveCounts,
      summary: parsed.summary,
      sourceManifest: parsed.sourceManifest
    };
  });

  const aggregate = aggregateReports(fileReports);
  let parsedToDraft = {status: 'not_run'};
  if (opts.withProjectIndex) {
    parsedToDraft = runParsedToDraftAudit(opts.root);
  }
  const report = {
    ok: true,
    kind: 'dynamicrepo_event_authoring_parity_audit',
    root: opts.root,
    eventFileCount: eventFiles.length,
    sourceCoverage: {
      completeFiles: fileReports.filter((item) => item.coverageComplete).length,
      incompleteFiles: fileReports.filter((item) => !item.coverageComplete).map((item) => item.file),
      nonEmptyLines: aggregate.nonEmptyLines,
      coveredNonEmptyLines: aggregate.coveredNonEmptyLines
    },
    noOpPreservation: {
      exactFiles: fileReports.filter((item) => item.noOpMatchesOriginal).length,
      mismatchFiles: fileReports.filter((item) => !item.noOpMatchesOriginal).map((item) => item.file)
    },
    directiveCoverage: aggregate.directiveCoverage,
    sourceUnitCoverage: aggregate.sourceUnitCoverage,
    largeFiles: fileReports.slice().sort((a, b) => b.lineCount - a.lineCount).slice(0, 10).map((item) => ({
      file: item.file,
      lineCount: item.lineCount,
      sections: item.summary.sections,
      options: item.summary.options,
      hooks: item.summary.hooks,
      routes: item.summary.routes,
      rawBlocks: item.summary.rawBlocks
    })),
    parsedToDraft,
    acceptanceBaseline: {
      eventFilesExpected: 381,
      eventFilesActual: eventFiles.length,
      allSourceUnitsRepresented: fileReports.every((item) => item.coverageComplete),
      allNoOpReconstructionExact: fileReports.every((item) => item.noOpMatchesOriginal),
      requiredDirectivesRepresented: REQUIRED_DIRECTIVES.filter((key) => aggregate.directiveCoverage[key] && aggregate.directiveCoverage[key].occurrences > 0)
    }
  };
  if (eventFiles.length < 300) {
    report.ok = false;
    fail('DynamicRepo event audit found too few event files.', report);
  }
  if (!report.sourceCoverage.completeFiles || report.sourceCoverage.incompleteFiles.length) {
    report.ok = false;
    fail('DynamicRepo event source-unit coverage is incomplete.', report);
  }
  if (report.noOpPreservation.mismatchFiles.length) {
    report.ok = false;
    fail('DynamicRepo event no-op reconstruction changed source text.', report);
  }
  if (opts.withProjectIndex && parsedToDraft.status !== 'ok') {
    report.ok = false;
    fail('DynamicRepo parsed-to-draft audit did not complete.', report);
  }
  writeReport(report, opts);
}

function runParsedToDraftAudit(projectRoot) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-dynamic-index-'));
  const outPath = path.join(tmpDir, 'project-index.json');
  const buildScript = path.join(__dirname, 'build_project_map.py');
  const build = childProcess.spawnSync('python3', [buildScript, '--root', projectRoot, '--out', outPath], {
    cwd: path.resolve(__dirname, '..', '..'),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });
  if (build.status !== 0) {
    return {
      status: 'build_failed',
      error: build.stderr || build.stdout || String(build.error || 'unknown build failure')
    };
  }
  const projectIndex = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  const parsedToDraft = require('./authoring/parsed_to_draft.js');
  const eventScenes = (projectIndex.scenes || []).filter((scene) => {
    return String(scene && scene.path || '').startsWith('source/scenes/events/') &&
      String(scene && scene.path || '').endsWith('.scene.dry');
  });
  const statusCounts = {};
  const archetypes = {};
  const blockerCounts = {};
  const samples = [];
  eventScenes.forEach((scene) => {
    try {
      const result = parsedToDraft.buildDraftFromParsed(projectIndex, {
        view: 'events',
        itemId: scene.id,
        newId: scene.id + '_audit_copy'
      });
      const status = result.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      const archetype = result.archetypeHint || 'unknown';
      archetypes[archetype] = (archetypes[archetype] || 0) + 1;
      ((result.parity && result.parity.blockers) || []).forEach((blocker) => {
        blockerCounts[blocker.code || 'unknown'] = (blockerCounts[blocker.code || 'unknown'] || 0) + 1;
      });
      if (status !== 'draft' && samples.length < 12) {
        samples.push({
          id: scene.id,
          status,
          archetype,
          notCaptured: result.notCaptured || []
        });
      }
    } catch (error) {
      statusCounts.error = (statusCounts.error || 0) + 1;
      if (samples.length < 12) {
        samples.push({id: scene.id, status: 'error', error: String(error && error.message || error)});
      }
    }
  });
  return {
    status: 'ok',
    eventCount: eventScenes.length,
    statusCounts,
    archetypes,
    blockerCounts,
    samples
  };
}

function aggregateReports(reports) {
  const directiveTotals = {};
  const sourceUnitCoverage = {};
  let nonEmptyLines = 0;
  let coveredNonEmptyLines = 0;
  reports.forEach((report) => {
    nonEmptyLines += report.nonEmptyLineCount;
    coveredNonEmptyLines += report.coverageComplete ? report.nonEmptyLineCount : report.nonEmptyLineCount - report.uncoveredNonEmptyLines.length;
    Object.keys(report.directiveCounts || {}).forEach((key) => {
      directiveTotals[key] = (directiveTotals[key] || 0) + report.directiveCounts[key];
    });
    Object.keys(report.countsByCoverageClass || {}).forEach((key) => {
      sourceUnitCoverage[key] = (sourceUnitCoverage[key] || 0) + report.countsByCoverageClass[key];
    });
  });
  const directiveCoverage = {};
  REQUIRED_DIRECTIVES.forEach((key) => {
    directiveCoverage[key] = {occurrences: directiveTotals[key] || 0, coverage: directiveTotals[key] ? 'represented' : 'absent_in_fixture'};
  });
  Object.keys(directiveTotals).sort().forEach((key) => {
    if (!directiveCoverage[key]) {
      directiveCoverage[key] = {
        occurrences: directiveTotals[key],
        coverage: knownDirectiveKeys().has(key) ? 'represented' : 'source_backed_editable'
      };
    }
  });
  return {directiveCoverage, sourceUnitCoverage, nonEmptyLines, coveredNonEmptyLines};
}

function knownDirectiveKeys() {
  const sets = [
    sourceUnits.METADATA_DIRECTIVES,
    sourceUnits.HOOK_DIRECTIVES,
    sourceUnits.ROUTE_DIRECTIVES,
    sourceUnits.ASSET_DIRECTIVES,
    sourceUnits.CONDITION_DIRECTIVES
  ];
  return sets.reduce((out, set) => {
    if (set && typeof set.forEach === 'function') {
      set.forEach((key) => out.add(key));
    }
    return out;
  }, new Set());
}

function walk(dir, out) {
  const rows = out || [];
  fs.readdirSync(dir).forEach((name) => {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, rows);
    } else {
      rows.push(full);
    }
  });
  return rows;
}

function rel(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function writeReport(report, opts) {
  const text = JSON.stringify(report, null, 2) + '\n';
  if (opts.json) {
    process.stdout.write(text);
    return;
  }
  if (report.skipped) {
    process.stdout.write('DynamicRepo event audit skipped: ' + report.reason + '\n');
    return;
  }
  process.stdout.write(text);
}

main();
