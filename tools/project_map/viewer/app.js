(function initProjectMapViewer(global) {
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
  let desktopProgressTimer = null;

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
        coverageLabel: 'In Studio, best-effort',
        releasePriority: 'must-have',
        noCodeCompletion: 'partial',
        authoringStatus: 'Edit as Draft partial; Create wizard export-only',
        installStatus: 'safe scene create; root/post_event manual review',
        safeApplyCount: 1,
        manualReviewCount: 2,
        unsupportedCount: 0,
        userCanDo: 'Create new world events, seed follow-up / bridge events from Design, and export install proposals.',
        remainingGap: 'Existing body text and effects are not fully round-tripped; monthly router / root migration still need review.',
        nextAction: 'Use Design -> Create follow-up / Bridge event for new beats; use Explore -> Edit as Draft only as a seed.',
        studioPath: 'Create -> World Event, or Design -> Create follow-up / Bridge event.',
        workflowSteps: ['Choose timing and requirements', 'Write choices/effects', 'Review diagnostics and patch preview', 'Install safe scene create; manually add root/post_event snippets']
      },
      {
        id: 'news',
        label: 'News',
        count: news.length + eventPopups.length,
        coverageLevel: 'draft_seed',
        coverageLabel: 'In Studio, guarded when anchored',
        releasePriority: 'must-have',
        noCodeCompletion: 'partial',
        authoringStatus: 'Edit as Draft partial; News wizard exports snippets and install plans',
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
        authoringStatus: 'Edit as Draft partial; Card wizard export-only',
        installStatus: 'safe scene create; hand/sidebar wiring manual review',
        safeApplyCount: 1,
        manualReviewCount: 1,
        unsupportedCount: 0,
        userCanDo: 'Create action-card / advisor-like scene proposals and seed related cards from Design.',
        remainingGap: 'Hand/deck/sidebar wiring is indexed and proposed, but still not automatically applied.',
        nextAction: 'Generate the card scene, then use Install mode to separate safe create-file from manual wiring.',
        studioPath: 'Create -> Card, or Design -> Create related card.',
        workflowSteps: ['Pick action-card or advisor-like type', 'Write options/effects', 'Export scene and wiring proposal', 'Apply safe scene create; review hand/sidebar wiring manually']
      },
      {
        id: 'surface_text',
        label: 'Surface Text',
        count: surfaceItems.length,
        coverageLevel: sourceSurface ? 'mixed' : 'ide_escape_hatch',
        coverageLabel: sourceSurface ? 'Mixed safe / IDE' : 'IDE guidance',
        releasePriority: 'must-have',
        noCodeCompletion: sourceSurface ? 'partial' : 'guided',
        authoringStatus: 'replacement draft or IDE escape hatch',
        installStatus: 'source-backed replace safe; generated UI manual',
        safeApplyCount: sourceSurface,
        manualReviewCount: ideSurface,
        unsupportedCount: 0,
        userCanDo: 'Search labels like sidebar/status text and generate replacement proposals.',
        remainingGap: 'Source-backed labels can be guarded replacements; out/html evidence remains manual because it is generated/custom UI.',
        nextAction: 'Prefer source-backed rows. Treat out/html rows as IDE guidance, not automatic edits.',
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
        nextAction: 'Use the effect helper for simple = / += / -= changes; keep complex JS in manual review.',
        studioPath: 'Create -> World Event/Card -> Effects helper; Explore -> Variables for read/write context.',
        workflowSteps: ['Pick an existing variable', 'Use simple = / += / -= operation', 'Review diagnostics', 'Avoid Chinese string comparisons and undefined variables']
      },
      {
        id: 'existing_text',
        label: 'Existing Event / Card / News Text',
        count: events.length + cards.length + news.length,
        coverageLevel: 'mixed',
        coverageLabel: 'Proposal + IDE guidance',
        releasePriority: 'must-have',
        noCodeCompletion: 'guided',
        authoringStatus: 'Edit Text Proposal from Explore / Design',
        installStatus: 'manual IDE review for scene/news body text',
        safeApplyCount: 0,
        manualReviewCount: events.length + cards.length + news.length,
        unsupportedCount: 0,
        userCanDo: 'Select an event/card/news/scene and create a text replacement proposal without hunting files manually.',
        remainingGap: 'Studio can point at source and produce proposal notes, but it cannot safely rewrite arbitrary scene body text yet.',
        nextAction: 'Use Edit Text Proposal for wording changes; keep body/effect rewrites as manual review until source-span editing exists.',
        studioPath: 'Explore or Design -> select item -> Edit Text Proposal.',
        workflowSteps: ['Select existing content', 'Click Edit Text Proposal', 'Change replacement text in Create', 'Use source ref and install notes to edit manually']
      },
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
        nextAction: 'Use Studio to locate the relevant evidence, then edit with IDE guidance.',
        studioPath: 'Coverage Map -> Hands / Sidebar Wiring, plus Install mode manual operations.',
        workflowSteps: ['Use card export wiring proposal', 'Review hand/deck/sidebar evidence', 'Make IDE change manually', 'Run validation outside Studio']
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
        coverageLabel: 'IDE escape hatch',
        releasePriority: 'nice-to-have',
        noCodeCompletion: 'no',
        authoringStatus: 'not a raw editor',
        installStatus: 'manual IDE work',
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

  function normalizeForView(view, item, index) {
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
      return {
        key: 'surfaceText:' + (item.id || index),
        primary: item.label || '(missing label)',
        secondary: item.area || item.variableName || '',
        meta: sourceLabel(source),
        badges: [
          {text: item.editability || 'ide_escape_hatch', className: item.editability || ''},
          {text: item.confidence || 'static_inferred', className: item.confidence || 'static_inferred'}
        ],
        searchText: [
          item.label,
          item.area,
          item.variableName,
          item.editability,
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
        ],
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
        const normalized = normalizeForView(view, item, index);
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
    const owner = item.owner || {};
    const source = item.source || {};
    const items = ensureArray(model.lists && model.lists.textCorpus).filter((candidate) => {
      const candidateOwner = candidate.owner || {};
      const candidateSource = candidate.source || {};
      if (owner.sceneId && candidateOwner.sceneId === owner.sceneId) {
        return true;
      }
      if (owner.itemId && candidateOwner.itemId === owner.itemId) {
        return true;
      }
      return source.path && candidateSource.path === source.path;
    }).sort((a, b) => {
      return compareValues(sourceLine(a.source), sourceLine(b.source)) ||
        compareValues(a.role || '', b.role || '');
    });
    const index = items.findIndex((candidate) => candidate.id === item.id);
    if (index < 0) {
      return items.slice(0, 7);
    }
    const start = Math.max(0, index - 3);
    return items.slice(start, Math.min(items.length, index + 4));
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

  const api = {
    VIEW_DEFS,
    validateProjectIndex,
    buildViewModel,
    filterAndSortItems,
    virtualWindowForList,
    countBy,
    sourceLabel,
    sourceLine,
    diagnosticBreakdown,
    coverageRows,
    diagnosticGroups,
    graphRowsForScene,
    sceneIdForEndpoint,
    textCorpusContextRows,
    buildTextRevisionModel,
    renderAssetInspector,
    renderAssetPicker,
    renderAssetManifest,
    renderDraftAssetPanel,
    textCorpusRoleLabel,
    textCorpusEditabilityLabel,
    hasSourceExcerpts,
    loadProjectIndexUrl
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (!global || !global.document) {
    return;
  }

  global.ProjectMapViewer = api;
  global.document.addEventListener('DOMContentLoaded', () => {
    startApp(global.document);
  });

  function startApp(document) {
    const state = {
      model: null,
      view: 'overview',
      query: '',
      sortField: VIEW_DEFS.overview.defaultSort,
      sortDir: 'desc',
      selectedKey: null,
      selected: null,
      currentItems: [],
      virtualListActive: false,
      listRenderSignature: '',
      draftActionMessage: '',
      textActionMessage: '',
      textProposalEdits: {},
      resizingInspector: null,
      assetBaseUrl: autoloadAssetBaseUrl(global.location)
    };

    const elements = {
      explorePane: document.getElementById('explore-pane'),
      file: document.getElementById('index-file'),
      brandSubtitle: document.getElementById('brand-subtitle'),
      status: document.getElementById('status'),
      overview: document.getElementById('overview'),
      list: document.getElementById('list'),
      inspector: document.getElementById('inspector'),
      inspectorPanel: document.querySelector('#explore-pane .inspector'),
      inspectorResizer: document.getElementById('explore-inspector-resizer'),
      search: document.getElementById('search'),
      sortField: document.getElementById('sort-field'),
      sortDir: document.getElementById('sort-dir'),
      dropZone: document.getElementById('index-drop-zone') || document.getElementById('index-drop-target'),
      filePicker: document.getElementById('index-drop-target'),
      nav: Array.from(document.querySelectorAll('.nav-item')),
      desktopControls: document.getElementById('desktop-controls'),
      desktopOnlyControls: Array.from(document.querySelectorAll('.desktop-only-control')),
      desktopRunDoctor: document.getElementById('desktop-run-doctor'),
      desktopOpenProject: document.getElementById('desktop-open-project'),
      desktopIncludeExcerpts: document.getElementById('desktop-include-excerpts'),
      desktopStatus: document.getElementById('desktop-status'),
      desktopProgress: document.getElementById('desktop-progress'),
      desktopProgressBar: document.getElementById('desktop-progress-bar'),
      desktopProgressLabel: document.getElementById('desktop-progress-label'),
      topbarMore: document.getElementById('topbar-more')
    };
    let searchRenderTimer = null;
    let listScrollFrame = null;

    function readStoredExploreInspectorWidth() {
      try {
        const raw = global.localStorage && global.localStorage.getItem(EXPLORE_INSPECTOR_WIDTH_KEY);
        const parsed = Number.parseFloat(raw || '');
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      } catch (err) {
        return 0;
      }
    }

    function storeExploreInspectorWidth(width) {
      try {
        if (global.localStorage) {
          global.localStorage.setItem(EXPLORE_INSPECTOR_WIDTH_KEY, String(Math.round(width)));
        }
      } catch (err) {
        // Inspector width is only a preference; storage errors should not block Explore.
      }
    }

    function clampExploreInspectorWidth(width) {
      const paneWidth = elements.explorePane && typeof elements.explorePane.getBoundingClientRect === 'function'
        ? elements.explorePane.getBoundingClientRect().width
        : 0;
      const viewportWidth = global.innerWidth || 0;
      const available = (paneWidth || viewportWidth || 1200) - 200 - 320 - 8;
      const maxWidth = Math.max(
        EXPLORE_INSPECTOR_MIN_WIDTH,
        Math.min(EXPLORE_INSPECTOR_MAX_WIDTH, available || EXPLORE_INSPECTOR_MAX_WIDTH)
      );
      return Math.min(Math.max(Number(width) || EXPLORE_INSPECTOR_MIN_WIDTH, EXPLORE_INSPECTOR_MIN_WIDTH), maxWidth);
    }

    function applyExploreInspectorWidth(width) {
      if (!elements.explorePane) {
        return;
      }
      const clamped = clampExploreInspectorWidth(width);
      elements.explorePane.style.setProperty('--explore-inspector-width', Math.round(clamped) + 'px');
    }

    function currentExploreInspectorWidth() {
      if (elements.inspectorPanel && typeof elements.inspectorPanel.getBoundingClientRect === 'function') {
        const rect = elements.inspectorPanel.getBoundingClientRect();
        if (rect.width) {
          return rect.width;
        }
      }
      return readStoredExploreInspectorWidth() || 340;
    }

    function restoreExploreInspectorWidth() {
      const stored = readStoredExploreInspectorWidth();
      if (stored) {
        applyExploreInspectorWidth(stored);
      }
    }

    function beginExploreInspectorResize(event) {
      if (!elements.inspectorResizer || !elements.inspectorPanel) {
        return;
      }
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      event.preventDefault();
      state.resizingInspector = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: currentExploreInspectorWidth()
      };
      elements.inspectorResizer.classList.add('is-dragging');
      if (elements.explorePane) {
        elements.explorePane.classList.add('is-resizing-inspector');
      }
      if (typeof elements.inspectorResizer.setPointerCapture === 'function') {
        try {
          elements.inspectorResizer.setPointerCapture(event.pointerId);
        } catch (err) {
          // Document-level handlers keep resizing usable if capture fails.
        }
      }
    }

    function moveExploreInspectorResize(event) {
      if (!state.resizingInspector || event.pointerId !== state.resizingInspector.pointerId) {
        return;
      }
      event.preventDefault();
      const nextWidth = state.resizingInspector.startWidth + (state.resizingInspector.startX - event.clientX);
      applyExploreInspectorWidth(nextWidth);
    }

    function endExploreInspectorResize(event) {
      if (!state.resizingInspector || event.pointerId !== state.resizingInspector.pointerId) {
        return;
      }
      const pointerId = state.resizingInspector.pointerId;
      state.resizingInspector = null;
      const width = currentExploreInspectorWidth();
      storeExploreInspectorWidth(width);
      if (elements.inspectorResizer) {
        elements.inspectorResizer.classList.remove('is-dragging');
        if (typeof elements.inspectorResizer.releasePointerCapture === 'function') {
          try {
            elements.inspectorResizer.releasePointerCapture(pointerId);
          } catch (err) {
            // Capture may already be released.
          }
        }
      }
      if (elements.explorePane) {
        elements.explorePane.classList.remove('is-resizing-inspector');
      }
    }

    function cancelExploreInspectorResize() {
      if (!state.resizingInspector) {
        return;
      }
      state.resizingInspector = null;
      if (elements.inspectorResizer) {
        elements.inspectorResizer.classList.remove('is-dragging');
      }
      if (elements.explorePane) {
        elements.explorePane.classList.remove('is-resizing-inspector');
      }
    }

    restoreExploreInspectorWidth();

    function scheduleSearchRender() {
      if (searchRenderTimer) {
        global.clearTimeout(searchRenderTimer);
      }
      searchRenderTimer = global.setTimeout(() => {
        searchRenderTimer = null;
        render(state, elements);
      }, EXPLORE_SEARCH_DEBOUNCE_MS);
    }

    function scheduleListRender() {
      if (listScrollFrame) {
        return;
      }
      const run = () => {
        listScrollFrame = null;
        if (!state.virtualListActive) {
          return;
        }
        renderList(state, elements);
        applyI18n(elements.list);
      };
      if (typeof global.requestAnimationFrame === 'function') {
        listScrollFrame = global.requestAnimationFrame(run);
      } else {
        listScrollFrame = global.setTimeout(run, 16);
      }
    }

    elements.file.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        readProjectIndexFile(file, state, elements);
      }
    });

    if (elements.dropZone) {
      elements.dropZone.addEventListener('dragover', (event) => {
        event.preventDefault();
        elements.dropZone.classList.add('is-drag-over');
      });
      elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('is-drag-over');
      });
      elements.dropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        elements.dropZone.classList.remove('is-drag-over');
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if (file) {
          readProjectIndexFile(file, state, elements);
        }
      });
    }

    elements.search.addEventListener('input', () => {
      state.query = elements.search.value;
      scheduleSearchRender();
    });

    elements.sortField.addEventListener('change', () => {
      state.sortField = elements.sortField.value;
      render(state, elements);
    });

    elements.sortDir.addEventListener('click', () => {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      render(state, elements);
    });

    elements.nav.forEach((button) => {
      button.addEventListener('click', () => {
        state.view = button.dataset.view;
        state.query = '';
        state.selectedKey = null;
        state.selected = null;
        state.draftActionMessage = '';
        state.textActionMessage = '';
        state.sortField = VIEW_DEFS[state.view].defaultSort;
        state.sortDir = state.view === 'overview' ? 'desc' : 'asc';
        elements.search.value = '';
        render(state, elements);
      });
    });

    if (elements.inspectorResizer) {
      elements.inspectorResizer.addEventListener('pointerdown', beginExploreInspectorResize);
    }
    document.addEventListener('pointermove', moveExploreInspectorResize);
    document.addEventListener('pointerup', endExploreInspectorResize);
    document.addEventListener('pointercancel', cancelExploreInspectorResize);

    elements.list.addEventListener('click', (event) => {
      const row = event.target.closest('[data-row-key]');
      if (!row) {
        return;
      }
      const items = state.currentItems && state.currentItems.length ? state.currentItems : currentItems(state);
      const found = items.find((item) => item.key === row.dataset.rowKey);
      if (found) {
        state.selectedKey = found.key;
        state.selected = {view: state.view, item: found.raw, normalized: found};
        state.draftActionMessage = '';
        state.textActionMessage = '';
        render(state, elements);
      }
    });

    elements.list.addEventListener('scroll', () => {
      if (state.virtualListActive) {
        scheduleListRender();
      }
    });

    elements.inspector.addEventListener('click', (event) => {
      const eventWorkbenchAction = event.target.closest('[data-event-workbench-action]');
      if (eventWorkbenchAction) {
        handleEventWorkbenchAction(state, elements, eventWorkbenchAction.dataset.eventWorkbenchAction || '');
        return;
      }
      const existingAction = event.target.closest('[data-edit-existing]');
      if (existingAction) {
        handleEditExisting(state, elements);
        return;
      }
      const draftAction = event.target.closest('[data-edit-as-draft]');
      if (draftAction) {
        handleEditAsDraft(state, elements);
        return;
      }
      const textAction = event.target.closest('[data-edit-text-proposal]');
      if (textAction) {
        handleEditTextProposal(state, elements);
        return;
      }
      const assetAction = event.target.closest('[data-asset-action]');
      if (assetAction) {
        handleAssetDraftAction(state, elements, assetAction);
        return;
      }
      const source = event.target.closest('[data-source-json]');
      if (!source) {
        const sceneLink = event.target.closest('[data-scene-id]');
        if (!sceneLink || !state.model) {
          return;
        }
        const scene = state.model.scenesById.get(String(sceneLink.dataset.sceneId));
        if (scene) {
          state.view = 'scenes';
          state.query = '';
          state.sortField = VIEW_DEFS.scenes.defaultSort;
          state.sortDir = 'asc';
          elements.search.value = '';
          state.selectedKey = 'scenes:' + scene.id;
          state.selected = {view: 'scenes', item: scene, normalized: null};
          state.draftActionMessage = '';
          state.textActionMessage = '';
          render(state, elements);
        }
        return;
      }
      try {
        const ref = JSON.parse(source.dataset.sourceJson);
        state.selectedKey = 'source:' + sourceLabel(ref);
        state.selected = {view: 'source', item: ref, normalized: null};
        state.draftActionMessage = '';
        state.textActionMessage = '';
        render(state, elements);
      } catch (err) {
        showError(elements, t('explore.sourceInspectFailed', 'Could not inspect source: {message}').replace('{message}', err.message));
      }
    });

    elements.inspector.addEventListener('input', (event) => {
      const input = event.target.closest('[data-text-revision-input]');
      if (!input || !state.selected || state.selected.view !== 'textCorpus') {
        return;
      }
      const key = input.dataset.textRevisionKey || textRevisionKey(state.selected.item);
      state.textProposalEdits[key] = input.value;
      updateTextRevisionDom(elements.inspector, state.selected.item, input.value, state);
    });

    elements.inspector.addEventListener('change', (event) => {
      const input = event.target.closest('[data-asset-repair-file]');
      if (!input) {
        return;
      }
      handleAssetRepairFileSelection(state, elements, input);
      input.value = '';
    });

    if (elements.topbarMore) {
      document.addEventListener('click', (event) => {
        if (elements.topbarMore.open && !event.target.closest('#topbar-more')) {
          elements.topbarMore.open = false;
        }
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && elements.topbarMore.open) {
          elements.topbarMore.open = false;
        }
      });
    }

    document.addEventListener('project-map:design-open-explore', (event) => {
      openDesignSelectionInExplore(event.detail || {}, state, elements);
    });
    document.addEventListener('project-map:locale-changed', () => {
      render(state, elements);
      applyI18n(document);
    });

    initDesktopBridge(state, elements);
    render(state, elements);
    const indexUrl = autoloadIndexUrl(global.location);
    if (indexUrl) {
      loadProjectIndexUrl(indexUrl, state, elements);
    }
  }

  function initDesktopBridge(state, elements) {
    const desktop = global.dendryDesktop;
    if (!desktop || !desktop.isDesktop) {
      return;
    }
    if (elements.desktopControls) {
      elements.desktopControls.classList.remove('hidden');
    }
    if (elements.desktopOnlyControls && elements.desktopOnlyControls.length) {
      elements.desktopOnlyControls.forEach((control) => control.classList.remove('hidden'));
    }
    if (elements.filePicker) {
      elements.filePicker.classList.add('hidden');
    }
    setStatus(elements, t('desktop.openProjectHint', 'Open a Dendry project folder to build a Project Map index.'));
    setDesktopStatus(elements, t('topbar.noProject', 'No project opened.'));

    global.addEventListener('ProjectMap:desktop-index-loaded', (event) => {
      applyDesktopProjectIndex(event.detail || {}, state, elements);
    });
    global.addEventListener('ProjectMap:desktop-scan-progress', (event) => {
      setDesktopProgress(elements, event.detail || {});
    });

    if (elements.desktopRunDoctor) {
      elements.desktopRunDoctor.addEventListener('click', () => {
        runDesktopDoctor(desktop, elements);
      });
    }

    if (elements.desktopOpenProject) {
      elements.desktopOpenProject.addEventListener('click', () => {
        openDesktopProject(desktop, elements);
      });
    }

    if (typeof desktop.getState === 'function') {
      desktop.getState().then((stateInfo) => {
        if (stateInfo && stateInfo.lastProject) {
          const project = stateInfo.lastProject;
          setDesktopStatus(elements, t('desktop.lastProject', 'Last project: {project}')
            .replace('{project}', project.projectName || project.root || t('desktop.unknownProject', 'unknown')));
        }
      }).catch(() => {
        setDesktopStatus(elements, t('desktop.shellReady', 'Desktop shell ready.'));
      });
    }
  }

  function runDesktopDoctor(desktop, elements) {
    if (!desktop || typeof desktop.doctor !== 'function') {
      showError(elements, t('desktop.setupUnavailable', 'Desktop setup check is unavailable.'));
      return;
    }
    if (elements.desktopRunDoctor) {
      elements.desktopRunDoctor.disabled = true;
    }
    setDesktopStatus(elements, t('desktop.checkingSetup', 'Checking setup...'));
    setStatus(elements, t('desktop.checkingSetupLong', 'Checking desktop app files, bundled Python runtime, scratch storage, and project folder readiness.'));
    desktop.doctor({}).then((result) => {
      const message = desktopDoctorSummary(result);
      setDesktopStatus(elements, message, !result || !result.ok);
      if (result && result.ok) {
        setStatus(elements, message);
      } else {
        showError(elements, message);
      }
    }).catch((err) => {
      const message = err && err.message ? err.message : t('desktop.setupFailed', 'Desktop setup check failed.');
      setDesktopStatus(elements, message, true);
      setDesktopProgress(elements, {
        stage: 'failed',
        percent: 100,
        label: message,
        error: true
      });
      showError(elements, message);
    }).finally(() => {
      if (elements.desktopRunDoctor) {
        elements.desktopRunDoctor.disabled = false;
      }
    });
  }

  function desktopDoctorSummary(result) {
    if (!result || !result.checks) {
      return t('desktop.setupNoResult', 'Desktop setup check did not return a result.');
    }
    const labels = {
      resources: t('desktop.doctor.resources', 'App files'),
      scratch: t('desktop.doctor.scratch', 'Scratch folder'),
      python: t('desktop.doctor.python', 'Python runtime'),
      projectRoot: t('desktop.doctor.projectRoot', 'Project folder')
    };
    const failed = Object.keys(labels).filter((key) => {
      return result.checks[key] && !result.checks[key].ok;
    });
    if (!failed.length) {
      return result.message || t('desktop.readyToScan', 'Dendry Mod Studio is ready to scan this project.');
    }
    return failed.map((key) => {
      const check = result.checks[key];
      return labels[key] + ': ' + (check.message || t('desktop.needsAttention', 'needs attention'));
    }).join(' ');
  }

  function openDesktopProject(desktop, elements) {
    if (!desktop || typeof desktop.openProject !== 'function') {
      showError(elements, t('desktop.projectPickerUnavailable', 'Desktop project picker is unavailable.'));
      return;
    }
    const includeExcerpts = Boolean(elements.desktopIncludeExcerpts && elements.desktopIncludeExcerpts.checked);
    if (elements.desktopOpenProject) {
      elements.desktopOpenProject.disabled = true;
    }
    setDesktopStatus(elements, includeExcerpts
      ? t('desktop.buildingReviewIndex', 'Building review index...')
      : t('desktop.buildingProjectIndex', 'Building project index...'));
    setDesktopProgress(elements, {
      stage: 'starting',
      percent: 1,
      label: t('desktop.waitingProjectSelection', 'Waiting for project folder selection...')
    });
    setStatus(elements, t('desktop.scanningReadOnly', 'Scanning project. This stays read-only and writes the index to app scratch storage.'));
    desktop.openProject({includeExcerpts}).then((result) => {
      if (!result || result.canceled) {
        setDesktopStatus(elements, t('topbar.noProject', 'No project opened.'));
        clearDesktopProgress(elements);
        return;
      }
      if (!result.ok) {
        const message = result.message || (result.error && result.error.message) || t('desktop.openFailed', 'Could not open project.');
        finishDesktopFailure(elements, message, result.stage || 'failed');
      }
    }).catch((err) => {
      const message = err && err.message ? err.message : t('desktop.openFailed', 'Could not open project.');
      finishDesktopFailure(elements, message, 'failed');
    }).finally(() => {
      if (elements.desktopOpenProject) {
        elements.desktopOpenProject.disabled = false;
      }
    });
  }

  function applyDesktopProjectIndex(detail, state, elements) {
    try {
      if (!detail.index) {
        throw new Error('Desktop shell did not provide a ProjectIndex JSON payload.');
      }
      const fileInfo = detail.fileInfo || {
        name: detail.indexPath || 'desktop ProjectIndex',
        size: JSON.stringify(detail.index).length
      };
      applyProjectIndex(detail.index, fileInfo, state, elements, {
        assetBaseUrl: detail.assetBaseUrl || ''
      });
      const summary = detail.summary || state.model.summary || {};
      const counts = [
        summary.sceneCount || 0,
        summary.edgeCount || 0,
        summary.variableCount || 0
      ].join(' / ');
      const name = detail.projectName || (state.model.project && state.model.project.name) || t('desktop.projectFallback', 'Project');
      setDesktopStatus(elements, t('desktop.projectLoaded', '{project} loaded.').replace('{project}', name));
      setDesktopProgress(elements, {
        stage: 'complete',
        percent: 100,
        label: t('desktop.projectLoadedShort', 'Project loaded.')
      });
      clearDesktopProgressSoon(elements);
      setStatus(elements, t('desktop.projectIndexLoaded', 'Desktop ProjectIndex loaded: {counts} scenes / edges / variables.')
        .replace('{counts}', counts));
    } catch (err) {
      state.model = null;
      state.selected = null;
      finishDesktopFailure(elements, t('desktop.projectIndexLoadFailed', 'Could not load desktop ProjectIndex: {message}')
        .replace('{message}', err.message), 'read-index');
      render(state, elements);
    }
  }

  function finishDesktopFailure(elements, message, stage) {
    setDesktopStatus(elements, message, true);
    setDesktopProgress(elements, {
      stage: stage || 'failed',
      percent: 100,
      label: message,
      error: true
    });
    showError(elements, message);
    clearDesktopProgressSoon(elements, 2600);
  }

  function readProjectIndexFile(file, state, elements) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const index = JSON.parse(String(reader.result || ''));
        applyProjectIndex(index, {name: file.name, size: file.size}, state, elements);
      } catch (err) {
        state.model = null;
        state.selected = null;
        state.textActionMessage = '';
        showError(elements, err.validationErrors ? err.validationErrors.join('; ') : err.message);
        render(state, elements);
      }
    };
    reader.onerror = () => {
      showError(elements, t('desktop.readFileFailed', 'Could not read file.'));
    };
    reader.readAsText(file);
  }

  function autoloadIndexUrl(location) {
    if (!location || !location.search || typeof URLSearchParams === 'undefined') {
      return '';
    }
    const params = new URLSearchParams(location.search);
    const value = params.get('index');
    if (!value) {
      return '';
    }
    try {
      const resolved = new URL(value, location.href);
      if (resolved.origin !== location.origin) {
        return '';
      }
      return resolved.pathname + resolved.search;
    } catch (err) {
      return '';
    }
  }

  function autoloadAssetBaseUrl(location) {
    if (!location || !location.search || typeof URLSearchParams === 'undefined') {
      return '';
    }
    const params = new URLSearchParams(location.search);
    const value = params.get('assetBase');
    if (!value) {
      return '';
    }
    try {
      const resolved = new URL(value, location.href);
      if (resolved.origin !== location.origin) {
        return '';
      }
      return resolved.pathname + resolved.search;
    } catch (err) {
      return '';
    }
  }

  function loadProjectIndexUrl(indexUrl, state, elements) {
    if (typeof fetch !== 'function') {
      showError(elements, t('desktop.fetchUnavailable', 'Browser fetch API is unavailable; choose the ProjectIndex JSON file manually.'));
      return;
    }
    setStatus(elements, t('desktop.loadingIndex', 'Loading {index}...').replace('{index}', indexUrl));
    fetch(indexUrl, {cache: 'no-store'})
      .then((response) => {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ' while loading ' + indexUrl);
        }
        return response.text();
      })
      .then((text) => {
        const index = JSON.parse(text);
        applyProjectIndex(index, {name: indexUrl, size: text.length}, state, elements, {
          assetBaseUrl: state.assetBaseUrl
        });
      })
      .catch((err) => {
        state.model = null;
        state.selected = null;
        state.textActionMessage = '';
        showError(elements, t('desktop.autoLoadFailed', 'Could not auto-load ProjectIndex: {message}')
          .replace('{message}', err.message));
        render(state, elements);
      });
  }

  function applyProjectIndex(index, fileInfo, state, elements, options) {
    const assetBaseUrl = normalizeAssetBaseUrl(options && options.assetBaseUrl || state.assetBaseUrl || '');
    state.assetBaseUrl = assetBaseUrl;
    state.model = buildViewModel(indexWithAssetBaseUrl(index, assetBaseUrl));
    state.selectedKey = null;
    state.selected = null;
    state.listRenderSignature = '';
    state.draftActionMessage = '';
    state.textActionMessage = '';
    state.view = 'overview';
    state.query = '';
    state.sortField = VIEW_DEFS.overview.defaultSort;
    state.sortDir = 'desc';
    elements.search.value = '';
    setStatus(elements, t('desktop.loadedFile', 'Loaded {file} ({size}).')
      .replace('{file}', fileInfo.name)
      .replace('{size}', formatBytes(fileInfo.size || 0)));
    notifyIndexLoaded(document, fileInfo, state.model);
    render(state, elements);
  }

  function normalizeAssetBaseUrl(value) {
    return String(value || '').trim();
  }

  function indexWithAssetBaseUrl(index, assetBaseUrl) {
    if (!assetBaseUrl || !index || !isObject(index)) {
      return index;
    }
    return Object.assign({}, index, {
      project: Object.assign({}, index.project || {}, {
        assetBaseUrl
      })
    });
  }

  function notifyIndexLoaded(document, file, model) {
    const detail = {
      index: model.index,
      model,
      fileName: file.name,
      fileSize: file.size,
      sourceExcerpts: hasSourceExcerpts(model.index)
    };
    document.dispatchEvent(new CustomEvent('project-map:index-loaded', {detail, bubbles: true}));
    if (global && typeof global.dispatchEvent === 'function') {
      global.dispatchEvent(new CustomEvent('project-map:index-loaded', {detail}));
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) {
      return bytes + ' B';
    }
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function setStatus(elements, message) {
    elements.status.classList.remove('is-error');
    elements.status.textContent = message;
  }

  function setDesktopStatus(elements, message, isError) {
    if (!elements || !elements.desktopStatus) {
      return;
    }
    elements.desktopStatus.classList.toggle('is-error', Boolean(isError));
    elements.desktopStatus.textContent = message;
  }

  function setDesktopProgress(elements, update) {
    if (!elements || !elements.desktopProgress) {
      return;
    }
    if (desktopProgressTimer) {
      global.clearTimeout(desktopProgressTimer);
      desktopProgressTimer = null;
    }
    const percent = clampPercent(update && update.percent);
    const stage = String(update && update.stage || 'working');
    const label = String(update && update.label || 'Working...');
    elements.desktopProgress.classList.remove('hidden');
    elements.desktopProgress.classList.toggle('is-error', Boolean(update && update.error));
    elements.desktopProgress.setAttribute('aria-valuenow', String(percent));
    elements.desktopProgress.setAttribute('aria-label', label);
    elements.desktopProgress.dataset.stage = stage;
    if (elements.desktopProgressBar) {
      elements.desktopProgressBar.style.width = percent + '%';
    }
    if (elements.desktopProgressLabel) {
      elements.desktopProgressLabel.textContent = percent + '% · ' + label;
    }
  }

  function clearDesktopProgressSoon(elements, delayMs) {
    if (desktopProgressTimer) {
      global.clearTimeout(desktopProgressTimer);
    }
    desktopProgressTimer = global.setTimeout(() => {
      clearDesktopProgress(elements);
      desktopProgressTimer = null;
    }, Number.isFinite(Number(delayMs)) ? Number(delayMs) : 700);
  }

  function clearDesktopProgress(elements) {
    if (!elements || !elements.desktopProgress) {
      return;
    }
    elements.desktopProgress.classList.add('hidden');
    elements.desktopProgress.classList.remove('is-error');
    elements.desktopProgress.setAttribute('aria-valuenow', '0');
    if (elements.desktopProgressBar) {
      elements.desktopProgressBar.style.width = '0%';
    }
    if (elements.desktopProgressLabel) {
      elements.desktopProgressLabel.textContent = t('topbar.idle', 'Idle');
    }
  }

  function clampPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(number)));
  }

  function showError(elements, message) {
    elements.status.classList.add('is-error');
    elements.status.textContent = message;
  }

  function render(state, elements) {
    updateBrandSubtitle(state, elements);
    updateNav(state, elements);
    updateSortOptions(state, elements);
    renderOverview(state, elements);
    renderList(state, elements);
    renderInspector(state, elements);
    applyI18n(elements.overview);
    applyI18n(elements.list);
    applyI18n(elements.inspector);
  }

  function updateBrandSubtitle(state, elements) {
    if (!elements.brandSubtitle) {
      return;
    }
    if (!state.model) {
      elements.brandSubtitle.textContent = t('topbar.subtitle.default', 'Studio workspace for branching Dendry projects');
      return;
    }
    const project = state.model.project || {};
    const schema = state.model.index && state.model.index.schemaVersion ? 'schema ' + state.model.index.schemaVersion : 'schema ?';
    const sceneCount = state.model.summary && state.model.summary.sceneCount
      ? state.model.summary.sceneCount + ' ' + t('overview.metric.scenes', 'scenes')
      : ensureArray(state.model.scenes).length + ' ' + t('overview.metric.scenes', 'scenes');
    elements.brandSubtitle.textContent = [project.name || 'ProjectIndex', schema, sceneCount].join(' · ');
  }

  function updateNav(state, elements) {
    elements.nav.forEach((button) => {
      const view = button.dataset.view;
      button.classList.toggle('is-active', button.dataset.view === state.view);
      button.innerHTML = '<span>' + escapeHtml(viewLabel(view)) + '</span>' +
        '<span class="nav-count">' + escapeHtml(navCountLabel(state.model, view)) + '</span>';
    });
  }

  function navCountLabel(model, view) {
    if (!model) {
      return '';
    }
    const summary = model.summary || {};
    const counts = {
      overview: summary.sceneCount || ensureArray(model.scenes).length,
      coverage: ensureArray(model.lists && model.lists.coverage).length || coverageRows(model.index).length,
      scenes: summary.sceneCount || ensureArray(model.lists && model.lists.scenes).length,
      events: summary.eventCount || ensureArray(model.lists && model.lists.events).length,
      cards: summary.cardCount || ensureArray(model.lists && model.lists.cards).length,
      news: (summary.newsItemCount || 0) + (summary.eventPopupCount || 0) || ensureArray(model.lists && model.lists.news).length,
      textCorpus: summary.textCorpusCount || ensureArray(model.lists && model.lists.textCorpus).length,
      assets: summary.assetCount || ensureArray(model.lists && model.lists.assets).length,
      surfaceText: summary.surfaceTextCount || ensureArray(model.lists && model.lists.surfaceText).length,
      variables: summary.variableCount || ensureArray(model.variables).length,
      diagnostics: summary.diagnosticCount || ensureArray(model.diagnostics).length
    };
    const value = counts[view];
    return value === undefined || value === null || value === '' ? '' : String(value);
  }

  function updateSortOptions(state, elements) {
    const fields = VIEW_DEFS[state.view].sorts;
    if (!fields.includes(state.sortField)) {
      state.sortField = VIEW_DEFS[state.view].defaultSort;
    }
    elements.sortField.innerHTML = fields.map((field) => {
      return '<option value="' + escapeHtml(field) + '">' + escapeHtml(field) + '</option>';
    }).join('');
    elements.sortField.value = state.sortField;
    elements.sortDir.textContent = state.sortDir === 'asc' ? 'A-Z' : 'Z-A';
  }

  function renderOverview(state, elements) {
    if (!state.model) {
      elements.overview.innerHTML = '';
      return;
    }
    const model = state.model;
    const summary = model.summary;
    const diagnostics = diagnosticBreakdown(model.diagnostics);
    const severityCounts = countBy(model.diagnostics, (diag) => diag.severity || 'info');
    const profileIds = ensureArray(model.project.profileIds).join(', ');
    const coverage = ensureArray(model.lists && model.lists.coverage);
    const mustHaveDone = coverage.filter((row) => row.releasePriority === 'must-have' && row.noCodeCompletion !== 'no').length;
    const mustHaveTotal = coverage.filter((row) => row.releasePriority === 'must-have').length;
    const metrics = [
      [t('overview.metric.scenes', 'Scenes'), summary.sceneCount],
      [t('overview.metric.edges', 'Edges'), summary.edgeCount],
      [t('overview.metric.variables', 'Variables'), summary.variableCount],
      [t('overview.metric.events', 'Events'), summary.eventCount],
      [t('overview.metric.cards', 'Cards'), summary.cardCount],
      [model.uiLabels.advisorLikePlural || t('overview.metric.advisors', 'Advisors'), summary.pinnedCardCount || 0],
      [t('overview.metric.newsItems', 'News items'), summary.newsItemCount],
      [t('overview.metric.textCorpus', 'Text items'), summary.textCorpusCount || ensureArray(model.lists.textCorpus).length],
      [t('overview.metric.surfaceText', 'Surface text'), summary.surfaceTextCount || ensureArray(model.lists.surfaceText).length],
      [t('overview.metric.assets', 'Assets'), summary.assetCount || ensureArray(model.lists.assets).length],
      [t('overview.metric.modderTasks', 'Modder tasks'), mustHaveDone + ' / ' + mustHaveTotal],
      [t('overview.metric.diagnostics', 'Diagnostics'), summary.diagnosticCount],
      [t('overview.metric.regexOnlyGoto', 'Regex-only go-to'), diagnostics.find((diag) => diag.code === 'project_map.regex_only_goto')?.count || 0]
    ];
    elements.overview.classList.toggle('hidden', state.view !== 'overview');
    elements.overview.innerHTML = [
      '<div class="overview-grid">',
      metrics.map((metric) => {
        return '<div class="metric"><span class="metric-value">' + escapeHtml(metric[1]) +
          '</span><span class="metric-label">' + escapeHtml(metric[0]) + '</span></div>';
      }).join(''),
      '</div>',
      '<dl class="kv">',
      '<dt>' + escapeHtml(t('overview.project', 'Project')) + '</dt><dd>' + escapeHtml(model.project.name || '(unnamed)') + '</dd>',
      '<dt>' + escapeHtml(t('overview.profiles', 'Profiles')) + '</dt><dd>' + escapeHtml(profileIds || '(none)') + '</dd>',
      '<dt>' + escapeHtml(t('overview.severity', 'Severity')) + '</dt><dd>' + escapeHtml(formatCounts(severityCounts)) + '</dd>',
      '<dt>' + escapeHtml(t('overview.generated', 'Generated')) + '</dt><dd>' + escapeHtml(model.index.generatedAt || '(unknown)') + '</dd>',
      '</dl>',
      renderFirstModRoadmap(model)
    ].join('');
  }

  function renderFirstModRoadmap(model) {
    const coverage = new Map(ensureArray(model && model.lists && model.lists.coverage).map((row) => [row.id, row]));
    const steps = [
      [t('roadmap.find', 'Find'), coverage.get('find_and_compare'), t('roadmap.findText', 'Find what you want to change without opening source files.')],
      [t('roadmap.draft', 'Draft'), coverage.get('events'), t('roadmap.draftText', 'Create or seed event/news/card/text proposals.')],
      [t('roadmap.text', 'Text'), coverage.get('existing_text'), t('roadmap.textText', 'Change visible wording with explicit manual/safe boundaries.')],
      [t('roadmap.install', 'Install'), coverage.get('install_review'), t('roadmap.installText', 'Separate safe apply from manual review before touching the project.')],
      [t('roadmap.preview', 'Preview'), coverage.get('preview_assets'), t('roadmap.previewText', 'Use authoring preview and read-only asset references to judge proposals before manual install.')]
    ];
    return [
      '<section class="roadmap-panel" aria-label="First mod roadmap">',
      '<div class="preview-heading">' + escapeHtml(t('overview.firstModRoadmap', 'First Mod Roadmap')) + '</div>',
      '<div class="roadmap-grid">',
      steps.map(([label, row, text]) => {
        const level = row && row.coverageLevel ? row.coverageLevel : 'unknown';
        return [
          '<div class="roadmap-card">',
          '<div class="roadmap-card-head">',
          '<strong>' + escapeHtml(label) + '</strong>',
          row ? badge(row.coverageLabel || level, coverageClass(level)) : badge('missing', 'opaque'),
          '</div>',
          '<p>' + escapeHtml(text) + '</p>',
          row && row.studioPath ? '<div class="meta">' + escapeHtml(coverageField(row, 'studioPath')) + '</div>' : '',
          '</div>'
        ].join('');
      }).join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function formatCounts(counts) {
    return Object.keys(counts).sort().map((key) => key + ' ' + counts[key]).join(', ') || '(none)';
  }

  function coverageClass(level) {
    const value = String(level || '');
    if (value === 'draft_seed' || value === 'mixed') {
      return 'info';
    }
    if (value === 'guided_only' || value === 'ide_escape_hatch') {
      return 'warning';
    }
    if (value === 'not_started') {
      return 'opaque';
    }
    return '';
  }

  function priorityClass(priority) {
    const value = String(priority || '').toLowerCase();
    if (value.includes('must')) {
      return 'warning';
    }
    if (value.includes('blocker')) {
      return 'error';
    }
    if (value.includes('later')) {
      return 'opaque';
    }
    return 'info';
  }

  function completionClass(value) {
    const text = String(value || '').toLowerCase();
    if (text === 'mostly') {
      return 'exact';
    }
    if (text === 'partial' || text === 'guided') {
      return 'warning';
    }
    if (text === 'no') {
      return 'opaque';
    }
    return 'info';
  }

  function currentItems(state) {
    return state.model
      ? filterAndSortItems(state.model, state.view, state.query, state.sortField, state.sortDir)
      : [];
  }

  function renderList(state, elements) {
    state.virtualListActive = false;
    if (!state.model) {
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('design.noIndex', 'No project index loaded.')) + '</div>';
      state.currentItems = [];
      return;
    }
    if (state.view === 'assets') {
      renderAssetGallery(state, elements);
      return;
    }
    if (state.view === 'news') {
      renderNewsList(state, elements);
      return;
    }
    if (state.view === 'textCorpus') {
      renderTextCorpusList(state, elements);
      return;
    }
    const baseItems = listForView(state.model, state.view);
    if (baseItems.length === 0) {
      const label = viewLabel(state.view);
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('explore.noViewData', 'No {view} data in this index.').replace('{view}', label)) + '</div>';
      state.currentItems = [];
      return;
    }
    const items = currentItems(state);
    state.currentItems = items;
    if (items.length === 0) {
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('explore.noMatches', 'No matching rows for the current search.')) + '</div>';
      return;
    }
    elements.list.innerHTML = items.map((item) => renderListRow(item, state)).join('');
  }

  function renderAssetGallery(state, elements) {
    const baseItems = listForView(state.model, state.view);
    if (baseItems.length === 0) {
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('assets.empty', 'No image or audio assets were found in this index.')) + '</div>';
      state.currentItems = [];
      return;
    }
    const items = currentItems(state);
    state.currentItems = items;
    if (items.length === 0) {
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('assets.noMatches', 'No matching assets for the current search.')) + '</div>';
      return;
    }
    if (items.length >= VIRTUAL_LIST_THRESHOLD) {
      renderVirtualAssetGallery(state, elements, items);
      return;
    }
    elements.list.innerHTML = [
      '<section class="asset-gallery" aria-label="' + escapeAttr(t('assets.gallery', 'Asset gallery')) + '">',
      '<div class="list-section-heading"><span>' + escapeHtml(t('assets.gallery', 'Asset gallery')) + '</span><b>' + escapeHtml(String(items.length)) + '</b></div>',
      '<div class="asset-gallery-grid">',
      items.map((item) => renderAssetGalleryCard(item, state)).join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderVirtualAssetGallery(state, elements, items) {
    const columns = assetGalleryColumnCount(elements.list);
    prepareVirtualList(state, elements, 'assets', items, String(columns));
    const rows = assetGalleryRows(items, columns);
    const viewportHeight = elements.list.clientHeight || 600;
    const windowState = virtualWindowForList(rows.length, elements.list.scrollTop || 0, viewportHeight, {
      rowHeight: VIRTUAL_ASSET_ROW_HEIGHT,
      overscan: 4
    });
    const visibleRows = rows.slice(windowState.start, windowState.end);
    elements.list.innerHTML = [
      '<section class="asset-gallery asset-gallery-virtual" aria-label="' + escapeAttr(t('assets.gallery', 'Asset gallery')) + '">',
      '<div class="list-section-heading"><span>' + escapeHtml(t('assets.gallery', 'Asset gallery')) + '</span><b>' + escapeHtml(String(items.length)) + '</b></div>',
      '<div class="virtual-list asset-virtual-list" data-virtual-list="assets" data-virtual-count="' + escapeAttr(String(items.length)) + '" style="height: ' + escapeAttr(String(windowState.totalHeight)) + 'px">',
      '<div class="virtual-list-window" style="transform: translateY(' + escapeAttr(String(windowState.topSpacer)) + 'px)">',
      visibleRows.map((row) => renderVirtualAssetRow(row, state)).join(''),
      '</div>',
      '</div>',
      '</section>'
    ].join('');
  }

  function assetGalleryColumnCount(container) {
    const width = Math.max(1, container && container.clientWidth || 1);
    return Math.max(1, Math.floor(width / VIRTUAL_ASSET_CARD_MIN_WIDTH));
  }

  function assetGalleryRows(items, columns) {
    const cols = Math.max(1, Number(columns) || 1);
    const rows = [];
    for (let index = 0; index < items.length; index += cols) {
      rows.push(items.slice(index, index + cols));
    }
    return rows;
  }

  function renderVirtualAssetRow(rowItems, state) {
    return [
      '<div class="asset-gallery-grid virtual-asset-row">',
      rowItems.map((item) => renderAssetGalleryCard(item, state)).join(''),
      '</div>'
    ].join('');
  }

  function renderAssetGalleryCard(item, state) {
    const asset = item.raw || item;
    const selected = item.key === state.selectedKey ? ' is-selected' : '';
    const usageCount = ensureArray(asset.usageRefs).length;
    return [
      '<button class="asset-gallery-card' + selected + '" type="button" data-row-key="' + escapeAttr(item.key) + '">',
      renderAssetPreviewFrame(asset, 'card'),
      '<span class="asset-card-title">' + escapeHtml(asset.name || asset.label || asset.path || item.primary) + '</span>',
      '<span class="asset-card-path">' + escapeHtml(asset.path || '') + '</span>',
      '<span class="badge-line">',
      renderBadge(asset.type || 'asset', asset.type || ''),
      renderBadge(asset.status && asset.status.key || asset.editability || 'reference_only', asset.status && asset.status.key || asset.editability || ''),
      usageCount ? renderBadge(t('assets.usedCount', 'used ') + usageCount, 'info') : '',
      '</span>',
      '</button>'
    ].join('');
  }

  function renderAssetPicker(projectIndex, options) {
    const opts = options || {};
    const target = opts.target === 'card' ? 'card' : 'event';
    const rawSelected = opts.selectedPaths !== undefined ? opts.selectedPaths : opts.selectedPath;
    const selectedValues = (Array.isArray(rawSelected) ? rawSelected : [rawSelected])
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const selected = new Set(selectedValues);
    const assets = ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic.assets && projectIndex.semantic.assets.items)
      .map((item) => normalizeAssetForViewer(item, projectIndex))
      .filter((asset) => asset.path || asset.id);
    if (!assets.length) {
      return '<section class="asset-picker"><div class="preview-heading">' + escapeHtml(t('assets.picker', 'Asset picker')) + '</div><p class="inspector-note">' + escapeHtml(t('assets.empty', 'No image or audio assets were found in this index.')) + '</p></section>';
    }
    return [
      '<section class="asset-picker" data-asset-picker-target="' + escapeAttr(target) + '">',
      '<div class="preview-heading">' + escapeHtml(t('assets.picker', 'Asset picker')) + '</div>',
      '<div class="asset-picker-grid">',
      assets.slice(0, 48).map((asset) => renderAssetPickerButton(asset, target, selected)).join(''),
      '</div>',
      '<p>' + escapeHtml(t('assets.pickerNote', 'Select an indexed asset to add an assetRefs line. Files are still handled manually.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderAssetPickerButton(asset, target, selected) {
    const api = assetModelApi();
    const role = defaultAssetRole(asset, target);
    const ref = api && typeof api.assetDraftReference === 'function'
      ? api.assetDraftReference(asset, {role})
      : {path: asset.path || '', type: asset.type || 'asset', label: asset.label || asset.name || '', role};
    const payload = escapeAttr(JSON.stringify(ref));
    const selectedClass = selected.has(asset.path) || selected.has(asset.id) ? ' is-selected' : '';
    const state = asset.referenceState && asset.referenceState.key || 'unknown';
    return [
      '<button class="asset-picker-item' + selectedClass + '" type="button" data-asset-picker-action="select" data-asset-target="' + escapeAttr(target) + '" data-asset-ref="' + payload + '">',
      '<span class="asset-picker-name">' + escapeHtml(asset.label || asset.name || asset.path || '') + '</span>',
      '<span class="asset-picker-path">' + escapeHtml(asset.path || '') + '</span>',
      '<span class="badge-line">',
      renderBadge(asset.type || 'asset', asset.type || ''),
      role ? renderBadge(role, role) : '',
      renderBadge(state, state),
      '</span>',
      '</button>'
    ].join('');
  }

  function defaultAssetRole(asset, target) {
    if ((asset && asset.type) === 'audio') {
      return target === 'card' ? 'card_audio' : 'event_audio';
    }
    return target === 'card' ? 'card_image' : 'event_illustration';
  }

  function renderDraftAssetPanel(draft, projectIndex, options) {
    const value = draft || {};
    const refs = ensureArray(value.assetRefs);
    const requests = ensureArray(value.assetInstallRequests);
    const target = options && options.target === 'card' ? 'card' : 'event';
    if (!refs.length && !requests.length) {
      return [
        '<section class="draft-asset-panel" data-draft-asset-target="' + escapeAttr(target) + '">',
        '<div class="preview-heading">' + escapeHtml(t('assets.draftPanel', 'Draft assets')) + '</div>',
        '<p class="inspector-note">' + escapeHtml(t('assets.draftPanelEmpty', 'No visual or audio assets are attached to this draft yet.')) + '</p>',
        '</section>'
      ].join('');
    }
    const manifest = buildDraftAssetManifest(refs, projectIndex);
    const slots = buildDraftAssetSlots(value, projectIndex, {target});
    return [
      '<section class="draft-asset-panel" data-draft-asset-target="' + escapeAttr(target) + '">',
      '<div class="preview-heading">' + escapeHtml(t('assets.draftPanel', 'Draft assets')) + '</div>',
      renderAssetSlotGrid(slots),
      '<div class="draft-asset-grid">',
      ensureArray(manifest.items).map(renderDraftAssetRefCard).join(''),
      requests.map(renderDraftAssetInstallCard).join(''),
      '</div>',
      '<p>' + escapeHtml(t('assets.draftPanelNote', 'These assets are preview/install proposals. Review & Apply will not copy files until a safe desktop copy flow is enabled.')) + '</p>',
      '</section>'
    ].join('');
  }

  function buildDraftAssetSlots(draft, projectIndex, options) {
    const api = assetModelApi();
    return api && typeof api.buildAssetSlots === 'function'
      ? api.buildAssetSlots(draft || {}, {projectIndex, target: options && options.target})
      : [];
  }

  function renderAssetSlotGrid(slots) {
    const items = ensureArray(slots);
    if (!items.length) {
      return '';
    }
    return [
      '<section class="asset-slot-panel">',
      '<div class="preview-heading">' + escapeHtml(t('assets.slots', 'Asset slots')) + '</div>',
      '<div class="asset-slot-grid">',
      items.map(renderAssetSlotCard).join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderAssetSlotCard(slot) {
    const ref = slot.assetRef || null;
    const request = slot.installRequest || null;
    const label = t('assets.role.' + slot.role, slot.roleLabel || slot.label || slot.role);
    const status = slot.status || 'empty';
    return [
      '<article class="asset-slot-card" data-asset-slot-role="' + escapeAttr(slot.role || '') + '">',
      '<strong>' + escapeHtml(label) + '</strong>',
      '<span class="asset-slot-type">' + escapeHtml(labelForBadge(slot.type || 'asset')) + '</span>',
      ref ? '<code>' + escapeHtml(ref.path || '') + '</code>' : '<span class="inspector-note">' + escapeHtml(t('assets.slotEmpty', 'No asset selected for this slot.')) + '</span>',
      request ? '<span class="draft-asset-source">' + escapeHtml(request.sourceName || request.sourcePath || '') + '</span>' : '',
      '<span class="badge-line">',
      renderBadge(status, status),
      request ? renderBadge('copy_asset_file', 'manual_review') : '',
      '</span>',
      '</article>'
    ].join('');
  }

  function buildDraftAssetManifest(refs, projectIndex) {
    const api = assetModelApi();
    return api && typeof api.buildAssetManifest === 'function'
      ? api.buildAssetManifest(refs || [], {projectIndex})
      : {items: ensureArray(refs)};
  }

  function renderDraftAssetRefCard(asset) {
    const state = asset.referenceState && asset.referenceState.key || 'unknown';
    return [
      '<article class="draft-asset-card">',
      '<strong>' + escapeHtml(asset.label || asset.name || asset.path || t('assets.type.asset', 'Asset')) + '</strong>',
      localizedAssetRoleLabel(asset) ? '<span class="draft-asset-role">' + escapeHtml(localizedAssetRoleLabel(asset)) + '</span>' : '',
      '<code>' + escapeHtml(asset.path || '') + '</code>',
      '<span class="badge-line">',
      renderBadge(asset.type || 'asset', asset.type || ''),
      renderBadge(state, state),
      '</span>',
      '</article>'
    ].join('');
  }

  function renderDraftAssetInstallCard(request) {
    const item = normalizeAssetInstallRequestForViewer(request);
    return [
      '<article class="draft-asset-card draft-asset-card-install">',
      '<strong>' + escapeHtml(item.label || item.sourceName || item.targetPath || t('assets.installRequests', 'Asset install proposal')) + '</strong>',
      item.role ? '<span class="draft-asset-role">' + escapeHtml(t('assets.role.' + item.role, item.roleLabel || item.role)) + '</span>' : '',
      '<span class="draft-asset-source">' + escapeHtml(item.sourceName || item.sourcePath || t('assets.sourcePending', 'Source file selected in this browser session')) + '</span>',
      '<code>' + escapeHtml(item.targetPath || '') + '</code>',
      '<span class="badge-line">',
      renderBadge(item.type || 'asset', item.type || ''),
      renderBadge('copy_asset_file', 'manual_review'),
      renderBadge('manual_review', 'manual_review'),
      '</span>',
      '</article>'
    ].join('');
  }

  function normalizeAssetInstallRequestForViewer(request) {
    const api = assetModelApi();
    if (api && typeof api.assetInstallRequest === 'function') {
      return api.assetInstallRequest(request || {}, {});
    }
    const item = request && typeof request === 'object' ? request : {};
    return {
      sourceName: String(item.sourceName || item.name || '').trim(),
      sourcePath: String(item.sourcePath || '').trim(),
      targetPath: String(item.targetPath || item.path || '').trim(),
      type: String(item.type || item.assetType || 'asset').trim(),
      label: String(item.label || item.sourceName || '').trim(),
      role: String(item.role || '').trim(),
      roleLabel: String(item.role || '').replace(/[_-]+/g, ' ')
    };
  }

  function renderNewsList(state, elements) {
    const baseItems = listForView(state.model, state.view);
    if (baseItems.length === 0) {
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('news.empty', 'No ticker news or monthly event popups were found in this index.')) + '</div>';
      state.currentItems = [];
      return;
    }
    const items = currentItems(state);
    state.currentItems = items;
    if (items.length === 0) {
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('news.noMatches', 'No matching news rows for the current search.')) + '</div>';
      return;
    }
    if (items.length >= VIRTUAL_LIST_THRESHOLD) {
      renderVirtualNewsList(state, elements, items);
      return;
    }
    const ticker = items.filter((item) => item.raw && item.raw.delivery !== 'legacy_event_popup');
    const popups = items.filter((item) => item.raw && item.raw.delivery === 'legacy_event_popup');
    const sections = [];
    if (ticker.length) {
      sections.push(renderNewsSection(t('news.tickerSection', 'Ticker / Pool News'), ticker, '', state));
    }
    if (popups.length) {
      const note = ticker.length
        ? ''
        : '<div class="list-section-note">' + escapeHtml(t('news.legacyOnlyNote', 'This project uses monthly event popups instead of Island-style ticker news.')) + '</div>';
      sections.push(renderNewsSection(t('news.popupSection', 'Monthly Event Popups'), popups, note, state));
    }
    elements.list.innerHTML = sections.join('');
  }

  function renderNewsSection(title, items, note, state) {
    return [
      '<section class="list-section">',
      '<div class="list-section-heading"><span>' + escapeHtml(title) + '</span><b>' + escapeHtml(String(items.length)) + '</b></div>',
      note || '',
      items.map((item) => renderListRow(item, state)).join(''),
      '</section>'
    ].join('');
  }

  function renderVirtualNewsList(state, elements, items) {
    prepareVirtualList(state, elements, 'news', items, '');
    const entries = newsDisplayEntries(items);
    const viewportHeight = elements.list.clientHeight || 600;
    const windowState = virtualWindowForList(entries.length, elements.list.scrollTop || 0, viewportHeight);
    const visibleEntries = entries.slice(windowState.start, windowState.end);
    elements.list.innerHTML = [
      '<div class="virtual-list" data-virtual-list="news" data-virtual-count="' + escapeAttr(String(items.length)) + '" style="height: ' + escapeAttr(String(windowState.totalHeight)) + 'px">',
      '<div class="virtual-list-window" style="transform: translateY(' + escapeAttr(String(windowState.topSpacer)) + 'px)">',
      visibleEntries.map((entry) => renderNewsDisplayEntry(entry, state)).join(''),
      '</div>',
      '</div>'
    ].join('');
  }

  function newsDisplayEntries(items) {
    const ticker = items.filter((item) => item.raw && item.raw.delivery !== 'legacy_event_popup');
    const popups = items.filter((item) => item.raw && item.raw.delivery === 'legacy_event_popup');
    const entries = [];
    if (ticker.length) {
      entries.push({
        type: 'section',
        key: 'news:ticker',
        title: t('news.tickerSection', 'Ticker / Pool News'),
        count: ticker.length
      });
      ticker.forEach((item) => entries.push({type: 'row', key: item.key, item}));
    }
    if (popups.length) {
      entries.push({
        type: 'section',
        key: 'news:popups',
        title: t('news.popupSection', 'Monthly Event Popups'),
        count: popups.length
      });
      if (!ticker.length) {
        entries.push({
          type: 'note',
          key: 'news:legacy-note',
          text: t('news.legacyOnlyNote', 'This project uses monthly event popups instead of Island-style ticker news.')
        });
      }
      popups.forEach((item) => entries.push({type: 'row', key: item.key, item}));
    }
    return entries;
  }

  function renderNewsDisplayEntry(entry, state) {
    if (entry.type === 'section') {
      return [
        '<div class="list-section-heading virtual-section-heading" data-virtual-section="' + escapeAttr(entry.key || '') + '">',
        '<span>' + escapeHtml(entry.title || '') + '</span><b>' + escapeHtml(String(entry.count || 0)) + '</b>',
        '</div>'
      ].join('');
    }
    if (entry.type === 'note') {
      return '<div class="list-section-note virtual-list-note">' + escapeHtml(entry.text || '') + '</div>';
    }
    return renderListRow(entry.item, state);
  }

  function renderTextCorpusList(state, elements) {
    const baseItems = listForView(state.model, state.view);
    if (baseItems.length === 0) {
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('textCorpus.empty', 'No player-visible text was found in this index.')) + '</div>';
      state.currentItems = [];
      return;
    }
    const items = currentItems(state);
    state.currentItems = items;
    if (items.length === 0) {
      elements.list.innerHTML = '<div class="empty-state">' + escapeHtml(t('textCorpus.noMatches', 'No matching text rows for the current search.')) + '</div>';
      return;
    }
    if (items.length >= VIRTUAL_LIST_THRESHOLD) {
      renderVirtualTextCorpusList(state, elements, items);
      return;
    }
    const grouped = textCorpusGroups(items);
    const order = ['event_body', 'choices', 'news', 'surface', 'other'];
    elements.list.innerHTML = order
      .filter((key) => grouped.has(key))
      .map((key) => renderTextCorpusSection(textCorpusGroupLabel(key), grouped.get(key), state))
      .join('');
  }

  function textCorpusGroups(items) {
    const grouped = new Map();
    ensureArray(items).forEach((item) => {
      const group = textCorpusGroup(item.raw);
      if (!grouped.has(group)) {
        grouped.set(group, []);
      }
      grouped.get(group).push(item);
    });
    return grouped;
  }

  function renderTextCorpusSection(title, items, state) {
    return [
      '<section class="list-section">',
      '<div class="list-section-heading"><span>' + escapeHtml(title) + '</span><b>' + escapeHtml(String(items.length)) + '</b></div>',
      items.map((item) => renderListRow(item, state)).join(''),
      '</section>'
    ].join('');
  }

  function prepareVirtualList(state, elements, type, items, extra) {
    state.virtualListActive = true;
    const signature = [
      type || state.view,
      state.view,
      state.query || '',
      state.sortField || '',
      state.sortDir || '',
      ensureArray(items).length,
      extra || ''
    ].join('::');
    if (state.listRenderSignature !== signature) {
      state.listRenderSignature = signature;
      if (elements.list.scrollTop) {
        elements.list.scrollTop = 0;
      }
    }
  }

  function renderVirtualTextCorpusList(state, elements, items) {
    prepareVirtualList(state, elements, 'textCorpus', items, '');
    const entries = textCorpusDisplayEntries(items);
    const viewportHeight = elements.list.clientHeight || 600;
    const windowState = virtualWindowForList(entries.length, elements.list.scrollTop || 0, viewportHeight);
    const visibleEntries = entries.slice(windowState.start, windowState.end);
    elements.list.innerHTML = [
      '<div class="virtual-list" data-virtual-list="textCorpus" data-virtual-count="' + escapeAttr(String(items.length)) + '" style="height: ' + escapeAttr(String(windowState.totalHeight)) + 'px">',
      '<div class="virtual-list-window" style="transform: translateY(' + escapeAttr(String(windowState.topSpacer)) + 'px)">',
      visibleEntries.map((entry) => renderTextCorpusDisplayEntry(entry, state)).join(''),
      '</div>',
      '</div>'
    ].join('');
  }

  function textCorpusDisplayEntries(items) {
    const grouped = textCorpusGroups(items);
    const entries = [];
    ['event_body', 'choices', 'news', 'surface', 'other'].forEach((key) => {
      const groupItems = grouped.get(key);
      if (!groupItems || !groupItems.length) {
        return;
      }
      entries.push({
        type: 'section',
        key: 'section:' + key,
        title: textCorpusGroupLabel(key),
        count: groupItems.length
      });
      groupItems.forEach((item) => {
        entries.push({type: 'row', key: item.key, item});
      });
    });
    return entries;
  }

  function renderTextCorpusDisplayEntry(entry, state) {
    if (entry.type === 'section') {
      return [
        '<div class="list-section-heading virtual-section-heading" data-virtual-section="' + escapeAttr(entry.key || '') + '">',
        '<span>' + escapeHtml(entry.title || '') + '</span><b>' + escapeHtml(String(entry.count || 0)) + '</b>',
        '</div>'
      ].join('');
    }
    return renderListRow(entry.item, state);
  }

  function textCorpusGroup(item) {
    const role = String(item && item.role || '');
    const owner = item && item.owner || {};
    if (role === 'option_label') {
      return 'choices';
    }
    if (role.startsWith('news_') || role.startsWith('monthly_popup')) {
      return 'news';
    }
    if (role === 'surface_label' || owner.kind === 'surface_text') {
      return 'surface';
    }
    if (owner.kind === 'scene') {
      return 'event_body';
    }
    return 'other';
  }

  function textCorpusGroupLabel(key) {
    const labels = {
      event_body: t('textCorpus.group.eventBody', 'Scene / event text'),
      choices: t('textCorpus.group.choices', 'Player choices'),
      news: t('textCorpus.group.news', 'News / monthly popups'),
      surface: t('textCorpus.group.surface', 'Surface text'),
      other: t('textCorpus.group.other', 'Other text')
    };
    return labels[key] || key;
  }

  function renderListRow(item, state) {
    const badges = item.badges.map((badge) => {
      if (!badge) {
        return '';
      }
      return renderBadge(badge.text, badge.className);
    }).join('');
    const selected = item.key === state.selectedKey ? ' is-selected' : '';
    return [
      '<button class="list-row' + selected + '" type="button" data-row-key="' + escapeAttr(item.key) + '">',
      '<span><span class="primary">' + escapeHtml(item.primary) + '</span></span>',
      '<span class="secondary">' + escapeHtml(item.secondary) + '</span>',
      '<span class="meta">' + escapeHtml(item.meta) + '</span>',
      '<span class="badge-line">' + badges + '</span>',
      '</button>'
    ].join('');
  }

  function renderInspector(state, elements) {
    if (!state.model) {
      elements.inspector.innerHTML = '<div class="empty-state">' + escapeHtml(t('explore.inspectorNoIndex', 'Load a project index to inspect it.')) + '</div>';
      return;
    }
    if (!state.selected) {
      elements.inspector.innerHTML = '<div class="empty-state">' + escapeHtml(t('explore.inspectorEmpty', 'Select an item to inspect source spans, confidence, edges, and variable usage.')) + '</div>';
      return;
    }
    const selected = state.selected;
    const preview = renderInspectorPreview(selected, state);
    if (selected.view === 'variables') {
      elements.inspector.innerHTML = renderVariableInspector(selected.item);
    } else if (selected.view === 'coverage') {
      elements.inspector.innerHTML = renderCoverageInspector(selected.item);
    } else if (selected.view === 'diagnostics') {
      elements.inspector.innerHTML = renderDiagnosticInspector(selected.item, state.model);
    } else if (selected.view === 'news') {
      const workbench = selected.item && selected.item.delivery === 'legacy_event_popup'
        ? renderEventWorkbenchInspector(selected.item, state.model)
        : '';
      elements.inspector.innerHTML = workbench
        ? workbench
        : renderNewsInspector(selected.item) + preview + renderEditDraftAction(selected, state) + renderTextProposalAction(selected, state);
    } else if (selected.view === 'surfaceText') {
      elements.inspector.innerHTML = renderSurfaceTextInspector(selected.item) + preview + renderEditDraftAction(selected, state) + renderTextProposalAction(selected, state);
    } else if (selected.view === 'textCorpus') {
      elements.inspector.innerHTML = renderTextCorpusInspector(selected.item, state.model, state);
    } else if (selected.view === 'assets') {
      elements.inspector.innerHTML = renderAssetInspector(selected.item, state.model);
    } else if (selected.view === 'source') {
      elements.inspector.innerHTML = renderSourceInspector(selected.item);
    } else if (selected.view === 'overview') {
      elements.inspector.innerHTML = renderOverviewInspector(selected.item, state.model);
    } else {
      const scene = sceneFromSelection(selected.item, state.model);
      const workbench = renderEventWorkbenchInspector(scene || selected.item, state.model);
      elements.inspector.innerHTML = workbench
        ? workbench
        : renderSceneInspector(scene || selected.item, state.model) + preview + renderEditDraftAction(selected, state) + renderTextProposalAction(selected, state);
    }
  }

  function renderInspectorPreview(selected, state) {
    const preview = previewModelForSelection(selected, state);
    if (!preview) {
      return '';
    }
    const meaningUi = global.ProjectMapMeaningLayerUi;
    const apiCore = global.ProjectMapPreviewModel;
    const fallbackText = apiCore && typeof apiCore.renderPreviewText === 'function'
      ? apiCore.renderPreviewText(preview)
      : preview.title || '';
    const previewHtml = meaningUi && typeof meaningUi.renderPreviewHtml === 'function'
      ? meaningUi.renderPreviewHtml(preview, {}, fallbackText)
      : '<pre class="player-preview inspector-preview-text">' + escapeHtml(fallbackText) + '</pre>';
    return [
      '<div class="detail-section inspector-preview" data-inspector-preview="true">',
      '<h3 class="section-title">' + escapeHtml(t('preview.title', 'Preview')) + '</h3>',
      previewHtml,
      '</div>'
    ].join('');
  }

  function previewModelForSelection(selected, state) {
    const apiCore = global.ProjectMapPreviewModel;
    if (!apiCore || typeof apiCore.buildPreviewModel !== 'function' || !selected || !state.model) {
      return null;
    }
    try {
      if (selected.view === 'news' && selected.item && selected.item.delivery === 'legacy_event_popup') {
        return apiCore.buildPreviewModel(selected.item, {sourceKind: 'news', projectIndex: state.model.index});
      }
      if (selected.view === 'surfaceText') {
        const textResult = previewTextReplacement(state.model.index, selected.view, selected.item);
        return apiCore.buildPreviewModel(textResult.ok ? textResult : selected.item, {
          sourceKind: 'surface_text',
          projectIndex: state.model.index
        });
      }
      if (canEditAsDraft(selected.view)) {
        const draftResult = previewDraftExtraction(state.model.index, selected.view, selected.item);
        if (draftResult && draftResult.ok) {
          return apiCore.buildPreviewModel(draftResult, {projectIndex: state.model.index});
        }
      }
      if (selected.view === 'news') {
        return apiCore.buildPreviewModel(selected.item, {sourceKind: 'news', projectIndex: state.model.index});
      }
    } catch (err) {
      return apiCore.buildPreviewModel({
        status: 'unsupported',
        diagnostics: [{severity: 'warning', code: 'preview.failed', message: err && err.message ? err.message : String(err)}]
      }, {sourceKind: selected.view || 'unknown', projectIndex: state.model.index});
    }
    return null;
  }

  function renderEditDraftAction(selected, state) {
    if (!selected || !state.model || !canEditAsDraft(selected.view)) {
      return '';
    }
    const result = previewDraftExtraction(state.model.index, selected.view, selected.item);
    const disabled = !result.ok || result.status === 'unsupported';
    const existingSupported = canEditExisting(selected.view) && existingEditSupported(state.model.index, selected.view, selected.item);
    const status = state.draftActionMessage || draftActionSummary(result);
    const diagnostics = ensureArray(result.diagnostics).slice(0, 4).map((diag) => {
      return badge(diag.severity || 'warning', diag.severity || 'warning') + ' ' +
        escapeHtml(diag.code || '') + '<br>' + escapeHtml(diag.message || '');
    });
    return [
      '<div class="inspector-actions" data-edit-draft-panel="true">',
      canEditExisting(selected.view)
        ? '<button class="draft-action-button" type="button" data-edit-existing="true"' +
          (existingSupported ? '' : ' disabled') + '>' + escapeHtml(t('existingScene.editExisting', 'Edit existing')) + '</button>'
        : '',
      '<button class="draft-action-button" type="button" data-edit-as-draft="true"' +
        (disabled ? ' disabled' : '') + '>' + escapeHtml(t('existingScene.copyAsNew', 'Copy as new proposal')) + '</button>',
      '<div class="draft-action-status" data-text-action-status="true">' + escapeHtml(status) + '</div>',
      renderExtractionScope(result),
      diagnostics.length ? renderMiniSection('Draft notes', diagnostics) : '',
      '</div>'
    ].join('');
  }

  function canEditAsDraft(view) {
    return view === 'events' || view === 'cards' || view === 'news' || view === 'surfaceText';
  }

  function canEditExisting(view) {
    return view === 'events' || view === 'cards';
  }

  function existingEditSupported(index, view, item) {
    const editor = global.ProjectMapExistingSceneEdit;
    if (!editor || typeof editor.buildEditModel !== 'function') {
      return false;
    }
    try {
      const model = editor.buildEditModel(index, view, item, {});
      return Boolean(model && model.ok && model.source && model.source.path);
    } catch (err) {
      return false;
    }
  }

  function renderTextProposalAction(selected, state) {
    if (!selected || !state.model || !canEditTextProposal(selected.view)) {
      return '';
    }
    const result = previewTextReplacement(state.model.index, selected.view, selected.item);
    const disabled = !result.ok && result.status === 'unsupported';
    const status = state.textActionMessage || textProposalSummary(result);
    const diagnostics = ensureArray(result.diagnostics).slice(0, 3).map((diag) => {
      return badge(diag.severity || 'warning', diag.severity || 'warning') + ' ' +
        escapeHtml(diag.code || '') + '<br>' + escapeHtml(diag.message || '');
    });
    return [
      '<div class="inspector-actions" data-edit-text-panel="true">',
      '<button class="draft-action-button" type="button" data-edit-text-proposal="true"' +
        (disabled ? ' disabled' : '') + '>' + escapeHtml(t('textProposal.actionButton', 'Edit Text Proposal')) + '</button>',
      '<div class="draft-action-status">' + escapeHtml(status) + '</div>',
      renderExtractionScope(result),
      diagnostics.length ? renderMiniSection(t('textProposal.notesTitle', 'Text proposal notes'), diagnostics) : '',
      '</div>'
    ].join('');
  }

  function renderExtractionScope(result) {
    if (!result) {
      return '';
    }
    const captured = ensureArray(result.captured).filter(Boolean);
    const notCaptured = ensureArray(result.notCaptured).filter(Boolean);
    if (!captured.length && !notCaptured.length) {
      return '';
    }
    return [
      '<div class="extraction-scope">',
      captured.length ? renderMiniSection(t('textProposal.capturedTitle', 'Captured by Studio'), captured.map((item) => escapeHtml(item))) : '',
      notCaptured.length ? renderMiniSection(t('textProposal.notCapturedTitle', 'Not captured yet'), notCaptured.map((item) => escapeHtml(item))) : '',
      '</div>'
    ].join('');
  }

  function canEditTextProposal(view) {
    return view === 'scenes' || view === 'events' || view === 'cards' || view === 'news' || view === 'surfaceText' || view === 'textCorpus';
  }

  function previewDraftExtraction(index, view, item) {
    const bridge = global.ProjectMapDraftExtract;
    if (!bridge || typeof bridge.extractDraftFromItem !== 'function') {
      return {
        ok: false,
        status: 'unsupported',
        diagnostics: [{
          severity: 'warning',
          code: 'draft_extract.unavailable',
          message: 'Draft extraction helper is not loaded.'
        }]
      };
    }
    try {
      return bridge.extractDraftFromItem(index, view, item, {});
    } catch (err) {
      return {
        ok: false,
        status: 'unsupported',
        diagnostics: [{
          severity: 'warning',
          code: 'draft_extract.failed',
          message: err && err.message ? err.message : String(err)
        }]
      };
    }
  }

  function previewTextReplacement(index, view, item, options) {
    const bridge = global.ProjectMapDraftExtract;
    if (!bridge || typeof bridge.textReplacementDraftFromItem !== 'function') {
      return {
        ok: false,
        status: 'unsupported',
        diagnostics: [{
          severity: 'warning',
          code: 'draft_extract.text_unavailable',
          message: 'Text replacement helper is not loaded.'
        }]
      };
    }
    try {
      return bridge.textReplacementDraftFromItem(index, view, item, options || {});
    } catch (err) {
      return {
        ok: false,
        status: 'unsupported',
        diagnostics: [{
          severity: 'warning',
          code: 'draft_extract.text_failed',
          message: err && err.message ? err.message : String(err)
        }]
      };
    }
  }

  function draftActionSummary(result) {
    if (!result || result.status === 'unsupported') {
      return t('draftAction.summary.unsupported', 'This row cannot be converted into a Studio draft yet.');
    }
    if (result.status === 'ide_escape_hatch') {
      return t('draftAction.summary.ide', 'Creates an IDE guidance draft; Studio will not pretend this is safely editable.');
    }
    if (result.status === 'partial') {
      return t('draftAction.summary.partial', 'Creates a best-effort draft seed. Review source notes before exporting.');
    }
    return t('draftAction.summary.ok', 'Creates a draft proposal in Create mode. Nothing is installed automatically.');
  }

  function textProposalSummary(result) {
    if (!result || result.status === 'unsupported') {
      return t('textProposal.summary.unsupported', 'This row cannot seed a text proposal yet.');
    }
    if (!result.ok) {
      return t('textProposal.summary.sourceNeeded', 'This row needs more source evidence before Studio can seed a text proposal.');
    }
    if (result.status === 'ide_escape_hatch') {
      return t('textProposal.summary.manual', 'Creates a text replacement proposal with IDE guidance; no automatic source edit.');
    }
    return t('textProposal.summary.guarded', 'Creates a guarded text replacement proposal in Edit Text mode.');
  }

  function handleEditAsDraft(state, elements) {
    if (!state.selected || !state.model || !canEditAsDraft(state.selected.view)) {
      return;
    }
    const result = previewDraftExtraction(state.model.index, state.selected.view, state.selected.item);
    if (!result.ok && result.status === 'unsupported') {
      state.draftActionMessage = draftActionSummary(result);
      render(state, elements);
      return;
    }
    const opened = openDraftInCreate(result.template, result.draft, result);
    state.draftActionMessage = opened
      ? t('draftAction.status.loaded', 'Draft loaded in Create mode as {template}. Export remains proposal-only.').replace('{template}', result.template || 'draft')
      : t('draftAction.status.openFailed', 'Could not open Create template for this draft.');
    state.textActionMessage = '';
    render(state, elements);
  }

  function handleEditExisting(state, elements) {
    if (!state.selected || !state.model || !canEditExisting(state.selected.view)) {
      return;
    }
    const editor = global.ProjectMapExistingSceneEditor;
    if (!editor || typeof editor.openFromSelection !== 'function') {
      showError(elements, t('existingScene.unavailable', 'Existing Scene Editor is not loaded.'));
      return;
    }
    const opened = editor.openFromSelection(state.model.index, state.selected.view, state.selected.item);
    state.draftActionMessage = opened
      ? t('existingScene.loaded', 'Existing scene edit opened in Create. Save it to My Changes when ready.')
      : t('existingScene.openFailed', 'This scene needs more source evidence before Studio can edit it here.');
    state.textActionMessage = '';
    render(state, elements);
  }

  function handleEditTextProposal(state, elements) {
    if (!state.selected || !state.model || !canEditTextProposal(state.selected.view)) {
      return;
    }
    const replacementText = currentTextReplacementValue(elements);
    if (state.selected.view === 'textCorpus' && replacementText === String(state.selected.item && state.selected.item.text || '')) {
      state.textActionMessage = t('textProposal.status.needsChange', 'Change the replacement text to create a proposal.');
      render(state, elements);
      return;
    }
    const result = previewTextReplacement(state.model.index, state.selected.view, state.selected.item, {
      replacementText,
    });
    if (!result.ok) {
      state.textActionMessage = textProposalSummary(result);
      render(state, elements);
      return;
    }
    const opened = openDraftInCreate(result.template, result.draft, result);
    state.textActionMessage = opened
      ? t('textProposal.status.loaded', 'Text proposal loaded in Edit Text mode. Nothing is installed automatically.')
      : t('textProposal.status.openFailed', 'Could not open Edit Text proposal template.');
    state.draftActionMessage = '';
    render(state, elements);
  }

  function handleEventWorkbenchAction(state, elements, action) {
    if (!state.selected || !state.model) {
      return;
    }
    const core = global.ProjectMapEventWorkbench;
    if (!core || typeof core.buildActionDraft !== 'function') {
      showError(elements, t('eventWorkbench.actionHelperMissing', 'Event Workbench action helper is not loaded.'));
      return;
    }
    const sceneOrItem = eventWorkbenchSeedForSelection(state.selected, state.model);
    const result = core.buildActionDraft(state.model.index, sceneOrItem, action, {locale: currentLocale()});
    if (!result || !result.ok || !result.draft) {
      const message = result && result.diagnostics && result.diagnostics[0]
        ? result.diagnostics[0].message
        : t('eventWorkbench.actionDraftFailed', 'Could not create a draft from this event action.');
      showError(elements, message);
      return;
    }
    const opened = openDraftInCreate(result.template, result.draft, result);
    if (opened) {
      setStatus(elements, eventWorkbenchActionStatus(action, result.template));
      state.draftActionMessage = '';
      state.textActionMessage = '';
    } else {
      showError(elements, t('eventWorkbench.openCreateFailed', 'Could not open the Create template for this Event Workbench action.'));
    }
  }

  function eventWorkbenchSeedForSelection(selected, model) {
    if (!selected) {
      return null;
    }
    if (selected.view === 'news' && selected.item && selected.item.delivery === 'legacy_event_popup') {
      return selected.item;
    }
    return sceneFromSelection(selected.item, model) || selected.item;
  }

  function eventWorkbenchActionStatus(action, template) {
    if (action === 'edit_text') {
      return t('eventWorkbench.status.text', 'Text proposal loaded in Create. Nothing is installed automatically.');
    }
    if (action === 'copy_alt_timeline') {
      return t('eventWorkbench.status.alternate', 'Alternate timeline event draft loaded in Create. Review before export.');
    }
    if (action === 'follow_up') {
      return t('eventWorkbench.status.followup', 'Follow-up event draft loaded in Create. Review before export.');
    }
    return t('eventWorkbench.status.generic', 'Draft loaded in Create as {template}.').replace('{template}', template || 'draft');
  }

  function currentTextReplacementValue(elements) {
    const input = elements && elements.inspector
      ? elements.inspector.querySelector('[data-text-revision-input]')
      : null;
    return input ? input.value : '';
  }

  function openDraftInCreate(template, draft, result) {
    const templateKey = template || '';
    activateMode('create');
    activateCreateTemplate(templateKey);
    const meta = {source: 'Explore Edit as Draft', extraction: result};
    if (templateKey === 'event' && global.ProjectMapWizard && typeof global.ProjectMapWizard.loadDraft === 'function') {
      global.ProjectMapWizard.loadDraft(draft, meta);
      return true;
    }
    if (templateKey === 'news' && global.ProjectMapNewsWizard && typeof global.ProjectMapNewsWizard.loadDraft === 'function') {
      global.ProjectMapNewsWizard.loadDraft(draft, meta);
      return true;
    }
    if (templateKey === 'card' && global.ProjectMapCardWizard && typeof global.ProjectMapCardWizard.loadDraft === 'function') {
      global.ProjectMapCardWizard.loadDraft(draft, meta);
      return true;
    }
    if (templateKey === 'surface' && global.ProjectMapSurfaceTextWizard && typeof global.ProjectMapSurfaceTextWizard.loadDraft === 'function') {
      global.ProjectMapSurfaceTextWizard.loadDraft(draft, meta);
      return true;
    }
    if (templateKey === 'entry' && global.ProjectMapEntrySidebarWizard && typeof global.ProjectMapEntrySidebarWizard.loadDraft === 'function') {
      global.ProjectMapEntrySidebarWizard.loadDraft(draft, meta);
      return true;
    }
    if (templateKey === 'project' && global.ProjectMapProjectMetadataWizard && typeof global.ProjectMapProjectMetadataWizard.loadDraft === 'function') {
      global.ProjectMapProjectMetadataWizard.loadDraft(draft, meta);
      return true;
    }
    return false;
  }

  function activateMode(mode) {
    const button = global.document && global.document.querySelector('[data-mode="' + mode + '"]');
    if (button && typeof button.click === 'function') {
      button.click();
    }
  }

  function openDesignSelectionInExplore(detail, state, elements) {
    if (!state.model) {
      return;
    }
    const view = VIEW_DEFS[detail.view] ? detail.view : 'scenes';
    activateMode('explore');
    state.view = view;
    state.query = '';
    state.sortField = VIEW_DEFS[view].defaultSort;
    state.sortDir = view === 'overview' ? 'desc' : 'asc';
    state.draftActionMessage = '';
    state.textActionMessage = '';
    elements.search.value = '';
    const items = filterAndSortItems(state.model, view, '', state.sortField, state.sortDir);
    const found = items.find((row) => designRowMatches(row.raw, detail.item));
    if (found) {
      state.selectedKey = found.key;
      state.selected = {view, item: found.raw, normalized: found};
      setStatus(elements, t('design.openedInExplore', 'Opened {view} from Design.').replace('{view}', viewLabel(view)));
    } else {
      state.selectedKey = null;
      state.selected = null;
      showError(elements, t('design.openExploreFailed', 'Could not find a matching Explore row for the selected Design item.'));
    }
    render(state, elements);
  }

  function designRowMatches(row, item) {
    if (!row || !item) {
      return false;
    }
    if (row === item) {
      return true;
    }
    if (row.id && item.id && String(row.id) === String(item.id)) {
      return true;
    }
    if (row.id && item.sceneId && String(row.id) === String(item.sceneId)) {
      return true;
    }
    if (row.source && item.source && sourceLabel(row.source) === sourceLabel(item.source)) {
      return true;
    }
    if (row.headline && item.headline && row.headline === item.headline) {
      return true;
    }
    return false;
  }

  function activateCreateTemplate(template) {
    const button = global.document && global.document.querySelector('[data-create-template="' + template + '"]');
    if (button && typeof button.click === 'function') {
      button.click();
    }
  }

  function sceneFromSelection(item, model) {
    if (!item) {
      return null;
    }
    if (item.scene) {
      return item.scene;
    }
    if (item.id && model.scenesById.has(String(item.id))) {
      return model.scenesById.get(String(item.id));
    }
    return null;
  }

  function renderSourceButton(source) {
    if (!source) {
      return '';
    }
    return '<button class="source-button" type="button" data-source-json="' +
      escapeAttr(JSON.stringify(source)) + '">' + escapeHtml(sourceLabel(source)) + '</button>';
  }

  function renderSceneInspector(scene, model) {
    if (!scene) {
      return '<div class="empty-state">Scene not found.</div>';
    }
    const graph = graphRowsForScene(model, scene.id);
    const outgoing = graph.outgoing.slice(0, 24);
    const incoming = graph.incoming.slice(0, 24);
    const diagnostics = ensureArray(model.diagnosticsByScene.get(String(scene.id))).slice(0, 12);
    const confidence = scene.classificationConfidence || scene.confidence || 'profile_heuristic';
    return [
      '<h2 class="inspector-title">' + escapeHtml(scene.id || '(missing id)') + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(scene.title || scene.path || '') + '</div>',
      '<div class="badge-line">',
      badge(scene.type || 'scene', ''),
      badge(confidence, confidence),
      ensureArray(scene.tags).map((tag) => badge(tag, '')).join(''),
      '</div>',
      '<dl class="kv">',
      '<dt>' + escapeHtml(t('inspector.path', 'Path')) + '</dt><dd>' + escapeHtml(scene.path || '') + '</dd>',
      '<dt>' + escapeHtml(t('inspector.source', 'Source')) + '</dt><dd>' + renderSourceButton(scene.sourceSpan) + '</dd>',
      '<dt>' + escapeHtml(t('inspector.sections', 'Sections')) + '</dt><dd>' + escapeHtml(ensureArray(scene.sections).length) + '</dd>',
      '<dt>' + escapeHtml(t('inspector.options', 'Options')) + '</dt><dd>' + escapeHtml(ensureArray(scene.options).length) + '</dd>',
      '</dl>',
      renderEdgeSection(t('inspector.outgoing', 'Outgoing'), outgoing),
      renderEdgeSection(t('inspector.incoming', 'Incoming'), incoming),
      renderMiniSection(t('inspector.diagnostics', 'Diagnostics'), diagnostics.map(renderDiagnosticMini))
    ].join('');
  }

  function renderEventWorkbenchInspector(sceneOrItem, model) {
    if (!model || !sceneOrItem || !isEventWorkbenchCandidate(sceneOrItem)) {
      return '';
    }
    const core = global.ProjectMapEventWorkbench;
    const ui = global.ProjectMapEventWorkbenchUi;
    if (!core || !ui || typeof core.buildEventWorkbench !== 'function' || typeof ui.renderEventWorkbench !== 'function') {
      return '';
    }
    const index = model.index || {};
    const workbench = core.buildEventWorkbench(index, sceneOrItem, {locale: currentLocale()});
    if (!workbench || !workbench.sceneId || !workbench.playerText) {
      return '';
    }
    return ui.renderEventWorkbench(workbench, {locale: currentLocale(), eyebrow: t('eventWorkbench.eyebrow', 'Event Workbench')}) +
      '<div class="inspector-actions existing-scene-workbench-actions">' +
      '<button class="draft-action-button" type="button" data-edit-existing="true">' + escapeHtml(t('existingScene.editExisting', 'Edit existing')) + '</button>' +
      '<button class="draft-action-button" type="button" data-edit-as-draft="true">' + escapeHtml(t('existingScene.copyAsNew', 'Copy as new proposal')) + '</button>' +
      '</div>';
  }

  function isEventWorkbenchCandidate(item) {
    if (!item) {
      return false;
    }
    if (item.delivery === 'legacy_event_popup' && item.linkedSceneId) {
      return true;
    }
    const type = String(item.type || (item.scene && item.scene.type) || '');
    const tags = ensureArray(item.tags || (item.scene && item.scene.tags));
    return type === 'event' || tags.includes('event');
  }

  function renderVariableInspector(variable) {
    const reads = ensureArray(variable.reads).slice(0, 16).map((source) => renderSourceButton(source));
    const writes = ensureArray(variable.writes).slice(0, 16).map((source) => renderSourceButton(source));
    return [
      '<h2 class="inspector-title">' + escapeHtml(variable.name || t('inspector.unnamedVariable', '(unnamed variable)')) + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(t('inspector.qVariable', 'Q variable')) + '</div>',
      '<div class="badge-line">',
      badge(variable.confidence || 'static_inferred', variable.confidence || 'static_inferred'),
      ensureArray(variable.tags).map((tag) => badge(tag, '')).join(''),
      '</div>',
      '<dl class="kv">',
      '<dt>' + escapeHtml(t('inspector.scope', 'Scope')) + '</dt><dd>' + escapeHtml(variable.scope || 'q') + '</dd>',
      '<dt>' + escapeHtml(t('inspector.reads', 'Reads')) + '</dt><dd>' + escapeHtml(variable.readCount || 0) + '</dd>',
      '<dt>' + escapeHtml(t('inspector.writes', 'Writes')) + '</dt><dd>' + escapeHtml(variable.writeCount || 0) + '</dd>',
      '</dl>',
      renderMiniSection(t('inspector.readRefs', 'Read refs'), reads),
      renderMiniSection(t('inspector.writeRefs', 'Write refs'), writes)
    ].join('');
  }

  function renderCoverageInspector(item) {
    return [
      '<h2 class="inspector-title">' + escapeHtml(coverageField(item, 'label') || item.id || 'Coverage') + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(t('coverage.authoringCoverage', 'Authoring coverage')) + '</div>',
      '<div class="badge-line">',
      badge(item.coverageLabel || item.coverageLevel || 'unknown', coverageClass(item.coverageLevel)),
      item.releasePriority ? badge(coveragePriorityLabel(item.releasePriority), priorityClass(item.releasePriority)) : '',
      item.noCodeCompletion ? badge(noCodeCompletionLabel(item.noCodeCompletion), completionClass(item.noCodeCompletion)) : '',
      badge(coverageCountBadge('safe', item.safeApplyCount), 'info'),
      badge(coverageCountBadge('manual', item.manualReviewCount), 'warning'),
      item.unsupportedCount ? badge(coverageCountBadge('unsupported', item.unsupportedCount), 'opaque') : '',
      '</div>',
      '<dl class="kv">',
      '<dt>' + escapeHtml(t('coverage.rows', 'Rows')) + '</dt><dd>' + escapeHtml(item.count || 0) + '</dd>',
      '<dt>' + escapeHtml(t('coverage.feedbackPriority', 'Feedback priority')) + '</dt><dd>' + escapeHtml(coveragePriorityLabel(item.releasePriority)) + '</dd>',
      '<dt>' + escapeHtml(t('coverage.noCodeCompletion', 'No-code completion')) + '</dt><dd>' + escapeHtml(coverageCompletionLabel(item.noCodeCompletion)) + '</dd>',
      '<dt>' + escapeHtml(t('coverage.studioPath', 'Studio path')) + '</dt><dd>' + escapeHtml(coverageField(item, 'studioPath')) + '</dd>',
      '<dt>' + escapeHtml(t('coverage.canDo', 'Can do in Studio')) + '</dt><dd>' + escapeHtml(coverageField(item, 'userCanDo')) + '</dd>',
      '<dt>' + escapeHtml(t('coverage.authoring', 'Authoring')) + '</dt><dd>' + escapeHtml(coverageField(item, 'authoringStatus')) + '</dd>',
      '<dt>' + escapeHtml(t('coverage.install', 'Install')) + '</dt><dd>' + escapeHtml(coverageField(item, 'installStatus')) + '</dd>',
      '</dl>',
      renderMiniSection(t('coverage.beginnerWorkflow', 'Beginner workflow'), coverageWorkflowSteps(item).map((step) => escapeHtml(step))),
      renderMiniSection(t('coverage.remainingGap', 'Remaining gap'), [escapeHtml(coverageField(item, 'remainingGap') || item.notes || '')]),
      renderMiniSection(t('coverage.recommendedNextAction', 'Recommended next action'), [escapeHtml(coverageField(item, 'nextAction') || '')])
    ].join('');
  }

  function renderDiagnosticInspector(diag, model) {
    const note = diag.code === 'project_map.regex_only_goto'
      ? '<div class="edge-item">Authoring warning: static text scan found a go-to line that the parser did not expose as metadata.</div>'
      : '';
    const scene = diag.sceneId && model.scenesById.get(String(diag.sceneId));
    return [
      '<h2 class="inspector-title">' + escapeHtml(diag.code || 'diagnostic') + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(diag.message || '') + '</div>',
      '<div class="badge-line">',
      badge(diag.severity || 'info', diag.severity || 'info'),
      badge(diag.confidence || 'opaque', diag.confidence || 'opaque'),
      '</div>',
      '<dl class="kv">',
      '<dt>Scene</dt><dd>' + escapeHtml(diag.sceneId || '') + '</dd>',
      '<dt>Path</dt><dd>' + escapeHtml(diag.path || '') + '</dd>',
      '<dt>Source</dt><dd>' + renderSourceButton(diag.source) + '</dd>',
      '</dl>',
      note,
      scene ? renderMiniSection('Related scene', [escapeHtml(scene.id) + ' - ' + escapeHtml(scene.title || scene.path || '')]) : ''
    ].join('');
  }

  function renderNewsInspector(news) {
    if (news.delivery === 'legacy_event_popup') {
      const router = news.router || {};
      return [
        '<h2 class="inspector-title">' + escapeHtml(news.headline || '(untitled monthly popup)') + '</h2>',
        '<div class="inspector-subtitle">' + escapeHtml(t('news.popupSubtitle', 'Monthly event popup via #event')) + '</div>',
        '<div class="badge-line">',
        badge(t('news.monthlyPopupBadge', 'monthly_popup'), 'info'),
        badge(news.confidence || 'static_inferred', news.confidence || 'static_inferred'),
        '</div>',
        news.description || news.excerpt ? '<p class="inspector-note">' + escapeHtml(news.description || news.excerpt) + '</p>' : '',
        '<dl class="kv">',
        '<dt>' + escapeHtml(t('news.linkedScene', 'Linked scene')) + '</dt><dd>' + (news.linkedSceneId ? '<button type="button" data-scene-id="' + escapeAttr(news.linkedSceneId) + '">' + escapeHtml(news.linkedSceneId) + '</button>' : '') + '</dd>',
        '<dt>' + escapeHtml(t('news.when', 'When')) + '</dt><dd>' + escapeHtml(news.viewIf || '') + '</dd>',
        '<dt>' + escapeHtml(t('news.router', 'Router')) + '</dt><dd>' + escapeHtml([router.anchor, router.tag ? '#' + router.tag : ''].filter(Boolean).join(' / ')) + '</dd>',
        '<dt>' + escapeHtml(t('news.source', 'Source')) + '</dt><dd>' + renderSourceButton(news.source) + '</dd>',
        news.excerptSource ? '<dt>' + escapeHtml(t('news.excerptSource', 'Excerpt')) + '</dt><dd>' + renderSourceButton(news.excerptSource) + '</dd>' : '',
        '</dl>'
      ].join('');
    }
    return [
      '<h2 class="inspector-title">' + escapeHtml(news.headline || '(untitled news)') + '</h2>',
      '<div class="inspector-subtitle">News pool item</div>',
      '<div class="badge-line">' + badge(news.confidence || 'static_inferred', news.confidence || 'static_inferred') + '</div>',
      '<dl class="kv">',
      '<dt>Source</dt><dd>' + renderSourceButton(news.source) + '</dd>',
      '</dl>'
    ].join('');
  }

  function renderSurfaceTextInspector(item) {
    return [
      '<h2 class="inspector-title">' + escapeHtml(item.label || '(missing label)') + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(item.area || 'Surface text') + '</div>',
      '<div class="badge-line">',
      badge(item.editability || 'ide_escape_hatch', item.editability || ''),
      badge(item.confidence || 'static_inferred', item.confidence || 'static_inferred'),
      '</div>',
      '<dl class="kv">',
      '<dt>Source</dt><dd>' + renderSourceButton(item.source) + '</dd>',
      '<dt>Variable</dt><dd>' + escapeHtml(item.variableName || '') + '</dd>',
      '<dt>Editability</dt><dd>' + escapeHtml(item.editability || '') + '</dd>',
      '<dt>Reason</dt><dd>' + escapeHtml(item.reason || '') + '</dd>',
      '</dl>',
      item.originalText
        ? renderMiniSection('Original text', ['<code>' + escapeHtml(item.originalText) + '</code>'])
        : ''
    ].join('');
  }

  function renderTextCorpusInspector(item, model, state) {
    const owner = item.owner || {};
    const replacement = textRevisionReplacementFor(state, item);
    const ownerButton = owner.sceneId
      ? '<button type="button" data-scene-id="' + escapeAttr(owner.sceneId) + '">' + escapeHtml(t('textCorpus.openOwner', 'Open owner scene')) + '</button>'
      : '';
    const contextRows = textCorpusContextRows(model, item).map((row) => {
      const selected = row.id === item.id ? ' is-current' : '';
      return '<div class="text-context-row' + selected + '">' +
        '<span>' + escapeHtml(textCorpusRoleLabel(row.role)) + '</span>' +
        '<b>' + escapeHtml(sourceLabel(row.source)) + '</b>' +
        '<p>' + escapeHtml(row.text || '') + '</p>' +
        '</div>';
    });
    const roleGuidance = textCorpusRoleGuidance(item.role);
    return [
      '<h2 class="inspector-title">' + escapeHtml(item.text || '(empty text)') + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(t('textCorpus.subtitle', 'Player-visible text')) + '</div>',
      '<div class="badge-line">',
      badge(item.role || 'text', ''),
      badge(item.editability || 'text_proposal', item.editability || ''),
      badge(item.confidence || 'static_inferred', item.confidence || 'static_inferred'),
      '</div>',
      ensureArray(item.conditions).length
        ? '<div class="detail-section"><h3>' + escapeHtml(t('textCorpus.conditions', 'Conditions')) + '</h3><pre class="code-preview">' + escapeHtml(ensureArray(item.conditions).join('\n')) + '</pre></div>'
        : '',
      '<dl class="kv">',
      '<dt>' + escapeHtml(t('textCorpus.role', 'Role')) + '</dt><dd>' + escapeHtml(textCorpusRoleLabel(item.role)) + '</dd>',
      '<dt>' + escapeHtml(t('textCorpus.editability', 'Editability')) + '</dt><dd>' + escapeHtml(textCorpusEditabilityLabel(item.editability)) + '</dd>',
      '<dt>' + escapeHtml(t('textCorpus.owner', 'Owner')) + '</dt><dd>' + escapeHtml([owner.kind, owner.sceneId || owner.itemId, owner.sectionId, owner.area].filter(Boolean).join(' / ')) + '</dd>',
      '<dt>' + escapeHtml(t('textCorpus.source', 'Source')) + '</dt><dd>' + renderSourceButton(item.source) + '</dd>',
      ownerButton ? '<dt>' + escapeHtml(t('textCorpus.ownerAction', 'Owner')) + '</dt><dd>' + ownerButton + '</dd>' : '',
      roleGuidance ? '<dt>' + escapeHtml(t('textCorpus.guidance', 'Guidance')) + '</dt><dd>' + escapeHtml(roleGuidance) + '</dd>' : '',
      '</dl>',
      renderTextRevisionPanel(item, replacement, state),
      contextRows.length ? '<div class="detail-section"><h3>' + escapeHtml(t('textCorpus.context', 'Nearby text')) + '</h3><div class="text-context-list">' + contextRows.join('') + '</div></div>' : '',
      '<p class="inspector-note">' + escapeHtml(t('textCorpus.note', 'Text Corpus is an inspection index: use it to find player-facing prose, then create a proposal or jump to the owning source.')) + '</p>'
    ].join('');
  }

  function renderTextRevisionPanel(item, replacement, state) {
    const key = textRevisionKey(item);
    const model = buildTextRevisionModel(item, replacement);
    const result = state && state.model
      ? previewTextReplacement(state.model.index, 'textCorpus', item, {replacementText: model.after})
      : null;
    const disabled = !model.changed || (result ? (!result.ok && result.status === 'unsupported') : true);
    const status = state && state.textActionMessage
      ? state.textActionMessage
      : model.changed
        ? textProposalSummary(result)
        : t('textProposal.status.needsChange', 'Change the replacement text to create a proposal.');
    const diagnostics = ensureArray(result && result.diagnostics).slice(0, 3).map((diag) => {
      return badge(diag.severity || 'warning', diag.severity || 'warning') + ' ' +
        escapeHtml(diag.code || '') + '<br>' + escapeHtml(diag.message || '');
    });
    return [
      '<div class="detail-section text-revision-panel" data-text-revision-panel="true">',
      '<h3>' + escapeHtml(t('textRevision.title', 'Revision draft')) + '</h3>',
      '<label class="text-revision-label">',
      '<span>' + escapeHtml(t('textRevision.afterLabel', 'Replacement text')) + '</span>',
      '<textarea rows="5" data-text-revision-input="true" data-text-revision-key="' + escapeAttr(key) + '">' + escapeHtml(model.after) + '</textarea>',
      '</label>',
      '<div class="text-revision-status" data-text-revision-status="true">' + escapeHtml(textRevisionStatusLabel(model)) + '</div>',
      '<div class="text-revision-diff" data-text-revision-diff="true">' + renderTextRevisionDiff(model) + '</div>',
      '<div class="text-revision-actions" data-edit-text-panel="true">',
      '<button class="draft-action-button" type="button" data-edit-text-proposal="true"' +
        (disabled ? ' disabled' : '') + '>' + escapeHtml(t('textRevision.actionButton', 'Edit Text Proposal')) + '</button>',
      '<div class="draft-action-status">' + escapeHtml(status) + '</div>',
      renderExtractionScope(result),
      diagnostics.length ? renderMiniSection(t('textProposal.notesTitle', 'Text proposal notes'), diagnostics) : '',
      '</div>',
      '</div>'
    ].join('');
  }

  function updateTextRevisionDom(root, item, replacement, state) {
    const model = buildTextRevisionModel(item, replacement);
    const status = root.querySelector('[data-text-revision-status]');
    const diff = root.querySelector('[data-text-revision-diff]');
    const action = root.querySelector('[data-edit-text-proposal]');
    const actionStatus = root.querySelector('[data-text-action-status]');
    if (status) {
      status.textContent = textRevisionStatusLabel(model);
    }
    if (diff) {
      diff.innerHTML = renderTextRevisionDiff(model);
    }
    if (action || actionStatus) {
      const result = state && state.model
        ? previewTextReplacement(state.model.index, 'textCorpus', item, {replacementText: model.after})
        : null;
      const disabled = !model.changed || (result ? (!result.ok && result.status === 'unsupported') : true);
      if (action) {
        action.disabled = disabled;
      }
      if (actionStatus) {
        actionStatus.textContent = model.changed
          ? textProposalSummary(result)
          : t('textProposal.status.needsChange', 'Change the replacement text to create a proposal.');
      }
    }
  }

  function renderTextRevisionDiff(model) {
    return ensureArray(model.diff).map((row) => {
      return '<div class="text-revision-row ' + escapeAttr(row.kind || '') + '">' +
        '<span>' + escapeHtml(row.label || '') + '</span>' +
        '<p>' + escapeHtml(row.text || '') + '</p>' +
        '</div>';
    }).join('');
  }

  function textRevisionStatusLabel(model) {
    if (!model.changed) {
      return t('textRevision.statusUnchanged', 'No changes yet.');
    }
    if (model.editability === 'ide_escape_hatch') {
      return t('textRevision.statusManual', 'Changed. This will export IDE guidance, not an automatic edit.');
    }
    if (model.editability === 'draft_extractable') {
      return t('textRevision.statusDraft', 'Changed. This can seed a draft/proposal for review.');
    }
    return t('textRevision.statusProposal', 'Changed. This will export a text proposal for review.');
  }

  function renderAssetInspector(item, model) {
    const asset = normalizeAssetForViewer(item, model && model.index);
    const source = firstSource(asset) || asset.source || {};
    const usage = ensureArray(asset.usageRefs);
    return [
      '<h2 class="inspector-title">' + escapeHtml(asset.name || asset.path || asset.id || '(unnamed asset)') + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(t('assets.subtitle', 'Image / audio asset reference')) + '</div>',
      '<div class="badge-line">',
      badge(asset.type || 'asset', asset.type || ''),
      badge(asset.sourceKind || 'source_asset', asset.sourceKind || ''),
      badge(asset.status && asset.status.key || asset.editability || 'reference_only', asset.status && asset.status.key || asset.editability || ''),
      usage.length ? badge(t('assets.usedCount', 'used ') + usage.length, 'info') : '',
      badge(asset.confidence || 'static_inferred', asset.confidence || 'static_inferred'),
      '</div>',
      renderAssetPreviewFrame(asset, 'inspector'),
      renderAssetReferenceHelper(asset),
      renderAssetUseActions(asset),
      renderAssetRepairActions(asset),
      usage.length ? renderAssetUsageList(usage) : '<p class="inspector-note">' + escapeHtml(t('assets.noUsage', 'No indexed usage references yet.')) + '</p>',
      '<dl class="kv">',
      '<dt>' + escapeHtml(t('assets.path', 'Path')) + '</dt><dd>' + escapeHtml(asset.path || '') + '</dd>',
      '<dt>' + escapeHtml(t('assets.type', 'Type')) + '</dt><dd>' + escapeHtml(labelForBadge(asset.type || '')) + '</dd>',
      '<dt>' + escapeHtml(t('assets.extension', 'Extension')) + '</dt><dd>' + escapeHtml(asset.extension || '') + '</dd>',
      '<dt>' + escapeHtml(t('assets.size', 'Size')) + '</dt><dd>' + escapeHtml(asset.sizeBytes === undefined ? '' : String(asset.sizeBytes) + ' bytes') + '</dd>',
      '<dt>' + escapeHtml(t('assets.sourceKind', 'Source kind')) + '</dt><dd>' + escapeHtml(labelForBadge(asset.sourceKind || '')) + '</dd>',
      '<dt>' + escapeHtml(t('assets.source', 'Source')) + '</dt><dd>' + renderSourceButton(source) + '</dd>',
      '</dl>',
      '<p class="inspector-note">' + escapeHtml(t('assets.manualNote', 'Asset indexing is read-only for now. Studio can reference this path in previews, but it does not copy, optimize, or install asset files yet.')) + '</p>'
    ].join('');
  }

  function renderAssetUseActions(asset) {
    const api = assetModelApi();
    const ref = api && typeof api.assetDraftReference === 'function'
      ? api.assetDraftReference(asset || {})
      : {path: asset && asset.path || '', type: asset && asset.type || 'asset', label: asset && (asset.label || asset.name) || ''};
    if (!ref.path) {
      return '';
    }
    const payload = escapeAttr(JSON.stringify(ref));
    return [
      '<section class="asset-use-actions">',
      '<div class="preview-heading">' + escapeHtml(t('assets.useInDraft', 'Use in draft')) + '</div>',
      '<div class="asset-use-action-row">',
      '<button type="button" data-asset-action="use-in-draft" data-asset-target="event" data-asset-ref="' + payload + '">' + escapeHtml(t('assets.useInEventDraft', 'Use in Event draft')) + '</button>',
      '<button type="button" data-asset-action="use-in-draft" data-asset-target="card" data-asset-ref="' + payload + '">' + escapeHtml(t('assets.useInCardDraft', 'Use in Card draft')) + '</button>',
      '<button type="button" data-asset-action="copy-asset-ref" data-asset-ref="' + payload + '">' + escapeHtml(t('assets.copyReference', 'Copy asset ref')) + '</button>',
      '</div>',
      '<p>' + escapeHtml(t('assets.useInDraftNote', 'Adds only an assetRefs reference for preview; Studio does not copy or install asset files.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderAssetRepairActions(asset) {
    const state = asset && asset.referenceState && asset.referenceState.key || '';
    if (state !== 'file_missing' && state !== 'missing') {
      return '';
    }
    const targetPath = asset && (asset.path || asset.id || '') || '';
    if (!targetPath) {
      return '';
    }
    return [
      '<section class="asset-repair-actions">',
      '<div class="preview-heading">' + escapeHtml(t('assets.repairMissingFile', 'Provide missing file')) + '</div>',
      '<p>' + escapeHtml(t('assets.repairMissingFileNote', 'Choose a local image or audio file to create an asset install proposal for this missing reference.')) + '</p>',
      '<label>',
      '<span>' + escapeHtml(t('assets.repairAsEvent', 'Prepare for Event draft')) + '</span>',
      '<input type="file" accept="image/*,audio/*" data-asset-repair-file data-asset-repair-target="event" data-asset-repair-path="' + escapeAttr(targetPath) + '">',
      '</label>',
      '<label>',
      '<span>' + escapeHtml(t('assets.repairAsCard', 'Prepare for Card draft')) + '</span>',
      '<input type="file" accept="image/*,audio/*" data-asset-repair-file data-asset-repair-target="card" data-asset-repair-path="' + escapeAttr(targetPath) + '">',
      '</label>',
      '</section>'
    ].join('');
  }

  function renderAssetManifest(refs, projectIndex) {
    const api = assetModelApi();
    const manifest = api && typeof api.buildAssetManifest === 'function'
      ? api.buildAssetManifest(refs || [], {projectIndex})
      : {items: ensureArray(refs), counts: {}, manualActions: []};
    const items = ensureArray(manifest.items);
    if (!items.length) {
      return [
        '<section class="asset-manifest">',
        '<div class="preview-heading">' + escapeHtml(t('assets.manifest', 'Asset manifest')) + '</div>',
        '<p class="inspector-note">' + escapeHtml(t('assets.manifestEmpty', 'No asset references in this draft yet.')) + '</p>',
        '</section>'
      ].join('');
    }
    return [
      '<section class="asset-manifest">',
      '<div class="preview-heading">' + escapeHtml(t('assets.manifest', 'Asset manifest')) + '</div>',
      '<div class="asset-manifest-list">',
      items.map(renderAssetManifestRow).join(''),
      '</div>',
      manifest.manualActions && manifest.manualActions.length
        ? '<ul class="asset-manifest-actions">' + manifest.manualActions.map((line) => '<li>' + escapeHtml(line) + '</li>').join('') + '</ul>'
        : '<p class="inspector-note">' + escapeHtml(t('assets.manifestOk', 'All referenced assets are indexed and no physical-file gaps were detected.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderAssetManifestRow(asset) {
    const state = asset.referenceState && asset.referenceState.key || 'unknown';
    return [
      '<div class="asset-manifest-row">',
      '<strong>' + escapeHtml(localizedAssetRoleLabel(asset) || asset.label || asset.path || '') + '</strong>',
      '<code>' + escapeHtml(asset.path || '') + '</code>',
      '<span class="badge-line">',
      renderBadge(asset.type || 'asset', asset.type || ''),
      renderBadge(state, state),
      '</span>',
      '</div>'
    ].join('');
  }

  function localizedAssetRoleLabel(asset) {
    const role = String(asset && asset.role || '').trim();
    if (!role) {
      return asset && asset.roleLabel || '';
    }
    return t('assets.role.' + role, asset && asset.roleLabel || role);
  }

  function handleAssetDraftAction(state, elements, button) {
    const action = button.dataset.assetAction || '';
    const assetRef = parseAssetActionRef(button.dataset.assetRef);
    if (!assetRef.path) {
      return;
    }
    if (action === 'copy-asset-ref') {
      copyText(JSON.stringify(assetRef));
      return;
    }
    if (action !== 'use-in-draft') {
      return;
    }
    const target = button.dataset.assetTarget === 'card' ? 'card' : 'event';
    const createButton = global.document && global.document.querySelector('[data-mode="create"]');
    if (createButton) {
      createButton.click();
    }
    const templateButton = global.document && global.document.querySelector('[data-create-template="' + target + '"]');
    if (templateButton) {
      templateButton.click();
    }
    global.document.dispatchEvent(new CustomEvent('ProjectMap:asset-reference-selected', {
      detail: {target, assetRef}
    }));
    if (elements && elements.statusText) {
      elements.statusText.textContent = target === 'card'
        ? t('assets.status.addedToCardDraft', 'Asset reference added to Card draft.')
        : t('assets.status.addedToEventDraft', 'Asset reference added to Event draft.');
    }
  }

  function handleAssetRepairFileSelection(state, elements, input) {
    const file = input.files && input.files[0];
    if (!file || !state.selected || state.selected.view !== 'assets') {
      return;
    }
    const asset = normalizeAssetForViewer(state.selected.item, state.model && state.model.index);
    const api = assetModelApi();
    if (!api || typeof api.assetRepairInstallRequest !== 'function') {
      return;
    }
    const target = input.dataset.assetRepairTarget === 'card' ? 'card' : 'event';
    const request = api.assetRepairInstallRequest(asset, {
      name: file.name,
      path: file.path || '',
      size: file.size,
      lastModified: file.lastModified
    }, {projectIndex: state.model && state.model.index});
    const role = target === 'card'
      ? ((request.type === 'audio') ? 'card_audio' : 'card_image')
      : ((request.type === 'audio') ? 'event_audio' : 'event_illustration');
    request.role = request.role === 'reference' ? role : request.role;
    request.roleLabel = api.assetRoleLabel ? api.assetRoleLabel(request.role) : request.role;
    const assetRef = {
      path: request.targetPath,
      type: request.type,
      label: request.label || file.name,
      role: request.role
    };
    const createButton = global.document && global.document.querySelector('[data-mode="create"]');
    if (createButton) {
      createButton.click();
    }
    const templateButton = global.document && global.document.querySelector('[data-create-template="' + target + '"]');
    if (templateButton) {
      templateButton.click();
    }
    global.document.dispatchEvent(new CustomEvent('ProjectMap:asset-install-request-selected', {
      detail: {target, assetRef, assetInstallRequest: request}
    }));
    setStatus(elements, t('assets.status.repairPrepared', 'Asset repair proposal added to Create.'));
  }

  function parseAssetActionRef(value) {
    try {
      const parsed = JSON.parse(String(value || '{}'));
      return {
        path: String(parsed.path || '').trim(),
        type: String(parsed.type || 'asset').trim(),
        label: String(parsed.label || parsed.name || '').trim(),
        role: String(parsed.role || '').trim()
      };
    } catch (_err) {
      return {path: '', type: 'asset', label: '', role: ''};
    }
  }

  function copyText(value) {
    const text = String(value || '');
    if (global.navigator && global.navigator.clipboard && typeof global.navigator.clipboard.writeText === 'function') {
      global.navigator.clipboard.writeText(text).catch(() => null);
    }
  }

  function renderAssetReferenceHelper(asset) {
    const api = assetModelApi();
    const helper = api && typeof api.renderReferenceHelper === 'function'
      ? api.renderReferenceHelper(asset || {})
      : String(asset && (asset.path || asset.id) || '');
    const referenceState = asset && asset.referenceState ? asset.referenceState : {};
    if (!helper) {
      return '';
    }
    return [
      '<section class="asset-reference-helper">',
      '<div class="preview-heading">' + escapeHtml(t('assets.referenceHelper', 'Reference helper')) + '</div>',
      '<code>' + escapeHtml(helper) + '</code>',
      '<p>' + escapeHtml(t('assets.referenceHelperNote', 'Use this path in draft assetRefs or notes; Studio will not install asset files automatically.')) + '</p>',
      referenceState.key ? '<span class="badge ' + escapeAttr(referenceState.key) + '">' + escapeHtml(assetReferenceStateLabel(referenceState.key)) + '</span>' : '',
      '</section>'
    ].join('');
  }

  function assetReferenceStateLabel(key) {
    const labels = {
      indexed: t('assets.referenceState.indexed', 'indexed'),
      missing: t('assets.referenceState.missing', 'missing asset'),
      file_missing: t('assets.referenceState.file_missing', 'file missing'),
      external: t('assets.referenceState.external', 'external asset'),
      unknown: t('assets.referenceState.unknown', 'unknown')
    };
    return labels[String(key || '')] || String(key || '');
  }

  function renderAssetPreviewFrame(asset, mode) {
    const capability = asset && asset.previewCapability ? asset.previewCapability : {};
    const mediaKind = capability.mediaKind || asset && asset.type || 'asset';
    const url = capability.url || asset && asset.path || '';
    const title = asset && (asset.label || asset.name || asset.path) || '';
    if (capability.canPreview && mediaKind === 'image') {
      return [
        '<figure class="asset-preview-frame asset-preview-image" data-asset-preview-mode="' + escapeAttr(mode || 'default') + '">',
        '<img src="' + escapeAttr(url) + '" alt="' + escapeAttr(title) + '" loading="lazy">',
        '<figcaption>' + escapeHtml(title || t('assets.previewImage', 'Image preview')) + '</figcaption>',
        '</figure>'
      ].join('');
    }
    if (capability.canPreview && mediaKind === 'audio') {
      return [
        '<figure class="asset-preview-frame asset-preview-audio" data-asset-preview-mode="' + escapeAttr(mode || 'default') + '">',
        '<audio controls preload="metadata" src="' + escapeAttr(url) + '"></audio>',
        '<figcaption>' + escapeHtml(title || t('assets.previewAudio', 'Audio preview')) + '</figcaption>',
        '</figure>'
      ].join('');
    }
    return [
      '<div class="asset-preview-frame asset-preview-empty" data-asset-preview-mode="' + escapeAttr(mode || 'default') + '">',
      '<span>' + escapeHtml(labelForBadge(mediaKind || 'asset')) + '</span>',
      '<p>' + escapeHtml(capability.message || t('assets.noPreview', 'Studio cannot directly preview this asset yet.')) + '</p>',
      '</div>'
    ].join('');
  }

  function renderAssetUsageList(usage) {
    return [
      '<section class="asset-usage-list">',
      '<div class="preview-heading">' + escapeHtml(t('assets.usage', 'Used by')) + '</div>',
      usage.map((ref) => [
        '<div class="asset-usage-row">',
        '<span>' + escapeHtml(labelForBadge(ref.kind || 'reference')) + '</span>',
        ref.id && ref.view === 'scenes'
          ? '<button class="source-button" type="button" data-scene-id="' + escapeAttr(ref.id) + '">' + escapeHtml(ref.label || ref.id) + '</button>'
          : '<strong>' + escapeHtml(ref.label || ref.id || ref.path || '') + '</strong>',
        '<span class="asset-usage-source">' + (ref.source ? renderSourceButton(ref.source) : '') + '</span>',
        '</div>'
      ].join('')).join(''),
      '</section>'
    ].join('');
  }

  function renderSourceInspector(source) {
    const excerpt = source.excerpt
      ? '<pre class="source-excerpt">' + escapeHtml(source.excerpt) + '</pre>'
      : escapeHtml(t('inspector.excerptMissing', '(not included in this index)'));
    return [
      '<h2 class="inspector-title">' + escapeHtml(t('inspector.sourceSpan', 'Source span')) + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(sourceLabel(source)) + '</div>',
      '<dl class="kv">',
      '<dt>' + escapeHtml(t('inspector.path', 'Path')) + '</dt><dd>' + escapeHtml(source.path || '') + '</dd>',
      '<dt>' + escapeHtml(t('inspector.line', 'Line')) + '</dt><dd>' + escapeHtml(source.line || source.startLine || '') + '</dd>',
      '<dt>' + escapeHtml(t('inspector.endLine', 'End line')) + '</dt><dd>' + escapeHtml(source.endLine || '') + '</dd>',
      '<dt>' + escapeHtml(t('inspector.excerpt', 'Excerpt')) + '</dt><dd>' + excerpt + '</dd>',
      '</dl>'
    ].join('');
  }

  function renderOverviewInspector(item, model) {
    const matching = ensureArray(item.examples).length
      ? ensureArray(item.examples)
      : model.diagnostics.filter((diag) => diag.code === item.code).slice(0, 12);
    const note = item.code === 'project_map.regex_only_goto'
      ? '<div class="edge-item">' + escapeHtml(t('inspector.regexGotoWarning', 'Authoring warning: these go-to refs came from static text scan because the parser did not expose them as metadata.')) + '</div>'
      : '';
    return [
      '<h2 class="inspector-title">' + escapeHtml(item.code) + '</h2>',
      '<div class="inspector-subtitle">' + escapeHtml(t('inspector.diagnosticCount', '{count} diagnostics').replace('{count}', item.count)) + '</div>',
      '<div class="badge-line">' +
      badge(item.severity || 'info', item.severity || 'info') +
      badge(item.confidence || 'mixed', item.confidence || '') +
      '</div>',
      note,
      renderMiniSection(t('inspector.examples', 'Examples'), matching.map(renderDiagnosticMini))
    ].join('');
  }

  function renderEdgeSection(title, rows) {
    if (!rows.length) {
      return renderMiniSection(title, [escapeHtml(t('inspector.noEdges', 'No edges.'))]);
    }
    return [
      '<div class="detail-section">',
      '<h3 class="section-title">' + escapeHtml(title) + '</h3>',
      '<div class="edge-list">',
      rows.map((row) => {
        const edge = row.edge || {};
        const endpoint = renderSceneEndpoint(row);
        const label = row.label ? '<div class="edge-note">' + escapeHtml(t('inspector.label', 'Label')) + ': ' + escapeHtml(row.label) + '</div>' : '';
        const condition = row.condition ? '<div class="edge-note">' + escapeHtml(t('inspector.condition', 'Condition')) + ': ' + escapeHtml(row.condition) + '</div>' : '';
        return '<div class="edge-item"><strong>' + escapeHtml(row.kind || 'edge') + '</strong> ' +
          escapeHtml(edge.from || '') + ' -> ' + escapeHtml(edge.to || '') +
          '<div>' + escapeHtml(t('inspector.endpoint', 'Endpoint')) + ': ' + endpoint + '</div>' +
          label + condition +
          '<div class="badge-line">' + badge(row.confidence || 'opaque', row.confidence || 'opaque') +
          renderSourceButton(row.source) + '</div></div>';
      }).join(''),
      '</div>',
      '</div>'
    ].join('');
  }

  function renderSceneEndpoint(row) {
    if (row.endpointScene) {
      const label = row.endpointId && row.endpointId !== row.endpointScene.id
        ? row.endpointScene.id + ' (' + row.endpointId + ')'
        : row.endpointScene.id;
      return '<button class="scene-link" type="button" data-scene-id="' +
        escapeAttr(row.endpointScene.id) + '">' + escapeHtml(label) + '</button>';
    }
    return escapeHtml(row.endpointId || '');
  }

  function renderMiniSection(title, items) {
    return [
      '<div class="detail-section">',
      '<h3 class="section-title">' + escapeHtml(title) + '</h3>',
      '<div class="mini-list">',
      (items.length ? items : ['None.']).map((item) => '<div class="mini-item">' + item + '</div>').join(''),
      '</div>',
      '</div>'
    ].join('');
  }

  function renderDiagnosticMini(diag) {
    return badge(diag.severity || 'info', diag.severity || 'info') + ' ' +
      escapeHtml(diag.code || '') + '<br>' + escapeHtml(diag.message || '') +
      '<div>' + renderSourceButton(diag.source) + '</div>';
  }

  function badge(text, className) {
    return renderBadge(text, className);
  }

  function renderBadge(text, className) {
    return '<span class="badge ' + escapeAttr(className || '') + '">' + escapeHtml(labelForBadge(text)) + '</span>';
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
      'Mixed safe / IDE': t('coverage.mixedSafeIde', 'Mixed safe / IDE'),
      'IDE guidance': t('coverage.ideGuidance', 'IDE guidance'),
      'Picker + warnings': t('coverage.pickerWarnings', 'Picker + warnings'),
      'Proposal + IDE guidance': t('coverage.proposalIdeGuidance', 'Proposal + IDE guidance'),
      'Guided review only': t('coverage.guidedReviewOnly', 'Guided review only'),
      'IDE escape hatch': t('coverage.ideEscapeHatch', 'IDE escape hatch'),
      'Not started': t('coverage.notStarted', 'Not started'),
      image: t('assets.type.image', 'image'),
      audio: t('assets.type.audio', 'audio'),
      asset: t('assets.type.asset', 'asset'),
      event_illustration: t('assets.role.event_illustration', 'event illustration'),
      event_portrait: t('assets.role.event_portrait', 'event portrait'),
      event_audio: t('assets.role.event_audio', 'event audio'),
      card_image: t('assets.role.card_image', 'card image'),
      card_portrait: t('assets.role.card_portrait', 'card portrait'),
      card_audio: t('assets.role.card_audio', 'card audio'),
      advisor_portrait: t('assets.role.advisor_portrait', 'advisor portrait'),
      reference: t('assets.role.reference', 'reference'),
      source_asset: t('assets.sourceKind.sourceAsset', 'source asset'),
      runtime_evidence: t('assets.sourceKind.runtimeEvidence', 'runtime evidence'),
      reference_only: t('assets.editability.referenceOnly', 'reference only'),
      manual_review: t('assets.editability.manualReview', 'manual review'),
      indexed: t('assets.referenceState.indexed', 'indexed'),
      file_missing: t('assets.referenceState.file_missing', 'file missing'),
      external: t('assets.referenceState.external', 'external'),
      unknown: t('assets.referenceState.unknown', 'unknown'),
      text_proposal: t('textCorpus.editability.textProposal', 'text proposal'),
      draft_extractable: t('textCorpus.editability.draftExtractable', 'draft extractable'),
      body: t('textCorpus.role.body', 'body'),
      heading: t('textCorpus.role.heading', 'heading'),
      title: t('textCorpus.role.title', 'title'),
      subtitle: t('textCorpus.role.subtitle', 'subtitle'),
      option_label: t('textCorpus.role.optionLabel', 'option label'),
      conditional_body: t('textCorpus.role.conditionalBody', 'conditional body'),
      unavailable_text: t('textCorpus.role.unavailableText', 'unavailable text'),
      news_headline: t('textCorpus.role.newsHeadline', 'news headline'),
      news_description: t('textCorpus.role.newsDescription', 'news description'),
      monthly_popup_excerpt: t('textCorpus.role.monthlyPopupExcerpt', 'monthly popup excerpt'),
      surface_label: t('textCorpus.role.surfaceLabel', 'surface label'),
      ide_escape_hatch: t('coverage.ideEscapeHatch', 'IDE escape hatch'),
      missing: t('coverage.missing', 'missing')
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

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }
})(typeof window !== 'undefined' ? window : globalThis);
