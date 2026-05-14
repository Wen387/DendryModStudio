'use strict';

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
        condition: 'budget >= 1',
        body: 'Choose a tax programme.',
        effects: [{variable: 'policy_focus', op: '=', value: 1}],
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

function pinnedTextCard() {
  const pathName = 'source/scenes/cards/advisor_note.scene.dry';
  return {
    id: 'advisor_note',
    title: 'Advisor Note',
    path: pathName,
    type: 'pinned_card',
    tags: ['advisor'],
    flags: {isCard: true, isPinnedCard: true},
    sourceSpan: source(pathName, 1)
  };
}

function dynamicRawCard() {
  const pathName = 'source/scenes/cards/dynamic_policy.scene.dry';
  return {
    id: 'dynamic_policy',
    title: 'Dynamic Policy',
    path: pathName,
    type: 'card',
    tags: ['policy'],
    flags: {isCard: true},
    dynamicStructure: true,
    opaqueJsBlocks: [{path: pathName, line: 12}],
    options: [option('safe_option', 'A visible option.')],
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
    pinnedTextCard(),
    dynamicRawCard(),
    blutmai(),
    monthly1929()
  ];
  const textItems = scenes.flatMap(textRowsFor);
  const variableNames = new Set([
    'economic_expansion',
    'year_intro_seen',
    'banking_crisis_ready',
    'policy_focus',
    'budget',
    'police_ready'
  ]);
  Array.from({length: 40}).forEach((_, index) => variableNames.add('effect_' + index));
  scenes.forEach((scene) => {
    (scene.options || []).forEach((item) => variableNames.add(item.id + '_seen'));
    (scene.sections || []).forEach((section) => {
      (section.options || []).forEach((item) => variableNames.add(item.id + '_seen'));
    });
  });
  return {
    schemaVersion: '0.1',
    project: {root: '/tmp/project'},
    scenes,
    variables: Array.from(variableNames).sort().map((name) => ({name})),
    semantic: {
      events: [
        {id: 'economic_expansion', title: 'Economic Expansion', path: 'source/scenes/events/economic_expansion.scene.dry'},
        {id: 'banking_crisis', title: 'Banking Crisis', path: 'source/scenes/events/banking_crisis.scene.dry'},
        {id: 'blutmai', title: 'Blutmai', path: 'source/scenes/events/blutmai.scene.dry'},
        {id: '1929', title: 'The year begins', path: 'source/scenes/events/1929.scene.dry'}
      ],
      cards: [
        {id: 'economic_policy', title: 'Economic Policy', path: 'source/scenes/cards/economic_policy.scene.dry'},
        {id: 'sender', title: 'Sender', path: 'source/scenes/cards/sender.scene.dry'},
        {id: 'advisor_note', title: 'Advisor Note', path: 'source/scenes/cards/advisor_note.scene.dry'},
        {id: 'dynamic_policy', title: 'Dynamic Policy', path: 'source/scenes/cards/dynamic_policy.scene.dry'}
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

module.exports = {
  syntheticIndex,
  option
};
