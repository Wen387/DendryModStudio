(function initRuntimeLensModel(global) {
  'use strict';

  const MODEL_VERSION = '0.1';
  const STATES = ['idle', 'building', 'ready', 'stale', 'failed', 'unavailable'];
  const FOCUS_KINDS = [
    'scene',
    'event',
    'news',
    'card',
    'hand',
    'deck',
    'route',
    'card_option',
    'system_region',
    'text_replacement',
    'unknown'
  ];

  function buildModel(input) {
    const value = isObject(input) ? input : {};
    const desktop = value.isDesktop === true;
    const focus = normalizeFocus(value.focus, value.projectIndex);
    const session = normalizeSession(value.session);
    const stale = value.stale === true;
    const diagnostics = [];

    if (!desktop) {
      diagnostics.push(diagnostic(
        'info',
        'runtime_lens.desktop_required',
        'Focused Runtime Lens requires the desktop app because it builds a temporary runtime sandbox.'
      ));
    }
    diagnostics.push.apply(diagnostics, ensureArray(value.diagnostics));
    diagnostics.push.apply(diagnostics, focus.diagnostics);
    diagnostics.push.apply(diagnostics, session.diagnostics);

    const status = statusFor({desktop, session, stale, diagnostics});
    return {
      schemaVersion: MODEL_VERSION,
      kind: 'runtime_lens_model',
      enabled: desktop,
      status,
      stale: stale || status === 'stale',
      focus,
      session,
      urls: session.urls,
      commands: commandsForFocus(focus, session, {desktop}),
      diagnostics
    };
  }

  function normalizeFocus(input, projectIndex) {
    const value = isObject(input) ? input : {};
    const kind = normalizeKind(value.kind || value.type || value.objectKind || value.template);
    const index = isObject(projectIndex) ? projectIndex : {};
    const id = firstNonEmpty(
      value.id,
      value.objectId,
      value.sceneId,
      value.cardId,
      value.regionId,
      value.key
    );
    const scene = sceneFor(index, value.sceneId || (isSceneLikeKind(kind) ? id : ''));
    const card = sceneFor(index, value.cardId || (kind === 'card' ? id : ''));
    const targetSceneId = firstNonEmpty(
      value.targetSceneId,
      value.sceneId,
      scene && scene.id,
      isSceneLikeKind(kind) ? id : '',
      card && card.id
    );
    const source = sourceRef(value.source || value.sourceSpan || scene && scene.sourceSpan || scene || card && (card.sourceSpan || card));
    const diagnostics = [];
    if (!id && kind !== 'unknown') {
      diagnostics.push(diagnostic('warning', 'runtime_lens.focus_id_missing', 'Runtime Lens focus is missing an object id.'));
    }
    if (isSceneLikeKind(kind) && !targetSceneId) {
      diagnostics.push(diagnostic('warning', 'runtime_lens.scene_target_missing', 'Runtime Lens could not identify a scene target for this focus.'));
    }
    return {
      kind,
      id,
      title: firstNonEmpty(value.title, scene && scene.title, card && card.title, id),
      targetSceneId,
      targetCardId: firstNonEmpty(value.cardId, kind === 'card' ? id : ''),
      optionIndex: numberOrBlank(value.optionIndex),
      regionId: firstNonEmpty(value.regionId, kind === 'system_region' ? id : ''),
      source,
      diagnostics
    };
  }

  function normalizeSession(input) {
    const value = isObject(input) ? input : {};
    const ok = value.ok === true;
    const diagnostics = ensureArray(value.diagnostics);
    const urls = {
      lensUrl: firstNonEmpty(value.lensUrl, value.modifiedUrl),
      modifiedUrl: String(value.modifiedUrl || ''),
      compareUrl: String(value.compareUrl || ''),
      baselineUrl: String(value.baselineUrl || ''),
      externalUrl: firstNonEmpty(value.externalUrl, value.lensUrl, value.modifiedUrl, value.compareUrl)
    };
    return {
      ok,
      sessionId: String(value.sessionId || ''),
      status: normalizeStatus(value.status || (ok ? 'ready' : value.sessionId ? 'failed' : 'idle')),
      title: String(value.title || value.metadata && value.metadata.title || ''),
      urls,
      paths: isObject(value.paths) ? {
        root: String(value.paths.root || ''),
        modifiedRoot: String(value.paths.modifiedRoot || ''),
        baselineRoot: String(value.paths.baselineRoot || '')
      } : {},
      diagnostics
    };
  }

  function commandsForFocus(focus, session, options) {
    const desktop = options && options.desktop === true;
    const commands = [];
    if (!desktop) {
      return commands;
    }
    commands.push({type: 'createRuntimeLens', label: 'Create focused runtime lens'});
    if (session && session.ok) {
      commands.push({type: 'refreshLens', label: 'Refresh lens'});
      commands.push({type: 'resetLensState', label: 'Reset preview state'});
    }
    if (session && session.ok && focus && focus.targetSceneId) {
      commands.push({
        type: 'focusScene',
        sceneId: focus.targetSceneId,
        label: 'Show selected scene in runtime'
      });
    }
    if (session && session.ok && focus && focus.kind === 'card' && focus.targetCardId) {
      commands.push({
        type: 'focusCard',
        cardId: focus.targetCardId,
        sceneId: focus.targetSceneId,
        label: 'Show selected card in runtime'
      });
    }
    if (session && session.ok && focus && focus.kind === 'system_region' && focus.regionId) {
      commands.push({
        type: 'focusSystemRegion',
        regionId: focus.regionId,
        sceneId: focus.targetSceneId,
        label: 'Show selected UI region in runtime'
      });
    }
    return commands;
  }

  function statusFor(state) {
    if (!state.desktop) {
      return 'unavailable';
    }
    if (state.stale && state.session && state.session.ok) {
      return 'stale';
    }
    if (state.session && state.session.status) {
      return normalizeStatus(state.session.status);
    }
    return state.diagnostics.some((item) => item && item.severity === 'error') ? 'failed' : 'idle';
  }

  function normalizeKind(value) {
    const text = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
    if (text === 'world_event') return 'event';
    if (text === 'news_item') return 'news';
    if (text === 'advisor') return 'card';
    if (text === 'surface_text' || text === 'text_patch' || text === 'text_replacement') return 'text_replacement';
    if (text === 'scene' || text === 'event' || text === 'news' || text === 'card' || text === 'hand' ||
        text === 'deck' || text === 'route' || text === 'card_option' || text === 'system_region' ||
        text === 'text_replacement') {
      return text;
    }
    if (text === 'option') return 'card_option';
    if (text === 'sidebar' || text === 'status' || text === 'project' || text === 'game_info') {
      return 'system_region';
    }
    return 'unknown';
  }

  function isSceneLikeKind(kind) {
    return kind === 'scene' ||
      kind === 'event' ||
      kind === 'news' ||
      kind === 'hand' ||
      kind === 'deck' ||
      kind === 'route' ||
      kind === 'text_replacement';
  }

  function normalizeStatus(value) {
    const text = String(value || '').trim().toLowerCase();
    return STATES.includes(text) ? text : 'idle';
  }

  function sceneFor(projectIndex, sceneId) {
    const id = String(sceneId || '').trim();
    if (!id) {
      return null;
    }
    return ensureArray(projectIndex && projectIndex.scenes).find((scene) => String(scene && scene.id || '') === id) || null;
  }

  function sourceRef(value) {
    if (!isObject(value)) {
      return {};
    }
    const path = String(value.path || value.sourcePath || '');
    if (!path) {
      return {};
    }
    const ref = {path};
    const line = value.line || value.startLine;
    if (line) {
      ref.line = line;
    }
    if (value.endLine) {
      ref.endLine = value.endLine;
    }
    return ref;
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message, confidence: 'exact'};
  }

  function firstNonEmpty() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value);
      }
    }
    return '';
  }

  function numberOrBlank(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : '';
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {
    STATES,
    FOCUS_KINDS,
    buildModel,
    normalizeFocus,
    normalizeSession,
    commandsForFocus
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapRuntimeLensModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
