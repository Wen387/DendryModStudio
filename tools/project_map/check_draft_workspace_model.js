#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const workspace = require('./authoring/draft_workspace.js');

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exit(1);
  }
}

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

const newsItem = workspace.makeDraftItem({
  draft: {schemaVersion: '0.1', kind: 'news_item', id: 'news_a', headline: 'Headline A'}
});
assert(newsItem.template === 'news', 'news_item should normalize to news template');

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
const noPlanReview = noPlanCard.querySelector('[data-draft-action="review"]');
assert(noPlanReview.disabled === true, 'saved change without install plan should disable Review');
noPlanReview.click();
assert(uiSmoke.loadedPlan === null, 'disabled Review should not load an install plan');
assert(uiSmoke.installClicks === 0, 'disabled Review should not switch to Install');

const reviewableCard = uiSmoke.elements['draft-workspace-list'].children[1];
const reviewableReview = reviewableCard.querySelector('[data-draft-action="review"]');
assert(reviewableReview.disabled === false, 'saved change with install plan should keep Review enabled');
reviewableReview.click();
assert(uiSmoke.loadedPlan === reviewableItem.installPlan, 'enabled Review should load the saved install plan');
assert(uiSmoke.installClicks === 1, 'enabled Review should switch to Install');

console.log(JSON.stringify({
  ok: true,
  itemId: item.workspaceId,
  templates: ['event', newsItem.template]
}, null, 2));
