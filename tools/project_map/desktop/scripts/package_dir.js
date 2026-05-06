#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function assertExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(label + ' not found: ' + filePath);
  }
}

function copyPath(src, dest) {
  fs.cpSync(src, dest, {
    recursive: true,
    force: true,
    dereference: true,
    filter: (source) => {
      const base = path.basename(source);
      return base !== '.git' && base !== '__pycache__';
    }
  });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.copyFileSync(src, dest);
}

function packagePlatformTag(options) {
  const platform = String(options && options.platform || process.platform);
  const arch = String(options && options.arch || process.arch);
  return platform + '-' + arch;
}

function electronExecutable(outDir, options) {
  const platform = String(options && options.platform || process.platform);
  if (platform === 'win32') {
    return path.join(outDir, 'electron.exe');
  }
  if (platform === 'darwin') {
    return path.join(outDir, 'Electron.app');
  }
  return path.join(outDir, 'electron');
}

function packageDir(options) {
  const desktopDir = path.resolve((options && options.desktopDir) || path.resolve(__dirname, '..'));
  const projectMapDir = path.resolve(desktopDir, '..');
  const repoRoot = path.resolve(projectMapDir, '..', '..');
  const electronDist = path.join(desktopDir, 'node_modules', 'electron', 'dist');
  const outDir = path.join(desktopDir, 'dist', 'DendryModStudio-' + packagePlatformTag(options));
  const appRoot = path.join(outDir, 'resources', 'app');

  assertExists(electronDist, 'Electron runtime');
  assertExists(path.join(repoRoot, 'node_modules'), 'Root node_modules');

  fs.rmSync(outDir, {recursive: true, force: true});
  fs.mkdirSync(path.dirname(outDir), {recursive: true});
  copyPath(electronDist, outDir);
  fs.mkdirSync(appRoot, {recursive: true});

  [
    'main.js',
    'preload.js',
    'studio_core.js',
    'dendry_cli_runner.js',
    'runtime_preview.js',
    'runtime_lens.js',
    'runtime_preview_debug_bridge.js',
    'update_notice.js',
    'update_manifest.json',
    'package.json'
  ].forEach((name) => copyFile(path.join(desktopDir, name), path.join(appRoot, name)));

  copyPath(path.join(desktopDir, 'scripts'), path.join(appRoot, 'scripts'));
  copyPath(path.join(desktopDir, 'assets'), path.join(appRoot, 'assets'));
  if (fs.existsSync(path.join(desktopDir, 'runtime'))) {
    copyPath(path.join(desktopDir, 'runtime'), path.join(appRoot, 'runtime'));
  }

  [
    'viewer',
    'authoring',
    'profiles',
    'schema',
    'templates'
  ].forEach((name) => copyPath(path.join(projectMapDir, name), path.join(appRoot, 'project_map', name)));

  [
    'parse_dry_project.js',
    'build_project_map.py'
  ].forEach((name) => copyFile(path.join(projectMapDir, name), path.join(appRoot, 'project_map', name)));

  copyPath(path.join(repoRoot, 'node_modules'), path.join(appRoot, 'node_modules'));

  return {
    ok: true,
    outDir,
    executable: electronExecutable(outDir, options),
    appRoot
  };
}

if (require.main === module) {
  console.log(JSON.stringify(packageDir(), null, 2));
}

module.exports = {
  packageDir,
  packagePlatformTag,
  electronExecutable
};
