'use strict';

const fs = require('fs');
const path = require('path');
const {app, BrowserWindow, Menu, dialog, ipcMain, shell} = require('electron');
const core = require('./studio_core');
const objectPlaytestHost = require('./object_playtest_host');
const runtimeSessionCleanup = require('./runtime_session_cleanup');
const updateNotice = require('./update_notice');
const templateCatalog = require('./template_catalog');
// Soft-load the publish subsystem: if it ever fails to load (e.g. a stripped
// package without node_modules, so isomorphic-git is absent), the rest of the
// app must still start — publishing simply stays unavailable.
let publish = null;
try {
  publish = require('./publish');
} catch (publishLoadErr) {
  console.error('[publish] subsystem failed to load; publishing disabled:', publishLoadErr && publishLoadErr.message);
}

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
        {
          label: 'Featured Templates…',
          click: () => {
            const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            if (win) { win.webContents.send('dendry:show-catalog'); }
          }
        },
        {type: 'separator'},
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

ipcMain.handle('dendry:rebuild-project-index', async (_event, options) => {
  const root = (options && options.root) || (lastProject && lastProject.root);
  if (!root) {
    return {ok: false, message: 'No project root available.'};
  }
  // Invalidate the fingerprint cache for this project so buildProjectIndex
  // performs a full parser + indexer rebuild.
  const scratch = userDataScratchDir();
  const cacheDir = core.projectCacheDir(scratch, root);
  const fpPath = path.join(cacheDir, 'fingerprint.json');
  try { fs.unlinkSync(fpPath); } catch (_err) { /* ok if missing */ }
  return scanProject(root, options && options.includeExcerpts, _event.sender);
});

