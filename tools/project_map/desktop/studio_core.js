'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

function requireInstallPlan() {
  const candidates = [
    path.join(__dirname, '..', 'authoring', 'install_plan.js'),
    path.join(__dirname, 'project_map', 'authoring', 'install_plan.js')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }
  throw new Error('Install plan helper not found in desktop resources.');
}

const installPlan = requireInstallPlan();
const runtimePreview = require('./runtime_preview');
const STARTER_DEMO_ID = 'starter-demo';

function resolveResourcePaths(options) {
  const desktopDir = path.resolve((options && options.desktopDir) || __dirname);
  const packagedProjectMapDir = path.join(desktopDir, 'project_map');
  const projectMapDir = fs.existsSync(path.join(packagedProjectMapDir, 'viewer', 'index.html'))
    ? packagedProjectMapDir
    : path.resolve(desktopDir, '..');
  return {
    desktopDir,
    projectMapDir,
    viewerDir: path.join(projectMapDir, 'viewer'),
    viewerIndex: path.join(projectMapDir, 'viewer', 'index.html'),
    parser: path.join(projectMapDir, 'parse_dry_project.js'),
    indexer: path.join(projectMapDir, 'build_project_map.py'),
    templatesDir: path.join(projectMapDir, 'templates'),
    starterDemoTemplate: path.join(projectMapDir, 'templates', STARTER_DEMO_ID),
    starterDemoIndex: path.join(projectMapDir, 'templates', STARTER_DEMO_ID, 'project-index.json'),
    starterDemoIndexWithExcerpts: path.join(projectMapDir, 'templates', STARTER_DEMO_ID, 'project-index-excerpts.json')
  };
}

function checkFile(filePath, label, code) {
  if (fs.existsSync(filePath)) {
    return {ok: true, code, label, path: filePath, message: label + ' found.'};
  }
  return {
    ok: false,
    code,
    label,
    path: filePath,
    message: label + ' is missing from the Dendry Mod Studio app files.'
  };
}

function checkResourcePaths(options) {
  const paths = resolveResourcePaths(options);
  const checks = {
    viewer: checkFile(paths.viewerIndex, 'Viewer app', 'viewer_missing'),
    indexer: checkFile(paths.indexer, 'Project Map indexer', 'indexer_missing'),
    parser: checkFile(paths.parser, 'Dendry parser wrapper', 'parser_missing'),
    starterDemo: checkFile(path.join(paths.starterDemoTemplate, 'source', 'info.dry'), 'Starter demo template', 'starter_demo_missing')
  };
  const ok = Object.values(checks).every((check) => check.ok);
  return {
    ok,
    paths,
    checks,
    message: ok
      ? 'Dendry Mod Studio app files are present.'
      : 'Dendry Mod Studio is missing required app files.'
  };
}

function copyPath(src, dest) {
  fs.cpSync(src, dest, {
    recursive: true,
    force: true,
    dereference: true,
    filter: (source) => {
      const base = path.basename(source);
      return base !== '.git' && base !== '__pycache__';
    }
  });
}

function prepareStarterDemo(options) {
  const paths = resolveResourcePaths(options);
  const sourceRoot = paths.starterDemoTemplate;
  const workspaceRoot = path.resolve(
    options && options.workspaceRoot
      ? options.workspaceRoot
      : path.join(os.tmpdir(), 'dendry_mod_studio_starter_templates')
  );
  const targetRoot = path.join(workspaceRoot, STARTER_DEMO_ID);
  const infoPath = path.join(sourceRoot, 'source', 'info.dry');
  if (!fs.existsSync(infoPath)) {
    return {
      ok: false,
      id: STARTER_DEMO_ID,
      sourceRoot,
      targetRoot,
      message: 'The bundled starter demo template is missing from this Dendry Mod Studio package.'
    };
  }
  const alreadyPresent = fs.existsSync(path.join(targetRoot, 'source', 'info.dry'));
  if (!alreadyPresent) {
    fs.mkdirSync(workspaceRoot, {recursive: true});
    copyPath(sourceRoot, targetRoot);
  } else {
    repairStarterDemoSupportFiles(sourceRoot, targetRoot);
  }
  const validation = validateProjectRoot(targetRoot);
  return Object.assign({
    ok: validation.ok,
    id: STARTER_DEMO_ID,
    title: 'Dendry Mod Studio Starter Demo',
    sourceRoot,
    targetRoot,
    root: validation.root || targetRoot,
    reused: alreadyPresent,
    message: validation.ok
      ? (alreadyPresent ? 'Starter demo workspace opened.' : 'Starter demo workspace created.')
      : validation.message
  }, validation.ok ? {} : {error: validation});
}

