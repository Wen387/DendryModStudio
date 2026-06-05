#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const workspace = require('./authoring/draft_workspace.js');
const {assert} = require('./check_harness.js');

function memoryStorage(initial) {
  const data = new Map(Object.entries(initial || {}));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    }
  };
}

const eventDraft = {
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'draft_workspace_event',
  title: 'Draft Workspace Event',
  heading: 'A saved draft reopens cleanly',
  options: [{id: 'a', title: 'A'}, {id: 'b', title: 'B'}]
};

assert(
  workspace.STORAGE_KEY === 'dendry_mod_studio.draft_workspace.v0.1',
  'storage key should stay compatible with existing saved drafts'
);

const item = workspace.makeDraftItem({
  template: 'event',
  draft: eventDraft,
  output: {
    installPlan: {
      schemaVersion: '0.1',
      operations: [{
        id: 'create_scene',
        type: 'create_file',
        safety: 'safe_apply',
        path: 'source/scenes/events/draft_workspace_event.scene.dry',
        content: '@start\n'
      }]
    },
    patchPreview: 'create source/scenes/events/draft_workspace_event.scene.dry',
    playerPreview: 'A saved draft reopens cleanly'
  }
}, {now: '2026-04-29T12:00:00.000Z'});

assert(item.workspaceId.includes('event:draft_workspace_event'), 'workspace id should include template and draft id');
assert(item.template === 'event', 'world_event should normalize to event template');
assert(item.title === 'Draft Workspace Event', 'title should prefer draft title');
assert(item.installSummary.safeApply === 1, 'install summary should count safe operations');
assert(item.previewText.includes('A saved draft'), 'preview text should be captured');

const store = memoryStorage();
let list = workspace.loadDraftItems(store);
assert(list.length === 0, 'empty storage should load as empty list');

list = workspace.upsertDraftItem(list, item);
workspace.saveDraftItems(store, list);
let reloaded = workspace.loadDraftItems(store);
assert(reloaded.length === 1, 'saved draft should reload');
assert(reloaded[0].draft.id === 'draft_workspace_event', 'saved draft should keep draft payload');

const updated = workspace.makeDraftItem({
  template: 'event',
  draft: Object.assign({}, eventDraft, {title: 'Updated title'}),
  output: item.output
}, {now: '2026-04-29T12:05:00.000Z', workspaceId: item.workspaceId});
reloaded = workspace.upsertDraftItem(reloaded, updated);
assert(reloaded.length === 1, 'upsert should replace same workspace id');
assert(reloaded[0].title === 'Updated title', 'upsert should keep newer title');

reloaded = workspace.deleteDraftItem(reloaded, item.workspaceId);
assert(reloaded.length === 0, 'delete should remove item');

const corrupt = memoryStorage({[workspace.STORAGE_KEY]: '{not json'});
assert(workspace.loadDraftItems(corrupt).length === 0, 'corrupt storage should be ignored safely');

// Project-scoped storage key
assert(typeof workspace.storageKeyForProject === 'function', 'workspace should expose storageKeyForProject');
const projectKey = workspace.storageKeyForProject('/home/user/MyMod');
assert(projectKey !== workspace.STORAGE_KEY, 'project key should differ from global key');
assert(projectKey.startsWith(workspace.STORAGE_KEY + '.'), 'project key should extend global key');
assert(workspace.storageKeyForProject('') === workspace.STORAGE_KEY, 'empty project id should fall back to global key');
assert(workspace.storageKeyForProject('/home/user/MyMod') === workspace.storageKeyForProject('/home/user/MyMod'), 'same project should produce same key');
assert(workspace.storageKeyForProject('/home/user/MyMod') !== workspace.storageKeyForProject('/home/user/OtherMod'), 'different projects should produce different keys');

// Project-scoped load/save isolation
const scopedStore = memoryStorage();
const projectA = '/home/user/ProjectA';
const projectB = '/home/user/ProjectB';
workspace.saveDraftItems(scopedStore, [item], {projectId: projectA});
const loadedA = workspace.loadDraftItems(scopedStore, {projectId: projectA});
assert(loadedA.length === 1, 'project-scoped save should be loadable for same project');
const loadedB = workspace.loadDraftItems(scopedStore, {projectId: projectB});
assert(loadedB.length === 0, 'project-scoped save should not leak to different project');

