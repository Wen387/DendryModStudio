#!/usr/bin/env node
'use strict';

const existingEdit = require('./authoring/existing_scene_edit_model.js');
const editingContext = require('./authoring/editing_context_model.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const installPlan = require('./authoring/install_plan.js');
const fs = require('fs');
const os = require('os');
const path = require('path');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function assertDescendingSourceOrder(changes, message) {
  const lines = changes.map((change) => Number(change && (change.startLine || change.source && (change.source.line || change.source.startLine)) || 0));
  for (let index = 1; index < lines.length; index += 1) {
    assert(lines[index - 1] >= lines[index], message + ': ' + lines.join(', '));
  }
}

function option(path, line, target, title, extra) {
  const anchorText = '- @' + target + ': ' + title;
  return Object.assign({
    target: {id: target},
    title,
    sourceSpan: {path, line, startLine: line, endLine: line, anchorText, endAnchorText: anchorText}
  }, extra || {});
}

function textItem(id, sceneId, sectionId, role, text, path, line, itemId) {
  return {
    id,
    text,
    role,
    owner: {kind: 'scene', sceneId, sectionId: sectionId || '', itemId: itemId || ''},
    source: {path, line, startLine: line, endLine: line}
  };
}

function syntheticIndex() {
  const sceneId = 'graph_event';
  const scenePath = 'source/scenes/events/graph_event.scene.dry';
  const scene = {
    id: sceneId,
    title: 'Graph Event',
    path: scenePath,
    type: 'event',
    tags: ['event'],
    flags: {isCard: false, isPinnedCard: false},
    viewIf: 'year = 1930 and month = 5',
    options: [
      option(scenePath, 5, 'external_news', 'Send it to another scene.'),
      option(scenePath, 6, 'calm_path', 'Keep the result local.'),
      option(scenePath, 7, 'risky_path', 'Use the risky branch.', {chooseIf: 'public_order >= 1'}),
      option(scenePath, 8, 'menu_branch', 'Open the nested branch.')
    ],
    sections: [
      {
        id: sceneId + '.calm_path',
        title: 'Calm Result',
        sourceSpan: {path: scenePath, line: 10, startLine: 10, endLine: 12, excerpt: '10:# calm_path\n11:The local result can be removed as a bounded bundle.\n12:go-to: calm_done'},
        routes: {},
        options: []
      },
      {
        id: sceneId + '.risky_path',
        title: 'Risky Result',
        sourceSpan: {path: scenePath, line: 14, startLine: 14, endLine: 16, anchorText: '# risky_path', endAnchorText: 'go-to: risky_done'},
        routes: {},
        options: []
      },
      {
        id: sceneId + '.orphan_branch',
        title: 'Orphan Branch',
        sourceSpan: {path: scenePath, line: 18, startLine: 18, endLine: 19, anchorText: '# orphan_branch', endAnchorText: 'The orphan follow-up can be deleted.'},
        routes: {},
        options: []
      },
      {
        id: sceneId + '.menu_branch',
        title: 'Menu Branch',
        sourceSpan: {path: scenePath, line: 21, startLine: 21, endLine: 23, anchorText: '# menu_branch', endAnchorText: '- @nested_choice: Choose nested path.'},
        routes: {},
        options: [
          option(scenePath, 23, 'nested_choice', 'Choose nested path.')
        ]
      },
      {
        id: sceneId + '.nested_choice',
        title: 'Nested Choice',
        sourceSpan: {path: scenePath, line: 25, startLine: 25, endLine: 27, anchorText: '# nested_choice', endAnchorText: 'go-to: nested_done'},
        routes: {},
        options: []
      }
    ],
    sourceSpan: {path: scenePath, startLine: 1, endLine: 40},
    topLevelSpan: {path: scenePath, startLine: 1, endLine: 20},
    metadata: {viewIf: {path: scenePath, line: 3}},
    assetRefs: [{path: 'img/events/graph.png', type: 'image', label: 'Graph art'}]
  };
  return {
    schemaVersion: '0.1',
    project: {name: 'Source Graph Fixture', root: '/tmp/source-graph-fixture'},
    scenes: [scene],
    variables: [{name: 'public_order', reads: [{path: scenePath, line: 12}], writes: []}],
    semantic: {
      events: [{id: sceneId, title: scene.title, path: scenePath}],
      cards: [],
      assets: {items: scene.assetRefs},
      textCorpus: {
        items: [
          textItem('graph_title', sceneId, '', 'title', 'Graph Event', scenePath, 1),
          textItem('graph_body', sceneId, 'start', 'body', 'Opening text.', scenePath, 4),
          textItem('graph_external_label', sceneId, 'start', 'option_label', 'Send it to another scene.', scenePath, 5, 'external_news'),
          textItem('graph_calm_label', sceneId, 'start', 'option_label', 'Keep the result local.', scenePath, 6, 'calm_path'),
          textItem('graph_risky_label', sceneId, 'start', 'option_label', 'Use the risky branch.', scenePath, 7, 'risky_path'),
          textItem('graph_menu_label', sceneId, 'start', 'option_label', 'Open the nested branch.', scenePath, 8, 'menu_branch'),
          textItem('graph_calm_body', sceneId, sceneId + '.calm_path', 'body', 'The local result can be removed as a bounded bundle.', scenePath, 11),
          textItem('graph_risky_body', sceneId, sceneId + '.risky_path', 'body', 'The risky result needs explicit fallout review.', scenePath, 15),
          textItem('graph_orphan_body', sceneId, sceneId + '.orphan_branch', 'body', 'The orphan follow-up can be deleted.', scenePath, 19),
          textItem('graph_menu_body', sceneId, sceneId + '.menu_branch', 'body', 'The menu branch owns a nested choice.', scenePath, 22),
          textItem('graph_nested_label', sceneId, sceneId + '.menu_branch', 'option_label', 'Choose nested path.', scenePath, 23, 'nested_choice'),
          textItem('graph_nested_body', sceneId, sceneId + '.nested_choice', 'body', 'The nested result should be deleted with the parent menu.', scenePath, 26)
        ]
      }
    },
    diagnostics: []
  };
}

function branchBundleIndex() {
  const sceneId = 'branch_bundle_event';
  const scenePath = 'source/scenes/events/branch_bundle_event.scene.dry';
  const scene = {
    id: sceneId,
    title: 'Branch Bundle Event',
    path: scenePath,
    type: 'event',
    tags: ['event'],
    flags: {isCard: false, isPinnedCard: false},
    options: [
      option(scenePath, 5, 'shared_branch', 'Shared path one.'),
      option(scenePath, 6, 'shared_branch', 'Shared path two.'),
      option(scenePath, 7, 'deep_menu', 'Open the deep branch.')
    ],
    sections: [
      {
        id: sceneId + '.shared_branch',
        title: 'Shared Branch',
        sourceSpan: {path: scenePath, line: 9, startLine: 9, endLine: 10, anchorText: '# shared_branch', endAnchorText: 'The shared branch is entered from two choices.'},
        routes: {},
        options: []
      },
      {
        id: sceneId + '.deep_menu',
        title: 'Deep Menu',
        sourceSpan: {path: scenePath, line: 12, startLine: 12, endLine: 14, anchorText: '# deep_menu', endAnchorText: '- @middle_branch: Enter the middle branch.'},
        routes: {},
        options: [
          option(scenePath, 14, 'middle_branch', 'Enter the middle branch.')
        ]
      },
      {
        id: sceneId + '.middle_branch',
        title: 'Middle Branch',
        sourceSpan: {path: scenePath, line: 16, startLine: 16, endLine: 18, anchorText: '# middle_branch', endAnchorText: '- @deep_leaf: Finish deep branch.'},
        routes: {},
        options: [
          option(scenePath, 18, 'deep_leaf', 'Finish deep branch.')
        ]
      },
      {
        id: sceneId + '.deep_leaf',
        title: 'Deep Leaf',
        sourceSpan: {path: scenePath, line: 20, startLine: 20, endLine: 21, anchorText: '# deep_leaf', endAnchorText: 'The deepest branch result can be removed with its ancestors.'},
        routes: {},
        options: []
      },
      {
        id: sceneId + '.route_source',
        title: 'Route Source',
        sourceSpan: {path: scenePath, line: 23, startLine: 23, endLine: 25, anchorText: '# route_source', endAnchorText: 'go-to: shared_branch'},
        routes: {goTo: [{id: 'shared_branch', raw: 'shared_branch'}]},
        metadata: {
          goTo: {
            path: scenePath,
            line: 25,
            startLine: 25,
            endLine: 25,
            anchorText: 'go-to: shared_branch',
            endAnchorText: 'go-to: shared_branch'
          }
        },
        options: []
      },
      {
        id: sceneId + '.routed_leaf',
        title: 'Routed Leaf',
        sourceSpan: {path: scenePath, line: 27, startLine: 27, endLine: 28, anchorText: '# routed_leaf', endAnchorText: 'The routed-only branch has no option references.'},
        routes: {},
        options: []
      },
      {
        id: sceneId + '.routed_source',
        title: 'Routed Source',
        sourceSpan: {path: scenePath, line: 30, startLine: 30, endLine: 32, anchorText: '# routed_source', endAnchorText: 'go-to: routed_leaf'},
        routes: {goTo: [{id: 'routed_leaf', raw: 'routed_leaf'}]},
        metadata: {
          goTo: {
            path: scenePath,
            line: 32,
            startLine: 32,
            endLine: 32,
            anchorText: 'go-to: routed_leaf',
            endAnchorText: 'go-to: routed_leaf'
          }
        },
        options: []
      }
    ],
    sourceSpan: {path: scenePath, startLine: 1, endLine: 34},
    topLevelSpan: {path: scenePath, startLine: 1, endLine: 34},
    metadata: {},
    assetRefs: []
  };
  return {
    schemaVersion: '0.1',
    project: {name: 'Branch Bundle Fixture', root: '/tmp/branch-bundle-fixture'},
    scenes: [scene],
    variables: [],
    semantic: {
      events: [{id: sceneId, title: scene.title, path: scenePath}],
      cards: [],
      assets: {items: []},
      textCorpus: {
        items: [
          textItem('bundle_title', sceneId, '', 'title', 'Branch Bundle Event', scenePath, 1),
          textItem('bundle_body', sceneId, 'start', 'body', 'Opening text.', scenePath, 4),
          textItem('bundle_shared_label_one', sceneId, 'start', 'option_label', 'Shared path one.', scenePath, 5, 'shared_branch'),
          textItem('bundle_shared_label_two', sceneId, 'start', 'option_label', 'Shared path two.', scenePath, 6, 'shared_branch'),
          textItem('bundle_deep_label', sceneId, 'start', 'option_label', 'Open the deep branch.', scenePath, 7, 'deep_menu'),
          textItem('bundle_shared_body', sceneId, sceneId + '.shared_branch', 'body', 'The shared branch is entered from two choices.', scenePath, 10),
          textItem('bundle_deep_body', sceneId, sceneId + '.deep_menu', 'body', 'The deep menu owns a middle branch.', scenePath, 13),
          textItem('bundle_middle_label', sceneId, sceneId + '.deep_menu', 'option_label', 'Enter the middle branch.', scenePath, 14, 'middle_branch'),
          textItem('bundle_middle_body', sceneId, sceneId + '.middle_branch', 'body', 'The middle branch owns a leaf.', scenePath, 17),
          textItem('bundle_deep_leaf_label', sceneId, sceneId + '.middle_branch', 'option_label', 'Finish deep branch.', scenePath, 18, 'deep_leaf'),
          textItem('bundle_deep_leaf_body', sceneId, sceneId + '.deep_leaf', 'body', 'The deepest branch result can be removed with its ancestors.', scenePath, 21),
          textItem('bundle_route_source_body', sceneId, sceneId + '.route_source', 'body', 'This branch routes into the shared result.', scenePath, 24),
          textItem('bundle_routed_leaf_body', sceneId, sceneId + '.routed_leaf', 'body', 'The routed-only branch has no option references.', scenePath, 28),
          textItem('bundle_routed_source_body', sceneId, sceneId + '.routed_source', 'body', 'This branch routes into a routed-only target.', scenePath, 31)
        ]
      }
    },
    diagnostics: []
  };
}

function hintFor(graph, optionId) {
  return (graph.operationHints.removeOptions || []).find((hint) => hint.optionId === optionId) || null;
}

const index = syntheticIndex();
const editModel = existingEdit.buildEditModel(index, 'events', 'graph_event');
assert(editModel.ok, 'existing edit model should build');
assert(editModel.sourceStructureGraph, 'edit model should expose source structure graph');
assert(editModel.sourceStructureGraph.kind === 'source_structure_graph', 'source graph should expose kind');
assert(editModel.sourceStructureGraph.summary.optionCount === 5, 'source graph should count top-level and nested options');
assert(editModel.sourceStructureGraph.summary.sectionCount >= 2, 'source graph should include local sections');
assert(editModel.sourceStructureGraph.summary.assetCount === 1, 'source graph should include referenced assets');
assert(editModel.sourceStructureGraph.summary.removeLayerAdvancedCount >= 4, 'source graph should classify exact standalone/referenced/nested branch layers as advanced deletions');
const openingTextNode = editModel.sourceStructureGraph.nodes.find((node) => node.kind === 'text' && node.semanticRole === 'opening_text');
assert(openingTextNode && openingTextNode.source.path === 'source/scenes/events/graph_event.scene.dry' && openingTextNode.source.line === 4, 'source graph should preserve source evidence from assembled text blocks');
assert(editModel.sourceStructureGraph.edges.some((edge) => edge.kind === 'contains_text' && edge.to === openingTextNode.id && edge.source.line === 4), 'source graph should connect text block nodes with source-backed evidence');

const externalHint = hintFor(editModel.sourceStructureGraph, 'external_news');
const calmHint = hintFor(editModel.sourceStructureGraph, 'calm_path');
const riskyHint = hintFor(editModel.sourceStructureGraph, 'risky_path');
assert(externalHint && externalHint.safetyCandidate === 'guarded_option_line_delete', 'external option should be guarded line delete');
assert(calmHint && calmHint.safetyCandidate === 'advanced_option_bundle_delete', 'local option should be an advanced bounded bundle');
assert(calmHint.targetSectionSource.anchorText === '# calm_path', 'local bundle deletion should recover section start anchors from source excerpts');
assert(calmHint.targetSectionSource.endAnchorText === 'go-to: calm_done', 'local bundle deletion should recover section end anchors from source excerpts');
assert(riskyHint && riskyHint.safetyCandidate === 'aggressive_option_bundle_delete', 'conditioned local option should be aggressive bundle');

const removeExternal = editModel.fields.find((field) => field.id === 'structure_remove_option_external_news');
const removeCalm = editModel.fields.find((field) => field.id === 'structure_remove_option_calm_path');
const removeRisky = editModel.fields.find((field) => field.id === 'structure_remove_option_risky_path');
const removeOrphanLayer = editModel.fields.find((field) => field.structureAction === 'remove_layer' && String(field.sectionId || '').endsWith('.orphan_branch'));
const removeCalmLayer = editModel.fields.find((field) => field.structureAction === 'remove_layer' && String(field.sectionId || '').endsWith('.calm_path'));
const removeMenuLayer = editModel.fields.find((field) => field.structureAction === 'remove_layer' && String(field.sectionId || '').endsWith('.menu_branch'));
assert(removeExternal && removeExternal.editability === 'guarded_apply', 'external remove field should remain guarded apply');
assert(removeExternal.structureOperationHint.safetyCandidate === 'guarded_option_line_delete', 'external field should carry graph hint');
assert(removeCalm && removeCalm.editability === 'advanced_source_patch', 'anchored local bundle should become an advanced source patch');
assert(removeCalm.structureOperationHint.safetyCandidate === 'advanced_option_bundle_delete', 'local remove field should carry advanced hint');
assert(removeRisky && removeRisky.structureOperationHint.safetyCandidate === 'aggressive_option_bundle_delete', 'risky remove field should carry aggressive hint');
assert(removeOrphanLayer && removeOrphanLayer.editability === 'advanced_source_patch', 'unreferenced exact branch layer should become an advanced remove-layer action');
assert(removeOrphanLayer.structureSourceBlock && removeOrphanLayer.structureSourceBlock.kind === 'layer_section_delete', 'remove-layer action should carry exact section delete evidence');
assert(removeCalmLayer && removeCalmLayer.structureSourceBlock && removeCalmLayer.structureSourceBlock.kind === 'layer_bundle_delete', 'referenced leaf branch removal should carry incoming option bundle evidence');
assert(removeCalmLayer.structureSourceBlock.incomingOptionSources.length === 1, 'referenced leaf branch removal should include the incoming option source');
assert(removeMenuLayer && removeMenuLayer.structureSourceBlock && removeMenuLayer.structureSourceBlock.kind === 'layer_bundle_delete', 'nested branch removal should carry nested bundle evidence');
assert(removeMenuLayer.structureSourceBlock.incomingOptionSources.length === 1, 'nested branch removal should include the parent incoming option source');
assert(removeMenuLayer.structureSourceBlock.childSectionSources.length === 1, 'nested branch removal should include the child result section source');

const proposal = existingEdit.buildProposal(editModel, {[removeCalm.id]: 'true'});
assert(proposal.changes.length === 2, 'advanced local option delete should produce option-line and section-delete changes');
assert(proposal.changes.every((change) => change.editability === 'advanced_source_patch'), 'local bundle changes should require advanced opt-in');
const bundle = existingEdit.buildExportBundle(proposal, index);
assert(bundle.installPlan.operations.length === 2, 'local bundle delete should export two install operations');
assert(bundle.installPlan.operations.every((operation) => operation.safety === 'advanced_apply'), 'local bundle delete operations should be advanced apply');
assert(bundle.installPlan.operations.some((operation) => operation.type === 'replace_text' && operation.replace === ''), 'local bundle delete should remove the option line');
assert(bundle.installPlan.operations.some((operation) => operation.type === 'replace_section' && operation.content === '' && operation.allowEmptyReplace), 'local bundle delete should remove the result section');

const layerProposal = existingEdit.buildProposal(editModel, {[removeOrphanLayer.id]: 'true'});
assert(layerProposal.changes.length === 1, 'advanced branch layer delete should produce one section replacement');
assert(layerProposal.changes[0].editability === 'advanced_source_patch', 'branch layer deletion should require advanced opt-in');
assert(layerProposal.changes[0].operationType === 'replace_section' && layerProposal.changes[0].allowEmptyReplace, 'branch layer deletion should be an empty replace_section operation');
const layerBundle = existingEdit.buildExportBundle(layerProposal, index);
assert(layerBundle.installPlan.operations.length === 1, 'branch layer deletion should export one install operation');
assert(layerBundle.installPlan.operations[0].type === 'replace_section' && layerBundle.installPlan.operations[0].safety === 'advanced_apply', 'branch layer deletion should export an advanced replace_section operation');

const referencedLayerProposal = existingEdit.buildProposal(editModel, {[removeCalmLayer.id]: 'true'});
assert(referencedLayerProposal.changes.length === 2, 'referenced leaf branch delete should remove incoming option and section');
const referencedLayerBundle = existingEdit.buildExportBundle(referencedLayerProposal, index);
assert(referencedLayerBundle.installPlan.operations.length === 2, 'referenced leaf branch delete should export two operations');
assert(referencedLayerBundle.installPlan.operations.some((operation) => operation.type === 'replace_text' && operation.safety === 'advanced_apply'), 'referenced leaf branch delete should remove the incoming option line');
assert(referencedLayerBundle.installPlan.operations.some((operation) => operation.type === 'replace_section' && operation.safety === 'advanced_apply'), 'referenced leaf branch delete should remove the section');

const nestedLayerProposal = existingEdit.buildProposal(editModel, {[removeMenuLayer.id]: 'true'});
assert(nestedLayerProposal.changes.length === 3, 'nested branch delete should remove incoming option, parent section, and child result section');
const nestedLayerBundle = existingEdit.buildExportBundle(nestedLayerProposal, index);
assert(nestedLayerBundle.installPlan.operations.length === 3, 'nested branch delete should export three operations');
assert(nestedLayerBundle.installPlan.operations.filter((operation) => operation.type === 'replace_section').length === 2, 'nested branch delete should remove parent and child sections');

const context = editingContext.buildContextModel(index, 'events', 'graph_event');
assert(context.ok, 'editing context should build');
assert(context.sourceStructureGraph.summary.removeOptionAdvancedCount === 3, 'editing context should carry updated graph summary');
assert(context.editors.structureActions.some((editor) => editor.structureOperationHint && editor.structureOperationHint.optionId === 'risky_path'), 'structure editors should keep operation hints');

const canvas = canvasModel.buildCanvasModel(index, {mode: 'existing', view: 'events', sceneId: 'graph_event'});
assert(canvas.ok, 'object canvas should build');
assert(canvas.eventBody.sourceStructureGraph.summary.removeOptionAggressiveCount === 1, 'canvas body should expose source graph');
assert(canvas.eventBody.structureActions.some((action) => action.structureOperationHint && action.structureOperationHint.optionId === 'calm_path'), 'canvas structure actions should carry source graph hints');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-source-graph-'));
fs.mkdirSync(path.join(tmpRoot, 'source', 'scenes', 'events'), {recursive: true});
fs.writeFileSync(path.join(tmpRoot, 'source', 'info.dry'), 'title: Source Graph Fixture\n', 'utf8');
const graphSourceText = [
  'title: Graph Event',
  'view-if: year = 1930 and month = 5',
  '',
  'Opening text.',
  '- @external_news: Send it to another scene.',
  '- @calm_path: Keep the result local.',
  '- @risky_path: Use the risky branch.',
  '- @menu_branch: Open the nested branch.',
  '',
  '# calm_path',
  'The local result can be removed as a bounded bundle.',
  'go-to: calm_done',
  '',
  '# risky_path',
  'The risky result needs explicit fallout review.',
  'go-to: risky_done',
  '',
  '# orphan_branch',
  'The orphan follow-up can be deleted.',
  '',
  '# menu_branch',
  'The menu branch owns a nested choice.',
  '- @nested_choice: Choose nested path.',
  '',
  '# nested_choice',
  'The nested result should be deleted with the parent menu.',
  'go-to: nested_done',
  ''
].join('\n');
fs.writeFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'graph_event.scene.dry'), graphSourceText, 'utf8');
bundle.installPlan.project = null;
const advancedApply = installPlan.applyInstallPlan(bundle.installPlan, {projectRoot: tmpRoot, dryRun: false, allowAdvanced: true});
assert(advancedApply.ok, 'advanced bundle delete should apply with explicit opt-in: ' + JSON.stringify(advancedApply));
const patched = fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'graph_event.scene.dry'), 'utf8');
assert(!patched.includes('- @calm_path:'), 'advanced bundle delete should remove option line');
assert(!patched.includes('# calm_path'), 'advanced bundle delete should remove local result section');
assert(patched.includes('# risky_path'), 'advanced bundle delete should leave unrelated branch intact');

