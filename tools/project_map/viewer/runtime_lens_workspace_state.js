(function initProjectMapRuntimeLensWorkspaceState(global) {
  'use strict';

  function reset(state) {
    state.runtimeLensSession = null;
    state.runtimeLensStatus = 'idle';
    state.runtimeLensFocusKey = '';
    state.runtimeLensExpanded = false;
  }

  function bind(root, state, deps) {
    const ui = runtimeLensUi();
    if (ui && typeof ui.bind === 'function') {
      ui.bind(root, {onAction: (action) => handleAction(state, action, deps || {})});
    }
  }

  async function handleAction(state, action, deps) {
    const helpers = deps || {};
    if (action === 'toggle_expand') {
      state.runtimeLensExpanded = !state.runtimeLensExpanded;
      helpers.render && helpers.render();
      return;
    }
    if (action === 'clear') {
      reset(state);
      helpers.render && helpers.render();
      return;
    }
    if (action === 'open_external') {
      openExternal(state);
      return;
    }
    if (action === 'create') {
      await createLens(state, helpers);
    }
  }

  async function createLens(state, deps) {
    const desktop = global.dendryDesktop;
    if (!desktop || typeof desktop.createRuntimeLens !== 'function') {
      state.runtimeLensStatus = 'unavailable';
      state.status = translate('runtimeLens.browserOnlyShort', 'Desktop app required.');
      deps.render && deps.render();
      return;
    }
    rebuildModel(state, deps);
    const focus = currentFocus(state);
    if (!focus || !focus.id) {
      state.runtimeLensStatus = 'failed';
      state.status = translate('runtimeLens.noFocus', 'Select a source-backed object or UI region before creating a Lens.');
      deps.render && deps.render();
      return;
    }
    state.runtimeLensStatus = 'building';
    state.runtimeLensFocusKey = focus.key || (focus.kind + ':' + focus.id);
    deps.render && deps.render();
    try {
      const result = await desktop.createRuntimeLens({
        plan: currentPlan(state),
        focus,
        projectIndex: state.projectIndex
      });
      state.runtimeLensSession = result || null;
      state.runtimeLensStatus = result && result.ok ? 'ready' : 'failed';
      state.runtimeLensFocusKey = focus.key || (focus.kind + ':' + focus.id);
      state.status = result && result.ok
        ? translate('runtimeLens.status.ready', 'Focused Runtime Lens is ready.')
        : translate('runtimeLens.status.failed', 'Focused Runtime Lens could not be created.');
    } catch (err) {
      state.runtimeLensSession = failedSession(err);
      state.runtimeLensStatus = 'failed';
      state.status = translate('runtimeLens.status.failed', 'Focused Runtime Lens could not be created.');
    }
    deps.render && deps.render();
  }

  function currentFocus(state) {
    const ui = runtimeLensUi();
    if (ui && typeof ui.focusFromSystemRegion === 'function' && (state.workspace || '') === 'system_ui') {
      return ui.focusFromSystemRegion(state.projectIndex, state.model || {}, state.selectedCanvasNode, {fixture: state.systemUiFixture});
    }
    if (ui && typeof ui.focusFromCanvas === 'function') {
      return ui.focusFromCanvas(state.projectIndex, state.model || {}, state.selectedCanvasNode);
    }
    const kind = state.template === 'card' ? 'card' : 'event';
    const id = state.item || state.model && state.model.objectId || '';
    return {kind, id, title: state.model && state.model.title || '', key: kind + ':' + id};
  }

  function currentPlan(state) {
    const change = state.model && state.model.changeState || {};
    const output = change.output || {};
    return change.installPlan || output.installPlan || parseJson(output.installPlanJson) || null;
  }

  function rebuildModel(state, deps) {
    state.values = deps.collectValues ? deps.collectValues() : state.values || {};
    if (state.mode === 'existing' && deps.buildExistingModel) {
      state.model = deps.buildExistingModel({values: state.values});
    } else if (deps.buildTemplateModel) {
      state.model = deps.buildTemplateModel({values: state.values});
    }
  }

  function openExternal(state) {
    const session = state.runtimeLensSession || {};
    const url = session.externalUrl || session.lensUrl || session.lensPageUrl || '';
    if (!url) {
      return;
    }
    const desktop = global.dendryDesktop;
    if (desktop && typeof desktop.openExternalUrl === 'function') {
      desktop.openExternalUrl({url});
      return;
    }
    if (global.open) {
      global.open(url, '_blank', 'noopener');
    }
  }

  function failedSession(err) {
    return {
      ok: false,
      status: 'failed',
      diagnostics: [{
        severity: 'error',
        code: 'runtime_lens.create_failed',
        message: err && err.message ? err.message : String(err || 'Runtime Lens failed.'),
        confidence: 'exact'
      }]
    };
  }

  function runtimeLensUi() {
    return global.ProjectMapRuntimeLensUi || null;
  }

  function parseJson(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch (_err) {
      return null;
    }
  }

  function translate(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  const api = {reset, bind, handleAction, currentFocus, currentPlan};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapRuntimeLensWorkspaceState = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
