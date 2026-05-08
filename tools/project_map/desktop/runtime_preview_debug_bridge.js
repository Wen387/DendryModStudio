'use strict';

const MAX_RENDERED_SCENES = 1000;

function bridgeScript(options) {
  const opts = options || {};
  const allowedOrigin = JSON.stringify(String(opts.allowedOrigin || ''));
  const controls = JSON.stringify(opts.controls || {variables: [], scenes: []});
  const sessionId = JSON.stringify(String(opts.sessionId || ''));
  return [
    '(function(){',
    '"use strict";',
    'var SESSION_ID=' + sessionId + ';',
    'var ALLOWED_ORIGIN=' + allowedOrigin + ';',
    'var CONTROLS=' + controls + ';',
    'var initialState=null;',
    'function diag(code,message){return {severity:"error",code:code,message:message,confidence:"exact"};}',
    'function ok(value){var base={ok:true,diagnostics:[]};var input=value||{};Object.keys(input).forEach(function(key){base[key]=input[key];});return base;}',
    'function fail(code,message){return {ok:false,diagnostics:[diag(code,message)],message:message};}',
    'function engine(){return window.dendryUI&&window.dendryUI.dendryEngine?window.dendryUI.dendryEngine:null;}',
    'function exportState(){var e=engine();if(!e||typeof e.getExportableState!=="function")return null;try{return e.getExportableState();}catch(_err){return null;}}',
    'function setState(state){var e=engine();if(!e||typeof e.setState!=="function")return false;try{e.setState(state);return true;}catch(_err){return false;}}',
    'function redrawCurrentScene(){var e=engine();if(!e)return false;try{if(e.ui&&typeof e.ui.newPage==="function")e.ui.newPage();if(e.ui&&typeof e.ui.removeChoices==="function")e.ui.removeChoices();if(typeof e.displaySceneContent==="function")e.displaySceneContent(false);if(typeof e.getCurrentScene==="function"&&typeof e._compileChoices==="function")e.choiceCache=e._compileChoices(e.getCurrentScene());if(typeof e.displayChoices==="function")e.displayChoices();if(e.ui&&typeof e.ui.setSprites==="function")e.ui.setSprites(e.state&&e.state.sprites||{});if(e.ui&&typeof e.ui.setBg==="function")e.ui.setBg(e.state&&e.state.bg);if(typeof window.updateSidebar==="function")window.updateSidebar();return true;}catch(_err){return false;}}',
    'function qualities(state){return state&&state.qualities?state.qualities:(state&&state.state&&state.state.qualities?state.state.qualities:null);}',
    'function allowedVariable(name){return (CONTROLS.variables||[]).find(function(item){return item&&item.name===name;});}',
    'function allowedScene(id){return (CONTROLS.scenes||[]).find(function(item){return item&&item.id===id;});}',
    'function valueOk(value,type){if(value&&typeof value==="object")return false;if(type==="booleanNumber")return Number(value)===0||Number(value)===1;if(type==="number")return Number.isFinite(Number(value));return false;}',
    'function coerce(value,type){return type==="number"||type==="booleanNumber"?Number(value):String(value||"");}',
    'function snapshot(){var state=exportState();if(state&&!initialState)initialState=JSON.parse(JSON.stringify(state));return state;}',
    'function getStateSummary(){var state=snapshot();if(!state)return fail("runtime_preview_debug.runtime_missing","The runtime did not expose an exportable state.");var q=qualities(state)||{};return ok({sessionId:SESSION_ID,sceneId:state.sceneId||state.currentSceneId||"",qualityCount:Object.keys(q).length});}',
    'function applyVariables(items){var state=snapshot();if(!state)return fail("runtime_preview_debug.runtime_missing","The runtime did not expose an exportable state.");var q=qualities(state);if(!q)return fail("runtime_preview_debug.qualities_missing","The runtime state does not expose Q-like qualities.");var applied=[];(items||[]).forEach(function(item){var name=String(item&&item.name||"");var control=allowedVariable(name);if(!control)throw new Error("Unknown preview variable: "+name);if(!valueOk(item.value,control.valueType))throw new Error("Invalid preview value for "+name);q[name]=coerce(item.value,control.valueType);applied.push(name);});if(!setState(state))return fail("runtime_preview_debug.set_state_failed","The runtime rejected the preview state update.");if(!redrawCurrentScene())return fail("runtime_preview_debug.redraw_failed","The runtime accepted the value but could not redraw the current scene.");return ok({applied:applied});}',
    'function jumpToScene(command){var sceneId=String(command&&command.sceneId||"");if(!allowedScene(sceneId))return fail("runtime_preview_debug.unknown_scene","This scene is not in the preview allowlist.");var e=engine();if(!e)return fail("runtime_preview_debug.runtime_missing","The runtime did not expose an engine.");var state=snapshot();if(!state)return fail("runtime_preview_debug.runtime_missing","The runtime did not expose an exportable state.");if(typeof e.goToScene!=="function")return fail("runtime_preview_debug.jump_hook_missing","This runtime build does not expose a safe scene jump hook.");try{e.goToScene(sceneId);}catch(_err){return fail("runtime_preview_debug.jump_failed","The runtime rejected the scene jump.");}return ok({sceneId:sceneId});}',
    'function resetToInitialState(){if(!initialState)return fail("runtime_preview_debug.initial_state_missing","The preview bridge has no initial state snapshot.");var copy=JSON.parse(JSON.stringify(initialState));if(!setState(copy))return fail("runtime_preview_debug.reset_failed","The runtime rejected the reset state.");if(!redrawCurrentScene())return fail("runtime_preview_debug.redraw_failed","The runtime reset state but could not redraw the current scene.");return ok({reset:true});}',
    'function run(command){try{if(!command||command.type==="getStateSummary")return getStateSummary();if(command.type==="applyVariables")return applyVariables(command.variables||[]);if(command.type==="jumpToScene")return jumpToScene(command);if(command.type==="resetToInitialState")return resetToInitialState();return fail("runtime_preview_debug.unknown_command","Unknown preview debug command.");}catch(err){return fail("runtime_preview_debug.command_failed",err&&err.message?err.message:String(err));}}',
    'window.DendryModStudioPreview={getStateSummary:getStateSummary,applyVariables:applyVariables,jumpToScene:jumpToScene,resetToInitialState:resetToInitialState};',
    'window.addEventListener("message",function(event){if(ALLOWED_ORIGIN&&event.origin!==ALLOWED_ORIGIN)return;var data=event.data||{};if(data.kind!=="dms-runtime-preview-command")return;var result=run(data.command||{});event.source&&event.source.postMessage({kind:"dms-runtime-preview-result",requestId:data.requestId||"",result:result},event.origin);});',
    '})();'
  ].join('\n') + '\n';
}

