'use strict';

const path = require('path');
const {app, BrowserWindow, Menu, dialog, ipcMain, shell} = require('electron');
const core = require('./studio_core');
const runtimeSessionCleanup = require('./runtime_session_cleanup');
const updateNotice = require('./update_notice');

const APP_ID = 'studio.dendry.mod';
const APP_NAME = 'Dendry Mod Studio';
const PROJECT_HOMEPAGE_URL = 'https://github.com/Wen387/DendryModStudio';
const PROJECT_ISSUES_URL = 'https://github.com/Wen387/DendryModStudio/issues';
const PROJECT_RELEASES_URL = 'https://github.com/Wen387/DendryModStudio/releases';
const WINDOWS_ICON = path.join(__dirname, 'assets', 'dendry-mod-studio.ico');

let mainWindow = null;
let lastProject = null;

function runtimeSessionRoots() {
  return [
    path.join(app.getPath('userData'), 'runtime-previews'),
    path.join(app.getPath('userData'), 'runtime-lenses')
  ];
}

function pruneRuntimeSessions() {
  try {
    runtimeSessionCleanup.pruneRuntimeSessionRoots(runtimeSessionRoots());
  } catch (_err) {
    // Cleanup is best-effort and must not block Studio startup or authoring.
  }
}

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

function openTrustedExternalUrl(url) {
  let parsed;
  try {
    parsed = new URL(String(url || '').trim());
  } catch (_err) {
    parsed = null;
  }
  if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) {
    return;
  }
  shell.openExternal(parsed.href).catch(() => {});
}

function showAboutDialog() {
  dialog.showMessageBox(mainWindow || null, {
    type: 'info',
    title: 'About ' + APP_NAME,
    message: APP_NAME,
    detail: [
      'Version ' + app.getVersion(),
      'Desktop Project Map for Dendry mods.',
      '',
      PROJECT_HOMEPAGE_URL
    ].join('\n'),
    buttons: ['OK']
  });
}

function buildApplicationMenuTemplate() {
  const template = [
    {
      label: 'File',
      submenu: [
        process.platform === 'darwin' ? {role: 'close'} : {role: 'quit'}
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {role: 'undo'},
        {role: 'redo'},
        {type: 'separator'},
        {role: 'cut'},
        {role: 'copy'},
        {role: 'paste'},
        {role: 'selectAll'}
      ]
    },
    {
      label: 'View',
      submenu: [
        {role: 'reload'},
        {role: 'forceReload'},
        {role: 'toggleDevTools'},
        {type: 'separator'},
        {role: 'resetZoom'},
        {role: 'zoomIn'},
        {role: 'zoomOut'},
        {type: 'separator'},
        {role: 'togglefullscreen'}
      ]
    },
    {
      label: 'Window',
      submenu: [
        {role: 'minimize'},
        {role: 'zoom'},
        ...(process.platform === 'darwin' ? [{type: 'separator'}, {role: 'front'}] : [{role: 'close'}])
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open GitHub',
          click: () => openTrustedExternalUrl(PROJECT_HOMEPAGE_URL)
        },
        {
          label: 'Report Issue',
          click: () => openTrustedExternalUrl(PROJECT_ISSUES_URL)
        },
        {
          label: 'Releases / Updates',
          click: () => openTrustedExternalUrl(PROJECT_RELEASES_URL)
        },
        {type: 'separator'},
        {
          label: 'About ' + APP_NAME,
          click: showAboutDialog
        }
      ]
    }
  ];
  if (process.platform === 'darwin') {
    template.unshift({
      label: APP_NAME,
      submenu: [
        {label: 'About ' + APP_NAME, click: showAboutDialog},
        {type: 'separator'},
        {role: 'services'},
        {type: 'separator'},
        {role: 'hide'},
        {role: 'hideOthers'},
        {role: 'unhide'},
        {type: 'separator'},
        {role: 'quit'}
      ]
    });
  }
  return template;
}

function installApplicationMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildApplicationMenuTemplate()));
}

function createWindow() {
  const paths = core.resolveResourcePaths({desktopDir: __dirname});
  const windowOptions = {
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: APP_NAME,
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

ipcMain.handle('dendry:locale', () => {
  return app.getLocale();
});

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
  const result = await core.createRuntimePreview({
    plan: options && options.plan,
    projectRoot,
    allowAdvanced: options && options.allowAdvanced === true,
    projectIndex: options && options.projectIndex,
    sessionsRoot: path.join(app.getPath('userData'), 'runtime-previews')
  });
  pruneRuntimeSessions();
  return result;
});

ipcMain.handle('dendry:runtime-preview-history', async (_event, options) => {
  return core.recordRuntimePreviewHistory(options || {});
});

ipcMain.handle('dendry:runtime-lens-create', async (_event, options) => {
  const projectRoot = chooseProjectRootForOperation(options || {});
  if (!projectRoot) {
    return {
      ok: false,
      status: 'failed',
      diagnostics: [{
        severity: 'error',
        code: 'runtime_lens.no_project',
        message: 'Open a project folder before creating a focused runtime lens.',
        confidence: 'exact'
      }],
      message: 'Open a project folder before creating a focused runtime lens.'
    };
  }
  const result = await core.createRuntimeLens({
    plan: options && options.plan,
    focus: options && options.focus,
    projectRoot,
    allowAdvanced: options && options.allowAdvanced === true,
    projectIndex: options && options.projectIndex,
    previewMode: options && options.previewMode,
    sessionsRoot: path.join(app.getPath('userData'), 'runtime-lenses')
  });
  pruneRuntimeSessions();
  return result;
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
  pruneRuntimeSessions();
  installApplicationMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  pruneRuntimeSessions();
  core.closeRuntimePreviewServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
