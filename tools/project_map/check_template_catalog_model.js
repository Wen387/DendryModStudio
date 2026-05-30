#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const DESKTOP_DIR = path.join(ROOT, 'desktop');
const catalog = require('./desktop/template_catalog.js');
const core = require('./desktop/studio_core.js');

const {fail, assert} = require('./check_harness.js');

// --- Bundled catalog loads and validates ---

const bundled = catalog.loadBundledCatalog({desktopDir: DESKTOP_DIR});
assert(bundled && typeof bundled === 'object', 'loadBundledCatalog should return an object');
assert(bundled.schemaVersion === 1, 'bundled catalog schemaVersion should be 1');
assert(Array.isArray(bundled.templates), 'bundled catalog should have a templates array');

const validation = catalog.validateCatalog(bundled);
assert(validation.ok, 'bundled catalog should pass validation: ' + JSON.stringify(validation.diagnostics));

// --- Validation rejects bad input ---

const badCatalog = catalog.validateCatalog(null);
assert(!badCatalog.ok, 'null catalog should fail validation');

const missingFields = catalog.validateCatalog({schemaVersion: 1, templates: [{}]});
assert(!missingFields.ok, 'template entry missing required fields should fail');
assert(missingFields.diagnostics.some((d) => d.includes('id')), 'diagnostics should mention missing id');

const badId = catalog.validateCatalog({schemaVersion: 1, templates: [{
  id: '../escape', title: 'X', repo: 'x/x', assetName: 'x.tar.gz'
}]});
assert(!badId.ok, 'path-traversal id should fail validation');
assert(badId.diagnostics.some((d) => d.includes('letters')), 'diagnostics should mention valid characters');

const badSchema = catalog.validateCatalog({schemaVersion: 2, templates: []});
assert(!badSchema.ok, 'wrong schemaVersion should fail validation');

const badAssetsType = catalog.validateCatalog({schemaVersion: 1, templates: [{
  id: 'a', title: 'A', repo: 'x/x', assetName: 'a.tar.gz', assetsAssetName: 123
}]});
assert(!badAssetsType.ok, 'non-string assetsAssetName should fail validation');

const badAssetsSizeMB = catalog.validateCatalog({schemaVersion: 1, templates: [{
  id: 'a', title: 'A', repo: 'x/x', assetName: 'a.tar.gz', assetsEstimatedSizeMB: -5
}]});
assert(!badAssetsSizeMB.ok, 'negative assetsEstimatedSizeMB should fail validation');

const validWithAssets = catalog.validateCatalog({schemaVersion: 1, templates: [{
  id: 'a', title: 'A', repo: 'x/x', assetName: 'a.tar.gz',
  assetsAssetName: 'a-assets.tar.gz', assetsEstimatedSizeMB: 100
}]});
assert(validWithAssets.ok, 'valid template with assets fields should pass validation');

// --- evaluateCatalog filters and localizes ---

const evaluated = catalog.evaluateCatalog(bundled, {currentVersion: '0.98.0', locale: 'zh-Hant'});
assert(evaluated.ok, 'evaluateCatalog should succeed for the bundled catalog');
assert(evaluated.templates.length > 0, 'bundled catalog should contain at least one template');

assert(evaluated.templates.length === 3, 'bundled catalog should contain three templates');
const first = evaluated.templates[0];
assert(first.id === 'showcase-game', 'first template id should be showcase-game');
assert(first.title && first.title.length > 0, 'template title should be non-empty');
assert(evaluated.templates.some((t) => t.id === 'biennio-rosso'), 'catalog should contain biennio-rosso');
assert(evaluated.templates.some((t) => t.id === 'dynamic-sdaah'), 'catalog should contain dynamic-sdaah');

const dynamicEntry = evaluated.templates.find((t) => t.id === 'dynamic-sdaah');
assert(dynamicEntry.assetsAssetName === 'dynamic-sdaah-assets.tar.gz', 'dynamic-sdaah should carry assetsAssetName');
assert(dynamicEntry.assetsEstimatedSizeMB === 246, 'dynamic-sdaah should carry assetsEstimatedSizeMB');

