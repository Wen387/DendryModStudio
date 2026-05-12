(function initRuntimeSnapshotModel(global) {
  'use strict';

  const MODEL_VERSION = '0.1';
  const SNAPSHOT_STATUSES = ['ready', 'partial', 'failed', 'blocked'];
  const DEFAULT_LIMITS = {
    regions: 80,
    diagnostics: 24,
    text: 160,
    assets: 80,
    samples: 120
  };

  function buildSnapshot(input) {
    const value = isObject(input) ? input : {};
    const runtimeSurface = isObject(value.runtimeSurface) ? value.runtimeSurface : {};
    const raw = isObject(value.snapshot)
      ? value.snapshot
      : isObject(value.runtimeSnapshot)
        ? value.runtimeSnapshot
        : value;
    const limits = Object.assign({}, DEFAULT_LIMITS, isObject(value.limits) ? value.limits : {});
    const diagnostics = [];
    diagnostics.push.apply(diagnostics, normalizeDiagnostics(runtimeSurface.diagnostics));
    diagnostics.push.apply(diagnostics, normalizeDiagnostics(value.diagnostics));
    diagnostics.push.apply(diagnostics, normalizeDiagnostics(raw.diagnostics));

    const blocked = runtimeSurfaceBlocked(runtimeSurface, diagnostics);
    const state = normalizeState(raw.state || raw);
    const regions = normalizeRegions(raw.regions, runtimeSurface, limits);
    const assets = normalizeAssets(raw.assets, limits);
    const graphics = normalizeGraphics(raw.graphics);
    const documentInfo = normalizeDocument(raw.document || raw);
    const runtimeDomMap = normalizeRuntimeDomMap(value.runtimeDomMap || raw.runtimeDomMap, {
      limits,
      runtimeSurface
    });
    const summary = buildSummary({
      runtimeSurface,
      raw,
      state,
      regions,
      assets,
      graphics,
      documentInfo,
      runtimeDomMap
    });

    addDerivedDiagnostics(diagnostics, {blocked, documentInfo, regions, state, summary});
    const finalDiagnostics = dedupeDiagnostics(diagnostics)
      .slice(0, positiveInteger(limits.diagnostics, DEFAULT_LIMITS.diagnostics));
    summary.diagnosticCount = finalDiagnostics.length;
    const status = blocked
      ? 'blocked'
      : statusFromEvidence({raw, documentInfo, regions, state, summary, diagnostics: finalDiagnostics});
    const out = {
      schemaVersion: MODEL_VERSION,
      kind: 'runtime_snapshot',
      status,
      capturedAt: String(raw.capturedAt || value.capturedAt || ''),
      document: documentInfo,
      summary,
      regions,
      assets,
      graphics,
      state,
      diagnostics: finalDiagnostics,
      confidence: status === 'blocked' ? 'exact' : 'runtime'
    };
    if (runtimeDomMap) {
      out.runtimeDomMap = runtimeDomMap;
    }
    return out;
  }

  function runtimeSurfaceBlocked(runtimeSurface, diagnostics) {
    const readiness = runtimeSurface && runtimeSurface.readiness || {};
    if (readiness.quickPreviewReady === false && Number(readiness.missingDependencyCount || 0) > 0) {
      return true;
    }
    return diagnostics.some((diag) => diag && diag.severity === 'error' && /^runtime_surface\.missing_/.test(String(diag.code || '')));
  }

  function statusFromEvidence(context) {
    const raw = context.raw || {};
    const diagnostics = context.diagnostics || [];
    if (raw.ok === false || diagnostics.some((diag) => diag && diag.severity === 'error' && /^runtime_preview_debug\./.test(String(diag.code || '')))) {
      return 'failed';
    }
    if (!context.documentInfo.bodyPresent) {
      return 'failed';
    }
    if (!context.state.exportable) {
      return 'partial';
    }
    if (context.summary.indexedRegionCount && context.summary.visibleRegionCount < Math.max(1, Math.ceil(context.summary.indexedRegionCount * 0.35))) {
      return 'partial';
    }
    if (diagnostics.some((diag) => diag && (diag.severity === 'warning' || diag.severity === 'error'))) {
      return 'partial';
    }
    return 'ready';
  }

  function buildSummary(context) {
    const rawSummary = isObject(context.raw && context.raw.summary) ? context.raw.summary : {};
    const indexedRegionCount = Number(rawSummary.indexedRegionCount || context.regions.length || 0);
    const foundRegionCount = context.regions.filter((region) => region.found).length;
    const visibleRegionCount = context.regions.filter((region) => region.visible).length;
    const choices = context.regions.find((region) => region.role === 'choices' || region.selector === 'ul.choices') || {};
    const imageSummary = context.assets.images || {};
    const audioSummary = context.assets.audio || {};
    return {
      loaded: Boolean(context.documentInfo.readyState && context.documentInfo.bodyPresent),
      focused: Boolean(context.state.sceneId),
      sceneId: context.state.sceneId,
      qualityCount: context.state.qualityCount,
      indexedRegionCount,
      foundRegionCount,
      visibleRegionCount,
      missingRegionCount: Math.max(0, indexedRegionCount - foundRegionCount),
      choiceCount: Number(rawSummary.choiceCount || choices.elementCount || choices.textCount || 0),
      imageCount: Number(imageSummary.total || 0),
      imageLoadedCount: Number(imageSummary.loaded || 0),
      imageErrorCount: Number(imageSummary.error || 0),
      audioCount: Number(audioSummary.total || 0),
      svgCount: Number(context.graphics.svgCount || 0),
      canvasCount: Number(context.graphics.canvasCount || 0),
      d3Present: context.graphics.d3Present === true,
      runtimeDomMappedCount: Number(context.runtimeDomMap && context.runtimeDomMap.summary && context.runtimeDomMap.summary.mappedCount || 0),
      runtimeDomSourceBackedCount: Number(context.runtimeDomMap && context.runtimeDomMap.summary && context.runtimeDomMap.summary.sourceBackedCount || 0),
      runtimeDomManualReviewCount: Number(context.runtimeDomMap && context.runtimeDomMap.summary && context.runtimeDomMap.summary.manualReviewCount || 0),
      diagnosticCount: 0
    };
  }

  function addDerivedDiagnostics(diagnostics, context) {
    if (context.blocked) {
      diagnostics.push(diagnostic('error', 'runtime_snapshot.blocked_by_readiness', 'Runtime snapshot is blocked because generated runtime dependencies are missing.'));
      return;
    }
    if (!context.documentInfo.bodyPresent) {
      diagnostics.push(diagnostic('error', 'runtime_snapshot.body_missing', 'Runtime snapshot could not find a document body.'));
    }
    if (!context.state.exportable) {
      diagnostics.push(diagnostic('warning', 'runtime_snapshot.state_unavailable', 'Runtime loaded, but the Dendry engine did not expose an exportable state.'));
    }
    const indexed = Number(context.summary.indexedRegionCount || 0);
    if (indexed && context.summary.foundRegionCount === 0) {
      diagnostics.push(diagnostic('warning', 'runtime_snapshot.regions_missing', 'Runtime snapshot did not find indexed runtime UI regions in the DOM.'));
    } else if (indexed && context.summary.visibleRegionCount === 0) {
      diagnostics.push(diagnostic('warning', 'runtime_snapshot.regions_hidden', 'Runtime snapshot found indexed UI regions, but none are visible.'));
    }
  }

  function normalizeDocument(input) {
    return {
      readyState: String(input.readyState || ''),
      title: clipped(input.title || '', 120),
      bodyPresent: input.bodyPresent !== false && Boolean(input.bodyPresent || input.readyState || input.title),
      url: clipped(input.url || '', 240)
    };
  }

  function normalizeState(input) {
    const sceneId = firstNonEmpty(input.sceneId, input.currentSceneId);
    const qualityCount = Number(input.qualityCount || 0);
    return {
      exportable: input.exportable !== false && Boolean(input.exportable || sceneId || qualityCount),
      sceneId,
      qualityCount: Number.isFinite(qualityCount) ? qualityCount : 0
    };
  }

  function normalizeRegions(input, runtimeSurface, limits) {
    const rows = ensureArray(input);
    const indexed = ensureArray(runtimeSurface && runtimeSurface.regions);
    const bySelectorRole = new Map(rows.map((row) => [regionKey(row.selector, row.role), row]));
    const out = [];
    indexed.forEach((region) => {
      const source = bySelectorRole.get(regionKey(region.selector, region.role));
      out.push(normalizeRegion(Object.assign({}, region, source || {}), source, limits));
    });
    rows.forEach((row) => {
      if (!indexed.some((region) => regionKey(region.selector, region.role) === regionKey(row.selector, row.role))) {
        out.push(normalizeRegion(row, row, limits));
      }
    });
    return out.slice(0, positiveInteger(limits.regions, DEFAULT_LIMITS.regions));
  }

  function normalizeRegion(row, source, limits) {
    const found = source && source.found !== undefined ? source.found === true : row.found === true;
    const visible = found && (source && source.visible !== undefined ? source.visible === true : row.visible === true);
    return {
      id: String(row.id || safeId([row.role, row.selector].join('_'))),
      role: String(row.role || ''),
      label: String(row.label || row.role || row.selector || ''),
      selector: String(row.selector || ''),
      found,
      visible,
      elementCount: positiveInteger(row.elementCount, found ? 1 : 0),
      text: clipped(row.text || '', positiveInteger(limits.text, DEFAULT_LIMITS.text)),
      textCount: positiveInteger(row.textCount, row.text ? 1 : 0),
      box: normalizeBox(row.box),
      samples: normalizeSamples(row.samples, limits),
      source: isObject(row.source) ? row.source : {}
    };
  }

  function normalizeSamples(input, limits) {
    return ensureArray(input).slice(0, positiveInteger(limits.samples, DEFAULT_LIMITS.samples)).map((item, index) => ({
      index: positiveInteger(item && item.index, index),
      selector: clipped(item && item.selector || '', 160),
      regionId: String(item && item.regionId || ''),
      role: String(item && item.role || ''),
      tag: String(item && item.tag || ''),
      elementId: String(item && item.elementId || ''),
      className: clipped(item && item.className || '', 160),
      visible: item && item.visible !== false,
      text: clipped(item && item.text || '', positiveInteger(limits.text, DEFAULT_LIMITS.text)),
      src: clipped(item && (item.currentSrc || item.src) || '', 240),
      currentSrc: clipped(item && item.currentSrc || '', 240),
      alt: clipped(item && item.alt || '', 120),
      title: clipped(item && item.title || '', 120),
      dataset: normalizeDataset(item && item.dataset),
      box: normalizeBox(item && item.box),
      regionSource: isObject(item && item.regionSource) ? item.regionSource : {}
    }));
  }

  function normalizeAssets(input, limits) {
    const value = isObject(input) ? input : {};
    return {
      images: normalizeAssetGroup(value.images, limits),
      audio: normalizeAssetGroup(value.audio, limits)
    };
  }

  function normalizeAssetGroup(input, limits) {
    const value = isObject(input) ? input : {};
    const items = ensureArray(value.items).slice(0, positiveInteger(limits.assets, DEFAULT_LIMITS.assets)).map((item) => ({
      src: clipped(item && item.src || '', 240),
      ok: item && item.ok === true,
      loaded: item && item.loaded === true,
      missing: item && item.missing === true,
      error: item && item.error === true
    }));
    return {
      total: positiveInteger(value.total, items.length),
      loaded: positiveInteger(value.loaded, items.filter((item) => item.loaded || item.ok).length),
      error: positiveInteger(value.error, items.filter((item) => item.error).length),
      missing: positiveInteger(value.missing, items.filter((item) => item.missing).length),
      items
    };
  }

  function normalizeGraphics(input) {
    const value = isObject(input) ? input : {};
    return {
      d3Present: value.d3Present === true,
      svgCount: positiveInteger(value.svgCount, 0),
      svgNonEmptyCount: positiveInteger(value.svgNonEmptyCount, 0),
      canvasCount: positiveInteger(value.canvasCount, 0),
      canvasNonEmptyCount: positiveInteger(value.canvasNonEmptyCount, 0)
    };
  }

  function normalizeRuntimeDomMap(input, options) {
    if (!isObject(input)) {
      return null;
    }
    const api = runtimeDomMapModelApi();
    if (api && typeof api.buildDomMap === 'function') {
      return api.buildDomMap({
        runtimeDomMap: input,
        runtimeSurface: options && options.runtimeSurface || {},
        limits: options && options.limits || {}
      });
    }
    return input;
  }

  function runtimeDomMapModelApi() {
    if (global && global.ProjectMapRuntimeDomMapModel) {
      return global.ProjectMapRuntimeDomMapModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./runtime_dom_map_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function normalizeBox(box) {
    const value = isObject(box) ? box : {};
    return {
      x: finiteNumber(value.x),
      y: finiteNumber(value.y),
      width: finiteNumber(value.width),
      height: finiteNumber(value.height)
    };
  }

  function normalizeDataset(value) {
    const input = isObject(value) ? value : {};
    const out = {};
    Object.keys(input).forEach((key) => {
      if (/^dms[A-Z0-9_]/.test(key) || /^dms[-_]/i.test(key)) {
        out[key] = clipped(input[key], 160);
      }
    });
    return out;
  }

  function normalizeDiagnostics(rows) {
    return ensureArray(rows).map((item) => {
      if (!item) {
        return null;
      }
      return {
        severity: String(item.severity || 'warning'),
        code: String(item.code || 'runtime_snapshot.diagnostic'),
        message: String(item.message || item.code || 'Runtime snapshot diagnostic.'),
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
      if (!diag) {
        return;
      }
      const key = [diag.severity, diag.code, diag.message, diag.missingPath || ''].join('\n');
      if (seen.has(key)) {
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

  function regionKey(selector, role) {
    return String(selector || '') + '\n' + String(role || '');
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

  function safeId(value) {
    return String(value || 'runtime_region')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'runtime_region';
  }

  function clipped(value, limit) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    const max = positiveInteger(limit, DEFAULT_LIMITS.text);
    return text.length > max ? text.slice(0, Math.max(0, max - 3)) + '...' : text;
  }

  function positiveInteger(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {
    MODEL_VERSION,
    SNAPSHOT_STATUSES,
    buildSnapshot
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapRuntimeSnapshotModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
