#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const QA_DIR = __dirname;
const PROJECT_MAP_DIR = path.resolve(QA_DIR, '..');
const REPO_ROOT = path.resolve(PROJECT_MAP_DIR, '..', '..');
const DESKTOP_DIR = path.join(PROJECT_MAP_DIR, 'desktop');
const DEFAULT_PROJECT_ROOT = path.join(PROJECT_MAP_DIR, 'fixtures', 'qa-mini');
const DEFAULT_WRONG_PROJECT_ROOT = path.join(PROJECT_MAP_DIR, 'fixtures', 'generic-mini');

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
      'changes source-backed player text',
      'saves the edit to My Changes',
      'reviews the guarded replacement',
      'runs desktop dry-run'
    ],
    shortcuts: [
      'uses a deterministic test dialog adapter for native folder selection'
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
    artifactBase: path.join(REPO_ROOT, '.studio-local', 'playtests', 'justice-party-template-mod'),
    dialogRoots: [],
    playerLike: [
      'loads the bundled demo template',
      'edits the start menu, sidebar, and first playable route through Entry & Sidebar',
      'uses the Create first event shortcut from Entry & Sidebar',
      'uses automatic variable recommendations to reuse template support state',
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
    title: 'Runtime Preview opens the starter route, clicks the first event, and verifies sidebar state changes.',
    run: scenarioRuntimePreviewEntryFlow,
    artifactBase: path.join(REPO_ROOT, '.studio-local', 'playtests', 'runtime-preview-entry-flow'),
    dialogRoots: [],
    playerLike: [
      'starts from the bundled demo template',
      'creates a desktop Runtime Preview sandbox',
      'opens the modified game preview in a BrowserWindow',
      'clicks the root start option',
      'clicks a player choice',
      'verifies the sidebar/status text changes after the choice'
    ],
    shortcuts: [
      'uses the packaged starter template and Electron DOM automation instead of manual clicking'
    ]
  }
};

