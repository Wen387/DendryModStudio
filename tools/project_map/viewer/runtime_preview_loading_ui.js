(function initProjectMapRuntimePreviewLoading(global) {
  'use strict';

  let overlay = null;
  let activeRequests = 0;

  function defaultLabel() {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function'
      ? i18n.t('install.runtimePreviewProgressLabel', 'Runtime preview progress')
      : 'Runtime preview progress';
  }

  function ensureOverlay(label) {
    const document = global && global.document;
    if (!document || !document.body || typeof document.createElement !== 'function') {
      return null;
    }
    if (overlay && overlay.isConnected) {
      setLabel(label);
      return overlay;
    }
    overlay = document.createElement('div');
    overlay.className = 'runtime-preview-loading-overlay';
    overlay.setAttribute('data-runtime-preview-loading-overlay', 'true');
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-label', label);

    const card = document.createElement('div');
    card.className = 'runtime-preview-loading-card';
    const progress = document.createElement('progress');
    progress.max = 100;
    progress.setAttribute('aria-label', label);
    card.appendChild(progress);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    return overlay;
  }

  function setLabel(label) {
    if (!overlay) {
      return;
    }
    overlay.setAttribute('aria-label', label);
    const progress = overlay.querySelector && overlay.querySelector('progress');
    if (progress) {
      progress.setAttribute('aria-label', label);
    }
  }

  function show(options) {
    const label = options && options.label ? String(options.label) : defaultLabel();
    const node = ensureOverlay(label);
    if (!node) {
      return function noopRelease() {};
    }
    activeRequests += 1;
    node.classList.add('is-active');
    return function releaseRuntimePreviewLoading() {
      hide();
    };
  }

  function hide() {
    if (activeRequests > 0) {
      activeRequests -= 1;
    }
    if (activeRequests > 0 || !overlay) {
      return;
    }
    const node = overlay;
    overlay = null;
    node.classList.remove('is-active');
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }

  function reset() {
    activeRequests = 0;
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    overlay = null;
  }

  const api = {
    show,
    hide,
    reset
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapRuntimePreviewLoading = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
