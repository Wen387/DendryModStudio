#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const PROJECT_MAP_DIR = __dirname;
const DESKTOP_DIR = path.join(PROJECT_MAP_DIR, 'desktop');

const {fail, assert} = require('./check_harness.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run(command, args, options) {
  const stdoutPath = path.join(os.tmpdir(), 'dendry-deb-smoke-stdout-' + process.pid + '-' + Math.random().toString(36).slice(2));
  const stderrPath = path.join(os.tmpdir(), 'dendry-deb-smoke-stderr-' + process.pid + '-' + Math.random().toString(36).slice(2));
  const stdoutFd = fs.openSync(stdoutPath, 'w');
  const stderrFd = fs.openSync(stderrPath, 'w');
  let result;
  try {
    result = spawnSync(command, args, Object.assign({}, options || {}, {
      encoding: 'utf8',
      stdio: ['ignore', stdoutFd, stderrFd]
    }));
  } finally {
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);
  }
  const stdout = fs.readFileSync(stdoutPath, 'utf8');
  const stderr = fs.readFileSync(stderrPath, 'utf8');
  fs.rmSync(stdoutPath, {force: true});
  fs.rmSync(stderrPath, {force: true});
  assert(result.status === 0, command + ' ' + args.join(' ') + ' failed: ' + (stderr || stdout));
  return Object.assign({}, result, {stdout, stderr});
}

