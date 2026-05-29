'use strict';

const MAX_RENDERED_SCENES = 1000;

function bridgeScript(options) {
  const opts = options || {};
  const allowedOrigin = JSON.stringify(String(opts.allowedOrigin || ''));
  const controls = JSON.stringify(opts.controls || {variables: [], scenes: []});
  const runtimeSurface = JSON.stringify(opts.runtimeSurface || {});
  const sessionId = JSON.stringify(String(opts.sessionId || ''));
  return [
    '(function(){',
    '"use strict";',
    'var SESSION_ID=' + sessionId + ';',
    'var ALLOWED_ORIGIN=' + allowedOrigin + ';',
    'var CONTROLS=' + controls + ';',
    'var RUNTIME_SURFACE=' + runtimeSurface + ';',
    'var SNAPSHOT_LIMITS={regions:80,regionElements:8,samples:80,text:160,assets:80,cssVariables:80,styles:40};',
    'var initialState=null;',
    'function diag(code,message){return {severity:"error",code:code,message:message,confidence:"exact"};}',
    'function warn(code,message){return {severity:"warning",code:code,message:message,confidence:"runtime"};}',
    'function ok(value){var base={ok:true,diagnostics:[]};var input=value||{};Object.keys(input).forEach(function(key){base[key]=input[key];});return base;}',
    'function fail(code,message){return {ok:false,diagnostics:[diag(code,message)],message:message};}',
    'function engine(){return window.dendryUI&&window.dendryUI.dendryEngine?window.dendryUI.dendryEngine:null;}',
    'function exportState(){var e=engine();if(!e||typeof e.getExportableState!=="function")return null;try{return e.getExportableState();}catch(_err){return null;}}',
    'function setState(state){var e=engine();if(!e||typeof e.setState!=="function")return false;try{e.setState(state);return true;}catch(_err){return false;}}',
    'function redrawCurrentScene(){var e=engine();if(!e)return false;try{if(e.ui&&typeof e.ui.newPage==="function")e.ui.newPage();if(e.ui&&typeof e.ui.removeChoices==="function")e.ui.removeChoices();if(typeof e.displaySceneContent==="function")e.displaySceneContent(false);if(typeof e.getCurrentScene==="function"&&typeof e._compileChoices==="function")e.choiceCache=e._compileChoices(e.getCurrentScene());if(typeof e.displayChoices==="function")e.displayChoices();if(e.ui&&typeof e.ui.setSprites==="function")e.ui.setSprites(e.state&&e.state.sprites||{});if(e.ui&&typeof e.ui.setBg==="function")e.ui.setBg(e.state&&e.state.bg);if(typeof window.updateSidebar==="function")window.updateSidebar();return true;}catch(_err){return false;}}',
    'function qualities(state){return state&&state.qualities?state.qualities:(state&&state.state&&state.state.qualities?state.state.qualities:null);}',
    'function allowedVariable(name){return (CONTROLS.variables||[]).find(function(item){return item&&item.name===name;});}',
    'function allowedScene(id){return (CONTROLS.scenes||[]).find(function(item){return item&&item.id===id;});}',
    'function valueOk(value,type){if(value&&typeof value==="object")return false;if(type==="booleanNumber")return Number(value)===0||Number(value)===1;if(type==="number")return Number.isFinite(Number(value));if(type==="string")return String(value==null?"":value).length<=80;return false;}',
    'function coerce(value,type){return type==="number"||type==="booleanNumber"?Number(value):String(value||"");}',
    'function snapshot(){var state=exportState();if(state&&!initialState)initialState=JSON.parse(JSON.stringify(state));return state;}',
    'function getStateSummary(){var state=snapshot();if(!state)return fail("runtime_preview_debug.runtime_missing","The runtime did not expose an exportable state.");var q=qualities(state)||{};return ok({sessionId:SESSION_ID,sceneId:state.sceneId||state.currentSceneId||"",qualityCount:Object.keys(q).length});}',
    'function applyVariables(items){var state=snapshot();if(!state)return fail("runtime_preview_debug.runtime_missing","The runtime did not expose an exportable state.");var q=qualities(state);if(!q)return fail("runtime_preview_debug.qualities_missing","The runtime state does not expose Q-like qualities.");var applied=[];(items||[]).forEach(function(item){var name=String(item&&item.name||"");var control=allowedVariable(name);if(!control)throw new Error("Unknown preview variable: "+name);if(!valueOk(item.value,control.valueType))throw new Error("Invalid preview value for "+name);q[name]=coerce(item.value,control.valueType);applied.push(name);});if(!setState(state))return fail("runtime_preview_debug.set_state_failed","The runtime rejected the preview state update.");if(!redrawCurrentScene())return fail("runtime_preview_debug.redraw_failed","The runtime accepted the value but could not redraw the current scene.");return ok({applied:applied});}',
    'function jumpToScene(command){var sceneId=String(command&&command.sceneId||"");if(!allowedScene(sceneId))return fail("runtime_preview_debug.unknown_scene","This scene is not in the preview allowlist.");var e=engine();if(!e)return fail("runtime_preview_debug.runtime_missing","The runtime did not expose an engine.");var state=snapshot();if(!state)return fail("runtime_preview_debug.runtime_missing","The runtime did not expose an exportable state.");if(typeof e.goToScene!=="function")return fail("runtime_preview_debug.jump_hook_missing","This runtime build does not expose a safe scene jump hook.");try{e.goToScene(sceneId);}catch(_err){return fail("runtime_preview_debug.jump_failed","The runtime rejected the scene jump.");}return ok({sceneId:sceneId});}',
    'function applyFocusPreset(command){var variables=command&&command.variables||[];if(variables.length){var applied=applyVariables(variables);if(!applied.ok)return applied;}return jumpToScene(command);}',
    'function resetToInitialState(){if(!initialState)return fail("runtime_preview_debug.initial_state_missing","The preview bridge has no initial state snapshot.");var copy=JSON.parse(JSON.stringify(initialState));if(!setState(copy))return fail("runtime_preview_debug.reset_failed","The runtime rejected the reset state.");if(!redrawCurrentScene())return fail("runtime_preview_debug.redraw_failed","The runtime reset state but could not redraw the current scene.");return ok({reset:true});}',
    'function doc(){return window.document||null;}',
    'function nowIso(){try{return new Date().toISOString();}catch(_err){return "";}}',
    'function cleanText(value){return String(value||"").replace(/\\s+/g," ").trim();}',
    'function clip(value,limit){var text=cleanText(value);var max=Number(limit||SNAPSHOT_LIMITS.text);return text.length>max?text.slice(0,Math.max(0,max-3))+"...":text;}',
    'function arr(value){return Array.isArray(value)?value:[];}',
    'function regionKey(item){return String(item&&item.selector||"")+"\\n"+String(item&&item.role||"");}',
    'function fallbackRegions(){return[{selector:"#content",role:"content",label:"Story content"},{selector:"ul.choices",role:"choices",label:"Choices"},{selector:"#stats_sidebar",role:"left_sidebar",label:"Left sidebar"},{selector:"#stats_sidebar_right",role:"right_sidebar",label:"Right sidebar"},{selector:"#options",role:"options_overlay",label:"Options overlay"},{selector:"#save",role:"save_overlay",label:"Save overlay"},{selector:".background",role:"background",label:"Background"},{selector:".hand",role:"card_hand",label:"Card hand"},{selector:".pinned-cards",role:"pinned_cards",label:"Pinned cards"},{selector:".deck",role:"deck",label:"Deck"},{selector:".face-img",role:"portrait_image",label:"Portrait image"}];}',
    'function snapshotRegions(){var sourceRegions=arr(RUNTIME_SURFACE&&RUNTIME_SURFACE.regions).concat(fallbackRegions());var seen={};var out=[];sourceRegions.forEach(function(region){var selector=String(region&&region.selector||"");if(!selector)return;var key=regionKey(region);if(seen[key])return;seen[key]=true;out.push(snapshotRegion(region));});return out.slice(0,SNAPSHOT_LIMITS.regions);}',
    'function queryAll(selector){var d=doc();if(!d||typeof d.querySelectorAll!=="function")return {elements:[],error:""};try{return {elements:Array.prototype.slice.call(d.querySelectorAll(selector)).slice(0,SNAPSHOT_LIMITS.regionElements),error:""};}catch(err){return {elements:[],error:err&&err.message?err.message:String(err)};}}',
    'function snapshotRegion(region){var selector=String(region&&region.selector||"");var queried=queryAll(selector);var elements=queried.elements||[];var first=elements[0]||null;var visible=elements.some(isVisible);var text=clip(elements.map(function(el){return el&&el.textContent||"";}).join(" "),SNAPSHOT_LIMITS.text);var samples=elements.slice(0,SNAPSHOT_LIMITS.regionElements).map(function(el,index){return sampleFor(el,region,selector,index);});var item={id:String(region&&region.id||""),role:String(region&&region.role||""),label:String(region&&region.label||""),selector:selector,found:elements.length>0,visible:visible,elementCount:elements.length,text:text,textCount:text?1:0,box:first?boxFor(first):{x:0,y:0,width:0,height:0},samples:samples,source:region&&region.source||{}};if(queried.error)item.error=queried.error;return item;}',
    'function sampleFor(el,region,selector,index){var src=attr(el,"currentSrc")||attr(el,"src");return {index:index,selector:sampleSelector(el,selector,index),regionId:String(region&&region.id||""),role:String(region&&region.role||""),tag:String(el&&el.tagName||el&&el.nodeName||"").toLowerCase(),elementId:attr(el,"id"),className:attr(el,"class"),visible:isVisible(el),text:clip(el&&el.textContent||"",SNAPSHOT_LIMITS.text),src:src,currentSrc:attr(el,"currentSrc"),alt:attr(el,"alt"),title:attr(el,"title"),dataset:safeDataset(el),box:boxFor(el),regionSource:region&&region.source||{}};}',
    'function sampleSelector(el,selector,index){var id=attr(el,"id");if(id)return "#"+id;var tag=String(el&&el.tagName||el&&el.nodeName||"").toLowerCase()||"*";return String(selector||tag)+" "+tag+":nth-of-type("+(index+1)+")";}',
    'function attr(el,name){if(!el)return "";try{if(name==="currentSrc"&&el.currentSrc)return String(el.currentSrc||"");if(name==="src"&&el.src)return String(el.src||"");if(name==="class"&&el.className)return typeof el.className==="string"?el.className:String(el.className&&el.className.baseVal||"");if(name==="id"&&el.id)return String(el.id||"");if(typeof el.getAttribute==="function")return String(el.getAttribute(name)||"");}catch(_err){}return "";}',
    'function safeDataset(el){var out={};var data=el&&el.dataset||{};try{Object.keys(data).forEach(function(key){if(/^dms[A-Z0-9_]/.test(key)||/^dms[-_]/i.test(key))out[key]=clip(data[key],120);});}catch(_err){}return out;}',
    'function isVisible(el){if(!el)return false;var box=boxFor(el);var style={display:"",visibility:"",opacity:"1"};try{if(typeof window.getComputedStyle==="function")style=window.getComputedStyle(el)||style;}catch(_err){}return box.width>0&&box.height>0&&style.display!=="none"&&style.visibility!=="hidden"&&Number(style.opacity||1)!==0;}',
    'function boxFor(el){if(!el||typeof el.getBoundingClientRect!=="function")return {x:0,y:0,width:Number(el&&el.offsetWidth||0),height:Number(el&&el.offsetHeight||0)};try{var box=el.getBoundingClientRect();return {x:round(box.x||box.left||0),y:round(box.y||box.top||0),width:round(box.width||0),height:round(box.height||0)};}catch(_err){return {x:0,y:0,width:0,height:0};}}',
    'function round(value){var number=Number(value);return Number.isFinite(number)?Math.round(number*100)/100:0;}',
    'function snapshotAssets(){var d=doc();var images=d&&d.images?Array.prototype.slice.call(d.images):[];var audio=queryAll("audio").elements||[];return {images:assetGroup(images,"image"),audio:assetGroup(audio,"audio")};}',
    'function assetGroup(items,kind){var out=[];items.slice(0,SNAPSHOT_LIMITS.assets).forEach(function(el){var src=String(el&&((el.currentSrc||el.src)||el.getAttribute&&el.getAttribute("src"))||"");var loaded=kind==="image"?Boolean(el&&el.complete&&Number(el.naturalWidth||0)>0):Boolean(el&&Number(el.readyState||0)>0);var missing=!src;var error=kind==="image"?Boolean(src&&el&&el.complete&&Number(el.naturalWidth||0)===0):Boolean(src&&el&&Number(el.error&&el.error.code||0)>0);out.push({src:src,ok:loaded&&!error&&!missing,loaded:loaded,missing:missing,error:error});});return {total:items.length,loaded:out.filter(function(item){return item.loaded;}).length,error:out.filter(function(item){return item.error;}).length,missing:out.filter(function(item){return item.missing;}).length,items:out};}',
    'function snapshotGraphics(){var svgs=queryAll("svg").elements||[];var canvases=queryAll("canvas").elements||[];return {d3Present:Boolean(window.d3),svgCount:svgs.length,svgNonEmptyCount:svgs.filter(function(svg){return cleanText(svg.textContent||"")||Number(svg.children&&svg.children.length||0)>0;}).length,canvasCount:canvases.length,canvasNonEmptyCount:canvases.filter(canvasNonEmpty).length};}',
    'function canvasNonEmpty(canvas){if(!canvas)return false;if(Number(canvas.width||0)===0&&Number(canvas.clientWidth||0)===0)return false;if(Number(canvas.height||0)===0&&Number(canvas.clientHeight||0)===0)return false;if(typeof canvas.getContext!=="function")return true;try{var ctx=canvas.getContext("2d");if(!ctx||typeof ctx.getImageData!=="function")return true;var width=Math.min(16,Number(canvas.width||1));var height=Math.min(16,Number(canvas.height||1));var data=ctx.getImageData(0,0,width,height).data;for(var index=0;index<data.length;index+=4){if(data[index]||data[index+1]||data[index+2]||data[index+3])return true;}return false;}catch(_err){return true;}}',
    'function snapshotCss(){var d=doc();var root=d&&d.documentElement||null;var variables=[];var styles=[];var computedRoot=null;try{computedRoot=root&&typeof window.getComputedStyle==="function"?window.getComputedStyle(root):null;}catch(_err){computedRoot=null;}arr(RUNTIME_SURFACE&&RUNTIME_SURFACE.cssVariables).slice(0,SNAPSHOT_LIMITS.cssVariables).forEach(function(item){var name=String(item&&item.name||"");if(!name)return;var value="";try{value=computedRoot&&typeof computedRoot.getPropertyValue==="function"?computedRoot.getPropertyValue(name):"";}catch(_err){}variables.push({name:name,value:clip(value,80)});});arr(RUNTIME_SURFACE&&RUNTIME_SURFACE.regions).concat(fallbackRegions()).slice(0,SNAPSHOT_LIMITS.styles).forEach(function(region){var selector=String(region&&region.selector||"");var el=queryAll(selector).elements[0];if(!el)return;var style={};try{var computed=typeof window.getComputedStyle==="function"?window.getComputedStyle(el):null;["display","position","visibility","overflow","zIndex"].forEach(function(name){style[name]=computed?String(computed[name]||computed.getPropertyValue&&computed.getPropertyValue(name)||""):"";});}catch(_err){}styles.push({selector:selector,role:String(region&&region.role||""),style:style,box:boxFor(el)});});return {variables:variables,styles:styles};}',
    'function stateSummaryForSnapshot(){var state=exportState();var q=qualities(state)||{};return {exportable:Boolean(state),sceneId:state&&(state.sceneId||state.currentSceneId)||"",qualityCount:Object.keys(q).length};}',
    'function getRuntimeSnapshot(){var d=doc();var body=Boolean(d&&d.body);var regions=snapshotRegions();var raw={kind:"runtime_snapshot_raw",sessionId:SESSION_ID,capturedAt:nowIso(),document:{readyState:String(d&&d.readyState||""),title:String(d&&d.title||""),bodyPresent:body,url:String(window.location&&window.location.href||"")},state:stateSummaryForSnapshot(),regions:regions,summary:{indexedRegionCount:regions.length,foundRegionCount:regions.filter(function(item){return item.found;}).length,visibleRegionCount:regions.filter(function(item){return item.visible;}).length,choiceCount:(regions.find(function(item){return item.role==="choices"||item.selector==="ul.choices";})||{}).elementCount||0},assets:snapshotAssets(),graphics:snapshotGraphics(),css:snapshotCss(),diagnostics:body?[]:[warn("runtime_snapshot.body_missing","Runtime snapshot could not find a document body.")]};return ok({runtimeSnapshot:raw,message:"Runtime snapshot captured."});}',
    'function run(command){try{if(!command||command.type==="getStateSummary")return getStateSummary();if(command.type==="getRuntimeSnapshot")return getRuntimeSnapshot();if(command.type==="applyVariables")return applyVariables(command.variables||[]);if(command.type==="applyFocusPreset")return applyFocusPreset(command);if(command.type==="jumpToScene")return jumpToScene(command);if(command.type==="resetToInitialState")return resetToInitialState();return fail("runtime_preview_debug.unknown_command","Unknown preview debug command.");}catch(err){return fail("runtime_preview_debug.command_failed",err&&err.message?err.message:String(err));}}',
    'window.DendryModStudioPreview={getStateSummary:getStateSummary,getRuntimeSnapshot:getRuntimeSnapshot,applyVariables:applyVariables,applyFocusPreset:applyFocusPreset,jumpToScene:jumpToScene,resetToInitialState:resetToInitialState};',
    'window.addEventListener("message",function(event){if(ALLOWED_ORIGIN&&event.origin!==ALLOWED_ORIGIN)return;var data=event.data||{};if(data.kind!=="dms-runtime-preview-command")return;var result=run(data.command||{});event.source&&event.source.postMessage({kind:"dms-runtime-preview-result",requestId:data.requestId||"",result:result},event.origin);});',
    '})();'
  ].join('\n') + '\n';
}