function debugPanelHtml(options) {
  const controls = options && options.controls || {};
  const sceneRows = controls.scenes || [];
  const renderedScenes = sceneRows.slice(0, MAX_RENDERED_SCENES);
  const hiddenSceneCount = Math.max(0, sceneRows.length - renderedScenes.length);
  const variables = (controls.variables || []).slice(0, 24).map((item) => {
    return '<label class="runtime-debug-row" data-debug-variable="' + escapeAttr(item.name) + '">' +
      '<span><strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml(item.reason || item.valueType || '') + '</small></span>' +
      '<input type="text" data-debug-variable-input="' + escapeAttr(item.name) + '" value="' + defaultValue(item) + '">' +
      '</label>';
  }).join('');
  const scenes = renderedScenes.map((item) => {
    const searchText = [
      item && item.id,
      item && item.title,
      item && item.type,
      item && item.sourcePath
    ].filter(Boolean).join(' ').toLowerCase();
    return '<button type="button" class="runtime-debug-scene" data-debug-scene="' + escapeAttr(item.id) + '" data-debug-scene-search="' + escapeAttr(searchText) + '">' +
      '<strong>' + escapeHtml(item.title || item.id) + '</strong>' +
      '<small>' + escapeHtml([item.type, item.sourcePath || item.id].filter(Boolean).join(' · ')) + '</small>' +
      '</button>';
  }).join('');
  const sceneSummary = '<p class="runtime-debug-count">' +
    escapeHtml('Showing ' + renderedScenes.length + ' of ' + sceneRows.length + (hiddenSceneCount ? '. Use the focused Runtime Lens for deeper jumps.' : '')) +
    '</p>';
  const links = (controls.links || []).slice(0, 20).map((item) => {
    return '<li>' + escapeHtml((item.from || '') + ' -> ' + (item.to || '')) + '</li>';
  }).join('');
  return [
    '<aside class="runtime-debug-console" aria-label="Preview Debug Console">',
    '<h2>Preview Debug Console</h2>',
    '<p>This only changes the temporary modified preview. It does not edit source files or real saves.</p>',
    '<section><h3>Test Conditions</h3><div class="runtime-debug-variables">' + variables + '</div>',
    '<button type="button" data-runtime-debug-action="apply-variables">Apply to modified preview</button>',
    '<button type="button" data-runtime-debug-action="reset">Reset modified preview</button></section>',
    '<section><h3>Jump</h3><input type="search" class="runtime-debug-filter" data-runtime-debug-scene-filter placeholder="Filter scenes, cards, news...">' + sceneSummary + '<div class="runtime-debug-scenes">' + scenes + '</div></section>',
    '<section><h3>Event Chain</h3><ul>' + links + '</ul></section>',
    '<section><h3>Command History</h3><ol class="runtime-debug-history"></ol></section>',
    '</aside>'
  ].join('\n');
}

