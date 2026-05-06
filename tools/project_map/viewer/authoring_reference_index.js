(function initProjectMapAuthoringReferenceIndex(global) {
  'use strict';

  function contentContext(projectIndex, model) {
    const value = model && typeof model === 'object' ? model : {};
    const raw = value.rawContext || {};
    const relationships = raw.relationships || {};
    const board = value.contextBoard || {};
    const source = value.source || {};
    return {
      identity: [
        pair(t('objectCanvas.identity.id', 'ID'), value.objectId || value.title || ''),
        pair(t('objectCanvas.identity.kind', 'Kind'), value.objectKind || value.templateLabel || ''),
        pair(t('objectCanvas.identity.time', 'Time'), timeLabel(value)),
        pair(t('objectCanvas.identity.source', 'Source'), source.path ? source.path + (source.line ? ':' + source.line : '') : '')
      ].filter((row) => row.value),
      incoming: ensureArray(relationships.incoming).map(flowRef),
      outgoing: ensureArray(relationships.outgoing).map(flowRef),
      current: relationships.current || null,
      variables: ensureArray(board.variables),
      effects: ensureArray(board.effects),
      sourceEvidence: ensureArray(board.sourceEvidence),
      projectSummary: projectSummary(projectIndex)
    };
  }

  function branchDraft(action, model, context) {
    const baseId = safeId(model && (model.objectId || model.title) || 'object');
    const target = context && typeof context === 'object' ? context : {};
    const year = insertYear(target.insertKey) || eventYear(model);
    const laneSuffix = safeId(target.insertKey || target.view || '');
    const branchId = baseId + (laneSuffix ? '_' + laneSuffix : '') + '_' + action;
    const authoringContext = {
      workspace: 'content',
      surface: 'content_storyboard',
      insertKey: target.insertKey || '',
      storyboardView: target.view || 'timeline',
      storyScopeMode: target.storyScopeMode || 'focus',
      storyScopeWindow: target.storyScopeWindow || '',
      storyChainDepth: target.storyChainDepth || '1',
      selectedCanvasNode: target.selectedKey || ''
    };
    const titles = {
      followup: t('objectCanvas.branch.followup', 'Follow-up event'),
      counterfactual: t('objectCanvas.branch.counterfactual', 'Counterfactual branch'),
      card: t('objectCanvas.branch.card', 'Related card'),
      news: t('objectCanvas.branch.news', 'Related news')
    };
    if (action === 'card') {
      return {
        template: 'card',
        id: branchId + '_card',
        title: titles.card,
        detail: t('objectCanvas.branch.card.detail', 'Card created from the selected beat.'),
        insertionContext: authoringContext,
        draft: {kind: 'card', id: branchId + '_card', title: titles.card, heading: titles.card, when: year ? {year, monthStart: 1, monthEnd: 3} : {}, studioAuthoringContext: authoringContext}
      };
    }
    if (action === 'news') {
      return {
        template: 'news',
        id: branchId + '_news',
        title: titles.news,
        detail: t('objectCanvas.branch.news.detail', 'News item attached to this story moment.'),
        insertionContext: authoringContext,
        draft: {kind: 'news_item', id: branchId + '_news', headline: titles.news, when: year ? {year, month: 1} : {}, studioAuthoringContext: authoringContext}
      };
    }
    return {
      template: 'event',
      id: branchId,
      title: titles[action] || titles.followup,
      detail: action === 'counterfactual'
        ? t('objectCanvas.branch.counterfactual.detail', 'Alternative path after this event.')
        : t('objectCanvas.branch.followup.detail', 'Next event after the selected beat.'),
      insertionContext: authoringContext,
      draft: {
        kind: 'world_event',
        id: branchId,
        title: titles[action] || titles.followup,
        heading: titles[action] || titles.followup,
        when: {year: year || 1936, monthStart: 1, monthEnd: 3, requires: '', priority: 0},
        studioAuthoringContext: authoringContext
      }
    };
  }

  function flowRef(row) {
    const value = row && typeof row === 'object' ? row : {};
    return {
      id: value.from || value.to || '',
      title: value.scene && value.scene.title || value.label || value.from || value.to || '',
      detail: [value.kind, value.label].filter(Boolean).join(' / '),
      source: value.source || {}
    };
  }

  function timeLabel(model) {
    const body = model && model.eventBody || {};
    const fields = ensureArray(body.metaFields);
    const year = fields.find((field) => field.id === 'event.year');
    if (year && year.value) {
      return String(year.value);
    }
    return eventYear(model) || '';
  }

  function eventYear(model) {
    const draft = model && model.changeState && model.changeState.draft || {};
    return draft.when && draft.when.year || draft.year || '';
  }

  function insertYear(insertKey) {
    const match = String(insertKey || '').match(/^time:(\d{3,4})$/);
    return match ? Number(match[1]) : '';
  }

  function projectSummary(projectIndex) {
    return {
      scenes: ensureArray(projectIndex && projectIndex.scenes).length,
      variables: ensureArray(projectIndex && projectIndex.variables).length,
      edges: ensureArray(projectIndex && projectIndex.edges).length
    };
  }

  function pair(label, value) {
    return {label, value: String(value || '')};
  }

  function safeId(value) {
    return String(value || 'object').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'object';
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  const api = {contentContext, branchDraft};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapAuthoringReferenceIndex = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
