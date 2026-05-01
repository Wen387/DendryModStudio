(function initNewsDraft(global) {
  'use strict';

  const NEWS_DRAFT_VERSION = '0.1';
  const NEWS_KIND = 'news_item';
  const DELIVERY = new Set(['dated', 'background_pool']);
  const POOLS = new Set(['social_pool', 'intl_pool', 'gossip_pool']);
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function normalizeDraft(input) {
    const draft = isObject(input) ? clone(input) : {};
    draft.schemaVersion = String(draft.schemaVersion || NEWS_DRAFT_VERSION);
    draft.kind = String(draft.kind || NEWS_KIND);
    draft.id = String(draft.id || '').trim();
    draft.headline = String(draft.headline || '').trim();
    draft.description = String(draft.description || '').trim();
    draft.delivery = String(draft.delivery || 'dated').trim();
    draft.when = normalizeWhen(draft.when);
    draft.pool = normalizePool(draft.pool);
    return draft;
  }

  function normalizeWhen(value) {
    const when = isObject(value) ? value : {};
    return {
      year: numberOrNull(when.year),
      month: numberOrNull(when.month),
      slot: numberOrNull(when.slot) ?? 1,
      requiresJs: String(when.requiresJs || '').trim()
    };
  }

  function normalizePool(value) {
    const pool = isObject(value) ? value : {};
    return {
      name: String(pool.name || 'social_pool').trim(),
      requiresJs: String(pool.requiresJs || '').trim()
    };
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function installPlanApi() {
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      return require('./install_plan.js');
    }
    return global ? global.ProjectMapInstallPlan : null;
  }

  function validateDraft(input, projectIndex) {
    const draft = normalizeDraft(input);
    const diagnostics = [];

    if (draft.schemaVersion !== NEWS_DRAFT_VERSION) {
      diag(diagnostics, 'error', 'news_draft.schema_version', 'NewsDraft schemaVersion must be "0.1".');
    }
    if (draft.kind !== NEWS_KIND) {
      diag(diagnostics, 'error', 'news_draft.kind', 'Only kind "news_item" is supported in v0.6.');
    }
    if (!ID_RE.test(draft.id)) {
      diag(diagnostics, 'error', 'news_draft.id', 'News id must match /^[A-Za-z_][A-Za-z0-9_]*$/.');
    }
    if (!draft.headline) {
      diag(diagnostics, 'error', 'news_draft.headline', 'Headline is required.');
    }
    if (!DELIVERY.has(draft.delivery)) {
      diag(diagnostics, 'error', 'news_draft.delivery', 'Delivery must be "dated" or "background_pool".');
    }

    const knownHeadline = newsHeadlines(projectIndex);
    if (draft.headline && knownHeadline.has(draft.headline)) {
      diag(diagnostics, 'warning', 'news_draft.duplicate_headline', 'News headline already exists in the loaded ProjectIndex.');
    }

    if (draft.delivery === 'dated') {
      validateDated(draft, diagnostics);
    }
    if (draft.delivery === 'background_pool') {
      validatePool(draft, diagnostics);
    }
    checkRequiresJs(draft.when.requiresJs, diagnostics);
    checkRequiresJs(draft.pool.requiresJs, diagnostics);

    return {draft, diagnostics, ok: diagnostics.every((item) => item.severity !== 'error')};
  }

  function validateDated(draft, diagnostics) {
    const when = draft.when;
    if (!Number.isInteger(when.year) || when.year < 1) {
      diag(diagnostics, 'error', 'news_draft.year', 'Dated news requires a positive integer year.');
    }
    if (!Number.isInteger(when.month) || when.month < 1 || when.month > 12) {
      diag(diagnostics, 'error', 'news_draft.month', 'Dated news month must be 1-12.');
    }
    if (!Number.isInteger(when.slot) || when.slot < 1 || when.slot > 3) {
      diag(diagnostics, 'error', 'news_draft.slot', 'Dated news slot must be 1, 2, or 3.');
    }
  }

  function validatePool(draft, diagnostics) {
    if (!POOLS.has(draft.pool.name)) {
      diag(diagnostics, 'error', 'news_draft.pool', 'Background pool must be one of social_pool, intl_pool, gossip_pool.');
    }
  }

  function checkRequiresJs(text, diagnostics) {
    if (!text) {
      return;
    }
    if (/['"][^'"\n]*[\u4e00-\u9fff][^'"\n]*['"]/.test(text)) {
      diag(diagnostics, 'error', 'news_draft.requires_js', 'NewsDraft requiresJs must not compare Chinese strings.');
    }
    if (/;\s*\S/.test(text)) {
      diag(diagnostics, 'warning', 'news_draft.requires_js_statement', 'NewsDraft requiresJs should be a boolean expression, not multiple statements.');
    }
  }

  function newsHeadlines(projectIndex) {
    const items = projectIndex && projectIndex.semantic && projectIndex.semantic.news
      ? ensureArray(projectIndex.semantic.news.items)
      : [];
    return new Set(items.map((item) => String(item.headline || '')).filter(Boolean));
  }

  function diag(diagnostics, severity, code, message) {
    diagnostics.push({severity, code, message, confidence: 'exact'});
  }

  function renderSnippet(input, projectIndex) {
    const validation = validateDraft(input, projectIndex);
    const draft = validation.draft;
    return draft.delivery === 'background_pool'
      ? renderBackgroundSnippet(draft)
      : renderDatedSnippet(draft);
  }

  function renderDatedSnippet(draft) {
    const slot = draft.when.slot;
    const guards = ['Q.year == ' + draft.when.year, 'Q.month == ' + draft.when.month];
    if (draft.when.requiresJs) {
      guards.push(draft.when.requiresJs);
    }
    const lines = [
      '// NewsDraft: ' + draft.id,
      'if (' + guards.join(' && ') + ') {',
      '  Q.news_' + slot + ' = ' + jsString(draft.headline) + ';'
    ];
    if (draft.description) {
      lines.push('  Q.news_' + slot + '_desc = ' + jsString(draft.description) + ';');
    }
    lines.push('}');
    return lines.join('\n') + '\n';
  }

  function renderBackgroundSnippet(draft) {
    const objectParts = ['n: ' + jsString(draft.headline)];
    if (draft.description) {
      objectParts.push('d: ' + jsString(draft.description));
    }
    const push = draft.pool.name + '.push({' + objectParts.join(', ') + '});';
    return [
      '// NewsDraft: ' + draft.id,
      draft.pool.requiresJs ? 'if (' + draft.pool.requiresJs + ') ' + push : push
    ].join('\n') + '\n';
  }

  function jsString(value) {
    return "'" + String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n') + "'";
  }

  function buildExportBundle(input, projectIndex) {
    const validation = validateDraft(input, projectIndex);
    const draft = validation.draft;
    const snippet = renderSnippet(draft, projectIndex);
    const draftJson = JSON.stringify(draft, null, 2) + '\n';
    const installApi = installPlanApi();
    const plan = installApi.newsInstallPlan({
      id: draft.id,
      title: draft.headline,
      project: installApi.projectProvenanceFromIndex ? installApi.projectProvenanceFromIndex(projectIndex) : null,
      snippet,
      router: routerInstallHint(draft, projectIndex)
    });
    const installPlanJson = installApi.renderInstallPlanJson(plan);
    const patchPreview = installApi.renderPatchPreview(plan);
    const installChecklist = installApi.renderOperationChecklist(plan);
    const files = [
      {path: draft.id + '.post-event-news.snippet.js', content: snippet, kind: 'snippet'},
      {path: draft.id + '.news-draft.json', content: draftJson, kind: 'draft'},
      {path: draft.id + '.install-plan.json', content: installPlanJson, kind: 'install_plan'},
      {path: draft.id + '.patch-preview.diff', content: patchPreview, kind: 'patch_preview'},
      {path: draft.id + '.install-notes.txt', content: '', kind: 'notes'}
    ];
    const installNotes = [
      'Install Assistant: proposal only / not installed',
      '',
      'Export bundle files:',
      ...files.filter((file) => file.kind !== 'notes').map((file) => '- ' + file.path),
      '- ' + draft.id + '.install-notes.txt',
      '',
      'Generated files:',
      '- Review ' + draft.id + '.post-event-news.snippet.js before copying it.',
      '- Keep ' + draft.id + '.news-draft.json if you want to reopen this draft later.',
      '- Review ' + draft.id + '.patch-preview.diff for the proposed manual insertion.',
      '- Review the install operation checklist before editing post_event_news.',
      '',
      'Where to copy/paste:',
      '- Suggested source path: source/scenes/post_event_news.scene.dry',
      draft.delivery === 'background_pool'
        ? '- Add the snippet near the matching background pool in source/scenes/post_event_news.scene.dry.'
        : '- Add the snippet near the dated headline section in source/scenes/post_event_news.scene.dry.',
      '',
      'Variables/init/migration:',
      '- Not applicable for NewsDraft v0.1.',
      '',
      'Validation command:',
      'bash tools/build_and_validate.sh --skip-build --errors-only',
      '',
      'Review & Apply:',
      '- Studio can dry-run and apply this News snippet only after matching a known post_event_news anchor and dedupe token.',
      '- If the anchor is missing or duplicated, Review & Apply will stop and keep the step manual.'
    ].join('\n') + '\n';
    files[4].content = installNotes;
    return {
      draft,
      diagnostics: validation.diagnostics,
      ok: validation.ok,
      files,
      snippet,
      draftJson,
      installPlan: plan,
      installPlanJson,
      patchPreview,
      installChecklist,
      installNotes
    };
  }

  function routerInstallHint(draft, projectIndex) {
    if (!hasPostEventNewsEvidence(projectIndex)) {
      return null;
    }
    const dedupeSearch = '// NewsDraft: ' + draft.id;
    if (draft.delivery === 'background_pool') {
      return {
        path: 'source/scenes/post_event_news.scene.dry',
        anchorText: 'var ' + draft.pool.name + ' = [];',
        position: 'after',
        dedupeSearch
      };
    }
    return {
      path: 'source/scenes/post_event_news.scene.dry',
      anchorText: '// 2014 headlines + background effects',
      position: 'before',
      dedupeSearch
    };
  }

  function hasPostEventNewsEvidence(projectIndex) {
    const news = projectIndex && projectIndex.semantic && projectIndex.semantic.news
      ? projectIndex.semantic.news
      : {};
    const sources = ensureArray(news.sources).map((source) => String(source || '').replace(/\\/g, '/'));
    if (sources.includes('source/scenes/post_event_news.scene.dry')) {
      return true;
    }
    return ensureArray(news.items).some((item) => {
      const source = item && item.source ? item.source : {};
      return String(source.path || '').replace(/\\/g, '/') === 'source/scenes/post_event_news.scene.dry';
    });
  }

  const api = {
    NEWS_DRAFT_VERSION,
    normalizeDraft,
    validateDraft,
    renderSnippet,
    buildExportBundle,
    build: buildExportBundle,
    generate: buildExportBundle,
    routerInstallHint,
    jsString
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapNewsDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
