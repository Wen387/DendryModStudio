#!/usr/bin/env node
'use strict';

const draftExtract = require('./authoring/draft_extract.js');
const existingSceneEdit = require('./authoring/existing_scene_edit_model.js');
const eventDraft = require('./authoring/event_draft.js');
const cardDraft = require('./authoring/card_draft.js');
const newsDraft = require('./authoring/news_draft.js');
const surfaceDraft = require('./authoring/surface_text_draft.js');
const fs = require('fs');
const path = require('path');
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

function syntheticIndex() {
  const eventScene = {
    id: 'anti_curriculum',
    title: '反課綱運動',
    path: 'source/scenes/events/anti_curriculum.scene.dry',
    type: 'card',
    tags: ['event'],
    flags: {isCard: true, isPinnedCard: false},
    viewIf: 'year = 2015 and month >= 7 and month <= 8 and anti_curriculum_seen = 0 and founding_phase = 0',
    priority: '1',
    maxVisits: '1',
    options: [
      {target: {id: 'active'}, title: '積極參與——提供支援。'},
      {target: {id: 'statement'}, title: '發表聲明支持。'},
      {target: {id: 'silent'}, title: '保持沉默。'}
    ],
    sourceSpan: {path: 'source/scenes/events/anti_curriculum.scene.dry', startLine: 1, endLine: 90}
  };
  const cardScene = {
    id: 'fundraising',
    title: '小額募款',
    path: 'source/scenes/party_affairs/fundraising.scene.dry',
    type: 'card',
    tags: ['fundraising'],
    flags: {isCard: true, isPinnedCard: false},
    viewIf: 'fundraising_timer <= 0',
    frequency: '250',
    options: [
      {target: {id: 'online_fundraise'}, title: '線上募資——透過社群媒體發起募款。'},
      {target: {id: 'street_fundraise'}, title: '街頭募款——在人潮聚集處擺攤勸募。'},
      {target: {id: 'community_fundraise'}, title: '社區籌款——透過全國性社區網絡募款。'},
      {target: {id: 'union_funding'}, title: '工會資助——與友好工會合作。'},
      {target: {id: 'return'}, title: '暫不募款。'}
    ],
    sourceSpan: {path: 'source/scenes/party_affairs/fundraising.scene.dry', startLine: 1, endLine: 108}
  };
  return {
    schemaVersion: '0.1',
    project: {root: '/tmp/project'},
    profiles: [],
    scenes: [eventScene, cardScene],
    edges: [],
    variables: [
      {name: 'resources'},
      {name: 'media_reach'},
      {name: 'civil_society_trust'},
      {name: 'founding_phase'},
      {name: 'fundraising_timer'},
      {name: 'year'},
      {name: 'month'}
    ],
    diagnostics: [],
    summary: {},
    semantic: {
      events: [{id: 'anti_curriculum', path: eventScene.path, title: eventScene.title, confidence: 'exact'}],
      cards: [{id: 'fundraising', path: cardScene.path, title: cardScene.title, confidence: 'exact'}],
      hands: [],
      decks: [],
      pinnedCards: [],
      news: {
        items: [
          {
            headline: '[政治] 測試新聞',
            description: '測試說明',
            delivery: 'dated',
            slot: 'news_2',
            source: {path: 'source/scenes/post_event_news.scene.dry', line: 123},
            confidence: 'static_inferred'
          },
          {
            headline: '',
            description: '',
            delivery: 'dated',
            slot: 'news_1',
            source: {path: 'source/scenes/post_event_news.scene.dry', line: 17},
            confidence: 'static_inferred'
          }
        ]
      },
      surfaceText: {
        items: [
          {
            id: 'surface_status_resources',
            label: '資源',
            area: 'status_scene',
            source: {path: 'source/scenes/status.scene.dry', line: 33},
            confidence: 'static_inferred',
            editability: 'draft_exportable',
            reason: 'Source-backed Dendry display text.',
            originalText: '= 資源'
          },
          {
            id: 'surface_html_resources',
            label: '資源',
            area: 'html_sidebar',
            source: {path: 'out/html/sidebar.js', line: 12},
            confidence: 'profile_heuristic',
            editability: 'ide_escape_hatch',
            reason: 'Runtime UI evidence.',
            originalText: "label.textContent = '資源';"
          }
        ]
      },
      textCorpus: {
        items: [
          {
            id: 'anti_curriculum_body',
            text: 'Students gather outside the ministry while families argue over the curriculum.',
            role: 'body',
            editability: 'text_proposal',
            owner: {kind: 'scene', sceneId: 'anti_curriculum', sectionId: ''},
            source: {path: eventScene.path, line: 8}
          },
          {
            id: 'fundraising_body',
            text: 'The treasurer lays out a small stack of receipts and asks how much energy the party can spend.',
            role: 'body',
            editability: 'text_proposal',
            owner: {kind: 'scene', sceneId: 'fundraising', sectionId: ''},
            source: {path: cardScene.path, line: 9}
          }
        ]
      }
    }
  };
}

