(function initProjectMapPreviewObjectEventBuilder(global) {
  'use strict';

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const ensureArray = domTextUtils.ensureArray;
  const escapeHtml = domTextUtils.escapeHtml;
  const escapeAttr = domTextUtils.escapeAttr;

  const api = {
    renderAssetReferenceEditor,
    renderEventGraphSummary,
    renderEventReadiness,
    renderChoiceUnitSummary,
    renderConsequenceGroups,
    renderContinuationMap,
    renderPlayabilityChecks,
    renderRouteScriptIntelligence
  };

  if (global) {
    global.ProjectMapPreviewObjectEventBuilder = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  function renderAssetReferenceEditor(assets) {
    const rows = ensureArray(assets).filter((asset) => asset && (asset.path || asset.label || asset.name));
    if (!rows.length) {
      return '';
    }
    return [
      '<section class="preview-object-assets" data-preview-object-assets="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.assets', 'Referenced assets')) + '</div>',
      rows.map((asset) => {
        const fieldId = String(asset && (asset.id || asset.path || asset.previewUrl) || '').trim();
        const fieldAttrs = fieldId ? ' data-preview-object-asset-entry="' + escapeAttr(fieldId) + '" tabindex="0"' : '';
        return [
        '<article' + fieldAttrs + '>',
        '<strong>' + escapeHtml(asset.label || asset.name || asset.path || t('previewObjectEditor.asset', 'Asset')) + '</strong>',
        asset.role || asset.type ? '<small>' + escapeHtml([asset.role, asset.type].filter(Boolean).join(' / ')) + '</small>' : '',
        asset.path ? '<code>' + escapeHtml(asset.path) + '</code>' : '',
        asset.referenceState && asset.referenceState.help ? '<small>' + escapeHtml(asset.referenceState.help) + '</small>' : '',
        '</article>'
      ].join('');
      }).join(''),
      '</section>'
    ].join('');
  }

  function renderEventGraphSummary(graph, model) {
    if (!graph || !ensureArray(graph.nodes).length) {
      // An event with no routed nodes used to render nothing here, leaving a
      // silent gap. Show a short hint instead. Deliberately NOT tagged with the
      // populated route-map markers so contract checks that look for a real
      // route map only match the genuine one below.
      return '<section class="preview-object-event-graph preview-object-route-map-empty" data-preview-object-route-map-empty="true">' +
        '<p class="preview-object-route-map-empty-hint">' +
        escapeHtml(t('previewObjectEditor.routeMapEmpty', 'No route map yet — add an option to see routing.')) +
        '</p></section>';
    }
    const nodes = ensureArray(graph.nodes);
    const edges = ensureArray(graph.edges);
    const reviewChips = routeMapReviewChips(model, graph);
    return [
      '<section class="preview-object-event-graph preview-object-route-map" data-preview-object-event-graph="true" data-preview-object-route-map="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.routeMap', 'Route Map')) + '</div>',
      '<div class="preview-object-event-graph-row">',
      '<strong>' + escapeHtml(String(graph.nodeCount || nodes.length)) + '</strong><span>' + escapeHtml(t('previewObjectEditor.graphNodes', 'nodes')) + '</span>',
      '<strong>' + escapeHtml(String(graph.edgeCount || edges.length)) + '</strong><span>' + escapeHtml(t('previewObjectEditor.graphRoutes', 'routes')) + '</span>',
      '</div>',
      reviewChips.length ? '<div class="preview-object-route-map-chips" data-preview-object-route-map-review="true">' + reviewChips.map((chip) => renderRouteMapChip(chip, 'b', 'data-route-map-review-chip="' + escapeAttr(chip && (chip.key || chip.label) || '') + '"')).join('') + '</div>' : '',
      renderRouteCausalFlow(edges, model && model.routeUnderstanding),
      renderRouteUnderstandingContext(model && model.routeUnderstanding),
      renderRouteGuidedEditTools(model && model.routeGuidedEdits),
      '<div class="preview-object-event-graph-grid" data-workflow-entry="event_graph_node">',
      nodes.map(renderEventGraphNode).join(''),
      '</div>',
      edges.length ? '<div class="preview-object-event-graph-routes" data-workflow-entry="event_graph_edge"><h4>' + escapeHtml(t('previewObjectEditor.routeMapRoutes', 'Routes')) + '</h4>' + edges.map(renderEventGraphEdge).join('') + '</div>' : '',
      '</section>'
    ].join('');
  }

  function renderRouteCausalFlow(edges, understanding) {
    const rows = routeCausalRows(edges, understanding).slice(0, 8);
    if (!rows.length) {
      return '';
    }
    return [
      '<section class="preview-object-route-causal-flow" data-preview-object-route-causal-flow="true">',
      '<div class="preview-object-route-causal-header">',
      '<h4>' + escapeHtml(t('previewObjectEditor.routeCausalFlow', 'Causal flow')) + '</h4>',
      '<span>' + escapeHtml(t('previewObjectEditor.routeCausalFlowCount', '{count} routes').replace('{count}', String(rows.length))) + '</span>',
      '</div>',
      '<div class="preview-object-route-causal-grid">',
      rows.map(renderRouteCausalRow).join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function routeCausalRows(edges, understanding) {
    const dependencies = ensureArray(understanding && understanding.stateDependencies);
    return ensureArray(edges)
      .filter((edge) => edge && (edge.from || edge.to || edge.targetId) && !String(edge.kind || '').includes('effect'))
      .map((edge) => {
        const dependency = dependencies.find((item) => item && (item.ownerId === edge.from || item.ownerId === edge.sourceId || item.ownerId === edge.id));
        return {
          edge,
          dependency,
          cause: routeCausalCause(edge),
          gate: routeCausalGate(edge, dependency),
          result: routeCausalResult(edge)
        };
      });
  }

  function renderRouteCausalRow(row) {
    const value = row || {};
    const edge = value.edge || {};
    const chips = [
      edge.semanticTier ? routeSemanticTierChip(edge.semanticTier) : '',
      edge.safeEditEligible ? {label: t('previewObjectEditor.routeSafeStructured', 'safe structured'), tone: 'safe'} : '',
      edge.targetResolution ? routeTargetResolutionChip(edge.targetResolution) : '',
      edge.installSafety ? safetyChip(edge.installSafety) : ''
    ].filter(Boolean);
    return [
      '<article class="preview-object-route-causal-row" data-route-causal-edge="' + escapeAttr(edge.id || '') + '">',
      '<div class="preview-object-route-causal-step">',
      '<span>' + escapeHtml(t('previewObjectEditor.routeCausalCause', 'Cause')) + '</span>',
      '<strong>' + escapeHtml(value.cause.title) + '</strong>',
      value.cause.detail ? '<small>' + escapeHtml(value.cause.detail) + '</small>' : '',
      '</div>',
      '<div class="preview-object-route-causal-arrow" aria-hidden="true">&rarr;</div>',
      '<div class="preview-object-route-causal-step">',
      '<span>' + escapeHtml(t('previewObjectEditor.routeCausalGate', 'Gate')) + '</span>',
      '<strong>' + escapeHtml(value.gate.title) + '</strong>',
      value.gate.detail ? '<small>' + escapeHtml(value.gate.detail) + '</small>' : '',
      '</div>',
      '<div class="preview-object-route-causal-arrow" aria-hidden="true">&rarr;</div>',
      '<div class="preview-object-route-causal-step">',
      '<span>' + escapeHtml(t('previewObjectEditor.routeCausalResult', 'Result')) + '</span>',
      '<strong>' + escapeHtml(value.result.title) + '</strong>',
      value.result.detail ? '<small>' + escapeHtml(value.result.detail) + '</small>' : '',
      '</div>',
      chips.length ? '<div class="preview-object-route-map-edge-chips preview-object-route-causal-chips">' + chips.map((chip) => renderRouteMapChip(chip, 'i')).join('') + '</div>' : '',
      '</article>'
    ].join('');
  }

  function routeCausalCause(edge) {
    const value = edge || {};
    const kind = graphKindLabel(value.kind || 'route');
    const from = String(value.from || value.sourceId || '').trim();
    return {
      title: from || kind,
      detail: from ? kind : ''
    };
  }

  function routeCausalGate(edge, dependency) {
    const value = edge || {};
    if (value.condition) {
      return {
        title: t('previewObjectEditor.routeCausalCondition', 'Condition'),
        detail: value.condition
      };
    }
    if (value.dynamicBinding && value.dynamicBinding.kind) {
      return {
        title: t('previewObjectEditor.routeCausalDynamicBinding', 'Dynamic binding'),
        detail: dynamicBindingLabel(value.dynamicBinding)
      };
    }
    if (dependency) {
      const reads = ensureArray(dependency.predicateReads).slice(0, 3);
      const writes = ensureArray(dependency.directDependencyWrites).concat(ensureArray(dependency.preRouteWrites)).slice(0, 3);
      const detail = [
        writes.length ? t('previewObjectEditor.routeUnderstandingWrites', 'writes') + ': ' + writes.join(', ') : '',
        reads.length ? t('previewObjectEditor.routeUnderstandingReads', 'reads') + ': ' + reads.join(', ') : ''
      ].filter(Boolean).join(' / ');
      return {
        title: dependency.opaque ? t('previewObjectEditor.routeUnderstandingOpaque', 'manual JS boundary') : t('previewObjectEditor.routeCausalStateDependency', 'State dependency'),
        detail
      };
    }
    if (routeMapEdgeNeedsReview(value)) {
      return {
        title: t('previewObjectEditor.routeCausalReviewGate', 'Review evidence'),
        detail: value.evidenceClass ? routeEvidenceClassLabel(value.evidenceClass) : ''
      };
    }
    return {
      title: t('previewObjectEditor.routeCausalAlways', 'Always valid'),
      detail: ''
    };
  }

  function routeCausalResult(edge) {
    const value = edge || {};
    const target = String(value.targetId || value.to || value.target || '').trim();
    const resolution = value.targetResolution ? routeTargetResolutionLabel(value.targetResolution) : '';
    return {
      title: target || resolution || t('previewObjectEditor.routeCausalUnknownTarget', 'Unknown target'),
      detail: target && resolution ? resolution : ''
    };
  }

  function renderRouteGuidedEditTools(model) {
    const entries = ensureArray(model && model.entries).slice(0, 8).sort(routeGuidedEditRank);
    if (!entries.length) {
      return '';
    }
    return [
      '<div class="preview-object-route-guided-edits" data-preview-object-route-guided-edits="true">',
      '<section class="preview-object-route-understanding-group preview-object-route-guided-panel" data-route-guided-edit-section="tools">',
      '<div class="preview-object-route-guided-header">',
      '<h4>' + escapeHtml(t('previewObjectEditor.routeRecommendedEdits', 'Recommended next edits')) + '</h4>',
      '<span>' + escapeHtml(t('previewObjectEditor.routeRecommendedEditsCount', '{count} available').replace('{count}', String(entries.length))) + '</span>',
      '</div>',
      '<div class="preview-object-route-understanding-grid">',
      entries.map(renderRouteGuidedEditItem).join(''),
      '</div>',
      '</section>',
      '</div>'
    ].join('');
  }

  function renderRouteGuidedEditItem(entry) {
    const value = entry || {};
    const action = graphAction(value.editAction);
    const actionAttrs = action ? ' data-visible-edit-action="' + escapeAttr(encodeAction(action)) + '"' : '';
    const chips = [
      routeGuidedEditKindChip(value.kind),
      value.semanticTier ? routeSemanticTierChip(value.semanticTier) : '',
      value.safeEditEligible ? {label: t('previewObjectEditor.routeGuidedSafe', 'guided edit'), tone: 'safe'} : {label: t('previewObjectEditor.routeGuidedManual', 'manual boundary'), tone: 'manual'},
      value.installSafety ? safetyChip(value.installSafety) : ''
    ].filter(Boolean);
    const cardTone = value.safeEditEligible ? ' is-safe' : ' is-manual';
    return [
      '<article class="preview-object-route-guided-card' + cardTone + '" data-route-guided-edit-kind="' + escapeAttr(value.kind || '') + '" data-route-guided-edit-safe="' + (value.safeEditEligible ? 'true' : 'false') + '">',
      '<strong>' + escapeHtml(value.label || routeGuidedEditKindLabel(value.kind)) + '</strong>',
      value.routeTable && value.routeTable.variable ? '<span>' + escapeHtml(value.routeTable.variable) + '</span>' : '',
      value.utilityPair && value.utilityPair.utilitySceneId ? '<span>' + escapeHtml([value.utilityPair.utilitySceneId, value.utilityPair.setJumpTarget].filter(Boolean).join(' / ')) + '</span>' : '',
      value.fallbackSuggestion && value.fallbackSuggestion.complementPredicate ? '<code>' + escapeHtml(value.fallbackSuggestion.complementPredicate) + '</code>' : '',
      chips.length ? '<div class="preview-object-route-map-edge-chips">' + chips.map((chip) => renderRouteMapChip(chip, 'i')).join('') + '</div>' : '',
      ensureArray(value.manualReasons).length ? '<small>' + escapeHtml(ensureArray(value.manualReasons).slice(0, 2).join(', ')) + '</small>' : '',
      action ? '<button type="button" class="preview-object-route-map-action preview-object-route-guided-action" data-route-guided-edit-action="' + escapeAttr(value.kind || '') + '" data-route-guided-edit-safe="' + (value.safeEditEligible ? 'true' : 'false') + '"' + actionAttrs + '>' + escapeHtml(value.safeEditEligible ? t('previewObjectEditor.routeGuidedOpen', 'Open guided editor') : t('previewObjectEditor.routeGuidedReview', 'Review source')) + '</button>' : '',
      '</article>'
    ].join('');
  }

  function renderRouteUnderstandingContext(model) {
    if (!model) {
      return '';
    }
    const eventChain = ensureArray(model.eventChain && model.eventChain.items).slice(0, 6);
    const scheduler = ensureArray(model.schedulerContext && model.schedulerContext.items).slice(0, 5);
    const utilities = ensureArray(model.utilityCalls).slice(0, 5);
    const dependencies = ensureArray(model.stateDependencies).slice(0, 5);
    if (!eventChain.length && !scheduler.length && !utilities.length && !dependencies.length) {
      return '';
    }
    return [
      '<div class="preview-object-route-understanding" data-preview-object-route-understanding="true">',
      eventChain.length ? renderRouteUnderstandingGroup('event_chain', t('previewObjectEditor.routeUnderstandingEventChain', 'Event chain'), eventChain.map(renderEventChainItem).join(''), eventChain.length, false) : '',
      scheduler.length ? renderRouteUnderstandingGroup('scheduler', t('previewObjectEditor.routeUnderstandingScheduler', 'Scheduler context'), scheduler.map(renderSchedulerContextItem).join(''), scheduler.length, false) : '',
      utilities.length ? renderRouteUnderstandingGroup('utility', t('previewObjectEditor.routeUnderstandingUtility', 'Utility calls'), utilities.map(renderUtilityCallItem).join(''), utilities.length, false) : '',
      dependencies.length ? renderRouteUnderstandingGroup('state_dependency', t('previewObjectEditor.routeUnderstandingState', 'State dependencies'), dependencies.map(renderStateDependencyItem).join(''), dependencies.length, false) : '',
      '</div>'
    ].join('');
  }

  function renderRouteUnderstandingGroup(key, title, content, count, open) {
    return [
      '<details class="preview-object-route-understanding-group" data-route-understanding-section="' + escapeAttr(key) + '"' + (open ? ' open' : '') + '>',
      '<summary>',
      '<h4>' + escapeHtml(title) + '</h4>',
      '<span>' + escapeHtml(t('previewObjectEditor.routeUnderstandingCount', '{count} items').replace('{count}', String(count || 0))) + '</span>',
      '</summary>',
      '<div class="preview-object-route-understanding-grid">',
      content,
      '</div>',
      '</details>'
    ].join('');
  }

  function renderEventChainItem(item) {
    const chips = [
      item && item.semanticTier ? routeSemanticTierChip(item.semanticTier) : '',
      item && item.evidenceClass ? evidenceClassChip(item.evidenceClass) : '',
      item && item.entryGuard ? {label: t('previewObjectEditor.routeUnderstandingGuarded', 'guarded'), tone: 'guided'} : ''
    ].filter(Boolean);
    return [
      '<article data-route-understanding-item="event_chain">',
      '<strong>' + escapeHtml(item && (item.stageLabel || item.sceneId) || '') + '</strong>',
      '<span>' + escapeHtml(item && item.sceneId || '') + '</span>',
      item && item.entryGuard ? '<code>' + escapeHtml(item.entryGuard) + '</code>' : '',
      chips.length ? '<div class="preview-object-route-map-edge-chips">' + chips.map((chip) => renderRouteMapChip(chip, 'i')).join('') + '</div>' : '',
      '</article>'
    ].join('');
  }

  function renderSchedulerContextItem(item) {
    const chips = [
      item && item.readiness ? schedulerReadinessChip(item.readiness) : '',
      item && item.semanticTier ? routeSemanticTierChip(item.semanticTier) : '',
      item && item.protected ? {label: t('previewObjectEditor.routeUnderstandingProtected', 'protected'), tone: 'manual'} : ''
    ].filter(Boolean);
    return [
      '<article data-route-understanding-item="scheduler">',
      '<strong>' + escapeHtml(item && (item.sceneId || item.entryMode) || '') + '</strong>',
      '<span>' + escapeHtml([item && item.tag ? '#' + item.tag : '', item && item.deckRoute || ''].filter(Boolean).join(' / ')) + '</span>',
      chips.length ? '<div class="preview-object-route-map-edge-chips">' + chips.map((chip) => renderRouteMapChip(chip, 'i')).join('') + '</div>' : '',
      '</article>'
    ].join('');
  }

  function renderUtilityCallItem(item) {
    const label = [item && item.from, item && item.utilitySceneId].filter(Boolean).join(' -> ');
    const chips = [
      item && item.utilityKind ? {label: item.utilityKind, tone: 'guided'} : '',
      item && item.returnBinding ? {label: t('previewObjectEditor.routeUnderstandingReturnBinding', 'return') + ': ' + item.returnBinding, tone: 'guided'} : '',
      item && item.semanticTier ? routeSemanticTierChip(item.semanticTier) : ''
    ].filter(Boolean);
    return [
      '<article data-route-understanding-item="utility">',
      '<strong>' + escapeHtml(label || item && item.utilitySceneId || '') + '</strong>',
      item && item.setJumpTarget ? '<span>' + escapeHtml(t('previewObjectEditor.routeUnderstandingSetJump', 'set-jump') + ': ' + item.setJumpTarget) + '</span>' : '',
      chips.length ? '<div class="preview-object-route-map-edge-chips">' + chips.map((chip) => renderRouteMapChip(chip, 'i')).join('') + '</div>' : '',
      '</article>'
    ].join('');
  }

  function renderStateDependencyItem(item) {
    const direct = ensureArray(item && item.directDependencyWrites);
    const chips = [
      item && item.opaque ? {label: t('previewObjectEditor.routeUnderstandingOpaque', 'manual JS boundary'), tone: 'manual'} : '',
      direct.length ? {label: t('previewObjectEditor.routeUnderstandingDirectWrite', 'direct pre-route write'), tone: 'warning'} : ''
    ].filter(Boolean);
    return [
      '<article data-route-understanding-item="state_dependency">',
      '<strong>' + escapeHtml(item && item.ownerId || '') + '</strong>',
      ensureArray(item && item.predicateReads).length ? '<span>' + escapeHtml(t('previewObjectEditor.routeUnderstandingReads', 'reads') + ': ' + ensureArray(item.predicateReads).slice(0, 6).join(', ')) + '</span>' : '',
      ensureArray(item && item.preRouteWrites).length ? '<span>' + escapeHtml(t('previewObjectEditor.routeUnderstandingWrites', 'writes') + ': ' + ensureArray(item.preRouteWrites).slice(0, 6).join(', ')) + '</span>' : '',
      chips.length ? '<div class="preview-object-route-map-edge-chips">' + chips.map((chip) => renderRouteMapChip(chip, 'i')).join('') + '</div>' : '',
      '</article>'
    ].join('');
  }

  function schedulerReadinessLabel(value) {
    return {
      scheduler_proven: t('previewObjectEditor.routeReadinessSchedulerProven', 'scheduler proven'),
      profile_guided: t('previewObjectEditor.routeReadinessProfileGuided', 'profile guided'),
      focused_entry_only: t('previewObjectEditor.routeReadinessFocusedEntry', 'Focused Entry only'),
      unknown_wiring: t('previewObjectEditor.routeReadinessUnknown', 'unknown wiring')
    }[String(value || '')] || String(value || '');
  }

  function routeMapReviewChips(model, graph) {
    const modelHints = graph && (graph.reviewHints || graph.routeMapReviewHints);
    if (Array.isArray(modelHints)) {
      const graphHints = ensureArray(modelHints);
      return graphHints.map((hint) => ({
        key: hint && hint.key || '',
        label: routeMapHintLabel(hint && hint.key) + ': ' + String(hint && hint.count || 0),
        tone: routeMapHintTone(hint && hint.key)
      }));
    }
    return [];
  }

  function routeMapHintLabel(key) {
    return {
      fuzzy: routeEvidenceClassLabel('fuzzy'),
      script_derived: routeEvidenceClassLabel('script_derived'),
      missing_target: routeEvidenceClassLabel('missing_target'),
      manual_boundary: scriptSafetyLabel('manual_boundary'),
      opaque_js: t('previewObjectEditor.routeMapOpaqueJs', 'Manual JS boundary'),
      route_collision: t('previewObjectEditor.routeMapCollision', 'Route collision'),
      zero_valid: t('previewObjectEditor.routeMapZeroValid', 'Zero-valid gap'),
      multi_valid_randomization: t('previewObjectEditor.routeMapMultiValid', 'Multi-valid randomization'),
      unconditional_not_fallback: t('previewObjectEditor.routeMapUnconditionalFallback', 'Unconditional is not fallback'),
      partial_blocker: t('previewObjectEditor.routeMapPartialBlocker', 'Parity repair needed'),
      diagnostics: t('previewObjectEditor.routeMapDiagnostics', 'Route diagnostics')
    }[String(key || '')] || String(key || '');
  }

  function renderEventReadiness(items) {
    const rows = ensureArray(items);
    if (!rows.length) {
      return '';
    }
    return [
      '<section class="preview-object-readiness" data-preview-object-readiness="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.installReadiness', 'Install readiness')) + '</div>',
      rows.map((item) => [
        '<article class="preview-object-readiness-item ' + (item && item.ok ? 'is-ready' : 'is-blocked') + '">',
        '<strong>' + escapeHtml(item && item.ok ? t('previewObjectEditor.ready', 'Ready') : t('previewObjectEditor.blocked', 'Blocked')) + '</strong>',
        '<span>' + escapeHtml(item && item.label || '') + '</span>',
        item && !item.ok && item.repairAction ? '<button type="button" class="preview-object-readiness-repair" data-readiness-repair-action="' + escapeAttr(item.id || '') + '" data-visible-edit-action="' + escapeAttr(encodeAction(item.repairAction)) + '" aria-label="' + escapeAttr(t('previewObjectEditor.fixReadinessAria', 'Fix this blocked checklist item')) + '">' + escapeHtml(t('previewObjectEditor.fixReadiness', 'Fix')) + '</button>' : '',
        '</article>'
      ].join('')).join(''),
      '</section>'
    ].join('');
  }

  function renderChoiceUnitSummary(choiceUnits) {
    const rows = ensureArray(choiceUnits).filter((choice) => choice && choice.id).slice(0, 12);
    if (!rows.length) {
      return '';
    }
    return [
      '<section class="preview-object-choice-units" data-preview-object-choice-units="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.choiceUnits', 'Complete choice units')) + '</div>',
      rows.map((choice) => {
        const consequences = choice && choice.consequences && choice.consequences.summary || {};
        const consequenceText = Object.keys(consequences).map((key) => effectGroupShortLabel(key) + ' ' + consequences[key]).join(' / ');
        const continuation = choice && choice.continuation || {};
        return [
          '<article data-preview-object-choice-unit="' + escapeAttr(choice.id || '') + '">',
          '<strong>' + escapeHtml(choice.label || choice.id || '') + '</strong>',
          choice.ownerSectionLabel || choice.ownerSectionId ? '<small>' + escapeHtml([choice.ownerSectionLabel, choice.ownerSectionId].filter(Boolean).join(' / ')) + '</small>' : '',
          choice.displayCondition ? '<code>' + escapeHtml(t('previewObjectEditor.displayIf', 'Display if') + ': ' + choice.displayCondition) + '</code>' : '',
          choice.chooseCondition ? '<code>' + escapeHtml(t('previewObjectEditor.chooseIf', 'Choose if') + ': ' + choice.chooseCondition) + '</code>' : '',
          choice.unavailableText ? '<span>' + escapeHtml(t('previewObjectEditor.unavailableText', 'Unavailable text') + ': ' + choice.unavailableText) + '</span>' : '',
          consequenceText ? '<span>' + escapeHtml(t('previewObjectEditor.consequences', 'Consequences') + ': ' + consequenceText) + '</span>' : '',
          continuation && continuation.label ? '<span>' + escapeHtml(t('previewObjectEditor.continuation', 'Continuation') + ': ' + continuation.label) + '</span>' : '',
          '</article>'
        ].join('');
      }).join(''),
      '</section>'
    ].join('');
  }

  function renderConsequenceGroups(groups) {
    const rows = ensureArray(groups).filter((group) => group && group.count).slice(0, 8);
    if (!rows.length) {
      return '';
    }
    return [
      '<section class="preview-object-consequence-groups" data-preview-object-consequence-groups="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.consequenceGroups', 'Consequence groups')) + '</div>',
      rows.map((group) => [
        '<article data-preview-object-consequence-group="' + escapeAttr(group.key || '') + '">',
        '<strong>' + escapeHtml(effectGroupShortLabel(group.key) || group.label || group.key || '') + '</strong>',
        '<span>' + escapeHtml(String(group.count || 0)) + '</span>',
        ensureArray(group.variables).length ? '<code>' + escapeHtml(ensureArray(group.variables).slice(0, 6).join(', ')) + '</code>' : '',
        '</article>'
      ].join('')).join(''),
      '</section>'
    ].join('');
  }

  function renderContinuationMap(map) {
    const rows = ensureArray(map && map.items).filter((item) => item && (item.choiceId || item.nextTarget)).slice(0, 10);
    if (!rows.length) {
      return '';
    }
    return [
      '<section class="preview-object-continuation-map" data-preview-object-continuation-map="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.continuationMap', 'Continuation map')) + '</div>',
      rows.map((item) => [
        '<article data-preview-object-continuation-kind="' + escapeAttr(item.kind || '') + '">',
        '<strong>' + escapeHtml(item.choiceLabel || item.choiceId || item.kind || '') + '</strong>',
        '<span>' + escapeHtml(continuationKindLabel(item.kind) + (item.nextTarget ? ': ' + item.nextTarget : '')) + '</span>',
        ensureArray(item.orderedRoutes).length > 1 ? '<small>' + escapeHtml(ensureArray(item.orderedRoutes).map((route) => [route.target, route.predicate ? 'if ' + route.predicate : 'fallback'].filter(Boolean).join(' ')).join('; ')) + '</small>' : '',
        '</article>'
      ].join('')).join(''),
      '</section>'
    ].join('');
  }

  function renderPlayabilityChecks(checks) {
    const rows = ensureArray(checks && checks.diagnostics);
    if (!rows.length) {
      return '';
    }
    return [
      '<section class="preview-object-playability" data-preview-object-playability="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.playabilityChecks', 'Playability checks')) + '</div>',
      rows.slice(0, 8).map((item) => [
        '<article class="is-' + escapeAttr(item && item.severity || 'info') + '">',
        '<strong>' + escapeHtml(playabilitySeverityLabel(item && item.severity)) + '</strong>',
        '<span>' + escapeHtml(item && item.message || item && item.code || '') + '</span>',
        '</article>'
      ].join('')).join(''),
      '</section>'
    ].join('');
  }

  function renderRouteScriptIntelligence(model) {
    const allRoutes = ensureArray(model && model.routes && model.routes.items || model && model.routeEvidenceMap && model.routeEvidenceMap.items);
    const allScripts = ensureArray(model && model.scripts && model.scripts.blocks || model && model.scriptImpactMap && model.scriptImpactMap.blocks);
    const summary = model && model.routeScriptIntelligence && model.routeScriptIntelligence.summary || {};
    const diagnostics = ensureArray(model && model.diagnostics || model && model.routeScriptIntelligence && model.routeScriptIntelligence.diagnostics).slice(0, 6);
    const routes = allRoutes.filter(routeEvidenceNeedsReview).slice(0, 8);
    const scripts = allScripts.filter(scriptImpactNeedsReview).slice(0, 8);
    if (!routes.length && !scripts.length && !diagnostics.length) {
      return '';
    }
    const open = diagnostics.some((item) => ['error', 'warning'].includes(String(item && item.severity || ''))) ||
      routes.some((route) => ['missing_target', 'fuzzy', 'script_derived'].includes(String(route && route.evidenceClass || ''))) ||
      scripts.some((block) => String(block && block.safetyClass || '') === 'manual_boundary');
    const summaryChips = routeScriptSummaryChips(diagnostics, routes, scripts);
    return [
      '<section class="preview-object-route-script" data-preview-object-route-script="true">',
      '<details' + (open ? ' open' : '') + '>',
      '<summary class="preview-object-route-script-summary preview-object-section-title"><span>' + escapeHtml(t('previewObjectEditor.routeScriptIntelligence', 'Route/script review')) + '</span>' + (summaryChips.length ? '<span class="preview-object-route-script-chips">' + summaryChips.map((chip) => '<b>' + escapeHtml(chip) + '</b>').join('') + '</span>' : '') + '</summary>',
      '<p class="preview-object-route-script-note" data-preview-object-route-script-note="true">' + escapeHtml(routeScriptPanelNote(summary, allRoutes, allScripts, routes, scripts)) + '</p>',
      diagnostics.length ? renderRouteScriptGroup(t('previewObjectEditor.routeScriptDiagnostics', 'Diagnostics'), 'route-diagnostics', diagnostics.map(renderRouteScriptDiagnostic).join('')) : '',
      routes.length ? renderRouteScriptGroup(t('previewObjectEditor.routeScriptRouteEvidence', 'Route evidence needing review'), 'route-evidence', routes.map(renderRouteEvidenceItem).join('')) : '',
      scripts.length ? renderRouteScriptGroup(t('previewObjectEditor.routeScriptScriptEvidence', 'Script impact needing review'), 'script-impact', scripts.map(renderScriptImpactItem).join('')) : '',
      '</details>',
      '</section>'
    ].join('');
  }

  function renderRouteScriptGroup(title, dataKey, content) {
    return [
      '<div class="preview-object-route-script-group" data-preview-object-' + escapeAttr(dataKey) + '="true">',
      '<h4>' + escapeHtml(title) + '</h4>',
      '<div class="preview-object-route-script-grid">' + content + '</div>',
      '</div>'
    ].join('');
  }

  function routeScriptPanelNote(summary, allRoutes, allScripts, routes, scripts) {
    const routeCount = Number(summary && summary.routeCount || allRoutes.length || 0);
    const scriptCount = Number(summary && summary.scriptBlockCount || allScripts.length || 0);
    const hiddenRoutes = Math.max(0, routeCount - routes.length);
    const hiddenScripts = Math.max(0, scriptCount - scripts.length);
    const parts = [t('previewObjectEditor.routeScriptPanelNote', 'This is a review lens, not a separate editor. It only shows conditional routes, unresolved targets, script-derived routes, or script blocks that can affect edit safety.')];
    if (hiddenRoutes || hiddenScripts) {
      parts.push(t('previewObjectEditor.routeScriptHiddenStable', 'Stable exact routes and guided simple effects are hidden here unless they affect routing.')
        .replace('{routes}', String(hiddenRoutes))
        .replace('{scripts}', String(hiddenScripts)));
    }
    return parts.join(' ');
  }

  function routeScriptSummaryChips(diagnostics, routes, scripts) {
    return [
      diagnostics.length ? t('previewObjectEditor.routeScriptDiagnostics', 'Diagnostics') + ': ' + diagnostics.length : '',
      routes.length ? t('previewObjectEditor.routeScriptRoutes', 'Routes') + ': ' + routes.length : '',
      scripts.length ? t('previewObjectEditor.routeScriptScripts', 'Scripts') + ': ' + scripts.length : ''
    ].filter(Boolean);
  }

  function routeEvidenceNeedsReview(route) {
    const value = route || {};
    const evidenceClass = String(value.evidenceClass || '');
    if (value.predicate) {
      return true;
    }
    return Boolean(evidenceClass && !['exact', 'parser_backed', 'terminal'].includes(evidenceClass));
  }

  function scriptImpactNeedsReview(block) {
    const value = block || {};
    const safety = String(value.safetyClass || '');
    if (safety && safety !== 'guided') {
      return true;
    }
    if (String(value.boundaryCategory || '') === 'opaque_js_block') {
      return true;
    }
    return ensureArray(value.boundaryReasons).length > 0;
  }

  function renderRouteScriptDiagnostic(item) {
    const value = item || {};
    return [
      '<article data-preview-object-route-diagnostic="' + escapeAttr(value.code || value.severity || 'info') + '">',
      '<strong>' + escapeHtml(playabilitySeverityLabel(value.severity || 'info')) + '</strong>',
      '<span>' + escapeHtml(value.message || value.code || '') + '</span>',
      '</article>'
    ].join('');
  }

  function renderRouteEvidenceItem(route) {
    const value = route || {};
    return [
      '<article data-preview-object-route-class="' + escapeAttr(value.evidenceClass || '') + '">',
      '<strong>' + escapeHtml(routeEvidenceClassLabel(value.evidenceClass)) + '</strong>',
      '<span>' + escapeHtml([value.from, value.target].filter(Boolean).join(' -> ') || value.rawTarget || value.target || '') + '</span>',
      value.predicate ? '<code>' + escapeHtml(value.predicate) + '</code>' : '',
      '<small data-preview-object-route-review-reason="true">' + escapeHtml(routeReviewReasonLabel(value)) + '</small>',
      value.sourceKind || value.owner ? '<small>' + escapeHtml([sourceKindLabel(value.sourceKind), value.owner].filter(Boolean).join(' / ')) + '</small>' : '',
      '</article>'
    ].join('');
  }

  function renderScriptImpactItem(block) {
    const value = block || {};
    const influence = [
      value.displayInfluence ? t('previewObjectEditor.scriptDisplayInfluence', 'display') : '',
      value.optionInfluence ? t('previewObjectEditor.scriptOptionInfluence', 'options') : '',
      value.routeInfluence ? t('previewObjectEditor.scriptRouteInfluence', 'routes') : ''
    ].filter(Boolean).join(' / ');
    return [
      '<article data-preview-object-script-class="' + escapeAttr(value.safetyClass || '') + '">',
      '<strong>' + escapeHtml(scriptSafetyLabel(value.safetyClass)) + '</strong>',
      '<span>' + escapeHtml(value.label || value.hook || value.id || '') + '</span>',
      value.boundaryCategory ? '<small>' + escapeHtml(t('previewObjectEditor.scriptCategory', 'Category') + ': ' + scriptBoundaryCategoryLabel(value.boundaryCategory)) + '</small>' : '',
      '<small data-preview-object-script-review-reason="true">' + escapeHtml(scriptReviewReasonLabel(value)) + '</small>',
      value.lineCount ? '<small>' + escapeHtml(t('previewObjectEditor.scriptLines', 'Lines') + ': ' + String(value.lineCount)) + '</small>' : '',
      ensureArray(value.writes).length ? '<code>' + escapeHtml(t('previewObjectEditor.scriptWrites', 'writes') + ': ' + ensureArray(value.writes).slice(0, 5).join(', ')) + '</code>' : '',
      influence ? '<small>' + escapeHtml(t('previewObjectEditor.scriptInfluence', 'Influence') + ': ' + influence) + '</small>' : '',
      value.rawPreview ? '<small>' + escapeHtml(String(value.rawPreview).slice(0, 180)) + '</small>' : '',
      '</article>'
    ].join('');
  }

  function renderEventGraphNode(node) {
    const value = node || {};
    const label = value.label || value.id || t('previewObjectEditor.graphNode', 'Node');
    const kind = graphKindLabel(value.kind);
    const action = graphAction(value.editAction);
    const actionAttrs = action ? ' data-visible-edit-action="' + escapeAttr(encodeAction(action)) + '"' : '';
    const title = t('previewObjectEditor.graphNodeAria', 'Edit event graph node: {label}').replace('{label}', label);
    return [
      '<article class="preview-object-event-graph-node-card is-' + escapeAttr(safeClass(value.kind || 'node')) + '">',
      '<button type="button" class="preview-object-event-graph-node is-' + escapeAttr(safeClass(value.kind || 'node')) + '" data-preview-object-event-graph-node="' + escapeAttr(value.id || '') + '" data-event-graph-clickable="node"' + actionAttrs + ' aria-label="' + escapeAttr(title) + '" title="' + escapeAttr(title) + '">',
      '<small>' + escapeHtml(kind) + '</small>',
      '<strong>' + escapeHtml(label) + '</strong>',
      value.condition ? '<span>' + escapeHtml(value.condition) + '</span>' : '',
      value.evidenceClass ? '<em>' + escapeHtml(routeEvidenceClassLabel(value.evidenceClass)) + '</em>' : '',
      '</button>',
      renderRouteMapActions(value.secondaryActions),
      '</article>'
    ].join('');
  }

  function renderEventGraphEdge(edge) {
    const value = edge || {};
    const label = [
      graphKindLabel(value.kind),
      value.targetId || value.to || ''
    ].filter(Boolean).join(' -> ');
    const action = graphAction(value.editAction);
    const actionAttrs = action ? ' data-visible-edit-action="' + escapeAttr(encodeAction(action)) + '"' : '';
    const title = t('previewObjectEditor.graphRouteAria', 'Edit event graph route: {label}').replace('{label}', label || value.kind || 'route');
    const chips = routeMapEdgeChips(value);
    const reviewClass = routeMapEdgeNeedsReview(value) ? ' is-review' : '';
    return [
      '<article class="preview-object-event-graph-edge-card">',
      '<button type="button" class="preview-object-event-graph-edge' + reviewClass + '" data-preview-object-event-graph-edge="' + escapeAttr([value.from, value.to, value.kind].filter(Boolean).join('|')) + '" data-preview-object-route-edge-id="' + escapeAttr(value.id || '') + '" data-route-map-field="' + escapeAttr(value.fieldId || '') + '" data-event-graph-clickable="edge"' + actionAttrs + ' aria-label="' + escapeAttr(title) + '" title="' + escapeAttr(title) + '">',
      '<span>' + escapeHtml(value.from || '') + '</span>',
      '<b>' + escapeHtml(graphKindLabel(value.kind)) + '</b>',
      '<strong>' + escapeHtml(value.to || value.targetId || '') + '</strong>',
      value.targetId ? '<span>' + escapeHtml(t('previewObjectEditor.routeMapTarget', 'Target') + ': ' + value.targetId) + '</span>' : '',
      value.condition ? '<code>' + escapeHtml(t('previewObjectEditor.routeMapCondition', 'Condition') + ': ' + value.condition) + '</code>' : '',
      chips.length ? '<small class="preview-object-route-map-edge-chips">' + chips.map((chip) => renderRouteMapChip(chip, 'i')).join('') + '</small>' : '',
      '</button>',
      renderRouteMapActions(value.secondaryActions),
      '</article>'
    ].join('');
  }

  function renderRouteMapActions(actions) {
    const rows = ensureArray(actions).filter((action) => action && action.editable && action.editAction && action.fieldId);
    if (!rows.length) {
      return '';
    }
    return '<div class="preview-object-route-map-actions">' + rows.map((action) => {
      const edit = graphAction(action.editAction);
      const actionAttrs = edit ? ' data-visible-edit-action="' + escapeAttr(encodeAction(edit)) + '"' : '';
      const label = action.label || graphKindLabel(action.kind || 'field');
      const value = action.value ? '<code>' + escapeHtml(action.value) + '</code>' : '';
      const title = t('previewObjectEditor.routeMapEditFieldAria', 'Edit Route Map field: {label}').replace('{label}', label);
      return [
        '<button type="button" class="preview-object-route-map-action" data-route-map-action-kind="' + escapeAttr(action.kind || '') + '" data-route-map-field="' + escapeAttr(action.fieldId || '') + '"' + actionAttrs + ' aria-label="' + escapeAttr(title) + '" title="' + escapeAttr(title) + '">',
        '<span>' + escapeHtml(label) + '</span>',
        value,
        '</button>'
      ].join('');
    }).join('') + '</div>';
  }

  function routeMapEdgeChips(edge) {
    const value = edge || {};
    return [
      value.order ? {label: t('previewObjectEditor.routeMapOrder', 'Order') + ' ' + String(value.order), tone: 'muted'} : '',
      value.evidenceClass ? evidenceClassChip(value.evidenceClass) : '',
      value.semanticTier ? routeSemanticTierChip(value.semanticTier) : '',
      value.targetResolution ? routeTargetResolutionChip(value.targetResolution) : '',
      value.dynamicBinding && value.dynamicBinding.kind ? {label: dynamicBindingLabel(value.dynamicBinding), tone: 'guided'} : '',
      value.safeEditEligible ? {label: t('previewObjectEditor.routeSafeStructured', 'safe structured'), tone: 'safe'} : '',
      value.sourceKind ? {label: sourceKindLabel(value.sourceKind), tone: 'muted'} : '',
      value.installSafety ? safetyChip(value.installSafety) : ''
    ].filter(Boolean);
  }

  function routeMapEdgeNeedsReview(edge) {
    const evidence = String(edge && edge.evidenceClass || '');
    const safety = String(edge && edge.installSafety || '');
    const tier = String(edge && edge.semanticTier || '');
    return Boolean(evidence && !['draft', 'exact', 'parser_backed', 'terminal', 'source_backed'].includes(evidence)) ||
      Boolean(tier && tier !== 'static_exact') ||
      safety === 'manual_review';
  }

  function routeSemanticTierLabel(value) {
    return {
      static_exact: t('previewObjectEditor.routeTierStatic', 'static exact'),
      guided_profile: t('previewObjectEditor.routeTierGuided', 'guided/profile'),
      runtime_observed: t('previewObjectEditor.routeTierRuntime', 'runtime observed'),
      manual_boundary: t('previewObjectEditor.routeTierManual', 'manual boundary')
    }[String(value || '')] || String(value || '');
  }

  function routeSemanticTierChip(value) {
    const tier = String(value || '');
    return {
      label: routeSemanticTierLabel(tier),
      tone: tier === 'static_exact' ? 'safe' : tier === 'runtime_observed' ? 'runtime' : tier === 'manual_boundary' ? 'manual' : 'guided'
    };
  }

  function routeTargetResolutionLabel(resolution) {
    const value = resolution || {};
    const status = String(value.status || '');
    if (!status) {
      return '';
    }
    if (value.shadowed) {
      return t('previewObjectEditor.routeTargetShadowed', 'target: shadowed');
    }
    if (value.ambiguous || status === 'ambiguous') {
      return t('previewObjectEditor.routeTargetAmbiguous', 'target: ambiguous');
    }
    if (status === 'missing') {
      return t('previewObjectEditor.routeTargetMissing', 'target: missing');
    }
    if (status === 'resolved') {
      const scope = String(value.scope || '').replace(/_/g, ' ');
      return t('previewObjectEditor.routeTargetResolved', 'target: {scope}').replace('{scope}', scope || 'resolved');
    }
    if (/^dynamic/.test(status)) {
      return t('previewObjectEditor.routeTargetDynamic', 'target: dynamic');
    }
    if (/jump|return/.test(status)) {
      return t('previewObjectEditor.routeTargetReturn', 'target: return');
    }
    return t('previewObjectEditor.routeTargetStatus', 'target: {status}').replace('{status}', status.replace(/_/g, ' '));
  }

  function routeTargetResolutionChip(resolution) {
    const value = resolution || {};
    const status = String(value.status || '');
    let tone = 'muted';
    if (value.shadowed || value.ambiguous || status === 'ambiguous' || status === 'missing') {
      tone = 'warning';
    } else if (status === 'resolved') {
      tone = 'safe';
    } else if (/^dynamic/.test(status) || /jump|return|profile/.test(status)) {
      tone = 'guided';
    }
    return {label: routeTargetResolutionLabel(value), tone};
  }

  function routeGuidedEditKindLabel(value) {
    return {
      utility_pair: t('previewObjectEditor.routeGuidedUtilityPair', 'Utility pair'),
      route_table_binding: t('previewObjectEditor.routeGuidedRouteTable', 'Route table'),
      explicit_fallback_helper: t('previewObjectEditor.routeGuidedFallback', 'Explicit fallback')
    }[String(value || '')] || String(value || '');
  }

  function routeGuidedEditKindChip(value) {
    return {label: routeGuidedEditKindLabel(value), tone: 'accent'};
  }

  function routeGuidedEditRank(left, right) {
    const rank = (entry) => {
      if (!entry) {
        return 99;
      }
      if (entry.safeEditEligible && entry.kind === 'explicit_fallback_helper') {
        return 0;
      }
      if (entry.safeEditEligible) {
        return 1;
      }
      if (entry.semanticTier === 'guided_profile') {
        return 2;
      }
      if (entry.semanticTier === 'runtime_observed') {
        return 3;
      }
      return 4;
    };
    return rank(left) - rank(right);
  }

  function dynamicBindingLabel(binding) {
    const value = binding || {};
    const count = ensureArray(value.candidateTargets).length;
    const base = {
      go_to_ref: t('previewObjectEditor.routeBindingGoToRef', 'go-to-ref'),
      route_quality_write: t('previewObjectEditor.routeBindingQualityWrite', 'Q route write'),
      profile_route_table: t('previewObjectEditor.routeBindingProfileTable', 'profile route table'),
      script_route_hint: t('previewObjectEditor.routeBindingScriptHint', 'script route hint'),
      set_jump: t('previewObjectEditor.routeBindingSetJump', 'set-jump')
    }[String(value.kind || '')] || String(value.kind || '');
    return count ? base + ' ' + String(count) : base;
  }

  function evidenceClassChip(value) {
    const evidence = String(value || '');
    return {
      label: routeEvidenceClassLabel(evidence),
      tone: /missing|fuzzy|manual|opaque|collision/.test(evidence) ? 'warning' : /script|profile|guided/.test(evidence) ? 'guided' : 'muted'
    };
  }

  function schedulerReadinessChip(value) {
    const readiness = String(value || '');
    return {
      label: schedulerReadinessLabel(readiness),
      tone: readiness === 'scheduler_proven' ? 'safe' : readiness === 'profile_guided' ? 'guided' : readiness === 'focused_entry_only' ? 'runtime' : 'warning'
    };
  }

  function safetyChip(value) {
    const safety = String(value || '');
    return {
      label: safetyLabel(safety),
      tone: /guarded|safe/.test(safety) ? 'safe' : /advanced|guided/.test(safety) ? 'guided' : /manual|blocked|review/.test(safety) ? 'manual' : 'muted'
    };
  }

  function routeMapHintTone(key) {
    const value = String(key || '');
    if (/zero|collision|multi_valid|unconditional|diagnostic|missing|fuzzy|opaque|manual|partial/.test(value)) {
      return 'warning';
    }
    if (/script|guided|profile/.test(value)) {
      return 'guided';
    }
    return 'muted';
  }

  function renderRouteMapChip(chip, tag, attrs) {
    const value = chip && typeof chip === 'object' ? chip : {label: chip};
    const label = String(value && value.label || '');
    if (!label) {
      return '';
    }
    const tone = String(value && value.tone || chipToneFromLabel(label) || 'muted').replace(/[^a-z0-9_-]/gi, '');
    const element = tag || 'i';
    const extra = attrs ? ' ' + attrs : '';
    return '<' + element + ' class="preview-object-route-chip is-' + escapeAttr(tone) + '"' + extra + '>' + escapeHtml(label) + '</' + element + '>';
  }

  function chipToneFromLabel(label) {
    const value = String(label || '').toLowerCase();
    if (/safe|static exact|guarded|scheduler proven|靜態|安全|精確/.test(value)) {
      return 'safe';
    }
    if (/runtime|focused entry|observed|觀察/.test(value)) {
      return 'runtime';
    }
    if (/manual|missing|ambiguous|shadowed|collision|zero|not fallback|opaque|protected|手動|歧義|遮蔽|缺失|受保護/.test(value)) {
      return 'warning';
    }
    if (/guided|profile|dynamic|return|utility|route table|引導|動態|返回/.test(value)) {
      return 'guided';
    }
    return 'muted';
  }

  function graphAction(action) {
    return action && typeof action === 'object' && action.actionKind ? action : null;
  }

  function graphKindLabel(kind) {
    const value = String(kind || '').trim();
    return {
      opening: t('previewObjectEditor.graphOpening', 'Opening'),
      root_option: t('previewObjectEditor.graphRootOption', 'Root option'),
      section_option: t('previewObjectEditor.graphSectionOption', 'Section option'),
      result_section: t('previewObjectEditor.graphResultSection', 'Result section'),
      follow_up_section: t('previewObjectEditor.graphFollowUpSection', 'Follow-up section'),
      conditional_section: t('previewObjectEditor.graphConditionalSection', 'Conditional section'),
      trigger_effect: t('previewObjectEditor.graphTriggerEffect', 'Trigger effect'),
      option_effect: t('previewObjectEditor.graphOptionEffect', 'Option effect'),
      section_effect: t('previewObjectEditor.graphSectionEffect', 'Section effect'),
      variable: t('previewObjectEditor.graphVariable', 'Variable'),
      route_source: t('previewObjectEditor.graphRouteSource', 'Route source'),
      route_target: t('previewObjectEditor.graphRouteTarget', 'Route target'),
      missing_route_target: t('previewObjectEditor.graphMissingRouteTarget', 'Missing route target'),
      choice: t('previewObjectEditor.graphChoice', 'Choice'),
      result_route: t('previewObjectEditor.graphResultRoute', 'Result route'),
      return_route: t('previewObjectEditor.graphReturnRoute', 'Return route'),
      exit_route: t('previewObjectEditor.graphExitRoute', 'Exit route'),
      evidence_route: t('previewObjectEditor.graphEvidenceRoute', 'Evidence route'),
      fuzzy_route: t('previewObjectEditor.graphFuzzyRoute', 'Approximate route'),
      script_route: t('previewObjectEditor.graphScriptRoute', 'Script-derived route'),
      dynamic_route: t('previewObjectEditor.graphDynamicRoute', 'Dynamic route'),
      jump_route: t('previewObjectEditor.graphJumpRoute', 'Jump/return target'),
      missing_route: t('previewObjectEditor.graphMissingRoute', 'Missing-target route'),
      external_route: t('previewObjectEditor.graphExternalRoute', 'External route'),
      terminal_route: t('previewObjectEditor.graphTerminalRoute', 'Terminal route')
    }[value] || value.replace(/_/g, ' ') || t('previewObjectEditor.graphNode', 'Node');
  }

  function continuationKindLabel(kind) {
    return {
      direct_route: t('previewObjectEditor.directRoute', 'Direct route'),
      conditional_route: t('previewObjectEditor.conditionalRoute', 'Conditional route'),
      ordered_conditional_route: t('previewObjectEditor.orderedConditionalRoute', 'Conditional route group'),
      menu_return: t('previewObjectEditor.menuReturn', 'Menu return'),
      terminal_branch: t('previewObjectEditor.terminalBranch', 'Terminal branch'),
      script_or_external_boundary: t('previewObjectEditor.scriptBoundary', 'Script or external boundary')
    }[String(kind || '')] || String(kind || '');
  }

  function effectGroupShortLabel(key) {
    return {
      public_support: t('previewObjectEditor.effectPublicSupport', 'Public'),
      factions_parties: t('previewObjectEditor.effectFactions', 'Factions'),
      government: t('previewObjectEditor.effectGovernment', 'Government'),
      economy: t('previewObjectEditor.effectEconomy', 'Economy'),
      time_election: t('previewObjectEditor.effectTimeElection', 'Time/election'),
      flags_state: t('previewObjectEditor.effectFlags', 'Flags'),
      raw_advanced: t('previewObjectEditor.effectRaw', 'Raw')
    }[String(key || '')] || String(key || '');
  }

  function playabilitySeverityLabel(value) {
    return {
      error: t('previewObjectEditor.playabilityError', 'Error'),
      warning: t('previewObjectEditor.playabilityWarning', 'Warning'),
      info: t('previewObjectEditor.playabilityInfo', 'Info')
    }[String(value || '')] || String(value || '');
  }

  function routeEvidenceClassLabel(value) {
    return {
      draft: t('previewObjectEditor.routeDraft', 'Draft'),
      source_backed: t('previewObjectEditor.routeSourceBacked', 'Source-backed'),
      exact: t('previewObjectEditor.routeExact', 'Exact'),
      parser_backed: t('previewObjectEditor.routeParserBacked', 'Parser-backed'),
      fuzzy: t('previewObjectEditor.routeFuzzy', 'Approximate'),
      script_derived: t('previewObjectEditor.routeScriptDerived', 'Script-derived'),
      missing_target: t('previewObjectEditor.routeMissing', 'Missing target'),
      terminal: t('previewObjectEditor.routeTerminal', 'Terminal/root'),
      external: t('previewObjectEditor.routeExternal', 'External')
    }[String(value || '')] || String(value || '');
  }

  function routeReviewReasonLabel(route) {
    const value = route || {};
    const klass = String(value.evidenceClass || '');
    if (value.predicate) {
      return t('previewObjectEditor.routeReasonPredicate', 'Shown because this route has a predicate; target edits must preserve its condition.');
    }
    if (klass === 'missing_target') {
      return t('previewObjectEditor.routeReasonMissing', 'Shown because the target could not be resolved from the current index.');
    }
    if (klass === 'script_derived') {
      return t('previewObjectEditor.routeReasonScript', 'Shown because routing was inferred from script evidence.');
    }
    if (klass === 'fuzzy') {
      return t('previewObjectEditor.routeReasonFuzzy', 'Shown because the target match is approximate.');
    }
    return t('previewObjectEditor.routeReasonBoundary', 'Shown as route evidence that can affect edit safety.');
  }

  function scriptReviewReasonLabel(block) {
    const value = block || {};
    const safety = String(value.safetyClass || '');
    if (safety === 'manual_boundary') {
      return t('previewObjectEditor.scriptReasonManual', 'Shown because this script crosses a manual review boundary.');
    }
    if (String(value.boundaryCategory || '') === 'opaque_js_block') {
      return t('previewObjectEditor.scriptReasonOpaque', 'Shown because this is an opaque JavaScript block.');
    }
    if (value.routeInfluence) {
      return t('previewObjectEditor.scriptReasonRoute', 'Shown because the script may influence route selection.');
    }
    if (safety === 'advanced_review') {
      return t('previewObjectEditor.scriptReasonAdvanced', 'Shown because this script needs advanced source review before edits.');
    }
    return t('previewObjectEditor.scriptReasonBoundary', 'Shown because this script affects edit safety.');
  }

  function sourceKindLabel(value) {
    return {
      draft: t('previewObjectEditor.routeSourceDraft', 'draft'),
      source: t('previewObjectEditor.routeSourceSource', 'source'),
      manual: t('previewObjectEditor.routeSourceManual', 'manual'),
      flow: t('previewObjectEditor.routeSourceFlow', 'flow'),
      field: t('previewObjectEditor.routeSourceField', 'field'),
      continuation: t('previewObjectEditor.routeSourceContinuation', 'continuation'),
      script: t('previewObjectEditor.routeSourceScript', 'script'),
      explicit: t('previewObjectEditor.routeSourceExplicit', 'explicit')
    }[String(value || '')] || String(value || '');
  }

  function safetyLabel(value) {
    return {
      guarded_apply: t('previewObjectEditor.routeSafetyGuarded', 'guarded'),
      advanced_apply: t('previewObjectEditor.routeSafetyAdvanced', 'advanced'),
      manual_review: t('previewObjectEditor.routeSafetyManual', 'manual')
    }[String(value || '')] || String(value || '');
  }

  function scriptSafetyLabel(value) {
    return {
      guided: t('previewObjectEditor.scriptGuided', 'Guided'),
      advanced_review: t('previewObjectEditor.scriptAdvanced', 'Advanced'),
      manual_boundary: t('previewObjectEditor.scriptManual', 'Manual boundary')
    }[String(value || '')] || String(value || '');
  }

  function scriptBoundaryCategoryLabel(value) {
    return {
      simple_state_effect: t('previewObjectEditor.scriptCategorySimple', 'simple effect'),
      calculated_value: t('previewObjectEditor.scriptCategoryCalculated', 'calculated value'),
      unsupported_operator: t('previewObjectEditor.scriptCategoryOperator', 'unsupported operator'),
      complex_condition: t('previewObjectEditor.scriptCategoryCondition', 'complex condition'),
      control_flow_or_block: t('previewObjectEditor.scriptCategoryControlFlow', 'control flow'),
      runtime_or_function_side_effect: t('previewObjectEditor.scriptCategoryRuntime', 'runtime call'),
      dynamic_key_write: t('previewObjectEditor.scriptCategoryDynamicKey', 'dynamic key'),
      opaque_js_block: t('previewObjectEditor.scriptCategoryOpaque', 'raw JS block'),
      unparsed_statement: t('previewObjectEditor.scriptCategoryUnparsed', 'unparsed statement')
    }[String(value || '')] || String(value || '');
  }

  function encodeAction(action) {
    try {
      return JSON.stringify(action || {});
    } catch (_err) {
      return '{}';
    }
  }

  function safeClass(value) {
    return String(value || 'item').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
