(function initDraftExtract(global) {
  'use strict';

  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

  function extractDraftFromItem(projectIndex, view, itemOrId, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    const model = buildLookup(index);
    const item = resolveItem(index, model, view, itemOrId);
    if (!item) {
      return unsupported(view, 'draft_extract.not_found', 'No matching ProjectIndex item was found.');
    }
    if (view === 'surfaceText') {
      return surfaceTextDraftFromItem(item, opts);
    }
    if (view === 'news') {
      if (item.delivery === 'legacy_event_popup' && item.linkedSceneId) {
        const scene = model.scenesById.get(String(item.linkedSceneId));
        if (scene) {
          return eventDraftFromScene(scene, model, opts);
        }
      }
      return newsDraftFromItem(item, opts);
    }
    if (view === 'events') {
      return eventDraftFromScene(item.scene || item, model, opts);
    }
    if (view === 'cards') {
      return cardDraftFromScene(item.scene || item, model, opts);
    }
    return unsupported(view, 'draft_extract.unsupported_view', 'Edit as Draft is not supported for this view: ' + view);
  }

  function textReplacementDraftFromItem(projectIndex, view, itemOrId, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    const model = buildLookup(index);
    const item = resolveItem(index, model, view, itemOrId);
    if (!item) {
      return unsupported(view, 'draft_extract.text_not_found', 'No matching ProjectIndex item was found for text replacement.');
    }
    const replacement = String(opts.replacementLabel || opts.replacementText || '').trim();
    const capability = editCapabilityForItem(index, view, item, {replacementText: replacement});
    if (view === 'surfaceText') {
      return surfaceTextDraftFromItem(item, {replacementLabel: replacement || item.label || '', capability});
    }
    if (view === 'textCorpus') {
      const source = item.source || {};
      const owner = item.owner || {};
      const label = String(item.text || '').trim();
      return textReplacementDraft({
        idBase: 'edit_text_' + (owner.sceneId || owner.itemId || item.id || 'corpus_item'),
        itemId: owner.sceneId || owner.itemId || item.id || '',
        area: item.role || 'text',
        originalLabel: label,
        replacementLabel: replacement || label,
        editability: textCorpusProposalEditability(item, capability),
        source,
        reason: capability && capability.reason || 'Text Corpus points to player-visible prose. Studio exports a proposal with source guidance; arbitrary body rewrites still need review in the owning .dry file.'
      });
    }
    if (view === 'news') {
      if (item.delivery === 'legacy_event_popup' && item.linkedSceneId) {
        const scene = model.scenesById.get(String(item.linkedSceneId));
        if (scene) {
          return textReplacementDraft({
            idBase: 'edit_event_popup_text_' + (scene.id || item.linkedSceneId),
            itemId: scene.id || item.linkedSceneId,
            area: 'event_popup_title',
            originalLabel: scene.title || item.headline || '',
            replacementLabel: replacement || scene.title || item.headline || '',
            editability: 'ide_escape_hatch',
            source: scene.sourceSpan || scene.topLevelSpan || item.source,
            reason: 'Legacy monthly popups are ordinary tags:event scenes selected by post_event. Studio exports event-scene editing guidance, not a post_event_news rewrite.'
          });
        }
      }
      return textReplacementDraft({
        idBase: 'edit_news_text_' + (item.id || item.headline || 'headline'),
        itemId: item.id || '',
        area: 'news',
        originalLabel: item.headline || '',
        replacementLabel: replacement || item.headline || '',
        editability: 'ide_escape_hatch',
        source: item.source,
        reason: 'News text lives in post_event_news or generated JS snippets. Studio exports guidance, not an automatic rewrite.'
      });
    }
    if (view === 'events' || view === 'cards' || view === 'scenes') {
      const scene = (item && (item.scene || model.scenesById.get(String(item.id || '')))) || item;
      const kind = view === 'cards' ? 'card' : 'scene';
      return textReplacementDraft({
        idBase: 'edit_' + kind + '_text_' + ((scene && scene.id) || 'scene'),
        itemId: (scene && scene.id) || '',
        area: kind + '_title',
        originalLabel: (scene && (scene.title || scene.id)) || '',
        replacementLabel: replacement || (scene && (scene.title || scene.id)) || '',
        editability: 'ide_escape_hatch',
        source: scene && (scene.sourceSpan || scene.topLevelSpan),
        reason: 'Scene text replacement is exported as IDE guidance until Studio has a bounded source-span editor for scene bodies.'
      });
    }
    return unsupported(view, 'draft_extract.text_unsupported_view', 'Text replacement is not supported for this view: ' + view);
  }

  function buildLookup(index) {
    const scenes = ensureArray(index.scenes);
    const scenesById = new Map();
    scenes.forEach((scene) => {
      if (scene && scene.id) {
        scenesById.set(String(scene.id), scene);
      }
    });
    return {
      index,
      scenes,
      scenesById,
      textCorpus: ensureArray(index.semantic && index.semantic.textCorpus && index.semantic.textCorpus.items)
    };
  }

  function resolveItem(index, model, view, itemOrId) {
    if (isObject(itemOrId)) {
      if ((view === 'events' || view === 'cards') && itemOrId.id && !itemOrId.scene) {
        return Object.assign({}, model.scenesById.get(String(itemOrId.id)) || {}, itemOrId, {
          scene: model.scenesById.get(String(itemOrId.id)) || itemOrId
        });
      }
      return itemOrId;
    }
    const id = String(itemOrId || '');
    const semantic = index.semantic || {};
    if (view === 'events') {
      return materializedSceneRef(ensureArray(semantic.events).find((item) => item && item.id === id), model);
    }
    if (view === 'cards') {
      return materializedSceneRef(ensureArray(semantic.cards).find((item) => item && item.id === id), model);
    }
    if (view === 'surfaceText') {
      return ensureArray(semantic.surfaceText && semantic.surfaceText.items).find((item) => item && item.id === id);
    }
    if (view === 'textCorpus') {
      return ensureArray(semantic.textCorpus && semantic.textCorpus.items).find((item) => item && item.id === id);
    }
    return null;
  }

  function materializedSceneRef(ref, model) {
    if (!ref) {
      return null;
    }
    const scene = model.scenesById.get(String(ref.id));
    return scene ? Object.assign({}, scene, ref, {scene}) : ref;
  }

  function surfaceTextDraftFromItem(item, options) {
    const opts = isObject(options) ? options : {};
    const diagnostics = [];
    const capability = opts.capability || null;
    const editability = surfaceProposalEditability(item, capability);
    if (editability === 'ide_escape_hatch') {
      diagnostics.push(diagnostic('warning', 'draft_extract.ide_escape_hatch', capability && capability.reason || 'This surface text item needs manual IDE review.'));
    }
    const label = String(item.label || '').trim();
    const replacement = String(opts.replacementLabel || '').trim() || label;
    const draft = {
      schemaVersion: '0.1',
      kind: 'surface_text',
      id: safeId('rename_' + (item.id || label || 'surface_label')),
      itemId: String(item.id || ''),
      area: String(item.area || ''),
      originalLabel: label,
      replacementLabel: replacement,
      editability,
      source: sourceRef(item.source),
      reason: String(capability && capability.reason || item.reason || '')
    };
    return {
      ok: Boolean(label && draft.source.path),
      status: editability === 'draft_exportable' ? 'draft' : 'ide_escape_hatch',
      template: 'surface',
      draft,
      source: item.source || null,
      diagnostics,
      captured: ['visible label', 'source path/line', 'editability class'].concat(capability ? ['edit route: ' + capability.routeClass] : []),
      notCaptured: editability === 'draft_exportable'
        ? ['live rendered preview']
        : ['automatic safe replacement', 'runtime/generated UI ownership']
    };
  }

  function editCapabilityForItem(index, view, item, options) {
    const api = editCapabilityApi();
    if (!api || typeof api.buildEditCapability !== 'function') {
      return null;
    }
    try {
      return api.buildEditCapability(index, view, item, options || {});
    } catch (_err) {
      return null;
    }
  }

  function surfaceProposalEditability(item, capability) {
    const routeClass = String(capability && capability.routeClass || '');
    if (routeClass === 'system_ui_workspace' || routeClass === 'news_router_workflow' || routeClass === 'manual_review' || routeClass === 'unsupported') {
      return 'ide_escape_hatch';
    }
    return String(item && item.editability || 'ide_escape_hatch');
  }

  function textCorpusProposalEditability(item, capability) {
    const routeClass = String(capability && capability.routeClass || '');
    if (routeClass === 'direct_field_replace') {
      return 'text_proposal';
    }
    if (routeClass === 'direct_section_replace' || routeClass === 'object_workspace') {
      return 'text_proposal';
    }
    return 'ide_escape_hatch';
  }

  function textReplacementDraft(input) {
    const originalLabel = String(input.originalLabel || '').trim();
    const source = sourceRef(input.source);
    const draft = {
      schemaVersion: '0.1',
      kind: 'surface_text',
      id: safeId(input.idBase || 'edit_text_proposal'),
      itemId: String(input.itemId || ''),
      area: String(input.area || 'text'),
      originalLabel,
      replacementLabel: String(input.replacementLabel || originalLabel || '').trim(),
      editability: String(input.editability || 'ide_escape_hatch'),
      source,
      reason: String(input.reason || '')
    };
    const diagnostics = [];
    if (draft.editability === 'ide_escape_hatch') {
      diagnostics.push(diagnostic('warning', 'draft_extract.text_manual_review', draft.reason || 'This text replacement needs manual IDE review.'));
    }
    if (!draft.source.path) {
      diagnostics.push(diagnostic('warning', 'draft_extract.text_source_missing', 'No source path was available for this text replacement proposal.'));
    }
    return {
      ok: Boolean(draft.originalLabel && draft.source.path),
      status: draft.editability === 'ide_escape_hatch' ? 'ide_escape_hatch' : 'draft',
      template: 'surface',
      draft,
      source,
      diagnostics,
      captured: ['selected text/title/headline', 'source path/line when available', 'replacement proposal'],
      notCaptured: draft.editability === 'draft_exportable'
        ? ['live rendered preview']
        : ['automatic safe rewrite', 'full scene/news body round-trip']
    };
  }

  function newsDraftFromItem(item) {
    const headline = String(item.headline || '').trim();
    if (!headline) {
      return unsupported('news', 'draft_extract.empty_news', 'Empty news reset assignments are not editable news drafts.');
    }
    const diagnostics = [];
    const delivery = String(item.delivery || 'dated');
    const slot = parseSlot(item.slot);
    const draft = {
      schemaVersion: '0.1',
      kind: 'news_item',
      id: safeId('edit_news_' + (item.id || headline || 'item')),
      headline,
      description: String(item.description || '').trim(),
      delivery: delivery === 'background_pool' ? 'background_pool' : 'dated',
      when: {
        year: numberOrNull(item.year),
        month: numberOrNull(item.month),
        slot,
        requiresJs: String(item.requiresJs || '').trim()
      },
      pool: {
        name: String(item.pool || item.poolName || 'social_pool'),
        requiresJs: String(item.requiresJs || '').trim()
      },
      source: sourceRef(item.source)
    };
    if (draft.delivery === 'dated' && (!draft.when.year || !draft.when.month)) {
      diagnostics.push(diagnostic('warning', 'draft_extract.partial_news_window', 'Indexed news lacks exact year/month; review before export.'));
    }
    if (draft.delivery === 'background_pool' && !item.pool && !item.poolName) {
      diagnostics.push(diagnostic('warning', 'draft_extract.partial_news_pool', 'Indexed news lacks exact pool name; defaulted to social_pool.'));
    }
    return {
      ok: true,
      status: diagnostics.length ? 'partial' : 'draft',
      template: 'news',
      draft,
      source: item.source || null,
      diagnostics,
      captured: ['headline', 'description', 'delivery type', 'source path/line'],
      notCaptured: ['safe post_event_news insertion', 'dynamic JS guard behavior', 'live rendered preview']
    };
  }

  function eventDraftFromScene(scene, model) {
    if (!scene || !scene.id) {
      return unsupported('events', 'draft_extract.scene_missing', 'Event scene data was not available.');
    }
    const diagnostics = [
      diagnostic('warning', 'draft_extract.partial_scene_body', 'Existing scene body/effects are not fully reconstructed; review source before export.')
    ];
    const windowInfo = parseEventWindow(scene.viewIf);
    const options = optionDrafts(scene.options, 'continue');
    const introParagraphs = introParagraphsFromScene(scene, model);
    const draft = {
      schemaVersion: '0.1',
      kind: 'world_event',
      id: uniqueId(String(scene.id) + '_edit', model.scenesById),
      title: String(scene.title || scene.id),
      heading: String(scene.title || scene.id),
      seenFlag: windowInfo.seenFlag || String(scene.id) + '_seen',
      when: {
        year: windowInfo.year,
        monthStart: windowInfo.monthStart,
        monthEnd: windowInfo.monthEnd,
        requires: windowInfo.requires,
        priority: numberOrNull(scene.priority) ?? 0
      },
      effectsOnTrigger: [],
      introParagraphs: introParagraphs.length
        ? introParagraphs
        : ['Draft seeded from existing scene ' + sourceLabel(scene.sourceSpan) + '. Review original body text and effects before export.'],
      options,
      assetRefs: ensureArray(scene.assetRefs),
      sourceSceneId: scene.id,
      source: sourceRef(scene.sourceSpan)
    };
    if (!windowInfo.complete) {
      diagnostics.push(diagnostic('warning', 'draft_extract.partial_event_window', 'Could not infer a complete event window from view-if.'));
    }
    if (!options.length) {
      diagnostics.push(diagnostic('warning', 'draft_extract.no_options', 'No parser options were available to seed choices.'));
    }
    return {
      ok: true,
      status: 'partial',
      template: 'event',
      draft,
      source: scene.sourceSpan || null,
      diagnostics,
      captured: ['scene id/title', 'view-if timing when inferable', 'parser option labels/targets'].concat(introParagraphs.length ? ['source-backed body paragraphs'] : []),
      notCaptured: ['existing on-arrival effects', 'root init / post_event migration install', 'live rendered preview']
    };
  }

  function cardDraftFromScene(scene, model) {
    if (!scene || !scene.id) {
      return unsupported('cards', 'draft_extract.scene_missing', 'Card scene data was not available.');
    }
    const diagnostics = [
      diagnostic('warning', 'draft_extract.partial_scene_body', 'Existing scene body/effects are not fully reconstructed; review source before export.')
    ];
    const allOptions = optionDrafts(scene.options, 'root');
    const options = allOptions.slice(0, 4);
    if (allOptions.length > 4) {
      diagnostics.push(diagnostic('warning', 'draft_extract.option_limit', 'Only the first 4 options can be seeded into CardDraft v0.1.'));
    }
    const introParagraphs = introParagraphsFromScene(scene, model);
    const draft = {
      schemaVersion: '0.1',
      kind: 'card',
      id: uniqueId(String(scene.id) + '_edit', model.scenesById),
      title: String(scene.title || scene.id),
      cardKind: scene.flags && scene.flags.isPinnedCard ? 'advisor_like' : 'action_card',
      tags: ensureArray(scene.tags).map(String),
      viewIf: String(scene.viewIf || ''),
      priority: numberOrNull(scene.priority),
      frequency: numberOrNull(scene.frequency),
      maxVisits: numberOrNull(scene.maxVisits),
      heading: String(scene.title || scene.id),
      subtitle: String(scene.subtitle || ''),
      introParagraphs: introParagraphs.length
        ? introParagraphs
        : ['Draft seeded from existing scene ' + sourceLabel(scene.sourceSpan) + '. Review original body text and effects before export.'],
      options,
      assetRefs: ensureArray(scene.assetRefs),
      sourceSceneId: scene.id,
      source: sourceRef(scene.sourceSpan)
    };
    if (!options.length) {
      diagnostics.push(diagnostic('warning', 'draft_extract.no_options', 'No parser options were available to seed choices.'));
    }
    return {
      ok: true,
      status: 'partial',
      template: 'card',
      draft,
      source: scene.sourceSpan || null,
      diagnostics,
      captured: ['scene id/title', 'card metadata', 'parser option labels/targets'].concat(introParagraphs.length ? ['source-backed body paragraphs'] : []),
      notCaptured: ['existing effects', 'hand/deck/sidebar wiring install', 'live rendered preview']
    };
  }

  function optionDrafts(options, continuationPrefix) {
    return ensureArray(options).filter((option) => option && option.target && option.target.id).map((option, index) => {
      const parts = splitOptionTitle(option.title || ('Option ' + (index + 1)));
      const id = safeId(String(option.target.id || option.id || ('option_' + (index + 1))).replace(/^@/, ''));
      return {
        id,
        label: parts.label || ('Option ' + (index + 1)),
        title: '',
        subtitle: parts.subtitle,
        chooseIf: String(option.chooseIf || ''),
        unavailableText: String(option.unavailableText || ''),
        effects: [],
        narrativeParagraphs: [],
        variants: [],
        gotoAfter: continuationPrefix === 'continue' ? uniqueAnchor('continue_' + id) : 'root'
      };
    });
  }

  function introParagraphsFromScene(scene, model) {
    const sceneId = String(scene && scene.id || '');
    if (!sceneId || !model || !Array.isArray(model.textCorpus)) {
      return [];
    }
    const rows = model.textCorpus
      .filter((item) => {
        const owner = item && item.owner || {};
        return String(owner.sceneId || '') === sceneId &&
          ['body', 'conditional_body'].includes(String(item.role || '')) &&
          String(item.text || '').trim();
      })
      .sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
    const seen = new Set();
    const out = [];
    rows.forEach((row) => {
      const text = String(row.text || '').trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      out.push(text);
    });
    return out.slice(0, 8);
  }

  function splitOptionTitle(title) {
    const text = String(title || '').trim();
    const parts = text.split('——');
    if (parts.length > 1) {
      return {label: parts[0].trim(), subtitle: parts.slice(1).join('——').trim()};
    }
    return {label: text, subtitle: ''};
  }

  function parseEventWindow(viewIf) {
    const text = String(viewIf || '');
    const clauses = text.split(/\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
    let year = null;
    let monthStart = null;
    let monthEnd = null;
    let seenFlag = '';
    const remaining = [];
    clauses.forEach((clause) => {
      let match = clause.match(/^year\s*=\s*(\d+)$/);
      if (match) {
        year = Number(match[1]);
        return;
      }
      match = clause.match(/^month\s*>=\s*(\d+)$/);
      if (match) {
        monthStart = Number(match[1]);
        return;
      }
      match = clause.match(/^month\s*<=\s*(\d+)$/);
      if (match) {
        monthEnd = Number(match[1]);
        return;
      }
      match = clause.match(/^([A-Za-z_][A-Za-z0-9_]*_seen)\s*=\s*0$/);
      if (match) {
        seenFlag = match[1];
        return;
      }
      remaining.push(clause);
    });
    return {
      year,
      monthStart,
      monthEnd,
      seenFlag,
      requires: remaining.join(' and '),
      complete: Boolean(year && monthStart && monthEnd && seenFlag)
    };
  }

  function parseSlot(slot) {
    const match = String(slot || '').match(/news_(\d)/);
    if (match) {
      return Number(match[1]);
    }
    const numeric = numberOrNull(slot);
    return numeric || 1;
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    const line = numberOrNull(value.line || value.startLine);
    const endLine = numberOrNull(value.endLine || value.line || value.startLine);
    return {
      path: String(value.path || '').trim(),
      line,
      endLine
    };
  }

  function sourceLine(source) {
    const ref = sourceRef(source);
    return ref.line || 0;
  }

  function sourceLabel(source) {
    const ref = sourceRef(source);
    if (!ref.path) {
      return '(unknown source)';
    }
    return ref.line ? ref.path + ':' + ref.line : ref.path;
  }

  function unsupported(view, code, message) {
    return {
      ok: false,
      status: 'unsupported',
      template: view || '',
      draft: null,
      diagnostics: [diagnostic('warning', code, message)]
    };
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message, confidence: 'static_inferred'};
  }

  function uniqueId(base, scenesById) {
    let id = safeId(base);
    if (!scenesById || !scenesById.has(id)) {
      return id;
    }
    let suffix = 2;
    while (scenesById.has(id + '_' + suffix)) {
      suffix += 1;
    }
    return id + '_' + suffix;
  }

  function uniqueAnchor(base) {
    return safeId(base);
  }

  function safeId(value) {
    let text = String(value || 'draft_item')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!text) {
      text = 'draft_item';
    }
    if (!/^[A-Za-z_]/.test(text)) {
      text = 'draft_' + text;
    }
    return ID_RE.test(text) ? text : 'draft_item';
  }

  const api = {
    extractDraftFromItem,
    textReplacementDraftFromItem,
    eventDraftFromScene,
    cardDraftFromScene,
    newsDraftFromItem,
    surfaceTextDraftFromItem,
    parseEventWindow
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapDraftExtract = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
