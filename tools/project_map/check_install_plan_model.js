#!/usr/bin/env node
// @ts-check
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');

const installPlan = require('./authoring/install_plan.js');
const applyInstallPlanCli = require('./apply_install_plan.js');
const eventDraft = require('./authoring/event_draft.js');
const newsDraft = require('./authoring/news_draft.js');
const cardDraft = require('./authoring/card_draft.js');
const surfaceDraft = require('./authoring/surface_text_draft.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const SAMPLE_EVENT = path.join(FIXTURES, 'event_drafts', 'sample_world_event.json');
const SAMPLE_NEWS = path.join(FIXTURES, 'news_drafts', 'sample_dated_news.json');
const SAMPLE_CARD = path.join(FIXTURES, 'card_drafts', 'sample_action_card.json');
const SAMPLE_SURFACE = path.join(FIXTURES, 'surface_text_drafts', 'sample_label_replacement.json');
const INSTALL_PLAN_SCHEMA = path.join(__dirname, 'schema', 'install-plan.schema.json');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function syntheticIndex(root) {
  return {
    schemaVersion: '0.1',
    project: {name: 'install fixture', root, profileIds: ['generic-dendry']},
    profiles: [{id: 'generic-dendry'}],
    scenes: [
      {id: 'root'},
      {id: 'status'},
      {
        id: 'main',
        path: 'source/scenes/main.scene.dry',
        options: [
          {id: '#party_affairs', target: {kind: 'tag', id: 'party_affairs'}, sourceSpan: {path: 'source/scenes/main.scene.dry', startLine: 2, endLine: 2}}
        ],
        sections: [
          {
            id: 'main.party',
            options: [
              {id: '#party_affairs', target: {kind: 'tag', id: 'party_affairs'}, sourceSpan: {path: 'source/scenes/main.scene.dry', startLine: 8, endLine: 8}}
            ]
          }
        ]
      }
    ],
    edges: [],
    variables: [{name: 'resources'}, {name: 'media_reach'}, {name: 'civil_society_trust'}],
    semantic: {
      events: [],
      cards: [],
      hands: [{id: 'main', path: 'source/scenes/main.scene.dry'}],
      decks: [],
      pinnedCards: [],
      news: {sources: ['source/scenes/post_event_news.scene.dry'], items: []}
    },
    diagnostics: [],
    summary: {}
  };
}

function bundleFile(bundle, suffix) {
  return bundle.files.find((file) => file.path.endsWith(suffix));
}

function assertInstallFiles(bundle, id) {
  assert(bundle.installPlan, id + ' bundle should expose installPlan object');
  assert(bundle.patchPreview && bundle.patchPreview.includes('diff --git'), id + ' bundle should expose patch preview');
  assert(bundleFile(bundle, '.install-plan.json'), id + ' bundle should include install-plan JSON file');
  assert(bundleFile(bundle, '.patch-preview.diff'), id + ' bundle should include patch preview file');
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_install_plan_fixture_'));
fs.mkdirSync(path.join(tmpRoot, 'source', 'scenes'), {recursive: true});
fs.writeFileSync(path.join(tmpRoot, 'source', 'info.dry'), 'title: Install Fixture\n', 'utf8');
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'status.scene.dry'),
  Array.from({length: 11}, (_, index) => 'line ' + (index + 1)).join('\n') + '\n資源：0\n',
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'root.scene.dry'),
  [
    'title: Old Root',
    'ROOT_LABEL',
    '= Old Start Menu',
    '',
    'Old start body.',
    '- @main: Enter project',
    '// ====== U. EVENT SEEN FLAGS ======',
    'Q.existing_seen = 0;',
    ''
  ].join('\n'),
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'post_event.scene.dry'),
  'POST_EVENT_LABEL\n// Save compatibility: post_event split (post_event_news)\nif (Q.existing_seen === undefined) Q.existing_seen = 0;\n',
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'post_event_news.scene.dry'),
  'POST_EVENT_NEWS_LABEL\n// 2014 headlines + background effects\n',
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'main.scene.dry'),
  [
    'title: Workspace Hand',
    'is-hand: true',
    '',
    '- @starter_deck: Draw from the starter deck',
    '- #demo_advisor: Review starter advisor',
    '- @root: Back to start',
    ''
  ].join('\n'),
  'utf8'
);
fs.mkdirSync(path.join(tmpRoot, 'source', 'scenes', 'decks'), {recursive: true});
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'decks', 'starter_deck.scene.dry'),
  [
    'title: Starter Deck',
    'is-deck: true',
    '',
    '- #demo_action',
    ''
  ].join('\n'),
  'utf8'
);
fs.mkdirSync(path.join(tmpRoot, 'source', 'scenes', 'events'), {recursive: true});
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'event_text.scene.dry'),
  'title: Event Text\n\nOriginal player-facing paragraph.\n',
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'section_text.scene.dry'),
  'title: Section Text\n\n= Old Section\n\nOld section body.\nTail stays put.\n',
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'section_ambiguous.scene.dry'),
  'title: Ambiguous Section\n\n= Old Section\n\nOld section body.\n= Old Section\n',
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'section_crlf.scene.dry'),
  'title: CRLF Section\r\n\r\n= Old CRLF Section\r\n\r\nOld CRLF body.\r\nTail stays put.\r\n',
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'section_trailing.scene.dry'),
  [
    'title: Trailing Section',
    '',
    '= Old Trailing Section   ',
    '',
    'First branch paragraph.',
    'Second branch paragraph.   ',
    'Tail stays put.',
    ''
  ].join('\n'),
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'section_trim_ambiguous.scene.dry'),
  [
    'title: Trim Ambiguous Section',
    '',
    '= Trim Anchor   ',
    'Body one.',
    '= Trim Anchor\t',
    'Body two.',
    ''
  ].join('\n'),
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'transaction.scene.dry'),
  ['title: Transaction', 'LINE_ONE', 'LINE_TWO', ''].join('\n'),
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'sequential.scene.dry'),
  ['title: Sequential', 'alpha', 'omega', ''].join('\n'),
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'report.scene.dry'),
  ['title: Report', 'first report line', 'second report line', 'third report line', ''].join('\n'),
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'same_line_effect.scene.dry'),
  [
    'title: Same Line Effect',
    'on-arrival: z_leader = "Kaas"; z_relation -= 5; prussian_concordat_progress += 1; z_ideology = "Right"; resources += 9',
    ''
  ].join('\n'),
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'center_party_conference.scene.dry'),
  [
    'title: Center Party Conference',
    'on-arrival: z_leader = "Kaas"; z_relation -= 5; prussian_concordat_progress += 1; z_ideology = "Right"',
    'face-image: img/portraits/Ludwig_Kaas.jpg',
    '',
    'Ludwig Kaas has been selected as the chairman of the Center Party. He seems to represent a rightward turn from Marx, and will preside over a Center Party less inclined to compromise with the left.   ',
    'Despite this, Kaas is committed to the current constitutional order and the republic. He maintains a close friendship with Eugenio Pacelli, the Papal Nuncio to Germany, which may prove useful during concordat negotiations.',
    ''
  ].join('\n'),
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'insert_dedupe.scene.dry'),
  'title: Insert Dedupe\r\nMention @sample_route elsewhere.\r\nANCHOR ROUTES\r\nTail stays put.\r\n',
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'insert_line_disambiguated.scene.dry'),
  [
    'title: Insert Line Disambiguated',
    '- @repeat: First repeated anchor',
    'Body stays put.',
    '- @repeat: Second repeated anchor',
    'Tail stays put.',
    ''
  ].join('\n'),
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'same_anchor_insert.scene.dry'),
  [
    'title: Same Anchor Insert',
    '',
    'Shared body anchor.',
    'Tail stays put.',
    ''
  ].join('\n'),
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'same_line_shift_replace.scene.dry'),
  [
    'title: Same Line Shift Replace',
    '',
    'Shared editable line.',
    'Tail stays put.',
    ''
  ].join('\n'),
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'same_section_shift_replace.scene.dry'),
  [
    'title: Same Section Shift Replace',
    '',
    '= Shared Section',
    '',
    'Shared section body.',
    'Tail stays put.',
    ''
  ].join('\n'),
  'utf8'
);
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'already_applied.scene.dry'),
  'title: Already Applied\n\nOld label\n',
  'utf8'
);
const index = syntheticIndex(tmpRoot);

const eventBundle = eventDraft.buildExportBundle(readJson(SAMPLE_EVENT), index);
const newsBundle = newsDraft.buildExportBundle(readJson(SAMPLE_NEWS), index);
const cardBundle = cardDraft.buildExportBundle(readJson(SAMPLE_CARD), index);
const surfaceBundle = surfaceDraft.buildExportBundle(readJson(SAMPLE_SURFACE), index);
const schema = readJson(INSTALL_PLAN_SCHEMA);

assertInstallFiles(eventBundle, 'event');
assertInstallFiles(newsBundle, 'news');
assertInstallFiles(cardBundle, 'card');
assertInstallFiles(surfaceBundle, 'surface');
assert(eventBundle.installPlan.project && eventBundle.installPlan.project.root === tmpRoot, 'event plan should record source project provenance');
assert(newsBundle.installPlan.project && newsBundle.installPlan.project.root === tmpRoot, 'news plan should record source project provenance');
assert(cardBundle.installPlan.project && cardBundle.installPlan.project.root === tmpRoot, 'card plan should record source project provenance');
assert(surfaceBundle.installPlan.project && surfaceBundle.installPlan.project.root === tmpRoot, 'surface plan should record source project provenance');

