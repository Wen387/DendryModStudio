(function initProjectMapObjectWorkspaceReturnStack(global) {
  'use strict';

  const STACK_KEY = 'transientReturnStack';
  const STACK_LIMIT = 8;

  const SNAPSHOT_KEYS = [
    'mode',
    'template',
    'view',
    'item',
    'workspace',
    'selectedCanvasNode',
    'storyboardView',
    'storyCanvasCategory',
    'storySearchQuery',
    'storyScopeCollapsed',
    'storyOverviewCollapsed',
    'storyCardColors',
    'storyScopeMode',
    'storyScopeWindow',
    'storyChainDepth',
    'cardBoardSelectedKey',
    'cardBoardLane',
    'cardBoardQuery',
    'cardBoardType',
    'systemUiFixture',
    'canvasZoom',
    'canvasPanX',
    'canvasPanY',
    'nodePositions',
    'draftBranches',
    'editorOverlay',
    'deleteProposal',
    'boardChromeCollapsed',
    'runtimeLensFocusKey',
    'runtimeLensDraftKey',
    'runtimeLensCurrentDraftKey',
    'runtimeLensExpanded',
    'runtimeLensCollapsed',
    'objectEditorPreviewExpanded',
    'baseDraft',
    'proposalOptions',
    'values',
    'valueOriginals',
    'structureCommands',
    'structureCommandCounter'
  ];

  const api = {
    capture,
    push,
    peek,
    pop,
    restore,
    clear
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectWorkspaceReturnStack = api;
  }

  function capture(state, options) {
    const opts = options && typeof options === 'object' ? options : {};
    return {
      kind: 'object_workspace_return_context',
      label: String(opts.label || state && state.model && (state.model.title || state.model.objectId) || ''),
      focusSelector: String(opts.focusSelector || ''),
      scrollSnapshot: cloneValue(opts.scrollSnapshot || null),
      snapshot: snapshotState(state || {})
    };
  }

  function push(state, context) {
    if (!state || !context) {
      return null;
    }
    const stack = stackFor(state);
    stack.push(context);
    if (stack.length > STACK_LIMIT) {
      stack.splice(0, stack.length - STACK_LIMIT);
    }
    state[STACK_KEY] = stack;
    return context;
  }

  function peek(state) {
    const stack = stackFor(state);
    return stack.length ? stack[stack.length - 1] : null;
  }

  function pop(state) {
    const stack = stackFor(state);
    const context = stack.pop() || null;
    if (state) {
      state[STACK_KEY] = stack;
    }
    return context;
  }

  function restore(state, context) {
    if (!state || !context || !context.snapshot) {
      return null;
    }
    const snapshot = context.snapshot || {};
    Object.keys(snapshot).forEach((key) => {
      state[key] = cloneValue(snapshot[key]);
    });
    return cloneValue(context.scrollSnapshot || null);
  }

  function clear(state) {
    if (state) {
      state[STACK_KEY] = [];
    }
  }

  function snapshotState(state) {
    return SNAPSHOT_KEYS.reduce((out, key) => {
      if (Object.prototype.hasOwnProperty.call(state, key)) {
        out[key] = cloneValue(state[key]);
      }
      return out;
    }, {});
  }

  function stackFor(state) {
    return Array.isArray(state && state[STACK_KEY]) ? state[STACK_KEY] : [];
  }

  function cloneValue(value) {
    if (value === undefined || value === null) {
      return value;
    }
    if (typeof value !== 'object') {
      return value;
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_err) {
      return Array.isArray(value) ? value.slice() : Object.assign({}, value);
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
