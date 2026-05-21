#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const desktopMixedApplyFlow = require('./desktop_mixed_apply_flow.js');

const QA_DIR = __dirname;
const PROJECT_MAP_DIR = path.resolve(QA_DIR, '..');
const REPO_ROOT = path.resolve(PROJECT_MAP_DIR, '..', '..');
const DESKTOP_DIR = path.join(PROJECT_MAP_DIR, 'desktop');
const DEFAULT_PROJECT_ROOT = path.join(PROJECT_MAP_DIR, 'fixtures', 'qa-mini');
const DEFAULT_WRONG_PROJECT_ROOT = path.join(PROJECT_MAP_DIR, 'fixtures', 'generic-mini');
const DEFAULT_DYNAMIC_PROJECT_ROOT = path.join(REPO_ROOT, 'SDAAHdynamic', 'dynamic_social_democracy-main');
const DEFAULT_ARTIFACT_ROOT = path.join(os.tmpdir(), 'dms-playtests');
const WELCOME_SURFACE_SELECTORS = ['#studio-welcome', '#studio-onboarding'];
const WELCOME_PRIMARY_SELECTORS = ['#welcome-primary', '#onboarding-primary'];

const SCENARIOS = {
  first_time_user: {
    title: 'First-time user creates, saves, reviews, and dry-runs a proposal.',
    run: scenarioFirstTimeUser,
    dialogRoots: ['projectRoot', 'wrongProjectRoot'],
    playerLike: [
      'opens Quick Start',
      'opens Tutorial Library',
      'loads a project through the Open Project button',
      'creates a World Event proposal',
      'saves it to My Changes',
      'reviews the install plan',
      'runs desktop dry-run',
      'switches project through the Open Project button and confirms wrong-project refusal'
    ],
    shortcuts: [
      'uses a deterministic test dialog adapter for native folder selection'
    ]
  },
  explore_design_existing_edit: {
    title: 'Player finds an existing event through Explore and Design, edits it, and dry-runs the guarded replacement.',
    run: scenarioExploreDesignExistingEdit,
    dialogRoots: ['projectRoot'],
    playerLike: [
      'opens a project through Quick Start',
      'searches Explore events',
      'inspects the same event in Design list view',
      'opens Edit existing from Design',
      'changes a source-backed page section',
      'saves the edit to My Changes',
      'reviews the guarded replacement',
      'runs desktop dry-run'
    ],
    shortcuts: [
      'uses a deterministic test dialog adapter for native folder selection'
    ]
  },
  desktop_mixed_apply_flow: Object.assign({}, desktopMixedApplyFlow.definition, {artifactBase: path.join(DEFAULT_ARTIFACT_ROOT, desktopMixedApplyFlow.definition.artifactSlug), run: (win, args, artifactDir, log) => desktopMixedApplyFlow.run(win, args, artifactDir, log, {ensureDir, expectVisible, click, waitForHidden, waitForProjectLoaded, screenshot, evalInPage, expectInstallOperationPath, statusSummary})}),
  content_storyboard_canvas_selection: {
    title: 'Player opens Create, clicks a Storyboard event card on Canvas, and gets the visible object editor.',
    run: scenarioContentStoryboardCanvasSelection,
    dialogRoots: ['projectRoot'],
    playerLike: [
      'opens a project through Quick Start',
      'opens Create / World Event Canvas',
      'clicks a source-backed Storyboard event card',
      'verifies the card becomes selected and opens the object editor modal'
    ],
    shortcuts: [
      'uses a deterministic test dialog adapter for native folder selection',
      'dispatches mouse-like pointer events in Electron instead of manual clicking'
    ]
  },
  draft_persistence_restart: {
    title: 'Player saves a draft, reloads Studio, reopens the draft, and dry-runs it.',
    run: scenarioDraftPersistenceRestart,
    dialogRoots: ['projectRoot', 'projectRoot'],
    playerLike: [
      'opens a project through Quick Start',
      'creates and saves a World Event draft',
      'reloads the Studio window with the same Electron user data',
      'opens the same project again through Open Project',
      'confirms My Changes persisted',
      'reopens the saved draft',
      'reviews the persisted install plan',
      'runs desktop dry-run'
    ],
    shortcuts: [
      'uses a deterministic test dialog adapter for native folder selection',
      'reloads the Studio renderer instead of relaunching a packaged app process'
    ]
  },
  load_bundled_demo_template: {
    title: 'Player starts from the bundled demo template and inspects how game content maps to Studio.',
    run: scenarioLoadBundledDemoTemplate,
    dialogRoots: [],
    playerLike: [
      'opens Quick Start',
      'loads the bundled demo template',
      'gets a writable app-data copy',
      'inspects the demo event in Explore',
      'checks its variables and conditions in Studio'
    ],
    shortcuts: [
      'uses the packaged starter template instead of a native folder picker'
    ]
  },
  justice_party_template_mod: {
    title: 'Player starts from the template and drafts a Justice Party mod with variables and both news paths.',
    run: scenarioJusticePartyTemplateMod,
    artifactBase: path.join(DEFAULT_ARTIFACT_ROOT, 'justice-party-template-mod'),
    dialogRoots: [],
    playerLike: [
      'loads the bundled demo template',
      'edits the start menu, sidebar, and first playable route through Entry & Sidebar',
      'uses the Create first event shortcut from Entry & Sidebar',
      'uses automatic variable recommendations to reuse template support state',
      'customizes the party affairs hand, starter deck, starter card, and advisor through Playable Surface',
      'adds a new media deck lane, first media briefing card, and sidebar category through Workspace Layout',
      'adds a routed party-affairs action card to the starter deck',
      'adds a routed advisor-like card to the starter hand',
      'creates a Justice Party campaign event proposal',
      'creates a traditional monthly-popup style news beat as a World Event',
      'creates an Island-style ticker news proposal through News Wizard',
      'saves each proposal to My Changes',
      'reviews and dry-runs traditional event/news and Island-style news install plans'
    ],
    shortcuts: [
      'uses the packaged starter template instead of a native folder picker',
      'uses deterministic DOM interaction in Electron instead of manual typing'
    ]
  },
  runtime_preview_entry_flow: {
    title: 'Runtime Preview opens the starter workspace, clicks an advisor card, and verifies sidebar state changes.',
    run: scenarioRuntimePreviewEntryFlow,
    artifactBase: path.join(DEFAULT_ARTIFACT_ROOT, 'runtime-preview-entry-flow'),
    dialogRoots: [],
    playerLike: [
      'starts from the bundled demo template',
      'creates a desktop Runtime Preview sandbox',
      'opens the modified game preview in a BrowserWindow',
      'clicks the root start option into the hand workspace',
      'clicks a player choice on an advisor-like card',
      'verifies the sidebar/status text changes after the choice'
    ],
    shortcuts: [
      'uses the packaged starter template and Electron DOM automation instead of manual clicking'
    ]
  },
  new_event_conditional_route_runtime_flow: {
    title: 'Runtime Preview opens a newly created conditional menu event through Focused Entry and verifies loop routes.',
    run: scenarioNewEventConditionalRouteRuntimeFlow,
    artifactBase: path.join(DEFAULT_ARTIFACT_ROOT, 'new-event-conditional-route-runtime-flow'),
    dialogRoots: [],
    playerLike: [
      'starts from the bundled demo template',
      'creates a Conditional Menu / Loop event through the shared Object Canvas draft pipeline',
      'builds a desktop Runtime Preview sandbox',
      'uses Focused Entry for the install-plan-created event scene',
      'clicks the root option into the follow-up menu',
      'clicks a section-owned option to its result and returns to the menu',
      'clicks the menu exit path and returns to the opening choice'
    ],
    shortcuts: [
      'uses the packaged starter template and Electron DOM automation for the temporary Runtime Preview'
    ]
  },
  route_understanding_workbench_flow: {
    title: 'Route Understanding Workbench renders event-chain, scheduler, utility, and manual-boundary context.',
    run: scenarioRouteUnderstandingWorkbenchFlow,
    artifactBase: path.join(DEFAULT_ARTIFACT_ROOT, 'route-understanding-workbench-flow'),
    dialogRoots: [],
    playerLike: [
      'opens the real Studio renderer',
      'loads a minimized complex route fixture in the browser-safe model layer',
      'renders the existing Route Map panel',
      'verifies event-chain, scheduler, utility call, and manual JS boundary context chips'
    ],
    shortcuts: [
      'uses a synthetic public fixture in renderer memory instead of copying private DynamicRepo content'
    ]
  },
  guided_route_edit_workbench_flow: {
    title: 'Guided Route Edit Workbench exposes utility-pair, route-table, and explicit-fallback editors.',
    run: scenarioGuidedRouteEditWorkbenchFlow,
    artifactBase: path.join(DEFAULT_ARTIFACT_ROOT, 'guided-route-edit-workbench-flow'),
    dialogRoots: [],
    playerLike: [
      'opens the real Studio renderer',
      'loads a minimized complex route fixture in the browser-safe model layer',
      'renders guided Route Map actions for utility pair, route table, and explicit fallback',
      'opens Semantic Logic model proposals for each guided edit and verifies replace_text operations'
    ],
    shortcuts: [
      'uses a synthetic public fixture in renderer memory instead of copying private DynamicRepo content'
    ]
  },
  dynamic_mod_smoke: {
    title: 'Player opens SDAAH Dynamic, audits existing editing, drafts new content, and dry-runs Dynamic-aware paths.',
    run: scenarioDynamicModSmoke,
    artifactBase: path.join(DEFAULT_ARTIFACT_ROOT, 'dynamic-mod-smoke'),
    dialogRoots: ['dynamicProjectRoot'],
    playerLike: [
      'opens a real SDAAH Dynamic checkout through Quick Start',
      'searches for a complex existing event',
      'edits source-backed existing event prose through the unified Object Canvas',
      'saves and reviews an existing_scene_edit plan',
      'creates a new world event proposal',
      'creates a Dynamic-tagged card proposal',
      'dry-runs the Dynamic card create path without unsafe_path refusal'
    ],
    shortcuts: [
      'uses a deterministic test dialog adapter for the local Dynamic fixture path',
      'uses DOM automation for repeatability while keeping Review & Apply and dry-run real'
    ]
  },
  complex_event_authoring_flow: {
    title: 'Player opens Complex Event Builder and verifies creation workflows have rendered entries.',
    run: scenarioWorkflowAccessRenderedEntries,
    dialogRoots: ['projectRoot'],
    playerLike: [
      'opens a project through Quick Start',
      'opens Create / Complex Event Builder',
      'verifies event graph, asset picker, variable create, and router entries render'
    ],
    shortcuts: ['uses renderer-level marker assertions after opening the real Studio window']
  },
  event_graph_click_edit_flow: {
    title: 'Player verifies Complex Event Builder graph nodes and route edges are click-to-edit entries.',
    run: scenarioWorkflowAccessRenderedEntries,
    dialogRoots: ['projectRoot'],
    playerLike: [
      'opens Create / Complex Event Builder',
      'verifies graph node buttons',
      'verifies graph route edge buttons'
    ],
    shortcuts: ['shares the rendered workflow-entry probe with related Goal AJ scenarios']
  },
  asset_picker_copy_review_flow: {
    title: 'Player verifies asset picker and copy-to-Review workflow entries.',
    run: scenarioWorkflowAccessRenderedEntries,
    dialogRoots: ['projectRoot'],
    playerLike: [
      'opens Create',
      'sees the asset picker',
      'verifies asset copy install entry is renderable'
    ],
    shortcuts: ['shares the rendered workflow-entry probe with related Goal AJ scenarios']
  },
  variable_create_from_event_flow: {
    title: 'Player verifies unknown event-effect variables expose a create-variable entry.',
    run: scenarioWorkflowAccessRenderedEntries,
    dialogRoots: ['projectRoot'],
    playerLike: [
      'opens Complex Event Builder',
      'adds or inspects an unknown event-effect variable',
      'verifies the create-variable entry is renderable'
    ],
    shortcuts: ['shares the rendered workflow-entry probe with related Goal AJ scenarios']
  },
  unknown_profile_router_rule_flow: {
    title: 'Player verifies unknown profile router wiring exposes a router-rule entry.',
    run: scenarioWorkflowAccessRenderedEntries,
    dialogRoots: ['projectRoot'],
    playerLike: [
      'opens Complex Event Builder',
      'uses an unknown profile model',
      'verifies router rule repair entry is renderable instead of a fake success'
    ],
    shortcuts: ['shares the rendered workflow-entry probe with related Goal AJ scenarios']
  }
};

function parseArgs(argv) {
  const args = {
    scenario: 'first_time_user',
    projectRoot: DEFAULT_PROJECT_ROOT,
    wrongProjectRoot: DEFAULT_WRONG_PROJECT_ROOT,
    dynamicProjectRoot: path.resolve(process.env.DMS_DYNAMIC_FIXTURE_ROOT || process.env.DMS_SDAAH_FIXTURE_ROOT || DEFAULT_DYNAMIC_PROJECT_ROOT),
    headed: false,
    stepDelayMs: 0,
    timeoutMs: 30000,
    list: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--list') {
      args.list = true;
      continue;
    }
    if (arg === '--headed') {
      args.headed = true;
      continue;
    }
    if (arg === '--scenario' || arg === '--project-root' || arg === '--wrong-project-root' || arg === '--dynamic-project-root' || arg === '--artifact-dir' || arg === '--timeout-ms' || arg === '--step-delay-ms') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(arg + ' requires a value.');
      }
      index += 1;
      if (arg === '--scenario') {
        args.scenario = value;
      } else if (arg === '--project-root') {
        args.projectRoot = path.resolve(value);
      } else if (arg === '--wrong-project-root') {
        args.wrongProjectRoot = path.resolve(value);
      } else if (arg === '--dynamic-project-root') {
        args.dynamicProjectRoot = path.resolve(value);
      } else if (arg === '--artifact-dir') {
        args.artifactDir = path.resolve(value);
      } else if (arg === '--timeout-ms') {
        args.timeoutMs = Number(value);
      } else if (arg === '--step-delay-ms') {
        args.stepDelayMs = Number(value);
      }
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    throw new Error('Unknown argument: ' + arg);
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 5000) {
    args.timeoutMs = 30000;
  }
  if (!Number.isFinite(args.stepDelayMs) || args.stepDelayMs < 0) {
    args.stepDelayMs = 0;
  }
  return args;
}

function usage() {
  return [
    'Usage: node tools/project_map/qa/run_desktop_scenario.js [--scenario first_time_user] [--headed]',
    '',
    'Runs a player-like Dendry Mod Studio desktop QA scenario in Electron.',
    'Artifacts are written to /tmp/dendry_mod_studio_qa by default.',
    '',
    'Options:',
    '  --list                         Print available scenarios as JSON.',
    '  --project-root <path>          Dendry project to open for the happy path.',
    '  --wrong-project-root <path>    Valid but different project for provenance refusal.',
    '  --dynamic-project-root <path>  SDAAH Dynamic checkout for dynamic_mod_smoke.',
    '  --artifact-dir <path>          Directory for screenshots, logs, and QA ledger.',
    '  --timeout-ms <number>          Per-wait timeout. Defaults to 30000.',
    '  --step-delay-ms <number>       Slow visible scenario playback after key steps.',
    '  --headed                       Show the Electron window instead of headless mode.'
  ].join('\n');
}

function listScenarios() {
  return Object.fromEntries(Object.entries(SCENARIOS).map(([id, scenario]) => {
    const {run: _run, ...listed} = scenario;
    return [id, listed];
  }));
}

function nodeEntry() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write('ERROR: ' + err.message + '\n\n' + usage() + '\n');
    process.exit(2);
  }
  if (args.help) {
    process.stdout.write(usage() + '\n');
    return;
  }
  if (args.list) {
    process.stdout.write(JSON.stringify({ok: true, scenarios: listScenarios()}, null, 2) + '\n');
    return;
  }
  if (!SCENARIOS[args.scenario]) {
    process.stderr.write('ERROR: Unknown scenario: ' + args.scenario + '\n');
    process.exit(2);
  }
  const electronPath = resolveElectronPath();
  const childArgs = [__filename];
  childArgs.push(...process.argv.slice(2));
  const childEnv = {
    ...process.env,
    DMS_QA_CHILD: '1',
    ELECTRON_DISABLE_SECURITY_WARNINGS: '1'
  };
  delete childEnv.ELECTRON_RUN_AS_NODE;
  delete childEnv.ELECTRON_NO_ATTACH_CONSOLE;
  const result = spawnSync(electronPath, childArgs, {
    stdio: 'inherit',
    env: childEnv
  });
  if (result.error) {
    process.stderr.write('ERROR: Could not start Electron: ' + result.error.message + '\n');
    process.exit(1);
  }
  process.exit(result.status === null ? 1 : result.status);
}

