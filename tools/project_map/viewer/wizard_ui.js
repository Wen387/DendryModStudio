(function initProjectMapWizard(global) {
  'use strict';

  const EVENT_NAMES = [
    'project-map:index-loaded',
    'ProjectMap:index-loaded',
    'projectmap:index-loaded',
    'ProjectMapIndexLoaded',
    'project-map:model-loaded'
  ];

  const MIN_OPTION_COUNT = 2;
  const MAX_OPTION_COUNT = 4;
  const CONDITION_KEYWORDS = new Set([
    'and', 'or', 'not', 'if', 'else', 'true', 'false', 'null', 'undefined',
    'in', 'is', 'Q', 'Math'
  ]);
  const CONDITION_BUILTINS = new Set(['year', 'month', 'week', 'time']);

  const state = {
    projectIndex: null,
    projectModel: null,
    variableNames: new Set(),
    variableCandidates: [],
    sceneIds: new Set(),
    lastDraft: null,
    lastOutput: null,
    lastIndexLabel: '',
    lastConditionFieldId: 'wizard-requires',
    loadedDraftExtras: {},
    loadedOptionExtras: []
  };

  let elements = null;

  const api = {
    setProjectIndex,
    setIndex: setProjectIndex,
    setProjectModel,
    setMode,
    applyEventDraftToForm,
    loadDraft: applyEventDraftToForm,
    refresh: () => renderWizard(),
    getDraft: () => state.lastDraft,
    getOutput: () => state.lastOutput,
    helpers: {
      effectsToText,
      effectsFromText,
      variantsToText,
      variantsFromText
    },
    getState: () => ({
      projectIndex: state.projectIndex,
      projectModel: state.projectModel,
      variableCount: state.variableNames.size,
      sceneCount: state.sceneIds.size
    })
  };

  global.ProjectMapWizard = api;

  if (!global || !global.document) {
    return;
  }

  onReady(() => startWizard(global.document));

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

  function startWizard(document) {
    elements = {
      body: document.body,
      modeButtons: Array.from(document.querySelectorAll('[data-mode]')),
      explorePane: document.getElementById('explore-pane'),
      designPane: document.getElementById('design-pane'),
      createPane: document.getElementById('create-pane'),
      installPane: document.getElementById('install-pane'),
      dropTarget: document.getElementById('index-drop-target'),
      file: document.getElementById('index-file'),
      draftFile: document.getElementById('wizard-draft-file'),
      draftStatus: document.getElementById('wizard-draft-status'),
      form: document.getElementById('event-wizard-form'),
      eventAdvanced: document.getElementById('wizard-event-advanced'),
      seenFlag: document.getElementById('wizard-seen-flag'),
      triggerEffects: document.getElementById('wizard-trigger-effects'),
      assetRefs: document.getElementById('wizard-asset-refs'),
      assetFile: document.getElementById('wizard-asset-file'),
      assetInstallRequests: document.getElementById('wizard-asset-install-requests'),
      draftAssetPanel: document.getElementById('wizard-draft-asset-panel'),
      assetPicker: document.getElementById('wizard-asset-picker'),
      assetManifest: document.getElementById('wizard-asset-manifest'),
      variableSearch: document.getElementById('wizard-variable-search'),
      variableCandidates: document.getElementById('wizard-variable-candidates'),
      optionCount: document.getElementById('wizard-option-count'),
      optionBlocks: Array.from(document.querySelectorAll('[data-option-index]')),
      optionAdvanced: Array.from(document.querySelectorAll('[data-option-advanced-index]')),
      effectTarget: document.getElementById('wizard-effect-target'),
      effectVariable: document.getElementById('wizard-effect-variable'),
      effectVariableOptions: document.getElementById('wizard-effect-variable-options'),
      effectOp: document.getElementById('wizard-effect-op'),
      effectValue: document.getElementById('wizard-effect-value'),
      effectAppend: document.getElementById('wizard-effect-append'),
      coreStatus: document.getElementById('wizard-core-status'),
      indexStatus: document.getElementById('wizard-index-status'),
      diagnostics: document.getElementById('wizard-diagnostics'),
      readiness: document.getElementById('event-readiness-checklist'),
      routeSummary: document.getElementById('event-route-summary'),
      playerPreview: document.getElementById('wizard-player-preview'),
      scenePreview: document.getElementById('wizard-scene-preview'),
      jsonPreview: document.getElementById('wizard-json-preview'),
      rootPreview: document.getElementById('wizard-root-preview'),
      migrationPreview: document.getElementById('wizard-migration-preview'),
      installPreview: document.getElementById('wizard-install-preview'),
      patchPreview: document.getElementById('wizard-patch-preview'),
      downloadScene: document.getElementById('wizard-download-scene'),
      downloadJson: document.getElementById('wizard-download-json'),
      downloadRoot: document.getElementById('wizard-download-root'),
      downloadMigration: document.getElementById('wizard-download-migration'),
      downloadPatch: document.getElementById('wizard-download-patch'),
      downloadPlan: document.getElementById('wizard-download-plan'),
      reviewInstall: document.getElementById('wizard-review-install'),
      downloadPatchPreview: document.getElementById('wizard-download-patch-preview'),
      previewTabs: Array.from(document.querySelectorAll('[data-preview-tab]')),
      previewPanels: Array.from(document.querySelectorAll('[data-preview-panel]'))
    };

    bindModeSwitch();
    bindIndexLoading();
    bindDraftLoading();
    bindForm();
    bindEffectHelper();
    bindVariableAssistant();
    bindAssetReferenceEvents();
    initPreviewTabs();
    bindDownloads();
    bindIndexEvents();
    bindLocaleRefresh();
    bindPageLifecycle();
    setMode('explore');
    renderWizard();
  }

  function bindModeSwitch() {
    elements.modeButtons.forEach((button) => {
      button.addEventListener('click', () => setMode(button.dataset.mode, {reason: 'user'}));
    });
  }

  function setMode(mode, options) {
    const nextMode = mode === 'create' || mode === 'install' || mode === 'design' ? mode : 'explore';
    const previousMode = elements.body.dataset.mode || '';
    const changed = previousMode !== nextMode;
    const detail = {
      previousMode,
      nextMode,
      reason: options && options.reason || 'programmatic',
      visible: !global.document.hidden
    };
    if (changed) {
      dispatchLifecycleEvent('ProjectMap:mode-changing', detail);
    }
    elements.body.dataset.mode = nextMode;
    elements.explorePane.classList.toggle('hidden', nextMode !== 'explore');
    if (elements.designPane) {
      elements.designPane.classList.toggle('hidden', nextMode !== 'design');
    }
    elements.createPane.classList.toggle('hidden', nextMode !== 'create');
    if (elements.installPane) {
      elements.installPane.classList.toggle('hidden', nextMode !== 'install');
    }
    elements.modeButtons.forEach((button) => {
      const active = button.dataset.mode === nextMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (nextMode === 'create') {
      renderWizard();
    }
    if (changed) {
      dispatchLifecycleEvent('ProjectMap:mode-changed', detail);
    }
  }

  function bindPageLifecycle() {
    if (!global.document || typeof global.document.addEventListener !== 'function') {
      return;
    }
    global.document.addEventListener('visibilitychange', () => {
      dispatchLifecycleEvent('ProjectMap:foreground-changed', {
        mode: elements && elements.body && elements.body.dataset.mode || '',
        visible: !global.document.hidden,
        visibilityState: global.document.visibilityState || ''
      });
    });
  }

  function dispatchLifecycleEvent(name, detail) {
    if (!global.document || typeof global.document.dispatchEvent !== 'function') {
      return;
    }
    let event;
    if (typeof global.CustomEvent === 'function') {
      event = new global.CustomEvent(name, {detail});
    } else {
      event = global.document.createEvent('CustomEvent');
      event.initCustomEvent(name, false, false, detail);
    }
    global.document.dispatchEvent(event);
  }

  function bindLocaleRefresh() {
    global.document.addEventListener('project-map:locale-changed', () => {
      renderWizard();
    });
  }

  function bindIndexLoading() {
    if (elements.file) {
      elements.file.addEventListener('change', (event) => {
        const file = event.target.files && event.target.files[0];
        if (file) {
          readProjectIndexFile(file);
        }
      });
    }

    const target = elements.dropTarget;
    if (!target) {
      return;
    }

    ['dragenter', 'dragover'].forEach((name) => {
      target.addEventListener(name, (event) => {
        event.preventDefault();
        target.classList.add('is-drag-over');
      });
    });

    ['dragleave', 'drop'].forEach((name) => {
      target.addEventListener(name, () => {
        target.classList.remove('is-drag-over');
      });
    });

    target.addEventListener('drop', (event) => {
      event.preventDefault();
      const files = event.dataTransfer && event.dataTransfer.files;
      const file = files && files[0];
      if (!file) {
        return;
      }
      if (elements.file) {
        try {
          elements.file.files = files;
          elements.file.dispatchEvent(new Event('change', {bubbles: true}));
          return;
        } catch (err) {
          setIndexStatus('Drop loaded for Create; use picker if Explore stays empty.', 'warning');
        }
      }
      readProjectIndexFile(file);
    });
  }

  function bindDraftLoading() {
    if (!elements.draftFile) {
      return;
    }
    elements.draftFile.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        readEventDraftFile(file);
      }
    });
  }

  function bindForm() {
    if (!elements.form) {
      return;
    }
    elements.form.addEventListener('input', () => renderWizard());
    elements.form.addEventListener('change', (event) => {
      if (event.target && event.target.id === 'wizard-asset-file') {
        handleAssetFileSelection(event.target.files);
        event.target.value = '';
      }
      renderWizard();
    });
    elements.form.addEventListener('focusin', (event) => {
      if (event.target && isConditionFieldId(event.target.id)) {
        state.lastConditionFieldId = event.target.id;
      }
    });
    elements.form.addEventListener('click', (event) => {
      const variableButton = event.target.closest('[data-variable-action]');
      if (variableButton) {
        handleVariableCandidateAction(variableButton);
        return;
      }
      const button = event.target.closest('[data-asset-picker-action="select"]');
      if (!button) {
        return;
      }
      appendAssetRefToField('wizard-asset-refs', parseAssetRefPayload(button.dataset.assetRef));
      renderWizard();
    });
    elements.form.addEventListener('submit', (event) => {
      event.preventDefault();
      renderWizard();
    });
  }

  function bindVariableAssistant() {
    if (!elements.variableSearch) {
      return;
    }
    elements.variableSearch.addEventListener('input', () => renderVariableAssistant());
  }

  function bindEffectHelper() {
    if (!elements.effectAppend) {
      return;
    }
    elements.effectAppend.addEventListener('click', () => {
      const variable = normalizeIdentifier(fieldValue('wizard-effect-variable'), '');
      const op = fieldValue('wizard-effect-op') || '+=';
      const value = fieldValue('wizard-effect-value') || '1';
      if (!variable) {
        setIndexStatus('Effect variable is required.', 'warning');
        return;
      }
      const line = variable + ' ' + op + ' ' + value;
      const target = fieldValue('wizard-effect-target');
      const targetId = target === 'trigger'
        ? 'wizard-trigger-effects'
        : 'wizard-option-' + Number(String(target).split(':')[1] || 0) + '-effects';
      appendLineToField(targetId, line);
      setFieldValue('wizard-effect-variable', '');
      renderWizard();
    });
  }

  function bindAssetReferenceEvents() {
    if (!global.document) {
      return;
    }
    global.document.addEventListener('ProjectMap:asset-reference-selected', (event) => {
      const detail = event.detail || {};
      if (detail.target && detail.target !== 'event') {
        return;
      }
      appendAssetRefToField('wizard-asset-refs', detail.assetRef || detail.asset || {});
      renderWizard();
    });
    global.document.addEventListener('ProjectMap:asset-install-request-selected', (event) => {
      const detail = event.detail || {};
      if (detail.target && detail.target !== 'event') {
        return;
      }
      appendAssetInstallRequestToField('wizard-asset-install-requests', detail.assetInstallRequest || detail.request || {});
      appendAssetRefToField('wizard-asset-refs', detail.assetRef || detail.asset || {});
      renderWizard();
    });
  }

  function initPreviewTabs() {
    const tabs = elements.previewTabs || [];
    const panels = elements.previewPanels || [];
    if (!tabs.length || !panels.length) {
      return;
    }

    const activate = (target) => {
      const nextTarget = target || 'scene';
      tabs.forEach((tab) => {
        const active = tab.dataset.previewTab === nextTarget;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      panels.forEach((panel) => {
        const active = panel.dataset.previewPanel === nextTarget;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    };

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => activate(tab.dataset.previewTab));
    });

    const activeTab = tabs.find((tab) => tab.classList.contains('is-active')) || tabs[0];
    activate(activeTab && activeTab.dataset.previewTab);
  }

  function readEventDraftFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const draft = JSON.parse(String(reader.result || ''));
        applyEventDraftToForm(draft, {fileName: file.name});
      } catch (err) {
        setDraftStatus(t('create.status.draftParseFailed', 'Draft parse failed: {error}').replace('{error}', err.message), 'warning');
        renderWizard();
      }
    };
    reader.onerror = () => {
      setDraftStatus(t('create.status.draftReadFailed', 'Draft read failed.'), 'warning');
    };
    reader.readAsText(file);
  }

  function bindDownloads() {
    if (elements.downloadScene) {
      elements.downloadScene.addEventListener('click', () => {
        const output = ensureDownloadableOutput();
        if (!output) {
          return;
        }
        downloadText(output.fileName, output.sceneDry, 'text/plain');
      });
    }
    if (elements.downloadJson) {
      elements.downloadJson.addEventListener('click', () => {
        const output = ensureDownloadableOutput();
        if (!output) {
          return;
        }
        downloadText(output.draftFileName, output.draftJson, 'application/json');
      });
    }
    if (elements.downloadRoot) {
      elements.downloadRoot.addEventListener('click', () => {
        const output = ensureDownloadableOutput();
        if (!output) {
          return;
        }
        downloadText(output.rootSnippetFileName, output.rootInitSnippet, 'text/plain');
      });
    }
    if (elements.downloadMigration) {
      elements.downloadMigration.addEventListener('click', () => {
        const output = ensureDownloadableOutput();
        if (!output) {
          return;
        }
        downloadText(output.migrationSnippetFileName, output.migrationSnippet, 'text/plain');
      });
    }
    if (elements.downloadPatch) {
      elements.downloadPatch.addEventListener('click', () => {
        const output = ensureDownloadableOutput();
        if (!output) {
          return;
        }
        downloadText(output.installNotesFileName, output.installNotes, 'text/plain');
      });
    }
    if (elements.downloadPlan) {
      elements.downloadPlan.addEventListener('click', () => {
        const output = ensureDownloadableOutput();
        if (!output) {
          return;
        }
        downloadText(output.installPlanFileName, output.installPlanJson, 'application/json');
      });
    }
    if (elements.downloadPatchPreview) {
      elements.downloadPatchPreview.addEventListener('click', () => {
        const output = ensureDownloadableOutput();
        if (!output) {
          return;
        }
        downloadText(output.patchPreviewFileName, output.patchPreview, 'text/plain');
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

  function bindIndexEvents() {
    EVENT_NAMES.forEach((name) => {
      const handler = (event) => {
        if (event.__projectMapWizardHandled) {
          return;
        }
        event.__projectMapWizardHandled = true;
        const detail = event.detail || {};
        if (detail.__projectMapWizardHandled) {
          return;
        }
        detail.__projectMapWizardHandled = true;
        if (detail.model || detail.viewModel) {
          setProjectModel(detail.model || detail.viewModel, detail);
        } else if (detail.index || detail.projectIndex) {
          setProjectIndex(detail.index || detail.projectIndex, detail);
        }
      };
      global.addEventListener(name, handler);
      if (global.document && typeof global.document.addEventListener === 'function') {
        global.document.addEventListener(name, handler);
      }
    });
  }

  function readProjectIndexFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const index = JSON.parse(String(reader.result || ''));
        setProjectIndex(index, {fileName: file.name, fileSize: file.size});
      } catch (err) {
        setIndexStatus('Index parse failed: ' + err.message, 'warning');
        renderWizard();
      }
    };
    reader.onerror = () => {
      setIndexStatus('Index read failed.', 'warning');
    };
    reader.readAsText(file);
  }

  function setProjectIndex(index, meta) {
    state.projectIndex = index || null;
    state.projectModel = null;
    state.lastIndexLabel = meta && meta.fileName ? meta.fileName : '';

    try {
      if (global.ProjectMapViewer && typeof global.ProjectMapViewer.buildViewModel === 'function') {
        state.projectModel = global.ProjectMapViewer.buildViewModel(index);
      }
      refreshLookups();
      setIndexStatus(indexSummaryText(), '');
      renderWizard();
      return {ok: true};
    } catch (err) {
      state.projectModel = null;
      refreshLookups();
      setIndexStatus('Index model failed: ' + err.message, 'warning');
      renderWizard();
      return {ok: false, error: err};
    }
  }

  function setProjectModel(model, meta) {
    state.projectModel = model || null;
    state.projectIndex = meta && meta.index ? meta.index : state.projectIndex;
    state.lastIndexLabel = meta && meta.fileName ? meta.fileName : state.lastIndexLabel;
    refreshLookups();
    setIndexStatus(indexSummaryText(), '');
    renderWizard();
    return {ok: true};
  }

  function refreshLookups() {
    state.variableNames = new Set();
    state.variableCandidates = [];
    state.sceneIds = new Set();

    const model = state.projectModel;
    if (model) {
      if (model.variablesByName && typeof model.variablesByName.forEach === 'function') {
        model.variablesByName.forEach((value, key) => state.variableNames.add(String(key)));
      }
      if (model.scenesById && typeof model.scenesById.forEach === 'function') {
        model.scenesById.forEach((value, key) => state.sceneIds.add(String(key)));
      }
      ensureArray(model.variables).forEach((variable) => {
        if (variable && variable.name) {
          state.variableNames.add(String(variable.name));
        }
      });
      ensureArray(model.scenes).forEach((scene) => {
        if (scene && scene.id) {
          state.sceneIds.add(String(scene.id));
        }
      });
    }

    const index = state.projectIndex;
    if (index) {
      ensureArray(index.variables).forEach((variable) => {
        if (variable && variable.name) {
          state.variableNames.add(String(variable.name));
        }
      });
      ensureArray(index.scenes).forEach((scene) => {
        if (scene && scene.id) {
          state.sceneIds.add(String(scene.id));
        }
      });
    }
    const suggestions = variableSuggestionApi();
    if (suggestions && typeof suggestions.buildVariableCandidates === 'function') {
      state.variableCandidates = suggestions.buildVariableCandidates(state.projectModel || state.projectIndex || {});
    }
    updateVariableDatalist();
  }

  function updateVariableDatalist() {
    if (!elements || !elements.effectVariableOptions) {
      return;
    }
    const names = Array.from(state.variableNames).sort((a, b) => a.localeCompare(b));
    elements.effectVariableOptions.innerHTML = names.map((name) => {
      return '<option value="' + escapeAttr(name) + '"></option>';
    }).join('');
  }

  function indexSummaryText() {
    const label = state.lastIndexLabel ? state.lastIndexLabel + ': ' : '';
    if (!state.projectIndex && !state.projectModel) {
      return t('create.status.noIndexLoaded', 'No index loaded.');
    }
    return t('create.status.indexSummary', '{label}{scenes} scenes, {variables} variables.')
      .replace('{label}', label)
      .replace('{scenes}', state.sceneIds.size)
      .replace('{variables}', state.variableNames.size);
  }

  function setIndexStatus(message, className) {
    if (!elements || !elements.indexStatus) {
      return;
    }
    elements.indexStatus.classList.toggle('is-warning', className === 'warning');
    elements.indexStatus.textContent = message;
  }

  function setDraftStatus(message, className) {
    if (!elements || !elements.draftStatus) {
      return;
    }
    elements.draftStatus.classList.toggle('is-warning', className === 'warning');
    elements.draftStatus.textContent = message;
  }

  function renderWizard() {
    if (!elements || !elements.form) {
      return;
    }

    const draft = collectDraft();
    const validationDiagnostics = validateDraft(draft);
    const output = renderDraftOutput(draft, validationDiagnostics);
    state.lastDraft = draft;
    state.lastOutput = output;

    renderMeaningPreview(elements.playerPreview, draft, {projectIndex: state.projectIndex, sourceKind: 'event'}, renderPlayerPreview(draft));
    renderVariableAssistant();
    renderDraftAssetPanel(draft);
    renderAssetPicker(draft);
    renderAssetManifest(draft);
    elements.scenePreview.textContent = output.sceneDry;
    elements.jsonPreview.textContent = output.draftJson;
    elements.rootPreview.textContent = output.rootInitSnippet;
    elements.migrationPreview.textContent = output.migrationSnippet;
    elements.installPreview.textContent = renderInstallPreview(output);
    elements.patchPreview.textContent = output.patchPreview;
    renderDiagnostics(output.diagnostics);
    renderEventReadiness(draft, output);
    renderCoreStatus(output);
    renderOptionVisibility(draft.options.length);
    updateEffectTargetOptions(draft.options.length);
    updateDownloadState(output);
  }

  function collectDraft() {
    const rawId = fieldValue('wizard-id');
    const id = normalizeIdentifier(rawId, 'new_world_event');
    const rawSeenFlag = fieldValue('wizard-seen-flag');
    const seenFlag = normalizeIdentifier(rawSeenFlag, id + '_seen');
    const triggerEffectsText = fieldValue('wizard-trigger-effects');
    const options = [];
    const optionCount = currentOptionCount();

    for (let index = 0; index < optionCount; index += 1) {
      const rawOptionId = fieldValue('wizard-option-' + index + '-id');
      const optionId = normalizeIdentifier(rawOptionId, 'option_' + (index + 1));
      const effectsText = fieldValue('wizard-option-' + index + '-effects');
      const rawGotoAfter = fieldValue('wizard-option-' + index + '-goto-after');
      const gotoAfter = normalizeIdentifier(rawGotoAfter, 'continue_' + optionId);
      const variantsText = fieldValue('wizard-option-' + index + '-variants');
      options.push({
        index,
        rawId: rawOptionId,
        id: optionId,
        title: fieldValue('wizard-option-' + index + '-title'),
        subtitle: fieldValue('wizard-option-' + index + '-subtitle'),
        chooseIf: normalizeRequires(fieldValue('wizard-option-' + index + '-choose-if')),
        unavailableText: fieldValue('wizard-option-' + index + '-unavailable'),
        effectsText,
        effects: parseEffects(effectsText, index),
        variantsText,
        variants: variantsFromText(variantsText),
        rawGotoAfter,
        gotoAfter,
        body: fieldValue('wizard-option-' + index + '-body'),
        extras: state.loadedOptionExtras[index] || {}
      });
    }

    return {
      kind: 'world_event',
      schemaVersion: '0.1',
      rawId,
      id,
      title: fieldValue('wizard-title'),
      heading: fieldValue('wizard-heading'),
      year: numberValue('wizard-year'),
      monthStart: numberValue('wizard-month-start'),
      monthEnd: numberValue('wizard-month-end'),
      requires: normalizeRequires(fieldValue('wizard-requires')),
      priority: numberValue('wizard-priority'),
      intro: fieldValue('wizard-intro'),
      rawSeenFlag,
      seenFlag,
      triggerEffectsText,
      triggerEffects: parseEffects(triggerEffectsText, -1),
      assetRefs: parseAssetRefsText(fieldValue('wizard-asset-refs')),
      assetInstallRequests: parseAssetInstallRequestsText(fieldValue('wizard-asset-install-requests')),
      continueAnchor: id + '_continue',
      sourcePath: 'source/scenes/events/' + id + '.scene.dry',
      options
    };
  }

  function renderPlayerPreview(draft) {
    const apiCore = global.ProjectMapPreviewModel;
    if (apiCore && typeof apiCore.renderPreviewText === 'function') {
      try {
        return apiCore.renderPreviewText(toEventDraft(draft), {projectIndex: state.projectIndex, sourceKind: 'event'});
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
    } else if (element) {
      element.textContent = fallbackText || '';
    }
  }

  function variableSuggestionApi() {
    return global.ProjectMapVariableSuggestions || null;
  }

  function renderFallbackPlayerPreview(draft) {
    const when = draft.when || draft;
    const intro = ensureArray(draft.introParagraphs).length
      ? ensureArray(draft.introParagraphs)
      : splitParagraphs(draft.intro);
    const lines = [
      String(when.year || 'Year ?') +
        ' / month ' + String(when.monthStart || '?') +
        '-' + String(when.monthEnd || '?'),
      draft.heading || draft.title || '(untitled event)',
      ''
    ];
    intro.filter(Boolean).forEach((paragraph) => {
      lines.push(String(paragraph));
    });
    lines.push('');
    ensureArray(draft.options).forEach((option, index) => {
      lines.push('-> ' + (option.label || option.title || ('Choice ' + (index + 1))));
      if (option.subtitle) {
        lines.push('   ' + option.subtitle);
      }
    });
    return lines.join('\n').trim() + '\n';
  }

  function toEventDraft(draft) {
    return {
      schemaVersion: '0.1',
      kind: 'world_event',
      id: draft.id,
      title: draft.title,
      heading: draft.heading,
      seenFlag: draft.seenFlag,
      when: {
        year: draft.year,
        monthStart: draft.monthStart,
        monthEnd: draft.monthEnd,
        requires: draft.requires,
        priority: draft.priority
      },
      introParagraphs: splitParagraphs(draft.intro),
      effectsOnTrigger: draft.triggerEffects
        .filter((effect) => effect.valid)
        .map(toDraftEffect),
      assetRefs: ensureArray(draft.assetRefs),
      assetInstallRequests: ensureArray(draft.assetInstallRequests),
      options: draft.options.map((option) => ({
        id: option.id,
        label: option.title,
        subtitle: option.subtitle,
        chooseIf: option.chooseIf || '',
        unavailableText: option.unavailableText || '',
        effects: option.effects
          .filter((effect) => effect.valid)
          .map(toDraftEffect),
        narrativeParagraphs: splitParagraphs(option.body),
        variants: option.variants.filter((variant) => variant.valid).map((variant) => ({
          condition: variant.condition,
          text: variant.text
        })),
        gotoAfter: option.gotoAfter
      }))
    };
  }

  function applyEventDraftToForm(input, meta) {
    if (!elements || !elements.form) {
      return {ok: false, error: new Error('Wizard form is not initialized.')};
    }
    try {
      const core = global.ProjectMapEventDraft;
      const draft = core && typeof core.normalizeDraft === 'function'
        ? core.normalizeDraft(input)
        : normalizeEventDraftFallback(input);
      if (draft.kind !== 'world_event') {
        throw new Error('Only world_event drafts are supported.');
      }
      const optionCount = clampOptionCount(ensureArray(draft.options).length || MIN_OPTION_COUNT);
      setFieldValue('wizard-id', draft.id);
      setFieldValue('wizard-title', draft.title);
      setFieldValue('wizard-heading', draft.heading || draft.title);
      setFieldValue('wizard-seen-flag', draft.seenFlag || (draft.id ? draft.id + '_seen' : ''));
      setFieldValue('wizard-year', draft.when && draft.when.year);
      setFieldValue('wizard-month-start', draft.when && draft.when.monthStart);
      setFieldValue('wizard-month-end', draft.when && draft.when.monthEnd);
      setFieldValue('wizard-requires', draft.when && draft.when.requires);
      setFieldValue('wizard-priority', draft.when && draft.when.priority);
      setFieldValue('wizard-intro', ensureArray(draft.introParagraphs).join('\n\n'));
      setFieldValue('wizard-trigger-effects', effectsToText(draft.effectsOnTrigger));
      setFieldValue('wizard-asset-refs', assetRefsToText(draft.assetRefs));
      setFieldValue('wizard-asset-install-requests', assetInstallRequestsToText(draft.assetInstallRequests));
      setFieldValue('wizard-option-count', optionCount);

      state.loadedDraftExtras = {
        effectsOnTrigger: ensureArray(draft.effectsOnTrigger)
      };
      state.loadedOptionExtras = [];

      for (let index = 0; index < MAX_OPTION_COUNT; index += 1) {
        const option = draft.options[index] || defaultOption(index);
        setFieldValue('wizard-option-' + index + '-id', option.id || ('option_' + (index + 1)));
        setFieldValue('wizard-option-' + index + '-title', option.label || '');
        setFieldValue('wizard-option-' + index + '-subtitle', option.subtitle || '');
        setFieldValue('wizard-option-' + index + '-effects', effectsToText(option.effects));
        setFieldValue('wizard-option-' + index + '-body', ensureArray(option.narrativeParagraphs).join('\n\n'));
        setFieldValue('wizard-option-' + index + '-choose-if', option.chooseIf || '');
        setFieldValue('wizard-option-' + index + '-unavailable', option.unavailableText || '');
        setFieldValue('wizard-option-' + index + '-variants', variantsToText(option.variants));
        setFieldValue('wizard-option-' + index + '-goto-after', option.gotoAfter || '');
        state.loadedOptionExtras[index] = {
          originalId: option.id || '',
          chooseIf: option.chooseIf || '',
          unavailableText: option.unavailableText || '',
          variants: ensureArray(option.variants),
          gotoAfter: option.gotoAfter || ''
        };
      }

      openAdvancedPanelsForDraft(draft);
      setDraftStatus(t('create.status.eventDraftLoadedChoices', '{file}{count} choices loaded.')
        .replace('{file}', meta && meta.fileName ? meta.fileName + ': ' : '')
        .replace('{count}', optionCount), '');
      renderWizard();
      return {ok: true, draft};
    } catch (err) {
      setDraftStatus(t('create.status.draftLoadFailed', 'Draft load failed: {error}').replace('{error}', err.message), 'warning');
      renderWizard();
      return {ok: false, error: err};
    }
  }

  function validateDraft(draft) {
    const diagnostics = [];
    const optionIds = new Set();
    const usableOptions = draft.options.filter((option) => option.title.trim());

    if (!draft.rawId.trim()) {
      diagnostics.push(error('Event id is required.'));
    } else if (draft.rawId.trim() !== draft.id) {
      diagnostics.push(warning('Event id will be normalized to "' + draft.id + '".'));
    }

    if (!draft.title.trim()) {
      diagnostics.push(error('Title is required.'));
    }
    if (!draft.heading.trim()) {
      diagnostics.push(error('Heading is required.'));
    }
    if (draft.rawSeenFlag.trim() && draft.rawSeenFlag.trim() !== draft.seenFlag) {
      diagnostics.push(warning('seenFlag will be normalized to "' + draft.seenFlag + '".'));
    }
    if (!Number.isInteger(draft.year)) {
      diagnostics.push(error('Year must be an integer.'));
    }
    if (!validMonth(draft.monthStart) || !validMonth(draft.monthEnd)) {
      diagnostics.push(error('monthStart and monthEnd must be 1-12.'));
    } else if (draft.monthStart > draft.monthEnd) {
      diagnostics.push(error('monthStart must be earlier than or equal to monthEnd.'));
    }
    if (!Number.isInteger(draft.priority)) {
      diagnostics.push(error('Priority must be an integer.'));
    }
    if (usableOptions.length < 2) {
      diagnostics.push(error('At least two option titles are required.'));
    }
    if (state.sceneIds.has(draft.id)) {
      diagnostics.push(warning('Scene id already exists in the loaded Project Map.'));
    }
    if (looksLikeChineseStringComparison(draft.requires)) {
      diagnostics.push(warning('requires may contain a Chinese string comparison; prefer numeric flags.'));
    }
    validateConditionLine(draft.requires, diagnostics, 'Requires');
    if (!draft.requires) {
      diagnostics.push(info('requires is empty; only time and seen-flag gates will be generated.'));
    }
    draft.triggerEffects.forEach((effect) => validateEffectLine(effect, diagnostics, 'Trigger'));

    draft.options.forEach((option) => {
      if (!option.rawId.trim()) {
        diagnostics.push(error('Option ' + optionLabel(option.index) + ' id is required.'));
      } else if (option.rawId.trim() !== option.id) {
        diagnostics.push(warning('Option ' + optionLabel(option.index) + ' id will be normalized to "' + option.id + '".'));
      }
      if (optionIds.has(option.id)) {
        diagnostics.push(error('Option id "' + option.id + '" is duplicated.'));
      }
      optionIds.add(option.id);
      if (looksLikeChineseStringComparison(option.chooseIf)) {
        diagnostics.push(warning('Option ' + optionLabel(option.index) + ' chooseIf may contain a Chinese string comparison.'));
      }
      validateConditionLine(option.chooseIf, diagnostics, 'Option ' + optionLabel(option.index));
      if (option.unavailableText.trim() && !option.chooseIf.trim()) {
        diagnostics.push(warning('Option ' + optionLabel(option.index) + ' unavailableText only matters when chooseIf is set.'));
      }
      option.effects.forEach((effect) => validateEffectLine(effect, diagnostics, 'Option ' + optionLabel(option.index)));
      option.variants.forEach((variant) => {
        if (!variant.valid) {
          diagnostics.push(warning('Option ' + optionLabel(option.index) + ' variant not parsed: "' + variant.raw + '".'));
        } else if (looksLikeChineseStringComparison(variant.condition)) {
          diagnostics.push(warning('Option ' + optionLabel(option.index) + ' variant condition may contain a Chinese string comparison.'));
        }
        if (variant.valid) {
          validateConditionLine(variant.condition, diagnostics, 'Option ' + optionLabel(option.index) + ' variant');
        }
      });
      if (option.rawGotoAfter.trim() && option.rawGotoAfter.trim() !== option.gotoAfter) {
        diagnostics.push(warning('Option ' + optionLabel(option.index) + ' gotoAfter will be normalized to "' + option.gotoAfter + '".'));
      }
    });

    if (!global.ProjectMapEventDraft) {
      diagnostics.push(info(t('create.status.eventCoreLocalPreview', 'EventDraft core not loaded; shell preview is generated locally.')));
    }

    if (!diagnostics.some((diag) => diag.level === 'error')) {
      diagnostics.push(ok(t('create.status.eventDraftRenderable', 'Draft shell is renderable.')));
    }

    return diagnostics;
  }

  function validateEffectLine(effect, diagnostics, label) {
    if (!effect.valid) {
      diagnostics.push(warning(label + ' effect not parsed: "' + effect.raw + '".'));
    } else if (state.variableNames.size && !state.variableNames.has(effect.variable)) {
      diagnostics.push(warning(label + ' effect variable "' + effect.variable + '" is not in the loaded Project Map.'));
    }
  }

  function validateConditionLine(text, diagnostics, label) {
    unknownConditionVariables(text).forEach((name) => {
      diagnostics.push(warning(t('create.warning.conditionVariableMissing', '{field} condition variable "{name}" is not in the loaded Project Map.')
        .replace('{field}', label)
        .replace('{name}', name)));
    });
  }

  function unknownConditionVariables(text) {
    if (!text || !state.variableNames.size) {
      return [];
    }
    const unknown = new Set();
    const stripped = String(text || '').replace(/(['"])(?:\\.|(?!\1)[\s\S])*\1/g, ' ');
    const re = /(?:^|[^.A-Za-z0-9_])(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\b/g;
    let match;
    while ((match = re.exec(stripped))) {
      const name = match[1];
      if (
        !name ||
        CONDITION_KEYWORDS.has(name) ||
        CONDITION_BUILTINS.has(name) ||
        state.variableNames.has(name)
      ) {
        continue;
      }
      unknown.add(name);
    }
    return Array.from(unknown).sort();
  }

  function renderDraftOutput(draft, diagnostics) {
    const fallback = fallbackOutput(draft, diagnostics);
    const apiOutput = eventDraftOutput(draft, fallback);
    const output = Object.assign({}, fallback, apiOutput.values || {});
    output.diagnostics = normalizeDiagnostics(diagnostics.concat(apiOutput.diagnostics || []));
    output.coreLoaded = apiOutput.coreLoaded;
    output.coreUsed = apiOutput.coreUsed;
    output.coreError = apiOutput.coreError;
    output.fileName = draft.id + '.scene.dry';
    output.draftFileName = draft.id + '.event-draft.json';
    output.rootSnippetFileName = draft.id + '.root-init.snippet.dry';
    output.migrationSnippetFileName = draft.id + '.post-event-migration.snippet.js';
    output.installNotesFileName = draft.id + '.install-notes.txt';
    output.installPlanFileName = draft.id + '.install-plan.json';
    output.patchPreviewFileName = draft.id + '.patch-preview.diff';
    output.installNotes = output.installNotes || renderInstallNotes(draft, output);
    output.installChecklist = output.installChecklist || '';
    output.installPlanJson = output.installPlanJson || '';
    output.patchPreview = output.patchPreview || '';
    output.canDownload = !output.diagnostics.some((diag) => (diag.level || diag.severity) === 'error');
    return output;
  }

  function fallbackOutput(draft) {
    const rootInitSnippet = 'Q.' + draft.seenFlag + ' = 0;\n';
    const migrationSnippet = 'if (Q.' + draft.seenFlag + ' === undefined) Q.' + draft.seenFlag + ' = 0;\n';
    const sceneDry = renderSceneDry(draft);
    const draftJson = JSON.stringify(toEventDraft(draft), null, 2) + '\n';
    return {
      sceneDry,
      draftJson,
      rootInitSnippet,
      migrationSnippet
    };
  }

  function eventDraftOutput(draft, fallback) {
    const core = global.ProjectMapEventDraft;
    if (!core) {
      return {coreLoaded: false, coreUsed: false, diagnostics: []};
    }

    if (typeof core.buildExportBundle === 'function') {
      try {
        const result = core.buildExportBundle(toEventDraft(draft), state.projectIndex, {
          defaultContinueLabel: t('create.default.continue', 'Continue')
        });
        return {
          coreLoaded: true,
          coreUsed: true,
          values: normalizeCoreResult(result, fallback),
          diagnostics: [{level: 'info', message: 'EventDraft core used: buildExportBundle.'}]
            .concat(result && result.diagnostics ? result.diagnostics : [])
        };
      } catch (err) {
        return {
          coreLoaded: true,
          coreUsed: false,
          coreError: err,
          diagnostics: [warning('EventDraft core failed: ' + err.message + '.')]
        };
      }
    }

    const context = {
      projectIndex: state.projectIndex,
      projectModel: state.projectModel,
      viewerApi: global.ProjectMapViewer || null,
      fallback
    };
    const methodNames = [
      'renderWorldEvent',
      'buildWorldEvent',
      'createWorldEventDraft',
      'createDraft',
      'render',
      'generate',
      'build',
      'toSceneDry'
    ];

    for (const name of methodNames) {
      if (typeof core[name] !== 'function') {
        continue;
      }
      try {
        const result = core[name](draft, context);
        return {
          coreLoaded: true,
          coreUsed: true,
          values: normalizeCoreResult(result, fallback),
          diagnostics: [info('EventDraft core used: ' + name + '.')]
        };
      } catch (err) {
        return {
          coreLoaded: true,
          coreUsed: false,
          coreError: err,
          diagnostics: [warning('EventDraft core failed: ' + err.message + '.')]
        };
      }
    }

    return {
      coreLoaded: true,
      coreUsed: false,
      diagnostics: [warning('EventDraft core is present but exposes no known render method.')]
    };
  }

  function normalizeCoreResult(result, fallback) {
    if (typeof result === 'string') {
      return {sceneDry: result};
    }
    if (!result || typeof result !== 'object') {
      return {};
    }
    const values = {};
    if (Array.isArray(result.files)) {
      const sceneFile = result.files.find((file) => file.kind === 'scene');
      const draftFile = result.files.find((file) => file.kind === 'draft');
      const rootFile = result.files.find((file) => file.kind === 'root_init');
      const migrationFile = result.files.find((file) => file.kind === 'migration');
      const notesFile = result.files.find((file) => file.kind === 'notes');
      const installPlanFile = result.files.find((file) => file.kind === 'install_plan');
      const patchFile = result.files.find((file) => file.kind === 'patch_preview');
      values.sceneDry = sceneFile && sceneFile.content;
      values.draftJson = draftFile && draftFile.content;
      values.rootInitSnippet = rootFile && rootFile.content;
      values.migrationSnippet = migrationFile && migrationFile.content;
      values.installNotes = notesFile && notesFile.content;
      values.installPlanJson = installPlanFile && installPlanFile.content;
      values.patchPreview = patchFile && patchFile.content;
    }
    values.sceneDry = firstString(values.sceneDry, result.sceneDry, result.scene, result.dry, result.output);
    values.draftJson = firstString(values.draftJson, result.draftJson, result.json);
    if (!values.draftJson && result.draft) {
      values.draftJson = JSON.stringify(result.draft, null, 2);
    }
    values.rootInitSnippet = firstString(values.rootInitSnippet, result.rootInitSnippet, result.rootInit, result.rootSnippet);
    values.migrationSnippet = firstString(
      values.migrationSnippet,
      result.migrationSnippet,
      result.postEventMigrationSnippet,
      result.postEventMigration,
      result.migration
    );
    values.installNotes = firstString(values.installNotes, result.installNotes, result.notes);
    values.installChecklist = firstString(values.installChecklist, result.installChecklist);
    values.installPlanJson = firstString(values.installPlanJson, result.installPlanJson);
    values.patchPreview = firstString(values.patchPreview, result.patchPreview);
    Object.keys(values).forEach((key) => {
      if (!values[key]) {
        delete values[key];
      }
    });
    return Object.keys(values).length ? values : fallback;
  }

  function renderInstallPreview(output) {
    return [output.installChecklist, output.installNotes].filter(Boolean).join('\n');
  }

  function renderSceneDry(draft) {
    const lines = [
      'title: ' + singleLine(draft.title || draft.id),
      'new-page: true',
      'is-card: true',
      'tags: event, world',
      'view-if: ' + renderViewIf(draft),
      'priority: ' + (Number.isInteger(draft.priority) ? draft.priority : 0),
      'max-visits: 1',
      'on-arrival: {!',
      'Q.' + draft.seenFlag + ' = 1;',
      ...renderEffectLines(draft.triggerEffects),
      '!}',
      '',
      '= ' + singleLine(draft.heading || draft.title || draft.id),
      '',
      paragraphText(draft.intro),
      ''
    ];

    draft.options.forEach((option) => {
      lines.push('- @' + option.id + ': ' + singleLine(option.title || option.id));
    });

    draft.options.forEach((option) => {
      lines.push('', '@' + option.id);
      if (option.subtitle.trim()) {
        lines.push('subtitle: ' + singleLine(option.subtitle));
      }
      if (option.chooseIf.trim()) {
        lines.push('choose-if: ' + option.chooseIf);
      }
      if (option.unavailableText.trim()) {
        lines.push('unavailable-subtitle: ' + singleLine(option.unavailableText));
      }
      const effectLines = renderEffectLines(option.effects);
      if (effectLines.length) {
        lines.push('on-arrival: {!', ...effectLines, '!}');
      }
      const gotoAfter = option.gotoAfter;
      lines.push('', paragraphText(option.body));
      option.variants.filter((variant) => variant.valid).forEach((variant) => {
        lines.push('', '[? if ' + variant.condition + ' : ' + singleLine(variant.text) + ' ?]');
      });
      lines.push('', '- @' + gotoAfter + ': ' + t('create.default.continue', 'Continue'));
    });

    draft.options.forEach((option) => {
      const gotoAfter = option.gotoAfter;
      lines.push('', '@' + gotoAfter, 'go-to: root');
    });
    lines.push('');
    return lines.join('\n');
  }

  function renderViewIf(draft) {
    const clauses = [
      'year = ' + (Number.isInteger(draft.year) ? draft.year : 2014),
      'month >= ' + (validMonth(draft.monthStart) ? draft.monthStart : 1),
      'month <= ' + (validMonth(draft.monthEnd) ? draft.monthEnd : 12),
      draft.seenFlag + ' = 0'
    ];
    if (draft.requires) {
      clauses.push(draft.requires);
    }
    return clauses.join(' and ');
  }

  function renderEffectLines(effects) {
    return effects.filter((effect) => effect.valid).map((effect) => {
      if (effect.op === '=') {
        return 'Q.' + effect.variable + ' = ' + renderEffectValue(effect.value) + ';';
      }
      return 'Q.' + effect.variable + ' ' + effect.op + ' ' + effect.value + ';';
    });
  }

  function renderInstallNotes(draft, output) {
    return [
      'Install manually:',
      '',
      'Export bundle files:',
      '- ' + draft.id + '.scene.dry',
      '- ' + draft.id + '.event-draft.json',
      '- ' + draft.id + '.root-init.snippet.dry',
      '- ' + draft.id + '.post-event-migration.snippet.js',
      '- ' + draft.id + '.install-notes.txt',
      '',
      'Suggested source path:',
      'source/scenes/events/' + draft.id + '.scene.dry',
      '',
      'Steps:',
      '1. Add ' + draft.id + '.scene.dry under source/scenes/events/.',
      '2. Add root init snippet near EVENT SEEN FLAGS in source/scenes/root.scene.dry.',
      '3. Add post_event migration snippet near save compatibility guards in source/scenes/post_event.scene.dry.',
      '4. Wire the event into your monthly router/news/event selection flow by hand.',
      '5. Run bash tools/build_and_validate.sh --skip-build --errors-only before a full build.',
      '',
      'root.scene.dry init snippet:',
      output.rootInitSnippet,
      '',
      'post_event.scene.dry migration snippet:',
      output.migrationSnippet,
      ''
    ].join('\n');
  }

  function parseEffects(text, optionIndex) {
    return String(text || '').split(/\r?\n/).map((line, lineIndex) => {
      const raw = line.trim();
      if (!raw || raw.startsWith('#') || raw.startsWith('//')) {
        return null;
      }
      const match = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\+|-|=)\s*(.+)$/);
      if (!match) {
        return {
          valid: false,
          raw,
          optionIndex,
          lineIndex
        };
      }
      const operator = match[2] === '+' ? '+=' : match[2] === '-' ? '-=' : match[2];
      const parsedValue = parseEffectValue(match[3]);
      const numericDelta = operator !== '=' && typeof parsedValue.value !== 'number';
      return {
        valid: !numericDelta,
        raw,
        optionIndex,
        lineIndex,
        variable: match[1],
        op: operator,
        operator,
        value: parsedValue.value
      };
    }).filter(Boolean);
  }

  function parseEffectValue(rawValue) {
    const text = String(rawValue || '').trim();
    if (/^-?\d+(?:\.\d+)?$/.test(text)) {
      return {value: Number(text)};
    }
    if (/^(true|false)$/i.test(text)) {
      return {value: text.toLowerCase() === 'true'};
    }
    if (/^null$/i.test(text)) {
      return {value: null};
    }
    const quoted = text.match(/^(['"])([\s\S]*)\1$/);
    if (quoted) {
      return {value: quoted[2]};
    }
    return {value: text};
  }

  function renderEffectValue(value) {
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }
    if (value === null || value === undefined || value === '') {
      return '0';
    }
    if (/^-?\d+(?:\.\d+)?$/.test(String(value))) {
      return String(value);
    }
    return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  }

  function effectsToText(effects) {
    return ensureArray(effects).map((effect) => {
      return [effect.variable, effect.op, effect.value].join(' ');
    }).join('\n');
  }

  function effectsFromText(text) {
    return parseEffects(text, -1)
      .filter((effect) => effect.valid)
      .map(toDraftEffect);
  }

  function toDraftEffect(effect) {
    return {
      variable: effect.variable,
      op: effect.op,
      value: effect.value
    };
  }

  function variantsToText(variants) {
    return ensureArray(variants).map((variant) => {
      return singleLine(variant.condition) + ' => ' + singleLine(variant.text);
    }).filter((line) => line.trim() !== '=>').join('\n');
  }

  function variantsFromText(text) {
    return String(text || '').split(/\r?\n/).map((line, lineIndex) => {
      const raw = line.trim();
      if (!raw || raw.startsWith('#') || raw.startsWith('//')) {
        return null;
      }
      const marker = raw.indexOf('=>');
      if (marker < 0) {
        return {valid: false, raw, lineIndex, condition: '', text: ''};
      }
      const condition = raw.slice(0, marker).trim();
      const variantText = raw.slice(marker + 2).trim();
      return {
        valid: Boolean(condition && variantText),
        raw,
        lineIndex,
        condition,
        text: variantText
      };
    }).filter(Boolean);
  }

  function resolvedGotoAfter(option) {
    const extras = option.extras || {};
    const originalDefault = 'continue_' + (extras.originalId || option.id);
    if (extras.gotoAfter && extras.gotoAfter !== originalDefault) {
      return extras.gotoAfter;
    }
    return 'continue_' + option.id;
  }

  function normalizeEventDraftFallback(input) {
    const value = input && typeof input === 'object' ? input : {};
    return {
      schemaVersion: String(value.schemaVersion || '0.1'),
      kind: String(value.kind || 'world_event'),
      id: String(value.id || ''),
      title: String(value.title || ''),
      heading: String(value.heading || value.title || ''),
      seenFlag: String(value.seenFlag || (value.id ? value.id + '_seen' : '')),
      when: value.when || {},
      effectsOnTrigger: ensureArray(value.effectsOnTrigger),
      introParagraphs: Array.isArray(value.introParagraphs) ? value.introParagraphs : [],
      assetRefs: ensureArray(value.assetRefs),
      assetInstallRequests: ensureArray(value.assetInstallRequests),
      options: ensureArray(value.options)
    };
  }

  function defaultOption(index) {
    return {
      id: 'option_' + (index + 1),
      label: '',
      subtitle: '',
      effects: [],
      narrativeParagraphs: [],
      variants: [],
      gotoAfter: ''
    };
  }

  function currentOptionCount() {
    return clampOptionCount(Number(fieldValue('wizard-option-count')) || MIN_OPTION_COUNT);
  }

  function clampOptionCount(value) {
    const count = Number(value);
    if (!Number.isFinite(count)) {
      return MIN_OPTION_COUNT;
    }
    return Math.max(MIN_OPTION_COUNT, Math.min(MAX_OPTION_COUNT, Math.round(count)));
  }

  function renderOptionVisibility(optionCount) {
    const count = clampOptionCount(optionCount);
    ensureArray(elements.optionBlocks).forEach((block) => {
      const index = Number(block.dataset.optionIndex);
      block.classList.toggle('hidden', index >= count);
    });
  }

  function renderEventReadiness(draft, output) {
    if (!elements || !elements.readiness) {
      return;
    }
    const titledChoices = draft.options.filter((option) => option.title && option.title.trim());
    const validEffectCount = draft.triggerEffects.filter((effect) => effect.valid).length +
      draft.options.reduce((count, option) => count + option.effects.filter((effect) => effect.valid).length, 0);
    const scheduleReady = Number.isInteger(draft.year) &&
      validMonth(draft.monthStart) &&
      validMonth(draft.monthEnd) &&
      draft.monthStart <= draft.monthEnd;
    const windowText = Number.isInteger(draft.year) && validMonth(draft.monthStart) && validMonth(draft.monthEnd)
      ? String(draft.year) + ' / ' + String(draft.monthStart) + '-' + String(draft.monthEnd)
      : t('event.readiness.windowMissing', 'missing window');
    const rows = [
      {
        id: 'story',
        status: draft.heading.trim() && draft.intro.trim() ? 'ready' : 'warning',
        message: draft.heading.trim() && draft.intro.trim()
          ? t('event.readiness.storyReady', 'Heading and opening prose are ready.')
          : t('event.readiness.storyMissing', 'Add a heading and opening prose.')
      },
      {
        id: 'schedule',
        status: scheduleReady ? 'ready' : 'warning',
        message: scheduleReady
          ? t('event.readiness.scheduleReady', 'Appears during {window}.').replace('{window}', windowText)
          : t('event.readiness.scheduleMissing', 'Fix year and month range.')
      },
      {
        id: 'choices',
        status: titledChoices.length >= MIN_OPTION_COUNT ? 'ready' : 'warning',
        message: titledChoices.length >= MIN_OPTION_COUNT
          ? t('event.readiness.choicesReady', '{count} player choices have labels.').replace('{count}', String(titledChoices.length))
          : t('event.readiness.choicesMissing', 'At least two player choice labels are required.')
      },
      {
        id: 'effects',
        status: validEffectCount > 0 ? 'ready' : 'warning',
        message: validEffectCount > 0
          ? t('event.readiness.effectsReady', '{count} variable effects parsed.').replace('{count}', String(validEffectCount))
          : t('event.readiness.effectsMissing', 'No variable effects parsed yet.')
      },
      {
        id: 'export',
        status: output && output.canDownload ? 'ready' : 'warning',
        message: output && output.canDownload
          ? t('event.readiness.exportReady', 'No blocking export errors.')
          : t('event.readiness.exportMissing', 'Resolve blocking diagnostics before export.')
      }
    ];
    elements.readiness.innerHTML = rows.map((row) => {
      const statusLabel = row.status === 'ready'
        ? t('event.readinessReady', 'ready')
        : t('event.readinessMissing', 'needs work');
      return '<div class="event-readiness-row ' + (row.status === 'ready' ? 'ready' : 'warning') + '">' +
        '<strong>' + escapeHtml(eventReadinessLabel(row.id)) + '</strong>' +
        '<span>' + escapeHtml(row.message) + '</span>' +
        '<small>' + escapeHtml(statusLabel) + '</small>' +
        '</div>';
    }).join('');
    renderEventRouteSummary(draft, windowText);
  }

  function renderEventRouteSummary(draft, windowText) {
    if (!elements || !elements.routeSummary) {
      return;
    }
    const chips = [
      {
        label: t('event.routeSummary.source', 'Source'),
        value: draft.sourcePath || ''
      },
      {
        label: t('event.routeSummary.seenFlag', 'Seen flag'),
        value: draft.seenFlag || ''
      },
      {
        label: t('event.routeSummary.window', 'Window'),
        value: windowText || ''
      },
      {
        label: t('event.routeSummary.condition', 'Condition'),
        value: draft.requires || t('event.routeSummary.noCondition', 'time + seen flag only')
      }
    ];
    elements.routeSummary.innerHTML = chips.map((chip) => {
      return '<div class="event-route-chip"><strong>' + escapeHtml(chip.label) + '</strong><span>' + escapeHtml(chip.value || '-') + '</span></div>';
    }).join('');
  }

  function eventReadinessLabel(id) {
    return {
      story: t('event.readiness.story', 'Player text'),
      schedule: t('event.readiness.schedule', 'Timing'),
      choices: t('event.readiness.choices', 'Choices'),
      effects: t('event.readiness.effects', 'Effects'),
      export: t('event.readiness.export', 'Export')
    }[id] || id;
  }

  function updateEffectTargetOptions(optionCount) {
    if (!elements || !elements.effectTarget) {
      return;
    }
    const count = clampOptionCount(optionCount);
    Array.from(elements.effectTarget.options).forEach((option) => {
      const match = String(option.value || '').match(/^option:(\d+)$/);
      if (match) {
        option.hidden = Number(match[1]) >= count;
      }
    });
    const selected = elements.effectTarget.selectedOptions && elements.effectTarget.selectedOptions[0];
    if (selected && selected.hidden) {
      elements.effectTarget.value = 'trigger';
    }
  }

  function renderVariableAssistant() {
    if (!elements || !elements.variableCandidates) {
      return;
    }
    const suggestions = variableSuggestionApi();
    elements.variableCandidates.textContent = '';
    if (!suggestions || !state.variableCandidates.length) {
      const empty = global.document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = t('variableAssistant.empty', 'Load a ProjectIndex to see variable candidates.');
      elements.variableCandidates.appendChild(empty);
      return;
    }
    const query = elements.variableSearch ? elements.variableSearch.value : '';
    const results = suggestions.searchVariableCandidates(state.variableCandidates, query, {limit: 6});
    if (!results.length) {
      const empty = global.document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = t('variableAssistant.noMatches', 'No variable candidates match this search.');
      elements.variableCandidates.appendChild(empty);
      return;
    }
    results.forEach((candidate) => {
      elements.variableCandidates.appendChild(renderVariableCandidateCard(candidate));
    });
  }

  function renderVariableCandidateCard(candidate) {
    const card = global.document.createElement('article');
    card.className = 'variable-candidate-card';
    const name = global.document.createElement('div');
    name.className = 'variable-candidate-name';
    name.textContent = candidate.name;
    const summary = global.document.createElement('div');
    summary.className = 'variable-candidate-summary';
    summary.textContent = candidate.summary || candidate.meaning || '';
    const reason = global.document.createElement('div');
    reason.className = 'variable-candidate-reason';
    reason.textContent = t('variableAssistant.reason', 'Match: {reason}').replace('{reason}', candidate.reason || candidate.meaning || 'candidate');
    const actions = global.document.createElement('div');
    actions.className = 'variable-candidate-actions';
    actions.appendChild(variableActionButton('insert-condition', candidate.name, t('variableAssistant.insertCondition', 'Insert condition')));
    actions.appendChild(variableActionButton('use-effect', candidate.name, t('variableAssistant.useEffect', 'Use in effect')));
    card.appendChild(name);
    card.appendChild(summary);
    card.appendChild(reason);
    card.appendChild(actions);
    return card;
  }

  function variableActionButton(action, variableName, label) {
    const button = global.document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-variable-action', action);
    button.setAttribute('data-variable-name', variableName);
    button.textContent = label;
    return button;
  }

  function handleVariableCandidateAction(button) {
    const variableName = String(button.dataset.variableName || '').trim();
    if (!variableName) {
      return;
    }
    const candidate = state.variableCandidates.find((item) => item.name === variableName) || {name: variableName};
    if (button.dataset.variableAction === 'insert-condition') {
      insertVariableCondition(candidate);
      return;
    }
    if (button.dataset.variableAction === 'use-effect') {
      setFieldValue('wizard-effect-variable', candidate.name);
      if (elements.effectVariable) {
        elements.effectVariable.focus();
      }
      setIndexStatus(t('variableAssistant.usedEffect', 'Selected {name} for the effect helper.').replace('{name}', candidate.name), '');
    }
  }

  function insertVariableCondition(candidate) {
    const suggestions = variableSuggestionApi();
    const snippet = suggestions && typeof suggestions.variableSnippet === 'function'
      ? suggestions.variableSnippet(candidate)
      : {metadataCondition: candidate.name + ' = 1'};
    const targetId = state.lastConditionFieldId && global.document.getElementById(state.lastConditionFieldId)
      ? state.lastConditionFieldId
      : 'wizard-requires';
    appendConditionToField(targetId, snippet.metadataCondition);
    setIndexStatus(t('variableAssistant.insertedCondition', 'Inserted a condition for {name}.').replace('{name}', candidate.name), '');
    renderWizard();
  }

  function appendConditionToField(fieldId, condition) {
    const field = global.document.getElementById(fieldId);
    if (!field || !condition) {
      return;
    }
    const current = String(field.value || '').trim();
    field.value = current ? current + ' and ' + condition : condition;
    field.dispatchEvent(new Event('input', {bubbles: true}));
  }

  function isConditionFieldId(id) {
    return id === 'wizard-requires' || /^wizard-option-\d+-choose-if$/.test(String(id || ''));
  }

  function openAdvancedPanelsForDraft(draft) {
    if (elements.eventAdvanced) {
      elements.eventAdvanced.open = Boolean(
        (draft.seenFlag && draft.id && draft.seenFlag !== draft.id + '_seen') ||
        ensureArray(draft.effectsOnTrigger).length
      );
    }
    ensureArray(elements.optionAdvanced).forEach((panel) => {
      const index = Number(panel.dataset.optionAdvancedIndex);
      const option = ensureArray(draft.options)[index] || {};
      panel.open = Boolean(
        option.chooseIf ||
        option.unavailableText ||
        ensureArray(option.variants).length ||
        (option.gotoAfter && option.id && option.gotoAfter !== 'continue_' + option.id)
      );
    });
  }

  function renderDiagnostics(diagnostics) {
    elements.diagnostics.innerHTML = '';
    diagnostics.forEach((diag) => {
      const item = global.document.createElement('div');
      const level = diag.level || diag.severity || 'info';
      item.className = 'diagnostic-item ' + level;
      item.textContent = (diag.code ? diag.code + ': ' : '') + diag.message;
      elements.diagnostics.appendChild(item);
    });
  }

  function renderCoreStatus(output) {
    elements.coreStatus.classList.remove('is-ready', 'is-warning', 'is-error');
    if (output.coreUsed) {
      elements.coreStatus.classList.add('is-ready');
      elements.coreStatus.textContent = t('create.status.eventCoreActive', 'EventDraft core active.');
    } else if (output.coreLoaded) {
      elements.coreStatus.classList.add(output.coreError ? 'is-error' : 'is-warning');
      elements.coreStatus.textContent = output.coreError
        ? t('create.status.eventCoreError', 'EventDraft core error.')
        : t('create.status.eventCorePendingMethod', 'EventDraft core pending method.');
    } else {
      elements.coreStatus.classList.add('is-warning');
      elements.coreStatus.textContent = t('create.status.eventCoreNotLoaded', 'EventDraft core not loaded.');
    }
  }

  function ensureOutput() {
    renderWizard();
    return state.lastOutput;
  }

  function ensureDownloadableOutput() {
    const output = ensureOutput();
    if (!output.canDownload) {
      setIndexStatus(t('create.status.fixEventErrors', 'Fix EventDraft errors before exporting.'), 'warning');
      return null;
    }
    return output;
  }

  function updateDownloadState(output) {
    const disabled = !output.canDownload;
    [
      elements.downloadScene,
      elements.downloadJson,
      elements.downloadRoot,
      elements.downloadMigration,
      elements.downloadPatch,
      elements.downloadPlan,
      elements.downloadPatchPreview,
      elements.reviewInstall
    ].forEach((button) => {
      if (button) {
        button.disabled = disabled;
      }
    });
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

  function downloadText(fileName, text, type) {
    const blob = new Blob([text || ''], {type: type || 'text/plain'});
    const url = URL.createObjectURL(blob);
    const anchor = global.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    global.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function fieldValue(id) {
    const field = global.document.getElementById(id);
    return field ? String(field.value || '') : '';
  }

  function setFieldValue(id, value) {
    const field = global.document.getElementById(id);
    if (field) {
      field.value = value === undefined || value === null ? '' : String(value);
    }
  }

  function appendLineToField(id, line) {
    const field = global.document.getElementById(id);
    if (!field) {
      return;
    }
    const current = String(field.value || '').trimEnd();
    field.value = current ? current + '\n' + line : line;
    field.dispatchEvent(new Event('input', {bubbles: true}));
  }

  function appendAssetRefToField(id, assetRef) {
    const ref = normalizeAssetRef(assetRef);
    if (!ref.path) {
      return;
    }
    appendLineToField(id, formatAssetRefLine(ref));
  }

  function appendAssetInstallRequestToField(id, request) {
    const item = normalizeAssetInstallRequest(request);
    if (!item.targetPath) {
      return;
    }
    appendLineToField(id, formatAssetInstallRequestLine(item));
  }

  function handleAssetFileSelection(files) {
    const selected = Array.from(files || []);
    if (!selected.length) {
      return;
    }
    const draft = collectDraft();
    selected.forEach((file) => {
      const request = assetInstallRequestFromFile(file, draft);
      appendAssetInstallRequestToField('wizard-asset-install-requests', request);
      appendAssetRefToField('wizard-asset-refs', {
        path: request.targetPath,
        type: request.type,
        label: request.label,
        role: request.role
      });
    });
  }

  function parseAssetRefsText(text) {
    return String(text || '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseAssetRefLine)
      .filter((ref) => ref.path);
  }

  function parseAssetRefLine(line) {
    const text = String(line || '').trim();
    if (!text) {
      return {path: '', type: 'asset', label: ''};
    }
    if (text[0] === '{') {
      try {
        return normalizeAssetRef(JSON.parse(text));
      } catch (_err) {
        return normalizeAssetRef({path: text});
      }
    }
    const parts = text.split('|').map((part) => part.trim());
    return normalizeAssetRef({
      path: parts[0] || text,
      type: parts[1] || '',
      label: parts[2] || '',
      role: parts[3] || ''
    });
  }

  function assetRefsToText(refs) {
    return ensureArray(refs).map((ref) => formatAssetRefLine(normalizeAssetRef(ref))).filter(Boolean).join('\n');
  }

  function formatAssetRefLine(ref) {
    const item = normalizeAssetRef(ref);
    return [item.path, item.type || 'asset', item.label, item.role].filter(Boolean).join(' | ');
  }

  function parseAssetRefPayload(value) {
    try {
      return normalizeAssetRef(JSON.parse(String(value || '{}')));
    } catch (_err) {
      return {path: '', type: 'asset', label: '', role: ''};
    }
  }

  function normalizeAssetRef(value) {
    const item = value && typeof value === 'object' ? value : {path: value};
    const path = String(item.path || item.src || item.url || '').trim();
    return {
      path,
      type: String(item.type || inferAssetType(path) || 'asset').trim(),
      label: String(item.label || item.name || fileName(path) || '').trim(),
      role: String(item.role || '').trim()
    };
  }

  function parseAssetInstallRequestsText(text) {
    return String(text || '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseAssetInstallRequestLine)
      .filter((request) => request.targetPath);
  }

  function parseAssetInstallRequestLine(line) {
    const text = String(line || '').trim();
    if (!text) {
      return {sourceName: '', targetPath: '', type: 'asset', label: '', role: ''};
    }
    if (text[0] === '{') {
      try {
        return normalizeAssetInstallRequest(JSON.parse(text));
      } catch (_err) {
        return normalizeAssetInstallRequest({sourceName: text});
      }
    }
    const parts = text.split('|').map((part) => part.trim());
    return normalizeAssetInstallRequest({
      sourceName: parts[0] || '',
      targetPath: parts[1] || '',
      type: parts[2] || '',
      label: parts[3] || '',
      role: parts[4] || ''
    });
  }

  function assetInstallRequestsToText(requests) {
    return ensureArray(requests).map((request) => formatAssetInstallRequestLine(normalizeAssetInstallRequest(request))).filter(Boolean).join('\n');
  }

  function formatAssetInstallRequestLine(request) {
    const item = normalizeAssetInstallRequest(request);
    if (item.sourcePath) {
      return JSON.stringify(item);
    }
    return [item.sourceName, item.targetPath, item.type || 'asset', item.label, item.role].filter(Boolean).join(' | ');
  }

  function normalizeAssetInstallRequest(value) {
    const item = value && typeof value === 'object' ? value : {sourceName: value};
    const targetPath = String(item.targetPath || item.target || item.path || '').trim();
    return {
      sourceName: String(item.sourceName || item.fileName || item.name || '').trim(),
      sourcePath: String(item.sourcePath || '').trim(),
      targetPath,
      type: String(item.type || inferAssetType(targetPath || item.sourceName || '') || 'asset').trim(),
      label: String(item.label || item.sourceName || fileName(targetPath) || '').trim(),
      role: String(item.role || '').trim(),
      sourceSize: item.sourceSize,
      sourceLastModified: item.sourceLastModified
    };
  }

  function assetInstallRequestFromFile(file, draft) {
    const type = inferAssetType(file && file.name) || 'asset';
    const role = type === 'audio' ? 'event_audio' : 'event_illustration';
    const assetApi = global.ProjectMapAssetModel;
    const targetPath = assetApi && typeof assetApi.suggestAssetTargetPath === 'function'
      ? assetApi.suggestAssetTargetPath({name: file && file.name, type}, {target: 'event', draftId: draft && draft.id, role})
      : fallbackAssetTargetPath(file && file.name, type, 'events', draft && draft.id);
    if (assetApi && typeof assetApi.assetInstallRequest === 'function') {
      return assetApi.assetInstallRequest({
        sourceName: file && file.name,
        sourcePath: file && file.path || '',
        targetPath,
        type,
        label: file && file.name,
        role,
        sourceSize: file && file.size,
        sourceLastModified: file && file.lastModified
      }, {target: 'event', draftId: draft && draft.id, role});
    }
    return normalizeAssetInstallRequest({
      sourceName: file && file.name,
      sourcePath: file && file.path || '',
      targetPath,
      type,
      label: file && file.name,
      role,
      sourceSize: file && file.size,
      sourceLastModified: file && file.lastModified
    });
  }

  function fallbackAssetTargetPath(name, type, lane, draftId) {
    const baseName = String(fileName(name) || 'asset')
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-+|-+$/g, '') || (type === 'audio' ? 'asset.ogg' : 'asset.png');
    return 'assets/studio/' + lane + '/' + normalizeIdentifier(draftId, lane.slice(0, -1) || 'draft') + '/' + baseName;
  }

  function renderAssetPicker(draft) {
    if (!elements.assetPicker) {
      return;
    }
    const viewer = global.ProjectMapViewer;
    if (!viewer || typeof viewer.renderAssetPicker !== 'function') {
      elements.assetPicker.textContent = '';
      return;
    }
    elements.assetPicker.innerHTML = viewer.renderAssetPicker(state.projectIndex, {
      target: 'event',
      selectedPaths: ensureArray(draft.assetRefs).map((ref) => ref.path)
    });
  }

  function renderDraftAssetPanel(draft) {
    if (!elements.draftAssetPanel) {
      return;
    }
    const viewer = global.ProjectMapViewer;
    if (!viewer || typeof viewer.renderDraftAssetPanel !== 'function') {
      elements.draftAssetPanel.textContent = '';
      return;
    }
    elements.draftAssetPanel.innerHTML = viewer.renderDraftAssetPanel(draft, state.projectIndex, {
      target: 'event'
    });
  }

  function renderAssetManifest(draft) {
    if (!elements.assetManifest) {
      return;
    }
    const viewer = global.ProjectMapViewer;
    if (!viewer || typeof viewer.renderAssetManifest !== 'function') {
      elements.assetManifest.textContent = '';
      return;
    }
    elements.assetManifest.innerHTML = viewer.renderAssetManifest(draft.assetRefs || [], state.projectIndex);
  }

  function inferAssetType(path) {
    const text = String(path || '').toLowerCase();
    if (/\.(png|jpe?g|gif|webp|svg)(?:[?#].*)?$/.test(text)) {
      return 'image';
    }
    if (/\.(mp3|ogg|wav|flac|m4a)(?:[?#].*)?$/.test(text)) {
      return 'audio';
    }
    return '';
  }

  function fileName(path) {
    const parts = String(path || '').split(/[\\/]/);
    return parts[parts.length - 1] || '';
  }

  function numberValue(id) {
    const value = Number(fieldValue(id));
    return Number.isFinite(value) ? value : NaN;
  }

  function normalizeIdentifier(value, fallback) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
    return normalized || fallback;
  }

  function normalizeRequires(value) {
    return String(value || '')
      .trim()
      .replace(/^and\s+/i, '')
      .replace(/\s+and$/i, '');
  }

  function splitParagraphs(value) {
    return String(value || '')
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function normalizeDiagnostics(diagnostics) {
    return ensureArray(diagnostics).map((diag) => {
      if (!diag || typeof diag !== 'object') {
        return info(String(diag || 'Diagnostic'));
      }
      if (diag.level) {
        return diag;
      }
      return Object.assign({}, diag, {level: diag.severity || 'info'});
    });
  }

  function singleLine(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function paragraphText(value) {
    return String(value || '').trim() || 'The event resolves into a visible political consequence.';
  }

  function validMonth(value) {
    return Number.isInteger(value) && value >= 1 && value <= 12;
  }

  function optionLabel(index) {
    return ['A', 'B', 'C', 'D'][index] || String(index + 1);
  }

  function looksLikeChineseStringComparison(value) {
    return /[=!<>]\s*['"][^'"]*[\u3400-\u9fff]/.test(String(value || ''));
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function firstString() {
    for (let index = 0; index < arguments.length; index += 1) {
      if (typeof arguments[index] === 'string' && arguments[index]) {
        return arguments[index];
      }
    }
    return '';
  }

  function error(message) {
    return {level: 'error', message};
  }

  function warning(message) {
    return {level: 'warning', message};
  }

  function info(message) {
    return {level: 'info', message};
  }

  function ok(message) {
    return {level: 'ok', message};
  }
})(typeof window !== 'undefined' ? window : globalThis);
