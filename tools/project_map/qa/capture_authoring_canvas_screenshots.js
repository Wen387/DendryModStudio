#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const {pathToFileURL} = require('url');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const HARNESS_FILE = path.join(REPO_ROOT, 'tools', 'project_map', 'qa', 'authoring_canvas_screenshot_harness.html');
const DEFAULT_SCENARIOS = [
  ['01-create-unified-canvas', 'create-unified-canvas'],
  ['02-event-inline-edit', 'event-inline-edit'],
  ['03-content-pan', 'content-pan'],
  ['04-content-node-drag', 'content-node-drag'],
  ['05-content-create-branch', 'content-create-branch'],
  ['05b-content-create-related-card', 'content-create-related-card'],
  ['05c-content-create-related-news', 'content-create-related-news'],
  ['05d-content-advanced-form', 'content-advanced-form'],
  ['06-content-editor-overlay', 'content-editor-overlay'],
  ['07-content-chain-view', 'content-chain-view'],
  ['08-content-chain-branch', 'content-chain-branch'],
  ['09-system-ui-live-edit', 'system-ui-live-edit'],
  ['10-design-existing-event-canvas', 'design-existing-event-canvas'],
  ['11-explore-existing-card-canvas', 'explore-existing-card-canvas'],
  ['12-template-news', 'template-news'],
  ['13-template-card', 'template-card'],
  ['14-template-surface', 'template-surface'],
  ['15-template-entry', 'template-entry'],
  ['16-template-play-surface', 'template-play-surface'],
  ['17-template-workspace-layout', 'template-workspace-layout'],
  ['18-template-sidebar-status', 'template-sidebar-status'],
  ['19-template-project', 'template-project'],
  ['20-template-variables', 'template-variables'],
  ['21-reload-event', 'reload-event'],
  ['22-reload-card', 'reload-card'],
  ['23-reload-surface', 'reload-surface'],
  ['24-reload-workspace-layout', 'reload-workspace-layout'],
  ['25-review-event', 'review-event'],
  ['26-review-existing', 'review-existing'],
  ['27-review-surface', 'review-surface'],
  ['28-review-workspace-layout', 'review-workspace-layout'],
  ['29-legacy-fallback', 'legacy-fallback'],
  ['30-content-timeline-turn', 'content-timeline-turn'],
  ['31-content-timeline-phase', 'content-timeline-phase'],
  ['32-content-timeline-source-order', 'content-timeline-source-order'],
  ['33-content-zoomed-out', 'content-zoomed-out'],
  ['34-content-zoomed-in-drag', 'content-zoomed-in-drag'],
  ['35-content-zoom-fit', 'content-zoom-fit'],
  ['36-system-ui-game-info-header', 'system-ui-game-info-header'],
  ['37-content-wheel-zoom', 'content-wheel-zoom'],
  ['38-content-global-context', 'content-global-context'],
  ['39-content-create-from-lane', 'content-create-from-lane'],
  ['40-content-chain-evidence', 'content-chain-evidence'],
  ['41-content-editor-dock-restore', 'content-editor-dock-restore'],
  ['42-content-narrow', 'content-narrow'],
  ['43-system-ui-shared-screen', 'system-ui-shared-screen'],
  ['44-system-ui-main-options', 'system-ui-main-options'],
  ['45-system-ui-interactive-objects', 'system-ui-interactive-objects'],
  ['46-system-ui-layout-frame', 'system-ui-layout-frame'],
  ['47-system-ui-status-heavy', 'system-ui-status-heavy'],
  ['48-system-ui-editor-overlay', 'system-ui-editor-overlay'],
  ['49-system-ui-reload-context', 'system-ui-reload-context'],
  ['50-review-system-ui-entry', 'review-system-ui-entry'],
  ['51-review-system-ui-project', 'review-system-ui-project'],
  ['52-review-system-ui-play-surface', 'review-system-ui-play-surface'],
  ['53-review-system-ui-sidebar-status', 'review-system-ui-sidebar-status'],
  ['54-system-ui-narrow', 'system-ui-narrow'],
  ['55-story-scope-window', 'content-story-scope-window'],
  ['56-story-scope-expanded', 'content-story-scope-expanded'],
  ['57-story-chain-depth-connectors', 'content-chain-depth-connectors'],
  ['58-story-card-select-existing', 'content-story-card-select-existing'],
  ['59-story-context-reload', 'content-story-context-reload'],
  ['60-story-player-card-face', 'content-story-player-card-face'],
  ['61-story-palette-closed', 'content-story-palette-closed'],
  ['62-story-palette-open-timeline', 'content-story-palette-open-timeline'],
  ['63-story-palette-search-filter', 'content-story-palette-search-filter'],
  ['64-story-palette-unplaced', 'content-story-palette-unplaced'],
  ['65-story-palette-drop-canvas', 'content-story-palette-drop-canvas'],
  ['66-story-palette-drop-lane', 'content-story-palette-drop-lane'],
  ['67-story-palette-open-chain', 'content-story-palette-open-chain'],
  ['68-story-palette-drop-chain-gap', 'content-story-palette-drop-chain-gap'],
  ['69-story-palette-draft-restore', 'content-story-palette-draft-restore'],
  ['70-story-palette-unsupported-drop', 'content-story-palette-unsupported-drop'],
  ['71-story-palette-reload-context', 'content-story-palette-reload-context'],
  ['72-story-palette-review-context', 'content-story-palette-review-context'],
  ['73-story-palette-narrow', 'content-story-palette-narrow'],
  ['74-card-board-open', 'card-board-open'],
  ['75-card-board-lanes', 'card-board-lanes'],
  ['76-card-board-pool', 'card-board-pool'],
  ['77-card-board-filter', 'card-board-filter'],
  ['78-card-board-select-existing', 'card-board-select-existing'],
  ['79-card-board-edit-preview', 'card-board-edit-preview'],
  ['80-card-board-create-deck', 'card-board-create-deck'],
  ['81-card-board-drop-deck', 'card-board-drop-deck'],
  ['82-card-board-create-advisor', 'card-board-create-advisor'],
  ['83-card-board-unwired', 'card-board-unwired'],
  ['84-card-board-reload-context', 'card-board-reload-context'],
  ['85-card-board-system-deeplink', 'card-board-system-deeplink'],
  ['86-review-card-board', 'review-card-board'],
  ['87-card-board-narrow', 'card-board-narrow'],
  ['88-card-board-template-switch', 'card-board-template-switch'],
  ['89-card-board-route-inspector', 'card-board-route-inspector'],
  ['90-card-board-option-inspector', 'card-board-option-inspector'],
  ['91-card-board-lane-inspector', 'card-board-lane-inspector'],
  ['92-card-board-duplicate-draft', 'card-board-duplicate-draft'],
  ['93-card-board-intent-action', 'card-board-intent-action'],
  ['94-content-runtime-lens-ready', 'content-runtime-lens-ready'],
  ['95-content-runtime-lens-expanded', 'content-runtime-lens-expanded'],
  ['96-content-runtime-lens-browser', 'content-runtime-lens-browser'],
  ['97-system-ui-runtime-lens-ready', 'system-ui-runtime-lens-ready'],
  ['98-system-ui-runtime-lens-expanded', 'system-ui-runtime-lens-expanded'],
  ['99-card-board-runtime-lens-card', 'card-board-runtime-lens-card'],
  ['100-card-board-runtime-lens-option', 'card-board-runtime-lens-option'],
  ['101-card-board-runtime-lens-advisor', 'card-board-runtime-lens-advisor'],
  ['102-content-runtime-lens-stale', 'content-runtime-lens-stale'],
  ['103-content-runtime-lens-failure', 'content-runtime-lens-failure'],
  ['104-change-tray-open', 'change-tray-open'],
  ['105-lightweight-preview-event', 'lightweight-preview-event'],
  ['106-lightweight-preview-card', 'lightweight-preview-card'],
  ['107-card-board-existing-template-stay', 'card-board-existing-template-stay'],
  ['108-preview-object-editor-event', 'preview-object-editor-event'],
  ['109-preview-object-editor-news', 'preview-object-editor-news'],
  ['110-preview-object-editor-card-existing', 'preview-object-editor-card-existing'],
  ['111-preview-object-editor-text-replacement', 'preview-object-editor-text-replacement'],
  ['112-preview-object-editor-hardening-event-save', 'preview-object-editor-hardening-event-save'],
  ['113-preview-object-editor-hardening-news-review', 'preview-object-editor-hardening-news-review'],
  ['114-preview-object-editor-hardening-card-existing', 'preview-object-editor-hardening-card-existing'],
  ['115-preview-object-editor-hardening-text-review', 'preview-object-editor-hardening-text-review'],
  ['116-preview-object-editor-event-scrolled', 'preview-object-editor-event-scrolled']
];