assert(eventBundle.installPlan.operations.some((op) => op.type === 'create_file' && op.safety === 'safe_apply'), 'event plan should safely create scene file');
assert(eventBundle.installPlan.operations.some((op) => op.id === 'root_seen_flag' && op.type === 'insert_text' && op.safety === 'guarded_apply'), 'event plan should guarded-insert root seen flag init');
assert(eventBundle.installPlan.operations.some((op) => op.id === 'post_event_migration' && op.type === 'insert_text' && op.safety === 'guarded_apply'), 'event plan should guarded-insert post_event migration guard');
assert(installPlan.operationSummary(eventBundle.installPlan).manualReview === 0, 'event plan should not leave root/post_event snippets as manual when anchors are known');
assert(installPlan.operationSummary(eventBundle.installPlan).guardedApply === 2, 'event plan should count root/post_event inserts as guarded operations');
assert(newsBundle.installPlan.operations.some((op) => op.type === 'insert_text' && op.safety === 'guarded_apply'), 'news plan should guarded-insert post_event_news snippets when router anchor evidence is known');
assert(installPlan.operationSummary(newsBundle.installPlan).guardedApply === 1, 'news plan should count one guarded post_event_news insert');
const noEvidenceNewsBundle = newsDraft.buildExportBundle(readJson(SAMPLE_NEWS), {
  schemaVersion: '0.1',
  project: {name: 'no news router evidence', root: tmpRoot, profileIds: ['generic-dendry']},
  semantic: {news: {items: []}},
  scenes: [],
  variables: []
});
assert(noEvidenceNewsBundle.installPlan.operations.every((op) => op.safety === 'manual_review'), 'news plan without post_event_news evidence should stay manual');
assert(cardBundle.installPlan.operations.some((op) => op.type === 'create_file'), 'card plan should safely create scene file');
assert(!cardBundle.installPlan.operations.some((op) => op.id === 'wire_card_flow'), 'card plan should not create a manual wiring step when a matching tag route already exists');
assert(installPlan.operationSummary(cardBundle.installPlan).manualReview === 0, 'tag-routed card plan should have no manual wiring steps');
const deckWiringIndex = {
  schemaVersion: '0.1',
  project: {name: 'deck wiring fixture', root: tmpRoot, profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry'}],
  scenes: [
    {id: 'root'},
    {
      id: 'starter_deck',
      title: 'Starter Deck',
      type: 'deck',
      path: 'source/scenes/decks/starter_deck.scene.dry',
      sourceSpan: {path: 'source/scenes/decks/starter_deck.scene.dry', startLine: 1, endLine: 4, line: 1, anchorText: 'title: Starter Deck', endAnchorText: '- #demo_action'},
      options: [
        {id: '#demo_action', target: {kind: 'tag', id: 'demo_action'}, sourceSpan: {path: 'source/scenes/decks/starter_deck.scene.dry', startLine: 4, endLine: 4, line: 4, anchorText: '- #demo_action', endAnchorText: '- #demo_action'}}
      ],
      sections: []
    }
  ],
  variables: [{name: 'resources'}, {name: 'media_reach'}, {name: 'civil_society_trust'}],
  semantic: {events: [], cards: [], hands: [], decks: [{id: 'starter_deck', path: 'source/scenes/decks/starter_deck.scene.dry'}], pinnedCards: []},
  diagnostics: [],
  summary: {}
};
const deckWiredCardBundle = cardDraft.buildExportBundle(Object.assign({}, readJson(SAMPLE_CARD), {
  id: 'deck_wired_card',
  title: 'Deck Wired Card',
  tags: ['cards']
}), deckWiringIndex);
const deckRouteOp = deckWiredCardBundle.installPlan.operations.find((op) => op.id === 'card_deck_tag_route');
assert(deckRouteOp && deckRouteOp.type === 'insert_text' && deckRouteOp.safety === 'guarded_apply', 'card plan should guarded-insert a deck tag route when deck source anchors are exact');
assert(deckRouteOp.path === 'source/scenes/decks/starter_deck.scene.dry', 'deck tag route should target the source-backed deck scene');
assert(deckRouteOp.content === '- #cards\n', 'deck tag route should insert the generated card tag');
assert(installPlan.operationSummary(deckWiredCardBundle.installPlan).manualReview === 0, 'source-backed deck wiring should not leave manual wiring');
const deckWiringApply = installPlan.applyInstallPlan(deckWiredCardBundle.installPlan, {projectRoot: tmpRoot, dryRun: false});
assert(deckWiringApply.ok, 'deck-wired card install should apply: ' + JSON.stringify(deckWiringApply));
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'decks', 'starter_deck.scene.dry'), 'utf8').includes('- #cards'), 'apply should insert the new card tag into the deck');
fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'inline_hand.scene.dry'),
  [
    'title: Inline Hand',
    'is-hand: true',
    '',
    '- @inline_deck',
    '',
    '@inline_deck',
    'title: Inline Deck',
    'is-deck: true',
    '',
    '- #demo_action',
    ''
  ].join('\n'),
  'utf8'
);
const sectionDeckWiringIndex = {
  schemaVersion: '0.1',
  project: {name: 'section deck wiring fixture', root: tmpRoot, profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry'}],
  scenes: [
    {id: 'root'},
    {
      id: 'inline_hand',
      title: 'Inline Hand',
      type: 'hand',
      path: 'source/scenes/inline_hand.scene.dry',
      sourceSpan: {path: 'source/scenes/inline_hand.scene.dry', startLine: 1, endLine: 10, line: 1, anchorText: 'title: Inline Hand', endAnchorText: '- #demo_action'},
      options: [
        {id: '@inline_deck', target: {kind: 'scene', id: 'inline_deck'}, sourceSpan: {path: 'source/scenes/inline_hand.scene.dry', startLine: 4, endLine: 4, line: 4, anchorText: '- @inline_deck', endAnchorText: '- @inline_deck'}}
      ],
      sections: [{
        id: 'inline_hand.inline_deck',
        title: 'Inline Deck',
        isDeck: 'true',
        path: 'source/scenes/inline_hand.scene.dry',
        sourceSpan: {path: 'source/scenes/inline_hand.scene.dry', startLine: 6, endLine: 10, line: 6, anchorText: '@inline_deck', endAnchorText: '- #demo_action'},
        options: [
          {id: '#demo_action', target: {kind: 'tag', id: 'demo_action'}, sourceSpan: {path: 'source/scenes/inline_hand.scene.dry', startLine: 10, endLine: 10, line: 10, anchorText: '- #demo_action', endAnchorText: '- #demo_action'}}
        ]
      }]
    }
  ],
  variables: [{name: 'resources'}, {name: 'media_reach'}, {name: 'civil_society_trust'}],
  semantic: {
    events: [],
    cards: [],
    hands: [{id: 'inline_hand', path: 'source/scenes/inline_hand.scene.dry'}],
    decks: [{
      id: 'inline_hand.inline_deck',
      path: 'source/scenes/inline_hand.scene.dry',
      title: 'Inline Deck',
      type: 'deck',
      ownerKind: 'section',
      ownerSceneId: 'inline_hand',
      sourceSpan: {path: 'source/scenes/inline_hand.scene.dry', startLine: 6, endLine: 10, line: 6, anchorText: '@inline_deck', endAnchorText: '- #demo_action'},
      options: [
        {id: '#demo_action', target: {kind: 'tag', id: 'demo_action'}, sourceSpan: {path: 'source/scenes/inline_hand.scene.dry', startLine: 10, endLine: 10, line: 10, anchorText: '- #demo_action', endAnchorText: '- #demo_action'}}
      ]
    }],
    pinnedCards: []
  },
  diagnostics: [],
  summary: {}
};
const sectionDeckWiredCardBundle = cardDraft.buildExportBundle(Object.assign({}, readJson(SAMPLE_CARD), {
  id: 'section_deck_wired_card',
  title: 'Section Deck Wired Card',
  tags: ['section_cards']
}), sectionDeckWiringIndex);
const sectionDeckRouteOp = sectionDeckWiredCardBundle.installPlan.operations.find((op) => op.id === 'card_deck_tag_route');
assert(sectionDeckRouteOp && sectionDeckRouteOp.path === 'source/scenes/inline_hand.scene.dry', 'card plan should route section-owned deck inserts back to the owning source file');
assert(sectionDeckRouteOp.line === 10 && sectionDeckRouteOp.anchorText === '- #demo_action', 'section-owned deck wiring should use the deck section option anchor');
assert(sectionDeckRouteOp.content === '- #section_cards\n', 'section-owned deck wiring should insert the generated card tag');
assert(installPlan.operationSummary(sectionDeckWiredCardBundle.installPlan).manualReview === 0, 'section-owned deck wiring should not leave manual wiring');
const sectionDeckWiringApply = installPlan.applyInstallPlan(sectionDeckWiredCardBundle.installPlan, {projectRoot: tmpRoot, dryRun: false});
assert(sectionDeckWiringApply.ok, 'section-owned deck-wired card install should apply: ' + JSON.stringify(sectionDeckWiringApply));
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'inline_hand.scene.dry'), 'utf8').includes('- #section_cards'), 'apply should insert the new card tag into the inline deck section');
const advisorWiringIndex = {
  schemaVersion: '0.1',
  project: {name: 'advisor wiring fixture', root: tmpRoot, profileIds: ['generic-dendry']},
  profiles: [{id: 'generic-dendry', uiLabels: {advisorLikeSingular: 'Advisor', advisorLikePlural: 'Advisors'}}],
  scenes: [
    {id: 'root'},
    {
      id: 'main',
      title: 'Workspace Hand',
      type: 'hand',
      path: 'source/scenes/main.scene.dry',
      sourceSpan: {path: 'source/scenes/main.scene.dry', startLine: 1, endLine: 6, line: 1, anchorText: 'title: Workspace Hand', endAnchorText: '- @root: Back to start'},
      options: [
        {id: '#demo_advisor', target: {kind: 'tag', id: 'demo_advisor'}, sourceSpan: {path: 'source/scenes/main.scene.dry', startLine: 5, endLine: 5, line: 5, anchorText: '- #demo_advisor: Review starter advisor', endAnchorText: '- #demo_advisor: Review starter advisor'}},
        {id: '@root', target: {kind: 'scene', id: 'root'}, sourceSpan: {path: 'source/scenes/main.scene.dry', startLine: 6, endLine: 6, line: 6, anchorText: '- @root: Back to start', endAnchorText: '- @root: Back to start'}}
      ]
    }
  ],
  variables: [{name: 'resources'}, {name: 'media_reach'}, {name: 'civil_society_trust'}],
  semantic: {events: [], cards: [], hands: [{id: 'main', path: 'source/scenes/main.scene.dry'}], decks: [], pinnedCards: []},
  diagnostics: [],
  summary: {}
};
const advisorWiredBundle = cardDraft.buildExportBundle(Object.assign({}, readJson(SAMPLE_CARD), {
  id: 'circle_advisor',
  title: 'Circle Advisor',
  heading: 'Circle Advisor',
  cardKind: 'advisor_like',
  tags: ['circle']
}), advisorWiringIndex);
const advisorRouteOp = advisorWiredBundle.installPlan.operations.find((op) => op.id === 'card_advisor_tag_route');
assert(advisorRouteOp && advisorRouteOp.type === 'insert_text' && advisorRouteOp.safety === 'guarded_apply', 'advisor-like card plan should guarded-insert a hand tag route when hand source anchors are exact');
assert(advisorRouteOp.content.includes('- #circle: Review Circle Advisor'), 'advisor hand route should include a readable route label');
assert(installPlan.operationSummary(advisorWiredBundle.installPlan).manualReview === 0, 'source-backed advisor wiring should not leave manual wiring');
assert(surfaceBundle.installPlan.operations.some((op) => op.type === 'replace_text'), 'surface plan should include a safe text replacement operation');
assert(schema.properties.schemaVersion.const === '0.1', 'install-plan schema should describe v0.1');
assert(schema.properties.operations.items.properties.type.enum.includes('insert_text'), 'install-plan schema should allow structured insert_text operations');
assert(schema.properties.operations.items.properties.type.enum.includes('replace_section'), 'install-plan schema should allow structured replace_section operations');
assert(schema.properties.operations.items.properties.startLine, 'install-plan schema should describe replace_section startLine evidence');
assert(schema.properties.operations.items.properties.endLine, 'install-plan schema should describe replace_section endLine evidence');
assert(schema.properties.operations.items.properties.type.enum.includes('copy_asset_file'), 'install-plan schema should allow asset file install proposals');

const eventAssetBundle = eventDraft.buildExportBundle(Object.assign({}, readJson(SAMPLE_EVENT), {
  id: 'asset_install_event',
  seenFlag: 'asset_install_event_seen',
  assetRefs: [
    {path: 'assets/studio/events/asset_install_event/portrait-hero.png', type: 'image', label: 'Portrait Hero', role: 'event_illustration'}
  ],
  assetInstallRequests: [
    {
      sourceName: 'Portrait Hero.PNG',
      targetPath: 'assets/studio/events/asset_install_event/portrait-hero.png',
      type: 'image',
      label: 'Portrait Hero',
      role: 'event_illustration'
    }
  ]
}), index);
assert(eventAssetBundle.draft.assetInstallRequests[0].targetPath.includes('portrait-hero.png'), 'EventDraft should preserve asset install requests');
assert(eventAssetBundle.installPlan.operations.some((op) => op.type === 'copy_asset_file' && op.safety === 'manual_review'), 'event install plan should surface asset copy proposals as manual review');
assert(installPlan.operationSummary(eventAssetBundle.installPlan).manualReview === 1, 'asset copy proposals should stay manual until desktop copy safety is implemented');
assert(installPlan.renderOperationChecklist(eventAssetBundle.installPlan).includes('copy_asset_file'), 'operation checklist should name asset copy proposals');
assert(installPlan.renderPatchPreview(eventAssetBundle.installPlan).includes('Portrait Hero.PNG'), 'patch preview should explain the selected source asset');

const cardAssetBundle = cardDraft.buildExportBundle(Object.assign({}, readJson(SAMPLE_CARD), {
  id: 'asset_install_card',
  assetRefs: [
    {path: 'assets/studio/cards/asset_install_card/card-art.png', type: 'image', label: 'Card art', role: 'card_image'}
  ],
  assetInstallRequests: [
    {
      sourceName: 'Card Art.PNG',
      targetPath: 'assets/studio/cards/asset_install_card/card-art.png',
      type: 'image',
      label: 'Card art',
      role: 'card_image'
    }
  ]
}), index);
assert(cardAssetBundle.draft.assetInstallRequests[0].role === 'card_image', 'CardDraft should preserve asset install request role metadata');
assert(cardAssetBundle.installPlan.operations.some((op) => op.type === 'copy_asset_file' && op.path === 'assets/studio/cards/asset_install_card/card-art.png'), 'card install plan should include asset copy proposal targets');

