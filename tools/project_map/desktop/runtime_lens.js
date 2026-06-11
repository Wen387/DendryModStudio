'use strict';

const fs = require('fs');
const path = require('path');

const runtimePreview = require('./runtime_preview');
const debugBridge = require('./runtime_preview_debug_bridge.js');
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
    focusScope: {
      sceneId: String(focus.targetSceneId || ''),
      sourcePath: String(focus.source && focus.source.path || '')
    },
    locale: opts.locale,
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
  const locale = context && context.previewOptions && context.previewOptions.locale || '';
  const lensPage = result.ok ? writeLensPage(result, {focus, postLoadCommands, runtimeSurface, sourceEvidence, locale}) : {url: '', path: ''};
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
  const debug = result.debug;
  const locale = context && context.locale || '';
  const hasDebug = Boolean(debug && debug.enabled && debug.controls);
  const debugLabels = debugBridge.comparePageLabels(locale);
  fs.writeFileSync(filePath, lensPageHtml({
    title: context && context.focus && (context.focus.title || context.focus.id) || 'Runtime Lens',
    sessionId: result.sessionId || '',
    modifiedSrc: '../modified/out/html/',
    postLoadCommands: context && context.postLoadCommands || [],
    runtimeSurface: context && context.runtimeSurface || {},
    sourceEvidence: context && context.sourceEvidence || {},
    locale,
    debugLabel: debugLabels.modeDebug,
    debugPanelHtml: hasDebug ? debugBridge.debugPanelHtml({controls: debug.controls, labels: debugLabels}) : '',
    debugScript: hasDebug ? debugBridge.parentDebugScript({sessionId: result.sessionId || '', labels: debugLabels}) : ''
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
  const lang = escapeAttr(String(opts.locale || 'en').split('-')[0] || 'en');
  const hasDebug = Boolean(opts.debugPanelHtml);
  return [
    '<!doctype html>',
    '<html lang="' + lang + '">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Runtime Lens - ' + title + '</title>',
    '<style>',
    'body{margin:0;height:100vh;display:grid;grid-template-rows:auto auto minmax(0,1fr);background:#f4f2ec;color:#28231c;font:14px system-ui,sans-serif;overflow:hidden;isolation:isolate;--runtime-lens-frame-min-width:1280px}',
    'header{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-bottom:1px solid #d8cbb7;background:#fffaf1}',
    'header div{min-width:0}strong,span{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    'button{padding:6px 9px;border:1px solid #b9a98d;border-radius:6px;background:white;color:#28231c}',
    '.lens-content{display:grid;grid-template-columns:minmax(0,1fr);min-width:0;min-height:0}',
    'body.is-dev-open .lens-content{grid-template-columns:minmax(0,1fr) min(380px,42vw)}',
    'main{position:relative;z-index:1;min-width:0;min-height:0;overflow:auto;overscroll-behavior:contain;background:white;contain:paint}iframe{display:block;width:100%;min-width:var(--runtime-lens-frame-min-width);height:100%;border:0;background:white;contain:paint}',
    '.status{color:#6b6255;font-size:12px}',
    '.runtime-health{position:relative;z-index:2;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;padding:7px 10px;border-bottom:1px solid #d8cbb7;background:#fffdf8}',
    '.runtime-health span{padding:5px 7px;border:1px solid #e0d4bf;border-radius:6px;background:white;font-size:12px;white-space:normal}',
    '.runtime-health strong{display:inline;font-size:12px}',
    '.runtime-health .is-attention{border-color:#c9825f;color:#7a3418}',
    '.runtime-health .diagnostics{grid-column:1/-1;color:#6b6255;background:transparent;border:0;padding:0}',
    'body:not(.is-dev-open) .runtime-debug-console{display:none}',
    '.runtime-debug-console{position:relative;z-index:1;min-width:0;overflow:auto;overscroll-behavior:contain;padding:12px;border-left:1px solid #d8cbb7;background:#fffdf8;box-sizing:border-box}',
    '.runtime-debug-console h2{font-size:16px;margin:0 0 6px}',
    '.runtime-debug-console h3{font-size:13px;margin:14px 0 6px}',
    '.runtime-debug-console p{color:#6b6255;line-height:1.4}',
    '.runtime-debug-focus{border:1px solid #d8cbb7;border-radius:6px;background:#fbfaf5;padding:2px 8px 8px}',
    '.runtime-debug-relevance{display:inline-block;font-size:10px;padding:1px 6px;border-radius:3px;background:#e8eede;color:#3f5a23;margin-right:6px}',
    '.runtime-debug-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;margin:6px 0}',
    '.runtime-debug-row small,.runtime-debug-scene small{display:block;color:#6b6255;font-size:11px}',
    '.runtime-debug-row span,.runtime-debug-row strong,.runtime-debug-row small,.runtime-debug-scene strong,.runtime-debug-scene small{min-width:0;overflow-wrap:anywhere}',
    '.runtime-debug-row input,.runtime-debug-filter,.runtime-debug-variable-filter{min-width:0;padding:5px;border:1px solid #cdbfa8;border-radius:4px}',
    '.runtime-debug-filter,.runtime-debug-variable-filter{box-sizing:border-box;width:100%;margin:2px 0 4px}',
    '.runtime-debug-count{font-size:12px;margin:4px 0 8px}',
    '.runtime-debug-scene,.runtime-debug-preset{display:block;width:100%;margin:5px 0;text-align:left}',
    '.runtime-debug-history{padding-left:20px;color:#4d4438}',
    '.runtime-debug-no-results{color:#6b6255;font-style:italic;font-size:12px;margin:8px 0}',
    '.runtime-debug-history li[data-debug-error]{color:#9a3412}',
    '.runtime-debug-toggle{-webkit-appearance:none;appearance:none;width:36px;height:20px;border-radius:10px;background:#cdbfa8;position:relative;cursor:pointer;transition:background 0.15s}',
    '.runtime-debug-toggle:checked{background:#6b8f4a}',
    '.runtime-debug-toggle::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:white;transition:left 0.15s}',
    '.runtime-debug-toggle:checked::after{left:18px}',
    '.runtime-debug-group{border:1px solid #e8e0d0;border-radius:6px;margin:6px 0}',
    '.runtime-debug-group summary{padding:8px 10px;cursor:pointer;font-weight:600;font-size:13px;list-style:none}',
    '.runtime-debug-group summary::-webkit-details-marker{display:none}',
    '.runtime-debug-group-count{color:#6b6255;font-weight:normal;margin-left:6px}',
    '.runtime-debug-group-body{padding:4px 10px 8px}',
    '.runtime-debug-show-more{font-size:12px;color:#6b6255;cursor:pointer;border:none;background:none;padding:4px 0}',
    '.runtime-debug-pinned{border-bottom:1px solid #e8e0d0;padding-bottom:8px;margin-bottom:4px}',
    '.runtime-debug-pin{background:none;border:none;cursor:pointer;opacity:0.4;padding:2px;font-size:14px}',
    '.runtime-debug-pin.is-pinned,.runtime-debug-pin:hover{opacity:1}',
    '.runtime-debug-type{font-size:10px;padding:1px 5px;border-radius:3px;background:#f0ebe3;color:#6b6255;margin-left:4px}',
    '.runtime-debug-input-wrap{display:flex;align-items:center;gap:4px}',
    '.runtime-debug-row input[type="number"]{width:72px}',
    '.runtime-debug-nav{position:sticky;top:0;z-index:1;display:flex;flex-wrap:wrap;gap:4px;padding:6px 0 8px;margin:0 0 4px;background:#fffdf8;border-bottom:1px solid #e8e0d0}',
    '.runtime-debug-nav button{font-size:11px;padding:3px 8px;border:1px solid #d8cbb7;border-radius:4px;background:#f8f4ed;cursor:pointer;white-space:nowrap}',
    '.runtime-debug-nav button:hover{background:#eee8dd}',
    '.runtime-debug-section{border:none;margin:2px 0 0}',
    '.runtime-debug-section>summary{padding:8px 0 4px;cursor:pointer;list-style:none;font-size:13px;font-weight:600;color:#28231c}',
    '.runtime-debug-section>summary::-webkit-details-marker{display:none}',
    '.runtime-debug-section>summary::before{content:"\\25b8";display:inline-block;margin-right:6px;font-size:11px;transition:transform 0.15s}',
    '.runtime-debug-section[open]>summary::before{transform:rotate(90deg)}',
    '</style>',
    '</head>',
    '<body>',
    '<header>',
    '<div><strong>Focused Runtime Lens</strong><span>' + title + '</span></div>',
    '<div><button type="button" data-lens-action="focus">Focus</button> <button type="button" data-lens-action="recapture">Re-capture</button> <button type="button" data-lens-action="reset">Reset</button>' +
      (hasDebug ? ' <button type="button" data-lens-action="toggle-dev" aria-pressed="false">' + escapeHtml(opts.debugLabel || 'Dev') + '</button>' : '') + '</div>',
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
    '<div class="lens-content">',
    '<main><iframe class="modified" title="Modified runtime" src="' + escapeAttr(opts.modifiedSrc || '../modified/out/html/') + '"></iframe></main>',
    hasDebug ? opts.debugPanelHtml : '',
    '</div>',
    '<script>' + lensPageScript(commands, opts.sessionId || '', runtimeSurface, sourceEvidence) + '</script>',
    hasDebug ? '<script>' + opts.debugScript + '</script>' : '',
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
    'var initialized=false;',
    'var captureTimer=null;',
    'var capturing=false;',
    'var captureDirty=false;',
    'var captureWatch=null;',
    'var frame=document.querySelector("iframe.modified");',
    'var status=document.querySelector("[data-lens-status]");',
    'var health={loaded:document.querySelector("[data-health-loaded]"),focused:document.querySelector("[data-health-focused]"),regions:document.querySelector("[data-health-regions]"),choices:document.querySelector("[data-health-choices]"),graphics:document.querySelector("[data-health-graphics]"),map:document.querySelector("[data-health-map]"),diagnostics:document.querySelector("[data-health-diagnostics]")};',
    'function setStatus(text){if(status)status.textContent=text;}',
    'function metric(node,text,attention){if(!node)return;node.textContent=text;node.classList.toggle("is-attention",Boolean(attention));}',
    'function send(command){if(!frame||!frame.contentWindow){setStatus("Runtime frame is not ready.");return;}var requestId="lens-"+(++seq);pending[requestId]=command&&command.type||"";frame.contentWindow.postMessage({kind:"dms-runtime-preview-command",requestId:requestId,command:command}, window.location.origin);if(command&&command.type!=="getRuntimeSnapshot"){try{fetch("../api/debug-command-history",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:SESSION_ID,command:command})}).catch(function(){});}catch(_err){}}}',
    'function scheduleCapture(){if(captureTimer)clearTimeout(captureTimer);captureTimer=setTimeout(function(){captureTimer=null;captureSnapshot();},280);}',
    'function captureSnapshot(){if(capturing){captureDirty=true;return;}capturing=true;if(captureWatch)clearTimeout(captureWatch);captureWatch=setTimeout(function(){capturing=false;captureWatch=null;},2500);send({type:"getRuntimeSnapshot"});}',
    'function runInitial(){if(initialized)return;initialized=true;if(AUTO_COMMANDS.length&&!autoFocused)focus();else captureSnapshot();}',
    'function focus(){autoFocused=true;if(!AUTO_COMMANDS.length){setStatus("No automatic focus command is available for this object.");scheduleCapture();return;}AUTO_COMMANDS.forEach(send);setStatus("Focus command sent.");scheduleCapture();}',
    'function publishEvidence(payload){try{if(window.parent&&window.parent!==window){window.parent.postMessage({kind:"dms-runtime-lens-session-evidence",sessionId:SESSION_ID,runtimeSnapshot:payload&&payload.runtimeSnapshot||null,runtimeDomMap:payload&&payload.runtimeDomMap||payload&&payload.runtimeSnapshot&&payload.runtimeSnapshot.runtimeDomMap||null},"*");}}catch(_err){}}',
    'function handleSnapshot(snapshot){var summary=snapshot&&snapshot.summary||{};var state=snapshot&&snapshot.state||{};var doc=snapshot&&snapshot.document||{};var graphics=snapshot&&snapshot.graphics||{};var diagnostics=snapshot&&snapshot.diagnostics||[];metric(health.loaded,"Loaded: "+(doc.bodyPresent?"yes":"no"),!doc.bodyPresent);metric(health.focused,"Focused: "+(state.sceneId||"unknown"),!state.sceneId);metric(health.regions,"Regions: "+(summary.visibleRegionCount||0)+"/"+(summary.indexedRegionCount||0),Number(summary.visibleRegionCount||0)===0);metric(health.choices,"Choices: "+(summary.choiceCount||0),false);metric(health.graphics,"Graphics: "+((graphics.svgCount||0)+(graphics.canvasCount||0))+(graphics.d3Present?" + D3":""),false);metric(health.map,"Map: pending",false);if(health.diagnostics)health.diagnostics.textContent=diagnostics.slice(0,2).map(function(item){return item.message||item.code||"";}).filter(Boolean).join("  ");setStatus("Snapshot: "+(doc.bodyPresent?"runtime loaded":"needs attention"));try{fetch("../api/runtime-snapshot",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:SESSION_ID,runtimeSnapshot:snapshot,runtimeSurface:RUNTIME_SURFACE,sourceEvidence:SOURCE_EVIDENCE})}).then(function(response){return response&&response.json?response.json():null;}).then(function(payload){if(payload&&(payload.runtimeDomMap||payload.runtimeSnapshot&&payload.runtimeSnapshot.runtimeDomMap))handleDomMap(payload.runtimeDomMap||payload.runtimeSnapshot.runtimeDomMap);publishEvidence(payload||{runtimeSnapshot:snapshot});}).catch(function(){publishEvidence({runtimeSnapshot:snapshot});});}catch(_err){publishEvidence({runtimeSnapshot:snapshot});}}',
    'function handleDomMap(map){var summary=map&&map.summary||{};var status=map&&map.status||"";metric(health.map,"Map: "+(summary.mappedCount||0)+"/"+(summary.visibleCount||0),status==="blocked"||Number(summary.mappedCount||0)===0);if(health.diagnostics&&map&&map.diagnostics&&map.diagnostics.length&&!health.diagnostics.textContent)health.diagnostics.textContent=map.diagnostics.slice(0,2).map(function(item){return item.message||item.code||"";}).filter(Boolean).join("  ");}',
    'frame&&frame.addEventListener("load",function(){setTimeout(runInitial,700);});',
    'document.addEventListener("click",function(event){var action=event.target.closest&&event.target.closest("[data-lens-action]");if(!action)return;var name=action.getAttribute("data-lens-action");if(name==="toggle-dev"){var open=document.body.classList.toggle("is-dev-open");action.setAttribute("aria-pressed",open?"true":"false");return;}if(name==="focus")focus();if(name==="recapture"){setStatus("Re-capturing...");captureSnapshot();}if(name==="reset"){send({type:"resetToInitialState"});setStatus("Reset command sent.");scheduleCapture();}});',
    'window.addEventListener("message",function(event){var data=event.data||{};if(data.kind==="dms-runtime-lens-action"){if(data.action==="focus")focus();if(data.action==="reset"){send({type:"resetToInitialState"});setStatus("Reset command sent.");scheduleCapture();}return;}if(data.kind==="dms-runtime-preview-event"){if(data.sessionId&&SESSION_ID&&String(data.sessionId)!==String(SESSION_ID))return;if(data.event==="ready")runInitial();else if(data.event==="dom-changed")scheduleCapture();return;}if(data.kind!=="dms-runtime-preview-result")return;var result=data.result||{};if(result.runtimeSnapshot){if(captureWatch){clearTimeout(captureWatch);captureWatch=null;}capturing=false;handleSnapshot(result.runtimeSnapshot);if(captureDirty){captureDirty=false;scheduleCapture();}return;}setStatus((result.ok?"Ready":"Needs attention")+": "+(result.message||result.sceneId||"command complete"));if(pending[data.requestId]&&pending[data.requestId]!=="getRuntimeSnapshot")scheduleCapture();});',
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
