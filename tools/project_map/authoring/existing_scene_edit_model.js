(function initProjectMapExistingSceneEdit(global) {
  'use strict';

  const EXISTING_SCENE_EDIT_VERSION = '0.2';
  const MODEL_KIND = 'existing_scene_edit_model';
  const PROPOSAL_KIND = 'existing_scene_edit';
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const RESERVED_CONDITION_WORDS = new Set([
    'and', 'or', 'not', 'if', 'else', 'true', 'false', 'null', 'undefined',
    'in', 'is', 'then', 'return', 'Q'
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

  function eventWorkbenchApi() {
    if (global && global.ProjectMapEventWorkbench) {
      return global.ProjectMapEventWorkbench;
    }
    if (typeof require === 'function') {
      try {
        return require('./event_workbench_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function logicFieldsApi() {
    if (global && global.ProjectMapExistingSceneLogicFields) {
      return global.ProjectMapExistingSceneLogicFields;
    }
    if (typeof require === 'function') {
      try {
        return require('./existing_scene_logic_fields.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function eventStructureApi() {
    if (global && global.ProjectMapEventStructureModel) {
      return global.ProjectMapEventStructureModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./event_structure_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function buildEditModel(projectIndex, view, itemOrId, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    const lookup = isObject(opts.lookup) ? opts.lookup : buildLookup(index);
    const scene = resolveScene(lookup, view, itemOrId);
    const diagnostics = [];
    if (!scene || !scene.id) {
      return {
        schemaVersion: EXISTING_SCENE_EDIT_VERSION,
        kind: MODEL_KIND,
        ok: false,
        sceneId: String(itemOrId || ''),
        sceneKind: normalizeSceneKind(view, null, lookup),
        fields: [],
        options: [],
        sections: [],
        effects: [],
        assets: [],
        diagnostics: [diagnostic('warning', 'existing_scene_edit.not_found', 'No source-backed Event/Card scene was found.')]
      };
    }
    const sceneKind = normalizeSceneKind(view, scene, lookup);
    const source = sourceRef(scene.sourceSpan || scene.topLevelSpan || {path: scene.path});
    if (!source.path) {
      diagnostics.push(diagnostic('warning', 'existing_scene_edit.no_source', 'This scene has no source path, so Studio can only show a read-only editor.'));
    }
    const textRows = textRowsForScene(lookup, scene, source.path);
    const scriptRows = textRows.filter(isEffectScriptRow);
    const visibleTextRows = textRows.filter((row) => !isEffectScriptRow(row));
    const textFields = visibleTextRows
      .filter((row) => !isEffectScriptRow(row))
      .map((row, index) => fieldFromTextRow(row, index, source.path));
    let fields = textFields.concat(
      metadataEditableFields(scene, source.path, textFields),
      assetEditableFields(scene, source.path)
    );
    if (!fields.length) {
      diagnostics.push(diagnostic('warning', 'existing_scene_edit.no_text_rows', 'No source-backed Text Corpus rows were found for this scene.'));
    }
    const eventOptions = optionRows(scene, fields);
    const textBlocks = textBlocksForScene(scene, visibleTextRows, source.path, eventOptions);
    const effects = effectRows(index, scene, scriptRows);
    const flow = flowForScene(scene, eventOptions, effects);
    fields = fields.concat(
      routeEditableFields(scene, eventOptions),
      effectEditableFields(scene, effects, eventOptions),
      structuralActionFields(scene, eventOptions, effects, textBlocks, source)
    );
    const fieldById = new Map(fields.map((field) => [field.id, field]));
    return {
      schemaVersion: EXISTING_SCENE_EDIT_VERSION,
      kind: MODEL_KIND,
      ok: true,
      sceneId: String(scene.id || ''),
      sceneKind,
      title: String(scene.title || scene.id || ''),
      source,
      profileIds: ensureArray(index.project && index.project.profileIds).map(String),
      fields,
      textBlocks,
      options: eventOptions,
      sections: sectionRows(fields, eventOptions),
      effects,
      flow,
      assets: ensureArray(scene.assetRefs).map(normalizeAssetRef).filter(Boolean),
      warnings: diagnostics.map((item) => item.message),
      diagnostics,
      metadata: metadataRows(scene, source, fieldById),
      advanced: {
        tags: ensureArray(scene.tags).map(String),
        rawViewIf: String(scene.viewIf || ''),
        path: source.path
      },
      editorOptions: opts
    };
  }

  function buildLookup(index) {
    const scenes = ensureArray(index.scenes);
    const scenesById = new Map();
    scenes.forEach((scene) => {
      if (scene && scene.id) {
        scenesById.set(String(scene.id), scene);
      }
    });
    const textCorpus = ensureArray(index.semantic && index.semantic.textCorpus && index.semantic.textCorpus.items);
    return {
      index,
      scenes,
      scenesById,
      events: ensureArray(index.semantic && index.semantic.events),
      cards: ensureArray(index.semantic && index.semantic.cards),
      textCorpus,
      textCorpusByScene: groupTextCorpusByScene(textCorpus)
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

  function resolveScene(lookup, view, itemOrId) {
    if (isObject(itemOrId)) {
      if (itemOrId.scene && itemOrId.scene.id) {
        return itemOrId.scene;
      }
      const id = itemOrId.sceneId || itemOrId.linkedSceneId || itemOrId.id;
      if (id && lookup.scenesById.has(String(id))) {
        return lookup.scenesById.get(String(id));
      }
      if (itemOrId.id || itemOrId.sourceSpan || itemOrId.path) {
        return itemOrId;
      }
    }
    const id = String(itemOrId || '');
    if (!id) {
      return null;
    }
    const semantic = String(view || '') === 'cards' ? lookup.cards : lookup.events;
    const ref = semantic.find((item) => item && String(item.id || '') === id);
    if (ref && lookup.scenesById.has(id)) {
      return lookup.scenesById.get(id);
    }
    return lookup.scenesById.get(id) || null;
  }

  function normalizeSceneKind(view, scene, lookup) {
    const text = String(view || '').trim();
    if (text === 'cards' || text === 'card') {
      return 'card';
    }
    if (text === 'events' || text === 'event' || text === 'news') {
      return 'event';
    }
    const id = String(scene && scene.id || '');
    if (lookup && lookup.cards.some((item) => item && String(item.id || '') === id)) {
      return 'card';
    }
    return 'event';
  }

  function textRowsForScene(lookup, scene, sourcePath) {
    const sceneId = String(scene.id || '');
    const span = scene.sourceSpan || scene.topLevelSpan || {};
    const rows = lookup.textCorpusByScene && typeof lookup.textCorpusByScene.get === 'function'
      ? ensureArray(lookup.textCorpusByScene.get(sceneId))
      : ensureArray(lookup.textCorpus);
    return rows
      .filter((item) => item && item.owner && String(item.owner.sceneId || '') === sceneId)
      .filter((item) => {
        const path = String(item.source && item.source.path || '');
        return !path || !sourcePath || path === sourcePath;
      })
      .filter((item) => {
        const line = sourceLine(item.source);
        if (!line || !span.startLine || !span.endLine) {
          return true;
        }
        return line >= Number(span.startLine) && line <= Number(span.endLine);
      })
      .sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
  }

  function fieldFromTextRow(row, index, sceneSourcePath) {
    const owner = isObject(row.owner) ? row.owner : {};
    const source = sourceRef(row.source || {});
    const id = safeId(row.id || [row.role || 'text', owner.sectionId || '', owner.itemId || '', source.line || index + 1].filter(Boolean).join('_'));
    const original = String(row.text || '');
    const guarded = canGuardField(source, original);
    return {
      id,
      role: String(row.role || 'text'),
      label: roleLabel(row.role),
      original,
      value: original,
      source,
      sourcePath: source.path || sceneSourcePath || '',
      editability: guarded ? 'guarded_replace_text' : 'advanced_source_patch',
      owner: {
        sceneId: String(owner.sceneId || ''),
        sectionId: String(owner.sectionId || ''),
        itemId: String(owner.itemId || row.optionId || ''),
        kind: String(owner.kind || '')
      },
      sectionId: String(owner.sectionId || ''),
      optionId: String(owner.itemId || row.optionId || ''),
      confidence: row.confidence || '',
      reason: guarded
        ? 'Exact source line can be checked before replacement.'
        : 'Needs source slice editing and advanced apply because Studio lacks safe single-line source evidence.'
    };
  }

  function canGuardField(source, original) {
    const path = String(source && source.path || '');
    const line = Number(source && (source.line || source.startLine) || 0);
    const endLine = Number(source && (source.endLine || source.line || source.startLine) || line || 0);
    return Boolean(
      path.startsWith('source/scenes/') &&
      path.endsWith('.scene.dry') &&
      !isProtectedRouterPath(path) &&
      Number.isInteger(line) &&
      line > 0 &&
      (!Number.isInteger(endLine) || endLine <= 0 || endLine === line) &&
      String(original || '').trim()
    );
  }

  function optionRows(scene, fields) {
    return collectSceneOptions(scene).map((entry, index) => {
      const option = entry.option || {};
      const target = isObject(option.target) ? option.target : {};
      const rawTarget = rawOptionTarget(option, target);
      const resolvedTarget = resolveOptionTarget(scene, rawTarget, target);
      const targetSection = findSceneSection(scene, resolvedTarget || rawTarget);
      const id = safeId(entry.sectionId
        ? [entry.sectionKey || 'section', rawTarget || option.id || 'option_' + (index + 1)].filter(Boolean).join('__')
        : (rawTarget || option.id || 'option_' + (index + 1)));
      const parts = splitOptionTitle(option.title || '');
      const labelField = findOptionField(fields, rawTarget || id, 'option_label', parts.label, entry.sectionId);
      const subtitleField = findOptionField(fields, rawTarget || id, 'option_subtitle', parts.subtitle, entry.sectionId);
      const unavailableField = findOptionField(fields, rawTarget || id, 'unavailable_text', option.unavailableText || '', entry.sectionId);
      const targetUnavailableField = targetSection
        ? fields.find((field) => field.role === 'unavailable_text' && String(field.sectionId || '') === String(targetSection.id || ''))
        : null;
      const source = optionSourceRef(option.sourceSpan || option.source || {}, labelField, subtitleField, unavailableField);
      const labelInfo = optionLabelInfo(scene, option, parts, labelField, resolvedTarget, rawTarget, index);
      const ownerViewIf = String(entry.section && entry.section.viewIf || '');
      const ownerChooseIf = String(entry.section && entry.section.chooseIf || '');
      const targetViewIf = String(targetSection && targetSection.viewIf || '');
      const targetChooseIf = String(targetSection && targetSection.chooseIf || '');
      return {
        id,
        targetId: resolvedTarget,
        rawTargetId: rawTarget,
        sectionId: entry.sectionId,
        sectionLabel: entry.sectionLabel,
        label: labelInfo.label,
        labelSource: labelInfo.source,
        subtitle: subtitleField ? subtitleField.original : parts.subtitle,
        labelFieldId: labelField && labelField.id || '',
        subtitleFieldId: subtitleField && subtitleField.id || '',
        unavailableFieldId: unavailableField && unavailableField.id || '',
        chooseIf: String(option.chooseIf || ''),
        sectionViewIf: uniqueStrings([ownerViewIf, targetViewIf]).join(' / '),
        sectionChooseIf: uniqueStrings([ownerChooseIf, targetChooseIf]).join(' / '),
        unavailableText: unavailableField ? unavailableField.original : targetUnavailableField ? targetUnavailableField.original : String(option.unavailableText || ''),
        source
      };
    });
  }

  function optionLabelInfo(scene, option, parts, labelField, resolvedTarget, rawTarget, index) {
    if (labelField && String(labelField.original || '').trim()) {
      return {label: String(labelField.original || ''), source: 'field'};
    }
    if (parts && String(parts.label || '').trim()) {
      return {label: String(parts.label || ''), source: 'inline'};
    }
    const title = String(option && option.title || '').trim();
    if (title) {
      return {label: title, source: 'option_title'};
    }
    const targetSection = findSceneSection(scene, resolvedTarget || rawTarget);
    const targetTitle = String(targetSection && (targetSection.title || targetSection.subtitle) || '').trim();
    if (targetTitle) {
      return {label: targetTitle, source: 'target_title'};
    }
    const target = String(rawTarget || resolvedTarget || '').trim();
    if (target) {
      return {label: humanSectionId(target), source: 'target_id'};
    }
    return {label: 'Option ' + (Number(index || 0) + 1), source: 'generated'};
  }

  function collectSceneOptions(scene) {
    const rows = [];
    ensureArray(scene && scene.options).forEach((option) => {
      rows.push({
        option,
        section: null,
        sectionId: '',
        sectionKey: 'scene',
        sectionLabel: 'Scene'
      });
    });
    const sceneId = String(scene && scene.id || '');
    ensureArray(scene && scene.sections).forEach((section) => {
      const sectionId = String(section && section.id || '');
      const sectionKey = sectionId.startsWith(sceneId + '.') ? sectionId.slice(sceneId.length + 1) : sectionId;
      ensureArray(section && section.options).forEach((option) => {
        rows.push({
          option,
          section,
          sectionId,
          sectionKey,
          sectionLabel: String(section && (section.title || section.subtitle) || sectionKey || sectionId || 'Section')
        });
      });
    });
    return rows;
  }

  function rawOptionTarget(option, target) {
    const value = String(target && target.id || option && option.targetId || option && option.id || '').trim();
    return value.replace(/^[@#]/, '');
  }

  function resolveOptionTarget(scene, rawTarget, target) {
    const raw = String(rawTarget || '').trim();
    if (!raw) {
      return '';
    }
    if (target && target.kind === 'tag') {
      return 'tag:' + raw;
    }
    const sceneId = String(scene && scene.id || '');
    if (raw.indexOf('.') >= 0 || raw.startsWith('runtime:') || raw.startsWith('tag:')) {
      return raw;
    }
    if (localAnchors(scene).has(raw)) {
      return sceneId + '.' + raw;
    }
    return raw;
  }

  function localAnchors(scene) {
    const sceneId = String(scene && scene.id || '');
    const anchors = new Set();
    ensureArray(scene && scene.sections).forEach((section) => {
      const id = String(section && section.id || '');
      if (sceneId && id.startsWith(sceneId + '.')) {
        anchors.add(id.slice(sceneId.length + 1));
      }
    });
    return anchors;
  }

  function optionSourceRef(optionSource, labelField, subtitleField, unavailableField) {
    const source = sourceRef(optionSource || {});
    const evidence = [labelField, subtitleField, unavailableField]
      .map((field) => sourceRef(field && field.source || {}))
      .find((ref) => ref.path && ref.anchorText && (!source.line || !ref.line || ref.line === source.line));
    if (!evidence) {
      return source;
    }
    return Object.assign({}, source, {
      path: source.path || evidence.path,
      line: source.line || evidence.line,
      startLine: source.startLine || evidence.startLine || evidence.line,
      endLine: source.endLine || evidence.endLine || evidence.line,
      anchorText: source.anchorText || evidence.anchorText,
      endAnchorText: source.endAnchorText || evidence.endAnchorText || evidence.anchorText
    });
  }

  function routeEditableFields(scene, options) {
    const api = logicFieldsApi();
    return api && typeof api.buildRouteFields === 'function' ? api.buildRouteFields(scene, options) : [];
  }

  function findOptionField(fields, optionId, role, fallbackText, sectionId) {
    const exact = fields.find((field) => {
      if (field.role !== role || !field.optionId || safeId(field.optionId) !== safeId(optionId)) {
        return false;
      }
      return !sectionId || !field.sectionId || String(field.sectionId) === String(sectionId);
    });
    if (exact) {
      return exact;
    }
    const text = String(fallbackText || '').trim();
    if (!text) {
      return null;
    }
    return fields.find((field) => field.role === role && String(field.original || '').trim() === text && (!sectionId || !field.sectionId || String(field.sectionId) === String(sectionId))) || null;
  }

  function sectionRows(fields, options) {
    const sections = new Map();
    fields.forEach((field) => {
      const key = field.sectionId || 'scene';
      if (!sections.has(key)) {
        sections.set(key, {id: key, label: key === 'scene' ? 'Scene text' : key, fieldIds: [], optionIds: []});
      }
      sections.get(key).fieldIds.push(field.id);
    });
    ensureArray(options).forEach((option) => {
      const key = option.targetId || option.id;
      if (!key) {
        return;
      }
      if (!sections.has(key)) {
        sections.set(key, {id: key, label: option.label || key, fieldIds: [], optionIds: []});
      }
      sections.get(key).optionIds.push(option.id);
    });
    return Array.from(sections.values());
  }

  function flowForScene(scene, options, effects) {
    const sceneId = String(scene && scene.id || '');
    const nodes = [];
    const edges = [];
    const seenNodes = new Set();
    const seenEdges = new Set();
    const sectionList = ensureArray(scene && scene.sections);
    const effectCounts = countBySection(effects);
    function addNode(node) {
      if (!node || !node.id || seenNodes.has(node.id)) {
        return;
      }
      seenNodes.add(node.id);
      nodes.push(node);
    }
    function addEdge(edge) {
      if (!edge || !edge.from || !edge.to) {
        return;
      }
      const key = [edge.from, edge.to, edge.kind || '', edge.label || '', edge.condition || '', sourceLine(edge.source || {}) || ''].join('|');
      if (seenEdges.has(key)) {
        return;
      }
      seenEdges.add(key);
      edges.push(edge);
    }
    addNode({
      id: sceneId,
      localId: '',
      kind: 'root',
      label: String(scene && (scene.title || scene.id) || sceneId),
      optionCount: ensureArray(scene && scene.options).length,
      effectCount: effectCounts.get('') || 0,
      source: sourceRef(scene && (scene.sourceSpan || scene.topLevelSpan) || {})
    });
    sectionList.forEach((section) => {
      const id = String(section && section.id || '');
      addNode({
        id,
        localId: localSectionId(sceneId, id),
        kind: flowNodeKind(section),
        label: sectionDisplayLabel(sceneId, section, id),
        optionCount: ensureArray(section && section.options).length,
        effectCount: effectCounts.get(id) || effectCounts.get(localSectionId(sceneId, id)) || 0,
        viewIf: String(section && section.viewIf || ''),
        chooseIf: String(section && section.chooseIf || ''),
        source: sourceRef(section && section.sourceSpan || {})
      });
    });
    routeArray(scene && scene.routes && scene.routes.goTo).forEach((route, index) => {
      addEdge(flowEdge(scene, sceneId, route, {
        from: sceneId,
        kind: 'route',
        label: 'scene route',
        index
      }));
    });
    ensureArray(options).forEach((option, index) => {
      const from = String(option.sectionId || sceneId);
      const to = String(option.targetId || option.rawTargetId || '');
      addEdge({
        id: 'option:' + String(option.id || index + 1),
        from,
        to,
        kind: 'option',
        label: String(option.label || option.rawTargetId || option.id || ''),
        condition: String(option.chooseIf || option.sectionViewIf || option.sectionChooseIf || ''),
        rawTarget: String(option.rawTargetId || ''),
        optionId: String(option.id || ''),
        source: sourceRef(option.source || {})
      });
    });
    sectionList.forEach((section) => {
      const from = String(section && section.id || '');
      routeArray(section && section.routes && section.routes.goTo).forEach((route, index) => {
        addEdge(flowEdge(scene, from, route, {
          from,
          kind: routeCondition(route) ? 'conditional_route' : 'route',
          label: 'section route',
          index
        }));
      });
    });
    const conditionalRouteCount = edges.filter((edge) => edge.kind === 'conditional_route' || edge.condition).length;
    const targetTitleFallbackCount = ensureArray(options).filter((option) => option.labelSource === 'target_title').length;
    return {
      nodes,
      edges,
      summary: {
        sectionCount: sectionList.length,
        optionCount: ensureArray(options).length,
        routeEdgeCount: edges.filter((edge) => edge.kind === 'route' || edge.kind === 'conditional_route').length,
        optionEdgeCount: edges.filter((edge) => edge.kind === 'option').length,
        conditionalRouteCount,
        targetTitleFallbackCount,
        menuSectionCount: nodes.filter((node) => node.kind === 'menu').length,
        effectSectionCount: nodes.filter((node) => Number(node.effectCount || 0) > 0).length
      }
    };
  }

  function flowEdge(scene, from, route, options) {
    const opts = isObject(options) ? options : {};
    const raw = routeRawTarget(route);
    const target = normalizeFlowTarget(scene, raw);
    return {
      id: [opts.kind || 'route', from, raw || opts.index || 0].filter(Boolean).join(':'),
      from,
      to: target,
      kind: String(opts.kind || 'route'),
      label: String(route && (route.label || route.title) || opts.label || ''),
      condition: routeCondition(route),
      rawTarget: raw,
      source: sourceRef(route && (route.source || route.sourceSpan) || {})
    };
  }

  function routeArray(value) {
    if (Array.isArray(value)) {
      return value;
    }
    return value ? [value] : [];
  }

  function routeRawTarget(route) {
    if (!route) {
      return '';
    }
    if (typeof route === 'string') {
      return route.replace(/^[@#]/, '');
    }
    return String(route.id || route.targetId || route.target || route.raw || '').replace(/^[@#]/, '');
  }

  function routeCondition(route) {
    if (!route || typeof route === 'string') {
      return '';
    }
    return String(route.condition || route.predicate || route.if || route.viewIf || '');
  }

  function normalizeFlowTarget(scene, rawTarget) {
    const raw = String(rawTarget || '').trim();
    if (!raw) {
      return '';
    }
    if (raw.indexOf('.') >= 0 || raw.startsWith('runtime:') || raw.startsWith('tag:')) {
      return raw;
    }
    const sceneId = String(scene && scene.id || '');
    return sceneId && localAnchors(scene).has(raw) ? sceneId + '.' + raw : raw;
  }

  function flowNodeKind(section) {
    if (ensureArray(section && section.options).length) {
      return 'menu';
    }
    if (section && (section.routes && section.routes.goTo)) {
      return 'step';
    }
    return 'content';
  }

  function countBySection(effects) {
    const counts = new Map();
    ensureArray(effects).forEach((effect) => {
      const key = String(effect && effect.sectionId || '');
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }

  function localSectionId(sceneId, sectionId) {
    const raw = String(sectionId || '');
    const scene = String(sceneId || '');
    return scene && raw.startsWith(scene + '.') ? raw.slice(scene.length + 1) : raw;
  }

  function textBlocksForScene(scene, rows, sceneSourcePath, options) {
    const bySection = new Map();
    normalizeBlockTextRows(rows).forEach((row) => {
      if (!isBlockTextRole(row.role)) {
        return;
      }
      const source = sourceRef(row.source || {});
      if (!source.path || (sceneSourcePath && source.path !== sceneSourcePath) || !source.line) {
        return;
      }
      const owner = isObject(row.owner) ? row.owner : {};
      const key = String(owner.sectionId || '');
      if (!bySection.has(key)) {
        bySection.set(key, []);
      }
      bySection.get(key).push(row);
    });
    const blocks = [];
    bySection.forEach((sectionRowsForBlock, sectionId) => {
      const ordered = sectionRowsForBlock.slice().sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
      const runs = logicalTextRuns(ordered);
      const lineUsage = new Map();
      runs.forEach((run, index) => {
        run.index = index;
        uniqueStrings(run.rows.map((row) => String(sourceLine(row.source) || ''))).forEach((line) => {
          if (!line) {
            return;
          }
          lineUsage.set(line, (lineUsage.get(line) || 0) + 1);
        });
      });
      runs.forEach((run) => {
        const sharedLine = uniqueStrings(run.rows.map((row) => String(sourceLine(row.source) || '')))
          .some((line) => line && lineUsage.get(line) > 1);
        const block = textBlockFromRows(scene, sectionId, run.rows, options, {
          runKind: run.kind,
          runIndex: run.index,
          singleRun: runs.length === 1,
          forceManual: sharedLine
        });
        if (block) {
          blocks.push(block);
        }
      });
    });
    return blocks.sort((a, b) => (a.source.line || 0) - (b.source.line || 0));
  }

  function normalizeBlockTextRows(rows) {
    const inputRows = ensureArray(rows);
    const byLine = new Map();
    inputRows.forEach((row) => {
      if (!isBlockTextRole(row && row.role)) {
        return;
      }
      const key = blockSourceLineKey(row);
      if (!key) {
        return;
      }
      if (!byLine.has(key)) {
        byLine.set(key, []);
      }
      byLine.get(key).push(row);
    });
    const mixedLineKeys = new Map();
    byLine.forEach((lineRows, key) => {
      const bodyRows = lineRows.filter((row) => String(row && row.role || '') === 'body');
      const conditionalRows = lineRows.filter((row) => String(row && row.role || '') === 'conditional_body');
      if (!bodyRows.length || !conditionalRows.length) {
        return;
      }
      const anchor = sourceAnchor(bodyRows[0]) || sourceAnchor(conditionalRows[0]);
      if (!isMixedInlineConditionalSource(anchor)) {
        return;
      }
      mixedLineKeys.set(key, {
        anchor,
        inlineConditions: uniqueStrings(conditionalRows.map((row) => lastMeaningfulCondition(row && row.conditions)).filter(Boolean))
      });
    });
    return inputRows.map((row) => {
      const key = blockSourceLineKey(row);
      const mixed = key ? mixedLineKeys.get(key) : null;
      if (!mixed) {
        return row;
      }
      if (String(row && row.role || '') === 'conditional_body') {
        return null;
      }
      if (String(row && row.role || '') !== 'body') {
        return row;
      }
      return Object.assign({}, row, {
        text: mixed.anchor,
        originalText: mixed.anchor,
        hasInlineConditionals: true,
        inlineConditions: mixed.inlineConditions
      });
    }).filter(Boolean);
  }

  function blockSourceLineKey(row) {
    const source = row && row.source || {};
    const path = String(source.path || '');
    const line = sourceLine(source);
    const section = String(row && row.owner && row.owner.sectionId || '');
    return path && line ? [path, line, section].join(':') : '';
  }

  function isMixedInlineConditionalSource(value) {
    const text = String(value || '').trim();
    if (!/\[\?\s*if\s+/i.test(text)) {
      return false;
    }
    const remainder = text.replace(/\[\?\s*if\s+.+?\s*:\s*.*?\s*\?\]/g, ' ').replace(/\s+/g, ' ').trim();
    return Boolean(remainder && !isStructuralSceneLine(remainder));
  }

  function isStructuralSceneLine(value) {
    const text = String(value || '').trim();
    if (!text) {
      return true;
    }
    if (/^(#|@|-|=)/.test(text)) {
      return true;
    }
    if (/^[A-Za-z][A-Za-z0-9_-]*\s*:/.test(text)) {
      return true;
    }
    if (/\bQ(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\s*['"][^'"]+['"]\s*\])\s*(?:[+\-*/%]?=|\+\+|--)/.test(text)) {
      return true;
    }
    return false;
  }

  function logicalTextRuns(rows) {
    const runs = [];
    let current = null;
    ensureArray(rows).forEach((row) => {
      const kind = String(row && row.role || '') === 'conditional_body' ? 'conditional' : 'prose';
      if (!current || current.kind !== kind) {
        current = {kind, rows: []};
        runs.push(current);
      }
      current.rows.push(row);
    });
    return runs;
  }

  function textBlockFromRows(scene, sectionId, rows, options, runOptions) {
    const run = isObject(runOptions) ? runOptions : {};
    const usable = ensureArray(rows).filter((row) => isBlockTextRole(row.role) && sourceLine(row.source));
    if (!usable.length) {
      return null;
    }
    const first = usable[0];
    const last = usable[usable.length - 1];
    const source = sourceRef(first.source || {});
    const end = sourceRef(last.source || {});
    const anchorText = sourceAnchor(first);
    const endAnchorText = sourceEndAnchor(last);
    if (!source.path || !anchorText || !endAnchorText || isProtectedRouterPath(source.path)) {
      return null;
    }
    const startLine = sourceLine(first.source);
    const endLine = sourceEndLine(last.source);
    const spanLines = endLine && startLine ? endLine - startLine + 1 : 0;
    if (spanLines > 36) {
      return null;
    }
    const original = renderTextBlockContent(usable);
    if (!original.trim()) {
      return null;
    }
    const semantics = textBlockSemantics(scene, sectionId, usable, options);
    const idRoot = 'section_text_' + (sectionId || scene && scene.id || 'opening');
    const id = safeId(run.singleRun ? idRoot : [idRoot, run.runKind || 'text', startLine || '', Number(run.runIndex || 0) + 1].filter(Boolean).join('_'));
    const visualKinds = detectVisualKinds(original);
    const inlineConditions = uniqueStrings(usable.flatMap((row) => ensureArray(row && row.inlineConditions)));
    const conditionalAlternatives = conditionalAlternativesForRows(usable);
    const conditionVariables = uniqueStrings(semantics.conditions.flatMap(variablesFromCondition));
    const inlineConditionVariables = uniqueStrings(inlineConditions.flatMap(variablesFromCondition));
    const textVariables = variablesFromDendryText(original);
    const editability = run.forceManual ? 'advanced_source_patch' : 'guarded_replace_section';
    return {
      id,
      role: 'section_text',
      semanticRole: semantics.semanticRole,
      branchKind: semantics.branchKind,
      label: semantics.label,
      sectionLabel: semantics.sectionLabel,
      sectionId: String(sectionId || ''),
      conditions: semantics.conditions,
      relatedOptionIds: semantics.relatedOptionIds,
      relatedOptionLabels: semantics.relatedOptionLabels,
      ownedOptionIds: semantics.ownedOptionIds,
      ownedOptionLabels: semantics.ownedOptionLabels,
      visualKinds,
      conditionVariables,
      inlineConditions,
      inlineConditionVariables,
      hasInlineConditionals: inlineConditions.length > 0 || usable.some((row) => Boolean(row && row.hasInlineConditionals)),
      textVariables,
      logicContext: {
        conditions: semantics.conditions.map((condition) => ({
          raw: condition,
          variables: variablesFromCondition(condition)
        })),
        inlineConditions: inlineConditions.map((condition) => ({
          raw: condition,
          variables: variablesFromCondition(condition)
        })),
        reads: uniqueStrings(conditionVariables.concat(inlineConditionVariables, textVariables)),
        textVariables,
        conditionVariables,
        inlineConditionVariables,
        conditionalAlternatives
      },
      hasConditionalRows: semantics.hasConditionalRows,
      hasConditionalAlternatives: conditionalAlternatives.length > 1,
      conditionalAlternatives,
      fieldIds: usable.map((row) => safeId(row.id || [row.role || 'text', sectionId, sourceLine(row.source)].filter(Boolean).join('_'))),
      original,
      value: original,
      source: {
        path: source.path,
        line: startLine,
        endLine,
        anchorText,
        endAnchorText
      },
      editability,
      confidence: 'exact',
      reason: run.forceManual
        ? 'This text shares a source line with another parsed block, so Studio uses an advanced source slice edit.'
        : 'Exact source-backed text block can be checked before replacement.'
    };
  }

  function conditionalAlternativesForRows(rows) {
    const seen = new Set();
    const out = [];
    ensureArray(rows).forEach((row) => {
      if (String(row && row.role || '') !== 'conditional_body') {
        return;
      }
      const condition = lastMeaningfulCondition(row && row.conditions);
      const text = String(row && row.text || '').trim();
      if (!condition || !text) {
        return;
      }
      const source = sourceRef(row && row.source || {});
      const key = [condition, text, source.path || '', source.line || ''].join('|');
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      out.push({
        condition,
        text,
        source
      });
    });
    return out;
  }

  function detectVisualKinds(value) {
    const text = String(value || '');
    const kinds = [];
    if (/<\s*(?:table|thead|tbody|tfoot|tr|th|td|caption)\b/i.test(text) ||
        /\b(?:chart|graph|canvas)\b/i.test(text) ||
        /<\s*(?:canvas|svg)\b/i.test(text)) {
      kinds.push('chart');
    }
    if (/<\s*img\b/i.test(text) ||
        /!\[[^\]]*\]\([^)]+\.(?:png|jpe?g|gif|webp|svg)(?:[?#][^)]*)?\)/i.test(text) ||
        /\b(?:img|images|assets|out\/html\/img)\/[^\s'"<>]+\.(?:png|jpe?g|gif|webp|svg)\b/i.test(text)) {
      kinds.push('asset');
    }
    if (/<\s*[a-z][a-z0-9-]*\b/i.test(text)) {
      kinds.push('html');
    }
    return uniqueStrings(kinds);
  }

  function textBlockSemantics(scene, sectionId, rows, options) {
    const sceneId = String(scene && scene.id || '');
    const id = String(sectionId || '');
    const section = findSceneSection(scene, id);
    const incomingOptions = ensureArray(options).filter((option) => sectionTargetedByOption(sceneId, id, option));
    const ownedOptions = ensureArray(options).filter((option) => sectionOwnsOption(sceneId, id, option));
    const hasConditionalRows = ensureArray(rows).some((row) => String(row && row.role || '') === 'conditional_body');
    const inlineConditions = ensureArray(rows)
      .filter((row) => String(row && row.role || '') === 'conditional_body')
      .map((row) => lastMeaningfulCondition(row && row.conditions))
      .filter(Boolean);
    const sectionConditions = [
      section && section.viewIf,
      section && section.chooseIf
    ].map((value) => String(value || '').trim()).filter(Boolean);
    const conditions = uniqueStrings(sectionConditions.concat(inlineConditions));
    const sectionLabel = sectionDisplayLabel(sceneId, section, id);
    const relatedOptionIds = incomingOptions.map((option) => String(option.id || '')).filter(Boolean);
    const relatedOptionLabels = incomingOptions.map((option) => String(option.label || option.id || '')).filter(Boolean);
    const ownedOptionIds = ownedOptions.map((option) => String(option.id || '')).filter(Boolean);
    const ownedOptionLabels = ownedOptions.map((option) => String(option.label || option.id || '')).filter(Boolean);
    if (incomingOptions.length && conditions.length) {
      return {
        semanticRole: 'conditional_option_result_text',
        branchKind: ownedOptions.length ? 'option_result_menu' : 'option_result',
        label: 'Conditional option result: ' + (relatedOptionLabels.join(' / ') || sectionLabel),
        sectionLabel,
        conditions,
        relatedOptionIds,
        relatedOptionLabels,
        ownedOptionIds,
        ownedOptionLabels,
        hasConditionalRows
      };
    }
    if (incomingOptions.length) {
      return {
        semanticRole: 'option_result_text',
        branchKind: ownedOptions.length ? 'option_result_menu' : 'option_result',
        label: 'Option result: ' + (relatedOptionLabels.join(' / ') || sectionLabel),
        sectionLabel,
        conditions,
        relatedOptionIds,
        relatedOptionLabels,
        ownedOptionIds,
        ownedOptionLabels,
        hasConditionalRows
      };
    }
    if (ownedOptions.length) {
      return {
        semanticRole: 'menu_section_text',
        branchKind: conditions.length || hasConditionalRows ? 'conditional_menu' : 'menu',
        label: 'Follow-up menu: ' + sectionLabel,
        sectionLabel,
        conditions,
        relatedOptionIds,
        relatedOptionLabels,
        ownedOptionIds,
        ownedOptionLabels,
        hasConditionalRows
      };
    }
    if (conditions.length || hasConditionalRows) {
      return {
        semanticRole: 'conditional_text',
        branchKind: 'conditional',
        label: 'Conditional text: ' + sectionLabel,
        sectionLabel,
        conditions,
        relatedOptionIds,
        relatedOptionLabels,
        ownedOptionIds,
        ownedOptionLabels,
        hasConditionalRows
      };
    }
    if (isOpeningSectionId(sceneId, id)) {
      return {
        semanticRole: 'opening_text',
        branchKind: 'opening',
        label: 'Opening page text',
        sectionLabel,
        conditions,
        relatedOptionIds,
        relatedOptionLabels,
        ownedOptionIds,
        ownedOptionLabels,
        hasConditionalRows
      };
    }
    return {
      semanticRole: 'section_text',
      branchKind: 'section',
      label: 'Scene step: ' + sectionLabel,
      sectionLabel,
      conditions,
      relatedOptionIds,
      relatedOptionLabels,
      ownedOptionIds,
      ownedOptionLabels,
      hasConditionalRows
    };
  }

  function findSceneSection(scene, sectionId) {
    const id = String(sectionId || '');
    if (!id) {
      return null;
    }
    const sceneId = String(scene && scene.id || '');
    const variants = new Set(sectionIdVariants(sceneId, id));
    return ensureArray(scene && scene.sections).find((section) => {
      return variants.has(String(section && section.id || ''));
    }) || null;
  }

  function sectionTargetedByOption(sceneId, sectionId, option) {
    const sectionVariants = new Set(sectionIdVariants(sceneId, sectionId));
    if (!sectionVariants.size) {
      return false;
    }
    return optionTargetVariants(sceneId, option).some((candidate) => sectionVariants.has(candidate));
  }

  function sectionOwnsOption(sceneId, sectionId, option) {
    const sectionVariants = new Set(sectionIdVariants(sceneId, sectionId));
    if (!sectionVariants.size) {
      return false;
    }
    return optionOwnerVariants(sceneId, option).some((candidate) => sectionVariants.has(candidate));
  }

  function sectionIdVariants(sceneId, sectionId) {
    const raw = String(sectionId || '').trim();
    if (!raw) {
      return [];
    }
    const variants = [raw];
    const local = raw.startsWith(sceneId + '.') ? raw.slice(sceneId.length + 1) : raw;
    if (local && local !== raw) {
      variants.push(local);
    }
    if (sceneId && local && raw.indexOf('.') < 0) {
      variants.push(sceneId + '.' + local);
    }
    return uniqueStrings(variants);
  }

  function optionTargetVariants(sceneId, option) {
    const values = [
      option && option.targetId,
      option && option.rawTargetId,
      option && option.id
    ];
    return endpointVariants(sceneId, values);
  }

  function optionOwnerVariants(sceneId, option) {
    return endpointVariants(sceneId, [option && option.sectionId]);
  }

  function endpointVariants(sceneId, values) {
    const rows = Array.isArray(values) ? values : [values];
    const out = [];
    rows.forEach((value) => {
      const text = String(value || '').trim().replace(/^[@#]/, '');
      if (!text) {
        return;
      }
      out.push.apply(out, sectionIdVariants(sceneId, text));
    });
    return uniqueStrings(out);
  }

  function optionIdVariants(sceneId, option) {
    const values = [
      option && option.targetId,
      option && option.rawTargetId,
      option && option.id,
      option && option.sectionId
    ];
    return endpointVariants(sceneId, values);
  }

  function isOpeningSectionId(sceneId, sectionId) {
    const text = String(sectionId || '').trim();
    if (!text) {
      return true;
    }
    const local = text.startsWith(sceneId + '.') ? text.slice(sceneId.length + 1) : text;
    return /^(?:start|opening|intro|main)$/i.test(local);
  }

  function sectionDisplayLabel(sceneId, section, sectionId) {
    const raw = String(sectionId || '');
    const local = raw.startsWith(sceneId + '.') ? raw.slice(sceneId.length + 1) : raw;
    return String(section && (section.title || section.subtitle) || humanSectionId(local || raw || 'opening'));
  }

  function lastMeaningfulCondition(values) {
    const rows = ensureArray(values).map((value) => String(value || '').trim()).filter(Boolean);
    return rows.length ? rows[rows.length - 1] : '';
  }

  function uniqueStrings(values) {
    const seen = new Set();
    const out = [];
    ensureArray(values).forEach((value) => {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      out.push(text);
    });
    return out;
  }

  function variablesFromCondition(value) {
    const text = String(value || '')
      .replace(/'[^']*'|"[^"]*"/g, ' ')
      .replace(/<[^>]+>/g, ' ');
    const names = [];
    let match;
    const dotted = /\bQ\.([A-Za-z_][A-Za-z0-9_]*)\b/g;
    while ((match = dotted.exec(text)) !== null) {
      names.push(match[1]);
    }
    const bare = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
    while ((match = bare.exec(text)) !== null) {
      const name = match[1];
      if (!RESERVED_CONDITION_WORDS.has(name) && !/^\d/.test(name)) {
        names.push(name);
      }
    }
    return uniqueStrings(names);
  }

  function variablesFromDendryText(value) {
    const names = [];
    const re = /\[\+\s*([A-Za-z_][A-Za-z0-9_]*)\b/g;
    let match;
    while ((match = re.exec(String(value || ''))) !== null) {
      names.push(match[1]);
    }
    return uniqueStrings(names);
  }

  function isBlockTextRole(role) {
    const text = String(role || '');
    return text === 'heading' || text === 'body' || text === 'conditional_body';
  }

  function renderTextBlockContent(rows) {
    const lines = [];
    const seenConditionalSourceLines = new Set();
    ensureArray(rows).forEach((row) => {
      const role = String(row.role || '');
      const text = String(row.text || '').trim();
      if (!text) {
        return;
      }
      if (lines.length && lines[lines.length - 1] !== '') {
        lines.push('');
      }
      if (role === 'heading') {
        lines.push(text.startsWith('=') ? text : '= ' + text);
      } else if (row.hasInlineConditionals && isMixedInlineConditionalSource(sourceAnchor(row))) {
        lines.push(sourceAnchor(row));
      } else if (role === 'conditional_body') {
        const source = row.source || {};
        const sourceKey = [source.path || '', sourceLine(source) || '', String(source.anchorText || '').trim()].join(':');
        if (seenConditionalSourceLines.has(sourceKey)) {
          return;
        }
        seenConditionalSourceLines.add(sourceKey);
        lines.push(String(source.anchorText || text).trim());
      } else {
        lines.push(text);
      }
    });
    return lines.join('\n').replace(/\n+$/, '') + '\n';
  }

  function metadataRows(scene, source, fieldById) {
    const rows = [
      metadataRow('title', 'Title', scene.title, 'title'),
      metadataRow('viewIf', 'View-if', scene.viewIf, 'condition'),
      metadataRow('priority', 'Priority', scene.priority, 'metadata'),
      metadataRow('frequency', 'Frequency', scene.frequency, 'metadata'),
      metadataRow('maxVisits', 'Max visits', scene.maxVisits, 'metadata')
    ].filter((row) => row.original !== '');
    rows.forEach((row) => {
      const matching = Array.from(fieldById.values()).find((field) => field.role === row.role && field.original === row.original);
      if (matching) {
        row.fieldId = matching.id;
        row.editability = matching.editability;
        row.source = matching.source;
      } else {
        row.editability = 'manual_review';
        row.source = source;
      }
    });
    return rows;
  }

  function metadataRow(id, label, value, role) {
    return {id, label, role, original: String(value === undefined || value === null ? '' : value), value: String(value === undefined || value === null ? '' : value)};
  }

  function metadataEditableFields(scene, sceneSourcePath, existingFields) {
    const fields = [];
    const definitions = [
      {
        key: 'title',
        role: 'title',
        label: 'Title',
        reason: 'Exact source line for the scene title can be checked before replacement.'
      },
      {
        key: 'subtitle',
        role: 'subtitle',
        label: 'Subtitle',
        reason: 'Exact source line for the scene subtitle can be checked before replacement.'
      },
      {
        key: 'viewIf',
        role: 'condition',
        label: 'Appearance condition',
        reason: 'Exact source line for the scene view-if can be checked before replacement.'
      },
      {
        key: 'chooseIf',
        role: 'condition',
        label: 'Choice condition',
        reason: 'Exact source line for the scene choose-if can be checked before replacement.'
      },
      {
        key: 'tags',
        role: 'metadata',
        label: 'Tags',
        reason: 'Exact source line for the scene tags can be checked before replacement.'
      },
      {
        key: 'priority',
        role: 'metadata',
        label: 'Priority',
        reason: 'Exact source line for the scene priority can be checked before replacement.'
      },
      {
        key: 'frequency',
        role: 'metadata',
        label: 'Frequency',
        reason: 'Exact source line for the scene frequency can be checked before replacement.'
      },
      {
        key: 'frequencyVar',
        role: 'metadata',
        label: 'Frequency variable',
        reason: 'Exact source line for the scene frequency variable can be checked before replacement.'
      },
      {
        key: 'maxVisits',
        role: 'metadata',
        label: 'Max visits',
        reason: 'Exact source line for the scene max visits can be checked before replacement.'
      },
      {
        key: 'maxVisitsVar',
        role: 'metadata',
        label: 'Max visits variable',
        reason: 'Exact source line for the scene max visits variable can be checked before replacement.'
      },
      {
        key: 'newPage',
        role: 'metadata',
        label: 'New page',
        reason: 'Exact source line for the scene new-page flag can be checked before replacement.'
      },
      {
        key: 'setRoot',
        role: 'metadata',
        label: 'Set root',
        reason: 'Exact source line for the scene set-root value can be checked before replacement.'
      },
      {
        key: 'gameOver',
        role: 'metadata',
        label: 'Game over',
        reason: 'Exact source line for the scene game-over flag can be checked before replacement.'
      }
    ];
    definitions.forEach((definition) => {
      if (!scene || scene[definition.key] === undefined || scene[definition.key] === null || scene[definition.key] === '') {
        return;
      }
      const original = metadataValue(scene[definition.key]);
      if (metadataAlreadyCaptured(existingFields, definition.role, original, metadataSource(scene, definition.key, sceneSourcePath))) {
        return;
      }
      fields.push(metadataEditableField({
        id: 'metadata_' + definition.key,
        role: definition.role,
        label: definition.label,
        original,
        sceneId: scene.id,
        sectionId: '',
        source: metadataSource(scene, definition.key, sceneSourcePath),
        reason: definition.reason
      }));
    });
    const sectionDefinitions = definitions.filter((definition) => {
      return ['viewIf', 'chooseIf', 'priority', 'frequency', 'frequencyVar', 'maxVisits', 'maxVisitsVar', 'newPage', 'setRoot', 'gameOver'].includes(definition.key);
    });
    ensureArray(scene && scene.sections).forEach((section) => {
      const sectionId = String(section && section.id || '');
      sectionDefinitions.forEach((definition) => {
        if (!section || section[definition.key] === undefined || section[definition.key] === null || section[definition.key] === '') {
          return;
        }
        const original = metadataValue(section[definition.key]);
        const source = metadataSource(section, definition.key, sceneSourcePath);
        if (metadataAlreadyCaptured(existingFields.concat(fields), definition.role, original, source)) {
          return;
        }
        fields.push(metadataEditableField({
          id: 'metadata_' + safeId(sectionId || 'section') + '_' + definition.key,
          role: definition.role,
          label: sectionMetadataLabel(definition.label, scene, section),
          original,
          sceneId: scene.id,
          sectionId,
          source,
          reason: definition.reason
        }));
      });
    });
    return fields.filter(Boolean);
  }

  function sectionMetadataLabel(label, scene, section) {
    const sceneId = String(scene && scene.id || '');
    const sectionId = String(section && section.id || '');
    const local = sectionId.startsWith(sceneId + '.') ? sectionId.slice(sceneId.length + 1) : sectionId;
    return String(label || 'Metadata') + ': ' + String(section && (section.title || section.subtitle) || local || 'Section');
  }

  function metadataEditableField(input) {
    const source = sourceRef(input.source || {});
    const original = String(input.original || '');
    const guarded = canGuardField(source, original);
    return {
      id: safeId(input.id || input.role || 'metadata_field'),
      role: String(input.role || 'metadata'),
      label: String(input.label || roleLabel(input.role)),
      original,
      value: original,
      source,
      sourcePath: source.path || '',
      editability: guarded ? 'guarded_replace_text' : 'advanced_source_patch',
      owner: {sceneId: String(input.sceneId || ''), sectionId: String(input.sectionId || ''), itemId: '', kind: 'metadata'},
      sectionId: String(input.sectionId || ''),
      optionId: '',
      confidence: guarded ? 'exact' : 'approximate',
      reason: guarded
        ? String(input.reason || 'Exact source line can be checked before replacement.')
        : 'Needs source slice editing and advanced apply because Studio lacks safe single-line source evidence.'
    };
  }

  function metadataSource(scene, key, fallbackPath) {
    const metadata = isObject(scene && scene.metadata) ? scene.metadata : {};
    const item = isObject(metadata[key]) ? metadata[key] : {};
    return sourceRef({
      path: item.path || fallbackPath || (scene && scene.path) || '',
      line: item.line || item.startLine,
      endLine: item.endLine || item.line || item.startLine
    });
  }

  function metadataValue(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean).join(' ');
    }
    return String(value === undefined || value === null ? '' : value);
  }

  function metadataAlreadyCaptured(fields, role, original, source) {
    const ref = sourceRef(source || {});
    return ensureArray(fields).some((field) => {
      const fieldSource = sourceRef(field.source || {});
      return String(field.role || '') === String(role || '') &&
        String(field.original || '') === String(original || '') &&
        fieldSource.path === ref.path &&
        (!ref.line || !fieldSource.line || fieldSource.line === ref.line);
    });
  }

  function effectRows(projectIndex, scene, scriptRows) {
    const api = eventWorkbenchApi();
    if (api && typeof api.buildEventWorkbench === 'function') {
      try {
        const workbench = api.buildEventWorkbench(projectIndex, scene, {});
        const rows = ensureArray(workbench.effects).map((effect) => ({
          variable: String(effect.variable || ''),
          op: String(effect.op || effect.operator || ''),
          value: String(effect.value === undefined || effect.value === null ? '' : effect.value),
          condition: String(effect.condition || ''),
          hook: String(effect.hook || ''),
          syntax: String(effect.syntax || ''),
          expression: String(effect.expression || effect.displayExpression || ''),
          displayExpression: String(effect.displayExpression || effect.expression || ''),
          sourceExpression: String(effect.sourceExpression || ''),
          sourceOrder: Number(effect.sourceOrder || 0) || 0,
          sectionId: String(effect.sectionId || ''),
          source: sourceRef(effect.source || {}),
          evidence: effect.evidence || 'workbench'
        })).filter((effect) => effect.variable);
        if (rows.length) {
          return rows;
        }
      } catch (_err) {
        // Fall through to lightweight script parsing.
      }
    }
    const rows = [];
    scriptRows.forEach((row) => {
      parseEffectText(row.text).forEach((effect) => {
        rows.push(Object.assign(effect, {
          sectionId: row.owner && row.owner.sectionId || '',
          source: sourceRef(row.source || {}),
          evidence: 'script_text'
        }));
      });
    });
    return rows;
  }

  function effectEditableFields(scene, effects, options) {
    const api = logicFieldsApi();
    return api && typeof api.buildEffectFields === 'function' ? api.buildEffectFields(scene, effects, options) : [];
  }

  function structuralActionFields(scene, options, effects, textBlocks, source) {
    const api = eventStructureApi();
    if (!api || typeof api.structureActionsForSource !== 'function') {
      return [];
    }
    return api.structureActionsForSource({
      sceneId: String(scene && scene.id || ''),
      source: source || scene && scene.sourceSpan || {path: scene && scene.path},
      options,
      effects,
      textBlocks
    });
  }

  function parseEffectText(text) {
    const rows = [];
    const raw = String(text || '').trim();
    const hookMatch = raw.match(/^(on-arrival|on-display)\s*:\s*(.+)$/i);
    const hook = hookMatch ? hookMatch[1].toLowerCase() : '';
    const body = hookMatch ? hookMatch[2] : raw;
    splitEffectClauses(body).forEach((clause) => {
      const parsed = parseEffectClause(clause, hook);
      if (parsed) {
        rows.push(parsed);
      }
    });
    return rows;
  }

  function isEffectScriptRow(row) {
    const text = String(row && row.text || '').trim();
    return /^(?:on-arrival|on-display)\s*:/i.test(text) ||
      /^(?:Q\.)?[A-Za-z_][A-Za-z0-9_]*\s*(?:[+\-*/]?=)/.test(text) ||
      (/(?:^|[;\s])Q\.[A-Za-z_][A-Za-z0-9_]*\s*(?:[+\-*/]?=)/.test(text) && text.includes(';'));
  }

  function splitEffectClauses(text) {
    const clauses = [];
    let current = '';
    let quote = '';
    let escaped = false;
    String(text || '').split('').forEach((char) => {
      if (escaped) {
        current += char;
        escaped = false;
        return;
      }
      if (char === '\\' && quote) {
        current += char;
        escaped = true;
        return;
      }
      if (quote) {
        current += char;
        if (char === quote) {
          quote = '';
        }
        return;
      }
      if (char === '"' || char === "'") {
        quote = char;
        current += char;
        return;
      }
      if (char === ';') {
        if (current.trim()) {
          clauses.push(current.trim());
        }
        current = '';
        return;
      }
      current += char;
    });
    if (current.trim()) {
      clauses.push(current.trim());
    }
    return clauses;
  }

  function parseEffectClause(clause, hook) {
    const parts = splitTrailingIf(clause);
    const match = parts.expression.match(/^(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|\/=|=)\s*(.+)$/);
    if (!match) {
      return null;
    }
    const syntax = hook && !/^Q\./.test(parts.expression) ? 'dendry_shorthand' : '';
    const variable = match[1];
    const op = match[2];
    const value = String(match[3] || '').trim();
    const displayExpression = effectExpressionText(variable, op, value, parts.condition, true);
    return {
      variable,
      op,
      value,
      condition: parts.condition,
      hook,
      syntax,
      expression: displayExpression,
      displayExpression,
      sourceExpression: effectExpressionText(variable, op, value, parts.condition, syntax !== 'dendry_shorthand')
    };
  }

  function splitTrailingIf(value) {
    const text = String(value || '').trim();
    let quote = '';
    let escaped = false;
    let splitAt = -1;
    for (let index = 0; index < text.length; index += 1) {
      const char = text.charAt(index);
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\' && quote) {
        escaped = true;
        continue;
      }
      if (quote) {
        if (char === quote) {
          quote = '';
        }
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (text.slice(index, index + 4).toLowerCase() === ' if ') {
        splitAt = index;
      }
    }
    if (splitAt < 0) {
      return {expression: text, condition: ''};
    }
    return {expression: text.slice(0, splitAt).trim(), condition: text.slice(splitAt + 4).trim()};
  }

  function effectExpressionText(variable, op, value, condition, qPrefix) {
    if (!variable || !op || !value) {
      return '';
    }
    return (qPrefix ? 'Q.' : '') + variable + ' ' + op + ' ' + value + (condition ? ' if ' + condition : '');
  }

  function buildProposal(modelInput, editedValues, options) {
    const model = isObject(modelInput) ? modelInput : {};
    const values = isObject(editedValues) ? editedValues : {};
    const opts = isObject(options) ? options : {};
    const blockChanges = ensureArray(model.textBlocks).map((block) => {
      const key = 'block:' + block.id;
      const hasEditedValue = Object.prototype.hasOwnProperty.call(values, key);
      const after = hasEditedValue ? values[key] : block.value;
      if (String(after === undefined || after === null ? '' : after) === String(block.original || '')) {
        return null;
      }
      return {
        fieldId: block.id,
        role: block.role || 'section_text',
        label: block.label || roleLabel(block.role),
        sectionId: block.sectionId || '',
        optionId: '',
        source: sourceRef(block.source || {}),
        editability: block.editability || 'guarded_replace_section',
        operationType: 'replace_section',
        anchorText: block.source && block.source.anchorText || '',
        endAnchorText: block.source && block.source.endAnchorText || '',
        startLine: block.source && block.source.line || null,
        endLine: block.source && block.source.endLine || null,
        dedupeSearch: String(after || '').trim().slice(0, 200),
        before: String(block.original || ''),
        after: String(after === undefined || after === null ? '' : after)
      };
    }).filter(Boolean);
    const coveredFieldIds = new Set();
    blockChanges.forEach((change) => {
      const block = ensureArray(model.textBlocks).find((item) => item.id === change.fieldId);
      ensureArray(block && block.fieldIds).forEach((fieldId) => coveredFieldIds.add(fieldId));
    });
    const fieldChanges = ensureArray(model.fields).map((field) => {
      if (coveredFieldIds.has(field.id)) {
        return null;
      }
      const hasEditedValue = Object.prototype.hasOwnProperty.call(values, field.id);
      const after = hasEditedValue ? values[field.id] : field.value;
      if (String(after === undefined || after === null ? '' : after) === String(field.original || '')) {
        return null;
      }
      return changeFromField(field, after);
    }).filter(Boolean);
    const structureCommandChanges = structuralCommandChangesFromValues(model, values);
    const changes = blockChanges.concat(fieldChanges, structureCommandChanges);
    const diagnostics = [];
    if (!changes.length) {
      diagnostics.push(diagnostic('warning', 'existing_scene_edit.no_changes', 'No changed fields were found yet.'));
    }
    return normalizeProposal({
      schemaVersion: EXISTING_SCENE_EDIT_VERSION,
      kind: PROPOSAL_KIND,
      id: opts.id || safeId('edit_existing_' + (model.sceneId || 'scene')),
      title: model.title || model.sceneId || 'Existing scene edit',
      sceneId: model.sceneId || '',
      sceneKind: model.sceneKind || 'event',
      sourcePath: model.source && model.source.path || '',
      source: model.source || null,
      changes,
      assetInstallRequests: ensureArray(opts.assetInstallRequests),
      changeSummary: summarizeChanges(changes),
      warnings: ensureArray(model.warnings),
      diagnostics
    });
  }

  function changeFromField(field, afterValue) {
    if (String(field && field.transform || '') === 'structure_action') {
      return structuralChangeFromField(field, afterValue);
    }
    const api = logicFieldsApi();
    if (api && typeof api.changeForLogicField === 'function') {
      const logicChange = api.changeForLogicField(field, afterValue, baseFieldChange);
      if (logicChange) {
        return logicChange;
      }
    }
    const afterText = String(afterValue === undefined || afterValue === null ? '' : afterValue);
    return baseFieldChange(field, String(field.original || ''), afterText);
  }

  function structuralChangeFromField(field, afterValue) {
    const afterText = String(afterValue === undefined || afterValue === null ? '' : afterValue).trim();
    if (!afterText || (field.inputType === 'checkbox' && !/^(1|true|yes|on)$/i.test(afterText))) {
      return null;
    }
    if (String(field && field.structureAction || '') === 'add_option_effect') {
      const guarded = guardedOptionEffectChange(field, afterText);
      if (guarded) {
        return guarded;
      }
    }
    const change = baseFieldChange(field, structuralBeforeText(field), structuralAfterText(field, afterText));
    change.editability = 'manual_review';
    change.operationType = 'manual_snippet';
    return change;
  }

  function structuralCommandChangesFromValues(model, values) {
    const commands = queuedStructureCommands(values);
    if (!commands.length) {
      return [];
    }
    return commands.map((command) => {
      const field = fieldForStructureCommand(model, command);
      if (!field) {
        return null;
      }
      const next = Object.assign({}, field, {
        id: command.id || command.fieldId || field.id,
        optionId: command.optionId || field.optionId || '',
        sectionId: command.sectionId || field.sectionId || '',
        structureTargetLabel: command.targetLabel || field.structureTargetLabel || ''
      });
      return structuralChangeFromField(next, command.value || 'true');
    }).filter(Boolean);
  }

  function queuedStructureCommands(values) {
    const raw = values && (values.__structureCommands || values.structure_commands || values.structureCommands);
    const rows = Array.isArray(raw) ? raw : parseJsonArray(raw);
    return rows.map((row) => isObject(row) ? row : null).filter(Boolean);
  }

  function parseJsonArray(value) {
    if (typeof value !== 'string' || !value.trim()) {
      return [];
    }
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function fieldForStructureCommand(model, command) {
    const fields = ensureArray(model && model.fields).filter((field) => String(field && field.transform || '') === 'structure_action');
    const fieldId = String(command && command.fieldId || '').trim();
    if (fieldId) {
      const direct = fields.find((field) => field.id === fieldId);
      if (direct) {
        return direct;
      }
    }
    const action = normalizeStructureAction(command && (command.action || command.type));
    const rawOptionId = String(command && command.optionId || '').trim();
    const rawSectionId = String(command && command.sectionId || '').trim();
    const optionId = rawOptionId ? safeId(rawOptionId) : '';
    const sectionId = rawSectionId ? safeId(rawSectionId) : '';
    return fields.find((field) => {
      if (normalizeStructureAction(field && field.structureAction) !== action) {
        return false;
      }
      if (optionId && safeId(field.optionId || '') !== optionId) {
        return false;
      }
      if (sectionId && safeId(field.sectionId || '') !== sectionId) {
        return false;
      }
      return true;
    }) || null;
  }

  function normalizeStructureAction(value) {
    const text = String(value || '').trim();
    return text === 'add_section' ? 'add_branch' : text === 'remove_section' ? 'remove_layer' : text;
  }

  function structuralBeforeText(field) {
    const action = String(field && field.structureAction || '');
    const explicit = String(field && field.structureBefore || '').trim();
    if (explicit) {
      return explicit;
    }
    if (action === 'add_option' || action === 'add_branch' || action === 'add_trigger_effect' || action === 'add_option_effect') {
      return '(not present yet)';
    }
    return String(field && field.original || '');
  }

  function structuralAfterText(field, afterText) {
    const action = String(field && field.structureAction || '');
    const target = String(field && field.structureTargetLabel || field && field.optionId || field && field.sectionId || '').trim();
    if (action === 'add_trigger_effect') {
      return ['Add trigger effect to this object:', normalizeStructuralEffect(afterText)].join('\n');
    }
    if (action === 'add_option_effect') {
      return ['Add option effect' + (target ? ' for ' + target : '') + ':', normalizeStructuralEffect(afterText)].join('\n');
    }
    if (action === 'add_option') {
      return [
        'Add option and result layer proposal:',
        afterText,
        '',
        'Review the option line, target section id, result text, route target, prerequisite, unavailable text, and any effects together.'
      ].join('\n');
    }
    if (action === 'add_branch') {
      return [
        'Add conditional or follow-up layer proposal:',
        afterText,
        '',
        'Review section id, condition, ordering, nested routes, and consumed/written variables together.'
      ].join('\n');
    }
    if (action === 'remove_option_condition') {
      return 'Remove prerequisite' + (target ? ' from ' + target : '') + ' after checking unavailable text and route fallout.';
    }
    if (action === 'remove_option') {
      return 'Remove option' + (target ? ': ' + target : '') + ' after checking its result section, effects, incoming references, and unavailable text.';
    }
    if (action === 'remove_effect') {
      return 'Remove effect' + (target ? ' for ' + target : '') + ' after checking variable consumers and adjacent route logic.';
    }
    if (action === 'remove_layer') {
      return 'Remove this composite layer after checking nested options, routes, effects, variables, and incoming references.';
    }
    return afterText;
  }

  function normalizeStructuralEffect(value) {
    const text = String(value || '').trim().replace(/;+$/, '');
    const api = logicFieldsApi();
    if (api && typeof api.isSimpleEffectExpression === 'function' && api.isSimpleEffectExpression(text)) {
      return text;
    }
    return text + '\nManual review: effect expression was not recognized as a simple Q assignment.';
  }

  function guardedOptionEffectChange(field, afterText) {
    const parsed = parseSimpleStructuralEffect(afterText);
    if (!parsed) {
      return null;
    }
    const source = sourceRef(field && field.source || {});
    const path = String(source.path || '');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    const anchor = String(source.anchorText || '').trim();
    if (!path.startsWith('source/scenes/') || !path.endsWith('.scene.dry') || isProtectedRouterPath(path) ||
      !Number.isInteger(line) || line <= 0 || (Number.isInteger(endLine) && endLine > 0 && endLine !== line) || !anchor) {
      return null;
    }
    if (/^on-arrival\s*:/i.test(anchor) && anchor.indexOf('{!') < 0) {
      const expression = structuralEffectSourceExpression(parsed, {qPrefix: /\bQ\.[A-Za-z_]/.test(anchor)});
      const nextLine = appendOnArrivalEffect(anchor, expression);
      if (!nextLine || nextLine === anchor) {
        return null;
      }
      const change = baseFieldChange(field, anchor, nextLine);
      change.editability = 'guarded_apply';
      change.operationType = 'replace_text';
      return change;
    }
    if (looksLikeStandaloneEffectAnchor(anchor)) {
      if (parsed.condition) {
        return null;
      }
      const expression = structuralEffectSourceExpression(parsed, {qPrefix: true}) + ';';
      const change = baseFieldChange(field, '(not present yet)', expression);
      change.editability = 'guarded_apply';
      change.operationType = 'insert_text';
      change.anchorText = anchor;
      change.position = 'after';
      change.dedupeSearch = expression;
      return change;
    }
    return null;
  }

  function parseSimpleStructuralEffect(value) {
    const text = String(value || '').trim().replace(/;+$/, '');
    const api = logicFieldsApi();
    if (api && typeof api.isSimpleEffectExpression === 'function' && !api.isSimpleEffectExpression(text)) {
      return null;
    }
    const parts = splitTrailingIf(text);
    const match = parts.expression.match(/^(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*(=|\+=|-=|\*=|\/=)\s*([^;\n]+)$/);
    if (!match) {
      return null;
    }
    return {
      variable: match[1],
      op: match[2],
      value: String(match[3] || '').trim(),
      condition: parts.condition
    };
  }

  function structuralEffectSourceExpression(effect, options) {
    const qPrefix = Boolean(options && options.qPrefix);
    const expression = (qPrefix ? 'Q.' : '') + effect.variable + ' ' + effect.op + ' ' + effect.value;
    const condition = qPrefix ? effect.condition : String(effect.condition || '').replace(/\bQ\./g, '');
    return expression + (condition ? ' if ' + condition : '');
  }

  function appendOnArrivalEffect(anchor, expression) {
    const line = String(anchor || '').trim();
    const effect = String(expression || '').trim().replace(/;+$/, '');
    if (!line || !effect) {
      return '';
    }
    const withoutTrailingSemicolon = line.replace(/\s*;+\s*$/, '');
    return withoutTrailingSemicolon + '; ' + effect;
  }

  function looksLikeStandaloneEffectAnchor(anchor) {
    const text = String(anchor || '').trim();
    if (!text || /^on-arrival\s*:/i.test(text) || /^on-display\s*:/i.test(text)) {
      return false;
    }
    return /^(?:Q\.)?[A-Za-z_][A-Za-z0-9_]*\s*(?:=|\+=|-=|\*=|\/=)/.test(text);
  }

  function baseFieldChange(field, before, after) {
    return {
      fieldId: field.id,
      role: field.role || 'text',
      label: field.label || roleLabel(field.role),
      sectionId: field.sectionId || '',
      optionId: field.optionId || '',
      source: sourceRef(field.source || {}),
      editability: field.editability || 'manual_review',
      before: String(before === undefined || before === null ? '' : before),
      after: String(after === undefined || after === null ? '' : after)
    };
  }

  function normalizeProposal(input) {
    const value = isObject(input) ? input : {};
    const changes = ensureArray(value.changes).map(normalizeChange).filter((change) => change.before !== change.after);
    return {
      schemaVersion: String(value.schemaVersion || EXISTING_SCENE_EDIT_VERSION),
      kind: PROPOSAL_KIND,
      id: safeId(value.id || 'edit_existing_scene'),
      title: String(value.title || value.sceneId || 'Existing scene edit'),
      sceneId: String(value.sceneId || ''),
      sceneKind: String(value.sceneKind || 'event') === 'card' ? 'card' : 'event',
      sourcePath: String(value.sourcePath || (value.source && value.source.path) || '').trim(),
      source: sourceRef(value.source || {path: value.sourcePath}),
      changes,
      assetInstallRequests: ensureArray(value.assetInstallRequests).map(normalizeAssetInstallRequest).filter((request) => request.targetPath),
      changeSummary: summarizeChanges(changes),
      warnings: ensureArray(value.warnings).map(String).filter(Boolean),
      diagnostics: ensureArray(value.diagnostics)
    };
  }

  function normalizeChange(change, index) {
    const value = isObject(change) ? change : {};
    return {
      fieldId: safeId(value.fieldId || 'field_' + (index + 1)),
      role: String(value.role || 'text'),
      label: String(value.label || roleLabel(value.role)),
      sectionId: String(value.sectionId || ''),
      optionId: String(value.optionId || ''),
      source: sourceRef(value.source || {}),
      editability: String(value.editability || 'manual_review'),
      operationType: String(value.operationType || ''),
      anchorText: String(value.anchorText || ''),
      endAnchorText: String(value.endAnchorText || ''),
      position: String(value.position || 'after') === 'before' ? 'before' : 'after',
      startLine: numberOrNull(value.startLine),
      endLine: numberOrNull(value.endLine),
      dedupeSearch: String(value.dedupeSearch || ''),
      before: String(value.before === undefined || value.before === null ? '' : value.before),
      after: String(value.after === undefined || value.after === null ? '' : value.after)
    };
  }

  function summarizeChanges(changes) {
    const list = ensureArray(changes);
    return list.reduce((summary, change) => {
      summary.total += 1;
      const role = String(change.role || '');
      if (role.includes('metadata') || ['condition', 'route', 'effect'].includes(role)) {
        summary.metadataFields += 1;
      } else {
        summary.textFields += 1;
      }
      if (change.editability === 'manual_review' || !(canGuardField(change.source, change.before) || canGuardSectionChange(change) || canAdvancedSourceChange(change))) {
        summary.manualFields += 1;
      }
      if (change.operationType === 'replace_section') {
        summary.sectionFields = (summary.sectionFields || 0) + 1;
      }
      return summary;
    }, {total: 0, textFields: 0, metadataFields: 0, manualFields: 0, sectionFields: 0});
  }

  function canAdvancedSourceChange(change) {
    const value = isObject(change) ? change : {};
    const source = sourceRef(value.source || {});
    return Boolean(
      source.path &&
      source.path.startsWith('source/scenes/') &&
      source.path.endsWith('.scene.dry') &&
      Number(source.line || source.startLine || 0) > 0 &&
      String(value.after || '').trim()
    );
  }

  function buildExportBundle(input, projectIndex) {
    const proposal = normalizeProposal(input);
    const installApi = installPlanApi();
    const plan = installApi && typeof installApi.existingSceneEditInstallPlan === 'function'
      ? installApi.existingSceneEditInstallPlan(proposal, {project: installApi.projectProvenanceFromIndex(projectIndex)})
      : null;
    const installPlanJson = installApi && plan && typeof installApi.renderInstallPlanJson === 'function'
      ? installApi.renderInstallPlanJson(plan)
      : JSON.stringify(plan || {}, null, 2) + '\n';
    const patchPreview = installApi && plan && typeof installApi.renderPatchPreview === 'function'
      ? installApi.renderPatchPreview(plan)
      : '';
    const proposalJson = JSON.stringify(proposal, null, 2) + '\n';
    const proposalText = renderProposalText(proposal);
    const fileBase = proposal.id || 'existing_scene_edit';
    return {
      ok: true,
      draft: proposal,
      proposal,
      fileName: fileBase + '.existing-scene-edit.json',
      playerPreview: proposalText,
      previewText: previewText(proposal),
      proposalText,
      proposalJson,
      installPlan: plan,
      installPlanJson,
      patchPreview,
      files: [
        {path: fileBase + '.existing-scene-edit.json', content: proposalJson, kind: 'draft'},
        {path: fileBase + '.proposal.txt', content: proposalText, kind: 'proposal'},
        {path: fileBase + '.install-plan.json', content: installPlanJson, kind: 'install_plan'},
        {path: fileBase + '.patch-preview.diff', content: patchPreview, kind: 'patch'}
      ]
    };
  }

  function renderProposalText(input) {
    const proposal = normalizeProposal(input);
    const lines = [
      previewText(proposal),
      'Source: ' + (proposal.sourcePath || '(unknown source)'),
      'Changed fields: ' + proposal.changes.length,
      ''
    ];
    proposal.changes.forEach((change, index) => {
      lines.push(String(index + 1) + '. ' + (change.label || roleLabel(change.role)) + sourceSuffix(change.source));
      lines.push('Before: ' + change.before);
      lines.push('After: ' + change.after);
      lines.push('');
    });
    if (proposal.warnings.length) {
      lines.push('Warnings:');
      proposal.warnings.forEach((warning) => lines.push('- ' + warning));
      lines.push('');
    }
    return lines.join('\n').replace(/\n+$/, '\n');
  }

  function previewText(proposal) {
    const kind = proposal.sceneKind === 'card' ? 'Card' : 'Event';
    return 'Modify existing ' + kind + ': ' + (proposal.title || proposal.sceneId || '(untitled)') +
      ' (' + proposal.changes.length + ' changed field' + (proposal.changes.length === 1 ? '' : 's') + ')';
  }

  function sourceSuffix(source) {
    const ref = sourceRef(source);
    if (!ref.path) {
      return ' (manual source review)';
    }
    return ' (' + ref.path + (ref.line ? ':' + ref.line : '') + ')';
  }

  function sourceAnchor(row) {
    const source = row && row.source || {};
    const exact = String(source.anchorText || '').trim();
    if (exact) {
      return exact;
    }
    const original = String(row && (row.originalText || row.text) || '').trim();
    if (String(row && row.role || '') === 'heading' && !original.startsWith('=')) {
      return '= ' + original;
    }
    if (sourceLine(source) && sourceEndLine(source) && sourceLine(source) !== sourceEndLine(source)) {
      return '';
    }
    return original;
  }

  function sourceEndAnchor(row) {
    const source = row && row.source || {};
    const exact = String(source.endAnchorText || '').trim();
    if (exact) {
      return exact;
    }
    return sourceAnchor(row);
  }

  function sourceEndLine(source) {
    const ref = sourceRef(source);
    return ref.endLine || ref.line || 0;
  }

  function splitOptionTitle(title) {
    const text = String(title || '').trim();
    const parts = text.split('——');
    if (parts.length > 1) {
      return {label: parts[0].trim(), subtitle: parts.slice(1).join('——').trim()};
    }
    return {label: text, subtitle: ''};
  }

  function normalizeAssetRef(item) {
    if (typeof item === 'string') {
      return {path: item, type: assetType(item), label: fileName(item)};
    }
    if (!isObject(item)) {
      return null;
    }
    const path = String(item.path || item.src || item.url || '').trim();
    if (!path) {
      return null;
    }
    return {
      id: item.id ? String(item.id) : '',
      path,
      type: String(item.type || assetType(path)),
      label: String(item.label || item.name || fileName(path) || path),
      role: String(item.role || item.directive || '').trim(),
      source: sourceRef(item.source || {}),
      sourceKind: String(item.sourceKind || ''),
      editability: String(item.editability || ''),
      confidence: String(item.confidence || ''),
      fileExists: item.fileExists,
      previewUrl: String(item.previewUrl || '')
    };
  }

  function assetType(path) {
    const ext = String(path || '').toLowerCase().split('.').pop();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      return 'image';
    }
    if (['mp3', 'ogg', 'wav', 'flac', 'm4a'].includes(ext)) {
      return 'audio';
    }
    return 'asset';
  }

  function fileName(path) {
    const text = String(path || '');
    const parts = text.split(/[\\/]/);
    return parts[parts.length - 1] || text;
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    const line = numberOrNull(value.line || value.startLine);
    const endLine = numberOrNull(value.endLine || value.line || value.startLine);
    return {
      path: String(value.path || '').trim(),
      line,
      startLine: line,
      endLine,
      anchorText: String(value.anchorText || '').trim(),
      endAnchorText: String(value.endAnchorText || '').trim()
    };
  }

  function sourceLine(source) {
    const ref = sourceRef(source);
    return ref.line || 0;
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? Math.floor(num) : null;
  }

  function roleLabel(role) {
    const labels = {
      title: 'Title',
      heading: 'Heading',
      subtitle: 'Subtitle',
      body: 'Body',
      conditional_body: 'Conditional text',
      option_label: 'Player option',
      option_subtitle: 'Option subtitle',
      unavailable_text: 'Unavailable text',
      section_text: 'Section text',
      structure: 'Structure action',
      metadata: 'Metadata',
      condition: 'Condition',
      route: 'Route target',
      effect: 'Effect'
    };
    return labels[String(role || '')] || String(role || 'Text');
  }

  function assetEditableFields(scene, sceneSourcePath) {
    const sceneId = String(scene && scene.id || '');
    return ensureArray(scene && scene.assetRefs).map((asset, index) => {
      const directive = normalizeAssetDirective(asset && (asset.directive || asset.role));
      const path = String(asset && (asset.path || asset.previewUrl || asset.src) || '').trim();
      if (!directive || !path) {
        return null;
      }
      const source = sourceRef(asset && asset.source || {});
      const original = directive + ': ' + path;
      const guarded = canGuardField(source, original);
      return {
        id: safeId(['asset', directive, source.line || index + 1].join('_')),
        role: 'asset_reference',
        label: assetDirectiveLabel(directive),
        original,
        value: original,
        source,
        sourcePath: source.path || sceneSourcePath || '',
        editability: guarded ? 'guarded_replace_text' : 'manual_review',
        owner: {
          sceneId,
          sectionId: '',
          itemId: '',
          kind: 'asset_reference'
        },
        sectionId: '',
        optionId: '',
        confidence: asset && asset.confidence || '',
        reason: guarded
          ? 'Exact source asset directive can be checked before replacement.'
          : 'Needs IDE review because Studio lacks safe single-line asset directive evidence.'
      };
    }).filter(Boolean);
  }

  function normalizeAssetDirective(value) {
    const text = String(value || '').trim().toLowerCase();
    return text === 'face-image' || text === 'card-image' || text === 'set-bg' || text === 'audio' ? text : '';
  }

  function assetDirectiveLabel(directive) {
    const labels = {
      'face-image': 'Portrait image',
      'card-image': 'Card image',
      'set-bg': 'Background image',
      audio: 'Audio asset'
    };
    return labels[directive] || 'Asset reference';
  }

  function normalizeAssetInstallRequest(input) {
    const value = isObject(input) ? input : {};
    return {
      sourceName: String(value.sourceName || value.fileName || value.name || '').trim(),
      sourcePath: String(value.sourcePath || '').trim(),
      targetPath: String(value.targetPath || value.target || value.path || '').trim(),
      type: String(value.type || value.assetType || '').trim(),
      label: String(value.label || value.sourceName || value.name || '').trim(),
      role: String(value.role || '').trim()
    };
  }

  function humanSectionId(sectionId) {
    const text = String(sectionId || '');
    const last = text.includes('.') ? text.split('.').pop() : text;
    return last.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function canGuardSectionChange(change) {
    const value = isObject(change) ? change : {};
    const source = sourceRef(value.source || {});
    return Boolean(
      value.operationType === 'replace_section' &&
      source.path.startsWith('source/scenes/') &&
      source.path.endsWith('.scene.dry') &&
      !isProtectedRouterPath(source.path) &&
      source.line &&
      source.endLine &&
      value.anchorText &&
      value.endAnchorText &&
      String(value.after || '').trim()
    );
  }

  function isProtectedRouterPath(relPath) {
    const rel = String(relPath || '').replace(/\\/g, '/');
    return rel === 'source/scenes/root.scene.dry' ||
      rel === 'source/scenes/post_event.scene.dry' ||
      rel === 'source/scenes/post_event_news.scene.dry';
  }

  function safeId(value) {
    let text = String(value || 'field')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!text) {
      text = 'field';
    }
    if (!/^[A-Za-z_]/.test(text)) {
      text = 'field_' + text;
    }
    return ID_RE.test(text) ? text : 'field';
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message, confidence: 'static_inferred'};
  }

  const api = {
    EXISTING_SCENE_EDIT_VERSION,
    MODEL_KIND,
    PROPOSAL_KIND,
    buildEditModel,
    buildProposal,
    normalizeProposal,
    buildExportBundle,
    renderProposalText
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapExistingSceneEdit = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
