(function initProjectMapDeckPoolModel(global) {
  'use strict';

  const MODEL_VERSION = '0.1';

  function buildDeckPoolModel(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const deckPools = enrichDeckPools(buildDeckPools(index), index);
    return {
      schemaVersion: MODEL_VERSION,
      kind: 'deck_pool_model',
      project: index.project || null,
      deckPools,
      poolIds: deckPools.map((pool) => pool.id),
      metrics: {
        deckPoolCount: deckPools.length,
        sourceBackedCount: deckPools.filter((pool) => pool.sourceAnchor && pool.sourceAnchor.path).length,
        partialCount: deckPools.filter((pool) => pool.status === 'partial').length
      }
    };
  }

  function buildDeckPools(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const explicit = ensureArray(index.semantic && index.semantic.deckPools);
    if (explicit.length) {
      return explicit.map((pool) => normalizeDeckPool(pool, index)).filter((pool) => pool.id);
    }
    const scenes = ensureArray(index.scenes);
    const sceneById = new Map(scenes.map((scene) => [String(scene && scene.id || ''), scene]));
    const semanticDecks = ensureArray(index.semantic && index.semantic.decks);
    const deckRefs = semanticDecks.length
      ? semanticDecks
      : scenes.filter(isDeckScene).map((scene) => scene);
    const pools = [];
    deckRefs.forEach((deckRef) => {
      const pool = deckPoolFromRef(deckRef, index, sceneById);
      if (pool && pool.id) {
        pools.push(pool);
      }
    });
    return dedupeById(pools).sort((left, right) => String(left.label || left.id).localeCompare(String(right.label || right.id)));
  }

  function enrichDeckPools(pools, index) {
    const rows = ensureArray(pools).map((pool) => Object.assign({}, pool));
    const cardPoolIds = cardPoolMemberships(rows);
    return rows.map((pool) => {
      const memberCards = ensureArray(pool.memberCards).map((member) => enrichMemberCard(member, pool, index, cardPoolIds));
      return Object.assign({}, pool, {
        memberCards,
        memberCardIds: unique(ensureArray(pool.memberCardIds).concat(memberCards.map((card) => card.cardId))),
        targetDeckPools: targetDeckPoolsFor(pool, rows),
        availableMemberCards: availableMemberCardsFor(pool, rows, index, cardPoolIds)
      });
    });
  }

  function enrichMemberCard(member, pool, index, cardPoolIds) {
    const row = normalizeMemberCard(member);
    const scene = sceneById(index, row.cardId);
    const routeTag = firstRouteTag(pool);
    const membership = membershipInfo(row.membership || (routeTag ? 'tag:' + routeTag : ''));
    const tagSource = sourceRef(scene && scene.metadata && scene.metadata.tags || {});
    const membershipSource = membership.kind === 'tag' ? tagSource : sourceRef(row.source || scene && scene.sourceSpan || {});
    return Object.assign({}, row, {
      title: row.title || String(scene && scene.title || row.cardId || ''),
      tags: row.tags.length ? row.tags : ensureArray(scene && scene.tags).map(String),
      currentPoolIds: ensureArray(cardPoolIds.get(row.cardId)).slice(),
      membershipKind: membership.kind,
      membershipTag: membership.kind === 'tag' ? membership.id : '',
      membershipSource,
      editableReason: editableReasonForMembership(pool, membership, membershipSource)
    });
  }

  function availableMemberCardsFor(pool, pools, index, cardPoolIds) {
    const current = new Set(ensureArray(pool.memberCardIds).map(String));
    return ensureArray(index && index.scenes)
      .filter(isCardScene)
      .filter((scene) => scene && scene.id && !current.has(String(scene.id)))
      .map((scene) => {
        const id = String(scene.id || '');
        const tagSource = sourceRef(scene.metadata && scene.metadata.tags || {});
        return {
          cardId: id,
          title: String(scene.title || id),
          tags: ensureArray(scene.tags).map(String),
          currentPoolIds: ensureArray(cardPoolIds.get(id)).slice(),
          sourceBacked: Boolean(tagSource.path && tagSource.line),
          membershipSource: tagSource,
          editableReason: tagSource.path && tagSource.line ? 'exact_tags_source' : 'missing_tags_source'
        };
      })
      .sort((left, right) => String(left.title || left.cardId).localeCompare(String(right.title || right.cardId)));
  }

  function targetDeckPoolsFor(pool, pools) {
    return ensureArray(pools)
      .filter((candidate) => candidate && String(candidate.id || '') !== String(pool && pool.id || ''))
      .map((candidate) => ({
        id: String(candidate.id || ''),
        label: String(candidate.label || candidate.id || ''),
        routeTags: ensureArray(candidate.routeTags).map(String),
        kind: String(candidate.kind || ''),
        status: String(candidate.status || '')
      }))
      .filter((candidate) => candidate.id);
  }

  function cardPoolMemberships(pools) {
    const map = new Map();
    ensureArray(pools).forEach((pool) => {
      const poolId = String(pool && pool.id || '');
      ensureArray(pool && pool.memberCardIds).concat(ensureArray(pool && pool.memberCards).map((card) => card && card.cardId)).forEach((cardId) => {
        const id = String(cardId || '');
        if (!id || !poolId) {
          return;
        }
        if (!map.has(id)) {
          map.set(id, []);
        }
        if (!map.get(id).includes(poolId)) {
          map.get(id).push(poolId);
        }
      });
    });
    return map;
  }

  function editableReasonForMembership(pool, membership, source) {
    const kind = String(pool && pool.kind || '');
    if (kind === 'hybrid' || kind === 'dynamic_partial') {
      return 'dynamic_or_hybrid_boundary';
    }
    if (!membership || membership.kind !== 'tag') {
      return 'non_tag_membership';
    }
    return source && source.path && source.line ? 'exact_tags_source' : 'missing_tags_source';
  }

  function membershipInfo(value) {
    const parts = String(value || '').split(':');
    return {kind: String(parts[0] || '').trim(), id: String(parts.slice(1).join(':') || '').trim()};
  }

  function firstRouteTag(pool) {
    return String(ensureArray(pool && pool.routeTags)[0] || '');
  }

  function sceneById(index, id) {
    return ensureArray(index && index.scenes).find((scene) => String(scene && scene.id || '') === String(id || '')) || null;
  }

  function deckPoolFromRef(deckRef, index, sceneById) {
    const ref = isObject(deckRef) ? deckRef : {};
    const resolved = resolveDeckRef(ref, sceneById);
    const scene = resolved.scene || {};
    const section = resolved.section || null;
    const options = ensureArray(ref.options).length ? ensureArray(ref.options) : ensureArray(section && section.options || scene.options);
    const targets = options.map((option) => normalizeRouteTarget(option && option.target, option)).filter((target) => target.kind);
    const routeTags = unique(targets.filter((target) => target.kind === 'tag').map((target) => target.id));
    const directSceneIds = unique(targets.filter((target) => target.kind === 'scene').map((target) => target.id));
    const id = String(ref.id || section && section.id || scene.id || '').trim();
    const ownerSceneId = String(ref.ownerSceneId || scene.id || '').trim();
    const ownerSectionId = String(section && section.id || (ref.ownerKind === 'section' ? ref.id : '') || '').trim();
    const sourceAnchor = firstSourceAnchor(options, section || scene);
    const memberCards = memberCardsForTargets(index, targets);
    const kind = deckPoolKind(ref, scene, section, routeTags, directSceneIds);
    const status = kind === 'dynamic_partial' || kind === 'hybrid' ? 'partial' : 'ready';
    return {
      schemaVersion: MODEL_VERSION,
      kind,
      status,
      id,
      key: laneKeyForPoolId(id),
      label: String(ref.title || section && section.title || scene.title || id || 'Deck pool').trim(),
      ownerSceneId,
      ownerSectionId,
      path: normalizePath(ref.path || section && section.path || scene.path || sourceAnchor.path || ''),
      routeTags,
      directSceneIds,
      routeTargets: targets,
      launcherRoutes: launcherRoutesForPool(index, {id, ownerSceneId, ownerSectionId}),
      memberCardIds: memberCards.map((card) => card.cardId),
      memberCards,
      sourceAnchor,
      routeAnchors: options.map((option) => sourceRef(option && option.sourceSpan || option && option.source || {})).filter((source) => source.path),
      manualBoundary: status === 'partial' ? 'Deck pool mixes route styles or lacks stable source evidence; review before applying edits.' : ''
    };
  }

  function normalizeDeckPool(pool, index) {
    const value = isObject(pool) ? pool : {};
    const id = String(value.id || '').trim();
    const targets = ensureArray(value.routeTargets).map((target) => normalizeRouteTarget(target)).filter((target) => target.kind);
    const routeTags = unique(ensureArray(value.routeTags).concat(targets.filter((target) => target.kind === 'tag').map((target) => target.id)).map(String).filter(Boolean));
    const directSceneIds = unique(ensureArray(value.directSceneIds).concat(targets.filter((target) => target.kind === 'scene').map((target) => target.id)).map(String).filter(Boolean));
    const routeTargets = targets.length ? targets : routeTags.map((tag) => ({kind: 'tag', id: tag})).concat(directSceneIds.map((sceneId) => ({kind: 'scene', id: sceneId})));
    const memberCards = ensureArray(value.memberCards).length
      ? ensureArray(value.memberCards).map(normalizeMemberCard).filter((card) => card.cardId)
      : memberCardsForTargets(index, routeTargets);
    const kind = String(value.kind || (routeTags.length && directSceneIds.length ? 'hybrid' : routeTags.length ? 'tag_pool' : directSceneIds.length ? 'direct_scene_pool' : 'dynamic_partial'));
    return {
      schemaVersion: MODEL_VERSION,
      kind,
      status: String(value.status || (kind === 'hybrid' || kind === 'dynamic_partial' ? 'partial' : 'ready')),
      id,
      key: String(value.key || laneKeyForPoolId(id)),
      label: String(value.label || value.title || id || 'Deck pool').trim(),
      ownerSceneId: String(value.ownerSceneId || ''),
      ownerSectionId: String(value.ownerSectionId || ''),
      path: normalizePath(value.path || ''),
      routeTags,
      directSceneIds,
      routeTargets,
      launcherRoutes: ensureArray(value.launcherRoutes).map(normalizeLauncherRoute),
      memberCardIds: unique(ensureArray(value.memberCardIds).concat(memberCards.map((card) => card.cardId)).map(String).filter(Boolean)),
      memberCards,
      sourceAnchor: sourceRef(value.sourceAnchor || value.source || {}),
      routeAnchors: ensureArray(value.routeAnchors).map(sourceRef).filter((source) => source.path),
      manualBoundary: String(value.manualBoundary || '')
    };
  }

  function resolveDeckRef(ref, sceneById) {
    const id = String(ref.id || '');
    const ownerSceneId = String(ref.ownerSceneId || '').trim();
    let scene = sceneById.get(id) || sceneById.get(ownerSceneId) || null;
    let section = null;
    const owner = sceneById.get(ownerSceneId || id.split('.')[0]) || scene;
    if (owner && (String(ref.ownerKind || '') === 'section' || id.indexOf('.') >= 0)) {
      section = ensureArray(owner.sections).find((item) => {
        const sectionId = String(item && item.id || '');
        return sectionId === id || localId(sectionId) === localId(id);
      }) || null;
      if (section) {
        scene = owner;
      }
    }
    return {scene, section};
  }

  function memberCardsForTargets(index, targets) {
    const scenes = ensureArray(index && index.scenes);
    const rows = [];
    scenes.forEach((scene) => {
      if (!isCardScene(scene)) {
        return;
      }
      const matched = targets.find((target) => targetMatchesScene(target, scene));
      if (!matched) {
        return;
      }
      rows.push({
        cardId: String(scene.id || ''),
        key: (isPinnedScene(scene) ? 'advisor:' : 'card:') + String(scene.id || ''),
        title: String(scene.title || scene.id || ''),
        tags: ensureArray(scene.tags).map(String),
        membership: matched.kind + ':' + matched.id,
        source: sourceRef(scene.sourceSpan || scene.topLevelSpan || {path: scene.path})
      });
    });
    return rows.sort((left, right) => String(left.title || left.cardId).localeCompare(String(right.title || right.cardId)));
  }

  function launcherRoutesForPool(index, pool) {
    const targetIds = unique([
      localId(pool.id),
      localId(pool.ownerSectionId),
      pool.ownerSectionId,
      pool.id
    ].map(String).filter(Boolean));
    const rows = [];
    ensureArray(index && index.scenes).forEach((scene) => {
      if (!isHandContainer(scene)) {
        return;
      }
      collectOptions(scene).forEach((row) => {
        const target = row.option && row.option.target || {};
        if (target.kind === 'scene' && targetIds.includes(String(target.id || ''))) {
          rows.push({
            id: String(row.option.id || target.id || ''),
            label: String(row.option.title || row.option.label || row.option.id || target.id || ''),
            targetKind: 'scene',
            targetId: String(target.id || ''),
            ownerSceneId: String(scene.id || ''),
            source: sourceRef(row.option.sourceSpan || row.option.source || row.container && row.container.sourceSpan || {})
          });
        }
      });
    });
    return rows;
  }

  function collectOptions(scene) {
    const rows = ensureArray(scene && scene.options).map((option) => ({option, container: scene}));
    ensureArray(scene && scene.sections).forEach((section) => {
      if (isHandContainer(section)) {
        ensureArray(section.options).forEach((option) => rows.push({option, container: section}));
      }
    });
    return rows;
  }

  function firstSourceAnchor(options, container) {
    const optionAnchor = ensureArray(options).map((option) => sourceRef(option && (option.sourceSpan || option.source) || {})).find((source) => source.path);
    if (optionAnchor) {
      return optionAnchor;
    }
    return sourceRef(container && (container.sourceSpan || container.source) || {});
  }

  function deckPoolKind(ref, scene, section, routeTags, directSceneIds) {
    if (!routeTags.length && !directSceneIds.length) {
      return 'dynamic_partial';
    }
    if (routeTags.length && directSceneIds.length) {
      return 'hybrid';
    }
    if (section || String(ref.ownerKind || '') === 'section') {
      return 'section_owned_deck';
    }
    if (isDeckScene(scene)) {
      return 'scene_deck';
    }
    return routeTags.length ? 'tag_pool' : 'direct_scene_pool';
  }

  function normalizeRouteTarget(target, option) {
    const value = isObject(target) ? target : {};
    const kind = String(value.kind || '').trim();
    const id = String(value.id || '').trim().replace(/^[@#]/, '');
    if (kind === 'tag' || kind === 'scene') {
      return {kind, id, optionId: String(option && option.id || '')};
    }
    const optionId = String(option && option.id || '').trim();
    if (optionId.charAt(0) === '#') {
      return {kind: 'tag', id: optionId.slice(1), optionId};
    }
    if (optionId.charAt(0) === '@') {
      return {kind: 'scene', id: optionId.slice(1), optionId};
    }
    return {kind: '', id: '', optionId};
  }

  function normalizeMemberCard(card) {
    const value = isObject(card) ? card : {};
    return {
      cardId: String(value.cardId || value.id || ''),
      key: String(value.key || ''),
      title: String(value.title || value.cardId || value.id || ''),
      tags: ensureArray(value.tags).map(String),
      membership: String(value.membership || ''),
      source: sourceRef(value.source || {})
    };
  }

  function normalizeLauncherRoute(route) {
    const value = isObject(route) ? route : {};
    return {
      id: String(value.id || ''),
      label: String(value.label || value.title || value.id || ''),
      targetKind: String(value.targetKind || ''),
      targetId: String(value.targetId || ''),
      ownerSceneId: String(value.ownerSceneId || ''),
      source: sourceRef(value.source || {})
    };
  }

  function targetMatchesScene(target, scene) {
    if (!target || !scene) {
      return false;
    }
    if (target.kind === 'scene') {
      return String(target.id || '') === String(scene.id || '');
    }
    if (target.kind === 'tag') {
      return ensureArray(scene.tags).map(String).includes(String(target.id || ''));
    }
    return false;
  }

  function isDeckScene(scene) {
    const type = String(scene && scene.type || '');
    const flags = scene && scene.flags || {};
    return type === 'deck' || flags.isDeck || truthy(scene && scene.isDeck);
  }

  function isHandContainer(value) {
    const type = String(value && value.type || '');
    const flags = value && value.flags || {};
    return type === 'hand' || flags.isHand || truthy(value && value.isHand);
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

  function laneKeyForPool(pool) {
    return laneKeyForPoolId(pool && pool.id || pool);
  }

  function laneKeyForPoolId(id) {
    return 'deck_pool:' + String(id || '').trim();
  }

  function idFromLaneKey(key) {
    return String(key || '').replace(/^deck_pool:/, '');
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    const path = normalizePath(value.path || value.sourcePath || '');
    if (!path) {
      return {};
    }
    const line = numberOrNull(value.line || value.startLine);
    const startLine = numberOrNull(value.startLine || line);
    const endLine = numberOrNull(value.endLine || line || startLine);
    return {
      path,
      line,
      startLine,
      endLine,
      anchorText: String(value.anchorText || ''),
      endAnchorText: String(value.endAnchorText || ''),
      rawAnchorText: String(value.rawAnchorText || ''),
      rawEndAnchorText: String(value.rawEndAnchorText || '')
    };
  }

  function localId(value) {
    return String(value || '').split('.').filter(Boolean).pop() || '';
  }

  function dedupeById(rows) {
    const seen = new Set();
    const out = [];
    ensureArray(rows).forEach((row) => {
      const id = String(row && row.id || '');
      if (!id || seen.has(id)) {
        return;
      }
      seen.add(id);
      out.push(row);
    });
    return out;
  }

  function unique(values) {
    const seen = new Set();
    const out = [];
    ensureArray(values).forEach((value) => {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      out.push(text);
    });
    return out;
  }

  function truthy(value) {
    return /^(1|true|yes|on)$/i.test(String(value || '').trim());
  }

  function normalizePath(value) {
    return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
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

  const api = {
    buildDeckPoolModel,
    buildDeckPools,
    laneKeyForPool,
    idFromLaneKey
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapDeckPoolModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
