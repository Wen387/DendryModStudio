(function initProjectMapVariableEditorWizard(global) {
  'use strict';

  const EVENT_NAMES = [
    'project-map:index-loaded',
    'ProjectMap:index-loaded',
    'projectmap:index-loaded',
    'ProjectMapIndexLoaded',
    'project-map:model-loaded'
  ];

  const state = {
    projectIndex: null,
    variableModel: null,
    lastDraft: null,
    lastOutput: null
  };

  let elements = null;

  const api = {
    setProjectIndex,
    setIndex: setProjectIndex,
    applyVariableDraftToForm,
    loadDraft: applyVariableDraftToForm,
    refresh: () => renderVariableEditor(),
    getDraft: () => state.lastDraft,
    getOutput: () => state.lastOutput
  };

  global.ProjectMapVariableEditorWizard = api;

  if (!global || !global.document) {
    return;
  }

  onReady(() => startVariableEditor(global.document));

  function onReady(callback) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function startVariableEditor(document) {
    elements = {
      form: document.getElementById('variable-editor-form'),
      draftFile: document.getElementById('variable-editor-draft-file'),
      draftStatus: document.getElementById('variable-editor-draft-status'),
      indexStatus: document.getElementById('variable-editor-index-status'),
      coreStatus: document.getElementById('variable-editor-core-status'),
      evidence: document.getElementById('variable-editor-evidence'),
      diagnostics: document.getElementById('variable-editor-diagnostics'),
      name: document.getElementById('variable-editor-name'),
      nameOptions: document.getElementById('variable-editor-options'),
      mode: document.getElementById('variable-editor-mode'),
      playerPreview: document.getElementById('variable-editor-player-preview'),
      jsonPreview: document.getElementById('variable-editor-json-preview'),
      installPreview: document.getElementById('variable-editor-install-preview'),
      patchPreview: document.getElementById('variable-editor-patch-preview'),
      qualityPreview: document.getElementById('variable-editor-quality-preview'),
      previewTabs: Array.from(document.querySelectorAll('[data-variable-editor-preview-tab]')),
      previewPanels: Array.from(document.querySelectorAll('[data-variable-editor-preview-panel]')),
      downloadJson: document.getElementById('variable-editor-download-json'),
      downloadQuality: document.getElementById('variable-editor-download-quality'),
      downloadNotes: document.getElementById('variable-editor-download-notes'),
      downloadPlan: document.getElementById('variable-editor-download-plan'),
      downloadPatch: document.getElementById('variable-editor-download-patch'),
      reviewInstall: document.getElementById('variable-editor-review-install')
    };

    if (!elements.form) {
      return;
    }
    bindPreviewTabs();
    bindIndexEvents();
    bindDraftLoading();
    bindForm();
    bindDownloads();
    bindLocaleEvents();
    renderVariableEditor();
  }

  function bindPreviewTabs() {
    const activate = (target) => {
      const next = target || 'preview';
      elements.previewTabs.forEach((tab) => {
        const active = tab.dataset.variableEditorPreviewTab === next;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      elements.previewPanels.forEach((panel) => {
        const active = panel.dataset.variableEditorPreviewPanel === next;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    };
    elements.previewTabs.forEach((tab) => tab.addEventListener('click', () => activate(tab.dataset.variableEditorPreviewTab)));
    activate('preview');
  }

  function bindIndexEvents() {
    EVENT_NAMES.forEach((name) => {
      global.document.addEventListener(name, (event) => {
        const detail = event.detail || {};
        if (detail.index) {
          setProjectIndex(detail.index, detail);
        } else if (detail.model && detail.model.index) {
          setProjectIndex(detail.model.index, detail);
        }
      });
    });
  }

  function bindLocaleEvents() {
    global.document.addEventListener('project-map:locale-changed', () => {
      renderVariableEditor();
    });
  }

  function bindDraftLoading() {
    if (!elements.draftFile) {
      return;
    }
    elements.draftFile.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          applyVariableDraftToForm(JSON.parse(String(reader.result || '')), {fileName: file.name});
        } catch (err) {
          setStatus(elements.draftStatus, t('create.status.variableEditorParseFailed', 'Variable draft parse failed: {error}').replace('{error}', err.message), 'warning');
          renderVariableEditor();
        }
      };
      reader.onerror = () => setStatus(elements.draftStatus, t('create.status.variableEditorReadFailed', 'Variable draft read failed.'), 'warning');
      reader.readAsText(file);
    });
  }

  function bindForm() {
    elements.form.addEventListener('input', () => renderVariableEditor());
    elements.form.addEventListener('change', (event) => {
      if (event.target === elements.mode || event.target === elements.name) {
        seedFromSelectedVariable();
      }
      renderVariableEditor();
    });
    elements.form.addEventListener('submit', (event) => {
      event.preventDefault();
      renderVariableEditor();
    });
  }

  function bindDownloads() {
    if (elements.downloadJson) {
      elements.downloadJson.addEventListener('click', () => {
        const output = ensureOutput();
        if (output) {
          downloadText(output.draftFileName, output.draftJson, 'application/json');
        }
      });
    }
    if (elements.downloadQuality) {
      elements.downloadQuality.addEventListener('click', () => {
        const output = ensureOutput();
        if (output) {
          downloadText(output.qualityFileName, output.qualityFile, 'text/plain');
        }
      });
    }
    if (elements.downloadNotes) {
      elements.downloadNotes.addEventListener('click', () => {
        const output = ensureOutput();
        if (output) {
          downloadText(output.notesFileName, output.installNotes, 'text/plain');
        }
      });
    }
    if (elements.downloadPlan) {
      elements.downloadPlan.addEventListener('click', () => {
        const output = ensureOutput();
        if (output) {
          downloadText(output.installPlanFileName, output.installPlanJson, 'application/json');
        }
      });
    }
    if (elements.downloadPatch) {
      elements.downloadPatch.addEventListener('click', () => {
        const output = ensureOutput();
        if (output) {
          downloadText(output.patchPreviewFileName, output.patchPreview, 'text/plain');
        }
      });
    }
    if (elements.reviewInstall) {
      elements.reviewInstall.addEventListener('click', () => {
        const output = ensureOutput();
        if (output) {
          sendOutputToInstall(output.installPlanJson, output.installPlanFileName);
        }
      });
    }
  }

  function setProjectIndex(index, meta) {
    state.projectIndex = index || null;
    const core = variableEditorApi();
    state.variableModel = core && typeof core.buildVariableModel === 'function'
      ? core.buildVariableModel(state.projectIndex)
      : null;
    renderVariableOptions();
    if (!elements) {
      return;
    }
    const name = meta && meta.fileName ? meta.fileName : t('create.status.projectIndexLoaded', 'ProjectIndex loaded.');
    setStatus(elements.indexStatus, name, 'ready');
    if (core && typeof core.defaultDraft === 'function' && !state.lastDraft) {
      applyVariableDraftToForm(core.defaultDraft(state.projectIndex), {fileName: t('create.status.defaultVariableEditorDraft', 'Detected variable draft')});
      return;
    }
    renderVariableEditor();
  }

  function applyVariableDraftToForm(input, meta) {
    const core = variableEditorApi();
    const draft = core && typeof core.normalizeDraft === 'function' ? core.normalizeDraft(input) : input;
    if (!draft || !elements) {
      return;
    }
    setFieldValue('variable-editor-id', draft.id);
    setFieldValue('variable-editor-title', draft.title);
    setFieldValue('variable-editor-mode', draft.mode);
    setFieldValue('variable-editor-name', draft.variableName);
    setFieldValue('variable-editor-label', draft.label);
    setFieldValue('variable-editor-value-type', draft.valueType);
    setFieldValue('variable-editor-initial', draft.initialValue);
    setFieldValue('variable-editor-description', draft.description);
    setChecked('variable-editor-root-init', draft.includeRootInit);
    setChecked('variable-editor-post-event-init', draft.includePostEventInit);
    setChecked('variable-editor-quality-file', draft.includeQualityFile);
    setStatus(elements.draftStatus, meta && meta.fileName
      ? t('create.status.loadedFile', 'Loaded {file}').replace('{file}', meta.fileName)
      : t('create.status.variableEditorLoaded', 'Variable draft loaded.'), 'ready');
    renderVariableEditor();
  }

  function renderVariableEditor() {
    if (!elements || !elements.form) {
      return;
    }
    const draft = draftFromForm();
    const output = renderVariableOutput(draft);
    state.lastDraft = draft;
    state.lastOutput = output;
    setStatus(elements.coreStatus, output.coreUsed
      ? t('create.status.variableEditorCoreLoaded', 'Variable editor model ready.')
      : t('create.status.variableEditorCorePending', 'Variable editor model pending.'), output.coreUsed ? 'ready' : 'warning');
    renderVariableOptions();
    renderEvidence();
    renderDiagnostics(output.diagnostics);
    setText(elements.playerPreview, output.playerPreview);
    setText(elements.jsonPreview, output.draftJson);
    setText(elements.installPreview, renderInstallPreview(output));
    setText(elements.patchPreview, output.patchPreview);
    setText(elements.qualityPreview, output.qualityFile);
  }

  function draftFromForm() {
    return {
      schemaVersion: '0.1',
      kind: 'variable_editor',
      id: normalizeIdentifier(fieldValue('variable-editor-id'), 'variable_editor'),
      title: fieldValue('variable-editor-title') || t('create.sample.variableEditorTitle', 'Variable Editor Update'),
      mode: fieldValue('variable-editor-mode') === 'edit_existing' ? 'edit_existing' : 'add_new',
      variableName: normalizeVariableName(fieldValue('variable-editor-name') || 'new_variable'),
      label: fieldValue('variable-editor-label'),
      initialValue: fieldValue('variable-editor-initial'),
      valueType: fieldValue('variable-editor-value-type') || 'number',
      description: fieldValue('variable-editor-description'),
      includeRootInit: checked('variable-editor-root-init'),
      includePostEventInit: checked('variable-editor-post-event-init'),
      includeQualityFile: checked('variable-editor-quality-file'),
      evidence: state.variableModel || {}
    };
  }

  function renderVariableOutput(draft) {
    const core = variableEditorApi();
    if (core && typeof core.buildExportBundle === 'function') {
      const bundle = core.buildExportBundle(draft, state.projectIndex, {locale: currentLocale()});
      return {
        coreUsed: true,
        diagnostics: bundle.diagnostics || [],
        ok: bundle.ok,
        playerPreview: bundle.playerPreview || bundle.previewText || '',
        draftJson: bundle.draftJson || JSON.stringify(bundle.draft || draft, null, 2) + '\n',
        qualityFile: bundle.qualityFile || '',
        installNotes: bundle.installNotes || '',
        installChecklist: bundle.installChecklist || '',
        installPlanJson: bundle.installPlanJson || '',
        installPlan: bundle.installPlan || null,
        patchPreview: bundle.patchPreview || '',
        draftFileName: draft.id + '.variable-draft.json',
        qualityFileName: draft.variableName + '.quality.dry',
        notesFileName: draft.id + '.install-notes.txt',
        installPlanFileName: draft.id + '.install-plan.json',
        patchPreviewFileName: draft.id + '.patch-preview.diff'
      };
    }
    return {
      coreUsed: false,
      diagnostics: [{severity: 'warning', code: 'variable_editor_ui.core_missing', message: t('create.status.variableEditorCoreMissing', 'Variable editor model is not loaded.')}],
      ok: false,
      playerPreview: 'Q.' + draft.variableName + '\n',
      draftJson: JSON.stringify(draft, null, 2) + '\n',
      qualityFile: '',
      installNotes: t('create.installNotes.manualOnly', 'Install manually: proposal only / not installed') + '\n',
      installChecklist: '',
      installPlanJson: '',
      installPlan: null,
      patchPreview: '',
      draftFileName: draft.id + '.variable-draft.json',
      qualityFileName: draft.variableName + '.quality.dry',
      notesFileName: draft.id + '.install-notes.txt',
      installPlanFileName: draft.id + '.install-plan.json',
      patchPreviewFileName: draft.id + '.patch-preview.diff'
    };
  }

  function renderVariableOptions() {
    if (!elements || !elements.nameOptions) {
      return;
    }
    const model = state.variableModel || {};
    const variables = Array.isArray(model.variables) ? model.variables : [];
    elements.nameOptions.innerHTML = variables.map((item) => {
      return '<option value="' + escapeAttr(item.name) + '">' + escapeHtml(item.name) + '</option>';
    }).join('');
  }

  function seedFromSelectedVariable() {
    const draft = draftFromForm();
    if (draft.mode !== 'edit_existing') {
      return;
    }
    const variable = selectedVariable(draft.variableName);
    if (!variable) {
      return;
    }
    if (!fieldValue('variable-editor-label')) {
      setFieldValue('variable-editor-label', labelFromName(variable.name));
    }
    setChecked('variable-editor-root-init', false);
    setChecked('variable-editor-post-event-init', false);
    setChecked('variable-editor-quality-file', false);
  }

  function renderEvidence() {
    if (!elements.evidence) {
      return;
    }
    if (!state.variableModel) {
      elements.evidence.innerHTML = evidenceRow('warning', t('variableEditor.evidence.none', 'No index'), t('variableEditor.evidence.noIndex', 'Open or index a project to inspect variables.'), '');
      return;
    }
    const draft = draftFromForm();
    const variable = selectedVariable(draft.variableName);
    if (!variable) {
      elements.evidence.innerHTML = evidenceRow('warning', t('variableEditor.evidence.none', 'No variable'), t('variableEditor.evidence.noVariable', 'No ProjectIndex variable currently matches this name.'), '');
      return;
    }
    const defined = firstSource(variable.definedIn) || firstSource(variable.writes);
    const readWrite = t('variableEditor.evidence.readWrite', '{reads} reads / {writes} writes')
      .replace('{reads}', String(variable.readCount || 0))
      .replace('{writes}', String(variable.writeCount || 0));
    const rows = [
      evidenceRow('ready', t('variableEditor.evidence.counts', 'Usage'), readWrite, variable.confidence || ''),
      evidenceRow(defined ? 'ready' : 'warning', t('variableEditor.evidence.defined', 'Definition'), defined ? sourceLabel(defined) : t('variableEditor.evidence.noSource', 'No source-backed definition.'), ''),
      evidenceRow(variable.reads.length ? 'ready' : 'warning', t('variableEditor.evidence.readRefs', 'Read refs'), sourceList(variable.reads), ''),
      evidenceRow(variable.writes.length ? 'ready' : 'warning', t('variableEditor.evidence.writeRefs', 'Write refs'), sourceList(variable.writes), '')
    ];
    elements.evidence.innerHTML = rows.join('');
  }

  function renderDiagnostics(diagnostics) {
    if (!elements.diagnostics) {
      return;
    }
    const items = diagnostics || [];
    if (!items.length) {
      elements.diagnostics.innerHTML = '<div class="diagnostic-row info">' + escapeHtml(t('diagnostics.none', 'No diagnostics.')) + '</div>';
      return;
    }
    elements.diagnostics.innerHTML = items.map((diag) => {
      const severity = escapeAttr(diag.severity || 'info');
      return '<div class="diagnostic-row ' + severity + '">' +
        '<strong>' + escapeHtml(diag.code || 'diagnostic') + '</strong>' +
        '<span>' + escapeHtml(diag.message || '') + '</span>' +
        '</div>';
    }).join('');
  }

  function renderInstallPreview(output) {
    return [output.installChecklist, output.installNotes].filter(Boolean).join('\n');
  }

  function ensureOutput() {
    renderVariableEditor();
    return state.lastOutput;
  }

  function sendOutputToInstall(installPlanJson, fileName) {
    try {
      const plan = JSON.parse(String(installPlanJson || '{}'));
      const assistant = global.ProjectMapInstallAssistant;
      if (!assistant || typeof assistant.loadPlan !== 'function') {
        setStatus(elements.indexStatus, t('draftWorkspace.installMissing', 'Install Assistant is not loaded.'), 'warning');
        return;
      }
      assistant.loadPlan(plan, {fileName: fileName || plan.id || 'install-plan.json'});
      const installButton = global.document.querySelector('[data-mode="install"]');
      if (installButton) {
        installButton.click();
      }
    } catch (err) {
      setStatus(elements.indexStatus, t('install.invalidPlanJson', 'Install plan is not valid JSON: {message}')
        .replace('{message}', err.message), 'warning');
    }
  }

  function selectedVariable(name) {
    const model = state.variableModel || {};
    const variables = Array.isArray(model.variables) ? model.variables : [];
    return variables.find((item) => item.name === name) || null;
  }

  function firstSource(items) {
    return (Array.isArray(items) ? items : []).find((item) => item && item.path) || null;
  }

  function sourceList(items) {
    const refs = (Array.isArray(items) ? items : []).filter((item) => item && item.path).slice(0, 4);
    return refs.length ? refs.map(sourceLabel).join(', ') : '-';
  }

  function sourceLabel(source) {
    return String(source.path || '') + (source.line ? ':' + source.line : '');
  }

  function evidenceRow(tone, title, body, meta) {
    return '<div class="metadata-evidence-row ' + escapeAttr(tone || '') + '">' +
      '<strong>' + escapeHtml(title) + '</strong>' +
      '<span>' + escapeHtml(body) + '</span>' +
      '<small>' + escapeHtml(meta || '') + '</small>' +
      '</div>';
  }

  function fieldValue(id) {
    const field = global.document.getElementById(id);
    return field ? String(field.value || '').trim() : '';
  }

  function setFieldValue(id, value) {
    const field = global.document.getElementById(id);
    if (field) {
      field.value = value === undefined || value === null ? '' : String(value);
    }
  }

  function checked(id) {
    const field = global.document.getElementById(id);
    return Boolean(field && field.checked);
  }

  function setChecked(id, value) {
    const field = global.document.getElementById(id);
    if (field) {
      field.checked = value !== false;
    }
  }

  function setText(element, value) {
    if (element) {
      element.textContent = value || '';
    }
  }

  function setStatus(element, message, tone) {
    if (!element) {
      return;
    }
    element.textContent = message || '';
    element.dataset.status = tone || '';
    element.classList.toggle('is-ready', tone === 'ready');
    element.classList.toggle('is-warning', tone === 'warning');
  }

  function variableEditorApi() {
    return global.ProjectMapVariableEditorDraft || null;
  }

  function normalizeIdentifier(value, fallback) {
    let textValue = String(value || fallback || '')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!textValue) {
      textValue = fallback || 'variable_editor';
    }
    if (!/^[A-Za-z_]/.test(textValue)) {
      textValue = 'variable_' + textValue;
    }
    return textValue || fallback || 'variable_editor';
  }

  function normalizeVariableName(value) {
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
    return String(name || 'Variable')
      .replace(/^q_/, '')
      .replace(/_/g, ' ')
      .replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }

  function downloadText(fileName, text, type) {
    const blob = new Blob([text || ''], {type: type || 'text/plain'});
    const url = URL.createObjectURL(blob);
    const anchor = global.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName || 'variable-editor.txt';
    global.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function currentLocale() {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.getLocale === 'function' ? i18n.getLocale() : 'en';
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function'
      ? i18n.t(key, fallback)
      : fallback;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }
})(typeof window !== 'undefined' ? window : globalThis);