fs.writeFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'graph_event.scene.dry'), graphSourceText, 'utf8');
layerBundle.installPlan.project = null;
const layerApply = installPlan.applyInstallPlan(layerBundle.installPlan, {projectRoot: tmpRoot, dryRun: false, allowAdvanced: true});
assert(layerApply.ok, 'advanced branch layer delete should apply with explicit opt-in: ' + JSON.stringify(layerApply));
const patchedLayer = fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'graph_event.scene.dry'), 'utf8');
assert(!patchedLayer.includes('# orphan_branch'), 'advanced branch layer delete should remove the branch header');
assert(!patchedLayer.includes('The orphan follow-up can be deleted.'), 'advanced branch layer delete should remove branch text');

fs.writeFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'graph_event.scene.dry'), graphSourceText, 'utf8');
referencedLayerBundle.installPlan.project = null;
const referencedApply = installPlan.applyInstallPlan(referencedLayerBundle.installPlan, {projectRoot: tmpRoot, dryRun: false, allowAdvanced: true});
assert(referencedApply.ok, 'advanced referenced leaf layer delete should apply with explicit opt-in: ' + JSON.stringify(referencedApply));
const patchedReferenced = fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'graph_event.scene.dry'), 'utf8');
assert(!patchedReferenced.includes('- @calm_path:'), 'referenced leaf layer delete should remove incoming option line');
assert(!patchedReferenced.includes('# calm_path'), 'referenced leaf layer delete should remove target section');

