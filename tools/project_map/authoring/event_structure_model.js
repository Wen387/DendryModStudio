(function initProjectMapEventStructureModel(global) {
  'use strict';

  const EVENT_STRUCTURE_VERSION = '0.1';
  const STRUCTURE_KIND = 'event_structure';

  function ownershipMatchingApi() {
    if (global && global.ProjectMapOwnershipMatching) {
      return global.ProjectMapOwnershipMatching;
    }
    if (typeof require === 'function') {
      try {
        return require('./ownership_matching_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function effectSourceHelpersApi() {
    if (global && global.ProjectMapEventStructureEffectSourceHelpers) {
      return global.ProjectMapEventStructureEffectSourceHelpers;
    }
    if (typeof require === 'function') {
      try {
        return require('./event_structure_effect_source_helpers.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function complexEventAuthoringApi() {
    if (global && global.ProjectMapComplexEventAuthoringModel) {
      return global.ProjectMapComplexEventAuthoringModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./complex_event_authoring_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function routeScriptIntelligenceApi() {
    if (global && global.ProjectMapRouteScriptIntelligenceModel) {
      return global.ProjectMapRouteScriptIntelligenceModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./route_script_intelligence_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function fromDraft(input, projectIndex, options) {
    const draft = isObject(input) ? clone(input) : {};
    const rootOptions = ensureArray(draft.options).map((option, index) => optionFromDraft(option, index, ''));
    const eventShape = normalizeEventShape(draft.eventShape, rootOptions.length);
    const sections = ensureArray(draft.sections).map(sectionFromDraft).filter((section) => section.id);
    return {
      schemaVersion: EVENT_STRUCTURE_VERSION,
      kind: STRUCTURE_KIND,
      provenance: 'draft',
      mode: 'new_event',
      eventShape,
      id: stringValue(draft.id || 'new_world_event'),
      title: stringValue(draft.title || draft.heading || 'New World Event'),
      subtitle: stringValue(draft.subtitle),
      heading: stringValue(draft.heading || draft.title || 'New World Event'),
      openingText: joinParagraphs(draft.introParagraphs),
      when: isObject(draft.when) ? clone(draft.when) : {},
      rawViewIf: stringValue(draft.rawViewIf || draft.viewIf),
      tags: ensureArray(draft.tags),
      newPage: draft.newPage !== false,
      useSeenFlag: draft.useSeenFlag !== undefined ? Boolean(draft.useSeenFlag) : eventShape === 'choice_event',
      maxVisits: draft.maxVisits === undefined ? null : draft.maxVisits,
      source: sourceRef({path: 'source/scenes/events/' + (draft.id || 'new_world_event') + '.scene.dry'}),
      triggerEffects: ensureArray(draft.effectsOnTrigger).map(effectFromDraft).filter((effect) => effect.variable),
      rawTriggerEffects: rawEffectLines(draft.rawEffectsOnTrigger || draft.rawTriggerEffects || draft.advancedEffectsOnTrigger),
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
      eventShape: ensureArray(body && body.options).length ? 'choice_event' : 'pure_event',
      id: stringValue(context && context.sceneId || ''),
      title: stringValue(context && context.title || context && context.sceneId || ''),
      heading: stringValue(context && context.title || context && context.sceneId || ''),
      source: sourceRef(context && context.source || {}),
      options: ensureArray(body && body.options).map((option, index) => optionFromBody(option, index)),
      sections: ensureArray(body && body.branchSections).map((field, index) => sectionFromBodyField(field, index)),
      triggerEffects: ensureArray(body && body.effects).map((field, index) => effectFromField(field, index)).filter((effect) => effect.variable),
      sourceStructureGraph: body && body.sourceStructureGraph || context && context.sourceStructureGraph || null,
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
      return enrichEventBody(body, value, options);
    }
    return enrichEventBody(draftEventBody(value, options), value, options);
  }

  function enrichEventBody(body, structure, options) {
    let next = body;
    const api = complexEventAuthoringApi();
    if (api && typeof api.enrichEventBody === 'function') {
      try {
        next = api.enrichEventBody(next, {
          structure,
          eventId: structure && structure.id,
          options
        });
      } catch (_err) {
        next = body;
      }
    }
    const routeScript = routeScriptIntelligenceApi();
    if (!routeScript || typeof routeScript.enrichEventBody !== 'function') {
      return next;
    }
    try {
      return routeScript.enrichEventBody(next, {
        structure,
        eventId: structure && structure.id,
        options
      });
    } catch (_err) {
      return next;
    }
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
    draft.eventShape = normalizeEventShape(value.eventShape || draft.eventShape, ensureArray(value.options).filter((option) => !option.ownerSectionId).length);
    draft.id = safeId(value.id || draft.id || 'new_world_event');
    draft.title = stringValue(value.title || draft.title || 'New World Event');
    draft.subtitle = stringValue(value.subtitle || draft.subtitle || '');
    draft.heading = stringValue(value.heading || value.title || draft.heading || draft.title || 'New World Event');
    draft.when = isObject(value.when) ? clone(value.when) : (isObject(draft.when) ? draft.when : {});
    draft.rawViewIf = stringValue(value.rawViewIf || draft.rawViewIf || draft.viewIf || '');
    draft.tags = ensureArray(value.tags).length ? ensureArray(value.tags).slice() : ensureArray(draft.tags);
    draft.newPage = value.newPage !== false;
    draft.useSeenFlag = value.useSeenFlag !== undefined ? Boolean(value.useSeenFlag) : draft.eventShape === 'choice_event';
    if (draft.useSeenFlag && !draft.seenFlag) {
      draft.seenFlag = draft.id + '_seen';
    }
    if (value.maxVisits !== undefined) {
      draft.maxVisits = value.maxVisits;
    }
    draft.introParagraphs = paragraphs(value.openingText);
    draft.effectsOnTrigger = ensureArray(value.triggerEffects).map(effectToDraft).filter((effect) => effect.variable);
    draft.rawEffectsOnTrigger = rawEffectLines(value.rawTriggerEffects);
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
    const queuedCommands = queuedCommandsFromValues(data);
    pushFieldUpdateCommands(commands, data);
    queuedCommands.forEach((command) => commands.push(command));
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
      } else if (key.indexOf('structure_remove_option_effect_') === 0 && truthy(text)) {
        commands.push(removeOptionEffectCommand(key, current));
      } else if (key.indexOf('structure_remove_option_') === 0 && truthy(text)) {
        commands.push({type: 'remove_option', optionId: key.slice('structure_remove_option_'.length)});
      } else if (key.indexOf('structure_remove_trigger_effect_') === 0 && truthy(text)) {
        commands.push({type: 'remove_trigger_effect', effectIndex: Number(key.slice('structure_remove_trigger_effect_'.length))});
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
    const eventShape = normalizeEventShape(structure.eventShape, rootOptions.length);
    const branchSections = ensureArray(structure.sections).reduce((rows, section, index) => rows.concat(branchFields(section, index)), []);
    const actions = draftStructureActions(structure, rootOptions, allOptions);
    return {
      mode: 'new_event',
      eventShape,
      bodyEyebrow: 'Event body',
      optionsLabel: 'Options',
      metaLabel: 'Timing and advanced fields',
      title: field('event.title', 'Title', structure.title, 'guarded'),
      subtitle: field('event.subtitle', 'Subtitle', structure.subtitle || '', 'guarded'),
      heading: field('event.heading', 'Heading', structure.heading || structure.title, 'guarded'),
      sections: [field('event.intro', 'Opening text', structure.openingText, 'guarded', {
        semanticRole: 'opening_text',
        sectionId: 'opening'
      })],
      branchSections,
      options: allOptions.map((option, index) => optionRow(option, index, structure)),
      variables: eventVariableRows(structure),
      effects: effectFields('event.effect', ensureArray(structure.triggerEffects))
        .concat(rawEffectField('event.rawEffects', 'Raw trigger effects', structure.rawTriggerEffects)),
      optionEffects: allOptions.map((option, index) => ({
        id: option.id || 'option_' + (index + 1),
        optionId: option.id || 'option_' + (index + 1),
        label: option.label || option.id || ('Option ' + (index + 1)),
        fields: effectFields('option.' + index + '.effect', option.effects)
          .concat(rawEffectField('option.' + index + '.rawEffects', 'Raw option effects', option.rawEffects))
      })),
      metaFields: [
        field('event.id', 'Event id', structure.id, 'guarded'),
        field('event.eventShape', 'Event type', eventShape, 'guarded', {inputType: 'select', options: ['choice_event', 'pure_event']}),
        field('event.tags', 'Tags', ensureArray(structure.tags).join(', '), 'guarded'),
        field('event.newPage', 'New page', structure.newPage === false ? 'false' : 'true', 'guarded', {inputType: 'select', options: ['true', 'false']}),
        field('event.year', 'Year', structure.when && structure.when.year, 'guarded'),
        field('event.monthStart', 'Month start', structure.when && structure.when.monthStart, 'guarded'),
        field('event.monthEnd', 'Month end', structure.when && structure.when.monthEnd, 'guarded'),
        field('event.requires', eventShape === 'pure_event' ? 'Appearance condition' : 'Condition', structure.rawViewIf || structure.when && structure.when.requires, 'guarded'),
        field('event.priority', 'Priority', structure.when && structure.when.priority, 'guarded'),
        field('event.useSeenFlag', 'One-shot seen flag', structure.useSeenFlag ? 'true' : 'false', 'guarded', {inputType: 'select', options: ['true', 'false']}),
        field('event.rawEffects', 'Raw trigger effects', joinRawEffectLines(structure.rawTriggerEffects), 'advanced_apply', {inputType: 'textarea', role: 'effect', semanticRole: 'raw_effects'})
      ],
      structureActions: actions,
      eventGraph: eventGraph(structure),
      readinessChecklist: readinessChecklist(structure, rootOptions),
      eventStructure: compactStructure(structure)
    };
  }

  function eventGraph(structure) {
    const nodes = [{
      id: 'root',
      kind: 'opening',
      label: structure.title || structure.id || 'Event opening',
      editAction: editAction('open_object_section', 'event.intro', 'opening')
    }];
    const edges = [];
    const variables = new Set();
    ensureArray(structure.options).forEach((option, index) => {
      const optionId = option.id || 'option_' + (index + 1);
      const resultId = option.resultMode === 'native' ? (option.gotoAfter || optionId) : (option.gotoAfter || ('continue_' + optionId));
      nodes.push({
        id: 'option:' + optionId,
        kind: option.ownerSectionId ? 'section_option' : 'root_option',
        label: option.label || optionId,
        ownerSectionId: option.ownerSectionId || '',
        editAction: editAction('open_object_field', 'option.' + index + '.label', optionId)
      });
      nodes.push({
        id: 'result:' + resultId,
        kind: 'result_section',
        label: resultId,
        editAction: editAction('open_object_field', 'option.' + index + '.body', optionId)
      });
      edges.push({
        from: option.ownerSectionId ? 'section:' + option.ownerSectionId : 'root',
        to: 'option:' + optionId,
        kind: 'choice',
        editAction: editAction('open_object_field', 'option.' + index + '.label', optionId)
      });
      edges.push({
        from: 'option:' + optionId,
        to: 'result:' + resultId,
        kind: 'result_route',
        targetId: resultId || '',
        editAction: editAction('open_route_editor', 'option.' + index + '.gotoAfter', optionId)
      });
      if (option.returnTarget) {
        edges.push({
          from: 'result:' + resultId,
          to: option.returnTarget === 'root' ? 'root' : 'section:' + option.returnTarget,
          kind: 'return_route',
          targetId: option.returnTarget || 'root',
          editAction: editAction('open_route_editor', 'option.' + index + '.returnTarget', optionId)
        });
      }
      ensureArray(option.effects).forEach((effect, effectIndex) => {
        if (effect && effect.variable) {
          variables.add(effect.variable);
        }
        nodes.push({
          id: 'effect:option:' + optionId + ':' + effectIndex,
          kind: 'option_effect',
          label: effectLabel(effect),
          ownerNodeId: 'option:' + optionId,
          editAction: editAction('open_effect_editor', 'option.' + index + '.effect.' + effectIndex + '.value', optionId)
        });
      });
    });
    ensureArray(structure.sections).forEach((section, index) => {
      nodes.push({
        id: 'section:' + section.id,
        kind: section.condition ? 'conditional_section' : 'follow_up_section',
        label: section.title || section.id,
        condition: section.condition || '',
        editAction: editAction('open_object_section', 'event.section.' + index + '.body', section.id)
      });
      if (!ensureArray(section.options).length) {
        edges.push({
          from: 'section:' + section.id,
          to: section.exitTarget === 'root' ? 'root' : 'section:' + section.exitTarget,
          kind: 'exit_route',
          targetId: section.exitTarget || 'root',
          editAction: editAction('open_route_editor', 'event.section.' + index + '.exitTarget', section.id)
        });
      }
      ensureArray(section.effects).forEach((effect, effectIndex) => {
        if (effect && effect.variable) {
          variables.add(effect.variable);
        }
        nodes.push({
          id: 'effect:section:' + section.id + ':' + effectIndex,
          kind: 'section_effect',
          label: effectLabel(effect),
          ownerNodeId: 'section:' + section.id,
          editAction: editAction('open_effect_editor', 'event.section.' + index + '.effect.' + effectIndex + '.value', section.id)
        });
      });
    });
    ensureArray(structure.triggerEffects).forEach((effect, index) => {
      if (effect && effect.variable) {
        variables.add(effect.variable);
      }
      nodes.push({
        id: 'effect:trigger:' + index,
        kind: 'trigger_effect',
        label: effectLabel(effect),
        ownerNodeId: 'root',
        editAction: editAction('open_effect_editor', 'event.effect.' + index + '.value', 'opening')
      });
    });
    Array.from(variables).sort().forEach((name) => {
      nodes.push({
        id: 'variable:' + name,
        kind: 'variable',
        label: 'Q.' + name,
        editAction: {
          actionKind: 'open_variable_editor',
          routeClass: 'variable_workspace',
          targetView: 'variables',
          targetId: name,
          variableName: name,
          installSafety: 'guarded_apply',
          draftAction: true
        }
      });
    });
    return {
      kind: 'complex_event_graph',
      nodes,
      edges,
      nodeCount: nodes.length,
      edgeCount: edges.length
    };
  }

  function editAction(actionKind, fieldId, targetId) {
    return {
      actionKind,
      routeClass: actionKind === 'open_route_editor' ? 'semantic_route' : 'object_field',
      targetView: 'events',
      targetId: stringValue(targetId),
      fieldId,
      installSafety: 'guarded_apply',
      draftAction: true
    };
  }

  function readinessChecklist(structure, rootOptions) {
    const eventShape = normalizeEventShape(structure && structure.eventShape, ensureArray(rootOptions).length);
    const anchors = eventAnchors(structure);
    const routeProblems = unresolvedRoutes(structure, anchors);
    const effectProblems = invalidEffects(structure);
    const visibleTextOk = Boolean(stringValue(structure.openingText).trim()) && (
      eventShape === 'pure_event' ||
      ensureArray(rootOptions).every((option) => stringValue(option.label).trim() && stringValue(option.body).trim())
    );
    const routerRegistration = eventRouterRegistrationHint(structure);
    const routerReady = Boolean(routerRegistration);
    const rows = [
      readinessItem('event_id', Boolean(safeId(structure.id || '')), 'Event id is valid.', editAction('open_object_field', 'event.id', structure.id || 'event')),
      readinessItem('visible_text', visibleTextOk, eventShape === 'pure_event' ? 'Text event title and body are filled in.' : 'Opening text and root option result text are filled in.', editAction('open_object_section', 'event.intro', 'opening')),
      readinessItem('routes_resolve', routeProblems.length === 0, routeProblems.length ? 'Some route targets do not resolve: ' + routeProblems.join(', ') : 'All draft route targets resolve.', editAction('open_route_editor', 'option.0.gotoAfter', 'option_1')),
      readinessItem('effect_ops', effectProblems.length === 0, effectProblems.length ? 'Some effects need a supported operation: ' + effectProblems.join(', ') : 'Effects use supported operations.', editAction('open_effect_editor', 'event.effect.0.value', 'opening')),
      readinessItem('router_registration', routerReady, routerReady ? 'Profile-aware router registration can be generated.' : 'Router wiring is pending profile setup.', {
        actionKind: routerReady ? 'open_advanced_source_patch' : 'open_profile_router_rule',
        routeClass: routerReady ? 'news_router_workflow' : 'profile_router_rule',
        targetView: 'router',
        targetId: structure.id || '',
        fieldId: 'router.registration',
        installSafety: routerReady ? 'advanced_apply' : 'guarded_apply',
        draftAction: true
      })
    ];
    if (eventShape === 'choice_event') {
      rows.splice(1, 0, readinessItem('root_options', ensureArray(rootOptions).length >= 2, 'Choice event has at least 2 root options.', editAction('open_object_field', 'option.0.label', 'option_1')));
    } else {
      rows.splice(1, 0, readinessItem('event_shape', ensureArray(rootOptions).length === 0, 'Text event has no player choices.', editAction('open_object_field', 'event.eventShape', structure.id || 'event')));
    }
    return rows;
  }

  function eventVariableRows(structure) {
    const existing = variableMapForProject(structure && structure.projectIndex);
    const names = new Set();
    ensureArray(structure && structure.triggerEffects).forEach((effect) => {
      if (effect && effect.variable) {
        names.add(effect.variable);
      }
    });
    ensureArray(structure && structure.options).forEach((option) => {
      ensureArray(option && option.effects).forEach((effect) => {
        if (effect && effect.variable) {
          names.add(effect.variable);
        }
      });
    });
    ensureArray(structure && structure.sections).forEach((section) => {
      ensureArray(section && section.effects).forEach((effect) => {
        if (effect && effect.variable) {
          names.add(effect.variable);
        }
      });
    });
    return Array.from(names).sort().map((name) => {
      const variable = existing.get(name) || {};
      const known = existing.has(name);
      return {
        name,
        reads: ensureArray(variable.reads),
        writes: ensureArray(variable.writes),
        readCount: Number(variable.readCount || 0),
        writeCount: Number(variable.writeCount || 0),
        tags: ensureArray(variable.tags).map(String),
        status: known ? 'referenced' : 'new_or_missing',
        createAction: known ? null : {
          actionKind: 'open_variable_editor',
          targetView: 'variables',
          targetId: name,
          variableName: name,
          installSafety: 'guarded_apply'
        }
      };
    });
  }

  function variableMapForProject(projectIndex) {
    const existing = new Map();
    ensureArray(projectIndex && projectIndex.variables).forEach((variable) => {
      if (variable && variable.name) {
        existing.set(stringValue(variable.name), variable);
      }
    });
    return existing;
  }

  function readinessItem(id, ok, label, repairAction) {
    return {id, ok: Boolean(ok), status: ok ? 'ready' : 'blocked', label, repairAction: repairAction || null};
  }

  function eventAnchors(structure) {
    const anchors = new Set(['root']);
    ensureArray(structure.options).forEach((option) => {
      if (option.id) {
        anchors.add(safeId(option.id));
      }
      if (option.gotoAfter) {
        anchors.add(safeId(option.gotoAfter));
      }
    });
    ensureArray(structure.sections).forEach((section) => {
      if (section.id) {
        anchors.add(safeId(section.id));
      }
      ensureArray(section.options).forEach((option) => {
        if (option.gotoAfter) {
          anchors.add(safeId(option.gotoAfter));
        }
      });
    });
    return anchors;
  }

  function unresolvedRoutes(structure, anchors) {
    const missing = [];
    ensureArray(structure.options).forEach((option) => {
      if (!stringValue(option.returnTarget).trim()) {
        return;
      }
      const target = safeId(option.returnTarget || 'root');
      if (!anchors.has(target)) {
        missing.push(option.id + ' -> ' + target);
      }
    });
    ensureArray(structure.sections).forEach((section) => {
      const target = safeId(section.exitTarget || 'root');
      if (!anchors.has(target)) {
        missing.push(section.id + ' -> ' + target);
      }
      ensureArray(section.options).forEach((option) => {
        if (!stringValue(option.returnTarget).trim()) {
          return;
        }
        const optionTarget = safeId(option.returnTarget || 'root');
        if (!anchors.has(optionTarget)) {
          missing.push(option.id + ' -> ' + optionTarget);
        }
      });
    });
    return missing;
  }

  function invalidEffects(structure) {
    const rows = [];
    ensureArray(structure.triggerEffects).forEach((effect) => rows.push(effect));
    ensureArray(structure.options).forEach((option) => ensureArray(option.effects).forEach((effect) => rows.push(effect)));
    ensureArray(structure.sections).forEach((section) => ensureArray(section.effects).forEach((effect) => rows.push(effect)));
    return rows.filter((effect) => !['=', '+=', '-='].includes(stringValue(effect && effect.op))).map(effectLabel);
  }

  function eventRouterRegistrationHint(structure) {
    const api = eventDraftApi();
    if (!api || typeof api.routerInstallHint !== 'function') {
      return null;
    }
    try {
      return api.routerInstallHint(toDraft(structure), structure && structure.projectIndex || null, null);
    } catch (_err) {
      return null;
    }
  }

  function eventDraftApi() {
    if (global && global.ProjectMapEventDraft) {
      return global.ProjectMapEventDraft;
    }
    if (typeof require === 'function') {
      try {
        return require('./event_draft.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
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
        editability: 'guarded_apply',
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
          editability: 'guarded_apply',
        inputType: 'textarea',
        placeholder: '- @new_option: Player-facing option text\n# new_option\nchoose-if: variable >= 1\nunavailable-subtitle: Requirement not met.\nResult prose, routes, and effects.',
        help: 'Create a new player choice owned by this follow-up or menu section.'
      }));
    });
    actions.push(structuralField({
      id: 'structure_add_branch',
      action: 'add_branch',
      label: 'Add conditional or follow-up layer',
      editability: 'guarded_apply',
      inputType: 'textarea',
      placeholder: '# follow_up\n[? if variable >= 1 : Conditional prose or a nested choice layer. ?]',
      help: 'Create a same-event follow-up or conditional section.'
    }));
    actions.push(structuralField({
      id: 'structure_add_trigger_effect',
      role: 'effect',
      action: 'add_trigger_effect',
      label: 'Add trigger effect',
      editability: 'guarded_apply',
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
          editability: 'guarded_apply',
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
        editability: 'guarded_apply',
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
          editability: 'guarded_apply',
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
          editability: 'guarded_apply',
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
        editability: 'guarded_apply',
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
        editability: 'guarded_apply',
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
    const sections = ensureArray(value.sections);
    const opaqueJsBlocks = ensureArray(value.opaqueJsBlocks);
    const sourceGraph = isObject(value.sourceGraph) ? value.sourceGraph : null;
    const removeOptionHints = removeOptionHintsByOptionId(sourceGraph);
    const removeLayerHints = removeLayerHintsBySectionId(sourceGraph);
    const rerouteHints = incomingRouteRerouteHints(sourceGraph);
    const existingIds = structureExistingIds(sceneId, options, textBlocks);
    const rootAddOptionSource = sourceForAddOptionInSection(options, '', textBlocks);
    const branchInsertSource = sourceForAddBranch(sourceGraph, textBlocks, sceneSource);
    const triggerEffectSource = sourceForAddTriggerEffect(effects, opaqueJsBlocks, sections, '');
    const fields = [
      structuralField({
        id: 'structure_add_option',
        label: 'Add option and result layer',
        action: 'add_option',
        sceneId,
        source: rootAddOptionSource || sceneSource,
        editability: rootAddOptionSource ? 'guarded_apply' : 'manual_review',
        sourceBlock: rootAddOptionSource ? {
          kind: 'root_option_insert_anchor',
          sectionId: '',
          anchorText: rootAddOptionSource.anchorText || '',
          line: rootAddOptionSource.line || rootAddOptionSource.startLine || null
        } : null,
        existingIds,
        inputType: 'textarea',
        placeholder: '- @new_option: Player-facing option text\n# new_option\nResult prose, routes, and effects.',
        help: 'Draft a new option line plus the result section it should open.'
      }),
      structuralField({
        id: 'structure_add_branch',
        label: 'Add conditional or follow-up layer',
        action: 'add_branch',
        sceneId,
        source: branchInsertSource || sceneSource,
        editability: branchInsertSource ? 'advanced_source_patch' : 'manual_review',
        sourceBlock: branchInsertSource ? {
          kind: 'branch_insert_anchor',
          anchorText: branchInsertSource.anchorText || '',
          line: branchInsertSource.line || branchInsertSource.startLine || null
        } : null,
        existingIds,
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
        source: triggerEffectSource || sceneSource,
        editability: triggerEffectSource && triggerEffectSource.structureKind === 'opaque_js_insert_anchor'
          ? 'advanced_source_patch'
          : triggerEffectSource ? 'guarded_apply' : 'manual_review',
        sourceBlock: triggerEffectSource ? {
          kind: triggerEffectSource.structureKind || 'trigger_effect_insert_anchor',
          anchorText: triggerEffectSource.anchorText || '',
          line: triggerEffectSource.line || triggerEffectSource.startLine || null
        } : null,
        inputType: 'text',
        placeholder: 'Q.variable += 1',
        help: 'Add a new Q effect that should run when this object opens.'
      })
    ];
    rerouteHints.forEach((hint) => {
      const sourceBlock = sourceBlockForIncomingRouteReroute(hint, sceneId);
      if (!sourceBlock) {
        return;
      }
      const targetLabel = sectionLabelForId(sceneId, hint.sectionId, textBlocks);
      fields.push(structuralField({
        id: 'structure_reroute_layer_' + safeId(hint.sectionId),
        role: 'route',
        label: 'Reroute incoming go-to routes: ' + targetLabel,
        action: 'reroute_layer',
        sceneId,
        sectionId: stringValue(hint.sectionId),
        targetLabel,
        source: sourceBlock.incomingRouteSources[0] || sceneSource,
        editability: 'advanced_source_patch',
        sourceBlock,
        inputType: 'text',
        placeholder: 'new_target',
        help: 'Retarget every exact incoming go-to line that currently points at this layer.'
      }));
    });
    const sectionAdditions = new Set();
    textBlocks.forEach((block) => {
      const sectionId = stringValue(block && block.sectionId);
      if (!sectionId || sectionAdditions.has(sectionId)) {
        return;
      }
      sectionAdditions.add(sectionId);
      const sectionLabel = stringValue(block && (block.sectionLabel || block.label || sectionId));
      const sectionAddOptionSource = sourceForAddOptionInSection(options, sectionId, textBlocks);
      fields.push(structuralField({
        id: 'structure_add_option_section_' + safeId(sectionId),
        label: 'Add option to section: ' + sectionLabel,
        action: 'add_option',
        sceneId,
        sectionId,
        targetLabel: sectionLabel,
        source: sectionAddOptionSource || block && block.source || sceneSource,
        editability: sectionAddOptionSource ? 'guarded_apply' : 'manual_review',
        sourceBlock: {
          kind: sectionAddOptionSource && sectionAddOptionSource.structureKind || (sectionAddOptionSource ? 'section_option_insert_anchor' : 'section_option_manual_boundary'),
          sectionId,
          anchorText: sectionAddOptionSource && sectionAddOptionSource.anchorText || '',
          line: sectionAddOptionSource && (sectionAddOptionSource.line || sectionAddOptionSource.startLine) || null
        },
        existingIds,
        inputType: 'textarea',
        placeholder: '- @new_option: Player-facing option text\n# new_option\nchoose-if: variable >= 1\nunavailable-subtitle: Requirement not met.\nResult prose, routes, and effects.',
        help: 'Draft a new option owned by this follow-up, menu, or result section.'
      }));
    });
    options.forEach((option) => {
      const optionId = stringValue(option && option.id);
      const optionLabel = stringValue(option && (option.label || optionId || 'option'));
      const optionKey = safeId(optionId || optionLabel);
      const effectSource = effectSourceForOption(option, effects, options, opaqueJsBlocks, sections, sceneId);
      const removeOptionSource = sourceForRemoveOption(option, effects, options, sceneId);
      const removeOptionLineSource = removeOptionSource || sourceForRemoveOptionLine(option);
      const removeOptionHint = removeOptionHintFor(removeOptionHints, option);
      const removeOptionBundleBlock = sourceBlockForOptionBundleDelete(removeOptionHint);
      const removeOptionLineBlock = !removeOptionSource && !removeOptionBundleBlock && removeOptionLineSource
        ? sourceBlockForOptionLineDelete(option, removeOptionLineSource, removeOptionHint)
        : null;
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
        editability: effectSource && effectSource.structureKind === 'opaque_js_insert_anchor'
          ? 'advanced_source_patch'
          : sourceSupportsGuardedEffectInsert(effectSource || option && option.source || sceneSource) ? 'guarded_apply' : 'manual_review',
        sourceBlock: effectSource ? {
          kind: effectSource.structureKind || 'effect_insert_anchor',
          anchorText: effectSource.anchorText || '',
          line: effectSource.line || effectSource.startLine || null
        } : null,
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
        source: removeOptionSource || removeOptionBundleBlock && removeOptionBundleBlock.optionSource || removeOptionLineSource || option && option.source || sceneSource,
        editability: removeOptionSource ? 'guarded_apply' : removeOptionBundleBlock || removeOptionLineBlock ? 'advanced_source_patch' : 'manual_review',
        sourceBlock: removeOptionSource ? {
          kind: 'option_line_delete',
          sectionId: stringValue(option && option.sectionId),
          optionId,
          anchorText: removeOptionSource.anchorText || '',
          line: removeOptionSource.line || removeOptionSource.startLine || null
        } : removeOptionBundleBlock || removeOptionLineBlock,
        operationHint: removeOptionHint,
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
        const conditionSource = sourceForRemoveOptionCondition(option, condition);
        fields.push(structuralField({
          id: 'structure_remove_option_condition_' + optionKey,
          role: 'condition',
          label: 'Remove prerequisite: ' + optionLabel,
          action: 'remove_option_condition',
          sceneId,
          sectionId: stringValue(option && option.sectionId),
          optionId,
          targetLabel: optionLabel,
          source: conditionSource || option && option.source || sceneSource,
          editability: conditionSource ? conditionSource.editability || 'guarded_apply' : 'manual_review',
          sourceBlock: conditionSource ? {
            kind: 'option_condition_delete',
            directive: String(conditionSource.directive || 'choose-if'),
            conditionScope: String(conditionSource.conditionScope || ''),
            condition,
            anchorText: conditionSource.anchorText || '',
            line: conditionSource.line || conditionSource.startLine || null
          } : null,
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
        editability: sourceSupportsGuardedEffectRemoval(effect) ? 'guarded_apply' : 'manual_review',
        inputType: 'checkbox',
        original: 'false',
        before: expression,
        sourceExpression: stringValue(effect && effect.sourceExpression),
        help: 'Remove this effect only after checking which option or trigger currently writes the variable.'
      }));
    });
    const layerRemovalKeys = new Set();
    textBlocks.filter((block) => isLayerRemovalBlock(block, sceneId)).forEach((block) => {
      const sourceBlock = sourceBlockForLayerDelete(block, removeLayerHints);
      const source = sourceBlock && sourceBlock.sectionSource || block.source || sceneSource;
      const key = sourceBlock && sourceBlock.kind === 'layer_section_delete'
        ? 'section:' + stringValue(sourceBlock.sectionId)
        : 'block:' + stringValue(block.id || block.sectionId || block.label);
      if (layerRemovalKeys.has(key)) {
        return;
      }
      layerRemovalKeys.add(key);
      fields.push(structuralField({
        id: 'structure_remove_layer_' + safeId(block.id || block.sectionId || block.label),
        label: 'Remove layer: ' + stringValue(block.label || block.sectionLabel || block.sectionId || 'branch'),
        action: 'remove_layer',
        sceneId,
        sectionId: stringValue(block.sectionId),
        targetLabel: stringValue(block.label || block.sectionLabel || block.sectionId || 'branch'),
        source,
        editability: sourceBlock ? 'advanced_source_patch' : 'manual_review',
        sourceBlock,
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

  function removeOptionHintsByOptionId(sourceGraph) {
    const map = new Map();
    ensureArray(sourceGraph && sourceGraph.operationHints && sourceGraph.operationHints.removeOptions).forEach((hint) => {
      if (!isObject(hint)) {
        return;
      }
      const keys = [
        hint.optionId,
        hint.optionNodeId && stringValue(hint.optionNodeId).replace(/^option:/, '')
      ];
      keys.forEach((key) => addRemoveHintKey(map, key, hint));
    });
    return map;
  }

  function removeLayerHintsBySectionId(sourceGraph) {
    const map = new Map();
    ensureArray(sourceGraph && sourceGraph.operationHints && sourceGraph.operationHints.removeLayers).forEach((hint) => {
      if (!isObject(hint)) {
        return;
      }
      const keys = [
        hint.sectionId,
        hint.sectionNodeId && stringValue(hint.sectionNodeId).replace(/^section:/, ''),
        hint.sectionId && stringValue(hint.sectionId).split('.').pop()
      ];
      keys.forEach((key) => addRemoveHintKey(map, key, hint));
    });
    return map;
  }

  function addRemoveHintKey(map, key, hint) {
    const text = stringValue(key).trim();
    if (!text) {
      return;
    }
    map.set(text, hint);
    map.set(safeId(text), hint);
    map.set(text.replace(/^[@#]/, ''), hint);
  }

  function removeOptionHintFor(map, option) {
    if (!map || typeof map.get !== 'function') {
      return null;
    }
    const candidates = [
      option && option.id
    ];
    for (let index = 0; index < candidates.length; index += 1) {
      const text = stringValue(candidates[index]).trim();
      if (!text) {
        continue;
      }
      const hit = map.get(text) || map.get(safeId(text)) || map.get(text.replace(/^[@#]/, ''));
      if (hit) {
        return clone(hit);
      }
    }
    return null;
  }

  function removeLayerHintFor(map, sectionId) {
    if (!map || typeof map.get !== 'function') {
      return null;
    }
    const text = stringValue(sectionId).trim();
    return map.get(text) || map.get(safeId(text)) || map.get(text.split('.').pop()) || null;
  }

  function incomingRouteRerouteHints(sourceGraph) {
    return ensureArray(sourceGraph && sourceGraph.operationHints && sourceGraph.operationHints.removeLayers)
      .filter((hint) => {
        const fallout = isObject(hint && hint.fallout) ? hint.fallout : {};
        const expectedRoutes = Number(fallout.incomingRouteCount || 0) || 0;
        if (!expectedRoutes) {
          return false;
        }
        const sources = ensureArray(fallout.incomingRouteSources).map(sourceRef).filter(sourceSupportsRouteLineDelete);
        return sources.length === expectedRoutes;
      });
  }

  function sourceBlockForIncomingRouteReroute(hint, sceneId) {
    if (!isObject(hint)) {
      return null;
    }
    const fallout = isObject(hint.fallout) ? clone(hint.fallout) : {};
    const expectedRoutes = Number(fallout.incomingRouteCount || 0) || 0;
    const incomingRouteSources = ensureArray(fallout.incomingRouteSources).map(sourceRef).filter(sourceSupportsRouteLineDelete);
    if (!expectedRoutes || incomingRouteSources.length !== expectedRoutes) {
      return null;
    }
    const sectionId = stringValue(hint.sectionId);
    return {
      kind: 'incoming_route_reroute',
      sectionId,
      oldTarget: localSectionId(sceneId, sectionId),
      incomingRouteSources,
      incomingRouteNodeIds: ensureArray(fallout.incomingRouteNodeIds).map(stringValue).filter(Boolean),
      routeCount: incomingRouteSources.length,
      safetyCandidate: 'advanced_incoming_route_reroute',
      riskLevel: 'advanced',
      reason: 'Exact incoming go-to route lines can be retargeted after explicit advanced review.'
    };
  }

  function sectionLabelForId(sceneId, sectionId, textBlocks) {
    const wanted = stringValue(sectionId);
    const block = ensureArray(textBlocks).find((item) => stringValue(item && item.sectionId) === wanted);
    return stringValue(block && (block.sectionLabel || block.label)) || localSectionId(sceneId, wanted) || wanted || 'section';
  }

  function localSectionId(sceneId, sectionId) {
    const text = stringValue(sectionId).replace(/^[@#]/, '');
    const scene = stringValue(sceneId);
    return scene && text.startsWith(scene + '.') ? text.slice(scene.length + 1) : text;
  }

  function isLayerRemovalBlock(block, sceneId) {
    const role = stringValue(block && block.semanticRole);
    const sectionId = stringValue(block && block.sectionId);
    if (role === 'opening_text' || isOpeningSectionId(sceneId, sectionId)) {
      return false;
    }
    return [
      'conditional_text',
      'section_text',
      'menu_section_text',
      'option_result_text',
      'conditional_option_result_text'
    ].includes(role);
  }

  function isOpeningSectionId(sceneId, sectionId) {
    const text = stringValue(sectionId).trim();
    if (!text) {
      return true;
    }
    const scene = stringValue(sceneId).trim();
    const local = scene && text.startsWith(scene + '.') ? text.slice(scene.length + 1) : text;
    return local === 'start' || local === 'opening' || local === 'root';
  }

  function sourceBlockForLayerDelete(block, removeLayerHints) {
    const sectionId = stringValue(block && block.sectionId);
    if (sectionId) {
      const hint = removeLayerHintFor(removeLayerHints, sectionId);
      const source = sourceRef(hint && hint.source || {});
      if (hint && hint.safetyCandidate === 'advanced_layer_delete' && sourceSupportsLayerDelete(source)) {
        return {
          kind: 'layer_section_delete',
          sectionId,
          sectionSource: source,
          safetyCandidate: stringValue(hint.safetyCandidate),
          riskLevel: stringValue(hint.riskLevel || 'advanced'),
          reason: stringValue(hint.reason),
          fallout: isObject(hint.fallout) ? clone(hint.fallout) : null
        };
      }
      if (hint && layerBundleDeleteCandidate(hint) && sourceSupportsLayerDelete(source)) {
        const fallout = isObject(hint.fallout) ? clone(hint.fallout) : {};
        const incomingOptionSources = ensureArray(fallout.incomingOptionSources).map(sourceRef).filter(sourceSupportsOptionLineDelete);
        const incomingRouteSources = ensureArray(fallout.incomingRouteSources).map(sourceRef).filter(sourceSupportsRouteLineDelete);
        const childSectionSources = ensureArray(fallout.childSectionSources).map(sourceRef).filter(sourceSupportsSectionDelete);
        const expectedIncoming = Number(fallout.incomingOptionCount || 0) || 0;
        const expectedRoutes = Number(fallout.incomingRouteCount || 0) || 0;
        const expectedChildren = Number(fallout.childSectionCount || 0) || 0;
        if (incomingOptionSources.length === expectedIncoming && incomingRouteSources.length === expectedRoutes &&
            childSectionSources.length === expectedChildren) {
          return {
            kind: 'layer_bundle_delete',
            sectionId,
            sectionSource: source,
            incomingOptionSources,
            incomingRouteSources,
            childSectionSources,
            incomingOptionIds: ensureArray(fallout.incomingOptionIds).map(stringValue).filter(Boolean),
            incomingRouteNodeIds: ensureArray(fallout.incomingRouteNodeIds).map(stringValue).filter(Boolean),
            childSectionIds: ensureArray(fallout.childSectionIds).map(stringValue).filter(Boolean),
            ownedOptionIds: ensureArray(fallout.ownedOptionIds).map(stringValue).filter(Boolean),
            safetyCandidate: stringValue(hint.safetyCandidate),
            riskLevel: stringValue(hint.riskLevel || 'advanced'),
            reason: stringValue(hint.reason),
            fallout
          };
        }
      }
      return null;
    }
    const role = stringValue(block && block.semanticRole);
    const source = sourceRef(block && block.source || {});
    if (role === 'conditional_text' && sourceSupportsLayerTextDelete(source)) {
      return {
        kind: 'layer_text_delete',
        sectionId: '',
        sectionSource: source,
        safetyCandidate: 'advanced_layer_text_delete',
        riskLevel: 'advanced',
        reason: 'Exact standalone conditional text can be removed after explicit advanced review.'
      };
    }
    return null;
  }

  function layerBundleDeleteCandidate(hint) {
    const safety = stringValue(hint && hint.safetyCandidate);
    return /^(?:advanced|aggressive)(?:_multi)?_(?:referenced|nested)_layer_bundle_delete$/.test(safety) ||
      safety === 'aggressive_routed_layer_bundle_delete';
  }

  function sourceSupportsLayerDelete(sourceInput) {
    const source = sourceRef(sourceInput || {});
    const path = stringValue(source.path).replace(/\\/g, '/');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || 0);
    return Boolean(
      path.startsWith('source/scenes/') &&
      path.endsWith('.scene.dry') &&
      !isProtectedRouterPath(path) &&
      Number.isInteger(line) &&
      line > 0 &&
      Number.isInteger(endLine) &&
      endLine >= line &&
      /^[@#]\s*[A-Za-z_][A-Za-z0-9_.-]*/.test(stringValue(source.anchorText).trim()) &&
      stringValue(source.endAnchorText).trim()
    );
  }

  function sourceSupportsLayerTextDelete(sourceInput) {
    const source = sourceRef(sourceInput || {});
    const path = stringValue(source.path).replace(/\\/g, '/');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || 0);
    return Boolean(
      path.startsWith('source/scenes/') &&
      path.endsWith('.scene.dry') &&
      !isProtectedRouterPath(path) &&
      Number.isInteger(line) &&
      line > 0 &&
      Number.isInteger(endLine) &&
      endLine >= line &&
      stringValue(source.anchorText).trim() &&
      stringValue(source.endAnchorText).trim()
    );
  }

  function sourceBlockForOptionBundleDelete(hint) {
    if (!isObject(hint)) {
      return null;
    }
    const safety = stringValue(hint.safetyCandidate);
    if (safety !== 'advanced_option_bundle_delete' && safety !== 'aggressive_option_bundle_delete') {
      return null;
    }
    const optionSource = sourceRef(hint.source || {});
    const sectionSource = sourceRef(hint.targetSectionSource || {});
    if (!sourceSupportsOptionLineDelete(optionSource) || !sourceSupportsSectionDelete(sectionSource)) {
      return null;
    }
    if (optionSource.path !== sectionSource.path) {
      return null;
    }
    return {
      kind: 'option_bundle_delete',
      optionId: stringValue(hint.optionId),
      targetSectionId: stringValue(hint.targetSectionId),
      safetyCandidate: safety,
      riskLevel: stringValue(hint.riskLevel || 'advanced'),
      reason: stringValue(hint.reason),
      fallout: isObject(hint.fallout) ? clone(hint.fallout) : null,
      optionSource,
      sectionSource
    };
  }

  function sourceSupportsOptionLineDelete(sourceInput) {
    const source = sourceRef(sourceInput || {});
    return sourceSupportsGuardedStructureInsert(source);
  }

  function sourceSupportsRouteLineDelete(sourceInput) {
    const source = sourceRef(sourceInput || {});
    const path = stringValue(source.path).replace(/\\/g, '/');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    return Boolean(
      path.startsWith('source/scenes/') &&
      path.endsWith('.scene.dry') &&
      !isProtectedRouterPath(path) &&
      Number.isInteger(line) &&
      line > 0 &&
      (!Number.isInteger(endLine) || endLine <= 0 || endLine === line) &&
      Boolean(simpleGoToLineTarget(source.anchorText))
    );
  }

  function simpleGoToLineTarget(value) {
    const match = stringValue(value).trim().match(/^go-to\s*:\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*$/i);
    return match ? match[1] : '';
  }

  function sourceSupportsSectionDelete(sourceInput) {
    const source = sourceRef(sourceInput || {});
    const path = stringValue(source.path).replace(/\\/g, '/');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    return Boolean(
      path.startsWith('source/scenes/') &&
      path.endsWith('.scene.dry') &&
      !isProtectedRouterPath(path) &&
      Number.isInteger(line) &&
      line > 0 &&
      Number.isInteger(endLine) &&
      endLine >= line &&
      stringValue(source.anchorText).trim() &&
      stringValue(source.endAnchorText).trim()
    );
  }

  function effectSourceForOption(option, effects, options, opaqueJsBlocks, sections, sceneId) {
    const matches = ensureArray(effects).filter((effect) => {
      return sourceOwnerMatchesOption(effect, option);
    }).map((effect) => {
      const source = sourceRef(effect && effect.source || {});
      return source.path && source.anchorText ? Object.assign({}, source, {
        sourceOrder: Number(effect && effect.sourceOrder || 0) || 0
      }) : null;
    }).filter(Boolean);
    const fallback = sourceForOpaqueJsInsert(opaqueJsBlocks, sections, option && (option.sectionId || option.targetId || option.rawTargetId || option.id), sceneId);
    if (!matches.length) {
      return fallback || null;
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

  function sourceForAddTriggerEffect(effects, opaqueJsBlocks, sections, sectionId) {
    const matches = ensureArray(effects).filter((effect) => {
      return !stringValue(effect && effect.sectionId);
    }).map((effect) => {
      const source = sourceRef(effect && effect.source || {});
      return sourceSupportsGuardedEffectInsert(source) ? Object.assign({}, source, {
        sourceOrder: Number(effect && effect.sourceOrder || 0) || 0
      }) : null;
    }).filter(Boolean);
    const fallback = sourceForOpaqueJsInsert(opaqueJsBlocks, sections, sectionId, '');
    if (!matches.length) {
      return fallback || null;
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

  function sourceForOpaqueJsInsert(opaqueJsBlocks, sections, sectionId, sceneId) {
    const wanted = normalizeEndpointLocalId(sectionId, sceneId);
    const section = wanted ? ensureArray(sections).find((row) => normalizeEndpointLocalId(row && row.id, sceneId) === wanted) : null;
    const range = section && sourceRef(section.sourceSpan || section.source || {});
    const candidates = ensureArray(opaqueJsBlocks).map((block) => {
      const source = sourceRef(block && block.source || {});
      const line = Number(source.line || source.startLine || 0);
      if (!source.path || !source.anchorText || !Number.isInteger(line) || line <= 0) {
        return null;
      }
      if (wanted) {
        const start = Number(range && (range.startLine || range.line) || 0);
        const end = Number(range && (range.endLine || range.line) || 0);
        if (!start || !end || line < start || line > end) {
          return null;
        }
      } else if (sectionForLine(sections, line)) {
        return null;
      }
      return Object.assign({}, source, {structureKind: 'opaque_js_insert_anchor'});
    }).filter(Boolean);
    if (!candidates.length) {
      return null;
    }
    candidates.sort((a, b) => Number(a.line || 0) - Number(b.line || 0));
    return candidates[candidates.length - 1];
  }

  function sectionForLine(sections, line) {
    const numeric = Number(line);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      return null;
    }
    return ensureArray(sections).find((row) => {
      const source = sourceRef(row && (row.sourceSpan || row.source) || {});
      const start = Number(source.startLine || source.line || 0);
      const end = Number(source.endLine || source.line || start || 0);
      return start && end && numeric >= start && numeric <= end;
    }) || null;
  }

  function normalizeEndpointLocalId(value, sceneId) {
    const text = stringValue(value).trim().replace(/^[@#]/, '');
    if (!text) {
      return '';
    }
    const scene = stringValue(sceneId).trim();
    const local = scene && text.startsWith(scene + '.') ? text.slice(scene.length + 1) : text.split('.').pop();
    return safeId(local);
  }

  function sourceForAddBranch(sourceGraph, textBlocks, sceneSource) {
    const candidates = [];
    ensureArray(sourceGraph && sourceGraph.nodes).forEach((node) => {
      if (!node || (node.kind !== 'section' && node.kind !== 'text')) {
        return;
      }
      const source = insertionSourceAfter(node.source || {});
      if (sourceSupportsBranchInsert(source)) {
        candidates.push(source);
      }
    });
    ensureArray(textBlocks).forEach((block) => {
      const source = insertionSourceAfter(block && block.source || {});
      if (sourceSupportsBranchInsert(source)) {
        candidates.push(source);
      }
    });
    const scene = insertionSourceAfter(sceneSource || {});
    if (sourceSupportsBranchInsert(scene)) {
      candidates.push(scene);
    }
    const unique = [];
    const keys = new Set();
    candidates.forEach((candidate) => {
      const key = [candidate.path, candidate.line, candidate.anchorText].join('|');
      if (!keys.has(key)) {
        keys.add(key);
        unique.push(candidate);
      }
    });
    unique.sort((a, b) => {
      const lineDelta = Number(a.line || a.startLine || 0) - Number(b.line || b.startLine || 0);
      if (lineDelta) {
        return lineDelta;
      }
      return stringValue(a.anchorText).localeCompare(stringValue(b.anchorText));
    });
    return unique.length ? unique[unique.length - 1] : null;
  }

  function insertionSourceAfter(sourceInput) {
    const source = sourceRef(sourceInput || {});
    const endLine = Number(source.endLine || source.line || source.startLine || 0);
    const endAnchor = stringValue(source.endAnchorText || '').trim();
    if (endLine > 0 && endAnchor) {
      return {
        path: source.path,
        line: endLine,
        startLine: endLine,
        endLine,
        anchorText: endAnchor,
        endAnchorText: endAnchor
      };
    }
    return source;
  }

  function sourceSupportsBranchInsert(sourceInput) {
    const source = sourceRef(sourceInput || {});
    const path = stringValue(source.path).replace(/\\/g, '/');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    const anchor = stringValue(source.anchorText).trim();
    return Boolean(
      path.startsWith('source/scenes/') &&
      path.endsWith('.scene.dry') &&
      !isProtectedRouterPath(path) &&
      Number.isInteger(line) &&
      line > 0 &&
      (!Number.isInteger(endLine) || endLine <= 0 || endLine === line) &&
      anchor
    );
  }

  function sourceForAddOptionInSection(options, sectionId, textBlocks) {
    const section = stringValue(sectionId);
    const candidates = ensureArray(options).filter((option) => {
      return stringValue(option && option.sectionId) === section;
    }).map((option) => {
      const source = sourceRef(option && option.source || {});
      return sourceSupportsGuardedStructureInsert(source) ? source : null;
    }).filter(Boolean);
    if (!candidates.length) {
      return sourceForAddOptionAfterSectionText(textBlocks, section);
    }
    candidates.sort((a, b) => Number(a.line || a.startLine || 0) - Number(b.line || b.startLine || 0));
    const last = candidates[candidates.length - 1];
    if (section && hasLaterTextBlockInSection(textBlocks, section, Number(last.line || last.startLine || 0))) {
      return null;
    }
    return last;
  }

  function sourceForAddOptionAfterSectionText(textBlocks, sectionId) {
    const section = stringValue(sectionId);
    if (!section) {
      return null;
    }
    const candidates = ensureArray(textBlocks).filter((block) => {
      return stringValue(block && block.sectionId) === section;
    }).map((block) => {
      const source = sourceRef(block && block.source || {});
      const endLine = Number(source.endLine || source.line || source.startLine || 0);
      const anchor = stringValue(source.endAnchorText || source.anchorText).trim();
      if (!source.path || !Number.isInteger(endLine) || endLine <= 0 || !anchor || isProtectedRouterPath(source.path)) {
        return null;
      }
      return {
        path: source.path,
        line: endLine,
        startLine: endLine,
        endLine,
        anchorText: anchor,
        endAnchorText: anchor,
        structureKind: 'section_text_option_insert_anchor'
      };
    }).filter(Boolean);
    if (!candidates.length) {
      return null;
    }
    candidates.sort((a, b) => Number(a.line || 0) - Number(b.line || 0));
    return candidates[candidates.length - 1];
  }

  function hasLaterTextBlockInSection(textBlocks, sectionId, line) {
    if (!Number.isFinite(line) || line <= 0) {
      return true;
    }
    const section = stringValue(sectionId);
    return ensureArray(textBlocks).some((block) => {
      if (stringValue(block && block.sectionId) !== section) {
        return false;
      }
      const source = sourceRef(block && block.source || {});
      const blockLine = Number(source.line || source.startLine || source.endLine || 0);
      const blockEndLine = Number(source.endLine || source.line || source.startLine || blockLine || 0);
      return blockLine > line || blockEndLine > line;
    });
  }

  function sourceSupportsGuardedStructureInsert(sourceInput) {
    const source = sourceRef(sourceInput || {});
    const path = stringValue(source.path).replace(/\\/g, '/');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    const anchor = stringValue(source.anchorText).trim();
    return Boolean(
      path.startsWith('source/scenes/') &&
      path.endsWith('.scene.dry') &&
      !isProtectedRouterPath(path) &&
      Number.isInteger(line) &&
      line > 0 &&
      (!Number.isInteger(endLine) || endLine <= 0 || endLine === line) &&
      /^-\s+@[A-Za-z0-9_.-]+/.test(anchor)
    );
  }

  function sourceForRemoveOption(option, effects, options, sceneId) {
    if (optionHasRemovalFallout(option, effects, options, sceneId)) {
      return null;
    }
    return sourceForRemoveOptionLine(option);
  }

  function sourceForRemoveOptionLine(option) {
    const source = sourceRef(option && option.source || {});
    return sourceSupportsGuardedOptionLineDelete(source) ? source : null;
  }

  function sourceBlockForOptionLineDelete(option, sourceInput, hint) {
    const source = sourceRef(sourceInput || {});
    if (!sourceSupportsGuardedOptionLineDelete(source)) {
      return null;
    }
    return {
      kind: 'option_line_delete',
      sectionId: stringValue(option && option.sectionId),
      optionId: stringValue(option && option.id),
      anchorText: source.anchorText || '',
      line: source.line || source.startLine || null,
      safetyCandidate: 'advanced_option_line_delete',
      riskLevel: 'advanced',
      reason: hint && hint.reason
        ? stringValue(hint.reason)
        : 'Exact option line can be removed even though linked result cleanup needs separate review.',
      fallout: hint && isObject(hint.fallout) ? clone(hint.fallout) : null
    };
  }

  function sourceSupportsGuardedOptionLineDelete(sourceInput) {
    const source = sourceRef(sourceInput || {});
    const path = stringValue(source.path).replace(/\\/g, '/');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    const anchor = stringValue(source.anchorText).trim();
    return Boolean(
      path.startsWith('source/scenes/') &&
      path.endsWith('.scene.dry') &&
      !isProtectedRouterPath(path) &&
      Number.isInteger(line) &&
      line > 0 &&
      (!Number.isInteger(endLine) || endLine <= 0 || endLine === line) &&
      isSourceOptionLine(anchor)
    );
  }

  function isSourceOptionLine(anchor) {
    const text = stringValue(anchor).trim();
    return Boolean(
      /^-\s+@[A-Za-z0-9_.-]+(?:\s*:|\s*$)/.test(text) ||
      /^-\s+[^:]+:\s*@?[A-Za-z0-9_.-]+\s*$/.test(text) ||
      /^-\s+.+(?:->|=>)\s*@?[A-Za-z0-9_.-]+\s*$/.test(text)
    );
  }

  function sourceForRemoveOptionCondition(option, condition) {
    const expected = stringValue(condition).trim();
    if (!option || !expected) {
      return null;
    }
    const conditionSource = isObject(option.conditionSource) ? option.conditionSource : {};
    const sourceCondition = stringValue(conditionSource.conditionValue || '').trim();
    if (sourceCondition && sourceCondition !== expected) {
      return null;
    }
    const source = sourceRef(conditionSource);
    if (!sourceSupportsGuardedConditionDelete(source)) {
      return null;
    }
    const directive = directiveForConditionSource(source, 'choose-if');
    const scope = stringValue(conditionSource.conditionScope || (option.chooseIf ? 'option_choose_if' : '')).trim();
    const direct = stringValue(option.chooseIf).trim();
    const sectionChoose = stringValue(option.sectionChooseIf).trim();
    const sectionView = stringValue(option.sectionViewIf).trim();
    if (direct && direct === expected && directive === 'choose-if') {
      return Object.assign({}, source, {
        directive,
        conditionScope: scope || 'option_choose_if',
        editability: 'guarded_apply'
      });
    }
    if (sectionChoose && sectionChoose === expected && directive === 'choose-if') {
      return Object.assign({}, source, {
        directive,
        conditionScope: scope || 'section_choose_if',
        editability: 'advanced_source_patch'
      });
    }
    if (sectionView && sectionView === expected && directive === 'view-if') {
      return Object.assign({}, source, {
        directive,
        conditionScope: scope || 'section_view_if',
        editability: 'advanced_source_patch'
      });
    }
    return null;
  }

  function sourceSupportsGuardedConditionDelete(sourceInput) {
    const source = sourceRef(sourceInput || {});
    const path = stringValue(source.path).replace(/\\/g, '/');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    const anchor = stringValue(source.anchorText).trim();
    return Boolean(
      path.startsWith('source/scenes/') &&
      path.endsWith('.scene.dry') &&
      !isProtectedRouterPath(path) &&
      Number.isInteger(line) &&
      line > 0 &&
      (!Number.isInteger(endLine) || endLine <= 0 || endLine === line) &&
      /^(?:choose-if|view-if)\s*:/i.test(anchor)
    );
  }

  function directiveForConditionSource(sourceInput, fallback) {
    const anchor = stringValue(sourceInput && sourceInput.anchorText).trim();
    const match = anchor.match(/^([A-Za-z-]+)\s*:/);
    return match ? match[1] : fallback;
  }

  function optionHasRemovalFallout(option, effects, options, sceneId) {
    if (firstNonEmpty(option && option.chooseIf, option && option.unavailableText)) {
      return true;
    }
    const target = stringValue(option && (option.targetId || option.rawTargetId || '')).replace(/^[@#]/, '');
    const scene = stringValue(sceneId);
    if (scene && target && target.startsWith(scene + '.')) {
      return true;
    }
    return optionHasEffects(option, effects, options);
  }

  function optionHasEffects(option, effects, options) {
    return ensureArray(effects).some((effect) => {
      return sourceOwnerMatchesOption(effect, option);
    });
  }

  function structureExistingIds(sceneId, options, textBlocks) {
    const ids = [];
    ensureArray(options).forEach((option) => {
      ids.push(option && option.id, option && option.targetId, option && option.rawTargetId, option && option.sectionId);
    });
    ensureArray(textBlocks).forEach((block) => ids.push(block && block.sectionId, block && block.id));
    return uniqueStrings(ids.flatMap((id) => endpointIdVariants(sceneId, id)));
  }

  function endpointIdVariants(sceneId, value) {
    const text = stringValue(value).trim().replace(/^[@#]/, '');
    if (!text) {
      return [];
    }
    const scene = stringValue(sceneId).trim();
    const rows = [text];
    if (scene && text.startsWith(scene + '.')) {
      rows.push(text.slice(scene.length + 1));
    } else if (scene && text.indexOf('.') < 0) {
      rows.push(scene + '.' + text);
    }
    rows.push(safeId(text));
    return uniqueStrings(rows);
  }

  function sourceSupportsGuardedEffectInsert(sourceInput) {
    const effectSource = effectSourceHelpersApi();
    const source = sourceRef(sourceInput || {});
    const path = stringValue(source.path).replace(/\\/g, '/');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    const anchor = stringValue(source.anchorText).trim();
    return Boolean(
      path.startsWith('source/scenes/') &&
      path.endsWith('.scene.dry') &&
      !isProtectedRouterPath(path) &&
      Number.isInteger(line) &&
      line > 0 &&
      (!Number.isInteger(endLine) || endLine <= 0 || endLine === line) &&
      anchor &&
      effectSource &&
      (effectSource.isOnArrivalEffectLine(anchor) || effectSource.looksLikeStandaloneEffectAnchor(anchor))
    );
  }

  function sourceSupportsGuardedEffectRemoval(effect) {
    const effectSource = effectSourceHelpersApi();
    const source = sourceRef(effect && effect.source || {});
    const path = stringValue(source.path).replace(/\\/g, '/');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    const anchor = stringValue(source.anchorText).trim();
    if (!path.startsWith('source/scenes/') || !path.endsWith('.scene.dry') || isProtectedRouterPath(path) ||
      !Number.isInteger(line) || line <= 0 || (Number.isInteger(endLine) && endLine > 0 && endLine !== line) ||
      !anchor || anchor.indexOf('{!') >= 0) {
      return false;
    }
    const candidates = uniqueStrings([
      effect && effect.sourceExpression,
      effectLabelForSource(effect),
      stringValue(effect && effect.displayExpression)
    ]);
    return Boolean(effectSource && effectSource.effectRemovalFromSourceLine(anchor, candidates).ok);
  }

  function uniqueStrings(values) {
    const seen = new Set();
    const out = [];
    ensureArray(values).forEach((value) => {
      const text = stringValue(value).trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      out.push(text);
    });
    return out;
  }

  function isProtectedRouterPath(relPath) {
    const rel = stringValue(relPath).replace(/\\/g, '/');
    return rel === 'source/scenes/root.scene.dry' ||
      rel === 'source/scenes/post_event.scene.dry' ||
      rel === 'source/scenes/post_event_news.scene.dry';
  }

  function optionFromDraft(option, index, ownerSectionId) {
    const value = isObject(option) ? option : {};
    const id = safeId(value.id || 'option_' + (index + 1));
    const hasGotoAfter = Object.prototype.hasOwnProperty.call(value, 'gotoAfter') ||
      Object.prototype.hasOwnProperty.call(value, 'afterResultTarget');
    const explicitGotoAfter = hasGotoAfter ? optionalSafeId(
      Object.prototype.hasOwnProperty.call(value, 'gotoAfter')
        ? value.gotoAfter
        : Object.prototype.hasOwnProperty.call(value, 'afterResultTarget')
          ? value.afterResultTarget
          : ''
    ) : '';
    const resultMode = normalizeResultMode(value.resultMode || value.routeMode || value.continuationMode, hasGotoAfter ? explicitGotoAfter : 'continue_' + id);
    return {
      id,
      ownerSectionId: stringValue(ownerSectionId),
      label: stringValue(value.label || value.title || 'Option ' + (index + 1)),
      subtitle: stringValue(value.subtitle),
      chooseIf: stringValue(value.chooseIf),
      unavailableText: stringValue(value.unavailableText),
      resultMode,
      gotoAfter: resultMode === 'continue' ? (explicitGotoAfter || 'continue_' + id) : explicitGotoAfter,
      returnTarget: optionalSafeId(value.returnTarget || value.afterReturnTarget || (resultMode === 'continue' ? 'root' : '')),
      body: joinParagraphs(value.narrativeParagraphs || value.body || value.text),
      effects: ensureArray(value.effects).map(effectFromDraft).filter((effect) => effect.variable),
      rawEffects: rawEffectLines(value.rawEffects || value.rawOptionEffects || value.advancedEffects),
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
      exitTarget: safeId(value.exitTarget || value.returnTarget || 'root'),
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
      exitTarget: 'root',
      options: [],
      source: sourceRef(value.source || {})
    };
  }

  function effectFromDraft(effect) {
    const value = isObject(effect) ? effect : {};
    return {
      variable: safeId(value.variable || ''),
      op: normalizeEffectOp(value.op || '+='),
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
      op: normalizeEffectOp(value.op || '+='),
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
    if (value.exitTarget && value.exitTarget !== 'root') {
      out.exitTarget = safeId(value.exitTarget);
    }
    return out;
  }

  function optionToDraft(option) {
    const value = isObject(option) ? option : {};
    const resultMode = normalizeResultMode(value.resultMode, value.gotoAfter);
    const out = {
      id: safeId(value.id || 'option'),
      label: stringValue(value.label || value.id || 'Option'),
      subtitle: stringValue(value.subtitle),
      chooseIf: stringValue(value.chooseIf),
      unavailableText: stringValue(value.unavailableText),
      effects: ensureArray(value.effects).map(effectToDraft).filter((effect) => effect.variable),
      rawEffects: rawEffectLines(value.rawEffects),
      narrativeParagraphs: paragraphs(value.body),
      variants: ensureArray(value.variants).map((variant) => ({
        condition: stringValue(variant && variant.condition),
        text: stringValue(variant && variant.text)
      })).filter((variant) => variant.condition || variant.text),
      resultMode,
      gotoAfter: resultMode === 'continue' ? safeId(value.gotoAfter || 'continue_' + (value.id || 'option')) : optionalSafeId(value.gotoAfter),
      returnTarget: optionalSafeId(value.returnTarget || (resultMode === 'continue' ? 'root' : ''))
    };
    return out;
  }

  function optionRow(option, index, structure) {
    const id = option.id || 'option_' + (index + 1);
    const section = sectionById(structure, option.ownerSectionId);
    return {
      id,
      optionId: id,
      targetId: option.resultMode === 'native' ? (option.gotoAfter || option.id || '') : (option.gotoAfter || ''),
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
        field('option.' + index + '.resultMode', 'Result routing', option.resultMode || 'continue', 'guarded', {inputType: 'select', options: ['native', 'continue'], role: 'route'}),
        field('option.' + index + '.gotoAfter', 'Result section', option.gotoAfter, 'guarded', {role: 'route'}),
        field('option.' + index + '.returnTarget', 'After result route', option.returnTarget || 'root', 'guarded', {role: 'route'}),
        field('option.' + index + '.rawEffects', 'Raw option effects', joinRawEffectLines(option.rawEffects), 'advanced_apply', {inputType: 'textarea', role: 'effect', semanticRole: 'raw_effects'})
      ]
    };
  }

  function branchFields(section, index) {
    const label = section.title || section.id || 'Follow-up';
    const meta = {
      sectionId: section.id || '',
      sectionLabel: section.title || section.id || '',
      semanticRole: section.condition ? 'conditional_text' : 'section_text',
      branchKind: section.condition ? 'conditional' : 'section',
      conditions: section.condition ? [section.condition] : []
    };
    return [
      field('event.section.' + index + '.title', label + ' title', section.title || '', 'guarded', Object.assign({}, meta, {semanticRole: 'section_title'})),
      field('event.section.' + index + '.condition', label + ' condition', section.condition || '', 'guarded', Object.assign({}, meta, {role: 'condition', semanticRole: 'section_condition'})),
      field('event.section.' + index + '.body', label, section.text || '', 'guarded', meta),
      field('event.section.' + index + '.exitTarget', label + ' exit route', section.exitTarget || 'root', 'guarded', Object.assign({}, meta, {role: 'route', semanticRole: 'section_exit_route'}))
    ];
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

  function rawEffectField(id, label, lines) {
    const value = joinRawEffectLines(lines);
    if (!value) {
      return [];
    }
    return [field(id, label, value, 'advanced_apply', {
      inputType: 'textarea',
      role: 'effect',
      semanticRole: 'raw_effects',
      help: 'Advanced Dendry/JS effect lines kept verbatim in on-arrival.'
    })];
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
      editability: stringValue(value.editability || 'manual_review'),
      owner: {sceneId: stringValue(value.sceneId), sectionId: stringValue(value.sectionId), itemId: stringValue(value.optionId), kind: 'structure'},
      sceneId: stringValue(value.sceneId),
      sectionId: stringValue(value.sectionId),
      optionId: stringValue(value.optionId),
      inputType: stringValue(value.inputType || 'text'),
      placeholder: stringValue(value.placeholder),
      transform: 'structure_action',
      structureAction: stringValue(value.action || 'structure_action'),
      structureBefore: stringValue(value.before),
      structureSourceExpression: stringValue(value.sourceExpression),
      structureTargetLabel: stringValue(value.targetLabel),
      structureSourceBlock: isObject(value.sourceBlock) ? clone(value.sourceBlock) : null,
      structureOperationHint: isObject(value.operationHint) ? clone(value.operationHint) : null,
      structureExistingIds: ensureArray(value.existingIds || value.structureExistingIds).map(stringValue).filter(Boolean),
      confidence: stringValue(value.editability) === 'guarded_apply' ? 'exact' : 'proposal',
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
    const resultMode = normalizeResultMode(draft.resultMode || (draft.gotoAfter ? 'continue' : 'native'), draft.gotoAfter);
    const option = {
      id,
      ownerSectionId: ownerSection ? ownerSection.id : '',
      label: draft.label || 'New option',
      subtitle: '',
      chooseIf: draft.chooseIf || '',
      unavailableText: draft.unavailableText || '',
      resultMode,
      gotoAfter: resultMode === 'continue'
        ? uniqueId(structure, draft.gotoAfter || 'continue_' + id)
        : optionalSafeId(draft.gotoAfter),
      returnTarget: optionalSafeId(draft.returnTarget || (resultMode === 'continue' ? 'root' : '')),
      body: draft.result || 'Result prose.',
      effects: [],
      rawEffects: rawEffectLines(draft.rawEffects),
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
      exitTarget: 'root',
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
    } else if (id === 'event.subtitle') {
      structure.subtitle = stringValue(value);
    } else if (id === 'event.heading') {
      structure.heading = stringValue(value);
    } else if (id === 'event.intro') {
      structure.openingText = stringValue(value);
    } else if (id === 'event.id') {
      structure.id = safeId(value || structure.id || 'new_world_event');
    } else if (id === 'event.rawEffects') {
      structure.rawTriggerEffects = rawEffectLines(value);
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
    if (key === 'eventShape') {
      structure.eventShape = normalizeEventShape(value, ensureArray(structure.options).filter((option) => !option.ownerSectionId).length);
    } else if (key === 'tags') {
      structure.tags = stringValue(value).split(',').map((item) => item.trim()).filter(Boolean);
    } else if (key === 'newPage') {
      structure.newPage = truthy(value);
    } else if (key === 'useSeenFlag') {
      structure.useSeenFlag = truthy(value);
    } else if (key === 'year' || key === 'monthStart' || key === 'monthEnd' || key === 'priority') {
      const number = Number(value);
      if (Number.isFinite(number)) {
        structure.when[key] = number;
      }
    } else if (key === 'requires') {
      if (normalizeEventShape(structure.eventShape, ensureArray(structure.options).length) === 'pure_event') {
        structure.rawViewIf = stringValue(value);
      } else {
        structure.when.requires = stringValue(value);
      }
    }
  }

  function updateSectionField(structure, fieldId, value) {
    const match = fieldId.match(/^event\.section\.(\d+)\.(body|title|condition|exitTarget)$/);
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
    } else if (match[2] === 'exitTarget') {
      section.exitTarget = safeId(value || 'root');
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
    const match = fieldId.match(/^option\.(\d+)\.(label|subtitle|body|chooseIf|unavailableText|resultMode|gotoAfter|returnTarget|rawEffects)$/);
    if (!match) {
      return;
    }
    const option = ensureArray(structure.options)[Number(match[1])];
    if (!option) {
      return;
    }
    const key = match[2];
    updateOption(structure, option.id, (targetOption) => {
      if (key === 'rawEffects') {
        targetOption.rawEffects = rawEffectLines(value);
        return;
      }
      if (key === 'resultMode') {
        targetOption.resultMode = normalizeResultMode(value, targetOption.gotoAfter);
        if (targetOption.resultMode === 'native' && /^continue_/.test(stringValue(targetOption.gotoAfter))) {
          targetOption.gotoAfter = '';
          targetOption.returnTarget = '';
        } else if (targetOption.resultMode === 'continue' && !targetOption.gotoAfter) {
          targetOption.gotoAfter = 'continue_' + targetOption.id;
          targetOption.returnTarget = targetOption.returnTarget || 'root';
        }
        return;
      }
      targetOption[key] = key === 'gotoAfter' || key === 'returnTarget'
        ? optionalSafeId(value || (key === 'returnTarget' && targetOption.resultMode !== 'native' ? 'root' : ''))
        : stringValue(value);
    });
  }

  function setEffectPart(effect, key, value) {
    if (key === 'variable') {
      effect.variable = safeId(value);
    } else if (key === 'op') {
      effect.op = normalizeEffectOp(value || '+=');
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
    const resultModeLine = lines.find((line) => /^\s*result-mode\s*:/i.test(line)) || '';
    const gotoLine = lines.find((line) => /^\s*goto-after\s*:/i.test(line)) || '';
    const returnLine = lines.find((line) => /^\s*return-target\s*:/i.test(line)) || '';
    const rawEffectLine = lines.find((line) => /^\s*raw-effects\s*:/i.test(line)) || '';
    const target = match && match[1] || (section.match(/^\s*#\s*(\S+)/) || [])[1] || '';
    const label = match && match[2] || '';
    const chooseIf = chooseLine.replace(/^\s*choose-if\s*:\s*/i, '').trim();
    const unavailableText = unavailableLine.replace(/^\s*unavailable-(?:subtitle|text)\s*:\s*/i, '').trim();
    const resultMode = resultModeLine.replace(/^\s*result-mode\s*:\s*/i, '').trim();
    const gotoAfter = gotoLine.replace(/^\s*goto-after\s*:\s*/i, '').trim();
    const returnTarget = returnLine.replace(/^\s*return-target\s*:\s*/i, '').trim();
    const rawEffects = rawEffectLine.replace(/^\s*raw-effects\s*:\s*/i, '').trim();
    const result = lines.filter((line) => {
      return line !== first && line !== section && line !== chooseLine && line !== unavailableLine &&
        line !== resultModeLine && line !== gotoLine && line !== returnLine && line !== rawEffectLine;
    }).join('\n').trim();
    return {target, label, result, chooseIf, unavailableText, resultMode, gotoAfter, returnTarget, rawEffects};
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
    const match = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|=)\s*([\s\S]*)$/);
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
      text === 'event.subtitle' ||
      text === 'event.heading' ||
      text === 'event.intro' ||
      text === 'event.id' ||
      text === 'event.rawEffects' ||
      /^event\.(eventShape|tags|newPage|useSeenFlag|year|monthStart|monthEnd|requires|priority)$/.test(text) ||
      /^event\.section\.\d+\.(body|title|condition|exitTarget)$/.test(text) ||
      /^event\.effect\.\d+\.(variable|op|value|condition|hook)$/.test(text) ||
      /^option\.\d+\.(label|subtitle|body|chooseIf|unavailableText|resultMode|gotoAfter|returnTarget|rawEffects)$/.test(text) ||
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
      eventShape: normalizeEventShape(structure && structure.eventShape, ensureArray(structure && structure.options).filter((option) => !option.ownerSectionId).length),
      id: stringValue(structure && structure.id),
      optionCount: ensureArray(structure && structure.options).length,
      sectionCount: ensureArray(structure && structure.sections).length,
      triggerEffectCount: ensureArray(structure && structure.triggerEffects).length,
      rawTriggerEffectCount: rawEffectLines(structure && structure.rawTriggerEffects).length
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
    const api = ownershipMatchingApi();
    const sectionId = stringValue(effect && effect.sectionId).trim();
    return ensureArray(options).find((option) => {
      return api && typeof api.ownerMatchesOption === 'function'
        ? api.ownerMatchesOption(effect, option)
        : (
          stringValue(option && option.targetId) === sectionId ||
          stringValue(option && option.rawTargetId) === sectionId ||
          stringValue(option && option.id) === sectionId ||
          stringValue(option && option.sectionId) === sectionId
        );
    }) || null;
  }

  function sourceOwnerMatchesOption(owner, option) {
    if (!owner || !option) {
      return false;
    }
    if (owner === option) {
      return true;
    }
    const ownerTokens = [
      owner && owner.optionId,
      owner && owner.itemId,
      owner && owner.sectionId,
      owner && owner.targetId,
      owner && owner.rawTargetId,
      owner && owner.id
    ];
    const optionEndpointTokens = [
      option && option.id,
      option && option.targetId,
      option && option.rawTargetId
    ];
    if (optionEndpointTokens.some((value) => stringValue(value).trim())) {
      return sourceOwnerEndpointMatches(ownerTokens, optionEndpointTokens);
    }
    return sourceOwnerEndpointMatches(ownerTokens, [option && option.sectionId]);
  }

  function sourceOwnerEndpointMatches(leftValues, rightValues) {
    const left = ensureArray(leftValues).map(stringValue).map((value) => value.trim()).filter(Boolean);
    const right = ensureArray(rightValues).map(stringValue).map((value) => value.trim()).filter(Boolean);
    if (!left.length || !right.length) {
      return false;
    }
    const api = ownershipMatchingApi();
    if (api && typeof api.endpointMatches === 'function') {
      return left.some((leftValue) => right.some((rightValue) => api.endpointMatches(leftValue, rightValue)));
    }
    const leftTokens = left.flatMap(endpointMatchTokens);
    const rightTokens = right.flatMap(endpointMatchTokens);
    return leftTokens.some((token) => rightTokens.includes(token));
  }

  function endpointMatchTokens(value) {
    const text = stringValue(value).trim().replace(/^[@#]/, '');
    if (!text) {
      return [];
    }
    const parts = text.split('.');
    const local = parts[parts.length - 1] || text;
    return uniqueStrings([text, local, safeId(text), safeId(local)]);
  }

  function effectValue(value, op) {
    const text = stringValue(value).trim();
    if (op && op !== '=') {
      const num = Number(text);
      return Number.isFinite(num) ? num : text;
    }
    if (/^-?\d+(?:\.\d+)?$/.test(text)) {
      return Number(text);
    }
    return text;
  }

  function normalizeEffectOp(value) {
    const op = stringValue(value || '+=').trim();
    return op === '=' || op === '+=' || op === '-=' ? op : '+=';
  }

  function normalizeResultMode(value, gotoAfter) {
    const text = stringValue(value).trim();
    if (text === 'native' || text === 'direct' || text === 'inline' || text === 'section') {
      return 'native';
    }
    if (text === 'continue' || text === 'continuation' || text === 'result_section') {
      return 'continue';
    }
    return stringValue(gotoAfter).trim() ? 'continue' : 'native';
  }

  function normalizeEventShape(value, rootOptionCount) {
    const text = stringValue(value).trim();
    if (text === 'choice_event' || text === 'pure_event') {
      return text;
    }
    return Number(rootOptionCount || 0) > 0 ? 'choice_event' : 'pure_event';
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

  function optionalSafeId(value) {
    const text = stringValue(value).trim();
    return text ? safeId(text) : '';
  }

  function rawEffectLines(value) {
    if (Array.isArray(value)) {
      return value.reduce((rows, item) => rows.concat(rawEffectLines(item)), []);
    }
    return stringValue(value)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function joinRawEffectLines(value) {
    return rawEffectLines(value).join('\n');
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
