(function initProjectMapEntrySidebarWizard(global) {
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
    entryModel: null,
    evidence: null,
    lastDraft: null,
    lastOutput: null
  };

  let elements = null;

  const api = {
    setProjectIndex,
    setIndex: setProjectIndex,
    applyEntryDraftToForm,
    loadDraft: applyEntryDraftToForm,
    refresh: () => renderEntryWizard(),
    getDraft: () => state.lastDraft,
    getOutput: () => state.lastOutput
  };

  global.ProjectMapEntrySidebarWizard = api;

  if (!global || !global.document) {
    return;
  }

  onReady(() => startEntryWizard(global.document));

  function onReady(callback) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function startEntryWizard(document) {
    elements = {
      form: document.getElementById('entry-sidebar-form'),
      draftFile: document.getElementById('entry-draft-file'),
      draftStatus: document.getElementById('entry-draft-status'),
      indexStatus: document.getElementById('entry-index-status'),
      coreStatus: document.getElementById('entry-core-status'),
      diagnostics: document.getElementById('entry-diagnostics'),
      playability: document.getElementById('entry-playability-checklist'),
      routeMap: document.getElementById('entry-route-map'),
      firstTarget: document.getElementById('entry-first-target'),
      variableSearch: document.getElementById('entry-variable-search'),
      variableCandidates: document.getElementById('entry-variable-candidates'),
      createFirstEvent: document.getElementById('entry-create-first-event'),
      playerPreview: document.getElementById('entry-player-preview'),
      jsonPreview: document.getElementById('entry-json-preview'),
      installPreview: document.getElementById('entry-install-preview'),
      patchPreview: document.getElementById('entry-patch-preview'),
      previewTabs: Array.from(document.querySelectorAll('[data-entry-preview-tab]')),
      previewPanels: Array.from(document.querySelectorAll('[data-entry-preview-panel]')),
      downloadJson: document.getElementById('entry-download-json'),
      downloadNotes: document.getElementById('entry-download-notes'),
      downloadPlan: document.getElementById('entry-download-plan'),
      reviewInstall: document.getElementById('entry-review-install'),
      downloadPatch: document.getElementById('entry-download-patch')
    };

    bindPreviewTabs();
    bindIndexEvents();
    bindDraftLoading();
    bindForm();
    bindVariables();
    bindDownloads();
    bindLocaleEvents();
    renderEntryWizard();
  }

  function bindPreviewTabs() {
    const activate = (target) => {
      const next = target || 'preview';
      elements.previewTabs.forEach((tab) => {
        const active = tab.dataset.entryPreviewTab === next;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      elements.previewPanels.forEach((panel) => {
        const active = panel.dataset.entryPreviewPanel === next;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    };
    elements.previewTabs.forEach((tab) => tab.addEventListener('click', () => activate(tab.dataset.entryPreviewTab)));
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
      refreshTargetOptions(fieldValue('entry-first-target'));
      renderEntryWizard();
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
          applyEntryDraftToForm(JSON.parse(String(reader.result || '')), {fileName: file.name});
        } catch (err) {
          setStatus(elements.draftStatus, t('create.status.entryDraftParseFailed', 'Entry/sidebar draft parse failed: {error}').replace('{error}', err.message), 'warning');
          renderEntryWizard();
        }
      };
      reader.onerror = () => setStatus(elements.draftStatus, t('create.status.entryDraftReadFailed', 'Entry/sidebar draft read failed.'), 'warning');
      reader.readAsText(file);
    });
  }

  function bindForm() {
    if (!elements.form) {
      return;
    }
    elements.form.addEventListener('input', () => renderEntryWizard());
    elements.form.addEventListener('change', () => renderEntryWizard());
    elements.form.addEventListener('submit', (event) => {
      event.preventDefault();
      renderEntryWizard();
    });
    if (elements.createFirstEvent) {
      elements.createFirstEvent.addEventListener('click', createFirstEventDraft);
    }
  }

  function bindVariables() {
    if (elements.variableSearch) {
      elements.variableSearch.addEventListener('input', renderVariableCandidates);
    }
    if (elements.variableCandidates) {
      elements.variableCandidates.addEventListener('click', (event) => {
        const button = event.target.closest('[data-variable-action="entry-status-line"]');
        if (!button) {
          return;
        }
        appendStatusLine(button.dataset.variableName || '');
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
    const core = entryDraftApi();
    state.entryModel = core && typeof core.buildEntryModel === 'function'
      ? core.buildEntryModel(state.projectIndex)
      : null;
    state.evidence = state.entryModel ? {
      root: state.entryModel.root,
      sidebar: state.entryModel.sidebar,
      hasGeneratedSidebarOnly: state.entryModel.hasGeneratedSidebarOnly
    } : null;
    const name = meta && meta.file && meta.file.name ? meta.file.name : t('create.status.projectIndexLoaded', 'ProjectIndex loaded.');
    setStatus(elements.indexStatus, name, 'ready');
    refreshTargetOptions(fieldValue('entry-first-target'));
    if (core && typeof core.defaultDraft === 'function' && !state.lastDraft) {
      applyEntryDraftToForm(core.defaultDraft(state.projectIndex), {fileName: t('create.status.defaultEntryDraft', 'Detected entry/sidebar draft')});
      return;
    }
    renderEntryWizard();
  }

  function applyEntryDraftToForm(input, meta) {
    const core = entryDraftApi();
    const draft = core && typeof core.normalizeDraft === 'function' ? core.normalizeDraft(input) : input;
    if (!draft) {
      return;
    }
    state.evidence = draft.evidence || state.evidence || null;
    setFieldValue('entry-id', draft.id);
    setFieldValue('entry-title', draft.title);
    setFieldValue('entry-root-title', draft.rootTitle);
    setFieldValue('entry-root-heading', draft.rootHeading);
    setFieldValue('entry-root-intro', draft.rootIntro);
    refreshTargetOptions(draft.firstTargetId);
    setFieldValue('entry-first-target', draft.firstTargetId);
    setFieldValue('entry-first-option-title', draft.firstOptionTitle);
    setFieldValue('entry-sidebar-title', draft.sidebarTitle);
    setFieldValue('entry-sidebar-heading', draft.sidebarHeading);
    setFieldValue('entry-sidebar-body', draft.sidebarBody);
    setFieldValue('entry-sidebar-status-lines', draft.sidebarStatusLines);
    setStatus(elements.draftStatus, meta && meta.fileName
      ? t('create.status.loadedFile', 'Loaded {file}').replace('{file}', meta.fileName)
      : t('create.status.entryDraftLoaded', 'Entry/sidebar draft loaded.'), 'ready');
    renderEntryWizard();
  }

  function renderEntryWizard() {
    if (!elements || !elements.form) {
      return;
    }
    const draft = draftFromForm();
    const output = renderEntryOutput(draft);
    state.lastDraft = draft;
    state.lastOutput = output;
    setStatus(elements.coreStatus, output.coreUsed
      ? t('create.status.entryCoreLoaded', 'EntrySidebarDraft core loaded.')
      : t('create.status.entryCorePending', 'EntrySidebarDraft core pending.'), output.coreUsed ? 'ready' : 'warning');
    renderDiagnostics(output.diagnostics);
    renderPlayability();
    renderRouteMap(draft);
    setText(elements.playerPreview, output.playerPreview);
    setText(elements.jsonPreview, output.draftJson);
    setText(elements.installPreview, renderInstallPreview(output));
    setText(elements.patchPreview, output.patchPreview);
    renderVariableCandidates();
  }

  function draftFromForm() {
    const fallbackEvidence = state.evidence || (state.entryModel ? {
      root: state.entryModel.root,
      sidebar: state.entryModel.sidebar,
      hasGeneratedSidebarOnly: state.entryModel.hasGeneratedSidebarOnly
    } : {});
    return {
      schemaVersion: '0.1',
      kind: 'entry_sidebar',
      id: normalizeIdentifier(fieldValue('entry-id'), 'entry_sidebar_update'),
      title: fieldValue('entry-title') || t('create.sample.entryTitle', 'Entry & Sidebar Update'),
      rootTitle: fieldValue('entry-root-title'),
      rootHeading: fieldValue('entry-root-heading'),
      rootIntro: fieldValue('entry-root-intro'),
      firstTargetId: fieldValue('entry-first-target'),
      firstOptionTitle: fieldValue('entry-first-option-title'),
      sidebarTitle: fieldValue('entry-sidebar-title'),
      sidebarHeading: fieldValue('entry-sidebar-heading'),
      sidebarBody: fieldValue('entry-sidebar-body'),
      sidebarStatusLines: fieldValue('entry-sidebar-status-lines'),
      evidence: fallbackEvidence
    };
  }

  function renderEntryOutput(draft) {
    const core = entryDraftApi();
    if (core && typeof core.buildExportBundle === 'function') {
      const bundle = core.buildExportBundle(draft, state.projectIndex, {locale: currentLocale()});
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
        draftFileName: draft.id + '.entry-sidebar-draft.json',
        notesFileName: draft.id + '.install-notes.txt',
        installPlanFileName: draft.id + '.install-plan.json',
        patchPreviewFileName: draft.id + '.patch-preview.diff'
      };
    }
    return {
      coreUsed: false,
      diagnostics: [{severity: 'warning', code: 'entry_sidebar_ui.core_missing', message: t('create.status.entryCoreMissing', 'EntrySidebarDraft core is not loaded.')}],
      ok: false,
      playerPreview: renderFallbackPreview(draft),
      draftJson: JSON.stringify(draft, null, 2) + '\n',
      installNotes: t('create.installNotes.manualOnly', 'Install manually: proposal only / not installed') + '\n',
      installChecklist: '',
      installPlanJson: '',
      installPlan: null,
      patchPreview: '',
      draftFileName: draft.id + '.entry-sidebar-draft.json',
      notesFileName: draft.id + '.install-notes.txt',
      installPlanFileName: draft.id + '.install-plan.json',
      patchPreviewFileName: draft.id + '.patch-preview.diff'
    };
  }

  function renderFallbackPreview(draft) {
    return [
      t('entry.preview.startMenu', 'Start Menu'),
      draft.rootHeading || draft.rootTitle || t('entry.preview.start', 'Start'),
      '',
      draft.rootIntro || t('entry.preview.noOpeningText', '(no opening text)'),
      '',
      '-> ' + (draft.firstOptionTitle || t('entry.preview.start', 'Start')),
      '',
      t('entry.preview.sidebar', 'Sidebar'),
      draft.sidebarHeading || draft.sidebarTitle || t('entry.preview.status', 'Status'),
      '',
      draft.sidebarBody || t('entry.preview.noSidebarBody', '(no sidebar body)'),
      draft.sidebarStatusLines || ''
    ].join('\n').replace(/\n+$/, '\n');
  }

  function refreshTargetOptions(selected) {
    if (!elements || !elements.firstTarget) {
      return;
    }
    const current = selected || elements.firstTarget.value || '';
    const scenes = state.entryModel && Array.isArray(state.entryModel.playableScenes)
      ? state.entryModel.playableScenes
      : [];
    const seen = new Set();
    const options = [];
    if (current) {
      options.push({id: current, title: current});
      seen.add(current);
    }
    scenes.forEach((scene) => {
      if (scene && scene.id && !seen.has(scene.id)) {
        options.push(scene);
        seen.add(scene.id);
      }
    });
    if (!options.length) {
      options.push({id: '', title: t('create.noPlayableTarget', 'No playable target detected')});
    }
    elements.firstTarget.innerHTML = options.map((scene) => {
      const label = scene.id ? scene.id + (scene.title && scene.title !== scene.id ? ' - ' + scene.title : '') : scene.title;
      return '<option value="' + escapeAttr(scene.id || '') + '">' + escapeHtml(label) + '</option>';
    }).join('');
    elements.firstTarget.value = current;
  }

  function renderVariableCandidates() {
    if (!elements || !elements.variableCandidates) {
      return;
    }
    const query = fieldValue('entry-variable-search');
    const source = state.entryModel && Array.isArray(state.entryModel.variables) ? state.entryModel.variables : [];
    const suggestions = global.ProjectMapVariableSuggestions;
    const candidates = suggestions && typeof suggestions.searchVariableCandidates === 'function'
      ? suggestions.searchVariableCandidates(state.projectIndex || {variables: source}, query, {limit: 8})
      : source.filter((item) => matchesVariable(item, query)).slice(0, 8);
    if (!candidates.length) {
      elements.variableCandidates.innerHTML = '<div class="empty-state">' + escapeHtml(t('variableAssistant.empty', 'No variable candidates yet.')) + '</div>';
      return;
    }
    elements.variableCandidates.innerHTML = candidates.map((candidate) => {
      const name = String(candidate && candidate.name || '').trim();
      const reason = String(candidate && (candidate.reason || candidate.meaning || '') || '').trim();
      return '<article class="variable-candidate">' +
        '<div><strong>' + escapeHtml(name) + '</strong>' +
        (reason ? '<p>' + escapeHtml(reason) + '</p>' : '') + '</div>' +
        '<button type="button" data-variable-action="entry-status-line" data-variable-name="' + escapeAttr(name) + '">' +
        escapeHtml(t('variableAssistant.addStatusLine', 'Add status line')) +
        '</button>' +
        '</article>';
    }).join('');
  }

  function matchesVariable(candidate, query) {
    const text = [candidate && candidate.name, candidate && candidate.reason].join(' ').toLowerCase();
    const needle = String(query || '').trim().toLowerCase();
    return !needle || text.includes(needle);
  }

  function renderPlayability() {
    if (!elements.playability) {
      return;
    }
    const rows = state.entryModel && Array.isArray(state.entryModel.playability) ? state.entryModel.playability : [];
    if (!rows.length) {
      elements.playability.innerHTML = '<div class="entry-playability-row warning"><strong>' +
        escapeHtml(t('entry.playabilityNoIndex', 'No index')) +
        '</strong><span>' +
        escapeHtml(t('entry.playabilityNoIndexBody', 'Open or index a project to check first-playable readiness.')) +
        '</span><small>' +
        escapeHtml(t('entry.playabilityMissing', 'missing')) +
        '</small></div>';
      return;
    }
    elements.playability.innerHTML = rows.map((row) => {
      const status = String(row.status || 'warning');
      const statusLabel = status === 'ready'
        ? t('entry.playabilityReady', 'ready')
        : status === 'manual'
          ? t('entry.playabilityManual', 'manual review')
          : t('entry.playabilityMissing', 'missing');
      return '<div class="entry-playability-row ' + (status === 'ready' ? 'ready' : 'warning') + '">' +
        '<strong>' + escapeHtml(playabilityLabel(row)) + '</strong>' +
        '<span>' + escapeHtml(playabilityMessage(row)) + '</span>' +
        '<small>' + escapeHtml(statusLabel) + '</small>' +
        '</div>';
    }).join('');
  }

  function renderRouteMap(draft) {
    if (!elements.routeMap) {
      return;
    }
    const items = [
      {
        id: 'start',
        label: t('entry.route.startScreen', 'Start screen'),
        value: draft.rootHeading || draft.rootTitle || t('entry.route.missing', 'Missing'),
        status: draft.rootHeading || draft.rootTitle ? 'ready' : 'warning'
      },
      {
        id: 'option',
        label: t('entry.route.firstOption', 'First option'),
        value: draft.firstOptionTitle || t('entry.route.missing', 'Missing'),
        status: draft.firstOptionTitle ? 'ready' : 'warning'
      },
      {
        id: 'target',
        label: t('entry.route.targetScene', 'Target scene'),
        value: draft.firstTargetId || t('entry.route.missing', 'Missing'),
        status: draft.firstTargetId ? 'ready' : 'warning'
      }
    ];
    elements.routeMap.innerHTML = items.map((item) => {
      return '<div class="entry-route-card ' + (item.status === 'ready' ? 'ready' : 'warning') + '">' +
        '<small>' + escapeHtml(item.label) + '</small>' +
        '<strong>' + escapeHtml(item.value) + '</strong>' +
        '</div>';
    }).join('');
  }

  function playabilityLabel(row) {
    const labels = {
      root: t('entry.playability.root', 'Root scene'),
      first_route: t('entry.playability.firstRoute', 'First route'),
      first_target: t('entry.playability.firstTarget', 'First target'),
      sidebar: t('entry.playability.sidebar', 'Sidebar/status')
    };
    return labels[row && row.id] || row && row.label || 'Check';
  }

  function playabilityMessage(row) {
    const messages = {
      root: {
        ready: t('entry.playability.rootReady', 'Root/start scene detected.'),
        warning: t('entry.playability.rootMissing', 'No root/start scene was detected.')
      },
      first_route: {
        ready: t('entry.playability.firstRouteReady', 'First start-menu route detected.'),
        warning: t('entry.playability.firstRouteMissing', 'No first playable root route was detected.')
      },
      first_target: {
        ready: t('entry.playability.firstTargetReady', 'First playable target exists in source.'),
        warning: t('entry.playability.firstTargetMissing', 'First target is missing or must be created.')
      },
      sidebar: {
        ready: t('entry.playability.sidebarReady', 'Source-backed status/sidebar scene detected.'),
        warning: t('entry.playability.sidebarMissing', 'No status/sidebar scene detected; Studio can propose one.'),
        manual: t('entry.playability.sidebarManual', 'Generated/custom sidebar needs manual review.')
      }
    };
    const status = String(row && row.status || 'warning');
    const group = messages[row && row.id] || {};
    return group[status] || row && row.message || '';
  }

  function appendStatusLine(name) {
    const safeName = String(name || '').trim();
    if (!safeName) {
      return;
    }
    const field = global.document.getElementById('entry-sidebar-status-lines');
    if (!field) {
      return;
    }
    const label = t('variableAssistant.entryLineTemplate', '{name} is active.').replace('{name}', safeName);
    const line = '[? if ' + safeName + ' > 0 : ' + label + ' ?]';
    field.value = [field.value.trim(), line].filter(Boolean).join('\n');
    renderEntryWizard();
  }

  function createFirstEventDraft() {
    const draft = draftFromForm();
    const eventWizard = global.ProjectMapWizard;
    const id = firstEventSeedId(draft);
    ensureTargetOption(id);
    setFieldValue('entry-first-target', id);
    draft.firstTargetId = id;
    renderEntryWizard();
    const effectVariable = firstVariableName();
    const eventDraft = {
      schemaVersion: '0.1',
      kind: 'world_event',
      id,
      title: draft.firstOptionTitle || draft.rootHeading || 'First event',
      heading: draft.firstOptionTitle || draft.rootHeading || 'First event',
      when: {year: 2024, monthStart: 1, monthEnd: 1, requires: '', priority: 0},
      introParagraphs: [
        draft.rootIntro || 'The first playable event begins here.'
      ],
      options: [
        {
          id: 'organize',
          label: t('create.sample.firstEventOptionA', 'Organize the first response'),
          subtitle: t('create.sample.firstEventOptionASubtitle', '+1 support'),
          effects: effectVariable ? [{variable: effectVariable, op: '+=', value: 1}] : [],
          narrativeParagraphs: [t('create.sample.firstEventOptionABody', 'The organization turns the opening into a concrete first step.')]
        },
        {
          id: 'observe',
          label: t('create.sample.firstEventOptionB', 'Observe before acting'),
          subtitle: t('create.sample.firstEventOptionBSubtitle', 'Keep capacity steady'),
          effects: [],
          narrativeParagraphs: [t('create.sample.firstEventOptionBBody', 'The organization waits for more information before choosing a direction.')]
        }
      ]
    };
    const authoringWorkspace = global.ProjectMapAuthoringWorkspace;
    if (authoringWorkspace && typeof authoringWorkspace.setTemplate === 'function') {
      authoringWorkspace.setTemplate('event', {silent: true});
    }
    const objectCanvas = global.ProjectMapObjectAuthoringCanvas;
    const seededCanvas = objectCanvas && typeof objectCanvas.openTemplate === 'function'
      ? objectCanvas.openTemplate('event', eventDraft, {source: t('create.status.seededFirstEvent', 'Seeded first event'), template: 'event'})
      : false;
    if (eventWizard && typeof eventWizard.loadDraft === 'function') {
      eventWizard.loadDraft(eventDraft, {fileName: t('create.status.seededFirstEvent', 'Seeded first event')});
    }
    if (seededCanvas || eventWizard && typeof eventWizard.loadDraft === 'function') {
      setStatus(elements.draftStatus, t('create.status.seededFirstEvent', 'Seeded first event'), 'ready');
    } else {
      setStatus(elements.draftStatus, t('create.status.eventWizardMissing', 'Event wizard is not loaded.'), 'warning');
    }
  }

  function firstVariableName() {
    const variables = state.entryModel && Array.isArray(state.entryModel.variables) ? state.entryModel.variables : [];
    return variables[0] && variables[0].name ? variables[0].name : '';
  }

  function firstEventSeedId(draft) {
    const selected = normalizeIdentifier(draft.firstTargetId || '', '');
    if (selected && !isExistingPlayableScene(selected)) {
      return selected;
    }
    const base = normalizeIdentifier(draft.id || draft.rootTitle || 'first_playable', 'first_playable');
    return base.replace(/_entry_sidebar$|_entry$|_update$/i, '') + '_first_event';
  }

  function isExistingPlayableScene(id) {
    const scenes = state.entryModel && Array.isArray(state.entryModel.playableScenes) ? state.entryModel.playableScenes : [];
    return scenes.some((scene) => scene && scene.id === id);
  }

  function ensureTargetOption(id) {
    if (!elements || !elements.firstTarget || !id) {
      return;
    }
    const exists = Array.from(elements.firstTarget.options).some((option) => option.value === id);
    if (!exists) {
      const option = global.document.createElement('option');
      option.value = id;
      option.textContent = id;
      elements.firstTarget.appendChild(option);
    }
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
    renderEntryWizard();
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

  function normalizeIdentifier(value, fallback) {
    const text = String(value || '').trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+/, '');
    return /^[A-Za-z_]/.test(text) ? text : fallback;
  }

  function setStatus(element, message, className) {
    if (!element) {
      return;
    }
    element.textContent = message || '';
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

  function entryDraftApi() {
    return global.ProjectMapEntrySidebarDraft || null;
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

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function currentLocale() {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.getLocale === 'function' ? i18n.getLocale() : 'en';
  }

})(typeof window !== 'undefined' ? window : globalThis);
