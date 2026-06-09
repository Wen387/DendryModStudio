#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_MAP_ROOT = path.join(ROOT, 'tools', 'project_map');
const DEFAULT_BUDGET_FILE = path.join(PROJECT_MAP_ROOT, 'source_complexity_budget.json');

const EXCLUDED_DIR_PARTS = new Set([
  'node_modules',
  'dist',
  'dist-builder',
  'out',
  '__pycache__',
  '.pytest_cache',
  'runtime'
]);

const INCLUDED_EXTENSIONS = new Set(['.js', '.py', '.css', '.html']);

const THRESHOLDS = {
  '.js': {warn: 1200, exception: 1800},
  '.py': {warn: 1200, exception: 1800},
  '.css': {warn: 2500, exception: 3500},
  '.html': {warn: 1800, exception: 2600}
};

const SPECIAL_THRESHOLDS = [
  {
    pattern: /^tools\/project_map\/viewer\/i18n\/[^/]+\.js$/,
    thresholds: {warn: 2200, exception: 3000},
    note: 'i18n catalog'
  }
];

// A single commit may add at most this many lines to an already-large (warn or
// exception) file versus its committed (HEAD) version. Bigger additions must put
// their bulk in a focused/sibling module rather than piling onto a hot file. This
// replaces the retired cross-file aggregate ratchet: the friction is now LOCAL
// (don't balloon THIS file) with no unrelated-file offset accounting.
const MAX_SINGLE_COMMIT_GROWTH = 35;

const KNOWN_SPLIT_HINTS = new Map([
  ['tools/project_map/viewer/app.js', 'Split Explore model/list/inspector/edit-actions/assets into focused modules.'],
  ['tools/project_map/viewer/design_ui.js', 'Split graph rendering, inspector, filters, and pointer interactions.'],
  ['tools/project_map/viewer/object_authoring_canvas_ui.js', 'Keep state/routing orchestration here; move editor UI into focused workspace modules.'],
  ['tools/project_map/viewer/preview_object_editor.js', 'Keep reusable preview field rendering here; move Complex Event Builder and other domain sub-renderers into sibling modules.'],
  ['tools/project_map/viewer/wizard_ui.js', 'Avoid adding new wizard domains here; route new templates to dedicated UI modules.'],
  ['tools/project_map/viewer/styles.css', 'Keep as an import manifest; add new selectors to domain CSS files.'],
  ['tools/project_map/viewer/i18n.js', 'Keep as runtime only; add strings to language catalogs.'],
  ['tools/project_map/viewer/index.html', 'Avoid large new template blocks; prefer extracted template hosts or dedicated panels.'],
  ['tools/project_map/build_project_map.py', 'Split indexer domains: profiles, variables, graph, semantics, news, assets, text corpus, surface text.']
]);

const BUDGET_REASONS = new Map([
  ['tools/project_map/authoring/event_structure_model.js', 'Split event structure logic before adding more behavior.'],
  ['tools/project_map/authoring/existing_scene_edit_model.js', 'Split scene edit logic before adding more behavior.'],
  ['tools/project_map/authoring/install_plan.js', 'Split install-plan domains before adding more behavior.'],
  ['tools/project_map/authoring/object_canvas_content_adapters.js', 'Split content adapters before adding more object canvas behavior.'],
  ['tools/project_map/qa/run_desktop_scenario.js', 'Split desktop scenario runner before adding more scenarios.'],
  ['tools/project_map/viewer/index.html', 'Extract large template blocks into dedicated panels.'],
  ['tools/project_map/viewer/object_authoring_canvas_ui.js', 'Keep orchestration here; split editor UI into workspace modules.'],
  ['tools/project_map/viewer/preview_object_editor.js', 'Keep field rendering here; split domain sub-renderers into sibling modules.'],
  ['tools/project_map/viewer/styles/editing.css', 'Split new selectors into focused domain CSS files.'],
  ['tools/project_map/viewer/wizard_ui.js', 'Route new wizard domains to dedicated UI modules.']
]);

function walkFiles(dir, out) {
  fs.readdirSync(dir, {withFileTypes: true}).forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIR_PARTS.has(entry.name)) {
        walkFiles(fullPath, out);
      }
      return;
    }
    if (entry.isFile() && INCLUDED_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(fullPath);
    }
  });
}

function relative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function lineCount(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  if (!text) {
    return 0;
  }
  return text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
}

