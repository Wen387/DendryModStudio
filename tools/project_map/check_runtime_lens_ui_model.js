#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

global.ProjectMapI18n = {t: (_key, fallback) => fallback};
global.ProjectMapCardBoardModel = require('./authoring/card_board_model.js');
global.ProjectMapEditCapability = {
  buildEditCapability(_index, _view, item) {
    return {
      routeClass: 'direct_field_replace',
      installSafety: 'guarded_apply',
      reason: 'Fixture edit route.',
      target: {view: 'events', sceneId: item && item.owner && item.owner.sceneId || 'election_start', valueKey: item && item.id || 'body'}
    };
  },
  routeActionLabel() {
    return 'Open object editor';
  }
};
global.ProjectMapRuntimeVisualSurfaceModel = require('./authoring/runtime_visual_surface_model.js');
global.ProjectMapRuntimeVisualAssetDraftModel = require('./authoring/runtime_visual_asset_draft_model.js');

const runtimeLensUi = require('./viewer/runtime_lens_ui.js');
const runtimeLensWorkspace = require('./viewer/runtime_lens_workspace_state.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const {buildDynamicRepoSemanticFixture} = require('./fixtures/dynamicrepo_semantic_fixture.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const projectIndex = {
  scenes: [
    {
      id: 'election_start',
      title: 'Election Begins',
      type: 'event',
      path: 'source/scenes/events/election_start.scene.dry',
      sourceSpan: {path: 'source/scenes/events/election_start.scene.dry', startLine: 1},
      assetRefs: [
        {
          path: 'img/hero.png',
          type: 'image',
          directive: 'face-image',
          source: {path: 'source/scenes/events/election_start.scene.dry', line: 12},
          fileExists: true
        }
      ]
    },
    {
      id: 'post_vote_news',
      title: 'Post Vote News',
      type: 'news',
      path: 'source/scenes/post_event_news.scene.dry',
      sourceSpan: {path: 'source/scenes/post_event_news.scene.dry', startLine: 1}
    },
    {
      id: 'root',
      title: 'Root Surface',
      type: 'root',
      path: 'source/scenes/root.scene.dry',
      sourceSpan: {path: 'source/scenes/root.scene.dry', startLine: 1}
    },
    {
      id: 'starter_deck',
      title: 'Starter Deck',
      type: 'deck',
      path: 'source/scenes/decks/starter_deck.scene.dry',
      sourceSpan: {path: 'source/scenes/decks/starter_deck.scene.dry', startLine: 1}
    }
  ],
  semantic: {
    textCorpus: {
      items: [
        {
          id: 'election_body',
          role: 'body',
          text: 'Election Begins',
          owner: {sceneId: 'election_start'},
          source: {path: 'source/scenes/events/election_start.scene.dry', line: 3},
          editability: 'text_proposal'
        }
      ]
    }
  }
};
const model = {
  objectId: 'election_start',
  objectKind: 'event',
  title: 'Election Begins',
  source: {path: 'source/scenes/events/election_start.scene.dry', line: 1}
};

const focus = runtimeLensUi.focusFromCanvas(projectIndex, model, 'event:election_start');
assert(focus.kind === 'event', 'Storyboard Runtime Lens focus should resolve event kind');
assert(focus.id === 'election_start', 'Storyboard Runtime Lens focus should resolve selected id');
assert(focus.title === 'Election Begins', 'Storyboard Runtime Lens focus should resolve selected title');
assert(focus.source.path === 'source/scenes/events/election_start.scene.dry', 'Storyboard Runtime Lens focus should keep source reference');

const newsFocus = runtimeLensUi.focusFromCanvas(projectIndex, {
  objectId: 'post_vote_news',
  objectKind: 'news',
  title: 'Post Vote News',
  source: {path: 'source/scenes/post_event_news.scene.dry', line: 1}
}, 'news:post_vote_news');
assert(newsFocus.kind === 'news', 'Storyboard Runtime Lens focus should resolve news scene kind');
assert(newsFocus.targetSceneId === 'post_vote_news', 'Storyboard Runtime Lens focus should jump to news scenes');

const deckFocus = runtimeLensUi.focusFromCanvas(projectIndex, {
  objectId: 'starter_deck',
  objectKind: 'deck',
  title: 'Starter Deck',
  source: {path: 'source/scenes/decks/starter_deck.scene.dry', line: 1}
}, 'deck:starter_deck');
assert(deckFocus.kind === 'deck', 'Storyboard Runtime Lens focus should resolve deck scene kind');
assert(deckFocus.targetSceneId === 'starter_deck', 'Storyboard Runtime Lens focus should jump to deck scenes');
const dynamicIndex = buildDynamicRepoSemanticFixture();
const dynamicDeckFocus = runtimeLensUi.focusFromCardBoard(dynamicIndex, {mode: 'card', template: 'card'}, {cardBoardSelection: {kind: 'lane', laneKey: 'deck_pool:main.party'}});
assert(dynamicDeckFocus.kind === 'deck_pool', 'Card Board Runtime Lens should focus named deck pools');
assert(dynamicDeckFocus.proof && dynamicDeckFocus.proof.routeTags.includes('party_affairs'), 'deck pool Runtime Lens focus should include route/tag proof');
const dynamicAdvisorFocus = runtimeLensUi.focusFromCardBoard(dynamicIndex, {mode: 'card', template: 'card'}, {cardBoardSelection: {kind: 'lane', laneKey: 'advisor_controller:shuffle_leadership'}});
assert(dynamicAdvisorFocus.kind === 'advisor_controller', 'Card Board Runtime Lens should focus advisor controllers');
assert(dynamicAdvisorFocus.proof && dynamicAdvisorFocus.proof.variables.includes('siemsen_advisor'), 'advisor controller Runtime Lens focus should include variable proof');
const proofHtml = runtimeLensUi.renderPanel({focus: dynamicDeckFocus, status: 'idle'});
assert(proofHtml.includes('data-runtime-lens-proof="deck_pool"'), 'Runtime Lens panel should render deck proof metadata');

const textFocus = runtimeLensUi.focusFromCanvas(projectIndex, {
  objectId: 'surface_text_update',
  objectKind: 'surface_text',
  title: 'Replacement text',
  source: {path: 'source/scenes/root.scene.dry', line: 1}
}, 'text:surface_text_update');
assert(textFocus.kind === 'text_replacement', 'Storyboard Runtime Lens focus should resolve text replacement kind');
assert(textFocus.targetSceneId === 'root', 'Storyboard Runtime Lens focus should map text replacements to the owning scene');

const draftState = {
  projectIndex,
  workspace: 'content',
  mode: 'existing',
  view: 'events',
  item: 'election_start',
  selectedCanvasNode: 'event:election_start',
  values: {'event.body': 'Original body'},
  model: {
    objectId: 'election_start',
    objectKind: 'event',
    title: 'Election Begins',
    source: {path: 'source/scenes/events/election_start.scene.dry', line: 1},
    changeState: {changedCount: 1, output: {playerPreview: 'Original body'}}
  },
  runtimeLensSession: {ok: true, status: 'ready'},
  runtimeLensStatus: 'ready',
  runtimeLensFocusKey: 'event:election_start'
};
draftState.runtimeLensDraftKey = runtimeLensWorkspace.draftKey(draftState, focus);
draftState.values = {'event.body': 'Edited body'};
draftState.model.changeState.output.playerPreview = 'Edited body';
assert(runtimeLensWorkspace.markStale(draftState), 'Runtime Lens workspace state should mark same-focus draft edits stale');
assert(draftState.runtimeLensStatus === 'stale', 'Runtime Lens stale status should be stored on draft changes');

const browserHtml = runtimeLensUi.renderPanel({focus, status: 'idle'});
assert(browserHtml.includes('data-runtime-lens-panel="true"'), 'Runtime Lens panel should expose a stable marker');
assert(browserHtml.includes('Desktop app required'), 'Runtime Lens panel should explain browser unavailability');
assert(browserHtml.includes('disabled'), 'Runtime Lens create button should be disabled without desktop bridge');

global.dendryDesktop = {createRuntimeLens() {}};
const readyHtml = runtimeLensUi.renderPanel({
  focus,
  status: 'ready',
  sessionFocusKey: 'event:election_start',
  session: {
    ok: true,
    status: 'ready',
    lensUrl: 'http://127.0.0.1:4000/session/lens/',
    externalUrl: 'http://127.0.0.1:4000/session/lens/',
    runtimeSnapshot: {
      status: 'ready',
      summary: {
        loaded: true,
        sceneId: 'election_start',
        indexedRegionCount: 4,
        visibleRegionCount: 3,
        choiceCount: 2
      },
      graphics: {svgCount: 1, canvasCount: 0, d3Present: true},
      diagnostics: []
    },
    runtimeDomMap: {
      status: 'partial',
      summary: {visibleCount: 3, mappedCount: 2, sourceBackedCount: 1, manualReviewCount: 1},
      diagnostics: [
        {severity: 'warning', code: 'runtime_dom_map.unmapped_assets', message: 'One image needs manual review'}
      ],
      items: [
        {role: 'content', selector: '#content p', text: 'Election Begins', source: {path: 'source/scenes/events/election_start.scene.dry', line: 3}, confidence: 'strong', editability: 'text_proposal'},
        {role: 'd3_chart', selector: 'svg', text: 'Chart', source: {path: 'source/scenes/events/election_start.scene.dry', line: 20}, confidence: 'weak', editability: 'manual_review'}
      ]
    },
    runtimeVisualSurface: {
      status: 'partial',
      summary: {candidateCount: 3, draftableCount: 1, proposalOnlyCount: 1, manualReviewCount: 1, generatedOnlyCount: 0},
      diagnostics: [
        {severity: 'warning', code: 'runtime_visual_surface.manual_review_surface', message: 'One chart needs manual review'}
      ],
      candidates: [
        {
          id: 'candidate_content',
          role: 'content',
          label: 'Election Begins',
          currentValue: 'Election Begins',
          source: {path: 'source/scenes/events/election_start.scene.dry', line: 3},
          confidence: 'strong',
          editability: 'draftable',
          routeClass: 'direct_field_replace',
          installSafety: 'guarded_apply',
          action: {enabled: true, type: 'open_route', label: 'Open object editor', target: {view: 'events', sceneId: 'election_start'}}
        },
        {
          id: 'candidate_chart',
          role: 'd3_chart',
          label: 'Chart',
          currentValue: 'Chart',
          source: {path: 'source/scenes/events/election_start.scene.dry', line: 20},
          confidence: 'weak',
          editability: 'manual_review',
          routeClass: '',
          installSafety: 'manual_review',
          action: {enabled: false}
        },
        {
          id: 'candidate_portrait',
          role: 'portrait_image',
          label: 'hero.png',
          currentValue: 'img/hero.png',
          src: 'http://127.0.0.1/out/html/img/hero.png',
          source: {path: 'source/scenes/events/election_start.scene.dry', line: 12},
          confidence: 'strong',
          editability: 'proposal_only',
          routeClass: 'object_workspace',
          installSafety: 'guarded_apply',
          assetDirective: 'face-image',
          assetDraftStatus: 'proposal_only',
          replacementTargetPath: 'assets/studio/events/election_start/hero.png',
          action: {enabled: true, type: 'open_route', label: 'Open owning workspace', target: {view: 'events', sceneId: 'election_start'}},
          actions: [
            {enabled: true, type: 'open_route', label: 'Open owning workspace', target: {view: 'events', sceneId: 'election_start'}},
            {enabled: true, type: 'create_asset_reference_draft', label: 'Create asset draft', target: {owner: {sceneId: 'election_start'}}}
          ]
        }
      ]
    }
  }
});
assert(readyHtml.includes('data-runtime-lens-frame="true"'), 'Ready Runtime Lens panel should render an iframe');
assert(readyHtml.includes('class="runtime-lens-body"'), 'Ready Runtime Lens panel should group preview and diagnostics in one body');
assert(readyHtml.includes('class="runtime-lens-preview-shell"'), 'Ready Runtime Lens panel should render a preview shell around the iframe');
assert(readyHtml.includes('data-runtime-lens-evidence="true"'), 'Ready Runtime Lens panel should collapse runtime evidence below the preview');
assert(readyHtml.includes('Runtime evidence'), 'Ready Runtime Lens panel should label the collapsed evidence drawer');
assert(readyHtml.includes('data-runtime-lens-resize-grip="true"'), 'Ready Runtime Lens panel should expose a draggable height control');
assert(readyHtml.includes('http://127.0.0.1:4000/session/lens/'), 'Runtime Lens iframe should point at the focused wrapper URL');
assert(readyHtml.includes('Runtime health'), 'Ready Runtime Lens panel should render runtime snapshot health');
assert(readyHtml.includes('Regions: 3/4'), 'Ready Runtime Lens panel should summarize visible runtime regions');
assert(readyHtml.includes('Choices: 2'), 'Ready Runtime Lens panel should summarize rendered choices');
assert(readyHtml.includes('Graphics: 1 + D3'), 'Ready Runtime Lens panel should summarize D3 graphics');
assert(readyHtml.includes('DOM source map'), 'Ready Runtime Lens panel should render DOM source map details');
assert(readyHtml.includes('Mapped 2/3'), 'Ready Runtime Lens panel should summarize DOM source map coverage');
assert(readyHtml.includes('source/scenes/events/election_start.scene.dry:3'), 'Ready Runtime Lens panel should list mapped source references');
assert(readyHtml.includes('One image needs manual review'), 'Ready Runtime Lens panel should show DOM map diagnostics');
assert(readyHtml.includes('Editable visual surfaces'), 'Ready Runtime Lens panel should render visual surface candidates');
assert(readyHtml.includes('1 draftable'), 'Ready Runtime Lens panel should summarize draftable visual surfaces');
assert(readyHtml.includes('data-runtime-visual-action="open_route"'), 'Draftable visual surface should render an open route action');
assert(readyHtml.includes('data-runtime-visual-action="create_asset_reference_draft"'), 'Asset visual surface should render an asset draft action');
assert(readyHtml.includes('assets/studio/events/election_start/hero.png'), 'Asset visual surface should show replacement target readiness');
assert(readyHtml.includes('One chart needs manual review'), 'Ready Runtime Lens panel should show visual surface diagnostics');
assert(readyHtml.includes('Refresh quick'), 'Ready Runtime Lens panel should offer quick refresh');
assert(readyHtml.includes('Full Build'), 'Ready Runtime Lens panel should offer explicit full build');
assert(readyHtml.includes('Reset'), 'Ready Runtime Lens panel should offer reset');
assert(readyHtml.includes('Collapse'), 'Ready Runtime Lens panel should offer collapse');
assert(readyHtml.includes('Open'), 'Ready Runtime Lens panel should offer external open');

let loadedAssetDraft = null;
global.ProjectMapObjectAuthoringCanvas = {
  loadDraft(draft, meta) {
    loadedAssetDraft = {draft, meta};
    return true;
  }
};
const assetActionState = {
  projectIndex,
  workspace: 'content',
  mode: 'existing',
  view: 'events',
  item: 'election_start',
  selectedCanvasNode: 'event:election_start',
  model,
  runtimeLensSession: readySessionForAssetAction(),
  runtimeLensStatus: 'ready'
};
runtimeLensWorkspace.refreshRuntimeVisualSurface(assetActionState);
const assetCandidateId = assetActionState.runtimeLensSession.runtimeVisualSurface.candidates[0].id;
const assetActionOpened = runtimeLensWorkspace.handleVisualAction(assetActionState, 'create_asset_reference_draft', assetCandidateId, {render() {}});
assert(assetActionOpened, 'Runtime Lens workspace should open a runtime visual asset draft action');
assert(loadedAssetDraft && loadedAssetDraft.draft && loadedAssetDraft.draft.kind === 'existing_scene_edit', 'Runtime visual asset action should load an existing scene edit draft');
assert(loadedAssetDraft.draft.assetInstallRequests && loadedAssetDraft.draft.assetInstallRequests.length === 1, 'Runtime visual asset draft should carry an asset install request');
assert(assetActionState.runtimeLensSession.runtimeVisualAssetDraft && assetActionState.runtimeLensSession.runtimeVisualAssetDraft.status === 'proposal_only', 'Runtime visual asset action should store latest draft metadata on the session');
const runtimeAssetCanvas = canvasModel.buildCanvasModel(projectIndex, loadedAssetDraft.draft, {});
assert(runtimeAssetCanvas.ok, 'Runtime visual asset draft should reopen through Object Canvas');
assert(runtimeAssetCanvas.changeState.proposal.changes.some((change) => change.before === 'face-image: img/hero.png' && change.after === 'face-image: assets/studio/events/election_start/hero.png'), 'Runtime visual asset draft should preserve the source-backed asset directive replacement in Object Canvas');
assert(runtimeAssetCanvas.changeState.proposal.assetInstallRequests.length === 1, 'Runtime visual asset draft should preserve assetInstallRequests when reopened in Object Canvas');
assert(runtimeAssetCanvas.changeState.installPlan.operations.some((operation) => operation.type === 'replace_text' && operation.safety === 'guarded_apply'), 'Runtime visual asset draft reopened in Object Canvas should keep guarded source replacement');
assert(runtimeAssetCanvas.changeState.installPlan.operations.some((operation) => operation.type === 'copy_asset_file' && operation.safety === 'manual_review'), 'Runtime visual asset draft reopened without replacement sourcePath should keep asset copy manual review');
assert(runtimeAssetCanvas.eventBody.assets.some((asset) => asset.rowKind === 'asset_install_request' && asset.path === 'assets/studio/events/election_start/hero.png'), 'Runtime visual asset draft reopened in Object Canvas should render the pending asset install row');

const staleHtml = runtimeLensUi.renderPanel({
  focus,
  status: 'ready',
  sessionFocusKey: 'event:other_scene',
  session: {ok: true, status: 'ready', lensUrl: 'http://127.0.0.1:4000/session/lens/'}
});
assert(staleHtml.includes('data-runtime-lens-status="stale"'), 'Runtime Lens panel should mark stale focus');
assert(staleHtml.includes('previous selection'), 'Runtime Lens stale panel should explain the mismatch');

const draftStaleHtml = runtimeLensUi.renderPanel({
  focus,
  status: 'ready',
  sessionFocusKey: 'event:election_start',
  sessionDraftKey: 'draft-before',
  currentDraftKey: 'draft-after',
  session: {ok: true, status: 'ready', lensUrl: 'http://127.0.0.1:4000/session/lens/'}
});
assert(draftStaleHtml.includes('data-runtime-lens-status="stale"'), 'Runtime Lens panel should mark stale draft edits');
assert(draftStaleHtml.includes('latest draft'), 'Runtime Lens draft stale panel should explain refresh or rebuild');

const blockedHtml = runtimeLensUi.renderPanel({
  focus,
  status: 'blocked',
  sessionFocusKey: 'event:election_start',
  session: {
    ok: false,
    status: 'blocked',
    runtimeSnapshot: {
      status: 'blocked',
      summary: {loaded: false, sceneId: '', indexedRegionCount: 0, visibleRegionCount: 0, choiceCount: 0},
      graphics: {},
      diagnostics: [
        {severity: 'error', code: 'runtime_surface.missing_script', message: 'Missing out/html/core.js'}
      ]
    },
    runtimeDomMap: {
      status: 'blocked',
      summary: {visibleCount: 0, mappedCount: 0, sourceBackedCount: 0, manualReviewCount: 0},
      diagnostics: [
        {severity: 'error', code: 'runtime_dom_map.blocked_by_snapshot', message: 'Runtime DOM source map is blocked.'}
      ],
      items: []
    },
    runtimeVisualSurface: {
      status: 'blocked',
      summary: {candidateCount: 0, draftableCount: 0, proposalOnlyCount: 0, manualReviewCount: 0, generatedOnlyCount: 0},
      diagnostics: [
        {severity: 'error', code: 'runtime_visual_surface.blocked_by_dom_map', message: 'Runtime visual surface authoring is blocked.'}
      ],
      candidates: []
    },
    diagnostics: [
      {severity: 'error', code: 'runtime_surface.missing_script', message: 'Missing out/html/core.js'}
    ]
  }
});
assert(blockedHtml.includes('data-runtime-lens-status="blocked"'), 'Runtime Lens panel should expose blocked status');
assert(blockedHtml.includes('Missing out/html/core.js'), 'Blocked Runtime Lens panel should show readiness diagnostics');
assert(blockedHtml.includes('Runtime health'), 'Blocked Runtime Lens panel should still render snapshot health summary');
assert(blockedHtml.includes('DOM source map'), 'Blocked Runtime Lens panel should still render DOM source map summary');
assert(blockedHtml.includes('Runtime DOM source map is blocked.'), 'Blocked Runtime Lens panel should show DOM map blocker diagnostics');
assert(blockedHtml.includes('Editable visual surfaces'), 'Blocked Runtime Lens panel should still render visual surface summary');
assert(blockedHtml.includes('Runtime visual surface authoring is blocked.'), 'Blocked Runtime Lens panel should show visual surface blocker diagnostics');

const conditionalTitleHtml = runtimeLensUi.renderPanel({
  focus: {
    kind: 'event',
    id: 'center_party_conference',
    title: '[? if z_party_name != "CVP": <span style="color: #000000;">Center Party</span>?][? if z_party_name == "CVP": <span style="color: #000000;">**CVP**</span>?] Conference'
  },
  status: 'ready',
  sessionFocusKey: 'event:center_party_conference',
  session: {ok: true, status: 'ready', lensUrl: 'http://127.0.0.1:4000/session/lens/'}
});
assert(conditionalTitleHtml.includes('Center Party / CVP Conference'), 'Runtime Lens summary should compact common Dendry conditional labels for display');
assert(conditionalTitleHtml.includes('title="[? if z_party_name'), 'Runtime Lens summary should keep raw conditional title evidence in the tooltip');

const runtimeLensCss = fs.readFileSync(path.join(__dirname, 'viewer', 'styles', 'runtime-lens.css'), 'utf8');
assert(runtimeLensCss.includes('.runtime-lens-body'), 'Runtime Lens CSS should style the grouped preview body');
assert(runtimeLensCss.includes('.runtime-lens-resize-grip'), 'Runtime Lens CSS should style the preview height grip');
assert(runtimeLensCss.includes('--runtime-lens-frame-min-width: 1280px'), 'Runtime Lens CSS should reserve a desktop-width preview surface for horizontal panning');
assert(runtimeLensCss.includes('grid-template-rows: auto auto minmax(0, 1fr)'), 'Expanded Runtime Lens should reserve a real body row for the preview');
assert(/\.runtime-lens-panel\.is-expanded \.runtime-lens-body\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\) auto[^}]*overflow: hidden/s.test(runtimeLensCss), 'Expanded Runtime Lens body should dedicate remaining height to the iframe and keep evidence compact');
assert(/\.runtime-lens-panel\.is-expanded \.runtime-lens-preview-shell\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\) auto/s.test(runtimeLensCss), 'Expanded Runtime Lens preview shell should let the iframe fill the available preview row');
assert(/\.runtime-lens-evidence-body\s*\{[^}]*max-height: min\(34vh, 360px\)[^}]*overflow: auto/s.test(runtimeLensCss), 'Runtime Lens evidence drawer should scroll internally instead of growing over the preview');
assert(/\.runtime-lens-panel\s*\{[^}]*isolation: isolate/s.test(runtimeLensCss), 'Runtime Lens panel should isolate nested iframe painting');
assert(/\.runtime-lens-preview-shell\s*\{[^}]*contain: paint/s.test(runtimeLensCss), 'Runtime Lens preview shell should contain iframe painting');
assert(/\.runtime-lens-frame-wrap\s*\{[^}]*contain: paint[^}]*isolation: isolate/s.test(runtimeLensCss), 'Runtime Lens frame wrap should isolate iframe compositing');
assert(/\.runtime-lens-frame-wrap\s*\{[^}]*overflow: auto[^}]*overscroll-behavior: contain/s.test(runtimeLensCss), 'Runtime Lens frame wrap should expose horizontal panning for docked wide previews');
assert(/\.runtime-lens-frame\s*\{[^}]*min-width: var\(--runtime-lens-frame-min-width\)/s.test(runtimeLensCss), 'Runtime Lens iframe should keep a panning width in narrow docked previews');
assert(/\.runtime-lens-health\s*\{[^}]*background: var\(--surface\)/s.test(runtimeLensCss), 'Runtime Lens health evidence should paint an opaque surface');
assert(/\.runtime-lens-dom-map,\s*\.runtime-lens-visual-surface\s*\{[^}]*background: var\(--surface\)/s.test(runtimeLensCss), 'Runtime Lens evidence details should paint an opaque surface');

