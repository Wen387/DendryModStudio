(function initProjectMapObjectEditorFind(global) {
  'use strict';

  // Object editor "find" toolbar. A real mod event renders a long fields pane in
  // the object editor modal (preview_object_editor renderModal) -- prose, choices,
  // branches, conditional ladders, assets, magic blocks, review details. Beyond a
  // modest size the only way to reach a specific field is scrolling. This sibling
  // adds a pane-level filter + collapse-all / expand-all to that pane. It is a pure
  // DOM show/hide overlay (no model mutation, no source edit) that mirrors the
  // existing per-layer conditional filter (object_authoring_canvas_ui applyConditionalFilter).
  // Kept off-budget here so the maxed aggregate ceiling is not disturbed; the modal
  // wires it with a single renderFindToolbar() call.

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const ensureArray = domTextUtils.ensureArray;
  const escapeAttr = domTextUtils.escapeAttr;
  const escapeHtml = domTextUtils.escapeHtml;

  // Below this many model field-groups the pane is short enough that a filter bar
  // is just noise (same threshold philosophy as the conditional filter toolbar).
  const FIND_THRESHOLD = 12;
  const ROW_SELECTOR = '.preview-object-field, .preview-object-magic-block';
  const GROUP_SELECTOR = 'details, .preview-object-semantic-section';
  const PANE_SELECTOR = '[data-preview-object-editor]';

  function fieldUnitCount(body) {
    const value = body && typeof body === 'object' ? body : {};
    return ensureArray(value.sections).length +
      ensureArray(value.options).length +
      ensureArray(value.branchSections).length +
      ensureArray(value.assets).length +
      ensureArray(value.opaqueJsBlocks).length;
  }

  // Render the toolbar markup for the fields pane. Returns '' for small events.
  function renderFindToolbar(body) {
    if (fieldUnitCount(body) < FIND_THRESHOLD) {
      return '';
    }
    const placeholder = t('explore.searchPlaceholder', 'Filter current view');
    const collapseLabel = t('storyboard.collapse', 'Collapse');
    const expandLabel = t('storyboard.palette.expandChromeShort', 'Expand');
    return [
      '<div class="object-editor-find" data-object-editor-find="true">',
      '<input type="search" class="object-editor-find-input" data-object-editor-find-input="true" placeholder="' + escapeAttr(placeholder) + '" aria-label="' + escapeAttr(placeholder) + '" autocomplete="off" spellcheck="false">',
      '<div class="object-editor-find-actions">',
      '<button type="button" class="object-editor-find-collapse" data-object-editor-find-collapse="true" title="' + escapeAttr(collapseLabel) + '">' + escapeHtml(collapseLabel) + '</button>',
      '<button type="button" class="object-editor-find-expand" data-object-editor-find-expand="true" title="' + escapeAttr(expandLabel) + '">' + escapeHtml(expandLabel) + '</button>',
      '</div>',
      '<span class="object-editor-find-count" data-object-editor-find-count="true" aria-live="polite"></span>',
      '</div>'
    ].join('');
  }

  // ---- live behaviour (browser only; self-registered, no canvas_ui edit) ----

  function findPane(node) {
    return node && typeof node.closest === 'function' ? node.closest(PANE_SELECTOR) : null;
  }

  function forceOpenAncestors(row, pane) {
    let el = row.parentElement;
    while (el && el !== pane) {
      if (el.tagName === 'DETAILS') {
        el.open = true;
      }
      el = el.parentElement;
    }
  }

  function applyFilter(toolbar) {
    const pane = findPane(toolbar);
    if (!pane) {
      return;
    }
    const input = toolbar.querySelector('[data-object-editor-find-input]');
    const query = String(input && input.value || '').trim().toLowerCase();
    const rows = pane.querySelectorAll(ROW_SELECTOR);
    let shown = 0;
    rows.forEach((row) => {
      const match = !query || (row.textContent || '').toLowerCase().indexOf(query) !== -1;
      row.classList.toggle('is-find-hidden', !match);
      if (match) {
        shown += 1;
        if (query) {
          forceOpenAncestors(row, pane);
        }
      }
    });
    // Hide a whole group only when every editable row inside it is filtered out,
    // so the matching rows are never buried under an empty section heading.
    pane.querySelectorAll(GROUP_SELECTOR).forEach((group) => {
      if (group.closest('[data-object-editor-find]')) {
        return;
      }
      const groupRows = group.querySelectorAll(ROW_SELECTOR);
      if (!groupRows.length) {
        return;
      }
      let anyVisible = false;
      groupRows.forEach((row) => {
        if (!row.classList.contains('is-find-hidden')) {
          anyVisible = true;
        }
      });
      group.classList.toggle('is-find-hidden', Boolean(query) && !anyVisible);
    });
    const count = toolbar.querySelector('[data-object-editor-find-count]');
    if (count) {
      count.textContent = query ? formatCount(shown, rows.length) : '';
    }
  }

  function toggleAll(toolbar, open) {
    const pane = findPane(toolbar);
    if (!pane) {
      return;
    }
    pane.querySelectorAll('details').forEach((details) => {
      if (details.closest('[data-object-editor-find]')) {
        return;
      }
      details.open = open;
    });
  }

  function onFindInput(event) {
    const target = event && event.target;
    const input = target && typeof target.closest === 'function' ? target.closest('[data-object-editor-find-input]') : null;
    if (!input) {
      return;
    }
    const toolbar = input.closest('[data-object-editor-find]');
    if (toolbar) {
      applyFilter(toolbar);
    }
  }

  function onFindClick(event) {
    const target = event && event.target;
    const button = target && typeof target.closest === 'function'
      ? target.closest('[data-object-editor-find-collapse], [data-object-editor-find-expand]')
      : null;
    if (!button) {
      return;
    }
    const toolbar = button.closest('[data-object-editor-find]');
    if (!toolbar) {
      return;
    }
    toggleAll(toolbar, button.matches('[data-object-editor-find-expand]'));
  }

  function ensureWired(host) {
    if (!host || !host.document || host.__objectEditorFindWired) {
      return;
    }
    host.__objectEditorFindWired = true;
    host.document.addEventListener('input', onFindInput, true);
    host.document.addEventListener('click', onFindClick, true);
  }

  function formatCount(shown, total) {
    return t('previewObjectEditor.filterCount', 'Showing {shown} of {total}')
      .replace('{shown}', String(shown))
      .replace('{total}', String(total));
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  ensureWired(global);

  const api = {renderFindToolbar, FIND_THRESHOLD};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectEditorFind = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
