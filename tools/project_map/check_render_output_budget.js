// @ts-check
'use strict';

// Render-output budget guard.
//
// The Object Canvas editor builds its UI as one large HTML string. Twice a
// per-field picker rendered its ENTIRE project-wide catalog inline, multiplied
// across hundreds of slots, exploding a single event into >1M DOM nodes /
// ~190MB innerHTML / multi-second paint. The source-line budget never noticed:
// the cost lives in the *rendered output*, a dimension nothing guarded.
//
// This check renders representative fixtures through the real preview editor and
// asserts the bounds that keep that explosion from coming back:
//   (1) per-picker caps hold - variable and route-target candidates stay capped,
//       and large asset catalogs defer their options instead of inlining them;
//   (2) a dense event's total output stays under a byte budget - a coarse net for
//       any future explosion we have not named yet.
//
// Each cap fixture deliberately offers MORE candidates than the cap and asserts
// the picker actually rendered, so a mis-shaped fixture fails loudly instead of
// passing hollow (0 <= cap).

const previewEditor = require('./viewer/preview_object_editor.js');
const previewAssetEditor = require('./viewer/preview_asset_editor.js');
const {assert} = require('./check_harness.js');

// Initial-render cap shared by the variable picker (data-variable-picker-limit)
// and the route-target picker (data-route-target-picker-limit). The search box
// rebuilds the full list from the model on demand, so nothing is lost.
const PICKER_RENDER_CAP = 12;

// Dense-event total output budget. Baseline below is ~365 KB; the ~1.5x headroom
// absorbs label/i18n drift while still tripping on a fresh per-item explosion.
// The precise per-picker caps above catch the known regressions; this is the
// backstop for unknown ones.
const DENSE_RENDER_BYTE_BUDGET = 560000;
const DENSE_RENDER_BYTE_FLOOR = 250000;

let assertions = 0;
function check(condition, message, detail) {
  assert(condition, message, detail);
  assertions += 1;
}

function countMatches(html, pattern) {
  return (String(html).match(pattern) || []).length;
}

function buildVariableCandidates(count) {
  return Array.from({length: count}, (_unused, i) => ({
    name: 'budget_var_' + i,
    insertValue: 'Q.budget_var_' + i,
    label: 'Budget variable ' + i,
    meaning: 'meaning ' + i,
    summary: 'summary ' + i,
    searchText: 'budget_var_' + i
  }));
}

function buildRouteCandidates(count) {
  return Array.from({length: count}, (_unused, i) => ({
    insertValue: 'budget_scene_' + i,
    name: 'budget_scene_' + i,
    label: 'Budget scene ' + i,
    meaning: 'scene meaning ' + i,
    searchText: 'budget_scene_' + i
  }));
}

function buildLargeAssetCatalog() {
  const fillers = Array.from({length: 650}, (_unused, i) => ({
    path: 'img/events/filler_' + String(i).padStart(3, '0') + '.jpg',
    type: 'image',
    label: 'Filler asset ' + String(i).padStart(3, '0'),
    fileExists: true
  }));
  return fillers.concat({
    path: 'img/events/late-related.jpg',
    type: 'image',
    label: 'Late related campaign',
    fileExists: true
  });
}

// --- (1a) Variable picker caps its initial render ------------------------------
const variableCandidateCount = 50;
const variablePickerHtml = previewEditor.render({
  mode: 'existing',
  objectKind: 'event',
  objectId: 'render_budget_varpicker',
  title: 'Variable picker budget',
  eventBody: {
    title: {value: 'Variable picker budget'},
    sections: [{id: 'render_budget_varpicker.opening', value: 'Opening text.'}],
    metaFields: [{
      id: 'render_budget_condition',
      key: 'viewIf',
      role: 'logic',
      semanticRole: 'condition',
      label: 'When',
      value: 'budget_var_0 > 0',
      variablePicker: {enabled: true, mode: 'condition', candidates: buildVariableCandidates(variableCandidateCount)}
    }]
  }
});
const renderedVariableCandidates = countMatches(variablePickerHtml, /data-object-canvas-variable-target=/g);
check(variableCandidateCount > PICKER_RENDER_CAP,
  'variable picker fixture must offer more candidates than the cap, or it cannot exercise the cap');
check(variablePickerHtml.includes('data-object-canvas-variable-picker'),
  'variable picker fixture should actually render a picker (else this cap guard is hollow)');
check(renderedVariableCandidates > 0 && renderedVariableCandidates <= PICKER_RENDER_CAP,
  'variable picker must cap its initial render at ' + PICKER_RENDER_CAP + ' candidates (the search box rebuilds the full pool from the model)',
  {renderedVariableCandidates, offered: variableCandidateCount});

// --- (1b) Route-target picker caps its initial render --------------------------
const routeCandidateCount = 30;
const routeTargetPickerHtml = previewEditor.render({
  mode: 'existing',
  objectKind: 'event',
  objectId: 'render_budget_routepicker',
  title: 'Route picker budget',
  eventBody: {
    title: {value: 'Route picker budget'},
    sections: [{id: 'render_budget_routepicker.opening', value: 'Opening text.'}],
    options: [{
      id: 'render_budget_option',
      optionId: 'render_budget_option',
      target: {id: 'budget_scene_0'},
      title: 'Go onward',
      label: 'Go onward',
      value: 'Go onward',
      fields: [{
        id: 'render_budget_option_route',
        role: 'route',
        semanticRole: 'route',
        label: 'Target',
        value: 'budget_scene_0',
        routeTargetPicker: {enabled: true, candidates: buildRouteCandidates(routeCandidateCount)}
      }]
    }]
  }
});
const renderedRouteCandidates = countMatches(routeTargetPickerHtml, /data-object-canvas-route-target-insert=/g);
check(routeCandidateCount > PICKER_RENDER_CAP,
  'route picker fixture must offer more candidates than the cap, or it cannot exercise the cap');
