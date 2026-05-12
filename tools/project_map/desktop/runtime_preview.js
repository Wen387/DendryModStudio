'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const installPlan = requireAuthoringModule('install_plan.js');
const debugModel = requireAuthoringModule('runtime_preview_debug_model.js');
const snapshotModel = requireAuthoringModule('runtime_snapshot_model.js');
const domMapModel = requireAuthoringModule('runtime_dom_map_model.js');
const debugBridge = require('./runtime_preview_debug_bridge.js');

const BUILD_TIMEOUT_MS = 5 * 60 * 1000;
const COMMAND_CHECK_TIMEOUT_MS = 10 * 1000;

const previewServers = new Map();

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireAuthoringModule(fileName) {
  const candidates = [
    path.join(__dirname, '..', 'authoring', fileName),
    path.join(__dirname, 'project_map', 'authoring', fileName)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }
  throw new Error('Runtime preview authoring helper not found: ' + fileName);
}

function safeId(value, fallback) {
  return String(value || fallback || 'preview')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || String(fallback || 'preview');
}

function validateProjectRoot(projectRoot) {
  const root = path.resolve(String(projectRoot || ''));
  if (!projectRoot || !fs.existsSync(path.join(root, 'source', 'info.dry'))) {
    return {ok: false, root, message: 'Runtime preview needs an opened Dendry project with source/info.dry.'};
  }
  return {ok: true, root};
}

function defaultSessionsRoot(options) {
  return path.resolve(String(options && options.sessionsRoot || path.join(os.tmpdir(), 'dendry-mod-studio-runtime-previews')));
}

