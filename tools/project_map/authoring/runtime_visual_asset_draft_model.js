(function initRuntimeVisualAssetDraftModel(global) {
  'use strict';

  const MODEL_VERSION = '0.1';
  const MODEL_KIND = 'runtime_visual_asset_draft';
  const STATUSES = ['ready', 'proposal_only', 'manual_review', 'blocked', 'failed'];
  const CONFIDENCE_RANK = {manual_review: 0, weak: 1, strong: 2, exact: 3};
  const DIRECTIVES = new Set(['face-image', 'card-image', 'set-bg', 'audio']);
  const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
  const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.flac', '.m4a']);

  function buildAssetDraft(input) {
    const value = isObject(input) ? input : {};
    if (isObject(value.runtimeVisualAssetDraft) && !value.candidate && !value.runtimeVisualSurface) {
      return normalizeAssetDraft(value.runtimeVisualAssetDraft);
    }
    const diagnostics = normalizeDiagnostics(value.diagnostics);
    const projectIndex = isObject(value.projectIndex) ? value.projectIndex : {};
    const candidate = resolveCandidate(value);
    if (!candidate) {
      diagnostics.push(diagnostic('error', 'runtime_visual_asset_draft.blocked_by_candidate', 'Runtime visual asset draft needs an asset-like visual surface candidate.'));
      return assetDraft({status: 'blocked', diagnostics});
    }
    const source = sourceRef(candidate.source || {});
    if (isGeneratedPath(source.path) || String(candidate.editability || '') === 'generated_only') {
      diagnostics.push(diagnostic('error', 'runtime_visual_asset_draft.generated_runtime_output', 'Generated runtime output stays read-only; edit the source asset reference instead.'));
      return assetDraft({status: 'blocked', candidate, source, diagnostics});
    }
    if (!source.path || !source.line) {
      diagnostics.push(diagnostic('error', 'runtime_visual_asset_draft.source_missing', 'Runtime asset candidate does not include a source file and line.'));
      return assetDraft({status: 'blocked', candidate, source, diagnostics});
    }
    if (confidenceRank(candidate.confidence) < CONFIDENCE_RANK.strong || !isAssetLike(candidate)) {
      diagnostics.push(diagnostic('warning', 'runtime_visual_asset_draft.blocked_by_candidate', 'Runtime asset draft requires strong or exact asset-like source mapping.'));
      return assetDraft({status: 'manual_review', candidate, source, diagnostics});
    }
    if (isAmbiguousCandidate(candidate)) {
      diagnostics.push(diagnostic('warning', 'runtime_visual_asset_draft.ambiguous_asset_source', 'Runtime asset candidate matched multiple possible source locations.'));
      return assetDraft({status: 'manual_review', candidate, source, diagnostics});
    }

    const lookup = buildLookup(projectIndex);
    const match = matchAssetEvidence(candidate, lookup, value.runtimeDomMap);
    if (match.ambiguous) {
      diagnostics.push(diagnostic('warning', 'runtime_visual_asset_draft.ambiguous_asset_source', 'Multiple asset references share this source directive line; review the source manually before replacing it.'));
      return assetDraft({
        status: 'manual_review',
        candidate,
        source,
        currentAsset: currentAsset(candidate, match),
        owner: ownerFor(candidate, match, lookup),
        diagnostics
      });
    }
    const directive = normalizeDirective(match.directive || candidate.assetDirective || candidate.role);
    if (!directive) {
      diagnostics.push(diagnostic('warning', 'runtime_visual_asset_draft.unsupported_asset_directive', 'Only face-image, card-image, set-bg, and audio directives can be drafted safely in this phase.'));
      return assetDraft({
        status: 'manual_review',
        candidate,
        source,
        currentAsset: currentAsset(candidate, match),
        owner: ownerFor(candidate, match, lookup),
        diagnostics
      });
    }

    const current = currentAsset(candidate, Object.assign({}, match, {directive}));
    const owner = ownerFor(candidate, match, lookup);
    if (!owner.sceneId) {
      diagnostics.push(diagnostic('warning', 'runtime_visual_asset_draft.ambiguous_asset_source', 'Runtime asset draft could not identify a unique owning scene.'));
      return assetDraft({status: 'manual_review', candidate, source, currentAsset: current, owner, diagnostics});
    }

    const replacementFile = normalizeReplacementFile(value.replacementFile || value.replacement || {});
    const targetPath = normalizePath(value.targetPath || value.replacementPath || replacementFile.targetPath) ||
      suggestedTargetPath({candidate, currentAsset: current, owner, replacementFile, directive});
    const replacement = replacementAsset(replacementFile, targetPath, current, directive);
    if (!replacement.sourcePath) {
      diagnostics.push(diagnostic('warning', 'runtime_visual_asset_draft.replacement_file_missing', 'No replacement file is selected yet; this proposal will require manual asset file review.'));
    }

    const beforeLine = directive + ': ' + current.path;
    const afterLine = directive + ': ' + replacement.path;
    const change = {
      fieldId: safeId(['asset', directive, source.line].join('_')),
      role: 'asset_reference',
      label: directiveLabel(directive),
      sectionId: '',
      optionId: '',
      source,
      editability: sourceCanGuard(source, beforeLine) ? 'guarded_replace_text' : 'manual_review',
      operationType: 'replace_text',
      startLine: source.line || null,
      endLine: source.endLine || source.line || null,
      before: beforeLine,
      after: afterLine
    };
    if (change.editability === 'manual_review') {
      diagnostics.push(diagnostic('warning', 'runtime_visual_asset_draft.manual_review_required', 'Asset directive replacement needs manual review because guarded source evidence is incomplete.'));
    }

    const assetInstallRequests = [assetInstallRequest(replacement, current, directive)];
    const draft = existingSceneProposal({
      candidate,
      owner,
      source,
      change,
      assetInstallRequests,
      diagnostics,
      replacement
    });
    const installPlan = buildInstallPlan(projectIndex, draft);
    return assetDraft({
      status: replacement.sourcePath ? 'ready' : 'proposal_only',
      candidate,
      source,
      owner,
      currentAsset: current,
      replacementAsset: replacement,
      changes: [change],
      draft,
      installPlan,
      diagnostics
    });
  }

  function normalizeAssetDraft(input) {
    const value = isObject(input) ? input : {};
    return assetDraft({
      status: normalizeStatus(value.status) || 'manual_review',
      candidate: isObject(value.candidate) ? value.candidate : null,
      source: sourceRef(value.source || {}),
      owner: normalizeOwner(value.owner || {}),
      currentAsset: normalizeAsset(value.currentAsset || {}),
      replacementAsset: normalizeAsset(value.replacementAsset || {}),
      changes: ensureArray(value.changes).map(normalizeChange).filter(Boolean),
      draft: isObject(value.draft) ? value.draft : null,
      installPlan: isObject(value.installPlan) ? value.installPlan : null,
      diagnostics: normalizeDiagnostics(value.diagnostics)
    });
  }

  function resolveCandidate(value) {
    if (isObject(value.candidate)) {
      return value.candidate;
    }
    const visualSurface = isObject(value.runtimeVisualSurface) ? value.runtimeVisualSurface : {};
    const candidateId = String(value.candidateId || '');
    const rows = ensureArray(visualSurface.candidates);
    if (candidateId) {
      return rows.find((item) => String(item && item.id || '') === candidateId) || null;
    }
    return rows.find(isAssetLike) || null;
  }

  function matchAssetEvidence(candidate, lookup) {
    const source = sourceRef(candidate.source || {});
    const scene = sceneForCandidate(candidate, lookup);
    const basename = fileName(candidate.src || candidate.currentValue || candidate.label);
    const sceneRefs = ensureArray(scene && scene.assetRefs).filter((ref) => {
      const refSource = sourceRef(ref && ref.source || {});
      const refBase = fileName(ref && (ref.path || ref.previewUrl || ref.src) || '');
      return sourceMatches(source, refSource) && (!basename || refBase === basename || pathEndsWith(candidate.src, ref && (ref.path || ref.previewUrl)));
    });
    const sceneRef = sceneRefs[0] || null;
    if (sceneRef) {
      const directive = sceneRef.directive || sceneRef.role || '';
      const sameDirectiveLine = ensureArray(scene && scene.assetRefs).filter((ref) => {
        return sourceMatches(source, ref && ref.source || {}) &&
          normalizeDirective(ref && (ref.directive || ref.role)) === normalizeDirective(directive);
      });
      return {
        scene,
        source: sourceRef(sceneRef.source || {}),
        path: normalizePath(sceneRef.path || sceneRef.previewUrl || ''),
        previewUrl: String(sceneRef.previewUrl || ''),
        type: sceneRef.type || assetTypeForPath(sceneRef.path || sceneRef.previewUrl),
        directive,
        fileExists: sceneRef.fileExists,
        ambiguous: sameDirectiveLine.length > 1
      };
    }

    const asset = lookup.assets.find((item) => {
      const values = [item.path, item.previewUrl, item.name, item.label];
      const byName = basename && values.some((value) => fileName(value) === basename || pathEndsWith(candidate.src, value));
      const byUsage = ensureArray(item.usageRefs).some((usage) => sourceMatches(source, usage && usage.source || {}));
      return byName || byUsage;
    }) || null;
    const usage = asset && (ensureArray(asset.usageRefs).find((row) => sourceMatches(source, row && row.source || {})) ||
      ensureArray(asset.usageRefs).find((row) => candidate.sceneId && String(row && (row.sceneId || row.id) || '') === String(candidate.sceneId))) || null;
    const usageSceneId = usage && (usage.sceneId || usage.id) || '';
    return {
      scene: usageSceneId ? lookup.scenesById.get(String(usageSceneId)) : scene,
      source: usage && usage.source || asset && asset.source || source,
      path: normalizePath(asset && (asset.path || asset.previewUrl) || candidate.src || ''),
      previewUrl: String(asset && asset.previewUrl || candidate.src || ''),
      type: asset && asset.type || assetTypeForPath(candidate.src),
      directive: usage && usage.role || '',
      fileExists: asset && asset.fileExists
    };
  }

  function currentAsset(candidate, match) {
    const path = normalizePath(match && match.path) || runtimePath(candidate.src) || normalizePath(candidate.currentValue);
    return normalizeAsset({
      path,
      src: String(candidate && candidate.src || match && match.previewUrl || ''),
      previewUrl: String(match && match.previewUrl || candidate && candidate.src || ''),
      type: match && match.type || assetTypeForPath(path || candidate && candidate.src),
      directive: normalizeDirective(match && match.directive || candidate && candidate.assetDirective || candidate && candidate.role),
      source: sourceRef(match && match.source || candidate && candidate.source || {}),
      fileExists: match && match.fileExists
    });
  }

  function replacementAsset(file, targetPath, current, directive) {
    const normalized = normalizeReplacementFile(file || {});
    const path = normalizePath(targetPath);
    return normalizeAsset({
      path,
      type: normalized.type || assetTypeForPath(path) || current.type || (directive === 'audio' ? 'audio' : 'image'),
      label: normalized.label || normalized.sourceName || fileName(path),
      sourceName: normalized.sourceName,
      sourcePath: normalized.sourcePath,
      sourceSize: normalized.sourceSize,
      sourceLastModified: normalized.sourceLastModified,
      directive
    });
  }

  function ownerFor(candidate, match, lookup) {
    const scene = match && match.scene || sceneForCandidate(candidate, lookup);
    const sceneId = String(scene && scene.id || candidate && candidate.sceneId || '');
    const sceneKind = sceneKindFor(scene, lookup);
    return normalizeOwner({
      sceneId,
      sceneKind,
      view: sceneKind === 'card' ? 'cards' : 'events',
      title: scene && (scene.title || scene.id) || sceneId,
      source: sourceRef(scene && (scene.sourceSpan || scene.topLevelSpan || scene.source || {path: scene.path}) || {})
    });
  }

  function existingSceneProposal(options) {
    const owner = normalizeOwner(options.owner || {});
    const source = sourceRef(options.source || {});
    const diagnostics = normalizeDiagnostics(options.diagnostics);
    return {
      schemaVersion: '0.1',
      kind: 'existing_scene_edit',
      id: safeId('runtime_asset_' + (owner.sceneId || 'scene') + '_' + (options.replacement && fileName(options.replacement.path) || 'asset')),
      title: 'Runtime asset reference: ' + (owner.title || owner.sceneId || 'scene'),
      sceneId: owner.sceneId,
      sceneKind: owner.sceneKind === 'card' ? 'card' : 'event',
      sourcePath: owner.source.path || source.path,
      source: owner.source && owner.source.path ? owner.source : source,
      changes: [options.change],
      assetInstallRequests: ensureArray(options.assetInstallRequests),
      warnings: diagnostics.filter((diag) => diag.severity === 'warning').map((diag) => diag.message || diag.code || '').filter(Boolean),
      diagnostics,
      studioAuthoringContext: {
        workspace: 'content',
        surface: 'runtime_visual_asset',
        action: 'create_asset_reference_draft',
        selectedCanvasNode: (owner.sceneKind === 'card' ? 'card:' : 'event:') + owner.sceneId,
        view: owner.view
      }
    };
  }

  function buildInstallPlan(projectIndex, draft) {
    const api = installPlanApi();
    if (!api || typeof api.existingSceneEditInstallPlan !== 'function') {
      return null;
    }
    return api.existingSceneEditInstallPlan(draft, {
      project: typeof api.projectProvenanceFromIndex === 'function' ? api.projectProvenanceFromIndex(projectIndex) : null
    });
  }

  function assetInstallRequest(replacement, current, directive) {
    return {
      sourceName: replacement.sourceName || '',
      sourcePath: replacement.sourcePath || '',
      targetPath: replacement.path || '',
      type: replacement.type || current.type || (directive === 'audio' ? 'audio' : 'image'),
      label: replacement.label || fileName(replacement.path),
      role: directiveRole(directive)
    };
  }

  function suggestedTargetPath(context) {
    const owner = context.owner || {};
    const current = context.currentAsset || {};
    const file = context.replacementFile || {};
    const type = file.type || current.type || (context.directive === 'audio' ? 'audio' : 'image');
    const sourceName = file.sourceName || fileName(current.path || current.src) || 'asset';
    const sceneId = safeId(owner.sceneId || 'scene');
    const bucket = type === 'audio'
      ? 'shared'
      : owner.sceneKind === 'card'
        ? 'cards'
        : 'events';
    let target = ['assets', 'studio', bucket, sceneId, safeAssetFileName(sourceName, type)].join('/');
    const currentPath = normalizePath(current.path);
    if (currentPath && currentPath === target) {
      target = ['assets', 'studio', bucket, sceneId, safeAssetFileName('replacement_' + sourceName, type)].join('/');
    }
    return target;
  }

  function normalizeReplacementFile(input) {
    const value = isObject(input) ? input : {};
    const sourcePath = String(value.sourcePath || value.path || '').trim();
    const sourceName = String(value.sourceName || value.fileName || value.name || fileName(sourcePath) || '').trim();
    const targetPath = normalizePath(value.targetPath || value.target || '');
    return {
      sourceName,
      sourcePath,
      targetPath,
      type: String(value.type || assetTypeForPath(targetPath || sourceName) || '').trim(),
      label: String(value.label || sourceName || fileName(targetPath) || '').trim(),
      sourceSize: value.sourceSize || value.size,
      sourceLastModified: value.sourceLastModified || value.lastModified
    };
  }

  function assetDraft(input) {
    const diagnostics = dedupeDiagnostics(normalizeDiagnostics(input.diagnostics));
    const changes = ensureArray(input.changes).map(normalizeChange).filter(Boolean);
    const draft = isObject(input.draft) ? input.draft : null;
    const installPlan = isObject(input.installPlan) ? input.installPlan : null;
    return {
      schemaVersion: MODEL_VERSION,
      kind: MODEL_KIND,
      status: normalizeStatus(input.status) || statusFor({diagnostics, changes, draft}),
      summary: {
        changeCount: changes.length,
        diagnosticCount: diagnostics.length,
        installOperationCount: ensureArray(installPlan && installPlan.operations).length,
        hasReplacementFile: Boolean(input.replacementAsset && input.replacementAsset.sourcePath)
      },
      candidate: isObject(input.candidate) ? input.candidate : null,
      currentAsset: normalizeAsset(input.currentAsset || {}),
      replacementAsset: normalizeAsset(input.replacementAsset || {}),
      source: sourceRef(input.source || {}),
      owner: normalizeOwner(input.owner || {}),
      changes,
      draft,
      installPlan,
      diagnostics
    };
  }

  function statusFor(context) {
    const diagnostics = ensureArray(context && context.diagnostics);
    if (diagnostics.some((diag) => diag && diag.severity === 'error')) {
      return 'blocked';
    }
    if (!context || !context.draft || !ensureArray(context.changes).length) {
      return diagnostics.length ? 'manual_review' : 'proposal_only';
    }
    return diagnostics.some((diag) => diag && diag.severity === 'warning') ? 'proposal_only' : 'ready';
  }

  function normalizeChange(change, index) {
    if (!isObject(change)) {
      return null;
    }
    return {
      fieldId: safeId(change.fieldId || 'asset_reference_' + (index + 1)),
      role: String(change.role || 'asset_reference'),
      label: String(change.label || 'Asset reference'),
      sectionId: String(change.sectionId || ''),
      optionId: String(change.optionId || ''),
      source: sourceRef(change.source || {}),
      editability: String(change.editability || 'manual_review'),
      operationType: String(change.operationType || 'replace_text'),
      startLine: positiveInteger(change.startLine, null),
      endLine: positiveInteger(change.endLine, null),
      before: String(change.before || ''),
      after: String(change.after || '')
    };
  }

  function normalizeAsset(input) {
    const value = isObject(input) ? input : {};
    return {
      path: normalizePath(value.path || value.targetPath || ''),
      src: String(value.src || ''),
      previewUrl: String(value.previewUrl || value.url || ''),
      type: String(value.type || assetTypeForPath(value.path || value.src || value.previewUrl) || ''),
      label: String(value.label || value.name || fileName(value.path || value.src || value.previewUrl) || ''),
      directive: normalizeDirective(value.directive || value.role || ''),
      source: sourceRef(value.source || {}),
      sourceName: String(value.sourceName || ''),
      sourcePath: String(value.sourcePath || ''),
      sourceSize: value.sourceSize,
      sourceLastModified: value.sourceLastModified,
      fileExists: value.fileExists
    };
  }

  function normalizeOwner(input) {
    const value = isObject(input) ? input : {};
    const sceneKind = String(value.sceneKind || value.kind || '').trim() === 'card' ? 'card' : 'event';
    return {
      sceneId: String(value.sceneId || value.id || ''),
      sceneKind,
      view: String(value.view || (sceneKind === 'card' ? 'cards' : 'events')),
      title: String(value.title || value.label || value.sceneId || value.id || ''),
      source: sourceRef(value.source || {})
    };
  }

  function buildLookup(projectIndex) {
    const semantic = projectIndex && projectIndex.semantic || {};
    const scenes = ensureArray(projectIndex && projectIndex.scenes);
    const scenesById = new Map();
    scenes.forEach((scene) => {
      if (scene && scene.id) {
        scenesById.set(String(scene.id), scene);
      }
    });
    return {
      scenes,
      scenesById,
      cards: ensureArray(semantic.cards),
      assets: ensureArray(semantic.assets && semantic.assets.items)
    };
  }

  function sceneForCandidate(candidate, lookup) {
    const routeTarget = candidate && candidate.route && candidate.route.target || candidate && candidate.action && candidate.action.target || {};
    const ids = [
      candidate && candidate.sceneId,
      routeTarget.sceneId,
      routeTarget.itemId
    ].map((item) => String(item || '')).filter(Boolean);
    for (const id of ids) {
      if (lookup.scenesById.has(id)) {
        return lookup.scenesById.get(id);
      }
    }
    const source = sourceRef(candidate && candidate.source || {});
    return lookup.scenes.find((scene) => samePath(scene && (scene.path || scene.sourceSpan && scene.sourceSpan.path), source.path)) || null;
  }

  function sceneKindFor(scene, lookup) {
    const id = String(scene && scene.id || '');
    if (String(scene && scene.type || '').toLowerCase() === 'card' || scene && scene.flags && scene.flags.isCard) {
      return 'card';
    }
    if (lookup.cards.some((card) => card && String(card.id || '') === id)) {
      return 'card';
    }
    return 'event';
  }

  function sourceCanGuard(source, before) {
    const ref = sourceRef(source || {});
    return Boolean(
      ref.path.startsWith('source/scenes/') &&
      ref.path.endsWith('.scene.dry') &&
      !isProtectedRouterPath(ref.path) &&
      ref.line &&
      (!ref.endLine || ref.endLine === ref.line) &&
      String(before || '').trim()
    );
  }

  function isProtectedRouterPath(path) {
    const rel = normalizePath(path);
    return rel === 'source/scenes/root.scene.dry' ||
      rel === 'source/scenes/post_event.scene.dry' ||
      rel === 'source/scenes/post_event_news.scene.dry';
  }

  function isAssetLike(candidate) {
    const text = [candidate && candidate.role, candidate && candidate.selector, candidate && candidate.src, candidate && candidate.currentValue].join(' ').toLowerCase();
    return Boolean(candidate && candidate.src) || /asset|image|portrait|face|background|card-img|card_image|audio/.test(text);
  }

  function isAmbiguousCandidate(candidate) {
    return /multiple|ambiguous/i.test(String(candidate && candidate.reason || ''));
  }

  function normalizeDirective(value) {
    const text = String(value || '').trim().toLowerCase().replace(/_/g, '-');
    if (DIRECTIVES.has(text)) {
      return text;
    }
    if (/portrait|face/.test(text)) {
      return 'face-image';
    }
    if (/card.*image|card-img/.test(text)) {
      return 'card-image';
    }
    if (/background|set-bg/.test(text)) {
      return 'set-bg';
    }
    if (/audio|music|sound/.test(text)) {
      return 'audio';
    }
    return '';
  }

  function directiveLabel(directive) {
    return {
      'face-image': 'Portrait image',
      'card-image': 'Card image',
      'set-bg': 'Background image',
      audio: 'Audio asset'
    }[directive] || 'Asset reference';
  }

  function directiveRole(directive) {
    return {
      'face-image': 'event_portrait',
      'card-image': 'card_image',
      'set-bg': 'event_illustration',
      audio: 'event_audio'
    }[directive] || 'reference';
  }

  function assetTypeForPath(value) {
    const ext = extensionForPath(value);
    if (IMAGE_EXTENSIONS.has(ext)) return 'image';
    if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
    return '';
  }

  function extensionForPath(value) {
    const clean = String(value || '').split(/[?#]/)[0];
    const match = clean.match(/(\.[A-Za-z0-9]+)$/);
    return match ? match[1].toLowerCase() : '';
  }

  function safeAssetFileName(value, type) {
    const raw = fileName(value || 'asset');
    const ext = extensionForPath(raw) || (type === 'audio' ? '.ogg' : '.png');
    const base = raw.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'asset';
    return base + ext;
  }

  function sourceRef(input) {
    const value = isObject(input) ? input : {};
    const path = normalizePath(value.path || value.sourcePath || '');
    const line = positiveInteger(value.line || value.startLine, 0);
    const endLine = positiveInteger(value.endLine || value.line || value.startLine, 0);
    const ref = {path};
    if (line) ref.line = line;
    if (value.startLine) ref.startLine = positiveInteger(value.startLine, 0);
    if (endLine) ref.endLine = endLine;
    return ref;
  }

  function sourceMatches(left, right) {
    const a = sourceRef(left || {});
    const b = sourceRef(right || {});
    if (!a.path || !b.path || !samePath(a.path, b.path)) {
      return false;
    }
    if (!a.line || !b.line) {
      return true;
    }
    const end = b.endLine || b.line;
    return a.line >= b.line && a.line <= end;
  }

  function normalizePath(value) {
    return String(value || '').trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+/g, '/').replace(/^\/+/, '');
  }

  function runtimePath(value) {
    const text = normalizePath(value);
    const index = text.indexOf('out/html/');
    return index >= 0 ? text.slice(index) : text;
  }

  function samePath(left, right) {
    return normalizePath(left) === normalizePath(right);
  }

  function pathEndsWith(left, right) {
    const a = normalizePath(left);
    const b = normalizePath(right);
    return Boolean(a && b && (a === b || a.endsWith('/' + b) || b.endsWith('/' + a)));
  }

  function isGeneratedPath(path) {
    const rel = normalizePath(path);
    return rel === 'out/game.json' || rel.startsWith('out/html/') || rel.startsWith('out/');
  }

  function confidenceRank(value) {
    const text = String(value || '').trim().toLowerCase();
    return CONFIDENCE_RANK[text] || 0;
  }

  function normalizeStatus(value) {
    const text = String(value || '').trim().toLowerCase();
    return STATUSES.indexOf(text) >= 0 ? text : '';
  }

  function normalizeDiagnostics(rows) {
    return ensureArray(rows).map((diag) => isObject(diag) ? {
      severity: String(diag.severity || 'warning'),
      code: String(diag.code || 'runtime_visual_asset_draft.diagnostic'),
      message: String(diag.message || diag.code || ''),
      confidence: String(diag.confidence || 'runtime')
    } : null).filter(Boolean);
  }

  function dedupeDiagnostics(rows) {
    const seen = new Set();
    const out = [];
    normalizeDiagnostics(rows).forEach((diag) => {
      const key = [diag.severity, diag.code, diag.message].join('\n');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(diag);
      }
    });
    return out;
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message, confidence: 'runtime'};
  }

  function safeId(value) {
    return String(value || 'runtime_asset')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'runtime_asset';
  }

  function fileName(value) {
    const parts = String(value || '').split(/[/?#]/);
    return parts[parts.length - 1] || '';
  }

  function positiveInteger(value, fallback) {
    if (value === null && fallback === null) {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function installPlanApi() {
    if (global && global.ProjectMapInstallPlan) {
      return global.ProjectMapInstallPlan;
    }
    if (typeof require === 'function') {
      try {
        return require('./install_plan.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  const api = {
    MODEL_VERSION,
    MODEL_KIND,
    buildAssetDraft,
    normalizeAssetDraft
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapRuntimeVisualAssetDraftModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
