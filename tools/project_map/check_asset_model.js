#!/usr/bin/env node
'use strict';

const viewer = require('./viewer/app.js');
const assetModel = require('./authoring/asset_model.js');
const previewModel = require('./authoring/preview_model.js');
const {readExploreBundle} = require('./check_viewer_assets.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const index = {
  schemaVersion: '0.1',
  project: {name: 'asset-fixture', root: '/tmp/asset-fixture', profileIds: ['generic-dendry']},
  profiles: [],
  scenes: [],
  edges: [],
  variables: [],
  diagnostics: [],
  semantic: {
    events: [
      {
        id: 'asset_event',
        title: 'Asset Event',
        path: 'source/scenes/events/asset_event.scene.dry',
        assetRefs: [{path: 'assets/radio/radio-icon.svg', type: 'image'}]
      }
    ],
    cards: [
      {
        id: 'asset_card',
        title: 'Asset Card',
        path: 'source/scenes/cards/asset_card.scene.dry',
        assetRefs: ['assets/radio/radio-icon.svg']
      }
    ],
    hands: [],
    decks: [],
    pinnedCards: [],
    news: {
      items: [
        {
          id: 'theme_news',
          headline: 'Theme News',
          path: 'source/scenes/post_event_news.scene.dry',
          assetRefs: [{path: 'out/html/audio/theme.ogg', type: 'audio'}]
        }
      ]
    },
    surfaceText: {items: []},
    assets: {
      items: [
        {
          id: 'radio_icon_svg',
          name: 'radio-icon.svg',
          type: 'image',
          path: 'assets/radio/radio-icon.svg',
          extension: '.svg',
          sourceKind: 'source_asset',
          editability: 'reference_only',
          confidence: 'static_inferred'
        },
        {
          id: 'theme_ogg',
          name: 'theme.ogg',
          type: 'audio',
          path: 'out/html/audio/theme.ogg',
          extension: '.ogg',
          sourceKind: 'runtime_evidence',
          editability: 'ide_escape_hatch',
          confidence: 'profile_heuristic'
        }
      ],
      confidence: 'static_inferred'
    }
  },
  summary: {
    sceneCount: 0,
    edgeCount: 0,
    variableCount: 0,
    diagnosticCount: 0,
    assetCount: 2,
    imageAssetCount: 1,
    audioAssetCount: 1
  }
};

assert(viewer.VIEW_DEFS.assets, 'viewer should expose Assets view definition');
assert(viewer.VIEW_DEFS.assets.sorts.includes('type'), 'Assets view should sort by type');

const model = viewer.buildViewModel(index);
assert(model.lists.assets.length === 2, 'assets should be included in view model lists');
assert(model.summary.assetCount === 2, 'assetCount should survive summary');
assert(model.lists.assets.some((asset) => asset.type === 'image'), 'image asset should be indexed');
assert(model.lists.assets.some((asset) => asset.type === 'audio'), 'audio asset should be indexed');

const rows = viewer.filterAndSortItems(model, 'assets', 'radio', 'name', 'asc');
assert(rows.length === 1, 'Assets view search should find radio icon');
assert(rows[0].primary === 'radio-icon.svg', 'Assets row should show file name');
assert(rows[0].badges.some((badge) => badge.text === 'image'), 'Assets row should include type badge');
assert(rows[0].badges.some((badge) => badge.text === 'used 2'), 'Assets row should include usage count badge');