// Migration from global key
const migrationStore = memoryStorage();
const migrationDraft = workspace.makeDraftItem({
  template: 'existing',
  draft: {id: 'migration_test', sceneId: 'test_scene', sourcePath: '/home/user/ModX/source/scenes/test.scene.dry'},
  output: {}
}, {now: '2026-05-30T00:00:00.000Z'});
workspace.saveDraftItems(migrationStore, [migrationDraft]);
assert(migrationStore.getItem(workspace.STORAGE_KEY), 'unscoped save should use global key');
const migratedItems = workspace.loadDraftItems(migrationStore, {projectId: '/home/user/ModX'});
assert(migratedItems.length === 1, 'loading with project id should migrate matching items from global key');
assert(!migrationStore.getItem(workspace.STORAGE_KEY), 'global key should be cleared after full migration');

const newsItem = workspace.makeDraftItem({
  draft: {schemaVersion: '0.1', kind: 'news_item', id: 'news_a', headline: 'Headline A'}
});
assert(newsItem.template === 'news', 'news_item should normalize to news template');

const entryItem = workspace.makeDraftItem({
  draft: {
    schemaVersion: '0.1',
    kind: 'entry_sidebar',
    id: 'entry_sidebar_update',
    title: 'Entry Update',
    rootHeading: 'Justice Party Campaign Office',
    firstTargetId: 'justice_party_opening'
  },
  output: {
    playerPreview: 'Justice Party Campaign Office',
    installPlan: {
      schemaVersion: '0.1',
      draftKind: 'entry_sidebar',
      operations: [{
        id: 'entry_opening_section',
        type: 'replace_section',
        safety: 'guarded_apply',
        path: 'source/scenes/root.scene.dry',
        anchorText: '= Old',
        endAnchorText: 'Old body',
        content: '= New\n',
        dedupeSearch: 'New'
      }]
    }
  }
});
assert(entryItem.template === 'entry', 'entry_sidebar should normalize to entry template');
assert(entryItem.subtitle.includes('justice_party_opening'), 'entry draft subtitle should identify the first playable target');
assert(entryItem.previewText.includes('Justice Party'), 'entry draft preview should be captured');

const projectItem = workspace.makeDraftItem({
  draft: {
    schemaVersion: '0.1',
    kind: 'project_metadata',
    id: 'project_metadata_update',
    title: 'Game Info Update',
    gameTitle: 'Justice Party Campaign Office',
    author: 'Dendry Mod Studio Playtest'
  },
  output: {
    playerPreview: 'Game title: Justice Party Campaign Office',
    installPlan: {
      schemaVersion: '0.1',
      draftKind: 'project_metadata',
      operations: [{
        id: 'project_metadata_title',
        type: 'replace_text',
        safety: 'guarded_apply',
        path: 'source/info.dry',
        search: 'title: Old',
        replace: 'title: Justice Party Campaign Office'
      }]
    }
  }
});
assert(projectItem.template === 'project', 'project_metadata should normalize to project template');
assert(projectItem.subtitle.includes('Justice Party Campaign Office'), 'project metadata subtitle should identify the game title');
assert(projectItem.subtitle.includes('Dendry Mod Studio Playtest'), 'project metadata subtitle should identify the author');
assert(projectItem.previewText.includes('Game title'), 'project metadata preview should be captured');

const layoutItem = workspace.makeDraftItem({
  draft: {
    schemaVersion: '0.1',
    kind: 'workspace_layout',
    id: 'justice_party_layout',
    title: 'Justice Party workspace layout',
    deckTitle: 'Justice Party Media Deck',
    createStarterCard: true,
    starterCardTitle: 'Media Briefing',
    sidebarHeading: 'Media Desk'
  },
  output: {
    playerPreview: 'Deck: Justice Party Media Deck\nSidebar category: Media Desk',
    installPlan: {
      schemaVersion: '0.1',
      draftKind: 'workspace_layout',
      operations: [{
        id: 'create_deck_scene',
        type: 'create_file',
        safety: 'safe_apply',
        path: 'source/scenes/decks/justice_party_media_deck.scene.dry',
        content: 'title: Justice Party Media Deck\n'
      }]
    }
  }
});
assert(layoutItem.template === 'workspace_layout', 'workspace_layout should normalize to workspace_layout template');
assert(layoutItem.subtitle.includes('Justice Party Media Deck'), 'workspace layout subtitle should identify the deck');
assert(layoutItem.subtitle.includes('Media Briefing'), 'workspace layout subtitle should identify the starter card');
assert(layoutItem.subtitle.includes('Media Desk'), 'workspace layout subtitle should identify the sidebar category');
assert(layoutItem.previewText.includes('Justice Party Media Deck'), 'workspace layout preview should be captured');

