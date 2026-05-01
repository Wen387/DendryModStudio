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
      'uses a deterministic QA dialog shim for native folder selection'
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
      'uses a deterministic QA dialog shim for native folder selection'
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
      'uses a deterministic QA dialog shim for native folder selection',
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
  }
};

function parseArgs(argv) {
  const args = {
    scenario: 'first_time_user',
    projectRoot: DEFAULT_PROJECT_ROOT,
    wrongProjectRoot: DEFAULT_WRONG_PROJECT_ROOT,
    headed: false,
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
    if (arg === '--scenario' || arg === '--project-root' || arg === '--wrong-project-root' || arg === '--artifact-dir' || arg === '--timeout-ms') {
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
    throw new Error('Electron dependency was not found. Run `cd tools/project_map/desktop && npm install` first.');
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
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
  const artifactDir = ensureDir(args.artifactDir || path.join(os.tmpdir(), 'dendry_mod_studio_qa', runId));
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
    message: 'Runtime Preview is outside the first player-like QA MVP.'
  }));
  ipcMain.handle('dendry:runtime-preview-history', async (event, options) => options || {});

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
      await writeArtifacts(artifactDir, args, transcript, consoleMessages, dialogSelections, true);
      await app.quit();
    } catch (err) {
      log('scenario failure', 'FAIL', err && err.stack ? err.stack : String(err));
      await writeArtifacts(artifactDir, args, transcript, consoleMessages, dialogSelections, false);
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

async function writeArtifacts(artifactDir, args, transcript, consoleMessages, dialogSelections, ok) {
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
    '- Project root: `' + args.projectRoot + '`',
    '- Wrong-project root: `' + args.wrongProjectRoot + '`',
    '- Artifact directory: `' + artifactDir + '`',
    '- Player-like actions: ' + (scenario.playerLike || []).map((item) => '`' + item + '`').join('; '),
    '- Shortcuts: ' + (scenario.shortcuts || []).map((item) => '`' + item + '`').join('; '),
    '- Dialog shim selections: ' + (dialogSelections || []).map((item) => '`#' + item.call + ' ' + item.key + ' -> ' + item.root + '`').join('; '),
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
  log('Quick Start primary opens project picker', 'PASS', 'QA dialog shim selects project root');

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
