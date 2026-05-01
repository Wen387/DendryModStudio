#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const previewModel = require('./authoring/preview_model.js');
const assetModel = require('./authoring/asset_model.js');
const draftExtract = require('./authoring/draft_extract.js');
const eventDraftCore = require('./authoring/event_draft.js');
const cardDraftCore = require('./authoring/card_draft.js');
const eventDraft = require('./fixtures/event_drafts/sample_world_event.json');
const cardDraft = require('./fixtures/card_drafts/sample_action_card.json');
const newsDraft = require('./fixtures/news_drafts/sample_dated_news.json');
const surfaceDraft = require('./fixtures/surface_text_drafts/sample_label_replacement.json');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function syntheticIndex() {
  const eventScene = {
    id: 'anti_curriculum',
    title: '反課綱運動',
    path: 'source/scenes/events/anti_curriculum.scene.dry',
    type: 'card',
    tags: ['event'],
    flags: {isCard: true, isPinnedCard: false},
    viewIf: 'year = 2015 and month >= 7 and month <= 8 and anti_curriculum_seen = 0',
    priority: '1',
    maxVisits: '1',
    options: [
      {target: {id: 'active'}, title: '積極參與——提供支援。'},
      {target: {id: 'statement'}, title: '發表聲明支持。'}
    ],
    sourceSpan: {path: 'source/scenes/events/anti_curriculum.scene.dry', startLine: 1, endLine: 90}
  };
  return {
    schemaVersion: '0.1',
    project: {root: '/tmp/project'},
    scenes: [eventScene],
    edges: [],
    variables: [{name: 'resources'}, {name: 'media_reach'}, {name: 'year'}, {name: 'month'}],
    diagnostics: [],
    summary: {},
    semantic: {
      events: [{id: 'anti_curriculum', title: '反課綱運動', path: eventScene.path, confidence: 'exact'}],
      cards: [],
      news: {
        items: [],
        eventPopups: [
          {
            delivery: 'legacy_event_popup',
            headline: 'Kellogg-Briand Pact',
            description: 'A short monthly popup description.',
            linkedSceneId: 'kellogg_briand',
            router: {tag: 'event', anchor: 'events_choice', path: 'source/scenes/post_event.scene.dry', line: 490},
            source: {path: 'source/scenes/events/kellogg_briand.scene.dry', line: 1},
            confidence: 'static_inferred'
          }
        ]
      },
      assets: {
        items: [
          {
            id: 'sample_portrait',
            name: 'sample.png',
            type: 'image',
            path: 'assets/portraits/sample.png',
            extension: '.png',
            sourceKind: 'source_asset',
            editability: 'reference_only',
            confidence: 'static_inferred'
          }
        ]
      },
      surfaceText: {items: []}
    }
  };
}

const index = syntheticIndex();

const eventPreview = previewModel.buildPreviewModel(eventDraft, {projectIndex: index});
assert(eventPreview.sourceKind === 'event', 'event draft should produce event preview');
assert(eventPreview.confidence === 'exact', 'raw event draft preview should be exact authoring preview');
assert(eventPreview.title === 'Sample World Event', 'event preview should use event title');
assert(eventPreview.body.some((row) => row.text.includes('A Sample Event')), 'event preview should include heading');
assert(eventPreview.choices.length === 2, 'event preview should include choices');
assert(eventPreview.choices[0].effects.some((effect) => effect.includes('resources -= 1')), 'event preview should summarize choice effects');
assert(eventPreview.readiness && eventPreview.readiness.key === 'ready_to_review', 'exact event preview should expose ready_to_review readiness');
assert(eventPreview.readiness.runtimePreview === false, 'preview readiness should explicitly say this is not runtime preview');
assert(/not a runtime/i.test(eventPreview.readiness.summary), 'preview readiness summary should explain runtime boundary');

const cardPreview = previewModel.buildPreviewModel(cardDraft, {projectIndex: index});
assert(cardPreview.sourceKind === 'card', 'card draft should produce card preview');
assert(cardPreview.meta.some((item) => item.label === 'Card kind' && item.value === 'action_card'), 'card preview should include card kind');
assert(cardPreview.choices.length === 2, 'card preview should include card choices');

const newsPreview = previewModel.buildPreviewModel(newsDraft, {projectIndex: index});
assert(newsPreview.sourceKind === 'news', 'news draft should produce news preview');
assert(newsPreview.meta.some((item) => item.value === 'news_1'), 'dated news preview should include slot');
assert(newsPreview.body.some((row) => row.text.includes('Studio news wizard')), 'news preview should include headline');

