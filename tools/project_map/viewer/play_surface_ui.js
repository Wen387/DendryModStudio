(function initProjectMapPlaySurfaceWizard(global) {
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
    surfaceModel: null,
    lastDraft: null,
    lastOutput: null,
    hasUserEdited: false
  };

  let elements = null;

  const api = {
    setProjectIndex,
    setIndex: setProjectIndex,
    applyPlaySurfaceDraftToForm,
    loadDraft: applyPlaySurfaceDraftToForm,
    refresh: () => renderPlaySurfaceWizard(),
    getDraft: () => state.lastDraft,
    getOutput: () => state.lastOutput
  };

  global.ProjectMapPlaySurfaceWizard = api;

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
      form: document.getElementById('play-surface-form'),
      draftFile: document.getElementById('play-surface-draft-file'),
      draftStatus: document.getElementById('play-surface-draft-status'),
      indexStatus: document.getElementById('play-surface-index-status'),
      coreStatus: document.getElementById('play-surface-core-status'),
      diagnostics: document.getElementById('play-surface-diagnostics'),
      readiness: document.getElementById('play-surface-readiness'),
      playerPreview: document.getElementById('play-surface-player-preview'),
      jsonPreview: document.getElementById('play-surface-json-preview'),
      installPreview: document.getElementById('play-surface-install-preview'),
      patchPreview: document.getElementById('play-surface-patch-preview'),
      previewTabs: Array.from(document.querySelectorAll('[data-play-surface-preview-tab]')),
      previewPanels: Array.from(document.querySelectorAll('[data-play-surface-preview-panel]')),
      downloadJson: document.getElementById('play-surface-download-json'),
      downloadNotes: document.getElementById('play-surface-download-notes'),
      downloadPlan: document.getElementById('play-surface-download-plan'),
      downloadPatch: document.getElementById('play-surface-download-patch'),
      reviewInstall: document.getElementById('play-surface-review-install')
    };
    bindPreviewTabs();
    bindIndexEvents();
    bindDraftLoading();
    bindForm();
    bindDownloads();
    renderPlaySurfaceWizard();
  }

  function bindPreviewTabs() {
    const activate = (target) => {
      const next = target || 'preview';
      elements.previewTabs.forEach((tab) => {
        const active = tab.dataset.playSurfacePreviewTab === next;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      elements.previewPanels.forEach((panel) => {
        const active = panel.dataset.playSurfacePreviewPanel === next;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    };
    elements.previewTabs.forEach((tab) => tab.addEventListener('click', () => activate(tab.dataset.playSurfacePreviewTab)));
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
          applyPlaySurfaceDraftToForm(JSON.parse(String(reader.result || '')), {fileName: file.name});
        } catch (err) {
          setStatus(elements.draftStatus, t('create.status.playSurfaceDraftParseFailed', 'Playable surface draft parse failed: {error}').replace('{error}', err.message), 'warning');
          renderPlaySurfaceWizard();
        }
      };
      reader.onerror = () => setStatus(elements.draftStatus, t('create.status.playSurfaceDraftReadFailed', 'Playable surface draft read failed.'), 'warning');
      reader.readAsText(file);
    });
  }

  function bindForm() {
    if (!elements.form) {
      return;
    }
    const onUserEdit = () => {
      state.hasUserEdited = true;
      renderPlaySurfaceWizard();
    };
    elements.form.addEventListener('input', onUserEdit);
    elements.form.addEventListener('change', onUserEdit);
    elements.form.addEventListener('submit', (event) => {
      event.preventDefault();
      renderPlaySurfaceWizard();
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
    state.surfaceModel = core && typeof core.buildSurfaceModel === 'function'
      ? core.buildSurfaceModel(index)
      : null;
    setStatus(elements.indexStatus, t('create.status.projectIndexLoaded', 'ProjectIndex loaded.'), 'ready');
    if (core && typeof core.defaultDraft === 'function' && (!state.lastDraft || (!hasSurfaceEvidence(state.lastDraft.evidence) && !state.hasUserEdited))) {
      applyPlaySurfaceDraftToForm(core.defaultDraft(index), {fileName: t('create.status.defaultPlaySurfaceDraft', 'Detected playable surface draft')});
      return;
    }
    renderPlaySurfaceWizard();
  }

  function applyPlaySurfaceDraftToForm(input, meta) {
    const core = coreApi();
    const draft = core && typeof core.normalizeDraft === 'function' ? core.normalizeDraft(input) : input;
    if (!draft) {
      return;
    }
    state.hasUserEdited = false;
    setFieldValue('play-surface-id', draft.id);
    setFieldValue('play-surface-title', draft.title);
    [
      'handTitle',
      'handHeading',
      'handBody',
      'handDeckOptionLabel',
      'handAdvisorOptionLabel',
      'deckTitle',
      'deckSubtitle',
      'cardTitle',
      'cardHeading',
      'cardBody',
      'cardOption0Label',
      'cardOption1Label',
      'advisorTitle',
      'advisorSubtitle',
      'advisorHeading',
      'advisorBody',
      'advisorOption0Label'
    ].forEach((key) => setFieldValue('play-surface-' + kebab(key), draft[key]));
    setStatus(elements.draftStatus, meta && meta.fileName
      ? t('create.status.loadedFile', 'Loaded {file}').replace('{file}', meta.fileName)
      : t('create.status.playSurfaceDraftLoaded', 'Playable surface draft loaded.'), 'ready');
    renderPlaySurfaceWizard();
  }

  function renderPlaySurfaceWizard() {
    if (!elements || !elements.form) {
      return;
    }
    const core = coreApi();
    if (!core) {
      setStatus(elements.coreStatus, t('create.status.playSurfaceCorePending', 'Playable Surface core pending.'), 'warning');
      return;
    }
    setStatus(elements.coreStatus, t('create.status.playSurfaceCoreLoaded', 'Playable Surface core loaded.'), 'ready');
    const draft = collectDraft();
    const output = core.buildExportBundle(draft, state.projectIndex || {});
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
    const evidence = hasSurfaceEvidence(state.lastDraft && state.lastDraft.evidence)
      ? state.lastDraft.evidence
      : state.surfaceModel || {};
    return {
      id: fieldValue('play-surface-id') || 'play_surface_update',
      title: fieldValue('play-surface-title') || 'Playable Surface Update',
      handTitle: fieldValue('play-surface-hand-title'),
      handHeading: fieldValue('play-surface-hand-heading'),
      handBody: fieldValue('play-surface-hand-body'),
      handDeckOptionLabel: fieldValue('play-surface-hand-deck-option-label'),
      handAdvisorOptionLabel: fieldValue('play-surface-hand-advisor-option-label'),
      deckTitle: fieldValue('play-surface-deck-title'),
      deckSubtitle: fieldValue('play-surface-deck-subtitle'),
      cardTitle: fieldValue('play-surface-card-title'),
      cardHeading: fieldValue('play-surface-card-heading'),
      cardBody: fieldValue('play-surface-card-body'),
      cardOption0Label: fieldValue('play-surface-card-option0-label'),
      cardOption1Label: fieldValue('play-surface-card-option1-label'),
      advisorTitle: fieldValue('play-surface-advisor-title'),
      advisorSubtitle: fieldValue('play-surface-advisor-subtitle'),
      advisorHeading: fieldValue('play-surface-advisor-heading'),
      advisorBody: fieldValue('play-surface-advisor-body'),
      advisorOption0Label: fieldValue('play-surface-advisor-option0-label'),
      evidence
    };
  }

  function renderReadiness() {
    if (!elements.readiness) {
      return;
    }
    const rows = state.surfaceModel && state.surfaceModel.readiness || [];
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
    const draftId = output && output.draft && output.draft.id || 'play_surface_update';
    return Object.assign({}, output || {}, {
      draftFileName: draftId + '.play-surface-draft.json',
      notesFileName: draftId + '.install-notes.txt',
      installPlanFileName: draftId + '.install-plan.json',
      patchPreviewFileName: draftId + '.patch-preview.diff'
    });
  }

  function ensureOutput() {
    renderPlaySurfaceWizard();
    return state.lastOutput || null;
  }

  function sendOutputToInstall(json, fileName) {
    const assistant = global.ProjectMapInstallAssistant;
    if (assistant && typeof assistant.loadPlanText === 'function') {
      assistant.loadPlanText(json, {fileName: fileName || 'play-surface.install-plan.json'});
    } else if (assistant && typeof assistant.loadPlan === 'function') {
      try {
        assistant.loadPlan(JSON.parse(json), {fileName: fileName || 'play-surface.install-plan.json'});
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
    return global.ProjectMapPlaySurfaceDraft || null;
  }

  function hasSurfaceEvidence(value) {
    return Boolean(value && value.hand && value.hand.exists);
  }

  function setFieldValue(id, value) {
    const field = global.document.getElementById(id);
    if (field) {
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

  function kebab(value) {
    return String(value || '').replace(/[A-Z]/g, (match) => '-' + match.toLowerCase());
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
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