function resolveElectronPath() {
  try {
    return require(path.join(DESKTOP_DIR, 'node_modules', 'electron'));
  } catch (err) {
    throw new Error('Electron dependency was not found. Run `cd tools/project_map/desktop && npm ci` first.');
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function defaultArtifactDir(args, runId) {
  const scenario = SCENARIOS[args.scenario] || {};
  if (scenario.artifactBase) {
    return path.join(scenario.artifactBase, runId);
  }
  return path.join(os.tmpdir(), 'dendry_mod_studio_qa', runId);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, {recursive: true});
  return dir;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function markdownTable(rows) {
  return [
    '| Step | Status | Evidence |',
    '|---|---|---|'
  ].concat(rows.map((row) => '| ' + row.step + ' | ' + row.status + ' | ' + row.evidence + ' |')).join('\n');
}

function electronEntry() {
  const {app, BrowserWindow, ipcMain} = require('electron');
  const core = require(path.join(DESKTOP_DIR, 'studio_core.js'));
  const args = parseArgs(process.argv.slice(2));
  const runId = timestamp() + '-' + args.scenario;
  const artifactDir = ensureDir(args.artifactDir || defaultArtifactDir(args, runId));
  const transcript = [];
  const consoleMessages = [];
  const dialogSelections = [];
  let lastProject = null;
  let openProjectCallCount = 0;

  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.setPath('userData', ensureDir(path.join(artifactDir, 'electron-user-data')));

  function log(step, status, evidence, extra) {
    transcript.push({
      step,
      status,
      evidence: evidence || '',
      time: new Date().toISOString(),
      ...(extra || {})
    });
  }

  function sendScanProgress(target, update) {
    if (target && typeof target.send === 'function' && !target.isDestroyed()) {
      target.send('dendry:scan-progress', update || {});
    }
  }

  function userDataScratchDir() {
    return ensureDir(path.join(app.getPath('userData'), 'project-indexes'));
  }

  function userDataTemplateDir() {
    return ensureDir(path.join(app.getPath('userData'), 'templates'));
  }

  async function scanProject(root, includeExcerpts, progressTarget) {
    try {
      const result = await core.buildProjectIndex({
        root,
        outDir: userDataScratchDir(),
        includeExcerpts: Boolean(includeExcerpts),
        onProgress: (update) => sendScanProgress(progressTarget, update)
      });
      if (result.ok) {
        lastProject = {
          root: result.root,
          projectName: result.projectName,
          indexPath: result.indexPath,
          includeExcerpts: result.includeExcerpts,
          summary: result.summary
        };
      }
      return result;
    } catch (err) {
      return {
        ok: false,
        error: core.friendlyError(err),
        message: err && err.message ? err.message : String(err)
      };
    }
  }

  async function openProjectViaDialog(includeExcerpts, progressTarget) {
    const scenario = SCENARIOS[args.scenario] || {};
    const rootKeys = Array.isArray(scenario.dialogRoots) && scenario.dialogRoots.length
      ? scenario.dialogRoots
      : ['projectRoot'];
    const key = rootKeys[Math.min(openProjectCallCount, rootKeys.length - 1)];
    openProjectCallCount += 1;
    const root = args[key] || args.projectRoot;
    dialogSelections.push({
      call: openProjectCallCount,
      key,
      root,
      canceled: false
    });
    return scanProject(root, includeExcerpts, progressTarget);
  }

  ipcMain.handle('dendry:desktop-state', () => ({ok: true, lastProject}));
  ipcMain.handle('dendry:locale', () => app.getLocale());
  ipcMain.handle('dendry:doctor', (_event, options) => core.runDesktopDoctor({
    root: options && options.root,
    includeExcerpts: options && options.includeExcerpts,
    outDir: userDataScratchDir()
  }));
  ipcMain.handle('dendry:scan-project', (_event, options) => scanProject(options && options.root, options && options.includeExcerpts, _event.sender));
  ipcMain.handle('dendry:open-project', (_event, options) => openProjectViaDialog(options && options.includeExcerpts, _event.sender));
  ipcMain.handle('dendry:open-starter-demo', async (_event, options) => {
    const prepared = core.prepareStarterDemo({
      desktopDir: DESKTOP_DIR,
      workspaceRoot: userDataTemplateDir()
    });
    if (!prepared.ok) {
      return prepared;
    }
    const result = await scanProject(prepared.root, options && options.includeExcerpts, _event.sender);
    return Object.assign({}, result, {
      template: {
        id: prepared.id,
        title: prepared.title,
        sourceRoot: prepared.sourceRoot,
        workspaceRoot: prepared.targetRoot,
        reused: prepared.reused
      }
    });
  });
  ipcMain.handle('dendry:install-plan-apply', (_event, options) => core.applyInstallPlan({
    plan: options && options.plan,
    projectRoot: (options && options.projectRoot) || (lastProject && lastProject.root) || '',
    dryRun: !(options && options.dryRun === false),
    allowAdvanced: options && options.allowAdvanced === true
  }));
  ipcMain.handle('dendry:runtime-preview-create', async () => ({
    ok: false,
    message: 'Runtime Preview is outside the current guided UI smoke path.'
  }));
  ipcMain.handle('dendry:runtime-preview-history', async (event, options) => options || {});
  ipcMain.handle('dendry:update-notice-check', async () => ({
    ok: true,
    configured: true,
    disabled: true,
    shouldNotify: false,
    currentVersion: '0.9.6',
    reason: 'guided_ui_qa_offline'
  }));
  ipcMain.handle('dendry:open-external-url', async () => ({ok: true, opened: false, reason: 'guided_ui_qa_offline'}));

  app.whenReady().then(async () => {
    let windowRef = null;
    try {
      windowRef = new BrowserWindow({
        width: 1320,
        height: 900,
        show: Boolean(args.headed),
        backgroundColor: '#f4f2ec',
        webPreferences: {
          preload: path.join(DESKTOP_DIR, 'preload.js'),
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      windowRef.webContents.on('console-message', (_event, level, message, line, sourceId) => {
        consoleMessages.push({level, message, line, sourceId});
      });
      windowRef.webContents.on('render-process-gone', (_event, details) => {
        consoleMessages.push({level: 'error', message: 'render-process-gone: ' + JSON.stringify(details)});
      });
      await windowRef.loadFile(path.join(PROJECT_MAP_DIR, 'viewer', 'index.html'));
      await waitForPageReady(windowRef, args.timeoutMs);
      await runScenario(args.scenario, windowRef, args, artifactDir, log);
      await writeArtifacts(artifactDir, args, transcript, consoleMessages, dialogSelections, true, lastProject);
      await app.quit();
    } catch (err) {
      log('scenario failure', 'FAIL', err && err.stack ? err.stack : String(err));
      await writeArtifacts(artifactDir, args, transcript, consoleMessages, dialogSelections, false, lastProject);
      if (windowRef && !windowRef.isDestroyed()) {
        await screenshot(windowRef, artifactDir, 'failure');
      }
      process.stderr.write('QA scenario failed. Artifacts: ' + artifactDir + '\n');
      process.stderr.write((err && err.stack ? err.stack : String(err)) + '\n');
      process.exitCode = 1;
      await app.quit();
    }
  });
}

async function writeArtifacts(artifactDir, args, transcript, consoleMessages, dialogSelections, ok, currentProject) {
  writeJson(path.join(artifactDir, 'transcript.json'), {ok, args, transcript, consoleMessages, dialogSelections});
  const rows = transcript.map((entry) => ({
    step: escapeMd(entry.step),
    status: entry.status,
    evidence: escapeMd(entry.evidence || '')
  }));
  const scenario = SCENARIOS[args.scenario] || {};
  const markdown = [
    '# Dendry Mod Studio QA Ledger',
    '',
    '- Scenario: `' + args.scenario + '`',
    '- Result: ' + (ok ? 'PASS' : 'FAIL'),
    '- Configured project root: `' + args.projectRoot + '`',
    '- Loaded project root: `' + (currentProject && currentProject.root || '') + '`',
    '- Wrong-project root: `' + args.wrongProjectRoot + '`',
    '- Artifact directory: `' + artifactDir + '`',
    '- Player-like actions: ' + (scenario.playerLike || []).map((item) => '`' + item + '`').join('; '),
    '- Shortcuts: ' + (scenario.shortcuts || []).map((item) => '`' + item + '`').join('; '),
    '- Test dialog selections: ' + (dialogSelections || []).map((item) => '`#' + item.call + ' ' + item.key + ' -> ' + item.root + '`').join('; '),
    '',
    markdownTable(rows),
    '',
    'Console messages: ' + consoleMessages.length
  ].join('\n');
  fs.writeFileSync(path.join(artifactDir, 'QA_LEDGER.md'), markdown + '\n', 'utf8');
  process.stdout.write(JSON.stringify({ok, artifactDir, ledger: path.join(artifactDir, 'QA_LEDGER.md')}, null, 2) + '\n');
}

function escapeMd(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

async function runScenario(id, win, args, artifactDir, log) {
  const scenario = SCENARIOS[id];
  if (!scenario || typeof scenario.run !== 'function') {
    throw new Error('Scenario not implemented: ' + id);
  }
  await scenario.run(win, args, artifactDir, log);
}

async function scenarioFirstTimeUser(win, args, artifactDir, log) {
  await expectWelcomeSurfaceVisible(win, 'Quick Start overlay should be visible on first launch');
  await screenshot(win, artifactDir, '01-quick-start');
  log('Quick Start appears', 'PASS', '01-quick-start.png');

  await click(win, '#onboarding-open-tutorial-library');
  await expectVisible(win, '#studio-tutorial-library', 'Tutorial Library should open from Quick Start');
  await waitFor(win, async () => {
    return evalInPage(win, () => {
      const article = document.querySelector('#tutorial-library-article');
      const nav = document.querySelector('#tutorial-library-nav');
      return Boolean(article && article.textContent.trim() && nav && nav.querySelector('button'));
    });
  }, 'Tutorial Library should render localized article content');
  await screenshot(win, artifactDir, '02-tutorial-library');
  log('Tutorial Library opens', 'PASS', '02-tutorial-library.png');

  await click(win, '[data-tutorial-close="true"]');
  await waitForHidden(win, '#studio-tutorial-library', 'Tutorial Library should close');
  await clickWelcomePrimary(win);
  await waitForWelcomeSurfaceHidden(win, 'Quick Start should close');
  log('Quick Start primary opens project picker', 'PASS', 'test dialog adapter selects project root');

  const loaded = await waitForProjectLoaded(win, args.projectRoot, args.timeoutMs);
  await screenshot(win, artifactDir, '03-project-loaded');
  log('Project loads', 'PASS', JSON.stringify(loaded.summary || {}));

  await click(win, '#mode-create');
  await openObjectCanvasDraft(win, 'event', {
    id: 'qa_first_time_event',
    title: 'QA first time event',
    heading: 'A test proposal reaches review',
    year: 2021,
    monthStart: 5,
    monthEnd: 7,
    requires: '',
    intro: 'A tester opens Studio and writes a small event the way a first-time mod author would.',
    options: [
      {id: 'define_issue', label: 'Define the issue', subtitle: 'Make the proposal visible.', effects: [{variable: 'generic_score', op: '+=', value: 1}], body: 'The test proposal becomes a concrete change plan. The UI should show readable output before anything touches source files.'},
      {id: 'wait_and_listen', label: 'Wait and listen', subtitle: 'Keep the first edit modest.', effects: [{variable: 'generic_score', op: '-=', value: 1}], body: 'The tester leaves a quieter path in place, then checks that Review and Apply explains the consequences clearly.'}
    ]
  });
  await expectText(win, '#existing-scene-editor-host', 'QA first time event');
  await waitFor(win, async () => {
    return evalInPage(win, () => {
      const output = window.ProjectMapObjectAuthoringCanvas && window.ProjectMapObjectAuthoringCanvas.getOutput && window.ProjectMapObjectAuthoringCanvas.getOutput();
      return Boolean(output && output.installPlanJson && output.patchPreview);
    });
  }, 'World Event output should produce install plan and patch preview');
  await screenshot(win, artifactDir, '04-event-draft');
  log('World Event proposal renders', 'PASS', '04-event-draft.png');

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'QA first time event');
  await screenshot(win, artifactDir, '05-my-changes');
  log('Draft saves to My Changes', 'PASS', '05-my-changes.png');

  await click(win, '#draft-workspace-list [data-draft-action="review"]');
  await expectInstallOperationPath(win, 'source/scenes/events/qa_first_time_event.scene.dry');
  await screenshot(win, artifactDir, '06-review-apply');
  log('Saved draft opens Review & Apply', 'PASS', '06-review-apply.png');

  await click(win, '#install-dry-run');
  await waitFor(win, async () => {
    return evalInPage(win, () => {
      const state = window.ProjectMapInstallAssistant && window.ProjectMapInstallAssistant.getState();
      const result = state && state.lastResult;
      return Boolean(result && result.dryRun === true && Array.isArray(result.results));
    });
  }, 'Dry-run should produce an install result');
  const dryRunResult = await evalInPage(win, () => {
    const state = window.ProjectMapInstallAssistant && window.ProjectMapInstallAssistant.getState();
    return state && state.lastResult;
  });
  if (!dryRunResult || dryRunResult.ok !== true || !dryRunResult.results.some((item) => item.status === 'would_apply')) {
    throw new Error('Dry-run did not succeed with would_apply operations: ' + JSON.stringify(dryRunResult));
  }
  await screenshot(win, artifactDir, '07-dry-run');
  log('Dry-run succeeds on QA fixture', 'PASS', '07-dry-run.png');

  await click(win, '#desktop-open-project');
  const wrongLoaded = await waitForProjectLoaded(win, args.wrongProjectRoot, args.timeoutMs);
  log('Wrong project loads through project picker', 'PASS', JSON.stringify(wrongLoaded.summary || {}));
  await click(win, '#install-dry-run');
  await waitFor(win, async () => {
    return evalInPage(win, () => {
      const state = window.ProjectMapInstallAssistant && window.ProjectMapInstallAssistant.getState();
      const diagnostics = state && state.lastResult && state.lastResult.diagnostics;
      return Array.isArray(diagnostics) && diagnostics.some((item) => item.code === 'install_plan.project_mismatch');
    });
  }, 'Wrong project dry-run should produce project_mismatch diagnostic');
  await screenshot(win, artifactDir, '08-wrong-project-refusal');
  log('Wrong-project plan is refused', 'PASS', '08-wrong-project-refusal.png');
}

async function scenarioExploreDesignExistingEdit(win, args, artifactDir, log) {
  await expectWelcomeSurfaceVisible(win, 'Quick Start overlay should be visible on first launch');
  await screenshot(win, artifactDir, '01-quick-start');
  log('Quick Start appears', 'PASS', '01-quick-start.png');

  await clickWelcomePrimary(win);
  await waitForWelcomeSurfaceHidden(win, 'Quick Start should close after opening a project');
  const loaded = await waitForProjectLoaded(win, args.projectRoot, args.timeoutMs);
  await screenshot(win, artifactDir, '02-project-loaded');
  log('Project loads from Quick Start primary action', 'PASS', JSON.stringify(loaded.summary || {}));

  await click(win, '#mode-explore');
  await click(win, '[data-view="events"]');
  await fill(win, '#search', 'Generic Intro');
  await clickRowContaining(win, '#list [data-row-key]', 'Generic Intro');
  await expectText(win, '#inspector', 'Generic Intro');
  await waitFor(win, () => evalInPage(win, () => {
    const action = document.querySelector('#inspector [data-edit-existing]');
    return Boolean(action && !action.disabled);
  }), 'Explore inspector should expose Edit existing for the event');
  await screenshot(win, artifactDir, '03-explore-event-inspector');
  log('Explore search selects existing event', 'PASS', '03-explore-event-inspector.png');

  await click(win, '#mode-design');
  await click(win, '[data-design-view="list"]');
  await fill(win, '#design-search', 'Generic Intro');
  await click(win, '[data-design-key="event:generic_intro"]');
  await expectText(win, '#design-inspector', 'Generic Intro');
  await waitFor(win, () => evalInPage(win, () => {
    const action = document.querySelector('#design-inspector [data-design-edit-existing]');
    return Boolean(action && !action.disabled);
  }), 'Design inspector should expose Edit existing for the event');
  await screenshot(win, artifactDir, '04-design-event-selected');
  log('Design list selects same existing event', 'PASS', '04-design-event-selected.png');

  await click(win, '#design-inspector [data-design-edit-existing]');
  await expectVisible(win, '#existing-scene-editor-host [data-object-authoring-canvas="true"]', 'Object Authoring Canvas should open from Design');
  await expectVisible(win, '#existing-scene-editor-host [data-editing-workspace="true"]', 'Object Authoring Canvas should keep the existing editing QA marker');
  await expectVisible(win, '#existing-scene-editor-host [data-object-editing-modal="true"]', 'Design Edit existing should open the focused object editor');
  await expectVisible(win, '#existing-scene-editor-host [data-preview-object-editor="true"]', 'Focused object editor should expose editable fields');
  await replaceExistingBlockByOriginal(
    win,
    '= Generic Intro\n\nThis scene has a simple variable write and no project-specific systems.\n',
    '= Generic Intro\n\nThis edited section proves Design can open a guarded existing scene section proposal.\n'
  );
  await waitForText(win, '#existing-scene-editor-host [data-object-editing-modal-preview-pane="true"]', 'This edited section proves Design can open a guarded existing scene section proposal.', 5000);
  await screenshot(win, artifactDir, '05-existing-edit');
  log('Existing editor updates a source-backed page section', 'PASS', '05-existing-edit.png');

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'Generic Intro');
  await screenshot(win, artifactDir, '06-existing-saved');
  log('Existing edit saves to My Changes', 'PASS', '06-existing-saved.png');

  await click(win, '#draft-workspace-list [data-draft-action="review"]');
  await waitFor(win, () => evalInPage(win, () => {
    const state = window.ProjectMapInstallAssistant && window.ProjectMapInstallAssistant.getState();
    return Boolean(state && state.plan && state.plan.draftKind === 'existing_scene_edit');
  }), 'Review & Apply should load the existing scene edit plan');
  await expectText(win, '#install-checklist', 'replace_section');
  await screenshot(win, artifactDir, '07-existing-review');
  log('Saved existing edit opens Review & Apply', 'PASS', '07-existing-review.png');

  await click(win, '#install-dry-run');
  await waitFor(win, async () => {
    return evalInPage(win, () => {
      const state = window.ProjectMapInstallAssistant && window.ProjectMapInstallAssistant.getState();
      const result = state && state.lastResult;
      return Boolean(result && result.dryRun === true && Array.isArray(result.results));
    });
  }, 'Dry-run should produce an install result for existing edit');
  const dryRunResult = await evalInPage(win, () => {
    const state = window.ProjectMapInstallAssistant && window.ProjectMapInstallAssistant.getState();
    return state && state.lastResult;
  });
  if (!dryRunResult || dryRunResult.ok !== true || !dryRunResult.results.some((item) => item.type === 'replace_section' && item.status === 'would_apply')) {
    throw new Error('Existing edit dry-run did not produce a guarded replace_section would_apply result: ' + JSON.stringify(dryRunResult));
  }
  await screenshot(win, artifactDir, '08-existing-dry-run');
  log('Existing edit dry-run succeeds', 'PASS', '08-existing-dry-run.png');
}

async function scenarioContentStoryboardCanvasSelection(win, args, artifactDir, log) {
  await expectWelcomeSurfaceVisible(win, 'Quick Start overlay should be visible on first launch');
  await clickWelcomePrimary(win);
  await waitForWelcomeSurfaceHidden(win, 'Quick Start should close after opening a project');
  const loaded = await waitForProjectLoaded(win, args.projectRoot, args.timeoutMs);
  log('Project loads from Quick Start primary action', 'PASS', JSON.stringify(loaded.summary || {}));

  await click(win, '#mode-create');
  await click(win, '[data-create-template="event"]');
  await expectVisible(win, '#existing-scene-editor-host [data-content-storyboard-surface="true"]', 'Content Storyboard Canvas should render in Create');
  await screenshot(win, artifactDir, '01-storyboard-canvas');
  log('Content Storyboard Canvas renders', 'PASS', '01-storyboard-canvas.png');

  const cardKey = await evalInPage(win, () => {
    const cards = Array.from(document.querySelectorAll('#existing-scene-editor-host [data-content-storyboard-card]'));
    const card = cards.find((node) => /^event:/.test(node.dataset.contentStoryboardCard || ''));
    return card && card.dataset.contentStoryboardCard || '';
  });
  if (!cardKey) {
    throw new Error('Content Storyboard did not render a source-backed event card to click.');
  }
  await dispatchStoryboardPointerClick(win, cardKey);
  await waitFor(win, () => evalInPage(win, (key) => {
    const selected = document.querySelector('[data-content-storyboard-card="' + cssEscape(key) + '"].is-selected');
    const modal = document.querySelector('[data-object-editing-modal="true"]');
    const canvas = window.ProjectMapObjectAuthoringCanvas;
    return Boolean(selected && modal && canvas && canvas.activeTemplate && canvas.activeTemplate() === 'existing');

    function cssEscape(value) {
      return window.CSS && window.CSS.escape ? window.CSS.escape(String(value || '')) : String(value || '').replace(/["\\\]]/g, '\\$&');
    }
  }, cardKey), 'Pointer-clicking a Storyboard card should select it and open the object editor');
  await screenshot(win, artifactDir, '02-storyboard-card-selected-editor-open');
  log('Storyboard card pointer click opens the object editor', 'PASS', cardKey);
}

async function scenarioWorkflowAccessRenderedEntries(win, args, artifactDir, log) {
  await expectWelcomeSurfaceVisible(win, 'Quick Start overlay should be visible on first launch');
  await clickWelcomePrimary(win);
  await waitForWelcomeSurfaceHidden(win, 'Quick Start should close after opening a project');
  const loaded = await waitForProjectLoaded(win, args.projectRoot, args.timeoutMs);
  log('Project loads from Quick Start primary action', 'PASS', JSON.stringify(loaded.summary || {}));

  await click(win, '#mode-create');
  await click(win, '[data-create-template="event"]');
  await expectVisible(win, '#wizard-asset-picker', 'Complex Event Builder should expose the event asset picker');
  await screenshot(win, artifactDir, '01-complex-event-builder-entry');

  const rendered = await evalInPage(win, () => {
    const canvasModel = window.ProjectMapObjectAuthoringCanvasModel;
    const previewEditor = window.ProjectMapPreviewObjectEditor;
    const graphStage = window.ProjectMapObjectCanvasGraphStage;
    const index = {
      schemaVersion: '0.1',
      project: {name: 'Workflow QA', root: '/tmp/workflow-qa', profileIds: ['generic-dendry']},
      profiles: [{id: 'generic-dendry'}],
      variables: []
    };
    const unknownIndex = {
      schemaVersion: '0.1',
      project: {name: 'Workflow QA', root: '/tmp/workflow-qa', profileIds: ['unknown-profile']},
      profiles: [{id: 'unknown-profile'}],
      variables: []
    };
    const draft = {
      schemaVersion: '0.1',
      kind: 'world_event',
      id: 'workflow_qa_event',
      title: 'Workflow QA event',
      heading: 'Workflow QA event',
      when: {year: 1936, monthStart: 1, monthEnd: 1, requires: '', priority: 0},
      introParagraphs: ['Workflow QA text.'],
      effectsOnTrigger: [{variable: 'new_workflow_qa_flag', op: '+=', value: 1}],
      options: [
        {id: 'first', label: 'First', narrativeParagraphs: ['First.'], returnTarget: 'root'},
        {id: 'second', label: 'Second', narrativeParagraphs: ['Second.'], returnTarget: 'root'}
      ]
    };
    const known = canvasModel.buildNewEventCanvas(index, draft, {});
    const unknown = canvasModel.buildNewEventCanvas(unknownIndex, draft, {});
    const html = [
      previewEditor.render(known),
      graphStage.render(known, {state: {selectedCanvasNode: 'object'}}),
      graphStage.render(unknown, {state: {selectedCanvasNode: 'object'}})
    ].join('\n');
    return {
      graphNode: html.includes('data-preview-object-event-graph-node'),
      graphEdge: html.includes('data-preview-object-event-graph-edge'),
      variableCreate: html.includes('data-workflow-entry="variable-create-from-effect"'),
      routerRegistration: html.includes('data-workflow-entry="profile-router-registration"'),
      profileRule: html.includes('data-workflow-entry="profile-router-rule"'),
      readinessRepair: html.includes('data-readiness-repair-action') || unknown.eventBody.readinessChecklist.some((row) => row.repairAction),
      operations: known.changeState.installPlan && known.changeState.installPlan.operations.length || 0
    };
  });
  ['graphNode', 'graphEdge', 'variableCreate', 'routerRegistration', 'profileRule', 'readinessRepair'].forEach((key) => {
    if (!rendered[key]) {
      throw new Error('Missing rendered workflow entry marker: ' + key);
    }
  });
  if (!rendered.operations) {
    throw new Error('Known profile Complex Event Builder did not produce install operations.');
  }
  log('Rendered workflow entries are present', 'PASS', JSON.stringify(rendered));
}

async function scenarioRouteUnderstandingWorkbenchFlow(win, _args, artifactDir, log) {
  const result = await evalInPage(win, () => {
    const routeScript = window.ProjectMapRouteScriptIntelligenceModel;
    const previewEditor = window.ProjectMapPreviewObjectEditor;
    const source = (path, line) => ({path, line, startLine: line, endLine: line, anchorText: ''});
    const profileEvidence = [{
      profileId: 'qa-route-understanding',
      eventSeriesPatterns: [{
        prefix: 'presidential_election_1932',
        stages: [
          {sceneId: 'presidential_election_1932_hindenburg', stageLabel: 'announcement'},
          {sceneId: 'presidential_election_1932_candidate', stageLabel: 'candidate setup'},
          {sceneId: 'presidential_election_1932_campaign', stageLabel: 'campaign'},
          {sceneId: 'presidential_election_1932_round_1', stageLabel: 'round 1'},
          {sceneId: 'presidential_election_1932_round_2', stageLabel: 'round 2'}
        ]
      }],
      schedulerScenes: [{sceneId: 'post_event.events_choice', tag: 'event', deckRoute: '#event', protected: true}],
      protectedRouterScenes: ['post_event', 'post_event.events_choice'],
      utilityRouteScenes: [{sceneId: 'election_algorithm', utilityKind: 'single_slot_return_utility', returnBinding: 'jumpScene'}]
    }];
    const scenes = [
      'presidential_election_1932_hindenburg',
      'presidential_election_1932_candidate',
      'presidential_election_1932_campaign',
      'presidential_election_1932_round_1',
      'presidential_election_1932_round_2',
      'election_algorithm',
      'post_event.events_choice'
    ].map((id, index) => ({
      id,
      type: id.indexOf('presidential_election_1932') === 0 ? 'event' : 'system',
      title: id,
      path: id === 'election_algorithm' ? 'source/scenes/election_algorithm.scene.dry' : 'source/scenes/events/' + id + '.scene.dry',
      tags: id.indexOf('presidential_election_1932') === 0 ? ['event'] : [],
      viewIf: id.indexOf('round_') >= 0 ? 'year = 1932' : '',
      sourceSpan: source('source/scenes/events/' + id + '.scene.dry', index + 1)
    }));
    const projectIndex = {
      schemaVersion: '0.1',
      project: {name: 'Route Understanding QA', root: '/tmp/route-understanding-qa', profileIds: ['qa-route-understanding']},
      scenes,
      edges: [{from: 'presidential_election_1932_round_1', to: 'election_algorithm', kind: 'go_to', source: source('source/scenes/events/presidential_election_1932_round_1.scene.dry', 16)}],
      semantic: {
        parserEvidence: {
          core: {tagDeckRoutes: [{sceneId: 'post_event.events_choice', tag: 'event', deckRoute: '#event', source: source('source/scenes/post_event.scene.dry', 5205)}]},
          profiles: profileEvidence
        }
      }
    };
    const body = {
      id: 'presidential_election_1932_round_1',
      projectIndex,
      profileEvidence,
      knownSceneIds: scenes.map((scene) => scene.id),
      sections: [{id: 'pres_election'}, {id: 'calculation'}, {id: 'hindenburg_wins'}],
      flow: {
        nodes: [{id: 'presidential_election_1932_round_1'}, {id: 'election_algorithm'}, {id: 'calculation'}, {id: 'hindenburg_wins'}],
        edges: [
          {from: 'presidential_election_1932_round_1', to: 'election_algorithm', kind: 'route', parserBacked: true, source: source('source/scenes/events/presidential_election_1932_round_1.scene.dry', 16)},
          {from: 'presidential_election_1932_round_1', to: 'pres_election', kind: 'set_jump', parserBacked: true, source: source('source/scenes/events/presidential_election_1932_round_1.scene.dry', 17)},
          {from: 'election_algorithm', to: 'jumpScene', kind: 'route', parserBacked: true, source: source('source/scenes/election_algorithm.scene.dry', 104)},
          {from: 'calculation', to: 'hindenburg_wins', kind: 'conditional_route', condition: 'hindenburg_majority == 1', parserBacked: true, source: source('source/scenes/events/presidential_election_1932_round_1.scene.dry', 670)}
        ]
      },
      scriptRows: [{
        id: 'qa_vote_math',
        label: 'vote math',
        scriptKind: 'opaque_js',
        hook: 'on-arrival',
        sectionId: 'calculation',
        text: '{! Q.hindenburg_majority = Q.hindenburg_votes > 50; !}',
        writes: ['hindenburg_majority'],
        reads: ['hindenburg_votes'],
        lineCount: 200,
        source: source('source/scenes/events/presidential_election_1932_round_1.scene.dry', 33)
      }],
      eventGraph: {
        kind: 'complex_event_graph',
        nodes: [{id: 'root', kind: 'opening', label: 'Round 1'}, {id: 'section:calculation', kind: 'follow_up', label: 'calculation'}, {id: 'section:hindenburg_wins', kind: 'result', label: 'hindenburg_wins'}],
        edges: [{id: 'edge:calculation:hindenburg', from: 'section:calculation', to: 'section:hindenburg_wins', kind: 'result_route', targetId: 'hindenburg_wins'}]
      }
    };
    const model = routeScript.buildRouteScriptIntelligence(body, {eventId: body.id, projectIndex, profileEvidence});
    const eventBody = Object.assign({}, body, {
      routeScriptIntelligence: {summary: model.summary, diagnostics: model.diagnostics},
      routeEvidenceMap: model.routes,
      scriptImpactMap: model.scripts,
      routeUnderstanding: model.routeUnderstanding
    });
    const html = previewEditor.render({kind: 'event', eventBody});
    return {
      eventChain: html.includes('data-route-understanding-section="event_chain"'),
      scheduler: html.includes('data-route-understanding-section="scheduler"') && html.includes('#event'),
      utility: html.includes('data-route-understanding-section="utility"') && html.includes('election_algorithm'),
      stateDependency: html.includes('data-route-understanding-section="state_dependency"') &&
        html.includes('data-route-understanding-item="state_dependency"') &&
        html.includes('hindenburg_majority'),
      jumpSceneMissing: model.routes.items.some((route) => route.target === 'jumpScene' && route.evidenceClass === 'missing_target'),
      summary: model.routeUnderstanding && model.routeUnderstanding.summary
    };
  });
  ['eventChain', 'scheduler', 'utility', 'stateDependency'].forEach((key) => {
    if (!result[key]) {
      throw new Error('Route Understanding Workbench missing marker: ' + key);
    }
  });
  if (result.jumpSceneMissing) {
    throw new Error('Utility return binding was treated as a missing jumpScene target.');
  }
  await screenshot(win, artifactDir, '01-route-understanding-workbench');
  log('Route Understanding Workbench context renders', 'PASS', JSON.stringify(result.summary || {}));
}

async function scenarioGuidedRouteEditWorkbenchFlow(win, _args, artifactDir, log) {
  const result = await evalInPage(win, () => {
    const routeScript = window.ProjectMapRouteScriptIntelligenceModel;
    const semanticLogic = window.ProjectMapSemanticLogicEditor;
    const workspace = window.ProjectMapSemanticLogicWorkspace;
    const previewEditor = window.ProjectMapPreviewObjectEditor;
    const source = (path, line, anchorText) => ({path, line, startLine: line, endLine: line, anchorText, endAnchorText: anchorText});
    const path = 'source/scenes/events/guided_route_qa.scene.dry';
    const profileEvidence = [{
      profileId: 'qa-guided-route-edit',
      routeQualityVars: ['next_scene'],
      utilityRouteScenes: [{sceneId: 'election_algorithm', utilityKind: 'single_slot_return_utility', returnBinding: 'jumpScene'}]
    }];
    const projectIndex = {
      schemaVersion: '0.1',
      project: {name: 'Guided Route Edit QA', root: '/tmp/guided-route-edit-qa', profileIds: ['qa-guided-route-edit']},
      scenes: [
        {id: 'guided_route_qa', path},
        {id: 'election_algorithm', path: 'source/scenes/election_algorithm.scene.dry'},
        {id: 'return_scene', path},
        {id: 'alpha', path},
        {id: 'omega', path}
      ],
      semantic: {
        parserEvidence: {
          profiles: profileEvidence,
          core: {
            routeOrderGroups: [{
              id: 'qa_fallback',
              sceneId: 'guided_route_qa',
              ownerId: 'guided_route_qa',
              routeField: 'goTo',
              source: source(path, 18, 'go-to: alpha if Q.route_flag = 1; omega'),
              sourceRaw: 'go-to: alpha if Q.route_flag = 1; omega',
              clauses: [
                {rawTarget: 'alpha', predicate: 'Q.route_flag = 1', isFallback: false},
                {rawTarget: 'omega', predicate: '', isFallback: true}
              ]
            }]
          }
        }
      }
    };
    const body = {
      id: 'guided_route_qa',
      projectIndex,
      profileEvidence,
      projectSceneIds: ['guided_route_qa', 'election_algorithm', 'return_scene', 'alpha', 'omega'],
      flow: {
        nodes: [{id: 'guided_route_qa'}, {id: 'election_algorithm'}, {id: 'return_scene'}, {id: 'alpha'}, {id: 'omega'}],
        edges: [
          {kind: 'route', from: 'guided_route_qa', to: 'election_algorithm', parserBacked: true, source: source(path, 10, 'go-to: election_algorithm')},
          {kind: 'set_jump', from: 'guided_route_qa', to: 'return_scene', rawTarget: 'return_scene', parserBacked: true, source: source(path, 11, 'set-jump: return_scene')},
          {kind: 'go_to_ref', from: 'guided_route_qa', to: 'quality_ref:next_scene', rawTarget: 'next_scene', dynamicTarget: true, targetSource: 'quality', candidateTargets: ['alpha', 'omega'], parserBacked: true, source: source(path, 12, 'go-to-ref: next_scene')}
        ]
      },
      scriptRows: [{
        id: 'qa_route_table',
        label: 'QA route table',
        text: 'on-arrival: Q.next_scene = Q.route_flag ? "alpha" : "omega"',
        source: source(path, 16, 'on-arrival: Q.next_scene = Q.route_flag ? "alpha" : "omega"')
      }],
      eventGraph: {
        kind: 'complex_event_graph',
        nodes: [{id: 'root', kind: 'opening', label: 'Guided Route QA'}, {id: 'section:alpha', kind: 'result', label: 'alpha'}, {id: 'section:omega', kind: 'result', label: 'omega'}],
        edges: [{id: 'edge:alpha', from: 'root', to: 'section:alpha', kind: 'result_route', targetId: 'alpha'}]
      }
    };
    const model = routeScript.buildRouteScriptIntelligence(body, {eventId: body.id, projectIndex, profileEvidence});
    const eventBody = Object.assign({}, body, {
      routeScriptIntelligence: {summary: model.summary, diagnostics: model.diagnostics},
      routeEvidenceMap: model.routes,
      scriptImpactMap: model.scripts,
      routeUnderstanding: model.routeUnderstanding,
      routeGuidedEdits: model.routeGuidedEdits
    });
    const html = previewEditor.render({kind: 'event', eventBody});
    const entries = model.routeGuidedEdits && model.routeGuidedEdits.entries || [];
    const utility = entries.find((entry) => entry.kind === 'utility_pair' && entry.safeEditEligible);
    const table = entries.find((entry) => entry.kind === 'route_table_binding' && entry.safeEditEligible && entry.routeTable && entry.routeTable.shape === 'ternary_literal');
    const fallback = entries.find((entry) => entry.kind === 'explicit_fallback_helper' && entry.safeEditEligible);
    const utilityEditor = semanticLogic.buildSemanticLogicEditor(projectIndex, {editAction: utility && utility.editAction});
    const utilityProposal = semanticLogic.buildProposal(utilityEditor, {'semantic_logic.setJumpTarget': 'return_scene_2'});
    const tableEditor = semanticLogic.buildSemanticLogicEditor(projectIndex, {editAction: table && table.editAction});
    const tableProposal = semanticLogic.buildProposal(tableEditor, {'semantic_logic.routeTable.0.target': 'alpha_2'});
    const fallbackEditor = semanticLogic.buildSemanticLogicEditor(projectIndex, {editAction: fallback && fallback.editAction});
    const fallbackProposal = semanticLogic.buildProposal(fallbackEditor, {});
    const workspaceHtml = workspace.render(workspace.buildCanvasModel(utilityEditor, {'semantic_logic.setJumpTarget': 'return_scene_2'}, {
      translate: (_key, fallbackText) => fallbackText,
      escapeHtml: (value) => String(value === undefined || value === null ? '' : value),
      escapeAttr: (value) => String(value === undefined || value === null ? '' : value),
      renderPlanPreview: () => '',
      renderDiagnostics: () => '',
      semanticLogicApi: semanticLogic
    }), {semanticLogicModel: utilityEditor, values: {'semantic_logic.setJumpTarget': 'return_scene_2'}}, {
      translate: (_key, fallbackText) => fallbackText,
      escapeHtml: (value) => String(value === undefined || value === null ? '' : value),
      escapeAttr: (value) => String(value === undefined || value === null ? '' : value),
      renderPlanPreview: () => '',
      renderDiagnostics: () => ''
    });
    return {
      guidedTools: html.includes('data-preview-object-route-guided-edits="true"'),
      utilityChip: html.includes('data-route-guided-edit-kind="utility_pair"'),
      tableChip: html.includes('data-route-guided-edit-kind="route_table_binding"'),
      fallbackChip: html.includes('data-route-guided-edit-kind="explicit_fallback_helper"'),
      utilityOps: utilityProposal && utilityProposal.installPlan && utilityProposal.installPlan.operations.length,
      tableReplace: tableProposal && tableProposal.installPlan && tableProposal.installPlan.operations[0] && tableProposal.installPlan.operations[0].replace,
      fallbackReplace: fallbackProposal && fallbackProposal.installPlan && fallbackProposal.installPlan.operations[0] && fallbackProposal.installPlan.operations[0].replace,
      workspaceMode: workspaceHtml.includes('data-semantic-logic-field-mode="utility_pair"'),
      summary: model.routeGuidedEdits && model.routeGuidedEdits.summary
    };
  });
  ['guidedTools', 'utilityChip', 'tableChip', 'fallbackChip', 'workspaceMode'].forEach((key) => {
    if (!result[key]) {
      throw new Error('Guided Route Edit Workbench missing marker: ' + key);
    }
  });
  if (result.utilityOps !== 2) {
    throw new Error('Utility pair proposal did not keep the call/return pair in one two-operation review plan.');
  }
  if (!String(result.tableReplace || '').includes('"alpha_2"')) {
    throw new Error('Route table proposal did not replace the literal target value.');
  }
  if (!String(result.fallbackReplace || '').includes('omega if Q.route_flag != 1')) {
    throw new Error('Explicit fallback helper did not generate the complement predicate.');
  }
  await screenshot(win, artifactDir, '01-guided-route-edit-workbench');
  log('Guided Route Edit Workbench tools render and propose operations', 'PASS', JSON.stringify(result.summary || {}));
}

async function scenarioDraftPersistenceRestart(win, args, artifactDir, log) {
  await expectWelcomeSurfaceVisible(win, 'Quick Start overlay should be visible on first launch');
  await screenshot(win, artifactDir, '01-quick-start');
  log('Quick Start appears', 'PASS', '01-quick-start.png');

  await clickWelcomePrimary(win);
  await waitForWelcomeSurfaceHidden(win, 'Quick Start should close after opening a project');
  const loaded = await waitForProjectLoaded(win, args.projectRoot, args.timeoutMs);
  await screenshot(win, artifactDir, '02-project-loaded');
  log('Project loads from Quick Start primary action', 'PASS', JSON.stringify(loaded.summary || {}));

  await click(win, '#mode-create');
  await fillPersistentWorldEventDraft(win);
  await waitFor(win, async () => {
    return evalInPage(win, () => {
      const output = window.ProjectMapWizard && window.ProjectMapWizard.getOutput && window.ProjectMapWizard.getOutput();
      return Boolean(output && output.installPlanJson && output.patchPreview);
    });
  }, 'Persistent World Event output should produce install plan and patch preview');
  await screenshot(win, artifactDir, '03-persistent-event-draft');
  log('World Event persistence draft renders', 'PASS', '03-persistent-event-draft.png');

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'QA persistent event');
  await screenshot(win, artifactDir, '04-saved-before-reload');
  log('Draft saves before reload', 'PASS', '04-saved-before-reload.png');

  await reloadStudioWindow(win, args.timeoutMs);
  await expectWelcomeSurfaceHiddenOrMissing(win, 'Quick Start should stay dismissed after reload');
  await screenshot(win, artifactDir, '05-after-reload');
  log('Studio window reloads with same user data', 'PASS', '05-after-reload.png');

  await click(win, '#desktop-open-project');
  const reloaded = await waitForProjectLoaded(win, args.projectRoot, args.timeoutMs);
  log('Project opens again after reload', 'PASS', JSON.stringify(reloaded.summary || {}));

  await click(win, '#mode-create');
  await expectText(win, '#draft-workspace-list', 'QA persistent event');
  await screenshot(win, artifactDir, '06-draft-persisted');
  log('My Changes persists saved draft after reload', 'PASS', '06-draft-persisted.png');

  await click(win, '#draft-workspace-list [data-draft-action="load"]');
  await expectValue(win, '#wizard-title', 'QA persistent event');
  await screenshot(win, artifactDir, '07-draft-reopened');
  log('Saved draft reopens into Create', 'PASS', '07-draft-reopened.png');

  await click(win, '#draft-workspace-list [data-draft-action="review"]');
  await expectInstallOperationPath(win, 'source/scenes/events/qa_persistent_event.scene.dry');
  await waitFor(win, () => evalInPage(win, () => {
    const state = window.ProjectMapInstallAssistant && window.ProjectMapInstallAssistant.getState();
    return Boolean(state && state.plan && state.plan.id === 'qa_persistent_event');
  }), 'Review & Apply should load the persisted event install plan');
  await screenshot(win, artifactDir, '08-persisted-review');
  log('Persisted draft opens Review & Apply', 'PASS', '08-persisted-review.png');

  await click(win, '#install-dry-run');
  await waitFor(win, async () => {
    return evalInPage(win, () => {
      const state = window.ProjectMapInstallAssistant && window.ProjectMapInstallAssistant.getState();
      const result = state && state.lastResult;
      return Boolean(result && result.dryRun === true && Array.isArray(result.results));
    });
  }, 'Dry-run should produce an install result for persisted draft');
  const dryRunResult = await evalInPage(win, () => {
    const state = window.ProjectMapInstallAssistant && window.ProjectMapInstallAssistant.getState();
    return state && state.lastResult;
  });
  if (!dryRunResult || dryRunResult.ok !== true || !dryRunResult.results.some((item) => item.status === 'would_apply')) {
    throw new Error('Persisted draft dry-run did not succeed with would_apply operations: ' + JSON.stringify(dryRunResult));
  }
  await screenshot(win, artifactDir, '09-persisted-dry-run');
  log('Persisted draft dry-run succeeds', 'PASS', '09-persisted-dry-run.png');
}

async function scenarioLoadBundledDemoTemplate(win, args, artifactDir, log) {
  await expectWelcomeSurfaceVisible(win, 'Quick Start overlay should be visible on first launch');
  await expectVisible(win, '#onboarding-load-demo', 'Quick Start should expose bundled demo template action');
  await screenshot(win, artifactDir, '01-quick-start-demo-action');
  log('Quick Start offers bundled demo template', 'PASS', '01-quick-start-demo-action.png');

  await click(win, '#onboarding-load-demo');
  await waitForWelcomeSurfaceHidden(win, 'Quick Start should close after loading demo template');
  const loaded = await waitForProjectNamed(win, 'Dendry Mod Studio Starter Demo', args.timeoutMs);
  if (!String(loaded.root || '').includes('starter-demo')) {
    throw new Error('Starter demo did not open from a starter-demo workspace: ' + JSON.stringify(loaded));
  }
  fs.accessSync(loaded.root, fs.constants.W_OK);
  await screenshot(win, artifactDir, '02-demo-project-loaded');
  log('Bundled demo template opens as writable project', 'PASS', JSON.stringify(loaded.summary || {}));

  await click(win, '#mode-explore');
  await click(win, '[data-view="events"]');
  await fill(win, '#search', 'Civic Reform');
  await clickRowContaining(win, '#list [data-row-key]', 'Civic Reform Office Briefing');
  await expectText(win, '#inspector', 'Civic Reform Office Briefing');
  await expectText(win, '#inspector', 'demo_support');
  await screenshot(win, artifactDir, '03-demo-event-inspector');
  log('Explore shows game-like demo event mapping', 'PASS', '03-demo-event-inspector.png');

  await click(win, '#mode-explore');
  await click(win, '[data-view="variables"]');
  await fill(win, '#search', 'demo_support');
  await clickRowContaining(win, '#list [data-row-key]', 'demo_support');
  await expectText(win, '#inspector', 'demo_support');
  await screenshot(win, artifactDir, '04-demo-variable-inspector');
  log('Variables show demo effect state', 'PASS', '04-demo-variable-inspector.png');
}

async function scenarioDynamicModSmoke(win, args, artifactDir, log) {
  const dynamicRoot = args.dynamicProjectRoot;
  if (!fs.existsSync(path.join(dynamicRoot, 'source', 'info.dry'))) {
    throw new Error('dynamic_mod_smoke requires a Dynamic project root with source/info.dry: ' + dynamicRoot);
  }
  const timeoutMs = Math.max(args.timeoutMs, 90000);

  await expectWelcomeSurfaceVisible(win, 'Quick Start overlay should be visible on first launch');
  await screenshot(win, artifactDir, '01-quick-start-dynamic');
  log('Quick Start appears for Dynamic smoke', 'PASS', '01-quick-start-dynamic.png');

  await clickWelcomePrimary(win);
  await waitForWelcomeSurfaceHidden(win, 'Quick Start should close after opening Dynamic');
  const loaded = await waitForProjectLoaded(win, dynamicRoot, timeoutMs);
  if (!String(loaded.projectName || '').includes('Social Democracy')) {
    throw new Error('Dynamic project did not load with the expected project name: ' + JSON.stringify(loaded));
  }
  await screenshot(win, artifactDir, '02-dynamic-loaded');
  log('Dynamic project loads through Quick Start', 'PASS', JSON.stringify(loaded.summary || {}));

  await click(win, '#mode-explore');
  await click(win, '[data-view="events"]');
  await fill(win, '#search', 'All Quiet');
  await clickRowContaining(win, '#list [data-row-key]', 'All Quiet on the Western Front');
  await expectText(win, '#inspector', 'All Quiet on the Western Front');
  await screenshot(win, artifactDir, '03-dynamic-existing-event');
  log('Explore selects a source-backed Dynamic event', 'PASS', '03-dynamic-existing-event.png');

  await click(win, '#inspector [data-edit-existing]');
  await expectVisible(win, '#existing-scene-editor-host [data-object-authoring-canvas="true"]', 'Dynamic existing event should open in Object Canvas');
  await click(win, '#existing-scene-editor-host [data-object-canvas-action="toggle_overlay"]');
  await expectVisible(win, '#existing-scene-editor-host [data-preview-object-editor="true"]', 'Dynamic existing object editor should open from the Storyboard');
  await editFirstExistingLongTextField(win, 'As a Dynamic smoke-test edit, this copied event now records a bounded prose replacement.');
  await expectText(win, '#existing-scene-editor-host', 'Dynamic smoke-test edit');
  await screenshot(win, artifactDir, '04-dynamic-existing-editor');
  log('Unified existing editor edits Dynamic source-backed prose', 'PASS', '04-dynamic-existing-editor.png');

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'All Quiet on the Western Front');
  await click(win, '#draft-workspace-list [data-draft-action="review"]');
  await waitFor(win, () => evalInPage(win, () => {
    const state = window.ProjectMapInstallAssistant && window.ProjectMapInstallAssistant.getState();
    return Boolean(state && state.plan && state.plan.draftKind === 'existing_scene_edit');
  }), 'Dynamic existing edit should review as existing_scene_edit');
  await screenshot(win, artifactDir, '05-dynamic-existing-review');
  log('Dynamic existing edit reviews as existing_scene_edit', 'PASS', '05-dynamic-existing-review.png');

  await click(win, '#install-dry-run');
  await expectDryRunWouldApply(win, 'Dynamic existing edit dry-run should produce a guarded operation');
  await screenshot(win, artifactDir, '06-dynamic-existing-dry-run');
  log('Dynamic existing edit dry-run succeeds', 'PASS', '06-dynamic-existing-dry-run.png');

  await closeObjectEditorIfOpen(win);
  await click(win, '#mode-create');
  await click(win, '[data-create-template="event"]');
  await fillDynamicSmokeWorldEvent(win);
  await screenshot(win, artifactDir, '07-dynamic-new-event-proposal');
  log('Dynamic new world event proposal renders', 'PASS', '07-dynamic-new-event-proposal.png');

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'Dynamic smoke world event');
  await click(win, '#draft-workspace-list [data-draft-action="review"]');
  await expectInstallOperationPath(win, 'source/scenes/events/dms_dynamic_smoke_world_event.scene.dry');
  await click(win, '#install-dry-run');
  await expectDryRunWouldApply(win, 'Dynamic world event dry-run should produce would_apply operations');
  await screenshot(win, artifactDir, '08-dynamic-new-event-dry-run');
  log('Dynamic new world event dry-run succeeds', 'PASS', '08-dynamic-new-event-dry-run.png');

  await click(win, '#mode-create');
  await click(win, '[data-create-template="card"]');
  await fillDynamicSmokeCard(win);
  await screenshot(win, artifactDir, '09-dynamic-card-proposal');
  log('Dynamic card proposal renders', 'PASS', '09-dynamic-card-proposal.png');

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'Dynamic smoke card');
  await click(win, '#draft-workspace-list [data-draft-action="review"]');
  await waitFor(win, () => evalInPage(win, () => {
    const state = window.ProjectMapInstallAssistant && window.ProjectMapInstallAssistant.getState();
    const operation = state && state.plan && state.plan.operations && state.plan.operations.find((item) => item.id === 'create_scene');
    return Boolean(operation && operation.type === 'create_file' && operation.path && operation.path.indexOf('source/scenes/') === 0);
  }), 'Dynamic card review should expose a source/scenes create_file operation');
  await click(win, '#install-dry-run');
  await expectDryRunWouldApply(win, 'Dynamic card dry-run should not hit unsafe_path');
  await screenshot(win, artifactDir, '10-dynamic-card-dry-run');
  log('Dynamic card dry-run succeeds without unsafe_path refusal', 'PASS', '10-dynamic-card-dry-run.png');
}

async function scenarioRuntimePreviewEntryFlow(_win, args, artifactDir, log) {
  const {BrowserWindow} = require('electron');
  const core = require(path.join(DESKTOP_DIR, 'studio_core.js'));
  const workspaceRoot = ensureDir(path.join(artifactDir, 'starter-workspace'));
  const scratchRoot = ensureDir(path.join(artifactDir, 'project-indexes'));
  const sessionsRoot = ensureDir(path.join(artifactDir, 'runtime-sessions'));
  const prepared = core.prepareStarterDemo({
    desktopDir: DESKTOP_DIR,
    workspaceRoot
  });
  if (!prepared.ok) {
    throw new Error('Could not prepare starter demo: ' + JSON.stringify(prepared));
  }
  log('Prepared starter demo copy', 'PASS', prepared.root);

  const indexed = await core.buildProjectIndex({
    root: prepared.root,
    outDir: scratchRoot,
    includeExcerpts: false
  });
  if (!indexed.ok) {
    throw new Error('Could not index starter demo for runtime preview: ' + JSON.stringify(indexed.error || indexed));
  }
  log('Built starter demo ProjectIndex', 'PASS', JSON.stringify(indexed.summary || {}));

  const entrySidebar = require(path.join(PROJECT_MAP_DIR, 'authoring', 'entry_sidebar_draft.js'));
  const draft = entrySidebar.defaultDraft(indexed.index);
  draft.id = 'runtime_preview_entry_flow';
  draft.title = 'Runtime Preview Entry Flow';
  draft.rootHeading = 'Runtime Preview Edited Entry';
  draft.rootIntro = 'Runtime Preview is testing an Entry & Sidebar edit before the first playable route.';
  draft.firstOptionTitle = 'Enter the runtime preview workspace';
  draft.sidebarHeading = 'Runtime Preview Status';
  draft.sidebarBody = 'This sidebar text came from the Entry & Sidebar workflow.';
  draft.sidebarStatusLines = '[? if demo_support > 0 : Runtime preview support is visible. ?]';
  const plan = entrySidebar.buildInstallPlan(draft, indexed.index);
  const preview = await core.createRuntimePreview({
    projectRoot: prepared.root,
    sessionsRoot,
    plan,
    projectIndex: indexed.index
  });
  if (!preview.ok) {
    throw new Error('Runtime Preview failed: ' + JSON.stringify(preview.diagnostics || preview));
  }
  if (!preview.installResult || preview.installResult.ok !== true) {
    throw new Error('Runtime Preview Entry/Sidebar install failed: ' + JSON.stringify(preview.installResult || {}));
  }
  log('Runtime Preview sandbox created', 'PASS', preview.modifiedUrl);

  const gameWin = new BrowserWindow({
    width: 1280,
    height: 820,
    show: Boolean(args.headed),
    backgroundColor: '#20230d'
  });
  try {
    await gameWin.loadURL(preview.modifiedUrl);
    await waitFor(gameWin, () => evalInPage(gameWin, () => {
      const text = document.body && (document.body.textContent || document.body.innerText) || '';
      return Boolean(text.trim().length > 0);
    }), 'Runtime Preview game should render body text', args.timeoutMs);
    const initialBody = await evalInPage(gameWin, () => {
      return String(document.body && (document.body.textContent || document.body.innerText) || '').slice(0, 500);
    });
    log('Runtime Preview game initial body text', 'PASS', initialBody.replace(/\s+/g, ' ').trim());
    await waitForGameText(gameWin, 'Runtime Preview Edited Entry', args.timeoutMs);
    await waitForGameText(gameWin, 'Enter the runtime preview workspace', args.timeoutMs);
    await screenshot(gameWin, artifactDir, '01-runtime-root');
    log('Runtime Preview root state before click', 'INFO', JSON.stringify(await runtimeGameSnapshot(gameWin)));
    await clickGameText(gameWin, 'Enter the runtime preview workspace');
    log('Runtime Preview root state after click', 'INFO', JSON.stringify(await runtimeGameSnapshot(gameWin)));
    await waitForGameText(gameWin, 'Workspace Hand', args.timeoutMs);
    await waitForGameText(gameWin, 'Review starter advisor', args.timeoutMs);
    await screenshot(gameWin, artifactDir, '02-runtime-first-route');
    await clickGameText(gameWin, 'Review starter advisor');
    log('Runtime Preview hand state after advisor click', 'INFO', JSON.stringify(await runtimeGameSnapshot(gameWin)));
    await waitForGameText(gameWin, 'Starter Advisor', args.timeoutMs);
    await clickGameText(gameWin, 'Ask for organizing help');
    await waitForGameText(gameWin, 'The advisor helps the office turn a loose idea into volunteer support.', args.timeoutMs);
    await clickGameText(gameWin, 'Continue');
    await waitForGameText(gameWin, 'Workspace Hand', args.timeoutMs);
    await waitForGameText(gameWin, 'Runtime preview support is visible.', args.timeoutMs);
    await screenshot(gameWin, artifactDir, '03-runtime-sidebar-changed');
    log('Runtime Preview clicked root choice, hand advisor choice, and observed sidebar change', 'PASS', '03-runtime-sidebar-changed.png');
  } finally {
    if (!gameWin.isDestroyed()) {
      gameWin.destroy();
    }
  }
}

async function scenarioNewEventConditionalRouteRuntimeFlow(_win, args, artifactDir, log) {
  const {BrowserWindow} = require('electron');
  const core = require(path.join(DESKTOP_DIR, 'studio_core.js'));
  const canvasModel = require(path.join(PROJECT_MAP_DIR, 'authoring', 'object_authoring_canvas_model.js'));
  const workspaceRoot = ensureDir(path.join(artifactDir, 'starter-workspace'));
  const scratchRoot = ensureDir(path.join(artifactDir, 'project-indexes'));
  const sessionsRoot = ensureDir(path.join(artifactDir, 'runtime-sessions'));
  const prepared = core.prepareStarterDemo({
    desktopDir: DESKTOP_DIR,
    workspaceRoot
  });
  if (!prepared.ok) {
    throw new Error('Could not prepare starter demo: ' + JSON.stringify(prepared));
  }
  log('Prepared starter demo copy', 'PASS', prepared.root);

  const indexed = await core.buildProjectIndex({
    root: prepared.root,
    outDir: scratchRoot,
    includeExcerpts: false
  });
  if (!indexed.ok) {
    throw new Error('Could not index starter demo for conditional event preview: ' + JSON.stringify(indexed.error || indexed));
  }
  log('Built starter demo ProjectIndex', 'PASS', JSON.stringify(indexed.summary || {}));

  const model = canvasModel.buildNewEventCanvas(indexed.index, {}, {
    values: {
      'event.pattern': 'conditional_menu_loop',
      'event.id': 'qa_conditional_menu_loop',
      'event.title': 'QA Conditional Menu Loop',
      'event.heading': 'QA Conditional Menu Loop'
    }
  });
  if (!model.ok || !model.changeState || !model.changeState.installPlan) {
    throw new Error('Conditional menu event draft was not reviewable: ' + JSON.stringify(model.changeState && model.changeState.diagnostics || model));
  }
  const graph = model.eventBody && model.eventBody.eventGraph || {};
  if (!Array.isArray(graph.edges) || !graph.edges.some((edge) => edge.kind === 'choice' && edge.from === 'section:menu_loop')) {
    throw new Error('Conditional menu Route Map did not preserve section-owned choices: ' + JSON.stringify(graph.edges || []));
  }
  if (!Array.isArray(graph.nodes) || !graph.nodes.some((node) => node.id === 'option:follow_up_action' && Array.isArray(node.secondaryActions) && node.secondaryActions.some((action) => action.fieldId === 'option.2.chooseIf'))) {
    throw new Error('Conditional menu Route Map did not expose option condition editing.');
  }
  log('Built conditional menu event through Object Canvas draft pipeline', 'PASS', model.source && model.source.path || 'qa_conditional_menu_loop');

  const preview = await core.createRuntimePreview({
    projectRoot: prepared.root,
    sessionsRoot,
    plan: model.changeState.installPlan,
    projectIndex: indexed.index
  });
  if (!preview.ok) {
    throw new Error('Runtime Preview failed: ' + JSON.stringify(preview.diagnostics || preview));
  }
  if (!preview.installResult || preview.installResult.ok !== true) {
    throw new Error('Runtime Preview conditional event install failed: ' + JSON.stringify(preview.installResult || {}));
  }
  if (!preview.debug || !preview.debug.enabled) {
    throw new Error('Runtime Preview debug console is required for Focused Entry.');
  }
  if (!preview.compareUrl) {
    throw new Error('Runtime Preview compare URL is missing.');
  }
  log('Runtime Preview sandbox created with Focused Entry controls', 'PASS', preview.compareUrl);

  const gameWin = new BrowserWindow({
    width: 1360,
    height: 860,
    show: Boolean(args.headed),
    backgroundColor: '#f4f2ec'
  });
  try {
    await gameWin.loadURL(preview.compareUrl);
    await waitForModifiedRuntimeBridge(gameWin, args.timeoutMs);
    const beforeFocusObservation = await modifiedRuntimeRouteObservation(gameWin, {
      entryMode: 'focused_entry',
      focusedEntry: true,
      clickPath: []
    });
    const focused = await applyModifiedFocusPreset(gameWin, 'qa_conditional_menu_loop');
    if (!focused || focused.ok !== true) {
      throw new Error('Focused Entry could not open the created event: ' + JSON.stringify(focused || {}));
    }
    await waitForModifiedGameText(gameWin, 'QA Conditional Menu Loop', args.timeoutMs);
    await waitForModifiedGameText(gameWin, 'Review the situation', args.timeoutMs);
    await screenshot(gameWin, artifactDir, '01-focused-entry-created-event');
    const focusObservation = await modifiedRuntimeRouteObservation(gameWin, {
      entryMode: 'focused_entry',
      focusedEntry: true,
      clickPath: ['Focused Entry: qa_conditional_menu_loop']
    });
    focusObservation.qDiff = diffObjectSnapshots(beforeFocusObservation.qSnapshot, focusObservation.qSnapshot);
    log('Focused Entry opened the install-plan-created event', 'PASS', JSON.stringify(Object.assign({focused}, focusObservation)));

    await clickModifiedGameText(gameWin, 'Review the situation');
    await advanceModifiedGameIfTextVisible(gameWin, 'Continue');
    await waitForModifiedGameText(gameWin, 'Follow-up menu', args.timeoutMs);
    await waitForModifiedGameText(gameWin, 'Take the follow-up action', args.timeoutMs);
    await screenshot(gameWin, artifactDir, '02-follow-up-menu');
    log('Root option reached the follow-up menu', 'PASS', JSON.stringify(await modifiedRuntimeRouteObservation(gameWin, {
      entryMode: 'focused_entry',
      focusedEntry: true,
      clickPath: ['Focused Entry: qa_conditional_menu_loop', 'Review the situation']
    })));

    await clickModifiedGameText(gameWin, 'Take the follow-up action');
    await waitForModifiedGameText(gameWin, 'The follow-up action changes the situation.', args.timeoutMs);
    await advanceModifiedGameIfTextVisible(gameWin, 'Continue');
    await waitForModifiedGameText(gameWin, 'Follow-up menu', args.timeoutMs);
    await screenshot(gameWin, artifactDir, '03-section-option-loop-return');
    log('Section-owned option reached its result and returned to the menu', 'PASS', JSON.stringify(await modifiedRuntimeRouteObservation(gameWin, {
      entryMode: 'focused_entry',
      focusedEntry: true,
      clickPath: ['Focused Entry: qa_conditional_menu_loop', 'Review the situation', 'Take the follow-up action', 'Continue']
    })));

    await clickModifiedGameText(gameWin, 'Return to the opening question');
    await advanceModifiedGameIfTextVisible(gameWin, 'Continue');
    await waitForModifiedGameText(gameWin, 'Review the situation', args.timeoutMs);
    await screenshot(gameWin, artifactDir, '04-returned-to-opening');
    const finalObservation = await modifiedRuntimeRouteObservation(gameWin, {
      entryMode: 'focused_entry',
      focusedEntry: true,
      clickPath: ['Focused Entry: qa_conditional_menu_loop', 'Review the situation', 'Take the follow-up action', 'Continue', 'Return to the opening question']
    });
    finalObservation.qDiff = diffObjectSnapshots(beforeFocusObservation.qSnapshot, finalObservation.qSnapshot);
    log('Menu exit path returned to the opening choice', 'PASS', JSON.stringify(finalObservation));
  } finally {
    if (!gameWin.isDestroyed()) {
      gameWin.destroy();
    }
  }
}

async function scenarioJusticePartyTemplateMod(win, args, artifactDir, log) {
  await expectWelcomeSurfaceVisible(win, 'Quick Start overlay should be visible on first launch');
  await expectVisible(win, '#onboarding-load-demo', 'Quick Start should expose bundled demo template action');
  await screenshot(win, artifactDir, '01-quick-start-template');
  log('Quick Start offers template start', 'PASS', '01-quick-start-template.png');
  await observeStep(args);

  await click(win, '#onboarding-load-demo');
  await waitForWelcomeSurfaceHidden(win, 'Quick Start should close after loading demo template');
  const loaded = await waitForProjectNamed(win, 'Dendry Mod Studio Starter Demo', args.timeoutMs);
  fs.accessSync(loaded.root, fs.constants.W_OK);
  await screenshot(win, artifactDir, '02-template-loaded');
  log('Bundled template opens as writable playtest project', 'PASS', JSON.stringify(loaded.summary || {}));
  await observeStep(args);

  await click(win, '#mode-explore');
  await click(win, '[data-view="events"]');
  await fill(win, '#search', 'Civic Reform');
  await clickRowContaining(win, '#list [data-row-key]', 'Civic Reform Office Briefing');
  await expectText(win, '#inspector', 'demo_support');
  await screenshot(win, artifactDir, '03-template-event-reference');
  log('Player inspects the template event before drafting', 'PASS', '03-template-event-reference.png');
  await observeStep(args);

  await click(win, '#mode-create');
  await click(win, '[data-create-template="entry"]');
  await fillJusticeEntrySidebar(win);
  await fill(win, '#entry-variable-search', 'support');
  await clickEntryVariableCandidateAction(win, 'demo_support');
  await expectFieldContains(win, '#entry-sidebar-status-lines', 'demo_support > 0');
  await appendToField(win, '#entry-sidebar-status-lines', '[? if demo_resources > 1 : The Justice Party office still has spare organizing capacity. ?]\n[? if demo_advisor_trust > 0 : The labor advisor has begun trusting the office. ?]\n[? if demo_card_progress > 0 : Party-work cards have moved the campaign forward. ?]');
  await waitForEntryOutput(win, 'justice_party_template_mod');
  await screenshot(win, artifactDir, '04-entry-sidebar-edited');
  log('Entry & Sidebar edits the welcome page, status display, and variable-backed sidebar lines', 'PASS', '04-entry-sidebar-edited.png');
  await observeStep(args);

  await click(win, '#entry-create-first-event');
  await expectValue(win, '#wizard-id', 'justice_party_template_mod_first_event');
  await screenshot(win, artifactDir, '05-first-event-shortcut');
  log('Create first event shortcut seeds the World Event Wizard', 'PASS', '05-first-event-shortcut.png');
  await observeStep(args);

  await fillJusticeCampaignEvent(win, 'justice_party_template_mod_first_event');
  await waitForEventOutput(win, 'justice_party_template_mod_first_event');
  await screenshot(win, artifactDir, '06-variable-assisted-campaign-event');
  log('Justice Party first playable event uses the seeded target and custom effects', 'PASS', '06-variable-assisted-campaign-event.png');
  await observeStep(args);

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'Justice Party campaign office');
  await screenshot(win, artifactDir, '07-campaign-event-saved');
  log('Campaign event saves to My Changes', 'PASS', '07-campaign-event-saved.png');
  await observeStep(args);

  await click(win, '[data-create-template="entry"]');
  await waitForEntryOutput(win, 'justice_party_template_mod');
  await syncEntryDraftToObjectCanvas(win);
  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'Justice Party start menu');
  await clickDraftActionContaining(win, 'Justice Party start menu', 'review');
  await expectText(win, '#install-checklist', 'replace_section');
  await click(win, '#install-dry-run');
  const entryResult = await waitForInstallResult(win, (result) => {
    const rows = Array.isArray(result && result.results) ? result.results : [];
    return Boolean(result && result.ok === true &&
      rows.some((item) => item.id === 'entry_opening_section' && item.status === 'would_apply') &&
      rows.some((item) => item.id === 'sidebar_section' && item.status === 'would_apply') &&
      !rows.some((item) => item.status === 'failed'));
  }, 'Entry & Sidebar dry-run should include guarded replace_section operations');
  await screenshot(win, artifactDir, '08-entry-sidebar-dry-run');
  log('Entry & Sidebar Review & Apply dry-run succeeds', 'PASS', JSON.stringify(statusSummary(entryResult)));
  await observeStep(args);

  await click(win, '#mode-create');
  await openAuthoringTemplate(win, 'play_surface');
  await fillJusticePlaySurface(win);
  await waitForPlaySurfaceOutput(win, 'justice_party_play_surface');
  await screenshot(win, artifactDir, '08b-play-surface-edited');
  log('Playable Surface customizes the Justice Party hand, deck, starter card, and advisor', 'PASS', '08b-play-surface-edited.png');
  await observeStep(args);

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'Justice Party playable surface');
  await clickDraftActionContaining(win, 'Justice Party playable surface', 'review');
  await expectText(win, '#install-checklist', 'source/scenes/main.scene.dry');
  await expectText(win, '#install-checklist', 'replace_section');
  await click(win, '#install-dry-run');
  const playSurfaceResult = await waitForInstallResult(win, (result) => {
    const rows = Array.isArray(result && result.results) ? result.results : [];
    return Boolean(result && result.ok === true &&
      rows.some((item) => item.id === 'hand_opening' && item.status === 'would_apply') &&
      rows.some((item) => item.id === 'card_opening' && item.status === 'would_apply') &&
      rows.some((item) => item.id === 'advisor_opening' && item.status === 'would_apply') &&
      !rows.some((item) => item.status === 'failed'));
  }, 'Playable Surface dry-run should include guarded hand/card/advisor replacements');
  await screenshot(win, artifactDir, '08c-play-surface-dry-run');
  log('Playable Surface Review & Apply dry-run succeeds', 'PASS', JSON.stringify(statusSummary(playSurfaceResult)));
  await observeStep(args);

  await click(win, '#mode-create');
  await openAuthoringTemplate(win, 'workspace_layout');
  await fillJusticeWorkspaceLayout(win);
  await waitForWorkspaceLayoutOutput(win, 'justice_party_workspace_layout');
  await screenshot(win, artifactDir, '08d-workspace-layout-edited');
  log('Workspace Layout adds a Justice Party media deck, first media card, and sidebar category', 'PASS', '08d-workspace-layout-edited.png');
  await observeStep(args);

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'Justice Party workspace layout');
  await clickDraftActionContaining(win, 'Justice Party workspace layout', 'review');
  await expectText(win, '#install-checklist', 'source/scenes/decks/justice_party_media_deck.scene.dry');
  await expectText(win, '#install-checklist', 'source/scenes/cards/justice_party_media_briefing_card.scene.dry');
  await click(win, '#install-dry-run');
  const layoutResult = await waitForInstallResult(win, (result) => {
    const rows = Array.isArray(result && result.results) ? result.results : [];
    return Boolean(result && result.ok === true &&
      rows.some((item) => item.id === 'create_deck_scene' && item.path === 'source/scenes/decks/justice_party_media_deck.scene.dry' && item.status === 'would_apply') &&
      rows.some((item) => item.id === 'create_starter_card' && item.path === 'source/scenes/cards/justice_party_media_briefing_card.scene.dry' && item.status === 'would_apply') &&
      rows.some((item) => item.id === 'hand_deck_route' && item.status === 'would_apply') &&
      rows.some((item) => item.id === 'sidebar_category' && item.status === 'would_apply') &&
      !rows.some((item) => item.status === 'failed'));
  }, 'Workspace Layout dry-run should create a deck and insert hand/sidebar anchors');
  await screenshot(win, artifactDir, '08e-workspace-layout-dry-run');
  log('Workspace Layout Review & Apply dry-run succeeds', 'PASS', JSON.stringify(statusSummary(layoutResult)));
  await observeStep(args);

  await click(win, '#mode-create');
  await openAuthoringTemplate(win, 'sidebar_status');
  await fillJusticeSidebarStatus(win);
  await waitForSidebarStatusOutput(win, 'justice_party_sidebar_status');
  await screenshot(win, artifactDir, '08f-sidebar-status-edited');
  log('Sidebar / Status edits an existing source-backed sidebar category with a variable-backed line', 'PASS', '08f-sidebar-status-edited.png');
  await observeStep(args);

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'Justice Party sidebar status');
  await clickDraftActionContaining(win, 'Justice Party sidebar status', 'review');
  await expectText(win, '#install-checklist', 'source/scenes/status.scene.dry');
  await expectText(win, '#install-checklist', 'replace_section');
  await click(win, '#install-dry-run');
  const sidebarStatusResult = await waitForInstallResult(win, (result) => {
    const rows = Array.isArray(result && result.results) ? result.results : [];
    return Boolean(result && result.ok === true &&
      rows.some((item) => item.id === 'sidebar_status_title' && item.status === 'would_apply') &&
      rows.some((item) => item.id === 'sidebar_status_section' && item.status === 'would_apply') &&
      !rows.some((item) => item.status === 'failed'));
  }, 'Sidebar / Status dry-run should replace the selected status section');
  await screenshot(win, artifactDir, '08g-sidebar-status-dry-run');
  log('Sidebar / Status Review & Apply dry-run succeeds', 'PASS', JSON.stringify(statusSummary(sidebarStatusResult)));
  await observeStep(args);

  await click(win, '#mode-create');
  await click(win, '[data-create-template="card"]');
  await fillJusticePartyActionCard(win);
  await waitForCardOutput(win, 'justice_party_party_affairs_card', 'is-card: true');
  await screenshot(win, artifactDir, '09-party-affairs-card');
  log('Card Wizard creates a Justice Party party-affairs card routed through the starter deck tag', 'PASS', '09-party-affairs-card.png');
  await observeStep(args);

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'Justice Party party affairs card');
  await clickDraftActionContaining(win, 'Justice Party party affairs card', 'review');
  await expectText(win, '#install-checklist', 'source/scenes/cards/justice_party_party_affairs_card.scene.dry');
  await click(win, '#install-dry-run');
  const partyCardResult = await waitForInstallResult(win, (result) => {
    const rows = Array.isArray(result && result.results) ? result.results : [];
    return Boolean(result && result.ok === true &&
      rows.some((item) => item.id === 'create_scene' && item.path === 'source/scenes/cards/justice_party_party_affairs_card.scene.dry' && item.status === 'would_apply') &&
      !rows.some((item) => item.status === 'failed'));
  }, 'Party-affairs card dry-run should create a routed card scene');
  await screenshot(win, artifactDir, '10-party-affairs-card-dry-run');
  log('Party-affairs card Review & Apply dry-run succeeds', 'PASS', JSON.stringify(statusSummary(partyCardResult)));
  await observeStep(args);

  await click(win, '#mode-create');
  await click(win, '[data-create-template="card"]');
  await fillJusticePartyAdvisorCard(win);
  await waitForCardOutput(win, 'justice_party_labor_advisor', 'is-pinned-card: true');
  await screenshot(win, artifactDir, '11-labor-advisor-card');
  log('Card Wizard creates a Justice Party labor advisor routed through the starter advisor tag', 'PASS', '11-labor-advisor-card.png');
  await observeStep(args);

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'Justice Party labor advisor');
  await clickDraftActionContaining(win, 'Justice Party labor advisor', 'review');
  await expectText(win, '#install-checklist', 'source/scenes/advisors/justice_party_labor_advisor.scene.dry');
  await click(win, '#install-dry-run');
  const advisorResult = await waitForInstallResult(win, (result) => {
    const rows = Array.isArray(result && result.results) ? result.results : [];
    return Boolean(result && result.ok === true &&
      rows.some((item) => item.id === 'create_scene' && item.path === 'source/scenes/advisors/justice_party_labor_advisor.scene.dry' && item.status === 'would_apply') &&
      !rows.some((item) => item.status === 'failed'));
  }, 'Advisor card dry-run should create a routed advisor scene');
  await screenshot(win, artifactDir, '12-labor-advisor-card-dry-run');
  log('Labor advisor Review & Apply dry-run succeeds', 'PASS', JSON.stringify(statusSummary(advisorResult)));
  await observeStep(args);

  await click(win, '#mode-create');
  await click(win, '[data-create-template="event"]');
  await fillJusticeCampaignEvent(win, 'justice_party_campaign_office');
  await fill(win, '#wizard-requires', '');
  await focus(win, '#wizard-requires');
  await fill(win, '#wizard-variable-search', 'support');
  await clickVariableCandidateAction(win, 'demo_support', 'insert-condition');
  await expectValue(win, '#wizard-requires', 'demo_support = 1');
  await clickVariableCandidateAction(win, 'demo_support', 'use-effect');
  await fill(win, '#wizard-effect-target', 'option:0');
  await fill(win, '#wizard-effect-op', '+=');
  await fill(win, '#wizard-effect-value', '1');
  await click(win, '#wizard-effect-append');
  await appendToField(win, '#wizard-option-0-effects', 'justice_party_support += 1\nlabor_green_alliance += 1');
  await appendToField(win, '#wizard-option-1-effects', 'parliamentary_strategy += 1\ngrassroots_energy -= 1');
  await waitForEventOutput(win, 'justice_party_campaign_office');
  await screenshot(win, artifactDir, '13-variable-assisted-campaign-event');
  log('Justice Party event uses variable recommendations and custom effects', 'PASS', '13-variable-assisted-campaign-event.png');
  await observeStep(args);

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'Justice Party campaign office');
  await screenshot(win, artifactDir, '14-campaign-event-saved');
  log('Campaign event saves to My Changes', 'PASS', '14-campaign-event-saved.png');
  await observeStep(args);

  await click(win, '[data-create-template="event"]');
  await fillTraditionalJusticeNewsEvent(win);
  await waitForEventOutput(win, 'justice_party_monthly_popup');
  await screenshot(win, artifactDir, '15-traditional-news-event');
  log('Traditional monthly-popup news is drafted as a World Event', 'PASS', '15-traditional-news-event.png');
  await observeStep(args);

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'Justice Party monthly popup');
  log('Traditional news-style event saves to My Changes', 'PASS', 'My Changes contains Justice Party monthly popup');

  await clickDraftActionContaining(win, 'Justice Party monthly popup', 'review');
  await expectInstallOperationPath(win, 'source/scenes/events/justice_party_monthly_popup.scene.dry');
  await click(win, '#install-dry-run');
  const traditionalResult = await waitForInstallResult(win, (result) => {
    return Boolean(result && result.results && result.results.some((item) => item.id === 'create_scene' && item.status === 'would_apply'));
  }, 'Traditional monthly-popup event dry-run should create a world-event scene');
  await screenshot(win, artifactDir, '16-traditional-news-dry-run');
  log('Traditional monthly-popup event dry-run succeeds', 'PASS', JSON.stringify(statusSummary(traditionalResult)));
  await observeStep(args);

  await click(win, '#mode-create');
  await click(win, '[data-create-template="news"]');
  await fillIslandStyleJusticeNews(win);
  await waitForNewsOutput(win, 'justice_party_ticker_news');
  await screenshot(win, artifactDir, '17-island-style-news');
  log('Island-style ticker news draft renders a post_event_news snippet', 'PASS', '17-island-style-news.png');
  await observeStep(args);

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'Justice Party tests a labor-green pact');
  await clickDraftActionContaining(win, 'Justice Party tests a labor-green pact', 'review');
  await expectText(win, '#install-checklist', 'post_event_news');
  await click(win, '#install-dry-run');
  const islandResult = await waitForInstallResult(win, (result) => {
    return Boolean(result && result.ok === true && result.results && result.results.some((item) => {
      return item.path === 'source/scenes/post_event_news.scene.dry' &&
        (item.status === 'manual_review' || item.status === 'would_apply');
    }));
  }, 'Island-style news dry-run should preserve post_event_news manual/guarded boundary');
  await screenshot(win, artifactDir, '18-island-style-news-dry-run');
  log('Island-style news dry-run exposes post_event_news boundary', 'PASS', JSON.stringify(statusSummary(islandResult)));
  await observeStep(args);

  await click(win, '#mode-create');
  await expectText(win, '#draft-workspace-list', 'Justice Party start menu');
  await expectText(win, '#draft-workspace-list', 'Justice Party playable surface');
  await expectText(win, '#draft-workspace-list', 'Justice Party workspace layout');
  await expectText(win, '#draft-workspace-list', 'Justice Party party affairs card');
  await expectText(win, '#draft-workspace-list', 'Justice Party labor advisor');
  await expectText(win, '#draft-workspace-list', 'Justice Party campaign office');
  await expectText(win, '#draft-workspace-list', 'Justice Party monthly popup');
  await expectText(win, '#draft-workspace-list', 'Justice Party tests a labor-green pact');
  await screenshot(win, artifactDir, '19-mod-draft-set');
  log('Justice Party mod draft set remains available in My Changes', 'PASS', '19-mod-draft-set.png');
  await observeStep(args);
}