fs.writeFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'graph_event.scene.dry'), graphSourceText, 'utf8');
nestedLayerBundle.installPlan.project = null;
const nestedApply = installPlan.applyInstallPlan(nestedLayerBundle.installPlan, {projectRoot: tmpRoot, dryRun: false, allowAdvanced: true});
assert(nestedApply.ok, 'advanced nested layer delete should apply with explicit opt-in: ' + JSON.stringify(nestedApply));
const patchedNested = fs.readFileSync(path.join(tmpRoot, 'source', 'scenes', 'events', 'graph_event.scene.dry'), 'utf8');
assert(!patchedNested.includes('- @menu_branch:'), 'nested layer delete should remove parent incoming option line');
assert(!patchedNested.includes('# menu_branch'), 'nested layer delete should remove parent branch section');
assert(!patchedNested.includes('# nested_choice'), 'nested layer delete should remove child result section');

const branchIndex = branchBundleIndex();
const branchEditModel = existingEdit.buildEditModel(branchIndex, 'events', 'branch_bundle_event');
assert(branchEditModel.ok, 'branch bundle edit model should build');
assert(branchEditModel.sourceStructureGraph.summary.optionCount === 5, 'branch bundle graph should keep duplicate-target options distinct');
const removeSharedOptionOne = branchEditModel.fields.find((field) => field.id === 'structure_remove_option_shared_branch');
const removeSharedOptionTwo = branchEditModel.fields.find((field) => field.id === 'structure_remove_option_shared_branch__line_6');
assert(removeSharedOptionOne && removeSharedOptionOne.structureOperationHint && removeSharedOptionOne.structureOperationHint.optionId === 'shared_branch', 'first duplicate-target option should keep its own remove hint');
assert(removeSharedOptionTwo && removeSharedOptionTwo.structureOperationHint && removeSharedOptionTwo.structureOperationHint.optionId === 'shared_branch__line_6', 'second duplicate-target option should keep its own remove hint');
const removeSharedLayer = branchEditModel.fields.find((field) => field.structureAction === 'remove_layer' && String(field.sectionId || '').endsWith('.shared_branch'));
const removeDeepLayer = branchEditModel.fields.find((field) => field.structureAction === 'remove_layer' && String(field.sectionId || '').endsWith('.deep_menu'));
const removeRoutedLayer = branchEditModel.fields.find((field) => field.structureAction === 'remove_layer' && String(field.sectionId || '').endsWith('.routed_leaf'));
const rerouteSharedLayer = branchEditModel.fields.find((field) => field.structureAction === 'reroute_layer' && String(field.sectionId || '').endsWith('shared_branch'));
const rerouteRoutedLayer = branchEditModel.fields.find((field) => field.structureAction === 'reroute_layer' && String(field.sectionId || '').endsWith('routed_leaf'));
assert(removeSharedLayer && removeSharedLayer.structureSourceBlock && removeSharedLayer.structureSourceBlock.kind === 'layer_bundle_delete', 'multi-entry referenced branch should carry bundle evidence');
assert(removeSharedLayer.structureSourceBlock.incomingOptionSources.length === 2, 'multi-entry referenced branch should include every incoming option line');
assert(removeSharedLayer.structureSourceBlock.incomingRouteSources.length === 1, 'multi-entry referenced branch should include exact incoming go-to lines');
assert(removeSharedLayer.structureSourceBlock.safetyCandidate === 'aggressive_multi_referenced_layer_bundle_delete', 'multi-entry referenced branch should be an aggressive explicit bundle');
assert(removeDeepLayer && removeDeepLayer.structureSourceBlock && removeDeepLayer.structureSourceBlock.kind === 'layer_bundle_delete', 'deep nested branch should carry bundle evidence');
assert(removeDeepLayer.structureSourceBlock.childSectionSources.length === 2, 'deep nested branch should include all descendant result sections');
assert(removeRoutedLayer && removeRoutedLayer.structureSourceBlock && removeRoutedLayer.structureSourceBlock.kind === 'layer_bundle_delete', 'routed-only branch should carry bundle evidence');
assert(removeRoutedLayer.structureSourceBlock.safetyCandidate === 'aggressive_routed_layer_bundle_delete', 'routed-only branch should require aggressive explicit apply');
assert(removeRoutedLayer.structureSourceBlock.incomingRouteSources.length === 1, 'routed-only branch should include exact incoming go-to line');
assert(rerouteSharedLayer && rerouteSharedLayer.structureSourceBlock && rerouteSharedLayer.structureSourceBlock.kind === 'incoming_route_reroute', 'multi-entry referenced branch should expose incoming route reroute action');
assert(rerouteRoutedLayer && rerouteRoutedLayer.structureSourceBlock && rerouteRoutedLayer.structureSourceBlock.kind === 'incoming_route_reroute', 'routed-only branch should expose incoming route reroute action');