const index = syntheticIndex();

const surface = draftExtract.extractDraftFromItem(index, 'surfaceText', 'surface_status_resources', {replacementLabel: '資金'});
assert(surface.ok, 'source-backed surface text should extract: ' + JSON.stringify(surface.diagnostics));
assert(surface.template === 'surface', 'surface extraction should target Surface Text template');
assert(surface.draft.originalLabel === '資源', 'surface draft should preserve original label');
assert(surface.draft.replacementLabel === '資金', 'surface draft should use replacement label');
assert(surfaceDraft.validateDraft(surface.draft).ok, 'surface extracted draft should validate');

const htmlSurface = draftExtract.extractDraftFromItem(index, 'surfaceText', 'surface_html_resources', {replacementLabel: '資金'});
assert(htmlSurface.ok, 'IDE-only surface text should still produce a draft guidance object');
assert(htmlSurface.status === 'ide_escape_hatch', 'IDE-only surface text should remain escape hatch');
assert(htmlSurface.draft.editability === 'ide_escape_hatch', 'IDE-only draft should not become safe apply');

const corpusBodyProposal = draftExtract.textReplacementDraftFromItem(index, 'textCorpus', {
  id: 'anti_curriculum_body_1',
  text: 'Original player-facing paragraph.',
  role: 'body',
  editability: 'text_proposal',
  owner: {kind: 'scene', sceneId: 'anti_curriculum'},
  source: {path: 'source/scenes/events/anti_curriculum.scene.dry', line: 42},
  confidence: 'static_inferred'
}, {replacementText: 'Rewritten player-facing paragraph.'});
assert(corpusBodyProposal.ok, 'Text Corpus body prose should seed a text replacement proposal');
assert(corpusBodyProposal.template === 'surface', 'Text Corpus text proposals should reuse Surface Text draft template');
assert(corpusBodyProposal.draft.editability === 'text_proposal', 'Text Corpus body prose should preserve text_proposal editability');
assert(surfaceDraft.validateDraft(corpusBodyProposal.draft).ok, 'Text Corpus text_proposal draft should validate against SurfaceTextDraft');
const corpusBodyBundle = surfaceDraft.buildExportBundle(corpusBodyProposal.draft);
assert(corpusBodyBundle.installPlan.operations[0].safety === 'guarded_apply', 'single-line Text Corpus body prose should become guarded apply in install plan');
assert(corpusBodyBundle.installPlan.operations[0].type === 'replace_text', 'single-line Text Corpus body prose should become guarded replace_text');

const multiLineCorpusProposal = draftExtract.textReplacementDraftFromItem(index, 'textCorpus', {
  id: 'anti_curriculum_body_2',
  text: 'Original player-facing paragraph.\nSecond original line.',
  role: 'body',
  editability: 'text_proposal',
  owner: {kind: 'scene', sceneId: 'anti_curriculum'},
  source: {path: 'source/scenes/events/anti_curriculum.scene.dry', line: 43, endLine: 44},
  confidence: 'static_inferred'
}, {replacementText: 'Rewritten multi-line player-facing paragraph.'});
assert(multiLineCorpusProposal.ok, 'multi-line Text Corpus body prose should still seed a proposal');
const multiLineCorpusBundle = surfaceDraft.buildExportBundle(multiLineCorpusProposal.draft);
assert(multiLineCorpusBundle.installPlan.operations[0].safety === 'manual_review', 'multi-line Text Corpus body prose should stay manual review in install plan');
assert(multiLineCorpusBundle.installPlan.operations[0].type === 'manual_snippet', 'multi-line Text Corpus body prose should not become automatic replace_text');

const news = draftExtract.extractDraftFromItem(index, 'news', index.semantic.news.items[0], {});
assert(news.ok, 'non-empty news should extract: ' + JSON.stringify(news.diagnostics));
assert(news.template === 'news', 'news extraction should target News template');
assert(news.status === 'partial', 'news extraction should be marked partial when year/month are absent');
assert(news.draft.headline === '[政治] 測試新聞', 'news draft should preserve headline');
assert(news.draft.when.slot === 2, 'news draft should parse news slot');
assert(newsDraft.normalizeDraft(news.draft).headline === '[政治] 測試新聞', 'news extracted draft should normalize');

