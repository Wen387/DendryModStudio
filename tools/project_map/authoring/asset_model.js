(function initAssetModel(global) {
  'use strict';

  const ASSET_MODEL_VERSION = '0.1';
  const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
  const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.flac', '.m4a']);
  const assetCatalogCache = typeof WeakMap === 'function' ? new WeakMap() : null;

  function assetContractApi() {
    if (global && global.ProjectMapAssetContractModel) {
      return global.ProjectMapAssetContractModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./asset_contract_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function assetContracts() {
    const api = assetContractApi();
    if (!api) {
      throw new Error('ProjectMapAssetContractModel is required before ProjectMapAssetModel.');
    }
    return api;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function normalizeAssetItem(item, options) {
    const value = normalizeAssetRef(item);
    const context = options || {};
    const projectIndex = context.projectIndex || context.index || (context.schemaVersion ? context : null);
    const extension = String(value.extension || extensionForPath(value.path)).toLowerCase();
    const type = value.type || assetTypeForExtension(extension) || 'asset';
    const normalized = Object.assign({}, value, {
      schemaVersion: ASSET_MODEL_VERSION,
      id: value.id || safeId(value.path || value.name || value.label),
      name: value.name || value.label || fileName(value.path),
      label: value.label || value.name || fileName(value.path),
      type,
      path: value.path || '',
      extension,
      sourceKind: value.sourceKind || 'source_asset',
      editability: value.editability || 'reference_only',
      confidence: value.confidence || 'static_inferred'
    });
    const indexedMatch = findIndexedAssetMatch(projectIndex, normalized);
    if (indexedMatch && normalized.fileExists === undefined && indexedMatch.fileExists !== undefined) {
      normalized.fileExists = indexedMatch.fileExists;
    }
    normalized.status = assetDisplayStatus(normalized);
    normalized.referenceState = assetReferenceState(normalized, projectIndex);
    normalized.previewCapability = assetPreviewCapability(normalized, context);
    normalized.usageRefs = assetUsageSummary(normalized, projectIndex);
    return normalized;
  }

  function normalizeAssetRef(item) {
    if (typeof item === 'string') {
      return {
        path: item,
        name: fileName(item),
        label: fileName(item),
        type: assetTypeForExtension(extensionForPath(item))
      };
    }
    if (!isObject(item)) {
      return {path: '', name: '', label: '', type: 'asset'};
    }
    const path = String(item.path || item.src || item.url || item.href || '').trim();
    const id = String(item.id || '').trim();
    const name = String(item.name || item.label || fileName(path) || id).trim();
    return {
      id,
      name,
      label: String(item.label || name || fileName(path) || id).trim(),
      type: String(item.type || assetTypeForExtension(extensionForPath(path)) || 'asset').trim(),
      path,
      extension: item.extension || extensionForPath(path),
      sourceKind: item.sourceKind || '',
      editability: item.editability || '',
      source: item.source || null,
      confidence: item.confidence || '',
      sizeBytes: item.sizeBytes,
      fileExists: item.fileExists,
      previewUrl: item.previewUrl || item.url || '',
      usageRefs: ensureArray(item.usageRefs),
      alt: item.alt || '',
      directive: String(item.directive || item.assetDirective || '').trim(),
      role: String(item.role || '').trim(),
      placementId: String(item.placementId || item.assetPlacementId || '').trim(),
      placementKind: normalizeAssetPlacementKind(item.placementKind || item.assetPlacementKind || item.placement && item.placement.kind),
      displayLocation: String(item.displayLocation || item.placementLabel || item.placement && (item.placement.label || item.placement.displayLocation) || '').trim(),
      operationCapability: String(item.operationCapability || item.placement && item.placement.operationCapability || '').trim(),
      sectionId: String(item.sectionId || item.placement && item.placement.sectionId || '').trim(),
      optionId: String(item.optionId || item.placement && item.placement.optionId || '').trim(),
      branchKind: String(item.branchKind || item.placement && item.placement.branchKind || '').trim(),
      relatedOptionIds: ensureArray(item.relatedOptionIds || item.placement && item.placement.relatedOptionIds).map(String).filter(Boolean),
      audioModifiers: ensureArray(item.audioModifiers),
      audioGroupId: String(item.audioGroupId || '').trim()
    };
  }

  function assetDisplayStatus(asset) {
    const editability = String(asset && asset.editability || '');
    const sourceKind = String(asset && asset.sourceKind || '');
    if (editability === 'ide_escape_hatch' || sourceKind === 'runtime_evidence') {
      return {
        key: 'manual_review',
        label: 'Manual review',
        help: 'This asset was inferred from runtime output; keep it read-only and confirm the source manually.'
      };
    }
    if (editability === 'reference_only' || !editability) {
      return {
        key: 'reference_only',
        label: 'Reference only',
        help: 'Studio can preview and reference this asset, but will not copy, optimize, or install it.'
      };
    }
    return {
      key: editability,
      label: humanize(editability),
      help: 'Studio keeps asset management read-only in this slice.'
    };
  }

  function assetPreviewCapability(asset, options) {
    const context = options || {};
    const type = String(asset && asset.type || '').toLowerCase();
    const path = String(asset && asset.path || asset && asset.previewUrl || '').trim();
    const mediaKind = type === 'image' || type === 'audio'
      ? type
      : assetTypeForExtension(extensionForPath(path));
    const referenceState = asset && asset.referenceState || assetReferenceState(asset, context.projectIndex || context.index || null);
    if (referenceState.key === 'missing') {
      return {
        canPreview: false,
        mediaKind: mediaKind || 'asset',
        url: '',
        message: 'Missing asset reference: not found in the ProjectIndex asset list.'
      };
    }
    if (referenceState.key === 'file_missing') {
      return {
        canPreview: false,
        mediaKind: mediaKind || 'asset',
        url: '',
        message: 'Asset reference is indexed, but the physical file is missing from this checkout.'
      };
    }
    if (asset && asset.fileExists === false && !asset.previewUrl && !asset.url) {
      return {
        canPreview: false,
        mediaKind: mediaKind || 'asset',
        url: '',
        message: 'Asset reference is indexed, but the file is not present in this project checkout.'
      };
    }
    if (!path || (mediaKind !== 'image' && mediaKind !== 'audio')) {
      return {
        canPreview: false,
        mediaKind: mediaKind || 'asset',
        url: '',
        message: 'Studio can index this asset, but cannot preview this file type yet.'
      };
    }
    return {
      canPreview: true,
      mediaKind,
      url: resolveAssetUrl(asset, context),
      message: mediaKind === 'image' ? 'Image preview' : 'Audio preview'
    };
  }

  function assetReferenceState(asset, projectIndex) {
    const path = String(asset && (asset.path || asset.previewUrl || asset.url) || '').trim();
    const id = String(asset && asset.id || '').trim();
    if (!path && !id) {
      return {
        key: 'unknown',
        label: 'Unverified',
        help: 'This asset reference does not include a path or id Studio can verify.'
      };
    }
    if (isExternalAssetPath(path)) {
      return {
        key: 'external',
        label: 'External asset',
        help: 'This asset points outside the indexed project; Studio keeps it as a read-only external reference.'
      };
    }
    const indexedAssets = ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic.assets && projectIndex.semantic.assets.items);
    if (!indexedAssets.length) {
      return {
        key: 'unknown',
        label: 'Unverified',
        help: 'No ProjectIndex asset list is available, so Studio cannot verify this reference.'
      };
    }
    const indexedMatch = findIndexedAssetMatch(projectIndex, asset);
    if (indexedMatch) {
      if (indexedMatch.fileExists === false || asset && asset.fileExists === false) {
        return {
          key: 'file_missing',
          label: 'File missing',
          help: 'This reference is indexed, but the physical asset file is missing from this checkout.'
        };
      }
      return {
        key: 'indexed',
        label: 'Indexed asset',
        help: 'This reference matches an asset in the current ProjectIndex.'
      };
    }
    return {
      key: 'missing',
      label: 'Missing asset',
      help: 'This reference is not present in the current ProjectIndex asset list.'
    };
  }

  function findIndexedAssetMatch(projectIndex, asset) {
    const indexedAssets = ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic.assets && projectIndex.semantic.assets.items);
    for (const item of indexedAssets) {
      const ref = normalizeAssetRef(item);
      if (assetRefMatchesAsset(ref, asset)) {
        return isObject(item) ? item : ref;
      }
    }
    return null;
  }

  function assetDraftReference(asset, options) {
    const item = normalizeAssetItem(asset || {}, {});
    const role = String(options && options.role || item.role || '').trim();
    const ref = {
      path: item.path || item.previewUrl || item.id || '',
      type: item.type || 'asset',
      label: item.label || item.name || fileName(item.path) || '',
      role
    };
    if (item.directive) {
      ref.directive = item.directive;
    }
    if (item.placementKind) {
      ref.placementId = item.placementId || '';
      ref.placementKind = item.placementKind;
      ref.displayLocation = item.displayLocation || '';
      ref.operationCapability = item.operationCapability || '';
      ref.sectionId = item.sectionId || '';
      ref.optionId = item.optionId || '';
      ref.branchKind = item.branchKind || '';
      ref.relatedOptionIds = ensureArray(item.relatedOptionIds);
    }
    return ref;
  }

  function suggestAssetTargetPath(asset, options) {
    return assetContracts().suggestAssetTargetPath(asset, options);
  }

  function assetInstallRequest(input, options) {
    return assetContracts().assetInstallRequest(input, options);
  }

  function assetRepairInstallRequest(asset, file, options) {
    const item = normalizeAssetItem(asset || {}, options || {});
    const source = isObject(file) ? file : {name: file};
    const sourceName = String(source.name || source.sourceName || fileName(source.path || source.sourcePath || '') || '').trim();
    const sourcePath = String(source.path || source.sourcePath || '').trim();
    const targetPath = String(item.path || item.previewUrl || item.id || '').trim();
    const type = String(item.type || assetTypeForExtension(extensionForPath(targetPath || sourceName)) || 'asset').trim();
    const role = String(options && options.role || item.role || 'reference').trim();
    return assetInstallRequest({
      sourceName,
      sourcePath,
      targetPath,
      type,
      label: sourceName || item.label || item.name || fileName(targetPath),
      role,
      sourceSize: source.size,
      sourceLastModified: source.lastModified
    }, options || {});
  }

  function renderAssetInstallRequestText(request) {
    const item = assetInstallRequest(request || {}, {});
    const source = item.sourceName || item.sourcePath || '(select a source file)';
    const target = item.targetPath || '(missing target path)';
    return 'Asset install proposal: copy ' + source + ' -> ' + target + (item.role ? ' [' + item.roleLabel + ']' : '');
  }

  function assetEditingMetadata(asset) {
    const item = isObject(asset) && asset.schemaVersion === ASSET_MODEL_VERSION
      ? Object.assign({}, asset)
      : normalizeAssetItem(asset || {}, {});
    const state = item.referenceState || {};
    const canReference = Boolean(item.path || item.id || item.previewUrl);
    let installBehavior = 'manual_asset_reference';
    if (state.key === 'file_missing') {
      installBehavior = 'manual_asset_file';
    } else if (state.key === 'missing') {
      installBehavior = 'missing_reference_review';
    } else if (state.key === 'external') {
      installBehavior = 'external_reference_review';
    }
    return {
      canReference,
      canPreview: Boolean(item.previewCapability && item.previewCapability.canPreview),
      referenceState: state.key || 'unknown',
      installBehavior,
      draftReference: assetDraftReference(item),
      help: 'Asset references can be added to drafts for preview, but Studio does not copy or install asset files.'
    };
  }

  function assetRoleLabel(role) {
    return assetContracts().assetRoleLabel(role);
  }

  function assetSlotDefinitions(target) {
    return assetContracts().assetSlotDefinitions(target);
  }

  function buildAssetSlots(draft, options) {
    const value = isObject(draft) ? draft : {};
    const opts = options || {};
    const projectIndex = opts.projectIndex || opts.index || null;
    const slots = assetSlotDefinitions(opts.target);
    const refs = ensureArray(value.assetRefs).map((ref) => normalizeAssetItem(ref, {projectIndex}));
    const requests = ensureArray(value.assetInstallRequests).map((request) => assetInstallRequest(request, opts));
    return slots.map((slot) => {
      const ref = refs.find((item) => item.role === slot.role) ||
        refs.find((item) => !item.role && item.type === slot.type);
      const installRequest = requests.find((request) => request.role === slot.role) ||
        requests.find((request) => ref && request.targetPath && request.targetPath === ref.path);
      const status = installRequest
        ? 'pending_install'
        : ref
          ? (ref.referenceState && ref.referenceState.key || 'selected')
          : 'empty';
      return Object.assign({}, slot, {
        assetRef: ref || null,
        installRequest: installRequest || null,
        status
      });
    });
  }

  function buildAssetManifest(refs, options) {
    const context = options || {};
    const items = ensureArray(refs).map((ref) => {
      const base = normalizeAssetRef(ref);
      const normalized = normalizeAssetItem(ref, context);
      const role = normalized.role || base.role || '';
      const roleLabel = assetRoleLabel(role);
      return Object.assign({}, normalized, {
        role,
        roleLabel,
        manualAction: assetManualAction(normalized, roleLabel)
      });
    });
    const counts = {indexed: 0, file_missing: 0, missing: 0, external: 0, unknown: 0};
    items.forEach((item) => {
      const key = item.referenceState && item.referenceState.key || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    });
    return {
      items,
      counts,
      manualActions: items.filter((item) => item.manualAction).map((item) => item.manualAction),
      ok: counts.missing === 0 && counts.file_missing === 0 && counts.external === 0
    };
  }

  function buildAssetRows(draft, options) {
    const value = isObject(draft) ? draft : {};
    const opts = options || {};
    const refs = ensureArray(value.assetRefs || value.assets);
    const placements = ensureArray(value.assetPlacements)
      .map((placement, index) => normalizeAssetPlacementReference(placement, opts, index))
      .filter((placement) => placement && placement.path);
    const requests = ensureArray(value.assetInstallRequests);
    return refs.map((ref, index) => assetRowFromRef(ref, opts, index))
      .concat(placements.map((ref, index) => assetRowFromRef(ref, opts, refs.length + index)))
      .concat(requests.map((request, index) => assetRowFromInstallRequest(request, opts, index)));
  }

  function buildAssetCatalog(projectIndex, options) {
    const index = isObject(projectIndex) ? projectIndex : null;
    const opts = options || {};
    const target = normalizeTarget(opts.target || opts.objectKind || opts.view);
    const items = ensureArray(index && index.semantic && index.semantic.assets && index.semantic.assets.items);
    if (!items.length) {
      return [];
    }
    if (index && assetCatalogCache) {
      const cached = assetCatalogCache.get(index);
      if (cached && cached.items === items && cached[target]) {
        return cached[target];
      }
      const catalog = items.map((asset, assetIndex) => assetCatalogItem(asset, target, assetIndex)).filter((asset) => asset && (asset.path || asset.id));
      assetCatalogCache.set(index, Object.assign({}, cached || {}, {items, [target]: catalog}));
      return catalog;
    }
    return items.map((asset, assetIndex) => assetCatalogItem(asset, target, assetIndex)).filter((asset) => asset && (asset.path || asset.id));
  }

  function assetCatalogItem(asset, target, index) {
    const ref = normalizeAssetRef(asset || {});
    const extension = String(ref.extension || extensionForPath(ref.path)).toLowerCase();
    const type = ref.type || assetTypeForExtension(extension) || 'asset';
    const role = inferAssetRole(Object.assign({}, ref, {type, extension}), target);
    const referenceState = ref.fileExists === false
      ? {key: 'file_missing', label: 'File missing', help: 'This asset is indexed, but the physical file is missing from this checkout.'}
      : {key: 'indexed', label: 'Indexed asset', help: 'This asset is available from the current ProjectIndex asset list.'};
    return {
      schemaVersion: ASSET_MODEL_VERSION,
      id: ref.id || safeId(ref.path || ref.name || ref.label || 'asset_' + (index + 1)),
      name: ref.name || ref.label || fileName(ref.path),
      label: ref.label || ref.name || fileName(ref.path),
      type,
      path: ref.path || '',
      extension,
      sourceKind: ref.sourceKind || 'source_asset',
      editability: ref.editability || 'reference_only',
      source: ref.source || null,
      confidence: ref.confidence || 'static_inferred',
      sizeBytes: ref.sizeBytes,
      fileExists: ref.fileExists,
      previewUrl: ref.previewUrl || '',
      usageRefs: ensureArray(ref.usageRefs),
      alt: ref.alt || '',
      directive: normalizeAssetDirective(ref.directive),
      role,
      roleLabel: assetRoleLabel(role),
      placementId: ref.placementId || '',
      placementKind: ref.placementKind || '',
      displayLocation: ref.displayLocation || '',
      operationCapability: ref.operationCapability || '',
      sectionId: ref.sectionId || '',
      optionId: ref.optionId || '',
      branchKind: ref.branchKind || '',
      relatedOptionIds: ensureArray(ref.relatedOptionIds),
      audioModifiers: ensureArray(ref.audioModifiers),
      audioGroupId: ref.audioGroupId || '',
      status: assetDisplayStatus(Object.assign({}, ref, {type, extension})),
      referenceState
    };
  }

  function assetRowFromRef(ref, options, index) {
    const opts = options || {};
    const projectIndex = opts.projectIndex || opts.index || null;
    const target = normalizeTarget(opts.target || opts.objectKind || opts.view);
    const item = normalizeAssetItem(ref || {}, {projectIndex, assetBaseUrl: opts.assetBaseUrl, relativePrefix: opts.relativePrefix});
    const directive = normalizeAssetDirective(item.directive || item.role);
    const role = inferAssetRole(item, target);
    const placement = normalizeAssetPlacement(item, {target, role, directive, index});
    const referenceState = item.referenceState || assetReferenceState(item, projectIndex);
    const status = referenceState && referenceState.key || item.status && item.status.key || 'unknown';
    return {
      schemaVersion: ASSET_MODEL_VERSION,
      rowKind: 'asset_ref',
      id: item.id || safeId([role, item.path || item.label || index + 1].join('_')),
      label: item.label || item.name || fileName(item.path) || item.path || 'Asset',
      name: item.name || fileName(item.path),
      path: item.path || '',
      type: item.type || 'asset',
      role,
      roleLabel: assetRoleLabel(role),
      directive,
      placementId: placement.placementId,
      placementKind: placement.placementKind,
      displayLocation: placement.displayLocation,
      operationCapability: placement.operationCapability,
      sectionId: placement.sectionId,
      optionId: placement.optionId,
      branchKind: placement.branchKind,
      relatedOptionIds: placement.relatedOptionIds,
      flowAsset: isFlowPlacementKind(placement.placementKind),
      source: item.source || null,
      sourceKind: item.sourceKind || '',
      editability: item.editability || '',
      confidence: item.confidence || '',
      fileExists: item.fileExists,
      previewUrl: item.previewUrl || '',
      referenceState,
      previewCapability: item.previewCapability || assetPreviewCapability(item, opts),
      usageRefs: ensureArray(item.usageRefs),
      status,
      statusLabel: referenceState && referenceState.label || item.status && item.status.label || humanize(status),
      audioModifiers: ensureArray(item.audioModifiers),
      audioGroupId: item.audioGroupId || '',
      assetRef: assetDraftReference(Object.assign({}, item, placement, {role}), {role})
    };
  }

  function assetRowFromInstallRequest(request, options, index) {
    const opts = options || {};
    const projectIndex = opts.projectIndex || opts.index || null;
    const target = normalizeTarget(opts.target || opts.objectKind || opts.view);
    const item = assetInstallRequest(request || {}, opts);
    const role = inferAssetRole(item, target);
    const placement = normalizeAssetPlacement(item, {target, role, directive: item.directive || '', index});
    const ref = normalizeAssetItem({
      path: item.targetPath,
      type: item.type,
      label: item.label || item.sourceName || fileName(item.targetPath),
      role,
      sourceKind: 'asset_install_request',
      editability: item.sourcePath ? 'guarded_apply' : 'manual_review'
    }, {projectIndex, assetBaseUrl: opts.assetBaseUrl, relativePrefix: opts.relativePrefix});
    const referenceState = pendingInstallReferenceState(item);
    const previewCapability = pendingInstallPreviewCapability(item, ref);
    return {
      schemaVersion: ASSET_MODEL_VERSION,
      rowKind: 'asset_install_request',
      id: safeId(['asset_install', role, item.targetPath || item.sourceName || index + 1].join('_')),
      label: item.label || item.sourceName || fileName(item.targetPath) || 'Asset install proposal',
      name: item.sourceName || fileName(item.targetPath),
      path: item.targetPath || '',
      targetPath: item.targetPath || '',
      sourceName: item.sourceName || '',
      sourcePath: item.sourcePath || '',
      type: item.type || ref.type || 'asset',
      role,
      roleLabel: assetRoleLabel(role),
      directive: normalizeAssetDirective(item.directive || item.role),
      placementId: placement.placementId,
      placementKind: placement.placementKind,
      displayLocation: placement.displayLocation,
      operationCapability: placement.operationCapability,
      sectionId: placement.sectionId,
      optionId: placement.optionId,
      branchKind: placement.branchKind,
      relatedOptionIds: placement.relatedOptionIds,
      flowAsset: isFlowPlacementKind(placement.placementKind),
      source: null,
      sourceKind: 'asset_install_request',
      editability: item.sourcePath ? 'guarded_apply' : 'manual_review',
      confidence: item.sourcePath ? 'desktop_source_path' : 'proposal_only',
      fileExists: ref.fileExists,
      previewUrl: ref.previewUrl || '',
      referenceState,
      previewCapability,
      usageRefs: ensureArray(ref.usageRefs),
      status: 'pending_install',
      statusLabel: 'Pending install',
      assetRef: assetDraftReference(Object.assign({path: item.targetPath, type: item.type, label: item.label, role}, placement), {role}),
      installRequest: item
    };
  }

  function pendingInstallReferenceState(request) {
    const hasSource = Boolean(request && request.sourcePath);
    return {
      key: 'pending_install',
      label: 'Pending install',
      help: hasSource
        ? 'This local asset is queued for Review & Apply and will be copied into the project before the new reference is expected to exist.'
        : 'This asset target is queued, but Studio still needs a local source file before it can copy it automatically.'
    };
  }

  function pendingInstallPreviewCapability(request, normalizedRef) {
    const ref = isObject(normalizedRef) ? normalizedRef : {};
    const mediaKind = request && request.type || ref.type || assetTypeForExtension(extensionForPath(request && (request.targetPath || request.sourceName) || ref.path));
    return {
      canPreview: false,
      mediaKind: mediaKind || 'asset',
      url: '',
      message: request && request.sourcePath
        ? 'Pending install: Review & Apply will copy this local file into the project.'
        : 'Pending install: choose a local source file before automatic copy is available.'
    };
  }

  function normalizeAssetPlacementReference(value, options, index) {
    const placement = isObject(value) ? value : {path: value};
    const target = normalizeTarget(options && (options.target || options.objectKind || options.view));
    const path = String(placement.path || placement.targetPath || placement.assetPath || '').trim();
    if (!path) {
      return null;
    }
    const directive = normalizeAssetDirective(placement.directive || placement.assetDirective || 'inline-image') || 'inline-image';
    const role = String(placement.role || roleForAssetDirective(directive, target)).trim();
    return Object.assign({}, placement, {
      path,
      type: String(placement.type || assetTypeForExtension(extensionForPath(path)) || 'image').trim(),
      label: String(placement.label || placement.name || fileName(path) || '').trim(),
      directive,
      role,
      placementId: String(placement.placementId || placement.id || ['asset_placement', placement.optionId || placement.sectionId || 'opening', index + 1].join('_')).trim(),
      placementKind: normalizeAssetPlacementKind(placement.placementKind || placement.kind || 'opening_visual')
    });
  }

  function normalizeAssetPlacement(item, context) {
    const value = isObject(item) ? item : {};
    const ctx = context || {};
    const directive = normalizeAssetDirective(ctx.directive || value.directive || value.assetDirective || value.role);
    const sectionId = String(value.sectionId || '').trim();
    const optionId = String(value.optionId || '').trim();
    let placementKind = normalizeAssetPlacementKind(value.placementKind || value.assetPlacementKind);
    if (!placementKind) {
      placementKind = defaultPlacementKindForAsset(value, directive, ctx.target);
    }
    const placementId = String(value.placementId || value.assetPlacementId || value.id || [
      'asset_placement',
      placementKind || 'asset',
      optionId || sectionId || ctx.role || directive || 'reference',
      Number(ctx.index || 0) + 1
    ].join('_')).trim();
    return {
      placementId: safeId(placementId),
      placementKind,
      displayLocation: String(value.displayLocation || value.placementLabel || '').trim() || assetPlacementLabel(placementKind, value, ctx),
      operationCapability: String(value.operationCapability || '').trim() || (placementKind === 'unknown_inline' ? 'manual_review' : 'guarded_apply'),
      sectionId,
      optionId,
      branchKind: String(value.branchKind || '').trim(),
      relatedOptionIds: ensureArray(value.relatedOptionIds).map(String).filter(Boolean)
    };
  }

  function defaultPlacementKindForAsset(asset, directive, target) {
    const text = normalizeAssetDirective(directive || asset && asset.directive || asset && asset.role);
    if (text === 'inline-image' || text === 'inline-asset') {
      return 'unknown_inline';
    }
    if (text === 'card-image' || text === 'face-image' || text === 'set-bg' || text === 'set-music' || text === 'audio') {
      return 'global_slot';
    }
    const role = String(asset && asset.role || '').trim();
    if (/audio|music|background|portrait|card_image|event_portrait/.test(role)) {
      return 'global_slot';
    }
    return target === 'card' ? 'global_slot' : 'opening_visual';
  }

  function normalizeAssetPlacementKind(value) {
    return assetContracts().normalizeAssetPlacementKind(value);
  }

  function isFlowPlacementKind(kind) {
    return assetContracts().isFlowPlacementKind(kind);
  }

  function assetPlacementLabel(kind, asset, context) {
    const value = isObject(asset) ? asset : {};
    const label = String(value.sectionLabel || value.optionLabel || '').trim();
    if (label) {
      return label;
    }
    const id = String(value.optionId || value.sectionId || '').trim();
    if (id) {
      return id;
    }
    const labels = {
      global_slot: 'Global media slot',
      opening_visual: 'Opening visual',
      section_visual: 'Section visual',
      option_result_visual: 'Option result visual',
      conditional_visual: 'Conditional visual',
      menu_visual: 'Menu visual',
      unknown_inline: 'Inline visual'
    };
    return labels[kind] || assetRoleLabel(context && context.role || value.role || 'reference');
  }

  function inferAssetRole(asset, target) {
    const item = isObject(asset) ? asset : {};
    const normalizedTarget = normalizeTarget(target);
    const explicitRole = String(item.role || '').trim();
    const placementKind = normalizeAssetPlacementKind(item.placementKind || item.assetPlacementKind || item.placement && item.placement.kind);
    if (explicitRole && (String(item.sourceKind || '') === 'pending_asset_add' || isFlowPlacementKind(placementKind))) {
      return explicitRole;
    }
    const directive = normalizeAssetDirective(item.directive || item.assetDirective || item.role);
    if (directive) {
      return roleForAssetDirective(directive, normalizedTarget);
    }
    if (explicitRole) {
      return explicitRole;
    }
    if (String(item.type || '').trim() === 'audio') {
      return normalizedTarget === 'card' ? 'card_audio' : 'event_audio';
    }
    return normalizedTarget === 'card' ? 'card_image' : 'event_illustration';
  }

  function normalizeAssetDirective(value) {
    return assetContracts().normalizeAssetDirective(value);
  }

  function roleForAssetDirective(directive, target) {
    return assetContracts().roleForAssetDirective(directive, target);
  }

  function normalizeTarget(value) {
    const text = String(value || '').trim().toLowerCase();
    return text === 'card' || text === 'cards' || text === 'advisor' || text === 'advisor_like' ? 'card' : 'event';
  }

  function assetManualAction(asset, roleLabel) {
    const key = asset && asset.referenceState && asset.referenceState.key || '';
    const path = asset && (asset.path || asset.label || asset.id) || '(unnamed asset)';
    if (key === 'file_missing') {
      return roleLabel + ': provide the physical asset file at ' + path + '.';
    }
    if (key === 'missing') {
      return roleLabel + ': add or correct the asset reference in ProjectIndex/source for ' + path + '.';
    }
    if (key === 'external') {
      return roleLabel + ': verify the external asset reference manually: ' + path + '.';
    }
    return '';
  }

  function renderReferenceHelper(asset) {
    const item = normalizeAssetRef(asset || {});
    return item.path || item.previewUrl || item.id || '';
  }

  function resolveAssetUrl(asset, options) {
    const context = options || {};
    const explicit = String(asset && (asset.previewUrl || asset.url) || '').trim();
    if (explicit) {
      return resolveRelativeAssetUrl(explicit, context);
    }
    const path = String(asset && asset.path || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!path) {
      return '';
    }
    return resolveRelativeAssetUrl(path, context);
  }

  function resolveRelativeAssetUrl(path, context) {
    const value = String(path || '').replace(/\\/g, '/').trim();
    if (!value) {
      return '';
    }
    if (isAbsoluteAssetUrl(value)) {
      return value;
    }
    const normalized = value.replace(/^\/+/, '');
    const prefix = assetBaseUrlForContext(context || {});
    if (!prefix) {
      return normalized;
    }
    return String(prefix).replace(/\/+$/, '') + '/' + normalized;
  }

  function assetBaseUrlForContext(context) {
    const explicit = context.relativePrefix || context.assetBaseUrl || '';
    if (explicit) {
      return explicit;
    }
    const projectIndex = context.projectIndex || context.index || (context.schemaVersion ? context : null);
    return String(projectIndex && projectIndex.project && projectIndex.project.assetBaseUrl || '').trim();
  }

  function isAbsoluteAssetUrl(path) {
    return /^(https?:|file:|data:|blob:)/i.test(String(path || '').trim()) ||
      String(path || '').trim().startsWith('/');
  }

  function isExternalAssetPath(path) {
    return /^(https?:|file:|data:|blob:)/i.test(String(path || '').trim());
  }

  function assetUsageSummary(asset, projectIndex) {
    const usage = [];
    ensureArray(asset && asset.usageRefs).forEach((ref) => appendUsage(usage, normalizeUsageRef(ref)));
    if (!projectIndex || !projectIndex.semantic) {
      return dedupeUsage(usage);
    }
    const semantic = projectIndex.semantic || {};
    scanCollection(usage, asset, ensureArray(semantic.events), 'event', 'events');
    scanCollection(usage, asset, ensureArray(semantic.cards), 'card', 'cards');
    scanCollection(usage, asset, ensureArray(semantic.hands), 'card', 'cards');
    scanCollection(usage, asset, ensureArray(semantic.pinnedCards), 'card', 'cards');
    scanCollection(usage, asset, ensureArray(semantic.news && semantic.news.items), 'news', 'news');
    scanCollection(usage, asset, ensureArray(semantic.news && semantic.news.eventPopups), 'news', 'news');
    scanCollection(usage, asset, ensureArray(semantic.surfaceText && semantic.surfaceText.items), 'surface_text', 'surfaceText');
    scanCollection(usage, asset, ensureArray(semantic.textCorpus && semantic.textCorpus.items), 'text', 'textCorpus');
    scanCollection(usage, asset, ensureArray(projectIndex.scenes), 'scene', 'scenes');
    return dedupeUsage(usage);
  }

  function scanCollection(out, asset, items, kind, view) {
    items.forEach((item) => {
      const refs = assetRefsFromItem(item);
      if (!refs.some((ref) => assetRefMatchesAsset(ref, asset))) {
        return;
      }
      appendUsage(out, {
        kind,
        view,
        id: String(item.id || item.linkedSceneId || item.sceneId || item.path || '').trim(),
        label: usageLabel(item, kind),
        path: item.path || item.source && item.source.path || '',
        source: item.source || item.sourceSpan || null
      });
    });
  }

  function assetRefsFromItem(item) {
    const refs = [];
    appendAssetRefs(refs, item && item.assetRefs);
    appendAssetRefs(refs, item && item.assets);
    appendAssetRefs(refs, item && item.media);
    return refs;
  }

  function appendAssetRefs(out, value) {
    ensureArray(value).forEach((item) => out.push(normalizeAssetRef(item)));
  }

  function assetRefMatchesAsset(ref, asset) {
    const refPath = normalizedPath(ref && ref.path);
    const assetPath = normalizedPath(asset && asset.path);
    if (refPath && assetPath && refPath === assetPath) {
      return true;
    }
    const refId = String(ref && ref.id || '').trim();
    const assetId = String(asset && asset.id || '').trim();
    if (refId && assetId && refId === assetId) {
      return true;
    }
    const refName = String(ref && (ref.name || ref.label) || '').trim();
    const assetName = String(asset && (asset.name || asset.label) || '').trim();
    return Boolean(refName && assetName && refName === assetName);
  }

  function normalizedPath(value) {
    return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  }

  function normalizeUsageRef(ref) {
    const value = isObject(ref) ? ref : {};
    return {
      kind: String(value.kind || value.type || 'reference').trim(),
      view: String(value.view || '').trim(),
      id: String(value.id || value.sceneId || value.itemId || '').trim(),
      label: String(value.label || value.title || value.headline || value.id || 'Asset usage').trim(),
      path: String(value.path || '').trim(),
      source: value.source || null
    };
  }

  function appendUsage(out, usage) {
    if (usage && (usage.label || usage.id || usage.path)) {
      out.push(usage);
    }
  }

  function dedupeUsage(usage) {
    const seen = new Set();
    return usage.filter((item) => {
      const key = [item.kind, item.view, item.id, item.path, item.label].join('|');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function usageLabel(item, kind) {
    return String(
      item.title ||
      item.headline ||
      item.label ||
      item.text ||
      item.id ||
      kind
    ).trim();
  }

  function renderAssetText(asset) {
    const item = normalizeAssetItem(asset || {}, {});
    return [
      item.label || item.name || item.path || '(asset)',
      item.role ? '[' + assetRoleLabel(item.role) + ']' : '',
      item.type ? '(' + item.type + ')' : '',
      item.path || ''
    ].filter(Boolean).join(' ');
  }

  function extensionForPath(path) {
    const text = String(path || '');
    const match = text.match(/(\.[A-Za-z0-9]+)(?:[?#].*)?$/);
    return match ? match[1].toLowerCase() : '';
  }

  function assetTypeForExtension(extension) {
    const ext = String(extension || '').toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      return 'image';
    }
    if (AUDIO_EXTENSIONS.has(ext)) {
      return 'audio';
    }
    return '';
  }

  function fileName(path) {
    const text = String(path || '');
    const parts = text.split(/[\\/]/);
    return parts[parts.length - 1] || text;
  }

  function safeId(value) {
    return String(value || 'asset').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'asset';
  }

  function safeAssetFileName(value, type) {
    const raw = fileName(value || 'asset');
    const match = raw.match(/^(.*?)(\.[A-Za-z0-9]+)?$/);
    const base = String(match && match[1] || raw || 'asset')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'asset';
    let ext = String(match && match[2] || '').toLowerCase();
    if (!ext && type === 'image') {
      ext = '.png';
    } else if (!ext && type === 'audio') {
      ext = '.ogg';
    }
    return base + ext;
  }

  function humanize(value) {
    return String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  const api = {
    ASSET_MODEL_VERSION,
    normalizeAssetItem,
    normalizeAssetRef,
    assetDisplayStatus,
    assetPreviewCapability,
    assetReferenceState,
    assetDraftReference,
    suggestAssetTargetPath,
    assetInstallRequest,
    assetRepairInstallRequest,
    renderAssetInstallRequestText,
    assetEditingMetadata,
    assetRoleLabel,
    assetSlotDefinitions,
    buildAssetSlots,
    buildAssetRows,
    buildAssetCatalog,
    normalizeAssetPlacement,
    normalizeAssetPlacementKind,
    isFlowPlacementKind,
    inferAssetRole,
    normalizeAssetDirective,
    roleForAssetDirective,
    buildAssetManifest,
    resolveAssetUrl,
    assetUsageSummary,
    renderAssetText,
    renderReferenceHelper
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapAssetModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
