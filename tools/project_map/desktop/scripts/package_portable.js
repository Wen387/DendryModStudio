#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const core = require('../studio_core');
const {packageDir} = require('./package_dir');

const desktopDir = path.resolve(__dirname, '..');

function padOctal(value, width) {
  const text = Math.max(0, value).toString(8);
  return text.padStart(width - 1, '0') + '\0';
}

function checksum(header) {
  let sum = 0;
  for (let i = 0; i < header.length; i += 1) {
    sum += header[i];
  }
  return sum;
}

function writeString(buffer, offset, length, value) {
  buffer.write(String(value || '').slice(0, length), offset, length, 'ascii');
}

function splitTarName(name) {
  if (Buffer.byteLength(name) <= 100) {
    return {name, prefix: ''};
  }
  const parts = name.split('/');
  for (let i = 1; i < parts.length; i += 1) {
    const prefix = parts.slice(0, i).join('/');
    const tail = parts.slice(i).join('/');
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(tail) <= 100) {
      return {name: tail, prefix};
    }
  }
  throw new Error('Path is too long for portable tarball: ' + name);
}

function tarHeader(entry) {
  const header = Buffer.alloc(512, 0);
  const names = splitTarName(entry.name);
  writeString(header, 0, 100, names.name);
  writeString(header, 100, 8, padOctal(entry.mode, 8));
  writeString(header, 108, 8, padOctal(0, 8));
  writeString(header, 116, 8, padOctal(0, 8));
  writeString(header, 124, 12, padOctal(entry.size, 12));
  writeString(header, 136, 12, padOctal(entry.mtime, 12));
  header.fill(' ', 148, 156);
  header[156] = entry.type === 'directory' ? '5'.charCodeAt(0) : '0'.charCodeAt(0);
  writeString(header, 257, 6, 'ustar');
  writeString(header, 263, 2, '00');
  writeString(header, 345, 155, names.prefix);
  writeString(header, 148, 8, padOctal(checksum(header), 8));
  return header;
}

function walk(dir, root, entries) {
  const stats = fs.statSync(dir);
  const rel = path.relative(root, dir).split(path.sep).join('/');
  if (rel) {
    entries.push({
      absolute: dir,
      name: rel + (stats.isDirectory() ? '/' : ''),
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.isDirectory() ? 0 : stats.size,
      mode: stats.mode & 0o777,
      mtime: Math.floor(stats.mtimeMs / 1000)
    });
  }
  if (stats.isDirectory()) {
    fs.readdirSync(dir).sort().forEach((child) => walk(path.join(dir, child), root, entries));
  }
}

function writeTarGz(srcDir, archivePath) {
  const root = path.dirname(srcDir);
  const entries = [];
  walk(srcDir, root, entries);
  const chunks = [];
  entries.forEach((entry) => {
    chunks.push(tarHeader(entry));
    if (entry.type === 'file') {
      const body = fs.readFileSync(entry.absolute);
      chunks.push(body);
      const remainder = body.length % 512;
      if (remainder) {
        chunks.push(Buffer.alloc(512 - remainder, 0));
      }
    }
  });
  chunks.push(Buffer.alloc(1024, 0));
  fs.mkdirSync(path.dirname(archivePath), {recursive: true});
  fs.writeFileSync(archivePath, zlib.gzipSync(Buffer.concat(chunks), {level: 9}));
}

function portableManifest(packaged, doctor) {
  const python = doctor && doctor.checks && doctor.checks.python || {};
  return {
    schemaVersion: '0.1',
    packageKind: 'portable-tar-gz',
    version: require('../package.json').version,
    createdAt: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    executable: packaged.executable,
    appRoot: packaged.appRoot,
    systemDependencies: {
      python3: python.source === 'bundled' ? 'bundled with app' : 'required for local packaging fallback'
    },
    bundledPython: python.source === 'bundled'
      ? {ok: true, executable: python.python, version: python.version}
      : {ok: false, reason: 'No bundled runtime was present when this package was assembled.'},
    installerStatus: {
      deb: 'not-built',
      exe: 'not-built',
      reason: 'v0.5.2 is a portable package, not a formal installer.'
    },
    checks: doctor.checks
  };
}

async function main() {
  const packaged = packageDir({desktopDir});
  const doctor = await core.runDesktopDoctor({
    root: '',
    outDir: path.join(os.tmpdir(), 'dendry_mod_studio_packaging_doctor'),
    desktopDir: packaged.appRoot
  });
  const manifest = portableManifest(packaged, doctor);
  const manifestPath = path.join(packaged.outDir, 'portable-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  const archivePath = path.join(desktopDir, 'dist', 'DendryModStudio-linux-x64.tar.gz');
  writeTarGz(packaged.outDir, archivePath);

  console.log(JSON.stringify({
    ok: true,
    archivePath,
    manifestPath,
    outDir: packaged.outDir,
    executable: packaged.executable,
    appRoot: packaged.appRoot,
    checks: doctor.checks,
    notes: doctor.checks.python && doctor.checks.python.source === 'bundled'
      ? 'Portable package includes the bundled Python runtime. This is not a .deb or .exe installer.'
      : 'Portable package did not include a bundled Python runtime; this local fallback still requires Python 3.'
  }, null, 2));
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
