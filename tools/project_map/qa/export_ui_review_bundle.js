#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const {pathToFileURL} = require('url');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const VIEWER_DIR = path.join(REPO_ROOT, 'tools', 'project_map', 'viewer');
const HARNESS_FILE = path.join(REPO_ROOT, 'tools', 'project_map', 'qa', 'authoring_canvas_screenshot_harness.html');

const CREATE_SCENARIOS = [
  {
    name: 'create-event',
    scenario: 'event-inline-edit',
    template: 'event',
    workspace: 'content',
    title: 'Create: World Event',
    values: {
      'event.title': 'Player-facing event title',
      'event.intro': 'The event body is edited directly in the Canvas.'
    }
  },
  {
    name: 'create-news',
    scenario: 'template-news',
    template: 'news',
    workspace: 'content',
    title: 'Create: News',
    values: {
      'news.headline': 'Canvas headline'
    }
  },
  {
    name: 'create-card',
    scenario: 'template-card',
    template: 'card',
    workspace: 'content',
    title: 'Create: Card',
    values: {
      'card.title': 'Canvas Action Card',
      'card.option.0.label': 'Use the Canvas card'
    }
  },
  {
    name: 'create-surface-text',
    scenario: 'template-surface',
    template: 'surface',
    workspace: 'content',
    title: 'Create: Surface Text',
    values: {
      'surface.replacementLabel': 'Canvas replacement text'
    }
  },
  {
    name: 'create-entry',
    scenario: 'template-entry',
    template: 'entry',
    workspace: 'system_ui',
    title: 'Create: Entry & Sidebar',
    values: {
      'entry.rootTitle': 'Canvas Start'
    }
  },
  {
    name: 'create-play-surface',
    scenario: 'template-play-surface',
    template: 'play_surface',
    workspace: 'system_ui',
    title: 'Create: Play Surface',
    values: {
      'play.title': 'Canvas Playable Surface'
    }
  },
  {
    name: 'create-workspace-layout',
    scenario: 'template-workspace-layout',
    template: 'workspace_layout',
    workspace: 'system_ui',
    title: 'Create: Workspace Layout',
    values: {
      'layout.deckTitle': 'Canvas Policy Deck'
    }
  },
  {
    name: 'create-sidebar-status',
    scenario: 'template-sidebar-status',
    template: 'sidebar_status',
    workspace: 'system_ui',
    title: 'Create: Sidebar Status',
    values: {
      'sidebar.sectionHeading': 'Review Status Section'
    }
  },
  {
    name: 'create-project',
    scenario: 'template-project',
    template: 'project',
    workspace: 'system_ui',
    title: 'Create: Game Info',
    values: {
      'project.gameTitle': 'Canvas Project Title'
    }
  },
  {
    name: 'create-variables',
    scenario: 'template-variables',
    template: 'variables',
    workspace: 'project_state',
    title: 'Create: Variables',
    values: {
      'variables.label': 'Canvas Variable'
    }
  }
];

