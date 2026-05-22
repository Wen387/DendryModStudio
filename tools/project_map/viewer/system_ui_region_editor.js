(function initProjectMapSystemUiRegionEditor(global) {
  'use strict';

  function render(model, screen, options) {
    const opts = isObject(options) ? options : {};
    const selected = screen && screen.selected || null;
    const selectedSlot = screen && screen.selectedSlot || null;
    const taskOptions = Object.assign({}, opts, {
      selectedTaskId: opts.selectedTaskId || selectedSlot && selectedSlot.taskId || '',
      focusFieldId: opts.focusFieldId || selectedSlot && selectedSlot.focusFieldId || ''
    });
    const selectedTask = selected ? selectedSemanticTask(selected, taskOptions) : null;
    return [
      '<aside class="system-ui-inspector" data-system-ui-inspector="true">',
      selected ? renderTaskDetails(screen, selected, selectedTask, taskOptions) : '',
      renderActions(model, opts),
      selected ? renderCardBoardHandoff(selected) : '',
      renderRuntimeLens(model, screen, opts),
      selected ? renderSelectedRegion(screen, selected) : '',
      selected ? renderAdvancedDetails(screen, selected) : '',
      renderDiagnostics(screen),
      '</aside>'
    ].join('');
  }
  function renderSelectedRegion(screen, region) {
    const context = screen.regionContext || {};
    const ownership = context.ownership || {};
    const family = ensureArray(screen.families).find((item) => item.key === region.family) || {};
    return [
      '<details class="object-canvas-inspector-card system-ui-selected-context" data-system-ui-selected-region="' + escapeAttr(region.key) + '" data-system-ui-selected-family="' + escapeAttr(region.family) + '" data-system-ui-owner-template="' + escapeAttr(ownership.ownerTemplate || region.ownerTemplate || '') + '" data-system-ui-capability-region="' + escapeAttr(region.key || '') + '">',
      '<summary>' + escapeHtml(t('systemUi.selectedRegionDetails', 'Selected region details')) + '</summary>',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.selectedRegion', 'Selected UI region')) + '</div>',
      '<h3>' + escapeHtml(region.title) + '</h3>',
      '<p>' + escapeHtml(region.body) + '</p>',
      '<dl class="system-screen-selection-meta">',
      '<dt>' + escapeHtml(t('systemUi.objectFamily', 'Object family')) + '</dt><dd>' + escapeHtml(t(family.labelKey, family.fallback || region.family)) + '</dd>',
      '<dt>' + escapeHtml(t('systemUi.ownerTemplate', 'Owner draft')) + '</dt><dd>' + escapeHtml(t(ownership.ownerLabelKey || region.ownerLabelKey, ownership.ownerFallback || region.ownerFallback || '')) + '</dd>',
      '<dt>' + escapeHtml(t('systemUi.ownerSlot', 'Visible slot')) + '</dt><dd>' + escapeHtml(ownership.ownerSlot || region.ownerSlot || '') + '</dd>',
      '</dl>',
      renderRegionMirror(region),
      '</details>'
    ].join('');
  }

  function renderCapabilitySummary(capability) {
    const value = isObject(capability) ? capability : {};
    const theme = isObject(value.themeLayoutCandidate) ? value.themeLayoutCandidate : {};
    const runtime = isObject(value.runtimeEvidenceSummary) ? value.runtimeEvidenceSummary : {};
    const fields = ensureArray(value.supportedEditFields);
    const state = String(value.runtimeEvidenceState || 'runtime_custom');
    return [
      '<section class="content-storyboard-detail system-ui-capability-card" data-system-ui-capability="true" data-system-ui-runtime-state="' + escapeAttr(state) + '" data-system-ui-install-safety="' + escapeAttr(value.installSafety || '') + '" data-system-ui-theme-layout-candidate="' + (theme.supported ? 'true' : 'false') + '">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.advancedEvidence', 'Advanced evidence')) + '</div>',
      '<h4>' + escapeHtml(t('systemUi.capabilityMatrix', 'Capability matrix')) + '</h4>',
      '<dl class="system-screen-selection-meta">',
      '<dt>' + escapeHtml(t('systemUi.installSafety', 'Install safety')) + '</dt><dd>' + escapeHtml(value.installSafety || 'manual_review') + '</dd>',
      '<dt>' + escapeHtml(t('systemUi.runtimeEvidence', 'Runtime evidence')) + '</dt><dd>' + escapeHtml(runtimeEvidenceLabel(state)) + '</dd>',
      '<dt>' + escapeHtml(t('systemUi.runtimeVisible', 'Runtime visible')) + '</dt><dd>' + escapeHtml(runtime.visible ? t('systemUi.runtimeVisible.yes', 'Found in the live DOM') : t('systemUi.runtimeVisible.no', 'No live DOM match yet')) + '</dd>',
      '<dt>' + escapeHtml(t('systemUi.themeLayoutCandidate', 'Theme/layout candidate')) + '</dt><dd>' + escapeHtml(theme.supported ? theme.scope || 'limited_source_backed' : theme.reason || 'manual') + '</dd>',
      '</dl>',
      fields.length ? '<div class="system-ui-supported-fields" data-system-ui-supported-fields="true">' + fields.map(renderCapabilityField).join('') + '</div>' : '',
      value.manualReason ? '<p class="editing-empty" data-system-ui-manual-reason="true">' + escapeHtml(value.manualReason) + '</p>' : '',
      '</section>'
    ].join('');
  }
  function renderCapabilityField(field) {
    return [
      '<span data-system-ui-supported-field="' + escapeAttr(field && field.id || '') + '" data-system-ui-field-safety="' + escapeAttr(field && field.installSafety || '') + '">',
      escapeHtml(field && (field.label || field.id) || ''),
      '</span>'
    ].join('');
  }

  function renderRegionMirror(region) {
    return [
      '<div class="system-ui-region-mirror" data-system-ui-region-mirror="true">',
      '<span>' + escapeHtml(t(region.labelKey, region.fallback || 'Region')) + '</span>',
      '<strong>' + escapeHtml(region.title || '') + '</strong>',
      region.body ? '<small>' + escapeHtml(region.body) + '</small>' : '',
      '</div>'
    ].join('');
  }

  function renderCardBoardHandoff(region) {
    const lane = cardBoardLaneForRegion(region && region.key);
    if (!lane) {
      return '';
    }
    return [
      '<details class="system-ui-card-board-handoff" data-system-ui-card-board-handoff="true">',
      '<summary>' + escapeHtml(t('cardBoard.openFromSystem', 'Open Card Board')) + '</summary>',
      '<p>' + escapeHtml(t('cardBoard.openFromSystemHelp', 'This UI object belongs to the card play area. Open Card Board to edit hand, deck, advisor, and card faces together.')) + '</p>',
      '<button type="button" data-object-canvas-action="open_card_board" data-system-ui-region-key="' + escapeAttr(region.key || '') + '" data-system-ui-card-board-lane="' + escapeAttr(lane.key) + '" data-system-ui-card-board-lane-label="' + escapeAttr(t(lane.labelKey, lane.fallback)) + '">' + escapeHtml(t('cardBoard.openFromSystem', 'Open Card Board')) + '</button>',
      '</details>'
    ].join('');
  }

  function cardBoardLaneForRegion(key) {
    return {
      workspace_hand: {key: 'hand', labelKey: 'cardBoard.lane.hand', fallback: 'Hand'},
      deck_lane: {key: 'deck', labelKey: 'cardBoard.lane.deck', fallback: 'Deck'},
      action_card: {key: 'deck', labelKey: 'cardBoard.lane.deck', fallback: 'Deck'},
      advisor_lane: {key: 'advisor', labelKey: 'cardBoard.lane.advisor', fallback: 'Advisor / pinned'}
    }[String(key || '')] || null;
  }

  function renderRuntimeLens(model, screen, options) {
    const api = runtimeLensApi();
    if (!api || typeof api.renderPanel !== 'function') {
      return '';
    }
    const focus = typeof api.focusFromSystemRegion === 'function'
      ? api.focusFromSystemRegion(options && options.projectIndex, model, screen && screen.selectedKey, {fixture: screen && screen.fixture})
      : {};
    return api.renderPanel({
      focus,
      session: options.runtimeLensSession,
      status: options.runtimeLensStatus,
      sessionFocusKey: options.runtimeLensFocusKey,
      sessionDraftKey: options.runtimeLensDraftKey,
      currentDraftKey: options.runtimeLensCurrentDraftKey,
      expanded: options.runtimeLensExpanded,
      collapsed: options.runtimeLensCollapsed
    });
  }

  function selectedSemanticTask(selected, options) {
    const tasks = ensureArray(selected && selected.semanticTasks);
    const focusFieldId = String(options && options.focusFieldId || '').trim();
    const selectedTaskId = String(options && options.selectedTaskId || '').trim();
    if (selectedTaskId) {
      const byId = tasks.find((task) => task.id === selectedTaskId);
      if (byId) {
        return byId;
      }
    }
    if (focusFieldId) {
      const byFocus = tasks.find((task) => task.primaryFieldId === focusFieldId || ensureArray(task.fields).some((field) => field && field.id === focusFieldId));
      if (byFocus) {
        return byFocus;
      }
    }
    return tasks.find((task) => ensureArray(task.fields).length && task.actionKind !== 'runtime_review') || tasks[0] || null;
  }

  function renderSemanticTaskPanel(screen, selected, selectedTask, options) {
    const proposal = renderVisibleEditProposal(options, selectedTask);
    if (!selectedTask && !proposal) {
      return '';
    }
    return [
      '<section class="object-canvas-inspector-card system-ui-semantic-task-panel" data-system-ui-semantic-task-panel="true" data-system-ui-current-task="' + escapeAttr(selectedTask && selectedTask.id || '') + '">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.semanticTaskEyebrow', 'Semantic edit')) + '</div>',
      '<h3>' + escapeHtml(selectedTask ? t(selectedTask.labelKey, selectedTask.label || selectedTask.intent || t('systemUi.semanticTaskTitle', 'Current editable area')) : t('systemUi.semanticTaskTitle', 'Current editable area')) + '</h3>',
      selectedTask ? '<p>' + escapeHtml(t(selectedTask.beginnerSummaryKey, selectedTask.beginnerSummary || '')) + '</p>' : '<p>' + escapeHtml(t('systemUi.semanticTaskHelp', 'Edit the selected player-facing area below. Safety and source evidence are in Advanced details.')) + '</p>',
      proposal,
      selectedTask ? '<p class="system-ui-task-status" data-system-ui-task-status="true">' + escapeHtml(taskStatusLabel(selectedTask)) + '</p>' : '',
      '</section>'
    ].join('');
  }
  function renderVisibleEditProposal(options, task) {
    const replacement = String(options && options.replacementText || '').trim();
    if (!replacement) {
      return '';
    }
    const focusFieldId = String(options && options.focusFieldId || '').trim();
    const fieldMatched = Boolean(focusFieldId && task && ensureArray(task.fields).some((field) => field && field.id === focusFieldId));
    return [
      '<div class="system-ui-visible-edit-proposal" data-system-ui-visible-edit-proposal="true" data-system-ui-visible-edit-field-matched="' + (fieldMatched ? 'true' : 'false') + '">',
      '<strong>' + escapeHtml(fieldMatched ? t('systemUi.visibleEditMatched', 'Visible edit text is ready in the matching field.') : t('systemUi.visibleEditNeedsReview', 'Visible edit text needs review before it can be placed.')) + '</strong>',
      '<span>' + escapeHtml(replacement) + '</span>',
      !fieldMatched && options && options.manualReason ? '<small>' + escapeHtml(options.manualReason) + '</small>' : '',
      '</div>'
    ].join('');
  }

  function renderTaskCard(task, selectedTask) {
    const active = selectedTask && selectedTask.id === task.id;
    const state = String(task.runtimeEvidenceState || task.sourceEvidenceState || '');
    return [
      '<div class="system-ui-task-card' + (active ? ' is-active' : '') + '" data-system-ui-semantic-task="' + escapeAttr(task.id || '') + '" data-system-ui-task-intent="' + escapeAttr(task.intent || '') + '" data-system-ui-task-action="' + escapeAttr(task.actionKind || '') + '" data-system-ui-task-safety="' + escapeAttr(task.safety || '') + '" data-system-ui-task-runtime-state="' + escapeAttr(state) + '">',
      '<strong>' + escapeHtml(t(task.labelKey, task.label || task.intent || 'Task')) + '</strong>',
      '<span>' + escapeHtml(t(task.beginnerSummaryKey, task.beginnerSummary || '')) + '</span>',
      '<small>' + escapeHtml(task.safety || 'manual_review') + ' / ' + escapeHtml(runtimeEvidenceLabel(state)) + '</small>',
      '</div>'
    ].join('');
  }
  function renderTaskDetails(screen, selected, task, options) {
    const topChromeTask = ensureArray(selected && selected.semanticTasks).find((item) => item && item.actionKind === 'top_chrome_diagnostics');
    const libraryTask = ensureArray(selected && selected.semanticTasks).find((item) => item && item.actionKind === 'open_content_scene');
    return [
      renderSemanticRegionFields(screen, selected, task, options),
      libraryTask ? renderLibraryContentDiagnostics(screen, libraryTask) : '',
      topChromeTask ? renderTopChromeDiagnostics(screen, topChromeTask) : ''
    ].join('');
  }
  function renderSemanticRegionFields(screen, selected, task, options) {
    const sidebarMode = task && task.actionKind === 'sidebar_composer';
    const slot = screen && screen.selectedSlot || null;
    const contentSceneMode = slot && slot.actionKind === 'open_content_scene';
    const fields = contentSceneMode ? [] : task && ensureArray(task.fields).length ? ensureArray(task.fields) : selected && selected.fields || [];
    const title = slot && slot.label || task && t(task.labelKey, task.label || task.intent || 'Edit') || selected && selected.title || '';
    const summary = slot && slot.body
      ? slot.body
      : task ? t(task.beginnerSummaryKey, task.beginnerSummary || '') : '';
    return [
      '<section class="object-event-body system-ui-semantic-fields" data-object-canvas-event-body="true" data-system-ui-region-fields="true" data-system-ui-semantic-fields="true"' + (sidebarMode ? ' data-system-ui-sidebar-composer="true"' : '') + ' data-system-ui-active-task="' + escapeAttr(task && task.id || '') + '" data-system-ui-selected-slot="' + escapeAttr(slot && slot.id || '') + '">',
      '<div class="template-eyebrow">' + escapeHtml(sidebarMode ? t('systemUi.sidebarComposer', 'Sidebar editing') : t('systemUi.editVisibleContent', 'Edit what the player sees')) + '</div>',
      title ? '<h3>' + escapeHtml(title) + '</h3>' : '',
      sidebarMode ? renderSelectedSidebarSummary(screen) : '',
      sidebarMode ? renderSidebarComposerModes(screen, task) : '',
      summary ? '<p class="editing-empty">' + escapeHtml(summary) + '</p>' : '',
      renderVisibleEditProposal(options, task),
      contentSceneMode ? renderContentSceneHandoff(slot) : '',
      fields.length
        ? fields.map((field) => renderField(field, options)).join('')
        : '<p class="editing-empty">' + escapeHtml(slotManualReason(slot) || task && task.manualReason || t('systemUi.noRegionFields', 'This region is visible for context; this recipe has no direct fields for it.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderContentSceneHandoff(slot) {
    const route = slot && slot.route || {};
    if (!route.sceneId) {
      return '';
    }
    return [
      '<div class="system-ui-content-scene-handoff" data-system-ui-content-scene-handoff="true">',
      '<button type="button" data-object-canvas-action="open_system_content_scene" data-system-ui-content-scene-id="' + escapeAttr(route.sceneId || '') + '" data-system-ui-content-section-id="' + escapeAttr(route.sectionId || '') + '">',
      escapeHtml(t('systemUi.openContentScene', 'Open this scene text')),
      '</button>',
      slotManualReason(slot) ? '<small>' + escapeHtml(slotManualReason(slot)) + '</small>' : '',
      '</div>'
    ].join('');
  }

  function slotManualReason(slot) {
    if (!slot) {
      return '';
    }
    return slot.manualReasonKey ? t(slot.manualReasonKey, slot.manualReason || '') : slot.manualReason || '';
  }
  function renderSelectedSidebarSummary(screen) {
    const category = screen && screen.selectedSidebarCategory || null;
    if (!category || !category.id) {
      return '';
    }
    return [
      '<div class="system-ui-sidebar-current" data-system-ui-sidebar-current="true" data-system-ui-sidebar-category="' + escapeAttr(category.id || '') + '" data-system-ui-sidebar-category-source="' + escapeAttr(category.source || '') + '">',
      '<span>' + escapeHtml(t('systemUi.sidebarCurrent', 'Selected sidebar tab')) + '</span>',
      '<strong>' + escapeHtml(category.heading || category.label || category.id || '') + '</strong>',
      category.source ? '<small>' + escapeHtml(category.source) + '</small>' : '',
      '</div>'
    ].join('');
  }

  function renderSidebarComposerModes(screen, task) {
    const category = screen && screen.selectedSidebarCategory || {};
    const canDelete = Boolean(category.canDelete);
    return [
      '<div class="system-ui-sidebar-composer-modes" data-system-ui-sidebar-composer-modes="true">',
      '<button type="button" class="' + (task && task.intent === 'sidebar_edit_section' ? 'is-active' : '') + '" data-system-ui-sidebar-composer-mode="edit" data-object-canvas-graph-node="ui:sidebar_category:' + escapeAttr(category.id || '') + '">' + escapeHtml(t('systemUi.sidebarMode.edit', 'Edit tab')) + '</button>',
      '<button type="button" class="' + (task && task.intent === 'sidebar_add_category' ? 'is-active' : '') + '" data-system-ui-sidebar-composer-mode="add" data-system-ui-template="workspace_layout">' + escapeHtml(t('systemUi.sidebarMode.add', 'Add tab')) + '</button>',
      '<button type="button" class="' + (task && task.intent === 'sidebar_delete_category' ? 'is-active' : '') + '" data-system-ui-sidebar-composer-mode="delete" data-object-canvas-action="sidebar_delete_category" data-system-ui-sidebar-category="' + escapeAttr(category.id || '') + '"' + (canDelete ? '' : ' disabled') + '>' + escapeHtml(t('systemUi.sidebarMode.delete', 'Delete tab')) + '</button>',
      '</div>',
      !canDelete && category.deleteManualReason ? '<p class="editing-empty" data-system-ui-sidebar-delete-manual="true">' + escapeHtml(category.deleteManualReason) + '</p>' : ''
    ].join('');
  }
  function renderSidebarCategory(category, selected) {
    const active = selected && category && selected.id === category.id;
    return [
      '<div class="system-ui-sidebar-category' + (active ? ' is-selected' : '') + '" data-system-ui-sidebar-category="' + escapeAttr(category && category.id || '') + '" data-system-ui-sidebar-category-source="' + escapeAttr(category && category.source || '') + '">',
      '<strong>' + escapeHtml(category && (category.heading || category.label || category.id) || '') + '</strong>',
      '<span>' + escapeHtml(category && category.source || 'source') + '</span>',
      '</div>'
    ].join('');
  }
  function renderTopChromeDiagnostics(screen, task) {
    const menu = ensureArray(screen && screen.shell && screen.shell.menu);
    return [
      '<details class="content-storyboard-detail system-ui-top-chrome" data-system-ui-top-chrome-diagnostics="true">',
      '<summary>' + escapeHtml(t('systemUi.topChromeTitle', 'Header menu labels')) + '</summary>',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.topChrome', 'Top Chrome')) + '</div>',
      '<h4>' + escapeHtml(t('systemUi.topChromeTitle', 'Header menu labels')) + '</h4>',
      '<p>' + escapeHtml(task && task.manualReason || t('systemUi.topChromeManual', 'Header menu labels are runtime chrome until exact source-backed menu text is found.')) + '</p>',
      '<div class="system-ui-top-chrome-list">' + menu.map((label) => '<span data-system-ui-top-chrome-label="generated_only">' + escapeHtml(label) + '</span>').join('') + '</div>',
      '</details>'
    ].join('');
  }

  function renderLibraryContentDiagnostics(screen, task) {
    const library = screen && screen.libraryContent || {};
    const sections = ensureArray(library.sections);
    return [
      '<details class="content-storyboard-detail system-ui-library-content" data-system-ui-library-content="true" data-system-ui-library-content-state="' + escapeAttr(library.sourceBacked ? 'source_backed' : 'manual_review') + '">',
      '<summary>' + escapeHtml(t('systemUi.libraryContentTitle', 'Background text inside Library')) + '</summary>',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.libraryContent', 'Library page content')) + '</div>',
      '<h4>' + escapeHtml(t('systemUi.libraryContentTitle', 'Background text inside Library')) + '</h4>',
      '<p>' + escapeHtml(task && task.manualReason || library.manualReason || t('systemUi.libraryContentHelp', 'Library page content opens in the owning source-backed content scene.')) + '</p>',
      sections.length
        ? '<div class="system-ui-library-section-list" data-system-ui-library-section-list="true">' + sections.map(renderLibrarySection).join('') + '</div>'
        : '<p class="editing-empty">' + escapeHtml(library.manualReason || t('systemUi.libraryContentEmpty', 'No Library content sections were found.')) + '</p>',
      '</details>'
    ].join('');
  }

  function renderLibrarySection(section) {
    const value = section || {};
    return [
      '<button type="button" class="system-ui-library-section" data-object-canvas-action="open_library_content" data-system-ui-library-scene-id="' + escapeAttr(value.route && value.route.sceneId || 'library') + '" data-system-ui-library-section-id="' + escapeAttr(value.route && value.route.sectionId || value.id || '') + '" data-system-ui-library-source-state="' + escapeAttr(value.sourceBacked ? 'source_backed' : 'manual_review') + '">',
      '<strong>' + escapeHtml(value.label || value.id || 'Library') + '</strong>',
      value.body ? '<span>' + escapeHtml(value.body) + '</span>' : '',
      value.path ? '<small>' + escapeHtml([value.path, value.line || ''].filter(Boolean).join(':')) + '</small>' : '',
      '</button>'
    ].join('');
  }

  function renderAdvancedDetails(screen, selected) {
    return [
      '<details class="system-ui-advanced-details" data-system-ui-advanced-details="true">',
      '<summary>' + escapeHtml(t('systemUi.advancedDetails', 'Advanced details')) + '</summary>',
      renderCapabilitySummary(selected.capability || screen && screen.regionContext && screen.regionContext.capability),
      renderRegionContext(screen),
      '</details>'
    ].join('');
  }
  function renderRegionContext(screen) {
    const context = screen.regionContext || {};
    const nearby = ensureArray(context.nearbyRegions);
    const capability = context.capability || screen && screen.selected && screen.selected.capability || {};
    const evidence = ensureArray(capability.sourceEvidence).length ? ensureArray(capability.sourceEvidence) : ensureArray(context.sourceEvidence);
    return [
      '<section class="content-storyboard-detail system-ui-region-context" data-system-ui-region-context="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.context', 'Region context')) + '</div>',
      '<h4>' + escapeHtml(t('systemUi.nearbyRegions', 'Nearby visible objects')) + '</h4>',
      nearby.length
        ? '<div class="system-ui-nearby-list">' + nearby.map(renderNearbyRegion).join('') + '</div>'
        : '<p class="editing-empty">' + escapeHtml(t('systemUi.noNearbyRegions', 'No nearby regions in this screen shell.')) + '</p>',
      '<h4>' + escapeHtml(t('systemUi.sourceEvidence', 'Source evidence')) + '</h4>',
      evidence.length
        ? '<div class="system-ui-evidence-list">' + evidence.map(renderEvidence).join('') + '</div>'
        : '<p class="editing-empty">' + escapeHtml(t('systemUi.noSourceEvidence', 'No source evidence attached to this region yet.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderNearbyRegion(region) {
    return [
      '<button type="button" class="system-ui-nearby-region" data-object-canvas-graph-node="ui:' + escapeAttr(region.key) + '" data-system-ui-nearby-region="' + escapeAttr(region.key) + '">',
      '<span>' + escapeHtml(t(region.labelKey, region.fallback || region.key)) + '</span>',
      '<strong>' + escapeHtml(region.title || '') + '</strong>',
      '<small>' + escapeHtml(t('systemUi.ownerTemplate', 'Owner draft') + ': ' + (region.ownerFallback || region.ownerTemplate || '')) + '</small>',
      '</button>'
    ].join('');
  }

  function renderEvidence(row) {
    const location = [row.path, row.line ? String(row.line) : ''].filter(Boolean).join(':');
    return [
      '<div class="system-ui-evidence-row" data-system-ui-source-evidence="true">',
      '<span>' + escapeHtml(row.label || row.status || '') + '</span>',
      '<code>' + renderEvidenceLocation(location || row.status || '') + '</code>',
      '</div>'
    ].join('');
  }

  function renderEvidenceLocation(value) {
    return escapeHtml(value).replace(/([/.:_-])/g, '$1<wbr>');
  }

  function renderField(field, options) {
    const value = String(field && field.value !== undefined ? field.value : field && field.original || '');
    const id = field && field.id || '';
    const inputType = String(field && field.inputType || '').trim();
    const focus = id && id === String(options && options.focusFieldId || '');
    const multiline = value.indexOf('\n') >= 0 || value.length > 72 || /Body|text|lines|intro/i.test(field && field.label || id);
    const common = ' class="object-inline-input" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '" data-object-canvas-original="' + escapeAttr(field && field.original !== undefined ? field.original : value) + '"' + (focus ? ' data-system-ui-focus-field="true"' : '') + (field && field.readOnly ? ' readonly' : '');
    return [
      '<label class="object-inline-field' + (inputType === 'checkbox' ? ' object-inline-field-checkbox' : '') + (focus ? ' is-focused' : '') + '">',
      '<span>' + escapeHtml(semanticFieldLabel(field)) + '</span>',
      inputType === 'checkbox'
        ? '<input type="checkbox"' + common + (booleanValue(value) ? ' checked' : '') + '>'
        : inputType === 'color'
          ? '<input type="color"' + common + ' value="' + escapeAttr(safeColor(value)) + '">'
          : inputType === 'number'
            ? '<input type="number" step="0.1"' + common + ' value="' + escapeAttr(value) + '">'
            : multiline
        ? '<textarea rows="' + rowsFor(value) + '"' + common + '>' + escapeHtml(value) + '</textarea>'
        : '<input type="text"' + common + ' value="' + escapeAttr(value) + '">',
      semanticFieldHelp(field) ? '<small class="system-ui-field-help" data-system-ui-field-help="' + escapeAttr(id) + '">' + escapeHtml(semanticFieldHelp(field)) + '</small>' : '',
      '</label>'
    ].join('');
  }
  function semanticFieldLabel(field) {
    const id = String(field && field.id || '');
    const labels = {
      'sidebar.sectionId': t('systemUi.field.sidebarSectionId', 'Sidebar section id'),
      'sidebar.sectionHeading': t('systemUi.field.sidebarHeading', 'Player-facing tab heading'),
      'sidebar.sectionBody': t('systemUi.field.sidebarBody', 'Sidebar intro text'),
      'sidebar.sectionStatusLines': t('systemUi.field.sidebarStatusLines', 'Sidebar status lines'),
      'sidebar.operationMode': t('systemUi.field.sidebarOperation', 'Sidebar operation'),
      'sidebar.deleteConfirm': t('systemUi.field.sidebarDeleteConfirm', 'Confirm deleting this tab'),
      'layout.sidebarCategoryId': t('systemUi.field.sidebarCategoryId', 'New sidebar category id'),
      'layout.sidebarHeading': t('systemUi.field.sidebarHeading', 'Player-facing tab heading'),
      'layout.sidebarBody': t('systemUi.field.sidebarBody', 'Sidebar intro text'),
      'layout.sidebarStatusLines': t('systemUi.field.sidebarStatusLines', 'Sidebar status lines'),
      'layout.sidebarInsertMode': t('systemUi.field.sidebarInsertMode', 'Insert position'),
      'layout.sidebarAnchorId': t('systemUi.field.sidebarAnchorId', 'Anchor tab'),
      'project.gameTitle': t('systemUi.field.gameTitle', 'Game title'),
      'project.author': t('systemUi.field.author', 'Author label'),
      'project.ifid': t('systemUi.field.ifid', 'IFID')
    };
    return labels[id] || field && field.label || id || '';
  }

  function semanticFieldHelp(field) {
    const id = String(field && field.id || '');
    if (id === 'sidebar.sectionBody' || id === 'layout.sidebarBody') {
      return t('systemUi.fieldHelp.sidebarBody', 'Fixed intro text for this sidebar tab. It is written before the status lines and may be blank.');
    }
    if (id === 'sidebar.sectionStatusLines' || id === 'layout.sidebarStatusLines') {
      return t('systemUi.fieldHelp.sidebarStatusLines', 'The player-facing status rows, including conditional lines and variable readouts. This is usually the part you see in game.');
    }
    return '';
  }

  function runtimeEvidenceLabel(state) {
    const value = String(state || '');
    if (value === 'source_backed') {
      return t('systemUi.runtimeState.sourceBacked', 'Studio can prepare a source-backed change.');
    }
    if (value === 'generated_only') {
      return t('systemUi.runtimeState.generatedOnly', 'Generated at runtime; Studio keeps it in manual review.');
    }
    if (value === 'runtime_custom') {
      return t('systemUi.runtimeState.runtimeCustom', 'Custom runtime surface; manual review needed.');
    }
    if (value === 'ambiguous') {
      return t('systemUi.runtimeState.ambiguous', 'Multiple possible sources; manual review needed.');
    }
    if (value === 'blocked') {
      return t('systemUi.runtimeState.blocked', 'Runtime evidence is blocked.');
    }
    return value || t('systemUi.runtimeState.unknown', 'No runtime evidence yet.');
  }

  function taskStatusLabel(task) {
    const safety = String(task && task.safety || '');
    const runtimeState = String(task && task.runtimeEvidenceState || task && task.sourceEvidenceState || '');
    if (safety === 'safe_apply' || safety === 'guarded_apply') {
      return t('systemUi.taskStatus.sourceEditable', 'You can edit the fields below; Review & Apply will check the source anchors before changing files.');
    }
    if (runtimeState === 'generated_only') {
      return t('systemUi.taskStatus.generatedOnly', 'Studio can identify this area, but it is generated at runtime and stays review-only.');
    }
    if (runtimeState === 'runtime_custom') {
      return t('systemUi.taskStatus.runtimeCustom', 'Studio can inspect this custom runtime area, but changes need manual review.');
    }
    if (runtimeState === 'ambiguous') {
      return t('systemUi.taskStatus.ambiguous', 'Studio found more than one possible source, so this stays review-only.');
    }
    if (runtimeState === 'blocked') {
      return t('systemUi.taskStatus.blocked', 'Studio cannot inspect the live surface yet; fix the blocker before editing this area.');
    }
    return t('systemUi.taskStatus.manual', 'Studio can explain this area, but automatic changes are not enabled yet.');
  }

  function renderDiagnostics(screen) {
    return [
      '<section class="content-storyboard-detail system-screen-diagnostics" data-system-screen-diagnostics="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.previewIntent', 'Preview intent')) + '</div>',
      ensureArray(screen.diagnostics).map((row) => '<div><span>' + escapeHtml(t(row.labelKey, row.label)) + '</span><strong>' + escapeHtml(row.value) + '</strong></div>').join(''),
      '</section>'
    ].join('');
  }

  function renderActions(model, options) {
    return [
      '<section class="object-canvas-command-dock system-ui-command-dock" data-object-canvas-command-dock="true">',
      '<div class="object-canvas-command-head">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('objectCanvas.changeTitle', 'Change and safety')) + '</div>',
      '<h3>' + escapeHtml(t('authoring.template.systemUiScreen', 'System UI Screen')) + '</h3>',
      '</div>',
      '</div>',
      '<div class="editing-actions object-canvas-actions">',
      '<button type="button" data-object-canvas-action="refresh">' + escapeHtml(t('existingScene.refresh', 'Refresh proposal')) + '</button>',
      '<button type="button" data-object-canvas-action="toggle_overlay">' + escapeHtml(options.editorOverlay ? t('objectCanvas.editorDock', 'Dock editor') : t('objectCanvas.editorOverlay', 'Expand editor')) + '</button>',
      '<button type="button" data-object-canvas-action="save">' + escapeHtml(t('editing.saveToChanges', 'Save to My Changes')) + '</button>',
      '<button class="primary-action" type="button" data-object-canvas-action="review">' + escapeHtml(t('existingScene.review', 'Review & Apply')) + '</button>',
      model.mode !== 'existing' ? '<button type="button" data-object-canvas-action="legacy_form">' + escapeHtml(t('objectCanvas.legacyForm', 'Advanced Form')) + '</button>' : '',
      '</div>',
      '</section>'
    ].join('');
  }

  function rowsFor(value) {
    return String(Math.max(3, Math.min(8, String(value || '').split('\n').length + 1)));
  }

  function booleanValue(value) {
    const text = String(value || '').trim().toLowerCase();
    return text === 'true' || text === '1' || text === 'yes' || text === 'on';
  }

  function safeColor(value) {
    const text = String(value || '').trim();
    return /^#[0-9A-Fa-f]{6}$/.test(text) ? text : '#999999';
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function runtimeLensApi() {
    if (global && global.ProjectMapRuntimeLensUi) {
      return global.ProjectMapRuntimeLensUi;
    }
    if (typeof require === 'function') {
      try {
        return require('./runtime_lens_ui.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
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

  const api = {render};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSystemUiRegionEditor = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