const biennioEntry = evaluated.templates.find((t) => t.id === 'biennio-rosso');
assert(biennioEntry.assetsAssetName === 'biennio-rosso-assets.tar.gz', 'biennio-rosso should carry assetsAssetName');

const showcaseEntry = evaluated.templates.find((t) => t.id === 'showcase-game');
assert(showcaseEntry.assetsAssetName === '', 'showcase-game without assets should have empty assetsAssetName');
assert(showcaseEntry.assetsEstimatedSizeMB === 0, 'showcase-game without assets should have zero assetsEstimatedSizeMB');

const evaluatedZh = catalog.evaluateCatalog(bundled, {currentVersion: '0.98.0', locale: 'zh-Hant'});
assert(evaluatedZh.templates[0].title === '展示遊戲', 'zh-Hant locale should resolve titleLocalized');

const evaluatedEn = catalog.evaluateCatalog(bundled, {currentVersion: '0.98.0', locale: 'en'});
assert(evaluatedEn.templates[0].title === 'Showcase Game', 'en locale should use base title');

const futureVersion = catalog.evaluateCatalog({
  schemaVersion: 1,
  templates: [{
    id: 'future',
    title: 'Future',
    repo: 'test/future',
    assetName: 'future.tar.gz',
    minStudioVersion: '99.0.0'
  }]
}, {currentVersion: '0.98.0'});
assert(futureVersion.templates.length === 0, 'templates with minStudioVersion above current should be filtered');

// --- URL resolution ---

const latestUrl = catalog.resolveReleaseAssetUrl({
  repo: 'Wen387/dendry-showcase-game',
  releaseTag: 'latest',
  assetName: 'showcase-game-source.tar.gz'
}, 'assetName');
assert(
  latestUrl === 'https://github.com/Wen387/dendry-showcase-game/releases/latest/download/showcase-game-source.tar.gz',
  'latest tag should produce /releases/latest/download/ URL: ' + latestUrl
);

const pinnedUrl = catalog.resolveReleaseAssetUrl({
  repo: 'Wen387/dendry-showcase-game',
  releaseTag: 'v1.0.0',
  assetName: 'showcase-game-source.tar.gz'
}, 'assetName');
assert(
  pinnedUrl === 'https://github.com/Wen387/dendry-showcase-game/releases/download/v1.0.0/showcase-game-source.tar.gz',
  'pinned tag should produce /releases/download/v1.0.0/ URL: ' + pinnedUrl
);

const indexUrl = catalog.resolveReleaseAssetUrl({
  repo: 'Wen387/dendry-showcase-game',
  releaseTag: 'latest',
  indexAssetName: 'project-index.json'
}, 'indexAssetName');
assert(
  indexUrl === 'https://github.com/Wen387/dendry-showcase-game/releases/latest/download/project-index.json',
  'index asset URL should resolve correctly: ' + indexUrl
);

const assetsUrl = catalog.resolveReleaseAssetUrl({
  repo: 'Wen387/dynamic_social_democracy_StudioRepo',
  releaseTag: 'latest',
  assetsAssetName: 'dynamic-sdaah-assets.tar.gz'
}, 'assetsAssetName');
assert(
  assetsUrl === 'https://github.com/Wen387/dynamic_social_democracy_StudioRepo/releases/latest/download/dynamic-sdaah-assets.tar.gz',
  'assetsAssetName URL should resolve correctly: ' + assetsUrl
);

const emptyUrl = catalog.resolveReleaseAssetUrl({repo: '', assetName: ''}, 'assetName');
assert(emptyUrl === '', 'empty repo/asset should return empty URL');

// --- Status checking ---

const tmpRoot = path.join(os.tmpdir(), 'dms_catalog_test_' + Date.now());