function parseArgs(argv) {
  const args = {
    surface: 'create',
    outDir: path.join(os.tmpdir(), 'dms-ui-review-create'),
    chrome: process.env.CHROME_BIN || 'google-chrome',
    only: '',
    screenshotWidth: 1440,
    screenshotHeight: 2200,
    skipScreenshots: false,
    skipSnapshots: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--surface' || arg === '--out' || arg === '--chrome' || arg === '--only' || arg === '--scenario' || arg === '--screenshot-height' || arg === '--screenshot-width') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(arg + ' requires a value.');
      }
      index += 1;
      if (arg === '--surface') {
        args.surface = value;
      } else if (arg === '--out') {
        args.outDir = path.resolve(value);
      } else if (arg === '--chrome') {
        args.chrome = value;
      } else if (arg === '--screenshot-height') {
        args.screenshotHeight = positiveInteger(value, arg);
      } else if (arg === '--screenshot-width') {
        args.screenshotWidth = positiveInteger(value, arg);
      } else {
        args.only = value;
      }
      continue;
    }
    if (arg === '--skip-screenshots') {
      args.skipScreenshots = true;
      continue;
    }
    if (arg === '--skip-snapshots') {
      args.skipSnapshots = true;
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
    'Usage: node tools/project_map/qa/export_ui_review_bundle.js [options]',
    '',
    'Options:',
    '  --surface create        UI surface to export. Currently only create is supported.',
    '  --out <path>            Output directory. Defaults to /tmp/dms-ui-review-create.',
    '  --chrome <path>         Chrome/Chromium binary. Defaults to google-chrome.',
    '  --only <filter>         Export scenarios whose name/template/scenario contains the filter.',
    '  --scenario <filter>     Alias for --only.',
    '  --screenshot-width N    Screenshot viewport width. Defaults to 1440.',
    '  --screenshot-height N   Screenshot viewport height. Defaults to 2200 for bottom content.',
    '  --skip-screenshots      Do not capture PNG files.',
    '  --skip-snapshots        Do not capture rendered HTML snapshots.'
  ].join('\n');
}

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(label + ' must be a positive integer.');
  }
  return parsed;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, {recursive: true});
  return dir;
}

function copyViewerStyles(outDir) {
  const assetDir = ensureDir(path.join(outDir, 'assets', 'viewer'));
  fs.copyFileSync(path.join(VIEWER_DIR, 'styles.css'), path.join(assetDir, 'styles.css'));
  fs.cpSync(path.join(VIEWER_DIR, 'styles'), path.join(assetDir, 'styles'), {recursive: true});
}

function matchingScenarios(args) {
  if (args.surface !== 'create') {
    throw new Error('Unsupported --surface ' + args.surface + '; currently supported: create.');
  }
  const filter = String(args.only || '').trim().toLowerCase();
  if (!filter) {
    return CREATE_SCENARIOS;
  }
  return CREATE_SCENARIOS.filter((item) => {
    return [item.name, item.scenario, item.template, item.workspace, item.title]
      .some((value) => String(value || '').toLowerCase().includes(filter));
  });
}

function harnessUrlFor(scenario, options) {
  const params = new URLSearchParams({scenario});
  if (options && options.exportSnapshot) {
    params.set('exportSnapshot', '1');
  }
  return pathToFileURL(HARNESS_FILE).href + '?' + params.toString();
}

function captureScreenshot(chrome, scenario, filePath, options) {
  const chromeArgs = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--allow-file-access-from-files',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--window-size=' + options.screenshotWidth + ',' + options.screenshotHeight,
    '--virtual-time-budget=8000',
    '--screenshot=' + filePath,
    harnessUrlFor(scenario.scenario)
  ];
  const result = runChrome(chrome, chromeArgs, 30000);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error('Chrome screenshot failed for ' + scenario.name + '\n' + (result.stderr || result.stdout || ''));
  }
  const stat = fs.statSync(filePath);
  if (stat.size < 10000) {
    throw new Error('Screenshot is unexpectedly small: ' + filePath + ' (' + stat.size + ' bytes)');
  }
  verifyHarnessReady(chrome, scenario);
  return stat.size;
}

function verifyHarnessReady(chrome, scenario) {
  const result = runChrome(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--allow-file-access-from-files',
    '--disable-dev-shm-usage',
    '--virtual-time-budget=8000',
    '--dump-dom',
    harnessUrlFor(scenario.scenario)
  ], 30000);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error('Chrome DOM verification failed for ' + scenario.name + '\n' + (result.stderr || result.stdout || ''));
  }
  const dom = String(result.stdout || '');
  if (/<body\b[^>]*data-error="true"/.test(dom)) {
    throw new Error('Screenshot harness reported an error for ' + scenario.name + '\n' + dom.slice(0, 5000));
  }
  if (!/<body\b[^>]*data-ready="true"/.test(dom)) {
    throw new Error('Screenshot harness did not report ready for ' + scenario.name + '\n' + dom.slice(0, 5000));
  }
}

