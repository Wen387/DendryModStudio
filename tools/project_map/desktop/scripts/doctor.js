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

function defaultRoot(options) {
  const desktopDir = path.resolve((options && options.desktopDir) || path.resolve(__dirname, '..'));
  const repoRoot = path.resolve(desktopDir, '..', '..', '..');
  const paths = core.resolveResourcePaths({desktopDir});
  return fs.existsSync(path.join(repoRoot, 'source', 'info.dry')) ? repoRoot : paths.starterDemoTemplate;
}

function printText(result) {
  const rows = [
    ['App files', result.checks.resources],
    ['Scratch folder', result.checks.scratch],
    ['Python runtime', result.checks.python],
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
  const desktopDir = path.resolve(__dirname, '..');
  const result = await core.runDesktopDoctor({
    root: args.root || defaultRoot({desktopDir}),
    outDir: args.outDir,
    python: args.python,
    desktopDir
  });
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printText(result);
  }
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  defaultRoot,
  main
};
