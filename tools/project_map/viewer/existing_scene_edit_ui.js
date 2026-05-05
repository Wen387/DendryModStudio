(function initProjectMapExistingSceneEditor(global) {
  'use strict';

  const EVENT_NAMES = [
    'project-map:index-loaded',
    'ProjectMap:index-loaded',
    'projectmap:index-loaded',
    'ProjectMapIndexLoaded',
    'project-map:model-loaded'
  ];

  const state = {
    active: false,
    projectIndex: null,
    model: null,
    proposal: null,
    output: null
  };

  let elements = null;

  const api = {
    openFromSelection,
    loadDraft,
    refresh,
    getDraft: () => state.proposal,
    getOutput: () => state.output,
    isActive: () => state.active,
    setProjectIndex
  };

  global.ProjectMapExistingSceneEditor = api;

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
      host: document.getElementById('existing-scene-editor-host'),
      templateButtons: Array.from(document.querySelectorAll('[data-create-template]')),
      templatePanels: Array.from(document.querySelectorAll('[data-create-template-panel]'))
    };
    if (!elements.host) {
      return;
    }
    bindIndexEvents();
    document.addEventListener('ProjectMap:create-template-changed', (event) => {
      const template = event && event.detail && event.detail.template;
      if (template && template !== 'existing') {
        deactivate();
      }
    });
  }

  function bindIndexEvents() {
    EVENT_NAMES.forEach((name) => {
      global.document.addEventListener(name, (event) => {
        const detail = event && event.detail || {};
        setProjectIndex(detail.index || detail.projectIndex || detail.model && detail.model.index || null);
      });
    });
  }

  function setProjectIndex(index) {
    if (index && typeof index === 'object') {
      state.projectIndex = index;
    }
  }

  function openFromSelection(projectIndex, view, item) {
    const core = coreApi();
    if (!core || typeof core.buildEditModel !== 'function') {
      return false;
    }
    if (projectIndex) {
      state.projectIndex = projectIndex;
    }
    state.model = core.buildEditModel(state.projectIndex, view, item, {});
    state.proposal = core.buildProposal(state.model, {});
    state.output = core.buildExportBundle(state.proposal, state.projectIndex);
    state.active = true;
    showEditor();
    render();
    return Boolean(state.model && state.model.ok);
  }

  function loadDraft(draft) {
    const core = coreApi();
    if (!core || typeof core.normalizeProposal !== 'function') {
      return false;
    }
    state.model = null;
    state.proposal = core.normalizeProposal(draft || {});
    state.output = core.buildExportBundle(state.proposal, state.projectIndex);
    state.active = true;
    showEditor();
    render();
    return true;
  }

  function refresh() {
    const core = coreApi();
    if (!core) {
      return;
    }
    if (state.model && typeof core.buildProposal === 'function') {
      const values = {};
      fieldInputs().forEach((input) => {
        values[input.dataset.existingField] = input.value;
      });
      blockInputs().forEach((input) => {
        values['block:' + input.dataset.existingBlock] = input.value;
      });
      state.proposal = core.buildProposal(state.model, values);
    } else if (state.proposal && typeof core.normalizeProposal === 'function') {
      const proposal = core.normalizeProposal(state.proposal);
      proposal.changes = proposal.changes.map((change) => {
        const input = elements.host.querySelector('[data-existing-change="' + cssEscape(change.fieldId) + '"]');
        return input ? Object.assign({}, change, {after: input.value}) : change;
      });
      state.proposal = core.normalizeProposal(proposal);
    }
    state.output = core.buildExportBundle(state.proposal, state.projectIndex);
    renderPreview();
  }

  function showEditor() {
    activateCreateMode();
    if (!elements) {
      return;
    }
    elements.templateButtons.forEach((button) => {
      button.classList.remove('is-active');
      button.setAttribute('aria-selected', 'false');
    });
    elements.templatePanels.forEach((panel) => {
      panel.classList.add('hidden');
    });
    elements.host.hidden = false;
    elements.host.classList.remove('hidden');
    global.document.dispatchEvent(new CustomEvent('ProjectMap:create-template-changed', {
      detail: {template: 'existing'}
    }));
  }

  function deactivate() {
    if (!state.active) {
      return;
    }
    state.active = false;
    if (elements && elements.host) {
      elements.host.hidden = true;
      elements.host.classList.add('hidden');
    }
  }

  function activateCreateMode() {
    const create = global.document.querySelector('[data-mode="create"]');
    if (create && typeof create.click === 'function') {
      create.click();
    }
  }

  function render() {
    if (!elements || !elements.host) {
      return;
    }
    if (!state.active) {
      elements.host.hidden = true;
      return;
    }
    const model = state.model;
    const proposal = state.proposal || {};
    elements.host.innerHTML = [
      '<section class="existing-scene-editor" data-existing-scene-editor="true">',
      renderHeader(model, proposal),
      model && model.ok ? renderEditableModel(model) : renderSavedProposal(proposal),
      renderPreviewSurface(),
      '</section>'
    ].join('');
    elements.host.querySelectorAll('[data-existing-field], [data-existing-block], [data-existing-change]').forEach((input) => {
      input.addEventListener('input', refresh);
    });
    const refreshButton = elements.host.querySelector('[data-existing-action="refresh"]');
    if (refreshButton) {
      refreshButton.addEventListener('click', refresh);
    }
    const reviewButton = elements.host.querySelector('[data-existing-action="review"]');
    if (reviewButton) {
      reviewButton.addEventListener('click', reviewCurrentPlan);
    }
    refresh();
  }

  function renderHeader(model, proposal) {
    const title = model && model.title || proposal.title || proposal.sceneId || t('existingScene.titleFallback', 'Existing scene edit');
    const sceneId = model && model.sceneId || proposal.sceneId || '';
    const sourcePath = model && model.source && model.source.path || proposal.sourcePath || '';
    const kind = (model && model.sceneKind || proposal.sceneKind) === 'card'
      ? t('existingScene.kind.card', 'Card')
      : t('existingScene.kind.event', 'Event');
    return [
      '<div class="existing-scene-header">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('existingScene.eyebrow', 'Edit existing source')) + '</div>',
      '<h2>' + escapeHtml(title) + '</h2>',
      '<p>' + escapeHtml(t('existingScene.body', 'This modifies existing source only through Review & Apply guarded replacements. Effects are shown for context and are not rewritten in this slice.')) + '</p>',
      '</div>',
      '<dl class="existing-scene-meta">',
      '<dt>' + escapeHtml(t('existingScene.kind', 'Kind')) + '</dt><dd>' + escapeHtml(kind) + '</dd>',
      '<dt>' + escapeHtml(t('existingScene.sceneId', 'Scene')) + '</dt><dd>' + escapeHtml(sceneId || '(unknown)') + '</dd>',
      '<dt>' + escapeHtml(t('existingScene.source', 'Source')) + '</dt><dd>' + escapeHtml(sourcePath || '(unknown)') + '</dd>',
      '</dl>',
      '</div>'
    ].join('');
  }

  function renderEditableModel(model) {
    const conditionFields = model.fields.filter((field) => String(field.role || '') === 'condition');
    const playerFields = model.fields.filter((field) => {
      const role = String(field.role || '');
      return !role.startsWith('option_') && role !== 'condition';
    });
    const optionFields = model.fields.filter((field) => String(field.role || '').startsWith('option_') || field.optionId);
    return [
      renderTextBlocksGroup(model.textBlocks || []),
      renderFieldGroup(t('existingScene.playerText', 'Player text'), playerFields, true),
      renderOptionsGroup(model.options, optionFields),
      renderConditionEditor(conditionFields),
      renderReadOnlyGroup(t('existingScene.conditions', 'Conditions'), conditionRows(model, conditionFields), false),
      renderReadOnlyGroup(t('existingScene.effects', 'Effects'), effectRows(model), false),
      renderReadOnlyGroup(t('existingScene.assets', 'Assets'), assetRows(model), false),
      renderReadOnlyGroup(t('existingScene.sourceEvidence', 'Advanced source evidence'), sourceRows(model), false),
      '<div class="existing-scene-actions">',
      '<button type="button" data-existing-action="refresh">' + escapeHtml(t('existingScene.refresh', 'Refresh proposal')) + '</button>',
      '<button class="primary-action" type="button" data-existing-action="review">' + escapeHtml(t('existingScene.review', 'Review & Apply')) + '</button>',
      '</div>'
    ].join('');
  }

  function renderConditionEditor(fields) {
    if (!fields.length) {
      return '';
    }
    return [
      '<details class="existing-scene-group existing-scene-condition-group" open>',
      '<summary><span>' + escapeHtml(t('existingScene.eventChain', 'Appearance and event chain')) + '</span><b class="section-count">' + fields.length + '</b></summary>',
      '<p class="existing-scene-condition-note">' + escapeHtml(t('existingScene.eventChainNote', 'Change this only when you mean to alter when this event/card can appear. Review & Apply will check the exact source line before replacing it.')) + '</p>',
      fields.map(renderField).join(''),
      '</details>'
    ].join('');
  }

  function renderTextBlocksGroup(blocks) {
    const rows = Array.isArray(blocks) ? blocks : [];
    return [
      '<details class="existing-scene-group existing-scene-block-group" open>',
      '<summary><span>' + escapeHtml(t('existingScene.textBlocks', 'Page sections')) + '</span><b class="section-count">' + rows.length + '</b></summary>',
      '<p class="existing-scene-condition-note">' + escapeHtml(t('existingScene.textBlocksNote', 'Edit complete source-backed heading/body blocks when you want to rewrite a scene page or event result without touching scripts or routing.')) + '</p>',
      rows.map(renderTextBlock).join('') || '<div class="empty-state">' + escapeHtml(t('existingScene.noTextBlocks', 'No source-backed page sections were found for this scene.')) + '</div>',
      '</details>'
    ].join('');
  }

  function renderTextBlock(block) {
    const lineCount = String(block.original || '').split('\n').length;
    const rows = Math.max(5, Math.min(14, lineCount + 2));
    return [
      '<label class="existing-scene-field existing-scene-block-field">',
      '<span>' + escapeHtml(block.label || block.id) + '</span>',
      '<small>' + escapeHtml(sourceLabel(block.source) + ' / ' + (block.editability || 'guarded_replace_section')) + '</small>',
      '<textarea rows="' + rows + '" data-existing-block="' + escapeAttr(block.id) + '">' + escapeHtml(block.value || block.original || '') + '</textarea>',
      '</label>'
    ].join('');
  }

  function renderSavedProposal(proposal) {
    const changes = ensureArray(proposal.changes);
    return [
      '<details class="existing-scene-group" open>',
      '<summary><span>' + escapeHtml(t('existingScene.savedChanges', 'Saved changes')) + '</span><b class="section-count">' + changes.length + '</b></summary>',
      changes.map((change) => [
        '<label class="existing-scene-field">',
        '<span>' + escapeHtml(change.label || change.role || change.fieldId) + '</span>',
        '<small>' + escapeHtml(sourceLabel(change.source)) + '</small>',
        '<textarea rows="4" data-existing-change="' + escapeAttr(change.fieldId) + '">' + escapeHtml(change.after || '') + '</textarea>',
        '</label>'
      ].join('')).join('') || '<div class="empty-state">' + escapeHtml(t('existingScene.noChanges', 'No changed fields yet.')) + '</div>',
      '</details>',
      '<div class="existing-scene-actions">',
      '<button type="button" data-existing-action="refresh">' + escapeHtml(t('existingScene.refresh', 'Refresh proposal')) + '</button>',
      '<button class="primary-action" type="button" data-existing-action="review">' + escapeHtml(t('existingScene.review', 'Review & Apply')) + '</button>',
      '</div>'
    ].join('');
  }

  function renderFieldGroup(title, fields, open) {
    return [
      '<details class="existing-scene-group"' + (open ? ' open' : '') + '>',
      '<summary><span>' + escapeHtml(title) + '</span><b class="section-count">' + fields.length + '</b></summary>',
      fields.map(renderField).join('') || '<div class="empty-state">' + escapeHtml(t('existingScene.noFields', 'No source-backed fields in this group.')) + '</div>',
      '</details>'
    ].join('');
  }

  function renderOptionsGroup(options, optionFields) {
    const fieldById = new Map(optionFields.map((field) => [field.id, field]));
    return [
      '<details class="existing-scene-group" open>',
      '<summary><span>' + escapeHtml(t('existingScene.options', 'Options')) + '</span><b class="section-count">' + options.length + '</b></summary>',
      options.map((option, index) => {
        const fields = [fieldById.get(option.labelFieldId), fieldById.get(option.subtitleFieldId), fieldById.get(option.unavailableFieldId)].filter(Boolean);
        return [
          '<article class="existing-option-card">',
          '<h3>' + escapeHtml(String(index + 1) + '. ' + (option.label || option.id)) + '</h3>',
          option.targetId ? '<small>' + escapeHtml('target: ' + option.targetId) + '</small>' : '',
          fields.map(renderField).join('') || '<div class="empty-state">' + escapeHtml(t('existingScene.optionNoFields', 'This option has no source-backed editable label yet.')) + '</div>',
          option.chooseIf ? '<p class="existing-readonly-line">' + escapeHtml('choose-if: ' + option.chooseIf) + '</p>' : '',
          '</article>'
        ].join('');
      }).join(''),
      '</details>'
    ].join('');
  }

  function renderField(field) {
    const rows = String(field.original || '').length > 90 ? 4 : 2;
    return [
      '<label class="existing-scene-field">',
      '<span>' + escapeHtml(field.label || field.role || field.id) + '</span>',
      '<small>' + escapeHtml(sourceLabel(field.source) + ' / ' + field.editability) + '</small>',
      '<textarea rows="' + rows + '" data-existing-field="' + escapeAttr(field.id) + '">' + escapeHtml(field.value || field.original || '') + '</textarea>',
      '</label>'
    ].join('');
  }

  function renderReadOnlyGroup(title, rows, open) {
    return [
      '<details class="existing-scene-group"' + (open ? ' open' : '') + '>',
      '<summary><span>' + escapeHtml(title) + '</span><b class="section-count">' + rows.length + '</b></summary>',
      rows.length ? rows.map((row) => '<p class="existing-readonly-line">' + escapeHtml(row) + '</p>').join('') : '<div class="empty-state">' + escapeHtml(t('existingScene.noReadonlyRows', 'No rows in this group.')) + '</div>',
      '</details>'
    ].join('');
  }

  function renderPreviewSurface() {
    return [
      '<section class="existing-scene-preview">',
      '<div class="preview-heading">' + escapeHtml(t('existingScene.proposalPreview', 'Proposal preview')) + '</div>',
      '<pre class="code-preview" data-existing-preview="true"></pre>',
      '</section>'
    ].join('');
  }

  function renderPreview() {
    if (!elements || !elements.host) {
      return;
    }
    const target = elements.host.querySelector('[data-existing-preview]');
    if (target) {
      target.textContent = state.output && (state.output.proposalText || state.output.previewText) || '';
    }
  }

  function reviewCurrentPlan() {
    refresh();
    if (!state.output || !state.output.installPlan) {
      return;
    }
    const assistant = global.ProjectMapInstallAssistant;
    if (assistant && typeof assistant.loadPlan === 'function') {
      assistant.loadPlan(state.output.installPlan, {fileName: (state.proposal && state.proposal.id || 'existing_scene_edit') + '.install-plan.json'});
      const installButton = global.document.querySelector('[data-mode="install"]');
      if (installButton && typeof installButton.click === 'function') {
        installButton.click();
      }
    }
  }

  function fieldInputs() {
    return elements && elements.host ? Array.from(elements.host.querySelectorAll('[data-existing-field]')) : [];
  }

  function blockInputs() {
    return elements && elements.host ? Array.from(elements.host.querySelectorAll('[data-existing-block]')) : [];
  }

  function conditionRows(model, editableFields) {
    const hasEditableViewIf = ensureArray(editableFields).some((field) => field.id === 'metadata_viewIf');
    return [
      !hasEditableViewIf && model.advanced && model.advanced.rawViewIf ? 'view-if: ' + model.advanced.rawViewIf : '',
      ensureArray(model.advanced && model.advanced.tags).length ? 'tags: ' + model.advanced.tags.join(', ') : ''
    ].filter(Boolean);
  }

  function effectRows(model) {
    return ensureArray(model.effects).map((effect) => {
      return [effect.variable, effect.op, effect.value, sourceLabel(effect.source)].filter(Boolean).join(' ');
    });
  }

  function assetRows(model) {
    return ensureArray(model.assets).map((asset) => {
      return [asset.role || asset.type || 'asset', asset.path || asset.label || ''].filter(Boolean).join(': ');
    });
  }

  function sourceRows(model) {
    return ensureArray(model.textBlocks).map((block) => {
      return [block.id, block.role, sourceLabel(block.source), block.editability].filter(Boolean).join(' / ');
    }).concat(ensureArray(model.fields).map((field) => {
      return [field.id, field.role, sourceLabel(field.source), field.editability].filter(Boolean).join(' / ');
    }));
  }

  function coreApi() {
    return global.ProjectMapExistingSceneEdit || null;
  }

  function sourceLabel(source) {
    const ref = source && typeof source === 'object' ? source : {};
    const path = String(ref.path || '').trim();
    if (!path) {
      return '(no source evidence)';
    }
    return path + (ref.line ? ':' + ref.line : '');
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function cssEscape(value) {
    if (global.CSS && typeof global.CSS.escape === 'function') {
      return global.CSS.escape(String(value || ''));
    }
    return String(value || '').replace(/"/g, '\\"');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
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
