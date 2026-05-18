(function initProjectMapSourceSliceEditor(global) {
  'use strict';

  const SOURCE_SLICE_EDITOR_VERSION = '0.1';
  const MODEL_KIND = 'source_slice_editor_model';
  const PROPOSAL_KIND = 'source_slice_editor_proposal';
  const APPLY_INSTALL = new Set(['safe_apply', 'guarded_apply', 'advanced_apply']);
  const PROTECTED_PATHS = new Set([
    'source/scenes/root.scene.dry',
    'source/scenes/post_event.scene.dry',
    'source/scenes/post_event_news.scene.dry',
    'source/info.dry'
  ]);

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

  function buildSourceSliceEditor(projectIndex, input, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    const normalized = normalizeInput(input || {});
    const source = sourceRef(normalized.source || {});
    const generated = isGeneratedPath(source.path);
    const diagnostics = [];
    const mappingBug = !source.path || generated;
    if (!source.path) {
      diagnostics.push(diagnostic('error', 'source_slice.mapping_missing', 'Visible content has no source anchor. This is a Studio mapping bug, not a player edit limit.'));
    }
    if (generated) {
      diagnostics.push(diagnostic('error', 'source_slice.generated_mapping_required', 'Visible generated output must map back to source before Studio can write an install operation.'));
    }
    const installSafety = normalizeSafety(normalized.installSafety || safetyForSource(source));
    const operationType = operationTypeFor(source, normalized);
    const currentText = currentTextFor(source, normalized, opts);
    const model = {
      schemaVersion: SOURCE_SLICE_EDITOR_VERSION,
      kind: MODEL_KIND,
      ok: !mappingBug,
      mappingBug,
      playerLimit: false,
      actionKind: installSafety === 'advanced_apply' ? 'open_advanced_source_patch' : 'open_source_slice',
      routeClass: String(normalized.routeClass || (installSafety === 'advanced_apply' ? 'advanced_source_patch' : 'source_slice_editor')),
      targetId: String(normalized.targetId || normalized.id || source.path || ''),
      targetView: 'source_slice',
      title: String(normalized.label || normalized.id || 'Source slice edit'),
      label: String(normalized.label || ''),
      role: String(normalized.role || ''),
      source,
      sourcePath: source.path,
      line: source.line || null,
      startLine: source.startLine || source.line || null,
      endLine: source.endLine || source.line || null,
      anchorEvidence: {
        anchorText: source.anchorText || currentText,
        endAnchorText: source.endAnchorText || source.anchorText || currentText,
        line: source.line || null,
        startLine: source.startLine || source.line || null,
        endLine: source.endLine || source.line || null
      },
      currentText,
      operationType,
      installSafety,
      protectedSource: isProtectedSource(source.path),
      advancedRequired: installSafety === 'advanced_apply',
      canCreateOperation: !mappingBug && Boolean(source.path && currentText),
      operationTemplate: operationTemplateFor(source, operationType, installSafety, currentText, normalized),
      project: projectProvenance(index),
      diagnostics: diagnostics.concat(ensureArray(normalized.diagnostics))
    };
    if (!model.canCreateOperation && !mappingBug) {
      model.ok = false;
      model.mappingBug = true;
      model.diagnostics.push(diagnostic('error', 'source_slice.anchor_missing', 'Visible content has a source path but no editable anchor text. This is a Studio mapping bug.'));
    }
    return model;
  }

  function buildProposal(projectIndex, input, values) {
    const first = isObject(projectIndex) ? projectIndex : {};
    const model = first.kind === MODEL_KIND
      ? first
      : input && input.kind === MODEL_KIND
      ? input
      : buildSourceSliceEditor(projectIndex, input, {});
    const replacements = first.kind === MODEL_KIND
      ? (isObject(input) ? input : {})
      : (isObject(values) ? values : {});
    const replacementText = String(
      replacements.replacementText !== undefined ? replacements.replacementText :
      replacements.content !== undefined ? replacements.content :
      replacements.replace !== undefined ? replacements.replace :
      model.currentText || ''
    );
    if (!model || !model.ok || !model.canCreateOperation) {
      return {
        schemaVersion: SOURCE_SLICE_EDITOR_VERSION,
        kind: PROPOSAL_KIND,
        ok: false,
        mappingBug: Boolean(model && model.mappingBug),
        playerLimit: false,
        installPlan: null,
        operations: [],
        diagnostics: ensureArray(model && model.diagnostics).concat(diagnostic('error', 'source_slice.no_operation', 'No install operation can be generated until source mapping is fixed.'))
      };
    }
    const operation = operationFromModel(model, replacementText);
    const installApi = installPlanApi();
    const plan = installApi && typeof installApi.buildInstallPlan === 'function'
      ? installApi.buildInstallPlan({
        id: safeId('source_slice_' + (model.targetId || model.sourcePath || 'edit')),
        draftKind: 'source_slice_editor',
        title: model.title || 'Source slice edit',
        project: model.project || projectProvenance(isObject(projectIndex) ? projectIndex : {}),
        operations: [operation]
      })
      : {
        schemaVersion: '0.1',
        kind: 'dendry_mod_studio_install_plan',
        id: safeId('source_slice_' + (model.targetId || model.sourcePath || 'edit')),
        draftKind: 'source_slice_editor',
        title: model.title || 'Source slice edit',
        project: model.project || null,
        operations: [operation]
      };
    return {
      schemaVersion: SOURCE_SLICE_EDITOR_VERSION,
      kind: PROPOSAL_KIND,
      ok: true,
      mappingBug: false,
      playerLimit: false,
      title: model.title,
      source: model.source,
      replacementText,
      operations: plan.operations || [operation],
      installPlan: plan,
      diagnostics: []
    };
  }

  function normalizeInput(input) {
    const value = isObject(input) ? input : {};
    const action = isObject(value.editAction) ? value.editAction : {};
    const target = isObject(value.target) ? value.target : {};
    const template = isObject(value.operationTemplate) ? value.operationTemplate : isObject(action.operationTemplate) ? action.operationTemplate : {};
    const source = sourceRef(value.source || action.source || target.source || template || {});
    return {
      id: String(value.id || action.targetId || target.itemId || ''),
      label: String(value.label || action.label || ''),
      role: String(value.role || ''),
      routeClass: String(value.routeClass || action.routeClass || ''),
      installSafety: String(value.installSafety || action.installSafety || template.safety || ''),
      installOperationType: String(value.installOperationType || action.operationType || template.type || ''),
      source,
      targetId: String(action.targetId || target.itemId || value.id || ''),
      operationTemplate: template,
      diagnostics: ensureArray(value.diagnostics).concat(ensureArray(action.diagnostics))
    };
  }

  function operationTemplateFor(source, operationType, installSafety, currentText, input) {
    const template = isObject(input && input.operationTemplate) ? input.operationTemplate : {};
    const base = {
      type: operationType,
      path: source.path,
      line: source.line || null,
      startLine: source.startLine || source.line || null,
      endLine: source.endLine || source.line || null,
      anchorText: source.anchorText || template.anchorText || currentText,
      endAnchorText: source.endAnchorText || template.endAnchorText || source.anchorText || currentText,
      rawAnchorText: source.rawAnchorText || template.rawAnchorText || '',
      rawEndAnchorText: source.rawEndAnchorText || template.rawEndAnchorText || source.rawAnchorText || '',
      expectedRangeHash: source.expectedRangeHash || template.expectedRangeHash || '',
      search: operationType === 'replace_text' ? (template.search || source.anchorText || currentText) : '',
      replace: '',
      content: '',
      dedupeSearch: '',
      safety: installSafety,
      description: 'Edit visible source-backed content from the Source Slice Editor.'
    };
    return Object.assign({}, template, base);
  }

  function operationFromModel(model, replacementText) {
    const text = String(replacementText === undefined || replacementText === null ? '' : replacementText);
    const source = sourceRef(model.source || {});
    const base = {
      id: safeId('source_slice_' + (model.targetId || source.path || 'edit')),
      type: model.operationType || 'replace_text',
      path: source.path,
      line: source.line || null,
      startLine: source.startLine || source.line || null,
      endLine: source.endLine || source.line || null,
      anchorText: model.anchorEvidence && model.anchorEvidence.anchorText || source.anchorText || model.currentText || '',
      endAnchorText: model.anchorEvidence && model.anchorEvidence.endAnchorText || source.endAnchorText || source.anchorText || model.currentText || '',
      rawAnchorText: model.anchorEvidence && model.anchorEvidence.rawAnchorText || source.rawAnchorText || '',
      rawEndAnchorText: model.anchorEvidence && model.anchorEvidence.rawEndAnchorText || source.rawEndAnchorText || source.rawAnchorText || '',
      expectedRangeHash: model.anchorEvidence && model.anchorEvidence.expectedRangeHash || source.expectedRangeHash || '',
      safety: model.installSafety || safetyForSource(source),
      description: model.installSafety === 'advanced_apply'
        ? 'Advanced source slice replacement for player-visible content.'
        : 'Guarded source slice replacement for player-visible content.'
    };
    if (base.type === 'replace_section') {
      return Object.assign(base, {
        content: text.endsWith('\n') ? text : text + '\n',
        dedupeSearch: text.trim().slice(0, 200),
        search: '',
        replace: ''
      });
    }
    return Object.assign(base, {
      search: model.currentText || source.anchorText || '',
      replace: text,
      content: '',
      dedupeSearch: ''
    });
  }

  function operationTypeFor(source, input) {
    const explicit = String(input && input.installOperationType || input && input.operationTemplate && input.operationTemplate.type || '');
    if (explicit === 'replace_section' || explicit === 'replace_text') {
      return explicit;
    }
    if (source.path && source.path.startsWith('source/scenes/') && source.endLine && source.line && source.endLine !== source.line && (source.anchorText || source.endAnchorText)) {
      return 'replace_section';
    }
    return 'replace_text';
  }

  function currentTextFor(source, input, options) {
    const opts = isObject(options) ? options : {};
    if (opts.currentText !== undefined) {
      return String(opts.currentText || '');
    }
    const template = isObject(input && input.operationTemplate) ? input.operationTemplate : {};
    return String(
      input && input.currentText !== undefined ? input.currentText :
      template.search || template.anchorText || source.anchorText || input && input.label || ''
    );
  }

  function normalizeSafety(value) {
    const text = String(value || '');
    return APPLY_INSTALL.has(text) ? text : 'guarded_apply';
  }

  function safetyForSource(source) {
    const ref = sourceRef(source || {});
    if (isProtectedSource(ref.path) || isGeneratedPath(ref.path)) {
      return 'advanced_apply';
    }
    return 'guarded_apply';
  }

  function isProtectedSource(path) {
    const rel = normalizePath(path);
    return PROTECTED_PATHS.has(rel) ||
      rel.startsWith('source/scenes/post_event') ||
      rel.startsWith('source/scenes/root');
  }

  function isGeneratedPath(path) {
    const rel = normalizePath(path);
    return rel === 'out/game.json' || rel.startsWith('out/html/') || rel.startsWith('out/');
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    const line = numberOrNull(value.line || value.startLine);
    const endLine = numberOrNull(value.endLine || value.line || value.startLine);
    return {
      path: normalizePath(value.path || value.sourcePath || ''),
      line,
      startLine: line,
      endLine,
      anchorText: String(value.anchorText || ''),
      endAnchorText: String(value.endAnchorText || ''),
      rawAnchorText: String(value.rawAnchorText || ''),
      rawEndAnchorText: String(value.rawEndAnchorText || ''),
      expectedRangeHash: String(value.expectedRangeHash || '')
    };
  }

  function projectProvenance(index) {
    const installApi = installPlanApi();
    if (installApi && typeof installApi.projectProvenanceFromIndex === 'function') {
      return installApi.projectProvenanceFromIndex(index);
    }
    const project = isObject(index && index.project) ? index.project : {};
    if (!project.name && !project.root) {
      return null;
    }
    return {
      name: String(project.name || ''),
      root: String(project.root || ''),
      schemaVersion: String(index && index.schemaVersion || ''),
      profileIds: ensureArray(project.profileIds).map(String)
    };
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? Math.floor(number) : null;
  }

  function normalizePath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
  }

  function safeId(value) {
    let text = String(value || 'source_slice')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!text) {
      text = 'source_slice';
    }
    return text.slice(0, 96);
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message, confidence: 'static_inferred'};
  }

  const api = {
    SOURCE_SLICE_EDITOR_VERSION,
    MODEL_KIND,
    PROPOSAL_KIND,
    buildSourceSliceEditor,
    buildProposal,
    sourceRef,
    safetyForSource
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSourceSliceEditor = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
