#!/usr/bin/env node
'use strict';

const sourceSlice = require('./authoring/source_slice_editor_model.js');
const installPlan = require('./authoring/install_plan.js');

const {failJson: fail, assertJson: assert} = require('./check_harness.js');

const index = {
  schemaVersion: '0.1',
  project: {name: 'Source Slice Fixture', root: '/tmp/source-slice', profileIds: ['generic-dendry']}
};

function classifyProposal(row, replacementText) {
  const model = sourceSlice.buildSourceSliceEditor(index, row);
  assert(model.ok, 'source slice model should open', {model, row});
  const proposal = sourceSlice.buildProposal(index, row, {replacementText});
  assert(proposal.ok, 'source slice proposal should build', proposal);
  const operation = proposal.installPlan.operations[0];
  const classification = installPlan.classifyOperation(operation);
  return {model, proposal, operation, classification};
}

const guarded = classifyProposal({
  id: 'event_body_line',
  label: 'Original body line',
  role: 'body',
  routeClass: 'source_slice_editor',
  installSafety: 'guarded_apply',
  installOperationType: 'replace_text',
  source: {
    path: 'source/scenes/events/source_slice_event.scene.dry',
    line: 8,
    anchorText: 'Original body line',
    endAnchorText: 'Original body line'
  }
}, 'Updated body line');
assert(guarded.operation.type === 'replace_text', 'single-line source slice should emit replace_text', guarded.operation);
assert(guarded.operation.search === 'Original body line', 'replace_text should search current source text', guarded.operation);
assert(guarded.operation.replace === 'Updated body line', 'replace_text should carry replacement text', guarded.operation);
assert(guarded.classification.status === 'guarded_apply', 'normal source slice should be guarded apply', guarded.classification);

const section = classifyProposal({
  id: 'event_section',
  label: 'Old section body.',
  role: 'body',
  routeClass: 'source_slice_editor',
  installSafety: 'guarded_apply',
  installOperationType: 'replace_section',
  source: {
    path: 'source/scenes/events/source_slice_event.scene.dry',
    line: 20,
    startLine: 20,
    endLine: 24,
    anchorText: '= Old Section',
    endAnchorText: 'Old section body.'
  }
}, '= New Section\n\nNew section body.');
assert(section.operation.type === 'replace_section', 'multi-line source slice should emit replace_section', section.operation);
assert(section.operation.anchorText === '= Old Section', 'replace_section should preserve start anchor', section.operation);
assert(section.operation.endAnchorText === 'Old section body.', 'replace_section should preserve end anchor', section.operation);
assert(section.classification.status === 'guarded_apply', 'normal source section should be guarded apply', section.classification);

const advanced = classifyProposal({
  id: 'router_line',
  label: 'Router Headline',
  role: 'news_headline',
  routeClass: 'advanced_source_patch',
  installSafety: 'advanced_apply',
  installOperationType: 'replace_text',
  source: {
    path: 'source/scenes/post_event_news.scene.dry',
    line: 42,
    anchorText: '- @event: Router Headline',
    endAnchorText: '- @event: Router Headline'
  }
}, '- @event: Updated Router Headline');
assert(advanced.model.advancedRequired, 'protected router source should require advanced apply', advanced.model);
assert(advanced.operation.type === 'replace_text', 'advanced source patch should still produce a concrete operation', advanced.operation);
assert(advanced.classification.status === 'advanced_apply', 'protected router patch should classify as advanced apply', advanced.classification);

const generated = sourceSlice.buildSourceSliceEditor(index, {
  id: 'generated_label',
  label: 'Generated label',
  routeClass: 'advanced_source_patch',
  installSafety: 'advanced_apply',
  source: {path: 'out/html/index.html', line: 3, anchorText: 'Generated label'}
});
assert(!generated.ok && generated.mappingBug, 'generated visible output should report a source mapping bug instead of a player limitation', generated);
const generatedProposal = sourceSlice.buildProposal(index, generated, {replacementText: 'Updated generated label'});
assert(!generatedProposal.ok && generatedProposal.mappingBug, 'generated output should not produce manual_snippet fallback', generatedProposal);
assert(!generatedProposal.operations.some((op) => op.type === 'manual_snippet'), 'generated mapping bug should not become manual_snippet', generatedProposal);

const sourceless = sourceSlice.buildSourceSliceEditor(index, {
  id: 'sourceless_visible',
  label: 'Sourceless visible text',
  routeClass: 'source_slice_editor',
  installSafety: 'guarded_apply',
  source: {}
});
assert(!sourceless.ok && sourceless.mappingBug && sourceless.playerLimit === false, 'sourceless visible row should be a Studio mapping bug', sourceless);

process.stdout.write(JSON.stringify({
  ok: true,
  guarded: guarded.classification.status,
  section: section.operation.type,
  advanced: advanced.classification.status,
  generatedMappingBug: generated.mappingBug,
  sourcelessMappingBug: sourceless.mappingBug
}, null, 2) + '\n');
