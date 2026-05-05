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
  ['03-design-existing-event-canvas', 'design-existing-event-canvas'],
  ['04-explore-existing-card-canvas', 'explore-existing-card-canvas'],
  ['05-template-news', 'template-news'],
  ['06-template-card', 'template-card'],
  ['07-template-surface', 'template-surface'],
  ['08-template-entry', 'template-entry'],
  ['09-template-play-surface', 'template-play-surface'],
  ['10-template-workspace-layout', 'template-workspace-layout'],
  ['11-template-sidebar-status', 'template-sidebar-status'],
  ['12-template-project', 'template-project'],
  ['13-template-variables', 'template-variables'],
  ['14-reload-event', 'reload-event'],
  ['15-reload-card', 'reload-card'],
  ['16-reload-surface', 'reload-surface'],
  ['17-reload-workspace-layout', 'reload-workspace-layout'],
  ['18-review-event', 'review-event'],
  ['19-review-existing', 'review-existing'],
  ['20-review-surface', 'review-surface'],
  ['21-review-workspace-layout', 'review-workspace-layout'],
  ['22-legacy-fallback', 'legacy-fallback']
];

function parseArgs(argv) {
  const args = {
    artifactDir: path.join(os.tmpdir(), 'dendry_mod_studio_qa', timestamp() + '-authoring-canvas'),
    chrome: process.env.CHROME_BIN || 'google-chrome',
    only: ''
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--artifact-dir' || arg === '--chrome' || arg === '--only') {
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
    '  --only <scenario>       Capture one scenario id.'
  ].join('\n');
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, {recursive: true});
  return dir;
}

function capture(chrome, url, filePath) {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--allow-file-access-from-files',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--window-size=1440,1000',
    '--virtual-time-budget=8000',
    '--screenshot=' + filePath,
    url
  ];
  const result = spawnSync(chrome, args, {encoding: 'utf8', timeout: 30000});
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
  const result = spawnSync(chrome, args, {encoding: 'utf8', timeout: 30000});
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error('Chrome DOM verification failed for ' + url + '\n' + (result.stderr || result.stdout || ''));
  }
  const dom = String(result.stdout || '');
  if (/<body\b[^>]*data-error="true"/.test(dom)) {
    throw new Error('Screenshot harness reported an error for ' + url + '\n' + dom.slice(0, 2000));
  }
  if (!/<body\b[^>]*data-ready="true"/.test(dom)) {
    throw new Error('Screenshot harness did not report ready for ' + url + '\n' + dom.slice(0, 2000));
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
    const size = capture(args.chrome, url, filePath);
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
