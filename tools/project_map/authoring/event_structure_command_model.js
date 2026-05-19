// @ts-check
(function initProjectMapEventStructureCommandModel(global) {
  'use strict';

  /**
   * @typedef {import('../types/project_map_contracts').EventStructureCommandModelApi} EventStructureCommandModelApi
   * @typedef {import('../types/project_map_contracts').EventStructureCommand} EventStructureCommand
   */

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
      throw new Error('ProjectMapEventStructureEffectModel is required before ProjectMapEventStructureCommandModel.');
    }
    return api;
  }

  function applyCommand(structure, command) {
    const next = clone(isObject(structure) ? structure : {});
    const cmd = /** @type {Record<string, any>} */ (isObject(command) ? command : {});
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
      addSection(next, parseBranch(cmd.value || cmd.raw || cmd.text));
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

  function commandsFromValues(values, structure) {
    const data = /** @type {Record<string, any>} */ (isObject(values) ? values : {});
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
    const value = /** @type {Record<string, any>} */ (isObject(input) ? input : {});
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
    } catch (_err) {
      return [];
    }
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
    return eventEffectModel().parseEffect(value);
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

  function sectionById(structure, sectionId) {
    const raw = stringValue(sectionId).trim();
    if (!raw) {
      return null;
    }
    const id = safeId(raw);
    return ensureArray(structure && structure.sections).find((section) => safeId(section && section.id) === id) || null;
  }

  function effectValue(value, op) {
    return eventEffectModel().effectValue(value, op);
  }

  function normalizeEffectOp(value) {
    return eventEffectModel().normalizeEffectOp(value);
  }

  function rawEffectLines(value) {
    return eventEffectModel().rawEffectLines(value);
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

  function humanize(value) {
    return stringValue(value).replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
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

  const api = /** @type {EventStructureCommandModelApi} */ ({
    applyCommand,
    commandsFromValues,
    parseAddOption,
    parseBranch,
    isEventStructureField
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapEventStructureCommandModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