async function fillJusticeEntrySidebar(win) {
  await fill(win, '#entry-id', 'justice_party_template_mod');
  await fill(win, '#entry-title', 'Justice Party start menu');
  await fill(win, '#entry-root-title', 'Justice Party Campaign');
  await fill(win, '#entry-root-heading', 'Justice Party Campaign Office');
  await fill(win, '#entry-root-intro', 'A small Justice Party team opens the first month of organizing with labor, climate, and local democracy all competing for attention.');
  await fill(win, '#entry-first-option-title', 'Begin the Justice Party opening');
  await fill(win, '#entry-sidebar-title', 'Justice Party Status');
  await fill(win, '#entry-sidebar-heading', 'Civic Reform Dashboard');
  await fill(win, '#entry-sidebar-body', 'Track whether the new office has turned the template into a playable campaign route.');
  await fill(win, '#entry-sidebar-status-lines', '');
}

async function fillJusticePlaySurface(win) {
  await fill(win, '#play-surface-id', 'justice_party_play_surface');
  await fill(win, '#play-surface-title', 'Justice Party playable surface');
  await fill(win, '#play-surface-hand-title', 'Justice Party Affairs Hand');
  await fill(win, '#play-surface-hand-heading', 'Justice Party Affairs Hand');
  await fill(win, '#play-surface-hand-body', 'The new campaign office turns labor, climate, and local democracy work into a visible hand of party tasks. The player can open the party affairs deck or consult a standing labor organizer.');
  await fill(win, '#play-surface-hand-deck-option-label', 'Open party affairs deck');
  await fill(win, '#play-surface-hand-advisor-option-label', 'Consult labor organizer');
  await fill(win, '#play-surface-deck-title', 'Party Affairs Deck');
  await fill(win, '#play-surface-deck-subtitle', 'Weekly organizing work');
  await fill(win, '#play-surface-card-title', 'Local Organizing Push');
  await fill(win, '#play-surface-card-heading', 'Plan the week of local organizing');
  await fill(win, '#play-surface-card-body', 'The Justice Party team decides whether to spend volunteer capacity on street outreach or preserve it for coalition calls later in the month.');
  await fill(win, '#play-surface-card-option0-label', 'Spend volunteer capacity');
  await fill(win, '#play-surface-card-option1-label', 'Save capacity for coalition calls');
  await fill(win, '#play-surface-advisor-title', 'Labor Organizer');
  await fill(win, '#play-surface-advisor-subtitle', 'Workplace and union guidance');
  await fill(win, '#play-surface-advisor-heading', 'Labor Organizer');
  await fill(win, '#play-surface-advisor-body', 'A workplace organizer keeps the party connected to shop-floor concerns and helps turn policy language into people the office can actually call.');
  await fill(win, '#play-surface-advisor-option0-label', 'Ask for a workplace map');
  await syncWizardDraftToObjectCanvas(win, 'play_surface', 'ProjectMapPlaySurfaceWizard');
}