const imageAsset = assetModel.normalizeAssetItem(index.semantic.assets.items[0], {projectIndex: index});
assert(imageAsset.previewCapability.canPreview, 'image asset should expose preview capability');
assert(imageAsset.previewCapability.mediaKind === 'image', 'image asset should be classified as image preview');
assert(imageAsset.previewCapability.url.includes('assets/radio/radio-icon.svg'), 'image asset should keep a resolvable preview URL');
assert(imageAsset.usageRefs.length === 2, 'image asset should show event/card usage references');
assert(imageAsset.usageRefs.some((ref) => ref.kind === 'event' && ref.label === 'Asset Event'), 'image asset usage should include event reference');
assert(imageAsset.status.key === 'reference_only', 'source asset should remain read-only reference');
assert(imageAsset.referenceState.key === 'indexed', 'source asset should be marked as indexed');
assert(assetModel.renderReferenceHelper(imageAsset).includes('assets/radio/radio-icon.svg'), 'asset model should expose a reusable reference helper');
const eventAssetCatalog = assetModel.buildAssetCatalog(index, {target: 'event'});
const eventAssetCatalogAgain = assetModel.buildAssetCatalog(index, {target: 'event'});
assert(eventAssetCatalog === eventAssetCatalogAgain, 'asset picker catalogs should be cached per project index and target');
assert(eventAssetCatalog.length === 2, 'asset picker catalog should include the indexed project asset list');
assert(eventAssetCatalog.some((asset) => asset.path === 'assets/radio/radio-icon.svg' && asset.role === 'event_illustration'), 'event asset picker catalog should infer event image roles');
assert(eventAssetCatalog.some((asset) => asset.path === 'out/html/audio/theme.ogg' && asset.role === 'event_audio'), 'event asset picker catalog should infer event audio roles');
assert(eventAssetCatalog.find((asset) => asset.path === 'assets/radio/radio-icon.svg').usageRefs.length === 0, 'asset picker catalog should not rescan full project usage on the hot path');

const audioAsset = assetModel.normalizeAssetItem(index.semantic.assets.items[1], {projectIndex: index});
assert(audioAsset.previewCapability.canPreview, 'audio asset should expose preview capability');
assert(audioAsset.previewCapability.mediaKind === 'audio', 'audio asset should be classified as audio preview');
assert(audioAsset.usageRefs.length === 1, 'audio asset should show news usage references');

const launcherIndex = Object.assign({}, index, {
  project: Object.assign({}, index.project, {assetBaseUrl: '/_project_asset'}),
  semantic: Object.assign({}, index.semantic, {
    assets: {
      confidence: 'static_inferred',
      items: index.semantic.assets.items.concat([{
        id: 'runtime_portrait',
        name: 'MierendorffCarlo.jpg',
        type: 'image',
        path: 'out/html/img/portraits/MierendorffCarlo.jpg',
        previewUrl: 'out/html/img/portraits/MierendorffCarlo.jpg',
        extension: '.jpg',
        sourceKind: 'runtime_evidence',
        editability: 'ide_escape_hatch',
        fileExists: true
      }])
    }
  })
});
const runtimePreviewAsset = assetModel.normalizeAssetItem({
  id: 'runtime_portrait',
  name: 'MierendorffCarlo.jpg',
  type: 'image',
  path: 'out/html/img/portraits/MierendorffCarlo.jpg',
  previewUrl: 'out/html/img/portraits/MierendorffCarlo.jpg',
  fileExists: true
}, {projectIndex: launcherIndex});
assert(
  runtimePreviewAsset.previewCapability.url === '/_project_asset/out/html/img/portraits/MierendorffCarlo.jpg',
  'relative runtime asset preview URLs should be routed through the launcher asset base'
);

const missingAsset = assetModel.normalizeAssetItem({
  path: 'assets/missing/missing.png',
  type: 'image',
  label: 'Missing image'
}, {projectIndex: index});
assert(missingAsset.referenceState.key === 'missing', 'missing asset refs should be marked missing');
assert(!missingAsset.previewCapability.canPreview, 'missing asset refs should not claim preview capability');
assert(/missing/i.test(missingAsset.previewCapability.message), 'missing asset preview should explain the missing reference');