function captureSnapshot(chrome, scenario, filePath) {
  const result = runChrome(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--allow-file-access-from-files',
    '--disable-dev-shm-usage',
    '--virtual-time-budget=10000',
    '--dump-dom',
    harnessUrlFor(scenario.scenario, {exportSnapshot: true})
  ], 30000);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error('Chrome snapshot extraction failed for ' + scenario.name + '\n' + (result.stderr || result.stdout || ''));
  }
  const dom = String(result.stdout || '');
  const payloadText = extractElementText(dom, 'harness-snapshot-payload');
  if (!payloadText) {
    throw new Error(
      'Snapshot harness returned an empty payload for ' + scenario.name + '.\n' +
      'DOM excerpt:\n' + dom.slice(0, 5000)
    );
  }
  const payload = parseSnapshotPayload(payloadText, scenario);
  const snapshot = renderSnapshotHtml(scenario, payload);
  if (!snapshot.includes('data-object-authoring-canvas')) {
    throw new Error(
      'Rendered snapshot did not include the object authoring canvas for ' + scenario.name + '.\n' +
      'Snapshot excerpt:\n' + String(snapshot || payloadText || dom).slice(0, 2000)
    );
  }
  fs.writeFileSync(filePath, snapshot, 'utf8');
  return Buffer.byteLength(snapshot, 'utf8');
}

