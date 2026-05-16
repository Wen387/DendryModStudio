(function initProjectMapObjectCanvasPreviewEditorSync(global) {
  'use strict';

  function syncPreviewObjectEditorPane(deps) {
    const ctx = normalizeDeps(deps);
    if (!hasActivePreviewEditor(ctx) || !ctx.editor || typeof ctx.editor.renderPreviewPane !== 'function') {
      return;
    }
    ctx.host.querySelectorAll('[data-object-editing-modal-preview-pane]').forEach((node) => {
      node.innerHTML = ctx.editor.renderPreviewPane(ctx.model, {
        template: ctx.state.template,
        selectedKey: ctx.state.selectedCanvasNode
      });
    });
  }

  function syncPreviewObjectRenderedFields(deps) {
    const ctx = normalizeDeps(deps);
    if (!hasActivePreviewEditor(ctx) || !ctx.editor || typeof ctx.editor.renderTextBlocks !== 'function') {
      return;
    }
    const fields = previewObjectFieldMap(ctx.model, ctx);
    ctx.host.querySelectorAll('[data-preview-object-rendered-for]').forEach((node) => {
      const key = node.dataset && node.dataset.previewObjectRenderedFor;
      const input = key ? ctx.host.querySelector('[data-object-canvas-field="' + ctx.cssEscape(key) + '"]') : null;
      const field = key ? fields.get(key) : null;
      const value = input ? input.value : field && field.value !== undefined ? field.value : field && field.original || '';
      node.innerHTML = ctx.editor.renderTextBlocks(value, {empty: false});
    });
  }

  function previewObjectFieldMap(model, deps) {
    const ctx = normalizeDeps(deps);
    const map = new Map();
    const body = model && model.eventBody || {};
    [body.title, body.heading].forEach(addField);
    ctx.ensureArray(body.sections).forEach(addField);
    ctx.ensureArray(body.metaFields).forEach(addField);
    ctx.ensureArray(body.structureActions).forEach(addField);
    ctx.ensureArray(body.effects).forEach(addField);
    ctx.ensureArray(body.options).forEach((option) => {
      ctx.ensureArray(option && option.fields).forEach(addField);
    });
    ctx.ensureArray(body.optionEffects).forEach((group) => {
      ctx.ensureArray(group && group.fields).forEach(addField);
    });
    return map;

    function addField(field) {
      const id = field && field.id;
      if (id) {
        map.set(String(id), field);
      }
    }
  }

  function syncPreviewObjectEditorChrome(deps) {
    const ctx = normalizeDeps(deps);
    if (!hasActivePreviewEditor(ctx)) {
      return;
    }
    const title = ctx.headerTitle
      ? ctx.headerTitle(ctx.model, ctx.surface)
      : ctx.titleForModel
      ? ctx.titleForModel(ctx.model, ctx.surface)
      : ctx.model && ctx.model.title || '';
    [
      '[data-preview-object-editor-title]',
      '[data-content-storyboard-selected-title]',
      '[data-card-face-selected-title]',
      '.content-storyboard-card.is-selected .content-storyboard-title'
    ].forEach((selector) => {
      ctx.host.querySelectorAll(selector).forEach((node) => {
        if (node && !node.matches('input, textarea, select')) {
          if (selector === '[data-preview-object-editor-title]') {
            node.innerHTML = renderVisibleTextInline(title, ctx);
          } else {
            node.textContent = title;
          }
        }
      });
    });
    const footer = ctx.host.querySelector('[data-preview-object-draft-summary]');
    if (footer) {
      footer.innerHTML = renderPreviewObjectDraftSummary(ctx.model, ctx);
    }
  }

  function renderVisibleTextInline(value, deps) {
    const ctx = normalizeDeps(deps);
    const renderer = ctx.visibleTextRenderer || ctx.global.ProjectMapVisibleTextRenderer;
    return renderer && typeof renderer.renderInline === 'function'
      ? renderer.renderInline(value)
      : ctx.escapeHtml(value);
  }

  function renderPreviewObjectDraftSummary(model, deps) {
    const ctx = normalizeDeps(deps);
    const change = model && model.changeState || {};
    const summary = change.operationSummary || {};
    const route = previewObjectRouteLabel(model, ctx);
    return [
      '<div><span>' + ctx.escapeHtml(ctx.t('objectCanvas.changedFields', 'Changed')) + '</span><strong>' + ctx.escapeHtml(String(change.changedCount || 0)) + '</strong></div>',
      '<div><span>' + ctx.escapeHtml(ctx.t('editing.summary.guarded', 'Guarded')) + '</span><strong>' + ctx.escapeHtml(String(summary.guardedApply || 0)) + '</strong></div>',
      '<div><span>' + ctx.escapeHtml(ctx.t('editing.summary.manual', 'Manual')) + '</span><strong>' + ctx.escapeHtml(String(summary.manualReview || 0)) + '</strong></div>',
      '<div><span>' + ctx.escapeHtml(ctx.t('previewObjectEditor.route', 'Editor route')) + '</span><strong>' + ctx.escapeHtml(route) + '</strong></div>'
    ].join('');
  }

  function previewObjectRouteLabel(model, deps) {
    const ctx = normalizeDeps(deps);
    const value = String(model && (model.template || model.objectKind || model.mode) || ctx.state.template || '').trim();
    if (value === 'news' || value === 'news_item' || value === 'new_news') {
      return ctx.t('objectPreview.news', 'News');
    }
    if (value === 'card' || value === 'new_card') {
      return ctx.t('objectPreview.card', 'Card');
    }
    if (value === 'surface' || value === 'surface_text' || value === 'text') {
      return ctx.t('objectPreview.textPatch', 'Text Patch');
    }
    return ctx.t('objectPreview.event', 'World Event');
  }

  function syncObjectCanvasFieldValues(deps) {
    const ctx = normalizeDeps(deps);
    if (!ctx.host) {
      return;
    }
    const active = ctx.document && ctx.document.activeElement;
    const values = ctx.state.values || {};
    ctx.host.querySelectorAll('[data-object-canvas-field]').forEach((input) => {
      const key = input.dataset && input.dataset.objectCanvasField;
      if (!key || !Object.prototype.hasOwnProperty.call(values, key) || isFocusedField(input, active)) {
        return;
      }
      const next = String(values[key] === undefined || values[key] === null ? '' : values[key]);
      if (input.type === 'checkbox') {
        input.checked = /^(1|true|yes|on)$/i.test(next);
        return;
      }
      if (input.value !== next) {
        input.value = next;
      }
    });
  }

  function isFocusedField(input, active) {
    if (input !== active) {
      return false;
    }
    const tag = String(input && input.tagName || '').toLowerCase();
    return !tag || tag === 'input' || tag === 'textarea' || tag === 'select';
  }

  function hasActivePreviewEditor(ctx) {
    return Boolean(ctx.host && ctx.model && ctx.state.active !== false && ctx.surface && ctx.editor);
  }

  function normalizeDeps(deps) {
    const ctx = deps || {};
    const state = ctx.state || {};
    const host = ctx.host || ctx.elements && ctx.elements.host || null;
    const rootGlobal = ctx.global || global;
    const model = ctx.model || state.model || null;
    const surface = ctx.surface || (typeof ctx.currentSurface === 'function' ? ctx.currentSurface(model) : ctx.currentSurface) || null;
    return {
      cssEscape: typeof ctx.cssEscape === 'function' ? ctx.cssEscape : fallbackCssEscape,
      document: ctx.document || rootGlobal.document || null,
      editor: ctx.previewObjectEditor || rootGlobal.ProjectMapPreviewObjectEditor || null,
      ensureArray: typeof ctx.ensureArray === 'function' ? ctx.ensureArray : fallbackEnsureArray,
      escapeHtml: typeof ctx.escapeHtml === 'function' ? ctx.escapeHtml : fallbackEscapeHtml,
      global: rootGlobal,
      headerTitle: ctx.headerTitle,
      host,
      model,
      state,
      surface,
      t: typeof ctx.t === 'function' ? ctx.t : fallbackTranslate,
      titleForModel: ctx.titleForModel,
      visibleTextRenderer: ctx.visibleTextRenderer || rootGlobal.ProjectMapVisibleTextRenderer || null
    };
  }

  function fallbackEnsureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function fallbackTranslate(_key, fallback) {
    return fallback;
  }

  function fallbackCssEscape(value) {
    return String(value || '').replace(/["\\\]]/g, '\\$&');
  }

  function fallbackEscapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  const api = {
    syncPreviewObjectEditorPane,
    syncPreviewObjectRenderedFields,
    previewObjectFieldMap,
    syncPreviewObjectEditorChrome,
    renderVisibleTextInline,
    renderPreviewObjectDraftSummary,
    previewObjectRouteLabel,
    syncObjectCanvasFieldValues
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.ProjectMapObjectCanvasPreviewEditorSync = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
