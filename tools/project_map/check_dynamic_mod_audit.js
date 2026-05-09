#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const coverage = require('./authoring/visible_object_coverage_model.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_MAP_ROOT = __dirname;
const DEFAULT_DYNAMIC_ROOT = path.join(REPO_ROOT, 'SDAAHdynamic', 'dynamic_social_democracy-main');
const DYNAMIC_ROOT = path.resolve(process.env.DMS_DYNAMIC_FIXTURE_ROOT || process.env.DMS_SDAAH_FIXTURE_ROOT || DEFAULT_DYNAMIC_ROOT);
const FIXTURES = [
  {id: 'qa-mini', root: path.join(PROJECT_MAP_ROOT, 'fixtures', 'qa-mini'), includeExcerpts: true},
  {id: 'contract-fixture', root: path.join(REPO_ROOT, 'studio_contract', 'parser_fixture'), includeExcerpts: true},
  {id: 'dynamic-mod', root: DYNAMIC_ROOT, includeExcerpts: true}
];

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildIndex(fixture) {
  assert(fs.existsSync(path.join(fixture.root, 'source', 'info.dry')), fixture.id + ' root should contain source/info.dry', {root: fixture.root});
  const outPath = path.join(os.tmpdir(), 'dms_' + fixture.id.replace(/[^A-Za-z0-9_-]/g, '_') + '_audit_project_index.json');
  const args = [
    path.join(PROJECT_MAP_ROOT, 'build_project_map.py'),
    '--root', fixture.root,
    '--out', outPath,
    '--summary'
  ];
  if (fixture.includeExcerpts) {
    args.push('--include-excerpts', '--excerpt-context-lines', '2');
  }
  const result = childProcess.spawnSync('python3', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  assert(result.status === 0, fixture.id + ' ProjectIndex build should succeed', {stdout: result.stdout, stderr: result.stderr});
  return {
    id: fixture.id,
    root: fixture.root,
    outPath,
    stdout: result.stdout,
    index: readJson(outPath)
  };
}

function summarizeIndex(item) {
  const index = item.index || {};
  const semantic = index.semantic || {};
  const news = semantic.news || {};
  const diagnostics = Array.isArray(index.diagnostics) ? index.diagnostics : [];
  const report = coverage.buildCoverageReport(index, {includeVariables: true, includeStructuredLogic: true});
  return {
    id: item.id,
    project: index.project && index.project.name || '',
    root: item.root,
    profiles: index.project && index.project.profileIds || [],
    counts: {
      scenes: (index.scenes || []).length,
      edges: (index.edges || []).length,
      variables: (index.variables || []).length,
      events: (semantic.events || []).length,
      cards: (semantic.cards || []).length,
      monthlyPopups: (news.eventPopups || []).length,
      surfaceText: semantic.surfaceText && (semantic.surfaceText.items || []).length || 0,
      textCorpus: semantic.textCorpus && (semantic.textCorpus.items || []).length || 0,
      assets: semantic.assets && (semantic.assets.items || semantic.assets || []).length || 0,
      diagnostics: diagnostics.length
    },
    diagnostics: diagnosticSummary(diagnostics),
    coverage: compactCoverage(report.summary),
    manualSamples: sampleRows(report.rows, (row) => row.installSafety === 'manual_review' || row.routeClass === 'manual_review', 8),
    refusedSamples: sampleRows(report.rows, (row) => row.installSafety === 'refused', 8),
    weakSafeSamples: sampleRows(report.rows, (row) => row.safeEditEligible && !row.safeEditable, 8),
    gapCandidates: gapCandidates(index, report, diagnostics)
  };
}

function diagnosticSummary(diagnostics) {
  const byCode = {};
  diagnostics.forEach((item) => {
    const code = String(item && (item.code || item.kind || item.severity) || 'unknown');
    byCode[code] = (byCode[code] || 0) + 1;
  });
  return {
    total: diagnostics.length,
    top: Object.entries(byCode).sort((left, right) => right[1] - left[1]).slice(0, 12).map(([code, count]) => ({code, count})),
    sample: diagnostics.slice(0, 5).map((item) => ({
      severity: item.severity || '',
      code: item.code || '',
      sceneId: item.sceneId || '',
      path: item.path || item.source && item.source.path || '',
      message: String(item.message || '').slice(0, 180)
    }))
  };
}

function compactCoverage(summary) {
  const value = summary || {};
  return {
    total: value.total || 0,
    routeCoverage: round(value.routeCoverage),
    safeEditCoverage: round(value.safeEditCoverage),
    previewCoverage: round(value.previewCoverage),
    manualBoundaryCount: value.manualBoundaryCount || 0,
    unsupportedCount: value.unsupportedCount || 0,
    structuredLogicCoverage: round(value.structuredLogicCoverage),
    goalW: compactGoal(value.goalW),
    goalX: compactGoal(value.goalX),
    byArea: value.byArea || {},
    byRoute: value.byRoute || {},
    bySafety: value.bySafety || {},
    byType: value.byType || {}
  };
}

function compactGoal(goal) {
  const value = goal || {};
  return {
    eligible: value.eligible || 0,
    safeEditable: value.safeEditable || 0,
    safeEditCoverage: round(value.safeEditCoverage),
    previewCoverage: round(value.previewCoverage),
    passes70: Boolean(value.passes70),
    passes90: Boolean(value.passes90)
  };
}

function sampleRows(rows, predicate, limit) {
  return (rows || []).filter(predicate).slice(0, limit).map((row) => ({
    area: row.area || '',
    type: row.objectType || '',
    role: row.role || '',
    label: String(row.label || '').slice(0, 120),
    route: row.routeClass || '',
    safety: row.installSafety || '',
    source: row.source && row.source.path || ''
  }));
}

function gapCandidates(index, report, diagnostics) {
  const rows = report.rows || [];
  const byDiag = countBy(diagnostics, (item) => item.code || 'unknown');
  const monthlyManual = rows.filter((row) => row.objectType === 'monthly_popup' && row.installSafety === 'manual_review').length;
  const variableManual = rows.filter((row) => row.objectType === 'variable' && row.safeEditEligible && !row.safeEditable).length;
  const refusedRows = rows.filter((row) => row.installSafety === 'refused');
  const protectedRefused = refusedRows.filter((row) => protectedOutputSource(row.source && row.source.path)).length;
  const unexpectedRefused = refusedRows.length - protectedRefused;
  return [
    gap('P1', 'conditional_go_to_runtime_order', byDiag.project_map && byDiag.project_map.conditional_goto || byDiag['project_map.conditional_goto'] || 0, 'Conditional/chained go-to routes are represented, but remain runtime-order-sensitive.'),
    gap('P1', 'opaque_q_dynamic', byDiag['project_map.dynamic_q_opaque'] || 0, 'Opaque Q dynamic expressions cannot be safely rewritten as structured effects.'),
    gap('P1', 'monthly_popup_manual_review', monthlyManual, 'SDAAH-style monthly event popups route to Object Workspace but still install as manual review.'),
    gap('P2', 'variable_edit_not_safe_apply', variableManual, 'Variables are discoverable but source-backed add/remove/write safety remains limited.'),
    gap('P0', 'unexpected_refused_visible_rows', unexpectedRefused, 'Visible rows outside protected output are refused and need routing/safety audit.'),
    gap('P3', 'protected_output_refused_boundary', protectedRefused, 'Protected generated output is visible but intentionally refused for automatic editing.')
  ].filter((item) => item.count > 0);
}

function protectedOutputSource(sourcePath) {
  const value = String(sourcePath || '').replace(/\\/g, '/');
  return value.startsWith('out/html/') || value === 'out/game.json' || value.startsWith('.git/');
}

function countBy(items, keyFn) {
  return (items || []).reduce((counts, item) => {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function gap(severity, id, count, note) {
  return {severity, id, count, note};
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 10000) / 10000 : 0;
}

const built = FIXTURES.map(buildIndex);
const summaries = built.map(summarizeIndex);
const dynamic = summaries.find((item) => item.id === 'dynamic-mod');

assert(dynamic.profiles.includes('sdaah-style'), 'Dynamic fixture should be detected as sdaah-style', dynamic.profiles);
assert(dynamic.counts.scenes >= 400, 'Dynamic fixture should exercise a large scene corpus', dynamic.counts);
assert(dynamic.counts.monthlyPopups >= 100, 'Dynamic fixture should expose monthly event popups', dynamic.counts);
assert(dynamic.coverage.routeCoverage === 1, 'Dynamic visible object route coverage should remain complete', dynamic.coverage);

process.stdout.write(JSON.stringify({
  ok: true,
  dynamicRoot: DYNAMIC_ROOT,
  comparison: summaries.map((item) => ({
    id: item.id,
    project: item.project,
    profiles: item.profiles,
    counts: item.counts,
    coverage: {
      routeCoverage: item.coverage.routeCoverage,
      safeEditCoverage: item.coverage.safeEditCoverage,
      goalW: item.coverage.goalW,
      goalX: item.coverage.goalX,
      manualBoundaryCount: item.coverage.manualBoundaryCount,
      bySafety: item.coverage.bySafety
    },
    diagnosticTop: item.diagnostics.top.slice(0, 5)
  })),
  dynamic: {
    diagnostics: dynamic.diagnostics,
    coverage: dynamic.coverage,
    manualSamples: dynamic.manualSamples,
    refusedSamples: dynamic.refusedSamples,
    weakSafeSamples: dynamic.weakSafeSamples,
    gapCandidates: dynamic.gapCandidates
  }
}, null, 2) + '\n');
