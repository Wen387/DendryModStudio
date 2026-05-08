(function initProjectMapSystemUiRegionRouter(global) {
  'use strict';

  const REGION_TEMPLATES = {
    layout_frame: 'workspace_layout',
    deck_lane: 'workspace_layout',
    action_card: 'workspace_layout',
    workspace_hand: 'play_surface',
    advisor_lane: 'play_surface',
    sidebar_status: 'sidebar_status',
    election_results_frame: 'election_results',
    election_results_chart: 'election_results',
    election_results_table: 'election_results',
    election_results_coalitions: 'election_results',
    election_results_choices: 'election_results',
    screen_header: 'project',
    main_content: 'entry',
    main_options: 'entry'
  };

  function templateForRegion(nodeKey) {
    const region = String(nodeKey || '').replace(/^ui:/, '');
    if (region.indexOf('sidebar_category:') === 0) {
      return 'sidebar_status';
    }
    if (region === 'sidebar_new_category') {
      return 'workspace_layout';
    }
    return REGION_TEMPLATES[region] || '';
  }

  const api = {templateForRegion};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSystemUiRegionRouter = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