const evidenceState = {
  projectIndex,
  workspace: 'content',
  mode: 'existing',
  view: 'events',
  item: 'election_start',
  selectedCanvasNode: 'event:election_start',
  model,
  runtimeLensSession: {ok: true, status: 'ready', sessionId: 'session-1'},
  runtimeLensStatus: 'ready'
};
let renderedAfterEvidence = false;
assert(runtimeLensWorkspace.handleEvidenceMessage(evidenceState, {
  kind: 'dms-runtime-lens-session-evidence',
  sessionId: 'session-1',
  runtimeSnapshot: {status: 'ready', state: {sceneId: 'election_start'}},
  runtimeDomMap: {
    status: 'ready',
    items: [
      {id: 'content_1', role: 'content', text: 'Election Begins', sceneId: 'election_start', source: {path: 'source/scenes/events/election_start.scene.dry', line: 3}, confidence: 'strong'}
    ]
  }
}, {render: () => { renderedAfterEvidence = true; }}), 'Runtime Lens workspace should accept live session evidence messages');
assert(renderedAfterEvidence, 'Runtime Lens workspace should render after live evidence updates');
assert(evidenceState.runtimeLensSession.runtimeVisualSurface.summary.draftableCount === 1, 'Live evidence update should compute visual surface candidates with full ProjectIndex');