async function fillJusticeWorkspaceLayout(win) {
  await fill(win, '#workspace-layout-id', 'justice_party_workspace_layout');
  await fill(win, '#workspace-layout-title', 'Justice Party workspace layout');
  await fill(win, '#workspace-layout-deck-id', 'justice_party_media_deck');
  await fill(win, '#workspace-layout-deck-title', 'Justice Party Media Deck');
  await fill(win, '#workspace-layout-deck-subtitle', 'Messages and press work');
  await fill(win, '#workspace-layout-deck-tag', 'justice_party_media');
  await fill(win, '#workspace-layout-hand-option-label', 'Open media deck');
  await fill(win, '#workspace-layout-hand-insert-mode', 'before_root');
  await fill(win, '#workspace-layout-starter-card-id', 'justice_party_media_briefing_card');
  await fill(win, '#workspace-layout-starter-card-title', 'Media Briefing');
  await fill(win, '#workspace-layout-starter-card-heading', 'Shape the campaign narrative');
  await fill(win, '#workspace-layout-starter-card-return-target', 'main');
  await fill(win, '#workspace-layout-starter-card-body', 'The Justice Party office chooses whether to hold a public briefing or reserve capacity for coalition calls.');
  await fill(win, '#workspace-layout-starter-card-option0-label', 'Hold a press briefing');
  await fill(win, '#workspace-layout-starter-card-option0-variable', 'media_attention');
  await fill(win, '#workspace-layout-starter-card-option0-delta', '1');
  await fill(win, '#workspace-layout-starter-card-option1-label', 'Prepare coalition calls');
  await fill(win, '#workspace-layout-starter-card-option1-variable', 'coalition_trust');
  await fill(win, '#workspace-layout-starter-card-option1-delta', '1');
  await fill(win, '#workspace-layout-sidebar-category-id', 'media');
  await fill(win, '#workspace-layout-sidebar-heading', 'Media Desk');
  await fill(win, '#workspace-layout-sidebar-insert-mode', 'before_category');
  await fill(win, '#workspace-layout-sidebar-anchor-id', 'politics');
  await fill(win, '#workspace-layout-sidebar-body', 'Track whether the Justice Party office can turn campaign choices into a public narrative.');
  await fill(win, '#workspace-layout-sidebar-status-lines', '[? if media_attention > 0 : Reporters are watching the Justice Party experiment. ?]');
  await syncWizardDraftToObjectCanvas(win, 'workspace_layout', 'ProjectMapWorkspaceLayoutWizard');
}

