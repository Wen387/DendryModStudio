// @ts-check
(function initProjectMapExistingSceneStructureOperations(global) {
  'use strict';

  const ROUTE_TARGET_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

  /**
   * @typedef {import('../types/project_map_contracts').ExistingSceneStructureOperationsApi} ExistingSceneStructureOperationsApi
   * @typedef {import('../types/project_map_contracts').ExistingSceneStructureOperationsFactory} ExistingSceneStructureOperationsFactory
   * @typedef {import('../types/project_map_contracts').SourceRef} SourceRef
   */

  /**
   * @param {Record<string, any>} deps
   * @returns {ExistingSceneStructureOperationsApi}
   */
  function create(deps) {
    const helpers = deps || {};
    const sourceRef = typeof helpers.sourceRef === 'function' ? helpers.sourceRef : defaultSourceRef;
    const baseFieldChange = typeof helpers.baseFieldChange === 'function' ? helpers.baseFieldChange : defaultBaseFieldChange;
    const isProtectedRouterPath = typeof helpers.isProtectedRouterPath === 'function' ? helpers.isProtectedRouterPath : () => false;
    const normalizeStructuralEffect = typeof helpers.normalizeStructuralEffect === 'function'
      ? helpers.normalizeStructuralEffect
      : defaultNormalizeStructuralEffect;

    return {
      advancedRemoveLayerChange,
      advancedRerouteLayerChanges,
      classifyChange,
      normalizeStructureAction,
      sourceSupportsAdvancedOptionDelete,
      sourceSupportsAdvancedSectionDelete,
      sourceSupportsAdvancedRouteDelete,
      sourceSupportsAdvancedRouteReroute,
      structureActionFallbackText,
      structureActionReviewPolicy,
      routeLineReplacement,
      routeClauseDeleteReplacement
    };

    function classifyChange(changeInput) {
      const value = isObject(changeInput) ? changeInput : {};
      const source = sourceRef(value.source || {});
      const operationType = String(value.operationType || '');
      const editability = String(value.editability || 'manual_review');
      const path = String(source.path || '').replace(/\\/g, '/');
      const line = Number(source.line || source.startLine || 0);
      const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
      const before = String(value.before || value.anchorText || source.anchorText || '').trim();
      const after = String(value.after === undefined || value.after === null ? '' : value.after).trim();
      const allowEmpty = Boolean(value.allowEmptyReplace || value.deletesSourceLine);
      const sourceBacked = Boolean(
        path.startsWith('source/scenes/') &&
        path.endsWith('.scene.dry') &&
        !isProtectedRouterPath(path) &&
        Number.isInteger(line) &&
        line > 0
      );
      if (!sourceBacked) {
        return operationSummary('manual_review', operationType || 'manual_snippet', editability, false, 'No exact editable source line is available.');
      }
      if (editability === 'manual_review' || operationType === 'manual_snippet') {
        return operationSummary('manual_review', operationType || 'manual_snippet', editability, true, 'The field is explicitly marked for manual review.');
      }
      if (operationType === 'replace_text') {
        const singleLine = !Number.isInteger(endLine) || endLine <= 0 || endLine === line;
        if (singleLine && before && (after || allowEmpty)) {
          return operationSummary(editability === 'advanced_source_patch' ? 'advanced_apply' : 'guarded_apply', operationType, editability, true, 'Exact single-line source evidence can be checked before replacement.');
        }
      }
      if (operationType === 'insert_text') {
        if (before && (after || String(value.content || '').trim())) {
          return operationSummary(editability === 'advanced_source_patch' ? 'advanced_apply' : 'guarded_apply', operationType, editability, true, 'Exact insert anchor can be checked before insertion.');
        }
      }
      if (operationType === 'replace_section') {
        if (Number.isInteger(endLine) && endLine >= line && before && String(value.endAnchorText || source.endAnchorText || '').trim() && (after || allowEmpty)) {
          return operationSummary(editability === 'advanced_source_patch' ? 'advanced_apply' : 'guarded_apply', operationType, editability, true, 'Exact source section anchors can be checked before replacement.');
        }
      }
      if (editability === 'advanced_source_patch') {
        return operationSummary('advanced_apply', operationType || 'replace_text', editability, true, 'Source-backed advanced patch requires Review & Apply confirmation.');
      }
      return operationSummary('manual_review', operationType || 'manual_snippet', editability, true, 'The change shape is not precise enough for automatic source editing.');
    }

    function operationSummary(status, operationType, editability, sourceBacked, reason) {
      return {
        status,
        operationType,
        editability,
        sourceBacked,
        reason
      };
    }

    function normalizeStructureAction(value) {
      const text = String(value || '').trim();
      return text === 'add_section' ? 'add_branch' : text === 'remove_section' ? 'remove_layer' : text;
    }

    function structureActionReviewPolicy(field) {
      const action = normalizeStructureAction(field && field.structureAction);
      const sourceBlock = isObject(field && field.structureSourceBlock) ? field.structureSourceBlock : {};
      if (action === 'add_option' || action === 'add_option_effect' || action === 'add_trigger_effect') {
        return {status: 'guarded_apply', reason: 'Simple insertions can be guarded when their source anchor is exact.'};
      }
      if (action === 'remove_option_condition' || action === 'remove_effect') {
        return {status: 'guarded_apply', reason: 'Single-line removals can be guarded when exact source evidence is available.'};
      }
      if (action === 'remove_option' && String(sourceBlock.kind || '') === 'option_line_delete') {
        return {status: 'guarded_apply', reason: 'A standalone option line can be deleted directly when it has no result fallout.'};
      }
      if (action === 'add_branch') {
        return {status: 'guarded_apply', reason: 'A new follow-up section is a single anchored insertion with a strictly validated body.'};
      }
      if (action === 'remove_option' || action === 'remove_layer' || action === 'reroute_layer') {
        return {status: 'advanced_apply', reason: 'Layer and reroute edits may affect multiple source spans and need advanced review.'};
      }
      return {status: 'manual_review', reason: 'This structure action does not have a supported source operation yet.'};
    }

    function structureActionFallbackText(field, afterText) {
      const action = normalizeStructureAction(field && field.structureAction);
      const target = String(field && (field.structureTargetLabel || field.optionId || field.sectionId) || '').trim();
      if (action === 'add_trigger_effect') {
        return ['Add trigger effect to this object:', normalizeStructuralEffect(afterText)].join('\n');
      }
      if (action === 'add_option_effect') {
        return ['Add option effect' + (target ? ' for ' + target : '') + ':', normalizeStructuralEffect(afterText)].join('\n');
      }
      if (action === 'add_option') {
        return [
          'Add option and result layer proposal:',
          String(afterText || ''),
          '',
          'Review the option line, target section id, result text, route target, prerequisite, unavailable text, and any effects together.'
        ].join('\n');
      }
      if (action === 'add_branch') {
        return [
          'Add conditional or follow-up layer proposal:',
          String(afterText || ''),
          '',
          'Review section id, condition, ordering, nested routes, and consumed/written variables together.'
        ].join('\n');
      }
      if (action === 'reroute_layer') {
        return [
          'Reroute incoming go-to lines to:',
          String(afterText || ''),
          '',
          'Review each incoming route line before applying this retargeting.'
        ].join('\n');
      }
      if (action === 'remove_option_condition') {
        return 'Remove prerequisite' + (target ? ' from ' + target : '') + ' after checking unavailable text and route fallout.';
      }
      if (action === 'remove_option') {
        return 'Remove option' + (target ? ': ' + target : '') + ' after checking its result section, effects, incoming references, and unavailable text.';
      }
      if (action === 'remove_effect') {
        return 'Remove effect' + (target ? ' for ' + target : '') + ' after checking variable consumers and adjacent route logic.';
      }
      if (action === 'remove_layer') {
        return 'Remove this composite layer after checking nested options, routes, effects, variables, and incoming references.';
      }
      return String(afterText || '');
    }

    function advancedRemoveLayerChange(field) {
      const sourceBlock = isObject(field && field.structureSourceBlock) ? field.structureSourceBlock : {};
      const kind = String(sourceBlock.kind || '');
      if (kind === 'layer_bundle_delete') {
        return advancedRemoveLayerBundleChanges(field, sourceBlock);
      }
      if (kind !== 'layer_section_delete' && kind !== 'layer_text_delete') {
        return null;
      }
      const sectionSource = sourceRef(sourceBlock.sectionSource || field && field.source || {});
      if (!sourceSupportsAdvancedLayerDelete(sectionSource, {requireSectionHeader: kind === 'layer_section_delete'})) {
        return null;
      }
      return sectionDeleteChange(field, sectionSource, {
        fieldId: field.id,
        label: 'Remove layer: ' + (field.structureTargetLabel || field.sectionId || ''),
        sectionId: field.sectionId || sourceBlock.sectionId || ''
      });
    }

    function advancedRerouteLayerChanges(field, afterText) {
      const sourceBlock = isObject(field && field.structureSourceBlock) ? field.structureSourceBlock : {};
      if (String(sourceBlock.kind || '') !== 'incoming_route_reroute') {
        return null;
      }
      const nextTarget = String(afterText || '').trim().replace(/^[@#]/, '');
      if (!ROUTE_TARGET_RE.test(nextTarget)) {
        return null;
      }
      const oldTarget = String(sourceBlock.oldTarget || '').trim().replace(/^[@#]/, '');
      if (oldTarget && nextTarget === oldTarget) {
        return [];
      }
      const changes = [];
      ensureArray(sourceBlock.incomingRouteSources).map(sourceRef).forEach((routeSource, index) => {
        const anchor = String(routeSource.anchorText || '').trim();
        const after = routeLineReplacement(anchor, nextTarget);
        if (!sourceSupportsAdvancedRouteReroute(routeSource) || !after) {
          return;
        }
        const routeChange = baseFieldChange(Object.assign({}, field, {
          id: field.id + '__reroute_' + (index + 1),
          source: routeSource
        }), anchor, after);
        routeChange.editability = 'advanced_source_patch';
        routeChange.operationType = 'replace_text';
        routeChange.dedupeSearch = anchor;
        routeChange.label = 'Reroute incoming route: ' + anchor;
        changes.push(routeChange);
      });
      return changes.length === ensureArray(sourceBlock.incomingRouteSources).length ? changes : null;
    }

    function advancedRemoveLayerBundleChanges(field, sourceBlock) {
      const sectionSource = sourceRef(sourceBlock.sectionSource || field && field.source || {});
      if (!sourceSupportsAdvancedLayerDelete(sectionSource, {requireSectionHeader: true})) {
        return null;
      }
      const changes = [];
      ensureArray(sourceBlock.incomingOptionSources).map(sourceRef).forEach((optionSource, index) => {
        const anchor = String(optionSource.anchorText || '').trim();
        if (!sourceSupportsAdvancedOptionDelete(optionSource) || !anchor) {
          return;
        }
        const optionId = ensureArray(sourceBlock.incomingOptionIds)[index] || field.optionId || '';
        const optionChange = baseFieldChange(Object.assign({}, field, {
          id: field.id + '__incoming_option_' + (index + 1),
          optionId,
          source: optionSource
        }), anchor, '');
        optionChange.editability = 'advanced_source_patch';
        optionChange.operationType = 'replace_text';
        optionChange.allowEmptyReplace = true;
        optionChange.deletesSourceLine = true;
        optionChange.dedupeSearch = anchor;
        changes.push(optionChange);
      });
      ensureArray(sourceBlock.incomingRouteSources).map(routeSourceRef).forEach((routeSource, index) => {
        const anchor = String(routeSource.anchorText || '').trim();
        if (!anchor) {
          return;
        }
        let after = '';
        if (!sourceSupportsAdvancedRouteDelete(routeSource)) {
          const clause = routeClauseDeleteReplacement(anchor, routeSource.target, routeSource.condition);
          if (!clause.ok) {
            return;
          }
          after = clause.line;
        }
        const routeChange = baseFieldChange(Object.assign({}, field, {
          id: field.id + '__incoming_route_' + (index + 1),
          source: routeSource
        }), anchor, after);
        routeChange.editability = 'advanced_source_patch';
        routeChange.operationType = 'replace_text';
        routeChange.allowEmptyReplace = !String(after || '').trim();
        routeChange.deletesSourceLine = !String(after || '').trim();
        routeChange.dedupeSearch = anchor;
        routeChange.label = 'Remove incoming route: ' + (routeSource.target || anchor);
        changes.push(routeChange);
      });
      const parentChange = sectionDeleteChange(field, sectionSource, {
        fieldId: field.id + '__section',
        label: 'Remove layer section: ' + (field.structureTargetLabel || field.sectionId || ''),
        sectionId: field.sectionId || sourceBlock.sectionId || ''
      });
      if (!parentChange) {
        return null;
      }
      const childChanges = [];
      ensureArray(sourceBlock.childSectionSources).map(sourceRef).forEach((childSource, index) => {
        const childChange = sectionDeleteChange(field, childSource, {
          fieldId: field.id + '__child_section_' + (index + 1),
          label: 'Remove nested result section: ' + (ensureArray(sourceBlock.childSectionIds)[index] || ''),
          sectionId: ensureArray(sourceBlock.childSectionIds)[index] || ''
        });
        if (childChange) {
          childChanges.push(childChange);
        }
      });
      changes.push(...childChanges, parentChange);
      changes.sort(layerBundleDeleteOrder);
      const expected = 1 + ensureArray(sourceBlock.incomingOptionSources).length +
        ensureArray(sourceBlock.incomingRouteSources).length +
        ensureArray(sourceBlock.childSectionSources).length;
      return changes.length === expected ? changes : null;
    }

    function sectionDeleteChange(field, sourceInput, overrides) {
      const source = sourceRef(sourceInput || {});
      if (!sourceSupportsAdvancedLayerDelete(source, {requireSectionHeader: true})) {
        return null;
      }
      const anchor = String(source.anchorText || '').trim();
      const endAnchor = String(source.endAnchorText || '').trim();
      const before = anchor + (endAnchor && endAnchor !== anchor ? '\n...\n' + endAnchor : '');
      return {
        fieldId: overrides && overrides.fieldId || field.id,
        role: field.role || 'structure',
        label: overrides && overrides.label || ('Remove layer: ' + (field.structureTargetLabel || field.sectionId || '')),
        sectionId: overrides && overrides.sectionId || field.sectionId || '',
        optionId: field.optionId || '',
        source,
        editability: 'advanced_source_patch',
        operationType: 'replace_section',
        anchorText: anchor,
        endAnchorText: endAnchor,
        startLine: source.line || source.startLine || null,
        endLine: source.endLine || null,
        dedupeSearch: anchor,
        allowEmptyReplace: true,
        deletesSourceLine: true,
        before,
        after: ''
      };
    }

    function sourceSupportsAdvancedOptionDelete(sourceInput) {
      const source = sourceRef(sourceInput || {});
      const path = String(source.path || '').replace(/\\/g, '/');
      const line = Number(source.line || source.startLine || 0);
      const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
      return Boolean(
        path.startsWith('source/scenes/') &&
        path.endsWith('.scene.dry') &&
        !isProtectedRouterPath(path) &&
        Number.isInteger(line) &&
        line > 0 &&
        (!Number.isInteger(endLine) || endLine <= 0 || endLine === line) &&
        isSourceOptionLine(String(source.anchorText || '').trim())
      );
    }

    function sourceSupportsAdvancedRouteDelete(sourceInput) {
      const source = sourceRef(sourceInput || {});
      const path = String(source.path || '').replace(/\\/g, '/');
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

    function sourceSupportsAdvancedRouteReroute(sourceInput) {
      return sourceSupportsAdvancedRouteDelete(sourceInput);
    }

    function sourceSupportsAdvancedSectionDelete(sourceInput) {
      const source = sourceRef(sourceInput || {});
      const path = String(source.path || '').replace(/\\/g, '/');
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
        String(source.anchorText || '').trim() &&
        String(source.endAnchorText || '').trim()
      );
    }

    function sourceSupportsAdvancedLayerDelete(sourceInput, options) {
      const source = sourceRef(sourceInput || {});
      const opts = isObject(options) ? options : {};
      const path = String(source.path || '').replace(/\\/g, '/');
      const line = Number(source.line || source.startLine || 0);
      const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
      const anchor = String(source.anchorText || '').trim();
      return Boolean(
        path.startsWith('source/scenes/') &&
        path.endsWith('.scene.dry') &&
        !isProtectedRouterPath(path) &&
        Number.isInteger(line) &&
        line > 0 &&
        Number.isInteger(endLine) &&
        endLine >= line &&
        anchor &&
        String(source.endAnchorText || '').trim() &&
        (!opts.requireSectionHeader || /^[@#]\s*[A-Za-z_][A-Za-z0-9_.-]*/.test(anchor))
      );
    }
  }

  function routeSourceRef(sourceInput) {
    const raw = isObject(sourceInput) ? sourceInput : {};
    return Object.assign(defaultSourceRef(raw), {
      target: String(raw.target || raw.localId || '').trim(),
      condition: String(raw.condition || '').trim(),
      routeNodeId: String(raw.routeNodeId || '').trim()
    });
  }

  function routeLineReplacement(anchorText, nextTarget) {
    const prefixMatch = String(anchorText || '').trim().match(/^(go-to\s*:\s*)[A-Za-z_][A-Za-z0-9_.-]*\s*$/i);
    if (!prefixMatch || !ROUTE_TARGET_RE.test(String(nextTarget || '').trim())) {
      return '';
    }
    return prefixMatch[1] + String(nextTarget || '').trim();
  }

  function routeClauseDeleteReplacement(anchorText, target, condition) {
    const line = String(anchorText || '').trim();
    const match = line.match(/^(go-to\s*:\s*)([\s\S]+)$/i);
    const wanted = String(target || '').trim().replace(/^[@#]/, '');
    if (!match || !wanted) {
      return {ok: false, line: ''};
    }
    const expectedCondition = normalizeRouteCondition(condition);
    const clauses = match[2].split(';').map((clause) => clause.trim()).filter(Boolean);
    let removed = 0;
    const remaining = clauses.filter((clause) => {
      const parsed = parseGoToClause(clause);
      const matched = parsed.target === wanted && (!expectedCondition || normalizeRouteCondition(parsed.condition) === expectedCondition);
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
    const match = String(value || '').trim().match(/^([A-Za-z_][A-Za-z0-9_.-]*)(?:\s+if\s+([\s\S]+))?$/i);
    return {
      target: match ? match[1] : '',
      condition: match ? String(match[2] || '').trim() : ''
    };
  }

  function normalizeRouteCondition(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function simpleGoToLineTarget(value) {
    const match = String(value || '').trim().match(/^go-to\s*:\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*$/i);
    return match ? match[1] : '';
  }

  function layerBundleDeleteOrder(left, right) {
    const leftPath = changeSourcePath(left);
    const rightPath = changeSourcePath(right);
    if (leftPath !== rightPath) {
      return leftPath.localeCompare(rightPath);
    }
    const lineDelta = changeSourceLine(right) - changeSourceLine(left);
    if (lineDelta) {
      return lineDelta;
    }
    return layerBundleChangeWeight(left) - layerBundleChangeWeight(right);
  }

  function changeSourcePath(change) {
    return String(change && change.source && change.source.path || '');
  }

  function changeSourceLine(change) {
    return Number(change && (change.startLine || change.source && (change.source.line || change.source.startLine)) || 0);
  }

  function layerBundleChangeWeight(change) {
    return String(change && change.operationType || '') === 'replace_section' ? 0 : 1;
  }

  function isSourceOptionLine(anchor) {
    const text = String(anchor || '').trim();
    return Boolean(
      /^-\s+@[A-Za-z0-9_.-]+(?:\s*:|\s*$)/.test(text) ||
      /^-\s+[^:]+:\s*@?[A-Za-z0-9_.-]+\s*$/.test(text) ||
      /^-\s+.+(?:->|=>)\s*@?[A-Za-z0-9_.-]+\s*$/.test(text)
    );
  }

  /**
   * @param {unknown} input
   * @returns {SourceRef}
   */
  function defaultSourceRef(input) {
    const value = /** @type {Record<string, any>} */ (isObject(input) ? input : {});
    const line = Number(value.line || value.startLine) || null;
    const out = {
      path: String(value.path || value.sourcePath || ''),
      line,
      startLine: Number(value.startLine || value.line) || line,
      endLine: Number(value.endLine || value.line || value.startLine) || line
    };
    if (value.anchorText) {
      out.anchorText = String(value.anchorText);
    }
    if (value.endAnchorText) {
      out.endAnchorText = String(value.endAnchorText);
    }
    return out;
  }

  function defaultBaseFieldChange(field, before, after) {
    return {
      fieldId: String(field && field.id || ''),
      role: String(field && field.role || 'structure'),
      label: String(field && field.label || ''),
      sectionId: String(field && field.sectionId || ''),
      optionId: String(field && field.optionId || ''),
      source: defaultSourceRef(field && field.source || {}),
      before: String(before || ''),
      after: String(after || '')
    };
  }

  function defaultNormalizeStructuralEffect(value) {
    return String(value || '').trim().replace(/;+$/, '');
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = /** @type {ExistingSceneStructureOperationsFactory} */ ({create});

  if (global) {
    global.ProjectMapExistingSceneStructureOperations = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
