(function initProjectMapQdisplayCreatePanel(global) {
  'use strict';

  // qdisplay files (`source/qdisplays/*.qdisplay.dry`) are tiny range→label
  // maps. The Explore inspector shows their band lines as surface-text items;
  // this sibling adds the missing CREATE half of the basic workflow: duplicate
  // an existing qdisplay into a new file through a safe create_file install
  // plan. The current file text comes from the desktop bridge
  // (dendryDesktop.readSourceSlice) — never from the index — so the new file
  // always copies what is on disk right now. The generated plan goes through
  // the install assistant (review → dry-run → apply); the install layer
  // refuses creates that would overwrite a different existing file.
  //
  // The panel renders from explore_inspector via an optional global; clicks
  // self-register once per document. No canvas/action data attributes — this
  // panel must never be mistaken for an editable field or a dispatchable
  // visible-edit action.

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const escapeAttr = domTextUtils.escapeAttr;
  const escapeHtml = domTextUtils.escapeHtml;

  const QDISPLAY_PATH_RE = /^source\/qdisplays\/[^/]+\.qdisplay\.dry$/;
  const NEW_NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;

  function qdisplaySourcePath(item) {
    const source = item && typeof item === 'object' ? item.source : null;
    const path = String(source && source.path || '').trim();
    return QDISPLAY_PATH_RE.test(path) ? path : '';
  }

  function isQdisplayItem(item) {
    return Boolean(qdisplaySourcePath(item));
  }

  function targetPathForName(name) {
    const value = String(name || '').trim();
    if (!NEW_NAME_RE.test(value)) {
      return '';
    }
    return 'source/qdisplays/' + value + '.qdisplay.dry';
  }

  // Pure plan builder so tests can lock the operation shape without a DOM or
  // bridge. `text` must be the freshly read file content.
  function buildCreatePlan(sourcePath, newName, text) {
    const targetPath = targetPathForName(newName);
    if (!QDISPLAY_PATH_RE.test(String(sourcePath || '')) || !targetPath || !String(text || '')) {
      return null;
    }
    const operation = {
      id: 'qdisplay_create_' + String(newName).toLowerCase(),
      type: 'create_file',
      path: targetPath,
      content: String(text),
      safety: 'safe_apply',
      description: 'Create ' + targetPath + ' as a copy of ' + String(sourcePath) + '.'
    };
    const installApi = global && global.ProjectMapInstallPlan;
    if (installApi && typeof installApi.buildInstallPlan === 'function') {
      return installApi.buildInstallPlan({
        id: operation.id,
        draftKind: 'qdisplay_create',
        title: 'New qdisplay ' + targetPath,
        operations: [operation]
      });
    }
    return {
      schemaVersion: '0.1',
      kind: 'dendry_mod_studio_install_plan',
      id: operation.id,
      draftKind: 'qdisplay_create',
      title: 'New qdisplay ' + targetPath,
      operations: [operation]
    };
  }

  function renderCreatePanel(item) {
    const sourcePath = qdisplaySourcePath(item);
    if (!sourcePath) {
      return '';
    }
    const label = t('qdisplayCreate.label', 'Create a new qdisplay from this file');
    return '<div class="inspector-actions qdisplay-create-panel" data-qdisplay-create-panel="true">' +
      '<span class="qdisplay-create-label">' + escapeHtml(label) + '</span>' +
      '<input type="text" class="qdisplay-create-name" data-qdisplay-create-name="true" placeholder="' +
      escapeAttr(t('qdisplayCreate.namePlaceholder', 'new_qdisplay_name')) + '">' +
      '<button type="button" class="qdisplay-create-button" data-qdisplay-create-from="' +
      escapeAttr(sourcePath) + '">' + escapeHtml(t('qdisplayCreate.button', 'Create copy')) + '</button>' +
      '<span class="qdisplay-create-note" data-qdisplay-create-note="true" hidden></span>' +
      '</div>';
  }

  // ---- live behaviour (browser only; self-registered) ----

  function panelFor(button) {
    return button && typeof button.closest === 'function'
      ? button.closest('[data-qdisplay-create-panel]')
      : null;
  }

  function showNote(button, message) {
    const panel = panelFor(button);
    const note = panel ? panel.querySelector('[data-qdisplay-create-note]') : null;
    if (note) {
      note.textContent = String(message || '');
      note.hidden = !message;
    }
  }

  function onCreateClick(event) {
    const target = event && event.target;
    const button = target && typeof target.closest === 'function'
      ? target.closest('[data-qdisplay-create-from]')
      : null;
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const sourcePath = String(button.getAttribute('data-qdisplay-create-from') || '');
    const panel = panelFor(button);
    const input = panel ? panel.querySelector('[data-qdisplay-create-name]') : null;
    const name = input ? String(input.value || '').trim() : '';
    if (!targetPathForName(name)) {
      showNote(button, t('qdisplayCreate.invalidName', 'Use letters, numbers, _ or - for the new qdisplay name.'));
      return;
    }
    const bridge = global && global.dendryDesktop;
    if (!bridge || typeof bridge.readSourceSlice !== 'function') {
      showNote(button, t('qdisplayCreate.desktopOnly', 'Desktop Studio is required to copy a qdisplay file.'));
      return;
    }
    button.disabled = true;
    showNote(button, t('qdisplayCreate.loading', 'Reading the current qdisplay file…'));
    Promise.resolve(bridge.readSourceSlice({path: sourcePath, startLine: 1, endLine: 1}))
      .then((probe) => {
        if (!probe || probe.ok !== true || !Number(probe.totalLines)) {
          throw new Error(probe && probe.message ? probe.message : 'read failed');
        }
        return bridge.readSourceSlice({path: sourcePath, startLine: 1, endLine: Number(probe.totalLines)});
      })
      .then((result) => {
        button.disabled = false;
        if (!result || result.ok !== true) {
          showNote(button, t('qdisplayCreate.readFailed', 'Could not read the qdisplay file.') +
            (result && result.message ? ' ' + result.message : ''));
          return;
        }
        const plan = buildCreatePlan(sourcePath, name, String(result.text || '') + '\n');
        const assistant = global && global.ProjectMapInstallAssistant;
        if (!plan || !assistant || typeof assistant.loadPlan !== 'function') {
          showNote(button, t('qdisplayCreate.readFailed', 'Could not read the qdisplay file.'));
          return;
        }
        assistant.loadPlan(plan, {fileName: plan.id + '.install-plan.json'});
        showNote(button, t('qdisplayCreate.loaded', 'Plan ready in Review & Apply — dry-run, then apply.'));
        switchToInstallMode();
      })
      .catch((err) => {
        button.disabled = false;
        showNote(button, t('qdisplayCreate.readFailed', 'Could not read the qdisplay file.') +
          (err && err.message ? ' ' + err.message : ''));
      });
  }

  function switchToInstallMode() {
    const wizard = global && global.ProjectMapWizard;
    if (wizard && typeof wizard.setMode === 'function') {
      wizard.setMode('install');
      return;
    }
    const installButton = global && global.document
      ? global.document.querySelector('[data-mode="install"]')
      : null;
    if (installButton && typeof installButton.click === 'function') {
      installButton.click();
    }
  }

  function ensureWired(host) {
    if (!host || !host.document || host.__qdisplayCreatePanelWired) {
      return;
    }
    host.__qdisplayCreatePanelWired = true;
    host.document.addEventListener('click', onCreateClick, true);
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  ensureWired(global);

  const api = {
    isQdisplayItem,
    targetPathForName,
    buildCreatePlan,
    renderCreatePanel
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapQdisplayCreatePanel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
