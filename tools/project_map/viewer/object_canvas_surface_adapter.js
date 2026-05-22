(function initProjectMapObjectCanvasSurfaceAdapter(global) {
  'use strict';

  function templateFromDraft(draft, deps) {
    const apiModel = modelApi(deps);
    if (apiModel && typeof apiModel.templateFromDraft === 'function') {
      return apiModel.templateFromDraft(draft);
    }
    const value = draft || {};
    return value.kind === 'news_item' ? 'news' : value.kind === 'card' ? 'card' : 'event';
  }

  function isCanvasTemplate(template, deps) {
    const registry = registryApi(deps);
    if (registry && typeof registry.isTemplateSupported === 'function') {
      return registry.isTemplateSupported(template) && normalizeTemplate(template, deps) !== 'existing';
    }
    return Boolean(normalizeTemplate(template, deps));
  }

  function normalizeTemplate(template, deps) {
    const registry = registryApi(deps);
    if (registry && typeof registry.normalizeTemplate === 'function') {
      return registry.normalizeTemplate(template);
    }
    const text = String(template || '').trim();
    const supported = {
      event: true,
      news: true,
      card: true,
      deck_pool: true,
      advisor_controller: true,
      play_surface: true,
      workspace_layout: true,
      sidebar_status: true,
      surface: true,
      entry: true,
      project: true,
      variables: true
    };
    return supported[text] ? text : '';
  }

  function workspaceForTemplate(template, deps) {
    const registry = registryApi(deps);
    if (registry && typeof registry.workspaceForTemplate === 'function') {
      return registry.workspaceForTemplate(template);
    }
    const key = normalizeTemplate(template, deps) || (template === 'existing' ? 'existing' : 'event');
    if (key === 'entry' || key === 'play_surface' || key === 'workspace_layout' || key === 'sidebar_status' || key === 'project') {
      return 'system_ui';
    }
    if (key === 'variables') {
      return 'project_state';
    }
    return 'content';
  }

  function systemUiTemplateForRegion(nodeKey, deps) {
    const router = regionRouterApi(deps);
    return router && typeof router.templateForRegion === 'function' ? router.templateForRegion(nodeKey) : '';
  }

  function surfaceForTemplate(template, deps) {
    const registry = registryApi(deps);
    if (registry && typeof registry.surfaceForTemplate === 'function') {
      return registry.surfaceForTemplate(template);
    }
    return {key: 'content_storyboard', workspace: workspaceForTemplate(template, deps), fallback: 'Content Storyboard', labelKey: 'authoring.surface.contentStoryboard'};
  }

  function surfaceLabelFor(surface, deps) {
    const registry = registryApi(deps);
    if (registry && typeof registry.surfaceLabel === 'function') {
      return registry.surfaceLabel(surface, translateFn(deps && deps.t));
    }
    return surface && surface.fallback || '';
  }

  function currentSurface(model, deps) {
    const opts = deps || {};
    const state = opts.state || {};
    const translate = translateFn(opts.t);
    if (state.mode === 'source_slice' || state.template === 'source_slice') {
      return {
        key: 'source_slice_editor',
        workspace: 'content',
        labelKey: 'sourceSlice.surface',
        fallback: translate('sourceSlice.surface', 'Precise Source Edit')
      };
    }
    if (state.mode === 'semantic_logic' || state.template === 'semantic_logic') {
      return {
        key: 'semantic_logic_editor',
        workspace: 'content',
        labelKey: 'semanticLogic.surface',
        fallback: translate('semanticLogic.surface', 'Semantic Logic Editor')
      };
    }
    const cardWorkspace = cardWorkspaceApi(opts);
    const templateSurface = typeof opts.surfaceForTemplate === 'function'
      ? opts.surfaceForTemplate
      : (template) => surfaceForTemplate(template, opts);
    if (cardWorkspace && typeof cardWorkspace.isCardBoardState === 'function' && cardWorkspace.isCardBoardState(state)) {
      return templateSurface('card');
    }
    return templateSurface(state.mode === 'existing' ? 'existing' : state.template || model && model.template || 'event');
  }

  function modelApi(deps) {
    const opts = deps || {};
    if (opts.model) {
      return opts.model;
    }
    return typeof opts.modelApi === 'function' ? opts.modelApi() : null;
  }

  function registryApi(deps) {
    const opts = deps || {};
    if (opts.registry) {
      return opts.registry;
    }
    return typeof opts.registryApi === 'function' ? opts.registryApi() : null;
  }

  function regionRouterApi(deps) {
    const opts = deps || {};
    if (opts.regionRouter) {
      return opts.regionRouter;
    }
    return typeof opts.regionRouterApi === 'function' ? opts.regionRouterApi() : null;
  }

  function cardWorkspaceApi(deps) {
    const opts = deps || {};
    if (opts.cardWorkspace) {
      return opts.cardWorkspace;
    }
    return typeof opts.cardWorkspaceApi === 'function' ? opts.cardWorkspaceApi() : null;
  }

  function translateFn(fn) {
    return typeof fn === 'function' ? fn : identityTranslate;
  }

  function identityTranslate(_key, fallback) {
    return fallback;
  }

  const api = {
    templateFromDraft,
    isCanvasTemplate,
    normalizeTemplate,
    workspaceForTemplate,
    systemUiTemplateForRegion,
    surfaceForTemplate,
    surfaceLabelFor,
    currentSurface
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectCanvasSurfaceAdapter = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
