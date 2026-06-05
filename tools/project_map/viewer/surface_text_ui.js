(function initProjectMapSurfaceTextWizard(global) {
  'use strict';

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const escapeHtml = domTextUtils.escapeHtml;

  const EVENT_NAMES = [
    'project-map:index-loaded',
    'ProjectMap:index-loaded',
    'projectmap:index-loaded',
    'ProjectMapIndexLoaded',
    'project-map:model-loaded'
  ];

  const state = {
    projectIndex: null,
    lastDraft: null,
    lastOutput: null
  };

  let elements = null;

  const api = {
    setProjectIndex,
    setIndex: setProjectIndex,
    applySurfaceTextDraftToForm,
    loadDraft: applySurfaceTextDraftToForm,
    refresh: () => renderSurfaceWizard(),
    getDraft: () => state.lastDraft,
    getOutput: () => state.lastOutput
  };

  global.ProjectMapSurfaceTextWizard = api;

  if (!global || !global.document) {
    return;
  }

  onReady(() => startSurfaceWizard(global.document));

  function onReady(callback) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function'
      ? i18n.t(key, fallback)
      : fallback;
  }

  function startSurfaceWizard(document) {
    elements = {
      form: document.getElementById('surface-text-form'),
      draftFile: document.getElementById('surface-draft-file'),
      draftStatus: document.getElementById('surface-draft-status'),
      indexStatus: document.getElementById('surface-index-status'),
      coreStatus: document.getElementById('surface-core-status'),
      diagnostics: document.getElementById('surface-diagnostics'),
      playerPreview: document.getElementById('surface-player-preview'),
      proposalPreview: document.getElementById('surface-proposal-preview'),
      jsonPreview: document.getElementById('surface-json-preview'),
      installPreview: document.getElementById('surface-install-preview'),
      patchPreview: document.getElementById('surface-patch-preview'),
      previewTabs: Array.from(document.querySelectorAll('[data-surface-preview-tab]')),
      previewPanels: Array.from(document.querySelectorAll('[data-surface-preview-panel]')),
      downloadProposal: document.getElementById('surface-download-proposal'),
      downloadJson: document.getElementById('surface-download-json'),
      downloadNotes: document.getElementById('surface-download-notes'),
      downloadPlan: document.getElementById('surface-download-plan'),
      reviewInstall: document.getElementById('surface-review-install'),
      downloadPatch: document.getElementById('surface-download-patch')
    };

    bindPreviewTabs();
    bindIndexEvents();
    bindDraftLoading();
    bindForm();
    bindDownloads();
    bindLocaleRefresh();
    renderSurfaceWizard();
  }

  function bindPreviewTabs() {
    const activate = (target) => {
      const next = target || 'proposal';
      elements.previewTabs.forEach((tab) => {
        const active = tab.dataset.surfacePreviewTab === next;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      elements.previewPanels.forEach((panel) => {
        const active = panel.dataset.surfacePreviewPanel === next;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    };
    elements.previewTabs.forEach((tab) => tab.addEventListener('click', () => activate(tab.dataset.surfacePreviewTab)));
    activate('proposal');
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

  function bindLocaleRefresh() {
    global.document.addEventListener('project-map:locale-changed', () => {
      renderSurfaceWizard();
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
          applySurfaceTextDraftToForm(JSON.parse(String(reader.result || '')), {fileName: file.name});
        } catch (err) {
          setStatus(elements.draftStatus, t('create.status.textProposalParseFailed', 'Text proposal parse failed: {error}').replace('{error}', err.message), 'warning');
          renderSurfaceWizard();
        }
      };
      reader.onerror = () => setStatus(elements.draftStatus, t('create.status.textProposalReadFailed', 'Text proposal read failed.'), 'warning');
      reader.readAsText(file);
    });
  }

  function bindForm() {
    if (!elements.form) {
      return;
    }
    elements.form.addEventListener('input', () => renderSurfaceWizard());
    elements.form.addEventListener('change', () => renderSurfaceWizard());
    elements.form.addEventListener('submit', (event) => {
      event.preventDefault();
      renderSurfaceWizard();
    });
  }

  function bindDownloads() {
    if (elements.downloadProposal) {
      elements.downloadProposal.addEventListener('click', () => {
        const output = ensureDownloadableOutput();
        if (output) {
          downloadText(output.proposalFileName, output.proposal, 'text/plain');
        }
      });
    }
    if (elements.downloadJson) {
      elements.downloadJson.addEventListener('click', () => {
        const output = ensureDownloadableOutput();
        if (output) {
          downloadText(output.draftFileName, output.draftJson, 'application/json');
        }
      });
    }
    if (elements.downloadNotes) {
      elements.downloadNotes.addEventListener('click', () => {
        const output = ensureDownloadableOutput();
        if (output) {
          downloadText(output.notesFileName, output.installNotes, 'text/plain');
        }
      });
    }
    if (elements.downloadPlan) {
      elements.downloadPlan.addEventListener('click', () => {
        const output = ensureDownloadableOutput();
        if (output) {
          downloadText(output.installPlanFileName, output.installPlanJson, 'application/json');
        }
      });
    }
    if (elements.downloadPatch) {
      elements.downloadPatch.addEventListener('click', () => {
        const output = ensureDownloadableOutput();
        if (output) {
          downloadText(output.patchPreviewFileName, output.patchPreview, 'text/plain');
        }
      });
    }
    if (elements.reviewInstall) {
      elements.reviewInstall.addEventListener('click', () => {
        const output = ensureDownloadableOutput();
        if (output) {
          sendOutputToInstall(output.installPlanJson, output.installPlanFileName);
        }
      });
    }
  }

  function setProjectIndex(index, meta) {
    state.projectIndex = index || null;
    const name = meta && meta.file && meta.file.name ? meta.file.name : 'ProjectIndex loaded.';
    setStatus(elements.indexStatus, name, 'ready');
    renderSurfaceWizard();
  }

  function applySurfaceTextDraftToForm(input, meta) {
    const apiCore = surfaceTextDraftApi();
    const draft = apiCore ? apiCore.normalizeDraft(input) : input;
    if (!draft) {
      return;
    }
    setFieldValue('surface-id', draft.id);
    setFieldValue('surface-item-id', draft.itemId);
    setFieldValue('surface-area', draft.area);
    setFieldValue('surface-editability', draft.editability || 'ide_escape_hatch');
    setFieldValue('surface-label-original', draft.originalLabel);
    setFieldValue('surface-label-replacement', draft.replacementLabel);
    setFieldValue('surface-source-path', draft.source && draft.source.path);
    setFieldValue('surface-source-line', draft.source && draft.source.line);
    setFieldValue('surface-reason', draft.reason);
    setStatus(elements.draftStatus, meta && meta.fileName
      ? t('create.status.loadedFile', 'Loaded {file}').replace('{file}', meta.fileName)
      : t('create.status.textProposalLoaded', 'Text proposal loaded.'), 'ready');
    renderSurfaceWizard();
  }

  function renderSurfaceWizard() {
    if (!elements || !elements.form) {
      return;
    }
    const draft = draftFromForm();
    const output = renderSurfaceOutput(draft);
    state.lastDraft = draft;
    state.lastOutput = output;
    setStatus(elements.coreStatus, output.coreUsed
      ? t('create.status.surfaceCoreLoaded', 'SurfaceTextDraft core loaded.')
      : t('create.status.surfaceCorePending', 'SurfaceTextDraft core pending.'), output.coreUsed ? 'ready' : 'warning');
    renderDiagnostics(output.diagnostics);
    renderMeaningPreview(elements.playerPreview, draft, {projectIndex: state.projectIndex, sourceKind: 'surface_text'}, renderPlayerPreview(draft));
    setText(elements.proposalPreview, output.proposal);
    setText(elements.jsonPreview, output.draftJson);
    setText(elements.installPreview, renderInstallPreview(output));
    setText(elements.patchPreview, output.patchPreview);
  }

  function draftFromForm() {
    return {
      schemaVersion: '0.1',
      kind: 'surface_text',
      id: normalizeIdentifier(fieldValue('surface-id'), 'rename_surface_label'),
      itemId: fieldValue('surface-item-id'),
      area: fieldValue('surface-area'),
      originalLabel: fieldValue('surface-label-original'),
      replacementLabel: fieldValue('surface-label-replacement'),
      editability: fieldValue('surface-editability') || 'ide_escape_hatch',
      source: {
        path: fieldValue('surface-source-path'),
        line: numberValue('surface-source-line')
      },
      reason: fieldValue('surface-reason')
    };
  }

  function renderPlayerPreview(draft) {
    const apiCore = global.ProjectMapPreviewModel;
    if (apiCore && typeof apiCore.renderPreviewText === 'function') {
      try {
        return apiCore.renderPreviewText(draft, {projectIndex: state.projectIndex, sourceKind: 'surface_text'});
      } catch (err) {
        return renderFallbackPlayerPreview(draft);
      }
    }
    return renderFallbackPlayerPreview(draft);
  }

  function renderMeaningPreview(element, input, options, fallbackText) {
    const ui = global.ProjectMapMeaningLayerUi;
    if (ui && typeof ui.renderPreviewElement === 'function') {
      ui.renderPreviewElement(element, input, options, fallbackText);
    } else {
      setText(element, fallbackText || '');
    }
  }

  function renderFallbackPlayerPreview(draft) {
    return [
      'Text replacement proposal',
      'Area: ' + (draft.area || '(unknown area)'),
      '',
      'Before: ' + (draft.originalLabel || '(empty)'),
      'After:  ' + (draft.replacementLabel || '(empty)'),
      '',
      draft.editability === 'draft_exportable'
        ? 'Install: guarded source-backed replacement if the original text still matches.'
        : 'Install: use a source-backed edit route or advanced apply when the owner is protected.'
    ].join('\n') + '\n';
  }

  function renderSurfaceOutput(draft) {
    const apiCore = surfaceTextDraftApi();
    if (apiCore && typeof apiCore.buildExportBundle === 'function') {
      const bundle = apiCore.buildExportBundle(draft, state.projectIndex);
      return {
        coreUsed: true,
        diagnostics: bundle.diagnostics || [],
        ok: bundle.ok,
        proposal: bundle.proposal || '',
        draftJson: bundle.draftJson || JSON.stringify(bundle.draft || draft, null, 2) + '\n',
        installNotes: bundle.installNotes || '',
        installChecklist: bundle.installChecklist || '',
        installPlanJson: bundle.installPlanJson || '',
        patchPreview: bundle.patchPreview || '',
        proposalFileName: draft.id + '.surface-text-proposal.txt',
        draftFileName: draft.id + '.surface-text-draft.json',
        notesFileName: draft.id + '.install-notes.txt',
        installPlanFileName: draft.id + '.install-plan.json',
        patchPreviewFileName: draft.id + '.patch-preview.diff'
      };
    }
    return {
      coreUsed: false,
      diagnostics: [{severity: 'warning', code: 'surface_ui.core_missing', message: t('create.status.surfaceCoreMissing', 'SurfaceTextDraft core is not loaded.')}],
      ok: false,
      proposal: '',
      draftJson: JSON.stringify(draft, null, 2) + '\n',
      installNotes: 'Install manually: proposal only / not installed\n',
      installChecklist: '',
      installPlanJson: '',
      patchPreview: '',
      proposalFileName: draft.id + '.surface-text-proposal.txt',
      draftFileName: draft.id + '.surface-text-draft.json',
      notesFileName: draft.id + '.install-notes.txt',
      installPlanFileName: draft.id + '.install-plan.json',
      patchPreviewFileName: draft.id + '.patch-preview.diff'
    };
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

  function ensureDownloadableOutput() {
    renderSurfaceWizard();
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
      field.value = value === null || value === undefined ? '' : String(value);
    }
  }

  function numberValue(id) {
    const value = fieldValue(id);
    if (value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function normalizeIdentifier(value, fallback) {
    const text = String(value || '').trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+/, '');
    return /^[A-Za-z_]/.test(text) ? text : fallback;
  }

  function setStatus(element, message, className) {
    if (!element) {
      return;
    }
    element.textContent = message;
    element.classList.remove('ready', 'warning');
    if (className) {
      element.classList.add(className);
    }
  }

  function setText(element, value) {
    if (element) {
      element.textContent = value || '';
    }
  }

  function surfaceTextDraftApi() {
    return global.ProjectMapSurfaceTextDraft || null;
  }

  function downloadText(filename, content, mimeType) {
    const blob = new Blob([content || ''], {type: mimeType || 'text/plain'});
    const url = URL.createObjectURL(blob);
    const link = global.document.createElement('a');
    link.href = url;
    link.download = filename;
    global.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

})(typeof window !== 'undefined' ? window : globalThis);