let openedRoute = null;
global.ProjectMapObjectAuthoringCanvas = {
  openFromSelection(index, view, sceneId, options) {
    openedRoute = {index, view, sceneId, options};
    return true;
  }
};
const candidateId = evidenceState.runtimeLensSession.runtimeVisualSurface.candidates[0].id;
assert(runtimeLensWorkspace.handleVisualAction(evidenceState, 'open_route', candidateId, {render() {}}), 'Runtime Lens workspace should open draftable visual surface routes');
assert(openedRoute && openedRoute.sceneId === 'election_start', 'Visual surface open route should target the owning scene');

const collapsedHtml = runtimeLensUi.renderPanel({
  focus,
  status: 'ready',
  collapsed: true,
  sessionFocusKey: 'event:election_start',
  session: {ok: true, status: 'ready', lensUrl: 'http://127.0.0.1:4000/session/lens/'}
});
assert(collapsedHtml.includes('is-collapsed'), 'Runtime Lens panel should support collapsed state');
assert(!collapsedHtml.includes('data-runtime-lens-frame="true"'), 'Collapsed Runtime Lens panel should hide the iframe');

const systemProjectIndex = {
  scenes: [
    {
      id: 'root',
      title: 'Dynamic Social Democracy',
      type: 'root',
      path: 'source/scenes/root.scene.dry',
      sourceSpan: {path: 'source/scenes/root.scene.dry', startLine: 1}
    },
    {
      id: 'main',
      title: 'Workspace Hand',
      type: 'hand',
      path: 'source/scenes/main.scene.dry',
      sourceSpan: {path: 'source/scenes/main.scene.dry', startLine: 1}
    }
  ],
  semantic: {hands: [{id: 'main', title: 'Workspace Hand'}]}
};
const systemModel = {
  template: 'project',
  eventBody: {
    title: {id: 'project.gameTitle', label: 'Game title', value: 'Runtime Lens Game Title', source: {path: 'source/scenes/root.scene.dry', line: 1}},
    heading: {id: 'project.author', label: 'Author', value: 'Studio Tester', source: {path: 'source/scenes/root.scene.dry', line: 2}}
  }
};
const systemFocus = runtimeLensUi.focusFromSystemRegion(systemProjectIndex, systemModel, 'ui:screen_header', {fixture: 'status_heavy'});
assert(systemFocus.kind === 'system_region', 'System UI Runtime Lens focus should resolve system_region kind');
assert(systemFocus.regionId === 'screen_header', 'System UI Runtime Lens focus should resolve selected region id');
assert(systemFocus.targetSceneId === 'root', 'System UI Runtime Lens focus should target the runtime scene behind the selected region');
assert(systemFocus.source.path === 'source/scenes/root.scene.dry', 'System UI Runtime Lens focus should preserve source evidence');
assert(systemFocus.key === 'system_region:screen_header:status_heavy', 'System UI Runtime Lens focus key should include fixture context');

