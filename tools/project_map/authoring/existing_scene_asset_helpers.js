// @ts-check
(function initProjectMapExistingSceneAssetHelpers(global) {
  'use strict';

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function assetType(path) {
    const ext = String(path || '').toLowerCase().split('.').pop();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      return 'image';
    }
    if (['mp3', 'ogg', 'wav', 'flac', 'm4a'].includes(ext)) {
      return 'audio';
    }
    return 'asset';
  }

  function fileName(path) {
    const text = String(path || '');
    const parts = text.split(/[\\/]/);
    return parts[parts.length - 1] || text;
  }

  function normalizeAssetDirective(value) {
    const text = String(value || '').trim().toLowerCase();
    return text === 'face-image' ||
      text === 'card-image' ||
      text === 'set-bg' ||
      text === 'set-music' ||
      text === 'audio' ||
      text === 'inline-image' ||
      text === 'inline-asset'
      ? text
      : '';
  }

  function assetDirectiveLabel(directive) {
    const labels = {
      'face-image': 'Portrait image',
      'card-image': 'Card image',
      'set-bg': 'Background image',
      'set-music': 'Music track',
      audio: 'Audio asset',
      'inline-image': 'Inline image',
      'inline-asset': 'Inline asset'
    };
    return labels[directive] || 'Asset reference';
  }

  function normalizeAssetInstallRequest(input) {
    const value = isObject(input) ? input : {};
    return {
      sourceName: String(value.sourceName || value.fileName || value.name || '').trim(),
      sourcePath: String(value.sourcePath || '').trim(),
      targetPath: String(value.targetPath || value.target || value.path || '').trim(),
      type: String(value.type || value.assetType || '').trim(),
      label: String(value.label || value.sourceName || value.name || '').trim(),
      role: String(value.role || '').trim()
    };
  }

  function create(deps) {
    const injected = isObject(deps) ? deps : {};
    const sourceRef = typeof injected.sourceRef === 'function' ? injected.sourceRef : null;
    const canGuardField = typeof injected.canGuardField === 'function' ? injected.canGuardField : null;
    const safeId = typeof injected.safeId === 'function' ? injected.safeId : null;
    if (!sourceRef || !canGuardField || !safeId) {
      throw new Error('existing_scene_asset_helpers requires sourceRef, canGuardField, and safeId dependencies.');
    }

    function normalizeAssetRef(item) {
      if (typeof item === 'string') {
        return {path: item, type: assetType(item), label: fileName(item)};
      }
      if (!isObject(item)) {
        return null;
      }
      const path = String(item.path || item.src || item.url || '').trim();
      if (!path) {
        return null;
      }
      const directive = normalizeAssetDirective(item.directive || item.assetDirective || item.role);
      const explicitRole = String(item.role || '').trim();
      return {
        id: item.id ? String(item.id) : '',
        path,
        type: String(item.type || assetType(path)),
        label: String(item.label || item.name || fileName(path) || path),
        role: directive ? '' : explicitRole,
        directive,
        source: sourceRef(item.source || {}),
        sourceKind: String(item.sourceKind || ''),
        editability: String(item.editability || ''),
        confidence: String(item.confidence || ''),
        fileExists: item.fileExists,
        previewUrl: String(item.previewUrl || '')
      };
    }

    function assetEditableFields(scene, sceneSourcePath, options) {
      const sceneId = String(scene && scene.id || '');
      const textRows = ensureArray(options && options.textRows);
      return ensureArray(scene && scene.assetRefs).map((asset, index) => {
        const directive = normalizeAssetDirective(asset && (asset.directive || asset.role));
        const path = String(asset && (asset.path || asset.previewUrl || asset.src) || '').trim();
        if (!directive || !path) {
          return null;
        }
        const source = sourceRef(asset && asset.source || {});
        const original = originalAssetReferenceText(asset, directive, path, textRows);
        const guarded = canGuardField(source, original);
        return {
          id: safeId(['asset', directive, source.line || index + 1].join('_')),
          role: 'asset_reference',
          label: assetDirectiveLabel(directive),
          original,
          value: original,
          source,
          sourcePath: source.path || sceneSourcePath || '',
          editability: guarded ? 'guarded_replace_text' : 'manual_review',
          operationType: 'replace_text',
          allowEmptyReplace: guarded,
          deletesSourceLine: false,
          assetDirective: directive,
          assetPath: path,
          owner: {
            sceneId,
            sectionId: '',
            itemId: '',
            kind: 'asset_reference'
          },
          sectionId: '',
          optionId: '',
          confidence: asset && asset.confidence || '',
          reason: guarded
            ? 'Exact source asset directive can be checked before replacement.'
            : 'Needs Studio source review because safe single-line asset directive evidence is missing.'
        };
      }).filter(Boolean);
    }

    function originalAssetReferenceText(asset, directive, path, textRows) {
      if (directive === 'inline-image' || directive === 'inline-asset') {
        const source = sourceRef(asset && asset.source || {});
        const matchingText = ensureArray(textRows).find((row) => {
          const rowSource = sourceRef(row && row.source || {});
          return rowSource.path === source.path &&
            rowSource.line === source.line &&
            String(row && row.text || '').includes(path);
        });
        const text = String(matchingText && matchingText.text || source.anchorText || '').trim();
        if (text) {
          return text;
        }
        return path;
      }
      if (directive === 'audio' || directive === 'set-music') {
        const source = sourceRef(asset && asset.source || {});
        const anchor = String(source.anchorText || '').trim();
        if (anchor && anchor.includes(path)) {
          return anchor;
        }
      }
      return directive + ': ' + path;
    }

    return {
      normalizeAssetRef,
      assetType,
      fileName,
      assetEditableFields,
      normalizeAssetDirective,
      assetDirectiveLabel,
      normalizeAssetInstallRequest
    };
  }

  const api = {
    create,
    ensureArray,
    isObject,
    assetType,
    fileName,
    normalizeAssetDirective,
    assetDirectiveLabel,
    normalizeAssetInstallRequest
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapExistingSceneAssetHelpers = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
