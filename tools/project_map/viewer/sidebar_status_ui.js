(function initProjectMapSidebarStatusWizard(global) {
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
    sidebarModel: null,
    lastDraft: null,
    lastOutput: null,
    hasUserEdited: false
  };

  let elements = null;

  const api = {
    setProjectIndex,
    setIndex: setProjectIndex,
    applySidebarStatusDraftToForm,
    loadDraft: applySidebarStatusDraftToForm,
    refresh: () => renderSidebarStatusWizard(),
    getDraft: () => state.lastDraft,
    getOutput: () => state.lastOutput
  };

  global.ProjectMapSidebarStatusWizard = api;

  if (!global || !global.document) {
    return;
  }

  onReady(() => start(global.document));

  function onReady(callback) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function start(document) {
    elements = {
      form: document.getElementById('sidebar-status-form'),
      draftFile: document.getElementById('sidebar-status-draft-file'),
      draftStatus: document.getElementById('sidebar-status-draft-status'),
      indexStatus: document.getElementById('sidebar-status-index-status'),
      coreStatus: document.getElementById('sidebar-status-core-status'),
      diagnostics: document.getElementById('sidebar-status-diagnostics'),
      readiness: document.getElementById('sidebar-status-readiness'),
      playerPreview: document.getElementById('sidebar-status-player-preview'),
      jsonPreview: document.getElementById('sidebar-status-json-preview'),
      installPreview: document.getElementById('sidebar-status-install-preview'),
      patchPreview: document.getElementById('sidebar-status-patch-preview'),
      previewTabs: Array.from(document.querySelectorAll('[data-sidebar-status-preview-tab]')),
      previewPanels: Array.from(document.querySelectorAll('[data-sidebar-status-preview-panel]')),
      downloadJson: document.getElementById('sidebar-status-download-json'),
      downloadNotes: document.getElementById('sidebar-status-download-notes'),
      downloadPlan: document.getElementById('sidebar-status-download-plan'),
      downloadPatch: document.getElementById('sidebar-status-download-patch'),
      reviewInstall: document.getElementById('sidebar-status-review-install'),
      sectionId: document.getElementById('sidebar-status-section-id'),
      variableOptions: document.getElementById('sidebar-status-variable-options'),
      conditionVariable: document.getElementById('sidebar-status-condition-variable'),
      insertCondition: document.getElementById('sidebar-status-insert-condition')
    };
    bindPreviewTabs();
    bindIndexEvents();
    bindDraftLoading();
    bindForm();
    bindDownloads();
    bindConditionInsert();
    renderSidebarStatusWizard();
  }

  function bindPreviewTabs() {
    const activate = (target) => {
      const next = target || 'preview';
      elements.previewTabs.forEach((tab) => {
        const active = tab.dataset.sidebarStatusPreviewTab === next;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      elements.previewPanels.forEach((panel) => {
        const active = panel.dataset.sidebarStatusPreviewPanel === next;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    };
    elements.previewTabs.forEach((tab) => tab.addEventListener('click', () => activate(tab.dataset.sidebarStatusPreviewTab)));
    activate('preview');
  }

  function bindIndexEvents() {
    EVENT_NAMES.forEach((name) => {
      global.document.addEventListener(name, (event) => {
        const detail = event.detail || {};
        setProjectIndex(detail.index || detail.projectIndex || detail.model && detail.model.index || null);
      });
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
          applySidebarStatusDraftToForm(JSON.parse(String(reader.result || '')), {fileName: file.name});
        } catch (err) {
          setStatus(elements.draftStatus, t('create.status.sidebarStatusDraftParseFailed', 'Sidebar / Status draft parse failed: {error}').replace('{error}', err.message), 'warning');
          renderSidebarStatusWizard();
        }
      };
      reader.onerror = () => setStatus(elements.draftStatus, t('create.status.sidebarStatusDraftReadFailed', 'Sidebar / Status draft read failed.'), 'warning');
      reader.readAsText(file);
    });
  }

  function bindForm() {
    if (!elements.form) {
      return;
    }
    elements.form.addEventListener('input', () => {
      state.hasUserEdited = true;
      renderSidebarStatusWizard();
    });
    elements.form.addEventListener('change', (event) => {
      state.hasUserEdited = true;
      if (event.target && event.target.id === 'sidebar-status-section-id') {
        applySectionToFields(event.target.value);
      }
      renderSidebarStatusWizard();
    });
    elements.form.addEventListener('submit', (event) => {
      event.preventDefault();
      renderSidebarStatusWizard();
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

  function bindConditionInsert() {
    if (!elements.insertCondition) {
      return;
    }
    elements.insertCondition.addEventListener('click', () => {
      const variable = elements.conditionVariable ? String(elements.conditionVariable.value || '').trim() : '';
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable)) {
        return;
      }
      const field = global.document.getElementById('sidebar-status-section-status-lines');
      if (!field) {
        return;
      }
      const line = '[? if ' + variable + ' > 0 : ' + labelForVariable(variable) + ' is active. ?]';
      const current = String(field.value || '').trim();
      field.value = current ? current + '\n' + line : line;
      state.hasUserEdited = true;
      renderSidebarStatusWizard();
    });
  }

  function setProjectIndex(index) {
    if (!index) {
      return;
    }
    state.projectIndex = index;
    const core = coreApi();
    state.sidebarModel = core && typeof core.buildSidebarModel === 'function'
      ? core.buildSidebarModel(index)
      : null;
    setStatus(elements.indexStatus, t('create.status.projectIndexLoaded', 'ProjectIndex loaded.'), 'ready');
    if (core && typeof core.defaultDraft === 'function' && (!state.lastDraft || (!hasSidebarEvidence(state.lastDraft.evidence) && !state.hasUserEdited))) {
      applySidebarStatusDraftToForm(core.defaultDraft(index), {fileName: t('create.status.defaultSidebarStatusDraft', 'Detected Sidebar / Status draft')});
      return;
    }
    renderSidebarStatusWizard();
  }

  function applySidebarStatusDraftToForm(input, meta) {
    const core = coreApi();
    const draft = core && typeof core.normalizeDraft === 'function' ? core.normalizeDraft(input) : input;
    if (!draft) {
      return;
    }
    state.hasUserEdited = false;
    setFieldValue('sidebar-status-id', draft.id);
    setFieldValue('sidebar-status-title', draft.title);
    setFieldValue('sidebar-status-status-title', draft.statusTitle);
    setFieldValue('sidebar-status-section-id', draft.sectionId);
    setFieldValue('sidebar-status-section-heading', draft.sectionHeading);
    setFieldValue('sidebar-status-section-body', draft.sectionBody);
    setFieldValue('sidebar-status-section-status-lines', draft.sectionStatusLines);
    setStatus(elements.draftStatus, meta && meta.fileName
      ? t('create.status.loadedFile', 'Loaded {file}').replace('{file}', meta.fileName)
      : t('create.status.sidebarStatusDraftLoaded', 'Sidebar / Status draft loaded.'), 'ready');
    renderSidebarStatusWizard();
  }

  function renderSidebarStatusWizard() {
    if (!elements || !elements.form) {
      return;
    }
    const core = coreApi();
    if (!core) {
      setStatus(elements.coreStatus, t('create.status.sidebarStatusCorePending', 'Sidebar / Status core pending.'), 'warning');
      return;
    }
    setStatus(elements.coreStatus, t('create.status.sidebarStatusCoreLoaded', 'Sidebar / Status core loaded.'), 'ready');
    renderControls();
    const output = core.buildExportBundle(collectDraft(), state.projectIndex || {});
    state.lastDraft = output.draft;
    state.lastOutput = normalizeOutput(output);
    renderReadiness();
    renderDiagnostics(output.diagnostics || []);
    elements.playerPreview.textContent = output.playerPreview || '';
    elements.jsonPreview.textContent = output.draftJson || '';
    elements.installPreview.textContent = output.installChecklist || output.installNotes || '';
    elements.patchPreview.textContent = output.patchPreview || '';
  }

  function collectDraft() {
    const evidence = hasSidebarEvidence(state.lastDraft && state.lastDraft.evidence)
      ? state.lastDraft.evidence
      : state.sidebarModel || {};
    return {
      id: fieldValue('sidebar-status-id') || 'sidebar_status_update',
      title: fieldValue('sidebar-status-title') || 'Sidebar / Status Update',
      statusTitle: fieldValue('sidebar-status-status-title') || 'Status',
      sectionId: fieldValue('sidebar-status-section-id') || '__main',
      sectionHeading: fieldValue('sidebar-status-section-heading'),
      sectionBody: fieldValue('sidebar-status-section-body'),
      sectionStatusLines: fieldValue('sidebar-status-section-status-lines'),
      evidence
    };
  }

  function renderControls() {
    const model = state.sidebarModel || {};
    populateSectionSelect(
      elements.sectionId,
      model.sections || [],
      fieldValue('sidebar-status-section-id') || (model.sections && model.sections[0] && model.sections[0].id) || ''
    );
    if (elements.variableOptions) {
      elements.variableOptions.innerHTML = (model.variables || [])
        .map((item) => '<option value="' + escapeAttr(item.name || item) + '">' + escapeHtml(item.reason || '') + '</option>')
        .join('');
    }
  }

  function populateSectionSelect(select, sections, selectedValue) {
    if (!select) {
      return;
    }
    const previous = String(selectedValue || select.value || '').trim();
    const rows = Array.isArray(sections) ? sections : [];
    select.innerHTML = rows.map((section) => {
      const id = String(section.id || '');
      const label = section.heading
        ? id + ' - ' + section.heading
        : id;
      return '<option value="' + escapeAttr(id) + '">' + escapeHtml(label) + '</option>';
    }).join('');
    if (previous && !rows.some((section) => String(section.id || '') === previous)) {
      const option = global.document.createElement('option');
      option.value = previous;
      option.textContent = previous;
      select.appendChild(option);
    }
    select.value = previous || (rows[0] && rows[0].id) || '';
  }

  function applySectionToFields(sectionId) {
    const section = (state.sidebarModel && state.sidebarModel.sections || [])
      .find((item) => String(item.id || '') === String(sectionId || ''));
    if (!section) {
      return;
    }
    setFieldValue('sidebar-status-section-heading', section.heading);
    setFieldValue('sidebar-status-section-body', section.body);
    setFieldValue('sidebar-status-section-status-lines', section.statusLines);
  }

  function renderReadiness() {
    if (!elements.readiness) {
      return;
    }
    const rows = state.sidebarModel && state.sidebarModel.readiness || [];
    elements.readiness.innerHTML = rows.map((row) => {
      const status = row.status === 'ready' ? t('entry.ready', 'Ready') : t('entry.needsReview', 'Needs review');
      return '<div class="entry-playability-item is-' + escapeAttr(row.status || 'warning') + '">' +
        '<strong>' + escapeHtml(row.label || row.id || '') + '</strong>' +
        '<span>' + escapeHtml(status) + '</span>' +
        '<small>' + escapeHtml(row.message || '') + '</small>' +
        '</div>';
    }).join('');
  }

  function renderDiagnostics(diagnostics) {
    elements.diagnostics.innerHTML = '';
    if (!diagnostics.length) {
      elements.diagnostics.innerHTML = '<div class="diagnostic ok">' + escapeHtml(t('create.noDiagnostics', 'No diagnostics.')) + '</div>';
      return;
    }
    diagnostics.forEach((diagnostic) => {
      const row = global.document.createElement('div');
      row.className = 'diagnostic ' + (diagnostic.severity || 'info');
      row.textContent = (diagnostic.severity || 'info') + ': ' + (diagnostic.message || diagnostic.code || '');
      elements.diagnostics.appendChild(row);
    });
  }

  function normalizeOutput(output) {
    const draftId = output && output.draft && output.draft.id || 'sidebar_status_update';
    return Object.assign({}, output || {}, {
      draftFileName: draftId + '.sidebar-status-draft.json',
      notesFileName: draftId + '.install-notes.txt',
      installPlanFileName: draftId + '.install-plan.json',
      patchPreviewFileName: draftId + '.patch-preview.diff'
    });
  }

  function ensureOutput() {
    renderSidebarStatusWizard();
    return state.lastOutput || null;
  }

  function sendOutputToInstall(json, fileName) {
    const assistant = global.ProjectMapInstallAssistant;
    if (assistant && typeof assistant.loadPlanText === 'function') {
      assistant.loadPlanText(json, {fileName: fileName || 'sidebar-status.install-plan.json'});
    } else if (assistant && typeof assistant.loadPlan === 'function') {
      try {
        assistant.loadPlan(JSON.parse(json), {fileName: fileName || 'sidebar-status.install-plan.json'});
      } catch (_err) {
        return;
      }
    }
    const button = global.document.querySelector('[data-mode="install"]');
    if (button) {
      button.click();
    }
  }

  function coreApi() {
    return global.ProjectMapSidebarStatusDraft || null;
  }

  function hasSidebarEvidence(value) {
    return Boolean(value && value.kind === 'sidebar_status_model' && (
      value.hasGeneratedSidebarOnly ||
      value.status && value.status.exists ||
      Array.isArray(value.sections) && value.sections.length
    ));
  }

  function setFieldValue(id, value) {
    const field = global.document.getElementById(id);
    if (field) {
      if (field.tagName === 'SELECT' && value && !Array.from(field.options).some((option) => option.value === value)) {
        const option = global.document.createElement('option');
        option.value = value;
        option.textContent = value;
        field.appendChild(option);
      }
      field.value = value || '';
    }
  }

  function fieldValue(id) {
    const field = global.document.getElementById(id);
    return field ? String(field.value || '').trim() : '';
  }

  function setStatus(element, message, kind) {
    if (!element) {
      return;
    }
    element.textContent = message || '';
    element.classList.toggle('is-ready', kind === 'ready');
    element.classList.toggle('is-warning', kind === 'warning');
  }

  function downloadText(fileName, content, mimeType) {
    const blob = new Blob([content || ''], {type: mimeType || 'text/plain'});
    const url = URL.createObjectURL(blob);
    const link = global.document.createElement('a');
    link.href = url;
    link.download = fileName;
    global.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function labelForVariable(value) {
    return String(value || '')
      .replace(/^q/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim() || 'Status';
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
    return escapeHtml(value);
  }
})(typeof window !== 'undefined' ? window : globalThis);
