#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const desktopDir = path.resolve(__dirname, '..');

const DEFAULT_TARGETS = [
  ['viewer', '../viewer'],
  ['authoring', '../authoring'],
  ['profiles', '../profiles'],
  ['schema', '../schema'],
  ['templates', '../templates'],
  ['indexer', '../indexer'],
  ['runtime', 'runtime'],
  ['root node_modules', '../../../node_modules'],
  ['desktop scripts', 'scripts']
];

function parseArgs(argv) {
  const args = {json: false, paths: []};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--path') {
      args.paths.push(argv[i + 1]);
      i += 1;
      continue;
    }
    args.paths.push(arg);
  }
  return args;
}

function shouldSkip(entryPath) {
  const name = path.basename(entryPath);
  return name === '.git' || name === '__pycache__';
}

function walk(root) {
  const summary = {
    root,
    exists: fs.existsSync(root),
    files: 0,
    directories: 0,
    bytes: 0
  };
  if (!summary.exists) {
    return summary;
  }
  function visit(entryPath) {
    if (shouldSkip(entryPath)) {
      return;
    }
    const stats = fs.lstatSync(entryPath);
    if (stats.isDirectory()) {
      summary.directories += 1;
      fs.readdirSync(entryPath)
        .sort()
        .forEach((child) => visit(path.join(entryPath, child)));
      return;
    }
    if (stats.isFile()) {
      summary.files += 1;
      summary.bytes += stats.size;
    }
  }
  visit(root);
  return summary;
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = Number(bytes || 0);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return (unit === 0 ? String(value) : value.toFixed(1)) + ' ' + units[unit];
}

function defaultTargets() {
  return DEFAULT_TARGETS.map(([label, relativePath]) => ({
    label,
    root: path.resolve(desktopDir, relativePath)
  }));
}

function explicitTargets(paths) {
  return paths.map((entry) => {
    const root = path.resolve(process.cwd(), entry);
    return {label: entry, root};
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const targets = args.paths.length ? explicitTargets(args.paths) : defaultTargets();
  const entries = targets.map((target) => ({
    label: target.label,
    ...walk(target.root)
  }));
  const totals = entries.reduce((acc, entry) => {
    acc.files += entry.files;
    acc.directories += entry.directories;
    acc.bytes += entry.bytes;
    return acc;
  }, {files: 0, directories: 0, bytes: 0});
  const result = {
    ok: true,
    generatedAt: new Date().toISOString(),
    entries,
    totals
  };
  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  process.stdout.write('Dendry Mod Studio package payload estimate\n');
  entries.forEach((entry) => {
    const missing = entry.exists ? '' : ' missing';
    process.stdout.write(
      '- ' + entry.label + ': ' +
      entry.files + ' files, ' +
      entry.directories + ' dirs, ' +
      formatBytes(entry.bytes) +
      missing + '\n'
    );
  });
  process.stdout.write(
    'Total: ' +
    totals.files + ' files, ' +
    totals.directories + ' dirs, ' +
    formatBytes(totals.bytes) + '\n'
  );
}

if (require.main === module) {
  main();
}
