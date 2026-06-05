(function initProjectMapSystemUiScreenPreview(global) {
  'use strict';

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const ensureArray = domTextUtils.ensureArray;
  const escapeHtml = domTextUtils.escapeHtml;
  const escapeAttr = domTextUtils.escapeAttr;

  function render(screen) {
    const model = screen || {};
    const selectedKey = String(model.selectedKey || '').replace(/^ui:/, '');
    const shell = model.shell || {};
    const flow = model.playerFlow || {};
    const activeScreen = flow.activeScreen || 'entry_menu';
    if (model.template === 'election_results') {
      return renderElectionResults(model, selectedKey);
    }
    return [
      '<section class="system-ui-live-preview system-screen-preview ' + escapeAttr(shell.fixtureClass || '') + '" data-system-ui-live-preview="true" data-system-ui-screen-preview="true" data-system-ui-fixture-current="' + escapeAttr(model.fixture || '') + '">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.preview', 'Live preview')) + '</div>',
      renderPlayerFlowTabs(model),
      '<div class="system-screen-shell" data-system-screen-shell="true" data-system-ui-recipe="' + escapeAttr(model.template || '') + '" data-system-player-flow-active="' + escapeAttr(activeScreen) + '">',
      renderTopbar(model, selectedKey, activeScreen),
      '<div class="system-screen-body" data-system-player-screen="' + escapeAttr(activeScreen) + '">',
      renderSidebar(model, selectedKey, activeScreen),
      renderPlayerScreen(model, selectedKey, activeScreen),
      activeScreen === 'in_game' ? renderRightSidebar(model, selectedKey) : '',
      '</div>',
      '</div>',
      '</section>'
    ].join('');
  }

  function renderPlayerFlowTabs(model) {
    const flow = model && model.playerFlow || {};
    const screens = ensureArray(flow.screens);
    if (!screens.length) {
      return '';
    }
    return [
      '<div class="system-screen-flow-tabs" data-system-player-flow-tabs="true">',
      screens.map((screen) => {
        const active = screen.id === flow.activeScreen;
        return '<button type="button" class="' + (active ? 'is-active' : '') + '" data-system-player-flow-control="true" data-system-player-flow-screen="' + escapeAttr(screen.id || '') + '" aria-pressed="' + (active ? 'true' : 'false') + '">' + escapeHtml(t(screen.labelKey, screen.fallback || screen.id)) + '</button>';
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderElectionResults(model, selectedKey) {
    const shell = model.shell || {};
    const election = model.electionResults || {};
    return [
      '<section class="system-ui-live-preview system-screen-preview ' + escapeAttr(shell.fixtureClass || '') + '" data-system-ui-live-preview="true" data-system-ui-screen-preview="true" data-system-ui-fixture-current="' + escapeAttr(model.fixture || '') + '" data-system-election-results="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.preview', 'Live preview')) + '</div>',
      renderPlayerFlowTabs(model),
      '<div class="system-screen-shell system-election-results-shell" data-system-screen-shell="true" data-system-ui-recipe="election_results">',
      renderRegionButton(model, 'election_results_frame', selectedKey, [
        '<span class="system-screen-label">' + escapeHtml(t('systemUi.region.electionFrame', 'Election frame')) + '</span>',
        '<h1>' + escapeHtml(election.title || shell.title || '') + '</h1>',
        '<p>' + escapeHtml(election.subtitle || shell.subtitle || '') + '</p>'
      ].join(''), 'system-election-results-header'),
      '<div class="system-election-results-body">',
      renderRegionButton(model, 'election_results_chart', selectedKey, [
        '<span class="system-screen-label">' + escapeHtml(t('systemUi.region.electionChart', 'Seat chart')) + '</span>',
        renderSeatHemicycle(election.parties),
        '<small>' + escapeHtml(String(election.seatsTotal || '') + ' ' + t('systemUi.electionSeats', 'seats')) + '</small>'
      ].join(''), 'system-election-results-chart-region'),
      renderRegionButton(model, 'election_results_table', selectedKey, [
        '<span class="system-screen-label">' + escapeHtml(t('systemUi.region.electionTable', 'Party result table')) + '</span>',
        renderPartyTable(election.parties)
      ].join(''), 'system-election-results-table-region'),
      renderRegionButton(model, 'election_results_coalitions', selectedKey, [
        '<span class="system-screen-label">' + escapeHtml(t('systemUi.region.electionCoalitions', 'Coalitions')) + '</span>',
        renderCoalitions(election)
      ].join(''), 'system-election-results-coalition-region'),
      renderRegionButton(model, 'election_results_choices', selectedKey, [
        '<span class="system-screen-label">' + escapeHtml(t('systemUi.region.electionChoices', 'Player choices')) + '</span>',
        renderChoices(election.choices)
      ].join(''), 'system-election-results-choice-region'),
      '</div>',
      '</div>',
      '</section>'
    ].join('');
  }

  function renderTopbar(model, selectedKey, activeScreen) {
    const shell = model.shell || {};
    return [
      '<header class="system-screen-topbar">',
      renderRegionButton(model, 'screen_header', selectedKey, [
        '<span class="system-screen-label">' + escapeHtml(t('systemUi.region.header', 'Header / menu')) + '</span>',
        '<strong>' + escapeHtml(shell.title || '') + '</strong>',
        '<span>' + escapeHtml(shell.subtitle || '') + '</span>'
      ].join(''), '', slotIdFor(model, activeScreen, 'screen_header')),
      '<nav aria-label="' + escapeAttr(t('systemUi.region.header', 'Header / menu')) + '">',
      ensureArray(shell.menu).map((item) => renderTopbarMenuItem(model, item)).join(''),
      '</nav>',
      '</header>'
    ].join('');
  }

  function renderTopbarMenuItem(model, item) {
    const label = String(item || '');
    if (label.toLowerCase() !== 'library') {
      return '<span>' + escapeHtml(label) + '</span>';
    }
    const library = model && model.libraryContent || {};
    const section = firstLibrarySection(library);
    if (!library.exists || !section) {
      return '<span>' + escapeHtml(label) + '</span>';
    }
    return [
      '<button type="button" class="system-screen-topbar-link" data-object-canvas-action="open_library_content" data-system-ui-library-entry="topbar" data-system-ui-library-scene-id="' + escapeAttr(section.route && section.route.sceneId || library.sceneId || 'library') + '" data-system-ui-library-section-id="' + escapeAttr(section.route && section.route.sectionId || section.id || '') + '">',
      escapeHtml(label),
      '</button>'
    ].join('');
  }

  function firstLibrarySection(library) {
    return ensureArray(library && library.sections).find((section) => section && section.sourceBacked) ||
      ensureArray(library && library.sections)[0] ||
      null;
  }

  function renderSidebar(model, selectedKey, activeScreen) {
    const region = regionByKey(model, 'sidebar_status') || {};
    const categories = sidebarCategories(model, region);
    const selectedCategory = categories.find((category) => category.selected) || categories[0] || null;
    const categoryBody = selectedCategory ? [selectedCategory.body, selectedCategory.statusLines].filter(Boolean).join('\n') : '';
    const body = categoryBody || region.body;
    const lines = String(body || '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 18);
    return [
      '<aside class="system-screen-sidebar">',
      '<div class="system-screen-tabs" data-system-screen-sidebar-tabs="true">',
      categories.map((category) => renderSidebarCategoryTab(model, category, activeScreen)).join(''),
      '<button type="button" class="system-screen-tab-add" data-system-ui-template="workspace_layout">' + escapeHtml(t('systemUi.addSidebarCategory', 'Add category')) + '</button>',
      '</div>',
      renderRegionButton(model, 'sidebar_status', selectedKey, [
        '<span class="system-screen-label">' + escapeHtml(t(region.labelKey, region.fallback || 'Sidebar / Status')) + '</span>',
      '<strong>' + renderSystemPreviewInline(selectedCategory && selectedCategory.heading || region.title || '') + '</strong>',
      '<div class="system-screen-status-lines">',
      lines.length ? lines.map((line, index) => '<span data-system-screen-status-line="' + String(index) + '" data-system-ui-focus-field="sidebar.sectionStatusLines">' + renderSystemPreviewInline(line) + '</span>').join('') : '<span>' + escapeHtml(t('systemUi.emptyStatus', 'No status lines yet.')) + '</span>',
      '</div>'
      ].join(''), '', slotIdFor(model, activeScreen, 'sidebar_status')),
      '</aside>'
    ].join('');
  }

  function renderSidebarCategoryTab(model, category, activeScreen) {
    const value = category || {};
    const key = 'sidebar_category:' + (value.id || 'main');
    const slot = sidebarTabSlotId(model, activeScreen, value.id || '');
    return [
      '<button type="button" class="' + (value.selected ? 'is-selected ' : '') + 'system-screen-tab" data-object-canvas-graph-node="ui:' + escapeAttr(key) + '" data-system-ui-visible-slot="' + escapeAttr(slot || '') + '" data-system-ui-slot-screen="' + escapeAttr(activeScreen || '') + '" data-system-screen-sidebar-category="' + escapeAttr(value.id || '') + '" aria-pressed="' + (value.selected ? 'true' : 'false') + '">',
      escapeHtml(value.label || value.heading || value.id || ''),
      '</button>'
    ].join('');
  }

  function sidebarCategories(model, region) {
    const rows = ensureArray(model && model.sidebarCategories);
    if (rows.length) {
      return rows;
    }
    return [{
      id: 'main',
      label: 'Main',
      heading: region && region.title || 'Status',
      body: region && region.body || '',
      statusLines: '',
      selected: true
    }];
  }

  function renderPlayerScreen(model, selectedKey, activeScreen) {
    if (activeScreen === 'library_page') {
      return renderLibraryMain(model, selectedKey);
    }
    if (activeScreen === 'in_game') {
      return renderPlayableMain(model, selectedKey);
    }
    return renderEntryMain(model, selectedKey);
  }

  function renderEntryMain(model, selectedKey) {
    const main = regionByKey(model, 'main_content') || {};
    const options = regionByKey(model, 'main_options') || {};
    const mainSlot = slotById(model, 'entry_menu.main_copy') || {};
    const optionSlots = slotsForScreenRegion(model, 'entry_menu', 'main_options');
    const optionSlot = optionSlots[0] || slotById(model, 'entry_menu.start_option') || {};
    const mainTitle = mainSlot.title || mainSlot.label || main.title || '';
    const mainBody = mainSlot.body !== undefined ? mainSlot.body : main.body || '';
    const optionTitle = optionSlot.title || optionSlot.label || options.title || '';
    const optionBody = optionSlot.body !== undefined ? optionSlot.body : options.body || '';
    return [
      '<main class="system-screen-main system-screen-entry-main" data-system-entry-menu="true">',
      '<article class="system-screen-card">',
      renderRegionButton(model, 'main_content', selectedKey, [
        '<span class="system-screen-label">' + escapeHtml(t(main.labelKey, main.fallback || 'Main content')) + '</span>',
        '<h2>' + renderSystemPreviewInline(mainTitle) + '</h2>',
        mainBody && !optionSlots.length ? '<div class="system-screen-copy" data-system-screen-copy="true">' + renderSystemPreviewText(mainBody) + '</div>' : '',
        !optionSlots.length ? renderFixtureHint(model) : ''
      ].join(''), '', 'entry_menu.main_copy'),
      optionSlots.length
        ? '<div class="system-screen-entry-options" data-system-screen-entry-options="true">' + optionSlots.map((slot) => renderEntryOptionButton(model, selectedKey, slot, options)).join('') + '</div>'
        : renderRegionButton(model, 'main_options', selectedKey, [
          '<span class="system-screen-label">' + escapeHtml(t(options.labelKey, options.fallback || 'Options')) + '</span>',
          '<strong>' + renderSystemPreviewInline(optionTitle) + '</strong>',
          '<small>' + renderSystemPreviewInline(optionBody) + '</small>'
        ].join(''), '', 'entry_menu.start_option'),
      '</article>',
      '</main>'
    ].join('');
  }

  function renderEntryOptionButton(model, selectedKey, slot, optionsRegion) {
    const route = slot && slot.route || {};
    return renderRegionButton(model, 'main_options', selectedKey, [
      '<span class="system-screen-label">' + escapeHtml(t(optionsRegion.labelKey, optionsRegion.fallback || 'Options')) + '</span>',
      '<strong>' + renderSystemPreviewInline(slot && (slot.title || slot.label) || '') + '</strong>',
      route.sceneId ? '<small>' + renderSystemPreviewInline(route.sceneId) + '</small>' : ''
    ].join(''), 'system-screen-entry-choice', slot && slot.id || '');
  }

  function renderLibraryMain(model, selectedKey) {
    const library = model && model.libraryContent || {};
    const sections = ensureArray(library.sections);
    return [
      '<main class="system-screen-main system-screen-library-main" data-system-library-page="true">',
      '<article class="system-screen-card system-screen-library-card">',
      '<h2>' + escapeHtml(library.title || t('systemUi.flow.library', 'Library')) + '</h2>',
      sections.length
        ? '<div class="system-screen-library-list" data-system-library-section-list="true">' + sections.map((section) => renderLibrarySectionButton(model, section, selectedKey)).join('') + '</div>'
        : '<p class="editing-empty">' + escapeHtml(library.manualReason || t('systemUi.libraryContentEmpty', 'No Library content sections were found.')) + '</p>',
      '</article>',
      '</main>'
    ].join('');
  }

  function renderLibrarySectionButton(model, section) {
    const value = section || {};
    const slotId = 'library_page.section:' + safeSlotId(value.id || value.label || 'content');
    return [
      '<button type="button" class="system-screen-library-section" data-object-canvas-action="open_library_content" data-system-ui-visible-slot="' + escapeAttr(slotId) + '" data-system-ui-slot-screen="library_page" data-system-ui-library-scene-id="' + escapeAttr(value.route && value.route.sceneId || 'library') + '" data-system-ui-library-section-id="' + escapeAttr(value.route && value.route.sectionId || value.id || '') + '" data-system-ui-source-state="' + escapeAttr(value.sourceBacked ? 'source_backed' : 'manual_review') + '">',
      '<strong>' + renderSystemPreviewInline(value.label || '') + '</strong>',
      value.body ? '<div class="system-screen-library-section-copy">' + renderSystemPreviewText(value.body) + '</div>' : '',
      '</button>'
    ].join('');
  }

  function renderPlayableMain(model, selectedKey) {
    const main = regionByKey(model, 'main_content') || {};
    const options = regionByKey(model, 'main_options') || {};
    const sceneSlot = slotById(model, 'in_game.scene_copy') || {};
    const optionSlot = slotById(model, 'in_game.scene_option') || {};
    const mainTitle = sceneSlot.title || sceneSlot.label || main.title || '';
    const mainBody = sceneSlot.body !== undefined ? sceneSlot.body : main.body || '';
    const optionTitle = optionSlot.title || optionSlot.label || options.title || '';
    const optionBody = optionSlot.body !== undefined ? optionSlot.body : options.body || '';
    return [
      '<main class="system-screen-main system-screen-play-main" data-system-play-surface="true">',
      '<article class="system-screen-card system-screen-play-card">',
      renderRegionButton(model, 'main_content', selectedKey, [
        '<h2>' + renderSystemPreviewInline(mainTitle) + '</h2>',
        '<div class="system-screen-copy" data-system-screen-copy="true">' + renderSystemPreviewText(mainBody) + '</div>',
        renderFixtureHint(model)
      ].join(''), 'system-screen-play-story', 'in_game.scene_copy'),
      renderRegionButton(model, 'main_options', selectedKey, [
        '<strong>' + renderSystemPreviewInline(optionTitle) + '</strong>',
        optionBody ? '<small>' + renderSystemPreviewInline(optionBody || '') + '</small>' : ''
      ].join(''), 'system-screen-play-choice', 'in_game.scene_option'),
      renderPlaySection(model, selectedKey, t('systemUi.playDecks', 'Decks - click a deck to draw a card.'), 'deck_lane', 'in_game.deck', [
        renderPlayTile(model, 'deck_lane', selectedKey, 'deck', 'in_game.deck')
      ].join(''), 'deck'),
      renderPlaySection(model, selectedKey, t('systemUi.playHand', 'Hand - click a card to play.'), 'workspace_hand', 'in_game.hand', [
        renderPlayTile(model, 'action_card', selectedKey, 'card', 'in_game.card'),
        renderEmptyPlaySlot(),
        renderEmptyPlaySlot()
      ].join(''), 'hand'),
      renderPlaySection(model, selectedKey, t('systemUi.playAdvisors', 'Advisors'), 'advisor_lane', 'in_game.advisors', [
        renderPlayTile(model, 'advisor_lane', selectedKey, 'advisor', 'in_game.advisors')
      ].join(''), 'advisor'),
      '</article>',
      '</main>'
    ].join('');
  }

  function renderRightSidebar(model, selectedKey) {
    const region = regionByKey(model, 'right_sidebar') || {};
    return [
      '<aside class="system-screen-right-sidebar" data-system-screen-right-sidebar="true">',
      renderRegionButton(model, 'right_sidebar', selectedKey, [
        '<span class="system-screen-label">' + escapeHtml(t(region.labelKey, region.fallback || 'Right sidebar')) + '</span>',
        '<strong>' + renderSystemPreviewInline(region.title || '') + '</strong>',
        '<div class="system-screen-copy" data-system-screen-copy="true">' + renderSystemPreviewText(region.body || '') + '</div>'
      ].join(''), 'system-screen-right-sidebar-panel'),
      '</aside>'
    ].join('');
  }

  function renderPlaySection(model, selectedKey, title, regionKey, slotId, inner, key) {
    return [
      '<section class="system-screen-play-section system-screen-play-section-' + escapeAttr(key || 'item') + '" data-system-play-section="' + escapeAttr(key || 'item') + '">',
      renderRegionButton(model, regionKey, selectedKey, '<h3>' + escapeHtml(title) + '</h3>', 'system-screen-play-section-title', slotId),
      '<div class="system-screen-play-grid">',
      inner,
      '</div>',
      '</section>'
    ].join('');
  }

  function renderPlayTile(model, key, selectedKey, kind, slotId) {
    const region = regionByKey(model, key) || {};
    return renderRegionButton(model, key, selectedKey, [
      '<span class="system-screen-label">' + escapeHtml(t(region.labelKey, region.fallback || key)) + '</span>',
      '<strong>' + renderSystemPreviewInline(region.title || '') + '</strong>',
      '<small>' + renderSystemPreviewInline(region.body || '') + '</small>'
    ].join(''), 'system-screen-play-tile system-screen-play-tile-' + safeClass(kind || key), slotId);
  }

  function renderEmptyPlaySlot() {
    return '<div class="system-screen-empty-card-slot" data-system-play-empty-slot="true" aria-hidden="true"></div>';
  }

  function renderInteractiveRail(model, selectedKey) {
    return [
      '<aside class="system-screen-interactions">',
      renderCompactRegion(model, 'workspace_hand', selectedKey),
      '<div class="system-screen-object-row">',
      renderCompactRegion(model, 'deck_lane', selectedKey),
      renderCompactRegion(model, 'action_card', selectedKey),
      '</div>',
      renderCompactRegion(model, 'advisor_lane', selectedKey),
      '</aside>'
    ].join('');
  }

  function renderLayoutFrame(model, selectedKey) {
    const region = regionByKey(model, 'layout_frame') || {};
    return renderRegionButton(model, 'layout_frame', selectedKey, [
      '<span>' + escapeHtml(t(region.labelKey, region.fallback || 'Screen frame')) + '</span>',
      '<strong>' + escapeHtml(t('systemUi.region.layoutFrameHint', 'Shared screen shell')) + '</strong>'
    ].join(''), 'system-screen-layout-frame');
  }

  function renderCompactRegion(model, key, selectedKey) {
    const region = regionByKey(model, key) || {};
    return renderRegionButton(model, key, selectedKey, [
      '<span class="system-screen-label">' + escapeHtml(t(region.labelKey, region.fallback || key)) + '</span>',
      '<strong>' + renderSystemPreviewInline(region.title || '') + '</strong>',
      '<small>' + renderSystemPreviewInline(region.body || '') + '</small>'
    ].join(''));
  }

  function renderRegionButton(model, key, selectedKey, inner, extraClass, slotId) {
    const region = regionByKey(model, key) || {family: '', key};
    const slot = slotId && model && model.playerFlow && model.playerFlow.bySlot ? model.playerFlow.bySlot[slotId] : null;
    const activeFamilies = ensureArray(model.focusFamilies);
    const selected = slot ? Boolean(model && model.selectedSlot && model.selectedSlot.id === slot.id) : selectedKey === key;
    const focus = activeFamilies.includes(region.family);
    const owner = region.ownerTemplate || '';
    const capability = region.capability || {};
    const className = [
      'system-screen-region',
      'system-screen-region-' + safeClass(key),
      'system-screen-family-' + safeClass(region.family),
      selected ? 'is-selected' : '',
      focus ? 'is-recipe-focus' : '',
      extraClass || ''
    ].filter(Boolean).join(' ');
    const route = slot && slot.route || {};
    const actionAttrs = slot && slot.actionKind === 'open_content_scene'
      ? ' data-object-canvas-action="open_system_content_scene" data-system-ui-content-scene-id="' + escapeAttr(route.sceneId || '') + '" data-system-ui-content-section-id="' + escapeAttr(route.sectionId || '') + '"'
      : '';
    return '<button type="button" class="' + className + '" data-object-canvas-graph-node="ui:' + escapeAttr(key) + '"' + actionAttrs + ' data-system-ui-visible-slot="' + escapeAttr(slot && slot.id || '') + '" data-system-ui-slot-screen="' + escapeAttr(slot && slot.screen || '') + '" data-system-ui-slot-action="' + escapeAttr(slot && slot.actionKind || '') + '" data-system-ui-source-state="' + escapeAttr(slot && slot.sourceState || '') + '" data-system-ui-region="' + escapeAttr(key) + '" data-system-screen-region="' + escapeAttr(key) + '" data-system-screen-family="' + escapeAttr(region.family || '') + '" data-system-screen-owner-template="' + escapeAttr(owner) + '" data-system-ui-runtime-state="' + escapeAttr(capability.runtimeEvidenceState || '') + '" data-system-ui-install-safety="' + escapeAttr(capability.installSafety || '') + '" aria-pressed="' + (selected ? 'true' : 'false') + '">' + inner + '</button>';
  }

  function slotById(model, slotId) {
    const id = String(slotId || '');
    return model && model.playerFlow && model.playerFlow.bySlot ? model.playerFlow.bySlot[id] || null : null;
  }

  function slotsForScreenRegion(model, screenId, regionKey) {
    return ensureArray(model && model.playerFlow && model.playerFlow.byScreen && model.playerFlow.byScreen[screenId] && model.playerFlow.byScreen[screenId].slots)
      .filter((slot) => slot && slot.regionKey === regionKey && !slot.categoryId);
  }

  function slotIdFor(model, screenId, regionKey) {
    const slots = ensureArray(model && model.playerFlow && model.playerFlow.byScreen && model.playerFlow.byScreen[screenId] && model.playerFlow.byScreen[screenId].slots);
    const slot = slots.find((item) => item && item.regionKey === regionKey && !item.categoryId);
    return slot && slot.id || '';
  }

  function sidebarTabSlotId(model, screenId, categoryId) {
    const slots = ensureArray(model && model.playerFlow && model.playerFlow.byScreen && model.playerFlow.byScreen[screenId] && model.playerFlow.byScreen[screenId].slots);
    const slot = slots.find((item) => item && item.categoryId === categoryId);
    return slot && slot.id || '';
  }

  function safeSlotId(value) {
    return String(value || 'slot').trim().replace(/[^A-Za-z0-9_.:-]+/g, '_') || 'slot';
  }

  function renderFixtureHint(model) {
    const fixture = model.fixtureState || {};
    const hint = String(fixture.mainHint || '').trim();
    return hint ? '<small class="system-screen-fixture-hint">' + escapeHtml(hint) + '</small>' : '';
  }

  function renderSeatHemicycle(parties) {
    const chart = global.ProjectMapElectionResultsChart;
    if (chart && typeof chart.render === 'function') {
      return [
        '<div class="system-election-seat-chart system-election-seat-chart-d3" data-system-election-seat-chart="true">',
        chart.render(parties, {seatsTotal: partySeatTotal(parties), label: t('systemUi.region.electionChart', 'Seat chart'), innerRadiusCoef: 0.4}),
        '</div>'
      ].join('');
    }
    const rows = [12, 18, 24, 30, 36, 42, 42, 36, 30, 24, 18, 12];
    const seats = seatDots(parties, rows.reduce((total, count) => total + count, 0));
    let offset = 0;
    return [
      '<div class="system-election-seat-chart" data-system-election-seat-chart="true">',
      rows.map((count, rowIndex) => {
        const dots = seats.slice(offset, offset + count);
        offset += count;
        return '<div class="system-election-seat-row" style="--seat-row-index: ' + String(rowIndex) + ';">' + dots.map((party) => '<span class="system-election-seat" title="' + escapeAttr(party.name || '') + '" style="--party-color: ' + escapeAttr(party.color || '#999999') + ';"></span>').join('') + '</div>';
      }).join(''),
      '</div>'
    ].join('');
  }

  function partySeatTotal(parties) {
    return ensureArray(parties).reduce((total, party) => total + (Number(party && party.seats) || 0), 0);
  }

  function seatDots(parties, totalDots) {
    const rows = ensureArray(parties).filter((party) => party && party.name);
    if (!rows.length) {
      return Array.from({length: totalDots}).map(() => ({name: '', color: '#d8d3c4'}));
    }
    const weights = rows.map((party) => Math.max(0, Number(party.seats) || Number(party.seatsShare) || 0));
    const totalWeight = weights.reduce((total, weight) => total + weight, 0) || rows.length;
    const raw = rows.map((party, index) => {
      const weight = totalWeight ? weights[index] || (totalWeight === rows.length ? 1 : 0) : 1;
      const exact = totalDots * weight / totalWeight;
      return {party, count: Math.floor(exact), remainder: exact - Math.floor(exact)};
    });
    let assigned = raw.reduce((total, row) => total + row.count, 0);
    raw.sort((a, b) => b.remainder - a.remainder);
    for (let index = 0; assigned < totalDots; index = (index + 1) % raw.length) {
      raw[index].count += 1;
      assigned += 1;
    }
    raw.sort((a, b) => ensureArray(parties).indexOf(a.party) - ensureArray(parties).indexOf(b.party));
    return raw.reduce((all, row) => {
      for (let index = 0; index < row.count; index += 1) {
        all.push(row.party);
      }
      return all;
    }, []).slice(0, totalDots);
  }

  function renderPartyTable(parties) {
    const rows = ensureArray(parties);
    if (!rows.length) {
      return '<p class="editing-empty">' + escapeHtml(t('systemUi.noElectionParties', 'No parties yet.')) + '</p>';
    }
    return [
      '<div class="system-election-table" data-system-election-table="true">',
      '<div class="system-election-table-head"><span>' + escapeHtml(t('systemUi.party', 'Party')) + '</span><span>' + escapeHtml(t('systemUi.voteShare', 'Vote share')) + '</span><span>' + escapeHtml(t('systemUi.change', '% Change')) + '</span><span>' + escapeHtml(t('systemUi.seatsShare', 'Reichstag Seats')) + '</span><span>' + escapeHtml(t('systemUi.change', '% Change')) + '</span></div>',
      rows.map((party) => [
        '<div class="system-election-table-row">',
        '<strong class="system-election-party-cell"><span class="system-election-swatch" style="--party-color: ' + escapeAttr(party.color || '#999999') + ';"></span>' + escapeHtml(party.name || '') + '</strong>',
        '<span>' + escapeHtml(formatPercent(party.voteShare)) + '</span>',
        renderDelta(party.voteChange),
        '<span>' + escapeHtml(formatPercent(party.seatsShare)) + '</span>',
        renderDelta(party.seatsChange),
        '</div>'
      ].join('')).join(''),
      '</div>'
    ].join('');
  }

  function renderDelta(value) {
    const parsed = Number(value);
    const className = parsed >= 0 ? 'is-positive' : 'is-negative';
    const symbol = parsed >= 0 ? '&#9650;' : '&#9660;';
    return '<span class="system-election-delta ' + className + '"><span aria-hidden="true">' + symbol + '</span> ' + escapeHtml(Math.abs(Number.isFinite(parsed) ? parsed : 0)) + '</span>';
  }

  function renderCoalitions(election) {
    const parties = ensureArray(election && election.parties);
    const rows = ensureArray(election && election.coalitions);
    return [
      '<div class="system-election-coalitions" data-system-election-coalitions="true">',
      '<h2>' + escapeHtml(t('systemUi.potentialCoalitions', 'Potential coalitions')) + '</h2>',
      election && election.intro ? '<p>' + escapeHtml(election.intro) + '</p>' : '',
      rows.map((coalition) => [
        '<div class="system-election-coalition-row">',
        '<strong>' + escapeHtml(coalition.name || '') + '</strong>',
        '<span>(' + renderPartyFormula(coalition.parties, parties) + '): ' + escapeHtml(formatPercent(coalition.share)) + '</span>',
        coalition.description ? '<small>' + escapeHtml(coalition.description) + '</small>' : '',
        '</div>'
      ].join('')).join(''),
      '</div>'
    ].join('');
  }

  function renderPartyFormula(value, parties) {
    return String(value || '').split('+').map((part) => {
      const name = part.trim();
      const party = parties.find((row) => row && row.name && row.name.toLowerCase() === name.toLowerCase());
      const color = party && party.color || '#3f3522';
      return '<span class="system-election-party-name" style="--party-color: ' + escapeAttr(color) + ';">' + escapeHtml(name) + '</span>';
    }).join(' <span class="system-election-plus">+</span> ');
  }

  function renderChoices(choices) {
    const rows = ensureArray(choices);
    return [
      '<div class="system-election-choice-list" data-system-election-choices="true">',
      rows.map((choice, index) => [
        '<div class="system-election-choice' + (choice.disabled ? ' is-disabled' : '') + '">',
        '<span class="system-election-choice-index">' + String(index + 1) + '</span>',
        '<strong>' + escapeHtml(choice.label || '') + '</strong>',
        choice.detail ? '<em>' + renderChoiceFormula(choice.detail) + '</em>' : '',
        '</div>'
      ].join('')).join(''),
      '</div>'
    ].join('');
  }

  function renderChoiceFormula(value) {
    return escapeHtml(value).replace(/\b(SPD|KPD|DDP|Z|BVP|DVP|DNVP|NSDAP|Others)\b/g, '<span>$1</span>');
  }

  function formatPercent(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return String(value || '');
    }
    return String(parsed) + '%';
  }

  function regionByKey(model, key) {
    return ensureArray(model && model.regions).find((region) => region && region.key === key) || null;
  }

  function renderSystemPreviewText(value) {
    const renderer = richTextApi();
    if (renderer && typeof renderer.renderBlocks === 'function') {
      return renderer.renderBlocks(value, {empty: false});
    }
    const text = String(value || '').trim();
    return text ? '<p>' + escapeHtml(text) + '</p>' : '';
  }

  function renderSystemPreviewInline(value) {
    const renderer = richTextApi();
    if (renderer && typeof renderer.renderInline === 'function') {
      return renderer.renderInline(value);
    }
    return escapeHtml(value);
  }

  function richTextApi() {
    if (global && global.ProjectMapVisibleTextRenderer) {
      return global.ProjectMapVisibleTextRenderer;
    }
    if (typeof require === 'function') {
      try {
        return require('./visible_text_renderer.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function safeClass(value) {
    return String(value || 'item').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  const api = {render};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSystemUiScreenPreview = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
