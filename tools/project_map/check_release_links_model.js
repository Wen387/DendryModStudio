#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function assertIncludes(text, needle, label) {
  assert(text.includes(needle), label + ' should include ' + needle);
}

function main() {
  const desktopPackage = readJson('tools/project_map/desktop/package.json');
  const releaseVersion = desktopPackage.version;
  const releaseTag = 'v' + releaseVersion + '-preview.1';
  const releasePrepPath = 'docs/releases/v' + releaseVersion + '-dev-preview.md';
  const releaseNotesPath = 'tools/project_map/RELEASE_NOTES_v' + releaseVersion + '.md';
  const readmeEn = read('README.md');
  const readmeZh = read('README.zh-Hant.md');
  const releaseWorkflow = read('.github/workflows/release.yml');
  const releasePrep = read(releasePrepPath);
  const releaseNotes = read(releaseNotesPath);
  const updateManifest = readJson('tools/project_map/desktop/update_manifest.json');

  const winAsset = 'DendryModStudio-win-x64.exe';
  const appImageAsset = 'DendryModStudio-linux-x64.AppImage';
  const debAsset = 'DendryModStudio-linux-x64.deb';
  const releaseUrl = 'https://github.com/Wen387/DendryModStudio/releases';

  assert(desktopPackage.build && desktopPackage.build.win, 'desktop package should configure Windows release artifacts');
  assert(desktopPackage.build && desktopPackage.build.linux, 'desktop package should configure Linux release artifacts');
  assert(desktopPackage.build.win.artifactName === 'DendryModStudio-win-x64.${ext}', 'Windows artifactName should match README download link');
  assert(desktopPackage.build.linux.artifactName === 'DendryModStudio-linux-x64.${ext}', 'Linux artifactName should match README download links');
  assert(Array.isArray(desktopPackage.build.linux.target), 'Linux target should be a list');
  assert(desktopPackage.build.linux.target.includes('AppImage'), 'Linux target should include AppImage');
  assert(desktopPackage.build.linux.target.includes('deb'), 'Linux target should include Deb');
  assert(Array.isArray(desktopPackage.build.win.target), 'Windows target should be a list');
  assert(desktopPackage.build.win.target.includes('nsis'), 'Windows target should include NSIS');

  [readmeEn, readmeZh, releasePrep, releaseNotes].forEach((doc, index) => {
    const label = ['README.md', 'README.zh-Hant.md', 'release prep', 'release notes'][index];
    [winAsset, appImageAsset, debAsset].forEach((asset) => assertIncludes(doc, asset, label));
  });

  [
    '/releases/latest/download/' + winAsset,
    '/releases/latest/download/' + appImageAsset,
    '/releases/latest/download/' + debAsset
  ].forEach((downloadPath) => {
    assertIncludes(readmeEn, downloadPath, 'README.md');
    assertIncludes(readmeZh, downloadPath, 'README.zh-Hant.md');
  });

  assertIncludes(readmeEn, 'latest non-draft Release', 'README.md');
  assertIncludes(readmeZh, 'latest non-draft Release', 'README.zh-Hant.md');
  assertIncludes(releaseWorkflow, 'tools/project_map/desktop/dist-builder/*.AppImage', 'release workflow');
  assertIncludes(releaseWorkflow, 'tools/project_map/desktop/dist-builder/*.deb', 'release workflow');
  assertIncludes(releaseWorkflow, 'tools/project_map/desktop/dist-builder/*.exe', 'release workflow');
  assertIncludes(releaseWorkflow, 'actions/download-artifact@v4', 'release workflow');
  assertIncludes(releaseWorkflow, 'softprops/action-gh-release@v2', 'release workflow');
  assertIncludes(releaseWorkflow, 'publish_release', 'release workflow');
  assertIncludes(releaseWorkflow, 'release_tag', 'release workflow');
  assertIncludes(releaseWorkflow, releaseTag, 'release workflow');

  assert(updateManifest.downloadUrl === releaseUrl, 'update manifest downloadUrl should point to GitHub Releases');
  assert(
    updateManifest.releaseNotesUrl === 'https://raw.githubusercontent.com/Wen387/DendryModStudio/main/' + releaseNotesPath,
    'update manifest releaseNotesUrl should point to tracked release notes'
  );
  assertIncludes(releasePrep, releaseTag, 'release prep');
  assertIncludes(releasePrep, 'publish_release', 'release prep');
  assertIncludes(releasePrep, 'Desktop Release', 'release prep');
  assertIncludes(releaseNotes, 'Desktop Release', 'release notes');
  assertIncludes(releaseNotes, 'dist-builder', 'release notes');

  process.stdout.write(JSON.stringify({
    ok: true,
    assets: [winAsset, appImageAsset, debAsset],
    releaseUrl
  }, null, 2) + '\n');
}

main();