function parseArgs(argv) {
  const args = {
    scenario: 'first_time_user',
    projectRoot: DEFAULT_PROJECT_ROOT,
    wrongProjectRoot: DEFAULT_WRONG_PROJECT_ROOT,
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
    if (arg === '--scenario' || arg === '--project-root' || arg === '--wrong-project-root' || arg === '--artifact-dir' || arg === '--timeout-ms' || arg === '--step-delay-ms') {
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
  const childArgs = [__filename].concat(process.argv.slice(2));
  const childEnv = {
    ...process.env,
    DMS_QA_CHILD: '1',
    ELECTRON_DISABLE_SECURITY_WARNINGS: '1'
  };
  delete childEnv.ELECTRON_RUN_AS_NODE;
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
  if (!args.headed) {
    app.commandLine.appendSwitch('headless');
  }
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
    currentVersion: '0.9.2',
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
  await expectVisible(win, '#studio-onboarding', 'Quick Start overlay should be visible on first launch');
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
  await click(win, '#onboarding-primary');
  await waitForHidden(win, '#studio-onboarding', 'Quick Start should close');
  log('Quick Start primary opens project picker', 'PASS', 'test dialog adapter selects project root');

  const loaded = await waitForProjectLoaded(win, args.projectRoot, args.timeoutMs);
  await screenshot(win, artifactDir, '03-project-loaded');
  log('Project loads', 'PASS', JSON.stringify(loaded.summary || {}));

  await click(win, '#mode-create');
  await fill(win, '#wizard-id', 'qa_first_time_event');
  await fill(win, '#wizard-title', 'QA first time event');
  await fill(win, '#wizard-heading', 'A test proposal reaches review');
  await fill(win, '#wizard-year', '2021');
  await fill(win, '#wizard-month-start', '5');
  await fill(win, '#wizard-month-end', '7');
  await fill(win, '#wizard-requires', '');
  await fill(win, '#wizard-trigger-effects', '');
  await fill(win, '#wizard-intro', 'A tester opens Studio and writes a small event the way a first-time mod author would.');
  await fill(win, '#wizard-option-0-id', 'define_issue');
  await fill(win, '#wizard-option-0-title', 'Define the issue');
  await fill(win, '#wizard-option-0-subtitle', 'Make the proposal visible.');
  await fill(win, '#wizard-option-0-effects', 'generic_score += 1');
  await fill(win, '#wizard-option-0-body', 'The test proposal becomes a concrete change plan. The UI should show readable output before anything touches source files.');
  await fill(win, '#wizard-option-1-id', 'wait_and_listen');
  await fill(win, '#wizard-option-1-title', 'Wait and listen');
  await fill(win, '#wizard-option-1-subtitle', 'Keep the first edit modest.');
  await fill(win, '#wizard-option-1-effects', 'generic_score -= 1');
  await fill(win, '#wizard-option-1-body', 'The tester leaves a quieter path in place, then checks that Review and Apply explains the consequences clearly.');
  await waitFor(win, async () => {
    return evalInPage(win, () => {
      const output = window.ProjectMapWizard && window.ProjectMapWizard.getOutput && window.ProjectMapWizard.getOutput();
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
  await expectText(win, '#install-checklist', 'Create the exported world event scene');
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
  await expectVisible(win, '#studio-onboarding', 'Quick Start overlay should be visible on first launch');
  await screenshot(win, artifactDir, '01-quick-start');
  log('Quick Start appears', 'PASS', '01-quick-start.png');

  await click(win, '#onboarding-primary');
  await waitForHidden(win, '#studio-onboarding', 'Quick Start should close after opening a project');
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
  await expectVisible(win, '#existing-scene-editor-host [data-existing-scene-editor="true"]', 'Existing Scene Editor should open from Design');
  await replaceExistingFieldByOriginal(
    win,
    'This scene has a simple variable write and no project-specific systems.',
    'This edited line proves Design can open a guarded existing scene proposal.'
  );
  await expectText(win, '#existing-scene-editor-host [data-existing-preview="true"]', 'This edited line proves Design can open a guarded existing scene proposal.');
  await screenshot(win, artifactDir, '05-existing-edit');
  log('Existing editor updates source-backed player text', 'PASS', '05-existing-edit.png');

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'Generic Intro');
  await screenshot(win, artifactDir, '06-existing-saved');
  log('Existing edit saves to My Changes', 'PASS', '06-existing-saved.png');

  await click(win, '#draft-workspace-list [data-draft-action="review"]');
  await waitFor(win, () => evalInPage(win, () => {
    const state = window.ProjectMapInstallAssistant && window.ProjectMapInstallAssistant.getState();
    return Boolean(state && state.plan && state.plan.draftKind === 'existing_scene_edit');
  }), 'Review & Apply should load the existing scene edit plan');
  await expectText(win, '#install-checklist', 'Replace existing Body');
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
  if (!dryRunResult || dryRunResult.ok !== true || !dryRunResult.results.some((item) => item.type === 'replace_text' && item.status === 'would_apply')) {
    throw new Error('Existing edit dry-run did not produce a guarded replace_text would_apply result: ' + JSON.stringify(dryRunResult));
  }
  await screenshot(win, artifactDir, '08-existing-dry-run');
  log('Existing edit dry-run succeeds', 'PASS', '08-existing-dry-run.png');
}

async function scenarioDraftPersistenceRestart(win, args, artifactDir, log) {
  await expectVisible(win, '#studio-onboarding', 'Quick Start overlay should be visible on first launch');
  await screenshot(win, artifactDir, '01-quick-start');
  log('Quick Start appears', 'PASS', '01-quick-start.png');

  await click(win, '#onboarding-primary');
  await waitForHidden(win, '#studio-onboarding', 'Quick Start should close after opening a project');
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
  await expectHiddenOrMissing(win, '#studio-onboarding', 'Quick Start should stay dismissed after reload');
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
  await expectText(win, '#install-checklist', 'Create the exported world event scene');
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
  await expectVisible(win, '#studio-onboarding', 'Quick Start overlay should be visible on first launch');
  await expectVisible(win, '#onboarding-load-demo', 'Quick Start should expose bundled demo template action');
  await screenshot(win, artifactDir, '01-quick-start-demo-action');
  log('Quick Start offers bundled demo template', 'PASS', '01-quick-start-demo-action.png');

  await click(win, '#onboarding-load-demo');
  await waitForHidden(win, '#studio-onboarding', 'Quick Start should close after loading demo template');
  const loaded = await waitForProjectNamed(win, 'Dendry Mod Studio Starter Demo', args.timeoutMs);
  if (!String(loaded.root || '').includes('starter-demo')) {
    throw new Error('Starter demo did not open from a starter-demo workspace: ' + JSON.stringify(loaded));
  }
  fs.accessSync(loaded.root, fs.constants.W_OK);
  await screenshot(win, artifactDir, '02-demo-project-loaded');
  log('Bundled demo template opens as writable project', 'PASS', JSON.stringify(loaded.summary || {}));

  await click(win, '#mode-explore');
  await click(win, '[data-view="events"]');
  await fill(win, '#search', 'Small Campaign');
  await clickRowContaining(win, '#list [data-row-key]', 'A Small Campaign Office');
  await expectText(win, '#inspector', 'A Small Campaign Office');
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
  draft.rootIntro = 'Runtime Preview is testing an Entry & Sidebar edit before the first playable event.';
  draft.firstOptionTitle = 'Enter the runtime preview event';
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
    await waitForGameText(gameWin, 'Enter the runtime preview event', args.timeoutMs);
    await screenshot(gameWin, artifactDir, '01-runtime-root');
    await clickGameText(gameWin, 'Enter the runtime preview event');
    await waitForGameText(gameWin, 'A Small Campaign Office', args.timeoutMs);
    await screenshot(gameWin, artifactDir, '02-runtime-first-event');
    await clickGameText(gameWin, 'Organize volunteers');
    await waitForGameText(gameWin, 'This is result text', args.timeoutMs);
    await waitForGameText(gameWin, 'Runtime preview support is visible.', args.timeoutMs);
    await screenshot(gameWin, artifactDir, '03-runtime-sidebar-changed');
    log('Runtime Preview clicked root choice, first event choice, and observed sidebar change', 'PASS', '03-runtime-sidebar-changed.png');
  } finally {
    if (!gameWin.isDestroyed()) {
      gameWin.destroy();
    }
  }
}

async function scenarioJusticePartyTemplateMod(win, args, artifactDir, log) {
  await expectVisible(win, '#studio-onboarding', 'Quick Start overlay should be visible on first launch');
  await expectVisible(win, '#onboarding-load-demo', 'Quick Start should expose bundled demo template action');
  await screenshot(win, artifactDir, '01-quick-start-template');
  log('Quick Start offers template start', 'PASS', '01-quick-start-template.png');
  await observeStep(args);

  await click(win, '#onboarding-load-demo');
  await waitForHidden(win, '#studio-onboarding', 'Quick Start should close after loading demo template');
  const loaded = await waitForProjectNamed(win, 'Dendry Mod Studio Starter Demo', args.timeoutMs);
  fs.accessSync(loaded.root, fs.constants.W_OK);
  await screenshot(win, artifactDir, '02-template-loaded');
  log('Bundled template opens as writable playtest project', 'PASS', JSON.stringify(loaded.summary || {}));
  await observeStep(args);

  await click(win, '#mode-explore');
  await click(win, '[data-view="events"]');
  await fill(win, '#search', 'Small Campaign');
  await clickRowContaining(win, '#list [data-row-key]', 'A Small Campaign Office');
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
  await waitForEntryOutput(win, 'justice_party_template_mod');
  await screenshot(win, artifactDir, '04-entry-sidebar-edited');
  log('Entry & Sidebar edits the start menu, status display, and variable-backed sidebar line', 'PASS', '04-entry-sidebar-edited.png');
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
  await screenshot(win, artifactDir, '09-variable-assisted-campaign-event');
  log('Justice Party event uses variable recommendations and custom effects', 'PASS', '09-variable-assisted-campaign-event.png');
  await observeStep(args);

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'Justice Party campaign office');
  await screenshot(win, artifactDir, '10-campaign-event-saved');
  log('Campaign event saves to My Changes', 'PASS', '10-campaign-event-saved.png');
  await observeStep(args);

  await click(win, '[data-create-template="event"]');
  await fillTraditionalJusticeNewsEvent(win);
  await waitForEventOutput(win, 'justice_party_monthly_popup');
  await screenshot(win, artifactDir, '11-traditional-news-event');
  log('Traditional monthly-popup news is drafted as a World Event', 'PASS', '11-traditional-news-event.png');
  await observeStep(args);

  await click(win, '#draft-workspace-save');
  await expectText(win, '#draft-workspace-list', 'Justice Party monthly popup');
  log('Traditional news-style event saves to My Changes', 'PASS', 'My Changes contains Justice Party monthly popup');

  await clickDraftActionContaining(win, 'Justice Party monthly popup', 'review');
  await expectText(win, '#install-checklist', 'Create the exported world event scene');
  await click(win, '#install-dry-run');
  const traditionalResult = await waitForInstallResult(win, (result) => {
    return Boolean(result && result.results && result.results.some((item) => item.id === 'create_scene' && item.status === 'would_apply'));
  }, 'Traditional monthly-popup event dry-run should create a world-event scene');
  await screenshot(win, artifactDir, '12-traditional-news-dry-run');
  log('Traditional monthly-popup event dry-run succeeds', 'PASS', JSON.stringify(statusSummary(traditionalResult)));
  await observeStep(args);

  await click(win, '#mode-create');
  await click(win, '[data-create-template="news"]');
  await fillIslandStyleJusticeNews(win);
  await waitForNewsOutput(win, 'justice_party_ticker_news');
  await screenshot(win, artifactDir, '13-island-style-news');
  log('Island-style ticker news draft renders a post_event_news snippet', 'PASS', '13-island-style-news.png');
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
  await screenshot(win, artifactDir, '14-island-style-news-dry-run');
  log('Island-style news dry-run exposes post_event_news boundary', 'PASS', JSON.stringify(statusSummary(islandResult)));
  await observeStep(args);

  await click(win, '#mode-create');
  await expectText(win, '#draft-workspace-list', 'Justice Party start menu');
  await expectText(win, '#draft-workspace-list', 'Justice Party campaign office');
  await expectText(win, '#draft-workspace-list', 'Justice Party monthly popup');
  await expectText(win, '#draft-workspace-list', 'Justice Party tests a labor-green pact');
  await screenshot(win, artifactDir, '15-mod-draft-set');
  log('Justice Party mod draft set remains available in My Changes', 'PASS', '15-mod-draft-set.png');
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
  await fill(win, '#entry-sidebar-heading', 'Campaign Status');
  await fill(win, '#entry-sidebar-body', 'Track whether the new office has turned the template into a playable campaign route.');
  await fill(win, '#entry-sidebar-status-lines', '');
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
}

async function fillIslandStyleJusticeNews(win) {
  await fill(win, '#news-id', 'justice_party_ticker_news');
  await fill(win, '#news-delivery', 'dated');
  await fill(win, '#news-headline', '[Politics] Justice Party tests a labor-green pact');
  await fill(win, '#news-year', '2025');
  await fill(win, '#news-month', '7');
  await fill(win, '#news-slot', '1');
  await fill(win, '#news-dated-requires-js', 'Q.justice_party_support >= 1');
  await fill(win, '#news-description', 'A Justice Party local office invites labor organizers and climate groups into a joint campaign committee, testing whether a small party can turn issue overlap into durable support.');
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
  const ok = await evalInPage(win, (targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!element) {
      return false;
    }
    element.scrollIntoView({block: 'center', inline: 'center'});
    element.click();
    return true;
  }, selector);
  if (!ok) {
    throw new Error('Could not click selector: ' + selector);
  }
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
    return Boolean(
      draft && draft.id === id &&
      output && output.installPlanJson && output.patchPreview &&
      String(output.scene || output.sceneDry || '').includes('tags: event, world')
    );
  }, expectedId), 'Event output should produce scene, install plan, and tags:event preview for ' + expectedId);
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

