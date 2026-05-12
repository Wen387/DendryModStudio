#!/usr/bin/env node
'use strict';

const snapshotModel = require('./authoring/runtime_snapshot_model.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const runtimeSurface = {
  readiness: {
    status: 'ready',
    quickPreviewReady: true,
    missingDependencyCount: 0
  },
  regions: [
    {id: 'content', role: 'content', selector: '#content', label: 'Story content'},
    {id: 'choices', role: 'choices', selector: 'ul.choices', label: 'Choices'},
    {id: 'left_sidebar', role: 'left_sidebar', selector: '#stats_sidebar', label: 'Left sidebar'}
  ],
  cssVariables: [{name: '--accent'}],
  diagnostics: []
};

const readySnapshot = snapshotModel.buildSnapshot({
  runtimeSurface,
  snapshot: {
    capturedAt: '2026-05-12T12:00:00.000Z',
    document: {readyState: 'complete', title: 'Fixture', bodyPresent: true},
    state: {exportable: true, sceneId: 'root', qualityCount: 5},
    regions: [
      {selector: '#content', role: 'content', found: true, visible: true, text: 'Story text', box: {x: 1, y: 2, width: 300, height: 120}, samples: [{selector: '#content p', role: 'content', tag: 'p', text: 'Story text', visible: true}]},
      {selector: 'ul.choices', role: 'choices', found: true, visible: true, text: 'Choose', textCount: 2, elementCount: 2},
      {selector: '#stats_sidebar', role: 'left_sidebar', found: true, visible: true, text: 'Status'}
    ],
    assets: {
      images: {total: 2, loaded: 2, error: 0, missing: 0, items: [{src: 'img/a.png', loaded: true}, {src: 'img/b.png', loaded: true}]},
      audio: {total: 1, loaded: 1, error: 0, missing: 0}
    },
    graphics: {d3Present: true, svgCount: 1, svgNonEmptyCount: 1, canvasCount: 0},
    runtimeDomMap: {
      status: 'partial',
      summary: {visibleCount: 2, mappedCount: 2, sourceBackedCount: 1, manualReviewCount: 1},
      items: [
        {role: 'content', selector: '#content p', text: 'Story text', source: {path: 'source/scenes/root.scene.dry', line: 8}, confidence: 'strong', editability: 'text_proposal'},
        {role: 'd3_chart', selector: 'svg', text: 'Chart', source: {path: 'source/scenes/root.scene.dry', line: 40}, confidence: 'weak', editability: 'manual_review'}
      ]
    }
  }
});

assert(readySnapshot.kind === 'runtime_snapshot', 'snapshot model should emit runtime_snapshot kind');
assert(readySnapshot.status === 'ready', 'complete runtime evidence should be ready: ' + JSON.stringify(readySnapshot));
assert(readySnapshot.summary.loaded === true, 'ready snapshot should report loaded document');
assert(readySnapshot.summary.focused === true, 'ready snapshot should report focused scene state');
assert(readySnapshot.summary.visibleRegionCount === 3, 'ready snapshot should count visible indexed regions');
assert(readySnapshot.summary.choiceCount === 2, 'ready snapshot should preserve choice evidence');
assert(readySnapshot.graphics.d3Present === true, 'ready snapshot should preserve D3 evidence');
assert(readySnapshot.regions[0].samples.length === 1, 'ready snapshot should preserve clipped region samples');
assert(readySnapshot.runtimeDomMap.status === 'partial', 'ready snapshot should preserve normalized runtime DOM map');
assert(readySnapshot.summary.runtimeDomMappedCount === 2, 'snapshot summary should expose DOM map mapped count');
assert(readySnapshot.summary.runtimeDomSourceBackedCount === 1, 'snapshot summary should expose source-backed DOM map count');
assert(readySnapshot.summary.runtimeDomManualReviewCount === 1, 'snapshot summary should expose manual-review DOM map count');

const partialSnapshot = snapshotModel.buildSnapshot({
  runtimeSurface,
  snapshot: {
    document: {readyState: 'complete', title: 'Fixture', bodyPresent: true},
    state: {exportable: false},
    regions: [
      {selector: '#content', role: 'content', found: true, visible: false, text: 'Hidden story'}
    ],
    graphics: {}
  }
});
assert(partialSnapshot.status === 'partial', 'state/visibility gaps should produce partial status: ' + JSON.stringify(partialSnapshot));
assert(partialSnapshot.diagnostics.some((diag) => diag.code === 'runtime_snapshot.state_unavailable'), 'partial snapshot should explain missing exportable state');
assert(partialSnapshot.summary.missingRegionCount === 2, 'partial snapshot should count missing indexed regions');

const blockedSnapshot = snapshotModel.buildSnapshot({
  runtimeSurface: {
    readiness: {status: 'partial', quickPreviewReady: false, missingDependencyCount: 2},
    diagnostics: [
      {severity: 'error', code: 'runtime_surface.missing_script', message: 'Missing out/html/core.js', missingPath: 'out/html/core.js'}
    ],
    regions: []
  },
  snapshot: {}
});
assert(blockedSnapshot.status === 'blocked', 'missing runtime dependencies should block snapshots');
assert(blockedSnapshot.diagnostics.some((diag) => diag.code === 'runtime_surface.missing_script'), 'blocked snapshot should preserve missing dependency diagnostic');
assert(blockedSnapshot.diagnostics.some((diag) => diag.code === 'runtime_snapshot.blocked_by_readiness'), 'blocked snapshot should add a readiness blocker diagnostic');

const clippedSnapshot = snapshotModel.buildSnapshot({
  runtimeSurface,
  limits: {regions: 1, text: 12, diagnostics: 2},
  snapshot: {
    document: {readyState: 'complete', bodyPresent: true},
    state: {exportable: true, sceneId: 'root'},
    regions: [
      {selector: '#content', role: 'content', found: true, visible: true, text: 'This is deliberately long text.'},
      {selector: 'ul.choices', role: 'choices', found: true, visible: true, text: 'Choice'}
    ],
    diagnostics: [
      {severity: 'warning', code: 'fixture.one', message: 'One'},
      {severity: 'warning', code: 'fixture.two', message: 'Two'},
      {severity: 'warning', code: 'fixture.three', message: 'Three'}
    ]
  }
});
assert(clippedSnapshot.regions.length === 1, 'snapshot model should enforce region limits');
assert(clippedSnapshot.regions[0].text.length <= 12, 'snapshot model should clip long region text');
assert(clippedSnapshot.diagnostics.length === 2, 'snapshot model should enforce diagnostic limits');

process.stdout.write(JSON.stringify({
  ok: true,
  statuses: [readySnapshot.status, partialSnapshot.status, blockedSnapshot.status],
  readySummary: readySnapshot.summary
}, null, 2) + '\n');
