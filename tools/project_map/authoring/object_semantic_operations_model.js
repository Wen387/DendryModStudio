(function initProjectMapObjectSemanticOperationsModel(global) {
  'use strict';

  function buildSemanticOperations(eventBody, projectIndex, options) {
    const body = isObject(eventBody) ? eventBody : {};
    const opts = isObject(options) ? options : {};
    return {
      operationGroups: semanticOperationGroups(body, projectIndex, opts),
      operationCards: [],
      advancedItems: [],
      variableEvidence: variableEvidenceMap(projectIndex)
    };
  }

  function semanticOperationGroups(body, projectIndex, options) {
    const variables = variableEvidenceMap(projectIndex);
    const groups = [];
    const topEffects = buildEffectOperations(body && body.effects, {variables, ownerKind: 'event'});
    if (topEffects.cards.length || topEffects.advancedItems.length) {
      groups.push(Object.assign({kind: 'state_changes', ownerKind: 'event'}, topEffects));
    }
    ensureArray(body && body.optionEffects).forEach((group) => {
      const effects = buildEffectOperations(group && group.fields, {
        variables,
        ownerKind: 'option',
        ownerId: group && (group.optionId || group.id),
        ownerLabel: group && group.label
      });
      if (effects.cards.length || effects.advancedItems.length || effects.structureRows.length) {
        groups.push(Object.assign({
          kind: 'state_changes',
          ownerKind: 'option',
          ownerId: stringValue(group && (group.optionId || group.id)),
          ownerLabel: stringValue(group && group.label)
        }, effects));
      }
    });
    return groups;
  }

  function buildEffectOperations(fields, options) {
    const opts = isObject(options) ? options : {};
    const variables = opts.variables || {};
    const rows = pairedEffectRows(fields);
    const cards = [];
    const advancedItems = [];
    const structureRows = [];
    rows.forEach((row) => {
      if (row.kind === 'add' || row.kind === 'structure' || row.kind === 'effect-delete') {
        structureRows.push(row);
        return;
      }
      const card = effectCardFromRow(row, variables, opts);
      if (card.kind === 'advanced_source') {
        advancedItems.push(card);
      } else {
        cards.push(card);
      }
    });
    return {cards, advancedItems, structureRows};
  }

  function effectCardFromRow(row, variables, options) {
    const field = row && row.field || {};
    const split = splitEffectFields(row && row.splitFields);
    if (split) {
      return splitEffectCard(split, row, variables, options);
    }
    const parsed = parseEffectExpression(effectExpressionText(field));
    if (!parsed || !isEffectCardStructurable(field)) {
      return advancedEffectCard(field, row, options, parsed ? '' : 'unparsed_effect_expression');
    }
    const variable = normalizeVariableDisplay(parsed.variable);
    return {
      kind: 'state_change',
      sourceKind: 'expression',
      id: fieldId(field),
      sourceFieldId: fieldId(field),
      variable,
      variableName: bareVariableName(variable),
      op: parsed.op,
      value: parsed.value,
      condition: parsed.condition,
      hook: stringValue(field.effectHook || field.hook),
      sourceExpression: parsed.sourceExpression,
      evidence: evidenceForField(field),
      editability: effectEditability(field),
      removeAction: row && row.removeAction || null,
      variableEvidence: variables[bareVariableName(variable)] || null,
      field
    };
  }

  function splitEffectCard(split, row, variables, _options) {
    const variable = normalizeVariableDisplay(fieldValue(split.variable));
    return {
      kind: 'state_change',
      sourceKind: 'split_fields',
      id: split.prefix,
      variable,
      variableName: bareVariableName(variable),
      op: fieldValue(split.op) || '+=',
      value: fieldValue(split.value),
      condition: fieldValue(split.condition),
      hook: fieldValue(split.hook),
      sourceExpression: composeEffectExpression(variable, fieldValue(split.op) || '+=', fieldValue(split.value), fieldValue(split.condition)),
      evidence: evidenceForField(split.variable || split.value || {}),
      editability: 'structured_fields',
      removeAction: row && row.removeAction || null,
      variableEvidence: variables[bareVariableName(variable)] || null,
      fields: split
    };
  }

  function advancedEffectCard(field, row, _options, reason) {
    return {
      kind: 'advanced_source',
      sourceKind: 'effect',
      id: fieldId(field),
      label: stringValue(field && field.label) || 'Effect source',
      reason: stringValue(reason || field && field.sourceLineSafety || field && field.editability || 'advanced_source'),
      sourceExpression: effectExpressionText(field),
      evidence: evidenceForField(field),
      editability: effectEditability(field),
      removeAction: row && row.removeAction || null,
      field
    };
  }

  function splitEffectFields(fields) {
    const rows = ensureArray(fields).filter(Boolean);
    if (!rows.length) {
      return null;
    }
    const byPart = {};
    let prefix = '';
    rows.forEach((field) => {
      const parsed = splitEffectFieldId(fieldId(field));
      if (!parsed) {
        return;
      }
      byPart[parsed.part] = field;
      prefix = prefix || parsed.prefix;
    });
    if (!byPart.variable && !byPart.value) {
      return null;
    }
    return Object.assign({prefix}, byPart);
  }

  function splitEffectFieldId(id) {
    const text = stringValue(id);
    const match = text.match(/^(.*\.effect\.(?:\d+|add))\.(variable|op|value|condition|hook)$/i);
    if (!match) {
      return null;
    }
    return {prefix: match[1], part: match[2].toLowerCase()};
  }

  function pairedEffectRows(fields) {
    const normal = [];
    const splitGroups = {};
    const removeActions = [];
    const addActions = [];
    const otherStructure = [];
    ensureArray(fields).forEach((field) => {
      const action = stringValue(field && field.structureAction);
      if (action === 'remove_effect') {
        removeActions.push(field);
        return;
      }
      if (/^add_/.test(action)) {
        addActions.push(field);
        return;
      }
      if (action) {
        otherStructure.push(field);
        return;
      }
      const split = splitEffectFieldId(fieldId(field));
      if (split && split.part && split.prefix && !/\.add$/i.test(split.prefix)) {
        splitGroups[split.prefix] = splitGroups[split.prefix] || [];
        splitGroups[split.prefix].push(field);
        return;
      }
      normal.push(field);
    });
    const usedRemove = new Set();
    const rows = [];
    normal.forEach((field) => {
      const removeAction = matchingRemoveEffectAction(field, removeActions, usedRemove);
      if (removeAction) {
        usedRemove.add(removeAction);
      }
      rows.push({kind: 'effect', field, removeAction});
    });
    Object.keys(splitGroups).sort().forEach((prefix) => {
      const removeAction = matchingRemoveEffectActionForSplit(splitGroups[prefix], removeActions, usedRemove);
      if (removeAction) {
        usedRemove.add(removeAction);
      }
      rows.push({kind: 'effect', splitFields: splitGroups[prefix], removeAction});
    });
    removeActions.forEach((field) => {
      if (!usedRemove.has(field)) {
        rows.push({kind: 'effect-delete', field});
      }
    });
    otherStructure.forEach((field) => rows.push({kind: 'structure', field}));
    addActions.forEach((field) => rows.push({kind: 'add', field}));
    return rows;
  }

  function matchingRemoveEffectActionForSplit(fields, removeActions, usedRemove) {
    const split = splitEffectFields(fields);
    if (!split) {
      return null;
    }
    const key = normalizedEffectKey(composeEffectExpression(fieldValue(split.variable), fieldValue(split.op) || '+=', fieldValue(split.value), fieldValue(split.condition)));
    return bestRemoveAction(key, split.variable || fields[0], removeActions, usedRemove);
  }

  function matchingRemoveEffectAction(field, removeActions, usedRemove) {
    return bestRemoveAction(normalizedEffectKey(fieldValue(field)), field, removeActions, usedRemove);
  }

  function bestRemoveAction(key, field, removeActions, usedRemove) {
    if (!key) {
      return null;
    }
    let best = null;
    let bestScore = 0;
    ensureArray(removeActions).forEach((action) => {
      if (usedRemove.has(action)) {
        return;
      }
      const actionKey = normalizedEffectKey(action && (action.structureBefore || action.structureSourceExpression || action.before || action.value || action.original));
      if (!actionKey || actionKey !== key) {
        return;
      }
      const score = effectMatchScore(field, action);
      if (score > bestScore) {
        best = action;
        bestScore = score;
      }
    });
    return best;
  }

  function effectMatchScore(field, action) {
    let score = 1;
    if (stringValue(field && field.optionId) && stringValue(field && field.optionId) === stringValue(action && action.optionId)) {
      score += 3;
    }
    if (stringValue(field && field.sectionId) && stringValue(field && field.sectionId) === stringValue(action && action.sectionId)) {
      score += 2;
    }
    const fieldSource = field && field.source || {};
    const actionSource = action && action.source || {};
    if (stringValue(fieldSource.path) && stringValue(fieldSource.path) === stringValue(actionSource.path)) {
      score += 1;
    }
    const fieldLine = Number(fieldSource.line || fieldSource.startLine || 0);
    const actionLine = Number(actionSource.line || actionSource.startLine || 0);
    if (fieldLine && actionLine && fieldLine === actionLine) {
      score += 4;
    }
    return score;
  }

  function parseEffectExpression(value) {
    const sourceExpression = normalizedEffectKey(value);
    if (!sourceExpression || /;/.test(sourceExpression)) {
      return null;
    }
    const parts = sourceExpression.match(/^(.*?)\s+if\s+(.+)$/i);
    const effectPart = parts ? parts[1].trim() : sourceExpression;
    const condition = parts ? parts[2].trim() : '';
    const match = effectPart.match(/^(Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|\/=|=)\s*(.+)$/);
    if (!match) {
      return null;
    }
    return {
      variable: (match[1] || 'Q.') + match[2],
      op: match[3],
      value: match[4].trim(),
      condition,
      sourceExpression
    };
  }

  function effectExpressionText(field) {
    return stringValue(field && (field.sourceExpression || field.displayExpression || field.value || field.original));
  }

  function isEffectCardStructurable(field) {
    if (!field) {
      return false;
    }
    if (field.readOnly) {
      return false;
    }
    const editability = stringValue(field.editability || field.status || '');
    if (field.sharedSourceLine && !/exact_token_guarded|single_expression_guarded|guarded/i.test(stringValue(field.sourceLineSafety))) {
      return false;
    }
    return !/advanced|manual|readonly|read_only/i.test(editability);
  }

  function effectEditability(field) {
    if (!field) {
      return 'unknown';
    }
    if (field.readOnly) {
      return 'read_only';
    }
    if (!isEffectCardStructurable(field)) {
      return 'advanced_source';
    }
    return 'guarded';
  }

  function variableEvidenceMap(projectIndex) {
    const out = {};
    ensureArray(projectIndex && projectIndex.variables).forEach((variable) => {
      const name = bareVariableName(variable && variable.name);
      if (!name) {
        return;
      }
      out[name] = {
        name,
        displayName: 'Q.' + name,
        readCount: numberValue(variable.readCount !== undefined ? variable.readCount : variable.reads && variable.reads.length),
        writeCount: numberValue(variable.writeCount !== undefined ? variable.writeCount : variable.writes && variable.writes.length),
        sourceHints: ensureArray(variable.sourceHints).concat(sourceHintsFromRefs(variable.reads), sourceHintsFromRefs(variable.writes)).filter(Boolean).slice(0, 4)
      };
    });
    return out;
  }

  function sourceHintsFromRefs(refs) {
    return ensureArray(refs).map((ref) => {
      const source = sourceRef(ref && (ref.source || ref));
      if (!source.path) {
        return '';
      }
      return source.path + (source.line ? ':' + source.line : '');
    });
  }

  function evidenceForField(field) {
    const source = sourceRef(field && field.source || {});
    return {
      source,
      sourceLabel: source.path ? source.path + (source.line ? ':' + source.line : '') : '',
      sourceExpression: effectExpressionText(field),
      sourceLineSafety: stringValue(field && field.sourceLineSafety),
      sharedSourceLine: Boolean(field && field.sharedSourceLine),
      sourceLineEffectCount: numberValue(field && field.sourceLineEffectCount)
    };
  }

  function composeEffectExpression(variable, op, value, condition) {
    const left = normalizeVariableDisplay(variable);
    const operator = stringValue(op || '+=');
    const right = stringValue(value || '0');
    const expr = [left, operator, right].filter(Boolean).join(' ');
    const cond = stringValue(condition);
    return cond ? expr + ' if ' + cond : expr;
  }

  function normalizedEffectKey(value) {
    return stringValue(value)
      .replace(/^\s*on-(?:arrival|departure|display)\s*:\s*/i, '')
      .replace(/;\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeVariableDisplay(value) {
    const text = stringValue(value).replace(/^Q\./, '');
    return text ? 'Q.' + text : '';
  }

  function bareVariableName(value) {
    return stringValue(value).replace(/^Q\./, '');
  }

  function fieldId(field) {
    return stringValue(field && (field.id || field.fieldId));
  }

  function fieldValue(field) {
    return field && field.value !== undefined ? stringValue(field.value) : stringValue(field && field.original);
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    return {
      path: stringValue(value.path),
      line: Number(value.line || value.startLine || 0) || 0,
      startLine: Number(value.startLine || value.line || 0) || 0,
      endLine: Number(value.endLine || value.line || value.startLine || 0) || 0
    };
  }

  function numberValue(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function stringValue(value) {
    return value === undefined || value === null ? '' : String(value).trim();
  }

  const api = {
    buildSemanticOperations,
    buildEffectOperations,
    parseEffectExpression,
    composeEffectExpression,
    variableEvidenceMap
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectSemanticOperations = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
