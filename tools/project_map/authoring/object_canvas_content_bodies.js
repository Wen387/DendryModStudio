(function initProjectMapObjectCanvasContentBodies(global) {
  'use strict';

  function eventBody(draft, projectIndex, options) {
    const structureApi = eventStructureApi();
    if (structureApi && typeof structureApi.fromDraft === 'function' && typeof structureApi.toEventBody === 'function') {
      return structureApi.toEventBody(structureApi.fromDraft(draft, projectIndex, options), options);
    }
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
    const sections = ensureArray(draft.sections);
    const sectionOptions = sections.reduce((rows, section, sectionIndex) => rows.concat(ensureArray(section.options).map((option, optionIndex) => ({
      section,
      sectionIndex,
      option,
      optionIndex
    }))), []);
    return {
      mode: 'card',
      cardShape: draft.cardShape || 'choice_card',
      archetypeHint: draft.cardShape || '',
      bodyEyebrow: 'Card body',
      optionsLabel: draft.cardShape === 'menu_card' ? 'Menu choices' : 'Card choices',
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
      branchSections: sections.reduce((rows, section, index) => rows.concat(cardBranchFields(section, index)), []),
      backgroundEffects: sections.reduce((rows, section) => rows.concat(ensureArray(section.effects).map((effect) => Object.assign({}, effect, {
        sectionId: section.id || '',
        source: {}
      }))), []),
      structureActions: cardStructureActions(draft),
      optionEffects: ensureArray(draft.options).map((option, index) => ({
        id: option.id || 'option_' + (index + 1),
        label: option.label || option.id || ('Choice ' + (index + 1)),
        fields: effectFields('card.option.' + index + '.effect', option.effects)
      })).concat(sectionOptions.map((row) => ({
        id: row.option.id || 'section_option_' + (row.optionIndex + 1),
        label: (row.section.title || row.section.id || 'Section') + ': ' + (row.option.label || row.option.id || ('Choice ' + (row.optionIndex + 1))),
        sectionId: row.section.id || '',
        fields: effectFields('card.section.' + row.sectionIndex + '.option.' + row.optionIndex + '.effect', row.option.effects)
      }))),
      metaFields: [
        field('card.id', 'Card id', draft.id, 'guarded'),
        field('card.cardShape', 'Card shape', draft.cardShape || 'choice_card', 'guarded', {inputType: 'select', options: [
          {value: 'choice_card', label: 'Choice card'},
          {value: 'menu_card', label: 'Menu card'},
          {value: 'pinned_text_card', label: 'Pinned text card'}
        ]}),
        field('card.cardKind', 'Card kind', draft.cardKind, 'guarded'),
        field('card.tags', 'Tags', ensureArray(draft.tags).join(', '), 'guarded'),
        field('card.viewIf', 'View condition', draft.viewIf, 'guarded'),
        field('card.priority', 'Priority', draft.priority, 'guarded'),
        field('card.frequency', 'Frequency', draft.frequency, 'guarded'),
        field('card.maxVisits', 'Max visits', draft.maxVisits, 'guarded')
      ]
    };
  }

  function cardStructureActions(draft) {
    const actions = [structureAction('structure_add_option', 'Add card choice', 'add_option', {
      targetLabel: 'Card choices',
      help: 'Adds a root card choice to the current draft.'
    }), structureAction('structure_add_branch', 'Add menu section', 'add_branch', {
      targetLabel: 'Menu sections',
      help: 'Adds a menu/card section to the current draft.'
    })];
    ensureArray(draft.options).forEach((option, index) => {
      const optionId = option.id || 'option_' + (index + 1);
      actions.push(structureAction('structure_remove_option_' + optionId, 'Remove choice: ' + (option.label || optionId), 'remove_option', {
        optionId,
        targetLabel: option.label || optionId,
        before: option.label || optionId,
        help: 'Removes this root card choice from the draft.'
      }));
      if (index > 0) {
        actions.push(structureAction('structure_move_option_up_' + optionId, 'Move choice up: ' + (option.label || optionId), 'move_option_up', {
          optionId,
          targetLabel: option.label || optionId,
          before: option.label || optionId,
          help: 'Moves this root card choice earlier in the draft.'
        }));
      }
      if (index < ensureArray(draft.options).length - 1) {
        actions.push(structureAction('structure_move_option_down_' + optionId, 'Move choice down: ' + (option.label || optionId), 'move_option_down', {
          optionId,
          targetLabel: option.label || optionId,
          before: option.label || optionId,
          help: 'Moves this root card choice later in the draft.'
        }));
      }
    });
    ensureArray(draft.sections).forEach((section, sectionIndex) => {
      const sectionId = section.id || 'section_' + (sectionIndex + 1);
      actions.push(structureAction('structure_add_option_section_' + sectionId, 'Add choice to ' + (section.title || sectionId), 'add_option', {
        sectionId,
        targetLabel: section.title || sectionId,
        help: 'Adds a choice inside this menu section.'
      }));
      ensureArray(section.options).forEach((option, optionIndex) => {
        const optionId = option.id || sectionId + '_option_' + (optionIndex + 1);
        actions.push(structureAction('structure_remove_option_' + optionId, 'Remove section choice: ' + (option.label || optionId), 'remove_option', {
          sectionId,
          optionId,
          targetLabel: option.label || optionId,
          before: option.label || optionId,
          help: 'Removes this section-owned card choice from the draft.'
        }));
      });
    });
    return actions;
  }

  function structureAction(id, label, action, extra) {
    const data = extra || {};
    return field(id, label, '', 'guarded', Object.assign({
      role: 'structure',
      transform: 'structure_action',
      structureAction: action,
      structureTargetLabel: data.targetLabel || label,
      structureBefore: data.before || '',
      reason: data.help || 'Structural changes are applied to the current card draft.',
      source: {}
    }, data));
  }

  function cardBranchFields(section, index) {
    const label = section.title || section.id || 'Menu section';
    const meta = {
      sectionId: section.id || '',
      sectionLabel: label,
      semanticRole: section.condition ? 'conditional_text' : 'section_text',
      branchKind: section.condition ? 'conditional' : 'section',
      conditions: section.condition ? [section.condition] : []
    };
    const optionFields = ensureArray(section.options).reduce((rows, option, optionIndex) => rows.concat([
      field('card.section.' + index + '.option.' + optionIndex + '.label', label + ' choice label', option.label, 'guarded', Object.assign({}, meta, {optionId: option.id || '', semanticRole: 'section_option_label'})),
      field('card.section.' + index + '.option.' + optionIndex + '.body', label + ' choice result', joinParagraphs(option.narrativeParagraphs), 'guarded', Object.assign({}, meta, {optionId: option.id || '', semanticRole: 'section_option_text'})),
      field('card.section.' + index + '.option.' + optionIndex + '.chooseIf', label + ' choice condition', option.chooseIf, 'guarded', Object.assign({}, meta, {optionId: option.id || '', role: 'condition', semanticRole: 'section_option_condition'})),
      field('card.section.' + index + '.option.' + optionIndex + '.gotoAfter', label + ' choice route', option.gotoAfter || 'root', 'guarded', Object.assign({}, meta, {optionId: option.id || '', role: 'route', semanticRole: 'section_option_route'}))
    ]), []);
    return [
      field('card.section.' + index + '.title', label + ' title', section.title || '', 'guarded', Object.assign({}, meta, {semanticRole: 'section_title'})),
      field('card.section.' + index + '.condition', label + ' condition', section.condition || '', 'guarded', Object.assign({}, meta, {role: 'condition', semanticRole: 'section_condition'})),
      field('card.section.' + index + '.body', label, joinParagraphs(section.paragraphs), 'guarded', meta),
      field('card.section.' + index + '.exitTarget', label + ' exit route', section.exitTarget || 'root', 'guarded', Object.assign({}, meta, {role: 'route', semanticRole: 'section_exit_route'}))
    ].concat(optionFields);
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
        field('sidebar.sectionId', 'Section id', draft.sectionId, 'guarded'),
        field('sidebar.operationMode', 'Operation', draft.operationMode || 'edit', 'guarded'),
        Object.assign(field('sidebar.deleteConfirm', 'Confirm delete', draft.deleteConfirm ? 'true' : 'false', 'guarded'), {inputType: 'checkbox'})
      ]
    };
  }

  function electionResultsBody(draft) {
    const parties = ensureArray(draft.parties);
    const coalitions = ensureArray(draft.coalitions);
    const choices = ensureArray(draft.choices);
    return {
      mode: 'election_results',
      bodyEyebrow: 'Election results',
      optionsLabel: 'Player choices',
      metaLabel: 'Election rules, parties, and coalitions',
      title: field('election.title', 'Title', draft.title, 'guarded'),
      heading: field('election.subtitle', 'Subtitle', draft.subtitle, 'guarded'),
      sections: [
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

  function deckPoolBody(draft) {
    const launchers = ensureArray(draft.launcherRoutes);
    const members = ensureArray(draft.memberCards);
    const candidates = ensureArray(draft.availableMemberCards);
    const targetPools = ensureArray(draft.targetDeckPools);
    const memberCandidateOptions = [{value: '', label: 'Select a card'}].concat(candidates.map((card) => ({
      value: card.cardId,
      label: (card.title || card.cardId) + (ensureArray(card.currentPoolIds).length ? ' (' + card.currentPoolIds.join(', ') + ')' : '')
    })));
    const targetPoolOptions = [{value: '', label: 'Keep in this pool'}].concat(targetPools.map((pool) => ({
      value: pool.id,
      label: pool.label || pool.id
    })));
    return {
      mode: 'deck_pool',
      bodyEyebrow: 'Deck pool',
      optionsLabel: 'Pool members',
      metaLabel: 'Pool routing',
      title: field('deckPool.label', 'Deck label', draft.label, 'guarded'),
      sections: [
        field('deckPool.id', 'Deck pool id', draft.deckPoolId, 'read_only', {readOnly: true}),
        field('deckPool.ownerSceneId', 'Owner scene', draft.ownerSceneId, 'read_only', {readOnly: true}),
        field('deckPool.ownerSectionId', 'Owner section', draft.ownerSectionId, 'read_only', {readOnly: true})
      ],
      options: members.map((member) => optionRow({
        id: member.cardId,
        label: member.title || member.cardId,
        targetId: member.membership
      }, 0, [
        field('deckPool.member.' + member.cardId + '.title', 'Card title', member.title, 'read_only', {readOnly: true, cardId: member.cardId}),
        field('deckPool.member.' + member.cardId + '.id', 'Card id', member.cardId, 'read_only', {readOnly: true, cardId: member.cardId}),
        field('deckPool.member.' + member.cardId + '.membership', 'Membership', member.membership, 'read_only', {readOnly: true, cardId: member.cardId}),
        field('deckPool.member.' + member.cardId + '.editableReason', 'Evidence', member.editableReason || 'review', 'read_only', {readOnly: true, cardId: member.cardId}),
        field('deckPool.member.' + member.cardId + '.remove', 'Remove from pool', 'false', 'guarded', {inputType: 'checkbox', cardId: member.cardId}),
        field('deckPool.member.' + member.cardId + '.moveTargetDeckPoolId', 'Move to pool', '', 'guarded', {inputType: 'select', options: targetPoolOptions, cardId: member.cardId})
      ])),
      metaFields: launchers.map((route, index) => field('deckPool.launcher.' + index + '.label', 'Launcher ' + (index + 1), route.label, 'guarded')).concat(ensureArray(draft.routeTags).map((tag, index) => field('deckPool.routeTag.' + index, 'Route tag ' + (index + 1), tag, 'read_only', {readOnly: true, help: 'Routing evidence; rename route tags from source review.'}))).concat([
        field('deckPool.add.memberCardId', 'Add card to pool', draft.addMemberCardId, 'guarded', {inputType: 'select', options: memberCandidateOptions})
      ])
    };
  }

  function advisorControllerBody(draft) {
    const roster = ensureArray(draft.roster);
    return {
      mode: 'advisor_controller',
      bodyEyebrow: 'Advisor controller',
      optionsLabel: 'Advisor roster',
      metaLabel: 'Controller routing',
      title: field('advisorController.entry.label', 'Pinned entry label', draft.entryLabel, 'guarded'),
      sections: [
        field('advisorController.id', 'Controller id', draft.controllerId, 'read_only', {readOnly: true}),
        field('advisorController.pinnedEntryId', 'Pinned entry scene', draft.pinnedEntryId, 'read_only', {readOnly: true}),
        field('advisorController.entry.target', 'Controller route target', draft.pinnedEntryTargetSceneId, 'read_only', {readOnly: true})
      ],
      options: roster.map((item) => optionRow({
        id: item.advisorId,
        label: item.title || item.advisorId,
        targetId: item.activeVariable
      }, 0, [
        field('advisorController.roster.' + item.advisorId + '.title', 'Advisor title', item.title, 'guarded'),
        field('advisorController.roster.' + item.advisorId + '.activeVariable', 'Active variable', item.activeVariable, 'guarded'),
        field('advisorController.roster.' + item.advisorId + '.category', 'Category / faction', item.category, 'guarded'),
        field('advisorController.roster.' + item.advisorId + '.add.label', 'Add label', item.addLabel, 'guarded'),
        field('advisorController.roster.' + item.advisorId + '.remove.label', 'Remove label', item.removeLabel, 'guarded'),
        field('advisorController.roster.' + item.advisorId + '.add.effect', 'Add effect', item.addEffectText, 'guarded'),
        field('advisorController.roster.' + item.advisorId + '.remove.effect', 'Remove effect', item.removeEffectText, 'guarded')
      ])),
      metaFields: [
        field('advisorController.addAdvisorId', 'Add advisor candidate', draft.addAdvisorId, 'guarded'),
        field('advisorController.removeAdvisorId', 'Remove advisor candidate', draft.removeAdvisorId, 'guarded'),
        field('advisorController.capacityGate', 'Capacity gate', draft.capacityGate && draft.capacityGate.variable || '', 'read_only', {readOnly: true})
      ]
    };
  }

  function joinParagraphs(value) {
    return ensureArray(value).map((item) => String(item || '').trim()).filter(Boolean).join('\n\n');
  }

  function eventStructureApi() {
    if (global && global.ProjectMapEventStructureModel) {
      return global.ProjectMapEventStructureModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./event_structure_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  const api = {
    eventBody,
    newsBody,
    cardBody,
    deckPoolBody,
    advisorControllerBody,
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
