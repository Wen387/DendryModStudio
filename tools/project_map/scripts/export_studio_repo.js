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
        'Creates a clean Dendry Mod Studio export without this game repo history,',
        'LLM memory, generated runtime output, or ignored package artifacts.'
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
  return relativePath.startsWith('tools/project_map/') ||
    relativePath.startsWith('studio_contract/') ||
    relativePath === 'tools/check_studio_contract.js';
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
    'https://raw.githubusercontent.com/' + TARGET_REPO + '/main/tools/project_map/RELEASE_NOTES_v0.9.2.md';
  writeJson(manifestPath, updateManifest);

  const profilePath = path.join(destRoot, 'tools/project_map/profiles/islands-sunrise.json');
  const profile = readJson(profilePath);
  profile.detection = profile.detection || {};
  profile.detection.pathHints = [
    {kind: 'projectContract', pattern: 'studio_contract/contract.json', weight: 0.25},
    {kind: 'projectRules', pattern: 'INVARIANTS.md', weight: 0.1},
    {kind: 'sceneRoot', pattern: 'source/scenes/**/*.scene.dry', weight: 0.05}
  ];
  profile.detection.contentHints = (profile.detection.contentHints || [])
    .filter((hint) => !/INV-B001|INV-C002|INV-V001|INV-V002|LLM/.test(String(hint.regex || '')));
  profile.detection.contentHints.push(
    {regex: "islands-sunrise|Island'?s Sunrise|社民黨|太陽花|台灣", weight: 0.25}
  );
  writeJson(profilePath, profile);

  const packagingNotesPath = path.join(destRoot, 'tools/project_map/desktop/PACKAGING_NOTES.md');
  if (fs.existsSync(packagingNotesPath)) {
    const sanitized = fs.readFileSync(packagingNotesPath, 'utf8')
      .replace(/`npm run smoke` attempt timed out in the Codex tool session after 90 seconds/g, '`npm run smoke` previously timed out in one local automation run after 90 seconds');
    fs.writeFileSync(packagingNotesPath, sanitized);
  }

  writeText(path.join(destRoot, '.gitignore'), publicGitignore());
  writeJson(path.join(destRoot, 'package.json'), publicPackageJson());
  writeText(path.join(destRoot, 'README.md'), publicReadme());
  writeText(path.join(destRoot, 'tools/project_map/WORKFLOW.md'), publicWorkflow());
  writeJson(path.join(destRoot, 'PUBLIC_EXPORT_MANIFEST.json'), {
    exportKind: 'dendry-mod-studio-public-export',
    targetRepository: TARGET_REPO,
    sourceCommit: commit,
    generatedAt: new Date().toISOString(),
    includedRoots: [
      'tools/project_map/',
      'studio_contract/',
      'tools/check_studio_contract.js'
    ],
    excludedPrivateRoots: [
      'project-memory',
      'session-and-handover-notes',
      'game-source',
      'generated-runtime-output',
      'historical-work-notes',
      'local-fixture-checkouts'
    ],
    notes: [
      'This export is intended to be committed as a fresh repository history.',
      'Do not push the source game repository history to the Studio repository.'
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
    ''
  ].join('\n');
}

function publicReadme() {
  return [
    '# Dendry Mod Studio',
    '',
    'Dendry Mod Studio is a local authoring and review tool for Dendry / DendryNexus projects. It can scan a project, show Explore and Design views, create proposal-first edits, review install plans, and run desktop-only guarded dry-runs for supported changes.',
    '',
    'This repository is a clean standalone export of the Studio code. It intentionally does not include the IslandSunrise game source, local LLM memory, session logs, generated runtime output, package artifacts, or the previous game repository Git history.',
    '',
    '## Layout',
    '',
    '- `tools/project_map/` contains the Studio viewer, authoring models, desktop shell, schemas, fixtures, QA scenarios, and checks.',
    '- `studio_contract/` contains the current IslandSunrise compatibility contract and parser fixture used by Studio compatibility checks.',
    '- `PUBLIC_EXPORT_MANIFEST.json` records what was included and which private roots were excluded.',
    '',
    '## Local Use',
    '',
    '```bash',
    'python3 tools/project_map/launch_studio.py --no-open',
    '```',
    '',
    'For the desktop shell:',
    '',
    '```bash',
    'cd tools/project_map/desktop',
    'npm install',
    'npm run start',
    '```',
    '',
    '## Public Export Gate',
    '',
    'Install root dependencies before running parser-backed checks:',
    '',
    '```bash',
    'npm install',
    '```',
    '',
    'Before pushing or making this repository public, run:',
    '',
    '```bash',
    'node tools/project_map/check_public_export.js',
    'node tools/check_studio_contract.js --fixture-only',
    'node tools/project_map/check_localization_surface.js',
    'node tools/project_map/check_studio_surface.js',
    'node tools/project_map/check_update_notice_model.js',
    'node tools/project_map/check_starter_demo_model.js',
    'node tools/project_map/check_player_like_qa_model.js',
    'git status --short',
    'git log --oneline --max-count=3',
    '```',
    '',
    'The first public commit should be a fresh initial Studio commit. Do not import the old game repository history.',
    ''
  ].join('\n');
}

function publicWorkflow() {
  return [
    '# Dendry Mod Studio Public Workflow',
    '',
    'This file is the standalone Studio workflow for the public/exported repository. It replaces the game-repo development notes in clean exports.',
    '',
    '## Current Shape',
    '',
    '- `tools/project_map/build_project_map.py` builds a ProjectIndex from a Dendry project.',
    '- `tools/project_map/viewer/` is the browser Studio UI.',
    '- `tools/project_map/desktop/` is the Electron shell and packaging spike.',
    '- `tools/project_map/authoring/` contains proposal, preview, install-plan, and meaning-layer models.',
    '- `tools/project_map/templates/starter-demo/` is the bundled demo project for first-time users.',
    '- `studio_contract/` is the IslandSunrise compatibility contract fixture used to keep Studio parsing stable.',
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
    'Install root dependencies once before parser-backed checks:',
    '',
    '```bash',
    'npm install',
    '```',
    '',
    '```bash',
    'node tools/project_map/check_public_export.js',
    'node tools/check_studio_contract.js --fixture-only',
    'node tools/project_map/check_localization_surface.js',
    'node tools/project_map/check_studio_surface.js',
    'node tools/project_map/check_update_notice_model.js',
    'node tools/project_map/check_starter_demo_model.js',
    'node tools/project_map/check_player_like_qa_model.js',
    '```',
    '',
    'Desktop checks after `npm install` in `tools/project_map/desktop`:',
    '',
    '```bash',
    'npm run doctor',
    'npm run smoke',
    '```',
    ''
  ].join('\n');
}

function publicPackageJson() {
  return {
    name: 'dendry-mod-studio',
    version: '0.9.2',
    private: true,
    description: 'Standalone public export of Dendry Mod Studio.',
    scripts: {
      'check:public': 'node tools/project_map/check_public_export.js',
      'check:contract': 'node tools/check_studio_contract.js --fixture-only',
      'check:surface': 'node tools/project_map/check_studio_surface.js',
      'check:localization': 'node tools/project_map/check_localization_surface.js'
    },
    dependencies: {
      dendrynexus: 'github:aucchen/dendrynexus',
      'parliament-svg': '^3.0.0'
    }
  };
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
