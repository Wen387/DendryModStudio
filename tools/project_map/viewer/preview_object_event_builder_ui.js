(function initProjectMapPreviewObjectEventBuilder(global) {
  'use strict';

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

  function renderEventGraphSummary(graph) {
    if (!graph || !ensureArray(graph.nodes).length) {
      return '';
    }
    const nodes = ensureArray(graph.nodes);
    const edges = ensureArray(graph.edges);
    return [
      '<section class="preview-object-event-graph" data-preview-object-event-graph="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.eventGraph', 'Event graph')) + '</div>',
      '<div class="preview-object-event-graph-row">',
      '<strong>' + escapeHtml(String(graph.nodeCount || nodes.length)) + '</strong><span>' + escapeHtml(t('previewObjectEditor.graphNodes', 'nodes')) + '</span>',
      '<strong>' + escapeHtml(String(graph.edgeCount || edges.length)) + '</strong><span>' + escapeHtml(t('previewObjectEditor.graphRoutes', 'routes')) + '</span>',
      '</div>',
      '<div class="preview-object-event-graph-grid" data-workflow-entry="event_graph_node">',
      nodes.map(renderEventGraphNode).join(''),
      '</div>',
      edges.length ? '<div class="preview-object-event-graph-routes" data-workflow-entry="event_graph_edge">' + edges.map(renderEventGraphEdge).join('') + '</div>' : '',
      '</section>'
    ].join('');
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
    const routes = ensureArray(model && model.routes && model.routes.items || model && model.routeEvidenceMap && model.routeEvidenceMap.items).slice(0, 8);
    const scripts = ensureArray(model && model.scripts && model.scripts.blocks || model && model.scriptImpactMap && model.scriptImpactMap.blocks).slice(0, 8);
    if (!routes.length && !scripts.length) {
      return '';
    }
    return [
      '<section class="preview-object-route-script" data-preview-object-route-script="true">',
      '<div class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.routeScriptIntelligence', 'Route and script intelligence')) + '</div>',
      routes.length ? '<div class="preview-object-route-script-grid" data-preview-object-route-evidence="true">' + routes.map(renderRouteEvidenceItem).join('') + '</div>' : '',
      scripts.length ? '<div class="preview-object-route-script-grid" data-preview-object-script-impact="true">' + scripts.map(renderScriptImpactItem).join('') + '</div>' : '',
      '</section>'
    ].join('');
  }

  function renderRouteEvidenceItem(route) {
    const value = route || {};
    return [
      '<article data-preview-object-route-class="' + escapeAttr(value.evidenceClass || '') + '">',
      '<strong>' + escapeHtml(routeEvidenceClassLabel(value.evidenceClass)) + '</strong>',
      '<span>' + escapeHtml([value.from, value.target].filter(Boolean).join(' -> ') || value.rawTarget || value.target || '') + '</span>',
      value.predicate ? '<code>' + escapeHtml(value.predicate) + '</code>' : '',
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
      '<button type="button" class="preview-object-event-graph-node is-' + escapeAttr(safeClass(value.kind || 'node')) + '" data-preview-object-event-graph-node="' + escapeAttr(value.id || '') + '" data-event-graph-clickable="node"' + actionAttrs + ' aria-label="' + escapeAttr(title) + '" title="' + escapeAttr(title) + '">',
      '<small>' + escapeHtml(kind) + '</small>',
      '<strong>' + escapeHtml(label) + '</strong>',
      value.condition ? '<span>' + escapeHtml(value.condition) + '</span>' : '',
      '</button>'
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
    return [
      '<button type="button" class="preview-object-event-graph-edge" data-preview-object-event-graph-edge="' + escapeAttr([value.from, value.to, value.kind].filter(Boolean).join('|')) + '" data-event-graph-clickable="edge"' + actionAttrs + ' aria-label="' + escapeAttr(title) + '" title="' + escapeAttr(title) + '">',
      '<span>' + escapeHtml(value.from || '') + '</span>',
      '<b>' + escapeHtml(graphKindLabel(value.kind)) + '</b>',
      '<span>' + escapeHtml(value.to || value.targetId || '') + '</span>',
      '</button>'
    ].join('');
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
      choice: t('previewObjectEditor.graphChoice', 'Choice'),
      result_route: t('previewObjectEditor.graphResultRoute', 'Result route'),
      return_route: t('previewObjectEditor.graphReturnRoute', 'Return route'),
      exit_route: t('previewObjectEditor.graphExitRoute', 'Exit route')
    }[value] || value.replace(/_/g, ' ') || t('previewObjectEditor.graphNode', 'Node');
  }

  function continuationKindLabel(kind) {
    return {
      direct_route: t('previewObjectEditor.directRoute', 'Direct route'),
      conditional_route: t('previewObjectEditor.conditionalRoute', 'Conditional route'),
      ordered_conditional_route: t('previewObjectEditor.orderedConditionalRoute', 'Ordered conditional route'),
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
      exact: t('previewObjectEditor.routeExact', 'Exact'),
      parser_backed: t('previewObjectEditor.routeParserBacked', 'Parser-backed'),
      fuzzy: t('previewObjectEditor.routeFuzzy', 'Approximate'),
      script_derived: t('previewObjectEditor.routeScriptDerived', 'Script-derived'),
      missing_target: t('previewObjectEditor.routeMissing', 'Missing target'),
      terminal: t('previewObjectEditor.routeTerminal', 'Terminal/root'),
      external: t('previewObjectEditor.routeExternal', 'External')
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

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeClass(value) {
    return String(value || 'item').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
