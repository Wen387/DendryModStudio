(function initProjectMapVariableEditorDraft(global) {
  'use strict';

  const VARIABLE_EDITOR_VERSION = '0.1';
  const VARIABLE_EDITOR_KIND = 'variable_editor';
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const VALUE_TYPES = new Set(['number', 'boolean', 'string']);
  const TEXT = {
    en: {
      title: 'Variable Editor',
      addNew: 'Add new variable',
      editExisting: 'Edit existing variable',
      deleteExisting: 'Delete existing variable',
      name: 'Variable',
      label: 'Label',
      initial: 'Initial value',
      description: 'Description',
      rootInit: 'Root initialization',
      postEventInit: 'Post-event compatibility initialization',
      qualityFile: 'Quality file',
      noSource: 'No source-backed definition was found in this ProjectIndex.',
      installHeader: 'Install Assistant: proposal only / not installed',
      generatedOperations: 'Generated operations:',
      safety: 'Safety:',
      safetyRoot: '- New variable initialization can be inserted only after the root anchor still matches.',
      safetyExisting: '- Source-backed existing variable initializers create guarded or advanced install operations; reads/writes stay as impact preview.',
      safetyDelete: '- Variable deletion is manual-review only; every read, write, and definition must be checked first.',
      safetyQuality: '- Quality files are generated for manual review because project conventions vary.',
      manualExisting: 'No source-backed initializer was found for this existing variable.',
      manualDelete: 'Review every source-backed definition and consumer before deleting this variable.',
      noop: 'No variable change was generated.'
    },
    'zh-Hant': {
      title: '變數編輯器',
      addNew: '新增變數',
      editExisting: '編輯既有變數',
      deleteExisting: '刪除既有變數',
      name: '變數',
      label: '標籤',
      initial: '初始值',
      description: '說明',
      rootInit: 'Root 初始化',
      postEventInit: 'post_event 相容初始化',
      qualityFile: 'quality 檔',
      noSource: '這份 ProjectIndex 沒有找到 source-backed 定義位置。',
      installHeader: '安裝助手：僅提案 / 尚未安裝',
      generatedOperations: '產生的操作：',
      safety: '安全性：',
      safetyRoot: '- 新變數初始化只有在 root anchor 仍可精確比對時才會插入。',
      safetyExisting: '- source-backed 既有變數初始化會產生受控或進階安裝操作；讀取 / 寫入只作影響預覽。',
      safetyDelete: '- 刪除變數只會產生手動審查；必須先檢查所有讀取、寫入與定義。',
      safetyQuality: '- quality 檔因專案慣例差異，先產生為手動審查內容。',
      manualExisting: '這個既有變數沒有找到 source-backed 初始化位置。',
      manualDelete: '刪除這個變數前，請先審查所有 source-backed 定義與消費處。',
      noop: '沒有產生變數變更。'
    }
  };

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
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

  function buildVariableModel(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const variables = ensureArray(index.variables).map(normalizeVariable).filter((item) => item.name);
    return {
      schemaVersion: VARIABLE_EDITOR_VERSION,
      kind: 'variable_editor_model',
      project: projectProvenance(index),
      variables,
      variableNames: variables.map((item) => item.name)
    };
  }

  function buildVariableConsumerModel(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const model = buildVariableModel(index);
    const lookup = buildConsumerLookup(index);
    const variables = model.variables.map((variable) => {
      const consumers = variableConsumers(variable, lookup);
      return Object.assign({}, variable, {
        consumers,
        consumerSummary: summarizeConsumers(consumers)
      });
    });
    return {
      schemaVersion: VARIABLE_EDITOR_VERSION,
      kind: 'variable_consumer_model',
      project: model.project,
      variables,
      variableNames: variables.map((item) => item.name)
    };
  }

  function normalizeVariable(variable) {
    const value = isObject(variable) ? variable : {};
    return {
      name: String(value.name || '').trim(),
      scope: String(value.scope || 'q').trim(),
      confidence: String(value.confidence || 'static_inferred').trim(),
      tags: ensureArray(value.tags).map(String),
      reads: ensureArray(value.reads).map(normalizeSourceRef),
      writes: ensureArray(value.writes).map(normalizeSourceRef),
      definedIn: ensureArray(value.definedIn).map(normalizeSourceRef),
      readCount: Number(value.readCount || ensureArray(value.reads).length || 0),
      writeCount: Number(value.writeCount || ensureArray(value.writes).length || 0)
    };
  }

  function normalizeSourceRef(ref) {
    const value = isObject(ref) ? ref : {};
    return {
      path: String(value.path || value.sourcePath || '').trim(),
      line: numberOrNull(value.line || value.startLine || value.$line),
      text: String(value.text || value.anchorText || value.excerpt || '').trim()
    };
  }

  function buildConsumerLookup(index) {
    const semantic = isObject(index.semantic) ? index.semantic : {};
    const scenes = ensureArray(index.scenes);
    const events = new Set(ensureArray(semantic.events).map((item) => String(item && item.id || '')).filter(Boolean));
    const cards = new Set(ensureArray(semantic.cards).map((item) => String(item && item.id || '')).filter(Boolean));
    const scenesByPath = new Map();
    scenes.forEach((scene) => {
      const path = normalizePath(scene && (scene.path || scene.sourcePath || scene.sourceSpan && scene.sourceSpan.path) || '');
      if (path) {
        scenesByPath.set(path, scene);
      }
    });
    return {index, semantic, scenesByPath, events, cards};
  }

  function variableConsumers(variable, lookup) {
    const rows = [];
    ensureArray(variable.definedIn).forEach((ref) => rows.push(consumerRow(variable, ref, 'definition', lookup)));
    ensureArray(variable.reads).forEach((ref) => rows.push(consumerRow(variable, ref, 'read', lookup)));
    ensureArray(variable.writes).forEach((ref) => rows.push(consumerRow(variable, ref, 'write', lookup)));
    return rows
      .filter((row) => row.source.path)
      .sort((left, right) => {
        return compareText(left.source.path, right.source.path) ||
          compareNumber(left.source.line || 0, right.source.line || 0) ||
          compareText(left.accessType, right.accessType);
      });
  }

  function consumerRow(variable, ref, accessType, lookup) {
    const source = normalizeSourceRef(ref);
    const scene = lookup.scenesByPath.get(normalizePath(source.path)) || null;
    const sceneId = String(scene && scene.id || '');
    const area = variableAreaForSource(source.path, scene, sceneId, lookup);
    return {
      variableName: variable.name,
      accessType,
      area,
      source,
      owner: {
        kind: area,
        sceneId,
        title: String(scene && (scene.title || scene.id) || ''),
        path: source.path
      },
      label: consumerLabel(area, accessType, scene, source)
    };
  }

  function variableAreaForSource(path, scene, sceneId, lookup) {
    const rel = normalizePath(path);
    if (rel === 'source/info.dry' || rel === 'source/scenes/root.scene.dry' || rel.startsWith('source/qdisplays/') || rel.startsWith('source/scenes/status')) {
      return 'system_ui';
    }
    if (rel === 'source/scenes/post_event.scene.dry' || rel === 'source/scenes/post_event_news.scene.dry' || rel.includes('/post_event')) {
      return 'news_router';
    }
    if (sceneId && lookup.cards.has(sceneId)) {
      return 'card';
    }
    if (sceneId && lookup.events.has(sceneId)) {
      return 'event';
    }
    const tags = ensureArray(scene && scene.tags).map(String);
    if (tags.includes('card') || tags.includes('advisor') || tags.includes('deck') || rel.includes('/cards/') || rel.includes('/advisors/')) {
      return 'card';
    }
    if (rel.startsWith('source/scenes/')) {
      return 'event';
    }
    return 'source';
  }

  function consumerLabel(area, accessType, scene, source) {
    const owner = scene && (scene.title || scene.id) || source.path || area;
    return accessType + ' in ' + owner;
  }

  function summarizeConsumers(consumers) {
    const byArea = {};
    const byAccess = {};
    ensureArray(consumers).forEach((row) => {
      byArea[row.area] = (byArea[row.area] || 0) + 1;
      byAccess[row.accessType] = (byAccess[row.accessType] || 0) + 1;
    });
    return {
      total: ensureArray(consumers).length,
      byArea,
      byAccess
    };
  }

  function normalizePath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
  }

  function compareText(left, right) {
    return String(left || '').localeCompare(String(right || ''));
  }

  function compareNumber(left, right) {
    return Number(left || 0) - Number(right || 0);
  }

  function defaultDraft(projectIndex) {
    const model = buildVariableModel(projectIndex);
    const variableName = uniqueVariableName(projectIndex, 'new_variable');
    return normalizeDraft({
      id: variableName,
      title: 'New Variable',
      mode: 'add_new',
      variableName,
      label: labelFromName(variableName),
      initialValue: '0',
      valueType: 'number',
      description: '',
      includeRootInit: true,
      includePostEventInit: false,
      includeQualityFile: true,
      evidence: model
    });
  }

  function draftFromVariable(variable, projectIndex) {
    const item = normalizeVariable(variable || {});
    const initial = initialValueFromVariable(item);
    return normalizeDraft({
      id: item.name ? 'edit_' + safeId(item.name) : 'edit_variable',
      title: item.name ? 'Edit ' + item.name : 'Edit Variable',
      mode: 'edit_existing',
      variableName: item.name,
      label: labelFromName(item.name),
      initialValue: initial,
      valueType: 'number',
      description: '',
      includeRootInit: false,
      includePostEventInit: false,
      includeQualityFile: false,
      evidence: buildVariableModel(projectIndex)
    });
  }

  function deleteDraftFromVariable(variable, projectIndex) {
    const item = normalizeVariable(variable || {});
    return normalizeDraft({
      id: item.name ? 'delete_' + safeId(item.name) : 'delete_variable',
      title: item.name ? 'Delete ' + item.name : 'Delete Variable',
      mode: 'delete_existing',
      variableName: item.name,
      label: labelFromName(item.name),
      initialValue: '',
      valueType: 'number',
      description: '',
      includeRootInit: false,
      includePostEventInit: false,
      includeQualityFile: false,
      evidence: buildVariableModel(projectIndex)
    });
  }

  function normalizeDraft(input) {
    const draft = isObject(input) ? clone(input) : {};
    draft.schemaVersion = String(draft.schemaVersion || VARIABLE_EDITOR_VERSION);
    draft.kind = VARIABLE_EDITOR_KIND;
    draft.id = safeId(draft.id || draft.variableName || 'variable_editor');
    draft.title = singleLine(draft.title || 'Variable Editor');
    const mode = String(draft.mode || '').trim();
    draft.mode = mode === 'delete_existing' ? 'delete_existing' : mode === 'edit_existing' ? 'edit_existing' : 'add_new';
    draft.variableName = safeVariableName(draft.variableName || draft.name || 'new_variable');
    draft.label = singleLine(draft.label || labelFromName(draft.variableName));
    draft.initialValue = singleLine(draft.initialValue === undefined ? draft.value : draft.initialValue);
    draft.valueType = VALUE_TYPES.has(String(draft.valueType || 'number')) ? String(draft.valueType || 'number') : 'number';
    draft.description = String(draft.description || '').trim();
    draft.includeRootInit = draft.mode === 'delete_existing' ? false : draft.includeRootInit !== false;
    draft.includePostEventInit = draft.mode === 'delete_existing' ? false : draft.includePostEventInit === true;
    draft.includeQualityFile = draft.mode === 'delete_existing' ? false : draft.includeQualityFile !== false;
    draft.evidence = isObject(draft.evidence) ? draft.evidence : {};
    return draft;
  }

  function validateDraft(input, projectIndex) {
    const draft = normalizeDraft(input);
    const diagnostics = [];
    if (!ID_RE.test(draft.id)) {
      diagnostic(diagnostics, 'error', 'variable_editor.id', 'Variable draft id must be file-safe.');
    }
    if (!NAME_RE.test(draft.variableName)) {
      diagnostic(diagnostics, 'error', 'variable_editor.name', 'Variable name must be a valid Q identifier.');
    }
    if (draft.valueType === 'number' && draft.initialValue && !Number.isFinite(Number(draft.initialValue))) {
      diagnostic(diagnostics, 'error', 'variable_editor.value', 'Number variables need a numeric initial value.');
    }
    if (draft.mode === 'add_new' && findVariable(projectIndex, draft.variableName)) {
      diagnostic(diagnostics, 'error', 'variable_editor.duplicate', 'Add-new mode cannot target an existing ProjectIndex variable. Switch to edit existing or choose a new variable name.');
    }
    if (draft.mode === 'edit_existing' && !findVariable(projectIndex, draft.variableName)) {
      diagnostic(diagnostics, 'warning', 'variable_editor.missing_existing', 'This variable was not found in the current ProjectIndex.');
    }
    if (draft.mode === 'delete_existing' && !findVariable(projectIndex, draft.variableName)) {
      diagnostic(diagnostics, 'warning', 'variable_editor.missing_delete_target', 'This variable was not found in the current ProjectIndex.');
    }
    return {ok: diagnostics.every((item) => item.severity !== 'error'), draft, diagnostics};
  }

  function buildExportBundle(input, projectIndex, options) {
    const validation = validateDraft(input, projectIndex);
    const draft = validation.draft;
    const plan = buildInstallPlan(draft, projectIndex);
    const installApi = installPlanApi();
    const installPlanJson = installApi.renderInstallPlanJson(plan);
    const patchPreview = installApi.renderPatchPreview(plan);
    const installChecklist = installApi.renderOperationChecklist(plan, options);
    const draftJson = JSON.stringify(draft, null, 2) + '\n';
    const playerPreview = renderPlayerPreview(draft, projectIndex, options);
    const qualityFile = renderQualityFile(draft);
    const installNotes = renderInstallNotes(draft, plan, options);
    return {
      ok: validation.ok,
      draft,
      diagnostics: validation.diagnostics,
      files: [
        {path: draft.id + '.variable-draft.json', content: draftJson, kind: 'draft'},
        {path: draft.id + '.preview.txt', content: playerPreview, kind: 'preview'},
        {path: draft.id + '.quality.dry', content: qualityFile, kind: 'quality'},
        {path: draft.id + '.install-plan.json', content: installPlanJson, kind: 'install_plan'},
        {path: draft.id + '.patch-preview.diff', content: patchPreview, kind: 'patch_preview'},
        {path: draft.id + '.install-notes.txt', content: installNotes, kind: 'notes'}
      ],
      playerPreview,
      previewText: playerPreview,
      draftJson,
      qualityFile,
      installPlan: plan,
      installPlanJson,
      patchPreview,
      installChecklist,
      installNotes
    };
  }

  function buildInstallPlan(input, projectIndex) {
    const installApi = installPlanApi();
    const validation = validateDraft(input, projectIndex);
    const draft = validation.draft;
    const errors = validation.diagnostics.filter((item) => item.severity === 'error');
    const operations = [];
    if (errors.length) {
      operations.push({
        id: 'variable_editor_validation_manual',
        type: 'manual_snippet',
        path: 'source/scenes/root.scene.dry',
        content: errors.map((item) => item.message).join('\n') + '\n',
        safety: 'manual_review',
        role: 'variable_editor',
        description: 'Fix variable validation errors before applying variable changes.'
      });
    } else if (draft.mode === 'add_new') {
      if (draft.includeRootInit) {
        operations.push({
          id: 'variable_root_init',
          type: 'insert_text',
          path: 'source/scenes/root.scene.dry',
          anchorText: '// ====== U. EVENT SEEN FLAGS ======',
          position: 'before',
          content: rootInitSnippet(draft),
          dedupeSearch: 'Q.' + draft.variableName + ' === undefined',
          safety: 'guarded_apply',
          role: 'variable.root_init',
          description: 'Insert a Q variable initialization before the known root event flag anchor.'
        });
      }
      if (draft.includePostEventInit) {
        operations.push({
          id: 'variable_post_event_init',
          type: 'manual_snippet',
          path: 'source/scenes/post_event.scene.dry',
          content: rootInitSnippet(draft),
          safety: 'manual_review',
          role: 'variable.post_event_init',
          description: 'Review whether post_event needs the same old-save compatibility initialization.'
        });
      }
      if (draft.includeQualityFile) {
        operations.push({
          id: 'variable_quality_file',
          type: 'manual_snippet',
          path: qualityPath(draft),
          content: renderQualityFile(draft),
          safety: 'manual_review',
          role: 'variable.quality_file',
          description: 'Review and add this quality file if the project tracks this variable as a Dendry quality.'
        });
      }
    } else if (draft.mode === 'delete_existing') {
      const existing = findVariable(projectIndex, draft.variableName);
      operations.push({
        id: 'variable_delete_review',
        type: 'manual_snippet',
        path: existingSourcePath(existing) || 'source/scenes/root.scene.dry',
        content: deleteVariableNotes(draft, existing, projectIndex),
        safety: 'manual_review',
        role: 'variable.delete_review',
        description: 'Review every variable definition and consumer before deleting this Q variable.'
      });
    } else {
      const existing = findVariable(projectIndex, draft.variableName);
      const operation = existingVariableEditOperation(draft, existing);
      operations.push(operation || {
        id: 'variable_existing_mapping_bug',
        type: 'manual_snippet',
        path: existingSourcePath(existing) || 'source/scenes/root.scene.dry',
        content: existingVariableNotes(draft, existing),
        safety: 'manual_review',
        role: 'variable.existing_mapping_bug',
        description: 'No source-backed variable initializer could be mapped to an installable operation.'
      });
    }
    if (!operations.length) {
      operations.push({
        id: 'variable_editor_noop',
        type: 'manual_snippet',
        path: 'source/scenes/root.scene.dry',
        content: text(optionsFromLocale(), 'noop') + '\n',
        safety: 'manual_review',
        role: 'variable_editor',
        description: 'No installable variable change was generated.'
      });
    }
    return installApi.buildInstallPlan({
      id: draft.id,
      draftKind: VARIABLE_EDITOR_KIND,
      title: draft.title || draft.id,
      project: installApi.projectProvenanceFromIndex ? installApi.projectProvenanceFromIndex(projectIndex) : null,
      operations
    });
  }

  function renderPlayerPreview(draftInput, projectIndex, options) {
    const draft = normalizeDraft(draftInput);
    const existing = findVariable(projectIndex, draft.variableName);
    const rows = [
      text(options, 'title'),
      text(options, 'name') + ': Q.' + draft.variableName,
      text(options, 'label') + ': ' + draft.label,
      text(options, 'initial') + ': ' + displayInitialValue(draft),
      text(options, 'description') + ': ' + (draft.description || '-'),
      '',
      modeLabel(draft, options)
    ];
    if (existing) {
      rows.push('reads: ' + existing.readCount + ' / writes: ' + existing.writeCount);
      const source = firstSource(existing);
      rows.push('source: ' + (source ? sourceLabel(source) : text(options, 'noSource')));
    }
    if (draft.includeRootInit) {
      rows.push('', text(options, 'rootInit') + ':', rootInitSnippet(draft).trim());
    }
    if (draft.includeQualityFile) {
      rows.push('', text(options, 'qualityFile') + ':', qualityPath(draft));
    }
    return rows.join('\n') + '\n';
  }

  function renderInstallNotes(draftInput, plan, options) {
    const draft = normalizeDraft(draftInput);
    return [
      text(options, 'installHeader'),
      '',
      text(options, 'name') + ': Q.' + draft.variableName,
      '',
      text(options, 'generatedOperations'),
      (plan.operations || []).map((op) => '- ' + op.type + ' ' + op.path + ' (' + op.safety + ')').join('\n') || '- none',
      '',
      text(options, 'safety'),
      text(options, 'safetyRoot'),
      text(options, 'safetyExisting'),
      text(options, 'safetyDelete'),
      text(options, 'safetyQuality')
    ].join('\n') + '\n';
  }

  function modeLabel(draft, options) {
    if (draft.mode === 'delete_existing') {
      return text(options, 'deleteExisting');
    }
    return draft.mode === 'add_new' ? text(options, 'addNew') : text(options, 'editExisting');
  }

  function renderQualityFile(input) {
    const draft = normalizeDraft(input);
    const lines = [
      'name: ' + (draft.label || labelFromName(draft.variableName)),
      'initial: ' + literalValue(draft),
      draft.valueType === 'number' ? 'min: 0' : '',
      '',
      draft.description || ('Studio variable helper for Q.' + draft.variableName + '.')
    ].filter((line, index) => line || index === 3);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
  }

  function rootInitSnippet(draftInput) {
    const draft = normalizeDraft(draftInput);
    return 'if (Q.' + draft.variableName + ' === undefined) { Q.' + draft.variableName + ' = ' + literalValue(draft) + '; }\n';
  }

  function existingVariableNotes(draft, existing) {
    const rows = [
      text(optionsFromLocale(), 'manualExisting'),
      '',
      'Q.' + draft.variableName,
      draft.label ? 'label: ' + draft.label : '',
      draft.description ? 'description: ' + draft.description : ''
    ].filter(Boolean);
    if (existing) {
      ensureArray(existing.definedIn).concat(ensureArray(existing.writes)).slice(0, 8).forEach((source) => {
        rows.push('- ' + sourceLabel(source));
      });
    }
    return rows.join('\n') + '\n';
  }

  function existingVariableEditOperation(draftInput, existing) {
    const draft = normalizeDraft(draftInput);
    const source = editableVariableSource(existing);
    const before = String(source && source.text || '').trim();
    const after = replaceVariableInitialValue(before, draft.variableName, literalValue(draft));
    if (!source || !source.path || !source.line || !before || !after || before === after) {
      return null;
    }
    return {
      id: 'variable_existing_init',
      type: 'replace_text',
      path: source.path,
      line: source.line,
      search: before,
      replace: after,
      safety: safetyForVariableSource(source.path),
      role: 'variable.existing_init',
      description: 'Replace source-backed Q.' + draft.variableName + ' initialization after showing read/write impact.'
    };
  }

  function editableVariableSource(variable) {
    const refs = ensureArray(variable && variable.definedIn)
      .concat(ensureArray(variable && variable.writes))
      .map(normalizeSourceRef)
      .filter((source) => source.path && source.line);
    return refs.find((source) => source.text && /Q\.[A-Za-z_][A-Za-z0-9_]*\s*=/.test(source.text)) ||
      refs.find((source) => source.text) ||
      null;
  }

  function replaceVariableInitialValue(sourceText, variableName, literal) {
    const name = String(variableName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const text = String(sourceText || '').trim();
    const value = String(literal || '0').trim();
    if (!name || !text || !value) {
      return '';
    }
    const pattern = new RegExp('(Q\\.' + name + '\\s*=(?!=)\\s*)([^;\\}\\n]+)');
    if (!pattern.test(text)) {
      return '';
    }
    return text.replace(pattern, '$1' + value);
  }

  function initialValueFromVariable(variable) {
    const source = editableVariableSource(variable);
    const text = String(source && source.text || '').trim();
    const name = String(variable && variable.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!text || !name) {
      return '';
    }
    const match = new RegExp('Q\\.' + name + '\\s*=(?!=)\\s*([^;\\}\\n]+)').exec(text);
    return match ? String(match[1] || '').trim() : '';
  }

  function safetyForVariableSource(path) {
    const rel = normalizePath(path);
    if (rel === 'source/scenes/root.scene.dry' ||
      rel === 'source/scenes/post_event.scene.dry' ||
      rel === 'source/scenes/post_event_news.scene.dry' ||
      rel === 'source/info.dry') {
      return 'advanced_apply';
    }
    return 'guarded_apply';
  }

  function deleteVariableNotes(draft, existing, projectIndex) {
    const rows = [
      text(optionsFromLocale(), 'manualDelete'),
      '',
      'Q.' + draft.variableName,
      draft.label ? 'label: ' + draft.label : '',
      '',
      'Checklist:',
      '- Remove or replace the definition only after every reader has a fallback.',
      '- Remove writes only after every route and effect has been reviewed.',
      '- Remove quality metadata only if the project tracks this variable as a quality.',
      ''
    ].filter(Boolean);
    if (existing) {
      rows.push('Definitions and writes:');
      ensureArray(existing.definedIn).concat(ensureArray(existing.writes)).slice(0, 12).forEach((source) => {
        rows.push('- ' + sourceLabel(source));
      });
      rows.push('', 'Reads:');
      ensureArray(existing.reads).slice(0, 12).forEach((source) => {
        rows.push('- ' + sourceLabel(source));
      });
      const consumers = variableConsumerRows(existing, projectIndex);
      if (consumers.length) {
        rows.push('', 'Consumer map:');
        consumers.slice(0, 12).forEach((consumer) => {
          rows.push('- ' + consumer.accessType + ' / ' + consumer.area + ' / ' + sourceLabel(consumer.source));
        });
      }
    } else {
      rows.push('No source-backed definition was found in the current ProjectIndex.');
    }
    return rows.join('\n') + '\n';
  }

  function variableConsumerRows(variable, projectIndex) {
    const model = buildVariableConsumerModel(projectIndex);
    const row = ensureArray(model.variables).find((item) => item.name === variable.name);
    return ensureArray(row && row.consumers);
  }

  function findVariable(projectIndex, name) {
    const target = String(name || '').trim();
    if (!target) {
      return null;
    }
    return buildVariableModel(projectIndex).variables.find((item) => item.name === target) || null;
  }

  function firstSource(variable) {
    const refs = ensureArray(variable && variable.definedIn)
      .concat(ensureArray(variable && variable.writes))
      .concat(ensureArray(variable && variable.reads));
    return refs.find((item) => item && item.path) || null;
  }

  function existingSourcePath(variable) {
    const source = firstSource(variable);
    return source && source.path ? source.path : '';
  }

  function sourceLabel(source) {
    if (!source) {
      return '';
    }
    return source.path + (source.line ? ':' + source.line : '');
  }

  function qualityPath(draftInput) {
    const draft = normalizeDraft(draftInput);
    return 'source/qualities/' + draft.variableName + '.quality.dry';
  }

  function literalValue(draft) {
    if (draft.valueType === 'boolean') {
      const textValue = String(draft.initialValue || '').trim().toLowerCase();
      return textValue === 'true' || textValue === '1' || textValue === 'yes' ? 'true' : 'false';
    }
    if (draft.valueType === 'string') {
      return JSON.stringify(String(draft.initialValue || ''));
    }
    const number = Number(draft.initialValue || 0);
    return Number.isFinite(number) ? String(number) : '0';
  }

  function displayInitialValue(draft) {
    return draft.initialValue === '' ? '(unset)' : literalValue(draft);
  }

  function projectProvenance(index) {
    const project = isObject(index.project) ? index.project : {};
    return {
      name: String(project.name || '').trim(),
      root: String(project.root || '').trim(),
      profileIds: ensureArray(project.profileIds).map(String)
    };
  }

  function safeId(value) {
    let textValue = String(value || 'variable_editor')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!textValue) {
      textValue = 'variable_editor';
    }
    if (!/^[A-Za-z_]/.test(textValue)) {
      textValue = 'variable_' + textValue;
    }
    return ID_RE.test(textValue) ? textValue : 'variable_editor';
  }

  function safeVariableName(value) {
    let textValue = String(value || 'new_variable')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!textValue) {
      textValue = 'new_variable';
    }
    if (!/^[A-Za-z_]/.test(textValue)) {
      textValue = 'q_' + textValue;
    }
    return textValue;
  }

  function uniqueVariableName(projectIndex, baseName) {
    const base = safeVariableName(baseName || 'new_variable');
    const existing = new Set(buildVariableModel(projectIndex).variables.map((item) => item.name));
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

  function labelFromName(name) {
    return String(name || 'New Variable')
      .replace(/^q_/, '')
      .replace(/_/g, ' ')
      .replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }

  function singleLine(value) {
    return String(value || '').replace(/[\r\n]+/g, ' ').trim();
  }

  function numberOrNull(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
  }

  function diagnostic(diagnostics, severity, code, message) {
    diagnostics.push({severity, code, message, confidence: 'exact'});
  }

  function text(options, key) {
    const locale = localeKey(options);
    const dict = TEXT[locale] || TEXT.en;
    return dict[key] || TEXT.en[key] || key;
  }

  function localeKey(options) {
    const raw = isObject(options) ? String(options.locale || '') : '';
    return raw.toLowerCase().startsWith('zh') ? 'zh-Hant' : 'en';
  }

  function optionsFromLocale() {
    return {locale: 'en'};
  }

  const api = {
    VARIABLE_EDITOR_VERSION,
    VARIABLE_EDITOR_KIND,
    buildVariableModel,
    buildVariableConsumerModel,
    defaultDraft,
    uniqueVariableName,
    draftFromVariable,
    deleteDraftFromVariable,
    normalizeDraft,
    validateDraft,
    buildExportBundle,
    buildInstallPlan,
    renderPlayerPreview,
    renderQualityFile,
    rootInitSnippet
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapVariableEditorDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