const sharedLayerProposal = existingEdit.buildProposal(branchEditModel, {[removeSharedLayer.id]: 'true'});
assert(sharedLayerProposal.changes.length === 4, 'multi-entry referenced branch delete should remove two incoming options, one go-to line, and one section');
assertDescendingSourceOrder(sharedLayerProposal.changes, 'multi-entry referenced branch delete should apply lower source lines first');
const sharedLayerBundle = existingEdit.buildExportBundle(sharedLayerProposal, branchIndex);
assert(sharedLayerBundle.installPlan.operations.length === 4, 'multi-entry referenced branch delete should export four operations');

const deepLayerProposal = existingEdit.buildProposal(branchEditModel, {[removeDeepLayer.id]: 'true'});
assert(deepLayerProposal.changes.length === 4, 'deep nested branch delete should remove incoming option, parent section, and descendant sections');
assertDescendingSourceOrder(deepLayerProposal.changes, 'deep nested branch delete should apply lower source lines first');
const deepLayerBundle = existingEdit.buildExportBundle(deepLayerProposal, branchIndex);
assert(deepLayerBundle.installPlan.operations.length === 4, 'deep nested branch delete should export four operations');
assert(deepLayerBundle.installPlan.operations.filter((operation) => operation.type === 'replace_section').length === 3, 'deep nested branch delete should remove parent and descendant sections');