function parentDebugScript(options) {
  const sessionId = JSON.stringify(String(options && options.sessionId || ''));
  return [
    '(function(){',
    '"use strict";',
    'var SESSION_ID=' + sessionId + ';',
    'var seq=0;',
    'function modifiedFrame(){return document.querySelector("iframe.modified");}',
    'function historyList(){return document.querySelector(".runtime-debug-history");}',
    'function appendHistory(text){var list=historyList();if(!list)return;var li=document.createElement("li");li.textContent=text;list.prepend(li);}',
    'function commandVariables(){return Array.prototype.slice.call(document.querySelectorAll("[data-debug-variable-input][data-debug-dirty=\\"1\\"]")).map(function(input){return {name:input.getAttribute("data-debug-variable-input"),value:input.value};});}',
    'function send(command){var frame=modifiedFrame();if(!frame||!frame.contentWindow){appendHistory("Modified preview is not loaded.");return;}var requestId="debug-"+(++seq);frame.contentWindow.postMessage({kind:"dms-runtime-preview-command",requestId:requestId,command:command}, window.location.origin);fetch("./api/debug-command-history",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:SESSION_ID,command:command})}).catch(function(){});}',
    'document.addEventListener("input",function(event){var filter=event.target.closest&&event.target.closest("[data-runtime-debug-scene-filter]");if(filter){var query=String(filter.value||"").toLowerCase();Array.prototype.slice.call(document.querySelectorAll("[data-debug-scene]")).forEach(function(button){var haystack=button.getAttribute("data-debug-scene-search")||"";button.hidden=Boolean(query)&&haystack.indexOf(query)<0;});return;}var input=event.target.closest&&event.target.closest("[data-debug-variable-input]");if(input)input.setAttribute("data-debug-dirty","1");});',
    'document.addEventListener("click",function(event){var action=event.target.closest("[data-runtime-debug-action]");if(action&&action.getAttribute("data-runtime-debug-action")==="apply-variables"){var variables=commandVariables();if(!variables.length){appendHistory("No changed variable values to apply.");return;}send({type:"applyVariables",variables:variables});return;}if(action&&action.getAttribute("data-runtime-debug-action")==="reset"){send({type:"resetToInitialState"});return;}var scene=event.target.closest("[data-debug-scene]");if(scene){send({type:"jumpToScene",sceneId:scene.getAttribute("data-debug-scene")});}});',
    'window.addEventListener("message",function(event){var data=event.data||{};if(data.kind!=="dms-runtime-preview-result")return;var result=data.result||{};appendHistory((result.ok?"OK":"Needs attention")+": "+(result.message||result.sceneId||((result.applied||[]).join(", "))||"command complete"));});',
    '})();'
  ].join('\n') + '\n';
}

function defaultValue(item) {
  return item && item.valueType === 'booleanNumber' ? '0' : '1';
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
  bridgeScript,
  debugPanelHtml,
  parentDebugScript
};
