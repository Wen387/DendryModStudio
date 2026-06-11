(function initProjectMapEditCapability(global) {
  'use strict';

  const ROUTE_CLASSES = {
    DIRECT_FIELD_REPLACE: 'direct_field_replace',
    DIRECT_SECTION_REPLACE: 'direct_section_replace',
    OBJECT_WORKSPACE: 'object_workspace',
    SYSTEM_UI_WORKSPACE: 'system_ui_workspace',
    NEWS_ROUTER_WORKFLOW: 'news_router_workflow',
    SOURCE_SLICE_EDITOR: 'source_slice_editor',
    ADVANCED_SOURCE_PATCH: 'advanced_source_patch',
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
    const opts = isObject(options) ? options : {};
    const lookup = isObject(opts.lookup) ? opts.lookup : buildLookup(index);
    const item = resolveItem(lookup, view, itemOrId);
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
    return sourceSliceCapability(item, sourceRef(item.source || item.sourceSpan || item.topLevelSpan || {}), {
      view,
      reason: 'This ProjectIndex view has no object-aware editing workspace yet, so Studio opens the source-backed slice editor.',
      code: 'edit_capability.source_slice_view'
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
    const textCorpus = ensureArray(semantic.textCorpus && semantic.textCorpus.items);
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
      textCorpus,
      textCorpusByScene: groupTextCorpusByScene(textCorpus),
      surfaceText: ensureArray(semantic.surfaceText && semantic.surfaceText.items)
    };
  }

  function groupTextCorpusByScene(items) {
    const byScene = new Map();
    ensureArray(items).forEach((item) => {
      const owner = isObject(item && item.owner) ? item.owner : {};
      const sceneId = String(owner.sceneId || '');
      if (!sceneId) {
        return;
      }
      if (!byScene.has(sceneId)) {
        byScene.set(sceneId, []);
      }
      byScene.get(sceneId).push(item);
    });
    return byScene;
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
      return generatedSourceFallbackCapability(item, source, {
        view: 'textCorpus',
        reason: 'Generated runtime output cannot be edited in place; Studio treats this as an advanced source mapping edit route.'
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
    return sourceSliceCapability(item, source, {
      view: 'textCorpus',
      reason: 'This Text Corpus row has source evidence but no owning Event/Card/System UI workspace route yet, so Studio opens the source slice editor.',
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
      return sourceSliceCapability(item, target.source, {
        view: 'textCorpus',
        itemId: item.id || sceneId,
        target,
        reason: 'The text belongs to an Event/Card scene. Studio cannot preselect an exact field yet, so it opens the source slice editor.',
        diagnostics: ensureArray(model && model.diagnostics).concat([diagnostic('warning', 'edit_capability.object_route_source_slice', 'Open a source-backed slice editor for this visible text.')])
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
      const fieldTarget = Object.assign({}, target, {
        valueKey: field.id,
        fieldId: field.id,
        sectionId: field.sectionId || '',
        optionId: field.optionId || '',
        source: field.source || target.source
      });
      if (field.editability !== 'guarded_replace_text') {
        return sourceSliceCapability(item, field.source || target.source, {
          view: 'textCorpus',
          itemId: item.id || sceneId,
          target: fieldTarget,
          installSafety: 'advanced_apply',
          reason: 'This text maps to a source-backed field whose bounded editor route is high risk, so Studio uses an advanced source slice edit.',
          captured: ['owning scene', 'field source line', 'advanced source slice route']
        });
      }
      return capability({
        routeClass: ROUTE_CLASSES.DIRECT_FIELD_REPLACE,
        view: 'textCorpus',
        itemId: item.id || sceneId,
        target: fieldTarget,
        installSafety: 'guarded_apply',
        reason: 'This text maps to a specific source-backed field in the owning Event/Card editor.',
        captured: ['owning scene', 'field source line', 'guarded replace_text route']
      });
    }

    return sourceSliceCapability(item, target.source, {
      view: 'textCorpus',
      itemId: item.id || sceneId,
      target,
      reason: 'The text belongs to an Event/Card scene. Studio opens a source slice editor with surrounding context.',
      captured: ['owning scene', 'source path'],
      notCaptured: ['exact field route']
    });
  }

  function surfaceTextCapability(_index, _lookup, item) {
    const source = sourceRef(item.source || {});
    if (isGeneratedPath(source.path)) {
      return generatedSourceFallbackCapability(item, source, {
        view: 'surfaceText',
        reason: 'Generated runtime output cannot be edited in place; Studio treats this as an advanced source mapping edit route.'
      });
    }
    if (isQdisplayBandSource(source)) {
      return sourceSliceCapability(item, source, {
        view: 'surfaceText',
        installSafety: 'safe_apply',
        reason: 'qdisplay band lines are simple range→label maps; Studio opens the source slice editor with safe exact-line evidence.',
        code: 'edit_capability.qdisplay_band',
        captured: ['qdisplay band range', 'exact band line evidence'],
        notCaptured: ['formatter catalog']
      });
    }
    if (isProtectedRouterPath(source.path) || isSystemUiPath(source.path) || item.owner && item.owner.kind === 'surface_text') {
      return capability({
        routeClass: ROUTE_CLASSES.SYSTEM_UI_WORKSPACE,
        view: 'surfaceText',
        itemId: item.id || item.itemId || '',
        target: Object.assign(targetFromSource(source), systemUiTargetForItem(item, source), {
          itemId: item.id || item.itemId || ''
        }),
        installSafety: systemUiSafetyForSource(source, item.editability),
        reason: 'This visible label belongs to a System UI surface; Studio opens the UI workspace and emits a guarded or advanced source-backed operation.',
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
    return sourceSliceCapability(item, source, {
      view: 'surfaceText',
      reason: 'This surface text has source evidence but no specific owner route yet, so Studio opens the source slice editor.',
      code: 'edit_capability.surface_manual',
      target: Object.assign(targetFromSource(source), {template: 'surface'})
    });
  }

  function sceneCapability(index, lookup, view, item, options) {
    const sceneId = String(item && (item.id || item.sceneId) || '');
    const sceneView = view === 'cards' || view === 'events' ? view : sceneViewForSceneId(lookup, sceneId, item);
    const model = buildExistingModel(index, sceneView, sceneId || item, options);
    const target = {
      workspace: 'content',
      template: 'existing',
      view: sceneView,
      sceneId,
      source: sourceRef(item && (item.sourceSpan || item.source || item.topLevelSpan) || {})
    };
    if (!model || !model.ok) {
      return sourceSliceCapability(item, target.source, {
        view,
        itemId: sceneId,
        target,
        reason: 'Studio cannot build an object-aware editor for this scene yet, so it opens the source slice editor for the visible scene content.',
        diagnostics: ensureArray(model && model.diagnostics)
      });
    }
    return capability({
      routeClass: ROUTE_CLASSES.OBJECT_WORKSPACE,
      view,
      itemId: sceneId,
      target,
      installSafety: 'guarded_apply',
      reason: 'This Event/Card can be edited in the object workspace with guarded Review & Apply output.',
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
        installSafety: 'guarded_apply',
        reason: 'This monthly popup is backed by an event scene; Studio edits the linked event content and keeps router changes on an advanced route.',
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
        target: Object.assign(targetFromSource(source), systemUiTargetForItem(item, source)),
        installSafety: systemUiSafetyForSource(source, item && item.editability),
        reason: 'Root scene text affects entry/sidebar flow. Studio opens the System UI workspace and emits an advanced source-backed operation.',
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
      installSafety: 'advanced_apply',
      reason: 'News/router text is source-backed visible content; Studio opens an advanced source patch instead of a manual snippet.',
      captured: ['source evidence', 'router source patch route'],
      notCaptured: []
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

  function sourceSliceCapability(item, source, options) {
    const opts = isObject(options) ? options : {};
    const ref = sourceRef(source || item && (item.source || item.sourceSpan || item.topLevelSpan) || {});
    const target = Object.assign(targetFromSource(ref), opts.target || {}, {
      source: sourceRef(opts.target && opts.target.source || ref)
    });
    const routeClass = opts.routeClass || (
      isProtectedRouterPath(target.source.path) || isGeneratedPath(target.source.path)
        ? ROUTE_CLASSES.ADVANCED_SOURCE_PATCH
        : ROUTE_CLASSES.SOURCE_SLICE_EDITOR
    );
    const installSafety = opts.installSafety || safetyForSource(target.source);
    return capability({
      routeClass,
      view: opts.view || 'textCorpus',
      itemId: opts.itemId || item && (item.id || item.itemId) || '',
      target: Object.assign(target, {template: target.template || 'source_slice'}),
      installSafety,
      reason: opts.reason || 'This visible source-backed content can be edited through the source slice editor.',
      captured: opts.captured || ['source evidence', 'source slice editor'],
      notCaptured: opts.notCaptured || [],
      diagnostics: ensureArray(opts.diagnostics).concat(opts.code
        ? [diagnostic('info', opts.code, opts.reason || 'Source slice editor route selected.')]
        : [])
    });
  }

  function generatedSourceFallbackCapability(item, source, options) {
    const opts = isObject(options) ? options : {};
    return sourceSliceCapability(item, source, {
      view: opts.view || 'textCorpus',
      routeClass: ROUTE_CLASSES.ADVANCED_SOURCE_PATCH,
      installSafety: 'advanced_apply',
      reason: opts.reason || 'Generated runtime output needs a source mapping; Studio treats this as an advanced source patch route instead of a refused edit.',
      code: 'edit_capability.generated_mapping_required',
      captured: ['generated evidence', 'advanced source mapping route'],
      notCaptured: ['verified source owner']
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
      diagnostics: ensureArray(value.diagnostics),
      operationTemplate: isObject(value.operationTemplate)
        ? value.operationTemplate
        : operationTemplateForCapability(value, routeClass, String(value.installSafety || defaultSafety(routeClass)))
    };
  }

  function buildExistingModel(index, view, item, options) {
    const api = existingSceneEditApi();
    if (!api || typeof api.buildEditModel !== 'function') {
      return null;
    }
    const opts = isObject(options) ? options : {};
    const cache = opts.existingModelCache;
    const cacheKey = [view, isObject(item) ? (item.id || item.sceneId || JSON.stringify(item)) : item].map((value) => String(value || '')).join('\u0000');
    if (cache && typeof cache.get === 'function' && typeof cache.set === 'function' && cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    let result;
    try {
      result = api.buildEditModel(index, view, item, opts);
    } catch (err) {
      result = {
        ok: false,
        diagnostics: [diagnostic('warning', 'edit_capability.existing_model_failed', err && err.message ? err.message : String(err))]
      };
    }
    if (cache && typeof cache.set === 'function') {
      cache.set(cacheKey, result);
    }
    return result;
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
      return {workspace: 'system_ui', template: 'entry', internalTemplate: 'entry', selectedRegion: 'ui:main_content'};
    }
    if (rel.startsWith('source/scenes/status') || rel.startsWith('source/qdisplays/') || rel.includes('sidebar')) {
      return {workspace: 'system_ui', template: 'sidebar_status', internalTemplate: 'sidebar_status', selectedRegion: 'ui:sidebar_status'};
    }
    if (rel === 'source/info.dry') {
      return {workspace: 'system_ui', template: 'project', internalTemplate: 'project', selectedRegion: 'ui:screen_header'};
    }
    return {workspace: 'system_ui', template: 'entry', internalTemplate: 'entry', selectedRegion: 'ui:main_content'};
  }

  function systemUiTargetForItem(item, source) {
    const ref = sourceRef(source || item && item.source || {});
    const base = systemUiTargetForPath(ref.path);
    const role = String(item && (item.role || item.semanticRole || item.owner && item.owner.kind) || '').trim();
    const lower = role.toLowerCase();
    const target = Object.assign({}, base, {
      sourceRole: role,
      focusFieldId: '',
      manualReason: ''
    });
    if (base.internalTemplate === 'project') {
      target.selectedRegion = 'ui:screen_header';
      target.focusFieldId = /author/.test(lower) ? 'project.author' : /ifid/.test(lower) ? 'project.ifid' : 'project.gameTitle';
      target.role = 'project_metadata.' + target.focusFieldId.replace(/^project\./, '');
      return target;
    }
    if (base.internalTemplate === 'sidebar_status') {
      target.selectedRegion = 'ui:sidebar_status';
      target.focusFieldId = /title|heading/.test(lower)
        ? 'sidebar.sectionHeading'
        : /status|line/.test(lower)
          ? 'sidebar.sectionStatusLines'
          : 'sidebar.sectionBody';
      target.role = 'sidebar_status.' + target.focusFieldId.replace(/^sidebar\./, '');
      return target;
    }
    if (/option|route|choice/.test(lower)) {
      target.selectedRegion = 'ui:main_options';
      target.focusFieldId = 'entry.firstOptionTitle';
      target.role = 'entry_sidebar.option_label';
      return target;
    }
    if (/title/.test(lower)) {
      target.selectedRegion = 'ui:screen_header';
      target.focusFieldId = 'entry.rootTitle';
      target.role = 'entry_sidebar.title';
      return target;
    }
    if (/heading/.test(lower)) {
      target.selectedRegion = 'ui:main_content';
      target.focusFieldId = 'entry.rootHeading';
      target.role = 'entry_sidebar.heading';
      return target;
    }
    if (/body|intro|text|surface_text/.test(lower)) {
      target.selectedRegion = 'ui:main_content';
      target.focusFieldId = 'entry.rootIntro';
      target.role = 'entry_sidebar.opening';
      return target;
    }
    target.manualReason = 'System UI route found, but no unique draft field matched this visible text.';
    return target;
  }

  function systemUiSafetyForSource(source, editability) {
    const ref = sourceRef(source || {});
    if (isGeneratedPath(ref.path)) {
      return 'advanced_apply';
    }
    if (ref.path === 'source/scenes/root.scene.dry' || ref.path === 'source/info.dry') {
      return ref.line || ref.anchorText ? 'guarded_apply' : 'advanced_apply';
    }
    if (isSafeSurfaceSource(ref.path, editability) || ref.path.startsWith('source/scenes/') || ref.path.startsWith('source/qdisplays/')) {
      return ref.line || ref.anchorText ? 'guarded_apply' : 'advanced_apply';
    }
    return 'advanced_apply';
  }

  function targetFromSource(source) {
    const ref = sourceRef(source || {});
    return {
      source: ref,
      sourcePath: ref.path,
      line: ref.line || null,
      endLine: ref.endLine || ref.line || null,
      anchorText: ref.anchorText || '',
      endAnchorText: ref.endAnchorText || ''
    };
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

  function safetyForSource(source) {
    const ref = sourceRef(source || {});
    if (isGeneratedPath(ref.path) || isProtectedRouterPath(ref.path)) {
      return 'advanced_apply';
    }
    return 'guarded_apply';
  }

  function operationTemplateForCapability(value, routeClass, installSafety) {
    const target = isObject(value && value.target) ? value.target : {};
    const source = sourceRef(target.source || target);
    const safety = String(installSafety || defaultSafety(routeClass));
    if (!isApplySafety(safety) || !source.path) {
      return null;
    }
    const base = {
      path: source.path,
      safety,
      sourcePath: source.path,
      line: source.line || null,
      startLine: source.startLine || source.line || null,
      endLine: source.endLine || source.line || null,
      anchorText: source.anchorText || target.anchorText || '',
      endAnchorText: source.endAnchorText || target.endAnchorText || '',
      search: '',
      replace: '',
      content: '',
      dedupeSearch: '',
      role: target.role || target.sourceRole || '',
      description: 'Edit visible source-backed content from Studio.'
    };
    if (
      routeClass === ROUTE_CLASSES.DIRECT_SECTION_REPLACE ||
      routeClass === ROUTE_CLASSES.SOURCE_SLICE_EDITOR ||
      routeClass === ROUTE_CLASSES.ADVANCED_SOURCE_PATCH ||
      routeClass === ROUTE_CLASSES.NEWS_ROUTER_WORKFLOW
    ) {
      if (base.anchorText && base.endAnchorText && base.endLine && base.endLine !== base.line) {
        return Object.assign(base, {type: 'replace_section'});
      }
    }
    return Object.assign(base, {type: 'replace_text'});
  }

  function isApplySafety(safety) {
    const text = String(safety || '');
    return text === 'safe_apply' || text === 'guarded_apply' || text === 'advanced_apply';
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

  function isQdisplayBandSource(source) {
    const ref = sourceRef(source || {});
    return ref.path.startsWith('source/qdisplays/') &&
      ref.path.endsWith('.qdisplay.dry') &&
      Boolean(ref.line) &&
      Boolean(ref.anchorText);
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
    if (routeClass === ROUTE_CLASSES.OBJECT_WORKSPACE || routeClass === ROUTE_CLASSES.SYSTEM_UI_WORKSPACE || routeClass === ROUTE_CLASSES.SOURCE_SLICE_EDITOR) {
      return 'guarded_apply';
    }
    if (routeClass === ROUTE_CLASSES.NEWS_ROUTER_WORKFLOW || routeClass === ROUTE_CLASSES.ADVANCED_SOURCE_PATCH) {
      return 'advanced_apply';
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
      news_router_workflow: translate('editCapability.route.newsRouter', 'News/router source patch'),
      source_slice_editor: translate('editCapability.route.sourceSliceEditor', 'Source slice editor'),
      advanced_source_patch: translate('editCapability.route.advancedSourcePatch', 'Advanced source patch'),
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
      news_router_workflow: translate('editCapability.action.newsRouter', 'Open advanced source patch'),
      source_slice_editor: translate('editCapability.action.sourceSliceEditor', 'Open source slice editor'),
      advanced_source_patch: translate('editCapability.action.advancedSourcePatch', 'Open advanced source patch'),
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
      news_router_workflow: translate('editCapability.summary.newsRouter', 'This belongs to news/router flow and can be edited through an advanced source patch.'),
      source_slice_editor: translate('editCapability.summary.sourceSliceEditor', 'Open a bounded source slice editor and emit a guarded install operation.'),
      advanced_source_patch: translate('editCapability.summary.advancedSourcePatch', 'Open a bounded source slice editor and emit an advanced install operation.'),
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
