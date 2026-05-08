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
  const projectIndex = projectIndexWithFocus(opts.projectIndex, focus);
  const plan = normalizeLensPlan(opts.plan, {
    projectRoot: project.root,
    focus,
    projectIndex
  });
  const previewMode = normalizePreviewMode(opts.previewMode || opts.mode);
  const previewFactory = previewMode === 'quick'
    ? runtimePreview.createQuickRuntimePreview
    : runtimePreview.createRuntimePreview;
  const preview = previewFactory({
    projectRoot: project.root,
    sessionsRoot: opts.sessionsRoot,
    plan,
    dryRun: false,
    allowAdvanced: opts.allowAdvanced === true,
    allowProjectBuildWrapper: opts.allowProjectBuildWrapper === true,
    projectIndex,
    buildRunner: opts.buildRunner,
    serverFactory: opts.serverFactory,
    now: opts.now
  });

  if (preview && typeof preview.then === 'function') {
    return preview.then((result) => finalizeLens(result, {focus, projectIndex}));
  }
  return finalizeLens(preview, {focus, projectIndex});
}

function normalizePreviewMode(value) {
  return String(value || '').toLowerCase() === 'quick' ? 'quick' : 'full';
}

function finalizeLens(preview, context) {
  const result = preview || {};
  const focus = context && context.focus || {};
  const postLoadCommands = focusCommands(focus, result);
  const lensPage = result.ok ? writeLensPage(result, {focus, postLoadCommands}) : {url: '', path: ''};
  const model = lensModel.buildModel({
    isDesktop: true,
    focus,
    projectIndex: context && context.projectIndex,
    session: Object.assign({}, result, {
      status: result.ok ? 'ready' : 'failed',
      lensUrl: lensPage.url || result.modifiedUrl,
      externalUrl: lensPage.url || result.modifiedUrl || result.compareUrl
    })
  });
  return Object.assign({}, result, {
    kind: 'runtime_lens_session',
    status: model.status,
    focus,
    lensUrl: lensPage.url || result.modifiedUrl || '',
    lensPageUrl: lensPage.url || '',
    lensPagePath: lensPage.path || '',
    externalUrl: lensPage.url || result.modifiedUrl || result.compareUrl || '',
    postLoadCommands,
    lensModel: model
  });
}

function writeLensPage(preview, context) {
  const result = preview || {};
  const root = result.paths && result.paths.root || '';
  const modifiedUrl = String(result.modifiedUrl || '');
  if (!root || !modifiedUrl) {
    return {url: '', path: ''};
  }
  const lensRoot = path.join(root, 'lens');
  const filePath = path.join(lensRoot, 'index.html');
  fs.mkdirSync(lensRoot, {recursive: true});
  fs.writeFileSync(filePath, lensPageHtml({
    title: context && context.focus && (context.focus.title || context.focus.id) || 'Runtime Lens',
    sessionId: result.sessionId || '',
    modifiedSrc: '../modified/out/html/',
    postLoadCommands: context && context.postLoadCommands || []
  }), 'utf8');
  return {
    path: filePath,
    url: modifiedUrl.replace(/\/modified\/out\/html\/?$/, '/lens/')
  };
}

function lensPageHtml(options) {
  const opts = options || {};
  const commands = JSON.stringify(opts.postLoadCommands || []);
  const title = escapeHtml(opts.title || 'Runtime Lens');
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Runtime Lens - ' + title + '</title>',
    '<style>',
    'body{margin:0;background:#f4f2ec;color:#28231c;font:14px system-ui,sans-serif}',
    'header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-bottom:1px solid #d8cbb7;background:#fffaf1}',
    'header div{min-width:0}strong,span{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    'button{padding:6px 9px;border:1px solid #b9a98d;border-radius:6px;background:white;color:#28231c}',
    'main{height:calc(100vh - 48px)}iframe{display:block;width:100%;height:100%;border:0;background:white}',
    '.status{color:#6b6255;font-size:12px}',
    '</style>',
    '</head>',
    '<body>',
    '<header>',
    '<div><strong>Focused Runtime Lens</strong><span>' + title + '</span></div>',
    '<div><button type="button" data-lens-action="focus">Focus</button> <button type="button" data-lens-action="reset">Reset</button></div>',
    '<span class="status" data-lens-status>Loading runtime...</span>',
    '</header>',
    '<main><iframe class="modified" title="Modified runtime" src="' + escapeAttr(opts.modifiedSrc || '../modified/out/html/') + '"></iframe></main>',
    '<script>' + lensPageScript(commands, opts.sessionId || '') + '</script>',
    '</body>',
    '</html>'
  ].join('\n') + '\n';
}

