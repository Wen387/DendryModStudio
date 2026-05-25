// @ts-check
(function initProjectMapObjectDeleteProposalModel(global) {
  'use strict';

  function buildProposal(input) {
    const opts = input && typeof input === 'object' ? input : {};
    const model = opts.model || {};
    const source = normalizeSource(model.source || {});
    const sceneId = String(model.objectId || opts.item || '').trim();
    const sceneKind = String(model.objectKind || '').trim() === 'card' ? 'card' : 'event';
    const title = String(model.title || sceneId || '').trim();
    return normalizeProposal({
      schemaVersion: '0.1',
      kind: 'existing_scene_delete',
      id: 'delete_' + safeDraftId(sceneId || sceneKind),
      title: 'Delete ' + (title || sceneId || sceneKind),
      sceneId,
      sceneKind,
      view: sceneKind === 'card' ? 'cards' : 'events',
      source,
      references: collectReferences(model, sceneId, source.path, opts.projectIndex),
      reviewNote: 'Manual deletion review for ' + sceneKind + ' ' + sceneId + '.',
      studioAuthoringContext: {
        workspace: 'content',
        surface: 'content_storyboard',
        action: 'delete_current_object',
        selectedCanvasNode: opts.selectedCanvasNode || (sceneKind + ':' + sceneId),
        view: opts.view || (sceneKind === 'card' ? 'cards' : 'events')
      }
    }, model);
  }

  function buildModel(input) {
    const opts = input && typeof input === 'object' ? input : {};
    const t = translateFn(opts.translate);
    const installApi = opts.installPlanApi || null;
    const proposal = normalizeProposal(opts.proposal, opts.model);
    const plan = buildInstallPlan(proposal, {
      projectIndex: opts.projectIndex,
      installPlanApi: installApi,
      translate: t
    });
    const preview = deletePreviewText(proposal, t);
    const output = {
      ok: true,
      draft: proposal,
      playerPreview: preview,
      previewText: preview,
      proposalText: preview,
      installPlan: plan,
      installPlanJson: installApi && typeof installApi.renderInstallPlanJson === 'function' ? installApi.renderInstallPlanJson(plan) : JSON.stringify(plan, null, 2) + '\n',
      patchPreview: installApi && typeof installApi.renderPatchPreview === 'function' ? installApi.renderPatchPreview(plan) : '',
      installChecklist: installApi && typeof installApi.renderOperationChecklist === 'function' ? installApi.renderOperationChecklist(plan, {locale: opts.locale || 'en'}) : '',
      installNotes: preview
    };
    return {
      schemaVersion: '0.1',
      kind: 'object_authoring_canvas_model',
      ok: true,
      mode: 'existing',
      template: 'existing',
      templateLabel: proposal.sceneKind === 'card' ? t('objectPreview.card', 'Card') : t('objectPreview.event', 'World Event'),
      objectKind: proposal.sceneKind,
      objectId: proposal.sceneId,
      title: proposal.title,
      source: proposal.source,
      entry: {source: 'Delete', action: 'delete_current_object', label: ''},
      contextBoard: {
        flow: proposal.references.map((ref) => ({
          label: ref.label || ref.kind,
          detail: [ref.kind, ref.detail].filter(Boolean).join(' / '),
          direction: ref.kind === 'incoming' ? 'incoming' : ref.kind === 'outgoing' ? 'outgoing' : 'manual_review',
          source: ref.source || {}
        })),
        variables: [],
        effects: [],
        assets: [],
        sourceEvidence: [{label: 'delete target', path: proposal.source.path || '', line: proposal.source.line || null, status: 'manual_review'}],
        manualBoundaries: [{label: 'Delete source object', reason: 'Deletion requires reviewing all routes, references, and variable consumers before changing files.', status: 'manual_review', source: proposal.source}]
      },
      eventBody: {
        mode: 'delete_existing',
        bodyEyebrow: t('objectCanvas.deleteProposal', 'Delete proposal'),
        title: readOnlyField('delete.title', t('objectCanvas.deleteTarget', 'Delete target'), proposal.title),
        sections: [readOnlyField('delete.review', t('objectCanvas.deleteReview', 'Review checklist'), preview, {inputType: 'textarea'})],
        options: [],
        metaFields: [
          readOnlyField('delete.sceneId', t('existingScene.sceneId', 'Scene'), proposal.sceneId),
          readOnlyField('delete.sceneKind', t('existingScene.kind', 'Kind'), proposal.sceneKind),
          readOnlyField('delete.source', t('existingScene.source', 'Source'), sourceLabel(proposal.source)),
          readOnlyField('delete.references', t('objectCanvas.deleteReferences', 'References to check'), String(proposal.references.length))
        ]
      },
      changeState: {
        draft: proposal,
        proposal,
        output,
        installPlan: plan,
        operationSummary: installApi && typeof installApi.operationSummary === 'function' ? installApi.operationSummary(plan) : {safeApply: 0, guardedApply: 0, advancedApply: 0, manualReview: 1, refused: 0, total: 1},
        changedCount: 1,
        diagnostics: [{severity: 'warning', level: 'warning', code: 'object_canvas.delete_manual_review', message: t('objectCanvas.deleteManualReview', 'Deletion is manual-review only; Studio will not remove source automatically.')}],
        warnings: [t('objectCanvas.deleteManualReview', 'Deletion is manual-review only; Studio will not remove source automatically.')]
      },
      legacy: {template: 'existing'},
      rawContext: null
    };
  }

  function normalizeProposal(input, model) {
    const value = input && typeof input === 'object' ? input : {};
    const sceneId = String(value.sceneId || model && model.objectId || '').trim();
    const sceneKind = String(value.sceneKind || model && model.objectKind || '').trim() === 'card' ? 'card' : 'event';
    const title = String(value.title || 'Delete ' + (model && model.title || sceneId || sceneKind)).trim();
    return {
      schemaVersion: String(value.schemaVersion || '0.1'),
      kind: 'existing_scene_delete',
      id: safeDraftId(value.id || 'delete_' + (sceneId || sceneKind)),
      title,
      sceneId,
      sceneKind,
      view: String(value.view || (sceneKind === 'card' ? 'cards' : 'events')).trim(),
      source: normalizeSource(value.source || model && model.source || {}),
      references: ensureArray(value.references).map(normalizeReference),
      reviewNote: String(value.reviewNote || '').trim(),
      studioAuthoringContext: value.studioAuthoringContext || value.authoringContext || {}
    };
  }

  function buildInstallPlan(proposal, options) {
    const opts = options || {};
    const installApi = opts.installPlanApi || null;
    const t = translateFn(opts.translate);
    const rawPlan = {
      id: proposal.id,
      draftKind: 'existing_scene_delete',
      title: proposal.title,
      project: installApi && typeof installApi.projectProvenanceFromIndex === 'function' ? installApi.projectProvenanceFromIndex(opts.projectIndex) : null,
      operations: [{
        id: 'existing_scene_delete_review',
        type: 'manual_snippet',
        path: proposal.source.path || ('source/scenes/events/' + (proposal.sceneId || 'scene') + '.scene.dry'),
        content: deletePreviewText(proposal, t),
        safety: 'manual_review',
        role: 'existing_scene.delete_review',
        description: 'Review and delete this existing event or card after checking every route and reference.'
      }]
    };
    return installApi && typeof installApi.buildInstallPlan === 'function'
      ? installApi.buildInstallPlan(rawPlan)
      : Object.assign({schemaVersion: '0.1', kind: 'install_plan', status: 'proposal_only'}, rawPlan);
  }

  function deletePreviewText(proposal, translate) {
    const t = translateFn(translate);
    const rows = [
      deleteText(t, 'objectCanvas.deletePreview.header', 'Delete existing {kind}: {id}', {kind: proposal.sceneKind, id: proposal.sceneId}),
      deleteText(t, 'objectCanvas.deletePreview.title', 'Title: {title}', {title: proposal.title.replace(/^Delete\s+/, '')}),
      deleteText(t, 'objectCanvas.deletePreview.source', 'Source: {source}', {source: sourceLabel(proposal.source) || '(unknown)'}),
      '',
      t('objectCanvas.deletePreview.checklist', 'Manual review checklist:'),
      '- ' + t('objectCanvas.deletePreview.incoming', 'Remove or archive the source scene only after every incoming route has been rewired.'),
      '- ' + t('objectCanvas.deletePreview.outgoing', 'Check outgoing routes and scheduled triggers so follow-up content still has an owner.'),
      '- ' + t('objectCanvas.deletePreview.state', 'Check Q variables and effects referenced by this object before removing related state.'),
      ''
    ];
    if (proposal.references.length) {
      rows.push(t('objectCanvas.deletePreview.references', 'References to inspect:'));
      proposal.references.slice(0, 16).forEach((ref) => {
        rows.push('- ' + [ref.kind, ref.label, ref.detail, sourceLabel(ref.source)].filter(Boolean).join(' / '));
      });
    } else {
      rows.push(t('objectCanvas.deletePreview.noReferences', 'References to inspect: none found in the current ProjectIndex.'));
    }
    return rows.join('\n') + '\n';
  }

  function deleteText(t, key, fallback, replacements) {
    let value = t(key, fallback);
    Object.keys(replacements || {}).forEach((name) => {
      value = value.replace('{' + name + '}', String(replacements[name] || ''));
    });
    return value;
  }

  function collectReferences(model, sceneId, sourcePath, projectIndex) {
    const rows = [];
    const relationships = model && model.rawContext && model.rawContext.relationships || {};
    ['incoming', 'internal', 'outgoing'].forEach((key) => {
      ensureArray(relationships[key]).forEach((row) => {
        rows.push(normalizeReference({
          kind: key,
          label: row.label || row.from || row.to || row.kind || '',
          detail: row.kind || row.condition || row.to || row.from || '',
          source: row.source || row.scene && row.scene.source || {}
        }));
      });
    });
    ensureArray(projectIndex && projectIndex.scenes).forEach((scene) => {
      const id = String(scene && scene.id || '');
      const path = String(scene && (scene.path || scene.sourcePath || scene.sourceSpan && scene.sourceSpan.path) || '');
      if (!sceneId || id === sceneId || path === sourcePath) {
        return;
      }
      let text = '';
      try {
        text = JSON.stringify(scene);
      } catch (_err) {
        text = '';
      }
      if (text && text.indexOf(sceneId) >= 0) {
        rows.push(normalizeReference({
          kind: 'indexed reference',
          label: scene.title || id,
          detail: id,
          source: scene.sourceSpan || {path}
        }));
      }
    });
    const seen = new Set();
    return rows.filter((row) => {
      const key = [row.kind, row.label, sourceLabel(row.source)].join('::');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function normalizeReference(ref) {
    const value = ref && typeof ref === 'object' ? ref : {};
    return {
      kind: String(value.kind || 'reference').trim(),
      label: String(value.label || '').trim(),
      detail: String(value.detail || '').trim(),
      source: normalizeSource(value.source || {})
    };
  }

  function readOnlyField(id, label, value, extra) {
    const textValue = value === undefined || value === null ? '' : String(value);
    return Object.assign({
      id,
      label,
      original: textValue,
      value: textValue,
      status: 'manual_review',
      editability: 'manual_review',
      readOnly: true,
      source: {}
    }, extra || {});
  }

  function normalizeSource(source) {
    const value = source && typeof source === 'object' ? source : {};
    const line = Number(value.line || value.startLine || 0);
    return {
      path: String(value.path || value.sourcePath || '').trim(),
      line: Number.isFinite(line) && line > 0 ? Math.floor(line) : null
    };
  }

  function sourceLabel(source) {
    const value = normalizeSource(source);
    return value.path ? value.path + (value.line ? ':' + value.line : '') : '';
  }

  function safeDraftId(value) {
    return String(value || 'draft')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'draft';
  }

  function translateFn(fn) {
    return typeof fn === 'function' ? fn : identityTranslate;
  }

  function identityTranslate(_key, fallback) {
    return fallback;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  const api = {buildProposal, buildModel, normalizeProposal, buildInstallPlan, deletePreviewText, collectReferences};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectDeleteProposalModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