function repairStarterDemoSupportFiles(sourceRoot, targetRoot) {
  [
    'package.json',
    'source/scenes/main.scene.dry',
    'source/scenes/decks/demo_action_deck.scene.dry',
    'source/scenes/cards/demo_action_card.scene.dry',
    'source/scenes/advisors/demo_advisor.scene.dry',
    'source/qdisplays/qdemo_level.qdisplay.dry',
    'source/qualities/demo_support.quality.dry',
    'source/qualities/demo_conflict.quality.dry',
    'source/qualities/demo_resources.quality.dry',
    'source/qualities/demo_advisor_trust.quality.dry',
    'source/qualities/demo_card_progress.quality.dry',
    'source/qualities/demo_event_seen.quality.dry'
  ].forEach((relativePath) => {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);
    if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) {
      return;
    }
    fs.mkdirSync(path.dirname(targetPath), {recursive: true});
    fs.copyFileSync(sourcePath, targetPath);
  });
  repairStarterDemoSourceCompatibility(targetRoot);
}

function repairStarterDemoSourceCompatibility(targetRoot) {
  const rootScenePath = path.join(targetRoot, 'source', 'scenes', 'root.scene.dry');
  if (!fs.existsSync(rootScenePath)) {
    return;
  }
  const before = fs.readFileSync(rootScenePath, 'utf8');
  let after = before
    .replace('- @.demo_opening.demo_status: Check demo state', '- @demo_opening.demo_status: Check demo state')
    .replace('- @.demo_opening.support_followup: Follow up on support', '- @demo_opening.support_followup: Follow up on support')
    .replace('- @demo_status: Check demo state', '- @demo_opening.demo_status: Check demo state')
    .replace('- @support_followup: Follow up on support', '- @demo_opening.support_followup: Follow up on support');
  if (!after.includes('Q.demo_resources === undefined')) {
    after = after.replace(
      'if (Q.demo_event_seen === undefined) { Q.demo_event_seen = 0; }',
      [
        'if (Q.demo_resources === undefined) { Q.demo_resources = 2; }',
        'if (Q.demo_advisor_trust === undefined) { Q.demo_advisor_trust = 0; }',
        'if (Q.demo_card_progress === undefined) { Q.demo_card_progress = 0; }',
        'if (Q.demo_event_seen === undefined) { Q.demo_event_seen = 0; }'
      ].join('\n')
    );
  }
  if (!after.includes('- @main: Open the workspace hand')) {
    after = after.replace(
      '- @demo_opening: Start the demo event',
      '- @main: Open the workspace hand\n- @demo_opening: Start the demo event'
    );
  }
  if (after !== before) {
    fs.writeFileSync(rootScenePath, after, 'utf8');
  }
  const postEventPath = path.join(targetRoot, 'source', 'scenes', 'post_event.scene.dry');
  if (fs.existsSync(postEventPath)) {
    const postBefore = fs.readFileSync(postEventPath, 'utf8');
    let postAfter = postBefore;
    if (!postAfter.includes('Q.demo_resources === undefined')) {
      postAfter = postAfter.replace(
        'if (Q.demo_event_seen === undefined) { Q.demo_event_seen = 0; }',
        [
          'if (Q.demo_resources === undefined) { Q.demo_resources = 2; }',
          'if (Q.demo_advisor_trust === undefined) { Q.demo_advisor_trust = 0; }',
          'if (Q.demo_card_progress === undefined) { Q.demo_card_progress = 0; }',
          'if (Q.demo_event_seen === undefined) { Q.demo_event_seen = 0; }'
        ].join('\n')
      );
    }
    if (postAfter !== postBefore) {
      fs.writeFileSync(postEventPath, postAfter, 'utf8');
    }
  }
}

