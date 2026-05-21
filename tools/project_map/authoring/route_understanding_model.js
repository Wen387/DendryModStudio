// @ts-check
(function initProjectMapRouteUnderstandingModel(global) {
  'use strict';

  const MODEL_VERSION = '0.1';
  const MODEL_KIND = 'route_understanding';
  const SEMANTIC_TIER = Object.freeze({
    STATIC: 'static_exact',
    GUIDED: 'guided_profile',
    RUNTIME: 'runtime_observed',
    MANUAL: 'manual_boundary'
  });

  /**
   * @typedef {import('../types/project_map_contracts').RouteUnderstandingModel} RouteUnderstandingModel
   * @typedef {import('../types/project_map_contracts').RouteUnderstandingBuildOptions} RouteUnderstandingBuildOptions
   * @typedef {import('../types/project_map_contracts').RouteUnderstandingProfileEvidence} RouteUnderstandingProfileEvidence
   * @typedef {import('../types/project_map_contracts').RouteUnderstandingEventChainItem} RouteUnderstandingEventChainItem
   * @typedef {import('../types/project_map_contracts').RouteUnderstandingSchedulerContextItem} RouteUnderstandingSchedulerContextItem
   * @typedef {import('../types/project_map_contracts').RouteUnderstandingUtilityCall} RouteUnderstandingUtilityCall
   * @typedef {import('../types/project_map_contracts').RouteUnderstandingStateDependency} RouteUnderstandingStateDependency
   * @typedef {import('../types/project_map_contracts').RouteEvidenceMap} RouteEvidenceMap
   * @typedef {import('../types/project_map_contracts').RouteEvidenceItem} RouteEvidenceItem
   * @typedef {import('../types/project_map_contracts').ScriptImpactMap} ScriptImpactMap
   * @typedef {import('../types/project_map_contracts').ScriptImpactBlock} ScriptImpactBlock
   */

  /**
   * @param {unknown} eventBody
   * @param {RouteUnderstandingBuildOptions=} options
   * @returns {RouteUnderstandingModel}
   */
  function buildRouteUnderstanding(eventBody, options) {
    /** @type {Record<string, any>} */
    const body = isObject(eventBody) ? eventBody : {};
    /** @type {Record<string, any>} */
    const opts = isObject(options) ? options : {};
    /** @type {Record<string, any>} */
    const structure = isObject(opts.structure) ? opts.structure : {};
    const index = projectIndexFor(body, opts, structure);
    /** @type {RouteEvidenceItem[]} */
    const routeEvidence = ensureArray(opts.routeEvidence && opts.routeEvidence.items || body.routeEvidenceMap && body.routeEvidenceMap.items);
    /** @type {ScriptImpactBlock[]} */
    const scripts = ensureArray(opts.scriptImpactMap && opts.scriptImpactMap.blocks || body.scriptImpactMap && body.scriptImpactMap.blocks);
    const eventId = stringValue(opts.eventId || structure.id || body.eventStructure && body.eventStructure.id || body.id);
    const context = {
      body,
      opts,
      index,
      eventId,
      scenes: sceneRows(index),
      sceneById: sceneMap(index),
      profiles: profileEvidenceRows(body, opts, index),
      routeEvidence,
      scripts
    };
    const eventChain = buildEventChain(context);
    const schedulerContext = buildSchedulerContext(context);
    const utilityCalls = buildUtilityCalls(context);
    const stateDependencies = buildStateDependencies(context);
    return {
      schemaVersion: MODEL_VERSION,
      kind: MODEL_KIND,
      eventId,
      summary: {
        eventChainCount: eventChain.items.length,
        schedulerContextCount: schedulerContext.items.length,
        utilityCallCount: utilityCalls.length,
        stateDependencyCount: stateDependencies.length,
        manualBoundaryCount: stateDependencies.filter((item) => item.opaque || ensureArray(item.manualReasons).length).length
      },
      eventChain,
      schedulerContext,
      utilityCalls,
      stateDependencies,
      diagnostics: diagnosticsFor(eventChain, schedulerContext, utilityCalls, stateDependencies)
    };
  }

  function buildEventChain(context) {
    const profileSeries = profileEventSeries(context);
    if (profileSeries.length) {
      return {
        items: profileSeries,
        summary: {source: 'profile', count: profileSeries.length, semanticTier: SEMANTIC_TIER.GUIDED}
      };
    }
    const prefixItems = prefixEventSeries(context);
    return {
      items: prefixItems,
      summary: {
        source: prefixItems.length ? 'prefix' : 'none',
        count: prefixItems.length,
        semanticTier: prefixItems.length ? SEMANTIC_TIER.GUIDED : SEMANTIC_TIER.MANUAL
      }
    };
  }

  function profileEventSeries(context) {
    const eventId = context.eventId;
    const patterns = flattenProfileArray(context, 'eventSeriesPatterns');
    const match = patterns.find((pattern) => {
      const sceneIds = ensureArray(pattern && pattern.sceneIds).concat(ensureArray(pattern && pattern.stages).map((stage) => stringValue(stage && (stage.sceneId || stage.id || stage))));
      const prefix = stringValue(pattern && (pattern.prefix || pattern.match));
      return sceneIds.includes(eventId) || Boolean(prefix && eventId.indexOf(prefix) === 0);
    });
    if (!match) {
      return [];
    }
    const stageRows = ensureArray(match.stages).length
      ? ensureArray(match.stages)
      : ensureArray(match.sceneIds).map((sceneId) => ({sceneId}));
    return stageRows.map((stage, index) => {
      const sceneId = stringValue(stage && (stage.sceneId || stage.id || stage));
      const scene = context.sceneById.get(sceneId) || {};
      return chainItem({
        scene,
        sceneId,
        stageLabel: stringValue(stage && (stage.stageLabel || stage.label)) || inferredStageLabel(sceneId, stringValue(match.prefix || match.match)),
        order: index + 1,
        semanticTier: SEMANTIC_TIER.GUIDED,
        evidenceClass: 'profile_series',
        context
      });
    }).filter((item) => item.sceneId);
  }

  function prefixEventSeries(context) {
    const prefix = bestSharedPrefix(context.eventId, context.scenes.map((scene) => stringValue(scene && scene.id)));
    if (!prefix) {
      return [];
    }
    return context.scenes
      .filter((scene) => stringValue(scene && scene.id).indexOf(prefix) === 0)
      .filter((scene) => eventLikeScene(scene))
      .sort((left, right) => stageSortKey(left, prefix) - stageSortKey(right, prefix) || stringValue(left && left.id).localeCompare(stringValue(right && right.id)))
      .map((scene, index) => chainItem({
        scene,
        sceneId: stringValue(scene && scene.id),
        stageLabel: inferredStageLabel(stringValue(scene && scene.id), prefix),
        order: index + 1,
        semanticTier: SEMANTIC_TIER.GUIDED,
        evidenceClass: 'prefix_series',
        context
      }));
  }

  function chainItem(input) {
    const scene = isObject(input.scene) ? input.scene : {};
    const sceneId = stringValue(input.sceneId || scene.id);
    return {
      sceneId,
      sourcePath: sourcePath(scene),
      stageLabel: stringValue(input.stageLabel || scene.title || sceneId),
      entryGuard: stringValue(scene.viewIf || scene.rawViewIf || scene.entryGuard || ''),
      metadata: {
        tags: tagsFor(scene),
        priority: stringValue(scene.priority),
        frequency: stringValue(scene.frequency),
        maxVisits: stringValue(scene.maxVisits || scene.max_visits)
      },
      outgoingRefs: outgoingRefsFor(input.context, sceneId).slice(0, 8),
      semanticTier: stringValue(input.semanticTier || SEMANTIC_TIER.GUIDED),
      evidenceClass: stringValue(input.evidenceClass || 'prefix_series'),
      order: Number(input.order || 0)
    };
  }

  function buildSchedulerContext(context) {
    /** @type {RouteUnderstandingSchedulerContextItem[]} */
    const items = [];
    const eventScene = context.sceneById.get(context.eventId) || {};
    const eventTags = tagsFor(eventScene);
    const tagDeckRoutes = tagDeckRoutesFor(context);
    const schedulerScenes = flattenProfileArray(context, 'schedulerScenes');
    const protectedScenes = protectedRouterSceneSet(context);
    const hasEventTag = eventTags.includes('event');
    if (hasEventTag) {
      const matchedDeck = tagDeckRoutes.find((route) => stringValue(route && route.tag) === 'event') || null;
      items.push({
        sceneId: context.eventId,
        tag: 'event',
        deckRoute: matchedDeck ? stringValue(matchedDeck.deckRoute || matchedDeck.route || '#event') : '',
        entryMode: 'tagged_event',
        readiness: matchedDeck ? 'scheduler_proven' : schedulerScenes.length ? 'profile_guided' : 'focused_entry_only',
        protected: false,
        semanticTier: matchedDeck ? SEMANTIC_TIER.STATIC : schedulerScenes.length ? SEMANTIC_TIER.GUIDED : SEMANTIC_TIER.RUNTIME,
        source: sourceRef(eventScene.sourceSpan || {path: eventScene.path})
      });
    }
    tagDeckRoutes.forEach((route) => {
      const sceneId = stringValue(route && (route.sceneId || route.ownerSceneId || route.id));
      items.push({
        sceneId,
        tag: stringValue(route && route.tag || 'event'),
        deckRoute: stringValue(route && (route.deckRoute || route.route || route.target || '#event')),
        entryMode: 'tag_deck',
        readiness: 'scheduler_proven',
        protected: protectedScenes.has(sceneId),
        semanticTier: SEMANTIC_TIER.STATIC,
        source: sourceRef(route && route.source || {})
      });
    });
    schedulerScenes.forEach((row) => {
      const sceneId = stringValue(row && (row.sceneId || row.id));
      if (!sceneId || items.some((item) => item.sceneId === sceneId && item.entryMode === 'profile_scheduler')) {
        return;
      }
      items.push({
        sceneId,
        tag: stringValue(row && row.tag || 'event'),
        deckRoute: stringValue(row && (row.deckRoute || row.route || row.target || '')),
        entryMode: 'profile_scheduler',
        readiness: 'profile_guided',
        protected: row && row.protected !== undefined ? Boolean(row.protected) : protectedScenes.has(sceneId),
        semanticTier: SEMANTIC_TIER.GUIDED,
        source: sourceRef(row && row.source || {})
      });
    });
    protectedScenes.forEach((sceneId) => {
      if (items.some((item) => item.sceneId === sceneId)) {
        return;
      }
      items.push({
        sceneId,
        tag: '',
        deckRoute: '',
        entryMode: 'protected_router',
        readiness: 'profile_guided',
        protected: true,
        semanticTier: SEMANTIC_TIER.GUIDED,
        source: sourceRef({})
      });
    });
    if (!items.length && context.eventId) {
      items.push({
        sceneId: context.eventId,
        tag: '',
        deckRoute: '',
        entryMode: 'unknown',
        readiness: 'unknown_wiring',
        protected: false,
        semanticTier: SEMANTIC_TIER.MANUAL,
        source: sourceRef(eventScene.sourceSpan || {path: eventScene.path})
      });
    }
    return {
      items: uniqueBy(items, (item) => [item.sceneId, item.tag, item.deckRoute, item.entryMode].join('|')),
      summary: {
        count: items.length,
        provenCount: items.filter((item) => item.readiness === 'scheduler_proven').length,
        protectedCount: items.filter((item) => item.protected).length
      }
    };
  }

  function buildUtilityCalls(context) {
    const utilityScenes = flattenProfileArray(context, 'utilityRouteScenes')
      .map((row) => ({
        sceneId: stringValue(row && (row.sceneId || row.id)),
        utilityKind: stringValue(row && (row.utilityKind || row.kind || 'single_slot_return_utility')),
        returnBinding: stringValue(row && (row.returnBinding || row.binding || 'jumpScene')),
        source: sourceRef(row && row.source || {})
      }))
      .filter((row) => row.sceneId);
    if (!utilityScenes.length) {
      return [];
    }
    const routeRows = routeRowsForUtility(context);
    /** @type {RouteUnderstandingUtilityCall[]} */
    const calls = [];
    utilityScenes.forEach((utility) => {
      routeRows.filter((route) => cleanTarget(route.target) === cleanTarget(utility.sceneId)).forEach((callRoute) => {
        const from = stringValue(callRoute.from || callRoute.owner);
        const setJumps = routeRows.filter((route) => {
          const binding = route.dynamicBinding || {};
          return (binding.kind === 'set_jump' || stringValue(route.routeKind).indexOf('set_jump') >= 0) &&
            sameRouteOwner(route, callRoute);
        });
        setJumps.forEach((jump) => {
          calls.push({
            from,
            utilitySceneId: utility.sceneId,
            setJumpTarget: stringValue(jump.target || jump.rawTarget || jump.dynamicBinding && jump.dynamicBinding.primaryTarget),
            returnBinding: utility.returnBinding,
            utilityKind: utility.utilityKind,
            semanticTier: SEMANTIC_TIER.GUIDED,
            evidenceClass: 'profile_utility',
            safeEditEligible: false,
            source: sourceRef(callRoute.source || {})
          });
        });
      });
    });
    return uniqueBy(calls, (call) => [call.from, call.utilitySceneId, call.setJumpTarget, call.returnBinding].join('|'));
  }

  function buildStateDependencies(context) {
    const byOwner = new Map();
    context.routeEvidence.forEach((route) => {
      const ownerId = stringValue(route && (route.from || route.owner || route.id));
      if (!ownerId) {
        return;
      }
      const row = ensureDependencyRow(byOwner, ownerId);
      variablesIn(route && route.predicate).forEach((name) => row.predicateReads.add(name));
    });
    context.scripts.forEach((block) => {
      const ownerId = stringValue(block && (block.sectionId || block.ownerId || block.label || block.id || block.hook));
      if (!ownerId) {
        return;
      }
      const row = ensureDependencyRow(byOwner, ownerId);
      ensureArray(block && block.writes).forEach((name) => row.preRouteWrites.add(cleanVariable(name)));
      if (block && (block.opaque || block.scriptKind === 'opaque_js' || block.safetyClass === 'manual_boundary')) {
        row.opaque = true;
        ensureArray(block.boundaryReasons).forEach((reason) => row.manualReasons.add(stringValue(reason)));
        if (!block.boundaryReasons || !block.boundaryReasons.length) {
          row.manualReasons.add('opaque_or_manual_script');
        }
      }
    });
    byOwner.forEach((row) => {
      row.preRouteWrites.forEach((name) => {
        if (row.predicateReads.has(name)) {
          row.directDependencyWrites.add(name);
        }
      });
    });
    context.scripts.forEach((block) => {
      if (!block || !block.routeInfluence) {
        return;
      }
      const ownerId = stringValue(block.sectionId || block.ownerId || block.label || block.id || block.hook);
      const row = ensureDependencyRow(byOwner, ownerId);
      row.opaque = row.opaque || block.scriptKind === 'opaque_js' || block.safetyClass === 'manual_boundary';
      if (row.opaque && !row.manualReasons.size) {
        row.manualReasons.add('route_influencing_manual_script');
      }
    });
    return Array.from(byOwner.values()).map((row) => ({
      ownerId: row.ownerId,
      predicateReads: Array.from(row.predicateReads).filter(Boolean).sort(),
      preRouteWrites: Array.from(row.preRouteWrites).filter(Boolean).sort(),
      directDependencyWrites: Array.from(row.directDependencyWrites).filter(Boolean).sort(),
      opaque: Boolean(row.opaque),
      manualReasons: Array.from(row.manualReasons).filter(Boolean).sort()
    })).filter((row) => row.predicateReads.length || row.preRouteWrites.length || row.opaque);
  }

  function ensureDependencyRow(map, ownerId) {
    const id = stringValue(ownerId);
    if (!map.has(id)) {
      map.set(id, {
        ownerId: id,
        predicateReads: new Set(),
        preRouteWrites: new Set(),
        directDependencyWrites: new Set(),
        opaque: false,
        manualReasons: new Set()
      });
    }
    return map.get(id);
  }

  function diagnosticsFor(eventChain, schedulerContext, utilityCalls, stateDependencies) {
    const diagnostics = [];
    if (!eventChain.items.length) {
      diagnostics.push(diagnostic('info', 'route_understanding.no_event_chain', 'No multi-scene event chain evidence was found.'));
    }
    if (!schedulerContext.items.some((item) => item.readiness === 'scheduler_proven')) {
      diagnostics.push(diagnostic('warning', 'route_understanding.scheduler_gap', 'Scheduler wiring is not statically proven for this context.'));
    }
    stateDependencies.filter((item) => item.opaque).forEach((item) => {
      diagnostics.push(diagnostic('warning', 'route_understanding.manual_state_dependency', 'Route predicates depend on manual or opaque state evidence: ' + item.ownerId));
    });
    utilityCalls.filter((item) => item.utilityKind !== 'single_slot_return_utility').forEach((item) => {
      diagnostics.push(diagnostic('warning', 'route_understanding.advanced_utility', 'Utility route pattern remains advanced: ' + item.utilitySceneId));
    });
    return diagnostics;
  }

  function projectIndexFor(body, opts, structure) {
    const nested = isObject(opts.options) ? opts.options : {};
    return isObject(opts.projectIndex) ? opts.projectIndex
      : isObject(structure.projectIndex) ? structure.projectIndex
      : isObject(body.projectIndex) ? body.projectIndex
      : isObject(nested.projectIndex) ? nested.projectIndex
      : {};
  }

  function sceneRows(index) {
    return ensureArray(index && index.scenes);
  }

  function sceneMap(index) {
    const map = new Map();
    sceneRows(index).forEach((scene) => {
      const id = stringValue(scene && scene.id);
      if (id) {
        map.set(id, scene);
      }
    });
    return map;
  }

  function profileEvidenceRows(body, opts, index) {
    const direct = ensureArray(opts.profileEvidence || body.profileEvidence);
    const nested = isObject(opts.options) ? ensureArray(opts.options.profileEvidence) : [];
    const parser = index && index.semantic && index.semantic.parserEvidence || {};
    const profiles = ensureArray(parser.profiles || parser.core && parser.core.profiles);
    const optionProfile = {};
    ['eventSeriesPatterns', 'schedulerScenes', 'protectedRouterScenes', 'utilityRouteScenes'].forEach((key) => {
      if (opts[key]) {
        optionProfile[key] = opts[key];
      }
    });
    const rows = direct.concat(nested).concat(profiles);
    return Object.keys(optionProfile).length ? rows.concat([optionProfile]) : rows;
  }

  function flattenProfileArray(context, key) {
    const rows = [];
    ensureArray(context.profiles).forEach((profile) => {
      ensureArray(profile && profile[key]).forEach((row) => rows.push(row));
      ensureArray(profile && profile.packages).forEach((pkg) => {
        ensureArray(pkg && pkg[key]).forEach((row) => rows.push(row));
      });
    });
    return rows;
  }

  function tagDeckRoutesFor(context) {
    const parser = context.index && context.index.semantic && context.index.semantic.parserEvidence || {};
    const core = isObject(parser.core) ? parser.core : parser;
    const rows = []
      .concat(ensureArray(core.tagDeckRoutes))
      .concat(ensureArray(core.schedulerTagRoutes))
      .concat(ensureArray(core.deckRoutes))
      .concat(ensureArray(parser.tagDeckRoutes))
      .concat(ensureArray(parser.schedulerTagRoutes));
    const newsRows = ensureArray(context.index && context.index.semantic && context.index.semantic.news && context.index.semantic.news.eventPopups)
      .map((popup) => ({
        sceneId: popup && popup.router && (popup.router.anchor || popup.router.sceneId) || '',
        tag: popup && popup.router && popup.router.tag || 'event',
        deckRoute: '#' + stringValue(popup && popup.router && popup.router.tag || 'event'),
        source: popup && popup.router && popup.router.source || {}
      }));
    return rows.concat(newsRows).map((row) => Object.assign({}, isObject(row) ? row : {}, {
      tag: stringValue(row && row.tag || 'event')
    }));
  }

  function protectedRouterSceneSet(context) {
    const set = new Set();
    flattenProfileArray(context, 'protectedRouterScenes').forEach((row) => {
      const sceneId = stringValue(row && (row.sceneId || row.id) || row);
      if (sceneId) {
        set.add(sceneId);
      }
    });
    flattenProfileArray(context, 'schedulerScenes').forEach((row) => {
      if (row && row.protected) {
        const sceneId = stringValue(row.sceneId || row.id);
        if (sceneId) {
          set.add(sceneId);
        }
      }
    });
    return set;
  }

  function routeRowsForUtility(context) {
    const fromEvidence = context.routeEvidence.map((route) => ({
      from: stringValue(route && route.from),
      owner: stringValue(route && route.owner),
      target: stringValue(route && (route.target || route.rawTarget)),
      rawTarget: stringValue(route && route.rawTarget),
      routeKind: stringValue(route && route.routeKind || route.kind),
      dynamicBinding: route && route.dynamicBinding || null,
      source: route && route.source || {}
    }));
    const fromEdges = ensureArray(context.body && context.body.flow && context.body.flow.edges).map((edge) => ({
      from: stringValue(edge && edge.from),
      owner: stringValue(edge && (edge.optionId || edge.from || edge.kind)),
      target: stringValue(edge && (edge.to || edge.target || edge.targetId || edge.rawTarget)),
      rawTarget: stringValue(edge && edge.rawTarget),
      routeKind: stringValue(edge && edge.kind),
      dynamicBinding: dynamicBindingFromEdge(edge),
      source: edge && edge.source || {}
    }));
    const fromProject = ensureArray(context.index && context.index.edges).map((edge) => ({
      from: stringValue(edge && edge.from),
      owner: stringValue(edge && edge.from),
      target: stringValue(edge && (edge.to || edge.target || edge.targetId)),
      rawTarget: stringValue(edge && edge.rawTarget),
      routeKind: stringValue(edge && edge.kind),
      dynamicBinding: dynamicBindingFromEdge(edge),
      source: edge && edge.source || {}
    }));
    return fromEvidence.concat(fromEdges).concat(fromProject).filter((route) => route.from || route.owner || route.target);
  }

  function dynamicBindingFromEdge(edge) {
    const kind = stringValue(edge && edge.kind);
    if (kind.indexOf('set_jump') >= 0) {
      return {kind: 'set_jump', source: 'jump', primaryTarget: stringValue(edge && (edge.to || edge.target || edge.rawTarget))};
    }
    return edge && edge.dynamicBinding || null;
  }

  function sameRouteOwner(left, right) {
    const leftKey = stringValue(left && (left.from || left.owner));
    const rightKey = stringValue(right && (right.from || right.owner));
    if (leftKey && rightKey && leftKey === rightKey) {
      return true;
    }
    const leftPath = stringValue(left && left.source && left.source.path);
    const rightPath = stringValue(right && right.source && right.source.path);
    return Boolean(leftPath && rightPath && leftPath === rightPath);
  }

  function outgoingRefsFor(context, sceneId) {
    const rows = [];
    ensureArray(context.index && context.index.edges).forEach((edge) => {
      if (stringValue(edge && edge.from) === sceneId) {
        rows.push({target: stringValue(edge && (edge.to || edge.target || edge.targetId)), kind: stringValue(edge && edge.kind), condition: stringValue(edge && edge.condition), source: sourceRef(edge && edge.source || {})});
      }
    });
    context.routeEvidence.forEach((route) => {
      if (stringValue(route && route.from) === sceneId) {
        rows.push({target: stringValue(route && (route.target || route.rawTarget)), kind: stringValue(route && (route.routeKind || route.sourceKind)), condition: stringValue(route && route.predicate), source: sourceRef(route && route.source || {})});
      }
    });
    return uniqueBy(rows, (row) => [row.target, row.kind, row.condition].join('|'));
  }

  function bestSharedPrefix(eventId, sceneIds) {
    const id = stringValue(eventId);
    const tokens = id.split('_').filter(Boolean);
    for (let length = tokens.length - 1; length >= 2; length -= 1) {
      const prefix = tokens.slice(0, length).join('_');
      const matches = ensureArray(sceneIds).filter((sceneId) => stringValue(sceneId).indexOf(prefix) === 0);
      if (matches.length >= 2) {
        return prefix;
      }
    }
    return '';
  }

  function stageSortKey(scene, prefix) {
    const suffix = stringValue(scene && scene.id).replace(prefix, '').replace(/^_+/, '');
    if (/announce|intro|opening|setup/i.test(suffix)) return 10;
    if (/candidate|select|choice/i.test(suffix)) return 20;
    if (/campaign/i.test(suffix) && /alt/i.test(suffix)) return 31;
    if (/campaign/i.test(suffix)) return 30;
    const round = suffix.match(/round[_-]?(\d+)/i);
    if (round) return 40 + Number(round[1] || 0);
    if (/result|final|post/i.test(suffix)) return 70;
    return 90;
  }

  function inferredStageLabel(sceneId, prefix) {
    const suffix = stringValue(sceneId).replace(stringValue(prefix), '').replace(/^_+/, '') || stringValue(sceneId);
    return suffix.split(/[_-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') || stringValue(sceneId);
  }

  function eventLikeScene(scene) {
    const type = stringValue(scene && scene.type);
    return !type || type === 'event' || tagsFor(scene).includes('event') || /(^|\/)events?\//.test(sourcePath(scene));
  }

  function tagsFor(scene) {
    if (Array.isArray(scene && scene.tags)) {
      return scene.tags.map(stringValue).filter(Boolean);
    }
    return stringValue(scene && (scene.tags || scene.tag)).split(/[,\s]+/).map((tag) => tag.trim()).filter(Boolean);
  }

  function sourcePath(scene) {
    return normalizePath(scene && (scene.path || scene.sourcePath || scene.sourceSpan && scene.sourceSpan.path || scene.topLevelSpan && scene.topLevelSpan.path));
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    const line = numberOrNull(value.line || value.startLine);
    const endLine = numberOrNull(value.endLine || value.line || value.startLine);
    return {
      path: normalizePath(value.path || value.sourcePath || ''),
      line,
      startLine: line,
      endLine,
      anchorText: stringValue(value.anchorText).trim()
    };
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message};
  }

  function variablesIn(value) {
    const names = [];
    replaceAll(stringValue(value), /\bQ\.([A-Za-z_][A-Za-z0-9_]*)\b/g, (match) => names.push(match[1]));
    replaceAll(stringValue(value).replace(/\bQ\.[A-Za-z_][A-Za-z0-9_]*\b/g, ''), /\b([A-Za-z_][A-Za-z0-9_]*)\b/g, (match) => {
      const word = match[1];
      if (!/^(if|and|or|not|true|false|null|undefined)$/i.test(word) && !/^\d/.test(word)) {
        names.push(word);
      }
    });
    return uniqueStrings(names.map(cleanVariable).filter(Boolean));
  }

  function cleanVariable(value) {
    return stringValue(value).replace(/^Q\./, '').trim();
  }

  function cleanTarget(value) {
    return stringValue(value).replace(/^[@#]/, '').trim();
  }

  function normalizePath(path) {
    return stringValue(path).replace(/\\/g, '/').replace(/^\.\//, '').trim();
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function uniqueStrings(values) {
    const seen = new Set();
    const out = [];
    ensureArray(values).forEach((value) => {
      const text = stringValue(value);
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      out.push(text);
    });
    return out;
  }

  function uniqueBy(items, keyFn) {
    const seen = new Set();
    const out = [];
    ensureArray(items).forEach((item) => {
      const key = stringValue(typeof keyFn === 'function' ? keyFn(item) : item);
      if (!key || seen.has(key)) {
        return;
      }
      seen.add(key);
      out.push(item);
    });
    return out;
  }

  function replaceAll(text, pattern, callback) {
    let match = pattern.exec(text);
    while (match) {
      callback(match);
      match = pattern.exec(text);
    }
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function stringValue(value) {
    return value === undefined || value === null ? '' : String(value);
  }

  const api = {
    MODEL_VERSION,
    buildRouteUnderstanding,
    build: buildRouteUnderstanding
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapRouteUnderstandingModel = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
