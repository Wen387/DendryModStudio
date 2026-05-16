(function initProjectMapObjectCanvasModelBuilder(global) {
  'use strict';

  function buildExistingModelFor(view, item, options, deps) {
    const apiModel = modelApi(deps);
    try {
      return apiModel && typeof apiModel.buildExistingCanvas === 'function'
        ? apiModel.buildExistingCanvas(projectIndex(deps), view, item, options || {})
        : diagnosticModel('existing', view || 'existing', item || '', new Error('Object Canvas model is unavailable.'), options, deps);
    } catch (err) {
      return diagnosticModel('existing', view || 'existing', item || '', err, options, deps);
    }
  }

  function buildNewEventModel(options, deps) {
    const apiModel = modelApi(deps);
    return apiModel && typeof apiModel.buildNewEventCanvas === 'function'
      ? apiModel.buildNewEventCanvas(projectIndex(deps), baseDraft(deps), options || {})
      : null;
  }

  function buildTemplateModel(options, deps) {
    const apiModel = modelApi(deps);
    const template = currentTemplate(deps);
    const nextOptions = withStructureCommandValues(options, deps);
    try {
      if (apiModel && typeof apiModel.buildTemplateCanvas === 'function') {
        return apiModel.buildTemplateCanvas(projectIndex(deps), template, baseDraft(deps), nextOptions || {});
      }
      return buildNewEventModel(nextOptions, deps);
    } catch (err) {
      const draft = baseDraft(deps);
      return diagnosticModel('template', template, draft && draft.id || '', err, nextOptions, deps);
    }
  }

  function buildSourceSliceCanvasModel(sliceModel, values, deps) {
    const workspace = sourceSliceWorkspace(deps);
    return workspace && typeof workspace.buildCanvasModel === 'function'
      ? workspace.buildCanvasModel(sliceModel, values || {}, sourceSliceWorkspaceDeps(deps))
      : diagnosticModel('source_slice', 'source_slice', sliceModel && sliceModel.targetId || '', new Error('Source Slice workspace is unavailable.'), {}, deps);
  }

  function buildSemanticLogicCanvasModel(editorModel, values, deps) {
    const workspace = semanticLogicWorkspace(deps);
    return workspace && typeof workspace.buildCanvasModel === 'function'
      ? workspace.buildCanvasModel(editorModel, values || {}, semanticLogicWorkspaceDeps(deps))
      : diagnosticModel('semantic_logic', 'semantic_logic', editorModel && editorModel.targetId || '', new Error('Semantic Logic workspace is unavailable.'), {}, deps);
  }

  function withStructureCommandValues(options, deps) {
    const opts = Object.assign({}, options || {});
    const values = Object.assign({}, opts.values || {});
    const commands = structureCommands(deps);
    if (commands.length) {
      values.__structureCommands = commands.slice();
    }
    opts.values = values;
    return opts;
  }

  function diagnosticModel(mode, template, objectId, err, options, deps) {
    const draft = baseDraft(deps);
    const translate = translateFn(deps && deps.t);
    const message = err && err.message ? err.message : String(err || 'Model build failed.');
    return {
      schemaVersion: '0.1',
      kind: 'object_authoring_canvas_model',
      ok: false,
      mode: mode === 'existing' ? 'existing' : String(template || 'event'),
      template: mode === 'existing' ? 'existing' : String(template || 'event'),
      templateLabel: String(template || ''),
      objectKind: String(template || 'object'),
      objectId: String(objectId || draft.id || ''),
      title: String(draft.title || draft.heading || objectId || template || translate('objectCanvas.titleFallback', 'Author object')),
      source: {path: ''},
      entry: {source: options && options.source || options && options.entry && options.entry.source || 'Create'},
      contextBoard: {},
      eventBody: {},
      changeState: {
        draft,
        proposal: draft,
        output: {},
        installPlan: null,
        operationSummary: {safeApply: 0, guardedApply: 0, manualReview: 0, refused: 0},
        changedCount: 0,
        diagnostics: [{severity: 'error', code: 'object_canvas.model_build_failed', message}],
        warnings: []
      },
      legacy: {template: String(template || '')},
      rawContext: null
    };
  }

  function modelApi(deps) {
    const opts = deps || {};
    if (opts.model) {
      return opts.model;
    }
    return typeof opts.modelApi === 'function' ? opts.modelApi() : null;
  }

  function projectIndex(deps) {
    const opts = deps || {};
    return opts.projectIndex || opts.state && opts.state.projectIndex || null;
  }

  function baseDraft(deps) {
    const opts = deps || {};
    return opts.baseDraft || opts.state && opts.state.baseDraft || {};
  }

  function currentTemplate(deps) {
    const opts = deps || {};
    return opts.template || opts.state && opts.state.template || 'event';
  }

  function structureCommands(deps) {
    const opts = deps || {};
    const value = opts.structureCommands || opts.state && opts.state.structureCommands || [];
    return Array.isArray(value) ? value : [];
  }

  function sourceSliceWorkspace(deps) {
    const opts = deps || {};
    if (opts.sourceSliceWorkspace) {
      return opts.sourceSliceWorkspace;
    }
    return typeof opts.sourceSliceWorkspaceApi === 'function' ? opts.sourceSliceWorkspaceApi() : null;
  }

  function semanticLogicWorkspace(deps) {
    const opts = deps || {};
    if (opts.semanticLogicWorkspace) {
      return opts.semanticLogicWorkspace;
    }
    return typeof opts.semanticLogicWorkspaceApi === 'function' ? opts.semanticLogicWorkspaceApi() : null;
  }

  function sourceSliceWorkspaceDeps(deps) {
    const opts = deps || {};
    return typeof opts.sourceSliceWorkspaceDeps === 'function' ? opts.sourceSliceWorkspaceDeps() : {};
  }

  function semanticLogicWorkspaceDeps(deps) {
    const opts = deps || {};
    return typeof opts.semanticLogicWorkspaceDeps === 'function' ? opts.semanticLogicWorkspaceDeps() : {};
  }

  function translateFn(fn) {
    return typeof fn === 'function' ? fn : identityTranslate;
  }

  function identityTranslate(_key, fallback) {
    return fallback;
  }

  const api = {
    buildExistingModelFor,
    buildNewEventModel,
    buildTemplateModel,
    buildSourceSliceCanvasModel,
    buildSemanticLogicCanvasModel,
    withStructureCommandValues,
    diagnosticModel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectCanvasModelBuilder = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
