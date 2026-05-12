#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const newsDraft = require('./authoring/news_draft.js');

function usage() {
  return [
    'Usage: node tools/project_map/generate_news.js --draft <draft.json> --index <project-index.json> --out-dir <dir> [--summary]',
    '',
    'Generates an export-only news snippet bundle. It never writes source files or applies patches.'
  ].join('\n');
}

function fail(message, code = 1) {
  process.stderr.write('ERROR: ' + message + '\n');
  process.exit(code);
}

function parseArgs(argv) {
  const args = {summary: false};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(usage() + '\n');
      process.exit(0);
    }
    if (arg === '--summary') {
      args.summary = true;
      continue;
    }
    if (['--draft', '--index', '--out-dir'].includes(arg)) {
      if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) {
        fail(arg + ' requires a value', 2);
      }
      args[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[index + 1];
      index += 1;
      continue;
    }
    fail('Unknown argument: ' + arg, 2);
  }
  if (!args.draft || !args.index || !args.outDir) {
    fail('Missing required --draft, --index, or --out-dir.\n\n' + usage(), 2);
  }
  return args;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    fail('Could not read JSON from ' + filePath + ': ' + err.message);
  }
}

function isPathInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function assertSafeOutDir(outDir, projectIndex) {
  const resolved = path.resolve(outDir);
  const root = projectIndex && projectIndex.project && projectIndex.project.root
    ? path.resolve(projectIndex.project.root)
    : null;

  if (!root) {
    fail('ProjectIndex must include project.root so export-only path guards can run.', 2);
  }
  if (isPathInside(resolved, root)) {
    fail('Refusing to write news export bundle inside the project repo; use a /tmp export directory.', 2);
  }
  [
    path.join(root, 'source'),
    path.join(root, 'out'),
    path.join(root, 'tools', 'project_map', 'viewer')
  ].forEach((dir) => {
    if (isPathInside(resolved, dir)) {
      fail('Refusing to write news export bundle under protected path: ' + path.relative(root, resolved), 2);
    }
  });
  return resolved;
}

function assertSafeRealOutDir(realOutDir, root) {
  if (isPathInside(realOutDir, root)) {
    fail('Refusing to write news export bundle inside the project repo real path; use a /tmp export directory.', 2);
  }
  [
    path.join(root, 'source'),
    path.join(root, 'out'),
    path.join(root, 'tools', 'project_map', 'viewer')
  ].forEach((dir) => {
    if (isPathInside(realOutDir, dir)) {
      fail('Refusing to write news export bundle under protected real path: ' + path.relative(root, realOutDir), 2);
    }
  });
}

function writeBundle(bundle, outDir, projectIndex) {
  fs.mkdirSync(outDir, {recursive: true});
  const resolvedOut = fs.realpathSync(outDir);
  const root = path.resolve(projectIndex.project.root);
  assertSafeRealOutDir(resolvedOut, root);
  bundle.files.forEach((file) => {
    const target = path.resolve(resolvedOut, file.path);
    if (!isPathInside(target, resolvedOut)) {
      fail('Refusing to write a bundle file outside out-dir: ' + file.path, 2);
    }
    fs.writeFileSync(target, file.content, 'utf8');
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const draft = readJson(args.draft);
  const index = readJson(args.index);
  const outDir = assertSafeOutDir(args.outDir, index);
  const bundle = newsDraft.buildExportBundle(draft, index);
  const errors = bundle.diagnostics.filter((diag) => diag.severity === 'error');
  if (errors.length > 0) {
    process.stderr.write(JSON.stringify({
      ok: false,
      diagnostics: bundle.diagnostics
    }, null, 2) + '\n');
    return 1;
  }
  writeBundle(bundle, outDir, index);
  if (args.summary) {
    process.stdout.write(JSON.stringify({
      ok: true,
      outDir,
      files: bundle.files.map((file) => file.path),
      diagnostics: bundle.diagnostics
    }, null, 2) + '\n');
  }
  return 0;
}

process.exitCode = main();
