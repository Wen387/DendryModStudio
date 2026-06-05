#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const lensModel = require('./authoring/runtime_lens_model.js');
const runtimeLens = require('./desktop/runtime_lens.js');
const runtimePreview = require('./desktop/runtime_preview.js');
const runtimeLensWorkspaceState = require('./viewer/runtime_lens_workspace_state.js');

const {fail, assert} = require('./check_harness.js');

function htmlBuildRunner(label) {
  return (root, meta) => {
    const htmlRoot = path.join(root, 'out', 'html');
    fs.mkdirSync(htmlRoot, {recursive: true});
    fs.writeFileSync(path.join(htmlRoot, 'index.html'), [
      '<!doctype html>',
      '<title>' + String(label || meta && meta.lane || 'runtime lens') + '</title>',
      '<body>' + String(meta && meta.lane || 'runtime lens') + '</body>'
    ].join('\n') + '\n', 'utf8');
    return {
      ok: true,
      root,
      lane: meta && meta.lane || '',
      command: label || 'runtime lens fixture build',
      htmlRoot,
      diagnostics: []
    };
  };
}

const projectIndex = {
  project: {name: 'Runtime Lens Fixture'},
  scenes: [
    {id: 'root', title: 'Root', type: 'root', path: 'source/scenes/root.scene.dry'},
    {id: 'focus_event', title: 'Focused Event', type: 'event', path: 'source/scenes/events/focus_event.scene.dry'},
    {id: 'focus_news', title: 'Focused News', type: 'news', path: 'source/scenes/news/focus_news.scene.dry'},
    {id: 'focus_card', title: 'Focused Card', type: 'card', path: 'source/scenes/cards/focus_card.scene.dry'},
    {id: 'starter_deck', title: 'Starter Deck', type: 'deck', path: 'source/scenes/decks/starter_deck.scene.dry'}
  ],
  semantic: {
    events: [{id: 'focus_event', title: 'Focused Event'}],
    news: [{id: 'focus_news', title: 'Focused News'}],
    cards: [{id: 'focus_card', title: 'Focused Card'}],
    decks: [{id: 'starter_deck', title: 'Starter Deck'}]
  },
  variables: [{name: 'year', tags: ['time']}],
  edges: [{from: 'root', to: 'focus_event', kind: 'choice'}]
};

const browserModel = lensModel.buildModel({
  isDesktop: false,
  focus: {kind: 'event', id: 'focus_event'},
  projectIndex
});
assert(browserModel.status === 'unavailable', 'browser mode should report Runtime Lens unavailable');
assert(browserModel.diagnostics.some((diag) => diag.code === 'runtime_lens.desktop_required'), 'browser model should explain desktop requirement');

const idleFocus = lensModel.normalizeFocus({kind: 'event', id: 'focus_event'}, projectIndex);
assert(idleFocus.targetSceneId === 'focus_event', 'event focus should resolve target scene id');
assert(idleFocus.title === 'Focused Event', 'event focus should resolve scene title');
const newsFocus = lensModel.normalizeFocus({kind: 'news_item', id: 'focus_news'}, projectIndex);
assert(newsFocus.kind === 'news', 'news_item focus should normalize to news');
assert(newsFocus.targetSceneId === 'focus_news', 'news focus should resolve target scene id');
const deckFocus = lensModel.normalizeFocus({kind: 'deck', id: 'starter_deck'}, projectIndex);
assert(deckFocus.targetSceneId === 'starter_deck', 'deck focus should resolve target scene id');
const deckPoolFocus = lensModel.normalizeFocus({kind: 'deck_pool', id: 'main.party', targetSceneId: 'main', proof: {kind: 'deck_pool', routeTags: ['party_affairs'], memberCardIds: ['shuffle_leadership']}}, projectIndex);
assert(deckPoolFocus.kind === 'deck_pool', 'deck pool focus should normalize as a first-class runtime focus');
assert(deckPoolFocus.proof && deckPoolFocus.proof.routeTags[0] === 'party_affairs', 'deck pool focus should preserve route proof metadata');
const advisorControllerFocus = lensModel.normalizeFocus({kind: 'advisor_controller', id: 'shuffle_leadership', targetSceneId: 'shuffle_leadership', proof: {kind: 'advisor_controller', variables: ['siemsen_advisor']}}, projectIndex);
assert(advisorControllerFocus.kind === 'advisor_controller', 'advisor controller focus should normalize as a first-class runtime focus');
assert(advisorControllerFocus.proof && advisorControllerFocus.proof.variables[0] === 'siemsen_advisor', 'advisor controller focus should preserve variable proof metadata');