const sourceAssetDir = path.join(tmpRoot, '_asset_sources');
fs.mkdirSync(sourceAssetDir, {recursive: true});
const sourceAssetPath = path.join(sourceAssetDir, 'Portrait Hero.PNG');
fs.writeFileSync(sourceAssetPath, Buffer.from('fake image bytes'));
const copyAssetPlan = installPlan.buildInstallPlan({
  id: 'copy_asset_guarded',
  draftKind: 'asset',
  operations: [
    {
      id: 'copy_asset_file_1',
      type: 'copy_asset_file',
      path: 'assets/studio/events/copy_asset_guarded/portrait-hero.png',
      sourceName: 'Portrait Hero.PNG',
      sourcePath: sourceAssetPath,
      assetType: 'image',
      safety: 'guarded_apply'
    }
  ]
});
const copyAssetClassification = installPlan.classifyOperation(copyAssetPlan.operations[0]);
assert(copyAssetClassification.status === 'guarded_apply', 'desktop copy_asset_file with sourcePath should become guarded installable');
const relativeSourceAssetPlan = installPlan.buildInstallPlan({
  id: 'copy_asset_relative_source',
  draftKind: 'asset',
  operations: [
    {
      id: 'copy_asset_file_relative_source',
      type: 'copy_asset_file',
      path: 'assets/studio/events/copy_asset_guarded/relative-source.png',
      sourceName: 'Relative Source.PNG',
      sourcePath: 'relative/source.png',
      assetType: 'image',
      safety: 'guarded_apply'
    }
  ]
});
const relativeSourceClassification = installPlan.classifyOperation(relativeSourceAssetPlan.operations[0]);
assert(relativeSourceClassification.status === 'refused', 'copy_asset_file should refuse relative sourcePath at classification time');
assert(relativeSourceClassification.reason.includes('absolute desktop sourcePath'), 'relative sourcePath refusal should explain the desktop sourcePath requirement');
const unsafeCopyTargetPlan = installPlan.buildInstallPlan({
  id: 'copy_asset_unsafe_target',
  draftKind: 'asset',
  operations: [
    {
      id: 'copy_asset_file_unsafe_target',
      type: 'copy_asset_file',
      path: 'out/html/portrait-hero.png',
      sourceName: 'Portrait Hero.PNG',
      sourcePath: sourceAssetPath,
      assetType: 'image',
      safety: 'guarded_apply'
    }
  ]
});
const unsafeCopyTargetClassification = installPlan.classifyOperation(unsafeCopyTargetPlan.operations[0]);
assert(unsafeCopyTargetClassification.status === 'refused', 'copy_asset_file should refuse generated runtime output targets');
assert(unsafeCopyTargetClassification.reason.includes('generated/protected output') || unsafeCopyTargetClassification.reason.includes('project asset folders'), 'unsafe copy target refusal should explain the generated output or asset folder boundary');
const copyAssetDryRun = installPlan.applyInstallPlan(copyAssetPlan, {projectRoot: tmpRoot, dryRun: true});
assert(copyAssetDryRun.ok, 'asset copy dry-run should succeed when source and target are safe: ' + JSON.stringify(copyAssetDryRun));
assert(copyAssetDryRun.results[0].status === 'would_apply', 'asset copy dry-run should report would_apply');
assert(copyAssetDryRun.results[0].sourceHash, 'asset copy dry-run should report a source hash for review');
assert(!fs.existsSync(path.join(tmpRoot, 'assets', 'studio', 'events', 'copy_asset_guarded', 'portrait-hero.png')), 'asset copy dry-run must not write the target file');
const copyAssetApply = installPlan.applyInstallPlan(copyAssetPlan, {projectRoot: tmpRoot, dryRun: false});
assert(copyAssetApply.ok, 'asset copy apply should copy the file after guarded dry-run checks: ' + JSON.stringify(copyAssetApply));
const copiedAssetPath = path.join(tmpRoot, 'assets', 'studio', 'events', 'copy_asset_guarded', 'portrait-hero.png');
assert(fs.readFileSync(copiedAssetPath, 'utf8') === 'fake image bytes', 'asset copy apply should write the selected source bytes to the project target');
const copyAssetAgain = installPlan.applyInstallPlan(copyAssetPlan, {projectRoot: tmpRoot, dryRun: false});
assert(copyAssetAgain.ok, 'reapplying identical asset copy should be idempotent');
assert(copyAssetAgain.results[0].status === 'already_applied', 'identical asset copy should report already_applied');
fs.writeFileSync(copiedAssetPath, 'different bytes', 'utf8');
const copyAssetConflict = installPlan.applyInstallPlan(copyAssetPlan, {projectRoot: tmpRoot, dryRun: true});
assert(!copyAssetConflict.ok, 'asset copy dry-run should block overwrite conflicts');
assert(copyAssetConflict.diagnostics.some((diag) => diag.code === 'install_plan.copy_conflict'), 'asset copy conflict should report copy_conflict diagnostic');

const eventChecklist = installPlan.renderOperationChecklist(eventBundle.installPlan);
assert(eventChecklist.includes('Safe apply'), 'operation checklist should name safe apply operations');
assert(eventChecklist.includes('Guarded install'), 'operation checklist should name guarded install operations');
assert(eventChecklist.includes('source/scenes/events/sample_world_event.scene.dry'), 'operation checklist should include event scene path');
assert(eventChecklist.includes('source/scenes/post_event.scene.dry'), 'operation checklist should include guarded post_event path');

const eventDryRun = installPlan.applyInstallPlan(eventBundle.installPlan, {projectRoot: tmpRoot, dryRun: true});
assert(eventDryRun.ok, 'event dry-run should apply create + guarded inserts: ' + JSON.stringify(eventDryRun));
assert(eventDryRun.operationSummary.safeApply === 1, 'event dry-run should count one safe create operation');
assert(eventDryRun.operationSummary.guardedApply === 2, 'event dry-run should count two guarded insert operations');
const eventApply = installPlan.applyInstallPlan(eventBundle.installPlan, {projectRoot: tmpRoot, dryRun: false});
assert(eventApply.ok, 'event apply should create scene and insert guarded init/migration: ' + JSON.stringify(eventApply));
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'root.scene.dry'), 'utf8').includes('Q.sample_world_event_seen = 0;'), 'event apply should insert root seen flag init');
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'post_event.scene.dry'), 'utf8').includes('Q.sample_world_event_seen === undefined'), 'event apply should insert post_event migration guard');
const eventApplyAgain = installPlan.applyInstallPlan(eventBundle.installPlan, {projectRoot: tmpRoot, dryRun: false});
assert(eventApplyAgain.ok, 'reapplying identical event create should be idempotent: ' + JSON.stringify(eventApplyAgain));
assert(eventApplyAgain.results.some((result) => result.id === 'create_scene' && result.status === 'already_applied'), 'identical event scene create should report already_applied');
fs.writeFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'sample_world_event.scene.dry'), 'title: Different Existing Event\n', 'utf8');
const eventCreateConflict = installPlan.applyInstallPlan(eventBundle.installPlan, {projectRoot: tmpRoot, dryRun: true});
assert(!eventCreateConflict.ok, 'different existing event scene should still block create_file overwrite');
assert(eventCreateConflict.diagnostics.some((diag) => diag.code === 'install_plan.create_exists'), 'different existing event scene should report create_exists');

const newsDryRun = installPlan.applyInstallPlan(newsBundle.installPlan, {projectRoot: tmpRoot, dryRun: true});
assert(newsDryRun.ok, 'news dry-run should accept guarded post_event_news insert: ' + JSON.stringify(newsDryRun));
assert(newsDryRun.operationSummary.guardedApply === 1, 'news dry-run should count one guarded insert');
const newsApply = installPlan.applyInstallPlan(newsBundle.installPlan, {projectRoot: tmpRoot, dryRun: false});
assert(newsApply.ok, 'news apply should insert anchored post_event_news snippet: ' + JSON.stringify(newsApply));
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'post_event_news.scene.dry'), 'utf8').includes('// NewsDraft: sample_dated_news'), 'news apply should insert the generated NewsDraft snippet');

const replaceSectionPlan = installPlan.buildInstallPlan({
  id: 'replace_section_guarded',
  draftKind: 'test',
  operations: [
    {
      id: 'replace_section_guarded',
      type: 'replace_section',
      path: 'source/scenes/events/section_text.scene.dry',
      anchorText: '= Old Section',
      endAnchorText: 'Old section body.',
      content: '= New Section\n\nNew section body.\n',
      dedupeSearch: 'New section body.',
      safety: 'guarded_apply',
      description: 'Replace a source-backed scene section between exact anchors.'
    }
  ]
});
assert(installPlan.classifyOperation(replaceSectionPlan.operations[0]).status === 'guarded_apply', 'replace_section with source anchors should be guarded installable');
assert(installPlan.renderOperationChecklist(replaceSectionPlan).includes('replace_section'), 'operation checklist should name replace_section');
assert(installPlan.renderPatchPreview(replaceSectionPlan).includes('@@ replace section'), 'patch preview should render replace_section hunks');
const replaceSectionDryRun = installPlan.applyInstallPlan(replaceSectionPlan, {projectRoot: tmpRoot, dryRun: true});
assert(replaceSectionDryRun.ok, 'replace_section dry-run should succeed: ' + JSON.stringify(replaceSectionDryRun));
assert(replaceSectionDryRun.results[0].status === 'would_apply', 'replace_section dry-run should report would_apply');
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'section_text.scene.dry'), 'utf8').includes('Old section body.'), 'replace_section dry-run must not mutate source');
const replaceSectionApply = installPlan.applyInstallPlan(replaceSectionPlan, {projectRoot: tmpRoot, dryRun: false});
assert(replaceSectionApply.ok, 'replace_section apply should succeed: ' + JSON.stringify(replaceSectionApply));
const replacedSectionText = fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'section_text.scene.dry'), 'utf8');
assert(replacedSectionText.includes('New section body.'), 'replace_section apply should write replacement content');
assert(replacedSectionText.includes('Tail stays put.'), 'replace_section apply should preserve content after the end anchor');
assert(!replacedSectionText.includes('Old section body.'), 'replace_section apply should remove the old inclusive anchor range');
const replaceSectionAgain = installPlan.applyInstallPlan(replaceSectionPlan, {projectRoot: tmpRoot, dryRun: false});
assert(replaceSectionAgain.ok && replaceSectionAgain.results[0].status === 'already_applied', 'replace_section should be idempotent when dedupe text is present');

const replaceSectionCrlfPlan = installPlan.buildInstallPlan({
  id: 'replace_section_crlf',
  draftKind: 'test',
  operations: [
    {
      id: 'replace_section_crlf',
      type: 'replace_section',
      path: 'source/scenes/events/section_crlf.scene.dry',
      anchorText: '= Old CRLF Section',
      endAnchorText: 'Old CRLF body.',
      content: '= New CRLF Section\n\nNew CRLF body.\n',
      dedupeSearch: 'New CRLF body.',
      safety: 'guarded_apply',
      description: 'Replace a CRLF source-backed scene section between exact anchors.'
    }
  ]
});
const replaceSectionCrlfApply = installPlan.applyInstallPlan(replaceSectionCrlfPlan, {projectRoot: tmpRoot, dryRun: false});
assert(replaceSectionCrlfApply.ok, 'replace_section should match CRLF anchors and apply: ' + JSON.stringify(replaceSectionCrlfApply));
const replacedSectionCrlfText = fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'section_crlf.scene.dry'), 'utf8');
assert(replacedSectionCrlfText.includes('= New CRLF Section\r\n\r\nNew CRLF body.\r\nTail stays put.\r\n'), 'replace_section should preserve CRLF line endings around replacement content');
assert(!/[^\r]\n/.test(replacedSectionCrlfText), 'replace_section should not introduce bare LF into a CRLF source file');