function lensPageScript(commandsJson, sessionId) {
  return [
    '(function(){',
    '"use strict";',
    'var COMMANDS=' + commandsJson + ';',
    'var AUTO_COMMANDS=COMMANDS.filter(function(command){return command&&["jumpToScene","applyVariables","resetToInitialState"].indexOf(command.type)>=0;});',
    'var SESSION_ID=' + JSON.stringify(String(sessionId || '')) + ';',
    'var seq=0;',
    'var frame=document.querySelector("iframe.modified");',
    'var status=document.querySelector("[data-lens-status]");',
    'function setStatus(text){if(status)status.textContent=text;}',
    'function send(command){if(!frame||!frame.contentWindow){setStatus("Runtime frame is not ready.");return;}var requestId="lens-"+(++seq);frame.contentWindow.postMessage({kind:"dms-runtime-preview-command",requestId:requestId,command:command}, window.location.origin);try{fetch("../api/debug-command-history",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:SESSION_ID,command:command})}).catch(function(){});}catch(_err){}}',
    'function focus(){if(!AUTO_COMMANDS.length){setStatus("No automatic focus command is available for this object.");return;}AUTO_COMMANDS.forEach(send);setStatus("Focus command sent.");}',
    'frame&&frame.addEventListener("load",function(){setTimeout(focus,120);});',
    'document.addEventListener("click",function(event){var action=event.target.closest&&event.target.closest("[data-lens-action]");if(!action)return;if(action.getAttribute("data-lens-action")==="focus")focus();if(action.getAttribute("data-lens-action")==="reset"){send({type:"resetToInitialState"});setStatus("Reset command sent.");}});',
    'window.addEventListener("message",function(event){var data=event.data||{};if(data.kind==="dms-runtime-lens-action"){if(data.action==="focus")focus();if(data.action==="reset"){send({type:"resetToInitialState"});setStatus("Reset command sent.");}return;}if(data.kind!=="dms-runtime-preview-result")return;var result=data.result||{};setStatus((result.ok?"Ready":"Needs attention")+": "+(result.message||result.sceneId||"command complete"));});',
    '})();'
  ].join('\n');
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

function projectIndexWithFocus(projectIndex, focus) {
  const index = projectIndex && typeof projectIndex === 'object' ? JSON.parse(JSON.stringify(projectIndex)) : {};
  const sceneId = focus && focus.targetSceneId || '';
  if (!sceneId) {
    return index;
  }
  index.scenes = Array.isArray(index.scenes) ? index.scenes : [];
  if (!index.scenes.some((scene) => scene && String(scene.id || '') === sceneId)) {
    index.scenes.push({
      id: sceneId,
      title: focus.title || sceneId,
      type: focusSceneType(focus),
      path: focus.source && focus.source.path || '',
      sourceSpan: focus.source || {}
    });
  }
  return index;
}

function focusSceneType(focus) {
  const kind = String(focus && focus.kind || '').toLowerCase();
  if (kind === 'card' || kind === 'card_option') return 'card';
  if (kind === 'news') return 'news';
  if (kind === 'hand') return 'hand';
  if (kind === 'deck') return 'deck';
  if (kind === 'route') return 'route';
  if (kind === 'scene' || kind === 'text_replacement') return 'scene';
  return 'event';
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

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

module.exports = {
  createRuntimeLens,
  normalizeLensPlan,
  focusCommands,
  writeLensPage
};
