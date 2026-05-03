#!/usr/bin/env node
'use strict';

const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const desktopDir = path.resolve(__dirname, '..');
const DEFAULT_BUILD = '20260203';
const DEFAULT_VERSION = '3.13.12';

function fail(message) {
  throw new Error(message);
}

function targetTriple() {
  const arch = process.arch;
  if (process.platform === 'win32') {
    if (arch === 'x64') {
      return 'x86_64-pc-windows-msvc';
    }
    if (arch === 'arm64') {
      return 'aarch64-pc-windows-msvc';
    }
  }
  if (process.platform === 'linux') {
    if (arch === 'x64') {
      return 'x86_64-unknown-linux-gnu';
    }
    if (arch === 'arm64') {
      return 'aarch64-unknown-linux-gnu';
    }
  }
  if (process.platform === 'darwin') {
    if (arch === 'x64') {
      return 'x86_64-apple-darwin';
    }
    if (arch === 'arm64') {
      return 'aarch64-apple-darwin';
    }
  }
  fail('No bundled Python target is configured for ' + process.platform + '/' + arch);
}

function defaultUrl() {
  const build = process.env.DMS_PYTHON_STANDALONE_BUILD || DEFAULT_BUILD;
  const version = process.env.DMS_PYTHON_STANDALONE_VERSION || DEFAULT_VERSION;
  const artifact = 'cpython-' + version + '+' + build + '-' + targetTriple() + '-install_only_stripped.tar.gz';
  return 'https://github.com/astral-sh/python-build-standalone/releases/download/' + build + '/' + artifact;
}

function download(url, dest, redirectsLeft) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && location) {
        response.resume();
        if (redirectsLeft <= 0) {
          reject(new Error('Too many redirects while downloading bundled Python.'));
          return;
        }
        download(new URL(location, url).toString(), dest, redirectsLeft - 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error('Download failed with HTTP ' + response.statusCode + ': ' + url));
        return;
      }
      fs.mkdirSync(path.dirname(dest), {recursive: true});
      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

function run(command, args) {
  const result = spawnSync(command, args, {encoding: 'utf8'});
  if (result.status !== 0) {
    fail(command + ' ' + args.join(' ') + ' failed: ' + (result.stderr || result.stdout));
  }
  return result;
}

function bundledPythonExecutable(root) {
  const candidates = process.platform === 'win32'
    ? [
        path.join(root, 'python.exe'),
        path.join(root, 'python', 'python.exe')
      ]
    : [
        path.join(root, 'bin', 'python3'),
        path.join(root, 'bin', 'python'),
        path.join(root, 'python', 'bin', 'python3'),
        path.join(root, 'python', 'bin', 'python')
      ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function existingBundledPython(root) {
  const executable = bundledPythonExecutable(root);
  if (!executable) {
    return null;
  }
  const versionCheck = run(executable, ['--version']);
  return {
    executable,
    version: versionCheck.stdout.trim() || versionCheck.stderr.trim()
  };
}

async function main() {
  const url = process.env.DMS_BUNDLED_PYTHON_URL || defaultUrl();
  const targetRoot = path.join(desktopDir, 'runtime', 'python');
  const manifestPath = path.join(desktopDir, 'runtime', 'python-manifest.json');
  if (process.env.DMS_BUNDLED_PYTHON_FORCE !== '1') {
    const existing = existingBundledPython(targetRoot);
    if (existing) {
      console.log(JSON.stringify({
        ok: true,
        reused: true,
        targetRoot,
        manifestPath,
        version: existing.version
      }, null, 2));
      return;
    }
  }
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-bundled-python-'));
  const archivePath = path.join(workRoot, 'python.tar.gz');
  const extractRoot = path.join(workRoot, 'extract');

  try {
    await download(url, archivePath, 5);
    fs.mkdirSync(extractRoot, {recursive: true});
    run('tar', ['-xzf', archivePath, '-C', extractRoot]);
    const extracted = path.join(extractRoot, 'python');
    if (!fs.existsSync(extracted)) {
      fail('Bundled Python archive did not contain a top-level python directory.');
    }
    fs.rmSync(targetRoot, {recursive: true, force: true});
    fs.cpSync(extracted, targetRoot, {recursive: true, force: true, dereference: true});
    const executable = bundledPythonExecutable(targetRoot);
    if (!executable) {
      fail('Bundled Python executable was not found after extraction.');
    }
    if (process.platform !== 'win32') {
      fs.chmodSync(executable, 0o755);
    }
    const versionCheck = run(executable, ['--version']);
    const version = versionCheck.stdout.trim() || versionCheck.stderr.trim();
    const manifest = {
      schemaVersion: '0.1',
      provider: 'astral-sh/python-build-standalone',
      sourceUrl: url,
      platform: process.platform,
      arch: process.arch,
      executable,
      version,
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify({ok: true, targetRoot, manifestPath, version}, null, 2));
  } finally {
    fs.rmSync(workRoot, {recursive: true, force: true});
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