function createSession(options) {
  const opts = isObject(options) ? options : {};
  const timing = opts.timing || null;
  const project = validateProjectRoot(opts.projectRoot);
  if (!project.ok) {
    return {ok: false, diagnostics: [diagnostic('error', 'runtime_preview.project_root', project.message)]};
  }
  const plan = isObject(opts.plan) ? opts.plan : {};
  const now = typeof opts.now === 'function' ? opts.now() : new Date();
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const sessionId = stamp + '-' + safeId(plan.id || plan.title || 'runtime-preview', 'runtime-preview');
  const root = path.join(defaultSessionsRoot(opts), sessionId);
  const baselineRoot = path.join(root, 'baseline');
  const modifiedRoot = path.join(root, 'modified');
  fs.mkdirSync(root, {recursive: true});
  const baselineStarted = Date.now();
  copyProject(project.root, baselineRoot);
  markTiming(timing, 'copy_baseline_project', baselineStarted);
  const modifiedStarted = Date.now();
  copyProject(project.root, modifiedRoot);
  markTiming(timing, 'copy_modified_project', modifiedStarted);
  const metadata = {
    schemaVersion: '0.1',
    kind: 'dendry_mod_studio_runtime_preview',
    mode: 'full',
    sessionId,
    createdAt: now.toISOString(),
    projectRoot: project.root,
    planId: String(plan.id || ''),
    title: String(plan.title || plan.id || 'Runtime Preview')
  };
  const metadataPath = path.join(root, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n', 'utf8');
  markTiming(timing, 'write_metadata');
  return {
    ok: true,
    sessionId,
    mode: 'full',
    metadata,
    paths: {root, baselineRoot, modifiedRoot, metadataPath},
    diagnostics: []
  };
}

function createRuntimePreview(options) {
  const opts = isObject(options) ? options : {};
  const timing = createTiming();
  const session = createSession(Object.assign({}, opts, {timing}));
  if (!session.ok) {
    return Object.assign({}, session, {timings: finishTiming(timing)});
  }
  const plan = isObject(opts.plan) ? opts.plan : {};
  const provenance = installPlan.validateProjectProvenance
    ? installPlan.validateProjectProvenance(plan.project, opts.projectRoot, path)
    : {ok: true};
  if (!provenance.ok) {
    return Object.assign({}, session, {
      ok: false,
      diagnostics: session.diagnostics.concat(diagnostic('error', 'runtime_preview.project_mismatch', provenance.message)),
      timings: finishTiming(timing)
    });
  }
  const sandboxPlan = rewritePlanProjectRoot(plan, session.paths.modifiedRoot);
  const applyStarted = Date.now();
  const installResult = installPlan.applyInstallPlan(sandboxPlan, {
    projectRoot: session.paths.modifiedRoot,
    dryRun: opts.dryRun === true,
    allowAdvanced: opts.allowAdvanced === true
  });
  markTiming(timing, 'apply_install_plan', applyStarted);
  const buildRunner = typeof opts.buildRunner === 'function' ? opts.buildRunner : runBuild;
  const buildMeta = {allowProjectBuildWrapper: opts.allowProjectBuildWrapper === true};
  const baselineBuildStarted = Date.now();
  const baselineBuild = buildRunner(session.paths.baselineRoot, Object.assign({lane: 'baseline'}, buildMeta));
  markTiming(timing, 'build_baseline', baselineBuildStarted);
  const modifiedBuildStarted = Date.now();
  const modifiedBuild = buildRunner(session.paths.modifiedRoot, Object.assign({lane: 'modified'}, buildMeta));
  markTiming(timing, 'build_modified', modifiedBuildStarted);
  const serverFactory = typeof opts.serverFactory === 'function' ? opts.serverFactory : ensurePreviewServer;
  const serverRoot = path.dirname(session.paths.root);
  const serverStarted = Date.now();
  const serverResult = serverFactory(serverRoot);
  if (serverResult && typeof serverResult.then === 'function') {
    return serverResult.then((server) => {
      markTiming(timing, 'start_preview_server', serverStarted);
      return finalizeRuntimePreview({
        session,
        installResult,
        baselineBuild,
        modifiedBuild,
        server,
        opts,
        timing
      });
    });
  }
  markTiming(timing, 'start_preview_server', serverStarted);
  return finalizeRuntimePreview({
    session,
    installResult,
    baselineBuild,
    modifiedBuild,
    server: serverResult,
    opts,
    timing
  });
}

function createQuickSession(options) {
  const opts = isObject(options) ? options : {};
  const timing = opts.timing || null;
  const project = validateProjectRoot(opts.projectRoot);
  if (!project.ok) {
    return {ok: false, diagnostics: [diagnostic('error', 'runtime_preview.project_root', project.message)]};
  }
  const htmlRoot = path.join(project.root, 'out', 'html');
  if (!fs.existsSync(path.join(htmlRoot, 'index.html'))) {
    return {
      ok: false,
      diagnostics: [diagnostic('error', 'runtime_preview.quick_html_missing', 'Quick Runtime Lens needs an existing out/html/index.html. Use Full Build once to create it.')]
    };
  }
  const readiness = runtimeDependencyReadiness(htmlRoot);
  if (!readiness.ok) {
    return {
      ok: false,
      diagnostics: readiness.diagnostics,
      runtimeReadiness: readiness
    };
  }
  const plan = isObject(opts.plan) ? opts.plan : {};
  const now = typeof opts.now === 'function' ? opts.now() : new Date();
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const sessionId = stamp + '-' + safeId(plan.id || plan.title || 'quick-runtime-lens', 'quick-runtime-lens');
  const root = path.join(defaultSessionsRoot(opts), sessionId);
  const modifiedRoot = path.join(root, 'modified');
  const modifiedHtmlRoot = path.join(modifiedRoot, 'out', 'html');
  fs.mkdirSync(root, {recursive: true});
  const copyStarted = Date.now();
  copyGeneratedHtml(htmlRoot, modifiedHtmlRoot);
  markTiming(timing, 'copy_existing_html', copyStarted);
  const metadata = {
    schemaVersion: '0.1',
    kind: 'dendry_mod_studio_runtime_preview',
    mode: 'quick',
    sessionId,
    createdAt: now.toISOString(),
    projectRoot: project.root,
    planId: String(plan.id || ''),
    title: String(plan.title || plan.id || 'Quick Runtime Lens')
  };
  const metadataPath = path.join(root, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n', 'utf8');
  markTiming(timing, 'write_metadata');
  return {
    ok: true,
    mode: 'quick',
    sessionId,
    metadata,
    paths: {root, modifiedRoot, metadataPath},
    diagnostics: []
  };
}

function createQuickRuntimePreview(options) {
  const opts = isObject(options) ? options : {};
  const timing = createTiming();
  const session = createQuickSession(Object.assign({}, opts, {timing}));
  if (!session.ok) {
    return Object.assign({}, session, {
      mode: 'quick',
      status: 'failed',
      timings: finishTiming(timing)
    });
  }
  const serverFactory = typeof opts.serverFactory === 'function' ? opts.serverFactory : ensurePreviewServer;
  const serverRoot = path.dirname(session.paths.root);
  const serverStarted = Date.now();
  const serverResult = serverFactory(serverRoot);
  if (serverResult && typeof serverResult.then === 'function') {
    return serverResult.then((server) => {
      markTiming(timing, 'start_preview_server', serverStarted);
      return finalizeQuickRuntimePreview({session, server, opts, timing});
    });
  }
  markTiming(timing, 'start_preview_server', serverStarted);
  return finalizeQuickRuntimePreview({session, server: serverResult, opts, timing});
}

function finalizeRuntimePreview(context) {
  const session = context.session;
  const installResult = context.installResult;
  const baselineBuild = context.baselineBuild;
  const modifiedBuild = context.modifiedBuild;
  const opts = context.opts || {};
  const server = isObject(context.server)
    ? context.server
    : {ok: false, diagnostics: [diagnostic('error', 'runtime_preview.server', 'Runtime preview server did not return a usable listener.')]};
  const port = Number(server.port || 0);
  const hasPort = Number.isFinite(port) && port > 0;
  const baseUrl = hasPort
    ? 'http://127.0.0.1:' + port + '/' + encodeURIComponent(session.sessionId)
    : '';
  const serverOrigin = hasPort ? 'http://127.0.0.1:' + port : '';
  const debug = createDebugSession(session, {
    projectIndex: opts.projectIndex,
    modifiedBuild,
    serverOrigin: opts.serverOrigin || serverOrigin
  });
  const comparePage = writeComparePage(session, {
    installResult,
    baselineBuild,
    modifiedBuild,
    debug
  });
  const diagnostics = session.diagnostics
    .concat(installResult.diagnostics || [])
    .concat(baselineBuild.diagnostics || [])
    .concat(modifiedBuild.diagnostics || [])
    .concat(debug.diagnostics || [])
    .concat(server.diagnostics || []);
  const previewOk = Boolean(baselineBuild.ok && modifiedBuild.ok && server.ok && hasPort);
  return Object.assign({}, session, {
    ok: previewOk,
    mode: 'full',
    previewMode: 'full',
    installResult,
    baselineBuild,
    modifiedBuild,
    debug,
    comparePage,
    server,
    compareUrl: baseUrl ? baseUrl + '/compare/' : '',
    baselineUrl: baseUrl ? baseUrl + '/baseline/out/html/' : '',
    modifiedUrl: baseUrl ? baseUrl + '/modified/out/html/' : '',
    diagnostics,
    timings: finishTiming(context.timing)
  });
}

function finalizeQuickRuntimePreview(context) {
  const session = context.session;
  const opts = context.opts || {};
  const server = isObject(context.server)
    ? context.server
    : {ok: false, diagnostics: [diagnostic('error', 'runtime_preview.server', 'Runtime preview server did not return a usable listener.')]};
  const port = Number(server.port || 0);
  const hasPort = Number.isFinite(port) && port > 0;
  const baseUrl = hasPort
    ? 'http://127.0.0.1:' + port + '/' + encodeURIComponent(session.sessionId)
    : '';
  const serverOrigin = hasPort ? 'http://127.0.0.1:' + port : '';
  const modifiedBuild = {
    ok: true,
    root: session.paths.modifiedRoot,
    lane: 'quick',
    command: 'reuse existing out/html',
    htmlRoot: path.join(session.paths.modifiedRoot, 'out', 'html'),
    skippedBuild: true,
    diagnostics: []
  };
  const debug = createDebugSession(session, {
    projectIndex: opts.projectIndex,
    modifiedBuild,
    serverOrigin: opts.serverOrigin || serverOrigin
  });
  const installResult = {
    ok: true,
    dryRun: true,
    operationSummary: {safeApply: 0, guardedApply: 0, advancedApply: 0, manualReview: 0, refused: 0, total: 0},
    results: [],
    diagnostics: [diagnostic('info', 'runtime_preview.quick_mode', 'Quick Lens reused the latest generated out/html without rebuilding the project.')]
  };
  const diagnostics = session.diagnostics
    .concat(installResult.diagnostics || [])
    .concat(modifiedBuild.diagnostics || [])
    .concat(debug.diagnostics || [])
    .concat(server.diagnostics || []);
  const previewOk = Boolean(modifiedBuild.ok && server.ok && hasPort);
  return Object.assign({}, session, {
    ok: previewOk,
    mode: 'quick',
    previewMode: 'quick',
    status: previewOk ? 'ready' : 'failed',
    installResult,
    baselineBuild: null,
    modifiedBuild,
    debug,
    comparePage: null,
    server,
    compareUrl: '',
    baselineUrl: '',
    modifiedUrl: baseUrl ? baseUrl + '/modified/out/html/' : '',
    diagnostics,
    timings: finishTiming(context.timing)
  });
}

function rewritePlanProjectRoot(plan, sandboxRoot) {
  const copy = JSON.parse(JSON.stringify(plan || {}));
  copy.project = Object.assign({}, copy.project || {}, {root: sandboxRoot});
  return copy;
}

function copyProject(sourceRoot, targetRoot) {
  fs.mkdirSync(targetRoot, {recursive: true});
  fs.cpSync(sourceRoot, targetRoot, {
    recursive: true,
    errorOnExist: false,
    force: true,
    filter: (source) => shouldCopyPath(sourceRoot, source)
  });
}

function copyGeneratedHtml(sourceHtmlRoot, targetHtmlRoot) {
  fs.mkdirSync(path.dirname(targetHtmlRoot), {recursive: true});
  fs.rmSync(targetHtmlRoot, {recursive: true, force: true});
  fs.cpSync(sourceHtmlRoot, targetHtmlRoot, {
    recursive: true,
    errorOnExist: false,
    force: true
  });
}

function cleanRuntimeDependencyRef(value) {
  const ref = String(value || '').trim().replace(/^['"]|['"]$/g, '');
  if (!ref) {
    return '';
  }
  return ref.split('#')[0].split('?')[0].trim();
}

function isExternalRuntimeDependencyRef(value) {
  const ref = String(value || '').trim();
  return ref.startsWith('//') ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref) ||
    ref.startsWith('data:') ||
    ref.startsWith('javascript:') ||
    ref.startsWith('mailto:') ||
    ref.startsWith('about:');
}

function lineForOffset(text, offset) {
  return String(text || '').slice(0, Math.max(0, offset)).split('\n').length;
}

function htmlTagAttribute(tag, name) {
  const re = new RegExp('\\b' + name + '\\s*=\\s*(?:"([^"]*)"|\\\'([^\\\']*)\\\'|([^\\s>]+))', 'i');
  const match = String(tag || '').match(re);
  return match ? (match[1] || match[2] || match[3] || '') : '';
}

function runtimeDependencyPath(htmlRoot, fromRel, ref) {
  const cleaned = cleanRuntimeDependencyRef(ref);
  if (!cleaned || isExternalRuntimeDependencyRef(cleaned)) {
    return {raw: ref, external: Boolean(cleaned), rel: '', fullPath: '', exists: true};
  }
  const rel = cleaned.startsWith('/')
    ? path.posix.normalize(cleaned.replace(/^\/+/, ''))
    : path.posix.normalize(path.posix.join(path.posix.dirname(fromRel || 'index.html'), cleaned));
  const fullPath = path.join(htmlRoot, ...rel.split('/').filter(Boolean));
  return {
    raw: ref,
    external: false,
    rel,
    fullPath,
    exists: fs.existsSync(fullPath)
  };
}

function runtimeDependencyReadiness(htmlRoot) {
  const indexPath = path.join(htmlRoot, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return {
      ok: false,
      scripts: [],
      stylesheets: [],
      diagnostics: [diagnostic('error', 'runtime_preview.quick_html_missing', 'Quick Runtime Lens needs an existing out/html/index.html. Use Full Build once to create it.')]
    };
  }
  const html = fs.readFileSync(indexPath, 'utf8');
  const scripts = [];
  const stylesheets = [];
  const diagnostics = [];
  const scriptRe = /<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi;
  let match;
  while ((match = scriptRe.exec(html))) {
    const ref = match[2] || '';
    const dep = runtimeDependencyPath(htmlRoot, 'index.html', ref);
    const line = lineForOffset(html, match.index);
    const item = Object.assign({src: ref, source: {path: 'out/html/index.html', line}}, dep);
    scripts.push(item);
    if (!dep.external && !dep.exists) {
      const missingPath = 'out/html/' + dep.rel;
      diagnostics.push(diagnostic(
        'error',
        'runtime_surface.missing_script',
        'Quick Runtime Lens cannot reuse generated HTML because a referenced script is missing: ' + missingPath + '. Use Full Build once to regenerate a complete runtime.',
        {path: 'out/html/index.html', source: {path: 'out/html/index.html', line}, missingPath}
      ));
    }
  }
  const linkRe = /<link\b[^>]*>/gi;
  while ((match = linkRe.exec(html))) {
    const tag = match[0] || '';
    const relAttr = htmlTagAttribute(tag, 'rel').toLowerCase();
    const href = htmlTagAttribute(tag, 'href');
    if (!href || !relAttr.includes('stylesheet')) {
      continue;
    }
    const dep = runtimeDependencyPath(htmlRoot, 'index.html', href);
    const line = lineForOffset(html, match.index);
    const item = Object.assign({href, source: {path: 'out/html/index.html', line}}, dep);
    stylesheets.push(item);
    if (!dep.external && !dep.exists) {
      const missingPath = 'out/html/' + dep.rel;
      diagnostics.push(diagnostic(
        'error',
        'runtime_surface.missing_stylesheet',
        'Quick Runtime Lens cannot reuse generated HTML because a referenced stylesheet is missing: ' + missingPath + '. Use Full Build once to regenerate a complete runtime.',
        {path: 'out/html/index.html', source: {path: 'out/html/index.html', line}, missingPath}
      ));
    }
  }
  const missingPaths = diagnostics
    .map((diag) => diag.missingPath)
    .filter(Boolean);
  if (missingPaths.length) {
    diagnostics.push(diagnostic(
      'warning',
      'runtime_surface.partial_runtime',
      'Quick Runtime Lens needs a complete out/html checkout before it can safely load the generated runtime.',
      {missingPaths}
    ));
  }
  return {
    ok: diagnostics.every((diag) => diag.severity !== 'error'),
    scripts,
    stylesheets,
    diagnostics
  };
}

function shouldCopyPath(sourceRoot, source) {
  const relative = path.relative(sourceRoot, source).split(path.sep).join('/');
  if (!relative) {
    return true;
  }
  const parts = relative.split('/');
  return parts[0] !== '.git' &&
    parts[0] !== 'node_modules' &&
    parts[0] !== '.cache' &&
    parts[0] !== 'dist' &&
    parts[0] !== '.superpowers';
}

function createTiming() {
  const now = Date.now();
  return {startedAt: now, lastAt: now, stages: []};
}

function markTiming(timing, stage, startedAt) {
  if (!timing || !stage) {
    return;
  }
  const now = Date.now();
  const from = typeof startedAt === 'number' ? startedAt : timing.lastAt || timing.startedAt || now;
  timing.stages.push({stage, ms: Math.max(0, now - from)});
  timing.lastAt = now;
}

function finishTiming(timing) {
  if (!timing) {
    return {totalMs: 0, stages: []};
  }
  const now = Date.now();
  return {
    totalMs: Math.max(0, now - (timing.startedAt || now)),
    stages: Array.isArray(timing.stages) ? timing.stages.slice() : []
  };
}

function runBuild(root, meta) {
  const command = resolveBuildCommand(root, meta || {});
  if (!command.ok) {
    return {
      ok: false,
      root,
      lane: meta && meta.lane || '',
      command: '',
      htmlRoot: path.join(root, 'out', 'html'),
      stdout: '',
      stderr: '',
      diagnostics: [diagnostic('error', 'runtime_preview.build_missing', command.message)]
    };
  }
  prepareGeneratedHtmlForBuild(root);
  const result = spawnSync(command.cmd, command.args, {
    cwd: root,
    env: Object.assign({}, process.env, command.env || {}),
    encoding: 'utf8',
    timeout: BUILD_TIMEOUT_MS,
    maxBuffer: 1024 * 1024 * 4,
    windowsHide: true
  });
  const htmlRoot = path.join(root, 'out', 'html');
  const ok = result.status === 0 && fs.existsSync(path.join(htmlRoot, 'index.html'));
  const stdout = clipLog(result.stdout);
  const stderr = clipLog(result.stderr || (result.error && result.error.message) || '');
  return {
    ok,
    root,
    lane: meta && meta.lane || '',
    command: [command.cmd].concat(command.args).join(' '),
    htmlRoot,
    stdout,
    stderr,
    diagnostics: ok ? [] : buildFailureDiagnostics(result, stdout, stderr)
  };
}

function prepareGeneratedHtmlForBuild(root) {
  const htmlRoot = path.join(root, 'out', 'html');
  ['index.html', 'game.js'].forEach((fileName) => {
    try {
      fs.rmSync(path.join(htmlRoot, fileName), {force: true});
    } catch (_err) {
      // Runtime Preview operates on a sandbox copy, so stale generated HTML is disposable.
    }
  });
}

function resolveBuildCommand(root, options) {
  const wrapper = resolveBuildWrapperCommand(root, options);
  if (wrapper) {
    return wrapper;
  }
  const bundled = resolveBundledDendryCli();
  const localCli = path.join(root, 'dendrynexus-main', 'lib', 'cli', 'main.js');
  if (fs.existsSync(path.join(root, 'source', 'info.dry')) && bundled.ok) {
    return dendryCliCommand(bundled.cliPath, bundled.nodeModules);
  }
  if (fs.existsSync(localCli)) {
    return dendryCliCommand(localCli, bundled.nodeModules);
  }
  return {ok: false, message: 'No supported Dendry build command was found in the sandbox copy or bundled Studio runtime.'};
}

function resolveBuildWrapperCommand(root, options) {
  const wrapperPath = path.join(root, 'tools', 'build_and_validate.sh');
  if (!fs.existsSync(wrapperPath)) {
    return null;
  }
  if (!options || options.allowProjectBuildWrapper !== true) {
    return null;
  }
  const platform = options && options.platform || process.platform;
  const commandExists = options && typeof options.commandExists === 'function'
    ? options.commandExists
    : isCommandAvailable;
  if (platform === 'win32' && !commandExists('bash')) {
    return null;
  }
  return {ok: true, cmd: 'bash', args: ['tools/build_and_validate.sh']};
}

function isCommandAvailable(command) {
  const result = spawnSync(command, ['--version'], {
    encoding: 'utf8',
    timeout: COMMAND_CHECK_TIMEOUT_MS,
    windowsHide: true
  });
  return !result.error && result.status === 0;
}

function resolveBundledDendryCli() {
  const candidates = [
    path.join(__dirname, 'node_modules'),
    path.join(__dirname, '..', '..', '..', 'node_modules')
  ];
  for (const nodeModules of candidates) {
    const cliPath = path.join(nodeModules, 'dendrynexus', 'lib', 'cli', 'main.js');
    if (fs.existsSync(cliPath)) {
      return {ok: true, nodeModules, cliPath};
    }
  }
  return {ok: false, nodeModules: '', cliPath: ''};
}

function dendryCliCommand(cliPath, nodeModules) {
  const env = {ELECTRON_RUN_AS_NODE: '1'};
  if (nodeModules) {
    env.NODE_PATH = process.env.NODE_PATH
      ? nodeModules + path.delimiter + process.env.NODE_PATH
      : nodeModules;
  }
  const runnerPath = path.join(__dirname, 'dendry_cli_runner.js');
  if (process.platform === 'win32' && fs.existsSync(runnerPath)) {
    env.DMS_DENDRY_CLI_PATH = cliPath;
    return {
      ok: true,
      cmd: process.execPath,
      args: [runnerPath, 'make-html', '--force'],
      env
    };
  }
  return {
    ok: true,
    cmd: process.execPath,
    args: [cliPath, 'make-html', '--force'],
    env
  };
}

function clipLog(value) {
  const text = String(value || '');
  return text.length > 6000 ? text.slice(0, 6000) + '\n[truncated]\n' : text;
}

function buildFailureDiagnostics(result, stdout, stderr) {
  const diagnostics = [
    diagnostic('error', 'runtime_preview.build_failed', 'Runtime preview build failed or out/html/index.html was not produced.')
  ];
  const detail = firstBuildFailureLine(stderr || stdout || (result && result.error && result.error.message));
  if (detail) {
    diagnostics.push(diagnostic('error', 'runtime_preview.build_output', detail));
  }
  return diagnostics;
}

function firstBuildFailureLine(value) {
  const text = String(value || '').replace(/\u001b\[[0-9;]*m/g, '');
  return text.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !/^\(node:\d+\)\s+Warning:/.test(line)) || '';
}

function writeComparePage(session, report) {
  const compareRoot = path.join(session.paths.root, 'compare');
  fs.mkdirSync(compareRoot, {recursive: true});
  const metadata = Object.assign({}, session.metadata, {
    installResult: report && report.installResult,
    baselineBuild: report && report.baselineBuild,
    modifiedBuild: report && report.modifiedBuild,
    debug: report && report.debug
  });
  fs.writeFileSync(path.join(session.paths.root, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf8');
  const filePath = path.join(compareRoot, 'index.html');
  fs.writeFileSync(filePath, comparePageHtml(session, report || {}), 'utf8');
  return {path: filePath};
}

function comparePageHtml(session, report) {
  const title = escapeHtml(session.metadata.title || 'Runtime Preview');
  const hasDebug = Boolean(report && report.debug && report.debug.enabled);
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Runtime Preview - ' + title + '</title>',
    '<style>',
    ':root{--runtime-debug-width:380px}',
    'body{margin:0;font:14px system-ui,sans-serif;background:#f4f2ec;color:#28231c}',
    'header{display:flex;gap:12px;align-items:center;padding:10px 12px;border-bottom:1px solid #d8cbb7;background:#fffaf1}',
    'button{padding:7px 10px;border:1px solid #b9a98d;background:white;border-radius:6px}',
    'main{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;height:calc(100vh - 57px);box-sizing:border-box}',
    'iframe{width:100%;height:100%;border:1px solid #cdbfa8;background:white}',
    'body[data-preview-mode="baseline"] main{grid-template-columns:1fr}',
    'body[data-preview-mode="baseline"] iframe.modified{display:none}',
    'body[data-preview-mode="modified"] main{grid-template-columns:1fr}',
    'body[data-preview-mode="modified"] iframe.baseline{display:none}',
    '.runtime-debug-console{position:fixed;right:0;top:48px;bottom:0;width:var(--runtime-debug-width);min-width:280px;max-width:55vw;overflow:auto;padding:12px;border-left:1px solid #cdbfa8;background:#fffdf8;box-sizing:border-box}',
    '.runtime-debug-resizer{position:fixed;right:var(--runtime-debug-width);top:48px;bottom:0;width:8px;cursor:col-resize;background:transparent;z-index:3}',
    '.runtime-debug-resizer:after{content:"";position:absolute;left:3px;top:0;bottom:0;border-left:1px solid #cdbfa8}',
    'body.runtime-debug-resizing{cursor:col-resize;user-select:none}',
    '.runtime-debug-console h2{font-size:16px;margin:0 0 6px}',
    '.runtime-debug-console h3{font-size:13px;margin:14px 0 6px}',
    '.runtime-debug-console p{color:#6b6255;line-height:1.4}',
    '.runtime-debug-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(64px,96px);gap:6px;margin:6px 0}',
    '.runtime-debug-row small,.runtime-debug-scene small{display:block;color:#6b6255;font-size:11px}',
    '.runtime-debug-row span,.runtime-debug-row strong,.runtime-debug-row small,.runtime-debug-scene strong,.runtime-debug-scene small{min-width:0;overflow-wrap:anywhere}',
    '.runtime-debug-row input,.runtime-debug-filter{min-width:0;padding:5px;border:1px solid #cdbfa8;border-radius:4px}',
    '.runtime-debug-filter{box-sizing:border-box;width:100%;margin:2px 0 4px}',
    '.runtime-debug-count{font-size:12px;margin:4px 0 8px}',
    '.runtime-debug-scene{display:block;width:100%;margin:5px 0;text-align:left}',
    '.runtime-debug-history{padding-left:20px;color:#4d4438}',
    '@media (max-width: 900px){.runtime-debug-console{position:static;width:auto;max-width:none;margin:0 8px 8px;border:1px solid #cdbfa8}.runtime-debug-resizer{display:none}main{margin-right:0!important;height:55vh}}',
    hasDebug ? 'main{margin-right:calc(var(--runtime-debug-width) + 12px)}' : '',
    '</style>',
    '</head>',
    '<body data-preview-mode="split">',
    '<header>',
    '<strong>Runtime Preview</strong>',
    '<span>' + title + '</span>',
    '<button type="button" data-mode="baseline">Baseline</button>',
    '<button type="button" data-mode="modified">Modified</button>',
    '<button type="button" data-mode="split">Split</button>',
    '<span>Temporary sandbox: ' + escapeHtml(session.sessionId) + '</span>',
    '</header>',
    '<main data-preview-mode="split">',
    '<iframe class="baseline" title="Baseline" src="../baseline/out/html/index.html"></iframe>',
    '<iframe class="modified" title="Modified" src="../modified/out/html/index.html"></iframe>',
    '</main>',
    hasDebug ? '<div class="runtime-debug-resizer" data-runtime-debug-resizer aria-hidden="true"></div>' : '',
    hasDebug ? debugBridge.debugPanelHtml({controls: report.debug.controls}) : '',
    '<script>document.addEventListener("click",function(e){var b=e.target.closest("[data-mode]");if(b)document.body.dataset.previewMode=b.dataset.mode;});</script>',
    hasDebug ? '<script>' + debugResizeScript() + '</script>' : '',
    hasDebug ? '<script>' + debugBridge.parentDebugScript({sessionId: session.sessionId}) + '</script>' : '',
    '</body>',
    '</html>'
  ].join('\n') + '\n';
}

function debugResizeScript() {
  return [
    '(function(){',
    '"use strict";',
    'var KEY="dms-runtime-preview-debug-width";',
    'var root=document.documentElement;',
    'var handle=document.querySelector("[data-runtime-debug-resizer]");',
    'function clamp(value){var max=Math.max(320,Math.floor(window.innerWidth*0.65));return Math.max(280,Math.min(max,Math.floor(value)));}',
    'function apply(value){var width=clamp(value);root.style.setProperty("--runtime-debug-width",width+"px");try{localStorage.setItem(KEY,String(width));}catch(_err){}}',
    'try{var saved=Number(localStorage.getItem(KEY));if(saved)apply(saved);}catch(_err){}',
    'if(!handle)return;',
    'handle.addEventListener("pointerdown",function(event){event.preventDefault();document.body.classList.add("runtime-debug-resizing");handle.setPointerCapture&&handle.setPointerCapture(event.pointerId);function move(moveEvent){apply(window.innerWidth-moveEvent.clientX);}function up(){document.body.classList.remove("runtime-debug-resizing");window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);}window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);});',
    '})();'
  ].join('\n');
}

function createDebugSession(session, options) {
  const opts = options || {};
  const controls = debugModel.buildDebugControls(opts.projectIndex || {}, {});
  const enabled = Boolean(opts.projectIndex && opts.modifiedBuild && opts.modifiedBuild.ok);
  if (!enabled) {
    return {
      enabled: false,
      controls,
      diagnostics: [diagnostic('info', 'runtime_preview_debug.disabled', 'Debug Console needs a built modified preview and ProjectIndex metadata.')]
    };
  }
  const bridgePath = path.join(session.paths.modifiedRoot, 'out', 'html', 'dms-preview-bridge.js');
  fs.mkdirSync(path.dirname(bridgePath), {recursive: true});
  fs.writeFileSync(bridgePath, debugBridge.bridgeScript({
    sessionId: session.sessionId,
    allowedOrigin: opts.serverOrigin,
    controls,
    runtimeSurface: opts.projectIndex && opts.projectIndex.semantic && opts.projectIndex.semantic.runtimeSurface || {}
  }), 'utf8');
  injectModifiedBridge(path.join(session.paths.modifiedRoot, 'out', 'html', 'index.html'), 'dms-preview-bridge.js');
  return {
    enabled: true,
    controls,
    bridgePath,
    diagnostics: []
  };
}

function injectModifiedBridge(indexPath, scriptName) {
  if (!fs.existsSync(indexPath)) {
    return false;
  }
  const marker = '<script src="' + scriptName + '"></script>';
  let html = fs.readFileSync(indexPath, 'utf8');
  if (html.includes(marker)) {
    return true;
  }
  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, marker + '\n</body>');
  } else {
    html += '\n' + marker + '\n';
  }
  fs.writeFileSync(indexPath, html, 'utf8');
  return true;
}

function ensurePreviewServer(sessionsRoot) {
  const root = path.resolve(sessionsRoot);
  const existing = previewServers.get(root);
  if (existing && existing.listening) {
    const address = existing.address();
    if (address && typeof address === 'object' && address.port) {
      return {ok: true, host: '127.0.0.1', port: address.port, diagnostics: []};
    }
  }
  const previewServer = http.createServer((req, res) => servePreviewRequest(root, req, res));
  previewServers.set(root, previewServer);
  return new Promise((resolve) => {
    let settled = false;
    function finish(result) {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    }
    previewServer.once('error', (err) => {
      previewServers.delete(root);
      finish({
        ok: false,
        host: '127.0.0.1',
        port: 0,
        diagnostics: [diagnostic('error', 'runtime_preview.server_listen', err && err.message || 'Could not start the runtime preview server.')]
      });
    });
    previewServer.listen(0, '127.0.0.1', () => {
      const address = previewServer && previewServer.address();
      if (!address || typeof address !== 'object' || !address.port) {
        finish({
          ok: false,
          host: '127.0.0.1',
          port: 0,
          diagnostics: [diagnostic('error', 'runtime_preview.server_port', 'Runtime preview server started without a readable port.')]
        });
        return;
      }
      finish({ok: true, host: '127.0.0.1', port: address.port, diagnostics: []});
    });
  });
}

function closePreviewServer(callback) {
  const servers = Array.from(previewServers.values());
  previewServers.clear();
  if (!servers.length) {
    if (typeof callback === 'function') {
      callback();
    }
    return;
  }
  let remaining = servers.length;
  function done() {
    remaining -= 1;
    if (remaining === 0 && typeof callback === 'function') {
      callback();
    }
  }
  servers.forEach((server) => {
    if (!server || !server.listening) {
      done();
      return;
    }
    server.close(done);
  });
}

function servePreviewRequest(root, req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const safePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (req.method === 'POST' && /\/api\/runtime-snapshot$/.test(url.pathname)) {
    readJsonBody(req, (err, body) => {
      if (err) {
        res.writeHead(400, {'content-type': 'application/json'});
        res.end(JSON.stringify({ok: false, message: 'Invalid runtime snapshot payload.'}));
        return;
      }
      const parts = safePath.split('/');
      const sessionId = parts[0] || '';
      const sessionRoot = path.join(root, sessionId);
      const recorded = recordRuntimeSnapshot(sessionRoot, body && (body.runtimeSnapshot || body.snapshot) || {}, {
        runtimeSurface: body && body.runtimeSurface || {},
        runtimeDomMap: body && body.runtimeDomMap || {},
        sourceEvidence: body && body.sourceEvidence || {},
        diagnostics: body && body.diagnostics || []
      });
      res.writeHead(recorded.ok ? 200 : 400, {'content-type': 'application/json'});
      res.end(JSON.stringify(recorded));
    });
    return;
  }
  if (req.method === 'POST' && /\/api\/debug-command-history$/.test(url.pathname)) {
    readJsonBody(req, (err, body) => {
      if (err) {
        res.writeHead(400, {'content-type': 'application/json'});
        res.end(JSON.stringify({ok: false, message: 'Invalid debug history payload.'}));
        return;
      }
      const parts = safePath.split('/');
      const sessionId = parts[0] || '';
      const sessionRoot = path.join(root, sessionId);
      const recorded = recordDebugCommandHistory(sessionRoot, body && body.command || {}, {ok: true});
      res.writeHead(recorded.ok ? 200 : 400, {'content-type': 'application/json'});
      res.end(JSON.stringify(recorded));
    });
    return;
  }
  const target = path.resolve(root, safePath);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403, {'content-type': 'text/plain'});
    res.end('Forbidden');
    return;
  }
  const file = fs.existsSync(target) && fs.statSync(target).isDirectory()
    ? path.join(target, 'index.html')
    : target;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, {'content-type': 'text/plain'});
    res.end('Not found');
    return;
  }
  res.writeHead(200, {'content-type': contentType(file)});
  fs.createReadStream(file).pipe(res);
}

