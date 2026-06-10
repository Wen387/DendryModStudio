(function initProjectMapObjectEditorDeferredSlice(global) {
  'use strict';

  // Large-event render diet: beyond the choice/branch limits the object editor
  // modal collapses the remaining rows into a read-only digest, which left those
  // sections with no edit entry at all (election-scale events). This sibling
  // gives every digest row a Source Slice entry built from the row's own source
  // anchor, and lists ALL deferred rows instead of the first ten — a digest row
  // without an entry is a dead end, and a hidden row is a silent one.
  //
  // The entry button encodes a complete open_source_slice visible-edit action.
  // currentText for the slice editor MUST be the row's full text (field.value),
  // never the source anchor excerpt: a replace_section apply writes the edited
  // text over the whole line span, so seeding the editor with an excerpt would
  // silently drop the tail of the section. operationTemplate.search carries the
  // full text for exactly this reason.
  //
  // Clicks dispatch through ProjectMapObjectAuthoringCanvas.openVisibleEditAction
  // (a public canvas API), so object_authoring_canvas_ui needs no new wiring;
  // the listener self-registers once per document, like object_editor_find.js.

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const ensureArray = domTextUtils.ensureArray;
  const escapeAttr = domTextUtils.escapeAttr;
  const escapeHtml = domTextUtils.escapeHtml;

  function usableSource(source) {
    return Boolean(source && typeof source === 'object' && String(source.path || '').trim());
  }

  function sliceAction(row, source, operationType, fullText, ctx) {
    if (!usableSource(source) || !String(fullText || '')) {
      return null;
    }
    return {
      schemaVersion: '0.1',
      kind: 'visible_edit_action',
      actionKind: 'open_source_slice',
      routeClass: 'source_slice_editor',
      targetView: 'source_slice',
      targetId: String(ctx && ctx.targetId || row && (row.sectionId || row.id) || ''),
      fieldId: String(row && (row.fieldId || row.id) || ''),
      label: String(row && row.label || ''),
      source: source,
      operationTemplate: {
        type: String(operationType || 'replace_section'),
        search: String(fullText)
      },
      visibleContent: true
    };
  }

  // Deferred branch fields carry their full section text on `value` and a
  // line-span source anchor; the slice editor can take them as-is.
  function branchSliceAction(field, ctx) {
    if (!field || typeof field !== 'object') {
      return null;
    }
    return sliceAction(field, field.source, field.operationType, field.value, ctx);
  }

  // Deferred option rows anchor their `target.source` to the whole section span
  // while only the section heading would seed the editor — the excerpt trap.
  // Their `fields` list still carries the option's own label field with a
  // single-line anchor and full value, so the entry edits that line surgically.
  function choiceSliceAction(option, ctx) {
    const fields = ensureArray(option && option.fields);
    const label = String(option && option.label || '');
    const exact = fields.find((field) => field && String(field.role || '') === 'option_label' &&
      usableSource(field.source) && String(field.value || '') && String(field.value) === label);
    const labelField = exact || fields.find((field) => field && String(field.role || '') === 'option_label' &&
      usableSource(field.source) && String(field.value || ''));
    if (!labelField) {
      return null;
    }
    return sliceAction({
      fieldId: labelField.fieldId || labelField.id,
      sectionId: option && option.sectionId,
      id: option && option.id,
      label: label || String(labelField.value)
    }, labelField.source, labelField.operationType || 'replace_text', labelField.value, ctx);
  }

  function renderEntryButton(action) {
    if (!action) {
      return '';
    }
    const label = t('sourceSlice.title', 'Precise source edit');
    return '<button type="button" class="preview-object-deferred-slice" data-object-deferred-slice-action="' +
      escapeAttr(JSON.stringify(action)) + '" title="' + escapeAttr(label) + '">' + escapeHtml(label) + '</button>';
  }

  function appendEntry(articleHtml, action) {
    const html = String(articleHtml || '');
    const button = renderEntryButton(action);
    if (!button) {
      return html;
    }
    const closing = html.lastIndexOf('</article>');
    if (closing === -1) {
      return html + button;
    }
    return html.slice(0, closing) + button + html.slice(closing);
  }

  function renderDeferredBranchList(rows, ctx) {
    const renderRow = ctx && typeof ctx.renderRow === 'function' ? ctx.renderRow : () => '';
    return ensureArray(rows).map((field, index) => {
      return appendEntry(renderRow(field, index), branchSliceAction(field, ctx));
    }).join('');
  }

  function renderDeferredChoiceList(rows, ctx) {
    const renderRow = ctx && typeof ctx.renderRow === 'function' ? ctx.renderRow : () => '';
    const offset = ctx && Number.isFinite(ctx.offset) ? ctx.offset : 0;
    return ensureArray(rows).map((option, index) => {
      return appendEntry(renderRow(option, offset + index), choiceSliceAction(option, ctx));
    }).join('');
  }

  // ---- live behaviour (browser only; self-registered, no canvas_ui edit) ----

  function onEntryClick(event) {
    const target = event && event.target;
    const button = target && typeof target.closest === 'function'
      ? target.closest('[data-object-deferred-slice-action]')
      : null;
    if (!button) {
      return;
    }
    const canvas = global && global.ProjectMapObjectAuthoringCanvas;
    if (!canvas || typeof canvas.openVisibleEditAction !== 'function') {
      return;
    }
    let action = null;
    try {
      action = JSON.parse(button.getAttribute('data-object-deferred-slice-action') || '');
    } catch (_err) {
      action = null;
    }
    if (!action || !action.actionKind) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    canvas.openVisibleEditAction(null, action);
  }

  function ensureWired(host) {
    if (!host || !host.document || host.__objectEditorDeferredSliceWired) {
      return;
    }
    host.__objectEditorDeferredSliceWired = true;
    host.document.addEventListener('click', onEntryClick, true);
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  ensureWired(global);

  const api = {
    renderDeferredBranchList,
    renderDeferredChoiceList,
    branchSliceAction,
    choiceSliceAction
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectEditorDeferredSlice = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
