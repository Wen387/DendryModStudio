(function initProjectMapEventStructureModel(global) {
  'use strict';

  const EVENT_STRUCTURE_VERSION = '0.1';
  const STRUCTURE_KIND = 'event_structure';

  function fromDraft(input, projectIndex, options) {
    const draft = isObject(input) ? clone(input) : {};
    const rootOptions = ensureArray(draft.options).map((option, index) => optionFromDraft(option, index, ''));
    const sections = ensureArray(draft.sections).map(sectionFromDraft).filter((section) => section.id);
    return {
      schemaVersion: EVENT_STRUCTURE_VERSION,
      kind: STRUCTURE_KIND,
      provenance: 'draft',
      mode: 'new_event',
      id: stringValue(draft.id || 'new_world_event'),
      title: stringValue(draft.title || draft.heading || 'New World Event'),
      heading: stringValue(draft.heading || draft.title || 'New World Event'),
      openingText: joinParagraphs(draft.introParagraphs),
      when: isObject(draft.when) ? clone(draft.when) : {},
      source: sourceRef({path: 'source/scenes/events/' + (draft.id || 'new_world_event') + '.scene.dry'}),
      triggerEffects: ensureArray(draft.effectsOnTrigger).map(effectFromDraft).filter((effect) => effect.variable),
      options: rootOptions.concat(sections.reduce((rows, section) => rows.concat(section.options), [])),
      sections,
      assets: ensureArray(draft.assetRefs).concat(ensureArray(draft.assetInstallRequests)),
      projectIndex: projectIndex || null,
      rawDraft: draft,
      optionsMeta: options || {}
    };
  }

  function fromEditingContext(context, projectIndex, options) {
    const opts = isObject(options) ? options : {};
    const body = opts.body ? clone(opts.body) : null;
    return {
      schemaVersion: EVENT_STRUCTURE_VERSION,
      kind: STRUCTURE_KIND,
      provenance: 'source',
      mode: 'existing',
      id: stringValue(context && context.sceneId || ''),
      title: stringValue(context && context.title || context && context.sceneId || ''),
      heading: stringValue(context && context.title || context && context.sceneId || ''),
      source: sourceRef(context && context.source || {}),
      options: ensureArray(body && body.options).map((option, index) => optionFromBody(option, index)),
      sections: ensureArray(body && body.branchSections).map((field, index) => sectionFromBodyField(field, index)),
      triggerEffects: ensureArray(body && body.effects).map((field, index) => effectFromField(field, index)).filter((effect) => effect.variable),
      sourceBody: body,
      projectIndex: projectIndex || null,
      rawContext: context || null
    };
  }

  function toEventBody(structure, options) {
    const value = isObject(structure) ? structure : {};
    if (value.sourceBody) {
      const body = clone(value.sourceBody);
      body.eventStructure = compactStructure(value);
      return body;
    }
    return draftEventBody(value, options);
  }

  function applyCommand(structure, command) {
    const next = clone(isObject(structure) ? structure : {});
    const cmd = isObject(command) ? command : {};
    const type = stringValue(cmd.type || cmd.action);
    if (type === 'add_option') {
      addOption(next, parseAddOption(cmd.value || cmd.raw || cmd.text), cmd);
    } else if (type === 'remove_option') {
      removeOption(next, cmd.optionId || cmd.targetId || cmd.id);
    } else if (type === 'remove_option_condition') {
      updateOption(next, cmd.optionId || cmd.targetId || cmd.id, (option) => {
        option.chooseIf = '';
        option.unavailableText = '';
      });
    } else if (type === 'add_section' || type === 'add_branch') {
      addSection(next, parseBranch(cmd.value || cmd.raw || cmd.text), cmd);
    } else if (type === 'remove_section' || type === 'remove_layer') {
      removeSection(next, cmd.sectionId || cmd.targetId || cmd.id);
    } else if (type === 'add_trigger_effect') {
      const effect = parseEffect(cmd.value || cmd.raw || cmd.text);
      if (effect.variable) {
        next.triggerEffects = ensureArray(next.triggerEffects).concat(effect);
      }
    } else if (type === 'remove_trigger_effect') {
      removeEffectAt(next.triggerEffects, cmd.effectIndex);
    } else if (type === 'add_option_effect') {
      const effect = parseEffect(cmd.value || cmd.raw || cmd.text);
      if (effect.variable) {
        updateOption(next, cmd.optionId || cmd.targetId || cmd.id, (option) => {
          option.effects = ensureArray(option.effects).concat(effect);
        });
      }
    } else if (type === 'remove_option_effect') {
      updateOption(next, cmd.optionId || cmd.targetId || cmd.id, (option) => {
        removeEffectAt(option.effects, cmd.effectIndex);
      });
    } else if (type === 'update_field') {
      updateField(next, cmd.fieldId || cmd.id, cmd.value);
    }
    return next;
  }

  function toDraft(structure, previousDraft) {
    const value = isObject(structure) ? structure : {};
    const draft = clone(isObject(previousDraft) ? previousDraft : value.rawDraft || {});
    draft.kind = stringValue(draft.kind || 'world_event');
    draft.schemaVersion = stringValue(draft.schemaVersion || '0.1');
    draft.id = safeId(value.id || draft.id || 'new_world_event');
    draft.title = stringValue(value.title || draft.title || 'New World Event');
    draft.heading = stringValue(value.heading || value.title || draft.heading || draft.title || 'New World Event');
    draft.when = isObject(value.when) ? clone(value.when) : (isObject(draft.when) ? draft.when : {});
    draft.introParagraphs = paragraphs(value.openingText);
    draft.effectsOnTrigger = ensureArray(value.triggerEffects).map(effectToDraft).filter((effect) => effect.variable);
    draft.options = ensureArray(value.options)
      .filter((option) => !option.ownerSectionId)
      .map(optionToDraft);
    const sections = ensureArray(value.sections).map(sectionToDraft).filter((section) => section.id);
    if (sections.length) {
      draft.sections = sections;
    } else {
      delete draft.sections;
    }
    return draft;
  }

  function toExistingProposalCommands(structure) {
    return ensureArray(structure && structure.pendingCommands).map(clone);
  }

  function commandsFromValues(values, structure) {
    const data = isObject(values) ? values : {};
    const current = isObject(structure) ? structure : {};
    const commands = [];
    queuedCommandsFromValues(data).forEach((command) => commands.push(command));
    pushFieldUpdateCommands(commands, data);
    pushTextCommand(commands, data, 'structure_add_option', 'add_option');
    pushTextCommand(commands, data, 'structure_add_branch', 'add_section');
    pushTextCommand(commands, data, 'structure_add_trigger_effect', 'add_trigger_effect');
    Object.keys(data).forEach((key) => {
      const text = stringValue(data[key]).trim();
      if (!text) {
        return;
      }
      if (key.indexOf('structure_add_option_section_') === 0) {
        commands.push({type: 'add_option', sectionId: key.slice('structure_add_option_section_'.length), value: text});
      } else if (key.indexOf('structure_add_option_effect_') === 0) {
        commands.push({type: 'add_option_effect', optionId: key.slice('structure_add_option_effect_'.length), value: text});
      } else if (key.indexOf('structure_remove_option_condition_') === 0 && truthy(text)) {
        commands.push({type: 'remove_option_condition', optionId: key.slice('structure_remove_option_condition_'.length)});
      } else if (key.indexOf('structure_remove_option_') === 0 && truthy(text)) {
        commands.push({type: 'remove_option', optionId: key.slice('structure_remove_option_'.length)});
      } else if (key.indexOf('structure_remove_trigger_effect_') === 0 && truthy(text)) {
        commands.push({type: 'remove_trigger_effect', effectIndex: Number(key.slice('structure_remove_trigger_effect_'.length))});
      } else if (key.indexOf('structure_remove_option_effect_') === 0 && truthy(text)) {
        commands.push(removeOptionEffectCommand(key, current));
      } else if (key.indexOf('structure_remove_layer_') === 0 && truthy(text)) {
        commands.push({type: 'remove_section', sectionId: key.slice('structure_remove_layer_'.length)});
      }
    });
    return commands.filter(Boolean);
  }

  function queuedCommandsFromValues(data) {
    const raw = data && (data.__structureCommands || data.structure_commands || data.structureCommands);
    const rows = Array.isArray(raw) ? raw : parseJsonArray(raw);
    return rows.map(normalizeQueuedCommand).filter(Boolean);
  }

  function normalizeQueuedCommand(input) {
    const value = isObject(input) ? input : {};
    const type = stringValue(value.type || value.action);
    if (!type) {
      return null;
    }
    return {
      id: stringValue(value.id),
      type: type === 'add_branch' ? 'add_section' : type,
      action: type,
      fieldId: stringValue(value.fieldId),
      optionId: stringValue(value.optionId),
      sectionId: stringValue(value.sectionId),
      targetId: stringValue(value.targetId),
      targetLabel: stringValue(value.targetLabel),
      effectIndex: value.effectIndex === undefined || value.effectIndex === null || value.effectIndex === '' ? null : Number(value.effectIndex),
      value: stringValue(value.value),
      sourceContext: isObject(value.sourceContext) ? clone(value.sourceContext) : null,
      mode: stringValue(value.mode)
    };
  }

  function parseJsonArray(value) {
    if (typeof value !== 'string' || !value.trim()) {
      return [];
    }
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function draftEventBody(structure) {
    const allOptions = ensureArray(structure.options);
    const rootOptions = allOptions.filter((option) => !option.ownerSectionId);
    const branchSections = ensureArray(structure.sections).map((section, index) => branchField(section, index));
    const actions = draftStructureActions(structure, rootOptions, allOptions);
    return {
      mode: 'new_event',
      bodyEyebrow: 'Event body',
      optionsLabel: 'Options',
      metaLabel: 'Timing and advanced fields',
      title: field('event.title', 'Title', structure.title, 'guarded'),
      heading: field('event.heading', 'Heading', structure.heading || structure.title, 'guarded'),
      sections: [field('event.intro', 'Opening text', structure.openingText, 'guarded', {
        semanticRole: 'opening_text',
        sectionId: 'opening'
      })],
      branchSections,
      options: allOptions.map((option, index) => optionRow(option, index, structure)),
      effects: effectFields('event.effect', ensureArray(structure.triggerEffects)),
      optionEffects: allOptions.map((option, index) => ({
        id: option.id || 'option_' + (index + 1),
        optionId: option.id || 'option_' + (index + 1),
        label: option.label || option.id || ('Option ' + (index + 1)),
        fields: effectFields('option.' + index + '.effect', option.effects)
      })),
      metaFields: [
        field('event.id', 'Event id', structure.id, 'guarded'),
        field('event.year', 'Year', structure.when && structure.when.year, 'guarded'),
        field('event.monthStart', 'Month start', structure.when && structure.when.monthStart, 'guarded'),
        field('event.monthEnd', 'Month end', structure.when && structure.when.monthEnd, 'guarded'),
        field('event.requires', 'Condition', structure.when && structure.when.requires, 'guarded'),
        field('event.priority', 'Priority', structure.when && structure.when.priority, 'guarded')
      ],
      structureActions: actions,
      eventStructure: compactStructure(structure)
    };
  }

  function draftStructureActions(structure, rootOptions, allOptions) {
    const actions = [];
    const root = ensureArray(rootOptions);
    const options = ensureArray(allOptions).length ? ensureArray(allOptions) : root;
    if (root.length < 4) {
      actions.push(structuralField({
        id: 'structure_add_option',
        action: 'add_option',
        label: 'Add option and result layer',
        inputType: 'textarea',
        placeholder: '- @new_option: Player-facing option text\n# new_option\nResult prose, routes, and effects.',
        help: 'Create a new player choice and the result text it opens.'
      }));
    }
    ensureArray(structure.sections).forEach((section) => {
      const sectionId = safeId(section && section.id || '');
      if (!sectionId) {
        return;
      }
      const sectionLabel = stringValue(section && (section.title || section.id || sectionId));
      actions.push(structuralField({
        id: 'structure_add_option_section_' + sectionId,
        action: 'add_option',
        sectionId,
        label: 'Add option to section: ' + sectionLabel,
        targetLabel: sectionLabel,
        inputType: 'textarea',
        placeholder: '- @new_option: Player-facing option text\n# new_option\nchoose-if: variable >= 1\nunavailable-subtitle: Requirement not met.\nResult prose, routes, and effects.',
        help: 'Create a new player choice owned by this follow-up or menu section.'
      }));
    });
    actions.push(structuralField({
      id: 'structure_add_branch',
      action: 'add_branch',
      label: 'Add conditional or follow-up layer',
      inputType: 'textarea',
      placeholder: '# follow_up\n[? if variable >= 1 : Conditional prose or a nested choice layer. ?]',
      help: 'Create a same-event follow-up or conditional section.'
    }));
    actions.push(structuralField({
      id: 'structure_add_trigger_effect',
      role: 'effect',
      action: 'add_trigger_effect',
      label: 'Add trigger effect',
      inputType: 'text',
      placeholder: 'Q.variable += 1',
      help: 'Add a Q effect that runs when this event opens.'
    }));
    options.forEach((option) => {
      if (option.ownerSectionId || root.length > 2) {
        actions.push(structuralField({
          id: 'structure_remove_option_' + safeId(option.id),
          role: 'route',
          action: 'remove_option',
          optionId: option.id,
          label: 'Remove option: ' + (option.label || option.id),
          targetLabel: option.label || option.id,
          inputType: 'checkbox',
          before: 'option: ' + (option.label || option.id),
          help: 'Remove this draft option from the event.'
        }));
      }
    });
    options.forEach((option) => {
      actions.push(structuralField({
        id: 'structure_add_option_effect_' + safeId(option.id),
        role: 'effect',
        action: 'add_option_effect',
        optionId: option.id,
        label: 'Add effect to option: ' + (option.label || option.id),
        targetLabel: option.label || option.id,
        inputType: 'text',
        placeholder: 'Q.variable += 1 if condition',
        help: 'Add a Q effect that runs from this option/result.'
      }));
      if (option.chooseIf) {
        actions.push(structuralField({
          id: 'structure_remove_option_condition_' + safeId(option.id),
          role: 'condition',
          action: 'remove_option_condition',
          optionId: option.id,
          label: 'Remove prerequisite: ' + (option.label || option.id),
          targetLabel: option.label || option.id,
          inputType: 'checkbox',
          before: option.chooseIf,
          help: 'Remove this draft option prerequisite.'
        }));
      }
      ensureArray(option.effects).forEach((effect, index) => {
        actions.push(structuralField({
          id: 'structure_remove_option_effect_' + safeId(option.id) + '_' + index,
          role: 'effect',
          action: 'remove_effect',
          optionId: option.id,
          label: 'Remove effect: ' + effectLabel(effect),
          targetLabel: option.label || option.id,
          inputType: 'checkbox',
          before: effectLabel(effect),
          help: 'Remove this option effect.'
        }));
      });
    });
    ensureArray(structure.triggerEffects).forEach((effect, index) => {
      actions.push(structuralField({
        id: 'structure_remove_trigger_effect_' + index,
        role: 'effect',
        action: 'remove_effect',
        label: 'Remove effect: ' + effectLabel(effect),
        targetLabel: 'trigger',
        inputType: 'checkbox',
        before: effectLabel(effect),
        help: 'Remove this trigger effect.'
      }));
    });
    ensureArray(structure.sections).forEach((section) => {
      actions.push(structuralField({
        id: 'structure_remove_layer_' + safeId(section.id),
        action: 'remove_layer',
        sectionId: section.id,
        label: 'Remove layer: ' + (section.title || section.id),
        targetLabel: section.title || section.id,
        inputType: 'checkbox',
        before: [section.id ? 'section: ' + section.id : '', section.condition ? 'condition: ' + section.condition : '', section.text].filter(Boolean).join('\n'),
        help: 'Remove this draft follow-up or conditional layer.'
      }));
    });
    return actions;
  }

  function structureActionsForSource(input) {
    const value = isObject(input) ? input : {};
    const sceneId = stringValue(value.sceneId);
    const sceneSource = sourceRef(value.source || value.sceneSource || {path: value.sourcePath});
    const options = ensureArray(value.options);
    const effects = ensureArray(value.effects);
    const textBlocks = ensureArray(value.textBlocks);
    const fields = [
      structuralField({
        id: 'structure_add_option',
        label: 'Add option and result layer',
        action: 'add_option',
        sceneId,
        source: sceneSource,
        inputType: 'textarea',
        placeholder: '- @new_option: Player-facing option text\n# new_option\nResult prose, routes, and effects.',
        help: 'Draft a new option line plus the result section it should open.'
      }),
      structuralField({
        id: 'structure_add_branch',
        label: 'Add conditional or follow-up layer',
        action: 'add_branch',
        sceneId,
        source: sceneSource,
        inputType: 'textarea',
        placeholder: '# follow_up\n[? if variable >= 1 : Conditional prose or a nested choice layer. ?]',
        help: 'Draft a new conditional section, follow-up section, or nested event layer.'
      }),
      structuralField({
        id: 'structure_add_trigger_effect',
        role: 'effect',
        label: 'Add trigger effect',
        action: 'add_trigger_effect',
        sceneId,
        source: sceneSource,
        inputType: 'text',
        placeholder: 'Q.variable += 1',
        help: 'Add a new Q effect that should run when this object opens.'
      })
    ];
    const sectionAdditions = new Set();
    textBlocks.forEach((block) => {
      const sectionId = stringValue(block && block.sectionId);
      if (!sectionId || sectionAdditions.has(sectionId)) {
        return;
      }
      sectionAdditions.add(sectionId);
      const sectionLabel = stringValue(block && (block.sectionLabel || block.label || sectionId));
      fields.push(structuralField({
        id: 'structure_add_option_section_' + safeId(sectionId),
        label: 'Add option to section: ' + sectionLabel,
        action: 'add_option',
        sceneId,
        sectionId,
        targetLabel: sectionLabel,
        source: block && block.source || sceneSource,
        inputType: 'textarea',
        placeholder: '- @new_option: Player-facing option text\n# new_option\nchoose-if: variable >= 1\nunavailable-subtitle: Requirement not met.\nResult prose, routes, and effects.',
        help: 'Draft a new option owned by this follow-up, menu, or result section.'
      }));
    });
    options.forEach((option) => {
      const optionId = stringValue(option && option.id);
      const optionLabel = stringValue(option && (option.label || optionId || 'option'));
      const optionKey = safeId(optionId || optionLabel);
      const effectSource = effectSourceForOption(option, effects, options);
      fields.push(structuralField({
        id: 'structure_add_option_effect_' + optionKey,
        role: 'effect',
        label: 'Add effect to option: ' + optionLabel,
        action: 'add_option_effect',
        sceneId,
        sectionId: stringValue(option && (option.targetId || option.sectionId)),
        optionId,
        targetLabel: optionLabel,
        source: effectSource || option && option.source || sceneSource,
        inputType: 'text',
        placeholder: 'Q.variable += 1 if condition',
        help: 'Add a new Q effect that should run from this option/result.'
      }));
      fields.push(structuralField({
        id: 'structure_remove_option_' + optionKey,
        role: 'route',
        label: 'Remove option: ' + optionLabel,
        action: 'remove_option',
        sceneId,
        sectionId: stringValue(option && option.sectionId),
        optionId,
        targetLabel: optionLabel,
        source: option && option.source || sceneSource,
        inputType: 'checkbox',
        original: 'false',
        before: [
          'option: ' + optionLabel,
          option && option.rawTargetId ? 'target: ' + option.rawTargetId : '',
          firstNonEmpty(option && option.chooseIf, option && option.sectionChooseIf, option && option.sectionViewIf)
            ? 'condition: ' + firstNonEmpty(option && option.chooseIf, option && option.sectionChooseIf, option && option.sectionViewIf)
            : ''
        ].filter(Boolean).join('\n'),
        help: 'Remove this option only after checking its target section, incoming references, effects, and unavailable text.'
      }));
      const condition = firstNonEmpty(option && option.chooseIf, option && option.sectionChooseIf, option && option.sectionViewIf);
      if (condition) {
        fields.push(structuralField({
          id: 'structure_remove_option_condition_' + optionKey,
          role: 'condition',
          label: 'Remove prerequisite: ' + optionLabel,
          action: 'remove_option_condition',
          sceneId,
          sectionId: stringValue(option && option.sectionId),
          optionId,
          targetLabel: optionLabel,
          source: option && option.source || sceneSource,
          inputType: 'checkbox',
          original: 'false',
          before: condition,
          help: 'Remove this option prerequisite after checking unavailable text and routes.'
        }));
      }
    });
    effects.forEach((effect, index) => {
      const expression = effectLabelForSource(effect);
      if (!expression) {
        return;
      }
      const option = optionForSourceEffect(effect, options);
      fields.push(structuralField({
        id: 'structure_remove_effect_' + safeId(stringValue(effect && effect.variable || 'effect') + '_' + String(index + 1)),
        role: 'effect',
        label: 'Remove effect: ' + expression,
        action: 'remove_effect',
        sceneId,
        sectionId: stringValue(effect && effect.sectionId),
        optionId: option && option.id || '',
        targetLabel: option && option.label || stringValue(effect && effect.sectionId) || 'trigger',
        source: effect && effect.source || sceneSource,
        inputType: 'checkbox',
        original: 'false',
        before: expression,
        help: 'Remove this effect only after checking which option or trigger currently writes the variable.'
      }));
    });
    textBlocks.filter((block) => {
      const role = stringValue(block && block.semanticRole);
      return role === 'conditional_text' || role === 'conditional_option_result_text';
    }).forEach((block) => {
      fields.push(structuralField({
        id: 'structure_remove_layer_' + safeId(block.id || block.sectionId || block.label),
        label: 'Remove layer: ' + stringValue(block.label || block.sectionLabel || block.sectionId || 'branch'),
        action: 'remove_layer',
        sceneId,
        sectionId: stringValue(block.sectionId),
        targetLabel: stringValue(block.label || block.sectionLabel || block.sectionId || 'branch'),
        source: block.source || sceneSource,
        inputType: 'checkbox',
        original: 'false',
        before: [
          block.sectionId ? 'section: ' + block.sectionId : '',
          ensureArray(block.conditions).length ? 'conditions: ' + ensureArray(block.conditions).join(' / ') : '',
          stringValue(block.original).trim().slice(0, 240)
        ].filter(Boolean).join('\n'),
        help: 'Remove or split this composite layer only after checking nested options, routes, and effects.'
      }));
    });
    return fields;
  }

  function effectSourceForOption(option, effects, options) {
    const matches = ensureArray(effects).filter((effect) => {
      const owner = optionForSourceEffect(effect, options);
      return owner && safeId(owner.id || owner.targetId || owner.rawTargetId || '') === safeId(option && (option.id || option.targetId || option.rawTargetId));
    }).map((effect) => {
      const source = sourceRef(effect && effect.source || {});
      return source.path && source.anchorText ? Object.assign({}, source, {
        sourceOrder: Number(effect && effect.sourceOrder || 0) || 0
      }) : null;
    }).filter(Boolean);
    if (!matches.length) {
      return null;
    }
    matches.sort((a, b) => {
      const aOrder = Number(a.sourceOrder || 0) || 0;
      const bOrder = Number(b.sourceOrder || 0) || 0;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return Number(a.line || 0) - Number(b.line || 0);
    });
    const last = matches[matches.length - 1];
    return {
      path: last.path,
      line: last.line,
      startLine: last.startLine || last.line,
      endLine: last.endLine || last.line,
      anchorText: last.anchorText,
      endAnchorText: last.endAnchorText || last.anchorText
    };
  }

  function optionFromDraft(option, index, ownerSectionId) {
    const value = isObject(option) ? option : {};
    const id = safeId(value.id || 'option_' + (index + 1));
    return {
      id,
      ownerSectionId: stringValue(ownerSectionId),
      label: stringValue(value.label || value.title || 'Option ' + (index + 1)),
      subtitle: stringValue(value.subtitle),
      chooseIf: stringValue(value.chooseIf),
      unavailableText: stringValue(value.unavailableText),
      gotoAfter: safeId(value.gotoAfter || 'continue_' + id),
      body: joinParagraphs(value.narrativeParagraphs || value.body || value.text),
      effects: ensureArray(value.effects).map(effectFromDraft).filter((effect) => effect.variable),
      variants: ensureArray(value.variants).map((variant) => ({
        condition: stringValue(variant && variant.condition),
        text: stringValue(variant && variant.text)
      }))
    };
  }

  function optionFromBody(option, index) {
    const value = isObject(option) ? option : {};
    return {
      id: stringValue(value.id || 'option_' + (index + 1)),
      label: stringValue(value.label || value.title || value.id),
      targetId: stringValue(value.targetId),
      sectionId: stringValue(value.sectionId),
      chooseIf: stringValue(value.chooseIf || value.sectionChooseIf || value.sectionViewIf),
      fields: ensureArray(value.fields)
    };
  }

  function sectionFromDraft(section, index) {
    const value = isObject(section) ? section : {};
    const id = safeId(value.id || 'section_' + (index + 1));
    return {
      id,
      title: stringValue(value.title || value.heading || humanize(id)),
      text: joinParagraphs(value.paragraphs || value.narrativeParagraphs || value.body || value.text),
      condition: stringValue(value.condition || value.viewIf || value.chooseIf),
      options: ensureArray(value.options).map((option, optionIndex) => optionFromDraft(option, optionIndex, id)),
      effects: ensureArray(value.effects).map(effectFromDraft).filter((effect) => effect.variable)
    };
  }

  function sectionFromBodyField(fieldValue, index) {
    const value = isObject(fieldValue) ? fieldValue : {};
    return {
      id: stringValue(value.sectionId || value.id || 'section_' + (index + 1)),
      title: stringValue(value.sectionLabel || value.label || value.sectionId || value.id || 'Section'),
      text: stringValue(value.value || value.original),
      condition: ensureArray(value.conditions)[0] || '',
      options: [],
      source: sourceRef(value.source || {})
    };
  }

  function effectFromDraft(effect) {
    const value = isObject(effect) ? effect : {};
    return {
      variable: safeId(value.variable || ''),
      op: stringValue(value.op || '+='),
      value: value.value,
      condition: stringValue(value.condition),
      hook: stringValue(value.hook)
    };
  }

  function effectFromField(fieldValue, index) {
    const value = isObject(fieldValue) ? fieldValue : {};
    const parsed = parseEffect(value.value || value.original || '');
    parsed.id = stringValue(value.id || 'effect_' + index);
    return parsed;
  }

  function effectToDraft(effect) {
    const value = isObject(effect) ? effect : {};
    const out = {
      variable: safeId(value.variable || ''),
      op: stringValue(value.op || '+='),
      value: effectValue(value.value, value.op)
    };
    if (value.condition) {
      out.condition = stringValue(value.condition);
    }
    if (value.hook) {
      out.hook = stringValue(value.hook);
    }
    return out;
  }

  function sectionToDraft(section) {
    const value = isObject(section) ? section : {};
    const out = {
      id: safeId(value.id || 'section'),
      title: stringValue(value.title || humanize(value.id)),
      paragraphs: paragraphs(value.text),
      options: ensureArray(value.options).map(optionToDraft),
      effects: ensureArray(value.effects).map(effectToDraft).filter((effect) => effect.variable)
    };
    if (value.condition) {
      out.condition = stringValue(value.condition);
    }
    return out;
  }

  function optionToDraft(option) {
    const value = isObject(option) ? option : {};
    const out = {
      id: safeId(value.id || 'option'),
      label: stringValue(value.label || value.id || 'Option'),
      subtitle: stringValue(value.subtitle),
      chooseIf: stringValue(value.chooseIf),
      unavailableText: stringValue(value.unavailableText),
      effects: ensureArray(value.effects).map(effectToDraft).filter((effect) => effect.variable),
      narrativeParagraphs: paragraphs(value.body),
      variants: ensureArray(value.variants).map((variant) => ({
        condition: stringValue(variant && variant.condition),
        text: stringValue(variant && variant.text)
      })).filter((variant) => variant.condition || variant.text),
      gotoAfter: safeId(value.gotoAfter || 'continue_' + (value.id || 'option'))
    };
    return out;
  }

  function optionRow(option, index, structure) {
    const id = option.id || 'option_' + (index + 1);
    const section = sectionById(structure, option.ownerSectionId);
    return {
      id,
      optionId: id,
      targetId: option.gotoAfter || '',
      sectionId: option.ownerSectionId || '',
      sectionLabel: section && (section.title || section.id) || '',
      label: option.label || id,
      subtitle: option.subtitle || '',
      chooseIf: option.chooseIf || '',
      fields: [
        field('option.' + index + '.label', 'Option label', option.label, 'guarded'),
        field('option.' + index + '.subtitle', 'Option subtitle', option.subtitle, 'guarded'),
        field('option.' + index + '.body', 'Result text', option.body, 'guarded'),
        field('option.' + index + '.chooseIf', 'Condition', option.chooseIf, 'guarded'),
        field('option.' + index + '.unavailableText', 'Unavailable text', option.unavailableText, 'guarded'),
        field('option.' + index + '.gotoAfter', 'Go to after', option.gotoAfter, 'guarded')
      ]
    };
  }

  function branchField(section, index) {
    return field('event.section.' + index + '.body', section.title || section.id || 'Follow-up', section.text || '', 'guarded', {
      sectionId: section.id || '',
      sectionLabel: section.title || section.id || '',
      semanticRole: section.condition ? 'conditional_text' : 'section_text',
      branchKind: section.condition ? 'conditional' : 'section',
      conditions: section.condition ? [section.condition] : []
    });
  }

  function effectFields(prefix, effects) {
    const fields = [];
    ensureArray(effects).forEach((effect, index) => {
      fields.push(field(prefix + '.' + index + '.variable', 'Variable', effect.variable, 'guarded', {role: 'effect'}));
      fields.push(field(prefix + '.' + index + '.op', 'Operation', effect.op || '+=', 'guarded', {inputType: 'select', options: ['=', '+=', '-='], role: 'effect'}));
      fields.push(field(prefix + '.' + index + '.value', 'Value', effect.value, 'guarded', {role: 'effect'}));
      fields.push(field(prefix + '.' + index + '.condition', 'Condition', effect.condition, 'guarded', {role: 'effect'}));
      fields.push(field(prefix + '.' + index + '.hook', 'Hook', effect.hook, 'guarded', {inputType: 'select', options: ['', 'on-arrival', 'choice', 'post-result'], role: 'effect'}));
    });
    return fields;
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

  function structuralField(input) {
    const value = isObject(input) ? input : {};
    const source = sourceRef(value.source || {});
    return {
      id: safeId(value.id || value.action || 'structure_action'),
      role: stringValue(value.role || 'structure'),
      label: stringValue(value.label || 'Structure action'),
      original: stringValue(value.original),
      value: stringValue(value.original),
      source,
      sourcePath: source.path || '',
      editability: 'manual_review',
      owner: {sceneId: stringValue(value.sceneId), sectionId: stringValue(value.sectionId), itemId: stringValue(value.optionId), kind: 'structure'},
      sceneId: stringValue(value.sceneId),
      sectionId: stringValue(value.sectionId),
      optionId: stringValue(value.optionId),
      inputType: stringValue(value.inputType || 'text'),
      placeholder: stringValue(value.placeholder),
      transform: 'structure_action',
      structureAction: stringValue(value.action || 'structure_action'),
      structureBefore: stringValue(value.before),
      structureTargetLabel: stringValue(value.targetLabel),
      confidence: 'proposal',
      reason: stringValue(value.help || 'Structural changes are reviewed as event structure commands.')
    };
  }

  function addOption(structure, draft, command) {
    const ownerSection = sectionById(structure, command && command.sectionId);
    const options = ensureArray(structure.options).filter((option) => !option.ownerSectionId);
    if (!ownerSection && options.length >= 4) {
      return;
    }
    const id = uniqueId(structure, safeId(draft.target || draft.id || draft.label || 'new_option'));
    const option = {
      id,
      ownerSectionId: ownerSection ? ownerSection.id : '',
      label: draft.label || 'New option',
      subtitle: '',
      chooseIf: draft.chooseIf || '',
      unavailableText: draft.unavailableText || '',
      gotoAfter: uniqueId(structure, 'continue_' + id),
      body: draft.result || 'Result prose.',
      effects: [],
      variants: []
    };
    structure.options = ensureArray(structure.options).concat(option);
    if (ownerSection) {
      ownerSection.options = ensureArray(ownerSection.options).concat(option);
    }
    if (command && command.select) {
      structure.selectedId = id;
    }
  }

  function removeOption(structure, optionId) {
    const id = safeId(optionId);
    const rootOptions = ensureArray(structure.options).filter((option) => !option.ownerSectionId);
    const target = ensureArray(structure.options).find((option) => safeId(option.id) === id);
    if (target && !target.ownerSectionId && rootOptions.length <= 2) {
      return;
    }
    structure.options = ensureArray(structure.options).filter((option) => safeId(option.id) !== id);
    ensureArray(structure.sections).forEach((section) => {
      section.options = ensureArray(section.options).filter((option) => safeId(option.id) !== id);
    });
  }

  function addSection(structure, draft) {
    const id = uniqueId(structure, safeId(draft.section || draft.id || 'follow_up'));
    structure.sections = ensureArray(structure.sections).concat({
      id,
      title: humanize(id),
      text: draft.text || 'Follow-up prose.',
      condition: draft.condition || '',
      options: [],
      effects: []
    });
  }

  function removeSection(structure, sectionId) {
    const id = safeId(sectionId);
    structure.sections = ensureArray(structure.sections).filter((section) => safeId(section.id) !== id);
    structure.options = ensureArray(structure.options).filter((option) => safeId(option.ownerSectionId) !== id);
  }

  function updateOption(structure, optionId, callback) {
    const id = safeId(optionId);
    const seen = new Set();
    ensureArray(structure.options).forEach((option) => {
      const optionKey = safeId(option.id);
      if (optionKey === id && typeof callback === 'function' && !seen.has(option)) {
        seen.add(option);
        callback(option);
      }
    });
    ensureArray(structure.sections).forEach((section) => {
      ensureArray(section.options).forEach((option) => {
        const optionKey = safeId(option.id);
        if (optionKey === id && typeof callback === 'function' && !seen.has(option)) {
          seen.add(option);
          callback(option);
        }
      });
    });
  }

  function removeEffectAt(effects, index) {
    const rows = ensureArray(effects);
    const numeric = Number(index);
    if (Number.isFinite(numeric) && numeric >= 0 && numeric < rows.length) {
      rows.splice(numeric, 1);
    }
  }

  function updateField(structure, fieldId, value) {
    const id = stringValue(fieldId);
    if (id === 'event.title') {
      structure.title = stringValue(value);
    } else if (id === 'event.heading') {
      structure.heading = stringValue(value);
    } else if (id === 'event.intro') {
      structure.openingText = stringValue(value);
    } else if (id === 'event.id') {
      structure.id = safeId(value || structure.id || 'new_world_event');
    } else if (id.indexOf('event.section.') === 0) {
      updateSectionField(structure, id, value);
    } else if (id.indexOf('event.effect.') === 0) {
      updateTriggerEffectField(structure, id, value);
    } else if (id.indexOf('event.') === 0) {
      updateEventMetaField(structure, id, value);
    } else if (id.indexOf('option.') === 0) {
      updateOptionField(structure, id, value);
    }
  }

  function updateEventMetaField(structure, fieldId, value) {
    const key = fieldId.slice('event.'.length);
    structure.when = isObject(structure.when) ? structure.when : {};
    if (key === 'year' || key === 'monthStart' || key === 'monthEnd' || key === 'priority') {
      const number = Number(value);
      if (Number.isFinite(number)) {
        structure.when[key] = number;
      }
    } else if (key === 'requires') {
      structure.when.requires = stringValue(value);
    }
  }

  function updateSectionField(structure, fieldId, value) {
    const match = fieldId.match(/^event\.section\.(\d+)\.(body|title|condition)$/);
    if (!match) {
      return;
    }
    const section = ensureArray(structure.sections)[Number(match[1])];
    if (!section) {
      return;
    }
    if (match[2] === 'body') {
      section.text = stringValue(value);
    } else if (match[2] === 'title') {
      section.title = stringValue(value);
    } else if (match[2] === 'condition') {
      section.condition = stringValue(value);
    }
  }

  function updateTriggerEffectField(structure, fieldId, value) {
    const match = fieldId.match(/^event\.effect\.(\d+)\.(variable|op|value|condition|hook)$/);
    if (!match) {
      return;
    }
    const effect = ensureArray(structure.triggerEffects)[Number(match[1])];
    if (effect) {
      setEffectPart(effect, match[2], value);
    }
  }

  function updateOptionField(structure, fieldId, value) {
    const effectMatch = fieldId.match(/^option\.(\d+)\.effect\.(\d+)\.(variable|op|value|condition|hook)$/);
    if (effectMatch) {
      const option = ensureArray(structure.options)[Number(effectMatch[1])];
      if (!option) {
        return;
      }
      updateOption(structure, option.id, (targetOption) => {
        const effect = ensureArray(targetOption.effects)[Number(effectMatch[2])];
        if (effect) {
          setEffectPart(effect, effectMatch[3], value);
        }
      });
      return;
    }
    const match = fieldId.match(/^option\.(\d+)\.(label|subtitle|body|chooseIf|unavailableText|gotoAfter)$/);
    if (!match) {
      return;
    }
    const option = ensureArray(structure.options)[Number(match[1])];
    if (!option) {
      return;
    }
    const key = match[2];
    updateOption(structure, option.id, (targetOption) => {
      targetOption[key] = key === 'gotoAfter' ? safeId(value || targetOption.gotoAfter || 'continue_' + targetOption.id) : stringValue(value);
    });
  }

  function setEffectPart(effect, key, value) {
    if (key === 'variable') {
      effect.variable = safeId(value);
    } else if (key === 'op') {
      effect.op = stringValue(value || '+=');
    } else if (key === 'value') {
      effect.value = effectValue(value, effect.op);
    } else if (key === 'condition') {
      effect.condition = stringValue(value);
    } else if (key === 'hook') {
      effect.hook = stringValue(value);
    }
  }

  function parseAddOption(value) {
    const lines = stringValue(value).split(/\r?\n/);
    const first = lines.find((line) => /^\s*-\s*@[^:]+:/.test(line)) || '';
    const match = first.match(/^\s*-\s*@([^:]+):\s*(.*)$/);
    const section = lines.find((line) => /^\s*#\s*\S+/.test(line)) || '';
    const chooseLine = lines.find((line) => /^\s*choose-if\s*:/i.test(line)) || '';
    const unavailableLine = lines.find((line) => /^\s*unavailable-(?:subtitle|text)\s*:/i.test(line)) || '';
    const target = match && match[1] || (section.match(/^\s*#\s*(\S+)/) || [])[1] || '';
    const label = match && match[2] || '';
    const chooseIf = chooseLine.replace(/^\s*choose-if\s*:\s*/i, '').trim();
    const unavailableText = unavailableLine.replace(/^\s*unavailable-(?:subtitle|text)\s*:\s*/i, '').trim();
    const result = lines.filter((line) => line !== first && line !== section && line !== chooseLine && line !== unavailableLine).join('\n').trim();
    return {target, label, result, chooseIf, unavailableText};
  }

  function parseBranch(value) {
    const text = stringValue(value);
    const lines = text.split(/\r?\n/);
    const sectionLine = lines.find((line) => /^\s*#\s*\S+/.test(line)) || '';
    const section = (sectionLine.match(/^\s*#\s*(\S+)/) || [])[1] || '';
    const body = lines.filter((line) => line !== sectionLine).join('\n').trim();
    const conditional = body.match(/^\[\?\s*if\s+(.+?)\s*:\s*([\s\S]*?)\s*\?\]$/);
    return {
      section,
      condition: conditional ? conditional[1].trim() : '',
      text: conditional ? conditional[2].trim() : body
    };
  }

  function parseEffect(value) {
    const text = stringValue(value).trim().replace(/^Q\./, '');
    const match = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|\/=|=)\s*([\s\S]*)$/);
    if (!match) {
      return {variable: '', op: '+=', value: '', condition: ''};
    }
    const tail = splitEffectCondition(match[3]);
    return {
      variable: safeId(match[1]),
      op: match[2],
      value: effectValue(tail.value, match[2]),
      condition: tail.condition,
      hook: ''
    };
  }

  function splitEffectCondition(value) {
    const text = stringValue(value).trim();
    const match = text.match(/^([\s\S]*?)\s+if\s+([\s\S]+)$/i);
    return match ? {value: match[1].trim(), condition: match[2].trim()} : {value: text, condition: ''};
  }

  function removeOptionEffectCommand(key, structure) {
    const suffix = key.slice('structure_remove_option_effect_'.length);
    const match = suffix.match(/^(.+)_([0-9]+)$/);
    if (!match) {
      return null;
    }
    const optionId = match[1];
    const index = Number(match[2]);
    const option = ensureArray(structure && structure.options).find((item) => safeId(item.id) === safeId(optionId));
    return {type: 'remove_option_effect', optionId: option && option.id || optionId, effectIndex: index};
  }

  function pushFieldUpdateCommands(commands, data) {
    Object.keys(data || {}).forEach((key) => {
      if (isStructureCommandField(key)) {
        return;
      }
      if (isEventStructureField(key)) {
        commands.push({type: 'update_field', fieldId: key, value: data[key]});
      }
    });
  }

  function isStructureCommandField(key) {
    return /^structure_/.test(stringValue(key));
  }

  function isEventStructureField(key) {
    const text = stringValue(key);
    return text === 'event.title' ||
      text === 'event.heading' ||
      text === 'event.intro' ||
      text === 'event.id' ||
      /^event\.(year|monthStart|monthEnd|requires|priority)$/.test(text) ||
      /^event\.section\.\d+\.(body|title|condition)$/.test(text) ||
      /^event\.effect\.\d+\.(variable|op|value|condition|hook)$/.test(text) ||
      /^option\.\d+\.(label|subtitle|body|chooseIf|unavailableText|gotoAfter)$/.test(text) ||
      /^option\.\d+\.effect\.\d+\.(variable|op|value|condition|hook)$/.test(text);
  }

  function pushTextCommand(commands, data, key, type) {
    const text = stringValue(data && data[key]).trim();
    if (text) {
      commands.push({type, value: text});
    }
  }

  function uniqueId(structure, base) {
    const safe = safeId(base || 'item');
    const existing = new Set();
    ensureArray(structure.options).forEach((option) => {
      existing.add(safeId(option.id));
      if (option.gotoAfter) {
        existing.add(safeId(option.gotoAfter));
      }
    });
    ensureArray(structure.sections).forEach((section) => existing.add(safeId(section.id)));
    if (!existing.has(safe)) {
      return safe;
    }
    let index = 2;
    let next = safe + '_' + index;
    while (existing.has(next)) {
      index += 1;
      next = safe + '_' + index;
    }
    return next;
  }

  function compactStructure(structure) {
    return {
      schemaVersion: EVENT_STRUCTURE_VERSION,
      kind: STRUCTURE_KIND,
      provenance: stringValue(structure && structure.provenance),
      mode: stringValue(structure && structure.mode),
      id: stringValue(structure && structure.id),
      optionCount: ensureArray(structure && structure.options).length,
      sectionCount: ensureArray(structure && structure.sections).length,
      triggerEffectCount: ensureArray(structure && structure.triggerEffects).length
    };
  }

  function sectionById(structure, sectionId) {
    const raw = stringValue(sectionId).trim();
    if (!raw) {
      return null;
    }
    const id = safeId(raw);
    return ensureArray(structure && structure.sections).find((section) => safeId(section && section.id) === id) || null;
  }

  function effectLabel(effect) {
    const value = isObject(effect) ? effect : {};
    const variable = value.variable ? 'Q.' + value.variable : 'Q.variable';
    const op = value.op || '+=';
    const tail = variable + ' ' + op + ' ' + stringValue(value.value === undefined ? 1 : value.value);
    return value.condition ? tail + ' if ' + value.condition : tail;
  }

  function effectLabelForSource(effect) {
    const value = isObject(effect) ? effect : {};
    const explicit = stringValue(value.displayExpression || value.expression || value.sourceExpression).trim();
    if (explicit) {
      return explicit;
    }
    const variable = stringValue(value.variable).trim();
    if (!variable) {
      return '';
    }
    const op = stringValue(value.op || value.operator || '+=').trim() || '+=';
    const amount = stringValue(value.value === undefined || value.value === null ? 1 : value.value).trim();
    const expression = (variable.indexOf('Q.') === 0 ? variable : 'Q.' + variable) + ' ' + op + ' ' + amount;
    return value.condition ? expression + ' if ' + value.condition : expression;
  }

  function optionForSourceEffect(effect, options) {
    const sectionId = stringValue(effect && effect.sectionId).trim();
    if (!sectionId) {
      return null;
    }
    return ensureArray(options).find((option) => {
      return stringValue(option && option.targetId) === sectionId ||
        stringValue(option && option.rawTargetId) === sectionId ||
        stringValue(option && option.id) === sectionId ||
        stringValue(option && option.sectionId) === sectionId;
    }) || null;
  }

  function effectValue(value, op) {
    const text = stringValue(value).trim();
    if (op && op !== '=') {
      const num = Number(text);
      return Number.isFinite(num) ? num : 0;
    }
    if (/^-?\d+(?:\.\d+)?$/.test(text)) {
      return Number(text);
    }
    return text;
  }

  function sourceRef(ref) {
    const value = isObject(ref) ? ref : {};
    const line = numberOrNull(value.line || value.startLine);
    return {
      path: stringValue(value.path || value.sourcePath),
      line,
      startLine: line,
      endLine: numberOrNull(value.endLine || value.line || value.startLine),
      anchorText: stringValue(value.anchorText),
      endAnchorText: stringValue(value.endAnchorText)
    };
  }

  function paragraphs(value) {
    if (Array.isArray(value)) {
      return value.map((item) => stringValue(item).trim()).filter(Boolean);
    }
    return stringValue(value).split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  }

  function joinParagraphs(value) {
    if (Array.isArray(value)) {
      return value.map((item) => stringValue(item).trim()).filter(Boolean).join('\n\n');
    }
    return stringValue(value).trim();
  }

  function humanize(value) {
    return stringValue(value || 'section').replace(/_/g, ' ').replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }

  function firstNonEmpty() {
    for (let index = 0; index < arguments.length; index += 1) {
      const text = stringValue(arguments[index]).trim();
      if (text) {
        return text;
      }
    }
    return '';
  }

  function truthy(value) {
    return /^(1|true|yes|on)$/i.test(stringValue(value).trim());
  }

  function safeId(value) {
    const text = stringValue(value).trim()
      .replace(/^[@#]/, '')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return /^[A-Za-z_]/.test(text) ? text : 'draft_' + (text || 'item');
  }

  function stringValue(value) {
    return value === undefined || value === null ? '' : String(value);
  }

  function numberOrNull(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value === undefined ? null : value));
  }

  const api = {
    EVENT_STRUCTURE_VERSION,
    STRUCTURE_KIND,
    fromDraft,
    fromEditingContext,
    toEventBody,
    applyCommand,
    toDraft,
    toExistingProposalCommands,
    commandsFromValues,
    structureActionsForSource
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapEventStructureModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
