'use strict';

const fs = require('fs');
const path = require('path');

const runtimePreview = require('./runtime_preview');
const lensModel = requireAuthoringModule('runtime_lens_model.js');
const snapshotModel = requireAuthoringModule('runtime_snapshot_model.js');
const domMapModel = requireAuthoringModule('runtime_dom_map_model.js');
const visualSurfaceModel = requireAuthoringModule('runtime_visual_surface_model.js');

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
  const previewOptions = {
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
  };
  const previewFactory = previewMode === 'quick'
    ? runtimePreview.createQuickRuntimePreview
    : runtimePreview.createModifiedRuntimePreview;
  const preview = previewFactory(previewOptions);

  if (preview && typeof preview.then === 'function') {
    return preview.then((result) => finalizePreviewResult(result, {
      focus,
      projectIndex,
      previewMode,
      previewOptions,
      allowQuickFallback: opts.allowQuickFallback !== false
    }));
  }
  return finalizePreviewResult(preview, {
    focus,
    projectIndex,
    previewMode,
    previewOptions,
    allowQuickFallback: opts.allowQuickFallback !== false
  });
}

function normalizePreviewMode(value) {
  return String(value || '').toLowerCase() === 'quick' ? 'quick' : 'full';
}

function finalizePreviewResult(preview, context) {
  const ctx = context || {};
  if (ctx.previewMode === 'quick' && ctx.allowQuickFallback && shouldFallbackQuickPreview(preview)) {
    const fallback = runtimePreview.createModifiedRuntimePreview(ctx.previewOptions || {});
    if (fallback && typeof fallback.then === 'function') {
      return fallback.then((result) => finalizeLens(annotateQuickFallback(result, preview), ctx));
    }
    return finalizeLens(annotateQuickFallback(fallback, preview), ctx);
  }
  return finalizeLens(preview, ctx);
}

function shouldFallbackQuickPreview(preview) {
  const result = preview || {};
  if (result.ok) {
    return false;
  }
  return ensureArray(result.diagnostics).some((diag) => {
    const code = String(diag && diag.code || '');
    return code === 'runtime_preview.quick_html_missing' ||
      code === 'runtime_surface.missing_script' ||
      code === 'runtime_surface.missing_stylesheet' ||
      code === 'runtime_surface.partial_runtime';
  });
}

function annotateQuickFallback(fallback, quickPreview) {
  const result = Object.assign({}, fallback || {});
  const quickDiagnostics = ensureArray(quickPreview && quickPreview.diagnostics);
  result.requestedPreviewMode = 'quick';
  result.quickFallback = {
    from: 'quick',
    to: 'full',
    diagnostics: quickDiagnostics
  };
  result.diagnostics = ensureArray(result.diagnostics);
  if (result.ok) {
    result.diagnostics = [diagnostic(
      'info',
      'runtime_lens.quick_fallback_full_build',
      'Quick Runtime Lens found incomplete generated HTML and used a temporary full build instead.'
    )].concat(result.diagnostics);
  } else {
    result.diagnostics = quickDiagnostics.concat(result.diagnostics);
  }
  return result;
}

