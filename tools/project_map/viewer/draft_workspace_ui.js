(function initProjectMapDraftWorkspaceUi(global) {
  'use strict';

  const TEMPLATE_LABELS = {
    event: 'World Event',
    news: 'News',
    card: 'Card',
    play_surface: 'Playable Surface',
    workspace_layout: 'Workspace Layout',
    sidebar_status: 'Sidebar / Status',
    election_results: 'Election Results',
    surface: 'Text',
    entry: 'Entry & Sidebar',
    project: 'Game Info',
    variables: 'Variables',
    existing: 'Existing edit'
  };

  const state = {
    items: [],
    activeDraftWorkspaceId: ''
  };

  let elements = null;
  const api = {
    getState: () => ({items: state.items.slice()}),
    saveCurrentDraft,
    loadDraft,
    reviewInstall,
    refresh: render
  };
  global.ProjectMapDraftWorkspaceUi = api;

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
      save: document.getElementById('draft-workspace-save'),
      exportAll: document.getElementById('draft-workspace-export'),
      status: document.getElementById('draft-workspace-status'),
      list: document.getElementById('draft-workspace-list')
    };
    if (!elements.list) {
      return;
    }
    load();
    bind();
    render();
  }

  function bind() {
    if (elements.save) {
      elements.save.addEventListener('click', saveCurrentDraft);
    }
    if (elements.exportAll) {
      elements.exportAll.addEventListener('click', exportAllDrafts);
    }
    if (elements.list) {
      elements.list.addEventListener('click', handleDraftListClick);
    }
    global.document.addEventListener('ProjectMap:create-template-changed', render);
    global.document.addEventListener('project-map:locale-changed', render);
  }

  function handleDraftListClick(event) {
    if (event && event.__dmsDraftWorkspaceHandled) {
      return;
    }
    const target = event && event.target;
    const button = target && typeof target.closest === 'function'
      ? target.closest('[data-draft-action]')
      : null;
    if (!button || button.disabled) {
      return;
    }
    if (elements && elements.list && typeof elements.list.contains === 'function' && !elements.list.contains(button)) {
      return;
    }
    const card = typeof button.closest === 'function'
      ? button.closest('[data-draft-workspace-id]')
      : null;
    const itemId = card && (card.dataset && card.dataset.draftWorkspaceId || card.getAttribute && card.getAttribute('data-draft-workspace-id')) || '';
    handleDraftAction(button.dataset && button.dataset.draftAction || button.getAttribute && button.getAttribute('data-draft-action') || '', itemId);
  }

  function markDraftActionHandled(event) {
    if (event) {
      event.__dmsDraftWorkspaceHandled = true;
    }
  }

  function handleDraftAction(action, itemId) {
    if (action === 'load') {
      loadDraft(itemId);
    } else if (action === 'review') {
      reviewInstall(itemId);
    } else if (action === 'delete') {
      deleteDraft(itemId);
    }
  }

  function load() {
    const api = workspaceApi();
    state.items = api ? api.loadDraftItems() : [];
  }

  function persist() {
    const api = workspaceApi();
    if (api) {
      api.saveDraftItems(null, state.items);
    }
  }

  function saveCurrentDraft() {
    const api = workspaceApi();
    if (!api) {
      setStatus(t('draftWorkspace.coreMissing', 'Draft workspace core is not loaded.'), 'warning');
      return;
    }
    const template = activeTemplate();
    const wizard = wizardForTemplate(template);
    if (!wizard || typeof wizard.getDraft !== 'function') {
      setStatus(t('draftWorkspace.noWizard', 'This template cannot be saved yet.'), 'warning');
      return;
    }
    if (typeof wizard.refresh === 'function') {
      wizard.refresh();
    }
    const draft = wizard.getDraft();
    if (!draft || !draft.id) {
      setStatus(t('draftWorkspace.noDraft', 'No current draft is available to save.'), 'warning');
      return;
    }
    const output = typeof wizard.getOutput === 'function' ? wizard.getOutput() : {};
    const activeWorkspaceId = typeof wizard.getDraftWorkspaceId === 'function'
      ? wizard.getDraftWorkspaceId()
      : state.activeDraftWorkspaceId;
    const existing = activeWorkspaceId
      ? state.items.find((item) => item.workspaceId === activeWorkspaceId && item.template === template && item.draftId === String(draft.id))
      : null;
    const item = api.makeDraftItem({
      template,
      draft,
      output: pruneOutput(output),
      source: 'create'
    }, {
      workspaceId: existing && existing.workspaceId,
      createdAt: existing && existing.createdAt
    });
    state.items = api.upsertDraftItem(state.items, item);
    state.activeDraftWorkspaceId = item.workspaceId || '';
    if (typeof wizard.setDraftWorkspaceId === 'function') {
      wizard.setDraftWorkspaceId(state.activeDraftWorkspaceId, draft);
    }
    persist();
    render();
    setStatus(t('draftWorkspace.saved', 'Draft saved in Studio.'), 'ready');
  }

  function loadDraft(itemId) {
    const item = state.items.find((entry) => entry.workspaceId === itemId);
    if (!item) {
      setStatus(t('draftWorkspace.missingDraft', 'Saved draft was not found.'), 'warning');
      return;
    }
    state.activeDraftWorkspaceId = item.workspaceId || '';
    const createButton = global.document.querySelector('[data-mode="create"]');
    if (createButton) {
      createButton.click();
    }
    const templateButton = global.document.querySelector('[data-create-template="' + cssEscape(item.template) + '"]');
    if (templateButton) {
      templateButton.click();
    }
    if (!templateButton && item.template) {
      const objectCanvas = global.ProjectMapObjectAuthoringCanvas;
      if (objectCanvas && typeof objectCanvas.openTemplate === 'function') {
        objectCanvas.openTemplate(item.template, item.draft, {source: 'My Changes', workspaceId: item.workspaceId});
      }
    }
    const wizard = wizardForTemplate(item.template);
    if (wizard && typeof wizard.loadDraft === 'function') {
      wizard.loadDraft(item.draft, {fileName: item.title || item.draftId || 'Studio draft'});
      if (typeof wizard.setDraftWorkspaceId === 'function') {
        wizard.setDraftWorkspaceId(state.activeDraftWorkspaceId, item.draft);
      }
      setStatus(t('draftWorkspace.loaded', 'Draft loaded into Create.'), 'ready');
    } else {
      setStatus(t('draftWorkspace.noWizard', 'This template cannot be loaded yet.'), 'warning');
    }
  }

  function reviewInstall(itemId) {
    const item = state.items.find((entry) => entry.workspaceId === itemId);
    const assistant = global.ProjectMapInstallAssistant;
    if (!item || !item.installPlan) {
      setStatus(t('draftWorkspace.noInstallPlan', 'This draft has no install plan to review yet.'), 'warning');
      return;
    }
    if (!assistant || typeof assistant.loadPlan !== 'function') {
      setStatus(t('draftWorkspace.installMissing', 'Install Assistant is not loaded.'), 'warning');
      return;
    }
    assistant.loadPlan(item.installPlan, {fileName: item.draftId + '.install-plan.json'});
    const installButton = global.document.querySelector('[data-mode="install"]');
    if (installButton) {
      installButton.click();
    }
  }

  function deleteDraft(itemId) {
    const api = workspaceApi();
    state.items = api ? api.deleteDraftItem(state.items, itemId) : state.items.filter((item) => item.workspaceId !== itemId);
    persist();
    render();
    setStatus(t('draftWorkspace.deleted', 'Draft removed.'), 'ready');
  }

  function exportAllDrafts() {
    const payload = {
      schemaVersion: '0.1',
      exportedAt: new Date().toISOString(),
      items: state.items
    };
    downloadText('dendry-studio-drafts.json', JSON.stringify(payload, null, 2) + '\n', 'application/json');
  }

  function render() {
    if (!elements || !elements.list) {
      return;
    }
    elements.list.innerHTML = '';
    if (!state.items.length) {
      setStatus(t('draftWorkspace.empty', 'No Studio drafts saved yet.'), '');
      if (elements.exportAll) {
        elements.exportAll.disabled = true;
      }
      dispatchUpdate();
      return;
    }
    if (elements.exportAll) {
      elements.exportAll.disabled = false;
    }
    setStatus(state.items.length + ' ' + t('draftWorkspace.savedCount', 'saved drafts'), 'ready');
    state.items.forEach((item) => {
      elements.list.appendChild(renderItem(item));
    });
    dispatchUpdate();
  }

  function renderItem(item) {
    const card = global.document.createElement('article');
    card.className = 'draft-workspace-item';
    card.setAttribute('data-draft-workspace-id', item.workspaceId || '');
    const previewText = previewExcerpt(item.previewText);
    card.innerHTML = [
      '<div class="draft-workspace-item-main">',
      '<div class="draft-workspace-item-title">' + escapeHtml(item.title || item.draftId || 'Draft') + '</div>',
      '<div class="draft-workspace-item-meta">',
      '<span>' + escapeHtml(templateLabel(item.template)) + '</span>',
      item.subtitle ? '<span>' + escapeHtml(item.subtitle) + '</span>' : '',
      '<span>' + escapeHtml(shortDate(item.updatedAt)) + '</span>',
      '</div>',
      previewText ? '<div class="draft-workspace-item-preview">' + escapeHtml(previewText) + '</div>' : '',
      renderInstallSummary(item.installSummary),
      renderInstallCue(item),
      renderWarnings(item.warnings),
      '</div>',
      '<div class="draft-workspace-item-actions">',
      '<button type="button" data-draft-action="load">' + escapeHtml(t('draftWorkspace.load', 'Open')) + '</button>',
      '<button type="button" data-draft-action="review">' + escapeHtml(t('draftWorkspace.review', 'Review & Apply')) + '</button>',
      '<button type="button" data-draft-action="delete">' + escapeHtml(t('draftWorkspace.delete', 'Delete')) + '</button>',
      '</div>'
    ].join('');
    const loadButton = card.querySelector('[data-draft-action="load"]');
    const reviewButton = card.querySelector('[data-draft-action="review"]');
    const deleteButton = card.querySelector('[data-draft-action="delete"]');
    loadButton.addEventListener('click', (event) => {
      markDraftActionHandled(event);
      handleDraftAction('load', item.workspaceId);
    });
    reviewButton.disabled = !item.installPlan;
    if (!item.installPlan) {
      const noPlanText = t('draftWorkspace.noInstallPlanShort', 'No install plan');
      reviewButton.textContent = noPlanText;
      reviewButton.title = noPlanText;
      reviewButton.setAttribute('aria-label', noPlanText);
    }
    reviewButton.addEventListener('click', (event) => {
      markDraftActionHandled(event);
      handleDraftAction('review', item.workspaceId);
    });
    deleteButton.addEventListener('click', (event) => {
      markDraftActionHandled(event);
      handleDraftAction('delete', item.workspaceId);
    });
    return card;
  }

  function renderInstallSummary(summary) {
    const values = summary || {};
    const rows = [
      ['draftWorkspace.safeApply', 'Safe apply', values.safeApply],
      ['draftWorkspace.guardedApply', 'Guarded apply', values.guardedApply],
      ['draftWorkspace.advancedApply', 'Advanced apply', values.advancedApply],
      ['draftWorkspace.manualReview', 'Manual review', values.manualReview],
      ['draftWorkspace.refused', 'Refused', values.refused]
    ];
    return [
      '<div class="draft-workspace-item-summary">',
      rows.map((row) => '<span>' + escapeHtml(t(row[0], row[1])) + ' ' + numberLabel(row[2]) + '</span>').join(''),
      '</div>'
    ].join('');
  }

  function renderInstallCue(item) {
    const text = item && item.installPlan
      ? t('draftWorkspace.needsReviewCheck', 'Needs check in Review & Apply')
      : t('draftWorkspace.noInstallPlanShort', 'No install plan');
    return '<div class="draft-workspace-item-cue">' + escapeHtml(text) + '</div>';
  }

  function renderWarnings(warnings) {
    if (!Array.isArray(warnings) || !warnings.length) {
      return '';
    }
    const firstWarning = collapseWhitespace(warnings[0]).slice(0, 120);
    const text = warnings.length === 1 ? firstWarning : warnings.length + ' warnings: ' + firstWarning;
    return '<div class="draft-workspace-item-warning">' + escapeHtml(text) + '</div>';
  }

  function previewExcerpt(value) {
    const text = collapseWhitespace(value);
    if (text.length <= 200) {
      return text;
    }
    return text.slice(0, 197).trimEnd() + '...';
  }

  function collapseWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function activeTemplate() {
    const objectCanvas = global.ProjectMapObjectAuthoringCanvas;
    if (objectCanvas && typeof objectCanvas.isActive === 'function' && objectCanvas.isActive()) {
      return typeof objectCanvas.activeTemplate === 'function' ? objectCanvas.activeTemplate() : 'event';
    }
    // Legacy EditingWorkspace / ExistingSceneEditor removed 2026-05-25 —
    // Object Canvas subsumes all existing-scene editing.
    const active = global.document.querySelector('[data-create-template].is-active');
    return active && active.dataset.createTemplate ? active.dataset.createTemplate : 'event';
  }

  function wizardForTemplate(template) {
    const objectCanvas = global.ProjectMapObjectAuthoringCanvas;
    if (objectCanvas && typeof objectCanvas.isActive === 'function' && objectCanvas.isActive()) {
      const active = typeof objectCanvas.activeTemplate === 'function' ? objectCanvas.activeTemplate() : template;
      if (active === template) {
        return objectCanvas;
      }
    }
    return {
      event: global.ProjectMapWizard,
      news: global.ProjectMapNewsWizard,
      card: global.ProjectMapCardWizard,
      play_surface: global.ProjectMapPlaySurfaceWizard,
      workspace_layout: global.ProjectMapWorkspaceLayoutWizard,
      sidebar_status: global.ProjectMapSidebarStatusWizard,
      surface: global.ProjectMapSurfaceTextWizard,
      entry: global.ProjectMapEntrySidebarWizard,
      project: global.ProjectMapProjectMetadataWizard,
      variables: global.ProjectMapVariableEditorWizard,
      existing: global.ProjectMapObjectAuthoringCanvas
    }[template] || null;
  }

  function pruneOutput(output) {
    if (!output || typeof output !== 'object') {
      return {};
    }
    return {
      fileName: output.fileName || output.sceneFileName || output.snippetFileName || output.proposalFileName || '',
      playerPreview: output.playerPreview || '',
      previewText: output.previewText || '',
      installPlan: output.installPlan || parseJson(output.installPlanJson),
      installPlanJson: output.installPlanJson || '',
      patchPreview: output.patchPreview || '',
      patchPreviewFileName: output.patchPreviewFileName || ''
    };
  }

  function workspaceApi() {
    return global.ProjectMapDraftWorkspace || null;
  }

  function templateLabel(template) {
    return t('draftWorkspace.template.' + template, TEMPLATE_LABELS[template] || template);
  }

  function setStatus(message, kind) {
    if (!elements || !elements.status) {
      return;
    }
    elements.status.textContent = message || '';
    elements.status.classList.toggle('is-ready', kind === 'ready');
    elements.status.classList.toggle('is-warning', kind === 'warning');
    dispatchUpdate();
  }

  function dispatchUpdate() {
    if (!global.document || typeof CustomEvent !== 'function') {
      return;
    }
    global.document.dispatchEvent(new CustomEvent('ProjectMap:draft-workspace-updated', {
      detail: {
        count: state.items.length,
        status: elements && elements.status ? elements.status.textContent || '' : ''
      }
    }));
  }

  function shortDate(value) {
    const text = String(value || '');
    return text ? text.slice(0, 16).replace('T', ' ') : '';
  }

  function numberLabel(value) {
    return String(Number(value || 0));
  }

  function parseJson(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch (err) {
      return null;
    }
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

  function cssEscape(value) {
    if (global.CSS && typeof global.CSS.escape === 'function') {
      return global.CSS.escape(String(value || ''));
    }
    return String(value || '').replace(/"/g, '\\"');
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
})(typeof window !== 'undefined' ? window : globalThis);
