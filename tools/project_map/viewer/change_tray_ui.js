(function initProjectMapChangeTray(global) {
  'use strict';

  const state = {
    open: false,
    count: 0
  };

  let elements = null;
  let observer = null;

  const api = {
    setOpen,
    toggle: () => setOpen(!state.open),
    refresh,
    getState: () => ({open: state.open, count: state.count})
  };
  global.ProjectMapChangeTray = api;

  if (!global || !global.document) {
    return;
  }

  onReady(() => start(global.document));

  function onReady(callback) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function start(document) {
    const createPane = document.getElementById('create-pane');
    const panel = document.querySelector('.draft-workspace-panel');
    if (!createPane || !panel || panel.dataset.changeTrayReady === 'true') {
      return;
    }
    panel.dataset.changeTrayReady = 'true';
    panel.dataset.changeTrayPanel = 'true';
    if (!panel.id) {
      panel.id = 'draft-workspace-panel';
    }
    panel.classList.add('change-tray-panel', 'is-collapsed');
    panel.setAttribute('aria-expanded', 'false');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'change-tray-toggle';
    toggle.dataset.changeTrayToggle = 'true';
    toggle.setAttribute('aria-controls', panel.id || 'draft-workspace-panel');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = [
      iconHtml('save'),
      '<span data-change-tray-label="true"></span>',
      '<strong data-change-tray-count="true">0</strong>'
    ].join('');
    createPane.appendChild(toggle);

    elements = {
      createPane,
      panel,
      toggle,
      label: toggle.querySelector('[data-change-tray-label]'),
      count: toggle.querySelector('[data-change-tray-count]'),
      status: document.getElementById('draft-workspace-status'),
      list: document.getElementById('draft-workspace-list'),
      actions: panel.querySelector('.draft-workspace-actions')
    };

    injectTrayActions(document);
    bind(document);
    localize();
    refresh();
  }

  function injectTrayActions(document) {
    if (!elements || !elements.actions) {
      return;
    }
    if (!elements.actions.querySelector('[data-change-tray-text-patch]')) {
      const textPatch = document.createElement('button');
      textPatch.type = 'button';
      textPatch.dataset.changeTrayTextPatch = 'true';
      elements.actions.insertBefore(textPatch, elements.actions.firstChild);
    }
    if (!elements.actions.querySelector('[data-change-tray-close]')) {
      const close = document.createElement('button');
      close.type = 'button';
      close.dataset.changeTrayClose = 'true';
      elements.actions.appendChild(close);
    }
  }

  function bind(document) {
    elements.toggle.addEventListener('click', () => setOpen(!state.open));
    elements.panel.addEventListener('click', (event) => {
      const close = event.target.closest && event.target.closest('[data-change-tray-close]');
      const textPatch = event.target.closest && event.target.closest('[data-change-tray-text-patch]');
      if (close) {
        setOpen(false);
      }
      if (textPatch) {
        openTextPatch();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.open) {
        setOpen(false);
      }
    });
    document.addEventListener('ProjectMap:draft-workspace-updated', refresh);
    document.addEventListener('project-map:locale-changed', () => {
      localize();
      refresh();
    });
    document.addEventListener('ProjectMap:mode-changing', (event) => {
      const detail = event && event.detail || {};
      if (detail.nextMode && detail.nextMode !== 'create') {
        setOpen(false);
      }
    });
    bindObserver();
  }

  function bindObserver() {
    if (!elements || !elements.list || typeof MutationObserver === 'undefined') {
      return;
    }
    observer = new MutationObserver(refresh);
    observer.observe(elements.list, {childList: true});
  }

  function setOpen(open) {
    state.open = Boolean(open);
    if (!elements) {
      return;
    }
    elements.panel.classList.toggle('is-open', state.open);
    elements.panel.classList.toggle('is-collapsed', !state.open);
    elements.panel.setAttribute('aria-expanded', state.open ? 'true' : 'false');
    elements.toggle.setAttribute('aria-expanded', state.open ? 'true' : 'false');
    elements.toggle.classList.toggle('is-open', state.open);
    if (state.open) {
      const primary = elements.panel.querySelector('#draft-workspace-save');
      if (primary && typeof primary.focus === 'function') {
        primary.focus({preventScroll: true});
      }
    }
  }

  function refresh() {
    if (!elements) {
      return;
    }
    const draftApi = global.ProjectMapDraftWorkspaceUi;
    const draftState = draftApi && typeof draftApi.getState === 'function' ? draftApi.getState() : null;
    const count = draftState && Array.isArray(draftState.items)
      ? draftState.items.length
      : elements.list ? elements.list.querySelectorAll('.draft-workspace-item').length : 0;
    state.count = count;
    if (elements.count) {
      elements.count.textContent = String(count);
    }
    if (elements.toggle) {
      elements.toggle.dataset.changeTrayCount = String(count);
      elements.toggle.title = count
        ? t('changeTray.openWithCount', 'Open saved changes') + ': ' + count
        : t('changeTray.openEmpty', 'Open My Changes');
    }
  }

  function localize() {
    if (!elements) {
      return;
    }
    if (elements.label) {
      elements.label.textContent = t('changeTray.title', 'My Changes');
    }
    const textPatch = elements.panel.querySelector('[data-change-tray-text-patch]');
    if (textPatch) {
      textPatch.innerHTML = iconHtml('edit') + '<span>' + escapeHtml(t('changeTray.textPatch', 'Text Patch')) + '</span>';
      textPatch.title = t('changeTray.textPatchHelp', 'Open the source-backed text patch workspace');
    }
    const close = elements.panel.querySelector('[data-change-tray-close]');
    if (close) {
      close.innerHTML = iconHtml('chevron') + '<span>' + escapeHtml(t('changeTray.collapse', 'Collapse')) + '</span>';
      close.title = t('changeTray.collapse', 'Collapse');
    }
  }

  function openTextPatch() {
    const createButton = global.document.querySelector('[data-mode="create"]');
    if (createButton) {
      createButton.click();
    }
    const workspace = global.ProjectMapAuthoringWorkspace;
    if (workspace && typeof workspace.setTemplate === 'function') {
      workspace.setTemplate('surface', {silent: true});
    }
    const objectCanvas = global.ProjectMapObjectAuthoringCanvas;
    if (objectCanvas && typeof objectCanvas.openTemplate === 'function') {
      objectCanvas.openTemplate('surface', null, {source: 'Text Patch'});
      setOpen(false);
      return;
    }
    const button = global.document.querySelector('[data-create-template="surface"]');
    if (button) {
      button.click();
      setOpen(false);
    }
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function iconHtml(name) {
    const icons = global.ProjectMapIcons;
    return icons && typeof icons.icon === 'function' ? icons.icon(name) : '';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})(typeof window !== 'undefined' ? window : globalThis);
