(function initProjectMapObjectCanvasProjectStateWorkspace(global) {
  'use strict';

  function fastSelectNode(state, next, deps) {
    if (!/^variable:/.test(String(next || ''))) {
      return false;
    }
    if (!state.model || currentSurface(state, deps).key !== 'project_state_board') {
      return false;
    }
    state.selectedCanvasNode = next;
    if (!syncVariableSelection(state, deps)) {
      call(deps && deps.render);
    }
    return true;
  }

  function openVariableFromCanvas(state, next, deps) {
    if (!/^variable:/.test(String(next || ''))) {
      return false;
    }
    const name = String(next).slice('variable:'.length);
    const variable = findVariable(state, name, deps);
    if (!variable) {
      return false;
    }
    state.values = {};
    state.deleteProposal = null;
    state.template = 'variables';
    state.mode = 'variables';
    state.view = 'variables';
    state.item = null;
    state.workspace = 'project_state';
    state.selectedCanvasNode = 'variable:' + name;
    state.baseDraft = editVariableDraft(state, variable, deps);
    state.proposalOptions = null;
    state.sourceSliceModel = null;
    state.sourceSliceAdvancedConfirmed = false;
    state.semanticLogicModel = null;
    state.semanticLogicAdvancedConfirmed = false;
    call(deps && deps.resetStructureCommands);
    call(deps && deps.resetRuntimeLens);
    state.model = call(deps && deps.buildTemplateModel, {values: {}, entry: {source: 'Canvas Asset Rail'}});
    state.status = translate(deps, 'projectState.status.openedFromAssetRail', 'Selected state variable opened from the Canvas asset rail.');
    call(deps && deps.showWorkspace, 'variables');
    call(deps && deps.render);
    return true;
  }

  function findVariable(state, name, deps) {
    const target = String(name || '');
    return ensureArray(deps, state.projectIndex && state.projectIndex.variables)
      .find((variable) => variable && String(variable.name || '') === target) || null;
  }

  function syncVariableSelection(state, deps) {
    const elements = deps && deps.elements;
    if (!elements || !elements.host || !state.model) {
      return false;
    }
    const surface = projectStateSurface(deps);
    if (!surface || typeof surface.renderInspectorCard !== 'function') {
      return false;
    }
    const selectedName = selectedVariableName(state);
    elements.host.querySelectorAll('[data-project-state-variable-row]').forEach((row) => {
      const active = String(row.dataset && row.dataset.projectStateVariableRow || '') === selectedName;
      row.classList.toggle('is-selected', active);
      row.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const card = elements.host.querySelector('[data-project-state-consumers], [data-project-state-metadata]');
    if (!card) {
      return false;
    }
    card.outerHTML = surface.renderInspectorCard(state.model, {
      projectIndex: state.projectIndex,
      selected: state.selectedCanvasNode,
      query: state.projectStateQuery,
      limit: state.projectStateLimit
    });
    return true;
  }

  function handleAction(state, action, deps) {
    const root = deps && deps.global || global;
    if (action === 'project_state_new_variable') {
      root.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      openVariableDraft(state, newVariableDraft(state, deps), 'projectState.status.addVariable', null, deps);
      return true;
    }
    if (action === 'project_state_edit_selected') {
      root.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      const variable = selectedVariable(state, deps);
      if (variable) {
        openVariableDraft(state, editVariableDraft(state, variable, deps), 'projectState.status.editSelected', 'variable:' + variable.name, deps);
      } else {
        state.status = translate(deps, 'projectState.status.noSelectedVariable', 'Select a variable before editing it.');
        call(deps && deps.updateDynamicSurfaces);
      }
      return true;
    }
    if (action === 'project_state_delete_selected') {
      root.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      const variable = selectedVariable(state, deps);
      if (variable) {
        openVariableDraft(state, deleteVariableDraft(state, variable, deps), 'projectState.status.deleteSelected', 'variable:' + variable.name, deps);
      } else {
        state.status = translate(deps, 'projectState.status.noSelectedVariable', 'Select a variable before editing it.');
        call(deps && deps.updateDynamicSurfaces);
      }
      return true;
    }
    if (action === 'project_state_show_more') {
      root.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      const rowLimit = projectStateRowLimit(deps);
      state.projectStateLimit = Math.max(rowLimit, Number(state.projectStateLimit || rowLimit) + rowLimit);
      call(deps && deps.render);
      return true;
    }
    if (action === 'project_state_clear_search') {
      root.__DMS_LAST_OBJECT_CANVAS_ACTION__ = action;
      state.projectStateQuery = '';
      state.projectStateLimit = projectStateRowLimit(deps);
      call(deps && deps.setProjectStateSearchFocus, {start: 0, end: 0});
      call(deps && deps.render);
      return true;
    }
    return false;
  }

  function openVariableDraft(state, draft, statusKey, selectedNode, deps) {
    state.values = {};
    state.valueOriginals = {};
    call(deps && deps.resetStructureCommands);
    state.baseDraft = draft || newVariableDraft(state, deps);
    state.template = 'variables';
    state.mode = 'variables';
    state.view = 'variables';
    state.workspace = 'project_state';
    state.selectedCanvasNode = selectedNode || selectedNodeForVariableDraft(state.baseDraft);
    state.deleteProposal = null;
    state.sourceSliceModel = null;
    state.sourceSliceAdvancedConfirmed = false;
    state.semanticLogicModel = null;
    state.semanticLogicAdvancedConfirmed = false;
    state.model = call(deps && deps.buildTemplateModel, {values: {}, entry: {source: 'Project State'}});
    state.status = translate(deps, statusKey, statusKey === 'projectState.status.deleteSelected'
      ? 'Selected variable loaded for deletion review.'
      : statusKey === 'projectState.status.editSelected' ? 'Selected variable loaded for editing.' : 'New variable draft ready.');
    call(deps && deps.showWorkspace, 'variables');
    call(deps && deps.render);
  }

  function selectedVariable(state, deps) {
    const name = selectedVariableName(state);
    const variables = variableList(state, deps);
    if (name) {
      const found = variables.find((item) => item && String(item.name || '') === name);
      return found || null;
    }
    const draftName = state.model && state.model.changeState && state.model.changeState.draft && state.model.changeState.draft.variableName;
    if (draftName) {
      const draftFound = variables.find((item) => item && String(item.name || '') === String(draftName));
      if (draftFound) {
        return draftFound;
      }
    }
    return variables[0] || null;
  }

  function selectedVariableName(state) {
    const selected = String(state.selectedCanvasNode || '');
    return selected.indexOf('variable:') === 0 ? selected.slice('variable:'.length) : '';
  }

  function newVariableDraft(state, deps) {
    const core = variableDraftCore(deps);
    if (core && typeof core.defaultDraft === 'function') {
      return core.defaultDraft(state.projectIndex);
    }
    const variableName = nextAvailableVariableName(state, 'new_variable', deps);
    const draft = {
      schemaVersion: '0.1',
      kind: 'variable_editor',
      id: variableName,
      title: 'New Variable',
      mode: 'add_new',
      variableName,
      label: labelFromVariableName(variableName),
      initialValue: '0',
      valueType: 'number',
      description: '',
      includeRootInit: true,
      includePostEventInit: false,
      includeQualityFile: true,
      evidence: core && typeof core.buildVariableModel === 'function' ? core.buildVariableModel(state.projectIndex) : {}
    };
    return core && typeof core.normalizeDraft === 'function' ? core.normalizeDraft(draft) : draft;
  }

  function selectedNodeForVariableDraft(draft) {
    const name = draft && draft.variableName ? String(draft.variableName) : '';
    return name ? 'variable:' + name : 'object';
  }

  function nextAvailableVariableName(state, baseName, deps) {
    const core = variableDraftCore(deps);
    if (core && typeof core.uniqueVariableName === 'function') {
      return core.uniqueVariableName(state.projectIndex, baseName || 'new_variable');
    }
    const base = safeDraftId(baseName || 'new_variable');
    const existing = new Set(variableList(state, deps).map((item) => String(item && item.name || '')).filter(Boolean));
    if (!existing.has(base)) {
      return base;
    }
    let index = 2;
    let next = base + '_' + index;
    while (existing.has(next)) {
      index += 1;
      next = base + '_' + index;
    }
    return next;
  }

  function labelFromVariableName(name) {
    return String(name || 'New Variable')
      .replace(/^q_/, '')
      .replace(/_/g, ' ')
      .replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }

  function editVariableDraft(state, variable, deps) {
    const core = variableDraftCore(deps);
    return core && typeof core.draftFromVariable === 'function'
      ? core.draftFromVariable(variable, state.projectIndex)
      : Object.assign(newVariableDraft(state, deps), {
        id: 'edit_' + safeDraftId(String(variable && variable.name || 'variable')),
        title: 'Edit ' + String(variable && variable.name || 'Variable'),
        mode: 'edit_existing',
        variableName: String(variable && variable.name || ''),
        includeRootInit: false,
        includePostEventInit: false,
        includeQualityFile: false
      });
  }

  function deleteVariableDraft(state, variable, deps) {
    const core = variableDraftCore(deps);
    return core && typeof core.deleteDraftFromVariable === 'function'
      ? core.deleteDraftFromVariable(variable, state.projectIndex)
      : Object.assign(newVariableDraft(state, deps), {
        id: 'delete_' + safeDraftId(String(variable && variable.name || 'variable')),
        title: 'Delete ' + String(variable && variable.name || 'Variable'),
        mode: 'delete_existing',
        variableName: String(variable && variable.name || ''),
        includeRootInit: false,
        includePostEventInit: false,
        includeQualityFile: false
      });
  }

  function safeDraftId(value) {
    const text = String(value || 'variable')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return /^[A-Za-z_]/.test(text) ? text : 'variable_' + (text || 'item');
  }

  function variableDraftCore(deps) {
    const opts = deps || {};
    return opts.variableEditorDraft || opts.global && opts.global.ProjectMapVariableEditorDraft || global.ProjectMapVariableEditorDraft || null;
  }

  function projectStateSurface(deps) {
    const opts = deps || {};
    return opts.projectStateSurface || opts.global && opts.global.ProjectMapProjectStateSurface || global.ProjectMapProjectStateSurface || null;
  }

  function currentSurface(state, deps) {
    return deps && typeof deps.currentSurface === 'function' ? deps.currentSurface(state.model) : {};
  }

  function variableList(state, deps) {
    return ensureArray(deps, state.projectIndex && state.projectIndex.variables);
  }

  function ensureArray(deps, value) {
    return deps && typeof deps.ensureArray === 'function' ? deps.ensureArray(value) : Array.isArray(value) ? value : [];
  }

  function projectStateRowLimit(deps) {
    return Number(deps && deps.projectStateRowLimit || 120);
  }

  function translate(deps, key, fallback) {
    return deps && typeof deps.t === 'function' ? deps.t(key, fallback) : fallback;
  }

  function call(fn) {
    if (typeof fn !== 'function') {
      return undefined;
    }
    return fn.apply(null, Array.prototype.slice.call(arguments, 1));
  }

  const api = {
    fastSelectNode,
    openVariableFromCanvas,
    findVariable,
    syncVariableSelection,
    handleAction,
    openVariableDraft,
    selectedVariable,
    selectedVariableName,
    newVariableDraft,
    selectedNodeForVariableDraft,
    nextAvailableVariableName,
    labelFromVariableName,
    editVariableDraft,
    deleteVariableDraft,
    safeDraftId
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectCanvasProjectStateWorkspace = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
