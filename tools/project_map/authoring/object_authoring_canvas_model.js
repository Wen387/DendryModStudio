(function initProjectMapObjectAuthoringCanvasModel(global) {
  'use strict';

  const OBJECT_AUTHORING_CANVAS_VERSION = '0.1';
  const MODEL_KIND = 'object_authoring_canvas_model';

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function editingContextApi() {
    if (global && global.ProjectMapEditingContextModel) {
      return global.ProjectMapEditingContextModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./editing_context_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function eventDraftApi() {
    if (global && global.ProjectMapEventDraft) {
      return global.ProjectMapEventDraft;
    }
    if (typeof require === 'function') {
      try {
        return require('./event_draft.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function contentAdaptersApi() {
    if (global && global.ProjectMapObjectCanvasContentAdapters) {
      return global.ProjectMapObjectCanvasContentAdapters;
    }
    if (typeof require === 'function') {
      try {
        return require('./object_canvas_content_adapters.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
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

  function buildCanvasModel(projectIndex, input, options) {
    const value = isObject(input) ? input : {};
    const mode = String(value.mode || value.type || '').trim();
    if (mode === 'existing') {
      return buildExistingCanvas(projectIndex, value.view, value.item || value.itemOrId || value.sceneId, options);
    }
    const adapters = contentAdaptersApi();
    if (adapters && typeof adapters.buildTemplateCanvas === 'function') {
      const draft = value.draft || value;
      const template = value.template || adapters.templateFromDraft && adapters.templateFromDraft(draft) || 'event';
      return adapters.buildTemplateCanvas(projectIndex, template, draft, options);
    }
    return buildNewEventCanvas(projectIndex, value.draft || value, options);
  }

  function buildExistingCanvas(projectIndex, view, itemOrId, options) {
    const opts = isObject(options) ? options : {};
    const contextApi = editingContextApi();
    if (!contextApi || typeof contextApi.buildContextModel !== 'function') {
      return emptyCanvas('existing', diagnostic('error', 'object_canvas.context_missing', 'Context model is unavailable.'));
    }
    const context = contextApi.buildContextModel(projectIndex, view, itemOrId, {values: opts.values || {}});
    if (!context || !context.ok) {
      return emptyCanvas('existing', diagnostic('warning', 'object_canvas.existing_unavailable', 'This object cannot be opened in the authoring Canvas yet.'), context);
    }
    const body = eventBodyForExisting(context);
    const output = context.output || {};
    return {
      schemaVersion: OBJECT_AUTHORING_CANVAS_VERSION,
      kind: MODEL_KIND,
      ok: true,
      mode: 'existing',
      objectKind: context.sceneKind === 'card' ? 'card' : 'event',
      objectId: context.sceneId || '',
      title: context.title || context.sceneId || '',
      source: sourceRef(context.source || {}),
      entry: entryInfo(opts.entry),
      contextBoard: contextBoardFromEditingContext(context),
      eventBody: body,
      changeState: {
        draft: context.proposal,
        proposal: context.proposal,
        output,
        installPlan: output.installPlan || null,
        operationSummary: context.operationSummary || operationSummary(null),
        changedCount: ensureArray(context.proposal && context.proposal.changes).length,
        diagnostics: ensureArray(context.diagnostics),
        warnings: ensureArray(context.warnings)
      },
      legacy: {template: 'existing'},
      rawContext: context
    };
  }

  function buildNewEventCanvas(projectIndex, draftInput, options) {
    const adapters = contentAdaptersApi();
    if (adapters && typeof adapters.buildTemplateCanvas === 'function') {
      return adapters.buildTemplateCanvas(projectIndex, 'event', draftInput, options);
    }
    const opts = isObject(options) ? options : {};
    const draft = draftFromValues(normalizeEventInput(draftInput), opts.values || {});
    const api = eventDraftApi();
    let output = fallbackEventOutput(draft);
    let diagnostics = [];
    if (api && typeof api.buildExportBundle === 'function') {
      try {
        const bundle = api.buildExportBundle(draft, projectIndex, {defaultContinueLabel: opts.defaultContinueLabel || 'Continue'});
        output = normalizeEventOutput(bundle, draft);
        diagnostics = normalizeDiagnostics(bundle && bundle.diagnostics);
      } catch (err) {
        diagnostics = [diagnostic('error', 'object_canvas.event_build_failed', err && err.message || 'Event draft build failed.')];
      }
    } else {
      diagnostics = [diagnostic('warning', 'object_canvas.event_core_missing', 'EventDraft core is unavailable; Canvas is showing a local draft preview.')];
    }
    const summary = operationSummary(output.installPlan);
    return {
      schemaVersion: OBJECT_AUTHORING_CANVAS_VERSION,
      kind: MODEL_KIND,
      ok: !diagnostics.some((item) => item.severity === 'error' || item.level === 'error'),
      mode: 'new_event',
      objectKind: 'event',
      objectId: draft.id || '',
      title: draft.title || draft.heading || draft.id || 'New Event',
      source: {path: 'source/scenes/events/' + (draft.id || 'new_event') + '.scene.dry'},
      entry: entryInfo(opts.entry || {source: 'create'}),
      contextBoard: contextBoardForNewEvent(projectIndex, draft, opts.seed || opts.entry),
      eventBody: eventBodyForNewEvent(draft),
      changeState: {
        draft,
        proposal: draft,
        output,
        installPlan: output.installPlan || null,
        operationSummary: summary,
        changedCount: changedCountFromValues(opts.values),
        diagnostics,
        warnings: diagnostics.filter((item) => item.severity === 'warning' || item.level === 'warning').map((item) => item.message)
      },
      legacy: {template: 'event'},
      rawContext: null
    };
  }

  function buildTemplateCanvas(projectIndex, template, draftInput, options) {
    const adapters = contentAdaptersApi();
    if (adapters && typeof adapters.buildTemplateCanvas === 'function') {
      return adapters.buildTemplateCanvas(projectIndex, template, draftInput, options);
    }
    return buildNewEventCanvas(projectIndex, draftInput, options);
  }

  function defaultDraftForTemplate(projectIndex, template) {
    const adapters = contentAdaptersApi();
    if (adapters && typeof adapters.defaultDraftForTemplate === 'function') {
      return adapters.defaultDraftForTemplate(projectIndex, template);
    }
    return normalizeEventInput({});
  }

  function templateFromDraft(draft) {
    const adapters = contentAdaptersApi();
    if (adapters && typeof adapters.templateFromDraft === 'function') {
      return adapters.templateFromDraft(draft);
    }
    return 'event';
  }

  function eventBodyForExisting(context) {
    const editors = context.editors || {};
    const allEditors = ensureArray(editors.all);
    const titleEditor = allEditors.find((editor) => editor.role === 'title' || editor.role === 'heading') || null;
    const sectionEditors = ensureArray(editors.pageSections).concat(ensureArray(editors.playerText))
      .filter((editor) => !titleEditor || editor.id !== titleEditor.id);
    return {
      mode: 'existing',
      title: titleEditor || {
        id: '',
        label: 'Title',
        value: context.title || context.sceneId || '',
        original: context.title || context.sceneId || '',
        status: 'read_only',
        readOnly: true
      },
      sections: sectionEditors.map((editor, index) => Object.assign({slot: 'section_' + (index + 1)}, editor)),
      options: optionBodyRows(context),
      metaFields: ensureArray(editors.conditions)
    };
  }

  function optionBodyRows(context) {
    const editors = context.editors || {};
    const optionEditors = ensureArray(editors.optionText);
    const options = ensureArray(context.relationships && context.relationships.options);
    if (options.length) {
      return options.map((option, index) => {
        const fields = optionEditors.filter((editor) => {
          return editor.optionId && option.id && String(editor.optionId) === String(option.id);
        });
        if (!fields.length) {
          fields.push.apply(fields, optionEditors.filter((editor) => {
            return !editor.optionId && String(editor.original || '') === String(option.label || '');
          }));
        }
        return {
          id: option.id || 'option_' + (index + 1),
          targetId: option.targetId || '',
          label: option.label || ('Option ' + (index + 1)),
          subtitle: option.subtitle || '',
          fields
        };
      });
    }
    return optionEditors.map((editor, index) => ({
      id: editor.optionId || 'option_' + (index + 1),
      targetId: '',
      label: editor.original || editor.label || ('Option ' + (index + 1)),
      subtitle: '',
      fields: [editor]
    }));
  }

  function eventBodyForNewEvent(draft) {
    return {
      mode: 'new_event',
      title: field('event.title', 'Title', draft.title, 'guarded'),
      heading: field('event.heading', 'Heading', draft.heading || draft.title, 'guarded'),
      sections: [
        field('event.intro', 'Opening text', ensureArray(draft.introParagraphs).join('\n\n'), 'guarded')
      ],
      options: ensureArray(draft.options).map((option, index) => ({
        id: option.id || 'option_' + (index + 1),
        targetId: option.gotoAfter || '',
        label: option.label || '',
        subtitle: option.subtitle || '',
        fields: [
          field('option.' + index + '.label', 'Option label', option.label || '', 'guarded'),
          field('option.' + index + '.subtitle', 'Option subtitle', option.subtitle || '', 'guarded'),
          field('option.' + index + '.body', 'Result text', ensureArray(option.narrativeParagraphs).join('\n\n'), 'guarded')
        ]
      })),
      metaFields: [
        field('event.id', 'Event id', draft.id, 'guarded'),
        field('event.year', 'Year', draft.when && draft.when.year, 'guarded'),
        field('event.monthStart', 'Month start', draft.when && draft.when.monthStart, 'guarded'),
        field('event.monthEnd', 'Month end', draft.when && draft.when.monthEnd, 'guarded'),
        field('event.requires', 'Condition', draft.when && draft.when.requires, 'guarded'),
        field('event.priority', 'Priority', draft.when && draft.when.priority, 'guarded')
      ]
    };
  }

  function field(id, label, value, status) {
    const text = value === undefined || value === null ? '' : String(value);
    return {
      id,
      label,
      original: text,
      value: text,
      status: status || 'guarded',
      editability: status || 'guarded',
      source: {}
    };
  }

  function contextBoardFromEditingContext(context) {
    const rows = context.context || {};
    return {
      flow: flowRows(context),
      variables: ensureArray(rows.variables),
      effects: ensureArray(rows.effects),
      assets: ensureArray(rows.assets),
      sourceEvidence: ensureArray(rows.sourceEvidence),
      manualBoundaries: ensureArray(rows.manualBoundaries)
    };
  }

  function contextBoardForNewEvent(projectIndex, draft, seed) {
    const seedRow = seedContextRow(seed);
    return {
      flow: [
        seedRow || {
          label: 'New Event',
          detail: 'Created from Create.',
          direction: 'new'
        },
        {
          label: draft.id || 'new_event',
          detail: 'source/scenes/events/' + (draft.id || 'new_event') + '.scene.dry',
          direction: 'current'
        }
      ].filter(Boolean),
      variables: variablesMentionedByDraft(projectIndex, draft),
      effects: effectRowsForDraft(draft),
      assets: ensureArray(draft.assetRefs).concat(ensureArray(draft.assetInstallRequests)).map((asset) => ({
        label: asset.label || asset.path || asset.targetPath || asset.sourceName || 'asset',
        path: asset.path || asset.targetPath || asset.sourcePath || '',
        role: asset.role || asset.type || 'asset',
        status: 'draft'
      })),
      sourceEvidence: [
        {label: 'new scene target', path: 'source/scenes/events/' + (draft.id || 'new_event') + '.scene.dry', status: 'draft'}
      ],
      manualBoundaries: [
        {
          label: 'Router wiring',
          reason: 'New events may still need project-specific router review.',
          status: 'manual_review',
          source: {}
        }
      ]
    };
  }

  function flowRows(context) {
    const relationships = context.relationships || {};
    const incoming = ensureArray(relationships.incoming).map((row) => ({
      label: row.scene && row.scene.title || row.from,
      detail: [row.kind, row.label].filter(Boolean).join(' / '),
      direction: 'incoming',
      source: row.source || {}
    }));
    const current = relationships.current ? [{
      label: relationships.current.title || context.title,
      detail: relationships.current.id || context.sceneId,
      direction: 'current',
      source: relationships.current.source || context.source || {}
    }] : [];
    const outgoing = ensureArray(relationships.outgoing).map((row) => ({
      label: row.scene && row.scene.title || row.to,
      detail: [row.kind, row.label].filter(Boolean).join(' / '),
      direction: 'outgoing',
      source: row.source || {}
    }));
    return incoming.concat(current, outgoing);
  }

  function normalizeEventInput(input) {
    const value = isObject(input) ? input : {};
    const id = safeId(value.id || value.rawId || 'new_world_event');
    const when = isObject(value.when) ? value.when : value;
    const options = ensureArray(value.options);
    return {
      schemaVersion: '0.1',
      kind: 'world_event',
      id,
      title: String(value.title || value.heading || 'New World Event').trim(),
      heading: String(value.heading || value.title || 'New World Event').trim(),
      seenFlag: safeId(value.seenFlag || value.rawSeenFlag || id + '_seen'),
      when: {
        year: numberOr(value.year || when.year, 1936),
        monthStart: numberOr(value.monthStart || when.monthStart, 1),
        monthEnd: numberOr(value.monthEnd || when.monthEnd, 3),
        requires: String(value.requires || when.requires || '').trim(),
        priority: numberOr(value.priority || when.priority, 0)
      },
      introParagraphs: normalizeParagraphs(value.introParagraphs || value.intro || value.body || 'Write the opening event text here.'),
      effectsOnTrigger: ensureArray(value.effectsOnTrigger || value.triggerEffects).map(normalizeEffect),
      assetRefs: ensureArray(value.assetRefs),
      assetInstallRequests: ensureArray(value.assetInstallRequests),
      options: normalizeEventOptions(options.length ? options : defaultOptions())
    };
  }

  function normalizeEventOptions(options) {
    return ensureArray(options).slice(0, 4).map((option, index) => {
      const value = isObject(option) ? option : {};
      const id = safeId(value.id || value.rawId || 'option_' + (index + 1));
      return {
        id,
        label: String(value.label || value.title || 'Choice ' + (index + 1)).trim(),
        subtitle: String(value.subtitle || '').trim(),
        chooseIf: String(value.chooseIf || '').trim(),
        unavailableText: String(value.unavailableText || '').trim(),
        effects: ensureArray(value.effects).map(normalizeEffect),
        narrativeParagraphs: normalizeParagraphs(value.narrativeParagraphs || value.body || value.text || 'Describe the result of this choice.'),
        variants: ensureArray(value.variants),
        gotoAfter: safeId(value.gotoAfter || 'continue_' + id)
      };
    });
  }

  function defaultOptions() {
    return [
      {id: 'option_1', label: 'Take the first path', body: 'The first consequence appears.'},
      {id: 'option_2', label: 'Choose another path', body: 'The second consequence appears.'}
    ];
  }

  function draftFromValues(baseDraft, values) {
    const draft = clone(baseDraft);
    const data = isObject(values) ? values : {};
    if (has(data, 'event.id')) {
      const previousId = draft.id;
      draft.id = safeId(data['event.id'] || draft.id);
      if (!draft.seenFlag || draft.seenFlag === previousId + '_seen') {
        draft.seenFlag = safeId(draft.id + '_seen');
      } else {
        draft.seenFlag = safeId(draft.seenFlag);
      }
    }
    if (has(data, 'event.title')) {
      draft.title = String(data['event.title'] || '').trim();
    }
    if (has(data, 'event.heading')) {
      draft.heading = String(data['event.heading'] || '').trim();
    }
    if (has(data, 'event.intro')) {
      draft.introParagraphs = normalizeParagraphs(data['event.intro']);
    }
    if (has(data, 'event.year')) {
      draft.when.year = numberOr(data['event.year'], draft.when.year);
    }
    if (has(data, 'event.monthStart')) {
      draft.when.monthStart = numberOr(data['event.monthStart'], draft.when.monthStart);
    }
    if (has(data, 'event.monthEnd')) {
      draft.when.monthEnd = numberOr(data['event.monthEnd'], draft.when.monthEnd);
    }
    if (has(data, 'event.requires')) {
      draft.when.requires = String(data['event.requires'] || '').trim();
    }
    if (has(data, 'event.priority')) {
      draft.when.priority = numberOr(data['event.priority'], draft.when.priority);
    }
    draft.options = ensureArray(draft.options).map((option, index) => {
      const next = clone(option);
      if (has(data, 'option.' + index + '.label')) {
        next.label = String(data['option.' + index + '.label'] || '').trim();
      }
      if (has(data, 'option.' + index + '.subtitle')) {
        next.subtitle = String(data['option.' + index + '.subtitle'] || '').trim();
      }
      if (has(data, 'option.' + index + '.body')) {
        next.narrativeParagraphs = normalizeParagraphs(data['option.' + index + '.body']);
      }
      return next;
    });
    if (!draft.heading) {
      draft.heading = draft.title;
    }
    if (!draft.seenFlag) {
      draft.seenFlag = safeId(draft.id + '_seen');
    }
    return draft;
  }

  function normalizeEventOutput(bundle, draft) {
    const value = isObject(bundle) ? bundle : {};
    return {
      ok: value.ok !== false,
      draft: value.draft || draft,
      fileName: draft.id + '.scene.dry',
      playerPreview: playerPreviewText(draft),
      previewText: playerPreviewText(draft),
      sceneDry: value.scene || value.sceneDry || '',
      scene: value.scene || value.sceneDry || '',
      draftJson: value.draftJson || JSON.stringify(draft, null, 2) + '\n',
      rootInitSnippet: value.rootSnippet || value.rootInitSnippet || '',
      migrationSnippet: value.migrationSnippet || '',
      installPlan: value.installPlan || null,
      installPlanJson: value.installPlanJson || '',
      patchPreview: value.patchPreview || '',
      installNotes: value.installNotes || '',
      installChecklist: value.installChecklist || ''
    };
  }

  function fallbackEventOutput(draft) {
    const preview = playerPreviewText(draft);
    return {
      ok: true,
      draft,
      fileName: draft.id + '.scene.dry',
      playerPreview: preview,
      previewText: preview,
      sceneDry: '',
      scene: '',
      draftJson: JSON.stringify(draft, null, 2) + '\n',
      installPlan: null,
      installPlanJson: '',
      patchPreview: ''
    };
  }

  function playerPreviewText(draft) {
    const lines = [
      draft.title || draft.heading || draft.id || 'New Event',
      '',
      draft.heading || draft.title || '',
      ''
    ];
    ensureArray(draft.introParagraphs).forEach((paragraph) => lines.push(paragraph, ''));
    ensureArray(draft.options).forEach((option) => {
      lines.push('- ' + (option.label || option.id || 'Option'));
      if (option.subtitle) {
        lines.push('  ' + option.subtitle);
      }
    });
    return lines.join('\n').replace(/\n+$/, '\n');
  }

  function variablesMentionedByDraft(projectIndex, draft) {
    const names = new Set();
    effectRowsForDraft(draft).forEach((effect) => names.add(effect.variable));
    const existing = new Map();
    ensureArray(projectIndex && projectIndex.variables).forEach((variable) => {
      if (variable && variable.name) {
        existing.set(String(variable.name), variable);
      }
    });
    return Array.from(names).map((name) => {
      const variable = existing.get(name) || {};
      return {
        name,
        reads: ensureArray(variable.reads),
        writes: ensureArray(variable.writes),
        readCount: Number(variable.readCount || 0),
        writeCount: Number(variable.writeCount || 0),
        tags: ensureArray(variable.tags).map(String),
        status: existing.has(name) ? 'referenced' : 'new_or_missing'
      };
    });
  }

  function effectRowsForDraft(draft) {
    return Array.prototype.concat.apply(ensureArray(draft.effectsOnTrigger), ensureArray(draft.options).map((option) => ensureArray(option.effects)))
      .map((effect) => ({
        variable: String(effect.variable || ''),
        op: String(effect.op || ''),
        value: String(effect.value === undefined || effect.value === null ? '' : effect.value),
        source: {},
        status: 'draft'
      }))
      .filter((effect) => effect.variable);
  }

  function seedContextRow(seed) {
    const value = isObject(seed) ? seed : {};
    const raw = value.raw || value.item || value.scene || value;
    if (!isObject(raw)) {
      return null;
    }
    const title = raw.title || raw.name || raw.sceneId || raw.id || value.title;
    const detail = raw.source && raw.source.path || raw.path || raw.sceneId || raw.id || '';
    return title ? {label: String(title), detail: String(detail), direction: 'seed', source: raw.source || raw.sourceSpan || {}} : null;
  }

  function normalizeEffect(effect) {
    const value = isObject(effect) ? effect : {};
    return {
      variable: String(value.variable || '').trim(),
      op: String(value.op || '').trim(),
      value: value.value
    };
  }

  function normalizeParagraphs(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    return String(value || '').split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  }

  function operationSummary(plan) {
    const api = installPlanApi();
    if (api && typeof api.operationSummary === 'function') {
      return api.operationSummary(plan || {operations: []});
    }
    return {safeApply: 0, guardedApply: 0, advancedApply: 0, manualReview: 0, refused: 0, total: 0};
  }

  function changedCountFromValues(values) {
    if (!isObject(values)) {
      return 0;
    }
    return Object.keys(values).length;
  }

  function emptyCanvas(mode, extraDiagnostic, rawContext) {
    return {
      schemaVersion: OBJECT_AUTHORING_CANVAS_VERSION,
      kind: MODEL_KIND,
      ok: false,
      mode: mode || 'unknown',
      objectKind: 'event',
      objectId: '',
      title: '',
      source: {},
      entry: entryInfo(null),
      contextBoard: {flow: [], variables: [], effects: [], assets: [], sourceEvidence: [], manualBoundaries: []},
      eventBody: {mode: mode || 'unknown', title: null, sections: [], options: [], metaFields: []},
      changeState: {
        draft: null,
        proposal: null,
        output: {},
        installPlan: null,
        operationSummary: operationSummary(null),
        changedCount: 0,
        diagnostics: extraDiagnostic ? [extraDiagnostic] : [],
        warnings: []
      },
      legacy: {},
      rawContext: rawContext || null
    };
  }

  function entryInfo(entry) {
    const value = isObject(entry) ? entry : {};
    return {
      source: String(value.source || ''),
      action: String(value.action || ''),
      label: String(value.label || '')
    };
  }

  function sourceRef(ref) {
    const value = isObject(ref) ? ref : {};
    const line = numberOrNull(value.line || value.startLine);
    return {
      path: String(value.path || value.sourcePath || '').trim(),
      line,
      startLine: line,
      endLine: numberOrNull(value.endLine || value.line || value.startLine),
      anchorText: String(value.anchorText || '').trim(),
      endAnchorText: String(value.endAnchorText || '').trim()
    };
  }

  function normalizeDiagnostics(items) {
    return ensureArray(items).map((item) => {
      if (!isObject(item)) {
        return diagnostic('info', 'object_canvas.note', String(item || ''));
      }
      return Object.assign({
        severity: item.severity || item.level || 'info',
        code: item.code || 'object_canvas.note',
        message: item.message || ''
      }, item);
    });
  }

  function diagnostic(severity, code, message) {
    return {severity, level: severity, code, message, confidence: 'static_inferred'};
  }

  function safeId(value) {
    const text = String(value || '').trim()
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return /^[A-Za-z_]/.test(text) ? text : 'event_' + (text || 'draft');
  }

  function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function numberOrNull(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
  }

  function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const api = {
    OBJECT_AUTHORING_CANVAS_VERSION,
    MODEL_KIND,
    buildCanvasModel,
    buildExistingCanvas,
    buildTemplateCanvas,
    buildNewEventCanvas,
    defaultDraftForTemplate,
    templateFromDraft,
    normalizeEventInput,
    draftFromValues
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectAuthoringCanvasModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
