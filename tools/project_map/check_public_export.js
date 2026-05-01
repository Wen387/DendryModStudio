#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

function fail(message, details) {
  const payload = Object.assign({ok: false, message}, details || {});
  process.stderr.write(JSON.stringify(payload, null, 2) + '\n');
  process.exit(1);
}

function assert(condition, message, details) {
  if (!condition) {
    fail(message, details);
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function listFilesRecursive(dir, prefix) {
  const files = [];
  fs.readdirSync(dir, {withFileTypes: true}).forEach((entry) => {
    if (entry.name === '.git') {
      return;
    }
    const rel = prefix ? prefix + '/' + entry.name : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(full, rel));
    } else if (entry.isFile()) {
      files.push(rel);
    }
  });
  return files;
}

function listFiles() {
  const result = spawnSync('git', ['ls-files'], {cwd: ROOT, encoding: 'utf8'});
  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.split(/\r?\n/).filter(Boolean).sort();
  }
  return listFilesRecursive(ROOT, '').sort();
}

function isTextFile(relativePath) {
  const ext = path.extname(relativePath).toLowerCase();
  return [
    '.css',
    '.dry',
    '.html',
    '.js',
    '.json',
    '.md',
    '.py',
    '.svg',
    '.txt',
    '.yml',
    '.yaml'
  ].includes(ext) || relativePath === '.gitignore';
}

