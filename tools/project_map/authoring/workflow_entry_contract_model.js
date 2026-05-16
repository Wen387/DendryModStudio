(function initWorkflowEntryContractModel(global) {
  'use strict';

  const VERSION = '0.1';

  const REQUIRED_FIELDS = [
    'featureId',
    'playerLabel',
    'entrySurface',
    'actionKind',
    'targetView',
    'targetId',
    'renderSelector',
    'reviewApplyPath',
    'browserBehavior',
    'desktopBehavior',
    'readinessGate'
  ];

  const WORKFLOW_ENTRIES = [
    entry('visible_content_edit', 'Edit visible content', 'Explore / Workbench / Canvas', 'open_visible_edit_action', 'visible_content', 'selected', 'data-visible-edit-action', 'Review & Apply', 'Open and preview edit plan', 'Dry-run or apply safe/guarded/advanced operations', 'visible edit action resolves'),
    entry('source_slice_edit', 'Precise source edit', 'Object Canvas', 'open_source_slice', 'source_slice', 'selected', 'data-source-slice-textarea="true"', 'Review & Apply', 'Build bounded replacement plan', 'Dry-run or apply guarded/advanced replacement', 'changed text and advanced toggle when needed'),
    entry('semantic_logic_edit', 'Semantic logic editor', 'Object Canvas', 'open_semantic_logic', 'semantic_logic', 'selected', 'data-semantic-logic-editor="true"', 'Review & Apply', 'Build route/effect edit plan', 'Dry-run or apply guarded/advanced replacement', 'changed logic and advanced toggle when needed'),
    entry('complex_event_create', 'Complex Event Builder', 'Create', 'open_complex_event_builder', 'events', 'new_event', 'data-create-template-panel="event"', 'Review & Apply', 'Draft and preview event install plan', 'Dry-run or apply event operations', 'event readiness checklist'),
    entry('text_event_create', 'Text Event Builder', 'Create', 'open_text_event_builder', 'events', 'new_text_event', 'data-event-archetype="pure_event"', 'Review & Apply', 'Draft and preview no-choice text event install plan', 'Dry-run or apply event operations', 'text event readiness checklist'),
    entry('create_similar_event', 'Create similar event', 'Object Canvas', 'create_similar_event', 'events', 'selected_scene', 'data-create-similar-object="true"', 'Review & Apply', 'Seed a new draft from parsed event content', 'Dry-run or apply the generated new scene operations', 'parsed-to-draft template resolves'),
    entry('create_similar_card', 'Create similar card', 'Object Canvas', 'create_similar_event', 'cards', 'selected_card', 'data-create-similar-kind="card"', 'Review & Apply', 'Seed a new draft from parsed card content', 'Dry-run or apply the generated new card operations', 'parsed-to-draft template resolves'),
    entry('rendered_element_edit', 'Edit rendered preview element', 'Object Canvas preview', 'open_rendered_authoring_entry', 'visible_content', 'rendered_element', 'data-rendered-authoring-entry="true"', 'Review & Apply', 'Open the editor from the rendered preview element', 'Dry-run or apply the generated operation', 'rendered action resolves'),
    entry('rendered_effect_edit', 'Edit rendered effect', 'Object Canvas preview', 'open_effect_editor', 'effects', 'rendered_effect', 'data-rendered-entry-kind="effect"', 'Review & Apply', 'Open effect editor from preview impact row', 'Dry-run or apply guarded/advanced effect operation', 'effect editor resolves'),
    entry('event_graph_node_edit', 'Edit event graph node', 'Complex Event Builder', 'open_event_graph_node', 'events', 'graph_node', 'data-preview-object-event-graph-node', 'Review & Apply', 'Focus matching editor field', 'Dry-run or apply generated draft operation', 'event readiness checklist'),
    entry('event_graph_edge_edit', 'Edit event graph route', 'Complex Event Builder', 'open_event_graph_edge', 'routes', 'graph_edge', 'data-preview-object-event-graph-edge', 'Review & Apply', 'Focus route editor field', 'Dry-run or apply generated route operation', 'route target resolves'),
    entry('variable_create_from_event_effect', 'Create variable from event effect', 'Object Canvas context board', 'open_variable_editor', 'variables', 'effect_variable', 'data-workflow-entry="variable-create-from-effect"', 'Review & Apply', 'Open variable draft from event context', 'Dry-run or apply variable init/definition operation', 'variable draft has source-backed init'),
    entry('asset_picker_copy_install', 'Add asset and copy file', 'Create', 'select_asset_install_file', 'assets', 'asset_install_request', 'id="wizard-asset-picker"', 'Review & Apply', 'Create asset reference and copy proposal', 'Copy guarded local file into project asset folder', 'desktop sourcePath exists'),
    entry('profile_router_registration', 'Register event route', 'Object Canvas context board', 'open_router_registration', 'router', 'known_profile', 'data-workflow-entry="profile-router-registration"', 'Review & Apply', 'Preview router registration operation', 'Dry-run or apply advanced router patch', 'known profile rule and anchor'),
    entry('unknown_profile_router_rule', 'Add router rule', 'Object Canvas context board', 'open_profile_router_rule', 'router', 'unknown_profile', 'data-workflow-entry="profile-router-rule"', 'Review & Apply', 'Show missing profile rule repair path', 'No apply until a rule or anchor is selected', 'profile rule or advanced anchor selected'),
    entry('review_apply_dry_run', 'Review and dry-run operations', 'Review & Apply', 'review_apply', 'install_plan', 'current_plan', 'data-object-canvas-action="review"', 'Review & Apply', 'Inspect install plan', 'Dry-run/apply safe, guarded, or advanced operations', 'plan has no blocked visible workflow')
  ];

  function entry(featureId, playerLabel, entrySurface, actionKind, targetView, targetId, renderSelector, reviewApplyPath, browserBehavior, desktopBehavior, readinessGate) {
    return {featureId, playerLabel, entrySurface, actionKind, targetView, targetId, renderSelector, reviewApplyPath, browserBehavior, desktopBehavior, readinessGate};
  }

  function workflowEntries() {
    return WORKFLOW_ENTRIES.map((item) => Object.assign({}, item));
  }

  function buildWorkflowEntryReport(input) {
    const sources = normalizeSources(input);
    const entries = workflowEntries().map((item) => {
      const missingFields = REQUIRED_FIELDS.filter((field) => !String(item[field] || '').trim());
      const rendered = hasSelector(sources, item.renderSelector);
      return Object.assign({}, item, {
        contractComplete: missingFields.length === 0,
        rendered,
        modelOnly: missingFields.length === 0 && !rendered,
        missingFields
      });
    });
    const contractComplete = entries.filter((item) => item.contractComplete).length;
    const rendered = entries.filter((item) => item.rendered).length;
    const modelOnly = entries.filter((item) => item.modelOnly).length;
    const renderedElementEntry = hasSelector(sources, 'data-rendered-authoring-entry="true"');
    const renderedEffectEntry = hasSelector(sources, 'data-rendered-entry-kind="effect"');
    const copyAsNewEntry = hasSelector(sources, 'data-create-similar-object="true"');
    return {
      schemaVersion: VERSION,
      kind: 'workflow_entry_contract_report',
      ok: contractComplete === entries.length && rendered === entries.length && modelOnly === 0,
      entries,
      summary: {
        workflowEntryCoverage: ratio(contractComplete, entries.length),
        renderedEntryCoverage: ratio(rendered, entries.length),
        renderedElementEntryCoverage: renderedElementEntry ? 1 : 0,
        renderedEffectEntryCoverage: renderedEffectEntry ? 1 : 0,
        copyAsNewEntryCoverage: copyAsNewEntry ? 1 : 0,
        modelOnlyWorkflowCount: modelOnly,
        total: entries.length
      }
    };
  }

  function normalizeSources(input) {
    const value = input && typeof input === 'object' ? input : {};
    if (typeof value.source === 'string') {
      return value.source;
    }
    if (value.sources && typeof value.sources === 'object') {
      return Object.keys(value.sources).map((key) => String(value.sources[key] || '')).join('\n');
    }
    return String(input || '');
  }

  function hasSelector(source, selector) {
    const needle = String(selector || '').trim();
    return Boolean(needle && String(source || '').includes(needle));
  }

  function ratio(count, total) {
    return total ? count / total : 1;
  }

  const api = {workflowEntries, buildWorkflowEntryReport};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapWorkflowEntryContractModel = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
