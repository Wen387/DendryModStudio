#!/usr/bin/env node
'use strict';

const domMapModel = require('./authoring/runtime_dom_map_model.js');

const {fail, assert} = require('./check_harness.js');

const projectIndex = {
  project: {name: 'Fixture'},
  scenes: [
    {
      id: 'labor_law_crisis',
      title: 'Labor Law Crisis',
      type: 'event',
      path: 'source/scenes/events/labor_law.scene.dry',
      sourceSpan: {path: 'source/scenes/events/labor_law.scene.dry', startLine: 1, endLine: 80},
      options: [
        {id: '@negotiate', title: 'Negotiate with the unions', sourceSpan: {path: 'source/scenes/events/labor_law.scene.dry', startLine: 42, endLine: 42}},
        {id: '@strikebreak', title: 'Send the police', sourceSpan: {path: 'source/scenes/events/labor_law.scene.dry', startLine: 43, endLine: 43}}
      ],
      sections: [
        {
          id: 'labor_law_crisis.main',
          title: 'Main',
          sourceSpan: {path: 'source/scenes/events/labor_law.scene.dry', startLine: 10, endLine: 50},
          options: []
        }
      ],
      assetRefs: [
        {path: 'img/events/labor.png', directive: 'face-image', source: {path: 'source/scenes/events/labor_law.scene.dry', line: 4}}
      ]
    }
  ],
  semantic: {
    textCorpus: {
      items: [
        {
          id: 'text-body',
          role: 'body',
          text: 'The Labor Law crisis now dominates the cabinet meeting.',
          owner: {sceneId: 'labor_law_crisis'},
          source: {path: 'source/scenes/events/labor_law.scene.dry', line: 12, startLine: 12, endLine: 14},
          editability: 'text_proposal'
        },
        {
          id: 'text-choice',
          role: 'option_label',
          text: 'Negotiate with the unions',
          owner: {sceneId: 'labor_law_crisis'},
          optionId: '@negotiate',
          source: {path: 'source/scenes/events/labor_law.scene.dry', line: 42},
          editability: 'draft_extractable'
        },
        {
          id: 'text-sidebar',
          role: 'surface_label',
          text: 'Emergency Status',
          owner: {sceneId: ''},
          source: {path: 'source/qdisplays/main.qdisplay.dry', line: 8},
          editability: 'draft_exportable'
        }
      ]
    },
    assets: {
      items: [
        {
          id: 'labor-png',
          name: 'labor.png',
          path: 'img/events/labor.png',
          previewUrl: 'out/html/img/events/labor.png',
          type: 'image',
          source: {path: 'img/events/labor.png'},
          editability: 'reference_only',
          usageRefs: [
            {id: 'labor_law_crisis', sceneId: 'labor_law_crisis', role: 'face-image', source: {path: 'source/scenes/events/labor_law.scene.dry', line: 4}}
          ]
        }
      ]
    },
    runtimeSurface: {
      regions: [
        {id: 'content', role: 'content', selector: '#content', source: {path: 'out/html/index.html', line: 320}},
        {id: 'choices', role: 'choices', selector: 'ul.choices', source: {path: 'out/html/game.css', line: 90}},
        {id: 'portrait', role: 'portrait_image', selector: '.face-img', source: {path: 'out/html/game.css', line: 120}}
      ],
      controls: []
    }
  }
};

const runtimeSurface = projectIndex.semantic.runtimeSurface;
const runtimeSnapshot = {
  status: 'ready',
  capturedAt: '2026-05-12T15:00:00.000Z',
  state: {exportable: true, sceneId: 'labor_law_crisis', qualityCount: 3},
  regions: [
    {
      id: 'content',
      role: 'content',
      selector: '#content',
      visible: true,
      source: {path: 'out/html/index.html', line: 320},
      samples: [
        {index: 0, selector: '#content > p:nth-of-type(1)', role: 'content', tag: 'p', text: 'The Labor Law crisis now dominates the cabinet meeting.', visible: true, box: {width: 300, height: 80}},
        {index: 1, selector: '#content [data-fixture]', role: 'content', tag: 'span', text: 'Dataset mapped', visible: true, dataset: {dmsSceneId: 'labor_law_crisis', dmsSourcePath: 'source/scenes/events/labor_law.scene.dry', dmsSourceLine: '20'}}
      ]
    },
    {
      id: 'choices',
      role: 'choices',
      selector: 'ul.choices',
      visible: true,
      samples: [
        {index: 0, selector: 'ul.choices > li:nth-of-type(1)', role: 'choices', tag: 'li', text: 'Negotiate with the unions', visible: true, box: {width: 240, height: 32}}
      ]
    },
    {
      id: 'portrait',
      role: 'portrait_image',
      selector: '.face-img',
      visible: true,
      samples: [
        {index: 0, selector: '.face-img', role: 'portrait_image', tag: 'img', src: 'http://127.0.0.1/out/html/img/events/labor.png', currentSrc: 'out/html/img/events/labor.png', visible: true, box: {width: 100, height: 100}}
      ]
    },
    {
      id: 'chart',
      role: 'd3_chart',
      selector: 'svg',
      visible: true,
      samples: [
        {index: 0, selector: 'svg', role: 'd3_chart', tag: 'svg', text: 'SPD 153 seats', visible: true, box: {width: 200, height: 90}}
      ]
    }
  ],
  diagnostics: []
};

