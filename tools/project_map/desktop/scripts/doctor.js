#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const core = require('../studio_core');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      args.root = argv[i + 1];
      i += 1;
    } else if (arg === '--out-dir') {
      args.outDir = argv[i + 1];
      i += 1;
    } else if (arg === '--python') {
      args.python = argv[i + 1];
      i += 1;
    } else if (arg === '--json') {
      args.json = true;
    }
  }
  return args;
}

function defaultRoot() {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const starterDemo = path.resolve(__dirname, '..', '..', 'templates', 'starter-demo');
  return fs.existsSync(path.join(repoRoot, 'source', 'info.dry')) ? repoRoot : starterDemo;
}

function printText(result) {
  const rows = [
    ['App files', result.checks.resources],
    ['Scratch folder', result.checks.scratch],
    ['Python 3', result.checks.python],
    ['Project folder', result.checks.projectRoot]
  ];
  console.log(result.message);
  rows.forEach(([label, check]) => {
    const status = check.ok ? 'OK' : 'Needs attention';
    console.log('- ' + label + ': ' + status + ' - ' + (check.message || check.root || check.path || 'Ready.'));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await core.runDesktopDoctor({
    root: args.root || defaultRoot(),
    outDir: args.outDir,
    python: args.python,
    desktopDir: path.resolve(__dirname, '..')
  });
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printText(result);
  }
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
