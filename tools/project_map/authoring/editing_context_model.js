(function initProjectMapEditingContextModel(global) {
  'use strict';

  const EDITING_CONTEXT_VERSION = '0.1';
  const MODEL_KIND = 'editing_context_model';

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function existingSceneApi() {
    if (global && global.ProjectMapExistingSceneEdit) {
      return global.ProjectMapExistingSceneEdit;
    }
    if (typeof require === 'function') {
      try {
        return require('./existing_scene_edit_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function installPlanApi() {
    if (global && global.ProjectMapInstallPlan) {
      return global.ProjectMapInstallPlan;
    }
    if (typeof require === 'function') {
      try {
        return require('./install_plan.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function buildContextModel(projectIndex, view, itemOrId, options) {
    const opts = isObject(options) ? options : {};
    const index = isObject(projectIndex) ? projectIndex : {};
    const existingApi = existingSceneApi();
    if (!existingApi || typeof existingApi.buildEditModel !== 'function') {
      return emptyContext(index, view, itemOrId, diagnostic('error', 'editing_context.existing_missing', 'Existing scene edit model is unavailable.'));
    }
    const editModel = existingApi.buildEditModel(index, view, itemOrId, opts.editorOptions || {});
    if (!editModel || !editModel.ok) {
      return emptyContext(index, view, itemOrId, diagnostic('warning', 'editing_context.not_editable', 'This selection cannot be edited as an existing Event/Card.'), editModel);
    }
    const values = normalizeValues(opts.values);
    const proposal = existingApi.buildProposal(editModel, values, opts.proposalOptions || {});
    const output = existingApi.buildExportBundle(proposal, index);
    const summary = operationSummary(output && output.installPlan);
    const scene = resolveScene(index, editModel.sceneId, itemOrId);
    const editors = buildEditorGroups(editModel, values);
    const relationships = buildRelationships(index, editModel, scene);
    const context = buildContextRows(index, editModel, scene, relationships);
    const graph = buildGraph(editModel, relationships, editors, context);
    const diagnostics = ensureArray(editModel.diagnostics).concat(ensureArray(proposal.diagnostics));

    return {
      schemaVersion: EDITING_CONTEXT_VERSION,
      kind: MODEL_KIND,
      ok: true,
      view: String(view || ''),
      sceneId: editModel.sceneId || '',
      sceneKind: editModel.sceneKind || 'event',
      title: editModel.title || editModel.sceneId || '',
      source: sourceRef(editModel.source || {}),
      editModel,
      flow: editModel.flow || {nodes: [], edges: [], summary: {}},
      proposal,
      output,
      operationSummary: summary,
      editabilitySummary: summarizeEditability(editors, summary),
      editors,
      relationships,
      context,
      graph,
      warnings: ensureArray(editModel.warnings),
      diagnostics
    };
  }

  function buildContextFromProposal(projectIndex, proposalInput, options) {
    const existingApi = existingSceneApi();
    const proposal = existingApi && typeof existingApi.normalizeProposal === 'function'
      ? existingApi.normalizeProposal(proposalInput || {})
      : normalizeProposalFallback(proposalInput);
    const view = proposal.sceneKind === 'card' ? 'cards' : 'events';
    const values = proposalValues(proposal);
    return buildContextModel(projectIndex, view, proposal.sceneId, Object.assign({}, options || {}, {values}));
  }

  function emptyContext(index, view, itemOrId, extraDiagnostic, editModel) {
    const diagnostics = extraDiagnostic ? [extraDiagnostic] : [];
    return {
      schemaVersion: EDITING_CONTEXT_VERSION,
      kind: MODEL_KIND,
      ok: false,
      view: String(view || ''),
      sceneId: String(isObject(itemOrId) ? (itemOrId.sceneId || itemOrId.id || '') : (itemOrId || '')),
      sceneKind: String(view || '') === 'cards' ? 'card' : 'event',
      title: '',
      source: {},
      editModel: editModel || null,
      flow: editModel && editModel.flow || {nodes: [], edges: [], summary: {}},
      proposal: null,
      output: null,
      operationSummary: operationSummary(null),
      editabilitySummary: {guarded: 0, manual: 0, readOnly: 0, total: 0},
      editors: emptyEditorGroups(),
      relationships: {incoming: [], outgoing: [], internal: [], options: []},
      context: {variables: [], effects: [], assets: [], sourceEvidence: [], manualBoundaries: []},
      graph: {nodes: [], edges: []},
      warnings: [],
      diagnostics
    };
  }

  function emptyEditorGroups() {
    return {
      pageSections: [],
      openingSections: [],
      optionResultSections: [],
      conditionalSections: [],
      otherSections: [],
      optionText: [],
      conditions: [],
      routes: [],
      effects: [],
      structureActions: [],
      playerText: [],
      all: []
    };
  }

  function buildEditorGroups(editModel, values) {
    const groups = emptyEditorGroups();
    const coveredFieldIds = new Set();
    ensureArray(editModel.textBlocks).forEach((block) => {
      ensureArray(block.fieldIds).forEach((fieldId) => coveredFieldIds.add(fieldId));
      const editor = editorFromBlock(block, values);
      groups.pageSections.push(editor);
      sectionBucket(groups, editor).push(editor);
    });
    ensureArray(editModel.fields).forEach((field) => {
      const editor = editorFromField(field, values);
      if (String(field.transform || '') === 'structure_action') {
        groups.structureActions.push(editor);
      } else if (String(field.role || '') === 'condition') {
        groups.conditions.push(editor);
      } else if (String(field.role || '') === 'route') {
        groups.routes.push(editor);
      } else if (String(field.role || '') === 'effect') {
        groups.effects.push(editor);
      } else if (String(field.role || '').startsWith('option_') || field.optionId) {
        groups.optionText.push(editor);
      } else if (!coveredFieldIds.has(field.id)) {
        groups.playerText.push(editor);
      }
    });
    groups.all = groups.pageSections.concat(groups.optionText, groups.conditions, groups.routes, groups.effects, groups.structureActions, groups.playerText);
    return groups;
  }

  function editorFromBlock(block, values) {
    const id = 'block:' + String(block.id || '');
    const relatedOptionIds = ensureArray(block.relatedOptionIds).map(String).filter(Boolean);
    return {
      id,
      fieldId: String(block.id || ''),
      group: 'page_sections',
      role: String(block.role || 'section_text'),
      semanticRole: String(block.semanticRole || 'section_text'),
      branchKind: String(block.branchKind || ''),
      label: String(block.label || block.id || 'Page section'),
      original: String(block.original || ''),
      value: Object.prototype.hasOwnProperty.call(values, id) ? String(values[id] || '') : String(block.value || block.original || ''),
      editability: String(block.editability || 'guarded_replace_section'),
      source: sourceRef(block.source || {}),
      sectionId: String(block.sectionId || ''),
      sectionLabel: String(block.sectionLabel || ''),
      optionId: relatedOptionIds[0] || '',
      relatedOptionIds,
      relatedOptionLabels: ensureArray(block.relatedOptionLabels).map(String).filter(Boolean),
      ownedOptionIds: ensureArray(block.ownedOptionIds).map(String).filter(Boolean),
      ownedOptionLabels: ensureArray(block.ownedOptionLabels).map(String).filter(Boolean),
      conditions: ensureArray(block.conditions).map(String).filter(Boolean),
      visualKinds: ensureArray(block.visualKinds).map(String).filter(Boolean),
      conditionVariables: ensureArray(block.conditionVariables).map(String).filter(Boolean),
      inlineConditions: ensureArray(block.inlineConditions).map(String).filter(Boolean),
      inlineConditionVariables: ensureArray(block.inlineConditionVariables).map(String).filter(Boolean),
      hasInlineConditionals: Boolean(block.hasInlineConditionals),
      textVariables: ensureArray(block.textVariables).map(String).filter(Boolean),
      logicContext: isObject(block.logicContext) ? block.logicContext : null,
      conditionalAlternatives: ensureArray(block.conditionalAlternatives).map((item) => ({
        condition: String(item && item.condition || ''),
        text: String(item && item.text || ''),
        source: sourceRef(item && item.source || {})
      })).filter((item) => item.condition || item.text),
      hasConditionalAlternatives: Boolean(block.hasConditionalAlternatives),
      operationType: 'replace_section',
      status: editorStatus(block.editability || 'guarded_replace_section')
    };
  }

  function sectionBucket(groups, editor) {
    const role = String(editor && editor.semanticRole || '');
    if (role === 'opening_text') {
      return groups.openingSections;
    }
    if (role === 'option_result_text' || role === 'conditional_option_result_text') {
      return groups.optionResultSections;
    }
    if (role === 'conditional_text') {
      return groups.conditionalSections;
    }
    return groups.otherSections;
  }

  function editorFromField(field, values) {
    const id = String(field.id || '');
    return {
      id,
      fieldId: id,
      group: editorGroupForField(field),
      role: String(field.role || 'text'),
      label: String(field.label || field.role || id || 'Text'),
      original: String(field.original || ''),
      value: Object.prototype.hasOwnProperty.call(values, id) ? String(values[id] || '') : String(field.value || field.original || ''),
      editability: String(field.editability || 'manual_review'),
      source: sourceRef(field.source || {}),
      sectionId: String(field.sectionId || ''),
      optionId: String(field.optionId || ''),
      inputType: String(field.inputType || ''),
      placeholder: String(field.placeholder || ''),
      transform: String(field.transform || ''),
      structureAction: String(field.structureAction || ''),
      structureBefore: String(field.structureBefore || ''),
      structureTargetLabel: String(field.structureTargetLabel || ''),
      effectSyntax: String(field.effectSyntax || ''),
      effectHook: String(field.effectHook || ''),
      sourceExpression: String(field.sourceExpression || ''),
      displayExpression: String(field.displayExpression || ''),
      condition: String(field.condition || ''),
      reason: String(field.reason || ''),
      operationType: 'replace_text',
      status: editorStatus(field.editability || 'manual_review')
    };
  }

  function editorGroupForField(field) {
    if (String(field && field.transform || '') === 'structure_action') {
      return 'structure_actions';
    }
    const role = String(field && field.role || '');
    if (role === 'condition') {
      return 'conditions';
    }
    if (role === 'route') {
      return 'routes';
    }
    if (role === 'effect') {
      return 'effects';
    }
    if (role.startsWith('option_') || field && field.optionId) {
      return 'option_text';
    }
    return 'player_text';
  }

  function editorStatus(editability) {
    const text = String(editability || '');
    if (text === 'guarded_replace_text' || text === 'guarded_replace_section') {
      return 'guarded';
    }
    if (text === 'manual_review') {
      return 'manual';
    }
    return text ? 'review' : 'read_only';
  }

  function buildRelationships(index, editModel, scene) {
    const sceneId = String(editModel.sceneId || '');
    const scenesById = sceneLookup(index);
    const sectionsById = sectionLookup(scene);
    const incoming = [];
    const outgoing = [];
    const internal = [];
    ensureArray(index.edges).forEach((edge) => {
      const from = endpointId(edge.from || edge.source || edge.sourceId);
      const to = endpointId(edge.to || edge.target || edge.targetId);
      if (!from || !to) {
        return;
      }
      const fromInScene = endpointBelongsToScene(from, sceneId);
      const toInScene = endpointBelongsToScene(to, sceneId);
      const row = {
        from,
        to,
        kind: String(edge.kind || edge.type || 'link'),
        label: String(edge.label || edge.title || ''),
        condition: String(edge.condition || edge.predicate || ''),
        rawTarget: String(edge.rawTarget || ''),
        source: sourceRef(edge.source || {}),
        scene: null,
        fromEndpoint: endpointSummary(scenesById, sectionsById, from),
        toEndpoint: endpointSummary(scenesById, sectionsById, to)
      };
      if (fromInScene && toInScene) {
        internal.push(row);
        return;
      }
      if (toInScene) {
        row.scene = endpointSummary(scenesById, sectionsById, from);
        incoming.push(row);
      }
      if (fromInScene) {
        row.scene = endpointSummary(scenesById, sectionsById, to);
        outgoing.push(row);
      }
    });
    const relationshipKeys = new Set([].concat(incoming, outgoing, internal).map(relationshipKey));
    ensureArray(editModel.flow && editModel.flow.edges).forEach((edge) => {
      const from = endpointId(edge.from || edge.source || edge.sourceId);
      const to = endpointId(edge.to || edge.target || edge.targetId);
      if (!from || !to) {
        return;
      }
      const fromInScene = endpointBelongsToScene(from, sceneId);
      const toInScene = endpointBelongsToScene(to, sceneId);
      if (!fromInScene || !toInScene) {
        return;
      }
      const row = {
        from,
        to,
        kind: String(edge.kind || edge.type || 'link'),
        label: String(edge.label || edge.title || ''),
        condition: String(edge.condition || edge.predicate || ''),
        rawTarget: String(edge.rawTarget || ''),
        source: sourceRef(edge.source || {}),
        scene: null,
        fromEndpoint: endpointSummary(scenesById, sectionsById, from),
        toEndpoint: endpointSummary(scenesById, sectionsById, to)
      };
      const key = relationshipKey(row);
      if (relationshipKeys.has(key)) {
        return;
      }
      relationshipKeys.add(key);
      if (fromInScene && toInScene) {
        internal.push(row);
      }
    });
    const options = ensureArray(editModel.options).map((option, index) => ({
      id: String(option.id || 'option_' + (index + 1)),
      label: String(option.label || option.id || 'Option ' + (index + 1)),
      subtitle: String(option.subtitle || ''),
      targetId: String(option.targetId || ''),
      rawTargetId: String(option.rawTargetId || ''),
      sectionId: String(option.sectionId || ''),
      sectionLabel: String(option.sectionLabel || ''),
      chooseIf: String(option.chooseIf || ''),
      sectionViewIf: String(option.sectionViewIf || ''),
      sectionChooseIf: String(option.sectionChooseIf || ''),
      labelSource: String(option.labelSource || ''),
      source: sourceRef(option.source || {}),
      target: endpointSummary(scenesById, sectionsById, String(option.targetId || ''))
    }));
    if (!outgoing.length && !internal.length) {
      options.filter((option) => option.targetId).forEach((option) => {
        outgoing.push({
          from: sceneId,
          to: option.targetId,
          kind: 'option',
          label: option.label,
          source: option.source,
          scene: option.target,
          fromEndpoint: endpointSummary(scenesById, sectionsById, sceneId),
          toEndpoint: option.target
        });
      });
    }
    return {incoming, outgoing, internal, options, current: sceneSummary(scene, sceneId)};
  }

  function relationshipKey(row) {
    return [
      String(row && row.from || ''),
      String(row && row.to || ''),
      String(row && row.kind || ''),
      String(row && row.label || ''),
      String(row && row.condition || '')
    ].join('|');
  }

  function buildContextRows(index, editModel, scene, relationships) {
    const sourcePath = String(editModel.source && editModel.source.path || scene && scene.path || '');
    const variables = variablesForPath(index, sourcePath);
    const effectFieldBySource = new Map(ensureArray(editModel.fields)
      .filter((field) => String(field.role || '') === 'effect')
      .map((field) => [effectEditorKey(field.source, field.original), field]));
    const effects = ensureArray(editModel.effects).map((effect) => {
      const field = effectFieldBySource.get(effectEditorKey(effect.source, effectExpression(effect)));
      return {
        variable: String(effect.variable || ''),
        op: String(effect.op || effect.operator || ''),
        value: String(effect.value === undefined || effect.value === null ? '' : effect.value),
        condition: String(effect.condition || ''),
        hook: String(effect.hook || ''),
        syntax: String(effect.syntax || ''),
        expression: effectExpression(effect),
        sourceExpression: String(effect.sourceExpression || ''),
        sectionId: String(effect.sectionId || ''),
        source: sourceRef(effect.source || {}),
        status: field ? editorStatus(field.editability) : 'read_only'
      };
    }).filter((effect) => effect.variable);
    const assets = ensureArray(editModel.assets).map((asset) => ({
      label: String(asset.label || asset.path || asset.role || ''),
      path: String(asset.path || ''),
      role: String(asset.role || asset.type || ''),
      status: 'read_only'
    }));
    const sourceEvidence = [
      sourceEvidenceRow('scene', editModel.source),
    ].concat(ensureArray(editModel.textBlocks).map((block) => sourceEvidenceRow(block.label || block.id, block.source)))
      .concat(ensureArray(editModel.fields).map((field) => sourceEvidenceRow(field.label || field.id, field.source)))
      .filter((row) => row.path);
    const manualBoundaries = manualBoundaryRows(editModel, relationships);
    return {variables, effects, assets, sourceEvidence, manualBoundaries};
  }

  function variablesForPath(index, sourcePath) {
    const path = String(sourcePath || '');
    if (!path) {
      return [];
    }
    return ensureArray(index.variables).map((variable) => {
      const reads = ensureArray(variable && variable.reads).filter((ref) => samePath(ref, path));
      const writes = ensureArray(variable && variable.writes).filter((ref) => samePath(ref, path));
      const definedIn = ensureArray(variable && variable.definedIn).filter((ref) => samePath(ref, path));
      if (!reads.length && !writes.length && !definedIn.length) {
        return null;
      }
      return {
        name: String(variable.name || ''),
        reads: reads.map(sourceRef),
        writes: writes.map(sourceRef),
        definedIn: definedIn.map(sourceRef),
        readCount: Number(variable.readCount || reads.length || 0),
        writeCount: Number(variable.writeCount || writes.length || 0),
        tags: ensureArray(variable.tags).map(String),
        status: 'read_only'
      };
    }).filter((variable) => variable && variable.name);
  }

  function manualBoundaryRows(editModel, relationships) {
    const rows = [];
    ensureArray(editModel.fields).forEach((field) => {
      if (field.editability === 'manual_review') {
        rows.push({
          label: String(field.label || field.id || 'Manual review'),
          reason: String(field.reason || 'Needs manual review.'),
          source: sourceRef(field.source || {}),
          status: 'manual_review'
        });
      }
    });
    const editableEffectSources = new Set(ensureArray(editModel.fields)
      .filter((field) => String(field.role || '') === 'effect')
      .map((field) => effectEditorKey(field.source, field.original)));
    ensureArray(editModel.effects).forEach((effect) => {
      if (editableEffectSources.has(effectEditorKey(effect.source, effectExpression(effect)))) {
        return;
      }
      rows.push({
        label: 'Effect: Q.' + String(effect.variable || ''),
        reason: 'Effects are context-only in this Goal.',
        source: sourceRef(effect.source || {}),
        status: 'read_only'
      });
    });
    ensureArray(relationships.options).filter((option) => option.chooseIf).forEach((option) => {
      rows.push({
        label: 'Option condition: ' + option.label,
        reason: 'Option choose-if is shown as context; direct editing is outside this Goal.',
        source: option.source,
        status: 'manual_review'
      });
    });
    ensureArray(relationships.options).filter((option) => option.sectionViewIf || option.sectionChooseIf).forEach((option) => {
      rows.push({
        label: 'Section gate: ' + (option.sectionLabel || option.sectionId || option.label),
        reason: [option.sectionViewIf, option.sectionChooseIf].filter(Boolean).join(' / '),
        source: option.source,
        status: 'context'
      });
    });
    return rows;
  }

  function buildGraph(editModel, relationships, editors, context) {
    const nodes = [];
    const edges = [];
    const seen = new Set();
    function addNode(node) {
      if (!node || !node.id || seen.has(node.id)) {
        return;
      }
      seen.add(node.id);
      nodes.push(node);
    }
    function addEdge(edge) {
      if (edge && edge.from && edge.to) {
        edges.push(edge);
      }
    }
    const sceneNodeId = 'scene:' + editModel.sceneId;
    addNode({
      id: sceneNodeId,
      type: 'current_scene',
      label: editModel.title || editModel.sceneId,
      subtitle: editModel.source && editModel.source.path || '',
      status: 'current'
    });
    relationships.incoming.slice(0, 12).forEach((rel, index) => {
      const nodeId = 'incoming:' + rel.from;
      addNode({id: nodeId, type: 'incoming', label: rel.scene.title || rel.from, subtitle: rel.label || rel.kind, status: 'context'});
      addEdge({id: 'incoming-edge-' + index, from: nodeId, to: sceneNodeId, label: rel.label || rel.kind, type: 'incoming'});
    });
    relationships.outgoing.slice(0, 12).forEach((rel, index) => {
      const nodeId = 'outgoing:' + rel.to;
      addNode({id: nodeId, type: 'outgoing', label: rel.scene.title || rel.to, subtitle: rel.label || rel.kind, status: 'context'});
      addEdge({id: 'outgoing-edge-' + index, from: sceneNodeId, to: nodeId, label: rel.label || rel.kind, type: 'outgoing'});
    });
    relationships.internal.slice(0, 18).forEach((rel, index) => {
      const nodeId = 'internal:' + rel.to;
      const label = rel.toEndpoint && rel.toEndpoint.title || rel.to;
      const subtitle = [rel.kind, rel.condition].filter(Boolean).join(' / ');
      addNode({id: nodeId, type: 'internal_flow', label, subtitle, status: 'context'});
      addEdge({id: 'internal-edge-' + index, from: sceneNodeId, to: nodeId, label: rel.label || rel.kind, type: 'internal'});
    });
    editors.pageSections.concat(editors.optionText, editors.conditions, editors.routes, editors.effects).slice(0, 18).forEach((editor, index) => {
      const nodeId = 'editor:' + editor.id;
      addNode({id: nodeId, type: editor.group, label: editor.label, subtitle: sourceLabel(editor.source), status: editor.status});
      addEdge({id: 'editor-edge-' + index, from: sceneNodeId, to: nodeId, label: editor.status, type: 'editor'});
    });
    context.variables.slice(0, 10).forEach((variable, index) => {
      const nodeId = 'variable:' + variable.name;
      addNode({id: nodeId, type: 'variable', label: 'Q.' + variable.name, subtitle: variable.readCount + ' reads / ' + variable.writeCount + ' writes', status: 'read_only'});
      addEdge({id: 'variable-edge-' + index, from: sceneNodeId, to: nodeId, label: 'uses', type: 'variable'});
    });
    context.effects.slice(0, 10).forEach((effect, index) => {
      const nodeId = 'effect:' + index + ':' + effect.variable;
      addNode({id: nodeId, type: 'effect', label: 'Q.' + effect.variable + ' ' + effect.op + ' ' + effect.value, subtitle: sourceLabel(effect.source), status: 'read_only'});
      addEdge({id: 'effect-edge-' + index, from: sceneNodeId, to: nodeId, label: 'effect', type: 'effect'});
    });
    return {nodes, edges};
  }

  function summarizeEditability(editors, summary) {
    const counts = {guarded: 0, manual: 0, readOnly: 0, total: 0};
    ensureArray(editors && editors.all).forEach((editor) => {
      counts.total += 1;
      if (editor.status === 'guarded') {
        counts.guarded += 1;
      } else if (editor.status === 'manual') {
        counts.manual += 1;
      } else {
        counts.readOnly += 1;
      }
    });
    counts.operations = summary || operationSummary(null);
    return counts;
  }

  function operationSummary(plan) {
    const installApi = installPlanApi();
    if (installApi && typeof installApi.operationSummary === 'function') {
      return installApi.operationSummary(plan || {operations: []});
    }
    const summary = {safeApply: 0, guardedApply: 0, advancedApply: 0, manualReview: 0, refused: 0, total: 0};
    ensureArray(plan && plan.operations).forEach((operation) => {
      summary.total += 1;
      const safety = String(operation && operation.safety || 'manual_review');
      if (safety === 'safe_apply') {
        summary.safeApply += 1;
      } else if (safety === 'guarded_apply') {
        summary.guardedApply += 1;
      } else if (safety === 'advanced_apply') {
        summary.advancedApply += 1;
      } else {
        summary.manualReview += 1;
      }
    });
    return summary;
  }

  function proposalValues(proposal) {
    const values = {};
    ensureArray(proposal && proposal.changes).forEach((change) => {
      const key = change.operationType === 'replace_section'
        ? 'block:' + String(change.fieldId || '')
        : String(change.fieldId || '');
      if (key) {
        values[key] = String(change.after || '');
      }
    });
    return values;
  }

  function normalizeValues(values) {
    const out = {};
    if (!isObject(values)) {
      return out;
    }
    Object.keys(values).forEach((key) => {
      if (key === '__structureCommands' || key === 'structure_commands' || key === 'structureCommands') {
        out[key] = Array.isArray(values[key]) ? values[key].slice() : values[key];
        return;
      }
      out[key] = String(values[key] === undefined || values[key] === null ? '' : values[key]);
    });
    return out;
  }

  function normalizeProposalFallback(input) {
    const value = isObject(input) ? input : {};
    return {
      kind: 'existing_scene_edit',
      id: String(value.id || 'existing_scene_edit'),
      title: String(value.title || value.sceneId || 'Existing scene edit'),
      sceneId: String(value.sceneId || ''),
      sceneKind: String(value.sceneKind || 'event') === 'card' ? 'card' : 'event',
      sourcePath: String(value.sourcePath || ''),
      source: sourceRef(value.source || {path: value.sourcePath}),
      changes: ensureArray(value.changes)
    };
  }

  function resolveScene(index, sceneId, itemOrId) {
    if (isObject(itemOrId) && itemOrId.id && String(itemOrId.id) === String(sceneId || '')) {
      return itemOrId.scene || itemOrId;
    }
    return sceneLookup(index).get(String(sceneId || '')) || null;
  }

  function sceneLookup(index) {
    const map = new Map();
    ensureArray(index && index.scenes).forEach((scene) => {
      if (scene && scene.id) {
        map.set(String(scene.id), scene);
      }
    });
    return map;
  }

  function sectionLookup(scene) {
    const map = new Map();
    ensureArray(scene && scene.sections).forEach((section) => {
      if (section && section.id) {
        map.set(String(section.id), section);
      }
    });
    return map;
  }

  function endpointBelongsToScene(endpoint, sceneId) {
    const id = String(endpoint || '');
    const base = String(sceneId || '');
    return Boolean(base) && (id === base || id.startsWith(base + '.'));
  }

  function endpointSummary(scenesById, sectionsById, endpoint) {
    const id = String(endpoint || '');
    if (sectionsById && sectionsById.has(id)) {
      const section = sectionsById.get(id);
      const title = String(section.title || section.subtitle || localSectionId(id) || id);
      return {
        id,
        title,
        path: String(section.sourceSpan && section.sourceSpan.path || ''),
        kind: 'section',
        source: sourceRef(section.sourceSpan || {}),
        condition: String(section.viewIf || section.chooseIf || '')
      };
    }
    return sceneSummary(scenesById && scenesById.get(id), id);
  }

  function localSectionId(id) {
    const text = String(id || '');
    return text.indexOf('.') >= 0 ? text.split('.').slice(1).join('.') : text;
  }

  function sceneSummary(scene, fallbackId) {
    const value = isObject(scene) ? scene : {};
    const id = String(value.id || fallbackId || '');
    return {
      id,
      title: String(value.title || value.name || id || ''),
      path: String(value.path || value.sourceSpan && value.sourceSpan.path || ''),
      kind: value.flags && value.flags.isCard || value.type === 'card' ? 'card' : 'event',
      source: sourceRef(value.sourceSpan || value.topLevelSpan || {path: value.path})
    };
  }

  function endpointId(value) {
    if (isObject(value)) {
      return String(value.id || value.sceneId || value.targetId || value.name || '');
    }
    return String(value || '');
  }

  function sourceEvidenceRow(label, source) {
    const ref = sourceRef(source || {});
    return {
      label: String(label || 'source'),
      path: ref.path || '',
      line: ref.line || ref.startLine || null,
      endLine: ref.endLine || null,
      status: ref.path ? 'evidence' : 'missing'
    };
  }

  function sourceRef(ref) {
    const value = isObject(ref) ? ref : {};
    const line = numberOrNull(value.line || value.startLine);
    const endLine = numberOrNull(value.endLine || value.line || value.startLine);
    return {
      path: String(value.path || value.sourcePath || '').trim(),
      line,
      startLine: line,
      endLine,
      anchorText: String(value.anchorText || '').trim(),
      endAnchorText: String(value.endAnchorText || '').trim()
    };
  }

  function sourceLabel(source) {
    const ref = source || {};
    return ref.path ? ref.path + (ref.line ? ':' + ref.line : '') : '';
  }

  function samePath(ref, path) {
    return String(ref && ref.path || ref && ref.sourcePath || '') === path;
  }

  function sourceKey(source) {
    const ref = sourceRef(source || {});
    return [ref.path || '', ref.line || '', ref.endLine || ''].join(':');
  }

  function effectEditorKey(source, expression) {
    return sourceKey(source) + ':' + String(expression || '').trim();
  }

  function effectExpression(effect) {
    const explicit = String(effect && (effect.displayExpression || effect.expression) || '').trim();
    if (explicit) {
      return explicit;
    }
    const rawValue = effect && effect.value;
    const expression = ('Q.' + String(effect && effect.variable || '') + ' ' +
      String(effect && (effect.op || effect.operator) || '') + ' ' +
      String(rawValue === undefined || rawValue === null ? '' : rawValue)).trim();
    const condition = String(effect && effect.condition || '').trim();
    return expression + (condition ? ' if ' + condition : '');
  }

  function numberOrNull(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message, confidence: 'static_inferred'};
  }

  const api = {
    EDITING_CONTEXT_VERSION,
    MODEL_KIND,
    buildContextModel,
    buildContextFromProposal,
    proposalValues,
    operationSummary
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapEditingContextModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
