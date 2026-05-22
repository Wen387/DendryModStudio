(function initProjectMapDeckPoolDraft(global) {
  'use strict';

  const DRAFT_VERSION = '0.1';

  function defaultDraft(projectIndex) {
    const pools = deckPoolModel(projectIndex).deckPools || [];
    return pools[0] ? draftFromPool(pools[0], projectIndex) : normalizeDraft({
      schemaVersion: DRAFT_VERSION,
      kind: 'deck_pool',
      id: 'deck_pool_update',
      deckPoolId: '',
      label: 'Deck Pool',
      originalLabel: 'Deck Pool',
      routeTags: [],
      launcherRoutes: [],
      memberCards: [],
      evidence: {},
      authoringStatus: 'partial',
      authoringBlockers: ['No deck pool semantic evidence is available.']
    });
  }

  function draftForPool(projectIndex, poolId) {
    const model = deckPoolModel(projectIndex);
    const pool = ensureArray(model.deckPools).find((item) => String(item.id || '') === String(poolId || '')) || ensureArray(model.deckPools)[0];
    return pool ? draftFromPool(pool, projectIndex) : defaultDraft(projectIndex);
  }

  function draftFromPool(pool, projectIndex) {
    const value = isObject(pool) ? pool : {};
    const ownerEvidence = ownerEvidenceForPool(projectIndex, value);
    const inferredRouteTags = ensureArray(value.routeTags).length ? ensureArray(value.routeTags).map(String) : inferredRouteTagsForPool(projectIndex, value);
    const memberRows = ensureArray(value.memberCards).length
      ? ensureArray(value.memberCards)
      : fallbackMemberCardsForPool(projectIndex, value, inferredRouteTags);
    const targetPools = ensureArray(value.targetDeckPools).length
      ? ensureArray(value.targetDeckPools)
      : ensureArray(deckPoolModel(projectIndex).deckPools).filter((candidate) => String(candidate.id || '') !== String(value.id || '')).map((candidate) => ({
        id: candidate.id,
        label: candidate.label || candidate.id,
        routeTags: candidate.routeTags,
        kind: candidate.kind,
        status: candidate.status
      }));
    const availableRows = ensureArray(value.availableMemberCards).length
      ? ensureArray(value.availableMemberCards)
      : availableMemberCardsForDraft(projectIndex, memberRows);
    return normalizeDraft({
      schemaVersion: DRAFT_VERSION,
      kind: 'deck_pool',
      id: 'deck_pool_' + safeId(value.id || 'update'),
      deckPoolId: String(value.id || ''),
      label: String(value.label || value.id || 'Deck pool'),
      originalLabel: String(value.label || value.id || 'Deck pool'),
      ownerSceneId: String(value.ownerSceneId || ''),
      ownerSectionId: String(value.ownerSectionId || ''),
      path: String(value.path || ''),
      routeTags: inferredRouteTags,
      originalRouteTags: inferredRouteTags,
      routeTargets: clone(ensureArray(value.routeTargets)),
      launcherRoutes: ensureArray(value.launcherRoutes).map((route, index) => ({
        id: String(route.id || 'launcher_' + (index + 1)),
        label: String(route.label || route.id || ''),
        originalLabel: String(route.label || route.id || ''),
        targetKind: String(route.targetKind || ''),
        targetId: String(route.targetId || ''),
        ownerSceneId: String(route.ownerSceneId || ''),
        source: sourceRef(route.source || {})
      })),
      memberCards: memberRows.map((card) => ({
        cardId: String(card.cardId || ''),
        key: String(card.key || ''),
        title: String(card.title || card.cardId || ''),
        tags: ensureArray(card.tags).map(String),
        membership: String(card.membership || ''),
        currentPoolIds: ensureArray(card.currentPoolIds).map(String),
        membershipKind: String(card.membershipKind || ''),
        membershipTag: String(card.membershipTag || ''),
        membershipSource: sourceRef(card.membershipSource || {}),
        editableReason: String(card.editableReason || ''),
        source: sourceRef(card.source || {})
      })),
      availableMemberCards: availableRows.map(normalizeCandidateCard),
      targetDeckPools: targetPools.map(normalizeTargetPool),
      membershipChanges: [],
      addMemberCardId: '',
      removeMemberCardId: '',
      moveMemberCardId: '',
      moveTargetDeckPoolId: '',
      evidence: {
        sourceAnchor: sourceRef(value.sourceAnchor || {}),
        labelSource: sourceRef(ownerEvidence.labelSource || {}),
        routeAnchors: ensureArray(value.routeAnchors).map(sourceRef).filter((source) => source.path)
      },
      status: String(value.status || 'ready'),
      authoringStatus: value.status === 'partial' ? 'partial' : 'ready',
      authoringBlockers: value.manualBoundary ? [String(value.manualBoundary)] : []
    });
  }

  function normalizeDraft(input) {
    const value = isObject(input) ? input : {};
    const membershipChanges = normalizeMembershipChanges(value);
    const legacyAdd = firstChange(membershipChanges, 'add');
    const legacyRemove = firstChange(membershipChanges, 'remove');
    const legacyMove = firstChange(membershipChanges, 'move');
    return {
      schemaVersion: String(value.schemaVersion || DRAFT_VERSION),
      kind: 'deck_pool',
      id: safeId(value.id || 'deck_pool_update'),
      deckPoolId: String(value.deckPoolId || value.poolId || ''),
      label: String(value.label || value.title || 'Deck pool'),
      originalLabel: String(value.originalLabel || value.label || value.title || 'Deck pool'),
      ownerSceneId: String(value.ownerSceneId || ''),
      ownerSectionId: String(value.ownerSectionId || ''),
      path: String(value.path || ''),
      routeTags: ensureArray(value.routeTags).map(String).filter(Boolean),
      originalRouteTags: ensureArray(value.originalRouteTags).map(String).filter(Boolean),
      routeTargets: clone(ensureArray(value.routeTargets)),
      launcherRoutes: ensureArray(value.launcherRoutes).map((route, index) => ({
        id: String(route && route.id || 'launcher_' + (index + 1)),
        label: String(route && route.label || ''),
        originalLabel: String(route && (route.originalLabel || route.label) || ''),
        targetKind: String(route && route.targetKind || ''),
        targetId: String(route && route.targetId || ''),
        ownerSceneId: String(route && route.ownerSceneId || ''),
        source: sourceRef(route && route.source || {})
      })),
      memberCards: ensureArray(value.memberCards).map((card) => ({
        cardId: String(card && card.cardId || ''),
        key: String(card && card.key || ''),
        title: String(card && card.title || card && card.cardId || ''),
        tags: ensureArray(card && card.tags).map(String),
        membership: String(card && card.membership || ''),
        currentPoolIds: ensureArray(card && card.currentPoolIds).map(String),
        membershipKind: String(card && card.membershipKind || ''),
        membershipTag: String(card && card.membershipTag || ''),
        membershipSource: sourceRef(card && card.membershipSource || {}),
        editableReason: String(card && card.editableReason || ''),
        source: sourceRef(card && card.source || {})
      })),
      availableMemberCards: ensureArray(value.availableMemberCards).map(normalizeCandidateCard).filter((card) => card.cardId),
      targetDeckPools: ensureArray(value.targetDeckPools).map(normalizeTargetPool).filter((pool) => pool.id),
      membershipChanges,
      addMemberCardId: String(value.addMemberCardId || legacyAdd.cardId || ''),
      removeMemberCardId: String(value.removeMemberCardId || legacyRemove.cardId || ''),
      moveMemberCardId: String(value.moveMemberCardId || legacyMove.cardId || ''),
      moveTargetDeckPoolId: String(value.moveTargetDeckPoolId || legacyMove.targetDeckPoolId || ''),
      evidence: {
        sourceAnchor: sourceRef(value.evidence && value.evidence.sourceAnchor || value.sourceAnchor || {}),
        labelSource: sourceRef(value.evidence && value.evidence.labelSource || {}),
        routeAnchors: ensureArray(value.evidence && value.evidence.routeAnchors).map(sourceRef).filter((source) => source.path)
      },
      status: String(value.status || 'ready'),
      authoringStatus: String(value.authoringStatus || value.status || 'ready') === 'partial' ? 'partial' : 'ready',
      authoringBlockers: ensureArray(value.authoringBlockers).map(String).filter(Boolean)
    };
  }

  function buildExportBundle(input, projectIndex) {
    const draft = normalizeDraft(input);
    const operations = deckPoolOperations(draft, projectIndex);
    if (!operations.length) {
      operations.push(manualOperation('deck_pool.review_boundary', 'deck_pool.noop', 'No deck pool membership or label changes were requested.'));
    }
    const installApi = installPlanApi();
    const plan = installApi.buildInstallPlan({
      id: draft.id,
      draftKind: 'deck_pool',
      title: draft.label || draft.deckPoolId,
      project: installApi.projectProvenanceFromIndex ? installApi.projectProvenanceFromIndex(projectIndex) : null,
      operations
    });
    const installPlanJson = installApi.renderInstallPlanJson(plan);
    const patchPreview = installApi.renderPatchPreview(plan);
    const installChecklist = installApi.renderOperationChecklist(plan);
    const draftJson = JSON.stringify(draft, null, 2) + '\n';
    return {
      ok: draft.authoringStatus !== 'partial',
      draft,
      diagnostics: draft.authoringStatus === 'partial' ? [{level: 'warning', code: 'deck_pool.partial_boundary', message: draft.authoringBlockers.join(' ') || 'Deck pool requires manual review.'}] : [],
      previewText: deckPoolPreview(draft),
      proposal: deckPoolPreview(draft),
      draftJson,
      installPlan: plan,
      installPlanJson,
      patchPreview,
      installChecklist,
      installNotes: deckPoolNotes(draft, operations)
    };
  }

  function deckPoolOperations(draft, projectIndex) {
    const operations = [];
    if (draft.label !== draft.originalLabel) {
      operations.push(labelOperation(draft));
    }
    ensureArray(draft.launcherRoutes).forEach((route, index) => {
      if (String(route.label || '') !== String(route.originalLabel || '')) {
        operations.push(launcherOperation(route, index));
      }
    });
    ensureArray(draft.membershipChanges).forEach((change) => {
      operations.push(memberChangeOperation(projectIndex, draft, change));
    });
    return operations.filter(Boolean);
  }

  function labelOperation(draft) {
    const source = sourceRef(draft.evidence && draft.evidence.labelSource || {});
    if (source.path && source.line) {
      return {
        id: 'deck_pool_update_label_' + safeId(draft.deckPoolId),
        type: 'replace_text',
        path: source.path,
        line: source.line,
        search: 'title: ' + draft.originalLabel,
        replace: 'title: ' + draft.label,
        safety: 'guarded_apply',
        role: 'deck_pool.update_label',
        semanticOperation: 'deck_pool.update_label',
        description: 'Update the deck pool section title.'
      };
    }
    return manualOperation('deck_pool_update_label_' + safeId(draft.deckPoolId), 'deck_pool.update_label', 'Update deck pool label to "' + draft.label + '" after verifying the owning section source.');
  }

  function launcherOperation(route, index) {
    const source = sourceRef(route.source || {});
    const originalLabel = String(route.originalLabel || '');
    const nextLabel = String(route.label || '');
    if (source.path && source.line && source.anchorText && originalLabel && source.anchorText.includes(originalLabel)) {
      return {
        id: 'deck_pool_update_launcher_' + String(index + 1),
        type: 'replace_text',
        path: source.path,
        line: source.line,
        search: source.anchorText,
        replace: source.anchorText.replace(originalLabel, nextLabel),
        safety: 'guarded_apply',
        role: 'deck_pool.update_launcher',
        semanticOperation: 'deck_pool.update_launcher',
        description: 'Update a deck pool launcher option label.'
      };
    }
    return manualOperation('deck_pool_update_launcher_' + String(index + 1), 'deck_pool.update_launcher', 'Update deck pool launcher label for ' + (route.targetId || route.id || 'route') + '.');
  }

  function memberChangeOperation(projectIndex, draft, change) {
    const action = String(change && change.action || '').trim();
    if (action === 'add') {
      return memberTagOperation(projectIndex, draft, change.cardId, currentRouteTag(draft), 'add', change);
    }
    if (action === 'remove') {
      return memberTagOperation(projectIndex, draft, change.cardId, currentRouteTag(draft), 'remove', change);
    }
    if (action === 'move') {
      return moveMemberOperation(projectIndex, draft, change);
    }
    return null;
  }

  function memberTagOperation(projectIndex, draft, cardId, tag, action, change) {
    const scene = sceneById(projectIndex, cardId);
    const metadata = scene && scene.metadata && scene.metadata.tags || null;
    const tags = ensureArray(scene && scene.tags).map(String).filter(Boolean);
    const op = action === 'add' ? 'deck_pool.add_member' : 'deck_pool.remove_member';
    const context = operationContext(draft, scene, change, op);
    const boundary = membershipBoundary(draft, tag, 'tag');
    if (boundary) {
      return manualOperation(op + '_' + safeId(cardId), op, boundary + ' ' + context.reviewSummary + '.', context);
    }
    if (!scene || !tag) {
      return manualOperation(op + '_' + safeId(cardId), op, 'Review deck pool membership for ' + cardId + ' manually; no stable route tag was available.', context);
    }
    if (action === 'add' && tags.includes(tag)) {
      return manualOperation(op + '_' + safeId(cardId), op, cardId + ' already carries #' + tag + '; no source rewrite is needed.', context);
    }
    if (action === 'remove' && !tags.includes(tag)) {
      return manualOperation(op + '_' + safeId(cardId), op, cardId + ' does not carry #' + tag + '; no automatic removal is safe.', context);
    }
    if (metadata && metadata.path && metadata.line) {
      const nextTags = action === 'add' ? unique(tags.concat([tag])) : tags.filter((item) => item !== tag);
      const search = sourceAnchorText(metadata, 'tags: ' + tags.join(', '));
      return {
        id: op + '_' + safeId(cardId),
        type: 'replace_text',
        path: metadata.path,
        line: metadata.line,
        search,
        replace: nextTags.length ? 'tags: ' + nextTags.join(', ') : 'tags:',
        safety: 'guarded_apply',
        role: op,
        semanticOperation: op,
        groupId: context.groupId,
        reviewSummary: context.reviewSummary,
        description: context.reviewSummary
      };
    }
    return manualOperation(op + '_' + safeId(cardId), op, 'Review tags for ' + cardId + ' manually; exact tags source evidence is missing.', context);
  }

  function moveMemberOperation(projectIndex, draft, change) {
    const currentTag = currentRouteTag(draft);
    const targetPool = ensureArray(deckPoolModel(projectIndex).deckPools).find((pool) => String(pool.id || '') === String(change.targetDeckPoolId || ''));
    const targetTag = targetPool && ensureArray(targetPool.routeTags)[0] || '';
    const scene = sceneById(projectIndex, change.cardId);
    const context = operationContext(draft, scene, change, 'deck_pool.move_member', targetPool);
    const boundary = membershipBoundary(draft, currentTag, 'tag') || membershipBoundary(targetPool || {}, targetTag, 'tag');
    if (boundary) {
      return manualOperation('deck_pool_move_member_' + safeId(change.cardId), 'deck_pool.move_member', boundary + ' ' + context.reviewSummary + '.', context);
    }
    if (!targetTag || !currentTag) {
      return manualOperation('deck_pool_move_member_' + safeId(change.cardId), 'deck_pool.move_member', 'Move ' + change.cardId + ' after reviewing source membership manually.', context);
    }
    const metadata = scene && scene.metadata && scene.metadata.tags || null;
    const tags = ensureArray(scene && scene.tags).map(String).filter(Boolean);
    if (metadata && metadata.path && metadata.line && tags.includes(currentTag)) {
      const nextTags = unique(tags.filter((tag) => tag !== currentTag).concat([targetTag]));
      const search = sourceAnchorText(metadata, 'tags: ' + tags.join(', '));
      return {
        id: 'deck_pool_move_member_' + safeId(change.cardId),
        type: 'replace_text',
        path: metadata.path,
        line: metadata.line,
        search,
        replace: 'tags: ' + nextTags.join(', '),
        safety: 'guarded_apply',
        role: 'deck_pool.move_member',
        semanticOperation: 'deck_pool.move_member',
        groupId: context.groupId,
        reviewSummary: context.reviewSummary,
        description: context.reviewSummary
      };
    }
    return manualOperation('deck_pool_move_member_' + safeId(change.cardId), 'deck_pool.move_member', 'Move ' + change.cardId + ' after verifying exact tags source evidence.', context);
  }

  function membershipBoundary(pool, routeTag, membershipKind) {
    const kind = String(pool && pool.kind || '');
    if (kind === 'hybrid' || kind === 'dynamic_partial' || String(pool && pool.status || '') === 'partial') {
      return 'Deck pool uses dynamic or hybrid membership; manual review is required.';
    }
    if (membershipKind !== 'tag' || !routeTag) {
      return 'Deck pool membership is not a stable tag route; manual review is required.';
    }
    return '';
  }

  function operationContext(draft, scene, change, semanticOperation, targetPool) {
    const action = String(change && change.action || '').trim();
    const title = scene && scene.title || change && change.cardId || '';
    const sourceLabel = draft.label || draft.deckPoolId || 'deck pool';
    const targetLabel = targetPool && (targetPool.label || targetPool.id) || change && change.targetDeckPoolId || '';
    const reviewSummary = action === 'move'
      ? 'Move ' + title + ' from ' + sourceLabel + ' to ' + targetLabel
      : action === 'remove'
        ? 'Remove ' + title + ' from ' + sourceLabel
        : 'Add ' + title + ' to ' + sourceLabel;
    return {
      groupId: 'deck_pool:' + safeId(draft.deckPoolId || draft.id || 'deck_pool'),
      reviewSummary,
      semanticOperation
    };
  }

  function sourceAnchorText(source, fallback) {
    const anchor = sourceRef(source);
    return String(anchor.anchorText || anchor.rawAnchorText || fallback || '');
  }

  function manualOperation(id, semanticOperation, message, context) {
    const extra = context || {};
    return {
      id,
      type: 'manual_snippet',
      path: '',
      content: message + '\n',
      safety: 'manual_review',
      role: semanticOperation,
      semanticOperation,
      groupId: extra.groupId || '',
      reviewSummary: extra.reviewSummary || message,
      description: message
    };
  }

  function deckPoolPreview(draft) {
    return [
      'Deck pool: ' + (draft.label || draft.deckPoolId),
      'Route tags: ' + (draft.routeTags.join(', ') || 'none'),
      'Members: ' + String(draft.memberCards.length),
      ensureArray(draft.membershipChanges).length ? 'Membership changes: ' + String(draft.membershipChanges.length) : '',
      draft.addMemberCardId ? 'Add member: ' + draft.addMemberCardId : '',
      draft.removeMemberCardId ? 'Remove member: ' + draft.removeMemberCardId : '',
      draft.moveMemberCardId ? 'Move member: ' + draft.moveMemberCardId + ' -> ' + draft.moveTargetDeckPoolId : ''
    ].filter(Boolean).join('\n') + '\n';
  }

  function deckPoolNotes(draft, operations) {
    return ['Deck Pool install proposal', '', deckPoolPreview(draft).trim(), '', 'Operations:', ...operations.map((operation) => '- ' + operation.role + ': ' + operation.description)].join('\n') + '\n';
  }

  function ownerEvidenceForPool(projectIndex, pool) {
    const scene = sceneById(projectIndex, pool.ownerSceneId || String(pool.id || '').split('.')[0]);
    const section = ensureArray(scene && scene.sections).find((item) => String(item && item.id || '') === String(pool.ownerSectionId || pool.id || '')) || null;
    return {labelSource: sourceRef(section && section.metadata && section.metadata.title || scene && scene.metadata && scene.metadata.title || {})};
  }

  function inferredRouteTagsForPool(projectIndex, pool) {
    const scene = sceneById(projectIndex, pool.id) || sceneById(projectIndex, pool.ownerSceneId);
    const section = ensureArray(scene && scene.sections).find((item) => String(item && item.id || '') === String(pool.ownerSectionId || pool.id || '')) || null;
    const options = ensureArray(section && section.options).length ? ensureArray(section.options) : ensureArray(scene && scene.options);
    return unique(options.map((option) => {
      const target = option && option.target || {};
      const kind = String(target.kind || '');
      const id = String(target.id || '').replace(/^#/, '');
      if (kind === 'tag' && id) {
        return id;
      }
      const optionId = String(option && option.id || '');
      return optionId.charAt(0) === '#' ? optionId.slice(1) : '';
    }));
  }

  function fallbackMemberCardsForPool(projectIndex, pool, routeTags) {
    const tags = new Set(ensureArray(routeTags).map(String).filter(Boolean));
    const directIds = new Set(ensureArray(pool && pool.directSceneIds).map(String).filter(Boolean));
    return ensureArray(projectIndex && projectIndex.scenes).filter(isCardScene).filter((scene) => {
      const id = String(scene && scene.id || '');
      const sceneTags = ensureArray(scene && scene.tags).map(String);
      return directIds.has(id) || sceneTags.some((tag) => tags.has(tag));
    }).map((scene) => ({
      cardId: String(scene.id || ''),
      key: (isPinnedScene(scene) ? 'advisor:' : 'card:') + String(scene.id || ''),
      title: String(scene.title || scene.id || ''),
      tags: ensureArray(scene.tags).map(String),
      membership: tags.size ? 'tag:' + Array.from(tags).find((tag) => ensureArray(scene.tags).map(String).includes(tag)) : '',
      currentPoolIds: [String(pool && pool.id || '')].filter(Boolean),
      membershipKind: tags.size ? 'tag' : '',
      membershipTag: tags.size ? Array.from(tags).find((tag) => ensureArray(scene.tags).map(String).includes(tag)) || '' : '',
      membershipSource: sourceRef(scene.metadata && scene.metadata.tags || {}),
      editableReason: scene.metadata && scene.metadata.tags && scene.metadata.tags.path ? 'exact_tags_source' : 'missing_tags_source',
      source: sourceRef(scene.sourceSpan || scene.topLevelSpan || {path: scene.path})
    })).sort((left, right) => String(left.title || left.cardId).localeCompare(String(right.title || right.cardId)));
  }

  function availableMemberCardsForDraft(projectIndex, memberRows) {
    const current = new Set(ensureArray(memberRows).map((member) => String(member && member.cardId || '')).filter(Boolean));
    return ensureArray(projectIndex && projectIndex.scenes).filter(isCardScene).filter((scene) => !current.has(String(scene && scene.id || ''))).map((scene) => {
      const source = sourceRef(scene.metadata && scene.metadata.tags || {});
      return {
        cardId: String(scene.id || ''),
        title: String(scene.title || scene.id || ''),
        tags: ensureArray(scene.tags).map(String),
        currentPoolIds: [],
        sourceBacked: Boolean(source.path && source.line),
        membershipSource: source,
        editableReason: source.path && source.line ? 'exact_tags_source' : 'missing_tags_source'
      };
    }).sort((left, right) => String(left.title || left.cardId).localeCompare(String(right.title || right.cardId)));
  }

  function isCardScene(scene) {
    const type = String(scene && scene.type || '');
    const flags = scene && scene.flags || {};
    return type === 'card' || type === 'pinned_card' || type === 'advisor' || flags.isCard || flags.isPinnedCard;
  }

  function isPinnedScene(scene) {
    const type = String(scene && scene.type || '');
    const flags = scene && scene.flags || {};
    return type === 'pinned_card' || type === 'advisor' || flags.isPinnedCard;
  }

  function currentRouteTag(draft) {
    return String(ensureArray(draft && draft.routeTags)[0] || ensureArray(draft && draft.originalRouteTags)[0] || '');
  }

  function normalizeCandidateCard(input) {
    const value = isObject(input) ? input : {};
    return {
      cardId: String(value.cardId || value.id || ''),
      title: String(value.title || value.cardId || value.id || ''),
      tags: ensureArray(value.tags).map(String),
      currentPoolIds: ensureArray(value.currentPoolIds).map(String),
      sourceBacked: Boolean(value.sourceBacked),
      membershipSource: sourceRef(value.membershipSource || value.source || {}),
      editableReason: String(value.editableReason || '')
    };
  }

  function normalizeTargetPool(input) {
    const value = isObject(input) ? input : {};
    return {
      id: String(value.id || ''),
      label: String(value.label || value.id || ''),
      routeTags: ensureArray(value.routeTags).map(String),
      kind: String(value.kind || ''),
      status: String(value.status || '')
    };
  }

  function normalizeMembershipChanges(input) {
    const value = isObject(input) ? input : {};
    const rows = ensureArray(value.membershipChanges).map(normalizeMembershipChange).filter((change) => change.action && change.cardId);
    if (value.addMemberCardId) {
      rows.push(normalizeMembershipChange({action: 'add', cardId: value.addMemberCardId}));
    }
    if (value.removeMemberCardId) {
      rows.push(normalizeMembershipChange({action: 'remove', cardId: value.removeMemberCardId}));
    }
    if (value.moveMemberCardId && value.moveTargetDeckPoolId) {
      rows.push(normalizeMembershipChange({action: 'move', cardId: value.moveMemberCardId, targetDeckPoolId: value.moveTargetDeckPoolId}));
    }
    return dedupeChanges(rows);
  }

  function normalizeMembershipChange(input) {
    const value = isObject(input) ? input : {};
    const action = String(value.action || '').trim();
    const cardId = String(value.cardId || value.id || '').trim();
    return {
      action: action === 'add' || action === 'remove' || action === 'move' ? action : '',
      cardId,
      sourceDeckPoolId: String(value.sourceDeckPoolId || ''),
      targetDeckPoolId: String(value.targetDeckPoolId || value.targetPoolId || '')
    };
  }

  function dedupeChanges(rows) {
    const seen = new Set();
    const out = [];
    ensureArray(rows).forEach((row) => {
      const key = [row.action, row.cardId, row.targetDeckPoolId].join(':');
      if (!row.action || !row.cardId || seen.has(key)) {
        return;
      }
      seen.add(key);
      out.push(row);
    });
    return out;
  }

  function firstChange(rows, action) {
    return ensureArray(rows).find((row) => row.action === action) || {};
  }

  function sceneById(projectIndex, id) {
    return ensureArray(projectIndex && projectIndex.scenes).find((scene) => String(scene && scene.id || '') === String(id || '')) || null;
  }

  function deckPoolModel(projectIndex) {
    const api = deckPoolModelApi();
    if (api && typeof api.buildDeckPoolModel === 'function') {
      return api.buildDeckPoolModel(projectIndex);
    }
    return {deckPools: []};
  }

  function deckPoolModelApi() {
    if (global && global.ProjectMapDeckPoolModel) {
      return global.ProjectMapDeckPoolModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./deck_pool_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function installPlanApi() {
    if (global && global.ProjectMapInstallPlan) {
      return global.ProjectMapInstallPlan;
    }
    if (typeof require === 'function') {
      return require('./install_plan.js');
    }
    throw new Error('ProjectMapInstallPlan is required before deck_pool_draft.js');
  }

  function sourceRef(input) {
    const source = isObject(input) ? input : {};
    return {
      path: String(source.path || '').replace(/\\/g, '/'),
      line: numberOrNull(source.line || source.startLine),
      startLine: numberOrNull(source.startLine || source.line),
      endLine: numberOrNull(source.endLine || source.line || source.startLine),
      anchorText: String(source.anchorText || source.rawAnchorText || ''),
      rawAnchorText: String(source.rawAnchorText || source.anchorText || '')
    };
  }

  function safeId(value) {
    const text = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    return /^[a-z_]/.test(text) ? text : 'deck_pool_' + (text || 'update');
  }

  function unique(values) {
    return Array.from(new Set(ensureArray(values).map(String).filter(Boolean)));
  }

  function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || []));
  }

  const api = {DRAFT_VERSION, defaultDraft, draftForPool, normalizeDraft, buildExportBundle, build: buildExportBundle};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapDeckPoolDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
