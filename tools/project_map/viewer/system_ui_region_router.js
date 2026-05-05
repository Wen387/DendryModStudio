(function initProjectMapSystemUiRegionRouter(global) {
  'use strict';

  const REGION_TEMPLATES = {
    layout_frame: 'workspace_layout',
    deck_lane: 'workspace_layout',
    action_card: 'workspace_layout',
    workspace_hand: 'play_surface',
    advisor_lane: 'play_surface',
    sidebar_status: 'sidebar_status',
    screen_header: 'project',
    main_content: 'entry',
    main_options: 'entry'
  };

  function templateForRegion(nodeKey) {
    const region = String(nodeKey || '').replace(/^ui:/, '');
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