function parseArgs(argv) {
  const args = {
    artifactDir: path.join(os.tmpdir(), 'dendry_mod_studio_qa', timestamp() + '-authoring-canvas'),
    chrome: process.env.CHROME_BIN || 'google-chrome',
    only: ''
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--artifact-dir' || arg === '--chrome' || arg === '--only' || arg === '--scenario') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(arg + ' requires a value.');
      }
      index += 1;
      if (arg === '--artifact-dir') {
        args.artifactDir = path.resolve(value);
      } else if (arg === '--chrome') {
        args.chrome = value;
      } else {
        args.only = value;
      }
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    throw new Error('Unknown argument: ' + arg);
  }
  return args;
}

function usage() {
  return [
    'Usage: node tools/project_map/qa/capture_authoring_canvas_screenshots.js [options]',
    '',
    'Options:',
    '  --artifact-dir <path>   Directory for PNG screenshots and manifest.',
    '  --chrome <path>         Chrome/Chromium binary. Defaults to google-chrome.',
    '  --only <scenario>       Capture one scenario id.',
    '  --scenario <scenario>   Alias for --only.'
  ].join('\n');
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, {recursive: true});
  return dir;
}

function capture(chrome, url, filePath, scenario) {
  const windowSize = scenario === 'content-narrow' || scenario === 'content-story-palette-narrow' || scenario === 'system-ui-narrow' || scenario === 'card-board-narrow' ? '430,1000' : '1440,1000';
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--allow-file-access-from-files',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--window-size=' + windowSize,
    '--virtual-time-budget=8000',
    '--screenshot=' + filePath,
    url
  ];
  const result = runChrome(chrome, args, 30000);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error('Chrome screenshot failed for ' + url + '\n' + (result.stderr || result.stdout || ''));
  }
  const stat = fs.statSync(filePath);
  if (stat.size < 10000) {
    throw new Error('Screenshot is unexpectedly small: ' + filePath + ' (' + stat.size + ' bytes)');
  }
  verifyHarnessDom(chrome, url);
  return stat.size;
}