const snapshotModel = lensModel.buildModel({
  isDesktop: true,
  focus: {kind: 'event', id: 'focus_event'},
  projectIndex,
  session: {
    ok: true,
    status: 'ready',
    runtimeSnapshot: {
      document: {readyState: 'complete', bodyPresent: true},
      state: {exportable: true, sceneId: 'focus_event', qualityCount: 2},
      summary: {indexedRegionCount: 2, visibleRegionCount: 2, choiceCount: 1},
      regions: [
        {selector: '#content', role: 'content', found: true, visible: true, text: 'Focused event'}
      ],
      graphics: {d3Present: false, svgCount: 0, canvasCount: 0}
    },
    runtimeDomMap: {
      status: 'partial',
      summary: {visibleCount: 1, mappedCount: 1, sourceBackedCount: 1, manualReviewCount: 0},
      items: [
        {role: 'content', selector: '#content p', text: 'Focused event', source: {path: 'source/scenes/events/focus_event.scene.dry', line: 4}, confidence: 'strong', editability: 'text_proposal'}
      ]
    },
    runtimeVisualSurface: {
      status: 'partial',
      summary: {candidateCount: 1, draftableCount: 0, proposalOnlyCount: 1, manualReviewCount: 0, generatedOnlyCount: 0},
      candidates: [
        {id: 'content_1', role: 'content', label: 'Focused event', currentValue: 'Focused event', source: {path: 'source/scenes/events/focus_event.scene.dry', line: 4}, confidence: 'strong', editability: 'proposal_only'}
      ]
    },
    runtimeVisualAssetDraft: {
      status: 'proposal_only',
      currentAsset: {path: 'img/hero.png', type: 'image', directive: 'face-image'},
      replacementAsset: {path: 'assets/studio/events/focus_event/hero.png', type: 'image', directive: 'face-image'},
      source: {path: 'source/scenes/events/focus_event.scene.dry', line: 12},
      owner: {sceneId: 'focus_event', sceneKind: 'event'},
      changes: [
        {fieldId: 'asset_face_image', role: 'asset_reference', source: {path: 'source/scenes/events/focus_event.scene.dry', line: 12}, before: 'face-image: img/hero.png', after: 'face-image: assets/studio/events/focus_event/hero.png'}
      ],
      diagnostics: []
    }
  }
});
assert(snapshotModel.session.runtimeSnapshot && snapshotModel.session.runtimeSnapshot.status === 'ready', 'Runtime Lens model should normalize runtime snapshots');
assert(snapshotModel.session.runtimeHealthStatus === 'ready', 'Runtime Lens model should expose runtime health status');
assert(snapshotModel.session.runtimeDomMap && snapshotModel.session.runtimeDomMap.status === 'partial', 'Runtime Lens model should normalize runtime DOM maps');
assert(snapshotModel.session.runtimeDomMapStatus === 'partial', 'Runtime Lens model should expose runtime DOM map status');
assert(snapshotModel.session.runtimeVisualSurface && snapshotModel.session.runtimeVisualSurface.status === 'partial', 'Runtime Lens model should normalize runtime visual surface authoring candidates');
assert(snapshotModel.session.runtimeVisualSurfaceStatus === 'partial', 'Runtime Lens model should expose runtime visual surface status');
assert(snapshotModel.session.runtimeVisualAssetDraft && snapshotModel.session.runtimeVisualAssetDraft.status === 'proposal_only', 'Runtime Lens model should preserve runtime visual asset draft metadata');
assert(snapshotModel.session.runtimeVisualAssetDraftStatus === 'proposal_only', 'Runtime Lens model should expose runtime visual asset draft status');