function validateProjectRoot(root) {
  const rootPath = path.resolve(String(root || ''));
  const infoPath = path.join(rootPath, 'source', 'info.dry');
  if (!root || !fs.existsSync(infoPath)) {
    const candidates = findNestedProjectCandidates(rootPath);
    if (candidates.length === 1) {
      const candidateRoot = path.resolve(candidates[0]);
      return {
        ok: true,
        root: candidateRoot,
        infoPath: path.join(candidateRoot, 'source', 'info.dry'),
        selectedNestedRoot: true,
        requestedRoot: rootPath
      };
    }
    const hint = candidates.length
      ? ' Nearby Dendry project folders: ' + candidates.slice(0, 4).join(', ') + '.'
      : '';
    return {
      ok: false,
      root: rootPath,
      candidates,
      message: 'Choose a Dendry project folder that contains source/info.dry.' + hint
    };
  }
  return {ok: true, root: rootPath, infoPath};
}

function findNestedProjectCandidates(rootPath) {
  const candidates = [];
  try {
    const entries = fs.readdirSync(rootPath, {withFileTypes: true});
    entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((entry) => {
        const child = path.join(rootPath, entry.name);
        if (fs.existsSync(path.join(child, 'source', 'info.dry'))) {
          candidates.push(child);
        }
      });
  } catch (_err) {
    return [];
  }
  return candidates;
}

function checkPython(options) {
  const resolved = resolvePythonExecutable(options);
  const python = resolved.python;
  const result = spawnSync(python, ['--version'], {encoding: 'utf8'});
  const versionText = String(result.stdout || result.stderr || '').trim();
  if (result.error && result.status !== 0 && !versionText) {
    return {
      ok: false,
      code: 'python_missing',
      python,
      source: resolved.source,
      bundled: resolved.bundled,
      message: 'Dendry Mod Studio could not find its bundled Python runtime. Install a release build with the runtime included, or set PYTHON to a Python 3 executable for development.'
    };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      code: 'python_failed',
      python,
      source: resolved.source,
      bundled: resolved.bundled,
      message: 'Dendry Mod Studio could not start its Python runtime.'
    };
  }
  const match = versionText.match(/Python\s+(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match || Number(match[1]) < 3) {
    return {
      ok: false,
      code: 'python_version',
      python,
      source: resolved.source,
      bundled: resolved.bundled,
      version: versionText,
      message: 'Dendry Mod Studio needs a Python 3 runtime.'
    };
  }
  return {
    ok: true,
    code: 'python_ok',
    python,
    source: resolved.source,
    bundled: resolved.bundled,
    version: versionText,
    message: (resolved.source === 'bundled' ? 'Bundled ' : '') + versionText + ' is available.'
  };
}

function checkScratchDir(outDir) {
  const scratch = path.resolve(outDir || path.join(os.tmpdir(), 'dendry_mod_studio_desktop'));
  const probe = path.join(scratch, '.doctor-write-test-' + process.pid);
  try {
    fs.mkdirSync(scratch, {recursive: true});
    fs.writeFileSync(probe, 'ok\n', 'utf8');
    fs.unlinkSync(probe);
    return {
      ok: true,
      code: 'scratch_ok',
      path: scratch,
      message: 'Scratch folder is writable.'
    };
  } catch (_err) {
    return {
      ok: false,
      code: 'scratch_unwritable',
      path: scratch,
      message: 'Dendry Mod Studio could not write to its scratch folder.'
    };
  }
}