const surfacePreview = previewModel.buildPreviewModel(surfaceDraft, {projectIndex: index});
assert(surfacePreview.sourceKind === 'surface_text', 'surface text draft should produce surface preview');
assert(surfacePreview.body.some((row) => row.text.includes('資源')), 'surface preview should include original label');
assert(surfacePreview.body.some((row) => row.text.includes('資金')), 'surface preview should include replacement label');

const existingSceneEditPreview = previewModel.buildPreviewModel({
  schemaVersion: '0.1',
  kind: 'existing_scene_edit',
  id: 'edit_existing_anti_curriculum',
  title: '反課綱運動',
  sceneId: 'anti_curriculum',
  sceneKind: 'event',
  sourcePath: 'source/scenes/events/anti_curriculum.scene.dry',
  changes: [
    {
      fieldId: 'anti_curriculum_body_1',
      role: 'body',
      label: 'Body',
      source: {path: 'source/scenes/events/anti_curriculum.scene.dry', line: 12},
      before: 'Original body.',
      after: 'Rewritten body.'
    },
    {
      fieldId: 'anti_curriculum_option_1',
      role: 'option_label',
      label: 'Player option',
      source: {path: 'source/scenes/events/anti_curriculum.scene.dry', line: 20},
      before: 'Old option',
      after: 'New option'
    }
  ],
  changeSummary: {total: 2, textFields: 2, metadataFields: 0, manualFields: 0}
}, {projectIndex: index});
assert(existingSceneEditPreview.sourceKind === 'existing_scene_edit', 'existing scene edit should produce existing_scene_edit preview');
assert(existingSceneEditPreview.title.includes('Modify existing'), 'existing scene edit preview title should say it modifies an existing scene');
assert(existingSceneEditPreview.meta.some((item) => item.label === 'Scene' && item.value === 'anti_curriculum'), 'existing scene edit preview should include scene id');
assert(existingSceneEditPreview.body.some((row) => row.text.includes('Before: Original body.')), 'existing scene edit preview should show before text');
assert(existingSceneEditPreview.body.some((row) => row.text.includes('After: Rewritten body.')), 'existing scene edit preview should show after text');
assert(existingSceneEditPreview.readiness.key === 'ready_to_review', 'source-backed existing edit preview should be ready to review');

const extracted = draftExtract.extractDraftFromItem(index, 'events', 'anti_curriculum', {});
const extractedPreview = previewModel.buildPreviewModel(extracted, {projectIndex: index});
assert(extractedPreview.mode === 'extracted', 'draft extraction result should produce extracted preview mode');
assert(extractedPreview.confidence === 'approximate', 'partial extracted event should be approximate');
assert(extractedPreview.warnings.some((warning) => /not captured/i.test(warning)), 'partial extraction warnings should mention uncaptured fields');
assert(extractedPreview.readiness.key === 'needs_review', 'partial extracted preview should expose needs_review readiness');
assert(extractedPreview.readiness.warningCount >= 1, 'partial extracted readiness should count warnings');

const escapeHatch = previewModel.buildPreviewModel({
  template: 'surface',
  status: 'ide_escape_hatch',
  ok: true,
  draft: {
    schemaVersion: '0.1',
    kind: 'surface_text',
    id: 'html_escape_hatch',
    area: 'html_sidebar',
    originalLabel: '資源',
    replacementLabel: '資金',
    editability: 'ide_escape_hatch',
    source: {path: 'out/html/sidebar.js', line: 12}
  },
  diagnostics: []
}, {projectIndex: index});
assert(escapeHatch.confidence === 'unsupported', 'IDE escape hatch surface preview should be unsupported');
assert(escapeHatch.install.status === 'manual-only', 'IDE escape hatch should be manual-only install status');
assert(escapeHatch.readiness.key === 'manual_review', 'IDE escape hatch preview should expose manual_review readiness');

const legacyPopupPreview = previewModel.buildPreviewModel(index.semantic.news.eventPopups[0], {sourceKind: 'news', projectIndex: index});
assert(legacyPopupPreview.sourceKind === 'event', 'legacy monthly popup should preview as event-like content');
assert(legacyPopupPreview.meta.some((item) => item.value === 'legacy_event_popup'), 'legacy popup preview should keep delivery metadata');
assert(legacyPopupPreview.body.some((row) => row.text.includes('monthly popup')), 'legacy popup preview should include description');