const sourceEvidence = domMapModel.buildSourceEvidence(projectIndex, {
  focus: {targetSceneId: 'labor_law_crisis'},
  runtimeSurface
});
assert(sourceEvidence.kind === 'runtime_dom_source_evidence', 'source evidence should have a stable kind');
assert(sourceEvidence.scenes.length === 1, 'source evidence should include the focused scene');
assert(sourceEvidence.textCorpus.some((item) => item.id === 'text-body'), 'source evidence should include focused text corpus');
assert(sourceEvidence.assets.some((item) => item.id === 'labor-png'), 'source evidence should include focused asset usage');

const domMap = domMapModel.buildDomMap({
  projectIndex,
  runtimeSurface,
  runtimeSnapshot,
  focus: {targetSceneId: 'labor_law_crisis'}
});
assert(domMap.kind === 'runtime_dom_map', 'dom map should have a stable kind');
assert(domMap.status === 'partial', 'mixed exact/strong/weak evidence should be partial because graphics need manual review');
assert(domMap.summary.visibleCount === 5, 'dom map should count visible samples');
assert(domMap.summary.mappedCount >= 4, 'dom map should map most fixture samples');
assert(domMap.summary.sourceBackedCount >= 3, 'dom map should count source-backed mappings');
assert(domMap.summary.manualReviewCount >= 1, 'dom map should count manual-review mappings');
assert(domMap.items.some((item) => item.text === 'Dataset mapped' && item.confidence === 'exact'), 'dataset breadcrumbs should map exactly');
assert(domMap.items.some((item) => item.role === 'content' && item.confidence === 'strong'), 'content text should map through text corpus');
assert(domMap.items.some((item) => item.role === 'choices' && item.confidence === 'exact'), 'unique choice label should map exactly');
assert(domMap.items.some((item) => item.src && item.confidence === 'strong'), 'asset src should map through asset usage');
assert(domMap.items.some((item) => item.role === 'd3_chart' && item.confidence === 'weak'), 'graphics should fall back to weak scene evidence');

const ambiguous = domMapModel.buildDomMap({
  sourceEvidence: {
    ready: true,
    scenes: sourceEvidence.scenes,
    textCorpus: [
      sourceEvidence.textCorpus.find((item) => item.id === 'text-body'),
      Object.assign({}, sourceEvidence.textCorpus.find((item) => item.id === 'text-body'), {
        id: 'text-body-copy',
        source: {path: 'source/scenes/events/labor_law_duplicate.scene.dry', line: 12}
      })
    ],
    assets: [],
    runtimeSurface
  },
  runtimeSurface,
  runtimeSnapshot: {
    status: 'ready',
    state: {sceneId: 'labor_law_crisis'},
    regions: [
      {role: 'content', selector: '#content', visible: true, samples: [{role: 'content', selector: '#content p', text: 'The Labor Law crisis now dominates the cabinet meeting.', visible: true}]}
    ]
  }
});
assert(ambiguous.diagnostics.some((diag) => diag.code === 'runtime_dom_map.ambiguous_source'), 'ambiguous text matches should be diagnosed');
assert(ambiguous.items[0].confidence === 'manual_review', 'ambiguous text should require manual review');

const blocked = domMapModel.buildDomMap({
  runtimeSurface: {
    readiness: {quickPreviewReady: false, missingDependencyCount: 2},
    diagnostics: [{severity: 'error', code: 'runtime_surface.missing_script', message: 'Missing out/html/core.js', missingPath: 'out/html/core.js'}]
  },
  runtimeSnapshot: {
    status: 'blocked',
    diagnostics: [{severity: 'error', code: 'runtime_snapshot.blocked_by_readiness', message: 'Blocked'}]
  }
});
assert(blocked.status === 'blocked', 'blocked snapshot should block DOM source map');
assert(blocked.diagnostics.some((diag) => diag.code === 'runtime_surface.missing_script'), 'blocked map should preserve readiness diagnostics');
assert(blocked.diagnostics.some((diag) => diag.code === 'runtime_dom_map.blocked_by_snapshot'), 'blocked map should explain snapshot dependency');

const clipped = domMapModel.buildDomMap({
  sourceEvidence,
  runtimeSurface,
  limits: {items: 1, text: 20, diagnostics: 2},
  runtimeSnapshot: {
    status: 'ready',
    state: {sceneId: 'labor_law_crisis'},
    regions: [
      {role: 'content', selector: '#content', visible: true, samples: [
        {role: 'content', selector: '#content p', text: 'The Labor Law crisis now dominates the cabinet meeting with deliberately long prose.', visible: true},
        {role: 'choices', selector: 'ul.choices li', text: 'Negotiate with the unions', visible: true}
      ]}
    ],
    diagnostics: [
      {severity: 'warning', code: 'one', message: 'One'},
      {severity: 'warning', code: 'two', message: 'Two'},
      {severity: 'warning', code: 'three', message: 'Three'}
    ]
  }
});
assert(clipped.items.length === 1, 'dom map should enforce item limits');
assert(clipped.items[0].text.length <= 20, 'dom map should clip long item text');
assert(clipped.diagnostics.length === 2, 'dom map should enforce diagnostic limits');

process.stdout.write(JSON.stringify({
  ok: true,
  status: domMap.status,
  summary: domMap.summary,
  blockedStatus: blocked.status
}, null, 2) + '\n');
