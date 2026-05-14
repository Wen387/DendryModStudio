(function initProjectMapExploreModel(global) {
  'use strict';

  const VIEW_DEFS = {
    overview: {
      label: 'Overview',
      i18nKey: 'nav.overview',
      sorts: ['code', 'count', 'severity'],
      defaultSort: 'count'
    },
    coverage: {
      label: 'Coverage Map',
      i18nKey: 'nav.coverage',
      sorts: ['label', 'coverageLevel', 'count', 'safeApplyCount', 'manualReviewCount', 'unsupportedCount'],
      defaultSort: 'label'
    },
    scenes: {
      label: 'Scenes',
      i18nKey: 'nav.scenes',
      sorts: ['id', 'title', 'path', 'type', 'confidence'],
      defaultSort: 'id'
    },
    events: {
      label: 'Events',
      i18nKey: 'nav.events',
      sorts: ['id', 'title', 'path', 'type', 'confidence'],
      defaultSort: 'id'
    },
    cards: {
      label: 'Cards',
      i18nKey: 'nav.cards',
      sorts: ['id', 'title', 'path', 'type', 'confidence'],
      defaultSort: 'id'
    },
    news: {
      label: 'News',
      i18nKey: 'nav.news',
      sorts: ['headline', 'path', 'line', 'confidence'],
      defaultSort: 'headline'
    },
    textCorpus: {
      label: 'Text',
      i18nKey: 'nav.textCorpus',
      sorts: ['text', 'role', 'path', 'line', 'confidence', 'editability'],
      defaultSort: 'role'
    },
    assets: {
      label: 'Assets',
      i18nKey: 'nav.assets',
      sorts: ['name', 'type', 'path', 'extension', 'sourceKind', 'usageCount', 'confidence'],
      defaultSort: 'name'
    },
    surfaceText: {
      label: 'Surface Text',
      i18nKey: 'nav.surfaceText',
      sorts: ['label', 'area', 'path', 'line', 'variableName', 'confidence'],
      defaultSort: 'label'
    },
    variables: {
      label: 'Variables',
      i18nKey: 'nav.variables',
      sorts: ['name', 'readCount', 'writeCount', 'tagCount', 'confidence'],
      defaultSort: 'name'
    },
    diagnostics: {
      label: 'Diagnostics',
      i18nKey: 'nav.diagnostics',
      sorts: ['severity', 'code', 'path', 'sceneId', 'confidence'],
      defaultSort: 'severity'
    }
  };

  const SEVERITY_RANK = {error: 0, warning: 1, info: 2};
  const CONFIDENCE_ORDER = {
    exact: 0,
    static_inferred: 1,
    profile_heuristic: 2,
    opaque: 3
  };
  const EXPLORE_SEARCH_DEBOUNCE_MS = 140;
  const EXPLORE_INSPECTOR_WIDTH_KEY = 'dendry-mod-studio-explore-inspector-width';
  const EXPLORE_INSPECTOR_MIN_WIDTH = 280;
  const EXPLORE_INSPECTOR_MAX_WIDTH = 720;
  const VIRTUAL_LIST_THRESHOLD = 700;
  const VIRTUAL_LIST_ROW_HEIGHT = 58;
  const VIRTUAL_ASSET_ROW_HEIGHT = 250;
  const VIRTUAL_ASSET_CARD_MIN_WIDTH = 170;
  const VIRTUAL_LIST_OVERSCAN = 12;
  const SORT_COLLATOR = typeof Intl !== 'undefined' && typeof Intl.Collator === 'function'
    ? new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'})
    : null;

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function currentLocale() {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.getLocale === 'function' ? i18n.getLocale() : 'en';
  }

  function applyI18n(root) {
    const i18n = global && global.ProjectMapI18n;
    if (i18n && typeof i18n.applyTranslations === 'function') {
      i18n.applyTranslations(root || global.document);
    }
  }

  function studioContracts() {
    if (global && global.ProjectMapStudioContracts) {
      return global.ProjectMapStudioContracts;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('../authoring/studio_contracts.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function assetModelApi() {
    if (global && global.ProjectMapAssetModel) {
      return global.ProjectMapAssetModel;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('../authoring/asset_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function editCapabilityApi() {
    if (global && global.ProjectMapEditCapability) {
      return global.ProjectMapEditCapability;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('../authoring/edit_capability_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function visibleObjectCoverageApi() {
    if (global && global.ProjectMapVisibleObjectCoverage) {
      return global.ProjectMapVisibleObjectCoverage;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('../authoring/visible_object_coverage_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function viewLabel(view) {
    const def = VIEW_DEFS[view];
    return def ? t(def.i18nKey || '', def.label) : view;
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function requiredArray(index, key, errors) {
    if (!Array.isArray(index[key])) {
      errors.push(key + ' must be an array');
    }
  }

  function validateProjectIndex(index) {
    const errors = [];
    if (!isObject(index)) {
      return {ok: false, errors: ['Project index must be a JSON object']};
    }
    if (index.schemaVersion !== '0.1') {
      errors.push('schemaVersion must be "0.1"');
    }
    if (!isObject(index.project)) {
      errors.push('project must be an object');
    }
    if (!isObject(index.semantic)) {
      errors.push('semantic must be an object');
    }
    if (!isObject(index.summary)) {
      errors.push('summary must be an object');
    }
    requiredArray(index, 'profiles', errors);
    requiredArray(index, 'scenes', errors);
    requiredArray(index, 'edges', errors);
    requiredArray(index, 'variables', errors);
    requiredArray(index, 'diagnostics', errors);
    return {ok: errors.length === 0, errors};
  }

  function makeMap(items, keyFn) {
    const map = new Map();
    ensureArray(items).forEach((item, index) => {
      const key = keyFn(item, index);
      if (key !== undefined && key !== null && key !== '') {
        map.set(String(key), item);
      }
    });
    return map;
  }

  function groupBy(items, keyFn) {
    const map = new Map();
    ensureArray(items).forEach((item, index) => {
      const key = keyFn(item, index);
      if (key === undefined || key === null || key === '') {
        return;
      }
      const id = String(key);
      if (!map.has(id)) {
        map.set(id, []);
      }
      map.get(id).push(item);
    });
    return map;
  }

  function buildVariableAccessesByPath(variables) {
    const byPath = new Map();

    function add(path, entry) {
      if (!path) {
        return;
      }
      const key = String(path);
      if (!byPath.has(key)) {
        byPath.set(key, []);
      }
      byPath.get(key).push(entry);
    }

    ensureArray(variables).forEach((variable) => {
      const name = variable && variable.name ? String(variable.name) : '';
      if (!name) {
        return;
      }
      ensureArray(variable.reads).forEach((ref) => {
        if (ref && ref.path) {
          add(ref.path, {name, access: 'read', source: ref});
        }
      });
      ensureArray(variable.writes).forEach((ref) => {
        if (ref && ref.path) {
          add(ref.path, {name, access: 'write', source: ref});
        }
      });
    });
    return byPath;
  }

  function diagnosticGroups(diagnostics) {
    const byCode = new Map();
    ensureArray(diagnostics).forEach((diag) => {
      const code = diag.code || 'unknown';
      const current = byCode.get(code) || {
        code,
        count: 0,
        severity: diag.severity || 'info',
        confidence: diag.confidence || '',
        message: diag.message || '',
        examples: []
      };
      current.count += 1;
      if (severityRank(diag.severity) < severityRank(current.severity)) {
        current.severity = diag.severity;
      }
      if (confidenceRank(diag.confidence) < confidenceRank(current.confidence)) {
        current.confidence = diag.confidence;
      }
      if (current.examples.length < 12) {
        current.examples.push(diag);
      }
      byCode.set(code, current);
    });
    return Array.from(byCode.values()).sort((a, b) => {
      return compareValues(severityRank(a.severity), severityRank(b.severity)) ||
        compareValues(a.code, b.code);
    });
  }

  function diagnosticBreakdown(diagnostics) {
    return diagnosticGroups(diagnostics);
  }

  function coverageRows(index) {
    const semantic = index && index.semantic ? index.semantic : {};
    const surfaceItems = ensureArray(semantic.surfaceText && semantic.surfaceText.items);
    const assets = ensureArray(semantic.assets && semantic.assets.items)
      .map((item) => normalizeAssetForViewer(item, index));
    const sourceSurface = surfaceItems.filter((item) => item && item.editability === 'draft_exportable').length;
    const ideSurface = surfaceItems.filter((item) => item && item.editability === 'ide_escape_hatch').length;
    const events = ensureArray(semantic.events);
    const cards = ensureArray(semantic.cards);
    const news = ensureArray(semantic.news && semantic.news.items).filter((item) => item && item.headline);
    const eventPopups = ensureArray(semantic.news && semantic.news.eventPopups).filter((item) => item && item.headline);
    const hands = ensureArray(semantic.hands);
    const pinned = ensureArray(semantic.pinnedCards);
    const scenes = ensureArray(index && index.scenes);
    const visibleCoverage = visibleObjectCoverageReport(index);
    return [
      {
        id: 'find_and_compare',
        label: 'Find What To Change',
        count: scenes.length + news.length + eventPopups.length + surfaceItems.length + assets.length,
        coverageLevel: 'mixed',
        coverageLabel: 'In Studio, read-only',
        releasePriority: 'must-have',
        noCodeCompletion: 'mostly',
        authoringStatus: 'Explore lists, Design focus graph, source-aware inspector',
        installStatus: 'not an install step',
        safeApplyCount: 0,
        manualReviewCount: 0,
        unsupportedCount: 0,
        userCanDo: 'Search project content, browse player-flow Design nodes, inspect source refs, and compare with a baseline ProjectIndex.',
        remainingGap: 'No visual in-game preview yet; graph is a navigation surface, not a rendered game screen.',
        nextAction: 'Start in Design for flow context, then Open in Explore for rows and inspector actions.',
        studioPath: 'Design -> filter/search -> select node, or Explore -> grouped sidebar/search.',
        workflowSteps: ['Load project', 'Search or filter by content type', 'Select row/node', 'Inspect source, diagnostics, variables, and related content']
      },
      {
        id: 'events',
        label: 'World Events',
        count: events.length,
        coverageLevel: 'draft_seed',
        coverageLabel: 'In Studio, draftable',
        releasePriority: 'must-have',
        noCodeCompletion: 'partial',
        authoringStatus: 'Parsed-to-draft authoring for text, choice, and large-choice events',
        installStatus: 'scene create operations; protected router/root wiring uses review or advanced apply',
        safeApplyCount: 1,
        manualReviewCount: 2,
        unsupportedCount: 0,
        userCanDo: 'Create new world events, copy parsed events as new drafts, and preview install operations before Review & Apply.',
        remainingGap: 'Dynamic/raw structures and protected router/root migration still need explicit review.',
        nextAction: 'Use Object Canvas, Explore, or Design to copy parsed events into the shared authoring draft path.',
        studioPath: 'Create -> World Event, or Design -> Create follow-up / Bridge event.',
        workflowSteps: ['Choose event shape and requirements', 'Write text/options/effects', 'Review diagnostics and patch preview', 'Send supported operations to Review & Apply']
      },
      {
        id: 'news',
        label: 'News',
        count: news.length + eventPopups.length,
        coverageLevel: 'draft_seed',
        coverageLabel: 'In Studio, guarded when anchored',
        releasePriority: 'must-have',
        noCodeCompletion: 'partial',
        authoringStatus: 'News drafts and linked monthly-popup event drafts use Review & Apply plans',
        installStatus: 'guarded post_event_news insert when router anchor evidence exists; legacy post_event manual review',
        safeApplyCount: 0,
        manualReviewCount: eventPopups.length ? 1 : 0,
        unsupportedCount: 0,
        userCanDo: 'Create dated news/background-pool snippets, and inspect legacy monthly event popups as event drafts.',
        remainingGap: 'News snippets need a unique post_event_news anchor and dedupe token before guarded install; legacy post_event monthly popups still stay in event drafts/manual review.',
        nextAction: 'Use News Wizard for ticker snippets; dry-run Review & Apply before applying guarded router inserts.',
        studioPath: 'Create -> News, or Explore/Design -> Monthly Event Popup -> Edit as Draft.',
        workflowSteps: ['Identify ticker news vs monthly popup', 'Use the matching wizard', 'Review snippet or scene draft', 'Dry-run anchored post_event_news inserts; keep missing-anchor cases manual']
      },
      {
        id: 'cards',
        label: 'Cards / Advisor-like',
        count: cards.length,
        coverageLevel: 'draft_seed',
        coverageLabel: 'In Studio, wiring review',
        releasePriority: 'must-have',
        noCodeCompletion: 'partial',
        authoringStatus: 'Parsed-to-draft authoring for choice, menu, large, and pinned text cards',
        installStatus: 'safe scene create; hand/sidebar wiring manual review',
        safeApplyCount: 1,
        manualReviewCount: 1,
        unsupportedCount: 0,
        userCanDo: 'Create action-card / advisor-like drafts, copy parsed cards as new drafts, and preview scene operations.',
        remainingGap: 'Hand/deck/sidebar wiring is indexed and proposed, but still not automatically applied.',
        nextAction: 'Use Object Canvas, Explore, or Design to keep parsed card sections/options in one draft path.',
        studioPath: 'Create -> Card, or Design -> Create related card.',
        workflowSteps: ['Pick card shape', 'Write sections/options/effects', 'Review scene and wiring operations', 'Send supported operations to Review & Apply']
      },
      {
        id: 'surface_text',
        label: 'Surface Text',
        count: surfaceItems.length,
        coverageLevel: sourceSurface ? 'mixed' : 'ide_escape_hatch',
        coverageLabel: sourceSurface ? 'Mixed safe / source review' : 'Source review guidance',
        releasePriority: 'must-have',
        noCodeCompletion: sourceSurface ? 'partial' : 'guided',
        authoringStatus: 'replacement draft or source-mapping task',
        installStatus: 'source-backed replace safe; generated UI manual',
        safeApplyCount: sourceSurface,
        manualReviewCount: ideSurface,
        unsupportedCount: 0,
        userCanDo: 'Search labels like sidebar/status text and generate replacement proposals.',
        remainingGap: 'Source-backed labels can be guarded replacements; out/html evidence remains manual because it is generated/custom UI.',
        nextAction: 'Prefer source-backed rows. Treat out/html rows as source-mapping tasks, not automatic edits.',
        studioPath: 'Explore -> Surface Text -> Edit Text Proposal, or Create -> Edit Text.',
        workflowSteps: ['Find the visible label', 'Enter replacement text', 'Review install plan', 'Safe-apply only if source-backed and line evidence still matches']
      },
      {
        id: 'variables_effects',
        label: 'Variables / Effects',
        count: ensureArray(index && index.variables).length,
        coverageLevel: 'guided_only',
        coverageLabel: 'Picker + warnings',
        releasePriority: 'must-have',
        noCodeCompletion: 'partial',
        authoringStatus: 'variable datalist and diagnostics guidance',
        installStatus: 'depends on owning draft/install plan',
        safeApplyCount: 0,
        manualReviewCount: 1,
        unsupportedCount: 0,
        userCanDo: 'Use ProjectIndex variables while adding simple Q effects; review diagnostics and source refs before exporting.',
        remainingGap: 'Variables are not yet grouped by gameplay meaning/range, and advanced effect logic still requires care.',
        nextAction: 'Use the effect helper for simple = / += / -= changes; use Precise Source Edit or advanced apply for shared-line and complex effects.',
        studioPath: 'Create -> World Event/Card -> Effects helper; Explore -> Variables for read/write context.',
        workflowSteps: ['Pick an existing variable', 'Use simple = / += / -= operation', 'Review diagnostics', 'Avoid Chinese string comparisons and undefined variables']
      },
      {
        id: 'existing_text',
        label: 'Existing Event / Card / News Text',
        count: events.length + cards.length + news.length,
        coverageLevel: 'mixed',
        coverageLabel: 'Click-to-edit',
        releasePriority: 'must-have',
        noCodeCompletion: 'guided',
        authoringStatus: 'Click-to-edit from Explore / Design / Object Canvas',
        installStatus: 'safe, guarded, or advanced apply from source-backed edits',
        safeApplyCount: 0,
        manualReviewCount: events.length + cards.length + news.length,
        unsupportedCount: 0,
        userCanDo: 'Select visible event/card/news text, click Edit, make the change, preview before/after, then send the install operation to Review & Apply.',
        remainingGap: 'Source-backed text falls back to Precise Source Edit when no field-level editor exists; missing source anchors are treated as Studio mapping bugs.',
        nextAction: 'Click visible text to open the owning field, section, linked event, or Precise Source Edit.',
        studioPath: 'Explore / Event Workbench / Object Canvas -> Edit -> Review & Apply.',
        workflowSteps: ['Select visible content', 'Click Edit', 'Change the field or source slice', 'Preview before/after', 'Send operation to Review & Apply']
      },
      visibleObjectCoverageRow(visibleCoverage),
      {
        id: 'hands_sidebar',
        label: 'Hands / Sidebar Wiring',
        count: hands.length + pinned.length,
        coverageLevel: 'guided_only',
        coverageLabel: 'Guided review only',
        releasePriority: 'must-have',
        noCodeCompletion: 'guided',
        authoringStatus: 'indexed evidence only',
        installStatus: 'manual review',
        safeApplyCount: 0,
        manualReviewCount: hands.length + pinned.length,
        unsupportedCount: 0,
        userCanDo: 'See evidence and install checklist guidance for hand/sidebar effects.',
        remainingGap: 'No safe graphical editor for hand/deck/sidebar routers yet.',
        nextAction: 'Use Studio to locate the relevant evidence, then pick a source anchor or keep the operation in review.',
        studioPath: 'Coverage Map -> Hands / Sidebar Wiring, plus Install mode manual operations.',
        workflowSteps: ['Use card export wiring proposal', 'Review hand/deck/sidebar evidence', 'Choose a source anchor or keep review blocked', 'Run validation']
      },
      {
        id: 'install_review',
        label: 'Install / Apply Proposals',
        count: 1,
        coverageLevel: 'mixed',
        coverageLabel: 'In Studio, guarded',
        releasePriority: 'must-have',
        noCodeCompletion: 'partial',
        authoringStatus: 'install-plan checklist and patch preview',
        installStatus: 'safe apply narrow; manual review preserved',
        safeApplyCount: 2,
        manualReviewCount: 4,
        unsupportedCount: 0,
        userCanDo: 'Load an install plan, see safe/manual/refused operations, and avoid accidentally writing protected files.',
        remainingGap: 'Root/post_event/news routers and wiring are still manual; Studio does not provide one-click full install.',
        nextAction: 'Use Install mode to separate what can be applied from what must be reviewed.',
        studioPath: 'Install -> load install-plan.json.',
        workflowSteps: ['Download bundle', 'Load install plan', 'Review safe/manual/refused groups', 'Dry-run/apply only guarded safe operations']
      },
      {
        id: 'raw_dry_js',
        label: 'Raw .dry / JS Routers',
        count: 0,
        coverageLevel: 'ide_escape_hatch',
        coverageLabel: 'Source mapping needed',
        releasePriority: 'nice-to-have',
        noCodeCompletion: 'no',
        authoringStatus: 'not a raw editor',
        installStatus: 'source review',
        safeApplyCount: 0,
        manualReviewCount: 1,
        unsupportedCount: 0,
        userCanDo: 'Use source refs, diagnostics, and install notes to find the right file/line.',
        remainingGap: 'Studio intentionally does not expose arbitrary raw .dry / JS editing in v0.76.',
        nextAction: 'Use Open in Explore / source refs, then edit the raw file outside Studio when necessary.'
      },
      {
        id: 'preview_assets',
        label: 'Preview / Image / Audio Assets',
        count: assets.length,
        coverageLevel: assets.length ? 'guided_only' : 'not_started',
        coverageLabel: assets.length ? 'In Studio, read-only' : 'Not started',
        releasePriority: 'feedback-release blocker if users expect WYSIWYG',
        noCodeCompletion: assets.length ? 'guided' : 'no',
        authoringStatus: 'read-only asset library, usage refs, preview readiness, and missing-reference diagnostics',
        installStatus: 'manual asset files; Studio does not copy/import/install assets',
        safeApplyCount: 0,
        manualReviewCount: assets.length,
        unsupportedCount: 0,
        userCanDo: 'Inspect image/audio assets, copy reference paths, see usage refs, and catch Missing asset reference diagnostics in previews.',
        remainingGap: 'No asset picker insertion, automatic packaging, copy/import, optimize, or install flow yet.',
        nextAction: 'Use Assets gallery/reference helper; preview notes flag missing assetRefs before review.',
        studioPath: 'Explore -> Assets for gallery/reference helper; Create / Preview shows assetRefs and missing diagnostics.',
        workflowSteps: ['Open Assets view', 'Copy/reference asset path', 'Review missing asset diagnostics', 'Install asset files manually']
      }
    ];
  }

  function visibleObjectCoverageReport(index) {
    const api = visibleObjectCoverageApi();
    if (api && typeof api.buildCoverageReport === 'function') {
      try {
        const semantic = index && index.semantic || {};
        const textCorpusCount = ensureArray(semantic.textCorpus && semantic.textCorpus.items).length;
        const largeProjectOptions = textCorpusCount > 2000
          ? {includeVariables: false, includeStructuredLogic: false}
          : {};
        return api.buildCoverageReport(index || {}, largeProjectOptions);
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function visibleObjectCoverageRow(report) {
    const summary = report && report.summary || {};
    const goalW = summary.goalW || {};
    const safeCoverage = percentLabel(goalW.safeEditCoverage);
    const routeCoverage = percentLabel(summary.routeCoverage);
    const previewCoverage = percentLabel(goalW.previewCoverage);
    const structuredCoverage = percentLabel(summary.structuredLogicCoverage);
    const passesGoalW = goalW.passes70 !== false;
    return {
      id: 'visible_object_editor',
      label: 'Visible Object Editor',
      count: summary.total || 0,
      coverageLevel: passesGoalW ? 'mixed' : 'guided_only',
      coverageLabel: passesGoalW ? 'Goal W 70% met' : 'Goal W needs work',
      releasePriority: 'must-have',
      noCodeCompletion: passesGoalW ? 'mostly' : 'partial',
      authoringStatus: 'coverage report for visible event/card/news/text editing routes',
      installStatus: 'guarded where source-backed; manual boundaries remain explicit',
      safeApplyCount: summary.safeEditable || 0,
      manualReviewCount: summary.manualBoundaryCount || 0,
      unsupportedCount: summary.unsupportedCount || 0,
      userCanDo: 'Check whether visible objects can be routed, previewed, edited, or sent to manual review before planning parser work.',
      remainingGap: 'Goal W focuses on player-visible text. Goal X still needs structured conditions, routes, effects, variables, and System UI consumers.',
      nextAction: 'Use this row as the coverage denominator before improving parser routes or graphical editor entry points.',
      studioPath: 'Coverage Map -> Visible Object Editor; Storyboard/Card Board/Explore -> open object editor.',
      workflowSteps: [
        'Build visible object coverage report',
        'Check route, safe edit, preview, and manual-boundary counts',
        'Open object editor for supported rows',
        'Escalate complex logic to Goal X'
      ],
      coverageMetrics: {
        routeCoverage,
        goalWSafeEditCoverage: safeCoverage,
        goalWPreviewCoverage: previewCoverage,
        structuredLogicCoverage: structuredCoverage
      }
    };
  }

  function percentLabel(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return '0%';
    }
    return Math.round(num * 100) + '%';
  }

  function coverageField(row, field) {
    if (!row) {
      return '';
    }
    const id = String(row.id || '').replace(/[^A-Za-z0-9_-]/g, '');
    const fallback = row[field] || '';
    return id ? t('coverage.row.' + id + '.' + field, fallback) : fallback;
  }

  function coverageWorkflowSteps(row) {
    const fallback = ensureArray(row && row.workflowSteps);
    const id = row && String(row.id || '').replace(/[^A-Za-z0-9_-]/g, '');
    const raw = id ? t('coverage.row.' + id + '.workflowSteps', fallback.join('|')) : fallback.join('|');
    return String(raw || '')
      .split('|')
      .map((step) => step.trim())
      .filter(Boolean);
  }

  function coveragePriorityLabel(priority) {
    const value = String(priority || '');
    const labels = {
      'must-have': t('coverage.priority.mustHave', 'must-have'),
      'nice-to-have': t('coverage.priority.niceToHave', 'nice-to-have'),
      'feedback-release blocker if users expect WYSIWYG': t('coverage.priority.feedbackBlocker', 'feedback-release blocker if users expect WYSIWYG')
    };
    return labels[value] || value;
  }

  function coverageCompletionLabel(value) {
    const key = String(value || '');
    const labels = {
      mostly: t('coverage.completion.mostly', 'mostly'),
      partial: t('coverage.completion.partial', 'partial'),
      guided: t('coverage.completion.guided', 'guided'),
      no: t('coverage.completion.no', 'no')
    };
    return labels[key] || key;
  }

  function noCodeCompletionLabel(value) {
    return t('coverage.noCode', 'no-code') + ' ' + coverageCompletionLabel(value);
  }

  function coverageCountBadge(kind, count) {
    const labels = {
      safe: t('coverage.safe', 'safe'),
      manual: t('coverage.manual', 'manual'),
      unsupported: t('coverage.unsupported', 'unsupported'),
      gap: t('coverage.gap', 'gap')
    };
    return (labels[kind] || kind) + ' ' + String(count || 0);
  }

  function buildViewModel(index) {
    const validation = validateProjectIndex(index);
    if (!validation.ok) {
      const error = new Error(validation.errors.join('; '));
      error.validationErrors = validation.errors;
      throw error;
    }

    const semantic = index.semantic || {};
    const scenes = ensureArray(index.scenes);
    const edges = ensureArray(index.edges);
    const variables = ensureArray(index.variables);
    const diagnostics = ensureArray(index.diagnostics);

    const scenesById = makeMap(scenes, (scene) => scene.id);
    const sceneIdsByEndpoint = endpointSceneMap(scenes);
    const edgesByFrom = groupBy(edges, (edge) => edge.from);
    const edgesByTo = groupBy(edges, (edge) => edge.to);
    const variablesByName = makeMap(variables, (variable) => variable.name);
    const diagnosticsByScene = groupBy(diagnostics, (diag) => diag.sceneId);
    const diagnosticsByPath = groupBy(diagnostics, (diag) => diag.path);

    const newsItems = ensureArray(semantic.news && semantic.news.items);
    const eventPopups = ensureArray(semantic.news && semantic.news.eventPopups);
    const assets = ensureArray(semantic.assets && semantic.assets.items)
      .map((item) => normalizeAssetForViewer(item, index));
    const textCorpus = ensureArray(semantic.textCorpus && semantic.textCorpus.items);

    const lists = {
      scenes,
      events: materializeSceneRefs(semantic.events, scenesById),
      cards: materializeSceneRefs(semantic.cards, scenesById),
      hands: materializeSceneRefs(semantic.hands, scenesById),
      decks: materializeSceneRefs(semantic.decks, scenesById),
      pinnedCards: materializeSceneRefs(semantic.pinnedCards, scenesById),
      news: newsItems.concat(eventPopups),
      newsItems,
      eventPopups,
      textCorpus,
      assets,
      surfaceText: ensureArray(semantic.surfaceText && semantic.surfaceText.items),
      variables,
      diagnostics,
      overview: diagnosticBreakdown(diagnostics),
      coverage: coverageRows(index)
    };

    const uiLabels = profileUiLabels(index);

    return {
      index,
      project: index.project || {},
      summary: index.summary || {},
      profiles: ensureArray(index.profiles),
      uiLabels,
      semantic,
      scenes,
      edges,
      variables,
      diagnostics,
      scenesById,
      sceneIdsByEndpoint,
      edgesByFrom,
      edgesByTo,
      variablesByName,
      variableAccessesByPath: buildVariableAccessesByPath(variables),
      textCorpusContextIndex: buildTextCorpusContextIndex(textCorpus),
      normalizedRowsByView: new Map(),
      sortedRowsByView: new Map(),
      diagnosticsByScene,
      diagnosticsByPath,
      lists
    };
  }

  function normalizeAssetForViewer(item, projectIndex) {
    const api = assetModelApi();
    if (api && typeof api.normalizeAssetItem === 'function') {
      return api.normalizeAssetItem(item, {projectIndex});
    }
    return item || {};
  }

  function profileUiLabels(index) {
    const defaults = {
      advisorLikeSingular: 'Advisor',
      advisorLikePlural: 'Advisors'
    };
    const activeIds = new Set(ensureArray(index.project && index.project.profileIds).map(String));
    const profiles = ensureArray(index.profiles)
      .filter((profile) => !activeIds.size || activeIds.has(String(profile.id || '')))
      .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));
    return profiles.reduce((labels, profile) => {
      return Object.assign(labels, isObject(profile.uiLabels) ? profile.uiLabels : {});
    }, Object.assign({}, defaults));
  }

  function materializeSceneRefs(items, scenesById) {
    return ensureArray(items).map((item) => {
      if (!item || !item.id) {
        return item;
      }
      const scene = scenesById.get(String(item.id));
      return scene ? Object.assign({}, scene, item, {scene}) : item;
    });
  }

  function endpointSceneMap(scenes) {
    const map = new Map();
    ensureArray(scenes).forEach((scene) => {
      if (!scene || !scene.id) {
        return;
      }
      const sceneId = String(scene.id);
      map.set(sceneId, sceneId);
      ensureArray(scene.sections).forEach((section) => {
        if (section && section.id) {
          map.set(String(section.id), sceneId);
        }
      });
    });
    return map;
  }

  function severityRank(severity) {
    return SEVERITY_RANK[String(severity || 'info')] ?? 3;
  }

  function confidenceRank(confidence) {
    return CONFIDENCE_ORDER[String(confidence || '')] ?? 9;
  }

  function firstSource(item) {
    if (!item) {
      return null;
    }
    if (item.source) {
      return item.source;
    }
    if (item.sourceSpan) {
      return item.sourceSpan;
    }
    if (item.scene && item.scene.sourceSpan) {
      return item.scene.sourceSpan;
    }
    return null;
  }

  function sourceLine(source) {
    if (!source) {
      return '';
    }
    return source.line || source.startLine || '';
  }

  function sourceLabel(source) {
    if (!source) {
      return '';
    }
    const path = source.path || '';
    const line = sourceLine(source);
    if (source.startLine && source.endLine && source.endLine !== source.startLine) {
      return path + ':' + source.startLine + '-' + source.endLine;
    }
    return line ? path + ':' + line : path;
  }

  function normalizeForView(view, item, index, model) {
    if (view === 'overview') {
      return {
        key: 'overview:' + item.code,
        primary: item.code,
        secondary: item.message || 'Diagnostic family',
        meta: String(item.count),
        badges: [
          {text: item.severity || 'info', className: item.severity || 'info'},
          {text: item.confidence || 'mixed', className: item.confidence || ''}
        ],
        searchText: [item.code, item.severity, item.message].join(' '),
        sortValues: item,
        raw: item
      };
    }

    if (view === 'variables') {
      const tags = ensureArray(item.tags);
      return {
        key: 'variable:' + item.name,
        primary: item.name,
        secondary: tags.join(', ') || item.scope || 'q',
        meta: 'R ' + (item.readCount || 0) + ' / W ' + (item.writeCount || 0),
        badges: [{text: item.confidence || 'static_inferred', className: item.confidence || 'static_inferred'}],
        searchText: [item.name, tags.join(' '), item.scope].join(' '),
        sortValues: Object.assign({tagCount: tags.length}, item),
        raw: item
      };
    }

    if (view === 'diagnostics') {
      const source = firstSource(item);
      return {
        key: 'diagnostic:' + index,
        primary: item.code || 'diagnostic',
        secondary: item.message || '',
        meta: sourceLabel(source),
        badges: [
          {text: item.severity || 'info', className: item.severity || 'info'},
          {text: item.confidence || 'opaque', className: item.confidence || 'opaque'}
        ],
        searchText: [item.code, item.message, item.path, item.sceneId, item.severity, item.confidence].join(' '),
        sortValues: item,
        raw: item
      };
    }

    if (view === 'coverage') {
      return {
        key: 'coverage:' + item.id,
        primary: coverageField(item, 'label') || item.id,
        secondary: coverageField(item, 'userCanDo') || coverageField(item, 'authoringStatus') || '',
        meta: labelForBadge(item.coverageLabel || item.coverageLevel || ''),
        badges: [
          {text: item.coverageLabel || item.coverageLevel || 'unknown', className: coverageClass(item.coverageLevel)},
          item.releasePriority ? {text: coveragePriorityLabel(item.releasePriority), className: priorityClass(item.releasePriority)} : null,
          item.noCodeCompletion ? {text: noCodeCompletionLabel(item.noCodeCompletion), className: completionClass(item.noCodeCompletion)} : null,
          {text: coverageCountBadge('safe', item.safeApplyCount), className: 'info'},
          {text: coverageCountBadge('manual', item.manualReviewCount), className: 'warning'},
          item.unsupportedCount ? {text: coverageCountBadge('gap', item.unsupportedCount), className: 'opaque'} : null
        ],
        searchText: [
          item.id,
          coverageField(item, 'label'),
          item.coverageLevel,
          item.coverageLabel,
          coverageField(item, 'authoringStatus'),
          coverageField(item, 'installStatus'),
          coverageField(item, 'userCanDo'),
          coverageField(item, 'remainingGap'),
          coverageField(item, 'nextAction'),
          item.releasePriority,
          item.noCodeCompletion,
          coverageField(item, 'studioPath'),
          coverageWorkflowSteps(item).join(' ')
        ].join(' '),
        sortValues: item,
        raw: item
      };
    }

    if (view === 'news') {
      const source = firstSource(item);
      const legacyPopup = item.delivery === 'legacy_event_popup';
      return {
        key: (legacyPopup ? 'news-popup:' : 'news:') + (item.linkedSceneId || item.id || index),
        primary: item.headline || '(untitled news)',
        secondary: legacyPopup ? (item.description || sourceLabel(source)) : sourceLabel(source),
        meta: legacyPopup ? 'Monthly event popup' : (item.confidence || 'static_inferred'),
        badges: legacyPopup
          ? [
              {text: 'monthly_popup', className: 'info'},
              {text: item.confidence || 'static_inferred', className: item.confidence || 'static_inferred'}
            ]
          : [{text: item.confidence || 'static_inferred', className: item.confidence || 'static_inferred'}],
        searchText: [
          item.headline,
          item.description,
          item.linkedSceneId,
          item.delivery,
          item.router && item.router.tag,
          sourceLabel(source),
          item.confidence
        ].join(' '),
        sortValues: Object.assign({line: sourceLine(source), path: source && source.path}, item),
        raw: item
      };
    }

    if (view === 'surfaceText') {
      const source = firstSource(item);
      const capability = editCapabilityForModel(model, view, item);
      return {
        key: 'surfaceText:' + (item.id || index),
        primary: item.label || '(missing label)',
        secondary: item.area || item.variableName || '',
        meta: sourceLabel(source),
        badges: [
          capability ? {text: editCapabilityRouteLabel(capability.routeClass), className: capabilityBadgeClass(capability)} : null,
          {text: item.editability || 'ide_escape_hatch', className: item.editability || ''},
          {text: item.confidence || 'static_inferred', className: item.confidence || 'static_inferred'}
        ].filter(Boolean),
        searchText: [
          item.label,
          item.area,
          item.variableName,
          item.editability,
          capability && capability.routeClass,
          capability && capability.reason,
          sourceLabel(source)
        ].join(' '),
        sortValues: Object.assign({line: sourceLine(source), path: source && source.path}, item),
        raw: item
      };
    }

    if (view === 'textCorpus') {
      const source = firstSource(item);
      const owner = item.owner || {};
      return {
        key: 'textCorpus:' + (item.id || index),
        primary: item.text || '(empty text)',
        secondary: [item.role, owner.sceneId || owner.itemId || owner.kind].filter(Boolean).join(' · '),
        meta: sourceLabel(source),
        badges: [
          {text: item.role || 'text', className: ''},
          {text: item.editability || 'text_proposal', className: item.editability || ''},
          {text: item.confidence || 'static_inferred', className: item.confidence || 'static_inferred'}
        ].filter(Boolean),
        searchText: [
          item.text,
          item.role,
          item.editability,
          item.confidence,
          owner.kind,
          owner.sceneId,
          owner.sectionId,
          owner.itemId,
          owner.area,
          sourceLabel(source),
          ensureArray(item.conditions).join(' ')
        ].join(' '),
        sortValues: Object.assign({line: sourceLine(source), path: source && source.path}, item),
        raw: item
      };
    }

    if (view === 'assets') {
      const source = firstSource(item);
      const name = item.name || item.path || item.id || '(unnamed asset)';
      const usageCount = ensureArray(item.usageRefs).length;
      return {
        key: 'asset:' + (item.id || item.path || index),
        primary: name,
        secondary: item.path || '',
        meta: [labelForBadge(item.type), item.extension, labelForBadge(item.sourceKind)].filter(Boolean).join(' · '),
        badges: [
          {text: item.type || 'asset', className: item.type || ''},
          {text: item.editability || 'reference_only', className: item.editability || ''},
          usageCount ? {text: 'used ' + usageCount, className: 'info'} : null,
          {text: item.confidence || 'static_inferred', className: item.confidence || 'static_inferred'}
        ].filter(Boolean),
        searchText: [
          item.id,
          item.name,
          item.type,
          item.path,
          item.extension,
          item.sourceKind,
          item.editability,
          ensureArray(item.usageRefs).map((ref) => ref.label || ref.id || ref.path).join(' '),
          sourceLabel(source)
        ].join(' '),
        sortValues: Object.assign({line: sourceLine(source), path: item.path || (source && source.path), usageCount}, item),
        raw: item
      };
    }

    const source = firstSource(item);
    const tags = ensureArray(item.tags);
    const confidence = item.classificationConfidence || item.confidence || 'profile_heuristic';
    return {
      key: (view || 'scene') + ':' + (item.id || index),
      primary: item.id || '(missing id)',
      secondary: item.title || item.path || '',
      meta: item.path || sourceLabel(source),
      badges: [
        {text: item.type || view, className: ''},
        {text: confidence, className: confidence}
      ].concat(tags.slice(0, 2).map((tag) => ({text: tag, className: ''}))),
      searchText: [item.id, item.title, item.path, item.type, tags.join(' ')].join(' '),
      sortValues: Object.assign({confidence}, item),
      raw: item
    };
  }

  function listForView(model, view) {
    if (!model) {
      return [];
    }
    return ensureArray(model.lists[view]);
  }

  function filterAndSortItems(model, view, query, sortField, sortDir) {
    const direction = sortDir === 'desc' ? -1 : 1;
    const field = sortField || (VIEW_DEFS[view] && VIEW_DEFS[view].defaultSort) || 'id';
    const sorted = sortedRowsForView(model, view, field, direction);
    const q = String(query || '').trim().toLowerCase();
    return q
      ? sorted.filter((item) => item.searchTextLower.includes(q))
      : sorted;
  }

  function normalizedRowsForView(model, view) {
    if (!model) {
      return [];
    }
    if (!(model.normalizedRowsByView instanceof Map)) {
      model.normalizedRowsByView = new Map();
    }
    const cacheKey = currentLocale() + '::' + String(view || '');
    if (!model.normalizedRowsByView.has(cacheKey)) {
      const rows = listForView(model, view).map((item, index) => {
        const normalized = normalizeForView(view, item, index, model);
        normalized.searchTextLower = String(normalized.searchText || '').toLowerCase();
        return normalized;
      });
      model.normalizedRowsByView.set(cacheKey, rows);
    }
    return model.normalizedRowsByView.get(cacheKey) || [];
  }

  function sortedRowsForView(model, view, field, direction) {
    if (!model) {
      return [];
    }
    if (!(model.sortedRowsByView instanceof Map)) {
      model.sortedRowsByView = new Map();
    }
    const cacheKey = [currentLocale(), view || '', field || '', direction].join('::');
    if (!model.sortedRowsByView.has(cacheKey)) {
      const rows = normalizedRowsForView(model, view).slice().sort((a, b) => {
        return compareValues(sortValue(a, field), sortValue(b, field), field) * direction;
      });
      model.sortedRowsByView.set(cacheKey, rows);
    }
    return model.sortedRowsByView.get(cacheKey) || [];
  }

  function virtualWindowForList(totalRows, scrollTop, viewportHeight, options) {
    const total = Math.max(0, Number(totalRows) || 0);
    const rowHeight = Math.max(1, Number(options && options.rowHeight) || VIRTUAL_LIST_ROW_HEIGHT);
    const overscan = Math.max(0, Number(options && options.overscan) || VIRTUAL_LIST_OVERSCAN);
    const viewport = Math.max(rowHeight, Number(viewportHeight) || rowHeight * 12);
    const maxStart = Math.max(0, total - 1);
    const scroll = Math.max(0, Math.min(Number(scrollTop) || 0, total * rowHeight));
    const rawStart = Math.floor(scroll / rowHeight) - overscan;
    const start = Math.max(0, Math.min(maxStart, rawStart));
    const visibleCount = Math.ceil(viewport / rowHeight) + overscan * 2;
    const end = Math.min(total, Math.max(start, start + visibleCount));
    return {
      start,
      end,
      rowHeight,
      totalHeight: total * rowHeight,
      topSpacer: start * rowHeight,
      bottomSpacer: Math.max(0, (total - end) * rowHeight),
      visibleCount: Math.max(0, end - start)
    };
  }

  function sortValue(item, field) {
    if (field === 'severity') {
      return severityRank(item.sortValues.severity);
    }
    if (field === 'confidence') {
      return confidenceRank(item.sortValues.confidence || item.sortValues.classificationConfidence);
    }
    if (field === 'count') {
      return Number(item.sortValues.count || 0);
    }
    if (field === 'line') {
      return Number(item.sortValues.line || 0);
    }
    return item.sortValues[field] ?? item[field] ?? '';
  }

  function compareValues(a, b) {
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }
    const left = String(a);
    const right = String(b);
    return SORT_COLLATOR ? SORT_COLLATOR.compare(left, right) : left.localeCompare(right);
  }

  function countBy(items, keyFn) {
    const out = {};
    ensureArray(items).forEach((item) => {
      const key = keyFn(item) || '(none)';
      out[key] = (out[key] || 0) + 1;
    });
    return out;
  }

  function hasSourceExcerpts(index) {
    const stack = [index];
    while (stack.length) {
      const value = stack.pop();
      if (!value) {
        continue;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => stack.push(item));
      } else if (typeof value === 'object') {
        if (typeof value.excerpt === 'string' && value.excerpt.trim()) {
          return true;
        }
        Object.keys(value).forEach((key) => stack.push(value[key]));
      }
    }
    return false;
  }

  function graphRowsForScene(model, sceneId) {
    if (!model || !sceneId) {
      return {incoming: [], outgoing: [], all: []};
    }
    const id = String(sceneId);
    const outgoing = ensureArray(model.edges).filter((edge) => {
      return endpointBelongsToScene(model, edge.from, id);
    }).map((edge) => {
      return graphRow(model, edge, 'outgoing', edge.to);
    });
    const incoming = ensureArray(model.edges).filter((edge) => {
      return endpointBelongsToScene(model, edge.to, id) &&
        !endpointBelongsToScene(model, edge.from, id);
    }).map((edge) => {
      return graphRow(model, edge, 'incoming', edge.from);
    });
    return {incoming, outgoing, all: outgoing.concat(incoming)};
  }

  function endpointBelongsToScene(model, endpointId, sceneId) {
    return sceneIdForEndpoint(model, endpointId) === String(sceneId || '');
  }

  function sceneIdForEndpoint(model, endpointId) {
    if (!model || endpointId === undefined || endpointId === null) {
      return null;
    }
    const endpointKey = String(endpointId);
    if (model.scenesById && model.scenesById.has(endpointKey)) {
      return endpointKey;
    }
    if (model.sceneIdsByEndpoint && model.sceneIdsByEndpoint.has(endpointKey)) {
      return model.sceneIdsByEndpoint.get(endpointKey);
    }
    if (endpointKey.includes('.')) {
      const parent = endpointKey.split('.')[0];
      if (model.scenesById && model.scenesById.has(parent)) {
        return parent;
      }
    }
    return null;
  }

  function graphRow(model, edge, direction, endpointId) {
    const endpointKey = String(endpointId || '');
    const endpointSceneId = sceneIdForEndpoint(model, endpointKey);
    const endpointScene = endpointSceneId ? model.scenesById.get(endpointSceneId) || null : null;
    return {
      direction,
      endpointId: endpointKey,
      endpointSceneId,
      endpointScene,
      edge,
      kind: edge.kind || 'edge',
      label: edge.label || '',
      condition: edge.condition || '',
      confidence: edge.confidence || 'opaque',
      source: edge.source || null
    };
  }

  function textCorpusContextRows(model, item) {
    if (!model || !item) {
      return [];
    }
    if (!model.textCorpusContextIndex) {
      model.textCorpusContextIndex = buildTextCorpusContextIndex(model.lists && model.lists.textCorpus);
    }
    const owner = item.owner || {};
    const source = item.source || {};
    const contextIndex = model.textCorpusContextIndex || {};
    const items = owner.sceneId && contextIndex.bySceneId && contextIndex.bySceneId.get(String(owner.sceneId)) ||
      owner.itemId && contextIndex.byItemId && contextIndex.byItemId.get(String(owner.itemId)) ||
      source.path && contextIndex.bySourcePath && contextIndex.bySourcePath.get(String(source.path)) ||
      [];
    const index = items.findIndex((candidate) => sameTextCorpusContextItem(candidate, item));
    if (index < 0) {
      return items.slice(0, 7);
    }
    const start = Math.max(0, index - 3);
    return items.slice(start, Math.min(items.length, index + 4));
  }

  function buildTextCorpusContextIndex(items) {
    const contextIndex = {
      bySceneId: new Map(),
      byItemId: new Map(),
      bySourcePath: new Map()
    };
    ensureArray(items).forEach((item) => {
      if (!item) {
        return;
      }
      const owner = item.owner || {};
      const source = item.source || {};
      addTextCorpusContextRow(contextIndex.bySceneId, owner.sceneId, item);
      addTextCorpusContextRow(contextIndex.byItemId, owner.itemId, item);
      addTextCorpusContextRow(contextIndex.bySourcePath, source.path, item);
    });
    [contextIndex.bySceneId, contextIndex.byItemId, contextIndex.bySourcePath].forEach((map) => {
      map.forEach((rows) => rows.sort(compareTextCorpusContextRows));
    });
    return contextIndex;
  }

  function addTextCorpusContextRow(map, key, item) {
    const value = String(key || '');
    if (!value) {
      return;
    }
    if (!map.has(value)) {
      map.set(value, []);
    }
    map.get(value).push(item);
  }

  function compareTextCorpusContextRows(a, b) {
    return compareValues(sourceLine(a && a.source), sourceLine(b && b.source)) ||
      compareValues(a && a.role || '', b && b.role || '') ||
      compareValues(a && a.id || '', b && b.id || '');
  }

  function sameTextCorpusContextItem(candidate, item) {
    if (candidate === item) {
      return true;
    }
    if (candidate && item && candidate.id && item.id && String(candidate.id) === String(item.id)) {
      return true;
    }
    return sourceLabel(candidate && candidate.source) === sourceLabel(item && item.source) &&
      String(candidate && candidate.role || '') === String(item && item.role || '') &&
      String(candidate && candidate.text || '') === String(item && item.text || '');
  }

  function textRevisionKey(item) {
    return String(item && (item.id || (item.source && sourceLabel(item.source)) || item.text) || 'text_revision');
  }

  function textRevisionReplacementFor(state, item) {
    const key = textRevisionKey(item);
    if (state && state.textProposalEdits && Object.prototype.hasOwnProperty.call(state.textProposalEdits, key)) {
      return state.textProposalEdits[key];
    }
    return item && item.text ? String(item.text) : '';
  }

  function buildTextRevisionModel(item, replacement) {
    const before = String(item && item.text || '');
    const after = replacement === undefined || replacement === null ? before : String(replacement);
    const changed = before !== after;
    const editability = String(item && item.editability || 'ide_escape_hatch');
    const diff = changed
      ? [
          {kind: 'removed', label: t('textRevision.diffBefore', 'Before'), text: before},
          {kind: 'added', label: t('textRevision.diffAfter', 'After'), text: after}
        ]
      : [
          {kind: 'same', label: t('textRevision.diffCurrent', 'Current'), text: before}
        ];
    return {
      before,
      after,
      changed,
      role: item && item.role || '',
      source: item && item.source || null,
      editability,
      confidence: item && item.confidence || 'static_inferred',
      status: changed ? (editability === 'ide_escape_hatch' ? 'manual_review' : 'proposal') : 'unchanged',
      diff
    };
  }

  function labelForBadge(text) {
    const value = String(text || '');
    const labels = {
      exact: t('confidence.matched', 'matched'),
      static_inferred: t('confidence.inferred', 'inferred'),
      profile_heuristic: t('confidence.guessed', 'guessed'),
      opaque: t('confidence.unknown', 'unknown'),
      error: t('design.severity.error', 'Error'),
      warning: t('design.severity.warning', 'Warning'),
      info: t('design.severity.info', 'Info'),
      'In Studio, read-only': t('coverage.inStudioReadOnly', 'In Studio, read-only'),
      'In Studio, best-effort': t('coverage.inStudioBestEffort', 'In Studio, best-effort'),
      'In Studio, manual install': t('coverage.inStudioManualInstall', 'In Studio, manual install'),
      'In Studio, wiring review': t('coverage.inStudioWiringReview', 'In Studio, wiring review'),
      'In Studio, guarded': t('coverage.inStudioGuarded', 'In Studio, guarded'),
      'Mixed safe / IDE': t('coverage.mixedSafeIde', 'Mixed safe / source review'),
      'IDE guidance': t('coverage.ideGuidance', 'Source review guidance'),
      'Picker + warnings': t('coverage.pickerWarnings', 'Picker + warnings'),
      'Proposal + IDE guidance': t('coverage.proposalIdeGuidance', 'Proposal + source review guidance'),
      'Guided review only': t('coverage.guidedReviewOnly', 'Guided review only'),
      'IDE escape hatch': t('coverage.ideEscapeHatch', 'Source mapping needed'),
      'Not started': t('coverage.notStarted', 'Not started'),
      image: t('assets.type.image', 'image'),
      audio: t('assets.type.audio', 'audio'),
      asset: t('assets.type.asset', 'asset'),
      source_asset: t('assets.sourceKind.sourceAsset', 'source asset'),
      runtime_evidence: t('assets.sourceKind.runtimeEvidence', 'runtime evidence')
    };
    if (value.startsWith('no-code ')) {
      return t('coverage.noCode', 'no-code') + ' ' + value.slice('no-code '.length);
    }
    if (value.startsWith('safe ')) {
      return t('coverage.safe', 'safe') + ' ' + value.slice('safe '.length);
    }
    if (value.startsWith('manual ')) {
      return t('coverage.manual', 'manual') + ' ' + value.slice('manual '.length);
    }
    if (value.startsWith('unsupported ')) {
      return t('coverage.unsupported', 'unsupported') + ' ' + value.slice('unsupported '.length);
    }
    return labels[value] || value;
  }

  function humanizeKey(value) {
    const contracts = studioContracts();
    return contracts && typeof contracts.humanizeKey === 'function'
      ? contracts.humanizeKey(value)
      : String(value || '').replace(/_/g, ' ');
  }

  function textCorpusRoleLabel(role) {
    const contracts = studioContracts();
    return contracts && typeof contracts.textCorpusRoleLabel === 'function'
      ? contracts.textCorpusRoleLabel(role, t)
      : humanizeKey(role);
  }

  function textCorpusRoleGuidance(role) {
    const value = String(role || '');
    const labels = {
      body: t('textCorpus.roleGuidance.body', 'Body prose is proposal-first: review the owning source before applying.'),
      conditional_body: t('textCorpus.roleGuidance.conditionalBody', 'Conditional prose needs the surrounding Dendry branch checked before applying.'),
      news_headline: t('textCorpus.roleGuidance.news', 'News copy usually belongs to post_event_news or a generated branch; keep it review-first.'),
      news_description: t('textCorpus.roleGuidance.news', 'News copy usually belongs to post_event_news or a generated branch; keep it review-first.'),
      monthly_popup_excerpt: t('textCorpus.roleGuidance.monthlyPopup', 'Monthly popup text comes through event/router flow; create a proposal before touching source.'),
      unavailable_text: t('textCorpus.roleGuidance.unavailableText', 'Unavailable option text can be revised, but source evidence decides whether it is guarded or manual.'),
      surface_label: t('textCorpus.roleGuidance.surfaceLabel', 'Surface labels are installable only when the source-backed original still matches.')
    };
    return labels[value] || '';
  }

  function textCorpusEditabilityLabel(editability) {
    const contracts = studioContracts();
    return contracts && typeof contracts.textCorpusEditabilityLabel === 'function'
      ? contracts.textCorpusEditabilityLabel(editability, t)
      : humanizeKey(editability);
  }

  function editCapabilityForModel(model, view, item, options) {
    const api = editCapabilityApi();
    if (!api || typeof api.buildEditCapability !== 'function' || !model || !model.index) {
      return null;
    }
    const opts = isObject(options) ? options : {};
    const cacheable = !Object.keys(opts).length;
    const key = [
      String(view || ''),
      item && (item.id || item.itemId || item.sceneId) || '',
      sourceLabel(firstSource(item)),
      item && item.text || item && item.label || ''
    ].join('::');
    if (cacheable) {
      if (!(model.editCapabilityByKey instanceof Map)) {
        model.editCapabilityByKey = new Map();
      }
      if (model.editCapabilityByKey.has(key)) {
        return model.editCapabilityByKey.get(key);
      }
    }
    let result = null;
    try {
      result = api.buildEditCapability(model.index, view, item, editCapabilityOptionsForModel(model, api, opts));
    } catch (err) {
      result = {
        routeClass: 'manual_review',
        reason: err && err.message ? err.message : String(err),
        diagnostics: [{severity: 'warning', code: 'edit_capability.failed', message: err && err.message ? err.message : String(err)}]
      };
    }
    if (cacheable) {
      model.editCapabilityByKey.set(key, result);
    }
    return result;
  }

  function editCapabilityOptionsForModel(model, api, options) {
    const opts = Object.assign({}, isObject(options) ? options : {});
    if (!model || !api) {
      return opts;
    }
    const context = editCapabilityContextForModel(model, api);
    if (context.lookup && !opts.lookup) {
      opts.lookup = context.lookup;
    }
    if (context.existingModelCache && !opts.existingModelCache) {
      opts.existingModelCache = context.existingModelCache;
    }
    return opts;
  }

  function editCapabilityContextForModel(model, api) {
    if (!model.editCapabilityContext) {
      const context = {
        lookup: null,
        existingModelCache: new Map()
      };
      if (api && typeof api.buildLookup === 'function') {
        try {
          context.lookup = api.buildLookup(model.index);
        } catch (_err) {
          context.lookup = null;
        }
      }
      model.editCapabilityContext = context;
    }
    return model.editCapabilityContext;
  }

  function editCapabilityRouteLabel(routeClass) {
    const api = editCapabilityApi();
    return api && typeof api.routeClassLabel === 'function'
      ? api.routeClassLabel(routeClass, t)
      : humanizeKey(routeClass);
  }

  function editCapabilityActionLabel(routeClass) {
    const api = editCapabilityApi();
    return api && typeof api.routeActionLabel === 'function'
      ? api.routeActionLabel(routeClass, t)
      : humanizeKey(routeClass);
  }

  function editCapabilitySummary(capability) {
    const api = editCapabilityApi();
    return api && typeof api.routeSummary === 'function'
      ? api.routeSummary(capability, t)
      : capability && capability.reason || '';
  }

  function capabilityBadgeClass(capability) {
    const routeClass = String(capability && capability.routeClass || '');
    if (routeClass === 'direct_field_replace' || routeClass === 'direct_section_replace') {
      return 'exact';
    }
    if (routeClass === 'object_workspace' || routeClass === 'system_ui_workspace') {
      return 'info';
    }
    if (routeClass === 'news_router_workflow' || routeClass === 'manual_review') {
      return 'warning';
    }
    return 'opaque';
  }

  const api = {
    VIEW_DEFS,
    SEVERITY_RANK,
    CONFIDENCE_ORDER,
    EXPLORE_SEARCH_DEBOUNCE_MS,
    EXPLORE_INSPECTOR_WIDTH_KEY,
    EXPLORE_INSPECTOR_MIN_WIDTH,
    EXPLORE_INSPECTOR_MAX_WIDTH,
    VIRTUAL_LIST_THRESHOLD,
    VIRTUAL_LIST_ROW_HEIGHT,
    VIRTUAL_ASSET_ROW_HEIGHT,
    VIRTUAL_ASSET_CARD_MIN_WIDTH,
    VIRTUAL_LIST_OVERSCAN,
    SORT_COLLATOR,
    t,
    currentLocale,
    applyI18n,
    studioContracts,
    assetModelApi,
    editCapabilityApi,
    viewLabel,
    isObject,
    ensureArray,
    requiredArray,
    validateProjectIndex,
    makeMap,
    groupBy,
    buildVariableAccessesByPath,
    diagnosticGroups,
    diagnosticBreakdown,
    coverageRows,
    coverageField,
    coverageWorkflowSteps,
    coveragePriorityLabel,
    coverageCompletionLabel,
    noCodeCompletionLabel,
    coverageCountBadge,
    buildViewModel,
    normalizeAssetForViewer,
    profileUiLabels,
    materializeSceneRefs,
    endpointSceneMap,
    severityRank,
    confidenceRank,
    firstSource,
    sourceLine,
    sourceLabel,
    normalizeForView,
    listForView,
    filterAndSortItems,
    normalizedRowsForView,
    sortedRowsForView,
    virtualWindowForList,
    sortValue,
    compareValues,
    countBy,
    hasSourceExcerpts,
    graphRowsForScene,
    endpointBelongsToScene,
    sceneIdForEndpoint,
    graphRow,
    textCorpusContextRows,
    textRevisionKey,
    textRevisionReplacementFor,
    buildTextRevisionModel,
    humanizeKey,
    textCorpusRoleLabel,
    textCorpusRoleGuidance,
    textCorpusEditabilityLabel,
    editCapabilityForModel,
    editCapabilityRouteLabel,
    editCapabilityActionLabel,
    editCapabilitySummary,
    capabilityBadgeClass
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (global) {
    global.ProjectMapExploreModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
