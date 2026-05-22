#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const partialRepair = require('./authoring/partial_repair_workflow_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#96;/g, '`')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function attrValue(tag, name) {
  const match = new RegExp(name + '="([^"]*)"').exec(tag);
  return match ? decodeHtml(match[1]) : '';
}

function visibleEditActions(source) {
  const actions = [];
  const regex = /data-visible-edit-action="([^"]+)"/g;
  let match = regex.exec(source);
  while (match) {
    try {
      const action = JSON.parse(decodeHtml(match[1]));
      if (action && action.actionKind) {
        actions.push(action);
      }
    } catch (_err) {
      // Rendered repair actions must still be parseable; unrelated snippets can be ignored.
    }
    match = regex.exec(source);
  }
  return actions;
}

function lensMarkers(source) {
  const rows = [];
  const regex = /<span[^>]*data-authoring-context-lens="true"[^>]*>/g;
  let match = regex.exec(source);
  while (match) {
    const tag = match[0];
    let payload = null;
    try {
      payload = JSON.parse(attrValue(tag, 'data-context-lens-payload') || '{}');
    } catch (_err) {
      payload = null;
    }
    rows.push({
      kind: attrValue(tag, 'data-context-lens-kind'),
      evidence: attrValue(tag, 'data-context-lens-evidence'),
      payload
    });
    match = regex.exec(source);
  }
  return rows;
}

function byRole(entries, role) {
  return entries.find((entry) => entry && entry.role === role) || null;
}

function requireLensRows(entry) {
  const labels = (entry && entry.lens && entry.lens.rows || []).map((row) => row.label);
  ['Meaning', 'Context', 'Source', 'Edit route', 'Safety', 'Rule of use'].forEach((label) => {
    assert(labels.includes(label), entry.role + ' repair entry should expose context lens row ' + label, entry.lens);
  });
}

const parity = {
  roles: {
    body: {role: 'body', parsed: 2, draft: 1, missing: 1, blocking: true},
    options: {role: 'options', parsed: 2, draft: 1, missing: 1, blocking: true},
    sections: {role: 'sections', parsed: 2, draft: 1, missing: 1, blocking: true},
    viewIf: {role: 'viewIf', parsed: 1, draft: 0, missing: 1, blocking: true},
    effects: {role: 'effects', parsed: 2, draft: 1, missing: 1, blocking: true},
    assets: {role: 'assets', parsed: 1, draft: 0, missing: 1, blocking: true},
    metadata: {role: 'metadata', parsed: 2, draft: 1, missing: 1, blocking: false},
    dynamicRaw: {role: 'dynamicRaw', parsed: 1, draft: 0, missing: 1, blocking: true}
  }
};

const model = {
  mode: 'existing',
  objectKind: 'event',
  objectId: 'repair_fixture',
  title: 'Partial repair fixture',
  eventBody: {
    title: {
      id: 'repair.title',
      label: 'Title',
      value: 'Partial repair fixture',
      original: 'Partial repair fixture',
      status: 'guarded',
      source: {path: 'source/scenes/events/repair.scene.dry', line: 2}
    },
    sections: [{
      id: 'repair.body',
      label: 'Opening text',
      value: 'Visible body copy.',
      original: 'Visible body copy.',
      role: 'body',
      status: 'guarded',
      source: {path: 'source/scenes/events/repair.scene.dry', line: 4}
    }],
    branchSections: [{
      id: 'repair.followup',
      label: 'Follow-up',
      value: 'Follow-up text.',
      original: 'Follow-up text.',
      status: 'guarded',
      source: {path: 'source/scenes/events/repair.scene.dry', line: 12}
    }],
    options: [{
      id: 'first',
      label: 'First option',
      fields: [{
        id: 'repair.option.first.label',
        label: 'First option',
        value: 'First option',
        original: 'First option',
        status: 'guarded',
        source: {path: 'source/scenes/events/repair.scene.dry', line: 8}
      }]
    }],
    effects: [{
      id: 'repair.effect.0',
      label: 'Variable effect',
      variable: 'stability',
      op: 'add',
      value: '1',
      status: 'guarded',
      source: {path: 'source/scenes/events/repair.scene.dry', line: 20}
    }],
    metaFields: [{
      id: 'repair.viewIf',
      label: 'view-if',
      role: 'viewIf',
      value: 'stability > 0',
      original: 'stability > 0',
      status: 'guarded',
      source: {path: 'source/scenes/events/repair.scene.dry', line: 1}
    }, {
      id: 'repair.tag',
      label: 'Tag',
      role: 'metadata',
      value: 'politics',
      original: 'politics',
      status: 'guarded',
      source: {path: 'source/scenes/events/repair.scene.dry', line: 3}
    }],
    assets: [{
      id: 'repair_asset_reference',
      label: 'Event image',
      path: 'assets/events/repair.png',
      type: 'image',
      role: 'event_illustration',
      source: {path: 'source/scenes/events/repair.scene.dry', line: 6}
    }]
  },
  changeState: {
    draft: {
      authoringStatus: 'partial',
      parsedToDraftParity: parity
    },
    operationSummary: {},
    changedCount: 0
  }
};