const trailingSectionPlan = installPlan.buildInstallPlan({
  id: 'replace_section_trailing_whitespace',
  draftKind: 'test',
  operations: [
    {
      id: 'replace_section_trailing_whitespace',
      type: 'replace_section',
      path: 'source/scenes/events/section_trailing.scene.dry',
      anchorText: '= Old Trailing Section',
      endAnchorText: 'Second branch paragraph.',
      content: '= Old Trailing Section\n\nFirst branch paragraph.\nSecond branch paragraph.\nTest! Test!\n',
      dedupeSearch: 'Test! Test!',
      startLine: 3,
      endLine: 6,
      safety: 'guarded_apply',
      description: 'Replace a source-backed section whose stored display anchors were trimmed.'
    }
  ]
});
const trailingSectionDryRun = installPlan.applyInstallPlan(trailingSectionPlan, {projectRoot: tmpRoot, dryRun: true, includeEvidence: true});
assert(trailingSectionDryRun.ok, 'replace_section should accept trim-equivalent line evidence when old indexes lack raw anchors: ' + JSON.stringify(trailingSectionDryRun));
assert(trailingSectionDryRun.results[0].evidence.match === 'matched_current_section_trim_equivalent', 'trim-equivalent replace_section evidence should be explicit');
const rawMismatchSectionPlan = installPlan.buildInstallPlan({
  id: 'replace_section_raw_mismatch',
  draftKind: 'test',
  operations: [
    {
      id: 'replace_section_raw_mismatch',
      type: 'replace_section',
      path: 'source/scenes/events/section_trailing.scene.dry',
      anchorText: '= Old Trailing Section',
      rawAnchorText: '= Old Trailing Section',
      endAnchorText: 'Second branch paragraph.',
      startLine: 3,
      endLine: 6,
      content: '= Changed\n',
      dedupeSearch: '= Changed',
      safety: 'guarded_apply'
    }
  ]
});
const rawMismatchSectionResult = installPlan.applyInstallPlan(rawMismatchSectionPlan, {projectRoot: tmpRoot, dryRun: true});
assert(!rawMismatchSectionResult.ok, 'replace_section should refuse mismatched raw source evidence instead of trimming it');
assert(rawMismatchSectionResult.diagnostics.some((diag) => diag.code === 'install_plan.section_start_line_mismatch'), 'raw anchor mismatch should report section_start_line_mismatch');
const driftedSectionPlan = installPlan.buildInstallPlan({
  id: 'replace_section_line_drift',
  draftKind: 'test',
  operations: [
    {
      id: 'replace_section_line_drift',
      type: 'replace_section',
      path: 'source/scenes/events/section_trailing.scene.dry',
      anchorText: '= Old Trailing Section',
      endAnchorText: 'Second branch paragraph.',
      startLine: 4,
      endLine: 6,
      content: '= Changed\n',
      dedupeSearch: '= Changed',
      safety: 'guarded_apply'
    }
  ]
});
const driftedSectionResult = installPlan.applyInstallPlan(driftedSectionPlan, {projectRoot: tmpRoot, dryRun: true});
assert(!driftedSectionResult.ok, 'replace_section should fail stale line evidence instead of falling back to a global anchor search');
assert(driftedSectionResult.diagnostics.some((diag) => diag.code === 'install_plan.section_start_line_mismatch'), 'stale replace_section line evidence should report section_start_line_mismatch');
const ambiguousTrimSectionPlan = installPlan.buildInstallPlan({
  id: 'replace_section_ambiguous_trim',
  draftKind: 'test',
  operations: [
    {
      id: 'replace_section_ambiguous_trim',
      type: 'replace_section',
      path: 'source/scenes/events/section_trim_ambiguous.scene.dry',
      anchorText: '= Trim Anchor',
      endAnchorText: 'Body one.',
      content: '= Changed\n',
      dedupeSearch: '= Changed',
      safety: 'guarded_apply'
    }
  ]
});
const ambiguousTrimSectionResult = installPlan.applyInstallPlan(ambiguousTrimSectionPlan, {projectRoot: tmpRoot, dryRun: true});
assert(!ambiguousTrimSectionResult.ok, 'replace_section should refuse ambiguous trim-equivalent anchors without line evidence');
assert(ambiguousTrimSectionResult.diagnostics.some((diag) => diag.code === 'install_plan.section_ambiguous_anchor'), 'ambiguous trim fallback should report section_ambiguous_anchor');
const trailingSectionApply = installPlan.applyInstallPlan(trailingSectionPlan, {projectRoot: tmpRoot, dryRun: false});
assert(trailingSectionApply.ok, 'trim-equivalent replace_section should apply after source evidence passes: ' + JSON.stringify(trailingSectionApply));
const trailingSectionText = fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'section_trailing.scene.dry'), 'utf8');
assert(trailingSectionText.includes('Test! Test!\nTail stays put.'), 'trim-equivalent replace_section should preserve text after the replaced range');
const trailingSectionAgain = installPlan.applyInstallPlan(trailingSectionPlan, {projectRoot: tmpRoot, dryRun: true, includeEvidence: true});
assert(trailingSectionAgain.ok && trailingSectionAgain.results[0].status === 'already_applied', 'replace_section should be idempotent when the replacement keeps the same anchors');

const transactionBefore = fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'transaction.scene.dry'), 'utf8');
const transactionPlan = installPlan.buildInstallPlan({
  id: 'transaction_no_partial_write',
  draftKind: 'test',
  operations: [
    {
      id: 'transaction_replace_first',
      type: 'replace_text',
      path: 'source/scenes/events/transaction.scene.dry',
      line: 2,
      search: 'LINE_ONE',
      replace: 'LINE_ONE_CHANGED',
      rawAnchorText: 'LINE_ONE',
      expectedRangeHash: sha256('LINE_ONE'),
      safety: 'guarded_apply'
    },
    {
      id: 'transaction_replace_missing',
      type: 'replace_text',
      path: 'source/scenes/events/transaction.scene.dry',
      line: 99,
      search: 'MISSING_LINE',
      replace: 'SHOULD_NOT_APPLY',
      safety: 'guarded_apply'
    }
  ]
});
const transactionApply = installPlan.applyInstallPlan(transactionPlan, {projectRoot: tmpRoot, dryRun: false, includeEvidence: true});
assert(!transactionApply.ok, 'apply should fail the whole transaction when any automatic operation fails');
assert(transactionApply.results.some((result) => result.id === 'transaction_replace_first' && result.status === 'would_apply') && transactionApply.results.some((result) => result.id === 'transaction_replace_missing' && result.status === 'failed'), 'transaction preflight should still report each operation status');
assert(!transactionApply.changedFiles.length, 'failed apply transactions should not report committed changed files');
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'transaction.scene.dry'), 'utf8') === transactionBefore, 'failed apply transaction must leave the file completely unchanged');

const sequentialPlan = installPlan.buildInstallPlan({
  id: 'sequential_in_memory',
  draftKind: 'test',
  operations: [
    {
      id: 'sequential_first',
      type: 'replace_text',
      path: 'source/scenes/events/sequential.scene.dry',
      line: 2,
      search: 'alpha',
      replace: 'alpha beta',
      rawAnchorText: 'alpha',
      safety: 'guarded_apply'
    },
    {
      id: 'sequential_second',
      type: 'replace_text',
      path: 'source/scenes/events/sequential.scene.dry',
      line: 2,
      search: 'alpha beta',
      replace: 'alpha gamma',
      rawAnchorText: 'alpha beta',
      safety: 'guarded_apply'
    }
  ]
});
const sequentialDryRun = installPlan.applyInstallPlan(sequentialPlan, {projectRoot: tmpRoot, dryRun: true, includeEvidence: true});
assert(sequentialDryRun.ok && sequentialDryRun.results.every((result) => result.status === 'would_apply'), 'same-file operations should preflight sequentially in memory: ' + JSON.stringify(sequentialDryRun));
assert(sequentialDryRun.uniqueFileCount === 1 && sequentialDryRun.operationCount === 2, 'evidence result should separate operation count from unique file count');
const sequentialApply = installPlan.applyInstallPlan(sequentialPlan, {projectRoot: tmpRoot, dryRun: false});
assert(sequentialApply.ok, 'same-file sequential apply should commit only after both operations pass: ' + JSON.stringify(sequentialApply));
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'sequential.scene.dry'), 'utf8').includes('alpha gamma'), 'same-file sequential apply should write the final in-memory state');

const reportPlan = installPlan.buildInstallPlan({
  id: 'report_counts',
  draftKind: 'test',
  operations: [
    {id: 'report_first', type: 'replace_text', path: 'source/scenes/events/report.scene.dry', line: 2, search: 'first report line', replace: 'first report changed', safety: 'guarded_apply'},
    {id: 'report_second', type: 'replace_text', path: 'source/scenes/events/report.scene.dry', line: 3, search: 'second report line', replace: 'second report changed', safety: 'guarded_apply'},
    {id: 'report_third', type: 'replace_text', path: 'source/scenes/events/report.scene.dry', line: 4, search: 'third report line', replace: 'third report changed', safety: 'guarded_apply'}
  ]
});
const reportDryRun = installPlan.applyInstallPlan(reportPlan, {projectRoot: tmpRoot, dryRun: true, includeEvidence: true});
assert(reportDryRun.ok, 'multi-operation same-file report dry-run should succeed: ' + JSON.stringify(reportDryRun));
assert(reportDryRun.operationCount === 3, 'evidence result should count three operations');
assert(reportDryRun.uniqueFileCount === 1, 'evidence result should count one unique file');
assert(reportDryRun.changedFiles.length === 1 && reportDryRun.changedFiles[0].operationCount === 3, 'changedFiles should aggregate same-file operations instead of duplicating files');

const sameLineAnchor = 'on-arrival: z_leader = "Kaas"; z_relation -= 5; prussian_concordat_progress += 1; z_ideology = "Right"; resources += 9';
const sameLineSource = {path: 'source/scenes/events/same_line_effect.scene.dry', line: 2, anchorText: sameLineAnchor};
const sameLineEffectPlan = installPlan.existingSceneEditInstallPlan({
  id: 'same_line_effect_coalesce',
  draftKind: 'existing_scene_edit',
  title: 'Same Line Effect',
  changes: [
    {fieldId: 'relation', role: 'effect', source: sameLineSource, before: 'z_relation -= 5', after: 'z_relation += 25', editability: 'guarded_apply'},
    {fieldId: 'ideology', role: 'effect', source: sameLineSource, before: 'z_ideology = "Right"', after: 'z_ideology = "Left"', editability: 'guarded_apply'},
    {fieldId: 'resources', role: 'effect', source: sameLineSource, before: 'resources += 9', after: 'resources += 2', editability: 'guarded_apply'},
    {fieldId: 'remove_leader', role: 'effect', operationType: 'replace_text', source: sameLineSource, before: sameLineAnchor, after: 'on-arrival: z_relation -= 5; prussian_concordat_progress += 1; z_ideology = "Right"; resources += 9', editability: 'guarded_apply'},
    {fieldId: 'add_resources', role: 'effect', operationType: 'replace_text', source: sameLineSource, before: sameLineAnchor, after: sameLineAnchor + '; resources += 9', editability: 'guarded_apply'}
  ]
});
assert(sameLineEffectPlan.operations.length === 1, 'same-line effect changes should be coalesced into one source-backed operation');
assert(sameLineEffectPlan.operations[0].search === sameLineAnchor, 'coalesced same-line effect operation should use the original source line as evidence');
assert(
  sameLineEffectPlan.operations[0].replace === 'on-arrival: z_relation += 25; prussian_concordat_progress += 1; z_ideology = "Left"; resources += 2; resources += 9',
  'coalesced same-line effect operation should preserve all edited clauses in order'
);
const sameLineEffectDryRun = installPlan.applyInstallPlan(sameLineEffectPlan, {projectRoot: tmpRoot, dryRun: true, includeEvidence: true});
assert(sameLineEffectDryRun.ok && sameLineEffectDryRun.results[0].status === 'would_apply', 'coalesced same-line effect dry-run should verify against current source: ' + JSON.stringify(sameLineEffectDryRun));

const insertScopedDedupePlan = installPlan.buildInstallPlan({
  id: 'insert_scoped_dedupe',
  draftKind: 'test',
  operations: [
    {
      id: 'insert_scoped_dedupe',
      type: 'insert_text',
      path: 'source/scenes/events/insert_dedupe.scene.dry',
      anchorText: 'ANCHOR ROUTES',
      content: 'Inserted @sample_route link\n',
      dedupeSearch: '@sample_route',
      safety: 'guarded_apply',
      description: 'Insert despite a broad dedupe token elsewhere in the file.'
    }
  ]
});
const insertScopedDedupeApply = installPlan.applyInstallPlan(insertScopedDedupePlan, {projectRoot: tmpRoot, dryRun: false});
assert(insertScopedDedupeApply.ok && insertScopedDedupeApply.results[0].status === 'applied', 'insert_text should not treat a distant dedupe token as already applied: ' + JSON.stringify(insertScopedDedupeApply));
const insertedScopedDedupeText = fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'insert_dedupe.scene.dry'), 'utf8');
assert(insertedScopedDedupeText.includes('ANCHOR ROUTES\r\nInserted @sample_route link\r\nTail stays put.\r\n'), 'insert_text should preserve CRLF line endings for inserted content');
const insertScopedDedupeAgain = installPlan.applyInstallPlan(insertScopedDedupePlan, {projectRoot: tmpRoot, dryRun: false});
assert(insertScopedDedupeAgain.ok && insertScopedDedupeAgain.results[0].status === 'already_applied', 'insert_text should still be idempotent when dedupe appears near the intended anchor');

