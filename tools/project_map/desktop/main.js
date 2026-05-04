'use strict';

const path = require('path');
const {app, BrowserWindow, dialog, ipcMain, shell} = require('electron');
const core = require('./studio_core');
const updateNotice = require('./update_notice');

const APP_ID = 'studio.dendry.mod';
const WINDOWS_ICON = path.join(__dirname, 'assets', 'dendry-mod-studio.ico');

let mainWindow = null;
let lastProject = null;

function planProjectRoot(plan) {
  return plan && plan.project && typeof plan.project.root === 'string'
    ? plan.project.root.trim()
    : '';
}

function chooseProjectRootForOperation(options) {
  const candidates = [
    options && options.projectRoot,
    planProjectRoot(options && options.plan),
    lastProject && lastProject.root
  ];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const validation = core.validateProjectRoot(candidate);
    if (validation.ok) {
      return validation.root;
    }
  }
  return candidates.find(Boolean) || '';
}

function createWindow() {
  const paths = core.resolveResourcePaths({desktopDir: __dirname});
  const windowOptions = {
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: 'Dendry Mod Studio',
    backgroundColor: '#f4f2ec',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  };
  if (process.platform === 'win32') {
    windowOptions.icon = WINDOWS_ICON;
  }
  mainWindow = new BrowserWindow(windowOptions);
  mainWindow.loadFile(paths.viewerIndex);
}

function userDataScratchDir() {
  return path.join(app.getPath('userData'), 'project-indexes');
}

function userDataTemplateDir() {
  return path.join(app.getPath('userData'), 'templates');
}

function sendScanProgress(target, update) {
  if (!target || typeof target.send !== 'function' || target.isDestroyed()) {
    return;
  }
  target.send('dendry:scan-progress', update);
}

function rememberProject(result) {
  if (!result || !result.ok) {
    return;
  }
  lastProject = {
    root: result.root,
    projectName: result.projectName,
    indexPath: result.indexPath,
    includeExcerpts: result.includeExcerpts,
    summary: result.summary
  };
}

async function scanProject(root, includeExcerpts, progressTarget) {
  const target = progressTarget || (mainWindow && mainWindow.webContents);
  try {
    const result = await core.buildProjectIndex({
      root,
      outDir: userDataScratchDir(),
      includeExcerpts: Boolean(includeExcerpts),
      onProgress: (update) => sendScanProgress(target, update)
    });
    if (result.ok) {
      rememberProject(result);
    }
    return result;
  } catch (err) {
    const error = core.friendlyError(err);
    const message = error.message || 'Could not open project.';
    sendScanProgress(target, {
      stage: 'failed',
      percent: 100,
      label: message,
      error: true
    });
    return {
      ok: false,
      stage: 'failed',
      error,
      message
    };
  }
}

ipcMain.handle('dendry:desktop-state', () => ({
  ok: true,
  lastProject
}));

ipcMain.handle('dendry:doctor', async (_event, options) => {
  return core.runDesktopDoctor({
    root: options && options.root,
    includeExcerpts: options && options.includeExcerpts,
    outDir: userDataScratchDir()
  });
});

ipcMain.handle('dendry:open-project', async (_event, options) => {
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Dendry Project Folder',
    properties: ['openDirectory']
  });
  if (selection.canceled || !selection.filePaths || !selection.filePaths[0]) {
    return {
      ok: false,
      canceled: true,
      message: 'No project folder selected.'
    };
  }
  return scanProject(selection.filePaths[0], options && options.includeExcerpts, _event.sender);
});

ipcMain.handle('dendry:scan-project', async (_event, options) => {
  return scanProject(options && options.root, options && options.includeExcerpts, _event.sender);
});

ipcMain.handle('dendry:open-starter-demo', async (_event, options) => {
  const target = _event.sender;
  const prepared = core.prepareStarterDemo({
    desktopDir: __dirname,
    workspaceRoot: userDataTemplateDir()
  });
  if (!prepared.ok) {
    return prepared;
  }
  sendScanProgress(target, {
    stage: 'starter-demo',
    percent: 40,
    label: 'Opening bundled demo template...'
  });
  const cached = core.loadStarterDemoIndex({
    desktopDir: __dirname,
    prepared,
    includeExcerpts: options && options.includeExcerpts
  });
  if (cached.ok) {
    rememberProject(cached);
    sendScanProgress(target, {
      stage: 'complete',
      percent: 100,
      label: 'Project loaded.'
    });
    return Object.assign({}, cached, {
      template: {
        id: prepared.id,
        title: prepared.title,
        sourceRoot: prepared.sourceRoot,
        workspaceRoot: prepared.targetRoot,
        reused: prepared.reused
      }
    });
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

ipcMain.handle('dendry:install-plan-apply', async (_event, options) => {
  const projectRoot = chooseProjectRootForOperation(options || {});
  if (!projectRoot) {
    return {
      ok: false,
      dryRun: !(options && options.dryRun === false),
      results: [],
      diagnostics: [{
        severity: 'error',
        code: 'desktop_install.no_project',
        message: 'Open a project folder before using the Install Assistant.',
        confidence: 'exact'
      }],
      message: 'Open a project folder before using the Install Assistant.'
    };
  }
  return core.applyInstallPlan({
    plan: options && options.plan,
    projectRoot,
    dryRun: !(options && options.dryRun === false),
    allowAdvanced: options && options.allowAdvanced === true
  });
});

ipcMain.handle('dendry:runtime-preview-create', async (_event, options) => {
  const projectRoot = chooseProjectRootForOperation(options || {});
  if (!projectRoot) {
    return {
      ok: false,
      diagnostics: [{
        severity: 'error',
        code: 'runtime_preview.no_project',
        message: 'Open a project folder before creating a runtime preview.',
        confidence: 'exact'
      }],
      message: 'Open a project folder before creating a runtime preview.'
    };
  }
  return core.createRuntimePreview({
    plan: options && options.plan,
    projectRoot,
    allowAdvanced: options && options.allowAdvanced === true,
    projectIndex: options && options.projectIndex,
    sessionsRoot: path.join(app.getPath('userData'), 'runtime-previews')
  });
});

ipcMain.handle('dendry:runtime-preview-history', async (_event, options) => {
  return core.recordRuntimePreviewHistory(options || {});
});

ipcMain.handle('dendry:update-notice-check', async (_event, options) => {
  return updateNotice.checkForUpdate({
    desktopDir: __dirname,
    timeoutMs: options && options.timeoutMs,
    manifestUrl: options && options.manifestUrl
  });
});

ipcMain.handle('dendry:open-external-url', async (_event, options) => {
  const url = String(options && options.url || '').trim();
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_err) {
    parsed = null;
  }
  if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) {
    return {ok: false, message: 'Only http(s) links can be opened from update notices.'};
  }
  await shell.openExternal(parsed.href);
  return {ok: true};
});

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