async function fillJusticeSidebarStatus(win) {
  await fill(win, '#sidebar-status-id', 'justice_party_sidebar_status');
  await fill(win, '#sidebar-status-title', 'Justice Party sidebar status');
  await fill(win, '#sidebar-status-status-title', 'Justice Party Status');
  await fill(win, '#sidebar-status-section-id', 'organization');
  await fill(win, '#sidebar-status-section-heading', 'Justice Party Organization');
  await fill(win, '#sidebar-status-section-body', 'Track branches, volunteer energy, local dues, coalition trust, and the party-affairs workspace.');
  await fill(win, '#sidebar-status-section-status-lines', '[? if justice_party_support > 0 : The Justice Party office has visible local support. ?]');
  await fill(win, '#sidebar-status-condition-variable', 'coalition_trust');
  await click(win, '#sidebar-status-insert-condition');
  await syncWizardDraftToObjectCanvas(win, 'sidebar_status', 'ProjectMapSidebarStatusWizard');
}

async function fillJusticeCampaignEvent(win, eventId) {
  await fill(win, '#wizard-id', eventId || 'justice_party_campaign_office');
  await fill(win, '#wizard-title', 'Justice Party campaign office');
  await fill(win, '#wizard-heading', 'A Justice Party office opens its doors');
  await fill(win, '#wizard-year', '2025');
  await fill(win, '#wizard-month-start', '3');
  await fill(win, '#wizard-month-end', '5');
  await fill(win, '#wizard-priority', '1');
  await fill(win, '#wizard-trigger-effects', 'justice_party_campaign_seen = 1');
  await fill(win, '#wizard-intro', 'A small Justice Party office tries to turn labor rights, climate policy, and neighborhood frustration into a playable campaign path.');
  await fill(win, '#wizard-option-0-id', 'build_labor_green_pact');
  await fill(win, '#wizard-option-0-title', 'Build a labor-green pact');
  await fill(win, '#wizard-option-0-subtitle', 'Put workers and climate organizers in the same room.');
  await fill(win, '#wizard-option-0-effects', '');
  await fill(win, '#wizard-option-0-body', 'Organizers map workplaces, tenant groups, and climate campaigns onto one shared calendar. The office gains momentum because the coalition feels concrete rather than symbolic.');
  await fill(win, '#wizard-option-1-id', 'prioritize_assembly_talks');
  await fill(win, '#wizard-option-1-title', 'Prioritize assembly talks');
  await fill(win, '#wizard-option-1-subtitle', 'Trade street energy for a more careful parliamentary route.');
  await fill(win, '#wizard-option-1-effects', '');
  await fill(win, '#wizard-option-1-body', 'The campaign desk calls sympathetic lawmakers first. The move opens institutional doors, but volunteers worry the new party is already learning to speak too softly.');
  await syncEventWizardDraftToObjectCanvas(win);
}