function thresholdsFor(filePath) {
  const relPath = relative(filePath);
  const special = SPECIAL_THRESHOLDS.find((item) => item.pattern.test(relPath));
  if (special) {
    return special.thresholds;
  }
  return THRESHOLDS[path.extname(filePath)];
}

function classify(filePath, lines) {
  const ext = path.extname(filePath);
  const thresholds = thresholdsFor(filePath);
  if (!thresholds) {
    return 'ok';
  }
  if (lines >= thresholds.exception) {
    return 'exception';
  }
  if (lines >= thresholds.warn) {
    return 'warn';
  }
  return 'ok';
}

function hintFor(relPath, status) {
  if (KNOWN_SPLIT_HINTS.has(relPath)) {
    return KNOWN_SPLIT_HINTS.get(relPath);
  }
  const special = SPECIAL_THRESHOLDS.find((item) => item.pattern.test(relPath));
  if (special) {
    return 'Catalog files may be larger than logic modules; keep each language separate and avoid runtime code here.';
  }
  if (status === 'exception') {
    return 'Needs an explicit split plan or a documented exception before more features land here.';
  }
  if (status === 'warn') {
    return 'Prefer adding new feature code to a focused sibling module.';
  }
  return '';
}

function summarize(rows) {
  return rows.reduce((summary, row) => {
    summary.files += 1;
    summary.lines += row.lines;
    summary[row.status] = (summary[row.status] || 0) + 1;
    return summary;
  }, {files: 0, lines: 0, ok: 0, warn: 0, exception: 0});
}

function parseArgs(argv) {
  const args = {
    budgetFile: DEFAULT_BUDGET_FILE,
    enforceBudget: false,
    printBudgetTemplate: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--enforce-budget') {
      args.enforceBudget = true;
      continue;
    }
    if (arg === '--budget-file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('--budget-file requires a path');
      }
      args.budgetFile = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    if (arg === '--print-budget-template') {
      args.printBudgetTemplate = true;
      continue;
    }
    throw new Error('Unknown argument: ' + arg);
  }

  return args;
}

function collectRows() {
  const files = [];
  walkFiles(PROJECT_MAP_ROOT, files);
  return files
    .map((filePath) => {
      const lines = lineCount(filePath);
      const relPath = relative(filePath);
      const status = classify(filePath, lines);
      return {
        path: relPath,
        lines,
        status,
        hint: hintFor(relPath, status)
      };
    })
    .sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));
}

function formatReport(rows) {
  const summary = summarize(rows);
  const flagged = rows.filter((row) => row.status !== 'ok');
  const lines = [
    'Source complexity report for tools/project_map',
    'Files: ' + summary.files + '  Lines: ' + summary.lines,
    'OK: ' + summary.ok + '  Warn: ' + summary.warn + '  Exception-sized: ' + summary.exception,
    ''
  ];

  if (!flagged.length) {
    lines.push('No files exceed advisory thresholds.');
    return lines.join('\n') + '\n';
  }

  lines.push('Flagged files:');
  flagged.forEach((row) => {
    const marker = row.status === 'exception' ? 'EXCEPTION' : 'WARN';
    lines.push('- ' + marker + ' ' + row.lines + ' lines  ' + row.path);
    if (row.hint) {
      lines.push('  ' + row.hint);
    }
  });

  lines.push('');
  lines.push('Thresholds:');
  Object.keys(THRESHOLDS).sort().forEach((ext) => {
    const threshold = THRESHOLDS[ext];
    lines.push('- ' + ext + ': warn >= ' + threshold.warn + ', exception >= ' + threshold.exception);
  });
  SPECIAL_THRESHOLDS.forEach((item) => {
    lines.push('- ' + item.note + ': warn >= ' + item.thresholds.warn + ', exception >= ' + item.thresholds.exception);
  });

  return lines.join('\n') + '\n';
}

function budgetReasonFor(row) {
  if (BUDGET_REASONS.has(row.path)) {
    return BUDGET_REASONS.get(row.path);
  }
  return row.hint || 'Needs an explicit split plan before more features land here.';
}

function budgetTemplate(rows) {
  return {
    version: 1,
    exceptions: rows
      .filter((row) => row.status === 'exception')
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((row) => ({
        path: row.path,
        maxLines: row.lines,
        reason: budgetReasonFor(row)
      }))
  };
}

