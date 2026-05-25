(function initProjectMapExploreLists(root) {
  'use strict';

  function ProjectMapExploreLists(ctx) {
    ctx = ctx || {};
    const global = ctx.global || root;
    const {
      VIEW_DEFS,
      VIRTUAL_LIST_THRESHOLD,
      VIRTUAL_LIST_ROW_HEIGHT,
      VIRTUAL_ASSET_ROW_HEIGHT,
      VIRTUAL_ASSET_CARD_MIN_WIDTH,
      VIRTUAL_LIST_OVERSCAN,
      t,
      currentLocale,
      applyI18n,
      studioContracts,
      assetModelApi,
      viewLabel,
      ensureArray,
      coverageRows,
      coverageField,
      coverageWorkflowSteps,
      coverageCountBadge,
      diagnosticBreakdown,
      countBy,
      listForView,
      filterAndSortItems,
      normalizeAssetForViewer,
      normalizedRowsForView,
      sortedRowsForView,
      virtualWindowForList,
      sourceLabel,
      sourceLine,
      firstSource,
      graphRowsForScene,
      sceneIdForEndpoint,
      textCorpusContextRows,
      textRevisionKey,
      textRevisionReplacementFor,
      buildTextRevisionModel,
      textCorpusRoleLabel,
      textCorpusRoleGuidance,
      textCorpusEditabilityLabel,
      setStatus,
      showError
    } = ctx;

  function render(state, elements) {
    updateBrandSubtitle(state, elements);
    updateNav(state, elements);
    updateSortOptions(state, elements);
    renderOverview(state, elements);
    renderList(state, elements);
    ctx.renderInspector(state, elements);
    applyI18n(elements.overview);
    applyI18n(elements.list);
    applyI18n(elements.inspector);
  }

  function updateBrandSubtitle(state, elements) {
    if (!elements.brandSubtitle) {
      return;
    }
    if (!state.model) {
      elements.brandSubtitle.textContent = t('topbar.subtitle.default', 'Studio workspace for branching Dendry projects');
      return;
    }
    const project = state.model.project || {};
    const schema = state.model.index && state.model.index.schemaVersion ? 'schema ' + state.model.index.schemaVersion : 'schema ?';
    const sceneCount = state.model.summary && state.model.summary.sceneCount
      ? state.model.summary.sceneCount + ' ' + t('overview.metric.scenes', 'scenes')
      : ensureArray(state.model.scenes).length + ' ' + t('overview.metric.scenes', 'scenes');
    elements.brandSubtitle.textContent = [project.name || 'ProjectIndex', schema, sceneCount].join(' · ');
  }

  function updateNav(state, elements) {
    elements.nav.forEach((button) => {
      const view = button.dataset.view;
      button.classList.toggle('is-active', button.dataset.view === state.view);
      button.innerHTML = iconHtml(iconForView(view)) +
        '<span class="nav-label">' + escapeHtml(viewLabel(view)) + '</span>' +
        '<span class="nav-count">' + escapeHtml(navCountLabel(state.model, view)) + '</span>';
    });
  }

  function iconForView(view) {
    const icons = {
      overview: 'map',
      scenes: 'map',
      events: 'play',
      cards: 'card',
      news: 'book',
      textCorpus: 'text',
      assets: 'image',
      variables: 'settings',
      surfaceText: 'edit',
      coverage: 'check',
      diagnostics: 'warning'
    };
    return icons[view] || 'spark';
  }

  function iconHtml(name) {
    const icons = global && global.ProjectMapIcons;
    return icons && typeof icons.icon === 'function' ? icons.icon(name) : '';
  }

  function navCountLabel(model, view) {
    if (!model) {
      return '';
    }
    const summary = model.summary || {};
    const counts = {
      overview: summary.sceneCount || ensureArray(model.scenes).length,
      coverage: ensureArray(model.lists && model.lists.coverage).length || coverageRows(model.index).length,
      scenes: summary.sceneCount || ensureArray(model.lists && model.lists.scenes).length,
      events: summary.eventCount || ensureArray(model.lists && model.lists.events).length,
      cards: summary.cardCount || ensureArray(model.lists && model.lists.cards).length,
      news: (summary.newsItemCount || 0) + (summary.eventPopupCount || 0) || ensureArray(model.lists && model.lists.news).length,
      textCorpus: summary.textCorpusCount || ensureArray(model.lists && model.lists.textCorpus).length,
      assets: summary.assetCount || ensureArray(model.lists && model.lists.assets).length,
      surfaceText: summary.surfaceTextCount || ensureArray(model.lists && model.lists.surfaceText).length,
      variables: summary.variableCount || ensureArray(model.variables).length,
      diagnostics: summary.diagnosticCount || ensureArray(model.diagnostics).length
    };
    const value = counts[view];
    return value === undefined || value === null || value === '' ? '' : String(value);
  }

  function updateSortOptions(state, elements) {
    const fields = VIEW_DEFS[state.view].sorts;
    if (!fields.includes(state.sortField)) {
      state.sortField = VIEW_DEFS[state.view].defaultSort;
    }
    elements.sortField.innerHTML = fields.map((field) => {
      return '<option value="' + escapeHtml(field) + '">' + escapeHtml(field) + '</option>';
    }).join('');
    elements.sortField.value = state.sortField;
    elements.sortDir.textContent = state.sortDir === 'asc' ? 'A-Z' : 'Z-A';
  }

  function renderOverview(state, elements) {
    if (!state.model) {
      elements.overview.innerHTML = '';
      return;
    }
    const model = state.model;
    const summary = model.summary;
    const diagnostics = diagnosticBreakdown(model.diagnostics);
    const severityCounts = countBy(model.diagnostics, (diag) => diag.severity || 'info');
    const profileIds = ensureArray(model.project.profileIds).join(', ');
    const coverage = ensureArray(model.lists && model.lists.coverage);
    const mustHaveDone = coverage.filter((row) => row.releasePriority === 'must-have' && row.noCodeCompletion !== 'no').length;
    const mustHaveTotal = coverage.filter((row) => row.releasePriority === 'must-have').length;
    const metrics = [
      [t('overview.metric.scenes', 'Scenes'), summary.sceneCount],
      [t('overview.metric.edges', 'Edges'), summary.edgeCount],
      [t('overview.metric.variables', 'Variables'), summary.variableCount],
      [t('overview.metric.events', 'Events'), summary.eventCount],
      [t('overview.metric.cards', 'Cards'), summary.cardCount],
      [model.uiLabels.advisorLikePlural || t('overview.metric.advisors', 'Advisors'), summary.pinnedCardCount || 0],
      [t('overview.metric.newsItems', 'News items'), summary.newsItemCount],
      [t('overview.metric.textCorpus', 'Text items'), summary.textCorpusCount || ensureArray(model.lists.textCorpus).length],
      [t('overview.metric.surfaceText', 'Surface text'), summary.surfaceTextCount || ensureArray(model.lists.surfaceText).length],
      [t('overview.metric.assets', 'Assets'), summary.assetCount || ensureArray(model.lists.assets).length],
      [t('overview.metric.modderTasks', 'Modder tasks'), mustHaveDone + ' / ' + mustHaveTotal],
      [t('overview.metric.diagnostics', 'Diagnostics'), summary.diagnosticCount],
      [t('overview.metric.regexOnlyGoto', 'Regex-only go-to'), diagnostics.find((diag) => diag.code === 'project_map.regex_only_goto')?.count || 0]
    ];
    elements.overview.classList.toggle('hidden', state.view !== 'overview');
    elements.overview.innerHTML = [
      '<div class="overview-grid">',
      metrics.map((metric) => {
        return '<div class="metric"><span class="metric-value">' + escapeHtml(metric[1]) +
          '</span><span class="metric-label">' + escapeHtml(metric[0]) + '</span></div>';
      }).join(''),
      '</div>',
      '<dl class="kv">',
      '<dt>' + escapeHtml(t('overview.project', 'Project')) + '</dt><dd>' + escapeHtml(model.project.name || '(unnamed)') + '</dd>',
      '<dt>' + escapeHtml(t('overview.profiles', 'Profiles')) + '</dt><dd>' + escapeHtml(profileIds || '(none)') + '</dd>',
      '<dt>' + escapeHtml(t('overview.severity', 'Severity')) + '</dt><dd>' + escapeHtml(formatCounts(severityCounts)) + '</dd>',
      '<dt>' + escapeHtml(t('overview.generated', 'Generated')) + '</dt><dd>' + escapeHtml(model.index.generatedAt || '(unknown)') + '</dd>',
      '</dl>',
      renderFirstModRoadmap(model)
    ].join('');
  }

  function renderFirstModRoadmap(model) {
    const coverage = new Map(ensureArray(model && model.lists && model.lists.coverage).map((row) => [row.id, row]));
    const steps = [
      [t('roadmap.find', 'Find'), coverage.get('find_and_compare'), t('roadmap.findText', 'Find what you want to change without opening source files.')],
      [t('roadmap.draft', 'Draft'), coverage.get('events'), t('roadmap.draftText', 'Create or seed event/news/card/text proposals.')],
      [t('roadmap.text', 'Text'), coverage.get('existing_text'), t('roadmap.textText', 'Change visible wording with explicit manual/safe boundaries.')],
      [t('roadmap.install', 'Install'), coverage.get('install_review'), t('roadmap.installText', 'Separate safe apply from manual review before touching the project.')],
      [t('roadmap.preview', 'Preview'), coverage.get('preview_assets'), t('roadmap.previewText', 'Use authoring preview and read-only asset references to judge proposals before manual install.')]
    ];
    return [
      '<section class="roadmap-panel" aria-label="First mod roadmap">',
      '<div class="preview-heading">' + escapeHtml(t('overview.firstModRoadmap', 'First Mod Roadmap')) + '</div>',
      '<div class="roadmap-grid">',
      steps.map(([label, row, text]) => {
        const level = row && row.coverageLevel ? row.coverageLevel : 'unknown';
        return [
          '<div class="roadmap-card">',
          '<div class="roadmap-card-head">',
          '<strong>' + escapeHtml(label) + '</strong>',
          row ? badge(row.coverageLabel || level, coverageClass(level)) : badge('missing', 'opaque'),
          '</div>',
          '<p>' + escapeHtml(text) + '</p>',
          row && row.studioPath ? '<div class="meta">' + escapeHtml(coverageField(row, 'studioPath')) + '</div>' : '',
          '</div>'
        ].join('');
      }).join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function formatCounts(counts) {
    return Object.keys(counts).sort().map((key) => key + ' ' + counts[key]).join(', ') || '(none)';
  }

  function coverageClass(level) {
    const value = String(level || '');
    if (value === 'draft_seed' || value === 'mixed') {
      return 'info';
    }
    if (value === 'guided_only' || value === 'ide_escape_hatch') {
      return 'warning';
    }
    if (value === 'not_started' || value === 'deferred') {
      return 'opaque';
    }
    return '';
  }

  function priorityClass(priority) {
    const value = String(priority || '').toLowerCase();
    if (value.includes('must')) {
      return 'warning';
    }
    if (value.includes('blocker')) {
      return 'error';
    }
    if (value.includes('later')) {
      return 'opaque';
    }
    return 'info';
  }

  function completionClass(value) {
    const text = String(value || '').toLowerCase();
    if (text === 'mostly') {
      return 'exact';
    }
    if (text === 'partial' || text === 'guided') {
      return 'warning';
    }
    if (text === 'no') {
      return 'opaque';
    }
    return 'info';
  }

  function currentItems(state) {
    return state.model
      ? filterAndSortItems(state.model, state.view, state.query, state.sortField, state.sortDir)
      : [];
  }

  function renderList(state, elements) {
    state.virtualListActive = false;
    if (!state.model) {
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('design.noIndex', 'No project index loaded.')) + '</div>';
      state.currentItems = [];
      return;
    }
    if (state.view === 'assets') {
      renderAssetGallery(state, elements);
      return;
    }
    if (state.view === 'news') {
      renderNewsList(state, elements);
      return;
    }
    if (state.view === 'textCorpus') {
      renderTextCorpusList(state, elements);
      return;
    }
    const baseItems = listForView(state.model, state.view);
    if (baseItems.length === 0) {
      const label = viewLabel(state.view);
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('explore.noViewData', 'No {view} data in this index.').replace('{view}', label)) + '</div>';
      state.currentItems = [];
      return;
    }
    const items = currentItems(state);
    state.currentItems = items;
    if (items.length === 0) {
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('explore.noMatches', 'No matching rows for the current search.')) + '</div>';
      return;
    }
    elements.list.innerHTML = items.map((item) => renderListRow(item, state)).join('');
  }

  function renderAssetGallery(state, elements) {
    const baseItems = listForView(state.model, state.view);
    if (baseItems.length === 0) {
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('assets.empty', 'No image or audio assets were found in this index.')) + '</div>';
      state.currentItems = [];
      return;
    }
    const items = currentItems(state);
    state.currentItems = items;
    if (items.length === 0) {
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('assets.noMatches', 'No matching assets for the current search.')) + '</div>';
      return;
    }
    if (items.length >= VIRTUAL_LIST_THRESHOLD) {
      renderVirtualAssetGallery(state, elements, items);
      return;
    }
    elements.list.innerHTML = [
      '<section class="asset-gallery" aria-label="' + escapeAttr(t('assets.gallery', 'Asset gallery')) + '">',
      '<div class="list-section-heading"><span>' + escapeHtml(t('assets.gallery', 'Asset gallery')) + '</span><b>' + escapeHtml(String(items.length)) + '</b></div>',
      '<div class="asset-gallery-grid">',
      items.map((item) => renderAssetGalleryCard(item, state)).join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderVirtualAssetGallery(state, elements, items) {
    const columns = assetGalleryColumnCount(elements.list);
    prepareVirtualList(state, elements, 'assets', items, String(columns));
    const rows = assetGalleryRows(items, columns);
    const viewportHeight = elements.list.clientHeight || 600;
    const windowState = virtualWindowForList(rows.length, elements.list.scrollTop || 0, viewportHeight, {
      rowHeight: VIRTUAL_ASSET_ROW_HEIGHT,
      overscan: 4
    });
    const visibleRows = rows.slice(windowState.start, windowState.end);
    elements.list.innerHTML = [
      '<section class="asset-gallery asset-gallery-virtual" aria-label="' + escapeAttr(t('assets.gallery', 'Asset gallery')) + '">',
      '<div class="list-section-heading"><span>' + escapeHtml(t('assets.gallery', 'Asset gallery')) + '</span><b>' + escapeHtml(String(items.length)) + '</b></div>',
      '<div class="virtual-list asset-virtual-list" data-virtual-list="assets" data-virtual-count="' + escapeAttr(String(items.length)) + '" style="height: ' + escapeAttr(String(windowState.totalHeight)) + 'px">',
      '<div class="virtual-list-window" style="transform: translateY(' + escapeAttr(String(windowState.topSpacer)) + 'px)">',
      visibleRows.map((row) => renderVirtualAssetRow(row, state)).join(''),
      '</div>',
      '</div>',
      '</section>'
    ].join('');
  }

  function assetGalleryColumnCount(container) {
    const width = Math.max(1, container && container.clientWidth || 1);
    return Math.max(1, Math.floor(width / VIRTUAL_ASSET_CARD_MIN_WIDTH));
  }

  function assetGalleryRows(items, columns) {
    const cols = Math.max(1, Number(columns) || 1);
    const rows = [];
    for (let index = 0; index < items.length; index += cols) {
      rows.push(items.slice(index, index + cols));
    }
    return rows;
  }

  function renderVirtualAssetRow(rowItems, state) {
    return [
      '<div class="asset-gallery-grid virtual-asset-row">',
      rowItems.map((item) => renderAssetGalleryCard(item, state)).join(''),
      '</div>'
    ].join('');
  }

  function renderAssetGalleryCard(item, state) {
    const asset = item.raw || item;
    const selected = item.key === state.selectedKey ? ' is-selected' : '';
    const usageCount = ensureArray(asset.usageRefs).length;
    return [
      '<button class="asset-gallery-card' + selected + '" type="button" data-row-key="' + escapeAttr(item.key) + '">',
      renderAssetPreviewFrame(asset, 'card'),
      '<span class="asset-card-title">' + escapeHtml(asset.name || asset.label || asset.path || item.primary) + '</span>',
      '<span class="asset-card-path">' + escapeHtml(asset.path || '') + '</span>',
      '<span class="badge-line">',
      renderBadge(asset.type || 'asset', asset.type || ''),
      renderBadge(asset.status && asset.status.key || asset.editability || 'reference_only', asset.status && asset.status.key || asset.editability || ''),
      usageCount ? renderBadge(t('assets.usedCount', 'used ') + usageCount, 'info') : '',
      '</span>',
      '</button>'
    ].join('');
  }

  function renderAssetPicker(projectIndex, options) {
    const opts = options || {};
    const target = opts.target === 'card' ? 'card' : 'event';
    const rawSelected = opts.selectedPaths !== undefined ? opts.selectedPaths : opts.selectedPath;
    const selectedValues = (Array.isArray(rawSelected) ? rawSelected : [rawSelected])
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const selected = new Set(selectedValues);
    const assets = ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic.assets && projectIndex.semantic.assets.items)
      .map((item) => normalizeAssetForViewer(item, projectIndex))
      .filter((asset) => asset.path || asset.id);
    if (!assets.length) {
      return '<section class="asset-picker"><div class="preview-heading">' + escapeHtml(t('assets.picker', 'Asset picker')) + '</div><p class="inspector-note">' + escapeHtml(t('assets.empty', 'No image or audio assets were found in this index.')) + '</p></section>';
    }
    return [
      '<section class="asset-picker" data-asset-picker-target="' + escapeAttr(target) + '">',
      '<div class="preview-heading">' + escapeHtml(t('assets.picker', 'Asset picker')) + '</div>',
      '<div class="asset-picker-grid">',
      assets.slice(0, 48).map((asset) => renderAssetPickerButton(asset, target, selected)).join(''),
      '</div>',
      '<p>' + escapeHtml(t('assets.pickerNote', 'Select an indexed asset to add an assetRefs line. Files are still handled manually.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderAssetPickerButton(asset, target, selected) {
    const api = assetModelApi();
    const role = defaultAssetRole(asset, target);
    const ref = api && typeof api.assetDraftReference === 'function'
      ? api.assetDraftReference(asset, {role})
      : {path: asset.path || '', type: asset.type || 'asset', label: asset.label || asset.name || '', role};
    const payload = escapeAttr(JSON.stringify(ref));
    const selectedClass = selected.has(asset.path) || selected.has(asset.id) ? ' is-selected' : '';
    const state = asset.referenceState && asset.referenceState.key || 'unknown';
    return [
      '<button class="asset-picker-item' + selectedClass + '" type="button" data-asset-picker-action="select" data-asset-target="' + escapeAttr(target) + '" data-asset-ref="' + payload + '">',
      '<span class="asset-picker-name">' + escapeHtml(asset.label || asset.name || asset.path || '') + '</span>',
      '<span class="asset-picker-path">' + escapeHtml(asset.path || '') + '</span>',
      '<span class="badge-line">',
      renderBadge(asset.type || 'asset', asset.type || ''),
      role ? renderBadge(role, role) : '',
      renderBadge(state, state),
      '</span>',
      '</button>'
    ].join('');
  }

  function defaultAssetRole(asset, target) {
    if ((asset && asset.type) === 'audio') {
      return target === 'card' ? 'card_audio' : 'event_audio';
    }
    return target === 'card' ? 'card_image' : 'event_illustration';
  }

  function renderDraftAssetPanel(draft, projectIndex, options) {
    const value = draft || {};
    const refs = ensureArray(value.assetRefs);
    const requests = ensureArray(value.assetInstallRequests);
    const target = options && options.target === 'card' ? 'card' : 'event';
    if (!refs.length && !requests.length) {
      return [
        '<section class="draft-asset-panel" data-draft-asset-target="' + escapeAttr(target) + '">',
        '<div class="preview-heading">' + escapeHtml(t('assets.draftPanel', 'Draft assets')) + '</div>',
        '<p class="inspector-note">' + escapeHtml(t('assets.draftPanelEmpty', 'No visual or audio assets are attached to this draft yet.')) + '</p>',
        '</section>'
      ].join('');
    }
    const manifest = buildDraftAssetManifest(refs, projectIndex);
    const slots = buildDraftAssetSlots(value, projectIndex, {target});
    return [
      '<section class="draft-asset-panel" data-draft-asset-target="' + escapeAttr(target) + '">',
      '<div class="preview-heading">' + escapeHtml(t('assets.draftPanel', 'Draft assets')) + '</div>',
      renderAssetSlotGrid(slots),
      '<div class="draft-asset-grid">',
      ensureArray(manifest.items).map(renderDraftAssetRefCard).join(''),
      requests.map(renderDraftAssetInstallCard).join(''),
      '</div>',
      '<p>' + escapeHtml(t('assets.draftPanelNote', 'These assets are preview/install proposals. Review & Apply will not copy files until a safe desktop copy flow is enabled.')) + '</p>',
      '</section>'
    ].join('');
  }

  function buildDraftAssetSlots(draft, projectIndex, options) {
    const api = assetModelApi();
    return api && typeof api.buildAssetSlots === 'function'
      ? api.buildAssetSlots(draft || {}, {projectIndex, target: options && options.target})
      : [];
  }

  function renderAssetSlotGrid(slots) {
    const items = ensureArray(slots);
    if (!items.length) {
      return '';
    }
    return [
      '<section class="asset-slot-panel">',
      '<div class="preview-heading">' + escapeHtml(t('assets.slots', 'Asset slots')) + '</div>',
      '<div class="asset-slot-grid">',
      items.map(renderAssetSlotCard).join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderAssetSlotCard(slot) {
    const ref = slot.assetRef || null;
    const request = slot.installRequest || null;
    const label = t('assets.role.' + slot.role, slot.roleLabel || slot.label || slot.role);
    const status = slot.status || 'empty';
    return [
      '<article class="asset-slot-card" data-asset-slot-role="' + escapeAttr(slot.role || '') + '">',
      '<strong>' + escapeHtml(label) + '</strong>',
      '<span class="asset-slot-type">' + escapeHtml(labelForBadge(slot.type || 'asset')) + '</span>',
      ref ? '<code>' + escapeHtml(ref.path || '') + '</code>' : '<span class="inspector-note">' + escapeHtml(t('assets.slotEmpty', 'No asset selected for this slot.')) + '</span>',
      request ? '<span class="draft-asset-source">' + escapeHtml(request.sourceName || request.sourcePath || '') + '</span>' : '',
      '<span class="badge-line">',
      renderBadge(status, status),
      request ? renderBadge('copy_asset_file', 'manual_review') : '',
      '</span>',
      '</article>'
    ].join('');
  }

  function buildDraftAssetManifest(refs, projectIndex) {
    const api = assetModelApi();
    return api && typeof api.buildAssetManifest === 'function'
      ? api.buildAssetManifest(refs || [], {projectIndex})
      : {items: ensureArray(refs)};
  }

  function renderDraftAssetRefCard(asset) {
    const state = asset.referenceState && asset.referenceState.key || 'unknown';
    return [
      '<article class="draft-asset-card">',
      '<strong>' + escapeHtml(asset.label || asset.name || asset.path || t('assets.type.asset', 'Asset')) + '</strong>',
      localizedAssetRoleLabel(asset) ? '<span class="draft-asset-role">' + escapeHtml(localizedAssetRoleLabel(asset)) + '</span>' : '',
      '<code>' + escapeHtml(asset.path || '') + '</code>',
      '<span class="badge-line">',
      renderBadge(asset.type || 'asset', asset.type || ''),
      renderBadge(state, state),
      '</span>',
      '</article>'
    ].join('');
  }

  function renderDraftAssetInstallCard(request) {
    const item = normalizeAssetInstallRequestForViewer(request);
    return [
      '<article class="draft-asset-card draft-asset-card-install" data-asset-install-action="copy_asset_file">',
      '<strong>' + escapeHtml(item.label || item.sourceName || item.targetPath || t('assets.installRequests', 'Asset install proposal')) + '</strong>',
      item.role ? '<span class="draft-asset-role">' + escapeHtml(t('assets.role.' + item.role, item.roleLabel || item.role)) + '</span>' : '',
      '<span class="draft-asset-source">' + escapeHtml(item.sourceName || item.sourcePath || t('assets.sourcePending', 'Source file selected in this browser session')) + '</span>',
      '<code>' + escapeHtml(item.targetPath || '') + '</code>',
      '<span class="badge-line">',
      renderBadge(item.type || 'asset', item.type || ''),
      renderBadge('copy_asset_file', 'manual_review'),
      renderBadge('manual_review', 'manual_review'),
      '</span>',
      '</article>'
    ].join('');
  }

  function normalizeAssetInstallRequestForViewer(request) {
    const api = assetModelApi();
    if (api && typeof api.assetInstallRequest === 'function') {
      return api.assetInstallRequest(request || {}, {});
    }
    const item = request && typeof request === 'object' ? request : {};
    return {
      sourceName: String(item.sourceName || item.name || '').trim(),
      sourcePath: String(item.sourcePath || '').trim(),
      targetPath: String(item.targetPath || item.path || '').trim(),
      type: String(item.type || item.assetType || 'asset').trim(),
      label: String(item.label || item.sourceName || '').trim(),
      role: String(item.role || '').trim(),
      roleLabel: String(item.role || '').replace(/[_-]+/g, ' ')
    };
  }

  function localizedAssetRoleLabel(asset) {
    const role = String(asset && asset.role || '').trim();
    if (!role) {
      return asset && asset.roleLabel || '';
    }
    return t('assets.role.' + role, asset && asset.roleLabel || role);
  }

  function renderAssetPreviewFrame(asset, mode) {
    const capability = asset && asset.previewCapability ? asset.previewCapability : {};
    const mediaKind = capability.mediaKind || asset && asset.type || 'asset';
    const url = capability.url || asset && asset.path || '';
    const title = asset && (asset.label || asset.name || asset.path) || '';
    if (capability.canPreview && mediaKind === 'image') {
      return [
        '<figure class="asset-preview-frame asset-preview-image" data-asset-preview-mode="' + escapeAttr(mode || 'default') + '">',
        '<img src="' + escapeAttr(url) + '" alt="' + escapeAttr(title) + '" loading="lazy">',
        '<figcaption>' + escapeHtml(title || t('assets.previewImage', 'Image preview')) + '</figcaption>',
        '</figure>'
      ].join('');
    }
    if (capability.canPreview && mediaKind === 'audio') {
      return [
        '<figure class="asset-preview-frame asset-preview-audio" data-asset-preview-mode="' + escapeAttr(mode || 'default') + '">',
        '<audio controls preload="metadata" src="' + escapeAttr(url) + '"></audio>',
        '<figcaption>' + escapeHtml(title || t('assets.previewAudio', 'Audio preview')) + '</figcaption>',
        '</figure>'
      ].join('');
    }
    return [
      '<div class="asset-preview-frame asset-preview-empty" data-asset-preview-mode="' + escapeAttr(mode || 'default') + '">',
      '<span>' + escapeHtml(labelForBadge(mediaKind || 'asset')) + '</span>',
      '<p>' + escapeHtml(capability.message || t('assets.noPreview', 'Studio cannot directly preview this asset yet.')) + '</p>',
      '</div>'
    ].join('');
  }

  function renderNewsList(state, elements) {
    const baseItems = listForView(state.model, state.view);
    if (baseItems.length === 0) {
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('news.empty', 'No ticker news or monthly event popups were found in this index.')) + '</div>';
      state.currentItems = [];
      return;
    }
    const items = currentItems(state);
    state.currentItems = items;
    if (items.length === 0) {
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('news.noMatches', 'No matching news rows for the current search.')) + '</div>';
      return;
    }
    if (items.length >= VIRTUAL_LIST_THRESHOLD) {
      renderVirtualNewsList(state, elements, items);
      return;
    }
    const ticker = items.filter((item) => item.raw && item.raw.delivery !== 'legacy_event_popup');
    const popups = items.filter((item) => item.raw && item.raw.delivery === 'legacy_event_popup');
    const sections = [];
    if (ticker.length) {
      sections.push(renderNewsSection(t('news.tickerSection', 'Ticker / Pool News'), ticker, '', state));
    }
    if (popups.length) {
      const note = ticker.length
        ? ''
        : '<div class="list-section-note">' + escapeHtml(t('news.legacyOnlyNote', 'This project uses monthly event popups instead of Island-style ticker news.')) + '</div>';
      sections.push(renderNewsSection(t('news.popupSection', 'Monthly Event Popups'), popups, note, state));
    }
    elements.list.innerHTML = sections.join('');
  }

  function renderNewsSection(title, items, note, state) {
    return [
      '<section class="list-section">',
      '<div class="list-section-heading"><span>' + escapeHtml(title) + '</span><b>' + escapeHtml(String(items.length)) + '</b></div>',
      note || '',
      items.map((item) => renderListRow(item, state)).join(''),
      '</section>'
    ].join('');
  }

  function renderVirtualNewsList(state, elements, items) {
    prepareVirtualList(state, elements, 'news', items, '');
    const entries = newsDisplayEntries(items);
    const viewportHeight = elements.list.clientHeight || 600;
    const windowState = virtualWindowForList(entries.length, elements.list.scrollTop || 0, viewportHeight);
    const visibleEntries = entries.slice(windowState.start, windowState.end);
    elements.list.innerHTML = [
      '<div class="virtual-list" data-virtual-list="news" data-virtual-count="' + escapeAttr(String(items.length)) + '" style="height: ' + escapeAttr(String(windowState.totalHeight)) + 'px">',
      '<div class="virtual-list-window" style="transform: translateY(' + escapeAttr(String(windowState.topSpacer)) + 'px)">',
      visibleEntries.map((entry) => renderNewsDisplayEntry(entry, state)).join(''),
      '</div>',
      '</div>'
    ].join('');
  }

  function newsDisplayEntries(items) {
    const ticker = items.filter((item) => item.raw && item.raw.delivery !== 'legacy_event_popup');
    const popups = items.filter((item) => item.raw && item.raw.delivery === 'legacy_event_popup');
    const entries = [];
    if (ticker.length) {
      entries.push({
        type: 'section',
        key: 'news:ticker',
        title: t('news.tickerSection', 'Ticker / Pool News'),
        count: ticker.length
      });
      ticker.forEach((item) => entries.push({type: 'row', key: item.key, item}));
    }
    if (popups.length) {
      entries.push({
        type: 'section',
        key: 'news:popups',
        title: t('news.popupSection', 'Monthly Event Popups'),
        count: popups.length
      });
      if (!ticker.length) {
        entries.push({
          type: 'note',
          key: 'news:legacy-note',
          text: t('news.legacyOnlyNote', 'This project uses monthly event popups instead of Island-style ticker news.')
        });
      }
      popups.forEach((item) => entries.push({type: 'row', key: item.key, item}));
    }
    return entries;
  }

  function renderNewsDisplayEntry(entry, state) {
    if (entry.type === 'section') {
      return [
        '<div class="list-section-heading virtual-section-heading" data-virtual-section="' + escapeAttr(entry.key || '') + '">',
        '<span>' + escapeHtml(entry.title || '') + '</span><b>' + escapeHtml(String(entry.count || 0)) + '</b>',
        '</div>'
      ].join('');
    }
    if (entry.type === 'note') {
      return '<div class="list-section-note virtual-list-note">' + escapeHtml(entry.text || '') + '</div>';
    }
    return renderListRow(entry.item, state);
  }

  function renderTextCorpusList(state, elements) {
    const baseItems = listForView(state.model, state.view);
    if (baseItems.length === 0) {
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('textCorpus.empty', 'No player-visible text was found in this index.')) + '</div>';
      state.currentItems = [];
      return;
    }
    const items = currentItems(state);
    state.currentItems = items;
    if (items.length === 0) {
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('textCorpus.noMatches', 'No matching text rows for the current search.')) + '</div>';
      return;
    }
    if (items.length >= VIRTUAL_LIST_THRESHOLD) {
      renderVirtualTextCorpusList(state, elements, items);
      return;
    }
    const grouped = textCorpusGroups(items);
    const order = ['event_body', 'choices', 'news', 'surface', 'other'];
    elements.list.innerHTML = order
      .filter((key) => grouped.has(key))
      .map((key) => renderTextCorpusSection(textCorpusGroupLabel(key), grouped.get(key), state))
      .join('');
  }

  function textCorpusGroups(items) {
    const grouped = new Map();
    ensureArray(items).forEach((item) => {
      const group = textCorpusGroup(item.raw);
      if (!grouped.has(group)) {
        grouped.set(group, []);
      }
      grouped.get(group).push(item);
    });
    return grouped;
  }

  function renderTextCorpusSection(title, items, state) {
    return [
      '<section class="list-section">',
      '<div class="list-section-heading"><span>' + escapeHtml(title) + '</span><b>' + escapeHtml(String(items.length)) + '</b></div>',
      items.map((item) => renderListRow(item, state)).join(''),
      '</section>'
    ].join('');
  }

  function prepareVirtualList(state, elements, type, items, extra) {
    state.virtualListActive = true;
    const signature = [
      type || state.view,
      state.view,
      state.query || '',
      state.sortField || '',
      state.sortDir || '',
      ensureArray(items).length,
      extra || ''
    ].join('::');
    if (state.listRenderSignature !== signature) {
      state.listRenderSignature = signature;
      if (elements.list.scrollTop) {
        elements.list.scrollTop = 0;
      }
    }
  }

  function renderVirtualTextCorpusList(state, elements, items) {
    prepareVirtualList(state, elements, 'textCorpus', items, '');
    const entries = textCorpusDisplayEntries(items);
    const viewportHeight = elements.list.clientHeight || 600;
    const windowState = virtualWindowForList(entries.length, elements.list.scrollTop || 0, viewportHeight);
    const visibleEntries = entries.slice(windowState.start, windowState.end);
    elements.list.innerHTML = [
      '<div class="virtual-list" data-virtual-list="textCorpus" data-virtual-count="' + escapeAttr(String(items.length)) + '" style="height: ' + escapeAttr(String(windowState.totalHeight)) + 'px">',
      '<div class="virtual-list-window" style="transform: translateY(' + escapeAttr(String(windowState.topSpacer)) + 'px)">',
      visibleEntries.map((entry) => renderTextCorpusDisplayEntry(entry, state)).join(''),
      '</div>',
      '</div>'
    ].join('');
  }

  function textCorpusDisplayEntries(items) {
    const grouped = textCorpusGroups(items);
    const entries = [];
    ['event_body', 'choices', 'news', 'surface', 'other'].forEach((key) => {
      const groupItems = grouped.get(key);
      if (!groupItems || !groupItems.length) {
        return;
      }
      entries.push({
        type: 'section',
        key: 'section:' + key,
        title: textCorpusGroupLabel(key),
        count: groupItems.length
      });
      groupItems.forEach((item) => {
        entries.push({type: 'row', key: item.key, item});
      });
    });
    return entries;
  }

  function renderTextCorpusDisplayEntry(entry, state) {
    if (entry.type === 'section') {
      return [
        '<div class="list-section-heading virtual-section-heading" data-virtual-section="' + escapeAttr(entry.key || '') + '">',
        '<span>' + escapeHtml(entry.title || '') + '</span><b>' + escapeHtml(String(entry.count || 0)) + '</b>',
        '</div>'
      ].join('');
    }
    return renderListRow(entry.item, state);
  }

  function textCorpusGroup(item) {
    const role = String(item && item.role || '');
    const owner = item && item.owner || {};
    if (role === 'option_label') {
      return 'choices';
    }
    if (role.startsWith('news_') || role.startsWith('monthly_popup')) {
      return 'news';
    }
    if (role === 'surface_label' || owner.kind === 'surface_text') {
      return 'surface';
    }
    if (owner.kind === 'scene') {
      return 'event_body';
    }
    return 'other';
  }

  function textCorpusGroupLabel(key) {
    const labels = {
      event_body: t('textCorpus.group.eventBody', 'Scene / event text'),
      choices: t('textCorpus.group.choices', 'Player choices'),
      news: t('textCorpus.group.news', 'News / monthly popups'),
      surface: t('textCorpus.group.surface', 'Surface text'),
      other: t('textCorpus.group.other', 'Other text')
    };
    return labels[key] || key;
  }

  function renderListRow(item, state) {
    const badges = item.badges.map((badge) => {
      if (!badge) {
        return '';
      }
      return renderBadge(badge.text, badge.className);
    }).join('');
    const selected = item.key === state.selectedKey ? ' is-selected' : '';
    return [
      '<button class="list-row' + selected + '" type="button" data-row-key="' + escapeAttr(item.key) + '">',
      '<span><span class="primary">' + escapeHtml(item.primary) + '</span></span>',
      '<span class="secondary">' + escapeHtml(item.secondary) + '</span>',
      '<span class="meta">' + escapeHtml(item.meta) + '</span>',
      '<span class="badge-line">' + badges + visibleEditMarker(item, state) + '</span>',
      '</button>'
    ].join('');
  }

  function visibleEditMarker(item, state) {
    const view = state && state.view || '';
    if (!['events', 'cards', 'news', 'surfaceText', 'textCorpus', 'variables'].includes(view)) {
      return '';
    }
    const ui = global.ProjectMapVisibleEditActionUi;
    return ui && typeof ui.renderMarker === 'function'
      ? ui.renderMarker({label: t('visibleEdit.action', 'Edit'), translate: t, escapeHtml, escapeAttr})
      : '<span class="visible-edit-affordance" data-visible-edit-affordance="true">' + escapeHtml(t('visibleEdit.action', 'Edit')) + '</span>';
  }

  function badge(text, className) {
    return renderBadge(text, className);
  }

  function renderBadge(text, className) {
    return '<span class="badge ' + escapeAttr(className || '') + '">' + escapeHtml(labelForBadge(text)) + '</span>';
  }

  function labelForBadge(text) {
    const value = String(text || '');
    const labels = {
      exact: t('confidence.matched', 'matched'),
      static_inferred: t('confidence.inferred', 'inferred'),
      profile_heuristic: t('confidence.guessed', 'guessed'),
      opaque: t('confidence.unknown', 'unknown'),
      error: t('design.severity.error', 'Error'),
      warning: t('design.severity.warning', 'Warning'),
      info: t('design.severity.info', 'Info'),
      'In Studio, read-only': t('coverage.inStudioReadOnly', 'In Studio, read-only'),
      'In Studio, best-effort': t('coverage.inStudioBestEffort', 'In Studio, best-effort'),
      'In Studio, manual install': t('coverage.inStudioManualInstall', 'In Studio, manual install'),
      'In Studio, wiring review': t('coverage.inStudioWiringReview', 'In Studio, wiring review'),
      'In Studio, guarded': t('coverage.inStudioGuarded', 'In Studio, guarded'),
      'Mixed safe / IDE': t('coverage.mixedSafeIde', 'Mixed safe / source review'),
      'IDE guidance': t('coverage.ideGuidance', 'Source review guidance'),
      'Picker + warnings': t('coverage.pickerWarnings', 'Picker + warnings'),
      'Proposal + IDE guidance': t('coverage.proposalIdeGuidance', 'Proposal + source review guidance'),
      'Guided review only': t('coverage.guidedReviewOnly', 'Guided review only'),
      'IDE escape hatch': t('coverage.ideEscapeHatch', 'Source mapping needed'),
      'Not started': t('coverage.notStarted', 'Not started'),
      image: t('assets.type.image', 'image'),
      audio: t('assets.type.audio', 'audio'),
      asset: t('assets.type.asset', 'asset'),
      event_illustration: t('assets.role.event_illustration', 'event illustration'),
      event_portrait: t('assets.role.event_portrait', 'event portrait'),
      event_music: t('assets.role.event_music', 'event music (BGM)'),
      event_audio: t('assets.role.event_audio', 'event audio (SFX)'),
      card_image: t('assets.role.card_image', 'card image'),
      card_portrait: t('assets.role.card_portrait', 'card portrait'),
      card_music: t('assets.role.card_music', 'card music (BGM)'),
      card_audio: t('assets.role.card_audio', 'card audio (SFX)'),
      advisor_portrait: t('assets.role.advisor_portrait', 'advisor portrait'),
      reference: t('assets.role.reference', 'reference'),
      source_asset: t('assets.sourceKind.sourceAsset', 'source asset'),
      runtime_evidence: t('assets.sourceKind.runtimeEvidence', 'runtime evidence'),
      reference_only: t('assets.editability.referenceOnly', 'reference only'),
      manual_review: t('assets.editability.manualReview', 'manual review'),
      indexed: t('assets.referenceState.indexed', 'indexed'),
      missing: t('assets.referenceState.missing', 'missing asset'),
      file_missing: t('assets.referenceState.file_missing', 'file missing'),
      external: t('assets.referenceState.external', 'external'),
      empty: t('assets.slotState.empty', 'empty'),
      selected: t('assets.slotState.selected', 'selected'),
      pending_install: t('assets.slotState.pendingInstall', 'pending install'),
      copy_asset_file: t('install.action.copyAssetFile', 'copy asset file'),
      unknown: t('assets.referenceState.unknown', 'unknown'),
      text_proposal: t('textCorpus.editability.textProposal', 'text proposal'),
      draft_extractable: t('textCorpus.editability.draftExtractable', 'draft extractable'),
      source_patch: t('textCorpus.editability.sourcePatch', 'Studio source patch'),
      body: t('textCorpus.role.body', 'body'),
      heading: t('textCorpus.role.heading', 'heading'),
      title: t('textCorpus.role.title', 'title'),
      subtitle: t('textCorpus.role.subtitle', 'subtitle'),
      option_label: t('textCorpus.role.optionLabel', 'option label'),
      conditional_body: t('textCorpus.role.conditionalBody', 'conditional body'),
      unavailable_text: t('textCorpus.role.unavailableText', 'unavailable text'),
      news_headline: t('textCorpus.role.newsHeadline', 'news headline'),
      news_description: t('textCorpus.role.newsDescription', 'news description'),
      monthly_popup_excerpt: t('textCorpus.role.monthlyPopupExcerpt', 'monthly popup excerpt'),
      surface_label: t('textCorpus.role.surfaceLabel', 'surface label'),
      ide_escape_hatch: t('coverage.ideEscapeHatch', 'Source mapping needed')
    };
    if (value.startsWith('no-code ')) {
      return t('coverage.noCode', 'no-code') + ' ' + value.slice('no-code '.length);
    }
    if (value.startsWith('safe ')) {
      return t('coverage.safe', 'safe') + ' ' + value.slice('safe '.length);
    }
    if (value.startsWith('manual ')) {
      return t('coverage.manual', 'manual') + ' ' + value.slice('manual '.length);
    }
    if (value.startsWith('unsupported ')) {
      return t('coverage.unsupported', 'unsupported') + ' ' + value.slice('unsupported '.length);
    }
    return labels[value] || value;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }



    return {
      render,
      renderList,
      currentItems,
      renderOverview,
      renderFirstModRoadmap,
      renderAssetGallery,
      renderVirtualAssetGallery,
      renderAssetGalleryCard,
      renderAssetPicker,
      renderDraftAssetPanel,
      renderNewsList,
      renderTextCorpusList,
      prepareVirtualList,
      renderListRow,
      coverageClass,
      priorityClass,
      completionClass,
      escapeHtml,
      escapeAttr,
      badge,
      renderBadge,
      labelForBadge
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectMapExploreLists;
  }

  if (root) {
    root.ProjectMapExploreLists = ProjectMapExploreLists;
  }
})(typeof window !== 'undefined' ? window : globalThis);
