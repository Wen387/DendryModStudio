(function initProjectMapSystemUiSemanticTaskModel(global) {
  'use strict';

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const ensureArray = domTextUtils.ensureArray;

  const VERSION = '0.1';

  const REGION_TASKS = {
    layout_frame: [
      task('layout_shell', 'systemUi.task.layoutShell', 'Adjust screen layout and routes', 'systemUi.task.layoutShell.summary', 'Use the source-backed layout draft for screen structure, deck lane, starter card, and sidebar insertion.', 'edit_fields', ['layout.title', 'layout.deckTitle', 'layout.deckSubtitle', 'layout.handOptionLabel', 'layout.handInsertMode'], 'layout.title'),
      task('sidebar_add_category', 'systemUi.task.sidebarAddCategory', 'Add a sidebar category', 'systemUi.task.sidebarAddCategory.summary', 'Create a source-backed sidebar category and choose where it appears in the sidebar tabs.', 'sidebar_composer', ['layout.sidebarCategoryId', 'layout.sidebarHeading', 'layout.sidebarBody', 'layout.sidebarStatusLines', 'layout.sidebarInsertMode', 'layout.sidebarAnchorId'], 'layout.sidebarHeading')
    ],
    screen_header: [
      task('identity_title', 'systemUi.task.identityTitle', 'Edit the game identity', 'systemUi.task.identityTitle.summary', 'Change the title, author, or IFID that identifies this game in the player-facing header.', 'edit_fields', ['project.gameTitle', 'project.author', 'project.ifid', 'entry.rootTitle', 'play.title', 'layout.title', 'sidebar.statusTitle'], 'project.gameTitle'),
      task('library_content', 'systemUi.task.libraryContent', 'Edit Library page content', 'systemUi.task.libraryContent.summary', 'Open the source-backed Library scene sections that hold background and reference text.', 'open_content_scene', [], ''),
      task('top_chrome_menu', 'systemUi.task.topChromeMenu', 'Review header menu labels', 'systemUi.task.topChromeMenu.summary', 'Library, Save/Load, and Options are observed runtime chrome unless the project has exact source-backed menu text.', 'top_chrome_diagnostics', [], '')
    ],
    main_content: [
      task('main_copy', 'systemUi.task.mainCopy', 'Edit the main text', 'systemUi.task.mainCopy.summary', 'Change the player-facing heading or body copy in the selected screen area.', 'edit_fields', ['entry.rootTitle', 'entry.rootHeading', 'entry.rootIntro', 'play.handTitle', 'play.handHeading', 'play.handBody', 'layout.starterCardTitle', 'layout.starterCardHeading', 'layout.starterCardBody', 'sidebar.sectionHeading', 'sidebar.sectionBody'], 'entry.rootIntro')
    ],
    main_options: [
      task('first_choice', 'systemUi.task.firstChoice', 'Edit the visible choice', 'systemUi.task.firstChoice.summary', 'Change the option label or route target shown to the player.', 'edit_fields', ['entry.firstOptionTitle', 'entry.firstTargetId', 'layout.handOptionLabel', 'play.handDeckOptionLabel', 'play.handAdvisorOptionLabel'], 'entry.firstOptionTitle')
    ],
    workspace_hand: [
      task('hand_surface', 'systemUi.task.handSurface', 'Edit the hand area', 'systemUi.task.handSurface.summary', 'Change the repeatable hand title, body, and action labels that frame playable cards.', 'edit_fields', ['play.handTitle', 'play.handHeading', 'play.handBody', 'play.handDeckOptionLabel', 'play.handAdvisorOptionLabel'], 'play.handTitle')
    ],
    deck_lane: [
      task('deck_labels', 'systemUi.task.deckLabels', 'Edit deck labels', 'systemUi.task.deckLabels.summary', 'Change the player-facing deck title and subtitle while keeping runtime geometry manual.', 'edit_fields', ['play.deckTitle', 'play.deckSubtitle', 'layout.deckTitle', 'layout.deckSubtitle', 'layout.deckTag'], 'layout.deckTitle')
    ],
    action_card: [
      task('action_card_copy', 'systemUi.task.actionCardCopy', 'Edit action card copy', 'systemUi.task.actionCardCopy.summary', 'Change the starter/action card title, body, and option labels where source evidence exists.', 'edit_fields', ['play.cardTitle', 'play.cardHeading', 'play.cardBody', 'play.cardOption0Label', 'play.cardOption1Label', 'layout.starterCardTitle', 'layout.starterCardHeading', 'layout.starterCardBody', 'layout.starterCardOption0Label', 'layout.starterCardOption1Label'], 'layout.starterCardTitle')
    ],
    advisor_lane: [
      task('advisor_copy', 'systemUi.task.advisorCopy', 'Edit advisor copy', 'systemUi.task.advisorCopy.summary', 'Change the pinned advisor title, body, and option label shown beside the hand.', 'edit_fields', ['play.advisorTitle', 'play.advisorSubtitle', 'play.advisorHeading', 'play.advisorBody', 'play.advisorOption0Label'], 'play.advisorTitle')
    ],
    sidebar_status: [
      task('sidebar_edit_section', 'systemUi.task.sidebarEditSection', 'Edit a sidebar section', 'systemUi.task.sidebarEditSection.summary', 'Change the selected sidebar tab, heading, body, and status lines as one player-facing section.', 'sidebar_composer', ['sidebar.statusTitle', 'sidebar.sectionId', 'sidebar.sectionHeading', 'sidebar.sectionBody', 'sidebar.sectionStatusLines', 'entry.sidebarTitle', 'entry.sidebarHeading', 'entry.sidebarBody', 'entry.sidebarStatusLines', 'layout.sidebarHeading', 'layout.sidebarBody', 'layout.sidebarStatusLines'], 'sidebar.sectionHeading'),
      task('sidebar_add_category', 'systemUi.task.sidebarAddCategory', 'Add a sidebar category', 'systemUi.task.sidebarAddCategory.summary', 'Create a source-backed sidebar category and choose where it appears in the sidebar tabs.', 'sidebar_composer', ['layout.sidebarCategoryId', 'layout.sidebarHeading', 'layout.sidebarBody', 'layout.sidebarStatusLines', 'layout.sidebarInsertMode', 'layout.sidebarAnchorId'], 'layout.sidebarHeading'),
      task('sidebar_delete_category', 'systemUi.task.sidebarDeleteCategory', 'Delete a sidebar category', 'systemUi.task.sidebarDeleteCategory.summary', 'Remove the selected source-backed sidebar tab section after Review & Apply confirms exact anchors.', 'sidebar_composer', ['sidebar.operationMode', 'sidebar.deleteConfirm', 'sidebar.sectionId'], 'sidebar.deleteConfirm')
    ],
    right_sidebar: [
      task('right_sidebar_edit', 'systemUi.task.rightSidebarEdit', 'Edit the right sidebar', 'systemUi.task.rightSidebarEdit.summary', 'Fill the empty right gutter with a panel: set its title and body. Studio owns the responsive, conflict-free placement so adding content stays safe.', 'edit_fields', ['layout.rightSidebarTitle', 'layout.rightSidebarBody'], 'layout.rightSidebarTitle')
    ],
    election_results_frame: [
      task('election_intro', 'systemUi.task.electionIntro', 'Edit election intro copy', 'systemUi.task.electionIntro.summary', 'Change source-backed title, subtitle, intro, and result text while renderer wiring stays manual.', 'edit_fields', ['election.title', 'election.subtitle', 'election.intro', 'election.sourcePath', 'election.id'], 'election.title')
    ],
    election_results_chart: [
      task('election_chart_review', 'systemUi.task.electionChartReview', 'Review the seat chart', 'systemUi.task.electionChartReview.summary', 'Seat chart rendering, formulas, and D3/SVG geometry are runtime-observed and require manual review.', 'runtime_review', ['election.seatsTotal'], 'election.seatsTotal')
    ],
    election_results_table: [
      task('election_party_table', 'systemUi.task.electionPartyTable', 'Edit party table text', 'systemUi.task.electionPartyTable.summary', 'Change party labels and exact source-backed table values; custom render wiring remains manual.', 'edit_fields', [], '')
    ],
    election_results_coalitions: [
      task('election_coalitions', 'systemUi.task.electionCoalitions', 'Edit coalition copy', 'systemUi.task.electionCoalitions.summary', 'Change coalition labels, descriptions, and intro text when exact source evidence exists.', 'edit_fields', ['election.intro'], 'election.intro')
    ],
    election_results_choices: [
      task('election_choices', 'systemUi.task.electionChoices', 'Edit result choices', 'systemUi.task.electionChoices.summary', 'Change the choice labels and conditions shown after the election result.', 'edit_fields', [], '')
    ]
  };

  function buildTaskMatrix(screen) {
    const model = isObject(screen) ? screen : {};
    const byRegion = {};
    const regions = ensureArray(model.regions).map((region) => {
      const tasks = tasksForRegion(region, model);
      byRegion[String(region && region.key || '')] = tasks;
      return {regionKey: String(region && region.key || ''), tasks};
    });
    return {
      schemaVersion: VERSION,
      kind: 'system_ui_semantic_task_matrix',
      template: String(model.template || ''),
      regions,
      byRegion
    };
  }

  function attachTasks(screen) {
    const model = isObject(screen) ? screen : {};
    const matrix = buildTaskMatrix(model);
    const byRegion = matrix.byRegion || {};
    model.semanticTaskMatrix = matrix;
    model.regions = ensureArray(model.regions).map((region) => Object.assign({}, region, {
      semanticTasks: byRegion[String(region && region.key || '')] || []
    }));
    model.selected = model.selected
      ? model.regions.find((region) => region.key === model.selected.key) || model.selected
      : null;
    if (model.regionContext && model.selected) {
      model.regionContext = Object.assign({}, model.regionContext, {
        selectedRegion: model.selected,
        semanticTasks: model.selected.semanticTasks || []
      });
    }
    return model;
  }

  function tasksForRegion(region, screen) {
    const value = isObject(region) ? region : {};
    const key = String(value.key || '');
    const descriptors = REGION_TASKS[key] || [task('inspect_region', 'systemUi.task.inspectRegion', 'Review this UI region', 'systemUi.task.inspectRegion.summary', 'Inspect runtime evidence and source anchors before deciding whether this visible area can be edited.', 'runtime_review', [], '')];
    const capability = isObject(value.capability) ? value.capability : {};
    const supportedFields = ensureArray(capability.supportedEditFields);
    return descriptors.map((descriptor) => buildTask(descriptor, value, screen, capability, supportedFields));
  }

  function buildTask(descriptor, region, screen, capability, supportedFields) {
    const fields = taskFields(descriptor, region, supportedFields);
    const primaryFieldId = primaryFieldFor(descriptor, fields);
    const manualReason = manualReasonFor(descriptor, capability, fields);
    const library = screen && screen.libraryContent || {};
    const libraryBacked = descriptor.actionKind === 'open_content_scene' && library.exists && library.sourceBacked;
    const taskSafety = descriptor.actionKind === 'top_chrome_diagnostics'
      ? 'manual_review'
      : libraryBacked
        ? 'guarded_apply'
        : String(capability.installSafety || 'manual_review');
    const taskEvidenceState = descriptor.actionKind === 'top_chrome_diagnostics'
      ? 'generated_only'
      : libraryBacked
        ? 'source_backed'
        : sourceEvidenceStateFor(capability, fields);
    const taskRuntimeState = descriptor.actionKind === 'top_chrome_diagnostics'
      ? 'generated_only'
      : libraryBacked
        ? 'source_backed'
        : String(capability.runtimeEvidenceState || '');
    return {
      schemaVersion: VERSION,
      kind: 'system_ui_semantic_task',
      id: String(region.key || 'region') + ':' + descriptor.intent,
      intent: descriptor.intent,
      labelKey: descriptor.labelKey,
      label: descriptor.label,
      beginnerSummaryKey: descriptor.summaryKey,
      beginnerSummary: descriptor.summary,
      regionKey: String(region.key || ''),
      template: String(screen && screen.template || ''),
      internalTemplate: String(capability.ownerTemplate || region.ownerTemplate || screen && screen.template || ''),
      fields,
      primaryFieldId,
      actionKind: descriptor.actionKind,
      safety: taskSafety,
      sourceEvidenceState: taskEvidenceState,
      runtimeEvidenceState: taskRuntimeState,
      manualReason
    };
  }

  function taskFields(descriptor, region, supportedFields) {
    const ids = new Set(ensureArray(descriptor.fieldIds).filter(Boolean));
    const regionFields = ensureArray(region.fields);
    const rows = ids.size
      ? regionFields.filter((field) => ids.has(String(field && field.id || '')))
      : regionFields.slice();
    const supportedById = {};
    supportedFields.forEach((field) => {
      supportedById[String(field && field.id || '')] = field;
    });
    return rows.map((field) => {
      const id = String(field && field.id || '');
      const supported = supportedById[id] || {};
      return Object.assign({}, field, {
        semanticFieldId: id,
        installSafety: supported.installSafety || field.installSafety || '',
        sourceEvidenceState: supported.sourceEvidenceState || field.sourceEvidenceState || ''
      });
    }).filter((field) => field.id);
  }

  function primaryFieldFor(descriptor, fields) {
    const preferred = String(descriptor.primaryFieldId || '');
    if (preferred && ensureArray(fields).some((field) => field.id === preferred)) {
      return preferred;
    }
    const editable = ensureArray(fields).find((field) => !field.readOnly);
    return editable && editable.id || '';
  }

  function sourceEvidenceStateFor(capability, fields) {
    const states = ensureArray(fields).map((field) => String(field && field.sourceEvidenceState || '')).filter(Boolean);
    if (states.includes('source_backed')) {
      return 'source_backed';
    }
    if (states.includes('ambiguous')) {
      return 'ambiguous';
    }
    if (states.includes('generated_only')) {
      return 'generated_only';
    }
    return states[0] || String(capability.runtimeEvidenceState || '');
  }

  function manualReasonFor(descriptor, capability, fields) {
    if (descriptor.actionKind === 'top_chrome_diagnostics') {
      return 'Header menu labels are runtime chrome until exact source-backed menu text is found.';
    }
    if (descriptor.actionKind === 'open_content_scene') {
      return 'Library page content is edited in the owning source-backed content scene, not in generated header chrome.';
    }
    if (descriptor.actionKind === 'runtime_review') {
      return capability.manualReason || 'Runtime-observed UI needs manual review before Studio can generate a source operation.';
    }
    if (!ensureArray(fields).length) {
      return capability.manualReason || 'This task has no exact source-backed field in the current draft.';
    }
    return capability.manualReason || '';
  }

  function task(intent, labelKey, label, summaryKey, summary, actionKind, fieldIds, primaryFieldId) {
    return {intent, labelKey, label, summaryKey, summary, actionKind, fieldIds, primaryFieldId};
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {buildTaskMatrix, attachTasks};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSystemUiSemanticTaskModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