const routedLayerProposal = existingEdit.buildProposal(branchEditModel, {[removeRoutedLayer.id]: 'true'});
assert(routedLayerProposal.changes.length === 2, 'routed-only branch delete should remove incoming route line and target section');
assertDescendingSourceOrder(routedLayerProposal.changes, 'routed-only branch delete should apply lower source lines first');
const routedLayerBundle = existingEdit.buildExportBundle(routedLayerProposal, branchIndex);
assert(routedLayerBundle.installPlan.operations.length === 2, 'routed-only branch delete should export two operations');

const rerouteSharedProposal = existingEdit.buildProposal(branchEditModel, {[rerouteSharedLayer.id]: 'deep_menu'});
assert(rerouteSharedProposal.changes.length === 1, 'mixed referenced branch reroute should only rewrite exact incoming go-to lines');
assert(rerouteSharedProposal.changes[0].before === 'go-to: shared_branch', 'mixed referenced branch reroute should search the old go-to line');
assert(rerouteSharedProposal.changes[0].after === 'go-to: deep_menu', 'mixed referenced branch reroute should retarget to the requested branch');
const rerouteSharedBundle = existingEdit.buildExportBundle(rerouteSharedProposal, branchIndex);
assert(rerouteSharedBundle.installPlan.operations.length === 1, 'mixed referenced branch reroute should export one route replace_text operation');