async function fillJusticePartyActionCard(win) {
  await fill(win, '#card-id', 'justice_party_party_affairs_card');
  await fill(win, '#card-kind', 'action_card');
  await fill(win, '#card-title', 'Justice Party party affairs card');
  await fill(win, '#card-heading', 'Justice Party party affairs desk');
  await fill(win, '#card-tags', 'demo_action');
  await fill(win, '#card-view-if', '');
  await fill(win, '#card-priority', '1');
  await fill(win, '#card-frequency', '100');
  await fill(win, '#card-max-visits', '');
  await fill(win, '#card-subtitle', 'A repeatable party-work card for the starter hand.');
  await fill(win, '#card-intro', 'The office turns a vague organizing plan into a concrete week of party work: district calls, workplace visits, and volunteer follow-up.');
  await fill(win, '#card-option-count', '2');
  await fill(win, '#card-option-0-id', 'open_district_calls');
  await fill(win, '#card-option-0-label', 'Open district calls');
  await fill(win, '#card-option-0-subtitle', 'Spend capacity to organize a visible week.');
  await fill(win, '#card-option-0-effects', 'demo_resources -= 1\ndemo_support += 1\ndemo_card_progress += 1');
  await fill(win, '#card-option-0-body', 'Volunteers call local members and turn the office calendar into a party-work hand.');
  await fill(win, '#card-option-0-choose-if', 'demo_resources >= 1');
  await fill(win, '#card-option-0-unavailable', 'Resources are too low.');
  await fill(win, '#card-option-0-goto-after', 'main');
  await fill(win, '#card-option-1-id', 'hold_capacity');
  await fill(win, '#card-option-1-label', 'Hold capacity');
  await fill(win, '#card-option-1-subtitle', 'Keep the office ready for a better opening.');
  await fill(win, '#card-option-1-effects', 'demo_resources += 1');
  await fill(win, '#card-option-1-body', 'The desk keeps capacity for a stronger opening next week.');
  await fill(win, '#card-option-1-choose-if', '');
  await fill(win, '#card-option-1-unavailable', '');
  await fill(win, '#card-option-1-goto-after', 'main');
  await syncWizardDraftToObjectCanvas(win, 'card', 'ProjectMapCardWizard');
}

async function fillJusticePartyAdvisorCard(win) {
  await fill(win, '#card-id', 'justice_party_labor_advisor');
  await fill(win, '#card-kind', 'advisor_like');
  await fill(win, '#card-title', 'Justice Party labor advisor');
  await fill(win, '#card-heading', 'A labor organizer joins the office');
  await fill(win, '#card-tags', 'demo_advisor');
  await fill(win, '#card-view-if', '');
  await fill(win, '#card-priority', '');
  await fill(win, '#card-frequency', '');
  await fill(win, '#card-max-visits', '');
  await fill(win, '#card-subtitle', 'A persistent advisor for the starter hand.');
  await fill(win, '#card-intro', 'The advisor helps the Justice Party office connect workplace demands with local campaign capacity.');
  await fill(win, '#card-option-count', '2');
  await fill(win, '#card-option-0-id', 'ask_for_contacts');
  await fill(win, '#card-option-0-label', 'Ask for shop-floor contacts');
  await fill(win, '#card-option-0-subtitle', 'Turn trust into organizing reach.');
  await fill(win, '#card-option-0-effects', 'demo_advisor_trust += 1\ndemo_support += 1');
  await fill(win, '#card-option-0-body', 'The advisor opens a few careful conversations with union militants and workplace organizers.');
  await fill(win, '#card-option-0-choose-if', '');
  await fill(win, '#card-option-0-unavailable', '');
  await fill(win, '#card-option-0-goto-after', 'main');
  await fill(win, '#card-option-1-id', 'ask_for_caution');
  await fill(win, '#card-option-1-label', 'Ask for caution');
  await fill(win, '#card-option-1-subtitle', 'Keep promises inside the office capacity.');
  await fill(win, '#card-option-1-effects', 'demo_resources += 1');
  await fill(win, '#card-option-1-body', 'The advisor slows the desk down before it promises more than it can carry.');
  await fill(win, '#card-option-1-choose-if', '');
  await fill(win, '#card-option-1-unavailable', '');
  await fill(win, '#card-option-1-goto-after', 'main');
  await syncWizardDraftToObjectCanvas(win, 'card', 'ProjectMapCardWizard');
}

async function fillTraditionalJusticeNewsEvent(win) {
  await fill(win, '#wizard-id', 'justice_party_monthly_popup');
  await fill(win, '#wizard-title', 'Justice Party monthly popup');
  await fill(win, '#wizard-heading', 'Justice Party organizers claim a new opening');
  await fill(win, '#wizard-year', '2025');
  await fill(win, '#wizard-month-start', '6');
  await fill(win, '#wizard-month-end', '6');
  await fill(win, '#wizard-requires', 'justice_party_support = 1');
  await fill(win, '#wizard-priority', '2');
  await fill(win, '#wizard-trigger-effects', 'justice_party_news_seen = 1');
  await fill(win, '#wizard-intro', 'Monthly reports frame the Justice Party office as a small but visible challenge to older center-left habits. This is news to the player, but structurally it behaves like a routed event popup.');
  await fill(win, '#wizard-option-0-id', 'treat_as_momentum');
  await fill(win, '#wizard-option-0-title', 'Treat it as momentum');
  await fill(win, '#wizard-option-0-subtitle', 'Let the popup become organizing energy.');
  await fill(win, '#wizard-option-0-effects', 'justice_party_support += 1\nmedia_attention += 1');
  await fill(win, '#wizard-option-0-body', 'The office clips the report, shares it with allied unions, and turns a short burst of attention into another weekend of calls.');
  await fill(win, '#wizard-option-1-id', 'keep_message_local');
  await fill(win, '#wizard-option-1-title', 'Keep the message local');
  await fill(win, '#wizard-option-1-subtitle', 'Avoid overclaiming a fragile breakthrough.');
  await fill(win, '#wizard-option-1-effects', 'grassroots_energy += 1\nmedia_attention -= 1');
  await fill(win, '#wizard-option-1-body', 'The campaign thanks supporters but refuses to declare victory. Local organizers appreciate the restraint, even as the national story moves on.');
  await syncEventWizardDraftToObjectCanvas(win);
}

async function fillIslandStyleJusticeNews(win) {
  await loadNewsDraft(win, {
    schemaVersion: '0.1',
    kind: 'news_item',
    id: 'justice_party_ticker_news',
    delivery: 'dated',
    headline: '[Politics] Justice Party tests a labor-green pact',
    description: 'A Justice Party local office invites labor organizers and climate groups into a joint campaign committee, testing whether a small party can turn issue overlap into durable support.',
    when: {
      year: 2025,
      month: 7,
      slot: 1,
      requiresJs: 'Q.justice_party_support >= 1'
    },
    pool: {
      name: 'social_pool',
      requiresJs: ''
    }
  });
}

async function fillDynamicSmokeWorldEvent(win) {
  await openObjectCanvasDraft(win, 'event', {
    id: 'dms_dynamic_smoke_world_event',
    title: 'Dynamic smoke world event',
    heading: 'A Dynamic smoke proposal reaches review',
    year: 1930,
    monthStart: 2,
    monthEnd: 2,
    requires: 'started = 1',
    priority: 0,
    intro: 'A player writes a small Dynamic-style monthly popup and expects Studio to explain the resulting source changes before anything is applied.',
    options: [
      {
        id: 'acknowledge_dynamic_report',
        label: 'Acknowledge the report',
        subtitle: 'Keep the Dynamic edit modest.',
        effects: [{variable: 'resources', op: '-=', value: 1}],
        body: 'The party records the report and checks that Review & Apply stays bounded to the copied Dynamic project.'
      },
      {
        id: 'defer_dynamic_report',
        label: 'Defer the matter',
        subtitle: 'Leave the route for later.',
        body: 'The proposal remains visible without forcing source changes before review.'
      }
    ]
  });
  await expectText(win, '#existing-scene-editor-host', 'Dynamic smoke world event');
}

async function fillDynamicSmokeCard(win) {
  await openObjectCanvasDraft(win, 'card', {
    kind: 'card',
    id: 'dms_dynamic_smoke_card',
    cardKind: 'action_card',
    title: 'Dynamic smoke card',
    heading: 'Dynamic smoke card',
    tags: ['party_affairs'],
    priority: 1,
    frequency: 100,
    subtitle: 'A temporary Dynamic card proposal for path safety.',
    introParagraphs: ['The card verifies that Dynamic project-specific scene folders can be reviewed and dry-run safely.'],
    options: [
      {
        id: 'organize_dynamic_meeting',
        label: 'Organize a small meeting',
        subtitle: 'Spend one resource on party work.',
        chooseIf: 'resources >= 1',
        unavailableText: 'Resources are too low.',
        effects: [{variable: 'resources', op: '-=', value: 1}],
        narrativeParagraphs: ['A small meeting leaves a bounded source-level trace in the copied Dynamic fixture.'],
        gotoAfter: 'root'
      },
      {
        id: 'wait_dynamic_card',
        label: 'Wait',
        subtitle: 'Avoid spending resources.',
        narrativeParagraphs: ['Nothing changes beyond the reviewed card proposal.'],
        gotoAfter: 'root'
      }
    ]
  });
  await expectText(win, '#existing-scene-editor-host', 'Dynamic smoke card');
}

async function fillPersistentWorldEventDraft(win) {
  await fill(win, '#wizard-id', 'qa_persistent_event');
  await fill(win, '#wizard-title', 'QA persistent event');
  await fill(win, '#wizard-heading', 'A saved proposal returns');
  await fill(win, '#wizard-year', '2022');
  await fill(win, '#wizard-month-start', '3');
  await fill(win, '#wizard-month-end', '6');
  await fill(win, '#wizard-requires', '');
  await fill(win, '#wizard-trigger-effects', '');
  await fill(win, '#wizard-intro', 'A tester saves a proposal, leaves Studio, and expects the draft to still be there when they return.');
  await fill(win, '#wizard-option-0-id', 'resume_work');
  await fill(win, '#wizard-option-0-title', 'Resume the work');
  await fill(win, '#wizard-option-0-subtitle', 'Pick up the saved proposal.');
  await fill(win, '#wizard-option-0-effects', 'generic_score += 2');
  await fill(win, '#wizard-option-0-body', 'The saved draft returns with its install plan intact, so the tester can continue from My Changes.');
  await fill(win, '#wizard-option-1-id', 'pause_again');
  await fill(win, '#wizard-option-1-title', 'Pause again');
  await fill(win, '#wizard-option-1-subtitle', 'Leave the draft modest.');
  await fill(win, '#wizard-option-1-effects', 'generic_score -= 1');
  await fill(win, '#wizard-option-1-body', 'The tester keeps the proposal as a draft and verifies Studio does not apply anything until review.');
}

async function reloadStudioWindow(win, timeoutMs) {
  await win.loadFile(path.join(PROJECT_MAP_DIR, 'viewer', 'index.html'));
  await waitForPageReady(win, timeoutMs);
}

async function waitForProjectLoaded(win, expectedRoot, timeoutMs) {
  await waitFor(win, async () => {
    return evalInPage(win, async (root) => {
      const state = await window.dendryDesktop.getState();
      const lastRoot = state && state.lastProject && state.lastProject.root;
      const hasIndex = Boolean(window.ProjectMapWizard && window.ProjectMapWizard.getState().projectIndex);
      return Boolean(hasIndex && lastRoot === root);
    }, expectedRoot);
  }, 'Project should load from desktop project picker: ' + expectedRoot, timeoutMs);
  return evalInPage(win, async () => {
    const state = await window.dendryDesktop.getState();
    return state && state.lastProject || {};
  });
}

async function waitForProjectNamed(win, expectedName, timeoutMs) {
  await waitFor(win, async () => {
    return evalInPage(win, async (name) => {
      const state = await window.dendryDesktop.getState();
      const lastProject = state && state.lastProject;
      const hasIndex = Boolean(window.ProjectMapWizard && window.ProjectMapWizard.getState().projectIndex);
      return Boolean(hasIndex && lastProject && lastProject.projectName === name);
    }, expectedName);
  }, 'Project should load by name: ' + expectedName, timeoutMs);
  return evalInPage(win, async () => {
    const state = await window.dendryDesktop.getState();
    return state && state.lastProject || {};
  });
}

async function waitForPageReady(win, timeoutMs) {
  await waitFor(win, () => evalInPage(win, () => document.readyState === 'complete'), 'document ready', timeoutMs);
  await waitFor(win, () => evalInPage(win, () => Boolean(window.ProjectMapWizard && window.ProjectMapInstallAssistant)), 'Studio globals ready', timeoutMs);
}

async function click(win, selector) {
  const result = await evalInPage(win, (targetSelector) => {
    const isVisible = (candidate) => {
      if (!candidate) {
        return false;
      }
      const rect = candidate.getBoundingClientRect();
      const style = window.getComputedStyle(candidate);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && !candidate.hidden;
    };
    const element = Array.from(document.querySelectorAll(targetSelector)).find(isVisible) || document.querySelector(targetSelector);
    if (!element) {
      return {ok: false, reason: 'missing'};
    }
    if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
      return {ok: false, reason: 'disabled'};
    }
    element.scrollIntoView({block: 'center', inline: 'center'});
    element.click();
    return {ok: true};
  }, selector);
  if (!result || !result.ok) {
    throw new Error('Could not click selector: ' + selector + (result && result.reason ? ' (' + result.reason + ')' : ''));
  }
}

