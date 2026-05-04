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
      safetyExisting: '- Existing variables are shown with source references; editing game logic still needs review.',
      safetyQuality: '- Quality files are generated for manual review because project conventions vary.',
      manualExisting: 'Review this existing variable before changing initialization or quality metadata.',
      noop: 'No variable change was generated.'
    },
    'zh-Hant': {
      title: '變數編輯器',
      addNew: '新增變數',
      editExisting: '編輯既有變數',
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
      safetyExisting: '- 既有變數會顯示 source 參照；修改遊戲邏輯仍需要審查。',
      safetyQuality: '- quality 檔因專案慣例差異，先產生為手動審查內容。',
      manualExisting: '修改初始化或 quality metadata 前，請先審查這個既有變數。',
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

  function defaultDraft(projectIndex) {
    const model = buildVariableModel(projectIndex);
    const first = model.variables[0] || null;
    return normalizeDraft({
      id: first ? 'edit_' + safeId(first.name) : 'new_variable',
      title: first ? 'Edit ' + first.name : 'New Variable',
      mode: first ? 'edit_existing' : 'add_new',
      variableName: first ? first.name : 'new_variable',
      label: first ? labelFromName(first.name) : 'New Variable',
      initialValue: '0',
      valueType: 'number',
      description: '',
      includeRootInit: !first,
      includePostEventInit: false,
      includeQualityFile: !first,
      evidence: model
    });
  }

  function draftFromVariable(variable, projectIndex) {
    const item = normalizeVariable(variable || {});
    return normalizeDraft({
      id: item.name ? 'edit_' + safeId(item.name) : 'edit_variable',
      title: item.name ? 'Edit ' + item.name : 'Edit Variable',
      mode: 'edit_existing',
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
    draft.mode = draft.mode === 'edit_existing' ? 'edit_existing' : 'add_new';
    draft.variableName = safeVariableName(draft.variableName || draft.name || 'new_variable');
    draft.label = singleLine(draft.label || labelFromName(draft.variableName));
    draft.initialValue = singleLine(draft.initialValue === undefined ? draft.value : draft.initialValue);
    draft.valueType = VALUE_TYPES.has(String(draft.valueType || 'number')) ? String(draft.valueType || 'number') : 'number';
    draft.description = String(draft.description || '').trim();
    draft.includeRootInit = draft.includeRootInit !== false;
    draft.includePostEventInit = draft.includePostEventInit === true;
    draft.includeQualityFile = draft.includeQualityFile !== false;
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
      diagnostic(diagnostics, 'warning', 'variable_editor.duplicate', 'A ProjectIndex variable with this name already exists.');
    }
    if (draft.mode === 'edit_existing' && !findVariable(projectIndex, draft.variableName)) {
      diagnostic(diagnostics, 'warning', 'variable_editor.missing_existing', 'This variable was not found in the current ProjectIndex.');
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
    } else {
      const existing = findVariable(projectIndex, draft.variableName);
      operations.push({
        id: 'variable_existing_review',
        type: 'manual_snippet',
        path: existingSourcePath(existing) || 'source/scenes/root.scene.dry',
        content: existingVariableNotes(draft, existing),
        safety: 'manual_review',
        role: 'variable.existing_review',
        description: 'Review the existing variable source evidence before changing initialization or gameplay logic.'
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
      draft.mode === 'add_new' ? text(options, 'addNew') : text(options, 'editExisting')
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
      text(options, 'safetyQuality')
    ].join('\n') + '\n';
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
    defaultDraft,
    draftFromVariable,
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