const insertLineDisambiguatedPlan = installPlan.buildInstallPlan({
  id: 'insert_line_disambiguated',
  draftKind: 'test',
  operations: [
    {
      id: 'insert_line_disambiguated',
      type: 'insert_text',
      path: 'source/scenes/events/insert_line_disambiguated.scene.dry',
      line: 4,
      anchorText: '- @repeat: Second repeated anchor',
      content: '- @after_second: Inserted after the second anchor\n',
      dedupeSearch: '@after_second',
      safety: 'guarded_apply',
      description: 'Insert after a repeated anchor using exact line evidence.'
    }
  ]
});
const insertLineDisambiguatedApply = installPlan.applyInstallPlan(insertLineDisambiguatedPlan, {projectRoot: tmpRoot, dryRun: false});
assert(insertLineDisambiguatedApply.ok && insertLineDisambiguatedApply.results[0].status === 'applied', 'insert_text should use exact line evidence to disambiguate repeated anchors: ' + JSON.stringify(insertLineDisambiguatedApply));
const insertedLineDisambiguatedText = fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'insert_line_disambiguated.scene.dry'), 'utf8');
assert(insertedLineDisambiguatedText.includes('- @repeat: Second repeated anchor\n- @after_second: Inserted after the second anchor\nTail stays put.'), 'line-disambiguated insert_text should mutate the selected repeated anchor only');

const sameAnchorInsertPlan = installPlan.buildInstallPlan({
  id: 'same_anchor_insert_shift',
  draftKind: 'test',
  operations: [
    {
      id: 'same_anchor_insert_before',
      type: 'insert_text',
      path: 'source/scenes/events/same_anchor_insert.scene.dry',
      line: 3,
      position: 'before',
      anchorText: 'Shared body anchor.',
      content: 'face-image: img/events/shared-anchor.png\n',
      dedupeSearch: 'face-image: img/events/shared-anchor.png',
      safety: 'guarded_apply',
      description: 'Insert a flow asset before a line-backed body anchor.'
    },
    {
      id: 'same_anchor_insert_after',
      type: 'insert_text',
      path: 'source/scenes/events/same_anchor_insert.scene.dry',
      line: 3,
      position: 'after',
      anchorText: 'Shared body anchor.',
      content: '\n- @new_path: Continue through the new branch.\n\n@new_path\nA new branch opens.\n',
      dedupeSearch: '@new_path',
      safety: 'advanced_apply',
      description: 'Insert a branch after the same body anchor after an earlier same-file insert shifted it.'
    }
  ]
});
const sameAnchorInsertDryRun = installPlan.applyInstallPlan(sameAnchorInsertPlan, {projectRoot: tmpRoot, dryRun: true, allowAdvanced: true, includeEvidence: true});
assert(sameAnchorInsertDryRun.ok && sameAnchorInsertDryRun.results.every((result) => result.status === 'would_apply'), 'line-backed inserts sharing one anchor should tolerate prior same-file insert shifts: ' + JSON.stringify(sameAnchorInsertDryRun));
const sameAnchorInsertAfter = sameAnchorInsertDryRun.results.find((result) => result.id === 'same_anchor_insert_after');
assert(sameAnchorInsertAfter && sameAnchorInsertAfter.evidence && sameAnchorInsertAfter.evidence.line === 4, 'shifted insert evidence should report the current in-memory anchor line');
assert(sameAnchorInsertAfter.evidence.diff.includes(' Shared body anchor.'), 'insert verified diff should render the anchor as context, not a deletion');
assert(!sameAnchorInsertAfter.evidence.diff.includes('-Shared body anchor.'), 'insert verified diff should not pretend the anchor is removed');
const sameAnchorInsertApply = installPlan.applyInstallPlan(sameAnchorInsertPlan, {projectRoot: tmpRoot, dryRun: false, allowAdvanced: true});
assert(sameAnchorInsertApply.ok && sameAnchorInsertApply.results.every((result) => result.status === 'applied'), 'same-anchor insert apply should commit after shifted-anchor preflight: ' + JSON.stringify(sameAnchorInsertApply));
const sameAnchorInsertText = fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'same_anchor_insert.scene.dry'), 'utf8');
assert(sameAnchorInsertText.includes('face-image: img/events/shared-anchor.png\nShared body anchor.\n\n- @new_path: Continue through the new branch.'), 'same-anchor insert apply should preserve before-anchor and after-anchor ordering');

const sameLineShiftReplacePlan = installPlan.buildInstallPlan({
  id: 'same_line_shift_replace',
  draftKind: 'test',
  operations: [
    {
      id: 'same_line_shift_insert',
      type: 'insert_text',
      path: 'source/scenes/events/same_line_shift_replace.scene.dry',
      line: 3,
      position: 'before',
      anchorText: 'Shared editable line.',
      content: 'face-image: img/events/line-shift.png\n',
      dedupeSearch: 'face-image: img/events/line-shift.png',
      safety: 'guarded_apply'
    },
    {
      id: 'same_line_shift_replace',
      type: 'replace_text',
      path: 'source/scenes/events/same_line_shift_replace.scene.dry',
      line: 3,
      search: 'Shared editable line.',
      replace: 'Shared editable line changed.',
      safety: 'guarded_apply'
    }
  ]
});
const sameLineShiftReplaceDryRun = installPlan.applyInstallPlan(sameLineShiftReplacePlan, {projectRoot: tmpRoot, dryRun: true, includeEvidence: true});
assert(sameLineShiftReplaceDryRun.ok && sameLineShiftReplaceDryRun.results.every((result) => result.status === 'would_apply'), 'line-backed replace_text should tolerate prior same-file insert shifts: ' + JSON.stringify(sameLineShiftReplaceDryRun));
const sameLineShiftReplaceResult = sameLineShiftReplaceDryRun.results.find((result) => result.id === 'same_line_shift_replace');
assert(sameLineShiftReplaceResult && sameLineShiftReplaceResult.evidence && sameLineShiftReplaceResult.evidence.line === 4, 'shifted replace_text evidence should report the current in-memory line');

const sameSectionShiftReplacePlan = installPlan.buildInstallPlan({
  id: 'same_section_shift_replace',
  draftKind: 'test',
  operations: [
    {
      id: 'same_section_shift_insert',
      type: 'insert_text',
      path: 'source/scenes/events/same_section_shift_replace.scene.dry',
      line: 3,
      position: 'before',
      anchorText: '= Shared Section',
      content: 'face-image: img/events/section-shift.png\n',
      dedupeSearch: 'face-image: img/events/section-shift.png',
      safety: 'guarded_apply'
    },
    {
      id: 'same_section_shift_replace',
      type: 'replace_section',
      path: 'source/scenes/events/same_section_shift_replace.scene.dry',
      startLine: 3,
      endLine: 5,
      anchorText: '= Shared Section',
      endAnchorText: 'Shared section body.',
      content: '= Shared Section\n\nShared section body changed.\n',
      dedupeSearch: 'Shared section body changed.',
      safety: 'guarded_apply'
    }
  ]
});
const sameSectionShiftReplaceDryRun = installPlan.applyInstallPlan(sameSectionShiftReplacePlan, {projectRoot: tmpRoot, dryRun: true, includeEvidence: true});
assert(sameSectionShiftReplaceDryRun.ok && sameSectionShiftReplaceDryRun.results.every((result) => result.status === 'would_apply'), 'line-backed replace_section should tolerate prior same-file insert shifts: ' + JSON.stringify(sameSectionShiftReplaceDryRun));
const sameSectionShiftReplaceResult = sameSectionShiftReplaceDryRun.results.find((result) => result.id === 'same_section_shift_replace');
assert(sameSectionShiftReplaceResult && sameSectionShiftReplaceResult.evidence && sameSectionShiftReplaceResult.evidence.startLine === 4 && sameSectionShiftReplaceResult.evidence.endLine === 6, 'shifted replace_section evidence should report the current in-memory section lines');

const staleInsertLinePlan = installPlan.buildInstallPlan({
  id: 'insert_line_stale',
  draftKind: 'test',
  operations: [
    {
      id: 'insert_line_stale',
      type: 'insert_text',
      path: 'source/scenes/events/insert_line_disambiguated.scene.dry',
      line: 3,
      anchorText: '- @repeat: Second repeated anchor',
      content: '- @wrong_place: Should not apply\n',
      dedupeSearch: '@wrong_place',
      safety: 'guarded_apply',
      description: 'Stale insert line evidence should fail instead of falling back to a global anchor search.'
    }
  ]
});
const staleInsertLineResult = installPlan.applyInstallPlan(staleInsertLinePlan, {projectRoot: tmpRoot, dryRun: false});
assert(!staleInsertLineResult.ok, 'insert_text should fail stale line evidence instead of falling back to global anchor search');
assert(staleInsertLineResult.diagnostics.some((diag) => diag.code === 'install_plan.insert_line_anchor_mismatch'), 'stale insert line should report insert_line_anchor_mismatch');
assert(!fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'insert_line_disambiguated.scene.dry'), 'utf8').includes('@wrong_place'), 'stale insert line must not mutate the file');

const ambiguousSectionPlan = installPlan.buildInstallPlan({
  id: 'replace_section_ambiguous',
  draftKind: 'test',
  operations: [
    {
      id: 'replace_section_ambiguous',
      type: 'replace_section',
      path: 'source/scenes/events/section_ambiguous.scene.dry',
      anchorText: '= Old Section',
      endAnchorText: 'Old section body.',
      content: '= New Section\n',
      dedupeSearch: 'New Section',
      safety: 'guarded_apply'
    }
  ]
});
const ambiguousSectionResult = installPlan.applyInstallPlan(ambiguousSectionPlan, {projectRoot: tmpRoot, dryRun: false});
assert(!ambiguousSectionResult.ok, 'replace_section should refuse ambiguous start anchors');
assert(ambiguousSectionResult.diagnostics.some((diag) => diag.code === 'install_plan.section_ambiguous_anchor'), 'ambiguous replace_section should report section_ambiguous_anchor');

const missingEndSectionPlan = installPlan.buildInstallPlan({
  id: 'replace_section_missing_end',
  draftKind: 'test',
  operations: [
    {
      id: 'replace_section_missing_end',
      type: 'replace_section',
      path: 'source/scenes/events/section_ambiguous.scene.dry',
      anchorText: 'title: Ambiguous Section',
      endAnchorText: 'Missing end anchor',
      content: 'title: Replacement\n',
      dedupeSearch: 'title: Replacement',
      safety: 'guarded_apply'
    }
  ]
});
const missingEndSectionResult = installPlan.applyInstallPlan(missingEndSectionPlan, {projectRoot: tmpRoot, dryRun: false});
assert(!missingEndSectionResult.ok, 'replace_section should refuse missing end anchors');
assert(missingEndSectionResult.diagnostics.some((diag) => diag.code === 'install_plan.section_end_anchor_missing'), 'missing end anchor should report section_end_anchor_missing');

const rootEntrySectionPlan = installPlan.buildInstallPlan({
  id: 'root_entry_section',
  draftKind: 'entry_sidebar',
  operations: [
    {
      id: 'root_entry_section',
      type: 'replace_section',
      path: 'source/scenes/root.scene.dry',
      anchorText: '= Old Start Menu',
      endAnchorText: 'Old start body.',
      content: '= New Start Menu\n\nNew start body.\n',
      dedupeSearch: 'New start body.',
      startLine: 3,
      endLine: 5,
      safety: 'guarded_apply',
      role: 'entry_sidebar.heading'
    }
  ]
});
assert(installPlan.classifyOperation(rootEntrySectionPlan.operations[0]).status === 'guarded_apply', 'Entry/Sidebar root opening replacement should be guarded with exact anchors');
const rootEntrySectionApply = installPlan.applyInstallPlan(rootEntrySectionPlan, {projectRoot: tmpRoot, dryRun: false});
assert(rootEntrySectionApply.ok, 'Entry/Sidebar root opening replacement should apply: ' + JSON.stringify(rootEntrySectionApply));
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'root.scene.dry'), 'utf8').includes('New start body.'), 'Entry/Sidebar root opening replacement should mutate root opening text');

const rootBadSectionPlan = installPlan.buildInstallPlan({
  id: 'root_bad_section',
  draftKind: 'entry_sidebar',
  operations: [
    {
      id: 'root_bad_section',
      type: 'replace_section',
      path: 'source/scenes/root.scene.dry',
      anchorText: 'title: Old Root',
      endAnchorText: '- @main: Enter project',
      content: '= New Start Menu\n\nNew start body.\n',
      dedupeSearch: 'New start body.',
      startLine: 1,
      endLine: 6,
      safety: 'guarded_apply',
      role: 'entry_sidebar.heading'
    }
  ]
});
assert(installPlan.classifyOperation(rootBadSectionPlan.operations[0]).status === 'refused', 'Entry/Sidebar root replace_section must not cover metadata/init/routes');

