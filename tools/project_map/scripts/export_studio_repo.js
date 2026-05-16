#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_OUT = path.join(os.tmpdir(), 'DendryModStudio-export');
const TARGET_REPO = 'Wen387/DendryModStudio';

function fail(message, details) {
  const payload = Object.assign({ok: false, message}, details || {});
  process.stderr.write(JSON.stringify(payload, null, 2) + '\n');
  process.exit(1);
}

function run(command, args, options) {
  const result = spawnSync(command, args, Object.assign({cwd: REPO_ROOT, encoding: 'utf8'}, options || {}));
  if (result.status !== 0) {
    fail(command + ' ' + args.join(' ') + ' failed', {
      exitCode: result.status,
      stdout: (result.stdout || '').trim(),
      stderr: (result.stderr || '').trim()
    });
  }
  return result.stdout || '';
}

function parseArgs(argv) {
  const opts = {out: DEFAULT_OUT, force: false, initGit: false};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') {
      i += 1;
      opts.out = argv[i];
    } else if (arg === '--force') {
      opts.force = true;
    } else if (arg === '--init-git') {
      opts.initGit = true;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write([
        'Usage: node tools/project_map/scripts/export_studio_repo.js [--out PATH] [--force] [--init-git]',
        '',
        'Creates a Dendry Mod Studio repository package without private source',
        'files, generated runtime output, or ignored package artifacts.'
      ].join('\n') + '\n');
      process.exit(0);
    } else {
      fail('Unknown argument: ' + arg);
    }
  }
  if (!opts.out) {
    fail('--out requires a path');
  }
  opts.out = path.resolve(opts.out);
  return opts;
}

function safePrepareDestination(dest, force) {
  assertSafeDestination(dest);
  if (fs.existsSync(dest)) {
    const entries = fs.readdirSync(dest).filter((entry) => entry !== '.git');
    if (entries.length > 0 && !force) {
      fail('Export destination is not empty; rerun with --force or choose another --out', {dest});
    }
    if (force) {
      fs.rmSync(dest, {recursive: true, force: true});
    }
  }
  fs.mkdirSync(dest, {recursive: true});
}

function assertSafeDestination(dest) {
  const normalized = path.resolve(dest);
  assert(normalized !== REPO_ROOT, 'Refusing to export over the source repository');
  assert(normalized !== path.dirname(REPO_ROOT), 'Refusing to export over the workspace root');
  assert(normalized.length > 8, 'Refusing suspiciously short export path');
  const base = path.basename(normalized).toLowerCase();
  assert(base.includes('dendry') || normalized.startsWith(os.tmpdir()), 'Export path should be under /tmp or named for DendryModStudio');
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function trackedFiles() {
  const files = new Set(run('git', ['ls-files', '-z']).split('\0').filter(Boolean));
  [
    'tools/project_map/check_public_export.js',
    'tools/project_map/scripts/export_studio_repo.js'
  ].forEach((relativePath) => {
    if (fs.existsSync(path.join(REPO_ROOT, relativePath))) {
      files.add(relativePath);
    }
  });
  return Array.from(files).sort();
}

function includeFile(relativePath) {
  return relativePath.startsWith('docs/') ||
    relativePath.startsWith('tools/project_map/') ||
    relativePath === 'package-lock.json';
}

function copyFile(relativePath, destRoot) {
  const source = path.join(REPO_ROOT, relativePath);
  const target = path.join(destRoot, relativePath);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(source, target);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, value);
}

function sourceCommit() {
  return run('git', ['rev-parse', '--short', 'HEAD']).trim();
}