const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_runtime_lens_source_'));
const sessionsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_runtime_lens_sessions_'));
fs.mkdirSync(path.join(sourceRoot, 'source', 'scenes', 'events'), {recursive: true});
fs.mkdirSync(path.join(sourceRoot, 'source', 'scenes', 'news'), {recursive: true});
fs.mkdirSync(path.join(sourceRoot, 'source', 'scenes', 'cards'), {recursive: true});
fs.mkdirSync(path.join(sourceRoot, 'source', 'scenes', 'decks'), {recursive: true});
fs.mkdirSync(path.join(sourceRoot, '.git'), {recursive: true});
fs.writeFileSync(path.join(sourceRoot, 'source', 'info.dry'), 'title: Runtime Lens Fixture\n', 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'source', 'scenes', 'root.scene.dry'), [
  'title: Root',
  '',
  '- @focus_event: Focus event',
  ''
].join('\n'), 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'source', 'scenes', 'events', 'focus_event.scene.dry'), [
  'title: Focused Event',
  'tags: event',
  '',
  'Original event text.',
  ''
].join('\n'), 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'source', 'scenes', 'news', 'focus_news.scene.dry'), [
  'title: Focused News',
  'tags: news',
  '',
  'Original news text.',
  ''
].join('\n'), 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'source', 'scenes', 'cards', 'focus_card.scene.dry'), [
  'title: Focused Card',
  'is-card: true',
  '',
  'Original card text.',
  ''
].join('\n'), 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'source', 'scenes', 'decks', 'starter_deck.scene.dry'), [
  'title: Starter Deck',
  'tags: deck',
  '',
  'Deck lane.',
  ''
].join('\n'), 'utf8');
fs.writeFileSync(path.join(sourceRoot, '.git', 'config'), 'must not copy\n', 'utf8');
fs.mkdirSync(path.join(sourceRoot, 'out', 'html'), {recursive: true});
fs.writeFileSync(path.join(sourceRoot, 'out', 'html', 'index.html'), '<!doctype html><title>Existing runtime</title>\n', 'utf8');

const quickLens = runtimeLens.createRuntimeLens({
  projectRoot: sourceRoot,
  sessionsRoot,
  projectIndex,
  focus: {kind: 'event', id: 'focus_event'},
  previewMode: 'quick',
  serverFactory: runtimePreview.fakeServerFactory(48110),
  now: () => new Date('2026-05-06T12:29:00.000Z')
});

assert(quickLens.ok, 'quick Runtime Lens should create a focused session from existing out/html: ' + JSON.stringify(quickLens));
assert(quickLens.previewMode === 'quick', 'quick Runtime Lens should preserve preview mode');
assert(quickLens.modifiedBuild && quickLens.modifiedBuild.skippedBuild === true, 'quick Runtime Lens should skip the full build');
assert(!quickLens.baselineBuild, 'quick Runtime Lens should not build a baseline copy');
assert(!fs.existsSync(path.join(quickLens.paths.modifiedRoot, 'source', 'info.dry')), 'quick Runtime Lens should not copy full project source');
assert(fs.existsSync(quickLens.lensPagePath), 'quick Runtime Lens should still write a focused wrapper page');

