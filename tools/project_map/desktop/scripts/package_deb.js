#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');
const {packageDir} = require('./package_dir');

const desktopDir = path.resolve(__dirname, '..');
const packageJson = require('../package.json');
const packageName = 'dendry-mod-studio';
const installDir = '/opt/dendry-mod-studio';
const wrapperPath = '/usr/bin/dendry-mod-studio';
const desktopFilePath = '/usr/share/applications/dendry-mod-studio.desktop';
const iconSourcePath = path.join(desktopDir, 'assets', 'dendry-mod-studio.svg');
const iconInstallPath = '/usr/share/icons/hicolor/scalable/apps/dendry-mod-studio.svg';
const depends = [
  'python3',
  'libc6',
  'libgtk-3-0',
  'libnss3',
  'libxss1',
  'libasound2 | libasound2t64',
  'libx11-6',
  'libxcomposite1',
  'libxdamage1',
  'libxext6',
  'libxfixes3',
  'libxrandr2',
  'libgbm1',
  'libdrm2',
  'libatk1.0-0',
  'libatk-bridge2.0-0',
  'libcups2',
  'libpango-1.0-0',
  'libcairo2',
  'libxkbcommon0',
  'libatspi2.0-0'
].join(', ');

function run(command, args, options) {
  const result = spawnSync(command, args, Object.assign({encoding: 'utf8'}, options || {}));
  if (result.status !== 0) {
    throw new Error(command + ' ' + args.join(' ') + ' failed: ' + (result.stderr || result.stdout));
  }
  return result;
}

function debArch() {
  if (process.arch === 'x64') {
    return 'amd64';
  }
  if (process.arch === 'arm64') {
    return 'arm64';
  }
  throw new Error('Unsupported deb architecture for this spike: ' + process.arch);
}

function copyPath(src, dest) {
  fs.cpSync(src, dest, {
    recursive: true,
    force: true,
    dereference: true,
    filter: (source) => path.basename(source) !== '__pycache__'
  });
}

function copyFile(src, dest, mode) {
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.copyFileSync(src, dest);
  if (mode) {
    fs.chmodSync(dest, mode);
  }
}

function writeFile(filePath, contents, mode) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, contents, 'utf8');
  if (mode) {
    fs.chmodSync(filePath, mode);
  }
}

function controlFile(arch) {
  return [
    'Package: ' + packageName,
    'Version: ' + packageJson.version,
    'Section: games',
    'Priority: optional',
    'Architecture: ' + arch,
    'Depends: ' + depends,
    'Maintainer: Island\'s Sunrise maintainers <noreply@example.invalid>',
    'Homepage: https://example.invalid/dendry-mod-studio',
    'Description: Dendry Mod Studio desktop shell',
    ' Read-only/export-only Project Map and World Event authoring shell for Dendry projects.',
    ''
  ].join('\n');
}

function desktopEntry() {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Dendry Mod Studio',
    'Comment=Project Map viewer and event draft shell for Dendry projects',
    'Exec=dendry-mod-studio',
    'Icon=dendry-mod-studio',
    'Terminal=false',
    'Categories=Game;Development;',
    'Keywords=Dendry;Modding;Studio;Interactive Fiction;',
    ''
  ].join('\n');
}

function wrapperScript() {
  return [
    '#!/bin/sh',
    'exec ' + installDir + '/electron "$@"',
    ''
  ].join('\n');
}

function debManifest(packaged, arch, options) {
  return {
    schemaVersion: '0.1',
    packageKind: 'deb',
    packageName,
    version: packageJson.version,
    architecture: arch,
    installDir,
    wrapperPath,
    desktopFilePath,
    iconInstallPath,
    systemDependencies: {
      python3: 'deb Depends: python3',
      electronRuntime: 'deb Depends include GTK/NSS/X11/GBM/ALSA runtime libraries'
    },
    installerStatus: {
      deb: 'built',
      exe: 'not-built',
      pythonBundled: false
    },
    sourceBuildAppRoot: options.keepWorkDirs ? packaged.appRoot : null,
    workDirsCleaned: !options.keepWorkDirs
  };
}

function removeStaleDebs(distDir, currentDebPath) {
  if (!fs.existsSync(distDir)) {
    return [];
  }
  const removed = [];
  fs.readdirSync(distDir)
    .filter((name) => new RegExp('^' + packageName + '_.*_(amd64|arm64)\\.deb$').test(name))
    .forEach((name) => {
      const debPath = path.join(distDir, name);
      if (debPath !== currentDebPath) {
        fs.rmSync(debPath, {force: true});
        removed.push(debPath);
      }
    });
  return removed;
}

function parseArgs(argv) {
  return {
    keepWorkDirs: argv.includes('--keep-workdirs')
  };
}

function packageDeb(options) {
  const opts = Object.assign({keepWorkDirs: false}, options || {});
  if (process.platform !== 'linux') {
    throw new Error('The .deb packaging spike can only run on Linux.');
  }
  run('dpkg-deb', ['--version']);

  const arch = debArch();
  const packaged = packageDir({desktopDir});
  const distDir = path.join(desktopDir, 'dist');
  const stagingDir = path.join(distDir, 'deb-staging');
  const packageRoot = path.join(stagingDir, packageName + '_' + packageJson.version + '_' + arch);
  const debPath = path.join(distDir, packageName + '_' + packageJson.version + '_' + arch + '.deb');
  let staleDebsRemoved = [];

  try {
    fs.rmSync(packageRoot, {recursive: true, force: true});
    fs.mkdirSync(packageRoot, {recursive: true});

    copyPath(packaged.outDir, path.join(packageRoot, installDir.slice(1)));
    writeFile(path.join(packageRoot, 'DEBIAN', 'control'), controlFile(arch), 0o644);
    writeFile(path.join(packageRoot, wrapperPath.slice(1)), wrapperScript(), 0o755);
    writeFile(path.join(packageRoot, desktopFilePath.slice(1)), desktopEntry(), 0o644);
    copyFile(iconSourcePath, path.join(packageRoot, iconInstallPath.slice(1)), 0o644);
    writeFile(
      path.join(packageRoot, installDir.slice(1), 'deb-manifest.json'),
      JSON.stringify(debManifest(packaged, arch, opts), null, 2) + '\n',
      0o644
    );

    fs.rmSync(debPath, {force: true});
    run('dpkg-deb', ['--build', '--root-owner-group', packageRoot, debPath]);
    staleDebsRemoved = removeStaleDebs(distDir, debPath);
  } finally {
    if (!opts.keepWorkDirs) {
      fs.rmSync(stagingDir, {recursive: true, force: true});
      fs.rmSync(packaged.outDir, {recursive: true, force: true});
    }
  }

  return {
    ok: true,
    packageName,
    version: packageJson.version,
    architecture: arch,
    depends,
    debPath,
    packageRoot: opts.keepWorkDirs ? packageRoot : null,
    installDir,
    wrapperPath,
    desktopFilePath,
    iconInstallPath,
    executable: installDir + '/electron',
    workDirsCleaned: !opts.keepWorkDirs,
    staleDebsRemoved
  };
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(packageDeb(parseArgs(process.argv.slice(2))), null, 2));
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  }
}

module.exports = {
  packageDeb,
  removeStaleDebs
};
