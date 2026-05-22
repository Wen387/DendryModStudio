#!/usr/bin/env node
'use strict';

global.ProjectMapEditCapability = {
  buildEditCapability(_index, view, item) {
    if (view === 'textCorpus' && item && item.id === 'body_text') {
      return {
        routeClass: 'direct_field_replace',
        installSafety: 'guarded_apply',
        reason: 'Text maps to an editable source field.',
        target: {view: 'events', sceneId: 'focus_event', valueKey: item.id, source: item.source}
      };
    }
    if (view === 'surfaceText' && item && item.id === 'surface_label') {
      return {
        routeClass: 'system_ui_workspace',
        installSafety: 'guarded_apply',
        reason: 'Surface label maps to System UI.',
        target: {template: 'entry', itemId: item.id, source: item.source}
      };
    }
    if (view === 'scenes' && item && item.id === 'focus_event') {
      return {
        routeClass: 'object_workspace',
        installSafety: 'guarded_apply',
        reason: 'Open owning object workspace.',
        target: {view: 'events', sceneId: item.id, source: item.sourceSpan}
      };
    }
    return {
      routeClass: 'manual_review',
      installSafety: 'manual_review',
      reason: 'No editable route in fixture.',
      target: {}
    };
  },
  routeActionLabel(routeClass) {
    return routeClass === 'system_ui_workspace' ? 'Open System UI workspace' : 'Open object editor';
  }
};

const visualSurface = require('./authoring/runtime_visual_surface_model.js');

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
      id: 'focus_event',
      title: 'Focused Event',
      type: 'event',
      path: 'source/scenes/events/focus_event.scene.dry',
      sourceSpan: {path: 'source/scenes/events/focus_event.scene.dry', line: 1}
    }
  ],
  semantic: {
    events: [{id: 'focus_event'}],
    textCorpus: {
      items: [
        {
          id: 'body_text',
          role: 'body',
          text: 'Public runtime prose',
          owner: {sceneId: 'focus_event'},
          source: {path: 'source/scenes/events/focus_event.scene.dry', line: 8},
          editability: 'text_proposal'
        }
      ]
    },
    surfaceText: {
      items: [
        {
          id: 'surface_label',
          role: 'surface_label',
          label: 'Start',
          text: 'Start',
          source: {path: 'source/scenes/root.scene.dry', line: 4},
          editability: 'draft_exportable'
        }
      ]
    },
    assets: {
      items: [
        {
          id: 'hero_portrait',
          type: 'image',
          path: 'img/hero.png',
          editability: 'reference_only',
          usageRefs: [
            {sceneId: 'focus_event', role: 'portrait', source: {path: 'source/scenes/events/focus_event.scene.dry', line: 12}}
          ]
        }
      ]
    }
  }
};

const blocked = visualSurface.buildVisualSurface({
  projectIndex,
  runtimeSnapshot: {status: 'blocked', diagnostics: [{severity: 'error', code: 'runtime_surface.missing_script', message: 'Missing out/html/core.js'}]},
  runtimeDomMap: {status: 'blocked', diagnostics: [{severity: 'error', code: 'runtime_dom_map.blocked_by_snapshot', message: 'Blocked'}]}
});
assert(blocked.status === 'blocked', 'blocked snapshot/dom map should block visual surface authoring');
assert(blocked.diagnostics.some((diag) => diag.code === 'runtime_visual_surface.blocked_by_dom_map'), 'blocked visual surface should explain DOM map blocker');

const draftable = visualSurface.buildVisualSurface({
  projectIndex,
  runtimeSnapshot: {status: 'ready'},
  runtimeDomMap: {
    status: 'ready',
    items: [
      {
        id: 'content_1',
        role: 'content',
        selector: '#content p',
        text: 'Public runtime prose',
        sceneId: 'focus_event',
        source: {path: 'source/scenes/events/focus_event.scene.dry', line: 8},
        confidence: 'strong',
        editability: 'text_proposal'
      }
    ]
  }
});
assert(draftable.summary.draftableCount === 1, 'strong source-backed text should become draftable');
assert(draftable.candidates[0].action.enabled === true, 'draftable text should expose an open_route action');
assert(draftable.candidates[0].routeClass === 'direct_field_replace', 'draftable text should preserve edit capability route');
assert(draftable.candidates[0].runtimeEvidenceState === 'source_backed', 'draftable text should classify as source-backed System UI evidence');
assert(draftable.summary.sourceBackedRuntimeCount === 1, 'runtime summary should count source-backed evidence');

