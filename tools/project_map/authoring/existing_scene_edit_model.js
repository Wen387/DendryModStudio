(function initProjectMapExistingSceneEdit(global) {
  'use strict';

  const EXISTING_SCENE_EDIT_VERSION = '0.1';
  const MODEL_KIND = 'existing_scene_edit_model';
  const PROPOSAL_KIND = 'existing_scene_edit';
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

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

  function eventWorkbenchApi() {
    if (global && global.ProjectMapEventWorkbench) {
      return global.ProjectMapEventWorkbench;
    }
    if (typeof require === 'function') {
      try {
        return require('./event_workbench_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function buildEditModel(projectIndex, view, itemOrId, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const lookup = buildLookup(index);
    const scene = resolveScene(lookup, view, itemOrId);
    const diagnostics = [];
    if (!scene || !scene.id) {
      return {
        schemaVersion: EXISTING_SCENE_EDIT_VERSION,
        kind: MODEL_KIND,
        ok: false,
        sceneId: String(itemOrId || ''),
        sceneKind: normalizeSceneKind(view, null, lookup),
        fields: [],
        options: [],
        sections: [],
        effects: [],
        assets: [],
        diagnostics: [diagnostic('warning', 'existing_scene_edit.not_found', 'No source-backed Event/Card scene was found.')]
      };
    }
    const sceneKind = normalizeSceneKind(view, scene, lookup);
    const source = sourceRef(scene.sourceSpan || scene.topLevelSpan || {path: scene.path});
    if (!source.path) {
      diagnostics.push(diagnostic('warning', 'existing_scene_edit.no_source', 'This scene has no source path, so Studio can only show a read-only editor.'));
    }
    const textRows = textRowsForScene(lookup, scene, source.path);
    const scriptRows = textRows.filter(isEffectScriptRow);
    const textFields = textRows
      .filter((row) => !isEffectScriptRow(row))
      .map((row, index) => fieldFromTextRow(row, index, source.path));
    const fields = textFields.concat(metadataEditableFields(scene, source.path));
    if (!fields.length) {
      diagnostics.push(diagnostic('warning', 'existing_scene_edit.no_text_rows', 'No source-backed Text Corpus rows were found for this scene.'));
    }
    const fieldById = new Map(fields.map((field) => [field.id, field]));
    const eventOptions = optionRows(scene, fields);
    return {
      schemaVersion: EXISTING_SCENE_EDIT_VERSION,
      kind: MODEL_KIND,
      ok: true,
      sceneId: String(scene.id || ''),
      sceneKind,
      title: String(scene.title || scene.id || ''),
      source,
      profileIds: ensureArray(index.project && index.project.profileIds).map(String),
      fields,
      options: eventOptions,
      sections: sectionRows(fields, eventOptions),
      effects: effectRows(index, scene, scriptRows),
      assets: ensureArray(scene.assetRefs).map(normalizeAssetRef).filter(Boolean),
      warnings: diagnostics.map((item) => item.message),
      diagnostics,
      metadata: metadataRows(scene, source, fieldById),
      advanced: {
        tags: ensureArray(scene.tags).map(String),
        rawViewIf: String(scene.viewIf || ''),
        path: source.path
      },
      editorOptions: isObject(options) ? options : {}
    };
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
      events: ensureArray(index.semantic && index.semantic.events),
      cards: ensureArray(index.semantic && index.semantic.cards),
      textCorpus: ensureArray(index.semantic && index.semantic.textCorpus && index.semantic.textCorpus.items)
    };
  }

  function resolveScene(lookup, view, itemOrId) {
    if (isObject(itemOrId)) {
      if (itemOrId.scene && itemOrId.scene.id) {
        return itemOrId.scene;
      }
      const id = itemOrId.sceneId || itemOrId.linkedSceneId || itemOrId.id;
      if (id && lookup.scenesById.has(String(id))) {
        return lookup.scenesById.get(String(id));
      }
      if (itemOrId.id || itemOrId.sourceSpan || itemOrId.path) {
        return itemOrId;
      }
    }
    const id = String(itemOrId || '');
    if (!id) {
      return null;
    }
    const semantic = String(view || '') === 'cards' ? lookup.cards : lookup.events;
    const ref = semantic.find((item) => item && String(item.id || '') === id);
    if (ref && lookup.scenesById.has(id)) {
      return lookup.scenesById.get(id);
    }
    return lookup.scenesById.get(id) || null;
  }

  function normalizeSceneKind(view, scene, lookup) {
    const text = String(view || '').trim();
    if (text === 'cards' || text === 'card') {
      return 'card';
    }
    if (text === 'events' || text === 'event' || text === 'news') {
      return 'event';
    }
    const id = String(scene && scene.id || '');
    if (lookup && lookup.cards.some((item) => item && String(item.id || '') === id)) {
      return 'card';
    }
    return 'event';
  }

  function textRowsForScene(lookup, scene, sourcePath) {
    const sceneId = String(scene.id || '');
    const span = scene.sourceSpan || scene.topLevelSpan || {};
    return lookup.textCorpus
      .filter((item) => item && item.owner && String(item.owner.sceneId || '') === sceneId)
      .filter((item) => {
        const path = String(item.source && item.source.path || '');
        return !path || !sourcePath || path === sourcePath;
      })
      .filter((item) => {
        const line = sourceLine(item.source);
        if (!line || !span.startLine || !span.endLine) {
          return true;
        }
        return line >= Number(span.startLine) && line <= Number(span.endLine);
      })
      .sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
  }

  function fieldFromTextRow(row, index, sceneSourcePath) {
    const owner = isObject(row.owner) ? row.owner : {};
    const source = sourceRef(row.source || {});
    const id = safeId(row.id || [row.role || 'text', owner.sectionId || '', owner.itemId || '', source.line || index + 1].filter(Boolean).join('_'));
    const original = String(row.text || '');
    const guarded = canGuardField(source, original);
    return {
      id,
      role: String(row.role || 'text'),
      label: roleLabel(row.role),
      original,
      value: original,
      source,
      sourcePath: source.path || sceneSourcePath || '',
      editability: guarded ? 'guarded_replace_text' : 'manual_review',
      owner: {
        sceneId: String(owner.sceneId || ''),
        sectionId: String(owner.sectionId || ''),
        itemId: String(owner.itemId || row.optionId || ''),
        kind: String(owner.kind || '')
      },
      sectionId: String(owner.sectionId || ''),
      optionId: String(owner.itemId || row.optionId || ''),
      confidence: row.confidence || '',
      reason: guarded
        ? 'Exact source line can be checked before replacement.'
        : 'Needs IDE review because Studio lacks safe single-line source evidence.'
    };
  }

  function canGuardField(source, original) {
    const path = String(source && source.path || '');
    const line = Number(source && (source.line || source.startLine) || 0);
    const endLine = Number(source && (source.endLine || source.line || source.startLine) || line || 0);
    return Boolean(
      path.startsWith('source/scenes/') &&
      path.endsWith('.scene.dry') &&
      !isProtectedRouterPath(path) &&
      Number.isInteger(line) &&
      line > 0 &&
      (!Number.isInteger(endLine) || endLine <= 0 || endLine === line) &&
      String(original || '').trim()
    );
  }

  function optionRows(scene, fields) {
    return ensureArray(scene.options).map((option, index) => {
      const target = isObject(option.target) ? option.target : {};
      const id = safeId(target.id || option.id || 'option_' + (index + 1));
      const parts = splitOptionTitle(option.title || '');
      const labelField = findOptionField(fields, id, 'option_label', parts.label);
      const subtitleField = findOptionField(fields, id, 'option_subtitle', parts.subtitle);
      const unavailableField = findOptionField(fields, id, 'unavailable_text', option.unavailableText || '');
      return {
        id,
        targetId: String(target.id || ''),
        label: labelField ? labelField.original : (parts.label || String(option.title || 'Option ' + (index + 1))),
        subtitle: subtitleField ? subtitleField.original : parts.subtitle,
        labelFieldId: labelField && labelField.id || '',
        subtitleFieldId: subtitleField && subtitleField.id || '',
        unavailableFieldId: unavailableField && unavailableField.id || '',
        chooseIf: String(option.chooseIf || ''),
        unavailableText: unavailableField ? unavailableField.original : String(option.unavailableText || ''),
        source: sourceRef(option.sourceSpan || option.source || {})
      };
    });
  }

  function findOptionField(fields, optionId, role, fallbackText) {
    const exact = fields.find((field) => field.role === role && field.optionId && safeId(field.optionId) === safeId(optionId));
    if (exact) {
      return exact;
    }
    const text = String(fallbackText || '').trim();
    if (!text) {
      return null;
    }
    return fields.find((field) => field.role === role && String(field.original || '').trim() === text) || null;
  }

  function sectionRows(fields, options) {
    const sections = new Map();
    fields.forEach((field) => {
      const key = field.sectionId || 'scene';
      if (!sections.has(key)) {
        sections.set(key, {id: key, label: key === 'scene' ? 'Scene text' : key, fieldIds: [], optionIds: []});
      }
      sections.get(key).fieldIds.push(field.id);
    });
    ensureArray(options).forEach((option) => {
      const key = option.targetId || option.id;
      if (!key) {
        return;
      }
      if (!sections.has(key)) {
        sections.set(key, {id: key, label: option.label || key, fieldIds: [], optionIds: []});
      }
      sections.get(key).optionIds.push(option.id);
    });
    return Array.from(sections.values());
  }

  function metadataRows(scene, source, fieldById) {
    const rows = [
      metadataRow('title', 'Title', scene.title, 'title'),
      metadataRow('viewIf', 'View-if', scene.viewIf, 'condition'),
      metadataRow('priority', 'Priority', scene.priority, 'metadata'),
      metadataRow('frequency', 'Frequency', scene.frequency, 'metadata'),
      metadataRow('maxVisits', 'Max visits', scene.maxVisits, 'metadata')
    ].filter((row) => row.original !== '');
    rows.forEach((row) => {
      const matching = Array.from(fieldById.values()).find((field) => field.role === row.role && field.original === row.original);
      if (matching) {
        row.fieldId = matching.id;
        row.editability = matching.editability;
        row.source = matching.source;
      } else {
        row.editability = 'manual_review';
        row.source = source;
      }
    });
    return rows;
  }

  function metadataRow(id, label, value, role) {
    return {id, label, role, original: String(value === undefined || value === null ? '' : value), value: String(value === undefined || value === null ? '' : value)};
  }

  function metadataEditableFields(scene, sceneSourcePath) {
    const fields = [];
    if (scene && scene.viewIf) {
      fields.push(metadataEditableField({
        id: 'metadata_viewIf',
        role: 'condition',
        label: 'Appearance condition',
        original: scene.viewIf,
        sceneId: scene.id,
        source: metadataSource(scene, 'viewIf', sceneSourcePath),
        reason: 'Exact source line for the scene view-if can be checked before replacement.'
      }));
    }
    return fields.filter(Boolean);
  }

  function metadataEditableField(input) {
    const source = sourceRef(input.source || {});
    const original = String(input.original || '');
    const guarded = canGuardField(source, original);
    return {
      id: safeId(input.id || input.role || 'metadata_field'),
      role: String(input.role || 'metadata'),
      label: String(input.label || roleLabel(input.role)),
      original,
      value: original,
      source,
      sourcePath: source.path || '',
      editability: guarded ? 'guarded_replace_text' : 'manual_review',
      owner: {sceneId: String(input.sceneId || ''), sectionId: '', itemId: '', kind: 'metadata'},
      sectionId: '',
      optionId: '',
      confidence: guarded ? 'exact' : 'approximate',
      reason: guarded
        ? String(input.reason || 'Exact source line can be checked before replacement.')
        : 'Needs IDE review because Studio lacks safe single-line source evidence.'
    };
  }

  function metadataSource(scene, key, fallbackPath) {
    const metadata = isObject(scene && scene.metadata) ? scene.metadata : {};
    const item = isObject(metadata[key]) ? metadata[key] : {};
    return sourceRef({
      path: item.path || fallbackPath || (scene && scene.path) || '',
      line: item.line || item.startLine,
      endLine: item.endLine || item.line || item.startLine
    });
  }

  function effectRows(projectIndex, scene, scriptRows) {
    const api = eventWorkbenchApi();
    if (api && typeof api.buildEventWorkbench === 'function') {
      try {
        const workbench = api.buildEventWorkbench(projectIndex, scene, {});
        const rows = ensureArray(workbench.effects).map((effect) => ({
          variable: String(effect.variable || ''),
          op: String(effect.op || effect.operator || ''),
          value: String(effect.value === undefined || effect.value === null ? '' : effect.value),
          sectionId: String(effect.sectionId || ''),
          source: sourceRef(effect.source || {}),
          evidence: effect.evidence || 'workbench'
        })).filter((effect) => effect.variable);
        if (rows.length) {
          return rows;
        }
      } catch (_err) {
        // Fall through to lightweight script parsing.
      }
    }
    const rows = [];
    scriptRows.forEach((row) => {
      parseEffectText(row.text).forEach((effect) => {
        rows.push(Object.assign(effect, {
          sectionId: row.owner && row.owner.sectionId || '',
          source: sourceRef(row.source || {}),
          evidence: 'script_text'
        }));
      });
    });
    return rows;
  }

  function parseEffectText(text) {
    const rows = [];
    const re = /Q\.([A-Za-z_][A-Za-z0-9_]*)\s*([+\-*/]?=)\s*([^;\n]+)/g;
    let match;
    while ((match = re.exec(String(text || ''))) !== null) {
      rows.push({variable: match[1], op: match[2], value: match[3].trim()});
    }
    return rows;
  }

  function isEffectScriptRow(row) {
    const text = String(row && row.text || '').trim();
    return /^Q\.[A-Za-z_][A-Za-z0-9_]*\s*(?:[+\-*/]?=)/.test(text) ||
      (/(?:^|[;\s])Q\.[A-Za-z_][A-Za-z0-9_]*\s*(?:[+\-*/]?=)/.test(text) && text.includes(';'));
  }

  function buildProposal(modelInput, editedValues, options) {
    const model = isObject(modelInput) ? modelInput : {};
    const values = isObject(editedValues) ? editedValues : {};
    const opts = isObject(options) ? options : {};
    const changes = ensureArray(model.fields).map((field) => {
      const hasEditedValue = Object.prototype.hasOwnProperty.call(values, field.id);
      const after = hasEditedValue ? values[field.id] : field.value;
      if (String(after === undefined || after === null ? '' : after) === String(field.original || '')) {
        return null;
      }
      return {
        fieldId: field.id,
        role: field.role || 'text',
        label: field.label || roleLabel(field.role),
        sectionId: field.sectionId || '',
        optionId: field.optionId || '',
        source: sourceRef(field.source || {}),
        editability: field.editability || 'manual_review',
        before: String(field.original || ''),
        after: String(after === undefined || after === null ? '' : after)
      };
    }).filter(Boolean);
    const diagnostics = [];
    if (!changes.length) {
      diagnostics.push(diagnostic('warning', 'existing_scene_edit.no_changes', 'No changed fields were found yet.'));
    }
    return normalizeProposal({
      schemaVersion: EXISTING_SCENE_EDIT_VERSION,
      kind: PROPOSAL_KIND,
      id: opts.id || safeId('edit_existing_' + (model.sceneId || 'scene')),
      title: model.title || model.sceneId || 'Existing scene edit',
      sceneId: model.sceneId || '',
      sceneKind: model.sceneKind || 'event',
      sourcePath: model.source && model.source.path || '',
      source: model.source || null,
      changes,
      changeSummary: summarizeChanges(changes),
      warnings: ensureArray(model.warnings),
      diagnostics
    });
  }

  function normalizeProposal(input) {
    const value = isObject(input) ? input : {};
    const changes = ensureArray(value.changes).map(normalizeChange).filter((change) => change.before !== change.after);
    return {
      schemaVersion: String(value.schemaVersion || EXISTING_SCENE_EDIT_VERSION),
      kind: PROPOSAL_KIND,
      id: safeId(value.id || 'edit_existing_scene'),
      title: String(value.title || value.sceneId || 'Existing scene edit'),
      sceneId: String(value.sceneId || ''),
      sceneKind: String(value.sceneKind || 'event') === 'card' ? 'card' : 'event',
      sourcePath: String(value.sourcePath || (value.source && value.source.path) || '').trim(),
      source: sourceRef(value.source || {path: value.sourcePath}),
      changes,
      changeSummary: summarizeChanges(changes),
      warnings: ensureArray(value.warnings).map(String).filter(Boolean),
      diagnostics: ensureArray(value.diagnostics)
    };
  }

  function normalizeChange(change, index) {
    const value = isObject(change) ? change : {};
    return {
      fieldId: safeId(value.fieldId || 'field_' + (index + 1)),
      role: String(value.role || 'text'),
      label: String(value.label || roleLabel(value.role)),
      sectionId: String(value.sectionId || ''),
      optionId: String(value.optionId || ''),
      source: sourceRef(value.source || {}),
      editability: String(value.editability || 'manual_review'),
      before: String(value.before === undefined || value.before === null ? '' : value.before),
      after: String(value.after === undefined || value.after === null ? '' : value.after)
    };
  }

  function summarizeChanges(changes) {
    const list = ensureArray(changes);
    return list.reduce((summary, change) => {
      summary.total += 1;
      if (String(change.role || '').includes('metadata') || ['condition'].includes(String(change.role || ''))) {
        summary.metadataFields += 1;
      } else {
        summary.textFields += 1;
      }
      if (change.editability === 'manual_review' || !canGuardField(change.source, change.before)) {
        summary.manualFields += 1;
      }
      return summary;
    }, {total: 0, textFields: 0, metadataFields: 0, manualFields: 0});
  }

  function buildExportBundle(input, projectIndex) {
    const proposal = normalizeProposal(input);
    const installApi = installPlanApi();
    const plan = installApi && typeof installApi.existingSceneEditInstallPlan === 'function'
      ? installApi.existingSceneEditInstallPlan(proposal, {project: installApi.projectProvenanceFromIndex(projectIndex)})
      : null;
    const installPlanJson = installApi && plan && typeof installApi.renderInstallPlanJson === 'function'
      ? installApi.renderInstallPlanJson(plan)
      : JSON.stringify(plan || {}, null, 2) + '\n';
    const patchPreview = installApi && plan && typeof installApi.renderPatchPreview === 'function'
      ? installApi.renderPatchPreview(plan)
      : '';
    const proposalJson = JSON.stringify(proposal, null, 2) + '\n';
    const proposalText = renderProposalText(proposal);
    const fileBase = proposal.id || 'existing_scene_edit';
    return {
      ok: true,
      draft: proposal,
      proposal,
      fileName: fileBase + '.existing-scene-edit.json',
      playerPreview: proposalText,
      previewText: previewText(proposal),
      proposalText,
      proposalJson,
      installPlan: plan,
      installPlanJson,
      patchPreview,
      files: [
        {path: fileBase + '.existing-scene-edit.json', content: proposalJson, kind: 'draft'},
        {path: fileBase + '.proposal.txt', content: proposalText, kind: 'proposal'},
        {path: fileBase + '.install-plan.json', content: installPlanJson, kind: 'install_plan'},
        {path: fileBase + '.patch-preview.diff', content: patchPreview, kind: 'patch'}
      ]
    };
  }

  function renderProposalText(input) {
    const proposal = normalizeProposal(input);
    const lines = [
      previewText(proposal),
      'Source: ' + (proposal.sourcePath || '(unknown source)'),
      'Changed fields: ' + proposal.changes.length,
      ''
    ];
    proposal.changes.forEach((change, index) => {
      lines.push(String(index + 1) + '. ' + (change.label || roleLabel(change.role)) + sourceSuffix(change.source));
      lines.push('Before: ' + change.before);
      lines.push('After: ' + change.after);
      lines.push('');
    });
    if (proposal.warnings.length) {
      lines.push('Warnings:');
      proposal.warnings.forEach((warning) => lines.push('- ' + warning));
      lines.push('');
    }
    return lines.join('\n').replace(/\n+$/, '\n');
  }

  function previewText(proposal) {
    const kind = proposal.sceneKind === 'card' ? 'Card' : 'Event';
    return 'Modify existing ' + kind + ': ' + (proposal.title || proposal.sceneId || '(untitled)') +
      ' (' + proposal.changes.length + ' changed field' + (proposal.changes.length === 1 ? '' : 's') + ')';
  }

  function sourceSuffix(source) {
    const ref = sourceRef(source);
    if (!ref.path) {
      return ' (manual source review)';
    }
    return ' (' + ref.path + (ref.line ? ':' + ref.line : '') + ')';
  }

  function splitOptionTitle(title) {
    const text = String(title || '').trim();
    const parts = text.split('——');
    if (parts.length > 1) {
      return {label: parts[0].trim(), subtitle: parts.slice(1).join('——').trim()};
    }
    return {label: text, subtitle: ''};
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
    return {
      id: item.id ? String(item.id) : '',
      path,
      type: String(item.type || assetType(path)),
      label: String(item.label || item.name || fileName(path) || path),
      role: String(item.role || '').trim()
    };
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

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? Math.floor(num) : null;
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
      unavailable_text: 'Unavailable text',
      metadata: 'Metadata',
      condition: 'Condition'
    };
    return labels[String(role || '')] || String(role || 'Text');
  }

  function isProtectedRouterPath(relPath) {
    const rel = String(relPath || '').replace(/\\/g, '/');
    return rel === 'source/scenes/root.scene.dry' ||
      rel === 'source/scenes/post_event.scene.dry' ||
      rel === 'source/scenes/post_event_news.scene.dry';
  }

  function safeId(value) {
    let text = String(value || 'field')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!text) {
      text = 'field';
    }
    if (!/^[A-Za-z_]/.test(text)) {
      text = 'field_' + text;
    }
    return ID_RE.test(text) ? text : 'field';
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message, confidence: 'static_inferred'};
  }

  const api = {
    EXISTING_SCENE_EDIT_VERSION,
    MODEL_KIND,
    PROPOSAL_KIND,
    buildEditModel,
    buildProposal,
    normalizeProposal,
    buildExportBundle,
    renderProposalText
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapExistingSceneEdit = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
