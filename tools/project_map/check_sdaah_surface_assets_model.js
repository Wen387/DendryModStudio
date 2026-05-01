#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const draftExtract = require('./authoring/draft_extract.js');

const ROOT = path.resolve(__dirname, '..', '..');
const SDAAH_ROOT = path.join(ROOT, 'social_democracy_alternate_history-main');
const BUILD_SCRIPT = path.join(__dirname, 'build_project_map.py');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

if (!fs.existsSync(path.join(SDAAH_ROOT, 'source', 'info.dry'))) {
  fail('SDAAH original fixture root is missing: ' + SDAAH_ROOT);
}

const out = path.join(os.tmpdir(), 'dendry_project_map', 'sdaah-surface-assets-check.json');
const result = spawnSync('python3', [
  BUILD_SCRIPT,
  '--root', SDAAH_ROOT,
  '--out', out,
  '--include-excerpts'
], {cwd: ROOT, encoding: 'utf8'});

if (result.status !== 0) {
  fail('SDAAH ProjectIndex build failed: ' + result.stderr);
}

const index = JSON.parse(fs.readFileSync(out, 'utf8'));
const semantic = index.semantic || {};
const assets = semantic.assets && semantic.assets.items || [];
const surfaceItems = semantic.surfaceText && semantic.surfaceText.items || [];
const surfaceLabels = surfaceItems.map((item) => String(item.label || ''));
const surfacePaths = surfaceItems.map((item) => String(item.source && item.source.path || ''));

assert(index.project && index.project.name === 'Social Democracy: An Alternate History', 'fixture should build the SDAAH original project');
assert(assets.length >= 40, 'SDAAH source asset references should be indexed even when files are absent from the checkout');
assert(assets.some((asset) => asset.path === 'img/portraits/MierendorffCarlo.jpg'), 'SDAAH advisor portrait references should be indexed');
assert(assets.some((asset) => asset.path === 'img/iron_front.png'), 'SDAAH card image references should be indexed');
assert(assets.some((asset) => asset.path === 'img/map_2.jpg'), 'SDAAH set-bg image references should be indexed');
assert(assets.some((asset) => asset.path === 'music/communist/A_las_barricadas.ogg'), 'SDAAH audio references should be indexed');
assert(assets.some((asset) => asset.fileExists === false), 'SDAAH missing checkout assets should be marked as missing physical files');
assert(assets.some((asset) => (asset.usageRefs || []).some((usage) => usage.id === 'mierendorff')), 'SDAAH asset references should keep usage breadcrumbs');
assert(
  assets.some((asset) => asset.path === 'img/map_2.jpg' && (asset.usageRefs || []).some((usage) => usage.role === 'set-bg')),
  'SDAAH set-bg image references should keep usage breadcrumbs'
);

assert(surfaceItems.length >= 24, 'SDAAH sidebar/header HTML surface text should be indexed');
['Library', 'Save/Load', 'Options', 'Main', 'Politics', 'Defense', 'Polls'].forEach((label) => {
  assert(surfaceLabels.includes(label), 'SDAAH surface text should include UI label: ' + label);
});
assert(surfacePaths.some((itemPath) => itemPath === 'out/html/index.html'), 'SDAAH surface text should include out/html/index.html evidence');
assert(
  surfaceItems.some((item) =>
    item.label === 'Resources available' &&
    item.variableName === 'resources' &&
    item.source &&
    item.source.path === 'source/scenes/status.scene.dry'
  ),
  'SDAAH source status labels should include editable English variable-backed UI text'
);

const openingText = surfaceItems.find((item) =>
  item.area === 'opening_text' &&
  String(item.label || '').startsWith('This is a game of alternate history.')
);
assert(openingText, 'SDAAH opening prose should be indexed as editable surface text');
assert(!String(openingText.label || '').includes('...'), 'source-backed opening prose labels should not be stored as truncated excerpts');
assert(
  String(openingText.label || '').includes('any divergence from actual events will necessarily have to involve some element of make-believe'),
  'source-backed opening prose labels should preserve the full source line'
);
assert(openingText.originalText === openingText.label, 'source-backed opening prose originalText should preserve the full source line');
const openingProposal = draftExtract.textReplacementDraftFromItem(index, 'surfaceText', openingText, {});
assert(openingProposal.ok, 'full opening prose should seed a text replacement proposal');
assert(openingProposal.draft.originalLabel === openingText.label, 'text replacement proposals should use the full original surface text');
assert(!openingProposal.draft.originalLabel.includes('...'), 'text replacement proposal originals should not be seeded from excerpts');

process.stdout.write(JSON.stringify({
  ok: true,
  assets: assets.length,
  surfaceText: surfaceItems.length
}, null, 2) + '\n');
