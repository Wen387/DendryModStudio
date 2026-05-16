#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_MAP_ROOT = path.join(ROOT, 'tools', 'project_map');
const DEFAULT_BUDGET_FILE = path.join(PROJECT_MAP_ROOT, 'llm_friendliness_budget.json');

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
    'LLM friendliness report for tools/project_map',
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

function formatBudgetResult(problems, budgetFile) {
  const lines = ['Budget enforcement:'];
  if (!problems.length) {
    lines.push('PASS ' + displayPath(budgetFile) + ': no new exception-sized files and no baseline growth.');
    return lines.join('\n') + '\n';
  }

  lines.push('FAIL ' + displayPath(budgetFile));
  problems.forEach((problem) => {
    if (problem.kind === 'new-exception') {
      lines.push('- NEW EXCEPTION ' + problem.row.lines + ' lines  ' + problem.row.path);
      if (problem.row.hint) {
        lines.push('  ' + problem.row.hint);
      }
      return;
    }
    lines.push('- OVER BUDGET ' + problem.row.lines + ' lines > maxLines ' + problem.entry.maxLines + '  ' + problem.row.path);
  });
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

  const problems = evaluateBudget(rows, budget);
  process.stdout.write('\n' + formatBudgetResult(problems, args.budgetFile));
  if (problems.length) {
    process.exitCode = 1;
  }
}

main();