const rootEntryRoutePlan = installPlan.buildInstallPlan({
  id: 'root_entry_route',
  draftKind: 'entry_sidebar',
  operations: [
    {
      id: 'root_entry_route',
      type: 'replace_text',
      path: 'source/scenes/root.scene.dry',
      line: 6,
      search: '- @main: Enter project',
      replace: '- @main: Start project',
      safety: 'guarded_apply',
      role: 'entry_sidebar.option_label'
    }
  ]
});
assert(installPlan.classifyOperation(rootEntryRoutePlan.operations[0]).status === 'guarded_apply', 'Entry/Sidebar root option label replacement should be guarded with exact line evidence');
const rootEntryRouteApply = installPlan.applyInstallPlan(rootEntryRoutePlan, {projectRoot: tmpRoot, dryRun: false});
assert(rootEntryRouteApply.ok, 'Entry/Sidebar root option label replacement should apply: ' + JSON.stringify(rootEntryRouteApply));
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'root.scene.dry'), 'utf8').includes('- @main: Start project'), 'Entry/Sidebar root option label replacement should mutate only the route label line');

const rootMetadataReplacePlan = installPlan.buildInstallPlan({
  id: 'root_metadata_replace_refused',
  draftKind: 'entry_sidebar',
  operations: [
    {
      id: 'root_metadata_replace_refused',
      type: 'replace_text',
      path: 'source/scenes/root.scene.dry',
      line: 2,
      search: 'ROOT_LABEL',
      replace: 'ROOT_LABEL_CHANGED',
      safety: 'guarded_apply',
      role: 'entry_sidebar.option_label'
    }
  ]
});
assert(installPlan.classifyOperation(rootMetadataReplacePlan.operations[0]).status === 'refused', 'Entry/Sidebar guarded root replacement must only cover title or option route lines');

const rootJsRefusedPlan = installPlan.buildInstallPlan({
  id: 'root_js_refused',
  draftKind: 'entry_sidebar',
  operations: [
    {
      id: 'root_js_refused',
      type: 'replace_text',
      path: 'source/scenes/root.scene.dry',
      line: 9,
      search: 'Q.existing_seen = 0;',
      replace: 'Q.existing_seen = 1;',
      safety: 'guarded_apply',
      role: 'entry_sidebar.option_label'
    }
  ]
});
assert(installPlan.classifyOperation(rootJsRefusedPlan.operations[0]).status === 'refused', 'Entry/Sidebar guarded root replacement must not cover JS/init lines');

const protectedRouterSectionPlan = installPlan.buildInstallPlan({
  id: 'post_event_section_refused',
  draftKind: 'test',
  operations: [
    {
      id: 'post_event_section_refused',
      type: 'replace_section',
      path: 'source/scenes/post_event.scene.dry',
      anchorText: 'POST_EVENT_LABEL',
      endAnchorText: 'POST_EVENT_LABEL',
      content: 'POST_EVENT_CHANGED\n',
      dedupeSearch: 'POST_EVENT_CHANGED',
      safety: 'guarded_apply',
      role: 'entry_sidebar.heading'
    }
  ]
});
assert(installPlan.classifyOperation(protectedRouterSectionPlan.operations[0]).status === 'refused', 'replace_section should not guarded-apply protected post_event routers');

const statusCreatePlan = installPlan.buildInstallPlan({
  id: 'status_create',
  draftKind: 'entry_sidebar',
  operations: [
    {
      id: 'status_create',
      type: 'create_file',
      path: 'source/scenes/status_extra.scene.dry',
      content: 'title: Extra Status\n\n= Extra Status\n',
      safety: 'safe_apply',
      role: 'entry_sidebar.sidebar'
    }
  ]
});
assert(installPlan.classifyOperation(statusCreatePlan.operations[0]).status === 'safe_apply', 'status_*.scene.dry creation should be safe apply');
const statusCreateDryRun = installPlan.applyInstallPlan(statusCreatePlan, {projectRoot: tmpRoot, dryRun: true});
assert(statusCreateDryRun.ok && statusCreateDryRun.results[0].status === 'would_apply', 'status_*.scene.dry dry-run should be installable');
assert(!fs.existsSync(path.join(tmpRoot, 'source', 'scenes', 'status_extra.scene.dry')), 'status_*.scene.dry dry-run must not write files');

const guardedTextPlan = installPlan.surfaceTextInstallPlan({
  id: 'rewrite_event_body',
  originalLabel: 'Original player-facing paragraph.',
  replacementLabel: 'Rewritten player-facing paragraph.',
  editability: 'draft_extractable',
  source: {path: 'source/scenes/events/event_text.scene.dry', line: 3}
});
const guardedClassification = installPlan.classifyOperation(guardedTextPlan.operations[0]);
assert(guardedClassification.status === 'guarded_apply', 'scene text replacement should be guarded installable');
assert(guardedClassification.level === 2, 'guarded scene text replacement should be Level 2');
const guardedSummary = installPlan.operationSummary(guardedTextPlan);
assert(guardedSummary.guardedApply === 1, 'operation summary should count guarded install operations');
const guardedChecklist = installPlan.renderOperationChecklist(guardedTextPlan);
assert(guardedChecklist.includes('Guarded install'), 'operation checklist should name guarded install operations');
const guardedDryRun = installPlan.applyInstallPlan(guardedTextPlan, {projectRoot: tmpRoot, dryRun: true});
assert(guardedDryRun.ok, 'guarded scene text dry-run should succeed: ' + JSON.stringify(guardedDryRun));
assert(guardedDryRun.results.some((result) => result.status === 'would_apply'), 'guarded dry-run should report would_apply');

const textProposalPlan = installPlan.surfaceTextInstallPlan({
  id: 'rewrite_event_body_proposal',
  originalLabel: 'Original player-facing paragraph.',
  replacementLabel: 'Rewritten player-facing paragraph.',
  editability: 'text_proposal',
  source: {path: 'source/scenes/events/event_text.scene.dry', line: 3, endLine: 3}
});
const textProposalClassification = installPlan.classifyOperation(textProposalPlan.operations[0]);
assert(textProposalClassification.status === 'guarded_apply', 'single-line text_proposal body prose with source evidence should become guarded replace_text');
assert(textProposalPlan.operations[0].type === 'replace_text', 'single-line text_proposal should become a guarded replace_text operation');
assert(textProposalPlan.operations[0].description.includes('Text proposal'), 'text_proposal guarded step should explain proposal-first review');
const textProposalApply = installPlan.applyInstallPlan(textProposalPlan, {projectRoot: tmpRoot, dryRun: false});
assert(textProposalApply.ok, 'text_proposal manual apply should not fail');
assert(textProposalApply.results[0].status === 'applied', 'single-line text_proposal guarded apply should mutate source after matching line evidence');
assert(
  fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'event_text.scene.dry'), 'utf8').includes('Rewritten player-facing paragraph.'),
  'single-line text_proposal guarded apply should replace source text'
);

const multiLineTextProposalPlan = installPlan.surfaceTextInstallPlan({
  id: 'rewrite_multiline_event_body_proposal',
  originalLabel: 'First visible line. Second visible line.',
  replacementLabel: 'Rewritten multi-line paragraph.',
  editability: 'text_proposal',
  source: {path: 'source/scenes/events/event_text.scene.dry', line: 3, endLine: 4}
});
assert(installPlan.classifyOperation(multiLineTextProposalPlan.operations[0]).status === 'manual_review', 'multi-line text_proposal should stay manual until range replacement exists');

const existingSceneEditPlan = installPlan.existingSceneEditInstallPlan({
  id: 'edit_existing_event_text',
  kind: 'existing_scene_edit',
  title: 'Event Text',
  sceneId: 'event_text',
  sceneKind: 'event',
  sourcePath: 'source/scenes/events/event_text.scene.dry',
  changes: [
    {
      fieldId: 'event_text_body',
      role: 'body',
      label: 'Body',
      source: {path: 'source/scenes/events/event_text.scene.dry', line: 3},
      before: 'Rewritten player-facing paragraph.',
      after: 'Rewritten existing paragraph.'
    },
    {
      fieldId: 'event_text_missing_evidence',
      role: 'body',
      label: 'Unsupported body',
      source: {},
      before: 'Missing source evidence.',
      after: 'Manual replacement.'
    }
  ]
}, {project: installPlan.projectProvenanceFromIndex(index)});
assert(existingSceneEditPlan.draftKind === 'existing_scene_edit', 'existing scene edit plan should keep existing_scene_edit draft kind');
assert(existingSceneEditPlan.operations[0].type === 'replace_text', 'source-backed existing scene edits should produce replace_text');
assert(existingSceneEditPlan.operations[0].safety === 'guarded_apply', 'source-backed existing scene edits should be guarded installable');
assert(existingSceneEditPlan.operations[0].description.includes('existing'), 'existing scene edit operation should explain existing-source modification');
assert(existingSceneEditPlan.operations[1].type === 'manual_snippet', 'missing existing scene edit source evidence should become manual review');
assert(installPlan.operationSummary(existingSceneEditPlan).guardedApply === 1, 'existing scene edit summary should count guarded replace operation');
assert(installPlan.operationSummary(existingSceneEditPlan).manualReview === 1, 'existing scene edit summary should count manual unsupported field');
const existingSceneDryRun = installPlan.applyInstallPlan(existingSceneEditPlan, {projectRoot: tmpRoot, dryRun: true});
assert(existingSceneDryRun.ok, 'existing scene edit dry-run should accept guarded replacements and skip manual fields: ' + JSON.stringify(existingSceneDryRun));
assert(existingSceneDryRun.results[0].status === 'would_apply', 'existing scene edit dry-run should report would_apply for guarded change');
const existingSceneApply = installPlan.applyInstallPlan(existingSceneEditPlan, {projectRoot: tmpRoot, dryRun: false});
assert(existingSceneApply.ok, 'existing scene edit apply should replace exact source text: ' + JSON.stringify(existingSceneApply));
assert(
  fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'event_text.scene.dry'), 'utf8').includes('Rewritten existing paragraph.'),
  'existing scene edit apply should modify the existing source file'
);

