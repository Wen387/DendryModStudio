(function initProjectMapSemanticLogicEditor(global) {
  'use strict';

  const SEMANTIC_LOGIC_EDITOR_VERSION = '0.1';
  const MODEL_KIND = 'semantic_logic_editor_model';
  const PROPOSAL_KIND = 'semantic_logic_editor_proposal';
  const APPLY_INSTALL = new Set(['safe_apply', 'guarded_apply', 'advanced_apply']);
  const GUIDED_EFFECT_OPS = new Set(['=', '+=', '-=']);

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function sourceSliceApi() {
    if (global && global.ProjectMapSourceSliceEditor) {
      return global.ProjectMapSourceSliceEditor;
    }
    if (typeof require === 'function') {
      try {
        return require('./source_slice_editor_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function buildSemanticLogicEditor(projectIndex, input, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const normalized = normalizeInput(input || {});
    const semanticEditor = normalizeSemanticEditor(normalized.semanticEditor, normalized);
    const sourceApi = sourceSliceApi();
    const sourceSlice = sourceApi && typeof sourceApi.buildSourceSliceEditor === 'function'
      ? sourceApi.buildSourceSliceEditor(index, {editAction: normalized.editAction || normalized})
      : null;
    const source = sourceRef(sourceSlice && sourceSlice.source || normalized.source || {});
    const evidence = evidenceFor(index, semanticEditor, source, normalized);
    const installSafety = normalizeSafety(normalized.installSafety || sourceSlice && sourceSlice.installSafety || semanticEditor.installSafety);
    const operationType = String(normalized.operationType || sourceSlice && sourceSlice.operationType || operationTypeFor(source));
    const currentText = String(sourceSlice && sourceSlice.currentText || source.anchorText || normalized.label || '');
    const mappingBug = !source.path || Boolean(sourceSlice && sourceSlice.mappingBug);
    const fieldControls = fieldControlsFor(semanticEditor, evidence, currentText);
    const diagnostics = ensureArray(sourceSlice && sourceSlice.diagnostics);
    if (!sourceApi || typeof sourceApi.buildSourceSliceEditor !== 'function') {
      diagnostics.push(diagnostic('error', 'semantic_logic.source_slice_unavailable', 'Source-backed semantic editor cannot prepare an install operation because Source Slice is unavailable.'));
    }
    return {
      schemaVersion: SEMANTIC_LOGIC_EDITOR_VERSION,
      kind: MODEL_KIND,
      ok: Boolean(sourceSlice && sourceSlice.ok && APPLY_INSTALL.has(installSafety)),
      mappingBug,
      playerLimit: false,
      editorKind: semanticEditor.kind,
      editorLabel: editorLabel(semanticEditor.kind),
      title: semanticEditor.title || normalized.label || editorLabel(semanticEditor.kind),
      role: semanticEditor.role || normalized.role,
      sceneId: semanticEditor.sceneId || normalized.sceneId,
      fieldId: normalized.fieldId,
      valueKey: normalized.valueKey,
      targetId: normalized.targetId,
      targetView: normalized.targetView || 'source_slice',
      routeClass: normalized.routeClass || sourceSlice && sourceSlice.routeClass || '',
      installSafety,
      operationType,
      source,
      sourcePath: source.path,
      line: source.line || null,
      startLine: source.startLine || source.line || null,
      endLine: source.endLine || source.line || null,
      currentText,
      fieldControls,
      fieldControlMode: fieldControls && fieldControls.mode || '',
      sourceSliceModel: sourceSlice,
      canCreateOperation: Boolean(sourceSlice && sourceSlice.canCreateOperation && currentText),
      semanticEditor,
      evidence,
      routeEvidence: evidence.routeEvidence,
      effectEvidence: evidence.effectEvidence,
      dynamicKeyEvidence: evidence.dynamicKeyEvidence,
      routerEvidence: evidence.routerEvidence,
      operationTemplate: normalized.operationTemplate || sourceSlice && sourceSlice.operationTemplate || null,
      diagnostics
    };
  }

  function buildProposal(projectIndex, input, values) {
    const first = isObject(projectIndex) ? projectIndex : {};
    const model = first.kind === MODEL_KIND
      ? first
      : input && input.kind === MODEL_KIND
      ? input
      : buildSemanticLogicEditor(projectIndex, input, {});
    const replacements = first.kind === MODEL_KIND
      ? (isObject(input) ? input : {})
      : (isObject(values) ? values : {});
    const replacementText = composeFieldReplacement(model, replacements);
    const sourceApi = sourceSliceApi();
    if (!model || !model.ok || !model.canCreateOperation || !sourceApi || typeof sourceApi.buildProposal !== 'function') {
      return {
        schemaVersion: SEMANTIC_LOGIC_EDITOR_VERSION,
        kind: PROPOSAL_KIND,
        ok: false,
        mappingBug: Boolean(model && model.mappingBug),
        playerLimit: false,
        semanticEditor: model && model.semanticEditor || null,
        installPlan: null,
        operations: [],
        diagnostics: ensureArray(model && model.diagnostics).concat(diagnostic('error', 'semantic_logic.no_operation', 'No semantic logic operation can be generated until source mapping is fixed.'))
      };
    }
    const proposal = sourceApi.buildProposal(model.sourceSliceModel || model, {replacementText});
    return Object.assign({}, proposal || {}, {
      schemaVersion: SEMANTIC_LOGIC_EDITOR_VERSION,
      kind: PROPOSAL_KIND,
      ok: Boolean(proposal && proposal.ok),
      title: model.title,
      editorKind: model.editorKind,
      semanticEditor: model.semanticEditor,
      evidence: model.evidence,
      source: model.source,
      replacementText,
      diagnostics: ensureArray(proposal && proposal.diagnostics)
    });
  }

  function composeFieldReplacement(model, values) {
    const editor = isObject(model) ? model : {};
    const replacements = isObject(values) ? values : {};
    if (replacements.replacementText !== undefined) {
      return String(replacements.replacementText === null ? '' : replacements.replacementText);
    }
    if (replacements['semantic_logic.replacementText'] !== undefined) {
      return String(replacements['semantic_logic.replacementText'] === null ? '' : replacements['semantic_logic.replacementText']);
    }
    if (replacements.content !== undefined) {
      return String(replacements.content === null ? '' : replacements.content);
    }
    if (replacements.replace !== undefined) {
      return String(replacements.replace === null ? '' : replacements.replace);
    }
    const controls = editor.fieldControls || {};
    if (controls.mode === 'route') {
      return composeRouteReplacement(editor, replacements);
    }
    if (controls.mode === 'effect') {
      return composeEffectReplacement(editor, replacements);
    }
    return String(editor.currentText || '');
  }

  function fieldControlsFor(semanticEditor, evidence, currentText) {
    const kind = String(semanticEditor && semanticEditor.kind || '');
    if (kind === 'route_order') {
      return routeFieldControls(semanticEditor, evidence, currentText);
    }
    if (kind === 'effect_clause') {
      return effectFieldControls(semanticEditor, evidence, currentText);
    }
    return null;
  }

  function routeFieldControls(semanticEditor, evidence, currentText) {
    const text = String(currentText || '').trim();
    const routeEvidence = ensureArray(evidence && evidence.routeEvidence);
    const routeClauses = routeClausesFromEvidence(routeEvidence);
    const clause = routeClauses[0] || parseRouteClause(text);
    const optionLine = parseOptionLine(text);
    const target = optionLine && optionLine.target || clause && clause.target || '';
    const predicate = optionLine ? '' : clause && clause.predicate || '';
    const label = optionLine && optionLine.label || '';
    return {
      mode: 'route',
      editorKind: 'route_order',
      pattern: optionLine ? 'option_line' : 'route_clause',
      originalText: String(currentText || ''),
      originalSegment: optionLine && optionLine.segment || clause && clause.segment || String(currentText || ''),
      linePrefix: clause && clause.linePrefix || '',
      prefix: optionLine && optionLine.prefix || '@',
      target,
      predicate,
      label,
      routeClauses,
      isFallback: Boolean(clause && clause.isFallback),
      parserBacked: Boolean(clause && clause.parserBacked),
      fields: [
        {id: 'routeTarget', valueKey: 'semantic_logic.routeTarget', label: 'Target', value: target},
        {id: 'routePredicate', valueKey: 'semantic_logic.routePredicate', label: 'Predicate', value: predicate},
        {id: 'routeLabel', valueKey: 'semantic_logic.routeLabel', label: 'Label', value: label},
        {id: 'routeClauses', valueKey: 'semantic_logic.routeClauses', label: 'Route clauses', value: JSON.stringify(routeClauses)}
      ],
      source: semanticEditor && semanticEditor.source || null
    };
  }

  function effectFieldControls(semanticEditor, evidence, currentText) {
    const effectEvidence = ensureArray(evidence && evidence.effectEvidence);
    const effectClauses = effectClausesFromEvidence(effectEvidence, currentText);
    const row = effectClauses[0] || {};
    const parsed = row.variable ? row : parseEffectExpression(row.sourceExpression || currentText);
    const variable = String(row.variable || parsed && parsed.variable || '').replace(/^Q\./, '');
    const op = String(row.op || parsed && parsed.op || '');
    if (effectClauses.some((clause) => clause.op && !GUIDED_EFFECT_OPS.has(clause.op)) || op && !GUIDED_EFFECT_OPS.has(op)) {
      return null;
    }
    const value = String(row.value === undefined || row.value === null ? parsed && parsed.value || '' : row.value);
    const condition = String(row.condition || parsed && parsed.condition || '');
    const sourceExpression = String(row.sourceExpression || parsed && parsed.segment || [variable ? 'Q.' + variable : '', op, value].filter(Boolean).join(' '));
    return {
      mode: 'effect',
      editorKind: 'effect_clause',
      originalText: String(currentText || ''),
      originalSegment: sourceExpression,
      variable,
      op,
      value,
      condition,
      effectClauses,
      sharedLine: Number(row.lineEffectCount || 0) > 1,
      dynamicKey: ensureArray(evidence && evidence.dynamicKeyEvidence).length > 0,
      parserBacked: Boolean(effectEvidence.length),
      fields: [
        {id: 'effectVariable', valueKey: 'semantic_logic.effectVariable', label: 'Variable', value: variable},
        {id: 'effectOperator', valueKey: 'semantic_logic.effectOperator', label: 'Operator', value: op || '='},
        {id: 'effectValue', valueKey: 'semantic_logic.effectValue', label: 'Value', value},
        {id: 'effectCondition', valueKey: 'semantic_logic.effectCondition', label: 'Condition', value: condition},
        {id: 'effectClauses', valueKey: 'semantic_logic.effectClauses', label: 'Effect clauses', value: JSON.stringify(effectClauses)}
      ],
      source: semanticEditor && semanticEditor.source || null
    };
  }

  function composeRouteReplacement(model, values) {
    const controls = model && model.fieldControls || {};
    const current = String(model && model.currentText || controls.originalText || '');
    const routeClauses = normalizeRouteClausesInput(valueFor(values, 'semantic_logic.routeClauses', null));
    if (routeClauses.length && controls.pattern !== 'option_line') {
      const rendered = renderRouteClauseList(routeClauses);
      if (!rendered) {
        return current;
      }
      return String(controls.linePrefix || '') + rendered;
    }
    const target = cleanRouteTarget(valueFor(values, 'semantic_logic.routeTarget', controls.target));
    const predicate = String(valueFor(values, 'semantic_logic.routePredicate', controls.predicate) || '').trim();
    const label = String(valueFor(values, 'semantic_logic.routeLabel', controls.label) || '').trim();
    if (!target) {
      return current;
    }
    if (controls.pattern === 'option_line') {
      const prefix = /^[#@]$/.test(String(controls.prefix || '')) ? controls.prefix : '@';
      const routeText = '- ' + prefix + target + ': ' + label;
      return routeText.trimEnd();
    }
    if (controls.linePrefix) {
      return String(controls.linePrefix || '') + target + (predicate ? ' if ' + predicate : '');
    }
    return target + (predicate ? ' if ' + predicate : '');
  }

  function composeEffectReplacement(model, values) {
    const controls = model && model.fieldControls || {};
    const current = String(model && model.currentText || controls.originalText || '');
    const effectClauses = normalizeEffectClausesInput(valueFor(values, 'semantic_logic.effectClauses', null));
    if (effectClauses.length) {
      const rendered = renderEffectClauseList(effectClauses, controls);
      if (!rendered) {
        return current;
      }
      return hookPrefixForCurrent(current) + rendered;
    }
    const variable = cleanVariable(valueFor(values, 'semantic_logic.effectVariable', controls.variable));
    const op = cleanOperator(valueFor(values, 'semantic_logic.effectOperator', controls.op));
    const rawValue = valueFor(values, 'semantic_logic.effectValue', controls.value);
    const value = String(rawValue === undefined || rawValue === null ? '' : rawValue).trim();
    const condition = String(valueFor(values, 'semantic_logic.effectCondition', controls.condition) || '').trim();
    if (!variable || !op || !value) {
      return current;
    }
    const expression = 'Q.' + variable + ' ' + op + ' ' + value + (condition ? ' if ' + condition : '');
    const segment = String(controls.originalSegment || '').trim();
    if (segment && current.indexOf(segment) >= 0) {
      return current.replace(segment, expression);
    }
    return expression;
  }

  function valueFor(values, key, fallback) {
    const input = isObject(values) ? values : {};
    return Object.prototype.hasOwnProperty.call(input, key) ? input[key] : fallback;
  }

  function routeClausesFromEvidence(groups) {
    const clauses = [];
    ensureArray(groups).some((group) => {
      ensureArray(group && group.clauses).forEach((clause, index) => {
        const target = cleanRouteTarget(clause && (clause.rawTarget || clause.resolvedTarget || ''));
        if (!target) {
          return;
        }
        clauses.push({
          order: Number(clause.order || index + 1),
          target,
          predicate: String(clause.predicate || '').trim(),
          isFallback: Boolean(clause.isFallback),
          parserBacked: true,
          segment: [target, clause.predicate ? 'if ' + clause.predicate : ''].filter(Boolean).join(' ')
        });
      });
      return clauses.length > 0;
    });
    return clauses;
  }

  function normalizeRouteClausesInput(value) {
    const raw = parseStructuredValue(value);
    return ensureArray(raw).map((clause, index) => {
      const item = isObject(clause) ? clause : {};
      const target = cleanRouteTarget(item.target || item.rawTarget || item.resolvedTarget || '');
      if (!target) {
        return null;
      }
      return {
        order: Number(item.order || index + 1),
        target,
        predicate: String(item.predicate || item.condition || '').trim(),
        isFallback: Boolean(item.isFallback)
      };
    }).filter(Boolean);
  }

  function renderRouteClauseList(clauses) {
    return ensureArray(clauses).map(renderRouteClause).filter(Boolean).join('; ');
  }

  function renderRouteClause(clause) {
    const target = cleanRouteTarget(clause && clause.target);
    if (!target) {
      return '';
    }
    const predicate = String(clause && (clause.predicate || clause.condition) || '').trim();
    return target + (predicate ? ' if ' + predicate : '');
  }

  function parseOptionLine(value) {
    const text = String(value || '').trim();
    const match = text.match(/^-\s*([@#])?([A-Za-z_][A-Za-z0-9_.-]*)\s*:\s*(.*)$/);
    if (!match) {
      return null;
    }
    return {
      segment: text,
      prefix: match[1] || '@',
      target: match[2] || '',
      label: match[3] || ''
    };
  }

  function parseRouteClause(value) {
    const text = String(value || '').trim().replace(/^[@#]/, '');
    const goToMatch = text.match(/^(go-to\s*:\s*)(.+)$/i);
    if (goToMatch) {
      const firstClause = parseRouteClauseSegment(goToMatch[2]);
      return {
        target: firstClause && firstClause.target || '',
        predicate: firstClause && firstClause.predicate || '',
        segment: text,
        linePrefix: goToMatch[1] || 'go-to: '
      };
    }
    return parseRouteClauseSegment(text);
  }

  function parseRouteClauseSegment(value) {
    const text = String(value || '').trim().split(';')[0].trim();
    const match = text.match(/^([A-Za-z_][A-Za-z0-9_.-]*)(?:\s+if\s+(.+))?$/);
    if (!match) {
      return {target: text, predicate: '', segment: text};
    }
    return {target: match[1] || '', predicate: match[2] || '', segment: text};
  }

  function parseEffectExpression(value) {
    const text = stripHookPrefix(String(value || '').trim()).split(';')[0].replace(/;+$/, '').trim();
    const parts = splitTrailingIf(text);
    const match = parts.expression.match(/^(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*(=|\+=|-=|\*=|\/=)\s*([^;\n]+)$/);
    if (!match) {
      return null;
    }
    return {
      variable: match[1],
      op: match[2],
      value: match[3].trim(),
      condition: parts.condition,
      segment: text
    };
  }

  function effectClausesFromEvidence(rows, currentText) {
    const clauses = ensureArray(rows).map((row, index) => {
      const sourceExpression = String(row && row.sourceExpression || '');
      const parsed = parseEffectExpression(sourceExpression || currentText);
      const variable = cleanVariable(row && row.variable || parsed && parsed.variable || '');
      const op = String(row && row.op || parsed && parsed.op || '');
      const rowValue = row && row.value;
      const value = String(rowValue === undefined || rowValue === null ? parsed && parsed.value || '' : rowValue).trim();
      if (!variable || !op || !value) {
        return null;
      }
      return {
        order: Number(row && row.order || index + 1),
        variable,
        op,
        value,
        condition: String(row && row.condition || parsed && parsed.condition || '').trim(),
        sourceExpression: sourceExpression || parsed && parsed.segment || '',
        lineEffectCount: Number(row && row.lineEffectCount || 0),
        prefixQ: hasQPrefix(sourceExpression || parsed && parsed.segment || currentText)
      };
    }).filter(Boolean);
    if (clauses.length) {
      return clauses;
    }
    const parsed = parseEffectExpression(currentText);
    if (!parsed) {
      return [];
    }
    return [{
      order: 1,
      variable: parsed.variable,
      op: parsed.op,
      value: parsed.value,
      condition: parsed.condition,
      sourceExpression: parsed.segment,
      lineEffectCount: 1,
      prefixQ: hasQPrefix(parsed.segment || currentText)
    }];
  }

  function normalizeEffectClausesInput(value) {
    const raw = parseStructuredValue(value);
    return ensureArray(raw).map((clause, index) => {
      const item = isObject(clause) ? clause : {};
      const variable = cleanVariable(item.variable || item.name || '');
      const op = guidedOperator(item.op || item.operator || '=');
      const effectValue = String(item.value === undefined || item.value === null ? '' : item.value).trim();
      if (!variable || !op || !effectValue) {
        return null;
      }
      return {
        order: Number(item.order || index + 1),
        variable,
        op,
        value: effectValue,
        condition: String(item.condition || item.predicate || '').trim(),
        prefixQ: Object.prototype.hasOwnProperty.call(item, 'prefixQ') ? item.prefixQ !== false : undefined
      };
    }).filter(Boolean);
  }

  function renderEffectClauseList(clauses, controls) {
    const fallbackPrefixQ = controls && controls.effectClauses
      ? ensureArray(controls.effectClauses).some((clause) => clause.prefixQ !== false)
      : true;
    return ensureArray(clauses).map((clause) => renderEffectClause(clause, fallbackPrefixQ)).filter(Boolean).join('; ');
  }

  function renderEffectClause(clause, fallbackPrefixQ) {
    const variable = cleanVariable(clause && clause.variable);
    const op = guidedOperator(clause && (clause.op || clause.operator));
    const rawValue = clause && clause.value;
    const value = String(rawValue === undefined || rawValue === null ? '' : rawValue).trim();
    if (!variable || !op || !value) {
      return '';
    }
    const condition = String(clause && (clause.condition || clause.predicate) || '').trim();
    const prefix = clause && clause.prefixQ === false || fallbackPrefixQ === false ? '' : 'Q.';
    return prefix + variable + ' ' + op + ' ' + value + (condition ? ' if ' + condition : '');
  }

  function parseStructuredValue(value) {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value !== 'string') {
      return [];
    }
    const text = value.trim();
    if (!text) {
      return [];
    }
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }

  function stripHookPrefix(value) {
    return String(value || '').trim().replace(/^(on-arrival|on-display)\s*:\s*/i, '');
  }

  function hookPrefixForCurrent(value) {
    const match = String(value || '').match(/^\s*((?:on-arrival|on-display)\s*:\s*)/i);
    return match ? match[1] : '';
  }

  function hasQPrefix(value) {
    return /(?:^|[;\s])Q\.[A-Za-z_][A-Za-z0-9_]*\s*(?:=|\+=|-=|\*=|\/=)/.test(String(value || ''));
  }

  function splitTrailingIf(value) {
    const text = String(value || '').trim();
    const marker = text.lastIndexOf(' if ');
    if (marker < 0) {
      return {expression: text, condition: ''};
    }
    return {expression: text.slice(0, marker).trim(), condition: text.slice(marker + 4).trim()};
  }

  function cleanRouteTarget(value) {
    return String(value || '').trim().replace(/^[@#]+/, '').trim();
  }

  function cleanVariable(value) {
    return String(value || '').trim().replace(/^Q\./, '').trim();
  }

  function cleanOperator(value) {
    const op = String(value || '').trim();
    return GUIDED_EFFECT_OPS.has(op) ? op : '=';
  }

  function guidedOperator(value) {
    const op = String(value || '').trim();
    return GUIDED_EFFECT_OPS.has(op) ? op : '';
  }

  function normalizeInput(input) {
    const value = isObject(input) ? input : {};
    const action = isObject(value.editAction) ? value.editAction : value.kind === 'visible_edit_action' ? value : {};
    const target = isObject(value.target) ? value.target : isObject(action.target) ? action.target : {};
    const template = isObject(value.operationTemplate) ? value.operationTemplate : isObject(action.operationTemplate) ? action.operationTemplate : {};
    const semanticEditor = isObject(value.semanticEditor) ? value.semanticEditor : isObject(action.semanticEditor) ? action.semanticEditor : {};
    const source = sourceRef(value.source || action.source || target.source || template || {});
    return {
      editAction: action,
      semanticEditor,
      id: String(value.id || action.targetId || ''),
      label: String(value.label || action.label || semanticEditor.label || action.fieldId || ''),
      role: String(value.role || semanticEditor.role || action.fieldId || ''),
      sceneId: String(value.sceneId || semanticEditor.sceneId || target.sceneId || action.targetId || ''),
      targetId: String(action.targetId || value.targetId || ''),
      targetView: String(action.targetView || value.targetView || ''),
      fieldId: String(action.fieldId || value.fieldId || ''),
      valueKey: String(action.valueKey || value.valueKey || ''),
      routeClass: String(value.routeClass || action.routeClass || ''),
      installSafety: String(value.installSafety || action.installSafety || template.safety || ''),
      operationType: String(value.installOperationType || action.operationType || template.type || ''),
      operationTemplate: template,
      source
    };
  }

  function normalizeSemanticEditor(input, normalized) {
    const value = isObject(input) ? input : {};
    const role = String(value.role || normalized.role || '');
    const inferred = value.kind || (role === 'effect' ? 'effect_clause' : role === 'variable_definition' ? 'variable_provenance' : 'route_order');
    return {
      schemaVersion: '0.1',
      kind: String(inferred || 'route_order'),
      role,
      sceneId: String(value.sceneId || normalized.sceneId || ''),
      fieldId: String(value.fieldId || normalized.fieldId || ''),
      label: String(value.label || normalized.label || ''),
      title: String(value.title || ''),
      installSafety: String(value.installSafety || normalized.installSafety || ''),
      evidenceId: String(value.evidenceId || ''),
      source: sourceRef(value.source || normalized.source || {})
    };
  }

  function evidenceFor(index, semanticEditor, source, normalized) {
    const lookup = parserEvidenceLookup(index);
    const sceneId = String(semanticEditor.sceneId || normalized.sceneId || '');
    const routeEvidence = semanticEditor.kind === 'route_order'
      ? selectEvidenceRows(lookup.routeOrderGroups, sceneId, source, true).slice(0, 4)
      : [];
    const effectEvidence = semanticEditor.kind === 'effect_clause'
      ? selectEvidenceRows(lookup.effectClauses, sceneId, source, false).slice(0, 6)
      : [];
    const dynamicKeyEvidence = semanticEditor.kind === 'effect_clause'
      ? selectEvidenceRows(lookup.dynamicKeyEvidence, sceneId, source, false).slice(0, 6)
      : [];
    const routerEvidence = semanticEditor.kind === 'route_order'
      ? lookup.routerRows.filter((row) => routerMatches(row, sceneId, source)).slice(0, 4)
      : [];
    return {
      routeEvidence,
      effectEvidence,
      dynamicKeyEvidence,
      routerEvidence,
      parserBacked: Boolean(routeEvidence.length || effectEvidence.length || dynamicKeyEvidence.length || routerEvidence.length)
    };
  }

  function parserEvidenceLookup(index) {
    const semantic = isObject(index && index.semantic) ? index.semantic : {};
    const evidence = isObject(semantic.parserEvidence) ? semantic.parserEvidence : {};
    const core = isObject(evidence.core) ? evidence.core : evidence;
    const routerRows = [];
    ensureArray(evidence.monthlyPopupRouterTable).forEach((row) => routerRows.push(row));
    ensureArray(evidence.profiles).forEach((profile) => {
      ensureArray(profile && profile.routerTables).forEach((table) => {
        ensureArray(table && table.rows).forEach((row) => routerRows.push(row));
      });
    });
    return {
      routeOrderGroups: parserEvidenceRows(core, evidence, 'routeOrderGroups'),
      dynamicKeyEvidence: parserEvidenceRows(core, evidence, 'dynamicKeyEvidence'),
      effectClauses: parserEvidenceRows(core, evidence, 'effectClauses'),
      routerRows
    };
  }

  function parserEvidenceRows(core, evidence, key) {
    const rows = ensureArray(core && core[key]);
    return rows.length ? rows : ensureArray(evidence && evidence[key]);
  }

  function selectEvidenceRows(rows, sceneId, source, allowSceneFallback) {
    const list = ensureArray(rows);
    const requested = sourceRef(source || {});
    if (requested.path) {
      const exact = list.filter((row) => sourceMatches(sourceRef(row && row.source || {}), requested));
      if (exact.length || !allowSceneFallback) {
        return exact;
      }
    }
    return list.filter((row) => evidenceSceneMatches(row, sceneId));
  }

  function evidenceSceneMatches(row, sceneId) {
    const owner = String(row && (row.sceneId || row.ownerId || row.linkedSceneId) || '');
    if (sceneId && owner && owner === sceneId) {
      return true;
    }
    return false;
  }

  function routerMatches(row, sceneId, source) {
    const router = isObject(row && row.router) ? row.router : {};
    const routerSource = sourceRef(router.source || router || {});
    const contentSource = sourceRef(row && row.contentSource || {});
    const requested = sourceRef(source || {});
    if (requested.path && (routerSource.path || contentSource.path)) {
      return sourceMatches(routerSource, requested) || sourceMatches(contentSource, requested);
    }
    if (sceneId && String(row && row.linkedSceneId || '') === sceneId) {
      return true;
    }
    return sourceMatches(routerSource, requested) || sourceMatches(contentSource, requested);
  }

  function sourceMatches(left, right) {
    const a = sourceRef(left || {});
    const b = sourceRef(right || {});
    if (!a.path || !b.path || a.path !== b.path) {
      return false;
    }
    if (!a.line || !b.line) {
      return true;
    }
    return a.line === b.line || (a.startLine && a.endLine && b.line >= a.startLine && b.line <= a.endLine);
  }

  function operationTypeFor(source) {
    const ref = sourceRef(source || {});
    return ref.endLine && ref.line && ref.endLine !== ref.line ? 'replace_section' : 'replace_text';
  }

  function editorLabel(kind) {
    if (kind === 'effect_clause') {
      return 'Effect Clause Editor';
    }
    if (kind === 'variable_provenance') {
      return 'Variable Workspace';
    }
    return 'Route Editor';
  }

  function normalizeSafety(value) {
    const text = String(value || '');
    return APPLY_INSTALL.has(text) ? text : 'guarded_apply';
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    const line = numberOrNull(value.line || value.startLine);
    const endLine = numberOrNull(value.endLine || value.line || value.startLine);
    return {
      path: normalizePath(value.path || ''),
      line,
      startLine: line,
      endLine,
      anchorText: String(value.anchorText || ''),
      endAnchorText: String(value.endAnchorText || '')
    };
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? Math.floor(num) : null;
  }

  function normalizePath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message};
  }

  const api = {
    buildSemanticLogicEditor,
    buildProposal,
    composeFieldReplacement
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSemanticLogicEditor = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