const assetPreview = previewModel.buildPreviewModel(Object.assign({}, eventDraft, {
  assetRefs: [{path: 'assets/portraits/sample.png', type: 'image', label: 'Sample portrait', role: 'event_illustration'}]
}), {projectIndex: index});
assert(assetPreview.assets.length === 1, 'preview should keep structured asset references');
assert(assetPreview.assets[0].previewCapability && assetPreview.assets[0].previewCapability.mediaKind === 'image', 'preview assets should include preview capability metadata');
assert(assetPreview.assets[0].role === 'event_illustration', 'preview assets should preserve role metadata');
assert(assetPreview.assets[0].roleLabel === 'Event illustration', 'preview assets should expose human role labels');
assert(assetModel.renderAssetText(assetPreview.assets[0]).includes('Sample portrait'), 'asset model should provide readable asset text');
assert(assetPreview.readiness.assetCount === 1, 'preview readiness should count referenced assets');
assert(assetPreview.assetManifest && assetPreview.assetManifest.items.length === 1, 'preview should include an asset manifest for review');
assert(assetPreview.assetManifest.items[0].roleLabel === 'Event illustration', 'preview asset manifest should include role labels');

const assetInstallPreview = previewModel.buildPreviewModel(Object.assign({}, eventDraft, {
  assetRefs: [],
  assetInstallRequests: [
    {
      sourceName: 'Portrait Hero.PNG',
      targetPath: 'assets/studio/events/sample_world_event/portrait-hero.png',
      type: 'image',
      label: 'Portrait Hero',
      role: 'event_illustration'
    }
  ]
}), {projectIndex: index});
assert(assetInstallPreview.assets.length === 1, 'preview should derive asset references from asset install requests');
assert(assetInstallPreview.assets[0].path === 'assets/studio/events/sample_world_event/portrait-hero.png', 'preview install request assets should use the target project path');
assert(assetInstallPreview.assets[0].role === 'event_illustration', 'preview install request assets should preserve role metadata');

const missingAssetPreview = previewModel.buildPreviewModel(Object.assign({}, eventDraft, {
  assetRefs: [{path: 'assets/missing/portrait.png', type: 'image', label: 'Missing portrait'}]
}), {projectIndex: index});
assert(missingAssetPreview.assets[0].referenceState.key === 'missing', 'missing preview asset refs should be marked missing');
assert(!missingAssetPreview.assets[0].previewCapability.canPreview, 'missing preview asset refs should not claim preview capability');
assert(missingAssetPreview.warnings.some((warning) => /Missing asset reference/.test(warning)), 'missing preview asset refs should add a warning');
assert(missingAssetPreview.readiness.key === 'needs_review', 'missing preview asset refs should require review before apply');

const fileMissingIndex = syntheticIndex();
fileMissingIndex.semantic.assets.items.push({
  id: 'missing_physical_file',
  path: 'assets/portraits/absent.png',
  type: 'image',
  label: 'Absent physical file',
  fileExists: false
});
const fileMissingPreview = previewModel.buildPreviewModel(Object.assign({}, eventDraft, {
  assetRefs: [{path: 'assets/portraits/absent.png', type: 'image', label: 'Absent physical file'}]
}), {projectIndex: fileMissingIndex});
assert(fileMissingPreview.assets[0].referenceState.key === 'file_missing', 'preview should distinguish indexed refs whose physical file is absent');
assert(fileMissingPreview.warnings.some((warning) => /physical asset file is missing/i.test(warning)), 'file-missing preview refs should add a clear warning');
assert(fileMissingPreview.readiness.key === 'needs_review', 'file-missing asset refs should require review before apply');
assert(fileMissingPreview.assetManifest.counts.file_missing === 1, 'preview asset manifest should count file-missing refs');

assert(eventDraftCore.normalizeDraft({
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'asset_event',
  title: 'Asset Event',
  heading: 'Asset Event',
  when: {year: 2025, monthStart: 1, monthEnd: 1, requires: '', priority: 0},
  introParagraphs: ['Uses an asset.'],
  assetRefs: [{path: 'assets/portraits/sample.png', type: 'image', label: 'Sample portrait', role: 'event_illustration'}],
  options: [
    {id: 'a', label: 'A', effects: [], narrativeParagraphs: []},
    {id: 'b', label: 'B', effects: [], narrativeParagraphs: []}
  ]
}).assetRefs[0].role === 'event_illustration', 'EventDraft normalization should preserve assetRefs role metadata for authoring preview');
assert(cardDraftCore.normalizeDraft({
  schemaVersion: '0.1',
  kind: 'card',
  id: 'asset_card',
  title: 'Asset Card',
  cardKind: 'action_card',
  heading: 'Asset Card',
  tags: ['party_affairs'],
  introParagraphs: ['Uses an asset.'],
  assetRefs: [{path: 'assets/portraits/sample.png', type: 'image', label: 'Sample portrait', role: 'card_image'}],
  options: [
    {id: 'a', label: 'A', effects: [], narrativeParagraphs: []},
    {id: 'b', label: 'B', effects: [], narrativeParagraphs: []}
  ]
}).assetRefs[0].role === 'card_image', 'CardDraft normalization should preserve assetRefs role metadata for authoring preview');