const emptyNews = draftExtract.extractDraftFromItem(index, 'news', index.semantic.news.items[1], {});
assert(!emptyNews.ok, 'empty news reset assignments should not be offered as editable news');
assert(emptyNews.status === 'unsupported', 'empty news should report unsupported');

const event = draftExtract.extractDraftFromItem(index, 'events', 'anti_curriculum', {});
assert(event.ok, 'event should extract partial draft: ' + JSON.stringify(event.diagnostics));
assert(event.template === 'event', 'event extraction should target World Event template');
assert(event.status === 'partial', 'event extraction should be explicitly partial');
assert(event.draft.id === 'anti_curriculum_edit', 'event edit draft should avoid duplicate scene id');
assert(event.draft.when.year === 2015 && event.draft.when.monthStart === 7 && event.draft.when.monthEnd === 8, 'event window should be inferred from view-if');
assert(event.draft.seenFlag === 'anti_curriculum_seen', 'event seen flag should be inferred from view-if');
assert(event.draft.options.length === 3, 'event options should be seeded from parser options');
assert(event.draft.introParagraphs[0].includes('Students gather'), 'event draft extraction should preserve parser-backed source body prose');
assert(event.captured.includes('source-backed body paragraphs'), 'event draft extraction should report captured source body prose');
assert(eventDraft.validateDraft(event.draft, index).ok, 'event extracted draft should validate as a new proposal seed');

const card = draftExtract.extractDraftFromItem(index, 'cards', 'fundraising', {});
assert(card.ok, 'card should extract partial draft: ' + JSON.stringify(card.diagnostics));
assert(card.template === 'card', 'card extraction should target Card template');
assert(card.status === 'partial', 'card extraction should be explicitly partial');
assert(card.draft.id === 'fundraising_edit', 'card edit draft should avoid duplicate scene id');
assert(card.draft.frequency === 250, 'card frequency should be copied');
assert(card.draft.introParagraphs[0].includes('treasurer lays out'), 'card draft extraction should preserve parser-backed source body prose');
assert(card.draft.options.length === 4, 'card extraction should cap options at current wizard limit');
assert(card.diagnostics.some((diag) => diag.code === 'draft_extract.option_limit'), 'card option truncation should be diagnosed');
assert(cardDraft.validateDraft(card.draft, index).ok, 'card extracted draft should validate as a new proposal seed');

const existingCardEdit = existingSceneEdit.buildEditModel(index, 'cards', 'fundraising');
assert(existingCardEdit.ok, 'existing card edit model should build beside copy-as-new proposal extraction');
assert(existingCardEdit.options.length === 5, 'existing card edit path should preserve every option instead of capping at four');

const missing = draftExtract.extractDraftFromItem(index, 'events', 'does_not_exist', {});
assert(!missing.ok && missing.status === 'unsupported', 'missing row should be a structured unsupported result');

const viewerHtml = fs.readFileSync(path.join(__dirname, 'viewer', 'index.html'), 'utf8');
const viewerApp = readExploreBundle(path.join(__dirname, 'viewer'));
assert(viewerHtml.includes('../authoring/draft_extract.js'), 'viewer should load draft extraction bridge');
assert(viewerHtml.includes('../authoring/existing_scene_edit_model.js'), 'viewer should load existing scene edit model');
assert(viewerHtml.includes('existing_scene_edit_ui.js'), 'viewer should load existing scene editor UI');
assert(viewerApp.includes('data-edit-existing'), 'viewer should expose Edit existing inspector action');
assert(viewerApp.includes('Copy as new proposal'), 'viewer should keep Copy as new proposal inspector action');
assert(viewerApp.includes('data-edit-as-draft'), 'viewer should expose Edit as Draft inspector action');
assert(viewerApp.includes('ProjectMapDraftExtract'), 'viewer should call ProjectMapDraftExtract');
assert(viewerApp.includes('ProjectMapExistingSceneEditor'), 'viewer should call Existing Scene Editor for source-backed edits');
assert(viewerApp.includes('ProjectMapSurfaceTextWizard.loadDraft'), 'viewer should route surface drafts to Surface Text wizard');
assert(viewerApp.includes('ProjectMapNewsWizard.loadDraft'), 'viewer should route news drafts to News wizard');
assert(viewerApp.includes('ProjectMapCardWizard.loadDraft'), 'viewer should route card drafts to Card wizard');
assert(viewerApp.includes('ProjectMapWizard.loadDraft'), 'viewer should route event drafts to World Event wizard');

console.log(JSON.stringify({
  ok: true,
  surfaceStatus: surface.status,
  htmlSurfaceStatus: htmlSurface.status,
  newsStatus: news.status,
  eventStatus: event.status,
  cardStatus: card.status
}, null, 2));