const centerPartyPlan = installPlan.existingSceneEditInstallPlan({
  id: 'center_party_conference_reliability',
  kind: 'existing_scene_edit',
  title: 'Center Party Conference',
  sceneId: 'center_party_conference',
  sceneKind: 'event',
  sourcePath: 'source/scenes/events/center_party_conference.scene.dry',
  changes: [
    {
      fieldId: 'center_party_kaas_result',
      role: 'section_text',
      label: 'Kaas branch result text',
      operationType: 'replace_section',
      source: {
        path: 'source/scenes/events/center_party_conference.scene.dry',
        line: 5,
        startLine: 5,
        endLine: 6,
        anchorText: 'Ludwig Kaas has been selected as the chairman of the Center Party. He seems to represent a rightward turn from Marx, and will preside over a Center Party less inclined to compromise with the left.',
        endAnchorText: 'Despite this, Kaas is committed to the current constitutional order and the republic. He maintains a close friendship with Eugenio Pacelli, the Papal Nuncio to Germany, which may prove useful during concordat negotiations.'
      },
      anchorText: 'Ludwig Kaas has been selected as the chairman of the Center Party. He seems to represent a rightward turn from Marx, and will preside over a Center Party less inclined to compromise with the left.',
      endAnchorText: 'Despite this, Kaas is committed to the current constitutional order and the republic. He maintains a close friendship with Eugenio Pacelli, the Papal Nuncio to Germany, which may prove useful during concordat negotiations.',
      before: [
        'Ludwig Kaas has been selected as the chairman of the Center Party. He seems to represent a rightward turn from Marx, and will preside over a Center Party less inclined to compromise with the left.',
        '',
        'Despite this, Kaas is committed to the current constitutional order and the republic. He maintains a close friendship with Eugenio Pacelli, the Papal Nuncio to Germany, which may prove useful during concordat negotiations.'
      ].join('\n'),
      after: [
        'Ludwig Kaas has been selected as the chairman of the Center Party. He seems to represent a rightward turn from Marx, and will preside over a Center Party less inclined to compromise with the left.',
        '',
        'Despite this, Kaas is committed to the current constitutional order and the republic. He maintains a close friendship with Eugenio Pacelli, the Papal Nuncio to Germany, which may prove useful during concordat negotiations.',
        '',
        'Test! Test!'
      ].join('\n'),
      editability: 'guarded_apply'
    },
    {
      fieldId: 'center_party_face_image',
      role: 'asset',
      label: 'Remove Kaas portrait',
      operationType: 'replace_text',
      source: {path: 'source/scenes/events/center_party_conference.scene.dry', line: 3, anchorText: 'face-image: img/portraits/Ludwig_Kaas.jpg'},
      before: 'face-image: img/portraits/Ludwig_Kaas.jpg',
      after: '',
      allowEmptyReplace: true,
      deletesSourceLine: true,
      editability: 'guarded_apply'
    },
    {
      fieldId: 'center_party_arrival_effect',
      role: 'effect',
      label: 'Arrival effect',
      operationType: 'replace_text',
      source: {path: 'source/scenes/events/center_party_conference.scene.dry', line: 2, anchorText: 'on-arrival: z_leader = "Kaas"; z_relation -= 5; prussian_concordat_progress += 1; z_ideology = "Right"'},
      before: 'on-arrival: z_leader = "Kaas"; z_relation -= 5; prussian_concordat_progress += 1; z_ideology = "Right"',
      after: 'on-arrival: z_leader = "Kaas"; z_relation -= 5; prussian_concordat_progress += 1; z_ideology = "Right"; resources += 9',
      editability: 'guarded_apply'
    }
  ]
}, {project: installPlan.projectProvenanceFromIndex(index)});
assert(centerPartyPlan.operations.length === 3, 'Dynamic-like center party edit should produce three source-backed operations');
assert(centerPartyPlan.operations[1].deleteMode === 'line', 'existing asset deletion should carry deleteMode=line');
const centerPartyDryRun = installPlan.applyInstallPlan(centerPartyPlan, {projectRoot: tmpRoot, dryRun: true, includeEvidence: true});
assert(centerPartyDryRun.ok, 'Dynamic-like center party dry-run should accept section text, asset removal, and effect edit: ' + JSON.stringify(centerPartyDryRun));
assert(centerPartyDryRun.results.every((result) => result.status === 'would_apply'), 'center party dry-run should mark all three operations would_apply');
assert(centerPartyDryRun.operationCount === 3 && centerPartyDryRun.uniqueFileCount === 1, 'center party report should show 3 operations / 1 unique file');
const centerPartyApply = installPlan.applyInstallPlan(centerPartyPlan, {projectRoot: tmpRoot, dryRun: false, includeEvidence: true});
assert(centerPartyApply.ok && centerPartyApply.results.every((result) => result.status === 'applied'), 'Dynamic-like center party apply should commit all operations together: ' + JSON.stringify(centerPartyApply));
const centerPartySource = fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'center_party_conference.scene.dry'), 'utf8');
assert(centerPartySource.includes('Test! Test!'), 'center party apply should write added branch result text');
assert(!centerPartySource.includes('face-image: img/portraits/Ludwig_Kaas.jpg'), 'center party apply should delete the whole portrait source line');
assert(!centerPartySource.includes('\n\n\n'), 'center party apply should not leave a blank source line where the portrait was deleted');
assert(centerPartySource.includes('resources += 9'), 'center party apply should write the arrival effect edit');
const centerPartyPostApply = installPlan.applyInstallPlan(centerPartyPlan, {projectRoot: tmpRoot, dryRun: true, includeEvidence: true});
assert(centerPartyPostApply.ok, 'center party post-apply dry-run should remain verifiable: ' + JSON.stringify(centerPartyPostApply));
assert(centerPartyPostApply.results.every((result) => result.status === 'already_applied'), 'center party post-apply dry-run should report already_applied for every operation');

fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'menu_add_option.scene.dry'),
  [
    'title: Menu Add Option',
    '',
    '= Menu',
    '',
    'This menu owns choices.',
    '- @talk: Talk.',
    '- @walk: Walk away.',
    ''
  ].join('\n'),
  'utf8'
);
const existingSectionAddOptionPlan = installPlan.existingSceneEditInstallPlan({
  id: 'add_existing_section_option',
  kind: 'existing_scene_edit',
  sceneId: 'menu_add_option',
  sceneKind: 'event',
  sourcePath: 'source/scenes/events/menu_add_option.scene.dry',
  changes: [{
    fieldId: 'structure_add_option_section_menu',
    role: 'structure',
    label: 'Add option to section: Menu',
    sectionId: 'menu_add_option.menu',
    operationType: 'insert_text',
    source: {path: 'source/scenes/events/menu_add_option.scene.dry', line: 7, anchorText: '- @walk: Walk away.'},
    before: '(not present yet)',
    after: '- @listen: Listen carefully.\n\n@listen\nThe room listens before choosing.\n',
    anchorText: '- @walk: Walk away.',
    position: 'after',
    dedupeSearch: '@listen',
    editability: 'guarded_apply'
  }]
});
assert(existingSectionAddOptionPlan.operations[0].type === 'insert_text', 'section-owned add-option changes should produce insert_text operations');
assert(existingSectionAddOptionPlan.operations[0].safety === 'guarded_apply', 'section-owned add-option inserts should be guarded installable');
const existingSectionAddOptionDryRun = installPlan.applyInstallPlan(existingSectionAddOptionPlan, {projectRoot: tmpRoot, dryRun: true});
assert(existingSectionAddOptionDryRun.ok && existingSectionAddOptionDryRun.results[0].status === 'would_apply', 'section-owned add-option guarded dry-run should succeed');
const existingSectionAddOptionApply = installPlan.applyInstallPlan(existingSectionAddOptionPlan, {projectRoot: tmpRoot, dryRun: false});
assert(existingSectionAddOptionApply.ok, 'section-owned add-option guarded apply should succeed: ' + JSON.stringify(existingSectionAddOptionApply));
const existingSectionAddOptionSource = fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'menu_add_option.scene.dry'), 'utf8');
assert(existingSectionAddOptionSource.includes('- @walk: Walk away.\n- @listen: Listen carefully.\n\n@listen\nThe room listens before choosing.'), 'section-owned add-option apply should insert after the section option anchor');
const existingSectionAddOptionApplyAgain = installPlan.applyInstallPlan(existingSectionAddOptionPlan, {projectRoot: tmpRoot, dryRun: false});
assert(existingSectionAddOptionApplyAgain.ok && existingSectionAddOptionApplyAgain.results[0].status === 'already_applied', 'section-owned add-option apply should be idempotent through dedupe evidence');
const existingOptionRemovalPlan = installPlan.existingSceneEditInstallPlan({
  id: 'remove_external_section_option',
  kind: 'existing_scene_edit',
  sceneId: 'menu_add_option',
  sceneKind: 'event',
  sourcePath: 'source/scenes/events/menu_add_option.scene.dry',
  changes: [{
    fieldId: 'structure_remove_option_talk',
    role: 'route',
    label: 'Remove option: Talk.',
    sectionId: 'menu_add_option.menu',
    operationType: 'replace_text',
    source: {path: 'source/scenes/events/menu_add_option.scene.dry', line: 6, anchorText: '- @talk: Talk.'},
    before: '- @talk: Talk.',
    after: '',
    allowEmptyReplace: true,
    deletesSourceLine: true,
    editability: 'guarded_apply'
  }]
});
assert(existingOptionRemovalPlan.operations[0].type === 'replace_text', 'safe option removal should produce replace_text operations');
assert(existingOptionRemovalPlan.operations[0].safety === 'guarded_apply' && existingOptionRemovalPlan.operations[0].replace === '', 'safe option removal should be a guarded empty replacement');
const existingOptionRemovalDryRun = installPlan.applyInstallPlan(existingOptionRemovalPlan, {projectRoot: tmpRoot, dryRun: true});
assert(existingOptionRemovalDryRun.ok && existingOptionRemovalDryRun.results[0].status === 'would_apply', 'safe option removal dry-run should succeed');
const existingOptionRemovalApply = installPlan.applyInstallPlan(existingOptionRemovalPlan, {projectRoot: tmpRoot, dryRun: false});
assert(existingOptionRemovalApply.ok, 'safe option removal apply should succeed: ' + JSON.stringify(existingOptionRemovalApply));
assert(!fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'menu_add_option.scene.dry'), 'utf8').includes('- @talk: Talk.'), 'safe option removal should delete only the selected option line');

fs.writeFileSync(
  path.join(tmpRoot, 'source', 'scenes', 'events', 'effect_delete.scene.dry'),
  ['title: Effect Delete', '', 'Q.public_order += 1;', ''].join('\n'),
  'utf8'
);
const existingSceneDeleteEffectPlan = installPlan.existingSceneEditInstallPlan({
  id: 'delete_effect_line',
  kind: 'existing_scene_edit',
  sceneId: 'effect_delete',
  changes: [{
    fieldId: 'delete_public_order_effect',
    role: 'effect',
    label: 'Remove effect: Q.public_order += 1',
    operationType: 'replace_text',
    source: {path: 'source/scenes/events/effect_delete.scene.dry', line: 3},
    before: 'Q.public_order += 1;',
    after: '',
    allowEmptyReplace: true
  }]
});
assert(existingSceneDeleteEffectPlan.operations[0].type === 'replace_text', 'empty source-backed existing scene replacements should still produce replace_text');
assert(existingSceneDeleteEffectPlan.operations[0].safety === 'guarded_apply', 'empty source-backed existing scene replacements should be guarded when explicitly allowed');
assert(existingSceneDeleteEffectPlan.operations[0].replace === '', 'empty source-backed existing scene replacements should preserve an empty replacement');
const existingSceneDeleteEffectDryRun = installPlan.applyInstallPlan(existingSceneDeleteEffectPlan, {projectRoot: tmpRoot, dryRun: true});
assert(existingSceneDeleteEffectDryRun.ok && existingSceneDeleteEffectDryRun.results[0].status === 'would_apply', 'empty source-backed existing scene replacement dry-run should succeed');
const existingSceneDeleteEffectApply = installPlan.applyInstallPlan(existingSceneDeleteEffectPlan, {projectRoot: tmpRoot, dryRun: false});
assert(existingSceneDeleteEffectApply.ok, 'empty source-backed existing scene replacement apply should succeed');
assert(!fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'effect_delete.scene.dry'), 'utf8').includes('Q.public_order += 1;'), 'empty source-backed existing scene replacement should remove the target effect text');

const protectedExistingSceneEditPlan = installPlan.existingSceneEditInstallPlan({
  id: 'edit_protected_router',
  kind: 'existing_scene_edit',
  sceneId: 'post_event',
  sourcePath: 'source/scenes/post_event.scene.dry',
  changes: [{
    fieldId: 'router_text',
    role: 'body',
    source: {path: 'source/scenes/post_event.scene.dry', line: 1},
    before: 'POST_EVENT_LABEL',
    after: 'POST_EVENT_CHANGED'
  }]
});
assert(protectedExistingSceneEditPlan.operations[0].safety === 'advanced_apply', 'existing scene edits should advanced-apply protected routers instead of manual snippets');
assert(protectedExistingSceneEditPlan.operations[0].type === 'replace_text', 'protected existing scene edits should still generate an installable source operation');

const advancedPlan = installPlan.buildInstallPlan({
  id: 'advanced_router_line',
  draftKind: 'test',
  operations: [
    {
      id: 'advanced_router_line',
      type: 'replace_text',
      path: 'source/scenes/post_event.scene.dry',
      line: 1,
      search: 'POST_EVENT_LABEL',
      replace: 'POST_EVENT_CHANGED',
      safety: 'advanced_apply'
    }
  ]
});
const advancedSummary = installPlan.operationSummary(advancedPlan);
assert(advancedSummary.advancedApply === 1, 'operation summary should count advanced install operations');
const advancedBlocked = installPlan.applyInstallPlan(advancedPlan, {projectRoot: tmpRoot, dryRun: false});
assert(advancedBlocked.ok, 'advanced operation without opt-in should be deferred, not fail');
assert(advancedBlocked.results[0].status === 'advanced_review', 'advanced operation should require explicit opt-in');
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'post_event.scene.dry'), 'utf8').includes('POST_EVENT_LABEL'), 'advanced operation without opt-in must not mutate');
const advancedDryRun = installPlan.applyInstallPlan(advancedPlan, {projectRoot: tmpRoot, dryRun: true, allowAdvanced: true});
assert(advancedDryRun.ok, 'advanced dry-run with opt-in should succeed: ' + JSON.stringify(advancedDryRun));
assert(advancedDryRun.results[0].status === 'would_apply', 'advanced dry-run with opt-in should report would_apply');