const html = fs.readFileSync(path.join(__dirname, 'viewer', 'index.html'), 'utf8');
assert(html.includes('../authoring/asset_model.js'), 'viewer should load AssetModel before PreviewModel');
assert(html.includes('../authoring/preview_model.js'), 'viewer should load PreviewModel before wizard UIs');
assert(html.includes('id="wizard-asset-refs"'), 'Event wizard should expose an assetRefs editing field');
assert(html.includes('id="card-asset-refs"'), 'Card wizard should expose an assetRefs editing field');
assert(html.includes('id="wizard-asset-picker"'), 'Event wizard should expose an embedded asset picker');
assert(html.includes('id="card-asset-picker"'), 'Card wizard should expose an embedded asset picker');
assert(html.includes('id="wizard-asset-manifest"'), 'Event wizard should expose an asset manifest review surface');
assert(html.includes('id="card-asset-manifest"'), 'Card wizard should expose an asset manifest review surface');
['wizard_ui.js', 'card_ui.js', 'news_ui.js', 'surface_text_ui.js'].forEach((fileName) => {
  const content = fs.readFileSync(path.join(__dirname, 'viewer', fileName), 'utf8');
  assert(content.includes('ProjectMapPreviewModel'), fileName + ' should use ProjectMapPreviewModel for player preview');
  assert(content.includes('renderFallbackPlayerPreview'), fileName + ' should keep a fallback preview path');
});
const wizardUi = fs.readFileSync(path.join(__dirname, 'viewer', 'wizard_ui.js'), 'utf8');
const cardUi = fs.readFileSync(path.join(__dirname, 'viewer', 'card_ui.js'), 'utf8');
assert(wizardUi.includes('parseAssetRefsText'), 'Event wizard should parse assetRefs text into structured refs');
assert(wizardUi.includes('ProjectMap:asset-reference-selected'), 'Event wizard should accept asset references selected from Assets view');
assert(wizardUi.includes('renderAssetPicker'), 'Event wizard should render the asset picker from ProjectIndex assets');
assert(wizardUi.includes('renderAssetManifest'), 'Event wizard should render the asset manifest for selected refs');
assert(cardUi.includes('parseAssetRefsText'), 'Card wizard should parse assetRefs text into structured refs');
assert(cardUi.includes('ProjectMap:asset-reference-selected'), 'Card wizard should accept asset references selected from Assets view');
assert(cardUi.includes('renderAssetPicker'), 'Card wizard should render the asset picker from ProjectIndex assets');
assert(cardUi.includes('renderAssetManifest'), 'Card wizard should render the asset manifest for selected refs');
const appUi = fs.readFileSync(path.join(__dirname, 'viewer', 'app.js'), 'utf8');
const designUi = fs.readFileSync(path.join(__dirname, 'viewer', 'design_ui.js'), 'utf8');
assert(appUi.includes('renderInspectorPreview'), 'Explore inspector should render a PreviewModel panel');
assert(appUi.includes('previewModelForSelection'), 'Explore inspector should build previews from selected rows');
assert(appUi.includes('renderAssetGallery'), 'Explore assets view should render gallery cards');
assert(designUi.includes('renderDesignPreview'), 'Design inspector should render a PreviewModel panel');
assert(designUi.includes('previewModelForDesignItem'), 'Design inspector should build previews from selected nodes');
const meaningUi = fs.readFileSync(path.join(__dirname, 'viewer', 'meaning_layer_ui.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'viewer', 'styles.css'), 'utf8');
assert(meaningUi.includes('renderPreviewReadiness'), 'Meaning preview should render preview readiness summary');
assert(meaningUi.includes('renderPreviewAssets'), 'Meaning preview should render structured asset references');
assert(meaningUi.includes('meaning-collapsible'), 'Meaning preview should render collapsible information categories');
assert(meaningUi.includes('sectionCount'), 'Meaning preview should compute section counts for collapsible headings');
assert(css.includes('.meaning-readiness'), 'CSS should style preview readiness summary');
assert(css.includes('.meaning-collapsible'), 'CSS should style collapsible meaning preview sections');
assert(css.includes('.section-count'), 'CSS should style collapsible section count badges');

process.stdout.write(JSON.stringify({
  ok: true,
  eventChoices: eventPreview.choices.length,
  cardChoices: cardPreview.choices.length,
  newsConfidence: newsPreview.confidence,
  extractedConfidence: extractedPreview.confidence,
  legacySourceKind: legacyPopupPreview.sourceKind,
  previewAssets: assetPreview.assets.length,
  missingAssetState: missingAssetPreview.assets[0].referenceState.key
}, null, 2) + '\n');
