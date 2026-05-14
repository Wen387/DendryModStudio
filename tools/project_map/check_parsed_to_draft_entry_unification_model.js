#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const parsedToDraft = require('./authoring/parsed_to_draft.js');
const draftExtract = require('./authoring/draft_extract.js');
const eventDraft = require('./authoring/event_draft.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');
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

function source(pathName, line) {
  return {path: pathName, line, startLine: line, endLine: line};
}

function option(id, label, extras) {
  return Object.assign({
    id,
    targetId: id,
    target: {id},
    title: label,
    label,
    effects: [{variable: id + '_seen', op: '=', value: 1}]
  }, extras || {});
}

function economicExpansion() {
  const pathName = 'source/scenes/events/economic_expansion.scene.dry';
  return {
    id: 'economic_expansion',
    title: 'Economic Expansion',
    path: pathName,
    tags: ['event'],
    newPage: true,
    viewIf: 'economic_expansion >= 85 and unemployed <= 6 and inflation <= 6 and spd_in_government',
    effects: Array.from({length: 23}).map((_, index) => ({
      variable: index === 0 ? 'economic_expansion' : 'effect_' + index,
      op: index === 0 ? '=' : '+=',
      value: index === 0 ? 0 : 1,
      hook: 'on-arrival'
    })),
    sourceSpan: source(pathName, 1)
  };
}

function bankingCrisis() {
  const pathName = 'source/scenes/events/banking_crisis.scene.dry';
  return {
    id: 'banking_crisis',
    title: 'Banking Crisis',
    path: pathName,
    tags: ['event'],
    viewIf: 'banking_crisis_ready',
    options: [
      option('nationalise', 'Nationalise the banks.'),
      option('bailout', 'Arrange an emergency bailout.'),
      option('credit_controls', 'Impose credit controls.'),
      option('let_fail', 'Let weak banks fail.'),
      option('delay', 'Delay the decision.')
    ],
    sourceSpan: source(pathName, 1)
  };
}

function economicPolicy() {
  const pathName = 'source/scenes/cards/economic_policy.scene.dry';
  return {
    id: 'economic_policy',
    title: 'Economic Policy',
    path: pathName,
    type: 'card',
    tags: ['policy'],
    flags: {isCard: true},
    sections: [
      {
        id: 'taxes',
        title: 'Taxes',
        body: 'Choose a tax programme.',
        options: [
          option('raise_taxes', 'Raise taxes.'),
          option('cut_taxes', 'Cut taxes.'),
          option('wealth_tax', 'Introduce a wealth tax.')
        ]
      },
      {
        id: 'investment',
        title: 'Investment',
        body: 'Choose an investment programme.',
        options: [
          option('public_works', 'Fund public works.'),
          option('industry_loans', 'Offer industry loans.')
        ]
      }
    ],
    sourceSpan: source(pathName, 1)
  };
}

function senderCard() {
  const pathName = 'source/scenes/cards/sender.scene.dry';
  return {
    id: 'sender',
    title: 'Sender',
    path: pathName,
    type: 'pinned_card',
    tags: ['advisor'],
    flags: {isCard: true, isPinnedCard: true},
    options: [
      option('read_report', 'Read the report.'),
      option('send_reply', 'Send a reply.'),
      option('archive', 'Archive it.'),
      option('ask_staff', 'Ask staff.'),
      option('ignore', 'Ignore it.')
    ],
    sourceSpan: source(pathName, 1)
  };
}

function blutmai() {
  const pathName = 'source/scenes/events/blutmai.scene.dry';
  return {
    id: 'blutmai',
    title: 'Blutmai',
    path: pathName,
    tags: ['event'],
    viewIf: 'year = 1929 and month >= 5',
    options: [
      option('ban_march', 'Ban the march.'),
      option('allow_march', 'Allow the march.')
    ],
    sections: [
      {
        id: 'police_response',
        title: 'Police response',
        condition: 'police_ready',
        body: 'The police prepare for confrontation.',
        options: [
          option('restraint', 'Order restraint.'),
          option('crackdown', 'Order a crackdown.')
        ]
      }
    ],
    sourceSpan: source(pathName, 1)
  };
}

function monthly1929() {
  const pathName = 'source/scenes/events/1929.scene.dry';
  return {
    id: '1929',
    title: 'The year begins',
    path: pathName,
    tags: ['event'],
    effects: [{variable: 'year_intro_seen', op: '=', value: 1}],
    sourceSpan: source(pathName, 1)
  };
}