async function dispatchStoryboardPointerClick(win, cardKey) {
  const result = await evalInPage(win, (key) => {
    const selector = '[data-content-storyboard-card="' + cssEscape(key) + '"]';
    const card = document.querySelector(selector);
    if (!card) {
      return {ok: false, reason: 'missing-card'};
    }
    card.scrollIntoView({block: 'center', inline: 'center'});
    const rect = card.getBoundingClientRect();
    const clientX = Math.round(rect.left + Math.min(96, Math.max(24, rect.width / 2)));
    const clientY = Math.round(rect.top + Math.min(92, Math.max(24, rect.height / 2)));
    const EventCtor = window.PointerEvent || window.MouseEvent;
    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX,
      clientY,
      button: 0,
      pointerId: 79,
      pointerType: 'mouse',
      isPrimary: true
    };
    card.dispatchEvent(new EventCtor('pointerdown', Object.assign({}, base, {buttons: 1})));
    card.dispatchEvent(new EventCtor('pointerup', Object.assign({}, base, {buttons: 0})));
    return {
      ok: true,
      selected: Boolean(document.querySelector(selector + '.is-selected')),
      modal: Boolean(document.querySelector('[data-object-editing-modal="true"]'))
    };

    function cssEscape(value) {
      return window.CSS && window.CSS.escape ? window.CSS.escape(String(value || '')) : String(value || '').replace(/["\\\]]/g, '\\$&');
    }
  }, cardKey);
  if (!result || !result.ok) {
    throw new Error('Could not dispatch Storyboard pointer click for ' + cardKey + ': ' + JSON.stringify(result));
  }
}

async function clickIfExists(win, selector) {
  return evalInPage(win, (targetSelector) => {
    const isVisible = (candidate) => {
      if (!candidate) {
        return false;
      }
      const rect = candidate.getBoundingClientRect();
      const style = window.getComputedStyle(candidate);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && !candidate.hidden;
    };
    const element = Array.from(document.querySelectorAll(targetSelector)).find(isVisible);
    if (!element || element.disabled || element.getAttribute('aria-disabled') === 'true') {
      return false;
    }
    element.scrollIntoView({block: 'center', inline: 'center'});
    element.click();
    return true;
  }, selector);
}

async function closeObjectEditorIfOpen(win) {
  await clickIfExists(win, '#existing-scene-editor-host [data-object-editing-modal] [data-object-canvas-action="toggle_overlay"]');
  await evalInPage(win, () => {
    if (!document.querySelector('#existing-scene-editor-host [data-object-editing-modal]')) {
      return true;
    }
    if (window.ProjectMapObjectAuthoringCanvas && typeof window.ProjectMapObjectAuthoringCanvas.toggleEditorOverlay === 'function') {
      window.ProjectMapObjectAuthoringCanvas.toggleEditorOverlay(false);
      return true;
    }
    return false;
  });
  await waitFor(win, () => evalInPage(win, () => !document.querySelector('#existing-scene-editor-host [data-object-editing-modal]')), 'Object editor modal should close before switching templates');
}

async function openObjectCanvasDraft(win, template, draft) {
  const ok = await evalInPage(win, (nextTemplate, nextDraft) => {
    const api = window.ProjectMapObjectAuthoringCanvas || window.ProjectMapEditingWorkspace;
    if (!api || typeof api.openTemplate !== 'function') {
      return false;
    }
    return Boolean(api.openTemplate(nextTemplate, nextDraft, {source: 'QA dynamic smoke'}));
  }, template, draft);
  if (!ok) {
    throw new Error('Could not open Object Canvas draft for template: ' + template);
  }
  await waitFor(win, () => evalInPage(win, (nextTemplate) => {
    const api = window.ProjectMapObjectAuthoringCanvas || window.ProjectMapEditingWorkspace;
    return Boolean(api && typeof api.activeTemplate === 'function' && api.activeTemplate() === nextTemplate);
  }, template), 'Object Canvas should activate template: ' + template);
}

async function fill(win, selector, value) {
  const ok = await evalInPage(win, (targetSelector, nextValue) => {
    const element = document.querySelector(targetSelector);
    if (!element) {
      return false;
    }
    element.scrollIntoView({block: 'center', inline: 'center'});
    element.value = String(nextValue);
    element.dispatchEvent(new Event('input', {bubbles: true}));
    element.dispatchEvent(new Event('change', {bubbles: true}));
    return true;
  }, selector, value);
  if (!ok) {
    throw new Error('Could not fill selector: ' + selector);
  }
}

async function focus(win, selector) {
  const ok = await evalInPage(win, (targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!element) {
      return false;
    }
    element.scrollIntoView({block: 'center', inline: 'center'});
    element.focus();
    return true;
  }, selector);
  if (!ok) {
    throw new Error('Could not focus selector: ' + selector);
  }
}

async function appendToField(win, selector, value) {
  const ok = await evalInPage(win, (targetSelector, nextValue) => {
    const element = document.querySelector(targetSelector);
    if (!element) {
      return false;
    }
    const current = String(element.value || '').trim();
    element.scrollIntoView({block: 'center', inline: 'center'});
    element.value = current ? current + '\n' + String(nextValue || '').trim() : String(nextValue || '').trim();
    element.dispatchEvent(new Event('input', {bubbles: true}));
    element.dispatchEvent(new Event('change', {bubbles: true}));
    return true;
  }, selector, value);
  if (!ok) {
    throw new Error('Could not append to selector: ' + selector);
  }
}

async function clickVariableCandidateAction(win, variableName, action) {
  await waitFor(win, () => evalInPage(win, (name, wantedAction) => {
    return Array.from(document.querySelectorAll('#wizard-variable-candidates [data-variable-action]')).some((button) => {
      return button.dataset.variableName === name && button.dataset.variableAction === wantedAction;
    });
  }, variableName, action), 'Expected variable candidate action ' + action + ' for ' + variableName);
  const ok = await evalInPage(win, (name, wantedAction) => {
    const button = Array.from(document.querySelectorAll('#wizard-variable-candidates [data-variable-action]')).find((candidate) => {
      return candidate.dataset.variableName === name && candidate.dataset.variableAction === wantedAction;
    });
    if (!button) {
      return false;
    }
    button.scrollIntoView({block: 'center', inline: 'center'});
    button.click();
    return true;
  }, variableName, action);
  if (!ok) {
    throw new Error('Could not click variable action ' + action + ' for ' + variableName);
  }
}

async function clickEntryVariableCandidateAction(win, variableName) {
  await waitFor(win, () => evalInPage(win, (name) => {
    return Array.from(document.querySelectorAll('#entry-variable-candidates [data-variable-action="entry-status-line"]')).some((button) => {
      return button.dataset.variableName === name;
    });
  }, variableName), 'Expected Entry variable candidate for ' + variableName);
  const ok = await evalInPage(win, (name) => {
    const button = Array.from(document.querySelectorAll('#entry-variable-candidates [data-variable-action="entry-status-line"]')).find((candidate) => {
      return candidate.dataset.variableName === name;
    });
    if (!button) {
      return false;
    }
    button.scrollIntoView({block: 'center', inline: 'center'});
    button.click();
    return true;
  }, variableName);
  if (!ok) {
    throw new Error('Could not click Entry variable candidate for ' + variableName);
  }
}

async function clickDraftActionContaining(win, title, action) {
  await waitFor(win, () => evalInPage(win, (expectedTitle, wantedAction) => {
    return Array.from(document.querySelectorAll('#draft-workspace-list .draft-workspace-item')).some((item) => {
      return item.textContent && item.textContent.includes(expectedTitle) && item.querySelector('[data-draft-action="' + wantedAction + '"]');
    });
  }, title, action), 'Expected saved draft "' + title + '" with action ' + action);
  const ok = await evalInPage(win, (expectedTitle, wantedAction) => {
    const item = Array.from(document.querySelectorAll('#draft-workspace-list .draft-workspace-item')).find((candidate) => {
      return candidate.textContent && candidate.textContent.includes(expectedTitle);
    });
    const button = item && item.querySelector('[data-draft-action="' + wantedAction + '"]');
    if (!button || button.disabled) {
      return false;
    }
    button.scrollIntoView({block: 'center', inline: 'center'});
    button.click();
    return true;
  }, title, action);
  if (!ok) {
    throw new Error('Could not click draft action ' + action + ' for ' + title);
  }
}

async function waitForEventOutput(win, expectedId) {
  await waitFor(win, () => evalInPage(win, (id) => {
    const wizard = window.ProjectMapWizard;
    const output = wizard && wizard.getOutput && wizard.getOutput();
    const draft = wizard && wizard.getDraft && wizard.getDraft();
    const wizardReady = Boolean(
      draft && draft.id === id &&
      output && output.installPlanJson && output.patchPreview &&
      String(output.scene || output.sceneDry || '').includes('tags: event, world')
    );
    const canvas = window.ProjectMapObjectAuthoringCanvas || window.ProjectMapEditingWorkspace;
    const canvasDraft = canvas && canvas.getDraft && canvas.getDraft();
    const canvasOutput = canvas && canvas.getOutput && canvas.getOutput();
    const canvasReady = Boolean(
      canvasDraft && canvasDraft.id === id &&
      canvasOutput && canvasOutput.installPlanJson && canvasOutput.patchPreview &&
      String(canvasOutput.scene || canvasOutput.sceneDry || canvasOutput.preview || canvasOutput.patchPreview || '').includes('tags: event, world')
    );
    return wizardReady || canvasReady;
  }, expectedId), 'Event output should produce scene, install plan, and tags:event preview for ' + expectedId);
}

async function syncEventWizardDraftToObjectCanvas(win) {
  const ok = await evalInPage(win, () => {
    const wizard = window.ProjectMapWizard;
    const canvas = window.ProjectMapObjectAuthoringCanvas || window.ProjectMapEditingWorkspace;
    if (!wizard || typeof wizard.getDraft !== 'function' || !canvas || typeof canvas.openTemplate !== 'function') {
      return false;
    }
    const draft = wizard.getDraft();
    if (!draft || !draft.id) {
      return false;
    }
    return Boolean(canvas.openTemplate('event', draft, {source: 'QA event wizard sync', template: 'event'}));
  });
  if (!ok) {
    throw new Error('Could not sync World Event Wizard draft into Object Canvas.');
  }
}

async function waitForNewsOutput(win, expectedId) {
  await waitFor(win, () => evalInPage(win, (id) => {
    const wizard = window.ProjectMapNewsWizard;
    const output = wizard && wizard.getOutput && wizard.getOutput();
    const draft = wizard && wizard.getDraft && wizard.getDraft();
    return Boolean(
      draft && draft.id === id &&
      output && output.installPlanJson && output.patchPreview &&
      String(output.snippet || '').includes(id) &&
      String(output.installPlanJson || '').includes('post_event_news')
    );
  }, expectedId), 'News output should produce post_event_news snippet and install plan for ' + expectedId);
}

async function waitForCardOutput(win, expectedId, expectedSceneFlag) {
  await waitFor(win, () => evalInPage(win, (id, flag) => {
    const wizard = window.ProjectMapCardWizard;
    const output = wizard && wizard.getOutput && wizard.getOutput();
    const draft = wizard && wizard.getDraft && wizard.getDraft();
    return Boolean(
      draft && draft.id === id &&
      output && output.installPlanJson && output.patchPreview &&
      String(output.scene || '').includes(flag) &&
      String(output.installPlanJson || '').includes('create_scene')
    );
  }, expectedId, expectedSceneFlag), 'Card output should produce scene and install plan for ' + expectedId);
}

async function waitForPlaySurfaceOutput(win, expectedId) {
  await waitFor(win, () => evalInPage(win, (id) => {
    const wizard = window.ProjectMapPlaySurfaceWizard;
    const output = wizard && wizard.getOutput && wizard.getOutput();
    const draft = wizard && wizard.getDraft && wizard.getDraft();
    return Boolean(
      draft && draft.id === id &&
      output && output.installPlanJson && output.patchPreview &&
      String(output.installPlanJson || '').includes('play_surface') &&
      String(output.installPlanJson || '').includes('hand_opening') &&
      String(output.installPlanJson || '').includes('card_opening') &&
      String(output.installPlanJson || '').includes('advisor_opening') &&
      String(output.patchPreview || '').includes('@@ replace section')
    );
  }, expectedId), 'Playable Surface output should produce an install plan and patch preview for ' + expectedId);
}

async function waitForWorkspaceLayoutOutput(win, expectedId) {
  await waitFor(win, () => evalInPage(win, (id) => {
    const wizard = window.ProjectMapWorkspaceLayoutWizard;
    const output = wizard && wizard.getOutput && wizard.getOutput();
    const draft = wizard && wizard.getDraft && wizard.getDraft();
    return Boolean(
      draft && draft.id === id &&
      output && output.installPlanJson && output.patchPreview &&
      String(output.installPlanJson || '').includes('workspace_layout') &&
      String(output.installPlanJson || '').includes('create_deck_scene') &&
      String(output.installPlanJson || '').includes('create_starter_card') &&
      String(output.installPlanJson || '').includes('hand_deck_route') &&
      String(output.installPlanJson || '').includes('sidebar_category') &&
      String(output.patchPreview || '').includes('source/scenes/decks/justice_party_media_deck.scene.dry') &&
      String(output.patchPreview || '').includes('source/scenes/cards/justice_party_media_briefing_card.scene.dry')
    );
  }, expectedId), 'Workspace Layout output should produce an install plan and patch preview for ' + expectedId);
}

async function waitForSidebarStatusOutput(win, expectedId) {
  await waitFor(win, () => evalInPage(win, (id) => {
    const wizard = window.ProjectMapSidebarStatusWizard;
    const output = wizard && wizard.getOutput && wizard.getOutput();
    const draft = wizard && wizard.getDraft && wizard.getDraft();
    return Boolean(
      draft && draft.id === id &&
      output && output.installPlanJson && output.patchPreview &&
      String(output.installPlanJson || '').includes('sidebar_status') &&
      String(output.installPlanJson || '').includes('source/scenes/status.scene.dry') &&
      String(output.patchPreview || '').includes('source/scenes/status.scene.dry') &&
      String(output.playerPreview || '').includes('Justice Party Organization')
    );
  }, expectedId), 'Sidebar / Status output should produce an install plan and patch preview for ' + expectedId);
}

async function waitForGameText(win, expectedText, timeoutMs) {
  await waitFor(win, () => evalInPage(win, (text) => {
    const bodyText = String(document.body && (document.body.textContent || document.body.innerText) || '');
    return bodyText.includes(text);
  }, expectedText), 'Runtime Preview game should show "' + expectedText + '"', timeoutMs);
}

async function waitForModifiedRuntimeBridge(win, timeoutMs) {
  await waitFor(win, () => evalInPage(win, () => {
    const frame = document.querySelector('iframe.modified');
    const frameWindow = frame && frame.contentWindow;
    const frameDocument = frame && (frame.contentDocument || frameWindow && frameWindow.document);
    return Boolean(frameWindow && frameDocument && frameDocument.body && frameWindow.DendryModStudioPreview);
  }), 'Runtime Preview modified frame should expose the Focused Entry bridge', timeoutMs);
}

async function applyModifiedFocusPreset(win, sceneId) {
  return evalInPage(win, (targetSceneId) => {
    const frame = document.querySelector('iframe.modified');
    const frameWindow = frame && frame.contentWindow;
    const api = frameWindow && frameWindow.DendryModStudioPreview;
    const preset = document.querySelector('[data-debug-focus-scene="' + targetSceneId + '"]');
    let variables = [];
    try {
      variables = JSON.parse(preset && preset.getAttribute('data-debug-focus-variables') || '[]');
    } catch (_err) {
      variables = [];
    }
    if (!api || typeof api.applyFocusPreset !== 'function') {
      return {ok: false, message: 'Focused Entry bridge is unavailable.'};
    }
    return api.applyFocusPreset({sceneId: targetSceneId, variables});
  }, sceneId);
}

async function waitForModifiedGameText(win, expectedText, timeoutMs) {
  await waitFor(win, () => modifiedGameHasText(win, expectedText), 'Runtime Preview modified game should show "' + expectedText + '"', timeoutMs);
}

async function modifiedGameHasText(win, expectedText) {
  return evalInPage(win, (text) => {
    const frame = document.querySelector('iframe.modified');
    const doc = frame && (frame.contentDocument || frame.contentWindow && frame.contentWindow.document);
    const bodyText = String(doc && doc.body && (doc.body.textContent || doc.body.innerText) || '');
    return bodyText.includes(text);
  }, expectedText);
}

async function advanceModifiedGameIfTextVisible(win, expectedText) {
  if (await modifiedGameHasText(win, expectedText)) {
    await clickModifiedGameText(win, expectedText);
  }
}

async function clickModifiedGameText(win, expectedText) {
  const result = await evalInPage(win, (text) => {
    const frame = document.querySelector('iframe.modified');
    const doc = frame && (frame.contentDocument || frame.contentWindow && frame.contentWindow.document);
    if (!doc) {
      return {ok: false, reason: 'missing_frame'};
    }
    const actionableSelector = [
      'a',
      'button',
      'input[type="button"]',
      'input[type="submit"]',
      '[role="button"]',
      '[onclick]',
      '.card',
      '.deck',
      '.choice'
    ].join(',');
    const isVisible = (element) => {
      if (!element || element === doc.body || element === doc.documentElement) {
        return false;
      }
      const tag = String(element.tagName || '').toLowerCase();
      if (tag === 'script' || tag === 'style') {
        return false;
      }
      const rect = element.getBoundingClientRect();
      const style = doc.defaultView.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const candidates = Array.from(doc.querySelectorAll(actionableSelector)).filter((element) => {
      const label = element.value || element.textContent || '';
      return String(label).includes(text) && isVisible(element);
    }).sort((left, right) => {
      const leftText = String(left.value || left.textContent || '').length;
      const rightText = String(right.value || right.textContent || '').length;
      return leftText - rightText;
    });
    const target = candidates[0] || null;
    if (!target) {
      return {ok: false, reason: 'missing'};
    }
    target.scrollIntoView({block: 'center', inline: 'center'});
    const MouseEventCtor = doc.defaultView && doc.defaultView.MouseEvent || MouseEvent;
    target.dispatchEvent(new MouseEventCtor('mouseover', {bubbles: true, cancelable: true, view: doc.defaultView}));
    target.dispatchEvent(new MouseEventCtor('mousedown', {bubbles: true, cancelable: true, view: doc.defaultView}));
    target.dispatchEvent(new MouseEventCtor('mouseup', {bubbles: true, cancelable: true, view: doc.defaultView}));
    target.click();
    return {
      ok: true,
      tag: String(target.tagName || '').toLowerCase(),
      text: String(target.value || target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200)
    };
  }, expectedText);
  if (!result || !result.ok) {
    throw new Error('Runtime Preview modified frame could not click player option: ' + expectedText + (result && result.reason ? ' (' + result.reason + ')' : ''));
  }
  await new Promise((resolve) => setTimeout(resolve, 160));
}

async function modifiedRuntimeRouteObservation(win, meta) {
  const input = meta || {};
  return evalInPage(win, (details) => {
    const frame = document.querySelector('iframe.modified');
    const frameWindow = frame && frame.contentWindow;
    const doc = frame && (frame.contentDocument || frameWindow && frameWindow.document);
    const engine = frameWindow && frameWindow.dendryUI && frameWindow.dendryUI.dendryEngine;
    const state = engine && engine.state || {};
    const qualitySource = state.qualities || state.Q || frameWindow && frameWindow.Q || {};
    const qSnapshot = {};
    Object.keys(qualitySource || {}).sort().forEach((key) => {
      if (/^(qa_|route|next|scene|jump|menu|follow|public_order)/i.test(key)) {
        const value = qualitySource[key];
        if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
          qSnapshot[key] = value;
        }
      }
    });
    const bodyText = String(doc && doc.body && (doc.body.textContent || doc.body.innerText) || '').replace(/\s+/g, ' ').trim();
    return {
      evidenceKind: 'runtime_observed',
      entryMode: String(details && details.entryMode || ''),
      focusedEntry: Boolean(details && details.focusedEntry),
      engineVersion: String(engine && (engine.version || engine.engineVersion) || frameWindow && frameWindow.DENDRY_VERSION || ''),
      buildHash: String(frameWindow && (frameWindow.__DENDRY_MOD_STUDIO_BUILD_HASH__ || frameWindow.__BUILD_HASH__) || ''),
      seed: String(state.seed || state.randomSeed || qualitySource.seed || ''),
      sceneId: String(state.sceneId || ''),
      observedSceneIdsSinceGoTo: Array.isArray(state.sceneIdsSinceGoTo) ? state.sceneIdsSinceGoTo.map(String) : [],
      clickPath: Array.isArray(details && details.clickPath) ? details.clickPath.map(String) : [],
      qSnapshot,
      qDiff: details && details.qDiff || {},
      bodyPreview: bodyText.slice(0, 240)
    };
  }, input);
}

function diffObjectSnapshots(before, after) {
  const left = before || {};
  const right = after || {};
  const keys = Array.from(new Set(Object.keys(left).concat(Object.keys(right)))).sort();
  return keys.reduce((out, key) => {
    if (JSON.stringify(left[key]) !== JSON.stringify(right[key])) {
      out[key] = {before: left[key], after: right[key]};
    }
    return out;
  }, {});
}

async function runtimeGameSnapshot(win) {
  return evalInPage(win, () => {
    const engine = window.dendryUI && window.dendryUI.dendryEngine;
    const choices = Array.from(document.querySelectorAll('ul.choices li')).map((item) => {
      const link = item.querySelector('a');
      return {
        text: String(item.textContent || '').replace(/\s+/g, ' ').trim(),
        hasLink: Boolean(link),
        dataChoice: link && link.getAttribute('data-choice') || '',
        className: String(item.className || '')
      };
    });
    return {
      ready: Boolean(engine),
      sceneId: engine && engine.state && engine.state.sceneId || '',
      choiceCache: Array.isArray(engine && engine.choiceCache)
        ? engine.choiceCache.map((choice) => ({
            id: choice && choice.id || '',
            title: choice && choice.title || '',
            canChoose: choice && choice.canChoose
          }))
        : [],
      choices
    };
  });
}

