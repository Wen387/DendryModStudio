(function initProjectMapVisibleEditActionUi(global) {
  'use strict';

  const api = {
    renderButton,
    renderMarker,
    renderContextLens,
    bind,
    bindContextLens,
    open,
    actionForItem
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapVisibleEditActionUi = api;
  }

  let contextLensGlobalListenersBound = false;

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

  function renderContextLens(lens, options) {
    const opts = options || {};
    const value = lens && typeof lens === 'object' ? lens : null;
    const rows = Array.isArray(value && value.rows) ? value.rows.filter((row) => row && row.label && row.value) : [];
    if (!value || !rows.length) {
      return '';
    }
    return [
      '<span class="authoring-context-lens" data-authoring-context-lens="true" data-context-lens-kind="' + attr(opts, value.subjectKind || 'entry') + '" data-context-lens-evidence="' + attr(opts, value.evidenceState || 'unknown') + '" data-context-lens-pinned="false" data-context-lens-payload="' + attr(opts, encodeAction(value)) + '" role="button" tabindex="0" aria-expanded="false" aria-label="' + attr(opts, tr(opts, 'contextLens.openAria', 'Show authoring context') + ': ' + (value.meaning || value.subjectKind || '')) + '">',
      '<span class="authoring-context-lens-dot" aria-hidden="true">i</span>',
      '<span class="authoring-context-lens-popover" role="tooltip">',
      '<strong>' + esc(opts, value.meaning || tr(opts, 'contextLens.title', 'Authoring context')) + '</strong>',
      '<dl>',
      rows.map((row) => '<div><dt>' + esc(opts, row.label) + '</dt><dd>' + esc(opts, row.value) + '</dd></div>').join(''),
      '</dl>',
      '</span>',
      '</span>'
    ].join('');
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
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const action = decodeAction(button.dataset.visibleEditAction || '');
        open(action, options && options.projectIndex);
      });
    });
    bindContextLens(host, options);
  }

  function bindContextLens(root, _options) {
    const host = root || null;
    if (!host || !host.querySelectorAll) {
      return;
    }
    bindContextLensGlobalListeners();
    host.querySelectorAll('[data-authoring-context-lens]').forEach((marker) => {
      if (marker.__dmsAuthoringContextLensBound) {
        return;
      }
      marker.__dmsAuthoringContextLensBound = true;
      marker.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleLens(marker);
      });
      marker.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setLensPinned(marker, false);
          return;
        }
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        toggleLens(marker);
      });
      marker.addEventListener('mouseenter', () => setExpanded(marker, true));
      marker.addEventListener('mouseleave', () => {
        if (marker.dataset.contextLensPinned !== 'true') {
          setExpanded(marker, false);
        }
      });
      marker.addEventListener('focus', () => setExpanded(marker, true));
      marker.addEventListener('blur', () => {
        if (marker.dataset.contextLensPinned !== 'true') {
          setExpanded(marker, false);
        }
      });
    });
  }

  function toggleLens(marker) {
    setLensPinned(marker, marker.dataset.contextLensPinned !== 'true');
  }

  function setLensPinned(marker, pinned) {
    if (pinned) {
      closeSiblingContextLenses(marker);
    }
    marker.dataset.contextLensPinned = pinned ? 'true' : 'false';
    setExpanded(marker, pinned);
  }

  function setExpanded(marker, expanded) {
    if (expanded) {
      closeSiblingContextLenses(marker);
      updateContextLensPlacement(marker);
    } else {
      resetContextLens(marker);
    }
    marker.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function closeSiblingContextLenses(marker) {
    const root = marker && marker.closest && marker.closest([
      '[data-context-lens-boundary]',
      '.object-editing-modal-dialog',
      '.object-canvas',
      '.install-review-panel',
      'main'
    ].join(', '));
    const scope = root || global && global.document || null;
    if (!scope || !scope.querySelectorAll) {
      return;
    }
    scope.querySelectorAll('[data-authoring-context-lens]').forEach((other) => {
      if (other === marker) {
        return;
      }
      other.dataset.contextLensPinned = 'false';
      other.setAttribute('aria-expanded', 'false');
      resetContextLens(other);
    });
  }

  function resetContextLens(marker) {
    if (!marker || !marker.dataset) {
      return;
    }
    marker.dataset.contextLensPlacement = 'right';
    marker.dataset.contextLensVertical = 'bottom';
    if (marker.style && typeof marker.style.removeProperty === 'function') {
      marker.style.removeProperty('--context-lens-popover-position');
      marker.style.removeProperty('--context-lens-max-width');
      marker.style.removeProperty('--context-lens-popover-left');
      marker.style.removeProperty('--context-lens-popover-right');
      marker.style.removeProperty('--context-lens-popover-top');
      marker.style.removeProperty('--context-lens-popover-bottom');
    }
  }

  function updateContextLensPlacement(marker) {
    const popover = marker && marker.querySelector ? marker.querySelector('.authoring-context-lens-popover') : null;
    if (!popover || !marker.getBoundingClientRect) {
      return;
    }
    marker.dataset.contextLensPlacement = 'right';
    marker.dataset.contextLensVertical = 'bottom';
    marker.style.setProperty('--context-lens-popover-position', 'fixed');
    marker.style.removeProperty('--context-lens-max-width');
    marker.style.removeProperty('--context-lens-popover-left');
    marker.style.removeProperty('--context-lens-popover-right');
    marker.style.removeProperty('--context-lens-popover-top');
    marker.style.removeProperty('--context-lens-popover-bottom');

    const boundaryRect = contextLensBoundaryRect(marker);
    const boundaryWidth = Math.max(0, boundaryRect.right - boundaryRect.left);
    const maxWidth = Math.max(180, Math.min(320, boundaryWidth - 16));
    marker.style.setProperty('--context-lens-max-width', maxWidth + 'px');

    const wasHidden = popover.getBoundingClientRect().width <= 0;
    const previousDisplay = popover.style.display;
    const previousVisibility = popover.style.visibility;
    if (wasHidden) {
      popover.style.display = 'grid';
      popover.style.visibility = 'hidden';
    }

    const markerRect = marker.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const gap = 7;
    const popoverWidth = Math.min(maxWidth, Math.max(180, popoverRect.width || 320));
    const popoverHeight = Math.max(80, popoverRect.height || 160);
    const roomRight = Math.max(0, boundaryRect.right - markerRect.left - gap);
    const roomLeft = Math.max(0, markerRect.right - boundaryRect.left - gap);
    let left = markerRect.left;
    if (roomRight < popoverWidth && roomLeft > roomRight) {
      marker.dataset.contextLensPlacement = 'left';
      left = markerRect.right - popoverWidth;
    }
    left = clampContextLensValue(left, boundaryRect.left, boundaryRect.right - popoverWidth);

    const roomBelow = Math.max(0, boundaryRect.bottom - markerRect.bottom - gap);
    const roomAbove = Math.max(0, markerRect.top - boundaryRect.top - gap);
    let top = markerRect.bottom + gap;
    if (roomBelow < popoverHeight && roomAbove > roomBelow) {
      marker.dataset.contextLensVertical = 'top';
      top = markerRect.top - popoverHeight - gap;
    }
    top = clampContextLensValue(top, boundaryRect.top, boundaryRect.bottom - popoverHeight);

    marker.style.setProperty('--context-lens-popover-left', Math.round(left) + 'px');
    marker.style.setProperty('--context-lens-popover-right', 'auto');
    marker.style.setProperty('--context-lens-popover-top', Math.round(top) + 'px');
    marker.style.setProperty('--context-lens-popover-bottom', 'auto');

    if (wasHidden) {
      popover.style.display = previousDisplay;
      popover.style.visibility = previousVisibility;
    }
  }

  function bindContextLensGlobalListeners() {
    if (contextLensGlobalListenersBound || !global || !global.addEventListener) {
      return;
    }
    contextLensGlobalListenersBound = true;
    global.addEventListener('resize', updateOpenContextLenses, {passive: true});
    global.addEventListener('scroll', updateOpenContextLenses, {capture: true, passive: true});
  }

  function updateOpenContextLenses() {
    const doc = global && global.document;
    if (!doc || !doc.querySelectorAll) {
      return;
    }
    doc.querySelectorAll('[data-authoring-context-lens][aria-expanded="true"], [data-authoring-context-lens][data-context-lens-pinned="true"]').forEach((marker) => {
      updateContextLensPlacement(marker);
    });
  }

  function clampContextLensValue(value, min, max) {
    if (max < min) {
      return min;
    }
    if (!Number.isFinite(value)) {
      return min;
    }
    return Math.min(max, Math.max(min, value));
  }

  function contextLensBoundaryRect(marker) {
    const fallback = {
      left: 8,
      top: 8,
      right: Math.max(320, global && global.innerWidth ? global.innerWidth - 8 : 1280),
      bottom: Math.max(240, global && global.innerHeight ? global.innerHeight - 8 : 800)
    };
    if (!marker || !marker.closest) {
      return fallback;
    }
    const boundary = marker.closest([
      '[data-context-lens-boundary]',
      '.object-editing-preview-pane',
      '.object-editing-fields-pane',
      '.install-human-op',
      '.install-human-list',
      '.object-editing-modal-dialog',
      '.object-canvas-stage',
      '.object-canvas',
      'main'
    ].join(', '));
    if (!boundary || !boundary.getBoundingClientRect) {
      return fallback;
    }
    const rect = boundary.getBoundingClientRect();
    if (!rect || rect.width < 160 || rect.height < 120) {
      return fallback;
    }
    return {
      left: Math.max(fallback.left, rect.left),
      top: Math.max(fallback.top, rect.top),
      right: Math.min(fallback.right, rect.right),
      bottom: Math.min(fallback.bottom, rect.bottom)
    };
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