function writeFixture(outDir, scenario) {
  const fixture = {
    fixtureKind: 'dms-ui-review-scenario',
    surface: 'create',
    name: scenario.name,
    scenario: scenario.scenario,
    template: scenario.template,
    workspace: scenario.workspace,
    title: scenario.title,
    values: scenario.values,
    interfaceNotes: {
      templateButton: '[data-create-template="' + scenario.template + '"]',
      createModeButton: '[data-mode="create"]',
      objectCanvas: '[data-object-authoring-canvas]',
      editableFields: '[data-object-canvas-field]',
      reviewAction: '[data-object-canvas-action="review"]',
      saveAction: '[data-object-canvas-action="save"]'
    }
  };
  const filePath = path.join(outDir, 'fixtures', scenario.name + '.json');
  fs.writeFileSync(filePath, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
  return filePath;
}

function writeContract(outDir, scenarios) {
  const lines = [
    '# DMS UI Review Bundle Contract',
    '',
    'This bundle is a thin rendered frontend export for UI review. It is not a standalone Studio fork.',
    '',
    '## Scope',
    '',
    '- Surface: Create / Authoring Studio.',
    '- Source renderer: `tools/project_map/qa/authoring_canvas_screenshot_harness.html`.',
    '- The screenshots and snapshots use fixture data, not a live project checkout.',
    '- The snapshots intentionally include rendered DOM and CSS only; parser, desktop IPC, install apply, and runtime preview implementation details are outside this bundle.',
    '',
    '## Stable UI Interfaces',
    '',
    '- Mode switch: `[data-mode="create"]`.',
    '- Template switch: `[data-create-template]` with values such as `event`, `news`, `card`, `entry`, `project`, and `variables`.',
    '- Workspace switch: `[data-authoring-workspace]`.',
    '- Main rendered canvas: `[data-object-authoring-canvas]`.',
    '- Field controls: `[data-object-canvas-field]`.',
    '- Preview surface: `[data-object-canvas-preview]` and template-specific preview markers.',
    '- Primary canvas actions: `[data-object-canvas-action="save"]`, `[data-object-canvas-action="review"]`, `[data-object-canvas-action="toggle_overlay"]`.',
    '- Saved changes panel: `.draft-workspace-panel`.',
    '',
    '## Exported Scenarios',
    '',
    ...scenarios.map((scenario) => '- `' + scenario.name + '` -> template `' + scenario.template + '`, harness scenario `' + scenario.scenario + '`.'),
    '',
    '## Review Guidance',
    '',
    '- Prefer changing information architecture, density, grouping, labels, field hierarchy, and preview placement first.',
    '- Treat hidden parser/install/runtime behavior as fixed unless the UI change needs a new interface.',
    '- If a redesign needs data that is absent from the fixture JSON, add it to the fixture contract before touching the full app path.'
  ];
  fs.writeFileSync(path.join(outDir, 'contract.md'), lines.join('\n') + '\n', 'utf8');
}

function writeGallery(outDir, manifest) {
  const cards = manifest.scenarios.map((scenario) => {
    const screenshot = scenario.screenshot ? path.relative(outDir, scenario.screenshot).split(path.sep).join('/') : '';
    const snapshot = scenario.snapshot ? path.relative(outDir, scenario.snapshot).split(path.sep).join('/') : '';
    const fixture = scenario.fixture ? path.relative(outDir, scenario.fixture).split(path.sep).join('/') : '';
    return [
      '<article class="scenario-card">',
      '<a href="' + escapeAttr(snapshot || screenshot || fixture) + '">',
      screenshot ? '<img src="' + escapeAttr(screenshot) + '" alt="' + escapeAttr(scenario.title) + '">' : '<div class="placeholder">No screenshot</div>',
      '</a>',
      '<div class="scenario-copy">',
      '<p>' + escapeHtml(scenario.workspace) + ' / ' + escapeHtml(scenario.template) + '</p>',
      '<h2>' + escapeHtml(scenario.title) + '</h2>',
      '<div class="scenario-links">',
      snapshot ? '<a href="' + escapeAttr(snapshot) + '">Rendered HTML</a>' : '',
      screenshot ? '<a href="' + escapeAttr(screenshot) + '">PNG</a>' : '',
      fixture ? '<a href="' + escapeAttr(fixture) + '">Fixture</a>' : '',
      '</div>',
      '</div>',
      '</article>'
    ].join('\n');
  }).join('\n');
  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>DMS UI Review Bundle</title>',
    '<style>',
    'body{margin:0;background:#f4f2ec;color:#1f2933;font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
    'header{padding:24px 28px 12px;border-bottom:1px solid rgba(25,30,40,.12);background:#fff}',
    'header p{max-width:760px;color:#52606d}',
    '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;padding:22px 28px 32px}',
    '.scenario-card{border:1px solid rgba(25,30,40,.14);border-radius:8px;background:#fff;overflow:hidden;box-shadow:0 8px 24px rgba(25,30,40,.08)}',
    '.scenario-card img{display:block;width:100%;height:auto;max-height:680px;object-fit:contain;object-position:top left;background:#eee}',
    '.scenario-copy{padding:14px 16px 16px}',
    '.scenario-copy p{margin:0 0 4px;color:#667085;font-size:12px;text-transform:uppercase;letter-spacing:.04em}',
    '.scenario-copy h2{margin:0 0 12px;font-size:18px}',
    '.scenario-links{display:flex;flex-wrap:wrap;gap:10px}',
    '.scenario-links a{color:#185abc;text-decoration:none;font-weight:600}',
    '.placeholder{display:grid;place-items:center;aspect-ratio:1.44;background:#ebe7dd;color:#667085}',
    '</style>',
    '</head>',
    '<body>',
    '<header>',
    '<h1>DMS UI Review Bundle</h1>',
    '<p>Rendered Create-mode snapshots for focused UI review. Use screenshots for quick critique, rendered HTML for DOM/CSS inspection, and fixture JSON for the thin interface contract.</p>',
    '<p><a href="contract.md">Read the interface contract</a> · <a href="manifest.json">Open manifest</a></p>',
    '</header>',
    '<main class="grid">',
    cards,
    '</main>',
    '</body>',
    '</html>'
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'index.html'), html + '\n', 'utf8');
}

function runChrome(chrome, args, timeout) {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-ui-review-chrome-'));
  try {
    return spawnSync(chrome, args.concat(['--user-data-dir=' + profileDir]), {encoding: 'utf8', timeout});
  } finally {
    fs.rmSync(profileDir, {recursive: true, force: true});
  }
}