const starterIndex = require(path.join(__dirname, 'templates', 'starter-demo', 'project-index.json'));
const cardModel = {
  mode: 'existing',
  template: 'existing',
  objectId: 'demo_action_card',
  eventBody: {},
  changeState: {changedCount: 0, operationSummary: {}, output: {}}
};
const cardFocus = runtimeLensUi.focusFromCardBoard(starterIndex, cardModel, {cardBoardSelectedKey: 'card:demo_action_card'});
assert(cardFocus.kind === 'card', 'Card Board Runtime Lens focus should resolve selected source card kind');
assert(cardFocus.cardId === 'demo_action_card', 'Card Board Runtime Lens focus should preserve selected card id');
assert(cardFocus.targetSceneId === 'demo_action_card', 'Card Board Runtime Lens focus should jump directly to the card scene');
assert(cardFocus.source.path === 'source/scenes/cards/demo_action_card.scene.dry', 'Card Board Runtime Lens focus should keep card source');

const optionFocus = runtimeLensUi.focusFromCardBoard(starterIndex, cardModel, {
  cardBoardSelectedKey: 'card:demo_action_card',
  cardBoardSelection: {kind: 'option', cardKey: 'card:demo_action_card', optionIndex: 0}
});
assert(optionFocus.kind === 'card_option', 'Card Board Runtime Lens focus should distinguish selected card options');
assert(optionFocus.cardId === 'demo_action_card', 'Card option focus should retain parent card id');
assert(optionFocus.targetSceneId === 'demo_action_card', 'Card option focus should still jump to the parent card scene');