const entries = partialRepair.buildRepairEntries(parity, {model, body: model.eventBody});
const roles = entries.map((entry) => entry.role).sort();
Object.keys(parity.roles).forEach((role) => {
  assert(roles.includes(role), role + ' should produce a repair entry or boundary', entries);
});
entries.forEach(requireLensRows);

const expectedActions = {
  body: 'open_object_section',
  options: 'open_object_field',
  sections: 'open_object_section',
  viewIf: 'open_route_editor',
  effects: 'open_effect_editor',
  assets: 'open_object_field',
  metadata: 'open_object_field'
};
Object.entries(expectedActions).forEach(([role, actionKind]) => {
  const entry = byRole(entries, role);
  assert(entry && entry.repairAction && entry.repairAction.actionKind === actionKind, role + ' should route to ' + actionKind, entry);
});

const assetEntry = byRole(entries, 'assets');
assert(assetEntry.reviewable && !assetEntry.repairable, 'asset gaps should be reviewable without pretending a file copy is already repairable', assetEntry);
assert(assetEntry.boundaryKind === 'asset_proposal_required', 'asset gaps should retain a concrete replacement-file boundary', assetEntry);
assert(assetEntry.boundaryReason, 'asset gaps should explain replacement-file evidence', assetEntry);

const unsupported = byRole(entries, 'dynamicRaw');
assert(unsupported && !unsupported.repairAction && unsupported.boundaryKind === 'manual_source_review', 'unsupported parsed roles should remain honest manual boundaries', unsupported);

const html = previewEditor.renderModal(model, {});
assert(html.includes('data-partial-repair-entry="repair_body"'), 'rendered parity panel should include body repair entry');
assert(html.includes('data-partial-repair-entry="repair_assets"'), 'rendered parity panel should include asset repair entry');
assert(html.includes('data-partial-repair-entry="repair_dynamicraw"'), 'rendered parity panel should include unsupported boundary entry');
assert(html.includes('data-partial-repair-kind="asset"'), 'asset repair row should keep asset repair kind marker');
const sparseEntries = partialRepair.buildRepairEntries({
  roles: {},
  blockers: [{
    code: 'parsed_to_draft.root_choice_missing',
    message: 'This parsed event has follow-up structure but no root player choice.'
  }]
}, {
  model: {
    objectView: 'events',
    objectId: 'sparse_event',
    eventBody: {
      structureActions: [{id: 'structure_add_option', source: {path: 'source/scenes/events/sparse_event.scene.dry', line: 12}}]
    }
  }
});
const sparseEntry = sparseEntries.find((entry) => entry.id === 'repair_sparse_root_choice');
assert(sparseEntry && sparseEntry.repairAction && sparseEntry.repairAction.actionKind === 'open_object_section', 'sparse root-choice blockers should route to Object Canvas structure repair.', sparseEntries);
assert(sparseEntry.repairAction.fieldId === 'structure_add_option' && sparseEntry.repairAction.installSafety === 'guarded_apply', 'sparse root-choice repair should target structure_add_option safely.', sparseEntry);

assert(html.includes('data-authoring-context-lens="true"'), 'repair rows should expose AQ context lens metadata');

const actions = visibleEditActions(html);
Object.values(expectedActions).forEach((actionKind) => {
  assert(actions.some((action) => action.actionKind === actionKind), 'rendered repair rows should dispatch ' + actionKind, actions);
});
assert(lensMarkers(html).some((marker) => marker.payload && marker.payload.kind === 'authoring_context_lens' && /Repair|Review|missing/i.test(marker.payload.meaning || '')), 'rendered repair lens payloads should describe repair context', lensMarkers(html));

const eventBuilderSource = fs.readFileSync(path.join(__dirname, 'viewer/preview_object_event_builder_ui.js'), 'utf8');
assert(eventBuilderSource.includes('data-preview-object-asset-entry'), 'asset reference editor rows should expose focusable repair anchors without pretending to be form fields');
assert(eventBuilderSource.includes('tabindex="0"'), 'asset reference anchors should be keyboard focusable when routed from repair rows');

process.stdout.write(JSON.stringify({
  ok: true,
  roles,
  repairActions: actions.filter((action) => Object.values(expectedActions).includes(action.actionKind)).map((action) => action.actionKind),
  boundaryRoles: entries.filter((entry) => entry.boundaryKind).map((entry) => entry.role)
}, null, 2) + '\n');