function finalizeLens(preview, context) {
  const result = preview || {};
  const focus = context && context.focus || {};
  const runtimeSurface = runtimeSurfaceFor(context && context.projectIndex);
  const sourceEvidence = domMapModel.buildSourceEvidence(context && context.projectIndex, {
    focus,
    runtimeSurface,
    limits: {scenes: 80, textCorpus: 120, assets: 120, controls: 120, regions: 120}
  });
  const runtimeSnapshot = result.runtimeSnapshot || (!result.ok
    ? snapshotModel.buildSnapshot({
      runtimeSurface,
      snapshot: {},
      diagnostics: result.diagnostics || []
    })
    : null);
  const runtimeDomMap = result.runtimeDomMap || runtimeSnapshot && runtimeSnapshot.runtimeDomMap || (!result.ok
    ? domMapModel.buildDomMap({
      runtimeSurface,
      runtimeSnapshot,
      sourceEvidence,
      diagnostics: result.diagnostics || []
    })
    : null);
  const runtimeVisualSurface = result.runtimeVisualSurface || (runtimeDomMap
    ? visualSurfaceModel.buildVisualSurface({
      projectIndex: context && context.projectIndex,
      runtimeSurface,
      runtimeSnapshot,
      runtimeDomMap,
      focus,
      diagnostics: result.diagnostics || []
    })
    : null);
  const postLoadCommands = focusCommands(focus, result);
  const lensPage = result.ok ? writeLensPage(result, {focus, postLoadCommands, runtimeSurface, sourceEvidence}) : {url: '', path: ''};
  const sessionStatus = result.ok
    ? 'ready'
    : runtimeSnapshot && runtimeSnapshot.status === 'blocked'
      ? 'blocked'
      : 'failed';
  const session = Object.assign({}, result, {
    status: sessionStatus,
    lensUrl: lensPage.url || result.modifiedUrl,
    externalUrl: lensPage.url || result.modifiedUrl || result.compareUrl
  });
  if (runtimeSnapshot) {
    session.runtimeSnapshot = runtimeSnapshot;
  }
  if (runtimeDomMap) {
    session.runtimeDomMap = runtimeDomMap;
  }
  if (runtimeVisualSurface) {
    session.runtimeVisualSurface = runtimeVisualSurface;
  }
  const model = lensModel.buildModel({
    isDesktop: true,
    focus,
    projectIndex: context && context.projectIndex,
    session
  });
  return Object.assign({}, result, {
    kind: 'runtime_lens_session',
    status: model.status,
    focus,
    runtimeSnapshot,
    runtimeDomMap,
    runtimeVisualSurface,
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
    postLoadCommands: context && context.postLoadCommands || [],
    runtimeSurface: context && context.runtimeSurface || {},
    sourceEvidence: context && context.sourceEvidence || {}
  }), 'utf8');
  return {
    path: filePath,
    url: modifiedUrl.replace(/\/modified\/out\/html\/?$/, '/lens/')
  };
}

function lensPageHtml(options) {
  const opts = options || {};
  const commands = JSON.stringify(opts.postLoadCommands || []);
  const runtimeSurface = JSON.stringify(opts.runtimeSurface || {});
  const sourceEvidence = JSON.stringify(opts.sourceEvidence || {});
  const title = escapeHtml(opts.title || 'Runtime Lens');
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Runtime Lens - ' + title + '</title>',
    '<style>',
    'body{margin:0;height:100vh;display:grid;grid-template-rows:auto auto minmax(0,1fr);background:#f4f2ec;color:#28231c;font:14px system-ui,sans-serif}',
    'header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-bottom:1px solid #d8cbb7;background:#fffaf1}',
    'header div{min-width:0}strong,span{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    'button{padding:6px 9px;border:1px solid #b9a98d;border-radius:6px;background:white;color:#28231c}',
    'main{min-height:0}iframe{display:block;width:100%;height:100%;border:0;background:white}',
    '.status{color:#6b6255;font-size:12px}',
    '.runtime-health{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;padding:7px 10px;border-bottom:1px solid #d8cbb7;background:#fffdf8}',
    '.runtime-health span{padding:5px 7px;border:1px solid #e0d4bf;border-radius:6px;background:white;font-size:12px;white-space:normal}',
    '.runtime-health strong{display:inline;font-size:12px}',
    '.runtime-health .is-attention{border-color:#c9825f;color:#7a3418}',
    '.runtime-health .diagnostics{grid-column:1/-1;color:#6b6255;background:transparent;border:0;padding:0}',
    '</style>',
    '</head>',
    '<body>',
    '<header>',
    '<div><strong>Focused Runtime Lens</strong><span>' + title + '</span></div>',
    '<div><button type="button" data-lens-action="focus">Focus</button> <button type="button" data-lens-action="reset">Reset</button></div>',
    '<span class="status" data-lens-status>Loading runtime...</span>',
    '</header>',
    '<section class="runtime-health" aria-label="Runtime health" data-lens-health>',
    '<span data-health-loaded>Loaded: pending</span>',
    '<span data-health-focused>Focused: pending</span>',
    '<span data-health-regions>Regions: pending</span>',
    '<span data-health-choices>Choices: pending</span>',
    '<span data-health-graphics>Graphics: pending</span>',
    '<span data-health-map>Map: pending</span>',
    '<span class="diagnostics" data-health-diagnostics></span>',
    '</section>',
    '<main><iframe class="modified" title="Modified runtime" src="' + escapeAttr(opts.modifiedSrc || '../modified/out/html/') + '"></iframe></main>',
    '<script>' + lensPageScript(commands, opts.sessionId || '', runtimeSurface, sourceEvidence) + '</script>',
    '</body>',
    '</html>'
  ].join('\n') + '\n';
}