const generated = visualSurface.buildVisualSurface({
  projectIndex,
  runtimeSnapshot: {status: 'ready'},
  runtimeDomMap: {
    status: 'partial',
    items: [
      {id: 'generated_css', role: 'theme', text: 'Dark mode', source: {path: 'out/html/game.css', line: 20}, confidence: 'strong'}
    ]
  }
});
assert(generated.candidates[0].editability === 'generated_only', 'generated out/html source should be generated-only');
assert(generated.candidates[0].runtimeEvidenceState === 'generated_only', 'generated out/html source should classify as generated-only runtime evidence');
assert(generated.summary.generatedOnlyRuntimeCount === 1, 'runtime summary should count generated-only System UI evidence');
assert(generated.diagnostics.some((diag) => diag.code === 'runtime_visual_surface.generated_runtime_output'), 'generated source should produce a diagnostic');

const weakGraphic = visualSurface.buildVisualSurface({
  projectIndex,
  runtimeSnapshot: {status: 'ready'},
  runtimeDomMap: {
    status: 'partial',
    items: [
      {id: 'chart', role: 'd3_chart', selector: 'svg', text: '', source: {path: 'source/scenes/events/focus_event.scene.dry', line: 30}, confidence: 'weak'}
    ]
  }
});
assert(weakGraphic.candidates[0].editability === 'manual_review', 'weak D3/custom visual evidence should stay manual review');
assert(weakGraphic.candidates[0].runtimeEvidenceState === 'ambiguous', 'weak D3/custom visual evidence should be ambiguous runtime evidence');

const ambiguous = visualSurface.buildVisualSurface({
  projectIndex: {
    semantic: {
      textCorpus: {
        items: [
          {id: 'a', text: 'Same copy', source: {path: 'source/scenes/events/focus_event.scene.dry', line: 8}},
          {id: 'b', text: 'Same copy', source: {path: 'source/scenes/events/focus_event.scene.dry', line: 8}}
        ]
      }
    }
  },
  runtimeSnapshot: {status: 'ready'},
  runtimeDomMap: {
    status: 'partial',
    items: [
      {id: 'same', role: 'content', text: 'Same copy', source: {path: 'source/scenes/events/focus_event.scene.dry', line: 8}, confidence: 'strong'}
    ]
  }
});
assert(ambiguous.candidates[0].editability === 'manual_review', 'ambiguous source matches should not become draftable');
assert(ambiguous.candidates[0].runtimeEvidenceState === 'ambiguous', 'ambiguous source matches should expose ambiguous runtime evidence');
assert(ambiguous.diagnostics.some((diag) => diag.code === 'runtime_visual_surface.ambiguous_candidate'), 'ambiguous source should produce diagnostic');

const asset = visualSurface.buildVisualSurface({
  projectIndex,
  runtimeSnapshot: {status: 'ready'},
  runtimeDomMap: {
    status: 'ready',
    items: [
      {
        id: 'portrait',
        role: 'portrait_image',
        selector: '.face-img',
        src: 'http://127.0.0.1/img/hero.png',
        sceneId: 'focus_event',
        source: {path: 'source/scenes/events/focus_event.scene.dry', line: 12},
        confidence: 'strong',
        editability: 'reference_only'
      }
    ]
  }
});
assert(asset.candidates[0].editability === 'proposal_only', 'asset candidate should not claim automatic replacement');
assert(asset.candidates[0].runtimeEvidenceState === 'source_backed', 'source-backed asset evidence should stay source-backed while proposal-only');
assert(asset.candidates[0].action.enabled === true, 'asset candidate should still open the owning workspace when routed');
assert(asset.candidates[0].actions.some((action) => action.type === 'open_route' && action.enabled === true), 'asset candidate should retain an open route action');
assert(asset.candidates[0].actions.some((action) => action.type === 'create_asset_reference_draft' && action.enabled === true), 'asset candidate should expose an asset reference draft action');
assert(asset.candidates[0].assetDraftStatus === 'proposal_only', 'asset candidate should summarize asset draft readiness');
assert(asset.diagnostics.length === 0, 'routed asset candidate should not emit a warning');

process.stdout.write(JSON.stringify({
  ok: true,
  draftable: draftable.summary.draftableCount,
  generated: generated.summary.generatedOnlyCount,
  manual: weakGraphic.summary.manualReviewCount,
  asset: asset.candidates[0].editability,
  runtimeStates: draftable.summary.sourceBackedRuntimeCount + generated.summary.generatedOnlyRuntimeCount + weakGraphic.summary.ambiguousRuntimeCount
}, null, 2) + '\n');