const sidebarStatusItem = workspace.makeDraftItem({
  draft: {
    schemaVersion: '0.1',
    kind: 'sidebar_status',
    id: 'justice_party_sidebar',
    title: 'Justice Party sidebar update',
    statusTitle: 'Justice Party Status',
    sectionId: 'organization',
    sectionHeading: 'Justice Party Organization'
  },
  output: {
    playerPreview: 'Sidebar / Status\nJustice Party Organization',
    installPlan: {
      schemaVersion: '0.1',
      draftKind: 'sidebar_status',
      operations: [{
        id: 'sidebar_status_section',
        type: 'replace_section',
        safety: 'guarded_apply',
        path: 'source/scenes/status.scene.dry',
        anchorText: '= Organization',
        endAnchorText: 'Old body',
        content: '= Justice Party Organization\n',
        dedupeSearch: 'Justice Party Organization'
      }]
    }
  }
});
assert(sidebarStatusItem.template === 'sidebar_status', 'sidebar_status should normalize to sidebar_status template');
assert(sidebarStatusItem.subtitle.includes('Justice Party Status'), 'sidebar status subtitle should identify the status scene');
assert(sidebarStatusItem.subtitle.includes('Justice Party Organization'), 'sidebar status subtitle should identify the selected section');
assert(sidebarStatusItem.previewText.includes('Justice Party Organization'), 'sidebar status preview should be captured');
assert(sidebarStatusItem.installSummary.guardedApply === 1, 'sidebar status item should count guarded install operations');

const existingSceneItem = workspace.makeDraftItem({
  template: 'existing',
  draft: {
    schemaVersion: '0.1',
    kind: 'existing_scene_edit',
    id: 'edit_existing_all_quiet',
    title: 'All Quiet on the Western Front',
    sceneId: 'all_quiet',
    sceneKind: 'event',
    sourcePath: 'source/scenes/events/all_quiet.scene.dry',
    changes: [{
      fieldId: 'all_quiet_body_1',
      role: 'body',
      source: {path: 'source/scenes/events/all_quiet.scene.dry', line: 8},
      before: 'Old event prose.',
      after: 'New event prose.'
    }]
  },
  output: {
    previewText: 'Modify existing Event: All Quiet on the Western Front',
    installPlan: {
      schemaVersion: '0.1',
      draftKind: 'existing_scene_edit',
      operations: [{
        id: 'replace_existing_1',
        type: 'replace_text',
        safety: 'guarded_apply',
        path: 'source/scenes/events/all_quiet.scene.dry',
        line: 8,
        search: 'Old event prose.',
        replace: 'New event prose.'
      }]
    }
  }
});
assert(existingSceneItem.template === 'existing', 'existing_scene_edit should normalize to existing template');
assert(existingSceneItem.title === 'All Quiet on the Western Front', 'existing scene edit item should keep scene title');
assert(existingSceneItem.subtitle.includes('all_quiet'), 'existing scene edit subtitle should identify the source scene');
assert(existingSceneItem.previewText.includes('Modify existing Event'), 'existing scene edit item should keep modify-existing preview text');
assert(existingSceneItem.installSummary.guardedApply === 1, 'existing scene edit item should count guarded install operations');

function fakeElement(tagName) {
  const element = {
    tagName: String(tagName || 'div').toUpperCase(),
    children: [],
    attributes: {},
    className: '',
    disabled: false,
    textContent: '',
    title: '',
    _innerHTML: '',
    _listeners: {},
    _buttons: {},
    classList: {
      toggle() {}
    },
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    remove() {
      if (!this.parentNode) {
        return;
      }
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    },
    addEventListener(name, handler) {
      this._listeners[name] = handler;
    },
    click() {
      if (!this.disabled && this._listeners.click) {
        this._listeners.click();
      }
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    querySelector(selector) {
      const match = /^\[data-draft-action="([^"]+)"\]$/.exec(selector);
      return match ? this._buttons[match[1]] || null : null;
    }
  };
  Object.defineProperty(element, 'innerHTML', {
    get() {
      return this._innerHTML;
    },
    set(value) {
      this._innerHTML = String(value || '');
      this.children = [];
      this._buttons = {};
      const buttonRe = /<button[^>]*data-draft-action="([^"]+)"[^>]*>(.*?)<\/button>/g;
      let match;
      while ((match = buttonRe.exec(this._innerHTML)) !== null) {
        const button = fakeElement('button');
        button.textContent = match[2].replace(/<[^>]+>/g, '');
        this._buttons[match[1]] = button;
      }
    }
  });
  return element;
}

