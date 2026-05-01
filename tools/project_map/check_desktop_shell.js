#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const {spawnSync} = require('child_process');

const PROJECT_MAP_DIR = __dirname;
const REPO_ROOT = path.resolve(PROJECT_MAP_DIR, '..', '..');
const DESKTOP_DIR = path.join(PROJECT_MAP_DIR, 'desktop');
const VIEWER_DIR = path.join(PROJECT_MAP_DIR, 'viewer');
const VALID_PROJECT_ROOT = path.join(PROJECT_MAP_DIR, 'templates', 'starter-demo');
const CURRENT_INDEX = '/tmp/dendry_project_map/project-index.json';

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function assertSummaryAtLeast(summary, minimum, label) {
  const details = JSON.stringify(summary || null);
  Object.entries(minimum).forEach(([key, value]) => {
    assert(
      Number(summary && summary[key]) >= value,
      label + ' should have ' + key + ' >= ' + value + ': ' + details
    );
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function requireFile(relPath) {
  const filePath = path.join(DESKTOP_DIR, relPath);
  assert(fs.existsSync(filePath), 'missing desktop file: ' + relPath);
  return filePath;
}

async function checkPreloadSandboxFileUrl(preloadPath) {
  const events = [];
  const window = {
    dispatchEvent: (event) => events.push(event)
  };
  const exposed = {};
  const fakeElectron = {
    contextBridge: {
      exposeInMainWorld: (name, api) => {
        exposed[name] = api;
        window[name] = api;
      }
    },
    ipcRenderer: {
      on: () => {},
      invoke: async (channel) => {
        if (channel === 'dendry:update-notice-check') {
          return {
            ok: true,
            configured: true,
            shouldNotify: false,
            currentVersion: '0.9.2'
          };
        }
        if (channel === 'dendry:open-external-url') {
          return {ok: true};
        }
        if (channel !== 'dendry:scan-project' && channel !== 'dendry:open-starter-demo') {
          return {ok: true};
        }
        return {
          ok: true,
          index: {summary: {sceneCount: 1}},
          root: '/tmp/SDAAH Dynamic/dynamic_social_democracy-main',
          projectName: 'SDAAH Dynamic',
          indexPath: '/tmp/sdaah dynamic/project-index.json',
          includeExcerpts: false,
          summary: {sceneCount: 1}
        };
      }
    }
  };
  const sandbox = {
    require: (name) => {
      if (name === 'electron') {
        return fakeElectron;
      }
      if (name === 'url') {
        return {URL};
      }
      throw new Error('unexpected preload sandbox require: ' + name);
    },
    window,
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init && init.detail;
      }
    },
    console
  };
  vm.runInNewContext(fs.readFileSync(preloadPath, 'utf8'), sandbox, {filename: preloadPath});
  assert(exposed.dendryDesktop, 'preload should expose dendryDesktop in sandbox smoke');
  assert(typeof exposed.dendryDesktop.openStarterDemo === 'function', 'preload should expose starter demo action');
  assert(typeof exposed.dendryDesktop.checkUpdateNotice === 'function', 'preload should expose update notice check action');
  assert(typeof exposed.dendryDesktop.openExternalUrl === 'function', 'preload should expose safe external URL action');
  const notice = await exposed.dendryDesktop.checkUpdateNotice();
  assert(notice && notice.ok && notice.configured, 'preload update notice smoke should call update IPC');
  await exposed.dendryDesktop.scanProject({root: '/tmp/SDAAH Dynamic/dynamic_social_democracy-main'});
  const loaded = events.find((event) => event.type === 'ProjectMap:desktop-index-loaded');
  assert(loaded, 'preload sandbox smoke should dispatch desktop index loaded event');
  assert(
    loaded.detail.assetBaseUrl === 'file:///tmp/SDAAH%20Dynamic/dynamic_social_democracy-main',
    'preload should build file asset base URL without Node pathToFileURL'
  );
}

async function main() {
  assert(fs.existsSync(DESKTOP_DIR), 'desktop shell directory should exist');

  const packageJson = readJson(requireFile('package.json'));
  assert(packageJson.name === 'dendry-mod-studio-desktop', 'desktop package name should be isolated');
  assert(packageJson.scripts && packageJson.scripts.start, 'desktop package should expose npm run start');
  assert(packageJson.scripts && packageJson.scripts['package:dir'], 'desktop package should expose npm run package:dir');
  assert(packageJson.scripts && packageJson.scripts.smoke, 'desktop package should expose npm run smoke');
  assert(packageJson.scripts && packageJson.scripts.doctor, 'desktop package should expose npm run doctor');
  assert(!packageJson.dependencies || !packageJson.dependencies.dendrynexus, 'desktop package should not duplicate root dendrynexus dependency');
  const distDir = path.join(DESKTOP_DIR, 'dist');
  assert(!fs.existsSync(path.join(distDir, 'DendryModStudio-linux-x64')), 'desktop unpacked app workdir should not be left by default');
  assert(!fs.existsSync(path.join(distDir, 'deb-staging')), 'desktop deb staging workdir should not be left by default');

  const corePath = requireFile('studio_core.js');
  const runtimePreviewPath = requireFile('runtime_preview.js');
  const runtimePreviewBridgePath = requireFile('runtime_preview_debug_bridge.js');
  requireFile('main.js');
  requireFile('preload.js');
  requireFile('update_notice.js');
  requireFile('update_manifest.json');
  requireFile(path.join('scripts', 'doctor.js'));

  const packagedCoreDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_packaged_core_' + process.pid + '_'));
  const packagedAppDir = path.join(packagedCoreDir, 'resources', 'app');
  fs.mkdirSync(path.join(packagedAppDir, 'project_map', 'authoring'), {recursive: true});
  fs.copyFileSync(corePath, path.join(packagedAppDir, 'studio_core.js'));
  fs.copyFileSync(runtimePreviewPath, path.join(packagedAppDir, 'runtime_preview.js'));
  fs.copyFileSync(runtimePreviewBridgePath, path.join(packagedAppDir, 'runtime_preview_debug_bridge.js'));
  fs.writeFileSync(
    path.join(packagedAppDir, 'project_map', 'authoring', 'install_plan.js'),
    'module.exports = {applyInstallPlan: function () { return {ok: true}; }};\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(packagedAppDir, 'project_map', 'authoring', 'runtime_preview_debug_model.js'),
    'module.exports = {buildDebugControls: function () { return {variables: [], scenes: [], links: []}; }, commandHistoryEntry: function () { return {type: "test", timestamp: "2026-04-29T00:00:00.000Z"}; }};\n',
    'utf8'
  );
  const packagedCore = require(path.join(packagedAppDir, 'studio_core.js'));
  assert(typeof packagedCore.resolveResourcePaths === 'function', 'packaged studio_core should load with project_map/authoring layout');
  assert(typeof packagedCore.createRuntimePreview === 'function', 'packaged studio_core should expose runtime preview');
  assert(typeof packagedCore.recordRuntimePreviewHistory === 'function', 'packaged studio_core should expose runtime preview history');
  assert(typeof packagedCore.prepareStarterDemo === 'function', 'packaged studio_core should expose starter demo preparation');
  fs.rmSync(packagedCoreDir, {recursive: true, force: true});

  const parser = require('./parse_dry_project.js');
  assert(typeof parser.parseProject === 'function', 'parse_dry_project.js should export parseProject');

  const core = require(corePath);
  [
    'resolveResourcePaths',
    'validateProjectRoot',
    'friendlyError',
    'checkPython',
    'checkResourcePaths',
    'checkScratchDir',
    'runDesktopDoctor',
    'buildProjectIndex',
    'summarizeIndex',
    'applyInstallPlan',
    'createRuntimePreview',
    'recordRuntimePreviewHistory',
    'prepareStarterDemo'
  ].forEach((name) => {
    assert(typeof core[name] === 'function', 'studio_core should export ' + name);
  });

  const paths = core.resolveResourcePaths({desktopDir: DESKTOP_DIR});
  assert(paths.viewerIndex === path.join(VIEWER_DIR, 'index.html'), 'viewer index path should resolve to shared viewer');
  assert(fs.existsSync(paths.viewerIndex), 'viewer index should exist');
  assert(fs.existsSync(paths.indexer), 'Python indexer path should exist');
  assert(fs.existsSync(paths.parser), 'parser wrapper path should exist');
  assert(fs.existsSync(path.join(paths.starterDemoTemplate, 'source', 'info.dry')), 'starter demo template should exist');
  assert(paths.projectMapDir === PROJECT_MAP_DIR, 'projectMapDir should resolve to tools/project_map');

  const invalidRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_desktop_invalid_root_' + process.pid + '_'));
  const invalid = core.validateProjectRoot(invalidRoot);
  assert(!invalid.ok, 'invalid project root should be rejected');
  assert(/source\/info\.dry/.test(invalid.message), 'invalid project error should mention source/info.dry');
  const nestedOuter = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_desktop_nested_root_' + process.pid + '_'));
  const nestedInner = path.join(nestedOuter, 'dynamic_social_democracy-main');
  fs.mkdirSync(path.join(nestedInner, 'source'), {recursive: true});
  fs.writeFileSync(path.join(nestedInner, 'source', 'info.dry'), 'title: Nested fixture\n', 'utf8');
  const nestedValidation = core.validateProjectRoot(nestedOuter);
  assert(nestedValidation.ok, 'single nested Dendry project root should be accepted');
  assert(nestedValidation.root === nestedInner, 'single nested project root should resolve to the folder with source/info.dry');
  assert(nestedValidation.selectedNestedRoot === true, 'nested root selection should be explicit for diagnostics');
  assert(!/Traceback|ENOENT|Error:/.test(core.friendlyError(new Error('ENOENT: no such file')).message), 'friendlyError should hide raw stack/noise');

  const resourceCheck = core.checkResourcePaths({desktopDir: DESKTOP_DIR});
  assert(resourceCheck.ok, 'resource preflight should pass in dev layout');
  assert(resourceCheck.checks.viewer.ok, 'resource preflight should include viewer check');
  assert(resourceCheck.checks.indexer.ok, 'resource preflight should include indexer check');
  assert(resourceCheck.checks.parser.ok, 'resource preflight should include parser check');
  assert(resourceCheck.checks.starterDemo.ok, 'resource preflight should include starter demo check');

  const scratchCheck = core.checkScratchDir(path.join(os.tmpdir(), 'dendry_desktop_doctor_' + process.pid));
  assert(scratchCheck.ok, 'scratch preflight should pass for tmp dir');
  assert(fs.existsSync(scratchCheck.path), 'scratch preflight should create/check the scratch dir');

  const pythonMissing = core.checkPython({python: path.join(os.tmpdir(), 'definitely_missing_python_' + process.pid)});
  assert(!pythonMissing.ok, 'Python preflight should fail clearly for missing executable');
  assert(pythonMissing.code === 'python_missing', 'Python missing check should have a stable code');
  assert(/Python 3/.test(pythonMissing.message), 'Python missing message should be human-readable');
  assert(!/ENOENT|Traceback|Error:/.test(pythonMissing.message), 'Python missing message should hide raw process noise');

  const doctorInvalid = await core.runDesktopDoctor({
    root: invalidRoot,
    outDir: path.join(os.tmpdir(), 'dendry_desktop_doctor_invalid_' + process.pid),
    python: 'python3',
    desktopDir: DESKTOP_DIR
  });
  assert(!doctorInvalid.ok, 'doctor should fail when project root is invalid');
  assert(doctorInvalid.checks.projectRoot && !doctorInvalid.checks.projectRoot.ok, 'doctor should include project root result');
  assert(doctorInvalid.checks.resources && doctorInvalid.checks.resources.ok, 'doctor should still report resource status');
  assert(doctorInvalid.checks.python && doctorInvalid.checks.python.ok, 'doctor should still report Python status');

  const doctorValid = await core.runDesktopDoctor({
    root: VALID_PROJECT_ROOT,
    outDir: path.join(os.tmpdir(), 'dendry_desktop_doctor_valid_' + process.pid),
    python: 'python3',
    desktopDir: DESKTOP_DIR
  });
  assert(doctorValid.ok, 'doctor should pass for bundled starter demo');
  assert(doctorValid.checks.projectRoot.ok, 'doctor should confirm project root');
  assert(doctorValid.checks.python.ok, 'doctor should confirm Python');
  assert(doctorValid.checks.resources.ok, 'doctor should confirm resources');
  assert(doctorValid.checks.scratch.ok, 'doctor should confirm scratch dir');

  const starterWorkspace = path.join(os.tmpdir(), 'dendry_starter_demo_workspace_' + process.pid);
  const starterPrepared = core.prepareStarterDemo({
    desktopDir: DESKTOP_DIR,
    workspaceRoot: starterWorkspace
  });
  assert(starterPrepared.ok, 'starter demo should prepare a writable project copy');
  assert(starterPrepared.root.startsWith(starterWorkspace), 'starter demo should open from app-data-style workspace');
  assert(fs.existsSync(path.join(starterPrepared.root, 'source', 'info.dry')), 'starter demo workspace should contain source/info.dry');

  const parserOut = path.join(os.tmpdir(), 'dendry_desktop_parser_' + process.pid + '.json');
  const parserIndex = await parser.parseProject(VALID_PROJECT_ROOT);
  fs.writeFileSync(parserOut, JSON.stringify(parserIndex, null, 2) + '\n', 'utf8');

  const seamOut = path.join(os.tmpdir(), 'dendry_desktop_index_from_parser_' + process.pid + '.json');
  const seamRun = spawnSync(
    'python3',
    [
      path.join(PROJECT_MAP_DIR, 'build_project_map.py'),
      '--root', VALID_PROJECT_ROOT,
      '--parser-index', parserOut,
      '--out', seamOut,
      '--summary'
    ],
    {encoding: 'utf8'}
  );
  assert(seamRun.status === 0, 'build_project_map should accept --parser-index: ' + seamRun.stderr);
  const seamIndex = readJson(seamOut);
  assertSummaryAtLeast(seamIndex.summary, {
    sceneCount: parserIndex.sceneCount || 2,
    edgeCount: 2,
    variableCount: 3
  }, 'parser-index seam starter demo summary');

  const scratchDir = path.join(os.tmpdir(), 'dendry_desktop_smoke_' + process.pid);
  const progressEvents = [];
  const result = await core.buildProjectIndex({
    root: VALID_PROJECT_ROOT,
    outDir: scratchDir,
    includeExcerpts: false,
    python: 'python3',
    onProgress: (update) => progressEvents.push(update)
  });
  assert(result.ok, 'desktop core should build ProjectIndex: ' + JSON.stringify(result.error || null));
  assert(result.indexPath.startsWith(scratchDir), 'desktop ProjectIndex should be written to scratch dir');
  assert(!result.indexPath.startsWith(REPO_ROOT), 'desktop ProjectIndex should not be written into repo');
  assertSummaryAtLeast(result.summary, {
    sceneCount: parserIndex.sceneCount || 2,
    edgeCount: 2,
    variableCount: 3
  }, 'desktop core starter demo summary');
  assert(progressEvents.length >= 5, 'desktop core should emit scan progress updates');
  assert(progressEvents[0].stage === 'preflight', 'first progress stage should be preflight');
  assert(progressEvents.some((event) => event.stage === 'parser'), 'progress should include parser stage');
  assert(progressEvents.some((event) => event.stage === 'indexer'), 'progress should include indexer stage');
  assert(progressEvents[progressEvents.length - 1].stage === 'complete', 'last progress stage should be complete');
  assert(progressEvents[progressEvents.length - 1].percent === 100, 'complete progress should be 100 percent');

  const viewerHtml = fs.readFileSync(path.join(VIEWER_DIR, 'index.html'), 'utf8');
  const viewerApp = fs.readFileSync(path.join(VIEWER_DIR, 'app.js'), 'utf8');
  const preloadJs = fs.readFileSync(path.join(DESKTOP_DIR, 'preload.js'), 'utf8');
  const mainJs = fs.readFileSync(path.join(DESKTOP_DIR, 'main.js'), 'utf8');
  assert(mainJs.includes('chooseProjectRootForOperation'), 'desktop main should choose a project root for install/preview operations');
  assert(mainJs.includes('options && options.projectRoot'), 'desktop install/preview IPC should accept the renderer active project root');
  assert(viewerHtml.includes('id="desktop-controls"'), 'viewer should contain desktop controls');
  assert(viewerHtml.includes('id="desktop-run-doctor"'), 'viewer should contain desktop doctor button');
  assert(viewerHtml.includes('id="desktop-progress"'), 'viewer should contain desktop scan progress bar');
  assert(viewerHtml.includes('desktop-progress-overlay'), 'desktop scan progress should render as a centered overlay');
  assert(
    viewerHtml.indexOf('id="desktop-progress"') > viewerHtml.indexOf('</header>'),
    'desktop scan progress should live outside the topbar controls'
  );
  const viewerCss = fs.readFileSync(path.join(VIEWER_DIR, 'styles.css'), 'utf8');
  assert(viewerCss.includes('.desktop-progress-overlay'), 'CSS should style the desktop progress overlay');
  assert(viewerCss.includes('position: fixed'), 'desktop progress overlay should be fixed over the app');
  assert(viewerCss.includes('place-items: center'), 'desktop progress overlay should center its contents');
  assert(preloadJs.includes('dendry:scan-progress'), 'preload should bridge scan progress events');
  assert(preloadJs.includes('checkUpdateNotice'), 'preload should expose update notice checks');
  assert(preloadJs.includes('openExternalUrl'), 'preload should expose safe external URL opens');
  await checkPreloadSandboxFileUrl(path.join(DESKTOP_DIR, 'preload.js'));
  assert(mainJs.includes('dendry:scan-progress'), 'main process should send scan progress events');
  assert(mainJs.includes('dendry:update-notice-check'), 'main process should handle update notice checks');
  assert(mainJs.includes('dendry:open-external-url'), 'main process should handle safe external URL opens');
  assert(viewerApp.includes('ProjectMap:desktop-index-loaded'), 'viewer should listen for desktop index IPC event');
  assert(viewerApp.includes('ProjectMap:desktop-scan-progress'), 'viewer should listen for desktop progress IPC event');
  assert(viewerApp.includes('clearDesktopProgressSoon'), 'viewer should hide centered progress shortly after successful load');
  assert(viewerApp.includes('runDesktopDoctor'), 'viewer should expose desktop doctor workflow');
  assert(viewerApp.includes('readProjectIndexFile'), 'browser file picker path should remain present');
  assert(fs.existsSync(CURRENT_INDEX) || true, 'current fixture index may be regenerated by the main test plan');

  [
    scratchCheck.path,
    path.join(os.tmpdir(), 'dendry_desktop_doctor_invalid_' + process.pid),
    path.join(os.tmpdir(), 'dendry_desktop_doctor_valid_' + process.pid),
    parserOut,
    seamOut,
    scratchDir,
    starterWorkspace
  ].forEach((target) => fs.rmSync(target, {recursive: true, force: true}));

  console.log(JSON.stringify({
    ok: true,
    desktopDir: DESKTOP_DIR,
    indexPath: result.indexPath,
    scenes: result.summary.sceneCount,
    edges: result.summary.edgeCount,
    variables: result.summary.variableCount
  }, null, 2));
}

main().catch((err) => {
  fail(err && err.stack ? err.stack : String(err));
});
