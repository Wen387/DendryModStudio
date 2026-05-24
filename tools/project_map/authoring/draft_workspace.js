// @ts-check
(function initProjectMapDraftWorkspace(global) {
  'use strict';

  const DRAFT_WORKSPACE_VERSION = '0.1';
  const STORAGE_KEY = 'dendry_mod_studio.draft_workspace.v0.1';
  const MAX_ITEMS = 80;

  function installPlanApi() {
    if (global && global.ProjectMapInstallPlan) {
      return global.ProjectMapInstallPlan;
    }
    if (typeof require === 'function') {
      try {
        return require('./install_plan.js');
      } catch (err) {
        return null;
      }
    }
    return null;
  }

  function makeDraftItem(input, options) {
    const data = isObject(input) ? input : {};
    const opts = isObject(options) ? options : {};
    const draft = cloneObject(data.draft || {});
    const output = cloneObject(data.output || {});
    const template = normalizeTemplate(data.template || draft.template || draft.kind || data.kind);
    const draftId = normalizeId(draft.id || draft.itemId || data.id || template + '_draft');
    const now = opts.now || new Date().toISOString();
    const workspaceId = opts.workspaceId || data.workspaceId || buildWorkspaceId(template, draftId, now);
    const title = titleForDraft(template, draft, data.title);
    const installPlan = output.installPlan || parseJson(output.installPlanJson);
    const installSummary = summarizeInstallPlan(installPlan);
    const previewText = previewTextForOutput(output, draft, template);

    return compactObject({
      schemaVersion: DRAFT_WORKSPACE_VERSION,
      workspaceId,
      template,
      draftId,
      title,
      subtitle: subtitleForDraft(template, draft, output),
      updatedAt: now,
      createdAt: opts.createdAt || data.createdAt || now,
      source: data.source || 'studio',
      draft,
      output,
      installPlan,
      installSummary,
      previewText,
      warnings: ensureArray(data.warnings)
    });
  }

  function loadDraftItems(storage) {
    const driver = storage || defaultStorage();
    if (!driver || typeof driver.getItem !== 'function') {
      return [];
    }
    try {
      const raw = driver.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : ensureArray(parsed.items);
      return normalizeDraftItems(items);
    } catch (err) {
      return [];
    }
  }

  function saveDraftItems(storage, items) {
    const driver = storage || defaultStorage();
    if (!driver || typeof driver.setItem !== 'function') {
      return false;
    }
    const normalized = normalizeDraftItems(items).slice(0, MAX_ITEMS);
    driver.setItem(STORAGE_KEY, JSON.stringify({schemaVersion: DRAFT_WORKSPACE_VERSION, items: normalized}, null, 2));
    return true;
  }

  function upsertDraftItem(items, item) {
    const normalized = makeDraftItem(item, {
      workspaceId: item && item.workspaceId,
      createdAt: item && item.createdAt,
      now: item && item.updatedAt
    });
    const list = normalizeDraftItems(items).filter((entry) => entry.workspaceId !== normalized.workspaceId);
    list.unshift(normalized);
    return list.slice(0, MAX_ITEMS);
  }

  function deleteDraftItem(items, workspaceId) {
    const id = String(workspaceId || '');
    return normalizeDraftItems(items).filter((item) => item.workspaceId !== id);
  }

  function normalizeDraftItems(items) {
    return ensureArray(items)
      .map((item) => {
        if (!isObject(item) || !item.draft) {
          return null;
        }
        try {
          return makeDraftItem(item, {
            workspaceId: item.workspaceId,
            createdAt: item.createdAt,
            now: item.updatedAt || item.createdAt
          });
        } catch (err) {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }

  function normalizeTemplate(value) {
    const text = String(value || '').trim();
    if (text === 'world_event' || text === 'event') {
      return 'event';
    }
    if (text === 'news_item' || text === 'news') {
      return 'news';
    }
    if (text === 'card' || text === 'card_draft' || text === 'action_card' || text === 'advisor_like') {
      return 'card';
    }
    if (text === 'play_surface' || text === 'playable_surface') {
      return 'play_surface';
    }
    if (text === 'workspace_layout' || text === 'layout' || text === 'hand_sidebar_layout') {
      return 'workspace_layout';
    }
    if (text === 'sidebar_status' || text === 'sidebar' || text === 'status') {
      return 'sidebar_status';
    }
    if (text === 'surface_text' || text === 'surface' || text === 'text') {
      return 'surface';
    }
    if (text === 'entry' || text === 'entry_sidebar' || text === 'entry_sidebar_model') {
      return 'entry';
    }
    if (text === 'project' || text === 'project_metadata' || text === 'game_info') {
      return 'project';
    }
    if (text === 'variables' || text === 'variable' || text === 'variable_editor') {
      return 'variables';
    }
    if (text === 'existing_scene_edit' || text === 'existing' || text === 'scene_edit') {
      return 'existing';
    }
    return 'event';
  }

  function titleForDraft(template, draft, fallback) {
    return firstNonEmpty(
      fallback,
      draft.title,
      draft.heading,
      draft.headline,
      draft.replacementLabel,
      draft.originalLabel,
      templateLabel(template)
    );
  }

  function subtitleForDraft(template, draft, output) {
    if (template === 'event') {
      return [draft.year, monthLabel(draft.monthStart, draft.monthEnd)].filter(Boolean).join(' / ');
    }
    if (template === 'news') {
      return draft.delivery || '';
    }
    if (template === 'card') {
      return draft.cardKind || draft.kind || '';
    }
    if (template === 'play_surface') {
      return [draft.handHeading || draft.handTitle, draft.cardHeading || draft.cardTitle, draft.advisorHeading || draft.advisorTitle].filter(Boolean).join(' / ');
    }
    if (template === 'workspace_layout') {
      return [
        draft.deckTitle || draft.deckId,
        draft.createStarterCard ? draft.starterCardTitle || draft.starterCardId : '',
        draft.sidebarHeading || draft.sidebarCategoryId
      ].filter(Boolean).join(' / ');
    }
    if (template === 'sidebar_status') {
      return [draft.statusTitle, draft.sectionHeading || draft.sectionId].filter(Boolean).join(' / ');
    }
    if (template === 'surface') {
      return [draft.area, draft.editability].filter(Boolean).join(' / ');
    }
    if (template === 'entry') {
      return [draft.rootHeading || draft.rootTitle, draft.firstTargetId].filter(Boolean).join(' / ');
    }
    if (template === 'project') {
      return [draft.gameTitle, draft.author].filter(Boolean).join(' / ');
    }
    if (template === 'variables') {
      return [draft.mode, draft.variableName, draft.valueType].filter(Boolean).join(' / ');
    }
    if (template === 'existing') {
      return [draft.sceneKind || 'scene', draft.sceneId, draft.sourcePath].filter(Boolean).join(' / ');
    }
    return output && output.fileName ? output.fileName : '';
  }

  function previewTextForOutput(output, draft, template) {
    return firstNonEmpty(
      output.playerPreview,
      output.previewText,
      output.scene,
      output.sceneDry,
      output.snippet,
      output.proposal,
      draft.intro,
      draft.description,
      draft.gameTitle,
      draft.variableName,
      draft.heading,
      draft.headline,
      existingScenePreviewText(draft),
      titleForDraft(template, draft, '')
    );
  }

  function summarizeInstallPlan(plan) {
    const api = installPlanApi();
    if (api && typeof api.operationSummary === 'function') {
      return api.operationSummary(plan || {});
    }
    const operations = ensureArray(plan && plan.operations);
    return operations.reduce((summary, operation) => {
      const safety = operation && operation.safety;
      if (safety === 'safe_apply') {
        summary.safeApply += 1;
      } else if (safety === 'guarded_apply') {
        summary.guardedApply += 1;
      } else if (safety === 'advanced_apply') {
        summary.advancedApply += 1;
      } else if (safety === 'refused') {
        summary.refused += 1;
      } else {
        summary.manualReview += 1;
      }
      summary.total += 1;
      return summary;
    }, {safeApply: 0, guardedApply: 0, advancedApply: 0, manualReview: 0, refused: 0, total: 0});
  }

  function buildWorkspaceId(template, draftId, now) {
    return ['draft', template, normalizeId(draftId), String(now || '').replace(/[^0-9TZ]/g, '')].filter(Boolean).join(':');
  }

  function normalizeId(value) {
    return String(value || '')
      .trim()
      .replace(/[^A-Za-z0-9_.:-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'untitled';
  }

  function monthLabel(start, end) {
    if (!start && !end) {
      return '';
    }
    if (start && end && String(start) !== String(end)) {
      return 'month ' + start + '-' + end;
    }
    return 'month ' + (start || end);
  }

  function templateLabel(template) {
    return {
      event: 'World Event Draft',
      news: 'News Draft',
      card: 'Card Draft',
      play_surface: 'Playable Surface Draft',
      workspace_layout: 'Workspace Layout Draft',
      sidebar_status: 'Sidebar / Status Draft',
      surface: 'Text Proposal',
      entry: 'Entry & Sidebar Draft',
      project: 'Game Info Draft',
      variables: 'Variable Draft',
      existing: 'Existing Scene Edit'
    }[template] || 'Draft';
  }

  function existingScenePreviewText(draft) {
    if (!draft || draft.kind !== 'existing_scene_edit') {
      return '';
    }
    const kind = draft.sceneKind === 'card' ? 'Card' : 'Event';
    const count = ensureArray(draft.changes).length;
    return 'Modify existing ' + kind + ': ' + (draft.title || draft.sceneId || '(untitled)') +
      ' (' + count + ' changed field' + (count === 1 ? '' : 's') + ')';
  }

  function parseJson(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch (err) {
      return null;
    }
  }

  function cloneObject(value) {
    if (!isObject(value)) {
      return {};
    }
    return JSON.parse(JSON.stringify(value));
  }

  function compactObject(value) {
    const result = {};
    Object.keys(value || {}).forEach((key) => {
      const item = value[key];
      if (item !== undefined && item !== null) {
        result[key] = item;
      }
    });
    return result;
  }

  function defaultStorage() {
    try {
      return global && global.localStorage ? global.localStorage : null;
    } catch (err) {
      return null;
    }
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

  const api = {
    DRAFT_WORKSPACE_VERSION,
    STORAGE_KEY,
    makeDraftItem,
    loadDraftItems,
    saveDraftItems,
    upsertDraftItem,
    deleteDraftItem,
    normalizeDraftItems,
    normalizeTemplate
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapDraftWorkspace = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
