(function initProjectMapLightweightObjectPreview(global) {
  'use strict';

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const ensureArray = domTextUtils.ensureArray;
  const escapeHtml = domTextUtils.escapeHtml;
  const escapeAttr = domTextUtils.escapeAttr;

  const api = {
    render,
    renderCard
  };

  if (global) {
    global.ProjectMapLightweightObjectPreview = api;
  }

  function render(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const template = normalizeTemplate(model && (model.template || model.mode || model.objectKind || opts.template));
    if (template === 'card') {
      return renderCard(cardFromModel(model), opts);
    }
    if (template === 'surface') {
      return renderTextPatch(model, opts);
    }
    if (template === 'news') {
      return renderStoryObject(model, opts, 'news');
    }
    return renderStoryObject(model, opts, 'event');
  }

  function renderStoryObject(model, options, kind) {
    const body = model && model.eventBody || {};
    const output = model && model.changeState && model.changeState.output || {};
    const title = fieldText(body.title) || model && model.title || fallbackPreviewTitle(kind);
    const subtitle = sourceLabel(model) || output.fileName || '';
    const sections = ensureArray(body.sections).map(fieldText).filter(Boolean);
    const optionsList = ensureArray(body.options);
    const previewText = output.playerPreview || output.previewText || output.proposalText || '';
    const fallbackSections = !sections.length && previewText ? splitPreview(previewText).slice(0, 3) : [];
    return [
      '<section class="lightweight-object-preview is-' + escapeAttr(kind) + '" data-lightweight-object-preview="' + escapeAttr(kind) + '" data-object-canvas-preview="true" data-editing-preview="true">',
      renderPreviewHeader(kind),
      '<article class="lightweight-object-frame">',
      '<div class="lightweight-object-kicker">' + escapeHtml(kind === 'news' ? t('objectPreview.news', 'News') : t('objectPreview.event', 'World Event')) + '</div>',
      '<h4>' + renderTextInline(title) + '</h4>',
      subtitle ? '<em>' + escapeHtml(subtitle) + '</em>' : '',
      sections.length || fallbackSections.length
        ? ensureArray(sections.length ? sections : fallbackSections).map((text) => renderTextBlocks(text, {empty: false})).join('')
        : '<p class="lightweight-object-muted">' + escapeHtml(t('objectPreview.empty', 'No player-facing text is available yet.')) + '</p>',
      renderOptionPreview(optionsList),
      '</article>',
      '</section>'
    ].join('');
  }

  function renderCard(card, options) {
    const selectedObject = options && options.selectedObject || {};
    if (!card) {
      return [
        '<section class="lightweight-object-preview is-card is-empty" data-lightweight-object-preview="card" data-object-canvas-preview="true" data-card-face-preview="true" data-editing-preview="true">',
        '<p>' + escapeHtml(t('cardBoard.editor.empty', 'Select a card to inspect or edit its face.')) + '</p>',
        '</section>'
      ].join('');
    }
    const optionIndex = selectedObject && selectedObject.kind === 'option' ? Number(selectedObject.optionIndex || 0) : -1;
    const optionsList = ensureArray(card.options);
    const bodyText = cardBodyText(card.body);
    return [
      '<section class="lightweight-object-preview is-card" data-lightweight-object-preview="card" data-object-canvas-preview="true" data-card-face-preview="true" data-editing-preview="true">',
      renderPreviewHeader('card'),
      '<article class="lightweight-card-face">',
      '<div class="lightweight-object-kicker">' + escapeHtml(card.type || card.kind || t('objectPreview.card', 'Card')) + '</div>',
      '<h4>' + renderTextInline(card.heading || card.title || t('objectPreview.card', 'Card')) + '</h4>',
      card.subtitle ? '<em>' + renderTextInline(card.subtitle) + '</em>' : '',
      bodyText ? renderTextBlocks(bodyText, {empty: false}) : '',
      optionsList.length ? [
        '<div class="lightweight-card-options">',
        optionsList.slice(0, 5).map((option, index) => '<span class="' + (index === optionIndex ? 'is-selected' : '') + '">' + renderTextInline(option.label || option.title || option.id || String(index + 1)) + '</span>').join(''),
        '</div>'
      ].join('') : '',
      '</article>',
      '</section>'
    ].join('');
  }

  function renderTextPatch(model) {
    const change = model && model.changeState || {};
    const draft = change.draft || {};
    const output = change.output || {};
    const title = model && model.title || draft.title || t('objectPreview.textPatch', 'Text Patch');
    const before = draft.originalText || draft.original || draft.find || output.patchPreview || '';
    const after = draft.replacementText || draft.replacement || draft.replace || output.playerPreview || output.previewText || '';
    return [
      '<section class="lightweight-object-preview is-text-patch" data-lightweight-object-preview="text-patch" data-object-canvas-preview="true" data-editing-preview="true">',
      renderPreviewHeader('textPatch'),
      '<article class="lightweight-object-frame">',
      '<div class="lightweight-object-kicker">' + escapeHtml(t('objectPreview.textPatch', 'Text Patch')) + '</div>',
      '<h4>' + renderTextInline(title) + '</h4>',
      '<div class="lightweight-text-patch-grid">',
      renderPatchSide(t('objectPreview.before', 'Before'), before),
      renderPatchSide(t('objectPreview.after', 'After'), after),
      '</div>',
      '</article>',
      '</section>'
    ].join('');
  }

  function renderPreviewHeader(kind) {
    return [
      '<header class="lightweight-object-preview-header">',
      '<span>' + escapeHtml(t('objectPreview.eyebrow', 'Studio preview')) + '</span>',
      '<strong>' + escapeHtml(labelForKind(kind)) + '</strong>',
      '</header>'
    ].join('');
  }

  function renderOptionPreview(optionsList) {
    const rows = ensureArray(optionsList);
    if (!rows.length) {
      return '';
    }
    return [
      '<div class="lightweight-object-options">',
      '<span>' + escapeHtml(t('objectPreview.choices', 'Choices')) + '</span>',
      rows.slice(0, 5).map((option, index) => '<button type="button" disabled>' + renderTextInline(optionLabel(option, index)) + '</button>').join(''),
      '</div>'
    ].join('');
  }

  function renderPatchSide(label, value) {
    return [
      '<div>',
      '<span>' + escapeHtml(label) + '</span>',
      renderTextBlocks(collapseWhitespace(value) || t('objectPreview.noPreview', 'No preview text'), {empty: false}),
      '</div>'
    ].join('');
  }

  function cardFromModel(model) {
    const body = model && model.eventBody || {};
    return {
      title: fieldText(body.title) || model && model.title || '',
      heading: fieldText(body.heading) || fieldText(body.title) || model && model.title || '',
      subtitle: fieldText(firstSection(body.sections, 'subtitle', false)),
      body: fieldText(firstSection(body.sections, 'body', false)) || fieldText(firstSection(body.sections, 'intro', false)) || fieldText(firstSection(body.sections, 'description', false)) || fieldText(firstSection(body.sections, '', true)),
      options: ensureArray(body.options).map((option, index) => ({label: optionLabel(option, index)}))
    };
  }

  function firstSection(sections, key, allowFallback) {
    const rows = ensureArray(sections);
    const wanted = String(key || '').toLowerCase();
    if (!wanted && allowFallback) {
      return rows[0] || null;
    }
    return rows.find((field) => String(field && (field.id || field.key || field.label) || '').toLowerCase().indexOf(wanted) >= 0) || (allowFallback ? rows[0] : null) || null;
  }

  function optionLabel(option, index) {
    const fields = ensureArray(option && option.fields);
    const labelField = fields.find((field) => /label|title|heading/i.test(String(field && (field.id || field.key || field.label) || '')));
    return fieldText(labelField) || option && (option.label || option.title || option.id) || String(index + 1);
  }

  function fieldText(field) {
    if (!field) {
      return '';
    }
    if (typeof field === 'string') {
      return field;
    }
    return collapseWhitespace(field.value || field.replacement || field.text || field.original || '');
  }

  function cardBodyText(value) {
    let text = collapseWhitespace(value);
    if (!text) {
      return '';
    }
    const bodyStart = text.indexOf('=');
    if (bodyStart >= 0 && /(?:^|\s)(?:title|new-page|is-card|tags|priority|frequency|max-visits):/.test(text.slice(0, bodyStart))) {
      text = text.slice(bodyStart + 1).trim();
    }
    text = text.replace(/\s*@option_[^@]+/g, '').trim();
    return text;
  }

  function sourceLabel(model) {
    const source = model && model.source || model && model.item && model.item.source || {};
    return source.path ? source.path + (source.line ? ':' + source.line : '') : model && model.sourcePath || '';
  }

  function splitPreview(text) {
    return String(text || '').split(/\n{2,}|\r?\n/).map(collapseWhitespace).filter(Boolean);
  }

  function normalizeTemplate(template) {
    const text = String(template || '').trim();
    if (text === 'new_event' || text === 'world_event') {
      return 'event';
    }
    if (text === 'news_item') {
      return 'news';
    }
    if (text === 'surface_text' || text === 'text' || text === 'textPatch') {
      return 'surface';
    }
    return text || 'event';
  }

  function labelForKind(kind) {
    return {
      event: t('objectPreview.event', 'World Event'),
      news: t('objectPreview.news', 'News'),
      card: t('objectPreview.card', 'Card'),
      textPatch: t('objectPreview.textPatch', 'Text Patch')
    }[kind] || t('objectPreview.title', 'Object Preview');
  }

  function fallbackPreviewTitle(kind) {
    return kind === 'news' ? t('objectPreview.news', 'News') : t('objectPreview.event', 'World Event');
  }

  function collapseWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function renderTextBlocks(value, options) {
    const renderer = richTextApi();
    if (renderer && typeof renderer.renderBlocks === 'function') {
      return renderer.renderBlocks(value, options || {});
    }
    const text = String(value || '').trim();
    return text ? '<p>' + escapeHtml(text) + '</p>' : '';
  }

  function renderTextInline(value) {
    const renderer = richTextApi();
    if (renderer && typeof renderer.renderInline === 'function') {
      return renderer.renderInline(value);
    }
    return escapeHtml(value);
  }

  function richTextApi() {
    if (global && global.ProjectMapVisibleTextRenderer) {
      return global.ProjectMapVisibleTextRenderer;
    }
    if (typeof require === 'function') {
      try {
        return require('./visible_text_renderer.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }
})(typeof window !== 'undefined' ? window : globalThis);
