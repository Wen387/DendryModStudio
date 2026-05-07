(function initProjectMapEditCapability(global) {
  'use strict';

  const ROUTE_CLASSES = {
    DIRECT_FIELD_REPLACE: 'direct_field_replace',
    DIRECT_SECTION_REPLACE: 'direct_section_replace',
    OBJECT_WORKSPACE: 'object_workspace',
    SYSTEM_UI_WORKSPACE: 'system_ui_workspace',
    NEWS_ROUTER_WORKFLOW: 'news_router_workflow',
    MANUAL_REVIEW: 'manual_review',
    UNSUPPORTED: 'unsupported'
  };

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function existingSceneEditApi() {
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

  function buildEditCapability(projectIndex, view, itemOrId, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const lookup = buildLookup(index);
    const item = resolveItem(lookup, view, itemOrId);
    const opts = isObject(options) ? options : {};
    if (!item) {
      return capability({
        routeClass: ROUTE_CLASSES.UNSUPPORTED,
        view,
        reason: 'No matching ProjectIndex item was found.',
        diagnostics: [diagnostic('warning', 'edit_capability.not_found', 'No matching ProjectIndex item was found.')]
      });
    }
    if (view === 'textCorpus') {
      return textCorpusCapability(index, lookup, item, opts);
    }
    if (view === 'surfaceText') {
      return surfaceTextCapability(index, lookup, item, opts);
    }
    if (view === 'events' || view === 'cards') {
      return sceneCapability(index, lookup, view, item, opts);
    }
    if (view === 'news') {
      return newsCapability(index, lookup, item, opts);
    }
    if (view === 'scenes') {
      return sceneCapability(index, lookup, sceneViewForItem(lookup, item), item, opts);
    }
    return capability({
      routeClass: ROUTE_CLASSES.MANUAL_REVIEW,
      view,
      itemId: item.id || '',
      reason: 'This ProjectIndex view has no object-aware editing workspace yet.',
      diagnostics: [diagnostic('info', 'edit_capability.manual_view', 'This row can still be reviewed through source evidence.')]
    });
  }

  function buildLookup(index) {
    const semantic = isObject(index.semantic) ? index.semantic : {};
    const scenes = ensureArray(index.scenes);
    const scenesById = new Map();
    scenes.forEach((scene) => {
      if (scene && scene.id) {
        scenesById.set(String(scene.id), scene);
      }
    });
    const events = ensureArray(semantic.events);
    const cards = ensureArray(semantic.cards);
    return {
      index,
      semantic,
      scenes,
      scenesById,
      eventIds: new Set(events.map((item) => String(item && item.id || '')).filter(Boolean)),
      cardIds: new Set(cards.map((item) => String(item && item.id || '')).filter(Boolean)),
      events,
      cards,
      news: ensureArray(semantic.news && semantic.news.items).concat(ensureArray(semantic.news && semantic.news.eventPopups)),
      textCorpus: ensureArray(semantic.textCorpus && semantic.textCorpus.items),
      surfaceText: ensureArray(semantic.surfaceText && semantic.surfaceText.items)
    };
  }

  function resolveItem(lookup, view, itemOrId) {
    if (isObject(itemOrId)) {
      return itemOrId;
    }
    const id = String(itemOrId || '');
    if (!id) {
      return null;
    }
    if (view === 'events') {
      return materializedSceneRef(lookup.events.find((item) => item && String(item.id || '') === id), lookup);
    }
    if (view === 'cards') {
      return materializedSceneRef(lookup.cards.find((item) => item && String(item.id || '') === id), lookup);
    }
    if (view === 'scenes') {
      return lookup.scenesById.get(id) || null;
    }
    if (view === 'news') {
      return lookup.news.find((item) => item && String(item.id || item.linkedSceneId || '') === id) || null;
    }
    if (view === 'textCorpus') {
      return lookup.textCorpus.find((item) => item && String(item.id || '') === id) || null;
    }
    if (view === 'surfaceText') {
      return lookup.surfaceText.find((item) => item && String(item.id || '') === id) || null;
    }
    return null;
  }

  function materializedSceneRef(ref, lookup) {
    if (!ref) {
      return null;
    }
    const scene = lookup.scenesById.get(String(ref.id || ''));
    return scene ? Object.assign({}, scene, ref, {scene}) : ref;
  }

  function textCorpusCapability(index, lookup, item, options) {
    const owner = isObject(item.owner) ? item.owner : {};
    const source = sourceRef(item.source || {});
    if (isProtectedRouterPath(source.path)) {
      return protectedPathCapability(item, source, options);
    }
    if (isGeneratedPath(source.path)) {
      return manualCapability(item, 'Generated runtime output stays protected from Studio source edits.', {
        code: 'edit_capability.generated_output',
        installSafety: 'refused',
        target: targetFromSource(source)
      });
    }
    if (isNewsRouterRole(item.role) || isNewsRouterPath(source.path)) {
      return newsRouterCapability(item, source);
    }
    if (owner.sceneId && lookup.scenesById.has(String(owner.sceneId))) {
      return sceneTextCapability(index, lookup, item, options);
    }
    if (owner.kind === 'surface_text' || item.role === 'surface_label') {
      return surfaceTextCapability(index, lookup, item, options);
    }
    return manualCapability(item, 'This Text Corpus row has source evidence but no owning Event/Card/System UI workspace route yet.', {
      code: 'edit_capability.unowned_text',
      target: targetFromSource(source)
    });
  }

  function sceneTextCapability(index, lookup, item, options) {
    const owner = isObject(item.owner) ? item.owner : {};
    const sceneId = String(owner.sceneId || '');
    const scene = lookup.scenesById.get(sceneId);
    const view = sceneViewForSceneId(lookup, sceneId, scene);
    const model = buildExistingModel(index, view, sceneId, options);
    const target = {
      workspace: 'content',
      template: 'existing',
      view,
      sceneId,
      itemId: item.id || '',
      source: sourceRef(item.source || {})
    };
    if (!model || !model.ok) {
      return capability({
        routeClass: ROUTE_CLASSES.OBJECT_WORKSPACE,
        view: 'textCorpus',
        itemId: item.id || sceneId,
        target,
        installSafety: 'manual_review',
        reason: 'The text belongs to an Event/Card scene, but Studio needs more source evidence before preselecting an exact field.',
        diagnostics: ensureArray(model && model.diagnostics).concat([diagnostic('warning', 'edit_capability.object_route_only', 'Open the owning object workspace and review manually.')])
      });
    }

    const block = findMatchingTextBlock(model, item);
    if (block && isBlockRole(item.role)) {
      return capability({
        routeClass: ROUTE_CLASSES.DIRECT_SECTION_REPLACE,
        view: 'textCorpus',
        itemId: item.id || sceneId,
        target: Object.assign({}, target, {
          valueKey: 'block:' + block.id,
          fieldId: block.id,
          sectionId: block.sectionId || '',
          source: block.source || target.source
        }),
        installSafety: 'guarded_apply',
        reason: 'This prose is inside a bounded source-backed page section; Studio can open the owning Event/Card editor with the section selected.',
        captured: ['owning scene', 'section source range', 'guarded replace_section route']
      });
    }

    const field = findMatchingField(model, item);
    if (field) {
      return capability({
        routeClass: ROUTE_CLASSES.DIRECT_FIELD_REPLACE,
        view: 'textCorpus',
        itemId: item.id || sceneId,
        target: Object.assign({}, target, {
          valueKey: field.id,
          fieldId: field.id,
          sectionId: field.sectionId || '',
          optionId: field.optionId || '',
          source: field.source || target.source
        }),
        installSafety: field.editability === 'guarded_replace_text' ? 'guarded_apply' : 'manual_review',
        reason: 'This text maps to a specific source-backed field in the owning Event/Card editor.',
        captured: ['owning scene', 'field source line', 'guarded replace_text route']
      });
    }

    return capability({
      routeClass: ROUTE_CLASSES.OBJECT_WORKSPACE,
      view: 'textCorpus',
      itemId: item.id || sceneId,
      target,
      installSafety: 'manual_review',
      reason: 'The text belongs to an Event/Card scene. Open the object workspace to edit with surrounding context.',
      captured: ['owning scene', 'source path'],
      notCaptured: ['exact field route']
    });
  }

  function surfaceTextCapability(_index, _lookup, item) {
    const source = sourceRef(item.source || {});
    if (isGeneratedPath(source.path)) {
      return manualCapability(item, 'Generated runtime output stays protected; use source evidence only.', {
        code: 'edit_capability.generated_surface',
        installSafety: 'refused',
        target: targetFromSource(source)
      });
    }
    if (isProtectedRouterPath(source.path) || isSystemUiPath(source.path) || item.owner && item.owner.kind === 'surface_text') {
      return capability({
        routeClass: ROUTE_CLASSES.SYSTEM_UI_WORKSPACE,
        view: 'surfaceText',
        itemId: item.id || item.itemId || '',
        target: Object.assign(targetFromSource(source), systemUiTargetForPath(source.path), {
          itemId: item.id || item.itemId || ''
        }),
        installSafety: isSafeSurfaceSource(source.path, item.editability) ? 'guarded_apply' : 'manual_review',
        reason: 'This visible label belongs to a System UI surface, so it should be reviewed in the System UI workspace instead of a generic text patch.',
        captured: ['source evidence', 'system UI route']
      });
    }
    if (String(item.editability || '') === 'draft_exportable' && source.path && source.line) {
      return capability({
        routeClass: ROUTE_CLASSES.DIRECT_FIELD_REPLACE,
        view: 'surfaceText',
        itemId: item.id || '',
        target: Object.assign(targetFromSource(source), {
          workspace: 'content',
          template: 'surface',
          valueKey: 'surface-label-replacement'
        }),
        installSafety: 'safe_apply',
        reason: 'This source-backed surface label can still use the bounded Text Patch proposal route.',
        captured: ['visible label', 'single source line']
      });
    }
    return manualCapability(item, 'This surface text should stay proposal-first until Studio has a more specific owner route.', {
      code: 'edit_capability.surface_manual',
      target: Object.assign(targetFromSource(source), {template: 'surface'})
    });
  }

  function sceneCapability(index, lookup, view, item, options) {
    const sceneId = String(item && (item.id || item.sceneId) || '');
    const sceneView = view === 'cards' || view === 'events' ? view : sceneViewForSceneId(lookup, sceneId, item);
    const model = buildExistingModel(index, sceneView, sceneId || item, options);
    return capability({
      routeClass: model && model.ok ? ROUTE_CLASSES.OBJECT_WORKSPACE : ROUTE_CLASSES.MANUAL_REVIEW,
      view,
      itemId: sceneId,
      target: {
        workspace: 'content',
        template: 'existing',
        view: sceneView,
        sceneId,
        source: sourceRef(item && (item.sourceSpan || item.source || item.topLevelSpan) || {})
      },
      installSafety: model && model.ok ? 'guarded_apply' : 'manual_review',
      reason: model && model.ok
        ? 'This Event/Card can be edited in the object workspace with guarded Review & Apply output.'
        : 'Studio cannot build an object-aware editor for this scene yet; keep this as a manual review proposal.',
      diagnostics: ensureArray(model && model.diagnostics)
    });
  }

  function newsCapability(_index, _lookup, item) {
    const source = sourceRef(item && (item.source || item.excerptSource) || {});
    if (item && item.delivery === 'legacy_event_popup' && item.linkedSceneId) {
      return capability({
        routeClass: ROUTE_CLASSES.OBJECT_WORKSPACE,
        view: 'news',
        itemId: item.linkedSceneId || '',
        target: {
          workspace: 'content',
          template: 'existing',
          view: 'events',
          sceneId: String(item.linkedSceneId || ''),
          source
        },
        installSafety: 'manual_review',
        reason: 'This monthly popup is backed by an event scene; edit the event object, then review router behavior separately.',
        captured: ['linked event scene', 'popup source evidence']
      });
    }
    return newsRouterCapability(item || {}, source);
  }

  function protectedPathCapability(item, source) {
    if (source.path === 'source/scenes/root.scene.dry') {
      return capability({
        routeClass: ROUTE_CLASSES.SYSTEM_UI_WORKSPACE,
        view: 'textCorpus',
        itemId: item.id || '',
        target: Object.assign(targetFromSource(source), {workspace: 'system_ui', template: 'entry'}),
        installSafety: 'manual_review',
        reason: 'Root scene text affects entry/sidebar flow. Review it in the System UI workspace instead of a generic Text Patch.',
        captured: ['protected root source', 'system UI route']
      });
    }
    return newsRouterCapability(item, source);
  }

  function newsRouterCapability(item, source) {
    return capability({
      routeClass: ROUTE_CLASSES.NEWS_ROUTER_WORKFLOW,
      view: 'textCorpus',
      itemId: item.id || item.itemId || '',
      target: Object.assign(targetFromSource(source), {workspace: 'content', template: 'news'}),
      installSafety: 'manual_review',
      reason: 'News/router text is selected through post-event routing. Studio should keep it proposal-first unless a specialized router operation owns it.',
      captured: ['source evidence', 'router/proposal route'],
      notCaptured: ['automatic router rewrite']
    });
  }

  function manualCapability(item, reason, options) {
    const opts = isObject(options) ? options : {};
    return capability({
      routeClass: ROUTE_CLASSES.MANUAL_REVIEW,
      view: opts.view || 'textCorpus',
      itemId: item && (item.id || item.itemId) || '',
      target: opts.target || targetFromSource(item && item.source || {}),
      installSafety: opts.installSafety || 'manual_review',
      reason,
      diagnostics: [diagnostic('warning', opts.code || 'edit_capability.manual_review', reason)]
    });
  }

  function capability(input) {
    const value = isObject(input) ? input : {};
    const routeClass = value.routeClass || ROUTE_CLASSES.MANUAL_REVIEW;
    return {
      schemaVersion: '0.1',
      kind: 'edit_capability',
      routeClass,
      view: String(value.view || ''),
      itemId: String(value.itemId || ''),
      target: isObject(value.target) ? value.target : {},
      installSafety: String(value.installSafety || defaultSafety(routeClass)),
      reason: String(value.reason || ''),
      captured: ensureArray(value.captured).map(String),
      notCaptured: ensureArray(value.notCaptured).map(String),
      diagnostics: ensureArray(value.diagnostics)
    };
  }

  function buildExistingModel(index, view, item, options) {
    const api = existingSceneEditApi();
    if (!api || typeof api.buildEditModel !== 'function') {
      return null;
    }
    try {
      return api.buildEditModel(index, view, item, options || {});
    } catch (err) {
      return {
        ok: false,
        diagnostics: [diagnostic('warning', 'edit_capability.existing_model_failed', err && err.message ? err.message : String(err))]
      };
    }
  }

  function findMatchingTextBlock(model, item) {
    const itemId = String(item && item.id || '');
    const source = sourceRef(item && item.source || {});
    return ensureArray(model && model.textBlocks).find((block) => {
      if (itemId && ensureArray(block.fieldIds).map(String).includes(itemId)) {
        return true;
      }
      const blockSource = sourceRef(block.source || {});
      return samePath(blockSource.path, source.path) &&
        source.line &&
        blockSource.line &&
        blockSource.endLine &&
        source.line >= blockSource.line &&
        source.line <= blockSource.endLine;
    }) || null;
  }

  function findMatchingField(model, item) {
    const itemId = String(item && item.id || '');
    const source = sourceRef(item && item.source || {});
    const text = String(item && item.text || '').trim();
    const role = String(item && item.role || '');
    return ensureArray(model && model.fields).find((field) => {
      if (itemId && String(field.id || '') === itemId) {
        return true;
      }
      const fieldSource = sourceRef(field.source || {});
      return samePath(fieldSource.path, source.path) &&
        source.line &&
        fieldSource.line === source.line &&
        (!role || String(field.role || '') === role) &&
        (!text || String(field.original || '').trim() === text);
    }) || null;
  }

  function isBlockRole(role) {
    const text = String(role || '');
    return text === 'body' || text === 'heading' || text === 'conditional_body';
  }

  function isNewsRouterRole(role) {
    const text = String(role || '');
    return text.startsWith('news_') || text.startsWith('monthly_popup');
  }

  function sceneViewForItem(lookup, item) {
    const sceneId = String(item && (item.id || item.sceneId || item.owner && item.owner.sceneId) || '');
    return sceneViewForSceneId(lookup, sceneId, item);
  }

  function sceneViewForSceneId(lookup, sceneId, scene) {
    const id = String(sceneId || '');
    if (id && lookup.cardIds.has(id)) {
      return 'cards';
    }
    if (id && lookup.eventIds.has(id)) {
      return 'events';
    }
    const tags = ensureArray(scene && scene.tags);
    if (scene && scene.flags && scene.flags.isPinnedCard || tags.includes('card') || tags.includes('deck') || tags.includes('advisor')) {
      return 'cards';
    }
    return 'events';
  }

  function systemUiTargetForPath(path) {
    const rel = normalizePath(path);
    if (rel === 'source/scenes/root.scene.dry') {
      return {workspace: 'system_ui', template: 'entry'};
    }
    if (rel.startsWith('source/scenes/status') || rel.includes('sidebar')) {
      return {workspace: 'system_ui', template: 'entry', internalTemplate: 'sidebar_status'};
    }
    if (rel === 'source/info.dry') {
      return {workspace: 'system_ui', template: 'project'};
    }
    return {workspace: 'system_ui', template: 'entry'};
  }

  function targetFromSource(source) {
    const ref = sourceRef(source || {});
    return {
      source: ref,
      sourcePath: ref.path,
      line: ref.line || null,
      endLine: ref.endLine || ref.line || null
    };
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    const line = numberOrNull(value.line || value.startLine);
    const endLine = numberOrNull(value.endLine || value.line || value.startLine);
    return {
      path: normalizePath(value.path || ''),
      line,
      endLine
    };
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function normalizePath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
  }

  function samePath(left, right) {
    return normalizePath(left) === normalizePath(right);
  }

  function isProtectedRouterPath(path) {
    const rel = normalizePath(path);
    return rel === 'source/scenes/root.scene.dry' ||
      rel === 'source/scenes/post_event.scene.dry' ||
      rel === 'source/scenes/post_event_news.scene.dry';
  }

  function isNewsRouterPath(path) {
    const rel = normalizePath(path);
    return rel === 'source/scenes/post_event.scene.dry' ||
      rel === 'source/scenes/post_event_news.scene.dry' ||
      rel.includes('/post_event');
  }

  function isGeneratedPath(path) {
    const rel = normalizePath(path);
    return rel === 'out/game.json' ||
      rel.startsWith('out/html/') ||
      rel.startsWith('out/');
  }

  function isSystemUiPath(path) {
    const rel = normalizePath(path);
    return rel === 'source/info.dry' ||
      rel === 'source/scenes/root.scene.dry' ||
      rel.startsWith('source/scenes/status') ||
      rel.startsWith('source/qdisplays/');
  }

  function isSafeSurfaceSource(path, editability) {
    const rel = normalizePath(path);
    return String(editability || '') === 'draft_exportable' &&
      (rel.startsWith('source/qdisplays/') || rel.startsWith('source/scenes/status'));
  }

  function defaultSafety(routeClass) {
    if (routeClass === ROUTE_CLASSES.DIRECT_FIELD_REPLACE || routeClass === ROUTE_CLASSES.DIRECT_SECTION_REPLACE) {
      return 'guarded_apply';
    }
    return 'manual_review';
  }

  function routeClassLabel(routeClass, t) {
    const translate = typeof t === 'function' ? t : (_key, fallback) => fallback;
    const labels = {
      direct_field_replace: translate('editCapability.route.directField', 'Direct field'),
      direct_section_replace: translate('editCapability.route.directSection', 'Section edit'),
      object_workspace: translate('editCapability.route.objectWorkspace', 'Object workspace'),
      system_ui_workspace: translate('editCapability.route.systemUiWorkspace', 'System UI workspace'),
      news_router_workflow: translate('editCapability.route.newsRouter', 'News/router review'),
      manual_review: translate('editCapability.route.manualReview', 'Manual review'),
      unsupported: translate('editCapability.route.unsupported', 'Unsupported')
    };
    return labels[String(routeClass || '')] || String(routeClass || '');
  }

  function routeActionLabel(routeClass, t) {
    const translate = typeof t === 'function' ? t : (_key, fallback) => fallback;
    const labels = {
      direct_field_replace: translate('editCapability.action.directField', 'Open object editor'),
      direct_section_replace: translate('editCapability.action.directSection', 'Open section editor'),
      object_workspace: translate('editCapability.action.objectWorkspace', 'Open object workspace'),
      system_ui_workspace: translate('editCapability.action.systemUiWorkspace', 'Open System UI workspace'),
      news_router_workflow: translate('editCapability.action.newsRouter', 'Create review proposal'),
      manual_review: translate('editCapability.action.manualReview', 'Create review proposal'),
      unsupported: translate('editCapability.action.unsupported', 'No edit route yet')
    };
    return labels[String(routeClass || '')] || labels.manual_review;
  }

  function routeSummary(capabilityModel, t) {
    const translate = typeof t === 'function' ? t : (_key, fallback) => fallback;
    const routeClass = capabilityModel && capabilityModel.routeClass || ROUTE_CLASSES.MANUAL_REVIEW;
    const labels = {
      direct_field_replace: translate('editCapability.summary.directField', 'This text maps to a concrete editable field in the owning Event/Card workspace.'),
      direct_section_replace: translate('editCapability.summary.directSection', 'This text maps to a bounded page section in the owning Event/Card workspace.'),
      object_workspace: translate('editCapability.summary.objectWorkspace', 'Open the owning object workspace to edit with surrounding story context.'),
      system_ui_workspace: translate('editCapability.summary.systemUiWorkspace', 'This belongs to System UI; review it in the UI workspace instead of a generic text patch.'),
      news_router_workflow: translate('editCapability.summary.newsRouter', 'This belongs to news/router flow; keep it proposal-first for review.'),
      manual_review: translate('editCapability.summary.manualReview', 'Studio can keep source evidence, but this remains a manual review proposal.'),
      unsupported: translate('editCapability.summary.unsupported', 'Studio does not have an edit route for this row yet.')
    };
    return capabilityModel && capabilityModel.reason || labels[routeClass] || labels.manual_review;
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message, confidence: 'static_inferred'};
  }

  const api = {
    ROUTE_CLASSES,
    buildEditCapability,
    buildLookup,
    routeClassLabel,
    routeActionLabel,
    routeSummary
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapEditCapability = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