const notInstalled = catalog.checkTemplateStatus(tmpRoot, 'nonexistent');
assert(notInstalled === 'not-installed', 'nonexistent template should be not-installed');

const corruptDir = path.join(tmpRoot, 'corrupt-test');
fs.mkdirSync(corruptDir, {recursive: true});
fs.writeFileSync(path.join(corruptDir, 'some-file.txt'), 'junk');
assert(catalog.checkTemplateStatus(tmpRoot, 'corrupt-test') === 'corrupted', 'directory without marker should be corrupted');

catalog.writeMarker(corruptDir, {id: 'corrupt-test'});
assert(catalog.checkTemplateStatus(tmpRoot, 'corrupt-test') === 'corrupted', 'marker without source/ should still be corrupted');

const readyDir = path.join(tmpRoot, 'ready-test');
fs.mkdirSync(path.join(readyDir, 'source'), {recursive: true});
fs.writeFileSync(path.join(readyDir, 'source', 'info.dry'), 'title: Test\nauthor: Test');
catalog.writeMarker(readyDir, {id: 'ready-test'});
assert(catalog.checkTemplateStatus(tmpRoot, 'ready-test') === 'ready', 'directory with marker and source should be ready');

// --- Marker read/write ---

const marker = catalog.readMarker(readyDir);
assert(marker && marker.id === 'ready-test', 'readMarker should return written marker data');
assert(marker.installedAt, 'marker should have installedAt timestamp');

// --- snapshotSourceFiles ---

const snapshot = catalog.snapshotSourceFiles(readyDir);
assert(Array.isArray(snapshot), 'snapshotSourceFiles should return an array');
assert(snapshot.length === 1, 'readyDir should have 1 source file');
assert(snapshot[0].rel === 'source/info.dry', 'snapshot should track source/info.dry');
assert(snapshot[0].size > 0, 'snapshot file should have positive size');
assert(typeof snapshot[0].mtimeMs === 'number', 'snapshot should record mtime');
assert(typeof snapshot[0].sha256 === 'string' && snapshot[0].sha256.length === 64, 'snapshot should include sha256 hash');

// --- detectLocalEdits (no snapshot in marker) ---

const noSnapshotEdits = catalog.detectLocalEdits(readyDir);
assert(!noSnapshotEdits.hasEdits, 'marker without snapshot should report no edits');
assert(noSnapshotEdits.reason === 'no-snapshot', 'should indicate missing snapshot');

// Rewrite marker with snapshot for subsequent tests
catalog.writeMarker(readyDir, {id: 'ready-test', fileSnapshot: snapshot});

// --- detectLocalEdits (clean) ---

const cleanEdits = catalog.detectLocalEdits(readyDir);
assert(!cleanEdits.hasEdits, 'clean install should have no local edits');

// --- detectLocalEdits (same content rewritten — hash unchanged) ---

fs.writeFileSync(path.join(readyDir, 'source', 'info.dry'), 'title: Test\nauthor: Test');
const sameContentEdits = catalog.detectLocalEdits(readyDir);
assert(!sameContentEdits.hasEdits, 'rewriting same content should report no edits (hash-based)');

// --- detectLocalEdits (backward compat — old marker without sha256) ---

const freshSnap = catalog.snapshotSourceFiles(readyDir);
const legacySnapshot = freshSnap.map(function (e) { return {rel: e.rel, size: e.size, mtimeMs: e.mtimeMs}; });
catalog.writeMarker(readyDir, {id: 'ready-test', fileSnapshot: legacySnapshot});
const legacyClean = catalog.detectLocalEdits(readyDir);
assert(!legacyClean.hasEdits, 'legacy snapshot without sha256 should detect clean via size+mtime fallback');
catalog.writeMarker(readyDir, {id: 'ready-test', fileSnapshot: snapshot});

// --- detectLocalEdits (modified + added) ---