function verifyHarnessDom(chrome, url) {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--allow-file-access-from-files',
    '--disable-dev-shm-usage',
    '--virtual-time-budget=8000',
    '--dump-dom',
    url
  ];
  const result = runChrome(chrome, args, 30000);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error('Chrome DOM verification failed for ' + url + '\n' + (result.stderr || result.stdout || ''));
  }
  const dom = String(result.stdout || '');
  if (/<body\b[^>]*data-error="true"/.test(dom)) {
    throw new Error('Screenshot harness reported an error for ' + url + '\n' + dom.slice(0, 5000));
  }
  if (!/<body\b[^>]*data-ready="true"/.test(dom)) {
    throw new Error('Screenshot harness did not report ready for ' + url + '\n' + dom.slice(0, 5000));
  }
}

function runChrome(chrome, args, timeout) {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-screenshot-chrome-'));
  try {
    return spawnSync(chrome, args.concat(['--user-data-dir=' + profileDir]), {encoding: 'utf8', timeout});
  } finally {
    fs.rmSync(profileDir, {recursive: true, force: true});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage() + '\n');
    return;
  }
  ensureDir(args.artifactDir);
  const manifest = [];
  const scenarios = args.only
    ? DEFAULT_SCENARIOS.filter(([, id]) => id === args.only || id.includes(args.only))
    : DEFAULT_SCENARIOS;
  if (!scenarios.length) {
    throw new Error('No matching scenarios for --only ' + args.only);
  }
  scenarios.forEach(([name, scenario]) => {
    const filePath = path.join(args.artifactDir, name + '.png');
    const url = pathToFileURL(HARNESS_FILE).href + '?scenario=' + encodeURIComponent(scenario);
    const size = capture(args.chrome, url, filePath, scenario);
    manifest.push({name, scenario, file: filePath, bytes: size});
    process.stdout.write('captured ' + name + ' -> ' + filePath + '\n');
  });
  const manifestPath = path.join(args.artifactDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    ok: true,
    generatedAt: new Date().toISOString(),
    harness: HARNESS_FILE,
    screenshots: manifest
  }, null, 2) + '\n', 'utf8');
  process.stdout.write('manifest ' + manifestPath + '\n');
}

main().catch((err) => {
  process.stderr.write((err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
