// @ts-check
(function initProjectMapObjectPlaySimulator(global) {
  'use strict';

  // Approximate, browser- and Node-safe "dry-run" simulator for a single
  // edited object (event/card). It reuses the canonical predicate evaluator
  // (ProjectMapPredicateConditionModel + ProjectMapPredicateRuntimeEval) for
  // condition gating, and mirrors route_runtime_trial_model's safe "= += -="
  // effect subset for state mutation, so option availability and effect deltas
  // agree with the route collision sampler. It deliberately covers only one
  // object's internal flow: cross-scene routes are reported as boundaries, and
  // anything it cannot evaluate safely is surfaced as a skipped note rather than
  // silently guessed. The full Dendry engine remains the source of truth.

  const SAFE_OPS = ['=', '+=', '-='];

  const api = {
    isSupported,
    collectVariables,
    initialState,
    resolveText,
    parseEffect,
    applyEffects,
    buildEntryView,
    chooseOption
  };

  if (global) {
    global.ProjectMapObjectPlaySimulator = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  function ensureArray(value) {
    if (Array.isArray(value)) {
      return value;
    }
    return value == null ? [] : [value];
  }

  function cleanVariable(value) {
    return String(value == null ? '' : value).trim().replace(/^Q\./, '');
  }

  function stateNumber(state, name) {
    const key = cleanVariable(name);
    const raw = state && Object.prototype.hasOwnProperty.call(state, key) ? state[key] : 0;
    const num = Number(raw);
    return Number.isFinite(num) ? num : (raw ? 1 : 0);
  }

  // Resolve the predicate model + evaluator from injected options (Node checks)
  // or the loaded browser globals. Returns null when neither is available, in
  // which case conditions are treated as "unknown" rather than guessed.
  function predicateModels(options) {
    const opts = options || {};
    const model = opts.conditionModel || (global && global.ProjectMapPredicateConditionModel);
    const evaler = opts.runtimeEval || (global && global.ProjectMapPredicateRuntimeEval);
    if (model && typeof model.summarizePredicate === 'function' &&
        evaler && typeof evaler.evaluateAst === 'function') {
      return {model: model, evaler: evaler};
    }
    return null;
  }

  // true / false / null(unknown). An empty condition is always available.
  function evaluateCondition(condition, state, models) {
    const cond = String(condition == null ? '' : condition).trim();
    if (!cond) {
      return true;
    }
    if (!models) {
      return null;
    }
    const summary = models.model.summarizePredicate(cond);
    if (!summary || !summary.ast) {
      return null;
    }
    return Boolean(models.evaler.evaluateAst(summary.ast, state || {}));
  }

  function isSupported(eventBody) {
    if (!eventBody || typeof eventBody !== 'object') {
      return false;
    }
    return ensureArray(eventBody.options).length > 0;
  }

  // ---- variable discovery (seeds the editable starting-state panel) ----

  function addCondVariables(condition, models, acc) {
    const cond = String(condition == null ? '' : condition).trim();
    if (!cond) {
      return;
    }
    if (models) {
      const summary = models.model.summarizePredicate(cond);
      if (summary && Array.isArray(summary.dependencies)) {
        summary.dependencies.forEach((dep) => {
          const name = cleanVariable(dep);
          if (name) {
            acc.add(name);
          }
        });
        return;
      }
    }
    // Fallback: pull bare identifiers, dropping operators/keywords/numbers.
    (cond.match(/[A-Za-z_][A-Za-z0-9_.]*/g) || []).forEach((token) => {
      const name = cleanVariable(token);
      if (name && !/^(and|or|not|true|false)$/i.test(name)) {
        acc.add(name);
      }
    });
  }

  function addEffectVariables(expression, acc) {
    const parsed = parseEffect(expression);
    if (parsed) {
      acc.add(parsed.variable);
      const rhsName = cleanVariable(parsed.rhs);
      if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(parsed.rhs) && !/^(true|false)$/i.test(rhsName)) {
        acc.add(rhsName);
      }
    }
  }

  function addTextVariables(text, acc) {
    const value = String(text == null ? '' : text);
    const pattern = /\[\+\s*([^:+\]]+?)\s*(?::[^\]]*)?\+\]/g;
    let match;
    while ((match = pattern.exec(value)) !== null) {
      const name = cleanVariable(match[1]);
      if (name) {
        acc.add(name);
      }
    }
  }

  function collectVariables(eventBody, options) {
    const models = predicateModels(options);
    const acc = new Set();
    const body = eventBody || {};
    ensureArray(body.options).forEach((option) => {
      addCondVariables(optionCondition(option), models, acc);
    });
    [body.effects, body.sectionEffects, body.optionEffects].forEach((list) => {
      ensureArray(list).forEach((effect) => {
        addEffectVariables(effect && (effect.sourceExpression || effect.value), acc);
        addCondVariables(effect && effect.condition, models, acc);
      });
    });
    [body.sections, body.branchSections].forEach((list) => {
      ensureArray(list).forEach((section) => {
        addTextVariables(section && section.value, acc);
        ensureArray(section && section.conditions).forEach((cond) => addCondVariables(cond, models, acc));
        if (section && section.role === 'conditional_leaf_condition') {
          addCondVariables(section.value, models, acc);
        }
      });
    });
    return Array.from(acc).sort();
  }

  function initialState(eventBody, overrides, options) {
    const state = {};
    collectVariables(eventBody, options).forEach((name) => {
      state[name] = 0;
    });
    if (overrides && typeof overrides === 'object') {
      Object.keys(overrides).forEach((key) => {
        const name = cleanVariable(key);
        if (name) {
          const num = Number(overrides[key]);
          state[name] = Number.isFinite(num) ? num : overrides[key];
        }
      });
    }
    return state;
  }

  // ---- state-aware text resolution ([+ var +] and [? if cond : body ?]) ----

  function resolveText(rawText, state, options) {
    const models = predicateModels(options);
    return resolveSpan(String(rawText == null ? '' : rawText), state || {}, models);
  }

  function resolveSpan(text, state, models) {
    let out = '';
    let index = 0;
    while (index < text.length) {
      if (text.startsWith('[+', index)) {
        const end = text.indexOf('+]', index + 2);
        if (end > index) {
          out += formatVariableToken(text.slice(index + 2, end), state);
          index = end + 2;
          continue;
        }
      }
      if (text.startsWith('[?', index)) {
        const end = findConditionalEnd(text, index);
        if (end > index) {
          out += resolveConditional(text.slice(index + 2, end), state, models);
          index = end + 2;
          continue;
        }
      }
      out += text[index];
      index += 1;
    }
    return out;
  }

  function findConditionalEnd(text, start) {
    let depth = 1;
    let index = start + 2;
    while (index < text.length) {
      if (text.startsWith('[?', index)) {
        depth += 1;
        index += 2;
        continue;
      }
      if (text.startsWith('?]', index)) {
        depth -= 1;
        if (depth === 0) {
          return index;
        }
        index += 2;
        continue;
      }
      index += 1;
    }
    return -1;
  }

  function splitConditional(inner) {
    const text = String(inner == null ? '' : inner).trim().replace(/^if\s+/i, '');
    let depth = 0;
    for (let index = 0; index < text.length; index += 1) {
      if (text.startsWith('[?', index)) {
        depth += 1;
        index += 1;
        continue;
      }
      if (text.startsWith('?]', index)) {
        depth -= 1;
        index += 1;
        continue;
      }
      if (text[index] === ':' && depth === 0) {
        return {condition: text.slice(0, index).trim(), body: text.slice(index + 1).trim()};
      }
    }
    return {condition: text.trim(), body: ''};
  }

  function resolveConditional(inner, state, models) {
    const parts = splitConditional(inner);
    const active = evaluateCondition(parts.condition, state, models);
    // Hide only when we can confidently evaluate the branch to false; when the
    // condition is unknown (no evaluator) keep the author's text visible rather
    // than dropping content the simulator simply could not judge.
    if (active === false) {
      return '';
    }
    return resolveSpan(parts.body, state, models);
  }

  function formatVariableToken(inner, state) {
    const name = String(inner == null ? '' : inner).split(':')[0].trim();
    if (!name) {
      return '';
    }
    return String(stateNumber(state, name));
  }

  // ---- effects ----

  function parseEffect(expression) {
    const match = String(expression == null ? '' : expression).trim()
      .match(/^([A-Za-z_][A-Za-z0-9_.]*)\s*(\+=|-=|\*=|\/=|=)\s*(.+)$/);
    if (!match) {
      return null;
    }
    return {variable: cleanVariable(match[1]), op: match[2], rhs: match[3].trim()};
  }

  function resolveRhsValue(rhs, state) {
    const raw = String(rhs == null ? '' : rhs).trim();
    if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
      return {ok: true, value: Number(raw)};
    }
    if (/^(true|false)$/i.test(raw)) {
      return {ok: true, value: /^true$/i.test(raw) ? 1 : 0};
    }
    if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(raw)) {
      return {ok: true, value: stateNumber(state, raw)};
    }
    return {ok: false};
  }

  // effectList: [{expression, condition, optionId, sectionId}] -> applied/skipped
  function applyEffects(state, effectList, options) {
    const models = predicateModels(options);
    const next = Object.assign({}, state);
    const applied = [];
    const skipped = [];
    ensureArray(effectList).forEach((entry) => {
      const expression = String(entry && (entry.expression || entry.sourceExpression || entry.value) || '').trim();
      if (!expression) {
        return;
      }
      const gate = evaluateCondition(entry && entry.condition, next, models);
      if (gate === false) {
        skipped.push({expression: expression, reason: 'condition_not_met'});
        return;
      }
      const parsed = parseEffect(expression);
      if (!parsed || SAFE_OPS.indexOf(parsed.op) === -1) {
        skipped.push({expression: expression, reason: 'unsupported_effect'});
        return;
      }
      const rhs = resolveRhsValue(parsed.rhs, next);
      if (!rhs.ok) {
        skipped.push({expression: expression, reason: 'unsupported_value'});
        return;
      }
      const from = stateNumber(next, parsed.variable);
      let to = from;
      if (parsed.op === '=') {
        to = rhs.value;
      } else if (parsed.op === '+=') {
        to = from + rhs.value;
      } else if (parsed.op === '-=') {
        to = from - rhs.value;
      }
      next[parsed.variable] = to;
      applied.push({variable: parsed.variable, op: parsed.op, from: from, to: to, expression: expression});
    });
    return {state: next, applied: applied, skipped: skipped};
  }

  function effectEntriesFor(list, predicate) {
    return ensureArray(list)
      .filter(predicate)
      .map((effect) => ({
        expression: effect.sourceExpression || effect.value,
        condition: effect.condition,
        optionId: effect.optionId,
        sectionId: effect.sectionId
      }))
      .filter((entry) => entry.expression);
  }

  // ---- option / section helpers ----

  function optionCondition(option) {
    if (!option) {
      return '';
    }
    if (option.sectionChooseIf) {
      return option.sectionChooseIf;
    }
    if (option.chooseIf) {
      return option.chooseIf;
    }
    if (option.target && option.target.condition) {
      return option.target.condition;
    }
    return '';
  }

  function openingText(eventBody) {
    const body = eventBody || {};
    const parts = [];
    ensureArray(body.sections).forEach((section) => {
      if (section && section.role === 'section_text' && section.group === 'page_sections') {
        parts.push(String(section.value == null ? '' : section.value));
      }
    });
    ensureArray(body.branchSections).forEach((section) => {
      if (section && section.role === 'section_text') {
        parts.push(String(section.value == null ? '' : section.value));
      }
    });
    return parts.filter((part) => part.trim()).join('\n\n');
  }

  function describeOption(option, state, models) {
    const condition = optionCondition(option);
    return {
      id: String(option && option.id || ''),
      label: String(option && option.label || ''),
      subtitle: String(option && option.subtitle || ''),
      targetId: String(option && option.targetId || ''),
      condition: condition,
      available: evaluateCondition(condition, state, models),
      unavailableText: String(option && option.unavailableText || '')
    };
  }

  function buildEntryView(eventBody, state, options) {
    const models = predicateModels(options);
    const body = eventBody || {};
    const onArrival = effectEntriesFor(body.effects, (effect) =>
      effect && !effect.optionId && !effect.sectionId &&
      String(effect.effectHook || '').indexOf('arrival') !== -1);
    const onArrivalResult = applyEffects(state || {}, onArrival, options);
    return {
      nodeId: '',
      heading: String(body.title && body.title.value || body.heading && body.heading.value || ''),
      text: resolveText(openingText(body), onArrivalResult.state, options),
      onArrival: onArrivalResult,
      options: ensureArray(body.options).map((option) =>
        describeOption(option, onArrivalResult.state, models))
    };
  }

  function continuationFor(eventBody, optionId) {
    const items = ensureArray(eventBody && eventBody.continuationMap && eventBody.continuationMap.items);
    const item = items.filter((entry) => String(entry && entry.choiceId || '') === optionId)[0];
    if (!item) {
      return null;
    }
    return {
      kind: String(item.kind || ''),
      resultTarget: String(item.resultTarget || ''),
      nextTarget: String(item.nextTarget || ''),
      label: String(item.label || '')
    };
  }

  function resultProse(eventBody, targetId, state, options) {
    const body = eventBody || {};
    let title = '';
    let subtitle = '';
    const textParts = [];
    ensureArray(body.branchSections).forEach((section) => {
      if (!section || section.sectionId !== targetId) {
        return;
      }
      if (section.role === 'title' && !title) {
        title = String(section.value || '');
      } else if (section.role === 'subtitle' && !subtitle) {
        subtitle = String(section.value || '');
      } else if (section.role === 'section_text') {
        textParts.push(String(section.value || ''));
      }
    });
    ensureArray(body.sections).forEach((section) => {
      if (section && section.sectionId === targetId && section.role === 'section_text') {
        textParts.push(String(section.value || ''));
      }
    });
    return {
      title: title,
      subtitle: subtitle,
      text: resolveText(textParts.join('\n\n'), state, options)
    };
  }

  function chooseOption(eventBody, state, optionId, options) {
    const body = eventBody || {};
    const models = predicateModels(options);
    const option = ensureArray(body.options)
      .filter((entry) => String(entry && entry.id || '') === String(optionId))[0];
    if (!option) {
      return {ok: false, reason: 'unknown_option'};
    }
    const condition = optionCondition(option);
    const available = evaluateCondition(condition, state || {}, models);
    if (available === false) {
      return {
        ok: false,
        reason: 'condition_not_met',
        condition: condition,
        unavailableText: String(option.unavailableText || '')
      };
    }
    const effects = effectEntriesFor(body.sectionEffects, (effect) =>
      effect && effect.sectionId === option.targetId)
      .concat(effectEntriesFor(body.optionEffects, (effect) =>
        effect && String(effect.optionId || '') === String(optionId)));
    const result = applyEffects(state || {}, effects, options);
    return {
      ok: true,
      optionId: String(optionId),
      targetId: String(option.targetId || ''),
      state: result.state,
      delta: result.applied,
      skipped: result.skipped,
      result: resultProse(body, option.targetId, result.state, options),
      continuation: continuationFor(body, String(optionId))
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