function readJsonBody(req, callback) {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    data += chunk;
    if (data.length > 1500000) {
      req.destroy();
    }
  });
  req.on('end', () => {
    try {
      callback(null, JSON.parse(data || '{}'));
    } catch (err) {
      callback(err);
    }
  });
  req.on('error', (err) => callback(err));
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.ogg') return 'audio/ogg';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.flac') return 'audio/flac';
  if (ext === '.m4a') return 'audio/mp4';
  return 'application/octet-stream';
}

function fakeBuildRunner(result) {
  return (root, meta) => Object.assign({
    ok: true,
    root,
    lane: meta && meta.lane || '',
    command: 'fake build',
    htmlRoot: path.join(root, 'out', 'html'),
    diagnostics: []
  }, result || {});
}

function fakeServerFactory(port) {
  return () => ({
    ok: true,
    port: Number(port || 47999),
    host: '127.0.0.1',
    diagnostics: []
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function diagnostic(severity, code, message, extra) {
  return Object.assign({severity, code, message, confidence: 'exact'}, extra || {});
}

function recordDebugCommandHistory(sessionRoot, command, result, now) {
  const root = path.resolve(String(sessionRoot || ''));
  const metadataPath = path.join(root, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    return {
      ok: false,
      diagnostics: [diagnostic('error', 'runtime_preview_debug.metadata_missing', 'Runtime preview metadata was not found.')]
    };
  }
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const entry = debugModel.commandHistoryEntry(command, result || {}, {
    now: typeof now === 'function' ? now : undefined
  });
  metadata.debugCommandHistory = Array.isArray(metadata.debugCommandHistory) ? metadata.debugCommandHistory : [];
  metadata.debugCommandHistory.unshift(entry);
  metadata.debugCommandHistory = metadata.debugCommandHistory.slice(0, 100);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n', 'utf8');
  return {ok: true, entry, diagnostics: []};
}

function recordRuntimeSnapshot(sessionRoot, snapshot, options, now) {
  const root = path.resolve(String(sessionRoot || ''));
  const metadataPath = path.join(root, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    return {
      ok: false,
      diagnostics: [diagnostic('error', 'runtime_snapshot.metadata_missing', 'Runtime preview metadata was not found.')]
    };
  }
  const opts = options || {};
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const snapshotInput = Object.assign({}, snapshot || {}, {
    capturedAt: snapshot && snapshot.capturedAt || (typeof now === 'function' ? now() : new Date()).toISOString()
  });
  let normalized = snapshotModel.buildSnapshot({
    runtimeSurface: opts.runtimeSurface || {},
    snapshot: snapshotInput,
    diagnostics: opts.diagnostics || []
  });
  const runtimeDomMapInput = isObject(opts.runtimeDomMap) && Object.keys(opts.runtimeDomMap).length ? opts.runtimeDomMap : snapshotInput.runtimeDomMap;
  let runtimeDomMap = null;
  if (runtimeDomMapInput || isObject(opts.sourceEvidence) && Object.keys(opts.sourceEvidence).length) {
    runtimeDomMap = domMapModel.buildDomMap({
      runtimeSurface: opts.runtimeSurface || {},
      runtimeSnapshot: normalized,
      runtimeDomMap: runtimeDomMapInput || null,
      sourceEvidence: opts.sourceEvidence || {},
      diagnostics: opts.diagnostics || []
    });
    normalized = snapshotModel.buildSnapshot({
      runtimeSurface: opts.runtimeSurface || {},
      snapshot: Object.assign({}, snapshotInput, {runtimeDomMap}),
      diagnostics: opts.diagnostics || []
    });
    metadata.runtimeDomMap = runtimeDomMap;
    metadata.runtimeDomMapUpdatedAt = runtimeDomMap.capturedAt || normalized.capturedAt || new Date().toISOString();
  }
  metadata.runtimeSnapshot = normalized;
  metadata.runtimeSnapshotUpdatedAt = normalized.capturedAt || new Date().toISOString();
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n', 'utf8');
  return {ok: true, runtimeSnapshot: normalized, runtimeDomMap, diagnostics: []};
}

module.exports = {
  createSession,
  createRuntimePreview,
  createQuickSession,
  createQuickRuntimePreview,
  copyProject,
  copyGeneratedHtml,
  runtimeDependencyReadiness,
  validateProjectRoot,
  recordDebugCommandHistory,
  recordRuntimeSnapshot,
  closePreviewServer,
  resolveBuildCommand,
  resolveBuildWrapperCommand,
  isCommandAvailable,
  buildFailureDiagnostics,
  firstBuildFailureLine,
  prepareGeneratedHtmlForBuild,
  fakeBuildRunner,
  fakeServerFactory
};