function main() {
  const pkg = readJson(path.join(DESKTOP_DIR, 'package.json'));
  assert(/^\d+\.\d+\.\d+$/.test(pkg.version || ''), 'desktop package version should be semver-like');
  assert(pkg.scripts && pkg.scripts['package:deb'], 'desktop package should expose npm run package:deb');
  assert(pkg.scripts && pkg.scripts['fetch:python'], 'desktop package should expose bundled Python fetch script');
  assert(pkg.build && pkg.build.deb && !pkg.build.deb.depends.includes('python3'), 'release Deb config should not depend on system Python');
  assert(fs.existsSync(path.join(DESKTOP_DIR, 'scripts', 'package_deb.js')), 'package_deb.js should exist');

  const notes = fs.readFileSync(path.join(DESKTOP_DIR, 'PACKAGING_NOTES.md'), 'utf8');
  assert(notes.includes('v' + pkg.version), 'packaging notes should mention current package version');
  assert(notes.includes('bundled Python runtime'), 'packaging notes should document bundled Python');
  assert(notes.includes('`python3` used only by local fallback'), 'packaging notes should document local fallback Python dependency');
  assert(notes.includes('cleans temporary packaging work directories'), 'packaging notes should document package:deb cleanup');

  const packageRun = run('node', [path.join('scripts', 'package_deb.js')], {cwd: DESKTOP_DIR});
  const match = packageRun.stdout.match(/\{[\s\S]*\}\s*$/);
  assert(match, 'package:deb should print JSON summary');
  const summary = JSON.parse(match[0]);
  assert(summary.ok === true, 'deb package summary should be ok');
  assert(summary.debPath && summary.debPath.endsWith('.deb'), 'package:deb should produce a .deb');
  assert(fs.existsSync(summary.debPath), 'deb artifact should exist');
  assert(summary.packageName === 'dendry-mod-studio', 'deb package name should be stable');
  const bundledRuntimePresent = fs.existsSync(path.join(DESKTOP_DIR, 'runtime', 'python'));
  if (bundledRuntimePresent) {
    assert(summary.depends && !summary.depends.includes('python3'), 'bundled local deb summary should omit python3 dependency');
  } else {
    assert(summary.depends && summary.depends.includes('python3'), 'local fallback deb summary should include python3 dependency when no bundled runtime is staged');
  }
  assert(summary.depends.includes('libgtk-3-0'), 'deb summary should include GTK runtime dependency');
  assert(summary.depends.includes('libnss3'), 'deb summary should include NSS runtime dependency');
  assert(summary.depends.includes('libxss1'), 'deb summary should include XSS runtime dependency');
  assert(summary.workDirsCleaned === true, 'package:deb should clean temporary work directories by default');
  assert(!fs.existsSync(path.join(DESKTOP_DIR, 'dist', 'deb-staging')), 'package:deb should not leave deb-staging by default');
  assert(!fs.existsSync(path.join(DESKTOP_DIR, 'dist', 'DendryModStudio-linux-x64')), 'package:deb should not leave unpacked app by default');
  const staleDebs = fs.readdirSync(path.join(DESKTOP_DIR, 'dist'))
    .filter((name) => /^dendry-mod-studio_.*_(amd64|arm64)\.deb$/.test(name))
    .filter((name) => name !== path.basename(summary.debPath));
  assert(staleDebs.length === 0, 'package:deb should remove stale deb artifacts: ' + staleDebs.join(', '));

  const info = run('dpkg-deb', ['--info', summary.debPath]).stdout;
  assert(/Package:\s*dendry-mod-studio/.test(info), 'deb control should include package name');
  const escapedVersion = pkg.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert(new RegExp('Version:\\s*' + escapedVersion).test(info), 'deb control should include version');
  if (bundledRuntimePresent) {
    assert(!/Depends:\s*.*python3/.test(info), 'bundled local deb control should not depend on python3');
  } else {
    assert(/Depends:\s*.*python3/.test(info), 'local fallback deb control should depend on python3 when no bundled runtime is staged');
  }
  assert(/Depends:\s*.*libgtk-3-0/.test(info), 'deb control should include GTK dependency');

  const contents = run('dpkg-deb', ['--contents', summary.debPath]).stdout;
  assert(contents.includes('./opt/dendry-mod-studio/electron'), 'deb should include Electron executable');
  assert(contents.includes('./opt/dendry-mod-studio/resources/app/project_map/viewer/index.html'), 'deb should include viewer');
  assert(contents.includes('./opt/dendry-mod-studio/resources/app/runtime/README.md'), 'deb should include runtime staging notes');
  assert(
    contents.includes('./opt/dendry-mod-studio/resources/app/project_map/templates/starter-demo/source/info.dry'),
    'deb should include bundled starter demo template'
  );
  assert(
    contents.includes('./opt/dendry-mod-studio/resources/app/project_map/templates/starter-demo/package.json'),
    'deb should include bundled starter demo package.json for Runtime Preview builds'
  );
  assert(
    contents.includes('./opt/dendry-mod-studio/resources/app/project_map/templates/starter-demo/project-index.json'),
    'deb should include cached starter demo ProjectIndex'
  );
  assert(
    contents.includes('./opt/dendry-mod-studio/resources/app/project_map/templates/starter-demo/project-index-excerpts.json'),
    'deb should include cached starter demo excerpt ProjectIndex'
  );
  assert(contents.includes('./opt/dendry-mod-studio/resources/app/project_map/build_project_map.py'), 'deb should include Python indexer');
  assert(contents.includes('./opt/dendry-mod-studio/resources/app/project_map/indexer/common.py'), 'deb should include Python indexer package modules');
  assert(contents.includes('./opt/dendry-mod-studio/resources/app/scripts/doctor.js'), 'deb should include doctor script');
  assert(contents.includes('./opt/dendry-mod-studio/resources/app/runtime_preview.js'), 'deb should include Runtime Preview core');
  assert(contents.includes('./opt/dendry-mod-studio/resources/app/dendry_cli_runner.js'), 'deb should include Windows-safe Dendry CLI runner');
  assert(contents.includes('./opt/dendry-mod-studio/resources/app/update_notice.js'), 'deb should include Update Notice core');
  assert(contents.includes('./opt/dendry-mod-studio/resources/app/update_manifest.json'), 'deb should include bundled Update Notice manifest');
  assert(
    contents.includes('./opt/dendry-mod-studio/resources/app/runtime_preview_debug_bridge.js'),
    'deb should include Runtime Preview debug bridge'
  );
  assert(contents.includes('./usr/bin/dendry-mod-studio'), 'deb should include launcher wrapper');
  assert(contents.includes('./usr/share/applications/dendry-mod-studio.desktop'), 'deb should include desktop file');
  assert(contents.includes('./usr/share/icons/hicolor/scalable/apps/dendry-mod-studio.svg'), 'deb should include app icon');

  console.log(JSON.stringify({
    ok: true,
    debPath: summary.debPath,
    packageName: summary.packageName,
    version: summary.version,
    depends: summary.depends
  }, null, 2));
}

main();
