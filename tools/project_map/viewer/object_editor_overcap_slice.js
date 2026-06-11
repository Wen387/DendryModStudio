(function initProjectMapObjectEditorOvercapSlice(global) {
  'use strict';

  // Over-cap magic `{! … !}` blocks: the index intentionally carries anchors
  // only (no rawText) for blocks beyond the 2000-char/40-line edit bound, so
  // the object editor showed them read-only with an IDE hint — no in-Studio
  // path at all. This sibling gives every anchored read-only block a Source
  // Slice entry that loads the CURRENT block text from disk through the
  // desktop bridge (dendryDesktop.readSourceSlice) before opening the editor.
  //
  // The excerpt-trap firewall from the deferred-slice work applies doubly
  // here: a replace_section apply writes the edited text over the whole span,
  // and for these blocks the model holds NO text — only the freshly read disk
  // text may seed the editor. The entry therefore refuses to open when the
  // bridge is missing, the read fails, or the read-back first/last lines no
  // longer match the indexed anchors (stale index ⇒ rescan first). The read
  // also returns a sha256 rangeHash that rides along as expectedRangeHash, so
  // the eventual apply fails closed if the file changes after the read.
  //
  // Clicks dispatch through ProjectMapObjectAuthoringCanvas.openVisibleEditAction
  // (public canvas API); the listener self-registers once per document.

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const escapeAttr = domTextUtils.escapeAttr;
  const escapeHtml = domTextUtils.escapeHtml;

  function usableSpan(source) {
    if (!source || typeof source !== 'object') {
      return false;
    }
    const start = Number(source.startLine || source.line);
    const end = Number(source.endLine);
    return Boolean(String(source.path || '').trim()) &&
      Number.isFinite(start) && start >= 1 &&
      Number.isFinite(end) && end >= start &&
      Boolean(String(source.anchorText || '').trim()) &&
      Boolean(String(source.endAnchorText || '').trim());
  }

  function isOvercapCandidate(block) {
    return Boolean(block && typeof block === 'object' && !block.editable && usableSpan(block.source));
  }

  function overcapDescriptor(block, ctx) {
    if (!isOvercapCandidate(block)) {
      return null;
    }
    const source = block.source;
    return {
      targetId: String(ctx && ctx.targetId || block.id || ''),
      fieldId: 'opaque:' + String(block.id || ''),
      label: String(block.label || ((block.hook || 'script') + ' JS block')),
      source: {
        path: String(source.path),
        line: Number(source.startLine || source.line),
        startLine: Number(source.startLine || source.line),
        endLine: Number(source.endLine),
        anchorText: String(source.anchorText || ''),
        endAnchorText: String(source.endAnchorText || ''),
        rawAnchorText: String(source.rawAnchorText || ''),
        rawEndAnchorText: String(source.rawEndAnchorText || '')
      }
    };
  }

  // Pure freshness gate: the read-back first/last lines must still match the
  // indexed anchors (raw lines when the index recorded them, trimmed text
  // otherwise). A mismatch means the index is stale — opening would seed the
  // editor with text the anchors no longer describe.
  function freshnessOk(descriptor, readResult) {
    if (!descriptor || !readResult || readResult.ok !== true) {
      return false;
    }
    const text = String(readResult.text || '');
    if (!text) {
      return false;
    }
    const lines = text.split('\n');
    const first = lines[0];
    const last = lines[lines.length - 1];
    const source = descriptor.source || {};
    const firstOk = source.rawAnchorText
      ? first === source.rawAnchorText
      : first.trim() === String(source.anchorText || '').trim();
    const lastOk = source.rawEndAnchorText
      ? last === source.rawEndAnchorText
      : last.trim() === String(source.endAnchorText || '').trim();
    return firstOk && lastOk;
  }

  function buildOvercapAction(descriptor, readResult) {
    if (!freshnessOk(descriptor, readResult)) {
      return null;
    }
    return {
      schemaVersion: '0.1',
      kind: 'visible_edit_action',
      actionKind: 'open_source_slice',
      routeClass: 'source_slice_editor',
      targetView: 'source_slice',
      targetId: String(descriptor.targetId || ''),
      fieldId: String(descriptor.fieldId || ''),
      label: String(descriptor.label || ''),
      source: Object.assign({}, descriptor.source, {
        expectedRangeHash: String(readResult.rangeHash || '')
      }),
      operationTemplate: {
        type: 'replace_section',
        search: String(readResult.text)
      },
      visibleContent: true
    };
  }

  function renderOvercapEntry(block, ctx) {
    const descriptor = overcapDescriptor(block, ctx);
    if (!descriptor) {
      return '';
    }
    const label = t('sourceSlice.overcapOpen', 'Edit the full block (precise source edit)');
    return '<div class="preview-object-overcap-entry">' +
      '<button type="button" class="preview-object-overcap-slice" data-object-overcap-slice="' +
      escapeAttr(JSON.stringify(descriptor)) + '" title="' + escapeAttr(label) + '">' +
      escapeHtml(label) + '</button>' +
      '<span class="preview-object-overcap-note" data-object-overcap-note="true" hidden></span>' +
      '</div>';
  }

  // ---- live behaviour (browser only; self-registered, no canvas_ui edit) ----

  function noteElementFor(button) {
    const wrap = button && typeof button.closest === 'function'
      ? button.closest('.preview-object-overcap-entry')
      : null;
    return wrap ? wrap.querySelector('[data-object-overcap-note]') : null;
  }

  function showNote(button, message) {
    const note = noteElementFor(button);
    if (note) {
      note.textContent = String(message || '');
      note.hidden = !message;
    }
  }

  function onEntryClick(event) {
    const target = event && event.target;
    const button = target && typeof target.closest === 'function'
      ? target.closest('[data-object-overcap-slice]')
      : null;
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    let descriptor = null;
    try {
      descriptor = JSON.parse(button.getAttribute('data-object-overcap-slice') || '');
    } catch (_err) {
      descriptor = null;
    }
    if (!descriptor || !descriptor.source) {
      return;
    }
    const bridge = global && global.dendryDesktop;
    if (!bridge || typeof bridge.readSourceSlice !== 'function') {
      showNote(button, t('sourceSlice.overcapDesktopOnly', 'Desktop Studio is required to load this block for editing.'));
      return;
    }
    const canvas = global && global.ProjectMapObjectAuthoringCanvas;
    if (!canvas || typeof canvas.openVisibleEditAction !== 'function') {
      return;
    }
    button.disabled = true;
    showNote(button, t('sourceSlice.overcapLoading', 'Loading the current source block…'));
    Promise.resolve(bridge.readSourceSlice({
      path: descriptor.source.path,
      startLine: descriptor.source.startLine,
      endLine: descriptor.source.endLine
    })).then((result) => {
      button.disabled = false;
      if (!result || result.ok !== true) {
        showNote(button, t('sourceSlice.overcapReadFailed', 'Could not read the source block.') +
          (result && result.message ? ' ' + result.message : ''));
        return;
      }
      const action = buildOvercapAction(descriptor, result);
      if (!action) {
        showNote(button, t('sourceSlice.overcapStale', 'The source file changed since the last scan. Rescan the project, then try again.'));
        return;
      }
      showNote(button, '');
      canvas.openVisibleEditAction(null, action);
    }).catch((err) => {
      button.disabled = false;
      showNote(button, t('sourceSlice.overcapReadFailed', 'Could not read the source block.') +
        (err && err.message ? ' ' + err.message : ''));
    });
  }

  function ensureWired(host) {
    if (!host || !host.document || host.__objectEditorOvercapSliceWired) {
      return;
    }
    host.__objectEditorOvercapSliceWired = true;
    host.document.addEventListener('click', onEntryClick, true);
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  ensureWired(global);

  const api = {
    isOvercapCandidate,
    overcapDescriptor,
    freshnessOk,
    buildOvercapAction,
    renderOvercapEntry
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectEditorOvercapSlice = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
