(function initProjectMapObjectCanvasContentBodies(global) {
  'use strict';

  function eventBody(draft) {
    return {
      mode: 'new_event',
      bodyEyebrow: 'Event body',
      optionsLabel: 'Options',
      metaLabel: 'Timing and advanced fields',
      title: field('event.title', 'Title', draft.title, 'guarded'),
      heading: field('event.heading', 'Heading', draft.heading || draft.title, 'guarded'),
      sections: [field('event.intro', 'Opening text', joinParagraphs(draft.introParagraphs), 'guarded')],
      options: ensureArray(draft.options).map((option, index) => optionRow(option, index, [
        field('option.' + index + '.label', 'Option label', option.label, 'guarded'),
        field('option.' + index + '.subtitle', 'Option subtitle', option.subtitle, 'guarded'),
        field('option.' + index + '.body', 'Result text', joinParagraphs(option.narrativeParagraphs), 'guarded'),
        field('option.' + index + '.chooseIf', 'Condition', option.chooseIf, 'guarded'),
        field('option.' + index + '.unavailableText', 'Unavailable text', option.unavailableText, 'guarded'),
        field('option.' + index + '.gotoAfter', 'Go to after', option.gotoAfter, 'guarded')
      ])),
      effects: effectFields('event.effect', draft.effectsOnTrigger),
      optionEffects: ensureArray(draft.options).map((option, index) => ({
        id: option.id || 'option_' + (index + 1),
        label: option.label || option.id || ('Option ' + (index + 1)),
        fields: effectFields('option.' + index + '.effect', option.effects)
      })),
      metaFields: [
        field('event.id', 'Event id', draft.id, 'guarded'),
        field('event.year', 'Year', draft.when && draft.when.year, 'guarded'),
        field('event.monthStart', 'Month start', draft.when && draft.when.monthStart, 'guarded'),
        field('event.monthEnd', 'Month end', draft.when && draft.when.monthEnd, 'guarded'),
        field('event.requires', 'Condition', draft.when && draft.when.requires, 'guarded'),
        field('event.priority', 'Priority', draft.when && draft.when.priority, 'guarded')
      ]
    };
  }

  function newsBody(draft) {
    return {
      mode: 'news',
      bodyEyebrow: 'News item',
      optionsLabel: 'Delivery',
      metaLabel: 'Schedule and pool',
      title: field('news.headline', 'Headline', draft.headline, 'guarded'),
      sections: [field('news.description', 'Description', draft.description, 'guarded')],
      options: [],
      metaFields: [
        field('news.id', 'News id', draft.id, 'guarded'),
        field('news.delivery', 'Delivery', draft.delivery, 'guarded'),
        field('news.year', 'Year', draft.when && draft.when.year, 'guarded'),
        field('news.month', 'Month', draft.when && draft.when.month, 'guarded'),
        field('news.slot', 'Slot', draft.when && draft.when.slot, 'guarded'),
        field('news.requiresJs', 'Date condition', draft.when && draft.when.requiresJs, 'guarded'),
        field('news.poolName', 'Pool', draft.pool && draft.pool.name, 'guarded'),
        field('news.poolRequiresJs', 'Pool condition', draft.pool && draft.pool.requiresJs, 'guarded')
      ]
    };
  }

  function cardBody(draft) {
    return {
      mode: 'card',
      bodyEyebrow: 'Card body',
      optionsLabel: 'Card choices',
      metaLabel: 'Card routing and limits',
      title: field('card.title', 'Title', draft.title, 'guarded'),
      heading: field('card.heading', 'Heading', draft.heading || draft.title, 'guarded'),
      sections: [
        field('card.subtitle', 'Subtitle', draft.subtitle, 'guarded'),
        field('card.intro', 'Opening text', joinParagraphs(draft.introParagraphs), 'guarded')
      ],
      options: ensureArray(draft.options).map((option, index) => optionRow(option, index, [
        field('card.option.' + index + '.label', 'Choice label', option.label, 'guarded'),
        field('card.option.' + index + '.title', 'Choice title', option.title, 'guarded'),
        field('card.option.' + index + '.subtitle', 'Choice subtitle', option.subtitle, 'guarded'),
        field('card.option.' + index + '.body', 'Result text', joinParagraphs(option.narrativeParagraphs), 'guarded'),
        field('card.option.' + index + '.chooseIf', 'Condition', option.chooseIf, 'guarded'),
        field('card.option.' + index + '.unavailableText', 'Unavailable text', option.unavailableText, 'guarded'),
        field('card.option.' + index + '.gotoAfter', 'Return target', option.gotoAfter, 'guarded')
      ])),
      optionEffects: ensureArray(draft.options).map((option, index) => ({
        id: option.id || 'option_' + (index + 1),
        label: option.label || option.id || ('Choice ' + (index + 1)),
        fields: effectFields('card.option.' + index + '.effect', option.effects)
      })),
      metaFields: [
        field('card.id', 'Card id', draft.id, 'guarded'),
        field('card.cardKind', 'Card kind', draft.cardKind, 'guarded'),
        field('card.tags', 'Tags', ensureArray(draft.tags).join(', '), 'guarded'),
        field('card.viewIf', 'View condition', draft.viewIf, 'guarded'),
        field('card.priority', 'Priority', draft.priority, 'guarded'),
        field('card.frequency', 'Frequency', draft.frequency, 'guarded'),
        field('card.maxVisits', 'Max visits', draft.maxVisits, 'guarded')
      ]
    };
  }

  function surfaceBody(draft) {
    return {
      mode: 'surface',
      bodyEyebrow: 'Text replacement',
      optionsLabel: 'Replacement scope',
      metaLabel: 'Source evidence',
      title: field('surface.replacementLabel', 'Replacement text', draft.replacementLabel, 'guarded'),
      sections: [
        field('surface.originalLabel', 'Original text', draft.originalLabel, 'read_only', {readOnly: true}),
        field('surface.reason', 'Reason', draft.reason, 'guarded')
      ],
      options: [],
      metaFields: [
        field('surface.id', 'Draft id', draft.id, 'guarded'),
        field('surface.itemId', 'Item id', draft.itemId, 'guarded'),
        field('surface.area', 'Area', draft.area, 'guarded'),
        field('surface.editability', 'Editability', draft.editability, 'guarded'),
        field('surface.source.path', 'Source path', draft.source && draft.source.path, 'guarded'),
        field('surface.source.line', 'Source line', draft.source && draft.source.line, 'guarded')
      ]
    };
  }

  function entryBody(draft) {
    return {
      mode: 'entry',
      bodyEyebrow: 'Entry & sidebar',
      optionsLabel: 'Entry route',
      metaLabel: 'Sidebar and target',
      title: field('entry.rootTitle', 'Start title', draft.rootTitle, 'guarded'),
      heading: field('entry.rootHeading', 'Start heading', draft.rootHeading, 'guarded'),
      sections: [
        field('entry.rootIntro', 'Start text', draft.rootIntro, 'guarded'),
        field('entry.sidebarBody', 'Sidebar body', draft.sidebarBody, 'guarded'),
        field('entry.sidebarStatusLines', 'Status lines', draft.sidebarStatusLines, 'guarded')
      ],
      options: [optionRow({id: 'entry_first'}, 0, [
        field('entry.firstOptionTitle', 'First option label', draft.firstOptionTitle, 'guarded'),
        field('entry.firstTargetId', 'First target id', draft.firstTargetId, 'guarded')
      ])],
      metaFields: [
        field('entry.id', 'Draft id', draft.id, 'guarded'),
        field('entry.title', 'Draft title', draft.title, 'guarded'),
        field('entry.sidebarTitle', 'Sidebar title', draft.sidebarTitle, 'guarded'),
        field('entry.sidebarHeading', 'Sidebar heading', draft.sidebarHeading, 'guarded')
      ]
    };
  }

  function playSurfaceBody(draft) {
    return {
      mode: 'play_surface',
      bodyEyebrow: 'Playable surface',
      optionsLabel: 'Player choices',
      metaLabel: 'Surface labels',
      title: field('play.title', 'Draft title', draft.title, 'guarded'),
      heading: field('play.handHeading', 'Hand heading', draft.handHeading, 'guarded'),
      sections: [
        field('play.handBody', 'Hand body', draft.handBody, 'guarded'),
        field('play.cardHeading', 'Card heading', draft.cardHeading, 'guarded'),
        field('play.cardBody', 'Card body', draft.cardBody, 'guarded'),
        field('play.advisorHeading', 'Advisor heading', draft.advisorHeading, 'guarded'),
        field('play.advisorBody', 'Advisor body', draft.advisorBody, 'guarded')
      ],
      options: [
        optionRow({id: 'hand'}, 0, [
          field('play.handDeckOptionLabel', 'Deck option', draft.handDeckOptionLabel, 'guarded'),
          field('play.handAdvisorOptionLabel', 'Advisor option', draft.handAdvisorOptionLabel, 'guarded')
        ]),
        optionRow({id: 'card'}, 1, [
          field('play.cardOption0Label', 'Card option 1', draft.cardOption0Label, 'guarded'),
          field('play.cardOption1Label', 'Card option 2', draft.cardOption1Label, 'guarded')
        ]),
        optionRow({id: 'advisor'}, 2, [
          field('play.advisorOption0Label', 'Advisor option', draft.advisorOption0Label, 'guarded')
        ])
      ],
      metaFields: textFields('play.', draft, [
        ['id', 'Draft id'],
        ['handTitle', 'Hand title'],
        ['deckTitle', 'Deck title'],
        ['deckSubtitle', 'Deck subtitle'],
        ['cardTitle', 'Card title'],
        ['advisorTitle', 'Advisor title'],
        ['advisorSubtitle', 'Advisor subtitle']
      ])
    };
  }

  function workspaceLayoutBody(draft) {
    return {
      mode: 'workspace_layout',
      bodyEyebrow: 'Workspace layout',
      optionsLabel: 'Player routes',
      metaLabel: 'Deck, sidebar, and starter card',
      title: field('layout.title', 'Draft title', draft.title, 'guarded'),
      heading: field('layout.deckTitle', 'Deck title', draft.deckTitle, 'guarded'),
      sections: [
        field('layout.sidebarBody', 'Sidebar body', draft.sidebarBody, 'guarded'),
        field('layout.sidebarStatusLines', 'Status lines', draft.sidebarStatusLines, 'guarded'),
        field('layout.starterCardBody', 'Starter card body', draft.starterCardBody, 'guarded')
      ],
      options: [
        optionRow({id: 'layout_hand'}, 0, [field('layout.handOptionLabel', 'Hand option label', draft.handOptionLabel, 'guarded')]),
        optionRow({id: 'layout_starter'}, 1, [
          field('layout.starterCardOption0Label', 'Starter option 1', draft.starterCardOption0Label, 'guarded'),
          field('layout.starterCardOption1Label', 'Starter option 2', draft.starterCardOption1Label, 'guarded')
        ])
      ],
      metaFields: textFields('layout.', draft, [
        ['id', 'Draft id'],
        ['deckId', 'Deck id'],
        ['deckSubtitle', 'Deck subtitle'],
        ['deckTag', 'Deck tag'],
        ['sidebarCategoryId', 'Sidebar category id'],
        ['sidebarHeading', 'Sidebar heading'],
        ['handInsertMode', 'Hand insert mode'],
        ['handAnchorId', 'Hand anchor id'],
        ['sidebarInsertMode', 'Sidebar insert mode'],
        ['sidebarAnchorId', 'Sidebar anchor id'],
        ['createStarterCard', 'Create starter card'],
        ['starterCardId', 'Starter card id'],
        ['starterCardTitle', 'Starter card title'],
        ['starterCardHeading', 'Starter card heading'],
        ['starterCardOption0Variable', 'Option 1 variable'],
        ['starterCardOption0Delta', 'Option 1 delta'],
        ['starterCardOption1Variable', 'Option 2 variable'],
        ['starterCardOption1Delta', 'Option 2 delta'],
        ['starterCardReturnTarget', 'Starter return target']
      ])
    };
  }

  function sidebarStatusBody(draft) {
    return {
      mode: 'sidebar_status',
      bodyEyebrow: 'Sidebar / Status',
      optionsLabel: 'Status lines',
      metaLabel: 'Source-backed section',
      title: field('sidebar.statusTitle', 'Status title', draft.statusTitle, 'guarded'),
      heading: field('sidebar.sectionHeading', 'Section heading', draft.sectionHeading, 'guarded'),
      sections: [
        field('sidebar.sectionBody', 'Section body', draft.sectionBody, 'guarded'),
        field('sidebar.sectionStatusLines', 'Status lines', draft.sectionStatusLines, 'guarded')
      ],
      options: [],
      metaFields: [
        field('sidebar.id', 'Draft id', draft.id, 'guarded'),
        field('sidebar.title', 'Draft title', draft.title, 'guarded'),
        field('sidebar.sectionId', 'Section id', draft.sectionId, 'guarded')
      ]
    };
  }

  function electionResultsBody(draft) {
    const parties = ensureArray(draft.parties);
    const coalitions = ensureArray(draft.coalitions);
    const choices = ensureArray(draft.choices);
    const eventOptions = ensureArray(draft.electionEvents).map((event) => ({
      value: event.id || '',
      label: event.title || event.id || ''
    }));
    return {
      mode: 'election_results',
      bodyEyebrow: 'Election results',
      optionsLabel: 'Player choices',
      metaLabel: 'Election rules, parties, and coalitions',
      title: field('election.title', 'Title', draft.title, 'guarded'),
      heading: field('election.subtitle', 'Subtitle', draft.subtitle, 'guarded'),
      sections: [
        field('election.targetSceneId', 'Election event', draft.targetSceneId, 'guarded', {inputType: 'select', options: eventOptions.length ? eventOptions : [{value: '', label: 'New / manual election event'}], help: 'Choose which source election event this results screen edits.'}),
        field('election.electionKind', 'Election type', draft.electionKind, 'guarded', {inputType: 'select', options: [
          {value: 'reichstag', label: 'Reichstag'},
          {value: 'state', label: 'State / Landtag'},
          {value: 'local', label: 'Local'},
          {value: 'election', label: 'Other election'}
        ]}),
        field('election.intro', 'Coalition intro', draft.intro, 'guarded'),
        field('election.resultText', 'Result / consequence text', draft.resultText, 'guarded'),
        field('election.conditionText', 'Conditional result text', draft.conditionText, 'guarded'),
        field('election.sourcePath', 'Source target', draft.sourcePath, 'guarded')
      ],
      options: choices.map((choice, index) => optionRow(choice, index, [
        field('election.choice.' + index + '.key', 'Choice key', choice.key, 'guarded'),
        field('election.choice.' + index + '.label', 'Choice label', choice.label, 'guarded'),
        field('election.choice.' + index + '.detail', 'Choice detail', choice.detail, 'guarded'),
        field('election.choice.' + index + '.condition', 'Choice condition', choice.condition, 'guarded'),
        field('election.choice.' + index + '.resultText', 'Choice result text', choice.resultText, 'guarded'),
        field('election.choice.' + index + '.disabled', 'Disabled', choice.disabled ? 'true' : 'false', 'guarded', {inputType: 'checkbox'}),
        field('election.choice.' + index + '.remove', 'Remove choice', 'false', 'guarded', {inputType: 'checkbox'})
      ])),
      effects: effectFields('election.effect', draft.effects),
      optionEffects: choices.map((choice, index) => ({
        id: choice.key || 'choice_' + (index + 1),
        label: choice.label || choice.key || ('Choice ' + (index + 1)),
        fields: effectFields('election.choice.' + index + '.effect', choice.effects)
      })),
      metaFields: [
        field('election.id', 'Draft id', draft.id, 'guarded'),
        field('election.year', 'Year', draft.year, 'guarded', {inputType: 'number'}),
        field('election.month', 'Month', draft.month, 'guarded', {inputType: 'number'}),
        field('election.viewIf', 'View condition', draft.viewIf, 'guarded'),
        field('election.seatsTotal', 'Total seats', draft.seatsTotal, 'guarded', {inputType: 'number'}),
        field('election.chartElementId', 'D3 SVG target id', draft.chartElementId, 'guarded'),
        field('election.useD3Parliament', 'Use d3.parliament', draft.useD3Parliament ? 'true' : 'false', 'guarded', {inputType: 'checkbox', help: 'Matches SDAAH Dynamic election result scenes that call d3.parliament().'})
      ].concat(parties.reduce((rows, party, index) => rows.concat([
        field('election.party.' + index + '.key', 'Party ' + (index + 1) + ' key', party.key, 'guarded'),
        field('election.party.' + index + '.name', 'Party ' + (index + 1) + ' name', party.name, 'guarded'),
        field('election.party.' + index + '.color', 'Party ' + (index + 1) + ' color', party.color, 'guarded', {inputType: 'color'}),
        field('election.party.' + index + '.voteShare', 'Party ' + (index + 1) + ' vote %', party.voteShare, 'guarded', {inputType: 'number'}),
        field('election.party.' + index + '.voteChange', 'Party ' + (index + 1) + ' vote change', party.voteChange, 'guarded', {inputType: 'number'}),
        field('election.party.' + index + '.seatsShare', 'Party ' + (index + 1) + ' seat %', party.seatsShare, 'guarded', {inputType: 'number'}),
        field('election.party.' + index + '.seatsChange', 'Party ' + (index + 1) + ' seat change', party.seatsChange, 'guarded', {inputType: 'number'}),
        field('election.party.' + index + '.seats', 'Party ' + (index + 1) + ' seats', party.seats, 'guarded', {inputType: 'number'}),
        field('election.party.' + index + '.remove', 'Remove party ' + (index + 1), 'false', 'guarded', {inputType: 'checkbox'})
      ]), [])).concat(coalitions.reduce((rows, coalition, index) => rows.concat([
        field('election.coalition.' + index + '.key', 'Coalition ' + (index + 1) + ' key', coalition.key, 'guarded'),
        field('election.coalition.' + index + '.name', 'Coalition ' + (index + 1) + ' name', coalition.name, 'guarded'),
        field('election.coalition.' + index + '.parties', 'Coalition ' + (index + 1) + ' parties', coalition.parties, 'guarded'),
        field('election.coalition.' + index + '.share', 'Coalition ' + (index + 1) + ' share', coalition.share, 'guarded', {inputType: 'number'}),
        field('election.coalition.' + index + '.description', 'Coalition ' + (index + 1) + ' note', coalition.description, 'guarded'),
        field('election.coalition.' + index + '.remove', 'Remove coalition ' + (index + 1), 'false', 'guarded', {inputType: 'checkbox'})
      ]), [])).concat([
        field('election.party.add.key', 'Add party key', '', 'guarded'),
        field('election.party.add.name', 'Add party name', '', 'guarded'),
        field('election.party.add.color', 'Add party color', '#999999', 'guarded', {inputType: 'color'}),
        field('election.party.add.voteShare', 'Add party vote %', '', 'guarded', {inputType: 'number'}),
        field('election.party.add.voteChange', 'Add party vote change', '0', 'guarded', {inputType: 'number'}),
        field('election.party.add.seatsShare', 'Add party seat %', '', 'guarded', {inputType: 'number'}),
        field('election.party.add.seatsChange', 'Add party seat change', '0', 'guarded', {inputType: 'number'}),
        field('election.party.add.seats', 'Add party seats', '', 'guarded', {inputType: 'number'}),
        field('election.coalition.add.key', 'Add coalition key', '', 'guarded'),
        field('election.coalition.add.name', 'Add coalition name', '', 'guarded'),
        field('election.coalition.add.parties', 'Add coalition parties', '', 'guarded'),
        field('election.coalition.add.share', 'Add coalition share', '', 'guarded', {inputType: 'number'}),
        field('election.coalition.add.description', 'Add coalition note', '', 'guarded'),
        field('election.choice.add.key', 'Add choice key', '', 'guarded'),
        field('election.choice.add.label', 'Add choice label', '', 'guarded'),
        field('election.choice.add.detail', 'Add choice detail', '', 'guarded'),
        field('election.choice.add.condition', 'Add choice condition', '', 'guarded'),
        field('election.choice.add.resultText', 'Add choice result text', '', 'guarded'),
        field('election.choice.add.disabled', 'Add choice disabled', 'false', 'guarded', {inputType: 'checkbox'})
      ])
    };
  }

  function projectBody(draft) {
    return {
      mode: 'project',
      bodyEyebrow: 'Game info',
      optionsLabel: 'Metadata',
      metaLabel: 'Source evidence',
      title: field('project.gameTitle', 'Game title', draft.gameTitle, 'guarded'),
      sections: [field('project.author', 'Author', draft.author, 'guarded')],
      options: [],
      metaFields: [
        field('project.id', 'Draft id', draft.id, 'guarded'),
        field('project.title', 'Draft title', draft.title, 'guarded'),
        field('project.ifid', 'IFID', draft.ifid, 'guarded')
      ]
    };
  }

  function variableBody(draft) {
    return {
      mode: 'variables',
      bodyEyebrow: 'Variable',
      optionsLabel: 'Initialization',
      metaLabel: 'Variable definition',
      title: field('variables.title', 'Draft title', draft.title, 'guarded'),
      heading: field('variables.label', 'Label', draft.label, 'guarded'),
      sections: [field('variables.description', 'Description', draft.description, 'guarded')],
      options: [],
      metaFields: [
        field('variables.id', 'Draft id', draft.id, 'guarded'),
        field('variables.mode', 'Mode', draft.mode, 'guarded', {inputType: 'select', options: [
          {value: 'add_new', label: 'Add new variable'},
          {value: 'edit_existing', label: 'Edit existing variable'},
          {value: 'delete_existing', label: 'Delete existing variable'}
        ]}),
        field('variables.variableName', 'Variable name', draft.variableName, 'guarded'),
        field('variables.initialValue', 'Initial value', draft.initialValue, 'guarded'),
        field('variables.valueType', 'Value type', draft.valueType, 'guarded', {inputType: 'select', options: ['number', 'boolean', 'string']}),
        field('variables.includeRootInit', 'Root init', draft.includeRootInit, 'guarded', {inputType: 'checkbox'}),
        field('variables.includePostEventInit', 'Post-event init', draft.includePostEventInit, 'guarded', {inputType: 'checkbox'}),
        field('variables.includeQualityFile', 'Quality file', draft.includeQualityFile, 'guarded', {inputType: 'checkbox'})
      ]
    };
  }

  function field(id, label, value, status, extra) {
    const text = value === undefined || value === null ? '' : String(value);
    return Object.assign({
      id,
      label,
      original: text,
      value: text,
      status: status || 'guarded',
      editability: status || 'guarded',
      source: {}
    }, extra || {});
  }

  function optionRow(option, index, fields) {
    return {
      id: option.id || 'option_' + (index + 1),
      targetId: option.targetId || option.gotoAfter || '',
      label: option.label || option.title || option.id || ('Option ' + (index + 1)),
      subtitle: option.subtitle || '',
      fields
    };
  }

  function textFields(prefix, draft, pairs) {
    return pairs.map(([key, label]) => field(prefix + key, label, draft[key], 'guarded'));
  }

  function effectFields(prefix, effects) {
    const rows = ensureArray(effects);
    const fields = [];
    rows.forEach((effect, index) => {
      const value = effect && typeof effect === 'object' ? effect : {};
      fields.push(field(prefix + '.' + index + '.variable', 'Variable', value.variable, 'guarded'));
      fields.push(field(prefix + '.' + index + '.op', 'Operation', value.op, 'guarded', {inputType: 'select', options: ['=', '+=', '-=']}));
      fields.push(field(prefix + '.' + index + '.value', 'Value', value.value, 'guarded'));
      fields.push(field(prefix + '.' + index + '.condition', 'Condition', value.condition, 'guarded'));
      fields.push(field(prefix + '.' + index + '.hook', 'Hook', value.hook, 'guarded', {inputType: 'select', options: ['', 'on-arrival', 'choice', 'post-result']}));
    });
    fields.push(field(prefix + '.add.variable', 'Add effect variable', '', 'guarded'));
    fields.push(field(prefix + '.add.op', 'Add effect operation', '+=', 'guarded', {inputType: 'select', options: ['=', '+=', '-=']}));
    fields.push(field(prefix + '.add.value', 'Add effect value', '1', 'guarded'));
    fields.push(field(prefix + '.add.condition', 'Add effect condition', '', 'guarded'));
    fields.push(field(prefix + '.add.hook', 'Add effect hook', 'choice', 'guarded', {inputType: 'select', options: ['', 'on-arrival', 'choice', 'post-result']}));
    return fields;
  }

  function joinParagraphs(value) {
    return ensureArray(value).map((item) => String(item || '').trim()).filter(Boolean).join('\n\n');
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  const api = {
    eventBody,
    newsBody,
    cardBody,
    surfaceBody,
    entryBody,
    playSurfaceBody,
    workspaceLayoutBody,
    sidebarStatusBody,
    electionResultsBody,
    projectBody,
    variableBody
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectCanvasContentBodies = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