function main() {
  const files = listFiles();
  const disallowedPrefixes = [
    '.claude/',
    'LLM/',
    'history/',
    'docs/superpowers/',
    'social_democracy_alternate_history-main/',
    'out/',
    'source/'
  ];
  const disallowedExact = new Set([
    'HANDOVER.md',
    'INVARIANTS.md',
    'KNOWN_ISSUES.md',
    'SESSION_LOG.md',
    'tools/project_map/check_studio_handoff.js',
    'tools/project_map/check_studio_release_readiness.js'
  ]);
  const disallowedPathFragments = [
    '/__pycache__/',
    '/node_modules/',
    '/LLM/',
    '/desktop/dist/',
    '/.env'
  ];

  const pathViolations = files.filter((file) => {
    return disallowedExact.has(file) ||
      disallowedPrefixes.some((prefix) => file.startsWith(prefix)) ||
      disallowedPathFragments.some((fragment) => ('/' + file).includes(fragment));
  });
  assert(pathViolations.length === 0, 'repository package contains disallowed private or generated paths', {pathViolations});

  [
    'README.md',
    '.gitignore',
    '.github/workflows/ci.yml',
    '.github/workflows/release.yml',
    'LICENSE',
    'package.json',
    'package-lock.json',
    'README.zh-Hant.md',
    'PUBLIC_EXPORT_MANIFEST.json',
    'docs/releases/v0.9.2-dev-preview.md',
    'tools/project_map/README.md',
    'tools/project_map/WORKFLOW.md',
    'tools/project_map/check_public_export.js',
    'tools/project_map/viewer/index.html',
    'tools/project_map/desktop/package.json',
    'tools/project_map/desktop/update_manifest.json',
    'tools/project_map/templates/starter-demo/source/info.dry',
    'studio_contract/contract.json',
    'studio_contract/parser_fixture/source/info.dry',
    'tools/check_studio_contract.js'
  ].forEach((requiredPath) => {
    assert(exists(requiredPath), 'repository package missing required file: ' + requiredPath);
  });

  const packageJson = JSON.parse(read('tools/project_map/desktop/package.json'));
  const rootPackageJson = JSON.parse(read('package.json'));
  const ciWorkflow = read('.github/workflows/ci.yml');
  const releaseWorkflow = read('.github/workflows/release.yml');
  const updateManifest = JSON.parse(read('tools/project_map/desktop/update_manifest.json'));
  assert(rootPackageJson.name === 'dendry-mod-studio', 'root package.json should identify Dendry Mod Studio');
  assert(rootPackageJson.dependencies && rootPackageJson.dependencies.dendrynexus, 'root package.json should declare dendrynexus dependency');
  assert(rootPackageJson.scripts && rootPackageJson.scripts['check:ci'], 'root package.json should define check:ci');
  assert(ciWorkflow.includes('npm ci --ignore-scripts'), 'CI workflow should use npm ci with the committed lockfile');
  assert(releaseWorkflow.includes('dist:linux') && releaseWorkflow.includes('dist:win'), 'release workflow should build Linux and Windows desktop artifacts');
  assert(releaseWorkflow.includes('*.deb'), 'release workflow should upload Linux Deb artifacts');
  assert(releaseWorkflow.includes('publish_release') && releaseWorkflow.includes('actions/download-artifact@v4'), 'release workflow should support manual GitHub Release publishing');
  assert(packageJson.scripts && packageJson.scripts['dist:linux'] && packageJson.scripts['dist:win'], 'desktop package should expose release build scripts');
  assert(packageJson.scripts['dist:linux'].includes('deb'), 'desktop Linux release script should build Deb artifacts');
  assert(packageJson.devDependencies && packageJson.devDependencies['electron-builder'], 'desktop package should declare electron-builder for release builds');
  [
    'check_public_export.js',
    'check_studio_contract.js --fixture-only',
    'check_localization_surface.js',
    'check_studio_surface.js',
    'check_update_notice_model.js',
    'check_starter_demo_model.js',
    'check_player_like_qa_model.js'
  ].forEach((needle) => {
    assert(rootPackageJson.scripts['check:ci'].includes(needle), 'check:ci should run ' + needle);
    assert(ciWorkflow.includes(needle) || ciWorkflow.includes('npm run check:ci'), 'CI workflow should cover ' + needle);
  });
  assert(
    /Wen387\/DendryModStudio/.test(packageJson.dendryModStudio.updateManifestUrl || ''),
    'desktop update manifest URL should point at DendryModStudio'
  );
  assert(
    /Wen387\/DendryModStudio/.test(updateManifest.downloadUrl || '') &&
      /Wen387\/DendryModStudio/.test(updateManifest.releaseNotesUrl || ''),
    'update manifest links should point at DendryModStudio'
  );

  const docsToScan = files.filter((file) => /\.(md|json)$/.test(file) || file === '.gitignore');
  const docDeny = [
    {label: 'old game repo URL', regex: /Wen387\/Game3_IslandsSunrise/},
    {label: 'local LLM memory path', regex: /LLM\/README|\.claude|本地記憶|local memory/i},
    {label: 'private workflow archive', regex: /docs\/superpowers|SESSION_LOG_archive|history\/museum/},
    {label: 'tool-session transcript wording', regex: /Codex tool session|Claude Code memory/i},
    {label: 'private handoff check reference', regex: /check_studio_handoff|check_studio_release_readiness|session handover/i},
    {label: 'public-facing LLM workflow wording', regex: /LLM 友善化/i}
  ];
  const docViolations = [];
  docsToScan.forEach((file) => {
    const text = read(file);
    docDeny.forEach((rule) => {
      if (rule.regex.test(text)) {
        docViolations.push({file, rule: rule.label});
      }
    });
  });
  assert(docViolations.length === 0, 'public docs contain private-source references', {docViolations});

  const secretDeny = [
    {label: 'private key', regex: /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/},
    {label: 'GitHub token', regex: /\b(?:ghp|github_pat|gho|ghu|ghs)_[A-Za-z0-9_]{20,}\b/},
    {label: 'generic assignment secret', regex: /\b(?:api[_-]?key|secret|password|credential)\s*[:=]\s*['"][^'"]{12,}['"]/i}
  ];
  const secretViolations = [];
  files.filter(isTextFile).forEach((file) => {
    const text = read(file);
    secretDeny.forEach((rule) => {
      if (rule.regex.test(text)) {
        secretViolations.push({file, rule: rule.label});
      }
    });
  });
  assert(secretViolations.length === 0, 'repository package contains potential secrets', {secretViolations});

  const manifest = JSON.parse(read('PUBLIC_EXPORT_MANIFEST.json'));
  assert(manifest && manifest.manifestKind === 'dendry-mod-studio-repository-manifest', 'PUBLIC_EXPORT_MANIFEST.json should identify repository manifest kind');
  assert(Array.isArray(manifest.excludedAreas), 'PUBLIC_EXPORT_MANIFEST.json should record excluded areas');

  process.stdout.write(JSON.stringify({
    ok: true,
    fileCount: files.length,
    gate: 'repository-package'
  }, null, 2) + '\n');
}

main();
