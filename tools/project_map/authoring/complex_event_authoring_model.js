(function initProjectMapComplexEventAuthoringModel(global) {
  'use strict';

  const COMPLEX_EVENT_AUTHORING_VERSION = '0.1';
  const MODEL_KIND = 'complex_event_authoring_model';
  const MAX_TRIAL_STEPS = 12;

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

  function referencePressureMap() {
    return [
      {
        id: 'unemployment_insurance_1',
        role: 'primary_medium_complexity',
        pressures: [
          'appearance_rule',
          'conditional_choice',
          'unavailable_text',
          'large_consequence_set',
          'success_failure_continuation',
          'election_follow_up'
        ],
        targetCapabilities: [
          'complete_choice_unit',
          'consequence_grouping',
          'direct_and_conditional_continuation',
          'trial_run_two_paths'
        ],
        boundary: ''
      },
      {
        id: 'cabinet_sacked_bruning',
        role: 'immediate_route_benchmark',
        pressures: ['entry_route', 'conditional_go_to', 'fallback'],
        targetCapabilities: ['ordered_route_summary', 'missing_target_detection'],
        boundary: ''
      },
      {
        id: 'dnf_collapse_right_coalition_lvp',
        role: 'political_choice_benchmark',
        pressures: ['multi_choice', 'effects', 'calls', 'follow_up_branch'],
        targetCapabilities: ['choice_consequence_bundle', 'branch_continuation_summary'],
        boundary: ''
      },
      {
        id: 'presidential_election_1932_candidate',
        role: 'large_menu_loop_benchmark',
        pressures: ['many_options', 'view_only_candidate_sections', 'menu_return_loop', 'many_images'],
        targetCapabilities: ['menu_loop_label', 'view_only_branch_label', 'bounded_large_event_report'],
        boundary: 'full_candidate_coverage_is_not_required_in_first_pass'
      },
      {
        id: 'local_election_thuringia',
        role: 'hidden_state_and_outcome_benchmark',
        pressures: ['pre_display_computation', 'inline_conditionals', 'dynamic_unavailable_text', 'outcome_loop'],
        targetCapabilities: ['advanced_script_boundary', 'conditional_text_summary', 'loop_without_exit_detection'],
        boundary: 'arbitrary_js_rewrite_remains_manual_boundary'
      }
    ];
  }

  function buildComplexEventAuthoringModel(eventBody, options) {
    const opts = isObject(options) ? options : {};
    // `reuseBody` lets a caller that already owns a private clone (e.g. the
    // enrichEventBody wrapper below, or event_structure's toEventBody chain)
    // skip a redundant 86MB deep copy. Read-only build, so it never mutates
    // the shared body; verified byte-identical via full-eventBody sha256.
    const body = isObject(eventBody) ? (opts.reuseBody ? eventBody : clone(eventBody)) : {};
    const choiceUnits = buildChoiceUnits(body, opts);
    const consequences = summarizeConsequences(choiceUnits, body);
    const continuations = summarizeContinuations(body, choiceUnits);
    const playability = validatePlayability(body, choiceUnits, continuations);
    const trialRun = opts.trialRun === false ? null : runTrial(body, opts.trialRun || defaultTrialRunOptions(choiceUnits));
    const pressureMap = referencePressureMap();
    return {
      schemaVersion: COMPLEX_EVENT_AUTHORING_VERSION,
      kind: MODEL_KIND,
      ok: !playability.diagnostics.some((item) => item.severity === 'error'),
      eventId: stringValue(opts.eventId || body.eventStructure && body.eventStructure.id || body.id || ''),
      pressureMap,
      choiceUnits,
      consequences,
      continuations,
      playability,
      trialRun,
      summary: {
        pressureReferenceCount: pressureMap.length,
        choiceUnitCount: choiceUnits.length,
        consequenceGroupCount: consequences.groups.length,
        continuationCount: continuations.items.length,
        playabilityIssueCount: playability.diagnostics.length,
        trialPathCount: trialRun ? ensureArray(trialRun.paths).length : 0
      }
    };
  }

  function enrichEventBody(eventBody, options) {
    const opts = isObject(options) ? options : {};
    const body = isObject(eventBody) ? (opts.reuseBody ? eventBody : clone(eventBody)) : {};
    // The wrapper always owns a private body here, so the inner build can
    // always reuse it (drops one redundant 86MB clone unconditionally).
    const model = buildComplexEventAuthoringModel(body, Object.assign({}, opts, {trialRun: false, reuseBody: true}));
    body.choiceUnits = model.choiceUnits;
    body.consequenceGroups = model.consequences.groups;
    body.continuationMap = model.continuations;
    body.playabilityChecks = model.playability;
    body.complexEventAuthoring = {
      schemaVersion: model.schemaVersion,
      kind: model.kind,
      ok: model.ok,
      pressureMap: model.pressureMap,
      summary: model.summary
    };
    return body;
  }

  function buildChoiceUnits(body, options) {
    const rows = ensureArray(body && body.options);
    return rows.map((option, index) => {
      const fields = ensureArray(option && option.fields);
      const source = firstSource([option && option.source].concat(fields.map((field) => field && field.source)));
      const displayCondition = normalizeConditionExpression(firstNonEmpty(option && option.sectionViewIf, fieldValueByHint(fields, 'viewIf')));
      const chooseCondition = normalizeConditionExpression(firstNonEmpty(
        option && option.chooseIf,
        option && option.sectionChooseIf,
        fieldValueByHint(fields, 'chooseIf'),
        fieldValueByHint(fields, 'chooseCondition'),
        fieldValueByRole(fields, 'choose_condition'),
        fieldValueByRole(fields, 'choice_condition')
      ));
      const unavailableText = firstNonEmpty(option && option.unavailableText, fieldValueByHint(fields, 'unavailableText'), fieldValueByRole(fields, 'unavailable_text'));
      const effects = effectRowsForOption(body, option);
      const grouped = groupEffects(effects);
      const continuation = continuationForChoice(body, option);
      const resultText = firstNonEmpty(fieldValueByHint(fields, 'body'), fieldValueByRole(fields, 'body'));
      const label = firstNonEmpty(option && option.label, fieldValueByHint(fields, 'label'), option && option.id, 'Option ' + (index + 1));
      return {
        id: stringValue(option && (option.id || option.optionId) || 'option_' + (index + 1)),
        optionId: stringValue(option && (option.optionId || option.id) || 'option_' + (index + 1)),
        label,
        subtitle: firstNonEmpty(option && option.subtitle, fieldValueByHint(fields, 'subtitle')),
        ownerSectionId: stringValue(option && option.sectionId),
        ownerSectionLabel: stringValue(option && option.sectionLabel),
        resultSectionId: stringValue(option && option.targetId),
        rawTargetId: stringValue(option && option.rawTargetId),
        displayCondition,
        chooseCondition,
        unavailableText,
        resultText,
        consequences: {
          rawEffects: effects,
          groups: grouped.groups,
          summary: grouped.summary
        },
        continuation,
        sourceEvidence: {
          source,
          fieldIds: fields.map((field) => stringValue(field && field.id)).filter(Boolean),
          effectFieldIds: effectFieldsForOption(body, option).map((field) => stringValue(field && field.id)).filter(Boolean),
          installSafety: installSafetyForChoice(option, body)
        },
        editActions: {
          labelFieldId: fieldIdByHint(fields, 'label'),
          conditionFieldId: fieldIdByHint(fields, 'chooseIf') || fieldIdByHint(fields, 'chooseCondition') || fieldIdByRole(fields, 'choose_condition') || fieldIdByRole(fields, 'choice_condition'),
          unavailableFieldId: fieldIdByHint(fields, 'unavailableText') || fieldIdByRole(fields, 'unavailable_text'),
          routeFieldId: fieldIdByHint(fields, 'returnTarget') || fieldIdByHint(fields, 'gotoAfter') || fieldIdByRole(fields, 'route')
        },
        completeness: choiceCompleteness(displayCondition, chooseCondition, unavailableText, effects, continuation, source)
      };
    });
  }

  function continuationForChoice(body, option) {
    const resultTarget = stringValue(option && option.targetId);
    const rawTarget = stringValue(option && option.rawTargetId || resultTarget);
    const fields = ensureArray(option && option.fields);
    const directRoute = firstNonEmpty(
      fieldValueByHint(fields, 'returnTarget'),
      option && option.returnTarget,
      routeAfterSection(body, resultTarget)
    );
    const routeEdges = routeEdgesFrom(body, resultTarget);
    const optionEdges = optionEdgesFor(body, option);
    const orderedRoutes = routeEdges.map((edge, index) => ({
      order: index + 1,
      target: stringValue(edge && (edge.to || edge.targetId || edge.rawTarget)),
      rawTarget: stringValue(edge && edge.rawTarget),
      predicate: stringValue(edge && edge.condition),
      isFallback: !stringValue(edge && edge.condition),
      source: sourceRef(edge && edge.source || {})
    }));
    const target = firstNonEmpty(directRoute, orderedRoutes[0] && orderedRoutes[0].target, resultTarget);
    const kind = continuationKind(body, option, {
      resultTarget,
      rawTarget,
      target,
      routeEdges,
      optionEdges,
      orderedRoutes
    });
    return {
      kind,
      resultTarget,
      rawTarget,
      nextTarget: target,
      orderedRoutes,
      optionEdgeCount: optionEdges.length,
      routeEdgeCount: routeEdges.length,
      label: continuationLabel(kind, target),
      sourceEvidence: firstSource(routeEdges.map((edge) => edge && edge.source))
    };
  }

  function summarizeConsequences(choiceUnits, body) {
    const all = [];
    ensureArray(choiceUnits).forEach((choice) => {
      ensureArray(choice && choice.consequences && choice.consequences.rawEffects).forEach((effect) => {
        all.push(Object.assign({}, effect, {choiceId: choice.id, choiceLabel: choice.label}));
      });
    });
    parseEffectFields(ensureArray(body && body.effects)).forEach((effect) => {
      all.push(Object.assign({}, effect, {choiceId: '', choiceLabel: 'trigger'}));
    });
    ensureArray(body && body.backgroundEffects).forEach((effect) => {
      all.push(normalizeEffect(effect, {choiceId: '', choiceLabel: stringValue(effect && effect.sectionId) || 'background'}));
    });
    const grouped = groupEffects(all);
    return {
      effects: all,
      groups: grouped.groups,
      summary: grouped.summary
    };
  }

  function summarizeContinuations(body, choiceUnits) {
    const items = ensureArray(choiceUnits).map((choice) => Object.assign({
      choiceId: choice.id,
      choiceLabel: choice.label
    }, choice.continuation || {}));
    const routeEdges = ensureArray(body && body.flow && body.flow.edges).filter((edge) => ['route', 'conditional_route'].includes(stringValue(edge && edge.kind)));
    const missingTargets = missingContinuationTargets(body, items.concat(routeEdges.map((edge) => ({
      nextTarget: edge && edge.to,
      rawTarget: edge && edge.rawTarget,
      kind: 'route_edge'
    }))));
    const menuReturns = items.filter((item) => item.kind === 'menu_return').length;
    const orderedConditionalRoutes = items.filter((item) => item.kind === 'ordered_conditional_route').length;
    return {
      items,
      routeEdges,
      missingTargets,
      summary: {
        directRoutes: items.filter((item) => item.kind === 'direct_route').length,
        orderedConditionalRoutes,
        fallbacks: items.filter((item) => ensureArray(item.orderedRoutes).some((route) => route.isFallback)).length,
        menuReturns,
        terminalBranches: items.filter((item) => item.kind === 'terminal_branch').length,
        missingTargets: missingTargets.length
      }
    };
  }

  function validatePlayability(body, choiceUnits, continuations) {
    const diagnostics = [];
    const rootChoices = ensureArray(choiceUnits).filter((choice) => !choice.ownerSectionId);
    if (!rootChoices.length && stringValue(body && body.eventShape) === 'choice_event') {
      diagnostics.push(diagnostic('error', 'complex_event.no_root_choices', 'Choice event has no root player choices.'));
    }
    const allRootGated = rootChoices.length > 0 && rootChoices.every((choice) => Boolean(choice.chooseCondition));
    if (allRootGated) {
      diagnostics.push(diagnostic('warning', 'complex_event.all_root_choices_conditioned', 'Every root choice has a choose condition; trial states should prove at least one selectable path.'));
    }
    ensureArray(continuations && continuations.missingTargets).forEach((item) => {
      diagnostics.push(diagnostic('error', 'complex_event.missing_target', 'Continuation target does not resolve: ' + item.owner + ' -> ' + item.target));
    });
    ensureArray(continuations && continuations.items).forEach((item) => {
      if (item.kind === 'menu_return' && !hasExitFromMenu(body, item.resultTarget)) {
        diagnostics.push(diagnostic('warning', 'complex_event.menu_loop_without_clear_exit', 'Menu return has no obvious non-menu exit: ' + (item.choiceLabel || item.resultTarget)));
      }
      if (item.kind === 'script_or_external_boundary') {
        diagnostics.push(diagnostic('info', 'complex_event.script_or_external_boundary', 'Continuation depends on external/script routing: ' + (item.choiceLabel || item.rawTarget || item.nextTarget)));
      }
    });
    return {
      ok: !diagnostics.some((item) => item.severity === 'error'),
      diagnostics,
      summary: {
        errorCount: diagnostics.filter((item) => item.severity === 'error').length,
        warningCount: diagnostics.filter((item) => item.severity === 'warning').length,
        infoCount: diagnostics.filter((item) => item.severity === 'info').length
      }
    };
  }

  function runTrial(eventBody, options) {
    const body = isObject(eventBody) ? eventBody : {};
    const opts = isObject(options) ? options : {};
    const choiceUnits = ensureArray(opts.choiceUnits).length ? opts.choiceUnits : buildChoiceUnits(body, opts);
    const paths = normalizeTrialPaths(opts.paths, choiceUnits);
    const results = paths.map((path, index) => runTrialPath(body, choiceUnits, path, {
      initialState: Object.assign({}, opts.initialState || {}),
      name: path.name || 'path_' + (index + 1)
    }));
    return {
      schemaVersion: COMPLEX_EVENT_AUTHORING_VERSION,
      kind: 'complex_event_trial_run',
      ok: results.every((path) => path.ok),
      paths: results,
      summary: {
        pathCount: results.length,
        completedPathCount: results.filter((path) => path.ok).length,
        blockedPathCount: results.filter((path) => !path.ok).length
      }
    };
  }

  function runTrialPath(body, choiceUnits, path, options) {
    const state = Object.assign({}, options.initialState || {});
    const picks = ensureArray(path && path.choices).map(stringValue).filter(Boolean);
    const steps = [];
    const scriptContext = {appliedBlocks: new Set()};
    let currentSection = stringValue(path && path.startSection);
    let ok = true;
    let blockedReason = '';
    for (let index = 0; index < Math.min(MAX_TRIAL_STEPS, Math.max(1, picks.length)); index += 1) {
      const scriptRun = applySafeScriptsForTrial(body, state, currentSection, scriptContext);
      const visibleChoices = visibleChoicesFor(choiceUnits, currentSection, state);
      const sectionText = visibleTextForSection(body, currentSection, state);
      const wanted = picks[index] || '';
      const chosen = findChoice(visibleChoices, wanted);
      const step = {
        index: index + 1,
        location: currentSection || 'root',
        visibleText: sectionText,
        choices: visibleChoices.map((choice) => ({
          id: choice.id,
          label: choice.label,
          selectable: choice.selectable,
          unavailableText: choice.unavailableText,
          chooseCondition: choice.chooseCondition
        })),
        chosen: wanted,
        scriptEffects: scriptRun.applied,
        scriptWarnings: scriptRun.warnings,
        appliedConsequences: [],
        nextLocation: currentSection || 'root',
        blockedReason: ''
      };
      if (!chosen) {
        ok = false;
        step.blockedReason = 'choice_not_visible';
        blockedReason = step.blockedReason + ': ' + wanted;
        steps.push(step);
        break;
      }
      if (!chosen.selectable) {
        ok = false;
        step.blockedReason = 'choice_unavailable';
        blockedReason = step.blockedReason + ': ' + chosen.label;
        steps.push(step);
        break;
      }
      ensureArray(chosen.consequences && chosen.consequences.rawEffects).forEach((effect) => {
        if (applyEffect(state, effect)) {
          step.appliedConsequences.push(effectExpression(effect));
        }
      });
      step.resultText = chosen.resultText || '';
      currentSection = nextTrialLocation(chosen, body, state);
      step.nextLocation = currentSection || 'root';
      steps.push(step);
    }
    return {
      name: stringValue(path && path.name || options.name),
      ok,
      blockedReason,
      finalLocation: currentSection || 'root',
      finalState: state,
      steps
    };
  }

  function applySafeScriptsForTrial(body, state, sectionId, context) {
    const api = routeScriptIntelligenceApi();
    if (!api || typeof api.applySafeScriptEffects !== 'function') {
      return {applied: [], warnings: []};
    }
    try {
      const result = api.applySafeScriptEffects(state, body, {
        sectionId,
        appliedBlocks: context && context.appliedBlocks
      });
      Object.keys(result && result.state || {}).forEach((key) => {
        state[key] = result.state[key];
      });
      return {
        applied: ensureArray(result && result.applied),
        warnings: ensureArray(result && result.warnings)
      };
    } catch (_err) {
      return {applied: [], warnings: ['script_intelligence_unavailable']};
    }
  }

  function defaultTrialRunOptions(choiceUnits) {
    const root = ensureArray(choiceUnits).filter((choice) => !choice.ownerSectionId);
    const first = root.find((choice) => !choice.chooseCondition) || root[0];
    const second = root.find((choice) => choice !== first && !choice.chooseCondition) || root.find((choice) => choice !== first) || first;
    return {
      paths: [
        {name: 'first_available_path', choices: [first && first.id].filter(Boolean)},
        {name: 'second_available_path', choices: [second && second.id].filter(Boolean)}
      ].filter((path) => path.choices.length)
    };
  }

  function normalizeTrialPaths(paths, choiceUnits) {
    const rows = ensureArray(paths).map((path, index) => {
      if (Array.isArray(path)) {
        return {name: 'path_' + (index + 1), choices: path};
      }
      if (isObject(path)) {
        return {
          name: stringValue(path.name || 'path_' + (index + 1)),
          startSection: stringValue(path.startSection || path.sectionId || path.location),
          choices: ensureArray(path.choices || path.path)
        };
      }
      return {name: 'path_' + (index + 1), choices: [path]};
    }).filter((path) => ensureArray(path.choices).length);
    if (rows.length) {
      return rows;
    }
    return ensureArray(defaultTrialRunOptions(choiceUnits).paths);
  }

  function visibleChoicesFor(choiceUnits, sectionId, state) {
    const section = stringValue(sectionId);
    return ensureArray(choiceUnits).filter((choice) => stringValue(choice.ownerSectionId) === section)
      .filter((choice) => conditionPasses(choice.displayCondition, state))
      .map((choice) => Object.assign({}, choice, {
        selectable: conditionPasses(choice.chooseCondition, state)
      }));
  }

  function visibleTextForSection(body, sectionId, state) {
    const section = stringValue(sectionId);
    const fields = section
      ? ensureArray(body && body.branchSections).filter((field) => stringValue(field && field.sectionId) === section)
      : ensureArray(body && body.sections);
    return fields.filter((field) => conditionPasses(fieldCondition(field), state))
      .map((field) => fieldValue(field))
      .filter(Boolean)
      .join('\n\n');
  }

  function nextTrialLocation(choice, body, state) {
    const continuation = choice && choice.continuation || {};
    const ordered = ensureArray(continuation.orderedRoutes);
    const match = ordered.find((route) => conditionPasses(route.predicate, state)) || ordered.find((route) => route.isFallback);
    const target = firstNonEmpty(match && match.target, continuation.nextTarget, choice && choice.resultSectionId, 'root');
    return normalizeTrialTarget(body, target);
  }

  function normalizeTrialTarget(body, target) {
    const text = cleanTarget(target);
    if (!text || text === 'root') {
      return '';
    }
    const sectionIds = eventAnchors(body);
    if (sectionIds.has(text)) {
      return text;
    }
    const local = text.split('.').pop();
    const hit = Array.from(sectionIds).find((id) => id === local || id.split('.').pop() === local);
    return hit || '';
  }

  function conditionPasses(condition, state) {
    const text = normalizeConditionExpression(condition);
    if (!text) {
      return true;
    }
    const orParts = text.split(/\s+or\s+/i);
    return orParts.some((part) => part.split(/\s+and\s+/i).every((clause) => compareClause(clause, state)));
  }

  function compareClause(clause, state) {
    let text = normalizeConditionExpression(clause);
    if (!text) {
      return true;
    }
    if (/^not\s+/i.test(text)) {
      return !compareClause(text.replace(/^not\s+/i, ''), state);
    }
    text = stripOuterParens(text);
    const match = text.match(/^(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*(>=|<=|!=|==|=|>|<)\s*(.+)$/);
    if (!match) {
      return Boolean(valueForState(state, text.replace(/^Q\./, '')));
    }
    const left = valueForState(state, match[1]);
    const right = parseConditionValue(match[3], state);
    switch (match[2]) {
      case '>=': return Number(left) >= Number(right);
      case '<=': return Number(left) <= Number(right);
      case '>': return Number(left) > Number(right);
      case '<': return Number(left) < Number(right);
      case '!=': return String(left) !== String(right);
      case '==':
      case '=': return String(left) === String(right);
      default: return false;
    }
  }

  function parseConditionValue(value, state) {
    const text = stringValue(value).trim();
    const quoted = text.match(/^['"]([\s\S]*)['"]$/);
    if (quoted) {
      return quoted[1];
    }
    if (/^-?\d+(?:\.\d+)?$/.test(text)) {
      return Number(text);
    }
    return valueForState(state, text.replace(/^Q\./, ''));
  }

  function valueForState(state, key) {
    const clean = stringValue(key).trim().replace(/^Q\./, '');
    if (Object.prototype.hasOwnProperty.call(state, clean)) {
      return state[clean];
    }
    return 0;
  }

  function applyEffect(state, effect) {
    const variable = stringValue(effect && effect.variable).replace(/^Q\./, '');
    if (!variable || !conditionPasses(effect && effect.condition, state)) {
      return false;
    }
    const op = stringValue(effect && effect.op || '+=');
    const current = Number(valueForState(state, variable)) || 0;
    const value = effectNumber(effect && effect.value, state);
    if (op === '=') {
      state[variable] = value;
    } else if (op === '-=') {
      state[variable] = current - value;
    } else {
      state[variable] = current + value;
    }
    return true;
  }

  function effectNumber(value, state) {
    const text = stringValue(value).trim();
    if (/^-?\d+(?:\.\d+)?$/.test(text)) {
      return Number(text);
    }
    return Number(valueForState(state, text)) || 0;
  }

  function effectRowsForOption(body, option) {
    return parseEffectFields(effectFieldsForOption(body, option));
  }

  function effectFieldsForOption(body, option) {
    const groups = ensureArray(body && body.optionEffects);
    const matching = groups.filter((group) => optionGroupMatches(group, option));
    return matching.reduce((rows, group) => rows.concat(ensureArray(group && group.fields)), []);
  }

  function optionGroupMatches(group, option) {
    const ids = [option && option.id, option && option.optionId, option && option.targetId, option && option.rawTargetId, option && option.sectionId]
      .map(stringValue).filter(Boolean);
    const groupIds = [group && group.id, group && group.optionId, group && group.sectionId].map(stringValue).filter(Boolean);
    if (groupIds.some((id) => ids.includes(id))) {
      return true;
    }
    const label = stringValue(option && option.label);
    return Boolean(label && stringValue(group && group.label).indexOf(label) >= 0);
  }

  function parseEffectField(field) {
    const value = fieldValue(field).trim();
    const id = stringValue(field && field.id);
    if (!value) {
      return [];
    }
    const parsed = parseEffectExpression(value);
    if (parsed.variable) {
      parsed.source = sourceRef(field && field.source || {});
      parsed.fieldId = id;
      parsed.sourceExpression = firstNonEmpty(field && field.sourceExpression, value);
      return [parsed];
    }
    return [];
  }

  function parseEffectFields(fields) {
    const rows = [];
    const buckets = new Map();
    ensureArray(fields).forEach((field) => {
      parseEffectField(field).forEach((effect) => rows.push(effect));
      const id = stringValue(field && field.id);
      const match = id.match(/^(.*\.effect\.\d+)\.([A-Za-z]+)$/);
      if (!match) {
        return;
      }
      const key = match[1];
      if (!buckets.has(key)) {
        buckets.set(key, {});
      }
      buckets.get(key)[match[2]] = field;
    });
    buckets.forEach((bucket, key) => {
      const variable = firstNonEmpty(fieldValue(bucket.variable), fieldValue(bucket.name));
      const op = firstNonEmpty(fieldValue(bucket.op), fieldValue(bucket.operator), '+=');
      const value = firstNonEmpty(fieldValue(bucket.value), '1');
      if (!variable) {
        return;
      }
      rows.push({
        variable: variable.replace(/^Q\./, ''),
        op,
        value,
        condition: fieldValue(bucket.condition),
        hook: fieldValue(bucket.hook),
        source: firstSource(Object.keys(bucket).map((name) => bucket[name] && bucket[name].source)),
        fieldId: key,
        sourceExpression: 'Q.' + variable.replace(/^Q\./, '') + ' ' + op + ' ' + value
      });
    });
    return rows;
  }

  function parseEffectExpression(value) {
    const text = stringValue(value).trim().replace(/;$/, '');
    const match = text.match(/^(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*(=|\+=|-=)\s*([^;]+?)(?:\s+if\s+(.+))?$/);
    if (!match) {
      return {variable: '', op: '', value: '', condition: '', sourceExpression: text};
    }
    return {
      variable: match[1],
      op: match[2],
      value: match[3].trim(),
      condition: stringValue(match[4]).trim(),
      sourceExpression: text
    };
  }

  function normalizeEffect(effect, extra) {
    const value = isObject(effect) ? effect : {};
    return Object.assign({
      variable: stringValue(value.variable).replace(/^Q\./, ''),
      op: stringValue(value.op || value.operator || '+='),
      value: value.value === undefined || value.value === null ? '' : String(value.value),
      condition: stringValue(value.condition),
      source: sourceRef(value.source || {}),
      sourceExpression: stringValue(value.sourceExpression || value.expression || value.displayExpression)
    }, extra || {});
  }

  function groupEffects(effects) {
    const groupsByKey = new Map();
    ensureArray(effects).forEach((effect) => {
      const normalized = normalizeEffect(effect);
      if (!normalized.variable) {
        return;
      }
      const key = effectGroupKey(normalized);
      if (!groupsByKey.has(key)) {
        groupsByKey.set(key, {
          key,
          label: effectGroupLabel(key),
          effects: [],
          variables: [],
          count: 0,
          rawPreserved: true
        });
      }
      const group = groupsByKey.get(key);
      group.effects.push(Object.assign({}, effect, normalized, {expression: effectExpression(normalized)}));
      group.variables = unique(group.variables.concat(normalized.variable));
      group.count = group.effects.length;
    });
    const groups = Array.from(groupsByKey.values()).sort((a, b) => a.label.localeCompare(b.label));
    return {
      groups,
      summary: groups.reduce((out, group) => {
        out[group.key] = group.count;
        return out;
      }, {})
    };
  }

  function effectGroupKey(effect) {
    const name = stringValue(effect && effect.variable).toLowerCase();
    if (/year|month|week|election|timer|delay|schedule|countdown/.test(name)) return 'time_election';
    if (/unemployment|budget|tax|inflation|wage|industry|agriculture|econom|price|debt/.test(name)) return 'economy';
    if (/cabinet|government|minister|coalition|president|reichstag|chancellor|law|decree/.test(name)) return 'government';
    if (/faction|party|bloc|dnvp|nsdap|cvp|spd|kpd|dnf|lvp|zentrum|stahlhelm/.test(name)) return 'factions_parties';
    if (/support|public|attention|order|vote|poll|approval|popularity|trust|pressure/.test(name)) return 'public_support';
    if (/seen|flag|formed|unlocked|accepted|done|visited|available/.test(name) || stringValue(effect && effect.op) === '=') return 'flags_state';
    return 'raw_advanced';
  }

  function effectGroupLabel(key) {
    return {
      public_support: 'Public support / mood',
      factions_parties: 'Factions and parties',
      government: 'Government and institutions',
      economy: 'Economy and material state',
      time_election: 'Time, election, and scheduling',
      flags_state: 'Flags and state gates',
      raw_advanced: 'Raw or advanced effects'
    }[key] || key;
  }

  function effectExpression(effect) {
    const variable = stringValue(effect && effect.variable).replace(/^Q\./, '');
    if (!variable) {
      return stringValue(effect && effect.sourceExpression);
    }
    const op = stringValue(effect && effect.op || '+=');
    const value = stringValue(effect && effect.value === undefined ? 1 : effect.value);
    const condition = stringValue(effect && effect.condition);
    return 'Q.' + variable + ' ' + op + ' ' + value + (condition ? ' if ' + condition : '');
  }

  function continuationKind(body, option, context) {
    const routeEdges = ensureArray(context.routeEdges);
    const orderedRoutes = ensureArray(context.orderedRoutes);
    const target = stringValue(context.target);
    const resultTarget = stringValue(context.resultTarget);
    if (orderedRoutes.length > 1 && orderedRoutes.some((route) => route.predicate)) {
      return 'ordered_conditional_route';
    }
    if (target === 'root' || !target && resultTarget) {
      return 'menu_return';
    }
    if (target && !targetResolves(body, target) && !targetResolves(body, resultTarget)) {
      return 'script_or_external_boundary';
    }
    if (targetResolves(body, target)) {
      return routeEdges.some((edge) => stringValue(edge && edge.condition)) ? 'conditional_route' : 'direct_route';
    }
    if (!target && !resultTarget) {
      return 'terminal_branch';
    }
    return 'direct_route';
  }

  function continuationLabel(kind, target) {
    const suffix = target ? ': ' + target : '';
    const label = {
      direct_route: 'Direct route',
      conditional_route: 'Conditional route',
      ordered_conditional_route: 'Conditional route group',
      menu_return: 'Menu return',
      terminal_branch: 'Terminal branch',
      script_or_external_boundary: 'Script or external boundary'
    }[kind] || kind;
    return label + suffix;
  }

  function routeAfterSection(body, sectionId) {
    const route = routeEdgesFrom(body, sectionId).find((edge) => !stringValue(edge && edge.condition)) || routeEdgesFrom(body, sectionId)[0];
    return stringValue(route && (route.to || route.targetId || route.rawTarget));
  }

  function routeEdgesFrom(body, sectionId) {
    const from = stringValue(sectionId);
    if (!from) {
      return [];
    }
    return ensureArray(body && body.flow && body.flow.edges).filter((edge) => {
      return ['route', 'conditional_route'].includes(stringValue(edge && edge.kind)) &&
        endpointMatches(body, edge && edge.from, from);
    });
  }

  function optionEdgesFor(body, option) {
    const ids = [option && option.id, option && option.optionId, option && option.targetId, option && option.rawTargetId].map(stringValue).filter(Boolean);
    return ensureArray(body && body.flow && body.flow.edges).filter((edge) => {
      return stringValue(edge && edge.kind) === 'option' && (
        ids.includes(stringValue(edge && edge.optionId)) ||
        ids.includes(stringValue(edge && edge.rawTarget)) ||
        ids.some((id) => endpointMatches(body, edge && edge.to, id))
      );
    });
  }

  function missingContinuationTargets(body, items) {
    return ensureArray(items).map((item) => {
      const target = stringValue(item && (item.nextTarget || item.to || item.rawTarget)).replace(/^[@#]/, '');
      if (!target || target === 'root' || /^runtime:|^tag:/.test(target)) {
        return null;
      }
      if (targetResolves(body, target)) {
        return null;
      }
      return {
        owner: stringValue(item && (item.choiceLabel || item.choiceId || item.kind || 'route')),
        target
      };
    }).filter(Boolean);
  }

  function targetResolves(body, target) {
    const text = cleanTarget(target);
    if (!text || text === 'root') {
      return true;
    }
    const ids = eventAnchors(body);
    if (ids.has(text)) {
      return true;
    }
    const local = text.split('.').pop();
    return ids.has(local) || Array.from(ids).some((id) => id.split('.').pop() === local);
  }

  // Memoized per body: normalizeTrialTarget/targetResolves call this once per
  // target and it rebuilt the whole anchor set (sections/options/graph nodes +
  // ~all project scene ids) each time -> O(targets x anchors). body is a single
  // per-build clone, stable in these fields; the WeakMap keys on it. Callers
  // only read the returned Set (.has / Array.from), so sharing it is safe.
  const eventAnchorsCache = new WeakMap();

  function eventAnchors(body) {
    if (isObject(body) && eventAnchorsCache.has(body)) {
      return eventAnchorsCache.get(body);
    }
    const ids = new Set(['root']);
    ensureArray(body && body.branchSections).forEach((field) => {
      addAnchorId(ids, field && field.sectionId);
      addAnchorId(ids, field && field.id);
    });
    ensureArray(body && body.sections).forEach((field) => {
      addAnchorId(ids, field && field.sectionId);
      addAnchorId(ids, field && field.id);
    });
    ensureArray(body && body.options).forEach((option) => {
      [option && option.id, option && option.targetId, option && option.rawTargetId].map(stringValue).filter(Boolean).forEach((id) => {
        addAnchorId(ids, id);
      });
    });
    ensureArray(body && body.flow && body.flow.nodes).forEach((node) => {
      [node && node.id, node && node.localId, node && node.sectionId, node && node.targetId].map(stringValue).filter(Boolean).forEach((id) => {
        addAnchorId(ids, id);
      });
    });
    ensureArray(body && body.sourceStructureGraph && body.sourceStructureGraph.nodes).forEach((node) => {
      [node && node.id, node && node.localId, node && node.sectionId, node && node.targetId].map(stringValue).filter(Boolean).forEach((id) => {
        addAnchorId(ids, id);
      });
    });
    ensureArray(body && body.projectSceneIds || body && body.knownSceneIds || body && body.globalSceneIds).forEach((id) => addAnchorId(ids, id));
    if (isObject(body)) {
      eventAnchorsCache.set(body, ids);
    }
    return ids;
  }

  function addAnchorId(ids, value) {
    const text = cleanTarget(value);
    if (!text) {
      return;
    }
    ids.add(text);
    ids.add(text.split('.').pop());
  }

  function hasExitFromMenu(body, sectionId) {
    const section = stringValue(sectionId);
    if (!section) {
      return true;
    }
    return ensureArray(body && body.flow && body.flow.edges).some((edge) => {
      if (!['option', 'route', 'conditional_route'].includes(stringValue(edge && edge.kind))) {
        return false;
      }
      return endpointMatches(body, edge && edge.from, section) && !endpointMatches(body, edge && edge.to, section);
    });
  }

  function choiceCompleteness(displayCondition, chooseCondition, unavailableText, effects, continuation, source) {
    const rows = [
      {id: 'label', ok: true},
      {id: 'display_condition', ok: true, present: Boolean(displayCondition)},
      {id: 'choose_condition', ok: true, present: Boolean(chooseCondition)},
      {id: 'unavailable_text', ok: !chooseCondition || Boolean(unavailableText), present: Boolean(unavailableText)},
      {id: 'consequences', ok: true, present: ensureArray(effects).length > 0},
      {id: 'continuation', ok: Boolean(continuation && continuation.kind), present: Boolean(continuation && continuation.kind)},
      {id: 'source_evidence', ok: Boolean(source && source.path) || true, present: Boolean(source && source.path)}
    ];
    return {
      ok: rows.every((row) => row.ok),
      rows
    };
  }

  function installSafetyForChoice(option, body) {
    const fields = ensureArray(option && option.fields).concat(effectFieldsForOption(body, option));
    const safeties = fields.map((field) => stringValue(field && (field.installSafety || field.editability || field.status))).filter(Boolean);
    if (safeties.some((item) => item === 'manual_review')) return 'manual_review';
    if (safeties.some((item) => item === 'advanced_source_patch' || item === 'advanced_apply')) return 'advanced_apply';
    if (safeties.some((item) => item === 'guarded_replace_text' || item === 'guarded_apply' || item === 'guarded')) return 'guarded_apply';
    return 'read_only';
  }

  function endpointMatches(body, left, right) {
    const a = endpointKey(body, left);
    const b = endpointKey(body, right);
    return Boolean(a && b && a === b);
  }

  function endpointKey(body, value) {
    const text = cleanTarget(value);
    if (!text) {
      return '';
    }
    const eventId = stringValue(body && body.eventStructure && body.eventStructure.id);
    if (eventId && text.startsWith(eventId + '.')) {
      return text.slice(eventId.length + 1);
    }
    return text.split('.').pop();
  }

  function findChoice(choices, wanted) {
    const target = stringValue(wanted);
    return ensureArray(choices).find((choice) => {
      return [choice && choice.id, choice && choice.optionId, choice && choice.label].map(stringValue).includes(target);
    }) || null;
  }

  function fieldValueByHint(fields, hint) {
    const wanted = stringValue(hint).toLowerCase();
    const field = ensureArray(fields).find((item) => {
      const id = stringValue(item && item.id).toLowerCase();
      const label = stringValue(item && item.label).toLowerCase();
      const role = stringValue(item && (item.role || item.semanticRole)).toLowerCase();
      return id.endsWith('.' + wanted.toLowerCase()) ||
        id.indexOf(wanted.toLowerCase()) >= 0 ||
        label.indexOf(wanted.toLowerCase()) >= 0 ||
        role === wanted.toLowerCase();
    });
    return fieldValue(field);
  }

  function fieldIdByHint(fields, hint) {
    const wanted = stringValue(hint).toLowerCase();
    const field = ensureArray(fields).find((item) => {
      const id = stringValue(item && item.id).toLowerCase();
      return id.endsWith('.' + wanted) || id.indexOf(wanted) >= 0;
    });
    return stringValue(field && field.id);
  }

  function fieldIdByRole(fields, role) {
    const wanted = stringValue(role).toLowerCase();
    const field = ensureArray(fields).find((item) => stringValue(item && (item.role || item.semanticRole)).toLowerCase() === wanted);
    return stringValue(field && field.id);
  }

  function fieldValueByRole(fields, role) {
    const wanted = stringValue(role).toLowerCase();
    const field = ensureArray(fields).find((item) => stringValue(item && (item.role || item.semanticRole)).toLowerCase() === wanted);
    return fieldValue(field);
  }

  function fieldCondition(field) {
    return firstNonEmpty(field && field.condition, ensureArray(field && field.conditions)[0]);
  }

  function fieldValue(field) {
    if (!field) {
      return '';
    }
    return stringValue(field.value !== undefined ? field.value : field.original);
  }

  function cleanTarget(value) {
    return stringValue(value).trim().replace(/^[@#]/, '').replace(/^(?:scene|section|result|option):/i, '');
  }

  function normalizeConditionExpression(value) {
    return stringValue(value)
      .trim()
      .replace(/\s+\/\s+/g, ' and ')
      .replace(/^Q\./, 'Q.');
  }

  function stripOuterParens(value) {
    let text = stringValue(value).trim();
    while (text.length > 1 && text[0] === '(' && text[text.length - 1] === ')' && balancedOuterParens(text)) {
      text = text.slice(1, -1).trim();
    }
    return text;
  }

  function balancedOuterParens(value) {
    const text = stringValue(value);
    let depth = 0;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
        if (depth === 0 && index < text.length - 1) {
          return false;
        }
      }
      if (depth < 0) {
        return false;
      }
    }
    return depth === 0;
  }

  function firstSource(sources) {
    return ensureArray(sources).map(sourceRef).find((source) => source.path) || sourceRef({});
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    const line = numberOrNull(value.line || value.startLine);
    return {
      path: stringValue(value.path || value.sourcePath),
      line,
      startLine: line || numberOrNull(value.startLine),
      endLine: numberOrNull(value.endLine || value.line || value.startLine),
      anchorText: stringValue(value.anchorText),
      endAnchorText: stringValue(value.endAnchorText)
    };
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message};
  }

  function unique(values) {
    const seen = new Set();
    const out = [];
    ensureArray(values).forEach((value) => {
      const text = stringValue(value);
      if (text && !seen.has(text)) {
        seen.add(text);
        out.push(text);
      }
    });
    return out;
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

  function clone(value) {
    return JSON.parse(JSON.stringify(value === undefined ? null : value));
  }

  const api = {
    COMPLEX_EVENT_AUTHORING_VERSION,
    MODEL_KIND,
    referencePressureMap,
    buildComplexEventAuthoringModel,
    enrichEventBody,
    runTrial,
    groupEffects
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapComplexEventAuthoringModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