const routeBoard = global.ProjectMapCardBoardModel.buildBoard(starterIndex, cardModel, {});
const routeKey = routeBoard.lanes.find((lane) => lane.key === 'hand').cards[0].key;
const routeFocus = runtimeLensUi.focusFromCardBoard(starterIndex, cardModel, {cardBoardSelection: {kind: 'route', key: routeKey}});
assert(routeFocus.kind === 'hand', 'Card Board Runtime Lens focus should resolve hand route selections');
assert(routeFocus.targetSceneId, 'Hand route focus should have a runtime scene target');

const advisorLaneFocus = runtimeLensUi.focusFromCardBoard(starterIndex, cardModel, {cardBoardSelection: {kind: 'lane', laneKey: 'advisor'}});
assert(advisorLaneFocus.kind === 'card', 'Advisor lane focus should use the first advisor-like card as runtime target');
assert(advisorLaneFocus.targetSceneId === 'demo_advisor', 'Advisor lane focus should target the pinned advisor card');

function readySessionForAssetAction() {
  return {
    ok: true,
    status: 'ready',
    runtimeDomMap: {
      status: 'ready',
      items: [
        {
          id: 'portrait_dom',
          role: 'portrait_image',
          selector: '.face-img',
          src: 'http://127.0.0.1/out/html/img/hero.png',
          sceneId: 'election_start',
          source: {path: 'source/scenes/events/election_start.scene.dry', line: 12},
          confidence: 'strong'
        }
      ]
    },
    runtimeVisualSurface: {
      status: 'partial',
      candidates: [
        {
          id: 'candidate_portrait',
          role: 'portrait_image',
          label: 'hero.png',
          currentValue: 'img/hero.png',
          src: 'http://127.0.0.1/out/html/img/hero.png',
          sceneId: 'election_start',
          source: {path: 'source/scenes/events/election_start.scene.dry', line: 12},
          confidence: 'strong',
          editability: 'proposal_only',
          routeClass: 'object_workspace',
          installSafety: 'guarded_apply',
          action: {enabled: true, type: 'open_route', label: 'Open owning workspace', target: {view: 'events', sceneId: 'election_start'}},
          actions: [
            {enabled: true, type: 'open_route', label: 'Open owning workspace', target: {view: 'events', sceneId: 'election_start'}},
            {enabled: true, type: 'create_asset_reference_draft', label: 'Create asset draft', target: {owner: {sceneId: 'election_start'}}}
          ]
        }
      ],
      diagnostics: []
    }
  };
}

process.stdout.write(JSON.stringify({
  ok: true,
  focus: focus.key,
  systemFocus: systemFocus.key,
  cardFocus: cardFocus.key,
  optionFocus: optionFocus.key,
  markers: ['data-runtime-lens-panel', 'data-runtime-lens-frame', 'stale', 'system_region', 'card_option', 'is-collapsed', 'reset']
}, null, 2) + '\n');