function lensPageScript(commandsJson, sessionId, runtimeSurfaceJson, sourceEvidenceJson) {
  return [
    '(function(){',
    '"use strict";',
    'var COMMANDS=' + commandsJson + ';',
    'var RUNTIME_SURFACE=' + runtimeSurfaceJson + ';',
    'var SOURCE_EVIDENCE=' + sourceEvidenceJson + ';',
    'var AUTO_COMMANDS=COMMANDS.filter(function(command){return command&&["jumpToScene","applyVariables","resetToInitialState"].indexOf(command.type)>=0;});',
    'var SESSION_ID=' + JSON.stringify(String(sessionId || '')) + ';',
    'var seq=0;',
    'var pending={};',
    'var autoFocused=false;',
    'var frame=document.querySelector("iframe.modified");',
    'var status=document.querySelector("[data-lens-status]");',
    'var health={loaded:document.querySelector("[data-health-loaded]"),focused:document.querySelector("[data-health-focused]"),regions:document.querySelector("[data-health-regions]"),choices:document.querySelector("[data-health-choices]"),graphics:document.querySelector("[data-health-graphics]"),map:document.querySelector("[data-health-map]"),diagnostics:document.querySelector("[data-health-diagnostics]")};',
    'function setStatus(text){if(status)status.textContent=text;}',
    'function metric(node,text,attention){if(!node)return;node.textContent=text;node.classList.toggle("is-attention",Boolean(attention));}',
    'function send(command){if(!frame||!frame.contentWindow){setStatus("Runtime frame is not ready.");return;}var requestId="lens-"+(++seq);pending[requestId]=command&&command.type||"";frame.contentWindow.postMessage({kind:"dms-runtime-preview-command",requestId:requestId,command:command}, window.location.origin);if(command&&command.type!=="getRuntimeSnapshot"){try{fetch("../api/debug-command-history",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:SESSION_ID,command:command})}).catch(function(){});}catch(_err){}}}',
    'function captureSnapshot(){send({type:"getRuntimeSnapshot"});}',
    'function focus(){autoFocused=true;if(!AUTO_COMMANDS.length){setStatus("No automatic focus command is available for this object.");setTimeout(captureSnapshot,120);return;}AUTO_COMMANDS.forEach(send);setStatus("Focus command sent.");setTimeout(captureSnapshot,220);}',
    'function publishEvidence(payload){try{if(window.parent&&window.parent!==window){window.parent.postMessage({kind:"dms-runtime-lens-session-evidence",sessionId:SESSION_ID,runtimeSnapshot:payload&&payload.runtimeSnapshot||null,runtimeDomMap:payload&&payload.runtimeDomMap||payload&&payload.runtimeSnapshot&&payload.runtimeSnapshot.runtimeDomMap||null},"*");}}catch(_err){}}',
    'function handleSnapshot(snapshot){var summary=snapshot&&snapshot.summary||{};var state=snapshot&&snapshot.state||{};var doc=snapshot&&snapshot.document||{};var graphics=snapshot&&snapshot.graphics||{};var diagnostics=snapshot&&snapshot.diagnostics||[];metric(health.loaded,"Loaded: "+(doc.bodyPresent?"yes":"no"),!doc.bodyPresent);metric(health.focused,"Focused: "+(state.sceneId||"unknown"),!state.sceneId);metric(health.regions,"Regions: "+(summary.visibleRegionCount||0)+"/"+(summary.indexedRegionCount||0),Number(summary.visibleRegionCount||0)===0);metric(health.choices,"Choices: "+(summary.choiceCount||0),false);metric(health.graphics,"Graphics: "+((graphics.svgCount||0)+(graphics.canvasCount||0))+(graphics.d3Present?" + D3":""),false);metric(health.map,"Map: pending",false);if(health.diagnostics)health.diagnostics.textContent=diagnostics.slice(0,2).map(function(item){return item.message||item.code||"";}).filter(Boolean).join("  ");setStatus("Snapshot: "+(doc.bodyPresent?"runtime loaded":"needs attention"));try{fetch("../api/runtime-snapshot",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:SESSION_ID,runtimeSnapshot:snapshot,runtimeSurface:RUNTIME_SURFACE,sourceEvidence:SOURCE_EVIDENCE})}).then(function(response){return response&&response.json?response.json():null;}).then(function(payload){if(payload&&(payload.runtimeDomMap||payload.runtimeSnapshot&&payload.runtimeSnapshot.runtimeDomMap))handleDomMap(payload.runtimeDomMap||payload.runtimeSnapshot.runtimeDomMap);publishEvidence(payload||{runtimeSnapshot:snapshot});}).catch(function(){publishEvidence({runtimeSnapshot:snapshot});});}catch(_err){publishEvidence({runtimeSnapshot:snapshot});}}',
    'function handleDomMap(map){var summary=map&&map.summary||{};var status=map&&map.status||"";metric(health.map,"Map: "+(summary.mappedCount||0)+"/"+(summary.visibleCount||0),status==="blocked"||Number(summary.mappedCount||0)===0);if(health.diagnostics&&map&&map.diagnostics&&map.diagnostics.length&&!health.diagnostics.textContent)health.diagnostics.textContent=map.diagnostics.slice(0,2).map(function(item){return item.message||item.code||"";}).filter(Boolean).join("  ");}',
    'frame&&frame.addEventListener("load",function(){setTimeout(function(){if(AUTO_COMMANDS.length&&!autoFocused)focus();else captureSnapshot();},120);});',
    'document.addEventListener("click",function(event){var action=event.target.closest&&event.target.closest("[data-lens-action]");if(!action)return;if(action.getAttribute("data-lens-action")==="focus")focus();if(action.getAttribute("data-lens-action")==="reset"){send({type:"resetToInitialState"});setStatus("Reset command sent.");setTimeout(captureSnapshot,220);}});',
    'window.addEventListener("message",function(event){var data=event.data||{};if(data.kind==="dms-runtime-lens-action"){if(data.action==="focus")focus();if(data.action==="reset"){send({type:"resetToInitialState"});setStatus("Reset command sent.");setTimeout(captureSnapshot,220);}return;}if(data.kind!=="dms-runtime-preview-result")return;var result=data.result||{};if(result.runtimeSnapshot){handleSnapshot(result.runtimeSnapshot);return;}setStatus((result.ok?"Ready":"Needs attention")+": "+(result.message||result.sceneId||"command complete"));if(pending[data.requestId]&&pending[data.requestId]!=="getRuntimeSnapshot")setTimeout(captureSnapshot,180);});',
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

function runtimeSurfaceFor(projectIndex) {
  return projectIndex && projectIndex.semantic && projectIndex.semantic.runtimeSurface || {};
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

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
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
