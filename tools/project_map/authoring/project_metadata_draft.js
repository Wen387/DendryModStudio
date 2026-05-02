(function initProjectMapProjectMetadataDraft(global) {
  'use strict';

  const PROJECT_METADATA_VERSION = '0.1';
  const PROJECT_METADATA_KIND = 'project_metadata';
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const IFID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const FIELD_ORDER = ['title', 'author', 'ifid'];

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
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

  function buildMetadataModel(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const project = isObject(index.project) ? index.project : {};
    const info = isObject(project.info) ? project.info : {};
    const infoSource = isObject(project.infoSource) ? project.infoSource : {};
    const fields = {};
    FIELD_ORDER.forEach((key) => {
      const exists = Object.prototype.hasOwnProperty.call(info, key);
      const source = isObject(infoSource[key]) ? infoSource[key] : {};
      const value = exists ? String(info[key] || '') : (key === 'title' ? String(project.name || '') : '');
      fields[key] = {
        key,
        value,
        exists,
        path: 'source/info.dry',
        line: sourceLine(source),
        anchorText: String(source.anchorText || (exists ? metadataLine(key, value) : '')).trim()
      };
    });
    return {
      schemaVersion: PROJECT_METADATA_VERSION,
      kind: 'project_metadata_model',
      project: {
        name: String(project.name || info.title || ''),
        root: String(project.root || ''),
        profileIds: Array.isArray(project.profileIds) ? project.profileIds.map(String) : []
      },
      path: 'source/info.dry',
      fields,
      hasLineEvidence: FIELD_ORDER.some((key) => Boolean(fields[key].line && fields[key].anchorText))
    };
  }

  function defaultDraft(projectIndex) {
    const model = buildMetadataModel(projectIndex);
    return normalizeDraft({
      id: 'project_metadata_update',
      title: 'Game Info Update',
      gameTitle: model.fields.title.value || model.project.name || 'Untitled Dendry Project',
      author: model.fields.author.value || '',
      ifid: model.fields.ifid.value || '',
      evidence: model
    });
  }

  function normalizeDraft(input) {
    const draft = isObject(input) ? clone(input) : {};
    draft.schemaVersion = String(draft.schemaVersion || PROJECT_METADATA_VERSION);
    draft.kind = PROJECT_METADATA_KIND;
    draft.id = safeId(draft.id || 'project_metadata_update');
    draft.title = String(draft.title || 'Game Info Update').trim();
    draft.gameTitle = singleLine(draft.gameTitle || draft.projectTitle || draft.rootTitle || '');
    draft.author = singleLine(draft.author || '');
    draft.ifid = singleLine(draft.ifid || '').toLowerCase();
    draft.evidence = isObject(draft.evidence) ? draft.evidence : {};
    return draft;
  }

  function validateDraft(input) {
    const draft = normalizeDraft(input);
    const diagnostics = [];
    if (!ID_RE.test(draft.id)) {
      diagnostic(diagnostics, 'error', 'project_metadata.id', 'Game Info draft id must be file-safe.');
    }
    if (!draft.gameTitle) {
      diagnostic(diagnostics, 'error', 'project_metadata.title', 'Game title is required.');
    }
    if (!draft.author) {
      diagnostic(diagnostics, 'warning', 'project_metadata.author', 'Author is empty; Dendry HTML headers and save keys usually include it.');
    }
    if (draft.ifid && !IFID_RE.test(draft.ifid)) {
      diagnostic(diagnostics, 'error', 'project_metadata.ifid', 'IFID must be a UUID-style identifier, or left unchanged/empty.');
    }
    return {ok: diagnostics.every((item) => item.severity !== 'error'), draft, diagnostics};
  }

  function buildExportBundle(input, projectIndex) {
    const validation = validateDraft(input);
    const draft = validation.draft;
    const plan = buildInstallPlan(draft, projectIndex);
    const installApi = installPlanApi();
    const installPlanJson = installApi.renderInstallPlanJson(plan);
    const patchPreview = installApi.renderPatchPreview(plan);
    const installChecklist = installApi.renderOperationChecklist(plan);
    const draftJson = JSON.stringify(draft, null, 2) + '\n';
    const playerPreview = renderPlayerPreview(draft);
    const installNotes = renderInstallNotes(draft, plan);
    return {
      ok: validation.ok,
      draft,
      diagnostics: validation.diagnostics,
      files: [
        {path: draft.id + '.project-metadata-draft.json', content: draftJson, kind: 'draft'},
        {path: draft.id + '.project-metadata-preview.txt', content: playerPreview, kind: 'preview'},
        {path: draft.id + '.install-plan.json', content: installPlanJson, kind: 'install_plan'},
        {path: draft.id + '.patch-preview.diff', content: patchPreview, kind: 'patch_preview'},
        {path: draft.id + '.install-notes.txt', content: installNotes, kind: 'notes'}
      ],
      playerPreview,
      previewText: playerPreview,
      draftJson,
      installPlan: plan,
      installPlanJson,
      patchPreview,
      installChecklist,
      installNotes
    };
  }

  function buildInstallPlan(input, projectIndex) {
    const installApi = installPlanApi();
    const validation = validateDraft(input);
    const draft = validation.draft;
    const errors = validation.diagnostics.filter((item) => item.severity === 'error');
    if (errors.length) {
      return installApi.buildInstallPlan({
        id: draft.id,
        draftKind: PROJECT_METADATA_KIND,
        title: draft.title || draft.id,
        project: installApi.projectProvenanceFromIndex ? installApi.projectProvenanceFromIndex(projectIndex) : null,
        operations: [{
          id: 'project_metadata_validation_manual',
          type: 'manual_snippet',
          path: 'source/info.dry',
          content: errors.map((item) => item.message).join('\n') + '\n',
          safety: 'manual_review',
          role: 'project_metadata',
          description: 'Fix Game Info validation errors before applying metadata changes.'
        }]
      });
    }
    const evidence = isObject(draft.evidence) && draft.evidence.kind === 'project_metadata_model'
      ? draft.evidence
      : buildMetadataModel(projectIndex);
    const fields = isObject(evidence.fields) ? evidence.fields : {};
    const desired = {
      title: draft.gameTitle,
      author: draft.author,
      ifid: draft.ifid
    };
    const operations = [];
    const lineByKey = {};
    FIELD_ORDER.forEach((key) => {
      const field = isObject(fields[key]) ? fields[key] : {};
      if (field.exists && field.anchorText) {
        lineByKey[key] = field.anchorText;
      }
    });

    FIELD_ORDER.forEach((key) => {
      const value = desired[key];
      if (!value) {
        return;
      }
      const field = isObject(fields[key]) ? fields[key] : {};
      const nextLine = metadataLine(key, value);
      if (field.exists) {
        if (String(field.value || '') === value) {
          lineByKey[key] = field.anchorText || nextLine;
          return;
        }
        if (field.line && field.anchorText) {
          operations.push({
            id: 'project_metadata_' + key,
            type: 'replace_text',
            path: 'source/info.dry',
            line: field.line,
            search: field.anchorText,
            replace: nextLine,
            safety: 'guarded_apply',
            role: 'project_metadata.' + key,
            description: 'Replace source/info.dry ' + key + ' after exact line evidence matches.'
          });
          lineByKey[key] = nextLine;
        } else {
          operations.push(manualMetadataOperation(key, nextLine, 'Existing source line evidence is missing for ' + key + '.'));
        }
        return;
      }
      const anchor = insertionAnchor(key, lineByKey, fields);
      if (anchor && anchor.anchorText) {
        operations.push({
          id: 'project_metadata_' + key + '_insert',
          type: 'insert_text',
          path: 'source/info.dry',
          anchorText: anchor.anchorText,
          position: anchor.position,
          content: nextLine + '\n',
          dedupeSearch: key + ':',
          safety: 'guarded_apply',
          role: 'project_metadata.' + key,
          description: 'Insert source/info.dry ' + key + ' after matching a known metadata anchor.'
        });
        lineByKey[key] = nextLine;
      } else {
        operations.push(manualMetadataOperation(key, nextLine, 'No exact source/info.dry anchor was found for inserting ' + key + '.'));
      }
    });

    if (!operations.length) {
      operations.push({
        id: 'project_metadata_noop',
        type: 'manual_snippet',
        path: 'source/info.dry',
        content: 'No Game Info fields changed.\n',
        safety: 'manual_review',
        role: 'project_metadata',
        description: 'No installable Game Info change was generated.'
      });
    }

    return installApi.buildInstallPlan({
      id: draft.id,
      draftKind: PROJECT_METADATA_KIND,
      title: draft.title || draft.id,
      project: installApi.projectProvenanceFromIndex ? installApi.projectProvenanceFromIndex(projectIndex) : null,
      operations
    });
  }

  function insertionAnchor(key, lineByKey, fields) {
    const index = FIELD_ORDER.indexOf(key);
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const prior = FIELD_ORDER[cursor];
      if (lineByKey[prior]) {
        return {anchorText: lineByKey[prior], position: 'after'};
      }
    }
    for (let cursor = index + 1; cursor < FIELD_ORDER.length; cursor += 1) {
      const next = FIELD_ORDER[cursor];
      const field = isObject(fields[next]) ? fields[next] : {};
      if (field.anchorText) {
        return {anchorText: field.anchorText, position: 'before'};
      }
    }
    return null;
  }

  function manualMetadataOperation(key, line, reason) {
    return {
      id: 'project_metadata_' + key + '_manual',
      type: 'manual_snippet',
      path: 'source/info.dry',
      content: line + '\n',
      safety: 'manual_review',
      role: 'project_metadata.' + key,
      description: reason
    };
  }

  function renderPlayerPreview(draftInput) {
    const draft = normalizeDraft(draftInput);
    return [
      'Game Info',
      'Title: ' + (draft.gameTitle || '(missing title)'),
      'Author: ' + (draft.author || '(missing author)'),
      'IFID: ' + (draft.ifid || '(unchanged / missing)'),
      '',
      'Runtime header after rebuild:',
      (draft.gameTitle || '(missing title)') + (draft.author ? ' by ' + draft.author : ''),
      '',
      'Save-key warning: changing title or author can make old local saves appear under a different key.'
    ].join('\n') + '\n';
  }

  function renderInstallNotes(draftInput, plan) {
    const draft = normalizeDraft(draftInput);
    return [
      'Install Assistant: proposal only / not installed',
      '',
      'Game Info draft: ' + draft.id,
      '',
      'Generated operations:',
      (plan.operations || []).map((op) => '- ' + op.type + ' ' + op.path + ' (' + op.safety + ')').join('\n') || '- none',
      '',
      'Safety:',
      '- Game Info edits are limited to source/info.dry title, author, and ifid lines.',
      '- Runtime Preview must rebuild generated out/html files; install plans do not edit generated output.',
      '- Changing title or author changes the Dendry local-save prefix.'
    ].join('\n') + '\n';
  }

  function generateIfid() {
    if (global && global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    const bytes = [];
    for (let index = 0; index < 16; index += 1) {
      bytes.push(Math.floor(Math.random() * 256));
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20)
    ].join('-');
  }

  function metadataLine(key, value) {
    return key + ': ' + singleLine(value);
  }

  function sourceLine(source) {
    const line = Number(source && (source.line || source.startLine || source.$line) || 0);
    return Number.isFinite(line) && line > 0 ? Math.floor(line) : null;
  }

  function safeId(value) {
    let text = String(value || 'project_metadata_update')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!text) {
      text = 'project_metadata_update';
    }
    if (!/^[A-Za-z_]/.test(text)) {
      text = 'metadata_' + text;
    }
    return ID_RE.test(text) ? text : 'project_metadata_update';
  }

  function singleLine(value) {
    return String(value || '').replace(/[\r\n]+/g, ' ').trim();
  }

  function diagnostic(diagnostics, severity, code, message) {
    diagnostics.push({severity, code, message, confidence: 'exact'});
  }

  const api = {
    PROJECT_METADATA_VERSION,
    PROJECT_METADATA_KIND,
    buildMetadataModel,
    defaultDraft,
    normalizeDraft,
    validateDraft,
    buildExportBundle,
    buildInstallPlan,
    renderPlayerPreview,
    generateIfid
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapProjectMetadataDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