const quickNewsLens = runtimeLens.createRuntimeLens({
  projectRoot: sourceRoot,
  sessionsRoot,
  projectIndex,
  focus: {kind: 'news', id: 'focus_news'},
  previewMode: 'quick',
  serverFactory: runtimePreview.fakeServerFactory(48113),
  now: () => new Date('2026-05-06T12:29:30.000Z')
});
assert(quickNewsLens.ok, 'quick Runtime Lens should focus a news scene: ' + JSON.stringify(quickNewsLens));
assert(quickNewsLens.focus.targetSceneId === 'focus_news', 'quick news Runtime Lens should resolve a scene target');
assert(quickNewsLens.postLoadCommands.some((command) => command.type === 'jumpToScene' && command.sceneId === 'focus_news'), 'quick news Runtime Lens should queue a scene jump command');

const blockedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_runtime_lens_blocked_'));
fs.mkdirSync(path.join(blockedRoot, 'source'), {recursive: true});
fs.mkdirSync(path.join(blockedRoot, 'out', 'html'), {recursive: true});
fs.writeFileSync(path.join(blockedRoot, 'source', 'info.dry'), 'title: Blocked Fixture\n', 'utf8');
fs.writeFileSync(path.join(blockedRoot, 'out', 'html', 'index.html'), '<!doctype html><script src="core.js"></script>\n', 'utf8');
const blockedQuickPreview = runtimePreview.createQuickRuntimePreview({
  projectRoot: blockedRoot,
  sessionsRoot,
  serverFactory: runtimePreview.fakeServerFactory(48114),
  now: () => new Date('2026-05-06T12:29:45.000Z')
});
assert(!blockedQuickPreview.ok, 'quick runtime reuse should fail when generated runtime dependencies are missing');
assert(blockedQuickPreview.diagnostics.some((diag) => diag.code === 'runtime_surface.missing_script'), 'quick runtime reuse should report the missing generated dependency');
const fallbackLens = runtimeLens.createRuntimeLens({
  projectRoot: blockedRoot,
  sessionsRoot,
  projectIndex: {
    scenes: [{id: 'root', title: 'Root'}],
    semantic: {
      runtimeSurface: {
        readiness: {status: 'partial', quickPreviewReady: false, missingDependencyCount: 1},
        diagnostics: [
          {severity: 'error', code: 'runtime_surface.missing_script', message: 'Missing out/html/core.js', missingPath: 'out/html/core.js'}
        ],
        regions: []
      }
    }
  },
  focus: {kind: 'event', id: 'root'},
  previewMode: 'quick',
  buildRunner: htmlBuildRunner('runtime lens quick fallback build'),
  serverFactory: runtimePreview.fakeServerFactory(48114),
  now: () => new Date('2026-05-06T12:29:45.000Z')
});
assert(fallbackLens.ok, 'quick Runtime Lens should fall back to a temporary full build when generated runtime dependencies are missing: ' + JSON.stringify(fallbackLens));
assert(fallbackLens.quickFallback && fallbackLens.quickFallback.from === 'quick', 'quick Runtime Lens fallback should preserve the blocked quick diagnostics');
assert(fallbackLens.requestedPreviewMode === 'quick', 'quick Runtime Lens fallback should record the requested preview mode');
assert(fallbackLens.previewMode === 'full', 'quick Runtime Lens fallback should return the full build preview mode');
assert(!fallbackLens.baselineBuild, 'quick Runtime Lens fallback should use a modified-only full build');
assert(fallbackLens.modifiedBuild && fallbackLens.modifiedBuild.command === 'runtime lens quick fallback build', 'quick Runtime Lens fallback should use the full build runner');
assert(fallbackLens.diagnostics.some((diag) => diag.code === 'runtime_lens.quick_fallback_full_build'), 'quick Runtime Lens fallback should explain that it used a full build');
const blockedLens = runtimeLens.createRuntimeLens({
  projectRoot: blockedRoot,
  sessionsRoot,
  projectIndex: {
    scenes: [{id: 'root', title: 'Root'}],
    semantic: {
      runtimeSurface: {
        readiness: {status: 'partial', quickPreviewReady: false, missingDependencyCount: 1},
        diagnostics: [
          {severity: 'error', code: 'runtime_surface.missing_script', message: 'Missing out/html/core.js', missingPath: 'out/html/core.js'}
        ],
        regions: []
      }
    }
  },
  focus: {kind: 'event', id: 'root'},
  previewMode: 'quick',
  allowQuickFallback: false,
  serverFactory: runtimePreview.fakeServerFactory(48115),
  now: () => new Date('2026-05-06T12:29:46.000Z')
});
assert(!blockedLens.ok, 'quick Runtime Lens should still expose blocked status when fallback is disabled');
assert(blockedLens.status === 'blocked', 'quick Runtime Lens should surface blocked runtime health status: ' + JSON.stringify(blockedLens));
assert(blockedLens.runtimeSnapshot && blockedLens.runtimeSnapshot.status === 'blocked', 'blocked Runtime Lens should carry a runtimeSnapshot');
assert(blockedLens.runtimeDomMap && blockedLens.runtimeDomMap.status === 'blocked', 'blocked Runtime Lens should carry a blocked runtimeDomMap');
assert(blockedLens.runtimeVisualSurface && blockedLens.runtimeVisualSurface.status === 'blocked', 'blocked Runtime Lens should carry a blocked runtimeVisualSurface');
assert(blockedLens.lensModel.session.runtimeHealthStatus === 'blocked', 'blocked Runtime Lens model should expose blocked health');
assert(blockedLens.lensModel.session.runtimeDomMapStatus === 'blocked', 'blocked Runtime Lens model should expose blocked DOM map status');
assert(blockedLens.lensModel.session.runtimeVisualSurfaceStatus === 'blocked', 'blocked Runtime Lens model should expose blocked visual surface status');