fs.writeFileSync(path.join(readyDir, 'source', 'info.dry'), 'title: Modified\nauthor: Test');
fs.writeFileSync(path.join(readyDir, 'source', 'new_scene.dry'), 'title: New Scene');
const modifiedEdits = catalog.detectLocalEdits(readyDir);
assert(modifiedEdits.hasEdits, 'should detect local edits after modification');
assert(modifiedEdits.modified.length === 1, 'should detect 1 modified file');
assert(modifiedEdits.added.length === 1, 'should detect 1 added file');
assert(modifiedEdits.summary.length > 0, 'summary should be non-empty');

// --- backupModifiedFiles ---

const backupResult = catalog.backupModifiedFiles(readyDir, modifiedEdits);
assert(backupResult.ok, 'backupModifiedFiles should succeed');
assert(fs.existsSync(backupResult.backupDir), 'backup directory should exist');
assert(backupResult.fileCount === 2, 'should backup 2 files (1 modified + 1 added)');
assert(fs.existsSync(path.join(backupResult.backupDir, 'source', 'info.dry')), 'backup should contain modified file');
assert(fs.existsSync(path.join(backupResult.backupDir, 'source', 'new_scene.dry')), 'backup should contain added file');

const noEditsBackup = catalog.backupModifiedFiles(readyDir, {hasEdits: false});
assert(noEditsBackup.ok, 'backupModifiedFiles with no edits should succeed');
assert(noEditsBackup.backupDir === '', 'no-edits backup should have empty backupDir');

// cleanup backups
fs.rmSync(path.join(tmpRoot, '.backups'), {recursive: true, force: true});

// --- removeTemplate ---

const removeResult = catalog.removeTemplate(readyDir);
assert(removeResult.ok, 'removeTemplate should succeed for a valid template');
assert(!fs.existsSync(readyDir), 'removeTemplate should delete the directory');

const removeNonexistent = catalog.removeTemplate(path.join(tmpRoot, 'gone'));
assert(removeNonexistent.ok, 'removeTemplate on nonexistent dir should succeed');

const removeNoMarker = path.join(tmpRoot, 'no-marker');
fs.mkdirSync(removeNoMarker, {recursive: true});
fs.writeFileSync(path.join(removeNoMarker, 'file.txt'), 'data');
const removeNoMarkerResult = catalog.removeTemplate(removeNoMarker);
assert(!removeNoMarkerResult.ok, 'removeTemplate should reject directory without marker');

// --- loadTemplateIndex ---

const indexDir = path.join(tmpRoot, 'index-test');
fs.mkdirSync(indexDir, {recursive: true});
const noIndex = catalog.loadTemplateIndex(indexDir, false);
assert(!noIndex.ok, 'loadTemplateIndex should fail when no index file exists');

fs.writeFileSync(path.join(indexDir, 'project-index.json'), JSON.stringify({
  schemaVersion: '0.1',
  project: {name: 'Test Game', root: indexDir},
  scenes: [],
  edges: [],
  variables: [],
  semantic: {},
  summary: {sceneCount: 0}
}));
const withIndex = catalog.loadTemplateIndex(indexDir, false);
assert(withIndex.ok, 'loadTemplateIndex should succeed when project-index.json exists');
assert(withIndex.index.project.name === 'Test Game', 'loaded index should contain expected project name');

// --- studio_core catalog wrappers ---

const prepareReady = core.prepareCatalogTemplate({
  templatesRoot: tmpRoot,
  template: evaluated.templates[0]
});
assert(prepareReady.ok || prepareReady.needsDownload, 'prepareCatalogTemplate should return ok or needsDownload');
assert(prepareReady.id === 'showcase-game', 'prepareCatalogTemplate should carry template id');

const prepareNoTemplate = core.prepareCatalogTemplate({templatesRoot: tmpRoot});
assert(!prepareNoTemplate.ok, 'prepareCatalogTemplate without template should fail');