function loadBudget(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error('Unable to read budget file ' + displayPath(filePath) + ': ' + error.message);
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.exceptions)) {
    throw new Error('Budget file must contain an exceptions array: ' + displayPath(filePath));
  }

  const exceptions = new Map();
  parsed.exceptions.forEach((entry, index) => {
    const label = 'exceptions[' + index + ']';
    if (!entry || typeof entry !== 'object') {
      throw new Error(label + ' must be an object');
    }
    if (typeof entry.path !== 'string' || !entry.path) {
      throw new Error(label + '.path must be a non-empty string');
    }
    if (!Number.isInteger(entry.maxLines) || entry.maxLines < 0) {
      throw new Error(label + '.maxLines must be a non-negative integer');
    }
    if (entry.allowRaise !== undefined && typeof entry.allowRaise !== 'boolean') {
      throw new Error(label + '.allowRaise must be a boolean when present');
    }
    if (entry.growthExemption !== undefined
      && (typeof entry.growthExemption !== 'string' || !/\b\d{4}-\d{2}-\d{2}\b/.test(entry.growthExemption))) {
      throw new Error(label + '.growthExemption must be a reason string carrying an ISO date (YYYY-MM-DD)');
    }
    if (exceptions.has(entry.path)) {
      throw new Error('Duplicate budget entry for ' + entry.path);
    }
    exceptions.set(entry.path, entry);
  });

  return {filePath, exceptions};
}

function evaluateBudget(rows, budget) {
  const rowByPath = new Map(rows.map((row) => [row.path, row]));
  const problems = [];

  rows
    .filter((row) => row.status === 'exception')
    .forEach((row) => {
      if (!budget.exceptions.has(row.path)) {
        problems.push({
          kind: 'new-exception',
          row
        });
      }
    });

  budget.exceptions.forEach((entry, relPath) => {
    const row = rowByPath.get(relPath);
    if (row && row.lines > entry.maxLines) {
      problems.push({
        kind: 'over-budget',
        row,
        entry
      });
    }
  });

  return problems.sort((a, b) => a.row.path.localeCompare(b.row.path) || a.kind.localeCompare(b.kind));
}

