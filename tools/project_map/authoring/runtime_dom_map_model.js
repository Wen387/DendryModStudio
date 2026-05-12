(function initRuntimeDomMapModel(global) {
  'use strict';

  const MODEL_VERSION = '0.1';
  const MAP_STATUSES = ['ready', 'partial', 'failed', 'blocked'];
  const CONFIDENCE_RANK = {manual_review: 0, weak: 1, strong: 2, exact: 3};
  const DEFAULT_LIMITS = {
    items: 80,
    samples: 120,
    diagnostics: 24,
    text: 160,
    scenes: 80,
    textCorpus: 400,
    assets: 240,
    controls: 120,
    regions: 120
  };

  function buildDomMap(input) {
    const value = isObject(input) ? input : {};
    if (isObject(value.runtimeDomMap) && !value.projectIndex && !value.sourceEvidence && !value.runtimeSnapshot && !value.snapshot) {
      return normalizeDomMap(value.runtimeDomMap, value);
    }
    const limits = Object.assign({}, DEFAULT_LIMITS, isObject(value.limits) ? value.limits : {});
    const runtimeSurface = isObject(value.runtimeSurface) ? value.runtimeSurface : {};
    const snapshot = isObject(value.runtimeSnapshot)
      ? value.runtimeSnapshot
      : isObject(value.snapshot)
        ? value.snapshot
        : {};
    const sourceEvidence = normalizeSourceEvidence(
      value.sourceEvidence || buildSourceEvidence(value.projectIndex, {
        focus: value.focus,
        runtimeSurface,
        limits
      }),
      {runtimeSurface, limits}
    );
    const diagnostics = [];
    diagnostics.push.apply(diagnostics, normalizeDiagnostics(value.diagnostics));
    diagnostics.push.apply(diagnostics, normalizeDiagnostics(snapshot.diagnostics));

    const statusFromSnapshot = normalizeStatus(snapshot.status || '');
    if (statusFromSnapshot === 'blocked') {
      diagnostics.push.apply(diagnostics, normalizeDiagnostics(runtimeSurface.diagnostics));
      diagnostics.push(diagnostic('error', 'runtime_dom_map.blocked_by_snapshot', 'Runtime DOM source map is blocked because the runtime snapshot is blocked.'));
      const finalDiagnostics = dedupeDiagnostics(diagnostics).slice(0, limits.diagnostics);
      return {
        schemaVersion: MODEL_VERSION,
        kind: 'runtime_dom_map',
        status: 'blocked',
        capturedAt: String(snapshot.capturedAt || value.capturedAt || ''),
        summary: summaryFor([], finalDiagnostics, {blocked: true}),
        items: [],
        diagnostics: finalDiagnostics,
        confidence: 'exact'
      };
    }
    if (statusFromSnapshot === 'failed') {
      diagnostics.push(diagnostic('error', 'runtime_dom_map.blocked_by_snapshot', 'Runtime DOM source map could not run because the runtime snapshot failed.'));
    }
    if (!sourceEvidence.ready) {
      diagnostics.push(diagnostic('warning', 'runtime_dom_map.source_packet_missing', 'Runtime DOM source map did not receive source evidence from ProjectIndex.'));
    }

    const samples = collectElementSamples(snapshot, runtimeSurface, limits);
    if (!samples.length) {
      diagnostics.push(diagnostic('warning', 'runtime_dom_map.no_visible_elements', 'Runtime DOM source map found no visible DOM element samples to map.'));
    }

    const context = {
      runtimeSurface,
      sourceEvidence,
      snapshot,
      sceneId: firstNonEmpty(value.sceneId, snapshot.state && snapshot.state.sceneId, snapshot.summary && snapshot.summary.sceneId),
      limits
    };
    const items = samples
      .map((sample) => mapSample(sample, context))
      .filter(Boolean)
      .slice(0, limits.items);
    addMappingDiagnostics(diagnostics, items, samples, context);
    const finalDiagnostics = dedupeDiagnostics(diagnostics).slice(0, limits.diagnostics);
    return {
      schemaVersion: MODEL_VERSION,
      kind: 'runtime_dom_map',
      status: statusFor({snapshotStatus: statusFromSnapshot, items, samples, diagnostics: finalDiagnostics, sourceEvidence}),
      capturedAt: String(snapshot.capturedAt || value.capturedAt || ''),
      summary: summaryFor(items, finalDiagnostics, {visibleCount: samples.length}),
      items,
      diagnostics: finalDiagnostics,
      confidence: items.some((item) => item.confidence === 'exact' || item.confidence === 'strong') ? 'runtime' : 'profile'
    };
  }

  function normalizeDomMap(input, options) {
    const value = isObject(input) ? input : {};
    const limits = Object.assign({}, DEFAULT_LIMITS, isObject(options && options.limits) ? options.limits : {});
    const diagnostics = dedupeDiagnostics(normalizeDiagnostics(value.diagnostics)).slice(0, limits.diagnostics);
    const items = ensureArray(value.items).map((item) => normalizeItem(item, limits)).filter(Boolean).slice(0, limits.items);
    const status = normalizeStatus(value.status) || statusFor({
      snapshotStatus: '',
      items,
      samples: items,
      diagnostics,
      sourceEvidence: {ready: true}
    });
    return {
      schemaVersion: MODEL_VERSION,
      kind: 'runtime_dom_map',
      status,
      capturedAt: String(value.capturedAt || ''),
      summary: Object.assign(summaryFor(items, diagnostics, {visibleCount: Number(value.summary && value.summary.visibleCount || items.length)}), isObject(value.summary) ? {
        visibleCount: positiveInteger(value.summary.visibleCount, items.length),
        mappedCount: positiveInteger(value.summary.mappedCount, items.filter((item) => item.source && item.source.path).length),
        sourceBackedCount: positiveInteger(value.summary.sourceBackedCount, items.filter(isSourceBackedItem).length),
        manualReviewCount: positiveInteger(value.summary.manualReviewCount, items.filter(isManualReviewItem).length),
        diagnosticCount: diagnostics.length
      } : {}),
      items,
      diagnostics,
      confidence: String(value.confidence || (items.length ? 'runtime' : 'profile'))
    };
  }

  function buildSourceEvidence(projectIndex, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    const limits = Object.assign({}, DEFAULT_LIMITS, isObject(opts.limits) ? opts.limits : {});
    const focus = isObject(opts.focus) ? opts.focus : {};
    const runtimeSurface = isObject(opts.runtimeSurface) ? opts.runtimeSurface : {};
    const focusSceneId = firstNonEmpty(focus.targetSceneId, focus.sceneId, isSceneLikeFocus(focus) ? focus.id : '');
    const sceneRows = selectScenes(index, focusSceneId, limits);
    const textRows = selectTextCorpus(index, focusSceneId, limits);
    const assetRows = selectAssets(index, focusSceneId, limits);
    return {
      schemaVersion: MODEL_VERSION,
      kind: 'runtime_dom_source_evidence',
      focusSceneId,
      projectName: String(index.project && index.project.name || ''),
      scenes: sceneRows,
      textCorpus: textRows,
      assets: assetRows,
      runtimeSurface: {
        regions: ensureArray(runtimeSurface.regions).slice(0, limits.regions).map(normalizeRegionEvidence),
        controls: ensureArray(runtimeSurface.controls).slice(0, limits.controls).map(normalizeControlEvidence)
      },
      ready: Boolean(sceneRows.length || textRows.length || assetRows.length || ensureArray(runtimeSurface.regions).length)
    };
  }

  function selectScenes(index, focusSceneId, limits) {
    const rows = ensureArray(index.scenes);
    const selected = [];
    const rest = [];
    rows.forEach((scene) => {
      const row = normalizeSceneEvidence(scene);
      if (!row || !row.id) {
        return;
      }
      if (focusSceneId && row.id === focusSceneId) {
        selected.push(row);
      } else {
        rest.push(row);
      }
    });
    return selected.concat(rest).slice(0, limits.scenes);
  }

  function selectTextCorpus(index, focusSceneId, limits) {
    const rows = ensureArray(index.semantic && index.semantic.textCorpus && index.semantic.textCorpus.items)
      .map(normalizeTextEvidence)
      .filter(Boolean);
    const selected = focusSceneId
      ? rows.filter((item) => item.sceneId === focusSceneId || item.source.path.indexOf('/qdisplays/') >= 0)
      : rows;
    const fallback = focusSceneId ? rows.filter((item) => item.sceneId !== focusSceneId) : [];
    return selected.concat(fallback).slice(0, limits.textCorpus);
  }

  function selectAssets(index, focusSceneId, limits) {
    const rows = ensureArray(index.semantic && index.semantic.assets && index.semantic.assets.items)
      .map(normalizeAssetEvidence)
      .filter(Boolean);
    const selected = focusSceneId
      ? rows.filter((item) => item.usageRefs.some((usage) => usage.sceneId === focusSceneId || usage.id === focusSceneId))
      : rows;
    const fallback = focusSceneId ? rows.filter((item) => !selected.includes(item)) : [];
    return selected.concat(fallback).slice(0, limits.assets);
  }

  function collectElementSamples(snapshot, runtimeSurface, limits) {
    const out = [];
    ensureArray(snapshot.regions).forEach((region) => {
      const regionSamples = ensureArray(region.samples);
      if (regionSamples.length) {
        regionSamples.forEach((sample) => out.push(normalizeSample(Object.assign({}, sample, {
          role: sample.role || region.role,
          selector: sample.selector || region.selector,
          regionId: sample.regionId || region.id,
          regionSource: sample.regionSource || region.source
        }), limits)));
        return;
      }
      if (region.visible || region.found) {
        out.push(normalizeSample({
          role: region.role,
          selector: region.selector,
          regionId: region.id,
          text: region.text,
          visible: region.visible,
          box: region.box,
          regionSource: region.source
        }, limits));
      }
    });
    ensureArray(snapshot.domSamples).forEach((sample) => out.push(normalizeSample(sample, limits)));
    if (!out.length) {
      ensureArray(runtimeSurface && runtimeSurface.regions).forEach((region) => {
        if (region && region.source && region.source.path) {
          out.push(normalizeSample({
            role: region.role,
            selector: region.selector,
            regionId: region.id,
            visible: false,
            regionSource: region.source
          }, limits));
        }
      });
    }
    const seen = new Set();
    return out.filter((sample) => {
      if (!sample || sample.visible === false && !sample.text && !sample.src) {
        return false;
      }
      const key = [sample.selector, sample.role, sample.index, sample.text, sample.src].join('\n');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }).slice(0, limits.samples);
  }

  function mapSample(sample, context) {
    if (!sample) {
      return null;
    }
    const candidates = [];
    const datasetCandidate = sourceFromDataset(sample);
    if (datasetCandidate) {
      candidates.push(datasetCandidate);
    }
    if (sample.src) {
      candidates.push.apply(candidates, assetCandidates(sample, context));
    }
    if (isChoiceRole(sample.role, sample.selector)) {
      candidates.push.apply(candidates, choiceCandidates(sample, context));
    }
    if (sample.text) {
      candidates.push.apply(candidates, textCandidates(sample, context));
    }
    if (isGraphicSample(sample)) {
      candidates.push.apply(candidates, graphicCandidates(sample, context));
    }
    candidates.push.apply(candidates, sceneFallbackCandidates(sample, context));
    candidates.push.apply(candidates, regionFallbackCandidates(sample));
    const best = chooseCandidate(candidates);
    const item = normalizeItem(Object.assign({
      id: sample.id || sample.sampleId || safeId([sample.role, sample.selector, sample.text || sample.src].join('_')),
      selector: sample.selector,
      role: sample.role,
      tag: sample.tag,
      text: sample.text,
      src: sample.src,
      sceneId: best.sceneId || sample.dataset.dmsSceneId || context.sceneId || '',
      box: sample.box,
      sample
    }, best), context.limits);
    if (!item.source.path) {
      item.confidence = 'manual_review';
      item.editability = 'manual_review';
      item.reason = item.reason || 'No source evidence matched this visible runtime element.';
    }
    return item;
  }

  function sourceFromDataset(sample) {
    const data = sample.dataset || {};
    const path = firstNonEmpty(data.dmsSourcePath, data.dmsPath);
    if (!path) {
      return null;
    }
    return {
      source: sourceRef({path, line: data.dmsSourceLine || data.dmsLine}),
      sceneId: firstNonEmpty(data.dmsSceneId),
      confidence: 'exact',
      editability: 'source_backed',
      reason: 'Runtime element exposed Dendry Mod Studio source dataset breadcrumbs.'
    };
  }

  function assetCandidates(sample, context) {
    const basename = fileName(sample.src);
    if (!basename) {
      return [];
    }
    const matches = context.sourceEvidence.assets.filter((asset) => {
      return [asset.path, asset.previewUrl, asset.name].some((value) => fileName(value) === basename) ||
        normalizePath(sample.src).endsWith(normalizePath(asset.path));
    });
    const narrowed = narrowAssetMatches(matches, context.sceneId);
    if (narrowed.ambiguous) {
      return [{
        source: {},
        sceneId: context.sceneId,
        confidence: 'manual_review',
        editability: 'manual_review',
        reason: 'Multiple source asset references matched this runtime asset.',
        ambiguous: true
      }];
    }
    return narrowed.matches.map((asset) => {
      const usage = asset.usageRefs.find((item) => item.sceneId === context.sceneId || item.id === context.sceneId) || asset.usageRefs[0] || {};
      const source = sourceRef(usage.source || asset.source);
      const generated = isGeneratedSource(source.path || asset.path);
      return {
        source,
        sceneId: usage.sceneId || usage.id || context.sceneId,
        confidence: generated ? 'manual_review' : 'strong',
        editability: generated ? 'manual_review' : (asset.editability || 'reference_only'),
        reason: generated ? 'Runtime asset exists only as generated out/html evidence.' : 'Runtime asset filename matched source asset usage evidence.'
      };
    });
  }

  function narrowAssetMatches(matches, sceneId) {
    if (!matches.length) {
      return {matches: [], ambiguous: false};
    }
    const sceneMatches = sceneId
      ? matches.filter((asset) => asset.usageRefs.some((usage) => usage.sceneId === sceneId || usage.id === sceneId))
      : [];
    const narrowed = sceneMatches.length ? sceneMatches : matches;
    return {matches: narrowed.slice(0, 2), ambiguous: narrowed.length > 1 && !sceneMatches.length};
  }

  function choiceCandidates(sample, context) {
    const text = normalizedText(sample.text);
    if (!text) {
      return [];
    }
    const scene = sceneById(context.sourceEvidence, context.sceneId);
    const optionMatches = [];
    ensureArray(scene && scene.options).concat(ensureArray(scene && scene.sectionOptions)).forEach((option) => {
      const label = normalizedText(option.label || option.title || option.text || option.id);
      if (label && (text === label || text.includes(label) || label.includes(text))) {
        optionMatches.push(option);
      }
    });
    if (optionMatches.length === 1 && optionMatches[0].source.path) {
      return [{
        source: sourceRef(optionMatches[0].source),
        sceneId: context.sceneId,
        confidence: 'exact',
        editability: 'draft_extractable',
        reason: 'Visible choice matched a unique source option in the focused scene.'
      }];
    }
    if (optionMatches.length > 1) {
      return [{
        source: {},
        sceneId: context.sceneId,
        confidence: 'manual_review',
        editability: 'manual_review',
        reason: 'Multiple source options matched this visible choice.',
        ambiguous: true
      }];
    }
    return textCandidates(sample, context, {roles: ['option_label', 'option_subtitle', 'unavailable_text'], reason: 'Visible choice matched text corpus option evidence.'});
  }

  function textCandidates(sample, context, options) {
    const opts = options || {};
    const sampleText = normalizedText(sample.text);
    if (!sampleText) {
      return [];
    }
    const rows = context.sourceEvidence.textCorpus.filter((item) => {
      if (opts.roles && opts.roles.indexOf(item.role) < 0) {
        return false;
      }
      if (context.sceneId && item.sceneId && item.sceneId !== context.sceneId && item.source.path.indexOf('/qdisplays/') < 0) {
        return false;
      }
      return textMatches(sampleText, normalizedText(item.text));
    });
    if (!rows.length) {
      return [];
    }
    const bestRows = rows.sort((a, b) => textMatchScore(sampleText, b.normalized) - textMatchScore(sampleText, a.normalized));
    if (bestRows.length > 1 && textMatchScore(sampleText, bestRows[0].normalized) === textMatchScore(sampleText, bestRows[1].normalized)) {
      return [{
        source: {},
        sceneId: context.sceneId,
        confidence: 'manual_review',
        editability: 'manual_review',
        reason: 'Multiple text corpus items matched this runtime text.',
        ambiguous: true
      }];
    }
    const best = bestRows[0];
    return [{
      source: sourceRef(best.source),
      sceneId: best.sceneId || context.sceneId,
      confidence: best.role === 'option_label' && isChoiceRole(sample.role, sample.selector) ? 'exact' : 'strong',
      editability: best.editability || 'text_proposal',
      reason: opts.reason || 'Runtime text matched ProjectIndex text corpus evidence.'
    }];
  }

  function graphicCandidates(sample, context) {
    const scene = sceneById(context.sourceEvidence, context.sceneId);
    if (!scene || !scene.source.path) {
      return [];
    }
    return [{
      source: scene.source,
      sceneId: context.sceneId,
      confidence: 'weak',
      editability: 'manual_review',
      reason: 'Runtime graphic is inferred from the focused scene; custom JS/D3 still needs manual review.'
    }];
  }

  function sceneFallbackCandidates(sample, context) {
    const scene = sceneById(context.sourceEvidence, context.sceneId);
    if (!scene || !scene.source.path || !isContentLikeRole(sample.role, sample.selector)) {
      return [];
    }
    return [{
      source: scene.source,
      sceneId: context.sceneId,
      confidence: 'weak',
      editability: 'manual_review',
      reason: 'Runtime element is visible in the focused scene, but no more precise source text match was found.'
    }];
  }

  function regionFallbackCandidates(sample) {
    const source = sourceRef(sample.regionSource || {});
    if (!source.path) {
      return [];
    }
    const generated = isGeneratedSource(source.path);
    return [{
      source,
      sceneId: '',
      confidence: generated ? 'manual_review' : 'weak',
      editability: generated ? 'manual_review' : 'reference_only',
      reason: generated ? 'Element maps only to generated runtime HTML/CSS evidence.' : 'Element maps to static runtime region source evidence.'
    }];
  }

  function chooseCandidate(candidates) {
    const rows = ensureArray(candidates).filter(Boolean);
    if (!rows.length) {
      return {source: {}, confidence: 'manual_review', editability: 'manual_review', reason: ''};
    }
    rows.sort((a, b) => candidateScore(b) - candidateScore(a));
    return rows[0];
  }

  function candidateScore(candidate) {
    if (candidate && candidate.ambiguous) {
      return 25;
    }
    const confidence = CONFIDENCE_RANK[String(candidate.confidence || '')] || 0;
    const source = sourceRef(candidate.source || {});
    const sourceBonus = source.path ? 1 : 0;
    const generatedPenalty = isGeneratedSource(source.path) ? -1 : 0;
    return confidence * 10 + sourceBonus + generatedPenalty;
  }

  function addMappingDiagnostics(diagnostics, items, samples, context) {
    const choices = items.filter((item) => isChoiceRole(item.role, item.selector));
    if (choices.some((item) => isManualReviewItem(item))) {
      diagnostics.push(diagnostic('warning', 'runtime_dom_map.unmapped_choices', 'One or more visible choices could not be mapped to a unique source option.'));
    }
    const assets = samples.filter((sample) => sample && sample.src);
    const mappedAssets = items.filter((item) => item.src && item.source && item.source.path && !isGeneratedSource(item.source.path));
    if (assets.length && mappedAssets.length < assets.length) {
      diagnostics.push(diagnostic('warning', 'runtime_dom_map.unmapped_assets', 'One or more visible runtime assets could not be mapped to source asset usage.'));
    }
    if (items.some((item) => /Multiple /.test(String(item.reason || '')))) {
      diagnostics.push(diagnostic('warning', 'runtime_dom_map.ambiguous_source', 'Some runtime DOM elements matched multiple possible source locations.'));
    }
    if (!context.sourceEvidence.ready) {
      diagnostics.push(diagnostic('warning', 'runtime_dom_map.source_packet_missing', 'Runtime source evidence was missing or empty.'));
    }
  }

  function statusFor(context) {
    if (context.snapshotStatus === 'blocked') {
      return 'blocked';
    }
    if (context.snapshotStatus === 'failed') {
      return 'failed';
    }
    const diagnostics = ensureArray(context.diagnostics);
    const items = ensureArray(context.items);
    const samples = ensureArray(context.samples);
    if (diagnostics.some((diag) => diag && diag.severity === 'error')) {
      return 'failed';
    }
    if (!samples.length) {
      return 'partial';
    }
    if (!items.length || !context.sourceEvidence.ready) {
      return 'partial';
    }
    if (items.some(isManualReviewItem) || diagnostics.some((diag) => diag && diag.severity === 'warning')) {
      return 'partial';
    }
    return 'ready';
  }

  function summaryFor(items, diagnostics, options) {
    const rows = ensureArray(items);
    const opts = options || {};
    return {
      visibleCount: positiveInteger(opts.visibleCount, rows.length),
      mappedCount: rows.filter((item) => item.source && item.source.path).length,
      sourceBackedCount: rows.filter(isSourceBackedItem).length,
      manualReviewCount: rows.filter(isManualReviewItem).length,
      diagnosticCount: ensureArray(diagnostics).length
    };
  }

  function normalizeSourceEvidence(input, options) {
    const value = isObject(input) ? input : {};
    const runtimeSurface = isObject(options && options.runtimeSurface) ? options.runtimeSurface : {};
    const limits = Object.assign({}, DEFAULT_LIMITS, isObject(options && options.limits) ? options.limits : {});
    const scenes = ensureArray(value.scenes).map(normalizeSceneEvidence).filter(Boolean).slice(0, limits.scenes);
    const textCorpus = ensureArray(value.textCorpus).map(normalizeTextEvidence).filter(Boolean).slice(0, limits.textCorpus);
    const assets = ensureArray(value.assets).map(normalizeAssetEvidence).filter(Boolean).slice(0, limits.assets);
    const surface = isObject(value.runtimeSurface) ? value.runtimeSurface : runtimeSurface;
    return {
      schemaVersion: MODEL_VERSION,
      kind: 'runtime_dom_source_evidence',
      focusSceneId: String(value.focusSceneId || ''),
      projectName: String(value.projectName || ''),
      scenes,
      textCorpus,
      assets,
      runtimeSurface: {
        regions: ensureArray(surface.regions).map(normalizeRegionEvidence).filter(Boolean).slice(0, limits.regions),
        controls: ensureArray(surface.controls).map(normalizeControlEvidence).filter(Boolean).slice(0, limits.controls)
      },
      ready: value.ready !== false && Boolean(scenes.length || textCorpus.length || assets.length || ensureArray(surface.regions).length)
    };
  }

  function normalizeSceneEvidence(scene) {
    if (!isObject(scene)) {
      return null;
    }
    const id = String(scene.id || '').trim();
    if (!id) {
      return null;
    }
    const options = [];
    ensureArray(scene.options).forEach((option) => options.push(normalizeOptionEvidence(option)));
    ensureArray(scene.sections).forEach((section) => {
      ensureArray(section && section.options).forEach((option) => options.push(normalizeOptionEvidence(option)));
    });
    return {
      id,
      title: clipped(scene.title || scene.name || id, 120),
      type: String(scene.type || ''),
      path: String(scene.path || scene.sourcePath || ''),
      source: sourceRef(scene.source || scene.sourceSpan || scene.topLevelSpan || {path: scene.path}),
      options: options.filter(Boolean),
      sectionOptions: options.filter(Boolean),
      sections: ensureArray(scene.sections).map((section) => ({
        id: String(section && section.id || ''),
        title: clipped(section && section.title || '', 120),
        source: sourceRef(section && (section.source || section.sourceSpan) || {})
      })).slice(0, 80)
    };
  }

  function normalizeOptionEvidence(option) {
    if (!isObject(option)) {
      return null;
    }
    return {
      id: String(option.id || ''),
      label: clipped(firstNonEmpty(option.label, option.title, option.text), 160),
      title: clipped(option.title || '', 160),
      text: clipped(option.text || '', 160),
      source: sourceRef(option.source || option.sourceSpan || {})
    };
  }

  function normalizeTextEvidence(item) {
    if (!isObject(item)) {
      return null;
    }
    const text = clipped(item.text || item.label || item.title || '', 240);
    if (!text) {
      return null;
    }
    const owner = isObject(item.owner) ? item.owner : {};
    return {
      id: String(item.id || ''),
      role: String(item.role || ''),
      text,
      normalized: normalizedText(text),
      sceneId: String(item.sceneId || owner.sceneId || ''),
      sectionId: String(item.sectionId || owner.sectionId || ''),
      optionId: String(item.optionId || ''),
      source: sourceRef(item.source || item.sourceSpan || {}),
      editability: String(item.editability || '')
    };
  }

  function normalizeAssetEvidence(item) {
    if (!isObject(item)) {
      return null;
    }
    const path = normalizePath(item.path || item.previewUrl || item.name || '');
    if (!path) {
      return null;
    }
    return {
      id: String(item.id || ''),
      name: String(item.name || fileName(path)),
      path,
      previewUrl: normalizePath(item.previewUrl || ''),
      type: String(item.type || ''),
      source: sourceRef(item.source || {}),
      editability: String(item.editability || ''),
      usageRefs: ensureArray(item.usageRefs).map((usage) => ({
        sceneId: String(usage && (usage.sceneId || usage.id) || ''),
        id: String(usage && usage.id || ''),
        role: String(usage && usage.role || ''),
        source: sourceRef(usage && usage.source || {})
      })).filter((usage) => usage.source.path || usage.sceneId).slice(0, 20)
    };
  }

  function normalizeRegionEvidence(region) {
    if (!isObject(region)) {
      return null;
    }
    return {
      id: String(region.id || ''),
      role: String(region.role || ''),
      selector: String(region.selector || ''),
      label: String(region.label || ''),
      source: sourceRef(region.source || {})
    };
  }

  function normalizeControlEvidence(control) {
    if (!isObject(control)) {
      return null;
    }
    return {
      id: String(control.id || ''),
      label: String(control.label || ''),
      selector: String(control.selector || ''),
      handler: String(control.handler || ''),
      source: sourceRef(control.source || {})
    };
  }

  function normalizeSample(input, limits) {
    const value = isObject(input) ? input : {};
    return {
      id: String(value.id || value.sampleId || ''),
      index: positiveInteger(value.index, 0),
      selector: clipped(value.selector || '', 120),
      regionId: String(value.regionId || ''),
      role: String(value.role || ''),
      tag: String(value.tag || '').toLowerCase(),
      elementId: String(value.elementId || value.idAttr || ''),
      className: clipped(value.className || '', 160),
      visible: value.visible !== false,
      text: clipped(value.text || '', positiveInteger(limits.text, DEFAULT_LIMITS.text)),
      src: clipped(firstNonEmpty(value.currentSrc, value.src), 240),
      alt: clipped(value.alt || '', 120),
      title: clipped(value.title || '', 120),
      dataset: normalizeDataset(value.dataset),
      box: normalizeBox(value.box),
      regionSource: sourceRef(value.regionSource || value.source || {})
    };
  }

  function normalizeItem(input, limits) {
    if (!isObject(input)) {
      return null;
    }
    return {
      id: String(input.id || safeId([input.role, input.selector, input.text || input.src].join('_'))),
      selector: clipped(input.selector || '', 120),
      role: String(input.role || ''),
      tag: String(input.tag || ''),
      text: clipped(input.text || '', positiveInteger(limits.text, DEFAULT_LIMITS.text)),
      src: clipped(input.src || '', 240),
      sceneId: String(input.sceneId || ''),
      source: sourceRef(input.source || {}),
      confidence: normalizeConfidence(input.confidence),
      editability: String(input.editability || ''),
      reason: clipped(input.reason || '', 220),
      box: normalizeBox(input.box)
    };
  }

  function normalizeDataset(value) {
    const data = isObject(value) ? value : {};
    const out = {};
    Object.keys(data).forEach((key) => {
      if (/^dms[A-Z0-9_]/.test(key) || /^dms[-_]/i.test(key)) {
        out[key] = clipped(data[key], 160);
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
        code: String(item.code || 'runtime_dom_map.diagnostic'),
        message: String(item.message || item.code || 'Runtime DOM source map diagnostic.'),
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
      const key = [diag.severity, diag.code, diag.message, diag.path || '', diag.missingPath || ''].join('\n');
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      out.push(diag);
    });
    return out;
  }

  function isSourceBackedItem(item) {
    const path = item && item.source && item.source.path || '';
    return Boolean(path && !isGeneratedSource(path) && !isManualReviewItem(item));
  }

  function isManualReviewItem(item) {
    const confidence = String(item && item.confidence || '');
    const editability = String(item && item.editability || '');
    const path = item && item.source && item.source.path || '';
    return confidence === 'manual_review' || editability === 'manual_review' || editability === 'ide_escape_hatch' || isGeneratedSource(path);
  }

  function isGeneratedSource(path) {
    return normalizePath(path).startsWith('out/html/');
  }

  function sceneById(sourceEvidence, sceneId) {
    const id = String(sceneId || '').trim();
    if (!id) {
      return null;
    }
    return ensureArray(sourceEvidence && sourceEvidence.scenes).find((scene) => scene && scene.id === id) || null;
  }

  function sourceRef(value) {
    if (!isObject(value)) {
      return {};
    }
    const path = normalizePath(value.path || value.sourcePath || '');
    if (!path) {
      return {};
    }
    const ref = {path};
    const line = positiveInteger(value.line || value.startLine, 0);
    if (line) {
      ref.line = line;
    }
    const startLine = positiveInteger(value.startLine, 0);
    if (startLine) {
      ref.startLine = startLine;
    }
    const endLine = positiveInteger(value.endLine, 0);
    if (endLine) {
      ref.endLine = endLine;
    }
    return ref;
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

  function isChoiceRole(role, selector) {
    const text = [role, selector].join(' ').toLowerCase();
    return text.includes('choice') || text.includes('choices');
  }

  function isContentLikeRole(role, selector) {
    const text = [role, selector].join(' ').toLowerCase();
    return /content|sidebar|panel|card|portrait|background|options|save|choices?/.test(text);
  }

  function isGraphicSample(sample) {
    const tag = String(sample && sample.tag || '').toLowerCase();
    const text = [sample && sample.role, sample && sample.selector, sample && sample.className].join(' ').toLowerCase();
    return tag === 'svg' || tag === 'canvas' || text.includes('d3') || text.includes('graph') || text.includes('chart');
  }

  function textMatches(sampleText, candidateText) {
    if (!sampleText || !candidateText) {
      return false;
    }
    return sampleText === candidateText || sampleText.includes(candidateText) || candidateText.includes(sampleText) || textMatchScore(sampleText, candidateText) >= 0.72;
  }

  function textMatchScore(a, b) {
    const left = new Set(String(a || '').split(' ').filter(Boolean));
    const right = new Set(String(b || '').split(' ').filter(Boolean));
    if (!left.size || !right.size) {
      return 0;
    }
    let shared = 0;
    left.forEach((token) => {
      if (right.has(token)) {
        shared += 1;
      }
    });
    return shared / Math.max(left.size, right.size);
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

  function isSceneLikeFocus(focus) {
    const kind = String(focus && focus.kind || '');
    return ['scene', 'event', 'news', 'hand', 'deck', 'route', 'text_replacement'].indexOf(kind) >= 0;
  }

  function normalizePath(value) {
    return String(value || '').trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+/g, '/');
  }

  function fileName(value) {
    const normalized = normalizePath(value).split(/[?#]/)[0];
    const parts = normalized.split('/');
    return parts[parts.length - 1] || '';
  }

  function normalizeStatus(value) {
    const text = String(value || '').trim().toLowerCase();
    return MAP_STATUSES.indexOf(text) >= 0 ? text : '';
  }

  function normalizeConfidence(value) {
    const text = String(value || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(CONFIDENCE_RANK, text) ? text : 'manual_review';
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message, confidence: 'runtime'};
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
    return String(value || 'runtime_dom')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'runtime_dom';
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
    MAP_STATUSES,
    buildDomMap,
    normalizeDomMap,
    buildSourceEvidence
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapRuntimeDomMapModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
