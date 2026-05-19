(function initProjectMapSourceStructureGraphModel(global) {
  'use strict';

  const SOURCE_STRUCTURE_GRAPH_VERSION = '0.1';
  const MODEL_KIND = 'source_structure_graph';
  const NESTED_LAYER_BUNDLE_MAX_DEPTH = 4;

  function buildSourceStructureGraph(input) {
    const value = isObject(input) ? input : {};
    const scene = isObject(value.scene) ? value.scene : {};
    const sceneId = stringValue(value.sceneId || scene.id);
    const sceneSource = sourceRef(value.source || scene.sourceSpan || scene.topLevelSpan || {path: scene.path});
    const options = ensureArray(value.options);
    const textBlocks = ensureArray(value.textBlocks);
    const effects = ensureArray(value.effects);
    const flow = isObject(value.flow) ? value.flow : {nodes: [], edges: []};
    const assets = ensureArray(value.assets || scene.assetRefs);
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();
    const edgeKeys = new Set();
    const sectionMap = buildSectionMap(scene, textBlocks);
    const incomingBySection = countIncomingOptions(sceneId, options);
    const effectsByOwner = groupEffectsByOwner(sceneId, effects, options);

    function addNode(node) {
      if (!node || !node.id || nodeMap.has(node.id)) {
        return node && node.id ? nodeMap.get(node.id) : null;
      }
      const normalized = normalizeNode(node);
      nodeMap.set(normalized.id, normalized);
      nodes.push(normalized);
      return normalized;
    }

    function addEdge(edge) {
      if (!edge || !edge.from || !edge.to) {
        return;
      }
      const key = [
        edge.kind || 'link',
        edge.from,
        edge.to,
        edge.label || '',
        edge.source && edge.source.path || '',
        edge.source && edge.source.line || ''
      ].join('|');
      if (edgeKeys.has(key)) {
        return;
      }
      edgeKeys.add(key);
      edges.push({
        id: edge.id || 'edge:' + (edges.length + 1),
        kind: stringValue(edge.kind || 'link'),
        from: stringValue(edge.from),
        to: stringValue(edge.to),
        label: stringValue(edge.label),
        condition: stringValue(edge.condition),
        source: sourceRef(edge.source || {})
      });
    }

    const sceneNode = addNode({
      id: 'scene:' + (sceneId || 'scene'),
      kind: 'scene',
      localId: sceneId,
      label: stringValue(scene.title || value.title || sceneId || 'Scene'),
      source: sceneSource,
      confidence: sourceConfidence(sceneSource)
    });

    sectionMap.forEach((section) => {
      const node = addNode({
        id: 'section:' + section.id,
        kind: 'section',
        semanticRole: section.semanticRole,
        branchKind: section.branchKind,
        localId: localSectionId(sceneId, section.id),
        label: section.label || section.sectionLabel || localSectionId(sceneId, section.id) || section.id,
        source: section.source,
        confidence: sourceConfidence(section.source),
        incomingOptionIds: incomingBySection.get(section.id) || [],
        ownedOptionIds: ownedOptionIds(options, section.id)
      });
      addEdge({kind: 'owns', from: sceneNode.id, to: node.id, label: 'section', source: section.source});
    });

    textBlocks.forEach((block, index) => {
      const sectionId = stringValue(block && block.sectionId);
      const node = addNode({
        id: 'text:' + safeId(block && block.id || sectionId || 'opening_' + (index + 1)),
        kind: 'text',
        semanticRole: stringValue(block && block.semanticRole || 'section_text'),
        branchKind: stringValue(block && block.branchKind),
        localId: stringValue(block && block.id),
        label: stringValue(block && block.label || block && block.sectionLabel || sectionId || 'Opening text'),
        source: sourceRef(block && block.source || {}),
        confidence: sourceConfidence(block && block.source || {}),
        sectionId
      });
      const ownerId = sectionId && sectionMap.has(sectionId) ? 'section:' + sectionId : sceneNode.id;
      addEdge({kind: 'contains_text', from: ownerId, to: node.id, label: node.label, source: node.source});
    });

    options.forEach((option, index) => {
      const optionId = stringValue(option && option.id || 'option_' + (index + 1));
      const ownerSectionId = stringValue(option && option.sectionId);
      const source = sourceRef(option && option.source || {});
      const node = addNode({
        id: 'option:' + optionId,
        kind: 'option',
        localId: optionId,
        label: stringValue(option && (option.label || option.rawTargetId || option.id || 'Option')),
        source,
        confidence: sourceConfidence(source),
        sectionId: ownerSectionId,
        targetId: stringValue(option && option.targetId),
        rawTargetId: stringValue(option && option.rawTargetId),
        hasCondition: hasOptionCondition(option),
        hasUnavailableText: Boolean(stringValue(option && option.unavailableText))
      });
      const ownerId = ownerSectionId && sectionMap.has(ownerSectionId) ? 'section:' + ownerSectionId : sceneNode.id;
      addEdge({kind: 'owns', from: ownerId, to: node.id, label: 'option', source});
      const targetSection = matchingSectionId(sceneId, sectionMap, option && (option.targetId || option.rawTargetId || option.id));
      if (targetSection) {
        addEdge({kind: 'targets', from: node.id, to: 'section:' + targetSection, label: 'option target', source});
      } else if (option && (option.targetId || option.rawTargetId)) {
        addEdge({kind: 'targets_external', from: node.id, to: 'external:' + safeId(option.targetId || option.rawTargetId), label: stringValue(option.rawTargetId || option.targetId), source});
      }
    });

    effects.forEach((effect, index) => {
      const owner = effectOwner(sceneId, effect, options);
      const source = sourceRef(effect && effect.source || {});
      const node = addNode({
        id: 'effect:' + safeId([owner.optionId || owner.sectionId || 'scene', index + 1, effect && (effect.variable || effect.displayExpression || effect.expression || 'effect')].join('_')),
        kind: 'effect',
        localId: stringValue(effect && (effect.variable || effect.displayExpression || effect.expression)),
        label: effectLabel(effect),
        source,
        confidence: sourceConfidence(source),
        sectionId: owner.sectionId,
        optionId: owner.optionId,
        variable: stringValue(effect && effect.variable)
      });
      addEdge({kind: 'effect_on', from: owner.nodeId || sceneNode.id, to: node.id, label: node.label, source});
    });

    ensureArray(flow && flow.edges).forEach((flowEdge, index) => {
      const source = sourceRef(flowEdge && flowEdge.source || {});
      const node = addNode({
        id: 'route:' + safeId([flowEdge && (flowEdge.from || 'scene'), flowEdge && (flowEdge.to || flowEdge.rawTarget || index + 1), index + 1].join('_')),
        kind: 'route',
        localId: stringValue(flowEdge && (flowEdge.rawTarget || flowEdge.to)),
        label: stringValue(flowEdge && (flowEdge.label || flowEdge.rawTarget || flowEdge.to || 'route')),
        source,
        confidence: sourceConfidence(source),
        condition: stringValue(flowEdge && flowEdge.condition)
      });
      const from = graphEndpointNodeId(sceneId, sectionMap, flowEdge && flowEdge.from, sceneNode.id);
      const to = graphEndpointNodeId(sceneId, sectionMap, flowEdge && flowEdge.to, null);
      addEdge({kind: 'route_from', from: from || sceneNode.id, to: node.id, label: node.label, source});
      if (to) {
        addEdge({kind: 'route_to', from: node.id, to, label: node.label, source});
      }
    });

    assets.forEach((asset, index) => {
      const source = sourceRef(asset && (asset.source || asset.sourceSpan) || {});
      const node = addNode({
        id: 'asset:' + safeId(asset && (asset.path || asset.name || asset.id) || 'asset_' + (index + 1)),
        kind: 'asset',
        localId: stringValue(asset && (asset.path || asset.name || asset.id)),
        label: stringValue(asset && (asset.label || asset.path || asset.name || 'Asset')),
        source,
        confidence: sourceConfidence(source),
        assetType: stringValue(asset && asset.type)
      });
      addEdge({kind: 'references', from: sceneNode.id, to: node.id, label: node.label, source});
    });

    const operationHints = {
      removeOptions: options.map((option) => removeOptionHint(sceneId, option, sectionMap, incomingBySection, effectsByOwner)),
      removeLayers: removeLayerHints(sceneId, nodes, edges)
    };
    const summary = summarizeGraph(nodes, edges, operationHints);
    return {
      schemaVersion: SOURCE_STRUCTURE_GRAPH_VERSION,
      kind: MODEL_KIND,
      sceneId,
      source: sceneSource,
      nodes,
      edges,
      summary,
      operationHints
    };
  }

  function buildSectionMap(scene, textBlocks) {
    const sceneId = stringValue(scene && scene.id);
    const map = new Map();
    ensureArray(scene && scene.sections).forEach((section) => {
      const id = stringValue(section && section.id);
      if (!id) {
        return;
      }
      map.set(id, {
        id,
        label: sectionDisplayLabel(sceneId, section, id),
        sectionLabel: sectionDisplayLabel(sceneId, section, id),
        semanticRole: '',
        branchKind: '',
        source: sourceRef(section && section.sourceSpan || {})
      });
    });
    ensureArray(textBlocks).forEach((block) => {
      const id = stringValue(block && block.sectionId);
      if (!id) {
        return;
      }
      const current = map.get(id) || {id, source: sourceRef({})};
      map.set(id, Object.assign({}, current, {
        label: stringValue(block && (block.label || block.sectionLabel)) || current.label || id,
        sectionLabel: stringValue(block && block.sectionLabel) || current.sectionLabel || current.label || id,
        semanticRole: stringValue(block && block.semanticRole) || current.semanticRole || '',
        branchKind: stringValue(block && block.branchKind) || current.branchKind || '',
        source: mergeSource(current.source, block && block.source)
      }));
    });
    return map;
  }

  function removeOptionHint(sceneId, option, sectionMap, incomingBySection, effectsByOwner) {
    const optionId = stringValue(option && option.id);
    const source = sourceRef(option && option.source || {});
    const targetSectionId = matchingSectionId(sceneId, sectionMap, option && (option.targetId || option.rawTargetId || option.id));
    const targetSection = targetSectionId ? sectionMap.get(targetSectionId) : null;
    const effects = effectsByOwner.get(optionId) || [];
    const hasCondition = hasOptionCondition(option);
    const hasUnavailableText = Boolean(stringValue(option && option.unavailableText));
    const sourceIsExact = isExactSingleLineOptionSource(source);
    const incoming = targetSectionId ? ensureArray(incomingBySection.get(targetSectionId)) : [];
    const touched = ['option:' + optionId];
    if (targetSectionId) {
      touched.push('section:' + targetSectionId);
    }
    const fallout = {
      targetSectionId: targetSectionId || '',
      targetIncomingOptionCount: incoming.length,
      effectCount: effects.length,
      hasCondition,
      hasUnavailableText
    };
    let safetyCandidate = 'manual_review';
    let riskLevel = 'manual';
    let reason = 'Option removal needs source review before Studio can patch it.';
    if (!sourceIsExact) {
      reason = 'Option line source is missing or not exact.';
    } else if (!targetSectionId && !effects.length && !hasCondition && !hasUnavailableText) {
      safetyCandidate = 'guarded_option_line_delete';
      riskLevel = 'guarded';
      reason = 'Exact one-line external choice has no local result, effects, prerequisite, or unavailable text.';
    } else if (targetSectionId && targetSection && incoming.length <= 1 && sourceConfidence(targetSection.source) !== 'missing') {
      safetyCandidate = effects.length || hasCondition || hasUnavailableText
        ? 'aggressive_option_bundle_delete'
        : 'advanced_option_bundle_delete';
      riskLevel = safetyCandidate.indexOf('aggressive') === 0 ? 'aggressive' : 'advanced';
      reason = 'Option has bounded local-result fallout that can become an explicit source-backed bundle.';
    } else if (targetSectionId) {
      reason = 'Option targets a local result with ambiguous incoming references or missing result span.';
    } else if (effects.length || hasCondition || hasUnavailableText) {
      reason = 'Option has effects, prerequisite, or unavailable text fallout.';
    }
    return {
      optionId,
      optionNodeId: 'option:' + optionId,
      targetSectionId: targetSectionId || '',
      targetSectionSource: targetSection ? sourceRef(targetSection.source || {}) : sourceRef({}),
      targetSectionSourceConfidence: targetSection ? sourceConfidence(targetSection.source) : 'missing',
      touchedNodeIds: touched,
      source,
      sourceConfidence: sourceConfidence(source),
      safetyCandidate,
      riskLevel,
      reason,
      fallout
    };
  }

  function removeLayerHints(sceneId, nodes, edges) {
    const sectionNodes = ensureArray(nodes).filter((node) => node && node.kind === 'section');
    return sectionNodes.map((section) => removeLayerHint(sceneId, section, nodes, edges));
  }

  function removeLayerHint(sceneId, section, nodes, edges) {
    const sectionId = stringValue(section && section.localId);
    const sectionNodeId = stringValue(section && section.id || ('section:' + sectionId));
    const source = sourceRef(section && section.source || {});
    const incomingOptionIds = ensureArray(section && section.incomingOptionIds).map(stringValue).filter(Boolean);
    const ownedOptionIds = ensureArray(section && section.ownedOptionIds).map(stringValue).filter(Boolean);
    const incomingRoutes = externalIncomingRoutesForSection(sectionNodeId, nodes, edges);
    const incomingRouteCount = incomingRoutes.length;
    const incomingRouteSources = incomingRoutes.map((route) => sourceRef(route.source || {}));
    const incomingRouteRefs = incomingRoutes.map((route) => {
      return Object.assign(sourceRef(route.source || {}), {
        routeNodeId: stringValue(route.routeNodeId),
        target: stringValue(route.localId),
        condition: stringValue(route.condition)
      });
    });
    const incomingRouteSourcesExact = incomingRouteRefs.every(isExactSingleLineRouteSource);
    const incomingRouteSourcesPatchable = incomingRouteRefs.every(isPatchableIncomingRouteSource);
    const effectCount = ensureArray(nodes).filter((node) => {
      return node && node.kind === 'effect' && sameEndpoint(sceneId, node.sectionId, sectionId);
    }).length;
    const incomingOptions = incomingOptionIds.map((optionId) => optionNodeForId(nodes, optionId)).filter(Boolean);
    const childBundle = childSectionBundle(sceneId, sectionId, ownedOptionIds, nodes, edges);
    const incomingOptionSources = incomingOptions.map((option) => sourceRef(option.source || {}));
    const incomingOptionFallout = incomingOptions.some((option) => option.hasCondition || option.hasUnavailableText || optionEffectCount(nodes, option.localId) > 0);
    const childFallout = childBundle.risky;
    const touched = [sectionNodeId];
    incomingOptions.forEach((option) => touched.push(option.id));
    incomingRoutes.forEach((route) => touched.push(route.routeNodeId));
    childBundle.sections.forEach((child) => touched.push(child.sectionNodeId));
    let safetyCandidate = 'manual_review';
    let riskLevel = 'manual';
    let reason = 'Layer removal needs source review before Studio can patch it.';
    if (!sourceSupportsAdvancedLayerDelete(source)) {
      reason = 'Layer source span is missing, inferred, or does not start at a section header.';
    } else if (incomingRouteCount && !incomingRouteSourcesPatchable) {
      reason = 'Layer has incoming route references without exact go-to source evidence.';
    } else if (incomingOptionIds.length && (incomingOptions.length !== incomingOptionIds.length || !incomingOptionSources.every(isExactSingleLineOptionSource))) {
      reason = 'Layer has an incoming option, but its option-line source is missing or not exact.';
    } else if (ownedOptionIds.length) {
      if (!childBundle.ok) {
        reason = childBundle.reason || 'Layer owns nested options; deleting it needs a branch bundle that also handles child routes/results.';
      } else {
        safetyCandidate = layerBundleSafetyCandidate('nested', incomingOptionIds.length, incomingOptionFallout || childFallout || incomingRouteCount > 0);
        riskLevel = riskLevelForSafetyCandidate(safetyCandidate);
        reason = incomingOptionIds.length
          ? 'Exact referenced nested layer can be deleted with its incoming option and route lines plus child result sections after explicit advanced review.'
          : incomingRouteCount
          ? 'Exact routed nested layer can be deleted with incoming go-to lines and child result sections after explicit advanced review.'
          : 'Exact nested layer can be deleted with its child result sections after explicit advanced review.';
      }
    } else if (incomingOptionIds.length) {
      safetyCandidate = layerBundleSafetyCandidate('referenced', incomingOptionIds.length, incomingOptionFallout || incomingRouteCount > 0);
      riskLevel = riskLevelForSafetyCandidate(safetyCandidate);
      reason = incomingOptionIds.length > 1
        ? 'Exact referenced layer can be deleted together with all incoming option and route lines after explicit advanced review.'
        : 'Exact referenced layer can be deleted together with its incoming option and route lines after explicit advanced review.';
    } else if (incomingRouteCount) {
      safetyCandidate = 'aggressive_routed_layer_bundle_delete';
      riskLevel = 'aggressive';
      reason = 'Exact routed layer can be deleted together with incoming go-to lines after explicit advanced review.';
    } else {
      safetyCandidate = 'advanced_layer_delete';
      riskLevel = effectCount ? 'advanced' : 'advanced';
      reason = effectCount
        ? 'Exact standalone layer can be deleted with its local effects after explicit advanced review.'
        : 'Exact standalone layer has no incoming references or nested options.';
    }
    return {
      sectionId,
      sectionNodeId,
      source,
      sourceConfidence: sourceConfidence(source),
      safetyCandidate,
      riskLevel,
      reason,
      touchedNodeIds: touched,
      fallout: {
        incomingOptionCount: incomingOptionIds.length,
        incomingOptionIds,
        incomingOptionSources,
        incomingRouteCount,
        incomingRouteNodeIds: incomingRoutes.map((route) => route.routeNodeId).filter(Boolean),
        incomingRouteSources,
        incomingRouteRefs,
        ownedOptionCount: ownedOptionIds.length,
        ownedOptionIds,
        childSectionCount: childBundle.sections.length,
        childSectionIds: childBundle.sections.map((child) => child.sectionId),
        childSectionSources: childBundle.sections.map((child) => sourceRef(child.source || {})),
        effectCount
      }
    };
  }

  function optionNodeForId(nodes, optionId) {
    const wanted = stringValue(optionId);
    if (!wanted) {
      return null;
    }
    const wantedSafe = safeId(wanted);
    return ensureArray(nodes).find((node) => {
      if (!node || node.kind !== 'option') {
        return false;
      }
      return node.localId === wanted ||
        node.id === 'option:' + wanted ||
        safeId(node.localId) === wantedSafe ||
        safeId(node.id.replace(/^option:/, '')) === wantedSafe;
    }) || null;
  }

  function layerBundleSafetyCandidate(kind, incomingOptionCount, riskyFallout) {
    const bundleKind = kind === 'nested' ? 'nested' : 'referenced';
    if (incomingOptionCount > 1) {
      return 'aggressive_multi_' + bundleKind + '_layer_bundle_delete';
    }
    return (riskyFallout ? 'aggressive_' : 'advanced_') + bundleKind + '_layer_bundle_delete';
  }

  function riskLevelForSafetyCandidate(safetyCandidate) {
    return stringValue(safetyCandidate).indexOf('aggressive') === 0 ? 'aggressive' : 'advanced';
  }

  function optionEffectCount(nodes, optionId) {
    const wanted = safeId(optionId);
    if (!wanted) {
      return 0;
    }
    return ensureArray(nodes).filter((node) => {
      return node && node.kind === 'effect' && safeId(node.optionId) === wanted;
    }).length;
  }

  function childSectionBundle(sceneId, parentSectionId, ownedOptionIds, nodes, edges) {
    const state = {
      sections: [],
      sectionNodeIds: new Set(),
      stack: new Set(),
      risky: false
    };
    const parentNode = sectionNodeForEndpoint(sceneId, nodes, parentSectionId);
    if (parentNode && parentNode.id) {
      state.stack.add(parentNode.id);
    }
    const result = collectChildSections(sceneId, parentSectionId, ownedOptionIds, nodes, edges, state, 0);
    if (!result.ok) {
      return result;
    }
    return {ok: true, sections: state.sections, risky: state.risky, reason: ''};
  }

  function collectChildSections(sceneId, parentSectionId, ownedOptionIds, nodes, edges, state, depth) {
    const owned = ensureArray(ownedOptionIds).map((optionId) => optionNodeForId(nodes, optionId)).filter(Boolean);
    if (!owned.length) {
      return {ok: true, sections: [], risky: false, reason: ''};
    }
    if (depth >= NESTED_LAYER_BUNDLE_MAX_DEPTH) {
      return {ok: false, sections: [], risky: state.risky, reason: 'Nested result tree is deeper than the supported bundle depth.'};
    }
    for (let index = 0; index < owned.length; index += 1) {
      const option = owned[index];
      const target = sectionNodeForEndpoint(sceneId, nodes, option.targetId || option.rawTargetId || option.localId);
      if (!target) {
        return {ok: false, sections: [], risky: state.risky, reason: 'Nested option target is external or cannot be resolved: ' + (option.label || option.localId)};
      }
      const targetSectionId = sectionIdFromNode(target);
      if (sameEndpoint(sceneId, targetSectionId, parentSectionId)) {
        return {ok: false, sections: [], risky: state.risky, reason: 'Nested option loops back to its parent layer: ' + (option.label || option.localId)};
      }
      if (state.stack.has(target.id)) {
        return {ok: false, sections: [], risky: state.risky, reason: 'Nested result tree contains a cycle: ' + targetSectionId};
      }
      const incoming = ensureArray(target.incomingOptionIds).map(stringValue).filter(Boolean);
      if (incoming.length !== 1 || !sameOptionId(incoming[0], option.localId)) {
        return {ok: false, sections: [], risky: state.risky, reason: 'Nested result has external or multiple incoming option references: ' + targetSectionId};
      }
      if (externalIncomingRouteCount(target.id, edges)) {
        return {ok: false, sections: [], risky: state.risky, reason: 'Nested result has incoming route references: ' + targetSectionId};
      }
      const source = sourceRef(target.source || {});
      if (!sourceSupportsAdvancedLayerDelete(source)) {
        return {ok: false, sections: [], risky: state.risky, reason: 'Nested result source span is missing or not exact: ' + targetSectionId};
      }
      state.risky = state.risky ||
        option.hasCondition ||
        option.hasUnavailableText ||
        optionEffectCount(nodes, option.localId) > 0 ||
        sectionEffectCount(sceneId, nodes, targetSectionId) > 0;
      if (!state.sectionNodeIds.has(target.id)) {
        state.sectionNodeIds.add(target.id);
        state.sections.push({
          sectionId: targetSectionId,
          sectionNodeId: target.id,
          source,
          ownerOptionId: option.localId
        });
      }
      state.stack.add(target.id);
      const nested = collectChildSections(sceneId, targetSectionId, target.ownedOptionIds, nodes, edges, state, depth + 1);
      state.stack.delete(target.id);
      if (!nested.ok) {
        return nested;
      }
    }
    return {ok: true, sections: state.sections, risky: state.risky, reason: ''};
  }

  function sameOptionId(left, right) {
    const a = stringValue(left);
    const b = stringValue(right);
    return Boolean(a && b && (a === b || safeId(a) === safeId(b)));
  }

  function sectionEffectCount(sceneId, nodes, sectionId) {
    return ensureArray(nodes).filter((node) => {
      return node && node.kind === 'effect' && sameEndpoint(sceneId, node.sectionId, sectionId);
    }).length;
  }

  function sectionNodeForEndpoint(sceneId, nodes, value) {
    const wanted = normalizeSectionCandidate(sceneId, value);
    if (!wanted) {
      return null;
    }
    return ensureArray(nodes).find((node) => {
      if (!node || node.kind !== 'section') {
        return false;
      }
      return sameEndpoint(sceneId, sectionIdFromNode(node), wanted) ||
        sameEndpoint(sceneId, node.localId, wanted);
    }) || null;
  }

  function sectionIdFromNode(node) {
    return stringValue(node && node.id || '').replace(/^section:/, '') || stringValue(node && node.localId);
  }

  function externalIncomingRouteCount(sectionNodeId, edges) {
    return externalIncomingRoutesForSection(sectionNodeId, [], edges).length;
  }

  function externalIncomingRoutesForSection(sectionNodeId, nodes, edges) {
    const routeFrom = new Map();
    const nodeById = new Map();
    ensureArray(nodes).forEach((node) => {
      if (node && node.id) {
        nodeById.set(node.id, node);
      }
    });
    ensureArray(edges).forEach((edge) => {
      if (edge && edge.kind === 'route_from') {
        routeFrom.set(edge.to, edge.from);
      }
    });
    return ensureArray(edges).map((edge) => {
      if (!edge || edge.kind !== 'route_to' || edge.to !== sectionNodeId) {
        return null;
      }
      if (isExactSingleLineOptionSource(edge.source)) {
        return null;
      }
      const from = routeFrom.get(edge.from) || '';
      if (!from || from === sectionNodeId) {
        return null;
      }
      const routeNode = nodeById.get(edge.from) || {};
      return {
        routeNodeId: stringValue(edge.from),
        fromNodeId: stringValue(from),
        label: stringValue(edge.label || routeNode.label),
        localId: stringValue(routeNode.localId || edge.label),
        condition: stringValue(edge.condition || routeNode.condition),
        source: sourceRef(edge.source || routeNode.source || {})
      };
    }).filter(Boolean);
  }

  function sourceSupportsAdvancedLayerDelete(sourceInput) {
    const source = sourceRef(sourceInput || {});
    const path = stringValue(source.path).replace(/\\/g, '/');
    return Boolean(
      path.startsWith('source/scenes/') &&
      path.endsWith('.scene.dry') &&
      source.line &&
      source.endLine &&
      source.endLine >= source.line &&
      /^[@#]\s*[A-Za-z_][A-Za-z0-9_.-]*/.test(stringValue(source.anchorText).trim()) &&
      stringValue(source.endAnchorText).trim()
    );
  }

  function isExactSingleLineRouteSource(sourceInput) {
    const source = sourceRef(sourceInput || {});
    const path = stringValue(source.path).replace(/\\/g, '/');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    return Boolean(
      path.startsWith('source/scenes/') &&
      path.endsWith('.scene.dry') &&
      Number.isInteger(line) &&
      line > 0 &&
      (!Number.isInteger(endLine) || endLine <= 0 || endLine === line) &&
      Boolean(simpleGoToLineTarget(source.anchorText))
    );
  }

  function isPatchableIncomingRouteSource(sourceInput) {
    const raw = isObject(sourceInput) ? sourceInput : {};
    const source = sourceRef(sourceInput || {});
    return isExactSingleLineRouteSource(source) || Boolean(goToClauseReplacement(source.anchorText, raw.target || raw.localId, raw.condition).ok);
  }

  function goToClauseReplacement(anchorText, target, condition) {
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
    const text = stringValue(value).trim();
    const match = text.match(/^([A-Za-z_][A-Za-z0-9_.-]*)(?:\s+if\s+([\s\S]+))?$/i);
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

  function sameEndpoint(sceneId, left, right) {
    const a = endpointKey(sceneId, left);
    const b = endpointKey(sceneId, right);
    return Boolean(a && b && a === b);
  }

  function endpointKey(sceneId, value) {
    const text = stringValue(value).trim().replace(/^[@#]/, '');
    if (!text) {
      return '';
    }
    return localSectionId(sceneId, text);
  }

  function countIncomingOptions(sceneId, options) {
    const counts = new Map();
    ensureArray(options).forEach((option) => {
      const target = stringValue(option && (option.targetId || option.rawTargetId || option.id));
      const id = normalizeSectionCandidate(sceneId, target);
      if (!id) {
        return;
      }
      if (!counts.has(id)) {
        counts.set(id, []);
      }
      counts.get(id).push(stringValue(option && option.id));
    });
    return counts;
  }

  function groupEffectsByOwner(sceneId, effects, options) {
    const map = new Map();
    ensureArray(effects).forEach((effect) => {
      const owner = effectOwner(sceneId, effect, options);
      const key = owner.optionId || owner.sectionId || '';
      if (!key) {
        return;
      }
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(effect);
    });
    return map;
  }

  function effectOwner(sceneId, effect, options) {
    const section = stringValue(effect && effect.sectionId);
    const option = ensureArray(options).find((row) => endpointMatches(sceneId, [
      row && row.id,
      row && row.targetId,
      row && row.rawTargetId
    ], section));
    if (option) {
      return {optionId: stringValue(option.id), sectionId: stringValue(option.sectionId), nodeId: 'option:' + stringValue(option.id)};
    }
    const sectionId = normalizeSectionCandidate(sceneId, section);
    return {
      optionId: '',
      sectionId,
      nodeId: sectionId ? 'section:' + sectionId : ''
    };
  }

  function matchingSectionId(sceneId, sectionMap, value) {
    const wanted = normalizeSectionCandidate(sceneId, value);
    if (!wanted) {
      return '';
    }
    if (sectionMap.has(wanted)) {
      return wanted;
    }
    const local = localSectionId(sceneId, wanted);
    for (const id of sectionMap.keys()) {
      if (localSectionId(sceneId, id) === local) {
        return id;
      }
    }
    return '';
  }

  function graphEndpointNodeId(sceneId, sectionMap, value, fallback) {
    const text = stringValue(value);
    if (!text) {
      return fallback || '';
    }
    const section = matchingSectionId(sceneId, sectionMap, text);
    if (section) {
      return 'section:' + section;
    }
    return fallback || '';
  }

  function endpointMatches(sceneId, values, wanted) {
    const target = normalizeSectionCandidate(sceneId, wanted);
    if (!target) {
      return false;
    }
    const targetLocal = localSectionId(sceneId, target);
    return ensureArray(values).some((value) => {
      const candidate = normalizeSectionCandidate(sceneId, value);
      return candidate && (candidate === target || localSectionId(sceneId, candidate) === targetLocal);
    });
  }

  function normalizeSectionCandidate(sceneId, value) {
    const raw = stringValue(value).replace(/^[@#]/, '');
    if (!raw || raw.startsWith('tag:') || raw.startsWith('runtime:')) {
      return '';
    }
    if (raw.indexOf('.') >= 0) {
      return raw;
    }
    return sceneId ? sceneId + '.' + raw : raw;
  }

  function ownedOptionIds(options, sectionId) {
    return ensureArray(options).filter((option) => stringValue(option && option.sectionId) === stringValue(sectionId))
      .map((option) => stringValue(option && option.id)).filter(Boolean);
  }

  function hasOptionCondition(option) {
    return Boolean(stringValue(option && option.chooseIf) || stringValue(option && option.sectionViewIf) || stringValue(option && option.sectionChooseIf));
  }

  function normalizeNode(node) {
    const source = sourceRef(node.source || {});
    return {
      id: stringValue(node.id),
      kind: stringValue(node.kind || 'node'),
      localId: stringValue(node.localId),
      label: stringValue(node.label || node.localId || node.id),
      semanticRole: stringValue(node.semanticRole),
      branchKind: stringValue(node.branchKind),
      source,
      sourceConfidence: stringValue(node.confidence || sourceConfidence(source)),
      sectionId: stringValue(node.sectionId),
      optionId: stringValue(node.optionId),
      targetId: stringValue(node.targetId),
      rawTargetId: stringValue(node.rawTargetId),
      condition: stringValue(node.condition),
      variable: stringValue(node.variable),
      assetType: stringValue(node.assetType),
      incomingOptionIds: ensureArray(node.incomingOptionIds).map(stringValue).filter(Boolean),
      ownedOptionIds: ensureArray(node.ownedOptionIds).map(stringValue).filter(Boolean),
      hasCondition: Boolean(node.hasCondition),
      hasUnavailableText: Boolean(node.hasUnavailableText)
    };
  }

  function summarizeGraph(nodes, edges, operationHints) {
    const exact = nodes.filter((node) => node.sourceConfidence === 'exact').length;
    const inferred = nodes.filter((node) => node.sourceConfidence === 'inferred').length;
    const missing = nodes.filter((node) => node.sourceConfidence === 'missing').length;
    const removeHints = ensureArray(operationHints && operationHints.removeOptions);
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      optionCount: nodes.filter((node) => node.kind === 'option').length,
      sectionCount: nodes.filter((node) => node.kind === 'section').length,
      effectCount: nodes.filter((node) => node.kind === 'effect').length,
      routeCount: nodes.filter((node) => node.kind === 'route').length,
      assetCount: nodes.filter((node) => node.kind === 'asset').length,
      exactSourceNodeCount: exact,
      inferredSourceNodeCount: inferred,
      missingSourceNodeCount: missing,
      removeOptionGuardedCount: removeHints.filter((hint) => hint.safetyCandidate === 'guarded_option_line_delete').length,
      removeOptionAdvancedCount: removeHints.filter((hint) => hint.safetyCandidate === 'advanced_option_bundle_delete').length,
      removeOptionAggressiveCount: removeHints.filter((hint) => hint.safetyCandidate === 'aggressive_option_bundle_delete').length,
      removeOptionManualCount: removeHints.filter((hint) => hint.riskLevel === 'manual').length,
      removeLayerAdvancedCount: ensureArray(operationHints && operationHints.removeLayers).filter((hint) => /^advanced_.*layer.*delete$/.test(hint.safetyCandidate || '') || hint.safetyCandidate === 'advanced_layer_delete').length,
      removeLayerAggressiveCount: ensureArray(operationHints && operationHints.removeLayers).filter((hint) => /^aggressive_.*layer.*delete$/.test(hint.safetyCandidate || '')).length,
      removeLayerManualCount: ensureArray(operationHints && operationHints.removeLayers).filter((hint) => hint.riskLevel === 'manual').length
    };
  }

  function sourceConfidence(sourceInput) {
    const source = sourceRef(sourceInput || {});
    if (!source.path) {
      return 'missing';
    }
    if (source.line && source.anchorText) {
      return 'exact';
    }
    if (source.line || source.startLine || source.endLine) {
      return 'inferred';
    }
    return 'missing';
  }

  function isExactSingleLineOptionSource(sourceInput) {
    const source = sourceRef(sourceInput || {});
    return Boolean(
      source.path &&
      source.line &&
      (!source.endLine || source.endLine === source.line) &&
      /^-\s+@[A-Za-z0-9_.-]+/.test(stringValue(source.anchorText).trim())
    );
  }

  function mergeSource(a, b) {
    const left = sourceRef(a || {});
    const right = sourceRef(b || {});
    const useRightEnd = !left.endAnchorText && right.endAnchorText;
    return {
      path: left.path || right.path,
      line: left.line || right.line,
      startLine: left.startLine || right.startLine || left.line || right.line,
      endLine: useRightEnd ? right.endLine : left.endLine || right.endLine || left.line || right.line,
      anchorText: left.anchorText || right.anchorText,
      endAnchorText: left.endAnchorText || right.endAnchorText
    };
  }

  function effectLabel(effect) {
    const explicit = stringValue(effect && (effect.displayExpression || effect.expression || effect.sourceExpression)).trim();
    if (explicit) {
      return explicit;
    }
    const variable = stringValue(effect && effect.variable);
    if (!variable) {
      return 'effect';
    }
    const op = stringValue(effect && (effect.op || effect.operator) || '+=');
    const value = effect && effect.value !== undefined && effect.value !== null ? effect.value : 1;
    const condition = stringValue(effect && effect.condition);
    return 'Q.' + variable.replace(/^Q\./, '') + ' ' + op + ' ' + String(value) + (condition ? ' if ' + condition : '');
  }

  function sectionDisplayLabel(sceneId, section, sectionId) {
    const raw = stringValue(sectionId);
    const local = localSectionId(sceneId, raw);
    return stringValue(section && (section.title || section.subtitle) || humanize(local || raw || 'section'));
  }

  function localSectionId(sceneId, sectionId) {
    const raw = stringValue(sectionId);
    const scene = stringValue(sceneId);
    return scene && raw.startsWith(scene + '.') ? raw.slice(scene.length + 1) : raw;
  }

  function humanize(value) {
    return stringValue(value || 'section').replace(/[_-]+/g, ' ').replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    const line = numberOrNull(value.line || value.startLine);
    const endLine = numberOrNull(value.endLine || value.line || value.startLine);
    return {
      path: stringValue(value.path || value.sourcePath),
      line,
      startLine: line || numberOrNull(value.startLine),
      endLine,
      anchorText: stringValue(value.anchorText) || excerptLineText(value.excerpt, line),
      endAnchorText: stringValue(value.endAnchorText) || excerptLineText(value.excerpt, endLine)
    };
  }

  function excerptLineText(excerpt, line) {
    const wanted = numberOrNull(line);
    if (!wanted) {
      return '';
    }
    const prefix = String(wanted) + ':';
    const row = stringValue(excerpt).split(/\r?\n/).find((item) => item.trimStart().startsWith(prefix));
    if (!row) {
      return '';
    }
    const text = row.trimStart().slice(prefix.length);
    return text.replace(/^ /, '').trimEnd();
  }

  function safeId(value) {
    const text = stringValue(value || 'item').trim()
      .replace(/^[@#]/, '')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return /^[A-Za-z_]/.test(text) ? text : 'item_' + (text || 'item');
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
  }

  function stringValue(value) {
    return value === undefined || value === null ? '' : String(value);
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {
    SOURCE_STRUCTURE_GRAPH_VERSION,
    MODEL_KIND,
    buildSourceStructureGraph
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSourceStructureGraphModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