const rerouteRoutedProposal = existingEdit.buildProposal(branchEditModel, {[rerouteRoutedLayer.id]: 'deep_menu'});
assert(rerouteRoutedProposal.changes.length === 1, 'routed-only branch reroute should rewrite its exact incoming go-to line');
assert(rerouteRoutedProposal.changes[0].before === 'go-to: routed_leaf', 'routed-only branch reroute should search the old routed go-to line');
assert(rerouteRoutedProposal.changes[0].after === 'go-to: deep_menu', 'routed-only branch reroute should retarget to the requested branch');
const rerouteRoutedBundle = existingEdit.buildExportBundle(rerouteRoutedProposal, branchIndex);
assert(rerouteRoutedBundle.installPlan.operations.length === 1, 'routed-only branch reroute should export one route replace_text operation');

const branchTmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-branch-bundle-'));
fs.mkdirSync(path.join(branchTmpRoot, 'source', 'scenes', 'events'), {recursive: true});
fs.writeFileSync(path.join(branchTmpRoot, 'source', 'info.dry'), 'title: Branch Bundle Fixture\n', 'utf8');
const branchSourceText = [
  'title: Branch Bundle Event',
  '',
  '',
  'Opening text.',
  '- @shared_branch: Shared path one.',
  '- @shared_branch: Shared path two.',
  '- @deep_menu: Open the deep branch.',
  '',
  '# shared_branch',
  'The shared branch is entered from two choices.',
  '',
  '# deep_menu',
  'The deep menu owns a middle branch.',
  '- @middle_branch: Enter the middle branch.',
  '',
  '# middle_branch',
  'The middle branch owns a leaf.',
  '- @deep_leaf: Finish deep branch.',
  '',
  '# deep_leaf',
  'The deepest branch result can be removed with its ancestors.',
  '',
  '# route_source',
  'This branch routes into the shared result.',
  'go-to: shared_branch',
  '',
  '# routed_leaf',
  'The routed-only branch has no option references.',
  '',
  '# routed_source',
  'This branch routes into a routed-only target.',
  'go-to: routed_leaf',
  ''
].join('\n');
fs.writeFileSync(path.join(branchTmpRoot, 'source', 'scenes', 'events', 'branch_bundle_event.scene.dry'), branchSourceText, 'utf8');
sharedLayerBundle.installPlan.project = null;
const sharedApply = installPlan.applyInstallPlan(sharedLayerBundle.installPlan, {projectRoot: branchTmpRoot, dryRun: false, allowAdvanced: true});
assert(sharedApply.ok, 'multi-entry referenced branch delete should apply with explicit opt-in: ' + JSON.stringify(sharedApply));
const patchedShared = fs.readFileSync(path.join(branchTmpRoot, 'source', 'scenes', 'events', 'branch_bundle_event.scene.dry'), 'utf8');
assert(!patchedShared.includes('- @shared_branch:'), 'multi-entry referenced branch delete should remove all incoming option lines');
assert(!patchedShared.includes('go-to: shared_branch'), 'multi-entry referenced branch delete should remove incoming go-to lines');
assert(!patchedShared.includes('# shared_branch'), 'multi-entry referenced branch delete should remove the shared target section');
assert(patchedShared.includes('# deep_menu'), 'multi-entry referenced branch delete should leave unrelated nested branch intact');
assert(patchedShared.includes('# route_source'), 'multi-entry referenced branch delete should leave route owner section intact');

