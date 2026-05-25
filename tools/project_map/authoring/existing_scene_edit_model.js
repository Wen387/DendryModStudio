(function initProjectMapExistingSceneEdit(global) {
  'use strict';

  const EXISTING_SCENE_EDIT_VERSION = '0.2';
  const MODEL_KIND = 'existing_scene_edit_model';
  const PROPOSAL_KIND = 'existing_scene_edit';
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

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

  function metadataFieldsApi() {
    if (global && global.ProjectMapExistingSceneEditMetadataFields) {
      return global.ProjectMapExistingSceneEditMetadataFields;
    }
    if (typeof require === 'function') {
      try {
        return require('./existing_scene_edit_metadata_fields.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function conditionDiagnosticsApi() {
    if (global && global.ProjectMapExistingSceneConditionDiagnostics) {
      return global.ProjectMapExistingSceneConditionDiagnostics;
    }
    if (typeof require === 'function') {
      try {
        return require('./existing_scene_condition_diagnostics.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function assetHelpersApi() {
    if (global && global.ProjectMapExistingSceneAssetHelpers) {
      return global.ProjectMapExistingSceneAssetHelpers;
    }
    if (typeof require === 'function') {
      try {
        return require('./existing_scene_asset_helpers.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function textBlockHelpersApi() {
    if (global && global.ProjectMapExistingSceneTextBlockHelpers) {
      return global.ProjectMapExistingSceneTextBlockHelpers;
    }
    if (typeof require === 'function') {
      try {
        return require('./existing_scene_text_block_helpers.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function textBlockBuilderApi() {
    if (global && global.ProjectMapExistingSceneTextBlockBuilder) {
      return global.ProjectMapExistingSceneTextBlockBuilder;
    }
    if (typeof require === 'function') {
      try {
        return require('./existing_scene_text_block_builder.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function structureOperationsApi() {
    if (global && global.ProjectMapExistingSceneStructureOperations) {
      return global.ProjectMapExistingSceneStructureOperations;
    }
    if (typeof require === 'function') {
      try {
        return require('./existing_scene_structure_operations.js');
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

  function sourceStructureGraphApi() {
    if (global && global.ProjectMapSourceStructureGraphModel) {
      return global.ProjectMapSourceStructureGraphModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./source_structure_graph_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function ownershipMatchingApi() {
    if (global && global.ProjectMapOwnershipMatching) {
      return global.ProjectMapOwnershipMatching;
    }
    if (typeof require === 'function') {
      try {
        return require('./ownership_matching_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  let cachedAssetHelpers = null;
  let cachedTextBlockHelpers = null;
  let cachedTextBlockBuilder = null;
  let cachedStructureOperations = null;

  function existingSceneAssetHelpers() {
    if (!cachedAssetHelpers) {
      const helpers = assetHelpersApi();
      if (!helpers || typeof helpers.create !== 'function') {
        throw new Error('ProjectMapExistingSceneAssetHelpers is required before ProjectMapExistingSceneEdit.');
      }
      cachedAssetHelpers = helpers.create({sourceRef, canGuardField, safeId});
    }
    return cachedAssetHelpers;
  }

  function existingSceneTextBlockHelpers() {
    if (!cachedTextBlockHelpers) {
      const helpers = textBlockHelpersApi();
      if (!helpers || typeof helpers.create !== 'function') {
        throw new Error('ProjectMapExistingSceneTextBlockHelpers is required before ProjectMapExistingSceneEdit.');
      }
      cachedTextBlockHelpers = helpers.create({sourceRef, humanSectionId});
    }
    return cachedTextBlockHelpers;
  }

  function existingSceneTextBlockBuilder() {
    if (!cachedTextBlockBuilder) {
      const builder = textBlockBuilderApi();
      if (!builder || typeof builder.create !== 'function') {
        throw new Error('ProjectMapExistingSceneTextBlockBuilder is required before ProjectMapExistingSceneEdit.');
      }
      cachedTextBlockBuilder = builder.create({
        sourceRef,
        sourceLine,
        safeId,
        isProtectedRouterPath,
        textBlockHelpers: existingSceneTextBlockHelpers()
      });
    }
    return cachedTextBlockBuilder;
  }

  function existingSceneStructureOperations() {
    if (!cachedStructureOperations) {
      const operations = structureOperationsApi();
      if (!operations || typeof operations.create !== 'function') {
        throw new Error('ProjectMapExistingSceneStructureOperations is required before ProjectMapExistingSceneEdit.');
      }
      cachedStructureOperations = operations.create({sourceRef, baseFieldChange, isProtectedRouterPath, normalizeStructuralEffect});
    }
    return cachedStructureOperations;
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
    const metadataFields = metadataEditableFields(scene, source.path, textFields);
    const optionTextFields = optionLabelFieldsForScene(scene, source.path, textFields.concat(metadataFields));
    let fields = textFields.concat(
      optionTextFields,
      metadataFields,
      assetEditableFields(scene, source.path, {textRows})
    );
    if (!fields.length) {
      diagnostics.push(diagnostic('warning', 'existing_scene_edit.no_text_rows', 'No source-backed Text Corpus rows were found for this scene.'));
    }
    diagnostics.push.apply(diagnostics, conditionWindowDiagnosticsForScene(scene));
    const eventOptions = optionRows(scene, fields);
    const textBlocks = textBlocksForScene(scene, visibleTextRows, source.path, eventOptions);
    fields = fields.concat(assetAddReferenceFields(scene, source.path, fields, textRows, sceneKind, {textBlocks, eventOptions}));
    const effects = effectRows(index, scene, scriptRows);
    const routeFields = routeEditableFields(scene, eventOptions);
    const flow = flowForScene(scene, eventOptions, effects, routeFields);
    const sourceStructureGraph = sourceStructureGraphForScene(scene, source, eventOptions, textBlocks, effects, routeFields, flow);
    fields = fields.concat(
      routeFields,
      effectEditableFields(scene, effects, eventOptions),
      structuralActionFields(scene, eventOptions, effects, textBlocks, source, sourceStructureGraph)
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
      scriptRows: scriptRows.map((row, index) => scriptRowForEditor(row, index)),
      opaqueJsBlocks: ensureArray(scene.opaqueJsBlocks).map(normalizeOpaqueJsBlock).filter(Boolean),
      options: eventOptions,
      sections: sectionRows(fields, eventOptions),
      effects,
      flow,
      sourceStructureGraph,
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
    const derived = textRowIsDerivedAlias(row);
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
      derivedAlias: derived,
      derivedFromRole: derived ? 'body' : '',
      derivedReason: derived
        ? 'This field is a derived monthly popup excerpt from the same source-backed body text. Editing it changes the source line shared with the body preview.'
        : '',
      reason: guarded
        ? (derived
          ? 'Derived alias of source-backed body text; Review & Apply still checks the exact source line before replacement.'
          : 'Exact source line can be checked before replacement.')
        : 'Needs source slice editing and advanced apply because Studio lacks safe single-line source evidence.'
    };
  }

  function textRowIsDerivedAlias(row) {
    return String(row && row.role || '') === 'monthly_popup_excerpt';
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
    const seenIds = new Map();
    return collectSceneOptions(scene).map((entry, index) => {
      const option = entry.option || {};
      const target = isObject(option.target) ? option.target : {};
      const rawTarget = rawOptionTarget(option, target);
      const resolvedTarget = resolveOptionTarget(scene, rawTarget, target);
      const targetSection = findSceneSection(scene, resolvedTarget || rawTarget);
      const baseId = safeId(entry.sectionId
        ? [entry.sectionKey || 'section', rawTarget || option.id || 'option_' + (index + 1)].filter(Boolean).join('__')
        : (rawTarget || option.id || 'option_' + (index + 1)));
      const id = uniqueOptionRowId(baseId, option.sourceSpan || option.source || {}, index, seenIds);
      const titleText = optionTitleText(option, rawTarget);
      const parts = splitOptionTitle(titleText);
      const labelField = findOptionField(fields, rawTarget || id, 'option_label', parts.label, entry.sectionId);
      const subtitleField = findOptionField(fields, rawTarget || id, 'option_subtitle', parts.subtitle, entry.sectionId);
      const unavailableField = findOptionField(fields, rawTarget || id, 'unavailable_text', option.unavailableText || '', entry.sectionId);
      const targetUnavailableField = targetSection
        ? fields.find((field) => field.role === 'unavailable_text' && String(field.sectionId || '') === String(targetSection.id || ''))
        : null;
      const source = optionSourceRef(option.sourceSpan || option.source || {}, labelField, subtitleField, unavailableField);
      const conditionSource = optionConditionSourceRef(option, entry.section, targetSection, source);
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
        source,
        conditionSource
      };
    });
  }

  function uniqueOptionRowId(baseId, sourceInput, index, seenIds) {
    const base = safeId(baseId || 'option_' + (index + 1));
    const count = Number(seenIds.get(base) || 0) + 1;
    seenIds.set(base, count);
    if (count === 1) {
      return base;
    }
    const source = sourceRef(sourceInput || {});
    const line = Number(source.line || source.startLine || 0);
    return safeId(base + '__' + (line > 0 ? 'line_' + line : 'option_' + (index + 1)));
  }

  function optionLabelInfo(scene, option, parts, labelField, resolvedTarget, rawTarget, index) {
    if (labelField && String(labelField.original || '').trim()) {
      return {label: String(labelField.original || ''), source: 'field'};
    }
    if (parts && String(parts.label || '').trim()) {
      return {label: String(parts.label || ''), source: 'inline'};
    }
    const title = String(option && (option.title || option.label) || '').trim();
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

  function optionLabelFieldsForScene(scene, sceneSourcePath, existingFields) {
    const fields = ensureArray(existingFields).slice();
    const created = [];
    collectSceneOptions(scene).forEach((entry, index) => {
      const option = entry.option || {};
      const target = isObject(option.target) ? option.target : {};
      const rawTarget = rawOptionTarget(option, target);
      const optionId = rawTarget || option.id || '';
      const resolvedTarget = resolveOptionTarget(scene, rawTarget, target);
      const targetSection = findSceneSection(scene, resolvedTarget || rawTarget);
      const parts = splitOptionTitle(optionTitleText(option, rawTarget));
      [
        {role: 'option_label', value: parts.label, suffix: 'label', targetRole: 'title'},
        {role: 'option_subtitle', value: parts.subtitle, suffix: 'subtitle', targetRole: 'subtitle'}
      ].forEach((item) => {
        const value = String(item.value || '').trim();
        if (value) {
          if (findOptionFieldForSynthesis(fields, optionId, item.role, value, entry.sectionId)) {
            return;
          }
          const field = syntheticOptionTextField(scene, sceneSourcePath, entry, option, rawTarget, item.role, item.suffix, value, index);
          created.push(field);
          fields.push(field);
          return;
        }
        const targetField = targetSectionTextField(fields, targetSection, item.targetRole);
        if (!targetField || findOptionFieldForSynthesis(fields, optionId, item.role, targetField.original, entry.sectionId)) {
          return;
        }
        const field = targetSectionOptionTextField(scene, sceneSourcePath, entry, option, rawTarget, item.role, item.suffix, targetField, targetSection, index);
        created.push(field);
        fields.push(field);
      });
    });
    return created;
  }

  function targetSectionTextField(fields, section, role) {
    const sectionId = String(section && section.id || '').trim();
    const expected = String(section && (role === 'subtitle' ? section.subtitle : section.title) || '').trim();
    if (!sectionId || !expected) {
      return null;
    }
    return ensureArray(fields).find((field) => {
      const source = sourceRef(field && field.source || {});
      return String(field && field.role || '') === role &&
        String(field && field.sectionId || '') === sectionId &&
        normalizedFieldText(field && field.original) === normalizedFieldText(expected) &&
        source.path;
    }) || null;
  }

  function targetSectionOptionTextField(scene, sceneSourcePath, entry, option, rawTarget, role, suffix, targetField, targetSection, index) {
    const sceneId = String(scene && scene.id || '');
    const optionId = String(rawTarget || option && (option.id || option.targetId) || 'option_' + (index + 1));
    const optionSectionId = String(entry && entry.sectionId || '');
    const targetSectionId = String(targetSection && targetSection.id || '');
    const source = sourceRef(targetField && targetField.source || {});
    const targetRole = String(targetField && targetField.role || '');
    const sectionValue = String(targetSection && (targetRole === 'subtitle' ? targetSection.subtitle : targetSection.title) || '').trim();
    const value = sectionValue || String(targetField && targetField.original || '');
    const guarded = canGuardField(source, value);
    return {
      id: safeId([sceneId, optionSectionId || 'root', optionId, suffix].filter(Boolean).join('_') || 'option_' + (index + 1) + '_' + suffix),
      role,
      label: roleLabel(role),
      original: value,
      value,
      source,
      sourcePath: source.path || sceneSourcePath || '',
      editability: guarded ? 'guarded_replace_text' : String(targetField && targetField.editability || 'advanced_source_patch'),
      owner: {
        sceneId,
        sectionId: optionSectionId,
        itemId: optionId,
        kind: 'scene',
        targetSectionId
      },
      sectionId: optionSectionId,
      targetSectionId,
      optionId,
      derivedFromFieldId: String(targetField && targetField.id || ''),
      derivedFromRole: String(targetField && targetField.role || ''),
      confidence: guarded ? 'source_target_section_title' : 'parsed_target_section_title',
      reason: guarded
        ? 'Player option text is inherited from a source-backed target section title/subtitle and can be edited safely.'
        : 'Player option text is inherited from the target section title/subtitle and may need advanced source editing.'
    };
  }

  function normalizedFieldText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function findOptionFieldForSynthesis(fields, optionId, role, fallbackText, sectionId) {
    const exact = ensureArray(fields).find((field) => {
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
    return ensureArray(fields).find((field) => {
      return field.role === role &&
        !field.optionId &&
        String(field.original || '').trim() === text &&
        (!sectionId || !field.sectionId || String(field.sectionId) === String(sectionId));
    }) || null;
  }

  function syntheticOptionTextField(scene, sceneSourcePath, entry, option, rawTarget, role, suffix, value, index) {
    const sceneId = String(scene && scene.id || '');
    const sectionId = String(entry && entry.sectionId || '');
    const optionId = String(rawTarget || option && (option.id || option.targetId) || 'option_' + (index + 1));
    const source = optionLineSource(option, sceneSourcePath, rawTarget);
    const guarded = canGuardField(source, value);
    return {
      id: safeId([sceneId, sectionId, optionId, suffix].filter(Boolean).join('_') || 'option_' + (index + 1) + '_' + suffix),
      role,
      label: roleLabel(role),
      original: value,
      value,
      source,
      sourcePath: source.path || sceneSourcePath || '',
      editability: guarded ? 'guarded_replace_text' : 'advanced_source_patch',
      owner: {
        sceneId,
        sectionId,
        itemId: optionId,
        kind: 'scene'
      },
      sectionId,
      optionId,
      confidence: guarded ? 'source_option_line' : 'parsed_option_line',
      reason: guarded
        ? 'Player option text was recovered from the exact source option line.'
        : 'Player option text was recovered from parser option metadata and may need advanced source editing.'
    };
  }

  function optionTitleText(option, rawTarget) {
    return optionTitleFromSource(option, rawTarget) ||
      String(option && (option.title || option.label) || '').trim();
  }

  function optionTitleFromSource(option, rawTarget) {
    const source = sourceRef(option && (option.sourceSpan || option.source) || {});
    const anchors = uniqueStrings([source.anchorText, source.endAnchorText]);
    for (let index = 0; index < anchors.length; index += 1) {
      const title = optionTitleFromSourceLine(anchors[index], rawTarget);
      if (title) {
        return title;
      }
    }
    return '';
  }

  function optionTitleFromSourceLine(line, rawTarget) {
    const text = String(line || '').split(/\r?\n/).map((part) => part.trim()).find(Boolean) || '';
    if (!text) {
      return '';
    }
    const target = String(rawTarget || '').replace(/^[@#]/, '');
    const optionLine = /^\s*[-*+]\s+(.+)$/.exec(text);
    if (!optionLine) {
      return '';
    }
    const body = optionLine[1].trim();
    const targetPrefix = target ? new RegExp('^[@#]?' + escapeRegExp(target) + '\\s*:\\s*(.*)$') : null;
    const targetMatch = targetPrefix ? targetPrefix.exec(body) : null;
    if (targetMatch) {
      return targetMatch[1].trim();
    }
    if (target && body.replace(/^[@#]/, '') === target) {
      return '';
    }
    const genericMatch = /^(?:[@#]?[A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(body);
    return genericMatch ? genericMatch[1].trim() : body;
  }

  function optionLineSource(option, sceneSourcePath, rawTarget) {
    const source = sourceRef(option && (option.sourceSpan || option.source) || {});
    const anchor = String(source.anchorText || '').trim() || optionLineAnchor(option, rawTarget);
    return Object.assign({}, source, {
      path: source.path || sceneSourcePath || '',
      anchorText: anchor,
      endAnchorText: String(source.endAnchorText || '').trim() || anchor
    });
  }

  function optionLineAnchor(option, rawTarget) {
    const title = String(option && (option.title || option.label) || '').trim();
    const target = String(rawTarget || option && (option.targetId || option.id) || '').replace(/^[@#]/, '');
    if (!target && !title) {
      return '';
    }
    return '- @' + target + (title ? ': ' + title : '');
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  function optionConditionSourceRef(option, ownerSection, targetSection, fallbackSource) {
    const optionMeta = isObject(option && option.metadata) ? option.metadata : {};
    const fallback = sourceRef(fallbackSource || {});
    if (option && option.chooseIf && optionMeta.chooseIf) {
      const source = sourceRefWithFallback(optionMeta.chooseIf, fallback);
      return Object.assign({}, source, {
        conditionScope: 'option_choose_if',
        conditionValue: String(option.chooseIf || '').trim(),
        anchorText: source.anchorText || 'choose-if: ' + String(option.chooseIf || '').trim(),
        endAnchorText: source.endAnchorText || source.anchorText || 'choose-if: ' + String(option.chooseIf || '').trim()
      });
    }
    const sectionChooseSource = singleSectionConditionSource([
      sectionConditionSourceRef(ownerSection, 'chooseIf', 'choose-if', 'owner_section_choose_if', fallback),
      sectionConditionSourceRef(targetSection, 'chooseIf', 'choose-if', 'target_section_choose_if', fallback)
    ]);
    if (sectionChooseSource) {
      return sectionChooseSource;
    }
    const sectionViewSource = singleSectionConditionSource([
      sectionConditionSourceRef(ownerSection, 'viewIf', 'view-if', 'owner_section_view_if', fallback),
      sectionConditionSourceRef(targetSection, 'viewIf', 'view-if', 'target_section_view_if', fallback)
    ]);
    if (sectionViewSource) {
      return sectionViewSource;
    }
    return fallback;
  }

  function sectionConditionSourceRef(section, key, directive, scope, fallback) {
    const value = String(section && section[key] || '').trim();
    const metadataKey = key === 'chooseIf' ? 'chooseIf' : 'viewIf';
    const meta = isObject(section && section.metadata) ? section.metadata : {};
    if (!value || !meta[metadataKey]) {
      return null;
    }
    const source = sourceRefWithFallback(meta[metadataKey], fallback);
    const anchor = directive + ': ' + value;
    return Object.assign({}, source, {
      conditionScope: scope,
      conditionValue: value,
      anchorText: source.anchorText || anchor,
      endAnchorText: source.endAnchorText || source.anchorText || anchor
    });
  }

  function singleSectionConditionSource(sources) {
    const candidates = ensureArray(sources).filter(Boolean);
    if (candidates.length !== 1) {
      return null;
    }
    return candidates[0];
  }

  function sourceRefWithFallback(input, fallback) {
    const source = sourceRef(input || {});
    const base = sourceRef(fallback || {});
    return Object.assign({}, source, {
      path: source.path || base.path,
      line: source.line || source.startLine || base.line || base.startLine,
      startLine: source.startLine || source.line || base.startLine || base.line,
      endLine: source.endLine || source.line || source.startLine || source.line || base.endLine || base.line || base.startLine
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

  function flowForScene(scene, options, effects, routeFields) {
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
        index,
        source: sourceForRouteField(routeFields, '', route, 'goTo')
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
          index,
          source: sourceForRouteField(routeFields, from, route, 'goTo')
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
      source: sourceRef(opts.source || route && (route.source || route.sourceSpan) || {})
    };
  }

  function sourceForRouteField(routeFields, sectionId, route, routeKind) {
    const raw = routeRawTarget(route);
    const match = ensureArray(routeFields).find((field) => {
      return String(field && field.role || '') === 'route' &&
        String(field && field.routeKind || '') === String(routeKind || '') &&
        String(field && field.sectionId || '') === String(sectionId || '') &&
        String(field && field.original || '') === raw;
    });
    return match && match.source ? match.source : null;
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
    return existingSceneTextBlockBuilder().textBlocksForScene(scene, rows, sceneSourcePath, options);
  }

  function normalizeBlockTextRows(rows) {
    return existingSceneTextBlockBuilder().normalizeBlockTextRows(rows);
  }

  function blockSourceLineKey(row) {
    return existingSceneTextBlockBuilder().blockSourceLineKey(row);
  }

  function isMixedInlineConditionalSource(value) {
    return existingSceneTextBlockHelpers().isMixedInlineConditionalSource(value);
  }

  function isStructuralSceneLine(value) {
    return existingSceneTextBlockHelpers().isStructuralSceneLine(value);
  }

  function logicalTextRuns(rows) {
    return existingSceneTextBlockHelpers().logicalTextRuns(rows);
  }

  function textBlockFromRows(scene, sectionId, rows, options, runOptions) {
    return existingSceneTextBlockBuilder().textBlockFromRows(scene, sectionId, rows, options, runOptions);
  }

  function conditionalAlternativesForRows(rows) {
    return existingSceneTextBlockHelpers().conditionalAlternativesForRows(rows);
  }

  function detectVisualKinds(value) {
    return existingSceneTextBlockHelpers().detectVisualKinds(value);
  }

  function textBlockSemantics(scene, sectionId, rows, options) {
    return existingSceneTextBlockHelpers().textBlockSemantics(scene, sectionId, rows, options);
  }

  function findSceneSection(scene, sectionId) {
    return existingSceneTextBlockHelpers().findSceneSection(scene, sectionId);
  }

  function sectionTargetedByOption(sceneId, sectionId, option) {
    return existingSceneTextBlockHelpers().sectionTargetedByOption(sceneId, sectionId, option);
  }

  function sectionOwnsOption(sceneId, sectionId, option) {
    return existingSceneTextBlockHelpers().sectionOwnsOption(sceneId, sectionId, option);
  }

  function sectionIdVariants(sceneId, sectionId) {
    return existingSceneTextBlockHelpers().sectionIdVariants(sceneId, sectionId);
  }

  function optionTargetVariants(sceneId, option) {
    return existingSceneTextBlockHelpers().optionTargetVariants(sceneId, option);
  }

  function optionOwnerVariants(sceneId, option) {
    return existingSceneTextBlockHelpers().optionOwnerVariants(sceneId, option);
  }

  function endpointVariants(sceneId, values) {
    return existingSceneTextBlockHelpers().endpointVariants(sceneId, values);
  }

  function optionIdVariants(sceneId, option) {
    return existingSceneTextBlockHelpers().optionIdVariants(sceneId, option);
  }

  function isOpeningSectionId(sceneId, sectionId) {
    return existingSceneTextBlockHelpers().isOpeningSectionId(sceneId, sectionId);
  }

  function sectionDisplayLabel(sceneId, section, sectionId) {
    return existingSceneTextBlockHelpers().sectionDisplayLabel(sceneId, section, sectionId);
  }

  function lastMeaningfulCondition(values) {
    return existingSceneTextBlockHelpers().lastMeaningfulCondition(values);
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
    return existingSceneTextBlockBuilder().variablesFromCondition(value);
  }

  function variablesFromDendryText(value) {
    return existingSceneTextBlockBuilder().variablesFromDendryText(value);
  }

  function isBlockTextRole(role) {
    return existingSceneTextBlockHelpers().isBlockTextRole(role);
  }

  function renderTextBlockContent(rows) {
    return existingSceneTextBlockBuilder().renderTextBlockContent(rows);
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
    const api = metadataFieldsApi();
    const definitions = api && typeof api.editableDefinitions === 'function' ? api.editableDefinitions() : [];
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
    const sectionDefinitions = api && typeof api.sectionEditableDefinitions === 'function'
      ? api.sectionEditableDefinitions()
      : definitions.filter((definition) => api && typeof api.isSectionMetadataKey === 'function' && api.isSectionMetadataKey(definition.key));
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
          return enrichEffectRowsWithOpaqueAnchors(rows, scene);
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

  function enrichEffectRowsWithOpaqueAnchors(rows, scene) {
    const blocks = ensureArray(scene && scene.opaqueJsBlocks);
    if (!blocks.length) {
      return rows;
    }
    return ensureArray(rows).map((row) => {
      const source = sourceRef(row && row.source || {});
      if (!source.path || source.anchorText || !Number.isInteger(Number(source.line || source.startLine || 0))) {
        return row;
      }
      const line = Number(source.line || source.startLine || 0);
      const block = blocks.map((item) => {
        const blockSource = sourceRef(item && item.source || {});
        return {
          source: blockSource,
          rawLines: String(item && item.rawPreview || '').split(/\r?\n/)
        };
      }).find((item) => {
        const start = Number(item.source.startLine || item.source.line || 0);
        const end = Number(item.source.endLine || item.source.line || start || 0);
        return item.source.path === source.path && start && end && line > start && line < end;
      });
      if (!block) {
        return row;
      }
      const blockStart = Number(block.source.startLine || block.source.line || 0);
      const rawLine = String(block.rawLines[line - blockStart - 1] || '').trim();
      if (!rawLine) {
        return row;
      }
      return Object.assign({}, row, {
        sourceExpression: row.sourceExpression || rawLine,
        displayExpression: row.displayExpression || rawLine,
        expression: row.expression || rawLine,
        source: Object.assign({}, source, {
          anchorText: rawLine,
          endAnchorText: rawLine
        })
      });
    });
  }

  function scriptRowForEditor(row, index) {
    const owner = isObject(row && row.owner) ? row.owner : {};
    return {
      id: String(row && row.id || 'script_row_' + (index + 1)),
      label: String(row && row.label || row && row.role || 'script'),
      text: String(row && row.text || ''),
      role: String(row && row.role || 'script'),
      sectionId: String(owner.sectionId || ''),
      owner: {
        sceneId: String(owner.sceneId || ''),
        sectionId: String(owner.sectionId || ''),
        itemId: String(owner.itemId || ''),
        kind: String(owner.kind || 'script')
      },
      source: sourceRef(row && row.source || {})
    };
  }

  function effectEditableFields(scene, effects, options) {
    const api = logicFieldsApi();
    return api && typeof api.buildEffectFields === 'function' ? api.buildEffectFields(scene, effects, options) : [];
  }

  function sourceStructureGraphForScene(scene, source, options, textBlocks, effects, routeFields, flow) {
    const api = sourceStructureGraphApi();
    if (!api || typeof api.buildSourceStructureGraph !== 'function') {
      return null;
    }
    return api.buildSourceStructureGraph({
      scene,
      sceneId: String(scene && scene.id || ''),
      source,
      options,
      textBlocks,
      effects,
      routeFields,
      flow,
      assets: ensureArray(scene && scene.assetRefs)
    });
  }

  function structuralActionFields(scene, options, effects, textBlocks, source, sourceStructureGraph) {
    const api = eventStructureApi();
    if (!api || typeof api.structureActionsForSource !== 'function') {
      return [];
    }
    return api.structureActionsForSource({
      sceneId: String(scene && scene.id || ''),
      source: source || scene && scene.sourceSpan || {path: scene && scene.path},
      options,
      effects,
      textBlocks,
      sections: ensureArray(scene && scene.sections),
      opaqueJsBlocks: ensureArray(scene && scene.opaqueJsBlocks),
      metadata: isObject(scene && scene.metadata) ? scene.metadata : {},
      topLevelSpan: scene && scene.topLevelSpan || null,
      sourceGraph: sourceStructureGraph
    });
  }

  function parseEffectText(text) {
    const rows = [];
    const raw = String(text || '').trim();
    const hookMatch = raw.match(/^(on-arrival|on-departure|on-display)\s*:\s*(.+)$/i);
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
    return /^(?:on-arrival|on-departure|on-display)\s*:/i.test(text) ||
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
        rawAnchorText: block.source && block.source.rawAnchorText || '',
        rawEndAnchorText: block.source && block.source.rawEndAnchorText || '',
        expectedRangeHash: block.source && block.source.expectedRangeHash || '',
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
    const fieldChanges = ensureArray(model.fields).reduce((changes, field) => {
      if (coveredFieldIds.has(field.id)) {
        return changes;
      }
      const hasEditedValue = Object.prototype.hasOwnProperty.call(values, field.id);
      const after = hasEditedValue ? values[field.id] : field.value;
      if (String(after === undefined || after === null ? '' : after) === String(field.original || '')) {
        return changes;
      }
      pushChanges(changes, changeFromField(field, after));
      return changes;
    }, []);
    const structureCommandChanges = structuralCommandChangesFromValues(model, values);
    const changes = blockChanges.concat(fieldChanges, structureCommandChanges);
    const diagnostics = [];
    if (!changes.length) {
      diagnostics.push(diagnostic('warning', 'existing_scene_edit.no_changes', 'No changed fields were found yet.'));
    }
    diagnostics.push.apply(diagnostics, conditionWindowDiagnosticsForChanges(changes));
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

  function conditionWindowDiagnosticsForScene(scene) {
    const api = conditionDiagnosticsApi();
    return api && typeof api.conditionWindowDiagnosticsForScene === 'function'
      ? api.conditionWindowDiagnosticsForScene(scene)
      : [];
  }

  function conditionWindowDiagnosticsForChanges(changes) {
    const api = conditionDiagnosticsApi();
    return api && typeof api.conditionWindowDiagnosticsForChanges === 'function'
      ? api.conditionWindowDiagnosticsForChanges(changes)
      : [];
  }

  function pushConditionWindowDiagnostic(rows, label, condition) {
    const api = conditionDiagnosticsApi();
    if (api && typeof api.pushConditionWindowDiagnostic === 'function') {
      api.pushConditionWindowDiagnostic(rows, label, condition);
    }
  }

  function impossibleMonthWindow(condition) {
    const api = conditionDiagnosticsApi();
    return api && typeof api.impossibleMonthWindow === 'function'
      ? api.impossibleMonthWindow(condition)
      : '';
  }

  function sectionLabelForDiagnostic(scene, section) {
    const api = conditionDiagnosticsApi();
    return api && typeof api.sectionLabelForDiagnostic === 'function'
      ? api.sectionLabelForDiagnostic(scene, section)
      : 'section';
  }

  function structuralChangeFromField(field, afterValue) {
    const afterText = String(afterValue === undefined || afterValue === null ? '' : afterValue).trim();
    if (!afterText || (field.inputType === 'checkbox' && !/^(1|true|yes|on)$/i.test(afterText))) {
      return null;
    }
    if (String(field && field.structureAction || '') === 'add_option') {
      const guarded = guardedAddOptionChange(field, afterText);
      if (guarded) {
        return guarded;
      }
      const advanced = advancedAddOptionChange(field, afterText);
      if (advanced) {
        return advanced;
      }
    }
    if (String(field && field.structureAction || '') === 'add_branch') {
      const advanced = advancedAddBranchChange(field, afterText);
      if (advanced) {
        return advanced;
      }
    }
    if (String(field && field.structureAction || '') === 'add_option_effect') {
      const guarded = guardedOptionEffectChange(field, afterText);
      if (guarded) {
        return guarded;
      }
      const advanced = advancedEffectInsertChange(field, afterText);
      if (advanced) {
        return advanced;
      }
    }
    if (String(field && field.structureAction || '') === 'add_trigger_effect') {
      const guarded = guardedAddTriggerEffectChange(field, afterText);
      if (guarded) {
        return guarded;
      }
      const advanced = advancedEffectInsertChange(field, afterText);
      if (advanced) {
        return advanced;
      }
    }
    if (String(field && field.structureAction || '') === 'remove_option_condition') {
      const guarded = guardedRemoveOptionConditionChange(field);
      if (guarded) {
        return guarded;
      }
    }
    if (String(field && field.structureAction || '') === 'remove_effect') {
      const guarded = guardedRemoveEffectChange(field);
      if (guarded) {
        return guarded;
      }
    }
    if (String(field && field.structureAction || '') === 'remove_option') {
      const guarded = guardedRemoveOptionChange(field);
      if (guarded) {
        return guarded;
      }
      const advanced = advancedRemoveOptionBundleChanges(field);
      if (advanced) {
        return advanced;
      }
    }
    if (String(field && field.structureAction || '') === 'remove_layer') {
      const advanced = advancedRemoveLayerChange(field);
      if (advanced) {
        return advanced;
      }
    }
    if (String(field && field.structureAction || '') === 'reroute_layer') {
      const advanced = advancedRerouteLayerChanges(field, afterText);
      if (advanced) {
        return advanced;
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
    return commands.reduce((changes, command) => {
      const field = fieldForStructureCommand(model, command);
      if (!field) {
        return changes;
      }
      const next = Object.assign({}, field, {
        id: command.id || command.fieldId || field.id,
        optionId: command.optionId || field.optionId || '',
        sectionId: command.sectionId || field.sectionId || '',
        structureTargetLabel: command.targetLabel || field.structureTargetLabel || ''
      });
      pushChanges(changes, structuralChangeFromField(next, command.value || 'true'));
      return changes;
    }, []);
  }

  function pushChanges(changes, value) {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) {
          changes.push(item);
        }
      });
    } else if (value) {
      changes.push(value);
    }
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
    const ownership = ownershipMatchingApi();
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
      if (optionId) {
        const optionMatches = ownership && typeof ownership.endpointMatches === 'function'
          ? ownership.endpointMatches(field.optionId || '', rawOptionId)
          : safeId(field.optionId || '') === optionId;
        if (!optionMatches) {
          return false;
        }
      }
      if (sectionId) {
        const sectionMatches = ownership && typeof ownership.endpointMatches === 'function'
          ? ownership.endpointMatches(field.sectionId || '', rawSectionId)
          : safeId(field.sectionId || '') === sectionId;
        if (!sectionMatches) {
          return false;
        }
      }
      return true;
    }) || null;
  }

  function normalizeStructureAction(value) {
    return existingSceneStructureOperations().normalizeStructureAction(value);
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
    return existingSceneStructureOperations().structureActionFallbackText(field, afterText);
  }

  function normalizeStructuralEffect(value) {
    const text = String(value || '').trim().replace(/;+$/, '');
    const api = logicFieldsApi();
    if (api && typeof api.isSimpleEffectExpression === 'function' && api.isSimpleEffectExpression(text)) {
      return text;
    }
    return text + '\nManual review: effect expression was not recognized as a simple Q assignment.';
  }

  function guardedAddOptionChange(field, afterText) {
    const sourceBlock = isObject(field && field.structureSourceBlock) ? field.structureSourceBlock : {};
    const blockKind = String(sourceBlock.kind || '').trim();
    if (blockKind !== 'root_option_insert_anchor' && blockKind !== 'section_option_insert_anchor' && blockKind !== 'section_text_option_insert_anchor') {
      return null;
    }
    const source = sourceRef(field && field.source || {});
    const path = String(source.path || '');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    const anchor = String(source.anchorText || '').trim();
    if (!path.startsWith('source/scenes/') || !path.endsWith('.scene.dry') || isProtectedRouterPath(path) ||
      !Number.isInteger(line) || line <= 0 || (Number.isInteger(endLine) && endLine > 0 && endLine !== line) ||
      !anchor || (blockKind === 'root_option_insert_anchor' && !isSourceOptionLine(anchor))) {
      return null;
    }
    const parsed = parseStructuralAddOption(afterText);
    if (!parsed.ok || String(parsed.resultMode || 'native') !== 'native' || !safeNewStructureId(parsed.target)) {
      return null;
    }
    if (structureIdExists(field, parsed.target) || !safeNewOptionResultText(parsed.result)) {
      return null;
    }
    const textAnchorInsert = blockKind === 'section_text_option_insert_anchor';
    const content = renderAddOptionInsert(parsed, {leadingBlank: textAnchorInsert});
    const change = baseFieldChange(field, '(not present yet)', content);
    change.editability = 'guarded_apply';
    change.operationType = 'insert_text';
    change.anchorText = anchor;
    change.position = 'after';
    change.dedupeSearch = '@' + parsed.target;
    return change;
  }

  function parseStructuralAddOption(value) {
    const lines = String(value || '').split(/\r?\n/);
    const optionLine = lines.find((line) => /^\s*-\s*@[^:]+:/.test(line)) || '';
    const optionMatch = optionLine.match(/^\s*-\s*@([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+?)\s*$/);
    if (!optionMatch) {
      return {ok: false};
    }
    const sectionLine = lines.find((line) => /^\s*[#@]\s*\S+/.test(line)) || '';
    const sectionMatch = sectionLine.match(/^\s*[#@]\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/);
    if (sectionLine && (!sectionMatch || sectionMatch[1] !== optionMatch[1])) {
      return {ok: false};
    }
    const chooseLine = lines.find((line) => /^\s*choose-if\s*:/i.test(line)) || '';
    const unavailableLine = lines.find((line) => /^\s*unavailable(?:-(?:subtitle|text)|subtitle|text)\s*:/i.test(line)) || '';
    const resultModeLine = lines.find((line) => /^\s*result-mode\s*:/i.test(line)) || '';
    const effectLines = lines.filter((line) => /^\s*on-arrival\s*:/i.test(line));
    const effects = parseStructuralAddOptionEffects(effectLines);
    if (!effects.ok) {
      return {ok: false};
    }
    const result = lines.filter((line) => {
      return line !== optionLine && line !== sectionLine && line !== chooseLine && line !== unavailableLine && line !== resultModeLine && !effectLines.includes(line);
    }).join('\n').trim();
    return {
      ok: true,
      target: optionMatch[1],
      label: optionMatch[2].trim(),
      result,
      chooseIf: chooseLine.replace(/^\s*choose-if\s*:\s*/i, '').trim(),
      unavailableText: unavailableLine.replace(/^\s*unavailable(?:-(?:subtitle|text)|subtitle|text)\s*:\s*/i, '').trim(),
      resultMode: resultModeLine.replace(/^\s*result-mode\s*:\s*/i, '').trim() || 'native',
      effects: effects.items
    };
  }

  function parseStructuralAddOptionEffects(lines) {
    const items = [];
    for (const line of ensureArray(lines)) {
      const body = String(line || '').replace(/^\s*on-arrival\s*:\s*/i, '').trim();
      const clauses = splitEffectClauses(body);
      if (!body || !clauses.length) {
        return {ok: false, items: []};
      }
      for (const clause of clauses) {
        const parsed = parseSimpleStructuralEffect(clause);
        if (!parsed) {
          return {ok: false, items: []};
        }
        items.push(parsed);
      }
    }
    return {ok: true, items};
  }

  function safeNewStructureId(value) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(value || '').trim());
  }

  function structureIdExists(field, id) {
    const wanted = normalizeStructureLocalId(id);
    if (!wanted) {
      return true;
    }
    return ensureArray(field && field.structureExistingIds).some((value) => normalizeStructureLocalId(value) === wanted);
  }

  function normalizeStructureLocalId(value) {
    const text = String(value || '').trim().replace(/^[@#]/, '');
    if (!text) {
      return '';
    }
    const local = text.indexOf('.') >= 0 ? text.split('.').pop() : text;
    return safeId(local);
  }

  function safeNewOptionResultText(value) {
    const text = String(value || '').trim();
    if (!text || text.indexOf('{!') >= 0 || text.indexOf('!}') >= 0) {
      return false;
    }
    return !text.split(/\r?\n/).some((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return false;
      }
      return /^[@#]\s*\S+/.test(trimmed) ||
        /^-\s*@/.test(trimmed) ||
        /^(?:title|new-page|tags|view-if|choose-if|go-to|set-root|on-arrival|on-departure|on-display|result-mode|unavailable(?:-(?:subtitle|text)|subtitle|text))\s*:/i.test(trimmed);
    });
  }

  function renderAddOptionInsert(option, options) {
    const opts = isObject(options) ? options : {};
    return [
      opts.leadingBlank ? '' : null,
      '- @' + option.target + ': ' + option.label,
      '',
      '@' + option.target,
      option.chooseIf || option.unavailableText ? 'title: ' + option.label : '',
      option.chooseIf ? 'choose-if: ' + option.chooseIf : '',
      option.unavailableText ? 'unavailable-subtitle: ' + option.unavailableText : '',
      renderStructuralAddOptionEffects(option.effects),
      option.chooseIf || option.unavailableText || ensureArray(option.effects).length ? '' : null,
      '',
      option.result
    ].filter((line) => line !== null).join('\n') + '\n';
  }

  function renderStructuralAddOptionEffects(effects) {
    const lines = ensureArray(effects).map((effect) => {
      return 'on-arrival: ' + structuralEffectSourceExpression(effect, {qPrefix: false});
    });
    return lines.length ? lines.join('\n') : null;
  }

  function advancedAddOptionChange(field, afterText) {
    const sourceBlock = isObject(field && field.structureSourceBlock) ? field.structureSourceBlock : {};
    const blockKind = String(sourceBlock.kind || '').trim();
    if (blockKind !== 'root_option_insert_anchor' && blockKind !== 'section_option_insert_anchor' && blockKind !== 'section_text_option_insert_anchor') {
      return null;
    }
    const source = sourceRef(field && field.source || {});
    const path = String(source.path || '');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    const anchor = String(source.anchorText || '').trim();
    const textAnchorInsert = blockKind === 'section_text_option_insert_anchor';
    if (!path.startsWith('source/scenes/') || !path.endsWith('.scene.dry') || isProtectedRouterPath(path) ||
      !Number.isInteger(line) || line <= 0 || (Number.isInteger(endLine) && endLine > 0 && endLine !== line) ||
      (textAnchorInsert ? !anchor : !isSourceOptionLine(anchor))) {
      return null;
    }
    const parsed = parseStructuralAddOption(afterText);
    if (!parsed.ok || String(parsed.resultMode || 'native') !== 'native' || !safeNewStructureId(parsed.target) ||
      structureIdExists(field, parsed.target) || !safeNewOptionResultText(parsed.result)) {
      return null;
    }
    const content = renderAdvancedAddOptionInsert(parsed, {leadingBlank: textAnchorInsert});
    const change = baseFieldChange(field, '(not present yet)', content);
    change.editability = 'advanced_source_patch';
    change.operationType = 'insert_text';
    change.anchorText = anchor;
    change.position = 'after';
    change.dedupeSearch = '@' + parsed.target;
    return change;
  }

  function renderAdvancedAddOptionInsert(option, options) {
    const opts = isObject(options) ? options : {};
    const lines = [
      opts.leadingBlank ? '' : null,
      '- @' + option.target + ': ' + option.label,
      '',
      '@' + option.target,
      'title: ' + option.label,
      option.chooseIf ? 'choose-if: ' + option.chooseIf : '',
      option.unavailableText ? 'unavailable-subtitle: ' + option.unavailableText : '',
      renderStructuralAddOptionEffects(option.effects),
      '',
      option.result
    ].filter((line) => line !== null).join('\n') + '\n';
    return lines;
  }

  function advancedAddBranchChange(field, afterText) {
    const sourceBlock = isObject(field && field.structureSourceBlock) ? field.structureSourceBlock : {};
    if (String(sourceBlock.kind || '') !== 'branch_insert_anchor') {
      return null;
    }
    const source = sourceRef(field && field.source || {});
    const path = String(source.path || '');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    const anchor = String(source.anchorText || '').trim();
    if (!path.startsWith('source/scenes/') || !path.endsWith('.scene.dry') || isProtectedRouterPath(path) ||
      !Number.isInteger(line) || line <= 0 || (Number.isInteger(endLine) && endLine > 0 && endLine !== line) ||
      !anchor) {
      return null;
    }
    const parsed = parseStructuralAddBranch(afterText);
    if (!parsed.ok || structureIdExists(field, parsed.id)) {
      return null;
    }
    const content = renderAddBranchInsert(parsed);
    const change = baseFieldChange(field, '(not present yet)', content);
    change.editability = 'advanced_source_patch';
    change.operationType = 'insert_text';
    change.anchorText = anchor;
    change.position = 'after';
    change.dedupeSearch = '@' + parsed.id;
    return change;
  }

  function parseStructuralAddBranch(value) {
    const rawLines = String(value || '').replace(/\r\n|\r/g, '\n').split('\n');
    while (rawLines.length && !rawLines[0].trim()) {
      rawLines.shift();
    }
    while (rawLines.length && !rawLines[rawLines.length - 1].trim()) {
      rawLines.pop();
    }
    const header = rawLines[0] || '';
    const match = header.match(/^\s*[#@]\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/);
    if (!match) {
      return {ok: false};
    }
    const id = match[1];
    const bodyLines = rawLines.slice(1);
    if (!safeNewBranchBody(bodyLines)) {
      return {ok: false};
    }
    return {
      ok: true,
      id,
      body: bodyLines.join('\n').trim()
    };
  }

  function safeNewBranchBody(lines) {
    const body = ensureArray(lines).join('\n').trim();
    if (!body || body.indexOf('{!') >= 0 || body.indexOf('!}') >= 0 || /\bQ\./.test(body)) {
      return false;
    }
    return !ensureArray(lines).some((line) => {
      const trimmed = String(line || '').trim();
      if (!trimmed) {
        return false;
      }
      return /^[@#]\s*\S+/.test(trimmed) ||
        /^-\s*@/.test(trimmed) ||
        /^(?:title|new-page|tags|view-if|choose-if|go-to|set-root|on-arrival|on-departure|on-display|call|audio|face-image|achievement|priority|max-visits|frequency|unavailable(?:-(?:subtitle|text)|subtitle|text))\s*:/i.test(trimmed);
    });
  }

  function renderAddBranchInsert(branch) {
    return [
      '',
      '',
      '@' + branch.id,
      '',
      branch.body
    ].join('\n') + '\n';
  }

  function guardedOptionEffectChange(field, afterText) {
    const parsed = parseSimpleStructuralEffect(afterText);
    if (!parsed) {
      return null;
    }
    const sourceBlock = isObject(field && field.structureSourceBlock) ? field.structureSourceBlock : {};
    const source = sourceRef(field && field.source || {});
    const path = String(source.path || '');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    const anchor = String(source.anchorText || '').trim();
    if (!path.startsWith('source/scenes/') || !path.endsWith('.scene.dry') || isProtectedRouterPath(path) ||
      !Number.isInteger(line) || line <= 0 || (Number.isInteger(endLine) && endLine > 0 && endLine !== line) || !anchor) {
      return null;
    }
    if (String(sourceBlock.kind || '') === 'section_on_arrival_insert_anchor') {
      const expression = structuralEffectSourceExpression(parsed, {qPrefix: false});
      const nextLine = 'on-arrival: ' + expression;
      const change = baseFieldChange(field, '(not present yet)', nextLine);
      change.editability = 'guarded_apply';
      change.operationType = 'insert_text';
      change.anchorText = anchor;
      change.position = 'after';
      change.dedupeSearch = nextLine;
      return change;
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

  function guardedAddTriggerEffectChange(field, afterText) {
    const sourceBlock = isObject(field && field.structureSourceBlock) ? field.structureSourceBlock : {};
    if (String(sourceBlock.kind || '') === 'root_on_arrival_insert_anchor') {
      const parsed = parseSimpleStructuralEffect(afterText);
      const source = sourceRef(field && field.source || {});
      const path = String(source.path || '');
      const line = Number(source.line || source.startLine || 0);
      const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
      const anchor = String(source.anchorText || '').trim();
      if (!parsed || !path.startsWith('source/scenes/') || !path.endsWith('.scene.dry') ||
        isProtectedRouterPath(path) || !Number.isInteger(line) || line <= 0 ||
        (Number.isInteger(endLine) && endLine > 0 && endLine !== line) || !anchor) {
        return null;
      }
      const expression = structuralEffectSourceExpression(parsed, {qPrefix: false});
      const nextLine = 'on-arrival: ' + expression;
      const change = baseFieldChange(field, '(not present yet)', nextLine);
      change.editability = 'guarded_apply';
      change.operationType = 'insert_text';
      change.anchorText = anchor;
      change.position = 'after';
      change.dedupeSearch = nextLine;
      return change;
    }
    return guardedOptionEffectChange(field, afterText);
  }

  function advancedEffectInsertChange(field, afterText) {
    const parsed = parseSimpleStructuralEffect(afterText);
    if (!parsed || !parsed.condition) {
      return null;
    }
    const sourceBlock = isObject(field && field.structureSourceBlock) ? field.structureSourceBlock : {};
    const opaqueJsInsert = String(sourceBlock.kind || '') === 'opaque_js_insert_anchor';
    const source = sourceRef(field && field.source || {});
    const path = String(source.path || '');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    const anchor = String(source.anchorText || '').trim();
    if (!path.startsWith('source/scenes/') || !path.endsWith('.scene.dry') || isProtectedRouterPath(path) ||
      !Number.isInteger(line) || line <= 0 || (!opaqueJsInsert && Number.isInteger(endLine) && endLine > 0 && endLine !== line) ||
      !(opaqueJsInsert ? /^on-(?:arrival|display)\s*:\s*\{!/i.test(anchor) : looksLikeStandaloneEffectAnchor(anchor))) {
      return null;
    }
    const assignment = 'Q.' + parsed.variable + ' ' + parsed.op + ' ' + parsed.value;
    const condition = structuralEffectConditionToJs(parsed.condition);
    if (!condition) {
      return null;
    }
    const expression = 'if (' + condition + ') { ' + assignment + '; }';
    const change = baseFieldChange(field, '(not present yet)', expression);
    change.editability = 'advanced_source_patch';
    change.operationType = 'insert_text';
    change.anchorText = anchor;
    change.position = 'after';
    change.dedupeSearch = expression;
    return change;
  }

  function structuralEffectConditionToJs(value) {
    const keywords = {
      true: true,
      false: true,
      null: true,
      undefined: true,
      if: true,
      Math: true,
      Q: true
    };
    return String(value || '')
      .trim()
      .replace(/\band\b/gi, '&&')
      .replace(/\bor\b/gi, '||')
      .replace(/\bnot\b/gi, '!')
      .replace(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g, (match, name, offset, text) => {
        const previous = offset > 0 ? text.charAt(offset - 1) : '';
        const next = text.charAt(offset + match.length);
        if (previous === '.' || next === '(' || keywords[name]) {
          return match;
        }
        return 'Q.' + name;
      });
  }

  function guardedRemoveOptionConditionChange(field) {
    const sourceBlock = isObject(field && field.structureSourceBlock) ? field.structureSourceBlock : {};
    if (String(sourceBlock.kind || '') !== 'option_condition_delete') {
      return null;
    }
    const source = sourceRef(field && field.source || {});
    const path = String(source.path || '');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    const anchor = String(source.anchorText || '').trim();
    const condition = String(sourceBlock.condition || field && field.structureBefore || field && field.before || '').trim();
    const before = anchor || (sourceBlock.directive || 'choose-if') + ': ' + condition;
    if (!path.startsWith('source/scenes/') || !path.endsWith('.scene.dry') || isProtectedRouterPath(path) ||
      !Number.isInteger(line) || line <= 0 || (Number.isInteger(endLine) && endLine > 0 && endLine !== line) ||
      !condition || !/^(?:choose-if|view-if)\s*:/i.test(before)) {
      return null;
    }
    const change = baseFieldChange(field, before, '');
    change.editability = field && field.editability === 'advanced_source_patch' ? 'advanced_source_patch' : 'guarded_apply';
    change.operationType = 'replace_text';
    change.allowEmptyReplace = true;
    change.deletesSourceLine = true;
    return change;
  }

  function guardedRemoveEffectChange(field) {
    const source = sourceRef(field && field.source || {});
    const path = String(source.path || '');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    const anchor = String(source.anchorText || '').trim();
    if (!path.startsWith('source/scenes/') || !path.endsWith('.scene.dry') || isProtectedRouterPath(path) ||
      !Number.isInteger(line) || line <= 0 || (Number.isInteger(endLine) && endLine > 0 && endLine !== line) ||
      !anchor || anchor.indexOf('{!') >= 0) {
      return null;
    }
    const removal = removeEffectFromSourceLine(anchor, [
      field && field.structureSourceExpression,
      field && field.structureBefore,
      field && field.original,
      String(field && field.label || '').replace(/^Remove effect:\s*/i, '')
    ]);
    if (!removal.ok || removal.nextLine === anchor) {
      return null;
    }
    const change = baseFieldChange(field, anchor, removal.nextLine);
    change.editability = 'guarded_apply';
    change.operationType = 'replace_text';
    if (!String(removal.nextLine || '').trim()) {
      change.allowEmptyReplace = true;
      change.deletesSourceLine = true;
    }
    return change;
  }

  function guardedRemoveOptionChange(field) {
    const sourceBlock = isObject(field && field.structureSourceBlock) ? field.structureSourceBlock : {};
    if (String(sourceBlock.kind || '') !== 'option_line_delete') {
      return null;
    }
    const source = sourceRef(field && field.source || {});
    const path = String(source.path || '');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || source.line || source.startLine || line || 0);
    const anchor = String(source.anchorText || '').trim();
    if (!path.startsWith('source/scenes/') || !path.endsWith('.scene.dry') || isProtectedRouterPath(path) ||
      !Number.isInteger(line) || line <= 0 || (Number.isInteger(endLine) && endLine > 0 && endLine !== line) ||
      !/^-\s+@[A-Za-z0-9_.-]+/.test(anchor)) {
      return null;
    }
    const change = baseFieldChange(field, anchor, '');
    change.editability = field && field.editability === 'advanced_source_patch' ? 'advanced_source_patch' : 'guarded_apply';
    change.operationType = 'replace_text';
    change.allowEmptyReplace = true;
    change.deletesSourceLine = true;
    return change;
  }

  function advancedRemoveOptionBundleChanges(field) {
    const sourceBlock = isObject(field && field.structureSourceBlock) ? field.structureSourceBlock : {};
    if (String(sourceBlock.kind || '') !== 'option_bundle_delete') {
      return null;
    }
    const optionSource = sourceRef(sourceBlock.optionSource || field && field.source || {});
    const sectionSource = sourceRef(sourceBlock.sectionSource || {});
    const optionAnchor = String(optionSource.anchorText || '').trim();
    const sectionAnchor = String(sectionSource.anchorText || '').trim();
    const sectionEndAnchor = String(sectionSource.endAnchorText || '').trim();
    if (!sourceSupportsAdvancedOptionDelete(optionSource) || !sourceSupportsAdvancedSectionDelete(sectionSource) ||
      optionSource.path !== sectionSource.path || !optionAnchor || !sectionAnchor || !sectionEndAnchor) {
      return null;
    }
    const optionChange = baseFieldChange(Object.assign({}, field, {source: optionSource}), optionAnchor, '');
    optionChange.editability = 'advanced_source_patch';
    optionChange.operationType = 'replace_text';
    optionChange.allowEmptyReplace = true;
    optionChange.deletesSourceLine = true;
    const sectionChange = {
      fieldId: field.id + '__section',
      role: field.role || 'structure',
      label: 'Remove result section: ' + (sourceBlock.targetSectionId || field.sectionId || field.optionId || ''),
      sectionId: sourceBlock.targetSectionId || field.sectionId || '',
      optionId: field.optionId || '',
      source: sectionSource,
      editability: 'advanced_source_patch',
      operationType: 'replace_section',
      anchorText: sectionAnchor,
      endAnchorText: sectionEndAnchor,
      startLine: sectionSource.line || sectionSource.startLine || null,
      endLine: sectionSource.endLine || null,
      dedupeSearch: sectionAnchor,
      allowEmptyReplace: true,
      deletesSourceLine: true,
      before: sectionAnchor + (sectionEndAnchor && sectionEndAnchor !== sectionAnchor ? '\n...\n' + sectionEndAnchor : ''),
      after: ''
    };
    return [optionChange, sectionChange];
  }

  function advancedRemoveLayerChange(field) {
    return existingSceneStructureOperations().advancedRemoveLayerChange(field);
  }

  function advancedRerouteLayerChanges(field, afterText) {
    return existingSceneStructureOperations().advancedRerouteLayerChanges(field, afterText);
  }

  function sourceSupportsAdvancedOptionDelete(sourceInput) {
    return existingSceneStructureOperations().sourceSupportsAdvancedOptionDelete(sourceInput);
  }

  function isSourceOptionLine(anchor) {
    const text = String(anchor || '').trim();
    return Boolean(
      /^-\s+@[A-Za-z0-9_.-]+(?:\s*:|\s*$)/.test(text) ||
      /^-\s+[^:]+:\s*@?[A-Za-z0-9_.-]+\s*$/.test(text) ||
      /^-\s+.+(?:->|=>)\s*@?[A-Za-z0-9_.-]+\s*$/.test(text)
    );
  }

  function sourceSupportsAdvancedSectionDelete(sourceInput) {
    return existingSceneStructureOperations().sourceSupportsAdvancedSectionDelete(sourceInput);
  }

  function removeEffectFromSourceLine(anchor, candidates) {
    const line = String(anchor || '').trim();
    if (!line || /^on-display\s*:/i.test(line) || line.indexOf('{!') >= 0) {
      return {ok: false, nextLine: ''};
    }
    const match = line.match(/^((?:on-arrival|on-departure)\s*:\s*)([\s\S]+)$/i);
    const standalone = !match && looksLikeStandaloneEffectAnchor(line);
    if (!match && !standalone) {
      return {ok: false, nextLine: ''};
    }
    const prefix = match ? match[1] : '';
    const body = match ? match[2] : line;
    const clauses = splitEffectClauses(body);
    if (!clauses.length) {
      return {ok: false, nextLine: ''};
    }
    const normalizedCandidates = uniqueStrings(ensureArray(candidates).map(normalizeEffectClause).filter(Boolean));
    if (!normalizedCandidates.length) {
      return {ok: false, nextLine: ''};
    }
    let removed = 0;
    const remaining = clauses.filter((clause) => {
      const matched = normalizedCandidates.includes(normalizeEffectClause(clause));
      if (matched) {
        removed += 1;
        return false;
      }
      return true;
    });
    if (removed !== 1) {
      return {ok: false, nextLine: ''};
    }
    if (!remaining.length) {
      return {ok: true, nextLine: ''};
    }
    if (match) {
      return {ok: true, nextLine: prefix + remaining.join('; ')};
    }
    return {ok: true, nextLine: remaining.join('; ') + (/\s*;\s*$/.test(line) ? ';' : '')};
  }

  function normalizeEffectClause(value) {
    return String(value || '')
      .replace(/^(?:on-arrival|on-departure)\s*:\s*/i, '')
      .replace(/\bQ\./g, '')
      .replace(/\s*(=|\+=|-=|\*=|\/=)\s*/g, ' $1 ')
      .replace(/\s+/g, ' ')
      .replace(/;+$/g, '')
      .trim();
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
    if (!text || /^on-arrival\s*:/i.test(text) || /^on-departure\s*:/i.test(text) || /^on-display\s*:/i.test(text)) {
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
      operationType: String(field.operationType || ''),
      anchorText: String(field.anchorText || field.source && field.source.anchorText || ''),
      endAnchorText: String(field.endAnchorText || field.source && field.source.endAnchorText || ''),
      rawAnchorText: String(field.rawAnchorText || field.source && field.source.rawAnchorText || ''),
      rawEndAnchorText: String(field.rawEndAnchorText || field.source && field.source.rawEndAnchorText || ''),
      expectedRangeHash: String(field.expectedRangeHash || field.source && field.source.expectedRangeHash || ''),
      position: String(field.position || 'after') === 'before' ? 'before' : 'after',
      dedupeSearch: String(field.dedupeSearch || ''),
      allowEmptyReplace: Boolean(field.allowEmptyReplace),
      deletesSourceLine: Boolean(field.deletesSourceLine),
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
    const normalized = {
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
      rawAnchorText: String(value.rawAnchorText || value.source && value.source.rawAnchorText || ''),
      rawEndAnchorText: String(value.rawEndAnchorText || value.source && value.source.rawEndAnchorText || ''),
      expectedRangeHash: String(value.expectedRangeHash || value.source && value.source.expectedRangeHash || ''),
      position: String(value.position || 'after') === 'before' ? 'before' : 'after',
      startLine: numberOrNull(value.startLine),
      endLine: numberOrNull(value.endLine),
      dedupeSearch: String(value.dedupeSearch || ''),
      allowEmptyReplace: Boolean(value.allowEmptyReplace),
      deletesSourceLine: Boolean(value.deletesSourceLine),
      before: String(value.before === undefined || value.before === null ? '' : value.before),
      after: String(value.after === undefined || value.after === null ? '' : value.after)
    };
    normalized.operationSummary = existingSceneStructureOperations().classifyChange(normalized);
    return normalized;
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
      const operationSummary = change.operationSummary || existingSceneStructureOperations().classifyChange(change);
      if (operationSummary.status === 'manual_review') {
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
    return existingSceneTextBlockBuilder().sourceAnchor(row);
  }

  function sourceEndAnchor(row) {
    return existingSceneTextBlockBuilder().sourceEndAnchor(row);
  }

  function sourceEndLine(source) {
    return existingSceneTextBlockBuilder().sourceEndLine(source);
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
    return existingSceneAssetHelpers().normalizeAssetRef(item);
  }

  function assetType(path) {
    return existingSceneAssetHelpers().assetType(path);
  }

  function fileName(path) {
    return existingSceneAssetHelpers().fileName(path);
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
      endAnchorText: String(value.endAnchorText || '').trim(),
      rawAnchorText: String(value.rawAnchorText || ''),
      rawEndAnchorText: String(value.rawEndAnchorText || ''),
      expectedRangeHash: String(value.expectedRangeHash || '')
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

  function assetEditableFields(scene, sceneSourcePath, options) {
    return existingSceneAssetHelpers().assetEditableFields(scene, sceneSourcePath, options);
  }

  function assetAddReferenceFields(scene, sceneSourcePath, existingFields, textRows, sceneKind, options) {
    const target = String(sceneKind || '') === 'card' ? 'card' : 'event';
    const existingRoles = new Set(ensureArray(scene && scene.assetRefs)
      .filter((asset) => isGlobalExistingAssetRef(asset, scene))
      .filter((asset) => !isInlineExistingAssetRef(asset))
      .map((asset) => assetRoleForExistingAsset(asset, target))
      .filter(Boolean));
    const slots = target === 'card'
      ? [
        {role: 'card_image', directive: 'card-image', label: 'Add card image', type: 'image'},
        {role: 'card_portrait', directive: 'face-image', label: 'Add card portrait', type: 'image'},
        {role: 'card_background', directive: 'set-bg', label: 'Add card background', type: 'image'},
        {role: 'card_music', directive: 'set-music', label: 'Add card music', type: 'audio'},
        {role: 'card_audio', directive: 'audio', label: 'Add card audio', type: 'audio'}
      ]
      : [
        {role: 'event_illustration', directive: 'face-image', label: 'Add event illustration', type: 'image'},
        {role: 'event_portrait', directive: 'face-image', label: 'Add event portrait', type: 'image'},
        {role: 'event_background', directive: 'set-bg', label: 'Add event background', type: 'image'},
        {role: 'event_music', directive: 'set-music', label: 'Add event music', type: 'audio'},
        {role: 'event_audio', directive: 'audio', label: 'Add event audio', type: 'audio'}
      ];
    const globalFields = slots.filter((slot) => !existingRoles.has(slot.role)).map((slot) => {
      const anchor = assetInsertAnchorForSlot(slot, existingFields, textRows, options && options.textBlocks);
      if (!anchor || !anchor.source || !anchor.source.path || !anchor.anchorText) {
        return null;
      }
      const source = Object.assign({}, sourceRef(anchor.source), {
        anchorText: anchor.anchorText,
        endAnchorText: anchor.anchorText
      });
      return {
        id: safeId(['asset_add', slot.role].join('_')),
        role: 'asset_reference',
        label: slot.label,
        original: '',
        value: '',
        source,
        sourcePath: source.path || sceneSourcePath || '',
        editability: 'guarded_apply',
        operationType: 'insert_text',
        transform: 'asset_add_reference',
        anchorText: anchor.anchorText,
        position: 'after',
        dedupeSearch: '',
        assetDirective: slot.directive,
        assetRole: slot.role,
        assetType: slot.type,
        placementKind: slot.directive === 'inline-image' ? 'opening_visual' : 'global_slot',
        displayLocation: slot.directive === 'inline-image' ? 'Opening visual' : 'Global media slot',
        owner: {
          sceneId: String(scene && scene.id || ''),
          sectionId: '',
          itemId: '',
          kind: 'asset_reference'
        },
        sectionId: '',
        optionId: '',
        confidence: 'source_anchor',
        reason: 'Source-backed anchor can be checked before inserting a new asset reference.'
      };
    }).filter(Boolean);
    return globalFields.concat(flowAssetAddReferenceFields(scene, sceneSourcePath, options));
  }

  function isGlobalExistingAssetRef(asset, scene) {
    const source = sourceRef(asset && asset.source || {});
    if (!source.path || !source.line) {
      return true;
    }
    return !ensureArray(scene && scene.sections).some((section) => sourceWithin(source, section && section.sourceSpan || section && section.source || {}));
  }

  function isInlineExistingAssetRef(asset) {
    const directive = normalizeAssetDirective(asset && (asset.directive || asset.assetDirective || asset.role));
    return directive === 'inline-image' || directive === 'inline-asset';
  }

  function flowAssetAddReferenceFields(scene, sceneSourcePath, options) {
    const opts = options || {};
    return ensureArray(opts.textBlocks).map((block, index) => {
      const source = insertionSourceForTextBlock(block);
      if (!source.path || !source.line || !source.anchorText) {
        return null;
      }
      const placementKind = placementKindForTextBlock(block);
      const optionId = ensureArray(block && block.relatedOptionIds).map(String).filter(Boolean)[0] || '';
      const sectionId = String(block && block.sectionId || '');
      return {
        id: safeId(['asset_add_flow', optionId || sectionId || index + 1].join('_')),
        role: 'asset_reference',
        label: flowAssetAddLabel(placementKind),
        original: '',
        value: '',
        source: Object.assign({}, source, {
          path: source.path || sceneSourcePath || '',
          anchorText: source.anchorText,
          endAnchorText: source.anchorText
        }),
        sourcePath: source.path || sceneSourcePath || '',
        editability: 'guarded_apply',
        operationType: 'insert_text',
        transform: 'asset_add_reference',
        anchorText: source.anchorText,
        position: 'before',
        dedupeSearch: '',
        assetDirective: 'face-image',
        assetRole: 'event_illustration',
        assetType: 'image',
        placementKind,
        displayLocation: String(block && block.label || sectionId || optionId || 'Flow visual'),
        owner: {
          sceneId: String(scene && scene.id || ''),
          sectionId,
          itemId: optionId,
          kind: 'asset_reference'
        },
        sectionId,
        optionId,
        confidence: 'source_anchor',
        reason: 'Source-backed text block anchor can be checked before inserting a flow-positioned image reference.'
      };
    }).filter(Boolean);
  }

  function insertionSourceForTextBlock(block) {
    const source = sourceRef(block && block.source || {});
    source.endLine = source.line;
    return source;
  }

  function placementKindForTextBlock(block) {
    const role = String(block && block.semanticRole || '');
    const branchKind = String(block && block.branchKind || '');
    if (role === 'option_result_text') {
      return 'option_result_visual';
    }
    if (role === 'conditional_option_result_text' || role === 'conditional_text' || ensureArray(block && block.conditions).length) {
      return 'conditional_visual';
    }
    if (branchKind === 'menu' || ensureArray(block && block.ownedOptionIds).length) {
      return 'menu_visual';
    }
    if (role === 'opening_text') {
      return 'opening_visual';
    }
    return 'section_visual';
  }

  function flowAssetAddLabel(kind) {
    if (kind === 'option_result_visual') {
      return 'Add image to option result';
    }
    if (kind === 'conditional_visual') {
      return 'Add image to conditional branch';
    }
    if (kind === 'menu_visual') {
      return 'Add image to menu branch';
    }
    if (kind === 'opening_visual') {
      return 'Add opening image';
    }
    return 'Add image here';
  }

  function sourceWithin(source, range) {
    if (!source || !range || !sameSourcePath(source, range)) {
      return false;
    }
    const line = Number(source.line || source.startLine || 0);
    const start = Number(range.startLine || range.line || 0);
    const end = Number(range.endLine || range.line || start || 0);
    return Boolean(line && start && end && line >= start && line <= end);
  }

  function sameSourcePath(a, b) {
    return String(a && a.path || '') === String(b && b.path || '');
  }

  function assetRoleForExistingAsset(asset, target) {
    const directive = normalizeAssetDirective(asset && (asset.directive || asset.assetDirective || asset.role));
    if (directive === 'card-image') {
      return 'card_image';
    }
    if (directive === 'face-image') {
      return target === 'card' ? 'card_portrait' : 'event_portrait';
    }
    if (directive === 'set-bg') {
      return target === 'card' ? 'card_background' : 'event_background';
    }
    if (directive === 'set-music') {
      return target === 'card' ? 'card_music' : 'event_music';
    }
    if (directive === 'audio') {
      return target === 'card' ? 'card_audio' : 'event_audio';
    }
    if (directive === 'inline-image' || directive === 'inline-asset') {
      return target === 'card' ? 'card_image' : 'event_illustration';
    }
    const role = String(asset && asset.role || '').trim();
    if (role) {
      return role;
    }
    return String(asset && asset.type || '') === 'audio'
      ? (target === 'card' ? 'card_audio' : 'event_audio')
      : (target === 'card' ? 'card_image' : 'event_illustration');
  }

  function assetInsertAnchorForSlot(slot, existingFields, textRows, textBlocks) {
    if (slot && slot.directive === 'inline-image') {
      const textAnchor = ensureArray(textBlocks).find((block) => {
        const source = sourceRef(block && block.source || {});
        return source.path && source.line && String(block && (block.value || block.text) || '').trim() && String(block && block.semanticRole || '') === 'opening_text';
      }) || ensureArray(textBlocks).find((block) => {
        const source = sourceRef(block && block.source || {});
        return source.path && source.line && String(block && (block.value || block.text) || '').trim();
      }) || ensureArray(textRows).find((row) => {
        const source = sourceRef(row && row.source || {});
        return source.path && source.line && String(row && (row.text || row.value) || '').trim();
      });
      if (textAnchor) {
        const source = sourceRef(textAnchor.source || {});
        return {source, anchorText: source.anchorText || String(textAnchor.text || textAnchor.value || '').trim()};
      }
    }
    const fields = ensureArray(existingFields).filter((field) => {
      const source = sourceRef(field && field.source || {});
      return source.path && source.line && String(field && field.original || '').trim();
    }).sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
    const firstTextLine = ensureArray(textRows).reduce((line, row) => {
      const next = sourceLine(row && row.source);
      return next > 0 ? Math.min(line, next) : line;
    }, Number.POSITIVE_INFINITY);
    const globalFields = fields.filter(isGlobalInsertAnchorField);
    const beforeBodyFields = Number.isFinite(firstTextLine)
      ? globalFields.filter((field) => sourceLine(field && field.source) > 0 && sourceLine(field && field.source) < firstTextLine)
      : globalFields;
    const assetAnchor = beforeBodyFields.filter((field) => String(field && field.role || '') === 'asset_reference').pop();
    const metadataAnchor = beforeBodyFields.filter((field) => ['title', 'metadata', 'condition'].includes(String(field && field.role || ''))).pop() ||
      globalFields[0] ||
      fields.find((field) => String(field && field.role || '') === 'title') ||
      fields[0];
    const anchor = assetAnchor || metadataAnchor;
    if (!anchor) {
      return null;
    }
    const source = sourceRef(anchor.source || {});
    return {source, anchorText: source.anchorText || String(anchor.original || '').trim()};
  }

  function isGlobalInsertAnchorField(field) {
    if (!field) {
      return false;
    }
    if (String(field.sectionId || '').trim() || String(field.optionId || '').trim()) {
      return false;
    }
    const owner = field.owner || {};
    return !String(owner.sectionId || '').trim() && !String(owner.itemId || '').trim();
  }

  function normalizeOpaqueJsBlock(block) {
    const value = isObject(block) ? block : {};
    const source = sourceRef(value.source || {});
    const preview = String(value.rawPreview || value.text || value.rawText || '').trim();
    if (!source.path && !preview) {
      return null;
    }
    return {
      id: String(value.id || 'opaque_js_' + (source.line || 'block')),
      label: String(value.label || (value.hook ? value.hook + ' JS block' : 'JS block')),
      scriptKind: 'opaque_js',
      hook: String(value.hook || ''),
      text: preview,
      rawPreview: preview,
      lineCount: Number(value.lineCount || 0) || null,
      reads: ensureArray(value.reads).map((item) => String(item || '')).filter(Boolean),
      writes: ensureArray(value.writes).map((item) => String(item || '')).filter(Boolean),
      dynamicKeyWrites: ensureArray(value.dynamicKeyWrites).map((item) => String(item || '')).filter(Boolean),
      source,
      reviewBoundary: String(value.reviewBoundary || 'manual_review'),
      confidence: String(value.confidence || 'opaque')
    };
  }

  function normalizeAssetDirective(value) {
    return existingSceneAssetHelpers().normalizeAssetDirective(value);
  }

  function assetDirectiveLabel(directive) {
    return existingSceneAssetHelpers().assetDirectiveLabel(directive);
  }

  function normalizeAssetInstallRequest(input) {
    return existingSceneAssetHelpers().normalizeAssetInstallRequest(input);
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
      (String(value.after || '').trim() || value.allowEmptyReplace)
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