const manualPlan = installPlan.buildInstallPlan({
  id: 'manual_only',
  draftKind: 'test',
  operations: [
    {
      id: 'manual',
      type: 'manual_snippet',
      path: 'source/scenes/status.scene.dry',
      content: 'SHOULD_NOT_APPLY\n',
      safety: 'manual_review'
    }
  ]
});
const manualApply = installPlan.applyInstallPlan(manualPlan, {projectRoot: tmpRoot, dryRun: false});
assert(manualApply.ok, 'manual-only apply should not fail: ' + JSON.stringify(manualApply));
assert(manualApply.results[0].status === 'manual_review', 'manual operation should stay manual_review');
assert(!fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8').includes('SHOULD_NOT_APPLY'), 'manual operation must not mutate source');

const unsafePlan = installPlan.buildInstallPlan({
  id: 'unsafe',
  draftKind: 'test',
  operations: [
    {
      id: 'unsafe_html',
      type: 'create_file',
      path: 'out/html',
      content: 'unsafe',
      safety: 'safe_apply'
    }
  ]
});
const unsafeApply = installPlan.applyInstallPlan(unsafePlan, {projectRoot: tmpRoot, dryRun: false});
assert(!unsafeApply.ok, 'out/html safe operation should be refused');
assert(unsafeApply.diagnostics.some((diag) => diag.code === 'install_plan.unsafe_path'), 'unsafe path should produce unsafe_path diagnostic');

const customCardPathPlan = installPlan.buildInstallPlan({
  id: 'custom_card_path',
  draftKind: 'card',
  operations: [
    {
      id: 'create_scene',
      type: 'create_file',
      path: 'source/scenes/government_affairs/custom_card_path.scene.dry',
      content: 'title: Custom Card Path\nis-card: true\n',
      sceneKind: 'card',
      safety: 'safe_apply'
    }
  ]
});
const customCardPathDryRun = installPlan.applyInstallPlan(customCardPathPlan, {projectRoot: tmpRoot, dryRun: true});
assert(customCardPathDryRun.ok, 'card create_file should allow project-specific source/scenes subdirectories when the operation is tagged as a card scene');

const untaggedCustomCardPathPlan = installPlan.buildInstallPlan({
  id: 'untagged_custom_card_path',
  draftKind: 'test',
  operations: [
    {
      id: 'create_scene',
      type: 'create_file',
      path: 'source/scenes/government_affairs/untagged_custom_card_path.scene.dry',
      content: 'title: Untagged Custom Card Path\n',
      safety: 'safe_apply'
    }
  ]
});
const untaggedCustomCardPathDryRun = installPlan.applyInstallPlan(untaggedCustomCardPathPlan, {projectRoot: tmpRoot, dryRun: true});
assert(!untaggedCustomCardPathDryRun.ok, 'untagged create_file should not open arbitrary project-specific scene subdirectories');
assert(untaggedCustomCardPathDryRun.diagnostics.some((diag) => diag.code === 'install_plan.unsafe_path'), 'untagged custom card path refusal should use unsafe_path diagnostic');

[
  ['root', 'source/scenes/root.scene.dry', 'ROOT_LABEL'],
  ['post_event', 'source/scenes/post_event.scene.dry', 'POST_EVENT_LABEL'],
  ['post_event_news', 'source/scenes/post_event_news.scene.dry', 'POST_EVENT_NEWS_LABEL']
].forEach(([label, relPath, marker]) => {
  const adversarialPlan = installPlan.buildInstallPlan({
    id: 'unsafe_' + label,
    draftKind: 'test',
    operations: [
      {
        id: 'unsafe_' + label,
        type: 'replace_text',
        path: relPath,
        search: marker,
        replace: 'MUTATED',
        safety: 'safe_apply'
      }
    ]
  });
  const result = installPlan.applyInstallPlan(adversarialPlan, {projectRoot: tmpRoot, dryRun: false});
  assert(!result.ok, label + ' safe_apply rewrite should be refused');
  assert(result.diagnostics.some((diag) => diag.code === 'install_plan.unsafe_path'), label + ' refusal should use unsafe_path diagnostic');
  assert(fs.readFileSync(path.join(tmpRoot, relPath), 'utf8').includes(marker), label + ' file must remain unchanged');
});

[
  ['out_html_file', 'out/html/file.js'],
  ['out_game', 'out/game.json'],
  ['git_config', '.git/config'],
  ['escape', '../escape.scene.dry'],
  ['absolute', path.join(tmpRoot, 'source', 'scenes', 'status.scene.dry')]
].forEach(([label, relPath]) => {
  const adversarialPlan = installPlan.buildInstallPlan({
    id: 'unsafe_' + label,
    draftKind: 'test',
    operations: [
      {
        id: 'unsafe_' + label,
        type: 'create_file',
        path: relPath,
        content: 'unsafe\n',
        safety: 'safe_apply'
      }
    ]
  });
  const result = installPlan.applyInstallPlan(adversarialPlan, {projectRoot: tmpRoot, dryRun: false});
  assert(!result.ok, label + ' path should be refused');
  assert(result.diagnostics.some((diag) => diag.code === 'install_plan.unsafe_path'), label + ' should produce unsafe_path diagnostic');
});

const staleLinePlan = installPlan.buildInstallPlan({
  id: 'stale_line',
  draftKind: 'test',
  operations: [
    {
      id: 'stale_line',
      type: 'replace_text',
      path: 'source/scenes/status.scene.dry',
      line: 99,
      search: '資源',
      replace: '資金',
      safety: 'safe_apply'
    }
  ]
});
const staleLineResult = installPlan.applyInstallPlan(staleLinePlan, {projectRoot: tmpRoot, dryRun: false});
assert(!staleLineResult.ok, 'stale line evidence should fail instead of falling back to global replacement');
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8').includes('資源'), 'stale line replacement must not mutate status');

const idempotentLinePlan = installPlan.buildInstallPlan({
  id: 'idempotent_line',
  draftKind: 'test',
  operations: [
    {
      id: 'idempotent_line',
      type: 'replace_text',
      path: 'source/scenes/events/already_applied.scene.dry',
      line: 3,
      search: 'Old label',
      replace: 'New label',
      safety: 'guarded_apply'
    }
  ]
});
const idempotentApply = installPlan.applyInstallPlan(idempotentLinePlan, {projectRoot: tmpRoot, dryRun: false});
assert(idempotentApply.ok && idempotentApply.results[0].status === 'applied', 'first line replacement should apply normally: ' + JSON.stringify(idempotentApply));
const idempotentApplyAgain = installPlan.applyInstallPlan(idempotentLinePlan, {projectRoot: tmpRoot, dryRun: false});
assert(idempotentApplyAgain.ok, 'reapplying a line replacement whose replacement is already present should not fail: ' + JSON.stringify(idempotentApplyAgain));
assert(idempotentApplyAgain.results[0].status === 'already_applied', 'already-present line replacement should report already_applied');

const dryRun = installPlan.applyInstallPlan(surfaceBundle.installPlan, {projectRoot: tmpRoot, dryRun: true});
assert(dryRun.ok, 'surface dry-run should succeed: ' + JSON.stringify(dryRun));
assert(dryRun.operationSummary.safeApply === 1, 'surface dry-run summary should count one safe operation');
assert(dryRun.operationSummary.manualReview === 0, 'surface dry-run summary should count no manual operations');
assert(dryRun.results.some((result) => result.status === 'would_apply'), 'surface dry-run should report would_apply');
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8').includes('資源'), 'dry-run must not mutate source');

const evidenceDryRun = installPlan.applyInstallPlan(surfaceBundle.installPlan, {projectRoot: tmpRoot, dryRun: true, includeEvidence: true});
assert(evidenceDryRun.ok, 'surface evidence dry-run should succeed: ' + JSON.stringify(evidenceDryRun));
assert(evidenceDryRun.verifiedDiff && evidenceDryRun.verifiedDiff.includes('diff --git'), 'evidence dry-run should include a verified diff');
assert(evidenceDryRun.changedFiles && evidenceDryRun.changedFiles[0].path === 'source/scenes/status.scene.dry', 'evidence dry-run should list changed files');
assert(evidenceDryRun.results[0].evidence && evidenceDryRun.results[0].evidence.match === 'matched_current_file', 'dry-run result should include current-file match evidence');
assert(evidenceDryRun.results[0].evidence.beforeHash && evidenceDryRun.results[0].evidence.afterHash, 'dry-run evidence should include before/after hashes');

const compatibilityDryRun = installPlan.applyInstallPlan(surfaceBundle.installPlan, {projectRoot: tmpRoot, dryRun: true});
assert(!Object.prototype.hasOwnProperty.call(compatibilityDryRun, 'verifiedDiff'), 'verified diff should remain optional unless includeEvidence is requested');

const wrongRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_install_plan_wrong_project_'));
fs.mkdirSync(path.join(wrongRoot, 'source'), {recursive: true});
fs.writeFileSync(path.join(wrongRoot, 'source', 'info.dry'), 'title: Wrong Fixture\n', 'utf8');
const mismatchApply = installPlan.applyInstallPlan(surfaceBundle.installPlan, {projectRoot: wrongRoot, dryRun: false});
assert(!mismatchApply.ok, 'project provenance mismatch should block install before file operations');
assert(mismatchApply.diagnostics.some((diag) => diag.code === 'install_plan.project_mismatch'), 'project provenance mismatch should report project_mismatch diagnostic');
assert(!fs.existsSync(path.join(wrongRoot, 'source', 'scenes', 'status.scene.dry')), 'project provenance mismatch must not create or mutate target files');
fs.rmSync(wrongRoot, {recursive: true, force: true});

const planFile = path.join(tmpRoot, 'surface.install-plan.json');
fs.writeFileSync(planFile, JSON.stringify(surfaceBundle.installPlan, null, 2) + '\n', 'utf8');
let cliStdout = '';
let cliStderr = '';
const cliStatus = applyInstallPlanCli.runCli(
  ['--plan', planFile, '--root', tmpRoot, '--summary'],
  {
    stdout: {write: (text) => { cliStdout += text; }},
    stderr: {write: (text) => { cliStderr += text; }}
  }
);
assert(cliStatus === 0, 'apply_install_plan dry-run CLI should succeed: ' + cliStderr);
assert(cliStdout.includes('"dryRun": true'), 'apply_install_plan CLI should default to dry-run');
assert(cliStdout.includes('"operationSummary"'), 'apply_install_plan JSON summary should include operation summary');

let humanStdout = '';
let humanStderr = '';
const humanStatus = applyInstallPlanCli.runCli(
  ['--plan', planFile, '--root', tmpRoot],
  {
    stdout: {write: (text) => { humanStdout += text; }},
    stderr: {write: (text) => { humanStderr += text; }}
  }
);
assert(humanStatus === 0, 'apply_install_plan human dry-run CLI should succeed: ' + humanStderr);
assert(humanStdout.includes('safe apply: 1'), 'human CLI summary should count safe apply operations');
assert(humanStdout.includes('manual review: 0'), 'human CLI summary should count manual review operations');

const applied = installPlan.applyInstallPlan(surfaceBundle.installPlan, {projectRoot: tmpRoot, dryRun: false});
assert(applied.ok, 'surface apply should succeed: ' + JSON.stringify(applied));
assert(fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'status.scene.dry'), 'utf8').includes('資金'), 'apply should replace source-backed label');

const postApplyEvidence = installPlan.applyInstallPlan(surfaceBundle.installPlan, {projectRoot: tmpRoot, dryRun: true, includeEvidence: true});
assert(postApplyEvidence.ok, 'post-apply verification should succeed: ' + JSON.stringify(postApplyEvidence));
assert(postApplyEvidence.results[0].status === 'already_applied', 'post-apply verification should report already_applied');
assert(postApplyEvidence.results[0].evidence && postApplyEvidence.results[0].evidence.match === 'replacement_already_present', 'post-apply verification should explain the replacement evidence');

fs.rmSync(tmpRoot, {recursive: true, force: true});

process.stdout.write(JSON.stringify({
  ok: true,
  eventOps: eventBundle.installPlan.operations.length,
  newsOps: newsBundle.installPlan.operations.length,
  cardOps: cardBundle.installPlan.operations.length,
  surfaceOps: surfaceBundle.installPlan.operations.length
}, null, 2) + '\n');
