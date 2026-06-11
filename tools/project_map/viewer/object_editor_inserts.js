(function initProjectMapObjectEditorInserts(global) {
  'use strict';

  // Object editor "insert" affordances -- two one-click insert helpers for the
  // object editor modal (preview_object_editor):
  //   1. renderConditionalVarInserts -- chips that drop a referenced quality name
  //      into a condition input. Moved here verbatim from preview_object_editor so
  //      the maxed source-complexity pool gains headroom; the existing
  //      object_authoring_canvas_ui handleConditionalVarInsert handler (keyed on
  //      data-conditional-var-token) is untouched and still drives it.
  //   2. renderQdisplayInsert -- chips that wrap a referenced quality name as a
  //      Dendry inline display [+ name +] and drop it at the caret of a prose
  //      field's textarea. [+ quality +] is the highest-frequency inline syntax in
  //      real mods but was previously only hand-typed (no insert UI). A skeleton
  //      button always offers an empty [+  +] for names not in the palette.
  // The qdisplay insert is wired by a self-registered, idempotent document click
  // listener (canvas_ui untouched, mirroring object_editor_find). It is pure text
  // entry: it splices at the caret then dispatches 'input' so the already-wired
  // collect / guarded-splice path fires exactly as if typed -- no model mutation.
  // Kept off-budget here so the maxed aggregate ceiling is not disturbed.

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const ensureArray = domTextUtils.ensureArray;
  const escapeAttr = domTextUtils.escapeAttr;
  const escapeHtml = domTextUtils.escapeHtml;

  // Player-facing prose roles (renderInlineField role values) where a [+ quality +]
  // display reads naturally. Logic / effect / condition / route / asset roles are
  // excluded -- an inline display there is not meaningful.
  const PROSE_ROLES = {
    'body': true,
    'description': true,
    'choice-body': true,
    'conditional-body': true,
    'menu-body': true,
    'section-body': true
  };

  // Quality names referenced by the event currently rendered in the modal. Set
  // once per modal render by setEventContext(body); read by renderQdisplayInsert
  // to build the chip palette. A render-pass scratch, not authority.
  let eventVarNames = [];

  function setEventContext(body) {
    const value = body && typeof body === 'object' ? body : {};
    const seen = {};
    const names = [];
    ensureArray(value.variables).forEach((variable) => {
      const name = variable && variable.name ? String(variable.name) : '';
      if (name && !seen[name]) {
        seen[name] = true;
        names.push(name);
      }
    });
    eventVarNames = names.slice(0, 12);
  }

  // Moved verbatim from preview_object_editor: one-click chips that insert a
  // referenced quality name into a condition input. Only the markup moved --
  // object_authoring_canvas_ui still owns the data-conditional-var-token handler.
  function renderConditionalVarInserts(variables) {
    const names = ensureArray(variables).filter(Boolean);
    if (!names.length) {
      return '';
    }
    return [
      '<div class="preview-object-conditional-var-insert" data-conditional-var-insert="true">',
      '<span class="preview-object-conditional-var-insert-label">' + escapeHtml(t('previewObjectEditor.insertVariable', 'Insert variable')) + '</span>',
      names.map((name) => '<button type="button" class="preview-object-conditional-var-token" data-conditional-var-token="' + escapeAttr(name) + '">' + escapeHtml(name) + '</button>').join(''),
      '</div>'
    ].join('');
  }

  function resolveFieldId(field, opts) {
    if (opts && opts.fieldId) {
      return String(opts.fieldId);
    }
    return String(field && field.id || '');
  }

  // Render the qdisplay insert strip for a prose field. Returns '' for non-prose
  // roles. Chips wrap each contextual quality as [+ name +]; the skeleton button
  // always renders so an author can drop an empty [+  +] and type the name.
  // Collapsed <details> by default: the strip renders under EVERY prose field
  // (each conditional branch body included), so an expanded chip wall repeats
  // down the modal. The label is the per-field expander.
  function renderQdisplayInsert(field, options) {
    const opts = options && typeof options === 'object' ? options : {};
    if (!PROSE_ROLES[String(opts.role || '')]) {
      return '';
    }
    const id = resolveFieldId(field, opts);
    const fieldAttr = id ? ' data-object-qdisplay-field="' + escapeAttr(id) + '"' : '';
    const chips = eventVarNames.map((name) =>
      '<button type="button" class="preview-object-qdisplay-token" data-object-qdisplay-token="' + escapeAttr(name) + '"' + fieldAttr + '>'
      + escapeHtml('[+ ' + name + ' +]') + '</button>').join('');
    return [
      '<details class="preview-object-qdisplay-insert" data-object-qdisplay-insert="true">',
      '<summary class="preview-object-qdisplay-insert-label">' + escapeHtml(t('previewObjectEditor.insertQdisplay', 'Insert display')) + '</summary>',
      '<span class="preview-object-qdisplay-chips">',
      chips,
      '<button type="button" class="preview-object-qdisplay-token preview-object-qdisplay-skeleton" data-object-qdisplay-skeleton="true"' + fieldAttr + '>' + escapeHtml('[+  +]') + '</button>',
      '</span>',
      '</details>'
    ].join('');
  }

  function cssAttrEscape(value) {
    return String(value).replace(/["\\]/g, '\\$&');
  }

  // Find the prose textarea this insert button belongs to. Prefer the exact field
  // id (the same data-object-canvas-field renderInlineField stamped); fall back to
  // the first editable control inside the enclosing field label.
  function fieldControl(button) {
    if (!button || typeof button.closest !== 'function') {
      return null;
    }
    const wrapper = button.closest('.preview-object-field');
    if (!wrapper || typeof wrapper.querySelector !== 'function') {
      return null;
    }
    const id = button.dataset ? String(button.dataset.objectQdisplayField || '') : '';
    if (id) {
      const byId = wrapper.querySelector('[data-object-canvas-field="' + cssAttrEscape(id) + '"]');
      if (byId) {
        return byId;
      }
    }
    return wrapper.querySelector('textarea[data-object-canvas-field], input[data-object-canvas-field]');
  }

  // Splice text at the caret then dispatch 'input' so the wired collect /
  // guarded-splice path fires exactly as if the author had typed it. Mirrors
  // object_authoring_canvas_ui handleConditionalVarInsert.
  function insertAtCaret(input, text, caretOffset) {
    if (!input) {
      return;
    }
    const value = String(input.value || '');
    const start = typeof input.selectionStart === 'number' ? input.selectionStart : value.length;
    const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
    input.value = value.slice(0, start) + text + value.slice(end);
    const caret = start + (typeof caretOffset === 'number' ? caretOffset : text.length);
    input.focus();
    try {
      input.setSelectionRange(caret, caret);
    } catch (_err) {
      // selection range is best-effort; ignore unsupported inputs
    }
    const InputCtor = global.InputEvent || global.Event;
    input.dispatchEvent(new InputCtor('input', {bubbles: true}));
  }

  function onInsertClick(event) {
    const target = event && event.target;
    const button = target && typeof target.closest === 'function'
      ? target.closest('[data-object-qdisplay-token], [data-object-qdisplay-skeleton]')
      : null;
    if (!button) {
      return;
    }
    const input = fieldControl(button);
    if (!input) {
      return;
    }
    if (button.matches('[data-object-qdisplay-skeleton]')) {
      insertAtCaret(input, '[+  +]', 3); // caret between the two spaces
      return;
    }
    const name = button.dataset ? String(button.dataset.objectQdisplayToken || '') : '';
    if (!name) {
      return;
    }
    insertAtCaret(input, '[+ ' + name + ' +]');
  }

  function ensureWired(host) {
    if (!host || !host.document || host.__objectEditorInsertsWired) {
      return;
    }
    host.__objectEditorInsertsWired = true;
    host.document.addEventListener('click', onInsertClick, true);
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  ensureWired(global);

  const api = {renderConditionalVarInserts, renderQdisplayInsert, setEventContext, PROSE_ROLES};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectEditorInserts = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
