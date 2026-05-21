// @ts-check
(function initProjectMapEventChoicePathModel(global) {
  'use strict';

  /**
   * @typedef {Record<string, any>} ChoicePathRecord
   */

  const api = {
    choiceTreePlan,
    choiceTreeSectionIds,
    routeOutcomeIndex,
    nextChoiceSectionId,
    normalizeEndpointToken
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapEventChoicePathModel = api;
  }

  /**
   * @param {unknown[]} options
   * @param {unknown} body
   * @param {{sectionGroups?: Record<string, ChoicePathRecord>}=} config
   * @returns {ChoicePathRecord | null}
   */
  function choiceTreePlan(options, body, config) {
    const rows = ensureArray(options).filter(Boolean);
    if (!rows.length) {
      return null;
    }
    const context = asRecord(body);
    /** @type {Record<string, unknown[]>} */
    const children = {};
    rows.forEach((option) => {
      const owner = normalizeEndpointToken(option && option.sectionId);
      if (!owner) {
        return;
      }
      if (!children[owner]) {
        children[owner] = [];
      }
      children[owner].push(option);
    });
    const rootRows = rows.filter((option) => !normalizeEndpointToken(option && option.sectionId));
    const sections = sectionGroups(body, config);
    const routeOutcomes = routeOutcomeIndex(body, sections);
    const rootSectionIds = rootRows.length ? [] : sectionOnlyRootIds(children, rows);
    const rootSectionRows = rootSectionIds.map((sectionId) => {
      const section = sections[sectionId] || {
        id: sectionId,
        label: endpointDisplay(sectionId, {objectId: context.eventStructure && context.eventStructure.id}) || sectionId,
        condition: '',
        fields: []
      };
      return {__sectionRoot: true, id: sectionId, section, children: children[sectionId]};
    });
    return {
      rootRows,
      rootSectionRows,
      childrenBySection: children,
      sectionGroups: sections,
      routeOutcomesByOption: routeOutcomes.byOption,
      routeOutcomesBySection: routeOutcomes.bySection
    };
  }

  /**
   * When an event has only section-owned options, expose the entry menu(s) as
   * the visible roots instead of treating every later section with children as
   * another top-level tree. A later section that is the target of any option is
   * already reachable through the player path.
   * @param {Record<string, unknown[]>} children
   * @param {unknown[]} options
   * @returns {string[]}
   */
  function sectionOnlyRootIds(children, options) {
    const keys = Object.keys(children || {});
    if (!keys.length) {
      return [];
    }
    const targeted = new Set();
    ensureArray(options).forEach((option) => {
      const row = asRecord(option);
      [
        row.targetId,
        row.rawTargetId,
        row.gotoAfter,
        row.returnTarget
      ].map(normalizeEndpointToken).filter(Boolean).forEach((target) => targeted.add(target));
    });
    const roots = keys.filter((key) => !targeted.has(normalizeEndpointToken(key)));
    return roots.length ? roots : [keys[0]];
  }

  /**
   * @param {unknown} body
   * @param {{sectionGroups?: Record<string, ChoicePathRecord>}=} config
   * @returns {string[]}
   */
  function choiceTreeSectionIds(body, config) {
    const ids = new Set();
    const context = asRecord(body);
    ensureArray(context.options).forEach((option) => {
      const row = asRecord(option);
      [
        row.sectionId,
        nextChoiceSectionId(row, body),
        row.returnTarget,
        row.gotoAfter,
        row.targetId,
        row.rawTargetId
      ].map(normalizeEndpointToken).filter(isChoiceOwnedSectionTarget).forEach((target) => ids.add(target));
      ensureArray(row.resultFields).forEach((field) => {
        const section = normalizeEndpointToken(asRecord(field).sectionId);
        if (isChoiceOwnedSectionTarget(section)) {
          ids.add(section);
        }
      });
    });
    const routeOutcomes = routeOutcomeIndex(body, sectionGroups(body, config));
    Object.keys(routeOutcomes.byOption || {}).concat(Object.keys(routeOutcomes.bySection || {})).forEach((ownerKey) => {
      ensureArray(routeOutcomes.byOption && routeOutcomes.byOption[ownerKey]).concat(ensureArray(routeOutcomes.bySection && routeOutcomes.bySection[ownerKey])).forEach((outcome) => {
        const section = normalizeEndpointToken(outcome && outcome.targetKey);
        if (isChoiceOwnedSectionTarget(section)) {
          ids.add(section);
        }
      });
    });
    return Array.from(ids);
  }

  /**
   * @param {unknown} body
   * @param {Record<string, ChoicePathRecord>=} groups
   * @returns {{byOption: Record<string, ChoicePathRecord[]>, bySection: Record<string, ChoicePathRecord[]>}}
   */
  function routeOutcomeIndex(body, groups) {
    const sections = groups || sectionGroups(body);
    /** @type {Record<string, ChoicePathRecord[]>} */
    const byOption = {};
    /** @type {Record<string, ChoicePathRecord[]>} */
    const bySection = {};
    const context = asRecord(body);
    ensureArray(asRecord(context.eventGraph).edges).forEach((edge) => {
      if (!isRouteOutcomeEdge(edge)) {
        return;
      }
      const outcome = routeOutcomeFromEdge(edge, body, sections);
      if (!outcome || !outcome.targetKey || outcome.targetKey === 'root') {
        return;
      }
      const from = String(edge && edge.from || '');
      const optionMatch = from.match(/^option:(.+)$/);
      if (optionMatch) {
        pushRouteOutcome(byOption, normalizeEndpointToken(optionMatch[1]), outcome);
      }
      const sectionMatch = from.match(/^section:(.+)$/);
      if (sectionMatch) {
        pushRouteOutcome(bySection, normalizeEndpointToken(sectionMatch[1]), outcome);
      }
    });
    ensureArray(asRecord(context.continuationMap).items).forEach((item) => {
      const row = asRecord(item);
      const routes = ensureArray(row.orderedRoutes).filter((route) => {
        const routeRow = asRecord(route);
        return route && (routeRow.target || routeRow.rawTarget || routeRow.predicate);
      });
      if (String(row.kind || '') !== 'ordered_conditional_route' || routes.length < 2) {
        return;
      }
      const optionKey = normalizeEndpointToken(row.choiceId);
      routes.forEach((route, index) => {
        const outcome = routeOutcomeFromContinuation(route, row, body, sections, index);
        if (optionKey && outcome) {
          pushRouteOutcome(byOption, optionKey, outcome);
        }
      });
    });
    return {byOption, bySection};
  }

  /**
   * @param {unknown} option
   * @param {unknown} body
   * @returns {string}
   */
  function nextChoiceSectionId(option, body) {
    const optionRow = asRecord(option);
    const context = asRecord(body);
    const optionId = normalizeEndpointToken(optionRow.id || optionRow.optionId);
    const unit = ensureArray(context.choiceUnits).find((choice) => {
      const row = asRecord(choice);
      return normalizeEndpointToken(row.id || row.optionId) === optionId;
    }) || null;
    const continuation = asRecord(asRecord(unit).continuation);
    const continuationTarget = isBranchingContinuation(continuation)
      ? continuation.resultTarget
      : continuation.nextTarget;
    const candidates = [
      continuationTarget,
      optionRow.returnTarget,
      continuation.resultTarget,
      optionRow.gotoAfter,
      optionRow.targetId,
      optionRow.rawTargetId
    ].map(normalizeEndpointToken).filter(Boolean);
    return candidates.find((target) => target && target !== 'root') || '';
  }

  function isChoiceOwnedSectionTarget(target) {
    const id = normalizeEndpointToken(target);
    if (!id || id === 'root') {
      return false;
    }
    return !/^(?:runtime|tag):/i.test(id);
  }

  function isRouteOutcomeEdge(edge) {
    const kind = String(edge && edge.kind || '');
    if (!/route/i.test(kind)) {
      return false;
    }
    if (/^(?:fuzzy_route|script_route|terminal_route|external_route|missing_route|dynamic_route|jump_route)$/i.test(kind)) {
      return false;
    }
    if (kind === 'evidence_route' && !String(edge && edge.condition || '').trim()) {
      return false;
    }
    return !/^(?:choice|result_route|return_route|exit_route)$/i.test(kind) &&
      /^(?:option|section):/.test(String(edge && edge.from || ''));
  }

  function routeOutcomeFromEdge(edge, body, groups) {
    const target = String(edge && (edge.targetId || edge.to || '') || '').replace(/^route_target:/, '');
    const targetKey = normalizeEndpointToken(target);
    if (!targetKey) {
      return null;
    }
    const condition = String(edge && edge.condition || '');
    const from = String(edge && edge.from || '').replace(/^(?:option|section):/, '');
    const routeField = routeFieldForOutcome(edge, body);
    return {
      id: String(edge && edge.id || targetKey),
      target,
      targetKey,
      label: endpointDisplay(target, {objectId: body && body.eventStructure && body.eventStructure.id}) || targetKey,
      condition,
      evidenceClass: String(edge && edge.evidenceClass || ''),
      semanticTier: String(edge && edge.semanticTier || ''),
      safeEditEligible: Boolean(edge && edge.safeEditEligible),
      section: groups && groups[targetKey] || null,
      routeField,
      predicateField: routePredicateFieldForTarget(target, condition, from, body)
    };
  }

  function routeOutcomeFromContinuation(route, item, body, groups, index) {
    const target = String(route && (route.target || route.rawTarget) || '').replace(/^route_target:/, '');
    const targetKey = normalizeEndpointToken(target);
    if (!targetKey) {
      return null;
    }
    const condition = String(route && route.predicate || '').trim();
    const routeField = routeFieldForTarget(target, condition, item && (item.resultTarget || item.choiceId), body);
    return {
      id: 'continuation:' + String(item && item.choiceId || 'choice') + ':' + String(route && (route.rawTarget || route.target) || index || targetKey),
      target,
      targetKey,
      label: endpointDisplay(target, {objectId: body && body.eventStructure && body.eventStructure.id}) || targetKey,
      condition,
      evidenceClass: route && route.parserBacked ? 'parser_backed' : '',
      semanticTier: route && route.parserBacked ? 'static_exact' : '',
      safeEditEligible: false,
      section: groups && groups[targetKey] || null,
      routeField,
      predicateField: routePredicateFieldForTarget(target, condition, item && (item.resultTarget || item.choiceId), body)
    };
  }

  function routeFieldForTarget(target, condition, from, body) {
    const targetKey = normalizeEndpointToken(target);
    const conditionText = String(condition || '').trim();
    const fromKey = normalizeEndpointToken(from);
    return ensureArray(body && body.metaFields).find((field) => {
      if (String(field && (field.role || field.semanticRole) || '').toLowerCase() !== 'route') {
        return false;
      }
      const fieldTarget = normalizeEndpointToken(fieldValue(field));
      const fieldCondition = String(field && (field.routePredicate || field.condition) || '').trim();
      const fieldSection = normalizeEndpointToken(field && field.sectionId);
      return fieldTarget === targetKey && (!conditionText || fieldCondition === conditionText) && (!fromKey || !fieldSection || fieldSection === fromKey);
    }) || null;
  }

  function routeFieldForOutcome(edge, body) {
    const target = normalizeEndpointToken(edge && (edge.targetId || edge.to || ''));
    const condition = String(edge && edge.condition || '').trim();
    const from = String(edge && edge.from || '').replace(/^(?:option|section):/, '');
    return routeFieldForTarget(target, condition, from, body);
  }

  function routePredicateFieldForTarget(target, condition, from, body) {
    const targetKey = normalizeEndpointToken(target);
    const conditionText = String(condition || '').trim();
    const fromKey = normalizeEndpointToken(from);
    if (!targetKey || !conditionText) {
      return null;
    }
    return ensureArray(body && body.metaFields).find((field) => {
      if (String(field && field.transform || '') !== 'goto_route_predicate') {
        return false;
      }
      const fieldTarget = normalizeEndpointToken(field && field.routeTarget);
      const fieldCondition = String(field && (field.routePredicate || field.condition || fieldValue(field)) || '').trim();
      const fieldSection = normalizeEndpointToken(field && field.sectionId);
      return fieldTarget === targetKey && fieldCondition === conditionText && (!fromKey || !fieldSection || fieldSection === fromKey);
    }) || null;
  }

  function pushRouteOutcome(map, key, outcome) {
    if (!key || !outcome) {
      return;
    }
    if (!map[key]) {
      map[key] = [];
    }
    const dedupeKey = [outcome.targetKey, outcome.condition].join('|');
    const existingIndex = map[key].findIndex((row) => [row.targetKey, row.condition].join('|') === dedupeKey);
    if (existingIndex < 0) {
      map[key].push(outcome);
      return;
    }
    const existing = map[key][existingIndex];
    const existingScore = (existing.section ? 2 : 0) + (existing.routeField ? 1 : 0) + (existing.predicateField ? 1 : 0);
    const nextScore = (outcome.section ? 2 : 0) + (outcome.routeField ? 1 : 0) + (outcome.predicateField ? 1 : 0);
    if (nextScore > existingScore) {
      map[key][existingIndex] = outcome;
    }
  }

  function isBranchingContinuation(continuation) {
    const routes = ensureArray(continuation && continuation.orderedRoutes).filter((route) => route && (route.target || route.rawTarget || route.predicate));
    return String(continuation && continuation.kind || '') === 'ordered_conditional_route' && routes.length > 1;
  }

  /**
   * @param {unknown} body
   * @param {{sectionGroups?: Record<string, ChoicePathRecord>}=} config
   * @returns {Record<string, ChoicePathRecord>}
   */
  function sectionGroups(body, config) {
    const groups = config && config.sectionGroups;
    if (groups && typeof groups === 'object') {
      return groups;
    }
    /** @type {Record<string, ChoicePathRecord>} */
    const out = {};
    ensureArray(asRecord(body).branchSections).forEach((field) => {
      const row = asRecord(field);
      const id = normalizeEndpointToken(row.sectionId || row.id);
      if (!id) {
        return;
      }
      if (!out[id]) {
        out[id] = {
          id,
          label: sectionLabel(row, id),
          condition: sectionConditionText(row),
          fields: []
        };
      }
      out[id].fields.push(field);
      if (!out[id].condition) {
        out[id].condition = sectionConditionText(row);
      }
      if (!out[id].label) {
        out[id].label = sectionLabel(row, id);
      }
    });
    return out;
  }

  /**
   * @param {ChoicePathRecord} field
   * @param {string} id
   * @returns {string}
   */
  function sectionLabel(field, id) {
    return stringValue(field.sectionLabel || field.sectionTitle || field.title || field.label || field.heading || field.sectionId || id).trim();
  }

  /**
   * @param {ChoicePathRecord} field
   * @returns {string}
   */
  function sectionConditionText(field) {
    return stringValue(field.condition || field.viewIf || field.chooseIf || field.routePredicate || field.predicate || '').trim();
  }

  function endpointDisplay(value, model) {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }
    const sceneId = String(model && (model.objectId || model.sceneId) || '').trim();
    return sceneId && text.startsWith(sceneId + '.') ? text.slice(sceneId.length + 1) : text;
  }

  function normalizeEndpointToken(value) {
    const text = String(value || '').trim().replace(/^[@#]/, '');
    if (!text) {
      return '';
    }
    return text.includes('.') ? text.split('.').pop() : text;
  }

  function fieldValue(field) {
    if (!field) {
      return '';
    }
    if (typeof field === 'string') {
      return field;
    }
    return String(field.value !== undefined ? field.value : field.replacement !== undefined ? field.replacement : field.text !== undefined ? field.text : field.original !== undefined ? field.original : '');
  }

  /**
   * @param {unknown} value
   * @returns {ChoicePathRecord}
   */
  function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  function stringValue(value) {
    return value === undefined || value === null ? '' : String(value);
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }
})(typeof window !== 'undefined' ? window : globalThis);