ipcMain.handle('dendry:open-starter-demo', async (_event, options) => {
  const target = _event.sender;
  const prepared = core.prepareStarterDemo({
    desktopDir: __dirname,
    workspaceRoot: userDataTemplateDir(),
    refreshIfStale: true,
    forceRefresh: Boolean(options && options.forceRefresh)
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

function userDataCatalogDir() {
  return path.join(app.getPath('userData'), 'catalog-templates');
}

ipcMain.handle('dendry:catalog-list', async (_event, options) => {
  const catalog = templateCatalog.loadBundledCatalog({desktopDir: __dirname});
  const evaluated = templateCatalog.evaluateCatalog(catalog, {
    currentVersion: app.getVersion(),
    locale: (options && options.locale) || app.getLocale()
  });
  if (!evaluated.ok) {
    return evaluated;
  }
  const templatesRoot = userDataCatalogDir();
  evaluated.templates.forEach(function (t) {
    t.status = templateCatalog.checkTemplateStatus(templatesRoot, t.id);
  });
  const installed = evaluated.templates.filter(function (t) { return t.status === 'ready'; });
  if (installed.length > 0) {
    const checks = installed.map(function (t) {
      return templateCatalog.checkUpdateAvailable(templatesRoot, t).then(function (result) {
        if (result && result.updateAvailable) {
          t.status = 'update-available';
          t.updateInfo = result;
        }
      });
    });
    await Promise.all(checks);
  }
  return evaluated;
});

ipcMain.handle('dendry:catalog-open-template', async (_event, options) => {
  const target = _event.sender;
  const templateId = options && options.templateId;
  if (!templateId) {
    return {ok: false, message: 'No templateId provided.'};
  }
  const catalog = templateCatalog.loadBundledCatalog({desktopDir: __dirname});
  const evaluated = templateCatalog.evaluateCatalog(catalog, {
    currentVersion: app.getVersion(),
    locale: (options && options.locale) || app.getLocale()
  });
  const entry = (evaluated.templates || []).find(function (t) { return t.id === templateId; });
  if (!entry) {
    return {ok: false, message: 'Template "' + templateId + '" not found in catalog.'};
  }
  const templatesRoot = userDataCatalogDir();
  if (options && options.forceUpdate) {
    var existingDir = templateCatalog.templateInstallDir(templatesRoot, templateId);
    var edits = templateCatalog.detectLocalEdits(existingDir);
    if (edits.hasEdits && !(options && options.acknowledgeEdits)) {
      return {
        ok: false,
        code: 'local_edits_detected',
        hasLocalEdits: true,
        edits: edits,
        message: 'This template has local modifications (' + edits.summary + '). Your changes will be backed up before updating.'
      };
    }
    if (edits.hasEdits) {
      templateCatalog.backupModifiedFiles(existingDir, edits);
    }
    templateCatalog.removeTemplate(existingDir);
  }
  const prepared = core.prepareCatalogTemplate({
    templatesRoot: templatesRoot,
    template: entry
  });
  if (!prepared.ok) {
    return prepared;
  }
  const installDir = prepared.installDir;
  if (prepared.needsDownload) {
    sendScanProgress(target, {
      stage: 'catalog-download',
      percent: 10,
      label: 'Downloading template: ' + entry.title + '...'
    });
    try {
      await templateCatalog.downloadAndExtract(prepared.sourceUrl, installDir, {
        onProgress: function (received, total) {
          var pct = total > 0 ? Math.round(10 + (received / total) * 50) : 30;
          sendScanProgress(target, {
            stage: 'catalog-download',
            percent: pct,
            label: 'Downloading... (' + Math.round(received / 1024 / 1024) + ' MB)'
          });
        }
      });
    } catch (err) {
      return {
        ok: false,
        id: templateId,
        message: 'Download failed: ' + (err && err.message ? err.message : String(err))
      };
    }
    templateCatalog.writeMarker(installDir, {
      id: entry.id,
      title: entry.title,
      repo: entry.repo,
      releaseTag: entry.releaseTag,
      sourceUrl: prepared.sourceUrl,
      fileSnapshot: templateCatalog.snapshotSourceFiles(installDir)
    });
    if (entry.prebuiltIndex) {
      sendScanProgress(target, {
        stage: 'catalog-index',
        percent: 62,
        label: 'Downloading pre-built index...'
      });
      try {
        await templateCatalog.downloadPrebuiltIndex(entry, installDir);
      } catch (_err) {
        // Pre-built index is optional; fall through to local scan.
      }
    }
  }
  // Asset download runs for both fresh installs and already-installed templates
  // whose assets haven't been fetched yet.
  if (entry.assetsAssetName) {
    var assetMarker = templateCatalog.readMarker(installDir);
    if (!assetMarker || !assetMarker.assetsInstalled) {
      sendScanProgress(target, {
        stage: 'catalog-assets',
        percent: 62,
        label: 'Downloading art assets (' + (entry.assetsEstimatedSizeMB || '?') + ' MB)...'
      });
      try {
        var assetsResult = await templateCatalog.downloadAssets(entry, installDir, {
          estimatedSizeMB: entry.assetsEstimatedSizeMB,
          onProgress: function (received, total) {
            var pct = total > 0 ? Math.round(62 + (received / total) * 33) : 70;
            sendScanProgress(target, {
              stage: 'catalog-assets',
              percent: pct,
              label: 'Downloading art assets... (' + Math.round(received / 1024 / 1024) + ' MB)'
            });
          }
        });
        if (assetsResult && !assetsResult.skipped) {
          var updatedMarker = templateCatalog.readMarker(installDir);
          if (updatedMarker) {
            templateCatalog.writeMarker(installDir, Object.assign({}, updatedMarker, {
              assetsInstalled: true,
              assetsAssetName: entry.assetsAssetName
            }));
          }
        } else if (assetsResult && assetsResult.skipped) {
          sendScanProgress(target, {
            stage: 'catalog-assets',
            percent: 95,
            label: 'Art assets not yet available on this release.'
          });
        }
      } catch (_err) {
        // Assets are supplementary; the template is still usable without them.
        sendScanProgress(target, {
          stage: 'catalog-assets',
          percent: 95,
          label: 'Art assets unavailable — template loaded without images/music.'
        });
      }
    }
  }
  sendScanProgress(target, {
    stage: 'catalog-load',
    percent: 96,
    label: 'Loading project index...'
  });
  var hasLocalEdits = templateCatalog.detectLocalEdits(installDir).hasEdits;
  if (!hasLocalEdits) {
    var cached = core.loadCatalogTemplateIndex({
      installDir: installDir,
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
          id: entry.id,
          title: entry.title,
          installDir: installDir
        }
      });
    }
  }
  var validation = core.validateProjectRoot(installDir);
  var scanRoot = validation.ok ? validation.root : installDir;
  var result = await scanProject(scanRoot, options && options.includeExcerpts, target);
  return Object.assign({}, result, {
    template: {
      id: entry.id,
      title: entry.title,
      installDir: installDir
    }
  });
});

ipcMain.handle('dendry:catalog-remove-template', async (_event, options) => {
  var templateId = options && options.templateId;
  if (!templateId) {
    return {ok: false, message: 'No templateId provided.'};
  }
  var installDir = templateCatalog.templateInstallDir(userDataCatalogDir(), templateId);
  var edits = templateCatalog.detectLocalEdits(installDir);
  if (edits.hasEdits && !(options && options.acknowledgeEdits)) {
    return {
      ok: false,
      code: 'local_edits_detected',
      hasLocalEdits: true,
      edits: edits,
      message: 'This template has local modifications (' + edits.summary + '). Your changes will be backed up before removing.'
    };
  }
  if (edits.hasEdits) {
    templateCatalog.backupModifiedFiles(installDir, edits);
  }
  return templateCatalog.removeTemplate(installDir);
});

ipcMain.handle('dendry:catalog-template-info', async (_event, options) => {
  var templateId = options && options.templateId;
  if (!templateId) {
    return {ok: false, message: 'No templateId provided.'};
  }
  var installDir = templateCatalog.templateInstallDir(userDataCatalogDir(), templateId);
  var marker = templateCatalog.readMarker(installDir);
  if (!marker) {
    return {ok: false, code: 'not_installed'};
  }
  var edits = templateCatalog.detectLocalEdits(installDir);
  var info = {
    ok: true,
    id: templateId,
    installedAt: marker.installedAt || '',
    releaseTag: marker.releaseTag || '',
    edits: edits,
    fileCount: Array.isArray(marker.fileSnapshot) ? marker.fileSnapshot.length : 0
  };
  var cached = core.loadCatalogTemplateIndex({installDir: installDir, includeExcerpts: false});
  if (cached.ok && cached.index) {
    var idx = cached.index;
    info.indexStats = {
      scenes: Array.isArray(idx.scenes) ? idx.scenes.length : 0,
      variables: Array.isArray(idx.variables) ? idx.variables.length : 0,
      events: idx.semantic && idx.semantic.events ? (idx.semantic.events.items || []).length : 0
    };
  }
  // Report split art-asset archive state so the catalog card can show whether
  // the large image/audio assets are present, still downloadable, or absent for
  // this template. The download itself is driven by the marker.assetsInstalled
  // flag in the catalog open flow.
  var catalog = templateCatalog.loadBundledCatalog({desktopDir: __dirname});
  var entry = (catalog.templates || []).find(function (e) { return e && e.id === templateId; });
  if (entry && entry.assetsAssetName) {
    info.assets = {
      available: true,
      installed: Boolean(marker.assetsInstalled),
      estimatedSizeMB: entry.assetsEstimatedSizeMB || 0
    };
  } else {
    info.assets = {available: false, installed: false, estimatedSizeMB: 0};
  }
  return info;
});

ipcMain.handle('dendry:read-source-slice', async (_event, options) => {
  const projectRoot = chooseProjectRootForOperation(options || {});
  if (!projectRoot) {
    return {ok: false, code: 'read_slice.no_project', message: 'Open a project folder before reading source slices.'};
  }
  return core.readSourceSlice({
    root: projectRoot,
    path: options && options.path,
    startLine: options && options.startLine,
    endLine: options && options.endLine
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
    allowAdvanced: options && options.allowAdvanced === true,
    includeEvidence: options && options.includeEvidence === true
  });
});

ipcMain.handle('dendry:object-playtest', async (_event, options) => {
  if (!objectPlaytestHost.isSupported()) {
    return {ok: false, error: 'unsupported', message: 'The DendryNexus runtime is not available for play-testing.'};
  }
  const projectRoot = chooseProjectRootForOperation(options || {});
  if (!projectRoot) {
    return {ok: false, error: 'no-project', message: 'Open a project folder before play-testing an object.'};
  }
  return objectPlaytestHost.handle(Object.assign({}, options, {projectRoot}));
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
    sessionsRoot: path.join(app.getPath('userData'), 'runtime-previews'),
    locale: (options && options.locale) || app.getLocale()
  });
  pruneRuntimeSessions();
  return result;
});

ipcMain.handle('dendry:runtime-preview-history', async (_event, options) => {
  return core.recordRuntimePreviewHistory(options || {});
});

ipcMain.handle('dendry:runtime-preview-close', async () => {
  return new Promise((resolve) => {
    core.closeRuntimePreviewServer(() => {
      resolve({
        ok: true,
        message: 'Runtime preview server closed.'
      });
    });
  });
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

if (publish && typeof publish.register === 'function') {
  publish.register({ipcMain, app, shell, getProjectRoot: () => chooseProjectRootForOperation({})});
}

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