const loadNoDir = core.loadCatalogTemplateIndex({});
assert(!loadNoDir.ok, 'loadCatalogTemplateIndex without installDir should fail');

// --- compareVersions ---

assert(catalog.compareVersions('0.98.0', '0.98.0') === 0, 'equal versions');
assert(catalog.compareVersions('0.97.0', '0.98.0') < 0, 'lesser version');
assert(catalog.compareVersions('1.0.0', '0.98.0') > 0, 'greater version');

// --- resolveLocalizedText ---

assert(catalog.resolveLocalizedText('base', {'zh-Hant': '中文'}, 'zh-Hant') === '中文', 'exact locale match');
assert(catalog.resolveLocalizedText('base', {'zh-Hant': '中文'}, 'en') === 'base', 'fallback to base');
assert(catalog.resolveLocalizedText('base', null, 'en') === 'base', 'null map returns base');

// --- checkUpdateAvailable (offline, no network) ---

assert(typeof catalog.downloadAssets === 'function', 'downloadAssets should be exported');

const skipResult = catalog.downloadAssets({assetsAssetName: ''}, tmpRoot, {});
assert(typeof skipResult.then === 'function', 'downloadAssets should return a promise');

assert(typeof catalog.checkUpdateAvailable === 'function', 'checkUpdateAvailable should be exported');
assert(typeof catalog.fetchLatestReleaseTag === 'function', 'fetchLatestReleaseTag should be exported');
assert(typeof catalog.preflightCheck === 'function', 'preflightCheck should be exported');

const updateDir = path.join(tmpRoot, 'update-test');
fs.mkdirSync(path.join(updateDir, 'source'), {recursive: true});
fs.writeFileSync(path.join(updateDir, 'source', 'info.dry'), 'title: Update Test');
catalog.writeMarker(updateDir, {
  id: 'update-test',
  releaseTag: 'v1.0.0',
  installedAt: '2026-01-01T00:00:00.000Z'
});
const updateMarker = catalog.readMarker(updateDir);
assert(updateMarker.releaseTag === 'v1.0.0', 'marker should store releaseTag');
assert(updateMarker.installedAt, 'marker should store installedAt');

// --- checkDiskSpace ---

assert(typeof catalog.checkDiskSpace === 'function', 'checkDiskSpace should be exported');
catalog.checkDiskSpace(tmpRoot, 1);
let diskSpaceThrown = false;
try {
  catalog.checkDiskSpace(tmpRoot, Number.MAX_SAFE_INTEGER);
} catch (_e) {
  diskSpaceThrown = true;
}
if (typeof fs.statfsSync === 'function') {
  assert(diskSpaceThrown, 'checkDiskSpace should throw when space is insufficient');
}

const noMarkerUpdate = catalog.checkUpdateAvailable(tmpRoot, {id: 'nonexistent', repo: 'test/test'});
assert(typeof noMarkerUpdate.then === 'function', 'checkUpdateAvailable should return a promise');

noMarkerUpdate.then(function (noMarkerResult) {
  assert(!noMarkerResult.updateAvailable, 'checkUpdateAvailable without marker should return false');

  // --- downloadAssets skips when no asset name ---
  return catalog.downloadAssets({assetsAssetName: ''}, tmpRoot, {});
}).then(function (skipEmpty) {
  assert(skipEmpty.skipped === true, 'downloadAssets should skip when assetsAssetName is empty');

  return catalog.downloadAssets({}, tmpRoot, {});
}).then(function (skipUndefined) {
  assert(skipUndefined.skipped === true, 'downloadAssets should skip when assetsAssetName is undefined');

  // --- Cleanup ---
  fs.rmSync(tmpRoot, {recursive: true, force: true});

  console.log('PASS: template catalog model (' + 91 + ' assertions)');
}).catch(function (err) {
  fs.rmSync(tmpRoot, {recursive: true, force: true});
  process.stderr.write('FAIL: ' + (err && err.message ? err.message : String(err)) + '\n');
  process.exit(1);
});
