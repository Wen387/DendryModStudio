(function initPreviewModel(global) {
  'use strict';

  const PREVIEW_MODEL_VERSION = '0.1';
  const PREVIEW_KIND = 'preview_model';
  const CONFIDENCE = new Set(['exact', 'approximate', 'unsupported']);
  const ASSET_WARNING = 'Asset references are indexed for authoring preview only; Studio does not copy or install asset files yet.';

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function assetModelApi() {
    if (global && global.ProjectMapAssetModel) {
      return global.ProjectMapAssetModel;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('./asset_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function buildPreviewModel(input, options) {
    const context = normalizeInput(input, options || {});
    const sourceKind = inferSourceKind(context);
    if (sourceKind === 'event') {
      return eventPreview(context);
    }
    if (sourceKind === 'card') {
      return cardPreview(context);
    }
    if (sourceKind === 'news') {
      return newsPreview(context);
    }
    if (sourceKind === 'surface_text') {
      return surfaceTextPreview(context);
    }
    if (sourceKind === 'existing_scene_edit') {
      return existingSceneEditPreview(context);
    }
    return basePreview(context, 'unknown', {
      confidence: 'unsupported',
      title: '(unsupported preview)',
      warnings: ['PreviewModel does not recognize this draft type.']
    });
  }

  function normalizeInput(input, options) {
    const value = isObject(input) ? input : {};
    const extraction = Boolean(value.draft && (value.template || value.status || value.notCaptured || value.captured));
    const bundle = Boolean(value.draft && (value.files || value.installPlan || value.patchPreview || value.installNotes));
    const draft = isObject(value.draft) ? value.draft : value;
    return {
      raw: value,
      draft,
      options: options || {},
      mode: options.mode || (extraction ? 'extracted' : (bundle ? 'bundle' : 'draft')),
      extraction,
      bundle,
      diagnostics: ensureArray(value.diagnostics),
      captured: ensureArray(value.captured),
      notCaptured: ensureArray(value.notCaptured),
      projectIndex: options.projectIndex || null,
      sourceKindOverride: options.sourceKind || ''
    };
  }

  function inferSourceKind(context) {
    const draft = context.draft || {};
    const raw = context.raw || {};
    const explicit = normalizeKind(context.sourceKindOverride);
    if (raw.delivery === 'legacy_event_popup') {
      return 'event';
    }
    if (explicit && explicit !== 'news') {
      return explicit;
    }
    if (explicit === 'news' && raw.delivery === 'legacy_event_popup') {
      return 'event';
    }
    if (explicit) {
      return explicit;
    }
    if (raw.template) {
      return normalizeKind(raw.template);
    }
    if (draft.kind === 'world_event') {
      return 'event';
    }
    if (draft.kind === 'card') {
      return 'card';
    }
    if (draft.kind === 'news_item') {
      return 'news';
    }
    if (draft.kind === 'surface_text') {
      return 'surface_text';
    }
    if (draft.kind === 'existing_scene_edit') {
      return 'existing_scene_edit';
    }
    if (draft.delivery === 'legacy_event_popup') {
      return 'event';
    }
    return '';
  }

  function normalizeKind(value) {
    const text = String(value || '').trim();
    if (text === 'event' || text === 'events' || text === 'world_event') {
      return 'event';
    }
    if (text === 'card' || text === 'cards' || text === 'advisor_like') {
      return 'card';
    }
    if (text === 'news' || text === 'news_item') {
      return 'news';
    }
    if (text === 'surface' || text === 'surfaceText' || text === 'surface_text') {
      return 'surface_text';
    }
    return text;
  }

  function basePreview(context, sourceKind, values) {
    const warnings = ensureArray(values.warnings).concat(extractionWarnings(context));
    const assets = assetRefsFromContext(context);
    const assetManifest = buildAssetManifest(assets, context);
    if (assets.length) {
      warnings.push(ASSET_WARNING);
    }
    assetMissingWarnings(assets).forEach((warning) => warnings.push(warning));
    const confidence = normalizeConfidence(values.confidence || confidenceFromContext(context));
    const install = installSummary(context, values.install);
    return {
      schemaVersion: PREVIEW_MODEL_VERSION,
      kind: PREVIEW_KIND,
      sourceKind,
      mode: context.mode || 'draft',
      confidence,
      warnings,
      diagnostics: context.diagnostics,
      title: String(values.title || '').trim(),
      meta: ensureArray(values.meta),
      body: ensureArray(values.body),
      choices: ensureArray(values.choices),
      assets,
      assetManifest,
      install,
      readiness: previewReadiness({
        sourceKind,
        mode: context.mode || 'draft',
        confidence,
        warnings,
        assets,
        install
      })
    };
  }

  function previewReadiness(value) {
    const confidence = normalizeConfidence(value && value.confidence);
    const warnings = ensureArray(value && value.warnings);
    const assets = ensureArray(value && value.assets);
    const install = value && value.install || {};
    const manual = confidence === 'unsupported' || install.status === 'manual-only';
    const key = manual
      ? 'manual_review'
      : (confidence === 'exact' && warnings.length === 0 ? 'ready_to_review' : 'needs_review');
    const label = {
      ready_to_review: 'Ready to review',
      needs_review: 'Review recommended',
      manual_review: 'Manual review needed'
    }[key];
    const summary = {
      ready_to_review: 'Ready to review as an authoring preview; this is not a runtime simulation.',
      needs_review: 'Review recommended before applying; this is an authoring preview, not a runtime simulation.',
      manual_review: 'Manual review needed; Studio cannot safely own this preview as an installable change.'
    }[key];
    return {
      key,
      label,
      summary,
      confidence,
      runtimePreview: false,
      warningCount: warnings.length,
      assetCount: assets.length,
      installStatus: install.status || 'proposal-only'
    };
  }

  function normalizeConfidence(value) {
    const text = String(value || '').trim();
    return CONFIDENCE.has(text) ? text : 'approximate';
  }

  function confidenceFromContext(context) {
    const raw = context.raw || {};
    const draft = context.draft || {};
    if (raw.status === 'unsupported' || draft.editability === 'ide_escape_hatch') {
      return 'unsupported';
    }
    if (context.extraction && raw.status !== 'exact') {
      return 'approximate';
    }
    return 'exact';
  }

  function extractionWarnings(context) {
    const warnings = [];
    if (context.extraction && context.notCaptured.length) {
      warnings.push('Not captured: ' + context.notCaptured.join(', '));
    }
    if (context.raw && context.raw.status === 'partial') {
      warnings.push('This preview is seeded from a partial source extraction.');
    }
    return warnings;
  }

  function installSummary(context, override) {
    if (override) {
      return override;
    }
    const raw = context.raw || {};
    const draft = context.draft || {};
    if (draft.editability === 'ide_escape_hatch' || raw.status === 'ide_escape_hatch' || raw.status === 'unsupported') {
      return {status: 'manual-only', safeApply: 0, manualReview: 1, refused: 0};
    }
    const operations = ensureArray(raw.installPlan && raw.installPlan.operations);
    if (operations.length) {
      return {
        status: 'proposal-only',
        safeApply: operations.filter((op) => op && op.safety === 'safe_apply').length,
        manualReview: operations.filter((op) => op && op.safety === 'manual_review').length,
        refused: operations.filter((op) => op && op.safety === 'refused').length
      };
    }
    return {status: 'proposal-only', safeApply: 0, manualReview: 0, refused: 0};
  }

  function eventPreview(context) {
    const draft = context.draft || {};
    const raw = context.raw || {};
    if (raw.delivery === 'legacy_event_popup' || draft.delivery === 'legacy_event_popup') {
      return legacyPopupPreview(context);
    }
    const when = isObject(draft.when) ? draft.when : {};
    const metaRows = [
      meta('Type', 'world_event'),
      meta('When', dateRange(when.year, when.monthStart, when.monthEnd)),
      meta('Requires', when.requires || '(none)'),
      meta('Priority', numberText(when.priority, '0'))
    ];
    if (draft.seenFlag) {
      metaRows.push(metaItem('Seen flag', draft.seenFlag));
    }
    return basePreview(context, 'event', {
      title: draft.title || draft.heading || '(untitled event)',
      meta: metaRows,
      body: headingAndParagraphs(draft.heading || draft.title, draft.introParagraphs),
      choices: ensureArray(draft.options).map(choicePreview),
      confidence: confidenceFromContext(context)
    });
  }

  function legacyPopupPreview(context) {
    const item = context.raw || {};
    const router = item.router || {};
    return basePreview(context, 'event', {
      title: item.headline || item.title || '(untitled monthly popup)',
      meta: [
        meta('Delivery', 'legacy_event_popup'),
        meta('Router', router.anchor ? router.anchor + ' / #' + (router.tag || 'event') : '#event'),
        meta('Linked scene', item.linkedSceneId || '(unknown)'),
        meta('Confidence', item.confidence || 'static_inferred')
      ],
      body: [
        bodyRow('heading', item.headline || item.title || '(untitled monthly popup)'),
        bodyRow('paragraph', item.description || item.excerpt || '(no excerpt in index)')
      ],
      choices: [],
      confidence: 'approximate',
      warnings: ['Monthly event popups are event-scene previews, not Island-style ticker news.']
    });
  }

  function cardPreview(context) {
    const draft = context.draft || {};
    const metaRows = [
      meta('Card kind', draft.cardKind || 'action_card'),
      meta('Priority', numberText(draft.priority, '(default)')),
      meta('Frequency', numberText(draft.frequency, '(default)')),
      meta('Max visits', numberText(draft.maxVisits, '(default)'))
    ];
    if (draft.viewIf) {
      metaRows.push(meta('View-if', draft.viewIf));
    }
    if (ensureArray(draft.tags).length) {
      metaRows.push(meta('Tags', ensureArray(draft.tags).join(', ')));
    }
    const body = headingAndParagraphs(draft.heading || draft.title, draft.introParagraphs);
    if (draft.subtitle) {
      body.splice(1, 0, bodyRow('subtitle', draft.subtitle));
    }
    return basePreview(context, 'card', {
      title: draft.title || draft.heading || '(untitled card)',
      meta: metaRows,
      body,
      choices: ensureArray(draft.options).map(choicePreview),
      confidence: confidenceFromContext(context)
    });
  }

  function newsPreview(context) {
    const draft = context.draft || {};
    const delivery = draft.delivery || 'dated';
    const when = isObject(draft.when) ? draft.when : {};
    const pool = isObject(draft.pool) ? draft.pool : {};
    const dated = delivery !== 'background_pool';
    const metaRows = [
      meta('Delivery', delivery),
      dated
        ? meta('Slot', 'news_' + String(when.slot || 1))
        : meta('Pool', pool.name || 'social_pool')
    ];
    if (dated) {
      metaRows.push(meta('When', dateRange(when.year, when.month, when.month)));
      if (when.requiresJs) {
        metaRows.push(meta('Requires JS', when.requiresJs));
      }
    } else if (pool.requiresJs) {
      metaRows.push(meta('Requires JS', pool.requiresJs));
    }
    return basePreview(context, 'news', {
      title: draft.headline || '(untitled news)',
      meta: metaRows,
      body: [
        bodyRow('news', draft.headline || '(untitled news)'),
        bodyRow('paragraph', draft.description || '(no description)')
      ],
      choices: [],
      confidence: (when.requiresJs || pool.requiresJs) ? 'approximate' : confidenceFromContext(context),
      warnings: (when.requiresJs || pool.requiresJs) ? ['Requires JS is shown but not evaluated in Studio preview.'] : []
    });
  }

  function surfaceTextPreview(context) {
    const draft = context.draft || {};
    const unsupported = draft.editability === 'ide_escape_hatch' || context.raw.status === 'ide_escape_hatch';
    return basePreview(context, 'surface_text', {
      title: draft.originalLabel && draft.replacementLabel
        ? draft.originalLabel + ' -> ' + draft.replacementLabel
        : 'Text replacement proposal',
      meta: [
        meta('Area', draft.area || '(unknown)'),
        meta('Editability', draft.editability || 'ide_escape_hatch'),
        meta('Source', sourceLabel(draft.source))
      ],
      body: [
        bodyRow('replacement', 'Before: ' + (draft.originalLabel || '(empty)')),
        bodyRow('replacement', 'After: ' + (draft.replacementLabel || '(empty)')),
        bodyRow('paragraph', draft.reason || '')
      ].filter((row) => row.text),
      choices: [],
      confidence: unsupported ? 'unsupported' : confidenceFromContext(context),
      warnings: unsupported ? ['This source needs mapping before Studio can preview runtime ownership or build an executable patch.'] : []
    });
  }

  function existingSceneEditPreview(context) {
    const draft = context.draft || {};
    const changes = ensureArray(draft.changes);
    const summary = isObject(draft.changeSummary) ? draft.changeSummary : summarizeExistingChanges(changes);
    const sceneKind = String(draft.sceneKind || 'event') === 'card' ? 'Card' : 'Event';
    const manualCount = Number(summary.manualFields || 0);
    const warnings = manualCount
      ? [manualCount + ' changed field' + (manualCount === 1 ? '' : 's') + ' need Studio source review because safe source evidence is missing.']
      : [];
    const body = [];
    if (!changes.length) {
      body.push(bodyRow('paragraph', 'No changed fields yet.'));
    }
    changes.forEach((change) => {
      const label = change.label || roleLabel(change.role);
      const source = sourceLabel(change.source);
      body.push(bodyRow('heading', label + ' — ' + source));
      body.push(bodyRow('replacement', 'Before: ' + (change.before || '(empty)')));
      body.push(bodyRow('replacement', 'After: ' + (change.after || '(empty)')));
    });
    return basePreview(context, 'existing_scene_edit', {
      title: 'Modify existing ' + sceneKind + ': ' + (draft.title || draft.sceneId || '(untitled scene)'),
      meta: [
        meta('Scene', draft.sceneId || '(unknown)'),
        meta('Source', draft.sourcePath || (draft.source && draft.source.path) || '(unknown source)'),
        meta('Changed fields', String(changes.length)),
        meta('Manual fields', String(manualCount))
      ],
      body,
      choices: [],
      confidence: changes.length && manualCount === 0 ? 'exact' : 'approximate',
      warnings
    });
  }

  function summarizeExistingChanges(changes) {
    return ensureArray(changes).reduce((summary, change) => {
      summary.total += 1;
      if (String(change && change.editability || '') === 'manual_review') {
        summary.manualFields += 1;
      }
      return summary;
    }, {total: 0, textFields: ensureArray(changes).length, metadataFields: 0, manualFields: 0});
  }

  function roleLabel(role) {
    const labels = {
      title: 'Title',
      heading: 'Heading',
      subtitle: 'Subtitle',
      body: 'Body',
      conditional_body: 'Conditional text',
      option_label: 'Player option',
      option_subtitle: 'Option subtitle',
      unavailable_text: 'Unavailable text'
    };
    return labels[String(role || '')] || String(role || 'Text');
  }

  function choicePreview(option, index) {
    const value = isObject(option) ? option : {};
    return {
      id: String(value.id || (value.target && value.target.id) || ('choice_' + (index + 1))).trim(),
      label: String(value.label || value.title || ('Choice ' + (index + 1))).trim(),
      subtitle: String(value.subtitle || '').trim(),
      availability: value.chooseIf
        ? {status: 'conditional', condition: value.chooseIf, unavailableText: value.unavailableText || ''}
        : {status: 'available', condition: '', unavailableText: ''},
      resultParagraphs: ensureArray(value.narrativeParagraphs).map(String).filter(Boolean),
      variants: ensureArray(value.variants).map((variant) => ({
        condition: String((variant && variant.condition) || '').trim(),
        text: String((variant && variant.text) || '').trim()
      })).filter((variant) => variant.condition || variant.text),
      effects: ensureArray(value.effects).map(effectText).filter(Boolean),
      gotoAfter: value.gotoAfter || ''
    };
  }

  function effectText(effect) {
    if (!effect || !effect.variable) {
      return '';
    }
    return String(effect.variable) + ' ' + String(effect.op || '=') + ' ' + String(effect.value ?? 0);
  }

  function headingAndParagraphs(heading, paragraphs) {
    const rows = [];
    if (heading) {
      rows.push(bodyRow('heading', heading));
    }
    ensureArray(paragraphs).forEach((paragraph) => {
      if (paragraph) {
        rows.push(bodyRow('paragraph', paragraph));
      }
    });
    return rows;
  }

  function bodyRow(type, text) {
    return {type, text: String(text || '')};
  }

  function meta(label, value) {
    return metaItem(label, value);
  }

  function metaItem(label, value) {
    return {label, value: String(value === undefined || value === null || value === '' ? '(none)' : value)};
  }

  function numberText(value, fallback) {
    return value === undefined || value === null || value === '' ? fallback : String(value);
  }

  function dateRange(year, start, end) {
    const y = year || 'Year ?';
    if (!start && !end) {
      return String(y);
    }
    if (start && end && start !== end) {
      return String(y) + ' / month ' + String(start) + '-' + String(end);
    }
    return String(y) + ' / month ' + String(start || end);
  }

  function sourceLabel(source) {
    if (!source || !source.path) {
      return '(unknown source)';
    }
    return source.line ? source.path + ':' + source.line : source.path;
  }

  function assetRefsFromContext(context) {
    const refs = [];
    appendAssetRefs(refs, context.draft && context.draft.assetRefs);
    appendAssetRefs(refs, context.draft && context.draft.assets);
    appendAssetInstallRequests(refs, context.draft && context.draft.assetInstallRequests);
    if (context.raw && context.raw !== context.draft) {
      appendAssetRefs(refs, context.raw.assetRefs);
      appendAssetRefs(refs, context.raw.assets);
      appendAssetInstallRequests(refs, context.raw.assetInstallRequests);
    }
    const seen = new Set();
    return refs.filter((ref) => {
      const key = String(ref.path || ref.id || ref.label || '') + '|' + String(ref.type || '') + '|' + String(ref.role || '');
      if (!key.trim() || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }).map((ref) => enrichAssetRef(ref, context));
  }

  function assetMissingWarnings(assets) {
    return ensureArray(assets)
      .filter((asset) => asset && asset.referenceState && ['missing', 'file_missing'].includes(asset.referenceState.key))
      .map((asset) => {
        const name = asset.path || asset.label || asset.id || '(unnamed asset)';
        if (asset.referenceState.key === 'file_missing') {
          return 'Indexed asset reference, but physical asset file is missing: ' + name;
        }
        return 'Missing asset reference: ' + name;
      });
  }

  function enrichAssetRef(ref, context) {
    const api = assetModelApi();
    if (api && typeof api.normalizeAssetItem === 'function') {
      const item = api.normalizeAssetItem(ref, {projectIndex: context.projectIndex});
      const role = String(item.role || ref.role || '').trim();
      return Object.assign(item, {
        role,
        roleLabel: typeof api.assetRoleLabel === 'function' ? api.assetRoleLabel(role) : role
      });
    }
    return Object.assign({}, ref, {
      previewCapability: {
        canPreview: ref.type === 'image' || ref.type === 'audio',
        mediaKind: ref.type || 'asset',
        url: ref.path || '',
        message: ''
      },
      status: {key: 'reference_only', label: 'Reference only', help: ''},
      referenceState: {key: 'unknown', label: 'Unverified', help: ''},
      usageRefs: []
    });
  }

  function buildAssetManifest(assets, context) {
    const api = assetModelApi();
    if (api && typeof api.buildAssetManifest === 'function') {
      return api.buildAssetManifest(assets, {projectIndex: context.projectIndex});
    }
    return {items: ensureArray(assets), counts: {}, manualActions: [], ok: true};
  }

  function appendAssetRefs(out, value) {
    ensureArray(value).forEach((item) => {
      const ref = normalizeAssetRef(item);
      if (ref) {
        out.push(ref);
      }
    });
  }

  function appendAssetInstallRequests(out, value) {
    ensureArray(value).forEach((item) => {
      if (!isObject(item)) {
        return;
      }
      const ref = normalizeAssetRef({
        path: item.targetPath || item.path,
        type: item.type || item.assetType,
        label: item.label || item.sourceName,
        role: item.role,
        source: item.source || null
      });
      if (ref) {
        ref.installRequest = {
          sourceName: String(item.sourceName || '').trim(),
          sourcePath: String(item.sourcePath || '').trim(),
          targetPath: ref.path
        };
        out.push(ref);
      }
    });
  }

  function normalizeAssetRef(item) {
    if (typeof item === 'string') {
      return {path: item, type: inferAssetType(item), label: fileName(item)};
    }
    if (!isObject(item)) {
      return null;
    }
    const path = String(item.path || item.src || item.url || item.id || '').trim();
    if (!path) {
      return null;
    }
    return {
      id: item.id ? String(item.id) : '',
      path,
      type: String(item.type || inferAssetType(path) || 'asset'),
      label: String(item.label || item.name || fileName(path) || path),
      source: item.source || null,
      role: String(item.role || '').trim()
    };
  }

  function inferAssetType(path) {
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

  function renderPreviewText(input, options) {
    const model = input && input.kind === PREVIEW_KIND ? input : buildPreviewModel(input, options);
    const lines = [];
    lines.push('[' + model.confidence + '] ' + model.title);
    if (model.meta.length) {
      model.meta.forEach((item) => lines.push(item.label + ': ' + item.value));
      lines.push('');
    }
    model.body.forEach((row) => {
      if (row.text) {
        lines.push(row.text);
        if (row.type === 'paragraph') {
          lines.push('');
        }
      }
    });
    if (model.choices.length) {
      lines.push('');
      model.choices.forEach((choice, index) => {
        lines.push('-> ' + (choice.label || ('Choice ' + (index + 1))));
        if (choice.subtitle) {
          lines.push('   ' + choice.subtitle);
        }
        if (choice.availability && choice.availability.condition) {
          lines.push('   choose-if: ' + choice.availability.condition);
        }
        if (choice.availability && choice.availability.unavailableText) {
          lines.push('   unavailable: ' + choice.availability.unavailableText);
        }
        choice.effects.forEach((effect) => lines.push('   effect: ' + effect));
        choice.variants.forEach((variant) => {
          lines.push('   variant: ' + variant.condition + ' => ' + variant.text);
        });
      });
    }
    if (model.assets && model.assets.length) {
      lines.push('', 'Assets:');
      model.assets.forEach((asset) => {
        lines.push('- ' + [asset.type || 'asset', asset.path || asset.label || ''].filter(Boolean).join(': '));
      });
    }
    if (model.readiness && model.readiness.summary) {
      lines.push('', 'Preview readiness:');
      lines.push('- ' + model.readiness.summary);
    }
    if (model.warnings.length) {
      lines.push('', 'Preview notes:');
      model.warnings.forEach((warning) => lines.push('- ' + warning));
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  const api = {
    PREVIEW_MODEL_VERSION,
    buildPreviewModel,
    build: buildPreviewModel,
    renderPreviewText
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapPreviewModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