function renderSnapshotHtml(scenario, payload) {
  const pieces = Array.isArray(payload.pieces) ? payload.pieces : [];
  const meta = Object.assign({}, payload.meta || {}, {scenario});
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + escapeHtml(scenario.title) + '</title>',
    '<link rel="stylesheet" href="../assets/viewer/styles.css">',
    '<style>',
    'body{margin:0;background:#f4f2ec}.ui-review-shell{min-height:100vh}.ui-review-meta{padding:12px 16px;border-bottom:1px solid rgba(25,30,40,.12);background:#fff}.ui-review-meta code{font-size:12px}.ui-review-focus{padding:16px}',
    '</style>',
    '</head>',
    '<body data-studio-surface="direction-b" data-mode="create">',
    '<div class="ui-review-shell">',
    '<section class="ui-review-meta"><strong>DMS UI Review Snapshot</strong><br><code>' +
      escapeHtml(scenario.name) + ' / ' + escapeHtml(scenario.template) + '</code></section>',
    '<main id="create-pane" class="create-workspace mode-pane" aria-live="polite">',
    pieces.join('\n'),
    '</main>',
    '<script type="application/json" id="dms-ui-review-metadata">' + escapeHtml(JSON.stringify(meta, null, 2)) + '</script>',
    '</div>',
    '</body>',
    '</html>'
  ].join('\n') + '\n';
}

function parseSnapshotPayload(payloadText, scenario) {
  if (!payloadText) {
    throw new Error('Snapshot extractor returned an empty payload for ' + scenario.name + '.');
  }
  try {
    const payload = JSON.parse(payloadText);
    if (!payload || !Array.isArray(payload.pieces)) {
      throw new Error('missing pieces array');
    }
    return payload;
  } catch (err) {
    throw new Error(
      'Snapshot extractor returned invalid JSON for ' + scenario.name + ': ' + err.message + '\n' +
      payloadText.slice(0, 2000)
    );
  }
}

function extractElementText(dom, id) {
  const regex = new RegExp(`<(?:textarea|pre)[^>]*id=["']${escapeRegExp(id)}["'][^>]*>([\\s\\S]*?)<\\/(?:textarea|pre)>`);
  const match = regex.exec(dom);
  return match ? decodeHtml(match[1]) : '';
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage() + '\n');
    return;
  }
  const scenarios = matchingScenarios(args);
  if (!scenarios.length) {
    throw new Error('No matching scenarios for --only ' + args.only);
  }
  ensureDir(args.outDir);
  ensureDir(path.join(args.outDir, 'screenshots'));
  ensureDir(path.join(args.outDir, 'snapshots'));
  ensureDir(path.join(args.outDir, 'fixtures'));
  copyViewerStyles(args.outDir);

  const records = [];
  for (const scenario of scenarios) {
    const record = Object.assign({}, scenario);
    record.fixture = writeFixture(args.outDir, scenario);
    if (!args.skipScreenshots) {
      record.screenshot = path.join(args.outDir, 'screenshots', scenario.name + '.png');
      record.screenshotBytes = captureScreenshot(args.chrome, scenario, record.screenshot, args);
      process.stdout.write('screenshot ' + scenario.name + ' -> ' + record.screenshot + '\n');
    }
    if (!args.skipSnapshots) {
      record.snapshot = path.join(args.outDir, 'snapshots', scenario.name + '.html');
      record.snapshotBytes = captureSnapshot(args.chrome, scenario, record.snapshot);
      process.stdout.write('snapshot ' + scenario.name + ' -> ' + record.snapshot + '\n');
    }
    records.push(record);
  }

  const manifest = {
    ok: true,
    bundleKind: 'dms-ui-review-bundle',
    surface: args.surface,
    generatedAt: new Date().toISOString(),
    screenshotViewport: {
      width: args.screenshotWidth,
      height: args.screenshotHeight
    },
    sourceHarness: HARNESS_FILE,
    scenarios: records
  };
  fs.writeFileSync(path.join(args.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  writeContract(args.outDir, scenarios);
  writeGallery(args.outDir, manifest);
  process.stdout.write('bundle ' + args.outDir + '\n');
}

main().catch((err) => {
  process.stderr.write((err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
