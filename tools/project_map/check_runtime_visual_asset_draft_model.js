#!/usr/bin/env node
'use strict';

const assetDraftModel = require('./authoring/runtime_visual_asset_draft_model.js');

const {fail, assert} = require('./check_harness.js');

const projectIndex = {
  project: {name: 'Runtime Visual Asset Fixture', root: '/fixture'},
  scenes: [
    {
      id: 'focus_event',
      title: 'Focused Event',
      type: 'event',
      path: 'source/scenes/events/focus_event.scene.dry',
      sourceSpan: {path: 'source/scenes/events/focus_event.scene.dry', line: 1},
      assetRefs: [
        {
          path: 'img/hero.png',
          type: 'image',
          directive: 'face-image',
          source: {path: 'source/scenes/events/focus_event.scene.dry', line: 12},
          fileExists: true
        },
        {
          path: 'img/background.jpg',
          type: 'image',
          directive: 'set-bg',
          source: {path: 'source/scenes/events/focus_event.scene.dry', line: 13},
          fileExists: true
        },
        {
          path: 'music/theme.ogg',
          type: 'audio',
          directive: 'audio',
          source: {path: 'source/scenes/events/focus_event.scene.dry', line: 14},
          fileExists: true
        },
        {
          path: 'img/custom.png',
          type: 'image',
          directive: 'inline-image',
          source: {path: 'source/scenes/events/focus_event.scene.dry', line: 18},
          fileExists: true
        }
      ]
    },
    {
      id: 'focus_card',
      title: 'Focused Card',
      type: 'card',
      path: 'source/scenes/cards/focus_card.scene.dry',
      sourceSpan: {path: 'source/scenes/cards/focus_card.scene.dry', line: 1},
      assetRefs: [
        {
          path: 'img/card.png',
          type: 'image',
          directive: 'card-image',
          source: {path: 'source/scenes/cards/focus_card.scene.dry', line: 9},
          fileExists: true
        }
      ]
    }
  ],
  semantic: {
    cards: [{id: 'focus_card'}],
    assets: {
      items: [
        {
          id: 'hero',
          type: 'image',
          path: 'out/html/img/hero.png',
          previewUrl: 'out/html/img/hero.png',
          usageRefs: [
            {sceneId: 'focus_event', role: 'face-image', source: {path: 'source/scenes/events/focus_event.scene.dry', line: 12}}
          ]
        }
      ]
    }
  }
};

function candidate(overrides) {
  return Object.assign({
    id: 'portrait',
    role: 'portrait_image',
    selector: '.face-img',
    src: 'http://127.0.0.1/out/html/img/hero.png',
    sceneId: 'focus_event',
    source: {path: 'source/scenes/events/focus_event.scene.dry', line: 12},
    confidence: 'strong',
    editability: 'proposal_only'
  }, overrides || {});
}

const proposalOnly = assetDraftModel.buildAssetDraft({
  projectIndex,
  candidate: candidate()
});
assert(proposalOnly.status === 'proposal_only', 'missing replacement file should create a proposal-only asset draft');
assert(proposalOnly.currentAsset.path === 'img/hero.png', 'draft should prefer source directive asset path');
assert(proposalOnly.replacementAsset.path === 'assets/studio/events/focus_event/hero.png', 'event image target path should use assets/studio/events');
assert(proposalOnly.draft && proposalOnly.draft.kind === 'existing_scene_edit', 'asset draft should produce an existing_scene_edit proposal');
assert(proposalOnly.draft.changes[0].before === 'face-image: img/hero.png', 'draft should replace the exact current directive text');
assert(proposalOnly.draft.changes[0].after === 'face-image: assets/studio/events/focus_event/hero.png', 'draft should propose the replacement directive text');
assert(proposalOnly.installPlan && proposalOnly.installPlan.operations.length === 2, 'asset draft install plan should include source replacement and asset copy proposal');
assert(proposalOnly.installPlan.operations.some((op) => op.type === 'copy_asset_file' && op.safety === 'manual_review'), 'missing replacement file should keep copy_asset_file manual');
assert(proposalOnly.diagnostics.some((diag) => diag.code === 'runtime_visual_asset_draft.replacement_file_missing'), 'missing replacement file should be diagnosed');