function debugPanelHtml(options) {
  const controls = options && options.controls || {};
  const sceneRows = controls.scenes || [];
  const renderedScenes = sceneRows.slice(0, MAX_RENDERED_SCENES);
  const hiddenSceneCount = Math.max(0, sceneRows.length - renderedScenes.length);
  const presets = (controls.focusPresets || []).map((item) => {
    const variables = JSON.stringify(item.variables || []);
    const detail = [
      item && item.type,
      item && item.sourcePath,
      item && item.variables && item.variables.length ? (item.variables.length + ' state values') : ''
    ].filter(Boolean).join(' · ');
    return '<button type="button" class="runtime-debug-preset" data-debug-focus-preset="' + escapeAttr(item.id) + '" data-debug-focus-scene="' + escapeAttr(item.sceneId) + '" data-debug-focus-variables="' + escapeAttr(variables) + '">' +
      '<strong>' + escapeHtml(item.label || item.title || item.sceneId) + '</strong>' +
      '<small>' + escapeHtml(detail || item.reason || '') + '</small>' +
      '</button>';
  }).join('');
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
    presets ? '<section><h3>Focused Entry</h3><p>Open newly created or changed content with matching temporary state.</p>' + presets + '</section>' : '',
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
    'function appendHistory(text,isError){var list=historyList();if(!list)return;var li=document.createElement("li");li.textContent=text;if(isError)li.setAttribute("data-debug-error","1");list.prepend(li);}',
    'function commandVariables(){return Array.prototype.slice.call(document.querySelectorAll("[data-debug-variable-input][data-debug-dirty=\\"1\\"]")).map(function(input){return {name:input.getAttribute("data-debug-variable-input"),value:input.value};});}',
    'function jsonAttr(el,name,fallback){try{return JSON.parse(el.getAttribute(name)||"");}catch(_err){return fallback;}}',
    'var pendingCommands={};',
    'function send(command){var frame=modifiedFrame();if(!frame||!frame.contentWindow){appendHistory("Modified preview is not loaded.",true);return;}var requestId="debug-"+(++seq);pendingCommands[requestId]=command;frame.contentWindow.postMessage({kind:"dms-runtime-preview-command",requestId:requestId,command:command}, window.location.origin);fetch("./api/debug-command-history",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:SESSION_ID,command:command})}).catch(function(){});}',
    'function updateSceneFilterHint(){var container=document.querySelector(".runtime-debug-scenes");if(!container)return;var buttons=container.querySelectorAll("[data-debug-scene]");var visible=0;for(var i=0;i<buttons.length;i++){if(!buttons[i].hidden)visible++;}var hint=container.querySelector(".runtime-debug-no-results");if(visible===0&&buttons.length>0){if(!hint){hint=document.createElement("p");hint.className="runtime-debug-no-results";hint.textContent="No scenes match the filter.";container.prepend(hint);}}else if(hint){hint.remove();}}',
    'function clearDirtyFlags(){Array.prototype.slice.call(document.querySelectorAll("[data-debug-dirty]")).forEach(function(input){input.removeAttribute("data-debug-dirty");});}',
    'document.addEventListener("input",function(event){var filter=event.target.closest&&event.target.closest("[data-runtime-debug-scene-filter]");if(filter){var query=String(filter.value||"").toLowerCase();Array.prototype.slice.call(document.querySelectorAll("[data-debug-scene]")).forEach(function(button){var haystack=button.getAttribute("data-debug-scene-search")||"";button.hidden=Boolean(query)&&haystack.indexOf(query)<0;});updateSceneFilterHint();return;}var input=event.target.closest&&event.target.closest("[data-debug-variable-input]");if(input)input.setAttribute("data-debug-dirty","1");});',
    'document.addEventListener("click",function(event){var action=event.target.closest("[data-runtime-debug-action]");if(action&&action.getAttribute("data-runtime-debug-action")==="apply-variables"){var variables=commandVariables();if(!variables.length){appendHistory("No changed variable values to apply.");return;}send({type:"applyVariables",variables:variables});clearDirtyFlags();return;}if(action&&action.getAttribute("data-runtime-debug-action")==="reset"){send({type:"resetToInitialState"});clearDirtyFlags();return;}var preset=event.target.closest("[data-debug-focus-preset]");if(preset){send({type:"applyFocusPreset",sceneId:preset.getAttribute("data-debug-focus-scene"),variables:jsonAttr(preset,"data-debug-focus-variables",[])});clearDirtyFlags();return;}var scene=event.target.closest("[data-debug-scene]");if(scene){send({type:"jumpToScene",sceneId:scene.getAttribute("data-debug-scene")});}});',
    'window.addEventListener("message",function(event){var data=event.data||{};if(data.kind!=="dms-runtime-preview-result")return;var result=data.result||{};var command=pendingCommands[data.requestId]||{};delete pendingCommands[data.requestId];var label=command.type||"command";var detail=result.message||result.sceneId||((result.applied||[]).join(", "))||"done";appendHistory((result.ok?"OK":"Needs attention")+" ["+label+"]: "+detail,!result.ok);});',
    '})();'
  ].join('\n') + '\n';
}

function defaultValue(item) {
  var type = item && item.valueType || '';
  if (type === 'booleanNumber' || type === 'number') { return '0'; }
  return '';
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
