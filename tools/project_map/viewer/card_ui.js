(function initProjectMapCardWizard(global) {
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
    variableCandidates: [],
    lastConditionFieldId: 'card-view-if',
    lastDraft: null,
    lastOutput: null
  };

  let elements = null;

  const api = {
    setProjectIndex,
    setIndex: setProjectIndex,
    applyCardDraftToForm,
    loadDraft: applyCardDraftToForm,
    refresh: () => renderCardWizard(),
    getDraft: () => state.lastDraft,
    getOutput: () => state.lastOutput,
    helpers: {effectsFromText, effectsToText}
  };

  global.ProjectMapCardWizard = api;

  if (!global || !global.document) {
    return;
  }

  onReady(() => startCardWizard(global.document));

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

  function startCardWizard(document) {
    elements = {
      form: document.getElementById('card-wizard-form'),
      draftFile: document.getElementById('card-draft-file'),
      draftStatus: document.getElementById('card-draft-status'),
      indexStatus: document.getElementById('card-index-status'),
      coreStatus: document.getElementById('card-core-status'),
      optionCount: document.getElementById('card-option-count'),
      assetRefs: document.getElementById('card-asset-refs'),
      assetFile: document.getElementById('card-asset-file'),
      assetInstallRequests: document.getElementById('card-asset-install-requests'),
      draftAssetPanel: document.getElementById('card-draft-asset-panel'),
      assetPicker: document.getElementById('card-asset-picker'),
      assetManifest: document.getElementById('card-asset-manifest'),
      variableSearch: document.getElementById('card-variable-search'),
      variableCandidates: document.getElementById('card-variable-candidates'),
      optionBlocks: Array.from(document.querySelectorAll('[data-card-option-index]')),
      diagnostics: document.getElementById('card-diagnostics'),
      playerPreview: document.getElementById('card-player-preview'),
      scenePreview: document.getElementById('card-scene-preview'),
      jsonPreview: document.getElementById('card-json-preview'),
      installPreview: document.getElementById('card-install-preview'),
      patchPreview: document.getElementById('card-patch-preview'),
      previewTabs: Array.from(document.querySelectorAll('[data-card-preview-tab]')),
      previewPanels: Array.from(document.querySelectorAll('[data-card-preview-panel]')),
      downloadScene: document.getElementById('card-download-scene'),
      downloadJson: document.getElementById('card-download-json'),
      downloadNotes: document.getElementById('card-download-notes'),
      downloadPlan: document.getElementById('card-download-plan'),
      reviewInstall: document.getElementById('card-review-install'),
      downloadPatch: document.getElementById('card-download-patch'),
      effectTarget: document.getElementById('card-effect-target'),
      effectVariable: document.getElementById('card-effect-variable'),
      effectVariableOptions: document.getElementById('card-effect-variable-options'),
      effectOp: document.getElementById('card-effect-op'),
      effectValue: document.getElementById('card-effect-value'),
      effectAppend: document.getElementById('card-effect-append')
    };

    bindPreviewTabs();
    bindIndexEvents();
    bindDraftLoading();
    bindForm();
    bindDownloads();
    bindEffectHelper();
    bindVariableAssistant();
    bindAssetReferenceEvents();
    updateOptionVisibility();
    renderCardWizard();
  }

  function bindPreviewTabs() {
    const activate = (target) => {
      const next = target || 'scene';
      elements.previewTabs.forEach((tab) => {
        const active = tab.dataset.cardPreviewTab === next;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      elements.previewPanels.forEach((panel) => {
        const active = panel.dataset.cardPreviewPanel === next;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    };
    elements.previewTabs.forEach((tab) => tab.addEventListener('click', () => activate(tab.dataset.cardPreviewTab)));
    activate('scene');
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
          applyCardDraftToForm(JSON.parse(String(reader.result || '')), {fileName: file.name});
        } catch (err) {
          setStatus(elements.draftStatus, t('create.status.cardDraftParseFailed', 'Card draft parse failed: {error}').replace('{error}', err.message), 'warning');
          renderCardWizard();
        }
      };
      reader.onerror = () => setStatus(elements.draftStatus, t('create.status.cardDraftReadFailed', 'Card draft read failed.'), 'warning');
      reader.readAsText(file);
    });
  }

  function bindForm() {
    if (!elements.form) {
      return;
    }
    elements.form.addEventListener('input', () => renderCardWizard());
    elements.form.addEventListener('change', (event) => {
      if (event.target && event.target.id === 'card-asset-file') {
        handleAssetFileSelection(event.target.files);
        event.target.value = '';
      }
      updateOptionVisibility();
      renderCardWizard();
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
      appendAssetRefToField('card-asset-refs', parseAssetRefPayload(button.dataset.assetRef));
      renderCardWizard();
    });
    elements.form.addEventListener('submit', (event) => {
      event.preventDefault();
      renderCardWizard();
    });
  }

  function bindVariableAssistant() {
    if (!elements.variableSearch) {
      return;
    }
    elements.variableSearch.addEventListener('input', () => renderVariableAssistant());
  }

  function bindDownloads() {
    if (elements.downloadScene) {
      elements.downloadScene.addEventListener('click', () => {
        const output = ensureDownloadableOutput();
        if (output) {
          downloadText(output.sceneFileName, output.scene, 'text/plain');
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

  function bindEffectHelper() {
    if (!elements.effectAppend) {
      return;
    }
    elements.effectAppend.addEventListener('click', () => {
      const target = String(elements.effectTarget && elements.effectTarget.value || 'option:0');
      const match = target.match(/^option:(\d)$/);
      const index = match ? Number(match[1]) : 0;
      const variable = String(elements.effectVariable && elements.effectVariable.value || '').trim();
      const op = String(elements.effectOp && elements.effectOp.value || '+=').trim();
      const value = String(elements.effectValue && elements.effectValue.value || '1').trim();
      if (!variable) {
        return;
      }
      const textarea = global.document.getElementById('card-option-' + index + '-effects');
      if (!textarea) {
        return;
      }
      const prefix = textarea.value.trim() ? textarea.value.replace(/\s*$/, '\n') : '';
      textarea.value = prefix + variable + ' ' + op + ' ' + value;
      renderCardWizard();
    });
  }

  function bindAssetReferenceEvents() {
    if (!global.document) {
      return;
    }
    global.document.addEventListener('ProjectMap:asset-reference-selected', (event) => {
      const detail = event.detail || {};
      if (detail.target !== 'card') {
        return;
      }
      appendAssetRefToField('card-asset-refs', detail.assetRef || detail.asset || {});
      renderCardWizard();
    });
    global.document.addEventListener('ProjectMap:asset-install-request-selected', (event) => {
      const detail = event.detail || {};
      if (detail.target !== 'card') {
        return;
      }
      appendAssetInstallRequestToField('card-asset-install-requests', detail.assetInstallRequest || detail.request || {});
      appendAssetRefToField('card-asset-refs', detail.assetRef || detail.asset || {});
      renderCardWizard();
    });
  }

  function setProjectIndex(index, meta) {
    state.projectIndex = index || null;
    state.variableCandidates = buildVariableCandidates(index);
    const name = meta && meta.file && meta.file.name ? meta.file.name : 'ProjectIndex loaded.';
    setStatus(elements.indexStatus, name, 'ready');
    updateVariableDatalist();
    renderCardWizard();
  }

  function applyCardDraftToForm(input, meta) {
    const apiCore = cardDraftApi();
    const draft = apiCore ? apiCore.normalizeDraft(input) : input;
    if (!draft) {
      return;
    }
    setFieldValue('card-id', draft.id);
    setFieldValue('card-kind', draft.cardKind || 'action_card');
    setFieldValue('card-title', draft.title);
    setFieldValue('card-heading', draft.heading);
    setFieldValue('card-tags', (draft.tags || []).join(', '));
    setFieldValue('card-view-if', draft.viewIf);
    setFieldValue('card-priority', draft.priority);
    setFieldValue('card-frequency', draft.frequency);
    setFieldValue('card-max-visits', draft.maxVisits);
    setFieldValue('card-subtitle', draft.subtitle);
    setFieldValue('card-intro', (draft.introParagraphs || []).join('\n\n'));
    setFieldValue('card-asset-refs', assetRefsToText(draft.assetRefs));
    setFieldValue('card-asset-install-requests', assetInstallRequestsToText(draft.assetInstallRequests));
    setFieldValue('card-option-count', Math.min(4, Math.max(2, (draft.options || []).length || 2)));
    (draft.options || []).slice(0, 4).forEach((option, index) => {
      setFieldValue('card-option-' + index + '-id', option.id);
      setFieldValue('card-option-' + index + '-label', option.label);
      setFieldValue('card-option-' + index + '-subtitle', option.subtitle);
      setFieldValue('card-option-' + index + '-effects', effectsToText(option.effects));
      setFieldValue('card-option-' + index + '-body', (option.narrativeParagraphs || []).join('\n\n'));
      setFieldValue('card-option-' + index + '-choose-if', option.chooseIf);
      setFieldValue('card-option-' + index + '-unavailable', option.unavailableText);
      setFieldValue('card-option-' + index + '-goto-after', option.gotoAfter || 'root');
    });
    setStatus(elements.draftStatus, meta && meta.fileName
      ? t('create.status.loadedFile', 'Loaded {file}').replace('{file}', meta.fileName)
      : t('create.status.cardDraftLoaded', 'Card draft loaded.'), 'ready');
    updateOptionVisibility();
    renderCardWizard();
  }

  function renderCardWizard() {
    if (!elements || !elements.form) {
      return;
    }
    const draft = draftFromForm();
    const output = renderCardOutput(draft);
    state.lastDraft = draft;
    state.lastOutput = output;
    setStatus(elements.coreStatus, output.coreUsed
      ? t('create.status.cardCoreLoaded', 'CardDraft core loaded.')
      : t('create.status.cardCorePending', 'CardDraft core pending.'), output.coreUsed ? 'ready' : 'warning');
    renderDiagnostics(output.diagnostics);
    renderMeaningPreview(elements.playerPreview, draft, {projectIndex: state.projectIndex, sourceKind: 'card'}, renderPlayerPreview(draft));
    renderVariableAssistant();
    renderDraftAssetPanel(draft);
    renderAssetPicker(draft);
    renderAssetManifest(draft);
    setText(elements.scenePreview, output.scene);
    setText(elements.jsonPreview, output.draftJson);
    setText(elements.installPreview, renderInstallPreview(output));
    setText(elements.patchPreview, output.patchPreview);
  }

  function draftFromForm() {
    const optionCount = numberValue('card-option-count') || 2;
    const options = [];
    for (let index = 0; index < optionCount; index += 1) {
      options.push({
        id: normalizeIdentifier(fieldValue('card-option-' + index + '-id'), 'option_' + (index + 1)),
        label: fieldValue('card-option-' + index + '-label'),
        subtitle: fieldValue('card-option-' + index + '-subtitle'),
        chooseIf: fieldValue('card-option-' + index + '-choose-if'),
        unavailableText: fieldValue('card-option-' + index + '-unavailable'),
        effects: effectsFromText(fieldValue('card-option-' + index + '-effects')),
        narrativeParagraphs: textBlocks(fieldValue('card-option-' + index + '-body')),
        gotoAfter: fieldValue('card-option-' + index + '-goto-after') || 'root'
      });
    }
    return {
      schemaVersion: '0.1',
      kind: 'card',
      id: normalizeIdentifier(fieldValue('card-id'), 'new_action_card'),
      title: fieldValue('card-title'),
      cardKind: fieldValue('card-kind') || 'action_card',
      tags: fieldValue('card-tags').split(/[\s,]+/).map((tag) => tag.trim()).filter(Boolean),
      viewIf: fieldValue('card-view-if'),
      priority: numberValue('card-priority'),
      frequency: numberValue('card-frequency'),
      maxVisits: numberValue('card-max-visits'),
      heading: fieldValue('card-heading') || fieldValue('card-title'),
      subtitle: fieldValue('card-subtitle'),
      introParagraphs: textBlocks(fieldValue('card-intro')),
      assetRefs: parseAssetRefsText(fieldValue('card-asset-refs')),
      assetInstallRequests: parseAssetInstallRequestsText(fieldValue('card-asset-install-requests')),
      options
    };
  }

  function renderPlayerPreview(draft) {
    const apiCore = global.ProjectMapPreviewModel;
    if (apiCore && typeof apiCore.renderPreviewText === 'function') {
      try {
        return apiCore.renderPreviewText(draft, {projectIndex: state.projectIndex, sourceKind: 'card'});
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
    const lines = [
      (draft.cardKind || 'card') + ' / priority ' + String(draft.priority ?? 0),
      draft.heading || draft.title || '(untitled card)',
      draft.subtitle || '',
      ''
    ];
    (Array.isArray(draft.introParagraphs) ? draft.introParagraphs : []).forEach((paragraph) => {
      if (paragraph) {
        lines.push(paragraph);
      }
    });
    lines.push('');
    (Array.isArray(draft.options) ? draft.options : []).forEach((option, index) => {
      lines.push('-> ' + (option.label || ('Choice ' + (index + 1))));
      if (option.subtitle) {
        lines.push('   ' + option.subtitle);
      }
    });
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  function renderCardOutput(draft) {
    const apiCore = cardDraftApi();
    if (apiCore && typeof apiCore.buildExportBundle === 'function') {
      const bundle = apiCore.buildExportBundle(draft, state.projectIndex);
      return {
        coreUsed: true,
        diagnostics: bundle.diagnostics || [],
        ok: bundle.ok,
        scene: bundle.scene || '',
        draftJson: bundle.draftJson || JSON.stringify(bundle.draft || draft, null, 2) + '\n',
        installNotes: bundle.installNotes || '',
        installChecklist: bundle.installChecklist || '',
        installPlanJson: bundle.installPlanJson || '',
        patchPreview: bundle.patchPreview || '',
        sceneFileName: draft.id + '.scene.dry',
        draftFileName: draft.id + '.card-draft.json',
        notesFileName: draft.id + '.install-notes.txt',
        installPlanFileName: draft.id + '.install-plan.json',
        patchPreviewFileName: draft.id + '.patch-preview.diff'
      };
    }
    const draftJson = JSON.stringify(draft, null, 2) + '\n';
    return {
      coreUsed: false,
      diagnostics: [{severity: 'warning', code: 'card_ui.core_missing', message: t('create.status.cardCoreMissing', 'CardDraft core is not loaded.')}],
      ok: false,
      scene: '',
      draftJson,
      installNotes: 'Install manually: proposal only / not installed\n',
      installChecklist: '',
      installPlanJson: '',
      patchPreview: '',
      sceneFileName: draft.id + '.scene.dry',
      draftFileName: draft.id + '.card-draft.json',
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

  function updateOptionVisibility() {
    if (!elements || !elements.optionBlocks) {
      return;
    }
    const count = numberValue('card-option-count') || 2;
    elements.optionBlocks.forEach((block) => {
      const index = Number(block.dataset.cardOptionIndex || 0);
      block.classList.toggle('hidden', index >= count);
    });
  }

  function updateVariableDatalist() {
    if (!elements || !elements.effectVariableOptions) {
      return;
    }
    const variables = state.projectIndex && Array.isArray(state.projectIndex.variables)
      ? state.projectIndex.variables
      : [];
    elements.effectVariableOptions.innerHTML = variables
      .map((variable) => '<option value="' + escapeHtml(variable.name || '') + '"></option>')
      .join('');
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
      setFieldValue('card-effect-variable', candidate.name);
      if (elements.effectVariable) {
        elements.effectVariable.focus();
      }
      setStatus(elements.indexStatus, t('variableAssistant.usedEffect', 'Selected {name} for the effect helper.').replace('{name}', candidate.name), 'ready');
    }
  }

  function insertVariableCondition(candidate) {
    const suggestions = variableSuggestionApi();
    const snippet = suggestions && typeof suggestions.variableSnippet === 'function'
      ? suggestions.variableSnippet(candidate)
      : {metadataCondition: candidate.name + ' = 1'};
    const targetId = state.lastConditionFieldId && global.document.getElementById(state.lastConditionFieldId)
      ? state.lastConditionFieldId
      : 'card-view-if';
    appendConditionToField(targetId, snippet.metadataCondition);
    setStatus(elements.indexStatus, t('variableAssistant.insertedCondition', 'Inserted a condition for {name}.').replace('{name}', candidate.name), 'ready');
    renderCardWizard();
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

  function buildVariableCandidates(index) {
    const suggestions = variableSuggestionApi();
    return suggestions && typeof suggestions.buildVariableCandidates === 'function'
      ? suggestions.buildVariableCandidates(index || {})
      : [];
  }

  function variableSuggestionApi() {
    return global.ProjectMapVariableSuggestions || null;
  }

  function isConditionFieldId(id) {
    return id === 'card-view-if' || /^card-option-\d+-choose-if$/.test(String(id || ''));
  }

  function ensureDownloadableOutput() {
    renderCardWizard();
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

  function effectsFromText(text) {
    return String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(=|\+=|-=)\s*(.+)$/);
      if (!match) {
        return {variable: '', op: '', value: line};
      }
      return {
        variable: match[1],
        op: match[2],
        value: parseEffectValue(match[3])
      };
    });
  }

  function effectsToText(effects) {
    return (effects || []).map((effect) => {
      return [effect.variable || '', effect.op || '', effect.value === undefined ? '' : String(effect.value)].join(' ').trim();
    }).filter(Boolean).join('\n');
  }

  function parseEffectValue(value) {
    const text = String(value || '').trim();
    if (/^-?\d+(?:\.\d+)?$/.test(text)) {
      return Number(text);
    }
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      return text.slice(1, -1);
    }
    return text;
  }

  function textBlocks(text) {
    return String(text || '').split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
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

  function appendAssetRefToField(id, assetRef) {
    const ref = normalizeAssetRef(assetRef);
    if (!ref.path) {
      return;
    }
    const field = global.document.getElementById(id);
    if (!field) {
      return;
    }
    const current = String(field.value || '').trimEnd();
    field.value = current ? current + '\n' + formatAssetRefLine(ref) : formatAssetRefLine(ref);
    field.dispatchEvent(new Event('input', {bubbles: true}));
  }

  function appendAssetInstallRequestToField(id, request) {
    const item = normalizeAssetInstallRequest(request);
    if (!item.targetPath) {
      return;
    }
    const field = global.document.getElementById(id);
    if (!field) {
      return;
    }
    const current = String(field.value || '').trimEnd();
    field.value = current ? current + '\n' + formatAssetInstallRequestLine(item) : formatAssetInstallRequestLine(item);
    field.dispatchEvent(new Event('input', {bubbles: true}));
  }

  function handleAssetFileSelection(files) {
    const selected = Array.from(files || []);
    if (!selected.length) {
      return;
    }
    const draft = draftFromForm();
    selected.forEach((file) => {
      const request = assetInstallRequestFromFile(file, draft);
      appendAssetInstallRequestToField('card-asset-install-requests', request);
      appendAssetRefToField('card-asset-refs', {
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
      return {path: '', type: 'asset', label: '', role: ''};
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
    return (Array.isArray(refs) ? refs : []).map((ref) => formatAssetRefLine(normalizeAssetRef(ref))).filter(Boolean).join('\n');
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
    const role = type === 'audio' ? 'card_audio' : 'card_image';
    const assetApi = global.ProjectMapAssetModel;
    const targetPath = assetApi && typeof assetApi.suggestAssetTargetPath === 'function'
      ? assetApi.suggestAssetTargetPath({name: file && file.name, type}, {target: 'card', draftId: draft && draft.id, role})
      : fallbackAssetTargetPath(file && file.name, type, 'cards', draft && draft.id);
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
      }, {target: 'card', draftId: draft && draft.id, role});
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
      target: 'card',
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
      target: 'card'
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

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
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

  function cardDraftApi() {
    return global.ProjectMapCardDraft || null;
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
