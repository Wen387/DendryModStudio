(function initProjectMapVisibleEditActionUi(global) {
  'use strict';

  const api = {
    renderButton,
    renderMarker,
    bind,
    open,
    actionForItem
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapVisibleEditActionUi = api;
  }

  function renderButton(action, options) {
    const value = normalizeAction(action);
    if (!value) {
      return '';
    }
    const opts = options || {};
    const text = opts.label || tr(opts, 'visibleEdit.action', 'Edit');
    const title = opts.title || tr(opts, value.installSafety === 'advanced_apply' ? 'visibleEdit.tooltipAdvanced' : 'visibleEdit.tooltip', value.installSafety === 'advanced_apply' ? 'Edit with advanced apply' : 'Edit this visible content');
    const classes = ['visible-edit-action-button', opts.compact ? 'is-compact' : '', value.installSafety === 'advanced_apply' ? 'is-advanced' : ''].filter(Boolean).join(' ');
    return '<button type="button" class="' + attr(opts, classes) + '" data-visible-edit-action="' + attr(opts, encodeAction(value)) + '" aria-label="' + attr(opts, tr(opts, 'visibleEdit.aria', 'Edit visible content')) + '" title="' + attr(opts, title) + '">' +
      esc(opts, text) +
      '</button>';
  }

  function renderMarker(options) {
    const opts = options || {};
    return '<span class="visible-edit-affordance" data-visible-edit-affordance="true" aria-label="' + attr(opts, tr(opts, 'visibleEdit.aria', 'Edit visible content')) + '">' + esc(opts, opts.label || tr(opts, 'visibleEdit.action', 'Edit')) + '</span>';
  }

  function bind(root, options) {
    const host = root || null;
    if (!host || !host.querySelectorAll) {
      return;
    }
    host.querySelectorAll('[data-visible-edit-action]').forEach((button) => {
      if (button.__dmsVisibleEditActionBound) {
        return;
      }
      button.__dmsVisibleEditActionBound = true;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const action = decodeAction(button.dataset.visibleEditAction || '');
        open(action, options && options.projectIndex);
      });
    });
  }

  function open(action, projectIndex) {
    const canvas = global && global.ProjectMapObjectAuthoringCanvas;
    if (!canvas || typeof canvas.openVisibleEditAction !== 'function') {
      return false;
    }
    return canvas.openVisibleEditAction(projectIndex || null, action);
  }

  function actionForItem(projectIndex, view, item, hints, options) {
    const coverage = global && global.ProjectMapVisibleObjectCoverage || coverageApi();
    if (!coverage || typeof coverage.buildVisibleEditAction !== 'function') {
      return null;
    }
    return coverage.buildVisibleEditAction(projectIndex, view, item, hints || {}, options || {});
  }

  function normalizeAction(action) {
    const value = action && action.editAction || action;
    if (!value || typeof value !== 'object' || !value.actionKind) {
      return null;
    }
    return value;
  }

  function encodeAction(action) {
    try {
      return JSON.stringify(action || {});
    } catch (_err) {
      return '{}';
    }
  }

  function decodeAction(value) {
    try {
      return JSON.parse(value || '{}');
    } catch (_err) {
      return {};
    }
  }

  function tr(deps, key, fallback) {
    return deps && typeof deps.translate === 'function' ? deps.translate(key, fallback) : t(key, fallback);
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function esc(deps, value) {
    return deps && typeof deps.escapeHtml === 'function' ? deps.escapeHtml(value) : fallbackEscape(value);
  }

  function attr(deps, value) {
    return deps && typeof deps.escapeAttr === 'function' ? deps.escapeAttr(value) : fallbackEscape(value);
  }

  function fallbackEscape(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function coverageApi() {
    if (typeof require === 'function') {
      try {
        return require('../authoring/visible_object_coverage_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