const evidenceState = {
  runtimeLensSession: {ok: true, sessionId: 'evidence-session', status: 'ready'},
  runtimeLensStatus: 'ready',
  projectIndex: {semantic: {runtimeSurface: {regions: []}}}
};
let evidenceRenderCount = 0;
let evidencePatchCount = 0;
const evidenceHandled = runtimeLensWorkspaceState.handleEvidenceMessage(evidenceState, {
  kind: 'dms-runtime-lens-session-evidence',
  sessionId: 'evidence-session',
  runtimeSnapshot: {
    status: 'ready',
    document: {bodyPresent: true},
    summary: {indexedRegionCount: 1, visibleRegionCount: 1, choiceCount: 0},
    regions: []
  }
}, {
  render: () => {
    evidenceRenderCount += 1;
  },
  renderRuntimeLensEvidence: () => {
    evidencePatchCount += 1;
    return true;
  }
});
assert(evidenceHandled, 'Runtime Lens evidence message should be handled for the active session');
assert(evidencePatchCount === 1, 'Runtime Lens evidence should use the targeted panel updater when available');
assert(evidenceRenderCount === 0, 'Runtime Lens evidence should not force a full Object Canvas render when the targeted updater succeeds');

const fallbackEvidenceState = {
  runtimeLensSession: {ok: true, sessionId: 'fallback-evidence-session', status: 'ready'},
  runtimeLensStatus: 'ready',
  projectIndex: {semantic: {runtimeSurface: {regions: []}}}
};
let fallbackEvidenceRenderCount = 0;
runtimeLensWorkspaceState.handleEvidenceMessage(fallbackEvidenceState, {
  kind: 'dms-runtime-lens-session-evidence',
  sessionId: 'fallback-evidence-session',
  runtimeSnapshot: {
    status: 'ready',
    document: {bodyPresent: true},
    summary: {indexedRegionCount: 1, visibleRegionCount: 1, choiceCount: 0},
    regions: []
  }
}, {
  render: () => {
    fallbackEvidenceRenderCount += 1;
  }
});
assert(fallbackEvidenceRenderCount === 1, 'Runtime Lens evidence should fall back to a full render when no targeted updater exists');

