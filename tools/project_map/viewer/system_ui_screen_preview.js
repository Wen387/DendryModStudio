(function initProjectMapSystemUiScreenPreview(global) {
  'use strict';

  function render(screen) {
    const model = screen || {};
    const selectedKey = String(model.selectedKey || '').replace(/^ui:/, '');
    return [
      '<section class="system-ui-live-preview system-screen-preview" data-system-ui-live-preview="true" data-system-ui-screen-preview="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.preview', 'Live preview')) + '</div>',
      '<div class="system-screen-shell" data-system-screen-shell="true" data-system-ui-recipe="' + escapeAttr(model.template || '') + '">',
      renderTopbar(model, selectedKey),
      '<div class="system-screen-body">',
      renderSidebar(model, selectedKey),
      renderMain(model, selectedKey),
      renderInteractiveRail(model, selectedKey),
      '</div>',
      renderLayoutFrame(model, selectedKey),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderTopbar(model, selectedKey) {
    const shell = model.shell || {};
    return [
      '<header class="system-screen-topbar">',
      renderRegionButton(model, 'screen_header', selectedKey, [
        '<strong>' + escapeHtml(shell.title || '') + '</strong>',
        '<span>' + escapeHtml(shell.subtitle || '') + '</span>'
      ].join('')),
      '<nav aria-label="' + escapeAttr(t('systemUi.region.header', 'Header / menu')) + '">',
      ensureArray(shell.menu).map((item) => '<span>' + escapeHtml(item) + '</span>').join(''),
      '</nav>',
      '</header>'
    ].join('');
  }

  function renderSidebar(model, selectedKey) {
    const region = regionByKey(model, 'sidebar_status') || {};
    const lines = String(region.body || '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 6);
    return [
      '<aside class="system-screen-sidebar">',
      '<div class="system-screen-tabs"><span>Main</span><span>Politics</span><span>Defense</span><span>Polls</span></div>',
      renderRegionButton(model, 'sidebar_status', selectedKey, [
        '<span class="system-screen-label">' + escapeHtml(t(region.labelKey, region.fallback || 'Sidebar / Status')) + '</span>',
        '<strong>' + escapeHtml(region.title || '') + '</strong>',
        '<div class="system-screen-status-lines">',
        lines.length ? lines.map((line) => '<span>' + escapeHtml(line) + '</span>').join('') : '<span>' + escapeHtml(t('systemUi.emptyStatus', 'No status lines yet.')) + '</span>',
        '</div>'
      ].join('')),
      '</aside>'
    ].join('');
  }

  function renderMain(model, selectedKey) {
    const main = regionByKey(model, 'main_content') || {};
    const options = regionByKey(model, 'main_options') || {};
    return [
      '<main class="system-screen-main">',
      '<article class="system-screen-card">',
      renderRegionButton(model, 'main_content', selectedKey, [
        '<span class="system-screen-label">' + escapeHtml(t(main.labelKey, main.fallback || 'Main content')) + '</span>',
        '<h2>' + escapeHtml(main.title || '') + '</h2>',
        '<p>' + escapeHtml(main.body || '') + '</p>'
      ].join('')),
      renderRegionButton(model, 'main_options', selectedKey, [
        '<span class="system-screen-label">' + escapeHtml(t(options.labelKey, options.fallback || 'Options')) + '</span>',
        '<strong>' + escapeHtml(options.title || '') + '</strong>',
        '<small>' + escapeHtml(options.body || '') + '</small>'
      ].join('')),
      '</article>',
      '</main>'
    ].join('');
  }

  function renderInteractiveRail(model, selectedKey) {
    return [
      '<aside class="system-screen-interactions">',
      renderCompactRegion(model, 'workspace_hand', selectedKey),
      renderCompactRegion(model, 'deck_lane', selectedKey),
      renderCompactRegion(model, 'action_card', selectedKey),
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
      '<strong>' + escapeHtml(region.title || '') + '</strong>',
      '<small>' + escapeHtml(region.body || '') + '</small>'
    ].join(''));
  }

  function renderRegionButton(model, key, selectedKey, inner, extraClass) {
    const region = regionByKey(model, key) || {family: '', key};
    const activeFamilies = ensureArray(model.focusFamilies);
    const selected = selectedKey === key;
    const focus = activeFamilies.includes(region.family);
    const className = [
      'system-screen-region',
      'system-screen-region-' + safeClass(key),
      'system-screen-family-' + safeClass(region.family),
      selected ? 'is-selected' : '',
      focus ? 'is-recipe-focus' : '',
      extraClass || ''
    ].filter(Boolean).join(' ');
    return '<button type="button" class="' + className + '" data-object-canvas-graph-node="ui:' + escapeAttr(key) + '" data-system-ui-region="' + escapeAttr(key) + '" data-system-screen-region="' + escapeAttr(key) + '" data-system-screen-family="' + escapeAttr(region.family || '') + '">' + inner + '</button>';
  }

  function regionByKey(model, key) {
    return ensureArray(model && model.regions).find((region) => region && region.key === key) || null;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeClass(value) {
    return String(value || 'item').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
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

  const api = {render};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSystemUiScreenPreview = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
