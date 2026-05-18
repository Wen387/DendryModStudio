// @ts-check
(function initProjectMapAuthoringDependencyLoader(global) {
  'use strict';

  const AUTHORING_DEPENDENCY_SCRIPTS = Object.freeze([
    '../authoring/protected_path_policy.js',
    '../authoring/install_operation_contracts.js',
    '../authoring/existing_scene_line_coalescer.js',
    '../authoring/route_state_model.js',
    '../authoring/route_script_intelligence_model.js',
    'install_review_state_model.js',
    'install_result_report_model.js'
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