function textRowsFor(scene) {
  const basePath = scene.path || 'source/scenes/' + scene.id + '.scene.dry';
  const rows = [
    {
      id: scene.id + '_title',
      text: scene.title,
      role: 'title',
      owner: {kind: 'scene', sceneId: scene.id, sectionId: ''},
      source: source(basePath, 1)
    },
    {
      id: scene.id + '_body',
      text: scene.id === 'economic_expansion'
        ? 'The German economy has been growing steadily for an extended period of time.'
        : scene.title + ' body text.',
      role: 'body',
      owner: {kind: 'scene', sceneId: scene.id, sectionId: ''},
      source: source(basePath, 5)
    }
  ];
  if (scene.id === 'economic_expansion') {
    rows.splice(1, 0, {
      id: scene.id + '_subtitle',
      text: 'The economy is growing steadily.',
      role: 'subtitle',
      owner: {kind: 'scene', sceneId: scene.id, sectionId: ''},
      source: source(basePath, 3)
    });
  }
  (scene.sections || []).forEach((section, index) => {
    rows.push({
      id: scene.id + '_' + section.id + '_body',
      text: section.body || section.title || '',
      role: 'body',
      owner: {kind: 'scene', sceneId: scene.id, sectionId: scene.id + '.' + section.id},
      source: source(basePath, 20 + index)
    });
  });
  return rows;
}

function syntheticIndex() {
  const scenes = [
    economicExpansion(),
    bankingCrisis(),
    economicPolicy(),
    senderCard(),
    blutmai(),
    monthly1929()
  ];
  const textItems = scenes.flatMap(textRowsFor);
  return {
    schemaVersion: '0.1',
    project: {root: '/tmp/project'},
    scenes,
    variables: Array.from({length: 40}).map((_, index) => ({name: 'effect_' + index})).concat([
      {name: 'economic_expansion'},
      {name: 'year_intro_seen'},
      {name: 'banking_crisis_ready'}
    ]),
    semantic: {
      events: [
        {id: 'economic_expansion', title: 'Economic Expansion', path: 'source/scenes/events/economic_expansion.scene.dry'},
        {id: 'banking_crisis', title: 'Banking Crisis', path: 'source/scenes/events/banking_crisis.scene.dry'},
        {id: 'blutmai', title: 'Blutmai', path: 'source/scenes/events/blutmai.scene.dry'},
        {id: '1929', title: 'The year begins', path: 'source/scenes/events/1929.scene.dry'}
      ],
      cards: [
        {id: 'economic_policy', title: 'Economic Policy', path: 'source/scenes/cards/economic_policy.scene.dry'},
        {id: 'sender', title: 'Sender', path: 'source/scenes/cards/sender.scene.dry'}
      ],
      news: {
        items: [],
        eventPopups: [
          {
            id: 'popup_1929',
            headline: '1929',
            delivery: 'legacy_event_popup',
            linkedSceneId: '1929',
            source: source('source/scenes/post_event.scene.dry', 12)
          }
        ]
      },
      textCorpus: {items: textItems}
    }
  };
}

function comparable(result) {
  return {
    status: result.status,
    template: result.template,
    archetypeHint: result.archetypeHint,
    parity: result.parity && {
      parsed: result.parity.parsed,
      draft: result.parity.draft
    }
  };
}

function assertSameResult(left, right, label) {
  const a = JSON.stringify(comparable(left));
  const b = JSON.stringify(comparable(right));
  assert(a === b, label + ' should produce the same parsed-to-draft result.\nleft=' + a + '\nright=' + b);
}

const index = syntheticIndex();

const economicCanonical = parsedToDraft.buildDraftFromParsed(index, {view: 'events', itemId: 'economic_expansion', newId: 'economic_expansion_variant'});
const economicExplore = draftExtract.extractDraftFromItem(index, 'events', 'economic_expansion', {newId: 'economic_expansion_variant'});
const economicObjectCanvasDraft = eventDraft.fromExistingScene(index, 'economic_expansion', {newId: 'economic_expansion_variant'});
assert(economicCanonical.ok && economicCanonical.status === 'draft', 'economic_expansion should become a full pure_event draft');
assert(economicCanonical.draft.eventShape === 'pure_event', 'economic_expansion should be classified as pure_event');
assert(economicCanonical.draft.options.length === 0, 'pure_event draft should not synthesize choices');
assert(economicCanonical.draft.effectsOnTrigger.length === 23, 'pure_event draft should preserve 23 trigger effects');
assert(economicCanonical.parity.parsed.effects === 23 && economicCanonical.parity.draft.effects === 23, 'pure_event effect parity should be complete');
assertSameResult(economicCanonical, economicExplore, 'Explore copy-as-new event extraction');
assert(economicObjectCanvasDraft.id === economicCanonical.draft.id, 'Object Canvas create-similar should use the canonical new id');
assert(economicObjectCanvasDraft.eventShape === economicCanonical.draft.eventShape, 'Object Canvas create-similar should preserve canonical event shape');
assert(economicObjectCanvasDraft.effectsOnTrigger.length === 23, 'Object Canvas create-similar should preserve trigger effects');

