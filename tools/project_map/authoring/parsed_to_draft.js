(function initProjectMapParsedToDraft(global) {
  'use strict';

  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const EFFECT_OPS = new Set(['=', '+=', '-=']);

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function buildDraftFromParsed(projectIndex, input) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(input) ? input : {};
    const view = normalizeView(opts.view);
    const model = buildLookup(index);
    const item = resolveItem(index, model, view, opts.item || opts.itemId || opts.id);
    if (!item) {
      return unsupported(view, 'parsed_to_draft.not_found', 'No matching parsed object was found.');
    }
    if (view === 'surfaceText') {
      return unsupported(view, 'parsed_to_draft.surface_uses_text_proposal', 'Surface text uses the text replacement proposal path.');
    }
    if (view === 'news') {
      if (item.delivery === 'legacy_event_popup' && item.linkedSceneId) {
        const scene = model.scenesById.get(String(item.linkedSceneId));
        if (scene) {
          return eventDraftFromScene(index, scene, Object.assign({}, opts, {sourceEntry: opts.sourceEntry || 'linked_news_popup'}), model);
        }
      }
      return newsDraftFromItem(item, opts);
    }
    if (view === 'events') {
      return eventDraftFromScene(index, item.scene || item, opts, model);
    }
    if (view === 'cards') {
      return cardDraftFromScene(index, item.scene || item, opts, model);
    }
    return unsupported(view, 'parsed_to_draft.unsupported_view', 'Parsed-to-draft is not supported for this view: ' + view);
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
      textCorpus: ensureArray(index.textCorpus)
        .concat(ensureArray(index.semantic && index.semantic.textCorpus && index.semantic.textCorpus.items))
    };
  }

  function resolveItem(index, model, view, itemOrId) {
    if (isObject(itemOrId)) {
      if ((view === 'events' || view === 'cards') && itemOrId.id && !itemOrId.scene) {
        const scene = model.scenesById.get(String(itemOrId.id));
        return scene ? Object.assign({}, scene, itemOrId, {scene}) : itemOrId;
      }
      return itemOrId.raw && isObject(itemOrId.raw) ? itemOrId.raw : itemOrId;
    }
    const id = String(itemOrId || '');
    const semantic = index.semantic || {};
    if (view === 'events') {
      return materializedSceneRef(ensureArray(semantic.events).find((item) => item && item.id === id), model) ||
        model.scenesById.get(id) ||
        null;
    }
    if (view === 'cards') {
      return materializedSceneRef(ensureArray(semantic.cards).find((item) => item && item.id === id), model) ||
        model.scenesById.get(id) ||
        null;
    }
    if (view === 'news') {
      return ensureArray(semantic.news && semantic.news.items).find((item) => item && item.id === id) ||
        ensureArray(semantic.news && semantic.news.eventPopups).find((item) => item && (item.id === id || item.linkedSceneId === id || item.headline === id)) ||
        null;
    }
    if (view === 'surfaceText') {
      return ensureArray(semantic.surfaceText && semantic.surfaceText.items).find((item) => item && item.id === id);
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

  function eventDraftFromScene(projectIndex, scene, options, modelInput) {
    const lookup = modelInput || buildLookup(projectIndex);
    if (!scene || !scene.id) {
      return unsupported('events', 'parsed_to_draft.scene_missing', 'Event scene data was not available.');
    }
    const sceneId = String(scene.id || '');
    const textRows = textRowsForScene(lookup, sceneId);
    const rootRows = rootTextRows(textRows);
    const rootConditionalRows = rootConditionalTextRows(textRows);
    const rootOptions = ensureArray(scene.options || scene.choices).map((option, index) => optionFromParsed(option, index, 'event'));
    const sections = ensureArray(scene.sections).map((section, index) => sectionFromParsed(section, index, textRows)).filter((section) => section.id);
    const sectionOptionCount = sections.reduce((sum, section) => sum + ensureArray(section.options).length, 0);
    const eventShape = eventShapeForRootOptions(rootOptions);
    const sourceId = safeId(options && (options.newId || options.id) || sceneId + '_copy');
    const windowInfo = parseEventWindow(scene.viewIf || scene.view_if);
    const draft = {
      schemaVersion: '0.1',
      kind: 'world_event',
      eventShape,
      id: sourceId,
      title: firstNonEmpty(scene.title, firstRoleText(textRows, 'title'), humanTitle(sceneId)),
      subtitle: firstNonEmpty(scene.subtitle, firstRoleText(textRows, 'subtitle')),
      heading: firstNonEmpty(firstRoleText(textRows, 'heading'), scene.heading, scene.title, humanTitle(sceneId)),
      tags: ensureArray(scene.tags).length ? ensureArray(scene.tags).map(String) : (eventShape === 'pure_event' ? ['event'] : ['event', 'world']),
      newPage: scene.newPage === undefined ? true : Boolean(scene.newPage),
      rawViewIf: String(scene.viewIf || scene.view_if || '').trim(),
      maxVisits: numberOrNull(scene.maxVisits || scene.max_visits),
      frequency: numberOrNull(scene.frequency),
      calls: lineList(scene.calls || scene.callTargets),
      setJump: String(scene.setJump || scene.set_jump || scene.jumpTarget || '').trim(),
      rawRoutes: lineList(scene.rawRoutes || scene.routeClauses),
      rawOnDisplay: lineList(scene.rawOnDisplay || scene.onDisplay),
      rawOnDeparture: lineList(scene.rawOnDeparture || scene.onDeparture),
      useSeenFlag: choiceLikeEventShape(eventShape),
      seenFlag: choiceLikeEventShape(eventShape) ? sourceId + '_seen' : '',
      when: {
        year: windowInfo.year || numberOrNull(scene.year) || 1936,
        monthStart: windowInfo.monthStart || numberOrNull(scene.monthStart || scene.month_start) || 1,
        monthEnd: windowInfo.monthEnd || numberOrNull(scene.monthEnd || scene.month_end) || 12,
        requires: '',
        priority: numberOrNull(scene.priority) ?? 0
      },
      introParagraphs: rootRows.length ? textValues(rootRows) : fallbackParagraphsExcludingConditionals(scene.body || scene.text || scene.description || scene.title || '', rootConditionalRows),
      conditionalParagraphs: conditionalParagraphsFromRows(rootConditionalRows),
      effectsOnTrigger: normalizeEffects(scene.effects || scene.effectsOnTrigger, 'on-arrival'),
      rawEffectsOnTrigger: lineList(scene.rawEffectsOnTrigger || scene.rawOnArrival || scene.onArrival),
      assetRefs: assetRefsForScene(scene),
      sourceSceneId: sceneId,
      source: sourceRef(scene.sourceSpan || scene.topLevelSpan || {path: scene.path || ''}),
      options: rootOptions
    };
    if (sections.length) {
      draft.sections = sections;
    }
    const anchorResolution = qualifyDuplicateDraftAnchors(draft, lookup);
    const parsed = parityCounts(scene, textRows);
    const drafted = draftParityCounts(draft);
    const roleParity = roleKeyedParity(scene, textRows, draft);
    const blockers = eventBlockers(scene, rootOptions, sections, sectionOptionCount, eventShape)
      .concat(anchorResolution.blockers)
      .concat(roleParity.blockers);
    const status = blockers.length ? 'partial' : 'draft';
    decorateDraft(draft, status, archetypeForEvent(eventShape, rootOptions, sections, sectionOptionCount), blockers, parsed, drafted, roleParity);
    return resultForDraft({
      view: 'events',
      template: 'event',
      status,
      draft,
      source: draft.source,
      archetypeHint: draft.archetypeHint,
      parity: {parsed, draft: drafted, roles: roleParity.roles, warnings: roleParity.warnings, blockers},
      diagnostics: blockers.map((blocker) => diagnostic('warning', blocker.code, blocker.message)).concat(roleParity.warnings.map((item) => diagnostic('warning', item.code, item.message))),
      captured: capturedRows(parsed, drafted),
      notCaptured: blockers.concat(roleParity.namedWarnings).map((blocker) => blocker.message)
    });
  }

  function cardDraftFromScene(projectIndex, scene, options, modelInput) {
    const lookup = modelInput || buildLookup(projectIndex);
    if (!scene || !scene.id) {
      return unsupported('cards', 'parsed_to_draft.scene_missing', 'Card scene data was not available.');
    }
    const sceneId = String(scene.id || '');
    const textRows = textRowsForScene(lookup, sceneId);
    const rootOptions = ensureArray(scene.options || scene.choices).map((option, index) => optionFromParsed(option, index, 'card'));
    const sections = ensureArray(scene.sections).map((section, index) => sectionFromParsed(section, index, textRows)).filter((section) => section.id);
    const sectionOptions = ensureArray(scene.sections).reduce((rows, section) => {
      return rows.concat(ensureArray(section && section.options).map((option, index) => optionFromParsed(option, rows.length + index, 'card', section)));
    }, []);
    const allOptions = rootOptions.concat(sectionOptions);
    const cardShape = sections.length ? 'menu_card' : (rootOptions.length ? 'choice_card' : 'pinned_text_card');
    const sourceId = safeId(options && (options.newId || options.id) || sceneId + '_copy');
    const draft = {
      schemaVersion: '0.1',
      kind: 'card',
      id: sourceId,
      title: firstNonEmpty(scene.title, firstRoleText(textRows, 'title'), humanTitle(sceneId)),
      cardShape,
      cardKind: scene.flags && scene.flags.isPinnedCard || String(scene.type || '') === 'pinned_card' ? 'advisor_like' : 'action_card',
      tags: ensureArray(scene.tags).map(String),
      newPage: scene.newPage === undefined ? true : Boolean(scene.newPage),
      rawEffectsOnTrigger: lineList(scene.rawEffectsOnTrigger || scene.rawOnArrival || scene.onArrival),
      viewIf: String(scene.viewIf || '').trim(),
      priority: numberOrNull(scene.priority),
      frequency: numberOrNull(scene.frequency),
      maxVisits: numberOrNull(scene.maxVisits),
      heading: firstNonEmpty(firstRoleText(textRows, 'heading'), scene.heading, scene.title, humanTitle(sceneId)),
      subtitle: firstNonEmpty(scene.subtitle, firstRoleText(textRows, 'subtitle')),
      introParagraphs: textValues(rootTextRows(textRows)).length ? textValues(rootTextRows(textRows)) : normalizeTextList(scene.body || scene.text || scene.description || scene.title || ''),
      options: rootOptions,
      assetRefs: assetRefsForScene(scene),
      sourceSceneId: sceneId,
      source: sourceRef(scene.sourceSpan || scene.topLevelSpan || {path: scene.path || ''}),
      parsedSections: ensureArray(scene.sections).map((section) => ({
        id: localId(section && section.id || ''),
        title: String(section && section.title || ''),
        optionCount: ensureArray(section && section.options).length,
        effectCount: normalizeEffects(section && section.effects, 'on-arrival').length
      })),
      parsedEffects: normalizeEffects(scene.effects || scene.effectsOnTrigger, 'on-arrival')
    };
    if (sections.length) {
      draft.sections = sections;
    }
    const parsed = parityCounts(scene, textRows);
    const drafted = draftParityCounts(draft);
    const roleParity = roleKeyedParity(scene, textRows, draft);
    const blockers = cardBlockers(scene, rootOptions, sectionOptions, allOptions, cardShape).concat(roleParity.blockers);
    const status = blockers.length ? 'partial' : 'draft';
    decorateDraft(draft, status, archetypeForCard(scene, rootOptions, sectionOptions, allOptions), blockers, parsed, drafted, roleParity);
    return resultForDraft({
      view: 'cards',
      template: 'card',
      status,
      draft,
      source: draft.source,
      archetypeHint: draft.archetypeHint,
      parity: {parsed, draft: drafted, roles: roleParity.roles, warnings: roleParity.warnings, blockers},
      diagnostics: blockers.map((blocker) => diagnostic('warning', blocker.code, blocker.message)).concat(roleParity.warnings.map((item) => diagnostic('warning', item.code, item.message))),
      captured: capturedRows(parsed, drafted),
      notCaptured: blockers.concat(roleParity.namedWarnings).map((blocker) => blocker.message)
    });
  }

  function newsDraftFromItem(item, options) {
    const headline = String(item && item.headline || '').trim();
    if (!headline) {
      return unsupported('news', 'parsed_to_draft.empty_news', 'Empty news reset assignments are not editable news drafts.');
    }
    const slot = parseSlot(item.slot);
    const draft = {
      schemaVersion: '0.1',
      kind: 'news_item',
      id: safeId(options && (options.newId || options.id) || 'edit_news_' + (item.id || headline || 'item')),
      headline,
      description: String(item.description || '').trim(),
      delivery: String(item.delivery || '') === 'background_pool' ? 'background_pool' : 'dated',
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
    const blockers = [];
    if (draft.delivery === 'dated' && (!draft.when.year || !draft.when.month)) {
      blockers.push(blocker('parsed_to_draft.partial_news_window', 'News timing is missing exact year/month; review the generated draft before install.'));
    }
    if (draft.delivery === 'background_pool' && !item.pool && !item.poolName) {
      blockers.push(blocker('parsed_to_draft.partial_news_pool', 'News pool was not parsed exactly; Studio defaulted to social_pool.'));
    }
    const parsed = {text: headline ? 1 : 0, effects: 0, options: 0, rootOptions: 0, sectionOptions: 0, sections: 0, conditions: draft.when.requiresJs || draft.pool.requiresJs ? 1 : 0, assets: 0};
    const drafted = Object.assign({}, parsed);
    const status = blockers.length ? 'partial' : 'draft';
    decorateDraft(draft, status, 'news_item', blockers, parsed, drafted);
    return resultForDraft({
      view: 'news',
      template: 'news',
      status,
      draft,
      source: draft.source,
      archetypeHint: 'news_item',
      parity: {parsed, draft: drafted, blockers},
      diagnostics: blockers.map((item) => diagnostic('warning', item.code, item.message)),
      captured: ['headline', 'description', 'delivery type', 'source path/line'],
      notCaptured: blockers.map((item) => item.message)
    });
  }

  function textRowsForScene(lookup, sceneId) {
    const seen = new Set();
    return ensureArray(lookup && lookup.textCorpus).filter((row) => {
      const owner = row && row.owner || {};
      return String(row && (row.sceneId || row.ownerSceneId || owner.sceneId) || '').trim() === String(sceneId || '').trim();
    }).filter((row) => {
      const source = row && row.source || {};
      const key = [
        row && row.id,
        row && (row.role || row.semanticRole || row.kind),
        row && (row.text || row.value || row.original),
        source.path,
        source.line || source.startLine
      ].join('|');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }).sort((left, right) => sourceLine(left && left.source) - sourceLine(right && right.source));
  }

  function rootTextRows(rows) {
    return ensureArray(rows).filter((row) => {
      const role = roleOf(row);
      const sectionId = String(row && row.owner && row.owner.sectionId || row && row.sectionId || '').trim();
      return !sectionId && ['body', 'content', 'visible_text', 'monthly_popup_excerpt'].includes(role);
    });
  }

  function rootConditionalTextRows(rows) {
    return ensureArray(rows).filter((row) => {
      const role = roleOf(row);
      const sectionId = String(row && row.owner && row.owner.sectionId || row && row.sectionId || '').trim();
      return !sectionId && role === 'conditional_body';
    });
  }

  function textRowsForSection(rows, sectionId) {
    const wanted = new Set(idTokens(sectionId));
    return ensureArray(rows).filter((row) => {
      const role = roleOf(row);
      const ownerSection = String(row && row.owner && row.owner.sectionId || row && row.sectionId || '').trim();
      return (wanted.has(ownerSection) || wanted.has(localId(ownerSection))) &&
        ['body', 'content', 'visible_text', 'conditional_body'].includes(role);
    });
  }

  function firstRoleText(rows, role) {
    const wanted = String(role || '').toLowerCase();
    const row = ensureArray(rows).find((item) => roleOf(item) === wanted);
    return String(row && (row.text || row.value || row.original) || '').trim();
  }

  function sectionFromParsed(section, index, rows) {
    const value = isObject(section) ? section : {};
    const id = safeId(localId(value.id || value.sectionId || 'section_' + (index + 1)));
    const textRows = textRowsForSection(rows, value.id || id);
    const bodyRows = textRows.filter((row) => roleOf(row) !== 'conditional_body');
    const conditionalRows = textRows.filter((row) => roleOf(row) === 'conditional_body');
    return {
      id,
      title: String(value.title || '').trim(),
      condition: String(value.condition || value.viewIf || value.chooseIf || '').trim(),
      paragraphs: bodyRows.length ? textValues(bodyRows) : fallbackParagraphsExcludingConditionals(value.paragraphs || value.body || value.text || '', conditionalRows),
      conditionalParagraphs: conditionalParagraphsFromRows(conditionalRows),
      effects: normalizeEffects(value.effects, 'on-arrival'),
      options: ensureArray(value.options).map((option, optionIndex) => optionFromParsed(option, optionIndex, 'event', value)),
      rawRoutes: lineList(value.rawRoutes || value.routeClauses),
      calls: lineList(value.calls || value.callTargets),
      setJump: String(value.setJump || value.set_jump || value.jumpTarget || '').trim(),
      rawOnDisplay: lineList(value.rawOnDisplay || value.onDisplay),
      rawOnDeparture: lineList(value.rawOnDeparture || value.onDeparture),
      rawEffects: lineList(value.rawEffects || value.rawEffectsOnTrigger || value.rawOnArrival || value.onArrival),
      exitTarget: safeId(localId(value.exitTarget || value.returnTarget || 'root'))
    };
  }

  function optionFromParsed(option, index, kind, section) {
    const value = isObject(option) ? option : {};
    const target = isObject(value.target) ? value.target : {};
    const rawTarget = value.rawTargetId || value.targetId || target.id || value.id || ('option_' + (index + 1));
    const id = safeId(localId(value.id || rawTarget || 'option_' + (index + 1)));
    const title = String(value.label || value.text || value.title || ('Option ' + (index + 1))).trim();
    const parts = splitOptionTitle(title);
    const row = {
      id,
      label: parts.label || title || ('Option ' + (index + 1)),
      title: String(value.resultTitle || '').trim(),
      subtitle: String(value.subtitle || parts.subtitle || '').trim(),
      chooseIf: String(value.chooseIf || value.condition || '').trim(),
      unavailableText: String(value.unavailableText || value.unavailable || '').trim(),
      effects: normalizeEffects(value.effects, 'choice'),
      rawRoutes: lineList(value.rawRoutes || value.routeClauses),
      calls: lineList(value.calls || value.callTargets),
      setJump: String(value.setJump || value.set_jump || value.jumpTarget || '').trim(),
      rawOnDisplay: lineList(value.rawOnDisplay || value.onDisplay),
      rawOnDeparture: lineList(value.rawOnDeparture || value.onDeparture),
      rawEffects: lineList(value.rawEffects || value.rawEffectsOnTrigger || value.rawOnArrival || value.onArrival),
      narrativeParagraphs: normalizeTextList(value.narrativeParagraphs || value.body || value.resultText || value.textAfter || ''),
      variants: ensureArray(value.variants),
      gotoAfter: kind === 'card' ? safeId(localId(value.gotoAfter || value.returnTarget || 'root')) : safeId(localId(value.gotoAfter || 'continue_' + id)),
      returnTarget: safeId(localId(value.returnTarget || value.afterResultTarget || 'root'))
    };
    if (section && section.id) {
      row.ownerSectionId = safeId(localId(section.id));
    }
    return row;
  }

  function qualifyDuplicateDraftAnchors(draft, lookup) {
    const rewrites = [];
    const unresolvedRoutes = [];
    const linkTargetIds = new Set(['root']);
    ensureArray(lookup && lookup.scenes).forEach((scene) => {
      if (scene && scene.id) {
        linkTargetIds.add(safeId(localId(scene.id)));
      }
    });
    ensureArray(draft && draft.sections).forEach((section) => {
      if (section && section.id) {
        linkTargetIds.add(String(section.id));
      }
    });

    const records = [];
    const addRecord = (record) => {
      const oldId = safeId(record.oldId || '');
      if (oldId) {
        records.push(Object.assign({}, record, {oldId}));
      }
    };
    addRecord({kind: 'event', oldId: draft && draft.id, object: draft, prop: 'id', locked: true, owner: 'event'});
    ensureArray(draft && draft.sections).forEach((section, sectionIndex) => {
      const sectionOwner = 'section:' + (section && section.sourceAnchorId || section && section.id || sectionIndex + 1);
      addRecord({kind: 'section', oldId: section && section.id, object: section, prop: 'id', owner: sectionOwner, ownerPrefix: section && section.id || 'section_' + (sectionIndex + 1)});
      ensureArray(section && section.options).forEach((option, optionIndex) => {
        collectOptionAnchorRecords(addRecord, option, optionIndex, section && section.id || '', linkTargetIds);
      });
    });
    ensureArray(draft && draft.options).forEach((option, optionIndex) => {
      collectOptionAnchorRecords(addRecord, option, optionIndex, '', linkTargetIds);
    });

    const countById = records.reduce((out, record) => {
      out[record.oldId] = (out[record.oldId] || 0) + 1;
      return out;
    }, {});
    const used = new Set(records.filter((record) => countById[record.oldId] <= 1 || record.locked).map((record) => record.oldId));
    const scopedMap = new Map();
    const allMappings = {};

    records.forEach((record, index) => {
      if (record.locked || countById[record.oldId] <= 1) {
        return;
      }
      const ownerPrefix = safeId(localId(record.ownerPrefix || record.owner || 'root'));
      const base = record.kind === 'goto'
        ? 'continue_' + ownerPrefix + '_' + stripContinuePrefix(record.oldId)
        : ownerPrefix + '_' + record.oldId;
      const nextId = uniqueAnchorId(base, used);
      used.add(nextId);
      record.object[record.prop] = nextId;
      if (record.kind === 'section') {
        record.object.sourceAnchorId = record.object.sourceAnchorId || record.oldId;
        record.object.renderAnchorId = nextId;
      } else if (record.kind === 'option') {
        record.object.sourceAnchorId = record.object.sourceAnchorId || record.oldId;
        record.object.renderAnchorId = nextId;
      }
      const rewrite = {
        source: record.oldId,
        render: nextId,
        owner: record.owner || '',
        kind: record.kind || ''
      };
      rewrites.push(rewrite);
      ensureArray(record.scopeKeys).concat(record.owner || '').filter(Boolean).forEach((key) => {
        scopedMap.set(key + '::' + record.oldId, nextId);
      });
      if (!allMappings[record.oldId]) {
        allMappings[record.oldId] = [];
      }
      allMappings[record.oldId].push(Object.assign({index}, rewrite));
    });

    ensureArray(draft && draft.sections).forEach((section) => {
      ensureArray(section && section.options).forEach((option) => {
        option.ownerSectionId = section.id || option.ownerSectionId || '';
      });
    });

    const mapTarget = (target, ownerKeys, ownerLabel) => {
      const normalized = safeId(localId(target));
      if (!normalized || normalized === 'root') {
        return target;
      }
      for (let index = 0; index < ownerKeys.length; index += 1) {
        const mapped = scopedMap.get(ownerKeys[index] + '::' + normalized);
        if (mapped) {
          return mapped;
        }
      }
      const matches = allMappings[normalized] || [];
      if (matches.length === 1) {
        return matches[0].render;
      }
      if (matches.length > 1) {
        unresolvedRoutes.push({target: normalized, owner: ownerLabel || '', reason: 'ambiguous_duplicate_anchor'});
      }
      return target;
    };

    const rewriteRawRoutes = (lines, ownerKeys, ownerLabel) => ensureArray(lines).map((line) => {
      return rewriteRawRouteTarget(line, (target) => mapTarget(target, ownerKeys, ownerLabel));
    });

    draft.rawRoutes = rewriteRawRoutes(draft.rawRoutes, ['event', 'root'], 'event');
    if (draft.setJump) {
      draft.setJump = mapTarget(draft.setJump, ['event', 'root'], 'event set-jump');
    }
    ensureArray(draft.options).forEach((option) => {
      const keys = optionScopeKeys(option, '');
      rewriteOptionTargets(option, keys, 'root option ' + (option.sourceAnchorId || option.id), mapTarget, rewriteRawRoutes);
    });
    ensureArray(draft.sections).forEach((section) => {
      const sectionKeys = sectionScopeKeys(section);
      section.rawRoutes = rewriteRawRoutes(section.rawRoutes, sectionKeys, 'section ' + (section.sourceAnchorId || section.id));
      if (section.exitTarget) {
        section.exitTarget = mapTarget(section.exitTarget, sectionKeys, 'section ' + (section.sourceAnchorId || section.id));
      }
      if (section.setJump) {
        section.setJump = mapTarget(section.setJump, sectionKeys, 'section ' + (section.sourceAnchorId || section.id) + ' set-jump');
      }
      ensureArray(section.options).forEach((option) => {
        rewriteOptionTargets(option, optionScopeKeys(option, section), 'section option ' + (option.sourceAnchorId || option.id), mapTarget, rewriteRawRoutes);
      });
    });

    if (rewrites.length || unresolvedRoutes.length) {
      draft.anchorResolution = {
        version: '0.1',
        rewrites,
        unresolvedRoutes
      };
    }
    return {
      rewrites,
      unresolvedRoutes,
      blockers: unresolvedRoutes.map((item) => blocker('parsed_to_draft.unresolved_anchor_mapping', 'Anchor mapping could not safely resolve route target "' + item.target + '" from ' + item.owner + '.'))
    };
  }

  function collectOptionAnchorRecords(addRecord, option, optionIndex, ownerSectionId, linkTargetIds) {
    if (!option) {
      return;
    }
    const optionId = safeId(option.id || 'option_' + (optionIndex + 1));
    const ownerPrefix = ownerSectionId ? ownerSectionId + '_' + optionId : 'root_' + optionId;
    const scopeKeys = optionScopeKeys(option, ownerSectionId);
    const linkedTarget = linkTargetIds && linkTargetIds.has(optionId) && !optionHasInlineResultContent(option);
    if (!linkedTarget) {
      addRecord({kind: 'option', oldId: optionId, object: option, prop: 'id', owner: ownerSectionId ? 'section:' + ownerSectionId : 'root', ownerPrefix, scopeKeys});
      if (option.gotoAfter) {
        addRecord({kind: 'goto', oldId: option.gotoAfter, object: option, prop: 'gotoAfter', owner: ownerSectionId ? 'section:' + ownerSectionId : 'root', ownerPrefix, scopeKeys});
      }
    }
  }

  function optionHasInlineResultContent(option) {
    const value = isObject(option) ? option : {};
    return Boolean(
      String(value.title || '').trim() ||
      String(value.subtitle || '').trim() ||
      String(value.chooseIf || '').trim() ||
      String(value.unavailableText || '').trim() ||
      String(value.setJump || '').trim() ||
      ensureArray(value.effects).length ||
      ensureArray(value.rawEffects).length ||
      ensureArray(value.rawRoutes).length ||
      ensureArray(value.calls).length ||
      ensureArray(value.narrativeParagraphs).length ||
      ensureArray(value.assetPlacements).length ||
      ensureArray(value.variants).length
    );
  }

  function sectionScopeKeys(section) {
    const id = String(section && section.id || '').trim();
    const source = String(section && section.sourceAnchorId || '').trim();
    return uniqueStrings(['section:' + id, source ? 'section:' + source : '', id, source]).filter(Boolean);
  }

  function optionScopeKeys(option, ownerSection) {
    const ownerId = isObject(ownerSection) ? String(ownerSection.id || '') : String(ownerSection || '');
    const ownerSource = isObject(ownerSection) ? String(ownerSection.sourceAnchorId || '') : '';
    const optionId = String(option && option.id || '').trim();
    const optionSource = String(option && option.sourceAnchorId || '').trim();
    return uniqueStrings([
      ownerId ? 'section:' + ownerId : 'root',
      ownerSource ? 'section:' + ownerSource : '',
      optionId ? 'option:' + optionId : '',
      optionSource ? 'option:' + optionSource : '',
      ownerId,
      ownerSource
    ]).filter(Boolean);
  }

  function rewriteOptionTargets(option, ownerKeys, ownerLabel, mapTarget, rewriteRawRoutes) {
    option.rawRoutes = rewriteRawRoutes(option.rawRoutes, ownerKeys, ownerLabel);
    if (option.gotoAfter) {
      option.gotoAfter = mapTarget(option.gotoAfter, ownerKeys, ownerLabel + ' goto');
    }
    if (option.returnTarget) {
      option.returnTarget = mapTarget(option.returnTarget, ownerKeys, ownerLabel + ' return');
    }
    if (option.setJump) {
      option.setJump = mapTarget(option.setJump, ownerKeys, ownerLabel + ' set-jump');
    }
  }

  function rewriteRawRouteTarget(line, mapTarget) {
    return String(line || '').replace(/^(\s*(?:go-to|check-success-go-to|check-failure-go-to)\s*:\s*[@#]?)([A-Za-z_][A-Za-z0-9_.-]*)/i, (full, prefix, target) => {
      const mapped = mapTarget(target);
      return prefix + mapped;
    });
  }

  function uniqueAnchorId(base, used) {
    const root = safeId(base || 'anchor');
    if (!used.has(root)) {
      return root;
    }
    let index = 2;
    let next = root + '_' + index;
    while (used.has(next)) {
      index += 1;
      next = root + '_' + index;
    }
    return next;
  }

  function stripContinuePrefix(value) {
    return String(value || '').replace(/^continue_/, '');
  }

  function eventBlockers(scene, rootOptions, sections, sectionOptionCount, eventShape) {
    const blockers = [];
    if (hasDynamicStructure(scene)) {
      blockers.push(blocker('parsed_to_draft.dynamic_structure_partial', 'This parsed event has dynamic/raw structure that still needs source-backed authoring support.'));
    }
    externalOptionTargetBlockers(scene, sections).forEach((item) => blockers.push(item));
    if (eventShape === 'choice_event' && rootOptions.length < 2) {
      blockers.push(blocker('parsed_to_draft.choice_event_too_few_options', 'This parsed event has fewer than 2 root choices; structured create-as-new support is partial.'));
    }
    if (eventShape === 'pure_event' && !rootOptions.length && (ensureArray(sections).length || Number(sectionOptionCount || 0) > 0)) {
      blockers.push(blocker('parsed_to_draft.root_choice_missing', 'This parsed event has follow-up structure but no root player choice; add a visible root option or convert the structure before install.'));
    }
    return blockers;
  }

  function eventShapeForRootOptions(rootOptions) {
    const count = ensureArray(rootOptions).length;
    if (count === 0) {
      return 'pure_event';
    }
    if (count === 1) {
      return 'linear_choice_event';
    }
    return 'choice_event';
  }

  function choiceLikeEventShape(shape) {
    return shape === 'choice_event' || shape === 'linear_choice_event';
  }

  function externalOptionTargetBlockers(scene, sections) {
    const localTargets = new Set(['root']);
    ensureArray(sections).forEach((section) => {
      if (section && section.id) {
        localTargets.add(String(section.id));
      }
    });
    const blockers = [];
    const rows = ensureArray(scene && (scene.options || scene.choices)).concat(ensureArray(scene && scene.sections).reduce((out, section) => {
      return out.concat(ensureArray(section && section.options));
    }, []));
    rows.forEach((option) => {
      const target = parsedOptionTargetId(option);
      const ownResultId = safeId(localId(option && option.id || ''));
      const normalizedTarget = safeId(localId(target));
      if (target && ownResultId && normalizedTarget === ownResultId) {
        return;
      }
      if (target && !localTargets.has(normalizedTarget)) {
        blockers.push(blocker('parsed_to_draft.external_option_route_partial', 'Parsed option target "' + target + '" is outside the copied event structure; review route preservation before install.'));
      }
    });
    return blockers;
  }

  function parsedOptionTargetId(option) {
    const value = isObject(option) ? option : {};
    const target = isObject(value.target) ? value.target : {};
    const candidate = value.gotoAfter || value.returnTarget || value.afterResultTarget || value.targetId || value.rawTargetId || target.id || '';
    const text = String(candidate || '').replace(/^[@#]/, '').trim();
    return text && !/^continue_[A-Za-z0-9_]+$/.test(text) ? text : '';
  }

  function cardBlockers(scene, rootOptions, sectionOptions, allOptions, cardShape) {
    const blockers = [];
    if (hasDynamicStructure(scene)) {
      blockers.push(blocker('parsed_to_draft.dynamic_structure_partial', 'This parsed card has dynamic/raw structure that still needs source-backed authoring support.'));
    }
    if (cardShape === 'choice_card' && rootOptions.length < 2) {
      blockers.push(blocker('parsed_to_draft.card_option_shape_partial', 'This parsed choice card has fewer than 2 choices.'));
    }
    if (cardShape === 'menu_card' && !ensureArray(scene && scene.sections).length) {
      blockers.push(blocker('parsed_to_draft.card_sections_partial', 'This menu card has no parsed sections.'));
    }
    return blockers;
  }

  function hasDynamicStructure(scene) {
    return Boolean(scene && (scene.dynamicStructure || scene.dynamicMenu || ensureArray(scene.dynamicBlocks).length));
  }

  function archetypeForEvent(eventShape, rootOptions, sections, sectionOptionCount) {
    if (rootOptions.length > 4) {
      return 'large_choice_event';
    }
    if (sectionOptionCount || ensureArray(sections).length) {
      return 'section_event';
    }
    return eventShape;
  }

  function archetypeForCard(scene, rootOptions, sectionOptions, allOptions) {
    if (!allOptions.length && (scene && scene.flags && scene.flags.isPinnedCard || String(scene && scene.type || '') === 'pinned_card')) {
      return 'pinned_text_card';
    }
    if (ensureArray(scene && scene.sections).length || sectionOptions.length && !rootOptions.length) {
      return 'menu_card';
    }
    if (allOptions.length > 4) {
      return 'large_card';
    }
    return scene && scene.flags && scene.flags.isPinnedCard || String(scene && scene.type || '') === 'pinned_card' ? 'advisor_card' : 'card';
  }

  function parityCounts(scene, textRows) {
    const rootOptions = ensureArray(scene && scene.options || scene && scene.choices);
    const sections = ensureArray(scene && scene.sections);
    const sectionOptions = sections.reduce((sum, section) => sum + ensureArray(section && section.options).length, 0);
    return {
      text: ensureArray(textRows).filter((row) => String(row && (row.text || row.value || row.original) || '').trim()).length,
      effects: collectEffects(scene).length,
      options: rootOptions.length + sectionOptions,
      rootOptions: rootOptions.length,
      sectionOptions,
      sections: sections.length,
      conditions: conditionCount(scene, textRows),
      assets: assetRefsForScene(scene).length
    };
  }

  function draftParityCounts(draft) {
    const sections = ensureArray(draft && draft.sections);
    const rootOptions = ensureArray(draft && draft.options);
    const sectionOptions = sections.reduce((sum, section) => sum + ensureArray(section && section.options).length, 0);
    return {
      text: ensureArray(draft && draft.introParagraphs).filter(Boolean).length +
        ensureArray(draft && draft.conditionalParagraphs).filter(conditionalParagraphHasText).length +
        (draft && draft.title ? 1 : 0) +
        (draft && draft.subtitle ? 1 : 0) +
        sections.reduce((sum, section) => sum +
          ensureArray(section && section.paragraphs).filter(Boolean).length +
          ensureArray(section && section.conditionalParagraphs).filter(conditionalParagraphHasText).length, 0),
      effects: ensureArray(draft && draft.effectsOnTrigger).length +
        sections.reduce((sum, section) => sum + ensureArray(section && section.effects).length + ensureArray(section && section.options).reduce((optSum, option) => optSum + ensureArray(option && option.effects).length, 0), 0) +
        rootOptions.reduce((sum, option) => sum + ensureArray(option && option.effects).length, 0) +
        ensureArray(draft && draft.parsedEffects).length,
      options: rootOptions.length + sectionOptions,
      rootOptions: rootOptions.length,
      sectionOptions,
      sections: sections.length || ensureArray(draft && draft.parsedSections).length,
      conditions: conditionCountFromDraft(draft),
      assets: ensureArray(draft && draft.assetRefs).length
    };
  }

  function roleKeyedParity(scene, textRows, draft) {
    const parsed = parsedRoleCounts(scene, textRows);
    const drafted = draftedRoleCounts(draft);
    const roles = {};
    const blockers = [];
    const warnings = [];
    const namedWarnings = [];
    uniqueStrings(Object.keys(parsed).concat(Object.keys(drafted))).forEach((key) => {
      const parsedCount = Number(parsed[key] || 0);
      const draftCount = Number(drafted[key] || 0);
      const missing = Math.max(0, parsedCount - draftCount);
      const missingNames = missing ? namedRoleLosses(key, scene, textRows, draft) : [];
      const row = {
        role: key,
        parsed: parsedCount,
        draft: draftCount,
        missing,
        missingNames,
        blocking: Boolean(missing && blockingParityRole(key))
      };
      roles[key] = row;
      if (!missing) {
        return;
      }
      const item = blocker('parsed_to_draft.missing_' + key, 'Parsed ' + roleLabel(key) + ' count is ' + parsedCount + ', but the draft keeps ' + draftCount + '.' +
        (missingNames.length ? ' Missing: ' + missingNames.join('; ') + '.' : ''));
      if (row.blocking) {
        blockers.push(item);
      } else {
        warnings.push(item);
        if (missingNames.length) {
          namedWarnings.push(item);
        }
      }
    });
    return {parsed, draft: drafted, roles, blockers, warnings, namedWarnings};
  }

  let lossNamerCache;
  function namedRoleLosses(role, scene, textRows, draft) {
    if (lossNamerCache === undefined) {
      let lossApi = null;
      if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
        try {
          lossApi = require('./parsed_draft_loss_names.js');
        } catch (_err) {
          lossApi = null;
        }
      }
      if (!lossApi && typeof globalThis !== 'undefined') {
        lossApi = globalThis.ProjectMapParsedDraftLossNames || null;
      }
      lossNamerCache = lossApi ? lossApi.createLossNamer({ensureArray, roleOf, hookRows, assetRefsForScene}) : null;
    }
    return lossNamerCache ? lossNamerCache.namedRoleLosses(role, scene, textRows, draft) : [];
  }

  function parsedRoleCounts(scene, textRows) {
    const rows = ensureArray(textRows);
    const sections = ensureArray(scene && scene.sections);
    const rootOptions = ensureArray(scene && (scene.options || scene.choices));
    const sectionOptions = sections.reduce((sum, section) => sum + ensureArray(section && section.options).length, 0);
    return {
      title: scene && scene.title || rows.some((row) => roleOf(row) === 'title') ? 1 : 0,
      subtitle: scene && scene.subtitle || rows.some((row) => roleOf(row) === 'subtitle') ? 1 : 0,
      heading: scene && scene.heading || rows.some((row) => roleOf(row) === 'heading') ? 1 : 0,
      body: parsedBodyTextCount(rows, scene),
      metadata: parsedMetadataCount(scene, rows),
      viewIf: scene && (scene.viewIf || scene.view_if) ? 1 : 0,
      options: rootOptions.length,
      sectionOptions,
      sections: sections.length,
      conditions: conditionCount(scene, rows),
      effects: collectEffects(scene).length,
      assets: assetRefsForScene(scene).length,
      routes: routeCount(scene),
      calls: callCount(scene),
      setJump: scene && (scene.setJump || scene.set_jump || scene.jumpTarget) ? 1 : 0,
      lifecycleHooks: lifecycleHookCount(scene)
    };
  }

  function draftedRoleCounts(draft) {
    const sections = ensureArray(draft && draft.sections);
    const rootOptions = ensureArray(draft && draft.options);
    const sectionOptions = sections.reduce((sum, section) => sum + ensureArray(section && section.options).length, 0);
    return {
      title: draft && draft.title ? 1 : 0,
      subtitle: draft && draft.subtitle ? 1 : 0,
      heading: draft && draft.heading ? 1 : 0,
      body: ensureArray(draft && draft.introParagraphs).filter(Boolean).length +
        ensureArray(draft && draft.conditionalParagraphs).filter(conditionalParagraphHasText).length +
        sections.reduce((sum, section) => sum +
          ensureArray(section && section.paragraphs).filter(Boolean).length +
          ensureArray(section && section.conditionalParagraphs).filter(conditionalParagraphHasText).length, 0),
      metadata: ensureArray(draft && draft.tags).length + (draft && draft.newPage !== undefined ? 1 : 0),
      viewIf: draft && (draft.rawViewIf || draft.viewIf || draft.when && draft.when.requires) ? 1 : 0,
      options: rootOptions.length,
      sectionOptions,
      sections: sections.length || ensureArray(draft && draft.parsedSections).length,
      conditions: conditionCountFromDraft(draft),
      effects: draftParityCounts(draft).effects,
      assets: ensureArray(draft && draft.assetRefs).length,
      routes: routeCountFromDraft(draft),
      calls: callCountFromDraft(draft),
      setJump: draft && draft.setJump ? 1 : 0,
      lifecycleHooks: lifecycleHookCountFromDraft(draft)
    };
  }

  function parsedBodyTextCount(rows, scene) {
    const bodyRoles = new Set(['body', 'content', 'visible_text', 'monthly_popup_excerpt']);
    const bodyRows = ensureArray(rows).filter((row) => {
      const role = roleOf(row);
      const text = String(row && (row.text || row.value || row.original) || '').trim();
      return text && bodyRoles.has(role);
    });
    const count = textValues(bodyRows).length +
      conditionalParagraphsFromRows(ensureArray(rows).filter((row) => roleOf(row) === 'conditional_body')).length;
    if (count) {
      return count;
    }
    return normalizeTextList(scene && (scene.body || scene.text || scene.description) || '').length;
  }

  function parsedMetadataCount(scene, rows) {
    let count = ensureArray(scene && scene.tags).length + (scene && scene.newPage !== undefined ? 1 : 0);
    ensureArray(rows).forEach((row) => {
      const role = roleOf(row);
      if (role === 'metadata' || role === 'tags' || role === 'new_page') {
        count += 1;
      }
    });
    return count;
  }

  function blockingParityRole(role) {
    return [
      'title',
      'subtitle',
      'heading',
      'body',
      'viewIf',
      'options',
      'sectionOptions',
      'sections',
      'conditions',
      'effects',
      'assets',
      'routes',
      'calls',
      'setJump',
      'lifecycleHooks'
    ].includes(String(role || ''));
  }

  function roleLabel(role) {
    return String(role || '').replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
  }

  function conditionCount(scene, rows) {
    let count = scene && scene.viewIf ? 1 : 0;
    ensureArray(scene && scene.options).forEach((option) => { if (option && (option.chooseIf || option.condition)) { count += 1; } });
    ensureArray(scene && scene.sections).forEach((section) => {
      if (section && (section.condition || section.viewIf || section.chooseIf)) {
        count += 1;
      }
      ensureArray(section && section.options).forEach((option) => { if (option && (option.chooseIf || option.condition)) { count += 1; } });
    });
    count += conditionalParagraphsFromRows(ensureArray(rows).filter((row) => roleOf(row) === 'conditional_body'))
      .reduce((sum, row) => sum + conditionalParagraphConditionCount(row), 0);
    return count;
  }

  function conditionCountFromDraft(draft) {
    let count = draft && (draft.rawViewIf || draft.viewIf || draft.when && draft.when.requires) ? 1 : 0;
    count += ensureArray(draft && draft.conditionalParagraphs).reduce((sum, row) => sum + conditionalParagraphConditionCount(row), 0);
    ensureArray(draft && draft.options).forEach((option) => { if (option && option.chooseIf) { count += 1; } });
    ensureArray(draft && draft.sections).forEach((section) => {
      if (section && section.condition) {
        count += 1;
      }
      count += ensureArray(section && section.conditionalParagraphs).reduce((sum, row) => sum + conditionalParagraphConditionCount(row), 0);
      ensureArray(section && section.options).forEach((option) => { if (option && option.chooseIf) { count += 1; } });
    });
    return count;
  }

  function collectEffects(scene) {
    const rows = [];
    normalizeEffects(scene && (scene.effects || scene.effectsOnTrigger), 'on-arrival').forEach((effect) => rows.push(effect));
    ensureArray(scene && scene.options).forEach((option) => normalizeEffects(option && option.effects, 'choice').forEach((effect) => rows.push(effect)));
    ensureArray(scene && scene.sections).forEach((section) => {
      normalizeEffects(section && section.effects, 'on-arrival').forEach((effect) => rows.push(effect));
      ensureArray(section && section.options).forEach((option) => normalizeEffects(option && option.effects, 'choice').forEach((effect) => rows.push(effect)));
    });
    return rows;
  }

  function routeCount(scene) {
    const value = isObject(scene) ? scene : {};
    return lineList(value.rawRoutes || value.routeClauses).length +
      ensureArray(value.sections).reduce((sum, section) => {
        return sum + lineList(section && (section.rawRoutes || section.routeClauses)).length +
          ensureArray(section && section.options).reduce((optSum, option) => optSum + lineList(option && (option.rawRoutes || option.routeClauses)).length, 0);
      }, 0) +
      ensureArray(value.options || value.choices).reduce((sum, option) => sum + lineList(option && (option.rawRoutes || option.routeClauses)).length, 0);
  }

  function routeCountFromDraft(draft) {
    const value = isObject(draft) ? draft : {};
    return lineList(value.rawRoutes).length +
      ensureArray(value.sections).reduce((sum, section) => {
        return sum + lineList(section && section.rawRoutes).length +
          ensureArray(section && section.options).reduce((optSum, option) => optSum + lineList(option && option.rawRoutes).length, 0);
      }, 0) +
      ensureArray(value.options).reduce((sum, option) => sum + lineList(option && option.rawRoutes).length, 0);
  }

  function callCount(scene) {
    const value = isObject(scene) ? scene : {};
    return lineList(value.calls || value.callTargets).length +
      ensureArray(value.sections).reduce((sum, section) => {
        return sum + lineList(section && (section.calls || section.callTargets)).length +
          ensureArray(section && section.options).reduce((optSum, option) => optSum + lineList(option && (option.calls || option.callTargets)).length, 0);
      }, 0) +
      ensureArray(value.options || value.choices).reduce((sum, option) => sum + lineList(option && (option.calls || option.callTargets)).length, 0);
  }

  function callCountFromDraft(draft) {
    const value = isObject(draft) ? draft : {};
    return lineList(value.calls).length +
      ensureArray(value.sections).reduce((sum, section) => {
        return sum + lineList(section && section.calls).length +
          ensureArray(section && section.options).reduce((optSum, option) => optSum + lineList(option && option.calls).length, 0);
      }, 0) +
      ensureArray(value.options).reduce((sum, option) => sum + lineList(option && option.calls).length, 0);
  }

  function lifecycleHookCount(scene) {
    const value = isObject(scene) ? scene : {};
    return hookRows(value).length +
      ensureArray(value.sections).reduce((sum, section) => {
        return sum + hookRows(section).length +
          ensureArray(section && section.options).reduce((optSum, option) => optSum + hookRows(option).length, 0);
      }, 0) +
      ensureArray(value.options || value.choices).reduce((sum, option) => sum + hookRows(option).length, 0);
  }

  function lifecycleHookCountFromDraft(draft) {
    const value = isObject(draft) ? draft : {};
    return hookRows(value).length +
      ensureArray(value.sections).reduce((sum, section) => {
        return sum + hookRows(section).length +
          ensureArray(section && section.options).reduce((optSum, option) => optSum + hookRows(option).length, 0);
      }, 0) +
      ensureArray(value.options).reduce((sum, option) => sum + hookRows(option).length, 0);
  }

  function hookRows(value) {
    const row = isObject(value) ? value : {};
    return []
      .concat(lineList(row.rawEffects || row.rawEffectsOnTrigger || row.rawOnArrival || row.onArrival))
      .concat(lineList(row.rawOnDisplay || row.onDisplay))
      .concat(lineList(row.rawOnDeparture || row.onDeparture));
  }

  function lineList(value) {
    if (Array.isArray(value)) {
      return value;
    }
    const text = String(value === undefined || value === null ? '' : value).trim();
    return text ? [text] : [];
  }

  function normalizeEffects(effects, fallbackHook) {
    return ensureArray(effects).map((effect) => {
      const value = isObject(effect) ? effect : {};
      const variable = String(value.variable || value.name || '').replace(/^Q\./, '').trim();
      const op = String(value.op || value.operator || '=').trim();
      return {
        variable,
        op: EFFECT_OPS.has(op) ? op : '+=',
        value: value.value === undefined ? value.amount : value.value,
        valueKind: value.valueKind || (typeof value.value === 'string' && isSafeNumericExpression(value.value) ? 'expression' : ''),
        condition: String(value.condition || value.if || '').trim(),
        hook: String(value.hook || value.timing || fallbackHook || '').trim()
      };
    }).filter((effect) => effect.variable);
  }

  function decorateDraft(draft, status, archetypeHint, blockers, parsed, drafted, roleParity) {
    draft.authoringStatus = status;
    draft.archetypeHint = archetypeHint;
    draft.authoringBlockers = ensureArray(blockers).map((item) => item.message);
    draft.parsedToDraftParity = {parsed, draft: drafted, roles: roleParity && roleParity.roles || {}, warnings: roleParity && roleParity.warnings || [], blockers};
    return draft;
  }

  function resultForDraft(value) {
    return {
      ok: value.status !== 'unsupported',
      status: value.status || 'draft',
      template: value.template || '',
      draft: value.draft || null,
      archetypeHint: value.archetypeHint || '',
      parity: value.parity || null,
      source: value.source || null,
      diagnostics: ensureArray(value.diagnostics),
      captured: ensureArray(value.captured),
      notCaptured: ensureArray(value.notCaptured)
    };
  }

  function capturedRows(parsed, drafted) {
    const rows = [];
    ['text', 'effects', 'options', 'sections', 'conditions', 'assets'].forEach((key) => {
      if ((drafted[key] || 0) >= (parsed[key] || 0) && (parsed[key] || 0) > 0) {
        rows.push(key + ': ' + drafted[key] + '/' + parsed[key]);
      }
    });
    return rows.length ? rows : ['parsed identity and source evidence'];
  }

  function unsupported(view, code, message) {
    return {
      ok: false,
      status: 'unsupported',
      template: '',
      draft: null,
      archetypeHint: '',
      parity: null,
      source: null,
      diagnostics: [diagnostic('warning', code, message)],
      captured: [],
      notCaptured: [message]
    };
  }

  function blocker(code, message) {
    return {code, message};
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message, confidence: 'static_inferred'};
  }

  function assetRefsForScene(scene) {
    return ensureArray(scene && (scene.assets || scene.assetRefs)).map((asset) => {
      const value = isObject(asset) ? asset : {path: asset};
      return {
        path: String(value.path || value.src || value.url || '').trim(),
        type: String(value.type || '').trim(),
        label: String(value.label || value.name || '').trim(),
        role: String(value.role || '').trim()
      };
    }).filter((asset) => asset.path);
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    return {
      path: String(value.path || '').trim(),
      line: numberOrNull(value.line || value.startLine),
      endLine: numberOrNull(value.endLine || value.line || value.startLine)
    };
  }

  function sourceLine(source) {
    const ref = sourceRef(source);
    return ref.line || 0;
  }

  function textValues(rows) {
    const seen = new Set();
    const out = [];
    ensureArray(rows).forEach((row) => {
      const text = String(row && (row.text || row.value || row.original) || '').trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      out.push(text);
    });
    return out;
  }

  function conditionalParagraphsFromRows(rows) {
    const seen = new Set();
    return ensureArray(rows).map((row) => {
      const raw = conditionalRawText(row);
      const parsed = parseConditionalRaw(raw);
      const condition = String(row && row.condition || ensureArray(row && row.conditions)[0] || parsed.condition || '').trim();
      const text = String(row && (row.text || row.value || row.original) || parsed.text || '').trim();
      const source = row && row.source || {};
      const ownerSection = String(row && row.owner && row.owner.sectionId || row && row.sectionId || '').trim();
      const sourceKey = [source.path || '', source.line || source.startLine || ''].join(':');
      const scope = sourceKey !== ':' ? sourceKey : ownerSection;
      const key = [scope, raw || [condition, text].join('|')].join('|');
      if ((!raw && !condition && !text) || seen.has(key)) {
        return null;
      }
      seen.add(key);
      return {
        condition,
        text,
        raw,
        sourceRole: 'conditional_body',
        source: sourceRef(row && row.source || {})
      };
    }).filter(Boolean);
  }

  function conditionalRawText(row) {
    const source = row && row.source || {};
    const anchor = String(source.anchorText || source.rawAnchorText || '').trim();
    if (anchor && (anchor.includes('[?') || roleOf(row) === 'conditional_body')) {
      return anchor;
    }
    const original = String(row && (row.original || '') || '').trim();
    if (original && original.includes('[?')) {
      return original;
    }
    const text = String(row && (row.text || row.value || '') || '').trim();
    return text && text.includes('[?') ? text : '';
  }

  function parseConditionalRaw(raw) {
    const match = String(raw || '').trim().match(/^\[\?\s*if\s+([\s\S]*?)\s*:\s*([\s\S]*?)\s*\?\]$/);
    return match ? {condition: match[1].trim(), text: match[2].trim()} : {condition: '', text: ''};
  }

  function conditionalParagraphHasText(row) {
    return Boolean(row && (String(row.raw || '').trim() || String(row.text || '').trim()));
  }

  function conditionalParagraphConditionCount(row) {
    const raw = String(row && row.raw || '').trim();
    if (raw) {
      const matches = raw.match(/\[\?\s*if\b/g) || [];
      return matches.length || 1;
    }
    return String(row && row.condition || '').trim() ? 1 : 0;
  }

  function fallbackParagraphsExcludingConditionals(value, conditionalRows) {
    const paragraphs = normalizeTextList(value);
    const conditionalTexts = new Set();
    conditionalParagraphsFromRows(conditionalRows).forEach((row) => {
      if (row.raw) {
        conditionalTexts.add(row.raw);
      }
      if (row.text) {
        conditionalTexts.add(row.text);
      }
    });
    if (!conditionalTexts.size) {
      return paragraphs;
    }
    return paragraphs.filter((paragraph) => {
      const text = String(paragraph || '').trim();
      return text && !conditionalTexts.has(text);
    });
  }

  function roleOf(row) {
    return String(row && (row.role || row.semanticRole || row.kind) || '').trim();
  }

  function splitOptionTitle(title) {
    const text = String(title || '').trim();
    const parts = text.split('——');
    if (parts.length > 1) {
      return {label: parts[0].trim(), subtitle: parts.slice(1).join('——').trim()};
    }
    return {label: text, subtitle: ''};
  }

  function normalizeTextList(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
    }
    return [];
  }

  function firstNonEmpty() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }
    return '';
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function parseSlot(slot) {
    const match = String(slot || '').match(/news_(\d+)/);
    if (match) {
      return Number(match[1]);
    }
    return numberOrNull(slot) || 1;
  }

  function parseEventWindow(viewIf) {
    const parts = String(viewIf || '').split(/\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
    const out = {year: null, monthStart: null, monthEnd: null};
    parts.forEach((part) => {
      let match = part.match(/^year\s*=\s*(\d+)$/);
      if (match) {
        out.year = Number(match[1]);
        return;
      }
      match = part.match(/^month\s*>=\s*(\d+)$/);
      if (match) {
        out.monthStart = Number(match[1]);
        return;
      }
      match = part.match(/^month\s*<=\s*(\d+)$/);
      if (match) {
        out.monthEnd = Number(match[1]);
      }
    });
    return out;
  }

  function safeId(value) {
    let text = String(value || 'draft_item')
      .replace(/^[@#]/, '')
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

  function localId(value) {
    const text = String(value || '').replace(/^[@#]/, '').trim();
    const parts = text.split('.');
    return parts[parts.length - 1] || text;
  }

  function idTokens(value) {
    const text = String(value || '').trim();
    const local = localId(text);
    return [text, local].filter(Boolean);
  }

  function uniqueStrings(values) {
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

  function humanTitle(value) {
    return String(value || 'Draft item').replace(/[_-]+/g, ' ').replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }

  function normalizeView(view) {
    const text = String(view || '').trim();
    if (text === 'event' || text === 'scene') {
      return 'events';
    }
    if (text === 'card') {
      return 'cards';
    }
    if (text === 'surface' || text === 'surface_text') {
      return 'surfaceText';
    }
    return text;
  }

  function isSafeNumericExpression(value) {
    const text = String(value || '').trim();
    return Boolean(text) && /^[A-Za-z0-9_.$+\-*/%() <>=!&|?:]+$/.test(text);
  }

  const api = {
    buildDraftFromParsed,
    eventDraftFromScene,
    cardDraftFromScene,
    newsDraftFromItem
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapParsedToDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