const fileMissingIndex = {
  schemaVersion: '0.1',
  project: {name: 'file missing fixture', root: '/tmp/file-missing-fixture', profileIds: ['generic-dendry']},
  profiles: [],
  scenes: [],
  edges: [],
  variables: [],
  diagnostics: [],
  summary: {assetCount: 1, imageAssetCount: 1, audioAssetCount: 0},
  semantic: {
    assets: {
      items: [
        {
          id: 'checkout_missing_portrait',
          path: 'img/portraits/MissingPortrait.png',
          type: 'image',
          fileExists: false,
          sourceKind: 'source_asset',
          editability: 'reference_only'
        }
      ]
    }
  }
};
const fileMissingAsset = assetModel.normalizeAssetItem({
  path: 'img/portraits/MissingPortrait.png',
  type: 'image',
  label: 'Missing portrait'
}, {projectIndex: fileMissingIndex});
assert(fileMissingAsset.referenceState.key === 'file_missing', 'indexed refs with absent physical files should be marked file_missing');
assert(!fileMissingAsset.previewCapability.canPreview, 'file_missing refs should not claim preview capability');
assert(/checkout/i.test(fileMissingAsset.previewCapability.message), 'file_missing preview should explain the checkout is missing the file');
assert(assetModel.assetDraftReference(fileMissingAsset).path === 'img/portraits/MissingPortrait.png', 'asset model should expose a draft-safe asset reference object');
assert(assetModel.assetEditingMetadata(fileMissingAsset).canReference, 'indexed assets should be usable as draft references even when read-only');
assert(assetModel.assetEditingMetadata(fileMissingAsset).installBehavior === 'manual_asset_file', 'file_missing assets should explain manual file handling');
assert(assetModel.assetDraftReference(imageAsset, {role: 'event_illustration'}).role === 'event_illustration', 'asset draft references should preserve role metadata');
assert(/Event illustration/.test(assetModel.renderAssetText(assetModel.assetDraftReference(imageAsset, {role: 'event_illustration'}))), 'asset text should show human role context');
const eventSlots = assetModel.assetSlotDefinitions('event');
assert(eventSlots.some((slot) => slot.role === 'event_illustration'), 'asset model should define event illustration slots');
assert(eventSlots.some((slot) => slot.role === 'event_background'), 'asset model should define event background slots');
assert(eventSlots.some((slot) => slot.role === 'event_audio'), 'asset model should define event audio slots');
const cardSlots = assetModel.assetSlotDefinitions('card');
assert(cardSlots.some((slot) => slot.role === 'card_image'), 'asset model should define card image slots');
assert(cardSlots.some((slot) => slot.role === 'card_background'), 'asset model should define card background slots');
assert(assetModel.roleForAssetDirective('set-bg', 'event') === 'event_background', 'set-bg should map to event background for event objects');
assert(assetModel.roleForAssetDirective('set-bg', 'card') === 'card_background', 'set-bg should map to card background for card objects');
assert(assetModel.roleForAssetDirective('inline-image', 'event') === 'event_illustration', 'inline images should map into the managed event illustration slot');
assert(assetModel.roleForAssetDirective('inline-image', 'card') === 'card_image', 'inline card images should map into the managed card image slot');
const filledSlots = assetModel.buildAssetSlots({
  assetRefs: [
    {path: 'assets/radio/radio-icon.svg', type: 'image', label: 'Radio icon', role: 'event_illustration'}
  ],
  assetInstallRequests: [
    {
      sourceName: 'Portrait Hero.PNG',
      targetPath: 'assets/studio/events/asset_preview_event/portrait-hero.png',
      type: 'image',
      label: 'Portrait Hero',
      role: 'event_portrait'
    }
  ]
}, {projectIndex: index, target: 'event'});
assert(filledSlots.some((slot) => slot.role === 'event_illustration' && slot.assetRef && slot.assetRef.path === 'assets/radio/radio-icon.svg'), 'asset slots should attach selected assetRefs by role');
assert(filledSlots.some((slot) => slot.role === 'event_portrait' && slot.installRequest && slot.installRequest.targetPath.includes('portrait-hero.png')), 'asset slots should attach pending install requests by role');
assert(
  assetModel.suggestAssetTargetPath({name: 'Portrait Hero.PNG', type: 'image'}, {target: 'event', draftId: 'asset_preview_event'}) === 'assets/studio/events/asset_preview_event/portrait-hero.png',
  'asset model should suggest stable project-relative install targets for event assets'
);
const installRequest = assetModel.assetInstallRequest({
  sourceName: 'Portrait Hero.PNG',
  targetPath: 'assets/studio/events/asset_preview_event/portrait-hero.png',
  type: 'image',
  label: 'Portrait Hero',
  role: 'event_illustration'
});
assert(installRequest.targetPath === 'assets/studio/events/asset_preview_event/portrait-hero.png', 'asset install requests should keep the target project path');
assert(installRequest.sourceName === 'Portrait Hero.PNG', 'asset install requests should keep the selected source file name');
assert(installRequest.roleLabel === 'Event illustration', 'asset install requests should expose role labels');
assert(assetModel.renderAssetInstallRequestText(installRequest).includes('copy Portrait Hero.PNG'), 'asset install request text should explain the copy action');
const eventAssetRows = assetModel.buildAssetRows({
  assetRefs: [
    {path: 'assets/radio/radio-icon.svg', type: 'image', label: 'Radio icon', directive: 'set-bg'},
    {path: 'assets/missing/missing.png', type: 'image', label: 'Missing image', role: 'event_illustration'}
  ],
  assetInstallRequests: [installRequest]
}, {projectIndex: index, target: 'event'});
assert(eventAssetRows.some((row) => row.rowKind === 'asset_ref' && row.directive === 'set-bg' && row.role === 'event_background'), 'asset rows should map source directives into role-aware Object Canvas rows');
assert(eventAssetRows.some((row) => row.rowKind === 'asset_ref' && row.referenceState.key === 'missing'), 'asset rows should preserve missing reference state');
assert(eventAssetRows.some((row) => row.rowKind === 'asset_install_request' && row.status === 'pending_install' && row.installRequest.targetPath.includes('portrait-hero.png')), 'asset rows should include pending install requests');
const flowAssetRows = assetModel.buildAssetRows({
  assetRefs: [{path: 'assets/radio/radio-icon.svg', type: 'image', label: 'Radio icon', directive: 'set-bg'}],
  assetPlacements: [{
    placementId: 'option_iron_front',
    placementKind: 'option_result_visual',
    displayLocation: 'Option: Rally the Iron Front',
    optionId: 'iron_front',
    path: 'img/events/iron-front.png',
    type: 'image',
    label: 'Iron Front poster',
    directive: 'face-image',
    role: 'event_illustration'
  }],
  assetInstallRequests: [assetModel.assetInstallRequest({
    sourceName: 'Iron Front Local.png',
    targetPath: 'assets/studio/events/1932/iron-front-local.png',
    type: 'image',
    role: 'event_illustration',
    placementId: 'option_iron_front',
    placementKind: 'option_result_visual',
    optionId: 'iron_front',
    displayLocation: 'Option: Rally the Iron Front'
  })]
}, {projectIndex: index, target: 'event'});
assert(flowAssetRows.some((row) => row.path === 'img/events/iron-front.png' && row.placementKind === 'option_result_visual' && row.optionId === 'iron_front' && row.flowAsset), 'asset rows should keep option-result asset placements separate from global slots');
assert(flowAssetRows.some((row) => row.rowKind === 'asset_install_request' && row.placementId === 'option_iron_front' && row.placementKind === 'option_result_visual'), 'asset install requests should preserve placement metadata for draft flow assets');
assert(assetModel.normalizeAssetPlacementKind('not-a-kind') === 'unknown_inline', 'unknown placement kinds should normalize to the inline fallback');
assert(assetModel.isFlowPlacementKind('option_result_visual'), 'option-result placements should be classified as flow assets');
const cardAssetRows = assetModel.buildAssetRows({
  assetRefs: [{path: 'assets/radio/radio-icon.svg', type: 'image', label: 'Card background', directive: 'set-bg'}]
}, {projectIndex: index, target: 'card'});
assert(cardAssetRows.some((row) => row.role === 'card_background' && row.roleLabel === 'Card background'), 'card asset rows should map set-bg to card background');
const repairRequest = assetModel.assetRepairInstallRequest(fileMissingAsset, {
  name: 'ReplacementPortrait.png',
  path: '/tmp/ReplacementPortrait.png'
});
assert(repairRequest.targetPath === 'img/portraits/MissingPortrait.png', 'asset repair requests should target the missing indexed asset path');
assert(repairRequest.sourcePath === '/tmp/ReplacementPortrait.png', 'asset repair requests should preserve desktop source paths when available');
assert(repairRequest.role === 'reference', 'asset repair requests should default to a reference role when no draft slot is known');