const withFile = assetDraftModel.buildAssetDraft({
  projectIndex,
  candidate: candidate(),
  replacementFile: {
    name: 'new-portrait.webp',
    sourcePath: '/Users/example/Pictures/new-portrait.webp',
    size: 12345,
    lastModified: 1760000000000
  }
});
assert(withFile.status === 'ready', 'replacement file metadata should make the asset draft ready');
assert(withFile.replacementAsset.path === 'assets/studio/events/focus_event/new-portrait.webp', 'replacement source name should drive target path');
assert(withFile.installPlan.operations.some((op) => op.type === 'replace_text' && op.safety === 'guarded_apply'), 'source directive replacement should be guarded');
assert(withFile.installPlan.operations.some((op) => op.type === 'copy_asset_file' && op.safety === 'guarded_apply' && op.sourcePath.includes('new-portrait.webp')), 'replacement file should create guarded copy_asset_file');

const cardDraft = assetDraftModel.buildAssetDraft({
  projectIndex,
  candidate: candidate({
    id: 'card_img',
    role: 'card_image',
    src: 'http://127.0.0.1/out/html/img/card.png',
    sceneId: 'focus_card',
    source: {path: 'source/scenes/cards/focus_card.scene.dry', line: 9}
  }),
  replacementFile: {name: 'new-card.png', sourcePath: '/tmp/new-card.png'}
});
assert(cardDraft.owner.sceneKind === 'card', 'card asset draft should detect card owner');
assert(cardDraft.replacementAsset.path === 'assets/studio/cards/focus_card/new-card.png', 'card image target path should use assets/studio/cards');
assert(cardDraft.draft.sceneKind === 'card', 'card asset draft should load as card existing scene edit');

const backgroundDraft = assetDraftModel.buildAssetDraft({
  projectIndex,
  candidate: candidate({
    id: 'background',
    role: 'background',
    src: 'http://127.0.0.1/out/html/img/background.jpg',
    source: {path: 'source/scenes/events/focus_event.scene.dry', line: 13}
  })
});
assert(backgroundDraft.draft.changes[0].before === 'set-bg: img/background.jpg', 'set-bg should produce a background replacement proposal');

const audioDraft = assetDraftModel.buildAssetDraft({
  projectIndex,
  candidate: candidate({
    id: 'audio',
    role: 'audio',
    src: 'http://127.0.0.1/out/html/music/theme.ogg',
    source: {path: 'source/scenes/events/focus_event.scene.dry', line: 14}
  }),
  replacementFile: {name: 'new-theme.ogg', sourcePath: '/tmp/new-theme.ogg'}
});
assert(audioDraft.replacementAsset.path === 'assets/studio/shared/focus_event/new-theme.ogg', 'audio target path should use assets/studio/shared');

const generated = assetDraftModel.buildAssetDraft({
  projectIndex,
  candidate: candidate({source: {path: 'out/html/game.js', line: 10}})
});
assert(generated.status === 'blocked', 'generated runtime source should be blocked');
assert(generated.diagnostics.some((diag) => diag.code === 'runtime_visual_asset_draft.generated_runtime_output'), 'generated source should produce diagnostic');

const weak = assetDraftModel.buildAssetDraft({
  projectIndex,
  candidate: candidate({confidence: 'weak'})
});
assert(weak.status === 'manual_review', 'weak asset mapping should remain manual review');

const ambiguous = assetDraftModel.buildAssetDraft({
  projectIndex,
  candidate: candidate({reason: 'ambiguous: multiple source rows'})
});
assert(ambiguous.status === 'manual_review', 'ambiguous asset mapping should remain manual review');
assert(ambiguous.diagnostics.some((diag) => diag.code === 'runtime_visual_asset_draft.ambiguous_asset_source'), 'ambiguous asset should be diagnosed');

const unsupported = assetDraftModel.buildAssetDraft({
  projectIndex,
  candidate: candidate({
    id: 'custom',
    role: 'inline_image',
    src: 'http://127.0.0.1/out/html/img/custom.png',
    source: {path: 'source/scenes/events/focus_event.scene.dry', line: 18}
  })
});
assert(unsupported.status === 'manual_review', 'custom/inline image source should stay manual review');
assert(unsupported.diagnostics.some((diag) => diag.code === 'runtime_visual_asset_draft.unsupported_asset_directive'), 'unsupported directive should be diagnosed');

process.stdout.write(JSON.stringify({
  ok: true,
  proposalOnly: proposalOnly.status,
  ready: withFile.status,
  cardTarget: cardDraft.replacementAsset.path,
  audioTarget: audioDraft.replacementAsset.path
}, null, 2) + '\n');