async function waitForGameText(win, expectedText, timeoutMs) {
  await waitFor(win, () => evalInPage(win, (text) => {
    const bodyText = String(document.body && (document.body.textContent || document.body.innerText) || '');
    return bodyText.includes(text);
  }, expectedText), 'Runtime Preview game should show "' + expectedText + '"', timeoutMs);
}

async function clickGameText(win, expectedText) {
  const ok = await evalInPage(win, (text) => {
    const elements = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'));
    const target = elements.find((element) => {
      const label = element.value || element.textContent || '';
      return String(label).includes(text);
    });
    if (!target) {
      return false;
    }
    target.scrollIntoView({block: 'center', inline: 'center'});
    target.click();
    return true;
  }, expectedText);
  if (!ok) {
    throw new Error('Runtime Preview could not click player option: ' + expectedText);
  }
}

async function waitForEntryOutput(win, expectedId) {
  await waitFor(win, () => evalInPage(win, (id) => {
    const wizard = window.ProjectMapEntrySidebarWizard;
    const output = wizard && wizard.getOutput && wizard.getOutput();
    const draft = wizard && wizard.getDraft && wizard.getDraft();
    return Boolean(
      draft && draft.id === id &&
      output && output.installPlanJson && output.patchPreview &&
      String(output.installPlanJson || '').includes('entry_sidebar') &&
      String(output.patchPreview || '').includes('replace section')
    );
  }, expectedId), 'Entry & Sidebar output should produce an install plan and patch preview for ' + expectedId);
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

async function replaceExistingFieldByOriginal(win, original, replacement) {
  const ok = await evalInPage(win, (originalText, replacementText) => {
    const field = Array.from(document.querySelectorAll('#existing-scene-editor-host [data-existing-field]')).find((input) => {
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
