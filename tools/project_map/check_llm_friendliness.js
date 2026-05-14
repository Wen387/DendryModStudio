#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_MAP_ROOT = path.join(ROOT, 'tools', 'project_map');

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

function main() {
  const files = [];
  walkFiles(PROJECT_MAP_ROOT, files);
  const rows = files
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

  const summary = summarize(rows);
  const flagged = rows.filter((row) => row.status !== 'ok');

  process.stdout.write('LLM friendliness report for tools/project_map\n');
  process.stdout.write('Files: ' + summary.files + '  Lines: ' + summary.lines + '\n');
  process.stdout.write('OK: ' + summary.ok + '  Warn: ' + summary.warn + '  Exception-sized: ' + summary.exception + '\n\n');

  if (!flagged.length) {
    process.stdout.write('No files exceed advisory thresholds.\n');
    return;
  }

  process.stdout.write('Flagged files:\n');
  flagged.forEach((row) => {
    const marker = row.status === 'exception' ? 'EXCEPTION' : 'WARN';
    process.stdout.write('- ' + marker + ' ' + row.lines + ' lines  ' + row.path + '\n');
    if (row.hint) {
      process.stdout.write('  ' + row.hint + '\n');
    }
  });

  process.stdout.write('\nThresholds:\n');
  Object.keys(THRESHOLDS).sort().forEach((ext) => {
    const threshold = THRESHOLDS[ext];
    process.stdout.write('- ' + ext + ': warn >= ' + threshold.warn + ', exception >= ' + threshold.exception + '\n');
  });
  SPECIAL_THRESHOLDS.forEach((item) => {
    process.stdout.write('- ' + item.note + ': warn >= ' + item.thresholds.warn + ', exception >= ' + item.thresholds.exception + '\n');
  });
}

main();