const eventLens = runtimeLens.createRuntimeLens({
  projectRoot: sourceRoot,
  sessionsRoot,
  projectIndex,
  focus: {kind: 'event', id: 'focus_event'},
  buildRunner: htmlBuildRunner('runtime lens build'),
  serverFactory: runtimePreview.fakeServerFactory(48111),
  now: () => new Date('2026-05-06T12:30:00.000Z')
});

assert(eventLens.ok, 'event Runtime Lens should create a focused session: ' + JSON.stringify(eventLens));
assert(eventLens.kind === 'runtime_lens_session', 'Runtime Lens should return a lens session kind');
assert(eventLens.status === 'ready', 'Runtime Lens should report ready status');
assert(eventLens.lensUrl.includes('/lens/'), 'Runtime Lens primary URL should point at the focused wrapper page');
assert(eventLens.modifiedUrl.includes('/modified/out/html/'), 'Runtime Lens should retain the modified runtime URL');
assert(!eventLens.baselineBuild, 'Runtime Lens full build should skip the unused baseline lane');
assert(!eventLens.baselineUrl, 'Runtime Lens full build should not expose an unused baseline URL');
assert(eventLens.externalUrl === eventLens.lensUrl, 'Runtime Lens external URL should default to the focused wrapper page');
assert(fs.existsSync(eventLens.lensPagePath), 'Runtime Lens should write a focused wrapper page');
const lensPageHtml = fs.readFileSync(eventLens.lensPagePath, 'utf8');
assert(lensPageHtml.includes('Focused Runtime Lens'), 'Runtime Lens wrapper should identify the focused lens');
assert(lensPageHtml.includes('jumpToScene'), 'Runtime Lens wrapper should carry post-load focus commands');
assert(lensPageHtml.includes('getRuntimeSnapshot'), 'Runtime Lens wrapper should request a runtime snapshot after load');
assert(lensPageHtml.includes('data-lens-health'), 'Runtime Lens wrapper should render a health bar');
assert(lensPageHtml.includes('data-health-map'), 'Runtime Lens wrapper should render a DOM source map metric');
assert(lensPageHtml.includes('SOURCE_EVIDENCE'), 'Runtime Lens wrapper should carry a clipped source evidence packet');
assert(lensPageHtml.includes('/api/runtime-snapshot'), 'Runtime Lens wrapper should record the latest runtime snapshot');
assert(lensPageHtml.includes('dms-runtime-lens-session-evidence'), 'Runtime Lens wrapper should report snapshot evidence back to the viewer');
assert(lensPageHtml.includes('dms-runtime-lens-action'), 'Runtime Lens wrapper should accept parent focus/reset actions');
assert(lensPageHtml.includes('overflow:hidden;isolation:isolate'), 'Runtime Lens wrapper should isolate nested iframe painting');
assert(lensPageHtml.includes('--runtime-lens-frame-min-width:1280px'), 'Runtime Lens wrapper should keep a desktop-width runtime viewport for docked previews');
assert(lensPageHtml.includes('main{position:relative;z-index:1;min-width:0;min-height:0;overflow:auto;overscroll-behavior:contain;background:white;contain:paint}'), 'Runtime Lens wrapper main should let docked previews pan across wide runtime layouts');
assert(lensPageHtml.includes('iframe{display:block;width:100%;min-width:var(--runtime-lens-frame-min-width);height:100%;border:0;background:white;contain:paint}'), 'Runtime Lens wrapper iframe should paint as an opaque desktop-width contained layer');
assert(lensPageHtml.includes('var autoFocused=false'), 'Runtime Lens wrapper should track whether automatic focus already ran');
assert(lensPageHtml.includes('AUTO_COMMANDS.length&&!autoFocused'), 'Runtime Lens wrapper should not re-run automatic focus on every iframe load');
assert(lensPageHtml.includes('else captureSnapshot()'), 'Runtime Lens wrapper should capture evidence after follow-up iframe loads instead of focusing again');
assert(lensPageHtml.includes('data-lens-action="recapture"'), 'Runtime Lens wrapper should offer a manual re-capture control');
assert(lensPageHtml.includes('dms-runtime-preview-event'), 'Runtime Lens wrapper should listen for live runtime events from the bridge');
assert(lensPageHtml.includes('dom-changed'), 'Runtime Lens wrapper should re-capture when the runtime DOM changes');
assert(lensPageHtml.includes('scheduleCapture'), 'Runtime Lens wrapper should debounce live re-captures');
assert(lensPageHtml.includes('class="lens-content"'), 'Runtime Lens wrapper should host the runtime and Dev drawer in a shared content grid');
assert(lensPageHtml.includes('body.is-dev-open'), 'Runtime Lens wrapper should toggle the Dev drawer with a body class');
assert(lensPageHtml.includes('data-lens-action="toggle-dev"'), 'Runtime Lens wrapper should offer a Dev drawer toggle');
assert(lensPageHtml.includes('runtime-debug-console'), 'Runtime Lens wrapper should embed the focused Dev console');
assert(lensPageHtml.includes('data-debug-section="focus"'), 'Runtime Lens Dev console should lead with the relevant-to-this-event section');
assert(lensPageHtml.includes('data-runtime-debug-focus-vars'), 'Runtime Lens Dev console should reserve a slot for event-relevant variables');
assert(eventLens.focus.targetSceneId === 'focus_event', 'Runtime Lens should preserve focused scene target');
assert(eventLens.postLoadCommands.some((command) => command.type === 'jumpToScene' && command.sceneId === 'focus_event'), 'Runtime Lens should queue a scene jump command');
assert(eventLens.lensModel.commands.some((command) => command.type === 'focusScene'), 'Runtime Lens model should expose focusScene command');
assert(fs.existsSync(path.join(eventLens.paths.modifiedRoot, 'source', 'info.dry')), 'modified sandbox should include source/info.dry');
assert(!fs.existsSync(path.join(eventLens.paths.modifiedRoot, '.git', 'config')), 'Runtime Lens sandbox must not copy .git');
assert(fs.readFileSync(path.join(sourceRoot, 'source', 'scenes', 'events', 'focus_event.scene.dry'), 'utf8').includes('Original event text'), 'Runtime Lens must not mutate the real source project');