const manifest = assetModel.buildAssetManifest([
  {path: 'assets/radio/radio-icon.svg', type: 'image', role: 'event_illustration'},
  {path: 'img/portraits/MissingPortrait.png', type: 'image', role: 'card_portrait'},
  {path: 'assets/missing/missing.png', type: 'image', role: 'card_image'}
], {projectIndex: fileMissingIndex});
assert(manifest.items.length === 3, 'asset manifest should keep every requested reference');
assert(manifest.counts.indexed === 0, 'asset manifest should count indexed refs against its project index');
assert(manifest.counts.file_missing === 1, 'asset manifest should count indexed refs whose physical files are absent');
assert(manifest.counts.missing === 2, 'asset manifest should count refs missing from the ProjectIndex');
assert(manifest.items.some((item) => item.roleLabel === 'Card portrait'), 'asset manifest should provide human role labels');
assert(manifest.manualActions.some((line) => line.includes('img/portraits/MissingPortrait.png')), 'asset manifest should tell the user which file path needs manual handling');

const inspectorHtml = viewer.renderAssetInspector(index.semantic.assets.items[0], model);
assert(inspectorHtml.includes('asset-preview-frame'), 'asset inspector should render a preview frame');
assert(inspectorHtml.includes('asset-reference-helper'), 'asset inspector should render a reference helper');
assert(inspectorHtml.includes('asset-use-actions'), 'asset inspector should render use-in-draft actions');
assert(inspectorHtml.includes('data-asset-action="use-in-draft"'), 'asset inspector should expose use-in-draft buttons');
assert(inspectorHtml.includes('data-asset-target="event"'), 'asset inspector should let users reference assets in Event drafts');
assert(inspectorHtml.includes('data-asset-target="card"'), 'asset inspector should let users reference assets in Card drafts');
assert(inspectorHtml.includes('data-asset-action="copy-asset-ref"'), 'asset inspector should expose a copy asset reference action');
assert(inspectorHtml.includes('assets/radio/radio-icon.svg'), 'asset reference helper should expose the reusable path');
assert(inspectorHtml.includes('asset-usage-list'), 'asset inspector should render usage references');
assert(inspectorHtml.includes('Asset Event'), 'asset inspector should include usage labels');

