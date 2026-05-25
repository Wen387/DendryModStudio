(function initRuntimeVisualSurfaceModel(global) {
  'use strict';

  const MODEL_VERSION = '0.1';
  const SURFACE_STATUSES = ['ready', 'partial', 'blocked', 'failed'];
  const SYSTEM_UI_EVIDENCE_STATES = ['source_backed', 'generated_only', 'runtime_custom', 'ambiguous', 'blocked'];
  const CONFIDENCE_RANK = {manual_review: 0, weak: 1, strong: 2, exact: 3};
  const DEFAULT_LIMITS = {
    candidates: 80,
    diagnostics: 30,
    text: 180
  };
  const OPEN_ROUTE_CLASSES = new Set([
    'direct_field_replace',
    'direct_section_replace',
    'object_workspace',
    'system_ui_workspace'
  ]);

  function buildVisualSurface(input) {
    const value = isObject(input) ? input : {};
    if (isObject(value.runtimeVisualSurface) && !value.runtimeDomMap && !value.projectIndex && !value.runtimeSnapshot) {
      return normalizeVisualSurface(value.runtimeVisualSurface, value);
    }
    const limits = Object.assign({}, DEFAULT_LIMITS, isObject(value.limits) ? value.limits : {});
    const projectIndex = isObject(value.projectIndex) ? value.projectIndex : {};
    const runtimeSnapshot = isObject(value.runtimeSnapshot) ? value.runtimeSnapshot : {};
    const runtimeDomMap = isObject(value.runtimeDomMap)
      ? value.runtimeDomMap
      : isObject(runtimeSnapshot.runtimeDomMap)
        ? runtimeSnapshot.runtimeDomMap
        : {};
    const diagnostics = normalizeDiagnostics(value.diagnostics)
      .concat(normalizeDiagnostics(runtimeSnapshot.diagnostics))
      .concat(normalizeDiagnostics(runtimeDomMap.diagnostics));
    const snapshotStatus = normalizeStatus(runtimeSnapshot.status || '');
    const domMapStatus = normalizeStatus(runtimeDomMap.status || '');

    if (snapshotStatus === 'blocked' || domMapStatus === 'blocked') {
      diagnostics.push(diagnostic('error', 'runtime_visual_surface.blocked_by_dom_map', 'Runtime visual surface authoring is blocked because the runtime DOM map is blocked.'));
      const finalDiagnostics = dedupeDiagnostics(diagnostics).slice(0, limits.diagnostics);
      return visualSurface({
        status: 'blocked',
        capturedAt: runtimeDomMap.capturedAt || runtimeSnapshot.capturedAt || value.capturedAt || '',
        candidates: [],
        diagnostics: finalDiagnostics
      });
    }

    if (snapshotStatus === 'failed' || domMapStatus === 'failed') {
      diagnostics.push(diagnostic('error', 'runtime_visual_surface.blocked_by_dom_map', 'Runtime visual surface authoring could not run because runtime mapping failed.'));
    }

    const capabilityApi = editCapabilityApi();
    const context = {
      projectIndex,
      lookup: buildLookup(projectIndex),
      editCapability: capabilityApi,
      editLookup: capabilityApi && typeof capabilityApi.buildLookup === 'function' ? capabilityApi.buildLookup(projectIndex) : null,
      focus: isObject(value.focus) ? value.focus : {},
      limits
    };
    const candidates = ensureArray(runtimeDomMap.items)
      .map((item, index) => candidateFromDomItem(item, index, context, diagnostics))
      .filter(Boolean)
      .slice(0, limits.candidates);
    if (!candidates.length && snapshotStatus !== 'failed' && domMapStatus !== 'failed') {
      diagnostics.push(diagnostic('warning', 'runtime_visual_surface.no_candidates', 'No runtime visual surface candidates could be derived from the DOM source map.'));
    }
    const finalDiagnostics = dedupeDiagnostics(diagnostics).slice(0, limits.diagnostics);
    return visualSurface({
      status: statusFor({snapshotStatus, domMapStatus, candidates, diagnostics: finalDiagnostics}),
      capturedAt: runtimeDomMap.capturedAt || runtimeSnapshot.capturedAt || value.capturedAt || '',
      candidates,
      diagnostics: finalDiagnostics
    });
  }

  function normalizeVisualSurface(input, options) {
    const value = isObject(input) ? input : {};
    const limits = Object.assign({}, DEFAULT_LIMITS, isObject(options && options.limits) ? options.limits : {});
    const diagnostics = dedupeDiagnostics(normalizeDiagnostics(value.diagnostics)).slice(0, limits.diagnostics);
    const candidates = ensureArray(value.candidates).map((candidate, index) => normalizeCandidate(candidate, index, limits)).filter(Boolean).slice(0, limits.candidates);
    return visualSurface({
      status: normalizeStatus(value.status) || statusFor({candidates, diagnostics}),
      capturedAt: String(value.capturedAt || ''),
      candidates,
      diagnostics
    });
  }

  function candidateFromDomItem(item, index, context, diagnostics) {
    if (!isObject(item)) {
      return null;
    }
    const source = sourceRef(item.source || {});
    const confidence = normalizeConfidence(item.confidence);
    const role = String(item.role || '').trim();
    const base = {
      id: String(item.id || safeId([role, item.selector, item.text || item.src, index].join('_'))),
      role,
      selector: String(item.selector || ''),
      label: clipped(firstNonEmpty(item.text, fileName(item.src), item.selector, role), context.limits.text),
      currentValue: clipped(firstNonEmpty(item.text, item.src, item.selector), context.limits.text),
      text: clipped(item.text || '', context.limits.text),
      src: String(item.src || ''),
      sceneId: String(item.sceneId || ''),
      source,
      confidence,
      reason: clipped(item.reason || '', 260),
      routeClass: '',
      installSafety: '',
      route: null,
      action: {enabled: false, type: '', label: '', reason: ''},
      actions: []
    };

    if (!source.path) {
      diagnostics.push(diagnostic('warning', 'runtime_visual_surface.source_missing', 'A runtime visual surface candidate did not have source evidence.'));
      return normalizeCandidate(Object.assign(base, {
        editability: 'manual_review',
        runtimeEvidenceState: 'runtime_custom',
        systemUiEvidenceState: 'runtime_custom',
        reason: base.reason || 'No source evidence was available for this rendered surface.',
        action: disabledAction('No source route is available.')
      }), index, context.limits);
    }
    if (isGeneratedPath(source.path)) {
      diagnostics.push(diagnostic('warning', 'runtime_visual_surface.generated_runtime_output', 'A runtime visual surface maps only to generated runtime output: ' + source.path));
      return normalizeCandidate(Object.assign(base, {
        editability: 'generated_only',
        runtimeEvidenceState: 'generated_only',
        systemUiEvidenceState: 'generated_only',
        reason: base.reason || 'Generated runtime output stays read-only.',
        action: disabledAction('Generated runtime output is protected.')
      }), index, context.limits);
    }
    if (isAmbiguousDomItem(item)) {
      diagnostics.push(diagnostic('warning', 'runtime_visual_surface.ambiguous_candidate', 'A runtime visual surface matched multiple possible source locations.'));
      return normalizeCandidate(Object.assign(base, {
        editability: 'manual_review',
        runtimeEvidenceState: 'ambiguous',
        systemUiEvidenceState: 'ambiguous',
        reason: base.reason || 'Multiple source candidates need manual review.',
        action: disabledAction('Ambiguous source evidence.')
      }), index, context.limits);
    }
    if (confidenceRank(confidence) < CONFIDENCE_RANK.strong) {
      diagnostics.push(diagnostic('warning', 'runtime_visual_surface.manual_review_surface', 'A weak runtime visual surface candidate remains manual review.'));
      return normalizeCandidate(Object.assign(base, {
        editability: 'manual_review',
        runtimeEvidenceState: 'ambiguous',
        systemUiEvidenceState: 'ambiguous',
        reason: base.reason || 'Weak runtime mapping is evidence only.',
        action: disabledAction('Weak mapping cannot open an edit route.')
      }), index, context.limits);
    }

    if (isAssetLike(base)) {
      return assetCandidate(base, index, context, diagnostics);
    }
    if (isReviewOnlyVisual(base)) {
      diagnostics.push(diagnostic('warning', 'runtime_visual_surface.manual_review_surface', 'A graphics/sidebar/runtime UI surface remains manual review.'));
      return normalizeCandidate(Object.assign(base, {
        editability: 'manual_review',
        runtimeEvidenceState: 'runtime_custom',
        systemUiEvidenceState: 'runtime_custom',
        reason: base.reason || 'Custom graphics, sidebars, D3, and runtime UI remain manual review unless a precise source-backed text route exists.',
        action: disabledAction('No safe visual edit route exists yet.')
      }), index, context.limits);
    }
    return textCandidate(base, index, context, diagnostics);
  }

  function textCandidate(base, index, context, diagnostics) {
    const match = matchTextSource(base, context.lookup);
    if (match.ambiguous) {
      diagnostics.push(diagnostic('warning', 'runtime_visual_surface.ambiguous_candidate', 'Runtime text matched multiple ProjectIndex text rows.'));
      return normalizeCandidate(Object.assign(base, {
        editability: 'manual_review',
        runtimeEvidenceState: 'ambiguous',
        systemUiEvidenceState: 'ambiguous',
        reason: 'Multiple source text rows match this rendered surface.',
        action: disabledAction('Ambiguous text source.')
      }), index, context.limits);
    }
    if (!match.item) {
      diagnostics.push(diagnostic('warning', 'runtime_visual_surface.not_edit_capable', 'Runtime text source was found, but no editable ProjectIndex text row matched it.'));
      return normalizeCandidate(Object.assign(base, {
        editability: 'proposal_only',
        runtimeEvidenceState: 'source_backed',
        systemUiEvidenceState: 'source_backed',
        reason: base.reason || 'Source-backed runtime text did not match a unique editable Text Corpus or Surface Text item.',
        action: disabledAction('No unique text edit route.')
      }), index, context.limits);
    }
    const capability = buildCapability(context, match.view, match.item);
    return capabilityCandidate(base, index, context, diagnostics, capability, {
      view: match.view,
      itemId: match.item.id || match.item.itemId || ''
    });
  }

  function assetCandidate(base, index, context, diagnostics) {
    const match = matchAssetSource(base, context.lookup);
    const sceneId = base.sceneId || match.sceneId || '';
    const scene = sceneId ? context.lookup.scenesById.get(sceneId) : null;
    if (!scene) {
      diagnostics.push(diagnostic('warning', 'runtime_visual_surface.asset_route_limited', 'Runtime asset could not be routed to a unique owning scene.'));
      return normalizeCandidate(Object.assign(base, {
        editability: 'proposal_only',
        runtimeEvidenceState: 'source_backed',
        systemUiEvidenceState: 'source_backed',
        reason: 'Runtime asset evidence is source-backed, but the owning scene route is not unique.',
        action: disabledAction('No unique owning scene route.')
      }), index, context.limits);
    }
    const capability = buildCapability(context, 'scenes', scene);
    const routed = capability && OPEN_ROUTE_CLASSES.has(String(capability.routeClass || ''));
    if (!routed) {
      diagnostics.push(diagnostic('warning', 'runtime_visual_surface.asset_route_limited', 'Runtime asset can be reviewed, but no owning object workspace route was available.'));
    }
    const routeAction = routed ? openRouteAction(capability, 'Open owning workspace') : disabledAction('No owning workspace route.');
    const draftProbe = buildAssetDraftProbe(context, Object.assign({}, base, {
      routeClass: capability && capability.routeClass || '',
      installSafety: capability && capability.installSafety || 'manual_review',
      route: capability || null,
      action: routeAction
    }));
    const assetDraftAction = draftAction(draftProbe);
    const actions = [routeAction, assetDraftAction].filter(Boolean);
    return normalizeCandidate(Object.assign(base, {
      editability: 'proposal_only',
      runtimeEvidenceState: 'source_backed',
      systemUiEvidenceState: 'source_backed',
      routeClass: capability && capability.routeClass || '',
      installSafety: capability && capability.installSafety || 'manual_review',
      route: capability || null,
      reason: assetDraftAction.enabled
        ? 'Runtime asset matched source usage evidence; Studio can prepare a reviewable asset reference draft.'
        : 'Runtime asset matched source usage evidence; open the owning workspace for review.',
      assetDirective: draftProbe && draftProbe.currentAsset && draftProbe.currentAsset.directive || '',
      assetDraftStatus: draftProbe && draftProbe.status || '',
      replacementTargetPath: draftProbe && draftProbe.replacementAsset && draftProbe.replacementAsset.path || '',
      action: routeAction.enabled ? routeAction : assetDraftAction,
      actions
    }), index, context.limits);
  }

  function capabilityCandidate(base, index, context, diagnostics, capability, meta) {
    const routeClass = String(capability && capability.routeClass || '');
    const safety = String(capability && capability.installSafety || '');
    const canOpen = OPEN_ROUTE_CLASSES.has(routeClass);
    const safeDraft = canOpen && (safety === 'safe_apply' || safety === 'guarded_apply');
    if (!capability || !canOpen) {
      diagnostics.push(diagnostic('warning', 'runtime_visual_surface.not_edit_capable', 'Runtime visual surface source is not connected to an editable route yet.'));
    }
    return normalizeCandidate(Object.assign(base, {
      editability: safeDraft ? 'draftable' : 'proposal_only',
      runtimeEvidenceState: 'source_backed',
      systemUiEvidenceState: 'source_backed',
      routeClass,
      installSafety: safety || 'manual_review',
      route: capability || null,
      view: meta && meta.view || '',
      itemId: meta && meta.itemId || '',
      reason: capability && capability.reason || base.reason || 'Runtime visual surface is source-backed.',
      action: safeDraft
        ? openRouteAction(capability, actionLabel(capability))
        : canOpen
          ? disabledAction('Route exists but remains proposal/manual review for this surface.')
          : disabledAction('No safe edit route exists yet.'),
      actions: [safeDraft ? openRouteAction(capability, actionLabel(capability)) : canOpen ? disabledAction('Route exists but remains proposal/manual review for this surface.') : disabledAction('No safe edit route exists yet.')]
    }), index, context.limits);
  }

  function buildAssetDraftProbe(context, candidate) {
    const api = runtimeVisualAssetDraftApi();
    if (!api || typeof api.buildAssetDraft !== 'function') {
      return null;
    }
    try {
      return api.buildAssetDraft({
        projectIndex: context.projectIndex,
        candidate
      });
    } catch (_err) {
      return null;
    }
  }

  function draftAction(assetDraft) {
    const status = String(assetDraft && assetDraft.status || '');
    const enabled = Boolean(assetDraft && assetDraft.draft && (status === 'ready' || status === 'proposal_only'));
    const firstDiagnostic = ensureArray(assetDraft && assetDraft.diagnostics).find((diag) => diag && diag.severity !== 'info') || null;
    return {
      enabled,
      type: 'create_asset_reference_draft',
      label: 'Create asset draft',
      reason: enabled
        ? 'Prepare a reviewable source asset reference proposal.'
        : firstDiagnostic && (firstDiagnostic.message || firstDiagnostic.code) || 'No safe asset draft route exists yet.',
      target: {
        status,
        source: assetDraft && assetDraft.source || {},
        owner: assetDraft && assetDraft.owner || {},
        currentAsset: assetDraft && assetDraft.currentAsset || {},
        replacementAsset: assetDraft && assetDraft.replacementAsset || {}
      }
    };
  }

  function buildCapability(context, view, item) {
    const api = context.editCapability;
    if (!api || typeof api.buildEditCapability !== 'function') {
      return null;
    }
    try {
      return api.buildEditCapability(context.projectIndex, view, item, context.editLookup ? {lookup: context.editLookup} : {});
    } catch (err) {
      return {
        routeClass: 'manual_review',
        installSafety: 'manual_review',
        reason: err && err.message ? err.message : String(err),
        diagnostics: [{severity: 'warning', code: 'runtime_visual_surface.edit_capability_failed', message: err && err.message ? err.message : String(err)}]
      };
    }
  }

  function matchTextSource(base, lookup) {
    const rows = lookup.textCorpus.map((item) => ({view: 'textCorpus', item}))
      .concat(lookup.surfaceText.map((item) => ({view: 'surfaceText', item})));
    const sourceMatches = rows.filter((row) => sourceMatchesRow(base.source, row.item.source || row.item.sourceSpan || {}));
    const textMatchesRows = sourceMatches.length
      ? sourceMatches.filter((row) => !base.text || textMatches(base.text, row.item.text || row.item.label || row.item.title || ''))
      : rows.filter((row) => {
        const itemSource = sourceRef(row.item.source || row.item.sourceSpan || {});
        if (base.sceneId && ownerSceneId(row.item) && ownerSceneId(row.item) !== base.sceneId) {
          return false;
        }
        return itemSource.path && samePath(itemSource.path, base.source.path) &&
          (!base.text || textMatches(base.text, row.item.text || row.item.label || row.item.title || ''));
      });
    const matches = textMatchesRows.length ? textMatchesRows : sourceMatches;
    if (!matches.length) {
      return {item: null, view: '', ambiguous: false};
    }
    const unique = dedupeRows(matches);
    if (unique.length > 1) {
      return {item: null, view: '', ambiguous: true};
    }
    return unique[0];
  }

  function matchAssetSource(base, lookup) {
    const basename = fileName(base.src || base.currentValue);
    const source = base.source;
    const matches = lookup.assets.filter((asset) => {
      if (basename && [asset.path, asset.previewUrl, asset.name, asset.label].some((value) => fileName(value) === basename)) {
        return true;
      }
      const assetSource = sourceRef(asset.source || {});
      if (assetSource.path && source.path && samePath(assetSource.path, source.path)) {
        return true;
      }
      return ensureArray(asset.usageRefs).some((usage) => sourceMatchesRow(source, usage && usage.source || {}));
    });
    const usage = matches.flatMap((asset) => ensureArray(asset.usageRefs).map((row) => ({asset, usage: row})))
      .find((row) => base.sceneId && (row.usage.sceneId === base.sceneId || row.usage.id === base.sceneId)) ||
      matches.flatMap((asset) => ensureArray(asset.usageRefs).map((row) => ({asset, usage: row})))[0] || null;
    return {
      asset: matches[0] || null,
      sceneId: usage && (usage.usage.sceneId || usage.usage.id) || base.sceneId || ''
    };
  }

  function buildLookup(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const semantic = isObject(index.semantic) ? index.semantic : {};
    const scenes = ensureArray(index.scenes);
    const scenesById = new Map();
    scenes.forEach((scene) => {
      if (scene && scene.id) {
        scenesById.set(String(scene.id), scene);
      }
    });
    return {
      scenes,
      scenesById,
      textCorpus: ensureArray(semantic.textCorpus && semantic.textCorpus.items),
      surfaceText: ensureArray(semantic.surfaceText && semantic.surfaceText.items),
      assets: ensureArray(semantic.assets && semantic.assets.items)
    };
  }

  function normalizeCandidate(input, index, limits) {
    if (!isObject(input)) {
      return null;
    }
    const route = isObject(input.route) ? input.route : null;
    const action = isObject(input.action) ? input.action : {};
    const actions = normalizeActions(input.actions || (action.type || action.reason ? [action] : []), input, route);
    const source = sourceRef(input.source || {});
    return {
      id: String(input.id || safeId([input.role, input.selector, input.currentValue, index].join('_'))),
      role: String(input.role || ''),
      selector: String(input.selector || ''),
      label: clipped(input.label || input.currentValue || input.text || input.src || input.role || '', limits.text),
      currentValue: clipped(input.currentValue || input.text || input.src || '', limits.text),
      text: clipped(input.text || '', limits.text),
      src: String(input.src || ''),
      sceneId: String(input.sceneId || ''),
      source,
      confidence: normalizeConfidence(input.confidence),
      editability: normalizeEditability(input.editability),
      runtimeEvidenceState: normalizeSystemUiEvidenceState(input.runtimeEvidenceState || input.systemUiEvidenceState || evidenceStateFromCandidateInput(input, source)),
      systemUiEvidenceState: normalizeSystemUiEvidenceState(input.systemUiEvidenceState || input.runtimeEvidenceState || evidenceStateFromCandidateInput(input, source)),
      themeLayoutCandidate: themeLayoutCandidateForCandidate(input, source),
      routeClass: String(input.routeClass || route && route.routeClass || ''),
      installSafety: String(input.installSafety || route && route.installSafety || ''),
      view: String(input.view || ''),
      itemId: String(input.itemId || ''),
      route,
      action: {
        enabled: action.enabled === true,
        type: String(action.type || ''),
        label: String(action.label || ''),
        reason: String(action.reason || ''),
        routeClass: String(action.routeClass || input.routeClass || route && route.routeClass || ''),
        target: isObject(action.target) ? action.target : route && isObject(route.target) ? route.target : {}
      },
      actions,
      assetDirective: String(input.assetDirective || ''),
      assetDraftStatus: String(input.assetDraftStatus || ''),
      replacementTargetPath: String(input.replacementTargetPath || ''),
      reason: clipped(input.reason || action.reason || '', 280)
    };
  }

  function normalizeActions(actions, input, route) {
    const source = ensureArray(actions).map((action) => normalizeAction(action, input, route)).filter(Boolean);
    if (source.length) {
      return source;
    }
    return [normalizeAction(disabledAction('No action available.'), input, route)];
  }

  function normalizeAction(action, input, route) {
    if (!isObject(action)) {
      return null;
    }
    return {
      enabled: action.enabled === true,
      type: String(action.type || ''),
      label: String(action.label || ''),
      reason: String(action.reason || ''),
      routeClass: String(action.routeClass || input.routeClass || route && route.routeClass || ''),
      target: isObject(action.target) ? action.target : route && isObject(route && route.target) ? route.target : {}
    };
  }

  function visualSurface(input) {
    const candidates = ensureArray(input.candidates);
    const diagnostics = ensureArray(input.diagnostics);
    return {
      schemaVersion: MODEL_VERSION,
      kind: 'runtime_visual_surface',
      status: normalizeStatus(input.status) || statusFor({candidates, diagnostics}),
      capturedAt: String(input.capturedAt || ''),
      summary: summaryFor(candidates, diagnostics),
      candidates,
      diagnostics,
      confidence: candidates.some((candidate) => candidate.editability === 'draftable') ? 'runtime' : 'profile'
    };
  }

  function summaryFor(candidates, diagnostics) {
    const rows = ensureArray(candidates);
    return {
      candidateCount: rows.length,
      draftableCount: rows.filter((item) => item.editability === 'draftable').length,
      proposalOnlyCount: rows.filter((item) => item.editability === 'proposal_only').length,
      manualReviewCount: rows.filter((item) => item.editability === 'manual_review').length,
      generatedOnlyCount: rows.filter((item) => item.editability === 'generated_only').length,
      sourceBackedRuntimeCount: rows.filter((item) => item.runtimeEvidenceState === 'source_backed').length,
      generatedOnlyRuntimeCount: rows.filter((item) => item.runtimeEvidenceState === 'generated_only').length,
      runtimeCustomCount: rows.filter((item) => item.runtimeEvidenceState === 'runtime_custom').length,
      ambiguousRuntimeCount: rows.filter((item) => item.runtimeEvidenceState === 'ambiguous').length,
      blockedRuntimeCount: rows.filter((item) => item.runtimeEvidenceState === 'blocked').length,
      themeLayoutCandidateCount: rows.filter((item) => item.themeLayoutCandidate && item.themeLayoutCandidate.supported).length,
      diagnosticCount: ensureArray(diagnostics).length
    };
  }

  function statusFor(context) {
    const diagnostics = ensureArray(context && context.diagnostics);
    const candidates = ensureArray(context && context.candidates);
    if (context && (context.snapshotStatus === 'blocked' || context.domMapStatus === 'blocked')) {
      return 'blocked';
    }
    if (context && (context.snapshotStatus === 'failed' || context.domMapStatus === 'failed') || diagnostics.some((diag) => diag && diag.severity === 'error')) {
      return 'failed';
    }
    if (!candidates.length) {
      return 'partial';
    }
    if (candidates.every((candidate) => candidate.editability === 'draftable')) {
      return 'ready';
    }
    return 'partial';
  }

  function normalizeSystemUiEvidenceState(value) {
    const text = String(value || '').trim();
    if (SYSTEM_UI_EVIDENCE_STATES.includes(text)) {
      return text;
    }
    if (text === 'ready' || text === 'draftable') {
      return 'source_backed';
    }
    if (text === 'manual_review' || text === 'proposal_only' || text === 'weak') {
      return 'ambiguous';
    }
    return '';
  }

  function evidenceStateFromCandidateInput(input, source) {
    const editability = String(input && input.editability || '').trim();
    if (editability === 'generated_only' || isGeneratedPath(source && source.path)) {
      return 'generated_only';
    }
    if (/ambiguous|multiple/i.test(String(input && input.reason || input && input.action && input.action.reason || ''))) {
      return 'ambiguous';
    }
    if (editability === 'manual_review' && !source.path) {
      return 'runtime_custom';
    }
    if (source && source.path) {
      return 'source_backed';
    }
    return 'runtime_custom';
  }

  function themeLayoutCandidateForCandidate(input, source) {
    const text = [input && input.role, input && input.selector, input && input.label, input && input.currentValue].join(' ').toLowerCase();
    const sourceBacked = source && source.path && !isGeneratedPath(source.path);
    const safeToken = /color|theme|layout|sidebar|title|heading|label|copy|route|category/.test(text);
    return {
      supported: Boolean(sourceBacked && safeToken && !/selector|class|svg|canvas|d3|geometry/.test(text)),
      scope: sourceBacked && safeToken ? 'limited_source_backed' : 'manual_runtime_observed',
      manualOnly: !sourceBacked || /selector|class|svg|canvas|d3|geometry/.test(text),
      reason: sourceBacked && safeToken
        ? 'Source-backed theme/layout-like token may be reviewed as a limited candidate.'
        : 'Runtime selector, class, SVG geometry, D3, or custom renderer evidence remains manual review.'
    };
  }

  function openRouteAction(capability, fallbackLabel) {
    const routeClass = String(capability && capability.routeClass || '');
    return {
      enabled: true,
      type: 'open_route',
      label: String(fallbackLabel || 'Open route'),
      reason: String(capability && capability.reason || ''),
      routeClass,
      target: isObject(capability && capability.target) ? capability.target : {}
    };
  }

  function disabledAction(reason) {
    return {enabled: false, type: '', label: '', reason: String(reason || '')};
  }

  function actionLabel(capability) {
    const api = editCapabilityApi();
    return api && typeof api.routeActionLabel === 'function'
      ? api.routeActionLabel(capability && capability.routeClass || '')
      : 'Open edit route';
  }

  function isAssetLike(candidate) {
    const text = [candidate.role, candidate.selector, candidate.src].join(' ').toLowerCase();
    return Boolean(candidate.src) || /asset|image|portrait|face|background|card-img|card_image|audio/.test(text);
  }

  function isReviewOnlyVisual(candidate) {
    const text = [candidate.role, candidate.selector].join(' ').toLowerCase();
    return /d3|graph|chart|svg|canvas|sidebar|qdisplay|options|save/.test(text) && !candidate.text;
  }

  function isAmbiguousDomItem(item) {
    return /multiple|ambiguous/i.test(String(item && item.reason || ''));
  }

  function sourceMatchesRow(source, rowSource) {
    const left = sourceRef(source || {});
    const right = sourceRef(rowSource || {});
    if (!left.path || !right.path || !samePath(left.path, right.path)) {
      return false;
    }
    if (!left.line || !right.line) {
      return true;
    }
    const endLine = right.endLine || right.line;
    return left.line >= right.line && left.line <= endLine;
  }

  function ownerSceneId(item) {
    const owner = isObject(item && item.owner) ? item.owner : {};
    return String(item && (item.sceneId || item.ownerSceneId) || owner.sceneId || '');
  }

  function dedupeRows(rows) {
    const seen = new Set();
    const out = [];
    ensureArray(rows).forEach((row) => {
      const source = sourceRef(row.item && (row.item.source || row.item.sourceSpan) || {});
      const key = [row.view, row.item && (row.item.id || row.item.itemId) || '', source.path, source.line || '', row.item && (row.item.text || row.item.label || '') || ''].join('\n');
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      out.push(row);
    });
    return out;
  }

  function textMatches(left, right) {
    const a = normalizedText(left);
    const b = normalizedText(right);
    if (!a || !b) {
      return false;
    }
    return a === b || a.includes(b) || b.includes(a) || textScore(a, b) >= 0.72;
  }

  function textScore(left, right) {
    const a = new Set(String(left || '').split(' ').filter(Boolean));
    const b = new Set(String(right || '').split(' ').filter(Boolean));
    if (!a.size || !b.size) {
      return 0;
    }
    let shared = 0;
    a.forEach((token) => {
      if (b.has(token)) {
        shared += 1;
      }
    });
    return shared / Math.max(a.size, b.size);
  }

  function normalizedText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/<[^>]*>/g, ' ')
      .replace(/&[a-z0-9#]+;/g, ' ')
      .replace(/[^a-z0-9\u00c0-\uffff]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeStatus(value) {
    const text = String(value || '').trim().toLowerCase();
    return SURFACE_STATUSES.indexOf(text) >= 0 ? text : '';
  }

  function normalizeConfidence(value) {
    const text = String(value || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(CONFIDENCE_RANK, text) ? text : 'manual_review';
  }

  function confidenceRank(value) {
    return CONFIDENCE_RANK[normalizeConfidence(value)] || 0;
  }

  function normalizeEditability(value) {
    const text = String(value || '').trim().toLowerCase();
    if (text === 'draftable' || text === 'proposal_only' || text === 'manual_review' || text === 'generated_only') {
      return text;
    }
    return 'manual_review';
  }

  function sourceRef(input) {
    const value = isObject(input) ? input : {};
    const path = normalizePath(value.path || value.sourcePath || '');
    const line = positiveInteger(value.line || value.startLine, 0);
    const endLine = positiveInteger(value.endLine || value.line || value.startLine, 0);
    const ref = {path};
    if (line) {
      ref.line = line;
    }
    if (value.startLine) {
      ref.startLine = positiveInteger(value.startLine, 0);
    }
    if (endLine) {
      ref.endLine = endLine;
    }
    return ref;
  }

  function isGeneratedPath(path) {
    const rel = normalizePath(path);
    return rel === 'out/game.json' || rel.startsWith('out/html/') || rel.startsWith('out/');
  }

  function normalizePath(value) {
    return String(value || '').trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+/g, '/');
  }

  function samePath(left, right) {
    return normalizePath(left) === normalizePath(right);
  }

  function fileName(value) {
    const normalized = normalizePath(value).split(/[?#]/)[0];
    const parts = normalized.split('/');
    return parts[parts.length - 1] || '';
  }

  function normalizeDiagnostics(rows) {
    return ensureArray(rows).map((item) => {
      if (!item) {
        return null;
      }
      return {
        severity: String(item.severity || 'warning'),
        code: String(item.code || 'runtime_visual_surface.diagnostic'),
        message: String(item.message || item.code || 'Runtime visual surface diagnostic.'),
        confidence: String(item.confidence || 'runtime'),
        path: item.path,
        missingPath: item.missingPath
      };
    }).filter(Boolean);
  }

  function dedupeDiagnostics(rows) {
    const seen = new Set();
    const out = [];
    ensureArray(rows).forEach((diag) => {
      const key = [diag && diag.severity, diag && diag.code, diag && diag.message, diag && diag.path || '', diag && diag.missingPath || ''].join('\n');
      if (!diag || seen.has(key)) {
        return;
      }
      seen.add(key);
      out.push(diag);
    });
    return out;
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message, confidence: 'runtime'};
  }

  function editCapabilityApi() {
    if (global && global.ProjectMapEditCapability) {
      return global.ProjectMapEditCapability;
    }
    if (typeof require === 'function') {
      try {
        return require('./edit_capability_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function runtimeVisualAssetDraftApi() {
    if (global && global.ProjectMapRuntimeVisualAssetDraftModel) {
      return global.ProjectMapRuntimeVisualAssetDraftModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./runtime_visual_asset_draft_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function safeId(value) {
    return String(value || 'runtime_visual_surface')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'runtime_visual_surface';
  }

  function clipped(value, limit) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    const max = positiveInteger(limit, DEFAULT_LIMITS.text);
    return text.length > max ? text.slice(0, Math.max(0, max - 3)) + '...' : text;
  }

  function firstNonEmpty() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value);
      }
    }
    return '';
  }

  function positiveInteger(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {
    MODEL_VERSION,
    SURFACE_STATUSES,
    buildVisualSurface,
    normalizeVisualSurface
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapRuntimeVisualSurfaceModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
