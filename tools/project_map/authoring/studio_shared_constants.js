(function initProjectMapStudioSharedConstants(global) {
  'use strict';

  const STORAGE_KEYS = {
    draftWorkspace: 'dendry_mod_studio.draft_workspace.v0.1',
    locale: 'dendry-mod-studio-locale',
    designHelpSeen: 'dendry-mod-studio-design-help-seen',
    designInspectorWidth: 'dendry-mod-studio-design-inspector-width',
    onboardingSeen: 'dendry-mod-studio-onboarding-seen'
  };

  const EVENT_NAMES = {
    indexLoaded: 'ProjectMap:index-loaded',
    legacyIndexLoaded: 'ProjectMapIndexLoaded',
    createTemplateChanged: 'ProjectMap:create-template-changed',
    designOpenExplore: 'project-map:design-open-explore',
    localeChanged: 'project-map:locale-changed',
    desktopIndexLoaded: 'ProjectMap:desktop-index-loaded',
    desktopScanProgress: 'ProjectMap:desktop-scan-progress',
    openOnboarding: 'ProjectMap:open-onboarding'
  };

  const TEXT_ROLE_LABELS = {
    body: ['textCorpus.role.body', 'body'],
    heading: ['textCorpus.role.heading', 'heading'],
    title: ['textCorpus.role.title', 'title'],
    subtitle: ['textCorpus.role.subtitle', 'subtitle'],
    option_label: ['textCorpus.role.optionLabel', 'option label'],
    conditional_body: ['textCorpus.role.conditionalBody', 'conditional body'],
    unavailable_text: ['textCorpus.role.unavailableText', 'unavailable text'],
    news_headline: ['textCorpus.role.newsHeadline', 'news headline'],
    news_description: ['textCorpus.role.newsDescription', 'news description'],
    monthly_popup_excerpt: ['textCorpus.role.monthlyPopupExcerpt', 'monthly popup excerpt'],
    surface_label: ['textCorpus.role.surfaceLabel', 'surface label']
  };

  const TEXT_EDITABILITY_LABELS = {
    text_proposal: ['textCorpus.editability.textProposal', 'text proposal'],
    draft_extractable: ['textCorpus.editability.draftExtractable', 'draft extractable'],
    draft_exportable: ['textCorpus.editability.draftExportable', 'source-backed draft'],
    source_patch: ['textCorpus.editability.sourcePatch', 'source patch'],
    ide_escape_hatch: ['coverage.ideEscapeHatch', 'source mapping needed']
  };

  const INSTALL_COPY = {
    browserReviewOnly: ['install.browserReviewOnly', 'Browser mode can review change plans. Use the desktop app to apply changes.']
  };

  function fallbackTranslate(_key, fallback) {
    return fallback;
  }

  function translator(t) {
    return typeof t === 'function' ? t : fallbackTranslate;
  }

  function humanizeKey(value) {
    return String(value || '').replace(/_/g, ' ');
  }

  function localizedLabel(map, value, t) {
    const key = String(value || '');
    const entry = map[key];
    if (!entry) {
      return humanizeKey(key);
    }
    return translator(t)(entry[0], entry[1]);
  }

  function textCorpusRoleLabel(role, t) {
    return localizedLabel(TEXT_ROLE_LABELS, role, t);
  }

  function textCorpusEditabilityLabel(editability, t) {
    return localizedLabel(TEXT_EDITABILITY_LABELS, editability, t);
  }

  function browserReviewOnlyMessage(t) {
    const entry = INSTALL_COPY.browserReviewOnly;
    return translator(t)(entry[0], entry[1]);
  }

  const api = {
    STORAGE_KEYS,
    EVENT_NAMES,
    TEXT_ROLE_LABELS,
    TEXT_EDITABILITY_LABELS,
    INSTALL_COPY,
    humanizeKey,
    textCorpusRoleLabel,
    textCorpusEditabilityLabel,
    browserReviewOnlyMessage
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapStudioSharedConstants = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
