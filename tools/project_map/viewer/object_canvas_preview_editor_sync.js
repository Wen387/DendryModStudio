(function initProjectMapObjectCanvasPreviewEditorSync(global) {
  'use strict';

  function syncPreviewObjectEditorPane(deps) {
    const ctx = normalizeDeps(deps);
    if (!hasActivePreviewEditor(ctx) || !ctx.editor || typeof ctx.editor.renderPreviewPane !== 'function') {
      return;
    }
    const renderPane = typeof ctx.editor.renderModalPreviewPane === 'function'
      ? ctx.editor.renderModalPreviewPane
      : ctx.editor.renderPreviewPane;
    const html = renderPane(ctx.model, {
      template: ctx.state.template,
      selectedKey: ctx.state.selectedCanvasNode,
      previewExpanded: ctx.state.objectEditorPreviewExpanded
    });
    ctx.host.querySelectorAll('[data-object-editing-modal-preview-pane]').forEach((node) => {
      // When the Preview/Play toggle is present (the desktop real-engine
      // play-test wraps the pane in a modes toolbar + a preview panel + a play
      // panel), replace ONLY the preview panel's content. A whole-pane innerHTML
      // rewrite here would wipe the toolbar and any in-progress play-test on the
      // first post-render sync -- which is exactly why the Play tab never showed.
      // With no toggle (plain browser / unsupported), keep the whole-pane replace.
      const previewPanel = node.querySelector('[data-preview-mode-panel="preview"]');
      if (previewPanel) {
        previewPanel.innerHTML = html;
      } else {
        node.innerHTML = html;
      }
    });
  }

  function syncPreviewObjectRenderedFields(deps) {
    const ctx = normalizeDeps(deps);
    if (!hasActivePreviewEditor(ctx) || !ctx.editor || typeof ctx.editor.renderTextBlocks !== 'function') {
      return;
    }
    const perf = perfApi(ctx);
    const limitKeys = ctx.changedFieldKeys instanceof Set && ctx.changedFieldKeys.size > 0
      ? ctx.changedFieldKeys
      : null;
    const run = () => {
      const fields = previewObjectFieldMap(ctx.model, ctx);
      // Build the key→input map ONCE before the loop. Calling
      // selectedCanvasFieldInput per node makes collectCanvasFieldEntries
      // read layout (getComputedStyle/getClientRects), which interleaves
      // with the node.innerHTML writes below and forces a fresh layout on
      // every iteration. On large events that is O(N) forced layouts on a
      // multi-MB DOM. When limitKeys is provided (typical blur sync of a
      // single changed field) we skip the full collection entirely and
      // resolve each input by direct querySelector — no layout flush.
      const inputByKey = collectCanvasInputsByKey(ctx, limitKeys);
      let nodes = ctx.host.querySelectorAll('[data-preview-object-rendered-for]');
      if (limitKeys) {
        nodes = Array.prototype.filter.call(nodes, (node) => {
          const key = node.dataset && node.dataset.previewObjectRenderedFor;
          return Boolean(key && limitKeys.has(key));
        });
      }
      nodes.forEach((node) => {
        const key = node.dataset && node.dataset.previewObjectRenderedFor;
        const input = key ? lookupCanvasInputForKey(inputByKey, ctx, key) : null;
        const field = key ? fields.get(key) : null;
        const value = input ? input.value : field && field.value !== undefined ? field.value : field && field.original || '';
        node.innerHTML = ctx.editor.renderTextBlocks(value, {empty: false});
      });
      return nodes.length;
    };
    if (perf && typeof perf.measure === 'function') {
      perf.measure('syncPreviewObjectRenderedFields', run, {
        scope: limitKeys ? 'targeted' : 'all',
        keyCount: limitKeys ? limitKeys.size : 0
      });
    } else {
      run();
    }
  }

  function updateRenderedPreviewForField(deps, input) {
    // Microsecond-level single-field preview update used by the live-typing
    // path. Caller already has the focused input from event.target, so we
    // skip the layout-forcing collectCanvasFieldEntries walk and the model
    // rebuild entirely. Render the value once and write to all rendered-for
    // nodes that match the key.
    if (!input || !input.dataset) {
      return;
    }
    const key = input.dataset.objectCanvasField;
    if (!key) {
      return;
    }
    const ctx = normalizeDeps(deps);
    if (!hasActivePreviewEditor(ctx) || !ctx.editor || typeof ctx.editor.renderTextBlocks !== 'function') {
      return;
    }
    const value = input.value !== undefined && input.value !== null ? String(input.value) : '';
    const html = ctx.editor.renderTextBlocks(value, {empty: false});
    const selector = '[data-preview-object-rendered-for="' + ctx.cssEscape(key) + '"]';
    ctx.host.querySelectorAll(selector).forEach((node) => {
      node.innerHTML = html;
    });
  }

  function collectCanvasInputsByKey(ctx, limitKeys) {
    if (limitKeys instanceof Set && limitKeys.size > 0) {
      // Targeted path: one direct querySelector per key, no global walk
      // and no layout-forcing visibility checks.
      const map = new Map();
      limitKeys.forEach((key) => {
        const input = ctx.host.querySelector('[data-object-canvas-field="' + ctx.cssEscape(key) + '"]');
        if (input) {
          map.set(key, input);
        }
      });
      return map;
    }
    const fieldValues = ctx.global && ctx.global.ProjectMapObjectCanvasFieldValues;
    if (!fieldValues || typeof fieldValues.collectCanvasFieldEntries !== 'function') {
      return null;
    }
    const entries = fieldValues.collectCanvasFieldEntries(ctx.host, {
      activeElement: ctx.document && ctx.document.activeElement
    });
    const map = new Map();
    entries.forEach((input) => {
      const key = input && input.dataset && input.dataset.objectCanvasField;
      if (key && !map.has(key)) {
        map.set(key, input);
      }
    });
    return map;
  }

  function lookupCanvasInputForKey(inputByKey, ctx, key) {
    if (inputByKey && inputByKey.has(key)) {
      return inputByKey.get(key);
    }
    return ctx.host.querySelector('[data-object-canvas-field="' + ctx.cssEscape(key) + '"]');
  }

  function selectedCanvasFieldInput(ctx, key) {
    const inputByKey = collectCanvasInputsByKey(ctx);
    return lookupCanvasInputForKey(inputByKey, ctx, key);
  }

  function perfApi(ctx) {
    const rootGlobal = ctx && ctx.global;
    if (rootGlobal && rootGlobal.ProjectMapCardBoardPerf) {
      return rootGlobal.ProjectMapCardBoardPerf;
    }
    try {
      return require('./card_board_perf.js');
    } catch (_err) {
      return null;
    }
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
            node.textContent = displayCompactLabel(title);
            node.setAttribute('title', title);
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

  function displayCompactLabel(value) {
    const raw = String(value || '');
    const display = compactDendryInlineLabel(raw) || raw.trim();
    return display || raw;
  }

  function compactDendryInlineLabel(value) {
    const raw = String(value || '');
    if (!raw) {
      return '';
    }
    const conditionalPattern = /\[\?\s*if\s+[^:]+:\s*([\s\S]*?)\?\]/g;
    const matches = [];
    let match;
    while ((match = conditionalPattern.exec(raw)) !== null) {
      matches.push({index: match.index, text: cleanDisplayLabel(match[1]), raw: match[0]});
    }
    if (!matches.length) {
      return cleanDisplayLabel(raw);
    }
    const first = matches[0];
    const last = matches[matches.length - 1];
    const before = raw.slice(0, first.index);
    const after = raw.slice(last.index + last.raw.length);
    const onlyAdjacentConditionals = !cleanDisplayLabel(before) && matches.every((item, index) => {
      if (index === 0) {
        return true;
      }
      const previous = matches[index - 1];
      return !cleanDisplayLabel(raw.slice(previous.index + previous.raw.length, item.index));
    });
    const unique = uniqueNonEmpty(matches.map((item) => item.text));
    if (onlyAdjacentConditionals && unique.length > 1) {
      return cleanDisplayLabel([unique.join(' / '), after].filter(Boolean).join(' '));
    }
    return cleanDisplayLabel(raw.replace(conditionalPattern, (_token, body) => ' ' + cleanDisplayLabel(body) + ' '));
  }

  function cleanDisplayLabel(value) {
    return String(value || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\*\*/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function uniqueNonEmpty(values) {
    const seen = new Set();
    const result = [];
    (Array.isArray(values) ? values : []).forEach((value) => {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      result.push(text);
    });
    return result;
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

  function syncObjectCanvasAssetActionState(deps) {
    const ctx = normalizeDeps(deps);
    if (!ctx.host) {
      return;
    }
    const values = ctx.state.values || {};
    ctx.host.querySelectorAll('[data-object-canvas-action="remove_asset_reference"][data-existing-asset-field]').forEach((button) => {
      const fieldId = String(button && button.dataset && button.dataset.existingAssetField || '').trim();
      if (!fieldId) {
        return;
      }
      const pendingRemoval = Object.prototype.hasOwnProperty.call(values, fieldId) && !String(values[fieldId] == null ? '' : values[fieldId]).trim();
      const label = pendingRemoval
        ? ctx.t('assets.restoreReference', 'Undo removal')
        : ctx.t('assets.removeReference', 'Remove reference');
      if (button.textContent !== label) {
        button.textContent = label;
      }
      if (button.dataset) {
        button.dataset.assetRemovalState = pendingRemoval ? 'pending' : 'idle';
      }
      if (typeof button.setAttribute === 'function') {
        button.setAttribute('aria-pressed', pendingRemoval ? 'true' : 'false');
      }
      if (button.classList && typeof button.classList.toggle === 'function') {
        button.classList.toggle('is-pending-removal', pendingRemoval);
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
      changedFieldKeys: ctx.changedFieldKeys instanceof Set ? ctx.changedFieldKeys : null,
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
    updateRenderedPreviewForField,
    previewObjectFieldMap,
    selectedCanvasFieldInput,
    syncPreviewObjectEditorChrome,
    renderVisibleTextInline,
    renderPreviewObjectDraftSummary,
    previewObjectRouteLabel,
    syncObjectCanvasFieldValues,
    syncObjectCanvasAssetActionState
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.ProjectMapObjectCanvasPreviewEditorSync = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
