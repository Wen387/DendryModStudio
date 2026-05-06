'use strict';

const fs = require('fs');
const path = require('path');

const runtimePreview = require('./runtime_preview');
const lensModel = requireAuthoringModule('runtime_lens_model.js');

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
  throw new Error('Runtime Lens authoring helper not found: ' + fileName);
}

function createRuntimeLens(options) {
  const opts = options || {};
  const project = runtimePreview.validateProjectRoot(opts.projectRoot);
  if (!project.ok) {
    const model = lensModel.buildModel({
      isDesktop: true,
      focus: opts.focus,
      projectIndex: opts.projectIndex,
      session: {
        ok: false,
        status: 'failed',
        diagnostics: [diagnostic('error', 'runtime_lens.project_root', project.message)]
      }
    });
    return {
      ok: false,
      kind: 'runtime_lens_session',
      status: model.status,
      focus: model.focus,
      lensUrl: '',
      externalUrl: '',
      postLoadCommands: [],
      diagnostics: model.diagnostics,
      lensModel: model
    };
  }

  const focus = lensModel.normalizeFocus(opts.focus, opts.projectIndex);
  const plan = normalizeLensPlan(opts.plan, {
    projectRoot: project.root,
    focus,
    projectIndex: opts.projectIndex
  });
  const preview = runtimePreview.createRuntimePreview({
    projectRoot: project.root,
    sessionsRoot: opts.sessionsRoot,
    plan,
    dryRun: false,
    allowAdvanced: opts.allowAdvanced === true,
    allowProjectBuildWrapper: opts.allowProjectBuildWrapper === true,
    projectIndex: opts.projectIndex || null,
    buildRunner: opts.buildRunner,
    serverFactory: opts.serverFactory,
    now: opts.now
  });

  if (preview && typeof preview.then === 'function') {
    return preview.then((result) => finalizeLens(result, {focus, projectIndex: opts.projectIndex}));
  }
  return finalizeLens(preview, {focus, projectIndex: opts.projectIndex});
}

function finalizeLens(preview, context) {
  const result = preview || {};
  const focus = context && context.focus || {};
  const postLoadCommands = focusCommands(focus, result);
  const model = lensModel.buildModel({
    isDesktop: true,
    focus,
    projectIndex: context && context.projectIndex,
    session: Object.assign({}, result, {
      status: result.ok ? 'ready' : 'failed',
      lensUrl: result.modifiedUrl,
      externalUrl: result.modifiedUrl || result.compareUrl
    })
  });
  return Object.assign({}, result, {
    kind: 'runtime_lens_session',
    status: model.status,
    focus,
    lensUrl: result.modifiedUrl || '',
    externalUrl: result.modifiedUrl || result.compareUrl || '',
    postLoadCommands,
    lensModel: model
  });
}

function normalizeLensPlan(plan, context) {
  if (plan && typeof plan === 'object') {
    const copy = JSON.parse(JSON.stringify(plan));
    copy.project = Object.assign({}, copy.project || {}, {root: context.projectRoot});
    if (!copy.id) {
      copy.id = lensPlanId(context.focus);
    }
    if (!copy.title) {
      copy.title = lensTitle(context.focus);
    }
    if (!Array.isArray(copy.operations)) {
      copy.operations = [];
    }
    return copy;
  }
  return {
    schemaVersion: '0.1',
    kind: 'dendry_mod_studio_install_plan',
    id: lensPlanId(context.focus),
    draftKind: 'runtime_lens',
    title: lensTitle(context.focus),
    status: 'proposal_only',
    project: {
      root: context.projectRoot,
      name: context.projectIndex && context.projectIndex.project && context.projectIndex.project.name || ''
    },
    operations: []
  };
}

function focusCommands(focus, preview) {
  if (!preview || !preview.ok) {
    return [];
  }
  const commands = [];
  if (focus && focus.targetSceneId) {
    commands.push({type: 'jumpToScene', sceneId: focus.targetSceneId});
  }
  if (focus && focus.kind === 'card' && focus.targetCardId) {
    commands.push({
      type: 'focusCard',
      cardId: focus.targetCardId,
      sceneId: focus.targetSceneId || ''
    });
  }
  if (focus && focus.kind === 'system_region' && focus.regionId) {
    commands.push({
      type: 'focusSystemRegion',
      regionId: focus.regionId,
      sceneId: focus.targetSceneId || ''
    });
  }
  return commands;
}

function lensPlanId(focus) {
  return 'runtime_lens_' + safeId(focus && (focus.kind + '_' + focus.id) || 'focus');
}

function lensTitle(focus) {
  const label = focus && (focus.title || focus.id) || 'Selected object';
  return 'Runtime Lens - ' + label;
}

function safeId(value) {
  return String(value || 'focus')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'focus';
}

function diagnostic(severity, code, message) {
  return {severity, code, message, confidence: 'exact'};
}

module.exports = {
  createRuntimeLens,
  normalizeLensPlan,
  focusCommands
};