function runDraftWorkspaceUiSmoke(items) {
  const elements = {
    'draft-workspace-save': fakeElement('button'),
    'draft-workspace-export': fakeElement('button'),
    'draft-workspace-status': fakeElement('div'),
    'draft-workspace-list': fakeElement('div')
  };
  let installClicks = 0;
  let loadedPlan = null;
  const installModeButton = fakeElement('button');
  installModeButton.addEventListener('click', () => {
    installClicks += 1;
  });
  const document = {
    readyState: 'complete',
    body: fakeElement('body'),
    getElementById(id) {
      return elements[id] || null;
    },
    addEventListener() {},
    createElement(tagName) {
      return fakeElement(tagName);
    },
    querySelector(selector) {
      return selector === '[data-mode="install"]' ? installModeButton : null;
    }
  };
  const context = {
    document,
    ProjectMapDraftWorkspace: {
      loadDraftItems() {
        return items;
      },
      saveDraftItems() {
        return true;
      },
      deleteDraftItem(list, workspaceId) {
        return list.filter((entry) => entry.workspaceId !== workspaceId);
      }
    },
    ProjectMapInstallAssistant: {
      loadPlan(plan) {
        loadedPlan = plan;
      }
    },
    ProjectMapExistingSceneEditor: {
      loadDraft(draft) {
        context._loadedExistingDraft = draft;
      }
    },
    ProjectMapI18n: {
      t(key, fallback) {
        return {
          'draftWorkspace.noInstallPlanShort': 'No install plan',
          'draftWorkspace.needsReviewCheck': 'Needs check in Review & Apply',
          'draftWorkspace.safeApply': 'Safe to apply',
          'draftWorkspace.guardedApply': 'Check then apply',
          'draftWorkspace.advancedApply': 'Advanced opt-in',
          'draftWorkspace.manualReview': 'Manual steps',
          'draftWorkspace.refused': 'Protected',
          'draftWorkspace.template.existing': 'Existing edit'
        }[key] || fallback;
      }
    },
    CSS: {
      escape(value) {
        return String(value).replace(/"/g, '\\"');
      }
    },
    Blob: function Blob() {},
    URL: {
      createObjectURL() {
        return 'blob:test';
      },
      revokeObjectURL() {}
    }
  };
  context.window = context;
  context.globalThis = context;
  context.ProjectMapDomText = require('./viewer/dom_text_utils.js');
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, 'viewer', 'draft_workspace_ui.js'), 'utf8'),
    context,
    {filename: 'draft_workspace_ui.js'}
  );
  return {elements, get loadedPlan() { return loadedPlan; }, get installClicks() { return installClicks; }};
}

const noPlanItem = workspace.makeDraftItem({
  template: 'event',
  draft: {id: 'no_plan_event', title: 'No Plan Event', heading: 'Preview text for a saved change.'},
  output: {playerPreview: 'Preview text for a saved change.'},
  warnings: ['Needs manual router review before it can be applied.']
}, {now: '2026-04-29T12:10:00.000Z'});
const reviewableItem = workspace.makeDraftItem({
  template: 'surface',
  draft: {id: 'surface_change', replacementLabel: 'Updated visible text'},
  output: {
    playerPreview: 'Updated visible text',
    installPlan: {
      schemaVersion: '0.1',
      operations: [{
        id: 'replace_text',
        type: 'replace_text',
        safety: 'guarded_apply',
        path: 'source/scenes/status.scene.dry',
        find: 'old',
        replace: 'new'
      }]
    }
  }
}, {now: '2026-04-29T12:11:00.000Z'});
const uiSmoke = runDraftWorkspaceUiSmoke([noPlanItem, reviewableItem]);
assert(uiSmoke.elements['draft-workspace-list'].children.length === 2, 'draft workspace UI should render saved changes');
const noPlanCard = uiSmoke.elements['draft-workspace-list'].children[0];
assert(noPlanCard.innerHTML.includes('draft-workspace-item-preview'), 'saved change card should render preview excerpt');
assert(noPlanCard.innerHTML.includes('Needs manual router review'), 'saved change card should render warnings');
assert(noPlanCard.innerHTML.includes('No install plan'), 'saved change without plan should explain that no install plan is available');
const noPlanReview = noPlanCard.querySelector('[data-draft-action="review"]');
assert(noPlanReview.disabled === true, 'saved change without install plan should disable Review');
noPlanReview.click();
assert(uiSmoke.loadedPlan === null, 'disabled Review should not load an install plan');
assert(uiSmoke.installClicks === 0, 'disabled Review should not switch to Install');

