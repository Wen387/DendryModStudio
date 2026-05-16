(function initSurfaceTextDraft(global) {
  'use strict';

  const SURFACE_TEXT_DRAFT_VERSION = '0.1';
  const SURFACE_TEXT_KIND = 'surface_text';
  const EDITABILITY = new Set(['draft_exportable', 'draft_extractable', 'source_patch', 'ide_escape_hatch', 'text_proposal']);
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function normalizeDraft(input) {
    const draft = isObject(input) ? clone(input) : {};
    draft.schemaVersion = String(draft.schemaVersion || SURFACE_TEXT_DRAFT_VERSION);
    draft.kind = String(draft.kind || SURFACE_TEXT_KIND);
    draft.id = String(draft.id || '').trim();
    draft.itemId = String(draft.itemId || '').trim();
    draft.area = String(draft.area || '').trim();
    draft.originalLabel = String(draft.originalLabel || '').trim();
    draft.replacementLabel = String(draft.replacementLabel || '').trim();
    draft.editability = String(draft.editability || 'ide_escape_hatch').trim();
    draft.source = normalizeSource(draft.source);
    draft.reason = String(draft.reason || '').trim();
    return draft;
  }

  function normalizeSource(source) {
    const value = isObject(source) ? source : {};
    const line = Number(value.line || value.startLine || 0);
    const endLine = Number(value.endLine || value.line || value.startLine || 0);
    return {
      path: String(value.path || '').trim(),
      line: Number.isFinite(line) && line > 0 ? line : null,
      endLine: Number.isFinite(endLine) && endLine > 0 ? endLine : null,
      anchorText: String(value.anchorText || '').trim(),
      endAnchorText: String(value.endAnchorText || '').trim()
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function installPlanApi() {
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      return require('./install_plan.js');
    }
    return global ? global.ProjectMapInstallPlan : null;
  }

  function validateDraft(input) {
    const draft = normalizeDraft(input);
    const diagnostics = [];
    if (draft.schemaVersion !== SURFACE_TEXT_DRAFT_VERSION) {
      diag(diagnostics, 'error', 'surface_text_draft.schema_version', 'SurfaceTextDraft schemaVersion must be "0.1".');
    }
    if (draft.kind !== SURFACE_TEXT_KIND) {
      diag(diagnostics, 'error', 'surface_text_draft.kind', 'Only kind "surface_text" is supported in v0.65.');
    }
    if (!ID_RE.test(draft.id)) {
      diag(diagnostics, 'error', 'surface_text_draft.id', 'Draft id must match /^[A-Za-z_][A-Za-z0-9_]*$/.');
    }
    if (!draft.originalLabel) {
      diag(diagnostics, 'error', 'surface_text_draft.original_label', 'originalLabel is required.');
    }
    if (!draft.replacementLabel) {
      diag(diagnostics, 'error', 'surface_text_draft.replacement_label', 'replacementLabel is required.');
    }
    if (draft.originalLabel && draft.originalLabel === draft.replacementLabel) {
      diag(diagnostics, 'warning', 'surface_text_draft.same_label', 'Replacement label is the same as the original label.');
    }
    if (!EDITABILITY.has(draft.editability)) {
      diag(diagnostics, 'error', 'surface_text_draft.editability', 'editability must be draft_exportable, draft_extractable, source_patch, ide_escape_hatch, or text_proposal.');
    }
    if (!draft.source.path) {
      diag(diagnostics, 'error', 'surface_text_draft.source_path', 'source.path is required.');
    }
    return {draft, diagnostics, ok: diagnostics.every((item) => item.severity !== 'error')};
  }

  function diag(diagnostics, severity, code, message) {
    diagnostics.push({severity, code, message, confidence: 'exact'});
  }

  function sourceLabel(source) {
    if (!source || !source.path) {
      return '(unknown source)';
    }
    return source.line ? source.path + ':' + source.line : source.path;
  }

  function renderProposal(draft) {
    const lines = [
      'SurfaceTextDraft: ' + draft.id,
      'Status: proposal only / not installed',
      '',
      'Source:',
      sourceLabel(draft.source),
      '',
      'Area:',
      draft.area || '(unknown)',
      '',
      'Replace: ' + draft.originalLabel,
      'With: ' + draft.replacementLabel
    ];
    if (draft.reason) {
      lines.push('', 'Reason:', draft.reason);
    }
    return lines.join('\n') + '\n';
  }

  function renderInstallNotes(draft) {
    const escapeHatch = draft.editability === 'ide_escape_hatch';
    const textProposal = draft.editability === 'text_proposal';
    const lines = [
      'Install Assistant: proposal only / not installed',
      '',
      'Export bundle files:',
      '- ' + draft.id + '.surface-text-proposal.txt',
      '- ' + draft.id + '.surface-text-draft.json',
      '- ' + draft.id + '.install-plan.json',
      '- ' + draft.id + '.patch-preview.diff',
      '- ' + draft.id + '.install-notes.txt',
      '',
      'Generated files:',
      '- Review the replacement proposal before editing project files.',
      '- Keep the draft JSON if you want to reopen this proposal later.',
      '',
      'Where to copy/paste:',
      '- Source evidence: ' + sourceLabel(draft.source),
      '- Original label: ' + draft.originalLabel,
      '- Suggested replacement: ' + draft.replacementLabel,
      '',
      'Variables/init/migration:',
      '- Not applicable for SurfaceTextDraft v0.1.',
      '',
      'Validation command:',
      'bash tools/build_and_validate.sh --skip-build --errors-only',
      '',
      'Studio source review:'
    ];
    if (escapeHatch) {
      lines.push(
        '- Studio needs a source owner before it can build an executable patch for this item.',
        '- This evidence is generated, runtime-owned, or too ambiguous for a guarded replacement.',
        '- Use a source-backed owner, source slice, or profile rule before applying this visible text change.'
      );
    } else if (textProposal) {
      lines.push(
        '- Text proposal: review the suggested replacement as a proposal-first edit before changing source.',
        isSingleLineSource(draft.source)
          ? '- Install Assistant can guarded-apply this single-line source-backed proposal if the original text still matches.'
          : '- This item stays manual review because Text Corpus prose can span authored context beyond one indexed label.',
        '- Use the patch preview before applying any guarded replacement.'
      );
    } else {
      lines.push(
        '- Studio can prepare this source-backed replacement inside Review & Apply.',
        '- Install Assistant can dry-run and apply this replacement if the original label still matches.',
        '- Use the patch preview before applying.'
      );
    }
    return lines.join('\n') + '\n';
  }

  function isSingleLineSource(source) {
    return Boolean(source && source.line && (!source.endLine || source.endLine === source.line));
  }

  function buildExportBundle(input, projectIndex) {
    const validation = validateDraft(input);
    const draft = validation.draft;
    const proposal = renderProposal(draft);
    const draftJson = JSON.stringify(draft, null, 2) + '\n';
    const installApi = installPlanApi();
    const plan = installApi.surfaceTextInstallPlan(draft, {
      project: installApi.projectProvenanceFromIndex ? installApi.projectProvenanceFromIndex(projectIndex) : null
    });
    const installPlanJson = installApi.renderInstallPlanJson(plan);
    const patchPreview = installApi.renderPatchPreview(plan);
    const installChecklist = installApi.renderOperationChecklist(plan);
    const installNotes = renderInstallNotes(draft);
    const files = [
      {path: draft.id + '.surface-text-proposal.txt', content: proposal, kind: 'proposal'},
      {path: draft.id + '.surface-text-draft.json', content: draftJson, kind: 'draft'},
      {path: draft.id + '.install-plan.json', content: installPlanJson, kind: 'install_plan'},
      {path: draft.id + '.patch-preview.diff', content: patchPreview, kind: 'patch_preview'},
      {path: draft.id + '.install-notes.txt', content: installNotes, kind: 'notes'}
    ];
    return {
      draft,
      diagnostics: validation.diagnostics,
      ok: validation.ok,
      files,
      proposal,
      draftJson,
      installPlan: plan,
      installPlanJson,
      patchPreview,
      installChecklist,
      installNotes
    };
  }

  const api = {
    SURFACE_TEXT_DRAFT_VERSION,
    normalizeDraft,
    validateDraft,
    renderProposal,
    buildExportBundle,
    build: buildExportBundle,
    generate: buildExportBundle,
    sourceLabel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSurfaceTextDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
