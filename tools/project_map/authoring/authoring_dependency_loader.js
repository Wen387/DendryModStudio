// @ts-check
(function initProjectMapAuthoringDependencyLoader(global) {
  'use strict';

  const AUTHORING_DEPENDENCY_SCRIPTS = Object.freeze([
    '../authoring/protected_path_policy.js',
    '../authoring/asset_contract_model.js',
    '../authoring/install_operation_contracts.js',
    '../authoring/existing_scene_line_coalescer.js',
    '../authoring/existing_scene_structure_operations.js',
    '../authoring/event_structure_effect_model.js',
    '../authoring/event_structure_command_model.js',
    '../authoring/predicate_condition_model.js',
    '../authoring/route_runtime_trial_model.js',
    '../authoring/route_runtime_semantics_model.js',
    '../authoring/route_state_model.js',
    '../authoring/route_understanding_model.js',
    '../authoring/route_guided_edit_model.js',
    '../authoring/route_script_intelligence_model.js',
    '../authoring/install_review_state_model.js',
    '../authoring/install_result_report_model.js'
  ]);

  if (global) {
    global.ProjectMapAuthoringDependencyScripts = AUTHORING_DEPENDENCY_SCRIPTS.slice();
  }

  if (typeof document === 'undefined') {
    return;
  }
  document.write(AUTHORING_DEPENDENCY_SCRIPTS.map((src) => {
    return '<script src="' + src + '"></' + 'script>';
  }).join(''));
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