function committedBudgetEntries(budgetRelPath) {
  const result = spawnSync('git', ['show', 'HEAD:' + budgetRelPath], {cwd: ROOT, encoding: 'utf8'});
  if (!result || result.status !== 0 || typeof result.stdout !== 'string') {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (_error) {
    return null;
  }
  if (!parsed || !Array.isArray(parsed.exceptions)) {
    return null;
  }
  const map = new Map();
  parsed.exceptions.forEach((entry) => {
    if (entry && typeof entry.path === 'string' && Number.isInteger(entry.maxLines)) {
      map.set(entry.path, {
        maxLines: entry.maxLines,
        growthExemption: typeof entry.growthExemption === 'string' ? entry.growthExemption : null
      });
    }
  });
  return map;
}

function evaluateNoRaise(budget, committed) {
  const problems = [];
  if (!committed) {
    return problems;
  }
  budget.exceptions.forEach((entry, relPath) => {
    if (entry.allowRaise === true) {
      return;
    }
    const prior = committed.get(relPath);
    if (prior && typeof prior.maxLines === 'number' && entry.maxLines > prior.maxLines) {
      problems.push({
        kind: 'ceiling-raised',
        row: {path: relPath, lines: entry.maxLines},
        entry,
        from: prior.maxLines
      });
    }
  });
  return problems.sort((a, b) => a.row.path.localeCompare(b.row.path));
}

// ARCHITECTURE.md is the registry of extraction-blocked files: a backlog line
// that names a `path` in backticks and carries the word BLOCKED. Parsed rather
// than hardcoded so the architecture doc stays the single source of truth for
// growthExemption eligibility.
function parseExtractionBlockedPaths(markdown) {
  const paths = new Set();
  String(markdown || '').split('\n').forEach((line) => {
    if (!/\bBLOCKED\b/.test(line)) {
      return;
    }
    const match = line.match(/`([^`]+\.(?:js|py|css|html))`/);
    if (match) {
      paths.add('tools/project_map/' + match[1]);
    }
  });
  return paths;
}

function extractionBlockedPaths() {
  try {
    return parseExtractionBlockedPaths(fs.readFileSync(path.join(PROJECT_MAP_ROOT, 'ARCHITECTURE.md'), 'utf8'));
  } catch (_error) {
    return new Set();
  }
}

// A growthExemption is only legitimate on a file the architecture doc registers
// as extraction-blocked; anywhere else the answer is to split the file, so the
// entry itself is a budget problem.
function evaluateExemptionPlacement(budget, blockedPaths) {
  const problems = [];
  budget.exceptions.forEach((entry, relPath) => {
    if (typeof entry.growthExemption !== 'string') {
      return;
    }
    if (!blockedPaths.has(relPath)) {
      problems.push({
        kind: 'exemption-not-blocked',
        row: {path: relPath, lines: entry.maxLines},
        entry
      });
    }
  });
  return problems.sort((a, b) => a.row.path.localeCompare(b.row.path));
}

// Reviewed per-case exemption from the growth gate (the "Option B" escape
// hatch): a budget entry's growthExemption — a dated reason string — approves
// ONE oversized growth, and only counts while it is FRESH, i.e. its text
// differs from the committed budget (it was written or rewritten in this very
// commit). Once the commit lands the texts match, the exemption goes stale,
// and the next oversized growth needs a new dated re-approval. This keeps the
// bypass per-case instead of a standing waiver. Eligibility is restricted to
// extraction-blocked files via blockedPaths (placement problems are reported
// separately by evaluateExemptionPlacement).
function growthExemptionState(budget, committed, blockedPaths) {
  const state = new Map();
  budget.exceptions.forEach((entry, relPath) => {
    if (typeof entry.growthExemption !== 'string' || !blockedPaths.has(relPath)) {
      return;
    }
    const prior = committed ? committed.get(relPath) : null;
    const priorText = prior && typeof prior.growthExemption === 'string' ? prior.growthExemption : null;
    state.set(relPath, priorText === entry.growthExemption ? 'stale' : 'fresh');
  });
  return state;
}

// Per-file growth gate. The failure mode this guards is the easy local optimum:
// cramming a whole new feature into an already-large hot file, ratcheting
// complexity and coupling up one commit at a time. So
// any file that is already warn- or exception-sized may grow by at most
// MAX_SINGLE_COMMIT_GROWTH lines versus its committed (HEAD) version in a single
// commit; a bigger jump means the bulk belongs in a focused/sibling module. This
// is deliberately LOCAL — it does not make unrelated files trade budget with each
// other (the retired aggregate ratchet did, which produced fake offset churn and
// dead-locked once every pool file was tight). New files (no HEAD version) are
// governed by evaluateBudget's new-exception rule instead, so they are skipped
// here. The comparison is skipped entirely when git history is unavailable.
function headLineCount(relPath) {
  const result = spawnSync('git', ['show', 'HEAD:' + relPath], {cwd: ROOT, encoding: 'utf8'});
  if (!result || result.status !== 0 || typeof result.stdout !== 'string') {
    return null;
  }
  const text = result.stdout;
  if (!text) {
    return 0;
  }
  return text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
}

// Only the large (non-ok) files matter for the gate and the advisory, so limit
// the git lookups to those (a handful) rather than every source file.
function collectHeadLineCounts(rows) {
  const map = new Map();
  rows
    .filter((row) => row.status !== 'ok')
    .forEach((row) => {
      const head = headLineCount(row.path);
      if (head !== null) {
        map.set(row.path, head);
      }
    });
  return map;
}

// Pure logic (headLineByPath injected) so the model test can exercise it without
// git. Returns enforced problems plus advisory growth deltas for every changed
// large file. exemptionState (optional, from growthExemptionState) maps a path
// to 'fresh' (this commit re-approved an oversized growth: allow it, tag the
// advisory) or 'stale' (an old exemption exists but was not re-approved: still
// a problem, with a pointed hint).
function evaluateGrowth(rows, headLineByPath, maxGrowth, exemptionState) {
  const problems = [];
  const growths = [];
  const state = exemptionState || new Map();
  rows
    .filter((row) => row.status !== 'ok')
    .forEach((row) => {
      if (!headLineByPath.has(row.path)) {
        return;
      }
      const head = headLineByPath.get(row.path);
      const delta = row.lines - head;
      const exempted = delta > maxGrowth && state.get(row.path) === 'fresh';
      if (delta !== 0) {
        growths.push({path: row.path, head: head, current: row.lines, delta: delta, exempted: exempted});
      }
      if (delta > maxGrowth && !exempted) {
        problems.push({
          kind: 'growth-exceeded',
          row: row,
          from: head,
          delta: delta,
          staleExemption: state.get(row.path) === 'stale'
        });
      }
    });
  return {problems: problems, growths: growths};
}

function formatBudgetResult(problems, budgetFile, growths) {
  const lines = ['Budget enforcement:'];
  if (!problems.length) {
    lines.push('PASS ' + displayPath(budgetFile) + ': no new exception-sized files, nothing over its maxLines, no oversized single-commit growth.');
  } else {
    lines.push('FAIL ' + displayPath(budgetFile));
    problems.forEach((problem) => {
      if (problem.kind === 'new-exception') {
        lines.push('- NEW EXCEPTION ' + problem.row.lines + ' lines  ' + problem.row.path);
        if (problem.row.hint) {
          lines.push('  ' + problem.row.hint);
        }
        return;
      }
      if (problem.kind === 'ceiling-raised') {
        lines.push('- CEILING RAISED maxLines ' + problem.entry.maxLines + ' > committed ' + problem.from + '  ' + problem.row.path);
        lines.push('  This entry is frozen (no "allowRaise": true), so its maxLines may only fall. Split the file, or set "allowRaise": true to record a reviewed exception.');
        return;
      }
      if (problem.kind === 'growth-exceeded') {
        lines.push('- GREW TOO FAST +' + problem.delta + ' lines this commit (HEAD ' + problem.from + ' -> ' + problem.row.lines + ')  ' + problem.row.path);
        if (problem.staleExemption) {
          lines.push('  Its growthExemption is unchanged since HEAD (stale). Each oversized growth needs a fresh approval: rewrite the exemption reason with a new date in this same commit.');
        } else {
          lines.push('  A single commit may add at most ' + MAX_SINGLE_COMMIT_GROWTH + ' lines to an already-large file. Move the bulk into a focused/sibling module instead of growing this one.');
        }
        return;
      }
      if (problem.kind === 'exemption-not-blocked') {
        lines.push('- EXEMPTION NOT ELIGIBLE growthExemption on ' + problem.row.path);
        lines.push('  growthExemption applies only to files ARCHITECTURE.md registers as extraction-BLOCKED. Split the file instead, or remove the exemption.');
        return;
      }
      lines.push('- OVER BUDGET ' + problem.row.lines + ' lines > maxLines ' + problem.entry.maxLines + '  ' + problem.row.path);
    });
  }

  const changed = (growths || []).filter((growth) => growth.delta !== 0).sort((a, b) => b.delta - a.delta);
  if (changed.length) {
    lines.push('');
    lines.push('Advisory - large-file size change since HEAD (not enforced):');
    changed.forEach((growth) => {
      lines.push('  ' + (growth.delta > 0 ? '+' : '') + growth.delta + '  ' + growth.path + ' (' + growth.head + ' -> ' + growth.current + ')' + (growth.exempted ? '  [growth exemption]' : ''));
    });
  }
  return lines.join('\n') + '\n';
}

function displayPath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/') || filePath;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
    return;
  }

  const rows = collectRows();

  if (args.printBudgetTemplate) {
    process.stdout.write(JSON.stringify(budgetTemplate(rows), null, 2) + '\n');
    return;
  }

  process.stdout.write(formatReport(rows));

  if (!args.enforceBudget) {
    return;
  }

  let budget;
  try {
    budget = loadBudget(args.budgetFile);
  } catch (error) {
    process.stderr.write('\nBudget enforcement:\nFAIL ' + error.message + '\n');
    process.exitCode = 1;
    return;
  }

  const committed = committedBudgetEntries(relative(args.budgetFile));
  const headLines = collectHeadLineCounts(rows);
  const blockedPaths = extractionBlockedPaths();
  const exemptionState = growthExemptionState(budget, committed, blockedPaths);
  const gate = evaluateGrowth(rows, headLines, MAX_SINGLE_COMMIT_GROWTH, exemptionState);
  const problems = evaluateBudget(rows, budget)
    .concat(evaluateNoRaise(budget, committed))
    .concat(evaluateExemptionPlacement(budget, blockedPaths))
    .concat(gate.problems);
  process.stdout.write('\n' + formatBudgetResult(problems, args.budgetFile, gate.growths));
  if (problems.length) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  collectRows,
  classify,
  evaluateBudget,
  evaluateNoRaise,
  evaluateGrowth,
  collectHeadLineCounts,
  loadBudget,
  parseExtractionBlockedPaths,
  evaluateExemptionPlacement,
  growthExemptionState,
  MAX_SINGLE_COMMIT_GROWTH
};
