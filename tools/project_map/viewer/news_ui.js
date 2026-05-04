(function initProjectMapNewsWizard(global) {
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
    lastDraft: null,
    lastOutput: null
  };

  let elements = null;

  const api = {
    setProjectIndex,
    setIndex: setProjectIndex,
    applyNewsDraftToForm,
    loadDraft: applyNewsDraftToForm,
    refresh: () => renderNewsWizard(),
    getDraft: () => state.lastDraft,
    getOutput: () => state.lastOutput
  };

  global.ProjectMapNewsWizard = api;

  if (!global || !global.document) {
    return;
  }

  onReady(() => startNewsWizard(global.document));

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

  function startNewsWizard(document) {
    elements = {
      templateButtons: Array.from(document.querySelectorAll('[data-create-template]')),
      templatePanels: Array.from(document.querySelectorAll('[data-create-template-panel]')),
      form: document.getElementById('news-wizard-form'),
      draftFile: document.getElementById('news-draft-file'),
      draftStatus: document.getElementById('news-draft-status'),
      indexStatus: document.getElementById('news-index-status'),
      coreStatus: document.getElementById('news-core-status'),
      delivery: document.getElementById('news-delivery'),
      deliverySections: Array.from(document.querySelectorAll('[data-news-delivery-section]')),
      diagnostics: document.getElementById('news-diagnostics'),
      playerPreview: document.getElementById('news-player-preview'),
      snippetPreview: document.getElementById('news-snippet-preview'),
      jsonPreview: document.getElementById('news-json-preview'),
      installPreview: document.getElementById('news-install-preview'),
      patchPreview: document.getElementById('news-patch-preview'),
      previewTabs: Array.from(document.querySelectorAll('[data-news-preview-tab]')),
      previewPanels: Array.from(document.querySelectorAll('[data-news-preview-panel]')),
      downloadSnippet: document.getElementById('news-download-snippet'),
      downloadJson: document.getElementById('news-download-json'),
      downloadNotes: document.getElementById('news-download-notes'),
      downloadPlan: document.getElementById('news-download-plan'),
      reviewInstall: document.getElementById('news-review-install'),
      downloadPatch: document.getElementById('news-download-patch')
    };

    bindTemplateSwitch();
    bindPreviewTabs();
    bindIndexEvents();
    bindDraftLoading();
    bindForm();
    bindDownloads();
    bindLocaleRefresh();
    updateDeliverySections();
    renderNewsWizard();
  }

  function bindTemplateSwitch() {
    elements.templateButtons.forEach((button) => {
      button.addEventListener('click', () => setCreateTemplate(button.dataset.createTemplate));
    });
  }

  function setCreateTemplate(template) {
    const templates = new Set(['event', 'news', 'card', 'play_surface', 'workspace_layout', 'sidebar_status', 'surface', 'entry', 'project', 'variables']);
    const next = templates.has(template) ? template : 'event';
    elements.templateButtons.forEach((button) => {
      const active = button.dataset.createTemplate === next;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    elements.templatePanels.forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.createTemplatePanel !== next);
    });
    if (next === 'news') {
      renderNewsWizard();
    }
    global.document.dispatchEvent(new CustomEvent('ProjectMap:create-template-changed', {
      detail: {template: next}
    }));
  }

  function bindPreviewTabs() {
    const activate = (target) => {
      const next = target || 'snippet';
      elements.previewTabs.forEach((tab) => {
        const active = tab.dataset.newsPreviewTab === next;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      elements.previewPanels.forEach((panel) => {
        const active = panel.dataset.newsPreviewPanel === next;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    };
    elements.previewTabs.forEach((tab) => {
      tab.addEventListener('click', () => activate(tab.dataset.newsPreviewTab));
    });
    activate('snippet');
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
      renderNewsWizard();
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
          applyNewsDraftToForm(JSON.parse(String(reader.result || '')), {fileName: file.name});
        } catch (err) {
          setDraftStatus(t('create.status.newsDraftParseFailed', 'News draft parse failed: {error}').replace('{error}', err.message), 'warning');
          renderNewsWizard();
        }
      };
      reader.onerror = () => setDraftStatus(t('create.status.newsDraftReadFailed', 'News draft read failed.'), 'warning');
      reader.readAsText(file);
    });
  }

  function bindForm() {
    if (!elements.form) {
      return;
    }
    elements.form.addEventListener('input', () => renderNewsWizard());
    elements.form.addEventListener('change', () => {
      updateDeliverySections();
      renderNewsWizard();
    });
    elements.form.addEventListener('submit', (event) => {
      event.preventDefault();
      renderNewsWizard();
    });
  }

  function bindDownloads() {
    if (elements.downloadSnippet) {
      elements.downloadSnippet.addEventListener('click', () => {
        const output = ensureDownloadableOutput();
        if (output) {
          downloadText(output.snippetFileName, output.snippet, 'text/plain');
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
    setIndexStatus(name, 'ready');
    renderNewsWizard();
  }

  function applyNewsDraftToForm(input, meta) {
    const apiCore = newsDraftApi();
    const draft = apiCore ? apiCore.normalizeDraft(input) : input;
    if (!draft) {
      return;
    }
    setFieldValue('news-id', draft.id);
    setFieldValue('news-headline', draft.headline);
    setFieldValue('news-description', draft.description);
    setFieldValue('news-delivery', draft.delivery || 'dated');
    if (draft.when) {
      setFieldValue('news-year', draft.when.year);
      setFieldValue('news-month', draft.when.month);
      setFieldValue('news-slot', draft.when.slot);
      setFieldValue('news-dated-requires-js', draft.when.requiresJs);
    }
    if (draft.pool) {
      setFieldValue('news-pool-name', draft.pool.name);
      setFieldValue('news-pool-requires-js', draft.pool.requiresJs);
    }
    setDraftStatus(meta && meta.fileName
      ? t('create.status.loadedFile', 'Loaded {file}').replace('{file}', meta.fileName)
      : t('create.status.newsDraftLoaded', 'News draft loaded.'), 'ready');
    updateDeliverySections();
    renderNewsWizard();
  }

  function renderNewsWizard() {
    if (!elements || !elements.form) {
      return;
    }
    const draft = draftFromForm();
    const output = renderNewsOutput(draft);
    state.lastDraft = draft;
    state.lastOutput = output;
    setCoreStatus(output.coreUsed
      ? t('create.status.newsCoreLoaded', 'NewsDraft core loaded.')
      : t('create.status.newsCorePending', 'NewsDraft core pending.'), output.coreUsed ? 'ready' : 'warning');
    renderDiagnostics(output.diagnostics);
    renderMeaningPreview(elements.playerPreview, draft, {projectIndex: state.projectIndex, sourceKind: 'news'}, renderPlayerPreview(draft));
    setText(elements.snippetPreview, output.snippet);
    setText(elements.jsonPreview, output.draftJson);
    setText(elements.installPreview, renderInstallPreview(output));
    setText(elements.patchPreview, output.patchPreview);
  }

  function draftFromForm() {
    const delivery = fieldValue('news-delivery') || 'dated';
    return {
      schemaVersion: '0.1',
      kind: 'news_item',
      id: normalizeIdentifier(fieldValue('news-id'), 'new_news_item'),
      headline: fieldValue('news-headline'),
      description: fieldValue('news-description'),
      delivery,
      when: {
        year: numberValue('news-year'),
        month: numberValue('news-month'),
        slot: numberValue('news-slot'),
        requiresJs: fieldValue('news-dated-requires-js')
      },
      pool: {
        name: fieldValue('news-pool-name') || 'social_pool',
        requiresJs: fieldValue('news-pool-requires-js')
      }
    };
  }

  function renderPlayerPreview(draft) {
    const apiCore = global.ProjectMapPreviewModel;
    if (apiCore && typeof apiCore.renderPreviewText === 'function') {
      try {
        return apiCore.renderPreviewText(draft, {projectIndex: state.projectIndex, sourceKind: 'news'});
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
    const slot = draft.delivery === 'background_pool'
      ? (draft.pool && draft.pool.name ? draft.pool.name : 'background pool')
      : 'news_' + ((draft.when && draft.when.slot) || 1);
    return [
      draft.delivery === 'background_pool'
        ? 'Background news pool / ' + slot
        : String((draft.when && draft.when.year) || 'Year ?') + ' / month ' + String((draft.when && draft.when.month) || '?') + ' / ' + slot,
      draft.headline || '(untitled news)',
      draft.description || '(no description)'
    ].join('\n') + '\n';
  }

  function renderNewsOutput(draft) {
    const apiCore = newsDraftApi();
    if (apiCore && typeof apiCore.buildExportBundle === 'function') {
      try {
        const bundle = apiCore.buildExportBundle(draft, state.projectIndex);
        return normalizeBundleOutput(bundle, true);
      } catch (err) {
        return fallbackOutput(draft, [{severity: 'warning', message: t('create.status.newsCoreFailed', 'NewsDraft core failed: {error}').replace('{error}', err.message)}]);
      }
    }
    return fallbackOutput(draft, [{severity: 'info', message: t('create.status.newsCoreLocalPreview', 'NewsDraft core not loaded; local preview is limited.')}]);
  }

  function normalizeBundleOutput(bundle, coreUsed) {
    const files = bundle.files || [];
    const snippetFile = files.find((file) => file.kind === 'snippet') || {};
    const draftFile = files.find((file) => file.kind === 'draft') || {};
    const notesFile = files.find((file) => file.kind === 'notes') || {};
    const installPlanFile = files.find((file) => file.kind === 'install_plan') || {};
    const patchFile = files.find((file) => file.kind === 'patch_preview') || {};
    return {
      coreUsed,
      diagnostics: bundle.diagnostics || [],
      canDownload: !(bundle.diagnostics || []).some((diag) => diag.severity === 'error'),
      snippet: bundle.snippet || snippetFile.content || '',
      draftJson: bundle.draftJson || draftFile.content || '',
      installNotes: bundle.installNotes || notesFile.content || '',
      installChecklist: bundle.installChecklist || '',
      installPlanJson: bundle.installPlanJson || installPlanFile.content || '',
      patchPreview: bundle.patchPreview || patchFile.content || '',
      snippetFileName: snippetFile.path || 'news.post-event-news.snippet.js',
      draftFileName: draftFile.path || 'news.news-draft.json',
      notesFileName: notesFile.path || 'news.install-notes.txt',
      installPlanFileName: installPlanFile.path || 'news.install-plan.json',
      patchPreviewFileName: patchFile.path || 'news.patch-preview.diff'
    };
  }

  function fallbackOutput(draft, diagnostics) {
    const id = normalizeIdentifier(draft.id, 'news_item');
    const snippet = '// NewsDraft preview unavailable until news_draft.js loads: ' + id + '\n';
    return {
      coreUsed: false,
      diagnostics,
      canDownload: false,
      snippet,
      draftJson: JSON.stringify(draft, null, 2) + '\n',
      installNotes: 'Review source/scenes/post_event_news.scene.dry before applying any router change.\n',
      installChecklist: '',
      installPlanJson: '',
      patchPreview: '',
      snippetFileName: id + '.post-event-news.snippet.js',
      draftFileName: id + '.news-draft.json',
      notesFileName: id + '.install-notes.txt',
      installPlanFileName: id + '.install-plan.json',
      patchPreviewFileName: id + '.patch-preview.diff'
    };
  }

  function ensureDownloadableOutput() {
    renderNewsWizard();
    const output = state.lastOutput;
    if (!output || !output.canDownload) {
      setIndexStatus(t('create.status.fixNewsErrors', 'Resolve NewsDraft errors before downloading.'), 'warning');
      return null;
    }
    return output;
  }

  function renderInstallPreview(output) {
    return [output.installChecklist, output.installNotes].filter(Boolean).join('\n');
  }

  function sendOutputToInstall(installPlanJson, fileName) {
    try {
      const plan = JSON.parse(String(installPlanJson || '{}'));
      const assistant = global.ProjectMapInstallAssistant;
      if (!assistant || typeof assistant.loadPlan !== 'function') {
        setIndexStatus('Install Assistant is not loaded.', 'warning');
        return;
      }
      assistant.loadPlan(plan, {fileName: fileName || plan.id || 'install-plan.json'});
      const installButton = global.document.querySelector('[data-mode="install"]');
      if (installButton) {
        installButton.click();
      }
    } catch (err) {
      setIndexStatus('Install plan is not valid JSON: ' + err.message, 'warning');
    }
  }

  function updateDeliverySections() {
    const delivery = fieldValue('news-delivery') || 'dated';
    elements.deliverySections.forEach((section) => {
      section.classList.toggle('hidden', section.dataset.newsDeliverySection !== delivery);
    });
  }

  function renderDiagnostics(diagnostics) {
    if (!elements.diagnostics) {
      return;
    }
    elements.diagnostics.innerHTML = '';
    (diagnostics || []).forEach((diag) => {
      const item = global.document.createElement('div');
      const level = diag.severity || diag.level || 'info';
      item.className = 'diagnostic-item ' + level;
      item.textContent = (diag.code ? diag.code + ': ' : '') + (diag.message || '');
      elements.diagnostics.appendChild(item);
    });
    if (!diagnostics || diagnostics.length === 0) {
      const item = global.document.createElement('div');
      item.className = 'diagnostic-item ok';
      item.textContent = t('create.status.newsDraftRenderable', 'News draft is renderable.');
      elements.diagnostics.appendChild(item);
    }
  }

  function newsDraftApi() {
    return global.ProjectMapNewsDraft || null;
  }

  function setCoreStatus(message, kind) {
    setStatus(elements.coreStatus, message, kind);
  }

  function setDraftStatus(message, kind) {
    setStatus(elements.draftStatus, message, kind);
  }

  function setIndexStatus(message, kind) {
    setStatus(elements.indexStatus, message, kind);
  }

  function setStatus(element, message, kind) {
    if (!element) {
      return;
    }
    element.textContent = message;
    element.classList.toggle('is-ready', kind === 'ready');
    element.classList.toggle('is-warning', kind === 'warning');
    element.classList.toggle('is-error', kind === 'error');
  }

  function setText(element, value) {
    if (element) {
      element.textContent = value || '';
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

  function numberValue(id) {
    const text = fieldValue(id);
    if (!text) {
      return null;
    }
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  }

  function normalizeIdentifier(value, fallback) {
    const text = String(value || '').trim().replace(/[^A-Za-z0-9_]/g, '_').replace(/^([^A-Za-z_])/, '_$1');
    return text || fallback;
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
})(typeof window !== 'undefined' ? window : globalThis);
