(function initProjectMapObjectCanvasStoryboardDrafts(global) {
  'use strict';

  function createRelatedDraft(state, action, target, deps) {
    const helpers = deps || {};
    if (action === 'event') {
      openStandaloneEventDraft(state, relatedDraftContext(state, target), helpers);
      return;
    }
    const branchApi = helpers.branchApi || global.ProjectMapAuthoringReferenceIndex;
    const context = relatedDraftContext(state, target);
    const branch = branchApi && typeof branchApi.branchDraft === 'function'
      ? branchApi.branchDraft(action, state.model || {}, context)
      : null;
    if (branch && String(branch.template || '') === 'event' && branch.draft) {
      openRelatedEventDraft(state, branch, context, action, helpers);
      return;
    }
    if (branch && branch.draft && openRelatedTemplateDraft(state, branch, context, action, helpers)) {
      return;
    }
    const api = helpers.storyboardWorkspaceApi && helpers.storyboardWorkspaceApi();
    if (api && typeof api.createRelatedDraft === 'function') {
      api.createRelatedDraft(state, action, target, {
        render: helpers.render,
        t: translate(helpers)
      });
    }
  }

  function relatedDraftContext(state, target) {
    const dataset = target && target.dataset || {};
    const insertKey = String(dataset.contentStoryboardInsert || dataset.contentStoryboardLane || '');
    return {
      insertKey,
      view: state.storyboardView,
      storyCanvasCategory: state.storyCanvasCategory || 'story',
      storySearchQuery: state.storySearchQuery || '',
      selectedKey: state.selectedCanvasNode,
      storyScopeMode: state.storyScopeMode,
      storyScopeWindow: insertKey || state.storyScopeWindow,
      storyChainDepth: state.storyChainDepth,
      paletteDropContext: state.storyPaletteDropContext
    };
  }

  function openRelatedEventDraft(state, branch, context, action, deps) {
    const helpers = deps || {};
    const previousBranches = withCurrentDraftBranch(state, draftBranchList(state), helpers).filter((item) => !draftBranchMatches(item, branch));
    const draft = branch.draft || {};
    const opened = helpers.openTemplate && helpers.openTemplate('event', draft, {source: 'Storyboard', action: 'create_' + String(action || 'followup')});
    if (!opened) {
      return false;
    }
    state.draftBranches = previousBranches;
    restoreStoryboardContextAfterDraftOpen(state, context, draft, branch, helpers);
    state.status = translate(helpers)('objectCanvas.status.branchOpened', 'New event draft opened on the Storyboard.');
    call(helpers.showWorkspace, 'event');
    call(helpers.render);
    return true;
  }

  function openRelatedTemplateDraft(state, branch, context, action, deps) {
    const helpers = deps || {};
    const template = normalizeTemplateValue(branch && branch.template || '', helpers);
    const t = translate(helpers);
    if (template !== 'card' && template !== 'news') {
      return false;
    }
    const previousBranches = withCurrentDraftBranch(state, draftBranchList(state), helpers);
    const draft = template === 'card'
      ? relatedCardDraft(state, branch, context, action, helpers)
      : relatedNewsDraft(state, branch, context, action, helpers);
    const opened = helpers.openTemplate && helpers.openTemplate(template, draft, {source: 'Storyboard', action: 'create_' + String(action || template), template});
    if (!opened) {
      return false;
    }
    if (template === 'card') {
      state.draftBranches = previousBranches;
      const key = draftStoryboardKey('card', draft, branch, helpers);
      state.cardBoardSelectedKey = key;
      state.selectedCanvasNode = key;
      state.cardBoardLane = 'drafts';
      state.cardBoardDropContext = {
        itemKey: key,
        itemTitle: draft.title || draft.heading || branch.title || '',
        laneKey: 'drafts',
        laneLabel: t('cardBoard.lane.drafts', 'Drafts'),
        laneTag: '',
        action: 'create_related_card',
        sourceKey: context && context.selectedKey || ''
      };
      state.model = helpers.buildTemplateModel && helpers.buildTemplateModel({values: state.values, entry: {source: 'Storyboard', action: 'create_' + String(action || template)}});
      state.status = t('objectCanvas.status.relatedCardOpened', 'Related card draft opened for editing.');
      call(helpers.showWorkspace, 'card');
      call(helpers.render);
      return true;
    }
    state.draftBranches = previousBranches;
    restoreStoryboardContextAfterDraftOpen(state, context, draft, branch, helpers);
    state.status = t('objectCanvas.status.relatedNewsOpened', 'Related news draft opened for editing.');
    call(helpers.showWorkspace, 'news');
    call(helpers.render);
    return true;
  }

  function relatedCardDraft(state, branch, context, action, deps) {
    const helpers = deps || {};
    const t = translate(helpers);
    const base = cloneDraft(safeDefaultDraftForTemplate(helpers, 'card'));
    const sourceTitle = relatedSourceTitle(state);
    const branchDraft = cloneDraft(branch && branch.draft || {});
    const id = uniqueDraftId(state, branchDraft.id || branch && branch.id || 'related_card', helpers);
    const title = branchDraft.title || branchDraft.heading || relatedTitle(t('objectCanvas.branch.card', 'Related card'), sourceTitle);
    return Object.assign({}, base, branchDraft, {
      schemaVersion: String(branchDraft.schemaVersion || base.schemaVersion || '0.1'),
      kind: 'card',
      id,
      title,
      heading: branchDraft.heading || title,
      introParagraphs: ensureArray(helpers, branchDraft.introParagraphs).length
        ? branchDraft.introParagraphs
        : [relatedDescription(t('objectCanvas.branch.card.detail', 'Card created from the selected beat.'), sourceTitle)],
      options: ensureArray(helpers, branchDraft.options).length ? branchDraft.options : ensureArray(helpers, base.options),
      studioAuthoringContext: {
        workspace: 'content',
        surface: 'card_board',
        selectedCardKey: 'draft:card:' + id,
        selectedLane: 'drafts',
        cardBoardQuery: '',
        cardBoardType: 'all',
        cardBoardDropContext: {
          itemKey: 'draft:card:' + id,
          itemTitle: title,
          laneKey: 'drafts',
          laneLabel: t('cardBoard.lane.drafts', 'Drafts'),
          laneTag: '',
          action: 'create_' + String(action || 'card'),
          sourceKey: context && context.selectedKey || ''
        },
        editorOverlay: false
      }
    });
  }

  function relatedNewsDraft(state, branch, context, action, deps) {
    const helpers = deps || {};
    const t = translate(helpers);
    const base = cloneDraft(safeDefaultDraftForTemplate(helpers, 'news'));
    const sourceTitle = relatedSourceTitle(state);
    const branchDraft = cloneDraft(branch && branch.draft || {});
    const id = uniqueDraftId(state, branchDraft.id || branch && branch.id || 'related_news', helpers);
    const headline = branchDraft.headline || branchDraft.title || relatedTitle(t('objectCanvas.branch.news', 'Related news'), sourceTitle);
    return Object.assign({}, base, branchDraft, {
      schemaVersion: String(branchDraft.schemaVersion || base.schemaVersion || '0.1'),
      kind: 'news_item',
      id,
      headline,
      description: branchDraft.description || relatedDescription(t('objectCanvas.branch.news.detail', 'News item attached to this story moment.'), sourceTitle),
      studioAuthoringContext: Object.assign({}, context || {}, {
        workspace: 'content',
        surface: 'content_storyboard',
        action: 'create_' + String(action || 'news'),
        selectedCanvasNode: context && context.selectedKey || ''
      })
    });
  }

  function relatedSourceTitle(state) {
    return String(state && state.model && (state.model.title || state.model.objectId) || '').trim();
  }

  function relatedTitle(prefix, sourceTitle) {
    return sourceTitle ? prefix + ': ' + sourceTitle : prefix;
  }

  function relatedDescription(fallback, sourceTitle) {
    return sourceTitle ? fallback + ' ' + sourceTitle : fallback;
  }

  function openStandaloneEventDraft(state, context, deps) {
    const helpers = deps || {};
    const previousBranches = withCurrentDraftBranch(state, draftBranchList(state), helpers);
    const draft = standaloneEventDraft(state, context, helpers);
    const opened = helpers.openTemplate && helpers.openTemplate('event', draft, {source: 'Storyboard', action: 'create_event'});
    if (!opened) {
      return false;
    }
    state.draftBranches = previousBranches;
    restoreStoryboardContextAfterDraftOpen(state, context, draft, null, helpers);
    state.status = translate(helpers)('objectCanvas.status.newEventOpened', 'New blank event draft opened on the Storyboard.');
    call(helpers.showWorkspace, 'event');
    call(helpers.render);
    return true;
  }

  function openElectionEventDraft(state, context, deps) {
    const helpers = deps || {};
    const previousBranches = withCurrentDraftBranch(state, draftBranchList(state), helpers);
    const draft = electionEventDraft(state, context, helpers);
    const opened = helpers.openTemplate && helpers.openTemplate('event', draft, {source: 'Election Results', action: 'create_election_event'});
    if (!opened) {
      return false;
    }
    state.draftBranches = previousBranches;
    restoreStoryboardContextAfterDraftOpen(state, context || {}, draft, null, helpers);
    state.status = translate(helpers)('electionResults.status.newEventOpened', 'New election event draft opened on the Storyboard.');
    call(helpers.showWorkspace, 'event');
    call(helpers.render);
    return true;
  }

  function restoreStoryboardContextAfterDraftOpen(state, context, draft, branch, deps) {
    const helpers = deps || {};
    state.storyboardView = String(context && context.view || '') === 'chain' ? 'chain' : 'timeline';
    state.storyCanvasCategory = normalizeStoryCanvasCategory(context && context.storyCanvasCategory);
    state.storySearchQuery = String(context && context.storySearchQuery || '');
    state.storyScopeMode = String(context && context.storyScopeMode || '') === 'expanded' ? 'expanded' : 'focus';
    state.storyScopeWindow = String(context && (context.insertKey || context.storyScopeWindow) || '');
    state.storyChainDepth = normalizeStoryDepth(context && context.storyChainDepth);
    state.storyPaletteDropContext = context && context.paletteDropContext || null;
    state.selectedCanvasNode = draftStoryboardKey(state.template || branch && branch.template || 'event', draft, branch, helpers);
    state.editorOverlay = true;
    state.values = {};
    state.valueOriginals = {};
    call(helpers.resetStructureCommands);
    state.model = helpers.buildTemplateModel && helpers.buildTemplateModel({values: state.values, source: 'Storyboard'});
  }

  function standaloneEventDraft(state, context, deps) {
    const helpers = deps || {};
    const t = translate(helpers);
    const base = cloneDraft(safeDefaultDraftForTemplate(helpers, 'event'));
    const year = insertYearFromKey(context && (context.insertKey || context.storyScopeWindow)) || draftYear(base) || 1936;
    const id = uniqueDraftId(state, 'new_world_event' + (year ? '_' + year : ''), helpers);
    const title = t('create.sample.eventTitle', 'New world event');
    const heading = t('create.sample.eventHeading', title);
    const when = Object.assign({}, base.when || {}, {
      year,
      monthStart: numberOr(base.when && base.when.monthStart, 1),
      monthEnd: numberOr(base.when && base.when.monthEnd, 3),
      requires: String(base.when && base.when.requires || ''),
      priority: numberOr(base.when && base.when.priority, 0)
    });
    return Object.assign({}, base, {
      schemaVersion: String(base.schemaVersion || '0.1'),
      kind: 'world_event',
      id,
      title,
      heading,
      seenFlag: id + '_seen',
      when,
      studioAuthoringContext: Object.assign({}, context || {}, {
        workspace: 'content',
        surface: 'content_storyboard',
        action: 'create_event',
        selectedCanvasNode: context && context.selectedKey || ''
      })
    });
  }

  function electionEventDraft(state, context, deps) {
    const helpers = deps || {};
    const t = translate(helpers);
    const base = standaloneEventDraft(state, context || {}, helpers);
    const year = draftYear(base) || 1936;
    const id = uniqueDraftId(state, 'new_election_event_' + year, helpers);
    const title = t('electionResults.sample.eventTitle', 'New election results');
    const primaryOption = {
      id: 'continue_after_election',
      label: t('electionResults.sample.optionLabel', 'Continue after the election'),
      subtitle: '',
      chooseIf: '',
      unavailableText: '',
      effects: [],
      narrativeParagraphs: [t('electionResults.sample.optionResult', 'The election result changes the political balance.')],
      variants: [],
      gotoAfter: 'post_election_followup'
    };
    const secondaryOption = {
      id: 'review_election_balance',
      label: t('electionResults.sample.optionLabelAlt', 'Review the coalition balance'),
      subtitle: '',
      chooseIf: '',
      unavailableText: '',
      effects: [],
      narrativeParagraphs: [t('electionResults.sample.optionResultAlt', 'The result remains open for follow-up political choices.')],
      variants: [],
      gotoAfter: 'post_election_review'
    };
    return Object.assign({}, base, {
      id,
      title,
      heading: title,
      seenFlag: id + '_seen',
      introParagraphs: [t('electionResults.sample.intro', 'Write the election result text here. Use the Election Results workspace to shape the chart, table, conditions, and consequences.')],
      effectsOnTrigger: [],
      options: [primaryOption, secondaryOption],
      studioAuthoringContext: Object.assign({}, base.studioAuthoringContext || {}, context || {}, {
        workspace: 'content',
        surface: 'content_storyboard',
        action: 'create_election_event',
        selectedCanvasNode: context && context.selectedKey || ''
      })
    });
  }

  function cloneDraft(value) {
    try {
      return JSON.parse(JSON.stringify(value || {}));
    } catch (_err) {
      return Object.assign({}, value || {});
    }
  }

  function withCurrentDraftBranch(state, branches, deps) {
    const branch = currentDraftBranch(state, deps);
    const list = ensureArray(deps || {}, branches).slice();
    if (!branch) {
      return list;
    }
    return list.filter((item) => !draftBranchMatches(item, branch)).concat(branch);
  }

  function currentDraftBranch(state, deps) {
    const helpers = deps || {};
    if (!state || state.mode === 'existing') {
      return null;
    }
    const template = normalizeTemplateValue(state.template || '', helpers);
    if (!['event', 'card', 'news'].includes(template)) {
      return null;
    }
    const draft = state.model && state.model.changeState && state.model.changeState.draft || state.baseDraft || {};
    const id = String(draft.id || '').trim();
    if (!id) {
      return null;
    }
    const title = String(draft.title || draft.heading || draft.headline || id).trim();
    const detail = ensureArray(helpers, draft.introParagraphs).concat(ensureArray(helpers, draft.paragraphs)).filter(Boolean)[0] ||
      String(draft.description || draft.subtitle || '').trim();
    return {
      template,
      id,
      title,
      detail,
      draft: cloneDraft(draft),
      insertionContext: draft.studioAuthoringContext || draft.authoringContext || null
    };
  }

  function insertYearFromKey(value) {
    const match = String(value || '').match(/^time:(\d{3,4})$/);
    return match ? Number(match[1]) : 0;
  }

  function draftYear(draft) {
    return Number(draft && draft.when && draft.when.year || draft && draft.year || 0) || 0;
  }

  function uniqueDraftId(state, baseId, deps) {
    const helpers = deps || {};
    const root = safeDraftId(helpers, baseId || 'new_world_event');
    const used = new Set();
    ensureArray(helpers, state && state.projectIndex && state.projectIndex.scenes).forEach((scene) => {
      if (scene && scene.id) {
        used.add(String(scene.id));
      }
    });
    draftBranchList(state).forEach((branch) => {
      const id = branchId(branch);
      if (id) {
        used.add(id);
      }
    });
    if (state && state.baseDraft && state.baseDraft.id) {
      used.add(String(state.baseDraft.id));
    }
    if (!used.has(root)) {
      return root;
    }
    for (let index = 2; index < 1000; index += 1) {
      const candidate = root + '_' + index;
      if (!used.has(candidate)) {
        return candidate;
      }
    }
    return root + '_' + Date.now();
  }

  function numberOr(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function discardDraftCard(state, target, deps) {
    const helpers = deps || {};
    const t = translate(helpers);
    const card = target && target.closest ? target.closest('[data-content-storyboard-card]') : null;
    const key = String(target && target.dataset && target.dataset.storyboardDraftKey || card && card.dataset && card.dataset.contentStoryboardCard || '').trim();
    const currentKey = currentDraftStoryboardKey(state, helpers);
    state.draftBranches = draftBranchList(state).filter((branch) => !draftBranchKeyMatches(branch, key));
    if (key && currentKey && key === currentKey && state.mode !== 'existing') {
      const context = state.baseDraft && state.baseDraft.studioAuthoringContext || {};
      const previousKey = String(context.selectedCanvasNode || '').trim();
      if (previousKey && selectExistingStoryObject(state, previousKey, helpers)) {
        state.status = t('objectCanvas.status.draftDeleted', 'Draft card discarded.');
        call(helpers.render);
        return;
      }
      helpers.openTemplate && helpers.openTemplate('event', safeDefaultDraftForTemplate(helpers, 'event'), {source: 'Create'});
      state.status = t('objectCanvas.status.draftDeleted', 'Draft card discarded.');
      call(helpers.render);
      return;
    }
    if (state.selectedCanvasNode === key) {
      state.selectedCanvasNode = currentKey || 'object';
    }
    state.status = t('objectCanvas.status.draftDeleted', 'Draft card discarded.');
    call(helpers.render);
  }

  function selectExistingStoryObject(state, key, deps) {
    const helpers = deps || {};
    const parsed = storyObjectFromKey(key);
    if (!parsed || parsed.kind === 'draft' || parsed.kind === 'route') {
      return false;
    }
    const itemId = parsed.parentId || parsed.id;
    const nextModel = helpers.buildExistingModelFor && helpers.buildExistingModelFor(parsed.view, itemId, {values: {}});
    if (!nextModel || !nextModel.ok) {
      return false;
    }
    state.mode = 'existing';
    state.template = 'existing';
    state.view = parsed.view;
    state.item = itemId;
    state.workspace = 'content';
    state.selectedCanvasNode = key;
    state.editorOverlay = true;
    state.values = {};
    state.valueOriginals = {};
    call(helpers.resetStructureCommands);
    state.baseDraft = null;
    state.deleteProposal = null;
    state.sourceSliceModel = null;
    state.sourceSliceAdvancedConfirmed = false;
    state.semanticLogicModel = null;
    state.semanticLogicAdvancedConfirmed = false;
    state.model = nextModel;
    call(helpers.showWorkspace, parsed.view === 'cards' ? 'card' : 'existing');
    call(helpers.render);
    return true;
  }

  function storyObjectFromKey(key) {
    const match = String(key || '').match(/^(event|card|advisor|news|section|route|draft):(.+)$/);
    if (!match) {
      return null;
    }
    const kind = match[1];
    const id = match[2];
    if (kind === 'section') {
      return {kind, id, parentId: String(id || '').split('.')[0] || '', view: 'events'};
    }
    return {kind, id, view: kind === 'event' ? 'events' : kind === 'card' || kind === 'advisor' ? 'cards' : kind};
  }

  function currentDraftStoryboardKey(state, deps) {
    if (state && state.mode === 'existing') {
      return '';
    }
    return draftStoryboardKey(state && state.template || 'event', state && state.baseDraft || {}, null, deps);
  }

  function draftStoryboardKey(template, draft, branch, deps) {
    const helpers = deps || {};
    const value = draft || {};
    const id = String(value.id || branch && branch.id || 'new_event');
    const kind = normalizeTemplateValue(template, helpers) === 'news' ? 'news' : normalizeTemplateValue(template, helpers) === 'card' ? 'card' : 'event';
    return 'draft:' + kind + ':' + id;
  }

  function draftBranchList(state) {
    return Array.isArray(state && state.draftBranches) ? state.draftBranches.slice() : [];
  }

  function draftBranchMatches(a, b) {
    const leftId = branchId(a);
    const rightId = branchId(b);
    if (!leftId || leftId !== rightId) {
      return false;
    }
    const leftKind = branchTemplateKind(a);
    const rightKind = branchTemplateKind(b);
    return !leftKind || !rightKind || leftKind === rightKind;
  }

  function draftBranchKeyMatches(branch, key) {
    const text = String(key || '').trim();
    if (!text) {
      return false;
    }
    const id = branchId(branch);
    if (!id) {
      return false;
    }
    if (text === 'draft:' + id) {
      return true;
    }
    const match = text.match(/^draft:(event|card|news):(.+)$/);
    if (!match || match[2] !== id) {
      return false;
    }
    const kind = branchTemplateKind(branch);
    return !kind || kind === match[1];
  }

  function branchId(branch) {
    return String(branch && (branch.id || branch.draft && branch.draft.id) || '').trim();
  }

  function branchTemplateKind(branch) {
    const draft = branch && branch.draft || {};
    const text = String(branch && (branch.template || branch.kind) || draft.template || draft.kind || '').trim();
    if (text === 'card' || text === 'advisor' || text === 'advisor_like') {
      return 'card';
    }
    if (text === 'news' || text === 'news_item') {
      return 'news';
    }
    if (text === 'event' || text === 'world_event' || text === 'new_event') {
      return 'event';
    }
    return '';
  }

  function normalizeStoryCanvasCategory(value) {
    const text = String(value || 'story');
    return text === 'cards' || text === 'all' ? text : 'story';
  }

  function normalizeStoryDepth(value) {
    const text = String(value || '1');
    return text === '2' || text === 'full' ? text : '1';
  }

  function translate(deps) {
    return deps && typeof deps.t === 'function' ? deps.t : function fallbackTranslate(_key, fallback) { return fallback; };
  }

  function safeDefaultDraftForTemplate(deps, template) {
    return deps && typeof deps.safeDefaultDraftForTemplate === 'function'
      ? deps.safeDefaultDraftForTemplate(template)
      : {};
  }

  function safeDraftId(deps, value) {
    if (deps && typeof deps.safeDraftId === 'function') {
      return deps.safeDraftId(value);
    }
    return String(value || 'draft').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'draft';
  }

  function normalizeTemplateValue(template, deps) {
    return deps && typeof deps.normalizeTemplate === 'function'
      ? deps.normalizeTemplate(template)
      : fallbackNormalizeTemplate(template);
  }

  function fallbackNormalizeTemplate(template) {
    const text = String(template || '').trim();
    if (text === 'card' || text === 'news' || text === 'advisor') {
      return text;
    }
    return 'event';
  }

  function ensureArray(deps, value) {
    return deps && typeof deps.ensureArray === 'function'
      ? deps.ensureArray(value)
      : Array.isArray(value) ? value : [];
  }

  function call(fn, arg) {
    if (typeof fn === 'function') {
      return arguments.length > 1 ? fn(arg) : fn();
    }
    return undefined;
  }

  const api = {
    createRelatedDraft,
    relatedDraftContext,
    openRelatedEventDraft,
    openRelatedTemplateDraft,
    relatedCardDraft,
    relatedNewsDraft,
    relatedSourceTitle,
    relatedTitle,
    relatedDescription,
    openStandaloneEventDraft,
    openElectionEventDraft,
    restoreStoryboardContextAfterDraftOpen,
    standaloneEventDraft,
    electionEventDraft,
    cloneDraft,
    withCurrentDraftBranch,
    currentDraftBranch,
    insertYearFromKey,
    draftYear,
    uniqueDraftId,
    numberOr,
    discardDraftCard,
    selectExistingStoryObject,
    storyObjectFromKey,
    currentDraftStoryboardKey,
    draftStoryboardKey,
    draftBranchList,
    draftBranchMatches,
    draftBranchKeyMatches,
    branchId,
    normalizeStoryCanvasCategory,
    normalizeStoryDepth
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectCanvasStoryboardDrafts = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