function friendlyError(error) {
  const raw = String(error && (error.message || error) || 'Unknown error.');
  if (/Cannot find module ['"]dendrynexus\//.test(raw)) {
    return {
      message: 'DendryNexus parser files were not found. Use the packaged Studio app, or run it from a development checkout with dependencies installed.'
    };
  }
  let message = raw
    .replace(/^Error:\s*/, '')
    .replace(/^ENOENT:[^,]*(?:,\s*)?/, '')
    .replace(/Traceback[\s\S]*/m, 'The underlying tool reported an error.');
  message = message.trim();
  if (!message) {
    message = 'Dendry Mod Studio could not finish that action.';
  }
  return {message};
}

function summarizeIndex(index) {
  const summary = index && index.summary ? index.summary : {};
  return {
    sceneCount: Number(summary.sceneCount || 0),
    edgeCount: Number(summary.edgeCount || 0),
    variableCount: Number(summary.variableCount || 0),
    diagnosticCount: Number(summary.diagnosticCount || 0),
    eventCount: Number(summary.eventCount || 0),
    cardCount: Number(summary.cardCount || 0),
    handCount: Number(summary.handCount || 0),
    deckCount: Number(summary.deckCount || 0),
    pinnedCardCount: Number(summary.pinnedCardCount || 0),
    newsItemCount: Number(summary.newsItemCount || 0)
  };
}

function emitProgress(options, update) {
  const onProgress = options && options.onProgress;
  if (typeof onProgress !== 'function') {
    return;
  }
  const percent = Number(update && update.percent);
  const normalized = Object.assign({}, update, {
    percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, Math.round(percent))) : 0,
    stage: String(update && update.stage || 'working'),
    label: String(update && update.label || 'Working...')
  });
  try {
    onProgress(normalized);
  } catch (_err) {
    // Progress reporting must never break the indexer.
  }
}

function projectName(index, root) {
  return (index && index.project && index.project.name) || path.basename(root);
}

function bundledPythonRoots(options) {
  const paths = resolveResourcePaths(options);
  const roots = [
    path.join(paths.desktopDir, 'runtime', 'python')
  ];
  if (process.resourcesPath) {
    roots.push(path.join(process.resourcesPath, 'app', 'runtime', 'python'));
    roots.push(path.join(process.resourcesPath, 'runtime', 'python'));
  }
  return Array.from(new Set(roots.map((root) => path.resolve(root))));
}

function bundledPythonCandidates(options) {
  const candidates = [];
  bundledPythonRoots(options).forEach((root) => {
    if (process.platform === 'win32') {
      candidates.push(
        path.join(root, 'python.exe'),
        path.join(root, 'python', 'python.exe')
      );
      return;
    }
    candidates.push(
      path.join(root, 'bin', 'python3'),
      path.join(root, 'bin', 'python'),
      path.join(root, 'python', 'bin', 'python3'),
      path.join(root, 'python', 'bin', 'python')
    );
  });
  return Array.from(new Set(candidates));
}

function resolveBundledPython(options) {
  const candidates = bundledPythonCandidates(options);
  const executable = candidates.find((candidate) => fs.existsSync(candidate));
  return executable
    ? {ok: true, source: 'bundled', python: executable, candidates}
    : {ok: false, source: 'bundled', candidates};
}