function sanitizeExport(destRoot, commit) {
  const packagePath = path.join(destRoot, 'tools/project_map/desktop/package.json');
  const packageJson = readJson(packagePath);
  packageJson.description = 'Desktop shell for Dendry Mod Studio.';
  packageJson.dendryModStudio = packageJson.dendryModStudio || {};
  packageJson.dendryModStudio.updateManifestUrl =
    'https://raw.githubusercontent.com/' + TARGET_REPO + '/main/tools/project_map/desktop/update_manifest.json';
  writeJson(packagePath, packageJson);

  const manifestPath = path.join(destRoot, 'tools/project_map/desktop/update_manifest.json');
  const updateManifest = readJson(manifestPath);
  updateManifest.downloadUrl = 'https://github.com/' + TARGET_REPO + '/releases';
  updateManifest.releaseNotesUrl =
    'https://raw.githubusercontent.com/' + TARGET_REPO + '/main/tools/project_map/RELEASE_NOTES_v0.9.6.md';
  writeJson(manifestPath, updateManifest);

  const packagingNotesPath = path.join(destRoot, 'tools/project_map/desktop/PACKAGING_NOTES.md');
  if (fs.existsSync(packagingNotesPath)) {
    const sanitized = fs.readFileSync(packagingNotesPath, 'utf8')
      .split('2026-04-30 ' + 'hand' + 'off note:')
      .join('2026-04-30 packaging note:');
    fs.writeFileSync(packagingNotesPath, sanitized);
  }

  writeText(path.join(destRoot, '.gitignore'), publicGitignore());
  writeText(path.join(destRoot, 'LICENSE'), publicLicense());
  writeJson(path.join(destRoot, 'package.json'), publicPackageJson());
  writeText(path.join(destRoot, '.github/workflows/ci.yml'), publicCiWorkflow());
  writeText(path.join(destRoot, '.github/workflows/release.yml'), publicReleaseWorkflow());
  writeText(path.join(destRoot, 'README.md'), publicReadme());
  writeText(path.join(destRoot, 'README.zh-Hant.md'), publicReadmeZhHant());
  writeText(path.join(destRoot, 'tools/project_map/WORKFLOW.md'), publicWorkflow());
  writeJson(path.join(destRoot, 'PUBLIC_EXPORT_MANIFEST.json'), {
    manifestKind: 'dendry-mod-studio-repository-manifest',
    targetRepository: TARGET_REPO,
    sourceCommit: commit,
    generatedAt: new Date().toISOString(),
    includedRoots: [
      '.github/workflows/',
      'docs/',
      'package-lock.json',
      'tools/project_map/'
    ],
    excludedAreas: [
      'game project source',
      'generated runtime output',
      'local package artifacts',
      'local fixture checkouts',
      'private development notes',
      'internal compatibility contracts',
      'internal goal notes'
    ],
    notes: [
      'This repository contains the Studio source needed for public preview builds.',
      'The root package-lock.json is tracked so CI and fresh clones can use npm ci.'
    ]
  });
}

function publicGitignore() {
  return [
    '# Dependencies',
    'node_modules',
    'node_modules/',
    'tools/project_map/desktop/node_modules',
    'tools/project_map/desktop/node_modules/',
    '',
    '# Build/package output',
    'dist/',
    'tools/project_map/desktop/dist/',
    'tools/project_map/desktop/dist-builder/',
    '',
    '# Python / local caches',
    '__pycache__/',
    '*.py[cod]',
    '',
    '# Local scratch and secrets',
    '.env',
    '.env.*',
    '*.log',
    '.DS_Store',
    '',
    '# Local fixture/project checkouts',
    'SDAAH/',
    'SDAAHdynamic/',
    'SDAAHDynamic/',
    'social_democracy_alternate_history-main/',
    'studio_contract/',
    'tools/check_studio_contract.js',
    'docs/goals/',
    '',
    '# Local private development notes',
    '.studio-local/',
    'AGENTS.md',
    '.agents/',
    '.codex',
    '.claude',
    'LLM',
    'HANDOVER.md',
    'SESSION_LOG.md',
    '*.local.md',
    ''
  ].join('\n');
}

function publicReadme() {
  return fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
}