fs.writeFileSync(path.join(branchTmpRoot, 'source', 'scenes', 'events', 'branch_bundle_event.scene.dry'), branchSourceText, 'utf8');
deepLayerBundle.installPlan.project = null;
const deepApply = installPlan.applyInstallPlan(deepLayerBundle.installPlan, {projectRoot: branchTmpRoot, dryRun: false, allowAdvanced: true});
assert(deepApply.ok, 'deep nested branch delete should apply with explicit opt-in: ' + JSON.stringify(deepApply));
const patchedDeep = fs.readFileSync(path.join(branchTmpRoot, 'source', 'scenes', 'events', 'branch_bundle_event.scene.dry'), 'utf8');
assert(!patchedDeep.includes('- @deep_menu:'), 'deep nested branch delete should remove parent incoming option line');
assert(!patchedDeep.includes('# deep_menu'), 'deep nested branch delete should remove parent branch section');
assert(!patchedDeep.includes('# middle_branch'), 'deep nested branch delete should remove middle branch section');
assert(!patchedDeep.includes('# deep_leaf'), 'deep nested branch delete should remove deep leaf section');
assert(patchedDeep.includes('# shared_branch'), 'deep nested branch delete should leave unrelated shared branch intact');

fs.writeFileSync(path.join(branchTmpRoot, 'source', 'scenes', 'events', 'branch_bundle_event.scene.dry'), branchSourceText, 'utf8');
routedLayerBundle.installPlan.project = null;
const routedApply = installPlan.applyInstallPlan(routedLayerBundle.installPlan, {projectRoot: branchTmpRoot, dryRun: false, allowAdvanced: true});
assert(routedApply.ok, 'routed-only branch delete should apply with explicit opt-in: ' + JSON.stringify(routedApply));
const patchedRouted = fs.readFileSync(path.join(branchTmpRoot, 'source', 'scenes', 'events', 'branch_bundle_event.scene.dry'), 'utf8');
assert(!patchedRouted.includes('go-to: routed_leaf'), 'routed-only branch delete should remove incoming go-to line');
assert(!patchedRouted.includes('# routed_leaf'), 'routed-only branch delete should remove routed target section');
assert(patchedRouted.includes('# routed_source'), 'routed-only branch delete should leave route owner section intact');

