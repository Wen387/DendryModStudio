(function initProjectMapRuntimeLensUi(global) {
  'use strict';

  function focusFromCanvas(projectIndex, model, selectedKey) {
    const parsed = parseSelectedKey(selectedKey);
    const sceneId = parsed && parsed.kind !== 'draft' ? parsed.id : model && model.objectId || '';
    const scene = sceneById(projectIndex, sceneId);
    const kind = focusKind(parsed, model, scene);
    const id = sceneId || model && model.objectId || '';
    const source = sourceRef(scene && (scene.sourceSpan || scene.source || scene) || model && model.source);
    return {
      kind,
      id,
      sceneId: kind === 'card' ? '' : id,
      cardId: kind === 'card' ? id : '',
      title: firstNonEmpty(scene && scene.title, model && model.title, id),
      source,
      key: focusKey(kind, id)
    };
  }

  function focusFromSystemRegion(projectIndex, model, selectedKey, options) {
    const opts = options || {};
    const screen = systemUiScreen(model, {
      selected: selectedKey,
      fixture: opts.fixture
    });
    const region = screen && screen.selected || null;
    const regionId = normalizeRegionKey(region && region.key || screen && screen.selectedKey || selectedKey);
    const source = systemRegionSource(region, screen, model);
    const targetSceneId = systemRegionTargetScene(projectIndex, region, screen, source);
    return {
      kind: 'system_region',
      id: regionId,
      regionId,
      targetSceneId,
      title: firstNonEmpty(region && region.title, region && region.fallback, screen && screen.recipe && screen.recipe.fallback, regionId),
      source,
      key: focusKey('system_region', [regionId, screen && screen.fixture].filter(Boolean).join(':'))
    };
  }

  function renderPanel(options) {
    const opts = options || {};
    const focus = opts.focus || {};
    const session = opts.session || null;
    const sessionFocusKey = String(opts.sessionFocusKey || session && session.focus && focusKey(session.focus.kind, session.focus.id) || '');
    const currentFocusKey = String(focus.key || focusKey(focus.kind, focus.id));
    const stale = Boolean(session && session.ok && sessionFocusKey && sessionFocusKey !== currentFocusKey);
    const status = stale ? 'stale' : opts.status || session && session.status || 'idle';
    const isDesktop = Boolean(global && global.dendryDesktop && typeof global.dendryDesktop.createRuntimeLens === 'function');
    const url = String(session && (session.lensUrl || session.lensPageUrl || session.externalUrl) || '');
    const canFocus = Boolean(isDesktop && focus && focus.id && focus.kind !== 'unknown' && focus.kind !== 'news');
    const classes = [
      'runtime-lens-panel',
      opts.expanded ? 'is-expanded' : '',
      stale ? 'is-stale' : '',
      status ? 'is-' + safeClass(status) : ''
    ].filter(Boolean).join(' ');
    return [
      '<section class="' + classes + '" data-runtime-lens-panel="true" data-runtime-lens-status="' + escapeAttr(status) + '">',
      '<header class="runtime-lens-header">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('runtimeLens.eyebrow', 'Runtime Lens')) + '</div>',
      '<h3>' + escapeHtml(t('runtimeLens.title', 'Focused runtime')) + '</h3>',
      '</div>',
      '<div class="runtime-lens-actions">',
      '<button type="button" data-runtime-lens-action="create" ' + (!canFocus || status === 'building' ? 'disabled' : '') + '>' + escapeHtml(session && session.ok ? t('runtimeLens.refresh', 'Refresh') : t('runtimeLens.create', 'Create Lens')) + '</button>',
      '<button type="button" data-runtime-lens-action="toggle_expand">' + escapeHtml(opts.expanded ? t('runtimeLens.dock', 'Dock') : t('runtimeLens.expand', 'Expand')) + '</button>',
      url ? '<button type="button" data-runtime-lens-action="open_external">' + escapeHtml(t('runtimeLens.openExternal', 'Open')) + '</button>' : '',
      session ? '<button type="button" data-runtime-lens-action="clear">' + escapeHtml(t('runtimeLens.clear', 'Clear')) + '</button>' : '',
      '</div>',
      '</header>',
      renderSummary(focus, status, {isDesktop, stale, canFocus}),
      renderBody({url, status, isDesktop, canFocus, session}),
      '</section>'
    ].join('');
  }

  function renderSummary(focus, status, options) {
    const opts = options || {};
    const message = !opts.isDesktop
      ? t('runtimeLens.browserOnly', 'Focused Runtime Lens is available in the desktop app because it builds a temporary runtime sandbox.')
      : !opts.canFocus
        ? t('runtimeLens.unsupportedFocus', 'Select a source-backed object or UI region to focus it in runtime.')
        : opts.stale
          ? t('runtimeLens.stale', 'Lens is showing a previous selection. Refresh to rebuild around this object.')
          : statusText(status);
    return [
      '<div class="runtime-lens-summary">',
      '<div><span>' + escapeHtml(t('runtimeLens.focus', 'Focus')) + '</span><strong>' + escapeHtml(focus.title || focus.id || '') + '</strong></div>',
      '<div><span>' + escapeHtml(t('runtimeLens.target', 'Target')) + '</span><strong>' + escapeHtml([focus.kind, focus.id].filter(Boolean).join(' / ')) + '</strong></div>',
      '<p>' + escapeHtml(message) + '</p>',
      '</div>'
    ].join('');
  }

  function renderBody(options) {
    const opts = options || {};
    if (opts.url && opts.status !== 'failed') {
      return [
        '<div class="runtime-lens-frame-wrap">',
        '<iframe class="runtime-lens-frame" data-runtime-lens-frame="true" title="' + escapeAttr(t('runtimeLens.frameTitle', 'Focused runtime preview')) + '" src="' + escapeAttr(opts.url) + '"></iframe>',
        '</div>',
        renderDiagnostics(opts.session && opts.session.diagnostics)
      ].join('');
    }
    if (opts.status === 'building') {
      return '<div class="runtime-lens-empty">' + escapeHtml(t('runtimeLens.building', 'Building a temporary runtime lens...')) + '</div>';
    }
    return '<div class="runtime-lens-empty">' + escapeHtml(opts.isDesktop ? t('runtimeLens.empty', 'Create a Lens to observe this object in the real runtime.') : t('runtimeLens.browserOnlyShort', 'Desktop app required.')) + '</div>' + renderDiagnostics(opts.session && opts.session.diagnostics);
  }

  function renderDiagnostics(rows) {
    const items = ensureArray(rows).filter((diag) => diag && diag.severity !== 'info');
    if (!items.length) {
      return '';
    }
    return [
      '<details class="runtime-lens-diagnostics">',
      '<summary>' + escapeHtml(t('install.runtimePreviewDiagnostics', 'Diagnostics')) + '</summary>',
      items.slice(0, 6).map((diag) => '<p>' + escapeHtml(diag.message || diag.code || '') + '</p>').join(''),
      '</details>'
    ].join('');
  }

  function bind(root, callbacks) {
    const opts = callbacks || {};
    if (!root || !root.querySelectorAll) {
      return;
    }
    root.querySelectorAll('[data-runtime-lens-action]').forEach((button) => {
      if (button.dataset.runtimeLensBound === 'true') {
        return;
      }
      button.dataset.runtimeLensBound = 'true';
      button.addEventListener('click', () => {
        if (opts.onAction) {
          opts.onAction(button.dataset.runtimeLensAction || '', button);
        }
      });
    });
  }

  function statusText(status) {
    return {
      idle: t('runtimeLens.idle', 'Ready to create a focused runtime lens.'),
      building: t('runtimeLens.building', 'Building a temporary runtime lens...'),
      ready: t('runtimeLens.ready', 'Lens is ready.'),
      stale: t('runtimeLens.stale', 'Lens is behind the current edit.'),
      failed: t('runtimeLens.failed', 'Lens could not be created.'),
      unavailable: t('runtimeLens.browserOnlyShort', 'Desktop app required.')
    }[status] || String(status || '');
  }

  function parseSelectedKey(key) {
    const match = String(key || '').match(/^(event|card|advisor|news|route|draft):(.+)$/);
    return match ? {kind: match[1], id: match[2]} : null;
  }

  function normalizeRegionKey(key) {
    return String(key || '').replace(/^ui:/, '').trim();
  }

  function focusKind(parsed, model, scene) {
    const kind = parsed && parsed.kind || '';
    if (kind === 'card' || kind === 'advisor') {
      return 'card';
    }
    if (kind === 'news') {
      return 'news';
    }
    const modelKind = String(model && (model.objectKind || model.template) || '').toLowerCase();
    if (modelKind === 'card' || scene && (scene.type === 'card' || scene.flags && scene.flags.isCard)) {
      return 'card';
    }
    return 'event';
  }

  function sceneById(projectIndex, id) {
    const sceneId = String(id || '');
    return ensureArray(projectIndex && projectIndex.scenes).find((scene) => String(scene && scene.id || '') === sceneId) || null;
  }

  function sceneByPath(projectIndex, sourcePath) {
    const path = String(sourcePath || '');
    if (!path) {
      return null;
    }
    return ensureArray(projectIndex && projectIndex.scenes).find((scene) => {
      const source = scene && (scene.sourceSpan || scene.source || {});
      return String(scene && scene.path || source.path || '') === path;
    }) || null;
  }

  function firstScene(projectIndex, predicate) {
    return ensureArray(projectIndex && projectIndex.scenes).find((scene) => scene && predicate(scene)) || null;
  }

  function systemRegionTargetScene(projectIndex, region, screen, source) {
    const bySource = sceneByPath(projectIndex, source && source.path);
    if (bySource && bySource.id) {
      return bySource.id;
    }
    const key = normalizeRegionKey(region && region.key);
    const semantic = projectIndex && projectIndex.semantic || {};
    const firstHand = ensureArray(semantic.hands)[0];
    const firstCard = ensureArray(semantic.cards)[0];
    const byRegion = {
      workspace_hand: firstHand && firstHand.id,
      advisor_lane: firstHand && firstHand.id,
      deck_lane: firstCard && firstCard.id || firstHand && firstHand.id,
      action_card: firstCard && firstCard.id,
      sidebar_status: sceneIdByType(projectIndex, ['status', 'sidebar'])
    }[key];
    if (byRegion) {
      return byRegion;
    }
    const root = sceneById(projectIndex, projectIndex && projectIndex.project && projectIndex.project.rootScene || 'root') ||
      firstScene(projectIndex, (scene) => /root|start|main/i.test(String(scene.id || scene.type || '')));
    return root && root.id || screen && screen.template || '';
  }

  function sceneIdByType(projectIndex, types) {
    const wanted = ensureArray(types).map((type) => String(type).toLowerCase());
    const scene = firstScene(projectIndex, (item) => wanted.includes(String(item.type || '').toLowerCase()) || wanted.some((type) => String(item.id || '').toLowerCase().includes(type)));
    return scene && scene.id || '';
  }

  function systemRegionSource(region, screen, model) {
    const evidence = ensureArray(region && region.sourceEvidence)[0] ||
      ensureArray(screen && screen.regionContext && screen.regionContext.sourceEvidence)[0] ||
      ensureArray(model && model.contextBoard && model.contextBoard.sourceEvidence)[0] ||
      model && model.source || {};
    return sourceRef(evidence);
  }

  function systemUiScreen(model, options) {
    const api = systemUiScreenModelApi();
    return api && typeof api.buildScreen === 'function'
      ? api.buildScreen(model || {}, options || {})
      : {template: 'entry', fixture: '', selectedKey: normalizeRegionKey(options && options.selected), selected: null};
  }

  function systemUiScreenModelApi() {
    if (global && global.ProjectMapSystemUiScreenModel) {
      return global.ProjectMapSystemUiScreenModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./system_ui_screen_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function sourceRef(value) {
    const source = value || {};
    const path = String(source.path || source.sourcePath || '');
    if (!path) {
      return {};
    }
    return {
      path,
      line: source.line || source.startLine || '',
      endLine: source.endLine || ''
    };
  }

  function focusKey(kind, id) {
    return String(kind || 'unknown') + ':' + String(id || '');
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

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeClass(value) {
    return String(value || '').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  const api = {
    focusFromCanvas,
    focusFromSystemRegion,
    renderPanel,
    bind
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapRuntimeLensUi = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