const cardLens = runtimeLens.createRuntimeLens({
  projectRoot: sourceRoot,
  sessionsRoot,
  projectIndex,
  focus: {kind: 'card', id: 'focus_card'},
  buildRunner: htmlBuildRunner('runtime lens card build'),
  serverFactory: runtimePreview.fakeServerFactory(48112),
  now: () => new Date('2026-05-06T12:31:00.000Z')
});
assert(cardLens.ok, 'card Runtime Lens should create a focused session: ' + JSON.stringify(cardLens));
assert(cardLens.focus.targetCardId === 'focus_card', 'card focus should preserve target card id');
assert(cardLens.postLoadCommands.some((command) => command.type === 'focusCard' && command.cardId === 'focus_card'), 'card Runtime Lens should queue a card focus command');

const missingRoot = runtimeLens.createRuntimeLens({
  projectRoot: path.join(sourceRoot, 'missing'),
  projectIndex,
  focus: {kind: 'event', id: 'focus_event'}
});
assert(!missingRoot.ok && missingRoot.status === 'failed', 'missing project root should fail safely');
assert(missingRoot.diagnostics.some((diag) => diag.code === 'runtime_lens.project_root'), 'missing project root should report a Runtime Lens diagnostic');

process.stdout.write(JSON.stringify({
  ok: true,
  eventLens: {
    status: eventLens.status,
    focus: eventLens.focus.targetSceneId,
    urlKind: eventLens.lensUrl.includes('/lens/') ? 'focused-wrapper' : 'unknown'
  },
  cardLens: {
    status: cardLens.status,
    focus: cardLens.focus.targetCardId,
    commands: cardLens.postLoadCommands.map((command) => command.type)
  }
}, null, 2) + '\n');