function resolvePythonExecutable(options) {
  const opts = options || {};
  const bundled = resolveBundledPython(opts);
  if (opts.python) {
    return {
      source: 'explicit',
      python: opts.python,
      bundled
    };
  }
  if (bundled.ok) {
    return {
      source: 'bundled',
      python: bundled.python,
      bundled
    };
  }
  if (process.env.PYTHON) {
    return {
      source: 'environment',
      python: process.env.PYTHON,
      bundled
    };
  }
  return {
    source: 'system',
    python: process.platform === 'win32' ? 'python' : 'python3',
    bundled
  };
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadStarterDemoIndex(options) {
  const opts = options || {};
  const prepared = opts.prepared || null;
  const paths = resolveResourcePaths(opts);
  const preferredIndexPath = opts.includeExcerpts && fs.existsSync(paths.starterDemoIndexWithExcerpts)
    ? paths.starterDemoIndexWithExcerpts
    : paths.starterDemoIndex;
  if (!fs.existsSync(preferredIndexPath)) {
    return {
      ok: false,
      code: 'starter_demo_index_missing',
      indexPath: preferredIndexPath,
      message: 'The bundled starter demo ProjectIndex cache is missing.'
    };
  }
  try {
    const index = readJsonFile(preferredIndexPath);
    const root = prepared && prepared.root
      ? prepared.root
      : paths.starterDemoTemplate;
    index.project = Object.assign({}, index.project || {}, {
      root
    });
    return {
      ok: true,
      root,
      projectName: projectName(index, root),
      includeExcerpts: preferredIndexPath === paths.starterDemoIndexWithExcerpts,
      indexPath: preferredIndexPath,
      index,
      summary: summarizeIndex(index),
      fromCache: true
    };
  } catch (err) {
    return {
      ok: false,
      code: 'starter_demo_index_invalid',
      indexPath: preferredIndexPath,
      error: friendlyError(err),
      message: 'The bundled starter demo ProjectIndex cache could not be read.'
    };
  }
}

function ensureScratchDir(outDir) {
  const check = checkScratchDir(outDir);
  if (!check.ok) {
    throw new Error(check.message);
  }
  return check.path;
}

async function writeParserIndex(root, parserOut, paths) {
  const parser = require(paths.parser);
  const parserIndex = await parser.parseProject(root);
  fs.writeFileSync(parserOut, JSON.stringify(parserIndex, null, 2) + '\n', 'utf8');
  return parserIndex;
}

async function buildProjectIndex(options) {
  const paths = resolveResourcePaths(options);
  emitProgress(options, {
    stage: 'preflight',
    percent: 4,
    label: 'Checking app files and project folder...'
  });
  const resources = checkResourcePaths(options);
  if (!resources.ok) {
    emitProgress(options, {
      stage: 'preflight',
      percent: 100,
      label: resources.message,
      error: true
    });
    return {
      ok: false,
      stage: 'preflight',
      checks: {resources},
      error: {message: resources.message},
      message: resources.message
    };
  }

  const validation = validateProjectRoot(options && options.root);
  if (!validation.ok) {
    emitProgress(options, {
      stage: 'preflight',
      percent: 100,
      label: validation.message,
      error: true
    });
    return {ok: false, error: validation, message: validation.message};
  }

  const root = validation.root;
  const scratchCheck = checkScratchDir(options && options.outDir);
  if (!scratchCheck.ok) {
    emitProgress(options, {
      stage: 'preflight',
      percent: 100,
      label: scratchCheck.message,
      error: true
    });
    return {
      ok: false,
      stage: 'preflight',
      checks: {resources, scratch: scratchCheck},
      error: {message: scratchCheck.message},
      message: scratchCheck.message
    };
  }
  const scratch = scratchCheck.path;
  const includeExcerpts = Boolean(options && options.includeExcerpts);
  const indexName = includeExcerpts ? 'project-index-excerpts.json' : 'project-index.json';
  const parserOut = path.join(scratch, 'parser-index.json');
  const indexPath = path.join(scratch, indexName);
  const pythonCheck = checkPython(options);
  const python = pythonCheck.python;
  if (!pythonCheck.ok) {
    emitProgress(options, {
      stage: 'preflight',
      percent: 100,
      label: pythonCheck.message,
      error: true
    });
    return {
      ok: false,
      stage: 'preflight',
      checks: {resources, scratch: scratchCheck, python: pythonCheck},
      error: {message: pythonCheck.message},
      message: pythonCheck.message
    };
  }

  emitProgress(options, {
    stage: 'parser',
    percent: 24,
    label: 'Parsing Dendry scene structure...'
  });
  try {
    await writeParserIndex(root, parserOut, paths);
  } catch (err) {
    emitProgress(options, {
      stage: 'parser',
      percent: 100,
      label: 'Could not parse this Dendry project.',
      error: true
    });
    return {
      ok: false,
      stage: 'parser',
      error: friendlyError(err),
      message: 'Could not parse this Dendry project.'
    };
  }

  emitProgress(options, {
    stage: 'indexer',
    percent: 58,
    label: includeExcerpts ? 'Building review index with source excerpts...' : 'Building Project Map semantic index...'
  });
  const args = [
    paths.indexer,
    '--root', root,
    '--parser-index', parserOut,
    '--out', indexPath
  ];
  if (includeExcerpts) {
    args.push('--include-excerpts');
  }
  const result = spawnSync(python, args, {cwd: root, encoding: 'utf8'});
  if (result.status !== 0 || (result.error && result.status !== 0)) {
    emitProgress(options, {
      stage: 'indexer',
      percent: 100,
      label: 'Could not build the Project Map index.',
      error: true
    });
    return {
      ok: false,
      stage: 'indexer',
      error: friendlyError(result.error || result.stderr || ('exit ' + result.status)),
      message: result.error && result.error.code === 'ENOENT'
        ? pythonCheck.message
        : 'Could not build the Project Map index.'
    };
  }

  emitProgress(options, {
    stage: 'read-index',
    percent: 88,
    label: 'Loading generated ProjectIndex...'
  });
  let index;
  try {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch (err) {
    emitProgress(options, {
      stage: 'read-index',
      percent: 100,
      label: 'The Project Map index was generated but could not be read.',
      error: true
    });
    return {
      ok: false,
      stage: 'read-index',
      error: friendlyError(err),
      message: 'The Project Map index was generated but could not be read.'
    };
  }

  emitProgress(options, {
    stage: 'complete',
    percent: 100,
    label: 'Project Map index ready.'
  });
  return {
    ok: true,
    root,
    projectName: projectName(index, root),
    includeExcerpts,
    indexPath,
    parserIndexPath: parserOut,
    index,
    summary: summarizeIndex(index)
  };
}

async function runDesktopDoctor(options) {
  const root = options && options.root;
  const resources = checkResourcePaths(options);
  const scratch = checkScratchDir(options && options.outDir);
  const python = checkPython(options);
  const projectRoot = validateProjectRoot(root);
  const checks = {
    resources,
    scratch,
    python,
    projectRoot
  };
  const ok = Object.values(checks).every((check) => check.ok);
  return {
    ok,
    checks,
    message: ok
      ? 'Dendry Mod Studio is ready to scan this project.'
      : 'Dendry Mod Studio needs attention before it can scan this project.'
  };
}

function applyInstallPlan(options) {
  const plan = options && options.plan;
  const projectRoot = options && options.projectRoot;
  const dryRun = !options || options.dryRun !== false;
  const allowAdvanced = options && options.allowAdvanced === true;
  if (!plan || typeof plan !== 'object') {
    return {
      ok: false,
      dryRun,
      operationSummary: {safeApply: 0, guardedApply: 0, advancedApply: 0, manualReview: 0, refused: 0, total: 0},
      results: [],
      diagnostics: [{
        severity: 'error',
        code: 'desktop_install.plan_missing',
        message: 'Choose an install-plan JSON file before running the Install Assistant.',
        confidence: 'exact'
      }]
    };
  }
  const result = installPlan.applyInstallPlan(plan, {projectRoot, dryRun, allowAdvanced});
  return Object.assign({}, result, {
    operationChecklist: installPlan.renderOperationChecklist(plan)
  });
}

function createRuntimePreview(options) {
  const opts = options || {};
  return runtimePreview.createRuntimePreview({
    projectRoot: opts.projectRoot,
    sessionsRoot: opts.sessionsRoot,
    plan: opts.plan,
    allowAdvanced: opts.allowAdvanced === true,
    dryRun: false,
    projectIndex: opts.projectIndex || null
  });
}

function recordRuntimePreviewHistory(options) {
  return runtimePreview.recordDebugCommandHistory(
    options && options.sessionRoot,
    options && options.command,
    options && options.result
  );
}

module.exports = {
  resolveResourcePaths,
  validateProjectRoot,
  friendlyError,
  resolveBundledPython,
  resolvePythonExecutable,
  checkPython,
  checkResourcePaths,
  checkScratchDir,
  runDesktopDoctor,
  buildProjectIndex,
  loadStarterDemoIndex,
  applyInstallPlan,
  createRuntimePreview,
  recordRuntimePreviewHistory,
  prepareStarterDemo,
  emitProgress,
  summarizeIndex
};