const reviewableCard = uiSmoke.elements['draft-workspace-list'].children[1];
assert(reviewableCard.innerHTML.includes('Needs check in Review'), 'saved change with install plan should explain that Review & Apply still needs a check');
const reviewableReview = reviewableCard.querySelector('[data-draft-action="review"]');
assert(reviewableReview.disabled === false, 'saved change with install plan should keep Review enabled');
reviewableReview.click();
assert(uiSmoke.loadedPlan === reviewableItem.installPlan, 'enabled Review should load the saved install plan');
assert(uiSmoke.installClicks === 1, 'enabled Review should switch to Install');

function runDraftWorkspaceSaveSmoke(initialItems, currentDraft, currentOutput, workspaceId) {
  const elements = {
    'draft-workspace-save': fakeElement('button'),
    'draft-workspace-export': fakeElement('button'),
    'draft-workspace-status': fakeElement('div'),
    'draft-workspace-list': fakeElement('div')
  };
  let persistedItems = initialItems.slice();
  let activeWorkspaceId = workspaceId || '';
  const document = {
    readyState: 'complete',
    body: fakeElement('body'),
    getElementById(id) {
      return elements[id] || null;
    },
    addEventListener() {},
    createElement(tagName) {
      return fakeElement(tagName);
    },
    querySelector() {
      return null;
    }
  };
  const context = {
    document,
    ProjectMapDraftWorkspace: Object.assign({}, workspace, {
      loadDraftItems() {
        return persistedItems;
      },
      saveDraftItems(_storage, items) {
        persistedItems = items.slice();
        return true;
      }
    }),
    ProjectMapObjectAuthoringCanvas: {
      isActive() {
        return true;
      },
      activeTemplate() {
        return 'event';
      },
      refresh() {},
      getDraft() {
        return currentDraft;
      },
      getOutput() {
        return currentOutput;
      },
      getDraftWorkspaceId() {
        return activeWorkspaceId;
      },
      setDraftWorkspaceId(id) {
        activeWorkspaceId = String(id || '');
      }
    },
    ProjectMapI18n: {
      t(_key, fallback) {
        return fallback;
      }
    },
    CSS: {
      escape(value) {
        return String(value).replace(/"/g, '\\"');
      }
    },
    Blob: function Blob() {},
    URL: {
      createObjectURL() {
        return 'blob:test';
      },
      revokeObjectURL() {}
    }
  };
  context.window = context;
  context.globalThis = context;
  context.ProjectMapDomText = require('./viewer/dom_text_utils.js');
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, 'viewer', 'draft_workspace_ui.js'), 'utf8'),
    context,
    {filename: 'draft_workspace_ui.js'}
  );
  elements['draft-workspace-save'].click();
  return {items: persistedItems, activeWorkspaceId};
}

const savedDefaultEvent = workspace.makeDraftItem({
  template: 'event',
  draft: {
    schemaVersion: '0.1',
    kind: 'world_event',
    id: 'new_world_event',
    title: 'Already saved event'
  },
  output: {playerPreview: 'Already saved event'}
}, {now: '2026-04-29T12:12:00.000Z'});
const unsourcedSameIdSave = runDraftWorkspaceSaveSmoke([savedDefaultEvent], {
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'new_world_event',
  title: 'Second unsourced event'
}, {
  playerPreview: 'Second unsourced event'
}, '');
assert(unsourcedSameIdSave.items.length === 2, 'saving a new unsourced draft with the same id should not overwrite an older saved draft');
assert(unsourcedSameIdSave.items.some((entry) => entry.title === 'Already saved event'), 'older same-id draft should remain in My Changes');
assert(unsourcedSameIdSave.items.some((entry) => entry.title === 'Second unsourced event'), 'new same-id draft should be stored as its own My Changes item');

const sourcedSameIdSave = runDraftWorkspaceSaveSmoke([savedDefaultEvent], {
  schemaVersion: '0.1',
  kind: 'world_event',
  id: 'new_world_event',
  title: 'Updated saved event'
}, {
  playerPreview: 'Updated saved event'
}, savedDefaultEvent.workspaceId);
assert(sourcedSameIdSave.items.length === 1, 'saving a loaded saved draft should update that My Changes item');
assert(sourcedSameIdSave.items[0].title === 'Updated saved event', 'loaded saved draft updates should preserve the intended upsert behavior');

console.log(JSON.stringify({
  ok: true,
  itemId: item.workspaceId,
  templates: ['event', newsItem.template, entryItem.template, layoutItem.template, sidebarStatusItem.template, projectItem.template]
}, null, 2));
