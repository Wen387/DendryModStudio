(function initProjectMapProjectMetadataWizard(global) {
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
    metadataModel: null,
    lastDraft: null,
    lastOutput: null
  };

  let elements = null;

  const api = {
    setProjectIndex,
    setIndex: setProjectIndex,
    applyProjectMetadataDraftToForm,
    loadDraft: applyProjectMetadataDraftToForm,
    refresh: () => renderProjectMetadataWizard(),
    getDraft: () => state.lastDraft,
    getOutput: () => state.lastOutput
  };

  global.ProjectMapProjectMetadataWizard = api;

  if (!global || !global.document) {
    return;
  }

  onReady(() => startProjectMetadataWizard(global.document));

  function onReady(callback) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function startProjectMetadataWizard(document) {
    elements = {
      form: document.getElementById('project-metadata-form'),
      draftFile: document.getElementById('project-metadata-draft-file'),
      draftStatus: document.getElementById('project-metadata-draft-status'),
      indexStatus: document.getElementById('project-metadata-index-status'),
      coreStatus: document.getElementById('project-metadata-core-status'),
      evidence: document.getElementById('project-metadata-evidence'),
      diagnostics: document.getElementById('project-metadata-diagnostics'),
      generateIfid: document.getElementById('project-metadata-generate-ifid'),
      playerPreview: document.getElementById('project-metadata-player-preview'),
      jsonPreview: document.getElementById('project-metadata-json-preview'),
      installPreview: document.getElementById('project-metadata-install-preview'),
      patchPreview: document.getElementById('project-metadata-patch-preview'),
      previewTabs: Array.from(document.querySelectorAll('[data-project-metadata-preview-tab]')),
      previewPanels: Array.from(document.querySelectorAll('[data-project-metadata-preview-panel]')),
      downloadJson: document.getElementById('project-metadata-download-json'),
      downloadNotes: document.getElementById('project-metadata-download-notes'),
      downloadPlan: document.getElementById('project-metadata-download-plan'),
      reviewInstall: document.getElementById('project-metadata-review-install'),
      downloadPatch: document.getElementById('project-metadata-download-patch')
    };

    bindPreviewTabs();
    bindIndexEvents();
    bindDraftLoading();
    bindForm();
    bindDownloads();
    renderProjectMetadataWizard();
  }

  function bindPreviewTabs() {
    const activate = (target) => {
      const next = target || 'preview';
      elements.previewTabs.forEach((tab) => {
        const active = tab.dataset.projectMetadataPreviewTab === next;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      elements.previewPanels.forEach((panel) => {
        const active = panel.dataset.projectMetadataPreviewPanel === next;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    };
    elements.previewTabs.forEach((tab) => tab.addEventListener('click', () => activate(tab.dataset.projectMetadataPreviewTab)));
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
          applyProjectMetadataDraftToForm(JSON.parse(String(reader.result || '')), {fileName: file.name});
        } catch (err) {
          setStatus(elements.draftStatus, t('create.status.projectMetadataParseFailed', 'Game Info draft parse failed: {error}').replace('{error}', err.message), 'warning');
          renderProjectMetadataWizard();
        }
      };
      reader.onerror = () => setStatus(elements.draftStatus, t('create.status.projectMetadataReadFailed', 'Game Info draft read failed.'), 'warning');
      reader.readAsText(file);
    });
  }

  function bindForm() {
    if (!elements.form) {
      return;
    }
    elements.form.addEventListener('input', () => renderProjectMetadataWizard());
    elements.form.addEventListener('change', () => renderProjectMetadataWizard());
    elements.form.addEventListener('submit', (event) => {
      event.preventDefault();
      renderProjectMetadataWizard();
    });
    if (elements.generateIfid) {
      elements.generateIfid.addEventListener('click', () => {
        const apiCore = projectMetadataApi();
        const field = global.document.getElementById('project-metadata-ifid');
        if (field && apiCore && typeof apiCore.generateIfid === 'function') {
          field.value = apiCore.generateIfid();
          renderProjectMetadataWizard();
        }
      });
    }
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

  function setProjectIndex(index, meta) {
    state.projectIndex = index || null;
    const apiCore = projectMetadataApi();
    state.metadataModel = apiCore && typeof apiCore.buildMetadataModel === 'function'
      ? apiCore.buildMetadataModel(state.projectIndex)
      : null;
    if (!elements) {
      return;
    }
    const name = meta && meta.file && meta.file.name ? meta.file.name : t('create.status.projectIndexLoaded', 'ProjectIndex loaded.');
    setStatus(elements.indexStatus, name, 'ready');
    if (apiCore && typeof apiCore.defaultDraft === 'function' && !state.lastDraft) {
      applyProjectMetadataDraftToForm(apiCore.defaultDraft(state.projectIndex), {fileName: t('create.status.defaultProjectMetadataDraft', 'Detected Game Info draft')});
      return;
    }
    renderProjectMetadataWizard();
  }

  function applyProjectMetadataDraftToForm(input, meta) {
    const apiCore = projectMetadataApi();
    const draft = apiCore && typeof apiCore.normalizeDraft === 'function' ? apiCore.normalizeDraft(input) : input;
    if (!draft || !elements) {
      return;
    }
    setFieldValue('project-metadata-id', draft.id);
    setFieldValue('project-metadata-title', draft.title);
    setFieldValue('project-metadata-game-title', draft.gameTitle);
    setFieldValue('project-metadata-author', draft.author);
    setFieldValue('project-metadata-ifid', draft.ifid);
    setStatus(elements.draftStatus, meta && meta.fileName
      ? t('create.status.loadedFile', 'Loaded {file}').replace('{file}', meta.fileName)
      : t('create.status.projectMetadataLoaded', 'Game Info draft loaded.'), 'ready');
    renderProjectMetadataWizard();
  }

  function renderProjectMetadataWizard() {
    if (!elements || !elements.form) {
      return;
    }
    const draft = draftFromForm();
    const output = renderProjectMetadataOutput(draft);
    state.lastDraft = draft;
    state.lastOutput = output;
    setStatus(elements.coreStatus, output.coreUsed
      ? t('create.status.projectMetadataCoreLoaded', 'Game Info model ready.')
      : t('create.status.projectMetadataCorePending', 'Game Info model pending.'), output.coreUsed ? 'ready' : 'warning');
    renderEvidence();
    renderDiagnostics(output.diagnostics);
    setText(elements.playerPreview, output.playerPreview);
    setText(elements.jsonPreview, output.draftJson);
    setText(elements.installPreview, renderInstallPreview(output));
    setText(elements.patchPreview, output.patchPreview);
  }

  function draftFromForm() {
    return {
      schemaVersion: '0.1',
      kind: 'project_metadata',
      id: normalizeIdentifier(fieldValue('project-metadata-id'), 'project_metadata_update'),
      title: fieldValue('project-metadata-title') || t('create.sample.projectMetadataTitle', 'Game Info Update'),
      gameTitle: fieldValue('project-metadata-game-title'),
      author: fieldValue('project-metadata-author'),
      ifid: fieldValue('project-metadata-ifid'),
      evidence: state.metadataModel || {}
    };
  }

  function renderProjectMetadataOutput(draft) {
    const apiCore = projectMetadataApi();
    if (apiCore && typeof apiCore.buildExportBundle === 'function') {
      const bundle = apiCore.buildExportBundle(draft, state.projectIndex);
      return {
        coreUsed: true,
        diagnostics: bundle.diagnostics || [],
        ok: bundle.ok,
        playerPreview: bundle.playerPreview || bundle.previewText || '',
        draftJson: bundle.draftJson || JSON.stringify(bundle.draft || draft, null, 2) + '\n',
        installNotes: bundle.installNotes || '',
        installChecklist: bundle.installChecklist || '',
        installPlanJson: bundle.installPlanJson || '',
        installPlan: bundle.installPlan || null,
        patchPreview: bundle.patchPreview || '',
        draftFileName: draft.id + '.project-metadata-draft.json',
        notesFileName: draft.id + '.install-notes.txt',
        installPlanFileName: draft.id + '.install-plan.json',
        patchPreviewFileName: draft.id + '.patch-preview.diff'
      };
    }
    return {
      coreUsed: false,
      diagnostics: [{severity: 'warning', code: 'project_metadata_ui.core_missing', message: t('create.status.projectMetadataCoreMissing', 'ProjectMetadataDraft core is not loaded.')}],
      ok: false,
      playerPreview: renderFallbackPreview(draft),
      draftJson: JSON.stringify(draft, null, 2) + '\n',
      installNotes: 'Install manually: proposal only / not installed\n',
      installChecklist: '',
      installPlanJson: '',
      installPlan: null,
      patchPreview: '',
      draftFileName: draft.id + '.project-metadata-draft.json',
      notesFileName: draft.id + '.install-notes.txt',
      installPlanFileName: draft.id + '.install-plan.json',
      patchPreviewFileName: draft.id + '.patch-preview.diff'
    };
  }

  function renderFallbackPreview(draft) {
    return [
      'Game Info',
      'Title: ' + (draft.gameTitle || '(missing title)'),
      'Author: ' + (draft.author || '(missing author)'),
      'IFID: ' + (draft.ifid || '(unchanged / missing)')
    ].join('\n') + '\n';
  }

  function renderEvidence() {
    if (!elements.evidence) {
      return;
    }
    const model = state.metadataModel;
    if (!model || !model.fields) {
      elements.evidence.innerHTML = '<div class="metadata-evidence-row warning"><strong>' +
        escapeHtml(t('projectMetadata.evidence.missing', 'missing')) +
        '</strong><span>' +
        escapeHtml(t('projectMetadata.evidence.noIndex', 'Open or index a project to see source evidence.')) +
        '</span><small>' +
        escapeHtml(t('projectMetadata.evidence.manual', 'needs review')) +
        '</small></div>';
      return;
    }
    const rows = ['title', 'author', 'ifid'].map((key) => {
      const field = model.fields[key] || {};
      const stateLabel = field.exists
        ? (field.line ? t('projectMetadata.evidence.guarded', 'guarded') : t('projectMetadata.evidence.manual', 'needs review'))
        : t('projectMetadata.evidence.missing', 'missing');
      return '<div class="metadata-evidence-row ' + (field.exists && field.line ? 'ready' : 'warning') + '">' +
        '<strong>' + escapeHtml(key) + '</strong>' +
        '<span>' + escapeHtml(field.value || '(empty)') + '</span>' +
        '<small>' + escapeHtml(stateLabel + (field.line ? ' / source/info.dry:' + field.line : '')) + '</small>' +
        '</div>';
    }).join('');
    elements.evidence.innerHTML = rows +
      '<div class="metadata-save-warning">' + escapeHtml(t('projectMetadata.saveWarning', 'Changing title or author changes the Dendry local-save prefix; old browser saves may appear under the previous name.')) + '</div>';
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
      const severity = escapeHtml(diag.severity || 'info');
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
    renderProjectMetadataWizard();
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

  function projectMetadataApi() {
    return global.ProjectMapProjectMetadataDraft || null;
  }

  function normalizeIdentifier(value, fallback) {
    let text = String(value || fallback || '')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!text) {
      text = fallback || 'project_metadata_update';
    }
    if (!/^[A-Za-z_]/.test(text)) {
      text = 'metadata_' + text;
    }
    return text || fallback || 'project_metadata_update';
  }

  function downloadText(fileName, text, type) {
    const blob = new Blob([text || ''], {type: type || 'text/plain'});
    const url = URL.createObjectURL(blob);
    const anchor = global.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName || 'project-metadata.txt';
    global.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
})(typeof window !== 'undefined' ? window : globalThis);