const banking = parsedToDraft.buildDraftFromParsed(index, {view: 'events', itemId: 'banking_crisis'});
assert(banking.status === 'draft', 'banking_crisis should become an installable large choice event');
assert(banking.archetypeHint === 'large_choice_event', 'banking_crisis should be marked as large_choice_event');
assert(banking.draft.options.length === 5, 'large choice event should preserve all root options in the draft preview');
const bankingCanvas = canvasModel.buildCanvasModel(index, {template: 'event', draft: banking.draft});
assert(bankingCanvas.ok, 'large choice event should be ready for Review & Apply');
assert(bankingCanvas.changeState.installPlan, 'large choice event should produce an install plan');
assert(!bankingCanvas.changeState.diagnostics.some((diag) => diag.code === 'parsed_to_draft.partial_blocked'), 'large choice event should not be blocked as partial');

const policy = parsedToDraft.buildDraftFromParsed(index, {view: 'cards', itemId: 'economic_policy'});
assert(policy.status === 'draft', 'economic_policy menu card should become an installable draft');
assert(policy.archetypeHint === 'menu_card', 'economic_policy should be marked as menu_card');
assert(policy.draft.cardShape === 'menu_card', 'economic_policy should use menu_card shape');
assert(policy.draft.options.length === 0, 'menu card should not flatten section-owned options into root choices');
assert(policy.draft.sections.length === 2, 'menu card should preserve parsed sections');
assert(policy.parity.parsed.sectionOptions === 5 && policy.parity.draft.sectionOptions === 5, 'menu card parity should report preserved section options');

const sender = parsedToDraft.buildDraftFromParsed(index, {view: 'cards', itemId: 'sender'});
assert(sender.status === 'draft', 'sender pinned/advisor card with 5 options should become installable');
assert(sender.archetypeHint === 'large_card', 'sender should be marked as large_card when the option count is beyond current CardDraft support');
assert(sender.draft.options.length === 5, 'sender should preserve all parsed options');

const blutmaiDraft = parsedToDraft.buildDraftFromParsed(index, {view: 'events', itemId: 'blutmai'});
assert(blutmaiDraft.status === 'draft', 'small section-owned event should remain installable');
assert(blutmaiDraft.archetypeHint === 'section_event', 'blutmai should expose its section-event shape');
assert(blutmaiDraft.parity.parsed.sectionOptions === 2 && blutmaiDraft.parity.draft.sectionOptions === 2, 'section-owned option parity should be preserved');
assert(blutmaiDraft.draft.sections[0].paragraphs[0].includes('police prepare'), 'qualified section text should map back into the draft section');

const popup = parsedToDraft.buildDraftFromParsed(index, {view: 'news', itemId: 'popup_1929'});
assert(popup.template === 'event', 'monthly popup copy-as-new should route to linked event draft');
assert(popup.draft.sourceSceneId === '1929', 'monthly popup draft should preserve linked event source');
assert(popup.draft.eventShape === 'pure_event', 'linked monthly popup event should remain a pure event when it has no options');

const viewerHtml = fs.readFileSync(path.join(__dirname, 'viewer', 'index.html'), 'utf8');
const draftExtractSource = fs.readFileSync(path.join(__dirname, 'authoring', 'draft_extract.js'), 'utf8');
const eventDraftSource = fs.readFileSync(path.join(__dirname, 'authoring', 'event_draft.js'), 'utf8');
const exploreBundle = readExploreBundle(path.join(__dirname, 'viewer'));
const designSource = fs.readFileSync(path.join(__dirname, 'viewer', 'design_ui.js'), 'utf8');
assert(viewerHtml.includes('../authoring/parsed_to_draft.js'), 'viewer should load canonical parsed-to-draft helper before draft entry bridges');
assert(viewerHtml.indexOf('../authoring/parsed_to_draft.js') < viewerHtml.indexOf('../authoring/event_draft.js'), 'parsed-to-draft helper should load before EventDraft');
assert(draftExtractSource.includes('ProjectMapParsedToDraft') && draftExtractSource.includes('buildDraftFromParsed'), 'DraftExtract should delegate create-as-new to canonical helper');
assert(eventDraftSource.includes('parsedToDraftApi') && eventDraftSource.includes('event_draft.fromExistingScene'), 'EventDraft.fromExistingScene should delegate to canonical helper');
assert(exploreBundle.includes('ProjectMapDraftExtract') && exploreBundle.includes('extractDraftFromItem'), 'Explore copy-as-new should still use DraftExtract entry bridge');
assert(designSource.includes('ProjectMapDraftExtract.extractDraftFromItem'), 'Design draft action should still use DraftExtract entry bridge');

console.log(JSON.stringify({
  ok: true,
  pureEventEffects: economicCanonical.draft.effectsOnTrigger.length,
  bankingStatus: banking.status,
  policyArchetype: policy.archetypeHint,
  popupTemplate: popup.template
}, null, 2));
