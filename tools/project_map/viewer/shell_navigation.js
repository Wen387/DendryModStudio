(function initShellNavigation(global) {
  'use strict';

  const INDEX_EVENT_NAMES = [
    'project-map:index-loaded',
    'ProjectMap:index-loaded',
    'projectmap:index-loaded',
    'ProjectMapIndexLoaded',
    'project-map:model-loaded'
  ];

  const state = {
    projectIndex: null,
    projectModel: null,
    lastIndexLabel: ''
  };

  let elements = null;

  const api = {
    setProjectIndex,
    setIndex: setProjectIndex,
    setProjectModel,
    setMode,
    getProjectIndex: () => state.projectIndex,
    getProjectModel: () => state.projectModel,
    getLastIndexLabel: () => state.lastIndexLabel,
    getState: () => ({
      projectIndex: state.projectIndex,
      projectModel: state.projectModel,
      lastIndexLabel: state.lastIndexLabel
    })
  };

  global.ProjectMapShellNavigation = api;

  if (!global || !global.document) {
    return;
  }

  onReady(() => initShell(global.document));

  function onReady(callback) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function initShell(document) {
    elements = {
      body: document.body,
      modeButtons: Array.from(document.querySelectorAll('[data-mode]')),
      explorePane: document.getElementById('explore-pane'),
      designPane: document.getElementById('design-pane'),
      createPane: document.getElementById('create-pane'),
      installPane: document.getElementById('install-pane'),
      dropTarget: document.getElementById('index-drop-target'),
      file: document.getElementById('index-file')
    };

    bindModeSwitch();
    bindIndexLoading();
    bindIndexEvents();
    bindPageLifecycle();
    setMode('explore');
  }

  function bindModeSwitch() {
    elements.modeButtons.forEach((button) => {
      button.addEventListener('click', () => setMode(button.dataset.mode, {reason: 'user'}));
    });
  }

  function setMode(mode, options) {
    const nextMode = mode === 'create' || mode === 'install' || mode === 'design' ? mode : 'explore';
    const previousMode = elements.body.dataset.mode || '';
    const changed = previousMode !== nextMode;
    const detail = {
      previousMode,
      nextMode,
      reason: options && options.reason || 'programmatic',
      visible: !global.document.hidden
    };
    if (changed) {
      dispatchLifecycleEvent('ProjectMap:mode-changing', detail);
    }
    elements.body.dataset.mode = nextMode;
    elements.explorePane.classList.toggle('hidden', nextMode !== 'explore');
    if (elements.designPane) {
      elements.designPane.classList.toggle('hidden', nextMode !== 'design');
    }
    elements.createPane.classList.toggle('hidden', nextMode !== 'create');
    if (elements.installPane) {
      elements.installPane.classList.toggle('hidden', nextMode !== 'install');
    }
    elements.modeButtons.forEach((button) => {
      const active = button.dataset.mode === nextMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (changed) {
      dispatchLifecycleEvent('ProjectMap:mode-changed', detail);
    }
  }

  function bindPageLifecycle() {
    if (!global.document || typeof global.document.addEventListener !== 'function') {
      return;
    }
    global.document.addEventListener('visibilitychange', () => {
      dispatchLifecycleEvent('ProjectMap:foreground-changed', {
        mode: elements && elements.body && elements.body.dataset.mode || '',
        visible: !global.document.hidden,
        visibilityState: global.document.visibilityState || ''
      });
    });
  }

  function dispatchLifecycleEvent(name, detail) {
    if (!global.document || typeof global.document.dispatchEvent !== 'function') {
      return;
    }
    var event;
    if (typeof global.CustomEvent === 'function') {
      event = new global.CustomEvent(name, {detail: detail});
    } else {
      event = global.document.createEvent('CustomEvent');
      event.initCustomEvent(name, false, false, detail);
    }
    global.document.dispatchEvent(event);
  }

  function bindIndexLoading() {
    if (elements.file) {
      elements.file.addEventListener('change', (event) => {
        const file = event.target.files && event.target.files[0];
        if (file) {
          readProjectIndexFile(file);
        }
      });
    }

    const target = elements.dropTarget;
    if (!target) {
      return;
    }

    ['dragenter', 'dragover'].forEach((name) => {
      target.addEventListener(name, (event) => {
        event.preventDefault();
        target.classList.add('is-drag-over');
      });
    });

    ['dragleave', 'drop'].forEach((name) => {
      target.addEventListener(name, () => {
        target.classList.remove('is-drag-over');
      });
    });

    target.addEventListener('drop', (event) => {
      event.preventDefault();
      const files = event.dataTransfer && event.dataTransfer.files;
      const file = files && files[0];
      if (!file) {
        return;
      }
      if (elements.file) {
        try {
          elements.file.files = files;
          elements.file.dispatchEvent(new Event('change', {bubbles: true}));
          return;
        } catch (err) {
          // fall through to direct read
        }
      }
      readProjectIndexFile(file);
    });
  }

  function readProjectIndexFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const index = JSON.parse(String(reader.result || ''));
        setProjectIndex(index, {fileName: file.name, fileSize: file.size});
      } catch (err) {
        dispatchLifecycleEvent('ProjectMap:index-error', {
          error: err,
          message: 'Index parse failed: ' + err.message
        });
      }
    };
    reader.onerror = () => {
      dispatchLifecycleEvent('ProjectMap:index-error', {
        error: new Error('Index read failed.'),
        message: 'Index read failed.'
      });
    };
    reader.readAsText(file);
  }

  function setProjectIndex(index, meta) {
    state.projectIndex = index || null;
    state.projectModel = null;
    state.lastIndexLabel = meta && meta.fileName ? meta.fileName : '';

    try {
      if (global.ProjectMapViewer && typeof global.ProjectMapViewer.buildViewModel === 'function') {
        state.projectModel = global.ProjectMapViewer.buildViewModel(index);
      }
      dispatchLifecycleEvent('ProjectMap:shell-index-updated', {
        projectIndex: state.projectIndex,
        projectModel: state.projectModel,
        lastIndexLabel: state.lastIndexLabel,
        ok: true
      });
      return {ok: true};
    } catch (err) {
      state.projectModel = null;
      dispatchLifecycleEvent('ProjectMap:shell-index-updated', {
        projectIndex: state.projectIndex,
        projectModel: state.projectModel,
        lastIndexLabel: state.lastIndexLabel,
        ok: false,
        error: err
      });
      return {ok: false, error: err};
    }
  }

  function setProjectModel(model, meta) {
    state.projectModel = model || null;
    state.projectIndex = meta && meta.index ? meta.index : state.projectIndex;
    state.lastIndexLabel = meta && meta.fileName ? meta.fileName : state.lastIndexLabel;
    dispatchLifecycleEvent('ProjectMap:shell-index-updated', {
      projectIndex: state.projectIndex,
      projectModel: state.projectModel,
      lastIndexLabel: state.lastIndexLabel,
      ok: true
    });
    return {ok: true};
  }

  function bindIndexEvents() {
    INDEX_EVENT_NAMES.forEach((name) => {
      const handler = (event) => {
        if (event.__shellNavigationHandled) {
          return;
        }
        event.__shellNavigationHandled = true;
        const detail = event.detail || {};
        if (detail.__shellNavigationHandled) {
          return;
        }
        detail.__shellNavigationHandled = true;
        if (detail.model || detail.viewModel) {
          setProjectModel(detail.model || detail.viewModel, detail);
        } else if (detail.index || detail.projectIndex) {
          setProjectIndex(detail.index || detail.projectIndex, detail);
        }
      };
      global.addEventListener(name, handler);
      if (global.document && typeof global.document.addEventListener === 'function') {
        global.document.addEventListener(name, handler);
      }
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
