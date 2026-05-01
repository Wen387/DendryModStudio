#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const PROJECT_MAP_DIR = __dirname;
const DESKTOP_DIR = path.join(PROJECT_MAP_DIR, 'desktop');
const PACKAGE_JSON = path.join(DESKTOP_DIR, 'package.json');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const pkg = readJson(PACKAGE_JSON);
  assert(/^\d+\.\d+\.\d+$/.test(pkg.version || ''), 'desktop package version should be semver-like');
  assert(pkg.scripts && pkg.scripts['package:portable'], 'desktop package should expose npm run package:portable');
  assert(pkg.scripts && pkg.scripts['dist:linux'], 'desktop package should expose npm run dist:linux');
  assert(pkg.scripts && pkg.scripts['dist:win'], 'desktop package should expose npm run dist:win');
  assert(pkg.scripts['dist:linux'].includes('deb'), 'desktop Linux release build should include Deb');
  assert(pkg.homepage && /github\.com\/Wen387\/DendryModStudio/.test(pkg.homepage), 'desktop package should define a release homepage');
  assert(pkg.author && pkg.author.email, 'desktop package should define maintainer email for Deb builds');
  assert(pkg.devDependencies && pkg.devDependencies['electron-builder'], 'desktop package should depend on electron-builder for release builds');
  assert(pkg.build && pkg.build.asar === false, 'desktop builder config should keep asar disabled for filesystem resources');
  assert(
    pkg.build.linux && Array.isArray(pkg.build.linux.target) && pkg.build.linux.target.includes('deb'),
    'desktop builder Linux config should include Deb target'
  );
  assert(pkg.build.linux && pkg.build.linux.maintainer, 'desktop Linux config should define Deb maintainer');
  assert(pkg.build.deb && Array.isArray(pkg.build.deb.depends), 'desktop Deb config should declare runtime dependencies');
  assert(fs.existsSync(path.join(DESKTOP_DIR, 'scripts', 'package_portable.js')), 'package_portable.js should exist');
  assert(fs.existsSync(path.join(DESKTOP_DIR, 'PACKAGING_NOTES.md')), 'PACKAGING_NOTES.md should exist');

  const notes = fs.readFileSync(path.join(DESKTOP_DIR, 'PACKAGING_NOTES.md'), 'utf8');
  assert(notes.includes(`v${pkg.version}`), `packaging notes should mention v${pkg.version}`);
  assert(notes.includes('system Python 3'), 'packaging notes should state Python remains a system dependency');
  assert(notes.includes('.deb'), 'packaging notes should discuss .deb boundary');
  assert(notes.includes('AppImage'), 'packaging notes should discuss AppImage boundary');
  assert(notes.includes('Windows'), 'packaging notes should discuss Windows artifact boundary');
  assert(notes.includes('portable'), 'packaging notes should discuss portable package boundary');

  const run = spawnSync('npm', ['run', 'package:portable'], {
    cwd: DESKTOP_DIR,
    encoding: 'utf8'
  });
  assert(run.status === 0, 'npm run package:portable should pass: ' + run.stderr);
  const archivePath = path.join(DESKTOP_DIR, 'dist', 'DendryModStudio-linux-x64.tar.gz');
  const appRoot = path.join(DESKTOP_DIR, 'dist', 'DendryModStudio-linux-x64', 'resources', 'app');
  const manifestPath = path.join(DESKTOP_DIR, 'dist', 'DendryModStudio-linux-x64', 'portable-manifest.json');
  assert(archivePath.endsWith('.tar.gz'), 'portable package should produce a .tar.gz archive');
  assert(fs.existsSync(archivePath), 'portable archive should exist');
  assert(fs.existsSync(manifestPath), 'portable manifest should exist');
  assert(fs.existsSync(path.join(appRoot, 'scripts', 'doctor.js')), 'packaged app should include doctor script');
  assert(fs.existsSync(path.join(appRoot, 'runtime_preview.js')), 'packaged app should include Runtime Preview core');
  assert(fs.existsSync(path.join(appRoot, 'update_notice.js')), 'packaged app should include Update Notice core');
  assert(fs.existsSync(path.join(appRoot, 'update_manifest.json')), 'packaged app should include bundled Update Notice manifest');
  assert(
    fs.existsSync(path.join(appRoot, 'project_map', 'templates', 'starter-demo', 'source', 'info.dry')),
    'packaged app should include bundled starter demo template'
  );
  assert(
    fs.existsSync(path.join(appRoot, 'project_map', 'templates', 'starter-demo', 'package.json')),
    'packaged app should include bundled starter demo package.json for Runtime Preview builds'
  );
  assert(
    fs.existsSync(path.join(appRoot, 'node_modules', 'dendrynexus', 'lib', 'cli', 'main.js')),
    'packaged app should include bundled DendryNexus CLI for Runtime Preview builds'
  );
  assert(
    fs.existsSync(path.join(appRoot, 'runtime_preview_debug_bridge.js')),
    'packaged app should include Runtime Preview debug bridge'
  );
  const manifest = readJson(manifestPath);
  assert(manifest.version === pkg.version, 'portable manifest version should match package.json');
  assert(manifest.checks && manifest.checks.resources && manifest.checks.resources.ok, 'packaged resource check should pass');
  assert(manifest.checks && manifest.checks.python, 'packaged Python check should be present');
  assert(
    manifest.checks.python.ok || manifest.checks.python.code === 'python_missing',
    'packaged Python check should pass or report friendly python_missing'
  );
  assert(manifest.checks && manifest.checks.scratch && manifest.checks.scratch.ok, 'packaged scratch check should pass');
  assert(!manifest.checks.projectRoot || !manifest.checks.projectRoot.ok, 'portable package doctor should not require a bundled project root');

  console.log(JSON.stringify({
    ok: true,
    archivePath,
    manifestPath,
    executable: manifest.executable
  }, null, 2));
}

main();