const appUi = readExploreBundle(require('path').join(__dirname, 'viewer'));
assert(appUi.includes('handleAssetDraftAction'), 'viewer should handle asset draft actions from the inspector');
assert(appUi.includes('ProjectMap:asset-reference-selected'), 'viewer should dispatch asset reference selections to Create wizards');
assert(appUi.includes('renderAssetPicker'), 'viewer should render an embeddable asset picker for Create forms');
const pickerHtml = viewer.renderAssetPicker(index, {target: 'event', selectedPath: 'assets/radio/radio-icon.svg'});
assert(pickerHtml.includes('asset-picker'), 'asset picker should render a stable picker surface');
assert(pickerHtml.includes('data-asset-picker-action="select"'), 'asset picker should expose select actions');
assert(pickerHtml.includes('data-asset-target="event"'), 'asset picker should preserve the target draft kind');
assert(pickerHtml.includes('is-selected'), 'asset picker should mark the selected asset path');
assert(appUi.includes('renderDraftAssetPanel'), 'viewer should render a draft-level asset panel for Create forms');
const draftAssetPanel = viewer.renderDraftAssetPanel({
  assetRefs: [{path: 'assets/radio/radio-icon.svg', type: 'image', label: 'Radio icon', role: 'event_illustration'}],
  assetInstallRequests: [installRequest]
}, index, {target: 'event'});
assert(draftAssetPanel.includes('draft-asset-panel'), 'draft asset panel should render a stable panel surface');
assert(draftAssetPanel.includes('asset-slot-grid'), 'draft asset panel should render role-based asset slots');
assert(draftAssetPanel.includes('data-asset-slot-role="event_illustration"'), 'draft asset panel should expose event illustration slot semantics');
assert(draftAssetPanel.includes('Radio icon'), 'draft asset panel should show selected asset labels');
assert(draftAssetPanel.includes('Portrait Hero.PNG'), 'draft asset panel should show pending local asset install requests');
assert(draftAssetPanel.includes('copy_asset_file'), 'draft asset panel should expose asset copy proposal status');
const missingInspectorHtml = viewer.renderAssetInspector(fileMissingIndex.semantic.assets.items[0], viewer.buildViewModel(fileMissingIndex));
assert(missingInspectorHtml.includes('asset-repair-actions'), 'file_missing asset inspector should expose a repair action surface');
assert(missingInspectorHtml.includes('data-asset-repair-file'), 'file_missing asset inspector should expose a graphical replacement file input');
assert(missingInspectorHtml.includes('img/portraits/MissingPortrait.png'), 'file_missing repair UI should preserve the target asset path');

