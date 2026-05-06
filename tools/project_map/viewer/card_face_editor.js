(function initProjectMapCardFaceEditor(global) {
  'use strict';

  function render(model, board, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const selectedObject = board && board.selectedObject || {};
    const selected = selectedObject.card || board && board.selected || null;
    const body = model && model.eventBody || {};
    const canEdit = canEditObject(selectedObject, selected, model);
    return [
      '<aside class="card-face-editor" data-card-face-editor="true">',
      renderHeader(selectedObject, selected, board),
      renderRuntimeLens(model, board, opts),
      renderPreview(selected, selectedObject),
      renderInspector(model, body, board, selectedObject, selected, canEdit),
      renderDropContext(board && board.dropContext),
      renderChangeSummary(model),
      renderActions(model, selectedObject, selected, canEdit),
      '</aside>'
    ].join('');
  }

  function renderHeader(selectedObject, selected, board) {
    const labels = board && board.labels || {};
    const objectLabel = selectionLabel(selectedObject, selected, labels);
    return [
      '<header class="card-face-editor-header">',
      '<span>' + escapeHtml(objectLabel.eyebrow) + '</span>',
      '<h3>' + escapeHtml(selectedObject && selectedObject.title || selected && selected.title || t('cardBoard.editor.emptyTitle', 'No card selected')) + '</h3>',
      '<p>' + escapeHtml([
        objectLabel.kind,
        selected && selected.source && selected.source.path || ''
      ].filter(Boolean).join(' / ')) + '</p>',
      '</header>'
    ].join('');
  }

  function renderRuntimeLens(model, board, options) {
    const api = runtimeLensApi();
    if (!api || typeof api.renderPanel !== 'function') {
      return '';
    }
    const focus = typeof api.focusFromCardBoard === 'function'
      ? api.focusFromCardBoard(options && options.projectIndex, model, board)
      : {};
    return api.renderPanel({
      focus,
      session: options.runtimeLensSession,
      status: options.runtimeLensStatus,
      sessionFocusKey: options.runtimeLensFocusKey,
      sessionDraftKey: options.runtimeLensDraftKey,
      currentDraftKey: options.runtimeLensCurrentDraftKey,
      expanded: options.runtimeLensExpanded,
      collapsed: options.runtimeLensCollapsed
    });
  }

  function renderPreview(card, selectedObject) {
    if (!card) {
      return '<section class="card-face-preview is-empty"><p>' + escapeHtml(t('cardBoard.editor.empty', 'Select a card to inspect or edit its face.')) + '</p></section>';
    }
    const optionIndex = selectedObject && selectedObject.kind === 'option' ? Number(selectedObject.optionIndex || 0) : -1;
    return [
      '<section class="card-face-preview" data-card-face-preview="true">',
      '<div class="card-face-kicker">' + escapeHtml(typeLabel(card)) + '</div>',
      '<h4>' + escapeHtml(card.heading || card.title || '') + '</h4>',
      card.subtitle ? '<em>' + escapeHtml(card.subtitle) + '</em>' : '',
      card.body ? '<p>' + escapeHtml(card.body) + '</p>' : '',
      '<div class="card-face-options">',
      ensureArray(card.options).slice(0, 4).map((option, index) => '<span class="' + (optionIndex === index ? 'is-selected' : '') + '">' + escapeHtml(option.label || option.id || '') + '</span>').join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderInspector(model, body, board, selectedObject, selected, canEdit) {
    const kind = selectedObject && selectedObject.kind || 'card';
    if (kind === 'option') {
      return renderOptionInspector(body, selectedObject, canEdit);
    }
    if (kind === 'route') {
      return renderRouteInspector(selectedObject);
    }
    if (kind === 'lane') {
      return renderLaneInspector(selectedObject, board);
    }
    if (kind === 'intent') {
      return renderIntentInspector(selectedObject);
    }
    return canEdit ? renderFields(body) : renderReadOnly(selectedObject, selected, model);
  }

  function renderOptionInspector(body, selectedObject, canEdit) {
    const option = selectedObject && selectedObject.option || {};
    const bodyOption = matchingBodyOption(body, selectedObject);
    const fields = ensureArray(bodyOption && bodyOption.fields);
    return [
      '<section class="card-face-fields card-face-option-inspector" data-card-board-option-inspector="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('cardBoard.inspector.option', 'Selected choice')) + '</div>',
      '<div class="card-board-inspector-facts">',
      fact(t('cardBoard.inspector.parentCard', 'Parent card'), selectedObject && selectedObject.card && (selectedObject.card.title || selectedObject.card.id) || ''),
      fact(t('cardBoard.inspector.target', 'Target'), option.targetId || bodyOption && bodyOption.targetId || ''),
      fact(t('cardBoard.inspector.source', 'Source'), sourceLabel(option.source)),
      '</div>',
      canEdit && fields.length
        ? fields.map((field) => renderInlineField(field, {element: field.id && field.id.indexOf('.body') >= 0 ? 'textarea' : 'input'})).join('')
        : '<p class="card-face-readonly-note">' + escapeHtml(t('cardBoard.editor.openToEdit', 'Open this source-backed card to edit its exact source-backed face fields.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderRouteInspector(selectedObject) {
    const route = selectedObject && selectedObject.route || {};
    const linked = ensureArray(route.linkedCardKeys);
    return [
      '<section class="card-face-readonly card-board-route-inspector" data-card-board-route-inspector="true">',
      '<span>' + escapeHtml(t('cardBoard.inspector.route', 'Hand route')) + '</span>',
      '<h4>' + escapeHtml(route.title || selectedObject && selectedObject.title || '') + '</h4>',
      '<div class="card-board-inspector-facts">',
      fact(t('cardBoard.inspector.target', 'Target'), [route.targetKind, route.targetId].filter(Boolean).join(': ')),
      fact(t('cardBoard.inspector.source', 'Source'), sourceLabel(route.source)),
      fact(t('cardBoard.inspector.linkedCards', 'Linked cards'), linked.join(', ') || t('cardBoard.inspector.none', 'None')),
      '</div>',
      linked.length ? '<div class="card-board-object-actions">' + linked.map((key) => '<button type="button" data-card-board-action="open_linked_card" data-card-board-action-card="' + escapeAttr(key) + '">' + escapeHtml(t('cardBoard.action.openLinked', 'Open linked card')) + '</button>').join('') + '</div>' : '',
      '</section>'
    ].join('');
  }

  function renderLaneInspector(selectedObject, board) {
    const lane = selectedObject && selectedObject.lane || {};
    const label = lane && (t(lane.labelKey, lane.fallback || lane.key) || lane.key) || selectedObject && selectedObject.laneKey || '';
    return [
      '<section class="card-face-readonly card-board-lane-inspector" data-card-board-lane-inspector="true">',
      '<span>' + escapeHtml(t('cardBoard.inspector.lane', 'Board lane')) + '</span>',
      '<h4>' + escapeHtml(label) + '</h4>',
      '<div class="card-board-inspector-facts">',
      fact(t('cardBoard.inspector.cards', 'Cards'), String(lane.totalCount || ensureArray(lane.cards).length || 0)),
      fact(t('cardBoard.inspector.tags', 'Tags'), ensureArray(lane.tags).join(', ') || t('cardBoard.inspector.none', 'None')),
      fact(t('cardBoard.inspector.visible', 'Visible'), String(ensureArray(lane.cards).length || 0) + ' / ' + String(board && board.metrics && board.metrics.visibleCardCount || 0)),
      '</div>',
      '<div class="card-board-object-actions">',
      '<button type="button" data-card-board-action="create_in_selected_lane" data-card-board-create-lane="' + escapeAttr(lane.key || selectedObject.laneKey || 'deck') + '" data-card-board-lane-label="' + escapeAttr(label) + '" data-card-board-lane-tag="' + escapeAttr(lane.tag || '') + '">' + escapeHtml(t('cardBoard.action.createHere', 'Create card in lane')) + '</button>',
      '</div>',
      '</section>'
    ].join('');
  }

  function renderIntentInspector(selectedObject) {
    const intent = selectedObject && selectedObject.intent || {};
    return [
      '<section class="card-face-readonly card-board-intent-inspector" data-card-board-intent-inspector="true">',
      '<span>' + escapeHtml(t('cardBoard.inspector.intent', 'Board intent')) + '</span>',
      '<h4>' + escapeHtml([intent.itemTitle || intent.itemKey, intent.laneLabel || intent.laneKey].filter(Boolean).join(' -> ')) + '</h4>',
      '<div class="card-board-inspector-facts">',
      fact(t('cardBoard.inspector.action', 'Action'), intent.action || ''),
      fact(t('cardBoard.inspector.lane', 'Board lane'), intent.laneLabel || intent.laneKey || ''),
      fact(t('cardBoard.inspector.tags', 'Tags'), intent.laneTag ? '#' + intent.laneTag : t('cardBoard.inspector.none', 'None')),
      '</div>',
      '<p>' + escapeHtml(t('cardBoard.inspector.intentHelp', 'This is saved with the draft so Review & Apply can show the requested board wiring next to the card text changes.')) + '</p>',
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

  function renderReadOnly(selectedObject, card) {
    return [
      '<section class="card-face-readonly">',
      '<p>' + escapeHtml(card ? readOnlyMessage(selectedObject) : t('cardBoard.editor.noEditable', 'No editable card face is selected.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderDropContext(context) {
    const value = context || {};
    if (!value.itemKey && !value.laneKey) {
      return '';
    }
    return [
      '<section class="card-board-drop-context" data-card-board-drop-context="true" data-card-board-intent="true" tabindex="0" role="button">',
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

  function renderActions(model, selectedObject, selected, canEdit) {
    return [
      renderBoardActions(model, selectedObject, selected, canEdit),
      '<div class="editing-actions card-face-actions">',
      '<button type="button" data-object-canvas-action="refresh">' + escapeHtml(t('existingScene.refresh', 'Refresh proposal')) + '</button>',
      '<button type="button" data-object-canvas-action="save">' + escapeHtml(t('editing.saveToChanges', 'Save to My Changes')) + '</button>',
      '<button class="primary-action" type="button" data-object-canvas-action="review">' + escapeHtml(t('existingScene.review', 'Review & Apply')) + '</button>',
      model && model.mode !== 'existing' ? '<button type="button" data-object-canvas-action="legacy_form">' + escapeHtml(t('objectCanvas.legacyForm', 'Advanced Form')) + '</button>' : '',
      '</div>'
    ].join('');
  }

  function renderBoardActions(model, selectedObject, selected, canEdit) {
    const kind = selectedObject && selectedObject.kind || 'card';
    const hasCard = Boolean(selected);
    if (kind === 'lane') {
      return '';
    }
    const draftLike = hasCard && (ensureArray(selected.stateTags).includes('draft') || model && model.template === 'card' && model.mode !== 'existing');
    const actions = [];
    if (hasCard) {
      actions.push('<button type="button" data-card-board-action="duplicate_card">' + escapeHtml(t('cardBoard.action.duplicate', 'Copy as draft')) + '</button>');
      actions.push('<button type="button" data-card-board-action="add_to_deck">' + escapeHtml(t('cardBoard.action.addDeck', 'Mark for deck')) + '</button>');
      actions.push('<button type="button" data-card-board-action="add_to_advisor">' + escapeHtml(t('cardBoard.action.addAdvisor', 'Mark as advisor')) + '</button>');
      actions.push('<button type="button" data-card-board-action="remove_from_lane">' + escapeHtml(t('cardBoard.action.removeLane', 'Mark unwired')) + '</button>');
    }
    if (draftLike || canEdit && model && model.template === 'card') {
      actions.push('<button type="button" data-card-board-action="set_card_kind_action">' + escapeHtml(t('cardBoard.action.actionKind', 'Action card')) + '</button>');
      actions.push('<button type="button" data-card-board-action="set_card_kind_advisor">' + escapeHtml(t('cardBoard.action.advisorKind', 'Advisor card')) + '</button>');
    }
    if (!actions.length) {
      return '';
    }
    return '<div class="card-board-object-actions" data-card-board-object-actions="true">' + actions.join('') + '</div>';
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

  function canEditObject(selectedObject, selected, model) {
    if (!selected || !model) {
      return false;
    }
    if (selectedObject && selectedObject.kind === 'route' || selectedObject && selectedObject.kind === 'lane' || selectedObject && selectedObject.kind === 'intent') {
      return false;
    }
    return Boolean(model.objectId === selected.id || ensureArray(selected.stateTags).includes('draft'));
  }

  function matchingBodyOption(body, selectedObject) {
    const rows = ensureArray(body && body.options);
    const option = selectedObject && selectedObject.option || {};
    const index = Number(selectedObject && selectedObject.optionIndex || 0);
    if (rows[index]) {
      return rows[index];
    }
    const id = String(option.id || selectedObject && selectedObject.optionId || '');
    if (id) {
      const found = rows.find((row) => String(row && row.id || '') === id);
      if (found) {
        return found;
      }
    }
    const label = String(option.label || '').trim();
    return rows.find((row) => String(row && row.label || '').trim() === label) || null;
  }

  function selectionLabel(selectedObject, selected, labels) {
    const kind = selectedObject && selectedObject.kind || 'card';
    if (kind === 'option') {
      return {eyebrow: t('cardBoard.selection.option', 'Selected choice'), kind: t('cardBoard.inspector.option', 'Choice')};
    }
    if (kind === 'route') {
      return {eyebrow: t('cardBoard.selection.route', 'Selected route'), kind: t('cardBoard.inspector.route', 'Hand route')};
    }
    if (kind === 'lane') {
      return {eyebrow: t('cardBoard.selection.lane', 'Selected lane'), kind: t('cardBoard.inspector.lane', 'Board lane')};
    }
    if (kind === 'intent') {
      return {eyebrow: t('cardBoard.selection.intent', 'Selected intent'), kind: t('cardBoard.inspector.intent', 'Board intent')};
    }
    return {
      eyebrow: t('cardBoard.editor.eyebrow', 'Selected card'),
      kind: selected && selected.kind === 'advisor' ? labels.singular || t('cardBoard.type.advisor', 'Advisor') : t('create.card', 'Card')
    };
  }

  function readOnlyMessage(selectedObject) {
    if (selectedObject && selectedObject.kind === 'option') {
      return t('cardBoard.editor.optionOpenToEdit', 'Open the parent card or copy it as a draft to edit this choice.');
    }
    return t('cardBoard.editor.openToEdit', 'Open this source-backed card to edit its exact source-backed face fields.');
  }

  function fact(label, value) {
    return [
      '<div>',
      '<span>' + escapeHtml(label) + '</span>',
      '<strong>' + escapeHtml(value || '') + '</strong>',
      '</div>'
    ].join('');
  }

  function sourceLabel(source) {
    const value = source || {};
    return [value.path || '', value.line ? ':' + value.line : ''].join('');
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

  function runtimeLensApi() {
    if (global && global.ProjectMapRuntimeLensUi) {
      return global.ProjectMapRuntimeLensUi;
    }
    if (typeof require === 'function') {
      try {
        return require('./runtime_lens_ui.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
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
