(function initProjectMapStoryboardWorkspaceState(global) {
  'use strict';

  const STORY_CARD_COLOR_BASE_KEY = 'dendry-mod-studio-storyboard-card-colors-v1';
  const STORY_PALETTE_PIN_BASE_KEY = 'dendry-mod-studio-story-palette-pins-v1';
  const STORY_PALETTE_RECENT_BASE_KEY = 'dendry-mod-studio-story-palette-recent-v1';
  const STORY_PALETTE_WIDTH_STORAGE_KEY = 'dendry-mod-studio-story-palette-width-v1';
  const STORY_PALETTE_CHROME_STORAGE_KEY = 'dendry-mod-studio-story-palette-chrome-collapsed-v1';

  let activeProjectHash = '';

  function simpleHash(value) {
    const text = String(value || '');
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      const ch = text.charCodeAt(index);
      hash = ((hash << 5) - hash) + ch;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  function scopedKey(baseKey) {
    return activeProjectHash ? baseKey + '.' + activeProjectHash : baseKey;
  }

  function setProjectId(projectId) {
    const id = String(projectId || '').trim();
    activeProjectHash = id ? simpleHash(id) : '';
  }
  const STORY_PALETTE_DEFAULT_WIDTH = 376;
  const STORY_PALETTE_MIN_WIDTH = 300;
  const STORY_PALETTE_MAX_WIDTH = 620;
  const STORY_PALETTE_DEFAULT_ROW_HEIGHT = 96;
  const STORY_PALETTE_MIN_ROW_HEIGHT = 56;
  const STORY_PALETTE_MAX_ROW_HEIGHT = 220;
  const STORY_PALETTE_CLOSE_MOTION_MS = 150;

  function reset(state) {
    state.storyboardView = 'timeline';
    state.storyCanvasCategory = 'story';
    state.storySearchQuery = '';
    state.storyScopeCollapsed = false;
    state.storyOverviewCollapsed = false;
    state.storyCardColors = readStoredCardColors();
    state.storyScopeMode = 'focus';
    state.storyScopeWindow = '';
    state.storyChainDepth = '1';
    state.storyPaletteOpen = false;
    state.storyPaletteQuery = '';
    state.storyPaletteType = 'all';
    state.storyPaletteScopeFilter = 'all';
    state.storyPaletteSelectedKey = '';
    state.storyPalettePinnedKeys = readStoredKeyList(scopedKey(STORY_PALETTE_PIN_BASE_KEY));
    state.storyPaletteRecentKeys = readStoredKeyList(scopedKey(STORY_PALETTE_RECENT_BASE_KEY));
    state.storyPaletteWidth = readStoredNumber(STORY_PALETTE_WIDTH_STORAGE_KEY, STORY_PALETTE_DEFAULT_WIDTH);
    state.storyPaletteChromeCollapsed = readStoredBool(STORY_PALETTE_CHROME_STORAGE_KEY, false);
    state.storyPaletteRowHeight = STORY_PALETTE_DEFAULT_ROW_HEIGHT;
    state.storyPaletteScrollOffset = 0;
    state.storyPaletteDropContext = null;
    // Card stacks (drag-to-snap): { anchorKey: { members: [key,...], collapsed: true } }
    state.storyCardStacks = {};
  }

  function surfaceOptions(state) {
    return {
      zoom: Number(state.canvasZoom || 1),
      view: state.storyboardView,
      storyCanvasCategory: state.storyCanvasCategory || 'story',
      storySearchQuery: state.storySearchQuery || '',
      storyScopeCollapsed: Boolean(state.storyScopeCollapsed),
      storyOverviewCollapsed: Boolean(state.storyOverviewCollapsed),
      storyCardColors: state.storyCardColors || readStoredCardColors(),
      storyScopeMode: state.storyScopeMode,
      storyScopeWindow: state.storyScopeWindow,
      storyChainDepth: state.storyChainDepth,
      storyPaletteOpen: state.storyPaletteOpen,
      storyPaletteQuery: state.storyPaletteQuery,
      storyPaletteType: state.storyPaletteType,
      storyPaletteScopeFilter: state.storyPaletteScopeFilter,
      storyPaletteSelectedKey: state.storyPaletteSelectedKey,
      storyPalettePinnedKeys: state.storyPalettePinnedKeys || readStoredKeyList(scopedKey(STORY_PALETTE_PIN_BASE_KEY)),
      storyPaletteRecentKeys: state.storyPaletteRecentKeys || readStoredKeyList(scopedKey(STORY_PALETTE_RECENT_BASE_KEY)),
      storyPaletteWidth: clampPaletteWidth(state.storyPaletteWidth || readStoredNumber(STORY_PALETTE_WIDTH_STORAGE_KEY, STORY_PALETTE_DEFAULT_WIDTH)),
      storyPaletteChromeCollapsed: state.storyPaletteChromeCollapsed === undefined ? readStoredBool(STORY_PALETTE_CHROME_STORAGE_KEY, false) : Boolean(state.storyPaletteChromeCollapsed),
      storyPaletteRowHeight: clampPaletteRowHeight(state.storyPaletteRowHeight || STORY_PALETTE_DEFAULT_ROW_HEIGHT),
      storyPaletteScrollOffset: state.storyPaletteScrollOffset || 0,
      storyPaletteDropContext: state.storyPaletteDropContext,
      runtimeLensSession: state.runtimeLensSession,
      runtimeLensStatus: state.runtimeLensStatus,
      runtimeLensFocusKey: state.runtimeLensFocusKey,
      runtimeLensDraftKey: state.runtimeLensDraftKey,
      runtimeLensCurrentDraftKey: state.runtimeLensCurrentDraftKey,
      runtimeLensExpanded: state.runtimeLensExpanded,
      runtimeLensCollapsed: state.runtimeLensCollapsed,
      boardChromeCollapsed: Boolean(state.boardChromeCollapsed),
      storyCardStacks: state.storyCardStacks || {}
    };
  }

  function renderStage(state, model) {
    const surface = global.ProjectMapContentStoryboardSurface;
    return surface && typeof surface.render === 'function'
      ? surface.render(model, Object.assign({
        projectIndex: state.projectIndex,
        selected: state.selectedCanvasNode,
        nodePositions: state.nodePositions || {},
        draftBranches: state.draftBranches || [],
        editorOverlay: state.editorOverlay
      }, surfaceOptions(state)))
      : '';
  }

  function setView(state, view, deps) {
    var v = String(view || '');
    var normalized = v === 'chain' ? 'chain' : 'timeline';
    return rebuild(state, deps, {storyboardView: normalized});
  }

  function handleAction(state, action, target, deps) {
    if (action === 'story_scope_focus') {
      return rebuild(state, deps, {storyScopeMode: 'focus'});
    }
    if (action === 'story_scope_expand') {
      return rebuild(state, deps, {storyScopeMode: 'expanded'});
    }
    if (action === 'story_scope_reset') {
      state.canvasPanX = 0;
      state.canvasPanY = 0;
      state.canvasZoom = 1;
      return rebuild(state, deps, {storyScopeMode: 'focus', storyScopeWindow: ''});
    }
    if (action === 'focus_story_scope') {
      const lane = target && target.dataset && (target.dataset.contentStoryboardScopeLane || target.dataset.contentStoryboardInsert) || '';
      return rebuild(state, deps, {storyScopeWindow: normalizeLane(lane), storyScopeMode: state.storyScopeMode || 'focus'});
    }
    if (action === 'set_chain_depth') {
      const depth = target && target.dataset && target.dataset.contentStoryboardDepth || '1';
      return rebuild(state, deps, {storyChainDepth: normalizeDepth(depth)});
    }
    if (action === 'set_story_canvas_category') {
      const category = normalizeCanvasCategory(target && target.dataset && target.dataset.storyboardCanvasCategory);
      return rebuild(state, deps, {
        storyCanvasCategory: category,
        storyScopeMode: category === 'story' ? (state.storyScopeMode || 'focus') : 'expanded'
      });
    }
    if (action === 'toggle_story_scope_panel') {
      return rebuild(state, deps, {storyScopeCollapsed: !state.storyScopeCollapsed});
    }
    if (action === 'toggle_story_overview_panel') {
      return rebuild(state, deps, {storyOverviewCollapsed: !state.storyOverviewCollapsed});
    }
    if (action === 'toggle_story_navigator') {
      // The merged timeline navigator collapses scope + overview as one unit.
      const collapsed = !(state.storyScopeCollapsed && state.storyOverviewCollapsed);
      return rebuild(state, deps, {storyScopeCollapsed: collapsed, storyOverviewCollapsed: collapsed});
    }
    if (action === 'set_story_card_color') {
      const key = target && target.dataset && target.dataset.storyboardCardColorKey || '';
      const color = target && target.dataset && target.dataset.storyboardCardColor || '';
      return setCardColor(state, key, color, deps);
    }
    if (action === 'toggle_story_palette') {
      return state.storyPaletteOpen
        ? closePaletteWithMotion(state, deps)
        : refreshPaletteOnly(state, deps, {storyPaletteOpen: true});
    }
    if (action === 'close_story_palette') {
      return closePaletteWithMotion(state, deps);
    }
    if (action === 'toggle_story_palette_chrome') {
      const collapsed = !state.storyPaletteChromeCollapsed;
      state.storyPaletteChromeCollapsed = collapsed;
      writeStoredBool(STORY_PALETTE_CHROME_STORAGE_KEY, collapsed);
      return refreshPaletteOnly(state, deps, {storyPaletteOpen: true, storyPaletteChromeCollapsed: collapsed});
    }
    if (action === 'set_story_palette_type') {
      const type = target && target.dataset && target.dataset.storyboardPaletteType || 'all';
      return refreshPaletteOnly(state, deps, {storyPaletteOpen: true, storyPaletteType: normalizePaletteType(type), storyPaletteScrollOffset: 0});
    }
    if (action === 'set_story_palette_scope') {
      const filter = target && target.dataset && target.dataset.storyboardPaletteScope || 'all';
      return refreshPaletteOnly(state, deps, {storyPaletteOpen: true, storyPaletteScopeFilter: normalizePaletteScopeFilter(filter), storyPaletteScrollOffset: 0});
    }
    if (action === 'open_story_palette_selection') {
      return openPaletteSelection(state, deps);
    }
    return false;
  }

  function setPaletteQuery(state, query, deps) {
    return refreshPaletteOnly(state, deps, {storyPaletteOpen: true, storyPaletteQuery: String(query || ''), storyPaletteScrollOffset: 0});
  }

  function setSearchQuery(state, query, deps) {
    return rebuild(state, deps, {storySearchQuery: normalizeSearchQuery(query)});
  }

  function bindPalette(root, state, deps) {
    if (state) {
      state.__storyPaletteRoot = root || null;
    }
    const query = root && root.querySelector && root.querySelector('[data-storyboard-palette-query]');
    if (query && query.dataset.storyboardPaletteQueryBound !== 'true') {
      query.dataset.storyboardPaletteQueryBound = 'true';
      query.addEventListener('input', () => {
        if (query.__dmsStoryboardPaletteQueryTimer) {
          clearTimeout(query.__dmsStoryboardPaletteQueryTimer);
        }
        query.__dmsStoryboardPaletteQueryTimer = setTimeout(() => {
          const value = query.value || '';
          const selection = {
            start: typeof query.selectionStart === 'number' ? query.selectionStart : String(value).length,
            end: typeof query.selectionEnd === 'number' ? query.selectionEnd : String(value).length
          };
          setPaletteQuery(state, value, deps);
          focusPaletteInput(root, value, selection);
        }, 120);
      });
    }
    const scroll = root && root.querySelector && root.querySelector('[data-storyboard-palette-scroll]');
    if (scroll && scroll.dataset.storyboardPaletteScrollBound !== 'true') {
      scroll.dataset.storyboardPaletteScrollBound = 'true';
      updatePaletteRowHeightEstimate(scroll, state);
      scroll.addEventListener('scroll', () => {
        if (scroll.__dmsStoryboardPaletteRestoringScroll) {
          return;
        }
        state.storyPaletteScrollOffset = Math.max(0, Number(scroll.scrollTop) || 0);
        updatePaletteRowHeightEstimate(scroll, state);
        schedulePaletteWindowRefresh(scroll, state, deps);
      });
      scroll.addEventListener('wheel', () => {
        if (scroll.__dmsStoryboardPaletteRestoringScroll) {
          return;
        }
        state.storyPaletteScrollOffset = Math.max(0, Number(scroll.scrollTop) || 0);
        schedulePaletteWindowRefresh(scroll, state, deps);
      }, {passive: true});
      if (state.storyPaletteScrollOffset && typeof scroll.scrollTop === 'number') {
        restorePaletteScroll(root, state.storyPaletteScrollOffset);
      }
    }
    const resizer = root && root.querySelector && root.querySelector('[data-storyboard-palette-resizer]');
    if (resizer && resizer.dataset.storyboardPaletteResizeBound !== 'true') {
      resizer.dataset.storyboardPaletteResizeBound = 'true';
      resizer.addEventListener('pointerdown', (event) => beginPaletteResize(event, root, state));
    }
    root && root.querySelectorAll && root.querySelectorAll('[data-storyboard-palette-item]').forEach((item) => {
      if (item.dataset.storyboardPaletteItemBound === 'true') {
        return;
      }
      item.dataset.storyboardPaletteItemBound = 'true';
      const select = () => selectPaletteItem(state, item.dataset.storyboardPaletteKey || '', deps);
      item.addEventListener('click', (event) => {
        if (event.target.closest && event.target.closest('button, input, textarea, select, a')) {
          return;
        }
        select();
      });
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select();
        }
      });
    });
    root && root.querySelectorAll && root.querySelectorAll('[data-storyboard-palette-pin]').forEach((button) => {
      if (button.dataset.storyboardPalettePinBound === 'true') {
        return;
      }
      button.dataset.storyboardPalettePinBound = 'true';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        togglePalettePin(state, button.dataset.storyboardPalettePin || '', deps);
      });
    });
    bindSearch(root, state, deps);
    bindColorPickers(root, state, deps);
  }

  function schedulePaletteWindowRefresh(scroll, state, deps) {
    if (!shouldRefreshPaletteWindow(scroll)) {
      return;
    }
    const atRenderedEdge = isPaletteAtRenderedWindowEdge(scroll);
    if (scroll.__dmsStoryboardPaletteScrollTimer) {
      if (atRenderedEdge) {
        return;
      }
      clearTimeout(scroll.__dmsStoryboardPaletteScrollTimer);
    }
    scroll.__dmsStoryboardPaletteScrollTimer = setTimeout(() => {
      scroll.__dmsStoryboardPaletteScrollTimer = null;
      refreshPaletteOnly(state, deps, {storyPaletteScrollOffset: state.storyPaletteScrollOffset || 0}, {preserveScroll: true});
    }, atRenderedEdge ? 70 : 140);
  }

  function shouldRefreshPaletteWindow(scroll) {
    if (!scroll || scroll.dataset.storyboardPaletteWindowEnabled !== 'true') {
      return false;
    }
    const rowHeight = Math.max(1, Number(scroll.dataset.storyboardPaletteRowHeight) || STORY_PALETTE_DEFAULT_ROW_HEIGHT);
    const start = Math.max(0, Number(scroll.dataset.storyboardPaletteWindowStart) || 0);
    const end = Math.max(start, Number(scroll.dataset.storyboardPaletteWindowEnd) || start);
    const total = Math.max(end, Number(scroll.dataset.storyboardPaletteWindowTotal) || end);
    const overscan = Math.max(2, Number(scroll.dataset.storyboardPaletteOverscan) || 8);
    const viewportHeight = Math.max(rowHeight, Number(scroll.clientHeight) || 560);
    const offset = Math.max(0, Number(scroll.scrollTop) || 0);
    const visibleStart = Math.floor(offset / rowHeight);
    const visibleEnd = Math.ceil((offset + viewportHeight) / rowHeight);
    const threshold = Math.max(2, Math.floor(overscan / 2));
    return start > 0 && visibleStart < start + threshold || end < total && visibleEnd > end - threshold;
  }

  function isPaletteAtRenderedWindowEdge(scroll) {
    if (!scroll || typeof scroll.scrollTop !== 'number') {
      return false;
    }
    const offset = Math.max(0, Number(scroll.scrollTop) || 0);
    const maxOffset = Math.max(0, Number(scroll.scrollHeight || 0) - Number(scroll.clientHeight || 0));
    return offset <= 4 || offset >= maxOffset - 4;
  }

  function updatePaletteRowHeightEstimate(scroll, state) {
    if (!scroll || !scroll.querySelectorAll || !state) {
      return;
    }
    const rows = Array.from(scroll.querySelectorAll('[data-storyboard-palette-item]')).slice(0, 12);
    const heights = rows.map((row) => {
      if (!row || typeof row.getBoundingClientRect !== 'function') {
        return 0;
      }
      const rect = row.getBoundingClientRect();
      return rect && Number.isFinite(rect.height) ? rect.height : 0;
    }).filter((height) => height >= 40);
    if (!heights.length) {
      return;
    }
    const average = heights.reduce((sum, height) => sum + height, 0) / heights.length;
    const next = clampPaletteRowHeight(Math.round(average + 8));
    if (Math.abs(next - (state.storyPaletteRowHeight || STORY_PALETTE_DEFAULT_ROW_HEIGHT)) >= 12) {
      state.storyPaletteRowHeight = next;
      scroll.dataset.storyboardPaletteRowHeight = String(next);
    }
  }

  function beginPaletteResize(event, root, state) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const resizer = event.currentTarget;
    const palette = root && root.querySelector && root.querySelector('[data-storyboard-palette]');
    const startWidth = clampPaletteWidth(state.storyPaletteWidth || readStoredNumber(STORY_PALETTE_WIDTH_STORAGE_KEY, STORY_PALETTE_DEFAULT_WIDTH));
    const resizeState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth
    };
    state.storyPaletteWidth = startWidth;
    if (palette) {
      palette.classList.add('is-resizing');
    }
    if (resizer) {
      resizer.classList.add('is-dragging');
      if (typeof resizer.setPointerCapture === 'function') {
        try {
          resizer.setPointerCapture(event.pointerId);
        } catch (_err) {
          // Document-level listeners keep resizing active if pointer capture is unavailable.
        }
      }
    }
    const doc = root && root.ownerDocument || global && global.document;
    const move = (moveEvent) => {
      if (!samePointer(moveEvent, resizeState.pointerId)) {
        return;
      }
      moveEvent.preventDefault();
      const nextWidth = clampPaletteWidth(resizeState.startWidth + (moveEvent.clientX - resizeState.startX));
      state.storyPaletteWidth = nextWidth;
      if (palette) {
        palette.style.setProperty('--storyboard-palette-width', nextWidth + 'px');
      }
    };
    const finish = (finishEvent) => {
      if (finishEvent && !samePointer(finishEvent, resizeState.pointerId)) {
        return;
      }
      if (doc) {
        doc.removeEventListener('pointermove', move);
        doc.removeEventListener('pointerup', finish);
        doc.removeEventListener('pointercancel', finish);
      }
      if (palette) {
        palette.classList.remove('is-resizing');
      }
      if (resizer) {
        resizer.classList.remove('is-dragging');
        if (finishEvent && typeof resizer.releasePointerCapture === 'function') {
          try {
            resizer.releasePointerCapture(finishEvent.pointerId);
          } catch (_err) {
            // Capture may already be released.
          }
        }
      }
      state.storyPaletteWidth = clampPaletteWidth(state.storyPaletteWidth || resizeState.startWidth);
      writeStoredNumber(STORY_PALETTE_WIDTH_STORAGE_KEY, state.storyPaletteWidth);
    };
    if (doc) {
      doc.addEventListener('pointermove', move);
      doc.addEventListener('pointerup', finish);
      doc.addEventListener('pointercancel', finish);
    }
  }

  function samePointer(event, pointerId) {
    return pointerId === undefined || event.pointerId === undefined || event.pointerId === pointerId;
  }

  function dropPaletteItem(state, payload, target, deps) {
    const itemKey = String(payload && payload.key || '').trim();
    if (!itemKey) {
      state.status = deps.t('objectCanvas.status.paletteDropUnsupported', 'This palette drop is not supported here.');
      deps.render();
      return false;
    }
    const context = dropContextFor(state, payload, target);
    const insertKey = context.insertKey;
    state.storyPaletteDropContext = context;
    if (insertKey && (context.targetKind === 'timeline_lane' || context.targetKind === 'timeline_insert' || context.targetKind === 'undated')) {
      state.storyScopeWindow = normalizeLane(insertKey);
    }
    const parsed = parseStoryObjectKey(itemKey);
    if (parsed && parsed.kind !== 'draft' && parsed.kind !== 'news') {
      const opened = selectObject(state, itemKey, deps);
      state.storyPaletteDropContext = context;
      if (opened) {
        state.status = deps.t('objectCanvas.status.paletteDropped', 'Palette item is now visible in this Storyboard context.');
        deps.render();
        return true;
      }
    }
    state.selectedCanvasNode = itemKey;
    state.status = deps.t('objectCanvas.status.paletteDropped', 'Palette item is now visible in this Storyboard context.');
    return rebuild(state, deps, {});
  }

  function bindSearch(root, state, deps) {
    const input = root && root.querySelector && root.querySelector('[data-content-storyboard-search]');
    if (!input || input.dataset.contentStoryboardSearchBound === 'true') {
      return;
    }
    input.dataset.contentStoryboardSearchBound = 'true';
    input.addEventListener('input', () => {
      if (input.__dmsStoryboardSearchTimer) {
        clearTimeout(input.__dmsStoryboardSearchTimer);
      }
      input.__dmsStoryboardSearchTimer = setTimeout(() => {
        const value = input.value || '';
        setSearchQuery(state, value, deps);
        focusSearchInput(root, value);
      }, 140);
    });
  }

  function focusSearchInput(root, value) {
    const next = root && root.querySelector && root.querySelector('[data-content-storyboard-search]');
    if (!next || typeof next.focus !== 'function') {
      return;
    }
    try {
      next.focus();
      if (typeof next.setSelectionRange === 'function') {
        const length = String(value || '').length;
        next.setSelectionRange(length, length);
      }
    } catch (_err) {
      // Search remains functional even if the embedded browser refuses focus restoration.
    }
  }

  function focusPaletteInput(root, value, selection) {
    const next = root && root.querySelector && root.querySelector('[data-storyboard-palette-query]');
    if (!next || typeof next.focus !== 'function') {
      return;
    }
    try {
      next.focus();
      if (typeof next.setSelectionRange === 'function') {
        const length = String(value || '').length;
        const start = clampSelection(selection && selection.start, length);
        const end = clampSelection(selection && selection.end, length);
        next.setSelectionRange(start, end);
      }
    } catch (_err) {
      // Palette filtering still works if the browser denies focus restoration.
    }
  }

  function clampSelection(value, length) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return length;
    }
    return Math.max(0, Math.min(length, Math.floor(number)));
  }

  function bindColorPickers(root, state, deps) {
    if (!root || !root.querySelectorAll) {
      return;
    }
    root.querySelectorAll('[data-storyboard-card-color-picker]').forEach((input) => {
      if (input.dataset.storyboardCardColorBound === 'true') {
        return;
      }
      input.dataset.storyboardCardColorBound = 'true';
      input.addEventListener('input', () => {
        setCardColor(state, input.dataset.storyboardCardColorKey || '', input.value || '', deps);
      });
      input.addEventListener('change', () => {
        setCardColor(state, input.dataset.storyboardCardColorKey || '', input.value || '', deps);
      });
    });
  }

  function setCardColor(state, key, color, deps) {
    const cardKey = String(key || '').trim();
    if (!cardKey) {
      return false;
    }
    const next = Object.assign({}, state.storyCardColors || readStoredCardColors());
    const safeColor = normalizeHexColor(color);
    if (safeColor) {
      next[cardKey] = safeColor;
    } else {
      delete next[cardKey];
    }
    state.storyCardColors = trimColorMap(next);
    writeStoredCardColors(state.storyCardColors);
    return rebuild(state, deps, {});
  }

  function selectObject(state, nodeKey, deps) {
    if ((state.workspace || 'content') !== 'content') {
      return false;
    }
    if (String(nodeKey || '').indexOf('relation:') === 0) {
      state.values = deps.collectValues();
      state.selectedCanvasNode = nodeKey;
      state.editorOverlay = true;
      state.model = state.mode === 'existing' ? deps.buildExistingModel({values: state.values}) : deps.buildTemplateModel({values: state.values});
      state.status = deps.t('objectCanvas.status.storyRelationSelected', 'Selected event-chain relationship; edit the source event routes in the object editor.');
      deps.render();
      return true;
    }
    const parsed = parseStoryObjectKey(nodeKey);
    if (!parsed || parsed.kind === 'route' || parsed.kind === 'draft') {
      return false;
    }
    state.values = deps.collectValues();
    const itemId = parsed.parentId || parsed.id;
    if (!itemId) {
      return false;
    }
    if (state.mode === 'existing' && state.item === itemId && (state.view === parsed.view || parsed.view === 'cards' && state.view === 'cards')) {
      state.selectedCanvasNode = nodeKey;
      state.editorOverlay = true;
      state.model = deps.buildExistingModel({values: state.values});
      deps.render();
      return true;
    }
    const nextModel = deps.buildExistingModelFor(parsed.view, itemId, {values: {}});
    if (!nextModel || !nextModel.ok) {
      return false;
    }
    state.mode = 'existing';
    state.template = 'existing';
    state.view = parsed.view;
    state.item = itemId;
    state.workspace = 'content';
    state.selectedCanvasNode = nodeKey;
    state.editorOverlay = true;
    state.values = {};
    state.model = nextModel;
    state.status = deps.t('objectCanvas.status.storyObjectSelected', 'Selected story object opened in the object editor.');
    deps.showWorkspace('existing');
    deps.render();
    return true;
  }

  function draftWithContext(state, draft) {
    if (!draft || typeof draft !== 'object') {
      return draft;
    }
    return Object.assign({}, draft, {
      studioAuthoringContext: {
        workspace: 'content',
        surface: 'content_storyboard',
        storyboardView: state.storyboardView,
        storyCanvasCategory: state.storyCanvasCategory || 'story',
        storySearchQuery: state.storySearchQuery || '',
        storyScopeCollapsed: Boolean(state.storyScopeCollapsed),
        storyOverviewCollapsed: Boolean(state.storyOverviewCollapsed),
        storyScopeMode: state.storyScopeMode,
        storyScopeWindow: state.storyScopeWindow,
        storyChainDepth: state.storyChainDepth,
        storyPaletteOpen: state.storyPaletteOpen,
        storyPaletteQuery: state.storyPaletteQuery,
        storyPaletteType: state.storyPaletteType,
        storyPaletteScopeFilter: state.storyPaletteScopeFilter,
        storyPaletteSelectedKey: state.storyPaletteSelectedKey,
        storyPalettePinnedKeys: normalizeKeyList(state.storyPalettePinnedKeys || []),
        storyPaletteRecentKeys: normalizeKeyList(state.storyPaletteRecentKeys || []),
        storyPaletteWidth: clampPaletteWidth(state.storyPaletteWidth || STORY_PALETTE_DEFAULT_WIDTH),
        storyPaletteChromeCollapsed: Boolean(state.storyPaletteChromeCollapsed),
        storyPaletteRowHeight: clampPaletteRowHeight(state.storyPaletteRowHeight || STORY_PALETTE_DEFAULT_ROW_HEIGHT),
        storyPaletteScrollOffset: state.storyPaletteScrollOffset || 0,
        storyPaletteDropContext: state.storyPaletteDropContext,
        runtimeLensFocusKey: state.runtimeLensFocusKey,
        runtimeLensDraftKey: state.runtimeLensDraftKey,
        runtimeLensCurrentDraftKey: state.runtimeLensCurrentDraftKey,
        runtimeLensCollapsed: state.runtimeLensCollapsed,
        selectedCanvasNode: state.selectedCanvasNode,
        nodePositions: Object.assign({}, state.nodePositions || {}),
        draftBranchCount: (state.draftBranches || []).length,
        editorOverlay: Boolean(state.editorOverlay)
      }
    });
  }

  function restoreContext(state, context, deps) {
    if (!context || context.workspace !== 'content') {
      return false;
    }
    state.storyboardView = String(context.storyboardView || '') === 'chain' ? 'chain' : 'timeline';
    state.storyCanvasCategory = normalizeCanvasCategory(context.storyCanvasCategory);
    state.storySearchQuery = normalizeSearchQuery(context.storySearchQuery);
    state.storyScopeCollapsed = Boolean(context.storyScopeCollapsed);
    state.storyOverviewCollapsed = Boolean(context.storyOverviewCollapsed);
    state.storyScopeMode = String(context.storyScopeMode || '') === 'expanded' ? 'expanded' : 'focus';
    state.storyScopeWindow = String(context.storyScopeWindow || '');
    state.storyChainDepth = normalizeDepth(context.storyChainDepth);
    state.storyPaletteOpen = Boolean(context.storyPaletteOpen);
    state.storyPaletteQuery = String(context.storyPaletteQuery || '');
    state.storyPaletteType = normalizePaletteType(context.storyPaletteType);
    state.storyPaletteScopeFilter = normalizePaletteScopeFilter(context.storyPaletteScopeFilter);
    state.storyPaletteSelectedKey = String(context.storyPaletteSelectedKey || '');
    state.storyPalettePinnedKeys = normalizeKeyList(context.storyPalettePinnedKeys || readStoredKeyList(scopedKey(STORY_PALETTE_PIN_BASE_KEY)));
    state.storyPaletteRecentKeys = normalizeKeyList(context.storyPaletteRecentKeys || readStoredKeyList(scopedKey(STORY_PALETTE_RECENT_BASE_KEY)));
    state.storyPaletteWidth = clampPaletteWidth(context.storyPaletteWidth || readStoredNumber(STORY_PALETTE_WIDTH_STORAGE_KEY, STORY_PALETTE_DEFAULT_WIDTH));
    state.storyPaletteChromeCollapsed = context.storyPaletteChromeCollapsed === undefined
      ? readStoredBool(STORY_PALETTE_CHROME_STORAGE_KEY, false)
      : Boolean(context.storyPaletteChromeCollapsed);
    state.storyPaletteRowHeight = clampPaletteRowHeight(context.storyPaletteRowHeight || STORY_PALETTE_DEFAULT_ROW_HEIGHT);
    state.storyPaletteScrollOffset = Math.max(0, Number(context.storyPaletteScrollOffset) || 0);
    state.storyPaletteDropContext = context.storyPaletteDropContext && typeof context.storyPaletteDropContext === 'object' ? Object.assign({}, context.storyPaletteDropContext) : null;
    state.selectedCanvasNode = String(context.selectedCanvasNode || state.selectedCanvasNode || 'object');
    state.nodePositions = context.nodePositions && typeof context.nodePositions === 'object' ? Object.assign({}, context.nodePositions) : {};
    state.editorOverlay = Boolean(context.editorOverlay);
    state.model = state.mode === 'existing' ? deps.buildExistingModel({values: state.values}) : deps.buildTemplateModel({values: state.values});
    deps.render();
    return true;
  }

  function createRelatedDraft(state, action, target, deps) {
    const api = global.ProjectMapAuthoringReferenceIndex;
    if (!api || typeof api.branchDraft !== 'function') {
      return false;
    }
    const draft = api.branchDraft(action, state.model || {}, {
      insertKey: target && target.dataset && target.dataset.contentStoryboardInsert || '',
      view: state.storyboardView,
      storyCanvasCategory: state.storyCanvasCategory || 'story',
      storySearchQuery: state.storySearchQuery || '',
      selectedKey: state.selectedCanvasNode,
      storyScopeMode: state.storyScopeMode,
      storyScopeWindow: state.storyScopeWindow,
      storyChainDepth: state.storyChainDepth,
      paletteDropContext: state.storyPaletteDropContext
    });
    state.draftBranches.push(draft);
    state.selectedCanvasNode = 'draft:' + draft.id;
    state.editorOverlay = true;
    state.status = deps.t('objectCanvas.status.branchCreated', 'A related draft card was added to the Storyboard.');
    deps.render();
    return true;
  }

  function rebuild(state, deps, patch) {
    Object.assign(state, patch || {});
    state.values = deps.collectValues();
    state.model = state.mode === 'existing' ? deps.buildExistingModel({values: state.values}) : deps.buildTemplateModel({values: state.values});
    deps.render();
    return true;
  }

  function refreshPaletteOnly(state, deps, patch, options) {
    if (patch && patch.storyPaletteOpen) {
      cancelPaletteCloseTimer(state);
    }
    Object.assign(state, patch || {});
    state.storyPalettePinnedKeys = normalizeKeyList(state.storyPalettePinnedKeys || readStoredKeyList(scopedKey(STORY_PALETTE_PIN_BASE_KEY)));
    state.storyPaletteRecentKeys = normalizeKeyList(state.storyPaletteRecentKeys || readStoredKeyList(scopedKey(STORY_PALETTE_RECENT_BASE_KEY)));
    state.storyPaletteWidth = clampPaletteWidth(state.storyPaletteWidth || readStoredNumber(STORY_PALETTE_WIDTH_STORAGE_KEY, STORY_PALETTE_DEFAULT_WIDTH));
    state.storyPaletteRowHeight = clampPaletteRowHeight(state.storyPaletteRowHeight || STORY_PALETTE_DEFAULT_ROW_HEIGHT);
    const root = state.__storyPaletteRoot;
    const current = root && root.querySelector && root.querySelector('[data-storyboard-palette]');
    const currentOpen = current && current.getAttribute && current.getAttribute('data-storyboard-palette-open') === 'true';
    const surface = global.ProjectMapContentStoryboardSurface;
    if (!root || !current || !surface || typeof surface.renderPaletteOnly !== 'function' || !state.model) {
      deps.render();
      return true;
    }
    const html = surface.renderPaletteOnly(state.model, Object.assign({
      projectIndex: state.projectIndex,
      selected: state.selectedCanvasNode,
      nodePositions: state.nodePositions || {},
      draftBranches: state.draftBranches || [],
      editorOverlay: state.editorOverlay
    }, surfaceOptions(state)));
    const template = root.ownerDocument && root.ownerDocument.createElement ? root.ownerDocument.createElement('template') : null;
    if (!template) {
      deps.render();
      return true;
    }
    template.innerHTML = String(html || '').trim();
    const next = template.content && template.content.firstElementChild;
    if (!next) {
      deps.render();
      return true;
    }
    if (currentOpen && next.getAttribute && next.getAttribute('data-storyboard-palette-open') === 'true' && next.classList) {
      next.classList.add('is-refreshing');
    }
    current.replaceWith(next);
    bindPalette(root, state, deps);
    if (options && options.preserveScroll) {
      restorePaletteScroll(root, state.storyPaletteScrollOffset || 0);
    }
    return true;
  }

  function closePaletteWithMotion(state, deps) {
    if (!state || !state.storyPaletteOpen) {
      return refreshPaletteOnly(state, deps, {storyPaletteOpen: false});
    }
    if (state.__storyPaletteCloseTimer) {
      return true;
    }
    const root = state.__storyPaletteRoot;
    const palette = root && root.querySelector && root.querySelector('[data-storyboard-palette-open="true"]');
    if (!palette || !palette.classList) {
      return refreshPaletteOnly(state, deps, {storyPaletteOpen: false});
    }
    palette.classList.add('is-closing');
    const view = root.ownerDocument && root.ownerDocument.defaultView || global;
    const reduceMotion = view && view.matchMedia && view.matchMedia('(prefers-reduced-motion: reduce)').matches;
    state.__storyPaletteCloseTimer = (view.setTimeout || setTimeout)(() => {
      state.__storyPaletteCloseTimer = null;
      refreshPaletteOnly(state, deps, {storyPaletteOpen: false});
    }, reduceMotion ? 1 : STORY_PALETTE_CLOSE_MOTION_MS);
    return true;
  }

  function cancelPaletteCloseTimer(state) {
    if (!state || !state.__storyPaletteCloseTimer) {
      return;
    }
    clearTimeout(state.__storyPaletteCloseTimer);
    state.__storyPaletteCloseTimer = null;
  }

  function restorePaletteScroll(root, offset) {
    const scroll = root && root.querySelector && root.querySelector('[data-storyboard-palette-scroll]');
    if (!scroll || typeof scroll.scrollTop !== 'number') {
      return;
    }
    scroll.__dmsStoryboardPaletteRestoringScroll = true;
    scroll.scrollTop = Math.max(0, Number(offset) || 0);
    setTimeout(() => {
      scroll.__dmsStoryboardPaletteRestoringScroll = false;
    }, 0);
  }

  function selectPaletteItem(state, key, deps) {
    const itemKey = String(key || '').trim();
    if (!itemKey) {
      return false;
    }
    const recent = pushKey(state.storyPaletteRecentKeys || readStoredKeyList(scopedKey(STORY_PALETTE_RECENT_BASE_KEY)), itemKey, 20);
    state.storyPaletteRecentKeys = recent;
    writeStoredKeyList(scopedKey(STORY_PALETTE_RECENT_BASE_KEY), recent);
    return refreshPaletteOnly(state, deps, {storyPaletteOpen: true, storyPaletteSelectedKey: itemKey});
  }

  function togglePalettePin(state, key, deps) {
    const itemKey = String(key || '').trim();
    if (!itemKey) {
      return false;
    }
    const current = normalizeKeyList(state.storyPalettePinnedKeys || readStoredKeyList(scopedKey(STORY_PALETTE_PIN_BASE_KEY)));
    const next = current.includes(itemKey) ? current.filter((value) => value !== itemKey) : [itemKey].concat(current);
    state.storyPalettePinnedKeys = normalizeKeyList(next).slice(0, 40);
    writeStoredKeyList(scopedKey(STORY_PALETTE_PIN_BASE_KEY), state.storyPalettePinnedKeys);
    return refreshPaletteOnly(state, deps, {storyPaletteOpen: true, storyPaletteSelectedKey: itemKey});
  }

  function openPaletteSelection(state, deps) {
    const itemKey = String(state.storyPaletteSelectedKey || '').trim();
    if (!itemKey) {
      state.status = deps.t('objectCanvas.status.paletteSelectFirst', 'Select an asset in the Canvas asset rail first.');
      deps.render();
      return true;
    }
    const recent = pushKey(state.storyPaletteRecentKeys || readStoredKeyList(scopedKey(STORY_PALETTE_RECENT_BASE_KEY)), itemKey, 20);
    state.storyPaletteRecentKeys = recent;
    writeStoredKeyList(scopedKey(STORY_PALETTE_RECENT_BASE_KEY), recent);
    if (deps && typeof deps.selectCanvasNode === 'function') {
      deps.selectCanvasNode(itemKey);
      return true;
    }
    return selectObject(state, itemKey, deps);
  }

  function parseStoryObjectKey(nodeKey) {
    const match = String(nodeKey || '').match(/^(event|card|advisor|news|section|route|draft):(.+)$/);
    if (!match) {
      return null;
    }
    const kind = match[1];
    const id = match[2];
    if (kind === 'section') {
      return {
        kind,
        id,
        parentId: String(id || '').split('.')[0] || '',
        view: 'events'
      };
    }
    return {
      kind,
      id,
      view: kind === 'event' ? 'events' : kind === 'card' || kind === 'advisor' ? 'cards' : kind
    };
  }

  function normalizeLane(value) {
    return String(value || '').replace(/^(?:time|year_month|turn|chapter|phase|chain_order|source_order|lane):/, '');
  }

  function normalizeDepth(value) {
    const text = String(value || '1');
    return text === '2' || text === 'full' ? text : '1';
  }

  function normalizePaletteType(value) {
    const text = String(value || 'all');
    return ['all', 'event', 'news', 'card', 'advisor', 'state', 'draft'].includes(text) ? text : 'all';
  }

  function normalizePaletteScopeFilter(value) {
    const text = String(value || 'all');
    return ['all', 'related', 'source', 'state_linked'].includes(text) ? text : 'all';
  }

  function normalizeCanvasCategory(value) {
    const text = String(value || 'story');
    return text === 'cards' || text === 'all' ? text : 'story';
  }

  function normalizeSearchQuery(value) {
    return String(value || '').trim().slice(0, 80);
  }

  function normalizeHexColor(value) {
    const text = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : '';
  }

  function trimColorMap(map) {
    const out = {};
    Object.keys(map || {}).slice(-400).forEach((key) => {
      const color = normalizeHexColor(map[key]);
      if (key && color) {
        out[key] = color;
      }
    });
    return out;
  }

  function readStoredCardColors() {
    if (!global || !global.localStorage) {
      return {};
    }
    try {
      return trimColorMap(JSON.parse(global.localStorage.getItem(scopedKey(STORY_CARD_COLOR_BASE_KEY)) || '{}'));
    } catch (_err) {
      return {};
    }
  }

  function writeStoredCardColors(map) {
    if (!global || !global.localStorage) {
      return;
    }
    try {
      global.localStorage.setItem(scopedKey(STORY_CARD_COLOR_BASE_KEY), JSON.stringify(trimColorMap(map)));
    } catch (_err) {
      // Visual annotations are best-effort local cache; project edits remain unaffected.
    }
  }

  function readStoredKeyList(storageKey) {
    if (!global || !global.localStorage) {
      return [];
    }
    try {
      return normalizeKeyList(JSON.parse(global.localStorage.getItem(storageKey) || '[]'));
    } catch (_err) {
      return [];
    }
  }

  function writeStoredKeyList(storageKey, values) {
    if (!global || !global.localStorage) {
      return;
    }
    try {
      global.localStorage.setItem(storageKey, JSON.stringify(normalizeKeyList(values)));
    } catch (_err) {
      // Palette pin/recent state is a local preference and can fail silently.
    }
  }

  function readStoredNumber(storageKey, fallback) {
    if (!global || !global.localStorage) {
      return fallback;
    }
    try {
      const value = Number(global.localStorage.getItem(storageKey));
      return Number.isFinite(value) ? value : fallback;
    } catch (_err) {
      return fallback;
    }
  }

  function writeStoredNumber(storageKey, value) {
    if (!global || !global.localStorage) {
      return;
    }
    try {
      global.localStorage.setItem(storageKey, String(value));
    } catch (_err) {
      // Palette size is a local preference and can fail silently.
    }
  }

  function readStoredBool(storageKey, fallback) {
    if (!global || !global.localStorage) {
      return fallback;
    }
    try {
      const value = global.localStorage.getItem(storageKey);
      if (value === 'true') {
        return true;
      }
      if (value === 'false') {
        return false;
      }
    } catch (_err) {
      return fallback;
    }
    return fallback;
  }

  function writeStoredBool(storageKey, value) {
    if (!global || !global.localStorage) {
      return;
    }
    try {
      global.localStorage.setItem(storageKey, value ? 'true' : 'false');
    } catch (_err) {
      // Palette chrome state is a local preference and can fail silently.
    }
  }

  function clampPaletteWidth(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return STORY_PALETTE_DEFAULT_WIDTH;
    }
    return Math.max(STORY_PALETTE_MIN_WIDTH, Math.min(STORY_PALETTE_MAX_WIDTH, number));
  }

  function clampPaletteRowHeight(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return STORY_PALETTE_DEFAULT_ROW_HEIGHT;
    }
    return Math.max(STORY_PALETTE_MIN_ROW_HEIGHT, Math.min(STORY_PALETTE_MAX_ROW_HEIGHT, number));
  }

  // ── card stacking (drag-to-snap) ────────────────────────────────────

  /**
   * Physical card stacking: move the dragged card on top of the anchor,
   * offset down so the anchor's title peeks out from behind.
   * Each subsequent card stacked on the same anchor offsets further.
   */
  var STACK_TITLE_PEEK = 64; // px — expose kicker + title of the card below

  /**
   * @param {{x:number, y:number}|null} anchorDomPos – the anchor's actual
   *   rendered position from the DOM.  Layout-placed cards may not have
   *   entries in state.nodePositions, so the interactions layer reads
   *   data-canvas-x/y from the DOM and passes it here as a reliable source.
   */
  function stackCards(state, draggedKey, anchorKey, deps, anchorDomPos) {
    if (!draggedKey || !anchorKey || draggedKey === anchorKey) { return false; }
    var stacks = Object.assign({}, state.storyCardStacks || {});
    // Resolve the effective anchor: if anchorKey is itself a member of
    // another stack, redirect to that root anchor so we don't create
    // confusing nested stacks (A→[B] and B→[C] independently).
    var effectiveAnchor = anchorKey;
    Object.keys(stacks).forEach(function (rootKey) {
      var s = stacks[rootKey];
      if (s && Array.isArray(s.members) && s.members.indexOf(anchorKey) >= 0) {
        effectiveAnchor = rootKey;
      }
    });
    // Remove draggedKey from any previous stack
    Object.keys(stacks).forEach(function (key) {
      var s = stacks[key];
      s.members = (s.members || []).filter(function (m) { return m !== draggedKey; });
      if (!s.members.length) { delete stacks[key]; }
    });
    // Add to the effective anchor's stack
    var stack = stacks[effectiveAnchor] || {members: []};
    if (stack.members.indexOf(draggedKey) < 0) {
      stack.members = stack.members.concat([draggedKey]);
    }
    stacks[effectiveAnchor] = stack;
    state.storyCardStacks = stacks;
    // Resolve anchor position: prefer state override, fall back to the
    // DOM-provided position so layout-only cards don't resolve to (0,0).
    // When the anchor was redirected to a root, use the root's state
    // position (which should be pinned from its own stackCards call).
    state.nodePositions = Object.assign({}, state.nodePositions || {});
    var useAnchorKey = effectiveAnchor;
    var statePos = state.nodePositions[useAnchorKey];
    var domPos = anchorDomPos && typeof anchorDomPos === 'object' ? anchorDomPos : null;
    // If we redirected to a root anchor, domPos was for the original
    // target, not the root — prefer the root's pinned state position.
    if (effectiveAnchor !== anchorKey) { domPos = null; }
    var anchorX = statePos ? Number(statePos.x || 0) : domPos ? Number(domPos.x || 0) : 0;
    var anchorY = statePos ? Number(statePos.y || 0) : domPos ? Number(domPos.y || 0) : 0;
    // Pin the anchor into nodePositions so future group moves and
    // re-renders keep the stack at a stable position.
    if (!statePos && domPos) {
      state.nodePositions[useAnchorKey] = {x: anchorX, y: anchorY};
    }
    var memberIndex = stack.members.indexOf(draggedKey);
    var offsetY = (memberIndex + 1) * STACK_TITLE_PEEK;
    state.nodePositions[draggedKey] = {x: anchorX, y: anchorY + offsetY};
    return rebuild(state, deps, {});
  }

  /**
   * Move a stack group: set the anchor and every member to their explicit
   * final positions.  The interactions layer computes these from the drag
   * offsets captured at pointerdown, so there is no fragile delta involved.
   *
   * @param {Array<{key:string, x:number, y:number}>} memberPositions
   */
  function moveGroup(state, anchorKey, newX, newY, memberPositions, deps) {
    if (!anchorKey) { return false; }
    var positions = Object.assign({}, state.nodePositions || {});
    positions[anchorKey] = {x: newX, y: newY};
    if (Array.isArray(memberPositions)) {
      memberPositions.forEach(function (mp) {
        if (mp && mp.key) {
          positions[mp.key] = {x: Number(mp.x || 0), y: Number(mp.y || 0)};
        }
      });
    }
    state.nodePositions = positions;
    return rebuild(state, deps, {});
  }

  /**
   * Remove a card from whatever stack it belongs to as a member.
   * Returns true if the card was actually unstacked.
   */
  function unstackCard(state, key) {
    if (!key) { return false; }
    var stacks = state.storyCardStacks;
    if (!stacks || typeof stacks !== 'object') { return false; }
    var changed = false;
    Object.keys(stacks).forEach(function (anchorKey) {
      var s = stacks[anchorKey];
      if (!s || !Array.isArray(s.members)) { return; }
      var idx = s.members.indexOf(key);
      if (idx < 0) { return; }
      s.members = s.members.filter(function (m) { return m !== key; });
      if (!s.members.length) { delete stacks[anchorKey]; }
      changed = true;
    });
    if (changed) {
      state.storyCardStacks = Object.assign({}, stacks);
    }
    return changed;
  }

  function normalizeKeyList(value) {
    const input = Array.isArray(value) ? value : String(value || '').split(',');
    const seen = new Set();
    const out = [];
    input.forEach((item) => {
      const text = String(item || '').trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      out.push(text);
    });
    return out.slice(0, 80);
  }

  function pushKey(values, key, limit) {
    const itemKey = String(key || '').trim();
    if (!itemKey) {
      return normalizeKeyList(values);
    }
    return [itemKey].concat(normalizeKeyList(values).filter((value) => value !== itemKey)).slice(0, Math.max(1, Number(limit) || 20));
  }

  function dropContextFor(state, payload, target) {
    const dataset = target && target.dataset || {};
    return {
      itemKey: String(payload && payload.key || ''),
      itemTitle: String(payload && payload.title || ''),
      targetKind: String(dataset.storyboardDropTarget || 'canvas'),
      insertKey: String(dataset.contentStoryboardInsert || dataset.contentStoryboardLane || ''),
      view: state.storyboardView || 'timeline'
    };
  }

  const api = {reset, setProjectId, surfaceOptions, renderStage, setView, handleAction, setPaletteQuery, setSearchQuery, bindPalette, dropPaletteItem, selectObject, draftWithContext, restoreContext, createRelatedDraft, stackCards, moveGroup, unstackCard};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapStoryboardWorkspaceState = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