const preview = previewModel.buildPreviewModel({
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'asset_preview_event',
  title: 'Asset Preview Event',
  heading: 'Asset Preview Event',
  when: {year: 2025, monthStart: 1, monthEnd: 1, requires: '', priority: 0},
  introParagraphs: ['This draft references a visual asset.'],
  assetRefs: [{path: 'assets/radio/radio-icon.svg', type: 'image'}],
  options: [
    {id: 'continue', label: 'Continue', effects: [], narrativeParagraphs: []},
    {id: 'leave', label: 'Leave', effects: [], narrativeParagraphs: []}
  ]
}, {projectIndex: index});
assert(preview.assets.length === 1, 'Preview model should expose draft asset references');
assert(preview.assets[0].previewCapability && preview.assets[0].previewCapability.canPreview, 'Preview model asset refs should be enriched with preview capability');
assert(preview.warnings.some((warning) => warning.includes('Asset references are indexed')), 'Preview should explain asset references are not installed automatically');

const missingPreview = previewModel.buildPreviewModel({
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'missing_asset_event',
  title: 'Missing Asset Event',
  heading: 'Missing Asset Event',
  when: {year: 2025, monthStart: 1, monthEnd: 1, requires: '', priority: 0},
  introParagraphs: ['This draft references a missing visual asset.'],
  assetRefs: [{path: 'assets/missing/missing.png', type: 'image', label: 'Missing image'}],
  options: [
    {id: 'continue', label: 'Continue', effects: [], narrativeParagraphs: []},
    {id: 'leave', label: 'Leave', effects: [], narrativeParagraphs: []}
  ]
}, {projectIndex: index});
assert(missingPreview.assets[0].referenceState.key === 'missing', 'Preview model should mark missing asset refs');
assert(missingPreview.warnings.some((warning) => warning.includes('Missing asset reference')), 'Preview model should warn about missing asset refs');
assert(missingPreview.readiness.key === 'needs_review', 'missing asset refs should move preview readiness to needs_review');

process.stdout.write(JSON.stringify({
  ok: true,
  assets: model.lists.assets.length,
  previewAssets: preview.assets.length,
  imageUsageRefs: imageAsset.usageRefs.length,
  audioUsageRefs: audioAsset.usageRefs.length,
  missingReference: missingAsset.referenceState.key
}, null, 2) + '\n');
