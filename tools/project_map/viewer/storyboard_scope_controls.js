(function initProjectMapStoryboardScopeControls(global) {
  'use strict';

  function renderTimelineScope(storyboard) {
    const ui = storyboard && storyboard.ui || {};
    if (ui.scopeCollapsed) {
      return '';
    }
    const scope = storyboard && storyboard.timeline && storyboard.timeline.storyScope || {};
    if (!scope || !scope.totalLaneCount) {
      return '';
    }
    return [
      '<section class="content-storyboard-scope" data-content-storyboard-scope="true" aria-label="' + escapeAttr(t('storyboard.scope', 'Story scope')) + '">',
      '<div class="content-storyboard-scope-summary">',
      '<span>' + escapeHtml(t('storyboard.scope', 'Story scope')) + '</span>',
      '<strong>' + escapeHtml(scope.activeLabel || scope.activeLaneKey || '') + '</strong>',
      '<em>' + escapeHtml(scope.visibleCardCount + ' / ' + scope.totalCardCount + ' ' + t('storyboard.beats', 'beats')) + '</em>',
      '</div>',
      '<div class="content-storyboard-scope-actions">',
      '<button type="button" data-object-canvas-action="toggle_story_scope_panel">' + escapeHtml(t('storyboard.collapse', 'Collapse')) + '</button>',
      scopeButton('story_scope_focus', scope.mode === 'focus', t('storyboard.scope.focus', 'Focus')),
      scopeButton('story_scope_expand', scope.mode === 'expanded', t('storyboard.scope.expanded', 'Expanded')),
      '<button type="button" data-object-canvas-action="story_scope_reset">' + escapeHtml(t('storyboard.scope.reset', 'Reset')) + '</button>',
      '</div>',
      '<div class="content-storyboard-scope-hidden">',
      scope.hiddenBefore ? '<span>' + escapeHtml(scope.hiddenBefore + ' ' + t('storyboard.scope.beforeWindow', 'before window')) + '</span>' : '',
      scope.hiddenAfter ? '<span>' + escapeHtml(scope.hiddenAfter + ' ' + t('storyboard.scope.afterWindow', 'after window')) + '</span>' : '',
      scope.undatedCount && !scope.showUndated ? '<span>' + escapeHtml(scope.undatedCount + ' ' + t('storyboard.undated', 'Undated')) + '</span>' : '',
      '</div>',
      '</section>'
    ].join('');
  }

  function renderTimelineOverview(storyboard) {
    const ui = storyboard && storyboard.ui || {};
    if (ui.overviewCollapsed) {
      return '';
    }
    const scope = storyboard && storyboard.timeline && storyboard.timeline.storyScope || {};
    const lanes = scope.summaryLanes || storyboard && storyboard.storyContext && storyboard.storyContext.timeline && storyboard.storyContext.timeline.lanes || [];
    if (!lanes.length) {
      return '';
    }
    const max = lanes.reduce((value, lane) => Math.max(value, lane.count || 0), 1);
    return [
      '<section class="content-storyboard-overview" data-content-storyboard-overview="true" aria-label="' + escapeAttr(t('storyboard.overview', 'Timeline overview')) + '">',
      '<button type="button" class="content-storyboard-overview-collapse" data-object-canvas-action="toggle_story_overview_panel" aria-label="' + escapeAttr(t('storyboard.collapseYears', 'Collapse years')) + '">' + escapeHtml(t('storyboard.collapse', 'Collapse')) + '</button>',
      lanes.map((lane) => {
        const width = Math.max(10, Math.round((Number(lane.count || 0) / max) * 100));
        const className = [
          lane.selected ? 'is-selected' : '',
          lane.beforeWindow || lane.afterWindow ? 'is-outside-window' : ''
        ].filter(Boolean).join(' ');
        return '<button type="button" class="' + className + '" data-object-canvas-action="focus_story_scope" data-content-storyboard-scope-lane="' + escapeAttr(lane.key || '') + '" data-content-storyboard-insert="' + escapeAttr(lane.insertionKey || lane.key || '') + '"><span>' + escapeHtml(lane.label || lane.key || '') + '</span><b style="width: ' + width + '%"></b><em>' + escapeHtml(String(lane.count || 0)) + '</em></button>';
      }).join(''),
      '</section>'
    ].join('');
  }

  function renderChainDepthControls(storyboard) {
    const chain = storyboard && storyboard.chain || {};
    const active = chain.depth || '1';
    return [
      '<div class="content-storyboard-depth-controls" data-content-storyboard-depth-controls="true" aria-label="' + escapeAttr(t('storyboard.depth', 'Chain depth')) + '">',
      depthButton('1', active, t('storyboard.depth.one', '1 hop')),
      depthButton('2', active, t('storyboard.depth.two', '2 hops')),
      depthButton('full', active, t('storyboard.depth.full', 'Full')),
      '</div>'
    ].join('');
  }

  function scopeButton(action, active, label) {
    return '<button type="button" class="' + (active ? 'is-active' : '') + '" data-object-canvas-action="' + escapeAttr(action) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' + escapeHtml(label) + '</button>';
  }

  function depthButton(depth, active, label) {
    return '<button type="button" class="' + (active === depth ? 'is-active' : '') + '" data-object-canvas-action="set_chain_depth" data-content-storyboard-depth="' + escapeAttr(depth) + '" aria-pressed="' + (active === depth ? 'true' : 'false') + '">' + escapeHtml(label) + '</button>';
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
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

  const api = {renderTimelineScope, renderTimelineOverview, renderChainDepthControls};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapStoryboardScopeControls = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
