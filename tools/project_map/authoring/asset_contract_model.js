// @ts-check
(function initProjectMapAssetContractModel(global) {
  'use strict';

  const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
  const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.flac', '.m4a']);
  const ASSET_PLACEMENT_KINDS = new Set([
    'global_slot',
    'opening_visual',
    'section_visual',
    'option_result_visual',
    'conditional_visual',
    'menu_visual',
    'unknown_inline'
  ]);
  const ASSET_SLOT_DEFS = Object.freeze({
    event: Object.freeze([
      Object.freeze({role: 'event_illustration', type: 'image', label: 'Event illustration'}),
      Object.freeze({role: 'event_portrait', type: 'image', label: 'Event portrait'}),
      Object.freeze({role: 'event_background', type: 'image', label: 'Event background'}),
      Object.freeze({role: 'event_audio', type: 'audio', label: 'Event audio'})
    ]),
    card: Object.freeze([
      Object.freeze({role: 'card_image', type: 'image', label: 'Card image'}),
      Object.freeze({role: 'card_portrait', type: 'image', label: 'Card portrait'}),
      Object.freeze({role: 'card_background', type: 'image', label: 'Card background'}),
      Object.freeze({role: 'card_audio', type: 'audio', label: 'Card audio'})
    ])
  });

  /**
   * @typedef {import('../types/project_map_contracts').AssetContractModelApi} AssetContractModelApi
   * @typedef {import('../types/project_map_contracts').AssetInstallRequest} AssetInstallRequest
   * @typedef {import('../types/project_map_contracts').AssetSlotDefinition} AssetSlotDefinition
   */

  /**
   * @param {unknown} value
   * @returns {Record<string, unknown>}
   */
  function objectValue(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? /** @type {Record<string, unknown>} */ (value) : {};
  }

  /**
   * @param {unknown} value
   * @returns {unknown[]}
   */
  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /**
   * @param {unknown} value
   * @returns {'event' | 'card'}
   */
  function normalizeTarget(value) {
    const text = String(value || '').trim().toLowerCase();
    return text === 'card' || text === 'cards' || text === 'advisor' || text === 'advisor_like' ? 'card' : 'event';
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  function normalizeAssetDirective(value) {
    const text = String(value || '').trim().toLowerCase();
    return text === 'face-image' ||
      text === 'card-image' ||
      text === 'set-bg' ||
      text === 'audio' ||
      text === 'inline-image' ||
      text === 'inline-asset'
      ? text
      : '';
  }

  /**
   * @param {unknown} directive
   * @param {unknown} target
   * @returns {string}
   */
  function roleForAssetDirective(directive, target) {
    const normalizedTarget = normalizeTarget(target);
    const text = normalizeAssetDirective(directive);
    if (text === 'card-image') {
      return 'card_image';
    }
    if (text === 'face-image') {
      return normalizedTarget === 'card' ? 'card_portrait' : 'event_portrait';
    }
    if (text === 'set-bg') {
      return normalizedTarget === 'card' ? 'card_background' : 'event_background';
    }
    if (text === 'audio') {
      return normalizedTarget === 'card' ? 'card_audio' : 'event_audio';
    }
    return normalizedTarget === 'card' ? 'card_image' : 'event_illustration';
  }

  /**
   * @param {unknown} role
   * @returns {string}
   */
  function assetRoleLabel(role) {
    /** @type {Record<string, string>} */
    const labels = {
      event_illustration: 'Event illustration',
      event_portrait: 'Event portrait',
      event_background: 'Event background',
      event_audio: 'Event audio',
      card_image: 'Card image',
      card_portrait: 'Card portrait',
      card_background: 'Card background',
      card_audio: 'Card audio',
      advisor_portrait: 'Advisor portrait',
      reference: 'Reference'
    };
    const value = String(role || '').trim();
    return labels[value] || humanize(value || 'reference');
  }

  /**
   * @param {unknown} target
   * @returns {AssetSlotDefinition[]}
   */
  function assetSlotDefinitions(target) {
    const key = normalizeTarget(target);
    return (ASSET_SLOT_DEFS[key] || ASSET_SLOT_DEFS.event).map((slot) => Object.assign({}, slot, {
      roleLabel: assetRoleLabel(slot.role)
    }));
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  function normalizeAssetPlacementKind(value) {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }
    return ASSET_PLACEMENT_KINDS.has(text) ? text : 'unknown_inline';
  }

  /**
   * @param {unknown} kind
   * @returns {boolean}
   */
  function isFlowPlacementKind(kind) {
    const text = normalizeAssetPlacementKind(kind);
    return Boolean(text && text !== 'global_slot');
  }

  /**
   * @param {unknown} extension
   * @returns {string}
   */
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

  /**
   * @param {unknown} filePath
   * @returns {string}
   */
  function extensionForPath(filePath) {
    const text = String(filePath || '');
    const match = text.match(/(\.[A-Za-z0-9]+)(?:[?#].*)?$/);
    return match ? match[1].toLowerCase() : '';
  }

  /**
   * @param {unknown} filePath
   * @returns {string}
   */
  function fileName(filePath) {
    const text = String(filePath || '');
    const parts = text.split(/[\\/]/);
    return parts[parts.length - 1] || text;
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  function safeId(value) {
    return String(value || 'asset').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'asset';
  }

  /**
   * @param {unknown} value
   * @param {unknown} type
   * @returns {string}
   */
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

  /**
   * @param {unknown} asset
   * @param {Record<string, unknown>=} options
   * @returns {string}
   */
  function suggestAssetTargetPath(asset, options) {
    const item = objectValue(asset);
    const opts = objectValue(options);
    const target = normalizeTarget(opts.target || opts.objectKind || opts.view);
    const targetFolder = target === 'card' ? 'cards' : 'events';
    const draftId = safeId(opts.draftId || opts.id || targetFolder.slice(0, -1) || 'draft');
    const sourceName = String(
      item.sourceName ||
      item.name ||
      item.label ||
      fileName(item.path || '') ||
      'asset'
    ).trim();
    return ['assets', 'studio', targetFolder, draftId, safeAssetFileName(sourceName, item.type || opts.type)].join('/');
  }

  /**
   * @param {unknown} input
   * @param {Record<string, unknown>=} options
   * @returns {AssetInstallRequest}
   */
  function assetInstallRequest(input, options) {
    const value = typeof input === 'string' ? {sourceName: input} : objectValue(input);
    const opts = objectValue(options);
    const sourcePath = String(value.sourcePath || '').trim();
    const sourceName = String(
      value.sourceName ||
      value.fileName ||
      value.name ||
      fileName(value.sourcePath || value.path || '') ||
      ''
    ).trim();
    const targetPath = String(value.targetPath || value.target || value.path || suggestAssetTargetPath(value, opts)).trim();
    const type = String(value.type || assetTypeForExtension(extensionForPath(targetPath || sourceName)) || 'asset').trim();
    const role = String(value.role || opts.role || '').trim();
    const label = String(value.label || sourceName || fileName(targetPath) || '').trim();
    return {
      sourceName,
      sourcePath,
      targetPath,
      type,
      label,
      role,
      directive: String(value.directive || value.assetDirective || '').trim(),
      placementId: String(value.placementId || value.assetPlacementId || '').trim(),
      placementKind: normalizeAssetPlacementKind(value.placementKind || value.assetPlacementKind),
      displayLocation: String(value.displayLocation || value.placementLabel || '').trim(),
      operationCapability: String(value.operationCapability || '').trim(),
      sectionId: String(value.sectionId || '').trim(),
      optionId: String(value.optionId || '').trim(),
      branchKind: String(value.branchKind || '').trim(),
      relatedOptionIds: ensureArray(value.relatedOptionIds).map(String).filter(Boolean),
      roleLabel: assetRoleLabel(role),
      sourceSize: Number(value.sourceSize || 0) || undefined,
      sourceLastModified: Number(value.sourceLastModified || 0) || undefined,
      status: sourceName ? 'ready_for_review' : 'needs_source_file'
    };
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  function humanize(value) {
    return String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /** @type {AssetContractModelApi} */
  const api = {
    normalizeTarget,
    normalizeAssetDirective,
    roleForAssetDirective,
    assetRoleLabel,
    assetSlotDefinitions,
    normalizeAssetPlacementKind,
    isFlowPlacementKind,
    assetTypeForExtension,
    extensionForPath,
    fileName,
    safeId,
    safeAssetFileName,
    suggestAssetTargetPath,
    assetInstallRequest
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapAssetContractModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
