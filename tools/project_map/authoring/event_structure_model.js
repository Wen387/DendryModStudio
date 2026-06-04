(function initProjectMapEventStructureModel(global) {
  'use strict';

  const EVENT_STRUCTURE_VERSION = '0.1';
  const STRUCTURE_KIND = 'event_structure';
  const EVENT_PATTERN_OPTIONS = [
    {value: 'branching_consequence', label: 'Branching Consequence Event'},
    {value: 'linear_choice', label: 'Linear Choice Event'},
    {value: 'pure_text', label: 'Pure Text Event'},
    {value: 'conditional_menu_loop', label: 'Conditional Menu / Loop Event'}
  ];

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

  function eventStructureEffectApi() {
    if (global && global.ProjectMapEventStructureEffectModel) {
      return global.ProjectMapEventStructureEffectModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./event_structure_effect_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function eventEffectModel() {
    const api = eventStructureEffectApi();
    if (!api) {
      throw new Error('ProjectMapEventStructureEffectModel is required before ProjectMapEventStructureModel.');
    }
    return api;
  }

  function eventStructureCommandApi() {
    if (global && global.ProjectMapEventStructureCommandModel) {
      return global.ProjectMapEventStructureCommandModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./event_structure_command_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function eventCommandModel() {
    const api = eventStructureCommandApi();
    if (!api) {
      throw new Error('ProjectMapEventStructureCommandModel is required before ProjectMapEventStructureModel.');
    }
    return api;
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
      conditionalText: joinConditionalParagraphs(draft.conditionalParagraphs),
      when: isObject(draft.when) ? clone(draft.when) : {},
      rawViewIf: stringValue(draft.rawViewIf || draft.viewIf),
      tags: ensureArray(draft.tags),
      newPage: draft.newPage !== false,
      useSeenFlag: draft.useSeenFlag !== undefined ? Boolean(draft.useSeenFlag) : choiceLikeEventShape(eventShape),
      maxVisits: draft.maxVisits === undefined ? null : draft.maxVisits,
      frequency: draft.frequency === undefined ? null : draft.frequency,
      setJump: stringValue(draft.setJump || draft.jumpTarget),
      calls: ensureArray(draft.calls || draft.callTargets || draft.callScenes).map(stringValue).filter(Boolean),
      rawRoutes: rawEffectLines(draft.rawRoutes || draft.routeClauses || draft.advancedRoutes),
      rawOnDisplay: rawEffectLines(draft.rawOnDisplay || draft.rawDisplayHook || draft.advancedOnDisplay),
      rawOnDeparture: rawEffectLines(draft.rawOnDeparture || draft.rawDepartureHook || draft.advancedOnDeparture),
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
      eventShape: eventShapeForOptionCount(ensureArray(body && body.options).length),
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
      if (!body.eventGraph) {
        body.eventGraph = eventGraph(value);
      }
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
          options,
          // `next` is toEventBody's private clone; let the enrich layers mutate
          // it in place instead of each making another 86MB defensive copy.
          reuseBody: true
        });
      } catch (_err) {
        next = body;
      }
    }
    const routeScript = routeScriptIntelligenceApi();
    if (routeScript && typeof routeScript.enrichEventBody === 'function') {
      try {
        next = routeScript.enrichEventBody(next, {
          structure,
          eventId: structure && structure.id,
          options,
          reuseBody: true
        });
      } catch (_err) {
        // Keep the authoring body usable even when optional route intelligence is unavailable.
      }
    }
    return enrichRouteMap(next, structure);
  }

  function applyCommand(structure, command) {
    return eventCommandModel().applyCommand(structure, command);
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
    draft.useSeenFlag = value.useSeenFlag !== undefined ? Boolean(value.useSeenFlag) : choiceLikeEventShape(draft.eventShape);
    if (draft.useSeenFlag && !draft.seenFlag) {
      draft.seenFlag = draft.id + '_seen';
    }
    if (value.maxVisits !== undefined) {
      draft.maxVisits = value.maxVisits;
    }
    if (value.frequency !== undefined) {
      draft.frequency = value.frequency;
    }
    draft.setJump = stringValue(value.setJump || '');
    draft.calls = ensureArray(value.calls).map(stringValue).filter(Boolean);
    draft.rawRoutes = rawEffectLines(value.rawRoutes);
    draft.rawOnDisplay = rawEffectLines(value.rawOnDisplay);
    draft.rawOnDeparture = rawEffectLines(value.rawOnDeparture);
    draft.introParagraphs = paragraphs(value.openingText);
    draft.conditionalParagraphs = conditionalParagraphs(value.conditionalText);
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
    const unresolvedAnchorRenames = ensureArray(value.anchorRenameDiagnostics).map((item) => ({
      target: stringValue(item && (item.oldId || item.target || item.anchorId)),
      owner: 'event structure anchor rename',
      reason: stringValue(item && item.reason || item && item.code || 'ambiguous_raw_route_rename')
    })).filter((item) => item.target);
    if (unresolvedAnchorRenames.length) {
      draft.anchorResolution = Object.assign({}, isObject(draft.anchorResolution) ? draft.anchorResolution : {}, {
        version: '0.1',
        unresolvedRoutes: ensureArray(draft.anchorResolution && draft.anchorResolution.unresolvedRoutes).concat(unresolvedAnchorRenames)
      });
    }
    return draft;
  }

  function toExistingProposalCommands(structure) {
    return ensureArray(structure && structure.pendingCommands).map(clone);
  }

  function commandsFromValues(values, structure) {
    return eventCommandModel().commandsFromValues(values, structure);
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
      sections: [
        field('event.intro', 'Opening text', structure.openingText, 'guarded', {
          semanticRole: 'opening_text',
          sectionId: 'opening'
        }),
        field('event.conditionalBody', 'Conditional body', structure.conditionalText || '', 'guarded', {
          inputType: 'textarea',
          role: 'conditional_text',
          semanticRole: 'conditional_body',
          sectionId: 'opening'
        })
      ],
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
        field('event.pattern', 'Event pattern', eventPatternForStructure(structure), 'guarded', {inputType: 'select', options: EVENT_PATTERN_OPTIONS.map(clone)}),
        field('event.patternReset', 'Reset draft to selected pattern', 'false', 'guarded', {inputType: 'checkbox'}),
        field('event.id', 'Event id', structure.id, 'guarded'),
        field('event.eventShape', 'Event type', eventShape, 'guarded', {inputType: 'select', options: ['choice_event', 'linear_choice_event', 'pure_event']}),
        field('event.tags', 'Tags', ensureArray(structure.tags).join(', '), 'guarded'),
        field('event.newPage', 'New page', structure.newPage === false ? 'false' : 'true', 'guarded', {inputType: 'select', options: ['true', 'false']}),
        field('event.year', 'Year', structure.when && structure.when.year, 'guarded'),
        field('event.monthStart', 'Month start', structure.when && structure.when.monthStart, 'guarded'),
        field('event.monthEnd', 'Month end', structure.when && structure.when.monthEnd, 'guarded'),
        field('event.requires', eventShape === 'pure_event' ? 'Appearance condition' : 'Condition', structure.rawViewIf || structure.when && structure.when.requires, 'guarded'),
        field('event.priority', 'Priority', structure.when && structure.when.priority, 'guarded'),
        field('event.frequency', 'Frequency', structure.frequency === undefined || structure.frequency === null ? '' : structure.frequency, 'guarded'),
        field('event.setJump', 'Set jump', structure.setJump || '', 'guarded', {role: 'route'}),
        field('event.calls', 'Call scenes', joinRawEffectLines(structure.calls), 'advanced_apply', {inputType: 'textarea', role: 'route', semanticRole: 'call_routes'}),
        field('event.rawRoutes', 'Raw route directives', joinRawEffectLines(structure.rawRoutes), 'advanced_apply', {inputType: 'textarea', role: 'route', semanticRole: 'raw_routes'}),
        field('event.rawOnDisplay', 'Raw on-display hook', joinRawEffectLines(structure.rawOnDisplay), 'advanced_apply', {inputType: 'textarea', role: 'effect', semanticRole: 'raw_hook'}),
        field('event.rawOnDeparture', 'Raw on-departure hook', joinRawEffectLines(structure.rawOnDeparture), 'advanced_apply', {inputType: 'textarea', role: 'effect', semanticRole: 'raw_hook'}),
        field('event.useSeenFlag', 'One-shot seen flag', structure.useSeenFlag ? 'true' : 'false', 'guarded', {inputType: 'select', options: ['true', 'false']}),
        field('event.rawEffects', 'Raw trigger effects', joinRawEffectLines(structure.rawTriggerEffects), 'advanced_apply', {inputType: 'textarea', role: 'effect', semanticRole: 'raw_effects'})
      ],
      structureActions: actions,
      eventGraph: eventGraph(structure),
      readinessChecklist: readinessChecklist(structure, rootOptions),
      eventStructure: compactStructure(structure),
      authoringStatus: structure.rawDraft && structure.rawDraft.authoringStatus || '',
      parsedToDraftParity: structure.rawDraft && structure.rawDraft.parsedToDraftParity || null
    };
  }

  function enrichRouteMap(body, structure) {
    const next = isObject(body) ? body : {};
    const graph = isObject(next.eventGraph) ? clone(next.eventGraph) : eventGraph(structure || {});
    graph.nodes = ensureArray(graph.nodes).map(clone);
    graph.edges = ensureArray(graph.edges).map(clone);
    dedupeRouteGraph(graph);
    mergeRouteEvidenceIntoGraph(graph, next, structure);
    dedupeRouteGraph(graph);
    graph.reviewHintCounts = routeMapReviewHintCounts(next, structure);
    graph.reviewHints = routeMapReviewHintsFromCounts(graph.reviewHintCounts);
    graph.nodeCount = graph.nodes.length;
    graph.edgeCount = graph.edges.length;
    next.eventGraph = graph;
    return next;
  }

  function mergeRouteEvidenceIntoGraph(graph, body, structure) {
    if (!structure || structure.provenance !== 'source') {
      return graph;
    }
    const routes = ensureArray(body && body.routeEvidenceMap && body.routeEvidenceMap.items);
    if (!routes.length) {
      return graph;
    }
    const nodeIds = new Set(ensureArray(graph.nodes).map((node) => stringValue(node && node.id)));
    routes.forEach((route, index) => {
      const evidence = route && route.evidenceClass || '';
      const match = matchingGraphRoute(graph.edges, route);
      if (match) {
        decorateGraphEdgeWithRouteEvidence(match, route);
        return;
      }
      const from = routeEndpointNodeId(route && route.from || route && route.owner || 'route', nodeIds);
      const to = routeEndpointNodeId(route && (route.target || route.rawTarget) || 'unknown', nodeIds);
      ensureRouteEndpointNode(graph, nodeIds, from, route && (route.from || route.owner || 'Route source'), 'route_source', route, structure);
      ensureRouteEndpointNode(graph, nodeIds, to, route && (route.target || route.rawTarget || 'Unknown target'), evidence === 'missing_target' ? 'missing_route_target' : 'route_target', route, structure);
      graph.edges.push(routeEvidenceEdge(structure, route, index, from, to));
    });
    return graph;
  }

  function matchingGraphRoute(edges, route) {
    const targetTokens = endpointMatchTokens(route && (route.target || route.rawTarget));
    const fromTokens = endpointMatchTokens(route && route.from);
    if (!targetTokens.length) {
      return null;
    }
    return ensureArray(edges).find((edge) => {
      const edgeTargetTokens = endpointMatchTokens(edge && (edge.targetId || edge.to || ''));
      const edgeFromTokens = endpointMatchTokens(edge && edge.from || '');
      const targetMatches = edgeTargetTokens.some((token) => targetTokens.includes(token));
      const fromMatches = !fromTokens.length || !edgeFromTokens.length || edgeFromTokens.some((token) => fromTokens.includes(token));
      return targetMatches && fromMatches;
    }) || null;
  }

  function decorateGraphEdgeWithRouteEvidence(edge, route) {
    if (!edge || !route) {
      return;
    }
    edge.routeEvidenceIds = uniqueStrings(ensureArray(edge.routeEvidenceIds).concat(route.id));
    edge.sourceKind = edge.sourceKind || stringValue(route.sourceKind);
    edge.evidenceClass = strongestEvidenceClass(edge.evidenceClass, route.evidenceClass);
    edge.condition = edge.condition || stringValue(route.predicate);
    edge.routeEvidence = {
      id: stringValue(route.id),
      evidenceClass: stringValue(route.evidenceClass),
      semanticTier: stringValue(route.semanticTier),
      sourceKind: stringValue(route.sourceKind),
      sourceLocated: Boolean(route.sourceLocated),
      targetResolved: route.targetResolved !== false,
      targetResolution: clone(route.targetResolution || {}),
      dynamicBinding: clone(route.dynamicBinding || {}),
      safeEditEligible: Boolean(route.safeEditEligible)
    };
    edge.semanticTier = edge.semanticTier || stringValue(route.semanticTier);
    edge.targetResolution = edge.targetResolution || clone(route.targetResolution || {});
    edge.dynamicBinding = edge.dynamicBinding || clone(route.dynamicBinding || {});
    edge.safeEditEligible = edge.safeEditEligible || Boolean(route.safeEditEligible);
  }

  function routeEvidenceEdge(structure, route, index, from, to) {
    const value = route || {};
    const action = routeEvidenceEditAction(structure, value);
    return {
      id: 'edge:evidence:' + safeId(value.id || (value.sourceKind || 'route') + '_' + (index + 1)),
      from,
      to,
      kind: routeEvidenceEdgeKind(value),
      targetId: stringValue(value.target || value.rawTarget),
      condition: stringValue(value.predicate),
      order: index + 1,
      fieldId: 'routeEvidence.' + safeId(value.id || index + 1),
      sourceKind: stringValue(value.sourceKind || 'explicit'),
      evidenceClass: stringValue(value.evidenceClass || 'fuzzy'),
      semanticTier: stringValue(value.semanticTier || ''),
      targetResolution: clone(value.targetResolution || {}),
      dynamicBinding: clone(value.dynamicBinding || {}),
      safeEditEligible: Boolean(value.safeEditEligible),
      installSafety: action && action.installSafety || graphInstallSafety(structure, value.source),
      editable: Boolean(action && action.actionKind),
      editAction: action,
      routeEvidenceId: stringValue(value.id),
      source: sourceRef(value.source || {}),
      targetResolved: value.targetResolved !== false,
      sourceLocated: Boolean(value.sourceLocated)
    };
  }

  function routeEvidenceEditAction(structure, route) {
    const source = sourceRef(route && route.source || {});
    if (!source.path) {
      return null;
    }
    const evidence = stringValue(route && route.evidenceClass);
    const sourceKind = stringValue(route && route.sourceKind);
    const fieldId = 'routeEvidence.' + safeId(route && route.id || route && route.target || 'route');
    if (evidence === 'script_derived' || sourceKind === 'script') {
      return editAction('open_object_field', fieldId, route && (route.owner || route.from || route.target || 'script'), structure, source, {
        routeEvidenceId: stringValue(route && route.id),
        routeClass: 'source_slice_editor'
      });
    }
    return editAction('open_route_editor', fieldId, route && (route.owner || route.from || route.target || 'route'), structure, source, {
      routeEvidenceId: stringValue(route && route.id)
    });
  }

  function routeEvidenceEdgeKind(route) {
    const evidence = stringValue(route && route.evidenceClass);
    if (evidence === 'missing_target') {
      return 'missing_route';
    }
    if (evidence === 'script_derived') {
      if (route && route.dynamicBinding && route.dynamicBinding.kind === 'set_jump') {
        return 'jump_route';
      }
      if (route && route.dynamicTarget) {
        return 'dynamic_route';
      }
      return 'script_route';
    }
    if (evidence === 'fuzzy') {
      return 'fuzzy_route';
    }
    if (evidence === 'external') {
      return 'external_route';
    }
    if (evidence === 'terminal') {
      return 'terminal_route';
    }
    return 'evidence_route';
  }

  function ensureRouteEndpointNode(graph, nodeIds, nodeId, label, kind, route, structure) {
    if (!nodeId || nodeIds.has(nodeId)) {
      return;
    }
    nodeIds.add(nodeId);
    graph.nodes.push({
      id: nodeId,
      kind,
      label: stringValue(label || nodeId),
      sourceKind: stringValue(route && route.sourceKind || 'explicit'),
      evidenceClass: stringValue(route && route.evidenceClass || 'fuzzy'),
      semanticTier: stringValue(route && route.semanticTier || ''),
      targetResolution: clone(route && route.targetResolution || {}),
      dynamicBinding: clone(route && route.dynamicBinding || {}),
      safeEditEligible: Boolean(route && route.safeEditEligible),
      editAction: routeEvidenceEditAction(structure, route)
    });
  }

  function routeEndpointNodeId(value, nodeIds) {
    const text = stringValue(value).trim().replace(/^[@#]/, '');
    const local = text.split('.').pop() || text;
    if (!text) {
      return 'route_target:unknown';
    }
    if (text === 'root' || local === 'root') {
      return 'root';
    }
    const candidates = [
      'section:' + text,
      'section:' + local,
      'option:' + text,
      'option:' + local,
      'result:' + text,
      'result:' + local
    ];
    const found = candidates.find((candidate) => nodeIds.has(candidate));
    return found || 'route_target:' + safeId(local || text);
  }

  function routeMapReviewHintCounts(body, structure) {
    const counts = {};
    const add = (key, count, severity) => {
      const value = Number(count || 0);
      if (value) {
        counts[key] = {key, count: value, severity: severity || 'warning'};
      }
    };
    if (structure && structure.provenance === 'source') {
      const routes = ensureArray(body && body.routeEvidenceMap && body.routeEvidenceMap.items);
      add('fuzzy', routes.filter((route) => stringValue(route && route.evidenceClass) === 'fuzzy').length, 'warning');
      add('script_derived', routes.filter((route) => stringValue(route && route.evidenceClass) === 'script_derived').length, 'info');
      add('missing_target', routes.filter((route) => stringValue(route && route.evidenceClass) === 'missing_target').length, 'error');
      const scripts = ensureArray(body && body.scriptImpactMap && body.scriptImpactMap.blocks);
      add('manual_boundary', scripts.filter((block) => stringValue(block && block.safetyClass) === 'manual_boundary').length, 'warning');
      add('opaque_js', scripts.filter((block) => stringValue(block && block.boundaryCategory) === 'opaque_js_block').length, 'warning');
      const diagnostics = ensureArray(body && body.routeScriptIntelligence && body.routeScriptIntelligence.diagnostics)
        .concat(ensureArray(body && body.diagnostics))
        .concat(ensureArray(body && body.routeState && body.routeState.diagnostics));
      add('route_collision', diagnostics.filter((item) => /collision|multi_valid|random/i.test(stringValue(item && (item.code || item.message)))).length, 'warning');
      add('multi_valid_randomization', diagnostics.filter((item) => /multi_valid_randomization/i.test(stringValue(item && item.code))).length, 'warning');
      add('zero_valid', diagnostics.filter((item) => /zero[_ -]?valid|no valid/i.test(stringValue(item && (item.code || item.message)))).length, 'warning');
      add('unconditional_not_fallback', diagnostics.filter((item) => /unconditional_not_fallback/i.test(stringValue(item && item.code))).length, 'warning');
    }
    const roles = body && body.parsedToDraftParity && body.parsedToDraftParity.roles || {};
    add('partial_blocker', Object.keys(roles).map((key) => roles[key]).filter((row) => row && row.blocking && Number(row.missing || 0) > 0).length, 'error');
    return counts;
  }

  function routeMapReviewHintsFromCounts(counts) {
    return Object.keys(counts || {}).map((key) => {
      const value = counts[key] || {};
      return {key, count: Number(value.count || 0), severity: value.severity || 'warning'};
    }).filter((hint) => hint.count > 0);
  }

  function strongestEvidenceClass(left, right) {
    const priority = {
      draft: 0,
      exact: 1,
      parser_backed: 1,
      source_backed: 1,
      terminal: 1,
      external: 1,
      fuzzy: 2,
      script_derived: 3,
      missing_target: 4
    };
    const a = stringValue(left || '');
    const b = stringValue(right || '');
    return (priority[b] || 0) > (priority[a] || 0) ? b : a || b;
  }

  function eventGraph(structure) {
    const nodes = [{
      id: 'root',
      kind: 'opening',
      label: structure.title || structure.id || 'Event opening',
      sourceKind: graphSourceKind(structure),
      evidenceClass: graphEvidenceClass(structure, 'node'),
      editAction: editAction('open_object_section', 'event.intro', 'opening', structure, structure && structure.source)
    }];
    const edges = [];
    const variables = new Set();
    ensureArray(structure.options).forEach((option, index) => {
      const optionId = option.id || 'option_' + (index + 1);
      const resultId = option.resultMode === 'native' ? (option.gotoAfter || optionId) : (option.gotoAfter || ('continue_' + optionId));
      const ownerNodeId = option.ownerSectionId ? 'section:' + option.ownerSectionId : 'root';
      const optionSource = option.source || option.targetSource || {};
      nodes.push({
        id: 'option:' + optionId,
        kind: option.ownerSectionId ? 'section_option' : 'root_option',
        label: option.label || optionId,
        ownerSectionId: option.ownerSectionId || '',
        condition: option.chooseIf || '',
        sourceKind: graphSourceKind(structure, optionSource),
        evidenceClass: graphEvidenceClass(structure, 'choice', optionSource),
        secondaryActions: optionRouteMapActions(structure, option, index, optionId, optionSource),
        editAction: editAction('open_object_field', 'option.' + index + '.label', optionId, structure, optionSource)
      });
      nodes.push({
        id: 'result:' + resultId,
        kind: 'result_section',
        label: resultId,
        sourceKind: graphSourceKind(structure, optionSource),
        evidenceClass: graphEvidenceClass(structure, 'result', optionSource),
        editAction: editAction('open_object_field', 'option.' + index + '.body', optionId, structure, optionSource)
      });
      edges.push(routeEdge(structure, {
        id: 'edge:choice:' + (option.ownerSectionId || 'root') + ':' + optionId,
        from: ownerNodeId,
        to: 'option:' + optionId,
        kind: 'choice',
        order: index + 1,
        fieldId: 'option.' + index + '.label',
        targetId: optionId,
        condition: option.chooseIf || '',
        source: optionSource,
        editAction: editAction('open_object_field', 'option.' + index + '.label', optionId, structure, optionSource)
      }));
      edges.push(routeEdge(structure, {
        id: 'edge:result:' + optionId + ':' + resultId,
        from: 'option:' + optionId,
        to: 'result:' + resultId,
        kind: 'result_route',
        targetId: resultId || '',
        order: index + 1,
        fieldId: 'option.' + index + '.gotoAfter',
        condition: option.chooseIf || '',
        source: optionSource,
        editAction: editAction('open_route_editor', 'option.' + index + '.gotoAfter', optionId, structure, optionSource)
      }));
      if (option.returnTarget) {
        edges.push(routeEdge(structure, {
          id: 'edge:return:' + optionId + ':' + option.returnTarget,
          from: 'result:' + resultId,
          to: option.returnTarget === 'root' ? 'root' : 'section:' + option.returnTarget,
          kind: 'return_route',
          targetId: option.returnTarget || 'root',
          order: index + 1,
          fieldId: 'option.' + index + '.returnTarget',
          source: optionSource,
          editAction: editAction('open_route_editor', 'option.' + index + '.returnTarget', optionId, structure, optionSource)
        }));
      }
      ensureArray(option.effects).forEach((effect, effectIndex) => {
        if (effect && effect.variable) {
          variables.add(effect.variable);
        }
        const effectSource = effect && effect.source || optionSource;
        nodes.push({
          id: 'effect:option:' + optionId + ':' + effectIndex,
          kind: 'option_effect',
          label: effectLabel(effect),
          ownerNodeId: 'option:' + optionId,
          sourceKind: graphSourceKind(structure, effectSource),
          evidenceClass: graphEvidenceClass(structure, 'effect', effectSource),
          editAction: editAction('open_effect_editor', 'option.' + index + '.effect.' + effectIndex + '.value', optionId, structure, effectSource)
        });
      });
    });
    ensureArray(structure.sections).forEach((section, index) => {
      const sectionSource = section.source || {};
      nodes.push({
        id: 'section:' + section.id,
        kind: section.condition ? 'conditional_section' : 'follow_up_section',
        label: section.title || section.id,
        condition: section.condition || '',
        sourceKind: graphSourceKind(structure, sectionSource),
        evidenceClass: graphEvidenceClass(structure, 'section', sectionSource),
        secondaryActions: sectionRouteMapActions(structure, section, index, sectionSource),
        editAction: editAction('open_object_section', 'event.section.' + index + '.body', section.id, structure, sectionSource)
      });
      if (!ensureArray(section.options).length) {
        edges.push(routeEdge(structure, {
          id: 'edge:exit:' + section.id + ':' + (section.exitTarget || 'root'),
          from: 'section:' + section.id,
          to: section.exitTarget === 'root' ? 'root' : 'section:' + section.exitTarget,
          kind: 'exit_route',
          targetId: section.exitTarget || 'root',
          order: index + 1,
          fieldId: 'event.section.' + index + '.exitTarget',
          condition: section.condition || '',
          source: sectionSource,
          editAction: editAction('open_route_editor', 'event.section.' + index + '.exitTarget', section.id, structure, sectionSource)
        }));
      }
      ensureArray(section.effects).forEach((effect, effectIndex) => {
        if (effect && effect.variable) {
          variables.add(effect.variable);
        }
        const effectSource = effect && effect.source || sectionSource;
        nodes.push({
          id: 'effect:section:' + section.id + ':' + effectIndex,
          kind: 'section_effect',
          label: effectLabel(effect),
          ownerNodeId: 'section:' + section.id,
          sourceKind: graphSourceKind(structure, effectSource),
          evidenceClass: graphEvidenceClass(structure, 'effect', effectSource),
          editAction: editAction('open_effect_editor', 'event.section.' + index + '.effect.' + effectIndex + '.value', section.id, structure, effectSource)
        });
      });
    });
    ensureArray(structure.triggerEffects).forEach((effect, index) => {
      if (effect && effect.variable) {
        variables.add(effect.variable);
      }
      const effectSource = effect && effect.source || {};
      nodes.push({
        id: 'effect:trigger:' + index,
        kind: 'trigger_effect',
        label: effectLabel(effect),
        ownerNodeId: 'root',
        sourceKind: graphSourceKind(structure, effectSource),
        evidenceClass: graphEvidenceClass(structure, 'effect', effectSource),
        editAction: editAction('open_effect_editor', 'event.effect.' + index + '.value', 'opening', structure, effectSource)
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
    const graph = {
      kind: 'complex_event_graph',
      schemaVersion: EVENT_STRUCTURE_VERSION,
      nodes,
      edges,
      nodeCount: nodes.length,
      edgeCount: edges.length
    };
    dedupeRouteGraph(graph);
    return graph;
  }

  function dedupeRouteGraph(graph) {
    if (!isObject(graph)) {
      return graph;
    }
    graph.nodes = mergeRouteGraphRows(ensureArray(graph.nodes), mergeGraphNode);
    graph.edges = mergeRouteGraphRows(ensureArray(graph.edges), mergeGraphEdge);
    graph.nodeCount = graph.nodes.length;
    graph.edgeCount = graph.edges.length;
    return graph;
  }

  function mergeRouteGraphRows(rows, merger) {
    const byId = new Map();
    ensureArray(rows).forEach((row, index) => {
      const id = stringValue(row && row.id);
      if (!id) {
        byId.set('row:' + index, clone(row));
        return;
      }
      if (!byId.has(id)) {
        byId.set(id, clone(row));
        return;
      }
      byId.set(id, merger(byId.get(id), row));
    });
    return Array.from(byId.values());
  }

  function mergeGraphNode(base, row) {
    const next = clone(base || {});
    const value = row || {};
    next.label = next.label || value.label || '';
    next.kind = next.kind || value.kind || '';
    next.condition = next.condition || value.condition || '';
    next.ownerSectionId = next.ownerSectionId || value.ownerSectionId || '';
    next.sourceKind = next.sourceKind || value.sourceKind || '';
    next.evidenceClass = strongestEvidenceClass(next.evidenceClass, value.evidenceClass);
    next.semanticTier = next.semanticTier || value.semanticTier || '';
    next.safeEditEligible = Boolean(next.safeEditEligible || value.safeEditEligible);
    next.secondaryActions = mergeRouteMapActions(next.secondaryActions, value.secondaryActions);
    next.editAction = next.editAction || value.editAction || null;
    return next;
  }

  function mergeGraphEdge(base, row) {
    const next = clone(base || {});
    const value = row || {};
    next.from = next.from || value.from || '';
    next.to = next.to || value.to || '';
    next.kind = next.kind || value.kind || '';
    next.targetId = next.targetId || value.targetId || '';
    next.condition = next.condition || value.condition || '';
    next.order = Number(next.order || 0) || Number(value.order || 0) || 0;
    next.fieldId = next.fieldId || value.fieldId || '';
    next.sourceKind = next.sourceKind || value.sourceKind || '';
    next.evidenceClass = strongestEvidenceClass(next.evidenceClass, value.evidenceClass);
    next.semanticTier = next.semanticTier || value.semanticTier || '';
    next.targetResolution = next.targetResolution || clone(value.targetResolution || {});
    next.dynamicBinding = next.dynamicBinding || clone(value.dynamicBinding || {});
    next.safeEditEligible = Boolean(next.safeEditEligible || value.safeEditEligible);
    next.installSafety = next.installSafety || value.installSafety || '';
    next.editable = Boolean(next.editable || value.editable);
    next.editAction = next.editAction || value.editAction || null;
    next.routeEvidenceIds = uniqueStrings(ensureArray(next.routeEvidenceIds).concat(ensureArray(value.routeEvidenceIds), value.routeEvidenceId));
    return next;
  }

  function mergeRouteMapActions(left, right) {
    const rows = ensureArray(left).concat(ensureArray(right));
    const byKey = new Map();
    rows.forEach((action, index) => {
      if (!action) {
        return;
      }
      const key = stringValue(action.fieldId || action.kind || 'action_' + index);
      if (!byKey.has(key)) {
        byKey.set(key, clone(action));
      }
    });
    return Array.from(byKey.values());
  }

  function routeEdge(structure, spec) {
    const value = isObject(spec) ? spec : {};
    const action = value.editAction || editAction('open_route_editor', value.fieldId, value.targetId, structure, value.source);
    const evidenceClass = graphEvidenceClass(structure, value.kind || 'route', value.source);
    const semanticTier = graphSemanticTier(structure, evidenceClass);
    return {
      id: stringValue(value.id || ['edge', value.from, value.to, value.kind].filter(Boolean).join(':')),
      from: stringValue(value.from),
      to: stringValue(value.to),
      kind: stringValue(value.kind || 'route'),
      targetId: stringValue(value.targetId || ''),
      condition: stringValue(value.condition),
      order: Number.isFinite(Number(value.order)) ? Number(value.order) : 0,
      fieldId: stringValue(value.fieldId),
      sourceKind: graphSourceKind(structure, value.source),
      evidenceClass,
      semanticTier,
      targetResolution: {status: value.targetId ? 'resolved' : 'unknown', target: stringValue(value.targetId || ''), candidateTargets: []},
      dynamicBinding: {},
      safeEditEligible: graphSafeEditEligible(structure, semanticTier, action),
      installSafety: action && action.installSafety || graphInstallSafety(structure, value.source),
      editable: Boolean(action && action.actionKind),
      editAction: action || null
    };
  }

  function optionRouteMapActions(structure, option, index, optionId, source) {
    const actions = [
      routeMapFieldAction('condition', 'Condition', 'option.' + index + '.chooseIf', optionId, structure, source, option && option.chooseIf),
      routeMapFieldAction('unavailable_text', 'Unavailable text', 'option.' + index + '.unavailableText', optionId, structure, source, option && option.unavailableText)
    ];
    return actions.filter(Boolean);
  }

  function sectionRouteMapActions(structure, section, index, source) {
    const sectionId = section && section.id || '';
    const actions = [
      routeMapFieldAction('section_condition', 'Condition', 'event.section.' + index + '.condition', sectionId, structure, source, section && section.condition),
      routeMapFieldAction('section_exit', 'Exit route', 'event.section.' + index + '.exitTarget', sectionId, structure, source, section && (section.exitTarget || 'root'))
    ];
    return actions.filter(Boolean);
  }

  function routeMapFieldAction(kind, label, fieldId, targetId, structure, source, value) {
    const actionKind = String(kind || '').indexOf('exit') >= 0 ? 'open_route_editor' : 'open_object_field';
    const action = editAction(actionKind, fieldId, targetId, structure, source);
    return {
      kind: stringValue(kind),
      label: stringValue(label),
      fieldId: stringValue(fieldId),
      value: stringValue(value),
      sourceKind: graphSourceKind(structure, source),
      evidenceClass: graphEvidenceClass(structure, kind, source),
      installSafety: action && action.installSafety || graphInstallSafety(structure, source),
      editable: Boolean(action && action.actionKind),
      editAction: action
    };
  }

  function editAction(actionKind, fieldId, targetId, structure, source, extra) {
    const sourceRefValue = sourceRef(source || {});
    const draft = !structure || structure.provenance !== 'source';
    const installSafety = draft ? 'guarded_apply' : graphInstallSafety(structure, sourceRefValue);
    const out = {
      actionKind,
      routeClass: actionKind === 'open_route_editor' ? 'semantic_route' : 'object_field',
      targetView: 'events',
      targetId: stringValue(targetId),
      fieldId,
      source: sourceRefValue,
      installSafety
    };
    if (draft) {
      out.draftAction = true;
      return Object.assign(out, extra || {});
    }
    if ((actionKind === 'open_object_field' || actionKind === 'open_object_section') && sourceRefValue.path) {
      out.actionKind = 'open_source_slice';
      out.routeClass = 'source_slice_editor';
      return Object.assign(out, extra || {});
    }
    if (actionKind === 'open_route_editor' || actionKind === 'open_effect_editor') {
      out.semanticEditor = {
        kind: actionKind === 'open_effect_editor' ? 'effect_clause' : 'route_order',
        sceneId: stringValue(structure && structure.id),
        fieldId,
        role: actionKind === 'open_effect_editor' ? 'effect' : 'route',
        title: actionKind === 'open_effect_editor' ? 'Event effect' : 'Event route',
        source: sourceRefValue
      };
      out.forceSemanticEditor = true;
      out.routeClass = installSafety === 'advanced_apply' ? 'advanced_source_patch' : 'route_editor';
    }
    return Object.assign(out, extra || {});
  }

  function graphInstallSafety(structure, source) {
    if (!structure || structure.provenance !== 'source') {
      return 'guarded_apply';
    }
    const value = sourceRef(source || {});
    return value.path ? 'advanced_apply' : 'manual_review';
  }

  function graphSourceKind(structure, source) {
    if (!structure || structure.provenance !== 'source') {
      return 'draft';
    }
    const value = sourceRef(source || {});
    return value.path ? 'source' : 'manual';
  }

  function graphEvidenceClass(structure, kind, source) {
    if (!structure || structure.provenance !== 'source') {
      return 'draft';
    }
    const value = sourceRef(source || {});
    if (value.path && (value.line || value.startLine)) {
      return 'exact';
    }
    return String(kind || '').indexOf('route') >= 0 ? 'fuzzy' : 'source_backed';
  }

  function graphSemanticTier(structure, evidenceClass) {
    if (!structure || structure.provenance !== 'source') {
      return 'static_exact';
    }
    return ['exact', 'parser_backed', 'terminal', 'source_backed'].includes(stringValue(evidenceClass))
      ? 'static_exact'
      : 'manual_boundary';
  }

  function graphSafeEditEligible(structure, semanticTier, action) {
    if (!structure || structure.provenance !== 'source') {
      return true;
    }
    return semanticTier === 'static_exact' && action && action.installSafety !== 'manual_review';
  }

  function readinessChecklist(structure, rootOptions) {
    const eventShape = normalizeEventShape(structure && structure.eventShape, ensureArray(rootOptions).length);
    const anchors = eventAnchors(structure);
    const routeProblems = unresolvedRoutes(structure, anchors).concat(anchorRenameProblems(structure));
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
    } else if (eventShape === 'linear_choice_event') {
      rows.splice(1, 0, readinessItem('root_options', ensureArray(rootOptions).length === 1, 'Linear choice event has exactly 1 root option.', editAction('open_object_field', 'option.0.label', 'option_1')));
    } else {
      rows.splice(1, 0, readinessItem('event_shape', ensureArray(rootOptions).length === 0, 'Text event has no player choices.', editAction('open_object_field', 'event.eventShape', structure.id || 'event')));
    }
    return rows;
  }

  function anchorRenameProblems(structure) {
    return ensureArray(structure && structure.anchorRenameDiagnostics).map((item) => {
      const oldId = stringValue(item && (item.oldId || item.target || item.anchorId));
      const newId = stringValue(item && item.newId);
      return oldId && newId ? oldId + ' -> ' + newId : oldId || stringValue(item && item.reason || item && item.code);
    }).filter(Boolean);
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
      actions.push(structuralField({
        id: 'structure_link_option_section_' + safeId(option.id),
        role: 'route',
        action: 'link_option_to_new_section',
        optionId: option.id,
        label: 'Link option to new section: ' + (option.label || option.id),
        targetLabel: option.label || option.id,
        editability: 'guarded_apply',
        inputType: 'textarea',
        placeholder: '# follow_up\nFollow-up prose.',
        help: 'Create a nested follow-up section and route this option to it.'
      }));
      actions.push(structuralField({
        id: 'structure_rename_anchor_' + safeId(option.id),
        role: 'route',
        action: 'rename_anchor',
        optionId: option.id,
        label: 'Rename option anchor: ' + (option.label || option.id),
        targetLabel: option.label || option.id,
        editability: 'guarded_apply',
        inputType: 'text',
        placeholder: safeId(option.id) + '_renamed',
        help: 'Rename this option anchor and update structured route references.'
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
        id: 'structure_rename_anchor_' + safeId(section.id),
        role: 'route',
        action: 'rename_anchor',
        sectionId: section.id,
        label: 'Rename section anchor: ' + (section.title || section.id),
        targetLabel: section.title || section.id,
        editability: 'guarded_apply',
        inputType: 'text',
        placeholder: safeId(section.id) + '_renamed',
        help: 'Rename this section anchor and update structured route references.'
      }));
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
    const sceneMetadata = isObject(value.metadata || value.sceneMetadata) ? (value.metadata || value.sceneMetadata) : {};
    const topLevelSpan = sourceRef(value.topLevelSpan || {});
    const removeOptionHints = removeOptionHintsByOptionId(sourceGraph);
    const removeLayerHints = removeLayerHintsBySectionId(sourceGraph);
    const rerouteHints = incomingRouteRerouteHints(sourceGraph);
    const existingIds = structureExistingIds(sceneId, options, textBlocks);
    const rootAddOptionSource = sourceForAddOptionInSection(options, '', textBlocks);
    const branchInsertSource = sourceForAddBranch(sourceGraph, textBlocks, sceneSource);
    const triggerEffectSource = sourceForAddTriggerEffect(effects, opaqueJsBlocks, sections, '', {
      sceneMetadata,
      sceneSource,
      topLevelSpan
    });
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
          : effectSource && effectSource.structureKind === 'section_on_arrival_insert_anchor' ||
            sourceSupportsGuardedEffectInsert(effectSource || option && option.source || sceneSource) ? 'guarded_apply' : 'manual_review',
        sourceBlock: effectSource ? {
          kind: effectSource.structureKind || 'effect_insert_anchor',
          anchorText: effectSource.anchorText || '',
          line: effectSource.line || effectSource.startLine || null,
          sectionId: effectSource.sectionId || stringValue(option && (option.targetId || option.sectionId || option.rawTargetId || ''))
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
      const inferredSource = inferredStandaloneLayerDeleteSource(sectionId, source, block, hint);
      if (inferredSource) {
        return {
          kind: 'layer_section_delete',
          sectionId,
          sectionSource: inferredSource,
          safetyCandidate: 'advanced_layer_delete',
          riskLevel: 'advanced',
          reason: 'Standalone layer source header is inferred from the section id and checked against exact body text during dry-run.',
          fallout: isObject(hint.fallout) ? clone(hint.fallout) : null
        };
      }
      const inferredBundle = inferredLeafLayerBundleDeleteBlock(sectionId, source, block, hint);
      if (inferredBundle) {
        return inferredBundle;
      }
      if (hint && layerBundleDeleteCandidate(hint) && sourceSupportsLayerDelete(source)) {
        const fallout = isObject(hint.fallout) ? clone(hint.fallout) : {};
        const incomingOptionSources = ensureArray(fallout.incomingOptionSources).map(sourceRef).filter(sourceSupportsOptionLineDelete);
        const incomingRouteSources = incomingRouteDeleteSources(fallout);
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

  function inferredStandaloneLayerDeleteSource(sectionId, sectionSourceInput, block, hint) {
    if (!isObject(hint) || !standaloneLayerDeleteFallout(hint.fallout)) {
      return null;
    }
    return inferredLayerDeleteSourceFromBlock(sectionId, sectionSourceInput, block);
  }

  function inferredLeafLayerBundleDeleteBlock(sectionId, sectionSourceInput, block, hint) {
    if (!isObject(hint) || !referencedLeafLayerDeleteFallout(hint.fallout)) {
      return null;
    }
    const sectionSource = inferredLayerDeleteSourceFromBlock(sectionId, sectionSourceInput, block);
    if (!sectionSource) {
      return null;
    }
    const fallout = isObject(hint.fallout) ? clone(hint.fallout) : {};
    const incomingOptionSources = ensureArray(fallout.incomingOptionSources).map(sourceRef).filter(sourceSupportsOptionLineDelete);
    const incomingRouteSources = incomingRouteDeleteSources(fallout);
    const expectedIncoming = Number(fallout.incomingOptionCount || 0) || 0;
    const expectedRoutes = Number(fallout.incomingRouteCount || 0) || 0;
    if (incomingOptionSources.length !== expectedIncoming || incomingRouteSources.length !== expectedRoutes) {
      return null;
    }
    const safetyCandidate = inferredLeafLayerBundleSafety(fallout);
    if (!safetyCandidate) {
      return null;
    }
    return {
      kind: 'layer_bundle_delete',
      sectionId,
      sectionSource,
      incomingOptionSources,
      incomingRouteSources,
      childSectionSources: [],
      incomingOptionIds: ensureArray(fallout.incomingOptionIds).map(stringValue).filter(Boolean),
      incomingRouteNodeIds: ensureArray(fallout.incomingRouteNodeIds).map(stringValue).filter(Boolean),
      childSectionIds: [],
      ownedOptionIds: [],
      safetyCandidate,
      riskLevel: safetyCandidate.indexOf('aggressive') === 0 ? 'aggressive' : 'advanced',
      reason: 'Leaf layer source header is inferred from the section id and checked with exact incoming references plus exact body text during dry-run.',
      fallout
    };
  }

  function inferredLayerDeleteSourceFromBlock(sectionId, sectionSourceInput, block) {
    const sectionSource = sourceRef(sectionSourceInput || {});
    if (sourceSupportsLayerDelete(sectionSource)) {
      return null;
    }
    const blockSource = sourceRef(block && block.source || {});
    if (stringValue(block && block.confidence) !== 'exact' || !sourceSupportsLayerTextDelete(blockSource)) {
      return null;
    }
    const path = stringValue(sectionSource.path).replace(/\\/g, '/');
    if (!path || path !== stringValue(blockSource.path).replace(/\\/g, '/')) {
      return null;
    }
    const sectionLine = Number(sectionSource.line || sectionSource.startLine || 0);
    const sectionEndLine = Number(sectionSource.endLine || 0);
    const blockLine = Number(blockSource.line || blockSource.startLine || 0);
    const blockEndLine = Number(blockSource.endLine || blockSource.line || blockSource.startLine || 0);
    if (!Number.isInteger(sectionLine) || sectionLine <= 0 ||
        !Number.isInteger(blockLine) || blockLine <= 0 ||
        !Number.isInteger(blockEndLine) || blockEndLine < blockLine ||
        blockLine < sectionLine) {
      return null;
    }
    if (Number.isInteger(sectionEndLine) && sectionEndLine > 0 && blockEndLine > sectionEndLine) {
      return null;
    }
    const anchorText = inferredLayerSectionAnchor(sectionId);
    const endAnchorText = stringValue(blockSource.endAnchorText || blockSource.anchorText).trim();
    const endLine = Number.isInteger(sectionEndLine) && sectionEndLine >= sectionLine ? sectionEndLine : blockEndLine;
    const inferred = sourceRef({
      path,
      line: sectionLine,
      startLine: sectionLine,
      endLine,
      anchorText,
      endAnchorText
    });
    return sourceSupportsLayerDelete(inferred) ? inferred : null;
  }

  function standaloneLayerDeleteFallout(falloutInput) {
    const fallout = isObject(falloutInput) ? falloutInput : {};
    return !Number(fallout.incomingOptionCount || 0) &&
      !Number(fallout.incomingRouteCount || 0) &&
      !Number(fallout.ownedOptionCount || 0) &&
      !Number(fallout.childSectionCount || 0) &&
      !Number(fallout.effectCount || 0);
  }

  function referencedLeafLayerDeleteFallout(falloutInput) {
    const fallout = isObject(falloutInput) ? falloutInput : {};
    const incomingOptionCount = Number(fallout.incomingOptionCount || 0) || 0;
    const incomingRouteCount = Number(fallout.incomingRouteCount || 0) || 0;
    return Boolean(
      (incomingOptionCount || incomingRouteCount) &&
      !Number(fallout.ownedOptionCount || 0) &&
      !Number(fallout.childSectionCount || 0) &&
      !Number(fallout.effectCount || 0)
    );
  }

  function inferredLeafLayerBundleSafety(falloutInput) {
    const fallout = isObject(falloutInput) ? falloutInput : {};
    const incomingOptionCount = Number(fallout.incomingOptionCount || 0) || 0;
    const incomingRouteCount = Number(fallout.incomingRouteCount || 0) || 0;
    if (incomingOptionCount > 1) {
      return 'aggressive_multi_referenced_layer_bundle_delete';
    }
    if (incomingOptionCount) {
      return incomingRouteCount ? 'aggressive_referenced_layer_bundle_delete' : 'advanced_referenced_layer_bundle_delete';
    }
    return incomingRouteCount ? 'aggressive_routed_layer_bundle_delete' : '';
  }

  function inferredLayerSectionAnchor(sectionId) {
    const local = stringValue(sectionId).trim().replace(/^[@#]/, '').split('.').filter(Boolean).pop() || '';
    return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(local) ? '@' + local : '';
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

  function incomingRouteDeleteSources(falloutInput) {
    const fallout = isObject(falloutInput) ? falloutInput : {};
    const rows = ensureArray(fallout.incomingRouteRefs).length
      ? ensureArray(fallout.incomingRouteRefs)
      : ensureArray(fallout.incomingRouteSources);
    return rows.map(routeSourceRef).filter(sourceSupportsRouteDelete);
  }

  function routeSourceRef(sourceInput) {
    const raw = isObject(sourceInput) ? sourceInput : {};
    return Object.assign(sourceRef(raw), {
      routeNodeId: stringValue(raw.routeNodeId),
      target: stringValue(raw.target || raw.localId),
      condition: stringValue(raw.condition)
    });
  }

  function sourceSupportsRouteDelete(sourceInput) {
    const source = routeSourceRef(sourceInput || {});
    return sourceSupportsRouteLineDelete(source) || Boolean(routeClauseReplacement(source.anchorText, source.target, source.condition).ok);
  }

  function routeClauseReplacement(anchorText, target, condition) {
    const line = stringValue(anchorText).trim();
    const match = line.match(/^(go-to\s*:\s*)([\s\S]+)$/i);
    const wanted = stringValue(target).trim().replace(/^[@#]/, '');
    if (!match || !wanted) {
      return {ok: false, line: ''};
    }
    const expectedCondition = normalizeCondition(condition);
    const clauses = match[2].split(';').map((clause) => clause.trim()).filter(Boolean);
    let removed = 0;
    const remaining = clauses.filter((clause) => {
      const parsed = parseGoToClause(clause);
      const matched = parsed.target === wanted && (!expectedCondition || normalizeCondition(parsed.condition) === expectedCondition);
      if (matched) {
        removed += 1;
        return false;
      }
      return true;
    });
    if (removed !== 1 || remaining.length === clauses.length) {
      return {ok: false, line: ''};
    }
    return {ok: true, line: remaining.length ? match[1] + remaining.join('; ') : ''};
  }

  function parseGoToClause(value) {
    const match = stringValue(value).trim().match(/^([A-Za-z_][A-Za-z0-9_.-]*)(?:\s+if\s+([\s\S]+))?$/i);
    return {
      target: match ? match[1] : '',
      condition: match ? stringValue(match[2]).trim() : ''
    };
  }

  function normalizeCondition(value) {
    return stringValue(value).replace(/\s+/g, ' ').trim();
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
    const targetSectionId = option && (option.sectionId || option.targetId || option.rawTargetId || option.id);
    const sectionFallback = sourceForSectionOnArrivalInsert(sections, targetSectionId, sceneId);
    const fallback = sourceForOpaqueJsInsert(opaqueJsBlocks, sections, targetSectionId, sceneId);
    if (!matches.length) {
      return sectionFallback || fallback || null;
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

  function sourceForAddTriggerEffect(effects, opaqueJsBlocks, sections, sectionId, options) {
    const opts = isObject(options) ? options : {};
    const matches = ensureArray(effects).filter((effect) => {
      return !stringValue(effect && effect.sectionId);
    }).map((effect) => {
      const source = sourceRef(effect && effect.source || {});
      return sourceSupportsGuardedEffectInsert(source) ? Object.assign({}, source, {
        sourceOrder: Number(effect && effect.sourceOrder || 0) || 0
      }) : null;
    }).filter(Boolean);
    const fallback = sourceForOpaqueJsInsert(opaqueJsBlocks, sections, sectionId, '');
    const rootInsert = !sectionId ? sourceForRootOnArrivalInsert(opts.sceneMetadata, opts.topLevelSpan, opts.sceneSource) : null;
    if (!matches.length) {
      return fallback || rootInsert || null;
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

  function sourceForRootOnArrivalInsert(metadataInput, topLevelSpanInput, sceneSourceInput) {
    const metadata = isObject(metadataInput) ? metadataInput : {};
    const preferredKeys = ['maxVisits', 'viewIf', 'tags', 'newPage', 'subtitle', 'title'];
    const candidates = preferredKeys.map((key) => {
      const ref = metadataSourceRef(metadata[key], key);
      return rootMetadataInsertCandidate(ref);
    }).filter(Boolean);
    const topLevel = rootMetadataInsertCandidate(insertionSourceBeforeTopLevelBody(topLevelSpanInput, sceneSourceInput));
    if (topLevel) {
      candidates.push(topLevel);
    }
    candidates.sort((left, right) => Number(left.line || 0) - Number(right.line || 0));
    const source = candidates[candidates.length - 1] || null;
    return source ? Object.assign({}, source, {structureKind: 'root_on_arrival_insert_anchor'}) : null;
  }

  function metadataSourceRef(value, key) {
    const raw = isObject(value) ? value : {};
    const source = sourceRef(raw);
    if (!source.path || !Number(source.line || source.startLine || 0)) {
      return source;
    }
    const line = Number(source.line || source.startLine || 0);
    const anchor = source.anchorText || sourceLineFromExcerpt(raw.excerpt, line);
    return sourceRef(Object.assign({}, source, {
      line,
      startLine: line,
      endLine: line,
      anchorText: anchor,
      endAnchorText: source.endAnchorText || anchor
    }));
  }

  function rootMetadataInsertCandidate(sourceInput) {
    const source = sourceRef(sourceInput || {});
    const path = stringValue(source.path).replace(/\\/g, '/');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    const anchor = stringValue(source.anchorText).trim();
    if (!path.startsWith('source/scenes/') || !path.endsWith('.scene.dry') || isProtectedRouterPath(path) ||
      !Number.isInteger(line) || line <= 0 || (Number.isInteger(endLine) && endLine > 0 && endLine !== line) ||
      !rootMetadataDirectiveLine(anchor)) {
      return null;
    }
    return sourceRef(Object.assign({}, source, {
      line,
      startLine: line,
      endLine: line,
      endAnchorText: source.endAnchorText || anchor
    }));
  }

  function insertionSourceBeforeTopLevelBody(topLevelSpanInput, sceneSourceInput) {
    const top = sourceRef(topLevelSpanInput || {});
    const source = top.path ? top : sourceRef(sceneSourceInput || {});
    const line = Number(source.line || source.startLine || 0);
    const anchor = stringValue(source.anchorText).trim();
    if (line > 0 && rootMetadataDirectiveLine(anchor)) {
      return sourceRef(Object.assign({}, source, {
        endLine: line,
        endAnchorText: source.endAnchorText || anchor
      }));
    }
    return sourceRef({});
  }

  function sourceLineFromExcerpt(excerpt, lineNumber) {
    const line = Number(lineNumber || 0);
    if (!Number.isInteger(line) || line <= 0) {
      return '';
    }
    const prefix = new RegExp('^\\s*' + line + '\\s*:\\s?([\\s\\S]*)$');
    const hit = stringValue(excerpt).split(/\r?\n/).map((row) => {
      const match = row.match(prefix);
      return match ? match[1] : '';
    }).find(Boolean);
    return stringValue(hit).trim();
  }

  function rootMetadataDirectiveLine(value) {
    return /^(?:title|subtitle|new-page|tags|view-if|max-visits|is-card|is-special|audio|set-bg|face-image|card-image)\s*:/i.test(stringValue(value).trim());
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

  function sourceForSectionOnArrivalInsert(sections, sectionId, sceneId) {
    const wanted = normalizeEndpointLocalId(sectionId, sceneId);
    if (!wanted) {
      return null;
    }
    const section = ensureArray(sections).find((row) => normalizeEndpointLocalId(row && row.id, sceneId) === wanted) || null;
    const source = sourceRef(section && (section.sourceSpan || section.source) || {});
    const path = stringValue(source.path).replace(/\\/g, '/');
    const line = Number(source.line || source.startLine || 0);
    const anchor = stringValue(source.anchorText).trim();
    if (!path.startsWith('source/scenes/') || !path.endsWith('.scene.dry') || isProtectedRouterPath(path) ||
      !Number.isInteger(line) || line <= 0 || !/^[@#]\s*\S+/.test(anchor)) {
      return null;
    }
    return Object.assign({}, source, {
      line,
      startLine: line,
      endLine: line,
      anchorText: anchor,
      endAnchorText: anchor,
      sectionId: stringValue(section && section.id || sectionId),
      structureKind: 'section_on_arrival_insert_anchor'
    });
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
      sourceAnchorId: stringValue(value.sourceAnchorId),
      renderAnchorId: stringValue(value.renderAnchorId),
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
      rawRoutes: rawEffectLines(value.rawRoutes || value.routeClauses || value.advancedRoutes),
      calls: ensureArray(value.calls || value.callTargets || value.callScenes).map(stringValue).filter(Boolean),
      setJump: stringValue(value.setJump || value.jumpTarget),
      variants: ensureArray(value.variants).map((variant) => ({
        condition: stringValue(variant && variant.condition),
        text: stringValue(variant && variant.text)
      }))
    };
  }

  function optionFromBody(option, index) {
    const value = isObject(option) ? option : {};
    const target = stringValue(value.targetId || value.rawTargetId || value.target && value.target.id || value.target && value.target.targetId);
    const source = sourceRef(value.target && value.target.source || value.source || firstSource(ensureArray(value.fields).map((fieldValue) => fieldValue && fieldValue.source)));
    const resultMode = normalizeResultMode(value.resultMode, target);
    return {
      id: stringValue(value.id || target || 'option_' + (index + 1)),
      ownerSectionId: stringValue(value.ownerSectionId || value.sectionId),
      label: stringValue(value.label || value.title || value.id),
      targetId: target,
      rawTargetId: stringValue(value.rawTargetId || target),
      sectionId: stringValue(value.sectionId),
      chooseIf: stringValue(value.chooseIf || value.sectionChooseIf || value.sectionViewIf),
      unavailableText: stringValue(value.unavailableText),
      resultMode,
      gotoAfter: target,
      returnTarget: optionalSafeId(value.returnTarget || value.afterReturnTarget || ''),
      fields: ensureArray(value.fields),
      source,
      targetSource: source
    };
  }

  function sectionFromDraft(section, index) {
    const value = isObject(section) ? section : {};
    const id = safeId(value.id || 'section_' + (index + 1));
    return {
      id,
      sourceAnchorId: stringValue(value.sourceAnchorId),
      renderAnchorId: stringValue(value.renderAnchorId),
      title: stringValue(value.title || value.heading || humanize(id)),
      text: joinParagraphs(value.paragraphs || value.narrativeParagraphs || value.body || value.text),
      conditionalText: joinConditionalParagraphs(value.conditionalParagraphs || value.conditionalBody || value.conditionalText),
      condition: stringValue(value.condition || value.viewIf || value.chooseIf),
      exitTarget: safeId(value.exitTarget || value.returnTarget || 'root'),
      options: ensureArray(value.options).map((option, optionIndex) => optionFromDraft(option, optionIndex, id)),
      effects: ensureArray(value.effects).map(effectFromDraft).filter((effect) => effect.variable),
      rawEffects: rawEffectLines(value.rawEffects || value.rawSectionEffects || value.advancedEffects),
      rawRoutes: rawEffectLines(value.rawRoutes || value.routeClauses || value.advancedRoutes),
      calls: ensureArray(value.calls || value.callTargets || value.callScenes).map(stringValue).filter(Boolean),
      setJump: stringValue(value.setJump || value.jumpTarget),
      rawOnDisplay: rawEffectLines(value.rawOnDisplay || value.rawDisplayHook || value.advancedOnDisplay),
      rawOnDeparture: rawEffectLines(value.rawOnDeparture || value.rawDepartureHook || value.advancedOnDeparture)
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
    return eventEffectModel().effectFromDraft(effect);
  }

  function effectFromField(fieldValue, index) {
    const value = isObject(fieldValue) ? fieldValue : {};
    const parsed = parseEffect(value.value || value.original || '');
    parsed.id = stringValue(value.id || 'effect_' + index);
    return parsed;
  }

  function effectToDraft(effect) {
    return eventEffectModel().effectToDraft(effect);
  }

  function sectionToDraft(section) {
    const value = isObject(section) ? section : {};
    const out = {
      id: safeId(value.id || 'section'),
      sourceAnchorId: stringValue(value.sourceAnchorId),
      renderAnchorId: stringValue(value.renderAnchorId),
      title: stringValue(value.title || humanize(value.id)),
      paragraphs: paragraphs(value.text),
      conditionalParagraphs: conditionalParagraphs(value.conditionalText),
      options: ensureArray(value.options).map(optionToDraft),
      effects: ensureArray(value.effects).map(effectToDraft).filter((effect) => effect.variable),
      rawEffects: rawEffectLines(value.rawEffects),
      rawRoutes: rawEffectLines(value.rawRoutes),
      calls: ensureArray(value.calls).map(stringValue).filter(Boolean),
      setJump: stringValue(value.setJump || ''),
      rawOnDisplay: rawEffectLines(value.rawOnDisplay),
      rawOnDeparture: rawEffectLines(value.rawOnDeparture)
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
      sourceAnchorId: stringValue(value.sourceAnchorId),
      renderAnchorId: stringValue(value.renderAnchorId),
      label: stringValue(value.label || value.id || 'Option'),
      subtitle: stringValue(value.subtitle),
      chooseIf: stringValue(value.chooseIf),
      unavailableText: stringValue(value.unavailableText),
      effects: ensureArray(value.effects).map(effectToDraft).filter((effect) => effect.variable),
      rawEffects: rawEffectLines(value.rawEffects),
      rawRoutes: rawEffectLines(value.rawRoutes),
      calls: ensureArray(value.calls).map(stringValue).filter(Boolean),
      setJump: stringValue(value.setJump || ''),
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
        field('option.' + index + '.setJump', 'Set jump', option.setJump || '', 'guarded', {role: 'route'}),
        field('option.' + index + '.calls', 'Call scenes', joinRawEffectLines(option.calls), 'advanced_apply', {inputType: 'textarea', role: 'route', semanticRole: 'call_routes'}),
        field('option.' + index + '.rawRoutes', 'Raw option routes', joinRawEffectLines(option.rawRoutes), 'advanced_apply', {inputType: 'textarea', role: 'route', semanticRole: 'raw_routes'}),
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
      field('event.section.' + index + '.conditionalBody', label + ' conditional body', section.conditionalText || '', 'guarded', Object.assign({}, meta, {inputType: 'textarea', role: 'conditional_text', semanticRole: 'conditional_body'})),
      field('event.section.' + index + '.exitTarget', label + ' exit route', section.exitTarget || 'root', 'guarded', Object.assign({}, meta, {role: 'route', semanticRole: 'section_exit_route'})),
      field('event.section.' + index + '.setJump', label + ' set jump', section.setJump || '', 'guarded', Object.assign({}, meta, {role: 'route', semanticRole: 'section_set_jump'})),
      field('event.section.' + index + '.calls', label + ' call scenes', joinRawEffectLines(section.calls), 'advanced_apply', Object.assign({}, meta, {inputType: 'textarea', role: 'route', semanticRole: 'section_call_routes'})),
      field('event.section.' + index + '.rawRoutes', label + ' raw routes', joinRawEffectLines(section.rawRoutes), 'advanced_apply', Object.assign({}, meta, {inputType: 'textarea', role: 'route', semanticRole: 'section_raw_routes'})),
      field('event.section.' + index + '.rawEffects', label + ' raw effects', joinRawEffectLines(section.rawEffects), 'advanced_apply', Object.assign({}, meta, {inputType: 'textarea', role: 'effect', semanticRole: 'section_raw_effects'})),
      field('event.section.' + index + '.rawOnDisplay', label + ' on-display hook', joinRawEffectLines(section.rawOnDisplay), 'advanced_apply', Object.assign({}, meta, {inputType: 'textarea', role: 'effect', semanticRole: 'section_raw_hook'})),
      field('event.section.' + index + '.rawOnDeparture', label + ' on-departure hook', joinRawEffectLines(section.rawOnDeparture), 'advanced_apply', Object.assign({}, meta, {inputType: 'textarea', role: 'effect', semanticRole: 'section_raw_hook'}))
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

  function parseEffect(value) {
    return eventEffectModel().parseEffect(value);
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
    return eventEffectModel().effectLabel(effect);
  }

  function effectLabelForSource(effect) {
    return eventEffectModel().effectLabelForSource(effect);
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

  // Memoized: matchingGraphRoute compares every route against every graph edge,
  // recomputing endpointMatchTokens for the same handful of edge/target id
  // strings O(routes x edges) times (~1.2s self time on a large event). Pure
  // string -> string[], and callers only read the result (some/includes/
  // length/flatMap), so a shared cached array is safe. Bounded by the project
  // endpoint id vocabulary with a defensive size cap.
  const endpointMatchTokenCache = new Map();
  function endpointMatchTokens(value) {
    const key = String(value);
    if (endpointMatchTokenCache.has(key)) {
      return endpointMatchTokenCache.get(key);
    }
    const text = stringValue(value).trim().replace(/^[@#]/, '');
    let result;
    if (!text) {
      result = [];
    } else {
      const parts = text.split('.');
      const local = parts[parts.length - 1] || text;
      result = uniqueStrings([text, local, safeId(text), safeId(local)]);
    }
    if (endpointMatchTokenCache.size < 100000) {
      endpointMatchTokenCache.set(key, result);
    }
    return result;
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
    if (text === 'choice_event' || text === 'linear_choice_event' || text === 'pure_event') {
      return text;
    }
    return eventShapeForOptionCount(rootOptionCount);
  }

  function eventShapeForOptionCount(rootOptionCount) {
    const count = Number(rootOptionCount || 0);
    if (count <= 0) {
      return 'pure_event';
    }
    return count === 1 ? 'linear_choice_event' : 'choice_event';
  }

  function choiceLikeEventShape(shape) {
    return shape === 'choice_event' || shape === 'linear_choice_event';
  }

  function eventPatternForStructure(structure) {
    const value = isObject(structure) ? structure : {};
    const rootOptions = ensureArray(value.options).filter((option) => !option.ownerSectionId);
    if (ensureArray(value.sections).some((section) => ensureArray(section && section.options).length)) {
      return 'conditional_menu_loop';
    }
    const eventShape = normalizeEventShape(value.eventShape, rootOptions.length);
    if (eventShape === 'pure_event') {
      return 'pure_text';
    }
    if (eventShape === 'linear_choice_event') {
      return 'linear_choice';
    }
    return 'branching_consequence';
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

  function firstSource(values) {
    return ensureArray(values).map(sourceRef).find((source) => source.path) || {};
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

  function conditionalParagraphs(value) {
    if (Array.isArray(value)) {
      return value.map(normalizeConditionalParagraph).filter((row) => row.raw || row.condition || row.text);
    }
    return stringValue(value).split(/\n\s*\n/).map((item) => normalizeConditionalParagraph(item)).filter((row) => row.raw || row.condition || row.text);
  }

  function normalizeConditionalParagraph(value) {
    const row = isObject(value) ? value : {raw: value};
    const raw = stringValue(row.raw || row.sourceText).trim();
    const parsed = parseConditionalRaw(raw);
    return {
      condition: stringValue(row.condition || row.if || parsed.condition).trim(),
      text: stringValue(row.text || row.body || parsed.text).trim(),
      raw,
      sourceRole: stringValue(row.sourceRole || row.role || 'conditional_body').trim()
    };
  }

  function joinConditionalParagraphs(value) {
    return conditionalParagraphs(value).map((row) => row.raw || (row.condition && row.text ? '[? if ' + row.condition + ' : ' + row.text + ' ?]' : row.text)).filter(Boolean).join('\n\n');
  }

  function parseConditionalRaw(raw) {
    const match = stringValue(raw).trim().match(/^\[\?\s*if\s+([\s\S]*?)\s*:\s*([\s\S]*?)\s*\?\]$/);
    return match ? {condition: match[1].trim(), text: match[2].trim()} : {condition: '', text: ''};
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

  // Memoized: id mapping calls safeId ~336k times but with only ~2k distinct
  // inputs on a large event (99% repeats), and its three regex passes cost
  // ~1.8s of self time. Pure string -> string, so cache it (bounded by the
  // event/project id vocabulary, with a defensive size cap).
  const safeIdCache = new Map();
  function safeId(value) {
    const key = String(value);
    if (safeIdCache.has(key)) {
      return safeIdCache.get(key);
    }
    const text = stringValue(value).trim()
      .replace(/^[@#]/, '')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const result = /^[A-Za-z_]/.test(text) ? text : 'draft_' + (text || 'item');
    if (safeIdCache.size < 100000) {
      safeIdCache.set(key, result);
    }
    return result;
  }

  function optionalSafeId(value) {
    const text = stringValue(value).trim();
    return text ? safeId(text) : '';
  }

  function rawEffectLines(value) {
    return eventEffectModel().rawEffectLines(value);
  }

  function joinRawEffectLines(value) {
    return eventEffectModel().joinRawEffectLines(value);
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