check(routeTargetPickerHtml.includes('data-object-canvas-route-target-picker'),
  'route picker fixture should actually render a picker (else this cap guard is hollow)');
check(renderedRouteCandidates > 0 && renderedRouteCandidates <= PICKER_RENDER_CAP,
  'route-target picker must cap its initial render at ' + PICKER_RENDER_CAP + ' candidates (the search box rebuilds the full pool from the model)',
  {renderedRouteCandidates, offered: routeCandidateCount});

// --- (1c) Large asset catalogs defer their option list -------------------------
const assetCatalog = buildLargeAssetCatalog();
const assetDeferralHtml = previewEditor.render({
  mode: 'existing',
  objectKind: 'event',
  objectId: 'render_budget_assets',
  title: 'Asset deferral budget',
  eventBody: {
    title: {value: 'Asset deferral budget'},
    sections: [{id: 'render_budget_assets.opening', value: 'Opening text.'}],
    branchSections: [{
      id: 'render_budget_assets.branch',
      sectionId: 'render_budget_assets.branch',
      relatedOptionIds: ['budget_branch'],
      semanticRole: 'option_result_text',
      label: 'Option: Budget branch',
      value: 'The option result contains a related image.'
    }],
    assets: [{
      path: 'img/events/late-related.jpg',
      type: 'image',
      label: 'Late related campaign',
      placementKind: 'option_result_visual',
      sectionId: 'render_budget_assets.branch',
      optionId: 'budget_branch',
      flowAsset: true
    }],
    assetCatalog,
    assetAddFields: [{
      id: 'asset_add_flow_budget_branch',
      role: 'event_illustration',
      directive: 'face-image',
      type: 'image',
      placementKind: 'option_result_visual',
      sectionId: 'render_budget_assets.branch',
      optionId: 'budget_branch',
      displayLocation: 'Option: Budget branch'
    }]
  }
});
const deferredSelects = countMatches(assetDeferralHtml, /data-asset-select-deferred="/g);
const inlineAssetOptions = countMatches(assetDeferralHtml, /data-asset-search-text=/g);
check(assetCatalog.length > PICKER_RENDER_CAP,
  'asset deferral fixture must offer a large catalog, or it cannot exercise deferral');
check(deferredSelects > 0,
  'large asset catalogs should defer their option list (no deferred select rendered - did the fixture stop producing asset add controls?)');
check(inlineAssetOptions === 0,
  'a deferred asset select must not inline its catalog options up front (every option carries data-asset-search-text)',
  {inlineAssetOptions});
const deferredId = (assetDeferralHtml.match(/data-asset-select-deferred="([^"]+)"/) || [])[1];
const materializedOptions = previewAssetEditor.materializeDeferredAssetOptions(deferredId);
check(materializedOptions.includes('img/events/filler_649.jpg') && materializedOptions.includes('img/events/late-related.jpg'),
  'the deferred asset option list must still materialize the full catalog on demand, not a sliced first page');

// --- (2) Dense event total output stays under budget ---------------------------
const denseVariableCandidates = buildVariableCandidates(40);
const denseRouteCandidates = buildRouteCandidates(30);
const denseMetaFields = Array.from({length: 20}, (_unused, i) => ({
  id: 'dense_cond_' + i,
  key: 'viewIf',
  role: 'logic',
  semanticRole: 'condition',
  label: 'When ' + i,
  value: 'budget_var_0 > ' + i,
  variablePicker: {enabled: true, mode: 'condition', candidates: denseVariableCandidates}
}));
const denseOptions = Array.from({length: 20}, (_unused, i) => ({
  id: 'dense_opt_' + i,
  optionId: 'dense_opt_' + i,
  target: {id: 'budget_scene_0'},
  title: 'Choice ' + i,
  label: 'Choice ' + i,
  value: 'Choice ' + i,
  fields: [{
    id: 'dense_opt_' + i + '_route',
    role: 'route',
    semanticRole: 'route',
    label: 'Target',
    value: 'budget_scene_0',
    routeTargetPicker: {enabled: true, candidates: denseRouteCandidates}
  }]
}));
const denseHtml = previewEditor.render({
  mode: 'existing',
  objectKind: 'event',
  objectId: 'render_budget_dense',
  title: 'Dense event budget',
  eventBody: {
    title: {value: 'Dense event budget'},
    sections: [{id: 'render_budget_dense.opening', value: 'Opening text.'}],
    metaFields: denseMetaFields,
    options: denseOptions,
    assetCatalog,
    assets: []
  }
});
check(denseHtml.length > DENSE_RENDER_BYTE_FLOOR,
  'dense fixture under-rendered (' + denseHtml.length + ' bytes); a hollow fixture makes the byte budget meaningless');
check(denseHtml.length <= DENSE_RENDER_BYTE_BUDGET,
  'dense event render output exceeded its byte budget - a picker or list likely stopped bounding its output',
  {bytes: denseHtml.length, budget: DENSE_RENDER_BYTE_BUDGET});
// Cross-check: with 20 capped pickers of each kind, the aggregate must equal the
// per-picker cap times the picker count - proof none of them ballooned.
check(countMatches(denseHtml, /data-object-canvas-variable-target=/g) === PICKER_RENDER_CAP * denseMetaFields.length,
  'dense fixture variable pickers must each stay at the cap in aggregate');
check(countMatches(denseHtml, /data-object-canvas-route-target-insert=/g) === PICKER_RENDER_CAP * denseOptions.length,
  'dense fixture route pickers must each stay at the cap in aggregate');

process.stdout.write('PASS: render output budget (' + assertions + ' assertions)\n');