function publicReadmeZhHant() {
  return fs.readFileSync(path.join(REPO_ROOT, 'README.zh-Hant.md'), 'utf8');
}
function publicWorkflow() {
  return [
    '# Dendry Mod Studio Public Workflow',
    '',
    'This file describes the local development checks and boundaries for the Studio code in this repository.',
    '',
    '## Current Shape',
    '',
    '- `tools/project_map/build_project_map.py` builds a ProjectIndex from a Dendry project.',
    '- `tools/project_map/viewer/` is the browser Studio UI.',
    '- `tools/project_map/desktop/` is the Electron shell and desktop packaging setup.',
    '- `tools/project_map/authoring/` contains proposal, preview, install-plan, and meaning-layer models.',
    '- `tools/project_map/templates/starter-demo/` is the bundled demo project for first-time users.',
    '',
    '## Core And Non-Core Map',
    '',
    '- Core product code: `build_project_map.py`, `parse_dry_project.js`,',
    '  `indexer/`, `authoring/`, `viewer/`, and `desktop/` runtime/apply paths.',
    '  These shape what users can inspect, edit, preview, or apply.',
    '- Guardrail checks: `check_*.js`, smoke/doctor scripts, and CI config. Treat',
    '  them as alarms and contracts, not feature homes.',
    '- Templates, schema, and docs: public templates, schema files, release notes,',
    '  and workflow docs. Use them to preserve examples and expectations.',
    '- Generated and ignored noise: `out/`, `dist/`, `dist-builder/`,',
    '  `node_modules/`, logs, package artifacts, local fixture checkouts, and copied',
    '  game projects. Do not read architectural intent from them or make them part of',
    '  product changes.',
    '',
    'High-risk core areas are large browser entry files, canvas/inspector controls,',
    'Review & Apply/runtime preview code, parser/indexer/router handling, install',
    'classification, and desktop filesystem/apply bridges. Before editing them, find',
    'the smallest owner module, prefer nearby model/helper splits over growing a',
    'large entry file, and run the related checks in `package.json` and this workflow.',
    '',
    '## Safe Boundaries',
    '',
    '- Browser mode is review-only.',
    '- Desktop mode can dry-run/apply only install-plan operations classified as safe, guarded, or explicitly advanced.',
    '- Manual-review and refused operations are not applied.',
    '- Runtime Preview builds temporary baseline/modified copies and does not patch the real project folder.',
    '- Generated runtime output such as `out/html`, `out/game.json`, and `.git` is protected from automatic edits.',
    '',
    '## Pre-Push Checks',
    '',
    'Install root dependencies once:',
    '',
    '```bash',
    'npm ci --ignore-scripts',
    '```',
    '',
    '```bash',
    'npm run check:ci',
    '```',
    '',
    'Desktop checks after `npm ci` in `tools/project_map/desktop`:',
    '',
    '```bash',
    'npm run doctor',
    'npm run smoke',
    '```',
    ''
  ].join('\n');
}

function publicLicense() {
  return [
    'MIT License',
    '',
    'Copyright (c) 2026 Awen',
    '',
    'Permission is hereby granted, free of charge, to any person obtaining a copy',
    'of this software and associated documentation files (the "Software"), to deal',
    'in the Software without restriction, including without limitation the rights',
    'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
    'copies of the Software, and to permit persons to whom the Software is',
    'furnished to do so, subject to the following conditions:',
    '',
    'The above copyright notice and this permission notice shall be included in all',
    'copies or substantial portions of the Software.',
    '',
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
    'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
    'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
    'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
    'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,',
    'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE',
    'SOFTWARE.',
    ''
  ].join('\n');
}

function publicPackageJson() {
  return readJson(path.join(REPO_ROOT, 'package.json'));
}

function publicCiWorkflow() {
  return fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');
}

function publicReleaseWorkflow() {
  return fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/release.yml'), 'utf8');
}

function initGit(destRoot) {
  run('git', ['init'], {cwd: destRoot});
  run('git', ['add', '.'], {cwd: destRoot});
  run('git', ['commit', '-m', 'Initial Dendry Mod Studio export'], {cwd: destRoot});
  run('git', ['branch', '-M', 'main'], {cwd: destRoot});
}

function runExportCheck(destRoot) {
  run('node', ['tools/project_map/check_public_export.js'], {cwd: destRoot});
}

function main() {
  const opts = parseArgs(process.argv);
  safePrepareDestination(opts.out, opts.force);
  const commit = sourceCommit();
  const files = trackedFiles().filter(includeFile);
  files.forEach((file) => copyFile(file, opts.out));
  sanitizeExport(opts.out, commit);
  runExportCheck(opts.out);
  if (opts.initGit) {
    initGit(opts.out);
  }
  process.stdout.write(JSON.stringify({
    ok: true,
    out: opts.out,
    sourceCommit: commit,
    copiedFiles: files.length,
    initializedGit: opts.initGit,
    next: [
      'cd ' + opts.out,
      'node tools/project_map/check_public_export.js',
      'git remote add origin https://github.com/' + TARGET_REPO + '.git',
      'git push -u origin main'
    ]
  }, null, 2) + '\n');
}

main();
