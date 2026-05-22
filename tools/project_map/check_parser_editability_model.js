#!/usr/bin/env node
'use strict';

const {spawnSync} = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const existingEdit = require('./authoring/existing_scene_edit_model.js');
const eventWorkbench = require('./authoring/event_workbench_model.js');
const installPlan = require('./authoring/install_plan.js');
const {pythonCommand} = require('./check_python_command.js');
const dryParser = require('dendrynexus/lib/parsers/dry.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function fail(message, details) {
  process.stderr.write(JSON.stringify(Object.assign({ok: false, message}, details || {}), null, 2) + '\n');
  process.exit(1);
}

function assert(condition, message, details) {
  if (!condition) {
    fail(message, details);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseDryContent(content) {
  let output = null;
  dryParser.parseFromContent('option_block_probe.scene.dry', content, (err, result) => {
    output = {err, result};
  });
  return output;
}

function runOptionBlockBoundaryAssertions() {
  const contiguous = parseDryContent([
    'title: Root',
    '',
    'Intro.',
    '',
    '- @one: One',
    '- @two: Two',
    ''
  ].join('\n'));
  assert(!contiguous.err && contiguous.result.options.length === 2, 'Dendry parser should accept contiguous option lines', contiguous.err && contiguous.err.toString());

  const blankBeforeFirst = parseDryContent([
    'title: Root',
    '',
    'Intro.',
    '',
    '- @one: One',
    ''
  ].join('\n'));
  assert(!blankBeforeFirst.err && blankBeforeFirst.result.options.length === 1, 'Dendry parser should allow the blank line that starts an option block after prose', blankBeforeFirst.err && blankBeforeFirst.err.toString());

  const blankBetween = parseDryContent([
    'title: Root',
    '',
    'Intro.',
    '',
    '- @one: One',
    '',
    '- @two: Two',
    ''
  ].join('\n'));
  assert(blankBetween.err && /Found content after an options block/.test(blankBetween.err.toString()), 'Dendry parser should reject a blank line that splits one option block before another option', blankBetween.err && blankBetween.err.toString());

  const contiguousTagInsert = parseDryContent([
    'title: Root',
    '',
    'Intro.',
    '',
    '- @one: One',
    '- #event: Monthly event popups',
    '- @two: Two',
    ''
  ].join('\n'));
  assert(!contiguousTagInsert.err && contiguousTagInsert.result.options.some((option) => option.id === '#event'), 'Dendry parser should accept contiguous tag-router options inside an option block', contiguousTagInsert.err && contiguousTagInsert.err.toString());

  const trailingBlank = parseDryContent([
    'title: Root',
    '',
    'Intro.',
    '',
    '- @one: One',
    '',
    ''
  ].join('\n'));
  assert(!trailingBlank.err && trailingBlank.result.options.length === 1, 'Dendry parser should allow trailing blank lines after the final option', trailingBlank.err && trailingBlank.err.toString());

  const sectionAfterOptions = parseDryContent([
    'title: Root',
    '',
    '- @local: Local',
    '',
    '@local',
    'title: Local',
    '',
    'Local section.',
    ''
  ].join('\n'));
  assert(!sectionAfterOptions.err && sectionAfterOptions.result.sections.length === 1, 'Dendry parser should allow a section after an option block', sectionAfterOptions.err && sectionAfterOptions.err.toString());

  return 6;
}

function writeFixture(root) {
  const scenes = path.join(root, 'source', 'scenes');
  const events = path.join(scenes, 'events');
  fs.mkdirSync(events, {recursive: true});
  fs.writeFileSync(path.join(root, 'source', 'info.dry'), [
    'title: Parser Editability Fixture',
    'author: Dendry Mod Studio',
    'ifid: 00000000-0000-4000-8000-000000000123',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(scenes, 'root.scene.dry'), [
    'title: Root',
    'new-page: true',
    '',
    '= Root',
    'Open the parser editability fixture.',
    '',
    '- @parser_story: Begin',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(scenes, 'main.scene.dry'), [
    'title: Main',
    'is-hand: true',
    'max-cards: 4',
    '',
    '- @parser_deck',
    '',
    '@parser_deck',
    'title: Parser Deck',
    'is-deck: true',
    '',
    '- #parser',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(events, 'parser_story.scene.dry'), [
    'Title: Parser Story',
    'tags: event parser',
    'view-if: year = 1936 and month >= 1',
    'priority: 2',
    'faceImage: img/events/camelFace.png',
    'setBg: img/events/camelBg.jpg',
    'on-arrival: parser_seen = 1; debate_leader = "Scholz"; debate_leader = "Curtius" if reform_done; public_order -= 2 if reform_done = 0',
    'on-departure: departure_flag = 1; cleanup_score += 2 if public_order > 0',
    'new-page: true',
    '',
    '= Parser Story',
    'First line of the public scene.',
    'Second line continues the public scene.',
    '',
    '- @next_scene: Open debate——Make it visible.',
    '- #parser_card: Pull tagged card——From the tag lane.',
    '',
    '@next_scene',
    'Title: Debate Result',
    'subtitle: Result subtitle',
    'choose-if: public_order > 0',
    'unavailableSubtitle: Not enough order.',
    '',
    '= Debate Result',
    'The debate branch can be edited.',
    'face-image: img/events/inertAfterBody.png',
    '',
    '- @root: Return',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(events, 'advanced_parser.scene.dry'), [
    'Title: Advanced Parser',
    'go-to-ref: dynamic_scene_ref if dynamic_ready; fallback_scene_ref',
    'check-quality: public_order',
    'broad-difficulty: 60',
    'difficulty-scaler: 0.5',
    'check-success-go-to: success',
    'check-failure-go-to: failure',
    'set-sprites: topLeft: img/events/spriteOne.png, bottomRight: img/events/spriteTwo.webp',
    'set-music: audio/theme.mp3',
    'audio: queue audio/cue.ogg, audio/click.wav',
    'set-top-left-style: "width: 10px"',
    '',
    'Advanced parser fixture body.',
    '',
    '@success',
    'Title: Success',
    '',
    'The check succeeded.',
    '',
    '@failure',
    'Title: Failure',
    '',
    'The check failed.',
    ''
  ].join('\n'), 'utf8');
}

function buildIndex(root) {
  const out = path.join(os.tmpdir(), 'dms-parser-editability-' + process.pid + '.json');
  const result = spawnSync(pythonCommand(), [
    path.join(REPO_ROOT, 'tools', 'project_map', 'build_project_map.py'),
    '--root',
    root,
    '--out',
    out,
    '--summary'
  ], {cwd: REPO_ROOT, encoding: 'utf8'});
  assert(result.status === 0, 'ProjectIndex build should succeed', {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status
  });
  return readJson(out);
}

function textItems(index) {
  return index.semantic && index.semantic.textCorpus && Array.isArray(index.semantic.textCorpus.items)
    ? index.semantic.textCorpus.items
    : [];
}

function stableTextId(rel, line, role, text) {
  const digest = crypto.createHash('sha1').update(rel + ':' + line + ':' + role + ':' + text).digest('hex').slice(0, 12);
  return 'text_' + digest;
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_parser_editability_'));
const optionBlockBoundaryCases = runOptionBlockBoundaryAssertions();
writeFixture(root);
const index = buildIndex(root);
const corpus = textItems(index);

const body = corpus.find((item) => item.role === 'body' && String(item.text || '').includes('First line of the public scene'));
assert(body, 'Text Corpus should keep multiline body prose');
assert(body.source && body.source.startLine === 12 && body.source.endLine === 13, 'multiline body should keep source range', body);
assert(String(body.originalText || '').includes('\nSecond line continues'), 'multiline body should keep original source text', body);
assert(body.source.anchorText === 'First line of the public scene.', 'body source should keep first anchor', body);
assert(body.source.endAnchorText === 'Second line continues the public scene.', 'body source should keep end anchor', body);

const parsedTitle = corpus.find((item) => item.role === 'title' && item.text === 'Parser Story');
const unavailableText = corpus.find((item) => item.role === 'unavailable_text' && item.text === 'Not enough order.');
assert(parsedTitle && parsedTitle.source && parsedTitle.source.line === 1, 'Text Corpus should recognize capitalized Dendry Title metadata');
assert(unavailableText, 'Text Corpus should recognize camelCase unavailableSubtitle metadata');

const optionLabel = corpus.find((item) => item.role === 'option_label' && item.text === 'Open debate');
const optionSubtitle = corpus.find((item) => item.role === 'option_subtitle' && item.text === 'Make it visible.');
const tagOption = corpus.find((item) => item.role === 'option_label' && item.text === 'Pull tagged card');
assert(optionLabel, 'option parser should split visible option labels');
assert(optionSubtitle, 'option parser should split visible option subtitles');
assert(tagOption && tagOption.optionId === 'parser_card', 'option parser should index #tag option labels');
assert(
  optionLabel.id === stableTextId('source/scenes/events/parser_story.scene.dry', 15, 'option_label', 'Open debate——Make it visible.'),
  'split option labels should keep the pre-split stable text id for saved-draft compatibility',
  optionLabel
);

const reformVariable = index.variables.find((variable) => variable.name === 'reform_done');
const leaderVariable = index.variables.find((variable) => variable.name === 'debate_leader');
const departureVariable = index.variables.find((variable) => variable.name === 'departure_flag');
const cleanupVariable = index.variables.find((variable) => variable.name === 'cleanup_score');
assert(reformVariable && reformVariable.reads.some((ref) => ref.path === 'source/scenes/events/parser_story.scene.dry' && ref.line === 7), 'shorthand on-arrival if suffix should index condition variables as reads', reformVariable);
assert(leaderVariable && leaderVariable.writes.some((ref) => ref.path === 'source/scenes/events/parser_story.scene.dry' && ref.line === 7), 'shorthand on-arrival assignments should still index variable writes', leaderVariable);
assert(departureVariable && departureVariable.writes.some((ref) => ref.path === 'source/scenes/events/parser_story.scene.dry' && ref.line === 8), 'shorthand on-departure assignments should index variable writes', departureVariable);
assert(cleanupVariable && cleanupVariable.reads.some((ref) => ref.path === 'source/scenes/events/parser_story.scene.dry' && ref.line === 8), 'on-departure increments should index the written variable as a read', cleanupVariable);

const indexedScene = index.scenes.find((item) => item.id === 'parser_story');
assert(indexedScene && indexedScene.effects && indexedScene.effects.some((effect) => effect.variable === 'public_order' && effect.sourceExpression === 'public_order -= 2 if reform_done = 0'), 'ProjectIndex should keep source-backed shorthand on-arrival effects', indexedScene && indexedScene.effects);
assert(indexedScene && indexedScene.effects && indexedScene.effects.some((effect) => effect.variable === 'cleanup_score' && effect.hook === 'on-departure'), 'ProjectIndex should keep source-backed shorthand on-departure effects', indexedScene && indexedScene.effects);
const nextSection = indexedScene && indexedScene.sections && indexedScene.sections.find((section) => section.id === 'parser_story.next_scene');
assert(nextSection && nextSection.unavailableSubtitle === 'Not enough order.', 'ProjectIndex should retain section unavailable-subtitle values for branch semantics', nextSection);
assert(indexedScene && indexedScene.assetRefs && indexedScene.assetRefs.some((asset) => asset.path === 'img/events/camelFace.png' && asset.directive === 'face-image'), 'ProjectIndex should normalize camelCase faceImage asset directives', indexedScene && indexedScene.assetRefs);
assert(indexedScene && indexedScene.assetRefs && indexedScene.assetRefs.some((asset) => asset.path === 'img/events/camelBg.jpg' && asset.directive === 'set-bg'), 'ProjectIndex should normalize camelCase setBg asset directives', indexedScene && indexedScene.assetRefs);
const inertFaceRef = indexedScene && indexedScene.assetRefs && indexedScene.assetRefs.find((asset) => asset.path === 'img/events/inertAfterBody.png');
assert(inertFaceRef && inertFaceRef.directiveStatus === 'inert_after_content' && inertFaceRef.runtimeActive === false, 'ProjectIndex should flag metadata-looking asset directives that Dendry will ignore after body text', inertFaceRef);
assert(index.diagnostics.some((diag) => diag.code === 'project_map.inert_metadata_directive' && diag.path === 'source/scenes/events/parser_story.scene.dry' && diag.directive === 'face-image'), 'ProjectIndex should diagnose inert metadata-looking directives after body text', index.diagnostics);
const handScene = index.scenes.find((item) => item.id === 'main');
assert(handScene && handScene.maxCards === '4' && handScene.flags && handScene.flags.isHand, 'ProjectIndex should retain max-cards metadata on hand scenes', handScene);
const sectionDeck = index.semantic && index.semantic.decks && index.semantic.decks.find((item) => item.id === 'main.parser_deck');
assert(sectionDeck && sectionDeck.ownerKind === 'section' && sectionDeck.ownerSceneId === 'main', 'semantic decks should include section-owned decks inside hand scenes', index.semantic && index.semantic.decks);
assert(sectionDeck && sectionDeck.options && sectionDeck.options.some((option) => option.id === '#parser'), 'section-owned deck semantic refs should keep deck tag-route options for Card Board lanes', sectionDeck);
assert(index.summary && index.summary.deckCount >= 1, 'summary deck count should include section-owned decks', index.summary);
assert(index.edges.some((edge) => edge.from === 'main' && edge.to === 'main.parser_deck'), 'graph should resolve hand option routes to section-owned deck ids', index.edges);
const advancedScene = index.scenes.find((item) => item.id === 'advanced_parser');
assert(advancedScene && advancedScene.checkQuality === 'public_order' && advancedScene.broadDifficulty === '60' && advancedScene.difficultyScaler === '0.5', 'ProjectIndex should retain DendryNexus stat-check metadata', advancedScene);
assert(advancedScene && advancedScene.setTopLeftStyle === '"width: 10px"', 'ProjectIndex should retain sprite style metadata as source-backed evidence', advancedScene);
assert(advancedScene && advancedScene.assetRefs && advancedScene.assetRefs.some((asset) => asset.path === 'img/events/spriteOne.png' && asset.directive === 'set-sprites'), 'ProjectIndex should index set-sprites image references', advancedScene && advancedScene.assetRefs);
assert(advancedScene && advancedScene.assetRefs && advancedScene.assetRefs.some((asset) => asset.path === 'audio/theme.mp3' && asset.directive === 'set-music'), 'ProjectIndex should index set-music audio references', advancedScene && advancedScene.assetRefs);
assert(advancedScene && advancedScene.assetRefs && advancedScene.assetRefs.some((asset) => asset.path === 'audio/cue.ogg' && asset.directive === 'audio'), 'ProjectIndex should index multi-audio references on audio directives', advancedScene && advancedScene.assetRefs);
const goToRefEdges = index.edges.filter((edge) => edge.from === 'advanced_parser' && String(edge.kind || '').includes('go_to_ref'));
assert(goToRefEdges.length === 2, 'graph should retain go-to-ref clauses as dynamic route evidence', goToRefEdges);
assert(goToRefEdges.every((edge) => edge.dynamicTarget === true && edge.targetSource === 'quality' && String(edge.to || '').startsWith('quality_ref:')), 'go-to-ref edges should target quality refs instead of static scene ids', goToRefEdges);
assert(!index.diagnostics.some((diag) => diag.code === 'project_map.missing_target' && String(diag.message || '').includes('dynamic_scene_ref')), 'go-to-ref quality names should not be reported as missing static scene targets', index.diagnostics);
const indexedOption = indexedScene && indexedScene.options && indexedScene.options.find((option) => option.id === '@next_scene');
assert(indexedOption && indexedOption.sourceSpan && indexedOption.sourceSpan.anchorText === '- @next_scene: Open debate——Make it visible.', 'ProjectIndex should keep option source anchors for structural deletion', indexedOption);

const model = existingEdit.buildEditModel(index, 'events', 'parser_story');
assert(model.ok, 'Existing Scene Edit model should build from parser-backed index', model.diagnostics);
const workbench = eventWorkbench.buildEventWorkbench(index, 'parser_story');
const nextOption = workbench.options.find((option) => option.id === 'next_scene');
assert(nextOption && nextOption.unavailableText === 'Not enough order.', 'Event Workbench should surface section unavailable text on its owning option', workbench.options);
assert(model.fields.some((field) => field.id === optionLabel.id && field.original === 'Open debate'), 'existing edit model should expose parsed option label');
assert(model.fields.some((field) => field.id === optionSubtitle.id && field.original === 'Make it visible.'), 'existing edit model should expose parsed option subtitle');
assert(model.fields.some((field) => field.role === 'unavailable_text' && field.original === 'Not enough order.'), 'existing edit model should expose camelCase unavailableSubtitle as editable visible text');
assert(model.fields.some((field) => field.id === 'metadata_priority' && field.editability === 'guarded_replace_text'), 'existing edit model should expose guarded metadata priority');
const publicOrderEffect = model.fields.find((field) => field.role === 'effect' && field.original === 'Q.public_order -= 2 if reform_done = 0');
const departureEffect = model.fields.find((field) => field.role === 'effect' && field.original === 'Q.cleanup_score += 2 if public_order > 0');
assert(publicOrderEffect, 'existing edit model should expose shorthand on-arrival effects as editable effect fields');
assert(departureEffect && departureEffect.effectHook === 'on-departure', 'existing edit model should expose shorthand on-departure effects as editable effect fields', departureEffect);
assert(publicOrderEffect.editability === 'guarded_replace_text', 'source-backed shorthand effect should be guarded', publicOrderEffect);
assert(publicOrderEffect.searchText === 'public_order -= 2 if reform_done = 0', 'shorthand effect should preserve bare source syntax for replacement', publicOrderEffect);
const removeOptionField = model.fields.find((field) => field.structureAction === 'remove_option' && field.optionId === 'next_scene');
assert(removeOptionField, 'existing edit model should expose parser-backed option deletion');
assert(removeOptionField.editability === 'advanced_source_patch', 'source-backed option deletion with local result fallout should be applyable, not manual review', removeOptionField);
assert(removeOptionField.structureSourceBlock && removeOptionField.structureSourceBlock.kind === 'option_bundle_delete', 'option deletion with local result fallout should carry source-backed bundle evidence', removeOptionField);

const block = model.textBlocks.find((item) => String(item.original || '').includes('First line of the public scene'));
assert(block, 'existing edit model should build a source-backed page block from parsed body text');

const optionProposal = existingEdit.buildProposal(model, {
  [optionLabel.id]: 'Open policy debate',
  metadata_priority: '3'
});
const optionBundle = existingEdit.buildExportBundle(optionProposal, index);
assert(optionBundle.installPlan.operations.length === 2, 'option/metadata proposal should create two operations');
assert(optionBundle.installPlan.operations.every((operation) => operation.type === 'replace_text'), 'option/metadata edits should be replace_text');
assert(optionBundle.installPlan.operations.every((operation) => operation.safety === 'guarded_apply'), 'option/metadata edits should be guarded');

const removeOptionProposal = existingEdit.buildProposal(model, {
  [removeOptionField.id]: 'true'
});
const removeOptionBundle = existingEdit.buildExportBundle(removeOptionProposal, index);
assert(removeOptionBundle.installPlan.operations.length === 2, 'option deletion with local result fallout should create option-line and result-section operations');
assert(removeOptionBundle.installPlan.operations[0].type === 'replace_text', 'option deletion should replace exactly one source line');
assert(removeOptionBundle.installPlan.operations.every((operation) => operation.safety === 'advanced_apply'), 'option deletion bundle should be advanced apply, not manual review');
assert(removeOptionBundle.installPlan.operations[0].search === '- @next_scene: Open debate——Make it visible.', 'option deletion should search for the exact option line', removeOptionBundle.installPlan.operations[0]);
assert(removeOptionBundle.installPlan.operations[0].replace === '', 'option deletion should remove the exact option line', removeOptionBundle.installPlan.operations[0]);
const removeOptionDryRun = installPlan.applyInstallPlan(removeOptionBundle.installPlan, {projectRoot: root, dryRun: true, allowAdvanced: true});
assert(removeOptionDryRun.ok && removeOptionDryRun.results[0].status === 'would_apply', 'source-backed option deletion should dry-run cleanly', removeOptionDryRun);

const effectProposal = existingEdit.buildProposal(model, {
  [publicOrderEffect.id]: 'Q.public_order -= 3 if reform_done = 0'
});
const effectBundle = existingEdit.buildExportBundle(effectProposal, index);
assert(effectBundle.installPlan.operations.length === 1, 'effect proposal should create one operation');
assert(effectBundle.installPlan.operations[0].search === 'public_order -= 2 if reform_done = 0', 'effect edit should search for the bare source expression', effectBundle.installPlan.operations[0]);
assert(effectBundle.installPlan.operations[0].replace === 'public_order -= 3 if reform_done = 0', 'effect edit should write back Dendry shorthand without Q prefix', effectBundle.installPlan.operations[0]);
const effectDryRun = installPlan.applyInstallPlan(effectBundle.installPlan, {projectRoot: root, dryRun: true});
assert(effectDryRun.ok && effectDryRun.results[0].status === 'would_apply', 'source-backed shorthand effect replacement should dry-run cleanly', effectDryRun);
const effectApplied = installPlan.applyInstallPlan(effectBundle.installPlan, {projectRoot: root, dryRun: false});
assert(effectApplied.ok && effectApplied.results[0].status === 'applied', 'source-backed shorthand effect replacement should apply cleanly', effectApplied);
assert(fs.readFileSync(path.join(root, 'source', 'scenes', 'events', 'parser_story.scene.dry'), 'utf8').includes('public_order -= 3 if reform_done = 0'), 'source should contain applied shorthand effect replacement');

const blockProposal = existingEdit.buildProposal(model, {
  ['block:' + block.id]: [
    '= Parser Story',
    'A replaced parser-backed section.',
    'It still uses guarded source anchors.',
    ''
  ].join('\n')
});
const blockBundle = existingEdit.buildExportBundle(blockProposal, index);
assert(blockBundle.installPlan.operations[0].type === 'replace_section', 'page block edit should create replace_section');
assert(blockBundle.installPlan.operations[0].safety === 'guarded_apply', 'page block edit should be guarded');

const dryRun = installPlan.applyInstallPlan(blockBundle.installPlan, {projectRoot: root, dryRun: true});
assert(dryRun.ok && dryRun.results[0].status === 'would_apply', 'parser-backed section replacement should dry-run cleanly', dryRun);
const applied = installPlan.applyInstallPlan(blockBundle.installPlan, {projectRoot: root, dryRun: false});
assert(applied.ok && applied.results[0].status === 'applied', 'parser-backed section replacement should apply to fixture', applied);
assert(fs.readFileSync(path.join(root, 'source', 'scenes', 'events', 'parser_story.scene.dry'), 'utf8').includes('replaced parser-backed section'), 'source should contain applied parser-backed replacement');
const removeOptionApplied = installPlan.applyInstallPlan(removeOptionBundle.installPlan, {projectRoot: root, dryRun: false, allowAdvanced: true});
assert(removeOptionApplied.ok && removeOptionApplied.results[0].status === 'applied', 'source-backed option deletion should apply to fixture', removeOptionApplied);
assert(!fs.readFileSync(path.join(root, 'source', 'scenes', 'events', 'parser_story.scene.dry'), 'utf8').includes('- @next_scene: Open debate——Make it visible.'), 'source should no longer contain the deleted option line');

process.stdout.write(JSON.stringify({
  ok: true,
  textItems: corpus.length,
  fields: model.fields.length,
  textBlocks: model.textBlocks.length,
  optionOperations: optionBundle.installPlan.operations.length,
  optionBlockBoundaryCases,
  removeOptionSafety: removeOptionBundle.installPlan.operations[0].safety
}, null, 2) + '\n');
