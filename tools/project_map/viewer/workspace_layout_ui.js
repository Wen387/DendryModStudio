(function initProjectMapWorkspaceLayoutWizard(global) {
  'use strict';

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const escapeHtml = domTextUtils.escapeHtml;
  const escapeAttr = domTextUtils.escapeAttr;

  const EVENT_NAMES = [
    'project-map:index-loaded',
    'ProjectMap:index-loaded',
    'projectmap:index-loaded',
    'ProjectMapIndexLoaded',
    'project-map:model-loaded'
  ];

  const state = {
    projectIndex: null,
    layoutModel: null,
    lastDraft: null,
    lastOutput: null,
    hasUserEdited: false
  };

  let elements = null;

  const api = {
    setProjectIndex,
    setIndex: setProjectIndex,
    applyWorkspaceLayoutDraftToForm,
    loadDraft: applyWorkspaceLayoutDraftToForm,
    refresh: () => renderWorkspaceLayoutWizard(),
    getDraft: () => state.lastDraft,
    getOutput: () => state.lastOutput
  };

  global.ProjectMapWorkspaceLayoutWizard = api;

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
      form: document.getElementById('workspace-layout-form'),
      draftFile: document.getElementById('workspace-layout-draft-file'),
      draftStatus: document.getElementById('workspace-layout-draft-status'),
      indexStatus: document.getElementById('workspace-layout-index-status'),
      coreStatus: document.getElementById('workspace-layout-core-status'),
      diagnostics: document.getElementById('workspace-layout-diagnostics'),
      readiness: document.getElementById('workspace-layout-readiness'),
      playerPreview: document.getElementById('workspace-layout-player-preview'),
      jsonPreview: document.getElementById('workspace-layout-json-preview'),
      installPreview: document.getElementById('workspace-layout-install-preview'),
      patchPreview: document.getElementById('workspace-layout-patch-preview'),
      previewTabs: Array.from(document.querySelectorAll('[data-workspace-layout-preview-tab]')),
      previewPanels: Array.from(document.querySelectorAll('[data-workspace-layout-preview-panel]')),
      downloadJson: document.getElementById('workspace-layout-download-json'),
      downloadNotes: document.getElementById('workspace-layout-download-notes'),
      downloadPlan: document.getElementById('workspace-layout-download-plan'),
      downloadPatch: document.getElementById('workspace-layout-download-patch'),
      reviewInstall: document.getElementById('workspace-layout-review-install')
    };
    elements.handInsertMode = document.getElementById('workspace-layout-hand-insert-mode');
    elements.handAnchorId = document.getElementById('workspace-layout-hand-anchor-id');
    elements.sidebarInsertMode = document.getElementById('workspace-layout-sidebar-insert-mode');
    elements.sidebarAnchorId = document.getElementById('workspace-layout-sidebar-anchor-id');
    elements.createStarterCard = document.getElementById('workspace-layout-create-starter-card');
    elements.variableOptions = document.getElementById('workspace-layout-variable-options');
    bindPreviewTabs();
    bindIndexEvents();
    bindDraftLoading();
    bindForm();
    bindDownloads();
    renderWorkspaceLayoutWizard();
  }

  function bindPreviewTabs() {
    const activate = (target) => {
      const next = target || 'preview';
      elements.previewTabs.forEach((tab) => {
        const active = tab.dataset.workspaceLayoutPreviewTab === next;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      elements.previewPanels.forEach((panel) => {
        const active = panel.dataset.workspaceLayoutPreviewPanel === next;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    };
    elements.previewTabs.forEach((tab) => tab.addEventListener('click', () => activate(tab.dataset.workspaceLayoutPreviewTab)));
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
          applyWorkspaceLayoutDraftToForm(JSON.parse(String(reader.result || '')), {fileName: file.name});
        } catch (err) {
          setStatus(elements.draftStatus, t('create.status.workspaceLayoutDraftParseFailed', 'Workspace layout draft parse failed: {error}').replace('{error}', err.message), 'warning');
          renderWorkspaceLayoutWizard();
        }
      };
      reader.onerror = () => setStatus(elements.draftStatus, t('create.status.workspaceLayoutDraftReadFailed', 'Workspace layout draft read failed.'), 'warning');
      reader.readAsText(file);
    });
  }

  function bindForm() {
    if (!elements.form) {
      return;
    }
    const onUserEdit = () => {
      state.hasUserEdited = true;
      renderWorkspaceLayoutWizard();
    };
    elements.form.addEventListener('input', onUserEdit);
    elements.form.addEventListener('change', onUserEdit);
    elements.form.addEventListener('submit', (event) => {
      event.preventDefault();
      renderWorkspaceLayoutWizard();
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

  function setProjectIndex(index) {
    if (!index) {
      return;
    }
    state.projectIndex = index;
    const core = coreApi();
    state.layoutModel = core && typeof core.buildLayoutModel === 'function'
      ? core.buildLayoutModel(index)
      : null;
    setStatus(elements.indexStatus, t('create.status.projectIndexLoaded', 'ProjectIndex loaded.'), 'ready');
    if (core && typeof core.defaultDraft === 'function' && (!state.lastDraft || (!hasLayoutEvidence(state.lastDraft.evidence) && !state.hasUserEdited))) {
      applyWorkspaceLayoutDraftToForm(core.defaultDraft(index), {fileName: t('create.status.defaultWorkspaceLayoutDraft', 'Detected workspace layout draft')});
      return;
    }
    renderWorkspaceLayoutWizard();
  }

  function applyWorkspaceLayoutDraftToForm(input, meta) {
    const core = coreApi();
    const draft = core && typeof core.normalizeDraft === 'function' ? core.normalizeDraft(input) : input;
    if (!draft) {
      return;
    }
    state.hasUserEdited = false;
    setFieldValue('workspace-layout-id', draft.id);
    setFieldValue('workspace-layout-title', draft.title);
    [
      'deckId',
      'deckTitle',
      'deckSubtitle',
      'deckTag',
      'handOptionLabel',
      'handInsertMode',
      'handAnchorId',
      'sidebarCategoryId',
      'sidebarHeading',
      'sidebarBody',
      'sidebarStatusLines',
      'sidebarInsertMode',
      'sidebarAnchorId',
      'starterCardId',
      'starterCardTitle',
      'starterCardHeading',
      'starterCardBody',
      'starterCardOption0Label',
      'starterCardOption0Variable',
      'starterCardOption0Delta',
      'starterCardOption1Label',
      'starterCardOption1Variable',
      'starterCardOption1Delta',
      'starterCardReturnTarget'
    ].forEach((key) => setFieldValue('workspace-layout-' + kebab(key), draft[key]));
    setFieldChecked('workspace-layout-create-starter-card', draft.createStarterCard);
    setStatus(elements.draftStatus, meta && meta.fileName
      ? t('create.status.loadedFile', 'Loaded {file}').replace('{file}', meta.fileName)
      : t('create.status.workspaceLayoutDraftLoaded', 'Workspace layout draft loaded.'), 'ready');
    renderWorkspaceLayoutWizard();
  }

  function renderWorkspaceLayoutWizard() {
    if (!elements || !elements.form) {
      return;
    }
    const core = coreApi();
    if (!core) {
      setStatus(elements.coreStatus, t('create.status.workspaceLayoutCorePending', 'Workspace Layout core pending.'), 'warning');
      return;
    }
    setStatus(elements.coreStatus, t('create.status.workspaceLayoutCoreLoaded', 'Workspace Layout core loaded.'), 'ready');
    const draft = collectDraft();
    const output = core.buildExportBundle(draft, state.projectIndex || {});
    state.lastDraft = output.draft;
    state.lastOutput = normalizeOutput(output);
    renderWorkspaceLayoutControls();
    renderReadiness();
    renderDiagnostics(output.diagnostics || []);
    renderStarterCardToggle();
    elements.playerPreview.textContent = output.playerPreview || '';
    elements.jsonPreview.textContent = output.draftJson || '';
    elements.installPreview.textContent = output.installChecklist || output.installNotes || '';
    elements.patchPreview.textContent = output.patchPreview || '';
  }

  function collectDraft() {
    const evidence = hasLayoutEvidence(state.lastDraft && state.lastDraft.evidence)
      ? state.lastDraft.evidence
      : state.layoutModel || {};
    return {
      id: fieldValue('workspace-layout-id') || 'workspace_layout_update',
      title: fieldValue('workspace-layout-title') || 'Workspace Layout Update',
      deckId: fieldValue('workspace-layout-deck-id'),
      deckTitle: fieldValue('workspace-layout-deck-title'),
      deckSubtitle: fieldValue('workspace-layout-deck-subtitle'),
      deckTag: fieldValue('workspace-layout-deck-tag'),
      handOptionLabel: fieldValue('workspace-layout-hand-option-label'),
      handInsertMode: fieldValue('workspace-layout-hand-insert-mode') || 'auto',
      handAnchorId: fieldValue('workspace-layout-hand-anchor-id'),
      sidebarCategoryId: fieldValue('workspace-layout-sidebar-category-id'),
      sidebarHeading: fieldValue('workspace-layout-sidebar-heading'),
      sidebarBody: fieldValue('workspace-layout-sidebar-body'),
      sidebarStatusLines: fieldValue('workspace-layout-sidebar-status-lines'),
      sidebarInsertMode: fieldValue('workspace-layout-sidebar-insert-mode') || 'auto',
      sidebarAnchorId: fieldValue('workspace-layout-sidebar-anchor-id'),
      createStarterCard: fieldChecked('workspace-layout-create-starter-card'),
      starterCardId: fieldValue('workspace-layout-starter-card-id'),
      starterCardTitle: fieldValue('workspace-layout-starter-card-title'),
      starterCardHeading: fieldValue('workspace-layout-starter-card-heading'),
      starterCardBody: fieldValue('workspace-layout-starter-card-body'),
      starterCardOption0Label: fieldValue('workspace-layout-starter-card-option0-label'),
      starterCardOption0Variable: fieldValue('workspace-layout-starter-card-option0-variable'),
      starterCardOption0Delta: fieldValue('workspace-layout-starter-card-option0-delta'),
      starterCardOption1Label: fieldValue('workspace-layout-starter-card-option1-label'),
      starterCardOption1Variable: fieldValue('workspace-layout-starter-card-option1-variable'),
      starterCardOption1Delta: fieldValue('workspace-layout-starter-card-option1-delta'),
      starterCardReturnTarget: fieldValue('workspace-layout-starter-card-return-target'),
      evidence
    };
  }

  function renderWorkspaceLayoutControls() {
    const model = state.layoutModel || {};
    populateSelect(
      elements.handAnchorId,
      model.handInsertChoices || [],
      fieldValue('workspace-layout-hand-anchor-id'),
      t('create.option.selectHandAnchor', 'Select hand option')
    );
    populateSelect(
      elements.sidebarAnchorId,
      model.sidebarInsertChoices || [],
      fieldValue('workspace-layout-sidebar-anchor-id') || 'politics',
      t('create.option.selectSidebarAnchor', 'Select sidebar category')
    );
    if (elements.variableOptions) {
      elements.variableOptions.innerHTML = (model.variableIds || [])
        .map((name) => '<option value="' + escapeAttr(name) + '"></option>')
        .join('');
    }
  }

  function renderStarterCardToggle() {
    const enabled = fieldChecked('workspace-layout-create-starter-card');
    Array.from(global.document.querySelectorAll('[data-workspace-layout-starter-card-field]')).forEach((field) => {
      field.disabled = !enabled;
    });
  }

  function populateSelect(select, choices, selectedValue, placeholder) {
    if (!select) {
      return;
    }
    const previous = String(selectedValue || select.value || '').trim();
    const rows = Array.isArray(choices) ? choices : [];
    const options = ['<option value="">' + escapeHtml(placeholder || 'Select') + '</option>'].concat(rows.map((choice) => {
      const value = String(choice.id || '');
      const label = choice.title
        ? value + ' - ' + choice.title
        : choice.anchorText || value;
      return '<option value="' + escapeAttr(value) + '">' + escapeHtml(label) + '</option>';
    }));
    select.innerHTML = options.join('');
    if (previous && !rows.some((choice) => String(choice.id || '') === previous)) {
      const option = global.document.createElement('option');
      option.value = previous;
      option.textContent = previous;
      select.appendChild(option);
    }
    select.value = previous;
  }

  function renderReadiness() {
    if (!elements.readiness) {
      return;
    }
    const rows = state.layoutModel && state.layoutModel.readiness || [];
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
    const draftId = output && output.draft && output.draft.id || 'workspace_layout_update';
    return Object.assign({}, output || {}, {
      draftFileName: draftId + '.workspace-layout-draft.json',
      notesFileName: draftId + '.install-notes.txt',
      installPlanFileName: draftId + '.install-plan.json',
      patchPreviewFileName: draftId + '.patch-preview.diff'
    });
  }

  function ensureOutput() {
    renderWorkspaceLayoutWizard();
    return state.lastOutput || null;
  }

  function sendOutputToInstall(json, fileName) {
    const assistant = global.ProjectMapInstallAssistant;
    if (assistant && typeof assistant.loadPlanText === 'function') {
      assistant.loadPlanText(json, {fileName: fileName || 'workspace-layout.install-plan.json'});
    } else if (assistant && typeof assistant.loadPlan === 'function') {
      try {
        assistant.loadPlan(JSON.parse(json), {fileName: fileName || 'workspace-layout.install-plan.json'});
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
    return global.ProjectMapWorkspaceLayoutDraft || null;
  }

  function hasLayoutEvidence(value) {
    return Boolean(value && value.kind === 'workspace_layout_model' && value.hand && value.hand.exists);
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

  function setFieldChecked(id, value) {
    const field = global.document.getElementById(id);
    if (field) {
      field.checked = Boolean(value);
    }
  }

  function fieldChecked(id) {
    const field = global.document.getElementById(id);
    return field ? Boolean(field.checked) : false;
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

  function kebab(value) {
    return String(value || '').replace(/[A-Z]/g, (match) => '-' + match.toLowerCase());
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

})(typeof window !== 'undefined' ? window : globalThis);
