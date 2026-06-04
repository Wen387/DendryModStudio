#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const PROJECT_MAP_DIR = __dirname;
const DESKTOP_DIR = path.join(PROJECT_MAP_DIR, 'desktop');
const PACKAGE_JSON = path.join(DESKTOP_DIR, 'package.json');
const WINDOWS_ICON = path.join(DESKTOP_DIR, 'assets', 'dendry-mod-studio.ico');

const {fail, assert} = require('./check_harness.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readIcoSizes(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert(buffer.length > 6, 'Windows icon file should not be empty');
  assert(buffer.readUInt16LE(0) === 0, 'Windows icon should start with reserved zero');
  assert(buffer.readUInt16LE(2) === 1, 'Windows icon should be an ICO image');
  const count = buffer.readUInt16LE(4);
  const sizes = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    const width = buffer[offset] || 256;
    const height = buffer[offset + 1] || 256;
    if (width === height) {
      sizes.push(width);
    }
  }
  return sizes;
}

function main() {
  const pkg = readJson(PACKAGE_JSON);
  assert(/^\d+\.\d+\.\d+$/.test(pkg.version || ''), 'desktop package version should be semver-like');
  assert(pkg.scripts && pkg.scripts['package:portable'], 'desktop package should expose npm run package:portable');
  assert(pkg.scripts && pkg.scripts['dist:linux'], 'desktop package should expose npm run dist:linux');
  assert(pkg.scripts && pkg.scripts['dist:win'], 'desktop package should expose npm run dist:win');
  assert(pkg.scripts['dist:linux'].includes('deb'), 'desktop Linux release build should include Deb');
  assert(pkg.scripts['dist:linux'].includes('fetch:python'), 'desktop Linux release build should fetch bundled Python first');
  assert(pkg.scripts['dist:win'].includes('fetch:python'), 'desktop Windows release build should fetch bundled Python first');
  assert(pkg.homepage && /github\.com\/Wen387\/DendryModStudio/.test(pkg.homepage), 'desktop package should define a release homepage');
  assert(pkg.author && pkg.author.email, 'desktop package should define maintainer email for Deb builds');
  assert(pkg.devDependencies && pkg.devDependencies['electron-builder'], 'desktop package should depend on electron-builder for release builds');
  assert(pkg.build && pkg.build.asar === true, 'desktop builder config should keep the deps-in-asar layout enabled (normal dist:win packaging since v0.9.66)');
  assert(
    pkg.build.linux && Array.isArray(pkg.build.linux.target) && pkg.build.linux.target.includes('deb'),
    'desktop builder Linux config should include Deb target'
  );
  assert(pkg.build.linux && pkg.build.linux.maintainer, 'desktop Linux config should define Deb maintainer');
  assert(pkg.build.win && pkg.build.win.icon === 'assets/dendry-mod-studio.ico', 'desktop Windows config should define an ICO app icon');
  assert(pkg.build.deb && Array.isArray(pkg.build.deb.depends), 'desktop Deb config should declare runtime dependencies');
  assert(!pkg.build.deb.depends.includes('python3'), 'desktop release Deb config should not require system Python');
  assert(pkg.build.nsis && pkg.build.nsis.include === 'build/installer.nsh', 'desktop NSIS config should include the custom installer cleanup script');
  assert(pkg.build.nsis.installerIcon === 'assets/dendry-mod-studio.ico', 'desktop NSIS installer should use the branded Windows icon');
  assert(pkg.build.nsis.uninstallerIcon === 'assets/dendry-mod-studio.ico', 'desktop NSIS uninstaller should use the branded Windows icon');
  assert(
    pkg.build.extraResources && pkg.build.extraResources.some((item) => item.from === 'runtime' && item.to === 'app/runtime'),
    'desktop builder config should include bundled runtime resources'
  );
  assert(
    pkg.build.extraResources && pkg.build.extraResources.some((item) => item.from === '../indexer' && item.to === 'app/project_map/indexer'),
    'desktop builder config should include the Python indexer package'
  );
  assert(fs.existsSync(path.join(DESKTOP_DIR, 'scripts', 'package_portable.js')), 'package_portable.js should exist');
  assert(fs.existsSync(path.join(DESKTOP_DIR, 'scripts', 'fetch_bundled_python.js')), 'fetch_bundled_python.js should exist');
  assert(fs.existsSync(path.join(DESKTOP_DIR, 'scripts', 'generate_windows_icon.js')), 'generate_windows_icon.js should exist');
  assert(fs.existsSync(WINDOWS_ICON), 'Windows ICO app icon should exist');
  const iconSizes = readIcoSizes(WINDOWS_ICON);
  [16, 32, 48, 256].forEach((size) => {
    assert(iconSizes.includes(size), 'Windows ICO app icon should include ' + size + 'x' + size);
  });
  assert(fs.existsSync(path.join(DESKTOP_DIR, 'build', 'installer.nsh')), 'installer.nsh should exist');
  assert(fs.existsSync(path.join(DESKTOP_DIR, 'PACKAGING_NOTES.md')), 'PACKAGING_NOTES.md should exist');

  const notes = fs.readFileSync(path.join(DESKTOP_DIR, 'PACKAGING_NOTES.md'), 'utf8');
  assert(notes.includes(`v${pkg.version}`), `packaging notes should mention v${pkg.version}`);
  assert(notes.includes('bundled Python runtime'), 'packaging notes should state release builds include bundled Python');
  assert(notes.includes('users should not need to install Python separately'), 'packaging notes should remove Python as a user prerequisite');
  assert(notes.includes('.deb'), 'packaging notes should discuss .deb boundary');
  assert(notes.includes('AppImage'), 'packaging notes should discuss AppImage boundary');
  assert(notes.includes('Windows'), 'packaging notes should discuss Windows artifact boundary');
  assert(notes.includes('Windows app icon'), 'packaging notes should discuss Windows app icon coverage');
  assert(notes.includes('portable'), 'packaging notes should discuss portable package boundary');

  const mainJs = fs.readFileSync(path.join(DESKTOP_DIR, 'main.js'), 'utf8');
  assert(mainJs.includes('app.setAppUserModelId(APP_ID)'), 'desktop main should set a Windows AppUserModelId');
  assert(mainJs.includes('dendry-mod-studio.ico'), 'desktop main window should reference the Windows icon');

  const run = spawnSync(process.execPath, [path.join(DESKTOP_DIR, 'scripts', 'package_portable.js')], {
    cwd: DESKTOP_DIR,
    encoding: 'utf8'
  });
  assert(run.status === 0, 'package_portable.js should pass: ' + (run.stderr || run.error && run.error.message || 'unknown error'));
  const platformTag = process.platform + '-' + process.arch;
  const archivePath = path.join(DESKTOP_DIR, 'dist', 'DendryModStudio-' + platformTag + '.tar.gz');
  const appRoot = path.join(DESKTOP_DIR, 'dist', 'DendryModStudio-' + platformTag, 'resources', 'app');
  const manifestPath = path.join(DESKTOP_DIR, 'dist', 'DendryModStudio-' + platformTag, 'portable-manifest.json');
  assert(archivePath.endsWith('.tar.gz'), 'portable package should produce a .tar.gz archive');
  assert(fs.existsSync(archivePath), 'portable archive should exist');
  assert(fs.existsSync(manifestPath), 'portable manifest should exist');
  assert(fs.existsSync(path.join(appRoot, 'scripts', 'doctor.js')), 'packaged app should include doctor script');
  assert(fs.existsSync(path.join(appRoot, 'scripts', 'fetch_bundled_python.js')), 'packaged app should include bundled Python fetch script');
  assert(fs.existsSync(path.join(appRoot, 'assets', 'dendry-mod-studio.ico')), 'packaged app should include Windows app icon');
  assert(fs.existsSync(path.join(appRoot, 'runtime', 'README.md')), 'packaged app should include runtime staging notes');
  assert(fs.existsSync(path.join(appRoot, 'runtime_preview.js')), 'packaged app should include Runtime Preview core');
  assert(fs.existsSync(path.join(appRoot, 'runtime_lens.js')), 'packaged app should include Runtime Lens core');
  assert(fs.existsSync(path.join(appRoot, 'runtime_session_cleanup.js')), 'packaged app should include Runtime Session Cleanup core');
  assert(fs.existsSync(path.join(appRoot, 'dendry_cli_runner.js')), 'packaged app should include Windows-safe Dendry CLI runner');
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
    fs.existsSync(path.join(appRoot, 'project_map', 'templates', 'starter-demo', 'project-index.json')),
    'packaged app should include cached starter demo ProjectIndex'
  );
  assert(
    fs.existsSync(path.join(appRoot, 'project_map', 'templates', 'starter-demo', 'project-index-excerpts.json')),
    'packaged app should include cached starter demo excerpt ProjectIndex'
  );
  assert(
    fs.existsSync(path.join(appRoot, 'project_map', 'indexer', 'common.py')),
    'packaged app should include the Python indexer package modules'
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
