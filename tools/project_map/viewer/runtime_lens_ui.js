(function initProjectMapRuntimeLensUi(global) {
  'use strict';

  function desktopCapabilities() {
    if (global && global.ProjectMapDesktopCapabilities) {
      return global.ProjectMapDesktopCapabilities;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('./desktop_capabilities.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function previewMessageBus() {
    if (global && global.ProjectMapPreviewMessageBus) {
      return global.ProjectMapPreviewMessageBus;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('../authoring/preview_message_bus.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function focusFromCanvas(projectIndex, model, selectedKey) {
    const parsed = parseSelectedKey(selectedKey);
    const sceneId = parsed && parsed.kind !== 'draft' ? parsed.id : model && model.objectId || '';
    const scene = sceneById(projectIndex, sceneId);
    const source = sourceRef(scene && (scene.sourceSpan || scene.source || scene) || model && model.source);
    const sourceScene = scene || sceneByPath(projectIndex, source && source.path);
    const kind = focusKind(parsed, model, sourceScene);
    const id = sceneId || model && model.objectId || '';
    const targetSceneId = firstNonEmpty(sourceScene && sourceScene.id, kind !== 'card' ? id : '', model && model.objectId);
    return {
      kind,
      id,
      sceneId: targetSceneId,
      targetSceneId,
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

  function focusFromCardBoard(projectIndex, model, boardOrOptions) {
    const board = cardBoard(projectIndex, model, boardOrOptions);
    const selectedObject = board && board.selectedObject || {};
    const card = selectedObject.card || board && board.selected || null;
    if (selectedObject.kind === 'option') {
      return focusFromCardOption(selectedObject, card);
    }
    if (selectedObject.kind === 'route') {
      return focusFromHandRoute(projectIndex, selectedObject, board);
    }
    if (selectedObject.kind === 'lane') {
      return focusFromBoardLane(projectIndex, selectedObject, board);
    }
    if (selectedObject.kind === 'intent') {
      return focusFromBoardIntent(projectIndex, selectedObject, board);
    }
    return focusFromCard(card, board);
  }

  function renderPanel(options) {
    const opts = options || {};
    const focus = opts.focus || {};
    const session = opts.session || null;
    const sessionFocusKey = String(opts.sessionFocusKey || session && session.focus && focusKey(session.focus.kind, session.focus.id) || '');
    const currentFocusKey = String(focus.key || focusKey(focus.kind, focus.id));
    const suspended = opts.status === 'suspended';
    const focusStale = Boolean(session && session.ok && sessionFocusKey && sessionFocusKey !== currentFocusKey);
    const draftStale = Boolean(session && session.ok && opts.sessionDraftKey && opts.currentDraftKey && opts.sessionDraftKey !== opts.currentDraftKey);
    const stale = !suspended && (focusStale || draftStale || opts.status === 'stale');
    const status = suspended ? 'suspended' : stale ? 'stale' : opts.status || session && session.status || 'idle';
    const desktop = desktopCapabilities();
    const isDesktop = Boolean(desktop && desktop.canCreateRuntimeLens(global));
    const url = String(session && (session.lensUrl || session.lensPageUrl || session.externalUrl) || '');
    const canFocus = Boolean(isDesktop && focus && focus.id && focus.kind !== 'unknown');
    const classes = [
      'runtime-lens-panel',
      opts.expanded ? 'is-expanded' : '',
      opts.collapsed ? 'is-collapsed' : '',
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
      '<button type="button" data-runtime-lens-action="create" ' + (!canFocus || status === 'building' ? 'disabled' : '') + '>' + escapeHtml(session && session.ok ? t('runtimeLens.refreshQuick', 'Refresh quick') : t('runtimeLens.createQuick', 'Quick Lens')) + '</button>',
      '<button type="button" data-runtime-lens-action="rebuild" ' + (!canFocus || status === 'building' ? 'disabled' : '') + '>' + escapeHtml(t('runtimeLens.rebuildFull', 'Full Build')) + '</button>',
      session && session.ok ? '<button type="button" data-runtime-lens-action="reset">' + escapeHtml(t('runtimeLens.reset', 'Reset')) + '</button>' : '',
      '<button type="button" data-runtime-lens-action="toggle_collapse">' + escapeHtml(opts.collapsed ? t('runtimeLens.restore', 'Restore') : t('runtimeLens.collapse', 'Collapse')) + '</button>',
      '<button type="button" data-runtime-lens-action="toggle_expand">' + escapeHtml(opts.expanded ? t('runtimeLens.dock', 'Dock') : t('runtimeLens.expand', 'Expand')) + '</button>',
      url ? '<button type="button" data-runtime-lens-action="open_external">' + escapeHtml(t('runtimeLens.openExternal', 'Open')) + '</button>' : '',
      session ? '<button type="button" data-runtime-lens-action="clear">' + escapeHtml(t('runtimeLens.clear', 'Clear')) + '</button>' : '',
      '</div>',
      '</header>',
      renderSummary(focus, status, {isDesktop, stale, draftStale, canFocus, snapshot: session && session.runtimeSnapshot, domMap: session && session.runtimeDomMap, visualSurface: session && session.runtimeVisualSurface}),
      opts.collapsed ? '' : renderBody({url, status, isDesktop, canFocus, session}),
      '</section>'
    ].join('');
  }

  function renderSummary(focus, status, options) {
    const opts = options || {};
    const value = focus || {};
    const focusTitle = displayFocusTitle(value);
    const targetTitle = displayCompactLabel([value.kind, value.id].filter(Boolean).join(' / '));
    const message = !opts.isDesktop
      ? t('runtimeLens.browserOnly', 'Focused Runtime Lens is available in the desktop app because it builds a temporary runtime sandbox.')
      : !opts.canFocus
        ? t('runtimeLens.unsupportedFocus', 'Select a source-backed object or UI region to focus it in runtime.')
        : opts.stale
          ? opts.draftStale
            ? t('runtimeLens.draftStale', 'Lens is behind the current edit. Refresh or rebuild it to observe the latest draft.')
            : t('runtimeLens.stale', 'Lens is showing a previous selection. Refresh to rebuild around this object.')
          : opts.snapshot
            ? snapshotSummaryText(opts.snapshot)
            : statusText(status);
    return [
      '<div class="runtime-lens-summary">',
      '<div><span>' + escapeHtml(t('runtimeLens.focus', 'Focus')) + '</span><strong title="' + escapeAttr(focusTitle.raw) + '">' + escapeHtml(focusTitle.display) + '</strong></div>',
      '<div><span>' + escapeHtml(t('runtimeLens.target', 'Target')) + '</span><strong title="' + escapeAttr(targetTitle.raw) + '">' + escapeHtml(targetTitle.display) + '</strong></div>',
      '<p data-runtime-lens-message="true">' + escapeHtml(message) + '</p>',
      renderFocusProof(value),
      '</div>'
    ].join('');
  }

  function renderFocusProof(focus) {
    const proof = focus && focus.proof || null;
    if (!proof || typeof proof !== 'object') {
      return '';
    }
    const rows = [];
    if (proof.kind === 'deck_pool') {
      rows.push(t('runtimeLens.proof.deckPool', 'Deck proof'));
      rows.push(ensureArray(proof.routeTags).map((tag) => '#' + tag).join(', ') || t('cardBoard.inspector.none', 'None'));
      rows.push(String(ensureArray(proof.memberCardIds).length) + ' cards');
    } else if (proof.kind === 'advisor_controller') {
      rows.push(t('runtimeLens.proof.advisorController', 'Advisor proof'));
      rows.push(String(ensureArray(proof.variables).length) + ' variables');
      rows.push(proof.pinnedEntryId || t('cardBoard.inspector.none', 'None'));
    }
    if (!rows.length) {
      return '';
    }
    return '<div class="runtime-lens-proof" data-runtime-lens-proof="' + escapeAttr(proof.kind || '') + '">' + rows.map((row) => '<span>' + escapeHtml(row) + '</span>').join('') + '</div>';
  }

  function renderBody(options) {
    const opts = options || {};
    if (opts.status === 'building') {
      return wrapBody('<div class="runtime-lens-empty">' + escapeHtml(t('runtimeLens.building', 'Building a temporary runtime lens...')) + '</div>');
    }
    if (opts.status === 'suspended') {
      return wrapBody('<div class="runtime-lens-empty">' + escapeHtml(t('runtimeLens.suspended', 'Lens is suspended while this workspace is in the background. Refresh to reload it.')) + '</div>' + renderDiagnostics(opts.session && opts.session.diagnostics));
    }
    if (opts.url && opts.status !== 'failed') {
      return wrapBody([
        '<div class="runtime-lens-preview-shell">',
        '<div class="runtime-lens-frame-wrap" data-runtime-lens-frame-wrap="true">',
        '<iframe class="runtime-lens-frame" data-runtime-lens-frame="true" title="' + escapeAttr(t('runtimeLens.frameTitle', 'Focused runtime preview')) + '" src="' + escapeAttr(opts.url) + '"></iframe>',
        '</div>',
        '<div class="runtime-lens-resize-grip" data-runtime-lens-resize-grip="true" role="separator" aria-orientation="horizontal" tabindex="0"></div>',
        '</div>',
        renderRuntimeEvidence(opts.session)
      ].join(''));
    }
    return wrapBody('<div class="runtime-lens-empty">' + escapeHtml(opts.isDesktop ? t('runtimeLens.empty', 'Open a Quick Lens to observe this object in the latest generated runtime.') : t('runtimeLens.browserOnlyShort', 'Desktop app required.')) + '</div>' + renderRuntimeEvidence(opts.session));
  }

  function wrapBody(content) {
    return '<div class="runtime-lens-body">' + content + '</div>';
  }

  function renderRuntimeEvidence(session) {
    const value = session && typeof session === 'object' ? session : {};
    const content = [
      renderRuntimeSnapshot(value.runtimeSnapshot),
      renderRuntimeDomMap(value.runtimeDomMap || value.runtimeSnapshot && value.runtimeSnapshot.runtimeDomMap),
      renderRuntimeVisualSurface(value.runtimeVisualSurface),
      renderTimings(value.timings),
      renderDiagnostics(value.diagnostics)
    ].join('');
    if (!content) {
      return '';
    }
    return [
      '<details class="runtime-lens-evidence" data-runtime-lens-evidence="true">',
      '<summary><strong>' + escapeHtml(t('runtimeLens.evidence', 'Runtime evidence')) + '</strong> ' + escapeHtml(runtimeEvidenceSummary(value)) + '</summary>',
      '<div class="runtime-lens-evidence-body">',
      content,
      '</div>',
      '</details>'
    ].join('');
  }

  function runtimeEvidenceSummary(session) {
    const snapshot = session && session.runtimeSnapshot || {};
    const snapshotSummary = snapshot.summary || {};
    const domMap = session && (session.runtimeDomMap || snapshot.runtimeDomMap) || {};
    const domSummary = domMap.summary || {};
    const visualSurface = session && session.runtimeVisualSurface || {};
    const visualSummary = visualSurface.summary || {};
    const parts = [];
    if (snapshot.status) {
      parts.push(String(snapshot.status));
    }
    if (snapshotSummary.indexedRegionCount !== undefined || snapshotSummary.visibleRegionCount !== undefined) {
      parts.push('Regions ' + Number(snapshotSummary.visibleRegionCount || 0) + '/' + Number(snapshotSummary.indexedRegionCount || 0));
    }
    if (snapshotSummary.choiceCount !== undefined) {
      parts.push('Choices ' + Number(snapshotSummary.choiceCount || 0));
    }
    if (domSummary.visibleCount !== undefined || domSummary.mappedCount !== undefined) {
      parts.push('Map ' + Number(domSummary.mappedCount || 0) + '/' + Number(domSummary.visibleCount || 0));
    }
    if (visualSummary.draftableCount !== undefined || visualSummary.manualReviewCount !== undefined) {
      parts.push('Visual ' + Number(visualSummary.draftableCount || 0) + '/' + Number(visualSummary.manualReviewCount || 0));
    }
    if (session && session.timings && session.timings.totalMs !== undefined) {
      parts.push(formatMs(session.timings.totalMs));
    }
    return parts.length ? '· ' + parts.join(' · ') : '';
  }

  function renderRuntimeSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      return '';
    }
    const summary = snapshot.summary || {};
    const graphics = snapshot.graphics || {};
    const diagnostics = ensureArray(snapshot.diagnostics).filter((diag) => diag && diag.severity !== 'info').slice(0, 3);
    const status = String(snapshot.status || 'partial');
    return [
      '<div class="runtime-lens-health" data-runtime-lens-snapshot-status="' + escapeAttr(status) + '">',
      '<strong>' + escapeHtml(t('runtimeLens.health', 'Runtime health')) + ' - ' + escapeHtml(status) + '</strong>',
      '<span>' + escapeHtml('Loaded: ' + (summary.loaded ? 'yes' : 'no')) + '</span>',
      '<span>' + escapeHtml('Focused: ' + (summary.sceneId || 'unknown')) + '</span>',
      '<span>' + escapeHtml('Regions: ' + Number(summary.visibleRegionCount || 0) + '/' + Number(summary.indexedRegionCount || 0)) + '</span>',
      '<span>' + escapeHtml('Choices: ' + Number(summary.choiceCount || 0)) + '</span>',
      '<span>' + escapeHtml('Graphics: ' + (Number(graphics.svgCount || 0) + Number(graphics.canvasCount || 0)) + (graphics.d3Present ? ' + D3' : '')) + '</span>',
      diagnostics.length ? '<p>' + diagnostics.map((diag) => escapeHtml(diag.message || diag.code || '')).join('<br>') + '</p>' : '',
      '</div>'
    ].join('');
  }

  function renderRuntimeDomMap(domMap) {
    if (!domMap || typeof domMap !== 'object') {
      return '';
    }
    const summary = domMap.summary || {};
    const diagnostics = ensureArray(domMap.diagnostics).filter((diag) => diag && diag.severity !== 'info').slice(0, 3);
    const items = ensureArray(domMap.items).slice(0, 8);
    const status = String(domMap.status || 'partial');
    return [
      '<details class="runtime-lens-dom-map" data-runtime-lens-dom-map-status="' + escapeAttr(status) + '" open>',
      '<summary><strong>' + escapeHtml(t('runtimeLens.domMap', 'DOM source map')) + ' - ' + escapeHtml(status) + '</strong> ' +
        escapeHtml('Mapped ' + Number(summary.mappedCount || 0) + '/' + Number(summary.visibleCount || 0) + ', source-backed ' + Number(summary.sourceBackedCount || 0) + ', manual review ' + Number(summary.manualReviewCount || 0)) + '</summary>',
      diagnostics.length ? '<p>' + diagnostics.map((diag) => escapeHtml(diag.message || diag.code || '')).join('<br>') + '</p>' : '',
      items.length ? '<ol>' + items.map(renderDomMapItem).join('') + '</ol>' : '',
      '</details>'
    ].join('');
  }

  function renderDomMapItem(item) {
    const source = item && item.source || {};
    const sourceLabel = source.path ? source.path + (source.line || source.startLine ? ':' + (source.line || source.startLine) : '') : t('runtimeLens.manualReview', 'manual review');
    const label = item && (item.text || fileName(item.src) || item.selector || item.role) || '';
    const meta = [item && item.role, item && item.confidence, item && item.editability].filter(Boolean).join(' · ');
    return '<li><span>' + escapeHtml(meta) + '</span><strong>' + escapeHtml(label) + '</strong><small>' + escapeHtml(sourceLabel) + '</small></li>';
  }

  function renderRuntimeVisualSurface(visualSurface) {
    if (!visualSurface || typeof visualSurface !== 'object') {
      return '';
    }
    const summary = visualSurface.summary || {};
    const diagnostics = ensureArray(visualSurface.diagnostics).filter((diag) => diag && diag.severity !== 'info').slice(0, 3);
    const candidates = ensureArray(visualSurface.candidates).slice(0, 8);
    const status = String(visualSurface.status || 'partial');
    return [
      '<details class="runtime-lens-visual-surface" data-runtime-lens-visual-surface-status="' + escapeAttr(status) + '" open>',
      '<summary><strong>' + escapeHtml(t('runtimeLens.visualSurface', 'Editable visual surfaces')) + ' - ' + escapeHtml(status) + '</strong> ' +
        escapeHtml(Number(summary.draftableCount || 0) + ' draftable, ' + Number(summary.proposalOnlyCount || 0) + ' proposal-only, ' + Number(summary.manualReviewCount || 0) + ' manual review, ' + Number(summary.generatedOnlyCount || 0) + ' generated-only') + '</summary>',
      diagnostics.length ? '<p>' + diagnostics.map((diag) => escapeHtml(diag.message || diag.code || '')).join('<br>') + '</p>' : '',
      candidates.length ? '<ol>' + candidates.map(renderVisualSurfaceCandidate).join('') + '</ol>' : '',
      '</details>'
    ].join('');
  }

  function renderVisualSurfaceCandidate(candidate) {
    const source = candidate && candidate.source || {};
    const actions = ensureArray(candidate && candidate.actions).length ? ensureArray(candidate && candidate.actions) : [candidate && candidate.action || {}];
    const sourceLabel = source.path ? source.path + (source.line || source.startLine ? ':' + (source.line || source.startLine) : '') : t('runtimeLens.manualReview', 'manual review');
    const label = candidate && (candidate.label || candidate.currentValue || fileName(candidate.src) || candidate.role) || '';
    const meta = [candidate && candidate.role, candidate && candidate.confidence, candidate && candidate.editability, candidate && candidate.routeClass].filter(Boolean).join(' · ');
    const assetMeta = [candidate && candidate.assetDirective, candidate && candidate.assetDraftStatus, candidate && candidate.replacementTargetPath].filter(Boolean).join(' · ');
    const buttons = actions
      .filter((action) => action && action.enabled === true && (action.type === 'open_route' || action.type === 'create_asset_reference_draft'))
      .map((action) => '<button type="button" data-runtime-visual-action="' + escapeAttr(action.type || '') + '" data-runtime-visual-candidate="' + escapeAttr(candidate.id || '') + '">' + escapeHtml(action.label || actionLabel(action.type)) + '</button>')
      .join('');
    return '<li><span>' + escapeHtml(meta) + '</span><strong>' + escapeHtml(label) + '</strong><small>' + escapeHtml(sourceLabel) + '</small>' +
      (assetMeta ? '<small>' + escapeHtml(assetMeta) + '</small>' : '') +
      (candidate && candidate.reason ? '<small>' + escapeHtml(candidate.reason) + '</small>' : '') + buttons + '</li>';
  }

  function actionLabel(type) {
    if (type === 'create_asset_reference_draft') {
      return t('runtimeLens.createAssetDraft', 'Create asset draft');
    }
    return t('runtimeLens.openRoute', 'Open route');
  }

  function snapshotSummaryText(snapshot) {
    const status = String(snapshot && snapshot.status || '');
    const summary = snapshot && snapshot.summary || {};
    if (status === 'blocked') {
      const diag = ensureArray(snapshot && snapshot.diagnostics).find((item) => item && item.severity === 'error');
      return (diag && (diag.message || diag.code)) || t('runtimeLens.blocked', 'Runtime Lens is blocked by incomplete generated runtime files.');
    }
    if (status === 'partial') {
      return 'Partial runtime snapshot: ' + Number(summary.visibleRegionCount || 0) + '/' + Number(summary.indexedRegionCount || 0) + ' regions visible, ' + Number(summary.choiceCount || 0) + ' choices rendered.';
    }
    if (status === 'failed') {
      return t('runtimeLens.snapshotFailed', 'Runtime snapshot could not verify the loaded game page.');
    }
    return 'Runtime loaded, ' + Number(summary.visibleRegionCount || 0) + '/' + Number(summary.indexedRegionCount || 0) + ' regions visible, ' + Number(summary.choiceCount || 0) + ' choices rendered.';
  }

  function fileName(value) {
    const parts = String(value || '').split(/[/?#]/);
    return parts[parts.length - 1] || '';
  }

  function renderTimings(timings) {
    const stages = ensureArray(timings && timings.stages).filter((item) => item && item.stage);
    if (!stages.length) {
      return '';
    }
    return [
      '<details class="runtime-lens-diagnostics">',
      '<summary>' + escapeHtml(t('runtimeLens.timings', 'Timings')) + ' · ' + escapeHtml(formatMs(timings.totalMs)) + '</summary>',
      stages.slice(0, 8).map((item) => '<p>' + escapeHtml(item.stage) + ' · ' + escapeHtml(formatMs(item.ms)) + '</p>').join(''),
      '</details>'
    ].join('');
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

  function formatMs(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) {
      return '0ms';
    }
    if (number >= 1000) {
      return (number / 1000).toFixed(number >= 10000 ? 0 : 1) + 's';
    }
    return Math.round(number) + 'ms';
  }

  function displayFocusTitle(focus) {
    return displayCompactLabel(firstNonEmpty(focus && focus.title, focus && focus.id));
  }

  function displayCompactLabel(value) {
    const raw = String(value || '');
    const display = compactDendryInlineLabel(raw) || raw.trim();
    return {
      raw,
      display: display || raw
    };
  }

  function compactDendryInlineLabel(value) {
    const raw = String(value || '');
    if (!raw) {
      return '';
    }
    const conditionalPattern = /\[\?\s*if\s+[^:]+:\s*([\s\S]*?)\?\]/g;
    const matches = [];
    let match;
    while ((match = conditionalPattern.exec(raw)) !== null) {
      matches.push({index: match.index, text: cleanDisplayLabel(match[1]), raw: match[0]});
    }
    if (matches.length) {
      const first = matches[0];
      const last = matches[matches.length - 1];
      const before = raw.slice(0, first.index);
      const after = raw.slice(last.index + last.raw.length);
      const onlyAdjacentConditionals = !cleanDisplayLabel(before) && matches.every((item, index) => {
        if (index === 0) {
          return true;
        }
        const previous = matches[index - 1];
        return !cleanDisplayLabel(raw.slice(previous.index + previous.raw.length, item.index));
      });
      const unique = uniqueNonEmpty(matches.map((item) => item.text));
      if (onlyAdjacentConditionals && unique.length > 1) {
        return cleanDisplayLabel([unique.join(' / '), after].filter(Boolean).join(' '));
      }
      return cleanDisplayLabel(raw.replace(conditionalPattern, (_token, body) => ' ' + cleanDisplayLabel(body) + ' '));
    }
    return cleanDisplayLabel(raw);
  }

  function cleanDisplayLabel(value) {
    return String(value || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\*\*/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function uniqueNonEmpty(values) {
    const seen = new Set();
    const result = [];
    ensureArray(values).forEach((value) => {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      result.push(text);
    });
    return result;
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
        if (button.dataset.runtimeLensAction === 'reset') {
          const panel = button.closest && button.closest('[data-runtime-lens-panel]');
          const frame = panel && panel.querySelector && panel.querySelector('[data-runtime-lens-frame]');
          if (frame && frame.contentWindow) {
            const bus = previewMessageBus();
            const message = bus && typeof bus.buildRuntimeLensAction === 'function'
              ? bus.buildRuntimeLensAction('reset')
              : {kind: 'dms-runtime-lens-action', action: 'reset'};
            const targetOrigin = bus && typeof bus.getPostMessageTargetOrigin === 'function'
              ? bus.getPostMessageTargetOrigin(frame.getAttribute('src') || frame.src || '')
              : '*';
            frame.contentWindow.postMessage(message, targetOrigin);
          }
        }
        if (opts.onAction) {
          opts.onAction(button.dataset.runtimeLensAction || '', button);
        }
      });
    });
    root.querySelectorAll('[data-runtime-visual-action]').forEach((button) => {
      if (button.dataset.runtimeVisualBound === 'true') {
        return;
      }
      button.dataset.runtimeVisualBound = 'true';
      button.addEventListener('click', () => {
        if (opts.onVisualAction) {
          opts.onVisualAction(button.dataset.runtimeVisualAction || '', button.dataset.runtimeVisualCandidate || '', button);
        } else if (opts.onAction) {
          opts.onAction(button.dataset.runtimeVisualAction || '', button);
        }
      });
    });
    root.querySelectorAll('[data-runtime-lens-resize-grip]').forEach((grip) => {
      if (grip.dataset.runtimeLensResizeBound === 'true') {
        return;
      }
      grip.dataset.runtimeLensResizeBound = 'true';
      grip.addEventListener('pointerdown', (event) => {
        const wrap = resizeWrapForGrip(grip);
        if (!wrap) {
          return;
        }
        const pointerId = event.pointerId;
        const startY = event.clientY;
        const startHeight = wrap.getBoundingClientRect().height;
        const onMove = (moveEvent) => {
          setRuntimeFrameHeight(wrap, startHeight + moveEvent.clientY - startY);
        };
        const onEnd = () => {
          try {
            grip.releasePointerCapture(pointerId);
          } catch (_err) {
            // Pointer capture can already be gone if the browser cancels the drag.
          }
          grip.removeEventListener('pointermove', onMove);
          grip.removeEventListener('pointerup', onEnd);
          grip.removeEventListener('pointercancel', onEnd);
        };
        event.preventDefault();
        try {
          grip.setPointerCapture(pointerId);
        } catch (_err) {
          return;
        }
        grip.addEventListener('pointermove', onMove);
        grip.addEventListener('pointerup', onEnd);
        grip.addEventListener('pointercancel', onEnd);
      });
      grip.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
          return;
        }
        const wrap = resizeWrapForGrip(grip);
        if (!wrap) {
          return;
        }
        const step = event.shiftKey ? 80 : 32;
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        event.preventDefault();
        setRuntimeFrameHeight(wrap, wrap.getBoundingClientRect().height + direction * step);
      });
    });
  }

  function resizeWrapForGrip(grip) {
    const shell = grip && grip.closest && grip.closest('.runtime-lens-preview-shell');
    return shell && shell.querySelector && shell.querySelector('[data-runtime-lens-frame-wrap]');
  }

  function setRuntimeFrameHeight(wrap, value) {
    const viewport = global && Number(global.innerHeight) || 900;
    const max = Math.max(360, viewport - 140);
    const height = Math.max(240, Math.min(max, Number(value) || 0));
    wrap.style.height = Math.round(height) + 'px';
  }

  function statusText(status) {
    return {
      idle: t('runtimeLens.idle', 'Ready to create a focused runtime lens.'),
      building: t('runtimeLens.building', 'Building a temporary runtime lens...'),
      ready: t('runtimeLens.ready', 'Lens is ready.'),
      partial: t('runtimeLens.partial', 'Lens loaded with runtime snapshot warnings.'),
      blocked: t('runtimeLens.blocked', 'Runtime Lens is blocked by incomplete generated runtime files.'),
      stale: t('runtimeLens.stale', 'Lens is behind the current edit.'),
      suspended: t('runtimeLens.suspended', 'Lens is suspended while this workspace is in the background. Refresh to reload it.'),
      failed: t('runtimeLens.failed', 'Lens could not be created.'),
      unavailable: t('runtimeLens.browserOnlyShort', 'Desktop app required.')
    }[status] || String(status || '');
  }

  function parseSelectedKey(key) {
    const match = String(key || '').match(/^(scene|event|card|advisor|news|route|deck|surface|text|draft):(.+)$/);
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
    if (kind === 'deck') {
      return 'deck';
    }
    if (kind === 'route') {
      return 'route';
    }
    if (kind === 'scene') {
      return sceneKind(scene);
    }
    if (kind === 'surface' || kind === 'text') {
      return 'text_replacement';
    }
    const modelKind = String(model && (model.objectKind || model.template) || '').toLowerCase();
    if (modelKind === 'card' || scene && (scene.type === 'card' || scene.flags && scene.flags.isCard)) {
      return 'card';
    }
    if (modelKind === 'news') {
      return 'news';
    }
    if (modelKind === 'surface_text' || modelKind === 'surface' || modelKind === 'text') {
      return 'text_replacement';
    }
    if (scene) {
      return sceneKind(scene);
    }
    return 'event';
  }

  function sceneKind(scene) {
    const type = String(scene && scene.type || '').toLowerCase();
    if (type === 'card' || scene && scene.flags && scene.flags.isCard) {
      return 'card';
    }
    if (type === 'news' || type === 'news_item') {
      return 'news';
    }
    if (type === 'hand') {
      return 'hand';
    }
    if (type === 'deck') {
      return 'deck';
    }
    if (type === 'route') {
      return 'route';
    }
    return type === 'event' || type === 'world_event' ? 'event' : 'scene';
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

  function focusFromCardOption(selectedObject, card) {
    const option = selectedObject && selectedObject.option || {};
    const parent = card || selectedObject && selectedObject.card || null;
    const cardId = parent && parent.id || cardIdFromKey(selectedObject && selectedObject.cardKey);
    const optionIndex = Number(selectedObject && selectedObject.optionIndex || option.index || 0);
    return {
      kind: 'card_option',
      id: [cardId, optionIndex].filter((part) => part !== '').join(':'),
      cardId,
      targetSceneId: cardId,
      optionIndex,
      title: firstNonEmpty(parent && parent.title, parent && parent.heading, cardId) + ' / ' + firstNonEmpty(option.label, option.id, 'Option ' + (optionIndex + 1)),
      source: sourceRef(option.source || parent && parent.source || {}),
      key: focusKey('card_option', [(parent && parent.key) || cardId, optionIndex].join(':'))
    };
  }

  function focusFromHandRoute(projectIndex, selectedObject) {
    const route = selectedObject && selectedObject.route || {};
    const linkedCardKey = ensureArray(route.linkedCardKeys)[0] || '';
    const linkedCardId = cardIdFromKey(linkedCardKey);
    const directScene = route.targetKind === 'scene' ? route.targetId : '';
    const fallbackHand = firstSemanticId(projectIndex, 'hands') || sceneIdByType(projectIndex, ['hand', 'main']);
    const targetSceneId = directScene || linkedCardId || fallbackHand;
    return {
      kind: 'hand',
      id: route.key || selectedObject && selectedObject.key || targetSceneId,
      targetSceneId,
      title: firstNonEmpty(route.title, selectedObject && selectedObject.title, 'Hand route'),
      source: sourceRef(route.source || {}),
      key: focusKey('hand', route.key || targetSceneId)
    };
  }

  function focusFromBoardLane(projectIndex, selectedObject, board) {
    const lane = selectedObject && selectedObject.lane || {};
    const laneKey = String(selectedObject && selectedObject.laneKey || lane.key || '');
    if (lane.deckPool) {
      const pool = lane.deckPool;
      const memberIds = ensureArray(pool.memberCardIds);
      const targetSceneId = firstNonEmpty(pool.ownerSceneId, memberIds[0]);
      return {
        kind: 'deck_pool',
        id: String(pool.id || laneKey),
        targetSceneId,
        title: laneTitle(lane, pool.label || pool.id || 'Deck pool'),
        source: sourceRef(pool.sourceAnchor || {}),
        proof: {kind: 'deck_pool', routeTags: ensureArray(pool.routeTags), memberCardIds: memberIds, launcherRoutes: ensureArray(pool.launcherRoutes)},
        key: focusKey('deck_pool', 'lane:' + laneKey + ':' + String(pool.id || ''))
      };
    }
    if (lane.advisorController) {
      const controller = lane.advisorController;
      return {
        kind: 'advisor_controller',
        id: String(controller.id || laneKey),
        targetSceneId: firstNonEmpty(controller.controllerSceneId, controller.id),
        title: laneTitle(lane, controller.title || controller.id || 'Advisor controller'),
        source: sourceRef(controller.sourceAnchor || {}),
        proof: {kind: 'advisor_controller', pinnedEntryId: controller.pinnedEntry && controller.pinnedEntry.id || '', variables: ensureArray(controller.roster).map((item) => item && item.activeVariable).filter(Boolean), rosterItemCount: ensureArray(controller.roster).length},
        key: focusKey('advisor_controller', 'lane:' + laneKey + ':' + String(controller.id || ''))
      };
    }
    if (laneKey === 'hand') {
      const handId = firstSemanticId(projectIndex, 'hands') || sceneIdByType(projectIndex, ['hand', 'main']);
      return handId ? {
        kind: 'hand',
        id: handId,
        targetSceneId: handId,
        title: laneTitle(lane, 'Hand'),
        source: sceneSource(projectIndex, handId),
        key: focusKey('hand', 'lane:' + laneKey + ':' + handId)
      } : unknownFocus(laneTitle(lane, 'Hand'), 'lane:' + laneKey);
    }
    const firstCard = ensureArray(lane.cards).find((item) => item && (item.kind === 'card' || item.kind === 'advisor')) || null;
    if (firstCard) {
      const focus = focusFromCard(firstCard, board);
      focus.key = focusKey('card', 'lane:' + laneKey + ':' + firstCard.key);
      focus.title = laneTitle(lane, focus.title);
      return focus;
    }
    const deckId = laneKey === 'deck' ? firstSemanticId(projectIndex, 'decks') || sceneIdByType(projectIndex, ['deck']) : '';
    if (deckId) {
      return {
        kind: 'hand',
        id: deckId,
        targetSceneId: deckId,
        title: laneTitle(lane, 'Deck'),
        source: sceneSource(projectIndex, deckId),
        key: focusKey('hand', 'lane:' + laneKey + ':' + deckId)
      };
    }
    return unknownFocus(laneTitle(lane, laneKey), 'lane:' + laneKey);
  }

  function focusFromBoardIntent(projectIndex, selectedObject, board) {
    const intent = selectedObject && selectedObject.intent || {};
    const card = selectedObject && selectedObject.card || cardByKeyInBoard(board, intent.itemKey);
    if (card) {
      const focus = focusFromCard(card, board);
      focus.key = focusKey('card', 'intent:' + card.key + ':' + String(intent.laneKey || ''));
      focus.title = firstNonEmpty(intent.itemTitle, focus.title);
      return focus;
    }
    return focusFromBoardLane(projectIndex, {kind: 'lane', laneKey: intent.laneKey, lane: laneByKey(board, intent.laneKey)}, board);
  }

  function focusFromCard(card) {
    const value = card || {};
    const cardId = String(value.id || cardIdFromKey(value.key) || '');
    if (!cardId) {
      return unknownFocus(value.title || value.heading || '', value.key || '');
    }
    return {
      kind: 'card',
      id: cardId,
      cardId,
      targetSceneId: cardId,
      title: firstNonEmpty(value.title, value.heading, cardId),
      source: sourceRef(value.source || {}),
      key: focusKey('card', cardId)
    };
  }

  function cardBoard(projectIndex, model, boardOrOptions) {
    if (boardOrOptions && boardOrOptions.kind === 'card_board_model') {
      return boardOrOptions;
    }
    const api = cardBoardModelApi();
    return api && typeof api.buildBoard === 'function'
      ? api.buildBoard(projectIndex, model || {}, boardOrOptions || {})
      : {kind: 'card_board_model', selectedObject: {}, selected: null, lanes: []};
  }

  function cardBoardModelApi() {
    if (global && global.ProjectMapCardBoardModel) {
      return global.ProjectMapCardBoardModel;
    }
    if (typeof require === 'function') {
      try {
        return require('../authoring/card_board_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function cardByKeyInBoard(board, key) {
    const target = String(key || '');
    for (const lane of ensureArray(board && board.lanes)) {
      const found = ensureArray(lane.cards).find((item) => item && item.key === target);
      if (found) {
        return found;
      }
    }
    return null;
  }

  function laneByKey(board, key) {
    return ensureArray(board && board.lanes).find((lane) => lane && lane.key === String(key || '')) || null;
  }

  function firstSemanticId(projectIndex, key) {
    const item = ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic[key])[0];
    return item && item.id || '';
  }

  function sceneSource(projectIndex, id) {
    const scene = sceneById(projectIndex, id);
    return sourceRef(scene && (scene.sourceSpan || scene.source || {path: scene.path}) || {});
  }

  function laneTitle(lane, fallback) {
    return firstNonEmpty(lane && lane.fallback, lane && lane.key, fallback);
  }

  function cardIdFromKey(key) {
    return String(key || '').replace(/^(card|advisor):/, '').replace(/^draft:card:/, '');
  }

  function unknownFocus(title, id) {
    return {
      kind: 'unknown',
      id: String(id || ''),
      title: String(title || ''),
      source: {},
      key: focusKey('unknown', id || title || '')
    };
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
    focusFromCardBoard,
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