async function clickGameText(win, expectedText) {
  const target = await evalInPage(win, (text) => {
    const actionableSelector = [
      'a',
      'button',
      'input[type="button"]',
      'input[type="submit"]',
      '[role="button"]',
      '[onclick]',
      '.card',
      '.deck',
      '.choice'
    ].join(',');
    const isVisible = (element) => {
      if (!element || element === document.body || element === document.documentElement) {
        return false;
      }
      const tag = String(element.tagName || '').toLowerCase();
      if (tag === 'script' || tag === 'style') {
        return false;
      }
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const describeElement = (element) => {
      if (!element) {
        return {ok: false, reason: 'missing'};
      }
      element.scrollIntoView({block: 'center', inline: 'center'});
      const rect = element.getBoundingClientRect();
      return {
        ok: true,
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
        tag: String(element.tagName || '').toLowerCase(),
        className: String(element.className || ''),
        text: String(element.value || element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200)
      };
    };
    const cardCaption = Array.from(document.querySelectorAll('.card-caption')).find((element) => {
      return String(element.textContent || '').includes(text);
    });
    if (cardCaption) {
      const cardHost = cardCaption.closest('.card-in-hand, .pinned-card, .deck');
      const cardLink = cardHost && cardHost.querySelector('a.card');
      if (isVisible(cardLink)) {
        return describeElement(cardLink);
      }
    }
    const actionableCandidates = Array.from(document.querySelectorAll(actionableSelector)).filter((element) => {
      const label = element.value || element.textContent || '';
      return String(label).includes(text) && isVisible(element);
    }).sort((left, right) => {
      const leftText = String(left.value || left.textContent || '').length;
      const rightText = String(right.value || right.textContent || '').length;
      return leftText - rightText;
    });
    if (actionableCandidates[0]) {
      return describeElement(actionableCandidates[0]);
    }
    const broadElements = Array.from(document.querySelectorAll([
      'li',
      'span',
      'div',
      'p'
    ].join(',')));
    const visibleCandidates = broadElements.filter((element) => {
      const label = element.value || element.textContent || '';
      if (!String(label).includes(text)) {
        return false;
      }
      return isVisible(element);
    }).sort((left, right) => {
      const leftText = String(left.value || left.textContent || '').length;
      const rightText = String(right.value || right.textContent || '').length;
      return leftText - rightText;
    });
    const target = visibleCandidates[0] || null;
    if (!target) {
      return {ok: false, reason: 'missing'};
    }
    const nestedAction = target.matches(actionableSelector)
      ? target
      : target.closest(actionableSelector) || target.querySelector(actionableSelector);
    return describeElement(isVisible(nestedAction) ? nestedAction : target);
  }, expectedText);
  if (!target || !target.ok) {
    throw new Error('Runtime Preview could not find player option: ' + expectedText + (target && target.reason ? ' (' + target.reason + ')' : ''));
  }
  win.webContents.sendInputEvent({type: 'mouseMove', x: target.x, y: target.y});
  win.webContents.sendInputEvent({type: 'mouseDown', button: 'left', clickCount: 1, x: target.x, y: target.y});
  win.webContents.sendInputEvent({type: 'mouseUp', button: 'left', clickCount: 1, x: target.x, y: target.y});
  await new Promise((resolve) => setTimeout(resolve, 120));
}

async function waitForEntryOutput(win, expectedId) {
  await waitFor(win, () => evalInPage(win, (id) => {
    const wizard = window.ProjectMapEntrySidebarWizard;
    const output = wizard && wizard.getOutput && wizard.getOutput();
    const draft = wizard && wizard.getDraft && wizard.getDraft();
    const wizardReady = Boolean(
      draft && draft.id === id &&
      output && output.installPlanJson && output.patchPreview &&
      String(output.installPlanJson || '').includes('entry_sidebar') &&
      String(output.patchPreview || '').includes('replace section')
    );
    const canvas = window.ProjectMapObjectAuthoringCanvas || window.ProjectMapEditingWorkspace;
    const canvasDraft = canvas && canvas.getDraft && canvas.getDraft();
    const canvasOutput = canvas && canvas.getOutput && canvas.getOutput();
    const canvasReady = Boolean(
      canvasDraft && canvasDraft.id === id &&
      canvasOutput && canvasOutput.installPlanJson && canvasOutput.patchPreview &&
      String(canvasOutput.installPlanJson || '').includes('entry_sidebar')
    );
    return wizardReady || canvasReady;
  }, expectedId), 'Entry & Sidebar output should produce an install plan and patch preview for ' + expectedId);
}

async function syncEntryDraftToObjectCanvas(win) {
  const ok = await evalInPage(win, () => {
    const wizard = window.ProjectMapEntrySidebarWizard;
    const canvas = window.ProjectMapObjectAuthoringCanvas || window.ProjectMapEditingWorkspace;
    if (!wizard || typeof wizard.getDraft !== 'function' || !canvas || typeof canvas.openTemplate !== 'function') {
      return false;
    }
    const draft = wizard.getDraft();
    if (!draft || !draft.id) {
      return false;
    }
    return Boolean(canvas.openTemplate('entry', draft, {source: 'QA entry wizard sync', template: 'entry'}));
  });
  if (!ok) {
    throw new Error('Could not sync Entry & Sidebar Wizard draft into Object Canvas.');
  }
}

const AUTHORING_TEMPLATE_SELECTORS = {
  play_surface: '[data-create-template="play_surface"]',
  workspace_layout: '[data-create-template="workspace_layout"]',
  sidebar_status: '[data-create-template="sidebar_status"]'
};

async function openAuthoringTemplate(win, template) {
  const selector = AUTHORING_TEMPLATE_SELECTORS[template];
  if (selector) {
    await click(win, selector);
  }
  const ok = await evalInPage(win, (nextTemplate) => {
    const workspace = window.ProjectMapAuthoringWorkspace;
    if (workspace && typeof workspace.setTemplate === 'function') {
      workspace.setTemplate(nextTemplate, {silent: true});
    }
    const canvas = window.ProjectMapObjectAuthoringCanvas || window.ProjectMapEditingWorkspace;
    if (!canvas || typeof canvas.openTemplate !== 'function') {
      return false;
    }
    return Boolean(canvas.openTemplate(nextTemplate, null, {source: 'QA template open', template: nextTemplate}));
  }, template);
  if (!ok) {
    throw new Error('Could not open authoring template: ' + template);
  }
}

async function syncWizardDraftToObjectCanvas(win, template, wizardGlobalName) {
  const ok = await evalInPage(win, (nextTemplate, globalName) => {
    const wizard = window[globalName];
    const canvas = window.ProjectMapObjectAuthoringCanvas || window.ProjectMapEditingWorkspace;
    if (!wizard || typeof wizard.getDraft !== 'function' || !canvas || typeof canvas.openTemplate !== 'function') {
      return false;
    }
    const draft = wizard.getDraft();
    if (!draft || !draft.id) {
      return false;
    }
    return Boolean(canvas.openTemplate(nextTemplate, draft, {source: 'QA wizard sync', template: nextTemplate}));
  }, template, wizardGlobalName);
  if (!ok) {
    throw new Error('Could not sync ' + template + ' wizard draft into Object Canvas.');
  }
}

async function loadNewsDraft(win, draft) {
  const loadOnce = () => evalInPage(win, (nextDraft) => {
    const workspace = window.ProjectMapAuthoringWorkspace;
    if (workspace && typeof workspace.setTemplate === 'function') {
      workspace.setTemplate('news', {silent: true});
    }
    const canvas = window.ProjectMapObjectAuthoringCanvas || window.ProjectMapEditingWorkspace;
    const canvasOk = canvas && typeof canvas.openTemplate === 'function'
      ? canvas.openTemplate('news', nextDraft, {source: 'QA news draft', template: 'news'})
      : false;
    const wizard = window.ProjectMapNewsWizard;
    if (!wizard || typeof wizard.loadDraft !== 'function') {
      return Boolean(canvasOk);
    }
    wizard.loadDraft(nextDraft, {fileName: 'QA news draft'});
    const canvasDraft = canvas && canvas.getDraft && canvas.getDraft();
    if (canvasDraft && canvasDraft.id === nextDraft.id) {
      return true;
    }
    if (!wizard.getDraft) {
      return false;
    }
    return Boolean(wizard.getDraft && wizard.getDraft() && wizard.getDraft().id === nextDraft.id);
  }, draft);
  const ok = await loadOnce();
  await new Promise((resolve) => setTimeout(resolve, 120));
  const stableOk = await loadOnce();
  if (!ok || !stableOk) {
    throw new Error('Could not load News Wizard draft: ' + (draft && draft.id || 'unknown'));
  }
}

async function waitForInstallResult(win, predicate, message) {
  let latest = null;
  await waitFor(win, async () => {
    latest = await evalInPage(win, () => {
      const state = window.ProjectMapInstallAssistant && window.ProjectMapInstallAssistant.getState();
      return state && state.lastResult;
    });
    return Boolean(latest && (!predicate || predicate(latest)));
  }, message || 'Install Assistant should produce a dry-run result');
  return latest;
}

function statusSummary(result) {
  const rows = Array.isArray(result && result.results) ? result.results : [];
  return rows.map((item) => [item.id, item.type, item.status].filter(Boolean).join(':')).join(', ');
}

async function observeStep(args) {
  const delay = Number(args && args.stepDelayMs || 0);
  if (!delay) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function expectValue(win, selector, expected) {
  await waitFor(win, () => evalInPage(win, (targetSelector, expectedValue) => {
    const element = document.querySelector(targetSelector);
    return Boolean(element && element.value === expectedValue);
  }, selector, expected), 'Expected value "' + expected + '" in ' + selector);
}

async function clickRowContaining(win, selector, text) {
  await waitFor(win, () => evalInPage(win, (targetSelector, expectedText) => {
    return Array.from(document.querySelectorAll(targetSelector)).some((element) => {
      return element.textContent && element.textContent.includes(expectedText);
    });
  }, selector, text), 'Expected row containing "' + text + '" in ' + selector);
  const ok = await evalInPage(win, (targetSelector, expectedText) => {
    const element = Array.from(document.querySelectorAll(targetSelector)).find((candidate) => {
      return candidate.textContent && candidate.textContent.includes(expectedText);
    });
    if (!element) {
      return false;
    }
    element.scrollIntoView({block: 'center', inline: 'center'});
    element.click();
    return true;
  }, selector, text);
  if (!ok) {
    throw new Error('Could not click row containing "' + text + '" in ' + selector);
  }
}

async function expectFieldContains(win, selector, expected) {
  await waitFor(win, () => evalInPage(win, (targetSelector, expectedText) => {
    const element = document.querySelector(targetSelector);
    return Boolean(element && String(element.value || '').includes(expectedText));
  }, selector, expected), 'Expected field ' + selector + ' to contain "' + expected + '"');
}

async function expectDryRunWouldApply(win, message) {
  await waitFor(win, async () => {
    return evalInPage(win, () => {
      const state = window.ProjectMapInstallAssistant && window.ProjectMapInstallAssistant.getState();
      const result = state && state.lastResult;
      return Boolean(result && result.dryRun === true && Array.isArray(result.results));
    });
  }, message || 'Dry-run should produce an install result');
  const dryRunResult = await evalInPage(win, () => {
    const state = window.ProjectMapInstallAssistant && window.ProjectMapInstallAssistant.getState();
    return state && state.lastResult;
  });
  if (!dryRunResult || dryRunResult.ok !== true || !dryRunResult.results.some((item) => item.status === 'would_apply')) {
    throw new Error((message || 'Dry-run did not succeed') + ': ' + JSON.stringify(dryRunResult));
  }
}

async function expectInstallOperationPath(win, expectedPath) {
  await waitFor(win, () => evalInPage(win, (pathText) => {
    const state = window.ProjectMapInstallAssistant && window.ProjectMapInstallAssistant.getState();
    const operations = state && state.plan && Array.isArray(state.plan.operations) ? state.plan.operations : [];
    return operations.some((operation) => String(operation.path || '') === pathText);
  }, expectedPath), 'Install plan should include operation path: ' + expectedPath);
}

async function replaceExistingFieldByOriginal(win, original, replacement) {
  const ok = await evalInPage(win, (originalText, replacementText) => {
    const field = Array.from(document.querySelectorAll('#existing-scene-editor-host [data-existing-field], #existing-scene-editor-host [data-editing-field]')).find((input) => {
      return input.value === originalText;
    });
    if (!field) {
      return false;
    }
    field.scrollIntoView({block: 'center', inline: 'center'});
    field.value = replacementText;
    field.dispatchEvent(new Event('input', {bubbles: true}));
    field.dispatchEvent(new Event('change', {bubbles: true}));
    return true;
  }, original, replacement);
  if (!ok) {
    throw new Error('Could not find existing scene field with original text: ' + original);
  }
}

async function editFirstExistingFieldContaining(win, needle, replacement) {
  const ok = await evalInPage(win, (needleText, replacementText) => {
    const field = Array.from(document.querySelectorAll('#existing-scene-editor-host [data-existing-field], #existing-scene-editor-host [data-existing-block], #existing-scene-editor-host [data-editing-field]')).find((input) => {
      return String(input.value || '').includes(needleText);
    });
    if (!field) {
      return false;
    }
    field.scrollIntoView({block: 'center', inline: 'center'});
    field.value = replacementText;
    field.dispatchEvent(new Event('input', {bubbles: true}));
    field.dispatchEvent(new Event('change', {bubbles: true}));
    return true;
  }, needle, replacement);
  if (!ok) {
    throw new Error('Could not find existing scene field containing: ' + needle);
  }
}

async function editFirstExistingLongTextField(win, replacement) {
  const result = await evalInPage(win, (replacementText) => {
    const fields = Array.from(document.querySelectorAll('#existing-scene-editor-host [data-object-editing-modal] [data-object-canvas-field], #existing-scene-editor-host [data-preview-object-editor] [data-object-canvas-field]'))
      .filter((field) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(field.tagName));
    const isVisible = (field) => {
      if (!field || field.disabled || field.readOnly) {
        return false;
      }
      const rect = field.getBoundingClientRect();
      const style = window.getComputedStyle(field);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const chosen = fields.find((field) => {
      const value = String(field.value || '');
      return isVisible(field) && field.type !== 'hidden' && field.type !== 'checkbox' && (field.tagName === 'TEXTAREA' || value.length >= 80);
    });
    if (!chosen) {
      const host = document.querySelector('#existing-scene-editor-host');
      const activeMode = document.querySelector('[data-mode].is-active');
      return {
        ok: false,
        fieldCount: fields.length,
        activeMode: activeMode && activeMode.getAttribute('data-mode') || '',
        hostHidden: host ? Boolean(host.hidden || host.classList.contains('hidden')) : true,
        hostText: host ? String(host.textContent || '').slice(0, 240) : '',
        hostHtml: host ? String(host.innerHTML || '').slice(0, 240) : '',
        samples: fields.slice(0, 8).map((field) => String(field.value || field.textContent || '').slice(0, 80))
      };
    }
    chosen.scrollIntoView({block: 'center', inline: 'center'});
    if (typeof chosen.focus === 'function') {
      chosen.focus();
    }
    chosen.value = replacementText;
    chosen.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertText', data: replacementText}));
    chosen.dispatchEvent(new Event('change', {bubbles: true}));
    if (window.ProjectMapObjectAuthoringCanvas && typeof window.ProjectMapObjectAuthoringCanvas.refresh === 'function') {
      window.ProjectMapObjectAuthoringCanvas.refresh();
    }
    return {
      ok: true,
      key: chosen.dataset && chosen.dataset.objectCanvasField || '',
      tag: chosen.tagName,
      value: chosen.value
    };
  }, replacement);
  if (!result || !result.ok) {
    throw new Error('Could not find a visible long existing scene field. State: ' + JSON.stringify(result || {}));
  }
}

async function replaceExistingBlockByOriginal(win, original, replacement) {
  const ok = await evalInPage(win, (originalText, replacementText) => {
    const isVisible = (input) => {
      if (!input || input.disabled || input.readOnly) {
        return false;
      }
      const rect = input.getBoundingClientRect();
      const style = window.getComputedStyle(input);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const selectors = [
      '#existing-scene-editor-host [data-object-editing-modal] [data-object-canvas-field]',
      '#existing-scene-editor-host [data-preview-object-editor] [data-object-canvas-field]',
      '#existing-scene-editor-host [data-existing-block]',
      '#existing-scene-editor-host [data-editing-field]'
    ];
    const field = Array.from(document.querySelectorAll(selectors.join(','))).find((input) => {
      return isVisible(input) && input.value === originalText;
    });
    if (!field) {
      return false;
    }
    field.scrollIntoView({block: 'center', inline: 'center'});
    field.value = replacementText;
    field.dispatchEvent(new Event('input', {bubbles: true}));
    field.dispatchEvent(new Event('change', {bubbles: true}));
    return true;
  }, original, replacement);
  if (!ok) {
    throw new Error('Could not find existing scene block with original text: ' + original);
  }
}

async function expectVisible(win, selector, message) {
  await waitFor(win, () => evalInPage(win, (targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!element) {
      return false;
    }
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && !element.hidden && !element.classList.contains('hidden');
  }, selector), message || ('Expected visible: ' + selector));
}

async function visibleSelector(win, selectors) {
  return evalInPage(win, (targetSelectors) => {
    const isVisible = (element) => {
      if (!element) {
        return false;
      }
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && !element.hidden && !element.classList.contains('hidden');
    };
    return targetSelectors.find((selector) => isVisible(document.querySelector(selector))) || '';
  }, selectors);
}

async function expectAnyVisible(win, selectors, message) {
  await waitFor(win, async () => Boolean(await visibleSelector(win, selectors)), message || ('Expected visible: ' + selectors.join(', ')));
  return visibleSelector(win, selectors);
}

async function waitForAllHidden(win, selectors, message) {
  await waitFor(win, () => evalInPage(win, (targetSelectors) => {
    const isHidden = (element) => {
      if (!element) {
        return true;
      }
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0 || element.hidden || element.classList.contains('hidden');
    };
    return targetSelectors.every((selector) => isHidden(document.querySelector(selector)));
  }, selectors), message || ('Expected hidden: ' + selectors.join(', ')));
}

async function expectWelcomeSurfaceVisible(win, message) {
  return expectAnyVisible(win, WELCOME_SURFACE_SELECTORS, message);
}

async function waitForWelcomeSurfaceHidden(win, message) {
  return waitForAllHidden(win, WELCOME_SURFACE_SELECTORS, message);
}

async function expectWelcomeSurfaceHiddenOrMissing(win, message) {
  return waitForWelcomeSurfaceHidden(win, message);
}

async function clickWelcomePrimary(win) {
  const selector = await expectAnyVisible(win, WELCOME_PRIMARY_SELECTORS, 'Welcome Hub should expose a primary project-open action');
  await click(win, selector);
}

async function waitForHidden(win, selector, message) {
  await waitFor(win, () => evalInPage(win, (targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!element) {
      return true;
    }
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0 || element.hidden || element.classList.contains('hidden');
  }, selector), message || ('Expected hidden: ' + selector));
}

async function expectHiddenOrMissing(win, selector, message) {
  await waitForHidden(win, selector, message);
}

async function waitForText(win, selector, expected, timeoutMs) {
  await waitFor(win, () => textIncludes(win, selector, expected), 'Expected text "' + expected + '" in ' + selector, timeoutMs);
}

async function expectText(win, selector, expected) {
  const ok = await textIncludes(win, selector, expected);
  if (!ok) {
    const actual = await evalInPage(win, (targetSelector) => {
      const element = document.querySelector(targetSelector);
      return element ? element.textContent : '';
    }, selector);
    throw new Error('Expected text "' + expected + '" in ' + selector + '. Actual: ' + actual);
  }
}

async function textIncludes(win, selector, expected) {
  return evalInPage(win, (targetSelector, expectedText) => {
    const element = document.querySelector(targetSelector);
    return Boolean(element && element.textContent && element.textContent.includes(expectedText));
  }, selector, expected);
}

async function waitFor(win, predicate, message, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 30000);
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) {
        return;
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error((message || 'waitFor timeout') + (lastError ? ': ' + lastError.message : ''));
}

async function evalInPage(win, fn, ...args) {
  const source = '(' + fn.toString() + ')(...' + JSON.stringify(args) + ')';
  return win.webContents.executeJavaScript(source, true);
}

async function screenshot(win, artifactDir, name) {
  const image = await win.webContents.capturePage();
  const fileName = name + '.png';
  const filePath = path.join(artifactDir, fileName);
  fs.writeFileSync(filePath, image.toPNG());
  return filePath;
}

if (process.versions && process.versions.electron && process.env.DMS_QA_CHILD === '1') {
  electronEntry();
} else {
  nodeEntry();
}