fs.writeFileSync(path.join(branchTmpRoot, 'source', 'scenes', 'events', 'branch_bundle_event.scene.dry'), branchSourceText, 'utf8');
rerouteSharedBundle.installPlan.project = null;
const rerouteSharedApply = installPlan.applyInstallPlan(rerouteSharedBundle.installPlan, {projectRoot: branchTmpRoot, dryRun: false, allowAdvanced: true});
assert(rerouteSharedApply.ok, 'mixed referenced branch reroute should apply with explicit opt-in: ' + JSON.stringify(rerouteSharedApply));
const patchedRerouteShared = fs.readFileSync(path.join(branchTmpRoot, 'source', 'scenes', 'events', 'branch_bundle_event.scene.dry'), 'utf8');
assert(patchedRerouteShared.includes('go-to: deep_menu'), 'mixed referenced branch reroute should write the new go-to target');
assert(!patchedRerouteShared.includes('go-to: shared_branch'), 'mixed referenced branch reroute should remove the old go-to target');
assert(patchedRerouteShared.includes('# shared_branch'), 'mixed referenced branch reroute should leave the old target branch intact');

fs.writeFileSync(path.join(branchTmpRoot, 'source', 'scenes', 'events', 'branch_bundle_event.scene.dry'), branchSourceText, 'utf8');
rerouteRoutedBundle.installPlan.project = null;
const rerouteRoutedApply = installPlan.applyInstallPlan(rerouteRoutedBundle.installPlan, {projectRoot: branchTmpRoot, dryRun: false, allowAdvanced: true});
assert(rerouteRoutedApply.ok, 'routed-only branch reroute should apply with explicit opt-in: ' + JSON.stringify(rerouteRoutedApply));
const patchedRerouteRouted = fs.readFileSync(path.join(branchTmpRoot, 'source', 'scenes', 'events', 'branch_bundle_event.scene.dry'), 'utf8');
assert(patchedRerouteRouted.includes('go-to: deep_menu'), 'routed-only branch reroute should write the new go-to target');
assert(!patchedRerouteRouted.includes('go-to: routed_leaf'), 'routed-only branch reroute should remove the old route target');
assert(patchedRerouteRouted.includes('# routed_leaf'), 'routed-only branch reroute should leave the old target branch intact');

process.stdout.write(JSON.stringify({
  ok: true,
  nodes: editModel.sourceStructureGraph.summary.nodeCount,
  removeHints: editModel.sourceStructureGraph.summary
}, null, 2) + '\n');
