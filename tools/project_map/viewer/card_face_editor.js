(function initProjectMapCardFaceEditor(global) {
  'use strict';

  function render(model, board) {
    const selected = board && board.selected || null;
    const body = model && model.eventBody || {};
    const canEdit = Boolean(selected && model && (model.objectId === selected.id || ensureArray(selected.stateTags).includes('draft')));
    return [
      '<aside class="card-face-editor" data-card-face-editor="true">',
      renderHeader(selected, board),
      renderPreview(selected),
      canEdit ? renderFields(body) : renderReadOnly(selected),
      renderDropContext(board && board.dropContext),
      renderChangeSummary(model),
      renderActions(model),
      '</aside>'
    ].join('');
  }

  function renderHeader(selected, board) {
    const labels = board && board.labels || {};
    return [
      '<header class="card-face-editor-header">',
      '<span>' + escapeHtml(t('cardBoard.editor.eyebrow', 'Selected card')) + '</span>',
      '<h3>' + escapeHtml(selected && selected.title || t('cardBoard.editor.emptyTitle', 'No card selected')) + '</h3>',
      '<p>' + escapeHtml([
        selected && selected.kind === 'advisor' ? labels.singular || t('cardBoard.type.advisor', 'Advisor') : t('create.card', 'Card'),
        selected && selected.source && selected.source.path || ''
      ].filter(Boolean).join(' / ')) + '</p>',
      '</header>'
    ].join('');
  }

  function renderPreview(card) {
    if (!card) {
      return '<section class="card-face-preview is-empty"><p>' + escapeHtml(t('cardBoard.editor.empty', 'Select a card to inspect or edit its face.')) + '</p></section>';
    }
    return [
      '<section class="card-face-preview" data-card-face-preview="true">',
      '<div class="card-face-kicker">' + escapeHtml(typeLabel(card)) + '</div>',
      '<h4>' + escapeHtml(card.heading || card.title || '') + '</h4>',
      card.subtitle ? '<em>' + escapeHtml(card.subtitle) + '</em>' : '',
      card.body ? '<p>' + escapeHtml(card.body) + '</p>' : '',
      '<div class="card-face-options">',
      ensureArray(card.options).slice(0, 4).map((option) => '<span>' + escapeHtml(option.label || option.id || '') + '</span>').join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderFields(body) {
    return [
      '<section class="card-face-fields" data-card-face-fields="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('cardBoard.editor.faceFields', 'Card face')) + '</div>',
      renderInlineField(body.title || {}, {element: 'input', titleClass: true}),
      body.heading ? renderInlineField(body.heading, {element: 'input'}) : '',
      ensureArray(body.sections).map((field) => renderInlineField(field, {element: field.id === 'card.subtitle' ? 'input' : 'textarea'})).join(''),
      renderOptions(body.options || []),
      renderMetaFields(body.metaFields || []),
      '</section>'
    ].join('');
  }

  function renderOptions(options) {
    const rows = ensureArray(options);
    if (!rows.length) {
      return '';
    }
    return [
      '<section class="card-face-option-editor">',
      '<h4>' + escapeHtml(t('cardBoard.editor.choices', 'Choices')) + '</h4>',
      rows.map((option, index) => [
        '<article class="card-face-option-row">',
        '<b>' + escapeHtml(String(index + 1)) + '</b>',
        '<div>',
        ensureArray(option.fields).map((field) => renderInlineField(field, {element: field.id && field.id.indexOf('.body') >= 0 ? 'textarea' : 'input'})).join(''),
        '</div>',
        '</article>'
      ].join('')).join(''),
      '</section>'
    ].join('');
  }

  function renderMetaFields(fields) {
    const rows = ensureArray(fields);
    if (!rows.length) {
      return '';
    }
    return [
      '<details class="card-face-meta">',
      '<summary>' + escapeHtml(t('cardBoard.editor.advanced', 'Routing and limits')) + '</summary>',
      '<div>',
      rows.map((field) => renderInlineField(field, {element: 'input'})).join(''),
      '</div>',
      '</details>'
    ].join('');
  }

  function renderReadOnly(card) {
    return [
      '<section class="card-face-readonly">',
      '<p>' + escapeHtml(card ? t('cardBoard.editor.openToEdit', 'Open this source-backed card to edit its exact source-backed face fields.') : t('cardBoard.editor.noEditable', 'No editable card face is selected.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderDropContext(context) {
    const value = context || {};
    if (!value.itemKey && !value.laneKey) {
      return '';
    }
    return [
      '<section class="card-board-drop-context" data-card-board-drop-context="true">',
      '<span>' + escapeHtml(t('cardBoard.dropContext', 'Board intent')) + '</span>',
      '<strong>' + escapeHtml([value.itemTitle || value.itemKey, value.laneLabel || value.laneKey].filter(Boolean).join(' -> ')) + '</strong>',
      value.laneTag ? '<small>' + escapeHtml('#' + value.laneTag) + '</small>' : '',
      '</section>'
    ].join('');
  }

  function renderChangeSummary(model) {
    const change = model && model.changeState || {};
    const summary = change.operationSummary || {};
    return [
      '<section class="card-face-change-summary" data-card-board-change-summary="true">',
      '<span>' + escapeHtml(t('objectCanvas.changeTitle', 'Change and safety')) + '</span>',
      '<strong>' + escapeHtml(String(change.changedCount || 0)) + ' ' + escapeHtml(t('objectCanvas.changedFields', 'Changed')) + '</strong>',
      '<small>' + escapeHtml([
        Number(summary.safeApply || 0) + ' ' + t('editing.summary.safe', 'safe'),
        Number(summary.guardedApply || 0) + ' ' + t('editing.summary.guarded', 'guarded'),
        Number(summary.manualReview || 0) + ' ' + t('editing.summary.manual', 'manual')
      ].join(' / ')) + '</small>',
      '</section>'
    ].join('');
  }

  function renderActions(model) {
    return [
      '<div class="editing-actions card-face-actions">',
      '<button type="button" data-object-canvas-action="refresh">' + escapeHtml(t('existingScene.refresh', 'Refresh proposal')) + '</button>',
      '<button type="button" data-object-canvas-action="save">' + escapeHtml(t('editing.saveToChanges', 'Save to My Changes')) + '</button>',
      '<button class="primary-action" type="button" data-object-canvas-action="review">' + escapeHtml(t('existingScene.review', 'Review & Apply')) + '</button>',
      model && model.mode !== 'existing' ? '<button type="button" data-object-canvas-action="legacy_form">' + escapeHtml(t('objectCanvas.legacyForm', 'Advanced Form')) + '</button>' : '',
      '</div>'
    ].join('');
  }

  function renderInlineField(field, options) {
    const value = String(field && field.value !== undefined ? field.value : field && field.original || '');
    const id = field && field.id || '';
    const readOnly = field && (field.readOnly || !id);
    const element = options && options.element === 'input' ? 'input' : 'textarea';
    const className = options && options.titleClass ? ' card-face-title-input' : '';
    const common = ' class="object-inline-input' + className + '" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '"' + (readOnly ? ' readonly' : '');
    return [
      '<label class="object-inline-field card-face-field card-face-field-' + escapeAttr(field && field.status || 'guarded') + '">',
      '<span>' + escapeHtml(field && field.label || id || '') + '</span>',
      element === 'input'
        ? '<input type="text"' + common + ' value="' + escapeAttr(value) + '">'
        : '<textarea rows="' + rowsFor(value) + '"' + common + '>' + escapeHtml(value) + '</textarea>',
      '</label>'
    ].join('');
  }

  function typeLabel(card) {
    if (card && card.kind === 'advisor') {
      return t('cardBoard.type.advisor', 'Advisor');
    }
    if (card && card.stateTags && card.stateTags.includes('draft')) {
      return t('storyboard.state.draft', 'Draft');
    }
    return t('create.card', 'Card');
  }

  function rowsFor(value) {
    return String(Math.max(3, Math.min(10, String(value || '').split('\n').length + 1)));
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
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

  const api = {render};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapCardFaceEditor = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
